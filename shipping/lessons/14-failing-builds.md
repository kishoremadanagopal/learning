# Lesson 14: When the build fails

**You'll learn:** reading a failed run (gh run view, annotations, --log-failed), the test runner's failure report, reproducing failures locally, fixing forward and reverting, never rewriting shared history, re-running runs and failed jobs, flaky tests, choosing events (push, pull_request, branches, branches-ignore, tags, paths), filter patterns, the merge commit a pull request run tests, gh pr checks, required status checks in rulesets, strict checks, status badges, notifications.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#failing-builds)**: run every example and check your exercise answers.

## Key terms

- **Red / green build:** a failed / passed run.
- **Annotation:** a message attached to a run, such as an error from a step.
- **Fix forward:** correcting a failure with a new commit.
- **Flaky test:** a test that passes or fails on the same code by chance.
- **Trigger:** the event (with filters) that starts a workflow, set in `on:`.
- **Check:** the result of one job on a commit, shown on pull requests.
- **Required status check:** a check that must pass before a branch can be merged into (or pushed to) a protected branch.
- **Merge ref:** `refs/pull/N/merge`, the test merge of a pull request into its base that `pull_request` runs test.

A pipeline earns its keep on the day it says **no**. A red run means a change broke something, and that the break was caught minutes after the push instead of by a customer. This lesson is about reading that "no" quickly and fixing it calmly.

## A red run

Someone "tidied up" `formatPrice` and pushed. The run failed:

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
sed -i "s#cents / 100#cents / 10#" prices.js
git commit -qam "Tidy up formatPrice"
git push -q
```

</details>

```bash
gh run list
gh run view 22417308038
```

`gh run view` lists every step of a failed job: `X Run npm test` is where it broke. **Annotations** are messages attached to the run; `Process completed with exit code 1` is the runner reporting that a step's command exited with status 1. To see *why*, read the failed step's log:

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
sed -i "s#cents / 100#cents / 10#" prices.js
git commit -qam "Tidy up formatPrice"
git push -q
```

</details>

```bash
gh run view 22417308038 --log-failed | cut -f3- | cut -c30-
```

`--log-failed` prints only the failed steps; `cut` trims the job, step and time columns so the text is easier to read here. The test runner's report ends with **failing tests**: which test (`shows a price with two decimals`), where (`test at prices.test.js:9:1`), and how: `actual` `'290.00'`, `expected` `'29.00'`. The price is ten times too big: the "tidy-up" divides by 10 instead of 100.

## Fix forward, or revert

First, reproduce the failure on your own machine; it's much faster than pushing guesses:

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
sed -i "s#cents / 100#cents / 10#" prices.js
git commit -qam "Tidy up formatPrice"
git push -q
```

</details>

```bash
npm test 2>&1 | grep -A 4 "failing tests"
git log -p -1 prices.js
```

Then pick one of two ways back to green:

- **Fix forward:** make a new commit that corrects the code. Best when the fix is small and obvious, like this one.
- **Revert:** `git revert <commit>` undoes the bad commit with a new one (Part 1). Best when the fix isn't obvious and `main` must be green *now*; you can redo the change properly afterwards.

Either way, **fix the code, not the test**, unless the test itself is wrong. Never rewrite `main`'s history to hide a red run: the commit is already shared.

## Re-running and flaky tests

`gh run rerun <ID>` runs a workflow again on the same commit; `--failed` re-runs only the failed jobs. That's right when something outside your code failed: a network hiccup while downloading, a service that was briefly down. A test that passes or fails on the same code depending on luck (timing, test order, the current date) is **flaky**. Re-running hides the problem and teaches the team to ignore red runs; fix or quarantine flaky tests instead.

## Choosing when workflows run

The `on:` section decides which events start a workflow:

| `on:` | Runs when |
|---|---|
| `push` | anything is pushed, to any branch or tag |
| `push: branches: [main]` | `main` is pushed |
| `push: branches-ignore: ['docs/**']` | any branch except those matching |
| `push: tags: ['v*']` | a tag like `v1.2.0` is pushed |
| `pull_request` | a pull request is opened, updated with new commits, or reopened |
| `pull_request: branches: [main]` | ...for pull requests *into* `main` |
| `push: paths: ['src/**']` | a push changes at least one matching file |

Patterns use `*` (any characters except `/`), `**` (anything, including `/`) and `!` to exclude. For a pull request, GitHub tests a **merge commit** of the branch into its base (`refs/pull/1/merge`): what `main` *would* look like after merging, not just the branch on its own.

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
git switch -c add-helmets
sed -i "s/lock: 2900 }/lock: 2900, helmet: 4500 }/" prices.js
git commit -qam "Add helmets"
git push -q -u origin add-helmets
gh pr create --title "Add helmets" --body "We now sell helmets."
gh pr checks
```

`ci.yml` already has `pull_request:` in its `on:` section, so opening the pull request started a run. `gh pr checks` lists the **checks** on a pull request: one per job, named `workflow/job (event)`.

## Status checks that keep main green

A failing check is only advice until a rule makes it binding. A **required status check** in a ruleset (Part 2) blocks merging, and direct pushes, until the named check has passed on the latest commit:

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

*This example raises an error on purpose.*

```bash
cat > rules.json <<'EOF'
{
  "name": "Tests must pass",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [ { "context": "test" } ]
      }
    }
  ]
}
EOF
gh api repos/{owner}/{repo}/rulesets --input rules.json --jq .name
echo "## Opening hours: 9 to 5" >> README.md
git commit -qam "Add opening hours"
git push
```

The check is named after the **job** (`test`), so renaming a job silently breaks a required check: keep job names stable. On GitHub's website the same rule is under **Settings → Rules → Rulesets**. With **strict** set to `true`, a branch must also be up to date with `main` before it can merge, so the tests ran against the latest `main`.

## Try it on your own computer

- Add a **status badge** to your README: `![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)` shows green or red for the latest run on the default branch.
- `gh run watch <ID> --exit-status` waits for a run and exits non-zero if it failed: handy in scripts. `gh run view <ID> --web` opens the run in your browser.
- GitHub emails you when a workflow you triggered fails; change that under **Settings → Notifications → System → Actions**.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| See why a run failed | gh run view <ID> --log-failed | nothing | — |
| Run a workflow again | gh run rerun <ID> --failed | a new attempt of the run | — |
| Undo the commit that broke main | git revert <commit>; git push | adds a commit | git revert the revert |
| Test pull requests | on: pull_request in the workflow | the workflow file | remove the trigger |
| See a pull request's checks | gh pr checks | nothing | — |
| Require tests to pass | a ruleset with required_status_checks | repository rules | delete or disable the ruleset |

## Common mistakes

- Changing the test's expected value to make a real bug pass.
- Re-running a red run until it's green instead of fixing a flaky test.
- Force-pushing over a broken commit on a shared branch.
- Renaming a job that a ruleset requires as a status check, which blocks every pull request.
- Using `branches:` on `pull_request` and expecting it to match the head branch: it matches the base.

## Exercises

### 1. Fix the failing build

`main` is red on GitHub: the latest run of `CI` failed. Find out which test fails and why, fix the bug **in `prices.js`** (not in the test), commit, and push, so that the newest run on `main` passes. Don't rewrite history: the broken commit stays, followed by your fix.

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
sed -i "s#cents / 100#cents / 10#" prices.js
git commit -qam "Tidy up formatPrice"
git push -q
```

</details>

Starter:

```bash
gh run list
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** the run tells you which test failed; the code tells you why.
2. **Examples:** expected `'29.00'`, got `'290.00'`: off by a factor of 10.
3. **Brute force:** changing the test to expect `'290.00'` makes CI green and the shop wrong.
4. **Pattern:** **reproduce locally, fix the cause, push, watch the run**.
5. **Plan:** read `--log-failed` → `npm test` → `git show HEAD` → fix → `npm test` → commit → push.
6. **Code and test:** `npm test` shows two `✔`, and `gh run list` shows a new `✓` run on top.

</details>

<details>
<summary>💡 Hint 1</summary>

`gh run view <ID> --log-failed` shows the failed step's output: the failing test, and its actual and expected values.

</details>

<details>
<summary>💡 Hint 2</summary>

`npm test` shows the same failure locally, and `git show HEAD` shows what the last commit changed in `prices.js`.

</details>

<details>
<summary>💡 Hint 3</summary>

Change `cents / 10` back to `cents / 100` (`sed -i "s#cents / 10)#cents / 100)#" prices.js`), run `npm test`, then commit and push. (`git revert HEAD` followed by `git push` also works.)

</details>

### 2. Checks on a pull request

Add helmets to the shop through a pull request: on a new branch `add-helmets`, add `helmet: 4500` to `PRICES` in `prices.js` and add a test to `prices.test.js` that checks `total(["helmet"])` is `4500`. Commit, push the branch, and open a pull request titled `Add helmets`. Its checks must pass.

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
cat prices.js
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** opening a pull request is an event; ci.yml's `pull_request:` trigger tests the merge result.
2. **Examples:** the lesson's helmet example, plus a test for it.
3. **Brute force:** pushing straight to `main` skips review and tests the change only after it's already on `main`.
4. **Pattern:** **branch → change + test → push → pull request → checks**.
5. **Plan:** switch -c → edit both files → npm test → commit → push -u → gh pr create → gh pr checks.
6. **Code and test:** `gh pr checks` says `All checks were successful`.

</details>

<details>
<summary>💡 Hint 1</summary>

`git switch -c add-helmets` first, so the commit goes on the new branch, not on `main`.

</details>

<details>
<summary>💡 Hint 2</summary>

`sed -i "s/lock: 2900 }/lock: 2900, helmet: 4500 }/" prices.js` adds the price; append a new `test(…)` block to `prices.test.js` with `cat >> prices.test.js <<'EOF'`.

</details>

<details>
<summary>💡 Hint 3</summary>

Run `npm test` (three tests), commit, `git push -u origin add-helmets`, then `gh pr create --title "Add helmets" --body "…"` and `gh pr checks`.

</details>

**In the sandbox:** exercises 27–28. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Fix the failing build</summary>

```bash
gh run list
gh run view 22417308038 --log-failed | grep -A 6 "failing tests"
npm test 2>&1 | grep -A 4 "failing tests"
git show HEAD --stat
sed -i "s#cents / 10)#cents / 100)#" prices.js
npm test
git commit -am "Fix formatPrice: divide cents by 100"
git push
gh run list
```

**Line by line**

- `--log-failed` narrows the log to the failed step; the report names the test and the values.
- `git show HEAD --stat` points at the commit that touched `prices.js`.
- The `sed` puts back the division by 100; `npm test` confirms before anything is pushed.

**Trace:** `gh run list` shows your fix (`✓`) above `X Tidy up formatPrice`.

**Common wrong approach:** `git reset --hard HEAD~1` and `git push --force`: it erases a shared commit (and with a ruleset, the push is rejected). Fix forward or revert instead.

</details>

<details>
<summary>✅ 2. Checks on a pull request</summary>

```bash
git switch -c add-helmets
sed -i "s/lock: 2900 }/lock: 2900, helmet: 4500 }/" prices.js
cat >> prices.test.js <<'EOF'

test("knows the price of a helmet", () => {
  assert.equal(total(["helmet"]), 4500);
});
EOF
npm test
git commit -am "Add helmets"
git push -u origin add-helmets
gh pr create --title "Add helmets" --body "We now sell helmets."
gh pr checks
```

**Line by line**

- The `sed` adds the price inside the `PRICES` object; the heredoc appends a third test.
- `git push -u` publishes the branch; `gh pr create` opens the pull request, which starts the `pull_request` run.
- `gh pr checks` shows `✓  CI/test (pull_request)`.

**Trace:** `npm test` shows three `✔` lines before anything is pushed.

**Common wrong approach:** committing on `main`, then creating the branch: the pull request has nothing to merge, and `main` is ahead of GitHub.

</details>

## Quick quiz

1. A run failed. Which command shows only the output of the failed steps?
   - A) gh run view <ID> --log-failed
   - B) gh run list --failed
   - C) gh run rerun <ID>
   - D) git log --failed

2. A test fails because of a real bug. What should you change?
   - A) The code, so the test passes for the right reason
   - B) The test's expected value, so CI is green
   - C) The workflow, so it skips that test
   - D) Nothing: re-run until it passes

3. Which code does a pull_request run test?
   - A) A merge commit of the branch into its base branch
   - B) Only the branch's latest commit, ignoring main
   - C) The base branch only
   - D) The commit that opened the repository

4. A required status check names "test". What happens if you rename the job to unit-tests?
   - A) The required check never reports, so pull requests can't merge until the rule is updated
   - B) GitHub renames the rule automatically
   - C) The rule now checks unit-tests
   - D) Nothing; checks are matched by workflow file name

<details>
<summary>Quiz answers</summary>

1. **A) gh run view <ID> --log-failed**: --log-failed prints the logs of failed steps; --log prints everything.
2. **A) The code, so the test passes for the right reason**: The test caught a bug; changing it would hide the bug from CI and from users.
3. **A) A merge commit of the branch into its base branch**: GitHub tests what the base branch would look like after merging (refs/pull/N/merge).
4. **A) The required check never reports, so pull requests can't merge until the rule is updated**: Checks are matched by job name; keep job names stable or update the ruleset with them.

</details>

---
Previous: [Lesson 13](13-ci-cd.md) · Next: [Lesson 15: Jobs, matrices and expressions](15-workflow-syntax.md)
