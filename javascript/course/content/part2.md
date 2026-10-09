@@@ part
id: 2
title: Working with Data
level: Beginner
blurb: The values real programs juggle: arrays and their methods, objects, destructuring and spread, Map and Set, JSON (the format every API speaks), and dates and times, including the new Temporal API.

@@@ lesson
id: arrays
title: Arrays
minutes: 24
summary: Creating arrays, length and indexes, at(), adding and removing items (push, pop, shift, unshift, splice), searching with includes and indexOf, slicing and concatenating, copying with spread, methods that change an array versus ones that return a new one, nested arrays, and Array.from.
---
An **array** is an ordered list of values, like a Python list. Items can be of any type, even mixed, and the array grows and shrinks as needed.

```js
const parts = ["frame", "wheel", "saddle"];
const mixed = [1, "two", true, null, [5, 6]];
console.log(parts.length, parts[0], parts.at(-1));
console.log(mixed[4][1]);           // nested: the second item of the fifth item
console.log(parts[10]);             // past the end: undefined, no error
```

### Adding and removing

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

### Searching

```js
const sizes = ["S", "M", "L", "M"];
console.log(sizes.includes("L"), sizes.indexOf("M"), sizes.lastIndexOf("M"), sizes.indexOf("XL"));
```

`includes` answers "is it there?"; `indexOf` gives the first position or `-1`. Both compare with `===`, so they can't find an object by its contents (Lesson 10's `find` can).

### Changing versus copying

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

### Arrays are references

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

### Slicing, joining and building

```js
const letters = ["a", "b", "c", "d", "e"];
console.log(letters.slice(1, 3), letters.slice(-2));   // like strings: start up to (not including) end
console.log(letters.concat(["f", "g"]), [...letters, "f"]);
console.log(Array.from({ length: 5 }, (_, i) => i * i));   // build an array from a rule
console.log(new Array(3).fill(0), Array.from("hey"));
console.log([[1, 2], [3, [4, 5]]].flat(), [[1, 2], [3, [4, 5]]].flat(Infinity));
```

:::exercise Rotate an array
Write `rotate(items, k)` returning a **new** array with the items rotated `k` places to the right: `rotate([1, 2, 3, 4, 5], 2)` is `[4, 5, 1, 2, 3]`. Negative `k` rotates left, and `k` larger than the length wraps around. Don't change the original array.
```js starter
function rotate(items, k) {
  // your code here
}

const nums = [1, 2, 3, 4, 5];
console.log(rotate(nums, 2), rotate(nums, -1), nums);
// [ 4, 5, 1, 2, 3 ] [ 2, 3, 4, 5, 1 ] [ 1, 2, 3, 4, 5 ]
```
```js check
test("rotate", [
  [[[1, 2, 3, 4, 5], 2], [4, 5, 1, 2, 3], "right by 2"],
  [[[1, 2, 3, 4, 5], -1], [2, 3, 4, 5, 1], "left by 1"],
  [[[1, 2, 3, 4, 5], 0], [1, 2, 3, 4, 5], "no rotation"],
  [[[1, 2, 3, 4, 5], 7], [4, 5, 1, 2, 3], "more than the length"],
  [[[1, 2, 3, 4, 5], -12], [3, 4, 5, 1, 2], "far to the left"],
  [[[], 3], [], "an empty array"],
  [[["a"], 5], ["a"], "one item"],
], { show: "rotate({0}, {1})" });
const r = need("rotate", "function");
const original = [1, 2, 3];
const out = r(original, 1);
same(original, [1, 2, 3], "The original array after rotate");
if (out === original) throw new AssertionError("Return a new array, not the same one.");
```
```js solution
function rotate(items, k) {
  const n = items.length;
  if (n === 0) return [];
  const shift = ((k % n) + n) % n;        // 0 to n − 1, even for negative k
  return [...items.slice(n - shift), ...items.slice(0, n - shift)];
}

const nums = [1, 2, 3, 4, 5];
console.log(rotate(nums, 2), rotate(nums, -1), nums);
```
hint: Rotating right by `k` moves the last `k` items to the front: `[...last k items, ...the rest]`, built with `slice`.
hint: First reduce `k` into the range 0 to `n − 1`. In JavaScript `-1 % 5` is `-1`, so use `((k % n) + n) % n` to get 4.
hint: `return [...items.slice(n - shift), ...items.slice(0, n - shift)];`, with a special case for an empty array (to avoid `% 0`).
approach:
1. **Understand:** a new array; right for positive k, left for negative, wrapping around.
2. **Examples:** k = 7 on 5 items is the same as k = 2; k = −1 is the same as k = 4.
3. **Brute force:** pop from the end and unshift to the front, k times, on a copy: O(n·k).
4. **Pattern:** **normalise with modulo, then slice and join**: O(n).
5. **Plan:** empty check → shift in 0…n−1 → two slices spread into a new array.
6. **Code and test:** zero, negative, larger than n, empty, one item; check the original is unchanged.
walkthrough:
**Line by line**

- `n === 0` returns early, because `k % 0` would be `NaN`.
- `((k % n) + n) % n` turns any k into a right-rotation from 0 to n − 1: for k = −12, n = 5: −12 % 5 = −2, + 5 = 3, % 5 = 3.
- `items.slice(n - shift)` is the last `shift` items; `items.slice(0, n - shift)` the rest. Both copy, so the original is untouched.
- Spreading both into `[...]` builds the new array in order.

**Trace:** `rotate([1, 2, 3, 4, 5], 2)` → shift 2 → `[4, 5]` + `[1, 2, 3]`.

**Common wrong approach:** `items.unshift(items.pop())` in a loop on the original array, which changes the caller's data. Functions that return a new result shouldn't secretly modify their input.
:::

:::exercise Split into chunks
Write `chunk(items, size)` returning an array of arrays, each with `size` items (the last may be shorter): `chunk([1, 2, 3, 4, 5], 2)` is `[[1, 2], [3, 4], [5]]`. If `size` isn't a positive whole number, throw a `RangeError`.
```js starter
function chunk(items, size) {
  // your code here
}

console.log(chunk([1, 2, 3, 4, 5], 2));   // [ [ 1, 2 ], [ 3, 4 ], [ 5 ] ]
```
```js check
test("chunk", [
  [[[1, 2, 3, 4, 5], 2], [[1, 2], [3, 4], [5]], "an uneven split"],
  [[[1, 2, 3, 4], 2], [[1, 2], [3, 4]], "an even split"],
  [[[1, 2, 3], 5], [[1, 2, 3]], "size bigger than the array"],
  [[[], 3], [], "empty"],
  [[["a", "b", "c"], 1], [["a"], ["b"], ["c"]], "size 1"],
], { show: "chunk({0}, {1})" });
const c = need("chunk", "function");
for (const bad of [0, -2, 1.5, NaN]) {
  let threw = null;
  try { c([1, 2, 3], bad); } catch (e) { threw = e; }
  if (!(threw instanceof RangeError)) throw new AssertionError(`chunk([1, 2, 3], ${bad}) should throw a RangeError.`);
}
```
```js solution
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
hint: Step through the array `size` items at a time: `for (let i = 0; i < items.length; i += size)`.
hint: Each chunk is `items.slice(i, i + size)`; slicing past the end just gives a shorter piece.
hint: Validate first with `Number.isInteger(size) && size >= 1`, otherwise `throw new RangeError(...)`. (A size of 0 would loop forever.)
approach:
1. **Understand:** consecutive groups of `size`, the last possibly short; reject bad sizes.
2. **Examples:** 5 items in twos → [1,2], [3,4], [5].
3. **Brute force:** push items one by one into a "current" array, starting a new one when it's full: works, more bookkeeping.
4. **Pattern:** **step loop + slice**.
5. **Plan:** validate → loop i = 0, size, 2·size… → push slices.
6. **Code and test:** even and uneven splits, empty, size 1, size larger than the array, invalid sizes.
walkthrough:
**Line by line**

- The guard matters for more than tidiness: with `size = 0`, `i += size` never moves and the loop runs forever.
- `i += size` jumps to the start of each chunk.
- `slice(i, i + size)` never fails past the end; it returns what's left.

**Trace:** `chunk([1, 2, 3, 4, 5], 2)` → i = 0: [1, 2]; i = 2: [3, 4]; i = 4: [5]; i = 6 stops.

**Common wrong approach:** `splice` on the input inside the loop. It works but empties the caller's array as a side effect.
:::

:::quiz
? Which method adds an item to the end of an array?
+ push
- unshift
- shift
= pop removes from the end; unshift and shift work on the start.
? const a = [1, 2]; const b = a; b.push(3); What is a?
+ [1, 2, 3]
- [1, 2]
- An error, because a is const
= a and b refer to the same array.
? Which of these does NOT change the original array?
+ toSorted()
- sort()
- reverse()
- splice()
= The ES2023 to… methods return copies.
? How do you make a shallow copy of an array arr?
+ [...arr]
- const copy = arr
- arr.copy()
= Spread (or arr.slice()) creates a new array with the same items.
:::

@@@ lesson
id: array-methods
title: Array methods: map, filter, reduce and friends
minutes: 28
summary: Callbacks that work on each item: forEach, map, filter, find and findIndex, findLast, some and every, reduce and accumulators, sorting with a comparator (and why the default sort is wrong for numbers), flat and flatMap, Object.groupBy, and chaining methods into readable pipelines.
---
Most array work is "do something with each item". Instead of writing a loop every time, arrays have **methods that take a callback** (a function, Lesson 7) and call it for each item.

```js-static
const orders = [
  { id: 1, customer: "Ada", total: 120, paid: true },
  { id: 2, customer: "Bo", total: 35, paid: false },
  { id: 3, customer: "Cy", total: 64, paid: true },
  { id: 4, customer: "Ada", total: 18, paid: true },
];
```

The examples below all use this `orders` array; each example repeats it so you can run it on its own.

### map: transform every item

`map` returns a **new array** of the same length, made of whatever the callback returns:

```js
const orders = [{ id: 1, total: 120 }, { id: 2, total: 35 }, { id: 3, total: 64 }];
const totals = orders.map((o) => o.total);
const withVat = orders.map((o) => ({ ...o, total: o.total * 1.2 }));   // a new object for each
console.log(totals);
console.log(withVat[0], orders[0]);    // the originals are unchanged
```

To return an object from a short arrow function, wrap it in brackets: `(o) => ({ … })`. Without them, the braces would be read as the function body.

### filter: keep some items

`filter` keeps the items for which the callback returns something truthy:

```js
const orders = [{ id: 1, total: 120, paid: true }, { id: 2, total: 35, paid: false }, { id: 3, total: 64, paid: true }];
const unpaid = orders.filter((o) => !o.paid);
const big = orders.filter((o) => o.total >= 50).map((o) => o.id);    // methods chain
console.log(unpaid, big);
```

### find, findIndex, findLast, some, every

```js
const orders = [{ id: 1, customer: "Ada", total: 120 }, { id: 2, customer: "Bo", total: 35 }, { id: 4, customer: "Ada", total: 18 }];
console.log(orders.find((o) => o.customer === "Ada"));          // the first match, or undefined
console.log(orders.findLast((o) => o.customer === "Ada").id);   // the last match
console.log(orders.findIndex((o) => o.total > 1000));            // -1: none
console.log(orders.some((o) => o.total > 100), orders.every((o) => o.total > 10));
```

`find` stops at the first match; `some` stops at the first `true`; `every` stops at the first `false`.

### reduce: combine everything into one value

`reduce` walks the array carrying an **accumulator**, like the loops in Lesson 6:

![reduce on the totals [120, 35, 64] with a starting value of 0. Step 1: accumulator 0 plus 120 gives 120. Step 2: 120 plus 35 gives 155. Step 3: 155 plus 64 gives 219, the final result](figures/reduce.svg)

```js
const totals = [120, 35, 64];
const sum = totals.reduce((acc, t) => acc + t, 0);     // 0 is the starting accumulator
const biggest = totals.reduce((acc, t) => Math.max(acc, t), -Infinity);
console.log(sum, biggest);

const words = ["bike", "bell", "brake", "pump"];
const byLetter = words.reduce((acc, w) => {
  acc[w[0]] = (acc[w[0]] ?? 0) + 1;
  return acc;                                          // always return the accumulator
}, {});
console.log(byLetter);
```

Always pass the **starting value** (the second argument). Without it, `reduce` uses the first item, which fails on empty arrays and does odd things when the accumulator should be a different type. If a `reduce` gets hard to read, a plain loop is fine.

### Sorting: always pass a comparator for numbers

```js
const nums = [10, 1, 5, 100];
console.log(nums.toSorted());                    // [ 1, 10, 100, 5 ]: compared as TEXT!
console.log(nums.toSorted((a, b) => a - b));     // ascending numbers
console.log(nums.toSorted((a, b) => b - a));     // descending

const people = [{ name: "Zoë", age: 30 }, { name: "ada", age: 25 }, { name: "Bo", age: 30 }];
const byAgeThenName = people.toSorted((a, b) => a.age - b.age || a.name.localeCompare(b.name));
console.log(byAgeThenName.map((p) => p.name));
```

- With no comparator, `sort` and `toSorted` convert items to **strings** and compare those: fine for words, wrong for numbers.
- A **comparator** `(a, b) => …` returns a negative number if `a` should come first, positive if `b` should, `0` if they're equal. `a - b` sorts numbers ascending.
- `a.localeCompare(b)` compares text the way people expect (ignoring the capital-letters-first rule).
- `||` chains tie-breakers: if the ages are equal (`0`), compare names.
- Sorting is **stable**: items that compare equal keep their original order.

### Grouping, flattening and forEach

```js
const orders = [{ customer: "Ada", total: 120 }, { customer: "Bo", total: 35 }, { customer: "Ada", total: 18 }];
const byCustomer = Object.groupBy(orders, (o) => o.customer);      // ES2024
console.log(byCustomer);
console.log([["a", "b"], ["c"]].flat(), ["a b", "c d e"].flatMap((s) => s.split(" ")));
orders.forEach((o, i) => console.log(i, o.customer));            // for side effects only; returns undefined
```

`forEach` is for side effects (like printing). If you're building a new array, use `map` or `filter`; if you need `break`, use a `for…of` loop.

### Chaining

These methods return arrays, so they chain into readable pipelines:

```js
const orders = [
  { id: 1, customer: "Ada", total: 120, paid: true },
  { id: 2, customer: "Bo", total: 35, paid: false },
  { id: 3, customer: "Cy", total: 64, paid: true },
  { id: 4, customer: "Ada", total: 18, paid: true },
];
const paidRevenue = orders
  .filter((o) => o.paid)
  .map((o) => o.total)
  .reduce((sum, t) => sum + t, 0);
console.log(`Revenue from paid orders: £${paidRevenue}`);
```

Each step does one thing, so the pipeline reads like a description of the result. It's not the fastest possible code (each step makes a new array), but for everyday data sizes clarity wins.

:::exercise Summarise orders
Write `summarise(orders)` taking an array of orders `{ customer, total, paid }` and returning an object with:

- `count`: the number of **paid** orders,
- `revenue`: the sum of their totals,
- `customers`: the **distinct** customers with paid orders, sorted alphabetically.
```js starter
function summarise(orders) {
  // your code here
}

const orders = [
  { customer: "Cy", total: 64, paid: true },
  { customer: "Bo", total: 35, paid: false },
  { customer: "Ada", total: 120, paid: true },
  { customer: "Ada", total: 18, paid: true },
];
console.log(summarise(orders));
// { count: 3, revenue: 202, customers: [ 'Ada', 'Cy' ] }
```
```js check
const o = [
  { customer: "Cy", total: 64, paid: true },
  { customer: "Bo", total: 35, paid: false },
  { customer: "Ada", total: 120, paid: true },
  { customer: "Ada", total: 18, paid: true },
];
test("summarise", [
  [[o], { count: 3, revenue: 202, customers: ["Ada", "Cy"] }, "the example"],
  [[[]], { count: 0, revenue: 0, customers: [] }, "no orders"],
  [[[{ customer: "Zed", total: 5, paid: false }]], { count: 0, revenue: 0, customers: [] }, "nothing paid"],
  [[[{ customer: "bo", total: 1.5, paid: true }, { customer: "Al", total: 2.25, paid: true }]], { count: 2, revenue: 3.75, customers: ["Al", "bo"] }, "decimals and lower case"],
], { show: "summarise(orders)" });
const f = need("summarise", "function");
const copy = structuredClone(o);
f(o);
same(o, copy, "The orders array after summarise (it shouldn't change)");
```
```js solution
function summarise(orders) {
  const paid = orders.filter((o) => o.paid);
  const revenue = paid.reduce((sum, o) => sum + o.total, 0);
  const customers = [...new Set(paid.map((o) => o.customer))].toSorted((a, b) => a.localeCompare(b));
  return { count: paid.length, revenue, customers };
}

const orders = [
  { customer: "Cy", total: 64, paid: true },
  { customer: "Bo", total: 35, paid: false },
  { customer: "Ada", total: 120, paid: true },
  { customer: "Ada", total: 18, paid: true },
];
console.log(summarise(orders));
```
hint: Start by filtering to the paid orders; all three results come from that list.
hint: `reduce((sum, o) => sum + o.total, 0)` adds up the totals. For distinct customers, `new Set(names)` removes duplicates (Lesson 13), and `[...set]` turns it back into an array.
hint: Sort the names with `toSorted((a, b) => a.localeCompare(b))`, then `return { count: paid.length, revenue, customers };`.
approach:
1. **Understand:** three facts about the paid subset; don't modify the input.
2. **Examples:** Ada appears twice but is listed once.
3. **Brute force:** one loop with three accumulators and an `includes` check for names: works, longer.
4. **Pattern:** **filter → map / reduce** pipeline.
5. **Plan:** paid = filter → revenue = reduce → customers = map → Set → array → sort.
6. **Code and test:** empty input, nothing paid, decimals, lower-case names; check the input is unchanged.
walkthrough:
**Line by line**

- Filtering once and reusing `paid` keeps the three calculations consistent.
- `reduce` with a starting value of `0` returns 0 for an empty list instead of throwing.
- `new Set(...)` keeps one copy of each name; spreading it back gives an array that can be sorted.
- `localeCompare` sorts "Al" before "bo" even though lower-case letters have bigger character codes.

**Trace:** paid → Cy 64, Ada 120, Ada 18 → revenue 202 → names Cy, Ada, Ada → {Cy, Ada} → sorted [Ada, Cy].

**Common wrong approach:** `orders.sort(...)` or `orders.splice(...)` inside the function, which reorders or empties the caller's data.
:::

:::exercise Best-selling products
`sales` is an array of `{ product, qty }` records, with products repeated. Write `topProducts(sales, n)` returning the names of the `n` products with the largest **total** quantity, biggest first. Break ties alphabetically by name.
```js starter
function topProducts(sales, n) {
  // your code here
}

const sales = [
  { product: "tube", qty: 5 }, { product: "bell", qty: 2 },
  { product: "lock", qty: 4 }, { product: "bell", qty: 3 }, { product: "pump", qty: 5 },
];
console.log(topProducts(sales, 2));   // [ 'bell', 'pump' ]  (bell 5, pump 5, tube 5: alphabetical)
```
```js check
const s = [
  { product: "tube", qty: 5 }, { product: "bell", qty: 2 },
  { product: "lock", qty: 4 }, { product: "bell", qty: 3 }, { product: "pump", qty: 5 },
];
test("topProducts", [
  [[s, 2], ["bell", "pump"], "a three-way tie at the top"],
  [[s, 4], ["bell", "pump", "tube", "lock"], "everything"],
  [[s, 10], ["bell", "pump", "tube", "lock"], "n bigger than the number of products"],
  [[s, 0], [], "n = 0"],
  [[[], 3], [], "no sales"],
  [[[{ product: "a", qty: 1 }, { product: "b", qty: 10 }, { product: "a", qty: 20 }], 1], ["a"], "totals, not single sales"],
], { show: "topProducts(sales, {1})" });
```
```js solution
function topProducts(sales, n) {
  const totals = {};
  for (const { product, qty } of sales) {
    totals[product] = (totals[product] ?? 0) + qty;
  }
  return Object.entries(totals)
    .toSorted(([nameA, qtyA], [nameB, qtyB]) => qtyB - qtyA || nameA.localeCompare(nameB))
    .slice(0, n)
    .map(([name]) => name);
}

const sales = [
  { product: "tube", qty: 5 }, { product: "bell", qty: 2 },
  { product: "lock", qty: 4 }, { product: "bell", qty: 3 }, { product: "pump", qty: 5 },
];
console.log(topProducts(sales, 2));
```
hint: First add up the quantity per product, in an object (or a Map) keyed by product name.
hint: `Object.entries(totals)` turns `{ bell: 5, … }` into `[["bell", 5], …]`, which you can sort with a comparator.
hint: Sort with `(a, b) => b[1] - a[1] || a[0].localeCompare(b[0])` (biggest total first, then by name), then `slice(0, n)` and keep just the names.
approach:
1. **Understand:** aggregate, then rank with a tie-breaker, then cut to n.
2. **Examples:** bell 2 + 3 = 5 ties with tube and pump; alphabetical order puts bell, pump, tube.
3. **Brute force:** for each distinct product, scan all sales to total it: O(p · s).
4. **Pattern:** **count into a dictionary, sort the entries, take the top n**.
5. **Plan:** totals object → entries → sort (qty desc, name asc) → slice → names.
6. **Code and test:** ties, n = 0, n too big, empty input.
walkthrough:
**Line by line**

- The `for…of` with `{ product, qty }` unpacks each record (destructuring, Lesson 12).
- `(totals[product] ?? 0) + qty` starts each product at 0.
- The comparator returns `qtyB - qtyA` (bigger first); when that's `0` (a tie), `||` falls through to the name comparison.
- `slice(0, n)` copes with n larger than the list, and `.map(([name]) => name)` keeps only the names.

**Trace:** totals tube 5, bell 5, lock 4, pump 5 → sorted bell, pump, tube (all 5, by name), lock → first 2: bell, pump.

**Common wrong approach:** sorting the raw sales instead of the totals, so a single big sale beats a product sold many times in small amounts.
:::

:::quiz
? What does [10, 1, 5].toSorted() return?
+ [1, 10, 5]
- [1, 5, 10]
- [10, 5, 1]
= Without a comparator, items are compared as strings.
? Which method returns the first item matching a condition?
+ find
- filter
- some
= filter returns all matches as an array; some returns true or false.
? Why pass a starting value to reduce?
+ So it works on empty arrays and the accumulator starts with the right type
- reduce requires exactly two arguments
- It makes reduce run faster
= Without it, reduce uses the first item and throws on [].
? How should an arrow function return an object literal?
+ (x) => ({ value: x })
- (x) => { value: x }
- (x) => return { value: x }
= Without brackets the braces are a function body.
:::

@@@ lesson
id: objects
title: Objects
minutes: 26
summary: Object literals, reading and writing properties with dots and brackets, computed and shorthand keys, methods, checking for and deleting properties, looping with Object.keys, values and entries, building objects with Object.fromEntries, nested objects, references and shallow versus deep copies with structuredClone, and freezing.
---
An **object** groups named values (**properties**). It's JavaScript's equivalent of a Python dictionary, and also the basis of every more complex value.

```js
const bike = {
  model: "Trail 29",
  price: 899,
  "frame size": "L",          // keys that aren't valid names need quotes
  tags: ["mtb", "alloy"],
  owner: { name: "Ada", city: "Bristol" },
};
console.log(bike.model, bike["frame size"], bike.owner.city, bike.tags[1]);
console.log(bike.colour);     // missing property: undefined
```

### Dots and brackets

Use **dot** notation (`bike.price`) when you know the name; **brackets** (`bike[key]`) when the name is in a variable or isn't a valid identifier:

```js
const bike = { model: "Trail 29", price: 899 };
const field = "price";
console.log(bike[field]);
bike.price = 849;             // change
bike.colour = "green";        // add
delete bike.model;            // remove
console.log(bike);
```

### Shorthand, computed keys and methods

```js
const name = "Ada", city = "Bristol";
const user = { name, city };                     // shorthand for { name: name, city: city }
const key = "loyalty points";
const account = { [key]: 120, [`${key} expiry`]: "2027-01-01" };   // computed keys
const cart = {
  items: [6, 12],
  total() {                                      // a method: a function stored as a property
    return this.items.reduce((a, b) => a + b, 0);
  },
};
console.log(user, account, cart.total());
```

Inside a method, `this` refers to the object it was called on (Part 3 covers `this` properly).

### Checking for properties

```js
const stock = { tubes: 12, bells: 0, pumps: undefined };
console.log("bells" in stock, Object.hasOwn(stock, "pumps"), "locks" in stock);
console.log(stock.bells ? "have bells" : "no bells?!");   // careful: 0 is falsy
```

`stock.bells` is `0`, which is falsy, so a truthiness test wrongly says there are none. Use `in` or `Object.hasOwn` to ask "is the key there?", and `!== undefined` or `??` for "is there a value?".

### Looping over objects

```js
const stock = { tubes: 12, tyres: 4, bells: 0 };
console.log(Object.keys(stock), Object.values(stock));
for (const [item, count] of Object.entries(stock)) {
  console.log(`${item}: ${count}`);
}
const doubled = Object.fromEntries(Object.entries(stock).map(([k, v]) => [k, v * 2]));
console.log(doubled);
```

`Object.entries` turns an object into `[key, value]` pairs, which you can map, filter and sort with the array methods from Lesson 10, then turn back into an object with `Object.fromEntries`. Keys come out in insertion order (except that integer-like keys such as `"1"` and `"2"` come first, in numeric order).

### References and copies

Objects, like arrays, are held by **reference**:

![Two diagrams. Left: const b = a. Both names point to one object, so changing b.qty changes what a sees. Right: a shallow copy made with spread gets its own top-level box, but its nested address property still points to the same inner object as the original; structuredClone copies the nested object too](figures/references.svg)

```js
const original = { qty: 1, address: { city: "Bristol" } };
const same = original;                       // same object
const shallow = { ...original };             // new outer object, SAME nested address
const deep = structuredClone(original);      // copies everything

same.qty = 2;
shallow.address.city = "Leeds";
console.log(original);                       // qty 2 and city Leeds: both changes show
console.log(deep.address.city);              // still Bristol
```

- Spread `{ ...obj }` and `Object.assign({}, obj)` make **shallow** copies: nested objects are shared.
- `structuredClone(obj)` makes a **deep** copy (it can't copy functions or class instances' methods, though).
- `===` on objects compares **identity**: two objects with identical contents aren't `===`. Comparing contents needs a deep-equality function (or comparing `JSON.stringify` output for simple data).

### Freezing

`Object.freeze(obj)` stops changes to an object's properties (in strict mode, attempts throw an error). It's shallow too: nested objects can still change unless you freeze them as well. `const` only stops reassigning the variable.

:::exercise Invert an object
Write `invert(obj)` returning a new object whose keys are the original values (as strings) and whose values are the original keys. If several keys share a value, the **last** one wins.
```js starter
function invert(obj) {
  // your code here
}

console.log(invert({ a: 1, b: 2, c: 1 }));   // { '1': 'c', '2': 'b' }
```
```js check
test("invert", [
  [[{ a: 1, b: 2, c: 1 }], { 1: "c", 2: "b" }, "a repeated value"],
  [[{ red: "#f00", green: "#0f0" }], { "#f00": "red", "#0f0": "green" }, "colour codes"],
  [[{}], {}, "empty"],
  [[{ x: true }], { true: "x" }, "a boolean value becomes the key 'true'"],
], { show: "invert({0})" });
const inv = need("invert", "function");
const input = { a: 1 };
inv(input);
same(input, { a: 1 }, "The input object after invert");
```
```js solution
function invert(obj) {
  return Object.fromEntries(Object.entries(obj).map(([key, value]) => [value, key]));
}

console.log(invert({ a: 1, b: 2, c: 1 }));
```
hint: `Object.entries(obj)` gives `[key, value]` pairs; you want `[value, key]` pairs instead.
hint: `Object.fromEntries(pairs)` builds an object from pairs. Later pairs with the same key overwrite earlier ones, which is exactly the "last one wins" rule.
hint: `return Object.fromEntries(Object.entries(obj).map(([k, v]) => [v, k]));`
approach:
1. **Understand:** swap keys and values; duplicates resolve to the last key.
2. **Examples:** a: 1 and c: 1 → key "1" ends up with "c".
3. **Brute force:** a `for…in` loop assigning `result[obj[key]] = key`: works just as well.
4. **Pattern:** **entries → transform → fromEntries**.
5. **Plan:** entries → swap each pair → build the object.
6. **Code and test:** duplicates, non-string values, empty object; input unchanged.
walkthrough:
**Line by line**

- `Object.entries` gives pairs in insertion order, so "last one wins" follows the original order.
- `([key, value]) => [value, key]` unpacks each pair and builds the swapped one.
- `Object.fromEntries` converts keys to strings automatically: `1` becomes `"1"`, `true` becomes `"true"`.

**Trace:** `{ a: 1, b: 2, c: 1 }` → `[[1, "a"], [2, "b"], [1, "c"]]` → `{ "1": "c", "2": "b" }`.

**Common wrong approach:** modifying `obj` while looping over it (adding swapped keys to the same object), which mixes old and new keys and can loop over keys you've just added.
:::

:::exercise Read a nested value safely
Write `getPath(obj, path, fallback)` that follows a dot-separated `path` such as `"customer.address.city"` through nested objects and returns the value found, or `fallback` if any step is missing (`null` or `undefined`). A value of `0`, `""` or `false` at the end is a real value, not missing. An empty path returns `obj` itself.
```js starter
function getPath(obj, path, fallback) {
  // your code here
}

const order = { customer: { name: "Ada", address: { city: "Bristol" } }, items: 0 };
console.log(getPath(order, "customer.address.city", "?"), getPath(order, "customer.phone", "none"), getPath(order, "items", 5));
// Bristol none 0
```
```js check
const o = { customer: { name: "Ada", address: { city: "Bristol", zip: null } }, items: 0, note: "", tags: ["a", "b"] };
test("getPath", [
  [[o, "customer.address.city", "?"], "Bristol", "three levels"],
  [[o, "customer.phone", "none"], "none", "a missing property"],
  [[o, "items", 5], 0, "0 is a real value"],
  [[o, "note", "x"], "", "an empty string is a real value"],
  [[o, "customer.address.zip", "no zip"], "no zip", "null counts as missing"],
  [[o, "customer.address.city.length", 0], 7, "a property of a string"],
  [[o, "nothing.at.all", "fallback"], "fallback", "missing early on"],
  [[o, "tags.1", "?"], "b", "an array index"],
  [[o, "", "?"], o, "an empty path"],
  [[null, "a", "fb"], "fb", "a null starting object"],
], { show: "getPath(order, {1}, {2})" });
```
```js solution
function getPath(obj, path, fallback) {
  if (path === "") return obj;
  let current = obj;
  for (const key of path.split(".")) {
    if (current === null || current === undefined) return fallback;
    current = current[key];
  }
  return current ?? fallback;
}

const order = { customer: { name: "Ada", address: { city: "Bristol" } }, items: 0 };
console.log(getPath(order, "customer.address.city", "?"), getPath(order, "customer.phone", "none"), getPath(order, "items", 5));
```
hint: Split the path on dots and walk down one key at a time, keeping the current value in a variable.
hint: Before each step, if the current value is `null` or `undefined`, stop and return the fallback.
hint: At the end, `return current ?? fallback;`: `??` keeps `0`, `""` and `false` but replaces `null` and `undefined`.
approach:
1. **Understand:** like `obj?.a?.b?.c ?? fallback`, but with the path as text.
2. **Examples:** `"customer.phone"` → customer exists, phone is undefined → fallback.
3. **Brute force:** separate code for each depth: impossible for arbitrary paths.
4. **Pattern:** **walk a path with a cursor variable**.
5. **Plan:** empty path → return obj; for each key: stop if nothing there, else step down; finally `??`.
6. **Code and test:** falsy real values, null in the middle, array indexes, strings, null start.
walkthrough:
**Line by line**

- `path.split(".")` turns `"tags.1"` into `["tags", "1"]`; brackets accept the string `"1"` as an array index.
- The null/undefined check before each step prevents `TypeError: Cannot read properties of undefined`.
- `current[key]` works on strings too: `"Bristol".length` is 7.
- `?? fallback` only replaces `null` or `undefined`, so 0 and "" survive.

**Trace:** `"customer.address.zip"` → customer → address → zip is null → `null ?? "no zip"` → "no zip".

**Common wrong approach:** `return current || fallback`, which replaces the real values 0, "" and false. Libraries such as Lodash provide this as `_.get`; optional chaining covers it when the path is fixed in the code.
:::

:::quiz
? When must you use brackets instead of a dot to read a property?
+ When the key is in a variable or isn't a valid name, like "frame size"
- When the value is a number
- Always, for nested objects
= obj[key] evaluates key; obj.key looks for a property literally called "key".
? const b = { ...a }; Then b.address.city = "Leeds". What happens to a.address.city?
+ It changes too, because spread makes a shallow copy
- Nothing; b is a full copy
- An error is thrown
= Use structuredClone for a deep copy.
? How do you test whether an object has a key "bells", even if its value is 0?
+ Object.hasOwn(obj, "bells") or "bells" in obj
- if (obj.bells)
- obj.bells !== 0
= Truthiness tests treat 0 as missing.
? What does Object.fromEntries([["a", 1], ["b", 2]]) return?
+ { a: 1, b: 2 }
- [["a", 1], ["b", 2]]
- a Map
= It's the reverse of Object.entries.
:::

@@@ lesson
id: destructuring-and-spread
title: Destructuring and spread
minutes: 24
summary: Unpacking arrays and objects into variables, skipping items, default values, renaming, nested destructuring, rest elements, swapping variables, destructuring function parameters (options objects), spread for copying and merging arrays and objects, and immutable updates to nested data.
---
**Destructuring** unpacks values from arrays and objects into variables in one line. **Spread** (`...`) does the opposite: it expands an array or object into a new one. Together they're everywhere in modern JavaScript.

### Array destructuring

```js
const point = [3, 7, 1];
const [x, y] = point;                   // by position
const [, second] = point;               // skip the first
const [first, ...rest] = point;         // the rest into a new array
const [a, b, c, d = 0] = point;         // a default if missing
console.log(x, y, second, first, rest, d);

let left = "L", right = "R";
[left, right] = [right, left];          // swap without a temporary variable
console.log(left, right);
```

### Object destructuring

Object destructuring is by **name**, not position:

```js
const order = { id: 7, customer: "Ada", total: 120, address: { city: "Bristol" } };
const { id, total } = order;
const { customer: buyer } = order;                    // rename: take customer, call it buyer
const { discount = 0 } = order;                       // a default when missing (or undefined)
const { address: { city } } = order;                  // nested
const { id: _, ...withoutId } = order;                // everything except id
console.log(id, total, buyer, discount, city, withoutId);
```

### Destructuring parameters

Functions with several options often take one object and destructure it in the parameter list, with defaults. Callers then name each option, in any order:

```js
function formatPrice(amount, { currency = "GBP", decimals = 2, locale = "en-GB" } = {}) {
  return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: decimals }).format(amount);
}
console.log(formatPrice(1234.5));
console.log(formatPrice(1234.5, { currency: "EUR", locale: "de-DE" }));
console.log(formatPrice(99, { decimals: 0 }));
```

The `= {}` at the end lets callers leave out the options object entirely. This **options object** pattern is far clearer than `formatPrice(1234.5, "EUR", 2, "de-DE")`, where nobody remembers which argument is which.

### Spread: copy and merge

```js
const base = ["frame", "wheels"];
const full = [...base, "saddle", ...["bell", "lights"]];
console.log(full);

const defaults = { theme: "light", fontSize: 14, sound: true };
const userPrefs = { fontSize: 18 };
const settings = { ...defaults, ...userPrefs };        // later spreads win
console.log(settings);
```

### Updating data without changing it

Spread lets you make an **updated copy** instead of changing the original, which is how React and many state libraries expect updates:

```js
const cart = {
  owner: "Ada",
  items: [
    { id: 1, name: "tube", qty: 2 },
    { id: 2, name: "bell", qty: 1 },
  ],
};
const updated = {
  ...cart,
  items: cart.items.map((item) => (item.id === 2 ? { ...item, qty: item.qty + 1 } : item)),
};
console.log(cart.items[1].qty, updated.items[1].qty);   // 1 2: the original is untouched
console.log(cart.items[0] === updated.items[0]);        // true: unchanged items are shared
```

Only the path to the change is copied; everything else is shared, which is cheap.

:::exercise Update a cart item
Write `updateItem(cart, id, changes)` returning a **new** cart in which the item with that `id` has the `changes` merged in. Other items and other cart properties stay the same, and the original cart must not change. If no item has that `id`, return a copy with the items unchanged.
```js starter
function updateItem(cart, id, changes) {
  // your code here
}

const cart = { owner: "Ada", items: [{ id: 1, name: "tube", qty: 2 }, { id: 2, name: "bell", qty: 1 }] };
const next = updateItem(cart, 2, { qty: 3, colour: "red" });
console.log(next.items[1], cart.items[1]);
// { id: 2, name: 'bell', qty: 3, colour: 'red' } { id: 2, name: 'bell', qty: 1 }
```
```js check
const base = () => ({ owner: "Ada", items: [{ id: 1, name: "tube", qty: 2 }, { id: 2, name: "bell", qty: 1 }] });
test("updateItem", [
  [[base(), 2, { qty: 3, colour: "red" }], { owner: "Ada", items: [{ id: 1, name: "tube", qty: 2 }, { id: 2, name: "bell", qty: 3, colour: "red" }] }, "update item 2"],
  [[base(), 1, { name: "inner tube" }], { owner: "Ada", items: [{ id: 1, name: "inner tube", qty: 2 }, { id: 2, name: "bell", qty: 1 }] }, "rename item 1"],
  [[base(), 9, { qty: 5 }], base(), "no such item"],
  [[{ owner: "Bo", items: [] }, 1, { qty: 1 }], { owner: "Bo", items: [] }, "an empty cart"],
], { show: "updateItem(cart, {1}, {2})" });
const u = need("updateItem", "function");
const c = base();
const n = u(c, 2, { qty: 9 });
same(c, base(), "The original cart after updateItem");
if (n === c || n.items === c.items) throw new AssertionError("Return a new cart with a new items array.");
if (n.items[0] !== c.items[0]) throw new AssertionError("Unchanged items can be shared: return them as they are (no need to copy them).");
```
```js solution
function updateItem(cart, id, changes) {
  return {
    ...cart,
    items: cart.items.map((item) => (item.id === id ? { ...item, ...changes } : item)),
  };
}

const cart = { owner: "Ada", items: [{ id: 1, name: "tube", qty: 2 }, { id: 2, name: "bell", qty: 1 }] };
const next = updateItem(cart, 2, { qty: 3, colour: "red" });
console.log(next.items[1], cart.items[1]);
```
hint: The result is `{ ...cart, items: newItems }`: a copy of the cart with a replaced `items` array.
hint: Build `newItems` with `map`: for the matching item return a merged copy, for the others return the item itself.
hint: The merged copy is `{ ...item, ...changes }` (later spreads win, so the changes overwrite).
approach:
1. **Understand:** copy only along the path to the change; share everything else.
2. **Examples:** updating item 2 creates a new cart object, a new items array and a new item 2.
3. **Brute force:** `structuredClone(cart)` then change the copy: correct, but copies everything.
4. **Pattern:** **immutable update with spread and map**.
5. **Plan:** spread the cart → map the items → spread the matching item with the changes.
6. **Code and test:** each item, a missing id, an empty cart; original untouched; other items shared.
walkthrough:
**Line by line**

- `{ ...cart, items: … }` copies `owner` (and any other properties) and replaces `items`.
- `map` always returns a new array, so the cart's array is never modified.
- `{ ...item, ...changes }` makes a new object with the old fields, then the changed ones on top; `colour` is added because it wasn't there before.
- Returning `item` unchanged for other ids shares those objects, which is safe because nothing modifies them.

**Trace:** id 2 → item 1 returned as is; item 2 → `{ id: 2, name: "bell", qty: 1, ...{ qty: 3, colour: "red" } }`.

**Common wrong approach:** `cart.items.find((i) => i.id === id).qty = 3`, which changes the caller's cart (and crashes when the id doesn't exist).
:::

:::exercise Describe a user
Write `describeUser(user)` using destructuring with defaults. A user looks like `{ name, age, address: { city } }`, but `age`, `address` and `city` may be missing. Return `"<name> (<age>) from <city>"`, using `"age unknown"` instead of `(<age>)` when age is missing, and `"somewhere"` when there's no city.
```js starter
function describeUser(user) {
  // your code here
}

console.log(describeUser({ name: "Ada", age: 36, address: { city: "London" } }));   // Ada (36) from London
console.log(describeUser({ name: "Bo" }));                                          // Bo (age unknown) from somewhere
```
```js check
test("describeUser", [
  [[{ name: "Ada", age: 36, address: { city: "London" } }], "Ada (36) from London", "everything given"],
  [[{ name: "Bo" }], "Bo (age unknown) from somewhere", "only a name"],
  [[{ name: "Cy", age: 0, address: {} }], "Cy (0) from somewhere", "age 0 is a real age; no city"],
  [[{ name: "Di", address: { city: "Leeds" } }], "Di (age unknown) from Leeds", "no age"],
], { show: "describeUser({0})" });
if (!/\{[^}]*\}\s*=|function\s+describeUser\s*\(\s*\{/.test(__source__)) {
  throw new AssertionError("Use destructuring to unpack the user, e.g. const { name, age, address: { city } = {} } = user;");
}
```
```js solution
function describeUser(user) {
  const { name, age = "age unknown", address: { city = "somewhere" } = {} } = user;
  return `${name} (${age}) from ${city}`;
}

console.log(describeUser({ name: "Ada", age: 36, address: { city: "London" } }));
console.log(describeUser({ name: "Bo" }));
```
hint: Defaults in destructuring look like `{ age = "age unknown" } = user`. They apply when the value is missing or `undefined` (so 0 stays 0).
hint: For the nested city, destructure `address` and give the whole address a default of `{}`, so a missing address doesn't crash.
hint: `const { name, age = "age unknown", address: { city = "somewhere" } = {} } = user;`
approach:
1. **Understand:** unpack with defaults at two levels.
2. **Examples:** `{ name: "Bo" }` → no age, no address → both defaults.
3. **Brute force:** `user.address && user.address.city ? … : …` chains: works, harder to read.
4. **Pattern:** **nested destructuring with defaults**.
5. **Plan:** one destructuring statement → template literal.
6. **Code and test:** all present, all missing, age 0, empty address.
walkthrough:
**Line by line**

- `age = "age unknown"` uses the default only when `user.age` is `undefined`, so an age of 0 is kept.
- `address: { city = "somewhere" } = {}` means: take `user.address` (or `{}` if missing) and unpack its `city` (or "somewhere").
- Without the `= {}`, destructuring a missing address would throw `TypeError: Cannot read properties of undefined`.

**Trace:** `{ name: "Cy", age: 0, address: {} }` → name Cy, age 0, address `{}` → city default → "Cy (0) from somewhere".

**Common wrong approach:** `const { address: { city } } = user;` with no default for `address`: it throws as soon as a user has no address.
:::

:::quiz
? What does const [first, ...rest] = [1, 2, 3] give?
+ first = 1, rest = [2, 3]
- first = [1], rest = 3
- first = 1, rest = 2
= ...rest collects the remaining items into an array.
? What does const { customer: buyer } = order do?
+ Creates a variable called buyer holding order.customer
- Creates a variable called customer
- Sets order.customer to buyer
= The name after the colon is the new variable.
? In { ...defaults, ...userPrefs }, which wins when both have fontSize?
+ userPrefs, because later spreads overwrite earlier ones
- defaults
- Neither; it throws
= Order matters: put the overrides last.
? Why write function f({ a = 1 } = {})?
+ So callers can omit the options object entirely
- To make a required
- It's required syntax for destructuring
= Without = {}, calling f() would try to destructure undefined.
:::

@@@ lesson
id: map-and-set
title: Map and Set
minutes: 22
summary: When to use a Map instead of a plain object (any key type, size, insertion order, safe keys), Map methods including getOrInsert, counting and grouping with a Map, Set for unique values, removing duplicates, the set operations union, intersection, difference and isSubsetOf, and WeakMap for data attached to objects.
---
Plain objects work as dictionaries, but JavaScript has two collections designed for the job: **Map** (key → value) and **Set** (unique values).

### Map

```js
const stock = new Map();
stock.set("tube", 12).set("bell", 0);        // set returns the map, so calls chain
stock.set("tube", stock.get("tube") - 1);
console.log(stock.get("tube"), stock.get("lock"), stock.has("bell"), stock.size);
stock.delete("bell");
for (const [item, count] of stock) console.log(item, count);
console.log(new Map([["a", 1], ["b", 2]]), Object.fromEntries(new Map([["a", 1]])));
```

Why a Map rather than an object?

| | Object | Map |
|---|---|---|
| key types | strings and symbols (numbers become strings) | **any** value: numbers, objects, functions |
| size | `Object.keys(obj).length` | `map.size` |
| order | insertion order, but integer-like keys first | always insertion order |
| accidental keys | inherits names like `constructor`, `toString` | none |
| JSON | `JSON.stringify` works directly | convert first (`Object.fromEntries`) |

Use objects for **records** with known fields (`{ name, price }`), and Maps for **dictionaries** whose keys come from data, especially when keys aren't strings or the collection grows and shrinks a lot.

```js
const visits = new Map();
const userA = { name: "Ada" }, userB = { name: "Bo" };
visits.set(userA, 3).set(userB, 1);            // objects as keys
console.log(visits.get(userA));
const plain = {};
plain[userA] = 3;                              // the key becomes the string "[object Object]"
console.log(Object.keys(plain));
```

### Counting and grouping

```js
const words = "the bell and the tube and the pump".split(" ");
const counts = new Map();
for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
console.log(counts);

const groups = new Map();
for (const w of words) groups.getOrInsert(w.length, []).push(w);   // ES2026
console.log(groups);
```

`map.getOrInsert(key, defaultValue)` returns the existing value, or stores and returns the default: perfect for "add to the list for this key". It's new in ECMAScript 2026 and works in the current versions of all major browsers (since early 2026); in older ones, write `if (!m.has(k)) m.set(k, []); m.get(k).push(w);`. `Map.groupBy(items, fn)` (ES2024) groups a whole array in one call.

### Set

A **Set** holds each value at most once:

```js
const tags = new Set(["mtb", "alloy", "mtb"]);
tags.add("disc").add("alloy");
console.log(tags, tags.size, tags.has("mtb"));
console.log([...new Set([3, 1, 3, 2, 1])]);         // remove duplicates, keep first-seen order
```

`has` on a Set is fast however big the set is, unlike `array.includes`, which checks every item. For "have I seen this before?" inside a loop, use a Set.

### Set operations

```js
const mine = new Set(["mtb", "alloy", "disc"]);
const theirs = new Set(["road", "alloy", "disc"]);
console.log(mine.union(theirs));
console.log(mine.intersection(theirs));
console.log(mine.difference(theirs));
console.log(mine.symmetricDifference(theirs));
console.log(new Set(["alloy"]).isSubsetOf(mine), mine.isDisjointFrom(new Set(["carbon"])));
```

These methods arrived in ECMAScript 2025 and work in all current browsers. They return new Sets and leave the originals unchanged.

### WeakMap and WeakSet

A **WeakMap** only accepts objects as keys and doesn't keep them alive: when nothing else refers to the key object, its entry can be cleaned up automatically. It's used to attach extra data to objects you don't own (for example, caching per DOM element) without leaking memory. You can't loop over a WeakMap or ask its size.

:::exercise Word frequencies
Write `wordFrequencies(text)` returning an array of `[word, count]` pairs for the words in `text`, most frequent first, ties in alphabetical order. Words are runs of letters (`text.toLowerCase().match(/[a-z']+/g)`; treat `null` as no words).
```js starter
function wordFrequencies(text) {
  // your code here
}

console.log(wordFrequencies("The bell, the tube and THE pump. And a bell!"));
// [ [ 'the', 3 ], [ 'and', 2 ], [ 'bell', 2 ], [ 'a', 1 ], [ 'pump', 1 ], [ 'tube', 1 ] ]
```
```js check
test("wordFrequencies", [
  [["The bell, the tube and THE pump. And a bell!"], [["the", 3], ["and", 2], ["bell", 2], ["a", 1], ["pump", 1], ["tube", 1]], "the example"],
  [[""], [], "empty text"],
  [["123 !!!"], [], "no words"],
  [["Don't stop, don't"], [["don't", 2], ["stop", 1]], "apostrophes"],
  [["b a c a b a"], [["a", 3], ["b", 2], ["c", 1]], "counts then letters"],
], { show: "wordFrequencies({0})" });
```
```js solution
function wordFrequencies(text) {
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  const counts = new Map();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts].toSorted(([wa, ca], [wb, cb]) => cb - ca || wa.localeCompare(wb));
}

console.log(wordFrequencies("The bell, the tube and THE pump. And a bell!"));
```
hint: `match` with the `g` flag returns an array of all matches, or `null` when there are none: use `?? []`.
hint: Count into a `Map` with `counts.set(w, (counts.get(w) ?? 0) + 1)`. Spreading a Map, `[...counts]`, gives `[key, value]` pairs.
hint: Sort the pairs with `(a, b) => b[1] - a[1] || a[0].localeCompare(b[0])`.
approach:
1. **Understand:** tokenise → count → sort by count desc, then word asc.
2. **Examples:** "the" ×3, "and" ×2 and "bell" ×2 (tie: "and" first).
3. **Brute force:** for each distinct word, count it with `filter`: O(n²).
4. **Pattern:** **count with a Map, then sort the entries**.
5. **Plan:** words → Map counts → entries → sort.
6. **Code and test:** empty, no words, apostrophes, ties.
walkthrough:
**Line by line**

- Lower-casing first makes "The" and "THE" the same word.
- `/[a-z']+/g` keeps apostrophes inside words like "don't" and drops punctuation and digits.
- The Map preserves the order words were first seen, but the sort decides the final order anyway.
- `cb - ca || wa.localeCompare(wb)`: bigger counts first; for equal counts, alphabetical.

**Trace:** "b a c a b a" → a: 3, b: 2, c: 1 → already in count order.

**Common wrong approach:** counting in a plain object and later looking up a word like `"constructor"`: `obj["constructor"]` exists on every object (it's inherited), so the count starts from a function instead of 0. A Map has no such inherited keys.
:::

:::exercise Compare two tag lists
Write `compareTags(a, b)` for two arrays of tags (which may contain duplicates) returning an object with three **sorted** arrays: `both` (tags in both lists), `onlyA` and `onlyB`. Use Sets.
```js starter
function compareTags(a, b) {
  // your code here
}

console.log(compareTags(["mtb", "disc", "alloy", "mtb"], ["road", "alloy", "disc"]));
// { both: [ 'alloy', 'disc' ], onlyA: [ 'mtb' ], onlyB: [ 'road' ] }
```
```js check
test("compareTags", [
  [[["mtb", "disc", "alloy", "mtb"], ["road", "alloy", "disc"]], { both: ["alloy", "disc"], onlyA: ["mtb"], onlyB: ["road"] }, "the example"],
  [[[], ["x"]], { both: [], onlyA: [], onlyB: ["x"] }, "one empty list"],
  [[["a", "b"], ["a", "b", "a"]], { both: ["a", "b"], onlyA: [], onlyB: [] }, "the same tags"],
  [[["z", "y"], ["x", "w"]], { both: [], onlyA: ["y", "z"], onlyB: ["w", "x"] }, "nothing in common"],
], { show: "compareTags({0}, {1})" });
if (!/new Set/.test(__source__)) throw new AssertionError("Use Sets (new Set(...)) for this exercise.");
```
```js solution
function compareTags(a, b) {
  const setA = new Set(a), setB = new Set(b);
  const sorted = (s) => [...s].toSorted();
  return {
    both: sorted(setA.intersection(setB)),
    onlyA: sorted(setA.difference(setB)),
    onlyB: sorted(setB.difference(setA)),
  };
}

console.log(compareTags(["mtb", "disc", "alloy", "mtb"], ["road", "alloy", "disc"]));
```
hint: Turn both arrays into Sets; duplicates disappear automatically.
hint: `setA.intersection(setB)` and `setA.difference(setB)` do the work; spread a Set into an array to sort it.
hint: If your browser lacks the newer Set methods, use filters: `[...setA].filter((t) => setB.has(t))` is the intersection.
approach:
1. **Understand:** three set relationships, each as a sorted array.
2. **Examples:** "mtb" appears twice in a but counts once.
3. **Brute force:** `a.filter((t) => b.includes(t))`: O(n·m) and keeps duplicates.
4. **Pattern:** **set algebra**.
5. **Plan:** two Sets → intersection and two differences → sort each.
6. **Code and test:** empty lists, identical lists, disjoint lists.
walkthrough:
**Line by line**

- `new Set(a)` removes duplicate tags.
- `intersection` keeps tags in both; `difference` keeps tags in the first set but not the second, so it's used twice, in each direction.
- `[...s].toSorted()` sorts strings alphabetically (the default string comparison is fine for lower-case tags).

**Trace:** A = {mtb, disc, alloy}, B = {road, alloy, disc} → both {disc, alloy} → sorted [alloy, disc]; onlyA [mtb]; onlyB [road].

**Common wrong approach:** comparing arrays with `includes` inside `filter`, which is slow for long lists and returns duplicates (["mtb", "mtb"]).
:::

:::quiz
? When is a Map better than a plain object?
+ When keys come from data, aren't strings, or the collection changes a lot
- When you need to send it as JSON directly
- When the object has fixed, known fields
= Use objects for records, Maps for dictionaries.
? What does [...new Set([2, 1, 2, 3, 1])] return?
+ [2, 1, 3]
- [1, 2, 3]
- [2, 1, 2, 3, 1]
= Duplicates are removed; first-seen order is kept.
? Why use a Set for "have I seen this?" checks in a loop?
+ set.has is fast regardless of size, while array.includes checks every item
- Sets sort their values
- Arrays can't hold strings
= O(1) on average versus O(n).
? What does map.getOrInsert(key, []) return?
+ The existing value for key, or the new [] after storing it
- Always a new empty array
- true or false
= It's new in ECMAScript 2026.
:::

@@@ lesson
id: json
title: JSON
minutes: 26
summary: What JSON is and why every API uses it, JSON's strict rules compared with JavaScript object syntax, JSON.parse and JSON.stringify, pretty-printing, what gets lost (undefined, functions, Dates, Map, NaN), replacers and revivers, handling invalid JSON with try/catch, very large numbers (JSON.rawJSON and source access in ES2026), and checking that parsed data has the shape you expect.
---
**JSON** (JavaScript Object Notation) is a text format for data. It started as a subset of JavaScript's object syntax and became the common language of the web: REST APIs, configuration files, logs, databases, and every LLM API (Part 8) send and receive JSON.

```json
{
  "id": 1042,
  "customer": "Ada Lovelace",
  "paid": true,
  "items": [{ "sku": "TUBE-29", "qty": 2, "price": 6.0 }],
  "coupon": null
}
```

### JSON's rules

JSON looks like a JavaScript object, but it's stricter:

| JSON | Allowed? |
|---|---|
| keys in **double** quotes: `"id"` | required |
| strings in double quotes | required (no single quotes or backticks) |
| numbers, `true`, `false`, `null`, arrays, objects | yes |
| `undefined`, functions, dates, `NaN`, `Infinity` | **no** |
| trailing commas `[1, 2,]` | **no** |
| comments | **no** |

### parse and stringify

```js
const text = '{"id": 7, "customer": "Ada", "items": [{"sku": "TUBE", "qty": 2}]}';
const order = JSON.parse(text);              // text → JavaScript value
console.log(order.items[0].qty, typeof order);

const back = JSON.stringify(order);          // value → compact text
console.log(back);
console.log(JSON.stringify({ a: 1, b: [1, 2] }, null, 2));   // pretty-printed, 2-space indent
```

### What doesn't survive a round trip

```js
const data = {
  when: new Date(Date.UTC(2026, 9, 8)),
  missing: undefined,
  fn() {},
  tags: new Set(["a"]),
  ratio: NaN,
  list: [undefined, () => 1],
};
const json = JSON.stringify(data);
console.log(json);
const parsed = JSON.parse(json);
console.log(typeof parsed.when);             // the Date came back as a string
```

- `undefined` and functions **disappear** from objects (and become `null` in arrays).
- Dates become ISO strings and come back as **strings**, not Dates.
- `Map` and `Set` become `{}`: convert them first (`Object.fromEntries(map)`, `[...set]`).
- `NaN` and `Infinity` become `null`.
- `JSON.stringify` throws a `TypeError` on BigInt values and on objects that contain themselves.

### Replacers and revivers

A **replacer** customises stringify; a **reviver** customises parse. Both are called for every key and value:

```js
const text = '{"name": "Ada", "joined": "2026-10-08T00:00:00.000Z", "password": "hunter2"}';
const user = JSON.parse(text, (key, value) =>
  key === "joined" ? new Date(value) : value);           // bring the date back to life
console.log(user.joined instanceof Date, user.joined.getUTCFullYear());

const safe = JSON.stringify(user, (key, value) => (key === "password" ? undefined : value));
console.log(safe);                                        // returning undefined drops the key
console.log(JSON.stringify(user, ["name"]));              // an array replacer keeps only these keys
```

### Invalid JSON

`JSON.parse` throws a `SyntaxError` on bad input, and real-world JSON is often bad: truncated network responses, single quotes, trailing commas, or a model reply wrapped in extra text. Always parse untrusted text inside `try`/`catch` (Part 3 covers errors in detail):

```js
for (const text of ['{"ok": true}', "{'ok': true}", '{"ok": true,}', ""]) {
  try {
    console.log("parsed:", JSON.parse(text));
  } catch (e) {
    console.log(`not JSON (${e.name}):`, JSON.stringify(text));
  }
}
```

### Very large numbers

JSON numbers have no size limit, but `JSON.parse` turns them into JavaScript numbers, which are exact only up to 2⁵³ − 1 (Lesson 4). IDs from databases such as Twitter's (X's) can be bigger, and silently change:

```js
const text = '{"id": 12345678901234567890}';
console.log(JSON.parse(text).id);                         // rounded!
const exact = JSON.parse(text, (key, value, context) =>
  key === "id" ? BigInt(context.source) : value);         // ES2026: the reviver can see the original text
console.log(exact.id);
console.log(JSON.stringify({ id: JSON.rawJSON(exact.id.toString()) }));   // ES2026: write raw JSON
```

ECMAScript 2026 standardised the reviver's `context.source` and `JSON.rawJSON` for exactly this; all major browsers have supported them since early 2025, but older devices may not. Many APIs still send big IDs as **strings** (`"id": "12345678901234567890"`), which is the safest option.

### Check the shape of parsed data

`JSON.parse` tells you the text is valid JSON, not that it contains what you expect. Data from outside your program (APIs, files, users, LLMs) should be checked before use: is `items` really an array, is `qty` a number? The second exercise writes a small checker; in TypeScript projects, libraries such as **Zod** do this and give you types at the same time (Part 6).

:::exercise Parse without crashing
Write `safeParse(text)` returning `{ ok: true, value }` when `text` is valid JSON, and `{ ok: false, error }` otherwise, where `error` is the error's message (a string). It must never throw, even when `text` isn't a string (then `ok` is `false` and `error` is `"not a string"`).
```js starter
function safeParse(text) {
  // your code here
}

console.log(safeParse('{"a": [1, 2]}'));
console.log(safeParse("{'a': 1}").ok);
// { ok: true, value: { a: [ 1, 2 ] } }
// false
```
```js check
const sp = need("safeParse", "function");
same(sp('{"a": [1, 2]}'), { ok: true, value: { a: [1, 2] } }, 'safeParse(\'{"a": [1, 2]}\')');
same(sp("null"), { ok: true, value: null }, 'safeParse("null")');
same(sp("42"), { ok: true, value: 42 }, 'safeParse("42")');
same(sp('"hi"'), { ok: true, value: "hi" }, "a JSON string");
for (const bad of ["{'a': 1}", '{"a": 1,}', "", "undefined", "{", "[1, 2"]) {
  const r = sp(bad);
  if (!r || r.ok !== false || typeof r.error !== "string" || !r.error) {
    throw new AssertionError(`safeParse(${JSON.stringify(bad)}) should return { ok: false, error: "<message>" }, but returned ${inspect(r)}.`);
  }
}
for (const notText of [undefined, 42, { a: 1 }]) {
  same(sp(notText), { ok: false, error: "not a string" }, `safeParse(${inspect(notText)})`);
}
```
```js solution
function safeParse(text) {
  if (typeof text !== "string") return { ok: false, error: "not a string" };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

console.log(safeParse('{"a": [1, 2]}'));
console.log(safeParse("{'a': 1}").ok);
```
hint: `JSON.parse` throws on invalid input. Put it inside `try { … } catch (e) { … }` and return the right object from each branch.
hint: Check the type first: `JSON.parse(42)` doesn't throw (it converts 42 to "42"), so the "not a string" case needs its own test.
hint: `if (typeof text !== "string") return { ok: false, error: "not a string" };` then `try { return { ok: true, value: JSON.parse(text) }; } catch (e) { return { ok: false, error: e.message }; }`.
approach:
1. **Understand:** turn exceptions into return values; distinguish "not text" from "bad JSON".
2. **Examples:** `"null"` is valid JSON (value null); `""` isn't.
3. **Brute force:** checking the text with a regular expression first: impossible to get right; let the parser decide.
4. **Pattern:** **result object instead of exceptions** (a "Result" type).
5. **Plan:** type guard → try parse → catch.
6. **Code and test:** valid values of every JSON type, several invalid texts, non-strings.
walkthrough:
**Line by line**

- The `typeof` guard matters: `JSON.parse(42)` returns 42 and `JSON.parse(undefined)` throws an odd message, so non-strings get their own clear answer.
- `try` / `catch` turns the `SyntaxError` into data the caller can check without its own `try`.
- `e.message` is a human-readable description such as `Unexpected token ''', "{'a': 1}" is not valid JSON`.

**Trace:** `safeParse('{"a": 1,}')` → a string → `JSON.parse` throws (trailing comma) → `{ ok: false, error: "Expected double-quoted property name…" }`.

**Common wrong approach:** returning `null` for invalid JSON: `"null"` is valid JSON whose value is `null`, so the caller can't tell success from failure. A result object with `ok` removes the ambiguity.
:::

:::exercise Check an order's shape
Data from an API should be checked before use. Write `validateOrder(data)` returning a list of problems (empty if fine), in this order:

1. If `data` isn't a plain object (not `null`, not an array): return `["not an object"]` and stop.
2. `"id must be a positive integer"` unless `data.id` is an integer above 0.
3. `"customer must be a non-empty string"` unless it's a string with at least one non-space character.
4. `"items must be a non-empty array"` unless `data.items` is an array with at least one item; otherwise, for each item at index `i` (in order) whose `qty` isn't an integer ≥ 1: `"items[i].qty must be a positive integer"`.
```js starter
function validateOrder(data) {
  // your code here
}

console.log(validateOrder(JSON.parse('{"id": 7, "customer": "Ada", "items": [{"qty": 2}]}')));   // []
console.log(validateOrder({ id: "7", customer: " ", items: [{ qty: 0 }, { qty: 1 }, {}] }));
```
```js check
test("validateOrder", [
  [[{ id: 7, customer: "Ada", items: [{ qty: 2 }] }], [], "a valid order"],
  [[{ id: "7", customer: " ", items: [{ qty: 0 }, { qty: 1 }, {}] }],
   ["id must be a positive integer", "customer must be a non-empty string", "items[0].qty must be a positive integer", "items[2].qty must be a positive integer"], "several problems"],
  [[null], ["not an object"], "null"],
  [[[1, 2]], ["not an object"], "an array"],
  [["{}"], ["not an object"], "a string"],
  [[{}], ["id must be a positive integer", "customer must be a non-empty string", "items must be a non-empty array"], "an empty object"],
  [[{ id: 1.5, customer: "Bo", items: [] }], ["id must be a positive integer", "items must be a non-empty array"], "a decimal id and no items"],
  [[{ id: 3, customer: "Cy", items: [{ qty: 2.5 }, { qty: "2" }] }], ["items[0].qty must be a positive integer", "items[1].qty must be a positive integer"], "quantities of the wrong kind"],
  [[{ id: 3, customer: "Cy", items: "lots" }], ["items must be a non-empty array"], "items isn't an array"],
], { show: "validateOrder({0})" });
```
```js solution
function validateOrder(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return ["not an object"];
  const problems = [];
  const isPositiveInt = (n) => Number.isInteger(n) && n > 0;
  if (!isPositiveInt(data.id)) problems.push("id must be a positive integer");
  if (typeof data.customer !== "string" || data.customer.trim() === "") {
    problems.push("customer must be a non-empty string");
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    problems.push("items must be a non-empty array");
  } else {
    data.items.forEach((item, i) => {
      if (!isPositiveInt(item?.qty)) problems.push(`items[${i}].qty must be a positive integer`);
    });
  }
  return problems;
}

console.log(validateOrder(JSON.parse('{"id": 7, "customer": "Ada", "items": [{"qty": 2}]}')));
console.log(validateOrder({ id: "7", customer: " ", items: [{ qty: 0 }, { qty: 1 }, {}] }));
```
hint: `typeof null` is `"object"` and arrays are objects too, so the first check needs three conditions.
hint: `Number.isInteger(x) && x > 0` rejects strings like `"7"`, decimals and zero. A small helper function keeps it readable.
hint: Only check the items one by one when `items` is a non-empty array; `forEach((item, i) => …)` gives you the index for the message.
approach:
1. **Understand:** collect every problem in a fixed order; bail out early only for "not an object".
2. **Examples:** `"7"` is a string, not an integer: JSON from some APIs sends numbers as text.
3. **Brute force:** `typeof` checks inline everywhere: works, but repetitive.
4. **Pattern:** **schema validation** by hand (libraries such as Zod do this declaratively).
5. **Plan:** object guard → id → customer → items (array check, then each item).
6. **Code and test:** null, arrays, strings, empty objects, wrong types at each level.
walkthrough:
**Line by line**

- The first guard handles the three things `typeof` reports as `"object"` but aren't usable records: `null` and arrays (and catches strings, numbers and booleans too).
- `Number.isInteger("7")` is `false`: no type conversion, which is exactly what a validator wants.
- `data.customer.trim() === ""` rejects names that are only spaces.
- `item?.qty` survives items that are `null` instead of objects.

**Trace:** the "several problems" case → id "7" fails; customer " " fails; items is a 3-item array → qty 0 fails (index 0), qty 1 passes, missing qty fails (index 2).

**Common wrong approach:** trusting the data because `JSON.parse` succeeded. Valid JSON can still have the wrong shape, and the error then appears far away (`Cannot read properties of undefined`) instead of at the boundary where the data arrived.
:::

:::quiz
? Which of these is valid JSON?
+ {"name": "Ada", "tags": []}
- {name: "Ada"}
- {'name': 'Ada'}
- {"name": "Ada",}
= JSON needs double-quoted keys and strings, and no trailing commas.
? What happens to a Date in JSON.stringify and then JSON.parse?
+ It becomes an ISO string and comes back as a string
- It comes back as a Date
- It's removed
= Use a reviver to turn it back into a Date.
? What does JSON.stringify({ a: undefined, b: 1 }) produce?
+ {"b":1}
- {"a":undefined,"b":1}
- {"a":null,"b":1}
= undefined values are dropped from objects.
? JSON.parse succeeded. Is the data safe to use?
+ Not necessarily: it's valid JSON, but its shape still needs checking
- Yes, parse validates the structure
- Only if it contains no strings
= Validate data at the boundary where it enters your program.
:::

@@@ lesson
id: dates-and-time
title: Dates and times
minutes: 26
summary: Timestamps and the Date object, its pitfalls (zero-based months, mutation, local versus UTC, unreliable parsing), ISO 8601 strings, formatting with Intl.DateTimeFormat and toLocaleString, the new Temporal API (PlainDate, PlainTime, ZonedDateTime, Instant, Duration), date arithmetic and time zones done right, and browser support.
---
Dates are one of the hardest parts of programming: months of different lengths, leap years, time zones, daylight-saving changes, and formats that differ by country. JavaScript has two tools: the old **Date** object and the new **Temporal** API.

### Timestamps and Date

A `Date` stores one moment in time as a **timestamp**: milliseconds since 1 January 1970 UTC (the "Unix epoch").

```js
const moment = new Date(Date.UTC(2026, 9, 8, 14, 30));    // 8 October 2026, 14:30 UTC
console.log(moment.getTime());                               // the timestamp in milliseconds
console.log(moment.toISOString());                           // the standard text form, always UTC
console.log(moment.getUTCFullYear(), moment.getUTCMonth(), moment.getUTCDate(), moment.getUTCDay());
console.log(Date.now() > moment.getTime() ? "in the past" : "in the future");
```

`Date` has notorious traps:

- **Months start at 0**: `9` means October. Days of the month start at 1. `getDay()` is the weekday (0 = Sunday).
- **Dates are mutable**: `setMonth` changes the object in place, so a Date shared between two parts of your code can change under one of them.
- **Local versus UTC**: `getMonth()`, `getHours()` and friends use the **computer's time zone**; `getUTCMonth()` and friends use UTC. The same code can print different dates on different machines.
- **Parsing is unreliable** for anything except ISO 8601: `new Date("2026-10-08")` is read as UTC midnight, but `new Date("2026-10-08T00:00")` as local midnight, and formats like `"10/08/2026"` depend on the browser.
- **Overflow rolls over silently**:

```js
const d = new Date(2026, 0, 31);       // 31 January 2026 (local time)
d.setMonth(1);                         // "31 February" → rolls over into March
console.log(d.toDateString());
```

### ISO 8601: the one format to use

`2026-10-08T14:30:00Z` (date, `T`, time, `Z` for UTC, or an offset like `+01:00`) is **ISO 8601**. Use it in JSON, APIs, databases and file names: it's unambiguous, and sorts correctly as text.

### Formatting for people

```js
const moment = new Date(Date.UTC(2026, 9, 8, 14, 30));
const opts = { dateStyle: "full", timeStyle: "short", timeZone: "Europe/London" };
console.log(new Intl.DateTimeFormat("en-GB", opts).format(moment));
console.log(new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "America/New_York" }).format(moment));
console.log(moment.toLocaleDateString("de-DE", { timeZone: "UTC" }));
console.log(new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-1, "day"));
```

`Intl` formats dates, numbers, lists and relative times ("yesterday", "in 3 hours") for any language and region, with no library needed. Always pass `timeZone` when the output must be the same for every user.

### Temporal: dates done right

**Temporal** is the modern replacement for `Date`, designed after years of lessons from libraries such as Moment.js. It reached the final stage of standardisation (Stage 4) in March 2026. Its objects are **immutable**, months start at **1**, and it has separate types for separate ideas:

| Type | Represents | Example |
|---|---|---|
| `Temporal.PlainDate` | a calendar date, no time or zone | a birthday: `2026-10-08` |
| `Temporal.PlainTime` | a wall-clock time | opening time: `09:30` |
| `Temporal.PlainDateTime` | date and time, no zone | a local appointment |
| `Temporal.ZonedDateTime` | date, time and time zone | a meeting in London |
| `Temporal.Instant` | an exact moment (like a timestamp) | when an order was placed |
| `Temporal.Duration` | a length of time | 2 hours 30 minutes |

```js
const start = Temporal.PlainDate.from("2026-01-31");
console.log(start.add({ months: 1 }).toString());       // 2026-02-28: clamped to the end of February
console.log(start.month, start.dayOfWeek, start.daysInMonth);   // month 1 = January; 6 = Saturday

const today = Temporal.PlainDate.from("2026-10-08");
const xmas = Temporal.PlainDate.from("2026-12-25");
console.log(today.until(xmas).days, "days to go");
console.log(Temporal.PlainDate.compare(today, xmas));   // -1: today comes first

const meeting = Temporal.ZonedDateTime.from("2026-10-08T15:00[Europe/London]");
console.log(meeting.withTimeZone("America/New_York").toString());
const clocksChange = Temporal.ZonedDateTime.from("2026-03-29T00:30[Europe/London]");
console.log(clocksChange.add({ hours: 2 }).toString());   // 03:30 BST: daylight saving handled
console.log(Temporal.Duration.from({ hours: 1, minutes: 90 }).round({ largestUnit: "hours" }).toString());
```

**Browser support (autumn 2026):** Temporal works in Chrome and Edge (version 144 and later), Firefox (139 and later) and Node.js 26. Safari support is still in progress, so these examples fail there; check [caniuse.com](https://caniuse.com/temporal) before relying on it in a public site, or use the `@js-temporal/polyfill` package. The exercises in this lesson use `Date` with UTC, which works everywhere.

### Rules of thumb

- **Store and send** moments as ISO 8601 UTC strings (or timestamps).
- **Show** them in the user's time zone with `Intl.DateTimeFormat`, at the last moment.
- **Calendar dates** (birthdays, due dates) are dates without a time or zone: don't store them as midnight UTC, or they shift a day for users west of UTC. `Temporal.PlainDate` models this exactly.
- **Never do date arithmetic by adding 86,400,000 milliseconds** for "one day" in local time: days around clock changes are 23 or 25 hours long.

:::exercise Days between two dates
Write `daysBetween(a, b)` for two dates written as `"YYYY-MM-DD"`, returning the number of days from `a` to `b` (negative if `b` is earlier). Work in UTC so the answer is the same in every time zone. Throw a `RangeError` if either string isn't in that exact format or isn't a real date (such as `"2026-02-30"`).
```js starter
function daysBetween(a, b) {
  // your code here
}

console.log(daysBetween("2026-10-08", "2026-12-25"), daysBetween("2026-03-01", "2026-02-01"));
// 78 -28
```
```js check
test("daysBetween", [
  [["2026-10-08", "2026-12-25"], 78, "to Christmas"],
  [["2026-03-01", "2026-02-01"], -28, "backwards across February"],
  [["2024-02-28", "2024-03-01"], 2, "a leap year"],
  [["2026-03-28", "2026-03-30"], 2, "across the UK clock change"],
  [["2026-01-01", "2026-01-01"], 0, "the same day"],
  [["1999-12-31", "2000-01-01"], 1, "across a year"],
], { show: "daysBetween({0}, {1})" });
const db = need("daysBetween", "function");
for (const bad of ["2026-02-30", "2026-13-01", "08/10/2026", "2026-1-5", "", "2025-02-29"]) {
  let threw = null;
  try { db(bad, "2026-01-01"); } catch (e) { threw = e; }
  if (!(threw instanceof RangeError)) throw new AssertionError(`daysBetween(${JSON.stringify(bad)}, "2026-01-01") should throw a RangeError.`);
}
```
```js solution
function toUtcDay(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) throw new RangeError(`not a YYYY-MM-DD date: ${text}`);
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(year, month - 1, day);              // months start at 0 in Date
  const check = new Date(ms);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new RangeError(`no such date: ${text}`);           // e.g. 2026-02-30 rolled over
  }
  return ms / 86_400_000;                                    // whole days since 1970 (UTC has no clock changes)
}

function daysBetween(a, b) {
  return toUtcDay(b) - toUtcDay(a);
}

console.log(daysBetween("2026-10-08", "2026-12-25"), daysBetween("2026-03-01", "2026-02-01"));
```
hint: Read the year, month and day with a regular expression like `/^(\d{4})-(\d{2})-(\d{2})$/`, then build the moment with `Date.UTC(year, month - 1, day)` (Date's months start at 0).
hint: An impossible date such as 30 February rolls over silently. Build a Date from your timestamp and check that its UTC year, month and day are the ones you asked for.
hint: In UTC every day is exactly 86,400,000 ms, so `(msB - msA) / 86_400_000` is a whole number of days.
approach:
1. **Understand:** count calendar days without time zones getting involved; reject bad input loudly.
2. **Examples:** 2026-02-30 would roll over to 2 March, so it must be caught.
3. **Brute force:** `new Date(a)` and subtract: works for valid ISO dates, but accepts invalid ones and other formats.
4. **Pattern:** **parse strictly, compute in UTC, verify by round trip**.
5. **Plan:** helper: regex → Date.UTC → round-trip check → days; difference of two helpers.
6. **Code and test:** leap years, clock-change weekends, same day, invalid dates and formats.
walkthrough:
**Line by line**

- The regular expression accepts exactly `YYYY-MM-DD` with two-digit months and days, rejecting `2026-1-5` and `08/10/2026`.
- `Date.UTC` returns a timestamp in UTC, so the computer's time zone never matters.
- The round-trip check catches impossible dates: `Date.UTC(2026, 1, 30)` is 2 March, whose month differs from the one requested.
- Dividing by 86,400,000 is safe in UTC, where every day has exactly 24 hours; in local time, a clock-change day doesn't.

**Trace:** 2026-03-28 → 2026-03-30 in UTC: exactly 2 × 86,400,000 ms → 2, even though UK clocks change on the 29th.

**Common wrong approach:** `new Date("2026-03-30") - new Date("2026-03-28")` mixed with local-time dates such as `new Date(2026, 2, 30)`: around clock changes the difference is 47 or 49 hours, and rounding errors creep in. With Temporal, `PlainDate.from(a).until(PlainDate.from(b)).days` does it all safely.
:::

:::exercise Format a duration
Write `formatDuration(totalMinutes)` returning a short, readable duration: `"2h 05m"` for 125, `"45m"` for 45 (no hours part when it's zero), `"1d 3h 00m"` for 1620 (days appear only when there's at least one), and `"0m"` for 0. Minutes are always two digits after an `h` part. Throw a `RangeError` for negative or non-integer input.
```js starter
function formatDuration(totalMinutes) {
  // your code here
}

console.log(formatDuration(125), formatDuration(45), formatDuration(1620), formatDuration(0));
// 2h 05m 45m 1d 3h 00m 0m
```
```js check
test("formatDuration", [
  [[125], "2h 05m", "hours and minutes"],
  [[45], "45m", "minutes only"],
  [[1620], "1d 3h 00m", "a day and a bit"],
  [[0], "0m", "zero"],
  [[60], "1h 00m", "exactly an hour"],
  [[1440], "1d 0h 00m", "exactly a day"],
  [[5], "5m", "single-digit minutes alone"],
  [[3 * 1440 + 59], "3d 0h 59m", "days and minutes"],
], { show: "formatDuration({0})" });
const fd = need("formatDuration", "function");
for (const bad of [-1, 1.5, NaN]) {
  let threw = null;
  try { fd(bad); } catch (e) { threw = e; }
  if (!(threw instanceof RangeError)) throw new AssertionError(`formatDuration(${bad}) should throw a RangeError.`);
}
```
```js solution
function formatDuration(totalMinutes) {
  if (!Number.isInteger(totalMinutes) || totalMinutes < 0) {
    throw new RangeError(`expected a whole number of minutes, not ${totalMinutes}`);
  }
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m`;
}

console.log(formatDuration(125), formatDuration(45), formatDuration(1620), formatDuration(0));
```
hint: A day has 1,440 minutes and an hour 60. Use `Math.floor` for the bigger units and `%` for what's left.
hint: Pick the format by the largest non-zero unit: days, then hours, then minutes alone.
hint: `String(minutes).padStart(2, "0")` makes `5` into `"05"`.
approach:
1. **Understand:** split minutes into d / h / m, then format by the largest unit present.
2. **Examples:** 1620 = 1 × 1440 + 180 → 1 day, 3 hours, 0 minutes → "1d 3h 00m".
3. **Brute force:** subtract 1440 in a loop to count days: works, but slow and clumsy.
4. **Pattern:** **unit conversion with floor and remainder** (as in Lesson 4's pence).
5. **Plan:** validate → days, hours, minutes → three output shapes.
6. **Code and test:** zero, exact hours and days, minutes only, invalid input.
walkthrough:
**Line by line**

- `Math.floor(total / 1440)` counts whole days; `total % 1440` is what remains.
- `Math.floor(remaining / 60)` counts whole hours; `total % 60` gives the minutes (the same as `remaining % 60`).
- Returning early from the most specific case first keeps the formatting rules simple.
- `padStart` gives two-digit minutes whenever an hour part is shown.

**Trace:** 125 → days 0, hours 2, minutes 5 → "2h 05m".

**Common wrong approach:** `new Date(minutes * 60000).toISOString().slice(11, 16)`, which wraps after 24 hours (1620 minutes shows "03:00"). With Temporal, `Temporal.Duration.from({ minutes }).round({ largestUnit: "days" })` does the splitting.
:::

:::quiz
? What does new Date(2026, 9, 8) represent?
+ 8 October 2026, because months start at 0
- 9 August 2026
- 8 September 2026
= Months in Date are 0–11; Temporal uses 1–12.
? What format should dates use in JSON and APIs?
+ ISO 8601, such as 2026-10-08T14:30:00Z
- 10/08/2026
- Thursday 8 October
= It's unambiguous and sorts correctly as text.
? Why not add 86,400,000 ms for "tomorrow" in local time?
+ Days around daylight-saving changes are 23 or 25 hours long
- JavaScript doesn't allow adding numbers to timestamps
- A day is 86,400 ms
= Use calendar arithmetic (Temporal) or UTC.
? Which Temporal type fits a birthday?
+ Temporal.PlainDate
- Temporal.Instant
- Temporal.ZonedDateTime
= A calendar date has no time or time zone.
:::
