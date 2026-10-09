# Lesson 25: Timeouts, retries, cancellation and streaming

**You'll learn:** timeouts with Promise.race, cleaning up timers, cancellation with AbortController and AbortSignal, AbortSignal.timeout and AbortSignal.any, retries with exponential backoff and jitter, which errors to retry, idempotency and idempotency keys, limiting concurrency, reading streamed responses with readers and TextDecoderStream, server-sent events and LLM streaming.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#async-patterns)**: run every example and check your exercise answers.

## Key terms

- **Timeout:** giving up waiting after a set time.
- **AbortController / AbortSignal:** a way to cancel operations such as `fetch` that accept a signal.
- **Exponential backoff:** waiting twice as long after each failed attempt.
- **Jitter:** a random amount added to retry delays so clients don't retry in sync.
- **Idempotent:** safe to repeat: doing it twice has the same effect as once.
- **Concurrency limit:** the maximum number of operations allowed to run at the same time.
- **Stream:** data delivered in chunks over time instead of all at once.
- **Server-sent events (SSE):** a format for a server to push a stream of text events over HTTP.

Real networks are slow, flaky and sometimes silent. Robust apps don't wait forever, try again sensibly, stop work that's no longer needed, and show results as they arrive.

## Timeouts

`Promise.race` settles with whichever promise settles first, so racing a request against a timer gives a timeout:

```js
function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms));
}
try {
  const res = await Promise.race([fetch("https://shop.example/api/slow?ms=800"), timeout(200)]);
  console.log(await res.json());
} catch (e) {
  console.log(e.message);
}
```

But `race` only stops **waiting**: the slow request keeps running in the background. To actually stop it, cancel it.

## Cancellation with AbortController

An **AbortController** produces a **signal** you pass to `fetch` (and many other APIs); calling `abort()` cancels the operation, which then rejects with an `AbortError`. `AbortSignal.timeout(ms)` creates a signal that aborts itself:

```js
try {
  await fetch("https://shop.example/api/slow?ms=800", { signal: AbortSignal.timeout(200) });
} catch (e) {
  console.log(e.name, "-", e.message);         // TimeoutError
}

const controller = new AbortController();
const request = fetch("https://shop.example/api/slow?ms=500", { signal: controller.signal });
setTimeout(() => controller.abort(), 50);     // e.g. the user navigated away
try {
  await request;
} catch (e) {
  console.log(e.name);                         // AbortError
}
```

Cancellation matters for search-as-you-type (cancel the previous request when a new key is pressed), leaving a page, and expensive server work you no longer need. `AbortSignal.any([a, b])` combines signals ("the user cancelled **or** it took too long").

## Retries with exponential backoff

Some failures are **temporary**: a network blip, a 503 "service unavailable", a 429 "too many requests". Retrying helps, but immediately hammering a struggling server makes things worse. **Exponential backoff** waits longer after each failure (for example 100 ms, 200 ms, 400 ms…), and **jitter** (a random part) stops thousands of clients retrying in sync.

| Retry? | Errors |
|---|---|
| **yes** | network errors, timeouts, 408, 429 (respect `Retry-After`), 500, 502, 503, 504 |
| **no** | 400, 401, 403, 404, 409, 422: the same request will fail the same way |

Only retry requests that are safe to repeat (**idempotent**): repeating a GET is harmless, but repeating "charge the card" might charge twice. Payment APIs accept an **idempotency key** for this reason.

```js
for (let attempt = 1; attempt <= 4; attempt++) {
  const res = await fetch("https://shop.example/api/flaky?key=demo&fail=2");
  console.log(`attempt ${attempt}: ${res.status}`);
  if (res.ok) break;
  const wait = 50 * 2 ** (attempt - 1);              // 50, 100, 200 ms
  await new Promise((r) => setTimeout(r, wait));
}
```

## Limiting concurrency

`Promise.all` on a thousand URLs starts a thousand requests at once, which can overload the server (or your rate limit). A **concurrency limit** runs at most *n* at a time:

```js
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;                         // take the next index (safe: JavaScript is single-threaded)
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

let running = 0, peak = 0;
const names = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (id) => {
  running++; peak = Math.max(peak, running);
  const p = await (await fetch(`https://shop.example/api/products/${id}`)).json();
  running--;
  return p.name;
});
console.log(names, "at most", peak, "at a time");
```

## Streaming responses

A response body can be read **while it's still arriving**, chunk by chunk, instead of waiting for the end. That's how chat apps show an LLM's answer word by word:

```js
const res = await fetch("https://shop.example/api/stream");
const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();   // bytes → text chunks
let text = "";
for (;;) {
  const { value, done } = await reader.read();
  if (done) break;
  text += value;
  console.log(`chunk: "${value}"`);
}
console.log("complete:", text);
```

LLM APIs stream using **server-sent events** (SSE): text lines like `data: {"delta": "Hello"}`, which the client parses as they arrive. The official SDKs do this for you; the AI Engineering course covers it in detail. In newer browsers you can also write `for await (const chunk of res.body)`, but Safari doesn't support that yet, so the `getReader()` loop above is the portable form.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Timeout | Promise.race([op, timer]).finally(clear) | O(1) | O(1) |
| Cancel | fetch(url, { signal: AbortSignal.timeout(ms) }) | O(1) | O(1) |
| Retry | loop: try return await fn(); wait base × 2^(n − 1) | O(attempts) calls | O(1) |
| Limit concurrency | n workers pulling from a shared index | O(items) | O(n) |
| Stream | res.body.pipeThrough(new TextDecoderStream()).getReader() | O(chunks) | O(chunk) |

## Common mistakes

- Using `Promise.race` for a timeout and assuming the slow operation stopped.
- Leaving timeout timers running after the operation finishes.
- Retrying errors that will never succeed, or retrying non-idempotent requests.
- Starting thousands of requests at once with `Promise.all`.
- Waiting for a whole streamed response before showing anything.

## Exercises

### 1. Add a timeout to any promise

Write `withTimeout(promise, ms)` returning a promise that settles like `promise` if it settles within `ms` milliseconds, and otherwise rejects with an `Error` whose `name` is `"TimeoutError"` and whose message is `"timed out after <ms> ms"`. Clear the timer when the original promise settles first, so it doesn't keep running.

Starter code:

```js
function withTimeout(promise, ms) {
  // your code here
}

const slow = new Promise((r) => setTimeout(() => r("slow result"), 300));
try {
  console.log(await withTimeout(slow, 100));
} catch (e) {
  console.log(e.name, e.message);   // TimeoutError timed out after 100 ms
}
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** whichever settles first wins; the losing timer must be cleaned up.
2. **Examples:** a 400 ms promise with a 60 ms limit rejects at about 60 ms.
3. **Brute force:** `setTimeout` plus flags and manual resolve and reject calls: works, more error-prone.
4. **Pattern:** **race against a timer, clean up in finally**.
5. **Plan:** timer promise → race → finally clear.
6. **Code and test:** fast, slow, rejecting originals, already-resolved promises.

</details>

<details>
<summary>💡 Hint 1</summary>

Create a second promise that rejects after `ms` milliseconds, and race the two with `Promise.race`.

</details>

<details>
<summary>💡 Hint 2</summary>

Make the error with `new Error(\`timed out after ${ms} ms\`)` and then set `error.name = "TimeoutError"`.

</details>

<details>
<summary>💡 Hint 3</summary>

Keep the timer id in a variable and call `clearTimeout(timer)` in a `.finally()` on the race, so the timer stops whichever promise wins.

</details>

### 2. Retry with backoff

Write `async function retry(fn, { attempts = 3, baseDelay = 50 } = {})` that calls the async function `fn` and returns its result. If it rejects, wait `baseDelay × 2^(n − 1)` ms after the *n*-th failure and try again, up to `attempts` calls in total. If every attempt fails, throw the **last** error. Don't wait after the final attempt.

Starter code:

```js
async function retry(fn, { attempts = 3, baseDelay = 50 } = {}) {
  // your code here
}

let calls = 0;
const flaky = async () => {
  calls++;
  const res = await fetch("https://shop.example/api/flaky?key=retry-demo&fail=2");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};
console.log(await retry(flaky), "after", calls, "calls");   // { ok: true, attempt: 3 } after 3 calls
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** up to N calls, growing waits between them, the last error if all fail.
2. **Examples:** baseDelay 20 → waits 20 ms, then 40 ms.
3. **Brute force:** recursion with a counter: works, but the loop is easier to follow.
4. **Pattern:** **retry loop with exponential backoff**.
5. **Plan:** loop n = 1…attempts → try return await → catch: save, wait if more → throw last.
6. **Code and test:** immediate success, success after failures, total failure, wait sizes, no final wait.

</details>

<details>
<summary>💡 Hint 1</summary>

A `for` loop over attempt numbers, with `return await fn()` inside `try`, returns as soon as one attempt succeeds.

</details>

<details>
<summary>💡 Hint 2</summary>

In `catch`, remember the error. If attempts remain, wait: `await new Promise((r) => setTimeout(r, baseDelay * 2 ** (n - 1)))`.

</details>

<details>
<summary>💡 Hint 3</summary>

After the loop, `throw lastError;`. The `return await` matters: without `await`, a rejected promise would skip your `catch`.

</details>

**In the sandbox:** exercises 49–50. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Add a timeout to any promise</summary>

```js
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`timed out after ${ms} ms`);
      error.name = "TimeoutError";
      reject(error);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const slow = new Promise((r) => setTimeout(() => r("slow result"), 300));
try {
  console.log(await withTimeout(slow, 100));
} catch (e) {
  console.log(e.name, e.message);
}
```

**Line by line**

- The timeout promise never fulfils; it only rejects when the timer fires.
- `Promise.race` settles the same way as the first input to settle: the original's value or error, or the timeout error.
- `finally(() => clearTimeout(timer))` runs either way and stops a pending timer, so a fast success doesn't leave a timer running (which keeps Node.js processes alive and wastes work).
- Setting `name` lets callers tell timeouts apart from other failures (`if (e.name === "TimeoutError")`).

**Trace:** original 400 ms, limit 60 ms → the timer rejects first → race rejects with TimeoutError → finally clears an already-fired timer (harmless).

**Common wrong approach:** forgetting the clean-up. It's invisible in a single call, but in a server handling thousands of requests, every finished request leaves a live timer behind. And remember: a timeout stops the waiting, not the work; pass an `AbortSignal` too when the operation supports one.

</details>

<details>
<summary>✅ 2. Retry with backoff</summary>

```js
async function retry(fn, { attempts = 3, baseDelay = 50 } = {}) {
  let lastError;
  for (let n = 1; n <= attempts; n++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (n < attempts) {
        await new Promise((r) => setTimeout(r, baseDelay * 2 ** (n - 1)));
      }
    }
  }
  throw lastError;
}

let calls = 0;
const flaky = async () => {
  calls++;
  const res = await fetch("https://shop.example/api/flaky?key=retry-demo&fail=2");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};
console.log(await retry(flaky), "after", calls, "calls");
```

**Line by line**

- `return await fn()` inside `try` is essential: `await` makes a rejection throw **here**, where `catch` can handle it. A bare `return fn()` would hand back the rejected promise and skip the retry.
- `2 ** (n - 1)` doubles the wait each time: 1×, 2×, 4× the base delay.
- `if (n < attempts)` skips the pointless wait after the final failure.
- Throwing the last error tells the caller what most recently went wrong.

**Trace:** fails, fails, succeeds with baseDelay 20 → call 1 fails → wait 20 → call 2 fails → wait 40 → call 3 succeeds → return "ok".

**Common wrong approach:** retrying every error, including 400 Bad Request or 404 Not Found, which will fail identically each time. Production retry helpers take a `shouldRetry(error)` option, add random jitter, and respect `Retry-After` headers.

</details>

## Quick quiz

1. Promise.race([request, timeout(200)]) rejects after 200 ms. Is the request cancelled?
   - A) No; only the waiting stops. Pass an AbortSignal to cancel the request itself
   - B) Yes, race cancels the losing promises
   - C) Only if the server supports it

2. Which errors are worth retrying?
   - A) Temporary ones: network errors, timeouts, 429 and 5xx responses
   - B) All errors
   - C) 400 and 404

3. Why add jitter to exponential backoff?
   - A) So many clients don't all retry at the same moment
   - B) To make retries faster
   - C) To avoid the need for timeouts

4. How do chat apps show an LLM's answer word by word?
   - A) They read the response body as a stream and display each chunk as it arrives
   - B) They poll the server every millisecond
   - C) The browser does it automatically for long responses

<details>
<summary>Quiz answers</summary>

1. **A) No; only the waiting stops. Pass an AbortSignal to cancel the request itself**: Promises can't be cancelled; operations can, through signals.
2. **A) Temporary ones: network errors, timeouts, 429 and 5xx responses**: Client errors fail the same way every time.
3. **A) So many clients don't all retry at the same moment**: Synchronised retries can overload a recovering server.
4. **A) They read the response body as a stream and display each chunk as it arrives**: LLM APIs stream with server-sent events.

</details>

---
Previous: [Lesson 24](24-fetch-and-apis.md) · Next: [Lesson 26: Web pages and the DOM](26-the-dom.md)
