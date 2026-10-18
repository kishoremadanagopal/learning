# Lesson 7: Requests, responses and conversations

**You'll learn:** the anatomy of a request (model, max tokens, system prompt, messages), content blocks, the response and its content blocks, stop reasons, token usage, stateless APIs, storing and resending conversation history, trimming and summarising history, mid-conversation system messages, other providers' APIs and multi-provider libraries, keeping API keys safe.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#messages-api)**: run every example and check your exercise answers.

## Key terms

- **API key:** the secret that identifies your account to the provider; keep it in an environment variable or a secrets manager.
- **System prompt:** instructions and context that apply to the whole conversation.
- **Message:** one turn in the conversation, with a role (`user` or `assistant`) and content.
- **Content block:** one typed piece of a message: text, image, document, tool call, tool result or thinking.
- **Stop reason:** why the model stopped generating, such as `end_turn`, `max_tokens` or `tool_use`.
- **Usage:** the input and output token counts the response reports, which determine its cost.
- **Stateless API:** one that remembers nothing between calls, so each request carries the full history.

Every chat-style model API works the same way at heart: you send a list of **messages** and settings, and get back the model's reply plus some metadata. This lesson uses Anthropic's **Messages API** as the example; other providers differ in names, not in ideas.

## The request

```python
import anthropic

client = anthropic.Anthropic()          # reads the ANTHROPIC_API_KEY environment variable

response = client.messages.create(
    model="claude-sonnet-5-5",          # which model
    max_tokens=1024,                    # the most tokens the reply may use
    system="You are a concise assistant for a bike shop.",   # instructions that apply throughout
    messages=[
        {"role": "user", "content": "Do you sell tubeless tyres?"},
    ],
)
print(response.content[0].text)
print(response.stop_reason, response.usage.input_tokens, response.usage.output_tokens)
```

| Field | Meaning |
|---|---|
| `model` | the model to use (Lesson 6) |
| `max_tokens` | a hard cap on output tokens, **including** any thinking tokens; required |
| `system` | the **system prompt**: the role, rules and context for the whole conversation |
| `messages` | the conversation so far, alternating `user` and `assistant` turns, ending with a `user` turn |
| `tools`, `output_config`, … | optional features: tools (Part 5), structured output (Lesson 9), effort (Lesson 10) |

Keep the API key out of your code: put it in an environment variable or a secrets manager, never in a file you commit.

## Content blocks

A message's `content` can be a plain string, or a **list of content blocks** of different types: text, images, documents (PDFs), and in replies, tool calls and thinking. A string is shorthand for one text block.

```python
message = {
    "role": "user",
    "content": [
        {"type": "text", "text": "What's wrong with this bike part?"},
        {"type": "image", "source": {"type": "url", "url": "https://example.com/chain.jpg"}},
    ],
}
print([block["type"] for block in message["content"]])
```

## The response

```json
{
  "id": "msg_01XFDUDYJgAACzvnptvVoYEL",
  "type": "message",
  "role": "assistant",
  "model": "claude-sonnet-5-5",
  "content": [{"type": "text", "text": "Yes! We stock tubeless tyres in…"}],
  "stop_reason": "end_turn",
  "usage": {"input_tokens": 31, "output_tokens": 54}
}
```

The reply's `content` is a list of blocks too, so **don't assume `content[0]` is text**: a reply may start with a thinking block or contain a tool call. Loop over the blocks and pick out the ones you need (the first exercise).

The **stop reason** says why generation ended. Always check it:

| `stop_reason` | Meaning | What to do |
|---|---|---|
| `end_turn` | the model finished naturally | use the reply |
| `max_tokens` | it hit your `max_tokens` cap | the reply is cut off: raise the cap or ask it to continue |
| `stop_sequence` | it produced one of your stop sequences | expected, if you set them |
| `tool_use` | it wants to call a tool | run the tool and send the result back (Part 5) |
| `pause_turn` | a server-side tool loop paused | send the conversation back to let it continue |
| `refusal` | it declined to respond | show a suitable message; don't retry blindly |
| `model_context_window_exceeded` | the conversation filled the context window | trim or summarise the history |

## Conversations: the API remembers nothing

The API is **stateless**. Each request must include the whole conversation you want the model to see. A chat app keeps the history itself and appends each new turn:

```python
class FakeClient:
    """Stands in for a real API client so this runs anywhere: it echoes how much history it received."""
    def create(self, system, messages):
        last = messages[-1]["content"]
        return {"content": [{"type": "text", "text": f"(reply to {last!r}; saw {len(messages)} messages)"}],
                "stop_reason": "end_turn"}

client = FakeClient()
history = []

def chat(user_text):
    history.append({"role": "user", "content": user_text})
    reply = client.create(system="You are helpful.", messages=history)
    text = "".join(b["text"] for b in reply["content"] if b["type"] == "text")
    history.append({"role": "assistant", "content": text})   # store the reply for the next turn
    return text

print(chat("Hi!"))
print(chat("What did I just say?"))
print(len(history), "messages stored")
```

Because every request resends the history, **long conversations get slower and more expensive with every turn**, and eventually hit the context window. Common strategies:

- **Keep only the most recent turns** that fit a token budget (the second exercise).
- **Summarise** older turns into a short paragraph, kept in the system prompt or an early message.
- **Prompt caching** (Lesson 11) makes the repeated prefix much cheaper.
- Store long-term facts outside the conversation and retrieve them when relevant (Parts 4 and 5).

On the newest Claude models you can also add a `{"role": "system", ...}` message **partway through** a conversation to change the instructions from that point on, without disturbing the cached history before it.

## Other providers

The concepts carry over directly. OpenAI's current **Responses API**, for example:

```python
from openai import OpenAI

client = OpenAI()                                     # reads OPENAI_API_KEY
response = client.responses.create(
    model="gpt-5.1",                                  # check OpenAI's models page for current names
    instructions="You are a concise assistant for a bike shop.",
    input="Do you sell tubeless tyres?",
)
print(response.output_text)
```

Libraries such as **LiteLLM**, **LangChain** and the cloud platforms (Amazon Bedrock, Google Vertex AI, Azure AI Foundry) wrap many providers behind one interface, which helps when you route between models.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Get the reply text | join the text blocks; skip other types | O(reply length) | O(reply length) |
| Keep history in budget | walk newest to oldest within a token budget; start with a user turn | O(n) | O(n) |
| Long-running chats | trim, summarise older turns, cache the prefix | — | — |

## Common mistakes

- Reading only `content[0].text` when the reply may begin with thinking or a tool call.
- Ignoring the stop reason and treating a cut-off reply as complete.
- Committing an API key to a repository.
- Letting the history grow forever until requests become slow, costly or too long.
- Starting a trimmed history with an assistant turn.

## Exercises

### 1. Get the text out of a reply

A reply is a dict with a `"content"` list of blocks. Write `reply_text(reply)` returning all the text blocks' `"text"` joined together (in order), ignoring other block types such as `"thinking"` and `"tool_use"`. Return `""` if there are no text blocks.

Starter code:

```python
def reply_text(reply):
    pass

reply = {"content": [{"type": "thinking", "thinking": "Let me check…"},
                     {"type": "text", "text": "Yes, "},
                     {"type": "text", "text": "we do."}],
         "stop_reason": "end_turn"}
print(reply_text(reply))   # Yes, we do.
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** keep text blocks only, in order, joined with nothing in between; none → "".
2. **Examples:** thinking + two text blocks → the two texts joined.
3. **Brute force:** a loop with a result string: fine.
4. **Pattern:** **filter by type, then join**.
5. **Plan:** a generator over the content list with a type test.
6. **Code and test:** empty content, tool-only replies, text around a tool call.

</details>

<details>
<summary>💡 Hint 1</summary>

The text isn't always in the first block. Look at each block's `"type"`.

</details>

<details>
<summary>💡 Hint 2</summary>

Keep the blocks whose type is `"text"` and collect their `"text"` values in order.

</details>

<details>
<summary>💡 Hint 3</summary>

`"".join(block["text"] for block in reply["content"] if block["type"] == "text")`.

</details>

### 2. Keep the history within a budget

Write `trim_history(messages, max_tokens)` returning the **most recent** messages whose total estimated tokens fit within `max_tokens`, using `len(text) // 4` (at least 1) as each message's estimate. The result must **start with a `"user"` message** (drop a leading assistant message if needed), and keep the messages in their original order. If not even the last message fits, return `[]`.

Starter code:

```python
def trim_history(messages, max_tokens):
    pass

msgs = [{"role": "user", "content": "a" * 40},       # 10 tokens
        {"role": "assistant", "content": "b" * 40},  # 10 tokens
        {"role": "user", "content": "c" * 20}]       # 5 tokens
print(trim_history(msgs, 16))   # the last user message only: adding the assistant would leave it first
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a contiguous window of the newest messages within the budget; it must begin with a user turn; order preserved.
2. **Examples:** budget 16 → the last user message (5) plus the assistant (10) fits, but the window would start with an assistant turn, so only the user message remains.
3. **Brute force:** try every starting index from the newest backwards: also fine, O(n²) worst case.
4. **Pattern:** **walk backwards accumulating a budget**, then fix the boundary.
5. **Plan:** reversed loop with a running total → reverse → strip leading assistant turns.
6. **Code and test:** everything fits, nothing fits, exactly fits, assistant at the boundary.

</details>

<details>
<summary>💡 Hint 1</summary>

Which messages matter most? Start from the end of the list and work backwards.

</details>

<details>
<summary>💡 Hint 2</summary>

Add messages from newest to oldest while the running total stays within `max_tokens`; stop at the first one that doesn't fit (keeping a contiguous recent window). Then restore the original order.

</details>

<details>
<summary>💡 Hint 3</summary>

After reversing back, drop messages from the front while the first one isn't a `"user"` message.

</details>

**In the sandbox:** exercises 12–13. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Get the text out of a reply</summary>

```python
def reply_text(reply):
    return "".join(block["text"] for block in reply["content"] if block["type"] == "text")

reply = {"content": [{"type": "thinking", "thinking": "Let me check…"},
                     {"type": "text", "text": "Yes, "},
                     {"type": "text", "text": "we do."}],
         "stop_reason": "end_turn"}
print(reply_text(reply))
```

**Line by line**

- The generator walks `reply["content"]` in order and keeps only blocks whose `"type"` is `"text"`.
- `"".join(...)` concatenates them; with no text blocks it returns an empty string.
- Other block types (thinking, tool calls) are skipped instead of crashing on a missing `"text"` key.

**Trace** on the example: thinking (skipped), "Yes, " (kept), "we do." (kept) → "Yes, we do."

**Complexity:** O(total text length).

**Common wrong approach:** `reply["content"][0]["text"]`, which fails when the first block is thinking or a tool call, and drops any later text.

</details>

<details>
<summary>✅ 2. Keep the history within a budget</summary>

```python
def trim_history(messages, max_tokens):
    kept, used = [], 0
    for message in reversed(messages):                   # newest first
        cost = max(1, len(message["content"]) // 4)
        if used + cost > max_tokens:
            break
        kept.append(message)
        used += cost
    kept.reverse()                                        # back to chronological order
    while kept and kept[0]["role"] != "user":
        kept.pop(0)                                       # the history must start with a user turn
    return kept

msgs = [{"role": "user", "content": "a" * 40},
        {"role": "assistant", "content": "b" * 40},
        {"role": "user", "content": "c" * 20}]
print(trim_history(msgs, 16))
```

**Line by line**

- Iterating `reversed(messages)` considers the newest messages first, because they matter most for the next reply.
- `break` (not `continue`) keeps the window contiguous: skipping a big message to fit an older one would leave a confusing gap.
- After reversing back to chronological order, leading assistant messages are removed, because the API expects the conversation to start with the user.

**Trace** on budget 10 with tokens [10, 2, 2, 2, 2] (u, a, u, a, u): newest u (2, total 2), a (4), u (6), a (8), then the first u costs 10 → stop. Kept [a, u, a, u] → strip the leading a → [u, a, u].

**Complexity:** O(n).

**Common wrong approach:** keeping the **oldest** messages that fit, which keeps the greeting and loses the question being asked right now.

</details>

## Quick quiz

1. What does it mean that the Messages API is stateless?
   - A) It remembers nothing between calls, so you must send the conversation history each time
   - B) It only works once per day
   - C) It can't return text

2. A reply has stop_reason "max_tokens". What happened?
   - A) The model wants to call a tool
   - B) The model finished naturally
   - C) The reply was cut off at your max_tokens limit

3. Why shouldn't you read only response.content[0].text?
   - A) The text is in usage instead
   - B) The first block may be thinking or a tool call, and later blocks may hold more text
   - C) content is always empty

4. Why do long chats get more expensive per message?
   - A) Responses get longer automatically
   - B) Every request resends the whole history, so input tokens grow with each turn
   - C) The model charges more after ten messages

<details>
<summary>Quiz answers</summary>

1. **A) It remembers nothing between calls, so you must send the conversation history each time**: Your application stores and resends the history.
2. **C) The reply was cut off at your max_tokens limit**: Raise the limit, or ask the model to continue.
3. **B) The first block may be thinking or a tool call, and later blocks may hold more text**: Loop over the blocks and filter by type.
4. **B) Every request resends the whole history, so input tokens grow with each turn**: Trimming, summarising and caching keep it under control.

</details>

---
Previous: [Lesson 6](06-choosing-a-model.md) · Next: [Lesson 8: Streaming, errors and retries](08-streaming-and-retries.md)
