# Lesson 12: Destructuring and spread

**You'll learn:** array destructuring, skipping and defaults, rest elements, swapping variables, object destructuring, renaming, nested destructuring, rest properties, destructuring parameters and options objects, spread for arrays and objects, merging with later spreads winning, immutable updates of nested data.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#destructuring-and-spread)**: run every example and check your exercise answers.

## Key terms

- **Destructuring:** unpacking values from an array or object into variables in one statement.
- **Default value:** a value used in destructuring when the original is `undefined`.
- **Rest element:** `...rest` in destructuring, collecting the remaining items or properties.
- **Spread:** `...` expanding an array or object into a new array, object or argument list.
- **Options object:** a single object parameter whose properties are named options with defaults.
- **Immutable update:** producing an updated copy of data instead of changing the original.

**Destructuring** unpacks values from arrays and objects into variables in one line. **Spread** (`...`) does the opposite: it expands an array or object into a new one. Together they're everywhere in modern JavaScript.

## Array destructuring

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

## Object destructuring

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

## Destructuring parameters

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

## Spread: copy and merge

```js
const base = ["frame", "wheels"];
const full = [...base, "saddle", ...["bell", "lights"]];
console.log(full);

const defaults = { theme: "light", fontSize: 14, sound: true };
const userPrefs = { fontSize: 18 };
const settings = { ...defaults, ...userPrefs };        // later spreads win
console.log(settings);
```

## Updating data without changing it

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

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Unpack by name | const { a, b: renamed, c = 1 } = obj | O(k) | O(k) |
| Merge with overrides | { ...defaults, ...overrides } | O(n) | O(n) |
| Update one item | { ...state, items: items.map(i => i.id === id ? { ...i, ...changes } : i) } | O(n) | O(n) |
| Named options | function f(x, { opt = 1 } = {}) | O(1) | O(1) |

## Common mistakes

- Destructuring a nested object that may be missing, without a default `= {}`.
- Forgetting `= {}` on a destructured options parameter, so calling without options crashes.
- Putting the defaults after the overrides in a merge (`{ ...prefs, ...defaults }`).
- Updating nested data with spread on the outer object only, then changing the shared inner one.

## Exercises

### 1. Update a cart item

Write `updateItem(cart, id, changes)` returning a **new** cart in which the item with that `id` has the `changes` merged in. Other items and other cart properties stay the same, and the original cart must not change. If no item has that `id`, return a copy with the items unchanged.

Starter code:

```js
function updateItem(cart, id, changes) {
  // your code here
}

const cart = { owner: "Ada", items: [{ id: 1, name: "tube", qty: 2 }, { id: 2, name: "bell", qty: 1 }] };
const next = updateItem(cart, 2, { qty: 3, colour: "red" });
console.log(next.items[1], cart.items[1]);
// { id: 2, name: 'bell', qty: 3, colour: 'red' } { id: 2, name: 'bell', qty: 1 }
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** copy only along the path to the change; share everything else.
2. **Examples:** updating item 2 creates a new cart object, a new items array and a new item 2.
3. **Brute force:** `structuredClone(cart)` then change the copy: correct, but copies everything.
4. **Pattern:** **immutable update with spread and map**.
5. **Plan:** spread the cart → map the items → spread the matching item with the changes.
6. **Code and test:** each item, a missing id, an empty cart; original untouched; other items shared.

</details>

<details>
<summary>💡 Hint 1</summary>

The result is `{ ...cart, items: newItems }`: a copy of the cart with a replaced `items` array.

</details>

<details>
<summary>💡 Hint 2</summary>

Build `newItems` with `map`: for the matching item return a merged copy, for the others return the item itself.

</details>

<details>
<summary>💡 Hint 3</summary>

The merged copy is `{ ...item, ...changes }` (later spreads win, so the changes overwrite).

</details>

### 2. Describe a user

Write `describeUser(user)` using destructuring with defaults. A user looks like `{ name, age, address: { city } }`, but `age`, `address` and `city` may be missing. Return `"<name> (<age>) from <city>"`, using `"age unknown"` instead of `(<age>)` when age is missing, and `"somewhere"` when there's no city.

Starter code:

```js
function describeUser(user) {
  // your code here
}

console.log(describeUser({ name: "Ada", age: 36, address: { city: "London" } }));   // Ada (36) from London
console.log(describeUser({ name: "Bo" }));                                          // Bo (age unknown) from somewhere
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** unpack with defaults at two levels.
2. **Examples:** `{ name: "Bo" }` → no age, no address → both defaults.
3. **Brute force:** `user.address && user.address.city ? … : …` chains: works, harder to read.
4. **Pattern:** **nested destructuring with defaults**.
5. **Plan:** one destructuring statement → template literal.
6. **Code and test:** all present, all missing, age 0, empty address.

</details>

<details>
<summary>💡 Hint 1</summary>

Defaults in destructuring look like `{ age = "age unknown" } = user`. They apply when the value is missing or `undefined` (so 0 stays 0).

</details>

<details>
<summary>💡 Hint 2</summary>

For the nested city, destructure `address` and give the whole address a default of `{}`, so a missing address doesn't crash.

</details>

<details>
<summary>💡 Hint 3</summary>

`const { name, age = "age unknown", address: { city = "somewhere" } = {} } = user;`

</details>

**In the sandbox:** exercises 23–24. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Update a cart item</summary>

```js
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

**Line by line**

- `{ ...cart, items: … }` copies `owner` (and any other properties) and replaces `items`.
- `map` always returns a new array, so the cart's array is never modified.
- `{ ...item, ...changes }` makes a new object with the old fields, then the changed ones on top; `colour` is added because it wasn't there before.
- Returning `item` unchanged for other ids shares those objects, which is safe because nothing modifies them.

**Trace:** id 2 → item 1 returned as is; item 2 → `{ id: 2, name: "bell", qty: 1, ...{ qty: 3, colour: "red" } }`.

**Common wrong approach:** `cart.items.find((i) => i.id === id).qty = 3`, which changes the caller's cart (and crashes when the id doesn't exist).

</details>

<details>
<summary>✅ 2. Describe a user</summary>

```js
function describeUser(user) {
  const { name, age = "age unknown", address: { city = "somewhere" } = {} } = user;
  return `${name} (${age}) from ${city}`;
}

console.log(describeUser({ name: "Ada", age: 36, address: { city: "London" } }));
console.log(describeUser({ name: "Bo" }));
```

**Line by line**

- `age = "age unknown"` uses the default only when `user.age` is `undefined`, so an age of 0 is kept.
- `address: { city = "somewhere" } = {}` means: take `user.address` (or `{}` if missing) and unpack its `city` (or "somewhere").
- Without the `= {}`, destructuring a missing address would throw `TypeError: Cannot read properties of undefined`.

**Trace:** `{ name: "Cy", age: 0, address: {} }` → name Cy, age 0, address `{}` → city default → "Cy (0) from somewhere".

**Common wrong approach:** `const { address: { city } } = user;` with no default for `address`: it throws as soon as a user has no address.

</details>

## Quick quiz

1. What does const [first, ...rest] = [1, 2, 3] give?
   - A) first = 1, rest = [2, 3]
   - B) first = [1], rest = 3
   - C) first = 1, rest = 2

2. What does const { customer: buyer } = order do?
   - A) Creates a variable called buyer holding order.customer
   - B) Creates a variable called customer
   - C) Sets order.customer to buyer

3. In { ...defaults, ...userPrefs }, which wins when both have fontSize?
   - A) userPrefs, because later spreads overwrite earlier ones
   - B) defaults
   - C) Neither; it throws

4. Why write function f({ a = 1 } = {})?
   - A) So callers can omit the options object entirely
   - B) To make a required
   - C) It's required syntax for destructuring

<details>
<summary>Quiz answers</summary>

1. **A) first = 1, rest = [2, 3]**: ...rest collects the remaining items into an array.
2. **A) Creates a variable called buyer holding order.customer**: The name after the colon is the new variable.
3. **A) userPrefs, because later spreads overwrite earlier ones**: Order matters: put the overrides last.
4. **A) So callers can omit the options object entirely**: Without = {}, calling f() would try to destructure undefined.

</details>

---
Previous: [Lesson 11](11-objects.md) · Next: [Lesson 13: Map and Set](13-map-and-set.md)
