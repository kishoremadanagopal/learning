# Lesson 33: Configuration and secrets

**You'll learn:** keeping configuration out of the image, ConfigMaps (--from-literal, --from-file, -o yaml), env with valueFrom.configMapKeyRef, envFrom with configMapRef, why changing a ConfigMap doesn't restart pods, rollout restart, kubectl create --dry-run=client -o yaml | kubectl apply -f -, Secrets (generic, --from-literal), base64 as encoding not encryption, jsonpath and base64 -d, secretKeyRef, mounting ConfigMaps as files (volumes and volumeMounts), kubectl patch with a JSON patch, kubectl exec and printenv, RBAC, encryption at rest, External Secrets and Sealed Secrets, Kustomize generators.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#k8s-config)**: run every example and check your exercise answers.

## Key terms

- **ConfigMap:** an object holding plain-text configuration as key–value pairs (or whole files).
- **Secret:** an object holding sensitive values, stored base64-encoded.
- **envFrom / valueFrom:** how a container's environment gets values from a ConfigMap or Secret.
- **Volume mount:** a ConfigMap or Secret made available as files at a path inside the container.
- **base64:** an encoding of bytes as text; not encryption.
- **Encryption at rest:** encrypting objects in etcd so the stored data is unreadable without a key.
- **RBAC:** role-based access control: who may read, change or delete which objects.

The shop reads `SHOP_NAME` from its environment. In Docker Compose you set it in the file (Part 4). In Kubernetes, the same values live in objects that can change without rebuilding the image: **ConfigMaps** for ordinary settings, **Secrets** for passwords and tokens.

## ConfigMaps

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
kubectl expose deployment shop --port=80 --target-port=3000 > /dev/null
```

</details>

```bash
kubectl create configmap shop-config --from-literal=SHOP_NAME="the bike shop"
kubectl get configmap shop-config -o yaml
```

`--from-literal` adds one key; `--from-file` adds a file's content, which is how you ship a whole settings file. A ConfigMap holds plain text and is not encrypted.

A Deployment reads a ConfigMap into the container's environment:

```yaml
spec:
  template:
    spec:
      containers:
        - name: shop
          image: shop:2.0
          env:
            - name: SHOP_NAME
              valueFrom:
                configMapKeyRef:
                  name: shop-config
                  key: SHOP_NAME
```

`envFrom` imports every key at once:

```yaml
          envFrom:
            - configMapRef:
                name: shop-config
```

Changing a ConfigMap doesn't restart the pods: environment variables are read once, when a container starts. Make the pods pick it up with a rollout:

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
kubectl expose deployment shop --port=80 --target-port=3000 > /dev/null
kubectl create configmap shop-config --from-literal=SHOP_NAME="the bike shop" > /dev/null
kubectl patch deployment shop --patch '{"spec":{"template":{"spec":{"containers":[{"name":"shop","envFrom":[{"configMapRef":{"name":"shop-config"}}]}]}}}}' > /dev/null
kubectl rollout status deployment/shop > /dev/null
```

</details>

```bash
kubectl create configmap shop-config --from-literal=SHOP_NAME="the cycle shop" --dry-run=client -o yaml | kubectl apply -f -
kubectl rollout restart deployment/shop
kubectl rollout status deployment/shop
kubectl exec deploy/shop -- printenv SHOP_NAME
```

`--dry-run=client -o yaml | kubectl apply -f -` is the way to update a ConfigMap in place. The first time, `apply` warns that the object was created without it; that's harmless, and from then on apply keeps track of the object. `rollout restart` replaces the pods one at a time, so they all start with the new value.

## Secrets

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
kubectl expose deployment shop --port=80 --target-port=3000 > /dev/null
kubectl create configmap shop-config --from-literal=SHOP_NAME="the bike shop" > /dev/null
kubectl patch deployment shop --patch '{"spec":{"template":{"spec":{"containers":[{"name":"shop","envFrom":[{"configMapRef":{"name":"shop-config"}}]}]}}}}' > /dev/null
kubectl rollout status deployment/shop > /dev/null
```

</details>

```bash
kubectl create secret generic shop-secret --from-literal=ADMIN_TOKEN=s3cret-token-123
kubectl get secret shop-secret -o yaml
kubectl get secret shop-secret -o jsonpath='{.data.ADMIN_TOKEN}' | base64 -d; echo
```

Secret values are stored **base64-encoded**. That's an encoding, not encryption: anyone who can read the Secret can decode it, as the last command shows. What protects Secrets in practice is access control (RBAC, so only some people can read them), encryption at rest in etcd, and keeping the values out of Git. Tools such as External Secrets, Sealed Secrets and the cloud's secret stores sit on top of this.

A pod uses a Secret like a ConfigMap, with `secretKeyRef` or `secretRef`:

```yaml
          env:
            - name: ADMIN_TOKEN
              valueFrom:
                secretKeyRef:
                  name: shop-secret
                  key: ADMIN_TOKEN
```

## Files instead of variables

A ConfigMap can also appear as files in the container: each key becomes a file under the mount path, and updates eventually reach those files without a restart (though the app must reread them):

```yaml
          volumeMounts:
            - name: config
              mountPath: /app/config
      volumes:
        - name: config
          configMap:
            name: shop-config
```

## Try it on your own computer

- Keep the manifests in Git, and the secret values out of it: a placeholder in the file, the real value applied from a secure place.
- `kubectl create secret generic --from-env-file=.env` loads several secrets at once from a file that you never commit.
- Kustomize (built into kubectl as `kubectl apply -k`) adds per-environment values to shared manifests with `configMapGenerator` and `secretGenerator`.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Create a ConfigMap | kubectl create configmap NAME --from-literal=KEY=VALUE | creates the object | kubectl delete configmap NAME |
| Update a ConfigMap | kubectl create configmap NAME … --dry-run=client -o yaml \| kubectl apply -f - | changes the object | — |
| Create a Secret | kubectl create secret generic NAME --from-literal=KEY=VALUE | creates the object | kubectl delete secret NAME |
| Read a Secret value | kubectl get secret NAME -o jsonpath='{.data.KEY}' \| base64 -d | nothing | — |
| Make pods pick up changes | kubectl rollout restart deployment/NAME | replaces every pod | — |
| Check a pod's environment | kubectl exec deploy/NAME -- printenv KEY | nothing | — |

## Common mistakes

- Treating base64 in a Secret as protection, and committing Secret manifests with real values to Git.
- Changing a ConfigMap and expecting running pods to see the new value without a restart.
- Putting a whole config file into the image, so every change needs a rebuild.
- Using a ConfigMap for a password.
- Forgetting the newline when printing a decoded secret.

## Exercises

### 1. Name the shop from a ConfigMap

Create a ConfigMap named `shop-config` with `SHOP_NAME` set to `the cycle shop`, make the `shop` Deployment read it with `envFrom`, and restart the deployment so its pods pick up the value. Then check the environment of a pod.

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
kubectl expose deployment shop --port=80 --target-port=3000 > /dev/null
```

</details>

Starter:

```bash
kubectl get deployment shop -o yaml | grep -A3 env
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a container reads its environment when it starts, so a new value needs new pods.
2. **Examples:** the lesson used `envFrom` with a `configMapRef`, then `rollout restart`.
3. **Brute force:** editing the image to change a setting works but rebuilds the image for a config change.
4. **Pattern:** **ConfigMap → envFrom in the pod template → rollout**.
5. **Plan:** create, wire, roll out, check.
6. **Code and test:** `printenv` prints `the cycle shop`, and the welcome page says so too.

</details>

<details>
<summary>💡 Hint 1</summary>

`kubectl create configmap shop-config --from-literal=SHOP_NAME="the cycle shop"` creates it.

</details>

<details>
<summary>💡 Hint 2</summary>

The deployment needs `envFrom` with a `configMapRef` pointing at `shop-config`; `kubectl patch` can add it.

</details>

<details>
<summary>💡 Hint 3</summary>

After changing the pod template, `kubectl rollout status deployment/shop` waits for new pods; `kubectl exec deploy/shop -- printenv SHOP_NAME` checks the value.

</details>

### 2. Store a token in a Secret

Create a Secret named `shop-secret` with the key `ADMIN_TOKEN` and the value `s3cret-token-123`, then read the value back in plain text.

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
kubectl expose deployment shop --port=80 --target-port=3000 > /dev/null
```

</details>

Starter:

```bash
kubectl get secrets
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** Secret values are base64-encoded, not encrypted.
2. **Examples:** the lesson read `shop-secret` back with jsonpath and base64 -d.
3. **Brute force:** reading the YAML and decoding by hand is slower than jsonpath.
4. **Pattern:** **create secret generic → get -o jsonpath → base64 -d**.
5. **Plan:** create, read back.
6. **Code and test:** `s3cret-token-123`.

</details>

<details>
<summary>💡 Hint 1</summary>

`kubectl create secret generic NAME --from-literal=KEY=VALUE` creates a Secret.

</details>

<details>
<summary>💡 Hint 2</summary>

The stored value is base64; `kubectl get secret … -o jsonpath='{.data.ADMIN_TOKEN}'` prints it encoded.

</details>

<details>
<summary>💡 Hint 3</summary>

Pipe that into `base64 -d` to decode it.

</details>

**In the sandbox:** exercises 64–65. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Name the shop from a ConfigMap</summary>

```bash
kubectl create configmap shop-config --from-literal=SHOP_NAME="the cycle shop"
kubectl patch deployment shop --patch '{"spec":{"template":{"spec":{"containers":[{"name":"shop","envFrom":[{"configMapRef":{"name":"shop-config"}}]}]}}}}'
kubectl rollout status deployment/shop
kubectl exec deploy/shop -- printenv SHOP_NAME
```

**Line by line**

- `create configmap` stores `SHOP_NAME` as a key of the object.
- `patch` changes the Deployment's pod template: a template change starts a rollout, so the new pods read the ConfigMap when they start.
- `kubectl exec deploy/shop -- printenv SHOP_NAME` runs a command in one of the pods.

**Trace:** the new pods print `the cycle shop`.

**Common wrong approach:** changing the ConfigMap and expecting running pods to change. Environment variables are read only at container start.

</details>

<details>
<summary>✅ 2. Store a token in a Secret</summary>

```bash
kubectl create secret generic shop-secret --from-literal=ADMIN_TOKEN=s3cret-token-123
kubectl get secret shop-secret -o jsonpath='{.data.ADMIN_TOKEN}' | base64 -d; echo
```

**Line by line**

- `create secret generic shop-secret --from-literal=ADMIN_TOKEN=…` stores the value base64-encoded under `data.ADMIN_TOKEN`.
- `-o jsonpath='{.data.ADMIN_TOKEN}'` prints only that field.
- `base64 -d` decodes it; `; echo` adds the missing newline.

**Trace:** `s3cret-token-123`.

**Common wrong approach:** believing base64 protects the value. It only makes it safe to store in YAML; access control protects it.

</details>

## Quick quiz

1. Why keep configuration out of the image?
   - A) Kubernetes can't run images with configuration
   - B) So the same image runs everywhere and a setting can change without rebuilding it
   - C) Images can't contain environment variables
   - D) It makes images smaller by law

2. You edit a ConfigMap. What do running pods see?
   - A) The pods are deleted automatically
   - B) An error
   - C) Nothing until they restart: environment variables are read at container start
   - D) The new value immediately, in every variable

3. Is a Secret encrypted by default?
   - A) It depends on the image
   - B) Yes, with a key that only Kubernetes holds
   - C) No: its values are base64-encoded, so access control and encryption at rest must protect it
   - D) Yes, always, with the pod's name

4. Which command restarts every pod of a deployment with the same image?
   - A) kubectl apply --restart
   - B) kubectl delete pods
   - C) kubectl rollout restart deployment/NAME
   - D) kubectl reset deployment

<details>
<summary>Quiz answers</summary>

1. **B) So the same image runs everywhere and a setting can change without rebuilding it**: One image, many environments: the configuration is supplied by the cluster.
2. **C) Nothing until they restart: environment variables are read at container start**: A rollout restart gives the pods the new value.
3. **C) No: its values are base64-encoded, so access control and encryption at rest must protect it**: base64 is an encoding; anyone who can read the Secret can decode it.
4. **C) kubectl rollout restart deployment/NAME**: A rollout restart replaces the pods one at a time, so they pick up configuration.

</details>

---
Previous: [Lesson 32](32-k8s-services.md) · Next: [Lesson 34: Health checks, resources and scaling](34-k8s-health-scaling.md)
