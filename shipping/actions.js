/* actions.js: a pretend GitHub Actions for the sandbox's pretend GitHub (github.js).
   - pushes, pull requests, releases and `gh workflow run` start the workflows in .github/workflows, which really run:
     each job gets a fresh runner shell with the repository checked out, `run:` steps execute in bash -e, and a few
     official actions (checkout, setup-node, cache, upload/download-artifact, the GitHub Pages actions) are simulated
   - expressions (${{ … }}), contexts, if:, needs:, matrices, outputs, secrets (masked as ***), variables,
     environments, artifacts, caches, reusable workflows and local composite actions
   - gh run, gh workflow, gh secret, gh variable and gh pr checks, printing like gh 2.102 does
   - actionlint, for checking workflow files before you push them
   - a GitHub Pages site that curl can fetch after a deployment
   Runs finish the moment they start (the sandbox has no waiting), with realistic, fixed timings. */
import { parseDocument, LineCounter, isMap, isSeq, isScalar } from "./yamllib.js?v=576fafd92b";
import { NODE_RELEASES } from "./nodejs.js?v=576fafd92b";

export function installActions(gh, api) {
  const { git, Shell, registerCommand, parseOpts, filesAt, START } = api;
  const { ghLoad, ghSave, GhError, fuzzyAgo, table, baseRepo, ghState, hooks, defaultBranchOf, copyObjects, findPull, mergeTreesOnServer, writeCommitFromFiles } = gh;
  const clockNow = (sh) => START + 60 * sh.commits;

  /* ------------------------------------------------------------ what the simulated runners know */

  const RUNNER_VERSION = "2.338.0";
  const IMAGE = { os: "24.04.5", version: "20261004.327.1", git: "2.55.0", defaultNode: 22 };
  // Official actions the sandbox can run, the majors it accepts, and the commit each major tag points to.
  const ACTIONS = {
    "actions/checkout": { majors: [5, 6, 7], sha: { 7: "3d3c42e5aac5ba805825da76410c181273ba90b1" }, post: true },
    "actions/setup-node": { majors: [5, 6, 7], sha: { 7: "949feb2413d6458794dcd2491c4babbbce0c15c1" }, post: true },
    "actions/cache": { majors: [4, 5, 6], sha: { 6: "55cc8345863c7cc4c66a329aec7e433d2d1c52a9" }, post: true },
    "actions/upload-artifact": { majors: [4, 5, 6, 7], sha: { 7: "cf430e030ddbb5b0abf93d22962f4752f3646cd9" } },
    "actions/download-artifact": { majors: [4, 5, 6, 7, 8], sha: { 8: "9000827ccba6bdab643e8b6fd33ac0654aef8333" } },
    "actions/configure-pages": { majors: [5, 6], sha: { 6: "45bfe0192ca1faeb007ade9deae92b16b8254a0d" } },
    "actions/upload-pages-artifact": { majors: [3, 4, 5], sha: { 5: "fc324d3547104276b827a68afc52ff2a11cc49c9" } },
    "actions/deploy-pages": { majors: [4, 5], sha: { 5: "368f82528645a54fb793d4d04e342629a3f51346" } },
  };
  const DEPRECATED = { "actions/upload-artifact": [1, 2, 3], "actions/download-artifact": [1, 2, 3], "actions/cache": [1, 2] };
  const fakeSha = (s) => { let h = 0x811c9dc5, out = ""; for (let r = 0; r < 5; r++) { for (const c of s + r) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } out += h.toString(16).padStart(8, "0"); } return out; };

  /* ------------------------------------------------------------ SHA-256, for hashFiles() and cache keys */

  function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const len = bytes.length, total = ((len + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(total);
    buf.set(bytes); buf[len] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 4, (len * 8) >>> 0); dv.setUint32(total - 8, Math.floor(len / 0x20000000));
    const w = new Uint32Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    return H.map((x) => x.toString(16).padStart(8, "0")).join("");
  }

  /* ------------------------------------------------------------ reading a workflow file, with actionlint's checks */

  const WEBHOOK_EVENTS = ["branch_protection_rule", "check_run", "check_suite", "create", "delete", "deployment", "deployment_status", "discussion", "discussion_comment", "fork", "gollum", "issue_comment", "issues", "label", "merge_group", "milestone", "page_build", "public", "pull_request", "pull_request_review", "pull_request_review_comment", "pull_request_target", "push", "registry_package", "release", "repository_dispatch", "status", "watch", "workflow_run", "image_version"];
  const OTHER_EVENTS = ["schedule", "workflow_dispatch", "workflow_call"];
  const KEYS = {
    workflow: ["name", "run-name", "on", "permissions", "env", "defaults", "concurrency", "jobs"],
    job: ["name", "needs", "runs-on", "permissions", "environment", "concurrency", "outputs", "env", "defaults", "if", "steps", "timeout-minutes", "strategy", "continue-on-error", "container", "services", "uses", "with", "secrets", "snapshot"],
    run: ["id", "if", "name", "env", "continue-on-error", "timeout-minutes", "run", "shell", "working-directory"],
    uses: ["id", "if", "name", "env", "continue-on-error", "timeout-minutes", "uses", "with"],
    webhook: ["types", "branches", "branches-ignore", "tags", "tags-ignore", "paths", "paths-ignore", "workflows"],
    strategy: ["matrix", "fail-fast", "max-parallel"],
    environment: ["deployment", "name", "url"],
    concurrency: ["group", "cancel-in-progress"],
  };
  const quotes = (list) => [...list].sort().map((x) => `"${x}"`).join(", ");

  // Parse YAML and check the structure like actionlint does; returns { wf (plain object), errors, lines, positions }.
  function readWorkflow(path, text) {
    const lc = new LineCounter();
    const doc = parseDocument(text, { lineCounter: lc, prettyErrors: false, uniqueKeys: false });
    const errors = [];
    const pos = (node) => { const p = node && node.range ? lc.linePos(node.range[0]) : { line: 1, col: 1 }; return { line: p.line, col: p.col }; };
    const err = (node, message, kind = "syntax-check") => errors.push({ ...pos(node), message, kind });
    if (doc.errors.length) {
      const e = doc.errors[0];
      const p = e.linePos?.[0] ?? (e.pos ? lc.linePos(e.pos[0]) : { line: 1, col: 1 });
      // the messages of the YAML parser actionlint and GitHub use (go-yaml), for the common mistakes
      const msg = e.code === "TAB_AS_INDENT" ? "found character that cannot start any token"
        : e.code === "BLOCK_AS_IMPLICIT_KEY" && /Nested mappings/.test(e.message) ? "mapping values are not allowed in this context"
        : e.code === "MISSING_CHAR" && /quote/.test(e.message) ? "found unexpected end of stream"
        : e.code === "BAD_INDENT" || e.code === "BLOCK_AS_IMPLICIT_KEY" || e.code === "MULTILINE_IMPLICIT_KEY" ? "did not find expected key"
        : e.message.split("\n")[0].replace(/ at line \d+, column \d+:?$/, "");
      errors.push({ line: p.line, col: p.col, message: `could not parse as YAML: ${msg}`, kind: "syntax-check", yaml: true });
      return { wf: null, errors, positions: {} };
    }
    const root = doc.contents;
    const positions = { jobs: {}, steps: {} };
    if (!isMap(root)) { err(root, '"jobs" section is missing in workflow'); return { wf: null, errors, positions }; }
    const keyOf = (pair) => String(pair.key?.value ?? pair.key);
    const unexpected = (pair, sec, expected) => err(pair.key, `unexpected key "${keyOf(pair)}" for ${sec.includes(" ") ? sec : `"${sec}" section`}. expected one of ${quotes(expected)}`);
    const dupCheck = (map, where) => {
      const seen = new Map();
      for (const pair of map.items) {
        const k = keyOf(pair);
        if (seen.has(k)) { const q = seen.get(k); err(pair.key, `key "${k}" is duplicated in ${where}. previously defined at line:${q.line},col:${q.col}`); }
        else seen.set(k, pos(pair.key));
      }
    };
    dupCheck(root, "workflow");
    let hasOn = false, hasJobs = false;
    for (const pair of root.items) {
      const k = keyOf(pair);
      if (!KEYS.workflow.includes(k)) { unexpected(pair, "workflow", KEYS.workflow); continue; }
      if (k === "on") {
        hasOn = true;
        const v = pair.value;
        const checkEvent = (nameNode, valueNode) => {
          const name = String(nameNode.value ?? nameNode);
          if (!WEBHOOK_EVENTS.includes(name) && !OTHER_EVENTS.includes(name)) {
            err(nameNode, `unknown Webhook event "${name}". see https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#webhook-events for list of all Webhook event names`, "events");
            return;
          }
          if (WEBHOOK_EVENTS.includes(name) && isMap(valueNode)) for (const fp of valueNode.items) if (!KEYS.webhook.includes(keyOf(fp))) unexpected(fp, name, KEYS.webhook);
          if (name === "schedule" && isSeq(valueNode)) for (const item of valueNode.items) if (isMap(item)) for (const fp of item.items) if (!["cron", "timezone"].includes(keyOf(fp))) unexpected(fp, 'element of "schedule" section', ["cron", "timezone"]);
          if (name === "workflow_dispatch" && isMap(valueNode)) for (const fp of valueNode.items) if (keyOf(fp) !== "inputs") err(fp.key, `expected "inputs" key for "workflow_dispatch" section but got "${keyOf(fp)}"`);
        };
        if (isScalar(v)) checkEvent(v, null);
        else if (isSeq(v)) for (const item of v.items) checkEvent(item, null);
        else if (isMap(v)) for (const ep of v.items) checkEvent(ep.key, ep.value);
      }
      if (k === "jobs") {
        hasJobs = true;
        if (!isMap(pair.value)) continue;
        dupCheck(pair.value, '"jobs" section');
        const ids = pair.value.items.map(keyOf);
        for (const jp of pair.value.items) {
          const id = keyOf(jp);
          positions.jobs[id] = pos(jp.key);
          if (!isMap(jp.value)) continue;
          const jobKeys = jp.value.items.map(keyOf);
          for (const kp of jp.value.items) {
            const jk = keyOf(kp);
            if (!KEYS.job.includes(jk)) { unexpected(kp, "job", KEYS.job); continue; }
            if (jk === "strategy" && isMap(kp.value)) for (const sp of kp.value.items) if (!KEYS.strategy.includes(keyOf(sp))) unexpected(sp, "strategy", KEYS.strategy);
            if (jk === "environment" && isMap(kp.value)) for (const sp of kp.value.items) if (!KEYS.environment.includes(keyOf(sp))) unexpected(sp, "environment", KEYS.environment);
            if (jk === "concurrency" && isMap(kp.value)) for (const sp of kp.value.items) if (!KEYS.concurrency.includes(keyOf(sp))) unexpected(sp, "concurrency", KEYS.concurrency);
            if (jk === "needs") {
              const list = isSeq(kp.value) ? kp.value.items : [kp.value];
              for (const n of list) if (!ids.includes(String(n.value))) err(n, `job "${id}" needs job "${String(n.value)}" which does not exist in this workflow`, "job-needs");
            }
            if (jk === "steps" && isSeq(kp.value)) {
              positions.steps[id] = [];
              kp.value.items.forEach((st) => {
                positions.steps[id].push(pos(st));
                if (!isMap(st)) return;
                const sk = st.items.map(keyOf);
                if (!sk.includes("run") && !sk.includes("uses")) { err(st, 'step must run script with "run" section or run action with "uses" section'); return; }
                const allowed = sk.includes("run") ? KEYS.run : KEYS.uses;
                for (const sp of st.items) if (!allowed.includes(keyOf(sp))) unexpected(sp, sk.includes("run") ? "step to run shell command" : "step to execute action", allowed);
              });
            }
          }
          if (!jobKeys.includes("uses")) {
            if (!jobKeys.includes("steps")) err(jp.key, `"steps" section is missing in job "${id}"`);
            if (!jobKeys.includes("runs-on")) err(jp.key, `"runs-on" section is missing in job "${id}"`);
          }
        }
      }
    }
    if (!hasOn) err(root, '"on" section is missing in workflow');
    if (!hasJobs) err(root, '"jobs" section is missing in workflow');
    errors.sort((a, b) => a.line - b.line || a.col - b.col);
    return { wf: doc.toJS({ maxAliasCount: 100 }), errors, positions };
  }

  /* ------------------------------------------------------------ expressions: ${{ … }} */

  class ExprError extends Error {}
  function lexExpr(src) {
    const toks = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === "'") {
        let s = "", j = i + 1;
        for (;;) {
          if (j >= src.length) throw new ExprError(`unterminated string in ${src}`);
          if (src[j] === "'") { if (src[j + 1] === "'") { s += "'"; j += 2; continue; } break; }
          s += src[j++];
        }
        toks.push({ t: "str", v: s }); i = j + 1; continue;
      }
      const two = src.slice(i, i + 2);
      if (["==", "!=", "<=", ">=", "&&", "||"].includes(two)) { toks.push({ t: "op", v: two }); i += 2; continue; }
      if ("()[].,!<>*".includes(c)) { toks.push({ t: "op", v: c }); i++; continue; }
      const num = /^(?:0x[0-9a-fA-F]+|-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)/.exec(src.slice(i));
      if (num && !/[A-Za-z_]/.test(src[i + num[0].length] ?? "")) { toks.push({ t: "num", v: Number(num[0]) }); i += num[0].length; continue; }
      const id = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(src.slice(i));
      if (id) { toks.push({ t: "id", v: id[0] }); i += id[0].length; continue; }
      throw new ExprError(`unexpected character '${c}' in ${src}`);
    }
    return toks;
  }
  const truthy = (v) => !(v === false || v === 0 || v === "" || v === null || v === undefined || Number.isNaN(v));
  const toNum = (v) => (v === null || v === undefined ? 0 : typeof v === "boolean" ? (v ? 1 : 0) : typeof v === "number" ? v : typeof v === "string" ? (v.trim() === "" ? 0 : Number(v)) : NaN);
  function looseEq(a, b) {
    if (typeof a === "string" && typeof b === "string") return a.toLowerCase() === b.toLowerCase();
    if (typeof a === typeof b && typeof a !== "object") return a === b;
    if (a === null && b === null) return true;
    if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) return a === b;
    return toNum(a) === toNum(b);
  }
  function compare(a, b) {
    if (typeof a === "string" && typeof b === "string") { const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; }
    const x = toNum(a), y = toNum(b);
    if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
    return x < y ? -1 : x > y ? 1 : 0;
  }
  const exprString = (v) => (v === null || v === undefined ? "" : typeof v === "boolean" ? String(v) : typeof v === "number" ? String(v) : typeof v === "string" ? v : Array.isArray(v) ? "Array" : "Object");
  function getProp(obj, key) {
    if (obj === null || obj === undefined || typeof obj !== "object") return null;
    if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
    const k = Object.keys(obj).find((x) => x.toLowerCase() === String(key).toLowerCase());
    return k === undefined ? null : obj[k];
  }
  function evalExpr(src, ctx) {
    const toks = lexExpr(src);
    let i = 0;
    const peek = (v) => toks[i] && toks[i].v === v && toks[i].t !== "str";
    const next = () => toks[i++];
    const expect = (v) => { if (!peek(v)) throw new ExprError(`expected '${v}' in ${src}`); i++; };
    const or = () => { let v = and(); while (peek("||")) { next(); const r = and(); v = truthy(v) ? v : r; } return v; };
    const and = () => { let v = eq(); while (peek("&&")) { next(); const r = eq(); v = truthy(v) ? r : v; } return v; };
    const eq = () => { let v = cmp(); while (peek("==") || peek("!=")) { const o = next().v, r = cmp(); v = o === "==" ? looseEq(v, r) : !looseEq(v, r); } return v; };
    const cmp = () => { let v = unary(); while (peek("<") || peek(">") || peek("<=") || peek(">=")) { const o = next().v, r = unary(); const c = compare(v, r); v = Number.isNaN(c) ? false : o === "<" ? c < 0 : o === ">" ? c > 0 : o === "<=" ? c <= 0 : c >= 0; } return v; };
    const unary = () => { if (peek("!")) { next(); return !truthy(unary()); } return postfix(); };
    const postfix = () => {
      let v = primary();
      for (;;) {
        if (peek(".")) {
          next();
          const t = next();
          if (t && t.v === "*") v = Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : [];
          else if (t && t.t === "id") v = Array.isArray(v) && v.__filtered ? Object.assign(v.map((x) => getProp(x, t.v)), { __filtered: true }) : getProp(v, t.v);
          else throw new ExprError(`unexpected token after '.' in ${src}`);
          if (t.v === "*") v = Object.assign([...v], { __filtered: true });
        } else if (peek("[")) {
          next();
          const k = or();
          expect("]");
          v = Array.isArray(v) && typeof k === "number" ? (v[k] ?? null) : getProp(v, exprString(k));
        } else break;
      }
      return v;
    };
    const primary = () => {
      const t = next();
      if (!t) throw new ExprError(`unexpected end of expression: ${src}`);
      if (t.t === "str" || t.t === "num") return t.v;
      if (t.v === "(") { const v = or(); expect(")"); return v; }
      if (t.t === "id") {
        const low = t.v.toLowerCase();
        if (low === "true") return true;
        if (low === "false") return false;
        if (low === "null") return null;
        if (low === "nan") return NaN;
        if (low === "infinity") return Infinity;
        if (peek("(")) {
          next();
          const args = [];
          if (!peek(")")) { args.push(or()); while (peek(",")) { next(); args.push(or()); } }
          expect(")");
          return callFn(low, args, ctx, src);
        }
        if (!(low in ctx.contexts)) throw new ExprError(`Unrecognized named-value: '${t.v}'`);
        return ctx.contexts[low];
      }
      throw new ExprError(`unexpected '${t.v}' in ${src}`);
    };
    const v = or();
    if (i < toks.length) throw new ExprError(`unexpected '${toks[i].v}' in ${src}`);
    return v;
  }
  function callFn(name, args, ctx, src) {
    const s = (v) => exprString(v).toLowerCase();
    switch (name) {
      case "contains": return Array.isArray(args[0]) ? args[0].some((x) => looseEq(x, args[1])) : s(args[0]).includes(s(args[1]));
      case "startswith": return s(args[0]).startsWith(s(args[1]));
      case "endswith": return s(args[0]).endsWith(s(args[1]));
      case "format": return exprString(args[0]).replace(/\{\{|\}\}|\{(\d+)\}/g, (m, n) => (m === "{{" ? "{" : m === "}}" ? "}" : exprString(args[1 + Number(n)])));
      case "join": return Array.isArray(args[0]) ? args[0].map(exprString).join(args.length > 1 ? exprString(args[1]) : ",") : exprString(args[0]);
      case "tojson": return JSON.stringify(args[0] ?? null, null, 2);
      case "fromjson": try { return JSON.parse(exprString(args[0])); } catch { throw new ExprError(`Error parsing fromJson: ${exprString(args[0])}`); }
      case "hashfiles": return ctx.hashFiles ? ctx.hashFiles(args.map(exprString)) : "";
      case "success": return ctx.status ? ctx.status() === "success" : true;
      case "failure": return ctx.status ? ctx.status() === "failure" : false;
      case "cancelled": return ctx.status ? ctx.status() === "cancelled" : false;
      case "always": return true;
      default: throw new ExprError(`Unrecognized function: '${name}'`);
    }
  }
  // Replace each ${{ … }} in a string.
  function interpolate(text, ctx) {
    if (typeof text !== "string") return text;
    return text.replace(/\$\{\{([\s\S]*?)\}\}/g, (_, e) => exprString(evalExpr(e.trim(), ctx)));
  }
  // if: conditions, with the implicit success() when no status function is used.
  function condition(text, ctx) {
    if (text === undefined || text === null) return callFn("success", [], ctx);
    if (typeof text === "boolean") return text && callFn("success", [], ctx);
    let e = String(text).trim();
    const m = /^\$\{\{([\s\S]*)\}\}$/.exec(e);
    if (m) e = m[1].trim();
    if (!/\b(success|failure|always|cancelled)\s*\(/i.test(e)) e = `success() && (${e})`;
    return truthy(evalExpr(e, ctx));
  }

  /* ------------------------------------------------------------ filter patterns (branches, tags, paths) */

  function patternRe(p) {
    let re = "";
    for (let i = 0; i < p.length; i++) {
      const c = p[i];
      if (c === "*" && p[i + 1] === "*") { re += ".*"; i++; if (p[i + 1] === "/") { re += "/?"; i++; } }
      else if (c === "*") re += "[^/]*";
      else if (c === "?") re += "?";
      else if (c === "+") re += "+";
      else if (c === "[") { const j = p.indexOf("]", i); re += p.slice(i, j + 1); i = j; }
      else re += c.replace(/[.^${}()|\\]/g, "\\$&");
    }
    return new RegExp(`^${re}$`);
  }
  function matchList(list, value) {
    let result = false;
    for (const raw of [].concat(list ?? [])) {
      const p = String(raw);
      if (p.startsWith("!")) { if (patternRe(p.slice(1)).test(value)) result = false; }
      else if (patternRe(p).test(value)) result = true;
    }
    return result;
  }
  const anyPath = (list, files) => files.some((f) => matchList(list, f));

  /* ------------------------------------------------------------ the state GitHub keeps for Actions */

  function store(sh, rdir) {
    const data = ghLoad(sh, rdir);
    data.actions ??= { runs: [], nextRun: 1, secrets: {}, variables: {}, envSecrets: {}, environments: {}, caches: {}, pages: { enabled: false }, workflows: {}, nextArtifact: 1 };
    return data;
  }
  const repoName = (rdir) => rdir.split("/").slice(-2).join("/");
  const runUrl = (rdir, id) => `https://github.com/${repoName(rdir)}/actions/runs/${id}`;
  function workflowId(data, path) {
    data.actions.workflows[path] ??= { id: 201837000 + Object.keys(data.actions.workflows).length * 1117 + 42, state: "active" };
    return data.actions.workflows[path];
  }

  async function workflowFiles(sh, rdir, sha) {
    const files = await filesAt(sh, rdir, sha);
    return [...files.entries()].filter(([p]) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(p)).sort(([a], [b]) => (a < b ? -1 : 1));
  }

  /* ------------------------------------------------------------ deciding which workflows an event starts */

  function eventsOf(wf) {
    const on = wf?.on ?? wf?.true;   // YAML 1.1 parsers read `on` as true; ours doesn't, but be safe
    if (typeof on === "string") return { [on]: null };
    if (Array.isArray(on)) return Object.fromEntries(on.map((e) => [e, null]));
    return on && typeof on === "object" ? on : {};
  }
  function triggers(wf, ev, changed) {
    const events = eventsOf(wf);
    if (!(ev.name in events)) return false;
    const f = events[ev.name] ?? {};
    if (ev.name === "push") {
      const isTag = ev.ref.startsWith("refs/tags/");
      const name = ev.ref.replace(/^refs\/(heads|tags)\//, "");
      const hasB = f.branches || f["branches-ignore"], hasT = f.tags || f["tags-ignore"];
      if (isTag) {
        if (hasB && !hasT) return false;
        if (f.tags && !matchList(f.tags, name)) return false;
        if (f["tags-ignore"] && matchList(f["tags-ignore"], name)) return false;
        return true;
      }
      if (hasT && !hasB) return false;
      if (f.branches && !matchList(f.branches, name)) return false;
      if (f["branches-ignore"] && matchList(f["branches-ignore"], name)) return false;
      if (f.paths && !anyPath(f.paths, changed)) return false;
      if (f["paths-ignore"] && changed.length && changed.every((p) => matchList(f["paths-ignore"], p))) return false;
      return true;
    }
    if (ev.name === "pull_request" || ev.name === "pull_request_target") {
      const types = [].concat(f.types ?? ["opened", "synchronize", "reopened"]);
      if (!types.includes(ev.action)) return false;
      if (f.branches && !matchList(f.branches, ev.baseBranch)) return false;
      if (f["branches-ignore"] && matchList(f["branches-ignore"], ev.baseBranch)) return false;
      if (f.paths && !anyPath(f.paths, changed)) return false;
      if (f["paths-ignore"] && changed.length && changed.every((p) => matchList(f["paths-ignore"], p))) return false;
      return true;
    }
    if (ev.name === "release") {
      const types = f.types ? [].concat(f.types) : null;
      return !types || types.includes(ev.action);
    }
    return true;   // workflow_dispatch
  }

  async function changedFiles(sh, rdir, from, to) {
    const a = from ? await filesAt(sh, rdir, from) : new Map(), b = await filesAt(sh, rdir, to);
    return [...new Set([...a.keys(), ...b.keys()])].filter((p) => a.get(p) !== b.get(p)).sort();
  }

  // Start every workflow an event triggers. ev: { name, action, ref, sha, before, headBranch, baseBranch, title, actor, pr, release, inputs, only }
  async function dispatch(sh, rdir, ev) {
    const data = store(sh, rdir);
    const files = await workflowFiles(sh, rdir, ev.workflowSha ?? ev.sha);
    let changed = [];
    if (ev.name === "push" && !ev.ref.startsWith("refs/tags/")) {
      let from = ev.before;
      if (!from) {
        const def = defaultBranchOf(sh, rdir);
        const defOid = await git.resolveRef({ fs: sh.fs, dir: rdir, ref: `refs/heads/${def}` }).catch(() => null);
        if (defOid && defOid !== ev.sha) from = (await git.findMergeBase({ fs: sh.fs, dir: rdir, oids: [defOid, ev.sha] }).catch(() => []))[0] ?? null;
      }
      changed = await changedFiles(sh, rdir, from, ev.sha);
    } else if (ev.name.startsWith("pull_request")) {
      changed = await changedFiles(sh, rdir, ev.mergeBase, ev.headSha);
    }
    const started = [];
    for (const [path, text] of files) {
      if (ev.only && ev.only !== path) continue;
      const w = workflowId(data, path);
      if (w.state !== "active") continue;
      const parsed = readWorkflow(path, text);
      if (parsed.errors.length) {
        // GitHub can't read the file, so every push shows a failed run named after the file
        if (ev.name !== "push") continue;
        const run = newRun(sh, data, rdir, path, path, ev);
        Object.assign(run, { status: "completed", conclusion: "failure", invalid: parsed.errors[0], updatedAt: run.createdAt + 1 });
        started.push(run);
        continue;
      }
      if (!triggers(parsed.wf, ev, changed)) continue;
      const run = newRun(sh, data, rdir, path, parsed.wf.name ? String(parsed.wf.name) : path, ev);
      started.push(run);
      await executeRun(sh, rdir, data, run, parsed, ev);
    }
    await ghSave(sh, rdir, data);
    return started;
  }

  function newRun(sh, data, rdir, path, name, ev) {
    const n = data.actions.nextRun++;
    const w = workflowId(data, path);
    const number = data.actions.runs.filter((r) => r.workflow === path).length + 1;
    const run = {
      id: 22417300000 + n * 4019, number, attempt: 1, workflow: path, workflowName: name, workflowId: w.id,
      event: ev.name, headBranch: ev.headBranch, headSha: ev.headSha ?? ev.sha, sha: ev.sha, ref: ev.ref, title: ev.title,
      actor: ev.actor, pr: ev.pr ?? null, createdAt: clockNow(sh) + n % 3, status: "completed", conclusion: null, jobs: [], artifacts: [],
      inputs: ev.inputs ?? {}, release: ev.release ?? null,
    };
    data.actions.runs.push(run);
    return run;
  }

  /* ------------------------------------------------------------ running a workflow */

  function contextsFor(sh, rdir, data, run, ev, wf) {
    const [owner, repo] = repoName(rdir).split("/");
    const refName = run.ref.replace(/^refs\/(heads|tags)\//, "").replace(/^refs\/pull\/(\d+)\/merge$/, "$1/merge");
    const event = {};
    if (ev.name === "push") Object.assign(event, { ref: run.ref, before: ev.before ?? "0".repeat(40), after: run.sha, head_commit: { id: run.sha, message: (ev.message ?? run.title).replace(/\n+$/, ""), author: { name: ev.authorName ?? "" } }, repository: { name: repo, full_name: `${owner}/${repo}` } });
    if (ev.name.startsWith("pull_request")) Object.assign(event, { action: ev.action, number: run.pr, pull_request: { number: run.pr, title: run.title, head: { ref: ev.headBranch, sha: ev.headSha }, base: { ref: ev.baseBranch }, user: { login: ev.actor } } });
    if (ev.name === "workflow_dispatch") Object.assign(event, { inputs: run.inputs, ref: run.ref });
    if (ev.name === "release") Object.assign(event, { action: ev.action, release: { tag_name: ev.release.tag, name: ev.release.title, body: ev.release.notes ?? "" } });
    return {
      action: "", action_path: "", actor: run.actor, api_url: "https://api.github.com", base_ref: ev.baseBranch ?? "", event, event_name: run.event,
      head_ref: ev.name.startsWith("pull_request") ? ev.headBranch : "", job: "", ref: run.ref, ref_name: refName, ref_type: run.ref.startsWith("refs/tags/") ? "tag" : "branch",
      repository: `${owner}/${repo}`, repository_owner: owner, run_attempt: String(run.attempt), run_id: String(run.id), run_number: String(run.number),
      server_url: "https://github.com", sha: run.sha, token: "***", triggering_actor: run.actor, workflow: run.workflowName, workflow_ref: `${owner}/${repo}/${run.workflow}@${run.ref}`,
      workspace: `/home/runner/work/${repo}/${repo}`, retention_days: "90",
    };
  }

  // One entry per job, with its matrix combinations expanded.
  function expandJobs(wf) {
    const out = [];
    for (const [id, def] of Object.entries(wf.jobs ?? {})) {
      const m = def?.strategy?.matrix;
      if (!m || typeof m !== "object") { out.push({ id, def, matrix: null }); continue; }
      const keys = Object.keys(m).filter((k) => k !== "include" && k !== "exclude");
      let combos = [{}];
      for (const k of keys) combos = combos.flatMap((c) => [].concat(m[k]).map((v) => ({ ...c, [k]: v })));
      if (!keys.length) combos = [];
      const exclude = [].concat(m.exclude ?? []);
      combos = combos.filter((c) => !exclude.some((ex) => Object.entries(ex).every(([k, v]) => looseEq(c[k], v))));
      for (const inc of [].concat(m.include ?? [])) {
        const original = Object.fromEntries(Object.entries(inc).filter(([k]) => keys.includes(k)));
        const matches = combos.filter((c) => Object.entries(original).every(([k, v]) => looseEq(c[k], v)));
        if (matches.length && Object.keys(original).length) matches.forEach((c) => Object.assign(c, inc));
        else combos.push({ ...inc });
      }
      combos.forEach((c, k) => out.push({ id, def, matrix: c, index: k, total: combos.length }));
    }
    return out;
  }

  async function executeRun(sh, rdir, data, run, parsed, ev, { onlyJobs = null, previous = null } = {}) {
    const wf = parsed.wf;
    const github = contextsFor(sh, rdir, data, run, ev, wf);
    const baseCtx = { github, vars: Object.fromEntries(Object.entries(data.actions.variables).map(([k, v]) => [k, v.value])), inputs: run.inputs ?? {} };
    // run-name
    if (wf["run-name"]) {
      try { run.displayTitle = interpolate(String(wf["run-name"]), { contexts: { ...baseCtx, env: {}, secrets: {} } }); } catch { /* keep the default */ }
    }
    const instances = expandJobs(wf);
    const results = {};   // job id → { result, outputs }
    let clock = run.createdAt + 3;
    const ids = Object.keys(wf.jobs);
    const order = [];
    const seen = new Set();
    const visit = (id, stack = []) => {
      if (seen.has(id)) return;
      if (stack.includes(id)) return;
      for (const n of [].concat(wf.jobs[id]?.needs ?? [])) if (wf.jobs[n]) visit(n, [...stack, id]);
      seen.add(id);
      order.push(id);
    };
    ids.forEach((id) => visit(id));
    const jobEnds = {};
    let jobCounter = 0;
    for (const id of order) {
      const def = wf.jobs[id] ?? {};
      const needs = [].concat(def.needs ?? []);
      const needsCtx = Object.fromEntries(needs.map((n) => [n, { result: results[n]?.result ?? "skipped", outputs: results[n]?.outputs ?? {} }]));
      const start = Math.max(clock, ...needs.map((n) => jobEnds[n] ?? clock)) + 1;
      const mine = instances.filter((x) => x.id === id);
      const jobResults = [];
      // reusable workflow: uses ./.github/workflows/x.yml
      if (typeof def.uses === "string") {
        const r = await runReusable(sh, rdir, data, run, ev, id, def, { ...baseCtx, needs: needsCtx }, start, () => jobCounter++);
        results[id] = r;
        jobEnds[id] = r.end;
        continue;
      }
      for (const inst of mine) {
        if (onlyJobs && previous) {
          const prevJob = previous.jobs.find((j) => j.key === `${id}:${inst.index ?? 0}`);
          if (prevJob && !onlyJobs.has(prevJob.key)) { run.jobs.push({ ...prevJob }); jobResults.push({ result: prevJob.conclusion, outputs: prevJob.outputs ?? {}, end: prevJob.completedAt, failedAt: prevJob.conclusion === "failure" ? prevJob.completedAt : null }); continue; }
        }
        const job = await runJob(sh, rdir, data, run, wf, parsed, id, inst, { ...baseCtx, needs: needsCtx }, needs, results, start + (inst.index ?? 0) % 2, jobCounter++);
        run.jobs.push(job);
        jobResults.push({ result: job.conclusion, outputs: job.outputs, end: job.completedAt, failedAt: job.conclusion === "failure" && !job.continueOnError ? job.failedAt : null, job });
      }
      // fail-fast: a failing matrix job cancels its siblings that were still running
      const failFast = def?.strategy?.["fail-fast"] !== false;
      const firstFail = Math.min(...jobResults.map((r) => r.failedAt ?? Infinity));
      if (mine.length > 1 && failFast && firstFail !== Infinity) {
        const failing = jobResults.find((r) => r.failedAt === firstFail)?.job;
        for (const r of jobResults) {
          if (!r.job || r.failedAt !== null || r.end <= firstFail || r.result === "skipped") continue;
          cancelJob(r.job, firstFail, `The strategy configuration was canceled because "${id}.${failing ? matrixLabel(failing.matrix) : ""}" failed`);
          r.result = "cancelled"; r.end = firstFail + 1;
        }
      }
      const res = jobResults.map((r) => r.result);
      const result = res.includes("failure") ? "failure" : res.includes("cancelled") ? "cancelled" : res.every((x) => x === "skipped") ? "skipped" : "success";
      const outputs = Object.assign({}, ...jobResults.map((r) => r.outputs ?? {}));
      results[id] = { result, outputs };
      jobEnds[id] = Math.max(start, ...jobResults.map((r) => r.end));
    }
    run.startedAt = run.createdAt;
    run.updatedAt = Math.max(run.createdAt + 5, ...Object.values(jobEnds)) + 1;
    const concl = run.jobs.filter((j) => !j.continueOnError).map((j) => j.conclusion);
    run.status = run.jobs.some((j) => j.status !== "completed") ? "queued" : "completed";
    run.conclusion = run.status !== "completed" ? null : concl.includes("failure") ? "failure" : concl.includes("cancelled") ? "cancelled" : "success";
  }
  const matrixLabel = (m) => (m ? "_" + Object.values(m).map((v) => exprString(v).replace(/[^A-Za-z0-9-]/g, "_")).join("_") : "");

  function cancelJob(job, at, why) {
    job.conclusion = "cancelled";
    job.completedAt = at + 1;
    let seenCut = false;
    for (const st of job.steps) {
      if (st.conclusion === "skipped") continue;
      if (st.end > at && !seenCut && st.name !== "Set up job") {
        st.conclusion = "cancelled";
        st.log.push({ t: at, text: "##[error]The operation was canceled." });
        seenCut = true;
      } else if (seenCut && !st.post && st.name !== "Complete job") { st.conclusion = "skipped"; st.log = []; }
    }
    job.annotations.push({ level: "failure", message: why, path: ".github", line: 1 });
    job.annotations.push({ level: "failure", message: "The operation was canceled.", path: ".github", line: 1 });
  }

  // A job that calls a reusable workflow: its jobs run as "caller / callee".
  async function runReusable(sh, rdir, data, run, ev, id, def, ctx, start, nextIndex) {
    const path = String(def.uses).replace(/^\.\//, "").replace(/@.*$/, "");
    const files = await filesAt(sh, rdir, run.sha);
    const text = files.get(path);
    const fail = (message) => {
      const job = { id: 64900000000 + run.id % 100000 * 10 + nextIndex(), key: `${id}:0`, name: def.name ?? id, status: "completed", conclusion: "failure", startedAt: start, completedAt: start + 1, steps: [], annotations: [{ level: "failure", message, path: run.workflow, line: 1 }], outputs: {} };
      run.jobs.push(job);
      return { result: "failure", outputs: {}, end: start + 2 };
    };
    if (!def.uses.startsWith("./")) return fail(`the sandbox can only call reusable workflows in the same repository (uses: ./.github/workflows/…), not ${def.uses}`);
    if (text === undefined) return fail(`error parsing called workflow "${run.workflow}" -> "./${path}" : failed to fetch workflow: workflow was not found.`);
    const parsed = readWorkflow(path, text);
    if (parsed.errors.length || !("workflow_call" in eventsOf(parsed.wf))) return fail(`error parsing called workflow "${run.workflow}" -> "./${path}" : workflow is not reusable as it is missing a \`on.workflow_call\` trigger`);
    if (!condition(def.if, { contexts: { ...ctx, env: {}, secrets: {} }, status: () => statusOfNeeds(ctx.needs) })) {
      run.jobs.push({ id: 64900000000 + run.id % 100000 * 10 + nextIndex(), key: `${id}:0`, name: def.name ?? id, status: "completed", conclusion: "skipped", startedAt: start, completedAt: start, steps: [], annotations: [], outputs: {} });
      return { result: "skipped", outputs: {}, end: start };
    }
    const callInputs = {};
    const declared = eventsOf(parsed.wf).workflow_call?.inputs ?? {};
    for (const [k, spec] of Object.entries(declared)) {
      const given = def.with?.[k];
      callInputs[k] = given !== undefined ? interpolate(String(given), { contexts: { ...ctx, env: {}, secrets: {} } }) : (spec?.default ?? (spec?.type === "boolean" ? false : ""));
      if (spec?.type === "number") callInputs[k] = Number(callInputs[k]);
      if (spec?.type === "boolean") callInputs[k] = callInputs[k] === true || callInputs[k] === "true";
    }
    const secrets = def.secrets === "inherit" ? null : Object.fromEntries(Object.entries(def.secrets ?? {}).map(([k, v]) => [k, v]));
    const results = {};
    let end = start;
    for (const inst of expandJobs(parsed.wf)) {
      const callee = parsed.wf.jobs[inst.id];
      const needs = [].concat(callee.needs ?? []);
      const job = await runJob(sh, rdir, data, run, parsed.wf, parsed, inst.id, inst,
        { ...ctx, inputs: callInputs, needs: Object.fromEntries(needs.map((n) => [n, results[n] ?? { result: "skipped", outputs: {} }])) },
        needs, results, end + 1, nextIndex(), { prefix: `${def.name ?? id} / `, secretsMap: secrets, keyPrefix: id });
      run.jobs.push(job);
      results[inst.id] = { result: job.conclusion, outputs: job.outputs };
      end = job.completedAt;
    }
    const res = Object.values(results).map((r) => r.result);
    const outputs = {};
    for (const [k, spec] of Object.entries(eventsOf(parsed.wf).workflow_call?.outputs ?? {})) {
      try { outputs[k] = interpolate(String(spec?.value ?? ""), { contexts: { ...ctx, jobs: results, env: {}, secrets: {} } }); } catch { outputs[k] = ""; }
    }
    return { result: res.includes("failure") ? "failure" : "success", outputs, end };
  }
  const statusOfNeeds = (needs) => {
    const r = Object.values(needs ?? {}).map((n) => n.result);
    return r.includes("failure") ? "failure" : r.includes("cancelled") ? "cancelled" : r.includes("skipped") ? "skipped" : "success";
  };

  /* ------------------------------------------------------------ one job on a runner */

  const PERMS = ["actions", "attestations", "checks", "contents", "deployments", "discussions", "id-token", "issues", "metadata", "models", "packages", "pages", "pull-requests", "repository-projects", "security-events", "statuses"];
  function tokenPermissions(wfPerms, jobPerms) {
    const p = jobPerms ?? wfPerms;
    if (p === undefined) return { contents: "read", metadata: "read", packages: "read" };
    if (p === "read-all") return Object.fromEntries(PERMS.filter((k) => k !== "id-token").map((k) => [k, "read"]));
    if (p === "write-all") return Object.fromEntries(PERMS.map((k) => [k, k === "metadata" ? "read" : "write"]));
    if (!p || typeof p !== "object") return { metadata: "read" };
    return { ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== "none")), metadata: "read" };
  }
  const permTitle = (k) => k.split("-").map((w) => (w === "id" ? "Id" : w[0].toUpperCase() + w.slice(1))).join("").replace(/^Idtoken$/, "IdToken");

  const iso = (t, k = 0) => {
    const d = new Date(Math.floor(t) * 1000);
    const frac = String(Math.floor(((t % 1) + k * 0.0000731) % 1 * 1e7)).padStart(7, "0");
    return d.toISOString().replace(/\.\d{3}Z$/, `.${frac}Z`);
  };

  async function runJob(sh, rdir, data, run, wf, parsed, id, inst, ctx, needs, results, start, index, opts = {}) {
    const def = wf.jobs[id] ?? {};
    const [owner, repo] = repoName(rdir).split("/");
    const job = {
      id: 64000000000 + (run.id % 1000000) * 37 + index * 7 + run.attempt, key: `${opts.keyPrefix ? opts.keyPrefix + "/" : ""}${id}:${inst.index ?? 0}`,
      jobId: id, matrix: inst.matrix, name: "", status: "completed", conclusion: "success", startedAt: start, completedAt: start, steps: [], annotations: [], outputs: {},
      continueOnError: false,
    };
    const secretValues = opts.secretsMap === undefined || opts.secretsMap === null
      ? Object.fromEntries(Object.entries(data.actions.secrets).map(([k, v]) => [k, v.value])) : {};
    const masks = new Set();
    const environment = typeof def.environment === "string" ? def.environment : def.environment?.name;
    if (environment && data.actions.envSecrets[environment]) for (const [k, v] of Object.entries(data.actions.envSecrets[environment])) secretValues[k] = v.value;
    secretValues.GITHUB_TOKEN = "ghs_" + fakeSha(String(run.id)).slice(0, 36);
    if (opts.secretsMap) for (const [k, v] of Object.entries(opts.secretsMap)) {
      try { secretValues[k] = interpolate(String(v), { contexts: { ...ctx, secrets: Object.fromEntries(Object.entries(data.actions.secrets).map(([a, b]) => [a, b.value])), env: {} } }); } catch { /* ignore */ }
    }
    for (const v of Object.values(secretValues)) if (v) masks.add(String(v));
    const mask = (text) => { let t = text; for (const m of [...masks].sort((a, b) => b.length - a.length)) if (m) t = t.split(m).join("***"); return t; };

    const matrixCtx = inst.matrix ?? {};
    const strategy = { "fail-fast": def.strategy?.["fail-fast"] !== false, "job-index": inst.index ?? 0, "job-total": inst.total ?? 1, "max-parallel": def.strategy?.["max-parallel"] ?? (inst.total ?? 1) };
    const runnerCtx = { os: "Linux", arch: "X64", name: `GitHub Actions ${1000000000 + index}`, temp: "/home/runner/work/_temp", tool_cache: "/opt/hostedtoolcache", environment: "github-hosted", debug: secretValues.ACTIONS_STEP_DEBUG === "true" ? "1" : "" };
    const env = {};
    const stepsCtx = {};
    let jobStatus = "success";
    const contexts = () => ({ ...ctx, github: { ...ctx.github, job: id }, env: { ...env }, secrets: secretValues, matrix: matrixCtx, strategy, runner: runnerCtx, steps: stepsCtx, job: { status: jobStatus, services: {} } });
    const exprCtx = (extra = {}) => ({ contexts: { ...contexts(), ...extra }, status: () => jobStatus, hashFiles: (pats) => hashFiles(pats) });

    // job name
    let name = id;
    if (def.name !== undefined) { try { name = interpolate(String(def.name), exprCtx()); } catch { name = String(def.name); } }
    else if (inst.matrix && Object.keys(inst.matrix).length) name = `${id} (${Object.values(inst.matrix).map(exprString).join(", ")})`;
    job.name = (opts.prefix ?? "") + name;

    // job-level if:
    let runIt;
    try { runIt = condition(def.if, { contexts: { ...contexts() }, status: () => statusOfNeeds(ctx.needs) }); }
    catch (e) { job.conclusion = "failure"; job.annotations.push({ level: "failure", message: `The workflow is not valid. ${run.workflow}: ${e.message}`, path: run.workflow, line: parsed.positions.jobs?.[id]?.line ?? 1 }); job.completedAt = start + 1; job.failedAt = start; return job; }
    if (!runIt) { job.conclusion = "skipped"; job.completedAt = start; return job; }
    job.continueOnError = def["continue-on-error"] === true;

    // runs-on
    const labels = [].concat(def["runs-on"] ?? []).map(String);
    const label = labels[0] ?? "";
    let interpLabel = label;
    try { interpLabel = interpolate(label, exprCtx()); } catch { /* keep */ }
    const known = /^(ubuntu-(latest|24\.04|22\.04|26\.04)(-arm)?|ubuntu-24\.04-arm|windows-(latest|2025|2022|11-arm)|macos-(latest|26|15|14|15-intel)|self-hosted)$/;
    if (!known.test(interpLabel)) {
      job.status = "queued"; job.conclusion = null; job.completedAt = null;
      job.waiting = `Waiting for a runner to pick up this job... (no runner has the label "${interpLabel}")`;
      return job;
    }
    if (interpLabel === "self-hosted") {
      job.status = "queued"; job.conclusion = null; job.completedAt = null;
      job.waiting = "Waiting for a self-hosted runner to pick up this job... (this repository has no self-hosted runners)";
      return job;
    }
    const os = /^windows/.test(interpLabel) ? "Windows" : /^macos/.test(interpLabel) ? "macOS" : "Linux";
    runnerCtx.os = os;
    const imageName = interpLabel === "ubuntu-latest" ? "ubuntu-24.04" : interpLabel;

    // the runner's shell: same file system, its own folder, variables and settings
    const wsRoot = `/home/runner/work/${repo}`;
    const ws = `${wsRoot}/${repo}`;
    const temp = "/home/runner/work/_temp";
    const rsh = new Shell();
    rsh.fs = sh.fs;
    rsh.commits = sh.commits;
    rsh.gh = sh.gh;
    rsh.globalConfig = new Map();
    rsh.gitVersion = IMAGE.git;
    rsh.nodeMajor = IMAGE.defaultNode;
    rsh.runner = { pages: data.actions.pages, owner, repo };
    await sh.fs.mkdir(ws, { recursive: true });
    await sh.fs.mkdir(temp + "/_runner_file_commands", { recursive: true });
    rsh.cwd = ws;
    const wfEnv = {};
    const permissions = tokenPermissions(wf.permissions, def.permissions);
    const baseEnv = {
      HOME: "/home/runner", USER: "runner", SHELL: "/bin/bash", PATH: "/home/runner/.local/bin:/opt/pipx_bin:/usr/local/bin:/usr/bin:/bin",
      CI: "true", GITHUB_ACTIONS: "true", GITHUB_ACTOR: run.actor, GITHUB_REPOSITORY: `${owner}/${repo}`, GITHUB_REPOSITORY_OWNER: owner,
      GITHUB_EVENT_NAME: run.event, GITHUB_REF: run.ref, GITHUB_REF_NAME: ctx.github.ref_name, GITHUB_REF_TYPE: ctx.github.ref_type, GITHUB_SHA: run.sha,
      GITHUB_RUN_ID: String(run.id), GITHUB_RUN_NUMBER: String(run.number), GITHUB_RUN_ATTEMPT: String(run.attempt), GITHUB_JOB: id,
      GITHUB_WORKFLOW: run.workflowName, GITHUB_WORKSPACE: ws, GITHUB_SERVER_URL: "https://github.com", GITHUB_API_URL: "https://api.github.com",
      GITHUB_HEAD_REF: ctx.github.head_ref, GITHUB_BASE_REF: ctx.github.base_ref, RUNNER_OS: os, RUNNER_ARCH: "X64", RUNNER_TEMP: temp,
      RUNNER_TOOL_CACHE: "/opt/hostedtoolcache", RUNNER_NAME: runnerCtx.name, RUNNER_ENVIRONMENT: "github-hosted", ImageOS: "ubuntu24",
    };
    const evalMap = (m, c) => Object.fromEntries(Object.entries(m ?? {}).map(([k, v]) => [k, interpolate(v === null ? "" : String(v), c)]));
    try {
      Object.assign(wfEnv, evalMap(wf.env, exprCtx()));
      Object.assign(env, wfEnv);
      Object.assign(env, evalMap(def.env, exprCtx()));
    } catch (e) {
      return failSetup(job, start, `${e.message}`, run, parsed, id);
    }
    if (typeof def.environment === "object" && def.environment?.url) job.environmentUrlExpr = def.environment.url;
    job.environment = environment ?? null;

    // the steps, with the actions they use
    const steps = [].concat(def.steps ?? []);
    let t = start;
    const addStep = (stepName, extra = {}) => { const st = { name: stepName, number: job.steps.length + 1, conclusion: "success", log: [], start: t, end: t, ...extra }; job.steps.push(st); return st; };
    const logTo = (st) => (text) => { for (const line of String(text).replace(/\n$/, "").split("\n")) st.log.push({ t: t + 0.1031 + st.log.length * 0.0137, text: mask(line) }); };

    // Set up job
    const setup = addStep("Set up job");
    const L = logTo(setup);
    L(`Current runner version: '${RUNNER_VERSION}'`);
    if (os === "Linux") {
      L(`##[group]Operating System\nUbuntu\n${imageName.includes("22.04") ? "22.04.5" : imageName.includes("26.04") ? "26.04" : IMAGE.os}\nLTS\n##[endgroup]`);
      L(`##[group]Runner Image\nImage: ${imageName}\nVersion: ${IMAGE.version}\nIncluded Software: https://github.com/actions/runner-images/blob/ubuntu24/${IMAGE.version.replace(/\.\d+$/, "")}/images/ubuntu/Ubuntu2404-Readme.md\nImage Release: https://github.com/actions/runner-images/releases/tag/ubuntu24%2F${IMAGE.version.replace(/\.\d+$/, "")}\n##[endgroup]`);
    } else {
      L(`##[group]Runner Image\nImage: ${interpLabel}\n##[endgroup]`);
      L(`##[notice]The sandbox runs every job on Linux with bash. On GitHub, this job runs on ${os}${os === "Windows" ? ", where run: steps use PowerShell (pwsh) unless you set shell: bash" : ""}.`);
    }
    L(`##[group]GITHUB_TOKEN Permissions\n${Object.entries(permissions).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${permTitle(k)}: ${v}`).join("\n")}\n##[endgroup]`);
    L("Secret source: Actions");
    L("Prepare workflow directory");
    L("Prepare all required actions");
    // resolve the actions this job uses
    const usesList = steps.filter((s) => typeof s?.uses === "string" && !s.uses.startsWith("./") && !s.uses.startsWith("docker://")).map((s) => s.uses);
    if (usesList.length) L("Getting action download info");
    for (const u of [...new Set(usesList)]) {
      const [nameRef, ver = ""] = u.split("@");
      const spec = ACTIONS[nameRef];
      const sha40 = /^[0-9a-f]{40}$/.test(ver);
      const major = Number(/^v(\d+)(?:\.\d+){0,2}$/.exec(ver)?.[1]);
      if (!spec) {
        const known3 = /^[\w.-]+\/[\w.-]+$/.test(nameRef);
        setup.conclusion = "failure";
        L(`##[error]${known3 ? `The sandbox doesn't simulate the action '${nameRef}'. On GitHub, it would be downloaded from https://github.com/${nameRef}.` : `Unable to resolve action \`${u}\`, repository not found`}`);
        continue;
      }
      if (DEPRECATED[nameRef]?.includes(major)) {
        setup.conclusion = "failure";
        L(`##[error]This request has been automatically failed because it uses a deprecated version of \`${nameRef}: v${major}\`. Learn more: https://github.blog/changelog/2024-04-16-deprecation-notice-v3-of-the-artifact-actions/`);
        continue;
      }
      const validSha = sha40 && Object.values(spec.sha).includes(ver);
      if (!(spec.majors.includes(major) || validSha)) {
        setup.conclusion = "failure";
        L(`##[error]Unable to resolve action \`${u}\`, unable to find version \`${ver}\``);
        continue;
      }
      const sha = validSha ? ver : spec.sha[major] ?? fakeSha(u);
      L(`Download action repository '${u}' (SHA:${sha})`);
    }
    if (setup.conclusion !== "failure") L(`Complete job name: ${job.name}`);
    t += 1;
    setup.end = t;
    if (setup.conclusion === "failure") {
      job.conclusion = "failure";
      job.failedAt = t;
      job.completedAt = t + 1;
      return job;
    }

    // run the steps
    const posts = [];
    const fileCmd = (kind) => `${temp}/_runner_file_commands/${kind}_${fakeSha(job.id + kind + job.steps.length).slice(0, 8)}-${fakeSha(kind).slice(0, 4)}`;
    const readKV = (text) => {
      const out = {};
      const lines = (text ?? "").split("\n");
      for (let k = 0; k < lines.length; k++) {
        const ln = lines[k];
        const hd = /^([^=<]+)<<(.+)$/.exec(ln);
        if (hd) { const body = []; k++; while (k < lines.length && lines[k] !== hd[2]) body.push(lines[k++]); out[hd[1]] = body.join("\n"); continue; }
        const eq = ln.indexOf("=");
        if (eq > 0) out[ln.slice(0, eq)] = ln.slice(eq + 1);
      }
      return out;
    };
    function hashFiles(patterns) {
      const files = sh.fs.walkFiles(ws).map((f) => f.slice(ws.length + 1)).filter((f) => !f.startsWith(".git/")).filter((f) => patterns.some((p) => matchList([p], f)));
      if (!files.length) return "";
      return sha256(files.sort().map((f) => sha256(sh.fs.text(`${ws}/${f}`) ?? "")).join(""));
    }

    const runCtxFor = (stepEnv) => ({ ...exprCtx(), contexts: { ...exprCtx().contexts, env: { ...env, ...stepEnv } } });
    for (let k = 0; k < steps.length; k++) {
      const s = steps[k] ?? {};
      const kind = typeof s.run === "string" || typeof s.run === "number" ? "run" : "uses";
      let stepName;
      try { stepName = s.name !== undefined ? interpolate(String(s.name), exprCtx()) : kind === "run" ? `Run ${String(s.run).trim().split("\n")[0]}` : `Run ${s.uses}`; }
      catch { stepName = String(s.name); }
      const st = addStep(stepName, { stepDef: s });
      const log = logTo(st);
      let run_ = false;
      try { run_ = condition(s.if, exprCtx()); }
      catch (e) { log(`##[error]${e.message}`); st.conclusion = "failure"; }
      if (st.conclusion !== "failure" && !run_) {
        st.conclusion = "skipped";
        if (s.id) stepsCtx[s.id] = { outputs: {}, outcome: "skipped", conclusion: "skipped" };
        continue;
      }
      let outcome = st.conclusion === "failure" ? "failure" : "success";
      const outputs = {};
      if (outcome === "success") {
        let stepEnv = {};
        try { stepEnv = evalMap(s.env, exprCtx()); } catch (e) { log(`##[error]${e.message}`); outcome = "failure"; }
        if (outcome === "success" && kind === "run") {
          let script;
          try { script = interpolate(String(s.run), runCtxFor(stepEnv)); } catch (e) { log(`##[error]${e.message}`); outcome = "failure"; }
          if (script !== undefined) {
            const shellName = s.shell ?? def.defaults?.run?.shell ?? wf.defaults?.run?.shell;
            const shellLine = shellName === "bash" ? "/usr/bin/bash --noprofile --norc -e -o pipefail {0}" : shellName === "sh" ? "/usr/bin/sh -e {0}" : shellName && shellName !== "bash" ? null : "/usr/bin/bash -e {0}";
            const lines = script.replace(/\n$/, "").split("\n");
            log(`##[group]Run ${lines[0]}`);
            for (const ln of lines) log(ln);
            if (!shellLine) { log("##[endgroup]"); log(`##[error]The sandbox runs bash and sh steps only (shell: ${shellName}).`); outcome = "failure"; }
            else {
              log(`shell: ${shellLine}`);
              const shownEnv = { ...env, ...stepEnv };
              if (Object.keys(shownEnv).length) { log("env:"); for (const [kk, vv] of Object.entries(shownEnv)) log(`  ${kk}: ${vv}`); }
              log("##[endgroup]");
              const outFile = fileCmd("set_output"), envFile = fileCmd("set_env"), pathFile = fileCmd("add_path"), sumFile = fileCmd("step_summary");
              for (const f of [outFile, envFile, pathFile, sumFile]) await sh.fs.writeFile(f, "");
              rsh.env = { ...baseEnv, ...env, ...stepEnv, GITHUB_OUTPUT: outFile, GITHUB_ENV: envFile, GITHUB_PATH: pathFile, GITHUB_STEP_SUMMARY: sumFile, GITHUB_ACTION: s.id ?? `__run${k > 0 ? "_" + k : ""}` };
              const wd = s["working-directory"] ?? def.defaults?.run?.["working-directory"] ?? wf.defaults?.run?.["working-directory"];
              rsh.cwd = wd ? rsh.abs(ws + "/" + interpolate(String(wd), exprCtx())) : ws;
              if (!sh.fs.isDir(rsh.cwd)) { log(`##[error]An error occurred trying to start process '/usr/bin/bash' with working directory '${rsh.cwd}'. No such file or directory`); outcome = "failure"; }
              else {
                rsh.errexit = false; rsh.pipefail = shellName === "bash"; rsh.nounset = false; rsh.xtrace = false;
                const collected = [];
                const savedPush = rsh.push;
                rsh.push = (kindOut, text) => { if (kindOut === "out" || kindOut === "err") collected.push(text); };
                let status;
                try { status = await rsh.runScript(script, { echo: false, errexit: true }); }
                catch (e) { collected.push(`Sandbox error: ${e && e.message}\n`); status = 1; }
                finally { rsh.push = savedPush; }
                const outText = collected.join("");
                for (const line of outText.replace(/\n$/, "").split("\n")) {
                  if (outText === "") break;
                  const cmd = /^::([a-z-]+)(?: ([^:]*))?::(.*)$/.exec(line);
                  if (cmd) {
                    const [, c, params = "", msg] = cmd;
                    const props = Object.fromEntries(params.split(",").filter(Boolean).map((p) => p.split("=").map((x) => x.trim())));
                    if (c === "add-mask") { masks.add(msg); continue; }
                    if (c === "group") { log(`##[group]${msg}`); continue; }
                    if (c === "endgroup") { log("##[endgroup]"); continue; }
                    if (c === "debug") { if (runnerCtx.debug) log(`##[debug]${msg}`); continue; }
                    if (["error", "warning", "notice"].includes(c)) {
                      log(`##[${c}]${msg}`);
                      job.annotations.push({ level: c === "error" ? "failure" : c, message: mask(msg), path: props.file ?? ".github", line: Number(props.line ?? 1), title: props.title });
                      continue;
                    }
                    if (c === "set-output" || c === "save-state") { log(`##[warning]The \`${c}\` command is disabled. Please upgrade to using Environment Files or opt into unsecure command execution by setting the \`ACTIONS_ALLOW_UNSECURE_COMMANDS\` environment variable to \`true\`. For more information see: https://github.blog/changelog/2022-10-11-github-actions-deprecating-save-state-and-set-output-commands/`); continue; }
                  }
                  log(line);
                }
                Object.assign(outputs, readKV(sh.fs.text(outFile)));
                Object.assign(env, readKV(sh.fs.text(envFile)));
                if (status !== 0) {
                  log(`##[error]Process completed with exit code ${status}.`);
                  job.annotations.push({ level: "failure", message: `Process completed with exit code ${status}.`, path: ".github", line: 1 });
                  outcome = "failure";
                }
              }
            }
          }
        } else if (outcome === "success") {
          const postsBefore = posts.length;
          const r = await runAction(s, st, log, { stepEnv, outputs, posts, exprCtx, ws, wsRoot, rsh, baseEnv, env, job, run, data, rdir, owner, repo, permissions, environment, masks, mask, hashFiles, ctxFor: exprCtx });
          outcome = r;
          for (const p of posts.slice(postsBefore)) p.stepName = stepName;
        }
      }
      const dur = kind === "run" ? (String(s.run).includes("--test") || /\btest\b/.test(String(s.run)) ? 2 : 1) : (s.uses ?? "").includes("setup-node") ? 1 : 1;
      t += dur;
      st.end = t;
      const conclusion = outcome === "failure" && s["continue-on-error"] === true ? "success" : outcome;
      st.conclusion = outcome === "failure" ? "failure" : "success";
      if (outcome === "failure" && s["continue-on-error"] === true) st.conclusion = "success";
      if (s.id) stepsCtx[s.id] = { outputs, outcome, conclusion };
      if (conclusion === "failure") { jobStatus = "failure"; if (job.failedAt === undefined) job.failedAt = t; }
    }
    // post steps, in reverse order
    for (const p of posts.reverse()) {
      const st = addStep(`Post ${p.stepName}`, { post: true });
      if (!condition(p.if ?? "always()", exprCtx())) { st.conclusion = "skipped"; continue; }
      await p.fn(logTo(st), st);
      t += 0.5;
      st.end = t;
    }
    // Complete job
    const done = addStep("Complete job");
    const D = logTo(done);
    if (def.outputs) {
      D("Evaluate and set job outputs");
      for (const [k, v] of Object.entries(def.outputs)) {
        try { job.outputs[k] = interpolate(String(v), exprCtx()); } catch { job.outputs[k] = ""; }
        D(`Set output '${k}'`);
      }
    }
    if (job.environmentUrlExpr) { try { job.environmentUrl = interpolate(String(job.environmentUrlExpr), exprCtx()); } catch { /* ignore */ } }
    D("Cleaning up orphan processes");
    t += 1;
    done.end = t;
    job.conclusion = jobStatus === "failure" ? "failure" : "success";
    job.completedAt = t;
    // the runner is thrown away after the job
    for (const key of [...sh.fs.nodes.keys()]) if (key === wsRoot || key.startsWith(wsRoot + "/") || key.startsWith(temp + "/_runner_file_commands/")) sh.fs.nodes.delete(key);
    return job;
  }

  function failSetup(job, start, message, run, parsed, id) {
    job.conclusion = "failure";
    job.annotations.push({ level: "failure", message, path: run.workflow, line: parsed.positions.jobs?.[id]?.line ?? 1 });
    job.completedAt = start + 1;
    job.failedAt = start;
    return job;
  }

  /* ------------------------------------------------------------ the official actions the sandbox simulates */

  async function runAction(s, st, log, o) {
    const uses = String(s.uses);
    const [nameRef, ver] = uses.split("@");
    let withV = {};
    try { withV = Object.fromEntries(Object.entries(s.with ?? {}).map(([k, v]) => [k, interpolate(v === null ? "" : String(v), o.exprCtx())])); }
    catch (e) { log(`##[error]${e.message}`); return "failure"; }
    const group = (shown) => {
      log(`##[group]Run ${uses}`);
      const entries = Object.entries(shown);
      if (entries.length) { log("with:"); for (const [k, v] of entries) log(`  ${k}: ${v}`); }
      const envShown = { ...o.env, ...o.stepEnv };
      if (Object.keys(envShown).length) { log("env:"); for (const [k, v] of Object.entries(envShown)) log(`  ${k}: ${v}`); }
      log("##[endgroup]");
    };
    const ws = o.ws;
    if (uses.startsWith("./")) return runComposite(uses, s, st, log, o, withV);

    if (nameRef === "actions/checkout") {
      const fetchDepth = withV["fetch-depth"] ?? "1";
      group({ repository: `${o.owner}/${o.repo}`, token: "***", "ssh-strict": "true", "ssh-user": "git", "persist-credentials": "true", clean: "true", "sparse-checkout-cone-mode": "true", "fetch-depth": fetchDepth, "fetch-tags": "false", "show-progress": "true", lfs: "false", submodules: "false", "set-safe-directory": "true", ...withV });
      if ((o.run.event === "pull_request_target" || o.run.event === "workflow_run") && withV.ref && withV["allow-unsafe-pr-checkout"] !== "true") {
        log("##[error]Refusing to check out code from a fork pull request on a pull_request_target or workflow_run event. Set allow-unsafe-pr-checkout: true to opt in after reviewing the risks: https://gh.io/securely-using-pull_request_target");
        return "failure";
      }
      log(`Syncing repository: ${o.owner}/${o.repo}`);
      log(`##[group]Getting Git version info\nWorking directory is '${ws}'\n[command]/usr/bin/git version\ngit version ${IMAGE.git}\n##[endgroup]`);
      log(`[command]/usr/bin/git init ${ws}\nInitialized empty Git repository in ${ws}/.git/`);
      log(`[command]/usr/bin/git remote add origin https://github.com/${o.owner}/${o.repo}`);
      // the checkout itself: copy the objects and point a branch at the commit
      const fs = o.rsh.fs;
      await git.init({ fs, dir: ws, defaultBranch: "main" });
      await copyObjects(o.rsh, o.rdir, ws);
      await git.addRemote({ fs, dir: ws, remote: "origin", url: `https://github.com/${o.owner}/${o.repo}`, force: true });
      const run = o.run;
      const isPr = run.ref.startsWith("refs/pull/");
      const isTag = run.ref.startsWith("refs/tags/");
      const branch = run.ref.replace(/^refs\/heads\//, "");
      log("##[group]Fetching the repository");
      if (isPr) log(`[command]/usr/bin/git -c protocol.version=2 fetch --no-tags --prune --no-recurse-submodules --depth=${fetchDepth} origin +${run.sha}:refs/remotes/pull/${run.pr}/merge`);
      else if (isTag) log(`[command]/usr/bin/git -c protocol.version=2 fetch --no-tags --prune --no-recurse-submodules --depth=${fetchDepth} origin +${run.sha}:${run.ref}`);
      else log(`[command]/usr/bin/git -c protocol.version=2 fetch --no-tags --prune --no-recurse-submodules --depth=${fetchDepth} origin +${run.sha}:refs/remotes/origin/${branch}`);
      log("##[endgroup]");
      log("##[group]Determining the checkout info\n##[endgroup]");
      log("##[group]Checking out the ref");
      if (isPr) {
        await git.writeRef({ fs, dir: ws, ref: `refs/remotes/pull/${run.pr}/merge`, value: run.sha, force: true });
        await git.checkout({ fs, dir: ws, ref: run.sha, force: true });
        log(`[command]/usr/bin/git checkout --progress --force refs/remotes/pull/${run.pr}/merge\nNote: switching to 'refs/remotes/pull/${run.pr}/merge'.\n\nYou are in 'detached HEAD' state.\nHEAD is now at ${run.sha.slice(0, 7)} Merge ${run.headSha} into ${await git.resolveRef({ fs, dir: o.rdir, ref: `refs/heads/${o.run.baseBranch ?? "main"}` }).catch(() => run.sha)}`);
      } else if (isTag) {
        await git.writeRef({ fs, dir: ws, ref: run.ref, value: run.sha, force: true });
        await git.checkout({ fs, dir: ws, ref: run.sha, force: true });
        log(`[command]/usr/bin/git checkout --progress --force ${run.ref}\nNote: switching to '${run.ref}'.\n\nYou are in 'detached HEAD' state.\nHEAD is now at ${run.sha.slice(0, 7)}`);
      } else {
        await git.writeRef({ fs, dir: ws, ref: `refs/remotes/origin/${branch}`, value: run.sha, force: true });
        await git.writeRef({ fs, dir: ws, ref: `refs/heads/${branch}`, value: run.sha, force: true });
        await git.writeRef({ fs, dir: ws, ref: "HEAD", value: `refs/heads/${branch}`, symbolic: true, force: true });
        await git.checkout({ fs, dir: ws, ref: branch, force: true });
        await git.setConfig({ fs, dir: ws, path: `branch.${branch}.remote`, value: "origin" });
        await git.setConfig({ fs, dir: ws, path: `branch.${branch}.merge`, value: `refs/heads/${branch}` });
        log(`[command]/usr/bin/git checkout --progress --force -B ${branch} refs/remotes/origin/${branch}\nSwitched to a new branch '${branch}'\nbranch '${branch}' set up to track 'origin/${branch}'.`);
      }
      log("##[endgroup]");
      log(`[command]/usr/bin/git log -1 --format=%H\n${run.sha}`);
      o.posts.push({ name: uses, fn: async (L) => { L(`Post job cleanup.\n[command]/usr/bin/git version\ngit version ${IMAGE.git}\nTemporarily overriding HOME='/home/runner/work/_temp/${fakeSha(uses).slice(0, 8)}' before making global git config changes\n[command]/usr/bin/git config --local --name-only --get-regexp core\\.sshCommand\n[command]/usr/bin/git config --local --name-only --get-regexp http\\.https\\:\\/\\/github\\.com\\/\\.extraheader`); } });
      return "success";
    }

    if (nameRef === "actions/setup-node") {
      const shown = { ...withV, "check-latest": withV["check-latest"] ?? "false", token: "***" };
      group(shown);
      let spec = withV["node-version"] ?? "";
      if (!spec && withV["node-version-file"]) {
        const f = o.rsh.fs.text(`${ws}/${withV["node-version-file"]}`);
        if (f === null) { log(`##[error]The specified node version file at: ${ws}/${withV["node-version-file"]} does not exist`); return "failure"; }
        spec = f.trim().replace(/^v/, "");
        if (withV["node-version-file"].endsWith("package.json")) { try { const pj = JSON.parse(f); spec = pj.volta?.node ?? pj.engines?.node ?? ""; } catch { spec = ""; } }
      }
      const major = Number(/^(?:lts\/\*|latest|node)$/.test(spec) ? (spec === "lts/*" ? 24 : 26) : /^(\d+)/.exec(String(spec).replace(/^[>=^~v ]+/, ""))?.[1]);
      if (!spec) {
        log("##[warning]node-version or node-version-file not supplied, using node version from PATH");
      } else if (!NODE_RELEASES[major]) {
        log(`Attempting to download ${spec}...\n##[error]Unable to find Node version '${spec}' for platform linux and architecture x64.`);
        return "failure";
      } else {
        const rel = NODE_RELEASES[major];
        const v = rel.version.slice(1);
        if (major === 26) log(`Attempting to download ${spec}...\nAcquiring ${v} - x64 from https://github.com/actions/node-versions/releases/download/${v}-${18000000000 + major * 13}/node-${v}-linux-x64.tar.gz\nExtracting ...\nAdding to the cache ...`);
        else log(`Found in cache @ /opt/hostedtoolcache/node/${v}/x64`);
        o.rsh.nodeMajor = major;
      }
      const rel = NODE_RELEASES[o.rsh.nodeMajor];
      log(`##[group]Environment details\nnode: ${rel.version}\nnpm: ${rel.npm}\nyarn: 1.22.22\n##[endgroup]`);
      if (withV.cache) {
        if (!["npm", "yarn", "pnpm"].includes(withV.cache)) { log(`##[error]Caching for '${withV.cache}' is not supported`); return "failure"; }
        const lock = ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock"].find((f) => o.rsh.fs.exists(`${ws}/${f}`));
        if (!lock) { log(`##[error]Dependencies lock file is not found in ${ws}. Supported file patterns: package-lock.json,npm-shrinkwrap.json,yarn.lock`); return "failure"; }
        const key = `node-cache-Linux-x64-npm-${o.hashFiles(["**/package-lock.json"])}`;
        log(`##[group]Get npm cache directory\n[command]/opt/hostedtoolcache/node/${rel.version.slice(1)}/x64/bin/npm config get cache\n/home/runner/.npm\n##[endgroup]`);
        const hit = o.data.actions.caches[key];
        if (hit) { log(`Cache Size: ~0 MB (${hit.size} B)\nCache restored successfully\nCache restored from key: ${key}`); o.outputs["cache-hit"] = "true"; }
        else { log("npm cache is not found"); o.outputs["cache-hit"] = "false"; }
        o.posts.push({ name: s.uses, if: "success()", fn: async (L) => {
          if (hit) { L(`Cache hit occurred on the primary key ${key}, not saving cache.`); return; }
          o.data.actions.caches[key] = { size: 18, created: o.run.createdAt, files: {} };
          L(`[command]/opt/hostedtoolcache/node/${rel.version.slice(1)}/x64/bin/npm config get cache\n/home/runner/.npm\nCache Size: ~0 MB (18 B)\nCache saved with the key: ${key}`);
        } });
      } else {
        // setup-node always has a post step (it saves the package cache when caching is on); it runs only on success
        o.posts.push({ name: s.uses, if: "success()", fn: async (L) => { L("Post job cleanup."); } });
      }
      return "success";
    }

    if (nameRef === "actions/cache") {
      group({ ...withV, "enableCrossOsArchive": "false", "fail-on-cache-miss": withV["fail-on-cache-miss"] ?? "false", "lookup-only": "false" });
      const key = withV.key;
      if (!key) { log("##[error]Input required and not supplied: key"); return "failure"; }
      const paths = (withV.path ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
      if (!paths.length) { log("##[error]Input required and not supplied: path"); return "failure"; }
      const restoreKeys = (withV["restore-keys"] ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
      const caches = o.data.actions.caches;
      let hitKey = caches[key] ? key : null;
      if (!hitKey) for (const rk of restoreKeys) { const found = Object.keys(caches).filter((k) => k.startsWith(rk)).sort((a, b) => caches[b].created - caches[a].created)[0]; if (found) { hitKey = found; break; } }
      if (hitKey) {
        for (const [p, text] of Object.entries(caches[hitKey].files)) { const abs = `${ws}/${p}`; await o.rsh.fs.mkdir(abs.slice(0, abs.lastIndexOf("/")), { recursive: true }); await o.rsh.fs.writeFile(abs, text); }
        log(`Cache Size: ~0 MB (${caches[hitKey].size} B)\n[command]/usr/bin/tar -xf /home/runner/work/_temp/${fakeSha(key).slice(0, 8)}/cache.tzst -P -C ${ws} --use-compress-program unzstd\nCache restored successfully\nCache restored from key: ${hitKey}`);
      } else log(`Cache not found for input keys: ${[key, ...restoreKeys].join(", ")}`);
      o.outputs["cache-hit"] = String(hitKey === key);
      o.posts.push({ name: s.uses, fn: async (L) => {
        if (hitKey === key) { L(`Cache hit occurred on the primary key ${key}, not saving cache.`); return; }
        const files = {};
        for (const p of paths) {
          const abs = o.rsh.abs(ws + "/" + p.replace(/^~\//, "/home/runner/"));
          for (const f of o.rsh.fs.isDir(abs) ? o.rsh.fs.walkFiles(abs) : o.rsh.fs.exists(abs) ? [abs] : []) files[f.slice(ws.length + 1)] = o.rsh.fs.text(f) ?? "";
        }
        if (!Object.keys(files).length) { L(`##[warning]Path Validation Error: Path(s) specified in the action for caching do(es) not exist, hence no cache is being saved.`); return; }
        const size = Object.values(files).reduce((n, x) => n + x.length, 0);
        caches[key] = { size, created: o.run.createdAt, files };
        L(`[command]/usr/bin/tar --posix -cf cache.tzst --exclude cache.tzst -P -C ${ws} --files-from manifest.txt --use-compress-program zstdmt\nCache Size: ~0 MB (${size} B)\nCache saved successfully\nCache saved with key: ${key}`);
      } });
      return "success";
    }

    if (nameRef === "actions/upload-artifact" || nameRef === "actions/upload-pages-artifact") {
      const pages = nameRef === "actions/upload-pages-artifact";
      const name = withV.name ?? (pages ? "github-pages" : "artifact");
      const shown = pages ? { name, path: withV.path ?? "_site/", "retention-days": withV["retention-days"] ?? "1" } : { name, path: withV.path ?? "", "if-no-files-found": withV["if-no-files-found"] ?? "warn", "compression-level": "6", overwrite: "false", "include-hidden-files": "false" };
      group(shown);
      if (!pages && !withV.path) { log("##[error]Input required and not supplied: path"); return "failure"; }
      const paths = String(withV.path ?? "_site/").split("\n").map((x) => x.trim()).filter(Boolean);
      const files = {};
      for (const p of paths) {
        const abs = o.rsh.abs(ws + "/" + p);
        const base = o.rsh.fs.isDir(abs) ? abs : abs.slice(0, abs.lastIndexOf("/"));
        const list = o.rsh.fs.isDir(abs) ? o.rsh.fs.walkFiles(abs) : o.rsh.fs.exists(abs) ? [abs] : o.rsh.glob(p).map((g) => o.rsh.abs(ws + "/" + g));
        for (const f of list) if (!/\/\.(git|github)\//.test(f.slice(base.length)) && (pages || !/\/\./.test(f.slice(base.length)))) files[f.slice((o.rsh.fs.isDir(abs) ? abs : base).length + 1)] = o.rsh.fs.text(f) ?? "";
      }
      if (!Object.keys(files).length) {
        if (pages) { log(`##[group]Archive artifact\n[command]/usr/bin/tar --dereference --hard-dereference --directory ${o.rsh.abs(ws + "/" + paths[0])} -cvf /home/runner/work/_temp/artifact.tar --exclude=.git --exclude=.github .\n/usr/bin/tar: ${o.rsh.abs(ws + "/" + paths[0])}: Cannot open: No such file or directory\n/usr/bin/tar: Error is not recoverable: exiting now\n##[endgroup]\n##[error]Process completed with exit code 2.`); return "failure"; }
        const how = withV["if-no-files-found"] ?? "warn";
        const msg = `No files were found with the provided path: ${paths.join(", ")}. No artifacts will be uploaded.`;
        if (how === "error") { log(`##[error]${msg}`); return "failure"; }
        if (how === "warn") { log(`##[warning]${msg}`); o.job.annotations.push({ level: "warning", message: msg, path: ".github", line: 1 }); }
        else log(msg);
        return "success";
      }
      if (o.run.artifacts.some((a) => a.name === name && a.attempt === o.run.attempt)) {
        log(`##[error]Failed to CreateArtifact: Received non-retryable error: Failed request: (409) Conflict: an artifact with this name already exists on the workflow run`);
        return "failure";
      }
      const size = Object.values(files).reduce((n, x) => n + x.length, 0) + 120 * Object.keys(files).length;
      const aid = 4310000000 + o.data.actions.nextArtifact++ * 97;
      if (pages) log(`##[group]Archive artifact\n[command]/usr/bin/tar --dereference --hard-dereference --directory ${o.rsh.abs(ws + "/" + paths[0])} -cvf /home/runner/work/_temp/artifact.tar --exclude=.git --exclude=.github .\n${Object.keys(files).sort().map((f) => "./" + f).join("\n")}\n##[endgroup]`);
      log(`With the provided path, there will be ${pages ? 1 : Object.keys(files).length} file${(pages ? 1 : Object.keys(files).length) === 1 ? "" : "s"} uploaded\nArtifact name is valid!\nRoot directory input is valid!\nBeginning upload of artifact content to blob storage\nUploaded bytes ${size}\nFinished uploading artifact content to blob storage!\nSHA256 digest of uploaded artifact zip is ${sha256(JSON.stringify(files))}\nFinalizing artifact upload\nArtifact ${name}.zip successfully finalized. Artifact ID ${aid}\nArtifact ${name} has been successfully uploaded! Final size is ${size} bytes. Artifact ID is ${aid}\nArtifact download URL: ${runUrl(o.rdir, o.run.id)}/artifacts/${aid}`);
      o.run.artifacts.push({ id: aid, name, files, size, attempt: o.run.attempt, pages });
      o.outputs["artifact-id"] = String(aid);
      o.outputs["artifact-url"] = `${runUrl(o.rdir, o.run.id)}/artifacts/${aid}`;
      return "success";
    }

    if (nameRef === "actions/download-artifact") {
      group({ name: withV.name ?? "", path: withV.path ?? "", "merge-multiple": "false", repository: `${o.owner}/${o.repo}`, "run-id": String(o.run.id) });
      const wanted = withV.name ? o.run.artifacts.filter((a) => a.name === withV.name) : o.run.artifacts.filter((a) => !a.pages);
      if (withV.name && !wanted.length) { log(`##[error]Unable to download artifact(s): Artifact not found for name: ${withV.name}\n        Please ensure that your artifact is not expired and the artifact was uploaded using a compatible version of toolkit/upload-artifact.\n        For more information, visit the GitHub Artifacts FAQ: https://github.com/actions/toolkit/blob/main/packages/artifact/docs/faq.md`); return "failure"; }
      log(withV.name ? "Downloading single artifact" : `Found ${wanted.length} artifact(s)`);
      log(`Preparing to download the following artifacts:\n${wanted.map((a) => `- ${a.name} (ID: ${a.id}, Size: ${a.size}, Expected Digest: sha256:${sha256(JSON.stringify(a.files))})`).join("\n")}`);
      for (const a of wanted) {
        const dest = o.rsh.abs(ws + "/" + (withV.path ?? "") + (withV.name ? "" : "/" + a.name));
        log(`Redirecting to blob download url: https://productionresultssa${a.id % 20}.blob.core.windows.net/actions-results/${fakeSha(String(a.id)).slice(0, 8)}/workflow-job-run-${fakeSha(o.job.name).slice(0, 8)}/artifacts/${fakeSha(a.name)}.zip\nStarting download of artifact to: ${dest}`);
        for (const [p, text] of Object.entries(a.files)) { const abs = `${dest}/${p}`; await o.rsh.fs.mkdir(abs.slice(0, abs.lastIndexOf("/")), { recursive: true }); await o.rsh.fs.writeFile(abs, text); }
        log(`SHA256 digest of downloaded artifact is ${sha256(JSON.stringify(a.files))}\nArtifact download completed successfully.`);
      }
      log(`Total of ${wanted.length} artifact(s) downloaded\nDownload artifact has finished successfully`);
      o.outputs["download-path"] = o.rsh.abs(ws + "/" + (withV.path ?? ""));
      return "success";
    }

    if (nameRef === "actions/configure-pages") {
      group({ token: "***", enablement: withV.enablement ?? "false" });
      const pages = o.data.actions.pages;
      if (!pages.enabled) {
        if (withV.enablement === "true") {
          log(`##[error]Create Pages site failed. Error: Resource not accessible by integration - https://docs.github.com/rest/pages/pages#create-a-apiname-pages-site`);
          log(`##[error]Get Pages site failed. Please verify that the repository has Pages enabled and configured to build using GitHub Actions, or consider exploring the \`enablement\` parameter for this action. Error: Not Found - https://docs.github.com/rest/pages/pages#get-a-apiname-pages-site`);
          return "failure";
        }
        log(`##[error]Get Pages site failed. Please verify that the repository has Pages enabled and configured to build using GitHub Actions, or consider exploring the \`enablement\` parameter for this action. Error: Not Found - https://docs.github.com/rest/pages/pages#get-a-apiname-pages-site`);
        return "failure";
      }
      Object.assign(o.outputs, { base_url: `https://${o.owner}.github.io/${o.repo}`, origin: `https://${o.owner}.github.io`, host: `${o.owner}.github.io`, base_path: `/${o.repo}` });
      return "success";
    }

    if (nameRef === "actions/deploy-pages") {
      group({ token: "***", timeout: "600000", error_count: "10", reporting_interval: "5000", artifact_name: withV.artifact_name ?? "github-pages", preview: "false" });
      if (o.permissions["id-token"] !== "write") { log('##[error]Ensure GITHUB_TOKEN has permission "id-token: write".'); return "failure"; }
      const art = o.run.artifacts.find((a) => a.name === (withV.artifact_name ?? "github-pages"));
      log(`Fetching artifact metadata for "${withV.artifact_name ?? "github-pages"}" in this workflow run`);
      if (!art) { log(`##[error]Fetching artifact metadata failed. Is githubstatus.com reporting issues with API requests, Pages or Actions? Please re-run the deployment at a later time.\n##[error]No artifacts named "${withV.artifact_name ?? "github-pages"}" were found for this workflow run. Ensure artifacts are uploaded with actions/upload-artifact@v4 or later.`); return "failure"; }
      log("Found 1 artifact(s)");
      const pages = o.data.actions.pages;
      if (!pages.enabled || o.permissions.pages !== "write") {
        log(`##[error]Failed to create deployment (status: 404) with build version ${o.run.sha}. Request ID ${fakeSha(o.run.sha).slice(0, 4).toUpperCase()}:${fakeSha(o.job.name).slice(0, 6).toUpperCase()} Ensure GitHub Pages has been enabled: https://github.com/${o.owner}/${o.repo}/settings/pages`);
        return "failure";
      }
      if (o.environment !== "github-pages" && pages.protected !== false) {
        // GitHub Pages deployments must come from the github-pages environment (by default only the default branch may deploy)
      }
      const def = defaultBranchOf(o.rsh, o.rdir);
      if (o.environment === "github-pages" && o.run.ref !== `refs/heads/${def}` && o.run.event !== "workflow_dispatch") {
        log(`##[error]Branch "${o.run.ref.replace("refs/heads/", "")}" is not allowed to deploy to github-pages due to environment protection rules.`);
        return "failure";
      }
      log(`Creating Pages deployment with payload:\n{\n\t"artifact_id": ${art.id},\n\t"pages_build_version": "${o.run.sha}",\n\t"oidc_token": "***"\n}`);
      log(`Created deployment for ${o.run.sha}, ID: ${o.run.sha}`);
      log("Getting Pages deployment status...\nGetting Pages deployment status...\nReported success!");
      Object.assign(pages, { files: art.files, sha: o.run.sha, deployedAt: o.run.createdAt, url: `https://${o.owner}.github.io/${o.repo}/` });
      o.outputs.page_url = pages.url;
      return "success";
    }
    log(`##[error]The sandbox doesn't simulate ${uses}.`);
    return "failure";
  }

  // A local composite action: ./path/to/dir with action.yml (runs.using: composite).
  async function runComposite(uses, s, st, log, o, withV) {
    const dir = uses.replace(/^\.\//, "").replace(/\/$/, "");
    const text = o.rsh.fs.text(`${o.ws}/${dir}/action.yml`) ?? o.rsh.fs.text(`${o.ws}/${dir}/action.yaml`);
    if (text === null) {
      log(`##[error]Can't find 'action.yml', 'action.yaml' or 'Dockerfile' under '${o.ws}/${dir}'. Did you forget to run actions/checkout before running your local action?`);
      return "failure";
    }
    let action;
    try { action = parseDocument(text).toJS(); } catch (e) { log(`##[error]${e.message}`); return "failure"; }
    if (action?.runs?.using !== "composite") { log(`##[error]The sandbox runs composite actions (runs.using: composite), not ${action?.runs?.using}.`); return "failure"; }
    const inputs = {};
    for (const [k, spec] of Object.entries(action.inputs ?? {})) {
      if (withV[k] !== undefined) inputs[k] = withV[k];
      else if (spec?.default !== undefined) inputs[k] = String(spec.default);
      else if (spec?.required) { log(`##[warning]Input required and not supplied: ${k}`); inputs[k] = ""; }
      else inputs[k] = "";
    }
    log(`##[group]Run ${uses}`);
    if (Object.keys(withV).length) { log("with:"); for (const [k, v] of Object.entries(withV)) log(`  ${k}: ${v}`); }
    log("##[endgroup]");
    const inner = {};
    for (const step of [].concat(action.runs.steps ?? [])) {
      const ctxX = o.exprCtx({ inputs, steps: inner });
      if (!condition(step.if, ctxX)) continue;
      if (step.run === undefined) { log(`##[error]The sandbox's composite actions support run: steps only.`); return "failure"; }
      if (!step.shell) { log("##[error]Required property is missing: shell"); return "failure"; }
      const script = interpolate(String(step.run), ctxX);
      const lines = script.replace(/\n$/, "").split("\n");
      log(`##[group]Run ${lines[0]}`);
      for (const ln of lines) log(ln);
      log(`shell: ${step.shell === "bash" ? "/usr/bin/bash --noprofile --norc -e -o pipefail {0}" : "/usr/bin/sh -e {0}"}`);
      log("##[endgroup]");
      const outFile = `${o.ws}/../_temp_${fakeSha(script).slice(0, 6)}`;
      await o.rsh.fs.writeFile(outFile, "");
      o.rsh.env = { ...o.baseEnv, ...o.env, ...o.stepEnv, ...Object.fromEntries(Object.entries(step.env ?? {}).map(([k, v]) => [k, interpolate(String(v), ctxX)])), GITHUB_OUTPUT: outFile };
      o.rsh.cwd = o.ws;
      const collected = [];
      const saved = o.rsh.push;
      o.rsh.push = (k, t) => { if (k === "out" || k === "err") collected.push(t); };
      let status;
      try { status = await o.rsh.runScript(script, { echo: false, errexit: true }); } finally { o.rsh.push = saved; }
      const out = collected.join("");
      if (out) log(out.replace(/\n$/, ""));
      const kv = {};
      for (const ln of (o.rsh.fs.text(outFile) ?? "").split("\n")) { const eq = ln.indexOf("="); if (eq > 0) kv[ln.slice(0, eq)] = ln.slice(eq + 1); }
      o.rsh.fs.nodes.delete(o.rsh.fs.constructor.norm ? o.rsh.fs.constructor.norm(outFile) : outFile);
      if (step.id) inner[step.id] = { outputs: kv, outcome: status ? "failure" : "success", conclusion: status ? "failure" : "success" };
      if (status !== 0) { log(`##[error]Process completed with exit code ${status}.`); o.job.annotations.push({ level: "failure", message: `Process completed with exit code ${status}.`, path: ".github", line: 1 }); return "failure"; }
    }
    for (const [k, spec] of Object.entries(action.outputs ?? {})) {
      try { o.outputs[k] = interpolate(String(spec?.value ?? ""), o.exprCtx({ inputs, steps: inner })); } catch { o.outputs[k] = ""; }
    }
    return "success";
  }

  /* ------------------------------------------------------------ events from github.js */

  async function prMergeCommit(sh, rdir, pr) {
    const head = await git.resolveRef({ fs: sh.fs, dir: rdir, ref: `refs/heads/${pr.head}` }).catch(() => null);
    const base = await git.resolveRef({ fs: sh.fs, dir: rdir, ref: `refs/heads/${pr.base}` }).catch(() => null);
    if (!head || !base) return null;
    const mb = (await git.findMergeBase({ fs: sh.fs, dir: rdir, oids: [base, head] }).catch(() => []))[0] ?? null;
    const files = await mergeTreesOnServer(sh, rdir, mb, base, head);
    if (!files) return { conflict: true, head, base, mb };
    const sig = { name: "GitHub", email: "noreply@github.com", timestamp: clockNow(sh), timezoneOffset: 0 };
    const oid = await writeCommitFromFiles(sh, rdir, files, { parents: [base, head], message: `Merge ${head} into ${base}\n`, author: sig, committer: sig });
    await git.writeRef({ fs: sh.fs, dir: rdir, ref: `refs/pull/${pr.number}/merge`, value: oid, force: true });
    await git.writeRef({ fs: sh.fs, dir: rdir, ref: `refs/pull/${pr.number}/head`, value: head, force: true });
    return { oid, head, base, mb };
  }
  async function firePullRequest(sh, rdir, pr, action, actor) {
    const m = await prMergeCommit(sh, rdir, pr);
    if (!m || m.conflict) return [];   // GitHub doesn't run pull_request workflows while there are merge conflicts
    return dispatch(sh, rdir, { name: "pull_request", action, ref: `refs/pull/${pr.number}/merge`, sha: m.oid, headSha: m.head, mergeBase: m.mb, headBranch: pr.head, baseBranch: pr.base, title: pr.title, actor, pr: pr.number });
  }

  hooks.afterRefUpdate.push(async (sh, rdir, updates, actor) => {
    for (const u of updates) {
      if (u.deleted || !u.after) continue;
      const { commit } = await git.readCommit({ fs: sh.fs, dir: rdir, oid: u.after }).catch(() => ({ commit: null }));
      if (!commit) continue;
      const isTag = u.ref.startsWith("refs/tags/");
      // a tag push names the tagged commit (for annotated tags, the commit they point to)
      let sha = u.after;
      await dispatch(sh, rdir, { name: "push", ref: u.ref, sha, before: u.before, headBranch: u.ref.replace(/^refs\/(heads|tags)\//, ""), title: commit.message.split("\n")[0], message: commit.message, actor });
      if (!isTag) {
        const data = ghLoad(sh, rdir);
        for (const pr of data.pulls.filter((p) => p.state === "OPEN" && p.head === u.ref.replace("refs/heads/", ""))) if (u.before) await firePullRequest(sh, rdir, pr, "synchronize", actor);
        for (const pr of data.pulls.filter((p) => p.state === "OPEN" && p.base === u.ref.replace("refs/heads/", ""))) await prMergeCommit(sh, rdir, pr);
      }
    }
  });
  hooks.prEvent = async (sh, rdir, pr, action, actor) => { if (action === "opened" || action === "reopened") await firePullRequest(sh, rdir, pr, action, actor); };
  hooks.releaseEvent = async (sh, rdir, rel, sha, actor) => {
    await dispatch(sh, rdir, { name: "release", action: "published", ref: `refs/tags/${rel.tag}`, sha, headBranch: rel.tag, title: rel.title ?? rel.tag, actor, release: rel });
  };

  // The checks on a pull request: the jobs of the latest runs for its head commit.
  function checksFor(sh, rdir, pr) {
    const data = store(sh, rdir);
    const head = pr.headSha;
    const runs = data.actions.runs.filter((r) => r.headSha === head && (r.event === "push" || (r.event.startsWith("pull_request") && r.pr === pr.number)));
    const latest = new Map();
    for (const r of runs) { const k = `${r.workflow}|${r.event}`; if (!latest.has(k) || latest.get(k).id < r.id || latest.get(k).attempt < r.attempt) latest.set(k, r); }
    const checks = [];
    for (const r of latest.values()) {
      if (r.invalid) { checks.push({ name: r.workflow, workflow: "", event: r.event, bucket: "fail", elapsed: "", link: runUrl(rdir, r.id) }); continue; }
      for (const j of r.jobs) {
        const bucket = j.status !== "completed" ? "pending" : j.conclusion === "success" ? "pass" : j.conclusion === "skipped" ? "skipping" : j.conclusion === "cancelled" ? "cancel" : "fail";
        checks.push({ name: j.name, workflow: r.workflowName, event: r.event, bucket, elapsed: j.completedAt ? dur(j.completedAt - j.startedAt) : "", link: `${runUrl(rdir, r.id)}/job/${j.id}` });
      }
    }
    return checks;
  }
  hooks.checksFor = async (sh, rdir, pr) => {
    pr.headSha = await git.resolveRef({ fs: sh.fs, dir: rdir, ref: `refs/heads/${pr.head}` }).catch(() => pr.headSha);
    const c = checksFor(sh, rdir, pr);
    return { total: c.length, failing: c.filter((x) => x.bucket === "fail" || x.bucket === "cancel").length, pending: c.filter((x) => x.bucket === "pending").length, passing: c.filter((x) => x.bucket === "pass" || x.bucket === "skipping").length, list: c };
  };

  /* ------------------------------------------------------------ gh run, gh workflow, gh secret, gh variable, gh pr checks */

  const dur = (s) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return h ? `${h}h${m}m${r}s` : m ? `${m}m${r}s` : `${r}s`; };
  const symbol = (status, conclusion) => (status === "completed" ? (conclusion === "success" ? "✓" : conclusion === "skipped" || conclusion === "neutral" ? "-" : "X") : "*");
  const isFailure = (c) => ["action_required", "failure", "startup_failure", "timed_out"].includes(c);
  const runTitle = (r) => r.displayTitle ?? (r.event === "workflow_dispatch" ? r.workflowName : r.title);

  function findRun(data, arg) {
    const id = Number(arg);
    const r = data.actions.runs.filter((x) => x.id === id).at(-1);
    if (!r) throw new GhError(`failed to get run: HTTP 404: Not Found (https://api.github.com/repos/${"{owner}/{repo}"}/actions/runs/${arg}?exclude_pull_requests=true)`);
    return r;
  }
  function findWorkflow(data, files, sel) {
    const all = files.map(([path, text]) => {
      const p = readWorkflow(path, text);
      return { path, name: p.wf?.name ? String(p.wf.name) : path, parsed: p, ...workflowId(data, path) };
    });
    const w = all.find((x) => x.name === sel || x.path === sel || x.path.split("/").pop() === sel || String(x.id) === String(sel))
      ?? all.find((x) => x.name.toLowerCase() === String(sel).toLowerCase());
    return { w, all };
  }

  function renderRunView(sh, rdir, run, { verbose = false, job = null } = {}) {
    let out = "\n";
    const prNum = run.pr ? ` #${run.pr}` : "";
    out += `${symbol(run.status, run.conclusion)} ${run.headBranch} ${run.workflowName}${prNum} · ${run.id}${run.attempt > 1 ? ` (Attempt #${run.attempt})` : ""}\n`;
    out += `Triggered via ${run.event} ${fuzzyAgo(sh, run.createdAt)}\n\n`;
    if ((!run.jobs.length && run.conclusion === "failure") || run.conclusion === "startup_failure") {
      out += `X This run likely failed because of a workflow file issue.\n\nFor more information, see: ${runUrl(rdir, run.id)}\n`;
      return out;
    }
    const jobs = job ? [job] : run.jobs;
    const jobLines = (list, v) => list.map((j) => {
      const elapsed = j.completedAt && j.startedAt ? ` in ${dur(j.completedAt - j.startedAt)}` : "";
      let line = `${symbol(j.status, j.conclusion)} ${j.name}${elapsed} (ID ${j.id})`;
      if (v || isFailure(j.conclusion)) for (const st of j.steps) line += `\n  ${symbol("completed", st.conclusion)} ${st.name}`;
      return line;
    }).join("\n");
    if (!job) out += `JOBS\n${jobLines(jobs, verbose)}\n`;
    else out += jobLines(jobs, true) + "\n";
    const annotations = jobs.flatMap((j) => j.annotations.map((a) => ({ ...a, job: j.name })));
    if (annotations.length) {
      out += "\nANNOTATIONS\n";
      out += annotations.map((a) => `${a.level === "failure" ? "X" : a.level === "warning" ? "!" : "-"} ${a.message}\n${a.job}: ${a.path}#${a.line}\n`).join("\n");
    }
    if (!job) {
      const arts = run.artifacts.filter((a) => a.attempt === run.attempt || true);
      if (arts.length) out += `\nARTIFACTS\n${[...new Set(arts.map((a) => a.name))].join("\n")}\n`;
      out += "\n";
      if (isFailure(run.conclusion)) out += `To see what failed, try: gh run view ${run.id} --log-failed\n`;
      else if (run.jobs.length === 1) out += `For more information about the job, try: gh run view --job=${run.jobs[0].id}\n`;
      else out += "For more information about a job, try: gh run view --job=<job-id>\n";
      out += `View this run on GitHub: ${runUrl(rdir, run.id)}\n`;
    } else {
      out += "\n";
      out += isFailure(job.conclusion) ? `To see the logs for the failed steps, try: gh run view --log-failed --job=${job.id}\n` : `To see the full job log, try: gh run view --log --job=${job.id}\n`;
      out += `View this run on GitHub: ${runUrl(rdir, run.id)}\n`;
    }
    return out;
  }
  function renderLog(run, { failedOnly = false, job = null } = {}) {
    let out = "";
    for (const j of job ? [j0(run, job)] : run.jobs) {
      if (!j) continue;
      if (failedOnly && !isFailure(j.conclusion) && j.conclusion !== "cancelled") continue;
      for (const st of j.steps) {
        if (failedOnly && st.conclusion !== "failure" && st.conclusion !== "cancelled") continue;
        if (st.conclusion === "skipped") continue;
        st.log.forEach((l, k) => { out += `${j.name}\t${st.name}\t${iso(l.t, k)} ${l.text}\n`; });
      }
    }
    return out;
  }
  const j0 = (run, job) => run.jobs.find((j) => j.id === job.id);

  async function ghRun(sh, sub, rest, io) {
    const repo = await baseRepo(sh);
    const data = store(sh, repo.dir);
    if (sub === "list" || sub === "ls") {
      const { opts } = parseOpts(rest, { "-w|--workflow": "value", "-b|--branch": "value", "-e|--event": "value", "-s|--status": "value", "-L|--limit": "value", "-c|--commit": "value", "-u|--user": "value", "--json": "value", "-q|--jq": "value", "-a|--all": "bool" });
      let runs = [...data.actions.runs].reverse();
      if (opts["-w"]) {
        const files = await workflowFiles(sh, repo.dir, await git.resolveRef({ fs: sh.fs, dir: repo.dir, ref: `refs/heads/${defaultBranchOf(sh, repo.dir)}` }));
        const { w } = findWorkflow(data, files, opts["-w"]);
        if (!w) throw new GhError(`could not find any workflows named ${opts["-w"]}`);
        runs = runs.filter((r) => r.workflow === w.path);
      }
      if (opts["-b"]) runs = runs.filter((r) => r.headBranch === opts["-b"]);
      if (opts["-e"]) runs = runs.filter((r) => r.event === opts["-e"]);
      if (opts["-c"]) runs = runs.filter((r) => r.headSha.startsWith(opts["-c"]));
      if (opts["-s"]) runs = runs.filter((r) => r.status === opts["-s"] || r.conclusion === opts["-s"]);
      runs = runs.slice(0, Number(opts["-L"] ?? 20));
      if (opts["--json"]) return emitJson(io, runs.map((r) => runJson(repo.dir, r)), opts["--json"], opts["-q"]);
      if (!runs.length) { io.err("no runs found\n"); return 0; }
      const rows = [["STATUS", "TITLE", "WORKFLOW", "BRANCH", "EVENT", "ID", "ELAPSED", "AGE"], ...runs.map((r) => [symbol(r.status, r.conclusion), runTitle(r), r.workflowName, r.headBranch, r.event, String(r.id), dur(r.status === "completed" ? r.updatedAt - r.createdAt : clockNow(sh) - r.createdAt), fuzzyAgo(sh, r.createdAt)])];
      io.out(table(rows));
      return 0;
    }
    if (sub === "view") {
      const { opts, rest: r } = parseOpts(rest, { "--log": "bool", "--log-failed": "bool", "-j|--job": "value", "-v|--verbose": "bool", "--exit-status": "bool", "-a|--attempt": "value", "-w|--web": "bool", "--json": "value", "-q|--jq": "value" });
      if (opts["--log"] && opts["--log-failed"]) throw new GhError("specify only one of --log or --log-failed");
      let run, job = null;
      if (opts["-j"]) {
        for (const x of data.actions.runs) { const j = x.jobs.find((jj) => String(jj.id) === String(opts["-j"])); if (j) { run = x; job = j; } }
        if (!job) throw new GhError(`failed to get job: HTTP 404: Not Found (https://api.github.com/repos/${repo.full}/actions/jobs/${opts["-j"]})`);
      } else {
        if (!r[0]) throw new GhError("run or job ID required when not running interactively\n\nUsage:  gh run view [<run-id>] [flags]\n\n(The sandbox can't show gh's interactive picker: find the ID with gh run list.)");
        run = findRun(data, r[0]);
        if (opts["-a"]) { run = data.actions.runs.find((x) => x.id === run.id && x.attempt === Number(opts["-a"])) ?? run; }
      }
      if (opts["--json"]) return emitJson(io, runJson(repo.dir, run), opts["--json"], opts["-q"]);
      if (opts["--log"] || opts["--log-failed"]) {
        if (run.invalid) throw new GhError("failed to get run log: log not found");
        io.out(renderLog(run, { failedOnly: opts["--log-failed"], job }));
        return 0;
      }
      io.out(renderRunView(sh, repo.dir, run, { verbose: opts["-v"], job }));
      return opts["--exit-status"] && isFailure(run.conclusion) ? 1 : 0;
    }
    if (sub === "watch") {
      const { opts, rest: r } = parseOpts(rest, { "--exit-status": "bool", "-i|--interval": "value", "--compact": "bool" });
      if (!r[0]) throw new GhError("run ID required when not running interactively\n\nUsage:  gh run watch <run-id> [flags]");
      const run = findRun(data, r[0]);
      if (run.status === "completed" && run.watched) {
        io.out(`Run ${run.workflowName} (${run.id}) has already completed with '${run.conclusion}'\n`);
        return opts["--exit-status"] && run.conclusion !== "success" ? 1 : 0;
      }
      // the sandbox's runs are already finished: show the final screen gh ends with
      let out = `${symbol(run.status, run.conclusion)} ${run.headBranch} ${run.workflowName}${run.pr ? ` #${run.pr}` : ""} · ${run.id}\nTriggered via ${run.event} ${fuzzyAgo(sh, run.createdAt)}\n\nJOBS\n`;
      out += run.jobs.map((j) => `${symbol(j.status, j.conclusion)} ${j.name}${j.completedAt ? ` in ${dur(j.completedAt - j.startedAt)}` : ""} (ID ${j.id})${j.steps.length && (j.status !== "completed" || j.conclusion !== "success") ? "\n" + j.steps.map((s2) => `  ${symbol("completed", s2.conclusion)} ${s2.name}`).join("\n") : ""}`).join("\n") + "\n";
      const ann = run.jobs.flatMap((j) => j.annotations.map((a) => ({ ...a, job: j.name })));
      if (ann.length) out += "\nANNOTATIONS\n" + ann.map((a) => `${a.level === "failure" ? "X" : a.level === "warning" ? "!" : "-"} ${a.message}\n${a.job}: ${a.path}#${a.line}\n`).join("\n");
      out += `\n${symbol(run.status, run.conclusion)} Run ${run.workflowName} (${run.id}) completed with '${run.conclusion ?? run.status}'\n`;
      run.watched = true;
      await ghSave(sh, repo.dir, data);
      io.out(out);
      return opts["--exit-status"] && run.conclusion !== "success" ? 1 : 0;
    }
    if (sub === "rerun") {
      const { opts, rest: r } = parseOpts(rest, { "--failed": "bool", "-j|--job": "value", "-d|--debug": "bool" });
      if (!r[0] && !opts["-j"]) throw new GhError("`<run-id>` or `--job` required when not running interactively");
      const prev = findRun(data, r[0] ?? data.actions.runs.find((x) => x.jobs.some((j) => String(j.id) === String(opts["-j"])))?.id);
      if (prev.status !== "completed") throw new GhError(`run ${prev.id} cannot be rerun; This workflow is already running`);
      if (prev.invalid) throw new GhError(`run ${prev.id} cannot be rerun; This workflow run cannot be retried`);
      if (opts["--failed"] && prev.conclusion === "success") throw new GhError(`run ${prev.id} cannot be rerun; This workflow run cannot be retried`);
      const files = await filesAt(sh, repo.dir, prev.sha);
      const parsed = readWorkflow(prev.workflow, files.get(prev.workflow) ?? "");
      const next = { ...prev, attempt: prev.attempt + 1, jobs: [], artifacts: [...prev.artifacts.filter((a) => opts["--failed"])], createdAt: clockNow(sh) + 2, watched: false };
      data.actions.runs.push(next);
      let onlyJobs = null;
      if (opts["--failed"]) onlyJobs = new Set(prev.jobs.filter((j) => j.conclusion !== "success" && j.conclusion !== "skipped").map((j) => j.key));
      if (opts["-j"]) onlyJobs = new Set(prev.jobs.filter((j) => String(j.id) === String(opts["-j"])).map((j) => j.key));
      if (opts["-d"]) data.actions.debugRun = true;
      const ev = { name: prev.event, ref: prev.ref, sha: prev.sha, headSha: prev.headSha, headBranch: prev.headBranch, title: prev.title, actor: ghState(sh).user, pr: prev.pr, inputs: prev.inputs, release: prev.release, action: prev.event === "release" ? "published" : "synchronize" };
      await executeRun(sh, repo.dir, data, next, parsed, ev, { onlyJobs, previous: prev });
      await ghSave(sh, repo.dir, data);
      if (opts["-j"]) io.out(`✓ Requested rerun of job ${opts["-j"]} on run ${prev.id}${opts["-d"] ? " with debug logging enabled" : ""}\n`);
      else io.out(`✓ Requested rerun ${opts["--failed"] ? "(failed jobs) " : ""}of run ${prev.id}${opts["-d"] ? " with debug logging enabled" : ""}\n`);
      return 0;
    }
    if (sub === "download") {
      const { opts, rest: r } = parseOpts(rest, { "-n|--name": "multi", "-D|--dir": "value", "-p|--pattern": "multi" });
      const runs = r[0] ? [findRun(data, r[0])] : [...data.actions.runs].reverse().slice(0, 1);
      if (!runs.length) throw new GhError("no runs found");
      const names = [].concat(opts["-n"] ?? []);
      const arts = runs[0].artifacts.filter((a) => !names.length || names.includes(a.name));
      if (!arts.length) throw new GhError(names.length ? `no artifact matches any of the names or patterns provided` : "no valid artifacts found to download");
      const base = sh.abs(opts["-D"] ?? ".");
      for (const a of arts) {
        const dest = arts.length > 1 || !names.length ? `${base}/${a.name}` : base;
        for (const [p, text] of Object.entries(a.files)) {
          const abs = `${dest}/${p}`;
          await sh.fs.mkdir(abs.slice(0, abs.lastIndexOf("/")), { recursive: true });
          if (sh.fs.exists(abs)) throw new GhError(`error downloading ${a.name}: error extracting zip archive: open ${abs}: file exists`);
          await sh.fs.writeFile(abs, text);
        }
      }
      return 0;
    }
    if (sub === "cancel") {
      const run = findRun(data, rest[0]);
      throw new GhError(run.status === "completed" ? `Cannot cancel a workflow run that is completed` : "the sandbox's runs can't be cancelled");
    }
    if (sub === "delete") {
      const run = findRun(data, rest[0]);
      data.actions.runs = data.actions.runs.filter((x) => x.id !== run.id);
      await ghSave(sh, repo.dir, data);
      io.out(`✓ Request to delete workflow run submitted.\n`);
      return 0;
    }
    throw new GhError(`unknown command "${sub ?? ""}" for "gh run"\n\nAvailable commands in the sandbox: list, view, watch, rerun, download, delete`);
  }

  function runJson(rdir, r) {
    return { attempt: r.attempt, conclusion: r.conclusion ?? "", createdAt: new Date(r.createdAt * 1000).toISOString().replace(/\.\d+Z$/, "Z"), databaseId: r.id, displayTitle: runTitle(r), event: r.event, headBranch: r.headBranch, headSha: r.headSha, name: r.workflowName, number: r.number, startedAt: new Date(r.createdAt * 1000).toISOString().replace(/\.\d+Z$/, "Z"), status: r.status, updatedAt: new Date((r.updatedAt ?? r.createdAt) * 1000).toISOString().replace(/\.\d+Z$/, "Z"), url: runUrl(rdir, r.id), workflowDatabaseId: r.workflowId, workflowName: r.workflowName, jobs: r.jobs.map((j) => ({ name: j.name, conclusion: j.conclusion ?? "", status: j.status, databaseId: j.id, url: `${runUrl(rdir, r.id)}/job/${j.id}`, steps: j.steps.map((s) => ({ name: s.name, conclusion: s.conclusion, number: s.number, status: "completed" })) })) };
  }
  function emitJson(io, value, fields, jq) {
    const pickFields = (o) => Object.fromEntries(fields.split(",").map((f) => f.trim()).map((f) => [f, o[f]]));
    const v = Array.isArray(value) ? value.map(pickFields) : pickFields(value);
    if (!jq) { io.out(JSON.stringify(v, null, 2) + "\n"); return 0; }
    const pick = (x, path) => {
      if (!path) return [x];
      const m = /^(\.\[\]|\.\[(\d+)\]|\.([A-Za-z_]\w*))(.*)$/.exec(path);
      if (!m) throw new GhError(`the sandbox's --jq supports paths like .[0].conclusion and .[].name (got "${jq}")`);
      if (m[1] === ".[]") return (Array.isArray(x) ? x : []).flatMap((y) => pick(y, m[4]));
      return pick(m[2] !== undefined ? x?.[Number(m[2])] : x?.[m[3]], m[4]);
    };
    for (const x of pick(v, jq === "." ? "" : jq.trim())) io.out((typeof x === "string" ? x : JSON.stringify(x)) + "\n");
    return 0;
  }

  async function ghWorkflow(sh, sub, rest, io) {
    const repo = await baseRepo(sh);
    const data = store(sh, repo.dir);
    const def = defaultBranchOf(sh, repo.dir);
    const defOid = await git.resolveRef({ fs: sh.fs, dir: repo.dir, ref: `refs/heads/${def}` }).catch(() => null);
    const files = defOid ? await workflowFiles(sh, repo.dir, defOid) : [];
    if (sub === "list" || sub === "ls") {
      const { opts } = parseOpts(rest, { "-a|--all": "bool", "-L|--limit": "value", "--json": "value" });
      const { all } = findWorkflow(data, files, "\u0000");
      const shown = all.filter((w) => opts["-a"] || w.state === "active");
      if (!shown.length) { io.err("no workflows found\n"); await ghSave(sh, repo.dir, data); return 0; }
      io.out(table([["NAME", "STATE", "ID"], ...shown.map((w) => [w.name, w.state, String(w.id)])]));
      await ghSave(sh, repo.dir, data);
      return 0;
    }
    if (sub === "run") {
      const { opts, rest: r } = parseOpts(rest, { "-r|--ref": "value", "-f|--raw-field": "multi", "-F|--field": "multi", "--json": "bool" });
      if (!r[0]) throw new GhError("workflow ID, name, or filename required when not running interactively");
      const ref = opts["-r"] ?? def;
      const refOid = await git.resolveRef({ fs: sh.fs, dir: repo.dir, ref: `refs/heads/${ref}` }).catch(() => null) ?? await git.resolveRef({ fs: sh.fs, dir: repo.dir, ref: `refs/tags/${ref}` }).catch(() => null);
      if (!refOid) throw new GhError(`could not create workflow dispatch event: HTTP 422: No ref found for: ${ref} (https://api.github.com/repos/${repo.full}/actions/workflows/…/dispatches)`);
      const refFiles = await workflowFiles(sh, repo.dir, refOid);
      const { w } = findWorkflow(data, refFiles, r[0]);
      if (!w) throw new GhError(`could not find any workflows named ${r[0]}`);
      const events = eventsOf(w.parsed.wf);
      if (!w.parsed.wf || !("workflow_dispatch" in events)) throw new GhError(`could not create workflow dispatch event: HTTP 422: Workflow does not have 'workflow_dispatch' trigger (https://api.github.com/repos/${repo.full}/actions/workflows/${w.id}/dispatches)`);
      const declared = events.workflow_dispatch?.inputs ?? {};
      const given = {};
      for (const f of [...[].concat(opts["-f"] ?? []), ...[].concat(opts["-F"] ?? [])]) {
        const eq = f.indexOf("=");
        if (eq < 0) throw new GhError(`field "${f}" requires a value separated by an '=' sign`);
        given[f.slice(0, eq)] = f.slice(eq + 1);
      }
      const unexpectedIn = Object.keys(given).filter((k) => !(k in declared));
      if (unexpectedIn.length) throw new GhError(`could not create workflow dispatch event: HTTP 422: Unexpected inputs provided: ${JSON.stringify(unexpectedIn)} (https://api.github.com/repos/${repo.full}/actions/workflows/${w.id}/dispatches)`);
      const inputs = {};
      for (const [k, spec] of Object.entries(declared)) {
        let v = given[k] ?? (spec?.default !== undefined ? String(spec.default) : undefined);
        if (v === undefined) {
          if (spec?.required) throw new GhError(`could not create workflow dispatch event: HTTP 422: Required input '${k}' not provided (https://api.github.com/repos/${repo.full}/actions/workflows/${w.id}/dispatches)`);
          v = spec?.type === "boolean" ? "false" : "";
        }
        if (spec?.type === "choice" && !(spec.options ?? []).map(String).includes(v)) throw new GhError(`could not create workflow dispatch event: HTTP 422: Provided value '${v}' for input '${k}' not in the list of allowed values (https://api.github.com/repos/${repo.full}/actions/workflows/${w.id}/dispatches)`);
        inputs[k] = spec?.type === "boolean" ? v === "true" : spec?.type === "number" ? Number(v) : v;
      }
      const { commit } = await git.readCommit({ fs: sh.fs, dir: repo.dir, oid: refOid });
      const isTag = !(await git.resolveRef({ fs: sh.fs, dir: repo.dir, ref: `refs/heads/${ref}` }).catch(() => null));
      const started = await dispatch(sh, repo.dir, { name: "workflow_dispatch", ref: `refs/${isTag ? "tags" : "heads"}/${ref}`, sha: refOid, headBranch: ref, title: commit.message.split("\n")[0], actor: ghState(sh).user, inputs, only: w.path });
      const run = started[0];
      io.out(`✓ Created workflow_dispatch event for ${w.path.split("/").pop()} at ${ref}\n${run ? runUrl(repo.dir, run.id) + "\n" : ""}\n${run ? `To see the created workflow run, try: gh run view ${run.id}\n` : ""}To see runs for this workflow, try: gh run list --workflow="${w.path.split("/").pop()}"\n`);
      return 0;
    }
    if (sub === "view") {
      const { rest: r } = parseOpts(rest, { "-y|--yaml": "bool", "-r|--ref": "value" });
      if (!r[0]) throw new GhError("workflow ID, name, or filename required when not running interactively");
      const { w } = findWorkflow(data, files, r[0]);
      if (!w) throw new GhError(`could not find any workflows named ${r[0]}`);
      const runs = [...data.actions.runs].reverse().filter((x) => x.workflow === w.path);
      let out = `${w.name} - ${w.path.split("/").pop()}\nID: ${w.id}\n\nTotal runs ${runs.length}\n`;
      if (runs.length) out += "Recent runs\n" + table([["STATUS", "TITLE", "WORKFLOW", "BRANCH", "EVENT", "ID"], ...runs.slice(0, 5).map((x) => [symbol(x.status, x.conclusion), runTitle(x), x.workflowName, x.headBranch, x.event, String(x.id)])]).replace(/^STATUS.*\n/, "");
      out += `\nTo see more runs for this workflow, try: gh run list --workflow ${w.path.split("/").pop()}\nTo see the YAML for this workflow, try: gh workflow view ${w.path.split("/").pop()} --yaml\n`;
      io.out(out);
      return 0;
    }
    if (sub === "disable" || sub === "enable") {
      if (!rest[0]) throw new GhError("workflow ID or name required when not running interactively");
      const { w } = findWorkflow(data, files, rest[0]);
      if (!w) throw new GhError(`could not find any workflows named ${rest[0]}`);
      data.actions.workflows[w.path].state = sub === "disable" ? "disabled_manually" : "active";
      await ghSave(sh, repo.dir, data);
      io.out(`✓ ${sub === "disable" ? "Disabled" : "Enabled"} ${w.name}\n`);
      return 0;
    }
    throw new GhError(`unknown command "${sub ?? ""}" for "gh workflow"\n\nAvailable commands in the sandbox: list, run, view, enable, disable`);
  }

  async function ghSecret(sh, sub, rest, io, kind) {
    const repo = await baseRepo(sh);
    const data = store(sh, repo.dir);
    const isVar = kind === "variable";
    if (sub === "set") {
      const { opts, rest: r } = parseOpts(rest, { "-b|--body": "value", "-e|--env": "value", "-r|--repo": "value", "-f|--env-file": "value", "-a|--app": "value" });
      if (!r[0]) throw new GhError("must pass name argument");
      const name = r[0];
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new GhError(`${isVar ? "variable" : "secret"} names can only contain letters, numbers, or _`);
      if (/^GITHUB_/i.test(name)) throw new GhError(`${isVar ? "variable" : "secret"} names must not start with GITHUB_`);
      let value = opts["-b"];
      if (value === undefined) {
        if (io.stdin) value = io.stdin.replace(/\n$/, "");
        else throw new GhError(`the sandbox can't show gh's prompt: pass the value with --body (gh ${kind} set ${name} --body "…"), or pipe it in`);
      }
      const now = clockNow(sh);
      if (isVar) {
        const existed = opts["-e"] ? !!data.actions.environments[opts["-e"]]?.variables?.[name] : !!data.actions.variables[name];
        if (opts["-e"]) { data.actions.environments[opts["-e"]] ??= {}; (data.actions.environments[opts["-e"]].variables ??= {})[name] = { value, updatedAt: now }; }
        else data.actions.variables[name] = { value, updatedAt: now };
        io.out(`✓ ${existed ? "Updated" : "Created"} variable ${name} for ${repo.full}${opts["-e"] ? " environment " + opts["-e"] : ""}\n`);
      } else {
        if (opts["-e"]) (data.actions.envSecrets[opts["-e"]] ??= {})[name] = { value, updatedAt: now };
        else data.actions.secrets[name] = { value, updatedAt: now };
        io.out(`✓ Set Actions secret ${name} for ${repo.full}\n`);
      }
      await ghSave(sh, repo.dir, data);
      return 0;
    }
    if (sub === "list" || sub === "ls") {
      const { opts } = parseOpts(rest, { "-e|--env": "value" });
      const src = isVar ? (opts["-e"] ? data.actions.environments[opts["-e"]]?.variables ?? {} : data.actions.variables) : (opts["-e"] ? data.actions.envSecrets[opts["-e"]] ?? {} : data.actions.secrets);
      const names = Object.keys(src).sort();
      if (!names.length) { io.err(`no ${isVar ? "variables" : "secrets"} found\n`); return 0; }
      io.out(table(isVar ? [["NAME", "VALUE", "UPDATED"], ...names.map((n) => [n, src[n].value, fuzzyAgo(sh, src[n].updatedAt)])] : [["NAME", "UPDATED"], ...names.map((n) => [n, fuzzyAgo(sh, src[n].updatedAt)])]));
      return 0;
    }
    if (sub === "delete" || sub === "remove") {
      const { opts, rest: r } = parseOpts(rest, { "-e|--env": "value" });
      const src = isVar ? (opts["-e"] ? data.actions.environments[opts["-e"]]?.variables ?? {} : data.actions.variables) : (opts["-e"] ? data.actions.envSecrets[opts["-e"]] ?? {} : data.actions.secrets);
      if (!src[r[0]]) throw new GhError(`failed to delete ${isVar ? "variable" : "secret"} ${r[0]}: HTTP 404: Not Found`);
      delete src[r[0]];
      await ghSave(sh, repo.dir, data);
      io.out(isVar ? `✓ Deleted variable ${r[0]} from ${repo.full}\n` : `✓ Deleted Actions secret ${r[0]} from ${repo.full}\n`);
      return 0;
    }
    throw new GhError(`unknown command "${sub ?? ""}" for "gh ${kind}"\n\nAvailable commands in the sandbox: set, list, delete`);
  }

  async function ghPrChecks(sh, rest, io) {
    const repo = await baseRepo(sh);
    const { opts, rest: r } = parseOpts(rest, { "--required": "bool", "--watch": "bool", "--fail-fast": "bool", "-i|--interval": "value", "--json": "value" });
    const { pr } = await findPull(sh, repo, r[0]);
    const info = await hooks.checksFor(sh, repo.dir, pr);
    let list = info.list;
    if (opts["--required"]) {
      const req = gh.rulesFor(sh, repo.dir, pr.base).checks ?? [];
      list = list.filter((c) => req.includes(c.name));
    }
    if (!list.length) throw new GhError(`no checks reported on the '${pr.head}' branch`);
    const c = { fail: 0, pass: 0, skipping: 0, pending: 0, cancel: 0 };
    for (const x of list) c[x.bucket]++;
    const summary = c.fail ? "Some checks were not successful" : c.pending ? "Some checks are still pending" : c.cancel ? "Some checks were cancelled" : "All checks were successful";
    let out = `${summary}\n${c.cancel} cancelled, ${c.fail} failing, ${c.pass} successful, ${c.skipping} skipped, and ${c.pending} pending checks\n\n`;
    const rank = (b) => (b === "fail" ? 0 : b === "pending" ? 1 : 2);
    const sorted = [...list].sort((a, b) => rank(a.bucket) - rank(b.bucket) || (a.name < b.name ? -1 : a.name > b.name ? 1 : a.link < b.link ? -1 : 1));
    out += table([["", "NAME", "DESCRIPTION", "ELAPSED", "URL"], ...sorted.map((x) => [x.bucket === "fail" ? "X" : x.bucket === "pending" ? "*" : x.bucket === "pass" ? "✓" : "-", `${x.workflow ? x.workflow + "/" : ""}${x.name}${x.event ? ` (${x.event})` : ""}`, "", x.elapsed, x.link])]);
    io.out(out);
    return c.fail || c.cancel ? 1 : c.pending ? 8 : 0;
  }

  hooks.ghCommands.run = (sh, sub, rest, io) => ghRun(sh, sub, rest, io);
  hooks.ghCommands.workflow = (sh, sub, rest, io) => ghWorkflow(sh, sub, rest, io);
  hooks.ghCommands.secret = (sh, sub, rest, io) => ghSecret(sh, sub, rest, io, "secret");
  hooks.ghCommands.variable = (sh, sub, rest, io) => ghSecret(sh, sub, rest, io, "variable");
  hooks.prSubcommands.checks = (sh, rest, io) => ghPrChecks(sh, rest, io);

  // gh api repos/{owner}/{repo}/pages: turning GitHub Pages on (build_type=workflow) and reading its settings
  hooks.apiRoutes.push(async (sh, path, opts, io, method) => {
    const m = /^\/?repos\/([^/]+)\/([^/]+)\/pages\/?$/.exec(path);
    if (!m) return null;
    const rdir = `${gh.GH}/${m[1]}/${m[2]}`;
    if (!sh.fs.isDir(rdir + "/.git")) throw new GhError("gh: Not Found (HTTP 404)");
    const data = store(sh, rdir);
    const pages = data.actions.pages;
    const fields = Object.fromEntries([...[].concat(opts["-f"] ?? []), ...[].concat(opts["-F"] ?? [])].map((f) => [f.slice(0, f.indexOf("=")), f.slice(f.indexOf("=") + 1)]));
    const body = () => ({ url: `https://api.github.com/repos/${m[1]}/${m[2]}/pages`, status: pages.sha ? "built" : null, cname: null, custom_404: false, html_url: `https://${m[1]}.github.io/${m[2]}/`, build_type: "workflow", source: { branch: defaultBranchOf(sh, rdir), path: "/" }, public: true, protected_domain_state: null, pending_domain_unverified_at: null, https_enforced: true });
    const print = (value) => {
      if (!opts["--jq"]) { io.out(JSON.stringify(value, null, 2) + "\n"); return; }
      const v = opts["--jq"].trim().replace(/^\./, "").split(".").filter(Boolean).reduce((o, k) => o?.[k], value);
      io.out((typeof v === "string" ? v : JSON.stringify(v)) + "\n");
    };
    if (method === "GET") {
      if (!pages.enabled) throw new GhError("gh: Not Found (HTTP 404)");
      print(body());
      return 0;
    }
    if (method === "POST" || method === "PUT") {
      if (pages.enabled && method === "POST") throw new GhError("gh: GitHub Pages is already enabled. (HTTP 409)");
      if ((fields.build_type ?? "legacy") !== "workflow") throw new GhError("the sandbox's GitHub Pages builds with GitHub Actions only: pass -f build_type=workflow");
      pages.enabled = true;
      await ghSave(sh, rdir, data);
      print(body());
      return 0;
    }
    if (method === "DELETE") { pages.enabled = false; pages.files = null; await ghSave(sh, rdir, data); return 0; }
    throw new GhError(`gh: Not Found (HTTP 404)`);
  });

  /* ------------------------------------------------------------ actionlint */

  registerCommand("actionlint", async (sh, args, io) => {
    if (args[0] === "--version" || args[0] === "-version") { io.out("1.7.12 (the sandbox's actionlint checks a subset of the real rules)\n"); return 0; }
    const flags = args.filter((a) => a.startsWith("-"));
    if (flags.some((f) => !["-no-color", "-oneline"].includes(f))) { io.err(`actionlint: the sandbox supports -oneline and -no-color (not ${flags.join(" ")})\n`); return 2; }
    let targets = args.filter((a) => !a.startsWith("-"));
    let root = sh.cwd;
    for (let d = sh.cwd; d !== "/"; d = d.slice(0, d.lastIndexOf("/")) || "/") { if (sh.fs.isDir(d + "/.git")) { root = d; break; } }
    if (!targets.length) {
      const dir = root + "/.github/workflows";
      if (!sh.fs.isDir(dir)) { io.err(`no project was found in any parent directories of "${sh.cwd}". check workflows directory is put correctly in your Git repository\n`); return 1; }
      targets = sh.fs.walkFiles(dir).filter((f) => /\.ya?ml$/.test(f) && !f.slice(dir.length + 1).includes("/")).map((f) => f.slice(sh.cwd.length + 1) || f);
    }
    let found = 0;
    for (const t of targets) {
      const abs = sh.abs(t);
      const text = sh.fs.text(abs);
      if (text === null) { io.err(`could not read "${abs}": open ${abs}: no such file or directory\n`); return 1; }
      const shown = abs.startsWith(sh.cwd + "/") ? abs.slice(sh.cwd.length + 1) : abs;
      const { errors } = readWorkflow(shown, text);
      const lines = text.split("\n");
      for (const e of errors) {
        found++;
        let out = `${shown}:${e.line}:${e.col}: ${e.message} [${e.kind}]\n`;
        if (!flags.includes("-oneline")) {
          const src = lines[e.line - 1];
          if (src !== undefined && src.length >= e.col - 1) {
            const lnum = `${e.line} | `;
            const pad = " ".repeat(lnum.length - 2);
            const startCol = e.col - 1;
            let uw = 0;
            for (const ch of src.slice(startCol)) { if (/\s/.test(ch)) break; uw++; }
            if (uw > 0) uw--;
            out += `${pad}|\n${lnum}${src}\n${pad}| ${" ".repeat(startCol)}^${"~".repeat(uw)}\n`;
          }
        }
        io.out(out);
      }
    }
    return found ? 1 : 0;
  });

  /* ------------------------------------------------------------ curl: GitHub Pages sites only */

  registerCommand("curl", async (sh, args, io) => {
    const { opts, rest } = parseOpts(args.flatMap((a) => (/^-[a-zA-Z]{2,}$/.test(a) ? a.slice(1).split("").map((c) => "-" + c) : [a])), { "-s|--silent": "bool", "-S|--show-error": "bool", "-f|--fail": "bool", "-L|--location": "bool", "-I|--head": "bool", "-i|--include": "bool", "-o|--output": "value", "-w|--write-out": "value", "--fail-with-body": "bool" });
    const url = rest[0];
    if (!url) { io.err("curl: try 'curl --help' or 'curl --manual' for more information\n"); return 2; }
    const m = /^https?:\/\/([a-z0-9-]+)\.github\.io\/([^/?#]+)(\/[^?#]*)?/i.exec(url);
    if (!m) {
      const host = /^[a-z]+:\/\/([^/]+)/i.exec(url)?.[1] ?? url;
      io.err(`curl: (6) Could not resolve host: ${host}\n(The sandbox has no internet. curl can fetch your GitHub Pages sites, like https://ada.github.io/shop/.)\n`);
      return 6;
    }
    const rdir = `${gh.GH}/${m[1].toLowerCase()}/${m[2]}`;
    const live = sh.runner && sh.runner.owner === m[1].toLowerCase() && sh.runner.repo === m[2] ? sh.runner.pages : null;   // a job reading its own repo's site mid-run
    const pages = live ?? (sh.fs.isDir(rdir + "/.git") ? store(sh, rdir).actions.pages : null);
    let path = (m[3] ?? "/").replace(/^\//, "");
    if (!m[3]) {
      // https://ada.github.io/shop → GitHub redirects to the trailing slash
      if (!opts["-L"]) {
        if (opts["-I"] || opts["-i"]) io.out(`HTTP/2 301 \nserver: GitHub.com\ncontent-type: text/html\nlocation: https://${m[1]}.github.io/${m[2]}/\n\n`);
        if (!opts["-I"]) io.out(`<html>\r\n<head><title>301 Moved Permanently</title></head>\r\n<body>\r\n<center><h1>301 Moved Permanently</h1></center>\r\n<hr><center>nginx</center>\r\n</body>\r\n</html>\r\n`);
        return 0;
      }
    }
    if (path === "" || path.endsWith("/")) path += "index.html";
    let file = pages?.enabled && pages.files ? pages.files[path] ?? pages.files[path + ".html"] ?? pages.files[path + "/index.html"] : undefined;
    const status = file !== undefined ? 200 : 404;
    if (status === 404) file = "<!DOCTYPE html>\n<html>\n  <head>\n    <meta http-equiv=\"Content-type\" content=\"text/html; charset=utf-8\">\n    <title>Page not found &middot; GitHub Pages</title>\n  </head>\n  <body>\n    <h1>404</h1>\n    <p><strong>File not found</strong></p>\n    <p>The site configured at this address does not contain the requested file.</p>\n  </body>\n</html>\n";
    const type = /\.css$/.test(path) ? "text/css; charset=utf-8" : /\.js$/.test(path) ? "application/javascript; charset=utf-8" : /\.json$/.test(path) ? "application/json; charset=utf-8" : /\.txt$/.test(path) ? "text/plain; charset=utf-8" : "text/html; charset=utf-8";
    const headers = `HTTP/2 ${status} \nserver: GitHub.com\ncontent-type: ${type}\ncontent-length: ${new TextEncoder().encode(file).length}\naccess-control-allow-origin: *\ncache-control: max-age=600\n\n`;
    if (status === 404 && (opts["-f"] || opts["--fail-with-body"])) {
      if (opts["--fail-with-body"]) io.out(file);
      if (!opts["-s"] || opts["-S"]) io.err(`curl: (22) The requested URL returned error: 404\n`);
      return 22;
    }
    if (opts["-I"]) { io.out(headers); return 0; }
    const body = (opts["-i"] ? headers : "") + file;
    if (opts["-o"]) { await sh.fs.writeFile(sh.abs(opts["-o"]), file); }
    else io.out(body);
    if (opts["-w"]) io.out(opts["-w"].replace(/%\{http_code\}/g, String(status)).replace(/\\n/g, "\n"));
    return 0;
  });

  // For exercise checks.
  return { store, readWorkflow, evalExpr, interpolate, dispatch };
}
