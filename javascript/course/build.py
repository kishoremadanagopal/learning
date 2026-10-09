"""Build the JavaScript, TypeScript and JSON course from the Markdown sources in content/.

Writes:
  index.html, app.js, worker.js, runner.js, lessons.js   the practice sandbox (GitHub Pages)
  data/, figures/                                         the practice datasets and the lesson charts
  lessons/NN-slug.md                                      lesson pages readable on GitHub
  glossary.md, cheatsheet.md, README.md                   course materials

Usage:
  python build.py                     # rebuild everything
  python build.py --test              # also run every example and exercise (hidden tests, speed checks)
  python build.py --test-only part2   # test one content file without assembling (for authors)
  python build.py --show lesson-id    # print what every example in a lesson outputs

Requires: pip install markdown matplotlib, and for the tests Node.js 26 or newer (set NODE_BIN to its path if `node`
is older) and Playwright with Chromium (pip install playwright; playwright install chromium): the same runner.js runs
the JavaScript in Node.js as in the browser, and the same dom.js runs the HTML pages in Chromium as in the sandbox.
"""
import html
import io
import json
import re
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content"
REPO_MODE = ROOT.name == "course"                  # inside the published repository
SITE = ROOT.parent if REPO_MODE else ROOT / "site"
SITE_URL = "https://kishoremadanagopal.github.io/learning/javascript/"
REPO_BLOB = "https://github.com/kishoremadanagopal/learning/blob/main/javascript/"
REPO_TREE = "https://github.com/kishoremadanagopal/learning/tree/main/javascript/"
DATA = ROOT / "data"
FIGURES = ROOT / "figures"
NODE = os.environ.get("NODE_BIN", "node")
RUNNABLE = ("js", "html", "ts")    # fences that become runnable examples (html: a page in the preview; ts: type-checked)
SANDBOX_FILES = ("app.js", "worker.js", "runner.js", "dom.js", "dom-prelude.js", "tsrun.js")
TS_VERSION = "6.0.3"               # the compiler the sandbox loads (worker.js) and the tests use
TS_PACKAGE = Path(os.environ.get("TS_PACKAGE", ROOT / "node_modules" / "typescript"))
STATIC_LANG = {"js-static": "js", "ts-static": "ts", "json": "json", "html-static": "html", "bash": "bash", "css": "css"}

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


def md_to_html(text, runnable=True):
    """Render lesson Markdown for the sandbox. JavaScript fences become runnable examples (unless runnable=False)."""
    examples = []

    def repl(m):
        lang, info, code = m.group(1), m.group(2), m.group(3)
        opts = parse_info(info)
        if lang in RUNNABLE and runnable:
            stdin = opts.get("stdin", "")
            stdin = stdin.replace("|", "\n") if isinstance(stdin, str) else ""
            examples.append({"code": code, "stdin": stdin, "error": bool(opts.get("error")), "lang": lang})
            return f'\n<div class="example" data-ex="{len(examples) - 1}"></div>\n'
        cls = "out" if lang in ("output", "text", "") else "plain"
        data_lang = f' data-lang="{STATIC_LANG[lang]}"' if lang in STATIC_LANG else ""
        return f'\n<pre class="{cls}"{data_lang}>{html.escape(code)}</pre>\n'

    text = FENCE_RE.sub(repl, text)
    out = markdown.markdown(text, extensions=["tables", "sane_lists"])
    out = out.replace("\\|", "|")
    out = out.replace("<table>", '<div class="table-wrap"><table>').replace("</table>", "</table></div>")
    return out, examples


def inline_md(s):
    h = markdown.markdown(s)
    return re.sub(r"^<p>(.*)</p>$", r"\1", h, flags=re.S)


SECTION_RE = re.compile(r"^(approach|walkthrough):[ \t]*$", re.M)


def parse_exercise(title, body):
    """An exercise: prompt, fenced starter / check / solution / slow code, then optional
    `hint:` lines (a ladder, shown one at a time), an `approach:` section and a `walkthrough:` section."""
    ex = {"title": title.strip(), "lang": "js", "starter": "", "check": "", "solution": "", "slow": "", "stdin": "", "typecheck": "",
          "hints": [], "_hints": [], "approach": "", "_approach": "", "walkthrough": "", "_walkthrough": ""}

    def grab(m):
        lang, info, code = m.group(1), m.group(2).strip(), m.group(3)
        if lang in RUNNABLE and info in ("starter", "check", "solution", "stdin", "slow", "typecheck"):
            if info == "typecheck" and lang != "ts":
                raise ValueError(f"Exercise {title!r}: typecheck blocks are TypeScript (```ts typecheck)")
            if info == "check" and lang != "js":
                raise ValueError(f"Exercise {title!r}: checks are JavaScript (```js check)")
            if info in ("starter", "solution"):
                ex["lang"] = lang
            ex[info] = code
            return ""
        return m.group(0)

    # sections first (they may contain their own code fences)
    pieces = SECTION_RE.split(body)
    head, sections = pieces[0], dict(zip(pieces[1::2], pieces[2::2]))
    head = FENCE_RE.sub(grab, head)
    ex["_hints"] = [h.strip() for h in re.findall(r"^hint:\s*(.+)$", head, re.M)]
    head = re.sub(r"^hint:\s*.+$\n?", "", head, flags=re.M)
    ex["hints"] = [markdown.markdown(h) for h in ex["_hints"]]
    for name in ("approach", "walkthrough"):
        if name in sections:
            ex["_" + name] = sections[name].strip()
            ex[name], _ = md_to_html(sections[name].strip(), runnable=False)
    ex["_prompt"] = head.strip()
    ex["prompt"], _ = md_to_html(head.strip())
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
        questions.append(q)
    return questions


def parse_extras(path):
    """content/extras.md: per-lesson topics, key terms and common mistakes."""
    extras = {}
    for chunk in re.split(r"^@@ ", path.read_text(), flags=re.M)[1:]:
        lines = chunk.splitlines()
        lid = lines[0].strip()
        item = {"topics": "", "terms": [], "mistakes": [], "glance": []}
        section = None
        for ln in lines[1:]:
            if ln.startswith("topics:"):
                item["topics"] = ln.split(":", 1)[1].strip()
            elif ln.strip() in ("terms:", "mistakes:", "glance:"):
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


def _file_number(path):
    """Sort part2.md before part10.md (plain name order would put part10 right after part1)."""
    digits = re.sub(r"\D", "", path.stem)
    return int(digits) if digits else 0


def build(only=None):
    parts, lessons = [], []
    for f in sorted(CONTENT.glob("part*.md"), key=_file_number):
        if only and f.stem != only:
            continue
        p, l = parse_file(f)
        parts += p
        lessons += l
    ids = [l["id"] for l in lessons]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        raise ValueError(f"Duplicate lesson ids: {dupes}")

    extras = {}
    for f in sorted(CONTENT.glob("extras*.md"), key=_file_number):
        extras.update(parse_extras(f))
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
        rows = []
        for g in e["glance"]:
            cells = [c.strip() for c in re.split(r"(?<!\\)\|", g)]
            if len(cells) != 4:
                raise ValueError(f"[{l['id']}] glance rows need 4 cells (concept | approach | time | space): {g}")
            rows.append(cells)
        if not rows:
            raise ValueError(f"[{l['id']}] needs a glance: table (concept | approach | time | space)")
        l["_glance"] = rows
        l["glance"] = [[inline_md(c.replace("\\|", "|")) for c in r] for r in rows]
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
        if lang in RUNNABLE:
            note = ""
            if isinstance(opts.get("stdin"), str):
                typed = ", ".join(f"`{v}`" for v in opts["stdin"].split("|"))
                note += f"*Input typed for this example: {typed}*\n\n"
            if opts.get("error"):
                note += "*This example raises an error on purpose.*\n\n"
            return f"{note}```{lang}\n{code}\n```"
        if lang in ("output", "text", ""):
            return f"```text\n{code}\n```"
        if lang in STATIC_LANG:
            return f"```{STATIC_LANG[lang]}\n{code}\n```"
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
        "## At a glance",
        "",
        "| Concept | Approach | Time | Space |",
        "|---|---|---|---|",
        *[f"| {' | '.join(r)} |" for r in l["_glance"]],
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
            lines += ["Starter code:", "", f"```{ex['lang']}\n{ex['starter']}\n```", ""]
        if ex["_approach"]:
            lines += ["<details>", "<summary>🧭 How to approach it</summary>", "", gh_fences(ex["_approach"]), "", "</details>", ""]
        for h, hint in enumerate(ex["_hints"], start=1):
            lines += ["<details>", f"<summary>💡 Hint {h}</summary>", "", hint, "", "</details>", ""]
    lines += [f"**In the sandbox:** exercise{'s' if len(l['exercises']) > 1 else ''} {ex_range(l)}. Press **Check** to run the hidden tests.", ""]
    lines += ["### Answers and walkthroughs", "", "Open these only after a real attempt. Each one explains the solution step by step.", ""]
    for k, ex in enumerate(l["exercises"], start=1):
        lines += ["<details>", f"<summary>✅ {k}. {ex['title']}</summary>", "", f"```{ex['lang']}\n{ex['solution']}\n```", ""]
        if ex["_walkthrough"]:
            lines += [gh_fences(ex["_walkthrough"]), ""]
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


def concept_index(lessons):
    """Every concept in the course with its approach and cost, generated from the lessons' At-a-glance tables."""
    out = ["## Every concept at a glance", "",
           "Generated from the **At a glance** table at the end of each lesson. The number in brackets links to the lesson.", "",
           "| Concept | Approach | Time | Space | Lesson |", "|---|---|---|---|---|"]
    for l in lessons:
        for r in l["_glance"]:
            out.append(f"| {' | '.join(r)} | [{l['n']}]({l['file']}) |")
    return "\n".join(out) + "\n"


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
        "# JavaScript, TypeScript and JSON glossary",
        "",
        "Every term used in the course, A to Z. The number in brackets is the lesson where it's introduced.",
        "",
        "| Term | Meaning |",
        "|---|---|",
        *rows,
        "",
    ])


def dataset_info():
    """This course needs no data files: every exercise works on values defined in the code."""
    return []


def readme_markdown(data, datasets):
    parts, lessons = data["parts"], data["lessons"]
    n_ex = sum(len(l["exercises"]) for l in lessons)
    n_run = sum(len(l["examples"]) for l in lessons)
    n_q = sum(len(l["quiz"]) for l in lessons)
    out = [
        "# JavaScript, TypeScript and JSON",
        "",
        f"A hands-on course that starts from zero: {len(lessons)} lessons on JavaScript (the language of the web), working with data and JSON, asynchronous code, building interactive pages, TypeScript, and Node.js tooling, ending with interview topics and a final project.",
        "",
        "JavaScript runs every web page, and with Node.js it runs servers and tools too. JSON is how almost every API, including every LLM API, sends data. TypeScript adds types on top of JavaScript and is now the default for serious projects. Together they're essential for full-stack and AI engineers, and useful for analysts who build dashboards and automations.",
        "",
        f"## ▶ [Open the practice sandbox]({SITE_URL})",
        "",
        "The sandbox runs your JavaScript right in your browser, in a separate thread, so even an endless loop can be stopped, and shows the pages you build in the browser lessons in a live, sandboxed preview. Nothing to install and no sign-up.",
        "",
        f"- every lesson, with **{n_run} examples** you can run and change",
        f"- **{n_ex} exercises** with hidden tests, each with an approach, hints and a walkthrough",
        f"- **{n_q} quiz questions**, with explanations",
        "- your progress and code saved in your own browser",
        "",
        "**Before you start:** nothing. Programming experience helps but isn't needed. If you already know Python, you'll move quickly: the lessons point out where JavaScript differs.",
        "",
        "## Course materials",
        "",
        "| | |",
        "|---|---|",
        f"| 📘 [Lessons](#lessons) | {len(lessons)} lessons, each with key terms, examples, common mistakes, exercises, walkthroughs and a quiz |",
        "| 📖 [Glossary](glossary.md) | every term used in the course, defined in plain English |",
        "| 🧾 [Cheat sheet](cheatsheet.md) | the syntax and patterns on one page, and every concept at a glance |",
        "",
        "## How to use this course",
        "",
        "1. Read a lesson, here on GitHub or in the sandbox. Start with its **Key terms**.",
        "2. Run the examples in the sandbox and change them to see what happens.",
        "3. Try each exercise before opening help; press **Check** to run the hidden tests.",
        "4. Stuck? Open **How to approach it**, then the hints one at a time, and the **walkthrough** only after a real attempt.",
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
        "## Running it on your own computer",
        "",
        "Every JavaScript example also runs in [Node.js](https://nodejs.org) 26 or newer (`node file.js`) or in your browser's developer console. The page examples in Part 5 are HTML files: save one as `page.html` and open it in your browser (the `shop.example` practice API exists only in the sandbox). A few lessons use the newest JavaScript features; they say so, and which browsers support them.",
        "",
        "## Editing the course",
        "",
        "Lessons are generated from the Markdown sources in [`course/`](course/). See [course/README.md](course/README.md).",
        "",
    ]
    return "\n".join(out)


MAINTAINER_README = """# Editing the course

Everything in the folder above (the sandbox, `lessons/`, `glossary.md`, `cheatsheet.md` and `README.md`) is generated from the files here. Edit the sources, then rebuild.

```bash
pip install markdown matplotlib playwright
playwright install chromium
(cd course && npm install --no-save typescript@6.0.3)     # the compiler the sandbox loads, for the TypeScript lessons
NODE_BIN=/path/to/node26 python course/build.py --test
```

`--test` runs every example and exercise with the same code the browser sandbox uses: JavaScript with `runner.js` (in Node.js 26 or newer, each run in a worker thread with a time limit), and HTML pages with `dom.js` in headless Chromium. It fails if a solution doesn't pass its hidden tests, a starter already passes, an exercise has no hint or walkthrough, or an example's error flag is wrong. `--show <lesson-id>` prints each example's output so you can check the lesson text matches it.

| File | What it is |
|---|---|
| `content/part1.md` … | lesson text, examples, exercises and quizzes |
| `content/extras*.md` | each lesson's topics, key terms and common mistakes |
| `content/cheatsheet.md` | the cheat sheet |
| `figures.py` | draws the lesson diagrams in `figures/` |
| `runner.js` | runs code and checks, in the browser (Web Worker) and in tests (Node.js) |
| `harness.mjs` | the Node.js test harness |
| `page.html`, `app.js`, `worker.js` | the sandbox page, its logic, and the Web Worker that runs the code |
| `dom.js`, `dom-prelude.js` | the page preview: runs ```` ```html ```` examples and exercises in a sandboxed iframe |
| `tsrun.js` | TypeScript: type-checks ```` ```ts ```` code (strict) with TypeScript 6.0.3, then runs it with `runner.js`; the worker downloads the compiler from a CDN on first use, and `build.py` writes `ts-libs.json` (its built-in type declarations) from the local package (`TS_PACKAGE` to use another folder) |
| `build.py` | builds everything and tests the lesson code |

## Exercise checks

Check code runs after the learner's code (as an async function), with these helpers:

| Helper | Use |
|---|---|
| `need("name", "function")` | the learner's variable or function, or a friendly "create a … called" failure |
| `same(actual, expected, "what")` | deep comparison (arrays, objects, Map, Set, Date; floats within a tiny tolerance) |
| `printed("text")` | the learner printed this text |
| `uses("reduce(")` | the learner's code contains this (comments ignored) |
| `test("fn", [[args, expected, "label"], ...], {valid, key, show})` | hidden test cases (async functions are awaited); reports the first failing input |
| `__output__`, `__source__` | everything printed, and the learner's code |

Exercises whose starter and solution are ```` ```html ```` pages run in the page preview; their checks (still ```` ```js check ````) run inside the page after it loads, with these extra helpers:

| Helper | Use |
|---|---|
| `$(css)`, `$$(css)` | `querySelector`, and `querySelectorAll` as an array |
| `pick(css, "what")` | the element, or a "your page needs …" failure |
| `text(cssOrElement)` | its text with whitespace collapsed and trimmed (`null` if missing) |
| `await click(target)`, `await type(target, value)`, `await submit(form)` | act like a user (`type` fires `input` and `change`; `submit` uses `requestSubmit`, so validation runs) |
| `await waitFor(() => condition, "what", ms)` | wait for async updates (fetch, debounce) |
| `await settle(ms)` | wait a little |

`need("name")` finds functions and top-level `const`/`let` of normal (non-module) scripts.

TypeScript exercises (```` ```ts starter ```` and ```` ```ts solution ````) are type-checked first: type errors fail the check. An optional ```` ```ts typecheck ```` block is appended to the learner's code and must compile too; a line after `// @ts-expect-error reason` must be a type error, which is how exercises test the learner's types. The ```` ```js check ```` then runs against the compiled JavaScript (`__source__` is the TypeScript).
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
    datasets = dataset_info()
    page = (ROOT / "page.html").read_text().replace("{{REPO_BLOB}}", REPO_BLOB).replace("{{REPO_TREE}}", REPO_TREE)
    page = page.replace("{{HOME}}", "../" if REPO_MODE else "#home")
    lessons_js = ("window.COURSE = " + json.dumps(public(data), ensure_ascii=False) + ";\n"
                  "window.DATASETS = " + json.dumps(datasets, ensure_ascii=False) + ";\n")
    # GitHub Pages caches files for 10 minutes: version every script URL so a new build is picked up at once.
    import hashlib
    h = hashlib.sha1(lessons_js.encode())
    for f in SANDBOX_FILES:
        h.update((ROOT / f).read_bytes())
    version = h.hexdigest()[:10]
    lessons_js += f'window.BUILD = "{version}";\n'
    if any(l["lang"] == "ts" for les in data["lessons"] for l in les["examples"] + les["exercises"]):
        (SITE / "ts-libs.json").parent.mkdir(exist_ok=True)
        (SITE / "ts-libs.json").write_text(json.dumps(ts_libs(), separators=(",", ":")))
    for f in ("lessons.js", "app.js", "dom.js"):
        page = page.replace(f'src="{f}"', f'src="{f}?v={version}"')
    SITE.mkdir(exist_ok=True)
    (SITE / "index.html").write_text(wrap(page))
    (SITE / "lessons.js").write_text(lessons_js)
    for f in SANDBOX_FILES:
        if (ROOT / f).resolve() != (SITE / f).resolve():
            shutil.copy(ROOT / f, SITE / f)
    if DATA.exists() and DATA.resolve() != (SITE / "data").resolve():
        if (SITE / "data").exists():
            shutil.rmtree(SITE / "data")
        shutil.copytree(DATA, SITE / "data")

    if FIGURES.exists() and FIGURES.resolve() != (SITE / "figures").resolve():
        if (SITE / "figures").exists():
            shutil.rmtree(SITE / "figures")
        shutil.copytree(FIGURES, SITE / "figures")

    lessons_dir = SITE / "lessons"
    if lessons_dir.exists():
        shutil.rmtree(lessons_dir)
    lessons_dir.mkdir()
    for l in data["lessons"]:
        (SITE / l["file"]).write_text(lesson_markdown(l, data["lessons"]))
    (SITE / "glossary.md").write_text(glossary_markdown(data["lessons"]))
    if (CONTENT / "cheatsheet.md").exists():
        (SITE / "cheatsheet.md").write_text((CONTENT / "cheatsheet.md").read_text().rstrip() + "\n\n" + concept_index(data["lessons"]))
    (SITE / "README.md").write_text(readme_markdown(data, datasets))
    if not REPO_MODE:
        (SITE / ".nojekyll").write_text("")
    if REPO_MODE:
        (ROOT / "README.md").write_text(MAINTAINER_README)


# ---------------------------------------------------------------- tests (same runner as the browser)

def run_jobs(jobs):
    """Run jobs ({type: run|check, code, check, stdin, lang}) and return their results in order: JavaScript with
    runner.js in Node.js, HTML pages with dom.js in headless Chromium (the same files the sandbox uses)."""
    html_at = [i for i, j in enumerate(jobs) if j.get("lang") == "html"]
    if html_at:
        results = run_js_jobs([j for j in jobs if j.get("lang") != "html"])
        page_results = run_page_jobs([jobs[i] for i in html_at])
        merged, js_iter, page_iter = [], iter(results), iter(page_results)
        for j in jobs:
            merged.append(next(page_iter) if j.get("lang") == "html" else next(js_iter))
        return merged
    return run_js_jobs(jobs)


def run_page_jobs(jobs):
    """Run HTML-page jobs in headless Chromium with Playwright (pip install playwright; playwright install chromium)."""
    import time
    from playwright.sync_api import sync_playwright
    out = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content("<!doctype html><html><body><div id='host' style='width:800px;height:600px'></div></body></html>")
        page.add_script_tag(content=(ROOT / "dom.js").read_text())
        page.evaluate("([r, p]) => DomSandbox.setSources(r, p)", [(ROOT / "runner.js").read_text(), (ROOT / "dom-prelude.js").read_text()])
        for job in jobs:
            t0 = time.perf_counter()
            res = page.evaluate("""async (job) => {
                const s = DomSandbox.open(document.getElementById("host"), job.code);
                try { return job.type === "check" ? await s.check(job.check) : await s.result(300); } finally { s.dispose(); }
            }""", job)
            res["ms"] = (time.perf_counter() - t0) * 1000
            out.append(res)
        browser.close()
    return out


def ts_libs():
    """The TypeScript compiler's built-in declarations the sandbox needs (ES2025+ and the Web Worker globals),
    from the local typescript package (npm install typescript@TS_VERSION, or set TS_PACKAGE to its folder)."""
    pkg = json.loads((TS_PACKAGE / "package.json").read_text())
    if pkg["version"] != TS_VERSION:
        raise RuntimeError(f"{TS_PACKAGE} is TypeScript {pkg['version']}; the sandbox uses {TS_VERSION}")
    if f'TS_VERSION = "{TS_VERSION}"' not in (ROOT / "worker.js").read_text():
        raise RuntimeError(f"worker.js must load TypeScript {TS_VERSION}")
    libs = {}
    def walk(name):
        f = f"lib.{name}.d.ts"
        if f in libs:
            return
        text = (TS_PACKAGE / "lib" / f).read_text()
        libs[f] = text
        for ref in re.findall(r'/// <reference lib="([^"]+)" />', text):
            walk(ref)
    walk("esnext")
    walk("webworker")
    return libs


def run_js_jobs(jobs):
    if not jobs:
        return []
    with tempfile.TemporaryDirectory(prefix="jscourse-") as tmp:
        jf, rf = Path(tmp) / "jobs.json", Path(tmp) / "results.json"
        jf.write_text(json.dumps(jobs))
        args = [NODE, str(ROOT / "harness.mjs"), str(jf), str(rf)]
        if any(j.get("lang") == "ts" for j in jobs):
            lf = Path(tmp) / "ts-libs.json"
            lf.write_text(json.dumps(ts_libs()))
            args += [str(TS_PACKAGE / "lib" / "typescript.js"), str(lf)]
        proc = subprocess.run(args, capture_output=True, text=True)
        if proc.returncode != 0 or not rf.exists():
            raise RuntimeError(f"The Node.js harness failed (is NODE_BIN Node.js 26 or newer?):\n{proc.stderr[-2000:]}")
        return json.loads(rf.read_text())


def _text(parts, kind=None):
    return "".join(t for k, t in parts if kind is None or k == kind)


def show(data, lesson_id):
    for l in data["lessons"]:
        if l["id"] != lesson_id:
            continue
        results = run_jobs([{"type": "run", "code": ex["code"], "stdin": ex["stdin"], "lang": ex["lang"]} for ex in l["examples"]])
        for i, (ex, res) in enumerate(zip(l["examples"], results)):
            print(f"===== example {i} ({'error expected' if ex['error'] else 'ok expected'}) =====")
            print(ex["code"])
            print("----- output -----")
            print(_text(res["parts"]).rstrip())
        return
    print(f"No lesson with id {lesson_id!r}")


def test(data):
    jobs, where = [], []
    for l in data["lessons"]:
        for i, ex in enumerate(l["examples"]):
            jobs.append({"type": "run", "code": ex["code"], "stdin": ex["stdin"], "lang": ex["lang"]})
            where.append(("example", l, i, ex))
        for ex in l["exercises"]:
            jobs.append({"type": "check", "code": ex["solution"], "check": ex["check"], "stdin": ex["stdin"], "lang": ex["lang"], "typecheck": ex["typecheck"]})
            where.append(("solution", l, None, ex))
            jobs.append({"type": "check", "code": ex["starter"], "check": ex["check"], "stdin": ex["stdin"], "lang": ex["lang"], "typecheck": ex["typecheck"]})
            where.append(("starter", l, None, ex))
    results = run_jobs(jobs)
    problems = 0
    for (kind, l, i, ex), res in zip(where, results):
        if kind == "example":
            if res["ok"] == ex["error"]:
                problems += 1
                print(f"[{l['id']}] example {i}: expected {'an error' if ex['error'] else 'no error'}:\n{_text(res['parts'])[-600:]}")
            out = _text(res["parts"], "out")
            if len(out) > 6000:
                problems += 1
                print(f"[{l['id']}] example {i}: prints {len(out)} characters; keep examples' output short")
        elif kind == "solution":
            if not res.get("verdict", {}).get("ok"):
                problems += 1
                msg = res.get("verdict", {}).get("msg", "")
                print(f"[{l['id']}] exercise {ex['title']!r}: SOLUTION FAILS: {msg}\n{_text(res['parts'], 'err')[-600:]}")
            if res.get("ms", 0) > 3000:
                problems += 1
                print(f"[{l['id']}] exercise {ex['title']!r}: checking the model solution takes {res['ms'] / 1000:.1f} s; keep checks under a few seconds")
        elif res.get("verdict", {}).get("ok"):
            problems += 1
            print(f"[{l['id']}] exercise {ex['title']!r}: starter already passes")
    for l in data["lessons"]:
        for ex in l["exercises"]:
            if not ex["hints"] or not ex["walkthrough"]:
                problems += 1
                print(f"[{l['id']}] exercise {ex['title']!r}: needs at least one hint and a walkthrough")
        for q in l["quiz"]:
            if len(q["options"]) not in (3, 4):
                problems += 1
                print(f"[{l['id']}] quiz question has {len(q['options'])} options: {q['_q']}")
    n_ex = sum(len(l["examples"]) for l in data["lessons"])
    n_x = sum(len(l["exercises"]) for l in data["lessons"])
    n_q = sum(len(l["quiz"]) for l in data["lessons"])
    print(f"{len(data['lessons'])} lessons, {n_ex} examples, {n_x} exercises, {n_q} quiz questions; {problems} problems")
    return problems


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--test-only" in args:
        only = args[args.index("--test-only") + 1]
        sys.exit(1 if test(build(only)) else 0)
    if "--show" in args:
        show(build(), args[args.index("--show") + 1])
        sys.exit(0)
    data = build()
    assemble(data)
    if "--test" in args:
        sys.exit(1 if test(data) else 0)
