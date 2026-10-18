# Lesson 24: Publishing images and building them in CI

**You'll learn:** registries (Docker Hub, ghcr.io, cloud registries), full image names, docker tag, docker push and why it's refused without a login, personal access tokens (classic) and write:packages, docker login --password-stdin, ~/.docker/config.json and credential helpers, private packages on ghcr.io and pulling after login, docker logout, choosing tags (versions, SHAs, branches, latest), building in GitHub Actions with docker/setup-buildx-action, docker/login-action, docker/metadata-action and docker/build-push-action, permissions: packages: write and the GITHUB_TOKEN, labels linking a package to its repository, the Git context of build-push-action, releasing with a Git tag (semver tags and latest), multi-platform images (QEMU, ARM runners), provenance attestations, SBOMs and gh attestation verify.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#publishing)**: run every example and check your exercise answers.

## Key terms

- **Push:** upload an image's layers and manifest to a registry.
- **Pull:** download an image from a registry.
- **Personal access token (classic):** a GitHub token with scopes, which ghcr.io accepts as a password.
- **Credential helper:** a program that stores registry logins in the operating system's keychain.
- **GITHUB_TOKEN:** the token a workflow run gets automatically; permissions: decides what it can do.
- **Semantic version tags:** 1.2.0, 1.2 and 1 tags computed from a Git tag v1.2.0.
- **Multi-platform image:** one name with variants for several CPU architectures, such as amd64 and arm64.
- **Provenance attestation:** a record of how and where an image was built, attached to it.

An image on your computer helps nobody else. A **registry** stores images so that servers, teammates and CI can pull them: Docker Hub (`docker.io`), GitHub Container Registry (`ghcr.io`), and every cloud's own (Amazon ECR, Google Artifact Registry, Azure Container Registry). This lesson publishes the shop to `ghcr.io`, free for public images, by hand and then from GitHub Actions.

## Image names point to registries

The full name says where an image lives: `ghcr.io/ada/shop:1.0` is the repository `ada/shop` on `ghcr.io`, tag `1.0`. Names without a registry mean Docker Hub. To push an image, give it a name in the registry first; `docker tag` adds a name to an existing image, without copying anything:

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

</details>

*This example raises an error on purpose.*

```bash
docker tag shop:1.0 ghcr.io/ada/shop:1.0
docker images
docker push ghcr.io/ada/shop:1.0
```

Both names have the same ID: one image, two names. The push fails because the registry doesn't know who you are.

## Log in with a token

`ghcr.io` doesn't take your GitHub password. It takes a **personal access token (classic)** with the `write:packages` scope (fine-grained tokens don't work with packages yet). Never type a token as an argument, where it lands in your shell history; pipe it in with `--password-stdin`:

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
export CR_PAT=ghp_8kQ2vX7mN4pR1sT6wY9zA3bC5dE0fG2hJ4kL
```

</details>

```bash
docker tag shop:1.0 ghcr.io/ada/shop:1.0
echo "$CR_PAT" | docker login ghcr.io -u ada --password-stdin
docker push ghcr.io/ada/shop:1.0
cat ~/.docker/config.json
```

The push sent every layer, then the image's **digest**. Note the warning: Docker saved your login in `~/.docker/config.json`, and `auth` is just base64, which anyone can decode. Docker Desktop stores logins in the operating system's keychain instead; on Linux, configure a [credential helper](https://docs.docker.com/go/credential-store/).

A new package on `ghcr.io` is **private**: other people (and servers that aren't logged in) can't pull it until you make it public in the package's settings on GitHub. Pulling it on a server works after `docker login`:

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
export CR_PAT=ghp_8kQ2vX7mN4pR1sT6wY9zA3bC5dE0fG2hJ4kL
docker tag shop:1.0 ghcr.io/ada/shop:1.0
echo "$CR_PAT" | docker login ghcr.io -u ada --password-stdin > /dev/null 2>&1
docker push ghcr.io/ada/shop:1.0 > /dev/null
```

</details>

```bash
docker rmi ghcr.io/ada/shop:1.0
docker logout ghcr.io
docker pull ghcr.io/ada/shop:1.0
echo "$CR_PAT" | docker login ghcr.io -u ada --password-stdin 2> /dev/null
docker pull ghcr.io/ada/shop:1.0
```

Layers the computer already has say `Already exists`; only the shop's own layers are downloaded.

## Which tags?

A tag is a movable label, so choose tags people can rely on:

- **Versions** (`1.2.0`, plus `1.2` and `1` that move to the newest patch) for releases.
- **Commit SHAs** (`sha-a1b2c3d`) so every build can be traced back to its code.
- **Branch names** (`main`) for "the newest build of main", handy for test environments.
- **`latest`** only as a convenience: production should run a specific version or digest, so you know what's running and can roll back.

## Build and push from GitHub Actions

Pushing by hand means images built from whatever happened to be on your laptop. CI builds from the commit, every time. Docker's official actions do the work:

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
gh repo create shop --public --source=. --push > /dev/null
```

</details>

```bash
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
gh run list
gh run view 22417304019 --log | grep -A3 "Docker tags" | cut -f3
```

- `permissions: packages: write` lets the job's automatic `GITHUB_TOKEN` push to the repository's own packages; no personal token needed.
- `setup-buildx-action` starts a BuildKit builder; `login-action` logs in and logs out again in its post step.
- `metadata-action` turns the event into tags and labels: on a push to `main`, `main` and `sha-…`; on a tag `v1.2.0`, `1.2.0`, `1.2` and `latest`. Its labels (`org.opencontainers.image.source` and others) link the package to the repository on GitHub.
- `build-push-action` builds and pushes. Without a `context` input it builds straight from the pushed commit on GitHub, so it doesn't even need `actions/checkout` (add `context: .` and a checkout step if earlier steps generate files the image needs).

A release is then just a Git tag:

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
gh repo create shop --public --source=. --push > /dev/null
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

</details>

```bash
git tag v1.2.0
git push -q origin v1.2.0
gh run list
gh run view 22417308038 --log | grep -A4 "Docker tags" | cut -f3
```

## Multi-platform images and attestations

Laptops with Apple silicon and many cloud servers use ARM processors, while GitHub's standard runners are x86 (`amd64`). An image built for one doesn't run natively on the other. `docker/build-push-action` can build for several platforms into one name: add `docker/setup-qemu-action@v4` before Buildx and `platforms: linux/amd64,linux/arm64`, and Docker pulls the right variant on each machine. Emulated builds are slow; GitHub's ARM runners (`runs-on: ubuntu-24.04-arm`, free for public repositories) build ARM images natively.

The build also attaches a **provenance attestation**, a record of which workflow, commit and builder produced the image, and `sbom: true` adds a software bill of materials. `actions/attest-build-provenance` signs one that `gh attestation verify oci://ghcr.io/ada/shop:1.2.0 --owner ada` can check, so a server can prove an image came from your CI.

## Try it on your own computer

- Create a personal access token (classic) with only `write:packages` at [github.com/settings/tokens](https://github.com/settings/tokens) (selecting it also ticks `repo` for private repositories; untick it if you don't need it), and store it in a password manager.
- Push a workflow like the one above to a repository of yours; the image appears under **Packages** on the repository's page, private at first. Make it public in **Package settings → Change visibility**.
- To use Docker Hub instead, create a free account and an access token at [app.docker.com](https://app.docker.com/), log in with `docker login -u USER`, and name images `USER/shop:1.0`.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Name an image for a registry | docker tag SOURCE ghcr.io/OWNER/NAME:TAG | adds a name | docker rmi ghcr.io/OWNER/NAME:TAG |
| Log in to a registry | docker login ghcr.io -u USER --password-stdin (token on standard input) | stores credentials | docker logout ghcr.io |
| Upload an image | docker push ghcr.io/OWNER/NAME:TAG | the registry | delete the version on GitHub |
| Download an image | docker pull IMAGE | adds an image | docker rmi IMAGE |
| Build and push in CI | docker/build-push-action with push: true | the registry | — |
| Release a version | git tag v1.2.0; git push origin v1.2.0 | starts the workflow | — |

## Common mistakes

- Pushing shop:1.0 without a registry in the name.
- Passing a token with docker login -p, which leaves it in the shell history.
- Forgetting permissions: packages: write in the workflow.
- Running latest in production, so nobody knows which version is live.
- Expecting a new ghcr.io package to be public.
- Building only for amd64 and running the image on an ARM server.

## Exercises

### 1. Push by hand

Publish `shop:1.0` to GitHub Container Registry as `ghcr.io/ada/shop:1.0`. A personal access token (classic) with `write:packages` is in the environment variable `CR_PAT`. Log in without putting the token on the command line, and push.

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
export CR_PAT=ghp_8kQ2vX7mN4pR1sT6wY9zA3bC5dE0fG2hJ4kL
```

</details>

Starter:

```bash
docker images
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** the image's name decides where it's pushed, and the registry needs a login.
2. **Examples:** `docker push shop:1.0` would try Docker Hub's official library, which you can't push to.
3. **Brute force:** `docker login -p TOKEN` works but leaks the token into your history and process list.
4. **Pattern:** **tag with the registry's name, log in through stdin, push**.
5. **Plan:** `docker tag` → `docker login --password-stdin` → `docker push`.
6. **Code and test:** the push ends with `1.0: digest: sha256:… size: 856`.

</details>

<details>
<summary>💡 Hint 1</summary>

First give the image its registry name with `docker tag SOURCE TARGET`.

</details>

<details>
<summary>💡 Hint 2</summary>

`echo "$CR_PAT" | docker login ghcr.io -u ada --password-stdin` sends the token through standard input.

</details>

<details>
<summary>💡 Hint 3</summary>

Then `docker push ghcr.io/ada/shop:1.0`.

</details>

### 2. Publish from CI

`ada/shop` has no workflows yet. Add `.github/workflows/docker.yml` that runs on pushes to `main` and on tags starting with `v`, gives the token `contents: read` and `packages: write`, logs in to `ghcr.io` with the `GITHUB_TOKEN`, computes tags with `docker/metadata-action@v6` for `ghcr.io/ada/shop` (the branch name, `{{version}}` for version tags, and the commit SHA), and builds and pushes with `docker/build-push-action@v7`. Push it, then release version 1.0.0 with the Git tag `v1.0.0`.

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
gh repo create shop --public --source=. --push > /dev/null
```

</details>

Starter:

```bash
gh run list
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** CI should build the image from each pushed commit and publish it under tags people can use.
2. **Examples:** on `main`, metadata-action produces `main` and `sha-…`; on `v1.0.0`, `1.0.0` and `latest`.
3. **Brute force:** `docker build` and `docker push` in `run:` steps with a stored personal token: more to maintain, and a long-lived secret.
4. **Pattern:** **login-action with GITHUB_TOKEN + metadata-action + build-push-action**, triggered by branches and version tags.
5. **Plan:** write the workflow → push → check the run → tag `v1.0.0` → push the tag → check again.
6. **Code and test:** `gh run list` shows two green runs (on `main` and on `v1.0.0`).

</details>

<details>
<summary>💡 Hint 1</summary>

The lesson's workflow is a good start; you need three tag rules: `type=ref,event=branch`, `type=semver,pattern={{version}}` and `type=sha`.

</details>

<details>
<summary>💡 Hint 2</summary>

Without `permissions: packages: write`, the push fails with `denied: permission_denied: write_package`.

</details>

<details>
<summary>💡 Hint 3</summary>

After the first run passes, `git tag v1.0.0` and `git push origin v1.0.0` start a second run that publishes `1.0.0` (and `latest`).

</details>

**In the sandbox:** exercises 47–48. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Push by hand</summary>

```bash
docker tag shop:1.0 ghcr.io/ada/shop:1.0
echo "$CR_PAT" | docker login ghcr.io -u ada --password-stdin
docker push ghcr.io/ada/shop:1.0
```

**Line by line**

- `docker tag shop:1.0 ghcr.io/ada/shop:1.0` adds a second name to the same image.
- `echo "$CR_PAT" | docker login ghcr.io -u ada --password-stdin` logs in; the token never appears as an argument.
- `docker push ghcr.io/ada/shop:1.0` uploads the layers the registry doesn't have and the image's manifest.

**Trace:** `Login Succeeded` (after the warning about unencrypted storage), then one `Pushed` line per layer and the digest.

**Common wrong approach:** `docker push shop:1.0`: without a registry in the name, Docker pushes to Docker Hub's `library/shop`, and the push is denied.

</details>

<details>
<summary>✅ 2. Publish from CI</summary>

```bash
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
          images: ghcr.io/ada/shop
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
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
git tag v1.0.0
git push -q origin v1.0.0
gh run list
```

**Line by line**

- `on: push: branches: [main]` and `tags: ["v*"]` run the workflow for new commits on main and for version tags.
- `permissions` limits the token to reading code and writing packages.
- `login-action` uses `github.actor` and the automatic `GITHUB_TOKEN`; `metadata-action` computes tags and labels; `build-push-action` builds the commit and pushes every tag.

**Trace:** the first run pushes `ghcr.io/ada/shop:main` and `ghcr.io/ada/shop:sha-…`; the tag's run pushes `ghcr.io/ada/shop:1.0.0` and `ghcr.io/ada/shop:latest`.

**Common wrong approach:** forgetting `packages: write` when `permissions:` is set: every other permission becomes `none`/read-only, and the push is denied.

</details>

## Quick quiz

1. What does docker tag shop:1.0 ghcr.io/ada/shop:1.0 do?
   - A) Renames the image and deletes shop:1.0
   - B) Builds a new image
   - C) Uploads the image to ghcr.io
   - D) Gives the existing image a second name; nothing is copied or uploaded

2. Why log in with --password-stdin instead of -p TOKEN?
   - A) It's faster
   - B) --password-stdin encrypts the token on disk
   - C) -p doesn't work with ghcr.io
   - D) So the token doesn't end up in the shell history or the process list

3. In GitHub Actions, what lets the job push to ghcr.io without a personal token?
   - A) Making the repository public
   - B) actions/checkout
   - C) secrets.CR_PAT
   - D) The GITHUB_TOKEN with permissions: packages: write

4. Which tag should a production server run?
   - A) A specific version or digest, so you know exactly what runs and can roll back
   - B) latest, so it always has the newest
   - C) main
   - D) Any tag; they're all the same image

<details>
<summary>Quiz answers</summary>

1. **D) Gives the existing image a second name; nothing is copied or uploaded**: Tags are names; docker push uploads.
2. **D) So the token doesn't end up in the shell history or the process list**: Pipe the token in; Docker still stores it, so use a credential helper.
3. **D) The GITHUB_TOKEN with permissions: packages: write**: login-action logs in with github.actor and the GITHUB_TOKEN.
4. **A) A specific version or digest, so you know exactly what runs and can roll back**: latest and branch tags move; versions and digests don't.

</details>

---
Previous: [Lesson 23](23-compose.md) · Back to the [course home](../README.md)
