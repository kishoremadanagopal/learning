# Lesson 15: Jobs, matrices and expressions

**You'll learn:** several jobs and needs, parallel jobs and skipped dependants, matrices (combinations, include, exclude, fail-fast), supported Node.js versions in October 2026, expressions and ${{ }}, contexts (github, env, vars, secrets, matrix, strategy, steps, needs, runner), operators and functions, if conditions and the implicit success(), status functions, env at three levels, GITHUB_ENV, GITHUB_OUTPUT and step outputs, job outputs and needs, workflow commands (notice, warning, error, group, add-mask), actionlint and its rules, debug logging.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#workflow-syntax)**: run every example and check your exercise answers.

## Key terms

- **`needs:`:** a job setting that makes the job wait for other jobs, and skips it if they fail.
- **Matrix:** a set of values that runs a job once per combination.
- **fail-fast:** cancelling the rest of a matrix when one job fails (on by default).
- **Expression:** code between `${{` and `}}`, evaluated by GitHub before a step runs.
- **Context:** an object of information available to expressions, like `github` or `matrix`.
- **Status function:** `success()`, `failure()`, `always()` or `cancelled()` in an `if:`.
- **Step output:** a value a step writes to `$GITHUB_OUTPUT`, read as `steps.<id>.outputs.<name>`.
- **Job output:** a value a job exposes to the jobs that need it.
- **Workflow command:** a line starting with `::` that a step prints to talk to the runner.
- **actionlint:** a linter that checks workflow files for errors before you push.

One job with three steps covers a lot. Real pipelines add a quick check that fails fast, test on every supported version, and pass results from one job to the next. This lesson is the workflow language itself.

## Several jobs

Each job gets its own fresh runner, and jobs run **in parallel** unless `needs:` makes one wait for another. A job whose `needs` failed is skipped.

![Three jobs, test (22), test (24) and test (26), produced by matrix node [22, 24, 26], all point to a build job (needs: test), which points to a deploy job (needs: build, if: github.ref == 'refs/heads/main')](../figures/job-graph.svg)

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
cat > package.json <<'EOF'
{
  "name": "shop",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
EOF
cat > prices.js <<'EOF'
// Prices are in cents: 800 means 8.00.
export const PRICES = { bell: 800, pump: 3000, lock: 2900 };

export function total(items) {
  return items.reduce((sum, item) => sum + PRICES[item], 0);
}

export function formatPrice(cents) {
  return (cents / 100).toFixed(2);
}
EOF
cat > prices.test.js <<'EOF'
import { test } from "node:test";
import assert from "node:assert/strict";
import { total, formatPrice } from "./prices.js";

test("adds up a basket", () => {
  assert.equal(total(["bell", "pump"]), 3800);
});

test("shows a price with two decimals", () => {
  assert.equal(formatPrice(2900), "29.00");
});
EOF
mkdir -p .github/workflows
cat > .github/workflows/ci.yml <<'EOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - run: npm test
EOF
git add . && git commit -qm "Add the price list and its tests"
gh repo create shop --public --source=. --push
```

</details>

```bash
cat > .github/workflows/ci.yml <<'EOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  syntax:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: node --check prices.js

  test:
    needs: syntax
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - run: npm test
EOF
git commit -qam "Check the syntax before testing"
git push -q
gh run view 22417308038
```

`node --check` only parses the file, which takes a moment, so a typo fails the run before the slower job starts. `syntax` doesn't need Node.js 24 specifically: the runner image already has Node.js 22.

## A matrix

A **matrix** runs the same job once for every combination of values. The shop's code should work on every Node.js version still supported: 22 (maintenance until April 2027), 24 (the current LTS) and 26 (released in April 2026; it becomes LTS in late October 2026):

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
cat > package.json <<'EOF'
{
  "name": "shop",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
EOF
cat > prices.js <<'EOF'
// Prices are in cents: 800 means 8.00.
export const PRICES = { bell: 800, pump: 3000, lock: 2900 };

export function total(items) {
  return items.reduce((sum, item) => sum + PRICES[item], 0);
}

export function formatPrice(cents) {
  return (cents / 100).toFixed(2);
}
EOF
cat > prices.test.js <<'EOF'
import { test } from "node:test";
import assert from "node:assert/strict";
import { total, formatPrice } from "./prices.js";

test("adds up a basket", () => {
  assert.equal(total(["bell", "pump"]), 3800);
});

test("shows a price with two decimals", () => {
  assert.equal(formatPrice(2900), "29.00");
});
EOF
mkdir -p .github/workflows
cat > .github/workflows/ci.yml <<'EOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - run: npm test
EOF
git add . && git commit -qm "Add the price list and its tests"
gh repo create shop --public --source=. --push
```

</details>

```bash
cat > .github/workflows/ci.yml <<'EOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    strategy:
      matrix:
        node: [22, 24, 26]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ matrix.node }}
      - run: node --version
      - run: npm test
EOF
git commit -qam "Test on three Node.js versions"
git push -q
gh run view 22417308038
```

- The jobs are named `test (22)`, `test (24)` and `test (26)`, and they run in parallel.
- `${{ matrix.node }}` is an **expression**: GitHub replaces it with the value for that job before the step runs.
- With two keys (`os: [ubuntu-latest, windows-latest]` and `node: [22, 24]`) you'd get 2 × 2 = 4 jobs. `exclude:` removes combinations, `include:` adds or extends them.
- **fail-fast** (on by default) cancels the other matrix jobs as soon as one fails, to save time; set `fail-fast: false` to see every result.

## Expressions and contexts

Anything between `${{` and `}}` is an expression. Expressions read **contexts**, objects GitHub fills in for each run:

| Context | Holds |
|---|---|
| `github` | the event and repository: `github.ref`, `github.sha`, `github.actor`, `github.event_name`, `github.event` (the full event) |
| `env` | environment variables set with `env:` |
| `vars` | configuration variables (next lesson) |
| `secrets` | secrets (next lesson) |
| `matrix`, `strategy` | this job's matrix values |
| `steps` | earlier steps' `outputs` and `outcome`, by `id` |
| `needs` | the `result` and `outputs` of the jobs this one needs |
| `runner` | the runner: `runner.os`, `runner.temp` |

Expressions have operators (`==`, `!=`, `&&`, `||`, `!`), literals (`'text'` in **single** quotes, numbers, `true`, `null`) and functions: `contains()`, `startsWith()`, `endsWith()`, `format()`, `join()`, `toJSON()`, `fromJSON()` and `hashFiles()`. Comparisons ignore upper and lower case for text.

**`if:`** decides whether a job or step runs. Every `if:` silently starts with `success() &&` unless it uses a **status function** itself: `success()` (everything before succeeded), `failure()` (something failed), `always()` and `cancelled()`.

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
cat > package.json <<'EOF'
{
  "name": "shop",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
EOF
cat > prices.js <<'EOF'
// Prices are in cents: 800 means 8.00.
export const PRICES = { bell: 800, pump: 3000, lock: 2900 };

export function total(items) {
  return items.reduce((sum, item) => sum + PRICES[item], 0);
}

export function formatPrice(cents) {
  return (cents / 100).toFixed(2);
}
EOF
cat > prices.test.js <<'EOF'
import { test } from "node:test";
import assert from "node:assert/strict";
import { total, formatPrice } from "./prices.js";

test("adds up a basket", () => {
  assert.equal(total(["bell", "pump"]), 3800);
});

test("shows a price with two decimals", () => {
  assert.equal(formatPrice(2900), "29.00");
});
EOF
mkdir -p .github/workflows
cat > .github/workflows/ci.yml <<'EOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - run: npm test
EOF
git add . && git commit -qm "Add the price list and its tests"
gh repo create shop --public --source=. --push
```

</details>

```bash
cat > .github/workflows/info.yml <<'EOF'
name: Info

on: push

jobs:
  show:
    runs-on: ubuntu-latest
    steps:
      - run: echo "${{ github.actor }} pushed ${{ github.sha }} to ${{ github.ref_name }}"
      - run: echo "Main branch only"
        if: github.ref == 'refs/heads/main'
      - run: echo "Something failed earlier"
        if: failure()
      - run: echo "This always runs"
        if: always()
EOF
git add . && git commit -qm "Show some contexts"
git push -q
gh run view 22417312057 --log | cut -f2 | uniq
```

The last command lists the steps that wrote a log: the `failure()` step was skipped, because nothing failed.

## Passing data along

- **`env:`** sets environment variables for a whole workflow, a job or one step (the most specific wins). In scripts, read them as `$NAME`.
- A step can set a variable for the **later steps** of its job: `echo "NAME=value" >> "$GITHUB_ENV"`.
- A step with an `id` can produce **outputs**: `echo "name=value" >> "$GITHUB_OUTPUT"`, read later as `${{ steps.<id>.outputs.name }}`.
- A job passes values to the jobs that need it through `outputs:`, read as `${{ needs.<job>.outputs.name }}`.

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
cat > package.json <<'EOF'
{
  "name": "shop",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
EOF
cat > prices.js <<'EOF'
// Prices are in cents: 800 means 8.00.
export const PRICES = { bell: 800, pump: 3000, lock: 2900 };

export function total(items) {
  return items.reduce((sum, item) => sum + PRICES[item], 0);
}

export function formatPrice(cents) {
  return (cents / 100).toFixed(2);
}
EOF
cat > prices.test.js <<'EOF'
import { test } from "node:test";
import assert from "node:assert/strict";
import { total, formatPrice } from "./prices.js";

test("adds up a basket", () => {
  assert.equal(total(["bell", "pump"]), 3800);
});

test("shows a price with two decimals", () => {
  assert.equal(formatPrice(2900), "29.00");
});
EOF
mkdir -p .github/workflows
cat > .github/workflows/ci.yml <<'EOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - run: npm test
EOF
git add . && git commit -qm "Add the price list and its tests"
gh repo create shop --public --source=. --push
```

</details>

```bash
cat > .github/workflows/version.yml <<'EOF'
name: Version

on: push

jobs:
  read:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.pkg.outputs.version }}
    steps:
      - uses: actions/checkout@v7
      - id: pkg
        run: echo "version=$(node -p "require('./package.json').version")" >> "$GITHUB_OUTPUT"

  report:
    needs: read
    runs-on: ubuntu-latest
    env:
      VERSION: ${{ needs.read.outputs.version }}
    steps:
      - run: echo "::notice title=Version::Building shop $VERSION"
EOF
git add . && git commit -qm "Report the version"
git push -q
gh run view 22417312057
```

Lines a step prints that start with `::` are **workflow commands** for the runner: `::notice::`, `::warning::` and `::error::` create annotations (add `file=prices.js,line=9` to point at a line), `::group::Title` … `::endgroup::` folds lines, and `::add-mask::value` hides a value in the log.

## Catching mistakes with actionlint

A typo in a workflow file isn't caught by anything on your computer: you push, and the run fails straight away with **This run likely failed because of a workflow file issue**. `actionlint` checks the files first:

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
cat > package.json <<'EOF'
{
  "name": "shop",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
EOF
cat > prices.js <<'EOF'
// Prices are in cents: 800 means 8.00.
export const PRICES = { bell: 800, pump: 3000, lock: 2900 };

export function total(items) {
  return items.reduce((sum, item) => sum + PRICES[item], 0);
}

export function formatPrice(cents) {
  return (cents / 100).toFixed(2);
}
EOF
cat > prices.test.js <<'EOF'
import { test } from "node:test";
import assert from "node:assert/strict";
import { total, formatPrice } from "./prices.js";

test("adds up a basket", () => {
  assert.equal(total(["bell", "pump"]), 3800);
});

test("shows a price with two decimals", () => {
  assert.equal(formatPrice(2900), "29.00");
});
EOF
git add . && git commit -qm "Add the price list and its tests"
gh repo create shop --public --source=. --push
mkdir -p .github/workflows
cat > .github/workflows/ci.yml <<'EOF'
name: CI

on:
  push:
    branches: [main]

jobs:
  syntax:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: node --check prices.js

  test:
    needs: sytnax
    run-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - name: Run the tests
      - run: npm test
EOF
git add . && git commit -qm "Add CI"
git push -q
```

</details>

*This example raises an error on purpose.*

```bash
gh run list
gh run view 22417304019
actionlint
```

Each problem has a file, line and column, a message, and the rule in brackets. actionlint also checks expressions, the inputs of popular actions and, when it's installed, your shell scripts with [ShellCheck](https://www.shellcheck.net). The sandbox's actionlint checks the structure of the file only.

## Try it on your own computer

- Run `actionlint` before every push of a workflow change, or let your editor's GitHub Actions extension highlight errors as you type.
- To debug a failing workflow, add a step `- run: echo '${{ toJSON(github) }}'` to print a whole context, or re-run with debug logging: `gh run rerun <ID> --debug`.
- GitHub's docs list every context property and function: [Contexts](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts) and [Expressions](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions).

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Run jobs in order | needs: <job> | the workflow file | remove needs |
| Test on several versions | strategy: matrix: node: [22, 24, 26] | the workflow file | remove the matrix |
| Run a step only on main | if: github.ref == 'refs/heads/main' | the workflow file | remove the if |
| Pass a value to later steps | echo "name=value" >> "$GITHUB_OUTPUT" | the step's outputs | — |
| Check workflow files | actionlint | nothing | — |

## Common mistakes

- Writing `node-version: matrix.node` without `${{ }}`.
- Using double quotes for strings in expressions: they need single quotes.
- Expecting `if: failure()` steps to run in a different job: status functions look at the current job (and its needs).
- Setting a variable with `export` in one step and expecting it in the next; use `$GITHUB_ENV`.
- Using the deprecated `::set-output` command instead of `$GITHUB_OUTPUT`.

## Exercises

### 1. Test on three Node.js versions

Change the `test` job in `~/shop/.github/workflows/ci.yml` to use a matrix, so it runs on Node.js 22, 24 and 26, with the version passed to `actions/setup-node` from the matrix. Commit, push, and check that all three jobs passed.

<details>
<summary>The sandbox starts this exercise with these commands (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
cat > package.json <<'EOF'
{
  "name": "shop",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
EOF
cat > prices.js <<'EOF'
// Prices are in cents: 800 means 8.00.
export const PRICES = { bell: 800, pump: 3000, lock: 2900 };

export function total(items) {
  return items.reduce((sum, item) => sum + PRICES[item], 0);
}

export function formatPrice(cents) {
  return (cents / 100).toFixed(2);
}
EOF
cat > prices.test.js <<'EOF'
import { test } from "node:test";
import assert from "node:assert/strict";
import { total, formatPrice } from "./prices.js";

test("adds up a basket", () => {
  assert.equal(total(["bell", "pump"]), 3800);
});

test("shows a price with two decimals", () => {
  assert.equal(formatPrice(2900), "29.00");
});
EOF
mkdir -p .github/workflows
cat > .github/workflows/ci.yml <<'EOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - run: npm test
EOF
git add . && git commit -qm "Add the price list and its tests"
gh repo create shop --public --source=. --push
```

</details>

Starter:

```bash
cat .github/workflows/ci.yml
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** one job definition, three runs of it with different values.
2. **Examples:** the lesson's matrix example.
3. **Brute force:** three copies of the job, `test-22`, `test-24`, `test-26`: works, and drifts apart the first time someone edits only one.
4. **Pattern:** **matrix for variations of the same job**.
5. **Plan:** add `strategy.matrix` → use `${{ matrix.node }}` → actionlint → commit → push.
6. **Code and test:** `gh run view <ID>` lists `test (22)`, `test (24)` and `test (26)`, all `✓`.

</details>

<details>
<summary>💡 Hint 1</summary>

The matrix goes under the job: `strategy:` then `matrix:` then `node: [22, 24, 26]`, indented one level each.

</details>

<details>
<summary>💡 Hint 2</summary>

Replace `node-version: 24` with `node-version: ${{ matrix.node }}`.

</details>

<details>
<summary>💡 Hint 3</summary>

Check the file with `actionlint`, then commit, push, and `gh run view <ID>`: you should see three jobs.

</details>

### 2. Fix the broken workflow

The CI workflow in `~/shop` was pushed with mistakes in it, and its run failed before any job started. Use `actionlint` to find every problem, fix `ci.yml` so it keeps both jobs (`syntax`, then `test` after it), and push. The new run must pass, with both jobs.

<details>
<summary>The sandbox starts this exercise with these commands (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
cat > package.json <<'EOF'
{
  "name": "shop",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
EOF
cat > prices.js <<'EOF'
// Prices are in cents: 800 means 8.00.
export const PRICES = { bell: 800, pump: 3000, lock: 2900 };

export function total(items) {
  return items.reduce((sum, item) => sum + PRICES[item], 0);
}

export function formatPrice(cents) {
  return (cents / 100).toFixed(2);
}
EOF
cat > prices.test.js <<'EOF'
import { test } from "node:test";
import assert from "node:assert/strict";
import { total, formatPrice } from "./prices.js";

test("adds up a basket", () => {
  assert.equal(total(["bell", "pump"]), 3800);
});

test("shows a price with two decimals", () => {
  assert.equal(formatPrice(2900), "29.00");
});
EOF
git add . && git commit -qm "Add the price list and its tests"
gh repo create shop --public --source=. --push
mkdir -p .github/workflows
cat > .github/workflows/ci.yml <<'EOF'
name: CI

on:
  push:
    branches: [main]

jobs:
  syntax:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: node --check prices.js

  test:
    needs: sytnax
    run-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - name: Run the tests
      - run: npm test
EOF
git add . && git commit -qm "Add CI"
git push -q
```

</details>

Starter:

```bash
actionlint
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** GitHub can't run a file it can't read; actionlint reads it the same way, on your machine.
2. **Examples:** "unexpected key "run-on"" means a misspelt key; "needs job which does not exist" means a misspelt job ID.
3. **Brute force:** pushing guesses and waiting for each run to fail.
4. **Pattern:** **lint locally until clean, then push**.
5. **Plan:** actionlint → fix each line → actionlint (nothing printed) → commit → push.
6. **Code and test:** `gh run list` shows `✓ … CI` on top.

</details>

<details>
<summary>💡 Hint 1</summary>

`actionlint` lists four problems; two of them (missing `runs-on` and the unexpected `run-on`) have the same cause.

</details>

<details>
<summary>💡 Hint 2</summary>

`needs:` must name a job that exists (`syntax`), the key is `runs-on`, and a step must have `run:` or `uses:`: a lone `- name:` line is a step with neither.

</details>

<details>
<summary>💡 Hint 3</summary>

Either edit the lines with `sed` (`sed -i "/- name: Run the tests/d" file` deletes the matching line) or write the file again with a heredoc. Run `actionlint` until it prints nothing, then commit and push.

</details>

**In the sandbox:** exercises 29–30. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Test on three Node.js versions</summary>

```bash
cat > .github/workflows/ci.yml <<'EOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    strategy:
      matrix:
        node: [22, 24, 26]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ matrix.node }}
      - run: npm test
EOF
actionlint
git commit -am "Test on Node.js 22, 24 and 26"
git push
gh run list
gh run view 22417308038
```

**Line by line**

- `strategy: matrix: node: [22, 24, 26]` defines three combinations.
- `${{ matrix.node }}` is replaced per job, so each job installs a different version.

**Trace:** the setup-node logs show `node: v22.23.3`, `node: v24.21.0` and `node: v26.11.1`.

**Common wrong approach:** writing `node-version: matrix.node` without `${{ }}`: setup-node receives the text `matrix.node` and fails with `Unable to find Node version 'matrix.node'`.

</details>

<details>
<summary>✅ 2. Fix the broken workflow</summary>

```bash
actionlint
sed -i "s/needs: sytnax/needs: syntax/; s/run-on:/runs-on:/" .github/workflows/ci.yml
sed -i "/- name: Run the tests/d" .github/workflows/ci.yml
actionlint
git commit -am "Fix the CI workflow"
git push
gh run list
```

**Line by line**

- `needs: sytnax` → `needs: syntax`, and `run-on` → `runs-on` fix three of the reports.
- The stray `- name: Run the tests` was meant to label the next step; deleting it (or merging it into the `run:` step as `name:`) fixes the last one.

**Trace:** the second `actionlint` prints nothing; the new run has jobs `syntax` and `test`, both `✓`.

**Common wrong approach:** writing `- name: Run the tests` and `run: npm test` as two list items: the dash starts a new step each time. Put `name:` and `run:` in the same item.

</details>

## Quick quiz

1. Two jobs have no needs:. How do they run?
   - A) In parallel, each on its own fresh runner
   - B) One after the other, in file order
   - C) On the same runner, sharing files
   - D) Only the first one runs

2. A step has if: github.ref == 'refs/heads/main'. When does it run?
   - A) On main, and only if the steps before it succeeded
   - B) On main, even after an earlier step failed
   - C) On every branch
   - D) Never; if: needs ${{ }}

3. How does a step hand a value to a later step in the same job?
   - A) echo "name=value" >> "$GITHUB_OUTPUT", read as ${{ steps.<id>.outputs.name }}
   - B) export name=value
   - C) By writing it to the workflow file
   - D) set-output name=value

4. A matrix has os: [ubuntu-latest, windows-latest] and node: [22, 24, 26]. How many jobs run?
   - A) 6
   - B) 5
   - C) 3
   - D) 2

<details>
<summary>Quiz answers</summary>

1. **A) In parallel, each on its own fresh runner**: Jobs are independent unless needs: links them; each gets a separate runner.
2. **A) On main, and only if the steps before it succeeded**: Without a status function, if: is treated as success() && (…). Use always() or failure() to run after failures.
3. **A) echo "name=value" >> "$GITHUB_OUTPUT", read as ${{ steps.<id>.outputs.name }}**: Each step is a separate shell; files like $GITHUB_OUTPUT and $GITHUB_ENV carry values between steps.
4. **A) 6**: A matrix runs every combination: 2 × 3 = 6, unless exclude: removes some.

</details>

---
Previous: [Lesson 14](14-failing-builds.md) · Next: [Lesson 16: Secrets, permissions and safe workflows](16-secrets-security.md)
