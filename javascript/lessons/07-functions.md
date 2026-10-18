# Lesson 7: Functions

**You'll learn:** function declarations, function expressions, arrow functions and implicit return, parameters and arguments, return and undefined, default parameters, rest parameters and spread, hoisting, functions as values, callbacks, higher-order functions, throwing errors for bad input, writing small single-purpose functions.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#functions)**: run every example and check your exercise answers.

## Key terms

- **Function:** a reusable block of code that can take inputs and return a result.
- **Parameter / argument:** the name in the definition, and the value passed in a call.
- **Arrow function:** a short function syntax, `(x) => x * 2`, which returns the expression automatically.
- **Default parameter:** a value used when an argument is missing or `undefined`.
- **Rest parameter:** `...name`, collecting the remaining arguments into an array.
- **Spread syntax:** `...array`, expanding an array into separate values.
- **Hoisting:** function declarations can be called before their line in the code.
- **Callback:** a function passed to another function, to be called by it.
- **Higher-order function:** a function that takes or returns another function.

A **function** is a named, reusable block of code. You give it inputs (**parameters**), it does some work, and it can **return** a result.

## Three ways to write a function

```js
// 1. A function declaration
function vatOf(net) {
  return net * 0.2;
}

// 2. A function expression stored in a const
const withVat = function (net) {
  return net + vatOf(net);
};

// 3. An arrow function: shorter, and common for small functions
const formatPrice = (amount) => `£${amount.toFixed(2)}`;

console.log(vatOf(50), withVat(50), formatPrice(withVat(50)));
```

Arrow functions have a short form: with a single expression and no braces, the value is returned automatically. With braces you need `return`:

```js
const double = (n) => n * 2;          // returns n * 2
const triple = (n) => { n * 3; };     // braces and no return: returns undefined!
const square = (n) => { return n * n; };
console.log(double(4), triple(4), square(4));
```

Arrow functions also treat `this` differently (Part 3); for now, use declarations for named, top-level functions and arrows for short callbacks.

## Parameters, arguments and return

```js
function greet(name, greeting = "Hello") {      // a default value
  return `${greeting}, ${name}!`;
}
console.log(greet("Ada"));
console.log(greet("Grace", "Welcome"));
console.log(greet());                          // a missing argument is undefined
function noReturn() {}
console.log(noReturn());                       // no return statement gives undefined
```

- JavaScript doesn't check the number of arguments: missing ones are `undefined`, extra ones are ignored.
- A **default parameter** is used when the argument is missing or `undefined` (but not when it's `null`).
- `return` ends the function immediately.

## Any number of arguments: rest and spread

```js
function total(...prices) {        // rest parameter: collects the arguments into an array
  let sum = 0;
  for (const p of prices) sum += p;
  return sum;
}
console.log(total(), total(5), total(5, 10, 2.5));

const basket = [6, 12, 30];
console.log(total(...basket));     // spread: turns an array into separate arguments
console.log(Math.max(...basket));
```

## Hoisting

Function **declarations** are **hoisted**: you can call them before the line where they appear. Function expressions and arrow functions stored in `const` or `let` can't be used before their line.

*This example raises an error on purpose.*

```js
console.log(early(2));            // works: declarations are hoisted
function early(n) { return n + 1; }

console.log(late(2));             // ReferenceError: can't use before initialisation
const late = (n) => n + 1;
```

## Functions are values

Functions can be stored in variables, put in arrays and objects, passed to other functions and returned from them. A function passed to another function is a **callback**; a function that takes or returns functions is a **higher-order function**.

```js
function applyTwice(fn, value) {
  return fn(fn(value));
}
const addTen = (n) => n + 10;
console.log(applyTwice(addTen, 1));
console.log(applyTwice((s) => s + "!", "Hi"));

const prices = [12, 5, 30];
console.log(prices.map((p) => p * 2));          // map calls the callback for every item (Part 2)
setTimeout(() => console.log("a callback, run later"), 10);
```

## Good functions

- **Do one thing**, and name it with a verb for what it does: `calculateTotal`, `formatPrice`, `isValidEmail`.
- **Return values** instead of printing them; the caller decides what to do with the result (and tests can check it).
- Keep them **short**: if you need a comment to explain a section, it may want to be its own function.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Short function | const f = (x) => expression | O(1) | O(1) |
| Any number of arguments | function f(...args) | O(n) | O(n) |
| Array as arguments | f(...array) | O(n) | O(n) |
| Pass behaviour in | callback parameter, called as fn(value) | O(1) per call | O(1) |

## Common mistakes

- Using braces in an arrow function and forgetting `return`.
- Printing a result instead of returning it.
- Pushing or passing `fn` when you meant to call `fn()`.
- Calling a `const` arrow function before its line.
- Expecting a default parameter to replace `null`.

## Exercises

### 1. A discount calculator

Write `applyDiscount(price, percent = 10)` returning the price after taking off `percent` per cent, **rounded to 2 decimal places**. If `percent` is outside 0–100, throw a `RangeError` with any message (`throw new RangeError("…")`).

Starter code:

```js
function applyDiscount(price, percent = 10) {
  // your code here
}

console.log(applyDiscount(50), applyDiscount(19.99, 25), applyDiscount(80, 0));
// 45 14.99 80
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** validate the percentage, apply it, round to pence.
2. **Examples:** 19.99 × 0.75 = 14.9925 → 14.99.
3. **Brute force:** `toFixed(2)` returns text, so the result wouldn't be a number.
4. **Pattern:** **guard clause + calculation + rounding**.
5. **Plan:** check range → multiply by (1 − p/100) → round.
6. **Code and test:** default, 0%, 100%, rounding cases, invalid percentages.

</details>

<details>
<summary>💡 Hint 1</summary>

A default parameter is written `percent = 10` in the parameter list, so you only handle the calculation.

</details>

<details>
<summary>💡 Hint 2</summary>

To round to 2 decimal places as a number: `Math.round(x * 100) / 100` (`toFixed` would return a string).

</details>

<details>
<summary>💡 Hint 3</summary>

Before calculating: `if (percent < 0 || percent > 100) throw new RangeError("…");`

</details>

### 2. Run a function n times

Write `repeatCall(fn, times)` that calls `fn` the given number of times, passing the call number (starting at 1) each time, and returns an **array of the results**. `times` of 0 or less gives `[]`.

Starter code:

```js
function repeatCall(fn, times) {
  // your code here
}

console.log(repeatCall((n) => n * n, 4));       // [ 1, 4, 9, 16 ]
console.log(repeatCall(() => "hi", 2));         // [ 'hi', 'hi' ]
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** call a passed-in function repeatedly and collect what it returns.
2. **Examples:** n × n for n = 1…4 → [1, 4, 9, 16].
3. **Brute force:** this is already one loop.
4. **Pattern:** **higher-order function**: a function that receives another function.
5. **Plan:** empty array → loop 1…times → push fn(i) → return.
6. **Code and test:** zero, negative, functions that ignore the argument, count the calls.

</details>

<details>
<summary>💡 Hint 1</summary>

`fn` is a function like any other: call it with `fn(i)`.

</details>

<details>
<summary>💡 Hint 2</summary>

Start with an empty array, and add each result with `results.push(value)`.

</details>

<details>
<summary>💡 Hint 3</summary>

`for (let i = 1; i <= times; i++) results.push(fn(i));` — when `times` is 0 or negative, the loop doesn't run at all.

</details>

**In the sandbox:** exercises 13–14. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. A discount calculator</summary>

```js
function applyDiscount(price, percent = 10) {
  if (percent < 0 || percent > 100) {
    throw new RangeError(`percent must be between 0 and 100, not ${percent}`);
  }
  const discounted = price * (1 - percent / 100);
  return Math.round(discounted * 100) / 100;
}

console.log(applyDiscount(50), applyDiscount(19.99, 25), applyDiscount(80, 0));
```

**Line by line**

- The default parameter supplies 10 when the caller passes only a price.
- `throw new RangeError(...)` stops the function and signals bad input; Part 3 shows how callers can catch it.
- `price * (1 - percent / 100)` keeps the calculation in one step.
- `Math.round(x * 100) / 100` rounds to the nearest hundredth and stays a number.

**Trace:** `applyDiscount(9.99, 33)` → 9.99 × 0.67 = 6.6933 → 669.33 → 669 → 6.69.

**Common wrong approach:** printing the result with `console.log` instead of returning it: the function then returns `undefined`, and nothing else can use the value. (In real shops, prices are kept in whole pence to avoid rounding drift: Lesson 4.)

</details>

<details>
<summary>✅ 2. Run a function n times</summary>

```js
function repeatCall(fn, times) {
  const results = [];
  for (let i = 1; i <= times; i++) {
    results.push(fn(i));
  }
  return results;
}

console.log(repeatCall((n) => n * n, 4));
console.log(repeatCall(() => "hi", 2));
```

**Line by line**

- `fn` is just a parameter whose value happens to be a function, so `fn(i)` calls it.
- The loop starts at 1 because the call numbers start at 1; `i <= times` includes the last call.
- For `times` ≤ 0 the condition is false at once, so the empty array comes back without a special case.

**Trace:** `repeatCall((n) => n * n, 4)` → i = 1, 2, 3, 4 → push 1, 4, 9, 16.

**Common wrong approach:** `results.push(fn)`, which stores the function itself four times instead of calling it. The parentheses are what make a call.

</details>

## Quick quiz

1. What does const f = (n) => { n * 2; }; return?
   - A) n * 2
   - B) An error
   - C) undefined, because braces need an explicit return

2. A function is called with fewer arguments than it has parameters. What happens?
   - A) The missing parameters are undefined (or their default value)
   - B) JavaScript refuses to run the code
   - C) A TypeError is thrown

3. Which can be called before the line where it's defined?
   - A) let f = function () {}
   - B) const f = () => {}
   - C) A function declaration: function f() {}

4. What does ...prices in a parameter list do?
   - A) Makes the parameter optional
   - B) Collects the remaining arguments into an array
   - C) Copies an object

<details>
<summary>Quiz answers</summary>

1. **C) undefined, because braces need an explicit return**: Without braces, (n) => n * 2 returns the value.
2. **A) The missing parameters are undefined (or their default value)**: JavaScript doesn't check argument counts.
3. **C) A function declaration: function f() {}**: Declarations are hoisted.
4. **B) Collects the remaining arguments into an array**: Rest parameters gather arguments; spread does the opposite.

</details>

---
Previous: [Lesson 6](06-loops.md) · Next: [Lesson 8: Scope and closures](08-scope-and-closures.md)
