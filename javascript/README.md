# JavaScript, TypeScript and JSON

A hands-on course that starts from zero: 25 lessons on JavaScript (the language of the web), working with data and JSON, asynchronous code, building interactive pages, TypeScript, and Node.js tooling, ending with interview topics and a final project.

JavaScript runs every web page, and with Node.js it runs servers and tools too. JSON is how almost every API, including every LLM API, sends data. TypeScript adds types on top of JavaScript and is now the default for serious projects. Together they're essential for full-stack and AI engineers, and useful for analysts who build dashboards and automations.

## ▶ [Open the practice sandbox](https://kishoremadanagopal.github.io/learning/javascript/)

The sandbox runs your JavaScript right in your browser, in a separate thread, so even an endless loop can be stopped. Nothing to install and no sign-up.

- every lesson, with **131 examples** you can run and change
- **50 exercises** with hidden tests, each with an approach, hints and a walkthrough
- **100 quiz questions**, with explanations
- your progress and code saved in your own browser

**Before you start:** nothing. Programming experience helps but isn't needed. If you already know Python, you'll move quickly: the lessons point out where JavaScript differs.

## Course materials

| | |
|---|---|
| 📘 [Lessons](#lessons) | 25 lessons, each with key terms, examples, common mistakes, exercises, walkthroughs and a quiz |
| 📖 [Glossary](glossary.md) | every term used in the course, defined in plain English |
| 🧾 [Cheat sheet](cheatsheet.md) | the syntax and patterns on one page, and every concept at a glance |

## How to use this course

1. Read a lesson, here on GitHub or in the sandbox. Start with its **Key terms**.
2. Run the examples in the sandbox and change them to see what happens.
3. Try each exercise before opening help; press **Check** to run the hidden tests.
4. Stuck? Open **How to approach it**, then the hints one at a time, and the **walkthrough** only after a real attempt.

## Lessons

### Part 1: JavaScript Basics (Beginner)

| # | Lesson | Topics | Sandbox |
|---|---|---|---|
| 1 | [What JavaScript is](lessons/01-what-is-javascript.md) | what JavaScript is, where it runs (browsers, Node.js, Deno, Bun), runtimes and their extras, ECMAScript, TC39 and yearly editions, console.log, statements, semicolons and automatic semicolon insertion, comments, JavaScript compared with Python, how the sandbox runs code, reading error messages | 1–2 |
| 2 | [Variables and types](lessons/02-variables-and-types.md) | let and const, why not var, naming rules and camelCase, primitive types and objects, typeof and its quirks, Array.isArray, dynamic typing, converting with Number, String, Boolean, parseInt and parseFloat, NaN and Number.isNaN, implicit conversion, undefined versus null, strict mode | 3–4 |
| 3 | [Strings and template literals](lessons/03-strings.md) | single, double and backtick quotes, template literals and ${…}, multi-line strings, escape sequences, length, indexes and at(), immutability, trim, case, includes, startsWith, endsWith, indexOf, slice, replace and replaceAll, padStart, repeat, split and join, comparing strings, UTF-16 and emoji length | 5–6 |
| 4 | [Numbers and maths](lessons/04-numbers.md) | the number type and floating point, arithmetic operators and precedence, compound assignment and ++, remainder and integer division, 0.1 + 0.2, comparing with a tolerance, Math functions, rounding, toFixed, Number.isInteger, MAX_SAFE_INTEGER and BigInt, Infinity and NaN, money in whole cents, Intl.NumberFormat | 7–8 |
| 5 | [Comparisons and conditions](lessons/05-conditions.md) | comparison operators, strict and loose equality, comparing objects by identity, truthy and falsy values, logical operators and short-circuiting, defaults with \|\| and ??, nullish assignment ??=, optional chaining ?., if / else if / else, the conditional (ternary) operator, switch and fall-through | 9–10 |
| 6 | [Loops](lessons/06-loops.md) | for…of over arrays and strings, the classic for loop, while and do…while, break and continue, for…in over object keys, accumulators, running maximums, nested loops, off-by-one errors, endless loops and how to avoid them | 11–12 |
| 7 | [Functions](lessons/07-functions.md) | function declarations, function expressions, arrow functions and implicit return, parameters and arguments, return and undefined, default parameters, rest parameters and spread, hoisting, functions as values, callbacks, higher-order functions, throwing errors for bad input, writing small single-purpose functions | 13–14 |
| 8 | [Scope and closures](lessons/08-scope-and-closures.md) | lexical scope, global, function and block scope, the scope chain, shadowing, var versus let and const, hoisting and the temporal dead zone, closures, private state, function factories, counters, once and memoize, the loop-closure bug | 15–16 |

### Part 2: Working with Data (Beginner)

| # | Lesson | Topics | Sandbox |
|---|---|---|---|
| 9 | [Arrays](lessons/09-arrays.md) | creating arrays, length, indexes and at(), push, pop, shift, unshift and splice, includes, indexOf and lastIndexOf, methods that change an array versus ones that return a new one, toSorted, toReversed, toSpliced and with, arrays as references, copying with spread, slice, concat, Array.from, fill, flat, nested arrays | 17–18 |
| 10 | [Array methods: map, filter, reduce and friends](lessons/10-array-methods.md) | callbacks on arrays, map, filter, find, findIndex and findLast, some and every, reduce and accumulators, sorting with a comparator, why the default sort compares text, localeCompare, stable sorting and tie-breakers, forEach, flat and flatMap, Object.groupBy and Map.groupBy, chaining methods into pipelines | 19–20 |
| 11 | [Objects](lessons/11-objects.md) | object literals, properties, dot and bracket access, adding, changing and deleting properties, shorthand properties, computed keys, methods and this, in and Object.hasOwn, Object.keys, values, entries and fromEntries, key order, nested objects, references, shallow and deep copies, structuredClone, comparing objects, Object.freeze | 21–22 |
| 12 | [Destructuring and spread](lessons/12-destructuring-and-spread.md) | array destructuring, skipping and defaults, rest elements, swapping variables, object destructuring, renaming, nested destructuring, rest properties, destructuring parameters and options objects, spread for arrays and objects, merging with later spreads winning, immutable updates of nested data | 23–24 |
| 13 | [Map and Set](lessons/13-map-and-set.md) | Map and its methods, Map versus plain objects, any key type, size and order, getOrInsert, counting and grouping with a Map, Map.groupBy, Set and its methods, removing duplicates, fast membership tests, union, intersection, difference, symmetricDifference, isSubsetOf and isDisjointFrom, WeakMap and WeakSet | 25–26 |
| 14 | [JSON](lessons/14-json.md) | what JSON is and where it's used, JSON syntax rules versus JavaScript objects, JSON.parse and JSON.stringify, pretty-printing, values that don't survive (undefined, functions, Date, Map, Set, NaN), replacers and revivers, invalid JSON and SyntaxError, try and catch, very large numbers, context.source and JSON.rawJSON, validating the shape of parsed data, schema libraries such as Zod | 27–28 |
| 15 | [Dates and times](lessons/15-dates-and-time.md) | timestamps and the Unix epoch, the Date object, zero-based months, mutation, local time versus UTC, unreliable parsing, overflow, ISO 8601, Intl.DateTimeFormat and Intl.RelativeTimeFormat, the Temporal API, PlainDate, PlainTime, PlainDateTime, ZonedDateTime, Instant and Duration, calendar arithmetic, time zones and daylight saving, browser support and polyfills | 29–30 |

### Part 3: Modern JavaScript (Intermediate)

| # | Lesson | Topics | Sandbox |
|---|---|---|---|
| 16 | [Classes and this](lessons/16-classes.md) | classes and instances, constructors, methods, public fields, private fields with #, getters and setters, static members, chaining by returning this, inheritance with extends and super, overriding methods, instanceof, composition versus inheritance, how this is decided, losing this in callbacks, arrow functions and bind, prototypes and the prototype chain | 31–32 |
| 17 | [Modules: import and export](lessons/17-modules.md) | why programs are split into modules, ES modules, named and default exports, import syntax, renaming and namespace imports, module scope, strict mode and running once, live read-only bindings, relative, absolute and package specifiers, file extensions, modules in the browser, ESM versus CommonJS in Node.js, dynamic import() and code splitting, circular imports, side effects on import | 33–34 |
| 18 | [Errors and error handling](lessons/18-errors.md) | throwing and the call stack, built-in error types, throw, try, catch and finally, catching only what you can handle and rethrowing, custom error classes with extra fields, error causes, errors as values, AggregateError, Error.isError, validating input, logging errors safely | 35–36 |
| 19 | [Iterators and generators](lessons/19-iterators-and-generators.md) | the iteration protocol, Symbol.iterator, iterators and next(), making classes iterable, generator functions and yield, pausing and lazy evaluation, infinite sequences, iterator helpers (map, filter, take, drop, flatMap, reduce, toArray), Iterator.from, when laziness pays off, async generators | 37–38 |
| 20 | [Regular expressions](lessons/20-regular-expressions.md) | regex literals and the RegExp constructor, literal characters, character classes, quantifiers, anchors and word boundaries, alternation, flags (g, i, m, s, u, v, y, d), test, match, matchAll, replace and split, capturing, named and non-capturing groups, replacement strings and functions, greedy versus lazy quantifiers, lookahead and lookbehind, Unicode property escapes, RegExp.escape, catastrophic backtracking, when to use a parser instead | 39–40 |

### Part 4: Asynchronous JavaScript (Intermediate)

| # | Lesson | Topics | Sandbox |
|---|---|---|---|
| 21 | [The event loop](lessons/21-event-loop.md) | single-threaded JavaScript, synchronous and asynchronous code, the call stack, the runtime's timers and I/O, the task (macrotask) queue, the microtask queue, why setTimeout(fn, 0) isn't immediate, blocking the main thread, Web Workers, callbacks and callback hell, debouncing and throttling | 41–42 |
| 22 | [Promises](lessons/22-promises.md) | promise states, fulfilling and rejecting, then, catch and finally, chaining and returning values, error propagation, unhandled rejections, new Promise and promisifying callbacks, Promise.withResolvers, Promise.resolve and reject, Promise.all, allSettled, race and any, writing Promise.all yourself | 43–44 |
| 23 | [async and await](lessons/23-async-await.md) | async functions and their promises, await, error handling with try / catch / finally, sequential versus parallel awaits, Promise.all with map, await in loops and why not forEach, top-level await, async iterables, for await, async generators, Array.fromAsync, common async mistakes | 45–46 |
| 24 | [fetch and web APIs](lessons/24-fetch-and-apis.md) | HTTP methods, URLs, status codes, headers and bodies, APIs, fetch and Response, response.ok, reading JSON and text, why fetch doesn't reject on HTTP errors, a getJSON helper, building URLs with URL and URLSearchParams, POST with a JSON body and Content-Type, handling API error messages, CORS, keeping secret API keys on the server, the course's practice API | 47–48 |
| 25 | [Timeouts, retries, cancellation and streaming](lessons/25-async-patterns.md) | timeouts with Promise.race, cleaning up timers, cancellation with AbortController and AbortSignal, AbortSignal.timeout and AbortSignal.any, retries with exponential backoff and jitter, which errors to retry, idempotency and idempotency keys, limiting concurrency, reading streamed responses with readers and TextDecoderStream, server-sent events and LLM streaming | 49–50 |

## Running it on your own computer

Every example also runs in [Node.js](https://nodejs.org) 26 or newer (`node file.js`) or in your browser's developer console. A few lessons use the newest JavaScript features; they say so, and which browsers support them.

## Editing the course

Lessons are generated from the Markdown sources in [`course/`](course/). See [course/README.md](course/README.md).
