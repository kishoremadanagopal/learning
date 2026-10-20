# Lesson 29: Kafka in your services

**You'll learn:** Node.js clients in 2026 (@confluentinc/kafka-javascript, KafkaJS, @platformatic/kafka), npm install and the package's prebuilt librdkafka, the KafkaJS-compatible API (KafkaJS.Kafka, kafkaJS settings), producer.connect, send and disconnect, delivery reports, the client's log objects, murmur2 for keys and random partitions without, publishing order events from the shop's API, the billing worker (consumer, subscribe, run, eachMessage), graceful shutdown on SIGTERM and session.timeout.ms, Kafka in Docker Compose with health checks, creating topics explicitly and auto.create.topics.enable, listeners, advertised listeners and the listener security protocol map, internal and external listeners, the "bootstrap works but sending fails" mistake, message.timeout.ms, scaling a worker with --scale, designing events (past-tense names, keys, IDs, versions, compatible changes), schemas and Schema Registry, the dual-write problem, the outbox pattern and Debezium, Kafka Connect, Kafka Streams, Apache Flink, MirrorMaker 2, managed Kafka (Confluent Cloud, Amazon MSK, Google Cloud, Aiven, Azure Event Hubs) and Kafka-compatible systems (Redpanda, WarpStream), confluent-kafka for Python, kafka-clients for Java.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#kafka-apps)**: run every example and check your exercise answers.

## Key terms

- **Client library:** the package a program uses to talk to Kafka, such as @confluentinc/kafka-javascript.
- **Delivery report:** the producer's confirmation of where an event was written (partition and offset).
- **Listener:** a name, protocol and port a broker accepts connections on.
- **Advertised listener:** the address a broker tells clients to use for a listener; it must work from where the client runs.
- **Graceful shutdown:** closing a consumer on SIGTERM so it commits and leaves its group at once.
- **Schema registry:** a service that stores event schemas and rejects incompatible changes.
- **Dual write:** writing to a database and to Kafka as two separate steps, which can leave them inconsistent.
- **Outbox pattern:** saving events in the same database transaction as the data, then publishing them from there.
- **Change data capture (CDC):** turning a database's changes into events, as Debezium does.

The shop's API will publish an `order-placed` event for every order, and a separate billing worker will turn each event into an invoice. Neither knows about the other: they only share the topic.

## A Node.js client

Three clients are worth knowing in 2026:

| Package | What it is |
|---|---|
| `@confluentinc/kafka-javascript` (the course uses it) | Confluent's official client, built on the C library librdkafka; offers a **KafkaJS-compatible API** |
| `kafkajs` | the most popular pure-JavaScript client for years, unmaintained since 2023; many tutorials still use it, and its API carries on in Confluent's client |
| `@platformatic/kafka` | a newer pure-JavaScript client, with no native code |

Install the client in the shop:

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
npm install @confluentinc/kafka-javascript
git diff --stat
grep -A2 '"dependencies"' package.json
```

`npm install` added the package and the 25 it depends on, recorded the version range in `package.json` (`^1.11.0`: any 1.x from 1.11.0) and the exact versions in `package-lock.json`. The package includes a compiled part (librdkafka); npm downloads the right build for your system, including Alpine Linux in the shop's image.

## Producing from Node.js

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
docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1 > /dev/null 2>&1
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3 > /dev/null
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --reader-property parse.key=true --reader-property key.separator=: <<'EOF'
ada:{"id":1,"customer":"ada","items":["bell"]}
grace:{"id":2,"customer":"grace","items":["pump","lock"]}
ada:{"id":3,"customer":"ada","items":["lock"]}
linus:{"id":4,"customer":"linus","items":["bell","bell"]}
grace:{"id":5,"customer":"grace","items":["bell"]}
ada:{"id":6,"customer":"ada","items":["pump"]}
EOF
npm install @confluentinc/kafka-javascript > /dev/null
cat > send.js <<'EOF'
import kafkajs from "@confluentinc/kafka-javascript";

const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({ kafkaJS: { brokers: ["localhost:9092"], clientId: "shop" } });
const producer = kafka.producer();

await producer.connect();
const report = await producer.send({
  topic: "orders",
  messages: [{ key: "ada", value: JSON.stringify({ id: 7, customer: "ada", items: ["bell"] }) }],
});
console.log(report);
await producer.disconnect();
EOF
```

</details>

```bash
cat send.js
node send.js
```

- The package is CommonJS, so import its default export and take `KafkaJS` from it; `KafkaJS.Kafka` is the KafkaJS-style entry point.
- `kafkaJS: { brokers, clientId }` holds the KafkaJS-style settings. `brokers` are bootstrap servers: here the published port of the course's Kafka container.
- `send()` returns a **delivery report** per partition written: the partition and the offset of the first event. The client logs `Producer connected` and `Producer disconnected` as objects through its logger.
- Messages with a key go to murmur2(key) modulo the partition count, like the Java client, so `ada`'s orders join her others in partition 2. Keyless messages go to a random partition.

## The shop publishes order events

The setup for the rest of the lesson has the shop's code ready:

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
npm install @confluentinc/kafka-javascript > /dev/null
cat > events.js <<'EOF'
import kafkajs from "@confluentinc/kafka-javascript";

const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({
  kafkaJS: { brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","), clientId: "shop" },
});
const producer = kafka.producer();
let connecting = null;

// Publish an order-placed event, keyed by customer so each customer's events stay in order.
export async function publishOrder(order) {
  connecting ??= producer.connect();
  await connecting;
  await producer.send({
    topic: "orders",
    messages: [{ key: order.customer, value: JSON.stringify({ type: "order-placed", ...order }) }],
  });
}
EOF
cat > billing.js <<'EOF'
import kafkajs from "@confluentinc/kafka-javascript";
import { formatPrice } from "./prices.js";

const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({
  kafkaJS: { brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","), clientId: "billing" },
});
const consumer = kafka.consumer({ kafkaJS: { groupId: "billing", fromBeginning: true } });

await consumer.connect();
await consumer.subscribe({ topics: ["orders"] });
await consumer.run({
  eachMessage: async ({ partition, message }) => {
    const event = JSON.parse(message.value.toString());
    console.log(`Invoice for ${event.customer}: ${formatPrice(event.total)} (partition ${partition}, offset ${message.offset})`);
  },
});

process.on("SIGTERM", async () => {
  await consumer.disconnect();
  process.exit(0);
});
EOF
cat > server.js <<'EOF'
import http from "node:http";
import fs from "node:fs";
import { PRICES, total } from "./prices.js";
import { publishOrder } from "./events.js";

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
    req.on("end", async () => {
      const order = JSON.parse(body);    // a body that isn't JSON throws here
      const placed = { customer: order.customer, items: order.items, total: total(order.items) };
      const line = JSON.stringify(placed);
      fs.appendFileSync(ordersFile, line + "\n");
      try {
        await publishOrder(placed);
      } catch (err) {
        console.error(`Couldn't publish the order event: ${err.message}`);
      }
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
cat > compose.yaml <<'EOF'
services:
  kafka:
    image: apache/kafka:4.3.1
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: INTERNAL://:19092,EXTERNAL://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: INTERNAL://kafka:19092,EXTERNAL://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT,CONTROLLER:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: INTERNAL
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
    healthcheck:
      test: /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
      interval: 5s
      retries: 10
  api:
    build: .
    ports:
      - "8080:3000"
    environment:
      KAFKA_BROKERS: kafka:19092
    depends_on:
      kafka:
        condition: service_healthy
  billing:
    build: .
    command: ["node", "billing.js"]
    environment:
      KAFKA_BROKERS: kafka:19092
    depends_on:
      kafka:
        condition: service_healthy
EOF
git add . && git commit -qm "Publish order events to Kafka; add the billing worker"
```

</details>

```bash
cat events.js
```

`publishOrder()` connects once (the first call starts connecting; later calls wait for the same promise) and sends one event, keyed by customer, with a `type` so that readers know what happened. `server.js` calls it after saving each order:

```js
      try {
        await publishOrder(placed);
      } catch (err) {
        console.error(`Couldn't publish the order event: ${err.message}`);
      }
```

The billing worker is a consumer in the group `billing`:

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
npm install @confluentinc/kafka-javascript > /dev/null
cat > events.js <<'EOF'
import kafkajs from "@confluentinc/kafka-javascript";

const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({
  kafkaJS: { brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","), clientId: "shop" },
});
const producer = kafka.producer();
let connecting = null;

// Publish an order-placed event, keyed by customer so each customer's events stay in order.
export async function publishOrder(order) {
  connecting ??= producer.connect();
  await connecting;
  await producer.send({
    topic: "orders",
    messages: [{ key: order.customer, value: JSON.stringify({ type: "order-placed", ...order }) }],
  });
}
EOF
cat > billing.js <<'EOF'
import kafkajs from "@confluentinc/kafka-javascript";
import { formatPrice } from "./prices.js";

const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({
  kafkaJS: { brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","), clientId: "billing" },
});
const consumer = kafka.consumer({ kafkaJS: { groupId: "billing", fromBeginning: true } });

await consumer.connect();
await consumer.subscribe({ topics: ["orders"] });
await consumer.run({
  eachMessage: async ({ partition, message }) => {
    const event = JSON.parse(message.value.toString());
    console.log(`Invoice for ${event.customer}: ${formatPrice(event.total)} (partition ${partition}, offset ${message.offset})`);
  },
});

process.on("SIGTERM", async () => {
  await consumer.disconnect();
  process.exit(0);
});
EOF
cat > server.js <<'EOF'
import http from "node:http";
import fs from "node:fs";
import { PRICES, total } from "./prices.js";
import { publishOrder } from "./events.js";

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
    req.on("end", async () => {
      const order = JSON.parse(body);    // a body that isn't JSON throws here
      const placed = { customer: order.customer, items: order.items, total: total(order.items) };
      const line = JSON.stringify(placed);
      fs.appendFileSync(ordersFile, line + "\n");
      try {
        await publishOrder(placed);
      } catch (err) {
        console.error(`Couldn't publish the order event: ${err.message}`);
      }
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
cat > compose.yaml <<'EOF'
services:
  kafka:
    image: apache/kafka:4.3.1
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: INTERNAL://:19092,EXTERNAL://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: INTERNAL://kafka:19092,EXTERNAL://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT,CONTROLLER:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: INTERNAL
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
    healthcheck:
      test: /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
      interval: 5s
      retries: 10
  api:
    build: .
    ports:
      - "8080:3000"
    environment:
      KAFKA_BROKERS: kafka:19092
    depends_on:
      kafka:
        condition: service_healthy
  billing:
    build: .
    command: ["node", "billing.js"]
    environment:
      KAFKA_BROKERS: kafka:19092
    depends_on:
      kafka:
        condition: service_healthy
EOF
git add . && git commit -qm "Publish order events to Kafka; add the billing worker"
```

</details>

```bash
cat billing.js
```

`run()` calls `eachMessage` for every event, in order within each partition, and commits offsets automatically. A running consumer keeps the Node.js process alive, like a server. On `docker stop`, the `SIGTERM` handler disconnects cleanly: the consumer commits and leaves the group at once, instead of the group waiting for its session to time out (45 seconds) before giving its partitions to others.

## Kafka in the Compose project

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
npm install @confluentinc/kafka-javascript > /dev/null
cat > events.js <<'EOF'
import kafkajs from "@confluentinc/kafka-javascript";

const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({
  kafkaJS: { brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","), clientId: "shop" },
});
const producer = kafka.producer();
let connecting = null;

// Publish an order-placed event, keyed by customer so each customer's events stay in order.
export async function publishOrder(order) {
  connecting ??= producer.connect();
  await connecting;
  await producer.send({
    topic: "orders",
    messages: [{ key: order.customer, value: JSON.stringify({ type: "order-placed", ...order }) }],
  });
}
EOF
cat > billing.js <<'EOF'
import kafkajs from "@confluentinc/kafka-javascript";
import { formatPrice } from "./prices.js";

const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({
  kafkaJS: { brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","), clientId: "billing" },
});
const consumer = kafka.consumer({ kafkaJS: { groupId: "billing", fromBeginning: true } });

await consumer.connect();
await consumer.subscribe({ topics: ["orders"] });
await consumer.run({
  eachMessage: async ({ partition, message }) => {
    const event = JSON.parse(message.value.toString());
    console.log(`Invoice for ${event.customer}: ${formatPrice(event.total)} (partition ${partition}, offset ${message.offset})`);
  },
});

process.on("SIGTERM", async () => {
  await consumer.disconnect();
  process.exit(0);
});
EOF
cat > server.js <<'EOF'
import http from "node:http";
import fs from "node:fs";
import { PRICES, total } from "./prices.js";
import { publishOrder } from "./events.js";

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
    req.on("end", async () => {
      const order = JSON.parse(body);    // a body that isn't JSON throws here
      const placed = { customer: order.customer, items: order.items, total: total(order.items) };
      const line = JSON.stringify(placed);
      fs.appendFileSync(ordersFile, line + "\n");
      try {
        await publishOrder(placed);
      } catch (err) {
        console.error(`Couldn't publish the order event: ${err.message}`);
      }
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
cat > compose.yaml <<'EOF'
services:
  kafka:
    image: apache/kafka:4.3.1
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: INTERNAL://:19092,EXTERNAL://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: INTERNAL://kafka:19092,EXTERNAL://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT,CONTROLLER:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: INTERNAL
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
    healthcheck:
      test: /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
      interval: 5s
      retries: 10
  api:
    build: .
    ports:
      - "8080:3000"
    environment:
      KAFKA_BROKERS: kafka:19092
    depends_on:
      kafka:
        condition: service_healthy
  billing:
    build: .
    command: ["node", "billing.js"]
    environment:
      KAFKA_BROKERS: kafka:19092
    depends_on:
      kafka:
        condition: service_healthy
EOF
git add . && git commit -qm "Publish order events to Kafka; add the billing worker"
```

</details>

```bash
cat compose.yaml
```

The API and the worker are built from the same image (the worker overrides `command`), and both wait for Kafka's health check. Start Kafka, create the topic, then everything else:

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
npm install @confluentinc/kafka-javascript > /dev/null
cat > events.js <<'EOF'
import kafkajs from "@confluentinc/kafka-javascript";

const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({
  kafkaJS: { brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","), clientId: "shop" },
});
const producer = kafka.producer();
let connecting = null;

// Publish an order-placed event, keyed by customer so each customer's events stay in order.
export async function publishOrder(order) {
  connecting ??= producer.connect();
  await connecting;
  await producer.send({
    topic: "orders",
    messages: [{ key: order.customer, value: JSON.stringify({ type: "order-placed", ...order }) }],
  });
}
EOF
cat > billing.js <<'EOF'
import kafkajs from "@confluentinc/kafka-javascript";
import { formatPrice } from "./prices.js";

const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({
  kafkaJS: { brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","), clientId: "billing" },
});
const consumer = kafka.consumer({ kafkaJS: { groupId: "billing", fromBeginning: true } });

await consumer.connect();
await consumer.subscribe({ topics: ["orders"] });
await consumer.run({
  eachMessage: async ({ partition, message }) => {
    const event = JSON.parse(message.value.toString());
    console.log(`Invoice for ${event.customer}: ${formatPrice(event.total)} (partition ${partition}, offset ${message.offset})`);
  },
});

process.on("SIGTERM", async () => {
  await consumer.disconnect();
  process.exit(0);
});
EOF
cat > server.js <<'EOF'
import http from "node:http";
import fs from "node:fs";
import { PRICES, total } from "./prices.js";
import { publishOrder } from "./events.js";

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
    req.on("end", async () => {
      const order = JSON.parse(body);    // a body that isn't JSON throws here
      const placed = { customer: order.customer, items: order.items, total: total(order.items) };
      const line = JSON.stringify(placed);
      fs.appendFileSync(ordersFile, line + "\n");
      try {
        await publishOrder(placed);
      } catch (err) {
        console.error(`Couldn't publish the order event: ${err.message}`);
      }
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
cat > compose.yaml <<'EOF'
services:
  kafka:
    image: apache/kafka:4.3.1
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: INTERNAL://:19092,EXTERNAL://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: INTERNAL://kafka:19092,EXTERNAL://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT,CONTROLLER:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: INTERNAL
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
    healthcheck:
      test: /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
      interval: 5s
      retries: 10
  api:
    build: .
    ports:
      - "8080:3000"
    environment:
      KAFKA_BROKERS: kafka:19092
    depends_on:
      kafka:
        condition: service_healthy
  billing:
    build: .
    command: ["node", "billing.js"]
    environment:
      KAFKA_BROKERS: kafka:19092
    depends_on:
      kafka:
        condition: service_healthy
EOF
git add . && git commit -qm "Publish order events to Kafka; add the billing worker"
```

</details>

```bash
docker compose up -d kafka 2>&1 | tail -1
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3
docker compose up -d 2>&1 | tail -2
docker compose ps
```

Creating topics explicitly matters: with the broker's default `auto.create.topics.enable=true`, the first producer to mention a topic creates it with the broker's defaults (1 partition), and a typo silently creates a new topic. Production clusters usually turn it off (`KAFKA_AUTO_CREATE_TOPICS_ENABLE: "false"`).

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
npm install @confluentinc/kafka-javascript > /dev/null
cat > events.js <<'EOF'
import kafkajs from "@confluentinc/kafka-javascript";

const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({
  kafkaJS: { brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","), clientId: "shop" },
});
const producer = kafka.producer();
let connecting = null;

// Publish an order-placed event, keyed by customer so each customer's events stay in order.
export async function publishOrder(order) {
  connecting ??= producer.connect();
  await connecting;
  await producer.send({
    topic: "orders",
    messages: [{ key: order.customer, value: JSON.stringify({ type: "order-placed", ...order }) }],
  });
}
EOF
cat > billing.js <<'EOF'
import kafkajs from "@confluentinc/kafka-javascript";
import { formatPrice } from "./prices.js";

const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({
  kafkaJS: { brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","), clientId: "billing" },
});
const consumer = kafka.consumer({ kafkaJS: { groupId: "billing", fromBeginning: true } });

await consumer.connect();
await consumer.subscribe({ topics: ["orders"] });
await consumer.run({
  eachMessage: async ({ partition, message }) => {
    const event = JSON.parse(message.value.toString());
    console.log(`Invoice for ${event.customer}: ${formatPrice(event.total)} (partition ${partition}, offset ${message.offset})`);
  },
});

process.on("SIGTERM", async () => {
  await consumer.disconnect();
  process.exit(0);
});
EOF
cat > server.js <<'EOF'
import http from "node:http";
import fs from "node:fs";
import { PRICES, total } from "./prices.js";
import { publishOrder } from "./events.js";

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
    req.on("end", async () => {
      const order = JSON.parse(body);    // a body that isn't JSON throws here
      const placed = { customer: order.customer, items: order.items, total: total(order.items) };
      const line = JSON.stringify(placed);
      fs.appendFileSync(ordersFile, line + "\n");
      try {
        await publishOrder(placed);
      } catch (err) {
        console.error(`Couldn't publish the order event: ${err.message}`);
      }
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
cat > compose.yaml <<'EOF'
services:
  kafka:
    image: apache/kafka:4.3.1
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: INTERNAL://:19092,EXTERNAL://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: INTERNAL://kafka:19092,EXTERNAL://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT,CONTROLLER:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: INTERNAL
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
    healthcheck:
      test: /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
      interval: 5s
      retries: 10
  api:
    build: .
    ports:
      - "8080:3000"
    environment:
      KAFKA_BROKERS: kafka:19092
    depends_on:
      kafka:
        condition: service_healthy
  billing:
    build: .
    command: ["node", "billing.js"]
    environment:
      KAFKA_BROKERS: kafka:19092
    depends_on:
      kafka:
        condition: service_healthy
EOF
git add . && git commit -qm "Publish order events to Kafka; add the billing worker"
docker compose up -d kafka > /dev/null 2>&1
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3 > /dev/null
docker compose up -d > /dev/null 2>&1
```

</details>

```bash
curl -s -X POST localhost:8080/orders -d '{"customer":"ada","items":["bell","pump"]}'
curl -s -X POST localhost:8080/orders -d '{"customer":"grace","items":["lock"]}'
docker compose logs billing | grep Invoice
```

The API answered as before, and the worker invoiced both orders, independently and in its own container.

## Listeners and advertised listeners

Connecting to Kafka happens in two steps. The client contacts a **bootstrap server**, which answers with the cluster's **metadata**: every broker and the address to reach it at, its **advertised listener**. The client then connects to those advertised addresses. So each broker needs an address that works *from wherever the client runs*.

![Kafka in a Compose network with two listeners. Containers such as api and billing connect to kafka:19092 on the INTERNAL listener, which advertises kafka:19092. Your computer connects to localhost:9092 through the published port, on the EXTERNAL listener, which advertises localhost:9092. Below, the mistake: a container bootstraps from kafka:9092 on a listener that advertises localhost:9092; inside the container, localhost is the container itself, so the second connection is refused](../figures/kafka-listeners.svg)

| Listener | Listens on | Advertises | For |
|---|---|---|---|
| `INTERNAL` | `:19092` | `kafka:19092` | other containers in the network (and the brokers themselves) |
| `EXTERNAL` | `:9092` (published) | `localhost:9092` | programs on your computer |
| `CONTROLLER` | `:9093` | — | KRaft's controller traffic |

Advertising `localhost` to other containers is the classic mistake: inside a container, `localhost` is the container itself.

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
npm install @confluentinc/kafka-javascript > /dev/null
cat > events.js <<'EOF'
import kafkajs from "@confluentinc/kafka-javascript";

const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({
  kafkaJS: { brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","), clientId: "shop" },
});
const producer = kafka.producer();
let connecting = null;

// Publish an order-placed event, keyed by customer so each customer's events stay in order.
export async function publishOrder(order) {
  connecting ??= producer.connect();
  await connecting;
  await producer.send({
    topic: "orders",
    messages: [{ key: order.customer, value: JSON.stringify({ type: "order-placed", ...order }) }],
  });
}
EOF
cat > billing.js <<'EOF'
import kafkajs from "@confluentinc/kafka-javascript";
import { formatPrice } from "./prices.js";

const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({
  kafkaJS: { brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","), clientId: "billing" },
});
const consumer = kafka.consumer({ kafkaJS: { groupId: "billing", fromBeginning: true } });

await consumer.connect();
await consumer.subscribe({ topics: ["orders"] });
await consumer.run({
  eachMessage: async ({ partition, message }) => {
    const event = JSON.parse(message.value.toString());
    console.log(`Invoice for ${event.customer}: ${formatPrice(event.total)} (partition ${partition}, offset ${message.offset})`);
  },
});

process.on("SIGTERM", async () => {
  await consumer.disconnect();
  process.exit(0);
});
EOF
cat > server.js <<'EOF'
import http from "node:http";
import fs from "node:fs";
import { PRICES, total } from "./prices.js";
import { publishOrder } from "./events.js";

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
    req.on("end", async () => {
      const order = JSON.parse(body);    // a body that isn't JSON throws here
      const placed = { customer: order.customer, items: order.items, total: total(order.items) };
      const line = JSON.stringify(placed);
      fs.appendFileSync(ordersFile, line + "\n");
      try {
        await publishOrder(placed);
      } catch (err) {
        console.error(`Couldn't publish the order event: ${err.message}`);
      }
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
cat > compose.yaml <<'EOF'
services:
  kafka:
    image: apache/kafka:4.3.1
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: INTERNAL://:19092,EXTERNAL://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: INTERNAL://kafka:19092,EXTERNAL://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT,CONTROLLER:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: INTERNAL
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
    healthcheck:
      test: /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
      interval: 5s
      retries: 10
  api:
    build: .
    ports:
      - "8080:3000"
    environment:
      KAFKA_BROKERS: kafka:19092
    depends_on:
      kafka:
        condition: service_healthy
  billing:
    build: .
    command: ["node", "billing.js"]
    environment:
      KAFKA_BROKERS: kafka:19092
    depends_on:
      kafka:
        condition: service_healthy
EOF
git add . && git commit -qm "Publish order events to Kafka; add the billing worker"
cat > compose.yaml <<'EOF'
services:
  kafka:
    image: apache/kafka:4.3.1
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
    healthcheck:
      test: /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
      interval: 5s
      retries: 10
  api:
    build: .
    ports:
      - "8080:3000"
    environment:
      KAFKA_BROKERS: kafka:9092
    depends_on:
      kafka:
        condition: service_healthy
  billing:
    build: .
    command: ["node", "billing.js"]
    environment:
      KAFKA_BROKERS: kafka:9092
    depends_on:
      kafka:
        condition: service_healthy
EOF
git commit -qam "Run Kafka with one listener"
docker compose up -d kafka > /dev/null 2>&1
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3 > /dev/null
docker compose up -d > /dev/null 2>&1
```

</details>

```bash
grep -n "KAFKA_BROKERS\|ADVERTISED" compose.yaml
curl -s -X POST localhost:8080/orders -d '{"customer":"ada","items":["bell"]}'
docker compose logs api
```

The API reached Kafka through `kafka:9092` (`Producer connected`: the bootstrap worked), learned that the broker is at `localhost:9092`, and failed to connect there. The order was saved, but its event never reached Kafka. On a real system the request would also have hung: librdkafka keeps retrying a message for `message.timeout.ms`, 5 minutes by default, before giving up. The billing worker has the same problem and never joins its group.

## Scaling the worker

Run more copies of the worker and the group spreads the partitions over them:

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
npm install @confluentinc/kafka-javascript > /dev/null
cat > events.js <<'EOF'
import kafkajs from "@confluentinc/kafka-javascript";

const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({
  kafkaJS: { brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","), clientId: "shop" },
});
const producer = kafka.producer();
let connecting = null;

// Publish an order-placed event, keyed by customer so each customer's events stay in order.
export async function publishOrder(order) {
  connecting ??= producer.connect();
  await connecting;
  await producer.send({
    topic: "orders",
    messages: [{ key: order.customer, value: JSON.stringify({ type: "order-placed", ...order }) }],
  });
}
EOF
cat > billing.js <<'EOF'
import kafkajs from "@confluentinc/kafka-javascript";
import { formatPrice } from "./prices.js";

const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({
  kafkaJS: { brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","), clientId: "billing" },
});
const consumer = kafka.consumer({ kafkaJS: { groupId: "billing", fromBeginning: true } });

await consumer.connect();
await consumer.subscribe({ topics: ["orders"] });
await consumer.run({
  eachMessage: async ({ partition, message }) => {
    const event = JSON.parse(message.value.toString());
    console.log(`Invoice for ${event.customer}: ${formatPrice(event.total)} (partition ${partition}, offset ${message.offset})`);
  },
});

process.on("SIGTERM", async () => {
  await consumer.disconnect();
  process.exit(0);
});
EOF
cat > server.js <<'EOF'
import http from "node:http";
import fs from "node:fs";
import { PRICES, total } from "./prices.js";
import { publishOrder } from "./events.js";

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
    req.on("end", async () => {
      const order = JSON.parse(body);    // a body that isn't JSON throws here
      const placed = { customer: order.customer, items: order.items, total: total(order.items) };
      const line = JSON.stringify(placed);
      fs.appendFileSync(ordersFile, line + "\n");
      try {
        await publishOrder(placed);
      } catch (err) {
        console.error(`Couldn't publish the order event: ${err.message}`);
      }
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
cat > compose.yaml <<'EOF'
services:
  kafka:
    image: apache/kafka:4.3.1
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: INTERNAL://:19092,EXTERNAL://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: INTERNAL://kafka:19092,EXTERNAL://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT,CONTROLLER:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: INTERNAL
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
    healthcheck:
      test: /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
      interval: 5s
      retries: 10
  api:
    build: .
    ports:
      - "8080:3000"
    environment:
      KAFKA_BROKERS: kafka:19092
    depends_on:
      kafka:
        condition: service_healthy
  billing:
    build: .
    command: ["node", "billing.js"]
    environment:
      KAFKA_BROKERS: kafka:19092
    depends_on:
      kafka:
        condition: service_healthy
EOF
git add . && git commit -qm "Publish order events to Kafka; add the billing worker"
docker compose up -d kafka > /dev/null 2>&1
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3 > /dev/null
docker compose up -d > /dev/null 2>&1
```

</details>

```bash
docker compose up -d --scale billing=2 2>&1 | tail -1
docker compose exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server kafka:19092 --describe --group billing --members
```

The second worker joined the group, which rebalanced: one member now reads one partition, the other two. Each order is invoiced once, by whichever worker owns its partition. A later `docker compose up -d` without `--scale` goes back to one worker, and the group rebalances again.

## Designing events

| Guideline | Example |
|---|---|
| name events as facts, in the past tense | `order-placed`, `payment-failed`, not `create-invoice` |
| key by the thing whose order matters | the customer or order ID |
| include an ID, a timestamp and a version | `{"id":"…","type":"order-placed","version":1,…}` |
| carry the data readers need | the totals, not just an ID that every reader must look up |
| evolve compatibly | add optional fields; never change a field's meaning; use a new version or topic for breaking changes |

Teams that share topics usually agree on **schemas**: Avro, Protobuf or JSON Schema, stored in a **schema registry** (Confluent Schema Registry, or Apicurio). Producers register the schema; the registry rejects incompatible changes; consumers know exactly what they'll get. Confluent's client has a companion package, `@confluentinc/schemaregistry`.

## The dual-write problem

The shop writes the order to its file, then publishes the event: two writes to two systems. If the process crashes between them, or Kafka is down (as with the wrong listener), the order exists but the event doesn't, and billing never hears of it. The usual fix is the **outbox pattern**: save the event in the same database transaction as the order (an `outbox` table), and let a separate process, or **change data capture** with Debezium, publish the outbox to Kafka. Then the event is published if and only if the order was saved.

## The wider ecosystem

| Tool | What it does |
|---|---|
| **Kafka Connect** | moves data between Kafka and other systems with ready-made connectors (databases, S3, Elasticsearch…) |
| **Debezium** | change data capture: turns database changes into events, via Kafka Connect |
| **Kafka Streams** | a Java library for processing streams (filter, join, aggregate) with exactly-once |
| **Apache Flink** | a stream-processing engine for large stateful jobs, with SQL |
| **MirrorMaker 2** | copies topics between clusters |

## Kafka in the cloud

Running Kafka yourself means upgrades, disks, monitoring and rebalancing. Managed services do it for you: **Confluent Cloud**, **Amazon MSK** (including Express brokers), **Google Cloud Managed Service for Apache Kafka**, **Aiven**, and Azure Event Hubs, which speaks Kafka's protocol. Kafka-compatible alternatives such as **Redpanda** (one binary, no JVM) and **WarpStream** (stores data in object storage) work with the same clients. Part 7 covers choosing managed services.

## Try it on your own computer

- `npm install @confluentinc/kafka-javascript` needs Node.js 18 or newer; check the package's README for the Node.js versions its prebuilt binaries support before upgrading Node.js.
- Python's equivalent is `confluent-kafka` (`pip install confluent-kafka`), built on the same librdkafka; Java and Kotlin use Kafka's own client, `org.apache.kafka:kafka-clients:4.3.1`.
- On Docker Desktop, `localhost:9092` reaches the EXTERNAL listener, so `node send.js` on your computer works against the Compose project.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Install the Node.js client | npm install @confluentinc/kafka-javascript | package.json, package-lock.json, node_modules | npm uninstall @confluentinc/kafka-javascript |
| Run Kafka with the app | docker compose up -d kafka, then create topics, then docker compose up -d | starts containers | docker compose down |
| Rebuild and restart one service | docker compose up -d --build api | rebuilds the image, recreates the container | — |
| Run more workers | docker compose up -d --scale billing=2 | adds containers | docker compose up -d --scale billing=1 |
| Check a worker's group | kafka-consumer-groups.sh … --describe --group billing --members | nothing | — |

## Common mistakes

- Advertising localhost to other containers, so clients bootstrap and then can't connect.
- Changing code and restarting the container without rebuilding its image.
- Passing an object as a message value instead of a string or buffer.
- Relying on auto-created topics, which get the broker's defaults (and typos become new topics).
- Saving data and publishing its event as two writes with nothing to recover a failed publish.

## Exercises

### 1. Publish the order event

The shop's `events.js` connects a producer but doesn't send anything yet. Complete `publishOrder(order)` so it sends one event to the topic `orders`, keyed by `order.customer`, whose value is the JSON of `{ type: "order-placed", ...order }`. Then rebuild and restart the API (`docker compose up -d --build api`) and place an order for `grace` with the items `["pump"]`.

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
npm install @confluentinc/kafka-javascript > /dev/null
cat > events.js <<'EOF'
import kafkajs from "@confluentinc/kafka-javascript";

const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({
  kafkaJS: { brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","), clientId: "shop" },
});
const producer = kafka.producer();
let connecting = null;

// Publish an order-placed event, keyed by customer so each customer's events stay in order.
export async function publishOrder(order) {
  connecting ??= producer.connect();
  await connecting;
  await producer.send({
    topic: "orders",
    messages: [{ key: order.customer, value: JSON.stringify({ type: "order-placed", ...order }) }],
  });
}
EOF
cat > billing.js <<'EOF'
import kafkajs from "@confluentinc/kafka-javascript";
import { formatPrice } from "./prices.js";

const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({
  kafkaJS: { brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","), clientId: "billing" },
});
const consumer = kafka.consumer({ kafkaJS: { groupId: "billing", fromBeginning: true } });

await consumer.connect();
await consumer.subscribe({ topics: ["orders"] });
await consumer.run({
  eachMessage: async ({ partition, message }) => {
    const event = JSON.parse(message.value.toString());
    console.log(`Invoice for ${event.customer}: ${formatPrice(event.total)} (partition ${partition}, offset ${message.offset})`);
  },
});

process.on("SIGTERM", async () => {
  await consumer.disconnect();
  process.exit(0);
});
EOF
cat > server.js <<'EOF'
import http from "node:http";
import fs from "node:fs";
import { PRICES, total } from "./prices.js";
import { publishOrder } from "./events.js";

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
    req.on("end", async () => {
      const order = JSON.parse(body);    // a body that isn't JSON throws here
      const placed = { customer: order.customer, items: order.items, total: total(order.items) };
      const line = JSON.stringify(placed);
      fs.appendFileSync(ordersFile, line + "\n");
      try {
        await publishOrder(placed);
      } catch (err) {
        console.error(`Couldn't publish the order event: ${err.message}`);
      }
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
cat > compose.yaml <<'EOF'
services:
  kafka:
    image: apache/kafka:4.3.1
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: INTERNAL://:19092,EXTERNAL://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: INTERNAL://kafka:19092,EXTERNAL://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT,CONTROLLER:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: INTERNAL
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
    healthcheck:
      test: /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
      interval: 5s
      retries: 10
  api:
    build: .
    ports:
      - "8080:3000"
    environment:
      KAFKA_BROKERS: kafka:19092
    depends_on:
      kafka:
        condition: service_healthy
  billing:
    build: .
    command: ["node", "billing.js"]
    environment:
      KAFKA_BROKERS: kafka:19092
    depends_on:
      kafka:
        condition: service_healthy
EOF
git add . && git commit -qm "Publish order events to Kafka; add the billing worker"
cat > events.js <<'EOF'
import kafkajs from "@confluentinc/kafka-javascript";

const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({
  kafkaJS: { brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","), clientId: "shop" },
});
const producer = kafka.producer();
let connecting = null;

// Publish an order-placed event, keyed by customer so each customer's events stay in order.
export async function publishOrder(order) {
  connecting ??= producer.connect();
  await connecting;
  // TODO: send the event to the topic orders
}
EOF
git commit -qam "Publish order events (to do)"
docker compose up -d kafka > /dev/null 2>&1
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3 > /dev/null
docker compose up -d > /dev/null 2>&1
```

</details>

Starter:

```bash
cat events.js
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** an event is a key and a string value sent to a topic; the API calls `publishOrder` for each new order.
2. **Examples:** `send.js` sent `{ key: "ada", value: JSON.stringify(…) }` to `orders`.
3. **Brute force:** sending the order without a key would scatter a customer's events over partitions.
4. **Pattern:** **producer.send({ topic, messages: [{ key, value }] })** after `connect()`.
5. **Plan:** add the send; rebuild; POST an order; check the topic.
6. **Code and test:** `kafka-console-consumer.sh … --formatter-property print.key=true` shows `grace	{"type":"order-placed","customer":"grace","items":["pump"],"total":3000}`.

</details>

<details>
<summary>💡 Hint 1</summary>

`await producer.send({ topic: "orders", messages: [{ key: …, value: … }] })` sends a list of messages to one topic.

</details>

<details>
<summary>💡 Hint 2</summary>

The key is `order.customer`; the value must be a string: `JSON.stringify({ type: "order-placed", ...order })`.

</details>

<details>
<summary>💡 Hint 3</summary>

The container runs the image, so rebuild it after changing code: `docker compose up -d --build api`, then `curl -s -X POST localhost:8080/orders -d '{"customer":"grace","items":["pump"]}'`.

</details>

### 2. Fix the advertised listener

The shop's Compose project starts, but no order events reach Kafka: the API logs connection errors after each order. Fix `compose.yaml` so containers in the project can use Kafka, while your computer can still reach it on `localhost:9092`. Recreate the services, then place an order for `linus` with the items `["lock"]` and check the billing worker invoiced it.

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
npm install @confluentinc/kafka-javascript > /dev/null
cat > events.js <<'EOF'
import kafkajs from "@confluentinc/kafka-javascript";

const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({
  kafkaJS: { brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","), clientId: "shop" },
});
const producer = kafka.producer();
let connecting = null;

// Publish an order-placed event, keyed by customer so each customer's events stay in order.
export async function publishOrder(order) {
  connecting ??= producer.connect();
  await connecting;
  await producer.send({
    topic: "orders",
    messages: [{ key: order.customer, value: JSON.stringify({ type: "order-placed", ...order }) }],
  });
}
EOF
cat > billing.js <<'EOF'
import kafkajs from "@confluentinc/kafka-javascript";
import { formatPrice } from "./prices.js";

const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({
  kafkaJS: { brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","), clientId: "billing" },
});
const consumer = kafka.consumer({ kafkaJS: { groupId: "billing", fromBeginning: true } });

await consumer.connect();
await consumer.subscribe({ topics: ["orders"] });
await consumer.run({
  eachMessage: async ({ partition, message }) => {
    const event = JSON.parse(message.value.toString());
    console.log(`Invoice for ${event.customer}: ${formatPrice(event.total)} (partition ${partition}, offset ${message.offset})`);
  },
});

process.on("SIGTERM", async () => {
  await consumer.disconnect();
  process.exit(0);
});
EOF
cat > server.js <<'EOF'
import http from "node:http";
import fs from "node:fs";
import { PRICES, total } from "./prices.js";
import { publishOrder } from "./events.js";

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
    req.on("end", async () => {
      const order = JSON.parse(body);    // a body that isn't JSON throws here
      const placed = { customer: order.customer, items: order.items, total: total(order.items) };
      const line = JSON.stringify(placed);
      fs.appendFileSync(ordersFile, line + "\n");
      try {
        await publishOrder(placed);
      } catch (err) {
        console.error(`Couldn't publish the order event: ${err.message}`);
      }
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
cat > compose.yaml <<'EOF'
services:
  kafka:
    image: apache/kafka:4.3.1
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: INTERNAL://:19092,EXTERNAL://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: INTERNAL://kafka:19092,EXTERNAL://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT,CONTROLLER:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: INTERNAL
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
    healthcheck:
      test: /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
      interval: 5s
      retries: 10
  api:
    build: .
    ports:
      - "8080:3000"
    environment:
      KAFKA_BROKERS: kafka:19092
    depends_on:
      kafka:
        condition: service_healthy
  billing:
    build: .
    command: ["node", "billing.js"]
    environment:
      KAFKA_BROKERS: kafka:19092
    depends_on:
      kafka:
        condition: service_healthy
EOF
git add . && git commit -qm "Publish order events to Kafka; add the billing worker"
cat > compose.yaml <<'EOF'
services:
  kafka:
    image: apache/kafka:4.3.1
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
    healthcheck:
      test: /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
      interval: 5s
      retries: 10
  api:
    build: .
    ports:
      - "8080:3000"
    environment:
      KAFKA_BROKERS: kafka:9092
    depends_on:
      kafka:
        condition: service_healthy
  billing:
    build: .
    command: ["node", "billing.js"]
    environment:
      KAFKA_BROKERS: kafka:9092
    depends_on:
      kafka:
        condition: service_healthy
EOF
git commit -qam "Run Kafka with one listener"
docker compose up -d kafka > /dev/null 2>&1
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3 > /dev/null
docker compose up -d > /dev/null 2>&1
```

</details>

Starter:

```bash
grep -n "KAFKA" compose.yaml
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** bootstrap succeeds, but the advertised `localhost:9092` points each container at itself.
2. **Examples:** the lesson's working `compose.yaml` has INTERNAL (`kafka:19092`) and EXTERNAL (`localhost:9092`) listeners.
3. **Brute force:** advertising only `kafka:9092` fixes the containers but breaks programs on your computer, which can't resolve `kafka`.
4. **Pattern:** **one listener per network: internal name for containers, localhost for the host**.
5. **Plan:** listeners, advertised listeners, protocol map, inter-broker listener, client addresses; recreate; test.
6. **Code and test:** the POST answers 201 with no error in the API's logs, and billing logs `Invoice for linus: 29.00 …`.

</details>

<details>
<summary>💡 Hint 1</summary>

Containers must reach the broker at an address that works inside the network, `kafka:PORT`, and the broker must *advertise* that address on the listener they use.

</details>

<details>
<summary>💡 Hint 2</summary>

Add a second listener: `KAFKA_LISTENERS: INTERNAL://:19092,EXTERNAL://:9092,CONTROLLER://:9093` with `KAFKA_ADVERTISED_LISTENERS: INTERNAL://kafka:19092,EXTERNAL://localhost:9092`, and map both names to PLAINTEXT in `KAFKA_LISTENER_SECURITY_PROTOCOL_MAP`.

</details>

<details>
<summary>💡 Hint 3</summary>

Use `KAFKA_INTER_BROKER_LISTENER_NAME: INTERNAL`, set `KAFKA_BROKERS: kafka:19092` for api and billing, then `docker compose up -d` recreates what changed.

</details>

**In the sandbox:** exercises 57–58. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Publish the order event</summary>

```bash
cat > events.js <<'EOF'
import kafkajs from "@confluentinc/kafka-javascript";

const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({
  kafkaJS: { brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","), clientId: "shop" },
});
const producer = kafka.producer();
let connecting = null;

// Publish an order-placed event, keyed by customer so each customer's events stay in order.
export async function publishOrder(order) {
  connecting ??= producer.connect();
  await connecting;
  await producer.send({
    topic: "orders",
    messages: [{ key: order.customer, value: JSON.stringify({ type: "order-placed", ...order }) }],
  });
}
EOF
docker compose up -d --build api > /dev/null 2>&1
curl -s -X POST localhost:8080/orders -d '{"customer":"grace","items":["pump"]}'
```

**Line by line**

- `connecting ??= producer.connect()` starts connecting on the first call only; `await connecting` waits for it every time.
- `producer.send({ topic: "orders", messages: [...] })` sends one message and resolves with the delivery report once the broker has it (with `acks=all`).
- `key: order.customer` keeps each customer's events in one partition; `JSON.stringify({ type: "order-placed", ...order })` puts the type first, then the order's fields.

**Trace:** the POST returns `{"customer":"grace","items":["pump"],"total":3000}`; the billing worker logs `Invoice for grace: 30.00 (partition 0, offset 0)`.

**Common wrong approach:** passing the order object as the value. Message values must be strings or buffers; serialise them yourself.

</details>

<details>
<summary>✅ 2. Fix the advertised listener</summary>

```bash
cat > compose.yaml <<'EOF'
services:
  kafka:
    image: apache/kafka:4.3.1
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: INTERNAL://:19092,EXTERNAL://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: INTERNAL://kafka:19092,EXTERNAL://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT,CONTROLLER:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: INTERNAL
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
    healthcheck:
      test: /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
      interval: 5s
      retries: 10
  api:
    build: .
    ports:
      - "8080:3000"
    environment:
      KAFKA_BROKERS: kafka:19092
    depends_on:
      kafka:
        condition: service_healthy
  billing:
    build: .
    command: ["node", "billing.js"]
    environment:
      KAFKA_BROKERS: kafka:19092
    depends_on:
      kafka:
        condition: service_healthy
EOF
docker compose up -d > /dev/null 2>&1
curl -s -X POST localhost:8080/orders -d '{"customer":"linus","items":["lock"]}'
docker compose logs billing | grep Invoice
```

**Line by line**

- `INTERNAL://:19092` and `EXTERNAL://:9092` are two listeners on different ports; `CONTROLLER://:9093` stays for KRaft.
- `KAFKA_ADVERTISED_LISTENERS` tells clients on INTERNAL to use `kafka:19092` (the service name, resolvable in the Compose network) and clients on EXTERNAL to use `localhost:9092` (the published port).
- `KAFKA_LISTENER_SECURITY_PROTOCOL_MAP` says both custom names use PLAINTEXT; `KAFKA_INTER_BROKER_LISTENER_NAME: INTERNAL` is how brokers talk to each other.
- `KAFKA_BROKERS: kafka:19092` makes the API and worker bootstrap on the internal listener.

**Trace:** after `docker compose up -d`, Compose recreates kafka, api and billing; the order is published and invoiced.

**Common wrong approach:** only changing `KAFKA_BROKERS` to `kafka:9092`. Bootstrapping works, but the advertised address is still `localhost:9092`, so every send fails exactly as before.

</details>

## Quick quiz

1. A client bootstraps from kafka:9092 and then fails to connect to localhost:9092. What's wrong?
   - A) The broker advertises localhost:9092 on that listener, which from inside the client's container means the container itself
   - B) The broker isn't running
   - C) The client needs --from-beginning
   - D) The topic doesn't exist

2. Why does the billing worker disconnect its consumer on SIGTERM?
   - A) So the events are removed from the topic
   - B) To delete the consumer group
   - C) So it commits its offsets and leaves the group at once, letting the group rebalance immediately instead of waiting for its session to time out
   - D) Because Docker requires it

3. The shop saves an order to its database and then publishes an event; the publish fails. What pattern prevents the lost event?
   - A) Retrying the HTTP request
   - B) Publishing the event before saving the order
   - C) The outbox pattern: store the event in the same transaction as the order and publish it from there
   - D) Using acks=0

4. Which name suits an event in the orders topic?
   - A) orders
   - B) create-invoice
   - C) order-placed
   - D) processOrder

<details>
<summary>Quiz answers</summary>

1. **A) The broker advertises localhost:9092 on that listener, which from inside the client's container means the container itself**: Clients connect to the advertised listeners from the metadata; give containers a listener that advertises a name they can resolve.
2. **C) So it commits its offsets and leaves the group at once, letting the group rebalance immediately instead of waiting for its session to time out**: A clean leave is fast; a crashed member is only noticed after session.timeout.ms (45 seconds by default).
3. **C) The outbox pattern: store the event in the same transaction as the order and publish it from there**: Publishing first just moves the problem; the outbox (or change data capture) makes both happen or neither.
4. **C) order-placed**: Events are facts that happened (past tense); commands like create-invoice tell a specific service what to do.

</details>

---
Previous: [Lesson 28](28-kafka-reliability.md) · Next: [Lesson 30: Clusters, nodes and pods](30-k8s-first-cluster.md)
