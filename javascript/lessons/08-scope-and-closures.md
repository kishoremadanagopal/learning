# Lesson 8: Scope and closures

**You'll learn:** lexical scope, global, function and block scope, the scope chain, shadowing, var versus let and const, hoisting and the temporal dead zone, closures, private state, function factories, counters, once and memoize, the loop-closure bug.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#scope-and-closures)**: run every example and check your exercise answers.

## Key terms

- **Scope:** the part of a program where a name can be used.
- **Lexical scope:** scopes decided by where code is written, not where it's called.
- **Block scope:** names that exist only inside the nearest `{ }`, as with `let` and `const`.
- **Shadowing:** an inner variable hiding an outer one with the same name.
- **Temporal dead zone:** the part of a block before a `let` or `const` declaration, where the name can't be used.
- **Closure:** a function bundled with the variables of the scope it was created in.
- **Factory function:** a function that creates and returns new objects or functions.
- **Memoization:** remembering a function's results so repeat calls are instant.

**Scope** is where a name can be seen. JavaScript finds a variable by looking in the current block, then the block around it, and so on outwards: a chain of scopes, decided by where the code is **written** (lexical scope).

## Block, function and global scope

```js
const shop = "Spoke & Chain";          // global (top-level) scope

function report() {
  const items = 3;                     // function scope: only inside report
  if (items > 0) {
    const message = `${shop} has ${items} items`;   // block scope: only inside these braces
    console.log(message);
  }
  // console.log(message);  would be a ReferenceError here
}
report();
```

`let` and `const` are **block-scoped**: they exist only inside the nearest `{ }`. An inner scope can read outer names, but not the other way round.

## Shadowing

An inner variable with the same name as an outer one **shadows** it inside the block:

```js
const price = 10;
{
  const price = 99;      // a different variable, only in this block
  console.log("inner", price);
}
console.log("outer", price);
```

Legal, but confusing; linters (Part 7) can warn about it.

## Why not var?

`var` is **function-scoped**, not block-scoped, and is hoisted with the value `undefined`, so mistakes go unnoticed:

```js
function example() {
  console.log(early);       // undefined, not an error: var is hoisted
  var early = 1;
  if (true) {
    var leaked = "visible outside the block";
  }
  console.log(leaked);
}
example();
```

`let` and `const` are also hoisted, but they can't be used before their line: that zone is the **temporal dead zone**, and using them there is a `ReferenceError`, which is what you want.

## Closures

A function keeps access to the variables of the scope it was **created** in, even after that scope has finished running. That combination of a function and its remembered variables is a **closure**:

![A diagram of makeCounter. The call to makeCounter creates a scope containing count = 0. The inner function increment is returned and stored as counterA; it keeps a link to that scope. A second call creates a separate scope with its own count, linked to counterB. Calling counterA twice raises its count to 2 while counterB's count stays independent](../figures/closure.svg)

```js
function makeCounter() {
  let count = 0;                     // private: nothing outside can touch it directly
  return () => {
    count++;
    return count;
  };
}
const counterA = makeCounter();
const counterB = makeCounter();
console.log(counterA(), counterA(), counterA());   // 1 2 3
console.log(counterB());                           // 1: its own count
```

Each call to `makeCounter` creates a new `count`, and the returned arrow function closes over it. Closures give you **private state** without classes, and they're everywhere in JavaScript: event handlers, callbacks, React hooks and more.

## Patterns built from closures

```js
function makeGreeter(greeting) {
  return (name) => `${greeting}, ${name}!`;     // remembers greeting
}
const hello = makeGreeter("Hello");
const hola = makeGreeter("Hola");
console.log(hello("Ada"), hola("Grace"));

function memoize(fn) {
  const cache = new Map();                      // remembered between calls
  return (n) => {
    if (!cache.has(n)) cache.set(n, fn(n));
    return cache.get(n);
  };
}
const slowSquare = (n) => { console.log(`computing ${n}…`); return n * n; };
const fastSquare = memoize(slowSquare);
console.log(fastSquare(9), fastSquare(9));      // computes only once
```

## The loop-closure bug (and why `let` fixes it)

```js
const withVar = [], withLet = [];
for (var i = 0; i < 3; i++) withVar.push(() => i);
for (let j = 0; j < 3; j++) withLet.push(() => j);
console.log(withVar.map((f) => f()));   // [ 3, 3, 3 ]: one shared i
console.log(withLet.map((f) => f()));   // [ 0, 1, 2 ]: a new j for every pass
```

With `var`, every function closes over the **same** variable, which is 3 by the time they run. `let` creates a fresh binding for each pass of the loop. One more reason to never use `var`.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Private state | variables inside a factory, returned function uses them | O(1) | O(state) |
| Run once | flag + saved result in a closure | O(1) | O(1) |
| Memoize | Map cache in a closure | O(1) per repeat | O(distinct inputs) |

## Common mistakes

- Using `var`, which leaks out of blocks and shares one variable across loop passes.
- Keeping per-instance state in a global variable instead of a closure.
- Shadowing an outer variable by accident.
- Checking `result === undefined` to see if something has already run.

## Exercises

### 1. A function that runs once

Write `once(fn)` returning a new function that calls `fn` (with whatever arguments it receives) the **first** time it's called, and on every later call returns that first result without calling `fn` again.

Starter code:

```js
function once(fn) {
  // your code here
}

const init = once((name) => { console.log("setting up", name); return 42; });
console.log(init("db"), init("cache"), init());
// setting up db
// 42 42 42
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a wrapper that remembers state across calls: has it run, and what did it return?
2. **Examples:** the second `init("cache")` returns 42 without printing.
3. **Brute force:** a global flag: breaks as soon as you make two once-functions.
4. **Pattern:** **closure over private state**.
5. **Plan:** `called` and `result` in once's scope → returned function checks and updates them.
6. **Code and test:** arguments passed through, a function returning undefined, two independent wrappers.

</details>

<details>
<summary>💡 Hint 1</summary>

The returned function needs to remember two things between calls: whether `fn` has run, and its result. Keep them in variables inside `once`.

</details>

<details>
<summary>💡 Hint 2</summary>

Use a separate boolean (`called`) rather than checking `result === undefined`, because `fn` might genuinely return `undefined`.

</details>

<details>
<summary>💡 Hint 3</summary>

`return (...args) => { if (!called) { called = true; result = fn(...args); } return result; };`

</details>

### 2. A running average

Write `makeAverager()` returning a function `add(n)` that records the number and returns the **average of all numbers added so far** through that function. Each averager keeps its own numbers.

Starter code:

```js
function makeAverager() {
  // your code here
}

const avg = makeAverager();
console.log(avg(10), avg(20), avg(60));   // 10 15 30
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a factory that makes independent stateful functions.
2. **Examples:** after 10, 20, 60 the total is 90 over 3 numbers → 30.
3. **Brute force:** store every number in an array and average it each time: O(n) per call, still correct.
4. **Pattern:** **closure with running totals** (O(1) per call).
5. **Plan:** total and count in the factory's scope → returned function updates and divides.
6. **Code and test:** several averagers at once, decimals, negatives.

</details>

<details>
<summary>💡 Hint 1</summary>

Like the counter in the lesson: keep state in variables inside `makeAverager`, and return an arrow function that updates them.

</details>

<details>
<summary>💡 Hint 2</summary>

You don't need to store every number: a running `total` and a `count` are enough.

</details>

<details>
<summary>💡 Hint 3</summary>

Inside the returned function: `total += n; count++; return total / count;`

</details>

**In the sandbox:** exercises 15–16. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. A function that runs once</summary>

```js
function once(fn) {
  let called = false;
  let result;
  return (...args) => {
    if (!called) {
      called = true;
      result = fn(...args);
    }
    return result;
  };
}

const init = once((name) => { console.log("setting up", name); return 42; });
console.log(init("db"), init("cache"), init());
```

**Line by line**

- `called` and `result` live in the scope of each `once(...)` call, so every wrapper has its own pair.
- `(...args)` collects whatever arguments the wrapper receives, and `fn(...args)` passes them on.
- Setting `called = true` **before** calling `fn` means that even if `fn` somehow calls the wrapper again, it won't run twice.
- Later calls skip straight to `return result`.

**Trace:** `f(2, 3)` → called false → set true, result 5 → 5; `f(10, 10)` → called true → 5.

**Common wrong approach:** `if (result === undefined)`, which calls `fn` again every time when its real result is `undefined` (common for setup functions that just do something).

</details>

<details>
<summary>✅ 2. A running average</summary>

```js
function makeAverager() {
  let total = 0;
  let count = 0;
  return (n) => {
    total += n;
    count++;
    return total / count;
  };
}

const avg = makeAverager();
console.log(avg(10), avg(20), avg(60));
```

**Line by line**

- Each `makeAverager()` call creates a new `total` and `count`, so averagers don't interfere.
- The returned arrow function closes over both variables and updates them on every call.
- `total / count` is the mean of everything so far, without keeping a list.

**Trace:** `avg(10)` → 10/1; `avg(20)` → 30/2 = 15; `avg(60)` → 90/3 = 30.

**Common wrong approach:** declaring `total` and `count` outside `makeAverager` (at the top level). It works for one averager, but every averager then shares the same totals.

</details>

## Quick quiz

1. Where can a const declared inside an if block be used?
   - A) Only inside that block
   - B) Anywhere in the function
   - C) Anywhere in the file

2. What is a closure?
   - A) A function together with the variables from the scope where it was created
   - B) A function that has finished running
   - C) A way to close the browser

3. Why does the var loop example print [3, 3, 3]?
   - A) All the functions share one var variable, which is 3 when they run
   - B) var counts in steps of 3
   - C) map changes the values

4. What is the temporal dead zone?
   - A) The part of a block before a let or const declaration, where using the name is an error
   - B) A part of the code that never runs
   - C) The time a promise takes to resolve

<details>
<summary>Quiz answers</summary>

1. **A) Only inside that block**: let and const are block-scoped.
2. **A) A function together with the variables from the scope where it was created**: Closures let functions keep private state.
3. **A) All the functions share one var variable, which is 3 when they run**: let creates a new binding for each pass.
4. **A) The part of a block before a let or const declaration, where using the name is an error**: It turns use-before-declaration into a clear ReferenceError.

</details>

---
Previous: [Lesson 7](07-functions.md) · Next: [Lesson 9: Arrays](09-arrays.md)
