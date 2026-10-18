# Lesson 21: Layers, caching and smaller images

**You'll learn:** layers and the container's writable layer, docker history and `<missing>`, shared base layers, how BuildKit's cache works, ordering a Dockerfile (dependency files, install, then code), --no-cache, choosing a base image (node:24, -slim, -alpine, distroless, Docker Hardened Images), musl versus glibc, NODE_ENV=production and npm ci --omit=dev, running as the node user (USER), file ownership and chown for writable folders, multi-stage builds (AS, COPY --from, stage labels, skipped stages, deduplicated steps), running tests in the build, secrets in ENV and ARG (SecretsUsedInArgOrEnv, docker history), build secrets (RUN --mount=type=secret), pinning tags and digests, Dependabot and Renovate for base images, scanning (Docker Scout, Trivy, Grype), attestations and SBOMs.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#layers)**: run every example and check your exercise answers.

## Key terms

- **Build cache:** layers BuildKit reuses when a step and its inputs haven't changed.
- **Cache invalidation:** a changed step makes every later step run again.
- **Base image:** the image a Dockerfile starts FROM.
- **Multi-stage build:** a Dockerfile with several FROM stages, where the final stage copies results from earlier ones.
- **Stage:** the part of a Dockerfile from one FROM to the next; AS gives it a name.
- **Non-root user:** running the container's process as an ordinary user (USER node) instead of root.
- **Distroless image:** an image with only the runtime and the app, without a shell or package manager.
- **Build secret:** a secret mounted into one RUN step without being stored in the image.
- **SBOM:** a software bill of materials, the list of packages inside an image.

A working image is a start. A good one builds fast, is small, and gives an attacker as little as possible. All three come from understanding **layers**.

## Layers

![A stack of read-only layers, bottom to top: ADD alpine-minirootfs 8.79MB, RUN install Node.js 157MB, RUN install Yarn 5.34MB, COPY docker-entrypoint.sh 388B (together node:24-alpine), then your build steps WORKDIR /app 0B, COPY package*.json 311B, RUN npm ci 4.1kB and COPY . . 2.18kB, and on top a container's thin writable layer](../figures/image-layers.svg)

Each `RUN`, `COPY` and `WORKDIR` adds a read-only layer with the files that step changed. A container adds a thin writable layer on top; deleting the container deletes that layer and everything written to it. `docker history` lists an image's layers, newest first:

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

```bash
docker history shop:1.0
```

Only the top line names an image; `<missing>` means that layer isn't an image of its own, not that anything is wrong. Two images built `FROM node:24-alpine` share its layers on disk and in downloads.

## The build cache

BuildKit keeps every layer it builds. Next time, a step whose inputs haven't changed (the same instruction, on the same parent layer, copying files with the same content) is `CACHED` and takes no time. Once one step changes, every step after it runs again. That makes the *order* of a Dockerfile matter:

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

</details>

```bash
cat Dockerfile
echo "// a small change" >> server.js
docker build -t shop:1.1 . | grep -A2 -E "\] (COPY|RUN)"
```

Changing one line of `server.js` changed what `COPY . .` copies, so `npm ci` ran again, and in a real project downloads hundreds of packages. Copy the files that decide the dependencies first, install, and copy the code last:

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

</details>

```bash
cat > Dockerfile <<'EOF'
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
EOF
docker build -q -t shop:1.1 .
echo "// a small change" >> server.js
docker build -t shop:1.1 . | grep -A2 -E "\] (COPY|RUN)"
```

Now a code change only reruns `COPY . .`. Dependencies are re-installed only when `package.json` or `package-lock.json` change. `docker build --no-cache` ignores the cache when you need a completely fresh build.

## Smaller and safer images

The base image is most of your image. The shop's API works on any of these:

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

```bash
docker pull -q node:24-slim
docker pull -q node:24
docker images
```

| Base | Disk usage | Has |
|---|---|---|
| `node:24` | 1.54GB | Debian with compilers, git, curl, Python: useful for building, wasteful for running |
| `node:24-slim` | 327MB | Debian's minimal userland, glibc |
| `node:24-alpine` | 234MB | Alpine's musl and BusyBox (no bash, no curl; `wget` instead) |

Even smaller: Google's **distroless** Node.js images (`gcr.io/distroless/nodejs…`) contain Node.js and nothing else, not even a shell, and **Docker Hardened Images**, free and open source since December 2025, are minimal, regularly patched versions of popular images. Fewer programs mean fewer known vulnerabilities to patch and fewer tools for an attacker. The trade-off is debugging: with no shell, `docker exec … sh` doesn't work. Alpine's musl occasionally breaks packages with native code; switch to `-slim` if that happens.

Two more settings belong in every production Node.js image: `ENV NODE_ENV=production`, which many libraries read to turn off development features, and `npm ci --omit=dev`, which leaves test tools out.

## Don't run as root

By default a container's process runs as `root`. Container root is restricted, but if an attacker finds a hole in your app, root makes the next step easier. The `node` images include a user called `node`:

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

</details>

```bash
docker run --rm shop:1.0 whoami
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
docker build -q -t shop:1.0 .
docker run --rm shop:1.0 whoami
```

`USER node` makes everything after it, and the container, run as `node`. Files copied in belong to `root`, so `node` can read the code but not change it, which is what you want. The shop writes orders to `data/`, so the Dockerfile creates that one folder and gives it to `node` before switching user.

## Multi-stage builds

A Dockerfile can have several `FROM`s. Each starts a **stage**, and a later stage can copy files from an earlier one with `COPY --from=NAME`. The final stage is the image; everything else is thrown away. Use it to run the tests during the build, or to compile with tools the final image doesn't need:

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

```bash
cat > Dockerfile <<'EOF'
FROM node:24-alpine AS test
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm test

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=test /app/prices.js /app/server.js ./
RUN mkdir -p data && chown node:node data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
EOF
docker build -t shop:2.0 . | grep -E "^#[0-9]+ \[|✔|ℹ (pass|fail)"
docker run --rm shop:2.0 ls
```

The steps are labeled with their stage (`test`, and `stage-1` for the unnamed final one), and steps that are identical in both stages run once. The tests ran inside the build: if one fails, the build fails, and no image is made. The final image has no test files. BuildKit builds only the stages the final stage needs, so the final stage copies `prices.js` and `server.js` *from* the test stage: copy them from the build context instead, and BuildKit would skip the tests entirely.

## Keep secrets out of images

Every layer and every `ENV` value is readable by anyone who has the image:

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

```bash
printf 'FROM shop:1.0\nENV PAYMENT_API_TOKEN=tok_live_83d1c47e\n' > Dockerfile.bad
docker build -f Dockerfile.bad -t shop:leaky . | grep -A1 "warning found"
docker history shop:leaky | head -2
```

BuildKit's `SecretsUsedInArgOrEnv` check warns about variable names that look like secrets, and `docker history` shows the value to anyone. Deleting a file in a later `RUN` doesn't help either: it's still in the earlier layer. Give secrets to the *container* when it starts (next lesson), and for secrets the *build* needs, such as a private package registry's token, use build secrets: `RUN --mount=type=secret,id=npmrc …`, which mounts the secret for that one step without storing it.

## Pin, update and scan

- Pin the base image so builds are repeatable: `node:24.22.0-alpine3.24`, or exactly with a digest, `node:24-alpine@sha256:44fce696…`.
- Pinning means updates don't happen by themselves: Dependabot or Renovate (Part 3) can open pull requests that bump `FROM` lines, so you get security fixes on purpose.
- Scanners list known vulnerabilities in an image's packages: `docker scout quickview shop:1.0` (Docker Scout) on your own computer, or Trivy and Grype in CI.
- BuildKit attaches an **attestation** to images (`exporting attestation manifest`): a signed record of how the image was built. Add `--sbom=true` for a software bill of materials, the list of everything inside.

## Try it on your own computer

- Try the build cache on a real project with dependencies: add a package (`npm install express`), build, change a source file, and build again: the `npm ci` step says `CACHED`.
- Compare base images with `docker images` after `docker pull node:24-slim` and `docker pull node:24`.
- `docker scout quickview` and `docker scout cves` need a free Docker account; [Trivy](https://trivy.dev/) is a free, open-source alternative.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| See an image's layers | docker history IMAGE | nothing | — |
| Build without the cache | docker build --no-cache -t NAME . | adds an image | — |
| Build one stage | docker build --target test . | nothing (untagged) | — |
| Copy from a stage | COPY --from=test /app/file ./ | the final image | edit the Dockerfile |
| Run as a non-root user | USER node | the image's default user | remove the line |

## Common mistakes

- Copying all the code before installing dependencies, so every code change reinstalls them.
- Putting secrets in ENV or ARG, where docker history shows them.
- Deleting a secret file in a later RUN and thinking it's gone (it's still in an earlier layer).
- A test stage that the final stage never copies from, so BuildKit skips the tests.
- Running as root because it's the default.

## Exercises

### 1. Order for the cache

In `~/shop`, every change to the code re-installs the dependencies. Reorder the Dockerfile so that `package.json` and `package-lock.json` are copied and `npm ci --omit=dev` runs **before** the rest of the code is copied, and build it as `shop:1.1`. Keep everything else the same.

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

</details>

Starter:

```bash
cat Dockerfile
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a step is cached only if its parent layer and its own inputs are unchanged.
2. **Examples:** with `COPY . .` first, any edit changes that layer, so every later step reruns.
3. **Brute force:** `--no-cache` everywhere would be slow; never changing code isn't an option.
4. **Pattern:** **order a Dockerfile from what changes least to what changes most**: base, dependency files, install, code.
5. **Plan:** move the package files and the install above `COPY . .` → build → edit → build.
6. **Code and test:** the second build shows `CACHED` for `COPY package*.json` and `RUN npm ci`, and only `COPY . .` runs.

</details>

<details>
<summary>💡 Hint 1</summary>

The cache is lost from the first step whose inputs change. Which files does `npm ci` actually need?

</details>

<details>
<summary>💡 Hint 2</summary>

Only `package.json` and `package-lock.json`: copy them with `COPY package*.json ./` before `RUN npm ci --omit=dev`, then `COPY . .`.

</details>

<details>
<summary>💡 Hint 3</summary>

Build twice, changing `server.js` in between, and look for `CACHED` on the `RUN npm ci` step.

</details>

### 2. Test in one stage, ship from another

Turn the shop's Dockerfile into a multi-stage build, tagged `shop:2.0`. A first stage named `test` installs **all** dependencies (`npm ci`), copies the project and runs `npm test`. The final stage starts again from `node:24-alpine`, sets `NODE_ENV=production`, installs production dependencies, copies only `prices.js` and `server.js` **from the test stage**, creates the `data` folder owned by `node`, runs as `node` and starts the server. The final image must not contain the test file.

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
```

</details>

Starter:

```bash
cat Dockerfile
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** each `FROM` starts a fresh stage; only the last one becomes the image, and BuildKit skips stages the last one doesn't use.
2. **Examples:** `COPY --from=test` makes the final stage depend on the test stage, so the tests must pass first.
3. **Brute force:** running `npm test` in the final stage would ship test files and dev dependencies.
4. **Pattern:** **build and test in one stage, copy only the results into a clean final stage**.
5. **Plan:** write the two stages → build `shop:2.0` → list `/app` in the image.
6. **Code and test:** the build shows `✔` lines from the `test` stage; `ls` in the image shows `node_modules`? No: `data`, `package-lock.json`, `package.json`, `prices.js`, `server.js`.

</details>

<details>
<summary>💡 Hint 1</summary>

Two stages: `FROM node:24-alpine AS test` with the test steps, then a second `FROM node:24-alpine` for the final image.

</details>

<details>
<summary>💡 Hint 2</summary>

In the final stage, `COPY --from=test /app/prices.js /app/server.js ./` copies just those two files out of the test stage.

</details>

<details>
<summary>💡 Hint 3</summary>

The lesson's multi-stage example is the whole answer; build it with `docker build -t shop:2.0 .` and check with `docker run --rm shop:2.0 ls`.

</details>

**In the sandbox:** exercises 41–42. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Order for the cache</summary>

```bash
cat > Dockerfile <<'EOF'
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
EOF
docker build -t shop:1.1 .
echo "// a change" >> server.js
docker build -t shop:1.1 .
```

**Line by line**

- `COPY package*.json ./` copies only `package.json` and `package-lock.json`, so this layer changes only when dependencies change.
- `RUN npm ci --omit=dev` sits on that layer, so it's cached as long as the dependencies are the same.
- `COPY . .` comes last: code changes only invalidate this one, cheap step.

**Trace:** after the edit, the build prints `#7 [3/5] COPY package*.json ./` → `CACHED`, `#8 [4/5] RUN npm ci --omit=dev` → `CACHED`, then `#9 [5/5] COPY . .` → `DONE`.

**Common wrong approach:** `COPY package.json ./` without the lock file: `npm ci` refuses to run without `package-lock.json`, so the build fails.

</details>

<details>
<summary>✅ 2. Test in one stage, ship from another</summary>

```bash
cat > Dockerfile <<'EOF'
FROM node:24-alpine AS test
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm test

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=test /app/prices.js /app/server.js ./
RUN mkdir -p data && chown node:node data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
EOF
docker build -t shop:2.0 .
docker run --rm shop:2.0 ls
```

**Line by line**

- Stage `test` installs every dependency (`npm ci`, including dev tools), copies the project and runs `npm test`; a failing test fails the whole build.
- The final stage installs only production dependencies and copies the two source files from the test stage, which makes BuildKit run that stage.
- `chown` and `USER node` make the app run without root, able to write only to `data/`.

**Trace:** the output shows `[test 6/6] RUN npm test` with `✔ adds up a basket` and `ℹ pass 2`, then `[stage-1 5/6] COPY --from=test …`.

**Common wrong approach:** `COPY prices.js server.js ./` in the final stage: the image is fine, but nothing needs the test stage any more, so BuildKit never runs the tests.

</details>

## Quick quiz

1. You change one line in server.js. With COPY . . before RUN npm ci, what happens on the next build?
   - A) Nothing is rebuilt
   - B) npm ci runs again, because the layer it's built on changed
   - C) The build fails
   - D) Only the CMD changes

2. What does USER node do?
   - A) Creates a new user called node
   - B) Gives node access to the host's files
   - C) Runs the following instructions and the container's process as the user node instead of root
   - D) Lets the node image run without Docker

3. In a multi-stage build, which stage becomes the image?
   - A) The largest stage
   - B) The first stage
   - C) The last stage (or the one named with --target)
   - D) All stages, merged together

4. Why is ENV API_TOKEN=… in a Dockerfile dangerous?
   - A) Docker refuses to build it
   - B) It makes the image larger
   - C) ENV only works for numbers
   - D) Anyone with the image can read it, for example with docker history or docker inspect

<details>
<summary>Quiz answers</summary>

1. **B) npm ci runs again, because the layer it's built on changed**: Every step after the first changed one runs again; copy the package files and install first.
2. **C) Runs the following instructions and the container's process as the user node instead of root**: The node images already have a node user; USER switches to it.
3. **C) The last stage (or the one named with --target)**: Earlier stages only exist to produce files the final stage copies in.
4. **D) Anyone with the image can read it, for example with docker history or docker inspect**: BuildKit warns (SecretsUsedInArgOrEnv); give secrets to containers at run time, or use build secrets.

</details>

---
Previous: [Lesson 20](20-dockerfile.md) · Next: [Lesson 22: Running containers: configuration, logs, signals and data](22-running.md)
