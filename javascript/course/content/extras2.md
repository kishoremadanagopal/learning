@@ arrays
topics: creating arrays, length, indexes and at(), push, pop, shift, unshift and splice, includes, indexOf and lastIndexOf, methods that change an array versus ones that return a new one, toSorted, toReversed, toSpliced and with, arrays as references, copying with spread, slice, concat, Array.from, fill, flat, nested arrays
terms:
- **Array:** an ordered list of values, accessed by index.
- **Mutating method:** a method that changes the array it's called on, such as `push` or `sort`.
- **Non-mutating method:** a method that returns a new array and leaves the original unchanged, such as `slice` or `toSorted`.
- **Reference:** what a variable holds for an object or array: a pointer to it, not a copy.
- **Shallow copy:** a new array or object whose items are the same values (nested objects are shared).
- **`splice`:** removes and/or inserts items at a position, changing the array.
mistakes:
- Changing an array that was passed in to a function, surprising the caller.
- Thinking `const` stops an array's contents from changing.
- Copying with `b = a` and then modifying `b`.
- Comparing arrays with `===`.
- Reading past the end and getting `undefined` silently.

glance:
- Add or remove at the end | push / pop | O(1) | O(1)
- Add or remove at the start | unshift / shift | O(n) | O(1)
- Copy | [...arr] or arr.slice() | O(n) | O(n)
- Rotate | normalise k with modulo; join two slices | O(n) | O(n)
- Chunk | step by size; slice each piece | O(n) | O(n)

@@ array-methods
topics: callbacks on arrays, map, filter, find, findIndex and findLast, some and every, reduce and accumulators, sorting with a comparator, why the default sort compares text, localeCompare, stable sorting and tie-breakers, forEach, flat and flatMap, Object.groupBy and Map.groupBy, chaining methods into pipelines
terms:
- **`map`:** makes a new array by transforming every item.
- **`filter`:** makes a new array of the items that pass a test.
- **`reduce`:** combines all items into one value using an accumulator.
- **`find`:** returns the first item that passes a test, or `undefined`.
- **Comparator:** a function `(a, b) => number` telling a sort which item comes first.
- **Stable sort:** a sort that keeps equal items in their original order.
- **`localeCompare`:** compares strings in the order people expect for a language.
- **Pipeline:** a chain of methods, each feeding its result to the next.
mistakes:
- Sorting numbers without a comparator.
- Forgetting the starting value of `reduce`.
- Using `map` for side effects, or `forEach` to build a new array.
- Returning an object from an arrow function without brackets.
- Sorting the original array with `sort` when a copy was wanted.

glance:
- Transform each | arr.map(fn) | O(n) | O(n)
- Keep matching | arr.filter(fn) | O(n) | O(n)
- Combine all | arr.reduce(fn, start) | O(n) | O(1) plus the result
- Sort | toSorted((a, b) => …) | O(n log n) | O(n)
- Top n by count | count in an object or Map; sort entries; slice | O(n + k log k) | O(k)

@@ objects
topics: object literals, properties, dot and bracket access, adding, changing and deleting properties, shorthand properties, computed keys, methods and this, in and Object.hasOwn, Object.keys, values, entries and fromEntries, key order, nested objects, references, shallow and deep copies, structuredClone, comparing objects, Object.freeze
terms:
- **Object:** a collection of named properties (key–value pairs).
- **Property:** one key and its value inside an object.
- **Method:** a property whose value is a function.
- **Computed key:** a key written in brackets whose name is calculated, `{ [name]: value }`.
- **`Object.entries`:** turns an object into an array of `[key, value]` pairs.
- **Deep copy:** a copy that also copies every nested object.
- **`structuredClone`:** a built-in function that makes deep copies of data.
mistakes:
- Using a dot with a key stored in a variable (`obj.key` instead of `obj[key]`).
- Testing for a key with a truthiness check when its value may be 0 or "".
- Expecting `{ ...obj }` to copy nested objects.
- Comparing objects with `===` and expecting their contents to be compared.
- Modifying an object while looping over it.

glance:
- Read by variable name | obj[key] | O(1) | O(1)
- Loop over pairs | for (const [k, v] of Object.entries(obj)) | O(n) | O(n)
- Transform an object | Object.fromEntries(Object.entries(obj).map(…)) | O(n) | O(n)
- Deep copy | structuredClone(obj) | O(size) | O(size)
- Safe nested read | walk the path; stop at null or undefined | O(depth) | O(1)

@@ destructuring-and-spread
topics: array destructuring, skipping and defaults, rest elements, swapping variables, object destructuring, renaming, nested destructuring, rest properties, destructuring parameters and options objects, spread for arrays and objects, merging with later spreads winning, immutable updates of nested data
terms:
- **Destructuring:** unpacking values from an array or object into variables in one statement.
- **Default value:** a value used in destructuring when the original is `undefined`.
- **Rest element:** `...rest` in destructuring, collecting the remaining items or properties.
- **Spread:** `...` expanding an array or object into a new array, object or argument list.
- **Options object:** a single object parameter whose properties are named options with defaults.
- **Immutable update:** producing an updated copy of data instead of changing the original.
mistakes:
- Destructuring a nested object that may be missing, without a default `= {}`.
- Forgetting `= {}` on a destructured options parameter, so calling without options crashes.
- Putting the defaults after the overrides in a merge (`{ ...prefs, ...defaults }`).
- Updating nested data with spread on the outer object only, then changing the shared inner one.

glance:
- Unpack by name | const { a, b: renamed, c = 1 } = obj | O(k) | O(k)
- Merge with overrides | { ...defaults, ...overrides } | O(n) | O(n)
- Update one item | { ...state, items: items.map(i => i.id === id ? { ...i, ...changes } : i) } | O(n) | O(n)
- Named options | function f(x, { opt = 1 } = {}) | O(1) | O(1)

@@ map-and-set
topics: Map and its methods, Map versus plain objects, any key type, size and order, getOrInsert, counting and grouping with a Map, Map.groupBy, Set and its methods, removing duplicates, fast membership tests, union, intersection, difference, symmetricDifference, isSubsetOf and isDisjointFrom, WeakMap and WeakSet
terms:
- **Map:** a collection of key–value pairs where keys can be any value and order is preserved.
- **Set:** a collection of unique values.
- **`getOrInsert`:** returns a Map's value for a key, storing a default first if the key is missing.
- **Union / intersection / difference:** all values in either set / in both / in the first but not the second.
- **Membership test:** checking whether a value is in a collection; fast with `set.has`.
- **WeakMap:** a Map with object keys that doesn't keep its keys alive.
mistakes:
- Using objects as keys in a plain object (they all become "[object Object]").
- Using `array.includes` inside a loop over a large list instead of a Set.
- Expecting `JSON.stringify` to keep a Map's contents.
- Counting with a plain object and colliding with inherited keys like "constructor".

glance:
- Count occurrences | map.set(k, (map.get(k) ?? 0) + 1) | O(n) | O(distinct)
- Remove duplicates | [...new Set(items)] | O(n) | O(n)
- Seen before? | set.has(x) | O(1) average | O(n)
- Compare lists | new Set(a).intersection(new Set(b)) | O(n + m) | O(n + m)

@@ json
topics: what JSON is and where it's used, JSON syntax rules versus JavaScript objects, JSON.parse and JSON.stringify, pretty-printing, values that don't survive (undefined, functions, Date, Map, Set, NaN), replacers and revivers, invalid JSON and SyntaxError, try and catch, very large numbers, context.source and JSON.rawJSON, validating the shape of parsed data, schema libraries such as Zod
terms:
- **JSON:** a text format for data built from objects, arrays, strings, numbers, booleans and null.
- **Serialise / parse:** turning a value into text, and text back into a value.
- **Replacer:** a function or key list that controls what `JSON.stringify` outputs.
- **Reviver:** a function that transforms values as `JSON.parse` reads them.
- **`SyntaxError`:** the error `JSON.parse` throws for invalid JSON.
- **Validation:** checking that data has the expected structure and types before using it.
- **Schema:** a description of the shape data must have.
mistakes:
- Writing JSON with single quotes, unquoted keys or trailing commas.
- Calling `JSON.parse` on untrusted text without `try` / `catch`.
- Expecting Dates, Maps or Sets to come back from JSON unchanged.
- Parsing very large integer IDs as numbers and losing precision.
- Assuming valid JSON has the shape your code expects.

glance:
- Value to text | JSON.stringify(value, null, 2) | O(size) | O(size)
- Text to value | JSON.parse(text, reviver) inside try / catch | O(size) | O(size)
- Never throw | return { ok, value } or { ok, error } | O(size) | O(size)
- Check the shape | type checks per field; collect problems | O(fields) | O(problems)

@@ dates-and-time
topics: timestamps and the Unix epoch, the Date object, zero-based months, mutation, local time versus UTC, unreliable parsing, overflow, ISO 8601, Intl.DateTimeFormat and Intl.RelativeTimeFormat, the Temporal API, PlainDate, PlainTime, PlainDateTime, ZonedDateTime, Instant and Duration, calendar arithmetic, time zones and daylight saving, browser support and polyfills
terms:
- **Timestamp:** a moment in time as a number, such as milliseconds since 1 January 1970 UTC.
- **UTC:** Coordinated Universal Time, the reference time zone with no daylight saving.
- **ISO 8601:** the international standard text format for dates and times, such as `2026-10-08T14:30:00Z`.
- **Time zone:** a region's rules for its offset from UTC, including daylight-saving changes, such as `Europe/London`.
- **Temporal:** the modern JavaScript API for dates and times, with immutable objects and separate types for dates, times and zones.
- **`Temporal.PlainDate`:** a calendar date with no time or time zone.
- **`Temporal.ZonedDateTime`:** a date and time in a specific time zone.
- **Polyfill:** code that adds a missing feature to older environments.
mistakes:
- Forgetting that `Date` months start at 0.
- Parsing non-ISO date strings with `new Date(text)`.
- Mixing local-time and UTC methods.
- Adding 24 hours of milliseconds for "one day" across a clock change.
- Storing calendar dates (like birthdays) as midnight UTC timestamps.

glance:
- Store a moment | ISO 8601 UTC string or timestamp | O(1) | O(1)
- Show a moment | Intl.DateTimeFormat(locale, { timeZone }) | O(1) | O(1)
- Days between dates | UTC timestamps ÷ 86,400,000, or PlainDate.until | O(1) | O(1)
- Add months safely | Temporal.PlainDate add({ months }) | O(1) | O(1)
