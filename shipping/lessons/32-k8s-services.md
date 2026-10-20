# Lesson 32: Services and networking

**You'll learn:** why pod IPs change, Services and label selectors, ClusterIP addresses, cluster DNS (short names, namespaces, svc.cluster.local), kubectl expose with --name, --port and --target-port, endpoints and EndpointSlices, readiness and endpoints, load balancing by connection, testing from a temporary pod with kubectl run --rm -i, kubectl logs with label selectors and --prefix, kubectl port-forward, service types ClusterIP, NodePort and LoadBalancer, Ingress and the Gateway API, service environment variables.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#k8s-services)**: run every example and check your exercise answers.

## Key terms

- **Service:** a stable name and address that sends traffic to the pods matching its selector.
- **ClusterIP:** a virtual address for a Service, reachable only inside the cluster.
- **Endpoints / EndpointSlice:** the list of ready pod addresses a Service forwards to.
- **port and targetPort:** the Service's port that callers use, and the container port it forwards to.
- **Cluster DNS:** the name service that resolves Service names such as shop and shop.default.svc.cluster.local.
- **NodePort:** a Service port opened on every node, from 30000 to 32767 by default.
- **LoadBalancer:** a Service type that asks the cloud for an external load balancer.
- **Ingress:** routes outside traffic by host name and path to Services.
- **port-forward:** a development tunnel from a local port to a Service or pod.

Pods come and go, and each new pod gets a new IP address. The shop's frontend can't keep track of those addresses. A **Service** gives a set of pods one stable name and address, and sends traffic to whichever pods are ready.

![A Service named shop with cluster IP 10.96.143.166 and port 80 selects pods labelled app=shop. Traffic to shop:80 is forwarded to port 3000 of the ready pods, which have IPs 10.244.0.5, 10.244.0.7 and 10.244.0.9. A pod that is not ready is left out of the list of endpoints](../figures/k8s-service.svg)

A Service has:

- a **selector**: the labels of the pods it sends traffic to (here `app=shop`);
- a **port** (what callers connect to, 80) and a **targetPort** (the port the container listens on, 3000);
- a **type**, which decides how it's reachable.

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
kubectl create deployment shop --image=shop:1.0 --replicas=3 > /dev/null
kubectl rollout status deployment/shop > /dev/null
```

</details>

```bash
kubectl expose deployment shop --port=80 --target-port=3000
kubectl get service shop
kubectl get endpointslices -l kubernetes.io/service-name=shop
```

`kubectl expose` writes a Service that selects the deployment's pods. `CLUSTER-IP` is a virtual address, reachable from inside the cluster only. The **endpoints** (EndpointSlice) list the pod IPs that are ready: a pod that fails its readiness check is removed from the list, and returns when it recovers (lesson 34).

## Names inside the cluster

Cluster DNS gives each Service a name. From a pod in the same namespace, `shop` is enough; the full name is `shop.default.svc.cluster.local`. A temporary pod shows it:

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
kubectl run tester --image=busybox:1.37 --restart=Never --rm -i -- wget -qO- http://shop
kubectl run tester --image=busybox:1.37 --restart=Never --rm -i -- wget -qO- http://shop.default.svc.cluster.local/health
```

`--rm -i` runs the command in a pod and deletes it afterwards. Each request goes to one of the ready pods, so you'd see different pods answer over time: read the shop's logs to see which:

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
for i in 1 2 3 4 5 6; do kubectl run tester$i --image=busybox:1.37 --restart=Never --rm -i -- wget -qO- http://shop/health > /dev/null; done
kubectl get pods -l app=shop
kubectl logs -l app=shop --prefix --tail=2
```

`--prefix` puts the pod name on each log line, so you can see which pods handled the requests. The load balancing is by connection, not by request, so a long-lived connection stays on one pod.

## Reaching it from your computer

A ClusterIP isn't reachable from outside the cluster. `port-forward` tunnels a local port to a Service or pod:

```bash
kubectl port-forward service/shop 8080:80
# Forwarding from 127.0.0.1:8080 -> 3000
# in another terminal: curl -s localhost:8080/health   (prints ok)
# Ctrl+C stops the tunnel
```

For development this is enough. For real traffic, three types of Service exist:

| Type | Reachable from |
|---|---|
| `ClusterIP` (default) | inside the cluster only |
| `NodePort` | every node's IP on a port from 30000 to 32767 |
| `LoadBalancer` | an external load balancer that the cloud provider creates (Part 7 uses one) |

An **Ingress** (or the newer Gateway API) sits in front of several Services and routes by host name and path: `shop.example.com` to the shop, `api.example.com` to the API.

## Try it on your own computer

- On Docker Desktop, `kubectl port-forward` works the same way; kind also supports `extraPortMappings` in its configuration file, to publish a NodePort on your computer.
- `kubectl get endpoints shop` (the older API, still printed) lists the same addresses.
- Each Service also gets an environment variable in its pods (`SHOP_SERVICE_HOST`, `SHOP_SERVICE_PORT`), a legacy way to find it that DNS has replaced.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Expose a Deployment | kubectl expose deployment NAME --name=SVC --port=80 --target-port=3000 | creates a Service | kubectl delete service SVC |
| List services | kubectl get services (svc) | nothing | — |
| See endpoints | kubectl get endpointslices -l kubernetes.io/service-name=SVC | nothing | — |
| Test from inside the cluster | kubectl run tester --image=busybox:1.37 --restart=Never --rm -i -- wget -qO- http://SVC | runs and removes a pod | — |
| Tunnel to your computer | kubectl port-forward service/SVC 8080:80 | forwards until stopped | Ctrl+C |
| Logs of all matching pods | kubectl logs -l app=NAME --prefix | nothing | — |

## Common mistakes

- Setting targetPort to the Service's port (80) when the container listens on 3000, so the Service forwards to a closed port.
- Expecting a ClusterIP to be reachable from your computer or the internet.
- Calling a pod's IP directly; it changes when the pod is replaced.
- A selector that matches no pods, so the Service has no endpoints and every request fails.
- Assuming one connection spreads across pods: load balancing happens per connection.

## Exercises

### 1. Give the shop a stable name

The Deployment `shop` runs three pods. Expose it as a Service named `shop-svc` on port 80, forwarding to the container's port 3000. Then check from a temporary pod that `http://shop-svc/` answers with the shop's welcome page.

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
```

</details>

Starter:

```bash
kubectl get pods -l app=shop
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a Service selects pods by label and forwards `port` to each pod's `targetPort`.
2. **Examples:** the lesson exposed `shop` on 80 → 3000.
3. **Brute force:** calling a pod's IP works only until that pod is replaced.
4. **Pattern:** **expose: name, port, target port; test by DNS name**.
5. **Plan:** expose, then test from inside the cluster.
6. **Code and test:** `service/shop-svc exposed`, and the welcome page answers.

</details>

<details>
<summary>💡 Hint 1</summary>

`kubectl expose deployment shop --name=shop-svc --port=80 --target-port=3000` creates the Service.

</details>

<details>
<summary>💡 Hint 2</summary>

`--port` is what callers use (80); `--target-port` is the container's port (3000).

</details>

<details>
<summary>💡 Hint 3</summary>

Test with `kubectl run tester --image=busybox:1.37 --restart=Never --rm -i -- wget -qO- http://shop-svc/`.

</details>

**In the sandbox:** exercise 63. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Give the shop a stable name</summary>

```bash
kubectl expose deployment shop --name=shop-svc --port=80 --target-port=3000
kubectl run tester --image=busybox:1.37 --restart=Never --rm -i -- wget -qO- http://shop-svc/
```

**Line by line**

- `expose deployment shop` selects the pods of that deployment, using their labels.
- `--name=shop-svc` names the Service (default: the deployment's name).
- `--port=80 --target-port=3000` maps the Service's port 80 to the containers' port 3000.
- `wget -qO- http://shop-svc/` resolves `shop-svc` through cluster DNS and prints the response.

**Trace:** `Welcome to the bike shop!` from one of the three pods.

**Common wrong approach:** `--target-port=80`. The shop listens on 3000, so the Service would send traffic to a closed port.

</details>

## Quick quiz

1. Why does a Service exist?
   - A) To run containers faster
   - B) To make pods run on the same node
   - C) To store configuration
   - D) Pods get new IP addresses when they're replaced, so callers need a stable name that sends traffic to whichever pods are ready

2. A pod fails its readiness check. What happens to Service traffic?
   - A) The pod is removed from the endpoints, so no traffic goes to it until it's ready again
   - B) Traffic is sent to it anyway
   - C) The pod is deleted immediately
   - D) The Service stops working for everyone

3. In expose --port=80 --target-port=3000, what is 3000?
   - A) The port the container listens on
   - B) The port on your computer
   - C) The number of pods
   - D) The Service's cluster IP

4. Which Service type makes a ClusterIP reachable from your computer during development?
   - A) ClusterIP always works from the internet
   - B) Ingress is required
   - C) None of them: kubectl port-forward tunnels a local port to it
   - D) NodePort is required

<details>
<summary>Quiz answers</summary>

1. **D) Pods get new IP addresses when they're replaced, so callers need a stable name that sends traffic to whichever pods are ready**: The selector finds pods by label; DNS gives the Service a name.
2. **A) The pod is removed from the endpoints, so no traffic goes to it until it's ready again**: Readiness decides whether a pod is in the endpoints.
3. **A) The port the container listens on**: Callers use port 80; the Service forwards to 3000 on each pod.
4. **C) None of them: kubectl port-forward tunnels a local port to it**: port-forward is a development tool; NodePort and LoadBalancer serve real traffic.

</details>

---
Previous: [Lesson 31](31-k8s-deployments.md) · Next: [Lesson 33: Configuration and secrets](33-k8s-config.md)
