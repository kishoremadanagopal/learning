# Lesson 2: Variables and types

**You'll learn:** let and const, why not var, naming rules and camelCase, primitive types and objects, typeof and its quirks, Array.isArray, dynamic typing, converting with Number, String, Boolean, parseInt and parseFloat, NaN and Number.isNaN, implicit conversion, undefined versus null, strict mode.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#variables-and-types)**: run every example and check your exercise answers.

## Key terms

- **Variable:** a name that refers to a value.
- **`const`:** declares a name that can't be reassigned.
- **`let`:** declares a name that can be reassigned.
- **Primitive:** a simple, unchangeable value: string, number, bigint, boolean, undefined, null or symbol.
- **Object:** any value that isn't a primitive, such as plain objects, arrays and functions.
- **`typeof`:** an operator that returns a value's type as a string.
- **Dynamic typing:** types belong to values, not variables, and are checked as the code runs.
- **`NaN`:** "not a number", the result of a failed numeric operation.
- **`undefined`:** the value of something that hasn't been given a value.
- **`null`:** a value meaning "deliberately empty".
- **Strict mode:** a stricter version of JavaScript that turns some silent mistakes into errors.

A **variable** is a name for a value. JavaScript has two modern ways to declare one:

```js
const shop = "Spoke & Chain";   // const: the name can't be reassigned
let stock = 12;                 // let: the name can be reassigned
stock = stock - 1;
console.log(shop, "has", stock, "inner tubes");
```

**Use `const` by default**, and `let` only when the value really has to change. Readers then know at a glance which names stay fixed. You'll also see the old keyword **`var`** in older code: it has confusing scoping rules (Lesson 8), so don't use it in new code.

*This example raises an error on purpose.*

```js
const vat = 0.2;
vat = 0.25;          // TypeError: assignment to a constant variable
```

`const` stops the **name** being reassigned; it doesn't freeze the value. A `const` array can still have items added (Part 2).

## Names

- Letters, digits, `_` and `$`; not starting with a digit; case-sensitive (`total` and `Total` differ).
- Convention: **camelCase** for variables and functions (`orderTotal`), **PascalCase** for classes (`Order`), **UPPER_SNAKE_CASE** for fixed settings (`MAX_ITEMS`).
- Reserved words such as `let`, `class` and `function` can't be names.

## Types

Every value has a **type**. There are seven **primitive** (simple, unchangeable) types, and everything else is an **object**:

| Type | Examples | Notes |
|---|---|---|
| string | `"hi"`, `'hi'`, `` `hi` `` | text (Lesson 3) |
| number | `42`, `3.14`, `-0`, `NaN`, `Infinity` | one type for whole and decimal numbers (Lesson 4) |
| bigint | `9007199254740993n` | whole numbers of any size |
| boolean | `true`, `false` | |
| undefined | `undefined` | "no value has been given" |
| null | `null` | "deliberately empty" |
| symbol | `Symbol("id")` | unique keys; rarely needed day to day |
| object | `{ name: "Ada" }`, `[1, 2]`, functions, dates | everything else (Part 2) |

`typeof` tells you a value's type, as a string, with two famous quirks:

```js
console.log(typeof "hi", typeof 42, typeof 10n, typeof true, typeof undefined);
console.log(typeof { a: 1 }, typeof [1, 2], typeof function () {});
console.log(typeof null);             // "object": a bug from 1995 that can never be fixed
console.log(Array.isArray([1, 2]));   // the reliable way to test for an array
```

- `typeof null` is `"object"`: test for null with `value === null`.
- Arrays are objects, so `typeof [1, 2]` is `"object"`: use `Array.isArray`.

## Dynamic typing

Variables don't have types; **values** do. The same `let` variable can hold a number and later a string. That's flexible, but it means type mistakes only show up when the code runs, which is the main reason TypeScript exists (Part 6).

## Converting between types

```js
console.log(Number("42"), Number("4.5"), Number(""), Number("12px"), Number(true));
console.log(parseInt("12px"), parseFloat("4.5kg"), parseInt("0.9"));
console.log(String(42), (255).toString(16), String(null));
console.log(Boolean(0), Boolean("0"), Boolean(""), Boolean("false"));
```

- `Number(text)` converts the **whole** string, or gives `NaN`. `Number("")` is `0`, a classic surprise.
- `parseInt` and `parseFloat` read as much of a number as they can from the start, and stop.
- `NaN` ("not a number") is the result of a failed number operation. It's the only value not equal to itself, so test it with `Number.isNaN(x)`.

JavaScript also converts types **automatically** in some operations, sometimes surprisingly: `"3" + 4` is `"34"` (text joining) while `"3" * 4` is `12`. Convert explicitly when you mean a number.

## undefined versus null

- **`undefined`**: the language's "nothing here yet": a declared variable with no value, a missing object property, a function with no `return`.
- **`null`**: your code's "deliberately empty": use it when you mean "no value on purpose".

```js
let middleName;
const user = { name: "Ada", phone: null };
console.log(middleName, user.phone, user.email);
```

## Strict mode catches silent mistakes

In old sloppy-mode JavaScript, assigning to a misspelt name silently created a new global variable. In strict mode (modules, classes, and this sandbox) it's an error:

*This example raises an error on purpose.*

```js
let total = 10;
totl = total * 2;       // ReferenceError in strict mode
```

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Declare | const by default; let if reassigned | O(1) | O(1) |
| Check a type | typeof, plus === null and Array.isArray | O(1) | O(1) |
| Text to number | validate the format, then Number(text) | O(n) | O(1) |

## Common mistakes

- Using `let` (or `var`) for values that never change.
- Testing for null with `typeof value === "null"`.
- Comparing with `=== NaN`, which is always false.
- Trusting `Number(text)` to validate input (`Number("")` is 0).
- Assigning to a misspelt variable name and expecting a new variable.

## Exercises

### 1. Describe a value's type

Write `describe(value)` returning a string naming its type, fixing `typeof`'s quirks:

- `"null"` for `null` and `"array"` for arrays;
- `"nan"` for `NaN`;
- otherwise the result of `typeof` (`"string"`, `"number"`, `"bigint"`, `"boolean"`, `"undefined"`, `"symbol"`, `"function"` or `"object"`).

Starter code:

```js
function describe(value) {
  // your code here
}

console.log(describe(null), describe([1, 2]), describe(NaN), describe("hi"));
// null array nan string
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** like `typeof`, but with three special cases.
2. **Examples:** `typeof null` is `"object"`, but we want `"null"`.
3. **Brute force:** a long chain of `typeof` comparisons: unnecessary.
4. **Pattern:** **guard clauses** for special cases, then the general rule.
5. **Plan:** null → array → NaN → `typeof`.
6. **Code and test:** each type, plus `0`, `""` and `[]` (falsy or empty values that must still be described correctly).

</details>

<details>
<summary>💡 Hint 1</summary>

Handle the special cases first, then fall back to `typeof value`.

</details>

<details>
<summary>💡 Hint 2</summary>

Test null with `value === null`, arrays with `Array.isArray(value)`, and NaN with `Number.isNaN(value)`.

</details>

<details>
<summary>💡 Hint 3</summary>

`if (value === null) return "null";` … then `return typeof value;` at the end.

</details>

### 2. Read a quantity

A form gives you quantities as text. Write `toQuantity(text)` returning the quantity as a number, or `null` if the text isn't a whole number from 1 to 99. Surrounding spaces are fine (`" 3 "` → `3`); anything else (empty text, `"2.5"`, `"3 tubes"`, `"0"`, `"100"`) gives `null`.

Starter code:

```js
function toQuantity(text) {
  // your code here
}

console.log(toQuantity(" 3 "), toQuantity("2.5"), toQuantity(""), toQuantity("12"));
// 3 null null 12
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** validate the format first, then the range; anything doubtful is `null`.
2. **Examples:** `Number("2.5")` is 2.5 (not whole); `parseInt("3 tubes")` is 3 (but the text isn't a number).
3. **Brute force:** `parseInt(text)` and hope: accepts "3 tubes" and "2.5".
4. **Pattern:** **validate, then convert**.
5. **Plan:** trim → digits-only test → `Number` → range check.
6. **Code and test:** empty, spaces only, decimals, words, 0, 100, `"1e1"`, `"0x10"`.

</details>

<details>
<summary>💡 Hint 1</summary>

`text.trim()` removes surrounding spaces. Then check the rest is only digits before converting.

</details>

<details>
<summary>💡 Hint 2</summary>

`Number("")` is `0` and `Number("1e1")` is `10`, so `Number` alone accepts too much. The regular expression `/^\d+$/` tests "one or more digits and nothing else".

</details>

<details>
<summary>💡 Hint 3</summary>

After the digit check, `const n = Number(trimmed)`, then return `n` if it's between 1 and 99, otherwise `null`.

</details>

**In the sandbox:** exercises 3–4. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Describe a value's type</summary>

```js
function describe(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isNaN(value)) return "nan";
  return typeof value;
}

console.log(describe(null), describe([1, 2]), describe(NaN), describe("hi"));
```

**Line by line**

- `value === null` is the only reliable null test, since `typeof null` is `"object"`.
- `Array.isArray` is true for arrays and nothing else.
- `Number.isNaN(value)` is true only for the number `NaN`. (The older global `isNaN("hi")` converts first and returns `true` for text, which is wrong here.)
- Everything else is exactly what `typeof` says.

**Trace:** `describe([])` → not null → `Array.isArray([])` is true → `"array"`.

**Common wrong approach:** `if (!value) return "null";`, which also catches `0`, `""`, `false` and `NaN`: all "falsy" (Lesson 5), but not null.

</details>

<details>
<summary>✅ 2. Read a quantity</summary>

```js
function toQuantity(text) {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;     // digits only
  const n = Number(trimmed);
  return n >= 1 && n <= 99 ? n : null;
}

console.log(toQuantity(" 3 "), toQuantity("2.5"), toQuantity(""), toQuantity("12"));
```

**Line by line**

- `trim()` handles the allowed spaces.
- `/^\d+$/` is a **regular expression** (Part 3): `^` start, `\d+` one or more digits, `$` end. It rejects `""`, `"2.5"`, `"-2"`, `"1e1"` and `"0x10"`, all of which `Number` would otherwise accept or misread.
- `Number(trimmed)` is now safe; the range check rejects 0 and 100.

**Trace:** `" 3 "` → `"3"` → digits only → 3 → in range → `3`.

**Common wrong approach:** relying on `Number(text)` alone. It accepts `"2.5"`, `"1e1"` (10) and `"0x10"` (16), and turns empty or all-space text into `0`. Validate the format first, then convert.

</details>

## Quick quiz

1. Which declaration should you use by default?
   - A) const
   - B) var
   - C) let

2. What does typeof null return?
   - A) "null"
   - B) "undefined"
   - C) "object"

3. What is Number("")?
   - A) 0
   - B) null
   - C) NaN

4. How do you reliably check whether x is NaN?
   - A) Number.isNaN(x)
   - B) x === NaN
   - C) typeof x === "NaN"

<details>
<summary>Quiz answers</summary>

1. **A) const**: Use let only when the name must be reassigned; avoid var.
2. **C) "object"**: A historical bug; test with value === null.
3. **A) 0**: An empty (or all-space) string converts to 0, a common surprise.
4. **A) Number.isNaN(x)**: NaN is the only value not equal to itself.

</details>

---
Previous: [Lesson 1](01-what-is-javascript.md) · Next: [Lesson 3: Strings and template literals](03-strings.md)
