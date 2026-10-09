# Lesson 10: Array methods: map, filter, reduce and friends

**You'll learn:** callbacks on arrays, map, filter, find, findIndex and findLast, some and every, reduce and accumulators, sorting with a comparator, why the default sort compares text, localeCompare, stable sorting and tie-breakers, forEach, flat and flatMap, Object.groupBy and Map.groupBy, chaining methods into pipelines.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#array-methods)**: run every example and check your exercise answers.

## Key terms

- **`map`:** makes a new array by transforming every item.
- **`filter`:** makes a new array of the items that pass a test.
- **`reduce`:** combines all items into one value using an accumulator.
- **`find`:** returns the first item that passes a test, or `undefined`.
- **Comparator:** a function `(a, b) => number` telling a sort which item comes first.
- **Stable sort:** a sort that keeps equal items in their original order.
- **`localeCompare`:** compares strings in the order people expect for a language.
- **Pipeline:** a chain of methods, each feeding its result to the next.

Most array work is "do something with each item". Instead of writing a loop every time, arrays have **methods that take a callback** (a function, Lesson 7) and call it for each item.

```js
const orders = [
  { id: 1, customer: "Ada", total: 120, paid: true },
  { id: 2, customer: "Bo", total: 35, paid: false },
  { id: 3, customer: "Cy", total: 64, paid: true },
  { id: 4, customer: "Ada", total: 18, paid: true },
];
```

The examples below all use this `orders` array; each example repeats it so you can run it on its own.

## map: transform every item

`map` returns a **new array** of the same length, made of whatever the callback returns:

```js
const orders = [{ id: 1, total: 120 }, { id: 2, total: 35 }, { id: 3, total: 64 }];
const totals = orders.map((o) => o.total);
const withVat = orders.map((o) => ({ ...o, total: o.total * 1.2 }));   // a new object for each
console.log(totals);
console.log(withVat[0], orders[0]);    // the originals are unchanged
```

To return an object from a short arrow function, wrap it in brackets: `(o) => ({ … })`. Without them, the braces would be read as the function body.

## filter: keep some items

`filter` keeps the items for which the callback returns something truthy:

```js
const orders = [{ id: 1, total: 120, paid: true }, { id: 2, total: 35, paid: false }, { id: 3, total: 64, paid: true }];
const unpaid = orders.filter((o) => !o.paid);
const big = orders.filter((o) => o.total >= 50).map((o) => o.id);    // methods chain
console.log(unpaid, big);
```

## find, findIndex, findLast, some, every

```js
const orders = [{ id: 1, customer: "Ada", total: 120 }, { id: 2, customer: "Bo", total: 35 }, { id: 4, customer: "Ada", total: 18 }];
console.log(orders.find((o) => o.customer === "Ada"));          // the first match, or undefined
console.log(orders.findLast((o) => o.customer === "Ada").id);   // the last match
console.log(orders.findIndex((o) => o.total > 1000));            // -1: none
console.log(orders.some((o) => o.total > 100), orders.every((o) => o.total > 10));
```

`find` stops at the first match; `some` stops at the first `true`; `every` stops at the first `false`.

## reduce: combine everything into one value

`reduce` walks the array carrying an **accumulator**, like the loops in Lesson 6:

![reduce on the totals [120, 35, 64] with a starting value of 0. Step 1: accumulator 0 plus 120 gives 120. Step 2: 120 plus 35 gives 155. Step 3: 155 plus 64 gives 219, the final result](../figures/reduce.svg)

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

## Sorting: always pass a comparator for numbers

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

## Grouping, flattening and forEach

```js
const orders = [{ customer: "Ada", total: 120 }, { customer: "Bo", total: 35 }, { customer: "Ada", total: 18 }];
const byCustomer = Object.groupBy(orders, (o) => o.customer);      // ES2024
console.log(byCustomer);
console.log([["a", "b"], ["c"]].flat(), ["a b", "c d e"].flatMap((s) => s.split(" ")));
orders.forEach((o, i) => console.log(i, o.customer));            // for side effects only; returns undefined
```

`forEach` is for side effects (like printing). If you're building a new array, use `map` or `filter`; if you need `break`, use a `for…of` loop.

## Chaining

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

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Transform each | arr.map(fn) | O(n) | O(n) |
| Keep matching | arr.filter(fn) | O(n) | O(n) |
| Combine all | arr.reduce(fn, start) | O(n) | O(1) plus the result |
| Sort | toSorted((a, b) => …) | O(n log n) | O(n) |
| Top n by count | count in an object or Map; sort entries; slice | O(n + k log k) | O(k) |

## Common mistakes

- Sorting numbers without a comparator.
- Forgetting the starting value of `reduce`.
- Using `map` for side effects, or `forEach` to build a new array.
- Returning an object from an arrow function without brackets.
- Sorting the original array with `sort` when a copy was wanted.

## Exercises

### 1. Summarise orders

Write `summarise(orders)` taking an array of orders `{ customer, total, paid }` and returning an object with:

- `count`: the number of **paid** orders,
- `revenue`: the sum of their totals,
- `customers`: the **distinct** customers with paid orders, sorted alphabetically.

Starter code:

```js
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

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** three facts about the paid subset; don't modify the input.
2. **Examples:** Ada appears twice but is listed once.
3. **Brute force:** one loop with three accumulators and an `includes` check for names: works, longer.
4. **Pattern:** **filter → map / reduce** pipeline.
5. **Plan:** paid = filter → revenue = reduce → customers = map → Set → array → sort.
6. **Code and test:** empty input, nothing paid, decimals, lower-case names; check the input is unchanged.

</details>

<details>
<summary>💡 Hint 1</summary>

Start by filtering to the paid orders; all three results come from that list.

</details>

<details>
<summary>💡 Hint 2</summary>

`reduce((sum, o) => sum + o.total, 0)` adds up the totals. For distinct customers, `new Set(names)` removes duplicates (Lesson 13), and `[...set]` turns it back into an array.

</details>

<details>
<summary>💡 Hint 3</summary>

Sort the names with `toSorted((a, b) => a.localeCompare(b))`, then `return { count: paid.length, revenue, customers };`.

</details>

### 2. Best-selling products

`sales` is an array of `{ product, qty }` records, with products repeated. Write `topProducts(sales, n)` returning the names of the `n` products with the largest **total** quantity, biggest first. Break ties alphabetically by name.

Starter code:

```js
function topProducts(sales, n) {
  // your code here
}

const sales = [
  { product: "tube", qty: 5 }, { product: "bell", qty: 2 },
  { product: "lock", qty: 4 }, { product: "bell", qty: 3 }, { product: "pump", qty: 5 },
];
console.log(topProducts(sales, 2));   // [ 'bell', 'pump' ]  (bell 5, pump 5, tube 5: alphabetical)
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** aggregate, then rank with a tie-breaker, then cut to n.
2. **Examples:** bell 2 + 3 = 5 ties with tube and pump; alphabetical order puts bell, pump, tube.
3. **Brute force:** for each distinct product, scan all sales to total it: O(p · s).
4. **Pattern:** **count into a dictionary, sort the entries, take the top n**.
5. **Plan:** totals object → entries → sort (qty desc, name asc) → slice → names.
6. **Code and test:** ties, n = 0, n too big, empty input.

</details>

<details>
<summary>💡 Hint 1</summary>

First add up the quantity per product, in an object (or a Map) keyed by product name.

</details>

<details>
<summary>💡 Hint 2</summary>

`Object.entries(totals)` turns `{ bell: 5, … }` into `[["bell", 5], …]`, which you can sort with a comparator.

</details>

<details>
<summary>💡 Hint 3</summary>

Sort with `(a, b) => b[1] - a[1] || a[0].localeCompare(b[0])` (biggest total first, then by name), then `slice(0, n)` and keep just the names.

</details>

**In the sandbox:** exercises 19–20. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Summarise orders</summary>

```js
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

**Line by line**

- Filtering once and reusing `paid` keeps the three calculations consistent.
- `reduce` with a starting value of `0` returns 0 for an empty list instead of throwing.
- `new Set(...)` keeps one copy of each name; spreading it back gives an array that can be sorted.
- `localeCompare` sorts "Al" before "bo" even though lower-case letters have bigger character codes.

**Trace:** paid → Cy 64, Ada 120, Ada 18 → revenue 202 → names Cy, Ada, Ada → {Cy, Ada} → sorted [Ada, Cy].

**Common wrong approach:** `orders.sort(...)` or `orders.splice(...)` inside the function, which reorders or empties the caller's data.

</details>

<details>
<summary>✅ 2. Best-selling products</summary>

```js
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

**Line by line**

- The `for…of` with `{ product, qty }` unpacks each record (destructuring, Lesson 12).
- `(totals[product] ?? 0) + qty` starts each product at 0.
- The comparator returns `qtyB - qtyA` (bigger first); when that's `0` (a tie), `||` falls through to the name comparison.
- `slice(0, n)` copes with n larger than the list, and `.map(([name]) => name)` keeps only the names.

**Trace:** totals tube 5, bell 5, lock 4, pump 5 → sorted bell, pump, tube (all 5, by name), lock → first 2: bell, pump.

**Common wrong approach:** sorting the raw sales instead of the totals, so a single big sale beats a product sold many times in small amounts.

</details>

## Quick quiz

1. What does [10, 1, 5].toSorted() return?
   - A) [1, 10, 5]
   - B) [1, 5, 10]
   - C) [10, 5, 1]

2. Which method returns the first item matching a condition?
   - A) find
   - B) filter
   - C) some

3. Why pass a starting value to reduce?
   - A) So it works on empty arrays and the accumulator starts with the right type
   - B) reduce requires exactly two arguments
   - C) It makes reduce run faster

4. How should an arrow function return an object literal?
   - A) (x) => ({ value: x })
   - B) (x) => { value: x }
   - C) (x) => return { value: x }

<details>
<summary>Quiz answers</summary>

1. **A) [1, 10, 5]**: Without a comparator, items are compared as strings.
2. **A) find**: filter returns all matches as an array; some returns true or false.
3. **A) So it works on empty arrays and the accumulator starts with the right type**: Without it, reduce uses the first item and throws on [].
4. **A) (x) => ({ value: x })**: Without brackets the braces are a function body.

</details>

---
Previous: [Lesson 9](09-arrays.md) · Next: [Lesson 11: Objects](11-objects.md)
