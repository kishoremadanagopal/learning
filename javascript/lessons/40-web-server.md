# Lesson 40: A small web server and API

**You'll learn:** HTTP servers, node:http and createServer, web-standard Request and Response handlers, Response.json, routing on method and path, path parameters, query strings, reading JSON bodies, validating input, status codes (200, 201, 204, 400, 401, 403, 404, 405, 409, 500), frameworks (Express 5, Fastify, Hono, full-stack frameworks), middleware as handler wrappers, error handling, logging, CORS and preflight requests, configuration and secrets, running servers in production.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#web-server)**: run every example and check your exercise answers.

## Key terms

- **HTTP server:** a program that waits for HTTP requests and answers each with a response.
- **Handler:** a function that receives a request and returns a response.
- **Route:** the code that answers one method and path, like `GET /api/products/:id`.
- **Path parameter:** a variable part of a path, like the id in `/api/products/2`.
- **Status code:** a three-digit number saying how a request went: 2xx success, 4xx client error, 5xx server error.
- **Middleware:** code that wraps handlers to add shared behaviour, like logging or error handling.
- **CORS (cross-origin resource sharing):** headers that tell browsers which other sites may call an API.
- **Preflight request:** an `OPTIONS` request a browser sends to ask whether a cross-origin request is allowed.

The practice shop API you've been calling all course is a small web server. In this lesson you build one: code that waits for HTTP requests (Lesson 24) and sends back responses.

## node:http

Node.js's built-in `http` module is the lowest level:

```js
// server.js
import { createServer } from "node:http";

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(3000, () => console.log("Listening on http://localhost:3000"));
```

```bash
node server.js
curl http://localhost:3000/api/health        # {"ok":true}
```

The callback runs for every request. It's all asynchronous: one Node.js process handles thousands of connections, because waiting for the network never blocks the event loop (Lesson 21).

## Handlers with Request and Response

Most new server code uses a simpler model: a **handler** is a function that takes a standard `Request` and returns (a promise of) a `Response`: the same classes `fetch` uses. Hono, Deno (`Deno.serve`), Bun (`Bun.serve`), Cloudflare Workers and Next.js route handlers all work this way, and on Node.js an adapter connects it to `node:http`.

A handler is just a function, so you can call it directly, which is how you'll run and test servers in this sandbox:

```js
async function handle(request) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/api/hello") {
    const name = url.searchParams.get("name") ?? "world";
    return Response.json({ message: `Hello, ${name}!` });          // status 200, JSON content type
  }
  return Response.json({ error: "Not found" }, { status: 404 });
}

const res = await handle(new Request("http://localhost/api/hello?name=Ada"));
console.log(res.status, res.headers.get("content-type"), await res.json());

const missing = await handle(new Request("http://localhost/nope"));
console.log(missing.status, await missing.json());
```

`Response.json(body, init)` creates a JSON response with the right `Content-Type`; `init` sets the `status` and extra `headers`.

## Routing and request bodies

A **router** picks the code for each method and path. Path parameters, like the `2` in `/api/products/2`, come from the URL:

```js
const products = [{ id: 1, name: "Inner tube", price: 600 }, { id: 2, name: "Bell", price: 800 }];

async function handle(request) {
  const { pathname } = new URL(request.url);
  const match = /^\/api\/products\/(\d+)$/.exec(pathname);

  if (match && request.method === "GET") {
    const product = products.find((p) => p.id === Number(match[1]));
    return product ? Response.json(product) : Response.json({ error: "Product not found" }, { status: 404 });
  }
  if (pathname === "/api/products" && request.method === "POST") {
    let body;
    try {
      body = await request.json();                          // the request's JSON body
    } catch {
      return Response.json({ error: "Body must be JSON" }, { status: 400 });
    }
    if (typeof body?.name !== "string" || !body.name.trim()) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }
    const product = { id: products.length + 1, name: body.name.trim(), price: body.price };
    products.push(product);
    return Response.json(product, { status: 201, headers: { Location: `/api/products/${product.id}` } });
  }
  return Response.json({ error: "Not found" }, { status: 404 });
}

const post = (body) => new Request("http://localhost/api/products", {
  method: "POST", headers: { "Content-Type": "application/json" }, body,
});
for (const req of [new Request("http://localhost/api/products/2"), post('{"name": "Lights", "price": 1500}'), post("not json"), post("{}")]) {
  const res = await handle(req);
  console.log(req.method, new URL(req.url).pathname, res.status, await res.json());
}
```

The status code tells the client what happened, so it can react without reading the message:

| Status | Use it for |
|---|---|
| 200 OK, 201 Created, 204 No Content | success (201 for something new, 204 for no body) |
| 400 Bad Request | invalid input: missing fields, wrong types, bad JSON |
| 401 Unauthorized / 403 Forbidden | not logged in / not allowed |
| 404 Not Found | no such thing (or route) |
| 405 Method Not Allowed | the path exists, but not with this method |
| 409 Conflict | the request conflicts with the current state (like too little stock) |
| 500 Internal Server Error | a bug or failure on the server |

**Validate everything** a client sends: the server is the only place validation can't be skipped (Lesson 29). A schema library such as Zod (Lesson 35) makes this concise.

## Frameworks

For real servers, a framework handles routing, parsing and the rough edges:

```js
// Hono: web-standard handlers, runs on Node.js, Deno, Bun and edge platforms
import { Hono } from "hono";
const app = new Hono();
app.get("/api/products/:id", (c) => {
  const product = products.find((p) => p.id === Number(c.req.param("id")));
  return product ? c.json(product) : c.json({ error: "Product not found" }, 404);
});
export default app;
```

| Framework | Known for |
|---|---|
| **Express** (version 5) | the classic Node.js framework; huge ecosystem of middleware |
| **Fastify** | speed, and validating requests with JSON Schema |
| **Hono** | small, web-standard `Request`/`Response`, runs everywhere |
| **Next.js**, **Nuxt**, **SvelteKit** | full-stack frameworks: pages and API routes together |

## Middleware

**Middleware** is code that runs around every handler: logging, authentication, error handling, CORS. With handler functions it's simply a function that takes a handler and returns a new one:

```js
const withLogging = (handler) => async (request) => {
  const response = await handler(request);
  console.log(`${request.method} ${new URL(request.url).pathname} → ${response.status}`);
  return response;
};

const hello = async () => Response.json({ hello: "world" });
const app = withLogging(hello);
await app(new Request("http://localhost/api/hello"));
await app(new Request("http://localhost/api/other", { method: "POST" }));
```

Wrapping works in layers: `withErrors(withLogging(withCors(router)))`. The exercises build two common ones.

## Configuration, secrets and running in production

- Read settings from **environment variables** (`process.env.PORT`, Lesson 36). Secrets such as database passwords and API keys live there, never in the code or the repository.
- Keys for paid services, including LLM APIs, must stay on the **server**: the browser calls your server, which adds the key and calls the service (Part 8).
- A server must not crash on bad input: catch errors, return 400 or 500, and log the details for yourself, not the client.
- In production, a platform or a container runs `node server.js` (or `node --run start`), restarts it if it crashes, and puts HTTPS in front of it. Packaging a server as a Docker container, and deploying it automatically, is part of the next course.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Answer requests | handler(Request) → Response, route on path then method | O(routes) per request | O(1) |
| Accept data | await request.json() in try/catch, validate, 400 on failure | O(body) | O(body) |
| Shared behaviour | middleware: (handler) => wrapped handler | O(layers) | O(1) |

## Common mistakes

- Returning 200 with an error message instead of the right status code.
- Trusting request bodies without validating them on the server.
- Sending internal error messages or stack traces to clients.
- Answering 404 when the path exists but the method doesn't (405).
- Allowing every origin with CORS by default.

## Exercises

### 1. A products API

Write `async function handle(request)` for a small products API, using the `products` array and the `json` helper provided. Paths are relative to any host.

- `GET /api/products` → 200 with all products; with `?maxPrice=1000`, only products costing at most that.
- `GET /api/products/<id>` → 200 with that product, or 404 `{ "error": "Product not found" }`.
- `POST /api/products` with a JSON body `{ name, price }` → 201 with the new product `{ id, name, price }` (id one more than the largest id; the name trimmed), added to `products`. Invalid JSON → 400 `{ "error": "Body must be JSON" }`; a missing or empty name, or a price that isn't a whole number of at least 0 → 400 `{ "error": "Invalid product" }`.
- A path above with any other method → 405 `{ "error": "Method not allowed" }`; any other path → 404 `{ "error": "Not found" }`.

Starter code:

```js
const products = [
  { id: 1, name: "Inner tube", price: 600 },
  { id: 2, name: "Bell", price: 800 },
  { id: 4, name: "Floor pump", price: 3200 },
];
const json = (body, status = 200) => Response.json(body, { status });

async function handle(request) {
  // your code here
}

const res = await handle(new Request("http://localhost/api/products?maxPrice=1000"));
console.log(res.status, await res.json());
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a router: method + path → the right response and status, with validation for the one write.
2. **Examples:** `POST /api/products/1` → 405 (the path exists, the method doesn't); `/api/products/abc` → 404.
3. **Brute force:** one long `if` chain mixing paths and methods: easy to get 404 where 405 is right.
4. **Pattern:** **route by path, then by method**; validate before changing anything.
5. **Plan:** parse URL → collection path (GET list/filter, POST create, else 405) → item path (GET or 405) → 404.
6. **Code and test:** the starter's request shows the filter; add your own `handle(new Request(...))` calls.

</details>

<details>
<summary>💡 Hint 1</summary>

Start with `const url = new URL(request.url);` and branch on `url.pathname` first, then on `request.method` inside each path. That makes the 405 case easy: a known path whose method matched nothing.

</details>

<details>
<summary>💡 Hint 2</summary>

Match `/api/products/<id>` with `/^\/api\/products\/(\d+)$/`; `\d+` means `/api/products/abc` falls through to the final 404. Read `?maxPrice` with `url.searchParams.get("maxPrice")` (`null` if absent).

</details>

<details>
<summary>💡 Hint 3</summary>

For POST, `await request.json()` inside `try`/`catch` (invalid JSON throws). Validate with `typeof body?.name === "string"`, `trim()`, and `Number.isInteger(body.price) && body.price >= 0`. New id: `Math.max(0, ...products.map((p) => p.id)) + 1`.

</details>

### 2. Middleware for errors and CORS

Write two middleware functions. Each takes a handler and returns a new handler.

- `withErrors(handler)`: calls the handler; if it throws (or its promise rejects), log the error with `console.error` and return a 500 response with the JSON body `{ "error": "Internal server error" }`. The client must never see the real error message.
- `withCors(handler, origin)`: for an `OPTIONS` request (a browser's **preflight** check), return 204 with no body and the headers `Access-Control-Allow-Origin: <origin>`, `Access-Control-Allow-Methods: GET, POST` and `Access-Control-Allow-Headers: Content-Type`, without calling the handler. For other requests, call the handler and return its response with `Access-Control-Allow-Origin: <origin>` added (keeping its status, body and other headers).

Starter code:

```js
function withErrors(handler) {
  // your code here
}

function withCors(handler, origin) {
  // your code here
}

const broken = async () => { throw new Error("database password is hunter2"); };
const res = await withErrors(broken)(new Request("http://localhost/api"));
console.log(res.status, await res.json());
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** wrappers that change what happens around a handler without touching the handler itself.
2. **Examples:** a handler throwing "secret details" → client sees only "Internal server error"; OPTIONS never reaches the handler.
3. **Brute force:** adding `try`/`catch` and CORS headers inside every handler: repetitive, and one forgotten handler leaks errors.
4. **Pattern:** **higher-order functions**: take a function, return a function (Lesson 7), the same shape as every middleware system.
5. **Plan:** withErrors: try await handler → catch log + 500. withCors: OPTIONS → 204 with headers; else await handler → copy → add header.
6. **Code and test:** run the starter's broken handler through `withErrors`, then try `withCors` with a few requests.

</details>

<details>
<summary>💡 Hint 1</summary>

Both return a new function: `return async (request) => { … };`. Inside `withErrors`, `return await handler(request);` inside `try`: the `await` is what makes a rejected promise land in your `catch`.

</details>

<details>
<summary>💡 Hint 2</summary>

In `catch`, `console.error(...)` the real error, then `return Response.json({ error: "Internal server error" }, { status: 500 });`.

</details>

<details>
<summary>💡 Hint 3</summary>

For CORS preflight, `new Response(null, { status: 204, headers: { … } })`. For other requests, copy the handler's response with `new Response(response.body, response)` (the copy's headers can be changed), then `copy.headers.set(...)`.

</details>

**In the sandbox:** exercises 79–80. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. A products API</summary>

```js
const products = [
  { id: 1, name: "Inner tube", price: 600 },
  { id: 2, name: "Bell", price: 800 },
  { id: 4, name: "Floor pump", price: 3200 },
];
const json = (body, status = 200) => Response.json(body, { status });

async function handle(request) {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  if (pathname === "/api/products") {
    if (method === "GET") {
      const max = url.searchParams.get("maxPrice");
      return json(max === null ? products : products.filter((p) => p.price <= Number(max)));
    }
    if (method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Body must be JSON" }, 400);
      }
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      if (!name || !Number.isInteger(body.price) || body.price < 0) return json({ error: "Invalid product" }, 400);
      const product = { id: Math.max(0, ...products.map((p) => p.id)) + 1, name, price: body.price };
      products.push(product);
      return json(product, 201);
    }
    return json({ error: "Method not allowed" }, 405);
  }

  const match = /^\/api\/products\/(\d+)$/.exec(pathname);
  if (match) {
    if (method !== "GET") return json({ error: "Method not allowed" }, 405);
    const product = products.find((p) => p.id === Number(match[1]));
    return product ? json(product) : json({ error: "Product not found" }, 404);
  }

  return json({ error: "Not found" }, 404);
}

const res = await handle(new Request("http://localhost/api/products?maxPrice=1000"));
console.log(res.status, await res.json());
```

**Line by line**

- `new URL(request.url)` splits the URL into `pathname` and `searchParams`, so query strings never confuse the routing.
- The collection path handles GET (with an optional filter, `Number(max)` converting the text) and POST; any other method gets 405.
- POST reads the body in `try`/`catch`; `body?.name` copes with a body that is `null` or not an object; `Number.isInteger` rejects strings, fractions and `NaN`.
- The new id is one more than the largest existing id (ids may have gaps, like the missing 3), and the product is only added after validation passed.
- The item route uses a regex with a captured number; other methods get 405, unknown ids 404.

**Trace:** `POST /api/products` with `{"name": "  Lights ", "price": 1500}` → JSON ok → name "Lights" → price ok → id max(1, 2, 4) + 1 = 5 → 201.

**Common wrong approach:** `id: products.length + 1`: with ids 1, 2 and 4 it creates a second product with id 4.

</details>

<details>
<summary>✅ 2. Middleware for errors and CORS</summary>

```js
function withErrors(handler) {
  return async (request) => {
    try {
      return await handler(request);
    } catch (error) {
      console.error("Request failed:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

function withCors(handler, origin) {
  return async (request) => {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }
    const response = await handler(request);
    const copy = new Response(response.body, response);
    copy.headers.set("Access-Control-Allow-Origin", origin);
    return copy;
  };
}

const broken = async () => { throw new Error("database password is hunter2"); };
const res = await withErrors(broken)(new Request("http://localhost/api"));
console.log(res.status, await res.json());
```

**Line by line**

- `return await handler(request)` inside `try` catches both a synchronous `throw` and a rejected promise; `return handler(request)` without `await` would let a rejection escape the `try`.
- The real error goes to `console.error` (your logs); the client gets a generic message, because error details can reveal secrets or internals.
- A browser sends an `OPTIONS` preflight before a cross-origin request with JSON; answering it with the allowed origin, methods and headers lets the real request proceed.
- `new Response(response.body, response)` makes a copy with the same body, status and headers, but headers you're allowed to change: headers of some responses (such as those from `fetch`) are read-only.

**Trace:** `withCors(ok, "https://shop.example")` on GET → not OPTIONS → `ok` returns 201 with `X-Total` → copy → add the CORS header → 201, body intact, both headers present.

**Common wrong approach:** `Access-Control-Allow-Origin: *` with credentials, or reflecting any `Origin` header back unchecked: CORS exists to say *which* sites may call your API, so allow only the origins you trust.

</details>

## Quick quiz

1. What does a web-standard handler take and return?
   - A) A Request, and a Response (or a promise of one)
   - B) req and res objects from node:http
   - C) A URL string and a JSON object

2. A client POSTs a product without a name. Which status fits?
   - A) 400 Bad Request
   - B) 404 Not Found
   - C) 500 Internal Server Error

3. Why should a 500 response hide the real error message?
   - A) Error details can reveal secrets or internals to anyone calling the API
   - B) Browsers can't display long messages
   - C) It's required by HTTP

4. What is middleware in a handler-based server?
   - A) A function that wraps a handler and returns a new handler, adding behaviour such as logging or error handling
   - B) A database between the server and the client
   - C) A browser extension

<details>
<summary>Quiz answers</summary>

1. **A) A Request, and a Response (or a promise of one)**: The same classes fetch uses, which is why one handler runs on many platforms.
2. **A) 400 Bad Request**: 400 means the client's input is invalid.
3. **A) Error details can reveal secrets or internals to anyone calling the API**: Log the details for yourself; return a generic message.
4. **A) A function that wraps a handler and returns a new handler, adding behaviour such as logging or error handling**: Middleware composes: withErrors(withLogging(router)).

</details>

---
Previous: [Lesson 39](39-testing.md) · Next: [Lesson 41: Interview topics: scope, closures and this](41-scope-closures-this.md)
