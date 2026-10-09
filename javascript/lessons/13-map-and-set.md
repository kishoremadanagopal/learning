# Lesson 13: Map and Set

**You'll learn:** Map and its methods, Map versus plain objects, any key type, size and order, getOrInsert, counting and grouping with a Map, Map.groupBy, Set and its methods, removing duplicates, fast membership tests, union, intersection, difference, symmetricDifference, isSubsetOf and isDisjointFrom, WeakMap and WeakSet.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#map-and-set)**: run every example and check your exercise answers.

## Key terms

- **Map:** a collection of key–value pairs where keys can be any value and order is preserved.
- **Set:** a collection of unique values.
- **`getOrInsert`:** returns a Map's value for a key, storing a default first if the key is missing.
- **Union / intersection / difference:** all values in either set / in both / in the first but not the second.
- **Membership test:** checking whether a value is in a collection; fast with `set.has`.
- **WeakMap:** a Map with object keys that doesn't keep its keys alive.

Plain objects work as dictionaries, but JavaScript has two collections designed for the job: **Map** (key → value) and **Set** (unique values).

## Map

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

## Counting and grouping

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

## Set

A **Set** holds each value at most once:

```js
const tags = new Set(["mtb", "alloy", "mtb"]);
tags.add("disc").add("alloy");
console.log(tags, tags.size, tags.has("mtb"));
console.log([...new Set([3, 1, 3, 2, 1])]);         // remove duplicates, keep first-seen order
```

`has` on a Set is fast however big the set is, unlike `array.includes`, which checks every item. For "have I seen this before?" inside a loop, use a Set.

## Set operations

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

## WeakMap and WeakSet

A **WeakMap** only accepts objects as keys and doesn't keep them alive: when nothing else refers to the key object, its entry can be cleaned up automatically. It's used to attach extra data to objects you don't own (for example, caching per DOM element) without leaking memory. You can't loop over a WeakMap or ask its size.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Count occurrences | map.set(k, (map.get(k) ?? 0) + 1) | O(n) | O(distinct) |
| Remove duplicates | [...new Set(items)] | O(n) | O(n) |
| Seen before? | set.has(x) | O(1) average | O(n) |
| Compare lists | new Set(a).intersection(new Set(b)) | O(n + m) | O(n + m) |

## Common mistakes

- Using objects as keys in a plain object (they all become "[object Object]").
- Using `array.includes` inside a loop over a large list instead of a Set.
- Expecting `JSON.stringify` to keep a Map's contents.
- Counting with a plain object and colliding with inherited keys like "constructor".

## Exercises

### 1. Word frequencies

Write `wordFrequencies(text)` returning an array of `[word, count]` pairs for the words in `text`, most frequent first, ties in alphabetical order. Words are runs of letters (`text.toLowerCase().match(/[a-z']+/g)`; treat `null` as no words).

Starter code:

```js
function wordFrequencies(text) {
  // your code here
}

console.log(wordFrequencies("The bell, the tube and THE pump. And a bell!"));
// [ [ 'the', 3 ], [ 'and', 2 ], [ 'bell', 2 ], [ 'a', 1 ], [ 'pump', 1 ], [ 'tube', 1 ] ]
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** tokenise → count → sort by count desc, then word asc.
2. **Examples:** "the" ×3, "and" ×2 and "bell" ×2 (tie: "and" first).
3. **Brute force:** for each distinct word, count it with `filter`: O(n²).
4. **Pattern:** **count with a Map, then sort the entries**.
5. **Plan:** words → Map counts → entries → sort.
6. **Code and test:** empty, no words, apostrophes, ties.

</details>

<details>
<summary>💡 Hint 1</summary>

`match` with the `g` flag returns an array of all matches, or `null` when there are none: use `?? []`.

</details>

<details>
<summary>💡 Hint 2</summary>

Count into a `Map` with `counts.set(w, (counts.get(w) ?? 0) + 1)`. Spreading a Map, `[...counts]`, gives `[key, value]` pairs.

</details>

<details>
<summary>💡 Hint 3</summary>

Sort the pairs with `(a, b) => b[1] - a[1] || a[0].localeCompare(b[0])`.

</details>

### 2. Compare two tag lists

Write `compareTags(a, b)` for two arrays of tags (which may contain duplicates) returning an object with three **sorted** arrays: `both` (tags in both lists), `onlyA` and `onlyB`. Use Sets.

Starter code:

```js
function compareTags(a, b) {
  // your code here
}

console.log(compareTags(["mtb", "disc", "alloy", "mtb"], ["road", "alloy", "disc"]));
// { both: [ 'alloy', 'disc' ], onlyA: [ 'mtb' ], onlyB: [ 'road' ] }
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** three set relationships, each as a sorted array.
2. **Examples:** "mtb" appears twice in a but counts once.
3. **Brute force:** `a.filter((t) => b.includes(t))`: O(n·m) and keeps duplicates.
4. **Pattern:** **set algebra**.
5. **Plan:** two Sets → intersection and two differences → sort each.
6. **Code and test:** empty lists, identical lists, disjoint lists.

</details>

<details>
<summary>💡 Hint 1</summary>

Turn both arrays into Sets; duplicates disappear automatically.

</details>

<details>
<summary>💡 Hint 2</summary>

`setA.intersection(setB)` and `setA.difference(setB)` do the work; spread a Set into an array to sort it.

</details>

<details>
<summary>💡 Hint 3</summary>

If your browser lacks the newer Set methods, use filters: `[...setA].filter((t) => setB.has(t))` is the intersection.

</details>

**In the sandbox:** exercises 25–26. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Word frequencies</summary>

```js
function wordFrequencies(text) {
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  const counts = new Map();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts].toSorted(([wa, ca], [wb, cb]) => cb - ca || wa.localeCompare(wb));
}

console.log(wordFrequencies("The bell, the tube and THE pump. And a bell!"));
```

**Line by line**

- Lower-casing first makes "The" and "THE" the same word.
- `/[a-z']+/g` keeps apostrophes inside words like "don't" and drops punctuation and digits.
- The Map preserves the order words were first seen, but the sort decides the final order anyway.
- `cb - ca || wa.localeCompare(wb)`: bigger counts first; for equal counts, alphabetical.

**Trace:** "b a c a b a" → a: 3, b: 2, c: 1 → already in count order.

**Common wrong approach:** counting in a plain object and later looking up a word like `"constructor"`: `obj["constructor"]` exists on every object (it's inherited), so the count starts from a function instead of 0. A Map has no such inherited keys.

</details>

<details>
<summary>✅ 2. Compare two tag lists</summary>

```js
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

**Line by line**

- `new Set(a)` removes duplicate tags.
- `intersection` keeps tags in both; `difference` keeps tags in the first set but not the second, so it's used twice, in each direction.
- `[...s].toSorted()` sorts strings alphabetically (the default string comparison is fine for lower-case tags).

**Trace:** A = {mtb, disc, alloy}, B = {road, alloy, disc} → both {disc, alloy} → sorted [alloy, disc]; onlyA [mtb]; onlyB [road].

**Common wrong approach:** comparing arrays with `includes` inside `filter`, which is slow for long lists and returns duplicates (["mtb", "mtb"]).

</details>

## Quick quiz

1. When is a Map better than a plain object?
   - A) When keys come from data, aren't strings, or the collection changes a lot
   - B) When you need to send it as JSON directly
   - C) When the object has fixed, known fields

2. What does [...new Set([2, 1, 2, 3, 1])] return?
   - A) [2, 1, 3]
   - B) [1, 2, 3]
   - C) [2, 1, 2, 3, 1]

3. Why use a Set for "have I seen this?" checks in a loop?
   - A) set.has is fast regardless of size, while array.includes checks every item
   - B) Sets sort their values
   - C) Arrays can't hold strings

4. What does map.getOrInsert(key, []) return?
   - A) The existing value for key, or the new [] after storing it
   - B) Always a new empty array
   - C) true or false

<details>
<summary>Quiz answers</summary>

1. **A) When keys come from data, aren't strings, or the collection changes a lot**: Use objects for records, Maps for dictionaries.
2. **A) [2, 1, 3]**: Duplicates are removed; first-seen order is kept.
3. **A) set.has is fast regardless of size, while array.includes checks every item**: O(1) on average versus O(n).
4. **A) The existing value for key, or the new [] after storing it**: It's new in ECMAScript 2026.

</details>

---
Previous: [Lesson 12](12-destructuring-and-spread.md) · Next: [Lesson 14: JSON](14-json.md)
