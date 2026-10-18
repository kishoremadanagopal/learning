# Lesson 24: The agent loop

**You'll learn:** workflows versus agents, when to use an agent, the agent loop, stopping conditions, turn limits, budgets and timeouts, other stop reasons, SDK tool runners, the Claude Agent SDK and other agent frameworks, tools and environment feedback, plans and checkpoints, reading transcripts, detecting stuck agents, orchestrator-worker and evaluator-optimiser patterns.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#agent-loop)**: run every example and check your exercise answers.

## Key terms

- **Agent:** a system where a model decides its next action in a loop, using tools and feedback.
- **Workflow:** a fixed sequence of model calls and tools defined by your code.
- **Agent loop:** call the model, run any requested tools, append the results, repeat until it stops.
- **Turn limit:** the maximum number of model calls an agent may make for one task.
- **Orchestrator-workers:** a lead agent splitting a task among sub-agents and combining their results.
- **Evaluator-optimiser:** one model producing and another critiquing, in a loop.

One tool call answers one question. An **agent** keeps going: it calls a tool, reads the result, decides what to do next, and repeats until the task is done. Searching a codebase, fixing a failing test, researching a question across several sources, reconciling two spreadsheets: tasks where the steps can't be known in advance.

## Workflows and agents

Anthropic's widely cited guide *Building effective agents* draws a useful line:

- **Workflows:** your code fixes the sequence of model calls and tools (the chains, routing and parallel patterns from Lesson 14). Predictable, testable, cheaper.
- **Agents:** the **model** decides the next step, in a loop, using tools and feedback from its environment. Flexible, but less predictable, slower, costlier, and errors can compound.

The guide's advice: **use the simplest thing that works**. Many "agents" are better as workflows. Choose an agent when the task is open-ended, the number of steps is unknown, and you can trust the model's decisions in that environment (with checks, Lesson 27).

## The loop

![A cycle: the model receives the conversation and tools; if it asks for tools, your code runs them and appends the results, and the loop repeats; if it doesn't, the loop ends with its answer. Guards on the loop: a turn limit, a budget, and a check for repeated calls](../figures/agent-loop.svg)

At its core an agent is a short loop around the tool cycle from Lesson 23:

```python
def fake_model(messages):
    """Scripted stand-in: checks stock, then answers."""
    last = messages[-1]["content"]
    if isinstance(last, str):                                  # the user's question
        return {"stop_reason": "tool_use", "content": [
            {"type": "tool_use", "id": "t1", "name": "get_stock", "input": {"shop": "bath"}}]}
    stock = last[0]["content"]                                 # a tool result
    return {"stop_reason": "end_turn", "content": [{"type": "text", "text": f"Bath has {stock} in stock."}]}

tools = {"get_stock": lambda shop: {"bath": 6, "bristol": 0}[shop]}
messages = [{"role": "user", "content": "Any 29-inch tyres in Bath?"}]

for turn in range(1, 6):                                       # never loop forever
    reply = fake_model(messages)
    messages.append({"role": "assistant", "content": reply["content"]})
    if reply["stop_reason"] != "tool_use":
        break
    results = [{"type": "tool_result", "tool_use_id": b["id"], "content": str(tools[b["name"]](**b["input"]))}
               for b in reply["content"] if b["type"] == "tool_use"]
    messages.append({"role": "user", "content": results})
    print(f"turn {turn}: ran {[b['name'] for b in reply['content'] if b['type'] == 'tool_use']}")

print(reply["content"][-1]["text"], f"({len(messages)} messages)")
```

Every real agent adds guards around this loop:

- a **maximum number of turns**, and a **token or cost budget** (Lesson 27);
- **timeouts** on each tool;
- detection of a **stuck** agent repeating the same call (the second exercise);
- handling of other stop reasons: `max_tokens` (continue or fail), `pause_turn` (a server tool paused: send the conversation back), `refusal`.

## You don't always write the loop

- The Anthropic SDK's **tool runner** runs this loop for you around plain Python functions.
- The **Claude Agent SDK** packages the harness behind Claude Code (file, shell and web tools, permissions, context management, sub-agents) as a library.
- Other frameworks include the **OpenAI Agents SDK**, **LangGraph**, **Pydantic AI** and **CrewAI**.

Frameworks save boilerplate, but they also hide the prompts and the loop. Understand the loop first; then a framework's behaviour (and bugs) make sense.

## Making agents work well

- **Good tools matter more than clever prompts** (Lesson 23): clear names, compact outputs, actionable errors.
- **Ground truth from the environment:** let the agent run the tests, read the error, check the page. Feedback it can verify beats its own guesses.
- **Plans and notes:** for long tasks, have it write a short plan or to-do list and update it as it goes (Lesson 26).
- **Checkpoints:** ask a human to approve the plan, or any irreversible step (Lesson 27).
- **Read the transcripts.** Most agent bugs are visible in the conversation: a misleading tool description, a confusing error, a missing tool.

## More than one agent

Some tasks split naturally between agents:

- **Orchestrator and workers:** a lead agent breaks a task into parts and hands each to a sub-agent with its own fresh context, then combines their results. Good for broad research, where parts can run in parallel.
- **Evaluator and optimiser:** one agent produces, another critiques against criteria, and they iterate (Lesson 14's draft-review-refine, made autonomous).

Multi-agent systems use many more tokens and are harder to debug. Reach for them when the task is genuinely parallel or too big for one context window.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Agent loop | model → tools → results → repeat; stop on a non-tool reply or the limit | O(turns) calls | O(history) |
| Stuck detection | last k calls identical, or the last 2k alternate | O(k) | O(k) |
| Choose a design | workflow if the steps are known; agent if they aren't | — | — |

## Common mistakes

- Building an agent where a simple workflow would do.
- Looping with no turn limit or budget.
- Stopping an agent just because it reuses a tool with different inputs.
- Adopting a framework without understanding the loop it hides.
- Using many agents for a task one agent handles well.

## Exercises

### 1. Write an agent loop

Write `run_agent(model, tools, question, max_turns=5)`. `model(messages)` returns a dict with `"stop_reason"` and `"content"` (a list of blocks); `tools` maps names to functions.

1. Start with `messages = [{"role": "user", "content": question}]`.
2. Each turn: call `model(messages)` and append `{"role": "assistant", "content": reply["content"]}`.
3. If `reply["stop_reason"]` isn't `"tool_use"`, return `(text, messages)`, where `text` joins the reply's text blocks.
4. Otherwise run every `tool_use` block, in order, and append one user message whose content is the list of results: `{"type": "tool_result", "tool_use_id": id, "content": str(result)}`, or for an unknown tool or an exception, `{"type": "tool_result", "tool_use_id": id, "content": "Error: <message>", "is_error": True}`, where the message is `Unknown tool: <name>` or `str(e)`.
5. After `max_turns` model calls without finishing, return `("Stopped: turn limit reached", messages)`.

Starter code:

```python
def run_agent(model, tools, question, max_turns=5):
    pass

def model(messages):
    if len(messages) == 1:
        return {"stop_reason": "tool_use", "content": [
            {"type": "tool_use", "id": "t1", "name": "get_stock", "input": {"shop": "bath"}}]}
    return {"stop_reason": "end_turn", "content": [{"type": "text", "text": "Bath has 6 in stock."}]}

answer, messages = run_agent(model, {"get_stock": lambda shop: 6}, "Tyres in Bath?")
print(answer, len(messages))   # Bath has 6 in stock. 4
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** call → record → stop or run tools → record results → repeat, at most `max_turns` times.
2. **Examples:** two parallel calls produce **one** user message holding two results.
3. **Brute force:** hard-coding two rounds: breaks on tasks needing more steps.
4. **Pattern:** **the agent loop**: a bounded loop with the environment's feedback appended each time.
5. **Plan:** initial messages → loop (model, append, stop check, tools, append) → limit message.
6. **Code and test:** no tools needed, parallel calls, errors, the turn limit, other stop reasons.

</details>

<details>
<summary>💡 Hint 1</summary>

A `for` loop over `range(max_turns)` gives the turn limit for free; the code after the loop handles running out of turns.

</details>

<details>
<summary>💡 Hint 2</summary>

Append the assistant message **before** deciding whether to stop, so the history always includes the final reply.

</details>

<details>
<summary>💡 Hint 3</summary>

Build the results list with one entry per `tool_use` block, using `try` / `except Exception as e`. For an unknown name, raise an exception with the message `Unknown tool: <name>` so both error cases share one code path.

</details>

### 2. Spot a stuck agent

Agents sometimes get stuck repeating themselves. Write `is_stuck(calls, limit=3)`, where `calls` is the list of tool calls so far as `(name, input)` pairs, oldest first. Return `True` if:

- the last `limit` calls are all **identical** (same name and same input), or
- the last `2 × limit` calls **alternate** between two different calls (A, B, A, B, …).

Otherwise (including when there aren't enough calls) return `False`.

Starter code:

```python
def is_stuck(calls, limit=3):
    pass

search = ("search", {"q": "tyre pressure"})
read = ("read_page", {"url": "https://example.com/a"})
print(is_stuck([search, search, search]))       # True
print(is_stuck([search, read] * 3))             # True: ping-pong
print(is_stuck([search, read, search]))         # False
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** two patterns at the end of the history: a run of identical calls, or a two-call ping-pong.
2. **Examples:** `[A, A, A, A, A, A]` is caught by the first rule; the alternation rule requires A ≠ B.
3. **Brute force:** searching the whole history for cycles of any length: possible, but more than a guard needs.
4. **Pattern:** **check a sliding window** at the end of a sequence.
5. **Plan:** identical run → alternating window → `False`.
6. **Code and test:** short lists, different inputs, limit 2, broken patterns.

</details>

<details>
<summary>💡 Hint 1</summary>

Look only at the end of the list: `calls[-limit:]` and `calls[-2 * limit:]`. Check the length first, since a short list gives a shorter slice.

</details>

<details>
<summary>💡 Hint 2</summary>

Tuples containing dicts compare with `==` element by element, so `call == recent[0]` checks both name and input.

</details>

<details>
<summary>💡 Hint 3</summary>

For alternation, take the window's first two calls `a` and `b` (which must differ), then check every even position equals `a` and every odd one equals `b`.

</details>

**In the sandbox:** exercises 46–47. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Write an agent loop</summary>

```python
def run_agent(model, tools, question, max_turns=5):
    messages = [{"role": "user", "content": question}]
    for _ in range(max_turns):
        reply = model(messages)
        messages.append({"role": "assistant", "content": reply["content"]})
        if reply["stop_reason"] != "tool_use":
            text = "".join(b["text"] for b in reply["content"] if b["type"] == "text")
            return text, messages
        results = []
        for block in reply["content"]:
            if block["type"] != "tool_use":
                continue
            try:
                if block["name"] not in tools:
                    raise LookupError(f"Unknown tool: {block['name']}")
                output = tools[block["name"]](**block["input"])
                results.append({"type": "tool_result", "tool_use_id": block["id"], "content": str(output)})
            except Exception as e:
                results.append({"type": "tool_result", "tool_use_id": block["id"],
                                "content": f"Error: {e}", "is_error": True})
        messages.append({"role": "user", "content": results})
    return "Stopped: turn limit reached", messages

def model(messages):
    if len(messages) == 1:
        return {"stop_reason": "tool_use", "content": [
            {"type": "tool_use", "id": "t1", "name": "get_stock", "input": {"shop": "bath"}}]}
    return {"stop_reason": "end_turn", "content": [{"type": "text", "text": "Bath has 6 in stock."}]}

answer, messages = run_agent(model, {"get_stock": lambda shop: 6}, "Tyres in Bath?")
print(answer, len(messages))
```

**Line by line**

- The loop variable isn't needed (`_`): the range only bounds the number of model calls.
- Any stop reason other than `tool_use` ends the loop. Production code would treat `max_tokens` or `refusal` specially; this version returns whatever text there is.
- All results from one reply go into a **single** user message, which is what the API expects for parallel calls.
- Errors become `is_error` results with a short message, so the model sees what went wrong and can adapt.

**Trace** on the starter: turn 1 → `tool_use` → result "6" appended (3 messages); turn 2 → `end_turn` → the reply is appended (4 messages) and its text returned.

**Complexity:** O(turns) model calls; the conversation grows every turn, so later calls cost more (Lesson 26).

**Common wrong approach:** a `while True` loop with no limit. A confused model can call tools forever, and each turn resends the whole growing history.

</details>

<details>
<summary>✅ 2. Spot a stuck agent</summary>

```python
def is_stuck(calls, limit=3):
    recent = calls[-limit:]
    if len(recent) == limit and all(call == recent[0] for call in recent):
        return True
    window = calls[-2 * limit:]
    if len(window) == 2 * limit:
        a, b = window[0], window[1]
        if a != b and all(call == (a if i % 2 == 0 else b) for i, call in enumerate(window)):
            return True
    return False

search = ("search", {"q": "tyre pressure"})
read = ("read_page", {"url": "https://example.com/a"})
print(is_stuck([search, search, search]))
print(is_stuck([search, read] * 3))
print(is_stuck([search, read, search]))
```

**Line by line**

- Slicing from the end (`calls[-limit:]`) never fails, even on short lists; the length check rules out partial windows.
- Comparing whole `(name, input)` tuples means `search` with a different query isn't a repeat: the agent may be refining its search.
- `i % 2` picks which of the two calls each position should be.
- Longer cycles (A, B, C, A, B, C) aren't detected; a turn limit and a budget still catch those eventually.

**Trace** for `[A, B] * 3`: the last 3 are B, A, B → not identical; the last 6 alternate A, B with A ≠ B → `True`.

**Complexity:** O(limit).

**Common wrong approach:** stopping as soon as the same **tool** is used twice. Calling search several times with different queries is normal, productive behaviour; only identical repeats signal a loop. When it triggers, don't just kill the agent: tell it ("You've made this exact call three times; try a different approach or ask the user").

</details>

## Quick quiz

1. What distinguishes an agent from a workflow?
   - A) Workflows can't call models
   - B) In an agent, the model decides the next step in a loop; in a workflow, your code fixes the sequence
   - C) Agents never use tools

2. Why must an agent loop have a turn limit?
   - A) Tools stop working after a while
   - B) The API allows only five tool calls
   - C) A confused model could otherwise call tools forever, with each turn costing more

3. Several tool_use blocks arrive in one reply. How are their results returned?
   - A) One message per result
   - B) Only the first result is needed
   - C) In one user message containing a tool_result for each call

4. When is a multi-agent design worth its extra cost?
   - A) Always: more agents are always better
   - B) For simple single-step questions
   - C) When the task splits into parallel parts or exceeds one context window

<details>
<summary>Quiz answers</summary>

1. **B) In an agent, the model decides the next step in a loop; in a workflow, your code fixes the sequence**: Prefer workflows when the steps are known.
2. **C) A confused model could otherwise call tools forever, with each turn costing more**: Limits, budgets and loop detection are basic guards.
3. **C) In one user message containing a tool_result for each call**: Every tool_use id needs a matching result.
4. **C) When the task splits into parallel parts or exceeds one context window**: It multiplies token use and debugging effort.

</details>

---
Previous: [Lesson 23](23-tool-calling.md) · Next: [Lesson 25: The Model Context Protocol (MCP)](25-mcp.md)
