# Lesson 43: Project, step 1: calling an LLM API

**You'll learn:** chat model APIs, the simulated Messages API, model, max_tokens, system prompts and messages, content blocks, stop reasons, token usage and cost, the official TypeScript SDK, stateless conversations and history, error types and status codes, retrying 429 and 529 with backoff and retry-after, streaming with server-sent events, buffering and parsing a stream, TextDecoder with stream mode, asking for JSON and parsing it defensively, structured outputs, keeping API keys on a server.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#llm-api)**: run every example and check your exercise answers.

## Key terms

- **LLM (large language model):** a model that generates text, used through an API.
- **Token:** the unit models read and write, roughly 4 characters of English; usage and prices are counted in tokens.
- **`max_tokens`:** the most tokens a reply may contain; a longer reply is cut off.
- **Stop reason:** why the model stopped: `end_turn`, `max_tokens` or `tool_use`.
- **Stateless API:** an API that remembers nothing between requests, so each one carries the whole conversation.
- **Server-sent events (SSE):** a text format for streaming events over HTTP: `event:` and `data:` lines, separated by blank lines.
- **Streaming:** receiving a reply in pieces as it's generated.
- **Structured output:** model output in a machine-readable format such as JSON, ideally guaranteed to match a schema.

The final project is a shopping assistant for the bike shop: you type a question, a language model decides what to look up, your code calls the shop's API for it, and the model answers. This lesson starts with the foundation: sending a request to a model and reading the reply.

The sandbox has a **simulated LLM API** at `https://llm.example/v1/messages`. It speaks the same format as Anthropic's **Messages API** (the one the AI Engineering course uses), so the code you write here works against the real API with a real URL and key. The simulated model is tiny and rule-based: it greets you, repeats text, counts, knows the capital of France, and, once it has tools (Lesson 44), helps with the shop. It answers the same way every time, which makes it easy to learn and test with. Any key starting with `sk-sim-` works.

## The request and the response

```js
const res = await fetch("https://llm.example/v1/messages", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": "sk-sim-course",              // with the real API: your secret key, from the server's environment
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify({
    model: "sim-1",
    max_tokens: 200,
    system: "You are a helpful assistant for a bike shop.",
    messages: [{ role: "user", content: "Hello!" }],
  }),
});
const message = await res.json();
console.log(message);
console.log(message.content[0].text);
```

| Request field | Meaning |
|---|---|
| `model` | which model answers (with the real API, a name such as `claude-sonnet-5-5`) |
| `max_tokens` | the most tokens the reply may use; required |
| `system` | the **system prompt**: instructions for the whole conversation |
| `messages` | the conversation: `user` and `assistant` turns, alternating, starting and ending with `user` |
| `tools`, `stream` | tools (Lesson 44) and streaming (below) |

| Response field | Meaning |
|---|---|
| `content` | a list of **content blocks**: `text`, and later `tool_use` |
| `stop_reason` | why it stopped: `end_turn` (finished), `max_tokens` (cut off), `tool_use` (wants a tool) |
| `usage` | input and output **tokens**, which is what you pay for |

A **token** is a piece of text, roughly 4 characters of English. Prices are per million input and output tokens, so long conversations cost more with every turn.

## The SDK

In real projects you'd use the provider's SDK, which builds the request, types the response, and retries failed requests for you:

```js
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();                 // reads the ANTHROPIC_API_KEY environment variable
const message = await client.messages.create({
  model: "claude-sonnet-5-5",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Do you sell tubeless tyres?" }],
});
for (const block of message.content) {
  if (block.type === "text") console.log(block.text);
}
```

This lesson uses `fetch` so you see exactly what goes over the wire, which helps when debugging any SDK, and is how you'd talk to a provider without one.

## Conversations are your job

The API is **stateless**: it remembers nothing between requests. To continue a conversation, send the whole history every time, with the model's previous replies as `assistant` turns:

```js
async function send(messages) {
  const res = await fetch("https://llm.example/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": "sk-sim-course" },
    body: JSON.stringify({ model: "sim-1", max_tokens: 200, messages }),
  });
  const data = await res.json();
  return data.content.map((b) => b.text).join("");
}

const history = [{ role: "user", content: "Hi! My name is Ada." }];
history.push({ role: "assistant", content: await send(history) });
history.push({ role: "user", content: "What is my name?" });
console.log(await send(history));                                            // it knows: the history says so
console.log(await send([{ role: "user", content: "What is my name?" }]));    // a new conversation: it doesn't
```

That's also why costs grow: every turn re-sends everything before it. Long-running apps trim or summarise old turns.

## Stop reasons and max_tokens

```js
const res = await fetch("https://llm.example/v1/messages", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": "sk-sim-course" },
  body: JSON.stringify({ model: "sim-1", max_tokens: 12, messages: [{ role: "user", content: "Please count to 40" }] }),
});
const data = await res.json();
console.log(data.stop_reason, data.usage);
console.log(data.content[0].text);
if (data.stop_reason === "max_tokens") console.log("(the reply was cut off: raise max_tokens or ask for less)");
```

Always check `stop_reason`: a reply cut off by `max_tokens` looks like a normal one, just incomplete.

## Errors and retries

Errors come back as JSON with a status code:

| Status | `error.type` | What to do |
|---|---|---|
| 400 | `invalid_request_error` | fix the request; retrying won't help |
| 401 | `authentication_error` | check the API key |
| 429 | `rate_limit_error` | wait (the `retry-after` header says how long), then retry |
| 500, 529 | `api_error`, `overloaded_error` | temporary: retry with backoff |

The key `sk-sim-flaky` makes the simulated API fail twice (a 429, then a 529) before it answers, so you can try the retry pattern from Lesson 25:

```js
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function createMessage(body, apiKey, attempts = 4) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch("https://llm.example/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) return data;
    const retryable = res.status === 429 || res.status >= 500;
    console.log(`attempt ${attempt}: ${res.status} ${data.error.type}`);
    if (!retryable || attempt === attempts) throw new Error(`${res.status} ${data.error.type}: ${data.error.message}`);
    const wait = res.headers.has("retry-after") ? Number(res.headers.get("retry-after")) * 1000 : 50 * 2 ** attempt;
    await delay(wait);
  }
}

const reply = await createMessage({ model: "sim-1", max_tokens: 50, messages: [{ role: "user", content: "Hi" }] }, "sk-sim-flaky");
console.log(reply.content[0].text);
```

(The official SDKs already retry 429s and 5xx errors with backoff, twice by default.)

## Streaming

A long reply can take many seconds. With `"stream": true` the API sends the reply as it's generated, as **server-sent events** (SSE): text lines with an `event:` name and a `data:` JSON payload, each event ending with a blank line:

```text
event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

```

The events of one reply: `message_start`, then for each content block `content_block_start`, several `content_block_delta`s and `content_block_stop`, then `message_delta` (with the `stop_reason` and final usage) and `message_stop`. The text arrives in `text_delta`s, which you show as they come:

```js
const res = await fetch("https://llm.example/v1/messages", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": "sk-sim-course" },
  body: JSON.stringify({ model: "sim-1", max_tokens: 100, stream: true, messages: [{ role: "user", content: "count to 8" }] }),
});
const decoder = new TextDecoder();
let raw = "";
for await (const chunk of res.body) {
  const text = decoder.decode(chunk, { stream: true });
  console.log(JSON.stringify(text));       // chunks don't line up with events!
  raw += text;
  if (raw.length > 300) break;
}
```

Network chunks split events at arbitrary points, so a parser must **buffer**: add each chunk to a string, take out every complete event (up to a blank line), and keep the rest for the next chunk. The second exercise does exactly that. SDKs do it for you (`client.messages.stream(…)`), and in a web page you'd append each piece of text to the screen as it arrives (Part 5).

## Asking for JSON

When code needs to use the answer, ask for JSON, and parse it **defensively**: models often wrap it in a Markdown code fence, add a sentence, or get a field wrong.

```js
const res = await fetch("https://llm.example/v1/messages", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": "sk-sim-course" },
  body: JSON.stringify({ model: "sim-1", max_tokens: 200, messages: [{ role: "user", content: "Describe the bell as JSON" }] }),
});
const text = (await res.json()).content[0].text;
console.log(text);

const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);       // prefer the fenced part if there is one
const data = JSON.parse(fenced ? fenced[1] : text);
console.log(data.name, data.price, data.inStock);
```

Then validate it like any outside data (Lesson 35). Many APIs can also **guarantee** output matching a JSON Schema (structured outputs), and tools, next lesson, are the most reliable way to get structured data from a model.

## Keep the key on the server

An API key in front-end code can be read by anyone who opens the page, and used to run up your bill. The browser should call **your** server (Lesson 40), which checks the user, adds the key from its environment, and calls the model API. The same server is where you set limits per user and log usage.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| One reply | POST messages → check status → join text blocks | O(reply) | O(history) |
| Conversation | resend the full history each turn | O(history) per turn | O(history) |
| Stream | buffer chunks, split on blank lines, parse data lines | O(reply) | O(one event) |

## Common mistakes

- Assuming `content[0]` is the text of a reply.
- Ignoring `stop_reason` and treating a cut-off reply as complete.
- Sending only the latest message and expecting the model to remember the conversation.
- Retrying 400 errors, or retrying 429s without waiting.
- Parsing each streamed chunk as if it were one complete event.
- Putting an API key in front-end code.

## Exercises

### 1. Ask the model

Write `async function ask(messages, { system, maxTokens = 300 } = {})` that calls the simulated API (model `"sim-1"`, key `"sk-sim-course"`) and returns `{ text, stopReason, usage }`:

- `text`: the text of **all** text blocks in the reply, joined with no separator;
- `stopReason`: the reply's `stop_reason`; `usage`: its `usage` object;
- include `system` in the request only when it's given;
- if the response isn't OK, throw an `Error` whose message is the status, the error type and its message: `400 invalid_request_error: messages: at least one message is required`.

Starter code:

```js
async function ask(messages, { system, maxTokens = 300 } = {}) {
  // your code here
}

console.log(await ask([{ role: "user", content: "Hello!" }]));
console.log((await ask([{ role: "user", content: "What is the capital of France?" }], { system: "Talk like a pirate." })).text);
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** one request → three useful fields out, or a clear error.
2. **Examples:** `maxTokens: 5` → stop reason `max_tokens` and a cut-off text; `[]` → 400.
3. **Brute force:** `data.content[0].text`: breaks as soon as a reply starts with something other than text.
4. **Pattern:** **check the status, then read typed blocks**: the same shape as every API call in Part 4.
5. **Plan:** body (system optional) → fetch → json → throw if not ok → join text blocks → return.
6. **Code and test:** try the history example: the model only knows your name if it's in `messages`.

</details>

<details>
<summary>💡 Hint 1</summary>

Build the body object first: `{ model: "sim-1", max_tokens: maxTokens, messages }`, and add `system` only if it isn't `undefined`. POST it as JSON with the `x-api-key` header, like the lesson's first example.

</details>

<details>
<summary>💡 Hint 2</summary>

Read `await res.json()` either way: errors are JSON too. If `!res.ok`, throw `new Error(\`${res.status} ${data.error.type}: ${data.error.message}\`)`.

</details>

<details>
<summary>💡 Hint 3</summary>

`data.content.filter((b) => b.type === "text").map((b) => b.text).join("")` collects the text without assuming `content[0]` is text.

</details>

### 2. Stream a reply

Write `async function streamReply(messages, onText)` that requests a **streamed** reply (`stream: true`, model `"sim-1"`, key `"sk-sim-course"`, `max_tokens` 500), calls `onText(text)` for every `text_delta` as it arrives, and finally returns `{ text, stopReason }`: all the text, and the `stop_reason` from the `message_delta` event.

The body arrives in chunks that cut events at random places: buffer the text, and only parse complete events (they end with a blank line, `"\n\n"`). Each event's payload is on its `data: ` line.

Starter code:

```js
async function streamReply(messages, onText) {
  // your code here
}

const result = await streamReply([{ role: "user", content: "count to 10" }], (piece) => console.log(JSON.stringify(piece)));
console.log(result);
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** turn a stream of arbitrary byte chunks into events, then into text pieces.
2. **Examples:** a chunk may end in the middle of `"data: {"type": "conte` and the next one finishes it.
3. **Brute force:** `JSON.parse` each chunk: fails on the first partial event.
4. **Pattern:** **buffer and split on the delimiter**, keeping the incomplete tail: the standard way to parse any stream of messages.
5. **Plan:** fetch with stream → decoder + buffer → loop chunks → extract complete events → parse data → dispatch on type.
6. **Code and test:** log each piece, as the starter does; the pieces should join to the full text.

</details>

<details>
<summary>💡 Hint 1</summary>

Read the body with `for await (const chunk of res.body)` and turn bytes into text with one `TextDecoder`, calling `decoder.decode(chunk, { stream: true })` so a character split across chunks isn't broken.

</details>

<details>
<summary>💡 Hint 2</summary>

Append each decoded chunk to a `buffer`. Then, while the buffer contains `"\n\n"`, cut off the text before it (one complete event) and keep the rest in the buffer.

</details>

<details>
<summary>💡 Hint 3</summary>

In each event, find the line starting with `data: `, `JSON.parse` the rest, and handle two types: `content_block_delta` with `delta.type === "text_delta"` (add `delta.text`, call `onText`) and `message_delta` (save `delta.stop_reason`).

</details>

**In the sandbox:** exercises 85–86. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Ask the model</summary>

```js
async function ask(messages, { system, maxTokens = 300 } = {}) {
  const body = { model: "sim-1", max_tokens: maxTokens, messages };
  if (system !== undefined) body.system = system;
  const res = await fetch("https://llm.example/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": "sk-sim-course", "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${data.error.type}: ${data.error.message}`);
  const text = data.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return { text, stopReason: data.stop_reason, usage: data.usage };
}

console.log(await ask([{ role: "user", content: "Hello!" }]));
console.log((await ask([{ role: "user", content: "What is the capital of France?" }], { system: "Talk like a pirate." })).text);
```

**Line by line**

- The body maps the JavaScript options to the API's names (`maxTokens` → `max_tokens`); `system` is added only when given, so `undefined` is never sent.
- The `x-api-key` header authenticates; with the real API it comes from the server's environment, never from code.
- Error responses are JSON with `error.type` and `error.message`; putting the status and both into the `Error` gives callers everything needed to decide whether to retry.
- Filtering on `type === "text"` before joining handles replies with several blocks, including tool calls later.

**Trace:** `count to 100` with `maxTokens: 5` → the simulated model cuts the text at 20 characters (about 5 tokens) → `"1, 2, 3, 4, 5, 6, 7,"`, `stop_reason: "max_tokens"`.

**Common wrong approach:** forgetting the history: sending only the latest user message makes the model forget everything said before, because the API is stateless.

</details>

<details>
<summary>✅ 2. Stream a reply</summary>

```js
async function streamReply(messages, onText) {
  const res = await fetch("https://llm.example/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": "sk-sim-course" },
    body: JSON.stringify({ model: "sim-1", max_tokens: 500, stream: true, messages }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const decoder = new TextDecoder();
  let buffer = "", text = "", stopReason = null;
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let end;
    while ((end = buffer.indexOf("\n\n")) !== -1) {
      const event = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const dataLine = event.split("\n").find((line) => line.startsWith("data: "));
      if (!dataLine) continue;
      const data = JSON.parse(dataLine.slice(6));
      if (data.type === "content_block_delta" && data.delta.type === "text_delta") {
        text += data.delta.text;
        onText(data.delta.text);
      } else if (data.type === "message_delta") {
        stopReason = data.delta.stop_reason;
      }
    }
  }
  return { text, stopReason };
}

const result = await streamReply([{ role: "user", content: "count to 10" }], (piece) => console.log(JSON.stringify(piece)));
console.log(result);
```

**Line by line**

- `decoder.decode(chunk, { stream: true })` keeps an incomplete multi-byte character (like `🚲`, four bytes) for the next chunk instead of producing a broken character.
- The `while` loop removes complete events from the front of `buffer`; whatever is left is the start of the next event, completed by later chunks.
- Each event has an `event:` line and a `data:` line; the `data` JSON's own `type` says what it is, so the `event:` line can be ignored.
- `text_delta`s are appended and passed to `onText` immediately: that's the point of streaming, showing text as it's generated.
- `message_delta` carries the final `stop_reason`.

**Trace:** chunk 1 ends inside the second event → the first event is parsed (`message_start`, ignored), the partial second stays in `buffer` → chunk 2 completes it → `content_block_start` → … → each `text_delta` calls `onText`.

**Common wrong approach:** `const text = await res.text()` and then splitting: it works, but waits for the whole reply, which defeats streaming.

</details>

## Quick quiz

1. The API is stateless. What must you send to continue a conversation?
   - A) The whole history: earlier user and assistant turns, plus the new message
   - B) Only the new message; the server remembers the rest
   - C) The id of the previous message

2. A reply has stop_reason "max_tokens". What does that mean?
   - A) It was cut off because it reached max_tokens
   - B) It finished normally
   - C) The model wants to use a tool

3. Which errors are worth retrying with backoff?
   - A) 429 and 5xx (including 529 overloaded)
   - B) 400 and 401
   - C) All errors

4. Why can't you parse each streamed chunk as one event?
   - A) Chunks can split an event (or a character) at any point, so you must buffer
   - B) Each chunk contains several unrelated replies
   - C) Streamed data isn't JSON

<details>
<summary>Quiz answers</summary>

1. **A) The whole history: earlier user and assistant turns, plus the new message**: Every request carries the full conversation.
2. **A) It was cut off because it reached max_tokens**: Check it every time; a cut-off reply looks normal.
3. **A) 429 and 5xx (including 529 overloaded)**: 4xx errors other than 429 mean the request itself must change.
4. **A) Chunks can split an event (or a character) at any point, so you must buffer**: Buffer, extract complete events, and keep the rest.

</details>

---
Previous: [Lesson 42](42-interview-coding.md) · Next: [Lesson 44: Project, step 2: tools and the agent loop](44-tools-and-agents.md)
