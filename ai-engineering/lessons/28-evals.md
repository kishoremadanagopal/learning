# Lesson 28: Evaluations (evals)

**You'll learn:** why LLM features need evals, success criteria, tasks, trials, graders, transcripts and outcomes, code, model and human grading, capability and regression evals, pass@k and pass^k, how many cases to start with, noise in small samples, paired comparison of runs, eval-driven development, reading transcripts, grading outcomes rather than paths, overfitting to an eval set.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#evals)**: run every example and check your exercise answers.

## Key terms

- **Eval (evaluation):** a repeatable measurement of how well an AI system performs on a set of cases.
- **Task (case):** one test input with its success criteria.
- **Trial:** one attempt at a task; several trials reveal variability.
- **Grader:** code, a model or a person that scores a trial.
- **Transcript (trace):** the full record of a trial, including tool calls and intermediate steps.
- **Regression eval:** a suite that should keep passing, run on every change.
- **pass@k:** the probability that at least one of k attempts succeeds.
- **pass^k:** the probability that all k attempts succeed.

Traditional code is tested with exact expectations: `add(2, 3) == 5`. LLM output varies from run to run, has many acceptable forms, and changes when you edit a prompt or switch model. **Evals** (evaluations) are how you still know whether a change made things better or worse. Without them, every prompt tweak is a guess, and every model upgrade is a gamble.

## The vocabulary

Anthropic's engineering guide to agent evals (January 2026) uses a clear set of terms:

- **Task (case):** one test: an input plus success criteria.
- **Trial:** one attempt at a task. Outputs vary, so important tasks get several trials.
- **Grader:** the logic that scores some aspect of a trial.
- **Transcript (trace):** the full record of a trial: the output, tool calls, reasoning and intermediate results.
- **Outcome:** the final state of the world, such as whether the refund was actually issued, not just whether the agent **said** it was.

## Three kinds of grader

| Grader | Good | Bad | Example |
|---|---|---|---|
| **code** | fast, cheap, objective, repeatable | brittle: may reject valid variations | exact label match, valid JSON, required phrases, tests pass |
| **model** (LLM as judge) | flexible, handles nuance, scales | non-deterministic; must be calibrated | "Is this reply polite and does it answer the question? 1–5" |
| **human** | the gold standard | slow and expensive | expert review of a sample |

Use code wherever the criterion allows it (Lessons 9 and 12 built several such checks), a model for judgement calls (Lesson 29), and humans to build reference labels and to check that the model grader agrees with people.

Anthropic's evaluation guidance favours **volume**: more cases with automated, slightly noisier grading beat a handful of perfect human-graded ones.

## Capability and regression evals

- **Capability evals** measure what the system **can't yet** do well. They should start with a low pass rate, and they show progress.
- **Regression evals** check the system **still** handles everything it used to. They should pass at close to 100%, and run on every change, like unit tests in CI.

When a capability eval reaches a high pass rate, its cases graduate into the regression suite.

## Several trials: pass@k and pass^k

When outputs vary, one trial per task can mislead. With several trials per task:

- **pass@k:** the probability that **at least one** of k attempts succeeds. Right when one success is enough (generate five candidate fixes, keep one that passes the tests).
- **pass^k:** the probability that **all** k attempts succeed. Right when users need it to work **every** time (a customer-facing agent).

A task solved in 3 of 5 trials looks good on pass@5 (it almost always gets there eventually) and poor on pass^5. The first exercise computes both.

## How many cases?

Start with **20–50 tasks** drawn from real failures and real usage; early on, improvements are large enough to see. But small sets are noisy:

```python
import math

for n in (20, 50, 200, 1000):
    p = 0.8                                             # an observed pass rate of 80%
    margin = 1.96 * math.sqrt(p * (1 - p) / n)          # approximate 95% interval
    print(f"{n:>5} cases: 80% ± {margin:.0%}")
```

With 50 cases, 80% means "somewhere around 69–91%". A two-point improvement on such a set is noise. Grow the set as the system matures, and compare versions **on the same cases** (the second exercise): the cases that flipped tell you more than the totals.

## Eval-driven development

![A cycle of five steps: collect real failures and usage into eval cases; run the evals on the current version; read the transcripts of failures; change one thing (prompt, retrieval, tools, model); re-run and compare case by case, then repeat. Passing capability cases move into the regression suite](../figures/eval-cycle.svg)

- **Write the eval before the fix:** turn every bug report into a case.
- **Read transcripts.** Scores say *that* something failed; transcripts say *why*, and whether the grader was wrong. Failures should look fair.
- **Grade the outcome, not the path:** don't fail an agent for solving a task in a different order than you expected.
- **Watch for overfitting:** tuning a prompt against the same 30 cases for weeks makes it good at those 30. Keep a held-out set.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| pass@k and pass^k | per task: 1 − C(n − c, k) ÷ C(n, k) and C(c, k) ÷ C(n, k); average | O(trials) | O(tasks) |
| Compare runs | shared cases; rates; fixed and broken lists | O(n log n) | O(n) |
| Margin of a pass rate | about 1.96 × √(p(1 − p) ÷ n) | O(1) | O(1) |

## Common mistakes

- Changing prompts or models without running an eval.
- Comparing totals instead of which cases flipped.
- Treating small differences on small sets as real.
- Grading the steps an agent took instead of the outcome.
- Tuning against the same cases until the prompt overfits them.

## Exercises

### 1. pass@k and pass^k

For each task you ran `n` trials and recorded which passed. Write `pass_metrics(trials, k)`, where `trials` maps each task to its list of booleans. For a task with `n` trials of which `c` passed, the standard unbiased estimates are:

- pass@k = 1 − C(n − c, k) / C(n, k)
- pass^k = C(c, k) / C(n, k)

where C is the binomial coefficient (`math.comb`, which returns 0 when the top is smaller than the bottom). Return `{"pass@k": …, "pass^k": …}`, each **averaged over the tasks**. Raise `ValueError` if any task has fewer than `k` trials, or if there are no tasks.

Starter code:

```python
import math

def pass_metrics(trials, k):
    pass

trials = {"refund": [True, True, False, True, False],
          "address-change": [True, True, True, True, True],
          "cancel-order": [False, False, False, True, False]}
print(pass_metrics(trials, 1))
print(pass_metrics(trials, 3))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** per task, two probabilities about choosing k of its n recorded trials; then the mean over tasks.
2. **Examples:** refund has c = 3 of n = 5; for k = 3: pass@3 = 1 − C(2, 3)/C(5, 3) = 1 − 0/10 = 1, pass^3 = C(3, 3)/10 = 0.1.
3. **Brute force:** enumerate every subset of k trials and count: same numbers, exponentially slower.
4. **Pattern:** **combinatorial estimates** averaged over tasks.
5. **Plan:** validate → per task (n, c, two formulas) → averages.
6. **Code and test:** k = 1, k = n, all failing, all passing, too few trials.

</details>

<details>
<summary>💡 Hint 1</summary>

For each task, `n = len(results)` and `c = sum(results)` (True counts as 1).

</details>

<details>
<summary>💡 Hint 2</summary>

C(n − c, k) / C(n, k) is the chance that k trials picked at random are **all failures**; pass@k is one minus that. C(c, k) / C(n, k) is the chance they're **all successes**.

</details>

<details>
<summary>💡 Hint 3</summary>

Average each metric over the tasks; check `n < k` (and no tasks) first and raise `ValueError`.

</details>

### 2. Compare two eval runs

Totals hide what changed. Write `compare_runs(before, after)`, where each maps case IDs to `True` (pass) or `False` (fail). Consider only the cases present in **both** runs. Return:

```text
{"before": pass rate before, "after": pass rate after,
 "fixed": sorted IDs that went False → True,
 "broken": sorted IDs that went True → False}
```

Pass rates are fractions between 0 and 1 (`0.0` if there are no shared cases).

Starter code:

```python
def compare_runs(before, after):
    pass

before = {"refund": True, "cancel": False, "address": True, "warranty": False}
after = {"refund": True, "cancel": True, "address": False, "warranty": True, "new-case": True}
print(compare_runs(before, after))
# {'before': 0.5, 'after': 0.75, 'fixed': ['cancel', 'warranty'], 'broken': ['address']}
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a paired comparison on the same cases: rates plus the flips in each direction.
2. **Examples:** same total (0.5 → 0.5) can hide one fix and one break.
3. **Brute force:** this is already linear.
4. **Pattern:** **paired comparison** over the intersection.
5. **Plan:** intersection → guard → rates → fixed and broken lists.
6. **Code and test:** unchanged, swapped, disjoint, empty.

</details>

<details>
<summary>💡 Hint 1</summary>

`before.keys() & after.keys()` gives the shared case IDs (dict key views support set operations).

</details>

<details>
<summary>💡 Hint 2</summary>

Pass rates are `sum(results) / count` over the shared IDs, because `True` counts as 1.

</details>

<details>
<summary>💡 Hint 3</summary>

Fixed: `not before[c] and after[c]`; broken: `before[c] and not after[c]`; sort both lists.

</details>

**In the sandbox:** exercises 54–55. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. pass@k and pass^k</summary>

```python
import math

def pass_metrics(trials, k):
    if not trials:
        raise ValueError("no tasks")
    at_least_one, all_pass = [], []
    for task, results in trials.items():
        n, c = len(results), sum(results)
        if n < k:
            raise ValueError(f"task {task!r} has {n} trials; need at least {k}")
        total = math.comb(n, k)
        at_least_one.append(1 - math.comb(n - c, k) / total)   # 1 − P(all k picked trials failed)
        all_pass.append(math.comb(c, k) / total)               # P(all k picked trials passed)
    return {"pass@k": sum(at_least_one) / len(trials), "pass^k": sum(all_pass) / len(trials)}

trials = {"refund": [True, True, False, True, False],
          "address-change": [True, True, True, True, True],
          "cancel-order": [False, False, False, True, False]}
print(pass_metrics(trials, 1))
print(pass_metrics(trials, 3))
```

**Line by line**

- `sum(results)` counts the passes because `True` is 1 in arithmetic.
- `math.comb(n - c, k)` is 0 when there are fewer than k failures, so pass@k becomes exactly 1: any k trials must include a success.
- With k = 1 both formulas reduce to c / n, the ordinary pass rate.
- Averaging per task (rather than pooling all trials) weights every task equally.

**Trace** for k = 3: refund (1, 0.1), address-change (1, 1), cancel-order (1 − C(4, 3)/10 = 0.6, 0) → pass@3 = 2.6/3 ≈ 0.867, pass^3 = 1.1/3 ≈ 0.367.

**Complexity:** O(total trials).

**Common wrong approach:** estimating pass@k as 1 − (1 − p)^k from the overall pass rate p. It assumes every task is equally hard; in reality some tasks always pass and others never do, which the per-task formula captures.

</details>

<details>
<summary>✅ 2. Compare two eval runs</summary>

```python
def compare_runs(before, after):
    shared = before.keys() & after.keys()
    if not shared:
        return {"before": 0.0, "after": 0.0, "fixed": [], "broken": []}
    return {
        "before": sum(before[c] for c in shared) / len(shared),
        "after": sum(after[c] for c in shared) / len(shared),
        "fixed": sorted(c for c in shared if not before[c] and after[c]),
        "broken": sorted(c for c in shared if before[c] and not after[c]),
    }

before = {"refund": True, "cancel": False, "address": True, "warranty": False}
after = {"refund": True, "cancel": True, "address": False, "warranty": True, "new-case": True}
print(compare_runs(before, after))
```

**Line by line**

- Using only shared cases keeps the comparison fair when the eval set grew between runs (`new-case` is ignored).
- Key views support `&`, so there's no need to build sets by hand.
- `sorted(...)` gives stable, readable output for reports and tests.
- The early return avoids dividing by zero.

**Trace:** shared = refund, cancel, address, warranty → before 2/4, after 3/4; cancel and warranty flipped to pass, address flipped to fail.

**Complexity:** O(n log n) for the sorting.

**Common wrong approach:** reporting only "75% → 78%" and shipping. The broken list is where the risk is: a change that fixes ten easy cases and breaks your most important one is a regression.

</details>

## Quick quiz

1. Why do LLM features need evals rather than only ordinary unit tests?
   - A) LLMs can't be called from tests
   - B) Outputs vary between runs and have many acceptable forms, so you measure pass rates over many cases
   - C) Unit tests are too fast

2. What's the difference between a capability eval and a regression eval?
   - A) Capability evals target what the system can't yet do (low pass rate); regression evals check it still does what it did (near 100%)
   - B) They're the same thing
   - C) Regression evals only run once

3. A customer-facing agent must work every time a user asks. Which metric fits?
   - A) The average output length
   - B) pass^k: all k trials succeed
   - C) pass@k: at least one of k trials succeeds

4. Your pass rate went from 80% to 82% on 50 cases. What can you conclude?
   - A) The new version is definitely better
   - B) Probably nothing yet: that difference is within the noise of a 50-case set
   - C) The eval is broken

<details>
<summary>Quiz answers</summary>

1. **B) Outputs vary between runs and have many acceptable forms, so you measure pass rates over many cases**: Evals turn "seems better" into a measurement.
2. **A) Capability evals target what the system can't yet do (low pass rate); regression evals check it still does what it did (near 100%)**: Passing capability cases graduate into the regression suite.
3. **B) pass^k: all k trials succeed**: Reliability needs consistency across trials.
4. **B) Probably nothing yet: that difference is within the noise of a 50-case set**: Look at which cases flipped, and grow the set.

</details>

---
Previous: [Lesson 27](27-agent-safety.md) · Next: [Lesson 29: LLM as a judge](29-llm-as-judge.md)
