# Lesson 18: Fast, reusable pipelines

**You'll learn:** why speed matters, caching with actions/cache, keys, restore keys and hashFiles, setup-node's npm cache, cache scope, size and expiry, path filters and required checks, concurrency with cancel-in-progress, timeout-minutes, reusable workflows (workflow_call, inputs, secrets), composite actions, sharing from an organisation repository, scheduled workflows (cron fields, UTC, the timezone key, limits, the 60-day rule), what Actions costs in 2026 (included minutes, per-minute prices, larger runners), self-hosted runners and their risks, other CI systems, CI for analysts and AI engineers (SQL tests, notebooks, data contracts, evaluation gates).

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#pipelines)**: run every example and check your exercise answers.

## Key terms

- **Cache:** saved files restored into later jobs, looked up by a key.
- **Cache key:** the name a cache is saved under, usually including a hash of the files it depends on.
- **`hashFiles()`:** an expression function that returns a fingerprint of matching files.
- **Path filter:** `paths` or `paths-ignore` in a trigger, which skips runs that don't touch matching files.
- **Reusable workflow:** a workflow triggered by `workflow_call`, used as a job by other workflows.
- **Composite action:** an action made of steps, defined in an `action.yml`.
- **Cron:** a five-field schedule format: minute, hour, day of month, month, day of week.
- **Self-hosted runner:** your own machine running GitHub's runner program.
- **Evaluation gate:** a CI step that fails when a model's quality score drops below a threshold.

A pipeline people wait ten minutes for gets skipped; one that's copied into twenty repositories drifts apart. This lesson makes pipelines fast, cheap and shared, and looks beyond GitHub Actions.

## Caching

Every job starts on a fresh runner, so everything is downloaded and installed again: often most of a pipeline's time. A **cache** saves a folder at the end of a job and restores it at the start of later ones, looked up by a **key**:

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
cat > .github/workflows/cache-demo.yml <<'EOF'
name: Cache demo

on: push

jobs:
  work:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - id: cache
        uses: actions/cache@v6
        with:
          path: .cache
          key: prices-${{ hashFiles('prices.js') }}
      - if: steps.cache.outputs.cache-hit != 'true'
        run: mkdir -p .cache && echo "slow result" > .cache/result.txt
      - run: cat .cache/result.txt
EOF
git add . && git commit -qm "Cache a slow step"
git push -q
echo "More notes" >> README.md
git commit -qam "Update the README"
git push -q
gh run list --workflow cache-demo.yml
gh run view 22417308038 --log | grep "Cache " | cut -f2,3 | cut -c1-110
gh run view 22417316076 --log | grep "Cache " | cut -f2,3 | cut -c1-110
```

- `hashFiles('prices.js')` is a fingerprint of the file: the key changes exactly when the file does, so a stale cache is never used.
- The first run says **Cache not found** and saves the folder in a **Post** step; the second run, with the same `prices.js`, restores it and skips the slow step.
- For npm projects, `actions/setup-node` caches npm's downloads itself with `cache: npm` (it needs a `package-lock.json`), and turns this on automatically when `package.json` says `"packageManager": "npm@…"`.
- Caches belong to a branch (branches can also read `main`'s), a repository keeps up to 10 GB by default, and entries unused for 7 days are deleted.

## Running less

- **Path filters** skip runs that can't matter: `paths-ignore: ['**.md', 'docs/**']` for documentation-only changes. (Careful with required checks: a skipped workflow never reports, which blocks the merge. Keep required workflows unfiltered, or filter inside a job with `if:`.)
- **Concurrency** with `cancel-in-progress: true` and `group: ${{ github.workflow }}-${{ github.ref }}` cancels a branch's older runs when you push again.
- **`timeout-minutes:`** on a job (the default is 360, six hours) stops a stuck job from burning minutes.

## Reusable workflows and composite actions

Copy-pasted pipelines drift. Two ways to share:

- A **reusable workflow** (`on: workflow_call`) is a whole workflow other workflows call as a job, with inputs and secrets. Its jobs show up as `caller / callee`.
- A **composite action** (an `action.yml` with `runs: using: composite`) bundles steps that other jobs use with `uses:`, like `actions/checkout`.

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
cat > .github/workflows/test.yml <<'EOF'
name: Test

on:
  workflow_call:
    inputs:
      node-version:
        type: string
        default: "24"

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ inputs.node-version }}
      - run: npm test
EOF
cat > .github/workflows/ci.yml <<'EOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  tests:
    uses: ./.github/workflows/test.yml
    with:
      node-version: "24"
EOF
git add . && git commit -qm "Share the test job"
git push -q
gh run view 22417308038
```

Use reusable workflows to share whole pipelines (often from a central `.github` repository for a whole organisation, as `uses: my-org/ci/.github/workflows/test.yml@v1`), and composite actions to share a few steps.

## Scheduled workflows

`on: schedule` runs a workflow on a **cron** schedule: five fields, minute, hour, day of month, month and day of week:

```yaml
on:
  schedule:
    - cron: "30 2 * * *"            # every day at 02:30 UTC
    - cron: "0 9 * * MON-FRI"       # weekdays at 09:00…
      timezone: "Europe/London"     # …London time (the timezone key arrived in March 2026)
  workflow_dispatch:                # and a button, to test it without waiting
```

Schedules run in **UTC** unless you give a `timezone`. The shortest interval is every 5 minutes, runs can be delayed when GitHub is busy (avoid the top of the hour), and in public repositories scheduled workflows are switched off after 60 days without activity. Typical jobs: nightly tests against the newest dependencies, data refreshes, broken-link checks, cleanup.

## What it costs

- Standard GitHub-hosted runners are **free in public repositories**.
- Private repositories get included minutes each month (2,000 on Free, 3,000 on Pro and Team, 50,000 on Enterprise Cloud); after that you pay per minute. From 1 January 2026 GitHub cut hosted runner prices by up to 39%: a standard 2-core Linux runner now costs $0.006 a minute, and Windows and macOS runners cost more.
- **Larger runners** (more CPUs, GPUs, ARM) cost more per minute but can finish sooner.
- **Self-hosted runners** are your own machines running GitHub's runner program: useful for special hardware or private networks. Never use them for public repositories, where anyone's pull request could run code on your machine. A planned per-minute platform charge for self-hosted runners, announced for March 2026, was postponed.

## CI beyond GitHub, and for data and AI work

**GitLab CI/CD** (`.gitlab-ci.yml`), **Jenkins**, **CircleCI**, **Azure Pipelines** and **Buildkite** use different file formats for the same ideas: events, jobs, steps, runners, caches, artifacts, secrets and environments. What you learned here transfers almost one to one.

Pipelines aren't only for application code:

- **Analysts** test SQL against a small sample database, check that notebooks still run from top to bottom, and validate data against a contract (expected columns, no unexpected nulls) before a dashboard refreshes.
- **AI engineers** run an evaluation set on every pull request that changes a prompt or model, fail the run if a quality score drops below a threshold, keep model API keys in secrets, cap spending per run, and schedule larger evaluations nightly.

## Try it on your own computer

- The **Actions → Caches** page of a repository lists its caches; `gh cache list` and `gh cache delete` manage them.
- The billing page (**Settings → Billing**) shows minutes used per workflow; it's worth a look before a bill arrives.
- [act](https://github.com/nektos/act) (0.2.89) runs your workflows locally in Docker containers, which is fast for trying out workflow changes; it needs Docker (Part 4).

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Cache a folder | actions/cache with path and key: ${{ hashFiles(…) }} | the repository's caches | gh cache delete <key> |
| Skip docs-only changes | paths-ignore: ['**.md'] | the workflow file | remove the filter |
| Cancel outdated runs | concurrency: group + cancel-in-progress: true | the workflow file | remove concurrency |
| Share a job | on: workflow_call, then uses: ./.github/workflows/x.yml | workflow files | inline the job again |
| Run on a schedule | on: schedule: - cron: "30 2 * * *" | the workflow file | gh workflow disable <name> |

## Common mistakes

- Using a fixed cache key, so stale dependencies are restored forever.
- Filtering a workflow by path when its job is a required check, which then never reports.
- Forgetting that schedules run in UTC unless a timezone is given.
- Copy-pasting the same jobs into many workflows instead of sharing them.
- Using self-hosted runners for public repositories.

## Exercises

### 1. Share the test job

Turn the shop's test job into a reusable workflow. Create `.github/workflows/test.yml`, triggered by `workflow_call` with a string input `node-version` (default `"24"`), containing a `test` job that checks out, sets up that Node.js version and runs `npm test`. Then change `ci.yml` so its only job, `tests`, calls `./.github/workflows/test.yml` with `node-version: "24"`. Push; the CI run must pass, with the job `tests / test`.

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

1. **Understand:** the steps move to a workflow that only runs when called; CI calls it.
2. **Examples:** the lesson's example is this exercise.
3. **Brute force:** copying the test job into every workflow that needs it.
4. **Pattern:** **one definition, many callers**: reusable workflows for jobs, composite actions for steps.
5. **Plan:** write test.yml → replace ci.yml's job with a `uses:` job → actionlint → commit → push.
6. **Code and test:** `gh run view <ID>` lists `✓ tests / test`.

</details>

<details>
<summary>💡 Hint 1</summary>

A reusable workflow's `on:` is `workflow_call:` with `inputs:`, each with a `type` (`string`, `number` or `boolean`) and optionally a `default`.

</details>

<details>
<summary>💡 Hint 2</summary>

Inside test.yml the value is `${{ inputs.node-version }}`.

</details>

<details>
<summary>💡 Hint 3</summary>

In ci.yml, the calling job has no `runs-on` or `steps`: just `uses: ./.github/workflows/test.yml` and `with: node-version: "24"`.

</details>

### 2. Skip CI for documentation changes

README edits don't need the tests. Change `ci.yml` so that pushes and pull requests that only change Markdown files (`**.md`) don't start it. Push that change (it changes `ci.yml`, so it runs), then edit `README.md`, commit and push again: that second push must not start a CI run.

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

1. **Understand:** GitHub compares the files a push changed with the patterns before starting the workflow.
2. **Examples:** `**.md` matches `README.md` and `docs/guide.md`.
3. **Brute force:** adding `[skip ci]` to commit messages (GitHub supports it): it works, but people forget, and it skips code changes too if they share a commit.
4. **Pattern:** **filter on paths in the trigger**.
5. **Plan:** add paths-ignore to both events → push → edit README → push → gh run list.
6. **Code and test:** the newest commit (README only) has no row in `gh run list`; the one before has `✓`.

</details>

<details>
<summary>💡 Hint 1</summary>

`paths-ignore:` goes under each event, next to `branches:` for push: `paths-ignore: ['**.md']`. (`pull_request:` then needs a nested map instead of being empty.)

</details>

<details>
<summary>💡 Hint 2</summary>

Push the workflow change first: it changes `ci.yml`, which isn't Markdown, so it runs.

</details>

<details>
<summary>💡 Hint 3</summary>

Then `echo "…" >> README.md`, commit and push. `gh run list` should show no new CI run for it.

</details>

**In the sandbox:** exercises 35–36. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Share the test job</summary>

```bash
cat > .github/workflows/test.yml <<'EOF'
name: Test

on:
  workflow_call:
    inputs:
      node-version:
        type: string
        default: "24"

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ inputs.node-version }}
      - run: npm test
EOF
cat > .github/workflows/ci.yml <<'EOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  tests:
    uses: ./.github/workflows/test.yml
    with:
      node-version: "24"
EOF
actionlint
git add .github/workflows
git commit -m "Share the test job"
git push
gh run view 22417308038
```

**Line by line**

- `on: workflow_call` means nothing triggers test.yml by itself; it only runs when another workflow calls it.
- `uses: ./.github/workflows/test.yml` at job level (not step level) calls it, from the same commit.
- The job name `tests / test` is caller job / called job.

**Trace:** the run's `setup-node` log shows `node-version: 24`, passed through the input.

**Common wrong approach:** putting `uses: ./.github/workflows/test.yml` under `steps:`: steps can only use actions, so actionlint and GitHub reject it.

</details>

<details>
<summary>✅ 2. Skip CI for documentation changes</summary>

```bash
cat > .github/workflows/ci.yml <<'EOF'
name: CI

on:
  push:
    branches: [main]
    paths-ignore: ['**.md']
  pull_request:
    paths-ignore: ['**.md']

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
git commit -am "Skip CI for documentation-only changes"
git push
echo "Open 9 to 5, Monday to Saturday." >> README.md
git commit -am "Add opening hours to the README"
git push
gh run list
```

**Line by line**

- `paths-ignore: ['**.md']` skips a push or pull request when *every* changed file matches.
- The first push changes `ci.yml`, so it runs (and passes); the second changes only `README.md`, so it doesn't.

**Trace:** `gh run list` shows `Skip CI for documentation-only changes` but not `Add opening hours to the README`.

**Common wrong approach:** writing `paths-ignore: '*.md'` with a single `*`: it matches Markdown files in the top folder only, not `docs/guide.md`.

</details>

## Quick quiz

1. What makes a good cache key?
   - A) A fingerprint of the files the cached folder depends on, like hashFiles('package-lock.json')
   - B) The current date
   - C) The run ID
   - D) A fixed string like "cache"

2. When should you use a reusable workflow rather than a composite action?
   - A) To share whole jobs, with their runners, across workflows or repositories
   - B) To share two or three steps inside a job
   - C) Never; they are the same thing
   - D) Only for scheduled workflows

3. A schedule says cron: "0 9 * * *" with no timezone. When does it run?
   - A) Every day at 09:00 UTC, possibly a little later when GitHub is busy
   - B) Every day at 09:00 in the repository owner's timezone
   - C) Every 9 minutes
   - D) At 09:00 on the 9th of every month

4. Why not use self-hosted runners for a public repository?
   - A) Anyone's pull request could run code on your machine
   - B) Self-hosted runners can't run Linux
   - C) They're more expensive than hosted runners
   - D) Public repositories can't use runners

<details>
<summary>Quiz answers</summary>

1. **A) A fingerprint of the files the cached folder depends on, like hashFiles('package-lock.json')**: When the lockfile changes the key changes, so a stale cache is never restored; a fixed key would restore stale files forever.
2. **A) To share whole jobs, with their runners, across workflows or repositories**: Reusable workflows are called as jobs; composite actions are used as steps.
3. **A) Every day at 09:00 UTC, possibly a little later when GitHub is busy**: Cron schedules run in UTC unless a timezone is given, and scheduled runs can be delayed at busy times.
4. **A) Anyone's pull request could run code on your machine**: Fork pull requests run untrusted code; on a self-hosted runner it would run inside your network.

</details>

---
Previous: [Lesson 17](17-deploying.md) · Back to the [course home](../README.md)
