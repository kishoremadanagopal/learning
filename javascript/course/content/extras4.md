@@ event-loop
topics: single-threaded JavaScript, synchronous and asynchronous code, the call stack, the runtime's timers and I/O, the task (macrotask) queue, the microtask queue, why setTimeout(fn, 0) isn't immediate, blocking the main thread, Web Workers, callbacks and callback hell, debouncing and throttling
terms:
- **Single-threaded:** running one piece of code at a time on one thread.
- **Asynchronous:** started now and finished later, without blocking other code.
- **Call stack:** the functions currently running; synchronous code runs until it's empty.
- **Event loop:** the mechanism that runs queued callbacks whenever the call stack is empty.
- **Task (macrotask):** a queued callback from a timer, event or I/O; one runs per loop turn.
- **Microtask:** a queued promise callback or `queueMicrotask` function; all run before the next task.
- **Callback:** a function passed to be called later, when something finishes.
- **Debounce:** delay an action until calls stop arriving for a while.
- **Throttle:** allow an action at most once per time period.
mistakes:
- Expecting `setTimeout(fn, 0)` to run before promise callbacks.
- Running long synchronous loops on the main thread, freezing the page.
- Nesting callbacks many levels deep.
- Confusing debouncing with throttling.

glance:
- Order of execution | sync code → all microtasks → one task → repeat | — | —
- Heavy computation | move it to a Web Worker | O(work) off the main thread | O(data copied)
- Debounce | clear the pending timer; set a new one | O(1) per call | O(1)

@@ promises
topics: promise states, fulfilling and rejecting, then, catch and finally, chaining and returning values, error propagation, unhandled rejections, new Promise and promisifying callbacks, Promise.withResolvers, Promise.resolve and reject, Promise.all, allSettled, race and any, writing Promise.all yourself
terms:
- **Promise:** an object representing a result that will be available later.
- **Pending / fulfilled / rejected:** a promise's states: waiting, succeeded with a value, failed with a reason.
- **Settled:** fulfilled or rejected; a settled promise never changes.
- **Promise chain:** a sequence of `then` calls, each receiving the previous step's result.
- **Unhandled rejection:** a rejected promise with no `catch` or `await` to handle it.
- **Promisify:** wrap a callback-based function so it returns a promise.
- **`Promise.all`:** waits for all promises; rejects as soon as one rejects.
- **`Promise.allSettled`:** waits for all promises and reports each outcome.
mistakes:
- Forgetting to `return` inside a `then` callback.
- Leaving rejections unhandled.
- Nesting `then` calls instead of chaining them.
- Throwing synchronously from a function that should return a promise.
- Collecting `Promise.all`-style results in completion order instead of input order.

glance:
- Wait for several | await Promise.all([a, b, c]) | max of their times | O(n)
- Keep every outcome | Promise.allSettled(ps) | max of their times | O(n)
- Wrap a callback API | new Promise((resolve, reject) => …) | O(1) | O(1)

@@ async-await
topics: async functions and their promises, await, error handling with try / catch / finally, sequential versus parallel awaits, Promise.all with map, await in loops and why not forEach, top-level await, async iterables, for await, async generators, Array.fromAsync, common async mistakes
terms:
- **`async` function:** a function that always returns a promise and can use `await`.
- **`await`:** pauses the current async function until a promise settles, then gives its value or throws its error.
- **Top-level await:** `await` used directly in a module, outside any function.
- **Sequential:** one operation after another, each waiting for the previous one.
- **Parallel (concurrent):** several operations in flight at the same time.
- **Async iterable:** a source of values that arrive over time, looped with `for await`.
- **Async generator:** an `async function*` that yields values over time.
mistakes:
- Forgetting `await` and using a promise as if it were the value.
- Awaiting independent operations one after another.
- Using `await` inside `forEach`.
- Not catching errors from async functions.
- Passing already-started promises when work must run in sequence.

glance:
- Independent work | await Promise.all(items.map(async (x) => …)) | slowest item | O(n)
- Dependent steps | const a = await f(); const b = await g(a) | sum of steps | O(1)
- One at a time | for (const job of jobs) await job() | sum of jobs | O(1)
- Values over time | for await (const x of source) | O(items) | O(1)

@@ fetch-and-apis
topics: HTTP methods, URLs, status codes, headers and bodies, APIs, fetch and Response, response.ok, reading JSON and text, why fetch doesn't reject on HTTP errors, a getJSON helper, building URLs with URL and URLSearchParams, POST with a JSON body and Content-Type, handling API error messages, CORS, keeping secret API keys on the server, the course's practice API
terms:
- **API:** a set of URLs (endpoints) a program can call to read or change data.
- **HTTP method:** the kind of request: GET reads, POST creates, PUT or PATCH updates, DELETE removes.
- **Status code:** a number describing the result, such as 200 OK or 404 Not Found.
- **Header:** a named piece of metadata on a request or response, such as `Content-Type`.
- **`response.ok`:** true when the status is 200–299.
- **Query string:** the `?key=value&…` part of a URL.
- **CORS:** browser rules that decide whether a page may read responses from another site.
mistakes:
- Assuming `fetch` rejects on 404 or 500 responses.
- Building query strings by joining text instead of using `URLSearchParams`.
- Sending an object as the body without `JSON.stringify`.
- Reading a response body twice.
- Putting secret API keys in browser code.

glance:
- Read JSON | const res = await fetch(url); if (!res.ok) throw …; await res.json() | one request | O(body)
- Send JSON | fetch(url, { method: "POST", headers, body: JSON.stringify(data) }) | one request | O(body)
- Safe URLs | new URL(path, base) with searchParams.set | O(length) | O(length)

@@ async-patterns
topics: timeouts with Promise.race, cleaning up timers, cancellation with AbortController and AbortSignal, AbortSignal.timeout and AbortSignal.any, retries with exponential backoff and jitter, which errors to retry, idempotency and idempotency keys, limiting concurrency, reading streamed responses with readers and TextDecoderStream, server-sent events and LLM streaming
terms:
- **Timeout:** giving up waiting after a set time.
- **AbortController / AbortSignal:** a way to cancel operations such as `fetch` that accept a signal.
- **Exponential backoff:** waiting twice as long after each failed attempt.
- **Jitter:** a random amount added to retry delays so clients don't retry in sync.
- **Idempotent:** safe to repeat: doing it twice has the same effect as once.
- **Concurrency limit:** the maximum number of operations allowed to run at the same time.
- **Stream:** data delivered in chunks over time instead of all at once.
- **Server-sent events (SSE):** a format for a server to push a stream of text events over HTTP.
mistakes:
- Using `Promise.race` for a timeout and assuming the slow operation stopped.
- Leaving timeout timers running after the operation finishes.
- Retrying errors that will never succeed, or retrying non-idempotent requests.
- Starting thousands of requests at once with `Promise.all`.
- Waiting for a whole streamed response before showing anything.

glance:
- Timeout | Promise.race([op, timer]).finally(clear) | O(1) | O(1)
- Cancel | fetch(url, { signal: AbortSignal.timeout(ms) }) | O(1) | O(1)
- Retry | loop: try return await fn(); wait base × 2^(n − 1) | O(attempts) calls | O(1)
- Limit concurrency | n workers pulling from a shared index | O(items) | O(n)
- Stream | res.body.pipeThrough(new TextDecoderStream()).getReader() | O(chunks) | O(chunk)
