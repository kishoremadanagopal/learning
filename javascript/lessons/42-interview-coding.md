# Lesson 42: Interview coding: patterns and practice

**You'll learn:** the six-step approach out loud, clarifying questions, stating complexity, common JavaScript interview tasks (debounce, throttle, Promise.all, memoize, bind, curry, deep clone, deep equality, flatten), structuredClone and flat, event-loop output puzzles, implementing an event emitter, an LRU cache with a Map, practising under interview conditions.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#interview-coding)**: run every example and check your exercise answers.

## Key terms

- **Time complexity:** how an algorithm's running time grows with the input size, in big-O notation.
- **Space complexity:** how much extra memory an algorithm needs as the input grows.
- **Currying:** turning a function of several arguments into a chain of functions that each take some of them.
- **Deep equality:** comparing two values by their contents, recursively, rather than by identity.
- **Event emitter:** an object that lets code subscribe to named events and be called when they're emitted.
- **LRU cache:** a fixed-size cache that evicts the least recently used entry when it's full.

Coding interviews for JavaScript roles mix general problem solving with tasks that test the language itself: "implement `debounce`", "write an event emitter", "what does this log?". This lesson gives you the approach and the patterns.

## The approach

Every exercise in this course had the same six steps in **How to approach it**. They're exactly what interviewers want to see, out loud:

1. **Understand:** restate the problem; ask about inputs, outputs and edge cases ("can the array be empty?", "are keys always strings?").
2. **Examples:** work one or two by hand, including an edge case.
3. **Brute force:** say the simple solution, even if it's slow; it proves you can solve it.
4. **Pattern:** name the idea that improves it: a Map for fast lookups, two pointers, a closure, a queue.
5. **Plan:** a few lines of steps, before code.
6. **Code and test:** write it, then run your examples through it, by hand or with `console.log`.

Then state the **complexity**: "O(n) time, because each item is visited once; O(n) extra space for the Map."

## Questions you're likely to meet

| Question | Key idea | In this course |
|---|---|---|
| debounce, throttle | closures over a timer | Lesson 21 |
| `Promise.all`, a concurrency limit, retry | promises, `await` in loops | Lessons 22, 25 |
| memoize, bind, curry | closures, `this`, `apply` | Lesson 41 |
| deep clone, deep equality | recursion, `structuredClone` | below |
| flatten nested arrays | recursion or `flat(Infinity)` | below |
| event emitter | a Map of listener arrays | exercise |
| LRU cache | a Map's insertion order | exercise |
| "what does this log?" | the event loop, `this`, hoisting | Lessons 21, 41 |

A few short ones:

```js
// flatten: recursion (or the built-in arr.flat(Infinity))
const flatten = (arr) => arr.reduce((out, x) => out.concat(Array.isArray(x) ? flatten(x) : x), []);
console.log(flatten([1, [2, [3, [4]], 5]]));

// curry: collect arguments until there are enough
const curry = (fn) => function curried(...args) {
  return args.length >= fn.length ? fn(...args) : (...more) => curried(...args, ...more);
};
const volume = curry((l, w, h) => l * w * h);
console.log(volume(2)(3)(4), volume(2, 3)(4));

// deep equality for plain data
function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
}
console.log(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }), deepEqual([1, 2], { 0: 1, 1: 2 }));

// deep clone: built in since 2022
const original = { when: new Date(0), tags: new Set(["sale"]) };
const copy = structuredClone(original);
console.log(copy.when instanceof Date, copy.tags.has("sale"), copy.tags !== original.tags);
```

In an interview, mention the built-in (`flat`, `structuredClone`) and then write your own if asked: knowing both is the best answer.

## Event-loop puzzles

"What order does this log?" checks Lesson 21. Work through it in phases: synchronous code first, then **all** microtasks (promise callbacks, code after `await`), then **one** task (timers), and repeat:

```js
console.log("1");
setTimeout(() => console.log("6"), 0);
Promise.resolve().then(() => console.log("3")).then(() => console.log("5"));
(async () => {
  console.log("2");                 // an async function runs synchronously until its first await
  await null;
  console.log("4");
})();
console.log("2b");
```

Explain it in those terms: "1, 2 and 2b are synchronous. Then the microtasks in queue order: 3, then the code after `await`, 4; 3's `then` queued 5. The timer, 6, is a task, so it runs last."

## Practise like the real thing

- Solve problems with a timer running, talking through each step.
- Practise without autocomplete or an AI assistant at least some of the time: you'll need to recall syntax yourself.
- After solving, ask: can it be faster? What breaks it? How would I test it?
- Review the **At a glance** tables and the cheat sheet: they summarise each approach and its cost.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Event emitter | Map of event → array of listeners; emit over a copy | O(listeners) per emit | O(listeners) |
| LRU cache | Map insertion order; delete + set to mark use; evict first key | O(1) per get/set | O(capacity) |
| Flatten | recursion or arr.flat(Infinity) | O(total items) | O(total items) |

## Common mistakes

- Starting to code before clarifying the problem and its edge cases.
- Staying silent instead of explaining the approach as you go.
- Mutating a collection while iterating over it.
- Forgetting to state, or to check, the time and space complexity.
- Not testing the solution with the examples, including an edge case.

## Exercises

### 1. An event emitter

Write a class `EventEmitter` with:

- `on(event, listener)`: add a listener (the same function may be added more than once); return `this`, so calls can be chained;
- `off(event, listener)`: remove **one** registration of that listener; return `this`;
- `once(event, listener)`: add a listener that's removed before it runs the first time; return `this`;
- `emit(event, ...args)`: call the event's listeners in the order they were added, with the arguments; return `true` if there were any listeners, `false` if not.

Listeners added or removed **while** an event is being emitted only affect later emits.

Starter code:

```js
class EventEmitter {
  // your code here
}

const shop = new EventEmitter();
shop.on("order", (id, total) => console.log(`order ${id}: £${total}`));
shop.once("order", () => console.log("first order of the day!"));
shop.emit("order", 1002, 16);
shop.emit("order", 1003, 6);
console.log(shop.emit("refund"));   // false
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a registry of callbacks per event name, with ordering, duplicates and self-removal.
2. **Examples:** `on(f)` twice + `off(f)` once → f still runs once per emit.
3. **Brute force:** a `Set` per event: loses duplicates (and `off` of a duplicate removes both).
4. **Pattern:** **a Map of arrays**, iterating over a snapshot.
5. **Plan:** `#add` and `#remove` helpers → on / once (wrapper) / off → emit over a copy, return whether any ran.
6. **Code and test:** the starter shows `once` and the `false` return.

</details>

<details>
<summary>💡 Hint 1</summary>

Store a `Map` from event name to an **array** of listeners: arrays keep the order and allow the same function twice. `off` removes one entry with `findIndex` and `splice`.

</details>

<details>
<summary>💡 Hint 2</summary>

For `emit`, loop over a **copy** of the array (`[...listeners]`), so listeners added or removed during the loop don't affect it.

</details>

<details>
<summary>💡 Hint 3</summary>

`once` registers a wrapper that removes itself, then calls the listener. To let `off(event, original)` remove it, store both: `{ fn: wrapper, original: listener }`.

</details>

### 2. An LRU cache

An **LRU** (least recently used) cache holds at most `capacity` entries; when it's full, adding a new key evicts the entry used longest ago. Write a class `LRUCache`:

- `new LRUCache(capacity)`;
- `get(key)`: the value, or `undefined` if missing; a successful `get` counts as a use;
- `set(key, value)`: add or update (an update also counts as a use), evicting the least recently used entry if needed; returns `this`;
- `size`: a read-only property with the number of entries;
- `keys()`: an array of the keys from least to most recently used.

`get` and `set` must take O(1) time.

Starter code:

```js
class LRUCache {
  // your code here
}

const cache = new LRUCache(2);
cache.set("a", 1).set("b", 2);
cache.get("a");          // a is now the most recently used
cache.set("c", 3);       // full: evicts b
console.log(cache.keys(), cache.get("b"));   // [ 'a', 'c' ] undefined
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a bounded map that also tracks recency, with O(1) operations.
2. **Examples:** capacity 2, set a, b, get a, set c → b is evicted.
3. **Brute force:** an array of keys in recency order: moving a key means `indexOf` + `splice`, O(n) per operation.
4. **Pattern:** **Map insertion order as the recency list** (the classic answer is a hash map plus a doubly linked list; a JavaScript Map is both).
5. **Plan:** get: has? → delete + set → return. set: delete + set → evict first if over capacity.
6. **Code and test:** the check runs 400,000 operations, which only finishes quickly with O(1) steps.

</details>

<details>
<summary>💡 Hint 1</summary>

A `Map` keeps its keys in insertion order, and deleting then re-adding a key moves it to the end. So the first key is always the least recently used.

</details>

<details>
<summary>💡 Hint 2</summary>

In `get`, if the key exists: delete it and set it again (it becomes the newest), then return the value. Use `has`, not the value, to decide: values can be `undefined`.

</details>

<details>
<summary>💡 Hint 3</summary>

In `set`, delete, set, and if `size` is now above capacity, remove the first key: `this.#map.keys().next().value`.

</details>

**In the sandbox:** exercises 83–84. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. An event emitter</summary>

```js
class EventEmitter {
  #listeners = new Map();          // event -> array of { fn, original }

  on(event, listener) {
    return this.#add(event, listener, listener);
  }

  once(event, listener) {
    const wrapper = (...args) => {
      this.#remove(event, listener);
      listener(...args);
    };
    return this.#add(event, wrapper, listener);
  }

  off(event, listener) {
    this.#remove(event, listener);
    return this;
  }

  emit(event, ...args) {
    const entries = this.#listeners.get(event);
    if (!entries || entries.length === 0) return false;
    for (const { fn } of [...entries]) fn(...args);
    return true;
  }

  #add(event, fn, original) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, []);
    this.#listeners.get(event).push({ fn, original });
    return this;
  }

  #remove(event, listener) {
    const entries = this.#listeners.get(event);
    if (!entries) return;
    const i = entries.findIndex((e) => e.original === listener);
    if (i !== -1) entries.splice(i, 1);
  }
}

const shop = new EventEmitter();
shop.on("order", (id, total) => console.log(`order ${id}: £${total}`));
shop.once("order", () => console.log("first order of the day!"));
shop.emit("order", 1002, 16);
shop.emit("order", 1003, 6);
console.log(shop.emit("refund"));
```

**Line by line**

- `#listeners` maps each event to an array of `{ fn, original }`. For `on`, both are the listener; for `once`, `fn` is the wrapper and `original` the listener, so `off(event, listener)` finds either.
- The `once` wrapper removes its entry **before** calling the listener, so if the listener emits the same event again, it doesn't run twice.
- `emit` copies the array first: a listener that calls `on` or `off` changes the stored array, not the copy being looped over.
- Every public method except `emit` returns `this`, enabling `emitter.on(…).on(…)`.

**Trace:** `busy.emit("x")` → copy `[first, second]` → first runs: adds `late`, removes `second` from the stored array → the loop still calls `second` from the copy. Next emit: stored array is `[first, late]`.

**Common wrong approach:** looping over the stored array directly: removing `second` during the loop shifts the indexes, so the next listener is skipped.

</details>

<details>
<summary>✅ 2. An LRU cache</summary>

```js
class LRUCache {
  #capacity;
  #map = new Map();          // a Map remembers insertion order: first = least recently used

  constructor(capacity) {
    this.#capacity = capacity;
  }

  get(key) {
    if (!this.#map.has(key)) return undefined;
    const value = this.#map.get(key);
    this.#map.delete(key);        // move to the end: most recently used
    this.#map.set(key, value);
    return value;
  }

  set(key, value) {
    this.#map.delete(key);
    this.#map.set(key, value);
    if (this.#map.size > this.#capacity) {
      const oldest = this.#map.keys().next().value;
      this.#map.delete(oldest);
    }
    return this;
  }

  get size() {
    return this.#map.size;
  }

  keys() {
    return [...this.#map.keys()];
  }
}

const cache = new LRUCache(2);
cache.set("a", 1).set("b", 2);
cache.get("a");
cache.set("c", 3);
console.log(cache.keys(), cache.get("b"));
```

**Line by line**

- The Map's iteration order is insertion order, so "least recently used" is simply its first key.
- `get` moves a found key to the end by deleting and re-inserting it, both O(1).
- `set` deletes first, so updating an existing key also moves it to the end; then, if the cache is over capacity, it evicts the first key.
- `this.#map.keys().next().value` reads the first key without copying all of them.
- `get size()` makes `size` a read-only property.

**Trace:** set a, set b → [a, b]. get a → [b, a]. set c → [b, a, c] → over 2 → delete b → [a, c].

**Common wrong approach:** in an interview, many reach straight for a linked list and spend the time on pointer bugs. Mention the classic design, then point out that JavaScript's Map already keeps insertion order with O(1) deletes: interviewers like that you know your language.

</details>

## Quick quiz

1. What should you do first when given an interview problem?
   - A) Restate it and ask about inputs, outputs and edge cases
   - B) Start typing the fastest solution you know
   - C) Ask for the answer

2. In what order do these run: a setTimeout callback, a promise .then callback, and synchronous code?
   - A) Synchronous code, then the .then callback, then the timer
   - B) The timer, then .then, then synchronous code
   - C) In the order they were written

3. Why is a Map a good basis for an LRU cache in JavaScript?
   - A) It keeps insertion order, and deleting and re-adding a key is O(1)
   - B) Maps are sorted by key
   - C) Maps evict old entries automatically

4. Why should emit loop over a copy of the listener array?
   - A) So listeners added or removed during the emit don't skip or add calls
   - B) Copies are faster to loop over
   - C) Arrays can't be looped over twice

<details>
<summary>Quiz answers</summary>

1. **A) Restate it and ask about inputs, outputs and edge cases**: Clarifying avoids solving the wrong problem and shows how you work.
2. **A) Synchronous code, then the .then callback, then the timer**: Sync first, then all microtasks, then one task.
3. **A) It keeps insertion order, and deleting and re-adding a key is O(1)**: Its first key is always the least recently used.
4. **A) So listeners added or removed during the emit don't skip or add calls**: Changing an array while iterating over it shifts indexes.

</details>

---
Previous: [Lesson 41](41-scope-closures-this.md) · Next: [Lesson 43: Project, step 1: calling an LLM API](43-llm-api.md)
