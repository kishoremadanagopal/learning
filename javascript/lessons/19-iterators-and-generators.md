# Lesson 19: Iterators and generators

**You'll learn:** the iteration protocol, Symbol.iterator, iterators and next(), making classes iterable, generator functions and yield, pausing and lazy evaluation, infinite sequences, iterator helpers (map, filter, take, drop, flatMap, reduce, toArray), Iterator.from, when laziness pays off, async generators.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#iterators-and-generators)**: run every example and check your exercise answers.

## Key terms

- **Iterable:** an object that can be looped over with `for…of`, because it has a `[Symbol.iterator]()` method.
- **Iterator:** an object with a `next()` method that returns `{ value, done }`.
- **Generator function:** a `function*` that produces values one at a time with `yield`.
- **`yield`:** hands out a value from a generator and pauses it until the next value is requested.
- **Lazy evaluation:** computing values only when they're needed.
- **Iterator helpers:** lazy methods such as `map`, `filter` and `take` on iterators.

`for…of`, spread (`[...x]`), destructuring and `Array.from` all work on many kinds of values: arrays, strings, Maps, Sets. What they share is the **iteration protocol**.

## The protocol

An **iterable** is an object with a `[Symbol.iterator]()` method that returns an **iterator**: an object with a `next()` method. Each `next()` call returns `{ value, done }`:

```js
const letters = ["a", "b"];
const it = letters[Symbol.iterator]();
console.log(it.next(), it.next(), it.next());
```

`for…of` simply calls `next()` until `done` is `true`. Any object that follows the protocol works with all of JavaScript's iteration syntax:

```js
class Countdown {
  constructor(from) { this.from = from; }
  [Symbol.iterator]() {
    let current = this.from;
    return {
      next: () => (current >= 0 ? { value: current--, done: false } : { value: undefined, done: true }),
    };
  }
}
for (const n of new Countdown(3)) console.log(n);
console.log([...new Countdown(2)], Math.max(...new Countdown(5)));
```

## Generators: iterators the easy way

Writing `next()` by hand is tedious. A **generator function** (`function*`) does it for you: each `yield` hands out one value and **pauses** the function until the next value is requested.

```js
function* countdown(from) {
  for (let n = from; n >= 0; n--) {
    yield n;                        // pause here, giving out n
  }
}
console.log([...countdown(3)]);

function* steps() {
  console.log("  starting");
  yield 1;
  console.log("  resumed after 1");
  yield 2;
  console.log("  finished");
}
const gen = steps();
console.log("created (nothing has run yet)");
console.log(gen.next());
console.log(gen.next());
console.log(gen.next());
```

Calling a generator function runs **none** of its body: it returns a generator object. The body runs bit by bit, as values are asked for. That's **lazy evaluation**.

## Infinite sequences

Because values are produced only on demand, a generator can describe a sequence that never ends, as long as the consumer stops asking:

```js
function* naturals() {
  let n = 1;
  while (true) yield n++;            // safe: it pauses at every yield
}
function* fibonacci() {
  let [a, b] = [0, 1];
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}
const firstFib = [];
for (const f of fibonacci()) {
  if (f > 100) break;               // the consumer decides when to stop
  firstFib.push(f);
}
console.log(firstFib);
console.log(naturals().take(5).toArray());
```

## Iterator helpers

Since 2025, iterators have their own lazy versions of the array methods: `map`, `filter`, `take`, `drop`, `flatMap`, `reduce`, `some`, `every`, `find`, `forEach` and `toArray`. Unlike array methods, they don't build intermediate arrays, and they work on infinite sequences:

```js
function* naturals() { let n = 1; while (true) yield n++; }
const oddSquares = naturals()
  .filter((n) => n % 2 === 1)
  .map((n) => n * n)
  .take(4)                           // only the first 4 are ever computed
  .toArray();
console.log(oddSquares);
console.log(Iterator.from(new Set([3, 1, 2])).map((x) => x * 10).toArray());
```

Iterator helpers are part of ECMAScript 2025 and work in all current browsers (since early 2025). `Iterator.from(...)` turns any iterable into an iterator that has the helpers.

## When laziness pays off

- **Huge or endless data:** reading a large file line by line, paging through an API, generating IDs.
- **Stopping early:** "find the first match" without processing everything.
- **Pipelines** of steps where you don't want a copy of the data at every stage.

For small arrays, ordinary array methods are simpler and just as fast. Async generators (`async function*`) bring the same idea to data that arrives over time, such as streamed API responses (Part 4).

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Custom iteration | [Symbol.iterator]() returning { next } | O(1) per step | O(1) |
| Lazy sequence | function* with a loop and yield | O(1) per value | O(1) |
| First n of a pipeline | iter.filter(…).map(…).take(n).toArray() | O(items examined) | O(n) |

## Common mistakes

- Expecting a generator's body to run when the function is called.
- Spreading an infinite generator (`[...naturals()]`), which never finishes.
- Reusing a generator object after it's done (it stays finished).
- Resetting a batch array that was already handed to the consumer.

## Exercises

### 1. A range generator

Write a generator `range(start, end, step = 1)` that yields numbers from `start` up to (but not including) `end`, going up by `step`. A negative `step` counts down (stopping before `end`). A `step` of 0 should throw a `RangeError` as soon as iteration starts.

Starter code:

```js
function* range(start, end, step = 1) {
  // your code here
}

console.log([...range(0, 5)], [...range(1, 10, 3)], [...range(5, 0, -2)]);
// [ 0, 1, 2, 3, 4 ] [ 1, 4, 7 ] [ 5, 3, 1 ]
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** like Python's `range`, as a lazy generator, in both directions.
2. **Examples:** range(5, 0, -2) → 5, 3, 1 (stops before 0).
3. **Brute force:** build and return an array: works for small ranges, but range(0, 1e15) would never finish.
4. **Pattern:** **generator with a loop**.
5. **Plan:** guard zero → loop up or down → yield.
6. **Code and test:** empty ranges, wrong direction, fractional steps, a huge range to prove laziness.

</details>

<details>
<summary>💡 Hint 1</summary>

Inside a `function*`, a normal loop with `yield n` produces each value lazily.

</details>

<details>
<summary>💡 Hint 2</summary>

Counting up continues while `n < end`; counting down (negative step) while `n > end`.

</details>

<details>
<summary>💡 Hint 3</summary>

Check `step === 0` first and throw; because the body only starts when iteration starts, the error appears at that moment, as the task asks.

</details>

### 2. Batch any iterable

Write a generator `batches(iterable, size)` that yields arrays of up to `size` consecutive items from **any** iterable (array, string, Set, another generator…), the last batch possibly shorter. It must work on infinite iterables, producing batches lazily.

Starter code:

```js
function* batches(iterable, size) {
  // your code here
}

console.log([...batches([1, 2, 3, 4, 5], 2)]);        // [ [ 1, 2 ], [ 3, 4 ], [ 5 ] ]
console.log([...batches("hello", 3)]);                 // [ [ 'h', 'e', 'l' ], [ 'l', 'o' ] ]
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** like Lesson 9's chunk, but for any iterable and lazily.
2. **Examples:** "hello" in threes → h e l | l o.
3. **Brute force:** `[...iterable]` then chunk: breaks on infinite iterables and copies big ones.
4. **Pattern:** **streaming accumulator**: collect, emit, reset.
5. **Plan:** loop → push → emit when full → emit the remainder.
6. **Code and test:** strings, Sets, empty input, an infinite generator.

</details>

<details>
<summary>💡 Hint 1</summary>

You can't use `slice` on a Set or a generator, but `for…of` works on every iterable.

</details>

<details>
<summary>💡 Hint 2</summary>

Collect items into a `batch` array; when it reaches `size`, `yield` it and start a new empty one.

</details>

<details>
<summary>💡 Hint 3</summary>

After the loop, yield what's left if it isn't empty.

</details>

**In the sandbox:** exercises 37–38. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. A range generator</summary>

```js
function* range(start, end, step = 1) {
  if (step === 0) throw new RangeError("step can't be 0");
  if (step > 0) {
    for (let n = start; n < end; n += step) yield n;
  } else {
    for (let n = start; n > end; n += step) yield n;
  }
}

console.log([...range(0, 5)], [...range(1, 10, 3)], [...range(5, 0, -2)]);
```

**Line by line**

- `function*` makes a generator; nothing in it runs until the first `next()`.
- Two loops with different conditions handle the two directions; a positive step with `start > end` gives nothing, like Python.
- `yield n` pauses the loop, so a range up to 10¹⁵ costs nothing until values are requested.

**Trace:** `range(1, 10, 3)` → yields 1, 4, 7; next n is 10, not < 10 → done.

**Common wrong approach:** `while (n !== end)` as the loop condition: with a step that jumps over `end` (1, 4, 7, 10… for end 9) it never stops.

</details>

<details>
<summary>✅ 2. Batch any iterable</summary>

```js
function* batches(iterable, size) {
  let batch = [];
  for (const item of iterable) {
    batch.push(item);
    if (batch.length === size) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length > 0) yield batch;      // the shorter final batch
}

console.log([...batches([1, 2, 3, 4, 5], 2)]);
console.log([...batches("hello", 3)]);
```

**Line by line**

- `for…of` pulls one item at a time from the source, so the source can be infinite.
- `yield batch` pauses after each full batch; the consumer controls how many batches are made.
- `batch = []` starts a new array rather than clearing the old one (`batch.length = 0` would empty the array the consumer just received).
- The final `if` emits a short last batch, but never an empty one.

**Trace:** "hello", 3 → push h, e, l → yield [h, e, l] → push l, o → loop ends → yield [l, o].

**Common wrong approach:** `batch.length = 0` to reset: the batch already handed out is the same array, so the consumer's data vanishes.

</details>

## Quick quiz

1. What does calling a generator function do?
   - A) Returns a generator object; the body runs only as values are requested
   - B) Runs the whole body immediately
   - C) Returns an array of every yielded value

2. What must an object have to work with for…of?
   - A) A [Symbol.iterator]() method returning an iterator
   - B) A length property
   - C) A forEach method

3. Why can while (true) yield n++ be safe?
   - A) The generator pauses at each yield, and the consumer decides when to stop
   - B) JavaScript stops infinite loops automatically
   - C) yield ends the loop

4. What's an advantage of iterator helpers like .filter().map().take() over array methods?
   - A) They're lazy: no intermediate arrays, and they work on infinite sequences
   - B) They're always faster for small arrays
   - C) They sort automatically

<details>
<summary>Quiz answers</summary>

1. **A) Returns a generator object; the body runs only as values are requested**: Generators are lazy.
2. **A) A [Symbol.iterator]() method returning an iterator**: That's the iteration protocol.
3. **A) The generator pauses at each yield, and the consumer decides when to stop**: Use take, break or a condition in the consumer.
4. **A) They're lazy: no intermediate arrays, and they work on infinite sequences**: Each value flows through the whole pipeline on demand.

</details>

---
Previous: [Lesson 18](18-errors.md) · Next: [Lesson 20: Regular expressions](20-regular-expressions.md)
