# Lesson 18: Errors and error handling

**You'll learn:** throwing and the call stack, built-in error types, throw, try, catch and finally, catching only what you can handle and rethrowing, custom error classes with extra fields, error causes, errors as values, AggregateError, Error.isError, validating input, logging errors safely.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#errors)**: run every example and check your exercise answers.

## Key terms

- **Exception:** an error that's thrown and interrupts normal execution until caught.
- **Call stack:** the chain of function calls currently running; errors travel up it.
- **`try` / `catch`:** run code, and handle any error it throws.
- **`finally`:** a block that always runs after `try` and `catch`, for clean-up.
- **Rethrow:** throwing a caught error again so it keeps propagating.
- **Custom error:** a class extending `Error` to name a kind of failure and carry extra data.
- **Error cause:** the original error kept inside a newer, more descriptive one.
- **`AggregateError`:** an error holding a list of several errors.

When something goes wrong, JavaScript **throws** an error: normal execution stops, and the error travels up through the functions that called each other (the **call stack**) until something **catches** it. If nothing does, the program stops (or, in a browser, that piece of code stops and the error appears in the console).

## Built-in error types

| Type | Thrown when… |
|---|---|
| `SyntaxError` | the code (or `JSON.parse` input) can't be read |
| `ReferenceError` | a name doesn't exist |
| `TypeError` | a value is the wrong type: calling `undefined`, reading a property of `null` |
| `RangeError` | a number is out of range; the stack overflows |
| `Error` | the general type; the base of all the others |

Every error has a `name`, a `message` and a `stack` (the chain of calls that led to it).

## throw, try, catch, finally

```js
function parsePercent(text) {
  const n = Number(text);
  if (Number.isNaN(n) || n < 0 || n > 100) {
    throw new RangeError(`not a percentage: ${text}`);     // stop and report
  }
  return n / 100;
}

for (const input of ["20", "abc", "150"]) {
  try {
    console.log(input, "→", parsePercent(input));
  } catch (error) {
    console.log(input, "→", `${error.name}: ${error.message}`);
  } finally {
    console.log("  (finally always runs)");
  }
}
```

- Code in `try` runs until something throws; then control jumps to `catch`, which receives the error.
- `finally` runs whether or not there was an error, even after a `return`: use it for clean-up (closing a file, hiding a spinner).
- You can `throw` any value, but always throw `Error` objects (or subclasses): only they carry a stack trace.

## Catch only what you can handle

A `catch` that swallows every error hides bugs. Catch the errors you expect, and **rethrow** the rest:

```js
function loadSettings(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.log("Bad settings file; using defaults");
      return { theme: "light" };
    }
    throw error;                         // not what we expected: let it propagate
  }
}
console.log(loadSettings('{"theme": "dark"}'), loadSettings("{oops"));
```

## Custom error classes

Your own error types make failures easier to recognise and carry extra information:

```js
class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.name = "ValidationError";      // shows in messages and stack traces
    this.field = field;                  // extra data for whoever catches it
  }
}

function checkEmail(email) {
  if (!email.includes("@")) throw new ValidationError("email", "an email needs an @");
  return email;
}

try {
  checkEmail("ada.example.com");
} catch (e) {
  if (e instanceof ValidationError) console.log(`Problem with ${e.field}: ${e.message}`);
  else throw e;
}
```

## Wrapping errors with a cause

When you catch a low-level error and throw a more meaningful one, keep the original as the **cause** so nothing is lost:

```js
function readConfig(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error("Couldn't read the config file", { cause: error });
  }
}
try {
  readConfig("{bad json");
} catch (e) {
  console.log(e.message, "←", e.cause.name);
}
```

## Errors as values

Throwing isn't the only style. For failures that are **expected** (a form field is invalid, a search finds nothing), returning a result is often clearer than an exception, as in Lesson 14's `safeParse`:

```js
function divide(a, b) {
  return b === 0 ? { ok: false, error: "division by zero" } : { ok: true, value: a / b };
}
const r = divide(10, 0);
console.log(r.ok ? r.value : `failed: ${r.error}`);
```

A good rule: **throw for bugs and truly exceptional situations; return results for outcomes the caller should always consider.**

## Several errors at once

`AggregateError` holds a list of errors, for operations that try several things (it's what `Promise.any` throws when every promise fails, Part 4). And `Error.isError(value)` (new in ECMAScript 2026, not yet in every browser) reliably tells whether a value is an error, even one created in another frame or window, where `instanceof Error` can be fooled.

## What to log

When you catch an error you can't fix, log enough to debug it: the message, the stack, the cause, and what the program was doing (which order, which user action), but never passwords, tokens or other secrets. In production, error-tracking services such as Sentry collect these automatically.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Handle a failure | try { … } catch (e) { if (expected) … else throw e } | O(1) | O(1) |
| Name a failure | class MyError extends Error { constructor(…) { super(msg) } } | O(1) | O(1) |
| Fallbacks | try each option; collect errors; AggregateError if all fail | O(options) | O(options) |

## Common mistakes

- Catching every error and ignoring it.
- Throwing strings instead of Error objects.
- Losing the original error when wrapping it (no `cause`).
- Using exceptions for ordinary, expected outcomes.
- Logging secrets such as passwords or tokens with errors.

## Exercises

### 1. A validation error

Write a class `ValidationError` extending `Error`, with `name` set to `"ValidationError"` and a `field` property. Then write `validateSignup({ email, age })` that throws a `ValidationError`:

- for `field` `"email"` with message `"email must contain @"` if `email` isn't a string containing `@`;
- for `field` `"age"` with message `"age must be 13 or over"` if `age` isn't an integer of at least 13.

Check the email first. If both are fine, return `true`.

Starter code:

```js
class ValidationError extends Error {
  // your code here
}

function validateSignup({ email, age }) {
  // your code here
}

try {
  validateSignup({ email: "ada@example.com", age: 9 });
} catch (e) {
  console.log(e.name, e.field, e.message);   // ValidationError age age must be 13 or over
}
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a custom error type carrying the failing field, thrown by a validator.
2. **Examples:** age "20" is a string, so it fails the integer check.
3. **Brute force:** throwing plain `Error`s with the field in the message text: callers would have to parse messages.
4. **Pattern:** **custom error subclass + guard clauses**.
5. **Plan:** class (super, name, field) → email check → age check → true.
6. **Code and test:** each failure, order of checks, wrong types.

</details>

<details>
<summary>💡 Hint 1</summary>

The class needs a constructor taking `(field, message)` that calls `super(message)` first, then sets `this.name` and `this.field`.

</details>

<details>
<summary>💡 Hint 2</summary>

In `validateSignup`, check the email with `typeof email !== "string" || !email.includes("@")`.

</details>

<details>
<summary>💡 Hint 3</summary>

`Number.isInteger(age) && age >= 13` is the valid age; throw `new ValidationError("age", "age must be 13 or over")` otherwise.

</details>

### 2. Try each option in turn

Write `firstSuccess(functions)` that calls each function in order and returns the first result that doesn't throw. If every function throws, throw an `AggregateError` containing all their errors (in order), with the message `"all options failed"`. With an empty list, throw that `AggregateError` with an empty errors list.

Starter code:

```js
function firstSuccess(functions) {
  // your code here
}

const loadFromCache = () => { throw new Error("cache empty"); };
const loadFromServer = () => "fresh data";
console.log(firstSuccess([loadFromCache, loadFromServer]));   // fresh data
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** fallbacks in order; stop at the first success; report every failure if none succeed.
2. **Examples:** cache fails, server succeeds → "fresh data", and later functions never run.
3. **Brute force:** nested try / catch blocks for a fixed number of options: doesn't scale.
4. **Pattern:** **fallback chain with collected errors**.
5. **Plan:** errors list → loop with try { return } catch { push } → throw AggregateError.
6. **Code and test:** first succeeds, later succeeds, falsy results, all fail, empty list.

</details>

<details>
<summary>💡 Hint 1</summary>

Loop over the functions with a `try` around each call. Returning from inside `try` ends the whole function straight away.

</details>

<details>
<summary>💡 Hint 2</summary>

In `catch`, push the error into a list and carry on with the next function.

</details>

<details>
<summary>💡 Hint 3</summary>

After the loop, `throw new AggregateError(errors, "all options failed");`.

</details>

**In the sandbox:** exercises 35–36. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. A validation error</summary>

```js
class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

function validateSignup({ email, age }) {
  if (typeof email !== "string" || !email.includes("@")) {
    throw new ValidationError("email", "email must contain @");
  }
  if (!Number.isInteger(age) || age < 13) {
    throw new ValidationError("age", "age must be 13 or over");
  }
  return true;
}

try {
  validateSignup({ email: "ada@example.com", age: 9 });
} catch (e) {
  console.log(e.name, e.field, e.message);
}
```

**Line by line**

- `super(message)` sets the message and captures the stack trace; it must come before `this`.
- Setting `this.name` makes logs show "ValidationError" instead of "Error".
- The destructured parameter `{ email, age }` reads the two fields from the object passed in.
- Checking `typeof` first stops `42.includes` from throwing a `TypeError` of its own.

**Trace:** `{ email: "nope", age: 5 }` → the email check fails first → field "email".

**Common wrong approach:** `throw "invalid age"` (a string). Strings have no stack trace and no fields, and `catch (e) { e.field }` can't work. Always throw Error objects.

</details>

<details>
<summary>✅ 2. Try each option in turn</summary>

```js
function firstSuccess(functions) {
  const errors = [];
  for (const fn of functions) {
    try {
      return fn();
    } catch (error) {
      errors.push(error);
    }
  }
  throw new AggregateError(errors, "all options failed");
}

const loadFromCache = () => { throw new Error("cache empty"); };
const loadFromServer = () => "fresh data";
console.log(firstSuccess([loadFromCache, loadFromServer]));
```

**Line by line**

- `return fn()` inside `try` leaves the function immediately when a call succeeds, so later options never run.
- Each failure is collected rather than discarded, so the final error explains everything that went wrong.
- `new AggregateError(errors, message)` takes the list first, then the message; its `errors` property holds the list.
- An empty list skips the loop and throws with no errors, a clear signal that there were no options.

**Trace:** cache throws → errors [cache empty] → server returns "fresh data" → returned.

**Common wrong approach:** checking `if (result)` to decide success, which treats a legitimate result of `0`, `""` or `false` as failure. Success means "didn't throw". (`Promise.any` is the async version of this pattern, Part 4.)

</details>

## Quick quiz

1. When does a finally block run?
   - A) Always: after try finishes, after catch, even after a return
   - B) Only when an error was thrown
   - C) Only when no error was thrown

2. Why rethrow errors you don't recognise in a catch block?
   - A) Swallowing unexpected errors hides bugs
   - B) JavaScript requires every catch to rethrow
   - C) It makes the code faster

3. What does new Error("Couldn't save", { cause: err }) do?
   - A) Creates a new error that keeps the original error as its cause
   - B) Throws err immediately
   - C) Merges the two messages

4. Why throw Error objects rather than strings?
   - A) Error objects carry a name, message and stack trace
   - B) Strings can't be thrown
   - C) Strings are slower

<details>
<summary>Quiz answers</summary>

1. **A) Always: after try finishes, after catch, even after a return**: Use it for clean-up.
2. **A) Swallowing unexpected errors hides bugs**: Handle what you expect; let the rest propagate.
3. **A) Creates a new error that keeps the original error as its cause**: Causes preserve the low-level detail.
4. **A) Error objects carry a name, message and stack trace**: throw "oops" works but loses the stack.

</details>

---
Previous: [Lesson 17](17-modules.md) · Next: [Lesson 19: Iterators and generators](19-iterators-and-generators.md)
