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

## Every concept at a glance

Generated from the **At a glance** table at the end of each lesson. The number in brackets links to the lesson.

| Concept | Approach | Time | Space | Lesson |
|---|---|---|---|---|
| Print values | console.log(a, b, …) joins them with spaces | O(n) | O(n) | [1](lessons/01-what-is-javascript.md) |
| Comment | // to end of line, or /* … */ | — | — | [1](lessons/01-what-is-javascript.md) |
| Find an error | read the type and message, then the line | — | — | [1](lessons/01-what-is-javascript.md) |
| Declare | const by default; let if reassigned | O(1) | O(1) | [2](lessons/02-variables-and-types.md) |
| Check a type | typeof, plus === null and Array.isArray | O(1) | O(1) | [2](lessons/02-variables-and-types.md) |
| Text to number | validate the format, then Number(text) | O(n) | O(1) | [2](lessons/02-variables-and-types.md) |
| Insert values into text | `${value}` in a template literal | O(n) | O(n) | [3](lessons/03-strings.md) |
| Find text | includes, indexOf (−1 if absent) | O(n·m) | O(1) | [3](lessons/03-strings.md) |
| Words of a sentence | trim().split(/\s+/) | O(n) | O(n) | [3](lessons/03-strings.md) |
| Count characters | [...text].length | O(n) | O(n) | [3](lessons/03-strings.md) |
| Compare decimals | Math.abs(a − b) ≤ tolerance × the larger magnitude | O(1) | O(1) | [4](lessons/04-numbers.md) |
| Integer division | Math.floor(a / b) or Math.trunc(a / b) | O(1) | O(1) | [4](lessons/04-numbers.md) |
| Money | integer pence; format only for display | O(digits) | O(digits) | [4](lessons/04-numbers.md) |
| Huge whole numbers | BigInt (123n) | O(digits) | O(digits) | [4](lessons/04-numbers.md) |
| Default for missing values | value ?? fallback | O(1) | O(1) | [5](lessons/05-conditions.md) |
| Safe nested read | a?.b?.c | O(depth) | O(1) | [5](lessons/05-conditions.md) |
| Ranges | guard invalid input, then thresholds from the top | O(cases) | O(1) | [5](lessons/05-conditions.md) |
| Many exact cases | switch with return in each case | O(cases) | O(1) | [5](lessons/05-conditions.md) |
| Each value | for (const x of items) | O(n) | O(1) | [6](lessons/06-loops.md) |
| Each index | for (let i = 0; i < n; i++) | O(n) | O(1) | [6](lessons/06-loops.md) |
| Unknown number of steps | while (condition) with progress in the body | O(steps) | O(1) | [6](lessons/06-loops.md) |
| Object keys | for (const key in obj), or Object.entries | O(keys) | O(1) | [6](lessons/06-loops.md) |
| Short function | const f = (x) => expression | O(1) | O(1) | [7](lessons/07-functions.md) |
| Any number of arguments | function f(...args) | O(n) | O(n) | [7](lessons/07-functions.md) |
| Array as arguments | f(...array) | O(n) | O(n) | [7](lessons/07-functions.md) |
| Pass behaviour in | callback parameter, called as fn(value) | O(1) per call | O(1) | [7](lessons/07-functions.md) |
| Private state | variables inside a factory, returned function uses them | O(1) | O(state) | [8](lessons/08-scope-and-closures.md) |
| Run once | flag + saved result in a closure | O(1) | O(1) | [8](lessons/08-scope-and-closures.md) |
| Memoize | Map cache in a closure | O(1) per repeat | O(distinct inputs) | [8](lessons/08-scope-and-closures.md) |
| Add or remove at the end | push / pop | O(1) | O(1) | [9](lessons/09-arrays.md) |
| Add or remove at the start | unshift / shift | O(n) | O(1) | [9](lessons/09-arrays.md) |
| Copy | [...arr] or arr.slice() | O(n) | O(n) | [9](lessons/09-arrays.md) |
| Rotate | normalise k with modulo; join two slices | O(n) | O(n) | [9](lessons/09-arrays.md) |
| Chunk | step by size; slice each piece | O(n) | O(n) | [9](lessons/09-arrays.md) |
| Transform each | arr.map(fn) | O(n) | O(n) | [10](lessons/10-array-methods.md) |
| Keep matching | arr.filter(fn) | O(n) | O(n) | [10](lessons/10-array-methods.md) |
| Combine all | arr.reduce(fn, start) | O(n) | O(1) plus the result | [10](lessons/10-array-methods.md) |
| Sort | toSorted((a, b) => …) | O(n log n) | O(n) | [10](lessons/10-array-methods.md) |
| Top n by count | count in an object or Map; sort entries; slice | O(n + k log k) | O(k) | [10](lessons/10-array-methods.md) |
| Read by variable name | obj[key] | O(1) | O(1) | [11](lessons/11-objects.md) |
| Loop over pairs | for (const [k, v] of Object.entries(obj)) | O(n) | O(n) | [11](lessons/11-objects.md) |
| Transform an object | Object.fromEntries(Object.entries(obj).map(…)) | O(n) | O(n) | [11](lessons/11-objects.md) |
| Deep copy | structuredClone(obj) | O(size) | O(size) | [11](lessons/11-objects.md) |
| Safe nested read | walk the path; stop at null or undefined | O(depth) | O(1) | [11](lessons/11-objects.md) |
| Unpack by name | const { a, b: renamed, c = 1 } = obj | O(k) | O(k) | [12](lessons/12-destructuring-and-spread.md) |
| Merge with overrides | { ...defaults, ...overrides } | O(n) | O(n) | [12](lessons/12-destructuring-and-spread.md) |
| Update one item | { ...state, items: items.map(i => i.id === id ? { ...i, ...changes } : i) } | O(n) | O(n) | [12](lessons/12-destructuring-and-spread.md) |
| Named options | function f(x, { opt = 1 } = {}) | O(1) | O(1) | [12](lessons/12-destructuring-and-spread.md) |
| Count occurrences | map.set(k, (map.get(k) ?? 0) + 1) | O(n) | O(distinct) | [13](lessons/13-map-and-set.md) |
| Remove duplicates | [...new Set(items)] | O(n) | O(n) | [13](lessons/13-map-and-set.md) |
| Seen before? | set.has(x) | O(1) average | O(n) | [13](lessons/13-map-and-set.md) |
| Compare lists | new Set(a).intersection(new Set(b)) | O(n + m) | O(n + m) | [13](lessons/13-map-and-set.md) |
| Value to text | JSON.stringify(value, null, 2) | O(size) | O(size) | [14](lessons/14-json.md) |
| Text to value | JSON.parse(text, reviver) inside try / catch | O(size) | O(size) | [14](lessons/14-json.md) |
| Never throw | return { ok, value } or { ok, error } | O(size) | O(size) | [14](lessons/14-json.md) |
| Check the shape | type checks per field; collect problems | O(fields) | O(problems) | [14](lessons/14-json.md) |
| Store a moment | ISO 8601 UTC string or timestamp | O(1) | O(1) | [15](lessons/15-dates-and-time.md) |
| Show a moment | Intl.DateTimeFormat(locale, { timeZone }) | O(1) | O(1) | [15](lessons/15-dates-and-time.md) |
| Days between dates | UTC timestamps ÷ 86,400,000, or PlainDate.until | O(1) | O(1) | [15](lessons/15-dates-and-time.md) |
| Add months safely | Temporal.PlainDate add({ months }) | O(1) | O(1) | [15](lessons/15-dates-and-time.md) |
| Protect state | #private fields + validated methods + getters | O(1) | O(1) | [16](lessons/16-classes.md) |
| Share behaviour | base class method calling an overridden method | O(1) | O(1) | [16](lessons/16-classes.md) |
| Keep this in callbacks | arrow-function fields or .bind(this) | O(1) | O(1) | [16](lessons/16-classes.md) |
| Share code | export from one module; import in another | O(1) | O(1) | [17](lessons/17-modules.md) |
| Load on demand | await import("./big.js") | O(module size) | O(module size) | [17](lessons/17-modules.md) |
| Resolve a relative path | folder parts as a stack; .. pops | O(path length) | O(depth) | [17](lessons/17-modules.md) |
| Handle a failure | try { … } catch (e) { if (expected) … else throw e } | O(1) | O(1) | [18](lessons/18-errors.md) |
| Name a failure | class MyError extends Error { constructor(…) { super(msg) } } | O(1) | O(1) | [18](lessons/18-errors.md) |
| Fallbacks | try each option; collect errors; AggregateError if all fail | O(options) | O(options) | [18](lessons/18-errors.md) |
| Custom iteration | [Symbol.iterator]() returning { next } | O(1) per step | O(1) | [19](lessons/19-iterators-and-generators.md) |
| Lazy sequence | function* with a loop and yield | O(1) per value | O(1) | [19](lessons/19-iterators-and-generators.md) |
| First n of a pipeline | iter.filter(…).map(…).take(n).toArray() | O(items examined) | O(n) | [19](lessons/19-iterators-and-generators.md) |
| Does it match? | /pattern/.test(text) | O(n) typically | O(1) | [20](lessons/20-regular-expressions.md) |
| All matches with groups | text.matchAll(/(?<name>…)/g) | O(n) typically | O(matches) | [20](lessons/20-regular-expressions.md) |
| Replace with logic | text.replace(/…/g, (m, …groups) => …) | O(n) | O(n) | [20](lessons/20-regular-expressions.md) |
| Search for user text | new RegExp(RegExp.escape(term), "gi") | O(n) | O(term) | [20](lessons/20-regular-expressions.md) |
