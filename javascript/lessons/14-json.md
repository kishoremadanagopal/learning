# Lesson 14: JSON

**You'll learn:** what JSON is and where it's used, JSON syntax rules versus JavaScript objects, JSON.parse and JSON.stringify, pretty-printing, values that don't survive (undefined, functions, Date, Map, Set, NaN), replacers and revivers, invalid JSON and SyntaxError, try and catch, very large numbers, context.source and JSON.rawJSON, validating the shape of parsed data, schema libraries such as Zod.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#json)**: run every example and check your exercise answers.

## Key terms

- **JSON:** a text format for data built from objects, arrays, strings, numbers, booleans and null.
- **Serialise / parse:** turning a value into text, and text back into a value.
- **Replacer:** a function or key list that controls what `JSON.stringify` outputs.
- **Reviver:** a function that transforms values as `JSON.parse` reads them.
- **`SyntaxError`:** the error `JSON.parse` throws for invalid JSON.
- **Validation:** checking that data has the expected structure and types before using it.
- **Schema:** a description of the shape data must have.

**JSON** (JavaScript Object Notation) is a text format for data. It started as a subset of JavaScript's object syntax and became the common language of the web: REST APIs, configuration files, logs, databases, and every LLM API (Part 8) send and receive JSON.

```json
{
  "id": 1042,
  "customer": "Ada Lovelace",
  "paid": true,
  "items": [{ "sku": "TUBE-29", "qty": 2, "price": 6.0 }],
  "coupon": null
}
```

## JSON's rules

JSON looks like a JavaScript object, but it's stricter:

| JSON | Allowed? |
|---|---|
| keys in **double** quotes: `"id"` | required |
| strings in double quotes | required (no single quotes or backticks) |
| numbers, `true`, `false`, `null`, arrays, objects | yes |
| `undefined`, functions, dates, `NaN`, `Infinity` | **no** |
| trailing commas `[1, 2,]` | **no** |
| comments | **no** |

## parse and stringify

```js
const text = '{"id": 7, "customer": "Ada", "items": [{"sku": "TUBE", "qty": 2}]}';
const order = JSON.parse(text);              // text → JavaScript value
console.log(order.items[0].qty, typeof order);

const back = JSON.stringify(order);          // value → compact text
console.log(back);
console.log(JSON.stringify({ a: 1, b: [1, 2] }, null, 2));   // pretty-printed, 2-space indent
```

## What doesn't survive a round trip

```js
const data = {
  when: new Date(Date.UTC(2026, 9, 8)),
  missing: undefined,
  fn() {},
  tags: new Set(["a"]),
  ratio: NaN,
  list: [undefined, () => 1],
};
const json = JSON.stringify(data);
console.log(json);
const parsed = JSON.parse(json);
console.log(typeof parsed.when);             // the Date came back as a string
```

- `undefined` and functions **disappear** from objects (and become `null` in arrays).
- Dates become ISO strings and come back as **strings**, not Dates.
- `Map` and `Set` become `{}`: convert them first (`Object.fromEntries(map)`, `[...set]`).
- `NaN` and `Infinity` become `null`.
- `JSON.stringify` throws a `TypeError` on BigInt values and on objects that contain themselves.

## Replacers and revivers

A **replacer** customises stringify; a **reviver** customises parse. Both are called for every key and value:

```js
const text = '{"name": "Ada", "joined": "2026-10-08T00:00:00.000Z", "password": "hunter2"}';
const user = JSON.parse(text, (key, value) =>
  key === "joined" ? new Date(value) : value);           // bring the date back to life
console.log(user.joined instanceof Date, user.joined.getUTCFullYear());

const safe = JSON.stringify(user, (key, value) => (key === "password" ? undefined : value));
console.log(safe);                                        // returning undefined drops the key
console.log(JSON.stringify(user, ["name"]));              // an array replacer keeps only these keys
```

## Invalid JSON

`JSON.parse` throws a `SyntaxError` on bad input, and real-world JSON is often bad: truncated network responses, single quotes, trailing commas, or a model reply wrapped in extra text. Always parse untrusted text inside `try`/`catch` (Part 3 covers errors in detail):

```js
for (const text of ['{"ok": true}', "{'ok': true}", '{"ok": true,}', ""]) {
  try {
    console.log("parsed:", JSON.parse(text));
  } catch (e) {
    console.log(`not JSON (${e.name}):`, JSON.stringify(text));
  }
}
```

## Very large numbers

JSON numbers have no size limit, but `JSON.parse` turns them into JavaScript numbers, which are exact only up to 2⁵³ − 1 (Lesson 4). IDs from databases such as Twitter's (X's) can be bigger, and silently change:

```js
const text = '{"id": 12345678901234567890}';
console.log(JSON.parse(text).id);                         // rounded!
const exact = JSON.parse(text, (key, value, context) =>
  key === "id" ? BigInt(context.source) : value);         // ES2026: the reviver can see the original text
console.log(exact.id);
console.log(JSON.stringify({ id: JSON.rawJSON(exact.id.toString()) }));   // ES2026: write raw JSON
```

ECMAScript 2026 standardised the reviver's `context.source` and `JSON.rawJSON` for exactly this; all major browsers have supported them since early 2025, but older devices may not. Many APIs still send big IDs as **strings** (`"id": "12345678901234567890"`), which is the safest option.

## Check the shape of parsed data

`JSON.parse` tells you the text is valid JSON, not that it contains what you expect. Data from outside your program (APIs, files, users, LLMs) should be checked before use: is `items` really an array, is `qty` a number? The second exercise writes a small checker; in TypeScript projects, libraries such as **Zod** do this and give you types at the same time (Part 6).

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Value to text | JSON.stringify(value, null, 2) | O(size) | O(size) |
| Text to value | JSON.parse(text, reviver) inside try / catch | O(size) | O(size) |
| Never throw | return { ok, value } or { ok, error } | O(size) | O(size) |
| Check the shape | type checks per field; collect problems | O(fields) | O(problems) |

## Common mistakes

- Writing JSON with single quotes, unquoted keys or trailing commas.
- Calling `JSON.parse` on untrusted text without `try` / `catch`.
- Expecting Dates, Maps or Sets to come back from JSON unchanged.
- Parsing very large integer IDs as numbers and losing precision.
- Assuming valid JSON has the shape your code expects.

## Exercises

### 1. Parse without crashing

Write `safeParse(text)` returning `{ ok: true, value }` when `text` is valid JSON, and `{ ok: false, error }` otherwise, where `error` is the error's message (a string). It must never throw, even when `text` isn't a string (then `ok` is `false` and `error` is `"not a string"`).

Starter code:

```js
function safeParse(text) {
  // your code here
}

console.log(safeParse('{"a": [1, 2]}'));
console.log(safeParse("{'a': 1}").ok);
// { ok: true, value: { a: [ 1, 2 ] } }
// false
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** turn exceptions into return values; distinguish "not text" from "bad JSON".
2. **Examples:** `"null"` is valid JSON (value null); `""` isn't.
3. **Brute force:** checking the text with a regular expression first: impossible to get right; let the parser decide.
4. **Pattern:** **result object instead of exceptions** (a "Result" type).
5. **Plan:** type guard → try parse → catch.
6. **Code and test:** valid values of every JSON type, several invalid texts, non-strings.

</details>

<details>
<summary>💡 Hint 1</summary>

`JSON.parse` throws on invalid input. Put it inside `try { … } catch (e) { … }` and return the right object from each branch.

</details>

<details>
<summary>💡 Hint 2</summary>

Check the type first: `JSON.parse(42)` doesn't throw (it converts 42 to "42"), so the "not a string" case needs its own test.

</details>

<details>
<summary>💡 Hint 3</summary>

`if (typeof text !== "string") return { ok: false, error: "not a string" };` then `try { return { ok: true, value: JSON.parse(text) }; } catch (e) { return { ok: false, error: e.message }; }`.

</details>

### 2. Check an order's shape

Data from an API should be checked before use. Write `validateOrder(data)` returning a list of problems (empty if fine), in this order:

1. If `data` isn't a plain object (not `null`, not an array): return `["not an object"]` and stop.
2. `"id must be a positive integer"` unless `data.id` is an integer above 0.
3. `"customer must be a non-empty string"` unless it's a string with at least one non-space character.
4. `"items must be a non-empty array"` unless `data.items` is an array with at least one item; otherwise, for each item at index `i` (in order) whose `qty` isn't an integer ≥ 1: `"items[i].qty must be a positive integer"`.

Starter code:

```js
function validateOrder(data) {
  // your code here
}

console.log(validateOrder(JSON.parse('{"id": 7, "customer": "Ada", "items": [{"qty": 2}]}')));   // []
console.log(validateOrder({ id: "7", customer: " ", items: [{ qty: 0 }, { qty: 1 }, {}] }));
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** collect every problem in a fixed order; bail out early only for "not an object".
2. **Examples:** `"7"` is a string, not an integer: JSON from some APIs sends numbers as text.
3. **Brute force:** `typeof` checks inline everywhere: works, but repetitive.
4. **Pattern:** **schema validation** by hand (libraries such as Zod do this declaratively).
5. **Plan:** object guard → id → customer → items (array check, then each item).
6. **Code and test:** null, arrays, strings, empty objects, wrong types at each level.

</details>

<details>
<summary>💡 Hint 1</summary>

`typeof null` is `"object"` and arrays are objects too, so the first check needs three conditions.

</details>

<details>
<summary>💡 Hint 2</summary>

`Number.isInteger(x) && x > 0` rejects strings like `"7"`, decimals and zero. A small helper function keeps it readable.

</details>

<details>
<summary>💡 Hint 3</summary>

Only check the items one by one when `items` is a non-empty array; `forEach((item, i) => …)` gives you the index for the message.

</details>

**In the sandbox:** exercises 27–28. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Parse without crashing</summary>

```js
function safeParse(text) {
  if (typeof text !== "string") return { ok: false, error: "not a string" };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

console.log(safeParse('{"a": [1, 2]}'));
console.log(safeParse("{'a': 1}").ok);
```

**Line by line**

- The `typeof` guard matters: `JSON.parse(42)` returns 42 and `JSON.parse(undefined)` throws an odd message, so non-strings get their own clear answer.
- `try` / `catch` turns the `SyntaxError` into data the caller can check without its own `try`.
- `e.message` is a human-readable description such as `Unexpected token ''', "{'a': 1}" is not valid JSON`.

**Trace:** `safeParse('{"a": 1,}')` → a string → `JSON.parse` throws (trailing comma) → `{ ok: false, error: "Expected double-quoted property name…" }`.

**Common wrong approach:** returning `null` for invalid JSON: `"null"` is valid JSON whose value is `null`, so the caller can't tell success from failure. A result object with `ok` removes the ambiguity.

</details>

<details>
<summary>✅ 2. Check an order's shape</summary>

```js
function validateOrder(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return ["not an object"];
  const problems = [];
  const isPositiveInt = (n) => Number.isInteger(n) && n > 0;
  if (!isPositiveInt(data.id)) problems.push("id must be a positive integer");
  if (typeof data.customer !== "string" || data.customer.trim() === "") {
    problems.push("customer must be a non-empty string");
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    problems.push("items must be a non-empty array");
  } else {
    data.items.forEach((item, i) => {
      if (!isPositiveInt(item?.qty)) problems.push(`items[${i}].qty must be a positive integer`);
    });
  }
  return problems;
}

console.log(validateOrder(JSON.parse('{"id": 7, "customer": "Ada", "items": [{"qty": 2}]}')));
console.log(validateOrder({ id: "7", customer: " ", items: [{ qty: 0 }, { qty: 1 }, {}] }));
```

**Line by line**

- The first guard handles the three things `typeof` reports as `"object"` but aren't usable records: `null` and arrays (and catches strings, numbers and booleans too).
- `Number.isInteger("7")` is `false`: no type conversion, which is exactly what a validator wants.
- `data.customer.trim() === ""` rejects names that are only spaces.
- `item?.qty` survives items that are `null` instead of objects.

**Trace:** the "several problems" case → id "7" fails; customer " " fails; items is a 3-item array → qty 0 fails (index 0), qty 1 passes, missing qty fails (index 2).

**Common wrong approach:** trusting the data because `JSON.parse` succeeded. Valid JSON can still have the wrong shape, and the error then appears far away (`Cannot read properties of undefined`) instead of at the boundary where the data arrived.

</details>

## Quick quiz

1. Which of these is valid JSON?
   - A) {"name": "Ada", "tags": []}
   - B) {name: "Ada"}
   - C) {'name': 'Ada'}
   - D) {"name": "Ada",}

2. What happens to a Date in JSON.stringify and then JSON.parse?
   - A) It becomes an ISO string and comes back as a string
   - B) It comes back as a Date
   - C) It's removed

3. What does JSON.stringify({ a: undefined, b: 1 }) produce?
   - A) {"b":1}
   - B) {"a":undefined,"b":1}
   - C) {"a":null,"b":1}

4. JSON.parse succeeded. Is the data safe to use?
   - A) Not necessarily: it's valid JSON, but its shape still needs checking
   - B) Yes, parse validates the structure
   - C) Only if it contains no strings

<details>
<summary>Quiz answers</summary>

1. **A) {"name": "Ada", "tags": []}**: JSON needs double-quoted keys and strings, and no trailing commas.
2. **A) It becomes an ISO string and comes back as a string**: Use a reviver to turn it back into a Date.
3. **A) {"b":1}**: undefined values are dropped from objects.
4. **A) Not necessarily: it's valid JSON, but its shape still needs checking**: Validate data at the boundary where it enters your program.

</details>

---
Previous: [Lesson 13](13-map-and-set.md) · Next: [Lesson 15: Dates and times](15-dates-and-time.md)
