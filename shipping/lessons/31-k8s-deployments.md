# Lesson 31: Deployments and rolling updates

**You'll learn:** why controllers create pods, Deployments, ReplicaSets and pod templates, labels and selectors (app=shop), the pod-template-hash, self-healing when a pod is deleted, scaling with kubectl scale (which pods are removed), rolling updates with kubectl set image and rollout status, the strategy with maxSurge and maxUnavailable, rollout history and rollout undo, the old ReplicaSets kept at zero replicas, kubectl create deployment --dry-run=client -o yaml, declarative updates with kubectl apply, kubectl diff, rollout restart, and GitOps (Argo CD, Flux).

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#k8s-deployments)**: run every example and check your exercise answers.

## Key terms

- **Deployment:** an object that keeps a set number of identical pods running and updates them to a new template.
- **ReplicaSet:** an object that keeps exactly N pods matching its template running; each template version has its own.
- **Pod template:** the pod spec inside a Deployment or ReplicaSet, from which the pods are created.
- **Label selector:** a rule that matches objects by their labels, such as app=shop; used by Deployments, ReplicaSets and Services.
- **Pod-template-hash:** a label derived from the pod template, so each version gets its own ReplicaSet.
- **Rolling update:** replacing pods gradually so some are always serving.
- **maxSurge / maxUnavailable:** how many extra pods may run, and how many may be unavailable, during an update.
- **Rollback:** going back to a previous ReplicaSet's template with kubectl rollout undo.

A Deployment keeps a set number of identical pods running, and it updates them to a new version without downtime. You never create its pods yourself: you declare how many you want and which image they run, and the Deployment's controllers do the rest.

![Deployment shop owns ReplicaSet shop-64f8dc496f, which owns three pods with the labels app=shop and pod-template-hash=64f8dc496f. When a pod is deleted, the ReplicaSet notices there are two instead of three and creates a new one. During a rolling update, a second ReplicaSet with a different hash scales up as the old one scales down](../figures/k8s-deployment.svg)

Three objects make up a Deployment:

| Object | Job |
|---|---|
| **Deployment** | what you declare: the number of replicas, the pod template, the update strategy; it manages ReplicaSets |
| **ReplicaSet** | keeps exactly N pods matching a template running; one ReplicaSet per version of the template |
| **Pod** | the running containers, created from the template |

## Creating one

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
cd ~/shop
kind create cluster > /dev/null 2>&1
kind load docker-image shop:1.0 > /dev/null 2>&1
```

</details>

```bash
kubectl create deployment shop --image=shop:1.0 --replicas=3
kubectl rollout status deployment/shop
kubectl get deployments,replicasets,pods
```

`rollout status` waits until the new pods are ready. The ReplicaSet's name is the Deployment's name plus a **pod-template-hash**, a hash of the pod template: when the template changes, the hash changes, and a new ReplicaSet is made for it. The pods' names add a random suffix.

Labels link the objects. The Deployment selects pods with `app=shop`; the ReplicaSet does too, plus its own hash label:

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
cd ~/shop
kind create cluster > /dev/null 2>&1
kind load docker-image shop:1.0 > /dev/null 2>&1
kubectl create deployment shop --image=shop:1.0 --replicas=3 > /dev/null
kubectl rollout status deployment/shop > /dev/null
```

</details>

```bash
kubectl get pods --show-labels
kubectl get pods -l app=shop
```

`-l` (`--selector`) filters by label: you'll use the same syntax for Services (lesson 32).

## Self-healing

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
cd ~/shop
kind create cluster > /dev/null 2>&1
kind load docker-image shop:1.0 > /dev/null 2>&1
kubectl create deployment shop --image=shop:1.0 --replicas=3 > /dev/null
kubectl rollout status deployment/shop > /dev/null
```

</details>

```bash
kubectl delete $(kubectl get pods -o name | head -1)
kubectl get pods
```

The ReplicaSet saw two pods instead of three and made a new one. Deleting a pod is how you'd restart a broken pod: the Deployment replaces it. Deleting a node does the same thing: its pods are recreated on the other nodes.

## Scaling

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
cd ~/shop
kind create cluster > /dev/null 2>&1
kind load docker-image shop:1.0 > /dev/null 2>&1
kubectl create deployment shop --image=shop:1.0 --replicas=3 > /dev/null
kubectl rollout status deployment/shop > /dev/null
```

</details>

```bash
kubectl scale deployment shop --replicas=5
kubectl get pods
kubectl scale deployment shop --replicas=2
kubectl get pods
```

Scaling down removes pods; which ones is the ReplicaSet's choice (the youngest, or those on busy nodes).

## Rolling updates

Change the image and the Deployment replaces the pods gradually, so some are always serving:

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
cd ~/shop
kind create cluster > /dev/null 2>&1
kind load docker-image shop:1.0 > /dev/null 2>&1
kubectl create deployment shop --image=shop:1.0 --replicas=3 > /dev/null
kubectl rollout status deployment/shop > /dev/null
sed -i 's/Welcome to/Welcome back to/' server.js
docker build -q -t shop:2.0 . > /dev/null
kind load docker-image shop:2.0 > /dev/null 2>&1
```

</details>

```bash
kubectl set image deployment/shop shop=shop:2.0
kubectl rollout status deployment/shop
kubectl get replicasets
```

The old ReplicaSet is kept, scaled to zero, so you can go back. Two settings in the Deployment's `strategy` control the pace:

- `maxSurge` (default 25%): how many extra pods may exist during the update (new ones starting before old ones stop).
- `maxUnavailable` (default 25%): how many pods may be unavailable at once.

With 3 replicas and the defaults, Kubernetes starts one new pod, waits for it to be ready, then stops one old pod, and so on.

```yaml
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0      # never fewer than 3 ready pods
```

## History and rollback

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
cd ~/shop
kind create cluster > /dev/null 2>&1
kind load docker-image shop:1.0 > /dev/null 2>&1
kubectl create deployment shop --image=shop:1.0 --replicas=3 > /dev/null
kubectl rollout status deployment/shop > /dev/null
sed -i 's/Welcome to/Welcome back to/' server.js
docker build -q -t shop:2.0 . > /dev/null
kind load docker-image shop:2.0 > /dev/null 2>&1
```

</details>

```bash
kubectl set image deployment/shop shop=shop:2.0
kubectl rollout status deployment/shop > /dev/null
kubectl rollout history deployment/shop
kubectl rollout undo deployment/shop
kubectl rollout status deployment/shop
kubectl get deployment shop -o jsonpath='{.spec.template.spec.containers[0].image}'
```

`rollout undo` goes back to the previous ReplicaSet's template. The history lists each revision; its CHANGE-CAUSE column is empty unless you annotate the Deployment with `kubernetes.io/change-cause` (the old `--record` flag is deprecated).

## Declarative updates

`kubectl create` and `set image` change the cluster directly; the manifest in Git doesn't change. The usual way is a manifest file and `apply`, so the file is the truth:

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
cd ~/shop
kind create cluster > /dev/null 2>&1
kind load docker-image shop:1.0 > /dev/null 2>&1
```

</details>

```bash
kubectl create deployment shop --image=shop:1.0 --replicas=3 --dry-run=client -o yaml > deployment.yaml
kubectl apply -f deployment.yaml
kubectl get deployment shop
```

`--dry-run=client -o yaml` prints the object the command would create, without creating it: a quick way to start a manifest. Edit the file, and `kubectl apply -f deployment.yaml` makes the cluster match it.

## Try it on your own computer

- `kubectl rollout restart deployment/shop` replaces every pod with the same image: useful after a configuration change (lesson 33).
- `kubectl diff -f deployment.yaml` shows what an apply would change before you run it.
- Argo CD and Flux keep a cluster matching a Git repository; that's the next step once manifests live in Git.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Create a Deployment | kubectl create deployment NAME --image=IMAGE --replicas=N | creates the Deployment, ReplicaSet and pods | kubectl delete deployment NAME |
| Scale | kubectl scale deployment NAME --replicas=N | adds or removes pods | scale back |
| Update the image | kubectl set image deployment/NAME CONTAINER=IMAGE | starts a rolling update | kubectl rollout undo deployment/NAME |
| Wait for a rollout | kubectl rollout status deployment/NAME | nothing | — |
| Show history | kubectl rollout history deployment/NAME | nothing | — |
| Roll back | kubectl rollout undo deployment/NAME | a new rollout to the previous template | kubectl rollout undo again |
| Restart all pods | kubectl rollout restart deployment/NAME | replaces every pod | — |
| Write a manifest from a command | kubectl create deployment … --dry-run=client -o yaml > FILE | nothing in the cluster | — |
| See what an apply would change | kubectl diff -f FILE.yaml | nothing | — |

## Common mistakes

- Changing pods directly (kubectl delete pod or kubectl set image on a bare pod) when the Deployment should be changed instead.
- Deleting and recreating a Deployment to update it, which takes every pod down at once.
- Editing a Deployment with kubectl set image and never updating the manifest in Git, so the next apply reverts it.
- Using maxUnavailable: 1 with a single replica, which turns every update into an outage.
- Forgetting that the selector of a Deployment can't be changed after creation.

## Exercises

### 1. Three copies of the shop

Create a Deployment named `shop` that runs `shop:1.0` with 3 replicas, and wait for the rollout to finish.

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
cd ~/shop
kind create cluster > /dev/null 2>&1
kind load docker-image shop:1.0 > /dev/null 2>&1
```

</details>

Starter:

```bash
kubectl get deployments
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a Deployment's replicas field is the number of pods it keeps running.
2. **Examples:** the lesson created `shop` with 3 replicas.
3. **Brute force:** running three bare pods works, but nothing replaces them when they fail.
4. **Pattern:** **Deployment = image + replicas**, then wait with rollout status.
5. **Plan:** create the deployment, wait.
6. **Code and test:** `deployment "shop" successfully rolled out`, and 3/3 ready.

</details>

<details>
<summary>💡 Hint 1</summary>

`kubectl create deployment NAME --image=IMAGE --replicas=N` creates the deployment and its pods.

</details>

<details>
<summary>💡 Hint 2</summary>

`kubectl rollout status deployment/shop` waits until all three pods are ready.

</details>

<details>
<summary>💡 Hint 3</summary>

The command is `kubectl create deployment shop --image=shop:1.0 --replicas=3`.

</details>

### 2. Roll out version 2

The cluster runs `shop` at `shop:1.0`, and `shop:2.0` is loaded too. Update the Deployment to `shop:2.0`, wait for the rollout, and check that every pod runs the new image.

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
cd ~/shop
kind create cluster > /dev/null 2>&1
kind load docker-image shop:1.0 > /dev/null 2>&1
kubectl create deployment shop --image=shop:1.0 --replicas=3 > /dev/null
kubectl rollout status deployment/shop > /dev/null
sed -i 's/Welcome to/Welcome back to/' server.js
docker build -q -t shop:2.0 . > /dev/null
kind load docker-image shop:2.0 > /dev/null 2>&1
```

</details>

Starter:

```bash
kubectl get deployment shop -o wide
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** changing a pod template's image starts a rolling update.
2. **Examples:** the lesson ran `kubectl set image deployment/shop shop=shop:2.0`.
3. **Brute force:** deleting the deployment and creating it again would drop every pod at once.
4. **Pattern:** **set image → rollout status**.
5. **Plan:** set the image, wait.
6. **Code and test:** `deployment "shop" successfully rolled out` and three pods with `shop:2.0`.

</details>

<details>
<summary>💡 Hint 1</summary>

`kubectl set image deployment/NAME CONTAINER=IMAGE` changes the image; the container is named `shop`.

</details>

<details>
<summary>💡 Hint 2</summary>

After the change, `kubectl rollout status deployment/shop` waits until the new pods are ready.

</details>

<details>
<summary>💡 Hint 3</summary>

`kubectl set image deployment/shop shop=shop:2.0`, then `kubectl rollout status deployment/shop`.

</details>

**In the sandbox:** exercises 61–62. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Three copies of the shop</summary>

```bash
kubectl create deployment shop --image=shop:1.0 --replicas=3
kubectl rollout status deployment/shop
kubectl get deployments
```

**Line by line**

- `create deployment shop --image=shop:1.0` makes the Deployment with the pod template `shop:1.0`.
- `--replicas=3` asks the ReplicaSet for three pods.
- `rollout status` blocks until all three report ready.

**Trace:** `deployment.apps/shop created`, then `deployment "shop" successfully rolled out`.

**Common wrong approach:** creating a pod named shop-pod and calling it done (lesson 30): nothing keeps it running.

</details>

<details>
<summary>✅ 2. Roll out version 2</summary>

```bash
kubectl set image deployment/shop shop=shop:2.0
kubectl rollout status deployment/shop
kubectl get pods -l app=shop
```

**Line by line**

- `set image deployment/shop shop=shop:2.0` changes the image of the container named `shop`.
- The Deployment creates a new ReplicaSet with a new template hash and scales it up while the old one scales down.
- `rollout status` waits until the update is complete.

**Trace:** the pods' names change (new hash), and all three run `shop:2.0`.

**Common wrong approach:** `kubectl delete deployment shop` and recreating it. That's a full outage while it restarts.

</details>

## Quick quiz

1. What does the pod-template-hash label identify?
   - A) The number of replicas
   - B) The node a pod runs on
   - C) The version of the pod template: a changed template gets a new ReplicaSet with a new hash
   - D) The pod's IP address

2. You delete one of three shop pods. What happens?
   - A) The Deployment is deleted
   - B) Nothing: the other two keep serving forever
   - C) The pod is restarted with the same name
   - D) The ReplicaSet notices there are two and creates a replacement

3. What does maxUnavailable: 0 with maxSurge: 1 guarantee during an update?
   - A) No pods are ever restarted
   - B) The update completes in one step
   - C) The image is pulled before the update
   - D) Never fewer than the declared number of ready pods, at the cost of briefly running one extra

4. Which command goes back to the previous version of a Deployment?
   - A) kubectl delete deployment NAME
   - B) kubectl apply --rollback
   - C) kubectl scale deployment NAME --replicas=0
   - D) kubectl rollout undo deployment/NAME

<details>
<summary>Quiz answers</summary>

1. **C) The version of the pod template: a changed template gets a new ReplicaSet with a new hash**: Each template version has its own ReplicaSet, which is how rollbacks work.
2. **D) The ReplicaSet notices there are two and creates a replacement**: A ReplicaSet keeps the number of matching pods at the declared count.
3. **D) Never fewer than the declared number of ready pods, at the cost of briefly running one extra**: Kubernetes starts a new pod, waits for it to be ready, then stops an old one.
4. **D) kubectl rollout undo deployment/NAME**: Rollouts keep the old ReplicaSets, so undo just switches back to the previous template.

</details>

---
Previous: [Lesson 30](30-k8s-first-cluster.md) · Next: [Lesson 32: Services and networking](32-k8s-services.md)
