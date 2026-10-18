# Lesson 11: Cost, caching and batches

**You'll learn:** where the cost of an LLM application comes from, reading usage fields, cache write and read prices, prompt caching and prefix matching, automatic caching and explicit breakpoints, cache lifetimes, minimum cacheable length, what invalidates the cache, the Message Batches API, matching batch results, token counting, routing, effort, output length and other cost levers.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#cost-and-caching)**: run every example and check your exercise answers.

## Key terms

- **Prompt caching:** storing a processed prompt prefix so later requests with the same prefix are cheaper and faster.
- **Prefix:** the beginning of a request (tools, system prompt, early messages) that stays the same across calls.
- **Cache breakpoint:** the point in a request up to which content is cached.
- **Cache write and cache read:** storing a prefix (slightly dearer than normal input) and reusing it (much cheaper).
- **TTL (time to live):** how long a cached prefix lasts without being used.
- **Batch API:** submitting many requests for asynchronous processing at a discount.
- **Custom ID:** your label on each batch request, used to match results back to requests.

A prototype that costs a few cents a day can cost thousands a month in production. Cost is predictable, though: it's **tokens × price**, and a handful of techniques cut it dramatically.

## Where the money goes

Every response reports its token usage. With prompt caching in play, input is split into three parts:

```python
usage = {
    "input_tokens": 150,                  # normal input after the last cache point
    "cache_creation_input_tokens": 0,     # input written to the cache on this call
    "cache_read_input_tokens": 12000,     # input read from the cache (cheap)
    "output_tokens": 420,                 # the reply, including any thinking
}
total_input = usage["input_tokens"] + usage["cache_creation_input_tokens"] + usage["cache_read_input_tokens"]
print("total input tokens:", total_input)
```

Each part has its own price. For Claude, relative to the normal input price:

| Token type | Price |
|---|---|
| normal input | 1× |
| cache write, 5-minute lifetime | 1.25× |
| cache write, 1-hour lifetime | 2× |
| cache read | 0.1× (lower on some models: 0.05× on Opus 5.5, 0.025× on Fable 5.1) |
| output | the model's output price, usually 5× its input price |

Output is the expensive part per token, but in many applications **input dominates the bill** because every call resends a long system prompt, documents, tool definitions and the conversation history. That repeated input is exactly what caching targets.

## Prompt caching

Calls in a real application often share a long, identical **prefix**: the same system prompt, the same tool list, the same document. With **prompt caching**, the provider stores its processed form for a while; a later request that starts with the **exact same prefix** reads it from the cache, which is much cheaper and faster.

![Three requests drawn as horizontal bars. Each starts with the same long prefix (tools, system prompt, a document) and ends with a different short question. The first request writes the prefix to the cache (slightly more expensive); the second and third read it from the cache (about a tenth of the price) and pay full price only for their new question](../figures/prompt-caching.svg)

With Claude, the simplest form is **automatic caching**: one `cache_control` setting on the request, and the system places the cache point and moves it forward as a conversation grows:

```python
response = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=1024,
    cache_control={"type": "ephemeral"},          # automatic caching
    system=LONG_SHOP_POLICY,                      # identical on every call
    messages=[{"role": "user", "content": "Can I return a used helmet?"}],
)
print(response.usage.cache_creation_input_tokens, response.usage.cache_read_input_tokens)
```

You can instead mark up to **four explicit breakpoints** by putting `"cache_control": {"type": "ephemeral"}` on specific content blocks, which helps when different sections change at different rates.

The rules that decide whether you actually get cache hits:

- **Exact prefix match.** Caching covers everything up to the breakpoint, in the order **tools → system → messages**. Change one character early on (a timestamp in the system prompt, a reordered tool list, keys in a different order in JSON you send) and everything after it misses.
- **Put stable content first, variable content last**: instructions and documents at the top, the user's question at the end.
- **Lifetime:** 5 minutes by default, refreshed each time the cache is read; `{"type": "ephemeral", "ttl": "1h"}` keeps it for an hour at a higher write price.
- **Minimum length:** prefixes shorter than the model's minimum (for example 512 tokens on current Claude 5.x models, 4,096 on Haiku 4.5) aren't cached at all, with no error: you'll just see zero cache tokens.
- **Check it works:** watch `cache_read_input_tokens` in production. If it stays at 0, something in your prefix is changing.

Other providers cache too (OpenAI caches long prefixes automatically, for example); the details and discounts differ, but "stable prefix first" is always the rule.

## Batches: half price when you can wait

Many jobs don't need an instant answer: classifying a million reviews, generating test data, running an evaluation set overnight. The **Message Batches API** takes up to 100,000 requests (or 256 MB) at once and processes them asynchronously at **50% of the normal price**. Most batches finish within an hour; results are guaranteed within 24 hours and kept for 29 days.

```python
batch = client.messages.batches.create(requests=[
    {"custom_id": f"review-{i}",
     "params": {"model": "claude-haiku-4-5-20251001", "max_tokens": 50,
                "messages": [{"role": "user", "content": f"Sentiment (positive/negative/mixed): {text}"}]}}
    for i, text in enumerate(reviews)
])

# Later (poll, or check back after a while):
batch = client.messages.batches.retrieve(batch.id)
if batch.processing_status == "ended":
    for item in client.messages.batches.results(batch.id):
        if item.result.type == "succeeded":
            print(item.custom_id, item.result.message.content[0].text)
        else:
            print(item.custom_id, "failed:", item.result.type)   # errored, canceled or expired
```

Results can come back in **any order**, so match them up by `custom_id`. Caching discounts stack with the batch discount, so a shared prefix across a batch makes it cheaper still.

## Count before you send

To know a request's size before paying for it (for a long PDF, a big conversation, or to enforce a budget), use the **token-counting** endpoint. It's free (with its own rate limits):

```python
count = client.messages.count_tokens(
    model="claude-sonnet-5-5",
    system=LONG_SHOP_POLICY,
    messages=[{"role": "user", "content": "Can I return a used helmet?"}],
)
print(count.input_tokens)
```

## More ways to cut cost and latency

| Lever | Typical saving | Trade-off |
|---|---|---|
| a smaller model for easy requests (routing) | 2–10× | needs an evaluation to prove quality holds |
| lower effort | fewer output tokens, faster | may reduce quality on hard tasks |
| shorter outputs (ask for brevity, set `max_tokens`) | proportional to output | — |
| prompt caching | up to ~90% of repeated input | prefix must stay identical |
| batches | 50% | answers arrive later |
| trimming history and retrieved context | proportional to input | may drop useful context |
| caching **answers** for repeated questions in your own app | 100% on a hit | stale or mismatched answers |

The cheapest token is the one you don't send. Measure first: log the usage of every call (Part 6), then fix the biggest line on the bill.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Call cost | sum of each token type × its price, per million | O(1) | O(1) |
| Caching saving | calls × 1 − (write + (calls − 1) × read), × tokens × price | O(1) | O(1) |
| Offline bulk work | Batch API at half price; match results by custom_id | O(requests) | O(requests) |

## Common mistakes

- Putting a timestamp or other changing text at the start of a prompt, so the cache never hits.
- Caching prefixes shorter than the minimum length and expecting savings.
- Paying for a one-hour cache on a prefix used only once or twice.
- Assuming batch results come back in the same order as the requests.
- Optimising cost without logging usage to find the biggest line on the bill.

## Exercises

### 1. What did this call cost?

Write `call_cost(usage, price_in, price_out, ttl="5m", read_multiplier=0.1)` returning the cost **in dollars** of one call. Prices are in **dollars per million tokens**. `usage` has the four keys shown in the lesson:

- `input_tokens` at `price_in`,
- `cache_creation_input_tokens` at `price_in × 1.25` when `ttl` is `"5m"`, or `× 2` when it's `"1h"`,
- `cache_read_input_tokens` at `price_in × read_multiplier`,
- `output_tokens` at `price_out`.

Starter code:

```python
def call_cost(usage, price_in, price_out, ttl="5m", read_multiplier=0.1):
    pass

usage = {"input_tokens": 150, "cache_creation_input_tokens": 0,
         "cache_read_input_tokens": 12000, "output_tokens": 420}
print(round(call_cost(usage, 2.0, 10.0), 6))   # Sonnet 5.5 prices: 0.0069
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** four token types, four prices, one total in dollars.
2. **Examples:** 150 × 2 + 12,000 × 0.2 + 420 × 10 = 300 + 2,400 + 4,200 = 6,900 → $0.0069.
3. **Brute force:** it's a formula.
4. **Pattern:** **weighted sum** of counts and prices.
5. **Plan:** pick the write multiplier from `ttl` → sum → divide by a million.
6. **Code and test:** each token type alone, both lifetimes, a different read multiplier, zero usage.

</details>

<details>
<summary>💡 Hint 1</summary>

Each of the four token counts has its own price per million tokens; multiply, add them up, then divide by 1,000,000.

</details>

<details>
<summary>💡 Hint 2</summary>

The cache-write price depends on `ttl`: 1.25 × `price_in` for `"5m"`, 2 × for `"1h"`. Reads are `price_in × read_multiplier`.

</details>

<details>
<summary>💡 Hint 3</summary>

`(input × pin + writes × pin × w + reads × pin × r + output × pout) / 1_000_000`.

</details>

### 2. Does caching pay off?

A prefix of `prefix_tokens` is sent on `calls` requests (all within the cache lifetime). Write `cache_savings(prefix_tokens, calls, price_in, ttl="5m", read_multiplier=0.1, min_tokens=512)` returning the **dollars saved on the prefix** by caching it, compared with sending it uncached every time:

- Uncached: every call pays `price_in` for the prefix.
- Cached: the first call pays the write price (1.25× for `"5m"`, 2× for `"1h"`), the rest pay the read price.
- If `prefix_tokens < min_tokens`, nothing is cached, so the saving is `0.0`.

The result can be **negative** when caching costs more than it saves. Prices are per million tokens.

Starter code:

```python
def cache_savings(prefix_tokens, calls, price_in, ttl="5m", read_multiplier=0.1, min_tokens=512):
    pass

print(round(cache_savings(10_000, 100, 2.0), 4))          # 1.777
print(round(cache_savings(10_000, 2, 2.0, ttl="1h"), 4))  # -0.002: not worth it
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** compare two totals for the same prefix; the difference may be negative.
2. **Examples:** 2 calls, 1-hour cache: uncached 2×, cached 2 + 0.1 = 2.1× → a small loss.
3. **Brute force:** add up each call's cost in a loop for both strategies: fine.
4. **Pattern:** **break-even analysis**: a fixed premium paid back by per-use savings.
5. **Plan:** minimum-length guard → multipliers → difference × tokens × price.
6. **Code and test:** one call, two calls with each lifetime, below the minimum.

</details>

<details>
<summary>💡 Hint 1</summary>

Work in "multiples of the prefix's normal price" first: uncached is `calls × 1`; cached is one write plus `calls − 1` reads.

</details>

<details>
<summary>💡 Hint 2</summary>

The saving is `(uncached − cached) × prefix_tokens × price_in / 1,000,000`. Check `min_tokens` first.

</details>

<details>
<summary>💡 Hint 3</summary>

With a 5-minute cache: `cached = 1.25 + (calls - 1) * read_multiplier`; with `"1h"`, use 2.0 instead of 1.25.

</details>

**In the sandbox:** exercises 20–21. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. What did this call cost?</summary>

```python
def call_cost(usage, price_in, price_out, ttl="5m", read_multiplier=0.1):
    write_multiplier = 2.0 if ttl == "1h" else 1.25
    dollars_per_million = (
        usage["input_tokens"] * price_in
        + usage["cache_creation_input_tokens"] * price_in * write_multiplier
        + usage["cache_read_input_tokens"] * price_in * read_multiplier
        + usage["output_tokens"] * price_out
    )
    return dollars_per_million / 1_000_000

usage = {"input_tokens": 150, "cache_creation_input_tokens": 0,
         "cache_read_input_tokens": 12000, "output_tokens": 420}
print(round(call_cost(usage, 2.0, 10.0), 6))
```

**Line by line**

- The write multiplier is chosen once from `ttl`, keeping the main formula readable.
- Summing in "dollars per million" units and dividing once at the end avoids lots of tiny numbers.
- The read multiplier is a parameter because it differs between models.

**Trace** on the example: 300 + 0 + 2,400 + 4,200 = 6,900 → 6,900 / 1,000,000 = $0.0069. Without the cache, those 12,000 tokens would have cost 24,000 instead of 2,400: the call would be about four times dearer.

**Complexity:** O(1).

**Common wrong approach:** forgetting that `input_tokens` excludes the cached tokens, and so computing the cache saving from the wrong total (or adding the cached tokens twice).

</details>

<details>
<summary>✅ 2. Does caching pay off?</summary>

```python
def cache_savings(prefix_tokens, calls, price_in, ttl="5m", read_multiplier=0.1, min_tokens=512):
    if prefix_tokens < min_tokens:
        return 0.0                                        # too short: nothing is cached
    write_multiplier = 2.0 if ttl == "1h" else 1.25
    uncached = calls * 1.0
    cached = write_multiplier + (calls - 1) * read_multiplier
    return (uncached - cached) * prefix_tokens * price_in / 1_000_000

print(round(cache_savings(10_000, 100, 2.0), 4))
print(round(cache_savings(10_000, 2, 2.0, ttl="1h"), 4))
```

**Line by line**

- The guard mirrors the real behaviour: short prefixes are silently not cached, so there's neither a premium nor a saving.
- Measuring both strategies in "multiples of the normal price" makes the break-even visible: the 5-minute cache pays off from the **second** call (2 vs 1.35); the 1-hour cache from the **third** (3 vs 2.2).
- Multiplying by `prefix_tokens × price_in / 1,000,000` converts to dollars only at the end.

**Trace** for 100 calls, 5-minute cache: uncached 100; cached 1.25 + 99 × 0.1 = 11.15; saving 88.85 × 10,000 × 2 / 1,000,000 = $1.777, about 89% of the prefix's cost.

**Complexity:** O(1).

**Common wrong approach:** assuming caching always saves money. A one-off request, or a 1-hour cache used only twice, costs more than not caching.

</details>

## Quick quiz

1. Your cache_read_input_tokens stays at 0. What is the most likely cause?
   - A) Something early in the prompt changes on every call, such as a timestamp, or the prefix is below the minimum length
   - B) The output is too long
   - C) Caching only works on Fridays

2. Where should a user's question go in a cached prompt?
   - A) At the very start
   - B) In the tool definitions
   - C) At the end, after the stable instructions and documents

3. Which job suits the Batch API?
   - A) Autocomplete as the user types
   - B) Classifying 200,000 support tickets overnight
   - C) A live chat reply

4. Batch results come back. How do you match each result to its request?
   - A) By the custom_id you gave each request
   - B) By their order in the results
   - C) By the model name

<details>
<summary>Quiz answers</summary>

1. **A) Something early in the prompt changes on every call, such as a timestamp, or the prefix is below the minimum length**: Caching needs an identical prefix of at least the minimum length.
2. **C) At the end, after the stable instructions and documents**: Stable content first, variable content last.
3. **B) Classifying 200,000 support tickets overnight**: Batches are half price but asynchronous.
4. **A) By the custom_id you gave each request**: Results can arrive in any order.

</details>

---
Previous: [Lesson 10](10-reasoning-and-multimodal.md) · Next: [Lesson 12: Writing clear prompts](12-prompt-basics.md)
