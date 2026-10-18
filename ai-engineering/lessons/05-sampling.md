# Lesson 5: Sampling and temperature

**You'll learn:** logits and probabilities, greedy decoding, random sampling, temperature, top-k, top-p (nucleus) sampling, max tokens, stop sequences, seeds and determinism, choosing settings by task.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#sampling)**: run every example and check your exercise answers.

## Key terms

- **Sampling:** choosing the next token at random according to the model's probabilities.
- **Greedy decoding:** always choosing the single most likely token.
- **Temperature:** a divisor applied to logits before softmax; lower is more focused, higher more varied.
- **Top-k sampling:** sampling only from the k most likely tokens.
- **Top-p (nucleus) sampling:** sampling only from the smallest set of top tokens whose probabilities reach p.
- **Stop sequence:** a string that ends generation when produced.
- **Max tokens:** the limit on how many tokens a response may contain.

At every step the model produces a **logit** (a score) for each token in its vocabulary; softmax turns them into probabilities. **Sampling** is how one token is picked. These settings are what you control when you call a model, and they change the character of the output a lot.

![Bar charts of the probabilities of five candidate next tokens at three temperatures. At temperature 0.2 almost all the probability is on the top token; at 1.0 the original distribution; at 2.0 the bars are much flatter, so unlikely tokens get picked more often](../figures/temperature.svg)

## Greedy decoding

Always take the most likely token. Deterministic for a given model and prompt, but it can be repetitive and bland, and it's not necessarily the most likely **sequence** overall.

## Temperature

Divide every logit by a **temperature** T before softmax:

- **T < 1** sharpens the distribution: the top tokens get even more likely. More focused and consistent.
- **T = 1** uses the model's own probabilities.
- **T > 1** flattens it: unlikely tokens get picked more often. More varied, and more likely to go off track.
- **T → 0** approaches greedy decoding.

```python
import math

def softmax(xs):
    m = max(xs)
    e = [math.exp(x - m) for x in xs]
    return [v / sum(e) for v in e]

tokens = [" Paris", " a", " the", " located", " beautiful"]
logits = [6.0, 2.5, 2.0, 1.5, 1.0]
for t in (0.2, 1.0, 2.0):
    probs = softmax([l / t for l in logits])
    print(f"T={t}: " + "  ".join(f"{tok.strip()}={p:.2f}" for tok, p in zip(tokens, probs)))
```

## Top-k and top-p

Even at moderate temperatures, thousands of very unlikely tokens together hold a noticeable share of the probability, and one bad pick can derail a response. Two filters cut them off before sampling:

- **Top-k:** keep only the k most likely tokens.
- **Top-p (nucleus sampling):** keep the smallest set of top tokens whose probabilities add up to at least p (say 0.9), then renormalise. It adapts: when the model is confident the set is tiny, when it's unsure the set grows.

```python
import random

def top_p(probs, p):
    ranked = sorted(probs.items(), key=lambda kv: -kv[1])
    kept, total = {}, 0.0
    for token, prob in ranked:
        kept[token] = prob
        total += prob
        if total >= p:
            break                                  # the nucleus is complete
    return {t: q / total for t, q in kept.items()} # renormalise to sum to 1

probs = {"Paris": 0.80, "Lyon": 0.08, "France": 0.05, "the": 0.04, "banana": 0.03}
nucleus = top_p(probs, 0.9)
print({t: round(q, 3) for t, q in nucleus.items()})

rng = random.Random(42)
print([rng.choices(list(nucleus), weights=list(nucleus.values()))[0] for _ in range(10)])
```

## Other generation settings

| Setting | What it does |
|---|---|
| **max tokens** | the longest output allowed; the response stops (and says why) if it's reached |
| **stop sequences** | strings that end generation early, such as `"\n\n"` or `"</answer>"` |
| **seed** (some APIs) | makes sampling repeatable, although results can still vary across model versions and hardware |

## Choosing settings (where a model exposes them)

| Task | Typical settings |
|---|---|
| Extraction, classification, code, factual Q&A | low temperature (0 to 0.3): consistent, focused |
| General assistant, explanations | the provider's default (often 1.0) |
| Brainstorming, creative writing, varied test data | higher temperature (around 1.0 or more), or several samples |

Some notes for current models:

- **Current Claude models (4.7 and later) don't accept these settings at all:** sending `temperature`, `top_p` or `top_k` with a non-default value returns an error. You steer them with the prompt, structured outputs (Lesson 9) and the `effort` setting (Lesson 10) instead. Other providers' models, and open-weight models you run yourself, still expose sampling settings, and the ideas explain what every model does internally.
- Even at temperature 0, outputs are not guaranteed to be identical every time. Design and test for some variation.
- Where both are available, providers usually recommend adjusting **either** temperature **or** top-p, not both.
- Reasoning models, and models with thinking turned on, often fix or limit sampling settings. Check the model's documentation.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Temperature | softmax(logits / T) | O(vocabulary) | O(vocabulary) |
| Top-k filter | keep the k highest probabilities; renormalise | O(V log V) | O(k) |
| Top-p filter | sort; keep the prefix reaching p; renormalise | O(V log V) | O(V) |

## Common mistakes

- Using a high temperature for extraction or classification.
- Sending temperature or top-p to current Claude models, which reject them; and adjusting both at once elsewhere without testing.
- Assuming temperature 0 makes every output identical.
- Setting max tokens too low, cutting answers off mid-sentence.

## Exercises

### 1. Apply a temperature

Write `with_temperature(logits, t)` returning the probabilities after dividing every logit by temperature `t` (> 0) and applying a numerically stable softmax.

Starter code:

```python
import math

def with_temperature(logits, t):
    pass

print(with_temperature([2.0, 1.0], 1.0))   # about [0.731, 0.269]
print(with_temperature([2.0, 1.0], 0.5))   # sharper: about [0.881, 0.119]
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** scale logits by 1/t, then softmax; t > 0.
2. **Examples:** [2, 1] at t = 0.5 → logits [4, 2] → [0.881, 0.119].
3. **Brute force:** none: it's a formula.
4. **Pattern:** **temperature scaling + stable softmax**.
5. **Plan:** divide, shift by the max, exponentiate, normalise.
6. **Code and test:** equal logits, a tiny temperature, a large one.

</details>

<details>
<summary>💡 Hint 1</summary>

Temperature is applied to the logits, before softmax.

</details>

<details>
<summary>💡 Hint 2</summary>

Divide each logit by t, then do the usual stable softmax: subtract the max, exponentiate, normalise.

</details>

<details>
<summary>💡 Hint 3</summary>

With t = 0.01, the scaled logits are 1000 and 0: without subtracting the max, `math.exp(1000)` overflows.

</details>

### 2. Nucleus (top-p) filtering

`probs` maps tokens to probabilities (summing to 1). Write `nucleus(probs, p)` that keeps the most likely tokens until their total probability reaches at least `p`, and returns them as a dict of renormalised probabilities (summing to 1). Ties in probability are broken alphabetically by token.

Starter code:

```python
def nucleus(probs, p):
    pass

print(nucleus({"Paris": 0.8, "Lyon": 0.1, "Rome": 0.06, "cat": 0.04}, 0.85))
# {'Paris': 0.888..., 'Lyon': 0.111...}
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** the smallest top set reaching p; renormalise; ties alphabetical.
2. **Examples:** p = 0.85 keeps Paris (0.8) and Lyon (total 0.9).
3. **Brute force:** try every subset: pointless, since the best set is always a prefix of the sorted list.
4. **Pattern:** **sort + running total (prefix sum)** with an early stop.
5. **Plan:** sort, accumulate until ≥ p, renormalise.
6. **Code and test:** p = 1, ties at the top, totals that hit p exactly.

</details>

<details>
<summary>💡 Hint 1</summary>

Sort the tokens from most to least likely, then add them one by one.

</details>

<details>
<summary>💡 Hint 2</summary>

Stop as soon as the running total is at least p. Then divide each kept probability by the total so they sum to 1.

</details>

<details>
<summary>💡 Hint 3</summary>

Sort with the key `lambda kv: (-kv[1], kv[0])` for "highest probability, then alphabetical". Floating-point sums like 0.25 + 0.25 are exact, but 0.1 + 0.2 isn't, so compare with a tiny tolerance.

</details>

**In the sandbox:** exercises 9–10. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Apply a temperature</summary>

```python
import math

def with_temperature(logits, t):
    scaled = [l / t for l in logits]          # T < 1 widens the gaps, T > 1 narrows them
    m = max(scaled)
    exps = [math.exp(s - m) for s in scaled]
    total = sum(exps)
    return [e / total for e in exps]

print(with_temperature([2.0, 1.0], 1.0))
print(with_temperature([2.0, 1.0], 0.5))
```

**Line by line**

- Dividing by t < 1 multiplies the gaps between logits, so softmax favours the leader more; t > 1 shrinks the gaps.
- The stable softmax from Lesson 4 keeps a tiny temperature from overflowing.
- Equal logits stay equal at any temperature.

**Trace** for [2.0, 1.0] at t = 0.5: scaled [4, 2]; shifted [0, −2]; exps [1, 0.135]; probabilities [0.881, 0.119].

**Complexity:** O(n) for n tokens.

**Common wrong approach:** dividing the probabilities (instead of the logits) by t and renormalising, which doesn't change their ratios at all.

</details>

<details>
<summary>✅ 2. Nucleus (top-p) filtering</summary>

```python
def nucleus(probs, p):
    ranked = sorted(probs.items(), key=lambda kv: (-kv[1], kv[0]))   # most likely first, ties by name
    kept, total = {}, 0.0
    for token, prob in ranked:
        kept[token] = prob
        total += prob
        if total >= p - 1e-12:            # reached p (with a tiny allowance for float rounding)
            break
    return {token: prob / total for token, prob in kept.items()}

print(nucleus({"Paris": 0.8, "Lyon": 0.1, "Rome": 0.06, "cat": 0.04}, 0.85))
```

**Line by line**

- Sorting by (−probability, token) puts the most likely tokens first and makes ties deterministic.
- Each token is added before checking the total, so at least one token is always kept.
- The loop stops at the first point the total reaches p; the result is the smallest such prefix.
- Dividing by `total` renormalises the kept probabilities.

**Trace** for p = 0.85: Paris → 0.8 (< 0.85), Lyon → 0.9 (≥ 0.85) stop; renormalised 0.889 and 0.111.

**Complexity:** O(n log n) for the sort.

**Common wrong approach:** keeping tokens whose individual probability is at least p, which is a different (and usually empty) set.

</details>

## Quick quiz

1. What does a temperature below 1 do?
   - A) Sharpens the distribution, making the most likely tokens even more likely
   - B) Makes every token equally likely
   - C) Stops the model from generating

2. What does top-p = 0.9 keep?
   - A) The 90 most likely tokens
   - B) Every token with probability at least 0.9
   - C) The smallest set of most likely tokens whose probabilities add up to at least 0.9

3. On a model that exposes sampling settings, which suit extracting fields from invoices into JSON?
   - A) A low temperature, for consistent and focused output
   - B) A high temperature, for creativity
   - C) Top-k = 1 and temperature 2.0 together

4. Does temperature 0 guarantee identical outputs on every call?
   - A) No: small variations can still occur, so systems should tolerate them
   - B) Only on weekends
   - C) Yes, always

<details>
<summary>Quiz answers</summary>

1. **A) Sharpens the distribution, making the most likely tokens even more likely**: Dividing logits by T < 1 widens the gaps before softmax.
2. **C) The smallest set of most likely tokens whose probabilities add up to at least 0.9**: The nucleus adapts to how confident the model is.
3. **A) A low temperature, for consistent and focused output**: Extraction should give the same answer every time. (On current Claude models, use structured outputs instead.)
4. **A) No: small variations can still occur, so systems should tolerate them**: Hardware and serving details can introduce tiny differences.

</details>

---
Previous: [Lesson 4](04-attention.md) · Next: [Lesson 6: Choosing a model](06-choosing-a-model.md)
