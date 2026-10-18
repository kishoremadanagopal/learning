"""Build the Python course from the Markdown sources in content/.

Writes:
  index.html, app.js, lessons.js, playground.html   the practice sandbox (GitHub Pages)
  lessons/NN-slug.md                                lesson pages readable on GitHub
  glossary.md, cheatsheet.md, README.md             course materials

Usage:
  python build.py            # rebuild everything
  python build.py --test     # also run every example and exercise solution with CPython

Requires: pip install markdown
"""
import contextlib
import html
import io
import json
import random
import re
import shutil
import sys
import zlib
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content"
FIGURES = ROOT / "figures"
REPO_MODE = ROOT.name == "course"                  # inside the published repository
SITE = ROOT.parent if REPO_MODE else ROOT / "site"
SITE_URL = "https://kishoremadanagopal.github.io/learning/python/"
REPO_BLOB = "https://github.com/kishoremadanagopal/learning/blob/main/python/"

FENCE_RE = re.compile(r"^```([\w-]*)([^\n]*)\n(.*?)\n```[ \t]*$", re.S | re.M)
BLOCK_RE = re.compile(r"^:::(exercise|quiz)([^\n]*)\n(.*?)\n:::[ \t]*$", re.S | re.M)


# ---------------------------------------------------------------- parsing

def parse_info(rest):
    opts = {}
    for tok in rest.split():
        if "=" in tok:
            k, v = tok.split("=", 1)
            opts[k] = v
        else:
            opts[tok] = True
    return opts


def md_to_html(text):
    """Render lesson Markdown for the sandbox. Python fences become runnable examples."""
    examples = []

    def repl(m):
        lang, info, code = m.group(1), m.group(2), m.group(3)
        opts = parse_info(info)
        if lang == "python":
            stdin = opts.get("stdin", "")
            stdin = stdin.replace("|", "\n") if isinstance(stdin, str) else ""
            examples.append({"code": code, "stdin": stdin, "error": bool(opts.get("error"))})
            return f'\n<div class="example" data-ex="{len(examples) - 1}"></div>\n'
        cls = "out" if lang in ("output", "text", "") else "plain"
        return f'\n<pre class="{cls}">{html.escape(code)}</pre>\n'

    text = FENCE_RE.sub(repl, text)
    out = markdown.markdown(text, extensions=["tables", "sane_lists"])
    out = out.replace("\\|", "|")
    out = out.replace("<table>", '<div class="table-wrap"><table>').replace("</table>", "</table></div>")
    return out, examples


def inline_md(s):
    h = markdown.markdown(s)
    return re.sub(r"^<p>(.*)</p>$", r"\1", h, flags=re.S)


def parse_exercise(title, body):
    ex = {"title": title.strip(), "starter": "", "check": "", "solution": "", "stdin": "", "hint": "", "_hint": ""}

    def grab(m):
        lang, info, code = m.group(1), m.group(2).strip(), m.group(3)
        if lang == "python" and info in ("starter", "check", "solution", "stdin"):
            ex[info] = code
            return ""
        return m.group(0)

    body = FENCE_RE.sub(grab, body)
    hint = re.search(r"^hint:\s*(.+)$", body, re.M)
    if hint:
        ex["_hint"] = hint.group(1).strip()
        ex["hint"] = markdown.markdown(ex["_hint"])
        body = body[: hint.start()] + body[hint.end():]
    ex["_prompt"] = body.strip()
    ex["prompt"], _ = md_to_html(body.strip())
    for k in ("check", "solution"):
        if not ex[k]:
            raise ValueError(f"Exercise {title!r} is missing its {k} block")
    return ex


def parse_quiz(body):
    questions = []
    for chunk in re.split(r"^\?\s+", body.strip(), flags=re.M):
        chunk = chunk.strip()
        if not chunk:
            continue
        lines = chunk.splitlines()
        q = {"q": inline_md(lines[0]), "options": [], "answer": None, "explain": "",
             "_q": lines[0].strip(), "_options": [], "_explain": ""}
        for ln in lines[1:]:
            ln = ln.strip()
            if ln.startswith(("- ", "+ ")):
                if ln.startswith("+ "):
                    q["answer"] = len(q["options"])
                q["options"].append(inline_md(ln[2:]))
                q["_options"].append(ln[2:])
            elif ln.startswith("= "):
                q["explain"] = inline_md(ln[2:])
                q["_explain"] = ln[2:]
        if q["answer"] is None:
            raise ValueError(f"Quiz question without a correct answer: {lines[0]}")
        shuffle_options(q, q["_q"])
        questions.append(q)
    return questions


def shuffle_options(q, seed_text):
    """Authors write the right answer first; show the options in a fixed shuffled order (the same on every build).
    `order` maps each shown position to the authored one, so saved answers from before shuffling can be remapped."""
    order = list(range(len(q["options"])))
    random.Random(zlib.crc32(seed_text.encode())).shuffle(order)
    q["options"] = [q["options"][i] for i in order]
    q["_options"] = [q["_options"][i] for i in order]
    q["answer"] = order.index(q["answer"])
    q["order"] = order


def parse_extras(path):
    """content/extras.md: per-lesson topics, key terms and common mistakes."""
    extras = {}
    for chunk in re.split(r"^@@ ", path.read_text(), flags=re.M)[1:]:
        lines = chunk.splitlines()
        lid = lines[0].strip()
        item = {"topics": "", "terms": [], "mistakes": []}
        section = None
        for ln in lines[1:]:
            if ln.startswith("topics:"):
                item["topics"] = ln.split(":", 1)[1].strip()
            elif ln.strip() in ("terms:", "mistakes:"):
                section = ln.strip()[:-1]
            elif ln.startswith("- ") and section:
                item[section].append(ln[2:].strip())
        extras[lid] = item
    return extras


def parse_file(path):
    parts, lessons = [], []
    chunks = re.split(r"^@@@ (part|lesson)\s*$", path.read_text(), flags=re.M)
    for kind, chunk in zip(chunks[1::2], chunks[2::2]):
        if kind == "part":
            meta = dict(ln.split(": ", 1) for ln in chunk.strip().splitlines() if ": " in ln)
            parts.append(meta)
            continue
        head, body = chunk.split("\n---\n", 1)
        meta = dict(ln.split(": ", 1) for ln in head.strip().splitlines() if ": " in ln)
        exercises, quiz = [], []

        def take(m):
            if m.group(1) == "exercise":
                exercises.append(parse_exercise(m.group(2), m.group(3)))
            else:
                quiz.extend(parse_quiz(m.group(3)))
            return ""

        body = BLOCK_RE.sub(take, body).strip()
        body_html, examples = md_to_html(body)
        lessons.append({
            "id": meta["id"], "title": meta["title"].strip('"'), "minutes": int(meta.get("minutes", 10)),
            "summary": meta.get("summary", ""), "part": parts[-1]["id"],
            "html": body_html, "examples": examples, "exercises": exercises, "quiz": quiz, "_md": body,
        })
    return parts, lessons


def build():
    parts, lessons = [], []
    for f in sorted(CONTENT.glob("part*.md")):
        p, l = parse_file(f)
        parts += p
        lessons += l
    ids = [l["id"] for l in lessons]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        raise ValueError(f"Duplicate lesson ids: {dupes}")

    extras = parse_extras(CONTENT / "extras.md")
    missing = [i for i in ids if i not in extras]
    if missing:
        raise ValueError(f"No key terms / mistakes in extras.md for: {missing}")
    number = 0
    for n, l in enumerate(lessons, start=1):
        l["n"] = n
        l["file"] = f"lessons/{n:02d}-{l['id']}.md"
        e = extras[l["id"]]
        l["topics"] = e["topics"]
        l["_terms"], l["_mistakes"] = e["terms"], e["mistakes"]
        l["terms"] = [inline_md(t) for t in e["terms"]]
        l["mistakes"] = [inline_md(m) for m in e["mistakes"]]
        for ex in l["exercises"]:
            number += 1
            ex["number"] = number
    return {"parts": parts, "lessons": lessons}


def public(obj):
    """Drop the raw-Markdown fields (keys starting with _) before writing lessons.js."""
    if isinstance(obj, dict):
        return {k: public(v) for k, v in obj.items() if not k.startswith("_")}
    if isinstance(obj, list):
        return [public(v) for v in obj]
    return obj


# ---------------------------------------------------------------- GitHub Markdown

def gh_fences(text):
    """Turn sandbox fences into plain GitHub fences, with notes for input and errors."""
    def repl(m):
        lang, info, code = m.group(1), m.group(2), m.group(3)
        opts = parse_info(info)
        if lang == "python":
            note = ""
            if isinstance(opts.get("stdin"), str):
                typed = ", ".join(f"`{v}`" for v in opts["stdin"].split("|"))
                note += f"*Input typed for this example: {typed}*\n\n"
            if opts.get("error"):
                note += "*This example raises an error on purpose.*\n\n"
            return f"{note}```python\n{code}\n```"
        if lang in ("output", "text", ""):
            return f"```text\n{code}\n```"
        if lang == "py-static":
            shell = all(ln.startswith(("pip ", "python ", "source ", "#")) or not ln.strip() for ln in code.splitlines())
            return f"```{'bash' if shell else 'python'}\n{code}\n```"
        return m.group(0)
    return FENCE_RE.sub(repl, text)


def ex_range(lesson):
    nums = [ex["number"] for ex in lesson["exercises"]]
    if not nums:
        return "—"
    return str(nums[0]) if len(nums) == 1 else f"{nums[0]}–{nums[-1]}"


def lesson_markdown(l, lessons):
    i = l["n"] - 1
    lines = [
        f"# Lesson {l['n']}: {l['title']}",
        "",
        f"**You'll learn:** {l['topics']}.",
        "",
        f"▶ **Practise this lesson in the [sandbox]({SITE_URL}#{l['id']})**: run every example and check your exercise answers.",
        "",
        "## Key terms",
        "",
        *[f"- {t}" for t in l["_terms"]],
        "",
        gh_fences(l["_md"]).replace("\n### ", "\n## ").replace("](figures/", "](../figures/"),
        "",
        "## Common mistakes",
        "",
        *[f"- {m}" for m in l["_mistakes"]],
        "",
        "## Exercises",
        "",
    ]
    for k, ex in enumerate(l["exercises"], start=1):
        lines += [f"### {k}. {ex['title']}", "", gh_fences(ex["_prompt"]), ""]
        if any(ln.strip() and not ln.strip().startswith("#") for ln in ex["starter"].splitlines()):
            lines += ["Starter code:", "", f"```python\n{ex['starter']}\n```", ""]
        if ex["stdin"]:
            typed = ", ".join(f"`{v}`" for v in ex["stdin"].splitlines())
            lines += [f"*The checker types: {typed}*", ""]
    lines += [f"**In the sandbox:** exercise{'s' if len(l['exercises']) > 1 else ''} {ex_range(l)}. Press **Check** to test your answer.", ""]
    hints = [(k, ex) for k, ex in enumerate(l["exercises"], start=1) if ex["_hint"]]
    if hints:
        lines += ["<details>", "<summary>Hints</summary>", ""]
        lines += [f"{k}. {ex['_hint']}" for k, ex in hints]
        lines += ["", "</details>", ""]
    lines += ["<details>", "<summary>Answers</summary>", ""]
    for k, ex in enumerate(l["exercises"], start=1):
        lines += [f"**{k}. {ex['title']}**", "", f"```python\n{ex['solution']}\n```", ""]
    lines += ["</details>", ""]
    if l["quiz"]:
        lines += ["## Quick quiz", ""]
        for k, q in enumerate(l["quiz"], start=1):
            lines += [f"{k}. {q['_q']}"]
            lines += [f"   - {'ABCD'[o]}) {opt}" for o, opt in enumerate(q["_options"])]
            lines += [""]
        lines += ["<details>", "<summary>Quiz answers</summary>", ""]
        for k, q in enumerate(l["quiz"], start=1):
            lines += [f"{k}. **{'ABCD'[q['answer']]}) {q['_options'][q['answer']]}**: {q['_explain']}"]
        lines += ["", "</details>", ""]
    prev = lessons[i - 1] if i > 0 else None
    nxt = lessons[i + 1] if i + 1 < len(lessons) else None
    nav = []
    nav.append(f"Previous: [Lesson {prev['n']}]({Path(prev['file']).name})" if prev else "Back to the [course home](../README.md)")
    nav.append(f"Next: [Lesson {nxt['n']}: {nxt['title']}]({Path(nxt['file']).name})" if nxt else "Back to the [course home](../README.md)")
    lines += ["---", " · ".join(nav), ""]
    text = "\n".join(lines)
    return re.sub(r"\n{3,}", "\n\n", text)


def glossary_markdown(lessons):
    entries = {}
    for l in lessons:
        for t in l["_terms"]:
            m = re.match(r"\*\*(.+?):\*\*\s*(.+)", t)
            if not m:
                raise ValueError(f"Bad key term in {l['id']}: {t}")
            term, meaning = m.group(1), m.group(2)
            key = term.lower()
            if key in entries:
                if l["n"] not in entries[key]["lessons"]:
                    entries[key]["lessons"].append(l["n"])
            else:
                meaning = meaning[0].upper() + meaning[1:] if meaning[0].isalpha() else meaning
                entries[key] = {"term": term, "meaning": meaning, "lessons": [l["n"]]}
    def sort_key(e):
        return re.sub(r"[^a-z0-9]", "", e["term"].lower().replace("__", "")) or e["term"]
    rows = [
        f"| **{e['term'].replace('|', chr(92) + '|')}** | {e['meaning'].replace('|', chr(92) + '|')} [{', '.join(map(str, e['lessons']))}] |"
        for e in sorted(entries.values(), key=sort_key)
    ]
    return "\n".join([
        "# Python glossary",
        "",
        "Every term used in the course, A to Z. The number in brackets is the lesson where it's introduced.",
        "",
        "| Term | Meaning |",
        "|---|---|",
        *rows,
        "",
    ])


def readme_markdown(data):
    parts, lessons = data["parts"], data["lessons"]
    n_ex = sum(len(l["exercises"]) for l in lessons)
    n_run = sum(len(l["examples"]) for l in lessons)
    n_q = sum(len(l["quiz"]) for l in lessons)
    out = [
        "# Learn Python from scratch",
        "",
        f"A complete, hands-on Python course for beginners: {len(lessons)} lessons from your first `print()` to generators, decorators and a final project, with a practice sandbox that runs your code in the browser and checks your answers.",
        "",
        f"## ▶ [Open the practice sandbox]({SITE_URL})",
        "",
        "The sandbox runs Python in your browser. Nothing to install, no sign-up.",
        "",
        f"- every lesson, with **{n_run} examples** you can run and change",
        f"- **{n_ex} exercises**, numbered by lesson, that check your code with tests and tell you what's off",
        f"- **{n_q} quiz questions**, with explanations",
        "- a compiler view that shows your code as **tokens**, an **AST** and the **compiled JavaScript**",
        "- a free [playground](" + SITE_URL + "playground.html) for experimenting",
        "- your progress and code saved in your own browser",
        "",
        "## Course materials",
        "",
        "| | |",
        "|---|---|",
        f"| 📘 [Lessons](#lessons) | {len(lessons)} lessons, each with key terms, examples, common mistakes, exercises, answers and a quiz |",
        "| 📖 [Glossary](glossary.md) | every Python term used in the course, defined in plain English |",
        "| 🧾 [Syntax cheat sheet](cheatsheet.md) | the whole language on one page, with lesson numbers |",
        "",
        "## How to use this course",
        "",
        "1. Read a lesson, here on GitHub or in the sandbox. Start with its **Key terms**.",
        "2. Run the examples in the sandbox and change them to see what happens.",
        "3. Do the lesson's exercises in the sandbox and press **Check**.",
        "4. Only then open the **Answers** section at the bottom of the lesson.",
        "",
        "Each lesson has a **Common mistakes** section. Read it: these are the errors beginners hit most often, and you'll recognise them when they happen to you.",
        "",
        "## Lessons",
        "",
    ]
    for p in parts:
        out += [f"### Part {p['id']}: {p['title']} ({p['level']})", "", "| # | Lesson | Topics | Sandbox |", "|---|---|---|---|"]
        for l in lessons:
            if l["part"] == p["id"]:
                out.append(f"| {l['n']} | [{l['title']}]({l['file']}) | {l['topics'].replace('|', chr(92) + '|')} | {ex_range(l)} |")
        out.append("")
    out += [
        "## Which Python is this?",
        "",
        "The sandbox uses [Brython](https://brython.info), which compiles Python 3 to JavaScript so it can run in your browser. The lessons teach standard Python, and everything in them also works on your own computer with Python from [python.org](https://www.python.org/). A few things differ in the sandbox:",
        "",
        "- Only the standard library is available. Packages installed with `pip` (NumPy, pandas, requests) need Python on your computer; the [last lesson](" + lessons[-1]["file"] + ") shows how to set it up.",
        "- Code runs on the page, so an infinite loop freezes the tab. Reload it; your progress is kept.",
        "- Deep recursion hits the limit sooner than in regular Python.",
        "- `input()` reads from the **Input** box under the editor, one line per call.",
        "",
        "## Five habits that prevent most bugs",
        "",
        "1. Read a traceback from the **bottom** up: the last line says what went wrong, the lines above say where.",
        "2. `=` stores a value, `==` compares. Conditions always use `==`.",
        "3. `input()` always returns text. Convert with `int()` or `float()` before doing math.",
        "4. Indent with 4 spaces, and end every `if`, `for`, `while`, `def` and `class` line with a colon.",
        "5. Never use `[]` or `{}` as a default argument. Default to `None` and create the list inside the function.",
        "",
        "## Editing the course",
        "",
        "Lessons are generated from the Markdown sources in [`course/`](course/). See [course/README.md](course/README.md) to edit lessons or add new ones.",
        "",
    ]
    return "\n".join(out)


MAINTAINER_README = """# Editing the course

Everything in the repository root (the sandbox, `lessons/`, `glossary.md`, `cheatsheet.md` and `README.md`) is generated from the files in this folder. Edit the sources here, then rebuild.

```bash
pip install markdown
python course/build.py --test
```

`--test` runs every example and every exercise solution with your local Python, and fails if anything is broken.

| File | What it is |
|---|---|
| `content/part1.md` … `part7.md` | lesson text, examples, exercises and quizzes |
| `content/extras.md` | each lesson's topics, key terms and common mistakes |
| `content/cheatsheet.md` | the syntax cheat sheet |
| `page.html`, `app.js` | the sandbox page and its logic |
| `playground.html` | the standalone playground |
| `figures.py` | draws the lesson diagrams in `figures/` (run it after changing a diagram) |
| `build.py` | builds everything and tests the lesson code |

## Lesson format

````text
@@@ lesson
id: my-lesson
title: My lesson
minutes: 10
summary: One sentence shown under the title.
---
Normal **Markdown** text. Use ### for section headings.

```python
print("A runnable example")
```

```python stdin=Ada|36 error
# stdin= fills the Input box (| separates lines); error marks an example meant to fail
```

:::exercise Exercise title
What the learner should do.
```python starter
# code the learner starts with
```
```python check
assert something, "message shown when the check fails"
# __output__ holds what the learner's code printed; __source__ holds their code
```
```python solution
# a correct answer
```
hint: A nudge in the right direction.
:::

:::quiz
? Question text?
- wrong answer
+ right answer
= Explanation shown after answering.
:::
````

Each lesson also needs an entry in `content/extras.md`:

```text
@@ my-lesson
topics: short list of topics for the README table
terms:
- **Term:** definition
mistakes:
- A common mistake and how to avoid it.
```
"""


# ---------------------------------------------------------------- assemble

def wrap(fragment, lang="en"):
    """Turn a page fragment into a full HTML document (for GitHub Pages)."""
    i = fragment.index("</style>") + len("</style>")
    head, body = fragment[:i], fragment[i:]
    return (
        f'<!doctype html>\n<html lang="{lang}">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + head.strip() + "\n</head>\n<body>\n" + body.strip() + "\n</body>\n</html>\n"
    )


def assemble(data):
    page = (ROOT / "page.html").read_text().replace("{{REPO_BLOB}}", REPO_BLOB)
    if REPO_MODE:  # the published site has a home page listing every course
        page = page.replace('<a href="playground.html">Playground</a>', '<a href="../">All courses</a>\n      <a href="playground.html">Playground</a>', 1)
    play = (ROOT / "playground.html").read_text()
    play = play.replace(
        '<div class="controls">',
        '<div class="controls">\n    <a class="btn" href="index.html" style="text-decoration:none;color:var(--ink)">← Course</a>', 1)
    play = play.replace("body {\n  background: var(--bg);", "body {\n  margin: 0;\n  background: var(--bg);", 1)
    lessons_js = "window.COURSE = " + json.dumps(public(data), ensure_ascii=False) + ";\n"

    targets = [(SITE, True)] + ([] if REPO_MODE else [(ROOT / "artifact", False)])
    for out, full in targets:
        out.mkdir(exist_ok=True)
        (out / "index.html").write_text(wrap(page) if full else page)
        (out / "playground.html").write_text(wrap(play))
        (out / "lessons.js").write_text(lessons_js)
        if (ROOT / "app.js").resolve() != (out / "app.js").resolve():
            shutil.copy(ROOT / "app.js", out / "app.js")
        if FIGURES.exists() and FIGURES.resolve() != (out / "figures").resolve():
            if (out / "figures").exists():
                shutil.rmtree(out / "figures")
            shutil.copytree(FIGURES, out / "figures")

    lessons_dir = SITE / "lessons"
    if lessons_dir.exists():
        shutil.rmtree(lessons_dir)
    lessons_dir.mkdir()
    for l in data["lessons"]:
        (SITE / l["file"]).write_text(lesson_markdown(l, data["lessons"]))
    (SITE / "glossary.md").write_text(glossary_markdown(data["lessons"]))
    shutil.copy(CONTENT / "cheatsheet.md", SITE / "cheatsheet.md")
    (SITE / "README.md").write_text(readme_markdown(data))
    if not REPO_MODE:
        (SITE / ".nojekyll").write_text("")
    if REPO_MODE:
        (ROOT / "README.md").write_text(MAINTAINER_README)


# ---------------------------------------------------------------- CPython tests

def run_code(src, stdin=""):
    out = io.StringIO()
    ns = {"__name__": "__main__"}
    old_stdin = sys.stdin
    sys.stdin = io.StringIO(stdin)
    err = None
    try:
        with contextlib.redirect_stdout(out):
            exec(compile(src, "main.py", "exec"), ns)
    except BaseException as e:  # noqa: BLE001
        err = e
    finally:
        sys.stdin = old_stdin
    return ns, out.getvalue(), err


def check(src, check_src, stdin=""):
    ns, out, err = run_code(src, stdin)
    if err:
        return False, f"code raised {type(err).__name__}: {err}"
    ns["__output__"] = out
    ns["__source__"] = src
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            exec(check_src, ns)
    except AssertionError as e:
        return False, f"assert: {e}"
    except BaseException as e:  # noqa: BLE001
        return False, f"check raised {type(e).__name__}: {e}"
    return True, ""


def test(data):
    problems = 0
    for l in data["lessons"]:
        for i, ex in enumerate(l["examples"]):
            _, out, err = run_code(ex["code"], ex["stdin"])
            if bool(err) != ex["error"]:
                problems += 1
                print(f"[{l['id']}] example {i}: expected_error={ex['error']} got {type(err).__name__ if err else None}: {err}")
        for ex in l["exercises"]:
            ok, msg = check(ex["solution"], ex["check"], ex["stdin"])
            if not ok:
                problems += 1
                print(f"[{l['id']}] exercise {ex['title']!r}: SOLUTION FAILS: {msg}")
            ok, msg = check(ex["starter"], ex["check"], ex["stdin"])
            if ok:
                problems += 1
                print(f"[{l['id']}] exercise {ex['title']!r}: starter already passes")
    n_ex = sum(len(l["examples"]) for l in data["lessons"])
    n_x = sum(len(l["exercises"]) for l in data["lessons"])
    n_q = sum(len(l["quiz"]) for l in data["lessons"])
    print(f"{len(data['lessons'])} lessons, {n_ex} examples, {n_x} exercises, {n_q} quiz questions; {problems} problems")
    return problems


if __name__ == "__main__":
    data = build()
    assemble(data)
    if "--test" in sys.argv:
        sys.exit(1 if test(data) else 0)
