# Lesson 17: Modules: import and export

**You'll learn:** why programs are split into modules, ES modules, named and default exports, import syntax, renaming and namespace imports, module scope, strict mode and running once, live read-only bindings, relative, absolute and package specifiers, file extensions, modules in the browser, ESM versus CommonJS in Node.js, dynamic import() and code splitting, circular imports, side effects on import.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#modules)**: run every example and check your exercise answers.

## Key terms

- **Module:** a file with its own scope that exports values for other files to import.
- **ES modules (ESM):** JavaScript's standard module system, using `import` and `export`.
- **Named export:** an export imported by its exact name, in braces.
- **Default export:** a module's single main export, imported without braces under any name.
- **Specifier:** the text after `from` that says which module to load.
- **CommonJS:** Node.js's older module system, using `require` and `module.exports`.
- **Dynamic import:** `import()`, loading a module at run time and returning a promise.
- **Bundler:** a tool that combines many modules into a few files for the browser.

Real programs are split across many files. A **module** is a file with its own scope that **exports** what other files may use and **imports** what it needs. JavaScript's standard system is **ES modules** (ESM).

## Exporting and importing

```js
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

```js
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

## Module scope and strict mode

Each module has its own top-level scope, so a `const total` in one file never clashes with `total` in another. Modules always run in strict mode, can use `await` at the top level, and run **once**, however many files import them (later imports share the same instance).

## Where imports come from

| Specifier | Means |
|---|---|
| `"./prices.js"`, `"../lib/util.js"` | a file, relative to the **importing** file |
| `"/js/app.js"` | from the site root (browser) |
| `"lodash-es"`, `"zod"` | a **package**, found in `node_modules` by Node.js and bundlers |
| `"node:fs"` | a Node.js built-in module |
| `"https://…/x.js"` | a full URL (browsers and Deno) |

In browsers and Node's ES modules, relative imports need the **file extension** (`./prices.js`, not `./prices`). Bundlers and TypeScript setups often let you leave it off.

## Modules in the browser

```html
<script type="module" src="main.js"></script>
```

`type="module"` makes the script a module: imports work, it runs after the page has loaded (like `defer`), and each module file is fetched separately. In production, tools like **Vite** or **esbuild** (Part 7) **bundle** modules into a few files for speed.

## Modules in Node.js: ESM and CommonJS

Node.js has two systems. Modern code uses ES modules; older code (and many tutorials) uses **CommonJS**:

```js
// CommonJS (older)
const { readFile } = require("node:fs/promises");
module.exports = { withVat };

// ES modules (modern): use "type": "module" in package.json, or the .mjs extension
import { readFile } from "node:fs/promises";
export { withVat };
```

Node.js can now `require` most ES modules and import CommonJS ones, so mixing works, but new projects should use ES modules throughout.

## Loading modules on demand: import()

`import(specifier)` (with brackets) loads a module **at run time** and returns a promise. It's used to load rarely needed code only when it's needed (**code splitting**), such as a big charting library when the user opens a chart:

```js
// A tiny module written inline as a data: URL, so this runs right here in the sandbox:
const source = "export const greet = (name) => `Hello, ${name}!`; export default 42;";
const mod = await import("data:text/javascript," + encodeURIComponent(source));
console.log(mod.greet("Ada"), mod.default, Object.keys(mod));
```

## Pitfalls

- **Circular imports** (a.js imports b.js, which imports a.js) are allowed, but one side may see the other's exports before they're initialised, causing a `ReferenceError`. Move the shared code into a third module.
- **Side effects on import**: code at the top level of a module runs when it's first imported. Keep module top levels to declarations, so importing is safe and fast.
- **Mixing default and named exports** of the same thing confuses readers; pick one style.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Share code | export from one module; import in another | O(1) | O(1) |
| Load on demand | await import("./big.js") | O(module size) | O(module size) |
| Resolve a relative path | folder parts as a stack; .. pops | O(path length) | O(depth) |

## Common mistakes

- Leaving off the file extension in browser or Node.js ES module imports.
- Mixing `require` and `import` styles without knowing which system a file uses.
- Putting slow work or side effects at the top level of a module.
- Creating circular imports between two modules.
- Resolving relative paths from the file instead of its folder.

## Exercises

### 1. List a file's imports

Write `listImports(source)` returning the module specifiers (the text in quotes) of every static `import` statement in some ES module source code, in order. Handle these forms (single or double quotes):

- `import x from "a";`, `import { a, b } from "b";`, `import * as ns from "c";`, `import x, { y } from "d";`
- `import "e";` (imported only for its side effects)

Ignore dynamic `import("…")` calls and any line that starts with `//`.

Starter code:

```js
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

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** find every static import's specifier, skipping comments and dynamic imports.
2. **Examples:** `import "./polyfills.js";` has no `from` but still imports.
3. **Brute force:** a full JavaScript parser (such as Acorn or the TypeScript compiler): the robust answer in real tools.
4. **Pattern:** **pre-filter, then a regular expression with an optional group**.
5. **Plan:** strip comment lines → matchAll → take the captured specifier.
6. **Code and test:** each import form, multi-line imports, two per line, comments, dynamic imports, re-exports.

</details>

<details>
<summary>💡 Hint 1</summary>

Remove comment lines first: split into lines, drop those whose trimmed text starts with `//`, and join them again.

</details>

<details>
<summary>💡 Hint 2</summary>

A regular expression can match `import`, then optionally "something `from`", then a quoted string. `matchAll` with the `g` flag finds every match (Lesson 20 explains the syntax).

</details>

<details>
<summary>💡 Hint 3</summary>

`/\bimport\s+(?:[\w*{}\s,$]+?\s+from\s+)?(["'])([^"']+)\1/g` captures the quote character and then the specifier; `\1` requires the closing quote to match the opening one. A dynamic `import(` has a bracket straight after `import`, so `\s+` doesn't match it.

</details>

### 2. Resolve a relative import

Write `resolve(fromFile, specifier)` returning the path a relative import points to, the way browsers and Node.js resolve it: relative to the **folder** containing `fromFile`, with `.` meaning "this folder" and `..` "the parent folder". Paths use `/`. If the path climbs above the root, throw an `Error`. Specifiers that don't start with `./` or `../` are packages: return them unchanged.

Starter code:

```js
function resolve(fromFile, specifier) {
  // your code here
}

console.log(resolve("src/app/main.js", "./prices.js"));        // src/app/prices.js
console.log(resolve("src/app/main.js", "../lib/util.js"));     // src/lib/util.js
console.log(resolve("src/app/main.js", "zod"));                // zod
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** relative to the folder, not the file; `.` and `..` can appear anywhere.
2. **Examples:** from `src/app/main.js`, `../lib/util.js` → up from `src/app` to `src`, then `lib/util.js`.
3. **Brute force:** string replacements of `"../"`: breaks on `./a/./b/../c.js`.
4. **Pattern:** **a path as a stack of folder names**.
5. **Plan:** package check → folder parts → push / pop per piece → join.
6. **Code and test:** same folder, parents, nested dots, root files, packages, climbing too far.

</details>

<details>
<summary>💡 Hint 1</summary>

Start from the importing file's folder: split `fromFile` on `/` and drop the last piece (the file name).

</details>

<details>
<summary>💡 Hint 2</summary>

Walk the specifier's pieces like a stack: `..` pops a folder, `.` does nothing, anything else is pushed.

</details>

<details>
<summary>💡 Hint 3</summary>

If `..` arrives when the stack is empty, `throw new Error(...)`. Finally `join("/")`. Return non-relative specifiers unchanged at the very start.

</details>

**In the sandbox:** exercises 33–34. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. List a file's imports</summary>

```js
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

**Line by line**

- Filtering whole comment lines handles the `// import old …` case simply (a full parser would also handle `/* … */` comments and strings that merely contain the word "import").
- `\bimport\s+` requires whitespace after `import`, which excludes `import(` (dynamic) and words like `important`.
- `(?:… from\s+)?` is an optional, non-capturing group for everything between `import` and `from`; `[\w*{}\s,$]+?` allows names, braces, commas, `*` and newlines (so multi-line imports work).
- `(["'])([^"']+)\1` captures the quote, the specifier, and requires the same closing quote.

**Trace:** line 1 → `import` + `Basket, { VAT } from ` + `"./prices.js"` → "./prices.js".

**Common wrong approach:** `source.match(/from "(.+)"/)`, which misses side-effect imports, single quotes and every import after the first. Build tools such as Vite and esbuild do this job with a real parser, for exactly these reasons.

</details>

<details>
<summary>✅ 2. Resolve a relative import</summary>

```js
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

**Line by line**

- `slice(0, -1)` removes the file name, leaving the folder the import is relative to.
- The loop treats the path as a stack: `..` pops, a name pushes, `.` and empty pieces (from `//`) are skipped.
- Popping an empty stack means the path tries to leave the project, which real resolvers also reject or treat specially.
- Non-relative specifiers are packages or built-ins, found by a different rule (searching `node_modules`), so they're returned as they are.

**Trace:** `("src/app/main.js", "./a/./b/../c.js")` → stack [src, app] → "." skip → push a → "." skip → push b → ".." pop b → push c.js → "src/app/a/c.js".

**Common wrong approach:** resolving relative to the importing **file** instead of its folder, giving `src/app/main.js/prices.js`. Node.js has `path.resolve` and `new URL(specifier, fileUrl)` for this; the URL version is what browsers use.

</details>

## Quick quiz

1. How do you import a module's default export?
   - A) import Basket from "./prices.js"
   - B) import { default } from "./prices.js"
   - C) import * from "./prices.js"

2. A module is imported by three other files. How many times does its top-level code run?
   - A) Once
   - B) Three times
   - C) Never, until a function is called

3. What does import("./chart.js") (with brackets) do?
   - A) Loads the module at run time and returns a promise
   - B) The same as a static import at the top
   - C) Imports only the default export

4. In the browser, what makes a script an ES module?
   - A) <script type="module">
   - B) Naming it .mjs
   - C) Putting export at the top

<details>
<summary>Quiz answers</summary>

1. **A) import Basket from "./prices.js"**: Named exports use braces; the default doesn't.
2. **A) Once**: Every importer shares the same instance.
3. **A) Loads the module at run time and returns a promise**: Dynamic import enables code splitting.
4. **A) <script type="module">**: Module scripts are deferred and can import other modules.

</details>

---
Previous: [Lesson 16](16-classes.md) · Next: [Lesson 18: Errors and error handling](18-errors.md)
