# Lesson 38: Formatting, linting and bundling

**You'll learn:** formatters and Prettier, linters and ESLint 10's flat config, rules and --fix, typescript-eslint, Biome and Oxlint, abstract syntax trees and how rules work, type-checking with tsc --noEmit, bundlers and module graphs, tree shaking, minification, transpiling, content hashes and caching, source maps, Vite 8 and Rolldown, hot module replacement, esbuild and webpack, running all checks in CI.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#formatting-linting-bundling)**: run every example and check your exercise answers.

## Key terms

- **Formatter:** a tool that rewrites code into a consistent layout, such as Prettier.
- **Linter:** a tool that reports suspicious or error-prone code, such as ESLint.
- **Flat config:** ESLint's configuration file format, `eslint.config.js`, an array of config objects.
- **Abstract syntax tree (AST):** the tree of nodes a parser builds from source code.
- **Bundler:** a tool that combines modules and their dependencies into a few files for the browser.
- **Module graph:** the files of a program and the imports between them.
- **Tree shaking:** leaving code that nothing uses out of a bundle.
- **Minification:** making code smaller by removing whitespace and comments and shortening names.
- **Source map:** a file that maps generated code back to the original source, for debugging.
- **Hot module replacement (HMR):** updating changed modules in a running page without a full reload.

Professional projects let tools do the boring checking: a **formatter** makes the layout consistent, a **linter** finds suspicious code, the **type checker** finds type errors, and a **bundler** turns your modules into files a browser loads quickly. Set up once, they run in your editor on every save and in CI on every push (the next course covers CI).

## Formatting: Prettier

**Prettier** rewrites your code with a consistent layout: indentation, quotes, semicolons, line breaks. Its point is to end style debates: the team accepts its output and nobody argues about it in code reviews.

```bash
npm install -D prettier
npx prettier --write .        # format every file
npx prettier --check .        # in CI: fail if anything isn't formatted
```

A small `.prettierrc` can change the few options it has (such as `"printWidth": 100`). Most editors format on save.

## Linting: ESLint

A linter reports code that is valid but probably wrong or confusing: unused variables, `==` instead of `===`, a missing `await`, unreachable code. **ESLint** is the standard. ESLint 10 (2026) only supports the **flat config** file, `eslint.config.js`:

```js
// eslint.config.js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,                    // ESLint's recommended rules
  ...tseslint.configs.recommended,           // rules for TypeScript code
  {
    rules: {
      eqeqeq: "error",                       // always === and !==
      "no-var": "error",
      "no-console": ["warn", { allow: ["error"] }],
    },
  },
];
```

```bash
npx eslint .          # report problems
npx eslint . --fix    # fix those that can be fixed automatically
```

Each rule is `"off"`, `"warn"` or `"error"`, sometimes with options. Rules that need type information, from typescript-eslint, can find things like a promise you forgot to `await`.

**Faster alternatives**, written in Rust: **Biome** formats and lints in one tool, and **Oxlint** runs many ESLint rules much faster. Large projects sometimes use one of them for speed and keep ESLint for rules only it has.

## How a linter sees your code

Linters, formatters, bundlers and the TypeScript compiler all start by **parsing** code into a tree of nodes, the **abstract syntax tree** (AST). A rule is a function that visits certain kinds of node and reports problems. For `if (qty == 0) total = 0;`, part of the tree looks like this:

```js
const ast = {
  type: "IfStatement",
  test: {
    type: "BinaryExpression",
    operator: "==",                                       // the eqeqeq rule looks for exactly this
    left: { type: "Identifier", name: "qty" },
    right: { type: "Literal", value: 0 },
  },
  consequent: { type: "ExpressionStatement" /* total = 0 */ },
};

function eqeqeq(node, report) {
  if (node.type === "BinaryExpression" && (node.operator === "==" || node.operator === "!=")) {
    report(`Expected '${node.operator}=' and instead saw '${node.operator}'.`);
  }
}
eqeqeq(ast.test, (message) => console.log("eqeqeq:", message));
```

Working on the tree, not the text, is what lets tools ignore `==` inside a string or a comment. The first exercise does a simpler version with characters.

## Type-checking

`npx tsc --noEmit` type-checks the whole project without writing files (Lesson 31). Bundlers and `node file.ts` skip type-checking for speed, so this command is how type errors are caught: in your editor while you type, and in CI before code is merged.

## Bundling

A web app is written as many modules, plus packages from `node_modules`. A **bundler** follows the `import`s from an entry file to build the **module graph**, then:

- combines modules into a few files, in an order where every module comes after what it imports;
- **tree-shakes**: leaves out code nothing imports;
- **minifies**: removes whitespace and comments and shortens names, so files download faster;
- turns TypeScript and JSX into JavaScript;
- adds a content hash to file names (`app.3f9a2c.js`), so browsers can cache them forever and fetch a new name after each change;
- writes **source maps**, so errors and the debugger show your original code instead of the minified output.

```js
const modules = {
  "main.js": ["cart.js", "format.js"],
  "cart.js": ["format.js"],
  "format.js": [],
  "admin.js": ["format.js"],            // not imported by main.js: left out of the bundle
};

const included = new Set();
const visit = (file) => {
  if (included.has(file)) return;
  included.add(file);
  modules[file].forEach(visit);
};
visit("main.js");
console.log([...included]);
```

**Vite** is the most popular tool for building web apps. During development it serves your modules directly to the browser and updates the page as you save (**hot module replacement**); `vite build` bundles for production. **Vite 8** (March 2026) does both with **Rolldown**, a bundler written in Rust, which makes production builds many times faster than before. Frameworks such as React, Vue and Svelte use Vite or similar tools; **esbuild** and **webpack** are other bundlers you'll meet.

## Make the checks automatic

```json
{
  "scripts": {
    "check": "prettier --check . && eslint . && tsc --noEmit && node --test"
  }
}
```

Run it in CI on every pull request, and editors do the same checks as you type. Some teams also run the fast checks before every commit with a git hook. The rule: a problem a tool can find should never need a human to point it out in review.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Consistent style | Prettier on save and prettier --check in CI | O(code) | O(code) |
| Find likely bugs | ESLint rules over the AST | O(code) | O(AST) |
| Ship to browsers | bundle: module graph → ordered, tree-shaken, minified files | O(modules + imports) | O(code) |

## Common mistakes

- Arguing about formatting in code review instead of letting a formatter decide.
- Turning lint rules off instead of fixing the code they flag.
- Assuming the bundler or `node file.ts` type-checks your code.
- Searching code with plain text matching where strings and comments make it wrong.
- Shipping production code without source maps, making errors impossible to trace.

## Exercises

### 1. A tiny lint rule

Write `lint(code)` that finds two problems in JavaScript source text and returns an array of `{ line, rule, message }` (lines start at 1, in the order they appear):

- `no-var`: the word `var` used as a keyword. Message: `Unexpected var, use let or const instead.`
- `eqeqeq`: `==` or `!=` that isn't part of `===` or `!==`. Message: `Expected '===' and instead saw '=='.` (or `'!=='` and `'!='`).

Ignore anything inside strings (`'…'`, `"…"` and template literals `` `…` ``, which may span lines; a backslash escapes the next character) and comments (`// …` and `/* … */`). `var` must be a whole word: `variable` and `$var` don't count.

Starter code:

```js
function lint(code) {
  // your code here
}

console.log(lint(`var total = 0;
if (qty == 0) total = 1;    // == here is fine: it's a comment
const s = "var x == 1";
if (a !== b && c != d) {}`));
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** find two patterns, but only in real code, not in strings or comments.
2. **Examples:** `variable` isn't `var`; `"var a == b"` is a string; `!a == b` still uses `==`.
3. **Brute force:** `line.includes("var ")`: flags comments, strings and `myvar = 1`.
4. **Pattern:** **a scanner**: one pass, character by character, with states for comments and strings, the same idea a real tokenizer uses.
5. **Plan:** loop → newline → comments → strings → operators → words → anything else.
6. **Code and test:** try each case from the checks in the editor.

</details>

<details>
<summary>💡 Hint 1</summary>

Walk through the code one character at a time with an index, counting `\n` to know the line. Don't use one regex over the whole text: it can't tell code from strings and comments.

</details>

<details>
<summary>💡 Hint 2</summary>

When you meet `//`, skip to the end of the line; `/*`, skip past `*/`; a quote character, skip to the matching quote, jumping over the character after any `\`. Keep counting new lines while skipping.

</details>

<details>
<summary>💡 Hint 3</summary>

Read a whole word at once (letters, digits, `_`, `$`) and compare it with `"var"`. For `==`/`!=`, look at the next character: a third `=` means `===`/`!==`, which is fine.

</details>

### 2. Bundle order

A bundler must put each module **after** the modules it imports. Write `bundleOrder(modules, entry)`, where `modules` maps each file to the files it imports (in import order). Return the files reachable from `entry`, each once, in an order where every file comes after all of its imports. Visit imports in the order they're listed, so the result is predictable. Files nothing reachable imports are left out (tree shaking), and import cycles must not loop forever.

Starter code:

```js
function bundleOrder(modules, entry) {
  // your code here
}

console.log(bundleOrder({
  "main.js": ["cart.js", "format.js"],
  "cart.js": ["format.js"],
  "format.js": [],
  "admin.js": ["format.js"],
}, "main.js"));   // [ 'format.js', 'cart.js', 'main.js' ]
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** reachable files only, dependencies before dependents, each once.
2. **Examples:** `cart.js` imports `format.js`, so `format.js` comes first; `admin.js` isn't reachable.
3. **Brute force:** repeatedly pick any file whose imports are all placed: works, but slower and harder with cycles.
4. **Pattern:** **depth-first search, adding each node after its children**: a topological order.
5. **Plan:** `seen` set and `order` array → `visit` marks, visits imports in order, then pushes → visit the entry.
6. **Code and test:** draw the graph of the shared-dependency case and follow the calls.

</details>

<details>
<summary>💡 Hint 1</summary>

Start from the lesson's `visit` function: it already finds the reachable files and stops on files it has seen.

</details>

<details>
<summary>💡 Hint 2</summary>

The difference is **when** you add a file to the result: after visiting all of its imports, not before. That's a post-order depth-first search.

</details>

<details>
<summary>💡 Hint 3</summary>

Mark a file as seen **before** visiting its imports, so a cycle (a imports b, b imports a) stops instead of recursing forever.

</details>

**In the sandbox:** exercises 75–76. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. A tiny lint rule</summary>

```js
function lint(code) {
  const problems = [];
  let line = 1;
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    const next = code[i + 1];
    if (ch === "\n") { line++; i++; continue; }
    if (ch === "/" && next === "/") {                                   // line comment
      while (i < code.length && code[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && next === "*") {                                   // block comment
      i += 2;
      while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) { if (code[i] === "\n") line++; i++; }
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {                       // string
      i++;
      while (i < code.length && code[i] !== ch) {
        if (code[i] === "\\") i++;
        else if (code[i] === "\n") line++;
        i++;
      }
      i++;
      continue;
    }
    if ((ch === "=" || ch === "!") && next === "=" ) {
      if (code[i + 2] === "=") { i += 3; continue; }                    // === or !==
      if (ch === "=" && /[<>=!]/.test(code[i - 1] ?? "")) { i += 2; continue; }
      const op = ch + "=";
      problems.push({ line, rule: "eqeqeq", message: `Expected '${op}=' and instead saw '${op}'.` });
      i += 2;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {                                        // a word
      let j = i;
      while (j < code.length && /[\w$]/.test(code[j])) j++;
      if (code.slice(i, j) === "var") problems.push({ line, rule: "no-var", message: "Unexpected var, use let or const instead." });
      i = j;
      continue;
    }
    i++;
  }
  return problems;
}

console.log(lint(`var total = 0;
if (qty == 0) total = 1;    // == here is fine: it's a comment
const s = "var x == 1";
if (a !== b && c != d) {}`));
```

**Line by line**

- One `while` loop moves `i` through the text; every branch advances `i`, so the loop always ends.
- Comments and strings are skipped as a whole, counting new lines inside them, so their contents are never examined.
- Inside a string, `\` skips the next character, so `\"` doesn't end a `"…"` string.
- For `=` or `!` followed by `=`: a third `=` means `===`/`!==` (skip all three); `<=`, `>=` and the end of `===` are excluded by the character before. Otherwise it's `==` or `!=`.
- Words are read whole, which is why `variable` and `$var` don't match.

**Trace:** `if (a == 2 || a != 3) var b;` → `if` word → `a` → `==` → eqeqeq → `2` → `||` → `a` → `!=` → eqeqeq → `3` → `var` → no-var → `b`.

**Common wrong approach:** `/\bvar\b/` on each line: `\b` treats `$` as a boundary, so `$var` matches, and strings and comments are still searched.

</details>

<details>
<summary>✅ 2. Bundle order</summary>

```js
function bundleOrder(modules, entry) {
  const order = [];
  const seen = new Set();
  function visit(file) {
    if (seen.has(file)) return;
    seen.add(file);
    for (const dep of modules[file] ?? []) visit(dep);
    order.push(file);
  }
  visit(entry);
  return order;
}

console.log(bundleOrder({
  "main.js": ["cart.js", "format.js"],
  "cart.js": ["format.js"],
  "format.js": [],
  "admin.js": ["format.js"],
}, "main.js"));
```

**Line by line**

- `seen` stops a file being visited twice: shared modules are included once, and cycles end.
- `visit` marks the file, visits each import (in listed order), and only then pushes the file, so everything it imports is already in `order`.
- Only files reached from `entry` are visited, which leaves unused modules out, as tree shaking does at the file level.
- `modules[file] ?? []` treats a file missing from the map as having no imports.

**Trace:** main → ui → util (push util) → push ui → api → util (seen) → http (push http) → push api → push main.

**Common wrong approach:** pushing the file before visiting its imports (pre-order): `main.js` comes first, so it would run before the modules it needs exist.

</details>

## Quick quiz

1. What's the difference between Prettier and ESLint?
   - A) Prettier only changes layout; ESLint reports likely bugs and bad patterns
   - B) They're the same tool
   - C) ESLint formats code; Prettier finds bugs

2. Which config file does ESLint 10 use?
   - A) eslint.config.js (flat config)
   - B) .eslintrc.json
   - C) package.json only

3. What is tree shaking?
   - A) Leaving code that nothing imports out of the bundle
   - B) Sorting imports alphabetically
   - C) Removing comments

4. Why do bundlers put a hash in file names like app.3f9a2c.js?
   - A) So browsers can cache files forever and still get new versions after a change
   - B) To hide the code from users
   - C) To make the files smaller

<details>
<summary>Quiz answers</summary>

1. **A) Prettier only changes layout; ESLint reports likely bugs and bad patterns**: Formatters fix style; linters find problems (some fixable with --fix).
2. **A) eslint.config.js (flat config)**: The old eslintrc format was removed in ESLint 10.
3. **A) Leaving code that nothing imports out of the bundle**: It works on the module graph built from imports.
4. **A) So browsers can cache files forever and still get new versions after a change**: The name changes whenever the content changes.

</details>

---
Previous: [Lesson 37](37-npm-and-packages.md) · Next: [Lesson 39: Testing your code](39-testing.md)
