# Lesson 26: Memory and context management

**You'll learn:** context engineering, context rot, what fills an agent's context, write, select, compress and isolate, just-in-time context, compaction and summaries, server-side compaction, clearing old tool results and context editing, sub-agents, long-term memory, the memory tool, progress files, stale memories, privacy and injected memories.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#memory-and-context)**: run every example and check your exercise answers.

## Key terms

- **Context engineering:** choosing what information goes into the model's context at each step.
- **Context rot:** degraded recall and reasoning as the context grows long and noisy.
- **Compaction:** replacing older conversation turns with a summary.
- **Context editing:** automatically clearing old tool results or thinking from the history.
- **Just-in-time context:** loading information through tools only when it's needed.
- **Long-term memory:** information stored outside the model and loaded into later conversations.
- **Memory tool:** a tool that lets the model create, read and update memory files.

A model has no memory beyond what's in its context window on each call (Lesson 7). For a chat that's the conversation; for an agent it's the conversation **plus** every tool call and result so far, which can grow by thousands of tokens per step. **Context engineering** is the discipline of deciding what goes into that window at each step.

## More isn't always better

Context windows now reach a million tokens, but filling them has costs:

- **Price and speed:** every token is resent on every turn (caching helps, Lesson 11).
- **Context rot:** models get worse at finding and using information as the context grows, especially details buried in the middle of long, noisy histories.
- **Distraction:** stale tool output and abandoned approaches compete for the model's attention.

Anthropic's guidance on context engineering frames the goal as finding the **smallest set of high-signal tokens** that lets the model do the next step well.

## What fills an agent's context

![A line chart of context tokens against agent turns. Usage climbs steadily as tool results accumulate, approaching the context limit. At turn 30, compaction replaces old turns with a summary and usage drops sharply, then climbs again. A dashed line shows the limit](../figures/context-growth.svg)

System prompt and tool definitions (fixed), the conversation, and above all **tool results**: file contents, search results, web pages, logs. Those dominate quickly, and most are only useful for a step or two.

## Four strategies

| Strategy | Idea | Examples |
|---|---|---|
| **write** | save information outside the window | notes, a to-do file, a memory store |
| **select** | bring in only what's needed, when it's needed | retrieval (Part 4), tools that read one file instead of preloading all |
| **compress** | shrink what's there | summarise old turns (**compaction**), clear old tool results |
| **isolate** | split work across separate contexts | sub-agents that return only a short summary |

**Just-in-time** loading is a good default for agents: keep lightweight references (file paths, URLs, record IDs) in context and give the agent tools to open them when needed, rather than pasting everything in up front.

## Compression in practice

**Compaction:** when the history nears a limit, summarise the older part (decisions made, facts learned, open questions, what's next) and continue from the summary plus the most recent turns (the first exercise). Write the summarisation prompt carefully: what's dropped is gone. Claude's API offers **server-side compaction** (in beta) that does this automatically, and Claude Code compacts long sessions the same way.

**Clearing tool results:** a 2,000-line file read twenty steps ago rarely needs to stay word for word. Replace old tool results with a short placeholder, keeping the record that the call happened (the second exercise). The API's **context editing** feature can clear old tool results automatically.

```python
history = [
    {"role": "user", "content": "Fix the failing test."},
    {"role": "assistant", "content": "I'll read the test file."},
    {"role": "user", "content": "test_orders.py:\n" + "    assert total(order) == expected\n" * 1800},
    {"role": "assistant", "content": "The bug is in apply_discount; reading it."},
    {"role": "user", "content": "discounts.py:\n" + "    price = round(price * rate, 2)\n" * 400},
    {"role": "assistant", "content": "Fixed the rounding; running the tests."},
]

def estimate(messages):
    return sum(len(m["content"]) for m in messages) // 4      # about 4 characters per token

summary = ("Earlier: the test test_orders.py::test_discount failed; the cause is a rounding bug "
           "in discounts.apply_discount, now fixed.")
compacted = [{"role": "user", "content": f"<summary>{summary}</summary>\nContinue the task."}] + history[-1:]
print(f"about {estimate(history):,} tokens → {estimate(compacted):,} tokens")
```

## Long-term memory

To remember across conversations (a user's preferences, a project's conventions, what an agent learned last week), store information **outside** the model and load it when relevant:

- **Structured facts** in a database: "prefers metric units", "shop: Bath". Precise and easy to inspect and delete.
- **Files** the agent reads and writes: Claude's **memory tool** gives the model a directory of memory files to create, read and update, with your code storing them wherever you like. Claude Code's `CLAUDE.md` files work in the same spirit.
- **Searchable notes:** embed past conversations or notes and retrieve the relevant ones (Part 4).

For long tasks, a **progress file** (what's done, what's next, decisions and why) lets a fresh context, or a fresh session, pick up where the last one stopped.

Memory needs care:

- **Accuracy:** memories go stale ("the user's address" from two years ago). Store dates, prefer recent information, let new facts overwrite old ones.
- **Privacy:** tell users what's remembered, and let them view and delete it. Don't store sensitive data you don't need.
- **Injection:** text saved from untrusted sources can carry instructions into every future conversation. Treat memory as data (Lesson 16).

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Compact history | summarise the older part; keep a recent tail starting with a user turn | O(n) + 1 call | O(n) |
| Clear old tool results | copy; replace all but the newest k results with a placeholder | O(blocks) | O(n) |
| Context strategies | write, select, compress, isolate | — | — |

## Common mistakes

- Filling the context because there's room.
- Summarising on every turn instead of past a threshold.
- Deleting tool_result blocks instead of clearing their content.
- Keeping memories without dates, sources or a way for users to delete them.
- Saving untrusted text into memory where it influences future sessions.

## Exercises

### 1. Compact a conversation

Write `compact(messages, keep_last, summarize)` returning `(summary, recent)`:

- If there are at most `keep_last` messages, return `("", messages)` (as a new list) without calling `summarize`.
- Otherwise, `recent` is the last `keep_last` messages; but if `recent` would start with an assistant message, move such leading messages into the older part, so `recent` starts with a `"user"` message (it may end up empty).
- `summary` is `summarize(older_messages)`; call it only if there are older messages.

(The summary then goes into the system prompt, and `recent` becomes the new message list.)

Starter code:

```python
def compact(messages, keep_last, summarize):
    pass

msgs = [{"role": "user", "content": "Fix the test."},
        {"role": "assistant", "content": "Reading the file."},
        {"role": "user", "content": "<1,800 lines>"},
        {"role": "assistant", "content": "Found the bug."},
        {"role": "user", "content": "Great, fix it."}]
summarize = lambda old: f"{len(old)} earlier messages"
print(compact(msgs, 2, summarize))
# ('4 earlier messages', [{'role': 'user', 'content': 'Great, fix it.'}])
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** keep a valid recent tail; summarise everything before it; skip work when nothing is old.
2. **Examples:** keep 2 of [u, a, u, a, u] → the tail [a, u] starts with an assistant → move it → tail [u].
3. **Brute force:** this is already linear.
4. **Pattern:** **split point with a boundary fix**, like Lesson 7's trimming.
5. **Plan:** short-circuit → split → advance past assistant messages → slice → summarise.
6. **Code and test:** keep 0, keep more than there are, tails that start with an assistant message.

</details>

<details>
<summary>💡 Hint 1</summary>

The split point starts at `len(messages) - keep_last`. Everything before it is "older".

</details>

<details>
<summary>💡 Hint 2</summary>

While the message at the split point is an assistant message, move the split one step later.

</details>

<details>
<summary>💡 Hint 3</summary>

Slices create new lists: `messages[:split]` and `messages[split:]`. Return `list(messages)` in the nothing-to-do case.

</details>

### 2. Clear old tool results

Write `clear_old_tool_results(messages, keep_recent=2, placeholder="[old tool result cleared]")`. Messages whose `content` is a list may contain `tool_result` blocks. Return a **new** list of messages in which every `tool_result` block's `content` is replaced by `placeholder`, **except** the `keep_recent` most recent ones (counting across the whole conversation). Everything else is unchanged, and the input must not be modified.

Starter code:

```python
import copy

def clear_old_tool_results(messages, keep_recent=2, placeholder="[old tool result cleared]"):
    pass

result = lambda i, text: {"type": "tool_result", "tool_use_id": i, "content": text}
history = [{"role": "user", "content": "Fix the test."},
           {"role": "user", "content": [result("t1", "1,800 lines…"), result("t2", "400 lines…")]},
           {"role": "user", "content": [result("t3", "3 tests passed")]}]
for message in clear_old_tool_results(history, keep_recent=1):
    print(message["content"])
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** count results across the whole conversation; clear all but the newest few; keep the structure intact.
2. **Examples:** results t1, t2, t3 with keep 2 → only t1 is cleared.
3. **Brute force:** walking backwards with a counter: also fine.
4. **Pattern:** **copy, collect references, edit in place on the copy**.
5. **Plan:** deep copy → list of result blocks → slice the old ones → overwrite their content.
6. **Code and test:** keep 0, keep more than exist, mixed blocks, a custom placeholder, unchanged input.

</details>

<details>
<summary>💡 Hint 1</summary>

Start with `copy.deepcopy(messages)` so you can change blocks freely without touching the original.

</details>

<details>
<summary>💡 Hint 2</summary>

Collect every `tool_result` block, in order, from messages whose content is a list. The last `keep_recent` of them stay; the rest get the placeholder.

</details>

<details>
<summary>💡 Hint 3</summary>

`results[:max(0, len(results) - keep_recent)]` is the list of blocks to clear; set each one's `"content"`.

</details>

**In the sandbox:** exercises 50–51. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Compact a conversation</summary>

```python
def compact(messages, keep_last, summarize):
    if len(messages) <= keep_last:
        return "", list(messages)
    split = len(messages) - keep_last
    while split < len(messages) and messages[split]["role"] != "user":
        split += 1                                     # recent must start with a user turn
    older, recent = messages[:split], messages[split:]
    return summarize(older), recent

msgs = [{"role": "user", "content": "Fix the test."},
        {"role": "assistant", "content": "Reading the file."},
        {"role": "user", "content": "<1,800 lines>"},
        {"role": "assistant", "content": "Found the bug."},
        {"role": "user", "content": "Great, fix it."}]
summarize = lambda old: f"{len(old)} earlier messages"
print(compact(msgs, 2, summarize))
```

**Line by line**

- The early return avoids an unnecessary (and costly, in real life) summarisation call.
- The `while` loop also stops at the end of the list, so a tail with no user message becomes empty.
- Slicing never mutates the input, and always returns new lists.
- The caller decides where the summary goes; the system prompt keeps it separate from the message turns.

**Trace** with `keep_last=3`: split = 2 → `messages[2]` is a user message → older = [1, 2], recent = [3, 4, 5].

**Complexity:** O(n), plus the summarisation call.

**Common wrong approach:** summarising on every turn (expensive, and details erode with each re-summary). Compact only when the context passes a threshold, and keep the recent turns verbatim.

</details>

<details>
<summary>✅ 2. Clear old tool results</summary>

```python
import copy

def clear_old_tool_results(messages, keep_recent=2, placeholder="[old tool result cleared]"):
    messages = copy.deepcopy(messages)                     # never edit the caller's history
    results = [block for m in messages if isinstance(m["content"], list)
               for block in m["content"] if block["type"] == "tool_result"]
    to_clear = results[:max(0, len(results) - keep_recent)]
    for block in to_clear:
        block["content"] = placeholder
    return messages

result = lambda i, text: {"type": "tool_result", "tool_use_id": i, "content": text}
history = [{"role": "user", "content": "Fix the test."},
           {"role": "user", "content": [result("t1", "1,800 lines…"), result("t2", "400 lines…")]},
           {"role": "user", "content": [result("t3", "3 tests passed")]}]
for message in clear_old_tool_results(history, keep_recent=1):
    print(message["content"])
```

**Line by line**

- `copy.deepcopy` copies nested lists and dicts, so editing a block in the copy can't change the original history (a shallow copy would share the blocks).
- The list comprehension collects **references** to the blocks inside the copy; changing them changes the copy.
- `max(0, …)` makes `keep_recent` larger than the number of results safe.
- `tool_use_id` and every other block stay as they were, so the conversation is still valid for the API (each call still has a result).

**Trace** with `keep_recent=1`: results [t1, t2, t3] → clear [t1, t2] → only t3's content survives.

**Complexity:** O(total blocks), plus the copy.

**Common wrong approach:** deleting old `tool_result` blocks entirely. The API requires a result for every `tool_use`; replacing the content keeps the conversation valid while freeing the tokens.

</details>

## Quick quiz

1. What is context rot?
   - A) A bug in caching
   - B) Models getting worse at using information as the context grows long and noisy
   - C) Tokens expiring after an hour

2. An agent read a 2,000-line file twenty steps ago. What's a good way to free that space?
   - A) Delete the tool_use and tool_result blocks
   - B) Replace the old tool result's content with a short placeholder
   - C) Start a new conversation with no context

3. What does "just-in-time" context mean for agents?
   - A) Keep references such as file paths in context and let the agent open them with tools when needed
   - B) Call the model only at midnight
   - C) Load every document at the start

4. Which is a risk of long-term memory?
   - A) Memories make the model faster
   - B) Stale or injected memories influencing every future conversation
   - C) Memory files can't be deleted

<details>
<summary>Quiz answers</summary>

1. **B) Models getting worse at using information as the context grows long and noisy**: Curating the context matters as much as its size.
2. **B) Replace the old tool result's content with a short placeholder**: The call stays on record; the bulk goes.
3. **A) Keep references such as file paths in context and let the agent open them with tools when needed**: Select what's needed, when it's needed.
4. **B) Stale or injected memories influencing every future conversation**: Date memories, let users manage them, and treat them as data.

</details>

---
Previous: [Lesson 25](25-mcp.md) · Next: [Lesson 27: Keeping agents safe](27-agent-safety.md)
