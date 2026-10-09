/* Runs learner JavaScript and exercise checks. The same file runs in the browser (inside a Web Worker) and in
   the Node.js test harness, so what the tests verify is exactly what learners get.

   run(src, stdin)          -> { ok, parts: [[kind, text], ...], figures: [] }
   check(src, checkSrc, stdin) -> run() fields plus verdict { ok, msg }

   Learner code runs inside an async function (so top-level `await` works) with its own console, prompt() and
   timers. After the code finishes, the runner waits for pending timers and promises (up to a time limit), so
   setTimeout and async examples print everything before the result is returned. */

const AsyncFunction = (async function () {}).constructor;
const WAIT_LIMIT_MS = 5000;           // how long to wait for timers and promises after the code finishes
const MAX_OUTPUT = 200_000;           // characters of output kept

/* ---------------------------------------------------------------- printing values (close to Node.js) */

const IDENT = /^[A-Za-z_$][\w$]*$/;

function quote(s) {
  if (!s.includes("'")) return `'${s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n")}'`;
  if (!s.includes('"')) return `"${s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n")}"`;
  return "`" + s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\n/g, "\\n") + "`";
}

function keyText(k) {
  return typeof k === "symbol" ? `[${k.toString()}]` : IDENT.test(k) ? k : quote(k);
}

export function inspect(value, depth = 2, seen = new Set(), top = true) {
  const t = typeof value;
  if (value === null) return "null";
  if (t === "undefined") return "undefined";
  if (t === "string") return top ? value : quote(value);
  if (t === "number") return Object.is(value, -0) ? "-0" : String(value);
  if (t === "bigint") return `${value}n`;
  if (t === "boolean") return String(value);
  if (t === "symbol") return value.toString();
  if (t === "function") {
    if (/^class[\s{]/.test(Function.prototype.toString.call(value))) return `[class ${value.name || "(anonymous)"}]`;
    return value.name ? `[Function: ${value.name}]` : "[Function (anonymous)]";
  }
  if (seen.has(value)) return "[Circular *1]";
  if (value instanceof Error) return value.stack && top ? cleanStack(value) : `${value.name}: ${value.message}`;
  if (value instanceof Date) return isNaN(value) ? "Invalid Date" : value.toISOString();
  if (value instanceof RegExp) return String(value);
  if (typeof Temporal !== "undefined" && value && Object.prototype.toString.call(value).startsWith("[object Temporal.")) {
    return `${Object.prototype.toString.call(value).slice(8, -1)} <${value.toString()}>`;
  }
  if (value instanceof Promise) return "Promise { … }";
  if (typeof Node !== "undefined" && value instanceof Node) {         // the page preview: show elements like the browser console
    if (value.nodeType === 1) { const tag = /^<[^>]*>/.exec(value.outerHTML); return tag ? tag[0] : `<${value.localName}>`; }
    if (value.nodeType === 3) return `#text ${quote(value.data)}`;
    if (value.nodeType === 9) return "#document";
    return `[${value.nodeName}]`;
  }
  if (value instanceof WeakMap) return "WeakMap { <items unknown> }";
  if (value instanceof WeakSet) return "WeakSet { <items unknown> }";
  seen.add(value);
  try {
    const inner = (v) => inspect(v, depth - 1, seen, false);
    let items, open, close, prefix = "";
    const domList = typeof NodeList !== "undefined" && (value instanceof NodeList || value instanceof HTMLCollection);
    if (Array.isArray(value) || domList) {
      if (depth < 0) return domList ? `[${value.constructor.name}]` : "[Array]";
      if (domList) prefix = `${value.constructor.name}(${value.length}) `;
      items = [];
      let holes = 0;
      for (let i = 0; i < value.length; i++) {
        if (!(i in value)) { holes++; continue; }
        if (holes) { items.push(`<${holes} empty item${holes > 1 ? "s" : ""}>`); holes = 0; }
        items.push(inner(value[i]));
      }
      if (holes) items.push(`<${holes} empty item${holes > 1 ? "s" : ""}>`);
      if (items.length > 100) items = [...items.slice(0, 100), `... ${items.length - 100} more items`];
      open = "["; close = "]";
    } else if (value instanceof Map) {
      if (depth < 0) return "[Map]";
      items = [...value].map(([k, v]) => `${inner(k)} => ${inner(v)}`);
      prefix = `Map(${value.size}) `; open = "{"; close = "}";
    } else if (value instanceof Set) {
      if (depth < 0) return "[Set]";
      items = [...value].map(inner);
      prefix = `Set(${value.size}) `; open = "{"; close = "}";
    } else if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
      items = Array.from(value, (v) => inspect(v, 0, seen, false));
      prefix = `${value.constructor.name}(${value.length}) `; open = "["; close = "]";
    } else {
      const proto = Object.getPrototypeOf(value);
      const name = proto === null ? "[Object: null prototype]" : proto.constructor && proto.constructor !== Object ? proto.constructor.name : "";
      if (depth < 0) return name && !name.startsWith("[") ? `[${name}]` : "[Object]";
      const keys = [...Object.keys(value), ...Object.getOwnPropertySymbols(value).filter((s) => Object.prototype.propertyIsEnumerable.call(value, s))];
      items = keys.map((k) => {
        const d = Object.getOwnPropertyDescriptor(value, k);
        const shown = d && d.get ? (d.set ? "[Getter/Setter]" : "[Getter]") : inner(value[k]);
        return `${keyText(k)}: ${shown}`;
      });
      prefix = name ? `${name} ` : ""; open = "{"; close = "}";
    }
    if (!items.length) return `${prefix}${open}${close}`;
    const one = `${prefix}${open} ${items.join(", ")} ${close}`;
    if (one.length <= 72 && !one.includes("\n")) return one;
    const pad = (s) => s.split("\n").map((ln) => "  " + ln).join("\n");
    return `${prefix}${open}\n${items.map(pad).join(",\n")}\n${close}`;
  } finally {
    seen.delete(value);
  }
}

function format(args) {
  if (typeof args[0] === "string" && /%[sdifoOjc%]/.test(args[0])) {
    let i = 1;
    const first = args[0].replace(/%([sdifoOjc%])/g, (m, f) => {
      if (f === "%") return "%";
      if (i >= args.length) return m;
      const v = args[i++];
      if (f === "s") return typeof v === "string" ? v : inspect(v, 1, new Set(), false);
      if (f === "d" || f === "i") return String(f === "i" ? parseInt(v) : Number(v));
      if (f === "f") return String(parseFloat(v));
      if (f === "c") return "";
      return inspect(v, 2, new Set(), false);
    });
    args = [first, ...args.slice(i)];
  }
  return args.map((a) => inspect(a)).join(" ");
}

/* ---------------------------------------------------------------- errors */

const LINE_OFFSET = 3;     // lines the Function constructor and the runner add before the learner's first line

function errorLine(e) {
  const m = /main\.js:(\d+):(\d+)/.exec(String(e && e.stack || ""));
  return m ? Math.max(1, Number(m[1]) - LINE_OFFSET) : null;
}

function cleanStack(e) {
  return `${e.name || "Error"}: ${e.message}`;
}

const HINTS = {
  ReferenceError: "Hint: a name isn't defined here. Check the spelling and capitals, and that you declared it (with let, const or function) before using it.",
  TypeError: "Hint: a value isn't the type this operation needs, often undefined or null. console.log the value just before this line to see what it really is.",
  SyntaxError: "Hint: JavaScript couldn't read the code. Look for a missing bracket, quote or comma near the reported spot.",
  RangeError: "Hint: a number is out of range, or a function called itself too many times (missing base case?).",
};

function report(e, src, lineHint) {
  if (!(e instanceof Error)) return `Uncaught ${inspect(e, 2, new Set(), false)}`;
  const line = lineHint === undefined ? errorLine(e) : lineHint;
  const lines = src.split("\n");
  let text = `${e.name}: ${e.message}`;
  if (line && line <= lines.length && (e.name !== "SyntaxError" || lineHint)) {
    text = `Line ${line}: ${lines[line - 1].trim()}\n${text}`;
  }
  let hint = HINTS[e.name] || "";
  if (/is not a function/.test(e.message)) hint = "Hint: you called something that isn't a function. Check the name, and whether you meant a property (no parentheses).";
  if (/Cannot read properties of (undefined|null)/.test(e.message)) hint = "Hint: you used a property of undefined or null. The value on the left of the dot doesn't exist yet: console.log it to check.";
  if (/(Cannot (read|set) properties of null|null is not an object)/.test(e.message) && typeof document !== "undefined") {
    hint = "Hint: something is null, which often means querySelector found no element. Check the selector's spelling (# for an id, . for a class), and that the element exists before the script runs.";
  }
  if (/before initialization/.test(e.message)) hint = "Hint: a let or const variable was used before the line that declares it.";
  if (/Assignment to constant/.test(e.message)) hint = "Hint: a const can't be reassigned. Use let if the value needs to change.";
  if (/Maximum call stack/.test(e.message)) hint = "Hint: the recursion never stops (or goes too deep). Check that every path reaches a base case.";
  if (/\b(Temporal|getOrInsert(Computed)?|sumPrecise|rawJSON|fromAsync|isError|toBase64|fromBase64)\b/.test(e.message)
      && /is not defined|is not a function/.test(e.message)) {
    hint = "Hint: this uses a recent JavaScript feature that your browser doesn't support yet. Update your browser, or try the latest Chrome, Edge or Firefox.";
  }
  return hint ? `${text}\n${hint}` : text;
}

/* ---------------------------------------------------------------- running code */

function makeEnv(parts, stdin, onPush) {
  let size = 0;
  const push = (kind, text) => {
    if (size > MAX_OUTPUT) return;
    size += text.length;
    if (onPush) onPush(kind, text);
    const last = parts[parts.length - 1];
    if (last && last[0] === kind) last[1] += text; else parts.push([kind, text]);
    if (size > MAX_OUTPUT) parts.push(["err", "\n(output cut off: your code printed a lot)\n"]);
  };
  const counts = new Map(), timersStart = new Map();
  let groupIndent = "";
  const write = (kind) => (...args) => push(kind, groupIndent + format(args).split("\n").join("\n" + groupIndent) + "\n");
  const console = {
    log: write("out"), info: write("out"), debug: write("out"),
    warn: write("err"), error: write("err"),
    table(data) {
      if (data === null || typeof data !== "object") return console.log(data);
      const rows = Array.isArray(data) ? data.map((v, i) => [i, v]) : Object.entries(data);
      const cols = [];
      for (const [, v] of rows) if (v && typeof v === "object") for (const k of Object.keys(v)) if (!cols.includes(k)) cols.push(k);
      const hasValues = rows.some(([, v]) => v === null || typeof v !== "object");
      const head = ["(index)", ...cols, ...(hasValues ? ["Values"] : [])];
      const body = rows.map(([k, v]) => [String(k), ...cols.map((c) => (v && typeof v === "object" && c in v ? inspect(v[c], 0, new Set(), false) : "")),
        ...(hasValues ? [v !== null && typeof v === "object" ? "" : inspect(v, 0, new Set(), false)] : [])]);
      const w = head.map((h, i) => Math.max(h.length, ...body.map((r) => r[i].length)) + 2);
      const line = (l, m, r) => l + w.map((n) => "─".repeat(n)).join(m) + r;
      const row = (cells) => "│" + cells.map((c, i) => c.padStart(Math.floor((w[i] + c.length) / 2)).padEnd(w[i])).join("│") + "│";
      push("out", [line("┌", "┬", "┐"), row(head), line("├", "┼", "┤"), ...body.map(row), line("└", "┴", "┘")].join("\n") + "\n");
    },
    dir: (v) => push("out", inspect(v) + "\n"),
    assert: (cond, ...msg) => { if (!cond) push("err", "Assertion failed" + (msg.length ? ": " + format(msg) : "") + "\n"); },
    count: (label = "default") => { counts.set(label, (counts.get(label) || 0) + 1); push("out", `${label}: ${counts.get(label)}\n`); },
    countReset: (label = "default") => counts.delete(label),
    group: (...label) => { if (label.length) push("out", groupIndent + format(label) + "\n"); groupIndent += "  "; },
    groupEnd: () => { groupIndent = groupIndent.slice(2); },
    time: (label = "default") => timersStart.set(label, performance.now()),
    timeEnd: (label = "default") => {
      if (!timersStart.has(label)) return;
      push("out", `${label}: ${(performance.now() - timersStart.get(label)).toFixed(3)}ms\n`);
      timersStart.delete(label);
    },
    clear: () => { parts.length = 0; },
  };
  console.groupCollapsed = console.group;
  console.timeLog = (label = "default") => timersStart.has(label) && push("out", `${label}: ${(performance.now() - timersStart.get(label)).toFixed(3)}ms\n`);

  const lines = stdin ? stdin.split("\n") : [];
  const prompt = (message = "") => {
    if (!lines.length) throw new Error("prompt() ran out of input. Add one line per call in the Input box.");
    const v = lines.shift();
    push("out", `${message}${message && !/\s$/.test(message) ? " " : ""}${v}\n`);
    return v;
  };

  // Timers the runner can wait for (and clear) once the code has finished.
  const active = new Map();
  let errors = [];
  const guard = (fn) => (...a) => {
    try {
      const r = fn(...a);
      if (r && typeof r.then === "function") r.then(null, (e) => errors.push(e));
    } catch (e) { errors.push(e); }
  };
  const realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout;
  const realInterval = globalThis.setInterval, realClearInterval = globalThis.clearInterval;
  const setTimeout = (fn, ms = 0, ...args) => {
    const id = realSet(() => { active.delete(id); if (typeof fn === "function") guard(fn)(...args); }, ms);
    active.set(id, "timeout");
    return id;
  };
  const clearTimeout = (id) => { if (active.get(id) === "timeout") { active.delete(id); realClear(id); } };
  const setInterval = (fn, ms = 0, ...args) => {
    const id = realInterval(() => { if (typeof fn === "function") guard(fn)(...args); }, Math.max(ms, 1));
    active.set(id, "interval");
    return id;
  };
  const clearInterval = (id) => { if (active.get(id) === "interval") { active.delete(id); realClearInterval(id); } };
  const clearAll = () => {
    for (const [id, kind] of active) {
      if (kind === "interval") realClearInterval(id);
      else if (kind === "timeout") realClear(id);
    }
    active.clear();
  };
  const fetch = makeFakeShop((fn, ms) => {
    const id = setTimeout(fn, ms);
    return { cancel: () => clearTimeout(id) };
  });
  const testing = makeTesting(push, active);
  return {
    console, prompt, setTimeout, clearTimeout, setInterval, clearInterval, active, clearAll, fetch, testing,
    takeErrors: () => { const e = errors; errors = []; return e; },
    addError: (e) => errors.push(e),
    push,
  };
}

/* ---------------------------------------------------------------- test, describe, it and assert

   The testing lesson's code can use these without importing them. They follow node:test and node:assert/strict
   (a subset), and print like Node.js's test reporter: ✔ for a passing test, ✖ and the reason for a failing one. */

class TestAssertionError extends Error {
  constructor(message) { super(message); this.name = "AssertionError"; this.code = "ERR_ASSERTION"; }
}

function strictDeepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  if (a instanceof Date) return Object.is(a.getTime(), b.getTime());
  if (a instanceof Map || a instanceof Set) {
    if (a.size !== b.size) return false;
    if (a instanceof Set) { for (const v of a) if (!b.has(v)) return false; return true; }
    for (const [k, v] of a) if (!b.has(k) || !strictDeepEqual(v, b.get(k))) return false;
    return true;
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && strictDeepEqual(a[k], b[k]));
}

function makeAssert() {
  const show = (v) => inspect(v, 3, new Set(), false);
  const fail = (message, fallback) => {
    if (message instanceof Error) throw message;
    throw new TestAssertionError(message ?? fallback);
  };
  function matches(error, expected) {
    if (expected === undefined) return true;
    if (expected instanceof RegExp) return expected.test(String(error && error.message !== undefined ? error.message : error));
    if (typeof expected === "function") {
      if (expected.prototype !== undefined && error instanceof expected) return true;
      if (Error.isPrototypeOf(expected) || expected === Error) return false;
      return expected(error) === true;
    }
    if (typeof expected === "object" && expected !== null) {
      return Object.keys(expected).every((k) => expected[k] instanceof RegExp
        ? expected[k].test(String(error?.[k])) : strictDeepEqual(error?.[k], expected[k]));
    }
    return false;
  }
  const assert = (value, message) => { if (!value) fail(message, `The expression evaluated to a falsy value:\n\n  ${show(value)}\n`); };
  assert.ok = assert;
  assert.equal = assert.strictEqual = (actual, expected, message) => {
    if (!Object.is(actual, expected)) fail(message, `Expected values to be strictly equal:\n\n${show(actual)} !== ${show(expected)}\n`);
  };
  assert.notEqual = assert.notStrictEqual = (actual, expected, message) => {
    if (Object.is(actual, expected)) fail(message, `Expected "actual" to be strictly unequal to: ${show(expected)}`);
  };
  assert.deepEqual = assert.deepStrictEqual = (actual, expected, message) => {
    if (!strictDeepEqual(actual, expected)) {
      fail(message, `Expected values to be strictly deep-equal:\n+ actual - expected\n\n+ ${show(actual)}\n- ${show(expected)}\n`);
    }
  };
  assert.notDeepEqual = assert.notDeepStrictEqual = (actual, expected, message) => {
    if (strictDeepEqual(actual, expected)) fail(message, `Expected "actual" not to be strictly deep-equal to: ${show(expected)}`);
  };
  assert.match = (string, regexp, message) => {
    if (typeof string !== "string" || !regexp.test(string)) fail(message, `The input did not match the regular expression ${regexp}. Input:\n\n${show(string)}\n`);
  };
  assert.throws = (fn, expected, message) => {
    if (typeof expected === "string") { message = expected; expected = undefined; }
    try { fn(); } catch (e) {
      if (!matches(e, expected)) fail(message, `The error didn't match what was expected. It was:\n\n${show(e)}\n`);
      return;
    }
    fail(message, "Missing expected exception.");
  };
  assert.rejects = async (promiseOrFn, expected, message) => {
    if (typeof expected === "string") { message = expected; expected = undefined; }
    try { await (typeof promiseOrFn === "function" ? promiseOrFn() : promiseOrFn); } catch (e) {
      if (!matches(e, expected)) fail(message, `The rejection didn't match what was expected. It was:\n\n${show(e)}\n`);
      return;
    }
    fail(message, "Missing expected rejection.");
  };
  assert.fail = (message = "Failed") => fail(message);
  assert.AssertionError = TestAssertionError;
  return assert;
}

function makeTesting(push, active) {
  const stats = { tests: 0, pass: 0, fail: 0, suites: 0 };
  let queue = Promise.resolve(), collecting = null, running = 0;
  const token = Symbol("tests");
  const ms = (t0) => `${(performance.now() - t0).toFixed(1)}ms`;
  const indent = (text, pad) => text.split("\n").map((ln) => (ln ? pad + ln : ln)).join("\n");

  async function runTest(name, fn, depth) {
    const pad = "  ".repeat(depth), t0 = performance.now();
    stats.tests++;
    try {
      await fn();
      stats.pass++;
      push("out", `${pad}✔ ${name} (${ms(t0)})\n`);
    } catch (e) {
      stats.fail++;
      const why = e instanceof Error ? `${e.name}: ${e.message}` : `thrown: ${inspect(e, 2, new Set(), false)}`;
      push("err", `${pad}✖ ${name} (${ms(t0)})\n${indent(why.trimEnd(), pad + "    ")}\n`);
    }
  }
  async function runSuite(name, fn, depth) {
    const pad = "  ".repeat(depth);
    stats.suites++;
    const children = [], outer = collecting;
    collecting = children;
    try {
      fn();
    } catch (e) {
      stats.fail++;
      push("err", `${pad}✖ ${name}\n${indent(`${e && e.name}: ${e && e.message}`, pad + "    ")}\n`);
      return;
    } finally {
      collecting = outer;
    }
    push("out", `${pad}▶ ${name}\n`);
    for (const child of children) await child(depth + 1);
  }
  function enqueue(job) {
    if (collecting) { collecting.push(job); return Promise.resolve(); }
    running++;
    active.set(token, "tests");
    const p = queue.then(() => job(0));
    queue = p.catch(() => {}).finally(() => { if (--running === 0) active.delete(token); });
    return queue;
  }
  const test = (name, fn) => enqueue((depth) => runTest(name, fn, depth));
  const describe = (name, fn) => enqueue((depth) => runSuite(name, fn, depth));
  const summary = () => stats.tests
    ? `ℹ tests ${stats.tests}${stats.suites ? ` · suites ${stats.suites}` : ""} · pass ${stats.pass} · fail ${stats.fail}\n` : "";
  return { test, describe, it: test, assert: makeAssert(), stats, summary };
}

/* ---------------------------------------------------------------- a pretend web API for the async lessons

   fetch("https://shop.example/api/...") is answered here, in the sandbox, after a short delay, so lessons can
   use the real fetch API without a server. Any other URL goes to the real network. */

const PRODUCTS = [
  { id: 1, name: "Inner tube", category: "parts", price: 600, stock: 42 },
  { id: 2, name: "Bell", category: "accessories", price: 800, stock: 15 },
  { id: 3, name: "Tubeless tyre", category: "parts", price: 4500, stock: 0 },
  { id: 4, name: "Floor pump", category: "tools", price: 3200, stock: 7 },
  { id: 5, name: "Bike lock", category: "accessories", price: 2900, stock: 22 },
  { id: 6, name: "Puncture kit", category: "tools", price: 450, stock: 60 },
];

function makeFakeShop(schedule, realFetch = globalThis.fetch.bind(globalThis)) {
  const flaky = new Map();
  const orders = [{ id: 1001, customer: "Ada", items: [{ productId: 2, qty: 1 }], total: 800 }];
  const json = (status, body, headers = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

  function wait(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason ?? new DOMException("The operation was aborted.", "AbortError"));
      const id = schedule(resolve, ms);
      signal?.addEventListener("abort", () => {
        id.cancel();
        reject(signal.reason ?? new DOMException("The operation was aborted.", "AbortError"));
      }, { once: true });
    });
  }

  async function route(url, method, body) {
    const path = url.pathname;
    let m;
    if (path === "/api/products" && method === "GET") {
      const cat = url.searchParams.get("category");
      const q = url.searchParams.get("q")?.trim().toLowerCase();
      const max = url.searchParams.get("maxPrice");
      return json(200, PRODUCTS.filter((p) => (!cat || p.category === cat)
        && (!q || p.name.toLowerCase().includes(q)) && (max === null || p.price <= Number(max))));
    }
    if ((m = /^\/api\/products\/(\d+)$/.exec(path)) && method === "GET") {
      const product = PRODUCTS.find((p) => p.id === Number(m[1]));
      return product ? json(200, product) : json(404, { error: `No product with id ${m[1]}` });
    }
    if (path === "/api/orders" && method === "GET") {
      const who = url.searchParams.get("customer");
      return json(200, who ? orders.filter((o) => o.customer === who) : orders);
    }
    if (path === "/api/orders" && method === "POST") {
      let data;
      try { data = JSON.parse(body ?? ""); } catch { return json(400, { error: "Body must be JSON" }); }
      if (typeof data?.customer !== "string" || !data.customer.trim()) return json(400, { error: "customer is required" });
      if (!Array.isArray(data.items) || data.items.length === 0) return json(400, { error: "items must be a non-empty array" });
      let total = 0;
      for (const item of data.items) {
        const product = PRODUCTS.find((p) => p.id === item?.productId);
        if (!product) return json(400, { error: `Unknown productId ${item?.productId}` });
        if (!Number.isInteger(item.qty) || item.qty < 1) return json(400, { error: "qty must be a positive integer" });
        if (item.qty > product.stock) return json(409, { error: `Only ${product.stock} ${product.name} in stock` });
        total += product.price * item.qty;
      }
      const order = { id: 1001 + orders.length, customer: data.customer, items: data.items, total };
      orders.push(order);
      return json(201, order, { location: `/api/orders/${order.id}` });
    }
    if (path === "/api/flaky") {
      const key = url.searchParams.get("key") ?? "default";
      const failures = Number(url.searchParams.get("fail") ?? 2);
      const seen = (flaky.get(key) ?? 0) + 1;
      flaky.set(key, seen);
      return seen <= failures ? json(503, { error: "Service unavailable, try again" }, { "retry-after": "0" })
                              : json(200, { ok: true, attempt: seen });
    }
    if (path === "/api/stream") {
      const words = (url.searchParams.get("text") ?? "Streaming sends a response in small pieces as it's produced.").split(" ");
      const encoder = new TextEncoder();
      let i = 0;
      const stream = new ReadableStream({
        async pull(controller) {
          if (i >= words.length) { controller.close(); return; }
          await wait(15);
          controller.enqueue(encoder.encode((i ? " " : "") + words[i++]));
        },
      });
      return new Response(stream, { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    return json(404, { error: `Not found: ${method} ${path}` });
  }

  /* ---------------------------------------------------------------- a pretend LLM API for Part 8

     POST https://llm.example/v1/messages is answered by a small, rule-based "model" that speaks the same request
     and response format as Anthropic's Messages API (messages, content blocks, tools, tool_use and tool_result,
     stop_reason, usage, and server-sent events when stream is true). It doesn't understand language: it follows
     a few rules about the bike shop, so lessons and exercises get the same answer every time. */
  let llmCalls = 0;
  const flakyCalls = new Map();
  const llmError = (status, type, message, headers = {}) => json(status, { type: "error", error: { type, message } }, headers);
  const KEYWORDS = { tube: "tube", tubes: "tube", inner: "tube", bell: "bell", bells: "bell", tyre: "tyre", tyres: "tyre",
                     tubeless: "tyre", pump: "pump", pumps: "pump", lock: "lock", locks: "lock", puncture: "puncture", kit: "kit" };
  const NUMBER_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const pounds = (pence) => `£${(pence / 100).toFixed(2)}`;
  const blocksOf = (content) => (typeof content === "string" ? [{ type: "text", text: content }] : Array.isArray(content) ? content : []);
  const textOf = (message) => blocksOf(message.content).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const toolResultText = (block) => (typeof block.content === "string" ? block.content
    : blocksOf(block.content).filter((b) => b.type === "text").map((b) => b.text).join("\n"));
  const tryJSON = (text) => { try { return JSON.parse(text); } catch { return undefined; } };

  function validateLLMRequest(data) {
    if (typeof data !== "object" || data === null) return "Body must be a JSON object";
    if (typeof data.model !== "string" || !data.model) return "model: Field required";
    if (data.max_tokens === undefined) return "max_tokens: Field required";
    if (!Number.isInteger(data.max_tokens) || data.max_tokens < 1) return "max_tokens: must be a positive integer";
    if (data.system !== undefined && typeof data.system !== "string") return "system: must be a string";
    if (!Array.isArray(data.messages) || data.messages.length === 0) return "messages: at least one message is required";
    for (const [i, m] of data.messages.entries()) {
      if (m?.role !== "user" && m?.role !== "assistant") return `messages.${i}.role: must be "user" or "assistant"`;
      if (typeof m.content !== "string" && !Array.isArray(m.content)) return `messages.${i}.content: must be a string or a list of content blocks`;
      if (i === 0 && m.role !== "user") return "messages: the first message must use the \"user\" role";
      if (i > 0 && data.messages[i - 1].role === m.role) return `messages: roles must alternate between "user" and "assistant", but messages ${i - 1} and ${i} are both "${m.role}"`;
      const uses = blocksOf(m.content).filter((b) => b.type === "tool_use").map((b) => b.id);
      if (uses.length) {
        const next = data.messages[i + 1];
        const answered = next ? blocksOf(next.content).filter((b) => b.type === "tool_result").map((b) => b.tool_use_id) : [];
        const missing = uses.filter((id) => !answered.includes(id));
        if (missing.length) return `messages.${i + 1}: tool_use ids were found without tool_result blocks immediately after: ${missing.join(", ")}. Each tool_use block must have a corresponding tool_result block in the next message.`;
      }
      for (const b of blocksOf(m.content)) {
        if (b?.type === "tool_result") {
          const prev = data.messages[i - 1];
          const ids = prev ? blocksOf(prev.content).filter((x) => x.type === "tool_use").map((x) => x.id) : [];
          if (!ids.includes(b.tool_use_id)) return `messages.${i}: unexpected tool_use_id found in tool_result blocks: ${b.tool_use_id}. Each tool_result block must have a corresponding tool_use block in the previous message.`;
        } else if (!["text", "tool_use", "tool_result"].includes(b?.type)) {
          return `messages.${i}.content: unsupported content block type ${JSON.stringify(b?.type)}`;
        } else if (b.type === "text" && typeof b.text !== "string") {
          return `messages.${i}.content: a text block needs a "text" string`;
        }
      }
    }
    if (data.messages.at(-1).role !== "user") return "messages: the last message must use the \"user\" role";
    if (data.tools !== undefined) {
      if (!Array.isArray(data.tools)) return "tools: must be a list";
      for (const [i, t] of data.tools.entries()) {
        if (typeof t?.name !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(t.name)) return `tools.${i}.name: must match ^[a-zA-Z0-9_-]{1,64}$`;
        if (typeof t.input_schema !== "object" || t.input_schema === null || t.input_schema.type !== "object") return `tools.${i}.input_schema: must be a JSON Schema with "type": "object"`;
      }
    }
    return null;
  }

  // What the user wants, read from their words.
  function intentOf(text) {
    const lower = text.toLowerCase();
    const words = lower.split(/[^a-z0-9£]+/).filter(Boolean);
    const productWords = [...new Set(words.map((w) => KEYWORDS[w]).filter(Boolean))];
    const productWord = productWords[0] ?? null;
    let qty = 1, qtyIsDozen = false;
    const digits = /\b(\d+)\s*(?:x\s*)?(?:[a-z]+\s+)?(?:inner tubes?|bells?|tyres?|tubeless tyres?|pumps?|floor pumps?|locks?|bike locks?|puncture kits?|kits?)\b/.exec(lower);
    if (/\ba dozen\b/.test(lower)) { qty = 12; qtyIsDozen = true; }
    else if (digits) qty = Number(digits[1]);
    else {
      const w = words.find((x, i) => NUMBER_WORDS[x] && words.slice(i + 1, i + 4).some((y) => KEYWORDS[y]));
      if (w) qty = NUMBER_WORDS[w];
    }
    const under = /\b(?:under|below|less than|cheaper than)\s+£?(\d+(?:\.\d+)?)/.exec(lower);
    const customer = /\b(?:for|name is|i'm|i am)\s+([A-Z][a-z]+)\b/.exec(text);
    return {
      productWord, productWords, qty, qtyIsDozen,
      maxPrice: under ? Math.round(Number(under[1]) * 100) : null,
      order: /\b(order|buy|purchase|get me)\b/.test(lower),
      shopQuestion: Boolean(productWord || under || /\b(price|prices|cost|costs|stock|sell|cheap|cheapest|products?)\b/.test(lower)),
      customer: customer ? customer[1] : null,
    };
  }

  function describeProducts(products, query) {
    if (!Array.isArray(products) || products.length === 0) return `I couldn't find any products matching "${query}".`;
    const one = (p) => `${p.name} (${pounds(p.price)}, ${p.stock > 0 ? `${p.stock} in stock` : "sold out"})`;
    if (products.length === 1) {
      const p = products[0];
      return p.stock > 0 ? `The ${p.name} costs ${pounds(p.price)}, and we have ${p.stock} in stock.`
                         : `The ${p.name} costs ${pounds(p.price)}, but it's sold out at the moment.`;
    }
    return `I found ${products.length} products: ${products.map(one).join(", ")}.`;
  }

  function plainReply(system, messages, text) {
    const lower = text.trim().toLowerCase();
    const userTexts = messages.filter((m) => m.role === "user").map(textOf);
    let reply;
    const repeat = /^repeat:\s*([\s\S]*)$/i.exec(text.trim());
    const count = /\bcount to (\d+)\b/.exec(lower);
    if (repeat) reply = repeat[1];
    else if (count) reply = Array.from({ length: Math.min(Number(count[1]), 500) }, (_, i) => i + 1).join(", ");
    else if (/\bwhat('s| is) my name\b/.test(lower)) {
      const said = userTexts.slice(0, -1).map((t) => /\b[Mm]y name is ([A-Z][a-z]+)/.exec(t)).filter(Boolean).at(-1);
      reply = said ? `Your name is ${said[1]}.` : "I don't know your name: you haven't told me in this conversation.";
    } else if (/\b[Mm]y name is ([A-Z][a-z]+)/.test(text)) {
      reply = `Nice to meet you, ${/\b[Mm]y name is ([A-Z][a-z]+)/.exec(text)[1]}!`;
    } else if (/^(hi|hello|hey)\b/.test(lower)) reply = "Hello! How can I help you with the bike shop today?";
    else if (/capital of france/.test(lower)) reply = "The capital of France is Paris.";
    else {
      const intent = intentOf(text);
      const product = intent.productWord && PRODUCTS.find((p) => p.name.toLowerCase().includes(intent.productWord));
      if (product && /\bjson\b/.test(lower)) {
        reply = "Here it is:\n```json\n" + JSON.stringify({ name: product.name, price: product.price, inStock: product.stock > 0 }, null, 2) + "\n```";
      } else if (intent.shopQuestion) {
        reply = "I can't look that up without a tool: I don't know the shop's current prices or stock.";
      } else {
        reply = "I'm a small simulated model, so I only know a few things. Try asking about the bike shop's products.";
      }
    }
    if (/pirate/i.test(system ?? "")) reply = "Arr! " + reply;
    return reply;
  }

  // Decide the reply: a list of content blocks and a stop reason.
  function respond(data) {
    const { system, messages } = data;
    const tools = data.tools ?? [];
    const has = (name) => tools.some((t) => t.name === name);
    const last = messages.at(-1);
    const textTurns = messages.filter((m) => m.role === "user" && textOf(m).trim());
    const question = textTurns.length ? textOf(textTurns.at(-1)) : "";
    let toolCount = 0;
    for (const m of messages) for (const b of blocksOf(m.content)) if (b.type === "tool_use") toolCount++;
    const toolUses = (calls, preface) => {
      const blocks = preface ? [{ type: "text", text: preface }] : [];
      for (const [name, input] of calls) {
        toolCount++;
        blocks.push({ type: "tool_use", id: `toolu_${String(toolCount).padStart(2, "0")}`, name, input });
      }
      return { content: blocks, stop_reason: "tool_use" };
    };
    const toolUse = (name, input, preface) => toolUses([[name, input]], preface);
    const say = (text) => ({ content: [{ type: "text", text }], stop_reason: "end_turn" });
    const pirate = (r) => (/pirate/i.test(system ?? "") && r.content[0]?.type === "text" ? (r.content[0].text = "Arr! " + r.content[0].text, r) : r);

    // The text request this task started from: if the model just asked for a name, it's the request before that.
    const prevAssistant = messages.length > 1 ? messages.at(-2) : null;
    const askedForName = prevAssistant && /What name should I put the order under\?$/.test(textOf(prevAssistant));
    const results = blocksOf(last.content).filter((b) => b.type === "tool_result");

    if (!tools.length) return say(plainReply(system, messages, question));

    if (results.length) {
      const calls = blocksOf(prevAssistant.content).filter((b) => b.type === "tool_use");
      const call = calls.find((c) => c.id === results[0].tool_use_id) ?? calls[0];
      const result = results[0];
      const resultText = toolResultText(result);
      const intent = intentOf(question);
      if (result.is_error) {
        const earlierError = messages.slice(0, -2).some((m) => blocksOf(m.content).some((b) => b.type === "tool_result" && b.is_error));
        const fixed = Object.fromEntries(Object.entries(call.input ?? {}).map(([k, v]) => [k, typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v]));
        if (!earlierError && JSON.stringify(fixed) !== JSON.stringify(call.input)) {
          return toolUse(call.name, fixed, "Sorry, let me fix that and try again.");
        }
        return pirate(say(`Sorry, I couldn't do that: ${resultText}`));
      }
      const value = tryJSON(resultText);
      if (call.name === "search_products" && results.length > 1) {
        const lists = results.map((r) => tryJSON(toolResultText(r)));
        if (lists.some((l) => !Array.isArray(l))) return say("Sorry, I got a result I couldn't read.");
        const seen = new Set();
        const merged = lists.flat().filter((p) => !seen.has(p.id) && seen.add(p.id));
        return pirate(say(describeProducts(merged, "")));
      }
      if (call.name === "search_products") {
        const products = Array.isArray(value) ? value : value && Array.isArray(value.products) ? value.products : null;
        if (!products) return say("Sorry, I got a result I couldn't read.");
        if (intent.order && has("place_order") && products.length) {
          const p = products.find((x) => x.stock > 0) ?? products[0];
          if (p.stock < intent.qty) return pirate(say(`Sorry, we only have ${p.stock} ${p.name} in stock, so I can't order ${intent.qty}.`));
          const name = intent.customer;
          if (!name) return pirate(say("Sure! What name should I put the order under?"));
          return toolUse("place_order", { customer: name, productId: p.id, qty: intent.qtyIsDozen ? String(intent.qty) : intent.qty });
        }
        return pirate(say(describeProducts(products, call.input?.query ?? "")));
      }
      if (call.name === "place_order" && value && typeof value.id === "number") {
        const items = (value.items ?? []).map((it) => `${it.qty} × ${PRODUCTS.find((p) => p.id === it.productId)?.name ?? "item"}`).join(", ");
        return pirate(say(`Done! Order ${value.id} is placed: ${items}, ${pounds(value.total)} in total.`));
      }
      return pirate(say(`Here's what ${call.name} returned: ${resultText}`));
    }

    // A new request (or the customer's name, if the model just asked for it).
    if (askedForName && has("place_order")) {
      const name = (/([A-Z][a-z]+)/.exec(question) ?? [])[1] ?? question.trim();
      const intent = intentOf(textTurns.length > 1 ? textOf(textTurns.at(-2)) : "");
      let product = null;
      for (const m of messages) for (const b of blocksOf(m.content)) {
        if (b.type === "tool_result" && !b.is_error) {
          const v = tryJSON(toolResultText(b));
          if (Array.isArray(v) && v.length) product = v.find((x) => x.stock > 0) ?? v[0];
        }
      }
      if (product) return toolUse("place_order", { customer: name, productId: product.id, qty: intent.qtyIsDozen ? String(intent.qty) : intent.qty });
    }
    const intent = intentOf(question);
    if (intent.shopQuestion && has("search_products") && !intent.order && intent.productWords.length > 1) {
      return toolUses(intent.productWords.map((query) => ["search_products", { query }]), "Let me look those up.");
    }
    if (intent.shopQuestion && has("search_products")) {
      const input = {};
      if (intent.productWord) input.query = intent.productWord;
      if (intent.maxPrice !== null) input.maxPrice = intent.maxPrice;
      return toolUse("search_products", input, "Let me check the shop.");
    }
    return say(plainReply(system, messages, question));
  }

  const estimateTokens = (text) => Math.max(1, Math.ceil(text.length / 4));

  async function llm(url, method, headers, bodyText, signal) {
    if (url.pathname !== "/v1/messages") return llmError(404, "not_found_error", `Not found: ${method} ${url.pathname}`);
    if (method !== "POST") return llmError(405, "invalid_request_error", `Method ${method} not allowed; use POST`);
    const key = headers.get("x-api-key");
    if (!key) return llmError(401, "authentication_error", "x-api-key header is required");
    if (!key.startsWith("sk-sim-")) return llmError(401, "authentication_error", "invalid x-api-key (the simulated API accepts keys starting with sk-sim-)");
    if (key === "sk-sim-flaky") {
      const n = (flakyCalls.get(key) ?? 0) + 1;
      flakyCalls.set(key, n);
      if (n === 1) return llmError(429, "rate_limit_error", "Too many requests: please slow down", { "retry-after": "0" });
      if (n === 2) return llmError(529, "overloaded_error", "Overloaded");
    }
    const data = tryJSON(bodyText ?? "");
    if (data === undefined) return llmError(400, "invalid_request_error", "Body must be valid JSON");
    const problem = validateLLMRequest(data);
    if (problem) return llmError(400, "invalid_request_error", problem);

    let { content, stop_reason } = respond(data);
    const inputTokens = estimateTokens((data.system ?? "") + JSON.stringify(data.messages) + JSON.stringify(data.tools ?? []));
    let outputTokens = estimateTokens(content.map((b) => (b.type === "text" ? b.text : JSON.stringify(b.input))).join(""));
    if (outputTokens > data.max_tokens && content.every((b) => b.type === "text")) {
      content = [{ type: "text", text: content.map((b) => b.text).join("").slice(0, data.max_tokens * 4) }];
      stop_reason = "max_tokens";
      outputTokens = data.max_tokens;
    }
    const id = `msg_sim_${String(++llmCalls).padStart(4, "0")}`;
    const message = { id, type: "message", role: "assistant", model: data.model, content, stop_reason, stop_sequence: null,
                      usage: { input_tokens: inputTokens, output_tokens: outputTokens } };
    if (!data.stream) return json(200, message);

    // Streaming: server-sent events, delivered in small chunks that don't line up with the events.
    const events = [["message_start", { type: "message_start", message: { ...message, content: [], stop_reason: null, usage: { input_tokens: inputTokens, output_tokens: 1 } } }]];
    content.forEach((block, index) => {
      if (block.type === "text") {
        events.push(["content_block_start", { type: "content_block_start", index, content_block: { type: "text", text: "" } }]);
        for (const piece of block.text.match(/\S+\s*|\s+/g) ?? []) {
          events.push(["content_block_delta", { type: "content_block_delta", index, delta: { type: "text_delta", text: piece } }]);
        }
      } else {
        events.push(["content_block_start", { type: "content_block_start", index, content_block: { ...block, input: {} } }]);
        const jsonText = JSON.stringify(block.input);
        for (let i = 0; i < jsonText.length; i += 12) {
          events.push(["content_block_delta", { type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: jsonText.slice(i, i + 12) } }]);
        }
      }
      events.push(["content_block_stop", { type: "content_block_stop", index }]);
    });
    events.push(["message_delta", { type: "message_delta", delta: { stop_reason, stop_sequence: null }, usage: { output_tokens: outputTokens } }]);
    events.push(["message_stop", { type: "message_stop" }]);
    const sse = events.map(([event, payload]) => `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`).join("");
    const bytes = new TextEncoder().encode(sse);
    let pos = 0;
    const stream = new ReadableStream({
      async pull(controller) {
        if (pos >= bytes.length) { controller.close(); return; }
        await wait(4, signal);
        controller.enqueue(bytes.slice(pos, pos + 37));
        pos += 37;
      },
    });
    return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" } });
  }

  return async function fetch(input, init = {}) {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    let url;
    try { url = new URL(raw, "https://shop.example"); } catch { url = null; }
    if (!url || (url.hostname !== "shop.example" && url.hostname !== "llm.example")) return realFetch(input, init);
    const method = (init.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (url.hostname === "llm.example") {
      const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
      const body = typeof init.body === "string" ? init.body : input instanceof Request && init.body === undefined ? await input.text() : undefined;
      await wait(40, init.signal);
      return llm(url, method, headers, body, init.signal);
    }
    const delay = url.pathname === "/api/slow" ? Number(url.searchParams.get("ms") ?? 500) : 30;
    await wait(delay, init.signal);
    if (url.pathname === "/api/slow") return json(200, { ok: true, waited: delay });
    return route(url, method, typeof init.body === "string" ? init.body : undefined);
  };
}

// Unhandled promise rejections and timer errors are routed to the code that is running now.
let activeEnv = null;
export function reportUnhandled(error) {
  if (activeEnv) activeEnv.addError({ uncaught: true, error });
}

const PARAMS = ["console", "prompt", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "fetch", "test", "describe", "it", "assert", "__extra"];

// view: what to show in error messages when the code that runs isn't what the learner wrote (TypeScript compiled
// to JavaScript): { source: the learner's code, mapLine: line in the running code -> line in source, or null }.
async function execute(src, stdin = "", extra = {}, view = null) {
  const shownSrc = view ? view.source : src;
  const describeError = (e) => {
    if (!view) return report(e, src);
    const jsLine = errorLine(e);
    return report(e, shownSrc, jsLine ? view.mapLine(jsLine) : null);
  };
  const parts = [];
  const env = makeEnv(parts, stdin);
  let ok = true, testsFailed = false, lookup = () => undefined;
  // Learner code becomes the body of an async function (inside a second one, so the learner's own declarations can
  // reuse the sandbox's names, like `it`). The closure at the end lets checks read its variables.
  const body = `"use strict"; return (async () => {\n${src}\n;return (__name) => eval(__name);\n})();\n//# sourceURL=main.js`;
  let fn;
  try {
    fn = new AsyncFunction(...PARAMS, body);
  } catch (e) {
    parts.push(["err", describeError(e)]);
    return { ok: false, parts, lookup, env };
  }
  activeEnv = env;
  try {
    const t = env.testing;
    const finished = fn(env.console, env.prompt, env.setTimeout, env.clearTimeout, env.setInterval, env.clearInterval, env.fetch,
                        t.test, t.describe, t.it, t.assert, extra);
    lookup = await withLimit(finished, WAIT_LIMIT_MS, "Your code is still waiting (for a promise that never settles?) after 5 s, so it was stopped.");
    // Let pending timers, promise callbacks and async work finish, like a real JavaScript program would.
    const t0 = Date.now();
    for (;;) {
      await new Promise((r) => globalThis.setTimeout(r, 0));
      if (!env.active.size || Date.now() - t0 > WAIT_LIMIT_MS) break;
      await new Promise((r) => globalThis.setTimeout(r, 5));
    }
    if (env.active.size) {
      const what = [...env.active.values()].includes("tests") ? "the tests were still running" : "a timer or setInterval was still running. Clear intervals with clearInterval";
      env.clearAll();
      env.push("err", `\n(Stopped waiting after 5 s: ${what}.)\n`);
    }
    if (env.testing.stats.tests) {
      env.push("out", env.testing.summary());
      if (env.testing.stats.fail) { ok = false; testsFailed = true; }
    }
  } catch (e) {
    ok = false;
    env.clearAll();
    parts.push(["err", describeError(e)]);
  }
  for (const e of env.takeErrors()) {
    ok = false;
    const text = e && e.uncaught ? "Uncaught (in promise) " + describeError(e.error) : describeError(e);
    parts.push(["err", (parts.length ? "\n" : "") + text]);
  }
  activeEnv = null;
  return { ok, parts, lookup, env, testsFailed: testsFailed && parts.every(([k, t]) => k !== "err" || /^\s*✖/m.test(t)) };
}

function withLimit(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = globalThis.setTimeout(() => reject(new Error(message)), ms); }),
  ]).finally(() => globalThis.clearTimeout(timer));
}

export async function run(src, stdin = "", extra = {}, view = null) {
  const { ok, parts } = await execute(src, stdin, extra, view);
  return { ok, parts, figures: [] };
}

/* ---------------------------------------------------------------- check helpers */

function short(v, limit = 600) {
  const s = inspect(v, 3, new Set(), false);
  return s.length <= limit ? s : s.slice(0, limit) + " …";
}

export function deepEqual(a, b, tol = 1e-9) {
  if (typeof a === "number" && typeof b === "number") {
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    if (Number.isInteger(a) && Number.isInteger(b)) return a === b && Object.is(a, b) === Object.is(b, a);
    return Math.abs(a - b) <= Math.max(tol * Math.abs(b), 1e-12);
  }
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map && b instanceof Map) || a.size !== b.size) return false;
    for (const [k, v] of b) if (!a.has(k) || !deepEqual(a.get(k), v, tol)) return false;
    return true;
  }
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set && b instanceof Set) || a.size !== b.size) return false;
    for (const v of b) if (!a.has(v)) return false;
    return true;
  }
  if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => deepEqual(v, b[i], tol));
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return kb.every((k) => Object.prototype.hasOwnProperty.call(a, k) && deepEqual(a[k], b[k], tol));
}

function makeHelpers(lookup, output, source, pending) {
  const outputNow = () => (typeof output === "function" ? output() : output);
  const MISSING = Symbol("missing");
  const read = (name) => {
    try { return lookup(name); } catch { return MISSING; }
  };
  function need(name, kind) {
    const v = read(name);
    if (v === MISSING) throw new AssertionError(`Create a variable or function called \`${name}\`.`);
    if (kind === "function" && typeof v !== "function") throw new AssertionError(`\`${name}\` should be a function, but it's ${describe(v)}.`);
    if (kind === "class" && !(typeof v === "function" && /^class[\s{]/.test(Function.prototype.toString.call(v)))) {
      throw new AssertionError(`\`${name}\` should be a class (class ${name} { … }).`);
    }
    if (typeof kind === "string" && !["function", "class"].includes(kind) && typeof v !== kind) {
      throw new AssertionError(`\`${name}\` should be a ${kind}, but it's ${describe(v)}.`);
    }
    return v;
  }
  function same(actual, expected, what = "Your result", tol = 1e-9) {
    if (!deepEqual(actual, expected, tol)) {
      throw new AssertionError(`${what} isn't right yet.\nExpected:\n${short(expected)}\nGot:\n${short(actual)}`);
    }
    return true;
  }
  const printed = (...texts) => texts.every((t) => outputNow().includes(String(t)));
  const code = () => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
  const uses = (...snippets) => snippets.every((s) => code().includes(s));
  function test(fnOrName, cases, opts = {}) {
    const p = runTests(fnOrName, cases, opts);
    p.catch(() => {});            // reported through Promise.all in check(), even if the check code doesn't await it
    pending.push(p);
    return p;
  }
  async function runTests(fnOrName, cases, { valid, key, show } = {}) {
    const fn = typeof fnOrName === "function" ? fnOrName : need(fnOrName, "function");
    const fname = typeof fnOrName === "function" ? fnOrName.name || "your function" : fnOrName;
    let passed = 0;
    for (const [args, expected, label] of cases) {
      const shown = args.map((a) => short(a, 60));
      const call = show ? show.replace(/\{(\d+)\}/g, (_, i) => shown[Number(i)]) : `${fname}(${shown.join(", ")})`;
      const head = `Passed ${passed} of ${cases.length} tests. Fails on ${label}:\n  ${call}\n`;
      let got;
      try {
        got = fn(...structuredCloneSafe(args));
        if (got && typeof got.then === "function") got = await withLimit(got, WAIT_LIMIT_MS, "it never finished (a promise that never settles?)");
      } catch (e) {
        throw new AssertionError(head + `threw ${e && e.name ? `${e.name}: ${e.message}` : short(e)}`);
      }
      let ok;
      if (valid) ok = !!valid(got, ...structuredCloneSafe(args));
      else if (key) ok = deepEqual(key(got), key(expected));
      else ok = deepEqual(got, expected);
      if (!ok) {
        throw new AssertionError(head + (valid
          ? `returned ${short(got, 200)}, which isn't a correct answer (for example, ${short(expected, 200)} is).`
          : `should return ${short(expected, 200)}, but returned ${short(got, 200)}.`));
      }
      passed++;
    }
    return true;
  }
  return { need, same, printed, uses, test, deepEqual, inspect: (v) => inspect(v, 3, new Set(), false), __output__: outputNow(), __source__: source };
}

function structuredCloneSafe(args) {
  try { return structuredClone(args); } catch { return args; }
}

function describe(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "an array";
  if (typeof v === "function") return "a function";
  return typeof v === "object" ? "an object" : `a ${typeof v} (${short(v, 40)})`;
}

export class AssertionError extends Error {
  constructor(msg) { super(msg); this.name = "AssertionError"; }
}

export async function check(src, checkSrc, stdin = "", extra = {}, view = null) {
  const { ok, parts, lookup, testsFailed, env } = await execute(src, stdin, extra, view);
  if (!ok) {
    const msg = testsFailed ? "Some of the tests in your code fail (see above). Make them all pass, then check again."
                            : "Your code raised an error (see above). Fix it and check again.";
    return { ok: false, parts, figures: [], verdict: { ok: false, msg } };
  }
  const output = parts.filter((p) => p[0] === "out").map((p) => p[1]).join("");
  const pending = [];
  // Checks share the run's pretend APIs (fetch), so they can see what the learner's code did there.
  const helpers = { ...makeHelpers(lookup, output, view ? view.source : src, pending), fetch: env.fetch };
  const names = Object.keys(helpers);
  let verdict;
  try {
    const fn = new AsyncFunction(...names, "AssertionError", `"use strict";\n${checkSrc}`);
    await withLimit(fn(...names.map((n) => helpers[n]), AssertionError), 15000, "The checks took longer than 15 s.");
    await Promise.all(pending);
    verdict = { ok: true, msg: "All checks passed." };
  } catch (e) {
    verdict = e instanceof AssertionError || (e && e.name === "AssertionError")
      ? { ok: false, msg: e.message || "One of the checks failed." }
      : { ok: false, msg: `Checking stopped with ${e && e.name}: ${e && e.message}` };
  }
  return { ok: true, parts, figures: [], verdict };
}
