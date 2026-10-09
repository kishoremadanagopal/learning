@@ why-typescript
topics: what TypeScript is, static type checking before the code runs, the sandbox's strict type-checking, TypeScript 7.0's native compiler and TypeScript 6.0, type annotations, type inference, the basic types, arrays and tuples, literal types, any versus unknown, strict mode and strict null checks, noImplicitAny, type erasure, running TypeScript with tsc, Node.js type stripping, bundlers and editors
terms:
- **TypeScript:** JavaScript with type annotations, checked by a compiler before the code runs.
- **Type annotation:** a type written after a name, like `price: number`.
- **Type inference:** TypeScript working out a type from a value, without an annotation.
- **Type checker:** the part of the compiler that finds type errors.
- **Strict mode:** the `strict` option, which turns on strict null checks, no implicit any and other checks.
- **`any`:** a type that turns checking off for a value.
- **`unknown`:** a type for any value that must be checked before it's used.
- **Literal type:** a type with exactly one value, like `"parts"` or `42`.
- **Tuple:** an array type with a fixed length and a type per position, like `[string, number]`.
- **Type erasure:** removing types to get the JavaScript that runs; types don't exist at runtime.
- **Type stripping:** running TypeScript by deleting the types without checking them, as Node.js does.
mistakes:
- Using `any` to make an error go away.
- Annotating every variable instead of letting inference work.
- Expecting types to check data at runtime.
- Ignoring "possibly undefined" errors instead of handling the missing case.
- Assuming `node file.ts` type-checks the code.

glance:
- Type a function | annotate parameters (and the return type) | O(1) | O(1)
- Value of unknown shape | unknown, then check it | O(size of the check) | O(1)
- Run TypeScript | strip types (node, bundler); check with tsc --noEmit | O(code) | O(code)

@@ object-types
topics: type aliases and interfaces, optional and readonly properties, excess property checks, union types, literal types, narrowing with typeof, truthiness, equality, in, instanceof and Array.isArray, early returns, discriminated unions, exhaustiveness checks with never, null and undefined, optional chaining, typed querySelector, type assertions with as and !, satisfies
terms:
- **Type alias:** a name for any type, declared with `type`.
- **Interface:** a named object type, declared with `interface`.
- **Optional property:** a property marked `?` that may be missing.
- **Union type:** `A | B`: a value that is one of several types.
- **Narrowing:** TypeScript refining a value's type inside a branch, from a check such as `typeof`.
- **Discriminated union:** a union of object types told apart by a shared literal property, like `kind`.
- **Exhaustiveness check:** assigning to `never` so a forgotten union member becomes a compile error.
- **`never`:** the type with no values, for code that can't be reached.
- **Type assertion:** `value as Type` or `value!`, telling the compiler to trust you without a check.
- **`satisfies`:** checks a value against a type while keeping its own, more precise inferred type.
mistakes:
- Making every property optional instead of modelling the real variants with a union.
- Using `as` or `!` to silence errors that point at real missing-value bugs.
- Narrowing with truthiness when `0` or `""` are valid values.
- Forgetting the `never` check, so a new union member is silently unhandled.
- Using string types where a union of literals would catch typos.

glance:
- Variants of a thing | discriminated union + switch on the discriminant | O(1) per check | O(1)
- Optional value | narrow with if / ?. / ?? before use | O(1) | O(1)
- Check a config object | satisfies Type | compile time only | O(1)

@@ functions-and-generics
topics: typed parameters and return types, optional and default parameters, rest parameters, function types, contextual typing of callbacks, void, generic functions and type parameters, type argument inference, constraints with extends, keyof and indexed access types, generic types, Result types, Record, utility types (Partial, Required, Readonly, Pick, Omit, ReturnType, Awaited), deriving types with typeof and as const
terms:
- **Function type:** a type for functions, like `(pence: number) => boolean`.
- **Generic:** a function or type with type parameters, like `first<T>(items: T[]): T | undefined`.
- **Type parameter:** a placeholder type such as `T`, filled in (usually inferred) at each use.
- **Constraint:** `T extends X`: limits a type parameter to types compatible with `X`.
- **`keyof`:** the union of an object type's property names.
- **Indexed access type:** `T[K]`, the type of property `K` of `T`.
- **Utility type:** a built-in generic type that transforms another, like `Partial<T>` or `Omit<T, K>`.
- **`Record<K, V>`:** an object type with keys `K` and values `V`.
- **`as const`:** makes a literal read-only with the most specific (literal) types.
mistakes:
- Using `any` where a type parameter would keep the type.
- Writing explicit type arguments that inference would work out.
- Copying an interface by hand instead of deriving it with `Pick`, `Omit` or `Partial`.
- Forgetting the constraint, so the generic body can't use what it needs.
- Keeping a list of values and a matching union type in sync by hand instead of deriving one from the other.

glance:
- Same logic for many types | generic function with inferred type parameters | O(1) extra | O(1)
- Choose a property safely | K extends keyof T, result T[K] | compile time only | O(1)
- Related object types | Partial, Pick, Omit, Readonly | compile time only | O(1)

@@ classes-and-tsconfig
topics: typed class fields and constructors, readonly, getters, TypeScript's private versus JavaScript's # private fields, implements, abstract classes, parameter properties, enums and their generated code, unions of literal types with as const, erasable syntax and erasableSyntaxOnly, exporting and importing types, import type, declaration files, DefinitelyTyped and @types packages, the types option, tsconfig.json for 2026, noUncheckedIndexedAccess, verbatimModuleSyntax, TypeScript 7's removed options
terms:
- **`implements`:** checks that a class provides everything an interface describes.
- **Abstract class:** a class that can't be created directly and may declare methods subclasses must provide.
- **Parameter property:** a constructor parameter with `readonly`, `private` or `public` that also declares a field.
- **Enum:** a TypeScript construct naming a set of constants; it generates a JavaScript object.
- **Erasable syntax:** TypeScript syntax that can simply be deleted to leave valid JavaScript.
- **`import type`:** an import of types only, removed entirely from the JavaScript.
- **Declaration file:** a `.d.ts` file with only types, describing JavaScript code.
- **`@types` package:** type declarations for a JavaScript library, from the DefinitelyTyped project.
- **`tsconfig.json`:** the file that configures the TypeScript compiler for a project.
mistakes:
- Relying on TypeScript's `private` for anything that must be private at runtime.
- Using enums or parameter properties in code meant to run with type stripping.
- Forgetting `import type` for type-only imports with `verbatimModuleSyntax`.
- Expecting installed `@types` packages to be used without listing them in `types`.
- Turning off `strict` to make an old project compile instead of fixing the errors.

glance:
- Private state | #field (runtime) rather than private (compile time) | O(1) | O(1)
- Fixed set of values | as const array + derived union instead of an enum | O(1) | O(values)
- Project settings | tsconfig.json with strict and modern module options | — | —

@@ typing-outside-data
topics: the trust boundary, res.json() and JSON.parse returning any, generic fetch helpers and their limits, unknown in catch blocks, type guards with type predicates, assertion functions, Result types for expected failures, exceptions versus results, schema validation with Zod, inferring types from schemas, JSON Schema, OpenAPI, LLM tool arguments
terms:
- **Trust boundary:** where data from outside (APIs, users, files, LLMs) enters your program.
- **Type guard:** a function returning `value is Type` that checks a value at runtime and narrows it.
- **Type predicate:** the `value is Type` return type of a type guard.
- **Assertion function:** a function declared `asserts value is Type` that throws if the check fails.
- **Result type:** a union like `{ ok: true; value: T } | { ok: false; error: string }` for expected failures.
- **Schema:** a description of the shape data must have, used to validate it at runtime.
- **Zod:** a popular TypeScript schema library that validates data and infers types from schemas.
- **JSON Schema:** a standard JSON format for describing the shape of JSON data.
mistakes:
- Annotating `await res.json()` with a type and treating it as checked.
- Writing a type guard that doesn't check everything its type predicate claims.
- Using `err.message` in a catch block without narrowing `err`.
- Returning results without forcing callers to check `ok`.
- Trusting LLM output to match the schema you asked for.

glance:
- Outside data | unknown → validate (guard or schema) → typed value | O(size of data) | O(1)
- Expected failure | return a Result union; callers check ok | O(1) | O(1)
- One definition, many uses | schema → type (z.infer) and JSON Schema | O(schema) | O(schema)
