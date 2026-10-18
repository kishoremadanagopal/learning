# Lesson 14: Reasoning and prompt chains

**You'll learn:** when reasoning helps, prompting thinking models with goals, self-verification, chain-of-thought prompting with thinking and answer tags, reasoning before answering, prompt chains, sequential chains, parallel map and combine, routing, draft review and refine, gates between steps, voting and self-consistency.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#reasoning-and-chaining)**: run every example and check your exercise answers.

## Key terms

- **Chain-of-thought (CoT):** prompting a model to write out its reasoning before the answer.
- **Self-verification:** asking the model to check its answer against criteria before finishing.
- **Prompt chain:** a pipeline where each model call's output feeds the next prompt.
- **Gate:** a code check between steps of a chain that can stop it.
- **Routing:** classifying an input first, then choosing the prompt or model for it.
- **Self-consistency (voting):** asking several times and taking the most common answer.

Some tasks need **working out**: multi-step maths, planning, comparing options, debugging. A model that writes its reasoning before answering does much better on them. And some tasks are too big for one prompt to do well; splitting them into a **chain** of smaller calls makes each step simpler and the whole pipeline easier to inspect.

## Reasoning with thinking models

Models with built-in thinking (Lesson 10) already reason before answering. For them:

- **Describe the goal and what a good answer looks like**, not a script of steps. Anthropic's guidance is that a general instruction such as "think thoroughly about the edge cases" often produces better reasoning than a hand-written step-by-step plan.
- **Ask for self-verification:** "Before you finish, check your answer against the test cases above." This catches many errors, especially in code and maths.
- **Use effort** to trade depth for speed and cost, rather than prompt tricks.
- Examples that show **problem → method → answer** shape how the model approaches similar problems in its thinking.

## Chain-of-thought without built-in thinking

With a model that isn't thinking (for example Haiku 4.5 with thinking off, or a small open model), you can still ask it to reason in its visible output: **chain-of-thought (CoT)** prompting. Ask for the reasoning and the answer in separate tags, so code can show or store the answer alone:

```text
A customer bought a £640 bike with 15% off, then a £45 lock at full price.
Work out the total.

Think it through step by step inside <thinking> tags, then give only the
final amount inside <answer> tags.
```

```python
import re

reply = """<thinking>
15% of 640 is 96, so the bike costs 640 - 96 = 544.
Adding the lock: 544 + 45 = 589.
</thinking>
<answer>£589</answer>"""

answer = re.search(r"<answer>(.*?)</answer>", reply, re.DOTALL).group(1).strip()
print(answer)
```

The reasoning has to come **before** the answer: a model generates tokens in order, so "answer, then explain" just justifies whatever it said first.

## Prompt chaining

A **prompt chain** feeds each call's output into the next call's prompt:

![A pipeline of three model calls: Draft takes the customer email and writes a reply; Review checks the draft against the policy and lists problems; Refine rewrites the draft using that list. Between steps, a code check (a gate) can stop the chain, and every intermediate output is logged](../figures/prompt-chain.svg)

Why split a task instead of writing one big prompt?

- Each step has **one clear job**, so it's easier to get right.
- You can **inspect, log and test** every intermediate result, and see exactly which step went wrong.
- Steps can use **different models**: a cheap model to extract, a stronger one to write.
- **Code can run between steps**: validate, look something up, or stop early.

Modern models handle a lot of multi-step reasoning internally, so don't chain for its own sake; chain when you need those control points.

```python
def fake_model(prompt):
    """Pretends to be an LLM so the pipeline runs anywhere."""
    if prompt.startswith("Draft"):
        return "Sorry about the late delivery. Here's a full refund."
    if prompt.startswith("Review"):
        return "Problem: policy offers a 20% voucher for late delivery, not a full refund."
    return "Sorry about the late delivery. We've added a 20% voucher to your account."

email = "My order arrived a week late!"
draft = fake_model(f"Draft a reply to this email:\n<email>{email}</email>")
review = fake_model(f"Review this draft against the late-delivery policy. List problems.\n<draft>{draft}</draft>")
final = fake_model(f"Rewrite the draft to fix these problems.\n<draft>{draft}</draft>\n<problems>{review}</problems>")
for step, text in [("draft", draft), ("review", review), ("final", final)]:
    print(f"{step:>6}: {text}")
```

## Common chain shapes

| Shape | How it works | Example |
|---|---|---|
| sequential | A → B → C, each using the last output | extract facts → write summary → translate |
| parallel (map, then combine) | run the same prompt on many pieces at once, then merge the results | summarise each chapter, then summarise the summaries |
| routing | a first call classifies the input; code picks the next prompt or model | refund question → billing prompt; repair question → workshop prompt |
| draft, review, refine | write, critique against criteria, rewrite | the support reply above |
| voting | ask several times and take the most common answer | a tricky classification |

**Voting** (also called **self-consistency**) works because independent attempts make different mistakes; the answer most attempts agree on is more often right. It multiplies the cost, so save it for decisions that matter (the second exercise).

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Prompt chain | output of step k becomes input of step k + 1; optional gate | O(steps) calls | O(steps) |
| Majority vote | extract, normalise, count; ties go to the first seen | O(n) | O(n) |
| Map and combine | same prompt on each piece, then merge | O(pieces) calls | O(pieces) |

## Common mistakes

- Asking for the answer before the reasoning.
- Scripting every reasoning step for a model that already thinks well.
- Chaining calls without logging or checking the intermediate results.
- Filling chain templates with `format`, which breaks on other braces.
- Voting on raw strings without normalising them.

## Exercises

### 1. Run a prompt chain

Write `run_chain(model, steps, text, gate=None)`. `model` is a function from prompt string to reply string. `steps` is a list of prompt templates, each containing the placeholder `{input}`:

- For each step, replace **every** `{input}` with the current text (use `str.replace`, not `format`, since prompts often contain other braces), call `model`, and make its reply the current text for the next step.
- Return the list of every step's output, in order.
- If a step has no `{input}`, raise `ValueError` before calling the model for it.
- If `gate` is given, call `gate(output)` after each step; if it returns `False`, stop and return the outputs so far (including the one that failed).

Starter code:

```python
def run_chain(model, steps, text, gate=None):
    pass

shout = lambda prompt: prompt.upper()
print(run_chain(shout, ["Summarise: {input}", "Translate: {input}"], "late order"))
# ['SUMMARISE: LATE ORDER', 'TRANSLATE: SUMMARISE: LATE ORDER']
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a fold over the steps: each output becomes the next input; all outputs are returned; a gate can stop early.
2. **Examples:** the reversing model: "abx" reversed is "xba"; then "xbac" reversed is "cabx".
3. **Brute force:** hand-written calls for a fixed number of steps: not reusable.
4. **Pattern:** **pipeline / fold** with an optional check between stages.
5. **Plan:** validate step → call → record → gate → next.
6. **Code and test:** no steps, braces in templates, repeated placeholders, a failing gate, a bad template.

</details>

<details>
<summary>💡 Hint 1</summary>

Keep a variable `current`, starting as `text`. Each step builds a prompt from `current` and replaces `current` with the model's reply.

</details>

<details>
<summary>💡 Hint 2</summary>

`template.replace("{input}", current)` replaces every occurrence and leaves other braces alone; `format` would crash on `{"a": 1}`.

</details>

<details>
<summary>💡 Hint 3</summary>

Check for `"{input}"` before calling the model and `raise ValueError(...)`. After appending each output, `break` if `gate is not None and not gate(current)`.

</details>

### 2. Vote across several answers

Write `majority_answer(replies)`. Each reply should contain an `<answer>…</answer>` section; take the **first** one in each reply (contents may span lines) and normalise it: strip whitespace, remove trailing full stops, lower-case. Ignore replies with no answer section. Return the most common normalised answer; if there's a tie, return the one that appeared **first**. Return `None` if no reply has an answer.

Starter code:

```python
import re
from collections import Counter

def majority_answer(replies):
    pass

replies = ["<thinking>…</thinking><answer>Mixed</answer>",
           "<answer>positive.</answer>",
           "<answer> mixed </answer>",
           "I'm not sure."]
print(majority_answer(replies))   # mixed
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** extract → normalise → count → pick the winner, with a defined tie rule.
2. **Examples:** "Mixed", " mixed " → both "mixed" (2 votes) beat "positive" (1).
3. **Brute force:** count each distinct answer with `list.count`: O(n²), fine for a handful of replies.
4. **Pattern:** **majority vote** (self-consistency).
5. **Plan:** loop with `re.search` → normalised list → `Counter.most_common`.
6. **Code and test:** ties, no answers, "yes..." with several dots, two answers in one reply.

</details>

<details>
<summary>💡 Hint 1</summary>

`re.search(r"<answer>(.*?)</answer>", reply, re.DOTALL)` finds the first answer section, or returns `None`.

</details>

<details>
<summary>💡 Hint 2</summary>

Normalise with `.strip().rstrip(".").lower()`, collect the answers in a list, then count them.

</details>

<details>
<summary>💡 Hint 3</summary>

`Counter(answers).most_common(1)[0][0]`: `most_common` lists equal counts in the order they were first seen, which is exactly the tie rule.

</details>

**In the sandbox:** exercises 26–27. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Run a prompt chain</summary>

```python
def run_chain(model, steps, text, gate=None):
    outputs = []
    current = text
    for number, template in enumerate(steps, start=1):
        if "{input}" not in template:
            raise ValueError(f"step {number} has no {{input}} placeholder")
        current = model(template.replace("{input}", current))
        outputs.append(current)
        if gate is not None and not gate(current):
            break                                          # stop the chain at a failed check
    return outputs

shout = lambda prompt: prompt.upper()
print(run_chain(shout, ["Summarise: {input}", "Translate: {input}"], "late order"))
```

**Line by line**

- `enumerate(steps, start=1)` gives human-friendly step numbers for the error message.
- `{{input}}` inside an f-string produces the literal text `{input}`.
- Appending before the gate check means the failing output is kept, so you can log what went wrong.
- `gate is not None` distinguishes "no gate" from a gate function; `not gate(current)` stops the loop.

**Trace** with the boxing model: step 1 → "[Summarise: x]"; step 2 → "[Translate: [Summarise: x]]".

**Complexity:** O(steps) model calls.

**Common wrong approach:** `template.format(input=current)`, which raises an error on any other `{…}` in the prompt, such as a JSON example.

</details>

<details>
<summary>✅ 2. Vote across several answers</summary>

```python
import re
from collections import Counter

def majority_answer(replies):
    answers = []
    for reply in replies:
        match = re.search(r"<answer>(.*?)</answer>", reply, re.DOTALL)
        if match:
            answers.append(match.group(1).strip().rstrip(".").lower())
    if not answers:
        return None
    return Counter(answers).most_common(1)[0][0]   # ties keep first-seen order

replies = ["<thinking>…</thinking><answer>Mixed</answer>",
           "<answer>positive.</answer>",
           "<answer> mixed </answer>",
           "I'm not sure."]
print(majority_answer(replies))
```

**Line by line**

- `re.search` (not `findall`) takes only the first answer section in each reply.
- `rstrip(".")` removes any number of trailing full stops, so "yes..." and "yes" count as the same vote.
- Normalising before counting matters: without it, "Mixed" and " mixed " would split the vote.
- `Counter.most_common` orders equal counts by first appearance, so ties resolve to the earliest answer.

**Trace** on the 2-2 tie: counts b: 2, a: 2; "b" was seen first → "b".

**Complexity:** O(total text length).

**Common wrong approach:** comparing raw strings, so trivial differences in case, spacing or punctuation split the votes. (Normalisation has limits: "£589" and "589 pounds" still differ; for numbers, parse them.)

</details>

## Quick quiz

1. With a thinking model, what kind of reasoning instruction usually works best?
   - A) A general goal, such as "think carefully about edge cases", plus a request to verify the answer
   - B) A rigid 20-step script
   - C) "Answer immediately without thinking"

2. Why must chain-of-thought reasoning come before the answer?
   - A) The API rejects answers before reasoning
   - B) Tags must be alphabetical
   - C) The model generates in order, so reasoning written after the answer can't change it

3. What is the main advantage of a prompt chain over one big prompt?
   - A) It's always cheaper
   - B) It removes the need for evaluation
   - C) Each step is simpler and its output can be logged, checked and tested

4. When is voting across several answers worth its cost?
   - A) For important decisions where independent attempts may make different mistakes
   - B) For every chat message
   - C) When you want the cheapest possible answer

<details>
<summary>Quiz answers</summary>

1. **A) A general goal, such as "think carefully about edge cases", plus a request to verify the answer**: Describe the goal and how to check it; let the model plan.
2. **C) The model generates in order, so reasoning written after the answer can't change it**: Otherwise the "reasoning" just justifies the first guess.
3. **C) Each step is simpler and its output can be logged, checked and tested**: Chains add control points; they also add calls.
4. **A) For important decisions where independent attempts may make different mistakes**: It multiplies cost by the number of attempts.

</details>

---
Previous: [Lesson 13](13-examples-and-structure.md) · Next: [Lesson 15: Prompt templates and testing](15-templates-and-testing.md)
