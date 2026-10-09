# Lesson 24: fetch and web APIs

**You'll learn:** HTTP methods, URLs, status codes, headers and bodies, APIs, fetch and Response, response.ok, reading JSON and text, why fetch doesn't reject on HTTP errors, a getJSON helper, building URLs with URL and URLSearchParams, POST with a JSON body and Content-Type, handling API error messages, CORS, keeping secret API keys on the server, the course's practice API.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#fetch-and-apis)**: run every example and check your exercise answers.

## Key terms

- **API:** a set of URLs (endpoints) a program can call to read or change data.
- **HTTP method:** the kind of request: GET reads, POST creates, PUT or PATCH updates, DELETE removes.
- **Status code:** a number describing the result, such as 200 OK or 404 Not Found.
- **Header:** a named piece of metadata on a request or response, such as `Content-Type`.
- **`response.ok`:** true when the status is 200–299.
- **Query string:** the `?key=value&…` part of a URL.
- **CORS:** browser rules that decide whether a page may read responses from another site.

Almost every app talks to a server through an **API** (application programming interface) over **HTTP**. In JavaScript, the tool for that is `fetch`, built into browsers and Node.js.

## HTTP in one minute

A **request** has a **method**, a **URL**, **headers** and sometimes a **body**; the **response** has a **status code**, headers and a body.

| Method | Means | Example |
|---|---|---|
| `GET` | read | list products |
| `POST` | create | place an order |
| `PUT` / `PATCH` | replace / update | change an address |
| `DELETE` | remove | cancel an order |

| Status | Meaning |
|---|---|
| 200 OK, 201 Created, 204 No Content | success |
| 301, 302, 304 | redirects and "not modified" |
| 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 429 Too Many Requests | the **client** did something wrong |
| 500 Internal Server Error, 502, 503 Service Unavailable, 504 | the **server** failed |

## The practice API

In this course's sandbox, requests to `https://shop.example` are answered by a small pretend shop (after a short delay), so you can practise without a real server:

| Request | Response |
|---|---|
| `GET /api/products` (optional `?category=parts`) | the product list |
| `GET /api/products/:id` | one product, or 404 |
| `GET /api/orders` (optional `?customer=Ada`) | orders |
| `POST /api/orders` with a JSON body `{ customer, items: [{ productId, qty }] }` | 201 and the new order, or 400 / 409 with `{ error }` |
| `GET /api/slow?ms=800` | answers after that delay |
| `GET /api/flaky?key=x&fail=2` | fails with 503 the first 2 times per key, then succeeds |
| `GET /api/stream` | a text response streamed word by word |

Prices are in pence. Every other URL goes to the real internet as usual.

## GET and reading the response

```js
const res = await fetch("https://shop.example/api/products?category=tools");
console.log(res.status, res.ok, res.headers.get("content-type"));
const tools = await res.json();                  // parse the body as JSON (also a promise)
console.log(tools.map((p) => p.name));
```

`fetch` returns a promise for a **Response**. Reading the body (`json()`, `text()`, `blob()`) is a second asynchronous step, because the body may still be arriving. A body can only be read once.

## fetch doesn't reject on HTTP errors

This surprises everyone once: a 404 or 500 response is still a **successful** fetch (the server answered). `fetch` only rejects when there's no response at all (network down, DNS failure, blocked by CORS, aborted). Always check `res.ok` (true for status 200–299):

```js
const res = await fetch("https://shop.example/api/products/99");
console.log("rejected? no.", "status:", res.status, "ok:", res.ok);
if (!res.ok) {
  const { error } = await res.json();          // many APIs explain the problem in the body
  console.log("API error:", error);
}
```

A small helper keeps this in one place:

```js
async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));    // the body might not be JSON
    throw new Error(`${res.status} ${detail.error ?? res.statusText}`);
  }
  return res.json();
}
try {
  console.log((await getJSON("https://shop.example/api/products/5")).name);
  await getJSON("https://shop.example/api/products/77");
} catch (e) {
  console.log("Failed:", e.message);
}
```

## Building URLs safely

Never glue query strings together by hand: values with spaces, `&` or `#` break the URL. `URL` and `URLSearchParams` encode everything correctly:

```js
const url = new URL("/api/orders", "https://shop.example");
url.searchParams.set("customer", "Ada & Co");
url.searchParams.set("sort", "date desc");
console.log(url.href);
console.log(new URLSearchParams({ q: "tyre 29\"", page: 2 }).toString());
```

## Sending data: POST with JSON

```js
const res = await fetch("https://shop.example/api/orders", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ customer: "Bo", items: [{ productId: 1, qty: 2 }, { productId: 6, qty: 1 }] }),
});
console.log(res.status, res.headers.get("location"));
console.log(await res.json());
```

The body must be a string (or a few other formats such as `FormData` or `Blob`), so objects go through `JSON.stringify`, and the `Content-Type` header tells the server how to read it.

## CORS and API keys

- **CORS** (cross-origin resource sharing): a browser page may only read responses from **another** site if that site allows it, with `Access-Control-Allow-Origin` headers. A "CORS error" is a server configuration issue, not a bug in your `fetch` call; servers (and Node.js) aren't restricted by it.
- **Never put secret API keys in front-end code.** Anything shipped to the browser can be read by anyone. Call services that need secret keys (payment providers, LLM APIs) from your own server, which adds the key and forwards the request (Part 8).

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Read JSON | const res = await fetch(url); if (!res.ok) throw …; await res.json() | one request | O(body) |
| Send JSON | fetch(url, { method: "POST", headers, body: JSON.stringify(data) }) | one request | O(body) |
| Safe URLs | new URL(path, base) with searchParams.set | O(length) | O(length) |

## Common mistakes

- Assuming `fetch` rejects on 404 or 500 responses.
- Building query strings by joining text instead of using `URLSearchParams`.
- Sending an object as the body without `JSON.stringify`.
- Reading a response body twice.
- Putting secret API keys in browser code.

## Exercises

### 1. Fetch a product

Write `async function getProduct(id)` that fetches `https://shop.example/api/products/<id>` and returns the product object; returns `null` if the server answers **404**; and throws an `Error` with the message `"HTTP <status>"` for any other non-OK status.

Starter code:

```js
async function getProduct(id) {
  // your code here
}

console.log((await getProduct(2)).name, await getProduct(99));   // Bell null
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** three outcomes: product, "not found" as a normal value, other failures as errors.
2. **Examples:** 99 → 404 → null; a 500 would throw "HTTP 500".
3. **Brute force:** `return (await fetch(url)).json()`: returns `{ error: … }` for a 404 instead of null.
4. **Pattern:** **check the status before the body**.
5. **Plan:** fetch → 404 → null; !ok → throw; else json.
6. **Code and test:** existing ids, a missing id.

</details>

<details>
<summary>💡 Hint 1</summary>

`await fetch(url)` gives a Response; `res.status` is the code and `res.ok` is true for 200–299.

</details>

<details>
<summary>💡 Hint 2</summary>

Handle 404 first (`return null`), then any other non-OK status (`throw new Error(\`HTTP ${res.status}\`)`).

</details>

<details>
<summary>💡 Hint 3</summary>

Finally `return res.json();` (an `async` function returning a promise is fine: callers' `await` unwraps it).

</details>

### 2. Place an order

Write `async function placeOrder(customer, items)` that POSTs `{ customer, items }` as JSON to `https://shop.example/api/orders` and returns the new order's `id`. If the server responds with an error status, throw an `Error` whose message is the `error` text from the response body (for example `"Only 7 Floor pump in stock"`).

Starter code:

```js
async function placeOrder(customer, items) {
  // your code here
}

console.log(await placeOrder("Bo", [{ productId: 1, qty: 2 }]));         // 1002
try {
  await placeOrder("Bo", [{ productId: 4, qty: 50 }]);
} catch (e) {
  console.log(e.message);                                                // Only 7 Floor pump in stock
}
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** send JSON, read JSON back, turn API errors into exceptions with the server's explanation.
2. **Examples:** 50 floor pumps → 409 Conflict with `{ error: "Only 7 Floor pump in stock" }`.
3. **Brute force:** ignoring the status and returning `data.id`: returns `undefined` on errors, silently.
4. **Pattern:** **POST JSON, then check the status**.
5. **Plan:** fetch with method, header and body → parse → !ok → throw data.error → return id.
6. **Code and test:** successes, each server-side validation error.

</details>

<details>
<summary>💡 Hint 1</summary>

Pass an options object as the second argument to `fetch`: `method: "POST"`, a `Content-Type: application/json` header, and `body: JSON.stringify({ customer, items })`.

</details>

<details>
<summary>💡 Hint 2</summary>

This API returns JSON for both success and errors, so read `await res.json()` first, then check `res.ok`.

</details>

<details>
<summary>💡 Hint 3</summary>

`if (!res.ok) throw new Error(data.error);` otherwise `return data.id;`.

</details>

**In the sandbox:** exercises 47–48. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Fetch a product</summary>

```js
async function getProduct(id) {
  const res = await fetch(`https://shop.example/api/products/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

console.log((await getProduct(2)).name, await getProduct(99));
```

**Line by line**

- The template literal builds the URL from the id.
- `res.status === 404` is checked first because "doesn't exist" is an expected answer the caller can handle as `null`.
- `!res.ok` catches every other problem (400, 401, 500, 503…) and turns it into an exception, because `fetch` won't.
- `res.json()` parses the body; returning it from an `async` function means callers get the product when they `await`.

**Trace:** `getProduct(99)` → 404 → `null`. `getProduct(2)` → 200 → the Bell object.

**Common wrong approach:** `try { … } catch` around `fetch` and assuming that covers errors: a 404 or 500 never reaches the `catch`, because `fetch` resolved successfully.

</details>

<details>
<summary>✅ 2. Place an order</summary>

```js
async function placeOrder(customer, items) {
  const res = await fetch("https://shop.example/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer, items }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data.id;
}

console.log(await placeOrder("Bo", [{ productId: 1, qty: 2 }]));
try {
  await placeOrder("Bo", [{ productId: 4, qty: 50 }]);
} catch (e) {
  console.log(e.message);
}
```

**Line by line**

- `method: "POST"` and the JSON body describe the new order; `{ customer, items }` uses shorthand properties.
- The `Content-Type` header tells the server the body is JSON.
- Reading the body before checking `ok` is fine here because this API always answers with JSON; with APIs that might not, guard `json()` with a `catch`, as in the lesson's `getJSON`.
- Throwing `new Error(data.error)` passes the server's explanation straight to whoever calls `placeOrder`.

**Trace:** ("Bo", 50 pumps) → server: 409 `{ error: "Only 7 Floor pump in stock" }` → `res.ok` false → throw.

**Common wrong approach:** `body: { customer, items }` without `JSON.stringify`: `fetch` converts the object to the useless text "[object Object]", and the server rejects it.

</details>

## Quick quiz

1. fetch(url) gets a 404 response. What happens?
   - A) The promise fulfils with a Response whose ok is false
   - B) The promise rejects
   - C) fetch retries automatically

2. How should you add customer=Ada & Co to a URL's query string?
   - A) url.searchParams.set("customer", "Ada & Co")
   - B) url + "?customer=Ada & Co"
   - C) encodeURI on the whole URL

3. Why must the body of a JSON POST go through JSON.stringify?
   - A) The body must be text (or another body type), not a plain object
   - B) fetch can't send objects over HTTPS
   - C) It encrypts the data

4. Where should a secret API key live?
   - A) On your server, never in front-end code
   - B) In a const in the browser code
   - C) In a hidden HTML field

<details>
<summary>Quiz answers</summary>

1. **A) The promise fulfils with a Response whose ok is false**: fetch only rejects on network failures; check res.ok.
2. **A) url.searchParams.set("customer", "Ada & Co")**: URLSearchParams encodes special characters correctly.
3. **A) The body must be text (or another body type), not a plain object**: Also set Content-Type: application/json.
4. **A) On your server, never in front-end code**: Anything sent to the browser can be read by anyone.

</details>

---
Previous: [Lesson 23](23-async-await.md) · Next: [Lesson 25: Timeouts, retries, cancellation and streaming](25-async-patterns.md)
