# Lesson 37: npm, packages and package.json

**You'll learn:** packages and the npm registry, package.json fields (name, version, private, type, scripts, dependencies, devDependencies, engines, exports, bin), node --run, npm install, uninstall, ci and npx, node_modules, package-lock.json, semantic versioning, version ranges (caret, tilde, exact, 0.x), pre-releases, npm outdated, update and audit, Dependabot and Renovate, pnpm, Yarn and Bun, supply-chain attacks (Shai-Hulud), install scripts, typosquatting and trusted publishing.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#npm-and-packages)**: run every example and check your exercise answers.

## Key terms

- **Package:** a folder of code with a `package.json`, usually published to the npm registry.
- **`package.json`:** a project's description: name, version, scripts and dependencies.
- **Dependency:** a package your code needs to run; a **dev dependency** is only needed while developing.
- **Lockfile:** a file (`package-lock.json`) recording the exact installed version of every package.
- **Semantic versioning (semver):** `MAJOR.MINOR.PATCH`, where MAJOR changes mean breaking changes.
- **Version range:** a set of acceptable versions, like `^4.1.0` (compatible) or `~4.1.0` (patches only).
- **npm script:** a named command in `package.json`'s `scripts`, run with `npm run <name>`.
- **Supply-chain attack:** an attack through the dependencies a project installs.
- **Install script:** code a package runs automatically when it's installed.

A **package** is a folder of code with a `package.json` describing it. The **npm registry** holds millions of them, and the `npm` command (installed with Node.js) downloads them and runs your project's scripts. Almost every JavaScript project, front end or back end, is an npm package.

## package.json

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

## Installing

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

## Semantic versioning

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

## Keeping up to date

```bash
npm outdated        # what has newer versions
npm update          # update within the ranges in package.json
npm audit           # known vulnerabilities in your dependency tree
```

Many teams let a bot (Dependabot or Renovate) open a pull request for each update, so tests run before anything is merged.

## npm, pnpm, Yarn and Bun

All four install from the same registry and read the same `package.json`. **pnpm** saves disk space by storing each version once and linking it into projects, and is strict about undeclared dependencies; **Yarn** is another popular alternative; **Bun** is a runtime with a very fast built-in installer. A project uses one, recorded by its lockfile (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock` or `bun.lock`).

## Supply-chain safety

Installing a package runs other people's code, sometimes at install time: packages can define **install scripts**. In September 2025 a self-replicating worm called **Shai-Hulud** spread through npm this way: stolen maintainer accounts published poisoned versions whose install scripts stole tokens and used them to infect more packages; over 500 packages were taken down. npm responded with stricter publishing rules, such as two-factor authentication and **trusted publishing**, where packages are published from CI without long-lived tokens.

Habits that protect you:

- Add dependencies sparingly; a few lines of your own code can beat a package you must trust forever.
- Commit the lockfile and use `npm ci`, so new versions arrive only when you choose.
- Check a package before adding it: maintainers, downloads, recent activity, and whether its name is a lookalike of a popular one (**typosquatting**).
- Turn off install scripts where you can (`npm install --ignore-scripts`; pnpm 10 doesn't run dependencies' install scripts unless you allow them).
- Run `npm audit` and update promptly when a fix is released.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Reproducible installs | commit package-lock.json; npm ci | O(packages) | O(packages) |
| Compare versions | split into numbers, compare field by field | O(1) | O(1) |
| Safer dependencies | few packages, lockfile, audit, no install scripts | — | — |

## Common mistakes

- Committing `node_modules`, or not committing the lockfile.
- Using `npm install` instead of `npm ci` in CI.
- Comparing version strings directly (`"1.10.0" < "1.9.0"`).
- Adding packages for trivial tasks without checking who maintains them.
- Putting build and test tools in `dependencies` instead of `devDependencies`.

## Exercises

### 1. Compare versions

Write `compareVersions(a, b)` for semver versions such as `"4.10.2"` or `"4.0.0-beta.2"`. Return `-1` if `a` comes before `b`, `1` if after, and `0` if they're equal.

- Compare major, then minor, then patch, **as numbers**.
- A pre-release (`-…`) comes **before** the same version without one.
- Two pre-releases are compared part by part (split at `.`): numbers as numbers, text alphabetically, a number before text, and if all shared parts are equal, the one with fewer parts comes first.

Starter code:

```js
function compareVersions(a, b) {
  // your code here
}

console.log(compareVersions("4.10.2", "4.9.0"));        // 1
console.log(compareVersions("4.0.0-beta.2", "4.0.0"));   // -1
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** semver precedence: numbers, then the pre-release rule.
2. **Examples:** `1.10.0` > `1.9.9` (strings would say otherwise); `beta.2` < `beta.11`.
3. **Brute force:** comparing the whole strings: wrong as soon as a number has two digits.
4. **Pattern:** **compare field by field, stop at the first difference**.
5. **Plan:** parse → compare 3 numbers → pre-release presence → pre-release parts → length.
6. **Code and test:** the checks cover each rule.

</details>

<details>
<summary>💡 Hint 1</summary>

Split each version at the first `-` into the core (`"4.0.0"`) and the pre-release (`"beta.2"`, or none). Compare the three core numbers with `Number`, in order.

</details>

<details>
<summary>💡 Hint 2</summary>

If the cores are equal: no pre-release on either → 0; only one has a pre-release → that one is smaller.

</details>

<details>
<summary>💡 Hint 3</summary>

For two pre-releases, compare parts left to right: both numeric → compare numbers; one numeric → it's smaller; both text → compare strings. If every shared part is equal, the shorter list is smaller.

</details>

### 2. Does a version satisfy a range?

Write `satisfies(version, range)` for plain versions (`"MAJOR.MINOR.PATCH"`, no pre-releases) and these ranges:

- `"*"`: any version;
- `"1.2.3"`: exactly that version;
- `"~1.2.3"`: at least 1.2.3, below 1.3.0;
- `"^1.2.3"`: at least 1.2.3, below the next major (2.0.0). For `^0.x`: below the next minor (`^0.3.2` → below 0.4.0), and for `^0.0.x` only that exact version;
- `">=1.2.3"`: that version or later.

Starter code:

```js
function satisfies(version, range) {
  // your code here
}

console.log(satisfies("4.9.1", "^4.1.0"), satisfies("5.0.0", "^4.1.0"));   // true false
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** each range is a lower bound and (except `>=`) an exclusive upper bound.
2. **Examples:** `^1.9.0` allows 1.10.0; `^0.3.2` doesn't allow 0.4.0.
3. **Brute force:** string comparisons or regexes on the text: `"1.10.0" < "1.9.0"` breaks them.
4. **Pattern:** **turn each rule into numeric bounds**.
5. **Plan:** `*` → exact → `>=` → read operator and minimum → compute the upper bound → compare.
6. **Code and test:** check each row of the range table.

</details>

<details>
<summary>💡 Hint 1</summary>

Turn versions into arrays of three numbers, and write a small `cmp(a, b)` returning -1, 0 or 1 (like the previous exercise, without pre-releases).

</details>

<details>
<summary>💡 Hint 2</summary>

Every range except `>=` is "at least the minimum, and below an upper limit". Work out the upper limit: `~1.2.3` → `[1, 3, 0]`; `^1.2.3` → `[2, 0, 0]`; `^0.3.2` → `[0, 4, 0]`; `^0.0.3` → `[0, 0, 4]`.

</details>

<details>
<summary>💡 Hint 3</summary>

Then `return cmp(v, min) >= 0 && cmp(v, below) < 0;`. Handle `*`, exact versions and `>=` before that.

</details>

**In the sandbox:** exercises 73–74. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Compare versions</summary>

```js
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

**Line by line**

- `parse` splits off the pre-release after the first `-` (pre-releases may contain more `-`, so the slice keeps everything after it) and turns the core into numbers.
- The first loop returns at the first differing number; `sign` turns the difference into -1 or 1.
- With equal cores, a version without a pre-release is the bigger one: 4.0.0 comes after 4.0.0-rc.1.
- Pre-release parts: `/^\d+$/` tells numbers from text. Numbers compare numerically, a number is lower than text, and text compares alphabetically.
- If all shared parts match, more parts means later: `alpha` < `alpha.1`.

**Trace:** `1.0.0-beta.2` vs `1.0.0-beta.11` → cores equal → `beta` = `beta` → `2` vs `11` numerically → -1.

**Common wrong approach:** `a.localeCompare(b)` or `a < b` on the whole strings: `"1.10.0" < "1.9.9"` is true, because "1" sorts before "9".

</details>

<details>
<summary>✅ 2. Does a version satisfy a range?</summary>

```js
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

**Line by line**

- `cmp` compares the three numbers in order, as in `compareVersions`.
- `>=` only has a lower bound; an exact version only matches itself.
- For `~`, the upper bound is the next minor. For `^`, it's the next number after the first non-zero part: major, or minor for `0.x`, or patch for `0.0.x`.
- The result is `min ≤ v < below`.

**Trace:** `satisfies("0.4.0", "^0.3.2")` → min [0,3,2] → major is 0, minor 3 > 0 → below [0,4,0] → 0.4.0 isn't below → false.

**Common wrong approach:** treating `^` as "same major" for every version: `^0.3.2` would then accept 0.9.0, which may be a breaking change for a pre-1.0 package.

</details>

## Quick quiz

1. Which file should you commit so every install gets the same versions?
   - A) package-lock.json
   - B) node_modules
   - C) .npmrc

2. What does "^4.1.0" allow?
   - A) 4.1.0 up to, but not including, 5.0.0
   - B) Only 4.1.x
   - C) Any version at least 4.1.0

3. Where does a test runner like vitest belong?
   - A) devDependencies
   - B) dependencies
   - C) engines

4. How did the 2025 Shai-Hulud worm spread between npm packages?
   - A) Install scripts in poisoned versions stole maintainers' tokens and published more poisoned packages
   - B) Through a bug in Node.js
   - C) By editing package-lock.json files on GitHub

<details>
<summary>Quiz answers</summary>

1. **A) package-lock.json**: The lockfile records exact versions; npm ci installs exactly them.
2. **A) 4.1.0 up to, but not including, 5.0.0**: ^ allows compatible (non-major) updates.
3. **A) devDependencies**: It's only needed while developing, not to run the app.
4. **A) Install scripts in poisoned versions stole maintainers' tokens and published more poisoned packages**: Install scripts run code on install; limit them and pin versions with a lockfile.

</details>

---
Previous: [Lesson 36](36-node-basics.md) · Next: [Lesson 38: Formatting, linting and bundling](38-formatting-linting-bundling.md)
