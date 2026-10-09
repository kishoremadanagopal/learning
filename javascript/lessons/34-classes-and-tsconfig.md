# Lesson 34: Classes, enums, modules and tsconfig

**You'll learn:** typed class fields and constructors, readonly, getters, TypeScript's private versus JavaScript's # private fields, implements, abstract classes, parameter properties, enums and their generated code, unions of literal types with as const, erasable syntax and erasableSyntaxOnly, exporting and importing types, import type, declaration files, DefinitelyTyped and @types packages, the types option, tsconfig.json for 2026, noUncheckedIndexedAccess, verbatimModuleSyntax, TypeScript 7's removed options.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#classes-and-tsconfig)**: run every example and check your exercise answers.

## Key terms

- **`implements`:** checks that a class provides everything an interface describes.
- **Abstract class:** a class that can't be created directly and may declare methods subclasses must provide.
- **Parameter property:** a constructor parameter with `readonly`, `private` or `public` that also declares a field.
- **Enum:** a TypeScript construct naming a set of constants; it generates a JavaScript object.
- **Erasable syntax:** TypeScript syntax that can simply be deleted to leave valid JavaScript.
- **`import type`:** an import of types only, removed entirely from the JavaScript.
- **Declaration file:** a `.d.ts` file with only types, describing JavaScript code.
- **`@types` package:** type declarations for a JavaScript library, from the DefinitelyTyped project.
- **`tsconfig.json`:** the file that configures the TypeScript compiler for a project.

This lesson covers the rest of what you'll meet in a real TypeScript project: classes with types, enums (and why many teams avoid them now), modules, and the `tsconfig.json` file that configures the compiler.

## Typed classes

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

```ts
interface Priced { readonly price: number }

abstract class Item implements Priced {
  abstract readonly price: number;        // every subclass must define it
  describe(): string { return `£${(this.price / 100).toFixed(2)}`; }
}
```

## Parameter properties

TypeScript has a shortcut that declares and assigns a field from a constructor parameter:

```ts
class Customer {
  constructor(readonly name: string, private email: string) {}   // creates this.name and this.email
}
```

It's compact, but it isn't just types: it **generates** code (the assignments). That matters for the next topic.

## Enums, unions and erasable syntax

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

## Modules and types

Types are exported and imported like values:

```ts
// product.ts
export interface Product { id: number; name: string; price: number }
export function pounds(pence: number): string { return `£${(pence / 100).toFixed(2)}`; }

// cart.ts
import { pounds } from "./product.ts";
import type { Product } from "./product.ts";     // a type-only import: erased completely
```

`import type` makes clear that only a type is imported, so the import disappears from the JavaScript; with `verbatimModuleSyntax` (below), TypeScript requires it for type-only imports.

## Types for JavaScript libraries

A library written in JavaScript can ship **declaration files** (`.d.ts`): just the types, no code. Most popular packages include them. For those that don't, the community-maintained **DefinitelyTyped** project publishes them as `@types/…` packages:

```bash
npm install -D @types/node      # types for Node.js's own APIs: process, fs, Buffer…
```

Since TypeScript 6.0, installed `@types` packages are no longer included automatically: list the ones you use in `tsconfig.json`'s `"types"` (for example `["node"]`).

## tsconfig.json

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

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Private state | #field (runtime) rather than private (compile time) | O(1) | O(1) |
| Fixed set of values | as const array + derived union instead of an enum | O(1) | O(values) |
| Project settings | tsconfig.json with strict and modern module options | — | — |

## Common mistakes

- Relying on TypeScript's `private` for anything that must be private at runtime.
- Using enums or parameter properties in code meant to run with type stripping.
- Forgetting `import type` for type-only imports with `verbatimModuleSyntax`.
- Expecting installed `@types` packages to be used without listing them in `types`.
- Turning off `strict` to make an old project compile instead of fixing the errors.

## Exercises

### 1. A typed cart class

Write a class `Cart` that `implements CartApi`:

- `add(productId, qty, price)` adds a line; adding a product that's already there increases its quantity (the price stays the first one);
- `remove(productId)` removes that product's line and returns `true`, or returns `false` if it wasn't there;
- `count` is a **read-only** property: the total quantity of all lines (use a getter);
- `total()` returns the total price in pence.

Keep the lines in a private field (`#lines`), so code outside the class can't reach them.

Starter code:

```ts
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

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a class whose public surface is exactly the interface, with private state.
2. **Examples:** adding product 2 twice gives one line with qty 2; `remove` of a missing id is `false`.
3. **Brute force:** a public array of lines: works, but outside code can change the lines and `count` could be assigned.
4. **Pattern:** **implements + private field + getter**.
5. **Plan:** `#lines` Map → add merges → remove deletes → count getter sums qty → total sums qty × price.
6. **Code and test:** run the example; the checks also use two carts at once.

</details>

<details>
<summary>💡 Hint 1</summary>

`class Cart implements CartApi { #lines = new Map<number, { qty: number; price: number }>(); … }`. TypeScript then tells you which members are still missing.

</details>

<details>
<summary>💡 Hint 2</summary>

`Map.prototype.delete` already returns `true` or `false`, which is exactly what `remove` needs.

</details>

<details>
<summary>💡 Hint 3</summary>

A getter makes `count` read-only from outside: `get count(): number { … }` with no setter. Loop over `this.#lines.values()` to add up quantities.

</details>

### 2. Replace the enum

This code uses an `enum`, which Node.js's type stripping can't run. Rewrite it without `enum`:

- `ORDER_STATUSES` is a read-only array of the statuses in order: `"placed"`, `"packed"`, `"shipped"`, `"delivered"` (use `as const`);
- `OrderStatus` is the union type of those strings, derived from the array;
- `nextStatus(status)` returns the next status, or `null` after `"delivered"`.

Starter code:

```ts
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

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** keep the same values and behaviour, with erasable syntax only.
2. **Examples:** "shipped" → "delivered"; "delivered" → null; "lost" → compile error.
3. **Brute force:** writing the union type and the array separately: two lists to keep in sync.
4. **Pattern:** **`as const` array + `(typeof X)[number]`**: one source of truth for values and type.
5. **Plan:** array with `as const` → derived union → same function body.
6. **Code and test:** Run; then try `nextStatus("lost")` to see the error.

</details>

<details>
<summary>💡 Hint 1</summary>

`const ORDER_STATUSES = ["placed", "packed", "shipped", "delivered"] as const;` gives a read-only tuple of literal types.

</details>

<details>
<summary>💡 Hint 2</summary>

Derive the union from it: `type OrderStatus = (typeof ORDER_STATUSES)[number];`.

</details>

<details>
<summary>💡 Hint 3</summary>

`nextStatus` can stay almost the same; just call it with plain strings, like `nextStatus("placed")`.

</details>

**In the sandbox:** exercises 67–68. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. A typed cart class</summary>

```ts
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

**Line by line**

- `implements CartApi` makes TypeScript check the class has every member with compatible types.
- `#lines` is created per instance (a field initializer), so each cart has its own Map, and nothing outside the class can see it.
- `add` either increases the existing line's `qty` or creates a line.
- `this.#lines.delete(productId)` returns whether something was removed.
- `get count()` with no setter means `cart.count = 5` is a compile error (and ignored at runtime).

**Trace:** add(2,1,800), add(1,2,600), add(2,1,800) → lines {2: qty 2 × 800, 1: qty 2 × 600} → count 4, total 1600 + 1200 = 2800.

**Common wrong approach:** a `count` field you update in `add` and `remove`: it's easy to forget an update (here, `remove` must subtract the removed line's qty) and the number drifts from the real lines. Computing it in a getter can't drift.

</details>

<details>
<summary>✅ 2. Replace the enum</summary>

```ts
const ORDER_STATUSES = ["placed", "packed", "shipped", "delivered"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

function nextStatus(status: OrderStatus): OrderStatus | null {
  const i = ORDER_STATUSES.indexOf(status);
  return ORDER_STATUSES[i + 1] ?? null;
}

console.log(nextStatus("placed"), nextStatus("delivered"));
```

**Line by line**

- `as const` makes the array `readonly ["placed", "packed", "shipped", "delivered"]`, keeping each literal type and preventing `push`.
- `(typeof ORDER_STATUSES)[number]` is the type of any element: `"placed" | "packed" | "shipped" | "delivered"`.
- `indexOf(status)` finds the position; `ORDER_STATUSES[i + 1]` is the next one, or `undefined` past the end, which `?? null` turns into `null`.
- Callers use plain strings, which are type-checked against the union.

**Trace:** `nextStatus("shipped")` → i = 2 → index 3 → "delivered". `nextStatus("delivered")` → index 4 → undefined → null.

**Common wrong approach:** `const enum`: it's also non-erasable (the compiler inlines the values), and type stripping rejects it just like a normal enum.

</details>

## Quick quiz

1. What is the difference between private name and #name in a TypeScript class?
   - A) private is only checked by the compiler; #name is also private at runtime
   - B) There is no difference
   - C) #name is only for static fields

2. Why can't Node.js's type stripping run code with an enum?
   - A) An enum generates JavaScript code, so it can't simply be deleted
   - B) Enums are deprecated in JavaScript
   - C) Node.js doesn't support strings

3. What does noUncheckedIndexedAccess change?
   - A) Reading arr[i] gives T | undefined, because the item may not exist
   - B) Arrays become read-only
   - C) It checks array indexes at runtime

4. Since TypeScript 6.0, how do you use types from @types/node?
   - A) Install it and list "node" in the tsconfig "types" option
   - B) Nothing: every @types package is included automatically
   - C) Import it in every file

<details>
<summary>Quiz answers</summary>

1. **A) private is only checked by the compiler; #name is also private at runtime**: private is erased; JavaScript's # fields are enforced by the engine.
2. **A) An enum generates JavaScript code, so it can't simply be deleted**: Type stripping only removes syntax; erasableSyntaxOnly reports the rest.
3. **A) Reading arr[i] gives T | undefined, because the item may not exist**: It makes TypeScript honest about out-of-range reads.
4. **A) Install it and list "node" in the tsconfig "types" option**: The types option now defaults to an empty list.

</details>

---
Previous: [Lesson 33](33-functions-and-generics.md) · Next: [Lesson 35: Typing data from outside](35-typing-outside-data.md)
