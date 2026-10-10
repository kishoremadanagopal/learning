/* nodejs.js: the sandbox's `node` and `npm` commands.
   - node file.js runs a JavaScript file from the sandbox's files, with ES modules (import/export) between them and the
     built-in modules a small project needs (node:test, node:assert, node:fs, node:path, node:url, node:process)
   - node --test finds and runs test files, and prints like Node.js's spec reporter (the default since Node.js 23),
     with fixed durations so the course's examples print the same every time
   - npm test / npm run <script> run package.json scripts through the sandbox's shell
   It's a teaching simulation: the JavaScript really runs, but it's the browser's engine, not Node.js itself. */
import { inspect } from "./runner.js";

export const NODE_RELEASES = {
  22: { version: "v22.23.3", npm: "10.9.9" },
  24: { version: "v24.21.0", npm: "11.19.0" },
  26: { version: "v26.11.1", npm: "11.20.0" },
};
export const DEFAULT_NODE = 24;

export function installNode({ registerCommand, ExitSignal }) {
  const AsyncFunction = (async () => {}).constructor;
  const release = (sh) => NODE_RELEASES[sh.nodeMajor ?? DEFAULT_NODE] ?? NODE_RELEASES[DEFAULT_NODE];

  // a fixed pseudo-random duration in ms for a name, like 0.412375
  function fakeMs(name, lo = 0.1, span = 1.4) {
    let h = 2166136261;
    for (const c of name) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    return Number((lo + (h % 1000000) / 1000000 * span).toFixed(6));
  }

  class NodeExit extends Error { constructor(code) { super(`process.exit(${code})`); this.code = code; } }

  /* ------------------------------------------------------------ errors, printed like Node.js */

  const fileUrl = (path) => "file://" + path;
  // Rewrite a V8 stack from our wrapper functions into Node's style: user frames only.
  function userFrames(err) {
    const lines = String(err && err.stack || "").split("\n").slice(1);
    const frames = [];
    for (const ln of lines) {
      const m = /^\s*at (?:(.*?) \()?(file:\/\/[^)\s]+?):(\d+):(\d+)\)?$/.exec(ln);
      if (!m) continue;
      if (!/^file:\/\/(\/home\/learner\/|\/home\/runner\/|\/tmp\/\[eval\])/.test(m[2])) continue;   // only the sandbox's own files
      const line = Number(m[3]) - 2;     // the AsyncFunction wrapper adds two lines
      let fn = m[1] || "";
      if (/^(async )?(anonymous|Object\.<anonymous>)$/.test(fn) || /\beval\b/.test(fn)) fn = "";
      frames.push({ fn, file: m[2], line, col: Number(m[4]) });
    }
    return frames;
  }
  function formatFrames(frames, testFn = false) {
    return frames.map((f, k) => {
      let fn = f.fn;
      if (testFn && k === frames.length - 1 && !fn) fn = "TestContext.<anonymous>";
      return `    at ${fn ? `${fn} (${f.file}:${f.line}:${f.col})` : `${f.file}:${f.line}:${f.col}`}`;
    }).join("\n");
  }
  // util.inspect of an error: "Name: message", the stack, then any extra own properties.
  function inspectError(err, { testFn = false } = {}) {
    if (!(err instanceof Error)) return `${inspect(err, 2, new Set(), false)}`;
    const name = err.code === "ERR_ASSERTION" ? `AssertionError [ERR_ASSERTION]` : err.name;
    let text = `${name}: ${err.message}`;
    const frames = formatFrames(userFrames(err), testFn);
    if (frames) text += "\n" + frames;
    const keys = Object.keys(err).filter((k) => k !== "name");
    if (keys.length) {
      // util.inspect shows the properties one level deep: nested objects and arrays as [Object] and [Array]
      const prop = (v) => (Array.isArray(v) ? "[Array]" : v && typeof v === "object" && !(v instanceof RegExp) && !(v instanceof Date) ? `[${v.constructor?.name ?? "Object"}]` : inspect(v, 0, new Set(), false));
      text += " {\n" + keys.map((k) => `  ${k}: ${prop(err[k])}`).join(",\n") + "\n}";
    }
    return text;
  }

  /* ------------------------------------------------------------ node:assert (strict), with Node 24's messages */

  class AssertionError extends Error {
    constructor({ message, actual, expected, operator, generated }) {
      super(message);
      this.generatedMessage = generated;
      this.code = "ERR_ASSERTION";
      this.actual = actual;
      this.expected = expected;
      this.operator = operator;
      this.diff = "simple";
    }
  }
  Object.defineProperty(AssertionError.prototype, "name", { value: "AssertionError", enumerable: false, writable: true });

  // Node's inspectValue for assertion messages: one property per line, keys sorted
  function inspectValue(v, indent = "") {
    if (v === null || typeof v !== "object") return inspect(v, 2, new Set(), false);
    if (Array.isArray(v)) {
      if (!v.length) return "[]";
      return "[\n" + v.map((x) => `${indent}  ${inspectValue(x, indent + "  ")}`).join(",\n") + `\n${indent}]`;
    }
    if (v instanceof Map || v instanceof Set || v instanceof Date || v instanceof RegExp) return inspect(v, 2, new Set(), false);
    const keys = Object.keys(v).sort();
    if (!keys.length) return "{}";
    const key = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`);
    return "{\n" + keys.map((k) => `${indent}  ${key(k)}: ${inspectValue(v[k], indent + "  ")}`).join(",\n") + `\n${indent}}`;
  }
  function lineDiff(a, b) {
    // longest common subsequence on lines
    const n = a.length, m = b.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const out = [];
    let i = 0, j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a[i] === b[j]) { out.push(["  ", a[i]]); i++; j++; }
      else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) { out.push(["- ", b[j]]); j++; }
      else { out.push(["+ ", a[i]]); i++; }
    }
    // Node prints the actual (+) lines before the expected (-) lines within a change
    const sorted = [];
    for (let k = 0; k < out.length;) {
      if (out[k][0] === "  ") { sorted.push(out[k++]); continue; }
      const block = [];
      while (k < out.length && out[k][0] !== "  ") block.push(out[k++]);
      sorted.push(...block.filter(([o]) => o === "+ "), ...block.filter(([o]) => o === "- "));
    }
    return sorted;
  }
  function diffMessage(actual, expected, operator, custom) {
    const heading = custom ?? (operator === "deepStrictEqual" ? "Expected values to be strictly deep-equal:" : "Expected values to be strictly equal:");
    const ia = inspectValue(actual), ie = inspectValue(expected);
    const la = ia.split("\n"), le = ie.split("\n");
    const simple = la.length === 1 && le.length === 1 && (typeof actual !== "object" || actual === null || typeof expected !== "object" || expected === null);
    if (simple) {
      let len = ia.length + ie.length;
      if (typeof actual === "string") len -= 2;
      if (typeof expected === "string") len -= 2;
      if (len <= 12 && (actual !== 0 || expected !== 0)) return `${heading}\n\n${ia} !== ${ie}\n`;
      let msg = `\n+ ${ia}\n- ${ie}`;
      if (typeof actual === "string" && typeof expected === "string" && ia.length + ie.length <= 80) {
        for (let i = 0; i < ia.length; i++) if (ia[i] !== ie[i]) { if (i >= 3) msg += `\n${" ".repeat(i + 2)}^`; break; }
      }
      return `${heading}\n+ actual - expected\n${msg}\n`;
    }
    if (ia === ie) return `Values have same structure but are not reference-equal:\n\n${ia}\n`;
    const d = lineDiff(la, le);
    let body = "", nop = 0;
    for (let k = 0; k < d.length; k++) {
      const [op, text] = d[k];
      if (op === "  ") { nop++; if (nop <= 5 || d.slice(k).every(([o]) => o === "  ")) body += `  ${text}\n`; continue; }
      nop = 0;
      body += `${op}${text}\n`;
    }
    return `${heading}\n+ actual - expected\n\n${body.trimEnd()}\n`;
  }
  function strictDeepEqual(a, b) {
    if (Object.is(a, b)) return true;
    if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
    if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
    if (a instanceof Date) return a.getTime() === b.getTime();
    if (a instanceof Map || a instanceof Set) {
      if (a.size !== b.size) return false;
      if (a instanceof Set) { for (const v of a) if (!b.has(v)) return false; return true; }
      for (const [k, v] of a) if (!b.has(k) || !strictDeepEqual(v, b.get(k))) return false;
      return true;
    }
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && strictDeepEqual(a[k], b[k]));
  }
  function makeAssert() {
    const fail = (opts) => {
      if (opts.message instanceof Error) throw opts.message;
      const err = new AssertionError({ ...opts, message: opts.message ?? opts.fallback, generated: opts.message === undefined });
      Error.captureStackTrace?.(err, opts.fn);
      throw err;
    };
    const assert = function ok(value, message) {
      if (!value) fail({ message, fallback: "The expression evaluated to a falsy value:\n\n  assert(" + inspect(value, 1, new Set(), false) + ")\n", actual: value, expected: true, operator: "==", fn: assert });
    };
    assert.ok = assert;
    assert.equal = assert.strictEqual = function strictEqual(actual, expected, message) {
      if (!Object.is(actual, expected)) {
        const objs = typeof actual === "object" && actual !== null && typeof expected === "object" && expected !== null;
        fail({ message, fallback: diffMessage(actual, expected, "strictEqual", objs ? 'Expected "actual" to be reference-equal to "expected":' : undefined), actual, expected, operator: "strictEqual", fn: strictEqual });
      }
    };
    assert.notEqual = assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
      if (Object.is(actual, expected)) {
        const v = inspectValue(actual);
        fail({ message, fallback: `Expected "actual" to be strictly unequal to:${v.length > 5 ? "\n\n" : " "}${v}`, actual, expected, operator: "notStrictEqual", fn: notStrictEqual });
      }
    };
    assert.deepEqual = assert.deepStrictEqual = function deepStrictEqual(actual, expected, message) {
      if (!strictDeepEqual(actual, expected)) fail({ message, fallback: diffMessage(actual, expected, "deepStrictEqual"), actual, expected, operator: "deepStrictEqual", fn: deepStrictEqual });
    };
    assert.notDeepEqual = assert.notDeepStrictEqual = function notDeepStrictEqual(actual, expected, message) {
      if (strictDeepEqual(actual, expected)) fail({ message, fallback: `Expected "actual" not to be strictly deep-equal to:\n\n${inspectValue(actual)}\n`, actual, expected, operator: "notDeepStrictEqual", fn: notDeepStrictEqual });
    };
    assert.match = function match(string, regexp, message) {
      if (typeof string !== "string" || !regexp.test(string)) {
        fail({ message, fallback: `The input did not match the regular expression ${regexp}. Input:\n\n${inspect(string, 1, new Set(), false)}\n`, actual: string, expected: regexp, operator: "match", fn: match });
      }
    };
    const matches = (e, expected) => {
      if (expected === undefined) return true;
      if (expected instanceof RegExp) return expected.test(String(e && e.message !== undefined ? e.message : e));
      if (typeof expected === "function") return expected.prototype !== undefined && e instanceof expected ? true : (Error.isPrototypeOf(expected) || expected === Error ? false : expected(e) === true);
      if (typeof expected === "object" && expected) return Object.keys(expected).every((k) => (expected[k] instanceof RegExp ? expected[k].test(String(e?.[k])) : strictDeepEqual(e?.[k], expected[k])));
      return false;
    };
    assert.throws = function throws(fn, expected, message) {
      if (typeof expected === "string") { message = expected; expected = undefined; }
      try { fn(); } catch (e) {
        if (!matches(e, expected)) throw e;
        return;
      }
      fail({ message, fallback: "Missing expected exception.", actual: undefined, expected, operator: "throws", fn: throws });
    };
    assert.rejects = async function rejects(p, expected, message) {
      if (typeof expected === "string") { message = expected; expected = undefined; }
      try { await (typeof p === "function" ? p() : p); } catch (e) {
        if (!matches(e, expected)) throw e;
        return;
      }
      fail({ message, fallback: "Missing expected rejection.", actual: undefined, expected, operator: "rejects", fn: rejects });
    };
    assert.fail = function failFn(message = "Failed") { fail({ message, actual: undefined, expected: undefined, operator: "fail", fn: failFn }); };
    assert.AssertionError = AssertionError;
    assert.strict = assert;
    return assert;
  }

  /* ------------------------------------------------------------ node:test, reporting like the spec reporter */

  function makeTestRunner(out) {
    const stats = { tests: 0, suites: 0, pass: 0, fail: 0, cancelled: 0, skipped: 0, todo: 0 };
    const failures = [];
    const root = { children: [], hooks: { before: [], after: [], beforeEach: [], afterEach: [] }, depth: -1 };
    let collecting = root;
    let file = null, relFile = null;
    const where = () => {
      // the line and column of the test()/describe() call in the test file
      const f = userFrames(new Error()).find((x) => x.file === fileUrl(file));
      return f ? { line: f.line, col: f.col } : { line: 1, col: 1 };
    };
    function add(kind, name, optsOrFn, maybeFn, extra = {}) {
      let opts = {}, fn = maybeFn;
      if (typeof optsOrFn === "function") fn = optsOrFn;
      else if (optsOrFn && typeof optsOrFn === "object") opts = optsOrFn;
      if (typeof name === "function") { fn = name; name = fn.name || "<anonymous>"; }
      const node = { kind, name: String(name ?? "<anonymous>"), fn, opts: { ...opts, ...extra }, children: [], hooks: { before: [], after: [], beforeEach: [], afterEach: [] }, parent: collecting, ...where() };
      collecting.children.push(node);
      return Promise.resolve();
    }
    const test = (n, o, f) => add("test", n, o, f);
    test.skip = (n, o, f) => add("test", n, o, f, { skip: true });
    test.todo = (n, o, f) => add("test", n, o, f, { todo: true });
    test.only = (n, o, f) => add("test", n, o, f);
    const describe = (n, o, f) => add("suite", n, o, f);
    describe.skip = (n, o, f) => add("suite", n, o, f, { skip: true });
    describe.todo = (n, o, f) => add("suite", n, o, f, { todo: true });
    describe.only = describe;
    const hook = (k) => (fn) => { collecting.hooks[k].push(fn); };

    const pad = (d) => "  ".repeat(d);
    const label = (node, ms) => `${node.name} (${ms}ms)${node.opts.skip ? ` # ${typeof node.opts.skip === "string" ? node.opts.skip : "SKIP"}` : node.opts.todo ? ` # ${typeof node.opts.todo === "string" ? node.opts.todo : "TODO"}` : ""}`;
    async function runHooks(list, ctx) { for (const h of list) await h(ctx); }
    const eachHooks = (node, kind) => {
      const chain = [];
      for (let p = node.parent; p; p = p.parent) chain.unshift(...p.hooks[kind]);
      return kind === "afterEach" ? chain.reverse() : chain;
    };

    async function runNode(node, depth) {
      const ms = fakeMs(file + node.name);
      if (node.kind === "suite") {
        stats.suites++;
        const outer = collecting;
        collecting = node;
        let err = null;
        try { if (!node.opts.skip && node.fn) await node.fn({ name: node.name }); } catch (e) { err = e; }
        collecting = outer;
        out("out", `${pad(depth)}▶ ${node.name}\n`);
        if (!err && !node.opts.skip) {
          try { await runHooks(node.hooks.before, {}); } catch (e) { err = e; }
          for (const child of node.children) await runNode(child, depth + 1);
          try { await runHooks(node.hooks.after, {}); } catch (e) { err = err ?? e; }
        }
        const total = Number((ms + node.children.length * 0.35).toFixed(6));
        const failed = err || node.children.some((c) => c.failed);
        node.failed = !!failed;
        if (failed) {
          if (err) { failures.push({ node, err, ms: total, rel: relFile }); stats.fail++; }
          out("out", `${pad(depth)}✖ ${label(node, total)}\n`);
        } else out("out", `${pad(depth)}✔ ${label(node, total)}\n`);
        return;
      }
      stats.tests++;
      if (node.opts.skip) { stats.skipped++; out("out", `${pad(depth)}﹣ ${label(node, ms)}\n`); return; }
      const ctx = {
        name: node.name,
        diagnostic: (msg) => out("out", `${pad(depth + 1)}ℹ ${msg}\n`),
        skip: () => { node.opts.skip = true; },
        todo: () => { node.opts.todo = true; },
        test: async (n, o, f) => {
          const outer = collecting;
          collecting = node;
          await add("test", n, o, f);
          collecting = outer;
          const child = node.children.at(-1);
          child.parent = node;
          await runNode(child, depth + 1);
          if (child.failed) node.failed = true;
        },
      };
      let err = null;
      try {
        await runHooks(eachHooks(node, "beforeEach"), ctx);
        if (node.fn) {
          if (node.fn.length >= 2) await new Promise((resolve, reject) => node.fn(ctx, (e) => (e ? reject(e) : resolve())));
          else await node.fn(ctx);
        }
        await runHooks(eachHooks(node, "afterEach"), ctx);
      } catch (e) { err = e; }
      if (!err && node.failed) err = Object.assign(new Error(`${node.children.filter((c) => c.failed).length} subtest failed`), { subtests: true });
      if (node.opts.todo) {
        stats.todo++;
        out("out", `${pad(depth)}${err ? "⚠" : "✔"} ${label(node, ms)}\n`);
        return;
      }
      if (node.opts.skip) { stats.skipped++; out("out", `${pad(depth)}﹣ ${label(node, ms)}\n`); return; }
      if (err) {
        node.failed = true;
        stats.fail++;
        if (!err.subtests) failures.push({ node, err, ms, rel: relFile });
        out("out", `${pad(depth)}✖ ${label(node, ms)}\n`);
      } else {
        stats.pass++;
        out("out", `${pad(depth)}✔ ${label(node, ms)}\n`);
      }
    }

    return {
      api: { test, it: test, describe, suite: describe, before: hook("before"), after: hook("after"), beforeEach: hook("beforeEach"), afterEach: hook("afterEach"), mock: undefined },
      setFile(path, rel) { file = path; relFile = rel; root.children = []; root.hooks = { before: [], after: [], beforeEach: [], afterEach: [] }; collecting = root; },
      async runCollected() {
        await runHooks(root.hooks.before, {});
        for (const node of root.children) { node.parent = root; await runNode(node, 0); }
        await runHooks(root.hooks.after, {});
      },
      fileFailed(path, err) {
        stats.tests++; stats.fail++;
        const node = { name: path, opts: {}, line: 1, col: 1 };
        failures.push({ node, err, ms: fakeMs(path, 20, 30), file: path });
        out("out", `✖ ${path} (${fakeMs(path, 20, 30)}ms)\n`);
      },
      stats,
      summary(cwd, totalMs) {
        let text = ["tests", "suites", "pass", "fail", "cancelled", "skipped", "todo"].map((k) => `ℹ ${k} ${stats[k]}\n`).join("") + `ℹ duration_ms ${totalMs}\n`;
        if (failures.length) {
          const parts = ["\n✖ failing tests:\n"];
          for (const f of failures) {
            const rel = f.file ? f.file : f.rel;
            parts.push(`test at ${rel}:${f.node.line}:${f.node.col}`);
            const shown = inspectError(f.err, { testFn: true }).split("\n").join("\n  ");
            parts.push(`✖ ${f.node.name} (${f.ms}ms)\n  ${shown}\n`);
          }
          text += parts.join("\n");
        }
        return text;
      },
    };
  }

  /* ------------------------------------------------------------ ES modules from the sandbox's files */

  function transform(src, path) {
    const url = fileUrl(path);
    let esm = false, n = 0;
    const exported = [];   // [exportName, localName]
    const keepLines = (m) => "\n".repeat((m.match(/\n/g) || []).length);
    let code = src.replace(/^#!.*/, "");
    // import … from "…"
    code = code.replace(/^([ \t]*)import\s+([\w$*{}\s,]+?)\s+from\s*(['"])([^'"]+)\3\s*;?/gm, (m, ind, clause, _q, spec) => {
      esm = true;
      const v = `__m${n++}`;
      let out = `const ${v} = await __import(${JSON.stringify(spec)});`;
      clause = clause.trim();
      const def = /^([A-Za-z_$][\w$]*)\s*(?:,|$)/.exec(clause);
      if (def) { out += ` const ${def[1]} = ${v}.default;`; clause = clause.slice(def[0].length).trim(); }
      const ns = /^\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(clause);
      if (ns) out += ` const ${ns[1]} = ${v};`;
      const named = /^\{([\s\S]*)\}$/.exec(clause);
      if (named) {
        const list = named[1].split(",").map((x) => x.trim()).filter(Boolean).map((x) => x.replace(/^([\w$]+)\s+as\s+([\w$]+)$/, "$1: $2"));
        out += ` const { ${list.join(", ")} } = ${v};`;
      }
      return ind + out + keepLines(m);
    });
    // import "…"
    code = code.replace(/^([ \t]*)import\s*(['"])([^'"]+)\2\s*;?/gm, (m, ind, _q, spec) => { esm = true; return `${ind}await __import(${JSON.stringify(spec)});`; });
    code = code.replace(/\bimport\.meta\.url\b/g, JSON.stringify(url)).replace(/\bimport\.meta\.filename\b/g, JSON.stringify(path))
      .replace(/\bimport\.meta\.dirname\b/g, JSON.stringify(path.slice(0, path.lastIndexOf("/"))));
    // export default function f / class C
    code = code.replace(/^([ \t]*)export\s+default\s+((?:async\s+)?function\*?|class)\s+([A-Za-z_$][\w$]*)/gm, (m, ind, kw, name) => { esm = true; exported.push(["default", name]); return `${ind}${kw} ${name}`; });
    code = code.replace(/^([ \t]*)export\s+default\s+/gm, (m, ind) => { esm = true; return `${ind}__exports.default = `; });
    // export function / class / const / let / var
    code = code.replace(/^([ \t]*)export\s+((?:async\s+)?function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm, (m, ind, kw, name) => { esm = true; exported.push([name, name]); return `${ind}${kw} ${name}`; });
    // export { a, b as c } [from "…"]
    code = code.replace(/^([ \t]*)export\s*\{([^}]*)\}\s*(?:from\s*(['"])([^'"]+)\3)?\s*;?/gm, (m, ind, list, _q, spec) => {
      esm = true;
      const items = list.split(",").map((x) => x.trim()).filter(Boolean).map((x) => { const mm = /^([\w$]+)(?:\s+as\s+([\w$]+))?$/.exec(x); return mm ? [mm[2] ?? mm[1], mm[1]] : null; }).filter(Boolean);
      if (spec) {
        const v = `__m${n++}`;
        return `${ind}const ${v} = await __import(${JSON.stringify(spec)}); ${items.map(([e, l]) => `Object.defineProperty(__exports, ${JSON.stringify(e)}, { enumerable: true, get: () => ${v}[${JSON.stringify(l)}] });`).join(" ")}` + keepLines(m);
      }
      exported.push(...items);
      return ind + keepLines(m);
    });
    const getters = exported.map(([e, l]) => `Object.defineProperty(__exports, ${JSON.stringify(e)}, { enumerable: true, get: () => ${l} });`).join(" ");
    return { code: (esm ? '"use strict"; ' : "") + getters + code, esm };
  }

  /* ------------------------------------------------------------ a Node.js process */

  async function runProcess(sh, io, argv, { mode = "run", files = [] } = {}) {
    const rel = release(sh);
    const cache = new Map();
    let exitCode = 0;
    const pending = new Set();
    const timers = new Set();
    const write = (kind) => (text) => (kind === "err" ? io.err(String(text)) : io.out(String(text)));
    const fmt = (args) => args.map((a) => (typeof a === "string" ? a : inspect(a, 2, new Set(), false))).join(" ") + "\n";
    const consoleObj = {
      log: (...a) => io.out(fmt(a)), info: (...a) => io.out(fmt(a)), debug: (...a) => io.out(fmt(a)),
      error: (...a) => io.err(fmt(a)), warn: (...a) => io.err(fmt(a)), dir: (v) => io.out(inspect(v, 2, new Set(), false) + "\n"),
      table: (rows) => io.out(inspect(rows, 2, new Set(), false) + "\n"),
    };
    const env = { ...sh.env };
    const processObj = {
      argv: ["/usr/local/bin/node", ...argv], env, platform: "linux", arch: "x64", version: rel.version,
      versions: { node: rel.version.slice(1) }, pid: 4242,
      cwd: () => sh.cwd,
      exit: (code = exitCode) => { throw new NodeExit(code ?? 0); },
      get exitCode() { return exitCode; }, set exitCode(v) { exitCode = v; },
      stdout: { write: (t) => { io.out(String(t)); return true; }, isTTY: false },
      stderr: { write: (t) => { io.err(String(t)); return true; }, isTTY: false },
      on: () => processObj, once: () => processObj, nextTick: (fn, ...a) => queueMicrotask(() => fn(...a)),
      hrtime: { bigint: () => BigInt(Date.now()) * 1000000n },
    };
    const st = (fn, ms, ...a) => { const id = setTimeout(() => { timers.delete(id); fn(...a); }, Math.min(ms ?? 0, 2000)); timers.add(id); return id; };
    const ct = (id) => { clearTimeout(id); timers.delete(id); };
    const si = () => { throw new Error("setInterval isn't available in the sandbox's node; use setTimeout"); };
    const runner = mode === "test" ? makeTestRunner((k, t) => (k === "err" ? io.err(t) : io.out(t))) : null;
    const assert = makeAssert();
    const pathMod = {
      sep: "/",
      join: (...p) => normalize(p.filter((x) => x !== "").join("/")),
      resolve: (...p) => { let r = sh.cwd; for (const x of p) r = x.startsWith("/") ? x : r + "/" + x; return normalize(r); },
      basename: (p, ext) => { let b = p.replace(/\/+$/, "").split("/").pop(); if (ext && b.endsWith(ext)) b = b.slice(0, -ext.length); return b; },
      dirname: (p) => { const i = p.replace(/\/+$/, "").lastIndexOf("/"); return i < 0 ? "." : i === 0 ? "/" : p.slice(0, i); },
      extname: (p) => { const b = p.split("/").pop(); const i = b.lastIndexOf("."); return i > 0 ? b.slice(i) : ""; },
      relative: (from, to) => { const a = pathMod.resolve(from).split("/").filter(Boolean), b = pathMod.resolve(to).split("/").filter(Boolean); let i = 0; while (i < a.length && a[i] === b[i]) i++; return [...a.slice(i).map(() => ".."), ...b.slice(i)].join("/"); },
      isAbsolute: (p) => p.startsWith("/"),
    };
    pathMod.posix = pathMod;
    function normalize(p) {
      const abs = p.startsWith("/");
      const out = [];
      for (const part of p.split("/")) { if (!part || part === ".") continue; if (part === "..") out.pop(); else out.push(part); }
      return (abs ? "/" : "") + out.join("/") || (abs ? "/" : ".");
    }
    const fsErr = (code, msg, syscall, path) => Object.assign(new Error(`${code}: ${msg}, ${syscall} '${path}'`), { code, errno: code === "ENOENT" ? -2 : -21, syscall, path });
    const fsMod = {
      readFileSync: (p, enc) => {
        const abs = pathMod.resolve(String(p).replace(/^file:\/\//, ""));
        const t = sh.fs.text(abs);
        if (t === null) throw fsErr(sh.fs.isDir(abs) ? "EISDIR" : "ENOENT", sh.fs.isDir(abs) ? "illegal operation on a directory" : "no such file or directory", "open", String(p));
        return enc ? t : new TextEncoder().encode(t);
      },
      writeFileSync: (p, data) => { const abs = pathMod.resolve(String(p)); if (!sh.fs.isDir(sh.fs.parent(abs))) throw fsErr("ENOENT", "no such file or directory", "open", String(p)); pending.add(sh.fs.writeFile(abs, String(data))); },
      appendFileSync: (p, data) => { const abs = pathMod.resolve(String(p)); pending.add(sh.fs.writeFile(abs, (sh.fs.text(abs) ?? "") + String(data))); },
      existsSync: (p) => sh.fs.exists(pathMod.resolve(String(p))),
      mkdirSync: (p, o) => { pending.add(sh.fs.mkdir(pathMod.resolve(String(p)), o)); },
      readdirSync: (p) => {
        const abs = pathMod.resolve(String(p));
        if (!sh.fs.isDir(abs)) throw fsErr("ENOENT", "no such file or directory", "scandir", String(p));
        const prefix = abs === "/" ? "/" : abs + "/";
        return [...sh.fs.nodes.keys()].filter((k) => k.startsWith(prefix) && k !== abs && !k.slice(prefix.length).includes("/")).map((k) => k.slice(prefix.length)).sort();
      },
    };
    fsMod.promises = {
      readFile: async (p, enc) => fsMod.readFileSync(p, enc),
      writeFile: async (p, d) => { fsMod.writeFileSync(p, d); await Promise.all(pending); },
      readdir: async (p) => fsMod.readdirSync(p),
      mkdir: async (p, o) => { fsMod.mkdirSync(p, o); await Promise.all(pending); },
    };
    const urlMod = {
      fileURLToPath: (u) => String(u).replace(/^file:\/\//, ""),
      pathToFileURL: (p) => new URL(fileUrl(pathMod.resolve(p))),
      URL, URLSearchParams,
    };
    const testApi = runner ? runner.api : (() => {
      const r = makeTestRunner((k, t) => (k === "err" ? io.err(t) : io.out(t)));
      return r.api;
    })();
    const builtins = {
      "node:assert": { default: assert, ...assert, strict: assert },
      "node:assert/strict": { default: assert, ...assert },
      "node:test": { default: testApi.test, ...testApi },
      "node:fs": { default: fsMod, ...fsMod },
      "node:fs/promises": { default: fsMod.promises, ...fsMod.promises },
      "node:path": { default: pathMod, ...pathMod },
      "node:url": { default: urlMod, ...urlMod },
      "node:process": { default: processObj, ...processObj },
      "node:os": { default: { EOL: "\n", platform: () => "linux", homedir: () => sh.env.HOME }, EOL: "\n", platform: () => "linux", homedir: () => sh.env.HOME },
    };
    for (const k of Object.keys(builtins)) if (k !== "node:test") builtins[k.slice(5)] = builtins[k];

    class ModuleNotFound extends Error {
      constructor(spec, from) {
        const pkg = !spec.startsWith(".") && !spec.startsWith("/");
        super(pkg ? `Cannot find package '${spec}' imported from ${from}` : `Cannot find module '${pathMod.resolve(pathMod.dirname(from), spec)}' imported from ${from}`);
        this.code = "ERR_MODULE_NOT_FOUND";
        this.name = "Error";
      }
    }
    async function load(absPath) {
      if (cache.has(absPath)) return cache.get(absPath).exports;
      const src = sh.fs.text(absPath);
      const mod = { exports: {} };
      cache.set(absPath, mod);
      const { code, esm } = transform(src, absPath);
      const exportsObj = esm ? Object.create(null) : mod.exports;
      const dir = absPath.slice(0, absPath.lastIndexOf("/"));
      const importer = (spec) => importFrom(spec, absPath);
      // require(): built-in modules and JSON files (node -e and node -p code is CommonJS, so it often uses these)
      const requireFn = (spec) => {
        if (builtins[spec]) return builtins[spec].default;
        const base = absPath.startsWith("/tmp/[eval]") ? sh.cwd : dir;
        const target = pathMod.resolve(base, spec);
        if ((spec.startsWith(".") || spec.startsWith("/")) && target.endsWith(".json")) {
          const t = sh.fs.text(target);
          if (t === null) throw Object.assign(new Error(`Cannot find module '${spec}'`), { code: "MODULE_NOT_FOUND" });
          return JSON.parse(t);
        }
        throw new Error(`require() of ${spec} isn't supported in the sandbox: use import (or require a .json file)`);
      };
      const fn = new AsyncFunction("__import", "__exports", "require", "module", "exports", "__filename", "__dirname", "process", "console",
        "setTimeout", "clearTimeout", "setInterval", "clearInterval", "fetch",
        code + "\n//# sourceURL=" + fileUrl(absPath));
      if (esm) mod.exports = exportsObj;
      await fn(importer, exportsObj, requireFn, mod, mod.exports, absPath, dir, processObj, consoleObj, st, ct, si, ct, undefined);
      if (!esm && mod.exports && typeof mod.exports === "object" && !("default" in mod.exports)) mod.exports = { ...mod.exports, default: mod.exports };
      return mod.exports;
    }
    async function importFrom(spec, from) {
      if (builtins[spec]) return builtins[spec];
      if (spec.startsWith("node:")) throw Object.assign(new Error(`No such built-in module: ${spec}`), { code: "ERR_UNKNOWN_BUILTIN_MODULE" });
      if (!spec.startsWith(".") && !spec.startsWith("/")) throw new ModuleNotFound(spec, from);
      const abs = pathMod.resolve(pathMod.dirname(from), spec);
      if (!sh.fs.exists(abs) || sh.fs.isDir(abs)) throw new ModuleNotFound(spec, from);
      return load(abs);
    }

    // Uncaught errors: print like Node.js (source line, caret, error, stack) and exit 1.
    const reportUncaught = (err) => {
      if (err instanceof NodeExit) return err.code;
      const frames = userFrames(err);
      let head = "";
      if (frames[0]) {
        const lines = (sh.fs.text(frames[0].file.slice(7)) ?? "").split("\n");
        const srcLine = lines[frames[0].line - 1];
        if (srcLine !== undefined) head = `${frames[0].file}:${frames[0].line}\n${srcLine}\n${" ".repeat(Math.max(0, frames[0].col - 1))}^\n\n`;
      }
      if (err instanceof SyntaxError && !frames.length) head = "";
      let body;
      if (err && err.code === "ERR_MODULE_NOT_FOUND") body = `node:internal/modules/run_main:123\n    triggerUncaughtException(\n    ^\n\n${err.name} [ERR_MODULE_NOT_FOUND]: ${err.message}\n    at file:///home (sandbox) {\n  code: 'ERR_MODULE_NOT_FOUND'\n}`;
      else body = inspectError(err);
      io.err(`${head}${body}\n\nNode.js ${rel.version}\n`);
      return 1;
    };

    const finish = async () => {
      for (let k = 0; k < 50 && timers.size; k++) await new Promise((r) => setTimeout(r, 25));
      for (const id of timers) clearTimeout(id);
      await Promise.all(pending);
    };

    if (mode === "run") {
      const [script] = argv;
      const abs = pathMod.resolve(script);
      if (!sh.fs.exists(abs) || sh.fs.isDir(abs)) {
        io.err(`node:internal/modules/cjs/loader:1386\n  throw err;\n  ^\n\nError: Cannot find module '${abs}'\n    at Module._resolveFilename (node:internal/modules/cjs/loader:1383:15)\n    at node:internal/main/run_main_module:36:49 {\n  code: 'MODULE_NOT_FOUND',\n  requireStack: []\n}\n\nNode.js ${rel.version}\n`);
        return 1;
      }
      try {
        await load(abs);
        await finish();
        return exitCode;
      } catch (e) {
        await finish().catch(() => {});
        return reportUncaught(e);
      }
    }

    // node --test
    const t0 = fakeMs(files.join("|"), 38, 30);
    for (const f of files) {
      runner.setFile(f, f.startsWith(sh.cwd + "/") ? f.slice(sh.cwd.length + 1) : f);
      try {
        await load(f);
        await runner.runCollected();
      } catch (e) {
        if (e instanceof NodeExit) { if (e.code) runner.fileFailed(f, new Error(`Process exited with code ${e.code}`)); continue; }
        runner.fileFailed(f, e);
      }
      cache.clear();
    }
    await finish();
    const total = Number((t0 + runner.stats.tests * 0.9).toFixed(6));
    const summary = runner.summary(sh.cwd, total);
    io.out(summary);   // the spec reporter writes everything to stdout
    return runner.stats.fail ? 1 : 0;
  }

  // The test files node --test finds by default (Node.js 24): *.test.js, *-test.js, *_test.js, test-*.js, test.js,
  // and any .js file in a test folder, at any depth, outside node_modules (also .mjs and .cjs).
  function findTestFiles(sh, args) {
    const ext = /\.(?:c|m)?js$/;
    const isTest = (rel) => {
      if (rel.split("/").includes("node_modules")) return false;
      const base = rel.split("/").pop();
      if (!ext.test(base)) return false;
      const stem = base.replace(ext, "");
      return /\.test$/.test(stem) || /-test$/.test(stem) || /_test$/.test(stem) || /^test-/.test(stem) || stem === "test" || rel.split("/").slice(0, -1).includes("test");
    };
    if (args.length) {
      const out = [];
      for (const a of args) {
        const abs = sh.abs(a);
        if (sh.fs.isDir(abs)) out.push(...sh.fs.walkFiles(abs).filter((f) => isTest(f.slice(abs.length + 1))));
        else if (/[*?]/.test(a)) {
          const re = new RegExp("^" + a.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\//g, "(?:.*/)?").replace(/\*/g, "[^/]*").replace(/\?/g, ".") + "$");
          out.push(...sh.fs.walkFiles(sh.cwd).filter((f) => re.test(f.slice(sh.cwd.length + 1))));
        } else out.push(abs);
      }
      return out;
    }
    return sh.fs.walkFiles(sh.cwd).filter((f) => isTest(f.slice(sh.cwd.length + 1)));
  }

  registerCommand("node", async (sh, args, io) => {
    const rel = release(sh);
    if (!args.length) { io.err("The sandbox's node has no interactive prompt (REPL): run a file, like node app.js\n"); return 1; }
    if (args[0] === "--version" || args[0] === "-v") { io.out(rel.version + "\n"); return 0; }
    if (args[0] === "-e" || args[0] === "--eval" || args[0] === "-p" || args[0] === "--print") {
      const src = args[0].startsWith("-p") || args[0] === "--print" ? `console.log(${args[1] ?? "undefined"});` : (args[1] ?? "");
      const tmp = `/tmp/[eval]-${Math.abs(src.length)}.mjs`;
      await sh.fs.writeFile(tmp, src);
      return runProcess(sh, io, [tmp, ...args.slice(2)]);
    }
    if (args[0] === "--check" || args[0] === "-c") {
      const abs = sh.abs(args[1] ?? "");
      const src = sh.fs.text(abs);
      if (src === null) { io.err(`node:internal/modules/cjs/loader\nError: Cannot find module '${abs}'\n\nNode.js ${rel.version}\n`); return 1; }
      try { new AsyncFunction(transform(src, abs).code); return 0; } catch (e) {
        io.err(`${fileUrl(abs)}\n\n${e.name}: ${e.message}\n\nNode.js ${rel.version}\n`);
        return 1;
      }
    }
    if (args[0] === "--test") {
      const files = findTestFiles(sh, args.slice(1).filter((a) => !a.startsWith("--")));
      if (!files.length) {
        io.out(["tests", "suites", "pass", "fail", "cancelled", "skipped", "todo"].map((k) => `ℹ ${k} 0\n`).join("") + `ℹ duration_ms ${fakeMs("none", 3, 2)}\n`);
        return 0;
      }
      for (const f of files) if (!sh.fs.exists(f)) { io.err(`Could not find '${f}'\n`); return 1; }
      return runProcess(sh, io, [], { mode: "test", files });
    }
    if (args[0].startsWith("-")) { io.err(`node: the sandbox supports node FILE, node --test, node --check FILE, node -e CODE and node --version (not ${args[0]})\n`); return 9; }
    return runProcess(sh, io, args);
  });

  /* ------------------------------------------------------------ npm */

  function readPackage(sh) {
    const text = sh.fs.text(sh.cwd + "/package.json");
    if (text === null) return { error: "ENOENT" };
    try { return { pkg: JSON.parse(text) }; } catch (e) { return { error: "EJSONPARSE", message: e.message }; }
  }
  const npmLog = (sh) => `${sh.env.HOME}/.npm/_logs/${new Date(sh.clockSeconds() * 1000).toISOString().replace(/[:.]/g, "_")}-debug-0.log`;
  const npmError = (sh, io, lines) => { io.err(lines.map((l) => `npm error${l ? " " + l : ""}`).join("\n") + `\nnpm error A complete log of this run can be found in: ${npmLog(sh)}\n`); };

  registerCommand("npm", async (sh, args, io) => {
    const rel = release(sh);
    const [cmd, ...rest] = args;
    if (!cmd || cmd === "help") { io.out("npm <command>\n\nIn the sandbox: npm test, npm run <script>, npm ci, npm install, npm --version\n"); return 0; }
    if (cmd === "--version" || cmd === "-v") { io.out(rel.npm + "\n"); return 0; }
    const { pkg, error, message } = readPackage(sh);
    if (error === "ENOENT") {
      npmError(sh, io, ["code ENOENT", "syscall open", `path ${sh.cwd}/package.json`, "errno -2", `enoent Could not read package.json: Error: ENOENT: no such file or directory, open '${sh.cwd}/package.json'`, "enoent This is related to npm not being able to find a file.", "enoent"]);
      return 254;
    }
    if (error) { npmError(sh, io, ["code EJSONPARSE", `JSON.parse Invalid package.json: JSONParseError: ${message}`]); return 1; }
    const id = `${pkg.name ?? "unnamed"}@${pkg.version ?? "1.0.0"}`;
    const scripts = pkg.scripts ?? {};
    if (["ci", "install", "i", "clean-install"].includes(cmd)) {
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      if (Object.keys(deps).length) {
        io.err(`npm: the sandbox can't download packages (${Object.keys(deps).join(", ")}). Run this project on your own computer.\n`);
        return 1;
      }
      if ((cmd === "ci" || cmd === "clean-install") && !sh.fs.exists(sh.cwd + "/package-lock.json")) {
        npmError(sh, io, ["code EUSAGE", "", "The `npm ci` command can only install with an existing package-lock.json or", "npm-shrinkwrap.json with lockfileVersion >= 1. Run an install with npm@5 or", "later to generate a package-lock.json file, then try again.", "", "Clean install a project", "", "Usage:", "npm ci", "", "Options:", "[--install-strategy <hoisted|nested|shallow|linked>] [--legacy-bundling]", "", "aliases: clean-install, ic, install-clean, isntall-clean", "", 'Run "npm help ci" for more info']);
        return 1;
      }
      io.out(`\nup to date, audited 1 package in ${Math.round(fakeMs(id, 80, 90))}ms\n\nfound 0 vulnerabilities\n`);
      return 0;
    }
    let event, extra = [];
    if (cmd === "test" || cmd === "t" || cmd === "tst") { event = "test"; extra = rest; }
    else if (cmd === "start") { event = "start"; extra = rest; }
    else if (cmd === "run" || cmd === "run-script" || cmd === "rum" || cmd === "urn") {
      if (!rest.length) {
        const LIFE = ["prepare", "prepublishOnly", "prepack", "postpack", "dependencies", "preinstall", "install", "postinstall", "prepublish", "publish", "postpublish", "prerestart", "restart", "postrestart", "prestart", "start", "poststart", "prestop", "stop", "poststop", "pretest", "test", "posttest", "preuninstall", "uninstall", "postuninstall", "preversion", "version", "postversion"];
        const entries = Object.entries(scripts);
        const cmds = entries.filter(([k]) => LIFE.includes(k)), others = entries.filter(([k]) => !LIFE.includes(k));
        let out = "";
        if (cmds.length) { out += `Lifecycle scripts included in ${id}:\n`; for (const [k, v] of cmds) out += `  ${k}\n    ${v}\n`; }
        if (others.length) { out += cmds.length ? "available via `npm run`:\n" : `Scripts available in ${id} via \`npm run\`:\n`; for (const [k, v] of others) out += `  ${k}\n    ${v}\n`; }
        io.out(out);
        return 0;
      }
      [event, ...extra] = rest;
      if (extra[0] === "--") extra = extra.slice(1);
    } else {
      io.err(`npm: the sandbox supports npm test, npm run <script>, npm start, npm ci and npm install (not npm ${cmd})\n`);
      return 1;
    }
    if (!Object.prototype.hasOwnProperty.call(scripts, event)) {
      npmError(sh, io, [`Missing script: "${event}"`, "", "To see a list of scripts, run:", "  npm run"]);
      return 1;
    }
    const events = [[event, extra]];
    if (scripts[`pre${event}`]) events.unshift([`pre${event}`, []]);
    if (scripts[`post${event}`]) events.push([`post${event}`, []]);
    for (const [ev, evArgs] of events) {
      const command = scripts[ev] + (evArgs.length ? " " + evArgs.join(" ") : "");
      io.out(`\n> ${id} ${ev}\n> ${scripts[ev].trim().replace(/\n/g, "\n> ")}${evArgs.length ? " " + evArgs.join(" ") : ""}\n\n`);
      // npm runs scripts with sh -c, with node_modules/.bin on the PATH and npm_* variables set
      const savedEnv = { ...sh.env };
      Object.assign(sh.env, { npm_lifecycle_event: ev, npm_package_name: pkg.name ?? "", npm_package_version: pkg.version ?? "" });
      let status;
      try {
        status = await sh.through(io, () => sh.runScript(command, { echo: false, errexit: false }));
      } finally { sh.env = savedEnv; }
      if (status !== 0) return status;
    }
    return 0;
  });
}
