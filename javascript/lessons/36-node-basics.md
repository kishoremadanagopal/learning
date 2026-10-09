# Lesson 36: Node.js: JavaScript outside the browser

**You'll learn:** what Node.js is (V8, the event loop and built-in modules), Deno and Bun, the LTS schedule and the change from Node.js 27, installing and version managers, node, the REPL, --watch and running TypeScript, ES modules and CommonJS, "type": "module", .mjs and .cjs, require of ES modules, node: built-in modules, process.argv, process.env and exitCode, .env files and --env-file, fs/promises, path.join, import.meta.dirname, streams, util.parseArgs.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#node-basics)**: run every example and check your exercise answers.

## Key terms

- **Node.js:** a program that runs JavaScript outside the browser, with access to files, the network and processes.
- **Runtime:** the environment that runs JavaScript: a browser, Node.js, Deno or Bun.
- **LTS (long-term support):** a Node.js version that gets fixes for 30 months; the one to use in production.
- **REPL:** an interactive prompt that runs each line of JavaScript you type (read, evaluate, print, loop).
- **CommonJS:** Node.js's original module system, with `require` and `module.exports`.
- **Built-in module:** a module that comes with Node.js, imported as `node:fs`, `node:path` and so on.
- **`process.argv`:** the command-line arguments: the node program, the script, then yours.
- **Environment variable:** a named setting given to a program by its environment, read with `process.env`.
- **`.env` file:** a local file of environment variables for development, never committed.

So far your code ran in a browser. **Node.js** runs the same JavaScript language on a computer or server, with no page and no `document`, but with access to files, the network and other programs. It's what runs most JavaScript tooling (every tool in this part), countless web servers and APIs, and scripts that automate everyday work.

## What Node.js is

Node.js is Google's **V8** JavaScript engine (the one in Chrome) plus an event loop (Lesson 21) and a set of **built-in modules** for things browsers don't allow: reading files, starting servers, running other programs. **Deno** and **Bun** are newer runtimes that run most Node.js code too.

| In the browser | In Node.js |
|---|---|
| `window`, `document`, the DOM | none of these |
| `globalThis` is `window` | `globalThis` is Node's global object |
| `fetch`, `URL`, timers, `console`, `structuredClone` | the same, built in |
| no file access (for safety) | `node:fs`, `node:path`, `node:http`, `node:child_process`… |
| `<script type="module">` | `.js` files, run with `node` |

## Versions

Until now, a new major version came out every April and October. Even-numbered versions become **LTS** (long-term support) in October and are supported for 30 more months; LTS is what you use in production. **Node.js 24** is the Active LTS, and **Node.js 26**, released in April 2026, becomes LTS in October 2026. From **Node.js 27** there's one major release a year (27 in April 2027, 28 in April 2028, and so on), after six months of alpha testing, and **every** release becomes LTS: the odd-numbered "current only" versions are gone.

Install the LTS from [nodejs.org](https://nodejs.org), or use a version manager such as **nvm** or **fnm** to switch between versions per project.

## Running code

```bash
node --version             # v26.x.x
node hello.js              # run a file
node                       # the REPL: type JavaScript, see results (Ctrl+D to leave)
node --watch server.js     # rerun automatically when you save a file
node report.ts             # TypeScript runs too: the types are stripped (Lesson 31)
```

## Modules: ESM and CommonJS

Node.js supports both module systems you'll meet:

```js
// ES modules (ESM): the standard, used by this course (Lesson 17)
import { readFile } from "node:fs/promises";
export function load() { /* … */ }

// CommonJS: Node's original system, still in many older packages
const { readFile } = require("node:fs/promises");
module.exports = { load };
```

A `.js` file is treated as ESM when the nearest `package.json` says `"type": "module"` (Lesson 37), and as CommonJS otherwise; `.mjs` and `.cjs` files are always ESM and CommonJS. Write new code as ESM. Current Node.js versions can even `require()` an ES module, which makes mixing the two much less painful than it used to be.

Built-in modules are imported with the `node:` prefix: `node:fs`, `node:path`, `node:os`, `node:http`, `node:crypto`, `node:util`, `node:test` (Lesson 39), `node:child_process`.

## The process: arguments and environment

The global `process` describes the running program:

```js
// node greet.js Ada --shout
console.log(process.argv);   // [ '/usr/local/bin/node', '/home/ada/greet.js', 'Ada', '--shout' ]
const args = process.argv.slice(2);              // your arguments start at index 2
console.log(process.env.HOME);                   // environment variables (strings or undefined)
process.exitCode = 1;                            // report failure to whoever ran the program
```

`process.argv` is just an array of strings. Here's the same logic on an array you can run in the sandbox:

```js
const argv = ["/usr/local/bin/node", "/home/ada/greet.js", "Ada", "--shout"];
const args = argv.slice(2);
const shout = args.includes("--shout");
const name = args.find((a) => !a.startsWith("--")) ?? "world";
const greeting = `Hello, ${name}!`;
console.log(shout ? greeting.toUpperCase() : greeting);
```

For real programs, the built-in `parseArgs` from `node:util` handles options properly, and the first exercise shows how such a parser works:

```js
import { parseArgs } from "node:util";
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { shout: { type: "boolean" }, times: { type: "string", short: "t" } },
});
```

**Environment variables** hold configuration that differs between machines, such as a database address or an API key. Keep them out of your code, and for local development put them in a `.env` file (never committed to git):

```bash
# .env
PORT=3000
SHOP_API_KEY="sk-test-123"
```

```bash
node --env-file=.env server.js     # Node.js loads the file into process.env
```

## Files

`node:fs/promises` reads and writes files with promises:

```js
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const configPath = join(import.meta.dirname, "config.json");   // the folder this file is in
const config = JSON.parse(await readFile(configPath, "utf8"));
config.lastRun = new Date().toISOString();
await mkdir(join(import.meta.dirname, "out"), { recursive: true });
await writeFile(join(import.meta.dirname, "out", "config.json"), JSON.stringify(config, null, 2));
```

- Use `path.join` instead of gluing strings with `/`: Windows uses `\`.
- `import.meta.dirname` is the folder of the current module, so paths work wherever the program is started from.
- For large files, read a **stream** line by line instead of loading the whole file into memory (`createReadStream` with `node:readline`, and `for await`).

A common pattern: settings from a file, merged over defaults. Here with the file's text inline:

```js
const defaults = { port: 3000, currency: "GBP", debug: false };
const fileText = '{ "port": 8080, "debug": true }';      // what readFile would return
const config = { ...defaults, ...JSON.parse(fileText) };
console.log(config);
```

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Read options | util.parseArgs or a small parser over process.argv.slice(2) | O(args) | O(args) |
| Configuration | defaults merged with a file and environment variables | O(keys) | O(keys) |
| Read a file | await readFile(path.join(import.meta.dirname, …), "utf8") | O(file size) | O(file size) |

## Common mistakes

- Using an odd-numbered or end-of-life Node.js version in production.
- Mixing `require` and `import` styles without knowing which module system a file uses.
- Building file paths by joining strings with `/` instead of `path.join`.
- Committing `.env` files or hard-coding secrets.
- Reading huge files into memory at once instead of streaming them.

## Exercises

### 1. Parse command-line arguments

Write `parseArgs(args)` for an array of command-line arguments (already without the first two entries of `process.argv`). Return `{ positionals, flags }`:

- `--name=value` → `flags.name = "value"` (the value may contain `=`);
- `--name` → `flags.name = true`, and `--no-name` → `flags.name = false`;
- `-abc` → `flags.a`, `flags.b` and `flags.c` are `true`;
- everything after a lone `--` is positional, even if it starts with `-`;
- anything else (including a lone `-`) is a positional, in order.

Starter code:

```js
function parseArgs(args) {
  // your code here
}

console.log(parseArgs(["build", "--out=dist", "--minify", "-vq", "--", "--weird-name"]));
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** classify each argument by its shape; one special marker changes the rules for the rest.
2. **Examples:** `--query=a=b` → `{ query: "a=b" }`; `-` alone is a positional (it often means "standard input").
3. **Brute force:** `arg.split("=")`: breaks values that contain `=`.
4. **Pattern:** **a loop with ordered cases**, most specific first.
5. **Plan:** `--` → rest positional; `--x=y`; `--no-x`; `--x`; `-abc`; otherwise positional.
6. **Code and test:** run the example, then try your own argument lists.

</details>

<details>
<summary>💡 Hint 1</summary>

Loop with an index (`for (let i = 0; …)`), because on `--` you need "everything after this position": `args.slice(i + 1)`, then `break`.

</details>

<details>
<summary>💡 Hint 2</summary>

For `--…`, look for the **first** `=` with `indexOf`: the name is before it and the value is everything after it (`slice(eq + 1)`), even if it contains more `=`.

</details>

<details>
<summary>💡 Hint 3</summary>

Test the cases in this order: `--`, then `--name=value`, then `--no-name`, then `--name`, then `-abc` (only if it's longer than one character), else positional.

</details>

### 2. Read a .env file

Write `parseEnv(text)` that turns the text of a `.env` file into an object:

- each line is `KEY=value`; spaces around the key and the value are ignored;
- blank lines and lines starting with `#` are skipped, and an `export ` before the key is allowed;
- a value in matching quotes (`"…"` or `'…'`) keeps everything inside them; in double quotes, `\n` becomes a new line;
- in an unquoted value, ` #` starts a comment, which is removed;
- the value may contain `=`; a later line with the same key wins; lines without `=` are skipped.

Starter code:

```js
function parseEnv(text) {
  // your code here
}

console.log(parseEnv(`# Shop settings
PORT=3000
export API_URL = https://shop.example/api   # the practice API
GREETING="Hello\\nworld"
`));
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a line-by-line format with a few rules for keys, quotes and comments.
2. **Examples:** `COLOR=#ff0000` keeps its `#` (no space before it); `"Hello # not a comment"` keeps everything.
3. **Brute force:** `line.split("=")`: breaks URLs with query strings.
4. **Pattern:** **parse each line with ordered rules**, quotes before comments.
5. **Plan:** skip → split at first `=` → key (strip export) → quoted? unwrap (and unescape) : strip comment → store.
6. **Code and test:** the checks include each rule and a few edge cases.

</details>

<details>
<summary>💡 Hint 1</summary>

Split into lines, `trim()` each, and `continue` past empty lines and lines starting with `#`. Then split at the **first** `=` with `indexOf`.

</details>

<details>
<summary>💡 Hint 2</summary>

Remove a leading `export ` from the key with `replace(/^export\s+/, "")`. Then check the value: does it start **and** end with the same quote (and is longer than one character)?

</details>

<details>
<summary>💡 Hint 3</summary>

Quoted: `slice(1, -1)`, plus `replaceAll("\\n", "\n")` for double quotes only. Unquoted: cut at `indexOf(" #")` and trim again.

</details>

**In the sandbox:** exercises 71–72. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Parse command-line arguments</summary>

```js
function parseArgs(args) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") {
      positionals.push(...args.slice(i + 1));
      break;
    }
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      else if (arg.startsWith("--no-")) flags[arg.slice(5)] = false;
      else flags[arg.slice(2)] = true;
    } else if (arg.startsWith("-") && arg.length > 1) {
      for (const letter of arg.slice(1)) flags[letter] = true;
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

console.log(parseArgs(["build", "--out=dist", "--minify", "-vq", "--", "--weird-name"]));
```

**Line by line**

- The `for` loop keeps the index so that `--` can take `args.slice(i + 1)` in one go and stop.
- `indexOf("=")` finds the first `=`; `slice(2, eq)` is the name without the dashes and `slice(eq + 1)` the whole value.
- `--no-` is checked after `=`, so `--no-cache=yes` (rare) keeps its value; plain `--no-color` sets `color: false`.
- `arg.length > 1` stops a lone `-` from being treated as an empty group of short flags.
- `for (const letter of arg.slice(1))` turns `-vq` into `v` and `q`.

**Trace:** `["a", "--", "--b", "-c"]` → `a` positional → `--` → push `--b`, `-c` → stop.

**Common wrong approach:** checking `arg.startsWith("-")` before `arg.startsWith("--")`: every long flag is then split into letters (`--out` becomes `-`, `o`, `u`, `t`).

</details>

<details>
<summary>✅ 2. Read a .env file</summary>

```js
function parseEnv(text) {
  const env = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).replace(/^export\s+/, "").trim();
    let value = line.slice(eq + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.length > 1 && value.endsWith(quote)) {
      value = value.slice(1, -1);
      if (quote === '"') value = value.replaceAll("\\n", "\n");
    } else {
      const hash = value.indexOf(" #");
      if (hash !== -1) value = value.slice(0, hash).trim();
    }
    env[key] = value;
  }
  return env;
}

console.log(parseEnv(`# Shop settings
PORT=3000
export API_URL = https://shop.example/api   # the practice API
GREETING="Hello\\nworld"
`));
```

**Line by line**

- `text.split("\n")` and `trim()` handle indentation and Windows line endings (`\r` is whitespace).
- `indexOf("=")` finds the first `=`, so values can contain more.
- `value.endsWith(quote) && value.length > 1` makes sure the quotes really match; `"unclosed` is kept as written.
- Only double-quoted values turn the two characters `\` `n` into a new line; single quotes keep text literally.
- Comments are only removed from unquoted values, and only when `#` follows a space, so colours and URLs with fragments survive.
- Assigning `env[key]` again for a repeated key means the last line wins.

**Trace:** `export API_URL = https://shop.example/api   # the practice API` → key `API_URL` → value `https://shop.example/api   # the practice API` → not quoted → cut at ` #` → trim → `https://shop.example/api`.

**Common wrong approach:** removing comments before handling quotes: `MSG="Hello # not a comment"` loses half its value.

</details>

## Quick quiz

1. Which Node.js versions should you use in production in 2026?
   - A) An LTS version, such as Node.js 24 (or 26 once it becomes LTS)
   - B) The newest odd-numbered version
   - C) Any version; they're all supported equally

2. How does Node.js decide that a .js file is an ES module?
   - A) The nearest package.json has "type": "module"
   - B) The file contains the word import
   - C) It always treats .js as CommonJS

3. What is process.argv[2] when you run node app.js report.csv?
   - A) "report.csv"
   - B) "app.js"
   - C) "node"

4. Where should an API key for local development go?
   - A) In a .env file that isn't committed, loaded into process.env
   - B) In a const at the top of the code
   - C) In package.json

<details>
<summary>Quiz answers</summary>

1. **A) An LTS version, such as Node.js 24 (or 26 once it becomes LTS)**: LTS versions get 30 months of fixes; from Node.js 27 every release becomes LTS.
2. **A) The nearest package.json has "type": "module"**: .mjs is always ESM and .cjs always CommonJS.
3. **A) "report.csv"**: argv[0] is the node program and argv[1] the script.
4. **A) In a .env file that isn't committed, loaded into process.env**: Configuration that differs per machine, and secrets, stay out of the code.

</details>

---
Previous: [Lesson 35](35-typing-outside-data.md) · Next: [Lesson 37: npm, packages and package.json](37-npm-and-packages.md)
