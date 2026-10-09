# Lesson 39: Testing your code

**You'll learn:** why automated tests, unit, integration and end-to-end tests, the test pyramid, node:test and node --test, node:assert/strict, test, describe and it, equal, deepEqual, ok, match, throws and rejects, async tests, arrange-act-assert, choosing test cases and edge cases, testing behaviour not implementation, mutation testing, dependency injection, test doubles, mock functions and fake timers, Vitest, Jest and Playwright, coverage, test-driven development.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#testing)**: run every example and check your exercise answers.

## Key terms

- **Automated test:** code that runs other code with known inputs and checks the results.
- **Unit test:** a test of one function or module on its own.
- **Integration test:** a test of several parts working together.
- **End-to-end test:** a test of the whole app through its real interface, often a browser.
- **Assertion:** a check that throws if a condition isn't met, failing the test.
- **Edge case:** an input at the limits of what's allowed, like empty, zero or the maximum.
- **Test double:** a stand-in for a real dependency in a test, such as a fake clock or a mock function.
- **Dependency injection:** passing a function its dependencies, so tests can pass fakes.
- **Code coverage:** the share of code lines (or branches) that ran during the tests.
- **Test-driven development (TDD):** writing a failing test first, then the code to pass it, then refactoring.

You've been checking exercises with hidden tests all course. Now you'll write your own. An **automated test** is code that runs your code with known inputs and checks the results, so that every change can be checked in seconds, by you and by CI, instead of by clicking around.

## Kinds of tests

| Kind | Tests | Speed | Example |
|---|---|---|---|
| **unit** | one function or module, alone | milliseconds | `slugify("Hello World")` returns `"hello-world"` |
| **integration** | several parts together | seconds | the API handler with a real database |
| **end-to-end** | the whole app, through a real browser | slower | log in, add to cart, check out |

Most tests should be unit tests (fast and precise), with fewer integration tests and a handful of end-to-end tests for the most important journeys: the **test pyramid**.

## node:test

Node.js has a built-in test runner. A test file:

```js
// slugify.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "./slugify.js";

test("lower-cases and joins words with -", () => {
  assert.equal(slugify("Hello World"), "hello-world");
});
```

```bash
node --test          # finds and runs *.test.js files (and others matching the default patterns)
```

**In this sandbox, `test`, `describe`, `it` and `assert` are already available**, so the examples leave out the two `import` lines. They print like Node.js: ✔ for a pass, ✖ and the reason for a failure, then a summary.

```js
function pounds(pence) {
  return `£${(pence / 100).toFixed(2)}`;
}

test("formats whole pounds", () => {
  assert.equal(pounds(800), "£8.00");
});

test("formats pence", () => {
  assert.equal(pounds(450), "£4.50");
});

test("formats zero", () => {
  assert.equal(pounds(0), "£0.00");
});
```

A failing test shows what was expected and what came back:

*This example raises an error on purpose.*

```js
function total(items) {
  return items.reduce((sum, item) => sum + item.price, 0);      // bug: ignores qty
}

test("adds price × qty", () => {
  assert.equal(total([{ price: 600, qty: 2 }, { price: 800, qty: 1 }]), 2000);
});
```

## Assertions

`node:assert/strict` throws an `AssertionError` when a check fails, which fails the test:

| Assertion | Passes when |
|---|---|
| `assert.equal(actual, expected)` | they're identical (`Object.is`, like `===`) |
| `assert.deepEqual(actual, expected)` | objects or arrays have equal contents |
| `assert.ok(value)` | the value is truthy |
| `assert.match(text, /regex/)` | the text matches |
| `assert.throws(() => fn(), expected)` | calling the function throws (optionally a matching error) |
| `await assert.rejects(promise, expected)` | the promise rejects |
| `assert.notEqual`, `assert.notDeepEqual` | the opposites |

```js
function parseQty(text) {
  const n = Number(text);
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`Not a quantity: ${text}`);
  return n;
}

describe("parseQty", () => {
  it("parses whole numbers", () => {
    assert.equal(parseQty("3"), 3);
  });
  it("rejects fractions with a RangeError", () => {
    assert.throws(() => parseQty("2.5"), RangeError);
  });
  it("explains the problem", () => {
    assert.throws(() => parseQty("lots"), /Not a quantity: lots/);
  });
  it("returns new objects with equal contents", () => {
    assert.deepEqual([1, 2].map((x) => x * 2), [2, 4]);     // equal would fail: two different arrays
  });
});
```

## Async tests

Make the test function `async` and `await` inside it. The test waits, and a rejection fails it:

```js
async function getProduct(id) {
  const res = await fetch(`https://shop.example/api/products/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

test("loads a product", async () => {
  const bell = await getProduct(2);
  assert.equal(bell.name, "Bell");
});

test("fails for a missing product", async () => {
  await assert.rejects(getProduct(99), /HTTP 404/);
});
```

Forgetting `await` before `assert.rejects` (or before the code under test) is a classic bug: the test finishes before the check runs, and passes no matter what.

## What makes a good test

- **Arrange, act, assert:** set up the input, call the code once, check the result.
- **One behaviour per test**, with a name that reads like a requirement: "rejects fractions", not "test 3".
- **Choose cases deliberately:** a normal case, the edges (empty, zero, one item, the largest allowed), and invalid input.
- **Test behaviour, not implementation:** check what the function returns or does, not how; then you can rewrite its insides and the tests still help.
- **Keep tests independent:** no test should rely on another running first.

A test suite is only as good as the bugs it would catch. A useful way to judge one is to break the code on purpose and see if a test fails, which is exactly what the first exercise checks (this is called **mutation testing**).

## Test doubles

Code that depends on the clock, the network or randomness is hard to test. The fix is to pass those dependencies in (**dependency injection**), so a test can pass a fake:

```js
function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

test("morning before noon", () => {
  assert.equal(greeting(new Date(2026, 9, 9, 9, 30)), "Good morning");
});
test("evening from 18:00", () => {
  assert.equal(greeting(new Date(2026, 9, 9, 18, 0)), "Good evening");
});
```

`node:test` also has `mock.fn()` (a function that records its calls), `mock.method(object, "name")` and fake timers (`mock.timers.enable()`) for code using `setTimeout`.

## Other test tools

- **Vitest** is the usual choice for projects built with Vite: the same `describe` and `it`, with `expect(value).toBe(…)` assertions, a fast watch mode, and since Vitest 4 (October 2025) a stable **browser mode** for testing components in a real browser. **Jest** is its older, still widespread predecessor with the same style.
- **Playwright** drives real browsers (Chromium, Firefox, WebKit) for end-to-end tests: "open the page, click Add, expect the cart badge to say 1".
- **Coverage** tools report which lines the tests ran (`node --test --experimental-test-coverage`, or `vitest --coverage`). Low coverage shows untested code; high coverage doesn't prove the tests check the right things.

## Test-driven development

**TDD** writes the test first: write a failing test for the next small behaviour (**red**), write just enough code to pass it (**green**), then tidy the code while the tests stay green (**refactor**). It keeps code testable and makes you decide what "correct" means before writing it. The second exercise works this way.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Check a function | test + assert.equal / deepEqual / throws | O(cases) | O(1) |
| Async code | async test function + await (assert.rejects for failures) | O(cases) | O(1) |
| Hard dependencies | pass them in; give tests fakes | O(1) | O(1) |

## Common mistakes

- Using `assert.equal` to compare objects or arrays (use `deepEqual`).
- Forgetting to `await` assertions about promises, so tests pass without checking.
- Copying expected values from the code's own output instead of the specification.
- Tests that depend on each other, the current time, or the network.
- Treating high coverage as proof that the code is correct.

## Exercises

### 1. Tests that catch the bugs

Write `testSlugify(slugify)`: a function that receives a `slugify` implementation and checks it with `assert`, throwing if it's wrong. The real `slugify` (below) must pass your checks. The check then runs your function against **five broken versions**, and each must make one of your assertions fail.

The specification: lower case; letters with accents become plain letters (`é` → `e`); every run of characters other than `a`–`z` and `0`–`9` becomes a single `-`; no `-` at the start or end.

Starter code:

```js
function slugify(text) {
  return text
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // split é into e + accent, drop the accent
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function testSlugify(slugify) {
  assert.equal(slugify("bike"), "bike");
  // add assertions that would catch mistakes
}

testSlugify(slugify);
console.log("The real slugify passes your tests.");
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** your tests are good if they pass for correct code and fail for each kind of mistake.
2. **Examples:** `"Hello!"` catches a missing trim (`"hello-"`); `"Café"` catches dropped letters.
3. **Brute force:** dozens of random inputs: slow to check by hand, and may still miss a rule.
4. **Pattern:** **one test case per rule**, plus edges, the way you'd write any good test suite.
5. **Plan:** for each rule (case, accents, runs, ends, digits) pick an input that breaks it → compute the expected slug → assert.
6. **Code and test:** run it: the real slugify must pass. Then press Check to run the broken versions.

</details>

<details>
<summary>💡 Hint 1</summary>

Think about each rule in the specification and write one assertion that only passes if that rule is followed. `slugify("bike")` checks almost nothing.

</details>

<details>
<summary>💡 Hint 2</summary>

Useful inputs: something with capitals; words separated by `, ` or ` & ` (several characters in a row); text starting or ending with spaces or punctuation; a word with an accent; a number.

</details>

<details>
<summary>💡 Hint 3</summary>

Work out each expected value from the specification, then run your code: the real `slugify` must pass, so if an assertion fails, your expected value is wrong.

</details>

### 2. Make the tests pass

The tests below describe `parseDuration(text)`, which turns a duration like `"1h30m"` into seconds. They fail now. Write `parseDuration` so they all pass, in the TDD way: make one pass at a time, then tidy up.

The rules: hours `h`, minutes `m` and seconds `s`, each a whole number, at most once, in that order; any of them may be left out but at least one is needed; spaces between parts are allowed. Anything else throws an `Error` with the message `Invalid duration: ` followed by the text.

Starter code:

```js
function parseDuration(text) {
  // your code here
}

describe("parseDuration", () => {
  it("reads seconds", () => assert.equal(parseDuration("90s"), 90));
  it("reads minutes", () => assert.equal(parseDuration("5m"), 300));
  it("reads hours and minutes", () => assert.equal(parseDuration("1h30m"), 5400));
  it("allows spaces between parts", () => assert.equal(parseDuration("1h 15m 10s"), 4510));
  it("rejects unknown units", () => assert.throws(() => parseDuration("5x"), /Invalid duration: 5x/));
  it("rejects an empty text", () => assert.throws(() => parseDuration(""), /Invalid duration/));
});
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** the tests are the specification; the check adds a few more cases of the same rules.
2. **Examples:** `"30m1h"` is out of order → invalid; `"0m"` → 0 (valid).
3. **Brute force:** splitting on letters and summing: accepts `"1h1h"` and `"30m1h"`.
4. **Pattern:** **red, green, refactor**, with a regex that describes the whole valid format.
5. **Plan:** anchored regex → no match or nothing captured → throw → sum the parts.
6. **Code and test:** run after each change; all six tests should show ✔.

</details>

<details>
<summary>💡 Hint 1</summary>

Run it first: every test fails. Make "reads seconds" pass, then the next one, rerunning each time.

</details>

<details>
<summary>💡 Hint 2</summary>

One regular expression can describe the whole format: an optional hours part, then optional minutes, then optional seconds, with optional spaces: `/^\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?\s*$/`. Each `(\d+)` captures a number.

</details>

<details>
<summary>💡 Hint 3</summary>

If there's no match, or all three groups are `undefined` (as for `""`), throw `new Error(\`Invalid duration: ${text}\`)`. Otherwise add hours × 3600, minutes × 60 and seconds, using 0 for missing parts.

</details>

**In the sandbox:** exercises 77–78. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Tests that catch the bugs</summary>

```js
function slugify(text) {
  return text
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function testSlugify(slugify) {
  assert.equal(slugify("bike"), "bike");
  assert.equal(slugify("Bike Lights"), "bike-lights");           // lower case, spaces
  assert.equal(slugify("Tyres, tubes & pumps"), "tyres-tubes-pumps");   // runs of symbols
  assert.equal(slugify("  Hello, World!  "), "hello-world");     // nothing at the ends
  assert.equal(slugify("Café crème"), "cafe-creme");             // accents
  assert.equal(slugify("Lights 2026"), "lights-2026");           // digits stay
}

testSlugify(slugify);
console.log("The real slugify passes your tests.");
```

**Line by line**

- `"Bike Lights"` → `"bike-lights"` fails if lower-casing is missing.
- `"Tyres, tubes & pumps"` has `, ` and ` & `: a version that replaces each character separately gives `tyres--tubes---pumps`.
- `"  Hello, World!  "` starts and ends with non-letters, so a version that doesn't trim returns `-hello-world-`.
- `"Café crème"` → `"cafe-creme"` only if accents are removed rather than the letters.
- `"Lights 2026"` → `"lights-2026"` fails if digits are dropped.

**Trace:** the "forgets to lower-case" version returns `"Bike-Lights"` for the second assertion → `assert.equal` throws → caught.

**Common wrong approach:** writing the expected values by running `slugify` and copying its output: the tests then agree with whatever the code does, bugs included. Expected values come from the specification.

</details>

<details>
<summary>✅ 2. Make the tests pass</summary>

```js
function parseDuration(text) {
  const m = /^\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?\s*$/.exec(text);
  if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) {
    throw new Error(`Invalid duration: ${text}`);
  }
  const [h, min, s] = [m[1], m[2], m[3]].map((part) => Number(part ?? 0));
  return h * 3600 + min * 60 + s;
}

describe("parseDuration", () => {
  it("reads seconds", () => assert.equal(parseDuration("90s"), 90));
  it("reads minutes", () => assert.equal(parseDuration("5m"), 300));
  it("reads hours and minutes", () => assert.equal(parseDuration("1h30m"), 5400));
  it("allows spaces between parts", () => assert.equal(parseDuration("1h 15m 10s"), 4510));
  it("rejects unknown units", () => assert.throws(() => parseDuration("5x"), /Invalid duration: 5x/));
  it("rejects an empty text", () => assert.throws(() => parseDuration(""), /Invalid duration/));
});
```

**Line by line**

- `^` and `$` anchor the pattern to the whole text, so `"5x"` or `"abc"` can't match partially.
- `(?:(\d+)h)?` is an optional non-capturing group containing a captured number: hours may be missing, but if present they come first. Minutes and seconds follow, so the order is enforced and each unit appears at most once.
- `\s*` between parts allows spaces; `\d+` allows only whole, non-negative numbers, so `"1.5h"` and `"-5m"` fail.
- An empty or all-spaces text matches the pattern with every group missing, hence the extra check.
- `part ?? 0` uses 0 for missing parts before the arithmetic.

**Trace:** `"1h 15m 10s"` → groups "1", "15", "10" → 3600 + 900 + 10 = 4510.

**Common wrong approach:** `text.matchAll(/(\d+)([hms])/g)` and adding everything up: it ignores anything between the matches, so `"5x10s"` returns 10 and `"1h1h"` returns 7200.

</details>

## Quick quiz

1. What does assert.equal([1, 2], [1, 2]) do?
   - A) Fails: they're two different arrays; use assert.deepEqual
   - B) Passes
   - C) Throws a TypeError

2. An async test calls assert.rejects(promise) without await. What can happen?
   - A) The test can pass even if the promise never rejects
   - B) It always fails
   - C) Node.js adds the await automatically

3. How do you test code that uses the current time?
   - A) Pass the time (or a clock) in as a parameter, and pass a fixed date in tests
   - B) Run the tests at the right time of day
   - C) You can't test it

4. What does 100% test coverage tell you?
   - A) Every line ran during the tests, not that the results were checked correctly
   - B) The code has no bugs
   - C) Every possible input was tested

<details>
<summary>Quiz answers</summary>

1. **A) Fails: they're two different arrays; use assert.deepEqual**: equal checks identity; deepEqual compares contents.
2. **A) The test can pass even if the promise never rejects**: Always await assertions on promises.
3. **A) Pass the time (or a clock) in as a parameter, and pass a fixed date in tests**: Dependency injection makes outside dependencies replaceable.
4. **A) Every line ran during the tests, not that the results were checked correctly**: Coverage finds untested code; it doesn't measure test quality.

</details>

---
Previous: [Lesson 38](38-formatting-linting-bundling.md) · Next: [Lesson 40: A small web server and API](40-web-server.md)
