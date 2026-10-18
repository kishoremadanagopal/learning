"""Build the Java course from the Markdown sources in content/.

Writes:
  index.html, app.js, lessons.js, playground.html   the practice sandbox (GitHub Pages)
  lessons/NN-slug.md                                lesson pages readable on GitHub
  glossary.md, cheatsheet.md, README.md             course materials

Usage:
  python build.py            # rebuild everything
  python build.py --test     # also compile and run every example and exercise with a local JDK 17+

Requires: pip install markdown, and a JDK (javac/java) on the PATH for --test
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
SITE_URL = "https://kishoremadanagopal.github.io/learning/java/"
REPO_BLOB = "https://github.com/kishoremadanagopal/learning/blob/main/java/"

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
        if lang == "java":
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
        if lang == "java" and info in ("starter", "check", "solution", "stdin"):
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
        if "--test-only" in sys.argv:
            for i in missing:
                extras[i] = {"topics": "", "terms": [], "mistakes": []}
        else:
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
        if lang == "java":
            note = ""
            if isinstance(opts.get("stdin"), str):
                typed = ", ".join(f"`{v}`" for v in opts["stdin"].split("|"))
                note += f"*Input typed for this example: {typed}*\n\n"
            if opts.get("error"):
                note += "*This example raises an error on purpose.*\n\n"
            return f"{note}```java\n{code}\n```"
        if lang in ("output", "text", ""):
            return f"```text\n{code}\n```"
        if lang == "java-static":
            return f"```java\n{code}\n```"
        if lang == "bash":
            return f"```bash\n{code}\n```"
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
            lines += ["Starter code:", "", f"```java\n{ex['starter']}\n```", ""]
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
        lines += [f"**{k}. {ex['title']}**", "", f"```java\n{ex['solution']}\n```", ""]
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


CHECK_HEADER = "import static course.T.*;\nimport java.util.*;\nimport java.util.function.*;\n\npublic class Check {\n    public static void run() throws Exception {\n"
CHECK_FOOTER = "\n    }\n}\n"


def wrap_check(body):
    """Exercise checks are written as statements; wrap them into the Check class the runner expects."""
    indented = "\n".join(("        " + ln) if ln.strip() else "" for ln in body.splitlines())
    return CHECK_HEADER + indented + CHECK_FOOTER


def readme_markdown(data):
    parts, lessons = data["parts"], data["lessons"]
    n_ex = sum(len(l["exercises"]) for l in lessons)
    n_run = sum(len(l["examples"]) for l in lessons)
    n_q = sum(len(l["quiz"]) for l in lessons)
    out = [
        "# Learn Java from scratch",
        "",
        f"A complete, hands-on Java course for beginners: {len(lessons)} lessons from your first `System.out.println` to generics, streams, concurrency and a final project, with a practice sandbox that compiles and runs real Java in your browser and checks your answers.",
        "",
        f"## ▶ [Open the practice sandbox]({SITE_URL})",
        "",
        "The sandbox runs the real Java compiler and a Java 17 virtual machine inside your browser. Nothing to install, no sign-up.",
        "",
        f"- every lesson, with **{n_run} examples** you can run and change",
        f"- **{n_ex} exercises**, numbered by lesson, that test your code and tell you what's off",
        f"- **{n_q} quiz questions**, with explanations",
        "- a **Bytecode** tab that shows what the compiler turns your code into",
        f"- **[Java Quest]({SITE_URL}game.html)**, an arcade game for drilling syntax: fill in the missing code before the timer runs out",
        "- your progress and code saved in your own browser",
        "",
        "## Course materials",
        "",
        "| | |",
        "|---|---|",
        f"| 📘 [Lessons](#lessons) | {len(lessons)} lessons, each with key terms, examples, common mistakes, exercises, answers and a quiz |",
        "| 📖 [Glossary](glossary.md) | every Java term used in the course, defined in plain English |",
        "| 🧾 [Syntax cheat sheet](cheatsheet.md) | the whole language on one page, with lesson numbers |",
        f"| 🎮 [Java Quest]({SITE_URL}game.html) | timed fill-in-the-code challenges for every part of the course |",
        "",
        "## How to use this course",
        "",
        "1. Read a lesson, here on GitHub or in the sandbox. Start with its **Key terms**.",
        "2. Run the examples in the sandbox and change them to see what happens.",
        "3. Do the lesson's exercises in the sandbox and press **Check**.",
        "4. Only then open the **Answers** section at the bottom of the lesson.",
        "5. Play the matching **Java Quest** level to make the syntax automatic.",
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
        "## Which Java is this?",
        "",
        "The sandbox compiles your code with the OpenJDK 17 compiler and runs it on [CheerpJ](https://cheerpj.com), a Java 17 virtual machine that runs in the browser. Everything in the lessons is standard Java 17 and works the same with a JDK on your own computer. A few things differ in the sandbox:",
        "",
        "- The first run downloads and starts the compiler, so it takes around 20 seconds. Later runs take a second or two.",
        "- `Scanner(System.in)` reads from the **Input** box under the editor, one line per value.",
        "- An endless loop freezes the page. Reload it; your progress is kept.",
        "- Programs can't open windows (Swing/JavaFX) or connect to the internet.",
        "",
        "## Five habits that prevent most bugs",
        "",
        "1. Compare strings with `.equals()`, never `==`.",
        "2. `7 / 2` is `3`: dividing two ints drops the decimals. Make one side a `double` when you need them.",
        "3. Valid indexes run from `0` to `length - 1`. Loop with `i < length`, not `i <= length`.",
        "4. Read compiler errors from the **first** one down: later errors are often caused by the first.",
        "5. Check for `null` before calling a method on something that might be missing.",
        "",
        "## Credits",
        "",
        "The in-browser Java runtime is [CheerpJ](https://cheerpj.com) by Leaning Technologies, used under its free Community License. The compiler and `javap` are from OpenJDK 17 (GPL v2 with the Classpath Exception).",
        "",
        "## Editing the course",
        "",
        "Lessons are generated from the Markdown sources in [`course/`](course/). See [course/README.md](course/README.md) to edit lessons or add new ones.",
        "",
    ]
    return "\n".join(out)


MAINTAINER_README = """# Editing the Java course

Everything in `java/` (the sandbox, the game data, `lessons/`, `glossary.md`, `cheatsheet.md` and `README.md`) is generated from the files in this folder. Edit the sources here, then rebuild.

```bash
pip install markdown
python course/build.py --test
```

`--test` needs a JDK (17 or newer). It compiles and runs every example, checks every exercise solution against its tests, and confirms every Java Quest answer compiles. It fails if anything is broken.

| File | What it is |
|---|---|
| `content/part1.md` … `part7.md` | lesson text, examples, exercises and quizzes |
| `content/extras.md` | each lesson's topics, key terms and common mistakes |
| `content/cheatsheet.md` | the syntax cheat sheet |
| `content/game.md` | Java Quest challenges |
| `page.html`, `app.js` | the sandbox page and its logic |
| `game.html` | the Java Quest game |
| `runner/` | the Java program that compiles, runs and checks code in the browser |
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

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("A runnable example");
    }
}
```

```java stdin=Ada|36 error
// stdin= fills the Input box (| separates lines); error marks an example meant to fail
```

:::exercise Exercise title
What the learner should do.
```java starter
// code the learner starts with
```
```java check
eq(10, call("twice", 5), "twice(5)");   // statements; see runner/src/course/T.java for helpers
outputIs("expected output");
```
```java solution
// a correct answer
```
hint: A nudge in the right direction.
:::
````
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


JARS = ["runner.jar", "javac17.jar", "javap17.jar"]


def jar_version():
    """A short content hash, so a new runner.jar gets a new URL (GitHub Pages caches files for 10 minutes)."""
    import hashlib
    h = hashlib.sha1()
    for j in JARS:
        h.update((ROOT / "runner" / j).read_bytes())
    return h.hexdigest()[:8]


def assemble(data):
    page = (ROOT / "page.html").read_text().replace("{{REPO_BLOB}}", REPO_BLOB)
    if REPO_MODE:  # the published site has a home page listing every course
        page = page.replace('<a href="game.html">Java Quest</a>', '<a href="../">All courses</a>\n      <a href="game.html">Java Quest</a>', 1)
    version = jar_version()
    lessons_js = "window.COURSE = " + json.dumps(public(data), ensure_ascii=False) + ";\n"
    lessons_js += f"window.JARS = {json.dumps({j: f'jars/{version}/{j}' for j in JARS})};\n"
    game_js = "window.QUEST = " + json.dumps(build_game(data), ensure_ascii=False) + ";\n"

    out = SITE
    out.mkdir(exist_ok=True)
    (out / "index.html").write_text(wrap(page))
    (out / "lessons.js").write_text(lessons_js)
    (out / "quest.js").write_text(game_js)
    for f in ("app.js", "game.html"):
        if (ROOT / f).resolve() != (out / f).resolve():
            shutil.copy(ROOT / f, out / f)
    jars = out / "jars"
    if jars.exists():
        shutil.rmtree(jars)
    (jars / version).mkdir(parents=True)
    for j in JARS:
        shutil.copy(ROOT / "runner" / j, jars / version / j)
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
    if REPO_MODE:
        (ROOT / "README.md").write_text(MAINTAINER_README)


# ---------------------------------------------------------------- Java Quest

def build_game(data):
    """Parse content/game.md into levels of fill-in-the-blank challenges."""
    path = CONTENT / "game.md"
    if not path.exists():
        return {"levels": []}
    levels = []
    for chunk in re.split(r"^@@ level\s*$", path.read_text(), flags=re.M)[1:]:
        head, _, body = chunk.partition("\n---\n")
        meta = dict(ln.split(": ", 1) for ln in head.strip().splitlines() if ": " in ln)
        challenges = []
        for block in re.split(r"^\?\s+", body.strip(), flags=re.M):
            block = block.strip()
            if not block:
                continue
            item = {"prompt": block.splitlines()[0].strip(), "code": "", "answers": [], "hint": "", "wrap": meta.get("wrap", "stmt")}
            m = re.search(r"^```java\n(.*?)\n```", block, re.S | re.M)
            if not m or "___" not in m.group(1):
                raise ValueError(f"Game challenge needs a java block with ___: {item['prompt']}")
            item["code"] = m.group(1)
            for ln in block[m.end():].splitlines():
                ln = ln.strip()
                if ln.startswith("= "):
                    item["answers"] = [a.strip() for a in ln[2:].split(" || ")]
                elif ln.startswith("hint: "):
                    item["hint"] = ln[6:]
                elif ln.startswith("wrap: "):
                    item["wrap"] = ln[6:]
            if not item["answers"]:
                raise ValueError(f"Game challenge without an answer: {item['prompt']}")
            challenges.append(item)
        levels.append({"id": meta["id"], "title": meta["title"], "part": meta.get("part", ""), "lessons": meta.get("lessons", ""), "challenges": challenges})
    return {"levels": levels}


def game_program(item, answer, k):
    """Wrap a filled-in challenge in a class so it can be compiled to prove the answer is valid Java."""
    code = item["code"].replace("___", answer)
    wrap = item["wrap"]
    if wrap == "file":
        if "class Main" in code:
            return code.replace("class Main", f"class Main{k}")
        return f"import java.util.*;\nimport java.util.function.*;\n\n{code}\n\npublic class Main{k} {{\n    public static void main(String[] args) {{ }}\n}}\n"
    if wrap == "member":
        return f"import java.util.*;\nimport java.util.function.*;\nimport java.util.stream.*;\nimport java.util.concurrent.*;\nimport java.util.concurrent.atomic.*;\nimport java.io.*;\nimport java.nio.file.*;\n\npublic class Main{k} {{\n{code}\n    public static void main(String[] args) {{ }}\n}}\n"
    return (f"import java.util.*;\nimport java.util.function.*;\nimport java.util.stream.*;\nimport java.util.concurrent.*;\nimport java.util.concurrent.atomic.*;\nimport java.io.*;\nimport java.nio.file.*;\n\npublic class Main{k} {{\n"
            f"    public static void main(String[] args) throws Exception {{\n{code}\n    }}\n}}\n")


# ---------------------------------------------------------------- tests (local JDK)

def run_batch(jobs):
    """jobs: list of (name, files dict, mode). Returns {name: output}."""
    import subprocess
    import tempfile
    tmp = Path(tempfile.mkdtemp(prefix="javacourse-"))
    lines = []
    for name, files, mode in jobs:
        prefix = tmp / name
        for fname, text in files.items():
            ext = {"Main.java": ".main", "Check.java": ".check", "stdin.txt": ".stdin"}[fname]
            Path(str(prefix) + ext).write_text(text)
        lines.append(f"{prefix}|{mode}")
    (tmp / "jobs.txt").write_text("\n".join(lines))
    env = {**__import__("os").environ, "JAVA_TOOL_OPTIONS": ""}
    subprocess.run(["java", "-Dcourse.release=17", "-Dcourse.nopool=true", "-cp", str(ROOT / "runner" / "runner.jar"), "course.Batch",
                    str(tmp / "jobs.txt"), str(tmp / "results.txt")], check=True, env=env, cwd=str(tmp))
    results = {}
    for chunk in (tmp / "results.txt").read_text().split("@@JOB ")[1:]:
        first, _, rest = chunk.partition("\n")
        results[Path(first).name] = rest
    shutil.rmtree(tmp, ignore_errors=True)
    return results


def test(data, quest=None):
    jobs, expect = [], {}
    for l in data["lessons"]:
        for i, ex in enumerate(l["examples"]):
            name = f"{l['n']:02d}_ex{i}"
            jobs.append((name, {"Main.java": ex["code"], "stdin.txt": ex["stdin"]}, "run"))
            expect[name] = ("example", l, ex)
        for i, ex in enumerate(l["exercises"]):
            for kind in ("solution", "starter"):
                name = f"{l['n']:02d}_x{i}_{kind}"
                jobs.append((name, {"Main.java": ex[kind], "Check.java": ex["check"], "stdin.txt": ex["stdin"]}, "check"))
                expect[name] = (kind, l, ex)
    quest = quest or {"levels": []}
    k = 0
    for lv in quest["levels"]:
        for item in lv["challenges"]:
            for a in item["answers"]:
                k += 1
                name = f"q{k:04d}"
                jobs.append((name, {"Main.java": game_program(item, a, k)}, "run"))
                expect[name] = ("quest", lv, {"prompt": item["prompt"], "answer": a})
    print(f"running {len(jobs)} Java jobs ...")
    results = run_batch(jobs)
    problems = 0
    for name, (kind, l, ex) in expect.items():
        out = results.get(name, "@@MISSING")
        failed = "@@COMPILE_ERROR" in out or "@@RUNTIME_ERROR" in out or "@@TIMEOUT" in out or "@@BATCH_ERROR" in out or out == "@@MISSING"
        label = l.get("id") if isinstance(l, dict) else l
        if kind == "example" and failed != ex["error"]:
            problems += 1
            print(f"[{label}] example {name}: expected_error={ex['error']}\n{out.strip()[:800]}\n")
        elif kind == "solution" and "@@PASS" not in out:
            problems += 1
            print(f"[{label}] exercise {ex['title']!r}: SOLUTION FAILS\n{out.strip()[:800]}\n")
        elif kind == "starter" and "@@PASS" in out:
            problems += 1
            print(f"[{label}] exercise {ex['title']!r}: starter already passes")
        elif kind == "quest" and failed:
            problems += 1
            print(f"[quest {label}] {ex['prompt']!r} answer {ex['answer']!r} doesn't compile/run:\n{out.strip()[:600]}\n")
    n_ex = sum(len(l["examples"]) for l in data["lessons"])
    n_x = sum(len(l["exercises"]) for l in data["lessons"])
    n_q = sum(len(l["quiz"]) for l in data["lessons"])
    n_g = sum(len(lv["challenges"]) for lv in quest["levels"])
    print(f"{len(data['lessons'])} lessons, {n_ex} examples, {n_x} exercises, {n_q} quiz questions, {n_g} quest challenges; {problems} problems")
    return problems


if __name__ == "__main__":
    data = build()
    if "--test-only" in sys.argv:
        for l in data["lessons"]:
            for ex in l["exercises"]:
                ex["check"] = wrap_check(ex["check"])
        sys.exit(1 if test(data, build_game(data)) else 0)
    for l in data["lessons"]:
        for ex in l["exercises"]:
            ex["check"] = wrap_check(ex["check"])
    quest = build_game(data)
    assemble(data)
    if "--test" in sys.argv:
        sys.exit(1 if test(data, quest) else 0)
