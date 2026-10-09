@@@ part
id: 6
title: TypeScript
level: Intermediate
blurb: JavaScript with types, checked before the code runs: annotations and inference, object types, unions and narrowing, typed functions and generics, classes, enums and tsconfig, and typing data that comes from APIs and JSON safely. Every example is type-checked by the real TypeScript compiler, in strict mode, right in the sandbox.

@@@ lesson
id: why-typescript
title: Why TypeScript
minutes: 24
summary: What TypeScript is and why most serious JavaScript projects use it, how the sandbox checks your code, type annotations and inference, the basic types, arrays, any versus unknown, strict mode, types being erased at runtime, and how TypeScript runs in 2026: tsc and TypeScript 7's native compiler, Node.js type stripping, and bundlers.
---
JavaScript checks types only while the code runs, so a typo or a wrong kind of value shows up as a bug, often in front of a user. **TypeScript** is JavaScript plus **type annotations**, checked by a compiler **before** the code runs:

```ts error
const product = { name: "Bell", price: 800, stock: 15 };

function totalPrice(qty: number) {
  // A typo: plain JavaScript would quietly return NaN here.
  return product.prise * qty;
}

console.log(totalPrice(2));
```

TypeScript refuses to run this: there's no `prise` on `product`, and it even suggests `price`. In plain JavaScript the same code runs and returns `NaN`, and you find out later.

That's the whole idea. TypeScript doesn't add new runtime behaviour; it reads your code, works out the type of every value, and reports mistakes, while your editor uses the same information for autocomplete, inline errors and safe renaming. Its popularity follows: most new professional JavaScript projects, and nearly every popular library, are written in it or ship types for it.

### TypeScript in this sandbox

The examples in this part are TypeScript. When you press **Run**, the sandbox:

1. type-checks your code with the real TypeScript compiler, in **strict mode**;
2. if there are type errors, shows them (with the line and a `^` under the problem) and doesn't run the code;
3. otherwise removes the types and runs the JavaScript that's left.

The first run downloads the compiler (a few megabytes, once). The sandbox uses **TypeScript 6.0**, because **TypeScript 7.0**, released in August 2026, is a native program rewritten in Go (8 to 12 times faster on big projects) that can't run inside a web page yet. Both versions check code the same way with these settings, so everything here applies to 7.0.

### Annotations and inference

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

```ts error
function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

pounds("800");        // a string where a number is needed
pounds();             // a missing argument
pounds(800, 2);       // an extra argument
```

### The basic types

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

### any versus unknown

`any` turns type checking **off** for a value: everything is allowed, so mistakes get through.

```ts error
const data: any = JSON.parse('{"name": "Bell"}');
console.log(data.name.toUpperCase());     // fine
console.log(data.price.toFixed(2));       // also "fine" to TypeScript, but there's no price: it crashes
```

`unknown` is the safe version: it accepts anything, but makes you **check** before use. Use it for values from outside your program; Lesson 35 is about checking them.

```ts error
const data: unknown = JSON.parse('{"name": "Bell"}');
console.log(data.name);                   // error: data is unknown, so check it first
```

`any` appears where JavaScript gives no information: `JSON.parse` and `res.json()` both return `any`. Avoid writing it yourself; reach for `unknown`.

### Strict mode

`"strict": true` turns on the checks that make TypeScript worth using, most importantly **strict null checks** (a `string` can't secretly be `null`) and **no implicit any** (every parameter needs a type). It's the default since TypeScript 6.0, and this sandbox always uses it.

```ts error
function greet(name) {                  // error: name implicitly has an 'any' type
  return "Hi " + name;
}

const products = [{ name: "Bell" }];
const pump = products.find((p) => p.name === "Pump");
console.log(pump.name);                 // error: pump is possibly undefined
```

`find` returns `undefined` when nothing matches, and TypeScript makes you deal with that case. Many "cannot read properties of undefined" crashes are caught this way.

### Types disappear at runtime

TypeScript's types are **erased**: the JavaScript that runs is your code with the types removed.

```ts-static
// What you write                          // What runs
function pounds(pence: number): string {   function pounds(pence) {
  return `£${(pence / 100).toFixed(2)}`;     return `£${(pence / 100).toFixed(2)}`;
}                                          }
```

Two consequences:

- Types cost nothing at runtime, and any JavaScript is also valid TypeScript (perhaps with type errors to fix).
- Types **can't check data at runtime**. If an API sends a string where your type says number, TypeScript can't know. Data from outside must be checked with real code (Lesson 35).

### Running TypeScript in real projects

| Tool | What it does |
|---|---|
| `tsc` (`npm install -D typescript`) | type-checks the project, and can write the JavaScript files; TypeScript 7.0's `tsc` is the fast native compiler |
| `node file.ts` | Node.js removes the types and runs the file (**type stripping**, stable since Node.js 25.2 and 24.12). It does **not** type-check, and only supports syntax that can be erased (Lesson 34) |
| Vite, esbuild and other bundlers | remove the types while building web apps, very fast; type-checking is a separate `tsc --noEmit` step |
| your editor | runs the TypeScript language service as you type: errors, autocomplete, refactoring |

So in practice: tools strip types to run code quickly, and `tsc --noEmit` checks types in your editor and in CI (Part 7).

:::exercise Add the types
This JavaScript works, but strict TypeScript rejects it because the parameters have no types. Add types so that:

- `lineTotal(price, qty, discount)` takes two numbers and an **optional** number (a fraction such as `0.1` for 10% off), and returns a number;
- `label(name, qty)` takes a string and a number and returns a string.

Don't change what the functions do. The checks also make sure wrong calls, such as `lineTotal("600", 3)`, are type errors, so `any` won't pass.
```ts starter
function lineTotal(price, qty, discount) {
  const total = price * qty;
  return discount ? Math.round(total * (1 - discount)) : total;
}

function label(name, qty) {
  return `${qty} x ${name}`;
}

console.log(lineTotal(600, 3), lineTotal(600, 3, 0.1), label("Bell", 2));
```
```ts typecheck
const a: number = lineTotal(600, 3);
const b: number = lineTotal(600, 3, 0.1);
const c: string = label("Bell", 2);
// @ts-expect-error the price must be a number
lineTotal("600", 3);
// @ts-expect-error the discount must be a number
lineTotal(600, 3, "10%");
// @ts-expect-error the quantity must be a number
label("Bell", "2");
// @ts-expect-error lineTotal should return a number, not a string
const d: string = lineTotal(1, 1);
```
```js check
test("lineTotal", [
  [[600, 3], 1800, "no discount"],
  [[600, 3, 0.1], 1620, "10% off"],
  [[450, 2, 0.25], 675, "25% off"],
]);
test("label", [[["Bell", 2], "2 x Bell", "a bell"]]);
```
```ts solution
function lineTotal(price: number, qty: number, discount?: number): number {
  const total = price * qty;
  return discount ? Math.round(total * (1 - discount)) : total;
}

function label(name: string, qty: number): string {
  return `${qty} x ${name}`;
}

console.log(lineTotal(600, 3), lineTotal(600, 3, 0.1), label("Bell", 2));
```
hint: A parameter's type goes after its name: `price: number`. The return type goes after the parentheses: `function lineTotal(...): number {`.
hint: A `?` after a parameter's name makes it optional: `discount?: number`. Inside the function its type is `number | undefined`.
hint: `label(name: string, qty: number): string`. Press Run to see any remaining type errors with their lines.
approach:
1. **Understand:** describe what each function accepts and returns; don't change behaviour.
2. **Examples:** `lineTotal(600, 3)` has no discount, so the third parameter must be optional.
3. **Brute force:** `any` everywhere: it compiles, but checks nothing.
4. **Pattern:** **annotate the parameters, state the return type**.
5. **Plan:** price and qty `number`, `discount?: number`, returns `number`; label `string`, `number`, returns `string`.
6. **Code and test:** Run shows type errors first; then Check.
walkthrough:
**Line by line**

- `price: number, qty: number` make the multiplication type-safe: a string can no longer sneak in.
- `discount?: number` allows two arguments or three. Inside, `discount` is `number | undefined`, and `discount ? … : total` handles both (0 also means no discount).
- `: number` after the parameter list states the return type, so `const d: string = lineTotal(1, 1)` is an error.
- `label` gets `name: string, qty: number` and returns the template literal, a `string`.

**Trace:** `lineTotal(600, 3, 0.1)` → 1800 → `Math.round(1800 × 0.9)` = 1620.

**Common wrong approach:** `discount: number | undefined` instead of `discount?: number`: the type inside is the same, but callers must then always pass a third argument, so `lineTotal(600, 3)` becomes an error.
:::

:::exercise Let the compiler find the bugs
This code has type errors, and each one is a real bug. Fix the code (not by silencing TypeScript) so that it compiles and:

- `priceOf(id)` returns the price like `£6.00`, or `Unknown product` when there's no product with that id;
- `restock(id, amount)` adds `amount` to the product's stock (the amount from the form arrives as a string, so convert it before calling).

Don't use `any`, `!` or `@ts-ignore`.
```ts starter
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
```js check
if (/@ts-(ignore|nocheck|expect-error)|\bas any\b|:\s*any\b|\w!\./.test(__source__)) {
  throw new AssertionError("Fix the bugs instead of silencing TypeScript (no any, no ! and no @ts-ignore).");
}
test("priceOf", [[[1], "£6.00", "the inner tube"], [[4], "£32.00", "the pump"], [[99], "Unknown product", "a missing id"]]);
const ps = need("products");
same(ps[1].stock, 12, "The pump's stock after restock(4, …) with the amount from the form");
need("restock", "function")(1, 3);
same(ps[0].stock, 45, "The inner tube's stock after restock(1, 3)");
```
```ts solution
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
hint: Press Run: TypeScript lists two errors. Read each message and the line it points to.
hint: "product is possibly undefined": `findProduct` can return `undefined`. Handle that case first: `if (!product) return "Unknown product";`. After that line TypeScript knows `product` is a `Product`.
hint: "Argument of type 'string' is not assignable to parameter of type 'number'": convert the form value with `Number(amountFromForm)`. Without the conversion, JavaScript would have made the stock `"75"`.
approach:
1. **Understand:** each type error points at a case the code doesn't handle.
2. **Examples:** `priceOf(99)` would crash; `restock(4, "5")` would make the stock the string `"75"`.
3. **Brute force:** `product!.price` or `as any`: the errors disappear, and the crash and the string bug come back.
4. **Pattern:** **listen to the compiler**: handle `undefined`, convert strings at the boundary.
5. **Plan:** early return in `priceOf`; `Number()` when calling `restock`.
6. **Code and test:** Run until there are no type errors and the output is `£6.00 Unknown product 12`.
walkthrough:
**Line by line**

- `if (!product) return "Unknown product";` handles the missing case. TypeScript **narrows** the type: below that line, `product` is `Product`, not `Product | undefined` (Lesson 32).
- `Number(amountFromForm)` converts at the boundary, where outside data (a form field) enters typed code. `restock` keeps its honest `amount: number` signature.

**Trace:** `priceOf(99)` → `findProduct` returns `undefined` → "Unknown product". `restock(4, 5)` → 7 + 5 = 12.

**Common wrong approach:** changing `restock`'s parameter to `amount: string`: the error moves, and `7 + "5"` becomes `"75"`. Types should describe what the code needs, and outside data is converted to fit them.
:::

:::quiz
? What happens to TypeScript's types when the code runs?
+ They're removed; the JavaScript that's left runs
- They're checked again at runtime
- They make the code slower
= Types are erased, so they can't check data at runtime.
? Which should you use for a value whose type you don't know yet, such as parsed JSON?
+ unknown
- any
- never
= unknown forces a check before use; any turns checking off.
? With strict mode, what is the type of products.find(...) for a Product[]?
+ Product | undefined
- Product
- any
= find returns undefined when nothing matches, and TypeScript makes you handle it.
? What does node file.ts do in Node.js 26?
+ Removes the types and runs the code, without type-checking
- Type-checks the file, then runs it
- Fails: Node.js only runs .js files
= Type stripping is fast; run tsc --noEmit to check types.
:::

@@@ lesson
id: object-types
title: Object types, unions and narrowing
minutes: 26
summary: Describing objects with type aliases and interfaces, optional and readonly properties, excess property checks, union and literal types, narrowing with typeof, truthiness, equality, in and instanceof, discriminated unions with exhaustiveness checks, null and undefined with optional chaining, type assertions and their risks, and satisfies.
---
Most data in a program is objects: products, orders, customers. This lesson shows how to describe them, and how TypeScript follows your `if`s to know exactly what a value can be at each line.

### Describing objects

A **type alias** gives a name to any type; an **interface** names an object shape. For objects they're nearly interchangeable; many teams use `interface` for objects and `type` for everything else.

```ts
type Category = "parts" | "tools" | "accessories";     // a union of literal types

interface Product {
  readonly id: number;        // can't be changed after creation
  name: string;
  category: Category;
  price: number;              // pence
  salePrice?: number;         // optional: a number, or not there at all
}

const pump: Product = { id: 4, name: "Floor pump", category: "tools", price: 3200 };
const price = pump.salePrice ?? pump.price;    // salePrice is number | undefined
console.log(pump.name, price);
```

Each of these is an error:

```ts error
type Category = "parts" | "tools" | "accessories";
interface Product { readonly id: number; name: string; category: Category; price: number; salePrice?: number }

const lights: Product = { id: 9, name: "Lights", category: "lighting", price: 1500 };   // not a Category
const lamp: Product = { id: 9, name: "Lamp", category: "tools" };                         // price is missing
const bell: Product = { id: 2, name: "Bell", category: "parts", price: 800, colour: "red" };   // unknown property
bell.id = 3;                                                                              // id is readonly
```

The `colour` error is an **excess property check**: an object literal written directly where a `Product` is expected may only have known properties, which catches typos in property names.

### Union types and narrowing

A **union** `A | B` is a value that's either. Before you use it, TypeScript makes you check which; it follows the check and **narrows** the type inside each branch:

```ts
function formatPrice(price: number | string): string {
  if (typeof price === "string") return price;      // here: string
  return `£${(price / 100).toFixed(2)}`;            // here: number
}
console.log(formatPrice(800), formatPrice("Free"));

function shout(text: string | null | undefined): string {
  if (!text) return "(nothing)";                    // removes null, undefined (and "")
  return text.toUpperCase();                        // here: string
}
console.log(shout("hi"), shout(null));
```

| Check | Narrows by |
|---|---|
| `typeof x === "string"` | primitive type (`"string"`, `"number"`, `"boolean"`, `"object"`, `"function"`, `"undefined"`, `"bigint"`, `"symbol"`) |
| `if (x)`, `if (!x)` | truthiness: removes `null` and `undefined` (careful: also `0` and `""`) |
| `x === null`, `x !== undefined`, `x === "card"` | equality |
| `"email" in x` | whether an object has a property |
| `x instanceof Date` | class |
| `Array.isArray(x)` | arrays |

Narrowing also works with early returns: after `if (!product) return …;`, the rest of the function knows `product` is defined.

### Discriminated unions

The most useful pattern in TypeScript: a union of object types that share a **literal** property, the **discriminant** (here `kind`), telling them apart:

```ts
type Shipping =
  | { kind: "pickup" }
  | { kind: "standard"; days: number }
  | { kind: "express"; days: number; fee: number };

function describe(s: Shipping): string {
  switch (s.kind) {
    case "pickup":
      return "Collect from the shop";
    case "standard":
      return `Free, ${s.days} days`;                      // s has days here
    case "express":
      return `£${(s.fee / 100).toFixed(2)}, next day`;    // s has fee here
    default: {
      const unhandled: never = s;                         // a compile error if a kind is forgotten
      return unhandled;
    }
  }
}
console.log(describe({ kind: "express", days: 1, fee: 799 }));
console.log(describe({ kind: "pickup" }));
```

Inside each `case`, TypeScript knows which member `s` is, so `s.fee` is allowed only for express. The `default` branch is an **exhaustiveness check**: if someone adds `{ kind: "locker" }` to `Shipping` and forgets this switch, `s` is no longer `never` there and the code stops compiling, pointing straight at the place to update.

The same idea models states (`{ status: "loading" } | { status: "ready"; data: … } | { status: "error"; message: string }`) and results (Lesson 35), and it makes impossible combinations, such as "ready but with an error message", impossible to write.

### null and undefined

With strict null checks, `null` and `undefined` only go where a type says so. Optional chaining and `??` work with the types:

```ts
interface Customer { name: string; email?: string; address?: { city: string } }

const bo: Customer = { name: "Bo" };
console.log(bo.email?.toLowerCase());          // string | undefined: undefined here
console.log(bo.address?.city ?? "no address");
```

The same applies to the DOM: `document.querySelector` returns `Element | null`, so TypeScript makes you handle a missing element. Its generic form returns a specific element type:

```ts-static
const qty = document.querySelector<HTMLInputElement>("#qty");   // HTMLInputElement | null
if (qty) console.log(qty.valueAsNumber);
```

### Type assertions: as

`value as Type` tells TypeScript "trust me". It checks **nothing** at runtime, so a wrong assertion is a bug TypeScript can no longer see:

```ts-static
const product = JSON.parse(text) as Product;   // if the JSON isn't a product, you'll find out later
const el = document.querySelector("#qty") as HTMLInputElement;   // and if #qty doesn't exist?
```

The `!` after an expression (`maybe!.name`) is a shorter assertion: "this isn't null or undefined". Prefer narrowing with a real check. Assertions are for the rare cases where you know more than the compiler can, for example after validating data.

### satisfies

`satisfies` checks that a value matches a type **without** changing the value's inferred type, so you keep the precise details:

```ts
type Prices = Record<string, number>;

const prices = { bell: 800, pump: 3200 } satisfies Prices;   // checked: every value is a number
console.log(prices.bell + prices.pump);                    // and TypeScript still knows bell and pump exist
```

With `const prices: Prices = …` instead, `prices.bel` (a typo) would also be allowed, because a `Record<string, number>` may have any key.

:::exercise Model the payments
A shop accepts three kinds of payment. Define a type `Payment` as a **discriminated union** on `kind`:

- `{ kind: "card", last4: string }`
- `{ kind: "paypal", email: string }`
- `{ kind: "voucher", code: string, value: number }` (value in pence)

Then write `describePayment(p: Payment): string`, returning `Card ending 4242`, `PayPal (ada@example.com)` or `Voucher SPRING (£5.00)`.
```ts starter
// type Payment = ...

function describePayment(p: Payment): string {
  return "";
}

console.log(describePayment({ kind: "card", last4: "4242" }));
console.log(describePayment({ kind: "voucher", code: "SPRING", value: 500 }));
```
```ts typecheck
const all: Payment[] = [
  { kind: "card", last4: "4242" },
  { kind: "paypal", email: "ada@example.com" },
  { kind: "voucher", code: "SPRING", value: 500 },
];
// @ts-expect-error a card payment needs last4
const p1: Payment = { kind: "card" };
// @ts-expect-error a voucher's value is a number of pence
const p2: Payment = { kind: "voucher", code: "X", value: "5" };
// @ts-expect-error there's no "cash" kind
const p3: Payment = { kind: "cash" };
// @ts-expect-error a card payment has no email
const p4: Payment = { kind: "card", last4: "1111", email: "a@b.c" };
```
```js check
test("describePayment", [
  [[{ kind: "card", last4: "4242" }], "Card ending 4242", "a card"],
  [[{ kind: "paypal", email: "ada@example.com" }], "PayPal (ada@example.com)", "PayPal"],
  [[{ kind: "voucher", code: "SPRING", value: 500 }], "Voucher SPRING (£5.00)", "a voucher"],
  [[{ kind: "voucher", code: "TEN", value: 1050 }], "Voucher TEN (£10.50)", "another voucher"],
]);
```
```ts solution
type Payment =
  | { kind: "card"; last4: string }
  | { kind: "paypal"; email: string }
  | { kind: "voucher"; code: string; value: number };

function describePayment(p: Payment): string {
  switch (p.kind) {
    case "card":
      return `Card ending ${p.last4}`;
    case "paypal":
      return `PayPal (${p.email})`;
    case "voucher":
      return `Voucher ${p.code} (£${(p.value / 100).toFixed(2)})`;
    default: {
      const unhandled: never = p;
      return unhandled;
    }
  }
}

console.log(describePayment({ kind: "card", last4: "4242" }));
console.log(describePayment({ kind: "voucher", code: "SPRING", value: 500 }));
```
hint: A union of object types: `type Payment = | { kind: "card"; last4: string } | { … } | { … };`. Each `kind` is a literal type in quotes.
hint: `switch (p.kind)` with one `case` per kind. Inside `case "card":`, TypeScript knows `p.last4` exists.
hint: Format the voucher with `(p.value / 100).toFixed(2)`. Add a `default` with `const unhandled: never = p;` so a future fourth kind can't be forgotten.
approach:
1. **Understand:** three shapes that share a `kind` field, and a function that handles each.
2. **Examples:** a card with an email is invalid; a voucher's value is a number.
3. **Brute force:** one object type with every field optional: everything compiles, including nonsense like a card without `last4`.
4. **Pattern:** **discriminated union + switch on the discriminant**.
5. **Plan:** declare the union → switch on `kind` → return the text per case → `never` default.
6. **Code and test:** Run, then Check; the checks also try invalid payments.
walkthrough:
**Line by line**

- Each member of `Payment` has a different literal `kind`, so TypeScript can tell them apart.
- In `case "card":`, `p` is narrowed to `{ kind: "card"; last4: string }`; `p.email` would be an error there.
- The voucher formats pence as pounds.
- The `never` default costs nothing at runtime and turns "forgot a case" into a compile error.

**Trace:** `{ kind: "voucher", code: "TEN", value: 1050 }` → case "voucher" → `10.50` → "Voucher TEN (£10.50)".

**Common wrong approach:** `interface Payment { kind: string; last4?: string; email?: string; code?: string; value?: number }`: it accepts `{ kind: "card" }` with no card number, and every use needs checks for fields that "might" be missing.
:::

:::exercise Handle the missing values
`contactLine(id)` should return a line about a customer, but the starter doesn't compile: some values may be missing. Fix it without `!`, `any` or `@ts-ignore`:

- unknown id → `No customer 9` (with the id);
- the email, if there is one, in lower case: `Ada <ada@example.com>`; otherwise `Bo (no email)`;
- then, if the customer has an address, ` in Leeds` (their city).
```ts starter
interface Customer {
  id: number;
  name: string;
  email?: string;
  address?: { city: string; postcode?: string };
}

const customers: Customer[] = [
  { id: 1, name: "Ada", email: "Ada@Example.com", address: { city: "Leeds" } },
  { id: 2, name: "Bo" },
  { id: 3, name: "Cy", address: { city: "York", postcode: "YO1 7HH" } },
];

function contactLine(id: number): string {
  const c = customers.find((c) => c.id === id);
  let line = `${c.name} <${c.email.toLowerCase()}>`;
  line += ` in ${c.address.city}`;
  return line;
}

console.log(contactLine(1));
console.log(contactLine(2));
```
```js check
if (/@ts-(ignore|nocheck|expect-error)|\bas any\b|:\s*any\b|\w!\./.test(__source__)) {
  throw new AssertionError("Handle the missing values instead of silencing TypeScript (no any, no ! and no @ts-ignore).");
}
test("contactLine", [
  [[1], "Ada <ada@example.com> in Leeds", "a customer with email and address"],
  [[2], "Bo (no email)", "a customer with neither"],
  [[3], "Cy (no email) in York", "a customer with an address only"],
  [[9], "No customer 9", "an unknown id"],
]);
```
```ts solution
interface Customer {
  id: number;
  name: string;
  email?: string;
  address?: { city: string; postcode?: string };
}

const customers: Customer[] = [
  { id: 1, name: "Ada", email: "Ada@Example.com", address: { city: "Leeds" } },
  { id: 2, name: "Bo" },
  { id: 3, name: "Cy", address: { city: "York", postcode: "YO1 7HH" } },
];

function contactLine(id: number): string {
  const c = customers.find((c) => c.id === id);
  if (!c) return `No customer ${id}`;
  let line = c.email ? `${c.name} <${c.email.toLowerCase()}>` : `${c.name} (no email)`;
  if (c.address) line += ` in ${c.address.city}`;
  return line;
}

console.log(contactLine(1));
console.log(contactLine(2));
```
hint: Run it: TypeScript reports three "possibly undefined" errors. Each one is a case to handle.
hint: Start with `if (!c) return \`No customer ${id}\`;`: below it, `c` is a `Customer`.
hint: Choose the first part with `c.email ? … : …`, and add the city inside `if (c.address) { … }`. Each check narrows that property for the code it guards.
approach:
1. **Understand:** three values might be missing: the customer, the email, the address.
2. **Examples:** Cy has an address but no email: "Cy (no email) in York".
3. **Brute force:** `c!.email!.toLowerCase()`: compiles, then crashes for Bo.
4. **Pattern:** **narrow, then use**: check each optional value right before you need it.
5. **Plan:** early return for no customer → email or "(no email)" → city if any.
6. **Code and test:** Run with ids 1, 2, 3 and 9.
walkthrough:
**Line by line**

- `if (!c) return …` handles a missing customer and narrows `c` to `Customer` for the rest of the function.
- `c.email ? … : …` narrows `c.email` to `string` in the first branch, so `toLowerCase()` is allowed.
- `if (c.address)` narrows `c.address` to `{ city: string; … }` inside the `if`.

**Trace:** id 3 → Cy → no email → "Cy (no email)" → address → " in York".

**Common wrong approach:** `c?.email?.toLowerCase()` everywhere: it compiles, but produces lines like "undefined <undefined>" instead of the text the requirement asks for. Optional chaining avoids crashes; it doesn't decide what to show.
:::

:::quiz
? What is the type of x inside if (typeof x === "string") when x is string | number?
+ string
- string | number
- unknown
= TypeScript narrows the union using the check.
? What makes a union a discriminated union?
+ Every member has a common property with a different literal type, like kind
- Every member is an interface
- It has exactly two members
= Checking the discriminant narrows to one member.
? Why put const unhandled: never = s in a switch's default branch?
+ So that forgetting to handle a new member becomes a compile error
- To make the switch faster
- Because switch statements require it
= If a case is missing, s isn't never there, and the assignment fails to compile.
? What does value as Product check at runtime?
+ Nothing: it only tells the compiler to trust you
- That value has every Product property
- That value isn't null
= Assertions are erased like all types; validate data with real code instead.
:::

@@@ lesson
id: functions-and-generics
title: Typed functions and generics
minutes: 26
summary: Typing parameters, optional and default parameters, rest parameters and return types, function types and callbacks, void, generic functions with type parameters, constraints with extends, keyof and indexed access types, generic types such as Array, Promise, Map and Record, the utility types Partial, Required, Readonly, Pick, Omit and ReturnType, and deriving types from values with typeof and as const.
---
Functions are where types pay off most: every caller is checked against the signature, and editors show it as you type. Generics then let one function work with many types without giving up checking.

### Function signatures

```ts
function log(message: string, level: "info" | "warn" = "info"): void {   // default value: level is optional
  console.log(`[${level}] ${message}`);
}
log("ready");
log("low stock", "warn");

function sum(...values: number[]): number {              // rest parameter: any number of numbers
  return values.reduce((a, b) => a + b, 0);
}
console.log(sum(600, 800, 450));

type PriceTest = (pence: number) => boolean;             // a function type
const cheap: PriceTest = (p) => p < 1000;                // p is inferred as number from the type
const countIf = (prices: number[], test: PriceTest) => prices.filter(test).length;
console.log(countIf([600, 800, 4500], cheap));
```

- `void` means "returns nothing useful". A callback typed as returning `void` may still return something; the caller just ignores it.
- When a function is passed where a function type is expected (like `cheap` and the callback of `filter`), its parameters get their types **from context**, so you don't repeat them.

### Generics: types as parameters

How do you type a function that returns the first item of **any** array? With `any`, the result loses its type. A **generic** function takes a **type parameter**, written in angle brackets, that TypeScript fills in at each call:

```ts
function first<T>(items: T[]): T | undefined {
  return items[0];
}

const n = first([3, 1, 2]);              // T is number, so n is number | undefined
const s = first(["bell", "pump"]);       // T is string
console.log(n, s?.toUpperCase());
```

You rarely write the type argument (`first<number>(…)`): TypeScript infers it from the arguments. You've already been using generic types: `Array<T>` (written `T[]`), `Promise<T>`, `Map<K, V>`, `Set<T>`.

### Constraints and keyof

`T extends …` limits what `T` can be, so the function can use what the constraint guarantees:

```ts
function longest<T extends { length: number }>(a: T, b: T): T {
  return b.length > a.length ? b : a;           // allowed: every T has a length
}
console.log(longest("bell", "pump!"), longest([1, 2], [1, 2, 3]));

function getField<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
const bell = { name: "Bell", price: 800 };
const price = getField(bell, "price");          // number: the type of bell.price
console.log(price + 1);
```

- `keyof T` is the union of `T`'s property names: for `bell`, `"name" | "price"`.
- `T[K]` is an **indexed access type**: the type of property `K` of `T`.
- Together they make `getField(bell, "prise")` a compile error and give the result the right type.

### Generic types

Types can take parameters too. A result type that's either a value or an error message:

```ts
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function parseQty(text: string): Result<number> {
  const n = Number(text);
  return Number.isInteger(n) && n > 0 ? { ok: true, value: n } : { ok: false, error: `Not a quantity: ${text}` };
}

for (const input of ["3", "two"]) {
  const r = parseQty(input);
  console.log(r.ok ? r.value * 600 : r.error);      // narrowed by ok
}
```

`Record<K, V>` is an object with keys `K` and values `V`: `Record<string, number>` for a price list, or `Record<"parts" | "tools", Product[]>` for exactly two keys.

### Utility types

TypeScript includes **utility types** that build new types from existing ones, so you don't repeat yourself:

| Utility | Gives | Typical use |
|---|---|---|
| `Partial<T>` | every property optional | a patch or update |
| `Required<T>` | every property required | after filling in defaults |
| `Readonly<T>` | every property read-only | data that mustn't change |
| `Pick<T, "a" \| "b">` | only those properties | a summary or a public view |
| `Omit<T, "id">` | every property except those | data for creating something (the server assigns the id) |
| `ReturnType<typeof fn>` | what a function returns | reusing a type you didn't name |
| `Awaited<T>` | what a promise resolves to | `Awaited<ReturnType<typeof load>>` |

```ts
interface Product { id: number; name: string; price: number; stock: number }

type NewProduct = Omit<Product, "id">;                 // the server assigns ids
type ProductPatch = Partial<NewProduct>;               // change any of the rest
type ProductSummary = Pick<Product, "id" | "name">;

const draft: NewProduct = { name: "Lights", price: 1500, stock: 10 };
const patch: ProductPatch = { price: 1400 };
const summary: ProductSummary = { id: 7, name: "Lights" };
console.log(draft, patch, summary);
```

### Types from values: typeof and as const

Sometimes the value comes first. `as const` makes a literal as specific as possible (read-only, with literal types), and `typeof` turns a value into a type:

```ts
const CATEGORIES = ["parts", "tools", "accessories"] as const;
type Category = (typeof CATEGORIES)[number];          // "parts" | "tools" | "accessories"

const defaults = { currency: "GBP", pageSize: 20 };
type Settings = typeof defaults;                      // { currency: string; pageSize: number }

const pick: Category = "tools";
console.log(CATEGORIES.length, pick, defaults.pageSize);
```

Now the list of categories exists once, as a value you can loop over and show in a menu, and the type follows it automatically.

:::exercise A typed pluck
Write a generic function `pluck(items, key)` that returns an array of each item's value for `key`: `pluck(products, "name")` gives the names.

Its types must be precise: the key must be a property of the items, and the result must have that property's type (`string[]` for names, `number[]` for prices). Use type parameters `T` and `K extends keyof T`.
```ts starter
function pluck(items: any[], key: string): any[] {
  return [];
}

const products = [
  { id: 1, name: "Inner tube", price: 600 },
  { id: 2, name: "Bell", price: 800 },
];
console.log(pluck(products, "name"), pluck(products, "price"));
```
```ts typecheck
const ps = [{ id: 1, name: "Bell", price: 800 }, { id: 2, name: "Pump", price: 3200 }];
const names: string[] = pluck(ps, "name");
const prices: number[] = pluck(ps, "price");
const none: number[] = pluck([] as { id: number }[], "id");
// @ts-expect-error "prise" isn't a property of the products
pluck(ps, "prise");
// @ts-expect-error prices are numbers, so the result isn't a string[]
const wrong: string[] = pluck(ps, "price");
```
```js check
const ps = [{ id: 1, name: "Inner tube", price: 600 }, { id: 2, name: "Bell", price: 800 }];
test("pluck", [
  [[ps, "name"], ["Inner tube", "Bell"], "names"],
  [[ps, "price"], [600, 800], "prices"],
  [[[], "id"], [], "an empty array"],
]);
```
```ts solution
function pluck<T, K extends keyof T>(items: T[], key: K): T[K][] {
  return items.map((item) => item[key]);
}

const products = [
  { id: 1, name: "Inner tube", price: 600 },
  { id: 2, name: "Bell", price: 800 },
];
console.log(pluck(products, "name"), pluck(products, "price"));
```
hint: Declare the type parameters after the name: `function pluck<T, K extends keyof T>(items: T[], key: K)`.
hint: The type of `item[key]` is `T[K]`, so the function returns `T[K][]` (an array of those).
hint: The body is one line: `return items.map((item) => item[key]);`.
approach:
1. **Understand:** a runtime one-liner, with types that track which key was chosen.
2. **Examples:** key `"price"` → `number[]`; key `"prise"` → compile error.
3. **Brute force:** `any[]`: works at runtime, but every result is `any` and typos compile.
4. **Pattern:** **generic + `keyof` constraint + indexed access type**.
5. **Plan:** `<T, K extends keyof T>`, `items: T[]`, `key: K`, returns `T[K][]`, body `map`.
6. **Code and test:** hover over results in a real editor; here, the checks test the types.
walkthrough:
**Line by line**

- `T` is the item type, inferred from the array you pass.
- `K extends keyof T` means `key` must be one of `T`'s property names, so `"prise"` is rejected.
- `T[K][]` says the result is an array of that property's type: for `"price"`, `number[]`.
- `items.map((item) => item[key])` does the work; `item[key]` has type `T[K]`.

**Trace:** `pluck(products, "name")`: `T` = `{ id: number; name: string; price: number }`, `K` = `"name"`, result type `string[]`, value `["Inner tube", "Bell"]`.

**Common wrong approach:** `function pluck<T>(items: T[], key: keyof T): T[keyof T][]`: typos are caught, but the result is `(string | number)[]`, the union of every property's type, because `key` isn't its own type parameter.
:::

:::exercise Typed updates
Write `applyUpdate(product, changes)` that returns a **new** product with the changes applied, leaving the original unchanged. Type `changes` with utility types so that:

- any of `name`, `price` and `stock` may be changed, alone or together, or none;
- `id` can't be changed;
- wrong types and unknown properties are errors.
```ts starter
interface Product {
  readonly id: number;
  name: string;
  price: number;
  stock: number;
}

function applyUpdate(product: Product, changes: any): Product {
  return product;
}

const bell: Product = { id: 2, name: "Bell", price: 800, stock: 15 };
console.log(applyUpdate(bell, { price: 750 }), bell.price);
```
```ts typecheck
const p: Product = { id: 2, name: "Bell", price: 800, stock: 15 };
const a: Product = applyUpdate(p, { price: 750 });
applyUpdate(p, { name: "Brass bell", stock: 3 });
applyUpdate(p, {});
// @ts-expect-error the id can't be changed
applyUpdate(p, { id: 9 });
// @ts-expect-error prices are numbers
applyUpdate(p, { price: "7.50" });
// @ts-expect-error products have no colour
applyUpdate(p, { colour: "red" });
```
```js check
const bell = { id: 2, name: "Bell", price: 800, stock: 15 };
test("applyUpdate", [
  [[bell, { price: 750 }], { id: 2, name: "Bell", price: 750, stock: 15 }, "a new price"],
  [[bell, { name: "Brass bell", stock: 3 }], { id: 2, name: "Brass bell", price: 800, stock: 3 }, "two changes"],
  [[bell, {}], { id: 2, name: "Bell", price: 800, stock: 15 }, "no changes"],
]);
const original = { id: 4, name: "Floor pump", price: 3200, stock: 7 };
const updated = need("applyUpdate", "function")(original, { stock: 0 });
if (updated === original || original.stock !== 7) throw new AssertionError("applyUpdate changed the original product. Return a new object instead (spread syntax).");
```
```ts solution
interface Product {
  readonly id: number;
  name: string;
  price: number;
  stock: number;
}

function applyUpdate(product: Product, changes: Partial<Omit<Product, "id">>): Product {
  return { ...product, ...changes };
}

const bell: Product = { id: 2, name: "Bell", price: 800, stock: 15 };
console.log(applyUpdate(bell, { price: 750 }), bell.price);
```
hint: `Omit<Product, "id">` is a product without its id; `Partial<…>` makes every remaining property optional. Combine them.
hint: `changes: Partial<Omit<Product, "id">>`. An object literal passed for it can't contain `id` or unknown properties.
hint: Build the new object with spread syntax: `return { ...product, ...changes };` (later properties win).
approach:
1. **Understand:** a non-mutating update whose argument type allows exactly the editable fields.
2. **Examples:** `{ price: 750 }` ok; `{ id: 9 }` and `{ price: "7.50" }` rejected.
3. **Brute force:** writing a second interface by hand with optional name, price and stock: works until someone adds a field to `Product` and forgets the copy.
4. **Pattern:** **derive types with utility types**.
5. **Plan:** `Partial<Omit<Product, "id">>` → spread the product, then the changes.
6. **Code and test:** Run; the checks try valid and invalid updates.
walkthrough:
**Line by line**

- `Omit<Product, "id">` is `{ name: string; price: number; stock: number }`.
- `Partial<…>` makes each optional: `{ name?: string; price?: number; stock?: number }`, so `{}` and any combination are allowed.
- The type follows `Product` automatically: add a `colour` field there and updates accept it.
- `{ ...product, ...changes }` copies the product and overwrites the changed properties, producing a new object.

**Trace:** `applyUpdate(bell, { price: 750 })` → `{ id: 2, name: "Bell", price: 800, stock: 15, price: 750 }` → the later `price` wins → 750.

**Common wrong approach:** `Object.assign(product, changes)`: it returns the right values, but modifies the original product, which callers (and the `readonly` intent) don't expect.
:::

:::quiz
? function first<T>(items: T[]): T | undefined is called as first(["a", "b"]). What is T?
+ string, inferred from the argument
- any
- unknown, until you write first<string>
= TypeScript infers type arguments from the values you pass.
? For const p = { name: "Bell", price: 800 }, what is keyof typeof p?
+ "name" | "price"
- string
- ["name", "price"]
= keyof gives the union of property names.
? Which type describes a Product without its id, with every other property optional?
+ Partial<Omit<Product, "id">>
- Omit<Partial<Product>>
- Pick<Product, "id">
= Omit removes id; Partial makes the rest optional.
? What does as const do to ["parts", "tools"]?
+ Makes it a read-only tuple of the literal types "parts" and "tools"
- Makes it impossible to read
- Converts it to an object
= Then (typeof X)[number] is the union "parts" | "tools".
:::

@@@ lesson
id: classes-and-tsconfig
title: Classes, enums, modules and tsconfig
minutes: 26
summary: Typing classes (fields, constructors, getters, readonly, TypeScript's private versus JavaScript's #private, implements, abstract), parameter properties, enums versus unions of literal types and erasable syntax, typed modules and import type, declaration files and @types packages, and a 2026 tsconfig.json: strict, target, module, noUncheckedIndexedAccess, verbatimModuleSyntax and erasableSyntaxOnly.
---
This lesson covers the rest of what you'll meet in a real TypeScript project: classes with types, enums (and why many teams avoid them now), modules, and the `tsconfig.json` file that configures the compiler.

### Typed classes

```ts
interface CartLine { productId: number; qty: number; price: number }

class Cart {
  readonly customer: string;                     // set once, in the constructor
  #lines = new Map<number, CartLine>();          // private, enforced by JavaScript itself

  constructor(customer: string) {
    this.customer = customer;
  }

  add(line: CartLine): void {
    const existing = this.#lines.get(line.productId);
    this.#lines.set(line.productId, existing ? { ...existing, qty: existing.qty + line.qty } : line);
  }

  get total(): number {                          // a getter: read like a property, cart.total
    let sum = 0;
    for (const l of this.#lines.values()) sum += l.price * l.qty;
    return sum;
  }
}

const cart = new Cart("Ada");
cart.add({ productId: 2, qty: 1, price: 800 });
cart.add({ productId: 2, qty: 2, price: 800 });
console.log(cart.customer, cart.total);
```

Fields are declared in the class body with their types. In strict mode every field must be given a value, in its declaration or in the constructor.

**`private` or `#private`?** TypeScript's `private` keyword is checked only by the compiler; it's erased, so at runtime the field is an ordinary property anyone can read. JavaScript's `#name` fields (Lesson 16) are private at runtime too. Prefer `#` in new code; you'll see `private` in a lot of existing code.

`implements` checks that a class has everything an interface requires, and `abstract` classes can declare methods that subclasses must provide:

```ts-static
interface Priced { readonly price: number }

abstract class Item implements Priced {
  abstract readonly price: number;        // every subclass must define it
  describe(): string { return `£${(this.price / 100).toFixed(2)}`; }
}
```

### Parameter properties

TypeScript has a shortcut that declares and assigns a field from a constructor parameter:

```ts-static
class Customer {
  constructor(readonly name: string, private email: string) {}   // creates this.name and this.email
}
```

It's compact, but it isn't just types: it **generates** code (the assignments). That matters for the next topic.

### Enums, unions and erasable syntax

An `enum` names a set of constants:

```ts
enum Status { Placed = "placed", Packed = "packed", Shipped = "shipped" }

const s: Status = Status.Packed;
console.log(s, Object.values(Status));
```

Like parameter properties, an enum isn't erased: it **becomes a JavaScript object**. Tools that run TypeScript by just deleting the types, such as Node.js's type stripping (Lesson 31), can't handle it: Node.js stops with an error. The common modern alternative is a union of literal types, with an `as const` array when you also need the values at runtime:

```ts
const STATUSES = ["placed", "packed", "shipped"] as const;
type Status = (typeof STATUSES)[number];               // "placed" | "packed" | "shipped"

const s: Status = "packed";                            // plain strings: no Status.Packed needed
console.log(s, STATUSES.includes(s));
```

The `erasableSyntaxOnly` compiler option (since TypeScript 5.8) reports enums, parameter properties, namespaces with code and other non-erasable syntax, so a project stays runnable with type stripping.

### Modules and types

Types are exported and imported like values:

```ts-static
// product.ts
export interface Product { id: number; name: string; price: number }
export function pounds(pence: number): string { return `£${(pence / 100).toFixed(2)}`; }

// cart.ts
import { pounds } from "./product.ts";
import type { Product } from "./product.ts";     // a type-only import: erased completely
```

`import type` makes clear that only a type is imported, so the import disappears from the JavaScript; with `verbatimModuleSyntax` (below), TypeScript requires it for type-only imports.

### Types for JavaScript libraries

A library written in JavaScript can ship **declaration files** (`.d.ts`): just the types, no code. Most popular packages include them. For those that don't, the community-maintained **DefinitelyTyped** project publishes them as `@types/…` packages:

```bash
npm install -D @types/node      # types for Node.js's own APIs: process, fs, Buffer…
```

Since TypeScript 6.0, installed `@types` packages are no longer included automatically: list the ones you use in `tsconfig.json`'s `"types"` (for example `["node"]`).

### tsconfig.json

The compiler reads its settings from `tsconfig.json` at the root of the project. A good starting point for a Node.js project in 2026:

```json
{
  "compilerOptions": {
    "target": "es2025",
    "module": "nodenext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "types": ["node"],
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

| Option | Why |
|---|---|
| `target` | which JavaScript version to output; `es2025` keeps modern syntax as it is |
| `module` | the module system: `nodenext` for Node.js; for web apps built with Vite, use `esnext` with `"moduleResolution": "bundler"` and `"noEmit": true` (the bundler outputs the JavaScript) |
| `strict` | every strict check; the default since 6.0, but writing it documents the intent |
| `noUncheckedIndexedAccess` | `arr[i]` and `record[key]` include `undefined`, because the item may not exist |
| `verbatimModuleSyntax` | imports stay exactly as written; type-only imports must say `import type` |
| `erasableSyntaxOnly` | only syntax that can simply be deleted, so `node file.ts` can run it |
| `skipLibCheck` | don't type-check declaration files in `node_modules` (faster) |

Then `npx tsc` checks and outputs JavaScript to `dist/`, and `npx tsc --noEmit` only checks. TypeScript 7.0 turned the options deprecated in 6.0 into errors (such as `"moduleResolution": "node"`, `baseUrl` and `"target": "es5"`), so older projects move to 6.0 first and fix its warnings.

:::exercise A typed cart class
Write a class `Cart` that `implements CartApi`:

- `add(productId, qty, price)` adds a line; adding a product that's already there increases its quantity (the price stays the first one);
- `remove(productId)` removes that product's line and returns `true`, or returns `false` if it wasn't there;
- `count` is a **read-only** property: the total quantity of all lines (use a getter);
- `total()` returns the total price in pence.

Keep the lines in a private field (`#lines`), so code outside the class can't reach them.
```ts starter
interface CartApi {
  add(productId: number, qty: number, price: number): void;
  remove(productId: number): boolean;
  readonly count: number;
  total(): number;
}

// your class here

const cart = new Cart();
cart.add(2, 1, 800);
cart.add(1, 2, 600);
cart.add(2, 1, 800);
console.log(cart.count, cart.total());   // 4 2800
```
```ts typecheck
const c = new Cart();
const api: CartApi = c;
c.add(1, 2, 600);
const ok: boolean = c.remove(1);
const n: number = c.count + c.total();
// @ts-expect-error product ids are numbers
c.add("1", 2, 600);
// @ts-expect-error count is read-only
c.count = 5;
// @ts-expect-error the cart's lines are private
c.lines;
```
```js check
const CartClass = need("Cart", "class");
const c = new CartClass();
c.add(2, 1, 800);
c.add(1, 2, 600);
c.add(2, 1, 800);
same([c.count, c.total()], [4, 2800], "[count, total()] after adding a bell, two inner tubes and another bell");
same(c.remove(1), true, "remove(1) for a product in the cart");
same(c.remove(1), false, "remove(1) again");
same([c.count, c.total()], [2, 1600], "[count, total()] after removing the inner tubes");
const empty = new CartClass();
same([empty.count, empty.total()], [0, 0], "[count, total()] of a new cart");
const other = new CartClass();
other.add(5, 1, 2900);
same(c.count, 2, "count of the first cart after adding to a second cart (each cart needs its own lines)");
```
```ts solution
interface CartApi {
  add(productId: number, qty: number, price: number): void;
  remove(productId: number): boolean;
  readonly count: number;
  total(): number;
}

class Cart implements CartApi {
  #lines = new Map<number, { qty: number; price: number }>();

  add(productId: number, qty: number, price: number): void {
    const line = this.#lines.get(productId);
    if (line) line.qty += qty;
    else this.#lines.set(productId, { qty, price });
  }

  remove(productId: number): boolean {
    return this.#lines.delete(productId);
  }

  get count(): number {
    let n = 0;
    for (const line of this.#lines.values()) n += line.qty;
    return n;
  }

  total(): number {
    let sum = 0;
    for (const line of this.#lines.values()) sum += line.qty * line.price;
    return sum;
  }
}

const cart = new Cart();
cart.add(2, 1, 800);
cart.add(1, 2, 600);
cart.add(2, 1, 800);
console.log(cart.count, cart.total());
```
hint: `class Cart implements CartApi { #lines = new Map<number, { qty: number; price: number }>(); … }`. TypeScript then tells you which members are still missing.
hint: `Map.prototype.delete` already returns `true` or `false`, which is exactly what `remove` needs.
hint: A getter makes `count` read-only from outside: `get count(): number { … }` with no setter. Loop over `this.#lines.values()` to add up quantities.
approach:
1. **Understand:** a class whose public surface is exactly the interface, with private state.
2. **Examples:** adding product 2 twice gives one line with qty 2; `remove` of a missing id is `false`.
3. **Brute force:** a public array of lines: works, but outside code can change the lines and `count` could be assigned.
4. **Pattern:** **implements + private field + getter**.
5. **Plan:** `#lines` Map → add merges → remove deletes → count getter sums qty → total sums qty × price.
6. **Code and test:** run the example; the checks also use two carts at once.
walkthrough:
**Line by line**

- `implements CartApi` makes TypeScript check the class has every member with compatible types.
- `#lines` is created per instance (a field initializer), so each cart has its own Map, and nothing outside the class can see it.
- `add` either increases the existing line's `qty` or creates a line.
- `this.#lines.delete(productId)` returns whether something was removed.
- `get count()` with no setter means `cart.count = 5` is a compile error (and ignored at runtime).

**Trace:** add(2,1,800), add(1,2,600), add(2,1,800) → lines {2: qty 2 × 800, 1: qty 2 × 600} → count 4, total 1600 + 1200 = 2800.

**Common wrong approach:** a `count` field you update in `add` and `remove`: it's easy to forget an update (here, `remove` must subtract the removed line's qty) and the number drifts from the real lines. Computing it in a getter can't drift.
:::

:::exercise Replace the enum
This code uses an `enum`, which Node.js's type stripping can't run. Rewrite it without `enum`:

- `ORDER_STATUSES` is a read-only array of the statuses in order: `"placed"`, `"packed"`, `"shipped"`, `"delivered"` (use `as const`);
- `OrderStatus` is the union type of those strings, derived from the array;
- `nextStatus(status)` returns the next status, or `null` after `"delivered"`.
```ts starter
enum OrderStatus {
  Placed = "placed",
  Packed = "packed",
  Shipped = "shipped",
  Delivered = "delivered",
}

const ORDER_STATUSES = [OrderStatus.Placed, OrderStatus.Packed, OrderStatus.Shipped, OrderStatus.Delivered];

function nextStatus(status: OrderStatus): OrderStatus | null {
  const i = ORDER_STATUSES.indexOf(status);
  return ORDER_STATUSES[i + 1] ?? null;
}

console.log(nextStatus(OrderStatus.Placed), nextStatus(OrderStatus.Delivered));
```
```ts typecheck
const s: OrderStatus = "packed";
const n: OrderStatus | null = nextStatus("placed");
const all: readonly OrderStatus[] = ORDER_STATUSES;
// @ts-expect-error "lost" isn't an order status
nextStatus("lost");
// @ts-expect-error the list of statuses is read-only
ORDER_STATUSES.push("returned");
```
```js check
if (/\benum\b/.test(__source__.replace(/\/\/.*$/gm, ""))) throw new AssertionError("Remove the enum: use an as const array and a union type instead.");
same(need("ORDER_STATUSES"), ["placed", "packed", "shipped", "delivered"], "ORDER_STATUSES");
test("nextStatus", [
  [["placed"], "packed", "placed"],
  [["packed"], "shipped", "packed"],
  [["shipped"], "delivered", "shipped"],
  [["delivered"], null, "delivered (the last one)"],
]);
```
```ts solution
const ORDER_STATUSES = ["placed", "packed", "shipped", "delivered"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

function nextStatus(status: OrderStatus): OrderStatus | null {
  const i = ORDER_STATUSES.indexOf(status);
  return ORDER_STATUSES[i + 1] ?? null;
}

console.log(nextStatus("placed"), nextStatus("delivered"));
```
hint: `const ORDER_STATUSES = ["placed", "packed", "shipped", "delivered"] as const;` gives a read-only tuple of literal types.
hint: Derive the union from it: `type OrderStatus = (typeof ORDER_STATUSES)[number];`.
hint: `nextStatus` can stay almost the same; just call it with plain strings, like `nextStatus("placed")`.
approach:
1. **Understand:** keep the same values and behaviour, with erasable syntax only.
2. **Examples:** "shipped" → "delivered"; "delivered" → null; "lost" → compile error.
3. **Brute force:** writing the union type and the array separately: two lists to keep in sync.
4. **Pattern:** **`as const` array + `(typeof X)[number]`**: one source of truth for values and type.
5. **Plan:** array with `as const` → derived union → same function body.
6. **Code and test:** Run; then try `nextStatus("lost")` to see the error.
walkthrough:
**Line by line**

- `as const` makes the array `readonly ["placed", "packed", "shipped", "delivered"]`, keeping each literal type and preventing `push`.
- `(typeof ORDER_STATUSES)[number]` is the type of any element: `"placed" | "packed" | "shipped" | "delivered"`.
- `indexOf(status)` finds the position; `ORDER_STATUSES[i + 1]` is the next one, or `undefined` past the end, which `?? null` turns into `null`.
- Callers use plain strings, which are type-checked against the union.

**Trace:** `nextStatus("shipped")` → i = 2 → index 3 → "delivered". `nextStatus("delivered")` → index 4 → undefined → null.

**Common wrong approach:** `const enum`: it's also non-erasable (the compiler inlines the values), and type stripping rejects it just like a normal enum.
:::

:::quiz
? What is the difference between private name and #name in a TypeScript class?
+ private is only checked by the compiler; #name is also private at runtime
- There is no difference
- #name is only for static fields
= private is erased; JavaScript's # fields are enforced by the engine.
? Why can't Node.js's type stripping run code with an enum?
+ An enum generates JavaScript code, so it can't simply be deleted
- Enums are deprecated in JavaScript
- Node.js doesn't support strings
= Type stripping only removes syntax; erasableSyntaxOnly reports the rest.
? What does noUncheckedIndexedAccess change?
+ Reading arr[i] gives T | undefined, because the item may not exist
- Arrays become read-only
- It checks array indexes at runtime
= It makes TypeScript honest about out-of-range reads.
? Since TypeScript 6.0, how do you use types from @types/node?
+ Install it and list "node" in the tsconfig "types" option
- Nothing: every @types package is included automatically
- Import it in every file
= The types option now defaults to an empty list.
:::

@@@ lesson
id: typing-outside-data
title: Typing data from outside
minutes: 26
summary: Why data from APIs, JSON and users is the weak spot of a typed program, res.json() returning any, generic fetch helpers and their limits, unknown and errors in catch blocks, writing type guards (value is Type) and assertion functions, Result types for expected failures, validating with a schema library such as Zod and inferring types from schemas, and JSON Schema for APIs and LLM tool calls.
---
Inside your program, TypeScript checks everything. But data also comes from **outside**: API responses, `JSON.parse`, form fields, files, environment variables, and LLM output. TypeScript can't see any of it before the program runs, so this is where typed programs still break. This lesson is about checking that boundary.

### res.json() is any

```ts
interface Product { id: number; name: string; price: number; stock: number }

const res = await fetch("https://shop.example/api/products/2");
const product: Product = await res.json();      // any → Product: accepted without a check
console.log(product.name, product.price);
```

`res.json()` returns `Promise<any>`, so assigning it to `Product` compiles. If the API changes, or returns an error object instead, the program believes it has a `Product`, and the bug appears somewhere else. A typed helper looks safer, but has the same gap:

```ts-static
async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();              // still any, still unchecked: T is a promise, not a check
}
```

Use this only for data you trust, such as your own server. For everything else, start from `unknown` and **check**.

### Errors in catch are unknown

Anything can be thrown in JavaScript, not only `Error`s, so in strict mode a `catch` variable is `unknown`:

```ts
try {
  JSON.parse("{ not json");
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);   // narrow before use
  console.log("Couldn't parse:", message);
}
```

### Type guards

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

```ts-static
function assertProduct(value: unknown): asserts value is Product {
  if (!isProduct(value)) throw new Error("Not a product");
}
assertProduct(data);
data.price;        // Product from here on
```

### Expected failures: Result types

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

### Schema libraries

Hand-written guards get long for nested data. **Schema validation libraries** let you describe the shape once, and give you both the runtime check and the TypeScript type. **Zod** is the most widely used; Valibot and ArkType are alternatives. With Zod 4:

```ts-static
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

### JSON Schema, APIs and LLMs

Types vanish at runtime, so systems that talk to each other describe data with **JSON Schema**, a standard JSON format for "an object with an integer `id` and a string `name`". OpenAPI files that document REST APIs use it, and so do LLM APIs: when you give a model a **tool** to call, you describe the tool's arguments with a JSON Schema, and the model replies with JSON that should match it. Zod can produce one from a schema (`z.toJSONSchema(Product)`), so one definition gives you the type, the runtime check and the schema. Part 8's final project uses this to check a model's tool calls before running them, because model output is outside data too.

:::exercise A product type guard
Write `isProduct(value: unknown): value is Product`. It returns `true` only for an object that has:

- `id`: an integer;
- `name`: a non-empty string;
- `price` and `stock`: integers of at least 0.

It must return `false` (never throw) for anything else, including `null`, arrays, strings and objects with missing or wrong fields. Extra fields are allowed.
```ts starter
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
```ts typecheck
const data: unknown = JSON.parse('{"id": 2, "name": "Bell", "price": 800, "stock": 15}');
if (isProduct(data)) {
  const name: string = data.name;
  const total: number = data.price * data.stock;
}
```
```js check
const ok = [
  [{ id: 2, name: "Bell", price: 800, stock: 15 }, "a bell"],
  [{ id: 3, name: "Tubeless tyre", price: 4500, stock: 0 }, "a product with no stock"],
  [{ id: 4, name: "Floor pump", price: 3200, stock: 7, category: "tools" }, "a product with an extra field"],
];
const bad = [
  [null, "null"], [undefined, "undefined"], ["Bell", "a string"], [42, "a number"], [[], "an empty array"],
  [{}, "an empty object"],
  [{ id: 2, name: "Bell", price: 800 }, "a missing stock"],
  [{ id: "2", name: "Bell", price: 800, stock: 15 }, "a string id"],
  [{ id: 2.5, name: "Bell", price: 800, stock: 15 }, "an id of 2.5"],
  [{ id: 2, name: "", price: 800, stock: 15 }, "an empty name"],
  [{ id: 2, name: "Bell", price: -1, stock: 15 }, "a negative price"],
  [{ id: 2, name: "Bell", price: 800, stock: 1.5 }, "a stock of 1.5"],
  [{ id: 2, name: "Bell", price: NaN, stock: 15 }, "a price of NaN"],
  [{ id: 2, name: "Bell", price: "800", stock: 15 }, "a string price"],
];
test("isProduct", [
  ...ok.map(([v, label]) => [[v], true, label]),
  ...bad.map(([v, label]) => [[v], false, label]),
], { show: "isProduct({0})" });
```
```ts solution
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
hint: Change the return type to the type predicate `value is Product`, so TypeScript narrows after a `true`.
hint: First rule out non-objects: `typeof value !== "object" || value === null || Array.isArray(value)`. Then read the fields through `const v = value as Record<string, unknown>;` (each field is still `unknown`, so you must check it).
hint: `Number.isInteger(x)` is `false` for strings, `NaN` and `2.5`, so it checks "a whole number" in one call. Add `>= 0` for price and stock, and `typeof v.name === "string" && v.name.length > 0`.
approach:
1. **Understand:** a strict runtime check whose `true` result TypeScript can rely on.
2. **Examples:** `{ id: "2", … }` → false; extra fields → still true; `null` → false (and no crash).
3. **Brute force:** `"id" in value && "name" in value…`: checks presence, not types; `{ id: "2" }` passes.
4. **Pattern:** **type guard**: object check, then each field's type and range.
5. **Plan:** reject non-objects → view as a record of unknowns → integer id → non-empty name → non-negative integer price and stock.
6. **Code and test:** the checks try 17 values, valid and invalid.
walkthrough:
**Line by line**

- `value is Product` is the type predicate: when the function returns `true`, callers see `value` as a `Product`.
- `typeof value !== "object" || value === null` is needed because `typeof null` is `"object"`; arrays are objects too, so they're ruled out explicitly.
- `value as Record<string, unknown>` lets us read any property while keeping each one `unknown`, so every field must still be checked: the assertion is safe here.
- `Number.isInteger` handles numbers-only, no `NaN`, no fractions; `count` adds the `>= 0` rule.

**Trace:** `{ id: 2, name: "Bell", price: NaN, stock: 15 }` → object → id ok → name ok → `Number.isInteger(NaN)` is false → false.

**Common wrong approach:** `return value as Product !== undefined` or any version that only asserts: the type predicate then lies, and every caller trusts it.
:::

:::exercise Load products safely
Write `async function loadProducts(url: string): Promise<Result<Product[]>>` using the `isProduct` guard provided:

- if the response status isn't OK, return `{ ok: false, error: "HTTP 404" }` (with the status);
- if the body isn't an array whose items are all products, return `{ ok: false, error: "Unexpected data" }`;
- if `fetch` itself fails (it rejects), return `{ ok: false, error: … }` with the error's message;
- otherwise return `{ ok: true, value: products }`.
```ts starter
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
```ts typecheck
const r2 = await loadProducts("https://shop.example/api/products");
if (r2.ok) {
  const names: string[] = r2.value.map((p) => p.name);
} else {
  const message: string = r2.error;
}
```
```js check
const load = need("loadProducts", "function");
const all = await load("https://shop.example/api/products");
same(all.ok, true, 'loadProducts(".../api/products").ok');
same(all.value.length, 6, 'loadProducts(".../api/products").value.length');
same(all.value[1], { id: 2, name: "Bell", category: "accessories", price: 800, stock: 15 }, "The second product");
same(await load("https://shop.example/api/products/99"), { ok: false, error: "HTTP 404" }, 'loadProducts(".../api/products/99")');
same(await load("https://shop.example/api/nope"), { ok: false, error: "HTTP 404" }, 'loadProducts(".../api/nope")');
same(await load("https://shop.example/api/products/2"), { ok: false, error: "Unexpected data" }, 'loadProducts(".../api/products/2") (one product, not an array)');
same(await load("https://shop.example/api/orders"), { ok: false, error: "Unexpected data" }, 'loadProducts(".../api/orders") (orders, not products)');
const broken = await load("http://[::1");
if (broken.ok !== false || typeof broken.error !== "string" || !broken.error) {
  throw new AssertionError(`When fetch rejects (here for an invalid URL), return { ok: false, error: <the message> }; got ${inspect(broken)}.`);
}
```
```ts solution
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
hint: Wrap only the `fetch` call in `try` / `catch`; in `catch`, `err` is `unknown`, so use `err instanceof Error ? err.message : String(err)`.
hint: Read the body as `const data: unknown = await res.json();` so TypeScript makes you check it.
hint: `Array.isArray(data) && data.every(isProduct)` checks every item, and because `isProduct` is a type guard, TypeScript then knows `data` is `Product[]`.
approach:
1. **Understand:** turn three kinds of failure into Results, and only return products that were checked.
2. **Examples:** `/api/products/2` is a single object → "Unexpected data"; `/api/nope` → "HTTP 404".
3. **Brute force:** `return { ok: true, value: await res.json() }`: compiles (it's `any`), and returns orders as if they were products.
4. **Pattern:** **check at the boundary**: `unknown` in, guard, typed value out.
5. **Plan:** fetch in try/catch → status check → json as unknown → array + every(isProduct) → ok.
6. **Code and test:** the checks call it with good and bad URLs.
walkthrough:
**Line by line**

- `let res: Response;` is declared before `try` so it can be used after it; TypeScript knows it's assigned because the `catch` returns.
- The `catch` turns a rejected `fetch` (network down, invalid URL) into a Result.
- `!res.ok` handles HTTP errors, which `fetch` doesn't reject on (Lesson 24).
- Annotating `data` as `unknown` stops the `any` from `res.json()` spreading.
- `data.every(isProduct)` uses the guard on each item; TypeScript narrows `data` to `Product[]`, so `{ ok: true, value: data }` matches `Result<Product[]>` with no assertion.

**Trace:** `/api/orders` → 200 → an array of orders → `isProduct(order)` is false (no `name`) → "Unexpected data".

**Common wrong approach:** `const data = await res.json() as Product[]`: the assertion silences the check you were supposed to write, and orders become "products".
:::

:::quiz
? What type does res.json() return?
+ Promise<any>
- Promise<unknown>
- The type you annotate the variable with, checked at runtime
= It's any, so annotating the result checks nothing.
? In strict mode, what is the type of err in catch (err)?
+ unknown, because anything can be thrown
- Error
- any
= Narrow it, for example with err instanceof Error.
? What does function isProduct(v: unknown): v is Product promise?
+ When it returns true, v is a Product, so callers can use it as one
- TypeScript will check v against Product at runtime
- It throws if v isn't a Product
= TypeScript trusts the guard; your code must really check.
? Why give an LLM a JSON Schema for a tool's arguments?
+ It describes the JSON the model should produce, which you can then validate
- It makes the model run TypeScript
- Models can't produce JSON without it
= The schema describes the data; your code still checks the reply before using it.
:::
