# Lesson 9: Arrays

**You'll learn:** creating arrays, length, indexes and at(), push, pop, shift, unshift and splice, includes, indexOf and lastIndexOf, methods that change an array versus ones that return a new one, toSorted, toReversed, toSpliced and with, arrays as references, copying with spread, slice, concat, Array.from, fill, flat, nested arrays.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#arrays)**: run every example and check your exercise answers.

## Key terms

- **Array:** an ordered list of values, accessed by index.
- **Mutating method:** a method that changes the array it's called on, such as `push` or `sort`.
- **Non-mutating method:** a method that returns a new array and leaves the original unchanged, such as `slice` or `toSorted`.
- **Reference:** what a variable holds for an object or array: a pointer to it, not a copy.
- **Shallow copy:** a new array or object whose items are the same values (nested objects are shared).
- **`splice`:** removes and/or inserts items at a position, changing the array.

An **array** is an ordered list of values, like a Python list. Items can be of any type, even mixed, and the array grows and shrinks as needed.

```js
const parts = ["frame", "wheel", "saddle"];
const mixed = [1, "two", true, null, [5, 6]];
console.log(parts.length, parts[0], parts.at(-1));
console.log(mixed[4][1]);           // nested: the second item of the fifth item
console.log(parts[10]);             // past the end: undefined, no error
```

## Adding and removing

```js
const queue = ["Ada", "Bo"];
queue.push("Cy");            // add to the end
queue.unshift("Dee");        // add to the start
console.log(queue);
const last = queue.pop();    // remove from the end
const first = queue.shift(); // remove from the start
console.log(first, last, queue);

const tools = ["pump", "spanner", "lever", "oil"];
const removed = tools.splice(1, 2, "patch kit");   // at index 1: remove 2 items, insert one
console.log(removed, tools);
```

`push`/`pop` work on the end and are fast. `shift`/`unshift` work on the start and have to move every other item, so they're slow for very long arrays (a queue of millions of items deserves a different structure).

## Searching

```js
const sizes = ["S", "M", "L", "M"];
console.log(sizes.includes("L"), sizes.indexOf("M"), sizes.lastIndexOf("M"), sizes.indexOf("XL"));
```

`includes` answers "is it there?"; `indexOf` gives the first position or `-1`. Both compare with `===`, so they can't find an object by its contents (Lesson 10's `find` can).

## Changing versus copying

This is the most important idea about arrays. Some methods **change (mutate)** the array they're called on; others **return a new array** and leave the original alone:

| Changes the array | Returns a new array |
|---|---|
| `push`, `pop`, `shift`, `unshift`, `splice` | `slice`, `concat`, `[...arr]` |
| `sort`, `reverse` | `toSorted`, `toReversed` (ES2023) |
| `fill`, `copyWithin` | `toSpliced`, `with` (ES2023), `map`, `filter` |

```js
const original = [3, 1, 2];
const sortedCopy = original.toSorted();
console.log(original, sortedCopy);       // the original is untouched
original.sort();
console.log(original);                   // now it's sorted in place

const prices = [10, 20, 30];
const cheaper = prices.with(0, 8);       // a copy with index 0 replaced
console.log(prices, cheaper);
```

Preferring the copying methods makes code easier to reason about, and it's essential in UI frameworks such as React, which detect changes by comparing arrays.

## Arrays are references

A variable doesn't contain the array itself, only a **reference** to it. Assigning it to another variable copies the reference, not the array:

```js
const a = [1, 2, 3];
const b = a;              // the same array, two names
b.push(4);
console.log(a);           // [ 1, 2, 3, 4 ]: a changed too
const c = [...a];         // spread makes a new array with the same items
c.push(5);
console.log(a.length, c.length);
console.log([1, 2] === [1, 2]);   // false: two different arrays
```

`const` doesn't prevent changes either: `const a` stops you pointing `a` at another array, but the array's contents can still change. Lesson 11 draws this picture for objects, where it matters just as much.

## Slicing, joining and building

```js
const letters = ["a", "b", "c", "d", "e"];
console.log(letters.slice(1, 3), letters.slice(-2));   // like strings: start up to (not including) end
console.log(letters.concat(["f", "g"]), [...letters, "f"]);
console.log(Array.from({ length: 5 }, (_, i) => i * i));   // build an array from a rule
console.log(new Array(3).fill(0), Array.from("hey"));
console.log([[1, 2], [3, [4, 5]]].flat(), [[1, 2], [3, [4, 5]]].flat(Infinity));
```

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Add or remove at the end | push / pop | O(1) | O(1) |
| Add or remove at the start | unshift / shift | O(n) | O(1) |
| Copy | [...arr] or arr.slice() | O(n) | O(n) |
| Rotate | normalise k with modulo; join two slices | O(n) | O(n) |
| Chunk | step by size; slice each piece | O(n) | O(n) |

## Common mistakes

- Changing an array that was passed in to a function, surprising the caller.
- Thinking `const` stops an array's contents from changing.
- Copying with `b = a` and then modifying `b`.
- Comparing arrays with `===`.
- Reading past the end and getting `undefined` silently.

## Exercises

### 1. Rotate an array

Write `rotate(items, k)` returning a **new** array with the items rotated `k` places to the right: `rotate([1, 2, 3, 4, 5], 2)` is `[4, 5, 1, 2, 3]`. Negative `k` rotates left, and `k` larger than the length wraps around. Don't change the original array.

Starter code:

```js
function rotate(items, k) {
  // your code here
}

const nums = [1, 2, 3, 4, 5];
console.log(rotate(nums, 2), rotate(nums, -1), nums);
// [ 4, 5, 1, 2, 3 ] [ 2, 3, 4, 5, 1 ] [ 1, 2, 3, 4, 5 ]
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a new array; right for positive k, left for negative, wrapping around.
2. **Examples:** k = 7 on 5 items is the same as k = 2; k = −1 is the same as k = 4.
3. **Brute force:** pop from the end and unshift to the front, k times, on a copy: O(n·k).
4. **Pattern:** **normalise with modulo, then slice and join**: O(n).
5. **Plan:** empty check → shift in 0…n−1 → two slices spread into a new array.
6. **Code and test:** zero, negative, larger than n, empty, one item; check the original is unchanged.

</details>

<details>
<summary>💡 Hint 1</summary>

Rotating right by `k` moves the last `k` items to the front: `[...last k items, ...the rest]`, built with `slice`.

</details>

<details>
<summary>💡 Hint 2</summary>

First reduce `k` into the range 0 to `n − 1`. In JavaScript `-1 % 5` is `-1`, so use `((k % n) + n) % n` to get 4.

</details>

<details>
<summary>💡 Hint 3</summary>

`return [...items.slice(n - shift), ...items.slice(0, n - shift)];`, with a special case for an empty array (to avoid `% 0`).

</details>

### 2. Split into chunks

Write `chunk(items, size)` returning an array of arrays, each with `size` items (the last may be shorter): `chunk([1, 2, 3, 4, 5], 2)` is `[[1, 2], [3, 4], [5]]`. If `size` isn't a positive whole number, throw a `RangeError`.

Starter code:

```js
function chunk(items, size) {
  // your code here
}

console.log(chunk([1, 2, 3, 4, 5], 2));   // [ [ 1, 2 ], [ 3, 4 ], [ 5 ] ]
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** consecutive groups of `size`, the last possibly short; reject bad sizes.
2. **Examples:** 5 items in twos → [1,2], [3,4], [5].
3. **Brute force:** push items one by one into a "current" array, starting a new one when it's full: works, more bookkeeping.
4. **Pattern:** **step loop + slice**.
5. **Plan:** validate → loop i = 0, size, 2·size… → push slices.
6. **Code and test:** even and uneven splits, empty, size 1, size larger than the array, invalid sizes.

</details>

<details>
<summary>💡 Hint 1</summary>

Step through the array `size` items at a time: `for (let i = 0; i < items.length; i += size)`.

</details>

<details>
<summary>💡 Hint 2</summary>

Each chunk is `items.slice(i, i + size)`; slicing past the end just gives a shorter piece.

</details>

<details>
<summary>💡 Hint 3</summary>

Validate first with `Number.isInteger(size) && size >= 1`, otherwise `throw new RangeError(...)`. (A size of 0 would loop forever.)

</details>

**In the sandbox:** exercises 17–18. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Rotate an array</summary>

```js
function rotate(items, k) {
  const n = items.length;
  if (n === 0) return [];
  const shift = ((k % n) + n) % n;        // 0 to n − 1, even for negative k
  return [...items.slice(n - shift), ...items.slice(0, n - shift)];
}

const nums = [1, 2, 3, 4, 5];
console.log(rotate(nums, 2), rotate(nums, -1), nums);
```

**Line by line**

- `n === 0` returns early, because `k % 0` would be `NaN`.
- `((k % n) + n) % n` turns any k into a right-rotation from 0 to n − 1: for k = −12, n = 5: −12 % 5 = −2, + 5 = 3, % 5 = 3.
- `items.slice(n - shift)` is the last `shift` items; `items.slice(0, n - shift)` the rest. Both copy, so the original is untouched.
- Spreading both into `[...]` builds the new array in order.

**Trace:** `rotate([1, 2, 3, 4, 5], 2)` → shift 2 → `[4, 5]` + `[1, 2, 3]`.

**Common wrong approach:** `items.unshift(items.pop())` in a loop on the original array, which changes the caller's data. Functions that return a new result shouldn't secretly modify their input.

</details>

<details>
<summary>✅ 2. Split into chunks</summary>

```js
function chunk(items, size) {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(`size must be a positive whole number, not ${size}`);
  }
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

console.log(chunk([1, 2, 3, 4, 5], 2));
```

**Line by line**

- The guard matters for more than tidiness: with `size = 0`, `i += size` never moves and the loop runs forever.
- `i += size` jumps to the start of each chunk.
- `slice(i, i + size)` never fails past the end; it returns what's left.

**Trace:** `chunk([1, 2, 3, 4, 5], 2)` → i = 0: [1, 2]; i = 2: [3, 4]; i = 4: [5]; i = 6 stops.

**Common wrong approach:** `splice` on the input inside the loop. It works but empties the caller's array as a side effect.

</details>

## Quick quiz

1. Which method adds an item to the end of an array?
   - A) push
   - B) unshift
   - C) shift

2. const a = [1, 2]; const b = a; b.push(3); What is a?
   - A) [1, 2, 3]
   - B) [1, 2]
   - C) An error, because a is const

3. Which of these does NOT change the original array?
   - A) toSorted()
   - B) sort()
   - C) reverse()
   - D) splice()

4. How do you make a shallow copy of an array arr?
   - A) [...arr]
   - B) const copy = arr
   - C) arr.copy()

<details>
<summary>Quiz answers</summary>

1. **A) push**: pop removes from the end; unshift and shift work on the start.
2. **A) [1, 2, 3]**: a and b refer to the same array.
3. **A) toSorted()**: The ES2023 to… methods return copies.
4. **A) [...arr]**: Spread (or arr.slice()) creates a new array with the same items.

</details>

---
Previous: [Lesson 8](08-scope-and-closures.md) · Next: [Lesson 10: Array methods: map, filter, reduce and friends](10-array-methods.md)
