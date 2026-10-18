# Lesson 31: Tracing and monitoring

**You'll learn:** why LLM applications need observability, traces and spans, waterfalls, what to record for requests, model calls, retrieval and tools, user feedback, OpenTelemetry generative-AI conventions, LLM observability tools, privacy, redaction and retention, online evaluation of live traffic, dashboards, alerts, turning traces into eval cases.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#observability)**: run every example and check your exercise answers.

## Key terms

- **Observability:** recording enough about each request to explain its behaviour afterwards.
- **Trace:** the record of one request, made of nested spans.
- **Span:** one timed step of a request, with a name, a parent and attributes.
- **Waterfall:** a chart of spans on a timeline showing where time was spent.
- **OpenTelemetry:** an open standard and toolkit for traces, metrics and logs.
- **Online evaluation:** grading a sample of live production traffic.

Once real users arrive, things go wrong that no eval predicted: a question type you never tested, a document that confuses retrieval, a tool that times out at peak hours, a cost spike from one runaway agent. **Observability** means recording enough about every request to answer "what happened, and why?" afterwards.

## Traces and spans

A **trace** records one request end to end. It's made of **spans**: timed steps with a name, a parent and attributes. A RAG chat request might look like this:

![A waterfall chart of one request lasting about 3.2 seconds. The root span "chat request" spans the whole bar. Beneath it: "rewrite query" (an LLM call, 0.4 s), "retrieve" (0.3 s) with children "bm25 search" and "vector search" running in parallel, "rerank" (0.18 s), and "generate answer" (an LLM call, 2.2 s, the longest). Each LLM span lists its model and token counts](../figures/trace-waterfall.svg)

The waterfall shows at a glance where the time went (here, mostly generating the answer) and which step failed when something breaks.

## What to record

| Span | Record |
|---|---|
| every request | user or session ID (pseudonymous), prompt **version**, app version, total latency, outcome |
| model calls | model, parameters (effort, max tokens), input and output tokens (including cache reads and writes), cost, stop reason, time to first token, request ID |
| retrieval | the query, the IDs and scores of retrieved chunks, the index version |
| tool calls | tool name, arguments, result size, errors, approval decisions |
| feedback | thumbs up or down, corrections, whether the user rephrased |

**OpenTelemetry**, the open standard for traces, has semantic conventions for generative AI (attributes such as `gen_ai.request.model` and `gen_ai.usage.input_tokens`), so traces can go to any compatible backend. Dedicated LLM observability tools (Langfuse, LangSmith, Arize Phoenix, Braintrust, Helicone, Weights & Biases Weave and others) add prompt and response viewers, cost tracking, evaluation and dataset features on top.

A tiny tracer shows the idea:

```python
import time
from contextlib import contextmanager

spans, stack = [], []

@contextmanager
def span(name, **attributes):
    record = {"id": len(spans) + 1, "parent": stack[-1] if stack else None, "name": name, **attributes}
    spans.append(record)
    stack.append(record["id"])
    start = time.perf_counter()
    try:
        yield record
    finally:
        record["ms"] = round((time.perf_counter() - start) * 1000, 1)
        stack.pop()

with span("chat request"):
    with span("retrieve", k=20):
        sum(range(200_000))                     # stand-in for real work
    with span("generate", model="claude-sonnet-5-5") as s:
        sum(range(400_000))
        s["output_tokens"] = 180

for record in spans:
    extra = {k: v for k, v in record.items() if k not in ("id", "parent", "name", "ms")}
    print(f"span {record['id']} (parent {record['parent']}): {record['name']} {extra}")
```

## Privacy and retention

Prompts and responses often contain personal data. Decide deliberately:

- **What to store:** full text for debugging, or only metadata (tokens, latency, IDs) for most requests and full text for a sample.
- **Redaction** of personal data before logging (Lesson 16).
- **Retention:** how long logs live, who can read them, and how a user's data is deleted on request.

## Online evaluation and alerts

- Run **code checks and model judges on a sample of live traffic** (faithfulness, tone, refusals), not just on your eval set.
- **Dashboards:** request volume, latency percentiles (Lesson 32), error and refusal rates, cost per day and per user, cache hit rate, feedback rates.
- **Alerts** on sudden changes: error spikes, p95 latency, cost per hour, a drop in thumbs-up rate.
- **Close the loop:** turn interesting production failures into eval cases (Lesson 28). Traces are the best source of realistic test data you'll ever have.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Trace tree | group spans by parent; depth-first walk from the roots | O(n) | O(n) |
| Trace summary | counts and sums with defaults; the slowest span | O(n) | O(1) |
| Production loop | trace → dashboards and alerts → sample and grade → new eval cases | — | — |

## Common mistakes

- Logging only errors, so normal-but-wrong answers leave no trace.
- Not recording which prompt and model version produced an answer.
- Storing full prompts and responses with personal data and no retention policy.
- Assuming child spans arrive after their parents.
- Never turning production failures into eval cases.

## Exercises

### 1. Draw a trace tree

Write `trace_tree(spans)` returning a list of text lines that show the spans as an indented tree. Each span is a dict with `"id"`, `"parent"` (another span's id, or `None`), `"name"` and `"ms"`. Each line is two spaces per level of depth followed by `f"{name} ({ms} ms)"`. Roots (parent `None`, or a parent that isn't in the list) come first in input order; each span's children follow it, in input order.

Starter code:

```python
def trace_tree(spans):
    pass

spans = [{"id": 1, "parent": None, "name": "chat request", "ms": 3200},
         {"id": 2, "parent": 1, "name": "retrieve", "ms": 300},
         {"id": 3, "parent": 2, "name": "bm25 search", "ms": 120},
         {"id": 4, "parent": 2, "name": "vector search", "ms": 180},
         {"id": 5, "parent": 1, "name": "generate answer", "ms": 2200}]
print("\n".join(trace_tree(spans)))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** spans form a tree via parent ids; print it depth-first with indentation.
2. **Examples:** a child listed before its parent still appears under it.
3. **Brute force:** for each span, scan the whole list for its children: O(n²).
4. **Pattern:** **adjacency list + depth-first traversal** (a pre-order walk).
5. **Plan:** ids → children map and roots → recursive walk → lines.
6. **Code and test:** nesting, out-of-order input, several roots, orphans, empty input.

</details>

<details>
<summary>💡 Hint 1</summary>

First group spans by parent: a dict from parent id to the list of its children (in input order). Spans with no valid parent are roots.

</details>

<details>
<summary>💡 Hint 2</summary>

Then walk the tree depth-first from each root, adding a line for each span before its children.

</details>

<details>
<summary>💡 Hint 3</summary>

A recursive helper `walk(span, depth)` appends `"  " * depth + f"{name} ({ms} ms)"` and calls itself for each child with `depth + 1`.

</details>

### 2. Summarise a trace

Write `trace_summary(spans)`. Each span has `"name"`, `"kind"` (such as `"llm"`, `"tool"` or `"retrieval"`) and `"ms"`, and may have `"input_tokens"`, `"output_tokens"`, `"cost"` and `"error"` (a bool). Return:

```text
{"llm_calls": number of "llm" spans, "tool_calls": number of "tool" spans,
 "tokens": total input + output tokens, "cost": total cost rounded to 6 decimals,
 "errors": number of spans with "error" True, "slowest": name of the span with the largest "ms"}
```

Missing numbers count as 0; `"slowest"` is the **first** such span on a tie, or `None` for no spans.

Starter code:

```python
def trace_summary(spans):
    pass

spans = [{"name": "rewrite query", "kind": "llm", "ms": 400, "input_tokens": 300, "output_tokens": 40, "cost": 0.0010},
         {"name": "retrieve", "kind": "retrieval", "ms": 300},
         {"name": "get_stock", "kind": "tool", "ms": 900, "error": True},
         {"name": "generate answer", "kind": "llm", "ms": 2200, "input_tokens": 5200, "output_tokens": 350, "cost": 0.0139}]
print(trace_summary(spans))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a handful of aggregates over a list of dicts with optional fields.
2. **Examples:** tokens = 300 + 40 + 5,200 + 350 = 5,890; cost = 0.0010 + 0.0139 = 0.0149.
3. **Brute force:** this is already one pass per aggregate.
4. **Pattern:** **aggregate with defaults**.
5. **Plan:** slowest → counts → sums with `.get` → round the cost.
6. **Code and test:** empty input, ties, missing fields, float rounding.

</details>

<details>
<summary>💡 Hint 1</summary>

`s.get("input_tokens", 0)` treats a missing field as 0; the same works for cost, and `s.get("error")` is falsy when missing.

</details>

<details>
<summary>💡 Hint 2</summary>

Counting with a condition: `sum(1 for s in spans if s["kind"] == "llm")`.

</details>

<details>
<summary>💡 Hint 3</summary>

For the slowest span, loop and replace your current best only when `s["ms"] > best["ms"]` (strictly greater keeps the first on ties). `max(spans, key=...)` also returns the first maximum.

</details>

**In the sandbox:** exercises 60–61. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Draw a trace tree</summary>

```python
def trace_tree(spans):
    ids = {s["id"] for s in spans}
    children = {}
    roots = []
    for s in spans:
        if s["parent"] is None or s["parent"] not in ids:
            roots.append(s)
        else:
            children.setdefault(s["parent"], []).append(s)

    lines = []
    def walk(s, depth):
        lines.append("  " * depth + f"{s['name']} ({s['ms']} ms)")
        for child in children.get(s["id"], []):
            walk(child, depth + 1)
    for root in roots:
        walk(root, 0)
    return lines

spans = [{"id": 1, "parent": None, "name": "chat request", "ms": 3200},
         {"id": 2, "parent": 1, "name": "retrieve", "ms": 300},
         {"id": 3, "parent": 2, "name": "bm25 search", "ms": 120},
         {"id": 4, "parent": 2, "name": "vector search", "ms": 180},
         {"id": 5, "parent": 1, "name": "generate answer", "ms": 2200}]
print("\n".join(trace_tree(spans)))
```

**Line by line**

- Building the `children` dict first means the input order of parents and children doesn't matter.
- `s["parent"] not in ids` turns an orphan (its parent span was lost or sampled out) into a root rather than dropping it.
- The pre-order walk prints a span before its children, which is how trace viewers show them.
- Depth controls the indentation; two spaces per level.

**Trace:** chat request (depth 0) → retrieve (1) → bm25 search (2), vector search (2) → generate answer (1).

**Complexity:** O(n).

**Common wrong approach:** assuming parents always appear before children. Spans are usually recorded when they **finish**, so children often arrive first.

</details>

<details>
<summary>✅ 2. Summarise a trace</summary>

```python
def trace_summary(spans):
    slowest = None
    for s in spans:
        if slowest is None or s["ms"] > slowest["ms"]:
            slowest = s                                   # strict > keeps the first on a tie
    return {
        "llm_calls": sum(1 for s in spans if s["kind"] == "llm"),
        "tool_calls": sum(1 for s in spans if s["kind"] == "tool"),
        "tokens": sum(s.get("input_tokens", 0) + s.get("output_tokens", 0) for s in spans),
        "cost": round(sum(s.get("cost", 0) for s in spans), 6),
        "errors": sum(1 for s in spans if s.get("error")),
        "slowest": slowest["name"] if slowest else None,
    }

spans = [{"name": "rewrite query", "kind": "llm", "ms": 400, "input_tokens": 300, "output_tokens": 40, "cost": 0.0010},
         {"name": "retrieve", "kind": "retrieval", "ms": 300},
         {"name": "get_stock", "kind": "tool", "ms": 900, "error": True},
         {"name": "generate answer", "kind": "llm", "ms": 2200, "input_tokens": 5200, "output_tokens": 350, "cost": 0.0139}]
print(trace_summary(spans))
```

**Line by line**

- `.get(field, 0)` handles spans that don't carry tokens or cost (retrieval and tools usually don't).
- Rounding the summed cost hides floating-point noise such as 0.30000000000000004.
- `s.get("error")` is `None` for spans without the field, which counts as not an error.
- The slowest span tells you where to look first when a request is slow.

**Trace:** two LLM spans, one tool span (which errored), 5,890 tokens, $0.0149, slowest "generate answer" at 2,200 ms.

**Complexity:** O(n).

**Common wrong approach:** summing only the root span's latency and the final model call's tokens. Multi-step requests spend tokens and time in many places; summaries like this per request, aggregated across requests, show where the money and time really go.

</details>

## Quick quiz

1. What is a span in a trace?
   - A) One timed step of a request, such as a model call or a tool call, with a parent and attributes
   - B) A whole day of logs
   - C) A user's session

2. Why record the prompt version with every request?
   - A) It reduces cost
   - B) The API requires it
   - C) To trace a bad answer back to the exact prompt that produced it, and compare versions

3. What should you do with interesting production failures?
   - A) Ignore them unless a user complains twice
   - B) Delete them
   - C) Turn them into eval cases so they're tested from now on

4. Why decide what text to store in traces?
   - A) Prompts and responses may contain personal data, which needs redaction, retention limits and access control
   - B) Text is too large to store
   - C) Tracing tools can't store text

<details>
<summary>Quiz answers</summary>

1. **A) One timed step of a request, such as a model call or a tool call, with a parent and attributes**: A trace is a tree of spans.
2. **C) To trace a bad answer back to the exact prompt that produced it, and compare versions**: Prompts are code; log which version ran.
3. **C) Turn them into eval cases so they're tested from now on**: Production traces are the best test data.
4. **A) Prompts and responses may contain personal data, which needs redaction, retention limits and access control**: Observability and privacy must be designed together.

</details>

---
Previous: [Lesson 30](30-hallucinations.md) · Next: [Lesson 32: Cost and latency in production](32-cost-and-latency.md)
