# Lesson 22: Running containers: configuration, logs, signals and data

**You'll learn:** configuration with environment variables (-e, --env-file), docker inspect and Go templates, secrets at run time, logs on stdout and stderr (docker logs, -f, --tail), docker exec and PID 1, docker exec -it for a shell, docker stop (SIGTERM, the 10-second timeout, SIGKILL), why Node.js as PID 1 ignores SIGTERM, graceful shutdown with server.close, docker run --init, exit codes (0, 1, 125, 126, 127, 137, 143), uncaught errors and crashes, restart policies (no, on-failure, always, unless-stopped) and RestartCount, health checks (HEALTHCHECK, wget in Alpine, starting, healthy, unhealthy), named volumes and bind mounts (-v, :ro), docker rm -f, docker volume ls and rm, memory and CPU limits (--memory, --cpus) and docker stats.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#running)**: run every example and check your exercise answers.

## Key terms

- **Environment variable:** a named setting a container's process reads at run time.
- **PID 1:** the first process in a container, its main process; signals have no default effect on it.
- **SIGTERM:** the signal docker stop sends to ask a process to finish.
- **SIGKILL:** the signal that ends a process immediately; exit code 137.
- **Graceful shutdown:** finishing work in progress and exiting cleanly on SIGTERM.
- **Restart policy:** when Docker restarts a container whose process ended.
- **Health check:** a command Docker runs inside a container to see if the app works.
- **Volume:** storage managed by Docker that outlives containers, mounted at a path.
- **Bind mount:** a folder of the host mounted into a container.

Images are built once and run in many places: on your laptop, in CI, in production. This lesson is about everything that happens at run time.

## Configuration with environment variables

The same image should run everywhere, so settings that differ between places come from **environment variables**, not from the image. The shop reads `PORT` and `SHOP_NAME`:

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
docker run -d -p 8080:3000 -e SHOP_NAME="Ada's Bikes" --name shop shop:1.0
curl localhost:8080/
docker inspect -f '{{json .Config.Env}}' shop
```

`-e NAME=value` sets a variable (repeat it for more); `--env-file .env` reads `NAME=value` lines from a file. `docker inspect` shows a container's full configuration, and `-f` picks one field with a Go template. Note that anyone who can run `docker inspect` sees the variables: real secrets come from a secrets manager in production (Part 7), and `.env` files belong in `.gitignore` and `.dockerignore`.

## Logs, exec and inspect

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
docker run -d -p 8080:3000 --name shop shop:1.0 > /dev/null
```

</details>

```bash
curl -s localhost:8080/prices > /dev/null
docker logs shop
docker exec shop ls -l
docker exec shop ps
docker inspect -f '{{.State.Status}} since {{.State.StartedAt}}' shop
```

- **Logs:** Docker collects whatever the main process writes to standard output and standard error. Containerized apps should log there instead of to files. `docker logs -f` follows new lines (Ctrl+C to stop), and `--tail 20` shows only the last 20.
- **`docker exec`** runs another command inside a running container, here `ls` and `ps`. `ps` shows `node server.js` as **PID 1**, the container's main process. In a real terminal, `docker exec -it shop sh` opens a shell inside it (Alpine images have `sh`, not `bash`).

## Stopping: signals, PID 1 and exit codes

`docker stop` sends the main process the signal **SIGTERM** ("please finish"), waits up to 10 seconds, then sends **SIGKILL**, which can't be refused. A program normally ends on SIGTERM, but PID 1 is special: Linux doesn't apply default signal actions to it, so Node.js as PID 1 ignores SIGTERM unless the code handles it:

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
docker run -d -p 8080:3000 --name shop shop:1.0 > /dev/null
```

</details>

```bash
docker stop shop
docker ps -a
```

The stop took the full 10 seconds, and `Exited (137)` (128 + 9, SIGKILL) shows the container was killed, mid-request if there was one. Handle SIGTERM: stop accepting connections, let the open requests finish, then exit:

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
cat >> server.js <<'EOF'

// docker stop sends SIGTERM: finish the open requests, then exit
process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing the server");
  server.close(() => process.exit(0));
});
EOF
docker build -q -t shop:1.1 .
docker run -d -p 8080:3000 --name shop shop:1.1
docker stop shop
docker ps -a
docker logs shop
```

Now it stops at once with `Exited (0)`. Exit codes tell you how a container ended:

| Exit code | Meaning |
|---|---|
| 0 | the process ended normally |
| 1 | the process failed, for example with an uncaught error |
| 137 | killed with SIGKILL (128 + 9): `docker stop` timed out, `docker kill`, or out of memory |
| 143 | ended by SIGTERM (128 + 15) without handling it, for example with `docker run --init` |
| 125, 126, 127 | Docker couldn't run it: a bad option, a command that can't run, a command not found |

`docker run --init` puts a tiny init process as PID 1 that forwards signals, a quick fix when you can't change the code. Shell-form `CMD`s have the same problem as unhandled SIGTERM, which is why BuildKit warns about them.

## When the process crashes: restart policies

A bug that throws an uncaught error ends Node.js, and with it the container. The shop has one: an order that isn't valid JSON. A **restart policy** tells Docker to start the container again:

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
docker run -d -p 8080:3000 --restart on-failure --name shop shop:1.0
curl -s -d 'not json' localhost:8080/orders
docker ps
docker inspect -f '{{.RestartCount}}' shop
docker logs shop
```

The request killed the process (curl got an empty reply), Docker restarted the container, and the logs show the error and the second start. Policies: `no` (the default), `on-failure[:N]` (only after a non-zero exit, at most N times), `always`, and `unless-stopped` (like `always`, but not after you stopped it yourself). A restart policy keeps a service available; it doesn't fix the bug, so read the logs.

## Health checks

A process can be running and still broken, for example stuck or unable to reach its database. A **health check** is a command Docker runs inside the container at intervals; exit status 0 means healthy:

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
cat >> Dockerfile <<'EOF'
HEALTHCHECK --interval=10s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
EOF
docker build -q -t shop:1.1 .
docker run -d -p 8080:3000 --name shop shop:1.1
docker ps
sleep 12
docker ps
docker inspect -f '{{.State.Health.Status}}' shop
```

The status goes from `health: starting` to `healthy`, or to `unhealthy` after three failed checks in a row. Alpine images have BusyBox's `wget` but no `curl`, hence `wget -qO-` (print the page) in the check. Docker itself only reports health; Compose (next lesson) and orchestrators like Kubernetes act on it.

## Data that outlives a container

Anything a container writes goes to its writable layer and disappears with the container. The shop saves orders in `/app/data`; mount a **volume** there and the data survives:

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
docker run -d -p 8080:3000 -v shop-data:/app/data --name shop shop:1.0
curl -s -d '{"items": ["bell", "lock"]}' localhost:8080/orders
docker rm -f shop
docker run -d -p 8080:3000 -v shop-data:/app/data --name shop shop:1.0
curl localhost:8080/orders
docker volume ls
```

`-v shop-data:/app/data` mounts the **named volume** `shop-data` (Docker creates it the first time) at `/app/data`. `docker rm -f` stops and removes a container in one go; the volume is untouched, so the new container sees the order. Remove volumes deliberately with `docker volume rm`.

A **bind mount** mounts a folder of your computer instead, `-v ./site:/usr/share/nginx/html:ro`: edit the files on your computer and the container sees the change immediately, which is handy during development. `:ro` makes it read-only for the container. Use volumes for data that belongs to the container, bind mounts for files you edit.

## Limits

Without limits, one container can use all of the machine's memory and CPU:

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
docker run -d -p 8080:3000 --memory 256m --cpus 0.5 --name shop shop:1.0
docker stats --no-stream
```

`--memory 256m` caps memory (a container that goes over is killed, exit code 137); `--cpus 0.5` gives it at most half a CPU. `docker stats` shows live usage; Node.js 24 sizes its memory use to the container's limit automatically.

## Try it on your own computer

- In a real terminal, `docker logs -f shop` follows the log until Ctrl+C, and `docker exec -it shop sh` gives you a shell inside the container; `exit` leaves it.
- Time the difference: `time docker stop shop` takes 10 seconds without the SIGTERM handler and well under one with it.
- Docker Desktop's **Containers** view shows the same logs, files, stats and an exec terminal for each container.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Set a variable | docker run -e NAME=value … | the new container | — |
| Follow a container's log | docker logs -f NAME | nothing | Ctrl+C |
| Run a command inside | docker exec NAME COMMAND | depends on the command | — |
| Read one setting | docker inspect -f '{{.State.Status}}' NAME | nothing | — |
| Stop / kill | docker stop NAME / docker kill NAME | stops the container | docker start NAME |
| Restart after crashes | docker run --restart unless-stopped … | the container's policy | docker update --restart no NAME |
| Keep data | docker run -v NAME:/path … | creates a volume | docker volume rm NAME |
| Limit resources | docker run --memory 256m --cpus 0.5 … | the container's limits | docker update |

## Common mistakes

- Baking settings into the image instead of passing them with -e.
- Writing logs to files inside the container instead of standard output.
- Not handling SIGTERM, so every docker stop takes 10 seconds and kills requests.
- Treating a restart policy as a fix instead of reading the crash in the logs.
- Keeping data in the container's writable layer, where docker rm deletes it.
- Using curl in a health check on an Alpine image, which doesn't have it.

## Exercises

### 1. Graceful shutdown

`docker stop` takes 10 seconds on the shop and then kills it. Add a SIGTERM handler at the end of `server.js` that closes the server and exits with status 0, build the image as `shop:1.1`, run it as a container named `shop` (port 8080 to 3000), and stop it. It should end with exit code 0.

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
tail -3 server.js
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** Node.js as PID 1 ignores SIGTERM unless the program handles it, so Docker kills it after 10 seconds.
2. **Examples:** without a handler, `docker ps -a` shows `Exited (137)`.
3. **Brute force:** `docker kill` is instant but drops requests in progress, the same as SIGKILL.
4. **Pattern:** **handle SIGTERM: stop accepting work, finish what's in progress, exit 0**.
5. **Plan:** append the handler → rebuild with a new tag → run → stop → check the exit code.
6. **Code and test:** `docker stop shop` returns at once and `docker ps -a` shows `Exited (0)`; the log ends with `SIGTERM received, closing the server`.

</details>

<details>
<summary>💡 Hint 1</summary>

Append the handler with `cat >> server.js <<'EOF'` … `EOF`; `server` is the variable the file already uses for the HTTP server.

</details>

<details>
<summary>💡 Hint 2</summary>

`server.close(callback)` stops accepting new connections and calls the callback when the open ones are done; exit there with `process.exit(0)`.

</details>

<details>
<summary>💡 Hint 3</summary>

Rebuild (`docker build -t shop:1.1 .`) after editing: a running container never sees changes to your files. Then run, `docker stop shop`, and `docker ps -a`.

</details>

### 2. Keep the orders

Run the shop so that it survives crashes and keeps its data: a container named `shop` from `shop:1.0`, port 8080 to 3000, a named volume `shop-data` mounted at `/app/data`, the restart policy `unless-stopped`, and `SHOP_NAME` set to `Ada's Bikes`. Place an order (`curl -d '{"items": ["bell"]}' localhost:8080/orders`), then remove the container and start it again the same way. `curl localhost:8080/orders` must still list the order.

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
docker volume ls
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** containers are disposable; data that matters lives in a volume, outside any one container.
2. **Examples:** without `-v`, a new container starts with an empty `data/` folder.
3. **Brute force:** `docker cp` the file out before removing the container, and back in after: easy to forget.
4. **Pattern:** **treat containers as replaceable and mount volumes for state**; the restart policy covers crashes.
5. **Plan:** run with all the options → order → remove → run again → list orders.
6. **Code and test:** the second container's `/orders` still shows `{"items":["bell"],"total":800}`, and `/` says `Welcome to Ada's Bikes!`.

</details>

<details>
<summary>💡 Hint 1</summary>

All the settings are options of `docker run`: `-p`, `-v NAME:PATH`, `--restart POLICY`, `-e NAME=value` and `--name`.

</details>

<details>
<summary>💡 Hint 2</summary>

Quote the shop name because of the space and the apostrophe: `-e SHOP_NAME="Ada's Bikes"`.

</details>

<details>
<summary>💡 Hint 3</summary>

`docker rm -f shop` removes the running container; then run exactly the same `docker run` again and `curl localhost:8080/orders`.

</details>

**In the sandbox:** exercises 43–44. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Graceful shutdown</summary>

```bash
cat >> server.js <<'EOF'

process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing the server");
  server.close(() => process.exit(0));
});
EOF
docker build -t shop:1.1 .
docker run -d -p 8080:3000 --name shop shop:1.1
docker stop shop
docker ps -a
```

**Line by line**

- `process.on("SIGTERM", …)` registers a function Node.js calls when the signal arrives.
- `server.close(…)` stops listening and waits for open connections; its callback runs `process.exit(0)`.
- The new image `shop:1.1` contains the changed file; the old container would still run the old code.

**Trace:** `docker stop shop` prints `shop` immediately; `docker ps -a` shows `Exited (0) Less than a second ago`.

**Common wrong approach:** editing `server.js` and running `shop:1.0` again: images don't change when files do, so the handler isn't there until you rebuild.

</details>

<details>
<summary>✅ 2. Keep the orders</summary>

```bash
docker run -d -p 8080:3000 -v shop-data:/app/data --restart unless-stopped -e SHOP_NAME="Ada's Bikes" --name shop shop:1.0
curl -d '{"items": ["bell"]}' localhost:8080/orders
docker rm -f shop
docker run -d -p 8080:3000 -v shop-data:/app/data --restart unless-stopped -e SHOP_NAME="Ada's Bikes" --name shop shop:1.0
curl localhost:8080/orders
curl localhost:8080/
```

**Line by line**

- `-v shop-data:/app/data` creates the volume on first use and mounts it where the shop writes `orders.jsonl`.
- `--restart unless-stopped` restarts the container after crashes (and after the Docker daemon restarts), but not after `docker stop`.
- `docker rm -f shop` deletes the container and its writable layer; the volume stays.
- The second `docker run` mounts the same volume, so the new container reads the old orders.

**Trace:** the order request returns `201` with `{"items":["bell"],"total":800}`; after the new container starts, `curl localhost:8080/orders` prints the same line.

**Common wrong approach:** `-v ./data:/app/data` makes a bind mount of a folder on your computer: it also keeps the data, but this exercise asks for the named volume Docker manages.

</details>

## Quick quiz

1. docker stop took 10 seconds and the container shows Exited (137). Why?
   - A) The process didn't end on SIGTERM, so Docker killed it with SIGKILL after the timeout
   - B) The container ran out of disk space
   - C) The image is 137 MB
   - D) The container crashed 137 times

2. Where should a containerized app write its logs?
   - A) To standard output and standard error, which docker logs collects
   - B) To a log file inside the container
   - C) To the image's history
   - D) Nowhere: containers can't log

3. A container's data must survive docker rm. What do you use?
   - A) A volume (or a bind mount) mounted where the app writes
   - B) docker commit after every change
   - C) A larger writable layer
   - D) --restart always

4. What does --restart on-failure do?
   - A) Starts the container again when its process exits with a non-zero status
   - B) Restarts it every time it exits, even after docker stop
   - C) Fixes the bug that crashed it
   - D) Retries docker run if the image is missing

<details>
<summary>Quiz answers</summary>

1. **A) The process didn't end on SIGTERM, so Docker killed it with SIGKILL after the timeout**: PID 1 doesn't get default signal handling; handle SIGTERM or use --init.
2. **A) To standard output and standard error, which docker logs collects**: Files in the container disappear with it and need extra tools to read; stdout/stderr go to Docker's logging.
3. **A) A volume (or a bind mount) mounted where the app writes**: The writable layer is deleted with the container; volumes live outside it.
4. **A) Starts the container again when its process exits with a non-zero status**: on-failure restarts after crashes; unless-stopped and always also restart after a clean exit.

</details>

---
Previous: [Lesson 21](21-layers.md) · Next: [Lesson 23: Docker Compose: several containers together](23-compose.md)
