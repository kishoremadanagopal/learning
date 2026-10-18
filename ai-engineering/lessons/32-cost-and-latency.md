# Lesson 32: Cost and latency in production

**You'll learn:** the parts of request latency, time to first token, output speed, why output length dominates, agents and tool time, percentiles and tail latency, latency and cost levers, routing, effort, prompt caching, streaming, parallel calls, exact and semantic response caches, the Batch API, rate limits, capacity planning, queues, timeouts and fallbacks, projecting monthly cost.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#cost-and-latency)**: run every example and check your exercise answers.

## Key terms

- **Time to first token (TTFT):** the delay before the first output token arrives.
- **Output speed:** how many tokens per second the model generates.
- **Percentile (p95):** the value below which that percentage of measurements fall.
- **Tail latency:** the slowest requests, measured by p95 and p99.
- **Response cache:** stored answers reused for repeated questions.
- **Semantic cache:** a response cache that matches questions by meaning (embeddings) rather than exact text.
- **Fallback:** an alternative model, provider or non-AI path used when the primary fails.

A demo can take ten seconds and cost a few cents per question. A product with thousands of users can't. In production, cost and latency are features: they decide whether people wait for the answer, and whether the business can afford to give it.

## Where the time goes

![A horizontal timeline of one request: a short network and queueing segment, then input processing up to the first token (time to first token, about 0.6 s), then a long segment generating 400 output tokens at about 80 tokens per second (5 s). With streaming, the user starts reading at the first token; without it, they wait for the end](../figures/latency-anatomy.svg)

```text
total latency ≈ time to first token (TTFT) + output tokens ÷ output speed (+ tool calls and retries)
```

- **TTFT** grows with input length (longer prompts take longer to process), queueing at busy times, and thinking before the first visible token. Prompt caching cuts it for repeated prefixes.
- **Output generation** usually dominates: tokens come out one at a time, so 1,000 output tokens take many times longer than 100. **Shorter outputs are the most effective speed-up.**
- Agents multiply everything by the number of turns, plus the time tools take.

```python
def latency(ttft, output_tokens, tokens_per_second):
    return ttft + output_tokens / tokens_per_second

for tokens in (100, 400, 1500):
    print(f"{tokens:>5} output tokens: {latency(0.6, tokens, 80):.1f} s")
```

(These speeds are illustrative; measure your own model, region and prompt sizes.)

## Measure percentiles, not averages

Latency varies from request to request, and a few slow ones hurt. Report **percentiles**: p50 (the median: a typical request), **p95** and **p99** (the slow tail that some users hit every day). An average of 2 s can hide a p99 of 15 s. The first exercise computes them.

## Levers

| Lever | Speed | Cost | Trade-off |
|---|---|---|---|
| shorter outputs (instructions, `max_tokens`, structured output) | ✅✅ | ✅✅ | may lose detail |
| smaller, faster model for easy requests (routing) | ✅✅ | ✅✅ | needs evals to prove quality holds |
| lower effort | ✅ | ✅ | less reasoning on hard tasks |
| prompt caching (Lesson 11) | ✅ (TTFT) | ✅✅ on repeated input | prefix must stay identical |
| streaming | ✅ perceived | — | none for the user; more code |
| parallel calls (independent steps at once) | ✅ | — | more concurrent load |
| fewer round trips (batch tool calls, fewer agent turns) | ✅ | ✅ | design work |
| response caching (reuse answers to repeated questions) | ✅✅ on a hit | ✅✅ on a hit | stale or mismatched answers |
| Batch API (Lesson 11) | ❌ (hours) | ✅ 50% | offline only |

**Response caching** stores whole answers. An **exact** cache (after normalising case and spacing) is safe and simple; a **semantic** cache (reusing the answer to a question with a similar embedding) hits more often but can return the answer to a subtly different question. Expire entries when the underlying data changes (the second exercise).

## Rate limits and capacity

Providers limit requests and tokens per minute per organisation and model (on the Claude API, input and output tokens are limited separately). Plan for peak, not average:

- estimate peak requests per minute × tokens per request, and request higher limits ahead of launch;
- **queue** non-urgent work and smooth bursts; use the Batch API for bulk jobs;
- handle 429s with backoff (Lesson 8), and set **timeouts** so a stuck call doesn't hold a user forever;
- have a **fallback**: another model, another region or provider, or a graceful non-AI response.

## Projecting cost

```python
requests_per_day = 20_000
input_tokens, output_tokens = 3_000, 350           # per request, measured from logs
cached_share = 0.8                                 # share of input read from the prompt cache
price_in, price_out = 2.0, 10.0                    # $ per million tokens (Sonnet 5.5 list price)

input_cost = input_tokens * ((1 - cached_share) * price_in + cached_share * price_in * 0.1)
per_request = (input_cost + output_tokens * price_out) / 1_000_000
print(f"${per_request:.4f} per request, ${per_request * requests_per_day * 30:,.0f} per month")
```

Recompute this from **real logged usage** (Lesson 31) after launch; estimates made before launch are usually wrong in both directions.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Latency estimate | TTFT + output tokens ÷ tokens per second | O(1) | O(1) |
| Nearest-rank percentile | sort; value at rank ceil(p ÷ 100 × n) | O(n log n) | O(n) |
| Exact response cache | normalised key → stored time; hit if younger than the TTL | O(n) | O(distinct questions) |

## Common mistakes

- Reporting average latency instead of percentiles.
- Ignoring output length as the main driver of latency and cost.
- Caching answers that depend on the user or on live data.
- Planning capacity for average rather than peak traffic.
- Having no timeout or fallback when the model API is slow or down.

## Exercises

### 1. Latency percentiles

Write `percentiles(values, ps=(50, 95, 99))` returning a dict like `{"p50": …, "p95": …, "p99": …}` using the **nearest-rank** method: sort the values; the p-th percentile is the value at rank `ceil(p / 100 × n)` (counting from 1, and at least rank 1). Raise `ValueError` for an empty list.

Starter code:

```python
import math

def percentiles(values, ps=(50, 95, 99)):
    pass

latencies = [1.2, 0.9, 1.4, 1.1, 8.5, 1.0, 1.3, 0.8, 1.6, 12.0]
print(percentiles(latencies))    # {'p50': 1.2, 'p95': 12.0, 'p99': 12.0}
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** sort; for each p, the smallest value with at least p% of values at or below it.
2. **Examples:** 10 values, p95 → rank ceil(9.5) = 10 → the largest value (12.0).
3. **Brute force:** for each p, test every value: O(n²).
4. **Pattern:** **sort once, index by rank**.
5. **Plan:** validate → sort → ranks → dict.
6. **Code and test:** one value, 1 to 100, p0 and p100, an even count.

</details>

<details>
<summary>💡 Hint 1</summary>

Sort first. The nearest-rank method picks an actual value from the sorted list; no interpolation.

</details>

<details>
<summary>💡 Hint 2</summary>

Rank `ceil(p / 100 × n)` counts from 1, so the list index is `rank − 1`; `max(1, …)` handles p = 0.

</details>

<details>
<summary>💡 Hint 3</summary>

Build the key with `f"p{p}"`.

</details>

### 2. An exact-match response cache

Simulate a response cache and report its hit rate. Write `cache_hit_rate(requests, ttl)`, where `requests` is a list of `(time_in_seconds, question)` in time order:

- Normalise each question: lower-case and collapse whitespace (`" ".join(q.lower().split())`).
- A request is a **hit** if its normalised question is in the cache and was stored less than `ttl` seconds earlier.
- Otherwise it's a miss, and the answer is stored with the current time (replacing any expired entry). Hits don't refresh the stored time.

Return hits ÷ requests (`0.0` for no requests).

Starter code:

```python
def cache_hit_rate(requests, ttl):
    pass

requests = [(0, "What are your opening hours?"), (30, "what are your  opening hours?"),
            (90, "Do you fix e-bikes?"), (400, "What are your opening hours?")]
print(cache_hit_rate(requests, ttl=300))   # 0.25: one hit; the last request is too late
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** simulate the cache in time order; count hits.
2. **Examples:** stored at 0 with ttl 60: a request at 59 hits; at 61 it's expired → a miss that re-stores at 61; at 100, 100 − 61 = 39 < 60 → hit.
3. **Brute force:** for each request, scan all earlier ones: O(n²).
4. **Pattern:** **simulation with a dict** keyed by the normalised input.
5. **Plan:** loop → normalise → hit test → update on a miss → ratio.
6. **Code and test:** expiry at exactly ttl, refresh rules, normalisation.

</details>

<details>
<summary>💡 Hint 1</summary>

Keep a dict from normalised question to the time its answer was stored.

</details>

<details>
<summary>💡 Hint 2</summary>

A hit needs both: the key is present **and** `t - stored[key] < ttl`. Anything else is a miss.

</details>

<details>
<summary>💡 Hint 3</summary>

On a miss, set `stored[key] = t`. On a hit, change nothing.

</details>

**In the sandbox:** exercises 62–63. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Latency percentiles</summary>

```python
import math

def percentiles(values, ps=(50, 95, 99)):
    if not values:
        raise ValueError("no values")
    ordered = sorted(values)
    n = len(ordered)
    result = {}
    for p in ps:
        rank = max(1, math.ceil(p / 100 * n))
        result[f"p{p}"] = ordered[rank - 1]
    return result

latencies = [1.2, 0.9, 1.4, 1.1, 8.5, 1.0, 1.3, 0.8, 1.6, 12.0]
print(percentiles(latencies))
```

**Line by line**

- Sorting once serves every percentile.
- `math.ceil` makes p50 of 4 values rank 2 (the lower middle value), as nearest-rank defines it.
- `max(1, …)` stops p0 producing rank 0 (which would wrongly index the last element with `-1`).
- Other definitions (with interpolation, such as NumPy's default) give slightly different numbers; what matters is using one method consistently.

**Trace:** sorted = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.6, 8.5, 12.0]; p50 → rank 5 → 1.2; p95 and p99 → rank 10 → 12.0. The mean is 2.98 s, which describes nobody's experience.

**Complexity:** O(n log n).

**Common wrong approach:** reporting the mean, or p95 of a tiny sample. With 10 requests, p95 and p99 are just the slowest one; you need hundreds of requests for a stable tail estimate.

</details>

<details>
<summary>✅ 2. An exact-match response cache</summary>

```python
def cache_hit_rate(requests, ttl):
    if not requests:
        return 0.0
    stored = {}                                       # normalised question -> time stored
    hits = 0
    for t, question in requests:
        key = " ".join(question.lower().split())
        if key in stored and t - stored[key] < ttl:
            hits += 1
        else:
            stored[key] = t                           # miss: (re)fill the cache
    return hits / len(requests)

requests = [(0, "What are your opening hours?"), (30, "what are your  opening hours?"),
            (90, "Do you fix e-bikes?"), (400, "What are your opening hours?")]
print(cache_hit_rate(requests, ttl=300))
```

**Line by line**

- `" ".join(q.lower().split())` collapses runs of spaces and trims the ends, so trivial differences still hit.
- The strict `<` means an entry is expired at exactly `ttl` seconds.
- Not refreshing on hits means every entry is re-fetched at least once per `ttl`, which bounds how stale an answer can get.
- Overwriting an expired entry on a miss is the "refetch" step.

**Trace** on the starter: 0 miss (store), 30 hit, 90 miss (new question), 400 → 400 − 0 ≥ 300 → miss → 1 hit in 4 = 0.25.

**Complexity:** O(n × question length).

**Common wrong approach:** caching answers that depend on the user or on live data (an order status, stock levels). Cache only answers that are the same for everyone, include anything that changes the answer in the key, and keep the lifetime short.

</details>

## Quick quiz

1. What usually dominates the latency of a long LLM response?
   - A) Generating the output tokens, one after another
   - B) Sending the request over the network
   - C) JSON parsing

2. Why report p95 latency instead of only the average?
   - A) The average hides the slow tail that some users hit regularly
   - B) Averages can't be computed for latency
   - C) p95 is always smaller

3. What's the main risk of a semantic response cache?
   - A) Returning a cached answer to a question that's similar but different in an important way
   - B) It's slower than no cache
   - C) It can't store text

4. Traffic is expected to triple at launch. What should you plan?
   - A) Rate-limit headroom at peak, queues for non-urgent work, timeouts and a fallback
   - B) Nothing: APIs scale infinitely
   - C) Removing streaming

<details>
<summary>Quiz answers</summary>

1. **A) Generating the output tokens, one after another**: Shorter outputs are the biggest speed-up.
2. **A) The average hides the slow tail that some users hit regularly**: Percentiles describe real users' experience.
3. **A) Returning a cached answer to a question that's similar but different in an important way**: Exact caches are safer; semantic caches hit more often.
4. **A) Rate-limit headroom at peak, queues for non-urgent work, timeouts and a fallback**: Capacity planning is part of shipping.

</details>

---
Previous: [Lesson 31](31-observability.md) · Next: [Lesson 33: Prompting, RAG or fine-tuning?](33-fine-tuning-vs-rag.md)
