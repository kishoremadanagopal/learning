# Editing the course

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

## Mock exams

A lesson with `exam: <minutes>` in its header is a timed mock exam. Its questions go in an `:::exam` block; each starts with `?? <domain> <lesson-id> <kind>`:

| Part | Meaning |
|---|---|
| domain | `fundamentals`, `performance`, `model` or `data` (the exam's four domains) |
| lesson-id | the lesson to review if the question is missed |
| kind | `output`: `--test` runs the question's python code and checks it prints the right option exactly; `error`: the code must raise the error the right option names; `runs`: it must run without an error; `text`: no code to run |

Then the question (Markdown; code fences allowed), four options (`+` marks the right one; write it first, the build shuffles the options) and an `=` explanation. The build also shuffles the question order, the same way on every build.

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
