# Lesson 6: Loops

**You'll learn:** for…of over arrays and strings, the classic for loop, while and do…while, break and continue, for…in over object keys, accumulators, running maximums, nested loops, off-by-one errors, endless loops and how to avoid them.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#loops)**: run every example and check your exercise answers.

## Key terms

- **Loop:** code that repeats a block while a condition holds or for each item.
- **Iterable:** a value `for…of` can loop over, such as an array, string, Map or Set.
- **Accumulator:** a variable that builds up a result as a loop runs.
- **`break`:** ends a loop immediately.
- **`continue`:** skips the rest of the current pass and starts the next.
- **Off-by-one error:** a loop that runs one time too many or too few.
- **Infinite loop:** a loop whose condition never becomes false.

A **loop** repeats a block of code. JavaScript has several kinds; you'll mostly use `for…of` and the classic `for`.

## for…of: each value

```js
const parts = ["frame", "wheels", "saddle"];
for (const part of parts) {
  console.log(`Checking the ${part}`);
}
for (const ch of "hey") {
  console.log(ch);
}
```

`for…of` works on anything **iterable**: arrays, strings, Maps, Sets and more (Part 3). Use `const` for the loop variable unless you reassign it inside the loop.

## The classic for loop: counting

```js
for (let i = 0; i < 5; i++) {
  console.log("i is", i);
}
for (let i = 10; i > 0; i -= 3) {
  console.log("countdown", i);
}
```

The three parts in the brackets are: start (`let i = 0`), keep going while (`i < 5`), and step (`i++`, run after each pass). Use it when you need the position, a different step, or to go backwards.

## while and do…while

```js
let balance = 100;
let years = 0;
while (balance < 200) {
  balance *= 1.07;      // 7% growth a year
  years++;
}
console.log(`Doubles after ${years} years: £${balance.toFixed(2)}`);

let tries = 0;
do {
  tries++;
} while (tries < 0);    // the body runs once even though the condition is false
console.log("tries:", tries);
```

Use `while` when you don't know in advance how many passes you need. Make sure something in the body moves towards the end: a loop whose condition never becomes false runs forever (press **Stop**).

## break and continue

```js
const temps = [12, 15, -3, 18, 99, 20];
for (const t of temps) {
  if (t < 0) continue;       // skip this value, go on with the next
  if (t > 50) break;         // stop the loop entirely
  console.log(t);
}
```

## for…in: an object's keys

```js
const stock = { tubes: 12, tyres: 4, bells: 0 };
for (const item in stock) {
  console.log(item, stock[item]);
}
```

`for…in` loops over an object's **keys**. Don't use it on arrays: it gives the indexes as strings and can include extra properties. For arrays use `for…of`; for objects, `Object.entries` (Part 2) is often clearer.

## Accumulators

Many loops build a result step by step in an **accumulator** variable:

```js
const prices = [6, 12.5, 30];
let total = 0;
let most = -Infinity;
for (const p of prices) {
  total += p;
  if (p > most) most = p;
}
console.log("total", total, "most expensive", most);
```

Part 2 shows array methods (`reduce`, `map`, `filter`) that express many such loops in one line. Loops remain clearer when the logic has several steps or needs `break`.

## Off-by-one errors

The most common loop bug is running one time too many or too few. With `for (let i = 0; i < n; i++)`, `i` goes from `0` to `n − 1`, which is exactly the valid indexes of an array of length `n`. Writing `i <= n` reads one past the end (and gives `undefined`, not an error).

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Each value | for (const x of items) | O(n) | O(1) |
| Each index | for (let i = 0; i < n; i++) | O(n) | O(1) |
| Unknown number of steps | while (condition) with progress in the body | O(steps) | O(1) |
| Object keys | for (const key in obj), or Object.entries | O(keys) | O(1) |

## Common mistakes

- Using `for…in` on arrays (it gives string indexes).
- Writing `i <= arr.length` and reading past the end.
- Forgetting to update the variable a `while` condition depends on.
- Declaring the loop variable with `var` (closures then share it).
- Resetting the accumulator inside the loop.

## Exercises

### 1. Count the vowels

Write `countVowels(text)` returning how many vowels (`a`, `e`, `i`, `o`, `u`, in either case) the text contains.

Starter code:

```js
function countVowels(text) {
  // your code here
}

console.log(countVowels("Spoke & Chain"), countVowels("RHYTHM"), countVowels(""));
// 4 0 0
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** count characters that are vowels, ignoring case.
2. **Examples:** "Spoke & Chain" → o, e, a, i = 4.
3. **Brute force:** five separate counts, one per vowel: works, more code.
4. **Pattern:** **accumulator loop with a membership test**.
5. **Plan:** counter = 0 → loop over lower-cased characters → add 1 for each vowel.
6. **Code and test:** upper case, empty text, no vowels, punctuation.

</details>

<details>
<summary>💡 Hint 1</summary>

Loop over the characters with `for (const ch of text)`, and keep a counter.

</details>

<details>
<summary>💡 Hint 2</summary>

Lower-case the text first, so you only need to check five letters.

</details>

<details>
<summary>💡 Hint 3</summary>

`if ("aeiou".includes(ch)) count++;`

</details>

### 2. How many years to a target?

Savings grow by `rate` per year (0.05 means 5%), compounded yearly. Write `yearsToTarget(start, rate, target)` returning how many **whole years** it takes for the balance to reach at least `target`. If `start` already reaches the target, return `0`. If the balance can never reach it (`rate <= 0` and `start < target`), return `-1` instead of looping forever.

Starter code:

```js
function yearsToTarget(start, rate, target) {
  // your code here
}

console.log(yearsToTarget(100, 0.07, 200), yearsToTarget(500, 0.05, 400), yearsToTarget(100, 0, 200));
// 11 0 -1
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** repeat a growth step until a condition holds, counting the steps; guard against endless loops.
2. **Examples:** 100 at 7%: 107, 114.49, … reaches 200 after 11 years (196.72 after 10).
3. **Brute force:** loop up to a large fixed number of years: hides the "never" case.
4. **Pattern:** **while loop with a counter and guard clauses**.
5. **Plan:** start ≥ target → 0; rate ≤ 0 → −1; loop.
6. **Code and test:** already there, no growth, shrinking, exact boundaries.

</details>

<details>
<summary>💡 Hint 1</summary>

You don't know the number of years in advance, so use a `while` loop that runs while the balance is below the target.

</details>

<details>
<summary>💡 Hint 2</summary>

Handle the two special cases before the loop: already at the target (0), and a rate of 0 or less (−1).

</details>

<details>
<summary>💡 Hint 3</summary>

Each pass: `balance *= 1 + rate; years++;`. Compare with a tiny allowance (`balance < target - 1e-9`), because 100 × 1.1 is 110.00000000000001… or sometimes just under.

</details>

**In the sandbox:** exercises 11–12. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Count the vowels</summary>

```js
function countVowels(text) {
  let count = 0;
  for (const ch of text.toLowerCase()) {
    if ("aeiou".includes(ch)) count++;
  }
  return count;
}

console.log(countVowels("Spoke & Chain"), countVowels("RHYTHM"), countVowels(""));
```

**Line by line**

- `text.toLowerCase()` once, before the loop, rather than for every character.
- `for…of` over a string gives one character per pass.
- `"aeiou".includes(ch)` asks whether the character is one of the five vowels.

**Trace:** "RHYTHM" → "rhythm" → no character is in "aeiou" → 0.

**Common wrong approach:** `for (let i = 0; i <= text.length; i++)`, which reads `text[text.length]`, an `undefined` one past the end. Here `"aeiou".includes(undefined)` happens to be false, which hides the bug; in other loops it causes errors.

</details>

<details>
<summary>✅ 2. How many years to a target?</summary>

```js
function yearsToTarget(start, rate, target) {
  if (start >= target) return 0;
  if (rate <= 0) return -1;            // it would never get there
  let balance = start;
  let years = 0;
  while (balance < target - 1e-9) {     // a tiny allowance for floating-point rounding
    balance *= 1 + rate;
    years++;
  }
  return years;
}

console.log(yearsToTarget(100, 0.07, 200), yearsToTarget(500, 0.05, 400), yearsToTarget(100, 0, 200));
```

**Line by line**

- The first guard returns 0 without looping when there's nothing to do.
- The second guard is what prevents an endless loop: with no growth, `balance < target` would stay true forever.
- `balance *= 1 + rate` applies one year's growth; `years++` counts it.
- The `- 1e-9` allowance means a balance that should equal the target exactly (110 after one year at 10%) isn't missed because of a rounding error in the last decimal place.

**Trace:** (1, 1, 1024) → balance doubles: 2, 4, …, 1024 after 10 passes → 10.

**Common wrong approach:** no guard for `rate <= 0`. The loop runs forever and the page (or here, the sandbox) hangs. Every `while` loop needs a reason to be sure it ends.

</details>

## Quick quiz

1. Which loop is the simplest way to visit every item of an array?
   - A) do … while
   - B) for (const item of items)
   - C) for (const item in items)

2. With for (let i = 0; i < arr.length; i++), what is the last value of i inside the loop?
   - A) arr.length
   - B) arr.length + 1
   - C) arr.length - 1

3. What does continue do?
   - A) Restarts the loop from the beginning
   - B) Ends the loop
   - C) Skips the rest of this pass and moves to the next one

4. What must every while loop have?
   - A) A counter called i
   - B) A break statement
   - C) Something in the body that eventually makes the condition false

<details>
<summary>Quiz answers</summary>

1. **B) for (const item of items)**: for…in gives keys (indexes as strings), not values.
2. **C) arr.length - 1**: Exactly the last valid index.
3. **C) Skips the rest of this pass and moves to the next one**: break ends the loop; continue skips one pass.
4. **C) Something in the body that eventually makes the condition false**: Otherwise it runs forever.

</details>

---
Previous: [Lesson 5](05-conditions.md) · Next: [Lesson 7: Functions](07-functions.md)
