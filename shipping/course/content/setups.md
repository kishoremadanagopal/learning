# Setups

Named scripts that prepare the sandbox before an example or exercise (`setup=name`). Each runs in a fresh sandbox, silently; the learner's commands then continue from where it ends (usually inside `~/shop`). On your own computer, run the same commands first.

## shop-history

A repository with five commits.

```sh
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
git add README.md && git commit -qm "Add README"
printf "bell 800\npump 3200\n" > prices.txt
git add prices.txt && git commit -qm "Add price list"
echo "lock 2900" >> prices.txt
git commit -qam "Add the bike lock"
sed -i "s/pump 3200/pump 3000/" prices.txt
git commit -qam "Lower the pump price"
echo "Open 9 to 5, Monday to Saturday." > hours.txt
git add hours.txt && git commit -qm "Add opening hours"
```

## shop-work-in-progress

The same repository with uncommitted work: a changed file, a staged file and a new file.

```sh
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt
echo "Open 9 to 5, Monday to Saturday." > hours.txt
git add . && git commit -qm "Start the shop"
echo "Open 9 to 6, Monday to Saturday." > hours.txt
git add hours.txt
echo "tube 600" >> prices.txt
echo "Ideas: sell gloves?" > ideas.txt
```

## shop-branches

A repository with a `main` branch and a branch `add-tubes` that has one extra commit (you're on `main`).

```sh
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt
git add . && git commit -qm "Start the shop"
git switch -qc add-tubes
echo "tube 600" >> prices.txt && git commit -qam "Add inner tubes"
git switch -q main
```

## shop-diverged-branches

`main` and `add-tubes` have both moved on since they split: `main` has new opening hours, `add-tubes` has new prices. They change different files.

```sh
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt
git add . && git commit -qm "Start the shop"
git switch -qc add-tubes
echo "tube 600" >> prices.txt && git commit -qam "Add inner tubes"
git switch -q main
echo "Open 9 to 5, Monday to Saturday." > hours.txt
git add hours.txt && git commit -qm "Add opening hours"
```

## shop-conflict

`main` and `cheaper-bell` both changed the bell's price, differently.

```sh
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt
git add . && git commit -qm "Start the shop"
git switch -qc cheaper-bell
sed -i "s/bell 800/bell 700/" prices.txt && git commit -qam "Lower the bell price"
git switch -q main
sed -i "s/bell 800/bell 850/" prices.txt && git commit -qam "Raise the bell price"
```

## shop-on-github

A repository with three commits, published to GitHub as `ada/shop` with `gh repo create` (you're logged in to the pretend GitHub as `ada`). On your own computer, `gh repo create` uses your own account.

```sh
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
echo "Open 9 to 5, Monday to Saturday." > hours.txt && git add . && git commit -qm "Add opening hours"
gh repo create shop --public --source=. --push
```

## shop-teammate-pushed

`ada/shop` on GitHub, plus a commit your teammate Grace pushed after you last synced: she raised the bell price. Your copy in `~/shop` doesn't know yet. (Grace's copy lives in `/tmp/grace/shop`; on your own computer, a second clone in another folder plays the teammate.)

```sh
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
echo "Open 9 to 5, Monday to Saturday." > hours.txt && git add . && git commit -qm "Add opening hours"
gh repo create shop --public --source=. --push
gh repo clone shop /tmp/grace/shop && cd /tmp/grace/shop
git config user.name "Grace Hopper" && git config user.email grace@example.com
sed -i "s/bell 800/bell 850/" prices.txt && git commit -qam "Raise the bell price"
git push
cd ~/shop
```

## shop-diverged

Like `shop-teammate-pushed`, and you've also made a commit of your own (the lock is cheaper) that isn't pushed yet: your `main` and GitHub's have diverged.

```sh
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
echo "Open 9 to 5, Monday to Saturday." > hours.txt && git add . && git commit -qm "Add opening hours"
gh repo create shop --public --source=. --push
gh repo clone shop /tmp/grace/shop && cd /tmp/grace/shop
git config user.name "Grace Hopper" && git config user.email grace@example.com
sed -i "s/bell 800/bell 850/" prices.txt && git commit -qam "Raise the bell price"
git push
cd ~/shop
sed -i "s/lock 2900/lock 2700/" prices.txt && git commit -qam "Lower the lock price"
```

## shop-feature-behind

`ada/shop` on GitHub. You pushed a branch `add-tubes`; meanwhile Grace changed `main` on GitHub, touching the same line as your branch (the end of the price list).

```sh
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
gh repo create shop --public --source=. --push
git switch -c add-tubes
echo "tube 600" >> prices.txt && git commit -qam "Add inner tubes"
git push -u origin add-tubes
gh repo clone shop /tmp/grace/shop && cd /tmp/grace/shop
git config user.name "Grace Hopper" && git config user.email grace@example.com
echo "helmet 4500" >> prices.txt && git commit -qam "Add helmets"
git push
cd ~/shop
```

## shop-pr-open

`ada/shop` on GitHub with an open pull request #1 from the branch `add-tubes`, written by you (`ada`), waiting for a review from `grace`. You're on `add-tubes`.

```sh
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
gh repo create shop --public --source=. --push
git switch -c add-tubes
echo "tube 600" >> prices.txt && git commit -qam "Add inner tubes"
git push -u origin add-tubes
gh pr create --title "Add inner tubes to the price list" --body "Customers keep asking for spare tubes." --reviewer grace
```

## node-shop

`ada/shop` on GitHub and in `~/shop`: a small Node.js project with a price list (`prices.js`), its tests (`prices.test.js`) and a `package.json` whose `test` script runs them. No workflows yet.

```sh
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

## node-shop-no-script

The same project, but `package.json` has no `test` script yet.

```sh
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

## node-shop-ci

The Node.js project with a CI workflow (`.github/workflows/ci.yml`: tests on every push to `main` and on pull requests), pushed to `ada/shop`, where its first run passed.

```sh
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

## node-shop-red

`node-shop-ci`, plus a commit that changed `formatPrice` and was pushed: its CI run failed.

```sh
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

## node-shop-site

`node-shop-ci`, plus `build.js`, which writes the price list as a web page to `dist/index.html` (`npm run build`). `dist/` is ignored by Git.

```sh
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

## node-shop-broken-ci

`node-shop`, plus a workflow file with mistakes in it that was pushed anyway: GitHub couldn't read it, so its run failed straight away.

```sh
@include node-shop
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

## node-shop-notify

`node-shop-ci`, plus `notify.sh`, an executable script that tells the shop's system about each build. It needs the `SHOP_API_TOKEN` environment variable.

```sh
@include node-shop-ci
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

## node-shop-inject

`node-shop-ci`, plus `.github/workflows/announce.yml`, a workflow with two security problems: it puts the commit message straight into a script, and gives its token every permission.

```sh
@include node-shop-ci
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

## node-shop-pages

`node-shop-site` with GitHub Pages turned on and `.github/workflows/pages.yml` deploying the price list on every push to `main`. The site is live at https://ada.github.io/shop/.

```sh
@include node-shop-site
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
