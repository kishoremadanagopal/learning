# Lesson 32: Object types, unions and narrowing

**You'll learn:** type aliases and interfaces, optional and readonly properties, excess property checks, union types, literal types, narrowing with typeof, truthiness, equality, in, instanceof and Array.isArray, early returns, discriminated unions, exhaustiveness checks with never, null and undefined, optional chaining, typed querySelector, type assertions with as and !, satisfies.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#object-types)**: run every example and check your exercise answers.

## Key terms

- **Type alias:** a name for any type, declared with `type`.
- **Interface:** a named object type, declared with `interface`.
- **Optional property:** a property marked `?` that may be missing.
- **Union type:** `A | B`: a value that is one of several types.
- **Narrowing:** TypeScript refining a value's type inside a branch, from a check such as `typeof`.
- **Discriminated union:** a union of object types told apart by a shared literal property, like `kind`.
- **Exhaustiveness check:** assigning to `never` so a forgotten union member becomes a compile error.
- **`never`:** the type with no values, for code that can't be reached.
- **Type assertion:** `value as Type` or `value!`, telling the compiler to trust you without a check.
- **`satisfies`:** checks a value against a type while keeping its own, more precise inferred type.

Most data in a program is objects: products, orders, customers. This lesson shows how to describe them, and how TypeScript follows your `if`s to know exactly what a value can be at each line.

## Describing objects

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

*This example raises an error on purpose.*

```ts
type Category = "parts" | "tools" | "accessories";
interface Product { readonly id: number; name: string; category: Category; price: number; salePrice?: number }

const lights: Product = { id: 9, name: "Lights", category: "lighting", price: 1500 };   // not a Category
const lamp: Product = { id: 9, name: "Lamp", category: "tools" };                         // price is missing
const bell: Product = { id: 2, name: "Bell", category: "parts", price: 800, colour: "red" };   // unknown property
bell.id = 3;                                                                              // id is readonly
```

The `colour` error is an **excess property check**: an object literal written directly where a `Product` is expected may only have known properties, which catches typos in property names.

## Union types and narrowing

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

## Discriminated unions

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

## null and undefined

With strict null checks, `null` and `undefined` only go where a type says so. Optional chaining and `??` work with the types:

```ts
interface Customer { name: string; email?: string; address?: { city: string } }

const bo: Customer = { name: "Bo" };
console.log(bo.email?.toLowerCase());          // string | undefined: undefined here
console.log(bo.address?.city ?? "no address");
```

The same applies to the DOM: `document.querySelector` returns `Element | null`, so TypeScript makes you handle a missing element. Its generic form returns a specific element type:

```ts
const qty = document.querySelector<HTMLInputElement>("#qty");   // HTMLInputElement | null
if (qty) console.log(qty.valueAsNumber);
```

## Type assertions: as

`value as Type` tells TypeScript "trust me". It checks **nothing** at runtime, so a wrong assertion is a bug TypeScript can no longer see:

```ts
const product = JSON.parse(text) as Product;   // if the JSON isn't a product, you'll find out later
const el = document.querySelector("#qty") as HTMLInputElement;   // and if #qty doesn't exist?
```

The `!` after an expression (`maybe!.name`) is a shorter assertion: "this isn't null or undefined". Prefer narrowing with a real check. Assertions are for the rare cases where you know more than the compiler can, for example after validating data.

## satisfies

`satisfies` checks that a value matches a type **without** changing the value's inferred type, so you keep the precise details:

```ts
type Prices = Record<string, number>;

const prices = { bell: 800, pump: 3200 } satisfies Prices;   // checked: every value is a number
console.log(prices.bell + prices.pump);                    // and TypeScript still knows bell and pump exist
```

With `const prices: Prices = …` instead, `prices.bel` (a typo) would also be allowed, because a `Record<string, number>` may have any key.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Variants of a thing | discriminated union + switch on the discriminant | O(1) per check | O(1) |
| Optional value | narrow with if / ?. / ?? before use | O(1) | O(1) |
| Check a config object | satisfies Type | compile time only | O(1) |

## Common mistakes

- Making every property optional instead of modelling the real variants with a union.
- Using `as` or `!` to silence errors that point at real missing-value bugs.
- Narrowing with truthiness when `0` or `""` are valid values.
- Forgetting the `never` check, so a new union member is silently unhandled.
- Using string types where a union of literals would catch typos.

## Exercises

### 1. Model the payments

A shop accepts three kinds of payment. Define a type `Payment` as a **discriminated union** on `kind`:

- `{ kind: "card", last4: string }`
- `{ kind: "paypal", email: string }`
- `{ kind: "voucher", code: string, value: number }` (value in pence)

Then write `describePayment(p: Payment): string`, returning `Card ending 4242`, `PayPal (ada@example.com)` or `Voucher SPRING (£5.00)`.

Starter code:

```ts
// type Payment = ...

function describePayment(p: Payment): string {
  return "";
}

console.log(describePayment({ kind: "card", last4: "4242" }));
console.log(describePayment({ kind: "voucher", code: "SPRING", value: 500 }));
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** three shapes that share a `kind` field, and a function that handles each.
2. **Examples:** a card with an email is invalid; a voucher's value is a number.
3. **Brute force:** one object type with every field optional: everything compiles, including nonsense like a card without `last4`.
4. **Pattern:** **discriminated union + switch on the discriminant**.
5. **Plan:** declare the union → switch on `kind` → return the text per case → `never` default.
6. **Code and test:** Run, then Check; the checks also try invalid payments.

</details>

<details>
<summary>💡 Hint 1</summary>

A union of object types: `type Payment = | { kind: "card"; last4: string } | { … } | { … };`. Each `kind` is a literal type in quotes.

</details>

<details>
<summary>💡 Hint 2</summary>

`switch (p.kind)` with one `case` per kind. Inside `case "card":`, TypeScript knows `p.last4` exists.

</details>

<details>
<summary>💡 Hint 3</summary>

Format the voucher with `(p.value / 100).toFixed(2)`. Add a `default` with `const unhandled: never = p;` so a future fourth kind can't be forgotten.

</details>

### 2. Handle the missing values

`contactLine(id)` should return a line about a customer, but the starter doesn't compile: some values may be missing. Fix it without `!`, `any` or `@ts-ignore`:

- unknown id → `No customer 9` (with the id);
- the email, if there is one, in lower case: `Ada <ada@example.com>`; otherwise `Bo (no email)`;
- then, if the customer has an address, ` in Leeds` (their city).

Starter code:

```ts
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

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** three values might be missing: the customer, the email, the address.
2. **Examples:** Cy has an address but no email: "Cy (no email) in York".
3. **Brute force:** `c!.email!.toLowerCase()`: compiles, then crashes for Bo.
4. **Pattern:** **narrow, then use**: check each optional value right before you need it.
5. **Plan:** early return for no customer → email or "(no email)" → city if any.
6. **Code and test:** Run with ids 1, 2, 3 and 9.

</details>

<details>
<summary>💡 Hint 1</summary>

Run it: TypeScript reports three "possibly undefined" errors. Each one is a case to handle.

</details>

<details>
<summary>💡 Hint 2</summary>

Start with `if (!c) return \`No customer ${id}\`;`: below it, `c` is a `Customer`.

</details>

<details>
<summary>💡 Hint 3</summary>

Choose the first part with `c.email ? … : …`, and add the city inside `if (c.address) { … }`. Each check narrows that property for the code it guards.

</details>

**In the sandbox:** exercises 63–64. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Model the payments</summary>

```ts
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

**Line by line**

- Each member of `Payment` has a different literal `kind`, so TypeScript can tell them apart.
- In `case "card":`, `p` is narrowed to `{ kind: "card"; last4: string }`; `p.email` would be an error there.
- The voucher formats pence as pounds.
- The `never` default costs nothing at runtime and turns "forgot a case" into a compile error.

**Trace:** `{ kind: "voucher", code: "TEN", value: 1050 }` → case "voucher" → `10.50` → "Voucher TEN (£10.50)".

**Common wrong approach:** `interface Payment { kind: string; last4?: string; email?: string; code?: string; value?: number }`: it accepts `{ kind: "card" }` with no card number, and every use needs checks for fields that "might" be missing.

</details>

<details>
<summary>✅ 2. Handle the missing values</summary>

```ts
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

**Line by line**

- `if (!c) return …` handles a missing customer and narrows `c` to `Customer` for the rest of the function.
- `c.email ? … : …` narrows `c.email` to `string` in the first branch, so `toLowerCase()` is allowed.
- `if (c.address)` narrows `c.address` to `{ city: string; … }` inside the `if`.

**Trace:** id 3 → Cy → no email → "Cy (no email)" → address → " in York".

**Common wrong approach:** `c?.email?.toLowerCase()` everywhere: it compiles, but produces lines like "undefined <undefined>" instead of the text the requirement asks for. Optional chaining avoids crashes; it doesn't decide what to show.

</details>

## Quick quiz

1. What is the type of x inside if (typeof x === "string") when x is string | number?
   - A) string
   - B) string | number
   - C) unknown

2. What makes a union a discriminated union?
   - A) Every member has a common property with a different literal type, like kind
   - B) Every member is an interface
   - C) It has exactly two members

3. Why put const unhandled: never = s in a switch's default branch?
   - A) So that forgetting to handle a new member becomes a compile error
   - B) To make the switch faster
   - C) Because switch statements require it

4. What does value as Product check at runtime?
   - A) Nothing: it only tells the compiler to trust you
   - B) That value has every Product property
   - C) That value isn't null

<details>
<summary>Quiz answers</summary>

1. **A) string**: TypeScript narrows the union using the check.
2. **A) Every member has a common property with a different literal type, like kind**: Checking the discriminant narrows to one member.
3. **A) So that forgetting to handle a new member becomes a compile error**: If a case is missing, s isn't never there, and the assignment fails to compile.
4. **A) Nothing: it only tells the compiler to trust you**: Assertions are erased like all types; validate data with real code instead.

</details>

---
Previous: [Lesson 31](31-why-typescript.md) · Next: [Lesson 33: Typed functions and generics](33-functions-and-generics.md)
