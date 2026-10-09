@@@ part
id: 4
title: Asynchronous JavaScript
level: Intermediate
blurb: Doing things that take time without freezing the page: the event loop, promises, async and await, calling web APIs with fetch, and the patterns real apps need: timeouts, retries, cancellation, limiting concurrency and streaming responses.

@@@ lesson
id: event-loop
title: The event loop
minutes: 24
summary: Why JavaScript is single-threaded, synchronous versus asynchronous code, the call stack, callbacks and timers, the task (macrotask) queue and the microtask queue, why setTimeout(fn, 0) isn't immediate, how long-running code blocks everything, and Web Workers for heavy work.
---
JavaScript runs your code on **one thread**: it does one thing at a time. Yet a web page can wait for a network response, run a timer and react to clicks all at once. The trick is that JavaScript never **waits**: slow operations are handed to the browser (or Node.js), and JavaScript is told when they finish. The mechanism that coordinates this is the **event loop**.

### Synchronous and asynchronous

**Synchronous** code runs line by line, each line finishing before the next starts. **Asynchronous** code starts something now and handles the result **later**:

```js
console.log("1. order placed");
setTimeout(() => console.log("3. email sent (after 50 ms)"), 50);
console.log("2. thank-you page shown");
```

`setTimeout` doesn't pause anything. It asks the runtime to call the function in 50 ms, and returns immediately; the program carries on.

### How it works

![The event loop. Your code runs on the call stack. Calls like setTimeout and fetch hand work to the runtime (timers, network). When that work finishes, its callback is put in a queue: the task queue for timers and events, or the microtask queue for promise callbacks. Whenever the call stack is empty, the event loop first runs every microtask, then takes one task, and repeats](figures/event-loop.svg)

- The **call stack** holds the functions currently running. Synchronous code always runs to completion: nothing can interrupt it.
- When a timer fires, a network response arrives or the user clicks, the callback is placed in a **queue**.
- Whenever the stack is empty, the **event loop** takes the next callback from a queue and runs it.

There are two queues, and the difference matters:

| Queue | Holds | When it runs |
|---|---|---|
| **microtask** queue | promise callbacks (`then`, `await` continuations), `queueMicrotask` | **all** of them, as soon as the current code finishes |
| **task** (macrotask) queue | timers, events, I/O completions | **one** at a time, after the microtasks are drained |

```js
console.log("A: synchronous");
setTimeout(() => console.log("D: timeout (task)"), 0);
Promise.resolve().then(() => console.log("C: promise (microtask)"));
queueMicrotask(() => console.log("C2: another microtask"));
console.log("B: still synchronous");
```

So `setTimeout(fn, 0)` doesn't mean "now": it means "as a new task, after everything already running and every pending microtask". (Browsers also enforce a minimum delay of about 4 ms for nested timers.)

### Don't block the loop

While your code runs, **nothing else can**: no clicks, no rendering, no timers. A long synchronous loop freezes the page:

```js
const start = Date.now();
setTimeout(() => console.log(`timer ran after ${Date.now() - start} ms (asked for 10)`), 10);
let x = 0;
while (Date.now() - start < 200) x++;      // busy for 200 ms: the timer has to wait
console.log("busy loop done");
```

For heavy computation (image processing, big data crunching, running Python in the browser like this site's other courses), move the work into a **Web Worker**, a separate thread that talks to the page by messages. This sandbox runs your code in one, which is why **Stop** can end an endless loop.

### Callbacks

The original way to handle "later" was to pass a **callback** function. It works, but sequences of steps nest deeper and deeper, the infamous **callback hell**, and error handling has to be repeated at every level:

```js
function getUser(id, done) { setTimeout(() => done(null, { id, name: "Ada" }), 10); }
function getOrders(user, done) { setTimeout(() => done(null, [{ id: 1001, total: 800 }]), 10); }

getUser(7, (err, user) => {
  if (err) return console.log("failed", err);
  getOrders(user, (err, orders) => {
    if (err) return console.log("failed", err);
    console.log(`${user.name} has ${orders.length} order(s)`);
  });
});
```

Promises (Lesson 22) and `async`/`await` (Lesson 23) replace this with flat, readable code.

:::exercise Predict the order
Read this code, then set `answer` to an array of the labels in the order they're printed. (Run your answer with Check; don't run the snippet itself first, or you'll miss the point!)

```js-static
console.log("start");
setTimeout(() => console.log("timeout 1"), 0);
Promise.resolve().then(() => {
  console.log("promise 1");
  setTimeout(() => console.log("timeout 2"), 0);
}).then(() => console.log("promise 2"));
queueMicrotask(() => console.log("microtask"));
console.log("end");
```
```js starter
const answer = ["start", /* … */];
```
```js check
const a = need("answer");
if (!Array.isArray(a)) throw new AssertionError("answer should be an array of labels.");
same(a, ["start", "end", "promise 1", "microtask", "promise 2", "timeout 1", "timeout 2"], "Your order");
```
```js solution
const answer = ["start", "end", "promise 1", "microtask", "promise 2", "timeout 1", "timeout 2"];
```
hint: First, everything synchronous runs: which two lines are those?
hint: Then all microtasks run, in the order they were queued, including microtasks queued **by** microtasks. The second `then` is queued only when the first one finishes.
hint: Timers (tasks) come last, in the order they were scheduled: "timeout 1" was scheduled before "timeout 2", which was only scheduled inside "promise 1".
approach:
1. **Understand:** three kinds of work: synchronous code, microtasks, tasks.
2. **Examples:** `setTimeout(…, 0)` always comes after pending promise callbacks.
3. **Brute force:** run it and copy the output: you'd learn nothing!
4. **Pattern:** **simulate the queues** by hand.
5. **Plan:** run sync code, noting what each line queues → drain microtasks (adding new ones to the end) → run tasks in order.
6. **Code and test:** write the order, press Check, then run the snippet to see it happen.
walkthrough:
**Line by line**

- Synchronous: "start", then `setTimeout` queues task T1, `then` queues microtask P1, `queueMicrotask` queues M, then "end".
- Microtasks: P1 runs, printing "promise 1" and queueing task T2; when P1 finishes, its follow-up `then` (P2) is queued behind M.
- M runs: "microtask". Then P2: "promise 2". The microtask queue is now empty.
- Tasks: T1 "timeout 1", then T2 "timeout 2".

**Trace:** start, end, promise 1, microtask, promise 2, timeout 1, timeout 2.

**Common wrong approach:** thinking a `0` ms timeout runs before promises, or that "promise 2" runs right after "promise 1". Chained `then` callbacks are separate microtasks, queued only when the previous one finishes.
:::

:::exercise Debounce
A search box shouldn't call the server on every keystroke. Write `debounce(fn, wait)` returning a new function that delays calling `fn` until `wait` ms have passed **without** another call. Each new call restarts the wait; `fn` then runs once, with the arguments of the **last** call.
```js starter
function debounce(fn, wait) {
  // your code here
}

const search = debounce((q) => console.log("searching for", q), 50);
search("b"); search("bi"); search("bik");
setTimeout(() => search("bike"), 120);
// searching for bik   (after about 50 ms)
// searching for bike  (after about 170 ms)
```
```js check
const d = need("debounce", "function");
const calls = [];
const f = d((...args) => calls.push(args), 40);
f(1); f(2); f(3, "x");
await new Promise((r) => setTimeout(r, 20));
same(calls.length, 0, "Calls made before the wait has passed");
await new Promise((r) => setTimeout(r, 60));
same(calls, [[3, "x"]], "The calls after a burst (one call, with the last arguments)");
f(4);
await new Promise((r) => setTimeout(r, 25));
f(5);
await new Promise((r) => setTimeout(r, 25));
same(calls.length, 1, "Calls while new calls keep restarting the wait");
await new Promise((r) => setTimeout(r, 40));
same(calls, [[3, "x"], [5]], "The calls after the second burst");
const g1 = [], g2 = [];
const a = d((x) => g1.push(x), 20), b = d((x) => g2.push(x), 20);
a("a"); b("b");
await new Promise((r) => setTimeout(r, 50));
same([g1, g2], [["a"], ["b"]], "Two separate debounced functions");
```
```js solution
function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);                              // cancel the previous pending call
    timer = setTimeout(() => fn(...args), wait);      // and schedule a new one
  };
}

const search = debounce((q) => console.log("searching for", q), 50);
search("b"); search("bi"); search("bik");
setTimeout(() => search("bike"), 120);
```
hint: The returned function needs to remember a pending timer between calls: a closure (Lesson 8).
hint: On every call, cancel the pending timer with `clearTimeout`, then start a new one with `setTimeout`.
hint: `return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); };` with `let timer = null;` above it.
approach:
1. **Understand:** a burst of calls → one call, `wait` ms after the last one, with the last arguments.
2. **Examples:** "b", "bi", "bik" within 50 ms → one search for "bik".
3. **Brute force:** compare timestamps on each call and skip some: still needs a timer for the final call.
4. **Pattern:** **closure over a timer id; cancel and reschedule**.
5. **Plan:** `let timer` → returned function clears and sets the timer.
6. **Code and test:** bursts, gaps, last arguments win, independent debouncers.
walkthrough:
**Line by line**

- `timer` lives in the closure, shared by every call of this debounced function, but separate for each `debounce(...)`.
- `clearTimeout(timer)` cancels the previous pending call (it's harmless when `timer` is `null`).
- The new timeout captures this call's `args`, so when it finally fires, it uses the last arguments.

**Trace:** f(1) schedules at 40 ms; f(2) cancels it and schedules again; f(3, "x") likewise; nothing more arrives, so after 40 ms fn(3, "x") runs once.

**Common wrong approach:** calling `fn` immediately and ignoring later calls for `wait` ms. That's **throttling** (useful for scroll handlers), not debouncing: a search box would then search for "b" instead of the finished word.
:::

:::quiz
? How many things does JavaScript's main thread do at once?
+ One; asynchronous work is handed to the runtime and finished later
- As many as there are CPU cores
- Two: one for timers and one for code
= The event loop runs callbacks one at a time.
? Which runs first after the current code: a resolved promise's then callback, or a setTimeout(…, 0) callback?
+ The promise callback (a microtask)
- The setTimeout callback
- It's random
= All microtasks run before the next task.
? What happens to a 10 ms timer while a loop keeps the thread busy for 200 ms?
+ It waits until the loop finishes, so it fires after about 200 ms
- It interrupts the loop after 10 ms
- It's cancelled
= Synchronous code always runs to completion.
? Where should heavy computation go to keep a page responsive?
+ A Web Worker
- A setTimeout of 0
- A promise
= Promises don't add threads; workers do.
:::

@@@ lesson
id: promises
title: Promises
minutes: 26
summary: What a promise is (pending, fulfilled, rejected), creating promises with new Promise and Promise.withResolvers, then, catch and finally, chaining and returning values, error propagation, turning callbacks into promises, combining promises with all, allSettled, race and any, and common mistakes.
---
A **promise** is an object representing a result that isn't ready yet. It starts **pending**, and later becomes **fulfilled** (with a value) or **rejected** (with an error). Once settled, it never changes.

### Using promises

```js
const response = fetch("https://shop.example/api/products/2");   // starts the request, returns a promise
console.log(response instanceof Promise);
response
  .then((res) => res.json())                // runs when the response arrives; returns another promise
  .then((product) => console.log(product.name, product.price))
  .catch((err) => console.log("Failed:", err.message))
  .finally(() => console.log("done (success or failure)"));
```

The sandbox answers `https://shop.example/...` requests itself, after a short delay, so the lessons in this part can use the real `fetch` without a server (Lesson 24 lists the endpoints).

- `.then(fn)` runs `fn` with the value when the promise fulfils, and returns a **new** promise for whatever `fn` returns.
- `.catch(fn)` handles a rejection anywhere earlier in the chain.
- `.finally(fn)` runs either way, for clean-up.

### Chaining

Each `then` returns a new promise, so steps chain flatly instead of nesting. If a callback returns a promise, the chain waits for it:

```js
function delay(ms, value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
delay(20, 2)
  .then((n) => n * 10)                    // a plain value passes straight on
  .then((n) => delay(20, n + 1))          // a promise: the chain waits for it
  .then((n) => console.log("result", n));
```

**Always return** from a `then` callback when the next step needs the value; forgetting `return` passes `undefined` along and is one of the most common promise bugs.

### Errors propagate

A thrown error or a rejected promise skips the remaining `then` callbacks until a `catch`:

```js
Promise.resolve(5)
  .then((n) => { if (n > 3) throw new RangeError("too big"); return n; })
  .then((n) => console.log("never runs", n))
  .catch((e) => { console.log("caught:", e.message); return 0; })   // recover with a fallback
  .then((n) => console.log("continues with", n));
```

A rejected promise that nobody handles is an **unhandled rejection**: browsers log it, and Node.js stops the program. End every chain with a `catch` (or `await` it inside `try`).

### Creating promises

`new Promise((resolve, reject) => { … })` wraps callback-style code. Call `resolve(value)` on success or `reject(error)` on failure:

```js
function loadImageSize(url) {
  return new Promise((resolve, reject) => {
    // pretend loader: succeeds for .png, fails otherwise
    setTimeout(() => (url.endsWith(".png") ? resolve({ url, width: 640 }) : reject(new Error(`can't load ${url}`))), 10);
  });
}
loadImageSize("bike.png").then((img) => console.log(img.width));
loadImageSize("bike.txt").catch((e) => console.log(e.message));

const { promise, resolve } = Promise.withResolvers();   // ES2024: resolve from outside
setTimeout(() => resolve("resolved later"), 10);
promise.then(console.log);
```

Most modern APIs already return promises, so you'll rarely need `new Promise` except to wrap old callback APIs or timers.

### Combining promises

| Method | Fulfils when | Rejects when |
|---|---|---|
| `Promise.all(ps)` | **all** fulfil (an array of values, in order) | **any** rejects (the first error) |
| `Promise.allSettled(ps)` | all settle, either way (an array of `{status, value \| reason}`) | never |
| `Promise.race(ps)` | the **first** to settle fulfils | the first to settle rejects |
| `Promise.any(ps)` | the first to **fulfil** | all reject (an `AggregateError`) |

```js
const get = (id) => fetch(`https://shop.example/api/products/${id}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`no product ${id}`))));

const [a, b] = await Promise.all([get(1), get(2)]);          // run in parallel, wait for both
console.log(a.name, "+", b.name);

const results = await Promise.allSettled([get(1), get(99)]);
console.log(results.map((r) => (r.status === "fulfilled" ? r.value.name : `failed: ${r.reason.message}`)));

try {
  await Promise.all([get(1), get(99), get(2)]);
} catch (e) {
  console.log("all() failed fast:", e.message);
}
```

(Top-level `await`, used above, is Lesson 23's subject: it waits for a promise and gives its value.)

:::exercise A delay helper
Write `delay(ms, value)` returning a promise that fulfils with `value` after `ms` milliseconds. If `ms` is negative or not a number, the promise should **reject** with a `RangeError` (don't throw synchronously).
```js starter
function delay(ms, value) {
  // your code here
}

delay(30, "ready").then((v) => console.log(v));   // ready (after 30 ms)
```
```js check
const d = need("delay", "function");
const t0 = Date.now();
same(await d(40, "x"), "x", "await delay(40, 'x')");
const took = Date.now() - t0;
if (took < 35) throw new AssertionError(`delay(40) fulfilled after only ${took} ms.`);
same(await d(0), undefined, "await delay(0) with no value");
let p;
try { p = d(-5); } catch (e) { throw new AssertionError("delay(-5) threw synchronously; return a rejected promise instead."); }
if (!(p instanceof Promise)) throw new AssertionError("delay should return a promise.");
let err = null;
try { await p; } catch (e) { err = e; }
if (!(err instanceof RangeError)) throw new AssertionError("delay(-5) should reject with a RangeError.");
let err2 = null;
try { await d("soon"); } catch (e) { err2 = e; }
if (!(err2 instanceof RangeError)) throw new AssertionError('delay("soon") should reject with a RangeError.');
```
```js solution
function delay(ms, value) {
  return new Promise((resolve, reject) => {
    if (typeof ms !== "number" || Number.isNaN(ms) || ms < 0) {
      reject(new RangeError(`delay needs a non-negative number of ms, not ${ms}`));
      return;
    }
    setTimeout(() => resolve(value), ms);
  });
}

delay(30, "ready").then((v) => console.log(v));
```
hint: `new Promise((resolve, reject) => { … })` gives you two functions: call `resolve(value)` for success, `reject(error)` for failure.
hint: Inside, start a timer: `setTimeout(() => resolve(value), ms)`.
hint: Validate first and call `reject(new RangeError(...))` (and `return`) instead of throwing, so callers get a rejected promise either way.
approach:
1. **Understand:** wrap a timer in a promise; bad input becomes a rejection, not an exception.
2. **Examples:** `await delay(40, "x")` gives "x" after about 40 ms.
3. **Brute force:** `async function delay` with `await new Promise(...)`: also fine (async functions turn throws into rejections).
4. **Pattern:** **promisify** a callback API.
5. **Plan:** new Promise → validate → reject, or setTimeout → resolve.
6. **Code and test:** timing, missing value, negative and non-numeric ms.
walkthrough:
**Line by line**

- The executor function runs immediately; `resolve` and `reject` settle the promise later or now.
- Calling `reject` instead of `throw` keeps the function's contract simple: it **always** returns a promise, so callers handle every failure in one place (`catch` or `try`/`await`).
- `return` after `reject` stops the timer from being started.
- `setTimeout(() => resolve(value), ms)` fulfils the promise when the time is up.

**Trace:** `delay(-5)` → validation fails → `reject(RangeError)` → the returned promise is rejected → `await` throws it.

**Common wrong approach:** `function delay(ms) { setTimeout(() => {}, ms); return Promise.resolve(); }`, which fulfils immediately: the timer and the promise aren't connected. The promise must be resolved **from inside** the timer callback.
:::

:::exercise Write Promise.all yourself
Write `all(promises)` behaving like `Promise.all`: it returns a promise that fulfils with an array of the results **in the original order** once every input fulfils, or rejects with the first rejection's reason. Inputs may also be plain values (treat them as already fulfilled), and an empty array fulfils with `[]`. Don't use `Promise.all`, `allSettled`, `race` or `any`.
```js starter
function all(promises) {
  // your code here
}

const later = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));
all([later(30, "a"), later(10, "b"), "c"]).then(console.log);   // [ 'a', 'b', 'c' ]
```
```js check
const allFn = need("all", "function");
if (/Promise\.(all|allSettled|race|any)\b/.test(__source__.replace(/\/\/.*$/gm, ""))) {
  throw new AssertionError("Build it yourself, without Promise.all, allSettled, race or any.");
}
const later = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));
const fail = (ms, msg) => new Promise((_, j) => setTimeout(() => j(new Error(msg)), ms));
same(await allFn([later(30, "a"), later(10, "b"), "c"]), ["a", "b", "c"], "Results in input order");
same(await allFn([]), [], "An empty list");
same(await allFn([1, 2]), [1, 2], "Plain values");
let err = null;
const t0 = Date.now();
try { await allFn([later(200, "slow"), fail(20, "boom"), fail(40, "second")]); } catch (e) { err = e; }
if (!err || err.message !== "boom") throw new AssertionError("all should reject with the FIRST rejection (boom).");
if (Date.now() - t0 > 150) throw new AssertionError("all should reject as soon as one input rejects, without waiting for the rest.");
const p = allFn([later(10, 1)]);
if (!(p instanceof Promise)) throw new AssertionError("all should return a promise.");
```
```js solution
function all(promises) {
  return new Promise((resolve, reject) => {
    const results = new Array(promises.length);
    let remaining = promises.length;
    if (remaining === 0) return resolve([]);
    promises.forEach((item, i) => {
      Promise.resolve(item).then((value) => {
        results[i] = value;                 // store by index, so order matches the input
        remaining--;
        if (remaining === 0) resolve(results);
      }, reject);                           // the first rejection settles the outer promise
    });
  });
}

const later = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));
all([later(30, "a"), later(10, "b"), "c"]).then(console.log);
```
hint: Return a `new Promise`. Inside, attach a `then` to every input and count how many have fulfilled.
hint: Results arrive in completion order, not input order: store each one at its index, `results[i] = value`. `Promise.resolve(item)` turns plain values into promises.
hint: When the counter reaches the number of inputs, `resolve(results)`. Pass `reject` as the second argument to each `then`; a promise can only settle once, so later rejections are ignored.
approach:
1. **Understand:** wait for all, keep input order, fail fast on the first error.
2. **Examples:** "b" finishes before "a", but the result is still [a, b, c].
3. **Brute force:** await each in turn in a loop: correct values, but rejections are noticed late (only when reached).
4. **Pattern:** **counter + indexed results inside a new Promise**.
5. **Plan:** handle empty → for each input: resolve it, store by index, decrement, resolve at zero; reject on any error.
6. **Code and test:** order, empty, plain values, first rejection, fail-fast timing.
walkthrough:
**Line by line**

- `new Array(promises.length)` with indexed assignment keeps results in input order regardless of finishing order.
- `Promise.resolve(item)` wraps plain values (and passes promises through), so every input can be treated alike.
- The counter, not `results.length`, tracks completion: assigning `results[2]` first would already make the length 3.
- Passing `reject` directly means the first failure settles the outer promise; later `reject` or `resolve` calls do nothing, because a promise settles only once.

**Trace:** inputs a (30 ms), b (10 ms), "c" (now): c stored at 2 (remaining 2), b at 1 (remaining 1), a at 0 → remaining 0 → resolve [a, b, c].

**Common wrong approach:** `results.push(value)`, which records results in finishing order: [c, b, a].
:::

:::quiz
? What does .then(fn) return?
+ A new promise for whatever fn returns
- The value fn returns, immediately
- The same promise
= That's what makes chaining work.
? A then callback forgets to return a value. What does the next then receive?
+ undefined
- The previous value
- An error
= Always return when the next step needs the value.
? Which combinator never rejects?
+ Promise.allSettled
- Promise.all
- Promise.race
= It reports every outcome as fulfilled or rejected.
? What happens to an unhandled promise rejection?
+ Browsers log an error; Node.js stops the program by default
- It's silently ignored everywhere
- It becomes a fulfilled promise
= End chains with catch, or await inside try.
:::

@@@ lesson
id: async-await
title: async and await
minutes: 26
summary: async functions and what they return, await and how it pauses only the current function, error handling with try / catch, sequential versus parallel awaits, await in loops, top-level await in modules, async iteration with for await and async generators, and common mistakes.
---
`async` and `await` let you write promise-based code that reads like ordinary step-by-step code.

```js
async function productSummary(id) {
  const res = await fetch(`https://shop.example/api/products/${id}`);   // wait for the response
  const product = await res.json();                                     // wait for the body
  return `${product.name}: £${(product.price / 100).toFixed(2)}`;
}

const summary = await productSummary(4);
console.log(summary);
```

- An **`async` function** always returns a **promise**: returning a value fulfils it; throwing rejects it.
- **`await` promise** pauses **this function** until the promise settles, then gives its value (or throws its error). Other code, timers and events keep running meanwhile.
- `await` can only be used inside `async` functions, or at the top level of a module (and of this sandbox).

### Errors: try / catch

A rejected promise makes `await` throw, so ordinary `try`/`catch` works:

```js
async function loadProduct(id) {
  try {
    const res = await fetch(`https://shop.example/api/products/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.log(`Couldn't load product ${id}:`, error.message);
    return null;
  } finally {
    console.log(`(finished loading ${id})`);
  }
}
console.log(await loadProduct(1));
console.log(await loadProduct(42));
```

### Sequential versus parallel

`await` one after another runs operations **in sequence**: each starts only when the previous one has finished. When they don't depend on each other, start them all and await them together:

```js
const get = (id) => fetch(`https://shop.example/api/products/${id}`).then((r) => r.json());

let t = Date.now();
const p1 = await get(1);
const p2 = await get(2);
const p3 = await get(3);
console.log(`sequential: ${Date.now() - t} ms`);    // about 3 × 30 ms

t = Date.now();
const [q1, q2, q3] = await Promise.all([get(1), get(2), get(3)]);
console.log(`parallel: ${Date.now() - t} ms`);      // about 30 ms
```

Use sequential awaits when a step needs the previous result (get the user, **then** their orders) or when you must limit the load on a server; use `Promise.all` for independent work.

### await in loops

```js
const ids = [1, 2, 3];
const get = (id) => fetch(`https://shop.example/api/products/${id}`).then((r) => r.json());

for (const id of ids) {                     // one at a time, in order
  const p = await get(id);
  console.log("loaded", p.name);
}

const names = await Promise.all(ids.map(async (id) => (await get(id)).name));   // all at once
console.log(names);

ids.forEach(async (id) => { await get(id); });   // ✗ forEach doesn't wait: the loop "finishes" immediately
console.log("forEach returned before any request finished");
```

`forEach` ignores the promises its callback returns, so `await` inside it doesn't make the loop wait. Use `for…of` (sequential) or `map` + `Promise.all` (parallel).

### Async iteration

`for await (const x of source)` loops over an **async iterable**: a source whose values arrive over time, such as the chunks of a streamed response or pages of an API. An **async generator** (`async function*`) creates one:

```js
async function* pages(total) {
  for (let page = 1; page <= total; page++) {
    await new Promise((r) => setTimeout(r, 20));      // pretend to fetch a page
    yield [`item ${page * 2 - 1}`, `item ${page * 2}`];
  }
}
for await (const items of pages(3)) {
  console.log(items);
}
console.log(await Array.fromAsync(pages(2)));         // ES2024: collect everything
```

### Common mistakes

- **Forgetting `await`**: you get a promise instead of the value (`Promise { … }` printed, or `undefined` properties).
- **Awaiting in sequence by accident**, making independent requests slow.
- **`await` inside `forEach`**.
- **Not handling errors**: an `async` function that throws produces a rejected promise; someone must `catch` it.

:::exercise Total stock, in parallel
Write `async function totalStock(ids)` that fetches each product from `https://shop.example/api/products/<id>` **in parallel** and returns the sum of their `stock` values. If any product is missing (the response isn't `ok`), throw an `Error` with the message `"product <id> not found"`.
```js starter
async function totalStock(ids) {
  // your code here
}

console.log(await totalStock([1, 2, 4]));   // 64 (42 + 15 + 7)
```
```js check
const ts = need("totalStock", "function");
let t0 = Date.now();
same(await ts([1, 2, 4]), 64, "totalStock([1, 2, 4])");
const took = Date.now() - t0;
same(await ts([]), 0, "totalStock([])");
same(await ts([3]), 0, "totalStock([3]) (out of stock)");
t0 = Date.now();
await ts([1, 2, 3, 4, 5, 6]);
if (Date.now() - t0 > 150) throw new AssertionError(`Fetching 6 products took ${Date.now() - t0} ms: start the requests together (Promise.all) rather than one after another.`);
let err = null;
try { await ts([1, 99, 2]); } catch (e) { err = e; }
if (!err || err.message !== "product 99 not found") throw new AssertionError('totalStock([1, 99, 2]) should throw an Error "product 99 not found".');
```
```js solution
async function totalStock(ids) {
  const products = await Promise.all(ids.map(async (id) => {
    const res = await fetch(`https://shop.example/api/products/${id}`);
    if (!res.ok) throw new Error(`product ${id} not found`);
    return res.json();
  }));
  return products.reduce((sum, p) => sum + p.stock, 0);
}

console.log(await totalStock([1, 2, 4]));
```
hint: `ids.map(async (id) => { … })` starts one request per id and gives you an array of promises; `await Promise.all(...)` waits for all of them.
hint: Inside the async callback: `const res = await fetch(...)`, then `if (!res.ok) throw new Error(...)`, then `return res.json()`.
hint: Sum the stock with `reduce((sum, p) => sum + p.stock, 0)`. A throw inside any callback makes `Promise.all` reject, which `await` turns back into a throw.
approach:
1. **Understand:** independent requests → parallel; one failure fails the whole call.
2. **Examples:** 3 requests of 30 ms each should take about 30 ms, not 90.
3. **Brute force:** a `for…of` loop with `await`: correct sums, but slow (sequential).
4. **Pattern:** **map to promises + Promise.all**.
5. **Plan:** map ids to async fetchers → Promise.all → reduce.
6. **Code and test:** sums, empty list, zero stock, a missing product, timing.
walkthrough:
**Line by line**

- The `async` arrow function passed to `map` runs once per id; each call starts its `fetch` immediately and returns a promise.
- Checking `res.ok` matters: `fetch` only rejects on network failure, not on a 404 response (Lesson 24).
- `Promise.all` waits for every product, or rejects with the first error, which the outer `await` rethrows as an exception from `totalStock`.
- `reduce` with a start of 0 handles the empty list.

**Trace:** ids [1, 2, 4] → three requests in flight together → stocks 42, 15, 7 → 64.

**Common wrong approach:** `ids.forEach(async (id) => { total += … })` and then `return total`: `forEach` doesn't wait, so the function returns 0 before any response arrives.
:::

:::exercise Run jobs one at a time
Write `async function runInOrder(jobs)`, where each job is a function returning a promise. Run them **one after another** (each starts only after the previous one finishes) and return `{ results, failedAt }`: `results` holds the results of the jobs that succeeded, in order; if a job rejects, stop and set `failedAt` to its index. If all succeed, `failedAt` is `null`.
```js starter
async function runInOrder(jobs) {
  // your code here
}

const job = (ms, value) => () => new Promise((r) => setTimeout(() => r(value), ms));
const broken = () => Promise.reject(new Error("disk full"));
console.log(await runInOrder([job(20, "a"), job(10, "b"), broken, job(5, "never")]));
// { results: [ 'a', 'b' ], failedAt: 2 }
```
```js check
const run = need("runInOrder", "function");
const log = [];
const job = (ms, value) => () => { log.push(`start ${value}`); return new Promise((r) => setTimeout(() => { log.push(`end ${value}`); r(value); }, ms)); };
const broken = () => Promise.reject(new Error("disk full"));
same(await run([job(20, "a"), job(10, "b")]), { results: ["a", "b"], failedAt: null }, "Two successful jobs");
same(log, ["start a", "end a", "start b", "end b"], "The order jobs started and ended (each must finish before the next starts)");
log.length = 0;
same(await run([job(5, "a"), broken, job(5, "c")]), { results: ["a"], failedAt: 1 }, "A failing second job");
same(log, ["start a", "end a"], "Jobs run (the one after a failure shouldn't start)");
same(await run([]), { results: [], failedAt: null }, "No jobs");
same(await run([broken]), { results: [], failedAt: 0 }, "A failing first job");
```
```js solution
async function runInOrder(jobs) {
  const results = [];
  for (const [i, job] of jobs.entries()) {
    try {
      results.push(await job());          // wait for this job before starting the next
    } catch {
      return { results, failedAt: i };
    }
  }
  return { results, failedAt: null };
}

const job = (ms, value) => () => new Promise((r) => setTimeout(() => r(value), ms));
const broken = () => Promise.reject(new Error("disk full"));
console.log(await runInOrder([job(20, "a"), job(10, "b"), broken, job(5, "never")]));
```
hint: A `for…of` loop with `await job()` inside runs the jobs strictly one at a time. Note that the jobs are **functions**: calling `job()` is what starts each one.
hint: `jobs.entries()` gives `[index, job]` pairs, so you know the index when something fails.
hint: Wrap the `await` in `try`; in `catch`, `return { results, failedAt: i }` straight away.
approach:
1. **Understand:** strict sequence, stop at the first failure, report progress.
2. **Examples:** a, b succeed; the third fails → results [a, b], failedAt 2; the fourth never starts.
3. **Brute force:** `Promise.all(jobs.map((j) => j()))`: starts everything at once, the opposite of what's asked.
4. **Pattern:** **sequential await loop with early return**.
5. **Plan:** results array → loop with index → try await / catch return.
6. **Code and test:** order of starts and ends, failure positions, no jobs.
walkthrough:
**Line by line**

- Because jobs are functions, nothing starts until the loop calls `job()`; that's what makes sequencing possible. If they were promises, they'd already be running.
- `await job()` pauses the loop until that job settles.
- A rejection becomes an exception at the `await`, caught right there, and the early `return` stops later jobs from ever starting.

**Trace:** a starts and ends → b starts and ends → broken rejects → return { results: [a, b], failedAt: 2 }.

**Common wrong approach:** `jobs.map((j) => j())` before the loop: every job starts immediately, so "one at a time" is lost even if you await them in order afterwards. Database migrations, payment steps and file writes often need true sequencing.
:::

:::quiz
? What does an async function return?
+ Always a promise
- The value after return, immediately
- undefined unless it uses await
= Returning fulfils the promise; throwing rejects it.
? What does await pause?
+ Only the async function it's in; other code and events keep running
- The whole page
- Every other async function
= JavaScript stays responsive while awaiting.
? Three independent requests are awaited one after another. How do you speed this up?
+ Start them together and await Promise.all
- Add more await keywords
- Use forEach with async callbacks
= Sequential awaits add up the waiting times.
? Why doesn't await inside forEach wait?
+ forEach ignores the promises its callback returns
- await is not allowed in arrow functions
- forEach runs callbacks in parallel threads
= Use for…of for sequence, or map with Promise.all.
:::

@@@ lesson
id: fetch-and-apis
title: fetch and web APIs
minutes: 28
summary: How HTTP requests and responses work (methods, URLs, status codes, headers, bodies), calling APIs with fetch, why fetch only rejects on network errors and how to check response.ok, reading JSON and text, query strings with URL and URLSearchParams, sending JSON with POST, handling API errors, CORS, and keeping API keys off the front end.
---
Almost every app talks to a server through an **API** (application programming interface) over **HTTP**. In JavaScript, the tool for that is `fetch`, built into browsers and Node.js.

### HTTP in one minute

A **request** has a **method**, a **URL**, **headers** and sometimes a **body**; the **response** has a **status code**, headers and a body.

| Method | Means | Example |
|---|---|---|
| `GET` | read | list products |
| `POST` | create | place an order |
| `PUT` / `PATCH` | replace / update | change an address |
| `DELETE` | remove | cancel an order |

| Status | Meaning |
|---|---|
| 200 OK, 201 Created, 204 No Content | success |
| 301, 302, 304 | redirects and "not modified" |
| 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 429 Too Many Requests | the **client** did something wrong |
| 500 Internal Server Error, 502, 503 Service Unavailable, 504 | the **server** failed |

### The practice API

In this course's sandbox, requests to `https://shop.example` are answered by a small pretend shop (after a short delay), so you can practise without a real server:

| Request | Response |
|---|---|
| `GET /api/products` (optional `?category=parts`) | the product list |
| `GET /api/products/:id` | one product, or 404 |
| `GET /api/orders` (optional `?customer=Ada`) | orders |
| `POST /api/orders` with a JSON body `{ customer, items: [{ productId, qty }] }` | 201 and the new order, or 400 / 409 with `{ error }` |
| `GET /api/slow?ms=800` | answers after that delay |
| `GET /api/flaky?key=x&fail=2` | fails with 503 the first 2 times per key, then succeeds |
| `GET /api/stream` | a text response streamed word by word |

Prices are in pence. Every other URL goes to the real internet as usual.

### GET and reading the response

```js
const res = await fetch("https://shop.example/api/products?category=tools");
console.log(res.status, res.ok, res.headers.get("content-type"));
const tools = await res.json();                  // parse the body as JSON (also a promise)
console.log(tools.map((p) => p.name));
```

`fetch` returns a promise for a **Response**. Reading the body (`json()`, `text()`, `blob()`) is a second asynchronous step, because the body may still be arriving. A body can only be read once.

### fetch doesn't reject on HTTP errors

This surprises everyone once: a 404 or 500 response is still a **successful** fetch (the server answered). `fetch` only rejects when there's no response at all (network down, DNS failure, blocked by CORS, aborted). Always check `res.ok` (true for status 200–299):

```js
const res = await fetch("https://shop.example/api/products/99");
console.log("rejected? no.", "status:", res.status, "ok:", res.ok);
if (!res.ok) {
  const { error } = await res.json();          // many APIs explain the problem in the body
  console.log("API error:", error);
}
```

A small helper keeps this in one place:

```js
async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));    // the body might not be JSON
    throw new Error(`${res.status} ${detail.error ?? res.statusText}`);
  }
  return res.json();
}
try {
  console.log((await getJSON("https://shop.example/api/products/5")).name);
  await getJSON("https://shop.example/api/products/77");
} catch (e) {
  console.log("Failed:", e.message);
}
```

### Building URLs safely

Never glue query strings together by hand: values with spaces, `&` or `#` break the URL. `URL` and `URLSearchParams` encode everything correctly:

```js
const url = new URL("/api/orders", "https://shop.example");
url.searchParams.set("customer", "Ada & Co");
url.searchParams.set("sort", "date desc");
console.log(url.href);
console.log(new URLSearchParams({ q: "tyre 29\"", page: 2 }).toString());
```

### Sending data: POST with JSON

```js
const res = await fetch("https://shop.example/api/orders", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ customer: "Bo", items: [{ productId: 1, qty: 2 }, { productId: 6, qty: 1 }] }),
});
console.log(res.status, res.headers.get("location"));
console.log(await res.json());
```

The body must be a string (or a few other formats such as `FormData` or `Blob`), so objects go through `JSON.stringify`, and the `Content-Type` header tells the server how to read it.

### CORS and API keys

- **CORS** (cross-origin resource sharing): a browser page may only read responses from **another** site if that site allows it, with `Access-Control-Allow-Origin` headers. A "CORS error" is a server configuration issue, not a bug in your `fetch` call; servers (and Node.js) aren't restricted by it.
- **Never put secret API keys in front-end code.** Anything shipped to the browser can be read by anyone. Call services that need secret keys (payment providers, LLM APIs) from your own server, which adds the key and forwards the request (Part 8).

:::exercise Fetch a product
Write `async function getProduct(id)` that fetches `https://shop.example/api/products/<id>` and returns the product object; returns `null` if the server answers **404**; and throws an `Error` with the message `"HTTP <status>"` for any other non-OK status.
```js starter
async function getProduct(id) {
  // your code here
}

console.log((await getProduct(2)).name, await getProduct(99));   // Bell null
```
```js check
const gp = need("getProduct", "function");
const p = await gp(2);
same(p, { id: 2, name: "Bell", category: "accessories", price: 800, stock: 15 }, "getProduct(2)");
same(await gp(99), null, "getProduct(99) (not found)");
same((await gp(6)).name, "Puncture kit", "getProduct(6).name");
if (!/\.ok\b|\.status\b/.test(__source__)) throw new AssertionError("Check the response's ok or status before using the body: fetch doesn't reject on HTTP errors.");
```
```js solution
async function getProduct(id) {
  const res = await fetch(`https://shop.example/api/products/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

console.log((await getProduct(2)).name, await getProduct(99));
```
hint: `await fetch(url)` gives a Response; `res.status` is the code and `res.ok` is true for 200–299.
hint: Handle 404 first (`return null`), then any other non-OK status (`throw new Error(\`HTTP ${res.status}\`)`).
hint: Finally `return res.json();` (an `async` function returning a promise is fine: callers' `await` unwraps it).
approach:
1. **Understand:** three outcomes: product, "not found" as a normal value, other failures as errors.
2. **Examples:** 99 → 404 → null; a 500 would throw "HTTP 500".
3. **Brute force:** `return (await fetch(url)).json()`: returns `{ error: … }` for a 404 instead of null.
4. **Pattern:** **check the status before the body**.
5. **Plan:** fetch → 404 → null; !ok → throw; else json.
6. **Code and test:** existing ids, a missing id.
walkthrough:
**Line by line**

- The template literal builds the URL from the id.
- `res.status === 404` is checked first because "doesn't exist" is an expected answer the caller can handle as `null`.
- `!res.ok` catches every other problem (400, 401, 500, 503…) and turns it into an exception, because `fetch` won't.
- `res.json()` parses the body; returning it from an `async` function means callers get the product when they `await`.

**Trace:** `getProduct(99)` → 404 → `null`. `getProduct(2)` → 200 → the Bell object.

**Common wrong approach:** `try { … } catch` around `fetch` and assuming that covers errors: a 404 or 500 never reaches the `catch`, because `fetch` resolved successfully.
:::

:::exercise Place an order
Write `async function placeOrder(customer, items)` that POSTs `{ customer, items }` as JSON to `https://shop.example/api/orders` and returns the new order's `id`. If the server responds with an error status, throw an `Error` whose message is the `error` text from the response body (for example `"Only 7 Floor pump in stock"`).
```js starter
async function placeOrder(customer, items) {
  // your code here
}

console.log(await placeOrder("Bo", [{ productId: 1, qty: 2 }]));         // 1002
try {
  await placeOrder("Bo", [{ productId: 4, qty: 50 }]);
} catch (e) {
  console.log(e.message);                                                // Only 7 Floor pump in stock
}
```
```js check
const po = need("placeOrder", "function");
const id = await po("Bo", [{ productId: 1, qty: 2 }]);
if (!Number.isInteger(id) || id < 1002) throw new AssertionError(`placeOrder should return the new order's numeric id; it returned ${inspect(id)}.`);
const id2 = await po("Cy", [{ productId: 6, qty: 1 }, { productId: 2, qty: 1 }]);
same(id2, id + 1, "The id of the next order");
for (const [args, msg] of [
  [["Bo", [{ productId: 4, qty: 50 }]], "Only 7 Floor pump in stock"],
  [["", [{ productId: 1, qty: 1 }]], "customer is required"],
  [["Di", []], "items must be a non-empty array"],
  [["Di", [{ productId: 77, qty: 1 }]], "Unknown productId 77"],
]) {
  let e = null;
  try { await po(...args); } catch (err) { e = err; }
  if (!e || e.message !== msg) throw new AssertionError(`placeOrder(${inspect(args[0])}, ${inspect(args[1])}) should throw an Error "${msg}", but ${e ? `threw "${e.message}"` : "didn't throw"}.`);
}
if (!/JSON\.stringify/.test(__source__)) throw new AssertionError("Send the body as JSON text with JSON.stringify.");
```
```js solution
async function placeOrder(customer, items) {
  const res = await fetch("https://shop.example/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer, items }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data.id;
}

console.log(await placeOrder("Bo", [{ productId: 1, qty: 2 }]));
try {
  await placeOrder("Bo", [{ productId: 4, qty: 50 }]);
} catch (e) {
  console.log(e.message);
}
```
hint: Pass an options object as the second argument to `fetch`: `method: "POST"`, a `Content-Type: application/json` header, and `body: JSON.stringify({ customer, items })`.
hint: This API returns JSON for both success and errors, so read `await res.json()` first, then check `res.ok`.
hint: `if (!res.ok) throw new Error(data.error);` otherwise `return data.id;`.
approach:
1. **Understand:** send JSON, read JSON back, turn API errors into exceptions with the server's explanation.
2. **Examples:** 50 floor pumps → 409 Conflict with `{ error: "Only 7 Floor pump in stock" }`.
3. **Brute force:** ignoring the status and returning `data.id`: returns `undefined` on errors, silently.
4. **Pattern:** **POST JSON, then check the status**.
5. **Plan:** fetch with method, header and body → parse → !ok → throw data.error → return id.
6. **Code and test:** successes, each server-side validation error.
walkthrough:
**Line by line**

- `method: "POST"` and the JSON body describe the new order; `{ customer, items }` uses shorthand properties.
- The `Content-Type` header tells the server the body is JSON.
- Reading the body before checking `ok` is fine here because this API always answers with JSON; with APIs that might not, guard `json()` with a `catch`, as in the lesson's `getJSON`.
- Throwing `new Error(data.error)` passes the server's explanation straight to whoever calls `placeOrder`.

**Trace:** ("Bo", 50 pumps) → server: 409 `{ error: "Only 7 Floor pump in stock" }` → `res.ok` false → throw.

**Common wrong approach:** `body: { customer, items }` without `JSON.stringify`: `fetch` converts the object to the useless text "[object Object]", and the server rejects it.
:::

:::quiz
? fetch(url) gets a 404 response. What happens?
+ The promise fulfils with a Response whose ok is false
- The promise rejects
- fetch retries automatically
= fetch only rejects on network failures; check res.ok.
? How should you add customer=Ada & Co to a URL's query string?
+ url.searchParams.set("customer", "Ada & Co")
- url + "?customer=Ada & Co"
- encodeURI on the whole URL
= URLSearchParams encodes special characters correctly.
? Why must the body of a JSON POST go through JSON.stringify?
+ The body must be text (or another body type), not a plain object
- fetch can't send objects over HTTPS
- It encrypts the data
= Also set Content-Type: application/json.
? Where should a secret API key live?
+ On your server, never in front-end code
- In a const in the browser code
- In a hidden HTML field
= Anything sent to the browser can be read by anyone.
:::

@@@ lesson
id: async-patterns
title: Timeouts, retries, cancellation and streaming
minutes: 28
summary: Racing a promise against a timer, cancelling work with AbortController and AbortSignal.timeout, retrying failed requests with exponential backoff and jitter (and which errors to retry), limiting how many requests run at once, reading streamed responses chunk by chunk with readers and TextDecoderStream, and how LLM APIs stream their answers.
---
Real networks are slow, flaky and sometimes silent. Robust apps don't wait forever, try again sensibly, stop work that's no longer needed, and show results as they arrive.

### Timeouts

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

### Cancellation with AbortController

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

### Retries with exponential backoff

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

### Limiting concurrency

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

### Streaming responses

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

:::exercise Add a timeout to any promise
Write `withTimeout(promise, ms)` returning a promise that settles like `promise` if it settles within `ms` milliseconds, and otherwise rejects with an `Error` whose `name` is `"TimeoutError"` and whose message is `"timed out after <ms> ms"`. Clear the timer when the original promise settles first, so it doesn't keep running.
```js starter
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
```js check
const wt = need("withTimeout", "function");
const later = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));
same(await wt(later(20, "fast"), 200), "fast", "A promise that finishes in time");
let e = null;
const t0 = Date.now();
try { await wt(later(400, "slow"), 60); } catch (err) { e = err; }
if (!e || e.name !== "TimeoutError" || e.message !== "timed out after 60 ms") {
  throw new AssertionError(`A slow promise should reject with name "TimeoutError" and message "timed out after 60 ms"; got ${e ? `${e.name}: ${e.message}` : "no error"}.`);
}
if (Date.now() - t0 > 250) throw new AssertionError("The timeout should reject after about 60 ms, not wait for the slow promise.");
let e2 = null;
try { await wt(Promise.reject(new Error("original")), 100); } catch (err) { e2 = err; }
same(e2 && e2.message, "original", "The error when the original promise rejects first");
same(await wt(Promise.resolve(1), 10_000), 1, "An already-resolved promise");
if (!/clearTimeout/.test(__source__)) throw new AssertionError("Clear the timer (clearTimeout) when the original promise settles first.");
```
```js solution
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
hint: Create a second promise that rejects after `ms` milliseconds, and race the two with `Promise.race`.
hint: Make the error with `new Error(\`timed out after ${ms} ms\`)` and then set `error.name = "TimeoutError"`.
hint: Keep the timer id in a variable and call `clearTimeout(timer)` in a `.finally()` on the race, so the timer stops whichever promise wins.
approach:
1. **Understand:** whichever settles first wins; the losing timer must be cleaned up.
2. **Examples:** a 400 ms promise with a 60 ms limit rejects at about 60 ms.
3. **Brute force:** `setTimeout` plus flags and manual resolve and reject calls: works, more error-prone.
4. **Pattern:** **race against a timer, clean up in finally**.
5. **Plan:** timer promise → race → finally clear.
6. **Code and test:** fast, slow, rejecting originals, already-resolved promises.
walkthrough:
**Line by line**

- The timeout promise never fulfils; it only rejects when the timer fires.
- `Promise.race` settles the same way as the first input to settle: the original's value or error, or the timeout error.
- `finally(() => clearTimeout(timer))` runs either way and stops a pending timer, so a fast success doesn't leave a timer running (which keeps Node.js processes alive and wastes work).
- Setting `name` lets callers tell timeouts apart from other failures (`if (e.name === "TimeoutError")`).

**Trace:** original 400 ms, limit 60 ms → the timer rejects first → race rejects with TimeoutError → finally clears an already-fired timer (harmless).

**Common wrong approach:** forgetting the clean-up. It's invisible in a single call, but in a server handling thousands of requests, every finished request leaves a live timer behind. And remember: a timeout stops the waiting, not the work; pass an `AbortSignal` too when the operation supports one.
:::

:::exercise Retry with backoff
Write `async function retry(fn, { attempts = 3, baseDelay = 50 } = {})` that calls the async function `fn` and returns its result. If it rejects, wait `baseDelay × 2^(n − 1)` ms after the *n*-th failure and try again, up to `attempts` calls in total. If every attempt fails, throw the **last** error. Don't wait after the final attempt.
```js starter
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
```js check
const rt = need("retry", "function");
const make = (failures, value = "ok") => {
  const times = [];
  const fn = async () => { times.push(Date.now()); if (times.length <= failures) throw new Error(`fail ${times.length}`); return value; };
  return { fn, times };
};
let m = make(2);
same(await rt(m.fn, { attempts: 3, baseDelay: 20 }), "ok", "Succeeding on the third attempt");
same(m.times.length, 3, "The number of calls");
const gap1 = m.times[1] - m.times[0], gap2 = m.times[2] - m.times[1];
if (gap1 < 15 || gap2 < 35) throw new AssertionError(`Waits should grow: about 20 ms then 40 ms; got ${gap1} ms and ${gap2} ms.`);
m = make(0);
same(await rt(m.fn), "ok", "Succeeding first time");
same(m.times.length, 1, "Calls when the first attempt succeeds");
m = make(10);
let e = null;
const t0 = Date.now();
try { await rt(m.fn, { attempts: 3, baseDelay: 20 }); } catch (err) { e = err; }
if (!e || e.message !== "fail 3") throw new AssertionError(`After 3 failed attempts, throw the last error ("fail 3"); got ${e ? `"${e.message}"` : "no error"}.`);
same(m.times.length, 3, "The number of calls when everything fails");
if (Date.now() - t0 > 140) throw new AssertionError("Don't wait after the final attempt.");
m = make(1);
same(await rt(m.fn, { attempts: 2, baseDelay: 5 }), "ok", "Two attempts allowed");
```
```js solution
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
hint: A `for` loop over attempt numbers, with `return await fn()` inside `try`, returns as soon as one attempt succeeds.
hint: In `catch`, remember the error. If attempts remain, wait: `await new Promise((r) => setTimeout(r, baseDelay * 2 ** (n - 1)))`.
hint: After the loop, `throw lastError;`. The `return await` matters: without `await`, a rejected promise would skip your `catch`.
approach:
1. **Understand:** up to N calls, growing waits between them, the last error if all fail.
2. **Examples:** baseDelay 20 → waits 20 ms, then 40 ms.
3. **Brute force:** recursion with a counter: works, but the loop is easier to follow.
4. **Pattern:** **retry loop with exponential backoff**.
5. **Plan:** loop n = 1…attempts → try return await → catch: save, wait if more → throw last.
6. **Code and test:** immediate success, success after failures, total failure, wait sizes, no final wait.
walkthrough:
**Line by line**

- `return await fn()` inside `try` is essential: `await` makes a rejection throw **here**, where `catch` can handle it. A bare `return fn()` would hand back the rejected promise and skip the retry.
- `2 ** (n - 1)` doubles the wait each time: 1×, 2×, 4× the base delay.
- `if (n < attempts)` skips the pointless wait after the final failure.
- Throwing the last error tells the caller what most recently went wrong.

**Trace:** fails, fails, succeeds with baseDelay 20 → call 1 fails → wait 20 → call 2 fails → wait 40 → call 3 succeeds → return "ok".

**Common wrong approach:** retrying every error, including 400 Bad Request or 404 Not Found, which will fail identically each time. Production retry helpers take a `shouldRetry(error)` option, add random jitter, and respect `Retry-After` headers.
:::

:::quiz
? Promise.race([request, timeout(200)]) rejects after 200 ms. Is the request cancelled?
+ No; only the waiting stops. Pass an AbortSignal to cancel the request itself
- Yes, race cancels the losing promises
- Only if the server supports it
= Promises can't be cancelled; operations can, through signals.
? Which errors are worth retrying?
+ Temporary ones: network errors, timeouts, 429 and 5xx responses
- All errors
- 400 and 404
= Client errors fail the same way every time.
? Why add jitter to exponential backoff?
+ So many clients don't all retry at the same moment
- To make retries faster
- To avoid the need for timeouts
= Synchronised retries can overload a recovering server.
? How do chat apps show an LLM's answer word by word?
+ They read the response body as a stream and display each chunk as it arrives
- They poll the server every millisecond
- The browser does it automatically for long responses
= LLM APIs stream with server-sent events.
:::
