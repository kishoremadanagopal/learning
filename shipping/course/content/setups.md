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

## docker-shop

`~/shop`: the bike shop as a small web API, `server.js` (Node.js's built-in `node:http`, no packages to install), with the price list from Part 3, its tests, `package.json` and `package-lock.json`, committed with Git. No Dockerfile yet.

```sh
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
cat > package.json <<'EOF'
{
  "name": "shop",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "test": "node --test"
  }
}
EOF
cat > package-lock.json <<'EOF'
{
  "name": "shop",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "shop",
      "version": "1.0.0"
    }
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
cat > server.js <<'EOF'
import http from "node:http";
import fs from "node:fs";
import { PRICES, total } from "./prices.js";

const port = Number(process.env.PORT ?? 3000);
const shopName = process.env.SHOP_NAME ?? "the bike shop";
const ordersFile = "data/orders.jsonl";
fs.mkdirSync("data", { recursive: true });

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  if (req.url === "/") {
    res.end(`Welcome to ${shopName}!\n`);
  } else if (req.url === "/prices") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(PRICES) + "\n");
  } else if (req.url === "/health") {
    res.end("ok\n");
  } else if (req.url === "/orders" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const order = JSON.parse(body);    // a body that isn't JSON throws here
      const line = JSON.stringify({ items: order.items, total: total(order.items) });
      fs.appendFileSync(ordersFile, line + "\n");
      res.statusCode = 201;
      res.end(line + "\n");
    });
  } else if (req.url === "/orders") {
    res.end(fs.existsSync(ordersFile) ? fs.readFileSync(ordersFile, "utf8") : "");
  } else {
    res.statusCode = 404;
    res.end("Not found\n");
  }
});

server.listen(port, () => console.log(`Shop listening on port ${port}`));
EOF
git add . && git commit -qm "Add the shop's web API"
```

## docker-shop-built

The shop with a `.dockerignore` and the Dockerfile from the end of lesson 21 (production settings, a cache-friendly order, a non-root user), built as the image `shop:1.0`. No containers yet.

```sh
@include docker-shop
cat > .dockerignore <<'EOF'
node_modules
npm-debug.log
.git
.env
data
*.md
EOF
cat > Dockerfile <<'EOF'
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p data && chown node:node data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
EOF
git add . && git commit -qm "Package the shop as a container image"
docker build -q -t shop:1.0 . > /dev/null
```

## docker-shop-running

`shop:1.0` running in the background as the container `shop`, with port 8080 on your computer published to port 3000 in the container.

```sh
@include docker-shop-built
docker run -d -p 8080:3000 --name shop shop:1.0 > /dev/null
```

## docker-mess

Leftovers from trying Docker: two finished `hello-world` containers and an `alpine` one, an `nginx` container still running as `web` (on port 8080), and the images they came from, plus `node:24-slim`.

```sh
docker run hello-world > /dev/null
docker run hello-world > /dev/null
docker run alpine echo "hi" > /dev/null
docker run -d -p 8080:80 --name web nginx:alpine > /dev/null
docker pull -q node:24-slim > /dev/null
```

## docker-shop-broken

The shop with a Dockerfile that doesn't build.

```sh
@include docker-shop
cat > Dockerfile <<'EOF'
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY sever.js prices.js ./
EXPOS 3000
CMD node server.js
EOF
```

## docker-shop-slow

The shop with a Dockerfile that copies everything before installing dependencies, built as `shop:1.0`.

```sh
@include docker-shop
printf 'node_modules\n.git\ndata\n*.md\n' > .dockerignore
cat > Dockerfile <<'EOF'
FROM node:24-alpine
WORKDIR /app
COPY . .
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["node", "server.js"]
EOF
docker build -q -t shop:1.0 . > /dev/null
```

## docker-compose-shop

The built shop API plus a storefront in `web/` that shows the prices it gets from the API over HTTP (its address comes from the `API_URL` variable). Both have Dockerfiles; there's no `compose.yaml` yet.

```sh
@include docker-shop-built
mkdir -p web
cat > web/package.json <<'EOF'
{
  "name": "storefront",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js"
  }
}
EOF
cat > web/server.js <<'EOF'
import http from "node:http";

const port = Number(process.env.PORT ?? 8080);
const api = process.env.API_URL ?? "http://localhost:3000";

const server = http.createServer(async (req, res) => {
  console.log(`${req.method} ${req.url}`);
  try {
    const prices = await (await fetch(`${api}/prices`)).json();
    const rows = Object.entries(prices).map(([item, cents]) => `  <li>${item}: ${(cents / 100).toFixed(2)}</li>`);
    res.setHeader("Content-Type", "text/html");
    res.end(`<h1>Bike shop</h1>\n<ul>\n${rows.join("\n")}\n</ul>\n`);
  } catch (err) {
    console.error(`Can't reach the API at ${api}: ${err.cause?.code ?? err.message}`);
    res.statusCode = 502;
    res.end("The shop is closed for a moment.\n");
  }
});

server.listen(port, () => console.log(`Storefront listening on port ${port}`));
EOF
cat > web/Dockerfile <<'EOF'
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json server.js ./
USER node
EXPOSE 8080
CMD ["node", "server.js"]
EOF
echo "web" >> .dockerignore
git add . && git commit -qm "Add the storefront"
```

## docker-compose-broken

The shop and storefront with a `compose.yaml` copied from an old tutorial: the storefront starts, but every page says the shop is closed.

```sh
@include docker-compose-shop
cat > compose.yaml <<'EOF'
version: "3.8"

services:
  api:
    build: .
  web:
    build: ./web
    ports:
      - "8080:8080"
    environment:
      API_URL: http://localhost:3000
EOF
```

## docker-shop-gh

The built shop (`shop:1.0`) on GitHub as `ada/shop`, with no workflows yet.

```sh
@include docker-shop-built
gh repo create shop --public --source=. --push > /dev/null
```

## docker-pulled

What the first examples of lesson 19 leave behind: the `hello-world` container that ran (and stopped), and the images `hello-world`, `node:24-alpine`, `node:26-alpine` and `alpine`.

```sh
docker run hello-world > /dev/null
docker run --rm node:24-alpine node --version > /dev/null
docker run --rm node:26-alpine node --version > /dev/null
docker run --rm alpine cat /etc/os-release > /dev/null
```

## docker-shop-v1

The shop with lesson 20's first Dockerfile (it copies everything, and there's no `.dockerignore`), built as `shop:1.0`.

```sh
@include docker-shop
cat > Dockerfile <<'EOF'
FROM node:24-alpine
WORKDIR /app
COPY . .
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["node", "server.js"]
EOF
docker build -q -t shop:1.0 . > /dev/null
```

## docker-compose-up

The shop and storefront started with a first `compose.yaml` (`api` built from `.`, `web` from `./web` on port 8080, with `API_URL=http://api:3000`).

```sh
@include docker-compose-shop
cat > compose.yaml <<'EOF'
services:
  api:
    build: .
  web:
    build: ./web
    ports:
      - "8080:8080"
    environment:
      API_URL: http://api:3000
EOF
docker compose up -d > /dev/null 2>&1
```

## docker-shop-token

The built shop, and a personal access token (classic) for `ghcr.io` with the `write:packages` scope in the environment variable `CR_PAT`, as you'd keep one in a password manager and export it for a session. (The sandbox's tokens are made up.)

```sh
@include docker-shop-built
export CR_PAT=ghp_8kQ2vX7mN4pR1sT6wY9zA3bC5dE0fG2hJ4kL
```

## docker-shop-pushed

`shop:1.0` pushed to `ghcr.io/ada/shop:1.0` (a private package), logged in with `CR_PAT`.

```sh
@include docker-shop-token
docker tag shop:1.0 ghcr.io/ada/shop:1.0
echo "$CR_PAT" | docker login ghcr.io -u ada --password-stdin > /dev/null 2>&1
docker push ghcr.io/ada/shop:1.0 > /dev/null
```

## docker-shop-ci

`ada/shop` on GitHub with the `Docker` workflow from lesson 24, which built and pushed `ghcr.io/ada/shop:main` and `ghcr.io/ada/shop:sha-…` on its first run.

```sh
@include docker-shop-gh
mkdir -p .github/workflows
cat > .github/workflows/docker.yml <<'EOF'
name: Docker

on:
  push:
    branches: [main]
    tags: ["v*"]

permissions:
  contents: read
  packages: write

jobs:
  image:
    runs-on: ubuntu-latest
    steps:
      - uses: docker/setup-buildx-action@v4
      - uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v6
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha
      - uses: docker/build-push-action@v7
        with:
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
EOF
git add .github/workflows/docker.yml
git commit -qm "Build and push the image"
git push -q
```
