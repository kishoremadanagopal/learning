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
  if (value instanceof WeakMap) return "WeakMap { <items unknown> }";
  if (value instanceof WeakSet) return "WeakSet { <items unknown> }";
  seen.add(value);
  try {
    const inner = (v) => inspect(v, depth - 1, seen, false);
    let items, open, close, prefix = "";
    if (Array.isArray(value)) {
      if (depth < 0) return "[Array]";
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

function report(e, src) {
  if (!(e instanceof Error)) return `Uncaught ${inspect(e, 2, new Set(), false)}`;
  const line = errorLine(e);
  const lines = src.split("\n");
  let text = `${e.name}: ${e.message}`;
  if (line && line <= lines.length && e.name !== "SyntaxError") {
    text = `Line ${line}: ${lines[line - 1].trim()}\n${text}`;
  }
  let hint = HINTS[e.name] || "";
  if (/is not a function/.test(e.message)) hint = "Hint: you called something that isn't a function. Check the name, and whether you meant a property (no parentheses).";
  if (/Cannot read properties of (undefined|null)/.test(e.message)) hint = "Hint: you used a property of undefined or null. The value on the left of the dot doesn't exist yet: console.log it to check.";
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

function makeEnv(parts, stdin) {
  let size = 0;
  const push = (kind, text) => {
    if (size > MAX_OUTPUT) return;
    size += text.length;
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
    for (const [id, kind] of active) (kind === "interval" ? realClearInterval : realClear)(id);
    active.clear();
  };
  return {
    console, prompt, setTimeout, clearTimeout, setInterval, clearInterval, active, clearAll,
    takeErrors: () => { const e = errors; errors = []; return e; },
    addError: (e) => errors.push(e),
    push,
  };
}

// Unhandled promise rejections and timer errors are routed to the code that is running now.
let activeEnv = null;
export function reportUnhandled(error) {
  if (activeEnv) activeEnv.addError({ uncaught: true, error });
}

const PARAMS = ["console", "prompt", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "__extra"];

async function execute(src, stdin = "", extra = {}) {
  const parts = [];
  const env = makeEnv(parts, stdin);
  let ok = true, lookup = () => undefined;
  // Learner code becomes the body of an async function. The closure at the end lets checks read its variables.
  const body = `"use strict";\n${src}\n;return (__name) => eval(__name);\n//# sourceURL=main.js`;
  let fn;
  try {
    fn = new AsyncFunction(...PARAMS, body);
  } catch (e) {
    parts.push(["err", report(e, src)]);
    return { ok: false, parts, lookup, env };
  }
  activeEnv = env;
  try {
    const finished = fn(env.console, env.prompt, env.setTimeout, env.clearTimeout, env.setInterval, env.clearInterval, extra);
    lookup = await withLimit(finished, WAIT_LIMIT_MS, "Your code is still waiting (for a promise that never settles?) after 5 s, so it was stopped.");
    // Let pending timers, promise callbacks and async work finish, like a real JavaScript program would.
    const t0 = Date.now();
    for (;;) {
      await new Promise((r) => globalThis.setTimeout(r, 0));
      if (!env.active.size || Date.now() - t0 > WAIT_LIMIT_MS) break;
      await new Promise((r) => globalThis.setTimeout(r, 5));
    }
    if (env.active.size) {
      env.clearAll();
      env.push("err", "\n(Stopped waiting after 5 s: a timer or setInterval was still running. Clear intervals with clearInterval.)\n");
    }
  } catch (e) {
    ok = false;
    env.clearAll();
    parts.push(["err", report(e, src)]);
  }
  for (const e of env.takeErrors()) {
    ok = false;
    const text = e && e.uncaught ? "Uncaught (in promise) " + report(e.error, src) : report(e, src);
    parts.push(["err", (parts.length ? "\n" : "") + text]);
  }
  activeEnv = null;
  return { ok, parts, lookup, env };
}

function withLimit(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = globalThis.setTimeout(() => reject(new Error(message)), ms); }),
  ]).finally(() => globalThis.clearTimeout(timer));
}

export async function run(src, stdin = "", extra = {}) {
  const { ok, parts } = await execute(src, stdin, extra);
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
  const printed = (...texts) => texts.every((t) => output.includes(String(t)));
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
  return { need, same, printed, uses, test, deepEqual, inspect: (v) => inspect(v, 3, new Set(), false), __output__: output, __source__: source };
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

export async function check(src, checkSrc, stdin = "", extra = {}) {
  const { ok, parts, lookup } = await execute(src, stdin, extra);
  if (!ok) {
    return { ok: false, parts, figures: [], verdict: { ok: false, msg: "Your code raised an error (see above). Fix it and check again." } };
  }
  const output = parts.filter((p) => p[0] === "out").map((p) => p[1]).join("");
  const pending = [];
  const helpers = makeHelpers(lookup, output, src, pending);
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
