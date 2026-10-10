@@@ part
id: 3
title: CI/CD with GitHub Actions
level: Intermediate
blurb: Letting machines check and ship every change: what continuous integration, delivery and deployment mean, writing GitHub Actions workflows in YAML, reading runs and fixing failed builds, status checks that guard main, jobs, matrices and expressions, secrets and safe workflows, deploying a site with GitHub Pages, and keeping pipelines fast and reusable. Workflows really run in the sandbox's pretend GitHub, and you drive them with the real gh commands.

@@@ lesson
id: ci-cd
title: CI/CD and your first workflow
minutes: 28
summary: What continuous integration, continuous delivery and continuous deployment are and why teams use them, the Node.js project this part uses and running its tests with npm test, GitHub Actions' building blocks (workflows, events, jobs, steps, runners and actions), just enough YAML, writing and pushing a first workflow, and reading a run with gh run list and gh run view.
---
In Parts 1 and 2 every check was manual: you ran the tests (if you remembered), and a reviewer looked at the diff. That works for one person and a few files. With a team, someone forgets, a change that worked on one laptop breaks on another, and releasing becomes a nervous, hand-made event. **CI/CD** hands those checks to a machine that runs them the same way on every change.

### Continuous integration, delivery and deployment

![Four stages from top to bottom: commit (git push), build and test (npm ci, npm test), artifact (a tested build) and deploy (to production). Brackets show that continuous integration covers commit to build and test, continuous delivery reaches the artifact, ready to ship with a person deploying, and continuous deployment covers every stage up to production](figures/ci-cd-stages.svg)

- **Continuous integration (CI):** everyone merges small changes into `main` often, and every change is automatically built and tested. A failure shows up minutes after the commit that caused it, while it's still fresh in the author's head.
- **Continuous delivery:** every change that passes is packaged and ready to release; releasing is a button press, not a project.
- **Continuous deployment:** every change that passes goes to production automatically, with no button.

The tool that runs these steps is a **pipeline**. Google's long-running DORA research found the same pattern year after year: teams that ship small changes often, with automated checks, deploy more *and* break things less than teams that batch changes into big, rare releases.

### The project: tests you can run

From now on the bike shop's price list is code: `prices.js` exports the prices and two functions, and `prices.test.js` checks them with Node.js's built-in test runner (`node:test`, which you met in the JavaScript course). `package.json` names the project and its **scripts**. You don't need to write JavaScript in this part; you'll read a little.

```sh setup=node-shop
cat package.json
cat prices.test.js
npm test
echo "exit status: $?"
```

`npm test` runs the `test` script, `node --test`, which finds files named like `*.test.js`. Each `✔` is a passing test; the `ℹ` lines count them. The **exit status** is what CI cares about: `0` means everything passed, anything else means failure. Every CI system in the world works by running commands and checking their exit status.

### GitHub Actions in six words

**GitHub Actions** is the CI/CD system built into GitHub. It's free for public repositories and has a monthly allowance of minutes for private ones (2,000 a month on the Free plan).

![An event, push to main, starts the workflow .github/workflows/ci.yml. Inside it, job test runs on ubuntu-24.04 with the steps checkout, setup-node and npm test; an arrow leads to job deploy, which needs test, with the steps download-artifact, deploy-pages and curl the site. Each job gets a fresh runner and runs its steps in order](figures/actions-anatomy.svg)

| Word | Meaning |
|---|---|
| **workflow** | an automated process, written in a YAML file in `.github/workflows/` |
| **event** | what starts a workflow: a push, a pull request, a schedule, a button press |
| **job** | a set of steps that run together on one machine; jobs run in parallel unless one `needs` another |
| **step** | one command (`run:`) or one action (`uses:`) |
| **runner** | the machine a job runs on: a fresh virtual machine GitHub starts for each job and throws away after |
| **action** | a reusable step someone has packaged, like `actions/checkout`, which copies your repository onto the runner |

GitHub's hosted runners are named by **labels**: `ubuntu-latest` (Ubuntu 24.04 today; GitHub moves it to Ubuntu 26.04 between 19 October and 19 November 2026), `windows-latest` and `macos-latest` (macOS 26). Linux runners are the cheapest and fastest to start, so most CI uses them.

### Just enough YAML

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

### Your first workflow

A workflow file has three parts: a `name`, the events it runs `on`, and its `jobs`. This one tests the shop on every push to `main`:

```sh setup=node-shop
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

### Reading a run's log

Every step writes a log. `gh run view <ID> --log` prints all of it, one line per log line, as *job*, *step*, *time* and *text*:

```sh setup=node-shop-ci
gh run list
gh run view 22417304019 --log | grep "Run npm test"
```

The log starts with **Set up job** (the runner's operating system, image and the permissions of its token), then one section per step, then **Post** steps (clean-up for actions that need it, in reverse order) and **Complete job**. Lines between `##[group]` and `##[endgroup]` are folded on GitHub's website; the folded part of a `run:` step shows the script and the shell that ran it (`bash -e`, which stops at the first failing command).

### Try it on your own computer

- Create a repository with a workflow: everything above works with real GitHub and the `gh` you set up in Part 2. Open the repository's **Actions** tab to watch runs live; `gh run watch` does the same in the terminal.
- [actionlint](https://github.com/rhysd/actionlint) checks workflow files before you push (next lessons use it): `brew install actionlint`, or download a binary from its [releases page](https://github.com/rhysd/actionlint/releases).
- In VS Code, the official **GitHub Actions** extension (by GitHub) validates workflow files as you type and shows runs in the sidebar.
- [act](https://github.com/nektos/act) runs workflows on your own computer, inside Docker containers (Part 4 covers Docker).

:::exercise Make npm test work
In `~/shop`, `npm test` fails: `package.json` has no `test` script. Add the script `"test": "node --test"` (keep the name, version and `"type": "module"`), check that `npm test` now runs both tests, and commit `package.json` with the message `Add a test script`.
```sh starter setup=node-shop-no-script
npm test
cat package.json
```
```js check
const r = await repo("~/shop");
let pkg;
try { pkg = JSON.parse(r.read("package.json")); } catch (e) { throw new AssertionError(`package.json isn't valid JSON any more: ${e.message}`); }
same(pkg.scripts?.test, "node --test", "The test script in package.json");
same([pkg.name, pkg.version, pkg.type], ["shop", "1.0.0", "module"], "The name, version and type in package.json");
if (!ran(/^npm (test|t|run test)\b/)) throw new AssertionError("Run npm test to see the script work.");
const log = await r.log();
same(log[0].subject, "Add a test script", "The newest commit's message");
same(JSON.parse((await r.files("HEAD"))["package.json"]).scripts?.test, "node --test", "The test script in the committed package.json");
if (!(await r.status()).clean) throw new AssertionError("Commit everything: the working tree should be clean.");
```
```sh solution setup=node-shop-no-script
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
hint: npm reads scripts from a `"scripts"` object in `package.json`: `"scripts": { "test": "node --test" }`.
hint: The easiest way to edit the file here is to write it again whole, with `cat > package.json <<'EOF'` … `EOF`. Keep the commas between properties: JSON is strict about them.
hint: Run `npm test` to see two passing tests, then `git commit -am "Add a test script"`.
approach:
1. **Understand:** npm runs whatever command the `test` script names; there isn't one yet.
2. **Examples:** `npm run` lists a project's scripts; here it prints nothing.
3. **Brute force:** running `node --test` by hand works, but CI and teammates won't know to.
4. **Pattern:** **put the project's commands in package.json scripts**, so everyone (and CI) runs the same thing.
5. **Plan:** rewrite package.json with a scripts object → npm test → commit.
6. **Code and test:** `npm run` now lists `test`, and `npm test` exits with status 0.
walkthrough:
**Line by line**

- The heredoc writes the whole file again, now with `"scripts": { "test": "node --test" }`.
- `npm test` prints the `> shop@1.0.0 test` banner, then the test runner's results.
- `git commit -am` stages the tracked, changed `package.json` and commits it.

**Trace:** two `✔` lines, then `ℹ pass 2` and `ℹ fail 0`.

**Common wrong approach:** forgetting the comma after `"type": "module"`, which makes the JSON invalid: npm then fails with `EJSONPARSE` before running anything.
:::

:::exercise Your first workflow
`~/shop` is on GitHub as `ada/shop`, with no workflows yet. Add `.github/workflows/ci.yml`: a workflow named `CI` that runs on every push to `main`, with one job called `test` on `ubuntu-latest` that checks out the code (`actions/checkout@v7`), sets up Node.js 24 (`actions/setup-node@v7`) and runs `npm test`. Commit it, push, and make sure the run passed.
```sh starter setup=node-shop
gh run list
```
```js check
const { wf, errors } = workflow("~/shop/.github/workflows/ci.yml");
if (errors.length) throw new AssertionError(`ci.yml has a problem: line ${errors[0].line}: ${errors[0].message} (run actionlint).`);
same(wf.name, "CI", "The workflow's name");
const push = wf.on?.push;
if (!push || !JSON.stringify(push.branches ?? []).includes("main")) throw new AssertionError("Run the workflow on pushes to main: on: push: branches: [main].");
const job = wf.jobs?.test;
if (!job) throw new AssertionError("Call the job test (jobs: test:).");
same(job["runs-on"], "ubuntu-latest", "The test job's runs-on");
const uses = (job.steps ?? []).map((s) => s.uses).filter(Boolean);
if (!uses.includes("actions/checkout@v7")) throw new AssertionError("Check out the code with actions/checkout@v7.");
const node = (job.steps ?? []).find((s) => s.uses === "actions/setup-node@v7");
if (!node) throw new AssertionError("Set up Node.js with actions/setup-node@v7.");
same(String(node.with?.["node-version"]), "24", "The node-version given to setup-node");
if (!(job.steps ?? []).some((s) => /\bnpm (test|t)\b/.test(String(s.run ?? "")))) throw new AssertionError("Add a step that runs npm test.");
const gh = await github("ada/shop");
const runs = gh.runs().filter((x) => x.workflowName === "CI");
if (!runs.length) throw new AssertionError("There's no CI run on GitHub yet: commit the workflow and git push.");
same(runs[0].conclusion, "success", "The latest CI run's result");
```
```sh solution setup=node-shop
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
hint: The file must be at exactly `.github/workflows/ci.yml` (mind the dot and the plural): `mkdir -p .github/workflows` first.
hint: The structure is `name:`, then `on: push: branches: [main]`, then `jobs: test: runs-on: …` and `steps:`, a list of `- uses:` and `- run:` items. Copy the lesson's example and check it with `actionlint`.
hint: A workflow only runs once it's on GitHub: `git add`, `git commit` and `git push`, then `gh run list`.
approach:
1. **Understand:** GitHub runs any workflow in `.github/workflows/` whose events match, on the pushed commit.
2. **Examples:** the lesson's `ci.yml` is exactly this workflow.
3. **Brute force:** running `npm test` yourself before each push: works until the day you forget.
4. **Pattern:** **event → job → steps**: checkout, set up the tools, run the project's own commands.
5. **Plan:** write the file → `actionlint` → commit → push → `gh run list`.
6. **Code and test:** `gh run list` shows `✓` for the run, and `gh run view <ID>` lists the `test` job.
walkthrough:
**Line by line**

- `mkdir -p` and the heredoc create the workflow file in the folder GitHub looks in.
- `actionlint` prints nothing when the file is valid.
- After `git push`, GitHub starts the workflow because the push was to `main`.

**Trace:** `gh run list` shows `✓  Run the tests on every push  CI  main  push`.

**Common wrong approach:** saving the file as `.github/workflow/ci.yml` (no `s`): it's committed and pushed, but GitHub never runs it, and `gh run list` stays empty.
:::

:::quiz
? Which describes continuous delivery?
+ Every change that passes the pipeline is ready to release; releasing is a button press
- Every change goes to production automatically, with no human step
- Developers merge into main once a month
- Tests run only before a release
= Continuous deployment goes one step further and releases automatically; delivery keeps a human decision.
? How does a CI system know a command failed?
+ The command's exit status isn't 0
- The command printed the word "error"
- The command took longer than a minute
- The log has more than 100 lines
= Every CI system runs commands and checks their exit status; tools like npm test exit non-zero when a test fails.
? Where must a workflow file be for GitHub to run it?
+ In .github/workflows/ in the repository, on the branch or commit that's pushed
- Anywhere in the repository, named workflow.yml
- In the repository's settings on GitHub
- In ~/.github on your computer
= GitHub reads workflow files from .github/workflows/ in the commit the event refers to.
? What does actions/checkout do?
+ Copies the repository's code onto the runner, so later steps can use it
- Switches your local branch
- Checks the workflow file for errors
- Installs Node.js
= Each job starts on an empty runner; checkout fetches the commit being tested.
:::

@@@ lesson
id: failing-builds
title: When the build fails
minutes: 28
summary: Reading a failed run (gh run view, --log-failed and annotations), reproducing a failure locally, fixing forward or reverting, re-running and flaky tests, choosing when workflows run (push, pull_request, branch and path filters), checks on pull requests with gh pr checks, and required status checks that keep main green.
---
A pipeline earns its keep on the day it says **no**. A red run means a change broke something, and that the break was caught minutes after the push instead of by a customer. This lesson is about reading that "no" quickly and fixing it calmly.

### A red run

Someone "tidied up" `formatPrice` and pushed. The run failed:

```sh setup=node-shop-red
gh run list
gh run view 22417308038
```

`gh run view` lists every step of a failed job: `X Run npm test` is where it broke. **Annotations** are messages attached to the run; `Process completed with exit code 1` is the runner reporting that a step's command exited with status 1. To see *why*, read the failed step's log:

```sh setup=node-shop-red
gh run view 22417308038 --log-failed | cut -f3- | cut -c30-
```

`--log-failed` prints only the failed steps; `cut` trims the job, step and time columns so the text is easier to read here. The test runner's report ends with **failing tests**: which test (`shows a price with two decimals`), where (`test at prices.test.js:9:1`), and how: `actual` `'290.00'`, `expected` `'29.00'`. The price is ten times too big: the "tidy-up" divides by 10 instead of 100.

### Fix forward, or revert

First, reproduce the failure on your own machine; it's much faster than pushing guesses:

```sh setup=node-shop-red
npm test 2>&1 | grep -A 4 "failing tests"
git log -p -1 prices.js
```

Then pick one of two ways back to green:

- **Fix forward:** make a new commit that corrects the code. Best when the fix is small and obvious, like this one.
- **Revert:** `git revert <commit>` undoes the bad commit with a new one (Part 1). Best when the fix isn't obvious and `main` must be green *now*; you can redo the change properly afterwards.

Either way, **fix the code, not the test**, unless the test itself is wrong. Never rewrite `main`'s history to hide a red run: the commit is already shared.

### Re-running and flaky tests

`gh run rerun <ID>` runs a workflow again on the same commit; `--failed` re-runs only the failed jobs. That's right when something outside your code failed: a network hiccup while downloading, a service that was briefly down. A test that passes or fails on the same code depending on luck (timing, test order, the current date) is **flaky**. Re-running hides the problem and teaches the team to ignore red runs; fix or quarantine flaky tests instead.

### Choosing when workflows run

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

```sh setup=node-shop-ci
git switch -c add-helmets
sed -i "s/lock: 2900 }/lock: 2900, helmet: 4500 }/" prices.js
git commit -qam "Add helmets"
git push -q -u origin add-helmets
gh pr create --title "Add helmets" --body "We now sell helmets."
gh pr checks
```

`ci.yml` already has `pull_request:` in its `on:` section, so opening the pull request started a run. `gh pr checks` lists the **checks** on a pull request: one per job, named `workflow/job (event)`.

### Status checks that keep main green

A failing check is only advice until a rule makes it binding. A **required status check** in a ruleset (Part 2) blocks merging, and direct pushes, until the named check has passed on the latest commit:

```sh setup=node-shop-ci error
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

### Try it on your own computer

- Add a **status badge** to your README: `![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)` shows green or red for the latest run on the default branch.
- `gh run watch <ID> --exit-status` waits for a run and exits non-zero if it failed: handy in scripts. `gh run view <ID> --web` opens the run in your browser.
- GitHub emails you when a workflow you triggered fails; change that under **Settings → Notifications → System → Actions**.

:::exercise Fix the failing build
`main` is red on GitHub: the latest run of `CI` failed. Find out which test fails and why, fix the bug **in `prices.js`** (not in the test), commit, and push, so that the newest run on `main` passes. Don't rewrite history: the broken commit stays, followed by your fix.
```sh starter setup=node-shop-red
gh run list
```
```js check
const gh = await github("ada/shop");
const runs = gh.runs().filter((x) => x.workflowName === "CI" && x.headBranch === "main");
if (runs.length < 3) throw new AssertionError("There's no new run on main yet: commit your fix and git push.");
same(runs[0].conclusion, "success", "The newest CI run's result on main");
const files = await gh.files("main");
if (!/"29\.00"/.test(files["prices.test.js"] ?? "") || !/3800/.test(files["prices.test.js"] ?? "")) throw new AssertionError("Don't change the tests: they were right. Fix prices.js instead.");
if (!/cents \/ 100\b/.test(files["prices.js"] ?? "")) throw new AssertionError("formatPrice should divide by 100 again.");
const subjects = (await gh.log("main")).map((c) => c.subject);
if (!subjects.includes("Tidy up formatPrice")) throw new AssertionError("The commit Tidy up formatPrice should still be on main: fix forward or revert, don't rewrite history.");
```
```sh solution setup=node-shop-red
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
hint: `gh run view <ID> --log-failed` shows the failed step's output: the failing test, and its actual and expected values.
hint: `npm test` shows the same failure locally, and `git show HEAD` shows what the last commit changed in `prices.js`.
hint: Change `cents / 10` back to `cents / 100` (`sed -i "s#cents / 10)#cents / 100)#" prices.js`), run `npm test`, then commit and push. (`git revert HEAD` followed by `git push` also works.)
approach:
1. **Understand:** the run tells you which test failed; the code tells you why.
2. **Examples:** expected `'29.00'`, got `'290.00'`: off by a factor of 10.
3. **Brute force:** changing the test to expect `'290.00'` makes CI green and the shop wrong.
4. **Pattern:** **reproduce locally, fix the cause, push, watch the run**.
5. **Plan:** read `--log-failed` → `npm test` → `git show HEAD` → fix → `npm test` → commit → push.
6. **Code and test:** `npm test` shows two `✔`, and `gh run list` shows a new `✓` run on top.
walkthrough:
**Line by line**

- `--log-failed` narrows the log to the failed step; the report names the test and the values.
- `git show HEAD --stat` points at the commit that touched `prices.js`.
- The `sed` puts back the division by 100; `npm test` confirms before anything is pushed.

**Trace:** `gh run list` shows your fix (`✓`) above `X Tidy up formatPrice`.

**Common wrong approach:** `git reset --hard HEAD~1` and `git push --force`: it erases a shared commit (and with a ruleset, the push is rejected). Fix forward or revert instead.
:::

:::exercise Checks on a pull request
Add helmets to the shop through a pull request: on a new branch `add-helmets`, add `helmet: 4500` to `PRICES` in `prices.js` and add a test to `prices.test.js` that checks `total(["helmet"])` is `4500`. Commit, push the branch, and open a pull request titled `Add helmets`. Its checks must pass.
```sh starter setup=node-shop-ci
cat prices.js
```
```js check
const gh = await github("ada/shop");
const pr = gh.pulls().find((p) => p.head === "add-helmets");
if (!pr) throw new AssertionError("There's no pull request from add-helmets yet (gh pr create).");
same(pr.title, "Add helmets", "The pull request's title");
const files = await gh.files("add-helmets");
if (!/helmet:\s*4500/.test(files["prices.js"] ?? "")) throw new AssertionError("Add helmet: 4500 to PRICES in prices.js on add-helmets.");
if (!/total\(\[\s*["']helmet["']\s*\]\)/.test(files["prices.test.js"] ?? "") || !/4500/.test(files["prices.test.js"] ?? "")) throw new AssertionError('Add a test that checks total(["helmet"]) is 4500.');
const runs = gh.runs().filter((x) => x.event === "pull_request" && x.pr === pr.number);
if (!runs.length) throw new AssertionError("No checks ran on the pull request: does ci.yml still have pull_request in on:?");
same(runs[0].conclusion, "success", "The pull request's latest check run");
if (!/ℹ tests 3\b/.test(gh.jobLog(runs[0], "test") ?? "")) throw new AssertionError("The pull request's run should have run three tests (your new one included).");
```
```sh solution setup=node-shop-ci
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
hint: `git switch -c add-helmets` first, so the commit goes on the new branch, not on `main`.
hint: `sed -i "s/lock: 2900 }/lock: 2900, helmet: 4500 }/" prices.js` adds the price; append a new `test(…)` block to `prices.test.js` with `cat >> prices.test.js <<'EOF'`.
hint: Run `npm test` (three tests), commit, `git push -u origin add-helmets`, then `gh pr create --title "Add helmets" --body "…"` and `gh pr checks`.
approach:
1. **Understand:** opening a pull request is an event; ci.yml's `pull_request:` trigger tests the merge result.
2. **Examples:** the lesson's helmet example, plus a test for it.
3. **Brute force:** pushing straight to `main` skips review and tests the change only after it's already on `main`.
4. **Pattern:** **branch → change + test → push → pull request → checks**.
5. **Plan:** switch -c → edit both files → npm test → commit → push -u → gh pr create → gh pr checks.
6. **Code and test:** `gh pr checks` says `All checks were successful`.
walkthrough:
**Line by line**

- The `sed` adds the price inside the `PRICES` object; the heredoc appends a third test.
- `git push -u` publishes the branch; `gh pr create` opens the pull request, which starts the `pull_request` run.
- `gh pr checks` shows `✓  CI/test (pull_request)`.

**Trace:** `npm test` shows three `✔` lines before anything is pushed.

**Common wrong approach:** committing on `main`, then creating the branch: the pull request has nothing to merge, and `main` is ahead of GitHub.
:::

:::quiz
? A run failed. Which command shows only the output of the failed steps?
+ gh run view <ID> --log-failed
- gh run list --failed
- gh run rerun <ID>
- git log --failed
= --log-failed prints the logs of failed steps; --log prints everything.
? A test fails because of a real bug. What should you change?
+ The code, so the test passes for the right reason
- The test's expected value, so CI is green
- The workflow, so it skips that test
- Nothing: re-run until it passes
= The test caught a bug; changing it would hide the bug from CI and from users.
? Which code does a pull_request run test?
+ A merge commit of the branch into its base branch
- Only the branch's latest commit, ignoring main
- The base branch only
- The commit that opened the repository
= GitHub tests what the base branch would look like after merging (refs/pull/N/merge).
? A required status check names "test". What happens if you rename the job to unit-tests?
+ The required check never reports, so pull requests can't merge until the rule is updated
- GitHub renames the rule automatically
- The rule now checks unit-tests
- Nothing; checks are matched by workflow file name
= Checks are matched by job name; keep job names stable or update the ruleset with them.
:::

@@@ lesson
id: workflow-syntax
title: Jobs, matrices and expressions
minutes: 30
summary: Several jobs and needs, a matrix that tests on several Node.js versions (fail-fast, include and exclude), expressions with ${{ }}, contexts (github, env, vars, matrix, steps, needs, runner) and functions, if conditions and status functions, passing data with env, GITHUB_ENV, GITHUB_OUTPUT and job outputs, workflow commands (::error::, ::group::), and catching mistakes with actionlint.
---
One job with three steps covers a lot. Real pipelines add a quick check that fails fast, test on every supported version, and pass results from one job to the next. This lesson is the workflow language itself.

### Several jobs

Each job gets its own fresh runner, and jobs run **in parallel** unless `needs:` makes one wait for another. A job whose `needs` failed is skipped.

![Three jobs, test (22), test (24) and test (26), produced by matrix node [22, 24, 26], all point to a build job (needs: test), which points to a deploy job (needs: build, if: github.ref == 'refs/heads/main')](figures/job-graph.svg)

```sh setup=node-shop-ci
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

### A matrix

A **matrix** runs the same job once for every combination of values. The shop's code should work on every Node.js version still supported: 22 (maintenance until April 2027), 24 (the current LTS) and 26 (released in April 2026; it becomes LTS in late October 2026):

```sh setup=node-shop-ci
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

### Expressions and contexts

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

```sh setup=node-shop-ci
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

### Passing data along

- **`env:`** sets environment variables for a whole workflow, a job or one step (the most specific wins). In scripts, read them as `$NAME`.
- A step can set a variable for the **later steps** of its job: `echo "NAME=value" >> "$GITHUB_ENV"`.
- A step with an `id` can produce **outputs**: `echo "name=value" >> "$GITHUB_OUTPUT"`, read later as `${{ steps.<id>.outputs.name }}`.
- A job passes values to the jobs that need it through `outputs:`, read as `${{ needs.<job>.outputs.name }}`.

```sh setup=node-shop-ci
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

### Catching mistakes with actionlint

A typo in a workflow file isn't caught by anything on your computer: you push, and the run fails straight away with **This run likely failed because of a workflow file issue**. `actionlint` checks the files first:

```sh setup=node-shop-broken-ci error
gh run list
gh run view 22417304019
actionlint
```

Each problem has a file, line and column, a message, and the rule in brackets. actionlint also checks expressions, the inputs of popular actions and, when it's installed, your shell scripts with [ShellCheck](https://www.shellcheck.net). The sandbox's actionlint checks the structure of the file only.

### Try it on your own computer

- Run `actionlint` before every push of a workflow change, or let your editor's GitHub Actions extension highlight errors as you type.
- To debug a failing workflow, add a step `- run: echo '${{ toJSON(github) }}'` to print a whole context, or re-run with debug logging: `gh run rerun <ID> --debug`.
- GitHub's docs list every context property and function: [Contexts](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts) and [Expressions](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions).

:::exercise Test on three Node.js versions
Change the `test` job in `~/shop/.github/workflows/ci.yml` to use a matrix, so it runs on Node.js 22, 24 and 26, with the version passed to `actions/setup-node` from the matrix. Commit, push, and check that all three jobs passed.
```sh starter setup=node-shop-ci
cat .github/workflows/ci.yml
```
```js check
const { wf, errors } = workflow("~/shop/.github/workflows/ci.yml");
if (errors.length) throw new AssertionError(`ci.yml has a problem: line ${errors[0].line}: ${errors[0].message} (run actionlint).`);
const m = wf.jobs?.test?.strategy?.matrix;
if (!m) throw new AssertionError("Add strategy: matrix: to the test job.");
const key = Object.keys(m).find((k) => Array.isArray(m[k]));
if (!key) throw new AssertionError("Give the matrix a list of versions, like node: [22, 24, 26].");
same(m[key].map(String), ["22", "24", "26"], "The matrix's versions");
const setup = (wf.jobs.test.steps ?? []).find((s) => String(s.uses ?? "").startsWith("actions/setup-node"));
if (!setup || !String(setup.with?.["node-version"] ?? "").includes(`matrix.${key}`)) throw new AssertionError(`Pass the version to setup-node: node-version: \${{ matrix.${key} }}.`);
const gh = await github("ada/shop");
const run = gh.runs().find((x) => x.workflowName === "CI");
same(run.jobs.map((j) => j.name).sort(), ["test (22)", "test (24)", "test (26)"], "The jobs of the latest CI run");
same(run.conclusion, "success", "The latest CI run's result");
```
```sh solution setup=node-shop-ci
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
hint: The matrix goes under the job: `strategy:` then `matrix:` then `node: [22, 24, 26]`, indented one level each.
hint: Replace `node-version: 24` with `node-version: ${{ matrix.node }}`.
hint: Check the file with `actionlint`, then commit, push, and `gh run view <ID>`: you should see three jobs.
approach:
1. **Understand:** one job definition, three runs of it with different values.
2. **Examples:** the lesson's matrix example.
3. **Brute force:** three copies of the job, `test-22`, `test-24`, `test-26`: works, and drifts apart the first time someone edits only one.
4. **Pattern:** **matrix for variations of the same job**.
5. **Plan:** add `strategy.matrix` → use `${{ matrix.node }}` → actionlint → commit → push.
6. **Code and test:** `gh run view <ID>` lists `test (22)`, `test (24)` and `test (26)`, all `✓`.
walkthrough:
**Line by line**

- `strategy: matrix: node: [22, 24, 26]` defines three combinations.
- `${{ matrix.node }}` is replaced per job, so each job installs a different version.

**Trace:** the setup-node logs show `node: v22.23.3`, `node: v24.21.0` and `node: v26.11.1`.

**Common wrong approach:** writing `node-version: matrix.node` without `${{ }}`: setup-node receives the text `matrix.node` and fails with `Unable to find Node version 'matrix.node'`.
:::

:::exercise Fix the broken workflow
The CI workflow in `~/shop` was pushed with mistakes in it, and its run failed before any job started. Use `actionlint` to find every problem, fix `ci.yml` so it keeps both jobs (`syntax`, then `test` after it), and push. The new run must pass, with both jobs.
```sh starter setup=node-shop-broken-ci
actionlint
```
```js check
const { wf, errors } = workflow("~/shop/.github/workflows/ci.yml");
if (errors.length) throw new AssertionError(`ci.yml still has a problem: line ${errors[0].line}: ${errors[0].message}`);
if (!wf.jobs?.syntax || !wf.jobs?.test) throw new AssertionError("Keep both jobs, syntax and test.");
same([].concat(wf.jobs.test.needs ?? []), ["syntax"], "What the test job needs");
const gh = await github("ada/shop");
const run = gh.runs()[0];
if (run.invalid) throw new AssertionError("The newest run on GitHub still failed because of a workflow file issue: commit and push your fixed file.");
same(run.jobs.map((j) => j.name), ["syntax", "test"], "The jobs of the newest run");
same(run.conclusion, "success", "The newest run's result");
```
```sh solution setup=node-shop-broken-ci
actionlint
sed -i "s/needs: sytnax/needs: syntax/; s/run-on:/runs-on:/" .github/workflows/ci.yml
sed -i "/- name: Run the tests/d" .github/workflows/ci.yml
actionlint
git commit -am "Fix the CI workflow"
git push
gh run list
```
hint: `actionlint` lists four problems; two of them (missing `runs-on` and the unexpected `run-on`) have the same cause.
hint: `needs:` must name a job that exists (`syntax`), the key is `runs-on`, and a step must have `run:` or `uses:`: a lone `- name:` line is a step with neither.
hint: Either edit the lines with `sed` (`sed -i "/- name: Run the tests/d" file` deletes the matching line) or write the file again with a heredoc. Run `actionlint` until it prints nothing, then commit and push.
approach:
1. **Understand:** GitHub can't run a file it can't read; actionlint reads it the same way, on your machine.
2. **Examples:** "unexpected key "run-on"" means a misspelt key; "needs job which does not exist" means a misspelt job ID.
3. **Brute force:** pushing guesses and waiting for each run to fail.
4. **Pattern:** **lint locally until clean, then push**.
5. **Plan:** actionlint → fix each line → actionlint (nothing printed) → commit → push.
6. **Code and test:** `gh run list` shows `✓ … CI` on top.
walkthrough:
**Line by line**

- `needs: sytnax` → `needs: syntax`, and `run-on` → `runs-on` fix three of the reports.
- The stray `- name: Run the tests` was meant to label the next step; deleting it (or merging it into the `run:` step as `name:`) fixes the last one.

**Trace:** the second `actionlint` prints nothing; the new run has jobs `syntax` and `test`, both `✓`.

**Common wrong approach:** writing `- name: Run the tests` and `run: npm test` as two list items: the dash starts a new step each time. Put `name:` and `run:` in the same item.
:::

:::quiz
? Two jobs have no needs:. How do they run?
+ In parallel, each on its own fresh runner
- One after the other, in file order
- On the same runner, sharing files
- Only the first one runs
= Jobs are independent unless needs: links them; each gets a separate runner.
? A step has if: github.ref == 'refs/heads/main'. When does it run?
+ On main, and only if the steps before it succeeded
- On main, even after an earlier step failed
- On every branch
- Never; if: needs ${{ }}
= Without a status function, if: is treated as success() && (…). Use always() or failure() to run after failures.
? How does a step hand a value to a later step in the same job?
+ echo "name=value" >> "$GITHUB_OUTPUT", read as ${{ steps.<id>.outputs.name }}
- export name=value
- By writing it to the workflow file
- set-output name=value
= Each step is a separate shell; files like $GITHUB_OUTPUT and $GITHUB_ENV carry values between steps.
? A matrix has os: [ubuntu-latest, windows-latest] and node: [22, 24, 26]. How many jobs run?
+ 6
- 5
- 3
- 2
= A matrix runs every combination: 2 × 3 = 6, unless exclude: removes some.
:::

@@@ lesson
id: secrets-security
title: Secrets, permissions and safe workflows
minutes: 30
summary: Environment variables, configuration variables (gh variable) and encrypted secrets (gh secret), masking in logs, environment secrets, the GITHUB_TOKEN and least-privilege permissions, script injection from untrusted input and how to avoid it, third-party actions and pinning them to commit SHAs (the tj-actions incident), Dependabot updates, pull requests from forks and pull_request_target, and OIDC instead of long-lived cloud keys.
---
A workflow runs code with credentials: its own token, and any secrets you give it. That makes CI one of the most attractive targets in a company. This lesson covers keeping secrets secret and keeping other people's code out of your pipeline.

### Variables and secrets

Three ways to give a workflow a value:

| | Set with | Read as | Use for |
|---|---|---|---|
| `env:` in the file | editing the workflow | `$NAME` in scripts, `${{ env.NAME }}` | values that may be public and belong with the code |
| configuration **variable** | `gh variable set NAME --body …` | `${{ vars.NAME }}` | non-secret settings you change without a commit |
| **secret** | `gh secret set NAME --body …` | `${{ secrets.NAME }}` | passwords, API keys, tokens |

Secrets are encrypted at rest; once set, no one can read them back (`gh secret list` shows names and dates only), and GitHub replaces their values with `***` anywhere they'd appear in a log:

```sh setup=node-shop-ci
gh variable set SHOP_NAME --body "Ada's Bike Shop"
gh secret set PAYMENTS_KEY --body "pk_test_51f3a9c2"
gh secret list
cat > .github/workflows/settings.yml <<'EOF'
name: Settings

on: push

jobs:
  show:
    runs-on: ubuntu-latest
    env:
      PAYMENTS_KEY: ${{ secrets.PAYMENTS_KEY }}
    steps:
      - run: echo "Shop name is ${{ vars.SHOP_NAME }}"
      - run: echo "Key is $PAYMENTS_KEY and has ${#PAYMENTS_KEY} characters"
EOF
git add . && git commit -qm "Show the settings"
git push -q
gh run view 22417312057 --log | cut -f3 | cut -c30- | grep "^Shop name\|^Key is"
```

Masking is a safety net, not a guarantee: a secret that's transformed (base64-encoded, split into pieces, printed one character at a time) is no longer recognised. Don't print secrets at all. **Environment secrets** (`gh secret set NAME --env production`) are only given to jobs that use that environment, so a deploy key can't leak from a test job; lesson 17 uses environments. Secrets are **not** given to workflows started by pull requests from forks, since anyone can open one.

### The GITHUB_TOKEN and permissions

Every job gets a short-lived token, `secrets.GITHUB_TOKEN` (also `github.token`), that lets it talk to GitHub's API for its own repository: comment on a pull request, create a release, push a commit. It expires when the job ends. Repositories created since February 2023 give it **read-only** access by default; you can see the permissions at the top of every job's log, under **GITHUB_TOKEN Permissions**.

Grant only what a workflow needs, at the top of the file or per job:

```yaml
permissions:
  contents: read          # read the code
  pull-requests: write    # comment on pull requests
```

Listing any permission sets every unlisted one to `none`. `permissions: write-all` hands a stolen token everything; never use it.

### Script injection

Expressions are replaced **before** the shell runs. If an expression contains text someone else controls (a pull request title, a branch name, an issue body, a commit message), that text becomes part of your script:

```sh setup=node-shop-inject
cat .github/workflows/announce.yml
git commit -q --allow-empty -m 'Fix typo"; echo "I can run any command here, with your token'
git push -q
gh run view 22417316076 --log | grep "Run echo" | cut -f3 | cut -c30-
```

The commit message closed the quote and added a command, and the runner ran it. In a real attack the command would send `GITHUB_TOKEN` or your secrets to the attacker. The fix is to pass untrusted values through an **environment variable**, which the shell treats as data, never as code:

```yaml
    steps:
      - env:
          MESSAGE: ${{ github.event.head_commit.message }}
        run: |
          echo "Now on main: $MESSAGE"
```

### Third-party actions and pinning

`uses: someone/action@v3` runs someone else's code, with your token and secrets. Tags like `v3` can be moved to different code at any time. In March 2025 attackers who took over the popular `tj-actions/changed-files` action, used by over 20,000 repositories, moved its tags to code that printed CI secrets into workflow logs; every repository that ran it during the attack could have leaked its secrets (and logs of public repositories are public). Pin third-party actions to a **full commit SHA**, which can't be moved, with the version as a comment:

```yaml
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
```

To keep pinned actions up to date, let **Dependabot** open pull requests for new versions with a `.github/dependabot.yml` file:

```yaml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

Since August 2025, organisations can also require SHA pinning and block specific actions in their Actions policy.

### Pull requests from forks

On a public repository anyone can fork and open a pull request, and the `pull_request` event runs *their* code. GitHub limits the damage: fork pull requests get a read-only token and no secrets, and first-time contributors' runs wait for a maintainer's approval. The `pull_request_target` event runs in the context of *your* repository, with secrets and a write token, so it must never check out and run the fork's code ("pwn requests"). `actions/checkout@v7` now refuses to check out fork code under `pull_request_target` unless you explicitly opt in.

### OIDC: no long-lived cloud keys

Deploying to a cloud used to mean storing a cloud access key as a secret: powerful, long-lived, and painful to rotate. With **OpenID Connect (OIDC)** the job asks GitHub for a short-lived signed token (`permissions: id-token: write`) that says "this is a job in `ada/shop` on `main`", and the cloud account trusts that instead of a stored key. AWS, Azure and Google Cloud all support it; Part 7 uses it, and GitHub Pages deployments use it already.

### Try it on your own computer

- [zizmor](https://github.com/zizmorcore/zizmor) is a static analyser for workflow security: it finds injection, excessive permissions and unpinned actions. Run it in CI too.
- Turn on **Dependabot** and **secret scanning** under **Settings → Advanced Security** (both free for public repositories).
- `gh secret set NAME < file.txt` reads a secret from a file instead of the command line, so it doesn't end up in your shell history.

:::exercise Use a secret, safely
`~/shop` has a script, `notify.sh`, that tells the shop's system about each build. It reads a token from the environment variable `SHOP_API_TOKEN`. Store the token `tok_live_83d1c47e` as a repository secret called `SHOP_API_TOKEN`, then add a step at the end of the `test` job in `ci.yml` that runs `./notify.sh`, with `SHOP_API_TOKEN` set from the secret through the step's `env:`. Push; the run must pass, and the token must not appear in its log.
```sh starter setup=node-shop-notify
cat notify.sh
cat .github/workflows/ci.yml
```
```js check
const gh = await github("ada/shop");
if (!gh.secrets().includes("SHOP_API_TOKEN")) throw new AssertionError("Set the secret first: gh secret set SHOP_API_TOKEN --body …");
const { wf, errors } = workflow("~/shop/.github/workflows/ci.yml");
if (errors.length) throw new AssertionError(`ci.yml has a problem: line ${errors[0].line}: ${errors[0].message}`);
const steps = wf.jobs?.test?.steps ?? [];
const notify = steps.find((s) => /notify\.sh/.test(String(s.run ?? "")));
if (!notify) throw new AssertionError("Add a step to the test job that runs ./notify.sh.");
if (/secrets\./.test(String(notify.run))) throw new AssertionError("Don't put ${{ secrets.… }} inside run:. Set it in the step's env:, and the script reads $SHOP_API_TOKEN.");
if (!/secrets\.SHOP_API_TOKEN/.test(String(notify.env?.SHOP_API_TOKEN ?? wf.jobs.test.env?.SHOP_API_TOKEN ?? ""))) throw new AssertionError("Set SHOP_API_TOKEN: ${{ secrets.SHOP_API_TOKEN }} in the step's env:.");
const run = gh.runs().find((x) => x.workflowName === "CI");
same(run.conclusion, "success", "The latest CI run's result");
const log = gh.jobLog(run, "test");
if (!/Telling the shop about commit/.test(log)) throw new AssertionError("The latest run didn't run notify.sh: push your change.");
if (log.includes("tok_live_83d1c47e")) throw new AssertionError("The token appears in the log!");
```
```sh solution setup=node-shop-notify
gh secret set SHOP_API_TOKEN --body "tok_live_83d1c47e"
cat >> .github/workflows/ci.yml <<'EOF'
      - name: Notify the shop
        env:
          SHOP_API_TOKEN: ${{ secrets.SHOP_API_TOKEN }}
        run: ./notify.sh
EOF
actionlint
git commit -am "Notify the shop after the tests"
git push
gh run view 22417312057 --log | grep "Telling"
```
hint: `gh secret set SHOP_API_TOKEN --body "tok_live_83d1c47e"` stores the secret on GitHub.
hint: The new step goes at the end of `steps:` (indented like the others): `- name: Notify the shop`, then `env:` with `SHOP_API_TOKEN: ${{ secrets.SHOP_API_TOKEN }}`, then `run: ./notify.sh`. Appending with `cat >> .github/workflows/ci.yml <<'EOF'` works because the steps are at the end of the file.
hint: Run `actionlint`, commit, push, then look for `Telling the shop` in the run's log: the token shows as `***`.
approach:
1. **Understand:** the secret lives on GitHub; the workflow maps it into one step's environment.
2. **Examples:** the lesson's `PAYMENTS_KEY` example.
3. **Brute force:** writing the token in the workflow file publishes it to everyone who can read the repository, forever.
4. **Pattern:** **secret → env: → script reads the variable**.
5. **Plan:** gh secret set → add the step → actionlint → commit → push → read the log.
6. **Code and test:** the log line reads `Telling the shop about commit … (token: ***)`.
walkthrough:
**Line by line**

- `gh secret set` encrypts and stores the value; the workflow file only names it.
- `env: SHOP_API_TOKEN: ${{ secrets.SHOP_API_TOKEN }}` gives the value to this step only.
- `notify.sh` is executable in the repository (mode `100755`), so the runner can run `./notify.sh`.

**Trace:** the step's log shows `SHOP_API_TOKEN: ***` under `env:` and `(token: ***)` in the output.

**Common wrong approach:** `run: ./notify.sh ${{ secrets.SHOP_API_TOKEN }}`: it works, but puts the secret into the script text, where an injection or a careless `set -x` can expose it.
:::

:::exercise Close the injection hole
`~/shop/.github/workflows/announce.yml` has two security problems: it puts the commit message straight into its script, and it gives its token every permission. Fix both: pass the message through an environment variable called `MESSAGE` (the script then uses `$MESSAGE`), and give the token only `contents: read`. Push your fix with any commit message; the Announce run must pass.
```sh starter setup=node-shop-inject
cat .github/workflows/announce.yml
```
```js check
const { wf, errors } = workflow("~/shop/.github/workflows/announce.yml");
if (errors.length) throw new AssertionError(`announce.yml has a problem: line ${errors[0].line}: ${errors[0].message}`);
same(wf.permissions, { contents: "read" }, "The workflow's permissions");
const steps = wf.jobs?.announce?.steps ?? [];
for (const s of steps) if (/\$\{\{[^}]*github\.event/.test(String(s.run ?? ""))) throw new AssertionError("A run: script still contains ${{ github.event… }}. Move it into env:.");
const step = steps.find((s) => /\$\{?MESSAGE/.test(String(s.run ?? "")));
if (!step) throw new AssertionError("Make the script print $MESSAGE.");
const envMsg = step.env?.MESSAGE ?? wf.jobs.announce.env?.MESSAGE ?? wf.env?.MESSAGE;
if (!/github\.event\.head_commit\.message/.test(String(envMsg ?? ""))) throw new AssertionError("Set MESSAGE: ${{ github.event.head_commit.message }} in env:.");
const gh = await github("ada/shop");
const run = gh.runs().find((x) => x.workflowName === "Announce");
same(run.conclusion, "success", "The latest Announce run's result");
if (!/Permissions\nContents: read\nMetadata: read\n/.test(gh.jobLog(run, "announce").replace(/##\[group\]GITHUB_TOKEN /, ""))) throw new AssertionError("The latest Announce run still had more permissions than contents: read: push your fix.");
```
```sh solution setup=node-shop-inject
cat > .github/workflows/announce.yml <<'EOF'
name: Announce

on:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  announce:
    runs-on: ubuntu-latest
    steps:
      - env:
          MESSAGE: ${{ github.event.head_commit.message }}
        run: |
          echo "Now on main: $MESSAGE"
EOF
actionlint
git commit -am 'Fix "announce": pass the message as data'
git push
gh run list --workflow Announce
```
hint: `permissions: contents: read` (two lines) replaces `permissions: write-all`.
hint: Give the step an `env:` with `MESSAGE: ${{ github.event.head_commit.message }}`, and change the script to `echo "Now on main: $MESSAGE"`.
hint: Rewriting the whole file with a heredoc is easiest. Then `actionlint`, commit (a message with quotes in it is a good test), and push.
approach:
1. **Understand:** expressions are pasted into the script; environment variables are passed beside it.
2. **Examples:** the lesson's commit message that closed a quote and ran a command.
3. **Brute force:** escaping quotes in the expression: attackers have more tricks than you have escapes.
4. **Pattern:** **untrusted input → env: → "$VARIABLE"**, and **least privilege**.
5. **Plan:** permissions → env → script → actionlint → commit → push.
6. **Code and test:** a commit message containing `"` is printed as text, and the run's **GITHUB_TOKEN Permissions** show `Contents: read`.
walkthrough:
**Line by line**

- `permissions: contents: read` leaves the token able to read code and nothing else (plus `Metadata: read`, which every token has).
- `MESSAGE` holds the commit message as data; `"$MESSAGE"` inside double quotes is never split or run.

**Trace:** with the message `Fix "announce": pass the message as data`, the log shows exactly that text after `Now on main:`.

**Common wrong approach:** quoting the expression with single quotes, `echo '${{ … }}'`: a message containing `'` breaks out just as easily.
:::

:::quiz
? Where should a database password used by a workflow live?
+ In a secret, read with ${{ secrets.NAME }}
- In env: at the top of the workflow file
- In a configuration variable (vars)
- In a comment in the workflow
= Secrets are encrypted and masked; the workflow file and variables are readable by anyone who can read the repository.
? Why is run: echo "${{ github.event.pull_request.title }}" dangerous?
+ The title is pasted into the script before it runs, so a crafted title can run commands
- Pull request titles can't contain spaces
- Expressions don't work in run:
- It prints a secret
= Anyone opening a pull request controls its title. Pass it through env: and use "$TITLE".
? Why pin a third-party action to a full commit SHA?
+ A SHA can't be moved to different code, unlike a tag
- SHAs run faster than tags
- GitHub requires it
- Tags don't work with uses:
= In March 2025, tags of a compromised action were moved to malicious code; pinned SHAs were unaffected.
? A workflow lists permissions: contents: read. What can its GITHUB_TOKEN do with issues?
+ Nothing; unlisted permissions become none
- Read and write them
- Only read them
- Whatever the repository default allows
= Listing any permission sets every unlisted permission to none (metadata stays readable).
:::

@@@ lesson
id: deploying
title: Continuous delivery with GitHub Actions
minutes: 30
summary: Building once and deploying what you tested, artifacts between jobs (upload-artifact, download-artifact, gh run download), deploying a static site to GitHub Pages with upload-pages-artifact and deploy-pages, a smoke test with curl, environments and their protection rules, manual deployments with workflow_dispatch and inputs, deploying releases and tags, concurrency for deployments, and rolling back.
---
CI tells you a change is good; **CD** puts it in front of users. The shop's price list becomes a web page, and every push to `main` will publish it, tested, within a minute. The same pipeline shape, build → test → deploy, is how containers reach Kubernetes and models reach production in later parts.

### Build once, deploy what you tested

A deployment should ship the exact files the tests ran against, not a fresh build made later on another machine. Jobs pass files to each other as **artifacts**: one job uploads, a later job (in the same run) downloads.

```sh setup=node-shop-site
cat > .github/workflows/build.yml <<'EOF'
name: Build

on: push

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - run: npm test
      - run: npm run build
      - uses: actions/upload-artifact@v7
        with:
          name: site
          path: dist

  check:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v8
        with:
          name: site
      - run: grep -c "<li>" index.html
EOF
git add . && git commit -qm "Build the site"
git push -q
gh run view 22417308038
gh run download 22417308038 --name site --dir downloaded
ls downloaded
```

Artifacts are kept for 90 days by default (set `retention-days:` to change it), and `gh run download` fetches them to your computer: test reports, screenshots of failing UI tests, built packages.

### Deploying to GitHub Pages

**GitHub Pages** hosts static websites (HTML, CSS, JavaScript) at `https://<owner>.github.io/<repository>/`, free for public repositories. To deploy with a workflow, first tell Pages that a workflow publishes the site (on the website: **Settings → Pages → Source: GitHub Actions**):

```sh setup=node-shop-site
gh api repos/{owner}/{repo}/pages -X POST -f build_type=workflow --jq .html_url
cat > .github/workflows/pages.yml <<'EOF'
name: Deploy site

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
      - name: Smoke test
        run: curl -sSf "${{ steps.deployment.outputs.page_url }}" | grep "Bike shop prices"
EOF
git add . && git commit -qm "Deploy the price list"
git push -q
gh run view 22417312057
curl https://ada.github.io/shop/
```

- `upload-pages-artifact` packs `dist/` as the special artifact `github-pages`; `deploy-pages` publishes it.
- `pages: write` lets the token create the deployment; `id-token: write` lets the job prove, with an OIDC token, which workflow and branch it is.
- `environment: github-pages` records the deployment, and its `url` appears on the run's page and the repository's **Deployments** list.
- The **smoke test** fetches the live page and fails the run if it's broken: `curl -f` exits non-zero on an HTTP error, `grep` on missing text. A deployment isn't done until you've checked it works.

The sandbox's `curl` can fetch your Pages sites (it has no other internet access).

### Environments

An **environment** (`staging`, `production`, `github-pages`) is a named deployment target with its own rules and secrets. Under **Settings → Environments** you can add **protection rules**:

- **Required reviewers** (up to six people or teams): the job waits until one approves it; you can stop people approving their own runs.
- A **wait timer**: the job waits a set number of minutes first, for example to watch a canary.
- **Deployment branches and tags**: only `main` (or tags like `v*`) may deploy. The `github-pages` environment allows only the default branch out of the box.
- **Environment secrets**, given only to jobs that use the environment, so a test job never sees the production key.

The sandbox doesn't pause for reviewers; on GitHub a waiting job shows as **Waiting** with a **Review deployments** button.

### Manual and release deployments

`workflow_dispatch` adds a **Run workflow** button on GitHub, and `gh workflow run`, with optional inputs:

```sh setup=node-shop-pages
cat > .github/workflows/announce-sale.yml <<'EOF'
name: Announce a sale

on:
  workflow_dispatch:
    inputs:
      percent:
        description: How much off
        type: choice
        options: ["10", "20", "30"]
        required: true
      dry-run:
        description: Only print the message
        type: boolean
        default: true

jobs:
  announce:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Everything is ${{ inputs.percent }}% off this week!"
      - if: ${{ !inputs.dry-run }}
        run: echo "Sending the announcement..."
EOF
git add . && git commit -qm "Add a sale announcement"
git push -q
gh workflow run announce-sale.yml -f percent=20 -f dry-run=false
gh run view 22417324114 --log | cut -f3 | cut -c30- | grep "off this week\|Sending"
```

A workflow can also deploy when you publish a release (`on: release: types: [published]`) or push a version tag (`on: push: tags: ['v*']`), so `main` can move ahead of production while releases ship deliberately: that's continuous delivery rather than continuous deployment.

### Concurrency and rollbacks

- **`concurrency:`** puts runs with the same `group` in a queue. For deployments use `cancel-in-progress: false`, so a deployment is never cut off halfway; for pull request CI, `cancel-in-progress: true` saves minutes by cancelling runs for commits that are already out of date.
- **Rolling back** a bad deployment: revert the commit and let the pipeline deploy the reverted code, or re-run the deployment of an older, good commit with `gh run rerun <ID>`. Because every deployment came from a commit, "what's in production?" always has an answer. Part 6 adds gentler strategies, rolling updates and canaries, where a bad version reaches only some users first.

### Try it on your own computer

- Turn on Pages for one of your own public repositories and deploy with the workflow above; GitHub's [starter workflows](https://github.com/actions/starter-workflows/tree/main/pages) cover static site generators like Hugo, Jekyll and Astro.
- Pages for private repositories needs a paid plan; a **custom domain** is set under **Settings → Pages**.
- Netlify, Vercel and Cloudflare Pages host static sites too, each with its own GitHub integration: the same build → artifact → deploy idea.

:::exercise Publish the price list
`~/shop` can build its price list as a web page (`npm run build` writes `dist/index.html`). Turn on GitHub Pages with workflow builds, and add `.github/workflows/pages.yml`: on every push to `main`, a `build` job tests, builds and uploads `dist` with `actions/upload-pages-artifact@v5`, and a `deploy` job that needs it deploys with `actions/deploy-pages@v5` to the `github-pages` environment. Push; the page must be live at https://ada.github.io/shop/.
```sh starter setup=node-shop-site
npm run build
cat dist/index.html
```
```js check
const gh = await github("ada/shop");
const pages = gh.pages();
if (!pages.enabled) throw new AssertionError("Turn on Pages first: gh api repos/{owner}/{repo}/pages -X POST -f build_type=workflow");
const { wf, errors } = workflow("~/shop/.github/workflows/pages.yml");
if (errors.length) throw new AssertionError(`pages.yml has a problem: line ${errors[0].line}: ${errors[0].message}`);
const perms = { ...(wf.permissions ?? {}), ...(wf.jobs?.deploy?.permissions ?? {}) };
same([perms.pages, perms["id-token"]], ["write", "write"], "The pages and id-token permissions");
const env = wf.jobs?.deploy?.environment;
same(typeof env === "string" ? env : env?.name, "github-pages", "The deploy job's environment");
same([].concat(wf.jobs?.deploy?.needs ?? []), ["build"], "What the deploy job needs");
const run = gh.runs().find((x) => x.workflow === ".github/workflows/pages.yml");
if (!run) throw new AssertionError("There's no run of pages.yml yet: commit and push it.");
same(run.conclusion, "success", "The latest run of pages.yml");
if (!/Bike shop prices/.test(pages.files?.["index.html"] ?? "")) throw new AssertionError("https://ada.github.io/shop/ doesn't show the price list yet.");
```
```sh solution setup=node-shop-site
gh api repos/{owner}/{repo}/pages -X POST -f build_type=workflow --jq .html_url
cat > .github/workflows/pages.yml <<'EOF'
name: Deploy site

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
EOF
actionlint
git add .github/workflows/pages.yml
git commit -m "Deploy the price list to GitHub Pages"
git push
gh run list --workflow pages.yml
curl https://ada.github.io/shop/
```
hint: Pages must know a workflow will publish the site: `gh api repos/{owner}/{repo}/pages -X POST -f build_type=workflow`. Without it, `deploy-pages` fails with `Ensure GitHub Pages has been enabled`.
hint: The `deploy` job needs `permissions` `pages: write` and `id-token: write` (at the top of the file or on the job), `needs: build`, and `environment: name: github-pages`.
hint: `upload-pages-artifact` takes `with: path: dist`; `deploy-pages` needs no inputs. Check with `actionlint`, commit, push, then `curl https://ada.github.io/shop/`.
approach:
1. **Understand:** two jobs: one builds the tested site into an artifact, one publishes that artifact.
2. **Examples:** the lesson's pages.yml.
3. **Brute force:** committing `dist/` and serving it from a branch: built on your laptop, untested, and the repository fills with generated files.
4. **Pattern:** **build → artifact → deploy (with an environment) → smoke test**.
5. **Plan:** enable Pages → write pages.yml → actionlint → commit → push → curl.
6. **Code and test:** `gh run list --workflow pages.yml` shows `✓`, and curl prints the page.
walkthrough:
**Line by line**

- `gh api … -f build_type=workflow` sets the Pages source to GitHub Actions.
- The `build` job ends with the `github-pages` artifact; the `deploy` job, waiting on `needs: build`, publishes it and outputs `page_url`.
- `concurrency: group: pages` queues deployments so two can't overlap.

**Trace:** `curl` prints `<h1>Bike shop prices</h1>` and the three prices.

**Common wrong approach:** leaving out `id-token: write`: the deploy step fails with `Ensure GITHUB_TOKEN has permission "id-token: write"`.
:::

:::exercise Deploy by hand, with a reason
The price list deploys on every push to `main`. Let the shop also deploy it by hand: add a `workflow_dispatch` trigger to `pages.yml` with one **required** input, `reason`, and make the build job print `Deploying because: ` followed by the reason. Push, then start a manual deployment with the reason `Price check`. That run must pass.
```sh starter setup=node-shop-pages
cat .github/workflows/pages.yml
```
```js check
const { wf, errors } = workflow("~/shop/.github/workflows/pages.yml");
if (errors.length) throw new AssertionError(`pages.yml has a problem: line ${errors[0].line}: ${errors[0].message}`);
const wd = wf.on?.workflow_dispatch;
if (!wf.on || !("workflow_dispatch" in wf.on)) throw new AssertionError("Add workflow_dispatch: to on:.");
if (!wd?.inputs?.reason) throw new AssertionError("Give workflow_dispatch an input called reason.");
same(wd.inputs.reason.required, true, "Whether reason is required");
if (!wf.on.push) throw new AssertionError("Keep the push trigger too.");
const gh = await github("ada/shop");
const run = gh.runs().find((x) => x.workflow === ".github/workflows/pages.yml" && x.event === "workflow_dispatch");
if (!run) throw new AssertionError('Start a manual run: gh workflow run pages.yml -f reason="Price check".');
same(run.inputs?.reason, "Price check", "The reason given to the manual run");
same(run.conclusion, "success", "The manual run's result");
if (!/^Deploying because: Price check$/m.test(gh.jobLog(run, "build") ?? "")) throw new AssertionError("The build job should print: Deploying because: Price check");
```
```sh solution setup=node-shop-pages
cat > .github/workflows/pages.yml <<'EOF'
name: Deploy site

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      reason:
        description: Why deploy by hand
        required: true

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - if: github.event_name == 'workflow_dispatch'
        env:
          REASON: ${{ inputs.reason }}
        run: |
          echo "Deploying because: $REASON"
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
EOF
actionlint
git commit -am "Allow manual deployments"
git push
gh workflow run pages.yml -f reason="Price check"
gh run list --workflow pages.yml
```
hint: Under `on:`, next to `push:`, add `workflow_dispatch:` with `inputs:`, then `reason:` with `description:` and `required: true`.
hint: Inside the job, the value is `${{ inputs.reason }}`. It's typed by a person, so pass it through `env:` and print `"$REASON"` (lesson 16).
hint: The workflow must be pushed before `gh workflow run pages.yml -f reason="Price check"` can start it.
approach:
1. **Understand:** a second trigger on the same workflow, with typed input.
2. **Examples:** the lesson's sale announcement with `-f percent=20`.
3. **Brute force:** pushing an empty commit to redeploy: it works, but the history fills with "redeploy" commits and there's no record of why.
4. **Pattern:** **workflow_dispatch + inputs for deliberate, logged actions**.
5. **Plan:** add the trigger and input → print it via env → actionlint → push → gh workflow run.
6. **Code and test:** `gh run list --workflow pages.yml` shows a `workflow_dispatch` run with `✓`.
walkthrough:
**Line by line**

- `workflow_dispatch: inputs: reason: required: true` makes GitHub refuse a manual run without a reason.
- The `if:` limits the message to manual runs (pushes have no inputs); `env:` keeps the typed text out of the script.
- `gh workflow run pages.yml -f reason=…` starts the run on the default branch.

**Trace:** the build job's log shows `Deploying because: Price check`.

**Common wrong approach:** running `gh workflow run` before pushing: GitHub reads the workflow from the branch on GitHub, so it says the workflow has no `workflow_dispatch` trigger.
:::

:::quiz
? Why should the deploy job use an artifact from the build job rather than build again?
+ So it ships exactly the files the tests ran against
- Artifacts make the site load faster
- The deploy job can't run npm
- GitHub Pages only accepts zip files
= Building once means what you tested is what you deploy, with no second build that could differ.
? What does id-token: write let a deploy job do?
+ Request a short-lived OIDC token that proves which workflow and branch it is
- Write to the repository's code
- Read secrets from other repositories
- Skip required reviewers
= OIDC tokens replace stored keys: GitHub Pages and the clouds trust them instead.
? For a deployment workflow, which concurrency setting is safest?
+ A fixed group with cancel-in-progress: false, so deployments queue
- cancel-in-progress: true, so the newest deployment stops the running one
- No concurrency setting at all
- A different group for every run
= Cancelling a deployment halfway can leave production half-updated; queue them instead.
? A required reviewer protects the production environment. What happens when a deploy job targets it?
+ The job waits until a reviewer approves it
- The job fails immediately
- The job runs, and the reviewer is notified afterwards
- The workflow file must be approved first
= Protection rules hold the job before it starts; the reviewer approves (or rejects) the deployment.
:::

@@@ lesson
id: pipelines
title: Fast, reusable pipelines
minutes: 30
summary: Caching dependencies (setup-node's cache, actions/cache, keys and hashFiles), running less with path filters, concurrency and timeouts, sharing steps with reusable workflows (workflow_call) and composite actions, scheduled workflows (cron, UTC and the timezone key, limits), what Actions costs (minutes, runner types, self-hosted runners), other CI systems, and CI for data and AI work.
---
A pipeline people wait ten minutes for gets skipped; one that's copied into twenty repositories drifts apart. This lesson makes pipelines fast, cheap and shared, and looks beyond GitHub Actions.

### Caching

Every job starts on a fresh runner, so everything is downloaded and installed again: often most of a pipeline's time. A **cache** saves a folder at the end of a job and restores it at the start of later ones, looked up by a **key**:

```sh setup=node-shop-ci
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

### Running less

- **Path filters** skip runs that can't matter: `paths-ignore: ['**.md', 'docs/**']` for documentation-only changes. (Careful with required checks: a skipped workflow never reports, which blocks the merge. Keep required workflows unfiltered, or filter inside a job with `if:`.)
- **Concurrency** with `cancel-in-progress: true` and `group: ${{ github.workflow }}-${{ github.ref }}` cancels a branch's older runs when you push again.
- **`timeout-minutes:`** on a job (the default is 360, six hours) stops a stuck job from burning minutes.

### Reusable workflows and composite actions

Copy-pasted pipelines drift. Two ways to share:

- A **reusable workflow** (`on: workflow_call`) is a whole workflow other workflows call as a job, with inputs and secrets. Its jobs show up as `caller / callee`.
- A **composite action** (an `action.yml` with `runs: using: composite`) bundles steps that other jobs use with `uses:`, like `actions/checkout`.

```sh setup=node-shop-ci
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

### Scheduled workflows

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

### What it costs

- Standard GitHub-hosted runners are **free in public repositories**.
- Private repositories get included minutes each month (2,000 on Free, 3,000 on Pro and Team, 50,000 on Enterprise Cloud); after that you pay per minute. From 1 January 2026 GitHub cut hosted runner prices by up to 39%: a standard 2-core Linux runner now costs $0.006 a minute, and Windows and macOS runners cost more.
- **Larger runners** (more CPUs, GPUs, ARM) cost more per minute but can finish sooner.
- **Self-hosted runners** are your own machines running GitHub's runner program: useful for special hardware or private networks. Never use them for public repositories, where anyone's pull request could run code on your machine. A planned per-minute platform charge for self-hosted runners, announced for March 2026, was postponed.

### CI beyond GitHub, and for data and AI work

**GitLab CI/CD** (`.gitlab-ci.yml`), **Jenkins**, **CircleCI**, **Azure Pipelines** and **Buildkite** use different file formats for the same ideas: events, jobs, steps, runners, caches, artifacts, secrets and environments. What you learned here transfers almost one to one.

Pipelines aren't only for application code:

- **Analysts** test SQL against a small sample database, check that notebooks still run from top to bottom, and validate data against a contract (expected columns, no unexpected nulls) before a dashboard refreshes.
- **AI engineers** run an evaluation set on every pull request that changes a prompt or model, fail the run if a quality score drops below a threshold, keep model API keys in secrets, cap spending per run, and schedule larger evaluations nightly.

### Try it on your own computer

- The **Actions → Caches** page of a repository lists its caches; `gh cache list` and `gh cache delete` manage them.
- The billing page (**Settings → Billing**) shows minutes used per workflow; it's worth a look before a bill arrives.
- [act](https://github.com/nektos/act) (0.2.89) runs your workflows locally in Docker containers, which is fast for trying out workflow changes; it needs Docker (Part 4).

:::exercise Share the test job
Turn the shop's test job into a reusable workflow. Create `.github/workflows/test.yml`, triggered by `workflow_call` with a string input `node-version` (default `"24"`), containing a `test` job that checks out, sets up that Node.js version and runs `npm test`. Then change `ci.yml` so its only job, `tests`, calls `./.github/workflows/test.yml` with `node-version: "24"`. Push; the CI run must pass, with the job `tests / test`.
```sh starter setup=node-shop-ci
cat .github/workflows/ci.yml
```
```js check
const t = workflow("~/shop/.github/workflows/test.yml");
if (t.errors.length) throw new AssertionError(`test.yml has a problem: line ${t.errors[0].line}: ${t.errors[0].message}`);
const call = t.wf.on?.workflow_call;
if (!t.wf.on || !("workflow_call" in t.wf.on)) throw new AssertionError("test.yml must be triggered by workflow_call.");
same(call?.inputs?.["node-version"]?.type, "string", "The type of the node-version input");
if (!t.wf.jobs?.test) throw new AssertionError("test.yml needs a job called test.");
const c = workflow("~/shop/.github/workflows/ci.yml");
if (c.errors.length) throw new AssertionError(`ci.yml has a problem: line ${c.errors[0].line}: ${c.errors[0].message}`);
same(Object.keys(c.wf.jobs ?? {}), ["tests"], "The jobs in ci.yml");
same(String(c.wf.jobs.tests.uses), "./.github/workflows/test.yml", "What the tests job uses");
const gh = await github("ada/shop");
const run = gh.runs().find((x) => x.workflowName === "CI");
same(run.jobs.map((j) => j.name), ["tests / test"], "The jobs of the latest CI run");
same(run.conclusion, "success", "The latest CI run's result");
```
```sh solution setup=node-shop-ci
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
hint: A reusable workflow's `on:` is `workflow_call:` with `inputs:`, each with a `type` (`string`, `number` or `boolean`) and optionally a `default`.
hint: Inside test.yml the value is `${{ inputs.node-version }}`.
hint: In ci.yml, the calling job has no `runs-on` or `steps`: just `uses: ./.github/workflows/test.yml` and `with: node-version: "24"`.
approach:
1. **Understand:** the steps move to a workflow that only runs when called; CI calls it.
2. **Examples:** the lesson's example is this exercise.
3. **Brute force:** copying the test job into every workflow that needs it.
4. **Pattern:** **one definition, many callers**: reusable workflows for jobs, composite actions for steps.
5. **Plan:** write test.yml → replace ci.yml's job with a `uses:` job → actionlint → commit → push.
6. **Code and test:** `gh run view <ID>` lists `✓ tests / test`.
walkthrough:
**Line by line**

- `on: workflow_call` means nothing triggers test.yml by itself; it only runs when another workflow calls it.
- `uses: ./.github/workflows/test.yml` at job level (not step level) calls it, from the same commit.
- The job name `tests / test` is caller job / called job.

**Trace:** the run's `setup-node` log shows `node-version: 24`, passed through the input.

**Common wrong approach:** putting `uses: ./.github/workflows/test.yml` under `steps:`: steps can only use actions, so actionlint and GitHub reject it.
:::

:::exercise Skip CI for documentation changes
README edits don't need the tests. Change `ci.yml` so that pushes and pull requests that only change Markdown files (`**.md`) don't start it. Push that change (it changes `ci.yml`, so it runs), then edit `README.md`, commit and push again: that second push must not start a CI run.
```sh starter setup=node-shop-ci
cat .github/workflows/ci.yml
```
```js check
const { wf, errors } = workflow("~/shop/.github/workflows/ci.yml");
if (errors.length) throw new AssertionError(`ci.yml has a problem: line ${errors[0].line}: ${errors[0].message}`);
for (const ev of ["push", "pull_request"]) {
  const pi = wf.on?.[ev]?.["paths-ignore"];
  if (!pi || !pi.some((p) => /\*\*\.md$|\*\*\/\*\.md$/.test(String(p)))) throw new AssertionError(`Add paths-ignore: ['**.md'] to ${ev}.`);
}
if (!JSON.stringify(wf.on.push.branches ?? []).includes("main")) throw new AssertionError("Keep branches: [main] on push.");
const gh = await github("ada/shop");
const log = await gh.log("main");
const runs = gh.runs().filter((x) => x.workflowName === "CI");
const ranFor = new Set(runs.map((x) => x.sha));
const head = log[0];
const headFiles = await gh.files("main"), parentFiles = await gh.files("main~1");
const changed = Object.keys({ ...headFiles, ...parentFiles }).filter((p) => headFiles[p] !== parentFiles[p]);
if (!changed.length || !changed.every((p) => p.endsWith(".md"))) throw new AssertionError("The newest commit on main should change only README.md: edit it, commit and push.");
if (ranFor.has(head.oid)) throw new AssertionError("CI still ran for the README-only commit.");
const filterCommit = log.find((c) => ranFor.has(c.oid));
if (!filterCommit || filterCommit === log[0] || !runs.some((x) => x.sha === log[1].oid && x.conclusion === "success")) throw new AssertionError("The commit that added paths-ignore should have run CI (it changed ci.yml) and passed: push it before the README change.");
```
```sh solution setup=node-shop-ci
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
hint: `paths-ignore:` goes under each event, next to `branches:` for push: `paths-ignore: ['**.md']`. (`pull_request:` then needs a nested map instead of being empty.)
hint: Push the workflow change first: it changes `ci.yml`, which isn't Markdown, so it runs.
hint: Then `echo "…" >> README.md`, commit and push. `gh run list` should show no new CI run for it.
approach:
1. **Understand:** GitHub compares the files a push changed with the patterns before starting the workflow.
2. **Examples:** `**.md` matches `README.md` and `docs/guide.md`.
3. **Brute force:** adding `[skip ci]` to commit messages (GitHub supports it): it works, but people forget, and it skips code changes too if they share a commit.
4. **Pattern:** **filter on paths in the trigger**.
5. **Plan:** add paths-ignore to both events → push → edit README → push → gh run list.
6. **Code and test:** the newest commit (README only) has no row in `gh run list`; the one before has `✓`.
walkthrough:
**Line by line**

- `paths-ignore: ['**.md']` skips a push or pull request when *every* changed file matches.
- The first push changes `ci.yml`, so it runs (and passes); the second changes only `README.md`, so it doesn't.

**Trace:** `gh run list` shows `Skip CI for documentation-only changes` but not `Add opening hours to the README`.

**Common wrong approach:** writing `paths-ignore: '*.md'` with a single `*`: it matches Markdown files in the top folder only, not `docs/guide.md`.
:::

:::quiz
? What makes a good cache key?
+ A fingerprint of the files the cached folder depends on, like hashFiles('package-lock.json')
- The current date
- The run ID
- A fixed string like "cache"
= When the lockfile changes the key changes, so a stale cache is never restored; a fixed key would restore stale files forever.
? When should you use a reusable workflow rather than a composite action?
+ To share whole jobs, with their runners, across workflows or repositories
- To share two or three steps inside a job
- Never; they are the same thing
- Only for scheduled workflows
= Reusable workflows are called as jobs; composite actions are used as steps.
? A schedule says cron: "0 9 * * *" with no timezone. When does it run?
+ Every day at 09:00 UTC, possibly a little later when GitHub is busy
- Every day at 09:00 in the repository owner's timezone
- Every 9 minutes
- At 09:00 on the 9th of every month
= Cron schedules run in UTC unless a timezone is given, and scheduled runs can be delayed at busy times.
? Why not use self-hosted runners for a public repository?
+ Anyone's pull request could run code on your machine
- Self-hosted runners can't run Linux
- They're more expensive than hosted runners
- Public repositories can't use runners
= Fork pull requests run untrusted code; on a self-hosted runner it would run inside your network.
:::
