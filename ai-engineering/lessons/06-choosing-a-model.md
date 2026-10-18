# Lesson 6: Choosing a model

**You'll learn:** capability, context window, output limits, latency, price per input and output token, reasoning modes, modalities, hosted versus open-weight models, model tiers, a method for choosing, cost estimates, routing.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#choosing-a-model)**: run every example and check your exercise answers.

## Key terms

- **Model tier:** a provider's range from large and capable to small, fast and cheap models.
- **Latency:** how long a response takes; often split into time to first token and tokens per second.
- **Open-weight model:** a model whose trained weights can be downloaded and run on your own hardware.
- **Hosted model:** a model you use through a provider's API or a cloud platform.
- **Routing:** sending each request to a model chosen for its difficulty or type.
- **Evaluation set:** representative examples with known good answers, used to compare models on your task.

There is no single best model. Each request has a quality bar, a latency budget and a cost budget, and the right model is usually the **cheapest and fastest one that reliably clears the quality bar on your own evaluations** (Part 6).

## What differs between models

| Property | Why it matters |
|---|---|
| **Capability** | harder reasoning, coding and long multi-step agent tasks need stronger models |
| **Context window** | how much text (documents, history, tool results) fits in one request |
| **Max output** | the longest answer it can write in one response |
| **Latency** | time to the first token, and tokens per second after that |
| **Price** | per million input and output tokens; output is usually several times dearer |
| **Reasoning / thinking** | extra thinking tokens raise quality on hard tasks, and cost and latency too; current Claude models think adaptively, controlled by an `effort` level |
| **Modalities** | text, images, PDFs, audio; which inputs and outputs are supported |
| **Tool use, structured output, caching, batch** | API features your design may rely on |
| **Hosting** | a provider's API, a cloud platform (AWS Bedrock, Google Vertex AI, Azure), or open-weight models you run yourself |

## Families and tiers

Providers usually offer a **tier** of models in each generation: a large, most capable one; a balanced middle one; and a small, fast, cheap one. As of October 2026, Anthropic's current Claude models are:

| Model | API name | Context window | Positioning |
|---|---|---|---|
| Claude Fable 5.1 | `claude-fable-5-1` | 1M tokens | demanding reasoning and long-horizon agentic work |
| Claude Opus 5.5 | `claude-opus-5-5` | 1M tokens | long-running agentic coding and knowledge work; the recommended starting point |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | 1M tokens | balance of speed and intelligence |
| Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | 200K tokens | fastest, for high-volume and latency-sensitive work |

OpenAI, Google (Gemini) and others offer similar tiers, and **open-weight** model families (from Meta, Mistral, Alibaba's Qwen, DeepSeek and others) can be downloaded and run on your own hardware. Models are updated every few months, so always check the provider's current models and pricing pages before choosing; names, prices and limits in any course will date.

## Hosted API or open weights?

| | Hosted API | Open-weight, self-hosted |
|---|---|---|
| Quality | usually the frontier | strong and improving, often a step behind |
| Effort | an API key and a few lines of code | GPUs, serving software, scaling, updates |
| Cost | pay per token | pay for hardware, whether busy or idle |
| Data | sent to the provider (check its data policies and regional options) | stays on your infrastructure |
| Customisation | prompts, tools, some fine-tuning | full fine-tuning, quantisation, any changes |

## A practical method

1. **Write down the requirements:** the task, the quality bar, the latency budget (for example, a first token within 1 second for chat), the expected volume and the budget.
2. **Start with a strong model** to see what's possible, and build a small evaluation set of real examples (Part 6).
3. **Try cheaper and faster models** on the same set; keep the cheapest one that meets the bar.
4. **Route** if requests differ: send simple requests to a small model and hard ones to a large one (a rule, a classifier, or a small model deciding).
5. **Re-evaluate** when new models appear or your traffic changes.

```python
models = [
    {"name": "large",  "quality": 0.95, "latency_s": 6.0, "price_in": 10.0, "price_out": 50.0},
    {"name": "medium", "quality": 0.91, "latency_s": 2.5, "price_in": 2.0,  "price_out": 10.0},
    {"name": "small",  "quality": 0.84, "latency_s": 0.8, "price_in": 1.0,  "price_out": 5.0},
]

def monthly_cost(m, requests, tokens_in, tokens_out):
    return requests * (tokens_in * m["price_in"] + tokens_out * m["price_out"]) / 1_000_000

for m in models:
    print(f'{m["name"]:6} quality {m["quality"]:.2f}  latency {m["latency_s"]} s  '
          f'${monthly_cost(m, 300_000, 1_500, 300):,.0f} per month')
```

The "quality" numbers here are made up: in practice they come from **your** evaluation set, because public benchmark scores rarely predict how a model does on your specific task.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Choose a model | filter by quality and latency; pick the cheapest | O(models) | O(models) |
| Monthly cost | requests × (tokens_in × price_in + tokens_out × price_out) / 1M | O(1) | O(1) |
| Routing | classify the request; send it to a small or large model | O(1) per request | — |

## Common mistakes

- Choosing by public benchmark scores instead of your own evaluation set.
- Always using the largest model, paying more and waiting longer than needed.
- Ignoring output-token prices when estimating cost.
- Hard-coding model names without a plan to update them as new models are released.

## Exercises

### 1. Pick a model

Each model is a dict with `"name"`, `"quality"`, `"latency_s"`, `"price_in"` and `"price_out"` (dollars per million tokens). Write `pick_model(models, min_quality, max_latency, tokens_in, tokens_out)` returning the name of the model that meets `quality >= min_quality` and `latency_s <= max_latency` and is **cheapest** for a request of that size (ties broken by higher quality, then by name). Return `None` if no model qualifies.

Starter code:

```python
def pick_model(models, min_quality, max_latency, tokens_in, tokens_out):
    pass

models = [
    {"name": "large",  "quality": 0.95, "latency_s": 6.0, "price_in": 10.0, "price_out": 50.0},
    {"name": "medium", "quality": 0.91, "latency_s": 2.5, "price_in": 2.0,  "price_out": 10.0},
    {"name": "small",  "quality": 0.84, "latency_s": 0.8, "price_in": 1.0,  "price_out": 5.0},
]
print(pick_model(models, 0.9, 3.0, 1_500, 300))   # medium
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** hard constraints (quality, latency), then minimise cost; tie-breakers given.
2. **Examples:** quality ≥ 0.9 and latency ≤ 3 s → only medium qualifies (large is too slow, small isn't good enough).
3. **Brute force:** check every model: it **is** the right approach for a handful of models.
4. **Pattern:** **filter, then argmin with a tuple key**.
5. **Plan:** filter list → None if empty → min by (cost, −quality, name).
6. **Code and test:** nothing qualifies, cost ties, full ties.

</details>

<details>
<summary>💡 Hint 1</summary>

First throw away every model that fails the quality or latency requirement.

</details>

<details>
<summary>💡 Hint 2</summary>

Among the rest, compute each model's cost for this request: `(tokens_in * price_in + tokens_out * price_out) / 1_000_000`.

</details>

<details>
<summary>💡 Hint 3</summary>

`min(eligible, key=lambda m: (cost(m), -m["quality"], m["name"]))` picks the cheapest, then the highest quality, then the first name. Return None if nothing is eligible.

</details>

**In the sandbox:** exercise 11. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Pick a model</summary>

```python
def pick_model(models, min_quality, max_latency, tokens_in, tokens_out):
    def cost(m):
        return (tokens_in * m["price_in"] + tokens_out * m["price_out"]) / 1_000_000
    eligible = [m for m in models if m["quality"] >= min_quality and m["latency_s"] <= max_latency]
    if not eligible:
        return None
    best = min(eligible, key=lambda m: (round(cost(m), 12), -m["quality"], m["name"]))
    return best["name"]

models = [
    {"name": "large",  "quality": 0.95, "latency_s": 6.0, "price_in": 10.0, "price_out": 50.0},
    {"name": "medium", "quality": 0.91, "latency_s": 2.5, "price_in": 2.0,  "price_out": 10.0},
    {"name": "small",  "quality": 0.84, "latency_s": 0.8, "price_in": 1.0,  "price_out": 5.0},
]
print(pick_model(models, 0.9, 3.0, 1_500, 300))
```

**Line by line**

- The list comprehension keeps only models meeting both requirements.
- `cost` turns per-million prices into the price of this request.
- The tuple key sorts by cost first; negating quality makes higher quality win ties; the name settles anything left. Rounding the cost avoids floating-point noise deciding a "tie".

**Trace** for the example (1,500 tokens in, 300 out, quality ≥ 0.9, latency ≤ 3 s):

| model | quality ok? | latency ok? | cost of this request |
|---|---|---|---|
| large | yes | no (6.0 s) | — |
| medium | yes | yes | (1,500 × 2 + 300 × 10) / 1,000,000 = $0.006 |
| small | no (0.84) | yes | — |

Only medium qualifies, so it's the answer.

**Complexity:** O(n) for n models.

**Common wrong approach:** comparing only the input price, which ignores that output tokens are several times dearer.

</details>

## Quick quiz

1. What is usually the right model for a task?
   - A) Always the largest model available
   - B) Whichever has the highest public benchmark score
   - C) The cheapest, fastest model that reliably meets your quality bar on your own evaluations

2. Why do output tokens matter so much for cost?
   - A) They're free
   - B) They're counted twice
   - C) They're typically priced several times higher than input tokens

3. What is a key advantage of running an open-weight model yourself?
   - A) It's always more capable than hosted models
   - B) It needs no hardware
   - C) Your data stays on your infrastructure and you can customise the model fully

4. What does routing mean in an LLM application?
   - A) Choosing a random model per request
   - B) Sending each request to a suitable model, such as simple ones to a small model and hard ones to a large one
   - C) Sending every request to every model

<details>
<summary>Quiz answers</summary>

1. **C) The cheapest, fastest model that reliably meets your quality bar on your own evaluations**: Benchmarks rarely match your exact task; measure.
2. **C) They're typically priced several times higher than input tokens**: Long answers, and thinking tokens, can dominate the bill.
3. **C) Your data stays on your infrastructure and you can customise the model fully**: The trade-off is the effort and cost of running it.
4. **B) Sending each request to a suitable model, such as simple ones to a small model and hard ones to a large one**: It balances quality and cost across varied traffic.

</details>

---
Previous: [Lesson 5](05-sampling.md) · Next: [Lesson 7: Requests, responses and conversations](07-messages-api.md)
