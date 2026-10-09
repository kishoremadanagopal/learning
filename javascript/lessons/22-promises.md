# Lesson 22: Promises

**You'll learn:** promise states, fulfilling and rejecting, then, catch and finally, chaining and returning values, error propagation, unhandled rejections, new Promise and promisifying callbacks, Promise.withResolvers, Promise.resolve and reject, Promise.all, allSettled, race and any, writing Promise.all yourself.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#promises)**: run every example and check your exercise answers.

## Key terms

- **Promise:** an object representing a result that will be available later.
- **Pending / fulfilled / rejected:** a promise's states: waiting, succeeded with a value, failed with a reason.
- **Settled:** fulfilled or rejected; a settled promise never changes.
- **Promise chain:** a sequence of `then` calls, each receiving the previous step's result.
- **Unhandled rejection:** a rejected promise with no `catch` or `await` to handle it.
- **Promisify:** wrap a callback-based function so it returns a promise.
- **`Promise.all`:** waits for all promises; rejects as soon as one rejects.
- **`Promise.allSettled`:** waits for all promises and reports each outcome.

A **promise** is an object representing a result that isn't ready yet. It starts **pending**, and later becomes **fulfilled** (with a value) or **rejected** (with an error). Once settled, it never changes.

## Using promises

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

## Chaining

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

## Errors propagate

A thrown error or a rejected promise skips the remaining `then` callbacks until a `catch`:

```js
Promise.resolve(5)
  .then((n) => { if (n > 3) throw new RangeError("too big"); return n; })
  .then((n) => console.log("never runs", n))
  .catch((e) => { console.log("caught:", e.message); return 0; })   // recover with a fallback
  .then((n) => console.log("continues with", n));
```

A rejected promise that nobody handles is an **unhandled rejection**: browsers log it, and Node.js stops the program. End every chain with a `catch` (or `await` it inside `try`).

## Creating promises

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

## Combining promises

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

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Wait for several | await Promise.all([a, b, c]) | max of their times | O(n) |
| Keep every outcome | Promise.allSettled(ps) | max of their times | O(n) |
| Wrap a callback API | new Promise((resolve, reject) => …) | O(1) | O(1) |

## Common mistakes

- Forgetting to `return` inside a `then` callback.
- Leaving rejections unhandled.
- Nesting `then` calls instead of chaining them.
- Throwing synchronously from a function that should return a promise.
- Collecting `Promise.all`-style results in completion order instead of input order.

## Exercises

### 1. A delay helper

Write `delay(ms, value)` returning a promise that fulfils with `value` after `ms` milliseconds. If `ms` is negative or not a number, the promise should **reject** with a `RangeError` (don't throw synchronously).

Starter code:

```js
function delay(ms, value) {
  // your code here
}

delay(30, "ready").then((v) => console.log(v));   // ready (after 30 ms)
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** wrap a timer in a promise; bad input becomes a rejection, not an exception.
2. **Examples:** `await delay(40, "x")` gives "x" after about 40 ms.
3. **Brute force:** `async function delay` with `await new Promise(...)`: also fine (async functions turn throws into rejections).
4. **Pattern:** **promisify** a callback API.
5. **Plan:** new Promise → validate → reject, or setTimeout → resolve.
6. **Code and test:** timing, missing value, negative and non-numeric ms.

</details>

<details>
<summary>💡 Hint 1</summary>

`new Promise((resolve, reject) => { … })` gives you two functions: call `resolve(value)` for success, `reject(error)` for failure.

</details>

<details>
<summary>💡 Hint 2</summary>

Inside, start a timer: `setTimeout(() => resolve(value), ms)`.

</details>

<details>
<summary>💡 Hint 3</summary>

Validate first and call `reject(new RangeError(...))` (and `return`) instead of throwing, so callers get a rejected promise either way.

</details>

### 2. Write Promise.all yourself

Write `all(promises)` behaving like `Promise.all`: it returns a promise that fulfils with an array of the results **in the original order** once every input fulfils, or rejects with the first rejection's reason. Inputs may also be plain values (treat them as already fulfilled), and an empty array fulfils with `[]`. Don't use `Promise.all`, `allSettled`, `race` or `any`.

Starter code:

```js
function all(promises) {
  // your code here
}

const later = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));
all([later(30, "a"), later(10, "b"), "c"]).then(console.log);   // [ 'a', 'b', 'c' ]
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** wait for all, keep input order, fail fast on the first error.
2. **Examples:** "b" finishes before "a", but the result is still [a, b, c].
3. **Brute force:** await each in turn in a loop: correct values, but rejections are noticed late (only when reached).
4. **Pattern:** **counter + indexed results inside a new Promise**.
5. **Plan:** handle empty → for each input: resolve it, store by index, decrement, resolve at zero; reject on any error.
6. **Code and test:** order, empty, plain values, first rejection, fail-fast timing.

</details>

<details>
<summary>💡 Hint 1</summary>

Return a `new Promise`. Inside, attach a `then` to every input and count how many have fulfilled.

</details>

<details>
<summary>💡 Hint 2</summary>

Results arrive in completion order, not input order: store each one at its index, `results[i] = value`. `Promise.resolve(item)` turns plain values into promises.

</details>

<details>
<summary>💡 Hint 3</summary>

When the counter reaches the number of inputs, `resolve(results)`. Pass `reject` as the second argument to each `then`; a promise can only settle once, so later rejections are ignored.

</details>

**In the sandbox:** exercises 43–44. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. A delay helper</summary>

```js
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

**Line by line**

- The executor function runs immediately; `resolve` and `reject` settle the promise later or now.
- Calling `reject` instead of `throw` keeps the function's contract simple: it **always** returns a promise, so callers handle every failure in one place (`catch` or `try`/`await`).
- `return` after `reject` stops the timer from being started.
- `setTimeout(() => resolve(value), ms)` fulfils the promise when the time is up.

**Trace:** `delay(-5)` → validation fails → `reject(RangeError)` → the returned promise is rejected → `await` throws it.

**Common wrong approach:** `function delay(ms) { setTimeout(() => {}, ms); return Promise.resolve(); }`, which fulfils immediately: the timer and the promise aren't connected. The promise must be resolved **from inside** the timer callback.

</details>

<details>
<summary>✅ 2. Write Promise.all yourself</summary>

```js
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

**Line by line**

- `new Array(promises.length)` with indexed assignment keeps results in input order regardless of finishing order.
- `Promise.resolve(item)` wraps plain values (and passes promises through), so every input can be treated alike.
- The counter, not `results.length`, tracks completion: assigning `results[2]` first would already make the length 3.
- Passing `reject` directly means the first failure settles the outer promise; later `reject` or `resolve` calls do nothing, because a promise settles only once.

**Trace:** inputs a (30 ms), b (10 ms), "c" (now): c stored at 2 (remaining 2), b at 1 (remaining 1), a at 0 → remaining 0 → resolve [a, b, c].

**Common wrong approach:** `results.push(value)`, which records results in finishing order: [c, b, a].

</details>

## Quick quiz

1. What does .then(fn) return?
   - A) A new promise for whatever fn returns
   - B) The value fn returns, immediately
   - C) The same promise

2. A then callback forgets to return a value. What does the next then receive?
   - A) undefined
   - B) The previous value
   - C) An error

3. Which combinator never rejects?
   - A) Promise.allSettled
   - B) Promise.all
   - C) Promise.race

4. What happens to an unhandled promise rejection?
   - A) Browsers log an error; Node.js stops the program by default
   - B) It's silently ignored everywhere
   - C) It becomes a fulfilled promise

<details>
<summary>Quiz answers</summary>

1. **A) A new promise for whatever fn returns**: That's what makes chaining work.
2. **A) undefined**: Always return when the next step needs the value.
3. **A) Promise.allSettled**: It reports every outcome as fulfilled or rejected.
4. **A) Browsers log an error; Node.js stops the program by default**: End chains with catch, or await inside try.

</details>

---
Previous: [Lesson 21](21-event-loop.md) · Next: [Lesson 23: async and await](23-async-await.md)
