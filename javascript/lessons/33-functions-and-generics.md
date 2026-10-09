# Lesson 33: Typed functions and generics

**You'll learn:** typed parameters and return types, optional and default parameters, rest parameters, function types, contextual typing of callbacks, void, generic functions and type parameters, type argument inference, constraints with extends, keyof and indexed access types, generic types, Result types, Record, utility types (Partial, Required, Readonly, Pick, Omit, ReturnType, Awaited), deriving types with typeof and as const.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#functions-and-generics)**: run every example and check your exercise answers.

## Key terms

- **Function type:** a type for functions, like `(pence: number) => boolean`.
- **Generic:** a function or type with type parameters, like `first<T>(items: T[]): T | undefined`.
- **Type parameter:** a placeholder type such as `T`, filled in (usually inferred) at each use.
- **Constraint:** `T extends X`: limits a type parameter to types compatible with `X`.
- **`keyof`:** the union of an object type's property names.
- **Indexed access type:** `T[K]`, the type of property `K` of `T`.
- **Utility type:** a built-in generic type that transforms another, like `Partial<T>` or `Omit<T, K>`.
- **`Record<K, V>`:** an object type with keys `K` and values `V`.
- **`as const`:** makes a literal read-only with the most specific (literal) types.

Functions are where types pay off most: every caller is checked against the signature, and editors show it as you type. Generics then let one function work with many types without giving up checking.

## Function signatures

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

## Generics: types as parameters

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

## Constraints and keyof

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

## Generic types

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

## Utility types

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

## Types from values: typeof and as const

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

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Same logic for many types | generic function with inferred type parameters | O(1) extra | O(1) |
| Choose a property safely | K extends keyof T, result T[K] | compile time only | O(1) |
| Related object types | Partial, Pick, Omit, Readonly | compile time only | O(1) |

## Common mistakes

- Using `any` where a type parameter would keep the type.
- Writing explicit type arguments that inference would work out.
- Copying an interface by hand instead of deriving it with `Pick`, `Omit` or `Partial`.
- Forgetting the constraint, so the generic body can't use what it needs.
- Keeping a list of values and a matching union type in sync by hand instead of deriving one from the other.

## Exercises

### 1. A typed pluck

Write a generic function `pluck(items, key)` that returns an array of each item's value for `key`: `pluck(products, "name")` gives the names.

Its types must be precise: the key must be a property of the items, and the result must have that property's type (`string[]` for names, `number[]` for prices). Use type parameters `T` and `K extends keyof T`.

Starter code:

```ts
function pluck(items: any[], key: string): any[] {
  return [];
}

const products = [
  { id: 1, name: "Inner tube", price: 600 },
  { id: 2, name: "Bell", price: 800 },
];
console.log(pluck(products, "name"), pluck(products, "price"));
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a runtime one-liner, with types that track which key was chosen.
2. **Examples:** key `"price"` → `number[]`; key `"prise"` → compile error.
3. **Brute force:** `any[]`: works at runtime, but every result is `any` and typos compile.
4. **Pattern:** **generic + `keyof` constraint + indexed access type**.
5. **Plan:** `<T, K extends keyof T>`, `items: T[]`, `key: K`, returns `T[K][]`, body `map`.
6. **Code and test:** hover over results in a real editor; here, the checks test the types.

</details>

<details>
<summary>💡 Hint 1</summary>

Declare the type parameters after the name: `function pluck<T, K extends keyof T>(items: T[], key: K)`.

</details>

<details>
<summary>💡 Hint 2</summary>

The type of `item[key]` is `T[K]`, so the function returns `T[K][]` (an array of those).

</details>

<details>
<summary>💡 Hint 3</summary>

The body is one line: `return items.map((item) => item[key]);`.

</details>

### 2. Typed updates

Write `applyUpdate(product, changes)` that returns a **new** product with the changes applied, leaving the original unchanged. Type `changes` with utility types so that:

- any of `name`, `price` and `stock` may be changed, alone or together, or none;
- `id` can't be changed;
- wrong types and unknown properties are errors.

Starter code:

```ts
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

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a non-mutating update whose argument type allows exactly the editable fields.
2. **Examples:** `{ price: 750 }` ok; `{ id: 9 }` and `{ price: "7.50" }` rejected.
3. **Brute force:** writing a second interface by hand with optional name, price and stock: works until someone adds a field to `Product` and forgets the copy.
4. **Pattern:** **derive types with utility types**.
5. **Plan:** `Partial<Omit<Product, "id">>` → spread the product, then the changes.
6. **Code and test:** Run; the checks try valid and invalid updates.

</details>

<details>
<summary>💡 Hint 1</summary>

`Omit<Product, "id">` is a product without its id; `Partial<…>` makes every remaining property optional. Combine them.

</details>

<details>
<summary>💡 Hint 2</summary>

`changes: Partial<Omit<Product, "id">>`. An object literal passed for it can't contain `id` or unknown properties.

</details>

<details>
<summary>💡 Hint 3</summary>

Build the new object with spread syntax: `return { ...product, ...changes };` (later properties win).

</details>

**In the sandbox:** exercises 65–66. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. A typed pluck</summary>

```ts
function pluck<T, K extends keyof T>(items: T[], key: K): T[K][] {
  return items.map((item) => item[key]);
}

const products = [
  { id: 1, name: "Inner tube", price: 600 },
  { id: 2, name: "Bell", price: 800 },
];
console.log(pluck(products, "name"), pluck(products, "price"));
```

**Line by line**

- `T` is the item type, inferred from the array you pass.
- `K extends keyof T` means `key` must be one of `T`'s property names, so `"prise"` is rejected.
- `T[K][]` says the result is an array of that property's type: for `"price"`, `number[]`.
- `items.map((item) => item[key])` does the work; `item[key]` has type `T[K]`.

**Trace:** `pluck(products, "name")`: `T` = `{ id: number; name: string; price: number }`, `K` = `"name"`, result type `string[]`, value `["Inner tube", "Bell"]`.

**Common wrong approach:** `function pluck<T>(items: T[], key: keyof T): T[keyof T][]`: typos are caught, but the result is `(string | number)[]`, the union of every property's type, because `key` isn't its own type parameter.

</details>

<details>
<summary>✅ 2. Typed updates</summary>

```ts
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

**Line by line**

- `Omit<Product, "id">` is `{ name: string; price: number; stock: number }`.
- `Partial<…>` makes each optional: `{ name?: string; price?: number; stock?: number }`, so `{}` and any combination are allowed.
- The type follows `Product` automatically: add a `colour` field there and updates accept it.
- `{ ...product, ...changes }` copies the product and overwrites the changed properties, producing a new object.

**Trace:** `applyUpdate(bell, { price: 750 })` → `{ id: 2, name: "Bell", price: 800, stock: 15, price: 750 }` → the later `price` wins → 750.

**Common wrong approach:** `Object.assign(product, changes)`: it returns the right values, but modifies the original product, which callers (and the `readonly` intent) don't expect.

</details>

## Quick quiz

1. function first<T>(items: T[]): T | undefined is called as first(["a", "b"]). What is T?
   - A) string, inferred from the argument
   - B) any
   - C) unknown, until you write first<string>

2. For const p = { name: "Bell", price: 800 }, what is keyof typeof p?
   - A) "name" | "price"
   - B) string
   - C) ["name", "price"]

3. Which type describes a Product without its id, with every other property optional?
   - A) Partial<Omit<Product, "id">>
   - B) Omit<Partial<Product>>
   - C) Pick<Product, "id">

4. What does as const do to ["parts", "tools"]?
   - A) Makes it a read-only tuple of the literal types "parts" and "tools"
   - B) Makes it impossible to read
   - C) Converts it to an object

<details>
<summary>Quiz answers</summary>

1. **A) string, inferred from the argument**: TypeScript infers type arguments from the values you pass.
2. **A) "name" | "price"**: keyof gives the union of property names.
3. **A) Partial<Omit<Product, "id">>**: Omit removes id; Partial makes the rest optional.
4. **A) Makes it a read-only tuple of the literal types "parts" and "tools"**: Then (typeof X)[number] is the union "parts" | "tools".

</details>

---
Previous: [Lesson 32](32-object-types.md) · Next: [Lesson 34: Classes, enums, modules and tsconfig](34-classes-and-tsconfig.md)
