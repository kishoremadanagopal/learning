# Lesson 34: Health checks, resources and scaling

**You'll learn:** readiness, liveness and startup probes, httpGet probes, initialDelaySeconds, periodSeconds and failureThreshold, what each probe does on failure, a readiness failure and a stuck rollout, rollout undo after a bad release, CrashLoopBackOff and kubectl logs --previous, restart back-off, resource requests and limits (CPU and memory), the scheduler's use of requests, OOMKilled and CPU throttling, kubectl set resources, kubectl autoscale and the HorizontalPodAutoscaler, metrics and kubectl top, terminationGracePeriodSeconds and SIGTERM, preStop hooks, kubectl get events, separate checks for dependencies.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#k8s-health-scaling)**: run every example and check your exercise answers.

## Key terms

- **Readiness probe:** a check that decides whether a pod receives Service traffic.
- **Liveness probe:** a check that restarts a container when it fails.
- **Startup probe:** a check that holds off liveness and readiness until a slow start has finished.
- **CrashLoopBackOff:** a container that keeps failing and is restarted with increasing delays.
- **Resource request:** the amount the scheduler reserves for a container on a node.
- **Resource limit:** the most a container may use; over the memory limit it's killed (OOMKilled).
- **HorizontalPodAutoscaler (HPA):** an object that changes a Deployment's replicas based on a metric, such as CPU use.
- **Graceful shutdown:** SIGTERM, a grace period, then SIGKILL, during which the app finishes its requests.

A process can be running and still be broken: stuck, out of memory, or not yet ready to serve. Kubernetes asks each container to prove it's healthy with **probes**, and it uses the answers in different ways.

| Probe | If it fails | Use it for |
|---|---|---|
| **readiness** | the pod is removed from Service endpoints (no traffic) | "I'm not ready for requests yet" or "I'm busy right now" |
| **liveness** | the container is restarted | "I'm stuck, restart me" |
| **startup** | liveness and readiness wait until it succeeds | slow starts, so liveness doesn't kill a pod that's still booting |

## A readiness probe

The shop answers `/health` with `ok`. Add a readiness probe so the Service only sends traffic to a pod after that answer:

```yaml
containers:
  - name: shop
    image: shop:2.0
    readinessProbe:
      httpGet:
        path: /health
        port: 3000
      initialDelaySeconds: 2
      periodSeconds: 5
      failureThreshold: 3
```

- `initialDelaySeconds`: wait before the first check.
- `periodSeconds`: how often to check.
- `failureThreshold`: how many failures in a row count as failing (3 by default).

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
kubectl patch deployment shop --patch '{"spec":{"template":{"spec":{"containers":[{"name":"shop","readinessProbe":{"httpGet":{"path":"/health","port":3000},"periodSeconds":5}}]}}}}'
kubectl rollout status deployment/shop
kubectl get pods -l app=shop
kubectl describe pod -l app=shop | grep -i readiness
```

## A failing probe

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
kubectl patch deployment shop --patch '{"spec":{"template":{"spec":{"containers":[{"name":"shop","readinessProbe":{"httpGet":{"path":"/missing","port":3000},"periodSeconds":5}}]}}}}'
kubectl get pods -l app=shop
kubectl describe pod -l app=shop | grep -i "readiness probe failed" | head -1
```

The new pods start but never become ready, so the rollout stops: the old pods keep serving because `maxUnavailable` keeps enough of them ready. Roll back with `kubectl rollout undo deployment/shop`. A broken version that never becomes ready is the most common reason a rollout hangs.

## Restarts and CrashLoopBackOff

A container that exits (or fails its liveness probe) is restarted by the kubelet, with an increasing delay: 10 seconds, 20, 40 and so on, up to five minutes. The pod shows `CrashLoopBackOff`, and RESTARTS counts up. `kubectl logs --previous` shows the output of the last crashed run; it's the first thing to check.

## Resources

Each container can ask for resources and set a limit:

```yaml
resources:
  requests:
    cpu: 100m        # 0.1 of a CPU core: what the scheduler reserves for the pod
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi    # above this, the container is killed (OOMKilled)
```

The scheduler places a pod only on a node with enough unreserved requests. A container over its memory limit is killed and restarted; a container over its CPU limit is slowed down, not killed.

## Scaling

Scale by hand with `kubectl scale`, or let the **HorizontalPodAutoscaler** adjust the replica count from CPU use:

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
kubectl set resources deployment shop --requests=cpu=50m --limits=cpu=200m
kubectl autoscale deployment shop --min=2 --max=6 --cpu=70%
kubectl get hpa
```

The autoscaler reads CPU use every 15 seconds, compares it with the target, and scales between the minimum and maximum. It needs CPU requests set to work out a percentage, which is why the first command sets them. It also needs the **metrics server** to read CPU use at all: until it has numbers, `TARGETS` shows `<unknown>` (kind doesn't install it, so the sandbox shows that too). Use `kubectl scale` for a fixed count and an autoscaler for changing load.

## Graceful shutdown

When a pod is deleted or updated, Kubernetes sends `SIGTERM`, waits `terminationGracePeriodSeconds` (30 by default), then sends `SIGKILL`. The shop's Node.js server should finish open requests on SIGTERM (Part 4, lesson 22), and the pod should also leave the Service first: a short `preStop` sleep gives the endpoint change time to reach every node.

## Try it on your own computer

- The metrics server (`kubectl top pods`) provides CPU and memory use; kind installs it only if you ask.
- `kubectl get events --sort-by=.lastTimestamp` lists what happened recently, which explains most surprises.
- Probes that call a database make a database outage remove every pod from its Service at once. Keep readiness checks about the process, and use separate checks for dependencies.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Add a readiness probe | edit the container with readinessProbe.httpGet, or kubectl patch | pods get new readiness rules | remove the probe in the manifest |
| See probe failures | kubectl describe pod NAME (events) | nothing | — |
| Read the last crashed run | kubectl logs NAME --previous | nothing | — |
| Set resources | kubectl set resources deployment/NAME --requests=cpu=50m --limits=cpu=200m | new pods get the values | kubectl set resources again |
| Autoscale | kubectl autoscale deployment NAME --min=2 --max=6 --cpu-percent=70 | creates an HPA | kubectl delete hpa NAME |
| Scale by hand | kubectl scale deployment NAME --replicas=N | changes the count | scale back |
| See recent events | kubectl get events --sort-by=.lastTimestamp | nothing | — |

## Common mistakes

- Using a liveness probe on a slow endpoint, so busy pods are restarted in a loop.
- Making readiness depend on a database, so a database outage removes every pod from its Service.
- Setting no memory limit, or one below the app's normal use, so it's OOMKilled under load.
- Autoscaling on CPU without setting CPU requests: the percentage has nothing to compare with.
- Ignoring a rollout that hangs: a pod that never becomes ready is the usual cause.

## Exercises

### 1. Only healthy pods get traffic

The deployment `shop` has no probe. Add a readiness probe that checks `/health` on port 3000 every 5 seconds, wait for the rollout, and check that all three pods are ready.

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
kubectl get deployment shop -o yaml | grep -c readinessProbe
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a readiness probe decides whether a pod receives traffic.
2. **Examples:** the lesson patched a readiness probe onto the shop.
3. **Brute force:** a liveness probe on the same path restarts pods that are merely busy.
4. **Pattern:** **readinessProbe: httpGet: path, port; then rollout status**.
5. **Plan:** patch, wait, check.
6. **Code and test:** three pods with READY 1/1.

</details>

<details>
<summary>💡 Hint 1</summary>

A readiness probe goes inside the container entry: `readinessProbe: { httpGet: { path: /health, port: 3000 }, periodSeconds: 5 }`.

</details>

<details>
<summary>💡 Hint 2</summary>

`kubectl patch deployment shop --patch '…'` accepts the same JSON; the container is named `shop`.

</details>

<details>
<summary>💡 Hint 3</summary>

After the patch, `kubectl rollout status deployment/shop` waits until the new pods pass their checks.

</details>

**In the sandbox:** exercise 66. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Only healthy pods get traffic</summary>

```bash
kubectl patch deployment shop --patch '{"spec":{"template":{"spec":{"containers":[{"name":"shop","readinessProbe":{"httpGet":{"path":"/health","port":3000},"periodSeconds":5}}]}}}}'
kubectl rollout status deployment/shop
kubectl get pods -l app=shop
```

**Line by line**

- `readinessProbe.httpGet` asks for `/health` on port 3000.
- `periodSeconds: 5` checks every five seconds.
- The rollout waits until the new pods pass; the Service sends them traffic only after that.

**Trace:** `deployment "shop" successfully rolled out`, three pods 1/1.

**Common wrong approach:** a liveness probe that restarts the pod whenever a request is slow. Use readiness for "not right now" and liveness only for "stuck for good".

</details>

## Quick quiz

1. A pod fails its readiness probe but keeps running. What happens?
   - A) It's deleted
   - B) Nothing: probes don't affect traffic
   - C) It's removed from Service endpoints, so it gets no traffic until the probe passes again
   - D) It's restarted immediately

2. What does CrashLoopBackOff mean?
   - A) A container keeps failing and is restarted with increasing delays
   - B) The cluster is out of memory
   - C) The image is being pulled
   - D) The pod was deleted on purpose

3. A container exceeds its memory limit. What happens?
   - A) Nothing until the node runs out
   - B) The pod is moved to a bigger node
   - C) It's killed (OOMKilled) and restarted
   - D) It's slowed down

4. What do resource requests decide?
   - A) The number of replicas
   - B) The maximum a container may use
   - C) Where the scheduler can place the pod, by reserving that much on a node
   - D) The image size

<details>
<summary>Quiz answers</summary>

1. **C) It's removed from Service endpoints, so it gets no traffic until the probe passes again**: Readiness controls traffic; liveness controls restarts.
2. **A) A container keeps failing and is restarted with increasing delays**: Check the last run with kubectl logs --previous.
3. **C) It's killed (OOMKilled) and restarted**: CPU over its limit is throttled; memory over its limit is fatal to the container.
4. **C) Where the scheduler can place the pod, by reserving that much on a node**: Requests are reservations; limits are the ceiling.

</details>

---
Previous: [Lesson 33](33-k8s-config.md) · Back to the [course home](../README.md)
