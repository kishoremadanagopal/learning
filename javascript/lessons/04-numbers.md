# Lesson 4: Numbers and maths

**You'll learn:** the number type and floating point, arithmetic operators and precedence, compound assignment and ++, remainder and integer division, 0.1 + 0.2, comparing with a tolerance, Math functions, rounding, toFixed, Number.isInteger, MAX_SAFE_INTEGER and BigInt, Infinity and NaN, money in whole cents, Intl.NumberFormat.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#numbers)**: run every example and check your exercise answers.

## Key terms

- **Floating point:** the binary format numbers are stored in, exact for whole numbers but approximate for most decimals.
- **Operator precedence:** the rules for which operations happen first, such as `*` before `+`.
- **Remainder (`%`):** what's left after division; its sign follows the left-hand number in JavaScript.
- **Tolerance:** how far apart two numbers may be and still count as equal.
- **Safe integer:** a whole number small enough (up to 2⁵³ − 1) to be stored exactly.
- **BigInt:** a type for exact whole numbers of any size, written with an `n` suffix.
- **`Infinity`:** a number value bigger than any other, such as the result of `1 / 0`.

JavaScript has one main number type for whole numbers and decimals alike: a 64-bit **floating-point** number (the IEEE 754 standard, like Python's `float`). It also has **BigInt** for whole numbers of any size.

## Arithmetic

```js
console.log(7 + 2, 7 - 2, 7 * 2, 7 / 2);   // / always gives a decimal when needed
console.log(7 % 2, 2 ** 10);                // remainder, and power
console.log(2 + 3 * 4, (2 + 3) * 4);        // * before +; brackets first
let n = 5;
n += 2;      // n = n + 2
n *= 3;      // n = n * 3
n++;         // n = n + 1
console.log(n);
```

There's no integer-division operator. Use `Math.floor(a / b)` (rounds down) or `Math.trunc(a / b)` (drops the decimals, towards zero); they differ for negative numbers. The remainder `%` takes the sign of the left number: `-7 % 3` is `-1`, unlike Python's `-7 % 3 == 2`.

## Why 0.1 + 0.2 isn't 0.3

```js
console.log(0.1 + 0.2);
console.log(0.1 + 0.2 === 0.3);
console.log(Math.abs((0.1 + 0.2) - 0.3) < Number.EPSILON);   // fine near 1; the first exercise handles any size
```

Most decimals can't be stored exactly in binary, just as 1/3 can't be written exactly in decimal. The tiny errors are normal and happen in nearly every language. Two rules:

- **Never compare decimals with `===`**; check that they're close (the first exercise).
- **For money, count whole cents (or pence)** as integers, and only format as pounds or dollars for display.

## Math

```js
console.log(Math.round(2.5), Math.round(-2.5), Math.floor(-2.5), Math.ceil(2.1), Math.trunc(-2.9));
console.log(Math.max(3, 9, 4), Math.min(3, 9, 4), Math.abs(-7), Math.sqrt(16));
console.log(Math.PI.toFixed(2), (1234.5678).toFixed(1), typeof (1.5).toFixed(1));
console.log(Number.isInteger(5), Number.isInteger(5.5));
```

- `Math.round` rounds halves **up** (towards +∞): `Math.round(-2.5)` is `-2`.
- `toFixed(n)` returns a **string** with `n` decimals: perfect for display, wrong for further maths.
- `Math.random()` gives a random number from 0 (included) to 1 (not included).

## Very large and special numbers

```js
console.log(Number.MAX_SAFE_INTEGER);                    // 2⁵³ − 1
console.log(9007199254740992 + 1);                       // past the safe range: wrong!
console.log(9007199254740992n + 1n);                     // BigInt: exact
console.log(1 / 0, -1 / 0, 0 / 0);                       // Infinity, -Infinity, NaN
console.log(new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(1234.5));
```

- Integers are exact only up to `Number.MAX_SAFE_INTEGER` (about 9 quadrillion). IDs from databases or APIs can be bigger, which is why some APIs send them as strings.
- **BigInt** literals end in `n`. You can't mix BigInt and ordinary numbers in one operation without converting.
- Dividing by zero gives `Infinity`, not an error; `0 / 0` is `NaN`.
- `Intl.NumberFormat` formats numbers and currencies for any locale.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Compare decimals | Math.abs(a − b) ≤ tolerance × the larger magnitude | O(1) | O(1) |
| Integer division | Math.floor(a / b) or Math.trunc(a / b) | O(1) | O(1) |
| Money | integer pence; format only for display | O(digits) | O(digits) |
| Huge whole numbers | BigInt (123n) | O(digits) | O(digits) |

## Common mistakes

- Comparing decimal results with `===`.
- Doing arithmetic on the string returned by `toFixed`.
- Storing money as decimal pounds instead of whole pence.
- Expecting `-7 % 3` to be 2, as in Python.
- Mixing BigInt and ordinary numbers in one expression.

## Exercises

### 1. Are two numbers close?

Write `isClose(a, b, tolerance = 1e-9)` returning `true` when the two numbers differ by at most `tolerance` **times the larger of their absolute values**, or by at most `tolerance` itself (so numbers near zero work too). `NaN` is never close to anything.

Starter code:

```js
function isClose(a, b, tolerance = 1e-9) {
  // your code here
}

console.log(isClose(0.1 + 0.2, 0.3), isClose(1, 1.1), isClose(1e20, 1e20 + 1e5));
// true false true
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a relative tolerance, plus an absolute one for values near zero.
2. **Examples:** 1e20 and 1e20 + 1e5 differ by 100,000, which is tiny compared with 1e20.
3. **Brute force:** `a === b`: fails on 0.1 + 0.2.
4. **Pattern:** **relative-plus-absolute tolerance**, as in Python's `math.isclose`.
5. **Plan:** NaN guard → difference → compare with both limits.
6. **Code and test:** near zero, huge values, negatives, NaN, custom tolerances.

</details>

<details>
<summary>💡 Hint 1</summary>

A fixed gap like `0.000001` is too strict for huge numbers and too loose for tiny ones. Scale it by the size of the numbers.

</details>

<details>
<summary>💡 Hint 2</summary>

Compute `diff = Math.abs(a - b)` and compare it with `tolerance * Math.max(Math.abs(a), Math.abs(b))`.

</details>

<details>
<summary>💡 Hint 3</summary>

Also accept `diff <= tolerance` for numbers near zero, and return `false` first if either is `NaN`.

</details>

### 2. Format pence as pounds

Prices are stored as whole pence. Write `formatPence(pence)` returning text like `"£12.50"`:

- always two decimal places;
- a thousands separator for big amounts: `123456` → `"£1,234.56"`;
- negative amounts as `"-£3.05"`.

Do the arithmetic with whole numbers (no `toFixed` on a divided value).

Starter code:

```js
function formatPence(pence) {
  // your code here
}

console.log(formatPence(1250), formatPence(5), formatPence(123456), formatPence(-305));
// £12.50 £0.05 £1,234.56 -£3.05
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** integer pence → sign, pounds, two-digit pence, commas.
2. **Examples:** 123456 → 1234 pounds and 56 pence → "1,234" + ".56".
3. **Brute force:** divide by 100 and use `toFixed(2)`: works for these values but relies on floating point, which bites with larger amounts and further arithmetic.
4. **Pattern:** **split an integer into units** with division and remainder.
5. **Plan:** sign → absolute value → pounds and pence → commas → padded pence → assemble.
6. **Code and test:** zero, under a pound, exact pounds, millions, negatives.

</details>

<details>
<summary>💡 Hint 1</summary>

Work with the absolute value and remember the sign separately. Pounds are `Math.floor(abs / 100)`, pence are `abs % 100`.

</details>

<details>
<summary>💡 Hint 2</summary>

Pad the pence to two digits with `String(rest).padStart(2, "0")`.

</details>

<details>
<summary>💡 Hint 3</summary>

For commas, either loop from the right adding a comma every three digits, or use `pounds.toLocaleString("en-GB")`, or the regular expression `/\B(?=(\d{3})+(?!\d))/g`.

</details>

**In the sandbox:** exercises 7–8. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Are two numbers close?</summary>

```js
function isClose(a, b, tolerance = 1e-9) {
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  const diff = Math.abs(a - b);
  return diff <= tolerance * Math.max(Math.abs(a), Math.abs(b)) || diff <= tolerance;
}

console.log(isClose(0.1 + 0.2, 0.3), isClose(1, 1.1), isClose(1e20, 1e20 + 1e5));
```

**Line by line**

- `NaN` comparisons are always false anyway, but the explicit guard documents the intent.
- `Math.abs(a - b)` is the size of the gap, whichever number is bigger.
- Multiplying the tolerance by the larger magnitude makes it **relative**: "within one part in a billion".
- `|| diff <= tolerance` handles values near zero, where a relative limit would be almost nothing.

**Trace:** `isClose(0, 1e-12)` → diff 1e-12; relative limit 1e-9 × 1e-12 is tiny, but 1e-12 ≤ 1e-9 → `true`.

**Common wrong approach:** `Math.abs(a - b) < Number.EPSILON`. `Number.EPSILON` (about 2.2e-16) is the gap between 1 and the next number; for values like 1000 the real rounding errors are far bigger, so the check fails when it shouldn't.

</details>

<details>
<summary>✅ 2. Format pence as pounds</summary>

```js
function formatPence(pence) {
  const sign = pence < 0 ? "-" : "";
  const abs = Math.abs(pence);
  const pounds = Math.floor(abs / 100);
  const rest = abs % 100;
  const withCommas = String(pounds).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}£${withCommas}.${String(rest).padStart(2, "0")}`;
}

console.log(formatPence(1250), formatPence(5), formatPence(123456), formatPence(-305));
```

**Line by line**

- Taking the sign first means the maths only deals with positive numbers, avoiding `%` surprises with negatives.
- `Math.floor(abs / 100)` and `abs % 100` split pence into pounds and remainder exactly, since both are integers.
- The regular expression inserts a comma at every position followed by groups of exactly three digits to the end (regular expressions are in Part 3); `toLocaleString("en-GB")` is the everyday alternative.
- `padStart(2, "0")` turns 5 into `"05"`.

**Trace:** −305 → sign "-", abs 305 → 3 pounds, 5 pence → "-£3.05".

**Common wrong approach:** `"£" + pence / 100`, which prints `£12.5` for 1250 and `£0.05` only by luck. In real apps, `new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100)` formats safely for display.

</details>

## Quick quiz

1. Why should you avoid comparing decimals with ===?
   - A) Most decimals aren't stored exactly, so tiny rounding errors appear
   - B) === doesn't work on numbers
   - C) Decimals are strings in JavaScript

2. What type does (1.5).toFixed(1) return?
   - A) number
   - B) bigint
   - C) string

3. What is -7 % 3 in JavaScript?
   - A) 2
   - B) -1
   - C) 1

4. Why store money as whole pence or cents?
   - A) JavaScript can't store decimals
   - B) Integers are exact, so sums don't pick up rounding errors
   - C) It uses less memory

<details>
<summary>Quiz answers</summary>

1. **A) Most decimals aren't stored exactly, so tiny rounding errors appear**: Compare with a tolerance instead.
2. **C) string**: toFixed is for display; it returns text.
3. **B) -1**: The remainder takes the sign of the left-hand number.
4. **B) Integers are exact, so sums don't pick up rounding errors**: Convert to pounds only when displaying.

</details>

---
Previous: [Lesson 3](03-strings.md) · Next: [Lesson 5: Comparisons and conditions](05-conditions.md)
