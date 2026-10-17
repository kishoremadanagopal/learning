"""Build the PyTorch course (prepares for the PyTorch Certified Associate exam) from the Markdown sources in content/.

Writes:
  index.html, app.js, worker.js, runner.py, lessons.js   the practice sandbox (GitHub Pages)
  torch/                                                  the sandbox's PyTorch (pure Python on NumPy)
  data/, figures/                                         the practice datasets and the lesson charts
  lessons/NN-slug.md                                      lesson pages readable on GitHub
  glossary.md, cheatsheet.md, README.md                   course materials

Usage:
  python build.py                     # rebuild everything
  python build.py --test              # also run every example and exercise (hidden tests, speed checks)
  python build.py --test-only part2   # test one content file without assembling (for authors)
  python build.py --show lesson-id    # print what every example in a lesson outputs

Requires: pip install markdown numpy matplotlib  (tests import the sandbox's torch from course/torch, never a real PyTorch)
"""
import contextlib
import html
import io
import json
import re
import os
import shutil
import signal
import sys
import tempfile
import time
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content"
REPO_MODE = ROOT.name == "course"                  # inside the published repository
SITE = ROOT.parent if REPO_MODE else ROOT / "site"
SITE_URL = "https://kishoremadanagopal.github.io/learning/pytorch/"
REPO_BLOB = "https://github.com/kishoremadanagopal/learning/blob/main/pytorch/"
REPO_TREE = "https://github.com/kishoremadanagopal/learning/tree/main/pytorch/"
TORCH = ROOT / "torch"
DATA = ROOT / "data"
FIGURES = ROOT / "figures"
sys.path.insert(0, str(ROOT))
import runner  # noqa: E402

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
    """Render lesson Markdown for the sandbox. Python fences become runnable examples (unless runnable=False)."""
    examples = []

    def repl(m):
        lang, info, code = m.group(1), m.group(2), m.group(3)
        opts = parse_info(info)
        if lang == "python" and runnable:
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


SECTION_RE = re.compile(r"^(approach|walkthrough):[ \t]*$", re.M)


def parse_exercise(title, body):
    """An exercise: prompt, fenced starter / check / solution / slow code, then optional
    `hint:` lines (a ladder, shown one at a time), an `approach:` section and a `walkthrough:` section."""
    ex = {"title": title.strip(), "starter": "", "check": "", "solution": "", "slow": "", "stdin": "",
          "hints": [], "_hints": [], "approach": "", "_approach": "", "walkthrough": "", "_walkthrough": ""}

    def grab(m):
        lang, info, code = m.group(1), m.group(2).strip(), m.group(3)
        if lang == "python" and info in ("starter", "check", "solution", "stdin", "slow"):
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
                raise ValueError(f"[{l['id']}] glance rows need 4 cells (concept | code | gives you | remember): {g}")
            rows.append(cells)
        if not rows:
            raise ValueError(f"[{l['id']}] needs a glance: table (concept | code | gives you | remember)")
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
        "## At a glance",
        "",
        "| Concept | Code | Gives you | Remember |",
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
            lines += ["Starter code:", "", f"```python\n{ex['starter']}\n```", ""]
        if ex["_approach"]:
            lines += ["<details>", "<summary>🧭 How to approach it</summary>", "", gh_fences(ex["_approach"]), "", "</details>", ""]
        for h, hint in enumerate(ex["_hints"], start=1):
            lines += ["<details>", f"<summary>💡 Hint {h}</summary>", "", hint, "", "</details>", ""]
    lines += [f"**In the sandbox:** exercise{'s' if len(l['exercises']) > 1 else ''} {ex_range(l)}. Press **Check** to run the hidden tests.", ""]
    lines += ["### Answers and walkthroughs", "", "Open these only after a real attempt. Each one explains the solution step by step.", ""]
    for k, ex in enumerate(l["exercises"], start=1):
        lines += ["<details>", f"<summary>✅ {k}. {ex['title']}</summary>", "", f"```python\n{ex['solution']}\n```", ""]
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
    """Every concept in the course, generated from the lessons' At-a-glance tables."""
    out = ["## Every concept at a glance", "",
           "Generated from the **At a glance** table at the end of each lesson. The number in brackets links to the lesson.", "",
           "| Concept | Code | Gives you | Remember | Lesson |", "|---|---|---|---|---|"]
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
        "# PyTorch glossary",
        "",
        "Every term used in the course, A to Z. The number in brackets is the lesson where it's introduced.",
        "",
        "| Term | Meaning |",
        "|---|---|",
        *rows,
        "",
    ])


def dataset_info():
    """The practice files for the sandbox's Data tab (Part 3 onwards)."""
    import csv
    notes = {
        "fruit.csv": "90 (made-up) fruit: weight in grams, diameter in cm, sweetness 0–10, colour, and the fruit (apple, orange or lemon).",
        "fruit_raw.csv": "The first 40 fruit as a messy export: a missing value or two, an impossible weight, a mistyped label, a value in the wrong unit and duplicate rows.",
    }
    out = []
    for name, about in notes.items():
        path = DATA / name
        with open(path, newline="") as f:
            rows = list(csv.reader(f))
        out.append({"name": name, "rows": len(rows) - 1, "columns": rows[0], "about": about, "bytes": path.stat().st_size})
    return out


def torch_files():
    """The sandbox's PyTorch package, as paths relative to the site (the browser worker writes them into Pyodide)."""
    return sorted(str(p.relative_to(ROOT)) for d in (TORCH, ROOT / "torchvision") for p in d.rglob("*.py")
                  if "__pycache__" not in p.parts)


def readme_markdown(data, datasets):
    parts, lessons = data["parts"], data["lessons"]
    n_ex = sum(len(l["exercises"]) for l in lessons)
    n_run = sum(len(l["examples"]) for l in lessons)
    n_q = sum(len(l["quiz"]) for l in lessons)
    out = [
        "# PyTorch: from tensors to the PyTorch Certified Associate exam",
        "",
        f"A beginner-first PyTorch course that follows the official exam outline of the **PyTorch Certified Associate (PTCA)**, launched by the PyTorch Foundation and the Linux Foundation in June 2026: {len(lessons)} lessons so far on tensors, devices, autograd, data loading, building and training models, and making them fast.",
        "",
        "PyTorch is the framework most AI research and production models are written in. Knowing it well is core for the **AI engineer** path, and a big plus for **data / AI analysts** who move into machine learning.",
        "",
        f"## ▶ [Open the practice sandbox]({SITE_URL})",
        "",
        "The sandbox runs Python 3.14 in your browser (via [Pyodide](https://pyodide.org)) with the course's own copy of PyTorch: a teaching version written in Python on NumPy that follows PyTorch 2.14's names, printing, rules, random numbers and error messages for everything the course uses. It even has a pretend NVIDIA GPU, so you can practise `.to('cuda')`. Nothing to install and no sign-up. Run the same code with real PyTorch on your own computer (`pip install torch`) and it behaves the same way, just faster.",
        "",
        f"- every lesson, with **{n_run} examples** you can run and change",
        f"- **{n_ex} exercises** with hidden tests, each with an approach, hints and a walkthrough",
        f"- **{n_q} exam-style quiz questions**, with explanations",
        "- diagrams for the key ideas",
        "- practice data files (from Part 3) that reset before every run",
        "- your progress and code saved in your own browser",
        "",
        "**Before you start:** you should be comfortable with Python basics (lists, loops, functions, classes). If not, do [Learn Python from scratch](../python/) first. Some NumPy helps: [Python for Data](../python-data/) covers it, but each lesson explains what it uses.",
        "",
        "## About the PTCA exam",
        "",
        "| | |",
        "|---|---|",
        "| Format | online, proctored, multiple choice, 120 minutes |",
        "| Price | US$250 for the exam (US$299 with the official training pathway); one free retake |",
        "| Valid | 2 years; no prerequisites |",
        "| Domains | PyTorch fundamentals 38% · performance and optimization 26% · model development 20% · data handling 16% |",
        "",
        "Check the latest details on the [Linux Foundation's PTCA page](https://training.linuxfoundation.org/certification/pytorch-certified-associate-ptca/) before you book: prices and outlines can change.",
        "",
        "## Course materials",
        "",
        "| | |",
        "|---|---|",
        f"| 📘 [Lessons](#lessons) | {len(lessons)} lessons, each with key terms, examples, common mistakes, exercises, walkthroughs and an exam-style quiz |",
        "| 📖 [Glossary](glossary.md) | every PyTorch term used in the course, defined in plain English |",
        "| 🧾 [Cheat sheet](cheatsheet.md) | the API you need for the exam on a few pages, and every concept at a glance |",
        "",
        "## How to use this course",
        "",
        "1. Read a lesson, here on GitHub or in the sandbox. Start with its **Key terms**.",
        "2. Run the examples in the sandbox and change them: predict the output (shape, dtype, device) before you press Run.",
        "3. Try each exercise before opening help; press **Check** to run the hidden tests.",
        "4. Stuck? Open **How to approach it**, then the hints one at a time, and the **walkthrough** only after a real attempt.",
        "5. Do the quiz at the end of each lesson: its questions are written like the exam's.",
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
        "Install PyTorch with the command from [pytorch.org/get-started](https://pytorch.org/get-started/locally/) (for most computers: `pip install torch`). Every example runs unchanged; the outputs match, except where a lesson says a real GPU or a different random-number kernel changes them.",
        "",
        "## Editing the course",
        "",
        "Lessons are generated from the Markdown sources in [`course/`](course/). See [course/README.md](course/README.md).",
        "",
    ]
    return "\n".join(out)


MAINTAINER_README = """# Editing the course

Everything in the folder above (the sandbox, `lessons/`, `data/`, `glossary.md`, `cheatsheet.md` and `README.md`) is generated from the files here. Edit the sources, then rebuild.

```bash
pip install markdown numpy matplotlib
python course/build.py --test
```

The lessons run on `torch/`, the sandbox's PyTorch: a pure-Python package on NumPy that copies PyTorch 2.14's API, printing, type promotion, random numbers (CPU Mersenne Twister) and error messages. `build.py` puts `course/` first on `sys.path`, so tests always use it, even when a real PyTorch is installed.

`--test` runs every example and exercise with the same `runner.py` the browser sandbox uses, and fails if a solution doesn't pass its hidden tests, a starter already passes, a deliberately slow solution isn't rejected as too slow, an exercise has no hint or walkthrough, or an example's error flag is wrong. `--show <lesson-id>` prints each example's output so you can check the lesson text matches it.

| File | What it is |
|---|---|
| `content/part1.md` … | lesson text, examples, exercises and quizzes |
| `content/extras*.md` | each lesson's topics, key terms and common mistakes |
| `content/cheatsheet.md` | the cheat sheet |
| `figures.py` | draws the lesson charts in `figures/` |
| `runner.py` | runs code and checks, in the browser (Pyodide) and in tests |
| `torch/` | the sandbox's PyTorch (copied to the site and loaded by the worker) |
| `page.html`, `app.js`, `worker.js` | the sandbox page, its logic, and the Web Worker that runs Python |
| `build.py` | builds everything and tests the lesson code |

## Exercise checks

Check code runs after the learner's code, in the same namespace, with these helpers:

| Helper | Use |
|---|---|
| `need("name", pd.DataFrame)` | the learner's variable, or a friendly "create a variable called…" failure |
| `same(actual, expected, "what")` | compares numbers, arrays and tensors (shape, device, values; dtype too with `ignore_dtype=False`) |
| `printed("text")` | the learner printed this text |
| `uses("groupby(")` | the learner's code contains this (comments ignored) |
| `chart()` | the Axes of the chart they drew |
| `test("fn", [(args, expected, "label"), ...], valid=, key=)` | hidden test cases; reports the first failing input |
| `speed("fn", make_args, reference, sizes=, what=, tip=)` | times the function against a reference on growing inputs; fails as "too slow" |
| `__output__`, `__source__` | everything printed, and the learner's code |
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
    tfiles = torch_files()
    lessons_js = ("window.COURSE = " + json.dumps(public(data), ensure_ascii=False) + ";\n"
                  "window.DATASETS = " + json.dumps(datasets, ensure_ascii=False) + ";\n"
                  "window.TORCH_FILES = " + json.dumps(tfiles) + ";\n")
    # GitHub Pages caches files for 10 minutes: version every script URL so a new build is picked up at once.
    import hashlib
    h = hashlib.sha1(lessons_js.encode())
    for f in ("app.js", "worker.js", "runner.py", *tfiles):
        h.update((ROOT / f).read_bytes())
    version = h.hexdigest()[:10]
    lessons_js += f'window.BUILD = "{version}";\n'
    page = page.replace('src="lessons.js"', f'src="lessons.js?v={version}"').replace('src="app.js"', f'src="app.js?v={version}"')
    SITE.mkdir(exist_ok=True)
    (SITE / "index.html").write_text(wrap(page))
    (SITE / "lessons.js").write_text(lessons_js)
    for f in ("app.js", "worker.js", "runner.py"):
        if (ROOT / f).resolve() != (SITE / f).resolve():
            shutil.copy(ROOT / f, SITE / f)
    if DATA.exists() and DATA.resolve() != (SITE / "data").resolve():
        if (SITE / "data").exists():
            shutil.rmtree(SITE / "data")
        shutil.copytree(DATA, SITE / "data")

    if TORCH.resolve() != (SITE / "torch").resolve():
        for d in ("torch", "torchvision"):
            if (SITE / d).exists():
                shutil.rmtree(SITE / d)
        for f in tfiles:
            (SITE / f).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(ROOT / f, SITE / f)

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

def _in_data_dir():
    tmp = tempfile.mkdtemp(prefix="pydata-")
    os.chdir(tmp)
    runner.setup({p.name: p.read_bytes() for p in DATA.iterdir() if p.is_file()} if DATA.exists() else {})
    return tmp


def _text(parts, kind=None):
    return "".join(t for k, t in parts if kind is None or k == kind)


def show(data, lesson_id):
    _in_data_dir()
    for l in data["lessons"]:
        if l["id"] != lesson_id:
            continue
        for i, ex in enumerate(l["examples"]):
            res = runner.run(ex["code"], ex["stdin"], encode_figures=False)
            print(f"===== example {i} ({'error expected' if ex['error'] else 'ok expected'}) =====")
            print(ex["code"])
            print("----- output -----")
            print(_text(res["parts"]).rstrip())
            if res["figures"]:
                print(f"[{len(res['figures'])} chart(s) drawn]")
        return
    print(f"No lesson with id {lesson_id!r}")


class _Timeout(BaseException):
    """Raised by the test timer; a BaseException so the runner's `except Exception` can't swallow it."""


def _guarded(fn, *args, limit=20, **kw):
    """Run one example or check with a time limit, so a hang is reported instead of stalling the whole test run."""
    def on_alarm(signum, frame):
        raise _Timeout()
    old = signal.signal(signal.SIGALRM, on_alarm)
    signal.setitimer(signal.ITIMER_REAL, limit)
    try:
        return fn(*args, **kw)
    except _Timeout:
        msg = (f"TIMED OUT after {limit} s: something hangs (often a slow solution that passes a middle speed size, "
               "or a hidden test too big for a slow solution)")
        return {"ok": False, "parts": [["err", msg]], "figures": [], "verdict": {"ok": False, "msg": msg}}
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, old)


def test(data):
    _in_data_dir()
    problems = 0
    for l in data["lessons"]:
        for i, ex in enumerate(l["examples"]):
            res = _guarded(runner.run, ex["code"], ex["stdin"], encode_figures=False)
            if res["ok"] == ex["error"]:
                problems += 1
                print(f"[{l['id']}] example {i}: expected {'an error' if ex['error'] else 'no error'}:\n{_text(res['parts'], 'err')[-600:]}")
            out = _text(res["parts"], "out")
            if len(out) > 6000:
                problems += 1
                print(f"[{l['id']}] example {i}: prints {len(out)} characters; keep examples' output short")
        for ex in l["exercises"]:
            t_sol = time.perf_counter()
            res = _guarded(runner.check, ex["solution"], ex["check"], ex["stdin"], encode_figures=False)
            t_sol = time.perf_counter() - t_sol
            if t_sol > 3:
                problems += 1
                print(f"[{l['id']}] exercise {ex['title']!r}: checking the model solution takes {t_sol:.1f} s; keep checks under a few seconds")
            if not res["verdict"]["ok"]:
                problems += 1
                print(f"[{l['id']}] exercise {ex['title']!r}: SOLUTION FAILS: {res['verdict']['msg']}\n{_text(res['parts'], 'err')[-600:]}")
            res = _guarded(runner.check, ex["starter"], ex["check"], ex["stdin"], encode_figures=False)
            if res["verdict"]["ok"]:
                problems += 1
                print(f"[{l['id']}] exercise {ex['title']!r}: starter already passes")
            if ex["slow"]:
                t_slow = time.perf_counter()
                res = _guarded(runner.check, ex["slow"], ex["check"], ex["stdin"], encode_figures=False)
                t_slow = time.perf_counter() - t_slow
                if t_slow > 4:
                    problems += 1
                    print(f"[{l['id']}] exercise {ex['title']!r}: the slow solution takes {t_slow:.1f} s to be rejected; learners would wait even longer in the browser (shrink the speed sizes or the hidden tests)")
                if res["verdict"]["ok"] or not any(w in res["verdict"]["msg"] for w in ("too slow", "RecursionError")):
                    problems += 1
                    print(f"[{l['id']}] exercise {ex['title']!r}: the slow solution wasn't rejected as too slow: {res['verdict']['msg'][:200]}")
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
