# Lesson 30: Catching hallucinations

**You'll learn:** factual and unfaithful hallucinations, fabricated references, invented code and packages, false action reports, why models hallucinate, rewards for guessing, grounding, permission to abstain, quotes and citations, tools for facts, narrowing tasks, verification passes and chain-of-verification, checking numbers and claims against sources, consistency across samples, faithfulness judges, measuring hallucination rates.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#hallucinations)**: run every example and check your exercise answers.

## Key terms

- **Hallucination:** fluent, confident output that is false or unsupported.
- **Faithfulness:** agreement between an answer and the sources it was given.
- **Abstention:** the model declining to answer when it lacks the information.
- **Chain-of-verification:** drafting, generating verification questions, answering them independently, then revising.
- **Self-consistency check:** comparing several samples to find details that vary.
- **Slopsquatting:** registering package names that models commonly invent, to trap people who install them.

A **hallucination** is fluent, confident output that isn't true or isn't supported. It's the failure users notice most and trust least, and in a product it can cost money, reputation, or worse.

## Kinds of hallucination

| Kind | Example |
|---|---|
| **factual** (wrong about the world) | "The Tour de France starts in July every year since 1890" (it began in 1903) |
| **unfaithful** (contradicts or goes beyond the given sources) | the policy says 30 days; the answer says 60 |
| **fabricated references** | a citation, URL or court case that doesn't exist |
| **invented code** | a function, parameter or package that doesn't exist; attackers even register commonly hallucinated package names ("slopsquatting") |
| **false actions** | an agent saying it sent the email when the tool call failed |

## Why models do it

A language model generates the most plausible continuation (Lesson 1); plausible and true usually coincide, but not always: rare facts, precise numbers, recent events, private information and long chains of reasoning are where they part. OpenAI researchers argued in 2025 that training and evaluation also **reward guessing**: like a multiple-choice exam with no penalty for wrong answers, a model scores better by guessing than by saying "I don't know". Newer models abstain more often and hallucinate less, but none is immune.

## Prevention

Most of this course is hallucination prevention:

- **Ground answers in sources** (RAG, Part 4) and instruct the model to use **only** them.
- **Allow "I don't know"** explicitly, and test that it's used (Lesson 22).
- **Quotes first:** have the model extract relevant quotes, then answer from them (Lesson 13); use **citations** so claims are checkable (Lesson 17).
- **Use tools for facts:** a calculator for arithmetic, a database for prices, search for recent events (Part 5). Don't ask the model to remember what it can look up.
- **Narrow the task:** extraction into a schema hallucinates less than open-ended writing.
- **Check actions against outcomes:** confirm in code that the tool call succeeded before the agent reports success.
- **Verification passes:** draft an answer, then check it, for example with **chain-of-verification** (plan questions that would verify each claim, answer them independently, then revise).

## Detection

Some checks are cheap and automatic:

- **Numbers and names against the sources:** every figure in an answer should appear in the evidence (the first exercise).
- **Claims against a knowledge base:** extract claims as (subject, attribute, value) and look them up (the second exercise).
- **Citations:** check they exist and point at text that supports the sentence (Lesson 17).
- **Consistency:** ask the same question several times; facts the model really knows come out the same, while invented details vary between samples. Disagreement is a useful uncertainty signal (and voting, Lesson 14, uses the agreement).
- **Model judges** for faithfulness, with the sources in the prompt (Lesson 29).

```python
answer = "Puncture repairs cost £12 and are done within 48 hours. We stock 40 tyre sizes."
sources = "Puncture repairs cost £12 and are usually done the same day."

answer_words = set(answer.lower().replace(".", "").split())
source_words = set(sources.lower().replace(".", "").split())
print("in the answer but not the source:", sorted(answer_words - source_words))
```

Even this crude word difference points at the invented parts ("48 hours", "40 tyre sizes").

## Measure it

Treat hallucination as a **rate** you track, not an anecdote: run your eval set with a faithfulness grader, count unsupported claims per answer and refusal accuracy on unanswerable questions, and watch the numbers when you change prompts, retrieval or models. Show users the sources, and make it easy to report a wrong answer.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Unsupported numbers | extract; normalise to values; set difference with the sources | O(answer + sources) | O(numbers) |
| Verify claims | normalised (subject, attribute) lookup; supported, contradicted or unverifiable | O(facts + claims) | O(facts) |
| Reduce hallucination | ground, allow abstention, quote, cite, use tools, verify | — | — |

## Common mistakes

- Asking models to recall facts they could look up with a tool.
- Not giving the model a way to say "I don't know".
- Trusting an agent's report of an action without checking the outcome.
- Installing a package a model suggested without checking it exists and is legitimate.
- Treating every flagged number or unverifiable claim as a confirmed hallucination.

## Exercises

### 1. Find unsupported numbers

Write `unsupported_numbers(answer, sources)` returning the numbers in `answer` that don't appear in any of the `sources` (a list of strings):

- A number is a match of `\d[\d,]*(?:\.\d+)?` with any trailing commas removed (so `"30,"` at the end of a clause is `"30"`).
- Compare by **value**: remove the thousands commas and convert to `float`, so `1,200` matches `1200` and `12` matches `12.00`.
- Return the unsupported numbers **as written** (after removing trailing commas), in order of first appearance, each value once.

Starter code:

```python
import re

def unsupported_numbers(answer, sources):
    pass

sources = ["Puncture repairs cost £12.00 and are usually done the same day.",
           "We have repaired 1200 bikes since 2015. Returns within 30 days."]
print(unsupported_numbers("Repairs cost £12 and take 2 days; we have fixed 1,200 bikes since 2019.", sources))
# ['2', '2019']
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** extract, normalise, set difference, keep order and distinctness.
2. **Examples:** `£12` versus `£12.00` → both 12.0 → supported; `1,200` versus `1200` → supported.
3. **Brute force:** compare the raw strings: "1,200" ≠ "1200" gives false alarms.
4. **Pattern:** **normalise, then set membership**.
5. **Plan:** helpers → source value set → filter the answer's numbers in order.
6. **Code and test:** decimals, thousands separators, trailing commas, repeats, no sources.

</details>

<details>
<summary>💡 Hint 1</summary>

Write a helper that finds the numbers in a text (`re.findall` with the pattern, then `.rstrip(",")` on each).

</details>

<details>
<summary>💡 Hint 2</summary>

Convert to comparable values with `float(n.replace(",", ""))`, and build a set of every value in the sources.

</details>

<details>
<summary>💡 Hint 3</summary>

Walk the answer's numbers in order; keep one if its value isn't in the sources' set and you haven't already reported that value.

</details>

### 2. Verify claims against facts

Suppose another step has extracted the answer's factual claims as dicts `{"subject": …, "attribute": …, "value": …}`. Write `verify_claims(claims, facts)`, where `facts` maps `(subject, attribute)` pairs to known values. Return a list with one verdict per claim, in order:

- `"supported"` if the pair is in `facts` and the values match,
- `"contradicted"` if the pair is in `facts` but the values differ,
- `"unverifiable"` if the pair isn't in `facts`.

Compare subjects, attributes and values after `str(x).strip().lower()`.

Starter code:

```python
def verify_claims(claims, facts):
    pass

facts = {("puncture repair", "price"): "£12", ("returns", "window"): "30 days",
         ("frames", "warranty"): "lifetime"}
claims = [{"subject": "Puncture repair", "attribute": "price", "value": "£12"},
          {"subject": "returns", "attribute": "window", "value": "60 days"},
          {"subject": "helmets", "attribute": "colour", "value": "red"}]
print(verify_claims(claims, facts))   # ['supported', 'contradicted', 'unverifiable']
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a lookup with three outcomes; normalisation on both sides.
2. **Examples:** the fact's key is `("Frames", "Warranty")`, the claim says `" FRAMES "`: both normalise to `("frames", "warranty")`.
3. **Brute force:** scanning every fact for every claim: O(claims × facts).
4. **Pattern:** **normalise into a lookup table**, then classify.
5. **Plan:** normalised facts dict → per claim: key → missing / equal / different.
6. **Code and test:** case and spacing, numbers, empty inputs.

</details>

<details>
<summary>💡 Hint 1</summary>

Normalise the **facts** once, building a new dict whose keys and values are normalised, so lookups are simple.

</details>

<details>
<summary>💡 Hint 2</summary>

For each claim, build the normalised `(subject, attribute)` key; then it's a three-way choice.

</details>

<details>
<summary>💡 Hint 3</summary>

`norm = lambda x: str(x).strip().lower()`; `str` lets numbers compare with text.

</details>

**In the sandbox:** exercises 58–59. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Find unsupported numbers</summary>

```python
import re

NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")

def numbers_in(text):
    return [match.rstrip(",") for match in NUMBER.findall(text)]

def value(number):
    return float(number.replace(",", ""))

def unsupported_numbers(answer, sources):
    known = {value(n) for source in sources for n in numbers_in(source)}
    unsupported, seen = [], set()
    for number in numbers_in(answer):
        v = value(number)
        if v not in known and v not in seen:
            seen.add(v)
            unsupported.append(number)
    return unsupported

sources = ["Puncture repairs cost £12.00 and are usually done the same day.",
           "We have repaired 1200 bikes since 2015. Returns within 30 days."]
print(unsupported_numbers("Repairs cost £12 and take 2 days; we have fixed 1,200 bikes since 2019.", sources))
```

**Line by line**

- The regex starts with a digit, so a trailing comma or a lone comma can't start a number; `rstrip(",")` removes the clause comma the pattern swallowed.
- Converting to `float` makes `3.5` and `3.50` the same value, and `12` the same as `12.00`.
- The `seen` set reports each value once, even if the answer repeats it.
- Numbers are returned as written, which is what you'd show a reviewer.

**Trace:** answer numbers 12, 2, 1,200, 2019; source values {12, 1200, 2015, 30} → 2 and 2019 are unsupported.

**Complexity:** O(len(answer) + total source length).

**Common wrong approach:** treating every flagged number as a hallucination. "2 days" might be a legitimate calculation or come from general knowledge; the check finds candidates for review, it doesn't deliver verdicts. (It also misses numbers written as words, like "thirty".)

</details>

<details>
<summary>✅ 2. Verify claims against facts</summary>

```python
def norm(x):
    return str(x).strip().lower()

def verify_claims(claims, facts):
    known = {(norm(s), norm(a)): norm(v) for (s, a), v in facts.items()}
    verdicts = []
    for claim in claims:
        key = (norm(claim["subject"]), norm(claim["attribute"]))
        if key not in known:
            verdicts.append("unverifiable")
        elif known[key] == norm(claim["value"]):
            verdicts.append("supported")
        else:
            verdicts.append("contradicted")
    return verdicts

facts = {("puncture repair", "price"): "£12", ("returns", "window"): "30 days",
         ("frames", "warranty"): "lifetime"}
claims = [{"subject": "Puncture repair", "attribute": "price", "value": "£12"},
          {"subject": "returns", "attribute": "window", "value": "60 days"},
          {"subject": "helmets", "attribute": "colour", "value": "red"}]
print(verify_claims(claims, facts))
```

**Line by line**

- Normalising the facts once (not on every lookup) keeps each claim check O(1).
- `str(x)` lets the number 9 match the text "9".
- "Unverifiable" is not "false": it means your knowledge base can't say, which is common, and worth tracking separately.
- Contradictions are the most serious result: the answer disagrees with something you know.

**Trace:** the price matches (supported); the returns window differs (contradicted); there's no fact about helmet colours (unverifiable).

**Complexity:** O(facts + claims).

**Common wrong approach:** counting "unverifiable" as hallucination, or as fine. Neither is right: report the three counts separately, and route unverifiable claims to a model judge or a human. (Extracting claims reliably is itself a model task, so check that step too.)

</details>

## Quick quiz

1. Which is an unfaithful hallucination?
   - A) The model refuses an off-topic request
   - B) The policy says returns within 30 days, but the answer says 60
   - C) The answer is shorter than expected

2. Why can evaluations encourage models to guess?
   - A) Guessing is faster to compute
   - B) When wrong answers cost no more than "I don't know", guessing scores better on average
   - C) Evaluations always reward long answers

3. An agent reports "email sent" but the tool call returned an error. What prevents this?
   - A) Checking tool outcomes in code before the agent reports success
   - B) Using a smaller model
   - C) A longer system prompt

4. Why does disagreement across several samples hint at a hallucination?
   - A) Disagreement means the API is broken
   - B) Samples always disagree
   - C) Facts the model knows tend to come out the same each time, while invented details vary

<details>
<summary>Quiz answers</summary>

1. **B) The policy says returns within 30 days, but the answer says 60**: Faithfulness means agreeing with the given sources.
2. **B) When wrong answers cost no more than "I don't know", guessing scores better on average**: Reward abstention where appropriate.
3. **A) Checking tool outcomes in code before the agent reports success**: Verify outcomes, not claims.
4. **C) Facts the model knows tend to come out the same each time, while invented details vary**: Consistency is a useful uncertainty signal.

</details>

---
Previous: [Lesson 29](29-llm-as-judge.md) · Next: [Lesson 31: Tracing and monitoring](31-observability.md)
