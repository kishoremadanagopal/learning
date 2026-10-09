# Lesson 21: The event loop

**You'll learn:** single-threaded JavaScript, synchronous and asynchronous code, the call stack, the runtime's timers and I/O, the task (macrotask) queue, the microtask queue, why setTimeout(fn, 0) isn't immediate, blocking the main thread, Web Workers, callbacks and callback hell, debouncing and throttling.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#event-loop)**: run every example and check your exercise answers.

## Key terms

- **Single-threaded:** running one piece of code at a time on one thread.
- **Asynchronous:** started now and finished later, without blocking other code.
- **Call stack:** the functions currently running; synchronous code runs until it's empty.
- **Event loop:** the mechanism that runs queued callbacks whenever the call stack is empty.
- **Task (macrotask):** a queued callback from a timer, event or I/O; one runs per loop turn.
- **Microtask:** a queued promise callback or `queueMicrotask` function; all run before the next task.
- **Callback:** a function passed to be called later, when something finishes.
- **Debounce:** delay an action until calls stop arriving for a while.
- **Throttle:** allow an action at most once per time period.

JavaScript runs your code on **one thread**: it does one thing at a time. Yet a web page can wait for a network response, run a timer and react to clicks all at once. The trick is that JavaScript never **waits**: slow operations are handed to the browser (or Node.js), and JavaScript is told when they finish. The mechanism that coordinates this is the **event loop**.

## Synchronous and asynchronous

**Synchronous** code runs line by line, each line finishing before the next starts. **Asynchronous** code starts something now and handles the result **later**:

```js
console.log("1. order placed");
setTimeout(() => console.log("3. email sent (after 50 ms)"), 50);
console.log("2. thank-you page shown");
```

`setTimeout` doesn't pause anything. It asks the runtime to call the function in 50 ms, and returns immediately; the program carries on.

## How it works

![The event loop. Your code runs on the call stack. Calls like setTimeout and fetch hand work to the runtime (timers, network). When that work finishes, its callback is put in a queue: the task queue for timers and events, or the microtask queue for promise callbacks. Whenever the call stack is empty, the event loop first runs every microtask, then takes one task, and repeats](../figures/event-loop.svg)

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

## Don't block the loop

While your code runs, **nothing else can**: no clicks, no rendering, no timers. A long synchronous loop freezes the page:

```js
const start = Date.now();
setTimeout(() => console.log(`timer ran after ${Date.now() - start} ms (asked for 10)`), 10);
let x = 0;
while (Date.now() - start < 200) x++;      // busy for 200 ms: the timer has to wait
console.log("busy loop done");
```

For heavy computation (image processing, big data crunching, running Python in the browser like this site's other courses), move the work into a **Web Worker**, a separate thread that talks to the page by messages. This sandbox runs your code in one, which is why **Stop** can end an endless loop.

## Callbacks

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

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Order of execution | sync code → all microtasks → one task → repeat | — | — |
| Heavy computation | move it to a Web Worker | O(work) off the main thread | O(data copied) |
| Debounce | clear the pending timer; set a new one | O(1) per call | O(1) |

## Common mistakes

- Expecting `setTimeout(fn, 0)` to run before promise callbacks.
- Running long synchronous loops on the main thread, freezing the page.
- Nesting callbacks many levels deep.
- Confusing debouncing with throttling.

## Exercises

### 1. Predict the order

Read this code, then set `answer` to an array of the labels in the order they're printed. (Run your answer with Check; don't run the snippet itself first, or you'll miss the point!)

```js
console.log("start");
setTimeout(() => console.log("timeout 1"), 0);
Promise.resolve().then(() => {
  console.log("promise 1");
  setTimeout(() => console.log("timeout 2"), 0);
}).then(() => console.log("promise 2"));
queueMicrotask(() => console.log("microtask"));
console.log("end");
```

Starter code:

```js
const answer = ["start", /* … */];
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** three kinds of work: synchronous code, microtasks, tasks.
2. **Examples:** `setTimeout(…, 0)` always comes after pending promise callbacks.
3. **Brute force:** run it and copy the output: you'd learn nothing!
4. **Pattern:** **simulate the queues** by hand.
5. **Plan:** run sync code, noting what each line queues → drain microtasks (adding new ones to the end) → run tasks in order.
6. **Code and test:** write the order, press Check, then run the snippet to see it happen.

</details>

<details>
<summary>💡 Hint 1</summary>

First, everything synchronous runs: which two lines are those?

</details>

<details>
<summary>💡 Hint 2</summary>

Then all microtasks run, in the order they were queued, including microtasks queued **by** microtasks. The second `then` is queued only when the first one finishes.

</details>

<details>
<summary>💡 Hint 3</summary>

Timers (tasks) come last, in the order they were scheduled: "timeout 1" was scheduled before "timeout 2", which was only scheduled inside "promise 1".

</details>

### 2. Debounce

A search box shouldn't call the server on every keystroke. Write `debounce(fn, wait)` returning a new function that delays calling `fn` until `wait` ms have passed **without** another call. Each new call restarts the wait; `fn` then runs once, with the arguments of the **last** call.

Starter code:

```js
function debounce(fn, wait) {
  // your code here
}

const search = debounce((q) => console.log("searching for", q), 50);
search("b"); search("bi"); search("bik");
setTimeout(() => search("bike"), 120);
// searching for bik   (after about 50 ms)
// searching for bike  (after about 170 ms)
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a burst of calls → one call, `wait` ms after the last one, with the last arguments.
2. **Examples:** "b", "bi", "bik" within 50 ms → one search for "bik".
3. **Brute force:** compare timestamps on each call and skip some: still needs a timer for the final call.
4. **Pattern:** **closure over a timer id; cancel and reschedule**.
5. **Plan:** `let timer` → returned function clears and sets the timer.
6. **Code and test:** bursts, gaps, last arguments win, independent debouncers.

</details>

<details>
<summary>💡 Hint 1</summary>

The returned function needs to remember a pending timer between calls: a closure (Lesson 8).

</details>

<details>
<summary>💡 Hint 2</summary>

On every call, cancel the pending timer with `clearTimeout`, then start a new one with `setTimeout`.

</details>

<details>
<summary>💡 Hint 3</summary>

`return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); };` with `let timer = null;` above it.

</details>

**In the sandbox:** exercises 41–42. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Predict the order</summary>

```js
const answer = ["start", "end", "promise 1", "microtask", "promise 2", "timeout 1", "timeout 2"];
```

**Line by line**

- Synchronous: "start", then `setTimeout` queues task T1, `then` queues microtask P1, `queueMicrotask` queues M, then "end".
- Microtasks: P1 runs, printing "promise 1" and queueing task T2; when P1 finishes, its follow-up `then` (P2) is queued behind M.
- M runs: "microtask". Then P2: "promise 2". The microtask queue is now empty.
- Tasks: T1 "timeout 1", then T2 "timeout 2".

**Trace:** start, end, promise 1, microtask, promise 2, timeout 1, timeout 2.

**Common wrong approach:** thinking a `0` ms timeout runs before promises, or that "promise 2" runs right after "promise 1". Chained `then` callbacks are separate microtasks, queued only when the previous one finishes.

</details>

<details>
<summary>✅ 2. Debounce</summary>

```js
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

**Line by line**

- `timer` lives in the closure, shared by every call of this debounced function, but separate for each `debounce(...)`.
- `clearTimeout(timer)` cancels the previous pending call (it's harmless when `timer` is `null`).
- The new timeout captures this call's `args`, so when it finally fires, it uses the last arguments.

**Trace:** f(1) schedules at 40 ms; f(2) cancels it and schedules again; f(3, "x") likewise; nothing more arrives, so after 40 ms fn(3, "x") runs once.

**Common wrong approach:** calling `fn` immediately and ignoring later calls for `wait` ms. That's **throttling** (useful for scroll handlers), not debouncing: a search box would then search for "b" instead of the finished word.

</details>

## Quick quiz

1. How many things does JavaScript's main thread do at once?
   - A) One; asynchronous work is handed to the runtime and finished later
   - B) As many as there are CPU cores
   - C) Two: one for timers and one for code

2. Which runs first after the current code: a resolved promise's then callback, or a setTimeout(…, 0) callback?
   - A) The promise callback (a microtask)
   - B) The setTimeout callback
   - C) It's random

3. What happens to a 10 ms timer while a loop keeps the thread busy for 200 ms?
   - A) It waits until the loop finishes, so it fires after about 200 ms
   - B) It interrupts the loop after 10 ms
   - C) It's cancelled

4. Where should heavy computation go to keep a page responsive?
   - A) A Web Worker
   - B) A setTimeout of 0
   - C) A promise

<details>
<summary>Quiz answers</summary>

1. **A) One; asynchronous work is handed to the runtime and finished later**: The event loop runs callbacks one at a time.
2. **A) The promise callback (a microtask)**: All microtasks run before the next task.
3. **A) It waits until the loop finishes, so it fires after about 200 ms**: Synchronous code always runs to completion.
4. **A) A Web Worker**: Promises don't add threads; workers do.

</details>

---
Previous: [Lesson 20](20-regular-expressions.md) · Next: [Lesson 22: Promises](22-promises.md)
