@@@ part
id: 3
title: Modern JavaScript
level: Intermediate
blurb: The language features that structure real programs: classes and how `this` works, modules with import and export, errors and how to handle them, iterators and generators, and regular expressions for matching text.

@@@ lesson
id: classes
title: Classes and this
minutes: 28
summary: Defining classes with constructors, methods and fields, private fields with #, getters and setters, static members, inheritance with extends and super, instanceof, how this is decided (method calls, lost this in callbacks, arrow functions, bind), and prototypes underneath it all.
---
A **class** is a blueprint for creating objects that share the same shape and behaviour. Each object made from it is an **instance**.

```js
class Product {
  constructor(name, price) {           // runs when you write new Product(...)
    this.name = name;                  // this is the new instance
    this.price = price;
  }

  withVat() {                          // a method, shared by every instance
    return this.price * 1.2;
  }

  toString() {
    return `${this.name} (£${this.price})`;
  }
}

const tube = new Product("Inner tube", 10);
const bell = new Product("Bell", 8);
console.log(tube.withVat(), `${bell}`, tube instanceof Product);
```

### Fields, private fields and accessors

```js
class Account {
  owner;                               // a public field
  #balance = 0;                        // a PRIVATE field: only code inside the class can see it
  static count = 0;                    // a static field: belongs to the class, not each instance

  constructor(owner) {
    this.owner = owner;
    Account.count++;
  }

  deposit(amount) {
    if (amount <= 0) throw new RangeError("Deposits must be positive");
    this.#balance += amount;
    return this;                       // returning this lets calls chain
  }

  get balance() {                      // a getter: read like a property, no brackets
    return this.#balance;
  }
}

const acc = new Account("Ada").deposit(50).deposit(25);
console.log(acc.balance, acc.owner, Account.count);
console.log(Object.keys(acc));         // the private field isn't visible
```

- **Private fields** (`#name`) are truly private: code outside the class gets a syntax error if it even mentions them. They're how a class protects its rules (here: the balance only changes through `deposit`).
- **Getters and setters** (`get x()`, `set x(value)`) look like properties to callers but run code.
- **Static** members belong to the class itself: `Account.count`, or helpers like `Product.fromJSON(data)`.

### Inheritance

A class can **extend** another, inheriting its fields and methods and adding or overriding some:

```js
class Product {
  constructor(name, price) { this.name = name; this.price = price; }
  label() { return `${this.name}: £${this.price}`; }
}

class Bike extends Product {
  constructor(name, price, frameSize) {
    super(name, price);                // call the parent constructor first
    this.frameSize = frameSize;
  }
  label() {                            // override, reusing the parent's version
    return `${super.label()} (frame ${this.frameSize})`;
  }
}

const bike = new Bike("Trail 29", 899, "L");
console.log(bike.label(), bike instanceof Bike, bike instanceof Product);
```

Inheritance is useful for genuine "is a kind of" relationships, but deep hierarchies get hard to change. Often it's simpler to **compose**: give an object other objects that do part of the work.

### How `this` is decided

`this` isn't fixed when a function is written; for ordinary functions and methods it depends on **how the function is called**:

```js
const cart = {
  items: [6, 12],
  total() { return this.items.reduce((a, b) => a + b, 0); },
};
console.log(cart.total());          // called as cart.total(): this is cart

const loose = cart.total;           // the same function, detached from cart
try {
  loose();                          // called on its own: this is undefined (strict mode)
} catch (e) {
  console.log("Lost this:", e.message);
}

const bound = cart.total.bind(cart);   // bind fixes this permanently
console.log(bound());
```

This bites most often when you pass a method as a **callback** (to `setTimeout`, an event listener or `map`). Two fixes:

- **Arrow functions** don't have their own `this`; they use the `this` of the code around them. A class field holding an arrow function keeps its instance:

```js
class Counter {
  count = 0;
  increment = () => { this.count++; };      // an arrow function in a field: always this instance
}
const c = new Counter();
const fn = c.increment;                      // detached, but still works
fn(); fn();
console.log(c.count);
```

- **`bind`**: `button.addEventListener("click", this.handle.bind(this))`.

### Under the hood: prototypes

Classes are a clearer syntax over JavaScript's original mechanism, **prototypes**. Every object has a hidden link to a prototype object; when a property isn't found on the object, JavaScript looks it up the **prototype chain**. Methods live once on the prototype and are shared by every instance:

```js
class Product { label() { return "a product"; } }
const p = new Product();
console.log(Object.getPrototypeOf(p) === Product.prototype, Object.hasOwn(p, "label"), typeof p.label);
```

You rarely need to touch prototypes directly, but they explain why methods are shared and how `instanceof` works.

:::exercise A bank account class
Write a class `BankAccount` with:

- `constructor(owner, opening = 0)`: stores the owner and an opening balance (throw a `RangeError` if `opening` is negative);
- a **private** balance (`#balance`), readable through a getter `balance`;
- `deposit(amount)` and `withdraw(amount)`, which throw a `RangeError` if the amount isn't positive, and `withdraw` also if it's more than the balance; both return the account so calls can chain;
- `toString()` returning `"<owner>: £<balance with 2 decimals>"`.
```js starter
class BankAccount {
  // your code here
}

const acc = new BankAccount("Ada", 100);
acc.deposit(50).withdraw(30);
console.log(acc.balance, `${acc}`);   // 120 Ada: £120.00
```
```js check
const BA = need("BankAccount", "class");
const a = new BA("Ada", 100);
same(a.deposit(50).withdraw(30) === a, true, "deposit(...).withdraw(...) returning the account (for chaining)");
same(a.balance, 120, "The balance after +50 and −30");
same(`${a}`, "Ada: £120.00", "The text form of the account");
same(new BA("Bo").balance, 0, "A new account with no opening balance");
same(`${new BA("Cy", 5.5)}`, "Cy: £5.50", "Two decimals");
const expectRange = (fn, what) => {
  let e = null;
  try { fn(); } catch (err) { e = err; }
  if (!(e instanceof RangeError)) throw new AssertionError(`${what} should throw a RangeError.`);
};
expectRange(() => new BA("X", -1), 'new BankAccount("X", -1)');
expectRange(() => new BA("X", 10).deposit(0), "deposit(0)");
expectRange(() => new BA("X", 10).deposit(-5), "deposit(-5)");
expectRange(() => new BA("X", 10).withdraw(11), "withdrawing more than the balance");
expectRange(() => new BA("X", 10).withdraw(-1), "withdraw(-1)");
const b = new BA("Dee", 10);
try { b.withdraw(50); } catch {}
same(b.balance, 10, "The balance after a refused withdrawal");
if (Object.keys(b).some((k) => /balance/i.test(k)) || "balance" in b && Object.getOwnPropertyDescriptor(b, "balance")) {
  throw new AssertionError("Keep the balance private (#balance) and expose it with a getter, not a public field.");
}
if (!/#balance/.test(__source__)) throw new AssertionError("Use a private field called #balance.");
```
```js solution
class BankAccount {
  #balance;

  constructor(owner, opening = 0) {
    if (opening < 0) throw new RangeError("Opening balance can't be negative");
    this.owner = owner;
    this.#balance = opening;
  }

  get balance() {
    return this.#balance;
  }

  deposit(amount) {
    if (!(amount > 0)) throw new RangeError("Deposit must be positive");
    this.#balance += amount;
    return this;
  }

  withdraw(amount) {
    if (!(amount > 0)) throw new RangeError("Withdrawal must be positive");
    if (amount > this.#balance) throw new RangeError("Insufficient funds");
    this.#balance -= amount;
    return this;
  }

  toString() {
    return `${this.owner}: £${this.#balance.toFixed(2)}`;
  }
}

const acc = new BankAccount("Ada", 100);
acc.deposit(50).withdraw(30);
console.log(acc.balance, `${acc}`);
```
hint: Declare the private field at the top of the class body: `#balance;`. Only methods inside the class can read or change it.
hint: A getter looks like `get balance() { return this.#balance; }`. Methods that should chain end with `return this;`.
hint: Check amounts before changing anything: `if (!(amount > 0)) throw new RangeError(...)` also rejects `NaN`. In `withdraw`, check against `this.#balance` too.
approach:
1. **Understand:** an object that protects a rule (no negative balance) by hiding its data and offering methods.
2. **Examples:** withdrawing 50 from 10 must throw and leave the balance at 10.
3. **Brute force:** a plain object with a public `balance` property: anyone could set it to −1000.
4. **Pattern:** **encapsulation**: private state, validated methods, a read-only getter.
5. **Plan:** private field → constructor check → getter → deposit and withdraw with guards → toString.
6. **Code and test:** chaining, invalid amounts, refused withdrawals leave the balance unchanged.
walkthrough:
**Line by line**

- `#balance;` declares the private field; trying `acc.#balance` outside the class is a syntax error, and `acc.balance = 5` does nothing because there's only a getter (in strict mode it throws).
- Validating **before** changing state means a failed call leaves the account exactly as it was.
- `!(amount > 0)` is true for 0, negatives and `NaN`, where `amount <= 0` would let `NaN` through.
- `return this` makes `acc.deposit(50).withdraw(30)` work.
- `toString` is used automatically in template literals.

**Trace:** `new BankAccount("Ada", 100)` → 100; deposit 50 → 150; withdraw 30 → 120; `${acc}` → "Ada: £120.00".

**Common wrong approach:** a public `this.balance` field. It's easy, but any code can break the rules by assigning to it, and the class can no longer guarantee its own invariants. (Real money code would use whole pence, as in Lesson 4.)
:::

:::exercise Shapes with inheritance
Write a base class `Shape` with a constructor taking a `name`, a method `area()` that throws an `Error` with the message `"area() not implemented"`, and a method `describe()` returning `"<name> with area <area rounded to 2 decimals>"` (using `toFixed(2)`). Then write `Circle extends Shape` (constructor `radius`, name `"circle"`) and `Rect extends Shape` (constructor `width, height`, name `"rectangle"`), each overriding `area()`.
```js starter
class Shape {
  // your code here
}

class Circle extends Shape {
  // your code here
}

class Rect extends Shape {
  // your code here
}

console.log(new Circle(1).describe(), new Rect(2, 3.5).describe());
// circle with area 3.14 rectangle with area 7.00
```
```js check
const S = need("Shape", "class"), C = need("Circle", "class"), R = need("Rect", "class");
same(new C(1).describe(), "circle with area 3.14", "new Circle(1).describe()");
same(new R(2, 3.5).describe(), "rectangle with area 7.00", "new Rect(2, 3.5).describe()");
same(new C(2).area(), Math.PI * 4, "new Circle(2).area()");
same(new R(4, 5).area(), 20, "new Rect(4, 5).area()");
same(new C(1) instanceof S && new R(1, 1) instanceof S, true, "Circle and Rect being Shapes (instanceof Shape)");
let e = null;
try { new S("blob").area(); } catch (err) { e = err; }
if (!e || e.message !== "area() not implemented") throw new AssertionError('new Shape("blob").area() should throw an Error with the message "area() not implemented".');
same(new C(1).name, "circle", "A circle's name");
if (Object.hasOwn(C.prototype, "describe") || Object.hasOwn(R.prototype, "describe")) {
  throw new AssertionError("Write describe() once, in Shape, and let the subclasses inherit it.");
}
```
```js solution
class Shape {
  constructor(name) {
    this.name = name;
  }
  area() {
    throw new Error("area() not implemented");
  }
  describe() {
    return `${this.name} with area ${this.area().toFixed(2)}`;
  }
}

class Circle extends Shape {
  constructor(radius) {
    super("circle");
    this.radius = radius;
  }
  area() {
    return Math.PI * this.radius ** 2;
  }
}

class Rect extends Shape {
  constructor(width, height) {
    super("rectangle");
    this.width = width;
    this.height = height;
  }
  area() {
    return this.width * this.height;
  }
}

console.log(new Circle(1).describe(), new Rect(2, 3.5).describe());
```
hint: In each subclass constructor, call `super("circle")` (or `"rectangle"`) **before** using `this`.
hint: `describe()` lives only in `Shape` and calls `this.area()`. When it runs on a Circle, `this.area` is the Circle's version.
hint: Circle's area is `Math.PI * this.radius ** 2`; Rect's is `this.width * this.height`.
approach:
1. **Understand:** shared behaviour in the base class; each subclass supplies its own `area`.
2. **Examples:** `new Circle(1).describe()` uses Shape's describe with Circle's area.
3. **Brute force:** a `describe` in every class: duplicated code.
4. **Pattern:** **template method**: the base class defines the algorithm, subclasses fill in a step.
5. **Plan:** Shape (name, abstract area, describe) → Circle and Rect (super, area).
6. **Code and test:** both shapes, the base class's error, instanceof.
walkthrough:
**Line by line**

- `super("circle")` runs Shape's constructor, which sets `this.name`; using `this` before `super` is a `ReferenceError`.
- Shape's `area()` throws, marking it as a method subclasses must provide (JavaScript has no `abstract` keyword; TypeScript does, Part 6).
- `this.area()` in `describe` calls whichever `area` the actual object has: the subclass's override. This is **polymorphism**.
- `toFixed(2)` formats the number for display.

**Trace:** `new Rect(2, 3.5).describe()` → Shape's describe → `this.area()` is Rect's → 7 → "rectangle with area 7.00".

**Common wrong approach:** checking the type inside `describe` (`if (this instanceof Circle) … else if …`). Every new shape would then need edits to the base class; overriding `area` keeps each shape's logic with the shape.
:::

:::quiz
? What does the # in #balance mean?
+ A private field, accessible only inside the class
- A comment
- A static field
= Code outside the class can't read or write it.
? const f = obj.method; f(); What is this inside method?
+ undefined (in strict mode), because the function was called on its own
- obj
- The global object, always
= Use bind or an arrow function to keep this.
? In a subclass constructor, what must happen before you use this?
+ Call super(...)
- Call this.init()
- Nothing; this is ready immediately
= super runs the parent's constructor.
? Why do arrow functions help with callbacks in classes?
+ They use the this of the surrounding code instead of having their own
- They run faster
- They can't be detached
= An arrow function in a class field keeps its instance.
:::

@@@ lesson
id: modules
title: Modules: import and export
minutes: 22
summary: Why programs are split into modules, ES modules with named and default exports, import syntax and renaming, module scope and strict mode, relative and package specifiers, how files are resolved, modules in the browser (type="module") and in Node.js (ESM versus CommonJS require), dynamic import(), import maps, and circular dependencies.
---
Real programs are split across many files. A **module** is a file with its own scope that **exports** what other files may use and **imports** what it needs. JavaScript's standard system is **ES modules** (ESM).

### Exporting and importing

```js-static
// prices.js
export const VAT = 0.2;                         // a named export

export function withVat(net) {                  // another named export
  return round(net * (1 + VAT));
}

function round(x) {                             // not exported: private to this file
  return Math.round(x * 100) / 100;
}

export default class Basket { /* … */ }         // one default export per module
```

```js-static
// main.js
import Basket, { VAT, withVat } from "./prices.js";      // the default, plus named exports
import { withVat as addVat } from "./prices.js";          // rename on import
import * as prices from "./prices.js";                     // everything, as one namespace object

console.log(withVat(10), addVat(10), prices.VAT, new Basket());
```

- **Named exports** are imported by their exact names (in braces). A module can have many.
- A **default export** is imported without braces, under any name you like. Many style guides prefer named exports only, because names stay consistent across a codebase and editors can auto-import them.
- Anything not exported is **private** to the module, like the `round` helper.
- Imports are **live bindings** and **read-only**: you can't assign to an imported name.

### Module scope and strict mode

Each module has its own top-level scope, so a `const total` in one file never clashes with `total` in another. Modules always run in strict mode, can use `await` at the top level, and run **once**, however many files import them (later imports share the same instance).

### Where imports come from

| Specifier | Means |
|---|---|
| `"./prices.js"`, `"../lib/util.js"` | a file, relative to the **importing** file |
| `"/js/app.js"` | from the site root (browser) |
| `"lodash-es"`, `"zod"` | a **package**, found in `node_modules` by Node.js and bundlers |
| `"node:fs"` | a Node.js built-in module |
| `"https://…/x.js"` | a full URL (browsers and Deno) |

In browsers and Node's ES modules, relative imports need the **file extension** (`./prices.js`, not `./prices`). Bundlers and TypeScript setups often let you leave it off.

### Modules in the browser

```html-static
<script type="module" src="main.js"></script>
```

`type="module"` makes the script a module: imports work, it runs after the page has loaded (like `defer`), and each module file is fetched separately. In production, tools like **Vite** or **esbuild** (Part 7) **bundle** modules into a few files for speed.

### Modules in Node.js: ESM and CommonJS

Node.js has two systems. Modern code uses ES modules; older code (and many tutorials) uses **CommonJS**:

```js-static
// CommonJS (older)
const { readFile } = require("node:fs/promises");
module.exports = { withVat };

// ES modules (modern): use "type": "module" in package.json, or the .mjs extension
import { readFile } from "node:fs/promises";
export { withVat };
```

Node.js can now `require` most ES modules and import CommonJS ones, so mixing works, but new projects should use ES modules throughout.

### Loading modules on demand: import()

`import(specifier)` (with brackets) loads a module **at run time** and returns a promise. It's used to load rarely needed code only when it's needed (**code splitting**), such as a big charting library when the user opens a chart:

```js
// A tiny module written inline as a data: URL, so this runs right here in the sandbox:
const source = "export const greet = (name) => `Hello, ${name}!`; export default 42;";
const mod = await import("data:text/javascript," + encodeURIComponent(source));
console.log(mod.greet("Ada"), mod.default, Object.keys(mod));
```

### Pitfalls

- **Circular imports** (a.js imports b.js, which imports a.js) are allowed, but one side may see the other's exports before they're initialised, causing a `ReferenceError`. Move the shared code into a third module.
- **Side effects on import**: code at the top level of a module runs when it's first imported. Keep module top levels to declarations, so importing is safe and fast.
- **Mixing default and named exports** of the same thing confuses readers; pick one style.

:::exercise List a file's imports
Write `listImports(source)` returning the module specifiers (the text in quotes) of every static `import` statement in some ES module source code, in order. Handle these forms (single or double quotes):

- `import x from "a";`, `import { a, b } from "b";`, `import * as ns from "c";`, `import x, { y } from "d";`
- `import "e";` (imported only for its side effects)

Ignore dynamic `import("…")` calls and any line that starts with `//`.
```js starter
function listImports(source) {
  // your code here
}

const code = `import Basket, { VAT } from "./prices.js";
import * as fs from 'node:fs';
import "./polyfills.js";
// import old from "./old.js";
const later = await import("./lazy.js");`;
console.log(listImports(code));   // [ './prices.js', 'node:fs', './polyfills.js' ]
```
```js check
const src = `import Basket, { VAT } from "./prices.js";
import * as fs from 'node:fs';
import "./polyfills.js";
// import old from "./old.js";
const later = await import("./lazy.js");`;
test("listImports", [
  [[src], ["./prices.js", "node:fs", "./polyfills.js"], "the example"],
  [["import {\n  a,\n  b,\n} from \"./multi.js\";"], ["./multi.js"], "an import across several lines"],
  [["const x = 1;"], [], "no imports"],
  [["import x from 'a'; import y from \"b\";"], ["a", "b"], "two on one line"],
  [["  // import x from 'nope';\nimport z from 'yes';"], ["yes"], "an indented comment"],
  [["export { a } from './re-export.js';\nimport('./dynamic.js');"], [], "re-exports and dynamic imports aren't import statements"],
], { show: "listImports(source)" });
```
```js solution
function listImports(source) {
  const code = source.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
  const pattern = /\bimport\s+(?:[\w*{}\s,$]+?\s+from\s+)?(["'])([^"']+)\1/g;
  return [...code.matchAll(pattern)].map((m) => m[2]);
}

const code = `import Basket, { VAT } from "./prices.js";
import * as fs from 'node:fs';
import "./polyfills.js";
// import old from "./old.js";
const later = await import("./lazy.js");`;
console.log(listImports(code));
```
hint: Remove comment lines first: split into lines, drop those whose trimmed text starts with `//`, and join them again.
hint: A regular expression can match `import`, then optionally "something `from`", then a quoted string. `matchAll` with the `g` flag finds every match (Lesson 20 explains the syntax).
hint: `/\bimport\s+(?:[\w*{}\s,$]+?\s+from\s+)?(["'])([^"']+)\1/g` captures the quote character and then the specifier; `\1` requires the closing quote to match the opening one. A dynamic `import(` has a bracket straight after `import`, so `\s+` doesn't match it.
approach:
1. **Understand:** find every static import's specifier, skipping comments and dynamic imports.
2. **Examples:** `import "./polyfills.js";` has no `from` but still imports.
3. **Brute force:** a full JavaScript parser (such as Acorn or the TypeScript compiler): the robust answer in real tools.
4. **Pattern:** **pre-filter, then a regular expression with an optional group**.
5. **Plan:** strip comment lines → matchAll → take the captured specifier.
6. **Code and test:** each import form, multi-line imports, two per line, comments, dynamic imports, re-exports.
walkthrough:
**Line by line**

- Filtering whole comment lines handles the `// import old …` case simply (a full parser would also handle `/* … */` comments and strings that merely contain the word "import").
- `\bimport\s+` requires whitespace after `import`, which excludes `import(` (dynamic) and words like `important`.
- `(?:… from\s+)?` is an optional, non-capturing group for everything between `import` and `from`; `[\w*{}\s,$]+?` allows names, braces, commas, `*` and newlines (so multi-line imports work).
- `(["'])([^"']+)\1` captures the quote, the specifier, and requires the same closing quote.

**Trace:** line 1 → `import` + `Basket, { VAT } from ` + `"./prices.js"` → "./prices.js".

**Common wrong approach:** `source.match(/from "(.+)"/)`, which misses side-effect imports, single quotes and every import after the first. Build tools such as Vite and esbuild do this job with a real parser, for exactly these reasons.
:::

:::exercise Resolve a relative import
Write `resolve(fromFile, specifier)` returning the path a relative import points to, the way browsers and Node.js resolve it: relative to the **folder** containing `fromFile`, with `.` meaning "this folder" and `..` "the parent folder". Paths use `/`. If the path climbs above the root, throw an `Error`. Specifiers that don't start with `./` or `../` are packages: return them unchanged.
```js starter
function resolve(fromFile, specifier) {
  // your code here
}

console.log(resolve("src/app/main.js", "./prices.js"));        // src/app/prices.js
console.log(resolve("src/app/main.js", "../lib/util.js"));     // src/lib/util.js
console.log(resolve("src/app/main.js", "zod"));                // zod
```
```js check
test("resolve", [
  [["src/app/main.js", "./prices.js"], "src/app/prices.js", "same folder"],
  [["src/app/main.js", "../lib/util.js"], "src/lib/util.js", "parent folder"],
  [["src/app/main.js", "../../index.js"], "index.js", "two levels up"],
  [["src/app/main.js", "./a/./b/../c.js"], "src/app/a/c.js", ". and .. in the middle"],
  [["main.js", "./x.js"], "x.js", "a file at the root"],
  [["src/app/main.js", "zod"], "zod", "a package"],
  [["src/app/main.js", "node:fs"], "node:fs", "a Node.js built-in"],
], { show: "resolve({0}, {1})" });
const r = need("resolve", "function");
let e = null;
try { r("src/main.js", "../../outside.js"); } catch (err) { e = err; }
if (!(e instanceof Error)) throw new AssertionError('resolve("src/main.js", "../../outside.js") should throw an Error (it climbs above the root).');
```
```js solution
function resolve(fromFile, specifier) {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) return specifier;
  const parts = fromFile.split("/").slice(0, -1);       // the folder containing fromFile
  for (const piece of specifier.split("/")) {
    if (piece === "." || piece === "") continue;
    if (piece === "..") {
      if (parts.length === 0) throw new Error(`${specifier} climbs above the root`);
      parts.pop();
    } else {
      parts.push(piece);
    }
  }
  return parts.join("/");
}

console.log(resolve("src/app/main.js", "./prices.js"));
console.log(resolve("src/app/main.js", "../lib/util.js"));
console.log(resolve("src/app/main.js", "zod"));
```
hint: Start from the importing file's folder: split `fromFile` on `/` and drop the last piece (the file name).
hint: Walk the specifier's pieces like a stack: `..` pops a folder, `.` does nothing, anything else is pushed.
hint: If `..` arrives when the stack is empty, `throw new Error(...)`. Finally `join("/")`. Return non-relative specifiers unchanged at the very start.
approach:
1. **Understand:** relative to the folder, not the file; `.` and `..` can appear anywhere.
2. **Examples:** from `src/app/main.js`, `../lib/util.js` → up from `src/app` to `src`, then `lib/util.js`.
3. **Brute force:** string replacements of `"../"`: breaks on `./a/./b/../c.js`.
4. **Pattern:** **a path as a stack of folder names**.
5. **Plan:** package check → folder parts → push / pop per piece → join.
6. **Code and test:** same folder, parents, nested dots, root files, packages, climbing too far.
walkthrough:
**Line by line**

- `slice(0, -1)` removes the file name, leaving the folder the import is relative to.
- The loop treats the path as a stack: `..` pops, a name pushes, `.` and empty pieces (from `//`) are skipped.
- Popping an empty stack means the path tries to leave the project, which real resolvers also reject or treat specially.
- Non-relative specifiers are packages or built-ins, found by a different rule (searching `node_modules`), so they're returned as they are.

**Trace:** `("src/app/main.js", "./a/./b/../c.js")` → stack [src, app] → "." skip → push a → "." skip → push b → ".." pop b → push c.js → "src/app/a/c.js".

**Common wrong approach:** resolving relative to the importing **file** instead of its folder, giving `src/app/main.js/prices.js`. Node.js has `path.resolve` and `new URL(specifier, fileUrl)` for this; the URL version is what browsers use.
:::

:::quiz
? How do you import a module's default export?
+ import Basket from "./prices.js"
- import { default } from "./prices.js"
- import * from "./prices.js"
= Named exports use braces; the default doesn't.
? A module is imported by three other files. How many times does its top-level code run?
+ Once
- Three times
- Never, until a function is called
= Every importer shares the same instance.
? What does import("./chart.js") (with brackets) do?
+ Loads the module at run time and returns a promise
- The same as a static import at the top
- Imports only the default export
= Dynamic import enables code splitting.
? In the browser, what makes a script an ES module?
+ <script type="module">
- Naming it .mjs
- Putting export at the top
= Module scripts are deferred and can import other modules.
:::

@@@ lesson
id: errors
title: Errors and error handling
minutes: 26
summary: What happens when an error is thrown, the built-in error types, throw, try / catch / finally, rethrowing, custom error classes with extra fields, error causes, AggregateError, errors as values, checking for errors with Error.isError, validating input at the boundary, and what to log.
---
When something goes wrong, JavaScript **throws** an error: normal execution stops, and the error travels up through the functions that called each other (the **call stack**) until something **catches** it. If nothing does, the program stops (or, in a browser, that piece of code stops and the error appears in the console).

### Built-in error types

| Type | Thrown when… |
|---|---|
| `SyntaxError` | the code (or `JSON.parse` input) can't be read |
| `ReferenceError` | a name doesn't exist |
| `TypeError` | a value is the wrong type: calling `undefined`, reading a property of `null` |
| `RangeError` | a number is out of range; the stack overflows |
| `Error` | the general type; the base of all the others |

Every error has a `name`, a `message` and a `stack` (the chain of calls that led to it).

### throw, try, catch, finally

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

### Catch only what you can handle

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

### Custom error classes

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

### Wrapping errors with a cause

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

### Errors as values

Throwing isn't the only style. For failures that are **expected** (a form field is invalid, a search finds nothing), returning a result is often clearer than an exception, as in Lesson 14's `safeParse`:

```js
function divide(a, b) {
  return b === 0 ? { ok: false, error: "division by zero" } : { ok: true, value: a / b };
}
const r = divide(10, 0);
console.log(r.ok ? r.value : `failed: ${r.error}`);
```

A good rule: **throw for bugs and truly exceptional situations; return results for outcomes the caller should always consider.**

### Several errors at once

`AggregateError` holds a list of errors, for operations that try several things (it's what `Promise.any` throws when every promise fails, Part 4). And `Error.isError(value)` (new in ECMAScript 2026, not yet in every browser) reliably tells whether a value is an error, even one created in another frame or window, where `instanceof Error` can be fooled.

### What to log

When you catch an error you can't fix, log enough to debug it: the message, the stack, the cause, and what the program was doing (which order, which user action), but never passwords, tokens or other secrets. In production, error-tracking services such as Sentry collect these automatically.

:::exercise A validation error
Write a class `ValidationError` extending `Error`, with `name` set to `"ValidationError"` and a `field` property. Then write `validateSignup({ email, age })` that throws a `ValidationError`:

- for `field` `"email"` with message `"email must contain @"` if `email` isn't a string containing `@`;
- for `field` `"age"` with message `"age must be 13 or over"` if `age` isn't an integer of at least 13.

Check the email first. If both are fine, return `true`.
```js starter
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
```js check
const VE = need("ValidationError", "class");
const v = need("validateSignup", "function");
same(v({ email: "a@b.co", age: 13 }), true, "A valid signup");
const fails = (data) => { try { v(data); } catch (e) { return e; } return null; };
const e1 = fails({ email: "ada.example.com", age: 30 });
if (!(e1 instanceof VE) || !(e1 instanceof Error)) throw new AssertionError("A bad email should throw a ValidationError (which is also an Error).");
same([e1.name, e1.field, e1.message], ["ValidationError", "email", "email must contain @"], "The error for a bad email (name, field, message)");
const e2 = fails({ email: "ada@example.com", age: 9 });
same([e2 && e2.field, e2 && e2.message], ["age", "age must be 13 or over"], "The error for age 9");
same(fails({ email: "ada@example.com", age: 13.5 })?.field, "age", "The field for age 13.5");
same(fails({ email: "ada@example.com", age: "20" })?.field, "age", 'The field for age "20" (a string)');
same(fails({ email: 42, age: 20 })?.field, "email", "The field for a non-string email");
same(fails({ email: "nope", age: 5 })?.field, "email", "The field when both are wrong (email is checked first)");
if (typeof e1.stack !== "string") throw new AssertionError("Call super(message) so the error gets a message and a stack trace.");
```
```js solution
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
hint: The class needs a constructor taking `(field, message)` that calls `super(message)` first, then sets `this.name` and `this.field`.
hint: In `validateSignup`, check the email with `typeof email !== "string" || !email.includes("@")`.
hint: `Number.isInteger(age) && age >= 13` is the valid age; throw `new ValidationError("age", "age must be 13 or over")` otherwise.
approach:
1. **Understand:** a custom error type carrying the failing field, thrown by a validator.
2. **Examples:** age "20" is a string, so it fails the integer check.
3. **Brute force:** throwing plain `Error`s with the field in the message text: callers would have to parse messages.
4. **Pattern:** **custom error subclass + guard clauses**.
5. **Plan:** class (super, name, field) → email check → age check → true.
6. **Code and test:** each failure, order of checks, wrong types.
walkthrough:
**Line by line**

- `super(message)` sets the message and captures the stack trace; it must come before `this`.
- Setting `this.name` makes logs show "ValidationError" instead of "Error".
- The destructured parameter `{ email, age }` reads the two fields from the object passed in.
- Checking `typeof` first stops `42.includes` from throwing a `TypeError` of its own.

**Trace:** `{ email: "nope", age: 5 }` → the email check fails first → field "email".

**Common wrong approach:** `throw "invalid age"` (a string). Strings have no stack trace and no fields, and `catch (e) { e.field }` can't work. Always throw Error objects.
:::

:::exercise Try each option in turn
Write `firstSuccess(functions)` that calls each function in order and returns the first result that doesn't throw. If every function throws, throw an `AggregateError` containing all their errors (in order), with the message `"all options failed"`. With an empty list, throw that `AggregateError` with an empty errors list.
```js starter
function firstSuccess(functions) {
  // your code here
}

const loadFromCache = () => { throw new Error("cache empty"); };
const loadFromServer = () => "fresh data";
console.log(firstSuccess([loadFromCache, loadFromServer]));   // fresh data
```
```js check
const fs = need("firstSuccess", "function");
same(fs([() => { throw new Error("a"); }, () => "b", () => "c"]), "b", "The first success");
same(fs([() => 0]), 0, "A falsy result (0) is still a success");
let calls = 0;
fs([() => "first", () => { calls++; return "second"; }]);
same(calls, 0, "Functions called after the first success (they shouldn't be)");
let err = null;
try { fs([() => { throw new Error("x"); }, () => { throw new TypeError("y"); }]); } catch (e) { err = e; }
if (!(err instanceof AggregateError)) throw new AssertionError("When every function throws, throw an AggregateError.");
same(err.message, "all options failed", "The AggregateError's message");
same(err.errors.map((e) => e.message), ["x", "y"], "The messages of the collected errors");
let empty = null;
try { fs([]); } catch (e) { empty = e; }
if (!(empty instanceof AggregateError) || empty.errors.length !== 0) throw new AssertionError("With no functions, throw an AggregateError with an empty errors list.");
```
```js solution
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
hint: Loop over the functions with a `try` around each call. Returning from inside `try` ends the whole function straight away.
hint: In `catch`, push the error into a list and carry on with the next function.
hint: After the loop, `throw new AggregateError(errors, "all options failed");`.
approach:
1. **Understand:** fallbacks in order; stop at the first success; report every failure if none succeed.
2. **Examples:** cache fails, server succeeds → "fresh data", and later functions never run.
3. **Brute force:** nested try / catch blocks for a fixed number of options: doesn't scale.
4. **Pattern:** **fallback chain with collected errors**.
5. **Plan:** errors list → loop with try { return } catch { push } → throw AggregateError.
6. **Code and test:** first succeeds, later succeeds, falsy results, all fail, empty list.
walkthrough:
**Line by line**

- `return fn()` inside `try` leaves the function immediately when a call succeeds, so later options never run.
- Each failure is collected rather than discarded, so the final error explains everything that went wrong.
- `new AggregateError(errors, message)` takes the list first, then the message; its `errors` property holds the list.
- An empty list skips the loop and throws with no errors, a clear signal that there were no options.

**Trace:** cache throws → errors [cache empty] → server returns "fresh data" → returned.

**Common wrong approach:** checking `if (result)` to decide success, which treats a legitimate result of `0`, `""` or `false` as failure. Success means "didn't throw". (`Promise.any` is the async version of this pattern, Part 4.)
:::

:::quiz
? When does a finally block run?
+ Always: after try finishes, after catch, even after a return
- Only when an error was thrown
- Only when no error was thrown
= Use it for clean-up.
? Why rethrow errors you don't recognise in a catch block?
+ Swallowing unexpected errors hides bugs
- JavaScript requires every catch to rethrow
- It makes the code faster
= Handle what you expect; let the rest propagate.
? What does new Error("Couldn't save", { cause: err }) do?
+ Creates a new error that keeps the original error as its cause
- Throws err immediately
- Merges the two messages
= Causes preserve the low-level detail.
? Why throw Error objects rather than strings?
+ Error objects carry a name, message and stack trace
- Strings can't be thrown
- Strings are slower
= throw "oops" works but loses the stack.
:::

@@@ lesson
id: iterators-and-generators
title: Iterators and generators
minutes: 26
summary: The iteration protocol behind for…of and spread, making your own objects iterable with Symbol.iterator, generator functions with function* and yield, lazy and infinite sequences, iterator helpers (map, filter, take, drop, toArray), and when laziness pays off.
---
`for…of`, spread (`[...x]`), destructuring and `Array.from` all work on many kinds of values: arrays, strings, Maps, Sets. What they share is the **iteration protocol**.

### The protocol

An **iterable** is an object with a `[Symbol.iterator]()` method that returns an **iterator**: an object with a `next()` method. Each `next()` call returns `{ value, done }`:

```js
const letters = ["a", "b"];
const it = letters[Symbol.iterator]();
console.log(it.next(), it.next(), it.next());
```

`for…of` simply calls `next()` until `done` is `true`. Any object that follows the protocol works with all of JavaScript's iteration syntax:

```js
class Countdown {
  constructor(from) { this.from = from; }
  [Symbol.iterator]() {
    let current = this.from;
    return {
      next: () => (current >= 0 ? { value: current--, done: false } : { value: undefined, done: true }),
    };
  }
}
for (const n of new Countdown(3)) console.log(n);
console.log([...new Countdown(2)], Math.max(...new Countdown(5)));
```

### Generators: iterators the easy way

Writing `next()` by hand is tedious. A **generator function** (`function*`) does it for you: each `yield` hands out one value and **pauses** the function until the next value is requested.

```js
function* countdown(from) {
  for (let n = from; n >= 0; n--) {
    yield n;                        // pause here, giving out n
  }
}
console.log([...countdown(3)]);

function* steps() {
  console.log("  starting");
  yield 1;
  console.log("  resumed after 1");
  yield 2;
  console.log("  finished");
}
const gen = steps();
console.log("created (nothing has run yet)");
console.log(gen.next());
console.log(gen.next());
console.log(gen.next());
```

Calling a generator function runs **none** of its body: it returns a generator object. The body runs bit by bit, as values are asked for. That's **lazy evaluation**.

### Infinite sequences

Because values are produced only on demand, a generator can describe a sequence that never ends, as long as the consumer stops asking:

```js
function* naturals() {
  let n = 1;
  while (true) yield n++;            // safe: it pauses at every yield
}
function* fibonacci() {
  let [a, b] = [0, 1];
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}
const firstFib = [];
for (const f of fibonacci()) {
  if (f > 100) break;               // the consumer decides when to stop
  firstFib.push(f);
}
console.log(firstFib);
console.log(naturals().take(5).toArray());
```

### Iterator helpers

Since 2025, iterators have their own lazy versions of the array methods: `map`, `filter`, `take`, `drop`, `flatMap`, `reduce`, `some`, `every`, `find`, `forEach` and `toArray`. Unlike array methods, they don't build intermediate arrays, and they work on infinite sequences:

```js
function* naturals() { let n = 1; while (true) yield n++; }
const oddSquares = naturals()
  .filter((n) => n % 2 === 1)
  .map((n) => n * n)
  .take(4)                           // only the first 4 are ever computed
  .toArray();
console.log(oddSquares);
console.log(Iterator.from(new Set([3, 1, 2])).map((x) => x * 10).toArray());
```

Iterator helpers are part of ECMAScript 2025 and work in all current browsers (since early 2025). `Iterator.from(...)` turns any iterable into an iterator that has the helpers.

### When laziness pays off

- **Huge or endless data:** reading a large file line by line, paging through an API, generating IDs.
- **Stopping early:** "find the first match" without processing everything.
- **Pipelines** of steps where you don't want a copy of the data at every stage.

For small arrays, ordinary array methods are simpler and just as fast. Async generators (`async function*`) bring the same idea to data that arrives over time, such as streamed API responses (Part 4).

:::exercise A range generator
Write a generator `range(start, end, step = 1)` that yields numbers from `start` up to (but not including) `end`, going up by `step`. A negative `step` counts down (stopping before `end`). A `step` of 0 should throw a `RangeError` as soon as iteration starts.
```js starter
function* range(start, end, step = 1) {
  // your code here
}

console.log([...range(0, 5)], [...range(1, 10, 3)], [...range(5, 0, -2)]);
// [ 0, 1, 2, 3, 4 ] [ 1, 4, 7 ] [ 5, 3, 1 ]
```
```js check
const r = need("range", "function");
const all = (...args) => [...r(...args)];
same(all(0, 5), [0, 1, 2, 3, 4], "[...range(0, 5)]");
same(all(1, 10, 3), [1, 4, 7], "[...range(1, 10, 3)]");
same(all(5, 0, -2), [5, 3, 1], "[...range(5, 0, -2)]");
same(all(3, 3), [], "[...range(3, 3)]");
same(all(5, 0), [], "[...range(5, 0)] (wrong direction for a positive step)");
same(all(0, 1, 0.25), [0, 0.25, 0.5, 0.75], "[...range(0, 1, 0.25)]");
const g = r(0, 1e15);
if (typeof g.next !== "function") throw new AssertionError("range should be a generator function (function*), returning an iterator.");
same([g.next().value, g.next().value], [0, 1], "The first two values of a huge range (it must be lazy)");
let e = null;
try { [...r(0, 5, 0)]; } catch (err) { e = err; }
if (!(e instanceof RangeError)) throw new AssertionError("A step of 0 should throw a RangeError.");
```
```js solution
function* range(start, end, step = 1) {
  if (step === 0) throw new RangeError("step can't be 0");
  if (step > 0) {
    for (let n = start; n < end; n += step) yield n;
  } else {
    for (let n = start; n > end; n += step) yield n;
  }
}

console.log([...range(0, 5)], [...range(1, 10, 3)], [...range(5, 0, -2)]);
```
hint: Inside a `function*`, a normal loop with `yield n` produces each value lazily.
hint: Counting up continues while `n < end`; counting down (negative step) while `n > end`.
hint: Check `step === 0` first and throw; because the body only starts when iteration starts, the error appears at that moment, as the task asks.
approach:
1. **Understand:** like Python's `range`, as a lazy generator, in both directions.
2. **Examples:** range(5, 0, -2) → 5, 3, 1 (stops before 0).
3. **Brute force:** build and return an array: works for small ranges, but range(0, 1e15) would never finish.
4. **Pattern:** **generator with a loop**.
5. **Plan:** guard zero → loop up or down → yield.
6. **Code and test:** empty ranges, wrong direction, fractional steps, a huge range to prove laziness.
walkthrough:
**Line by line**

- `function*` makes a generator; nothing in it runs until the first `next()`.
- Two loops with different conditions handle the two directions; a positive step with `start > end` gives nothing, like Python.
- `yield n` pauses the loop, so a range up to 10¹⁵ costs nothing until values are requested.

**Trace:** `range(1, 10, 3)` → yields 1, 4, 7; next n is 10, not < 10 → done.

**Common wrong approach:** `while (n !== end)` as the loop condition: with a step that jumps over `end` (1, 4, 7, 10… for end 9) it never stops.
:::

:::exercise Batch any iterable
Write a generator `batches(iterable, size)` that yields arrays of up to `size` consecutive items from **any** iterable (array, string, Set, another generator…), the last batch possibly shorter. It must work on infinite iterables, producing batches lazily.
```js starter
function* batches(iterable, size) {
  // your code here
}

console.log([...batches([1, 2, 3, 4, 5], 2)]);        // [ [ 1, 2 ], [ 3, 4 ], [ 5 ] ]
console.log([...batches("hello", 3)]);                 // [ [ 'h', 'e', 'l' ], [ 'l', 'o' ] ]
```
```js check
const b = need("batches", "function");
same([...b([1, 2, 3, 4, 5], 2)], [[1, 2], [3, 4], [5]], "batches([1, 2, 3, 4, 5], 2)");
same([...b("hello", 3)], [["h", "e", "l"], ["l", "o"]], 'batches("hello", 3)');
same([...b(new Set([1, 2, 3]), 3)], [[1, 2, 3]], "a Set of exactly one batch");
same([...b([], 4)], [], "an empty array");
function* forever() { let n = 0; while (true) yield n++; }
const g = b(forever(), 3);
same([g.next().value, g.next().value], [[0, 1, 2], [3, 4, 5]], "the first two batches of an infinite sequence");
```
```js solution
function* batches(iterable, size) {
  let batch = [];
  for (const item of iterable) {
    batch.push(item);
    if (batch.length === size) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length > 0) yield batch;      // the shorter final batch
}

console.log([...batches([1, 2, 3, 4, 5], 2)]);
console.log([...batches("hello", 3)]);
```
hint: You can't use `slice` on a Set or a generator, but `for…of` works on every iterable.
hint: Collect items into a `batch` array; when it reaches `size`, `yield` it and start a new empty one.
hint: After the loop, yield what's left if it isn't empty.
approach:
1. **Understand:** like Lesson 9's chunk, but for any iterable and lazily.
2. **Examples:** "hello" in threes → h e l | l o.
3. **Brute force:** `[...iterable]` then chunk: breaks on infinite iterables and copies big ones.
4. **Pattern:** **streaming accumulator**: collect, emit, reset.
5. **Plan:** loop → push → emit when full → emit the remainder.
6. **Code and test:** strings, Sets, empty input, an infinite generator.
walkthrough:
**Line by line**

- `for…of` pulls one item at a time from the source, so the source can be infinite.
- `yield batch` pauses after each full batch; the consumer controls how many batches are made.
- `batch = []` starts a new array rather than clearing the old one (`batch.length = 0` would empty the array the consumer just received).
- The final `if` emits a short last batch, but never an empty one.

**Trace:** "hello", 3 → push h, e, l → yield [h, e, l] → push l, o → loop ends → yield [l, o].

**Common wrong approach:** `batch.length = 0` to reset: the batch already handed out is the same array, so the consumer's data vanishes.
:::

:::quiz
? What does calling a generator function do?
+ Returns a generator object; the body runs only as values are requested
- Runs the whole body immediately
- Returns an array of every yielded value
= Generators are lazy.
? What must an object have to work with for…of?
+ A [Symbol.iterator]() method returning an iterator
- A length property
- A forEach method
= That's the iteration protocol.
? Why can while (true) yield n++ be safe?
+ The generator pauses at each yield, and the consumer decides when to stop
- JavaScript stops infinite loops automatically
- yield ends the loop
= Use take, break or a condition in the consumer.
? What's an advantage of iterator helpers like .filter().map().take() over array methods?
+ They're lazy: no intermediate arrays, and they work on infinite sequences
- They're always faster for small arrays
- They sort automatically
= Each value flows through the whole pipeline on demand.
:::

@@@ lesson
id: regular-expressions
title: Regular expressions
minutes: 28
summary: Writing patterns with literal characters, character classes, quantifiers and anchors; flags (g, i, m, s, u, v, y, d); test, match, matchAll, replace with groups and functions, and split; capturing, named and non-capturing groups; alternation; lookahead and lookbehind; greedy versus lazy; Unicode property escapes; RegExp.escape; and when not to use a regular expression.
---
A **regular expression** (regex) is a pattern for matching text: "a run of digits", "an email-shaped word", "a date like 2026-10-08". JavaScript writes them between slashes, `/pattern/flags`, or builds them from strings with `new RegExp(text, flags)`.

### The building blocks

| Pattern | Matches |
|---|---|
| `abc` | the literal text "abc" |
| `.` | any one character (except a line break, unless the `s` flag is used) |
| `\d`, `\w`, `\s` | a digit; a "word" character (letter, digit, `_`); whitespace |
| `\D`, `\W`, `\S` | the opposite of each |
| `[abc]`, `[a-z]`, `[^0-9]` | one of these; a range; anything **except** these |
| `^`, `$` | the start and end of the text (or of each line with `m`) |
| `\b` | a word boundary |
| `*`, `+`, `?` | 0 or more; 1 or more; 0 or 1 (optional) |
| `{3}`, `{2,4}`, `{2,}` | exactly 3; 2 to 4; 2 or more |
| `a\|b` | `a` or `b` |
| `\.`, `\*`, `\\` | a literal `.`, `*` or backslash (escape special characters) |

```js
const postcode = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i;    // a simplified UK postcode
for (const p of ["BS1 5TR", "sw1a1aa", "12345"]) console.log(p, postcode.test(p));
```

### Flags

| Flag | Effect |
|---|---|
| `g` | global: find **all** matches (for `matchAll`, `replace`, `match`) |
| `i` | ignore case |
| `m` | multi-line: `^` and `$` match at each line |
| `s` | "dotAll": `.` also matches line breaks |
| `u` / `v` | Unicode mode (`v` is the newer, more powerful version): needed for `\p{…}` and correct emoji handling |
| `y` | sticky: match only at `lastIndex` |
| `d` | record the start and end positions of each group |

### Using regular expressions

```js
const text = "Order 1042 shipped 2026-10-08; order 1043 due 2026-10-15.";
console.log(/\d{4}-\d{2}-\d{2}/.test(text));                  // is there a match?
console.log(text.match(/\d{4}-\d{2}-\d{2}/)[0]);              // the first match
console.log(text.match(/\b\d{4}\b/g));                        // every 4-digit number, years included (g flag)
for (const m of text.matchAll(/order (\d+)/gi)) {             // every match, with its groups
  console.log(m[0], "→ number", m[1], "at index", m.index);
}
console.log(text.replace(/\d{4}-\d{2}-\d{2}/g, "[date]"));
console.log("a, b;c  d".split(/[,;\s]+/));
```

### Groups

Brackets **capture** part of a match. **Named groups** `(?<name>…)` make results readable; `(?:…)` groups without capturing:

```js
const re = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/;
const m = "Shipped on 2026-10-08".match(re);
console.log(m.groups.day, m.groups.month, m.groups.year);
console.log("2026-10-08".replace(re, "$<day>/$<month>/$<year>"));   // use groups in the replacement
console.log("price: 12 GBP, 30 EUR".replace(/(\d+) (GBP|EUR)/g, (whole, amount, cur) =>
  cur === "GBP" ? `£${amount}` : `€${amount}`));                     // or a function
console.log(/^(?:https?):\/\//.test("https://example.com"));
```

### Greedy and lazy

Quantifiers are **greedy**: they match as much as possible. Add `?` to make them **lazy** (as little as possible):

```js
const html = "<b>bold</b> and <i>italic</i>";
console.log(html.match(/<.+>/)[0]);        // greedy: from the first < to the LAST >
console.log(html.match(/<.+?>/g));         // lazy: each tag separately
```

### Lookarounds

Lookarounds check what comes before or after **without** including it in the match:

| Syntax | Means |
|---|---|
| `x(?=y)` | x followed by y |
| `x(?!y)` | x not followed by y |
| `(?<=y)x` | x preceded by y |
| `(?<!y)x` | x not preceded by y |

```js
console.log("£12 $30 £7".match(/(?<=£)\d+/g));                     // amounts after a £ sign
console.log("1234567".replace(/\B(?=(\d{3})+(?!\d))/g, ","));      // thousands separators (Lesson 4)
```

### Unicode

`\w` only matches the English letters A–Z. With the `u` (or `v`) flag, `\p{…}` matches by Unicode property, so patterns work for every language:

```js
console.log("Ünïcødé café 東京".match(/\w+/g));
console.log("Ünïcødé café 東京".match(/\p{L}+/gu));    // \p{L}: any letter in any script
```

### Building patterns from text safely

When a pattern contains text from a user or a variable, special characters like `.` or `*` must be escaped. `RegExp.escape` (ECMAScript 2025, in all current browsers) does it:

```js
const search = "1.5*2";
const naive = new RegExp(search);              // . and * are treated as pattern syntax!
const safe = new RegExp(RegExp.escape(search));
console.log(naive.test("135552"), safe.test("135552"), safe.test("the 1.5*2 rule"));
```

### When not to use a regular expression

Regexes are great for small, regular patterns. They're the wrong tool for nested structures (HTML, JSON, code: use a parser), for fully validating emails or URLs (use `new URL(text)` or a proper library, and for emails, send a confirmation link), and for anything a few string methods express more clearly. Complex patterns can also become extremely slow on certain inputs (**catastrophic backtracking**), so keep them simple, and test them on long, non-matching text.

:::exercise Parse a log line
Log lines look like `2026-10-08 14:03:59 [ERROR] payment-service: Card declined (code 51)`. Write `parseLogLine(line)` returning `{ date, time, level, service, message }` (all strings), or `null` if the line doesn't have this shape. `level` is one of `DEBUG`, `INFO`, `WARN` or `ERROR`; the service name is letters, digits and hyphens; the message is everything after `": "` (and may be empty).
```js starter
function parseLogLine(line) {
  // your code here
}

console.log(parseLogLine("2026-10-08 14:03:59 [ERROR] payment-service: Card declined (code 51)"));
```
```js check
test("parseLogLine", [
  [["2026-10-08 14:03:59 [ERROR] payment-service: Card declined (code 51)"],
   { date: "2026-10-08", time: "14:03:59", level: "ERROR", service: "payment-service", message: "Card declined (code 51)" }, "an error line"],
  [["2026-01-02 00:00:00 [INFO] api: started"], { date: "2026-01-02", time: "00:00:00", level: "INFO", service: "api", message: "started" }, "an info line"],
  [["2026-01-02 00:00:00 [WARN] cache-2: "], { date: "2026-01-02", time: "00:00:00", level: "WARN", service: "cache-2", message: "" }, "an empty message"],
  [["2026-01-02 00:00:00 [TRACE] api: x"], null, "an unknown level"],
  [["hello world"], null, "not a log line"],
  [["2026-1-2 00:00:00 [INFO] api: x"], null, "a malformed date"],
  [["2026-01-02 00:00:00 [INFO] api: a: b: c"], { date: "2026-01-02", time: "00:00:00", level: "INFO", service: "api", message: "a: b: c" }, "colons in the message"],
  [["x 2026-01-02 00:00:00 [INFO] api: shifted"], null, "extra text at the start"],
], { show: "parseLogLine({0})" });
```
```js solution
const LOG_LINE = /^(?<date>\d{4}-\d{2}-\d{2}) (?<time>\d{2}:\d{2}:\d{2}) \[(?<level>DEBUG|INFO|WARN|ERROR)\] (?<service>[A-Za-z0-9-]+): (?<message>.*)$/;

function parseLogLine(line) {
  const m = LOG_LINE.exec(line);
  return m ? { ...m.groups } : null;
}

console.log(parseLogLine("2026-10-08 14:03:59 [ERROR] payment-service: Card declined (code 51)"));
```
hint: Use named groups for each part: `(?<date>\d{4}-\d{2}-\d{2})`, `(?<time>…)` and so on, with `^` and `$` so the whole line must match.
hint: The level is an alternation inside literal brackets: `\[(?<level>DEBUG|INFO|WARN|ERROR)\]` (square brackets must be escaped).
hint: The service is `(?<service>[A-Za-z0-9-]+)`, then `: `, then `(?<message>.*)` for the rest. Return `{ ...m.groups }`, or `null` when there's no match.
approach:
1. **Understand:** a fixed layout; extract five fields; reject anything else.
2. **Examples:** the message can contain colons, so only the first `": "` after the service ends it.
3. **Brute force:** `split(" ")` and index juggling: fragile with spaces in messages.
4. **Pattern:** **one anchored regex with named groups**.
5. **Plan:** write the pattern part by part → `exec` → copy the groups.
6. **Code and test:** each level, empty messages, colons in messages, malformed dates, extra text.
walkthrough:
**Line by line**

- `^` and `$` make the whole line match, so extra text at the start is rejected.
- `\[` and `\]` match literal square brackets; inside them, `DEBUG|INFO|WARN|ERROR` allows only the four levels.
- The service pattern `[A-Za-z0-9-]+` can't contain `:` or spaces, so the first `": "` after it is the separator.
- `.*` takes the rest of the line, including further colons or nothing at all.
- `{ ...m.groups }` copies the named groups into a plain object.

**Trace:** "…[ERROR] payment-service: Card declined (code 51)" → date, time, level ERROR, service payment-service, message "Card declined (code 51)".

**Common wrong approach:** `line.split(": ")`, which splits messages that contain ": " into pieces. A pattern that describes the whole line is both stricter and clearer.
:::

:::exercise Highlight search terms
Write `highlight(text, term)` that wraps every occurrence of `term` in `text` with `<mark>` and `</mark>`, ignoring case but keeping the original text's capitals. The term may contain characters such as `.`, `*` or `(` that must be treated literally. An empty term returns the text unchanged.
```js starter
function highlight(text, term) {
  // your code here
}

console.log(highlight("Tubes, tubeless tyres and TUBE repairs", "tube"));
// <mark>Tube</mark>s, <mark>tube</mark>less tyres and <mark>TUBE</mark> repairs
console.log(highlight("Version 1.5 (beta), not 125", "1.5"));
// Version <mark>1.5</mark> (beta), not 125
```
```js check
test("highlight", [
  [["Tubes, tubeless tyres and TUBE repairs", "tube"], "<mark>Tube</mark>s, <mark>tube</mark>less tyres and <mark>TUBE</mark> repairs", "case-insensitive"],
  [["Version 1.5 (beta), not 125", "1.5"], "Version <mark>1.5</mark> (beta), not 125", "a dot is literal"],
  [["Price (incl. VAT)", "(incl."], "Price <mark>(incl.</mark> VAT)", "brackets are literal"],
  [["a*b a**b", "a*b"], "<mark>a*b</mark> a**b", "an asterisk is literal"],
  [["nothing here", "bell"], "nothing here", "no matches"],
  [["unchanged", ""], "unchanged", "an empty term"],
  [["$100 and $1000", "$1"], "<mark>$1</mark>00 and <mark>$1</mark>000", "a dollar sign"],
], { show: "highlight({0}, {1})" });
```
```js solution
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");      // the same job as RegExp.escape
}

function highlight(text, term) {
  if (term === "") return text;
  const pattern = new RegExp(escapeRegex(term), "gi");
  return text.replace(pattern, (match) => `<mark>${match}</mark>`);
}

console.log(highlight("Tubes, tubeless tyres and TUBE repairs", "tube"));
console.log(highlight("Version 1.5 (beta), not 125", "1.5"));
```
hint: Build the pattern from the term with `new RegExp(…, "gi")`: `g` for every match, `i` to ignore case.
hint: Escape the term first so `.` and `(` are literal: `RegExp.escape(term)` in current browsers, or `term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`.
hint: Replace with a function, `(match) => \`<mark>${match}</mark>\``, so the original capitals are kept. (A replacement string containing `$` would be read specially.)
approach:
1. **Understand:** case-insensitive search for literal text; keep the matched text exactly.
2. **Examples:** "1.5" must not match "125", which an unescaped `.` would.
3. **Brute force:** lower-case both and use `indexOf` in a loop, slicing the original: works, more code.
4. **Pattern:** **escaped dynamic regex + replacement function**.
5. **Plan:** empty check → escape → RegExp with g and i → replace with a function.
6. **Code and test:** case, dots, brackets, asterisks, dollar signs, no match, empty term.
walkthrough:
**Line by line**

- Without escaping, `"1.5"` becomes the pattern "1, any character, 5", which matches "125".
- The escape pattern puts a backslash before each special character; `$&` in a replacement string means "the whole match".
- A replacement **function** receives the actual matched text ("Tube", "TUBE"), so capitals survive, and its return value is used literally, so a `$` in the matched text is safe.
- The empty-term check matters: `new RegExp("", "g")` matches between every character.

**Trace:** "Version 1.5 (beta), not 125" with "1.5" → pattern `1\.5` → only "1.5" matches → wrapped.

**Common wrong approach:** `new RegExp(term, "gi")` without escaping: search terms like "c++" or "(beta)" throw a `SyntaxError` or match the wrong things. In real pages, also escape the text for HTML before adding tags, or a term like `<script>` could inject markup (Part 5).
:::

:::quiz
? What does the g flag do?
+ Finds every match instead of only the first
- Ignores case
- Makes . match line breaks
= Needed for matchAll and for replacing all matches.
? On "<b>x</b>", what does /<.+>/ match?
+ The whole string, because + is greedy
- Just <b>
- Nothing
= Use <.+?> for the shortest match.
? Why escape user text before putting it in a RegExp?
+ Characters like . * ( would be treated as pattern syntax
- RegExp only accepts lower-case text
- To make the match case-insensitive
= RegExp.escape or a small escape function does it.
? Which pattern matches a letter in any language?
+ /\p{L}/u
- /\w/
- /[a-zA-Z]/
= \w covers only A–Z, digits and _.
:::
