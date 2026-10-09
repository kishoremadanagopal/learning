# Lesson 31: Why TypeScript

**You'll learn:** what TypeScript is, static type checking before the code runs, the sandbox's strict type-checking, TypeScript 7.0's native compiler and TypeScript 6.0, type annotations, type inference, the basic types, arrays and tuples, literal types, any versus unknown, strict mode and strict null checks, noImplicitAny, type erasure, running TypeScript with tsc, Node.js type stripping, bundlers and editors.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#why-typescript)**: run every example and check your exercise answers.

## Key terms

- **TypeScript:** JavaScript with type annotations, checked by a compiler before the code runs.
- **Type annotation:** a type written after a name, like `price: number`.
- **Type inference:** TypeScript working out a type from a value, without an annotation.
- **Type checker:** the part of the compiler that finds type errors.
- **Strict mode:** the `strict` option, which turns on strict null checks, no implicit any and other checks.
- **`any`:** a type that turns checking off for a value.
- **`unknown`:** a type for any value that must be checked before it's used.
- **Literal type:** a type with exactly one value, like `"parts"` or `42`.
- **Tuple:** an array type with a fixed length and a type per position, like `[string, number]`.
- **Type erasure:** removing types to get the JavaScript that runs; types don't exist at runtime.
- **Type stripping:** running TypeScript by deleting the types without checking them, as Node.js does.

JavaScript checks types only while the code runs, so a typo or a wrong kind of value shows up as a bug, often in front of a user. **TypeScript** is JavaScript plus **type annotations**, checked by a compiler **before** the code runs:

*This example raises an error on purpose.*

```ts
const product = { name: "Bell", price: 800, stock: 15 };

function totalPrice(qty: number) {
  // A typo: plain JavaScript would quietly return NaN here.
  return product.prise * qty;
}

console.log(totalPrice(2));
```

TypeScript refuses to run this: there's no `prise` on `product`, and it even suggests `price`. In plain JavaScript the same code runs and returns `NaN`, and you find out later.

That's the whole idea. TypeScript doesn't add new runtime behaviour; it reads your code, works out the type of every value, and reports mistakes, while your editor uses the same information for autocomplete, inline errors and safe renaming. Its popularity follows: most new professional JavaScript projects, and nearly every popular library, are written in it or ship types for it.

## TypeScript in this sandbox

The examples in this part are TypeScript. When you press **Run**, the sandbox:

1. type-checks your code with the real TypeScript compiler, in **strict mode**;
2. if there are type errors, shows them (with the line and a `^` under the problem) and doesn't run the code;
3. otherwise removes the types and runs the JavaScript that's left.

The first run downloads the compiler (a few megabytes, once). The sandbox uses **TypeScript 6.0**, because **TypeScript 7.0**, released in August 2026, is a native program rewritten in Go (8 to 12 times faster on big projects) that can't run inside a web page yet. Both versions check code the same way with these settings, so everything here applies to 7.0.

## Annotations and inference

Add a type after a name with a colon. But you rarely need to: TypeScript **infers** types from values.

```ts
let count = 0;                            // inferred: number
const title = "Parts";                    // inferred: the exact string "Parts" (a const never changes)
const prices: number[] = [600, 800];      // annotated: an array of numbers

function pounds(pence: number): string {  // parameter and return types
  return `£${(pence / 100).toFixed(2)}`;
}

count = count + 1;
console.log(pounds(prices[0] + prices[1]), count, title);
```

A good habit: **annotate function parameters** (TypeScript can't guess what callers will pass), and let inference do the rest. Return types are optional but useful on exported functions, because they state the promise the function makes.

Calls are checked against the types:

*This example raises an error on purpose.*

```ts
function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

pounds("800");        // a string where a number is needed
pounds();             // a missing argument
pounds(800, 2);       // an extra argument
```

## The basic types

| Type | Values |
|---|---|
| `string`, `number`, `boolean`, `bigint` | as in JavaScript |
| `null`, `undefined` | only those values (strict mode keeps them separate from everything else) |
| `number[]` or `Array<number>` | arrays of numbers |
| `[string, number]` | a **tuple**: exactly a string, then a number |
| `"parts"`, `42`, `true` | a **literal type**: only that exact value |
| `void` | a function that returns nothing useful |
| `any` | anything, **unchecked** |
| `unknown` | anything, but you must check what it is before using it |
| `never` | no value at all (code that can't be reached) |

## any versus unknown

`any` turns type checking **off** for a value: everything is allowed, so mistakes get through.

*This example raises an error on purpose.*

```ts
const data: any = JSON.parse('{"name": "Bell"}');
console.log(data.name.toUpperCase());     // fine
console.log(data.price.toFixed(2));       // also "fine" to TypeScript, but there's no price: it crashes
```

`unknown` is the safe version: it accepts anything, but makes you **check** before use. Use it for values from outside your program; Lesson 35 is about checking them.

*This example raises an error on purpose.*

```ts
const data: unknown = JSON.parse('{"name": "Bell"}');
console.log(data.name);                   // error: data is unknown, so check it first
```

`any` appears where JavaScript gives no information: `JSON.parse` and `res.json()` both return `any`. Avoid writing it yourself; reach for `unknown`.

## Strict mode

`"strict": true` turns on the checks that make TypeScript worth using, most importantly **strict null checks** (a `string` can't secretly be `null`) and **no implicit any** (every parameter needs a type). It's the default since TypeScript 6.0, and this sandbox always uses it.

*This example raises an error on purpose.*

```ts
function greet(name) {                  // error: name implicitly has an 'any' type
  return "Hi " + name;
}

const products = [{ name: "Bell" }];
const pump = products.find((p) => p.name === "Pump");
console.log(pump.name);                 // error: pump is possibly undefined
```

`find` returns `undefined` when nothing matches, and TypeScript makes you deal with that case. Many "cannot read properties of undefined" crashes are caught this way.

## Types disappear at runtime

TypeScript's types are **erased**: the JavaScript that runs is your code with the types removed.

```ts
// What you write                          // What runs
function pounds(pence: number): string {   function pounds(pence) {
  return `£${(pence / 100).toFixed(2)}`;     return `£${(pence / 100).toFixed(2)}`;
}                                          }
```

Two consequences:

- Types cost nothing at runtime, and any JavaScript is also valid TypeScript (perhaps with type errors to fix).
- Types **can't check data at runtime**. If an API sends a string where your type says number, TypeScript can't know. Data from outside must be checked with real code (Lesson 35).

## Running TypeScript in real projects

| Tool | What it does |
|---|---|
| `tsc` (`npm install -D typescript`) | type-checks the project, and can write the JavaScript files; TypeScript 7.0's `tsc` is the fast native compiler |
| `node file.ts` | Node.js removes the types and runs the file (**type stripping**, stable since Node.js 25.2 and 24.12). It does **not** type-check, and only supports syntax that can be erased (Lesson 34) |
| Vite, esbuild and other bundlers | remove the types while building web apps, very fast; type-checking is a separate `tsc --noEmit` step |
| your editor | runs the TypeScript language service as you type: errors, autocomplete, refactoring |

So in practice: tools strip types to run code quickly, and `tsc --noEmit` checks types in your editor and in CI (Part 7).

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Type a function | annotate parameters (and the return type) | O(1) | O(1) |
| Value of unknown shape | unknown, then check it | O(size of the check) | O(1) |
| Run TypeScript | strip types (node, bundler); check with tsc --noEmit | O(code) | O(code) |

## Common mistakes

- Using `any` to make an error go away.
- Annotating every variable instead of letting inference work.
- Expecting types to check data at runtime.
- Ignoring "possibly undefined" errors instead of handling the missing case.
- Assuming `node file.ts` type-checks the code.

## Exercises

### 1. Add the types

This JavaScript works, but strict TypeScript rejects it because the parameters have no types. Add types so that:

- `lineTotal(price, qty, discount)` takes two numbers and an **optional** number (a fraction such as `0.1` for 10% off), and returns a number;
- `label(name, qty)` takes a string and a number and returns a string.

Don't change what the functions do. The checks also make sure wrong calls, such as `lineTotal("600", 3)`, are type errors, so `any` won't pass.

Starter code:

```ts
function lineTotal(price, qty, discount) {
  const total = price * qty;
  return discount ? Math.round(total * (1 - discount)) : total;
}

function label(name, qty) {
  return `${qty} x ${name}`;
}

console.log(lineTotal(600, 3), lineTotal(600, 3, 0.1), label("Bell", 2));
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** describe what each function accepts and returns; don't change behaviour.
2. **Examples:** `lineTotal(600, 3)` has no discount, so the third parameter must be optional.
3. **Brute force:** `any` everywhere: it compiles, but checks nothing.
4. **Pattern:** **annotate the parameters, state the return type**.
5. **Plan:** price and qty `number`, `discount?: number`, returns `number`; label `string`, `number`, returns `string`.
6. **Code and test:** Run shows type errors first; then Check.

</details>

<details>
<summary>💡 Hint 1</summary>

A parameter's type goes after its name: `price: number`. The return type goes after the parentheses: `function lineTotal(...): number {`.

</details>

<details>
<summary>💡 Hint 2</summary>

A `?` after a parameter's name makes it optional: `discount?: number`. Inside the function its type is `number | undefined`.

</details>

<details>
<summary>💡 Hint 3</summary>

`label(name: string, qty: number): string`. Press Run to see any remaining type errors with their lines.

</details>

### 2. Let the compiler find the bugs

This code has type errors, and each one is a real bug. Fix the code (not by silencing TypeScript) so that it compiles and:

- `priceOf(id)` returns the price like `£6.00`, or `Unknown product` when there's no product with that id;
- `restock(id, amount)` adds `amount` to the product's stock (the amount from the form arrives as a string, so convert it before calling).

Don't use `any`, `!` or `@ts-ignore`.

Starter code:

```ts
interface Product {
  id: number;
  name: string;
  price: number;   // pence
  stock: number;
}

const products: Product[] = [
  { id: 1, name: "Inner tube", price: 600, stock: 42 },
  { id: 4, name: "Floor pump", price: 3200, stock: 7 },
];

function findProduct(id: number): Product | undefined {
  return products.find((p) => p.id === id);
}

function priceOf(id: number): string {
  const product = findProduct(id);
  return `£${(product.price / 100).toFixed(2)}`;
}

function restock(id: number, amount: number): void {
  const product = findProduct(id);
  if (product) product.stock += amount;
}

const amountFromForm = "5";
restock(4, amountFromForm);
console.log(priceOf(1), priceOf(99), products[1].stock);   // £6.00 Unknown product 12
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** each type error points at a case the code doesn't handle.
2. **Examples:** `priceOf(99)` would crash; `restock(4, "5")` would make the stock the string `"75"`.
3. **Brute force:** `product!.price` or `as any`: the errors disappear, and the crash and the string bug come back.
4. **Pattern:** **listen to the compiler**: handle `undefined`, convert strings at the boundary.
5. **Plan:** early return in `priceOf`; `Number()` when calling `restock`.
6. **Code and test:** Run until there are no type errors and the output is `£6.00 Unknown product 12`.

</details>

<details>
<summary>💡 Hint 1</summary>

Press Run: TypeScript lists two errors. Read each message and the line it points to.

</details>

<details>
<summary>💡 Hint 2</summary>

"product is possibly undefined": `findProduct` can return `undefined`. Handle that case first: `if (!product) return "Unknown product";`. After that line TypeScript knows `product` is a `Product`.

</details>

<details>
<summary>💡 Hint 3</summary>

"Argument of type 'string' is not assignable to parameter of type 'number'": convert the form value with `Number(amountFromForm)`. Without the conversion, JavaScript would have made the stock `"75"`.

</details>

**In the sandbox:** exercises 61–62. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Add the types</summary>

```ts
function lineTotal(price: number, qty: number, discount?: number): number {
  const total = price * qty;
  return discount ? Math.round(total * (1 - discount)) : total;
}

function label(name: string, qty: number): string {
  return `${qty} x ${name}`;
}

console.log(lineTotal(600, 3), lineTotal(600, 3, 0.1), label("Bell", 2));
```

**Line by line**

- `price: number, qty: number` make the multiplication type-safe: a string can no longer sneak in.
- `discount?: number` allows two arguments or three. Inside, `discount` is `number | undefined`, and `discount ? … : total` handles both (0 also means no discount).
- `: number` after the parameter list states the return type, so `const d: string = lineTotal(1, 1)` is an error.
- `label` gets `name: string, qty: number` and returns the template literal, a `string`.

**Trace:** `lineTotal(600, 3, 0.1)` → 1800 → `Math.round(1800 × 0.9)` = 1620.

**Common wrong approach:** `discount: number | undefined` instead of `discount?: number`: the type inside is the same, but callers must then always pass a third argument, so `lineTotal(600, 3)` becomes an error.

</details>

<details>
<summary>✅ 2. Let the compiler find the bugs</summary>

```ts
interface Product {
  id: number;
  name: string;
  price: number;   // pence
  stock: number;
}

const products: Product[] = [
  { id: 1, name: "Inner tube", price: 600, stock: 42 },
  { id: 4, name: "Floor pump", price: 3200, stock: 7 },
];

function findProduct(id: number): Product | undefined {
  return products.find((p) => p.id === id);
}

function priceOf(id: number): string {
  const product = findProduct(id);
  if (!product) return "Unknown product";
  return `£${(product.price / 100).toFixed(2)}`;
}

function restock(id: number, amount: number): void {
  const product = findProduct(id);
  if (product) product.stock += amount;
}

const amountFromForm = "5";
restock(4, Number(amountFromForm));
console.log(priceOf(1), priceOf(99), products[1].stock);
```

**Line by line**

- `if (!product) return "Unknown product";` handles the missing case. TypeScript **narrows** the type: below that line, `product` is `Product`, not `Product | undefined` (Lesson 32).
- `Number(amountFromForm)` converts at the boundary, where outside data (a form field) enters typed code. `restock` keeps its honest `amount: number` signature.

**Trace:** `priceOf(99)` → `findProduct` returns `undefined` → "Unknown product". `restock(4, 5)` → 7 + 5 = 12.

**Common wrong approach:** changing `restock`'s parameter to `amount: string`: the error moves, and `7 + "5"` becomes `"75"`. Types should describe what the code needs, and outside data is converted to fit them.

</details>

## Quick quiz

1. What happens to TypeScript's types when the code runs?
   - A) They're removed; the JavaScript that's left runs
   - B) They're checked again at runtime
   - C) They make the code slower

2. Which should you use for a value whose type you don't know yet, such as parsed JSON?
   - A) unknown
   - B) any
   - C) never

3. With strict mode, what is the type of products.find(...) for a Product[]?
   - A) Product | undefined
   - B) Product
   - C) any

4. What does node file.ts do in Node.js 26?
   - A) Removes the types and runs the code, without type-checking
   - B) Type-checks the file, then runs it
   - C) Fails: Node.js only runs .js files

<details>
<summary>Quiz answers</summary>

1. **A) They're removed; the JavaScript that's left runs**: Types are erased, so they can't check data at runtime.
2. **A) unknown**: unknown forces a check before use; any turns checking off.
3. **A) Product | undefined**: find returns undefined when nothing matches, and TypeScript makes you handle it.
4. **A) Removes the types and runs the code, without type-checking**: Type stripping is fast; run tsc --noEmit to check types.

</details>

---
Previous: [Lesson 30](30-product-browser.md) · Next: [Lesson 32: Object types, unions and narrowing](32-object-types.md)
