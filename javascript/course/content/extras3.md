@@ classes
topics: classes and instances, constructors, methods, public fields, private fields with #, getters and setters, static members, chaining by returning this, inheritance with extends and super, overriding methods, instanceof, composition versus inheritance, how this is decided, losing this in callbacks, arrow functions and bind, prototypes and the prototype chain
terms:
- **Class:** a blueprint for creating objects with the same fields and methods.
- **Instance:** an object created from a class with `new`.
- **Constructor:** the method that runs when an instance is created, setting up its fields.
- **Private field:** a field written `#name`, accessible only inside the class.
- **Getter / setter:** methods that run when a property is read or assigned.
- **Static member:** a field or method that belongs to the class itself, not to instances.
- **Inheritance:** a class extending another and reusing its fields and methods.
- **`super`:** calls the parent class's constructor or methods.
- **`this`:** the object a method was called on, decided at call time for ordinary functions.
- **Prototype:** the object another object inherits properties from.
mistakes:
- Using `this` in a subclass constructor before calling `super`.
- Passing a method as a callback and losing `this`.
- Exposing internal state as public fields that anyone can change.
- Building deep inheritance hierarchies instead of composing objects.
- Forgetting `new` when creating an instance.

glance:
- Protect state | #private fields + validated methods + getters | O(1) | O(1)
- Share behaviour | base class method calling an overridden method | O(1) | O(1)
- Keep this in callbacks | arrow-function fields or .bind(this) | O(1) | O(1)

@@ modules
topics: why programs are split into modules, ES modules, named and default exports, import syntax, renaming and namespace imports, module scope, strict mode and running once, live read-only bindings, relative, absolute and package specifiers, file extensions, modules in the browser, ESM versus CommonJS in Node.js, dynamic import() and code splitting, circular imports, side effects on import
terms:
- **Module:** a file with its own scope that exports values for other files to import.
- **ES modules (ESM):** JavaScript's standard module system, using `import` and `export`.
- **Named export:** an export imported by its exact name, in braces.
- **Default export:** a module's single main export, imported without braces under any name.
- **Specifier:** the text after `from` that says which module to load.
- **CommonJS:** Node.js's older module system, using `require` and `module.exports`.
- **Dynamic import:** `import()`, loading a module at run time and returning a promise.
- **Bundler:** a tool that combines many modules into a few files for the browser.
mistakes:
- Leaving off the file extension in browser or Node.js ES module imports.
- Mixing `require` and `import` styles without knowing which system a file uses.
- Putting slow work or side effects at the top level of a module.
- Creating circular imports between two modules.
- Resolving relative paths from the file instead of its folder.

glance:
- Share code | export from one module; import in another | O(1) | O(1)
- Load on demand | await import("./big.js") | O(module size) | O(module size)
- Resolve a relative path | folder parts as a stack; .. pops | O(path length) | O(depth)

@@ errors
topics: throwing and the call stack, built-in error types, throw, try, catch and finally, catching only what you can handle and rethrowing, custom error classes with extra fields, error causes, errors as values, AggregateError, Error.isError, validating input, logging errors safely
terms:
- **Exception:** an error that's thrown and interrupts normal execution until caught.
- **Call stack:** the chain of function calls currently running; errors travel up it.
- **`try` / `catch`:** run code, and handle any error it throws.
- **`finally`:** a block that always runs after `try` and `catch`, for clean-up.
- **Rethrow:** throwing a caught error again so it keeps propagating.
- **Custom error:** a class extending `Error` to name a kind of failure and carry extra data.
- **Error cause:** the original error kept inside a newer, more descriptive one.
- **`AggregateError`:** an error holding a list of several errors.
mistakes:
- Catching every error and ignoring it.
- Throwing strings instead of Error objects.
- Losing the original error when wrapping it (no `cause`).
- Using exceptions for ordinary, expected outcomes.
- Logging secrets such as passwords or tokens with errors.

glance:
- Handle a failure | try { … } catch (e) { if (expected) … else throw e } | O(1) | O(1)
- Name a failure | class MyError extends Error { constructor(…) { super(msg) } } | O(1) | O(1)
- Fallbacks | try each option; collect errors; AggregateError if all fail | O(options) | O(options)

@@ iterators-and-generators
topics: the iteration protocol, Symbol.iterator, iterators and next(), making classes iterable, generator functions and yield, pausing and lazy evaluation, infinite sequences, iterator helpers (map, filter, take, drop, flatMap, reduce, toArray), Iterator.from, when laziness pays off, async generators
terms:
- **Iterable:** an object that can be looped over with `for…of`, because it has a `[Symbol.iterator]()` method.
- **Iterator:** an object with a `next()` method that returns `{ value, done }`.
- **Generator function:** a `function*` that produces values one at a time with `yield`.
- **`yield`:** hands out a value from a generator and pauses it until the next value is requested.
- **Lazy evaluation:** computing values only when they're needed.
- **Iterator helpers:** lazy methods such as `map`, `filter` and `take` on iterators.
mistakes:
- Expecting a generator's body to run when the function is called.
- Spreading an infinite generator (`[...naturals()]`), which never finishes.
- Reusing a generator object after it's done (it stays finished).
- Resetting a batch array that was already handed to the consumer.

glance:
- Custom iteration | [Symbol.iterator]() returning { next } | O(1) per step | O(1)
- Lazy sequence | function* with a loop and yield | O(1) per value | O(1)
- First n of a pipeline | iter.filter(…).map(…).take(n).toArray() | O(items examined) | O(n)

@@ regular-expressions
topics: regex literals and the RegExp constructor, literal characters, character classes, quantifiers, anchors and word boundaries, alternation, flags (g, i, m, s, u, v, y, d), test, match, matchAll, replace and split, capturing, named and non-capturing groups, replacement strings and functions, greedy versus lazy quantifiers, lookahead and lookbehind, Unicode property escapes, RegExp.escape, catastrophic backtracking, when to use a parser instead
terms:
- **Regular expression:** a pattern that describes text to match.
- **Character class:** a set of characters in brackets, such as `[a-z]`, or a shorthand such as `\d`.
- **Quantifier:** how many times something repeats, such as `+`, `*`, `?` or `{2,4}`.
- **Anchor:** a position, such as `^` (start) or `$` (end), rather than a character.
- **Capturing group:** a bracketed part of a pattern whose matched text is saved.
- **Named group:** a capturing group with a name, `(?<name>…)`.
- **Greedy / lazy:** matching as much as possible, or (with `?`) as little as possible.
- **Lookahead / lookbehind:** a check on what follows or precedes a position, without including it in the match.
- **Flag:** a letter after the pattern that changes how it matches, such as `g` or `i`.
mistakes:
- Forgetting the `g` flag and replacing only the first match.
- Building a RegExp from user text without escaping it.
- Using greedy `.+` where a lazy `.+?` was meant.
- Forgetting `^` and `$`, so a pattern matches part of the text.
- Parsing HTML or JSON with regular expressions.

glance:
- Does it match? | /pattern/.test(text) | O(n) typically | O(1)
- All matches with groups | text.matchAll(/(?<name>…)/g) | O(n) typically | O(matches)
- Replace with logic | text.replace(/…/g, (m, …groups) => …) | O(n) | O(n)
- Search for user text | new RegExp(RegExp.escape(term), "gi") | O(n) | O(term)
