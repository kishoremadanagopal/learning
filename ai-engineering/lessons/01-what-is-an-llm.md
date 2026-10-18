# Lesson 1: What an LLM is

**You'll learn:** next-token prediction, a bigram language model from scratch, pretraining, instruction tuning and reinforcement learning from feedback, foundation models, reasoning models, strengths and weaknesses, hallucinations, where an LLM fits in software.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#what-is-an-llm)**: run every example and check your exercise answers.

## Key terms

- **Large language model (LLM):** a neural network trained on huge amounts of text to predict the next token.
- **Next-token prediction:** generating text one token at a time, each chosen from the model's predicted probabilities.
- **Pretraining:** the first training stage: predicting the next token on a vast text corpus.
- **Instruction tuning (supervised fine-tuning):** training on examples of instructions and good responses.
- **Reinforcement learning from feedback:** improving a model by rewarding preferred or verifiably correct responses.
- **Foundation model:** one general model adapted to many tasks through prompts, data and tools.
- **Knowledge cutoff:** the date after which a model has no training data.
- **Hallucination:** a fluent, confident output that is false or unsupported.

A **large language model (LLM)** is a program that has learned, from a huge amount of text, to do one thing extremely well: given some text, **predict what comes next**. Everything else (answering questions, writing code, summarising, calling tools) is built on that single skill.

When you send a model a message, it doesn't look anything up in a database of answers. It predicts the most fitting next piece of text, adds it to what's there, and repeats, one small piece (a **token**, next lesson) at a time, until it decides to stop.

![A loop: the text so far, "The capital of France is", goes into the model, which outputs probabilities for the next token (" Paris" 92%, " a" 3%, " the" 2%, …). One token is picked, appended to the text, and the longer text goes back into the model to predict the following token](../figures/next-token.svg)

## A next-word model you can build in a minute

The simplest language model counts, in some training text, which word follows which. To continue a text, it looks at the last word and picks a likely follower. Real LLMs replace the counting table with a neural network billions of times larger, look at the whole text instead of one word, and work on tokens instead of words, but the loop is the same.

```python
import random
from collections import Counter, defaultdict

text = """the cat sat on the mat . the dog sat on the rug .
the cat saw the dog . the dog saw the cat ."""

follows = defaultdict(Counter)          # word -> Counter of the words that came next
words = text.split()
for current, nxt in zip(words, words[1:]):
    follows[current][nxt] += 1

print(follows["the"])                   # what tends to follow "the"
print(follows["sat"])

def generate(start, length, seed=0):
    rng = random.Random(seed)
    out = [start]
    for _ in range(length):
        options = follows[out[-1]]
        if not options:
            break
        choices, weights = zip(*options.items())
        out.append(rng.choices(choices, weights)[0])     # sample in proportion to the counts
    return " ".join(out)

print(generate("the", 8))
print(generate("the", 8, seed=3))
```

This **bigram** model already shows the key ideas: it learned only from data, its output is **probabilistic** (a different random seed gives a different continuation), and it produces fluent-looking text with no understanding of whether it's true.

## How real LLMs are trained

| Stage | What happens | What the model gains |
|---|---|---|
| **Pretraining** | Predict the next token on trillions of tokens of web pages, books, code and more | Grammar, facts, reasoning patterns, coding ability |
| **Instruction tuning** (supervised fine-tuning) | Train on examples of instructions and good answers | Following requests, answering in a helpful format |
| **Reinforcement learning from feedback** | Reward responses that people (or reward models) prefer, and responses that solve checkable tasks | Helpfulness, honesty, safety, step-by-step reasoning |

The result is often called a **foundation model**: one general model that can be steered to many tasks with instructions (prompts), examples, retrieved documents and tools, without retraining.

Many current models can also **reason** before answering: they generate intermediate thinking tokens (sometimes hidden from the user) that work through the problem, which improves answers on maths, coding and multi-step tasks at the cost of more tokens and time.

## What LLMs are good and bad at

| Good at | Weak at, without help |
|---|---|
| Writing, rewriting, summarising, translating | Exact arithmetic on large numbers (use a calculator tool) |
| Extracting structure from messy text | Facts after their **knowledge cutoff** (give them documents or a search tool) |
| Writing and explaining code | Remembering earlier conversations (each API call is stateless) |
| Classifying, tagging, routing requests | Knowing when they don't know: they can produce confident, wrong answers (**hallucinations**) |
| Following detailed instructions and examples | Your private data (they've never seen it unless you provide it) |

Almost all of AI engineering is about the right-hand column: giving the model the **context** it lacks (Part 4), the **tools** it needs (Part 5), and **checking** its output (Part 6).

## Where an LLM sits in software

To your program, a model is a function behind an API: you send text (and possibly images, documents and tool definitions) and get text back. The engineering is everything around that call:

1. Build the **prompt**: instructions, examples, the user's input, retrieved documents.
2. **Call** the model API, handling errors, timeouts and cost.
3. **Parse and validate** the output (for example, as JSON).
4. **Act** on it: show it, store it, or call a tool and loop.
5. **Evaluate** quality over many examples, and monitor it in production.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Bigram model | count which word follows which; sample in proportion | O(n) to train | O(vocabulary pairs) |
| Greedy decoding | always pick the most likely next token | O(vocabulary) per token | O(1) |
| Fixing a knowledge gap | provide documents (RAG) or a search tool | — | — |
| An LLM feature | prompt → call → parse/validate → act → evaluate | — | — |

## Common mistakes

- Treating a model's answer as looked-up fact rather than generated text.
- Expecting the model to remember previous API calls (each call is stateless).
- Asking about recent or private information without providing it.
- Using a model for exact arithmetic instead of giving it a calculator tool.

## Exercises

### 1. Count what comes next

Write `next_word_counts(text)` that splits `text` on whitespace and returns a dict mapping each word to a dict of `{next_word: count}`: how many times each word directly followed it. The last word has nothing after it, so it only appears as a key if it also appears earlier.

Starter code:

```python
def next_word_counts(text):
    pass

print(next_word_counts("the cat sat on the mat"))
# {'the': {'cat': 1, 'mat': 1}, 'cat': {'sat': 1}, 'sat': {'on': 1}, 'on': {'the': 1}}
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** count adjacent pairs; split on any whitespace; the last word gets no entry of its own.
2. **Examples:** "a a a" → {'a': {'a': 2}}.
3. **Brute force:** loop over indexes i and look at words[i + 1]: works fine.
4. **Pattern:** **pairs of neighbours** with `zip(words, words[1:])` and a **nested counting dict**.
5. **Plan:** split, zip, count.
6. **Code and test:** a single word, empty text, irregular whitespace.

</details>

<details>
<summary>💡 Hint 1</summary>

You need every pair of neighbouring words: (word 0, word 1), (word 1, word 2), and so on.

</details>

<details>
<summary>💡 Hint 2</summary>

`zip(words, words[1:])` produces exactly those pairs. For each pair, add 1 to `counts[current][nxt]`.

</details>

<details>
<summary>💡 Hint 3</summary>

Use `counts.setdefault(current, {})` to get (or create) the inner dict, then `inner[nxt] = inner.get(nxt, 0) + 1`.

</details>

### 2. Most likely next word

Using the counts from the previous exercise (passed in as `counts`), write `predict_next(counts, word)` returning the word that most often followed `word`. If several are tied, return the alphabetically first. If `word` never appeared with a follower, return `None`. This is **greedy decoding**: always picking the single most likely next token.

Starter code:

```python
def predict_next(counts, word):
    pass

counts = {"the": {"cat": 2, "dog": 2, "mat": 1}, "cat": {"sat": 1}}
print(predict_next(counts, "the"))   # cat (tied with dog; alphabetically first)
print(predict_next(counts, "sat"))   # None
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** argmax over counts; ties → alphabetical; missing or empty → None.
2. **Examples:** {"cat": 2, "dog": 2, "mat": 1} → "cat".
3. **Brute force:** loop, tracking the best word and its count, comparing ties by string order.
4. **Pattern:** **argmax with a tie-breaking key**.
5. **Plan:** guard, then `min` with the key `(-count, word)`.
6. **Code and test:** ties, a missing word, an empty dict.

</details>

<details>
<summary>💡 Hint 1</summary>

First handle the cases where there's nothing to choose from: the word isn't a key, or its dict is empty.

</details>

<details>
<summary>💡 Hint 2</summary>

You want the highest count, and among equal counts the alphabetically smallest word. One sort key can express both.

</details>

<details>
<summary>💡 Hint 3</summary>

`min(options, key=lambda w: (-options[w], w))`: negating the count makes the largest count come first, and the word breaks ties.

</details>

**In the sandbox:** exercises 1–2. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Count what comes next</summary>

```python
def next_word_counts(text):
    words = text.split()                     # split() handles any whitespace
    counts = {}
    for current, nxt in zip(words, words[1:]):
        inner = counts.setdefault(current, {})
        inner[nxt] = inner.get(nxt, 0) + 1
    return counts

print(next_word_counts("the cat sat on the mat"))
```

**Line by line**

- `text.split()` with no argument splits on runs of spaces, tabs and newlines, and ignores leading and trailing whitespace.
- `zip(words, words[1:])` pairs each word with the one after it; with fewer than two words it produces nothing.
- `setdefault` returns the inner dict for `current`, creating it the first time.
- `inner.get(nxt, 0) + 1` increments the count, starting from 0.

**Trace** on "to be or not to be":

| pair | counts after |
|---|---|
| (to, be) | to: {be: 1} |
| (be, or) | be: {or: 1} |
| (or, not) | or: {not: 1} |
| (not, to) | not: {to: 1} |
| (to, be) | to: {be: **2**} |

**Complexity:** O(n) for n words.

**Common wrong approach:** `text.split(" ")`, which produces empty strings for double spaces and keeps newlines inside words.

</details>

<details>
<summary>✅ 2. Most likely next word</summary>

```python
def predict_next(counts, word):
    options = counts.get(word)
    if not options:
        return None                                     # unseen word, or nothing ever followed it
    return min(options, key=lambda w: (-options[w], w)) # highest count first, then alphabetical

counts = {"the": {"cat": 2, "dog": 2, "mat": 1}, "cat": {"sat": 1}}
print(predict_next(counts, "the"))
print(predict_next(counts, "sat"))
```

**Line by line**

- `counts.get(word)` returns None for an unseen word; `not options` is also true for an empty dict.
- Tuples compare element by element, so `(-count, word)` orders by count descending, then by word ascending.
- `min` over the dict iterates its keys and returns the key with the smallest tuple.

**Trace** on {"cat": 2, "dog": 2, "mat": 1}: keys map to (−2, "cat"), (−2, "dog"), (−1, "mat"); the smallest is (−2, "cat").

**Complexity:** O(k) for k distinct followers.

**Common wrong approach:** `max(options, key=options.get)`, which returns whichever tied word comes first in the dict, not the alphabetically first one.

</details>

## Quick quiz

1. At its core, what does a large language model do?
   - A) Predicts the next token given the text so far, repeatedly
   - B) Runs a search engine query for every question
   - C) Looks up answers in a database of facts

2. Which training stage teaches a model to follow instructions and answer helpfully?
   - A) Pretraining on web text alone
   - B) Instruction tuning (supervised fine-tuning), refined with reinforcement learning from feedback
   - C) Tokenization

3. Why might a model answer a question about last month's news wrongly?
   - A) Models can only answer questions about code
   - B) Its knowledge stops at its training cutoff unless you give it the information
   - C) Because of the temperature setting

4. What is a hallucination?
   - A) A fluent, confident answer that isn't true or isn't supported by the sources
   - B) A very long answer
   - C) A refusal to answer

<details>
<summary>Quiz answers</summary>

1. **A) Predicts the next token given the text so far, repeatedly**: Every capability is built on next-token prediction, one token at a time.
2. **B) Instruction tuning (supervised fine-tuning), refined with reinforcement learning from feedback**: Pretraining gives knowledge and language; tuning shapes behaviour.
3. **B) Its knowledge stops at its training cutoff unless you give it the information**: Retrieval (RAG) or a search tool supplies current information.
4. **A) A fluent, confident answer that isn't true or isn't supported by the sources**: Next-token prediction optimises for plausible text, not verified truth.

</details>

---
Back to the [course home](../README.md) · Next: [Lesson 2: Tokens and tokenization](02-tokens.md)
