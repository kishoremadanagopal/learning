# Lesson 11: Objects

**You'll learn:** object literals, properties, dot and bracket access, adding, changing and deleting properties, shorthand properties, computed keys, methods and this, in and Object.hasOwn, Object.keys, values, entries and fromEntries, key order, nested objects, references, shallow and deep copies, structuredClone, comparing objects, Object.freeze.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#objects)**: run every example and check your exercise answers.

## Key terms

- **Object:** a collection of named properties (key–value pairs).
- **Property:** one key and its value inside an object.
- **Method:** a property whose value is a function.
- **Computed key:** a key written in brackets whose name is calculated, `{ [name]: value }`.
- **`Object.entries`:** turns an object into an array of `[key, value]` pairs.
- **Deep copy:** a copy that also copies every nested object.
- **`structuredClone`:** a built-in function that makes deep copies of data.

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

## Dots and brackets

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

## Shorthand, computed keys and methods

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

## Checking for properties

```js
const stock = { tubes: 12, bells: 0, pumps: undefined };
console.log("bells" in stock, Object.hasOwn(stock, "pumps"), "locks" in stock);
console.log(stock.bells ? "have bells" : "no bells?!");   // careful: 0 is falsy
```

`stock.bells` is `0`, which is falsy, so a truthiness test wrongly says there are none. Use `in` or `Object.hasOwn` to ask "is the key there?", and `!== undefined` or `??` for "is there a value?".

## Looping over objects

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

## References and copies

Objects, like arrays, are held by **reference**:

![Two diagrams. Left: const b = a. Both names point to one object, so changing b.qty changes what a sees. Right: a shallow copy made with spread gets its own top-level box, but its nested address property still points to the same inner object as the original; structuredClone copies the nested object too](../figures/references.svg)

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

## Freezing

`Object.freeze(obj)` stops changes to an object's properties (in strict mode, attempts throw an error). It's shallow too: nested objects can still change unless you freeze them as well. `const` only stops reassigning the variable.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Read by variable name | obj[key] | O(1) | O(1) |
| Loop over pairs | for (const [k, v] of Object.entries(obj)) | O(n) | O(n) |
| Transform an object | Object.fromEntries(Object.entries(obj).map(…)) | O(n) | O(n) |
| Deep copy | structuredClone(obj) | O(size) | O(size) |
| Safe nested read | walk the path; stop at null or undefined | O(depth) | O(1) |

## Common mistakes

- Using a dot with a key stored in a variable (`obj.key` instead of `obj[key]`).
- Testing for a key with a truthiness check when its value may be 0 or "".
- Expecting `{ ...obj }` to copy nested objects.
- Comparing objects with `===` and expecting their contents to be compared.
- Modifying an object while looping over it.

## Exercises

### 1. Invert an object

Write `invert(obj)` returning a new object whose keys are the original values (as strings) and whose values are the original keys. If several keys share a value, the **last** one wins.

Starter code:

```js
function invert(obj) {
  // your code here
}

console.log(invert({ a: 1, b: 2, c: 1 }));   // { '1': 'c', '2': 'b' }
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** swap keys and values; duplicates resolve to the last key.
2. **Examples:** a: 1 and c: 1 → key "1" ends up with "c".
3. **Brute force:** a `for…in` loop assigning `result[obj[key]] = key`: works just as well.
4. **Pattern:** **entries → transform → fromEntries**.
5. **Plan:** entries → swap each pair → build the object.
6. **Code and test:** duplicates, non-string values, empty object; input unchanged.

</details>

<details>
<summary>💡 Hint 1</summary>

`Object.entries(obj)` gives `[key, value]` pairs; you want `[value, key]` pairs instead.

</details>

<details>
<summary>💡 Hint 2</summary>

`Object.fromEntries(pairs)` builds an object from pairs. Later pairs with the same key overwrite earlier ones, which is exactly the "last one wins" rule.

</details>

<details>
<summary>💡 Hint 3</summary>

`return Object.fromEntries(Object.entries(obj).map(([k, v]) => [v, k]));`

</details>

### 2. Read a nested value safely

Write `getPath(obj, path, fallback)` that follows a dot-separated `path` such as `"customer.address.city"` through nested objects and returns the value found, or `fallback` if any step is missing (`null` or `undefined`). A value of `0`, `""` or `false` at the end is a real value, not missing. An empty path returns `obj` itself.

Starter code:

```js
function getPath(obj, path, fallback) {
  // your code here
}

const order = { customer: { name: "Ada", address: { city: "Bristol" } }, items: 0 };
console.log(getPath(order, "customer.address.city", "?"), getPath(order, "customer.phone", "none"), getPath(order, "items", 5));
// Bristol none 0
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** like `obj?.a?.b?.c ?? fallback`, but with the path as text.
2. **Examples:** `"customer.phone"` → customer exists, phone is undefined → fallback.
3. **Brute force:** separate code for each depth: impossible for arbitrary paths.
4. **Pattern:** **walk a path with a cursor variable**.
5. **Plan:** empty path → return obj; for each key: stop if nothing there, else step down; finally `??`.
6. **Code and test:** falsy real values, null in the middle, array indexes, strings, null start.

</details>

<details>
<summary>💡 Hint 1</summary>

Split the path on dots and walk down one key at a time, keeping the current value in a variable.

</details>

<details>
<summary>💡 Hint 2</summary>

Before each step, if the current value is `null` or `undefined`, stop and return the fallback.

</details>

<details>
<summary>💡 Hint 3</summary>

At the end, `return current ?? fallback;`: `??` keeps `0`, `""` and `false` but replaces `null` and `undefined`.

</details>

**In the sandbox:** exercises 21–22. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Invert an object</summary>

```js
function invert(obj) {
  return Object.fromEntries(Object.entries(obj).map(([key, value]) => [value, key]));
}

console.log(invert({ a: 1, b: 2, c: 1 }));
```

**Line by line**

- `Object.entries` gives pairs in insertion order, so "last one wins" follows the original order.
- `([key, value]) => [value, key]` unpacks each pair and builds the swapped one.
- `Object.fromEntries` converts keys to strings automatically: `1` becomes `"1"`, `true` becomes `"true"`.

**Trace:** `{ a: 1, b: 2, c: 1 }` → `[[1, "a"], [2, "b"], [1, "c"]]` → `{ "1": "c", "2": "b" }`.

**Common wrong approach:** modifying `obj` while looping over it (adding swapped keys to the same object), which mixes old and new keys and can loop over keys you've just added.

</details>

<details>
<summary>✅ 2. Read a nested value safely</summary>

```js
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

**Line by line**

- `path.split(".")` turns `"tags.1"` into `["tags", "1"]`; brackets accept the string `"1"` as an array index.
- The null/undefined check before each step prevents `TypeError: Cannot read properties of undefined`.
- `current[key]` works on strings too: `"Bristol".length` is 7.
- `?? fallback` only replaces `null` or `undefined`, so 0 and "" survive.

**Trace:** `"customer.address.zip"` → customer → address → zip is null → `null ?? "no zip"` → "no zip".

**Common wrong approach:** `return current || fallback`, which replaces the real values 0, "" and false. Libraries such as Lodash provide this as `_.get`; optional chaining covers it when the path is fixed in the code.

</details>

## Quick quiz

1. When must you use brackets instead of a dot to read a property?
   - A) When the key is in a variable or isn't a valid name, like "frame size"
   - B) When the value is a number
   - C) Always, for nested objects

2. const b = { ...a }; Then b.address.city = "Leeds". What happens to a.address.city?
   - A) It changes too, because spread makes a shallow copy
   - B) Nothing; b is a full copy
   - C) An error is thrown

3. How do you test whether an object has a key "bells", even if its value is 0?
   - A) Object.hasOwn(obj, "bells") or "bells" in obj
   - B) if (obj.bells)
   - C) obj.bells !== 0

4. What does Object.fromEntries([["a", 1], ["b", 2]]) return?
   - A) { a: 1, b: 2 }
   - B) [["a", 1], ["b", 2]]
   - C) a Map

<details>
<summary>Quiz answers</summary>

1. **A) When the key is in a variable or isn't a valid name, like "frame size"**: obj[key] evaluates key; obj.key looks for a property literally called "key".
2. **A) It changes too, because spread makes a shallow copy**: Use structuredClone for a deep copy.
3. **A) Object.hasOwn(obj, "bells") or "bells" in obj**: Truthiness tests treat 0 as missing.
4. **A) { a: 1, b: 2 }**: It's the reverse of Object.entries.

</details>

---
Previous: [Lesson 10](10-array-methods.md) · Next: [Lesson 12: Destructuring and spread](12-destructuring-and-spread.md)
