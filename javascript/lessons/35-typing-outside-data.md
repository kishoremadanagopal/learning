# Lesson 35: Typing data from outside

**You'll learn:** the trust boundary, res.json() and JSON.parse returning any, generic fetch helpers and their limits, unknown in catch blocks, type guards with type predicates, assertion functions, Result types for expected failures, exceptions versus results, schema validation with Zod, inferring types from schemas, JSON Schema, OpenAPI, LLM tool arguments.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#typing-outside-data)**: run every example and check your exercise answers.

## Key terms

- **Trust boundary:** where data from outside (APIs, users, files, LLMs) enters your program.
- **Type guard:** a function returning `value is Type` that checks a value at runtime and narrows it.
- **Type predicate:** the `value is Type` return type of a type guard.
- **Assertion function:** a function declared `asserts value is Type` that throws if the check fails.
- **Result type:** a union like `{ ok: true; value: T } | { ok: false; error: string }` for expected failures.
- **Schema:** a description of the shape data must have, used to validate it at runtime.
- **Zod:** a popular TypeScript schema library that validates data and infers types from schemas.
- **JSON Schema:** a standard JSON format for describing the shape of JSON data.

Inside your program, TypeScript checks everything. But data also comes from **outside**: API responses, `JSON.parse`, form fields, files, environment variables, and LLM output. TypeScript can't see any of it before the program runs, so this is where typed programs still break. This lesson is about checking that boundary.

## res.json() is any

```ts
interface Product { id: number; name: string; price: number; stock: number }

const res = await fetch("https://shop.example/api/products/2");
const product: Product = await res.json();      // any → Product: accepted without a check
console.log(product.name, product.price);
```

`res.json()` returns `Promise<any>`, so assigning it to `Product` compiles. If the API changes, or returns an error object instead, the program believes it has a `Product`, and the bug appears somewhere else. A typed helper looks safer, but has the same gap:

```ts
async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();              // still any, still unchecked: T is a promise, not a check
}
```

Use this only for data you trust, such as your own server. For everything else, start from `unknown` and **check**.

## Errors in catch are unknown

Anything can be thrown in JavaScript, not only `Error`s, so in strict mode a `catch` variable is `unknown`:

```ts
try {
  JSON.parse("{ not json");
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);   // narrow before use
  console.log("Couldn't parse:", message);
}
```

## Type guards

A **type guard** is a function returning `value is Type`. It does a real runtime check, and when it returns `true`, TypeScript narrows the value:

```ts
interface Product { id: number; name: string; price: number; stock: number }

function isProduct(value: unknown): value is Product {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;        // safe: we only read properties and check them
  return typeof v.id === "number" && typeof v.name === "string"
    && typeof v.price === "number" && typeof v.stock === "number";
}

const res = await fetch("https://shop.example/api/products/2");
const data: unknown = await res.json();
if (isProduct(data)) {
  console.log(`${data.name}: £${(data.price / 100).toFixed(2)}`);    // data is a Product here
} else {
  console.log("Unexpected response", data);
}
```

The guard is a promise **you** keep: TypeScript trusts that `isProduct` checks what it claims. Write it carefully, and test it, as the exercise does.

An **assertion function** throws instead of returning `false`, and narrows everything after the call:

```ts
function assertProduct(value: unknown): asserts value is Product {
  if (!isProduct(value)) throw new Error("Not a product");
}
assertProduct(data);
data.price;        // Product from here on
```

## Expected failures: Result types

Some failures are normal: a product that doesn't exist, a form field that isn't a number. Returning a **Result** makes the caller handle them, because the type forces a check of `ok`:

```ts
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function parseQty(text: string): Result<number> {
  const n = Number(text);
  if (!Number.isInteger(n) || n < 1) return { ok: false, error: `"${text}" isn't a quantity` };
  return { ok: true, value: n };
}

const r = parseQty("2.5");
if (r.ok) console.log(r.value * 600);
else console.log(r.error);
```

Use exceptions for the unexpected (bugs, a server that's down) and Results for outcomes the caller should always consider. Both are fine; a codebase should be consistent.

## Schema libraries

Hand-written guards get long for nested data. **Schema validation libraries** let you describe the shape once, and give you both the runtime check and the TypeScript type. **Zod** is the most widely used; Valibot and ArkType are alternatives. With Zod 4:

```ts
import * as z from "zod";

const Product = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  price: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(),
});
type Product = z.infer<typeof Product>;          // the type, derived from the schema

const result = Product.array().safeParse(await res.json());
if (result.success) {
  show(result.data);                             // Product[]
} else {
  console.error(z.prettifyError(result.error));  // which fields were wrong, and why
}
```

Schemas also check things types can't express: whole numbers, non-empty strings, ranges, email formats.

## JSON Schema, APIs and LLMs

Types vanish at runtime, so systems that talk to each other describe data with **JSON Schema**, a standard JSON format for "an object with an integer `id` and a string `name`". OpenAPI files that document REST APIs use it, and so do LLM APIs: when you give a model a **tool** to call, you describe the tool's arguments with a JSON Schema, and the model replies with JSON that should match it. Zod can produce one from a schema (`z.toJSONSchema(Product)`), so one definition gives you the type, the runtime check and the schema. Part 8's final project uses this to check a model's tool calls before running them, because model output is outside data too.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Outside data | unknown → validate (guard or schema) → typed value | O(size of data) | O(1) |
| Expected failure | return a Result union; callers check ok | O(1) | O(1) |
| One definition, many uses | schema → type (z.infer) and JSON Schema | O(schema) | O(schema) |

## Common mistakes

- Annotating `await res.json()` with a type and treating it as checked.
- Writing a type guard that doesn't check everything its type predicate claims.
- Using `err.message` in a catch block without narrowing `err`.
- Returning results without forcing callers to check `ok`.
- Trusting LLM output to match the schema you asked for.

## Exercises

### 1. A product type guard

Write `isProduct(value: unknown): value is Product`. It returns `true` only for an object that has:

- `id`: an integer;
- `name`: a non-empty string;
- `price` and `stock`: integers of at least 0.

It must return `false` (never throw) for anything else, including `null`, arrays, strings and objects with missing or wrong fields. Extra fields are allowed.

Starter code:

```ts
interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
}

function isProduct(value: unknown): boolean {
  return true;
}

console.log(isProduct({ id: 2, name: "Bell", price: 800, stock: 15 }), isProduct({ id: 2 }));
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a strict runtime check whose `true` result TypeScript can rely on.
2. **Examples:** `{ id: "2", … }` → false; extra fields → still true; `null` → false (and no crash).
3. **Brute force:** `"id" in value && "name" in value…`: checks presence, not types; `{ id: "2" }` passes.
4. **Pattern:** **type guard**: object check, then each field's type and range.
5. **Plan:** reject non-objects → view as a record of unknowns → integer id → non-empty name → non-negative integer price and stock.
6. **Code and test:** the checks try 17 values, valid and invalid.

</details>

<details>
<summary>💡 Hint 1</summary>

Change the return type to the type predicate `value is Product`, so TypeScript narrows after a `true`.

</details>

<details>
<summary>💡 Hint 2</summary>

First rule out non-objects: `typeof value !== "object" || value === null || Array.isArray(value)`. Then read the fields through `const v = value as Record<string, unknown>;` (each field is still `unknown`, so you must check it).

</details>

<details>
<summary>💡 Hint 3</summary>

`Number.isInteger(x)` is `false` for strings, `NaN` and `2.5`, so it checks "a whole number" in one call. Add `>= 0` for price and stock, and `typeof v.name === "string" && v.name.length > 0`.

</details>

### 2. Load products safely

Write `async function loadProducts(url: string): Promise<Result<Product[]>>` using the `isProduct` guard provided:

- if the response status isn't OK, return `{ ok: false, error: "HTTP 404" }` (with the status);
- if the body isn't an array whose items are all products, return `{ ok: false, error: "Unexpected data" }`;
- if `fetch` itself fails (it rejects), return `{ ok: false, error: … }` with the error's message;
- otherwise return `{ ok: true, value: products }`.

Starter code:

```ts
interface Product { id: number; name: string; price: number; stock: number }
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function isProduct(value: unknown): value is Product {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Number.isInteger(v.id) && typeof v.name === "string" && v.name.length > 0
    && Number.isInteger(v.price) && (v.price as number) >= 0
    && Number.isInteger(v.stock) && (v.stock as number) >= 0;
}

async function loadProducts(url: string): Promise<Result<Product[]>> {
  // your code here
}

const r = await loadProducts("https://shop.example/api/products");
console.log(r.ok ? r.value.length : r.error);                                   // 6
const missing = await loadProducts("https://shop.example/api/products/99");
console.log(missing.ok ? missing.value : missing.error);                        // HTTP 404
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** turn three kinds of failure into Results, and only return products that were checked.
2. **Examples:** `/api/products/2` is a single object → "Unexpected data"; `/api/nope` → "HTTP 404".
3. **Brute force:** `return { ok: true, value: await res.json() }`: compiles (it's `any`), and returns orders as if they were products.
4. **Pattern:** **check at the boundary**: `unknown` in, guard, typed value out.
5. **Plan:** fetch in try/catch → status check → json as unknown → array + every(isProduct) → ok.
6. **Code and test:** the checks call it with good and bad URLs.

</details>

<details>
<summary>💡 Hint 1</summary>

Wrap only the `fetch` call in `try` / `catch`; in `catch`, `err` is `unknown`, so use `err instanceof Error ? err.message : String(err)`.

</details>

<details>
<summary>💡 Hint 2</summary>

Read the body as `const data: unknown = await res.json();` so TypeScript makes you check it.

</details>

<details>
<summary>💡 Hint 3</summary>

`Array.isArray(data) && data.every(isProduct)` checks every item, and because `isProduct` is a type guard, TypeScript then knows `data` is `Product[]`.

</details>

**In the sandbox:** exercises 69–70. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. A product type guard</summary>

```ts
interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
}

function isProduct(value: unknown): value is Product {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const count = (x: unknown) => Number.isInteger(x) && (x as number) >= 0;
  return Number.isInteger(v.id)
    && typeof v.name === "string" && v.name.length > 0
    && count(v.price) && count(v.stock);
}

console.log(isProduct({ id: 2, name: "Bell", price: 800, stock: 15 }), isProduct({ id: 2 }));
```

**Line by line**

- `value is Product` is the type predicate: when the function returns `true`, callers see `value` as a `Product`.
- `typeof value !== "object" || value === null` is needed because `typeof null` is `"object"`; arrays are objects too, so they're ruled out explicitly.
- `value as Record<string, unknown>` lets us read any property while keeping each one `unknown`, so every field must still be checked: the assertion is safe here.
- `Number.isInteger` handles numbers-only, no `NaN`, no fractions; `count` adds the `>= 0` rule.

**Trace:** `{ id: 2, name: "Bell", price: NaN, stock: 15 }` → object → id ok → name ok → `Number.isInteger(NaN)` is false → false.

**Common wrong approach:** `return value as Product !== undefined` or any version that only asserts: the type predicate then lies, and every caller trusts it.

</details>

<details>
<summary>✅ 2. Load products safely</summary>

```ts
interface Product { id: number; name: string; price: number; stock: number }
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function isProduct(value: unknown): value is Product {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Number.isInteger(v.id) && typeof v.name === "string" && v.name.length > 0
    && Number.isInteger(v.price) && (v.price as number) >= 0
    && Number.isInteger(v.stock) && (v.stock as number) >= 0;
}

async function loadProducts(url: string): Promise<Result<Product[]>> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  const data: unknown = await res.json();
  if (!Array.isArray(data) || !data.every(isProduct)) return { ok: false, error: "Unexpected data" };
  return { ok: true, value: data };
}

const r = await loadProducts("https://shop.example/api/products");
console.log(r.ok ? r.value.length : r.error);
const missing = await loadProducts("https://shop.example/api/products/99");
console.log(missing.ok ? missing.value : missing.error);
```

**Line by line**

- `let res: Response;` is declared before `try` so it can be used after it; TypeScript knows it's assigned because the `catch` returns.
- The `catch` turns a rejected `fetch` (network down, invalid URL) into a Result.
- `!res.ok` handles HTTP errors, which `fetch` doesn't reject on (Lesson 24).
- Annotating `data` as `unknown` stops the `any` from `res.json()` spreading.
- `data.every(isProduct)` uses the guard on each item; TypeScript narrows `data` to `Product[]`, so `{ ok: true, value: data }` matches `Result<Product[]>` with no assertion.

**Trace:** `/api/orders` → 200 → an array of orders → `isProduct(order)` is false (no `name`) → "Unexpected data".

**Common wrong approach:** `const data = await res.json() as Product[]`: the assertion silences the check you were supposed to write, and orders become "products".

</details>

## Quick quiz

1. What type does res.json() return?
   - A) Promise<any>
   - B) Promise<unknown>
   - C) The type you annotate the variable with, checked at runtime

2. In strict mode, what is the type of err in catch (err)?
   - A) unknown, because anything can be thrown
   - B) Error
   - C) any

3. What does function isProduct(v: unknown): v is Product promise?
   - A) When it returns true, v is a Product, so callers can use it as one
   - B) TypeScript will check v against Product at runtime
   - C) It throws if v isn't a Product

4. Why give an LLM a JSON Schema for a tool's arguments?
   - A) It describes the JSON the model should produce, which you can then validate
   - B) It makes the model run TypeScript
   - C) Models can't produce JSON without it

<details>
<summary>Quiz answers</summary>

1. **A) Promise<any>**: It's any, so annotating the result checks nothing.
2. **A) unknown, because anything can be thrown**: Narrow it, for example with err instanceof Error.
3. **A) When it returns true, v is a Product, so callers can use it as one**: TypeScript trusts the guard; your code must really check.
4. **A) It describes the JSON the model should produce, which you can then validate**: The schema describes the data; your code still checks the reply before using it.

</details>

---
Previous: [Lesson 34](34-classes-and-tsconfig.md) · Next: [Lesson 36: Node.js: JavaScript outside the browser](36-node-basics.md)
