@@ node-basics
topics: what Node.js is (V8, the event loop and built-in modules), Deno and Bun, the LTS schedule and the change from Node.js 27, installing and version managers, node, the REPL, --watch and running TypeScript, ES modules and CommonJS, "type": "module", .mjs and .cjs, require of ES modules, node: built-in modules, process.argv, process.env and exitCode, .env files and --env-file, fs/promises, path.join, import.meta.dirname, streams, util.parseArgs
terms:
- **Node.js:** a program that runs JavaScript outside the browser, with access to files, the network and processes.
- **Runtime:** the environment that runs JavaScript: a browser, Node.js, Deno or Bun.
- **LTS (long-term support):** a Node.js version that gets fixes for 30 months; the one to use in production.
- **REPL:** an interactive prompt that runs each line of JavaScript you type (read, evaluate, print, loop).
- **CommonJS:** Node.js's original module system, with `require` and `module.exports`.
- **Built-in module:** a module that comes with Node.js, imported as `node:fs`, `node:path` and so on.
- **`process.argv`:** the command-line arguments: the node program, the script, then yours.
- **Environment variable:** a named setting given to a program by its environment, read with `process.env`.
- **`.env` file:** a local file of environment variables for development, never committed.
mistakes:
- Using an odd-numbered or end-of-life Node.js version in production.
- Mixing `require` and `import` styles without knowing which module system a file uses.
- Building file paths by joining strings with `/` instead of `path.join`.
- Committing `.env` files or hard-coding secrets.
- Reading huge files into memory at once instead of streaming them.

glance:
- Read options | util.parseArgs or a small parser over process.argv.slice(2) | O(args) | O(args)
- Configuration | defaults merged with a file and environment variables | O(keys) | O(keys)
- Read a file | await readFile(path.join(import.meta.dirname, …), "utf8") | O(file size) | O(file size)

@@ npm-and-packages
topics: packages and the npm registry, package.json fields (name, version, private, type, scripts, dependencies, devDependencies, engines, exports, bin), node --run, npm install, uninstall, ci and npx, node_modules, package-lock.json, semantic versioning, version ranges (caret, tilde, exact, 0.x), pre-releases, npm outdated, update and audit, Dependabot and Renovate, pnpm, Yarn and Bun, supply-chain attacks (Shai-Hulud), install scripts, typosquatting and trusted publishing
terms:
- **Package:** a folder of code with a `package.json`, usually published to the npm registry.
- **`package.json`:** a project's description: name, version, scripts and dependencies.
- **Dependency:** a package your code needs to run; a **dev dependency** is only needed while developing.
- **Lockfile:** a file (`package-lock.json`) recording the exact installed version of every package.
- **Semantic versioning (semver):** `MAJOR.MINOR.PATCH`, where MAJOR changes mean breaking changes.
- **Version range:** a set of acceptable versions, like `^4.1.0` (compatible) or `~4.1.0` (patches only).
- **npm script:** a named command in `package.json`'s `scripts`, run with `npm run <name>`.
- **Supply-chain attack:** an attack through the dependencies a project installs.
- **Install script:** code a package runs automatically when it's installed.
mistakes:
- Committing `node_modules`, or not committing the lockfile.
- Using `npm install` instead of `npm ci` in CI.
- Comparing version strings directly (`"1.10.0" < "1.9.0"`).
- Adding packages for trivial tasks without checking who maintains them.
- Putting build and test tools in `dependencies` instead of `devDependencies`.

glance:
- Reproducible installs | commit package-lock.json; npm ci | O(packages) | O(packages)
- Compare versions | split into numbers, compare field by field | O(1) | O(1)
- Safer dependencies | few packages, lockfile, audit, no install scripts | — | —

@@ formatting-linting-bundling
topics: formatters and Prettier, linters and ESLint 10's flat config, rules and --fix, typescript-eslint, Biome and Oxlint, abstract syntax trees and how rules work, type-checking with tsc --noEmit, bundlers and module graphs, tree shaking, minification, transpiling, content hashes and caching, source maps, Vite 8 and Rolldown, hot module replacement, esbuild and webpack, running all checks in CI
terms:
- **Formatter:** a tool that rewrites code into a consistent layout, such as Prettier.
- **Linter:** a tool that reports suspicious or error-prone code, such as ESLint.
- **Flat config:** ESLint's configuration file format, `eslint.config.js`, an array of config objects.
- **Abstract syntax tree (AST):** the tree of nodes a parser builds from source code.
- **Bundler:** a tool that combines modules and their dependencies into a few files for the browser.
- **Module graph:** the files of a program and the imports between them.
- **Tree shaking:** leaving code that nothing uses out of a bundle.
- **Minification:** making code smaller by removing whitespace and comments and shortening names.
- **Source map:** a file that maps generated code back to the original source, for debugging.
- **Hot module replacement (HMR):** updating changed modules in a running page without a full reload.
mistakes:
- Arguing about formatting in code review instead of letting a formatter decide.
- Turning lint rules off instead of fixing the code they flag.
- Assuming the bundler or `node file.ts` type-checks your code.
- Searching code with plain text matching where strings and comments make it wrong.
- Shipping production code without source maps, making errors impossible to trace.

glance:
- Consistent style | Prettier on save and prettier --check in CI | O(code) | O(code)
- Find likely bugs | ESLint rules over the AST | O(code) | O(AST)
- Ship to browsers | bundle: module graph → ordered, tree-shaken, minified files | O(modules + imports) | O(code)

@@ testing
topics: why automated tests, unit, integration and end-to-end tests, the test pyramid, node:test and node --test, node:assert/strict, test, describe and it, equal, deepEqual, ok, match, throws and rejects, async tests, arrange-act-assert, choosing test cases and edge cases, testing behaviour not implementation, mutation testing, dependency injection, test doubles, mock functions and fake timers, Vitest, Jest and Playwright, coverage, test-driven development
terms:
- **Automated test:** code that runs other code with known inputs and checks the results.
- **Unit test:** a test of one function or module on its own.
- **Integration test:** a test of several parts working together.
- **End-to-end test:** a test of the whole app through its real interface, often a browser.
- **Assertion:** a check that throws if a condition isn't met, failing the test.
- **Edge case:** an input at the limits of what's allowed, like empty, zero or the maximum.
- **Test double:** a stand-in for a real dependency in a test, such as a fake clock or a mock function.
- **Dependency injection:** passing a function its dependencies, so tests can pass fakes.
- **Code coverage:** the share of code lines (or branches) that ran during the tests.
- **Test-driven development (TDD):** writing a failing test first, then the code to pass it, then refactoring.
mistakes:
- Using `assert.equal` to compare objects or arrays (use `deepEqual`).
- Forgetting to `await` assertions about promises, so tests pass without checking.
- Copying expected values from the code's own output instead of the specification.
- Tests that depend on each other, the current time, or the network.
- Treating high coverage as proof that the code is correct.

glance:
- Check a function | test + assert.equal / deepEqual / throws | O(cases) | O(1)
- Async code | async test function + await (assert.rejects for failures) | O(cases) | O(1)
- Hard dependencies | pass them in; give tests fakes | O(1) | O(1)

@@ web-server
topics: HTTP servers, node:http and createServer, web-standard Request and Response handlers, Response.json, routing on method and path, path parameters, query strings, reading JSON bodies, validating input, status codes (200, 201, 204, 400, 401, 403, 404, 405, 409, 500), frameworks (Express 5, Fastify, Hono, full-stack frameworks), middleware as handler wrappers, error handling, logging, CORS and preflight requests, configuration and secrets, running servers in production
terms:
- **HTTP server:** a program that waits for HTTP requests and answers each with a response.
- **Handler:** a function that receives a request and returns a response.
- **Route:** the code that answers one method and path, like `GET /api/products/:id`.
- **Path parameter:** a variable part of a path, like the id in `/api/products/2`.
- **Status code:** a three-digit number saying how a request went: 2xx success, 4xx client error, 5xx server error.
- **Middleware:** code that wraps handlers to add shared behaviour, like logging or error handling.
- **CORS (cross-origin resource sharing):** headers that tell browsers which other sites may call an API.
- **Preflight request:** an `OPTIONS` request a browser sends to ask whether a cross-origin request is allowed.
mistakes:
- Returning 200 with an error message instead of the right status code.
- Trusting request bodies without validating them on the server.
- Sending internal error messages or stack traces to clients.
- Answering 404 when the path exists but the method doesn't (405).
- Allowing every origin with CORS by default.

glance:
- Answer requests | handler(Request) → Response, route on path then method | O(routes) per request | O(1)
- Accept data | await request.json() in try/catch, validate, 400 on failure | O(body) | O(body)
- Shared behaviour | middleware: (handler) => wrapped handler | O(layers) | O(1)
