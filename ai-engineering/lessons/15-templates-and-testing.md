# Lesson 15: Prompt templates and testing

**You'll learn:** prompts as code, version control and review, naming and logging prompt versions, why format and f-strings break on braces, string.Template, Mustache-style placeholders, Jinja templates, single-pass substitution and template injection, keeping stable text cacheable, prompt test sets, pass rates, comparing prompt versions, re-testing after model changes, prompt generators.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#templates-and-testing)**: run every example and check your exercise answers.

## Key terms

- **Prompt template:** fixed prompt text with placeholders filled at run time.
- **Placeholder:** a marker in a template, such as `{{review}}`, replaced with a value.
- **Template injection:** user input that contains template syntax and gets expanded when it shouldn't.
- **Test set:** a fixed collection of realistic inputs with checks for each.
- **Pass rate:** the fraction of test cases a prompt version passes.
- **Regression:** something that used to work and broke after a change.

In an application a prompt is a **template**: fixed text with slots for the user's input, retrieved documents and settings. It deserves the same care as any other code: version control, review, and tests.

## Prompts are code

- **Keep prompts in files or named constants**, not scattered through your code as string fragments. A reviewer should be able to read the whole prompt in one place.
- **Version them** with your code (Git). When behaviour changes, `git diff` shows exactly which words changed.
- **Give versions names** (`support_reply_v3`) and log which version produced each response, so you can trace a bad answer back to the prompt that made it.
- **Change one thing at a time** and re-test, as with any experiment.

## Filling templates safely

The obvious tools have a trap: prompts often contain braces (JSON examples, code), and Python's f-strings and `str.format` treat every `{…}` as a placeholder:

```python
template = 'Reply as JSON like {"label": "positive"}. Review: {review}'
try:
    print(template.format(review="Great shop!"))
except (KeyError, ValueError) as e:
    print("format failed:", repr(e))
```

Options that avoid this:

| Approach | Placeholder | Notes |
|---|---|---|
| `str.replace` | any marker you choose | simplest; fine for one or two slots |
| `string.Template` (standard library) | `$review` or `${review}` | ignores braces; `$$` for a literal dollar |
| Mustache-style (the first exercise) | `{{review}}` | double braces rarely clash with prompt text |
| Jinja2 (`pip install jinja2`) | `{{ review }}`, plus `{% for %}` and `{% if %}` | loops and conditions for complex prompts |

```python
from string import Template

template = Template('Reply as JSON like {"label": "positive"}. Review: $review')
print(template.substitute(review="Great shop!"))
```

Two more rules for safe templates:

- **Fill each slot once, without re-expanding.** If a user's review contains `{{system_prompt}}`, it must stay as literal text, not get filled in. Substituting values in one pass (rather than repeatedly) prevents this kind of **template injection**.
- **Keep stable text first and variable slots last**, so the fixed part can be cached (Lesson 11).

## Testing prompts

You can't prove a prompt correct, but you can **measure** it. A small test set goes a long way:

1. Collect **20–50 realistic inputs**, including the awkward ones: very short, very long, off-topic, another language, missing information, and attempts to misuse it.
2. For each, write down what a good output must contain or satisfy: a label, required phrases, a length limit, valid JSON (the checks from Lessons 9 and 12).
3. **Run every prompt version over the whole set** and compare pass rates. Read the failures, too: they show *why* a version is worse.
4. Keep the set and re-run it whenever you change the prompt **or the model**. A prompt tuned for one model can behave differently on the next.

```python
def fake_model(prompt):
    """A stand-in that only labels well when the prompt shows a 'mixed' example."""
    review = prompt.rsplit("Review:", 1)[1].lower()
    if "but" in review or "though" in review:
        return "mixed" if "mixed" in prompt else "positive"
    return "negative" if any(w in review for w in ("lost", "slow", "rude")) else "positive"

cases = [("Fast and friendly!", "positive"), ("They lost my wheel.", "negative"),
         ("Great repair, but slow.", "mixed"), ("Nice staff, though pricey.", "mixed")]
v1 = "Label the review positive or negative. Review: {review}"
v2 = "Label the review positive, negative or mixed (e.g. good work but slow = mixed). Review: {review}"

for name, template in [("v1", v1), ("v2", v2)]:
    results = [fake_model(template.replace("{review}", text)) == expected for text, expected in cases]
    print(f"{name}: {sum(results)}/{len(results)} passed")
```

Many providers can also draft or improve a prompt for you (Anthropic publishes a "metaprompt" recipe, for example). Treat the result as a first draft to put through your tests, not a finished prompt. Part 6 builds this into a full evaluation process, including using a model to grade outputs that simple checks can't.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Render a template | one regex pass with a callback; KeyError on missing | O(n) | O(n) |
| Score a prompt | run every case, catch errors, record failures | O(cases) calls | O(cases) |
| Compare versions | same test set, compare pass rates, read failures | O(versions × cases) | O(cases) |

## Common mistakes

- Scattering prompt fragments through the code where no one can review the whole prompt.
- Using `str.format` on prompts that contain JSON.
- Expanding placeholders that arrived inside user input.
- Judging a prompt change on one or two examples.
- Switching models without re-running the prompt tests.

## Exercises

### 1. Fill a template safely

Write `render(template, values)` that fills **Mustache-style** placeholders: `{{name}}`, optionally with spaces inside the braces (`{{ name }}`). A name starts with a letter or underscore, followed by letters, digits or underscores.

- Replace each placeholder with `str(values[name])`.
- If a name isn't in `values`, raise `KeyError(name)`.
- Leave single braces and everything else untouched.
- Substitute in **one pass**: text that comes from a value is never expanded again.

Starter code:

```python
import re

def render(template, values):
    pass

template = 'Reply as JSON like {"label": "positive"}.\nReview: {{ review }}'
print(render(template, {"review": "Great shop!"}))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** match only well-formed `{{ name }}` slots; fail loudly on a missing value; never re-expand.
2. **Examples:** a value of `"{{secret}}"` is inserted literally, not replaced by the secret.
3. **Brute force:** a loop of `template.replace("{{" + k + "}}", v)` per value: misses the spaced form, and a later replacement can expand text inserted by an earlier one.
4. **Pattern:** **single-pass regex substitution with a callback**.
5. **Plan:** compile the pattern → `fill` callback with the missing-key check → `sub`.
6. **Code and test:** JSON braces, repeats, extra values, injection, invalid names, missing values.

</details>

<details>
<summary>💡 Hint 1</summary>

A regex can describe a placeholder: two opening braces, optional spaces, a name, optional spaces, two closing braces. Braces must be escaped: `\{\{` and `\}\}`.

</details>

<details>
<summary>💡 Hint 2</summary>

`re.sub` accepts a **function** as the replacement: it's called with each match, and whatever it returns is inserted. Raise `KeyError(name)` inside it for a missing value.

</details>

<details>
<summary>💡 Hint 3</summary>

`re.compile(r"\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}")`, then `pattern.sub(fill, template)`.

</details>

### 2. Score a prompt on a test set

Write `run_tests(model, make_prompt, cases)`. `make_prompt(text)` builds a prompt from an input; `model(prompt)` returns a reply; `cases` is a list of `(text, expected)` pairs. A case **passes** if `expected` appears in the reply, ignoring case. If `model` raises an exception for a case, that case fails (don't crash). Return a dict: `{"passed": number passed, "total": number of cases, "failed": [indexes of failed cases]}`.

Starter code:

```python
def run_tests(model, make_prompt, cases):
    pass

model = lambda prompt: "mixed" if "but" in prompt else "positive"
make_prompt = lambda text: f"Label this review: {text}"
cases = [("Great!", "positive"), ("Good but slow", "Mixed"), ("Awful", "negative")]
print(run_tests(model, make_prompt, cases))
# {'passed': 2, 'total': 3, 'failed': [2]}
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** run every case, never crash, report counts and which cases failed.
2. **Examples:** "Awful" → "positive" doesn't contain "negative" → index 2 fails.
3. **Brute force:** this is already one pass.
4. **Pattern:** **test harness**: loop, isolate failures, summarise.
5. **Plan:** enumerate → try (prompt → reply → check) → record failures → build the dict.
6. **Code and test:** no cases, case-insensitivity, an exception mid-run.

</details>

<details>
<summary>💡 Hint 1</summary>

Loop with `enumerate(cases)` so you know each case's index; unpack each pair as `text, expected`.

</details>

<details>
<summary>💡 Hint 2</summary>

Wrap the model call in `try` / `except Exception`, treating an exception as a failure.

</details>

<details>
<summary>💡 Hint 3</summary>

Collect the failed indexes; `passed` is `len(cases) - len(failed)`.

</details>

**In the sandbox:** exercises 28–29. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Fill a template safely</summary>

```python
import re

PLACEHOLDER = re.compile(r"\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}")

def render(template, values):
    def fill(match):
        name = match.group(1)
        if name not in values:
            raise KeyError(name)
        return str(values[name])
    return PLACEHOLDER.sub(fill, template)        # one pass: inserted text isn't scanned again

template = 'Reply as JSON like {"label": "positive"}.\nReview: {{ review }}'
print(render(template, {"review": "Great shop!"}))
```

**Line by line**

- `\s*` on each side allows `{{ review }}` as well as `{{review}}`.
- The name pattern rejects `2x`, so `{{ 2x }}` is left as plain text rather than raising an error.
- `re.sub` scans the **template** once; text returned by `fill` is never re-scanned, which blocks template injection.
- `str(...)` lets numbers and other values be inserted.

**Trace** on the injection case: the only placeholder in the template is `{{review}}`; it's replaced with the text `{{secret}}`, and since the scan has already passed that point, the secret isn't inserted.

**Complexity:** O(template length + inserted text).

**Common wrong approach:** calling `str.format` on prompts containing JSON, or replacing values one after another in a loop (which can expand placeholders that arrived inside user input).

</details>

<details>
<summary>✅ 2. Score a prompt on a test set</summary>

```python
def run_tests(model, make_prompt, cases):
    failed = []
    for index, (text, expected) in enumerate(cases):
        try:
            reply = model(make_prompt(text))
            ok = expected.lower() in reply.lower()
        except Exception:                     # a crash counts as a failure, not the end of the run
            ok = False
        if not ok:
            failed.append(index)
    return {"passed": len(cases) - len(failed), "total": len(cases), "failed": failed}

model = lambda prompt: "mixed" if "but" in prompt else "positive"
make_prompt = lambda text: f"Label this review: {text}"
cases = [("Great!", "positive"), ("Good but slow", "Mixed"), ("Awful", "negative")]
print(run_tests(model, make_prompt, cases))
```

**Line by line**

- `enumerate` gives the indexes needed for the `failed` list, so you can look up exactly which inputs failed.
- Building the prompt **inside** the `try` also catches bugs in `make_prompt`.
- `except Exception` keeps one timeout or bad reply from hiding the results of every other case.
- `passed` is derived from the failures, so the two numbers can't disagree.

**Trace** on the example: "Great!" → "positive" ✓; "Good but slow" → "mixed" contains "mixed" ✓; "Awful" → "positive" ✗ → failed [2].

**Complexity:** O(cases) model calls.

**Common wrong approach:** letting the first exception stop the run, or reporting only a pass rate without the failing cases, which hides what to fix. (Substring checks are crude; Part 6 covers stricter checks and model-based grading.)

</details>

## Quick quiz

1. Why does template.format(...) often fail on prompts?
   - A) Prompts contain braces, such as JSON examples, which format treats as placeholders
   - B) format only works on numbers
   - C) format adds extra spaces

2. A user's input contains {{system_prompt}}. What should a safe template engine do?
   - A) Insert it as literal text, without expanding it
   - B) Raise an error and stop the app
   - C) Replace it with the system prompt

3. You switch to a newer model. What should you do with your prompts?
   - A) Double every instruction
   - B) Nothing: prompts always transfer
   - C) Re-run the test set; a prompt tuned for one model may behave differently on another

4. What makes a good prompt test set?
   - A) Random strings
   - B) Only the three examples from the prompt
   - C) Realistic inputs including edge cases, with clear checks for each

<details>
<summary>Quiz answers</summary>

1. **A) Prompts contain braces, such as JSON examples, which format treats as placeholders**: Use a different placeholder style, string.Template or Jinja.
2. **A) Insert it as literal text, without expanding it**: Single-pass substitution prevents template injection.
3. **C) Re-run the test set; a prompt tuned for one model may behave differently on another**: Tests catch regressions after any change.
4. **C) Realistic inputs including edge cases, with clear checks for each**: Cover the awkward cases your users will produce.

</details>

---
Previous: [Lesson 14](14-reasoning-and-chaining.md) · Next: [Lesson 16: Prompt injection and safety](16-prompt-injection.md)
