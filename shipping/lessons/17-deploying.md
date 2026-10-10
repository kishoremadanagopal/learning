# Lesson 17: Continuous delivery with GitHub Actions

**You'll learn:** building once and deploying what was tested, artifacts (upload-artifact, download-artifact, retention, gh run download), GitHub Pages and the GitHub Actions source, upload-pages-artifact and deploy-pages, pages and id-token permissions, the github-pages environment, smoke tests with curl, environments and protection rules (required reviewers, wait timers, deployment branches, environment secrets), workflow_dispatch with typed inputs, deploying on releases and tags, concurrency for deployments, rolling back by reverting or re-running, other static hosts.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#deploying)**: run every example and check your exercise answers.

## Key terms

- **Artifact:** files a job uploads so later jobs, or people, can download them.
- **GitHub Pages:** GitHub's hosting for static websites, at `https://<owner>.github.io/<repository>/`.
- **Environment:** a named deployment target with its own protection rules and secrets.
- **Protection rule:** a condition a job must meet before deploying to an environment, such as a reviewer's approval.
- **Smoke test:** a quick check that a deployment basically works, such as fetching its home page.
- **workflow_dispatch:** the event for starting a workflow by hand, with optional inputs.
- **Rollback:** returning production to a previous good version.
- **Concurrency group:** a name that makes runs queue (or cancel each other) instead of overlapping.

CI tells you a change is good; **CD** puts it in front of users. The shop's price list becomes a web page, and every push to `main` will publish it, tested, within a minute. The same pipeline shape, build → test → deploy, is how containers reach Kubernetes and models reach production in later parts.

## Build once, deploy what you tested

A deployment should ship the exact files the tests ran against, not a fresh build made later on another machine. Jobs pass files to each other as **artifacts**: one job uploads, a later job (in the same run) downloads.

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
echo "dist/" > .gitignore
cat > package.json <<'EOF'
{
  "name": "shop",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test",
    "build": "node build.js"
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
cat > build.js <<'EOF'
import { mkdirSync, writeFileSync } from "node:fs";
import { PRICES, formatPrice } from "./prices.js";

const rows = Object.entries(PRICES)
  .map(([item, cents]) => `    <li>${item}: ${formatPrice(cents)}</li>`)
  .join("\n");
const page = `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8"><title>Bike shop prices</title></head>
  <body>
    <h1>Bike shop prices</h1>
    <ul>
${rows}
    </ul>
  </body>
</html>
`;
mkdirSync("dist", { recursive: true });
writeFileSync("dist/index.html", page);
console.log(`Built dist/index.html with ${Object.keys(PRICES).length} prices`);
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
git add . && git commit -qm "Add the price list, its tests and a web page"
gh repo create shop --public --source=. --push
```

</details>

```bash
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

## Deploying to GitHub Pages

**GitHub Pages** hosts static websites (HTML, CSS, JavaScript) at `https://<owner>.github.io/<repository>/`, free for public repositories. To deploy with a workflow, first tell Pages that a workflow publishes the site (on the website: **Settings → Pages → Source: GitHub Actions**):

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
echo "dist/" > .gitignore
cat > package.json <<'EOF'
{
  "name": "shop",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test",
    "build": "node build.js"
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
cat > build.js <<'EOF'
import { mkdirSync, writeFileSync } from "node:fs";
import { PRICES, formatPrice } from "./prices.js";

const rows = Object.entries(PRICES)
  .map(([item, cents]) => `    <li>${item}: ${formatPrice(cents)}</li>`)
  .join("\n");
const page = `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8"><title>Bike shop prices</title></head>
  <body>
    <h1>Bike shop prices</h1>
    <ul>
${rows}
    </ul>
  </body>
</html>
`;
mkdirSync("dist", { recursive: true });
writeFileSync("dist/index.html", page);
console.log(`Built dist/index.html with ${Object.keys(PRICES).length} prices`);
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
git add . && git commit -qm "Add the price list, its tests and a web page"
gh repo create shop --public --source=. --push
```

</details>

```bash
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

## Environments

An **environment** (`staging`, `production`, `github-pages`) is a named deployment target with its own rules and secrets. Under **Settings → Environments** you can add **protection rules**:

- **Required reviewers** (up to six people or teams): the job waits until one approves it; you can stop people approving their own runs.
- A **wait timer**: the job waits a set number of minutes first, for example to watch a canary.
- **Deployment branches and tags**: only `main` (or tags like `v*`) may deploy. The `github-pages` environment allows only the default branch out of the box.
- **Environment secrets**, given only to jobs that use the environment, so a test job never sees the production key.

The sandbox doesn't pause for reviewers; on GitHub a waiting job shows as **Waiting** with a **Review deployments** button.

## Manual and release deployments

`workflow_dispatch` adds a **Run workflow** button on GitHub, and `gh workflow run`, with optional inputs:

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
echo "dist/" > .gitignore
cat > package.json <<'EOF'
{
  "name": "shop",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test",
    "build": "node build.js"
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
cat > build.js <<'EOF'
import { mkdirSync, writeFileSync } from "node:fs";
import { PRICES, formatPrice } from "./prices.js";

const rows = Object.entries(PRICES)
  .map(([item, cents]) => `    <li>${item}: ${formatPrice(cents)}</li>`)
  .join("\n");
const page = `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8"><title>Bike shop prices</title></head>
  <body>
    <h1>Bike shop prices</h1>
    <ul>
${rows}
    </ul>
  </body>
</html>
`;
mkdirSync("dist", { recursive: true });
writeFileSync("dist/index.html", page);
console.log(`Built dist/index.html with ${Object.keys(PRICES).length} prices`);
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
git add . && git commit -qm "Add the price list, its tests and a web page"
gh repo create shop --public --source=. --push
gh api repos/{owner}/{repo}/pages -X POST -f build_type=workflow > /dev/null
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
git add . && git commit -qm "Deploy the price list to GitHub Pages"
git push -q
```

</details>

```bash
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

## Concurrency and rollbacks

- **`concurrency:`** puts runs with the same `group` in a queue. For deployments use `cancel-in-progress: false`, so a deployment is never cut off halfway; for pull request CI, `cancel-in-progress: true` saves minutes by cancelling runs for commits that are already out of date.
- **Rolling back** a bad deployment: revert the commit and let the pipeline deploy the reverted code, or re-run the deployment of an older, good commit with `gh run rerun <ID>`. Because every deployment came from a commit, "what's in production?" always has an answer. Part 6 adds gentler strategies, rolling updates and canaries, where a bad version reaches only some users first.

## Try it on your own computer

- Turn on Pages for one of your own public repositories and deploy with the workflow above; GitHub's [starter workflows](https://github.com/actions/starter-workflows/tree/main/pages) cover static site generators like Hugo, Jekyll and Astro.
- Pages for private repositories needs a paid plan; a **custom domain** is set under **Settings → Pages**.
- Netlify, Vercel and Cloudflare Pages host static sites too, each with its own GitHub integration: the same build → artifact → deploy idea.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Pass files between jobs | actions/upload-artifact, then actions/download-artifact | the run's artifacts | they expire (90 days by default) |
| Turn on Pages for workflows | gh api repos/{owner}/{repo}/pages -X POST -f build_type=workflow | repository settings | gh api … -X DELETE |
| Deploy a static site | upload-pages-artifact + deploy-pages, with pages and id-token write | the live site | deploy an older commit |
| Deploy by hand | gh workflow run <file> -f name=value | starts a run | — |
| Check a live page | curl -sSf <url> | nothing | — |

## Common mistakes

- Building the site again in the deploy job instead of using the tested artifact.
- Forgetting to set the Pages source to GitHub Actions, or the `pages: write` and `id-token: write` permissions.
- Calling a deployment done without a smoke test.
- Using `cancel-in-progress: true` for deployments, which can stop one halfway.
- Running `gh workflow run` before the `workflow_dispatch` trigger is pushed.

## Exercises

### 1. Publish the price list

`~/shop` can build its price list as a web page (`npm run build` writes `dist/index.html`). Turn on GitHub Pages with workflow builds, and add `.github/workflows/pages.yml`: on every push to `main`, a `build` job tests, builds and uploads `dist` with `actions/upload-pages-artifact@v5`, and a `deploy` job that needs it deploys with `actions/deploy-pages@v5` to the `github-pages` environment. Push; the page must be live at https://ada.github.io/shop/.

<details>
<summary>The sandbox starts this exercise with these commands (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
echo "dist/" > .gitignore
cat > package.json <<'EOF'
{
  "name": "shop",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test",
    "build": "node build.js"
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
cat > build.js <<'EOF'
import { mkdirSync, writeFileSync } from "node:fs";
import { PRICES, formatPrice } from "./prices.js";

const rows = Object.entries(PRICES)
  .map(([item, cents]) => `    <li>${item}: ${formatPrice(cents)}</li>`)
  .join("\n");
const page = `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8"><title>Bike shop prices</title></head>
  <body>
    <h1>Bike shop prices</h1>
    <ul>
${rows}
    </ul>
  </body>
</html>
`;
mkdirSync("dist", { recursive: true });
writeFileSync("dist/index.html", page);
console.log(`Built dist/index.html with ${Object.keys(PRICES).length} prices`);
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
git add . && git commit -qm "Add the price list, its tests and a web page"
gh repo create shop --public --source=. --push
```

</details>

Starter:

```bash
npm run build
cat dist/index.html
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** two jobs: one builds the tested site into an artifact, one publishes that artifact.
2. **Examples:** the lesson's pages.yml.
3. **Brute force:** committing `dist/` and serving it from a branch: built on your laptop, untested, and the repository fills with generated files.
4. **Pattern:** **build → artifact → deploy (with an environment) → smoke test**.
5. **Plan:** enable Pages → write pages.yml → actionlint → commit → push → curl.
6. **Code and test:** `gh run list --workflow pages.yml` shows `✓`, and curl prints the page.

</details>

<details>
<summary>💡 Hint 1</summary>

Pages must know a workflow will publish the site: `gh api repos/{owner}/{repo}/pages -X POST -f build_type=workflow`. Without it, `deploy-pages` fails with `Ensure GitHub Pages has been enabled`.

</details>

<details>
<summary>💡 Hint 2</summary>

The `deploy` job needs `permissions` `pages: write` and `id-token: write` (at the top of the file or on the job), `needs: build`, and `environment: name: github-pages`.

</details>

<details>
<summary>💡 Hint 3</summary>

`upload-pages-artifact` takes `with: path: dist`; `deploy-pages` needs no inputs. Check with `actionlint`, commit, push, then `curl https://ada.github.io/shop/`.

</details>

### 2. Deploy by hand, with a reason

The price list deploys on every push to `main`. Let the shop also deploy it by hand: add a `workflow_dispatch` trigger to `pages.yml` with one **required** input, `reason`, and make the build job print `Deploying because: ` followed by the reason. Push, then start a manual deployment with the reason `Price check`. That run must pass.

<details>
<summary>The sandbox starts this exercise with these commands (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
echo "dist/" > .gitignore
cat > package.json <<'EOF'
{
  "name": "shop",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test",
    "build": "node build.js"
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
cat > build.js <<'EOF'
import { mkdirSync, writeFileSync } from "node:fs";
import { PRICES, formatPrice } from "./prices.js";

const rows = Object.entries(PRICES)
  .map(([item, cents]) => `    <li>${item}: ${formatPrice(cents)}</li>`)
  .join("\n");
const page = `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8"><title>Bike shop prices</title></head>
  <body>
    <h1>Bike shop prices</h1>
    <ul>
${rows}
    </ul>
  </body>
</html>
`;
mkdirSync("dist", { recursive: true });
writeFileSync("dist/index.html", page);
console.log(`Built dist/index.html with ${Object.keys(PRICES).length} prices`);
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
git add . && git commit -qm "Add the price list, its tests and a web page"
gh repo create shop --public --source=. --push
gh api repos/{owner}/{repo}/pages -X POST -f build_type=workflow > /dev/null
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
git add . && git commit -qm "Deploy the price list to GitHub Pages"
git push -q
```

</details>

Starter:

```bash
cat .github/workflows/pages.yml
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a second trigger on the same workflow, with typed input.
2. **Examples:** the lesson's sale announcement with `-f percent=20`.
3. **Brute force:** pushing an empty commit to redeploy: it works, but the history fills with "redeploy" commits and there's no record of why.
4. **Pattern:** **workflow_dispatch + inputs for deliberate, logged actions**.
5. **Plan:** add the trigger and input → print it via env → actionlint → push → gh workflow run.
6. **Code and test:** `gh run list --workflow pages.yml` shows a `workflow_dispatch` run with `✓`.

</details>

<details>
<summary>💡 Hint 1</summary>

Under `on:`, next to `push:`, add `workflow_dispatch:` with `inputs:`, then `reason:` with `description:` and `required: true`.

</details>

<details>
<summary>💡 Hint 2</summary>

Inside the job, the value is `${{ inputs.reason }}`. It's typed by a person, so pass it through `env:` and print `"$REASON"` (lesson 16).

</details>

<details>
<summary>💡 Hint 3</summary>

The workflow must be pushed before `gh workflow run pages.yml -f reason="Price check"` can start it.

</details>

**In the sandbox:** exercises 33–34. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Publish the price list</summary>

```bash
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

**Line by line**

- `gh api … -f build_type=workflow` sets the Pages source to GitHub Actions.
- The `build` job ends with the `github-pages` artifact; the `deploy` job, waiting on `needs: build`, publishes it and outputs `page_url`.
- `concurrency: group: pages` queues deployments so two can't overlap.

**Trace:** `curl` prints `<h1>Bike shop prices</h1>` and the three prices.

**Common wrong approach:** leaving out `id-token: write`: the deploy step fails with `Ensure GITHUB_TOKEN has permission "id-token: write"`.

</details>

<details>
<summary>✅ 2. Deploy by hand, with a reason</summary>

```bash
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

**Line by line**

- `workflow_dispatch: inputs: reason: required: true` makes GitHub refuse a manual run without a reason.
- The `if:` limits the message to manual runs (pushes have no inputs); `env:` keeps the typed text out of the script.
- `gh workflow run pages.yml -f reason=…` starts the run on the default branch.

**Trace:** the build job's log shows `Deploying because: Price check`.

**Common wrong approach:** running `gh workflow run` before pushing: GitHub reads the workflow from the branch on GitHub, so it says the workflow has no `workflow_dispatch` trigger.

</details>

## Quick quiz

1. Why should the deploy job use an artifact from the build job rather than build again?
   - A) So it ships exactly the files the tests ran against
   - B) Artifacts make the site load faster
   - C) The deploy job can't run npm
   - D) GitHub Pages only accepts zip files

2. What does id-token: write let a deploy job do?
   - A) Request a short-lived OIDC token that proves which workflow and branch it is
   - B) Write to the repository's code
   - C) Read secrets from other repositories
   - D) Skip required reviewers

3. For a deployment workflow, which concurrency setting is safest?
   - A) A fixed group with cancel-in-progress: false, so deployments queue
   - B) cancel-in-progress: true, so the newest deployment stops the running one
   - C) No concurrency setting at all
   - D) A different group for every run

4. A required reviewer protects the production environment. What happens when a deploy job targets it?
   - A) The job waits until a reviewer approves it
   - B) The job fails immediately
   - C) The job runs, and the reviewer is notified afterwards
   - D) The workflow file must be approved first

<details>
<summary>Quiz answers</summary>

1. **A) So it ships exactly the files the tests ran against**: Building once means what you tested is what you deploy, with no second build that could differ.
2. **A) Request a short-lived OIDC token that proves which workflow and branch it is**: OIDC tokens replace stored keys: GitHub Pages and the clouds trust them instead.
3. **A) A fixed group with cancel-in-progress: false, so deployments queue**: Cancelling a deployment halfway can leave production half-updated; queue them instead.
4. **A) The job waits until a reviewer approves it**: Protection rules hold the job before it starts; the reviewer approves (or rejects) the deployment.

</details>

---
Previous: [Lesson 16](16-secrets-security.md) · Next: [Lesson 18: Fast, reusable pipelines](18-pipelines.md)
