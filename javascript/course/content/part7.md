@@@ part
id: 7
title: Node.js and tooling
level: Intermediate
blurb: JavaScript outside the browser and the tools around it: running code with Node.js, modules, files and command-line arguments, npm and package.json, version ranges and supply-chain safety, formatters, linters and bundlers, writing tests with node:test, and building a small JSON API with web-standard Request and Response handlers.

@@@ lesson
id: node-basics
title: "Node.js: JavaScript outside the browser"
minutes: 24
summary: What Node.js is and what it's used for, versions and the LTS schedule (including the change from Node.js 27), running files and the REPL, --watch, ES modules and CommonJS, built-in node: modules, process.argv, process.env and .env files, reading and writing files with fs/promises, paths and import.meta.dirname, and parsing command-line options.
---
So far your code ran in a browser. **Node.js** runs the same JavaScript language on a computer or server, with no page and no `document`, but with access to files, the network and other programs. It's what runs most JavaScript tooling (every tool in this part), countless web servers and APIs, and scripts that automate everyday work.

### What Node.js is

Node.js is Google's **V8** JavaScript engine (the one in Chrome) plus an event loop (Lesson 21) and a set of **built-in modules** for things browsers don't allow: reading files, starting servers, running other programs. **Deno** and **Bun** are newer runtimes that run most Node.js code too.

| In the browser | In Node.js |
|---|---|
| `window`, `document`, the DOM | none of these |
| `globalThis` is `window` | `globalThis` is Node's global object |
| `fetch`, `URL`, timers, `console`, `structuredClone` | the same, built in |
| no file access (for safety) | `node:fs`, `node:path`, `node:http`, `node:child_process`… |
| `<script type="module">` | `.js` files, run with `node` |

### Versions

Until now, a new major version came out every April and October. Even-numbered versions become **LTS** (long-term support) in October and are supported for 30 more months; LTS is what you use in production. **Node.js 24** is the Active LTS, and **Node.js 26**, released in April 2026, becomes LTS in October 2026. From **Node.js 27** there's one major release a year (27 in April 2027, 28 in April 2028, and so on), after six months of alpha testing, and **every** release becomes LTS: the odd-numbered "current only" versions are gone.

Install the LTS from [nodejs.org](https://nodejs.org), or use a version manager such as **nvm** or **fnm** to switch between versions per project.

### Running code

```bash
node --version             # v26.x.x
node hello.js              # run a file
node                       # the REPL: type JavaScript, see results (Ctrl+D to leave)
node --watch server.js     # rerun automatically when you save a file
node report.ts             # TypeScript runs too: the types are stripped (Lesson 31)
```

### Modules: ESM and CommonJS

Node.js supports both module systems you'll meet:

```js-static
// ES modules (ESM): the standard, used by this course (Lesson 17)
import { readFile } from "node:fs/promises";
export function load() { /* … */ }

// CommonJS: Node's original system, still in many older packages
const { readFile } = require("node:fs/promises");
module.exports = { load };
```

A `.js` file is treated as ESM when the nearest `package.json` says `"type": "module"` (Lesson 37), and as CommonJS otherwise; `.mjs` and `.cjs` files are always ESM and CommonJS. Write new code as ESM. Current Node.js versions can even `require()` an ES module, which makes mixing the two much less painful than it used to be.

Built-in modules are imported with the `node:` prefix: `node:fs`, `node:path`, `node:os`, `node:http`, `node:crypto`, `node:util`, `node:test` (Lesson 39), `node:child_process`.

### The process: arguments and environment

The global `process` describes the running program:

```js-static
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

```js-static
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

### Files

`node:fs/promises` reads and writes files with promises:

```js-static
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

:::exercise Parse command-line arguments
Write `parseArgs(args)` for an array of command-line arguments (already without the first two entries of `process.argv`). Return `{ positionals, flags }`:

- `--name=value` → `flags.name = "value"` (the value may contain `=`);
- `--name` → `flags.name = true`, and `--no-name` → `flags.name = false`;
- `-abc` → `flags.a`, `flags.b` and `flags.c` are `true`;
- everything after a lone `--` is positional, even if it starts with `-`;
- anything else (including a lone `-`) is a positional, in order.
```js starter
function parseArgs(args) {
  // your code here
}

console.log(parseArgs(["build", "--out=dist", "--minify", "-vq", "--", "--weird-name"]));
```
```js check
test("parseArgs", [
  [[[]], { positionals: [], flags: {} }, "no arguments"],
  [[["hello.txt", "world.txt"]], { positionals: ["hello.txt", "world.txt"], flags: {} }, "two positionals"],
  [[["--minify"]], { positionals: [], flags: { minify: true } }, "a boolean flag"],
  [[["--out=dist"]], { positionals: [], flags: { out: "dist" } }, "a flag with a value"],
  [[["--query=a=b"]], { positionals: [], flags: { query: "a=b" } }, "a value containing ="],
  [[["--out="]], { positionals: [], flags: { out: "" } }, "an empty value"],
  [[["--no-color"]], { positionals: [], flags: { color: false } }, "--no-color"],
  [[["-vq"]], { positionals: [], flags: { v: true, q: true } }, "combined short flags"],
  [[["-"]], { positionals: ["-"], flags: {} }, "a lone -"],
  [[["a", "--", "--b", "-c"]], { positionals: ["a", "--b", "-c"], flags: {} }, "arguments after --"],
  [[["build", "--out=dist", "--minify", "-vq", "--", "--weird-name"]],
   { positionals: ["build", "--weird-name"], flags: { out: "dist", minify: true, v: true, q: true } }, "everything together"],
]);
```
```js solution
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
hint: Loop with an index (`for (let i = 0; …)`), because on `--` you need "everything after this position": `args.slice(i + 1)`, then `break`.
hint: For `--…`, look for the **first** `=` with `indexOf`: the name is before it and the value is everything after it (`slice(eq + 1)`), even if it contains more `=`.
hint: Test the cases in this order: `--`, then `--name=value`, then `--no-name`, then `--name`, then `-abc` (only if it's longer than one character), else positional.
approach:
1. **Understand:** classify each argument by its shape; one special marker changes the rules for the rest.
2. **Examples:** `--query=a=b` → `{ query: "a=b" }`; `-` alone is a positional (it often means "standard input").
3. **Brute force:** `arg.split("=")`: breaks values that contain `=`.
4. **Pattern:** **a loop with ordered cases**, most specific first.
5. **Plan:** `--` → rest positional; `--x=y`; `--no-x`; `--x`; `-abc`; otherwise positional.
6. **Code and test:** run the example, then try your own argument lists.
walkthrough:
**Line by line**

- The `for` loop keeps the index so that `--` can take `args.slice(i + 1)` in one go and stop.
- `indexOf("=")` finds the first `=`; `slice(2, eq)` is the name without the dashes and `slice(eq + 1)` the whole value.
- `--no-` is checked after `=`, so `--no-cache=yes` (rare) keeps its value; plain `--no-color` sets `color: false`.
- `arg.length > 1` stops a lone `-` from being treated as an empty group of short flags.
- `for (const letter of arg.slice(1))` turns `-vq` into `v` and `q`.

**Trace:** `["a", "--", "--b", "-c"]` → `a` positional → `--` → push `--b`, `-c` → stop.

**Common wrong approach:** checking `arg.startsWith("-")` before `arg.startsWith("--")`: every long flag is then split into letters (`--out` becomes `-`, `o`, `u`, `t`).
:::

:::exercise Read a .env file
Write `parseEnv(text)` that turns the text of a `.env` file into an object:

- each line is `KEY=value`; spaces around the key and the value are ignored;
- blank lines and lines starting with `#` are skipped, and an `export ` before the key is allowed;
- a value in matching quotes (`"…"` or `'…'`) keeps everything inside them; in double quotes, `\n` becomes a new line;
- in an unquoted value, ` #` starts a comment, which is removed;
- the value may contain `=`; a later line with the same key wins; lines without `=` are skipped.
```js starter
function parseEnv(text) {
  // your code here
}

console.log(parseEnv(`# Shop settings
PORT=3000
export API_URL = https://shop.example/api   # the practice API
GREETING="Hello\\nworld"
`));
```
```js check
test("parseEnv", [
  [[""], {}, "an empty file"],
  [["PORT=3000"], { PORT: "3000" }, "one line"],
  [["# comment\n\nPORT=3000\n"], { PORT: "3000" }, "comments and blank lines"],
  [["  NAME  =  Ada  "], { NAME: "Ada" }, "spaces around key and value"],
  [["export MODE=test"], { MODE: "test" }, "an export prefix"],
  [["URL=https://x.example/?a=1&b=2"], { URL: "https://x.example/?a=1&b=2" }, "a value containing ="],
  [['MSG="Hello # not a comment"'], { MSG: "Hello # not a comment" }, "# inside double quotes"],
  [["MSG='single  spaced '"], { MSG: "single  spaced " }, "single quotes keep spaces"],
  [['TWO="line one\\nline two"'], { TWO: "line one\nline two" }, "\\n inside double quotes"],
  [["RAW='a\\nb'"], { RAW: "a\\nb" }, "\\n inside single quotes stays as written"],
  [["PORT=3000 # default"], { PORT: "3000" }, "a comment after an unquoted value"],
  [["COLOR=#ff0000"], { COLOR: "#ff0000" }, "# without a space before it"],
  [["EMPTY="], { EMPTY: "" }, "an empty value"],
  [["A=1\nA=2"], { A: "2" }, "a repeated key"],
  [["just some text\nB=2"], { B: "2" }, "a line without ="],
  [['Q="unclosed'], { Q: '"unclosed' }, "an unmatched quote"],
]);
```
```js solution
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
hint: Split into lines, `trim()` each, and `continue` past empty lines and lines starting with `#`. Then split at the **first** `=` with `indexOf`.
hint: Remove a leading `export ` from the key with `replace(/^export\s+/, "")`. Then check the value: does it start **and** end with the same quote (and is longer than one character)?
hint: Quoted: `slice(1, -1)`, plus `replaceAll("\\n", "\n")` for double quotes only. Unquoted: cut at `indexOf(" #")` and trim again.
approach:
1. **Understand:** a line-by-line format with a few rules for keys, quotes and comments.
2. **Examples:** `COLOR=#ff0000` keeps its `#` (no space before it); `"Hello # not a comment"` keeps everything.
3. **Brute force:** `line.split("=")`: breaks URLs with query strings.
4. **Pattern:** **parse each line with ordered rules**, quotes before comments.
5. **Plan:** skip → split at first `=` → key (strip export) → quoted? unwrap (and unescape) : strip comment → store.
6. **Code and test:** the checks include each rule and a few edge cases.
walkthrough:
**Line by line**

- `text.split("\n")` and `trim()` handle indentation and Windows line endings (`\r` is whitespace).
- `indexOf("=")` finds the first `=`, so values can contain more.
- `value.endsWith(quote) && value.length > 1` makes sure the quotes really match; `"unclosed` is kept as written.
- Only double-quoted values turn the two characters `\` `n` into a new line; single quotes keep text literally.
- Comments are only removed from unquoted values, and only when `#` follows a space, so colours and URLs with fragments survive.
- Assigning `env[key]` again for a repeated key means the last line wins.

**Trace:** `export API_URL = https://shop.example/api   # the practice API` → key `API_URL` → value `https://shop.example/api   # the practice API` → not quoted → cut at ` #` → trim → `https://shop.example/api`.

**Common wrong approach:** removing comments before handling quotes: `MSG="Hello # not a comment"` loses half its value.
:::

:::quiz
? Which Node.js versions should you use in production in 2026?
+ An LTS version, such as Node.js 24 (or 26 once it becomes LTS)
- The newest odd-numbered version
- Any version; they're all supported equally
= LTS versions get 30 months of fixes; from Node.js 27 every release becomes LTS.
? How does Node.js decide that a .js file is an ES module?
+ The nearest package.json has "type": "module"
- The file contains the word import
- It always treats .js as CommonJS
= .mjs is always ESM and .cjs always CommonJS.
? What is process.argv[2] when you run node app.js report.csv?
+ "report.csv"
- "app.js"
- "node"
= argv[0] is the node program and argv[1] the script.
? Where should an API key for local development go?
+ In a .env file that isn't committed, loaded into process.env
- In a const at the top of the code
- In package.json
= Configuration that differs per machine, and secrets, stay out of the code.
:::

@@@ lesson
id: npm-and-packages
title: npm, packages and package.json
minutes: 24
summary: Packages and the npm registry, package.json and its fields (type, scripts, dependencies, devDependencies, engines, exports, bin), installing and node_modules, package-lock.json and npm ci, npx, semantic versioning and ranges (caret, tilde, 0.x versions, pre-releases), keeping dependencies up to date, npm, pnpm, Yarn and Bun, and supply-chain safety after the 2025 npm worm attacks.
---
A **package** is a folder of code with a `package.json` describing it. The **npm registry** holds millions of them, and the `npm` command (installed with Node.js) downloads them and runs your project's scripts. Almost every JavaScript project, front end or back end, is an npm package.

### package.json

`npm init -y` creates one. A typical small project:

```json
{
  "name": "bike-shop-api",
  "version": "1.4.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch --env-file=.env src/server.js",
    "start": "node src/server.js",
    "test": "node --test",
    "lint": "eslint .",
    "format": "prettier --write ."
  },
  "dependencies": {
    "hono": "^4.10.0",
    "zod": "^4.1.0"
  },
  "devDependencies": {
    "eslint": "^10.1.0",
    "prettier": "^3.6.0"
  },
  "engines": { "node": ">=24" }
}
```

| Field | Meaning |
|---|---|
| `name`, `version` | the package's identity; required to publish |
| `private: true` | refuse to publish it by accident (for apps) |
| `type: "module"` | `.js` files are ES modules (Lesson 36) |
| `scripts` | commands: `npm run dev`, `npm run lint`; `npm test` and `npm start` work without `run` |
| `dependencies` | packages the code needs to run |
| `devDependencies` | packages only needed while developing: linters, test tools, TypeScript |
| `engines` | which Node.js versions the project supports |
| `exports` (libraries) | which files other packages may import, such as `"exports": "./dist/index.js"` |
| `bin` (CLIs) | commands the package installs, like `"bin": { "shop": "./cli.js" }` |

`node --run dev` runs a script too, faster than `npm run` because it skips npm's startup.

### Installing

```bash
npm install zod                 # add a dependency (and save it in package.json)
npm install -D vitest           # add a dev dependency
npm install                     # install everything package.json lists
npm ci                          # clean install exactly what the lockfile says (use in CI)
npm uninstall zod
npx eslint .                    # run a tool from node_modules (or download it once)
```

Packages go into `node_modules/`, which can be huge: dependencies have dependencies of their own. Never commit `node_modules`; add it to `.gitignore`.

**`package-lock.json`** records the exact version of every installed package, including indirect ones. **Commit it**: it makes every machine, and your production server, install the same code. `npm ci` installs exactly what it says and fails if it doesn't match `package.json`.

### Semantic versioning

Versions follow **semver**: `MAJOR.MINOR.PATCH`.

| Change | Bump | Example |
|---|---|---|
| breaking change | MAJOR | 3.6.2 → 4.0.0 |
| new feature, compatible | MINOR | 3.6.2 → 3.7.0 |
| bug fix, compatible | PATCH | 3.6.2 → 3.6.3 |
| pre-release | suffix | 4.0.0-beta.2, which comes **before** 4.0.0 |

`package.json` lists **ranges**, so you get fixes without editing it:

| Range | Means | Allows |
|---|---|---|
| `4.1.0` | exactly | 4.1.0 only |
| `^4.1.0` | compatible (the default `npm install` writes) | ≥ 4.1.0 and < 5.0.0 |
| `~4.1.0` | patch updates | ≥ 4.1.0 and < 4.2.0 |
| `^0.3.2` | for 0.x, the minor number acts as major | ≥ 0.3.2 and < 0.4.0 |
| `*` | anything | any version |

Below 1.0.0 anything may change at any time, which is why `^` is stricter there. Semver is a promise the package author makes, not a guarantee: tests (Lesson 39) catch the cases where a "compatible" update breaks you.

```js
const [major, minor, patch] = "4.10.2".split(".").map(Number);
console.log({ major, minor, patch });
console.log("4.10.2" > "4.9.0");                     // false! strings compare character by character
console.log(minor > 9);                              // compare the numbers instead
```

### Keeping up to date

```bash
npm outdated        # what has newer versions
npm update          # update within the ranges in package.json
npm audit           # known vulnerabilities in your dependency tree
```

Many teams let a bot (Dependabot or Renovate) open a pull request for each update, so tests run before anything is merged.

### npm, pnpm, Yarn and Bun

All four install from the same registry and read the same `package.json`. **pnpm** saves disk space by storing each version once and linking it into projects, and is strict about undeclared dependencies; **Yarn** is another popular alternative; **Bun** is a runtime with a very fast built-in installer. A project uses one, recorded by its lockfile (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock` or `bun.lock`).

### Supply-chain safety

Installing a package runs other people's code, sometimes at install time: packages can define **install scripts**. In September 2025 a self-replicating worm called **Shai-Hulud** spread through npm this way: stolen maintainer accounts published poisoned versions whose install scripts stole tokens and used them to infect more packages; over 500 packages were taken down. npm responded with stricter publishing rules, such as two-factor authentication and **trusted publishing**, where packages are published from CI without long-lived tokens.

Habits that protect you:

- Add dependencies sparingly; a few lines of your own code can beat a package you must trust forever.
- Commit the lockfile and use `npm ci`, so new versions arrive only when you choose.
- Check a package before adding it: maintainers, downloads, recent activity, and whether its name is a lookalike of a popular one (**typosquatting**).
- Turn off install scripts where you can (`npm install --ignore-scripts`; pnpm 10 doesn't run dependencies' install scripts unless you allow them).
- Run `npm audit` and update promptly when a fix is released.

:::exercise Compare versions
Write `compareVersions(a, b)` for semver versions such as `"4.10.2"` or `"4.0.0-beta.2"`. Return `-1` if `a` comes before `b`, `1` if after, and `0` if they're equal.

- Compare major, then minor, then patch, **as numbers**.
- A pre-release (`-…`) comes **before** the same version without one.
- Two pre-releases are compared part by part (split at `.`): numbers as numbers, text alphabetically, a number before text, and if all shared parts are equal, the one with fewer parts comes first.
```js starter
function compareVersions(a, b) {
  // your code here
}

console.log(compareVersions("4.10.2", "4.9.0"));        // 1
console.log(compareVersions("4.0.0-beta.2", "4.0.0"));   // -1
```
```js check
test("compareVersions", [
  [["1.2.3", "1.2.3"], 0, "equal versions"],
  [["1.2.3", "1.2.4"], -1, "a smaller patch"],
  [["1.10.0", "1.9.9"], 1, "minor 10 vs 9 (as numbers)"],
  [["2.0.0", "10.0.0"], -1, "major 2 vs 10"],
  [["0.9.0", "1.0.0"], -1, "0.9.0 before 1.0.0"],
  [["4.0.0-beta.2", "4.0.0"], -1, "a pre-release before its release"],
  [["4.0.0", "4.0.0-rc.1"], 1, "a release after its pre-release"],
  [["4.0.0-rc.1", "3.9.9"], 1, "a pre-release of 4 after 3.9.9"],
  [["1.0.0-alpha", "1.0.0-beta"], -1, "alpha before beta"],
  [["1.0.0-beta.2", "1.0.0-beta.11"], -1, "beta.2 before beta.11 (numbers)"],
  [["1.0.0-alpha", "1.0.0-alpha.1"], -1, "fewer parts first"],
  [["1.0.0-alpha.1", "1.0.0-alpha.beta"], -1, "a number before text"],
  [["1.0.0-rc.1", "1.0.0-rc.1"], 0, "equal pre-releases"],
]);
```
```js solution
function compareVersions(a, b) {
  const parse = (v) => {
    const [core, pre] = v.split("-", 2);
    return { nums: core.split(".").map(Number), pre: pre === undefined ? null : v.slice(core.length + 1).split(".") };
  };
  const sign = (n) => (n < 0 ? -1 : n > 0 ? 1 : 0);
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) {
    if (x.nums[i] !== y.nums[i]) return sign(x.nums[i] - y.nums[i]);
  }
  if (x.pre === null || y.pre === null) return x.pre === y.pre ? 0 : x.pre === null ? 1 : -1;
  for (let i = 0; i < Math.min(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i];
    if (p === q) continue;
    const pn = /^\d+$/.test(p), qn = /^\d+$/.test(q);
    if (pn && qn) return sign(Number(p) - Number(q));
    if (pn !== qn) return pn ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return sign(x.pre.length - y.pre.length);
}

console.log(compareVersions("4.10.2", "4.9.0"));
console.log(compareVersions("4.0.0-beta.2", "4.0.0"));
```
hint: Split each version at the first `-` into the core (`"4.0.0"`) and the pre-release (`"beta.2"`, or none). Compare the three core numbers with `Number`, in order.
hint: If the cores are equal: no pre-release on either → 0; only one has a pre-release → that one is smaller.
hint: For two pre-releases, compare parts left to right: both numeric → compare numbers; one numeric → it's smaller; both text → compare strings. If every shared part is equal, the shorter list is smaller.
approach:
1. **Understand:** semver precedence: numbers, then the pre-release rule.
2. **Examples:** `1.10.0` > `1.9.9` (strings would say otherwise); `beta.2` < `beta.11`.
3. **Brute force:** comparing the whole strings: wrong as soon as a number has two digits.
4. **Pattern:** **compare field by field, stop at the first difference**.
5. **Plan:** parse → compare 3 numbers → pre-release presence → pre-release parts → length.
6. **Code and test:** the checks cover each rule.
walkthrough:
**Line by line**

- `parse` splits off the pre-release after the first `-` (pre-releases may contain more `-`, so the slice keeps everything after it) and turns the core into numbers.
- The first loop returns at the first differing number; `sign` turns the difference into -1 or 1.
- With equal cores, a version without a pre-release is the bigger one: 4.0.0 comes after 4.0.0-rc.1.
- Pre-release parts: `/^\d+$/` tells numbers from text. Numbers compare numerically, a number is lower than text, and text compares alphabetically.
- If all shared parts match, more parts means later: `alpha` < `alpha.1`.

**Trace:** `1.0.0-beta.2` vs `1.0.0-beta.11` → cores equal → `beta` = `beta` → `2` vs `11` numerically → -1.

**Common wrong approach:** `a.localeCompare(b)` or `a < b` on the whole strings: `"1.10.0" < "1.9.9"` is true, because "1" sorts before "9".
:::

:::exercise Does a version satisfy a range?
Write `satisfies(version, range)` for plain versions (`"MAJOR.MINOR.PATCH"`, no pre-releases) and these ranges:

- `"*"`: any version;
- `"1.2.3"`: exactly that version;
- `"~1.2.3"`: at least 1.2.3, below 1.3.0;
- `"^1.2.3"`: at least 1.2.3, below the next major (2.0.0). For `^0.x`: below the next minor (`^0.3.2` → below 0.4.0), and for `^0.0.x` only that exact version;
- `">=1.2.3"`: that version or later.
```js starter
function satisfies(version, range) {
  // your code here
}

console.log(satisfies("4.9.1", "^4.1.0"), satisfies("5.0.0", "^4.1.0"));   // true false
```
```js check
test("satisfies", [
  [["9.9.9", "*"], true, "*"],
  [["1.2.3", "1.2.3"], true, "an exact match"],
  [["1.2.4", "1.2.3"], false, "an exact range, another patch"],
  [["1.2.9", "~1.2.3"], true, "~ allows newer patches"],
  [["1.3.0", "~1.2.3"], false, "~ stops at the next minor"],
  [["1.2.2", "~1.2.3"], false, "~ below the minimum"],
  [["1.9.0", "^1.2.3"], true, "^ allows newer minors"],
  [["1.10.0", "^1.9.0"], true, "^1.9.0 allows 1.10.0 (numbers, not strings)"],
  [["2.0.0", "^1.2.3"], false, "^ stops at the next major"],
  [["1.2.0", "^1.2.3"], false, "^ below the minimum"],
  [["0.3.9", "^0.3.2"], true, "^0.3.2 allows 0.3.9"],
  [["0.4.0", "^0.3.2"], false, "^0.3.2 stops at 0.4.0"],
  [["0.0.3", "^0.0.3"], true, "^0.0.3 allows 0.0.3"],
  [["0.0.4", "^0.0.3"], false, "^0.0.3 allows nothing newer"],
  [["10.0.0", ">=9.1.0"], true, ">= a newer major"],
  [["9.0.9", ">=9.1.0"], false, ">= an older version"],
]);
```
```js solution
function satisfies(version, range) {
  if (range === "*") return true;
  const parse = (v) => v.split(".").map(Number);
  const cmp = (a, b) => {
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
    return 0;
  };
  const v = parse(version);
  if (range.startsWith(">=")) return cmp(v, parse(range.slice(2))) >= 0;
  const op = range[0] === "^" || range[0] === "~" ? range[0] : "";
  const min = parse(op ? range.slice(1) : range);
  if (!op) return cmp(v, min) === 0;
  let below;
  if (op === "~") below = [min[0], min[1] + 1, 0];
  else if (min[0] > 0) below = [min[0] + 1, 0, 0];
  else if (min[1] > 0) below = [0, min[1] + 1, 0];
  else below = [0, 0, min[2] + 1];
  return cmp(v, min) >= 0 && cmp(v, below) < 0;
}

console.log(satisfies("4.9.1", "^4.1.0"), satisfies("5.0.0", "^4.1.0"));
```
hint: Turn versions into arrays of three numbers, and write a small `cmp(a, b)` returning -1, 0 or 1 (like the previous exercise, without pre-releases).
hint: Every range except `>=` is "at least the minimum, and below an upper limit". Work out the upper limit: `~1.2.3` → `[1, 3, 0]`; `^1.2.3` → `[2, 0, 0]`; `^0.3.2` → `[0, 4, 0]`; `^0.0.3` → `[0, 0, 4]`.
hint: Then `return cmp(v, min) >= 0 && cmp(v, below) < 0;`. Handle `*`, exact versions and `>=` before that.
approach:
1. **Understand:** each range is a lower bound and (except `>=`) an exclusive upper bound.
2. **Examples:** `^1.9.0` allows 1.10.0; `^0.3.2` doesn't allow 0.4.0.
3. **Brute force:** string comparisons or regexes on the text: `"1.10.0" < "1.9.0"` breaks them.
4. **Pattern:** **turn each rule into numeric bounds**.
5. **Plan:** `*` → exact → `>=` → read operator and minimum → compute the upper bound → compare.
6. **Code and test:** check each row of the range table.
walkthrough:
**Line by line**

- `cmp` compares the three numbers in order, as in `compareVersions`.
- `>=` only has a lower bound; an exact version only matches itself.
- For `~`, the upper bound is the next minor. For `^`, it's the next number after the first non-zero part: major, or minor for `0.x`, or patch for `0.0.x`.
- The result is `min ≤ v < below`.

**Trace:** `satisfies("0.4.0", "^0.3.2")` → min [0,3,2] → major is 0, minor 3 > 0 → below [0,4,0] → 0.4.0 isn't below → false.

**Common wrong approach:** treating `^` as "same major" for every version: `^0.3.2` would then accept 0.9.0, which may be a breaking change for a pre-1.0 package.
:::

:::quiz
? Which file should you commit so every install gets the same versions?
+ package-lock.json
- node_modules
- .npmrc
= The lockfile records exact versions; npm ci installs exactly them.
? What does "^4.1.0" allow?
+ 4.1.0 up to, but not including, 5.0.0
- Only 4.1.x
- Any version at least 4.1.0
= ^ allows compatible (non-major) updates.
? Where does a test runner like vitest belong?
+ devDependencies
- dependencies
- engines
= It's only needed while developing, not to run the app.
? How did the 2025 Shai-Hulud worm spread between npm packages?
+ Install scripts in poisoned versions stole maintainers' tokens and published more poisoned packages
- Through a bug in Node.js
- By editing package-lock.json files on GitHub
= Install scripts run code on install; limit them and pin versions with a lockfile.
:::

@@@ lesson
id: formatting-linting-bundling
title: Formatting, linting and bundling
minutes: 24
summary: Why projects use tools to check code, formatting with Prettier, linting with ESLint 10's flat config and typescript-eslint, how linters work with syntax trees, faster alternatives (Biome, Oxlint), type-checking in CI with tsc --noEmit, what bundlers do (module graphs, tree shaking, minification, source maps, hashed file names), Vite 8 with Rolldown, and running the checks on every commit.
---
Professional projects let tools do the boring checking: a **formatter** makes the layout consistent, a **linter** finds suspicious code, the **type checker** finds type errors, and a **bundler** turns your modules into files a browser loads quickly. Set up once, they run in your editor on every save and in CI on every push (the next course covers CI).

### Formatting: Prettier

**Prettier** rewrites your code with a consistent layout: indentation, quotes, semicolons, line breaks. Its point is to end style debates: the team accepts its output and nobody argues about it in code reviews.

```bash
npm install -D prettier
npx prettier --write .        # format every file
npx prettier --check .        # in CI: fail if anything isn't formatted
```

A small `.prettierrc` can change the few options it has (such as `"printWidth": 100`). Most editors format on save.

### Linting: ESLint

A linter reports code that is valid but probably wrong or confusing: unused variables, `==` instead of `===`, a missing `await`, unreachable code. **ESLint** is the standard. ESLint 10 (2026) only supports the **flat config** file, `eslint.config.js`:

```js-static
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

### How a linter sees your code

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

### Type-checking

`npx tsc --noEmit` type-checks the whole project without writing files (Lesson 31). Bundlers and `node file.ts` skip type-checking for speed, so this command is how type errors are caught: in your editor while you type, and in CI before code is merged.

### Bundling

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

### Make the checks automatic

```json
{
  "scripts": {
    "check": "prettier --check . && eslint . && tsc --noEmit && node --test"
  }
}
```

Run it in CI on every pull request, and editors do the same checks as you type. Some teams also run the fast checks before every commit with a git hook. The rule: a problem a tool can find should never need a human to point it out in review.

:::exercise A tiny lint rule
Write `lint(code)` that finds two problems in JavaScript source text and returns an array of `{ line, rule, message }` (lines start at 1, in the order they appear):

- `no-var`: the word `var` used as a keyword. Message: `Unexpected var, use let or const instead.`
- `eqeqeq`: `==` or `!=` that isn't part of `===` or `!==`. Message: `Expected '===' and instead saw '=='.` (or `'!=='` and `'!='`).

Ignore anything inside strings (`'…'`, `"…"` and template literals `` `…` ``, which may span lines; a backslash escapes the next character) and comments (`// …` and `/* … */`). `var` must be a whole word: `variable` and `$var` don't count.
```js starter
function lint(code) {
  // your code here
}

console.log(lint(`var total = 0;
if (qty == 0) total = 1;    // == here is fine: it's a comment
const s = "var x == 1";
if (a !== b && c != d) {}`));
```
```js check
const v = (line) => ({ line, rule: "no-var", message: "Unexpected var, use let or const instead." });
const eq = (line) => ({ line, rule: "eqeqeq", message: "Expected '===' and instead saw '=='." });
const ne = (line) => ({ line, rule: "eqeqeq", message: "Expected '!==' and instead saw '!='." });
test("lint", [
  [["let a = 1;"], [], "clean code"],
  [["var a = 1;"], [v(1)], "var"],
  [["if (a == b) {}"], [eq(1)], "=="],
  [["if (a != b) {}"], [ne(1)], "!="],
  [["if (a === b && c !== d) {}"], [], "=== and !=="],
  [["let variable = 1;\nlet $var = 2;\nobj.vars = 3;"], [], "words that contain var"],
  [["// var a == b\nlet x = 1; /* var\n == */"], [], "comments"],
  [["const s = 'var a == b';\nconst t = \"it's var != it\";"], [], "strings"],
  [["const s = `line one\nvar == ${'x'}`;\nvar y;"], [v(3)], "a template literal over two lines"],
  [["const s = \"say \\\"var\\\" == ok\";"], [], "escaped quotes inside a string"],
  [["var a = 1;\nif (a == 2 || a != 3) var b;"], [v(1), eq(2), ne(2), v(2)], "several problems"],
  [["x = a<=b; y = a>=b; z = !a == b;"], [eq(1)], "<= >= and !a == b"],
]);
```
```js solution
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
hint: Walk through the code one character at a time with an index, counting `\n` to know the line. Don't use one regex over the whole text: it can't tell code from strings and comments.
hint: When you meet `//`, skip to the end of the line; `/*`, skip past `*/`; a quote character, skip to the matching quote, jumping over the character after any `\`. Keep counting new lines while skipping.
hint: Read a whole word at once (letters, digits, `_`, `$`) and compare it with `"var"`. For `==`/`!=`, look at the next character: a third `=` means `===`/`!==`, which is fine.
approach:
1. **Understand:** find two patterns, but only in real code, not in strings or comments.
2. **Examples:** `variable` isn't `var`; `"var a == b"` is a string; `!a == b` still uses `==`.
3. **Brute force:** `line.includes("var ")`: flags comments, strings and `myvar = 1`.
4. **Pattern:** **a scanner**: one pass, character by character, with states for comments and strings, the same idea a real tokenizer uses.
5. **Plan:** loop → newline → comments → strings → operators → words → anything else.
6. **Code and test:** try each case from the checks in the editor.
walkthrough:
**Line by line**

- One `while` loop moves `i` through the text; every branch advances `i`, so the loop always ends.
- Comments and strings are skipped as a whole, counting new lines inside them, so their contents are never examined.
- Inside a string, `\` skips the next character, so `\"` doesn't end a `"…"` string.
- For `=` or `!` followed by `=`: a third `=` means `===`/`!==` (skip all three); `<=`, `>=` and the end of `===` are excluded by the character before. Otherwise it's `==` or `!=`.
- Words are read whole, which is why `variable` and `$var` don't match.

**Trace:** `if (a == 2 || a != 3) var b;` → `if` word → `a` → `==` → eqeqeq → `2` → `||` → `a` → `!=` → eqeqeq → `3` → `var` → no-var → `b`.

**Common wrong approach:** `/\bvar\b/` on each line: `\b` treats `$` as a boundary, so `$var` matches, and strings and comments are still searched.
:::

:::exercise Bundle order
A bundler must put each module **after** the modules it imports. Write `bundleOrder(modules, entry)`, where `modules` maps each file to the files it imports (in import order). Return the files reachable from `entry`, each once, in an order where every file comes after all of its imports. Visit imports in the order they're listed, so the result is predictable. Files nothing reachable imports are left out (tree shaking), and import cycles must not loop forever.
```js starter
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
```js check
test("bundleOrder", [
  [[{ "a.js": [] }, "a.js"], ["a.js"], "one file"],
  [[{ "main.js": ["cart.js", "format.js"], "cart.js": ["format.js"], "format.js": [], "admin.js": ["format.js"] }, "main.js"],
   ["format.js", "cart.js", "main.js"], "the lesson's example"],
  [[{ "main.js": ["b.js", "a.js"], "a.js": [], "b.js": [] }, "main.js"], ["b.js", "a.js", "main.js"], "import order is kept"],
  [[{ "main.js": ["ui.js", "api.js"], "ui.js": ["util.js"], "api.js": ["util.js", "http.js"], "util.js": [], "http.js": [] }, "main.js"],
   ["util.js", "ui.js", "http.js", "api.js", "main.js"], "a shared dependency (included once)"],
  [[{ "main.js": ["a.js"], "a.js": ["b.js"], "b.js": ["a.js"] }, "main.js"], ["b.js", "a.js", "main.js"], "an import cycle"],
  [[{ "main.js": [], "unused.js": ["main.js"] }, "main.js"], ["main.js"], "a module importing the entry (left out)"],
]);
```
```js solution
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
hint: Start from the lesson's `visit` function: it already finds the reachable files and stops on files it has seen.
hint: The difference is **when** you add a file to the result: after visiting all of its imports, not before. That's a post-order depth-first search.
hint: Mark a file as seen **before** visiting its imports, so a cycle (a imports b, b imports a) stops instead of recursing forever.
approach:
1. **Understand:** reachable files only, dependencies before dependents, each once.
2. **Examples:** `cart.js` imports `format.js`, so `format.js` comes first; `admin.js` isn't reachable.
3. **Brute force:** repeatedly pick any file whose imports are all placed: works, but slower and harder with cycles.
4. **Pattern:** **depth-first search, adding each node after its children**: a topological order.
5. **Plan:** `seen` set and `order` array → `visit` marks, visits imports in order, then pushes → visit the entry.
6. **Code and test:** draw the graph of the shared-dependency case and follow the calls.
walkthrough:
**Line by line**

- `seen` stops a file being visited twice: shared modules are included once, and cycles end.
- `visit` marks the file, visits each import (in listed order), and only then pushes the file, so everything it imports is already in `order`.
- Only files reached from `entry` are visited, which leaves unused modules out, as tree shaking does at the file level.
- `modules[file] ?? []` treats a file missing from the map as having no imports.

**Trace:** main → ui → util (push util) → push ui → api → util (seen) → http (push http) → push api → push main.

**Common wrong approach:** pushing the file before visiting its imports (pre-order): `main.js` comes first, so it would run before the modules it needs exist.
:::

:::quiz
? What's the difference between Prettier and ESLint?
+ Prettier only changes layout; ESLint reports likely bugs and bad patterns
- They're the same tool
- ESLint formats code; Prettier finds bugs
= Formatters fix style; linters find problems (some fixable with --fix).
? Which config file does ESLint 10 use?
+ eslint.config.js (flat config)
- .eslintrc.json
- package.json only
= The old eslintrc format was removed in ESLint 10.
? What is tree shaking?
+ Leaving code that nothing imports out of the bundle
- Sorting imports alphabetically
- Removing comments
= It works on the module graph built from imports.
? Why do bundlers put a hash in file names like app.3f9a2c.js?
+ So browsers can cache files forever and still get new versions after a change
- To hide the code from users
- To make the files smaller
= The name changes whenever the content changes.
:::

@@@ lesson
id: testing
title: Testing your code
minutes: 26
summary: Why automated tests, unit, integration and end-to-end tests, writing tests with node:test and node:assert/strict (test, describe, it, assertions for equality, deep equality, errors and rejections), async tests, arrange-act-assert, choosing test cases and edge cases, test doubles and dependency injection, mock functions and fake timers, Vitest and Playwright, coverage, and test-driven development.
---
You've been checking exercises with hidden tests all course. Now you'll write your own. An **automated test** is code that runs your code with known inputs and checks the results, so that every change can be checked in seconds, by you and by CI, instead of by clicking around.

### Kinds of tests

| Kind | Tests | Speed | Example |
|---|---|---|---|
| **unit** | one function or module, alone | milliseconds | `slugify("Hello World")` returns `"hello-world"` |
| **integration** | several parts together | seconds | the API handler with a real database |
| **end-to-end** | the whole app, through a real browser | slower | log in, add to cart, check out |

Most tests should be unit tests (fast and precise), with fewer integration tests and a handful of end-to-end tests for the most important journeys: the **test pyramid**.

### node:test

Node.js has a built-in test runner. A test file:

```js-static
// slugify.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "./slugify.js";

test("lower-cases and joins words with -", () => {
  assert.equal(slugify("Hello World"), "hello-world");
});
```

```bash
node --test          # finds and runs *.test.js files (and others matching the default patterns)
```

**In this sandbox, `test`, `describe`, `it` and `assert` are already available**, so the examples leave out the two `import` lines. They print like Node.js: ✔ for a pass, ✖ and the reason for a failure, then a summary.

```js
function pounds(pence) {
  return `£${(pence / 100).toFixed(2)}`;
}

test("formats whole pounds", () => {
  assert.equal(pounds(800), "£8.00");
});

test("formats pence", () => {
  assert.equal(pounds(450), "£4.50");
});

test("formats zero", () => {
  assert.equal(pounds(0), "£0.00");
});
```

A failing test shows what was expected and what came back:

```js error
function total(items) {
  return items.reduce((sum, item) => sum + item.price, 0);      // bug: ignores qty
}

test("adds price × qty", () => {
  assert.equal(total([{ price: 600, qty: 2 }, { price: 800, qty: 1 }]), 2000);
});
```

### Assertions

`node:assert/strict` throws an `AssertionError` when a check fails, which fails the test:

| Assertion | Passes when |
|---|---|
| `assert.equal(actual, expected)` | they're identical (`Object.is`, like `===`) |
| `assert.deepEqual(actual, expected)` | objects or arrays have equal contents |
| `assert.ok(value)` | the value is truthy |
| `assert.match(text, /regex/)` | the text matches |
| `assert.throws(() => fn(), expected)` | calling the function throws (optionally a matching error) |
| `await assert.rejects(promise, expected)` | the promise rejects |
| `assert.notEqual`, `assert.notDeepEqual` | the opposites |

```js
function parseQty(text) {
  const n = Number(text);
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`Not a quantity: ${text}`);
  return n;
}

describe("parseQty", () => {
  it("parses whole numbers", () => {
    assert.equal(parseQty("3"), 3);
  });
  it("rejects fractions with a RangeError", () => {
    assert.throws(() => parseQty("2.5"), RangeError);
  });
  it("explains the problem", () => {
    assert.throws(() => parseQty("lots"), /Not a quantity: lots/);
  });
  it("returns new objects with equal contents", () => {
    assert.deepEqual([1, 2].map((x) => x * 2), [2, 4]);     // equal would fail: two different arrays
  });
});
```

### Async tests

Make the test function `async` and `await` inside it. The test waits, and a rejection fails it:

```js
async function getProduct(id) {
  const res = await fetch(`https://shop.example/api/products/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

test("loads a product", async () => {
  const bell = await getProduct(2);
  assert.equal(bell.name, "Bell");
});

test("fails for a missing product", async () => {
  await assert.rejects(getProduct(99), /HTTP 404/);
});
```

Forgetting `await` before `assert.rejects` (or before the code under test) is a classic bug: the test finishes before the check runs, and passes no matter what.

### What makes a good test

- **Arrange, act, assert:** set up the input, call the code once, check the result.
- **One behaviour per test**, with a name that reads like a requirement: "rejects fractions", not "test 3".
- **Choose cases deliberately:** a normal case, the edges (empty, zero, one item, the largest allowed), and invalid input.
- **Test behaviour, not implementation:** check what the function returns or does, not how; then you can rewrite its insides and the tests still help.
- **Keep tests independent:** no test should rely on another running first.

A test suite is only as good as the bugs it would catch. A useful way to judge one is to break the code on purpose and see if a test fails, which is exactly what the first exercise checks (this is called **mutation testing**).

### Test doubles

Code that depends on the clock, the network or randomness is hard to test. The fix is to pass those dependencies in (**dependency injection**), so a test can pass a fake:

```js
function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

test("morning before noon", () => {
  assert.equal(greeting(new Date(2026, 9, 9, 9, 30)), "Good morning");
});
test("evening from 18:00", () => {
  assert.equal(greeting(new Date(2026, 9, 9, 18, 0)), "Good evening");
});
```

`node:test` also has `mock.fn()` (a function that records its calls), `mock.method(object, "name")` and fake timers (`mock.timers.enable()`) for code using `setTimeout`.

### Other test tools

- **Vitest** is the usual choice for projects built with Vite: the same `describe` and `it`, with `expect(value).toBe(…)` assertions, a fast watch mode, and since Vitest 4 (October 2025) a stable **browser mode** for testing components in a real browser. **Jest** is its older, still widespread predecessor with the same style.
- **Playwright** drives real browsers (Chromium, Firefox, WebKit) for end-to-end tests: "open the page, click Add, expect the cart badge to say 1".
- **Coverage** tools report which lines the tests ran (`node --test --experimental-test-coverage`, or `vitest --coverage`). Low coverage shows untested code; high coverage doesn't prove the tests check the right things.

### Test-driven development

**TDD** writes the test first: write a failing test for the next small behaviour (**red**), write just enough code to pass it (**green**), then tidy the code while the tests stay green (**refactor**). It keeps code testable and makes you decide what "correct" means before writing it. The second exercise works this way.

:::exercise Tests that catch the bugs
Write `testSlugify(slugify)`: a function that receives a `slugify` implementation and checks it with `assert`, throwing if it's wrong. The real `slugify` (below) must pass your checks. The check then runs your function against **five broken versions**, and each must make one of your assertions fail.

The specification: lower case; letters with accents become plain letters (`é` → `e`); every run of characters other than `a`–`z` and `0`–`9` becomes a single `-`; no `-` at the start or end.
```js starter
function slugify(text) {
  return text
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // split é into e + accent, drop the accent
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function testSlugify(slugify) {
  assert.equal(slugify("bike"), "bike");
  // add assertions that would catch mistakes
}

testSlugify(slugify);
console.log("The real slugify passes your tests.");
```
```js check
const testIt = need("testSlugify", "function");
const real = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
try { testIt(real); } catch (e) {
  throw new AssertionError(`Your tests fail for the correct slugify, so one of your expected values is wrong:\n${e.message}`);
}
const mutants = [
  ["forgets to lower-case the text", (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "")],
  ["turns each character into its own - (so \"a, b\" gives \"a--b\")", (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/^-+|-+$/g, "")],
  ["leaves - at the start and end (\"Hello!\" gives \"hello-\")", (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")],
  ["drops accented letters instead of removing just the accent (\"Café\" gives \"caf\")", (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")],
  ["removes digits (\"Lights 2026\" gives \"lights\")", (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-+|-+$/g, "")],
];
const missed = [];
for (const [bug, broken] of mutants) {
  let caught = false;
  try { testIt(broken); } catch { caught = true; }
  if (!caught) missed.push(bug);
}
if (missed.length) {
  throw new AssertionError(`Your tests pass even when slugify ${missed[0]}. Add an assertion that would catch that.` +
    (missed.length > 1 ? `\n(${missed.length - 1} more broken version${missed.length > 2 ? "s" : ""} also get${missed.length > 2 ? "" : "s"} through.)` : ""));
}
```
```js solution
function slugify(text) {
  return text
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function testSlugify(slugify) {
  assert.equal(slugify("bike"), "bike");
  assert.equal(slugify("Bike Lights"), "bike-lights");           // lower case, spaces
  assert.equal(slugify("Tyres, tubes & pumps"), "tyres-tubes-pumps");   // runs of symbols
  assert.equal(slugify("  Hello, World!  "), "hello-world");     // nothing at the ends
  assert.equal(slugify("Café crème"), "cafe-creme");             // accents
  assert.equal(slugify("Lights 2026"), "lights-2026");           // digits stay
}

testSlugify(slugify);
console.log("The real slugify passes your tests.");
```
hint: Think about each rule in the specification and write one assertion that only passes if that rule is followed. `slugify("bike")` checks almost nothing.
hint: Useful inputs: something with capitals; words separated by `, ` or ` & ` (several characters in a row); text starting or ending with spaces or punctuation; a word with an accent; a number.
hint: Work out each expected value from the specification, then run your code: the real `slugify` must pass, so if an assertion fails, your expected value is wrong.
approach:
1. **Understand:** your tests are good if they pass for correct code and fail for each kind of mistake.
2. **Examples:** `"Hello!"` catches a missing trim (`"hello-"`); `"Café"` catches dropped letters.
3. **Brute force:** dozens of random inputs: slow to check by hand, and may still miss a rule.
4. **Pattern:** **one test case per rule**, plus edges, the way you'd write any good test suite.
5. **Plan:** for each rule (case, accents, runs, ends, digits) pick an input that breaks it → compute the expected slug → assert.
6. **Code and test:** run it: the real slugify must pass. Then press Check to run the broken versions.
walkthrough:
**Line by line**

- `"Bike Lights"` → `"bike-lights"` fails if lower-casing is missing.
- `"Tyres, tubes & pumps"` has `, ` and ` & `: a version that replaces each character separately gives `tyres--tubes---pumps`.
- `"  Hello, World!  "` starts and ends with non-letters, so a version that doesn't trim returns `-hello-world-`.
- `"Café crème"` → `"cafe-creme"` only if accents are removed rather than the letters.
- `"Lights 2026"` → `"lights-2026"` fails if digits are dropped.

**Trace:** the "forgets to lower-case" version returns `"Bike-Lights"` for the second assertion → `assert.equal` throws → caught.

**Common wrong approach:** writing the expected values by running `slugify` and copying its output: the tests then agree with whatever the code does, bugs included. Expected values come from the specification.
:::

:::exercise Make the tests pass
The tests below describe `parseDuration(text)`, which turns a duration like `"1h30m"` into seconds. They fail now. Write `parseDuration` so they all pass, in the TDD way: make one pass at a time, then tidy up.

The rules: hours `h`, minutes `m` and seconds `s`, each a whole number, at most once, in that order; any of them may be left out but at least one is needed; spaces between parts are allowed. Anything else throws an `Error` with the message `Invalid duration: ` followed by the text.
```js starter
function parseDuration(text) {
  // your code here
}

describe("parseDuration", () => {
  it("reads seconds", () => assert.equal(parseDuration("90s"), 90));
  it("reads minutes", () => assert.equal(parseDuration("5m"), 300));
  it("reads hours and minutes", () => assert.equal(parseDuration("1h30m"), 5400));
  it("allows spaces between parts", () => assert.equal(parseDuration("1h 15m 10s"), 4510));
  it("rejects unknown units", () => assert.throws(() => parseDuration("5x"), /Invalid duration: 5x/));
  it("rejects an empty text", () => assert.throws(() => parseDuration(""), /Invalid duration/));
});
```
```js check
const pd = need("parseDuration", "function");
test(pd, [
  [["90s"], 90, '"90s"'],
  [["5m"], 300, '"5m"'],
  [["2h"], 7200, '"2h"'],
  [["1h30m"], 5400, '"1h30m"'],
  [["1h 15m 10s"], 4510, '"1h 15m 10s"'],
  [["0m"], 0, '"0m"'],
  [["10m5s"], 605, '"10m5s"'],
  [["1h0s"], 3600, '"1h0s"'],
]);
for (const bad of ["", "   ", "abc", "5x", "m5", "5", "1h1h", "30m1h", "1.5h", "-5m", "h"]) {
  let error = null;
  try { pd(bad); } catch (e) { error = e; }
  if (!(error instanceof Error) || error.message !== `Invalid duration: ${bad}`) {
    throw new AssertionError(`parseDuration(${inspect(bad)}) should throw an Error with the message "Invalid duration: ${bad}", but it ${error ? `threw "${error.message}"` : `returned ${inspect(pd(bad))}`}.`);
  }
}
```
```js solution
function parseDuration(text) {
  const m = /^\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?\s*$/.exec(text);
  if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) {
    throw new Error(`Invalid duration: ${text}`);
  }
  const [h, min, s] = [m[1], m[2], m[3]].map((part) => Number(part ?? 0));
  return h * 3600 + min * 60 + s;
}

describe("parseDuration", () => {
  it("reads seconds", () => assert.equal(parseDuration("90s"), 90));
  it("reads minutes", () => assert.equal(parseDuration("5m"), 300));
  it("reads hours and minutes", () => assert.equal(parseDuration("1h30m"), 5400));
  it("allows spaces between parts", () => assert.equal(parseDuration("1h 15m 10s"), 4510));
  it("rejects unknown units", () => assert.throws(() => parseDuration("5x"), /Invalid duration: 5x/));
  it("rejects an empty text", () => assert.throws(() => parseDuration(""), /Invalid duration/));
});
```
hint: Run it first: every test fails. Make "reads seconds" pass, then the next one, rerunning each time.
hint: One regular expression can describe the whole format: an optional hours part, then optional minutes, then optional seconds, with optional spaces: `/^\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?\s*$/`. Each `(\d+)` captures a number.
hint: If there's no match, or all three groups are `undefined` (as for `""`), throw `new Error(\`Invalid duration: ${text}\`)`. Otherwise add hours × 3600, minutes × 60 and seconds, using 0 for missing parts.
approach:
1. **Understand:** the tests are the specification; the check adds a few more cases of the same rules.
2. **Examples:** `"30m1h"` is out of order → invalid; `"0m"` → 0 (valid).
3. **Brute force:** splitting on letters and summing: accepts `"1h1h"` and `"30m1h"`.
4. **Pattern:** **red, green, refactor**, with a regex that describes the whole valid format.
5. **Plan:** anchored regex → no match or nothing captured → throw → sum the parts.
6. **Code and test:** run after each change; all six tests should show ✔.
walkthrough:
**Line by line**

- `^` and `$` anchor the pattern to the whole text, so `"5x"` or `"abc"` can't match partially.
- `(?:(\d+)h)?` is an optional non-capturing group containing a captured number: hours may be missing, but if present they come first. Minutes and seconds follow, so the order is enforced and each unit appears at most once.
- `\s*` between parts allows spaces; `\d+` allows only whole, non-negative numbers, so `"1.5h"` and `"-5m"` fail.
- An empty or all-spaces text matches the pattern with every group missing, hence the extra check.
- `part ?? 0` uses 0 for missing parts before the arithmetic.

**Trace:** `"1h 15m 10s"` → groups "1", "15", "10" → 3600 + 900 + 10 = 4510.

**Common wrong approach:** `text.matchAll(/(\d+)([hms])/g)` and adding everything up: it ignores anything between the matches, so `"5x10s"` returns 10 and `"1h1h"` returns 7200.
:::

:::quiz
? What does assert.equal([1, 2], [1, 2]) do?
+ Fails: they're two different arrays; use assert.deepEqual
- Passes
- Throws a TypeError
= equal checks identity; deepEqual compares contents.
? An async test calls assert.rejects(promise) without await. What can happen?
+ The test can pass even if the promise never rejects
- It always fails
- Node.js adds the await automatically
= Always await assertions on promises.
? How do you test code that uses the current time?
+ Pass the time (or a clock) in as a parameter, and pass a fixed date in tests
- Run the tests at the right time of day
- You can't test it
= Dependency injection makes outside dependencies replaceable.
? What does 100% test coverage tell you?
+ Every line ran during the tests, not that the results were checked correctly
- The code has no bugs
- Every possible input was tested
= Coverage finds untested code; it doesn't measure test quality.
:::

@@@ lesson
id: web-server
title: A small web server and API
minutes: 28
summary: How an HTTP server works, node:http's createServer, web-standard Request and Response handlers (used by Hono, Deno, Bun and edge platforms), routing, reading query strings and JSON bodies, validation and status codes, frameworks (Express 5, Fastify, Hono), middleware for errors, logging and CORS, configuration and secrets, and where Node.js servers run.
---
The practice shop API you've been calling all course is a small web server. In this lesson you build one: code that waits for HTTP requests (Lesson 24) and sends back responses.

### node:http

Node.js's built-in `http` module is the lowest level:

```js-static
// server.js
import { createServer } from "node:http";

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(3000, () => console.log("Listening on http://localhost:3000"));
```

```bash
node server.js
curl http://localhost:3000/api/health        # {"ok":true}
```

The callback runs for every request. It's all asynchronous: one Node.js process handles thousands of connections, because waiting for the network never blocks the event loop (Lesson 21).

### Handlers with Request and Response

Most new server code uses a simpler model: a **handler** is a function that takes a standard `Request` and returns (a promise of) a `Response`: the same classes `fetch` uses. Hono, Deno (`Deno.serve`), Bun (`Bun.serve`), Cloudflare Workers and Next.js route handlers all work this way, and on Node.js an adapter connects it to `node:http`.

A handler is just a function, so you can call it directly, which is how you'll run and test servers in this sandbox:

```js
async function handle(request) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/api/hello") {
    const name = url.searchParams.get("name") ?? "world";
    return Response.json({ message: `Hello, ${name}!` });          // status 200, JSON content type
  }
  return Response.json({ error: "Not found" }, { status: 404 });
}

const res = await handle(new Request("http://localhost/api/hello?name=Ada"));
console.log(res.status, res.headers.get("content-type"), await res.json());

const missing = await handle(new Request("http://localhost/nope"));
console.log(missing.status, await missing.json());
```

`Response.json(body, init)` creates a JSON response with the right `Content-Type`; `init` sets the `status` and extra `headers`.

### Routing and request bodies

A **router** picks the code for each method and path. Path parameters, like the `2` in `/api/products/2`, come from the URL:

```js
const products = [{ id: 1, name: "Inner tube", price: 600 }, { id: 2, name: "Bell", price: 800 }];

async function handle(request) {
  const { pathname } = new URL(request.url);
  const match = /^\/api\/products\/(\d+)$/.exec(pathname);

  if (match && request.method === "GET") {
    const product = products.find((p) => p.id === Number(match[1]));
    return product ? Response.json(product) : Response.json({ error: "Product not found" }, { status: 404 });
  }
  if (pathname === "/api/products" && request.method === "POST") {
    let body;
    try {
      body = await request.json();                          // the request's JSON body
    } catch {
      return Response.json({ error: "Body must be JSON" }, { status: 400 });
    }
    if (typeof body?.name !== "string" || !body.name.trim()) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }
    const product = { id: products.length + 1, name: body.name.trim(), price: body.price };
    products.push(product);
    return Response.json(product, { status: 201, headers: { Location: `/api/products/${product.id}` } });
  }
  return Response.json({ error: "Not found" }, { status: 404 });
}

const post = (body) => new Request("http://localhost/api/products", {
  method: "POST", headers: { "Content-Type": "application/json" }, body,
});
for (const req of [new Request("http://localhost/api/products/2"), post('{"name": "Lights", "price": 1500}'), post("not json"), post("{}")]) {
  const res = await handle(req);
  console.log(req.method, new URL(req.url).pathname, res.status, await res.json());
}
```

The status code tells the client what happened, so it can react without reading the message:

| Status | Use it for |
|---|---|
| 200 OK, 201 Created, 204 No Content | success (201 for something new, 204 for no body) |
| 400 Bad Request | invalid input: missing fields, wrong types, bad JSON |
| 401 Unauthorized / 403 Forbidden | not logged in / not allowed |
| 404 Not Found | no such thing (or route) |
| 405 Method Not Allowed | the path exists, but not with this method |
| 409 Conflict | the request conflicts with the current state (like too little stock) |
| 500 Internal Server Error | a bug or failure on the server |

**Validate everything** a client sends: the server is the only place validation can't be skipped (Lesson 29). A schema library such as Zod (Lesson 35) makes this concise.

### Frameworks

For real servers, a framework handles routing, parsing and the rough edges:

```js-static
// Hono: web-standard handlers, runs on Node.js, Deno, Bun and edge platforms
import { Hono } from "hono";
const app = new Hono();
app.get("/api/products/:id", (c) => {
  const product = products.find((p) => p.id === Number(c.req.param("id")));
  return product ? c.json(product) : c.json({ error: "Product not found" }, 404);
});
export default app;
```

| Framework | Known for |
|---|---|
| **Express** (version 5) | the classic Node.js framework; huge ecosystem of middleware |
| **Fastify** | speed, and validating requests with JSON Schema |
| **Hono** | small, web-standard `Request`/`Response`, runs everywhere |
| **Next.js**, **Nuxt**, **SvelteKit** | full-stack frameworks: pages and API routes together |

### Middleware

**Middleware** is code that runs around every handler: logging, authentication, error handling, CORS. With handler functions it's simply a function that takes a handler and returns a new one:

```js
const withLogging = (handler) => async (request) => {
  const response = await handler(request);
  console.log(`${request.method} ${new URL(request.url).pathname} → ${response.status}`);
  return response;
};

const hello = async () => Response.json({ hello: "world" });
const app = withLogging(hello);
await app(new Request("http://localhost/api/hello"));
await app(new Request("http://localhost/api/other", { method: "POST" }));
```

Wrapping works in layers: `withErrors(withLogging(withCors(router)))`. The exercises build two common ones.

### Configuration, secrets and running in production

- Read settings from **environment variables** (`process.env.PORT`, Lesson 36). Secrets such as database passwords and API keys live there, never in the code or the repository.
- Keys for paid services, including LLM APIs, must stay on the **server**: the browser calls your server, which adds the key and calls the service (Part 8).
- A server must not crash on bad input: catch errors, return 400 or 500, and log the details for yourself, not the client.
- In production, a platform or a container runs `node server.js` (or `node --run start`), restarts it if it crashes, and puts HTTPS in front of it. Packaging a server as a Docker container, and deploying it automatically, is part of the next course.

:::exercise A products API
Write `async function handle(request)` for a small products API, using the `products` array and the `json` helper provided. Paths are relative to any host.

- `GET /api/products` → 200 with all products; with `?maxPrice=1000`, only products costing at most that.
- `GET /api/products/<id>` → 200 with that product, or 404 `{ "error": "Product not found" }`.
- `POST /api/products` with a JSON body `{ name, price }` → 201 with the new product `{ id, name, price }` (id one more than the largest id; the name trimmed), added to `products`. Invalid JSON → 400 `{ "error": "Body must be JSON" }`; a missing or empty name, or a price that isn't a whole number of at least 0 → 400 `{ "error": "Invalid product" }`.
- A path above with any other method → 405 `{ "error": "Method not allowed" }`; any other path → 404 `{ "error": "Not found" }`.
```js starter
const products = [
  { id: 1, name: "Inner tube", price: 600 },
  { id: 2, name: "Bell", price: 800 },
  { id: 4, name: "Floor pump", price: 3200 },
];
const json = (body, status = 200) => Response.json(body, { status });

async function handle(request) {
  // your code here
}

const res = await handle(new Request("http://localhost/api/products?maxPrice=1000"));
console.log(res.status, await res.json());
```
```js check
const h = need("handle", "function");
const ps = need("products");
async function call(method, path, body) {
  const init = { method };
  if (body !== undefined) { init.body = body; init.headers = { "Content-Type": "application/json" }; }
  const res = await h(new Request("http://localhost" + path, init));
  if (!(res instanceof Response)) throw new AssertionError(`handle should return a Response (for ${method} ${path}), but it returned ${inspect(res)}.`);
  let data;
  try { data = await res.json(); } catch { throw new AssertionError(`The response to ${method} ${path} should have a JSON body.`); }
  return [res.status, data];
}
const expect = async (method, path, body, want, what) => same(await call(method, path, body), want, `[status, body] for ${what}`);
await expect("GET", "/api/products", undefined, [200, ps.slice()], "GET /api/products");
await expect("GET", "/api/products?maxPrice=800", undefined, [200, ps.filter((p) => p.price <= 800)], "GET /api/products?maxPrice=800");
await expect("GET", "/api/products/4", undefined, [200, { id: 4, name: "Floor pump", price: 3200 }], "GET /api/products/4");
await expect("GET", "/api/products/3", undefined, [404, { error: "Product not found" }], "GET /api/products/3");
await expect("POST", "/api/products", '{"name": "  Lights ", "price": 1500}', [201, { id: 5, name: "Lights", price: 1500 }], "POST a valid product");
await expect("GET", "/api/products/5", undefined, [200, { id: 5, name: "Lights", price: 1500 }], "GET /api/products/5 after adding it");
await expect("POST", "/api/products", "nope", [400, { error: "Body must be JSON" }], "POST with invalid JSON");
await expect("POST", "/api/products", '{"price": 100}', [400, { error: "Invalid product" }], "POST without a name");
await expect("POST", "/api/products", '{"name": "  ", "price": 100}', [400, { error: "Invalid product" }], "POST with a blank name");
await expect("POST", "/api/products", '{"name": "Lamp", "price": 9.99}', [400, { error: "Invalid product" }], "POST with a price of 9.99");
await expect("POST", "/api/products", '{"name": "Lamp", "price": -1}', [400, { error: "Invalid product" }], "POST with a negative price");
await expect("POST", "/api/products", '{"name": "Lamp", "price": "100"}', [400, { error: "Invalid product" }], "POST with a string price");
same(ps.length, 4, "products.length after one valid POST and several invalid ones");
await expect("DELETE", "/api/products", undefined, [405, { error: "Method not allowed" }], "DELETE /api/products");
await expect("POST", "/api/products/1", "{}", [405, { error: "Method not allowed" }], "POST /api/products/1");
await expect("GET", "/api/orders", undefined, [404, { error: "Not found" }], "GET /api/orders");
await expect("GET", "/api/products/abc", undefined, [404, { error: "Not found" }], "GET /api/products/abc");
```
```js solution
const products = [
  { id: 1, name: "Inner tube", price: 600 },
  { id: 2, name: "Bell", price: 800 },
  { id: 4, name: "Floor pump", price: 3200 },
];
const json = (body, status = 200) => Response.json(body, { status });

async function handle(request) {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  if (pathname === "/api/products") {
    if (method === "GET") {
      const max = url.searchParams.get("maxPrice");
      return json(max === null ? products : products.filter((p) => p.price <= Number(max)));
    }
    if (method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Body must be JSON" }, 400);
      }
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      if (!name || !Number.isInteger(body.price) || body.price < 0) return json({ error: "Invalid product" }, 400);
      const product = { id: Math.max(0, ...products.map((p) => p.id)) + 1, name, price: body.price };
      products.push(product);
      return json(product, 201);
    }
    return json({ error: "Method not allowed" }, 405);
  }

  const match = /^\/api\/products\/(\d+)$/.exec(pathname);
  if (match) {
    if (method !== "GET") return json({ error: "Method not allowed" }, 405);
    const product = products.find((p) => p.id === Number(match[1]));
    return product ? json(product) : json({ error: "Product not found" }, 404);
  }

  return json({ error: "Not found" }, 404);
}

const res = await handle(new Request("http://localhost/api/products?maxPrice=1000"));
console.log(res.status, await res.json());
```
hint: Start with `const url = new URL(request.url);` and branch on `url.pathname` first, then on `request.method` inside each path. That makes the 405 case easy: a known path whose method matched nothing.
hint: Match `/api/products/<id>` with `/^\/api\/products\/(\d+)$/`; `\d+` means `/api/products/abc` falls through to the final 404. Read `?maxPrice` with `url.searchParams.get("maxPrice")` (`null` if absent).
hint: For POST, `await request.json()` inside `try`/`catch` (invalid JSON throws). Validate with `typeof body?.name === "string"`, `trim()`, and `Number.isInteger(body.price) && body.price >= 0`. New id: `Math.max(0, ...products.map((p) => p.id)) + 1`.
approach:
1. **Understand:** a router: method + path → the right response and status, with validation for the one write.
2. **Examples:** `POST /api/products/1` → 405 (the path exists, the method doesn't); `/api/products/abc` → 404.
3. **Brute force:** one long `if` chain mixing paths and methods: easy to get 404 where 405 is right.
4. **Pattern:** **route by path, then by method**; validate before changing anything.
5. **Plan:** parse URL → collection path (GET list/filter, POST create, else 405) → item path (GET or 405) → 404.
6. **Code and test:** the starter's request shows the filter; add your own `handle(new Request(...))` calls.
walkthrough:
**Line by line**

- `new URL(request.url)` splits the URL into `pathname` and `searchParams`, so query strings never confuse the routing.
- The collection path handles GET (with an optional filter, `Number(max)` converting the text) and POST; any other method gets 405.
- POST reads the body in `try`/`catch`; `body?.name` copes with a body that is `null` or not an object; `Number.isInteger` rejects strings, fractions and `NaN`.
- The new id is one more than the largest existing id (ids may have gaps, like the missing 3), and the product is only added after validation passed.
- The item route uses a regex with a captured number; other methods get 405, unknown ids 404.

**Trace:** `POST /api/products` with `{"name": "  Lights ", "price": 1500}` → JSON ok → name "Lights" → price ok → id max(1, 2, 4) + 1 = 5 → 201.

**Common wrong approach:** `id: products.length + 1`: with ids 1, 2 and 4 it creates a second product with id 4.
:::

:::exercise Middleware for errors and CORS
Write two middleware functions. Each takes a handler and returns a new handler.

- `withErrors(handler)`: calls the handler; if it throws (or its promise rejects), log the error with `console.error` and return a 500 response with the JSON body `{ "error": "Internal server error" }`. The client must never see the real error message.
- `withCors(handler, origin)`: for an `OPTIONS` request (a browser's **preflight** check), return 204 with no body and the headers `Access-Control-Allow-Origin: <origin>`, `Access-Control-Allow-Methods: GET, POST` and `Access-Control-Allow-Headers: Content-Type`, without calling the handler. For other requests, call the handler and return its response with `Access-Control-Allow-Origin: <origin>` added (keeping its status, body and other headers).
```js starter
function withErrors(handler) {
  // your code here
}

function withCors(handler, origin) {
  // your code here
}

const broken = async () => { throw new Error("database password is hunter2"); };
const res = await withErrors(broken)(new Request("http://localhost/api"));
console.log(res.status, await res.json());
```
```js check
const we = need("withErrors", "function"), wc = need("withCors", "function");
const req = (method = "GET") => new Request("http://localhost/api/x", { method });
const ok = async () => Response.json({ fine: true }, { status: 201, headers: { "X-Total": "3" } });
let r = await we(ok)(req());
same([r.status, await r.json()], [201, { fine: true }], "[status, body] from withErrors(handler) when the handler works");
for (const [label, bad] of [
  ["throws", async () => { throw new Error("secret details"); }],
  ["throws synchronously", () => { throw new TypeError("secret details"); }],
  ["returns a rejected promise", () => Promise.reject(new Error("secret details"))],
]) {
  r = await we(bad)(req());
  if (!(r instanceof Response)) throw new AssertionError(`withErrors(handler) should return a Response when the handler ${label}.`);
  const text = await r.text();
  same([r.status, JSON.parse(text)], [500, { error: "Internal server error" }], `[status, body] when the handler ${label}`);
}
if (!/console\.error/.test(__source__)) throw new AssertionError("Log the error with console.error, so you can find out what went wrong.");
r = await wc(ok, "https://shop.example")(req());
same([r.status, await r.json(), r.headers.get("access-control-allow-origin"), r.headers.get("x-total")],
  [201, { fine: true }, "https://shop.example", "3"], "[status, body, Access-Control-Allow-Origin, X-Total] for a GET through withCors");
let called = false;
r = await wc(async () => { called = true; return new Response("x"); }, "https://a.example")(req("OPTIONS"));
same([r.status, await r.text(), called], [204, "", false], "[status, body, was the handler called] for an OPTIONS request");
same([r.headers.get("access-control-allow-origin"), r.headers.get("access-control-allow-methods"), r.headers.get("access-control-allow-headers")],
  ["https://a.example", "GET, POST", "Content-Type"], "the preflight response's three Access-Control headers");
r = await wc(async () => new Response(null, { status: 404 }), "https://b.example")(req("POST"));
same([r.status, r.headers.get("access-control-allow-origin")], [404, "https://b.example"], "[status, Access-Control-Allow-Origin] for a 404 through withCors");
```
```js solution
function withErrors(handler) {
  return async (request) => {
    try {
      return await handler(request);
    } catch (error) {
      console.error("Request failed:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

function withCors(handler, origin) {
  return async (request) => {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }
    const response = await handler(request);
    const copy = new Response(response.body, response);
    copy.headers.set("Access-Control-Allow-Origin", origin);
    return copy;
  };
}

const broken = async () => { throw new Error("database password is hunter2"); };
const res = await withErrors(broken)(new Request("http://localhost/api"));
console.log(res.status, await res.json());
```
hint: Both return a new function: `return async (request) => { … };`. Inside `withErrors`, `return await handler(request);` inside `try`: the `await` is what makes a rejected promise land in your `catch`.
hint: In `catch`, `console.error(...)` the real error, then `return Response.json({ error: "Internal server error" }, { status: 500 });`.
hint: For CORS preflight, `new Response(null, { status: 204, headers: { … } })`. For other requests, copy the handler's response with `new Response(response.body, response)` (the copy's headers can be changed), then `copy.headers.set(...)`.
approach:
1. **Understand:** wrappers that change what happens around a handler without touching the handler itself.
2. **Examples:** a handler throwing "secret details" → client sees only "Internal server error"; OPTIONS never reaches the handler.
3. **Brute force:** adding `try`/`catch` and CORS headers inside every handler: repetitive, and one forgotten handler leaks errors.
4. **Pattern:** **higher-order functions**: take a function, return a function (Lesson 7), the same shape as every middleware system.
5. **Plan:** withErrors: try await handler → catch log + 500. withCors: OPTIONS → 204 with headers; else await handler → copy → add header.
6. **Code and test:** run the starter's broken handler through `withErrors`, then try `withCors` with a few requests.
walkthrough:
**Line by line**

- `return await handler(request)` inside `try` catches both a synchronous `throw` and a rejected promise; `return handler(request)` without `await` would let a rejection escape the `try`.
- The real error goes to `console.error` (your logs); the client gets a generic message, because error details can reveal secrets or internals.
- A browser sends an `OPTIONS` preflight before a cross-origin request with JSON; answering it with the allowed origin, methods and headers lets the real request proceed.
- `new Response(response.body, response)` makes a copy with the same body, status and headers, but headers you're allowed to change: headers of some responses (such as those from `fetch`) are read-only.

**Trace:** `withCors(ok, "https://shop.example")` on GET → not OPTIONS → `ok` returns 201 with `X-Total` → copy → add the CORS header → 201, body intact, both headers present.

**Common wrong approach:** `Access-Control-Allow-Origin: *` with credentials, or reflecting any `Origin` header back unchecked: CORS exists to say *which* sites may call your API, so allow only the origins you trust.
:::

:::quiz
? What does a web-standard handler take and return?
+ A Request, and a Response (or a promise of one)
- req and res objects from node:http
- A URL string and a JSON object
= The same classes fetch uses, which is why one handler runs on many platforms.
? A client POSTs a product without a name. Which status fits?
+ 400 Bad Request
- 404 Not Found
- 500 Internal Server Error
= 400 means the client's input is invalid.
? Why should a 500 response hide the real error message?
+ Error details can reveal secrets or internals to anyone calling the API
- Browsers can't display long messages
- It's required by HTTP
= Log the details for yourself; return a generic message.
? What is middleware in a handler-based server?
+ A function that wraps a handler and returns a new handler, adding behaviour such as logging or error handling
- A database between the server and the client
- A browser extension
= Middleware composes: withErrors(withLogging(router)).
:::
