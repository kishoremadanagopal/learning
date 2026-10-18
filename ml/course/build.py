"""Build the Machine Learning with scikit-learn course from the Markdown sources in content/.

Writes:
  index.html, app.js, worker.js, runner.py, lessons.js   the practice sandbox (GitHub Pages)
  data/, figures/                                         the practice datasets and the lesson charts
  lessons/NN-slug.md                                      lesson pages readable on GitHub
  glossary.md, cheatsheet.md, README.md                   course materials

Usage:
  python build.py                     # rebuild everything
  python build.py --test              # also run every example and exercise with numpy/pandas/matplotlib
  python build.py --test-only part2   # test one content file without assembling (for authors)
  python build.py --show lesson-id    # print what every example in a lesson outputs

Requires: pip install markdown numpy pandas==3.0.2 matplotlib scipy scikit-learn==1.8.0  (the versions the browser sandbox runs)
"""
import contextlib
import html
import io
import json
import random
import re
import os
import shutil
import sys
import tempfile
import zlib
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content"
REPO_MODE = ROOT.name == "course"                  # inside the published repository
SITE = ROOT.parent if REPO_MODE else ROOT / "site"
SITE_URL = "https://kishoremadanagopal.github.io/learning/ml/"
REPO_BLOB = "https://github.com/kishoremadanagopal/learning/blob/main/ml/"
REPO_TREE = "https://github.com/kishoremadanagopal/learning/tree/main/ml/"
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


def build(only=None):
    parts, lessons = [], []
    for f in sorted(CONTENT.glob("part*.md")):
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
    for f in sorted(CONTENT.glob("extras*.md")):
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
        "# Machine learning glossary",
        "",
        "Every term used in the course, A to Z. The number in brackets is the lesson where it's introduced.",
        "",
        "| Term | Meaning |",
        "|---|---|",
        *rows,
        "",
    ])


def dataset_info():
    """Describe each practice file for the sandbox's Data tab and the README."""
    import pandas as pd
    notes = {
        "students.csv": "60 students: class, hours studied, attendance and exam scores. Small and simple, for your first models.",
        "housing.csv": "160 homes: neighborhood, area, bedrooms, age, distance to the centre and price (in thousands). For predicting numbers.",
        "fruit.csv": "150 apples, oranges and lemons measured by width, height and weight. For seeing how classifiers draw boundaries.",
        "churn.csv": "1,000 phone and internet customers: contract, plan, tenure, monthly charge, support calls, age (a few missing), data use and whether they left.",
        "shoppers.csv": "200 shop customers: income, spending score, age and visits per month, with no labels. For clustering.",
        "messages.csv": "400 short text messages labelled spam or ham (not spam). For text classification.",
        "energy.csv": "40 days of outdoor temperature and an office building's energy use. Small and curved, for seeing overfitting.",
    }
    out = []
    for name in notes:
        path = DATA / name
        df = pd.read_json(path) if name.endswith(".json") else pd.read_csv(path)
        out.append({"name": name, "rows": len(df), "columns": list(map(str, df.columns)), "about": notes[name],
                    "bytes": path.stat().st_size})
    return out


def readme_markdown(data, datasets):
    parts, lessons = data["parts"], data["lessons"]
    n_ex = sum(len(l["exercises"]) for l in lessons)
    n_run = sum(len(l["examples"]) for l in lessons)
    n_q = sum(len(l["quiz"]) for l in lessons)
    out = [
        "# Machine Learning with scikit-learn",
        "",
        f"A hands-on machine-learning course for complete beginners: {len(lessons)} lessons that take you from \"what is a model?\" to regression, classification, decision trees, random forests, gradient boosting, pipelines, cross-validation, tuning, clustering, text classification and an end-to-end project. Every idea comes with a picture and code you can run, in a sandbox that runs real Python, pandas and scikit-learn in your browser and checks your answers.",
        "",
        "Machine learning is part of the shared core for both the **AI engineer** and the **data / AI analyst** paths: AI engineers build on these ideas every day (training, evaluation, overfitting, data leakage), and analysts use them to predict, segment and explain.",
        "",
        f"## ▶ [Open the practice sandbox]({SITE_URL})",
        "",
        "The sandbox runs real Python 3.14 with NumPy, pandas, scikit-learn 1.8 and matplotlib inside your browser (via [Pyodide](https://pyodide.org)). Nothing to install, no sign-up.",
        "",
        f"- every lesson, with **{n_run} examples** you can run and change",
        f"- **{n_ex} exercises**, numbered by lesson, that check your code and tell you what's off",
        f"- **{n_q} quiz questions**, with explanations",
        f"- **{len(datasets)} practice datasets** that load with one line, like `pd.read_csv(\"churn.csv\")`",
        "- a chart or diagram for every key idea, and charts drawn right under your code",
        "- your progress and code saved in your own browser",
        "",
        "**Before you start:** you should be comfortable with Python basics and pandas (loading a CSV, selecting columns, `groupby`), and it helps to know averages, spread and correlation. If not, do [Learn Python from scratch](../python/), [Python for Data](../python-data/) and [Statistics with Python](../statistics/) first. No calculus or linear algebra is needed: every idea is explained in words and pictures, then checked with code.",
        "",
        "## Course materials",
        "",
        "| | |",
        "|---|---|",
        f"| 📘 [Lessons](#lessons) | {len(lessons)} lessons, each with key terms, examples, common mistakes, exercises, answers and a quiz |",
        "| 📖 [Glossary](glossary.md) | every machine-learning term used in the course, defined in plain English |",
        "| 🧾 [Cheat sheet](cheatsheet.md) | every scikit-learn step, model and metric on one page, plus a \"which model?\" and \"which metric?\" table |",
        f"| 🗂️ [Datasets]({REPO_TREE}data) | the practice files, to download and use on your own computer |",
        "",
        "## How to use this course",
        "",
        "1. Read a lesson, here on GitHub or in the sandbox. Start with its **Key terms**.",
        "2. Run the examples in the sandbox and change them to see what happens.",
        "3. Do the lesson's exercises in the sandbox and press **Check**.",
        "4. Only then open the **Answers** section at the bottom of the lesson.",
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
        "## The practice datasets",
        "",
        "| File | Rows | What's in it |",
        "|---|---|---|",
        *[f"| [`{d['name']}`](data/{d['name']}) | {d['rows']} | {d['about']} |" for d in datasets],
        "",
        "All of the data is made up for practice, so it's safe to share and experiment with.",
        "",
        "## Running it on your own computer",
        "",
        "Everything in the course also works in a normal Python setup. Install Python from [python.org](https://www.python.org/), then:",
        "",
        "```bash",
        "pip install numpy pandas matplotlib scipy scikit-learn jupyterlab",
        "jupyter lab",
        "```",
        "",
        "Download the files from [`data/`](data/) into the same folder as your notebook. The sandbox runs pandas 3, so if your computer has an older pandas, upgrade with `pip install --upgrade pandas`.",
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
pip install markdown numpy==2.4.6 pandas==3.0.2 matplotlib scipy scikit-learn==1.8.0
python course/build.py --test
```

`--test` runs every example and exercise with the same `runner.py` the browser sandbox uses, and fails if a solution doesn't pass, a starter already passes, or an example's error flag is wrong. `--show <lesson-id>` prints each example's output so you can check the lesson text matches it.

| File | What it is |
|---|---|
| `content/part1.md` … | lesson text, examples, exercises and quizzes |
| `content/extras*.md` | each lesson's topics, key terms and common mistakes |
| `content/cheatsheet.md` | the cheat sheet |
| `datasets.py` | generates the extra practice data in `data/` (deterministic) |
| `figures.py` | draws the lesson charts in `figures/` |
| `runner.py` | runs code and checks, in the browser (Pyodide) and in tests |
| `page.html`, `app.js`, `worker.js` | the sandbox page, its logic, and the Web Worker that runs Python |
| `build.py` | builds everything and tests the lesson code |

## Exercise checks

Check code runs after the learner's code, in the same namespace, with these helpers:

| Helper | Use |
|---|---|
| `need("name", pd.DataFrame)` | the learner's variable, or a friendly "create a variable called…" failure |
| `same(actual, expected, "what")` | compares numbers, arrays, Series and DataFrames (`ignore_index=`, `ignore_order=`) |
| `printed("text")` | the learner printed this text |
| `uses("groupby(")` | the learner's code contains this (comments ignored) |
| `chart()` | the Axes of the chart they drew |
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
    lessons_js = ("window.COURSE = " + json.dumps(public(data), ensure_ascii=False) + ";\n"
                  "window.DATASETS = " + json.dumps(datasets, ensure_ascii=False) + ";\n")
    # GitHub Pages caches files for 10 minutes: version every script URL so a new build is picked up at once.
    import hashlib
    h = hashlib.sha1(lessons_js.encode())
    for f in ("app.js", "worker.js", "runner.py"):
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
    if DATA.resolve() != (SITE / "data").resolve():
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
        shutil.copy(CONTENT / "cheatsheet.md", SITE / "cheatsheet.md")
    (SITE / "README.md").write_text(readme_markdown(data, datasets))
    if not REPO_MODE:
        (SITE / ".nojekyll").write_text("")
    if REPO_MODE:
        (ROOT / "README.md").write_text(MAINTAINER_README)


# ---------------------------------------------------------------- tests (same runner as the browser)

def _in_data_dir():
    tmp = tempfile.mkdtemp(prefix="pydata-")
    os.chdir(tmp)
    runner.setup({p.name: p.read_bytes() for p in DATA.iterdir() if p.is_file()})
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


def test(data):
    _in_data_dir()
    problems = 0
    for l in data["lessons"]:
        for i, ex in enumerate(l["examples"]):
            res = runner.run(ex["code"], ex["stdin"], encode_figures=False)
            if res["ok"] == ex["error"]:
                problems += 1
                print(f"[{l['id']}] example {i}: expected {'an error' if ex['error'] else 'no error'}:\n{_text(res['parts'], 'err')[-600:]}")
            out = _text(res["parts"], "out")
            if len(out) > 6000:
                problems += 1
                print(f"[{l['id']}] example {i}: prints {len(out)} characters; keep examples' output short")
        for ex in l["exercises"]:
            res = runner.check(ex["solution"], ex["check"], ex["stdin"], encode_figures=False)
            if not res["verdict"]["ok"]:
                problems += 1
                print(f"[{l['id']}] exercise {ex['title']!r}: SOLUTION FAILS: {res['verdict']['msg']}\n{_text(res['parts'], 'err')[-600:]}")
            res = runner.check(ex["starter"], ex["check"], ex["stdin"], encode_figures=False)
            if res["verdict"]["ok"]:
                problems += 1
                print(f"[{l['id']}] exercise {ex['title']!r}: starter already passes")
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
