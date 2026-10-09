# JavaScript, TypeScript and JSON cheat sheet

The syntax and patterns of the course on one page. The number in brackets is the lesson. The table of every concept with its approach and cost is at the end.

## JavaScript basics [1–8]

```js
const name = "Ada";          // can't be reassigned (use by default)
let count = 0;               // can be reassigned
console.log("Hi", name);     // prints: Hi Ada
// comment    /* block comment */
```

| Check | Use |
|---|---|
| type of a value | `typeof x` (but `typeof null` is `"object"`) |
| null | `x === null` |
| array | `Array.isArray(x)` |
| NaN | `Number.isNaN(x)` |
| text → number | validate, then `Number(text)`; `parseInt` / `parseFloat` read a leading number |

### Strings and numbers [3–4]

```js
`${qty} × ${item}`             // template literal
s.trim()  s.toLowerCase()  s.includes("x")  s.slice(0, 5)  s.at(-1)
s.split(",")  arr.join(", ")  s.replaceAll("-", " ")  "7".padStart(3, "0")
0.1 + 0.2 === 0.3              // false: compare with a tolerance
Math.round(x * 100) / 100      // round to 2 places (a number); x.toFixed(2) gives a string
Math.floor(a / b)  a % b       // integer division and remainder
```

### Conditions and loops [5–6]

| Write | Not |
|---|---|
| `a === b`, `a !== b` | `a == b` |
| `value ?? fallback` (only null/undefined) | `value \|\| fallback` when 0 or "" are valid |
| `obj?.a?.b` | `obj.a.b` on data that may be missing |
| `for (const x of items)` | `for (const i in items)` on arrays |

Falsy values: `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN`. Everything else is truthy.

### Functions and closures [7–8]

```js
function add(a, b = 0) { return a + b; }       // declaration (hoisted), default parameter
const double = (n) => n * 2;                    // arrow: returns the expression
const sum = (...nums) => { let t = 0; for (const n of nums) t += n; return t; };
sum(...[1, 2, 3]);                              // spread an array into arguments
function makeCounter() { let c = 0; return () => ++c; }   // closure: private state
```

## Working with data [9–15]

### Arrays [9–10]

| Changes the array | Returns a new one |
|---|---|
| `push` `pop` `shift` `unshift` `splice` | `slice` `concat` `[...arr]` |
| `sort` `reverse` | `toSorted` `toReversed` `toSpliced` `with` |

```js
items.map((x) => x * 2)                       // transform
items.filter((x) => x.paid)                   // keep some
items.find((x) => x.id === 7)                 // first match or undefined
items.some(fn)  items.every(fn)  items.includes(v)
items.reduce((acc, x) => acc + x.total, 0)    // always give a start value
nums.toSorted((a, b) => a - b)                // numbers need a comparator
names.toSorted((a, b) => a.localeCompare(b))
Object.groupBy(items, (x) => x.category)
```

### Objects, destructuring and spread [11–12]

```js
obj[key]  Object.hasOwn(obj, "k")  Object.entries(obj)  Object.fromEntries(pairs)
const copy = { ...obj }                       // shallow
const deep = structuredClone(obj)             // deep
const { name, age = 0, address: { city } = {} } = user
const [first, ...rest] = list
const settings = { ...defaults, ...overrides }   // later wins
function f(x, { currency = "GBP" } = {}) { … }   // options object
```

### Map, Set, JSON and dates [13–15]

```js
const m = new Map();  m.set(k, v);  m.get(k);  m.getOrInsert(k, []);  m.size
const unique = [...new Set(items)];  a.union(b)  a.intersection(b)  a.difference(b)
JSON.parse(text)        // throws SyntaxError on bad input: use try / catch
JSON.stringify(value, null, 2)
new Date(Date.UTC(2026, 9, 8)).toISOString()     // months start at 0!
Temporal.PlainDate.from("2026-10-08").add({ days: 30 })   // not in Safari yet
new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "Europe/London" }).format(d)
```

JSON drops `undefined` and functions, turns Dates into strings and Maps/Sets into `{}`, and loses precision on integers above 2⁵³.

## Modern JavaScript [16–20]

```js
class Account {
  #balance = 0;                       // private field
  static count = 0;                   // belongs to the class
  constructor(owner) { this.owner = owner; }
  get balance() { return this.#balance; }
  deposit(n) { this.#balance += n; return this; }   // return this to chain
}
class Savings extends Account { constructor(o) { super(o); } }
const handler = obj.method.bind(obj);              // keep this in a callback

export const VAT = 0.2;  export default class Basket {}
import Basket, { VAT as rate } from "./prices.js";
const mod = await import("./big.js");              // load on demand

try { risky(); } catch (e) { if (e instanceof SyntaxError) { … } else throw e; } finally { cleanUp(); }
class ValidationError extends Error { constructor(field, msg) { super(msg); this.name = "ValidationError"; this.field = field; } }
throw new Error("Couldn't save", { cause: err });

function* range(a, b) { for (let i = a; i < b; i++) yield i; }
naturals().filter(isOdd).map(square).take(3).toArray()   // lazy iterator helpers

/(?<year>\d{4})-(?<month>\d{2})/.exec(text).groups
text.replace(/\s+/g, " ")   text.matchAll(/…/g)   new RegExp(RegExp.escape(term), "gi")
```

| Regex | Meaning |
|---|---|
| `\d \w \s` / `\D \W \S` | digit, word character, whitespace / not |
| `[abc] [^abc] [a-z]` | one of, none of, range |
| `* + ? {n,m}` | quantifiers (add `?` for lazy) |
| `^ $ \b` | start, end, word boundary |
| `(?<name>…) (?:…)` | named group, non-capturing group |
| `(?=…) (?!…) (?<=…) (?<!…)` | lookahead / lookbehind |
| flags `g i m s u v` | all, ignore case, multi-line, dot matches newline, Unicode |

## Asynchronous JavaScript [21–25]

Order of execution: **synchronous code → all microtasks (promise callbacks) → one task (timer, event) → repeat**.

```js
const delay = (ms, v) => new Promise((resolve) => setTimeout(() => resolve(v), ms));
p.then((v) => next(v)).catch((e) => handle(e)).finally(cleanUp);   // return inside then!

async function load(id) {
  const res = await fetch(`https://shop.example/api/products/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);    // fetch doesn't reject on 404/500
  return res.json();
}
const [a, b] = await Promise.all([load(1), load(2)]);    // parallel
for (const id of ids) await load(id);                    // sequential (never await in forEach)

await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
  signal: AbortSignal.timeout(5000),                     // cancel after 5 s
});
const url = new URL("/api/orders", base); url.searchParams.set("customer", name);
```

| Combinator | Resolves | Rejects |
|---|---|---|
| `Promise.all` | all fulfil (values in order) | the first rejection |
| `Promise.allSettled` | all settle (status per item) | never |
| `Promise.race` | the first to settle | the first to settle |
| `Promise.any` | the first to fulfil | all reject (AggregateError) |

Retry temporary failures (network, timeouts, 429, 5xx) with exponential backoff and jitter; don't retry 4xx errors or non-idempotent requests.

## JavaScript in the browser [26–30]

Put scripts at the end of `<body>`, or in `<head>` with `defer` or `type="module"`, so the elements they use exist.

```js
const cart = document.querySelector("#cart");            // first match or null
const items = [...document.querySelectorAll(".item")];   // every match, as an array
item.dataset.id                                          // data-id="4" → "4" (a string)
button.closest("li")                                     // nearest ancestor that matches

el.textContent = userData;                               // safe; innerHTML only for HTML you wrote
const li = document.createElement("li");
list.replaceChildren(...newItems);                       // replace a list in one update
el.classList.toggle("selected", isSelected);
button.disabled = true;   el.hidden = false;             // boolean properties, not setAttribute
template.content.firstElementChild.cloneNode(true)

list.addEventListener("click", (e) => {                  // event delegation
  const button = e.target.closest("button.add");
  if (!button) return;
  add(Number(button.closest("li").dataset.id));
});
el.addEventListener("keydown", handler, { signal: controller.signal });   // controller.abort() removes it

form.addEventListener("submit", async (e) => {
  e.preventDefault();                                    // no page reload
  const data = Object.fromEntries(new FormData(form));   // every value is a string
  const qty = form.elements.qty.valueAsNumber;
});
```

| Event | When |
|---|---|
| `click` | button activated (mouse, tap, Enter or Space) |
| `input` / `change` | every edit / value committed |
| `keydown` | key pressed: check `e.key` |
| `submit` | form submitted (button or Enter), after validation passes |
| `DOMContentLoaded` / `load` | HTML parsed / everything loaded |

Interactive pages: keep a **state** object, write one **render()** that makes the page match it, and have event handlers change the state and call render. Show loading, empty and error states; abort stale requests.
