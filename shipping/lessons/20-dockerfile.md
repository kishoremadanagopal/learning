# Lesson 20: Writing a Dockerfile

**You'll learn:** the shop as a node:http web API (routes, PORT), a Dockerfile's instructions (FROM, WORKDIR, COPY, RUN, EXPOSE, CMD), docker build -t and the build context, reading BuildKit's plain output (steps, CACHED, DONE, exporting and naming), --progress=plain, npm ci --omit=dev, running your image and curl -i, what COPY . . copies (.git, README.md, .env, node_modules) and .dockerignore, docker build -q, exec form versus shell form, signals and the shell, BuildKit build checks and warnings (JSONArgsRecommended), docker build --check, ENTRYPOINT and CMD, the node image's docker-entrypoint.sh, overriding CMD with docker run arguments, reading build errors (>>>, unknown instruction, file not found), listening on all interfaces (127.0.0.1 versus 0.0.0.0) and Connection reset by peer, docker init, VS Code's Docker DX and Container Tools extensions.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#dockerfile)**: run every example and check your exercise answers.

## Key terms

- **Dockerfile:** a text file of instructions for building an image.
- **Build context:** the folder (minus .dockerignore) that docker build sends to the builder; COPY copies from it.
- **.dockerignore:** a file listing paths to leave out of the build context.
- **BuildKit:** Docker's builder; it runs the steps, caches them and checks the Dockerfile.
- **Exec form:** CMD ["node", "server.js"], a JSON list that runs the program directly.
- **Shell form:** CMD node server.js, which runs the command through /bin/sh -c.
- **ENTRYPOINT:** the program a container runs; CMD then supplies its default arguments.
- **Build check:** a BuildKit rule that warns about Dockerfile problems, such as JSONArgsRecommended.

To run your own program in a container, you build your own image. The recipe is a **Dockerfile**: a text file of instructions, each of which changes the image a little.

## The shop as a web API

The bike shop has grown into a small web API, `server.js`, written with Node.js's built-in `node:http` module, so there are no packages to install. It answers `GET /` with a welcome, `GET /prices` with the price list as JSON, `GET /health` with `ok`, and takes orders on `POST /orders`:

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
```

</details>

```bash
ls
head -16 server.js
```

It listens on the port in the `PORT` environment variable, 3000 by default. You don't need to change the JavaScript in this part; you'll package it.

## A first Dockerfile

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
```

</details>

```bash
cat > Dockerfile <<'EOF'
FROM node:24-alpine
WORKDIR /app
COPY . .
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["node", "server.js"]
EOF
docker build -t shop:1.0 .
```

| Instruction | What it does |
|---|---|
| `FROM node:24-alpine` | start from this image (every Dockerfile starts with `FROM`) |
| `WORKDIR /app` | create `/app` and make it the current folder for the next instructions and for the container |
| `COPY . .` | copy files from the **build context** (the folder you build) into the image's current folder |
| `RUN npm ci --omit=dev` | run a command while building; its changes to files become part of the image |
| `EXPOSE 3000` | document the port the app listens on (it publishes nothing by itself) |
| `CMD ["node", "server.js"]` | the command a container runs when it starts |

`docker build -t shop:1.0 .` builds the image from the Dockerfile in `.`, the current folder, and tags it `shop:1.0`. Docker's builder, **BuildKit**, numbers its steps: `#1` reads the Dockerfile, `#2` looks up the base image, then `[1/4]` to `[4/4]` are your `FROM`, `WORKDIR`, `COPY` and `RUN` (instructions like `EXPOSE` and `CMD` only change settings, so they aren't steps). The `RUN` step shows npm's output, with the seconds since the step started. At the end, BuildKit exports the image and names it `docker.io/library/shop:1.0`.

`npm ci` installs exactly what `package-lock.json` says (Part 3), and `--omit=dev` skips development-only packages like test tools. The shop has no packages yet, so it's up to date in a moment.

The sandbox shows BuildKit's *plain* output, which is also what you see in CI. In your own terminal, `docker build` shows a compact view that redraws itself; add `--progress=plain` to get this one.

## Run your image

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
docker run -d -p 8080:3000 --name shop shop:1.0
curl localhost:8080/
curl -i localhost:8080/prices
docker logs shop
```

`curl -i` shows the response's status line and headers too: `HTTP/1.1 200 OK` and the `Content-Type` that `server.js` set. The container printed one log line when it started and one per request.

## The build context and .dockerignore

`COPY . .` copied the whole folder, including things that don't belong in an image:

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
docker run --rm shop:1.0 ls -a
```

The image contains `.git`, the whole history of the repository, and `README.md`. Worse candidates are `.env` files with passwords and a local `node_modules` built for your computer's operating system. A **`.dockerignore`** file lists what to leave out of the build context, with the same patterns as `.gitignore`:

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
cat > .dockerignore <<'EOF'
node_modules
npm-debug.log
.git
.env
data
*.md
EOF
docker build -q -t shop:1.0 .
docker run --rm shop:1.0 ls -a
```

`docker build -q` prints only the new image's ID. The context is smaller, which makes builds faster, and `.git` and `README.md` stay out of the image. (The `Dockerfile` and `.dockerignore` themselves are harmless in the image; some teams list them too.)

## CMD, exec form and shell form

`CMD` has two forms:

- **exec form**, a JSON list: `CMD ["node", "server.js"]`. Docker runs `node` directly as the container's main process.
- **shell form**, plain text: `CMD node server.js`. Docker runs `/bin/sh -c "node server.js"`, so the shell is the main process and `node` is its child. When Docker later asks the container to stop, the signal goes to the shell, which doesn't pass it on (lesson 22 shows what that costs).

BuildKit checks every Dockerfile for problems like this and prints **warnings**, such as `JSONArgsRecommended: JSON arguments recommended for CMD to prevent unintended behavior related to OS signals (line 6)`. `docker build --check .` runs only the checks. Use the exec form.

`ENTRYPOINT` is similar: it's the program, and `CMD` becomes its default arguments. The `node` images set `ENTRYPOINT ["docker-entrypoint.sh"]`, a small script that runs whatever command you give and puts `node` in front of arguments that aren't commands. That's why `docker run --rm shop:1.0 ls -a` ran `ls -a` instead of the server: arguments after the image name replace `CMD`.

## When the build fails

BuildKit shows the failing step, the lines of the Dockerfile around it, and the error:

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
```

</details>

*This example raises an error on purpose.*

```bash
cat > Dockerfile <<'EOF'
FROM node:24-alpine
WORKDIR /app
COPPY . .
CMD ["node", "server.js"]
EOF
docker build -t shop:1.0 .
```

`>>>` marks line 3, and BuildKit even suggests the instruction you probably meant. Errors from `RUN` steps show the command's last output lines; errors from `COPY` say which file wasn't found (`"/sever.js": not found`).

## Listen on every interface

Inside a container, `localhost` (127.0.0.1) means *the container itself*. A server that listens only on 127.0.0.1 accepts connections from inside its container, and nothing from outside, including Docker's port forwarding:

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

*This example raises an error on purpose.*

```bash
sed -i 's/server.listen(port,/server.listen(port, "127.0.0.1",/' server.js
grep -n "listen(" server.js
docker build -q -t shop:1.1 .
docker run -d -p 8081:3000 --name local-only shop:1.1
curl localhost:8081/prices
```

The container runs, but curl's connection is dropped. Node.js's `server.listen(port)` listens on every interface by default, which is what a containerized server needs; other frameworks often need `0.0.0.0` (Python's Flask, for example) or `--host 0.0.0.0` (Vite).

## Try it on your own computer

- Everything above runs as shown with Docker Desktop or Docker Engine. Run `npm install` once on your computer if your project has dependencies, so `package-lock.json` exists for `npm ci`.
- `docker init` asks a few questions about your project and writes a starter `Dockerfile`, `compose.yaml` and `.dockerignore`.
- In VS Code, Docker's **Docker DX** extension shows BuildKit's build checks as you type a Dockerfile, and the **Container Tools** extension lists your images and containers.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Build an image | docker build -t NAME:TAG . | adds an image | docker rmi NAME:TAG |
| Build and print only the ID | docker build -q -t NAME:TAG . | adds an image | docker rmi NAME:TAG |
| Check a Dockerfile | docker build --check . | nothing | — |
| Leave files out of the image | .dockerignore | the build context | edit the file |
| Run a command instead of CMD | docker run --rm IMAGE COMMAND | nothing (with --rm) | — |

## Common mistakes

- Forgetting the dot in docker build -t shop:1.0 . (the build context).
- Building without a .dockerignore, so .git, .env and node_modules end up in the image.
- Using the shell form of CMD, so docker stop can't reach the app.
- Listening on 127.0.0.1 inside a container, so published ports can't reach the server.
- Expecting EXPOSE to publish a port: only -p does.

## Exercises

### 1. Containerize the shop

`~/shop` has the shop's API but no Dockerfile. Write a Dockerfile that starts from `node:24-alpine`, works in `/app`, copies the project in, runs `npm ci --omit=dev`, documents port 3000 and starts the server with `node server.js` in exec form. Build it as `shop:1.0`, run it in the background as a container named `shop` with port 8080 published to port 3000, and fetch `/prices` with curl.

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
```

</details>

Starter:

```bash
ls
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** an image is your app plus a base; the Dockerfile says how to put them together and how to start the app.
2. **Examples:** the lesson's Dockerfile builds in four steps and runs `node server.js`.
3. **Brute force:** you could start `node:24-alpine`, copy files in with `docker cp` and commit the container, but nobody could repeat that.
4. **Pattern:** **FROM a base, WORKDIR, COPY, RUN the install, CMD the start command**: the skeleton of most Dockerfiles.
5. **Plan:** write the Dockerfile → build with a tag → run with a published port → curl.
6. **Code and test:** the build ends with `naming to docker.io/library/shop:1.0`; curl prints the JSON price list.

</details>

<details>
<summary>💡 Hint 1</summary>

Six instructions, one per line: `FROM`, `WORKDIR`, `COPY`, `RUN`, `EXPOSE`, `CMD`. Write the file with `cat > Dockerfile <<'EOF'` … `EOF`.

</details>

<details>
<summary>💡 Hint 2</summary>

Exec form is a JSON list with double quotes: `CMD ["node", "server.js"]`.

</details>

<details>
<summary>💡 Hint 3</summary>

Build with `docker build -t shop:1.0 .` (don't forget the final dot), then `docker run -d -p 8080:3000 --name shop shop:1.0` and `curl localhost:8080/prices`.

</details>

### 2. Fix the broken build

The Dockerfile in `~/shop` doesn't build. Fix it so that `docker build -t shop:1.0 .` succeeds with no errors **and no warnings**, keeping the same instructions: the image must still contain `server.js` and `prices.js` in `/app`, document port 3000, and start with `node server.js`.

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

</details>

Starter:

```bash
cat Dockerfile
docker build -t shop:1.0 .
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a Dockerfile is parsed first (unknown instructions fail before anything runs), then each step runs, then the build checks report warnings.
2. **Examples:** `>>>` points at the failing line, and the error says what's wrong.
3. **Brute force:** rewriting the whole file from memory risks new mistakes.
4. **Pattern:** **fix the first error, rebuild, repeat**, then make the warnings go away too.
5. **Plan:** build → fix `EXPOS` → build → fix `sever.js` → build → exec-form `CMD` → build.
6. **Code and test:** the last build ends with `naming to docker.io/library/shop:1.0` and no warning list.

</details>

<details>
<summary>💡 Hint 1</summary>

Build, read the error, fix that line, and build again. BuildKit stops at the first error, so the errors appear one at a time.

</details>

<details>
<summary>💡 Hint 2</summary>

There are two typos (an instruction and a file name) and one warning (`JSONArgsRecommended`).

</details>

<details>
<summary>💡 Hint 3</summary>

`COPY server.js prices.js ./`, `EXPOSE 3000` and `CMD ["node", "server.js"]`.

</details>

**In the sandbox:** exercises 39–40. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Containerize the shop</summary>

```bash
cat > Dockerfile <<'EOF'
FROM node:24-alpine
WORKDIR /app
COPY . .
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["node", "server.js"]
EOF
docker build -t shop:1.0 .
docker run -d -p 8080:3000 --name shop shop:1.0
curl localhost:8080/prices
```

**Line by line**

- `FROM node:24-alpine` starts from Node.js 24 on Alpine Linux.
- `WORKDIR /app` makes `/app` the folder for the rest of the build and for the running container.
- `COPY . .` copies the build context into `/app`; `RUN npm ci --omit=dev` installs the production dependencies (none yet).
- `EXPOSE 3000` documents the port; `CMD ["node", "server.js"]` starts the server as the container's main process.
- `docker run -d -p 8080:3000 --name shop shop:1.0` runs it; curl calls it through port 8080.

**Trace:** the build shows `[1/4] FROM …`, `[2/4] WORKDIR /app`, `[3/4] COPY . .`, `[4/4] RUN npm ci --omit=dev`; curl prints `{"bell":800,"pump":3000,"lock":2900}`.

**Common wrong approach:** `CMD node server.js` works, but BuildKit warns `JSONArgsRecommended`, and the container won't stop cleanly because the signal goes to a shell instead of Node.js.

</details>

<details>
<summary>✅ 2. Fix the broken build</summary>

```bash
sed -i 's/^COPY sever.js/COPY server.js/; s/^EXPOS 3000/EXPOSE 3000/; s/^CMD node server.js/CMD ["node", "server.js"]/' Dockerfile
cat Dockerfile
docker build -t shop:1.0 .
```

**Line by line**

- The `sed` command makes three substitutions at once: the file name in `COPY`, the instruction `EXPOS` and the shell-form `CMD`.
- `docker build -t shop:1.0 .` now runs every step.

**Trace:** the first build fails with `dockerfile parse error on line 6: unknown instruction: EXPOS (did you mean expose?)`; after that fix, `COPY` fails with `"/sever.js": not found`; after that, the build passes but warns about line 7.

**Common wrong approach:** stopping when the build succeeds. The warning is about a real problem: with a shell-form `CMD`, `docker stop` has to kill the container after 10 seconds.

</details>

## Quick quiz

1. What does COPY . . copy?
   - A) Every file on your computer
   - B) The build context (the folder given to docker build, minus .dockerignore) into the image's working directory
   - C) Only the Dockerfile
   - D) The image into the current folder

2. Which instruction runs while the image is built, not when a container starts?
   - A) CMD
   - B) RUN
   - C) EXPOSE
   - D) ENTRYPOINT

3. Why is CMD ["node", "server.js"] better than CMD node server.js?
   - A) It runs node directly as the main process, so it receives the stop signal
   - B) Shell form doesn't work on Alpine
   - C) It's faster to type
   - D) Exec form makes the image smaller

4. A server in a container listens on 127.0.0.1:3000 and is published with -p 8080:3000. What happens when you curl localhost:8080?
   - A) It works only on macOS
   - B) It works: localhost is the same everywhere
   - C) The connection fails: 127.0.0.1 inside the container only accepts connections from inside it
   - D) Docker rewrites the address automatically

<details>
<summary>Quiz answers</summary>

1. **B) The build context (the folder given to docker build, minus .dockerignore) into the image's working directory**: The first dot is the context, the second is the destination (WORKDIR).
2. **B) RUN**: RUN changes the image during the build; CMD and ENTRYPOINT say what a container runs later.
3. **A) It runs node directly as the main process, so it receives the stop signal**: Shell form runs /bin/sh -c, and the shell doesn't forward signals to node.
4. **C) The connection fails: 127.0.0.1 inside the container only accepts connections from inside it**: Servers in containers must listen on all interfaces (0.0.0.0 or ::), which node:http does by default.

</details>

---
Previous: [Lesson 19](19-containers.md) · Next: [Lesson 21: Layers, caching and smaller images](21-layers.md)
