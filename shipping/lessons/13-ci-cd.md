# Lesson 13: CI/CD and your first workflow

**You'll learn:** what continuous integration, continuous delivery and continuous deployment are, pipelines, why small frequent changes break less (DORA research), the Node.js project (package.json, scripts, prices.js and its tests), npm test and exit statuses, GitHub Actions' building blocks (workflow, event, job, step, runner, action), hosted runner labels and the 2026 image changes, free minutes, YAML maps, lists, block strings and its traps, writing and pushing a first workflow, actions/checkout and actions/setup-node, gh run list and gh run view, reading a run's log, actionlint, act and the VS Code extension.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#ci-cd)**: run every example and check your exercise answers.

## Key terms

- **Continuous integration (CI):** merging small changes often, with every change built and tested automatically.
- **Continuous delivery:** every change that passes is ready to release with one action.
- **Continuous deployment:** every change that passes is released automatically.
- **Pipeline:** the automated sequence of steps (build, test, deploy) a change goes through.
- **Exit status:** the number a command returns when it ends: 0 for success, anything else for failure.
- **Workflow:** an automated process defined in a YAML file in `.github/workflows/`.
- **Event:** something that starts a workflow, such as a push or a pull request.
- **Job:** a set of steps that run in order on one runner.
- **Step:** one shell command (`run:`) or one action (`uses:`) in a job.
- **Runner:** the machine, usually a fresh virtual machine, that runs a job.
- **Action:** a packaged, reusable step, like `actions/checkout`.
- **Run:** one execution of a workflow, with an ID.
- **YAML:** a text format for nested data that uses indentation for structure.

In Parts 1 and 2 every check was manual: you ran the tests (if you remembered), and a reviewer looked at the diff. That works for one person and a few files. With a team, someone forgets, a change that worked on one laptop breaks on another, and releasing becomes a nervous, hand-made event. **CI/CD** hands those checks to a machine that runs them the same way on every change.

## Continuous integration, delivery and deployment

![Four stages from top to bottom: commit (git push), build and test (npm ci, npm test), artifact (a tested build) and deploy (to production). Brackets show that continuous integration covers commit to build and test, continuous delivery reaches the artifact, ready to ship with a person deploying, and continuous deployment covers every stage up to production](../figures/ci-cd-stages.svg)

- **Continuous integration (CI):** everyone merges small changes into `main` often, and every change is automatically built and tested. A failure shows up minutes after the commit that caused it, while it's still fresh in the author's head.
- **Continuous delivery:** every change that passes is packaged and ready to release; releasing is a button press, not a project.
- **Continuous deployment:** every change that passes goes to production automatically, with no button.

The tool that runs these steps is a **pipeline**. Google's long-running DORA research found the same pattern year after year: teams that ship small changes often, with automated checks, deploy more *and* break things less than teams that batch changes into big, rare releases.

## The project: tests you can run

From now on the bike shop's price list is code: `prices.js` exports the prices and two functions, and `prices.test.js` checks them with Node.js's built-in test runner (`node:test`, which you met in the JavaScript course). `package.json` names the project and its **scripts**. You don't need to write JavaScript in this part; you'll read a little.

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
```

</details>

```bash
cat package.json
cat prices.test.js
npm test
echo "exit status: $?"
```

`npm test` runs the `test` script, `node --test`, which finds files named like `*.test.js`. Each `✔` is a passing test; the `ℹ` lines count them. The **exit status** is what CI cares about: `0` means everything passed, anything else means failure. Every CI system in the world works by running commands and checking their exit status.

## GitHub Actions in six words

**GitHub Actions** is the CI/CD system built into GitHub. It's free for public repositories and has a monthly allowance of minutes for private ones (2,000 a month on the Free plan).

![An event, push to main, starts the workflow .github/workflows/ci.yml. Inside it, job test runs on ubuntu-24.04 with the steps checkout, setup-node and npm test; an arrow leads to job deploy, which needs test, with the steps download-artifact, deploy-pages and curl the site. Each job gets a fresh runner and runs its steps in order](../figures/actions-anatomy.svg)

| Word | Meaning |
|---|---|
| **workflow** | an automated process, written in a YAML file in `.github/workflows/` |
| **event** | what starts a workflow: a push, a pull request, a schedule, a button press |
| **job** | a set of steps that run together on one machine; jobs run in parallel unless one `needs` another |
| **step** | one command (`run:`) or one action (`uses:`) |
| **runner** | the machine a job runs on: a fresh virtual machine GitHub starts for each job and throws away after |
| **action** | a reusable step someone has packaged, like `actions/checkout`, which copies your repository onto the runner |

GitHub's hosted runners are named by **labels**: `ubuntu-latest` (Ubuntu 24.04 today; GitHub moves it to Ubuntu 26.04 between 19 October and 19 November 2026), `windows-latest` and `macos-latest` (macOS 26). Linux runners are the cheapest and fastest to start, so most CI uses them.

## Just enough YAML

Workflows are written in **YAML**, a format for nested data that uses indentation instead of brackets:

```yaml
name: CI                   # key: value
on:                        # a key whose value is a nested map, indented below it
  push:
    branches: [main]       # a list, written inline
steps:                     # a list written one item per line, each starting with "- "
  - uses: actions/checkout@v7
  - run: npm test
script: |                  # | keeps the following indented lines as one multi-line string
  echo "one"
  echo "two"
```

Rules that catch everyone at least once:

- Indent with **spaces**, never tabs, and line items up exactly: indentation *is* the structure.
- A value that contains `: ` (colon then space) must be quoted or put in a `|` block: `run: echo "Total: 5"` is a YAML error, `run: 'echo "Total: 5"'` is fine.
- YAML guesses types: `version: 3.10` is the number 3.1. Quote anything that must stay text: `"3.10"`.

## Your first workflow

A workflow file has three parts: a `name`, the events it runs `on`, and its `jobs`. This one tests the shop on every push to `main`:

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
```

</details>

```bash
mkdir -p .github/workflows
cat > .github/workflows/ci.yml <<'EOF'
name: CI

on:
  push:
    branches: [main]

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
git add .github/workflows/ci.yml
git commit -m "Run the tests on every push"
git push -q
gh run list
gh run view 22417304019
```

- `jobs: test:` defines one job with the ID `test`.
- `runs-on: ubuntu-latest` asks for a fresh Linux runner.
- `actions/checkout@v7` copies the pushed commit onto the runner. Without it the runner is empty. `@v7` is the action's version: here, its latest major release.
- `actions/setup-node@v7` with `node-version: 24` installs Node.js 24, the current long-term-support (LTS) version.
- `run: npm test` runs a shell command; if it exits with a non-zero status, the step and the job fail.

The push itself prints nothing about CI: GitHub notices the push and starts the workflow on its own. `gh run list` shows the **run** (one execution of a workflow) with its ID; `gh run view <ID>` shows its jobs. On your own computer a run takes a minute or so; in the sandbox it has already finished, with realistic timings.

## Reading a run's log

Every step writes a log. `gh run view <ID> --log` prints all of it, one line per log line, as *job*, *step*, *time* and *text*:

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
gh run list
gh run view 22417304019 --log | grep "Run npm test"
```

The log starts with **Set up job** (the runner's operating system, image and the permissions of its token), then one section per step, then **Post** steps (clean-up for actions that need it, in reverse order) and **Complete job**. Lines between `##[group]` and `##[endgroup]` are folded on GitHub's website; the folded part of a `run:` step shows the script and the shell that ran it (`bash -e`, which stops at the first failing command).

## Try it on your own computer

- Create a repository with a workflow: everything above works with real GitHub and the `gh` you set up in Part 2. Open the repository's **Actions** tab to watch runs live; `gh run watch` does the same in the terminal.
- [actionlint](https://github.com/rhysd/actionlint) checks workflow files before you push (next lessons use it): `brew install actionlint`, or download a binary from its [releases page](https://github.com/rhysd/actionlint/releases).
- In VS Code, the official **GitHub Actions** extension (by GitHub) validates workflow files as you type and shows runs in the sidebar.
- [act](https://github.com/nektos/act) runs workflows on your own computer, inside Docker containers (Part 4 covers Docker).

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Run the project's tests | npm test | nothing | — |
| Start CI on every push to main | .github/workflows/ci.yml with on: push: branches: [main] | a file in the repository | delete the file, or gh workflow disable CI |
| List recent runs | gh run list | nothing | — |
| See a run's jobs | gh run view <ID> | nothing | — |
| Read a run's log | gh run view <ID> --log | nothing | — |

## Common mistakes

- Saving the workflow outside `.github/workflows/` (for example in `.github/workflow/`), so it never runs.
- Indenting YAML with tabs, or misaligning list items.
- Writing `run: echo "Total: 5"`: a colon followed by a space inside a plain value is a YAML error.
- Forgetting `actions/checkout`, so later steps find an empty folder.
- Expecting `git push` to print the CI result; check with `gh run list`.

## Exercises

### 1. Make npm test work

In `~/shop`, `npm test` fails: `package.json` has no `test` script. Add the script `"test": "node --test"` (keep the name, version and `"type": "module"`), check that `npm test` now runs both tests, and commit `package.json` with the message `Add a test script`.

<details>
<summary>The sandbox starts this exercise with these commands (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
cat > package.json <<'EOF'
{
  "name": "shop",
  "version": "1.0.0",
  "type": "module"
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
```

</details>

Starter:

```bash
npm test
cat package.json
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** npm runs whatever command the `test` script names; there isn't one yet.
2. **Examples:** `npm run` lists a project's scripts; here it prints nothing.
3. **Brute force:** running `node --test` by hand works, but CI and teammates won't know to.
4. **Pattern:** **put the project's commands in package.json scripts**, so everyone (and CI) runs the same thing.
5. **Plan:** rewrite package.json with a scripts object → npm test → commit.
6. **Code and test:** `npm run` now lists `test`, and `npm test` exits with status 0.

</details>

<details>
<summary>💡 Hint 1</summary>

npm reads scripts from a `"scripts"` object in `package.json`: `"scripts": { "test": "node --test" }`.

</details>

<details>
<summary>💡 Hint 2</summary>

The easiest way to edit the file here is to write it again whole, with `cat > package.json <<'EOF'` … `EOF`. Keep the commas between properties: JSON is strict about them.

</details>

<details>
<summary>💡 Hint 3</summary>

Run `npm test` to see two passing tests, then `git commit -am "Add a test script"`.

</details>

### 2. Your first workflow

`~/shop` is on GitHub as `ada/shop`, with no workflows yet. Add `.github/workflows/ci.yml`: a workflow named `CI` that runs on every push to `main`, with one job called `test` on `ubuntu-latest` that checks out the code (`actions/checkout@v7`), sets up Node.js 24 (`actions/setup-node@v7`) and runs `npm test`. Commit it, push, and make sure the run passed.

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
```

</details>

Starter:

```bash
gh run list
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** GitHub runs any workflow in `.github/workflows/` whose events match, on the pushed commit.
2. **Examples:** the lesson's `ci.yml` is exactly this workflow.
3. **Brute force:** running `npm test` yourself before each push: works until the day you forget.
4. **Pattern:** **event → job → steps**: checkout, set up the tools, run the project's own commands.
5. **Plan:** write the file → `actionlint` → commit → push → `gh run list`.
6. **Code and test:** `gh run list` shows `✓` for the run, and `gh run view <ID>` lists the `test` job.

</details>

<details>
<summary>💡 Hint 1</summary>

The file must be at exactly `.github/workflows/ci.yml` (mind the dot and the plural): `mkdir -p .github/workflows` first.

</details>

<details>
<summary>💡 Hint 2</summary>

The structure is `name:`, then `on: push: branches: [main]`, then `jobs: test: runs-on: …` and `steps:`, a list of `- uses:` and `- run:` items. Copy the lesson's example and check it with `actionlint`.

</details>

<details>
<summary>💡 Hint 3</summary>

A workflow only runs once it's on GitHub: `git add`, `git commit` and `git push`, then `gh run list`.

</details>

**In the sandbox:** exercises 25–26. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Make npm test work</summary>

```bash
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
npm test
git commit -am "Add a test script"
```

**Line by line**

- The heredoc writes the whole file again, now with `"scripts": { "test": "node --test" }`.
- `npm test` prints the `> shop@1.0.0 test` banner, then the test runner's results.
- `git commit -am` stages the tracked, changed `package.json` and commits it.

**Trace:** two `✔` lines, then `ℹ pass 2` and `ℹ fail 0`.

**Common wrong approach:** forgetting the comma after `"type": "module"`, which makes the JSON invalid: npm then fails with `EJSONPARSE` before running anything.

</details>

<details>
<summary>✅ 2. Your first workflow</summary>

```bash
mkdir -p .github/workflows
cat > .github/workflows/ci.yml <<'EOF'
name: CI

on:
  push:
    branches: [main]

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
actionlint
git add .github/workflows/ci.yml
git commit -m "Run the tests on every push"
git push
gh run list
```

**Line by line**

- `mkdir -p` and the heredoc create the workflow file in the folder GitHub looks in.
- `actionlint` prints nothing when the file is valid.
- After `git push`, GitHub starts the workflow because the push was to `main`.

**Trace:** `gh run list` shows `✓  Run the tests on every push  CI  main  push`.

**Common wrong approach:** saving the file as `.github/workflow/ci.yml` (no `s`): it's committed and pushed, but GitHub never runs it, and `gh run list` stays empty.

</details>

## Quick quiz

1. Which describes continuous delivery?
   - A) Every change that passes the pipeline is ready to release; releasing is a button press
   - B) Every change goes to production automatically, with no human step
   - C) Developers merge into main once a month
   - D) Tests run only before a release

2. How does a CI system know a command failed?
   - A) The command's exit status isn't 0
   - B) The command printed the word "error"
   - C) The command took longer than a minute
   - D) The log has more than 100 lines

3. Where must a workflow file be for GitHub to run it?
   - A) In .github/workflows/ in the repository, on the branch or commit that's pushed
   - B) Anywhere in the repository, named workflow.yml
   - C) In the repository's settings on GitHub
   - D) In ~/.github on your computer

4. What does actions/checkout do?
   - A) Copies the repository's code onto the runner, so later steps can use it
   - B) Switches your local branch
   - C) Checks the workflow file for errors
   - D) Installs Node.js

<details>
<summary>Quiz answers</summary>

1. **A) Every change that passes the pipeline is ready to release; releasing is a button press**: Continuous deployment goes one step further and releases automatically; delivery keeps a human decision.
2. **A) The command's exit status isn't 0**: Every CI system runs commands and checks their exit status; tools like npm test exit non-zero when a test fails.
3. **A) In .github/workflows/ in the repository, on the branch or commit that's pushed**: GitHub reads workflow files from .github/workflows/ in the commit the event refers to.
4. **A) Copies the repository's code onto the runner, so later steps can use it**: Each job starts on an empty runner; checkout fetches the commit being tested.

</details>

---
Previous: [Lesson 12](12-team-workflows.md) · Next: [Lesson 14: When the build fails](14-failing-builds.md)
