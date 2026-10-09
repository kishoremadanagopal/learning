# JavaScript, TypeScript and JSON glossary

Every term used in the course, A to Z. The number in brackets is the lesson where it's introduced.

| Term | Meaning |
|---|---|
| **AbortController / AbortSignal** | A way to cancel operations such as `fetch` that accept a signal. [25] |
| **Abstract class** | A class that can't be created directly and may declare methods subclasses must provide. [34] |
| **Accumulator** | A variable that builds up a result as a loop runs. [6] |
| **`AggregateError`** | An error holding a list of several errors. [18] |
| **Anchor** | A position, such as `^` (start) or `$` (end), rather than a character. [20] |
| **`any`** | A type that turns checking off for a value. [31] |
| **API** | A set of URLs (endpoints) a program can call to read or change data. [24] |
| **Array** | An ordered list of values, accessed by index. [9] |
| **Arrow function** | A short function syntax, `(x) => x * 2`, which returns the expression automatically. [7] |
| **`as const`** | Makes a literal read-only with the most specific (literal) types. [33] |
| **Assertion function** | A function declared `asserts value is Type` that throws if the check fails. [35] |
| **`async` function** | A function that always returns a promise and can use `await`. [23] |
| **Async generator** | An `async function*` that yields values over time. [23] |
| **Asynchronous** | Started now and finished later, without blocking other code. [21] |
| **Async iterable** | A source of values that arrive over time, looped with `for await`. [23] |
| **Automatic semicolon insertion** | JavaScript's rule for adding missing semicolons at line ends. [1] |
| **`await`** | Pauses the current async function until a promise settles, then gives its value or throws its error. [23] |
| **BigInt** | A type for exact whole numbers of any size, written with an `n` suffix. [4] |
| **Block scope** | Names that exist only inside the nearest `{ }`, as with `let` and `const`. [8] |
| **Boolean attribute** | An attribute that's on when present, whatever its value, like `disabled` or `hidden`. [27] |
| **`break`** | Ends a loop immediately. [6] |
| **Bubbling** | An event travelling up from its target through every ancestor. [28] |
| **Bundler** | A tool that combines many modules into a few files for the browser. [17] |
| **Callback** | A function passed to another function, to be called by it. [7, 21] |
| **Call stack** | The chain of function calls currently running; errors travel up it. [18, 21] |
| **Capture phase** | The event travelling down from `window` to the target, before bubbling. [28] |
| **Capturing group** | A bracketed part of a pattern whose matched text is saved. [20] |
| **Character class** | A set of characters in brackets, such as `[a-z]`, or a shorthand such as `\d`. [20] |
| **Class** | A blueprint for creating objects with the same fields and methods. [16] |
| **`classList`** | An element's classes, with `add`, `remove`, `toggle` and `contains`. [27] |
| **`closest`** | Finds the nearest ancestor (or the element itself) matching a selector. [26] |
| **Closure** | A function bundled with the variables of the scope it was created in. [8] |
| **CommonJS** | Node.js's older module system, using `require` and `module.exports`. [17] |
| **Comparator** | A function `(a, b) => number` telling a sort which item comes first. [10] |
| **Computed key** | A key written in brackets whose name is calculated, `{ [name]: value }`. [11] |
| **Concurrency limit** | The maximum number of operations allowed to run at the same time. [25] |
| **`const`** | Declares a name that can't be reassigned. [2] |
| **Constraint** | `T extends X`: limits a type parameter to types compatible with `X`. [33] |
| **Constraint validation** | The browser's built-in checks from attributes like `required`, `min` and `pattern`. [29] |
| **Constructor** | The method that runs when an instance is created, setting up its fields. [16] |
| **`continue`** | Skips the rest of the current pass and starts the next. [6] |
| **CORS** | Browser rules that decide whether a page may read responses from another site. [24] |
| **`createElement`** | Makes a new element that isn't in the page until you insert it. [27] |
| **Cross-site scripting (XSS)** | An attack where data inserted as HTML runs the attacker's code in your page. [27] |
| **CSS selector** | A pattern that matches elements, like `#cart li.item`; used by CSS and by `querySelector`. [26] |
| **`currentTarget`** | The element whose listener is currently running. [28] |
| **Custom error** | A class extending `Error` to name a kind of failure and carry extra data. [18] |
| **`CustomEvent`** | An event your own code creates and dispatches, with data in `detail`. [28] |
| **`data-` attribute** | A custom attribute for your own data, read through `el.dataset`. [26] |
| **Debounce** | Delay an action until calls stop arriving for a while. [21] |
| **Declaration file** | A `.d.ts` file with only types, describing JavaScript code. [34] |
| **Deep copy** | A copy that also copies every nested object. [11] |
| **Default action** | What the browser does after the listeners run, like following a link; cancelled with `preventDefault()`. [28] |
| **Default export** | A module's single main export, imported without braces under any name. [17] |
| **Default parameter** | A value used when an argument is missing or `undefined`. [7] |
| **Default value** | A value used in destructuring when the original is `undefined`. [12] |
| **`defer`** | A script attribute: download in parallel, run after the HTML has been parsed. [26] |
| **Destructuring** | Unpacking values from an array or object into variables in one statement. [12] |
| **Discriminated union** | A union of object types told apart by a shared literal property, like `kind`. [32] |
| **`DOMContentLoaded`** | The event fired when the HTML has been fully parsed. [26] |
| **DOM (Document Object Model)** | The tree of objects the browser builds from a page's HTML, which JavaScript reads and changes. [26] |
| **Dynamic import** | `import()`, loading a module at run time and returning a promise. [17] |
| **Dynamic typing** | Types belong to values, not variables, and are checked as the code runs. [2] |
| **ECMAScript** | The official standard that defines the JavaScript language, with a new edition each year. [1] |
| **Element** | A node made from an HTML tag, such as `<li>`. [26] |
| **Enum** | A TypeScript construct naming a set of constants; it generates a JavaScript object. [34] |
| **Erasable syntax** | TypeScript syntax that can simply be deleted to leave valid JavaScript. [34] |
| **Error cause** | The original error kept inside a newer, more descriptive one. [18] |
| **Escape sequence** | A backslash code for a special character, such as `\n` for a new line. [3] |
| **ES modules (ESM)** | JavaScript's standard module system, using `import` and `export`. [17] |
| **Event** | Something that happens in the page, such as a click or a key press, which code can listen for. [28] |
| **Event delegation** | Handling events for many children with one listener on their container. [28] |
| **Event listener** | A function called each time an event happens on an element. [28] |
| **Event loop** | The mechanism that runs queued callbacks whenever the call stack is empty. [21] |
| **Event object** | The argument a listener receives, describing the event (`type`, `target`, `key`…). [28] |
| **Exception** | An error that's thrown and interrupts normal execution until caught. [18] |
| **Exhaustiveness check** | Assigning to `never` so a forgotten union member becomes a compile error. [32] |
| **Exponential backoff** | Waiting twice as long after each failed attempt. [25] |
| **Factory function** | A function that creates and returns new objects or functions. [8] |
| **Fall-through** | In a switch, running on into the next case when there's no `break` or `return`. [5] |
| **`filter`** | Makes a new array of the items that pass a test. [10] |
| **`finally`** | A block that always runs after `try` and `catch`, for clean-up. [18] |
| **`find`** | Returns the first item that passes a test, or `undefined`. [10] |
| **Flag** | A letter after the pattern that changes how it matches, such as `g` or `i`. [20] |
| **Floating point** | The binary format numbers are stored in, exact for whole numbers but approximate for most decimals. [4] |
| **Form control** | An input, select, textarea or button that a user can interact with. [29] |
| **`FormData`** | All of a form's named values, as the browser would send them. [29] |
| **Framework** | A library such as React, Vue or Svelte that turns state into DOM updates for you. [30] |
| **Function** | A reusable block of code that can take inputs and return a result. [7] |
| **Function type** | A type for functions, like `(pence: number) => boolean`. [33] |
| **Generator function** | A `function*` that produces values one at a time with `yield`. [19] |
| **Generic** | A function or type with type parameters, like `first<T>(items: T[]): T \| undefined`. [33] |
| **`getOrInsert`** | Returns a Map's value for a key, storing a default first if the key is missing. [13] |
| **Getter / setter** | Methods that run when a property is read or assigned. [16] |
| **Greedy / lazy** | Matching as much as possible, or (with `?`) as little as possible. [20] |
| **Header** | A named piece of metadata on a request or response, such as `Content-Type`. [24] |
| **Higher-order function** | A function that takes or returns another function. [7] |
| **Hoisting** | Function declarations can be called before their line in the code. [7] |
| **HTTP method** | The kind of request: GET reads, POST creates, PUT or PATCH updates, DELETE removes. [24] |
| **Idempotent** | Safe to repeat: doing it twice has the same effect as once. [25] |
| **Immutable** | Can't be changed after it's created; string methods return new strings. [3] |
| **Immutable update** | Producing an updated copy of data instead of changing the original. [12] |
| **`implements`** | Checks that a class provides everything an interface describes. [34] |
| **`import type`** | An import of types only, removed entirely from the JavaScript. [34] |
| **Index** | A position in a string or array, counting from 0. [3] |
| **Indexed access type** | `T[K]`, the type of property `K` of `T`. [33] |
| **Infinite loop** | A loop whose condition never becomes false. [6] |
| **`Infinity`** | A number value bigger than any other, such as the result of `1 / 0`. [4] |
| **Inheritance** | A class extending another and reusing its fields and methods. [16] |
| **`innerHTML`** | An element's content as HTML text; setting it parses the string as HTML. [27] |
| **Instance** | An object created from a class with `new`. [16] |
| **Interface** | A named object type, declared with `interface`. [32] |
| **ISO 8601** | The international standard text format for dates and times, such as `2026-10-08T14:30:00Z`. [15] |
| **Iterable** | A value `for…of` can loop over, such as an array, string, Map or Set. [6, 19] |
| **Iterator** | An object with a `next()` method that returns `{ value, done }`. [19] |
| **Iterator helpers** | Lazy methods such as `map`, `filter` and `take` on iterators. [19] |
| **JavaScript** | The programming language of the web, also used for servers and tools. [1] |
| **Jitter** | A random amount added to retry delays so clients don't retry in sync. [25] |
| **JSON** | A text format for data built from objects, arrays, strings, numbers, booleans and null. [14] |
| **JSON Schema** | A standard JSON format for describing the shape of JSON data. [35] |
| **`keyof`** | The union of an object type's property names. [33] |
| **`<label>`** | The visible name of a control; linked with `for`, it's read by screen readers and clickable. [29] |
| **Layout thrashing** | Forcing the browser to recalculate layout repeatedly by mixing page changes and layout reads. [27] |
| **Lazy evaluation** | Computing values only when they're needed. [19] |
| **`let`** | Declares a name that can be reassigned. [2] |
| **Lexical scope** | Scopes decided by where code is written, not where it's called. [8] |
| **Literal type** | A type with exactly one value, like `"parts"` or `42`. [31] |
| **Live region** | An element (such as `role="status"`) whose changes screen readers announce. [29] |
| **Loading / empty / error states** | What the page shows while waiting, when there's nothing to show, and when something failed. [30] |
| **`localeCompare`** | Compares strings in the order people expect for a language. [10] |
| **`localStorage`** | Small, persistent string storage per site, kept in the browser. [30] |
| **Lookahead / lookbehind** | A check on what follows or precedes a position, without including it in the match. [20] |
| **Loop** | Code that repeats a block while a condition holds or for each item. [6] |
| **Loose equality (`==`)** | Compares after converting types; best avoided. [5] |
| **`map`** | Makes a new array by transforming every item. [10] |
| **Map** | A collection of key–value pairs where keys can be any value and order is preserved. [13] |
| **Membership test** | Checking whether a value is in a collection; fast with `set.has`. [13] |
| **Memoization** | Remembering a function's results so repeat calls are instant. [8] |
| **Method** | A function that belongs to a value, called with a dot: `text.trim()`. [3, 11] |
| **Microtask** | A queued promise callback or `queueMicrotask` function; all run before the next task. [21] |
| **Module** | A file with its own scope that exports values for other files to import. [17] |
| **Mutating method** | A method that changes the array it's called on, such as `push` or `sort`. [9] |
| **`name` attribute** | The key a control's value is sent under, and how `form.elements` finds it. [29] |
| **Named export** | An export imported by its exact name, in braces. [17] |
| **Named group** | A capturing group with a name, `(?<name>…)`. [20] |
| **`NaN`** | "not a number", the result of a failed numeric operation. [2] |
| **Narrowing** | TypeScript refining a value's type inside a branch, from a check such as `typeof`. [32] |
| **`never`** | The type with no values, for code that can't be reached. [32] |
| **Node** | Any item in the DOM tree: an element, a piece of text, a comment, or the document itself. [26] |
| **Node.js** | A runtime for running JavaScript outside the browser: servers, scripts and tools. [1] |
| **`NodeList`** | The list `querySelectorAll` returns; it has `forEach` and `length` but not `map`. [26] |
| **Non-mutating method** | A method that returns a new array and leaves the original unchanged, such as `slice` or `toSorted`. [9] |
| **`null`** | A value meaning "deliberately empty". [2] |
| **Nullish coalescing (`??`)** | Gives the right-hand value only when the left is `null` or `undefined`. [5] |
| **Object** | Any value that isn't a primitive, such as plain objects, arrays and functions. [2, 11] |
| **`Object.entries`** | Turns an object into an array of `[key, value]` pairs. [11] |
| **Off-by-one error** | A loop that runs one time too many or too few. [6] |
| **Operator precedence** | The rules for which operations happen first, such as `*` before `+`. [4] |
| **Optional chaining (`?.`)** | Reads a property or calls a method only if the value before it isn't `null` or `undefined`. [5] |
| **Optional property** | A property marked `?` that may be missing. [32] |
| **Options object** | A single object parameter whose properties are named options with defaults. [12] |
| **Parallel (concurrent)** | Several operations in flight at the same time. [23] |
| **Parameter / argument** | The name in the definition, and the value passed in a call. [7] |
| **Parameter property** | A constructor parameter with `readonly`, `private` or `public` that also declares a field. [34] |
| **Pending / fulfilled / rejected** | A promise's states: waiting, succeeded with a value, failed with a reason. [22] |
| **Pipeline** | A chain of methods, each feeding its result to the next. [10] |
| **Polyfill** | Code that adds a missing feature to older environments. [15] |
| **Primitive** | A simple, unchangeable value: string, number, bigint, boolean, undefined, null or symbol. [2] |
| **Private field** | A field written `#name`, accessible only inside the class. [16] |
| **Promise** | An object representing a result that will be available later. [22] |
| **`Promise.all`** | Waits for all promises; rejects as soon as one rejects. [22] |
| **`Promise.allSettled`** | Waits for all promises and reports each outcome. [22] |
| **Promise chain** | A sequence of `then` calls, each receiving the previous step's result. [22] |
| **Promisify** | Wrap a callback-based function so it returns a promise. [22] |
| **Property** | One key and its value inside an object. [11] |
| **Prototype** | The object another object inherits properties from. [16] |
| **Quantifier** | How many times something repeats, such as `+`, `*`, `?` or `{2,4}`. [20] |
| **`querySelector`** | Returns the first element matching a selector, or `null`. [26] |
| **Query string** | The `?key=value&…` part of a URL. [24] |
| **`Record<K, V>`** | An object type with keys `K` and values `V`. [33] |
| **`reduce`** | Combines all items into one value using an accumulator. [10] |
| **Reference** | What a variable holds for an object or array: a pointer to it, not a copy. [9] |
| **Regular expression** | A pattern that describes text to match. [20] |
| **Remainder (`%`)** | What's left after division; its sign follows the left-hand number in JavaScript. [4] |
| **Render function** | A function that updates the page to match the current state. [30] |
| **`replaceChildren`** | Replaces all of an element's children with the given nodes (or none). [27] |
| **Replacer** | A function or key list that controls what `JSON.stringify` outputs. [14] |
| **`response.ok`** | True when the status is 200–299. [24] |
| **Rest element** | `...rest` in destructuring, collecting the remaining items or properties. [12] |
| **Rest parameter** | `...name`, collecting the remaining arguments into an array. [7] |
| **Result type** | A union like `{ ok: true; value: T } \| { ok: false; error: string }` for expected failures. [35] |
| **Rethrow** | Throwing a caught error again so it keeps propagating. [18] |
| **Reviver** | A function that transforms values as `JSON.parse` reads them. [14] |
| **Runtime (host)** | A program that runs JavaScript and adds its own features, such as a browser or Node.js. [1] |
| **Safe integer** | A whole number small enough (up to 2⁵³ − 1) to be stored exactly. [4] |
| **Sanitize** | Remove dangerous parts (scripts, event handlers) from HTML before inserting it. [27] |
| **`satisfies`** | Checks a value against a type while keeping its own, more precise inferred type. [32] |
| **Schema** | A description of the shape data must have. [14, 35] |
| **Scope** | The part of a program where a name can be used. [8] |
| **Sequential** | One operation after another, each waiting for the previous one. [23] |
| **Serialise / parse** | Turning a value into text, and text back into a value. [14] |
| **Server-sent events (SSE)** | A format for a server to push a stream of text events over HTTP. [25] |
| **Set** | A collection of unique values. [13] |
| **`setCustomValidity`** | Marks a control invalid with your own message (an empty string clears it). [29] |
| **Settled** | Fulfilled or rejected; a settled promise never changes. [22] |
| **Shadowing** | An inner variable hiding an outer one with the same name. [8] |
| **Shallow copy** | A new array or object whose items are the same values (nested objects are shared). [9] |
| **Short-circuiting** | `&&` and `\|\|` stop evaluating as soon as the result is known. [5] |
| **Single-threaded** | Running one piece of code at a time on one thread. [21] |
| **Specifier** | The text after `from` that says which module to load. [17] |
| **`splice`** | Removes and/or inserts items at a position, changing the array. [9] |
| **Spread** | `...` expanding an array or object into a new array, object or argument list. [12] |
| **Spread syntax** | `...array`, expanding an array into separate values. [7] |
| **Stable sort** | A sort that keeps equal items in their original order. [10] |
| **Stale response** | A response to an old request that arrives after a newer one. [30] |
| **State** | The data that determines what the page shows at any moment. [30] |
| **Statement** | One instruction in a program, usually ending with a semicolon. [1] |
| **Static member** | A field or method that belongs to the class itself, not to instances. [16] |
| **Status code** | A number describing the result, such as 200 OK or 404 Not Found. [24] |
| **Stream** | Data delivered in chunks over time instead of all at once. [25] |
| **Strict equality (`===`)** | True when both values have the same type and value. [5] |
| **Strict mode** | A stricter version of JavaScript that turns some silent mistakes into errors. [2, 31] |
| **String** | A sequence of characters: text. [3] |
| **`structuredClone`** | A built-in function that makes deep copies of data. [11] |
| **Submit event** | Fired on a form when it's submitted by a button or by Enter, after validation passes. [29] |
| **`super`** | Calls the parent class's constructor or methods. [16] |
| **`SyntaxError`** | The error `JSON.parse` throws for invalid JSON. [14] |
| **`target`** | The element where the event happened. [28] |
| **Task (macrotask)** | A queued callback from a timer, event or I/O; one runs per loop turn. [21] |
| **TC39** | The committee that develops the ECMAScript standard. [1] |
| **`<template>`** | HTML that isn't shown, kept to be cloned with `content.cloneNode(true)`. [27] |
| **Template literal** | A string in backticks that can span lines and insert values with `${…}`. [3] |
| **Temporal** | The modern JavaScript API for dates and times, with immutable objects and separate types for dates, times and zones. [15] |
| **Temporal dead zone** | The part of a block before a `let` or `const` declaration, where the name can't be used. [8] |
| **`Temporal.PlainDate`** | A calendar date with no time or time zone. [15] |
| **`Temporal.ZonedDateTime`** | A date and time in a specific time zone. [15] |
| **Ternary operator** | `condition ? a : b`, an expression that picks one of two values. [5] |
| **`textContent`** | All the text inside an element, without tags. [26] |
| **`this`** | The object a method was called on, decided at call time for ordinary functions. [16] |
| **Throttle** | Allow an action at most once per time period. [21] |
| **Timeout** | Giving up waiting after a set time. [25] |
| **Timestamp** | A moment in time as a number, such as milliseconds since 1 January 1970 UTC. [15] |
| **Time zone** | A region's rules for its offset from UTC, including daylight-saving changes, such as `Europe/London`. [15] |
| **Tolerance** | How far apart two numbers may be and still count as equal. [4] |
| **Top-level await** | `await` used directly in a module, outside any function. [23] |
| **Trust boundary** | Where data from outside (APIs, users, files, LLMs) enters your program. [35] |
| **Truthy / falsy** | How a value behaves when JavaScript needs true or false; falsy values are `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined` and `NaN`. [5] |
| **`try` / `catch`** | Run code, and handle any error it throws. [18] |
| **`tsconfig.json`** | The file that configures the TypeScript compiler for a project. [34] |
| **Tuple** | An array type with a fixed length and a type per position, like `[string, number]`. [31] |
| **Type alias** | A name for any type, declared with `type`. [32] |
| **Type annotation** | A type written after a name, like `price: number`. [31] |
| **Type assertion** | `value as Type` or `value!`, telling the compiler to trust you without a check. [32] |
| **Type checker** | The part of the compiler that finds type errors. [31] |
| **Type erasure** | Removing types to get the JavaScript that runs; types don't exist at runtime. [31] |
| **Type guard** | A function returning `value is Type` that checks a value at runtime and narrows it. [35] |
| **Type inference** | TypeScript working out a type from a value, without an annotation. [31] |
| **`typeof`** | An operator that returns a value's type as a string. [2] |
| **Type parameter** | A placeholder type such as `T`, filled in (usually inferred) at each use. [33] |
| **Type predicate** | The `value is Type` return type of a type guard. [35] |
| **TypeScript** | JavaScript with type annotations, checked by a compiler before the code runs. [31] |
| **`@types` package** | Type declarations for a JavaScript library, from the DefinitelyTyped project. [34] |
| **Type stripping** | Running TypeScript by deleting the types without checking them, as Node.js does. [31] |
| **`undefined`** | The value of something that hasn't been given a value. [2] |
| **Unhandled rejection** | A rejected promise with no `catch` or `await` to handle it. [22] |
| **Union / intersection / difference** | All values in either set / in both / in the first but not the second. [13] |
| **Union type** | `A \| B`: a value that is one of several types. [32] |
| **`unknown`** | A type for any value that must be checked before it's used. [31] |
| **UTC** | Coordinated Universal Time, the reference time zone with no daylight saving. [15] |
| **UTF-16 code unit** | The 16-bit unit JavaScript strings are made of; some characters need two. [3] |
| **Utility type** | A built-in generic type that transforms another, like `Partial<T>` or `Omit<T, K>`. [33] |
| **Validation** | Checking that data has the expected structure and types before using it. [14] |
| **`valueAsNumber`** | A number input's value as a number (`NaN` when empty). [29] |
| **Variable** | A name that refers to a value. [2] |
| **WeakMap** | A Map with object keys that doesn't keep its keys alive. [13] |
| **Web Worker** | A background thread in the browser; the sandbox runs your code in one. [1] |
| **`yield`** | Hands out a value from a generator and pauses it until the next value is requested. [19] |
| **Zod** | A popular TypeScript schema library that validates data and infers types from schemas. [35] |
