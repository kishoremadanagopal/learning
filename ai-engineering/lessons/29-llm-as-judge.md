# Lesson 29: LLM as a judge

**You'll learn:** model-graded evaluation, judge prompts and rubrics, pass/fail and small scales, reasoning before the verdict, one criterion per judge, pointwise, reference-based and pairwise judging, position bias, length bias, self-preference, leniency, calibrating judges against human labels, raw agreement versus Cohen's kappa, judge cost.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#llm-as-judge)**: run every example and check your exercise answers.

## Key terms

- **LLM as a judge:** using a model, prompted with a rubric, to grade outputs.
- **Rubric:** the explicit criteria and score definitions a grader applies.
- **Pairwise judging:** asking which of two outputs is better.
- **Position bias:** a judge favouring an answer because of where it appears.
- **Length (verbosity) bias:** a judge favouring longer answers.
- **Self-preference bias:** a judge favouring outputs from its own model or style.
- **Cohen's kappa:** agreement between two graders, corrected for agreement expected by chance.

Many qualities can't be checked with code: is this reply **polite**, **helpful**, **faithful to the documents**, **correctly reasoned**? Human grading is the gold standard but slow. An **LLM judge** (a model prompted to grade outputs against a rubric) scales that judgement to thousands of cases. It's one of the most useful tools in AI engineering, and one of the easiest to misuse.

## A judge prompt

```text
You are grading a bike shop's support replies.

<rubric>
Score 1 (pass) only if ALL of these hold:
- It answers the customer's actual question.
- Every factual claim is supported by the policy in <policy>.
- It's polite and under 120 words.
Otherwise score 0 (fail).
</rubric>

<policy>{{policy}}</policy>
<question>{{question}}</question>
<reply>{{reply}}</reply>

Think through each rubric point first, then give your verdict as
<score>0</score> or <score>1</score>.
```

Principles (echoing Anthropic's grading guidance):

- **Specific rubrics:** spell out what earns each score, with examples of borderline cases. "Is it good?" gives vague, unstable grades.
- **Narrow, checkable output:** pass/fail or a small scale (1–5) with defined levels, in tags or structured output, so code can parse it.
- **Reason, then score:** ask for the reasoning first, or use a thinking model, so the verdict follows from the analysis.
- **One criterion per judge** where you can: separate judges for faithfulness, tone and completeness are easier to check and debug than one judge doing everything.
- **Give it the evidence:** the source documents, the reference answer, or the conversation, whatever a careful human grader would need.

## Ways to judge

| Style | How | Good for |
|---|---|---|
| **pointwise** | score one output against the rubric | monitoring, pass rates, regression suites |
| **reference-based** | compare the output with a known good answer | factual questions with a clear answer |
| **pairwise** | which of two outputs is better? | comparing prompt or model versions |

People (and models) are more consistent at **comparing** two answers than at assigning absolute scores, which makes pairwise judging a strong way to decide between two versions.

## Known biases

Model judges have systematic biases, documented since the early "LLM-as-a-judge" studies (Zheng et al., 2023):

- **Position bias:** favouring the first (or second) answer shown. Fix: judge **both orders** and only count consistent verdicts (the second exercise).
- **Length (verbosity) bias:** preferring longer answers. Fix: say in the rubric that length isn't quality; compare answers of similar length; penalise padding explicitly.
- **Self-preference:** favouring outputs written in its own style or by its own model family. Fix: use a different model as the judge where you can, and check against humans.
- **Leniency and rubric drift:** passing everything, or interpreting a criterion loosely. Fix: concrete pass and fail examples in the prompt.

## Trust, but verify the judge

A judge is itself a model output, so **evaluate the judge**:

1. Have people label 50–200 cases with the same rubric.
2. Run the judge on the same cases.
3. Measure agreement, and read the disagreements: is the rubric unclear, or the judge wrong?

Raw agreement can flatter: if 90% of replies pass, a judge that always says "pass" agrees 90% of the time while being useless. **Cohen's kappa** corrects for agreement expected by chance:

```text
kappa = (observed agreement − chance agreement) / (1 − chance agreement)
```

Kappa is 1 for perfect agreement and 0 for chance level. As a rough guide, above about 0.6 is substantial and above 0.8 strong; how much is enough depends on the stakes. The first exercise computes it.

Re-check the judge whenever you change its prompt or model, and spot-check its verdicts in production. Judges also cost tokens: run cheap code checks first, and use a smaller model as the judge if it agrees well enough with people.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Cohen's kappa | (observed − chance agreement) ÷ (1 − chance agreement) | O(n × labels) | O(labels) |
| Pairwise verdict | judge both orders; count only consistent wins | 2 judge calls | O(1) |
| Calibrate a judge | human labels on a sample; agreement and kappa; read disagreements | O(sample) | O(sample) |

## Common mistakes

- Vague rubrics such as "rate the quality from 1 to 10".
- Trusting a judge that was never compared with human labels.
- Reporting raw agreement when one label dominates.
- Judging pairs in only one order.
- Letting one judge score many unrelated criteria at once.

## Exercises

### 1. Cohen's kappa

Write `cohen_kappa(a, b)` for two equal-length lists of labels (from two graders on the same cases):

- observed agreement `po` = the fraction of cases where the labels match;
- chance agreement `pe` = the sum, over every label used by either grader, of (fraction of `a` with that label) × (fraction of `b` with that label);
- kappa = `(po − pe) / (1 − pe)`; if `pe` is 1 (both graders used one identical label throughout), return `1.0`.

Raise `ValueError` if the lists are empty or of different lengths.

Starter code:

```python
def cohen_kappa(a, b):
    pass

human = ["pass", "pass", "fail", "pass", "fail", "pass", "pass", "fail", "pass", "pass"]
judge = ["pass", "pass", "fail", "pass", "pass", "pass", "pass", "fail", "fail", "pass"]
print(round(cohen_kappa(human, judge), 3))     # 0.524: 80% raw agreement
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** agreement beyond what the graders' label frequencies would produce by luck.
2. **Examples:** 9 of 10 "p" versus all "p": po = 0.9, pe = 0.9 × 1 + 0.1 × 0 = 0.9 → kappa 0.
3. **Brute force:** counting pairs with a confusion matrix: the same numbers, more code.
4. **Pattern:** **observed versus expected** (chance-corrected agreement).
5. **Plan:** validate → po → pe over all labels → the formula, guarding pe = 1.
6. **Code and test:** perfect, opposite, chance-level, three labels, a single label.

</details>

<details>
<summary>💡 Hint 1</summary>

Observed agreement: `sum(x == y for x, y in zip(a, b)) / n`.

</details>

<details>
<summary>💡 Hint 2</summary>

Chance agreement: if grader A says "pass" 70% of the time and B says "pass" 70% of the time, by chance they'd both say "pass" on 0.7 × 0.7 = 49% of cases. Add that up over every label.

</details>

<details>
<summary>💡 Hint 3</summary>

Loop over `set(a) | set(b)` and use `a.count(label) / n` and `b.count(label) / n`.

</details>

### 2. A position-swapped pairwise judge

Write `pairwise_verdict(judge, question, answer_a, answer_b)`. `judge(question, first, second)` returns `"first"`, `"second"` or `"tie"`. Call it **twice**: once with `(answer_a, answer_b)` and once with `(answer_b, answer_a)`. Return:

- `"A"` if answer A wins in **both** orders (it's `"first"` in the first call and `"second"` in the second);
- `"B"` if answer B wins in both orders;
- `"tie"` otherwise (including inconsistent verdicts and ties).

Starter code:

```python
def pairwise_verdict(judge, question, answer_a, answer_b):
    pass

def first_bias_judge(question, first, second):
    return "first"                                  # always prefers whatever it sees first

def length_judge(question, first, second):
    return "first" if len(first) > len(second) else "second" if len(second) > len(first) else "tie"

print(pairwise_verdict(first_bias_judge, "Q", "short", "a much longer answer"))   # tie
print(pairwise_verdict(length_judge, "Q", "short", "a much longer answer"))       # B
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a verdict counts only if it survives swapping the order.
2. **Examples:** a judge that always says "first" picks A, then B: inconsistent → tie.
3. **Brute force:** one call: exposed to position bias.
4. **Pattern:** **counterbalancing**: run both orders, keep agreement.
5. **Plan:** two calls → map to A, B or tie.
6. **Code and test:** always-first, always-second, consistent preferences, half wins.

</details>

<details>
<summary>💡 Hint 1</summary>

Make two calls: `judge(question, answer_a, answer_b)` and `judge(question, answer_b, answer_a)`.

</details>

<details>
<summary>💡 Hint 2</summary>

In the second call A is shown second, so "A wins" there means the verdict is `"second"`.

</details>

<details>
<summary>💡 Hint 3</summary>

Only two combinations give a winner: ("first", "second") → A and ("second", "first") → B. Everything else is a tie.

</details>

**In the sandbox:** exercises 56–57. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Cohen's kappa</summary>

```python
def cohen_kappa(a, b):
    if not a or len(a) != len(b):
        raise ValueError("need two non-empty lists of the same length")
    n = len(a)
    po = sum(x == y for x, y in zip(a, b)) / n
    pe = sum((a.count(label) / n) * (b.count(label) / n) for label in set(a) | set(b))
    if pe == 1:
        return 1.0
    return (po - pe) / (1 - pe)

human = ["pass", "pass", "fail", "pass", "fail", "pass", "pass", "fail", "pass", "pass"]
judge = ["pass", "pass", "fail", "pass", "pass", "pass", "pass", "fail", "fail", "pass"]
print(round(cohen_kappa(human, judge), 3))
```

**Line by line**

- `x == y` is `True` (1) or `False` (0), so the sum counts matches.
- Labels used by only one grader contribute 0 to `pe` (their count in the other list is 0), so including them is harmless.
- The `pe == 1` guard avoids dividing by zero when both graders used one label for everything (then they agree perfectly).
- Kappa can be negative: systematic disagreement is worse than chance.

**Trace** on the starter: po = 8/10 = 0.8; human passes 7/10, judge passes 7/10 → pe = 0.7 × 0.7 + 0.3 × 0.3 = 0.58 → kappa = 0.22 / 0.42 ≈ 0.524.

**Complexity:** O(n × labels) with `count`; O(n) with a `Counter`.

**Common wrong approach:** quoting raw agreement alone. On a set where 90% of cases pass, a judge that always says "pass" scores 90% agreement and kappa 0.

</details>

<details>
<summary>✅ 2. A position-swapped pairwise judge</summary>

```python
def pairwise_verdict(judge, question, answer_a, answer_b):
    forward = judge(question, answer_a, answer_b)     # A shown first
    backward = judge(question, answer_b, answer_a)    # B shown first
    if forward == "first" and backward == "second":
        return "A"
    if forward == "second" and backward == "first":
        return "B"
    return "tie"                                      # inconsistent or tied: no reliable winner

def first_bias_judge(question, first, second):
    return "first"

def length_judge(question, first, second):
    return "first" if len(first) > len(second) else "second" if len(second) > len(first) else "tie"

print(pairwise_verdict(first_bias_judge, "Q", "short", "a much longer answer"))
print(pairwise_verdict(length_judge, "Q", "short", "a much longer answer"))
```

**Line by line**

- Swapping positions turns position bias into a **disagreement**, which the function reports as a tie instead of a fake win.
- The mapping is explicit, so it's easy to audit.
- A tie also covers the case where the judge itself says "tie" in either order.
- Note the length judge in the starter: it's perfectly consistent, but it's measuring length, not quality. Swapping fixes position bias, not every bias.

**Trace:** the always-first judge returns ("first", "first"); A wins the first call, B wins the second → "tie".

**Complexity:** two judge calls.

**Common wrong approach:** judging in one fixed order and reporting a win rate, which can mostly measure the judge's position preference. Over many comparisons, also randomise which version appears as "A".

</details>

## Quick quiz

1. Why should a judge reason before giving its score?
   - A) It makes the judge cheaper
   - B) The verdict then follows from the analysis, which makes grading more accurate on complex criteria
   - C) Scores must always come last in JSON

2. A judge agrees with humans 90% of the time, but 90% of cases are passes. What does Cohen's kappa tell you?
   - A) Whether the agreement is better than a grader that just says "pass" by habit
   - B) The judge's cost
   - C) Nothing: 90% is always good

3. How do you counter position bias in pairwise judging?
   - A) Use a longer rubric
   - B) Always put the better answer first
   - C) Judge both orders and count only consistent verdicts

4. Which judge setup is easiest to check and debug?
   - A) One judge per criterion with a specific rubric and a pass/fail output
   - B) A judge with no rubric
   - C) One judge scoring "overall quality" from 1 to 100

<details>
<summary>Quiz answers</summary>

1. **B) The verdict then follows from the analysis, which makes grading more accurate on complex criteria**: Ask for reasoning first, or use a thinking model.
2. **A) Whether the agreement is better than a grader that just says "pass" by habit**: Kappa corrects for chance agreement.
3. **C) Judge both orders and count only consistent verdicts**: Swapping turns bias into visible inconsistency.
4. **A) One judge per criterion with a specific rubric and a pass/fail output**: Narrow, specific judgements are more reliable.

</details>

---
Previous: [Lesson 28](28-evals.md) · Next: [Lesson 30: Catching hallucinations](30-hallucinations.md)
