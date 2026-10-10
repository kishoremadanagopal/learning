# Lesson 16: Secrets, permissions and safe workflows

**You'll learn:** env, configuration variables and secrets, gh variable set and gh secret set, masking and its limits, environment secrets, secrets and fork pull requests, the GITHUB_TOKEN, default read-only permissions, the permissions key and least privilege, script injection through expressions and the env fix, third-party actions as a supply-chain risk, the tj-actions compromise of March 2025, pinning to commit SHAs, Dependabot for actions, SHA-pinning policies, pull_request_target and pwn requests, checkout v7's refusal of fork code, OIDC instead of stored cloud keys, zizmor.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#secrets-security)**: run every example and check your exercise answers.

## Key terms

- **Secret:** an encrypted value stored on GitHub, given to workflows as `${{ secrets.NAME }}` and masked in logs.
- **Configuration variable:** a non-secret value stored on GitHub, read as `${{ vars.NAME }}`.
- **Masking:** replacing a secret's value with `***` in logs.
- **GITHUB_TOKEN:** the short-lived token each job gets to use GitHub's API for its repository.
- **Least privilege:** giving a token or person only the permissions they need.
- **Script injection:** untrusted text ending up inside a script and running as code.
- **Supply-chain attack:** an attack through software you depend on, such as a compromised action.
- **Pinning:** referring to an exact, unchangeable version, such as a full commit SHA.
- **Dependabot:** GitHub's bot that opens pull requests to update dependencies, including actions.
- **OIDC (OpenID Connect):** a standard for short-lived identity tokens; clouds accept a job's OIDC token instead of a stored key.

A workflow runs code with credentials: its own token, and any secrets you give it. That makes CI one of the most attractive targets in a company. This lesson covers keeping secrets secret and keeping other people's code out of your pipeline.

## Variables and secrets

Three ways to give a workflow a value:

| | Set with | Read as | Use for |
|---|---|---|---|
| `env:` in the file | editing the workflow | `$NAME` in scripts, `${{ env.NAME }}` | values that may be public and belong with the code |
| configuration **variable** | `gh variable set NAME --body …` | `${{ vars.NAME }}` | non-secret settings you change without a commit |
| **secret** | `gh secret set NAME --body …` | `${{ secrets.NAME }}` | passwords, API keys, tokens |

Secrets are encrypted at rest; once set, no one can read them back (`gh secret list` shows names and dates only), and GitHub replaces their values with `***` anywhere they'd appear in a log:

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

## The GITHUB_TOKEN and permissions

Every job gets a short-lived token, `secrets.GITHUB_TOKEN` (also `github.token`), that lets it talk to GitHub's API for its own repository: comment on a pull request, create a release, push a commit. It expires when the job ends. Repositories created since February 2023 give it **read-only** access by default; you can see the permissions at the top of every job's log, under **GITHUB_TOKEN Permissions**.

Grant only what a workflow needs, at the top of the file or per job:

```yaml
permissions:
  contents: read          # read the code
  pull-requests: write    # comment on pull requests
```

Listing any permission sets every unlisted one to `none`. `permissions: write-all` hands a stolen token everything; never use it.

## Script injection

Expressions are replaced **before** the shell runs. If an expression contains text someone else controls (a pull request title, a branch name, an issue body, a commit message), that text becomes part of your script:

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
cat > .github/workflows/announce.yml <<'EOF'
name: Announce

on:
  push:
    branches: [main]

permissions: write-all

jobs:
  announce:
    runs-on: ubuntu-latest
    steps:
      - run: |
          echo "Now on main: ${{ github.event.head_commit.message }}"
EOF
git add . && git commit -qm "Announce every change on main"
git push -q
```

</details>

```bash
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

## Third-party actions and pinning

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

## Pull requests from forks

On a public repository anyone can fork and open a pull request, and the `pull_request` event runs *their* code. GitHub limits the damage: fork pull requests get a read-only token and no secrets, and first-time contributors' runs wait for a maintainer's approval. The `pull_request_target` event runs in the context of *your* repository, with secrets and a write token, so it must never check out and run the fork's code ("pwn requests"). `actions/checkout@v7` now refuses to check out fork code under `pull_request_target` unless you explicitly opt in.

## OIDC: no long-lived cloud keys

Deploying to a cloud used to mean storing a cloud access key as a secret: powerful, long-lived, and painful to rotate. With **OpenID Connect (OIDC)** the job asks GitHub for a short-lived signed token (`permissions: id-token: write`) that says "this is a job in `ada/shop` on `main`", and the cloud account trusts that instead of a stored key. AWS, Azure and Google Cloud all support it; Part 7 uses it, and GitHub Pages deployments use it already.

## Try it on your own computer

- [zizmor](https://github.com/zizmorcore/zizmor) is a static analyser for workflow security: it finds injection, excessive permissions and unpinned actions. Run it in CI too.
- Turn on **Dependabot** and **secret scanning** under **Settings → Advanced Security** (both free for public repositories).
- `gh secret set NAME < file.txt` reads a secret from a file instead of the command line, so it doesn't end up in your shell history.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Store a secret | gh secret set NAME --body "…" | encrypted repository secret | gh secret delete NAME |
| Store a setting | gh variable set NAME --body "…" | repository variable | gh variable delete NAME |
| Give a step a secret | env: NAME: ${{ secrets.NAME }} | the workflow file | remove it |
| Limit the token | permissions: contents: read | the workflow file | remove the permissions block |
| Use untrusted text safely | env: X: ${{ … }}, then "$X" in the script | the workflow file | — |
| Pin an action | uses: owner/action@<full SHA> # vX.Y.Z | the workflow file | use the tag again |

## Common mistakes

- Writing a secret's value in the workflow file or a committed `.env`.
- Printing secrets, or transformed secrets, in logs.
- Putting `${{ github.event… }}` values straight into `run:` scripts.
- Using `permissions: write-all`, or no permissions block in a repository with a write-all default.
- Using third-party actions by a movable tag, or checking out fork code in `pull_request_target`.

## Exercises

### 1. Use a secret, safely

`~/shop` has a script, `notify.sh`, that tells the shop's system about each build. It reads a token from the environment variable `SHOP_API_TOKEN`. Store the token `tok_live_83d1c47e` as a repository secret called `SHOP_API_TOKEN`, then add a step at the end of the `test` job in `ci.yml` that runs `./notify.sh`, with `SHOP_API_TOKEN` set from the secret through the step's `env:`. Push; the run must pass, and the token must not appear in its log.

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
cat > notify.sh <<'EOF'
#!/usr/bin/env bash
set -e
if [ -z "$SHOP_API_TOKEN" ]; then
  echo "::error::SHOP_API_TOKEN is not set"
  exit 1
fi
echo "Telling the shop about commit $GITHUB_SHA (token: $SHOP_API_TOKEN)"
EOF
chmod +x notify.sh
git add notify.sh && git commit -qm "Add the notify script"
git push -q
```

</details>

Starter:

```bash
cat notify.sh
cat .github/workflows/ci.yml
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** the secret lives on GitHub; the workflow maps it into one step's environment.
2. **Examples:** the lesson's `PAYMENTS_KEY` example.
3. **Brute force:** writing the token in the workflow file publishes it to everyone who can read the repository, forever.
4. **Pattern:** **secret → env: → script reads the variable**.
5. **Plan:** gh secret set → add the step → actionlint → commit → push → read the log.
6. **Code and test:** the log line reads `Telling the shop about commit … (token: ***)`.

</details>

<details>
<summary>💡 Hint 1</summary>

`gh secret set SHOP_API_TOKEN --body "tok_live_83d1c47e"` stores the secret on GitHub.

</details>

<details>
<summary>💡 Hint 2</summary>

The new step goes at the end of `steps:` (indented like the others): `- name: Notify the shop`, then `env:` with `SHOP_API_TOKEN: ${{ secrets.SHOP_API_TOKEN }}`, then `run: ./notify.sh`. Appending with `cat >> .github/workflows/ci.yml <<'EOF'` works because the steps are at the end of the file.

</details>

<details>
<summary>💡 Hint 3</summary>

Run `actionlint`, commit, push, then look for `Telling the shop` in the run's log: the token shows as `***`.

</details>

### 2. Close the injection hole

`~/shop/.github/workflows/announce.yml` has two security problems: it puts the commit message straight into its script, and it gives its token every permission. Fix both: pass the message through an environment variable called `MESSAGE` (the script then uses `$MESSAGE`), and give the token only `contents: read`. Push your fix with any commit message; the Announce run must pass.

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
cat > .github/workflows/announce.yml <<'EOF'
name: Announce

on:
  push:
    branches: [main]

permissions: write-all

jobs:
  announce:
    runs-on: ubuntu-latest
    steps:
      - run: |
          echo "Now on main: ${{ github.event.head_commit.message }}"
EOF
git add . && git commit -qm "Announce every change on main"
git push -q
```

</details>

Starter:

```bash
cat .github/workflows/announce.yml
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** expressions are pasted into the script; environment variables are passed beside it.
2. **Examples:** the lesson's commit message that closed a quote and ran a command.
3. **Brute force:** escaping quotes in the expression: attackers have more tricks than you have escapes.
4. **Pattern:** **untrusted input → env: → "$VARIABLE"**, and **least privilege**.
5. **Plan:** permissions → env → script → actionlint → commit → push.
6. **Code and test:** a commit message containing `"` is printed as text, and the run's **GITHUB_TOKEN Permissions** show `Contents: read`.

</details>

<details>
<summary>💡 Hint 1</summary>

`permissions: contents: read` (two lines) replaces `permissions: write-all`.

</details>

<details>
<summary>💡 Hint 2</summary>

Give the step an `env:` with `MESSAGE: ${{ github.event.head_commit.message }}`, and change the script to `echo "Now on main: $MESSAGE"`.

</details>

<details>
<summary>💡 Hint 3</summary>

Rewriting the whole file with a heredoc is easiest. Then `actionlint`, commit (a message with quotes in it is a good test), and push.

</details>

**In the sandbox:** exercises 31–32. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Use a secret, safely</summary>

```bash
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

**Line by line**

- `gh secret set` encrypts and stores the value; the workflow file only names it.
- `env: SHOP_API_TOKEN: ${{ secrets.SHOP_API_TOKEN }}` gives the value to this step only.
- `notify.sh` is executable in the repository (mode `100755`), so the runner can run `./notify.sh`.

**Trace:** the step's log shows `SHOP_API_TOKEN: ***` under `env:` and `(token: ***)` in the output.

**Common wrong approach:** `run: ./notify.sh ${{ secrets.SHOP_API_TOKEN }}`: it works, but puts the secret into the script text, where an injection or a careless `set -x` can expose it.

</details>

<details>
<summary>✅ 2. Close the injection hole</summary>

```bash
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

**Line by line**

- `permissions: contents: read` leaves the token able to read code and nothing else (plus `Metadata: read`, which every token has).
- `MESSAGE` holds the commit message as data; `"$MESSAGE"` inside double quotes is never split or run.

**Trace:** with the message `Fix "announce": pass the message as data`, the log shows exactly that text after `Now on main:`.

**Common wrong approach:** quoting the expression with single quotes, `echo '${{ … }}'`: a message containing `'` breaks out just as easily.

</details>

## Quick quiz

1. Where should a database password used by a workflow live?
   - A) In a secret, read with ${{ secrets.NAME }}
   - B) In env: at the top of the workflow file
   - C) In a configuration variable (vars)
   - D) In a comment in the workflow

2. Why is run: echo "${{ github.event.pull_request.title }}" dangerous?
   - A) The title is pasted into the script before it runs, so a crafted title can run commands
   - B) Pull request titles can't contain spaces
   - C) Expressions don't work in run:
   - D) It prints a secret

3. Why pin a third-party action to a full commit SHA?
   - A) A SHA can't be moved to different code, unlike a tag
   - B) SHAs run faster than tags
   - C) GitHub requires it
   - D) Tags don't work with uses:

4. A workflow lists permissions: contents: read. What can its GITHUB_TOKEN do with issues?
   - A) Nothing; unlisted permissions become none
   - B) Read and write them
   - C) Only read them
   - D) Whatever the repository default allows

<details>
<summary>Quiz answers</summary>

1. **A) In a secret, read with ${{ secrets.NAME }}**: Secrets are encrypted and masked; the workflow file and variables are readable by anyone who can read the repository.
2. **A) The title is pasted into the script before it runs, so a crafted title can run commands**: Anyone opening a pull request controls its title. Pass it through env: and use "$TITLE".
3. **A) A SHA can't be moved to different code, unlike a tag**: In March 2025, tags of a compromised action were moved to malicious code; pinned SHAs were unaffected.
4. **A) Nothing; unlisted permissions become none**: Listing any permission sets every unlisted permission to none (metadata stays readable).

</details>

---
Previous: [Lesson 15](15-workflow-syntax.md) · Next: [Lesson 17: Continuous delivery with GitHub Actions](17-deploying.md)
