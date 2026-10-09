# JavaScript, TypeScript and JSON glossary

Every term used in the course, A to Z. The number in brackets is the lesson where it's introduced.

| Term | Meaning |
|---|---|
| **AbortController / AbortSignal** | A way to cancel operations such as `fetch` that accept a signal. [25] |
| **Accumulator** | A variable that builds up a result as a loop runs. [6] |
| **`AggregateError`** | An error holding a list of several errors. [18] |
| **Anchor** | A position, such as `^` (start) or `$` (end), rather than a character. [20] |
| **API** | A set of URLs (endpoints) a program can call to read or change data. [24] |
| **Array** | An ordered list of values, accessed by index. [9] |
| **Arrow function** | A short function syntax, `(x) => x * 2`, which returns the expression automatically. [7] |
| **`async` function** | A function that always returns a promise and can use `await`. [23] |
| **Async generator** | An `async function*` that yields values over time. [23] |
| **Asynchronous** | Started now and finished later, without blocking other code. [21] |
| **Async iterable** | A source of values that arrive over time, looped with `for await`. [23] |
| **Automatic semicolon insertion** | JavaScript's rule for adding missing semicolons at line ends. [1] |
| **`await`** | Pauses the current async function until a promise settles, then gives its value or throws its error. [23] |
| **BigInt** | A type for exact whole numbers of any size, written with an `n` suffix. [4] |
| **Block scope** | Names that exist only inside the nearest `{ }`, as with `let` and `const`. [8] |
| **`break`** | Ends a loop immediately. [6] |
| **Bundler** | A tool that combines many modules into a few files for the browser. [17] |
| **Callback** | A function passed to another function, to be called by it. [7, 21] |
| **Call stack** | The chain of function calls currently running; errors travel up it. [18, 21] |
| **Capturing group** | A bracketed part of a pattern whose matched text is saved. [20] |
| **Character class** | A set of characters in brackets, such as `[a-z]`, or a shorthand such as `\d`. [20] |
| **Class** | A blueprint for creating objects with the same fields and methods. [16] |
| **Closure** | A function bundled with the variables of the scope it was created in. [8] |
| **CommonJS** | Node.js's older module system, using `require` and `module.exports`. [17] |
| **Comparator** | A function `(a, b) => number` telling a sort which item comes first. [10] |
| **Computed key** | A key written in brackets whose name is calculated, `{ [name]: value }`. [11] |
| **Concurrency limit** | The maximum number of operations allowed to run at the same time. [25] |
| **`const`** | Declares a name that can't be reassigned. [2] |
| **Constructor** | The method that runs when an instance is created, setting up its fields. [16] |
| **`continue`** | Skips the rest of the current pass and starts the next. [6] |
| **CORS** | Browser rules that decide whether a page may read responses from another site. [24] |
| **Custom error** | A class extending `Error` to name a kind of failure and carry extra data. [18] |
| **Debounce** | Delay an action until calls stop arriving for a while. [21] |
| **Deep copy** | A copy that also copies every nested object. [11] |
| **Default export** | A module's single main export, imported without braces under any name. [17] |
| **Default parameter** | A value used when an argument is missing or `undefined`. [7] |
| **Default value** | A value used in destructuring when the original is `undefined`. [12] |
| **Destructuring** | Unpacking values from an array or object into variables in one statement. [12] |
| **Dynamic import** | `import()`, loading a module at run time and returning a promise. [17] |
| **Dynamic typing** | Types belong to values, not variables, and are checked as the code runs. [2] |
| **ECMAScript** | The official standard that defines the JavaScript language, with a new edition each year. [1] |
| **Error cause** | The original error kept inside a newer, more descriptive one. [18] |
| **Escape sequence** | A backslash code for a special character, such as `\n` for a new line. [3] |
| **ES modules (ESM)** | JavaScript's standard module system, using `import` and `export`. [17] |
| **Event loop** | The mechanism that runs queued callbacks whenever the call stack is empty. [21] |
| **Exception** | An error that's thrown and interrupts normal execution until caught. [18] |
| **Exponential backoff** | Waiting twice as long after each failed attempt. [25] |
| **Factory function** | A function that creates and returns new objects or functions. [8] |
| **Fall-through** | In a switch, running on into the next case when there's no `break` or `return`. [5] |
| **`filter`** | Makes a new array of the items that pass a test. [10] |
| **`finally`** | A block that always runs after `try` and `catch`, for clean-up. [18] |
| **`find`** | Returns the first item that passes a test, or `undefined`. [10] |
| **Flag** | A letter after the pattern that changes how it matches, such as `g` or `i`. [20] |
| **Floating point** | The binary format numbers are stored in, exact for whole numbers but approximate for most decimals. [4] |
| **Function** | A reusable block of code that can take inputs and return a result. [7] |
| **Generator function** | A `function*` that produces values one at a time with `yield`. [19] |
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
| **Index** | A position in a string or array, counting from 0. [3] |
| **Infinite loop** | A loop whose condition never becomes false. [6] |
| **`Infinity`** | A number value bigger than any other, such as the result of `1 / 0`. [4] |
| **Inheritance** | A class extending another and reusing its fields and methods. [16] |
| **Instance** | An object created from a class with `new`. [16] |
| **ISO 8601** | The international standard text format for dates and times, such as `2026-10-08T14:30:00Z`. [15] |
| **Iterable** | A value `for…of` can loop over, such as an array, string, Map or Set. [6, 19] |
| **Iterator** | An object with a `next()` method that returns `{ value, done }`. [19] |
| **Iterator helpers** | Lazy methods such as `map`, `filter` and `take` on iterators. [19] |
| **JavaScript** | The programming language of the web, also used for servers and tools. [1] |
| **Jitter** | A random amount added to retry delays so clients don't retry in sync. [25] |
| **JSON** | A text format for data built from objects, arrays, strings, numbers, booleans and null. [14] |
| **Lazy evaluation** | Computing values only when they're needed. [19] |
| **`let`** | Declares a name that can be reassigned. [2] |
| **Lexical scope** | Scopes decided by where code is written, not where it's called. [8] |
| **`localeCompare`** | Compares strings in the order people expect for a language. [10] |
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
| **Named export** | An export imported by its exact name, in braces. [17] |
| **Named group** | A capturing group with a name, `(?<name>…)`. [20] |
| **`NaN`** | "not a number", the result of a failed numeric operation. [2] |
| **Node.js** | A runtime for running JavaScript outside the browser: servers, scripts and tools. [1] |
| **Non-mutating method** | A method that returns a new array and leaves the original unchanged, such as `slice` or `toSorted`. [9] |
| **`null`** | A value meaning "deliberately empty". [2] |
| **Nullish coalescing (`??`)** | Gives the right-hand value only when the left is `null` or `undefined`. [5] |
| **Object** | Any value that isn't a primitive, such as plain objects, arrays and functions. [2, 11] |
| **`Object.entries`** | Turns an object into an array of `[key, value]` pairs. [11] |
| **Off-by-one error** | A loop that runs one time too many or too few. [6] |
| **Operator precedence** | The rules for which operations happen first, such as `*` before `+`. [4] |
| **Optional chaining (`?.`)** | Reads a property or calls a method only if the value before it isn't `null` or `undefined`. [5] |
| **Options object** | A single object parameter whose properties are named options with defaults. [12] |
| **Parallel (concurrent)** | Several operations in flight at the same time. [23] |
| **Parameter / argument** | The name in the definition, and the value passed in a call. [7] |
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
| **Query string** | The `?key=value&…` part of a URL. [24] |
| **`reduce`** | Combines all items into one value using an accumulator. [10] |
| **Reference** | What a variable holds for an object or array: a pointer to it, not a copy. [9] |
| **Regular expression** | A pattern that describes text to match. [20] |
| **Remainder (`%`)** | What's left after division; its sign follows the left-hand number in JavaScript. [4] |
| **Replacer** | A function or key list that controls what `JSON.stringify` outputs. [14] |
| **`response.ok`** | True when the status is 200–299. [24] |
| **Rest element** | `...rest` in destructuring, collecting the remaining items or properties. [12] |
| **Rest parameter** | `...name`, collecting the remaining arguments into an array. [7] |
| **Rethrow** | Throwing a caught error again so it keeps propagating. [18] |
| **Reviver** | A function that transforms values as `JSON.parse` reads them. [14] |
| **Runtime (host)** | A program that runs JavaScript and adds its own features, such as a browser or Node.js. [1] |
| **Safe integer** | A whole number small enough (up to 2⁵³ − 1) to be stored exactly. [4] |
| **Schema** | A description of the shape data must have. [14] |
| **Scope** | The part of a program where a name can be used. [8] |
| **Sequential** | One operation after another, each waiting for the previous one. [23] |
| **Serialise / parse** | Turning a value into text, and text back into a value. [14] |
| **Server-sent events (SSE)** | A format for a server to push a stream of text events over HTTP. [25] |
| **Set** | A collection of unique values. [13] |
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
| **Statement** | One instruction in a program, usually ending with a semicolon. [1] |
| **Static member** | A field or method that belongs to the class itself, not to instances. [16] |
| **Status code** | A number describing the result, such as 200 OK or 404 Not Found. [24] |
| **Stream** | Data delivered in chunks over time instead of all at once. [25] |
| **Strict equality (`===`)** | True when both values have the same type and value. [5] |
| **Strict mode** | A stricter version of JavaScript that turns some silent mistakes into errors. [2] |
| **String** | A sequence of characters: text. [3] |
| **`structuredClone`** | A built-in function that makes deep copies of data. [11] |
| **`super`** | Calls the parent class's constructor or methods. [16] |
| **`SyntaxError`** | The error `JSON.parse` throws for invalid JSON. [14] |
| **Task (macrotask)** | A queued callback from a timer, event or I/O; one runs per loop turn. [21] |
| **TC39** | The committee that develops the ECMAScript standard. [1] |
| **Template literal** | A string in backticks that can span lines and insert values with `${…}`. [3] |
| **Temporal** | The modern JavaScript API for dates and times, with immutable objects and separate types for dates, times and zones. [15] |
| **Temporal dead zone** | The part of a block before a `let` or `const` declaration, where the name can't be used. [8] |
| **`Temporal.PlainDate`** | A calendar date with no time or time zone. [15] |
| **`Temporal.ZonedDateTime`** | A date and time in a specific time zone. [15] |
| **Ternary operator** | `condition ? a : b`, an expression that picks one of two values. [5] |
| **`this`** | The object a method was called on, decided at call time for ordinary functions. [16] |
| **Throttle** | Allow an action at most once per time period. [21] |
| **Timeout** | Giving up waiting after a set time. [25] |
| **Timestamp** | A moment in time as a number, such as milliseconds since 1 January 1970 UTC. [15] |
| **Time zone** | A region's rules for its offset from UTC, including daylight-saving changes, such as `Europe/London`. [15] |
| **Tolerance** | How far apart two numbers may be and still count as equal. [4] |
| **Top-level await** | `await` used directly in a module, outside any function. [23] |
| **Truthy / falsy** | How a value behaves when JavaScript needs true or false; falsy values are `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined` and `NaN`. [5] |
| **`try` / `catch`** | Run code, and handle any error it throws. [18] |
| **`typeof`** | An operator that returns a value's type as a string. [2] |
| **`undefined`** | The value of something that hasn't been given a value. [2] |
| **Unhandled rejection** | A rejected promise with no `catch` or `await` to handle it. [22] |
| **Union / intersection / difference** | All values in either set / in both / in the first but not the second. [13] |
| **UTC** | Coordinated Universal Time, the reference time zone with no daylight saving. [15] |
| **UTF-16 code unit** | The 16-bit unit JavaScript strings are made of; some characters need two. [3] |
| **Validation** | Checking that data has the expected structure and types before using it. [14] |
| **Variable** | A name that refers to a value. [2] |
| **WeakMap** | A Map with object keys that doesn't keep its keys alive. [13] |
| **Web Worker** | A background thread in the browser; the sandbox runs your code in one. [1] |
| **`yield`** | Hands out a value from a generator and pauses it until the next value is requested. [19] |
