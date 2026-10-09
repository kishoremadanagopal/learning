# Lesson 23: async and await

**You'll learn:** async functions and their promises, await, error handling with try / catch / finally, sequential versus parallel awaits, Promise.all with map, await in loops and why not forEach, top-level await, async iterables, for await, async generators, Array.fromAsync, common async mistakes.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#async-await)**: run every example and check your exercise answers.

## Key terms

- **`async` function:** a function that always returns a promise and can use `await`.
- **`await`:** pauses the current async function until a promise settles, then gives its value or throws its error.
- **Top-level await:** `await` used directly in a module, outside any function.
- **Sequential:** one operation after another, each waiting for the previous one.
- **Parallel (concurrent):** several operations in flight at the same time.
- **Async iterable:** a source of values that arrive over time, looped with `for await`.
- **Async generator:** an `async function*` that yields values over time.

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

## Errors: try / catch

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

## Sequential versus parallel

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

## await in loops

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

## Async iteration

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

## Common mistakes

- **Forgetting `await`**: you get a promise instead of the value (`Promise { … }` printed, or `undefined` properties).
- **Awaiting in sequence by accident**, making independent requests slow.
- **`await` inside `forEach`**.
- **Not handling errors**: an `async` function that throws produces a rejected promise; someone must `catch` it.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Independent work | await Promise.all(items.map(async (x) => …)) | slowest item | O(n) |
| Dependent steps | const a = await f(); const b = await g(a) | sum of steps | O(1) |
| One at a time | for (const job of jobs) await job() | sum of jobs | O(1) |
| Values over time | for await (const x of source) | O(items) | O(1) |

## Common mistakes

- Forgetting `await` and using a promise as if it were the value.
- Awaiting independent operations one after another.
- Using `await` inside `forEach`.
- Not catching errors from async functions.
- Passing already-started promises when work must run in sequence.

## Exercises

### 1. Total stock, in parallel

Write `async function totalStock(ids)` that fetches each product from `https://shop.example/api/products/<id>` **in parallel** and returns the sum of their `stock` values. If any product is missing (the response isn't `ok`), throw an `Error` with the message `"product <id> not found"`.

Starter code:

```js
async function totalStock(ids) {
  // your code here
}

console.log(await totalStock([1, 2, 4]));   // 64 (42 + 15 + 7)
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** independent requests → parallel; one failure fails the whole call.
2. **Examples:** 3 requests of 30 ms each should take about 30 ms, not 90.
3. **Brute force:** a `for…of` loop with `await`: correct sums, but slow (sequential).
4. **Pattern:** **map to promises + Promise.all**.
5. **Plan:** map ids to async fetchers → Promise.all → reduce.
6. **Code and test:** sums, empty list, zero stock, a missing product, timing.

</details>

<details>
<summary>💡 Hint 1</summary>

`ids.map(async (id) => { … })` starts one request per id and gives you an array of promises; `await Promise.all(...)` waits for all of them.

</details>

<details>
<summary>💡 Hint 2</summary>

Inside the async callback: `const res = await fetch(...)`, then `if (!res.ok) throw new Error(...)`, then `return res.json()`.

</details>

<details>
<summary>💡 Hint 3</summary>

Sum the stock with `reduce((sum, p) => sum + p.stock, 0)`. A throw inside any callback makes `Promise.all` reject, which `await` turns back into a throw.

</details>

### 2. Run jobs one at a time

Write `async function runInOrder(jobs)`, where each job is a function returning a promise. Run them **one after another** (each starts only after the previous one finishes) and return `{ results, failedAt }`: `results` holds the results of the jobs that succeeded, in order; if a job rejects, stop and set `failedAt` to its index. If all succeed, `failedAt` is `null`.

Starter code:

```js
async function runInOrder(jobs) {
  // your code here
}

const job = (ms, value) => () => new Promise((r) => setTimeout(() => r(value), ms));
const broken = () => Promise.reject(new Error("disk full"));
console.log(await runInOrder([job(20, "a"), job(10, "b"), broken, job(5, "never")]));
// { results: [ 'a', 'b' ], failedAt: 2 }
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** strict sequence, stop at the first failure, report progress.
2. **Examples:** a, b succeed; the third fails → results [a, b], failedAt 2; the fourth never starts.
3. **Brute force:** `Promise.all(jobs.map((j) => j()))`: starts everything at once, the opposite of what's asked.
4. **Pattern:** **sequential await loop with early return**.
5. **Plan:** results array → loop with index → try await / catch return.
6. **Code and test:** order of starts and ends, failure positions, no jobs.

</details>

<details>
<summary>💡 Hint 1</summary>

A `for…of` loop with `await job()` inside runs the jobs strictly one at a time. Note that the jobs are **functions**: calling `job()` is what starts each one.

</details>

<details>
<summary>💡 Hint 2</summary>

`jobs.entries()` gives `[index, job]` pairs, so you know the index when something fails.

</details>

<details>
<summary>💡 Hint 3</summary>

Wrap the `await` in `try`; in `catch`, `return { results, failedAt: i }` straight away.

</details>

**In the sandbox:** exercises 45–46. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Total stock, in parallel</summary>

```js
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

**Line by line**

- The `async` arrow function passed to `map` runs once per id; each call starts its `fetch` immediately and returns a promise.
- Checking `res.ok` matters: `fetch` only rejects on network failure, not on a 404 response (Lesson 24).
- `Promise.all` waits for every product, or rejects with the first error, which the outer `await` rethrows as an exception from `totalStock`.
- `reduce` with a start of 0 handles the empty list.

**Trace:** ids [1, 2, 4] → three requests in flight together → stocks 42, 15, 7 → 64.

**Common wrong approach:** `ids.forEach(async (id) => { total += … })` and then `return total`: `forEach` doesn't wait, so the function returns 0 before any response arrives.

</details>

<details>
<summary>✅ 2. Run jobs one at a time</summary>

```js
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

**Line by line**

- Because jobs are functions, nothing starts until the loop calls `job()`; that's what makes sequencing possible. If they were promises, they'd already be running.
- `await job()` pauses the loop until that job settles.
- A rejection becomes an exception at the `await`, caught right there, and the early `return` stops later jobs from ever starting.

**Trace:** a starts and ends → b starts and ends → broken rejects → return { results: [a, b], failedAt: 2 }.

**Common wrong approach:** `jobs.map((j) => j())` before the loop: every job starts immediately, so "one at a time" is lost even if you await them in order afterwards. Database migrations, payment steps and file writes often need true sequencing.

</details>

## Quick quiz

1. What does an async function return?
   - A) Always a promise
   - B) The value after return, immediately
   - C) undefined unless it uses await

2. What does await pause?
   - A) Only the async function it's in; other code and events keep running
   - B) The whole page
   - C) Every other async function

3. Three independent requests are awaited one after another. How do you speed this up?
   - A) Start them together and await Promise.all
   - B) Add more await keywords
   - C) Use forEach with async callbacks

4. Why doesn't await inside forEach wait?
   - A) forEach ignores the promises its callback returns
   - B) await is not allowed in arrow functions
   - C) forEach runs callbacks in parallel threads

<details>
<summary>Quiz answers</summary>

1. **A) Always a promise**: Returning fulfils the promise; throwing rejects it.
2. **A) Only the async function it's in; other code and events keep running**: JavaScript stays responsive while awaiting.
3. **A) Start them together and await Promise.all**: Sequential awaits add up the waiting times.
4. **A) forEach ignores the promises its callback returns**: Use for…of for sequence, or map with Promise.all.

</details>

---
Previous: [Lesson 22](22-promises.md) · Next: [Lesson 24: fetch and web APIs](24-fetch-and-apis.md)
