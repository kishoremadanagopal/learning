# Lesson 33: Prompting, RAG or fine-tuning?

**You'll learn:** the ladder of ways to adapt a model, prompting, examples, retrieval and tools, fine-tuning, training from scratch, what fine-tuning changes, supervised, preference and reinforcement fine-tuning, DPO, LoRA and QLoRA, distillation, where fine-tuning is available, open-weight models, JSONL training data, data quality, validation, deduplication and leakage, comparing with a prompted baseline, ongoing costs.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#fine-tuning-vs-rag)**: run every example and check your exercise answers.

## Key terms

- **Fine-tuning:** further training of a pretrained model on your own examples.
- **Supervised fine-tuning (SFT):** training on example conversations with ideal responses.
- **Direct preference optimisation (DPO):** training on pairs of better and worse responses.
- **Reinforcement fine-tuning (RFT):** training that rewards responses a grader scores highly.
- **LoRA:** a parameter-efficient method that trains small adapter matrices on frozen weights.
- **Distillation:** training a smaller model to imitate a larger model on a task.
- **Data leakage:** test examples (or near-copies) appearing in the training data.

When a model doesn't do what you need, there are several ways to change its behaviour. They differ hugely in cost, speed of iteration and what they can fix, so the order you try them in matters.

## The ladder

![A ladder of five rungs from bottom to top: prompt engineering (minutes to change, no training); few-shot examples; retrieval and tools (add knowledge and actions); fine-tuning (days, needs hundreds to thousands of examples, changes behaviour and style); training a model from scratch (months, enormous cost). Arrows show cost and time to iterate rising towards the top. Advice: climb only when the rung below is proven insufficient by evals](../figures/adaptation-ladder.svg)

1. **Prompting:** clearer instructions, context, format (Part 3). Changes in minutes.
2. **Examples:** few-shot demonstrations of the behaviour you want.
3. **Retrieval and tools:** give the model **knowledge** it lacks (Part 4) and **actions** it can take (Part 5).
4. **Fine-tuning:** further training on your examples to change its **behaviour**.
5. **Training from scratch:** almost never the right choice outside large AI labs.

Climb a rung only when your evals (Lesson 28) show the rung below can't reach the bar. Most production systems never need step 4.

## What fine-tuning is (and isn't) good for

| Fine-tuning helps with | Fine-tuning is a poor fit for |
|---|---|
| a consistent format, style or tone that's hard to describe | adding facts, especially ones that change (use RAG) |
| narrow, repetitive tasks (classification, extraction) done cheaper by a **smaller** model | citing sources (retrieval provides the evidence) |
| shorter prompts: behaviour learned instead of instructed every call | tasks a better prompt already solves |
| specialised skills where you have many graded examples | small datasets (a few dozen examples) |

The distinction to remember: **RAG changes what the model knows at answer time; fine-tuning changes how it behaves.** They combine well: a fine-tuned model can still answer from retrieved documents.

## Kinds of fine-tuning

- **Supervised fine-tuning (SFT):** train on example conversations ending with the ideal response.
- **Preference fine-tuning** (such as **DPO**, direct preference optimisation): train on pairs of a better and a worse response to the same prompt.
- **Reinforcement fine-tuning (RFT):** the model generates answers, a grader scores them, and training reinforces what scored well. Suited to tasks with checkable answers.

Full fine-tuning updates every weight. **Parameter-efficient** methods such as **LoRA** (low-rank adaptation) train small adapter matrices alongside frozen weights; **QLoRA** does it on a quantised model, so even large open models can be tuned on a single GPU.

**Distillation** trains a small, cheap model on the outputs of a large one, for a narrow task. Check the larger model's terms of service before using its outputs for training.

## Where you can fine-tune

Availability changes often, so check your provider's current documentation:

- **Hosted APIs:** OpenAI offers supervised, preference and reinforcement fine-tuning on selected models; Google's Vertex AI and Amazon Bedrock offer fine-tuning for some of their models. Anthropic's current Claude models are customised through prompting, tools and retrieval rather than public fine-tuning on the Claude API.
- **Open-weight models** (such as Llama, Mistral, Qwen, Gemma and OpenAI's gpt-oss): fine-tune them yourself with Hugging Face's **TRL** and **PEFT** libraries, or tools such as **Unsloth**, then host the result.

## Data is the work

Training data for chat fine-tuning is usually **JSONL**: one JSON object per line, each a short conversation ending with the ideal assistant reply:

```python
import json

examples = [
    {"messages": [{"role": "system", "content": "Classify bike-shop tickets."},
                  {"role": "user", "content": "My brakes squeal when wet."},
                  {"role": "assistant", "content": "repair"}]},
    {"messages": [{"role": "system", "content": "Classify bike-shop tickets."},
                  {"role": "user", "content": "Where is my order 1182?"},
                  {"role": "assistant", "content": "delivery"}]},
]
jsonl = "\n".join(json.dumps(e) for e in examples)
print(jsonl.splitlines()[0][:80], "…")
print(len(jsonl.splitlines()), "training examples")
```

- **Quality beats quantity:** hundreds of correct, consistent, diverse examples beat thousands of noisy ones. Every mistake in the data is taught.
- **Validate the format** before uploading (the first exercise).
- **Hold out a test set**, and make sure no test example also appears in training (**leakage**), including near-duplicates (the second exercise).

## Evaluate, then decide

Compare the fine-tuned model with the **best prompted baseline** on the same held-out eval set: quality, latency and cost per request. Then count the ongoing costs: training runs, hosting a custom model (often priced differently from the base model), re-training whenever your task or data changes, and losing the free improvements of each new base model release, which a prompted system picks up just by switching models.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Validate chat data | per record: structure, roles and content, alternation, final assistant | O(messages) | O(problems) |
| Leak-free split | dedupe normalised inputs; seeded shuffle; slice | O(n) | O(n) |
| Choose an approach | prompt → examples → RAG and tools → fine-tune, climbing only when evals demand it | — | — |

## Common mistakes

- Fine-tuning to add facts that change, instead of using retrieval.
- Fine-tuning before trying better prompts and examples.
- Training on noisy or inconsistent examples.
- Splitting train and test before removing near-duplicates.
- Forgetting the ongoing costs: hosting, retraining and missing base-model upgrades.

## Exercises

### 1. Validate fine-tuning data

Write `validate_examples(records)`. Each record should be a dict with a `"messages"` list. Return a list of `(index, problem)` pairs for the invalid records, in order, reporting only the **first** problem found in each record, checked in this order:

1. `"missing messages"`: not a dict, no `"messages"` key, or it isn't a non-empty list.
2. For each message in order: `"unknown role: <role>"` if the role isn't `system`, `user` or `assistant` (use `None` for a missing role); `"empty content"` if the content isn't a non-empty string (after stripping).
3. `"roles must alternate"`: after an optional **first** `system` message, the roles must go user, assistant, user, assistant, … starting with `user`.
4. `"must end with an assistant message"`.

Starter code:

```python
def validate_examples(records):
    pass

records = [
    {"messages": [{"role": "user", "content": "Brakes squeal."}, {"role": "assistant", "content": "repair"}]},
    {"messages": [{"role": "user", "content": "Where's my order?"}]},
    {"messages": [{"role": "user", "content": "Hi"}, {"role": "user", "content": "Hello?"},
                  {"role": "assistant", "content": "other"}]},
]
print(validate_examples(records))
# [(1, 'must end with an assistant message'), (2, 'roles must alternate')]
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a sequence of checks per record; report the first failure with its index.
2. **Examples:** `[user, user, assistant]` → position 1 should be assistant → "roles must alternate".
3. **Brute force:** collecting every problem per record: more output, but harder to act on.
4. **Pattern:** **validation with early return**, one helper per item.
5. **Plan:** structure → per-message checks → alternation → final role → collect.
6. **Code and test:** each failure type, a valid multi-turn record, mixed lists.

</details>

<details>
<summary>💡 Hint 1</summary>

Write a helper that returns the first problem of **one** record (or `None`), checking in the stated order; returning early makes "first problem only" automatic.

</details>

<details>
<summary>💡 Hint 2</summary>

For alternation, drop a leading system message, then the role at position `i` must be `"user"` when `i` is even and `"assistant"` when it's odd. A system message anywhere else fails this check.

</details>

<details>
<summary>💡 Hint 3</summary>

`m.get("role")` gives `None` for a missing role, so the message is `f"unknown role: {role}"` → "unknown role: None".

</details>

### 2. Split without leakage

Write `split_dataset(examples, test_fraction, seed)`, where each example is a dict with an `"input"` and an `"output"`:

1. **Deduplicate** by normalised input (`" ".join(input.lower().split())`), keeping the **first** occurrence.
2. Shuffle the deduplicated list with `random.Random(seed).shuffle(...)`.
3. The first `round(len(unique) × test_fraction)` examples are the test set; the rest are training.

Return `(train, test)`. Don't modify the input list.

Starter code:

```python
import random

def split_dataset(examples, test_fraction, seed):
    pass

examples = [{"input": "My brakes squeal", "output": "repair"},
            {"input": "Where is order 1182?", "output": "delivery"},
            {"input": "my  brakes squeal", "output": "repair"},          # a near-duplicate
            {"input": "Do you sell helmets?", "output": "sales"},
            {"input": "Chain keeps slipping", "output": "repair"}]
train, test = split_dataset(examples, 0.25, seed=7)
print(len(train), "train,", len(test), "test")                          # 3 train, 1 test
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** remove near-duplicates **before** splitting, so no input lands in both sets; make the split reproducible.
2. **Examples:** "My brakes squeal" and "my  brakes squeal" normalise to the same key → one is dropped.
3. **Brute force:** split first, then dedupe each half: duplicates can still straddle the split.
4. **Pattern:** **dedupe → seeded shuffle → slice**.
5. **Plan:** normalised keys → unique list → shuffle → split.
6. **Code and test:** duplicates, reproducibility, an empty list, a fraction of 0.

</details>

<details>
<summary>💡 Hint 1</summary>

Deduplicate first with a `seen` set of normalised inputs, building a new list (this also protects the input from the shuffle).

</details>

<details>
<summary>💡 Hint 2</summary>

`random.Random(seed)` is a random generator with its own seed: the same seed always gives the same shuffle, without affecting the global `random` state.

</details>

<details>
<summary>💡 Hint 3</summary>

`n_test = round(len(unique) * test_fraction)`; return `unique[n_test:], unique[:n_test]`.

</details>

**In the sandbox:** exercises 64–65. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Validate fine-tuning data</summary>

```python
ROLES = {"system", "user", "assistant"}

def problem(record):
    if not isinstance(record, dict) or not isinstance(record.get("messages"), list) or not record["messages"]:
        return "missing messages"
    messages = record["messages"]
    for m in messages:
        role = m.get("role")
        if role not in ROLES:
            return f"unknown role: {role}"
        content = m.get("content")
        if not isinstance(content, str) or not content.strip():
            return "empty content"
    turns = messages[1:] if messages[0]["role"] == "system" else messages
    for i, m in enumerate(turns):
        if m["role"] != ("user" if i % 2 == 0 else "assistant"):
            return "roles must alternate"
    if messages[-1]["role"] != "assistant":
        return "must end with an assistant message"
    return None

def validate_examples(records):
    found = []
    for index, record in enumerate(records):
        p = problem(record)
        if p:
            found.append((index, p))
    return found

records = [
    {"messages": [{"role": "user", "content": "Brakes squeal."}, {"role": "assistant", "content": "repair"}]},
    {"messages": [{"role": "user", "content": "Where's my order?"}]},
    {"messages": [{"role": "user", "content": "Hi"}, {"role": "user", "content": "Hello?"},
                  {"role": "assistant", "content": "other"}]},
]
print(validate_examples(records))
```

**Line by line**

- The first check guards everything after it: once `messages` is a non-empty list, indexing `[0]` and `[-1]` is safe.
- Checking roles and content before the alternation rule means the alternation check only sees valid roles.
- Slicing off one leading system message keeps the even/odd rule simple.
- `enumerate(records)` provides the index to report, so you can find the bad line in the file.

**Trace** on the starter: record 0 is valid; record 1 ends with a user message; record 2 has user at position 1 where assistant should be.

**Complexity:** O(total messages).

**Common wrong approach:** uploading without validating and discovering the problem after a failed (or worse, a successful but wrong) training run. Also check consistency **across** records: the same system prompt and label spellings everywhere.

</details>

<details>
<summary>✅ 2. Split without leakage</summary>

```python
import random

def split_dataset(examples, test_fraction, seed):
    seen, unique = set(), []
    for example in examples:
        key = " ".join(example["input"].lower().split())
        if key not in seen:                       # keep the first of any near-duplicates
            seen.add(key)
            unique.append(example)
    random.Random(seed).shuffle(unique)           # a new list, so the input is untouched
    n_test = round(len(unique) * test_fraction)
    return unique[n_test:], unique[:n_test]

examples = [{"input": "My brakes squeal", "output": "repair"},
            {"input": "Where is order 1182?", "output": "delivery"},
            {"input": "my  brakes squeal", "output": "repair"},
            {"input": "Do you sell helmets?", "output": "sales"},
            {"input": "Chain keeps slipping", "output": "repair"}]
train, test = split_dataset(examples, 0.25, seed=7)
print(len(train), "train,", len(test), "test")
```

**Line by line**

- The normalisation matches how near-duplicates usually differ (case and spacing); real pipelines also catch paraphrases with embeddings.
- Building `unique` as a new list means shuffling it can't reorder the caller's data.
- A local `random.Random(seed)` makes the split reproducible, so results can be compared across experiments.
- `round` gives the nearest whole number of test examples (Python rounds halves to even: `round(2.5)` is 2).

**Trace** on the starter: 5 examples → 4 unique → shuffled → round(4 × 0.25) = 1 test, 3 train.

**Complexity:** O(n).

**Common wrong approach:** splitting before deduplicating, so the same ticket appears in training and test; the test score then measures memory, not skill, and looks far better than real performance.

</details>

## Quick quiz

1. Your support bot needs to answer from a policy document that changes monthly. What's the right tool?
   - A) Retrieval (RAG), so answers use the current document
   - B) Training a model from scratch
   - C) Fine-tuning on the policy each month

2. When is fine-tuning most likely to pay off?
   - A) A narrow, repetitive task with many good examples, where a smaller tuned model can replace a larger prompted one
   - B) When a better prompt already solves it
   - C) When you have 12 examples

3. What does LoRA do?
   - A) Deletes layers to make the model smaller
   - B) Adds retrieval to a model
   - C) Trains small adapter matrices while keeping the original weights frozen

4. Why remove near-duplicates before splitting train and test sets?
   - A) To make training faster
   - B) Because JSONL forbids duplicates
   - C) Otherwise the same example can appear in both, and the test score measures memorisation

<details>
<summary>Quiz answers</summary>

1. **A) Retrieval (RAG), so answers use the current document**: Fine-tuning changes behaviour; RAG supplies changing knowledge.
2. **A) A narrow, repetitive task with many good examples, where a smaller tuned model can replace a larger prompted one**: Prove the need with evals first.
3. **C) Trains small adapter matrices while keeping the original weights frozen**: Parameter-efficient fine-tuning cuts memory and cost.
4. **C) Otherwise the same example can appear in both, and the test score measures memorisation**: Leakage makes results look better than they are.

</details>

---
Previous: [Lesson 32](32-cost-and-latency.md) · Back to the [course home](../README.md)
