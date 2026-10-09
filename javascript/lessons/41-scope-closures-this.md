# Lesson 41: Interview topics: scope, closures and this

**You'll learn:** var, let and const, hoisting, the temporal dead zone, closures, the loop-and-closure puzzle, private state with closures, the four rules for this, arrow functions and this, call, apply and bind, losing this in callbacks, prototypes and the prototype chain, what new does, == versus ===, typeof null and NaN, explaining answers in interviews.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#scope-closures-this)**: run every example and check your exercise answers.

## Key terms

- **Hoisting:** declarations being processed before the code runs, so names exist in their whole scope.
- **Temporal dead zone (TDZ):** the part of a scope before a `let` or `const` line, where using the name throws.
- **Closure:** a function together with the variables it captured from the scope where it was created.
- **`this`:** the object a function is called on, decided by how the function is called.
- **`call` / `apply` / `bind`:** call a function with a chosen `this` (arguments listed / as an array), or make a new function with `this` fixed.
- **Prototype:** the object another object falls back to for properties it doesn't have itself.
- **Prototype chain:** the series of prototypes JavaScript searches when looking up a property.
- **Memoization:** remembering a function's results for arguments it has already seen.

JavaScript interviews return to the same handful of language topics, because they reveal whether you understand how the language actually works. You've met each one in this course; this lesson collects them, with the kind of answer an interviewer hopes for.

## var, let, const and hoisting

**Hoisting** means declarations are processed before the code runs, so a name exists in its whole scope from the start. What differs is the value it has before its line runs:

```js
console.log(typeof hoistedFn);      // function: function declarations are fully hoisted
console.log(oldStyle);              // undefined: var is hoisted and set to undefined
try {
  console.log(modern);              // let and const are hoisted too, but not usable yet
} catch (e) {
  console.log(e.name + ": " + e.message);
}

function hoistedFn() {}
var oldStyle = "var";
let modern = "let";
```

The time between the start of the scope and a `let`/`const` line is the **temporal dead zone** (TDZ): using the name there throws. `var` is function-scoped and silently `undefined` before its line; `let` and `const` are block-scoped. That's why modern code uses `const` by default and `let` when a value changes, and never `var`.

**Model answer:** "Declarations are hoisted to the top of their scope. Function declarations are usable before their line; `var` exists but is `undefined`; `let` and `const` exist but throw until their line runs, the temporal dead zone."

## Closures

A **closure** is a function together with the variables it captured from where it was created (Lesson 8). The classic interview puzzle:

```js
const withVar = [], withLet = [];
for (var i = 0; i < 3; i++) withVar.push(() => i);
for (let j = 0; j < 3; j++) withLet.push(() => j);
console.log(withVar.map((f) => f()));     // all three share one i, which ended at 3
console.log(withLet.map((f) => f()));     // let creates a new j for each loop iteration
```

Closures are how JavaScript keeps private state, makes function factories, and remembers values in callbacks:

```js
function makeCounter() {
  let count = 0;                          // private: only the returned functions can reach it
  return { increment: () => ++count, current: () => count };
}
const a = makeCounter(), b = makeCounter();
a.increment(); a.increment(); b.increment();
console.log(a.current(), b.current());    // each counter has its own count
```

**Model answer:** "A closure is a function that remembers the variables of the scope it was created in, even after that scope has finished. Each call of the outer function creates new variables, so each closure has its own."

## this: four rules

`this` is decided by **how a function is called**, not where it's written (arrow functions excepted):

| Call | `this` is |
|---|---|
| `obj.method()` | `obj`, the object before the dot |
| `fn()` | `undefined` in strict mode and modules (the global object in old sloppy code) |
| `fn.call(x, …)`, `fn.apply(x, [...])`, `fn.bind(x)` | `x`, set explicitly |
| `new Fn()` | the new object being created |
| arrow function | whatever `this` was where the arrow was written (it has no `this` of its own) |

```js
const cart = {
  items: 3,
  count() { return this.items; },
  countLater() { return [1].map(() => this.items); },             // arrow: this from countLater
  countBroken() { return [1].map(function () { return this; }); }, // plain function: this is undefined
};
console.log(cart.count(), cart.countLater(), cart.countBroken());

const loose = cart.count;                // just the function, without the object
try { loose(); } catch (e) { console.log("loose():", e.message); }

const bound = cart.count.bind(cart);     // a new function with this fixed
console.log(bound());
console.log(cart.count.call({ items: 10 }));
```

The most common real bug is the `loose` case: passing a method as a callback (`button.addEventListener("click", cart.count)` or `setTimeout(obj.method, 100)`) loses its object. Fix it with an arrow function (`() => cart.count()`) or `bind`.

## Prototypes and new

Every object has a **prototype**, another object it falls back to when a property isn't its own. Classes (Lesson 16) are built on this:

```js
class Product {
  constructor(name) { this.name = name; }
  label() { return `Product: ${this.name}`; }
}
const bell = new Product("Bell");
console.log(Object.hasOwn(bell, "name"), Object.hasOwn(bell, "label"));   // label lives on the prototype
console.log(Object.getPrototypeOf(bell) === Product.prototype);
console.log(bell.label());
```

`new Product("Bell")` (1) creates an empty object whose prototype is `Product.prototype`, (2) runs the constructor with `this` set to it, and (3) returns it. Methods live once on the prototype, shared by every instance; looking up `bell.label` walks the **prototype chain** until it finds it.

## Equality and coercion

`==` converts types before comparing, with rules few people remember, which is why style guides require `===` (Lesson 5):

```js
console.log(0 == "", null == undefined, [] == false, "1" == 1);   // all true with ==
console.log(0 === "", null === undefined, NaN === NaN);           // false, false, false
console.log(Number.isNaN(NaN), Object.is(NaN, NaN), typeof null);
console.log(0.1 + 0.2 === 0.3, Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON);
```

`typeof null` is `"object"`, a bug from 1995 kept for compatibility. `NaN` is the only value not equal to itself.

## Answering well

Interviewers listen to how you reason, not only to the final answer:

- **Say what you expect, then why**: "This logs 3, 3, 3, because `var` makes one shared `i`."
- **Use the right words**: scope, closure, hoisting, prototype, event loop. They show you know the model, not just the result.
- **Give the practical consequence**: "…which is why we use `let` in loops", "…so pass `() => this.save()` as the callback".
- **If unsure, reason out loud** from the rules instead of guessing.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Private state | closure over variables in a factory function | O(1) | O(state) |
| Fix this for a callback | arrow function or fn.bind(obj) | O(1) | O(1) |
| Cache results | memoize with a Map keyed by the arguments | O(1) per repeated call | O(distinct calls) |

## Common mistakes

- Passing a method as a callback and losing its `this`.
- Using a regular `function` callback inside a method and expecting the method's `this`.
- Creating closures in a `var` loop and expecting each to see a different value.
- Relying on `==` coercion rules instead of using `===`.
- Answering "what does this log?" without explaining why.

## Exercises

### 1. Memoize

Write `memoize(fn)`. It returns a new function that gives the same results as `fn`, but remembers them: calling it again with the same arguments returns the saved result without calling `fn`. Treat arguments as the same when `JSON.stringify(args)` is the same. The memoized function must also pass on its own `this` to `fn`.

Starter code:

```js
function memoize(fn) {
  // your code here
}

let calls = 0;
const slowSquare = (n) => { calls++; return n * n; };
const fastSquare = memoize(slowSquare);
console.log(fastSquare(9), fastSquare(9), fastSquare(4), calls);   // 81 81 16 2
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** same arguments → same result, computed once; `this` passes through.
2. **Examples:** `add(1, 2)` twice → one call; `add(2, 1)` is different arguments.
3. **Brute force:** a global cache object: shared between every memoized function, so `a(5)` and `b(5)` collide.
4. **Pattern:** **closure over a private Map**, keyed by the serialized arguments.
5. **Plan:** cache → return function(...args) → key → has? return : compute with apply, store, return.
6. **Code and test:** count the calls, as the starter does.

</details>

<details>
<summary>💡 Hint 1</summary>

The cache must survive between calls but belong to one memoized function: create a `Map` inside `memoize`, before returning the new function. That's a closure.

</details>

<details>
<summary>💡 Hint 2</summary>

Use `cache.has(key)`, not `if (cache.get(key))`: a remembered result might be `0`, `""` or `undefined`.

</details>

<details>
<summary>💡 Hint 3</summary>

Return a regular `function (...args) { … }`, not an arrow, so it has its own `this`, and call the original with `fn.apply(this, args)`.

</details>

### 2. Write bind yourself

Write `myBind(fn, thisArg, ...preset)` that works like `fn.bind(thisArg, ...preset)` without using `bind`: it returns a new function that calls `fn` with `this` set to `thisArg`, the `preset` arguments first, then any arguments given to the new function, and returns `fn`'s result.

Starter code:

```js
function myBind(fn, thisArg, ...preset) {
  // your code here
}

const cart = { items: 3, describe(prefix, suffix) { return `${prefix}${this.items} items${suffix}`; } };
const describe = myBind(cart.describe, cart, "Cart: ");
console.log(describe("!"));   // Cart: 3 items!
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** fix `this` and the first arguments now; accept the rest later.
2. **Examples:** preset `"Cart: "` + later `"!"` → `describe("Cart: ", "!")`.
3. **Brute force:** `thisArg.fn = fn; thisArg.fn(...)`: works, but adds a property to someone else's object.
4. **Pattern:** **a closure plus `apply`**: the returned function remembers `fn`, `thisArg` and `preset`.
5. **Plan:** return function(...later) → `fn.apply(thisArg, [...preset, ...later])`.
6. **Code and test:** compare with the real `bind` on the same inputs.

</details>

<details>
<summary>💡 Hint 1</summary>

Return a new function that collects its own arguments with a rest parameter: `return function (...later) { … };`.

</details>

<details>
<summary>💡 Hint 2</summary>

`fn.apply(thisArg, argsArray)` calls `fn` with `this` set to `thisArg` and the arguments from an array.

</details>

<details>
<summary>💡 Hint 3</summary>

The arguments are the preset ones followed by the later ones: `[...preset, ...later]`. Return what `fn` returns.

</details>

**In the sandbox:** exercises 81–82. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Memoize</summary>

```js
function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

let calls = 0;
const slowSquare = (n) => { calls++; return n * n; };
const fastSquare = memoize(slowSquare);
console.log(fastSquare(9), fastSquare(9), fastSquare(4), calls);
```

**Line by line**

- `const cache = new Map()` is created once per `memoize` call; the returned function closes over it, so each memoized function has its own memory.
- `JSON.stringify(args)` turns the arguments into a string key, so equal arrays give equal keys (it can't tell apart values JSON can't represent, like functions, which is fine here).
- `cache.has(key)` handles remembered results that are falsy.
- `function (...args)` gets `this` from how it's called (`shop.withVat(…)` → `shop`), and `fn.apply(this, args)` passes it on.

**Trace:** `add(1, 2)` → key `[1,2]` → miss → call → store 3. `add(1, 2)` → hit → 3, no call.

**Common wrong approach:** returning an arrow function: arrows have no `this` of their own, so a memoized method sees the `this` of the code that called `memoize`, and `this.rate` is undefined.

</details>

<details>
<summary>✅ 2. Write bind yourself</summary>

```js
function myBind(fn, thisArg, ...preset) {
  return function (...later) {
    return fn.apply(thisArg, [...preset, ...later]);
  };
}

const cart = { items: 3, describe(prefix, suffix) { return `${prefix}${this.items} items${suffix}`; } };
const describe = myBind(cart.describe, cart, "Cart: ");
console.log(describe("!"));
```

**Line by line**

- The returned function closes over `fn`, `thisArg` and `preset`, which is what "binding" means.
- `...later` collects the arguments of each call; `[...preset, ...later]` puts them after the preset ones.
- `fn.apply(thisArg, …)` ignores whatever `this` the bound function was called with, so `f.call(other)` still uses `thisArg`, like the real `bind`.
- `return` passes the result back.

**Trace:** `myBind(sum, null, 1, 2)(3, 4)` → `sum.apply(null, [1, 2, 3, 4])` → 10.

**Common wrong approach:** returning an arrow that calls `fn(...args)` directly: `this` inside `fn` is then `undefined`, and `this.items` throws.

</details>

## Quick quiz

1. What does this log? for (var i = 0; i < 3; i++) setTimeout(() => console.log(i));
   - A) 3, 3, 3
   - B) 0, 1, 2
   - C) undefined three times

2. Which value does a let variable have before its declaration line runs?
   - A) None: using it throws a ReferenceError (the temporal dead zone)
   - B) undefined
   - C) null

3. setTimeout(obj.save, 100) runs save with which this?
   - A) undefined (the method lost its object)
   - B) obj
   - C) the timer

4. Where does a class method like label() live?
   - A) On the class's prototype, shared by all instances
   - B) Copied onto every instance
   - C) On the global object

<details>
<summary>Quiz answers</summary>

1. **A) 3, 3, 3**: var creates one shared i; the callbacks run after the loop, when i is 3. With let, each iteration has its own i.
2. **A) None: using it throws a ReferenceError (the temporal dead zone)**: let and const are hoisted but can't be used until their line.
3. **A) undefined (the method lost its object)**: Pass () => obj.save() or obj.save.bind(obj) instead.
4. **A) On the class's prototype, shared by all instances**: Instances find it through the prototype chain.

</details>

---
Previous: [Lesson 40](40-web-server.md) · Next: [Lesson 42: Interview coding: patterns and practice](42-interview-coding.md)
