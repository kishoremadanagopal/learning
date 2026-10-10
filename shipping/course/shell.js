/* The sandbox terminal for the Shipping software course.

   Runs a script of shell commands (one per line, like a terminal session) against an in-memory file system, and
   prints each command with its output. `git` is real Git: isomorphic-git (bundled in gitlib.js) reads and writes
   real .git repositories in the in-memory file system; this file turns its API into git's command-line interface
   and output. Later parts add simulated tools (docker, kubectl, kafka) through `registerCommand`.

   runShell(script, { setup, stdin })            -> { ok, parts: [[kind, text]], ms }
   checkShell(script, checkSrc, { setup })       -> run() fields plus verdict { ok, msg }

   The same file runs in the browser (in the course's Web Worker) and in the Node.js test harness.
   Everything is deterministic: the clock starts at 2026-10-01 09:00 UTC and moves one minute per commit, so
   commit hashes in lessons are the same every time. */

import { git, Buffer } from "./gitlib.js";
import { installGitHub } from "./github.js";
import { installNode } from "./nodejs.js";
import { installActions } from "./actions.js";

const HOME = "/home/learner";
const START = Date.UTC(2026, 9, 1, 9, 0, 0) / 1000;      // 1 October 2026, 09:00 UTC
const MAX_OUTPUT = 100_000;

/* ---------------------------------------------------------------- an in-memory file system (fs.promises API) */

function fsError(code, message, path) {
  const e = new Error(`${code}: ${message}, '${path}'`);
  e.code = code;
  return e;
}

export class MemFS {
  constructor() {
    this.nodes = new Map([["/", { type: "dir", mtime: 1, mode: 0o40755 }]]);
    this.clock = 1;
    this.inode = 1;
    const p = (name) => (...args) => this[name](...args);
    this.promises = {
      readFile: p("readFile"), writeFile: p("writeFile"), unlink: p("unlink"), readdir: p("readdir"),
      mkdir: p("mkdir"), rmdir: p("rmdir"), stat: p("stat"), lstat: p("stat"), readlink: p("readlink"),
      symlink: p("symlink"), chmod: p("chmod"),
    };
  }
  static norm(path) {
    const out = [];
    for (const part of path.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") out.pop(); else out.push(part);
    }
    return "/" + out.join("/");
  }
  parent(path) { const i = path.lastIndexOf("/"); return i <= 0 ? "/" : path.slice(0, i); }
  tick() { return (this.clock += 1000); }
  get(path) { return this.nodes.get(MemFS.norm(path)); }
  async readFile(path, opts) {
    const n = this.get(path);
    if (!n) throw fsError("ENOENT", "no such file or directory", path);
    if (n.type === "dir") throw fsError("EISDIR", "illegal operation on a directory", path);
    const enc = typeof opts === "string" ? opts : opts && opts.encoding;
    return enc === "utf8" || enc === "utf-8" ? new TextDecoder().decode(n.data) : Buffer.from(n.data);
  }
  async writeFile(path, data, opts) {
    path = MemFS.norm(path);
    const dir = this.nodes.get(this.parent(path));
    if (!dir) throw fsError("ENOENT", "no such file or directory", path);
    if (dir.type !== "dir") throw fsError("ENOTDIR", "not a directory", path);
    const existing = this.nodes.get(path);
    if (existing && existing.type === "dir") throw fsError("EISDIR", "illegal operation on a directory", path);
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
    const mode = (opts && opts.mode) || (existing && existing.mode) || 0o100644;
    this.nodes.set(path, { type: "file", data: bytes, mtime: this.tick(), mode, ino: existing ? existing.ino : ++this.inode });
  }
  async unlink(path) {
    path = MemFS.norm(path);
    const n = this.nodes.get(path);
    if (!n) throw fsError("ENOENT", "no such file or directory", path);
    if (n.type === "dir") throw fsError("EISDIR", "illegal operation on a directory", path);
    this.nodes.delete(path);
  }
  async readdir(path) {
    path = MemFS.norm(path);
    const n = this.nodes.get(path);
    if (!n) throw fsError("ENOENT", "no such file or directory", path);
    if (n.type !== "dir") throw fsError("ENOTDIR", "not a directory", path);
    const prefix = path === "/" ? "/" : path + "/";
    const names = [];
    for (const key of this.nodes.keys()) {
      if (key !== path && key.startsWith(prefix) && !key.slice(prefix.length).includes("/")) names.push(key.slice(prefix.length));
    }
    return names.sort();
  }
  async mkdir(path, opts) {
    path = MemFS.norm(path);
    if (this.nodes.has(path)) {
      if (opts && opts.recursive && this.nodes.get(path).type === "dir") return;
      throw fsError("EEXIST", "file already exists", path);
    }
    const parent = this.parent(path);
    if (!this.nodes.has(parent)) {
      if (opts && opts.recursive) await this.mkdir(parent, opts);
      else throw fsError("ENOENT", "no such file or directory", path);
    }
    this.nodes.set(path, { type: "dir", mtime: this.tick(), mode: 0o40755, ino: ++this.inode });
  }
  async rmdir(path) {
    path = MemFS.norm(path);
    const n = this.nodes.get(path);
    if (!n) throw fsError("ENOENT", "no such file or directory", path);
    if (n.type !== "dir") throw fsError("ENOTDIR", "not a directory", path);
    if ((await this.readdir(path)).length) throw fsError("ENOTEMPTY", "directory not empty", path);
    this.nodes.delete(path);
  }
  async stat(path) {
    const n = this.get(path);
    if (!n) throw fsError("ENOENT", "no such file or directory", path);
    const isDir = n.type === "dir";
    return {
      type: isDir ? "dir" : "file", mode: n.mode, size: isDir ? 0 : n.data.length, ino: n.ino || 0,
      mtimeMs: n.mtime, ctimeMs: n.mtime, uid: 1000, gid: 1000, dev: 1,
      isFile: () => !isDir, isDirectory: () => isDir, isSymbolicLink: () => false,
    };
  }
  async readlink(path) { throw fsError("ENOENT", "no such file or directory", path); }
  async symlink(target, path) { throw fsError("EPERM", "symlinks are not supported", path); }
  async chmod(path, mode) {
    const n = this.get(path);
    if (!n) throw fsError("ENOENT", "no such file or directory", path);
    n.mode = (n.mode & ~0o777) | (mode & 0o777);
  }
  // Synchronous helpers for the shell.
  exists(path) { return this.nodes.has(MemFS.norm(path)); }
  isDir(path) { const n = this.get(path); return !!n && n.type === "dir"; }
  text(path) { const n = this.get(path); return n && n.type === "file" ? new TextDecoder().decode(n.data) : null; }
  walkFiles(path) {
    path = MemFS.norm(path);
    const prefix = path === "/" ? "/" : path + "/";
    return [...this.nodes.entries()].filter(([k, n]) => n.type === "file" && k.startsWith(prefix)).map(([k]) => k).sort();
  }
}

/* ---------------------------------------------------------------- parsing a command line */

class ShellError extends Error {}
// Thrown by `exit` (and by a failing command under `set -e`); ends the script or the subshell it's in.
export class ExitSignal extends Error { constructor(code) { super(`exit ${code}`); this.code = code; } }

// Characters that stand in for quoted *, ? and a leading ~ until globbing and tilde expansion are done.
const Q_STAR = "\u0002", Q_QMARK = "\u0003", Q_TILDE = "\u0004";
const protect = (s) => s.replace(/\*/g, Q_STAR).replace(/\?/g, Q_QMARK);
export const unprotect = (s) => s.replace(/\u0002/g, "*").replace(/\u0003/g, "?").replace(/\u0004/g, "~");

// Split a line into words, honouring quotes and backslashes, expanding $VARIABLES (when `vars` is given), and
// recognising the operators && || ; | > >> 2> 2>&1 <<. Unquoted expansions are split into words, like bash.
export function tokenize(line, vars = null) {
  const tokens = [];
  let i = 0, word = null;
  const push = () => { if (word !== null) { tokens.push(word); word = null; } };
  const OPS = ["2>&1", "&>", "2>", "&&", "||", ">>", "<<-", "<<", ";", "|", ">", "<"];
  // $NAME, ${NAME}, ${NAME:-default}, ${#NAME}, $?, $#, $@, $*, $0-$9, $$
  const expandAt = (j) => {
    if (!vars) return null;
    const rest = line.slice(j + 1);
    let m;
    if ((m = /^\{#([A-Za-z_]\w*)\}/.exec(rest))) return { value: String((vars(m[1]) ?? "").length), len: m[0].length + 1 };
    if ((m = /^\{([A-Za-z_]\w*|[0-9]+|[?#@*])(?:(:?[-=+?])((?:[^}\\]|\\.)*))?\}/.exec(rest))) {
      let v = vars(m[1]);
      const op = m[2], arg = m[3] ?? "";
      const empty = v === undefined || (op && op.startsWith(":") && v === "");
      if (op === "-" || op === ":-") { if (op === "-" ? v === undefined : empty) v = arg; }
      else if (op === "=" || op === ":=") { if (op === "=" ? v === undefined : empty) { v = arg; vars.set?.(m[1], arg); } }
      else if (op === "+" || op === ":+") v = (op === "+" ? v !== undefined : !empty) ? arg : "";
      else if (op === "?" || op === ":?") { if (empty) throw new ShellError(`${m[1]}: ${arg || "parameter null or not set"}`); }
      if (v === undefined && vars.nounset) throw new ShellError(`${m[1]}: unbound variable`);
      return { value: v ?? "", len: m[0].length + 1 };
    }
    if ((m = /^([A-Za-z_]\w*|[0-9?#@*$])/.exec(rest))) {
      const v = vars(m[1]);
      if (v === undefined && vars.nounset && /^[A-Za-z_]/.test(m[1])) throw new ShellError(`${m[1]}: unbound variable`);
      return { value: v ?? "", len: m[1].length + 1 };
    }
    return null;
  };
  outer: while (i < line.length) {
    const c = line[i];
    if (c === " " || c === "\t") { push(); i++; continue; }
    if (c === "#" && word === null) break;
    for (const op of OPS) {
      if (line.startsWith(op, i) && (!op.startsWith("2>") || word === null)) {
        push();
        tokens.push({ op });
        i += op.length;
        continue outer;
      }
    }
    if (c === "'") {
      const end = line.indexOf("'", i + 1);
      if (end === -1) throw new ShellError("unexpected EOF while looking for matching `''");
      const lit = line.slice(i + 1, end);
      word = (word ?? "") + (word === null && lit.startsWith("~") ? Q_TILDE + protect(lit.slice(1)) : protect(lit));
      i = end + 1;
    } else if (c === '"') {
      let j = i + 1, s = "";
      while (j < line.length && line[j] !== '"') {
        if (line[j] === "\\" && j + 1 < line.length && '"\\$`'.includes(line[j + 1])) { s += line[j + 1]; j += 2; }
        else if (line[j] === "$") {
          const e = expandAt(j);
          if (e) { s += e.value; j += e.len; } else s += line[j++];
        } else s += line[j++];
      }
      if (j >= line.length) throw new ShellError("unexpected EOF while looking for matching `\"'");
      word = (word ?? "") + (word === null && s.startsWith("~") ? Q_TILDE + protect(s.slice(1)) : protect(s));
      i = j + 1;
    } else if (c === "\\" && i + 1 < line.length) {
      word = (word ?? "") + protect(line[i + 1]);
      i += 2;
    } else if (c === "$" && expandAt(i)) {
      const e = expandAt(i);
      i += e.len;
      // word splitting of an unquoted expansion
      const parts = e.value.split(/[ \t\n]+/);
      if (e.value === "") continue;
      parts.forEach((p, k) => {
        if (k > 0) push();
        if (p !== "") word = (word ?? "") + p;
        else if (k === 0 && word === null) { /* leading blank: nothing to add */ }
      });
      if (/[ \t\n]$/.test(e.value)) push();
    } else {
      word = (word ?? "") + c;
      i++;
    }
  }
  push();
  return tokens;
}

/* ---------------------------------------------------------------- the shell */

const pad2 = (n) => String(n).padStart(2, "0");
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function gitDate(seconds, offsetMinutes = 0) {
  const d = new Date((seconds - offsetMinutes * 60) * 1000);
  const sign = offsetMinutes <= 0 ? "+" : "-";
  const off = Math.abs(offsetMinutes);
  return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} ${d.getUTCFullYear()} ${sign}${pad2(Math.floor(off / 60))}${pad2(off % 60)}`;
}

const extraCommands = new Map();
export function registerCommand(name, fn) { extraCommands.set(name, fn); }

export class Shell {
  constructor() {
    this.fs = new MemFS();
    this.cwd = HOME;
    this.env = { HOME, USER: "learner", PATH: "/usr/bin" };
    this.globalConfig = new Map([["user.name", "Ada Lovelace"], ["user.email", "ada@example.com"], ["init.defaultBranch", "main"]]);
    this.commits = 0;
    this.parts = [];
    this.size = 0;
    this.history = [];
    this.lastStatus = 0;
    this.quiet = false;
    this.errexit = false; this.pipefail = false; this.nounset = false; this.xtrace = false;
    this.args = [];
    this.depth = 0;
  }
  clockSeconds() { return START + 60 * this.commits; }
  async init() {
    await this.fs.mkdir(HOME, { recursive: true });
    await this.fs.mkdir("/tmp", { recursive: true });
  }
  // the clock for commits: one minute per commit
  now() { return START + 60 * this.commits++; }

  push(kind, text) {
    if (this.quiet || !text) return;
    if (this.size > MAX_OUTPUT) return;
    this.size += text.length;
    const last = this.parts[this.parts.length - 1];
    if (last && last[0] === kind) last[1] += text; else this.parts.push([kind, text]);
    if (this.size > MAX_OUTPUT) this.parts.push(["err", "\n(output cut off)\n"]);
  }
  abs(path) {
    if (path === "~" || path.startsWith("~/")) path = (this.env.HOME ?? HOME) + path.slice(1);
    return MemFS.norm(path.startsWith("/") ? path : this.cwd + "/" + path);
  }
  shortCwd() { return this.cwd === HOME ? "~" : this.cwd.startsWith(HOME + "/") ? "~" + this.cwd.slice(HOME.length) : this.cwd; }

  /* Run a whole script. Lines ending in \ continue; here-documents (<<EOF … EOF) supply input; if/for/while blocks
     may span lines. Each top-level command is echoed after the prompt (continuation lines after "> ") when `echo`
     is on. With `errexit` (bash -e, as GitHub Actions runs `run:` steps), the first failing command ends the script. */
  async runScript(script, { echo = true, errexit = null, args = null } = {}) {
    const lines = script.replace(/\r\n/g, "\n").split("\n");
    const stmts = splitStatements(lines);
    const savedErrexit = this.errexit, savedArgs = this.args;
    if (errexit !== null) this.errexit = errexit;
    if (args) this.args = args;
    let nodes;
    try {
      nodes = parseBlock(stmts, { i: 0 }, []).nodes;
    } catch (e) {
      if (!(e instanceof ShellError)) throw e;
      if (echo) this.push("cmd", `${this.shortCwd()} $ ${lines.find((l) => l.trim()) ?? ""}\n`);
      this.push("err", `bash: ${e.message}\n`);
      this.lastStatus = 2;
      this.errexit = savedErrexit; this.args = savedArgs;
      return 2;
    }
    let echoedTo = -1;
    this.depth++;
    try {
      for (const node of nodes) {
        if (echo && node.from > echoedTo) {
          const raw = lines.slice(node.from, node.to + 1);
          this.push("cmd", `${this.shortCwd()} $ ${raw[0]}\n${raw.slice(1).map((l) => "> " + l + "\n").join("")}`);
          echoedTo = node.to;
        }
        await this.runNode(node);
      }
    } catch (e) {
      if (e instanceof ExitSignal) this.lastStatus = e.code;
      else throw e;
    } finally {
      this.depth--;
      this.errexit = savedErrexit;
      this.args = savedArgs;
    }
    return this.lastStatus;
  }

  // Run one parsed node; `cond` is true inside an if/while condition, where failures don't trigger errexit.
  async runNode(node, cond = false) {
    if (node.type === "simple") {
      if (this.depth === 1 && !this.capturing) this.history.push(node.text.trim());
      if (node.warning) this.push("err", `bash: ${node.warning}\n`);
      try {
        const body = node.heredoc !== null && node.heredoc !== undefined && node.expand ? await this.expandText(node.heredoc) : node.heredoc;
        await this.runLine(node.text, body);
      } catch (e) {
        if (!(e instanceof ShellError)) throw e;
        this.push("err", `bash: ${e.message}\n`);
        this.lastStatus = 1;
        this.listTail = true;
      }
      if (this.errexit && !cond && this.lastStatus !== 0 && this.listTail && !node.negated) throw new ExitSignal(this.lastStatus);
      return this.lastStatus;
    }
    if (node.type === "if") {
      for (const br of node.branches) {
        await this.runNodes(br.cond, true);
        if (this.lastStatus === 0) { await this.runNodes(br.body, cond); return this.lastStatus; }
      }
      if (node.otherwise) await this.runNodes(node.otherwise, cond);
      else this.lastStatus = 0;
      return this.lastStatus;
    }
    if (node.type === "for") {
      const words = this.expand(tokenize(node.words, this.vars()).filter((t) => typeof t === "string"));
      let status = 0;
      for (const w of words) {
        this.env[node.name] = w;
        await this.runNodes(node.body, cond);
        status = this.lastStatus;
      }
      this.lastStatus = status;
      return status;
    }
    if (node.type === "while") {
      let status = 0, guard = 0;
      for (;;) {
        await this.runNodes(node.cond, true);
        if ((this.lastStatus === 0) === node.until) break;
        if (++guard > 1000) { this.push("err", "bash: loop stopped after 1000 rounds (the sandbox's limit)\n"); break; }
        await this.runNodes(node.body, cond);
        status = this.lastStatus;
      }
      this.lastStatus = status;
      return status;
    }
    return 0;
  }
  async runNodes(nodes, cond = false) {
    this.lastStatus = 0;
    for (const n of nodes) await this.runNode(n, cond);
    return this.lastStatus;
  }

  // The variables $NAME refers to: the shell's variables, then $?, $#, $1… and $$.
  vars() {
    const f = (name) => {
      if (name === "?") return String(this.lastStatus);
      if (name === "$") return "4242";
      if (name === "PWD") return this.cwd;
      if (name === "#") return String((this.args ?? []).length);
      if (name === "@" || name === "*") return (this.args ?? []).join(" ");
      if (/^[0-9]+$/.test(name)) return name === "0" ? "bash" : (this.args ?? [])[Number(name) - 1];
      return this.env[name];
    };
    f.set = (name, value) => { this.env[name] = value; };
    f.nounset = !!this.nounset;
    return f;
  }

  // Replace each $(…) with a placeholder, run it, and return the line plus what each one printed.
  async substitute(line) {
    const outs = [];
    let out = "", i = 0, quote = null;
    while (i < line.length) {
      const c = line[i];
      if (quote === "'") { out += c; if (c === "'") quote = null; i++; continue; }
      if (c === "\\" && i + 1 < line.length) { out += c + line[i + 1]; i += 2; continue; }
      if (c === "'" && !quote) { quote = "'"; out += c; i++; continue; }
      if (c === '"') { quote = quote === '"' ? null : '"'; out += c; i++; continue; }
      if (c === "$" && line.startsWith("((", i + 1)) {
        let depth = 2, j = i + 3;
        while (j < line.length && depth) { if (line[j] === "(") depth++; else if (line[j] === ")") depth--; j++; }
        if (depth) throw new ShellError("unexpected EOF while looking for matching `))'");
        outs.push(String(arithmetic(line.slice(i + 3, j - 2), (n) => this.env[n])));
        out += `\u0001${outs.length - 1}\u0001`;
        i = j;
        continue;
      }
      if (c === "$" && line[i + 1] === "(" && line[i + 2] !== "(") {
        let depth = 1, j = i + 2;
        while (j < line.length && depth) { if (line[j] === "(") depth++; else if (line[j] === ")") depth--; j++; }
        if (depth) throw new ShellError("unexpected EOF while looking for matching `)'");
        const inner = line.slice(i + 2, j - 1);
        const text = await this.capture(async () => {
          try { await this.runScript(inner, { echo: false, errexit: false }); } catch (e) { if (!(e instanceof ExitSignal)) throw e; }
        });
        outs.push(text.replace(/\n+$/, ""));
        out += `\u0001${outs.length - 1}\u0001`;
        i = j;
        continue;
      }
      out += c;
      i++;
    }
    return { line: out, outs };
  }
  // An unquoted here-document: $VARIABLES and $(commands) are expanded, like in double quotes.
  async expandText(text) {
    let outs = [];
    if (text.includes("$(")) ({ line: text, outs } = await this.substitute(text.replace(/'/g, "\u0005")));
    const vars = this.vars();
    text = text.replace(/\\\$/g, "\u0006").replace(/\$\{([A-Za-z_]\w*)\}|\$([A-Za-z_]\w*|[0-9?#@*])/g, (_, a, b) => vars(a ?? b) ?? "");
    return text.replace(/\u0001(\d+)\u0001/g, (_, k) => outs[Number(k)]).replace(/\u0005/g, "'").replace(/\u0006/g, "$");
  }
  // Run fn, collecting what it writes to stdout; what it writes to stderr still reaches the terminal.
  async capture(fn) {
    const outer = this.push;
    let text = "";
    this.push = (kind, t) => { if (kind === "out") text += t; else if (kind === "err") outer.call(this, kind, t); };
    this.capturing = (this.capturing ?? 0) + 1;
    try {
      await fn();
    } finally {
      this.push = outer;
      this.capturing--;
    }
    return text;
  }
  // Send what fn prints to a command's io (so `bash script.sh > file` and pipes work).
  async through(io, fn) {
    const outer = this.push;
    this.push = (kind, t) => { if (kind === "out") io.out(t); else if (kind === "err") io.err(t); };
    try { return await fn(); } finally { this.push = outer; }
  }

  async runLine(line, heredoc) {
    let negated = false;
    if (/^\s*!\s/.test(line)) { negated = true; line = line.replace(/^\s*!\s/, ""); }
    // split on && || ; first, then expand each command just before it runs (so $? and NAME=value work in a list)
    const chain = splitList(line);
    let status = this.lastStatus, last = -1;
    for (let k = 0; k < chain.length; k += 2) {
      const op = k > 0 ? chain[k - 1] : ";";
      if (op === "&&" && status !== 0) continue;
      if (op === "||" && status === 0) continue;
      this.lastStatus = status;
      let text = chain[k], outs = [];
      if (text.includes("$(")) ({ line: text, outs } = await this.substitute(text));
      const tokens = tokenize(text, this.vars()).map((t) => (typeof t === "string" && outs.length
        ? t.replace(/\u0001(\d+)\u0001/g, (_, n) => protect(outs[Number(n)])) : t));
      status = await this.runPipeline(tokens, heredoc);
      last = k;
    }
    // errexit only fires for the last command of an && / || list (and never after a "!")
    this.listTail = last === chain.length - 1 || chain[last + 1] === ";";
    if (negated) status = status === 0 ? 1 : 0;
    this.lastStatus = status;
    return status;
  }

  async runPipeline(tokens, heredoc) {
    if (!tokens.length) return 0;
    // split on |
    const stages = [[]];
    for (const t of tokens) {
      if (typeof t === "object" && t.op === "|") stages.push([]);
      else stages.at(-1).push(t);
    }
    let input = heredoc ?? "";
    let status = 0, failed = 0;
    for (let s = 0; s < stages.length; s++) {
      const last = s === stages.length - 1;
      const words = [], redirects = [];
      let mergeErr = false;
      const st = stages[s];
      for (let k = 0; k < st.length; k++) {
        const t = st[k];
        if (typeof t === "object") {
          if ([">", ">>", "2>", "&>", "<"].includes(t.op)) {
            const target = st[k + 1];
            if (typeof target !== "string") throw new ShellError("syntax error near unexpected token `newline'");
            redirects.push({ op: t.op, path: unprotect(target) });
            k++;
          } else if (t.op === "2>&1") mergeErr = true;
          else if (t.op === "<<" || t.op === "<<-") { /* handled by runScript */ }
          else throw new ShellError(`syntax error near unexpected token \`${t.op}'`);
        } else words.push(t);
      }
      const inRedirect = redirects.find((r) => r.op === "<");
      if (inRedirect) {
        const text = this.fs.text(this.abs(inRedirect.path));
        if (text === null) { this.push("err", `bash: ${inRedirect.path}: No such file or directory\n`); return 1; }
        input = text;
      }
      if (redirects.some((r) => r.op === "&>")) { mergeErr = true; redirects.forEach((r) => { if (r.op === "&>") r.op = ">"; }); }
      let expanded = this.expand(words);
      // NAME=value assignments before the command (or on their own)
      const assigns = [];
      while (expanded.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(expanded[0])) {
        const a = expanded.shift();
        assigns.push([a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)]);
      }
      if (!expanded.length) {
        for (const [n, v] of assigns) this.env[n] = v;
        status = this.lastStatus === undefined ? 0 : 0;
        continue;
      }
      const saved = assigns.map(([n]) => [n, this.env[n]]);
      for (const [n, v] of assigns) this.env[n] = v;
      if (this.xtrace) this.push("err", `+ ${[...assigns.map(([n, v]) => `${n}=${v}`), ...expanded].join(" ")}\n`);
      const out = { stdout: "", seq: [] };   // seq keeps stdout and stderr in the order they were written
      const io = {
        stdin: input,
        out: (text) => { out.stdout += text; out.seq.push(["out", text]); },
        err: (text) => { if (mergeErr) { out.stdout += text; out.seq.push(["out", text]); } else out.seq.push(["err", text]); },
      };
      let thrown = null;
      try {
        status = await this.exec(expanded, io);
      } catch (e) {
        if (e instanceof ExitSignal && stages.length > 1) status = e.code;   // `exit` in a pipeline only ends that stage
        else thrown = e;
      } finally {
        for (const [n, v] of saved) { if (v === undefined) delete this.env[n]; else this.env[n] = v; }
      }
      if (status !== 0) failed = status;
      const outRedirects = redirects.filter((r) => r.op === ">" || r.op === ">>"), errRedirect = redirects.find((r) => r.op === "2>");
      const toTerminal = last && !outRedirects.length;
      let errText = "";
      for (const [kind, text] of out.seq) {
        if (kind === "err" && errRedirect) errText += text;
        else if (kind === "err" || toTerminal) this.push(kind, text);
      }
      if (errRedirect && errRedirect.path !== "/dev/null") {
        const path = this.abs(errRedirect.path);
        if (this.fs.isDir(this.fs.parent(path))) await this.fs.writeFile(path, errText);
      }
      if (outRedirects.length) {
        for (const r of outRedirects) {
          if (r.path === "/dev/null") continue;
          const path = this.abs(r.path);
          if (this.fs.isDir(path)) { this.push("err", `bash: ${r.path}: Is a directory\n`); status = 1; continue; }
          if (!this.fs.isDir(this.fs.parent(path))) { this.push("err", `bash: ${r.path}: No such file or directory\n`); status = 1; continue; }
          const before = r.op === ">>" ? (this.fs.text(path) ?? "") : "";
          await this.fs.writeFile(path, before + out.stdout);
        }
        input = "";
      } else if (!last) {
        input = out.stdout;
      }
      if (thrown) throw thrown;
    }
    return this.pipefail && failed ? failed : status;
  }

  expand(words) {
    const out = [];
    for (let w of words) {
      if (w === "~" || w.startsWith("~/")) w = (this.env.HOME ?? HOME) + w.slice(1);
      if (/[*?]/.test(w) && !w.startsWith("-")) {
        const matches = this.glob(w);
        if (matches.length) { out.push(...matches); continue; }
      }
      out.push(unprotect(w));
    }
    return out;
  }
  glob(pattern) {
    const dirPart = pattern.includes("/") ? pattern.slice(0, pattern.lastIndexOf("/") + 1) : "";
    const filePart = pattern.slice(dirPart.length);
    if (/[*?]/.test(dirPart)) return [];
    const dir = this.abs(dirPart || ".");
    if (!this.fs.isDir(dir)) return [];
    const re = new RegExp("^" + filePart.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
    const prefix = dir + "/";
    const names = [...this.fs.nodes.keys()].filter((k) => k.startsWith(prefix) && !k.slice(prefix.length).includes("/"))
      .map((k) => k.slice(prefix.length)).filter((n) => re.test(n) && (!n.startsWith(".") || filePart.startsWith("."))).sort();
    return names.map((n) => dirPart + n);
  }

  async exec(argv, io) {
    const [cmd, ...args] = argv;
    if (cmd.includes("/")) return runExecutable(this, cmd, args, io);
    if (cmd === "git") return runGit(this, args, io);
    if (BUILTINS[cmd]) return BUILTINS[cmd](this, args, io);
    if (extraCommands.has(cmd)) return extraCommands.get(cmd)(this, args, io);
    io.err(`bash: ${cmd}: command not found\n`);
    return 127;
  }
}

/* ---------------------------------------------------------------- built-in commands */

function flagsAndArgs(args, known = "") {
  const flags = new Set(), rest = [];
  let done = false;
  for (const a of args) {
    if (!done && a === "--") { done = true; continue; }
    if (!done && /^-[A-Za-z]+$/.test(a)) for (const ch of a.slice(1)) flags.add(ch);
    else if (!done && a.startsWith("--")) flags.add(a);
    else rest.push(a);
  }
  return { flags, rest };
}

/* ---------------------------------------------------------------- statements and compound commands */

const KEYWORDS = new Set(["if", "then", "elif", "else", "fi", "for", "while", "until", "do", "done"]);

// Split a command line on && || ; (outside quotes and $( … )), keeping the operators: [cmd, op, cmd, …].
function splitList(line) {
  const out = [];
  let cur = "", quote = null, depth = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) { cur += c; if (c === "\\" && quote === '"' && i + 1 < line.length) cur += line[++i]; else if (c === quote) quote = null; continue; }
    if (c === "\\" && i + 1 < line.length) { cur += c + line[++i]; continue; }
    if (c === "'" || c === '"') { quote = c; cur += c; continue; }
    if (c === "#" && (!cur || /\s$/.test(cur)) && !depth) break;
    if (c === "(") depth++;
    if (c === ")" && depth) depth--;
    if (!depth && (line.startsWith("&&", i) || line.startsWith("||", i))) { out.push(cur.trim(), line.slice(i, i + 2)); cur = ""; i++; continue; }
    if (!depth && c === ";") { out.push(cur.trim(), ";"); cur = ""; continue; }
    cur += c;
  }
  out.push(cur.trim());
  // a trailing ; leaves an empty command: drop it
  while (out.length > 1 && out[out.length - 1] === "" && out[out.length - 2] === ";") out.splice(-2);
  return out;
}

// $(( … )): integer arithmetic with + - * / % ( ), comparisons, && || and variables.
function arithmetic(expr, lookup) {
  const toks = expr.match(/\d+|[A-Za-z_]\w*|&&|\|\||<=|>=|==|!=|[-+*/%()<>!]|\S/g) ?? [];
  let i = 0;
  const peek = () => toks[i], next = () => toks[i++];
  const prim = () => {
    const t = next();
    if (t === "(") { const v = or(); next(); return v; }
    if (t === "-") return -prim();
    if (t === "+") return prim();
    if (t === "!") return prim() ? 0 : 1;
    if (/^\d+$/.test(t ?? "")) return Number(t);
    if (/^[A-Za-z_]/.test(t ?? "")) { const v = lookup(t); return Number(v ?? 0) || 0; }
    throw new ShellError(`${expr}: syntax error in expression`);
  };
  const mul = () => { let v = prim(); while (["*", "/", "%"].includes(peek())) { const o = next(), r = prim(); if ((o === "/" || o === "%") && r === 0) throw new ShellError(`${expr}: division by 0`); v = o === "*" ? v * r : o === "/" ? Math.trunc(v / r) : v % r; } return v; };
  const add = () => { let v = mul(); while (["+", "-"].includes(peek())) { const o = next(), r = mul(); v = o === "+" ? v + r : v - r; } return v; };
  const cmp = () => { let v = add(); while (["<", ">", "<=", ">=", "==", "!="].includes(peek())) { const o = next(), r = add(); v = Number({ "<": v < r, ">": v > r, "<=": v <= r, ">=": v >= r, "==": v === r, "!=": v !== r }[o]); } return v; };
  const and = () => { let v = cmp(); while (peek() === "&&") { next(); const r = cmp(); v = v && r ? 1 : 0; } return v; };
  const or = () => { let v = and(); while (peek() === "||") { next(); const r = and(); v = v || r ? 1 : 0; } return v; };
  const v = or();
  if (i < toks.length) throw new ShellError(`${expr}: syntax error in expression`);
  return v;
}

// Split text on ; outside quotes (not inside $( … ) or ${ … }).
function splitSemicolons(text) {
  const out = [];
  let cur = "", quote = null, depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { cur += c; if (c === "\\" && quote === '"' && i + 1 < text.length) { cur += text[++i]; } else if (c === quote) quote = null; continue; }
    if (c === "\\" && i + 1 < text.length) { cur += c + text[++i]; continue; }
    if (c === "'" || c === '"') { quote = c; cur += c; continue; }
    if (c === "#" && (!cur || /\s$/.test(cur)) && !depth) break;
    if (c === "(" || c === "{") depth++;
    if ((c === ")" || c === "}") && depth) depth--;
    if (c === ";" && !depth && text[i + 1] !== ";") { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter((s) => s);
}

// Turn script lines into statements { text, heredoc, line }. A line is split on ; only when it holds keywords
// (if … then … fi on one line); plain command lists stay whole so && || ; work as one line.
function splitStatements(lines) {
  const stmts = [];
  for (let i = 0; i < lines.length; i++) {
    const first = i;
    let line = lines[i];
    while (line.endsWith("\\") && i + 1 < lines.length) line = line.slice(0, -1) + lines[++i].trimStart();
    // a quoted string can run over several lines
    while (openQuote(line) && i + 1 < lines.length) line += "\n" + lines[++i];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    let heredoc = null;
    const hd = /<<(-?)\s*(['"]?)([A-Za-z_][\w]*)\2/.exec(line);
    if (hd) {
      const body = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        const l = hd[1] ? lines[j].replace(/^\t+/, "") : lines[j];
        if (l === hd[3]) break;
        body.push(l);
      }
      var warning = j >= lines.length ? `warning: here-document delimited by end-of-file (wanted '${hd[3]}')` : null;
      heredoc = body.join("\n") + "\n";
      line = line.slice(0, hd.index) + line.slice(hd.index + hd[0].length);
      i = j;
    }
    const segments = splitSemicolons(line);
    const hasKeyword = segments.some((s) => KEYWORDS.has(s.split(/\s+/)[0]));
    const pieces = hasKeyword ? segments : [line.trim()];
    for (const p of pieces) {
      // "then echo hi" → "then" + "echo hi"
      const m = /^(then|else|do)\s+(.+)$/.exec(p);
      if (m) { stmts.push({ text: m[1], from: first, to: i }); stmts.push({ text: m[2], heredoc, from: first, to: i }); }
      else stmts.push({ text: p, heredoc: hasKeyword ? null : heredoc, expand: !!hd && !hd[2], from: first, to: i, warning: hd ? warning : null });
    }
  }
  return stmts;
}

const firstWord = (s) => s.text.split(/\s+/)[0];

// Is a quote still open at the end of this text?
function openQuote(text) {
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote === "'") { if (c === "'") quote = null; continue; }
    if (c === "\\") { i++; continue; }
    if (quote === '"') { if (c === '"') quote = null; continue; }
    if (c === "#" && (i === 0 || /\s/.test(text[i - 1]))) return false;
    if (c === "'" || c === '"') quote = c;
  }
  return quote !== null;
}

// Parse statements into nodes until one of `stops`; returns { nodes, stop }.
function parseBlock(stmts, pos, stops) {
  const nodes = [];
  while (pos.i < stmts.length) {
    const s = stmts[pos.i];
    const w = firstWord(s);
    if (stops.includes(w)) return { nodes, stop: w };
    if (["then", "elif", "else", "fi", "do", "done"].includes(w)) throw new ShellError(`syntax error near unexpected token \`${w}'`);
    if (w === "if") {
      const from = s.from;
      const branches = [];
      let condText = s.text.slice(2).trim();
      let otherwise = null;
      pos.i++;
      for (;;) {
        const cond = [];
        if (condText) cond.push({ type: "simple", text: condText, from, to: from });
        const more = parseBlock(stmts, pos, ["then"]);
        cond.push(...more.nodes);
        if (more.stop !== "then") throw new ShellError("syntax error: unexpected end of file (missing `then')");
        pos.i++;
        const body = parseBlock(stmts, pos, ["elif", "else", "fi"]);
        if (!body.stop) throw new ShellError("syntax error: unexpected end of file (missing `fi')");
        branches.push({ cond, body: body.nodes });
        const st = stmts[pos.i];
        pos.i++;
        if (body.stop === "elif") { condText = st.text.slice(4).trim(); continue; }
        if (body.stop === "else") {
          const e = parseBlock(stmts, pos, ["fi"]);
          if (!e.stop) throw new ShellError("syntax error: unexpected end of file (missing `fi')");
          otherwise = e.nodes;
          pos.i++;
        }
        nodes.push({ type: "if", branches, otherwise, from, to: stmts[pos.i - 1].to });
        break;
      }
      continue;
    }
    if (w === "for") {
      const m = /^for\s+([A-Za-z_]\w*)(?:\s+in\s+(.*))?$/.exec(s.text);
      if (!m) throw new ShellError(`syntax error near \`${s.text}'`);
      const from = s.from;
      pos.i++;
      if (pos.i >= stmts.length || firstWord(stmts[pos.i]) !== "do") throw new ShellError("syntax error: unexpected end of file (missing `do')");
      pos.i++;
      const body = parseBlock(stmts, pos, ["done"]);
      if (!body.stop) throw new ShellError("syntax error: unexpected end of file (missing `done')");
      pos.i++;
      nodes.push({ type: "for", name: m[1], words: m[2] ?? '"$@"', body: body.nodes, from, to: stmts[pos.i - 1].to });
      continue;
    }
    if (w === "while" || w === "until") {
      const from = s.from;
      const cond = [{ type: "simple", text: s.text.slice(w.length).trim(), from, to: from }];
      pos.i++;
      const more = parseBlock(stmts, pos, ["do"]);
      cond.push(...more.nodes);
      if (more.stop !== "do") throw new ShellError("syntax error: unexpected end of file (missing `do')");
      pos.i++;
      const body = parseBlock(stmts, pos, ["done"]);
      if (!body.stop) throw new ShellError("syntax error: unexpected end of file (missing `done')");
      pos.i++;
      nodes.push({ type: "while", until: w === "until", cond, body: body.nodes, from, to: stmts[pos.i - 1].to });
      continue;
    }
    nodes.push({ type: "simple", text: s.text, heredoc: s.heredoc, expand: s.expand, from: s.from, to: s.to, warning: s.warning });
    pos.i++;
  }
  return { nodes, stop: null };
}

// test / [ … ]: file tests, string tests and integer comparisons, with ! -a -o.
function testExpr(sh, args, io) {
  const num = (s) => {
    if (!/^\s*-?\d+\s*$/.test(s)) { io.err(`bash: test: ${s}: integer expression expected\n`); throw new ExitSignal(2); }
    return Number(s);
  };
  const unary = (op, v) => {
    const p = sh.abs(v ?? "");
    const n = sh.fs.get(p);
    switch (op) {
      case "-e": case "-a": return !!n;
      case "-f": return !!n && n.type === "file";
      case "-d": return !!n && n.type === "dir";
      case "-s": return !!n && n.type === "file" && n.data.length > 0;
      case "-x": return !!n && (n.mode & 0o111) !== 0;
      case "-r": case "-w": return !!n;
      case "-z": return (v ?? "") === "";
      case "-n": return (v ?? "") !== "";
      default: return null;
    }
  };
  const evalOne = (a) => {
    if (a.length === 0) return false;
    if (a[0] === "!") return !evalOne(a.slice(1));
    if (a.length === 1) return a[0] !== "";
    if (a.length === 2) {
      const r = unary(a[0], a[1]);
      if (r === null) { io.err(`bash: test: ${a[0]}: unary operator expected\n`); throw new ExitSignal(2); }
      return r;
    }
    if (a.length === 3) {
      const [x, op, y] = a;
      switch (op) {
        case "=": case "==": return x === y;
        case "!=": return x !== y;
        case "-eq": return num(x) === num(y);
        case "-ne": return num(x) !== num(y);
        case "-lt": return num(x) < num(y);
        case "-le": return num(x) <= num(y);
        case "-gt": return num(x) > num(y);
        case "-ge": return num(x) >= num(y);
        case "<": return x < y;
        case ">": return x > y;
      }
    }
    io.err(`bash: test: too many arguments\n`);
    throw new ExitSignal(2);
  };
  const evalOr = (a) => {
    const i = a.lastIndexOf("-o");
    if (i > 0) return evalOr(a.slice(0, i)) || evalOr(a.slice(i + 1));
    const j = a.lastIndexOf("-a");
    if (j > 0 && a.length !== 2) return evalOr(a.slice(0, j)) && evalOr(a.slice(j + 1));
    return evalOne(a);
  };
  try {
    return evalOr(args) ? 0 : 1;
  } catch (e) {
    if (e instanceof ExitSignal) return e.code;
    throw e;
  }
}

// bash script.sh / sh script.sh / bash -c "…" / ./script.sh: run a file's commands in a child shell scope.
async function runScriptFile(sh, args, io, name, { text = null, path = null } = {}) {
  let k = 0, errexit = false, inline = null;
  while (args[k] && args[k].startsWith("-") && args[k] !== "-") {
    if (args[k] === "-c") { inline = args[k + 1] ?? ""; k += 2; break; }
    if (args[k].includes("e")) errexit = true;
    if (args[k].includes("x")) sh.xtrace = true;
    k++;
  }
  let script = text;
  if (inline !== null) script = inline;
  else if (script === null) {
    if (!args[k]) { io.err(`${name}: the sandbox needs a script file to run (${name} file.sh)\n`); return 2; }
    path = args[k];
    script = sh.fs.text(sh.abs(path));
    if (script === null) { io.err(`${name}: ${path}: No such file or directory\n`); return 127; }
    k++;
  }
  const savedEnv = { ...sh.env }, savedCwd = sh.cwd;
  const saved = { errexit: sh.errexit, pipefail: sh.pipefail, nounset: sh.nounset, xtrace: sh.xtrace };
  sh.errexit = errexit; sh.pipefail = false; sh.nounset = false;
  let status;
  try {
    status = await sh.through(io, () => sh.runScript(script.replace(/^#!.*\n/, "\n"), { echo: false, args: args.slice(k) }));
  } finally {
    sh.env = savedEnv; sh.cwd = savedCwd;
    Object.assign(sh, saved);
  }
  return status;
}

// ./script.sh or /path/to/tool: a file run as a program, by its #! line.
async function runExecutable(sh, cmd, args, io) {
  const path = sh.abs(cmd);
  const n = sh.fs.get(path);
  if (!n) { io.err(`bash: ${cmd}: No such file or directory\n`); return 127; }
  if (n.type === "dir") { io.err(`bash: ${cmd}: Is a directory\n`); return 126; }
  if ((n.mode & 0o111) === 0) { io.err(`bash: ${cmd}: Permission denied\n`); return 126; }
  const text = sh.fs.text(path) ?? "";
  const bang = /^#!\s*(\S+)(?:\s+(\S+))?/.exec(text);
  const interp = bang ? (bang[1].endsWith("/env") ? bang[2] : bang[1].split("/").pop()) : "bash";
  if (interp === "node") return sh.exec(["node", cmd, ...args], io);
  if (!["bash", "sh"].includes(interp)) { io.err(`bash: ${cmd}: ${bang[1]}: bad interpreter: the sandbox runs bash, sh and node scripts\n`); return 126; }
  return runScriptFile(sh, args, io, interp, { text, path: cmd });
}

// grep and sed use basic regular expressions (BRE) unless given -E: there \( \) \| \+ \? \{ \} are special and
// ( ) | + ? { } are ordinary characters. Translate either kind into a JavaScript RegExp source.
function regexSource(pattern, extended) {
  let out = "", i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === "[") {
      // a bracket expression is copied as it is (a ] right after [ or [^ is part of it)
      let j = i + 1;
      if (pattern[j] === "^") j++;
      if (pattern[j] === "]") j++;
      while (j < pattern.length && pattern[j] !== "]") j++;
      out += pattern.slice(i, j + 1).replace(/\[:alpha:\]/g, "a-zA-Z").replace(/\[:digit:\]/g, "0-9").replace(/\[:space:\]/g, "\\s").replace(/\[:alnum:\]/g, "a-zA-Z0-9").replace(/\[:upper:\]/g, "A-Z").replace(/\[:lower:\]/g, "a-z");
      i = j + 1;
      continue;
    }
    if (c === "\\" && i + 1 < pattern.length) {
      const n = pattern[i + 1];
      if (!extended && "(){}|+?".includes(n)) out += n;
      else out += "\\" + n;
      i += 2;
      continue;
    }
    if (!extended && "(){}|+?".includes(c)) { out += "\\" + c; i++; continue; }
    out += c;
    i++;
  }
  return out;
}

// One line of ls -l: permissions, owner, size, date and name.
function longLine(sh, full, name) {
  const n = sh.fs.get(full);
  const dir = n.type === "dir";
  const mode = dir ? 0o755 : n.mode & 0o777;
  const bits = [6, 3, 0].map((sft) => { const b = (mode >> sft) & 7; return (b & 4 ? "r" : "-") + (b & 2 ? "w" : "-") + (b & 1 ? "x" : "-"); }).join("");
  const size = dir ? 4096 : n.data.length;
  const owner = (sh.env.USER ?? "learner").padEnd(7);
  return `${dir ? "d" : "-"}${bits} 1 ${owner} ${owner} ${String(size).padStart(5)} Oct  1 09:00 ${name}\n`;
}

const BUILTINS = {
  async cut(sh, args, io) {
    let delim = "\t", fields = null, chars = null;
    const files = [];
    for (let k = 0; k < args.length; k++) {
      const a = args[k];
      if (a === "-d") delim = args[++k] ?? "\t";
      else if (a.startsWith("-d")) delim = a.slice(2);
      else if (a === "-f") fields = args[++k];
      else if (a.startsWith("-f")) fields = a.slice(2);
      else if (a === "-c") chars = args[++k];
      else if (a.startsWith("-c")) chars = a.slice(2);
      else files.push(a);
    }
    const spec = fields ?? chars;
    if (!spec) { io.err("cut: you must specify a list of bytes, characters, or fields\n"); return 1; }
    const ranges = spec.split(",").map((r) => { const m = /^(\d*)(-?)(\d*)$/.exec(r); const a = Number(m[1] || 1), b = m[2] ? (m[3] ? Number(m[3]) : Infinity) : a; return [a, b]; });
    const pick = (n) => ranges.some(([a, b]) => n >= a && n <= b);
    const text = files.length ? files.map((f) => sh.fs.text(sh.abs(f)) ?? "").join("") : io.stdin;
    const lines = text.split("\n");
    if (lines.at(-1) === "") lines.pop();
    for (const line of lines) {
      if (chars) io.out([...line].filter((_, i) => pick(i + 1)).join("") + "\n");
      else if (!line.includes(delim)) io.out(line + "\n");
      else io.out(line.split(delim).filter((_, i) => pick(i + 1)).join(delim) + "\n");
    }
    return 0;
  },
  async tr(sh, args, io) {
    const del = args[0] === "-d";
    const set = (x) => x.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/(.)-(.)/g, (_, a, b) => { let r = ""; for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c++) r += String.fromCharCode(c); return r; });
    if (del) { const d = set(args[1] ?? ""); io.out([...io.stdin].filter((c) => !d.includes(c)).join("")); return 0; }
    const from = set(args[0] ?? ""), to = set(args[1] ?? "");
    io.out([...io.stdin].map((c) => { const i = from.indexOf(c); return i < 0 ? c : to[Math.min(i, to.length - 1)] ?? ""; }).join(""));
    return 0;
  },
  async uniq(sh, args, io) {
    const count = args.includes("-c");
    const lines = io.stdin.split("\n");
    if (lines.at(-1) === "") lines.pop();
    const out = [];
    for (const l of lines) { if (out.length && out.at(-1)[0] === l) out.at(-1)[1]++; else out.push([l, 1]); }
    io.out(out.map(([l, n]) => (count ? `${String(n).padStart(7)} ${l}` : l) + "\n").join(""));
    return 0;
  },
  async export(sh, args, io) {
    for (const a of args) {
      if (a === "-p" || a === "-n") continue;
      const eq = a.indexOf("=");
      if (eq > 0) sh.env[a.slice(0, eq)] = a.slice(eq + 1);
      else if (!/^[A-Za-z_]\w*$/.test(a)) { io.err(`bash: export: \`${a}': not a valid identifier\n`); return 1; }
      else if (sh.env[a] === undefined) sh.env[a] = "";
    }
    if (!args.length) for (const k of Object.keys(sh.env).sort()) io.out(`declare -x ${k}="${sh.env[k]}"\n`);
    return 0;
  },
  async unset(sh, args) { for (const a of args) if (!a.startsWith("-")) delete sh.env[a]; return 0; },
  async set(sh, args, io) {
    for (let k = 0; k < args.length; k++) {
      const a = args[k];
      if (a === "-o" || a === "+o") {
        const name = args[++k], on = a === "-o";
        if (name === "pipefail") sh.pipefail = on;
        else if (name === "errexit") sh.errexit = on;
        else if (name === "nounset") sh.nounset = on;
        else if (name === "xtrace") sh.xtrace = on;
        continue;
      }
      if (/^[-+][euxo]+$/.test(a)) {
        const on = a[0] === "-";
        for (const ch of a.slice(1)) {
          if (ch === "e") sh.errexit = on;
          if (ch === "u") sh.nounset = on;
          if (ch === "x") sh.xtrace = on;
          if (ch === "o") { const name = args[++k]; if (name === "pipefail") sh.pipefail = on; }
        }
        continue;
      }
      io.err(`bash: set: ${a}: the sandbox supports set -e, -u, -x and -o pipefail\n`);
      return 2;
    }
    return 0;
  },
  async exit(sh, args, io) {
    const code = args.length ? Number(args[0]) : sh.lastStatus;
    if (Number.isNaN(code)) { io.err(`bash: exit: ${args[0]}: numeric argument required\n`); throw new ExitSignal(2); }
    throw new ExitSignal(((code % 256) + 256) % 256);
  },
  async test(sh, args, io) { return testExpr(sh, args, io); },
  async "["(sh, args, io) {
    if (args[args.length - 1] !== "]") { io.err("bash: [: missing `]'\n"); return 2; }
    return testExpr(sh, args.slice(0, -1), io);
  },
  async bash(sh, args, io) { return runScriptFile(sh, args, io, "bash"); },
  async sh(sh, args, io) { return runScriptFile(sh, args, io, "sh"); },
  async source(sh, args, io) {
    if (!args.length) { io.err("bash: source: filename argument required\n"); return 2; }
    const text = sh.fs.text(sh.abs(args[0]));
    if (text === null) { io.err(`bash: ${args[0]}: No such file or directory\n`); return 1; }
    return sh.through(io, () => sh.runScript(text, { echo: false, args: args.slice(1) }));
  },
  async "."(sh, args, io) { return BUILTINS.source(sh, args, io); },
  async env(sh, args, io) {
    if (args.length) return sh.exec(args, io);
    for (const k of Object.keys(sh.env).sort()) io.out(`${k}=${sh.env[k]}\n`);
    return 0;
  },
  async printenv(sh, args, io) {
    if (!args.length) return BUILTINS.env(sh, [], io);
    let status = 0;
    for (const a of args) { if (sh.env[a] === undefined) status = 1; else io.out(sh.env[a] + "\n"); }
    return status;
  },
  async chmod(sh, args, io) {
    const [mode, ...files] = args.filter((a) => a !== "-R");
    for (const f of files) {
      const p = sh.abs(f);
      const n = sh.fs.get(p);
      if (!n) { io.err(`chmod: cannot access '${f}': No such file or directory\n`); return 1; }
      let bits = n.mode & 0o777;
      if (/^[0-7]{3,4}$/.test(mode)) bits = parseInt(mode, 8);
      else {
        const m = /^([ugoa]*)([+-=])([rwx]+)$/.exec(mode);
        if (!m) { io.err(`chmod: invalid mode: '${mode}'\n`); return 1; }
        const who = m[1] || "a";
        let mask = 0;
        for (const p of m[3]) {
          const v = p === "r" ? 4 : p === "w" ? 2 : 1;
          if (who.includes("u") || who.includes("a")) mask |= v << 6;
          if (who.includes("g") || who.includes("a")) mask |= v << 3;
          if (who.includes("o") || who.includes("a")) mask |= v;
        }
        bits = m[2] === "+" ? bits | mask : m[2] === "-" ? bits & ~mask : mask;
      }
      await sh.fs.chmod(p, bits);
    }
    return 0;
  },
  async sleep() { return 0; },
  async basename(sh, args, io) {
    let b = (args[0] ?? "").replace(/\/+$/, "");
    b = b.slice(b.lastIndexOf("/") + 1);
    if (args[1] && b.endsWith(args[1]) && b !== args[1]) b = b.slice(0, -args[1].length);
    io.out(b + "\n");
    return 0;
  },
  async dirname(sh, args, io) {
    const p = (args[0] ?? "").replace(/\/+$/, "");
    const i = p.lastIndexOf("/");
    io.out((i < 0 ? "." : i === 0 ? "/" : p.slice(0, i)) + "\n");
    return 0;
  },
  async date(sh, args, io) {
    const t = new Date(sh.clockSeconds() * 1000);
    const fmt = args.find((a) => a.startsWith("+"));
    const p = (n) => String(n).padStart(2, "0");
    const parts = { Y: t.getUTCFullYear(), m: p(t.getUTCMonth() + 1), d: p(t.getUTCDate()), H: p(t.getUTCHours()), M: p(t.getUTCMinutes()), S: p(t.getUTCSeconds()), s: Math.floor(t / 1000) };
    if (fmt) {
      io.out(fmt.slice(1).replace(/%F/g, "%Y-%m-%d").replace(/%T/g, "%H:%M:%S").replace(/%([YmdHMSs%])/g, (_, k) => (k === "%" ? "%" : parts[k])) + "\n");
    } else {
      io.out(`${DAYS[t.getUTCDay()]} ${MONTHS[t.getUTCMonth()]} ${String(t.getUTCDate()).padStart(2)} ${parts.H}:${parts.M}:${parts.S} UTC ${parts.Y}\n`);
    }
    return 0;
  },
  async pwd(sh, args, io) { io.out(sh.cwd + "\n"); return 0; },
  async cd(sh, args, io) {
    const target = sh.abs(args[0] ?? HOME);
    if (!sh.fs.exists(target)) { io.err(`bash: cd: ${args[0]}: No such file or directory\n`); return 1; }
    if (!sh.fs.isDir(target)) { io.err(`bash: cd: ${args[0]}: Not a directory\n`); return 1; }
    sh.cwd = target;
    return 0;
  },
  async echo(sh, args, io) {
    let newline = true, escapes = false;
    while (args.length && /^-[neE]+$/.test(args[0])) {
      if (args[0].includes("n")) newline = false;
      if (args[0].includes("e")) escapes = true;
      args = args.slice(1);
    }
    let text = args.join(" ");
    if (escapes) text = text.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
    io.out(text + (newline ? "\n" : ""));
    return 0;
  },
  async printf(sh, args, io) {
    const [fmt = "", ...vals] = args;
    const esc = (t) => t.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\\\/g, "\\");
    let i = 0, out = "";
    do {
      out += esc(fmt).replace(/%%|%(-?\d*)([sd])/g, (m, w, k) => {
        if (m === "%%") return "%";
        let v = vals[i++] ?? (k === "d" ? "0" : "");
        if (k === "d") v = String(parseInt(v, 10) || 0);
        const width = Number(w.replace("-", "")) || 0;
        return w.startsWith("-") ? v.padEnd(width) : v.padStart(width);
      });
    } while (i < vals.length && /%[-\d]*[sd]/.test(fmt));
    io.out(out);
    return 0;
  },
  async ls(sh, args, io) {
    const { flags, rest } = flagsAndArgs(args);
    const targets = rest.length ? rest : ["."];
    let status = 0;
    for (const [n, t] of targets.entries()) {
      const p = sh.abs(t);
      if (!sh.fs.exists(p)) { io.err(`ls: cannot access '${t}': No such file or directory\n`); status = 2; continue; }
      if (!sh.fs.isDir(p)) { io.out(flags.has("l") ? longLine(sh, p, t) : t + "\n"); continue; }
      let names = await sh.fs.readdir(p);
      if (!flags.has("a")) names = names.filter((x) => !x.startsWith("."));
      else names = [".", "..", ...names];
      if (targets.length > 1) io.out(`${n ? "\n" : ""}${t}:\n`);
      if (flags.has("l")) {
        for (const name of names) {
          const full = name === "." ? p : name === ".." ? sh.fs.parent(p) : p + "/" + name;
          io.out(longLine(sh, full, name + (sh.fs.isDir(full) && flags.has("F") ? "/" : "")));
        }
      } else if (names.length) {
        io.out(names.map((name) => name + (flags.has("F") && sh.fs.isDir(p + "/" + name) ? "/" : "")).join("  ") + "\n");
      }
    }
    return status;
  },
  async cat(sh, args, io) {
    if (!args.length) { io.out(io.stdin); return 0; }
    let status = 0;
    for (const a of args) {
      const p = sh.abs(a);
      if (!sh.fs.exists(p)) { io.err(`cat: ${a}: No such file or directory\n`); status = 1; continue; }
      if (sh.fs.isDir(p)) { io.err(`cat: ${a}: Is a directory\n`); status = 1; continue; }
      io.out(sh.fs.text(p));
    }
    return status;
  },
  async mkdir(sh, args, io) {
    const { flags, rest } = flagsAndArgs(args);
    if (!rest.length) { io.err("mkdir: missing operand\n"); return 1; }
    let status = 0;
    for (const a of rest) {
      try { await sh.fs.mkdir(sh.abs(a), { recursive: flags.has("p") }); }
      catch (e) {
        io.err(e.code === "EEXIST" ? `mkdir: cannot create directory '${a}': File exists\n` : `mkdir: cannot create directory '${a}': No such file or directory\n`);
        status = 1;
      }
    }
    return status;
  },
  async touch(sh, args, io) {
    for (const a of args) {
      const p = sh.abs(a);
      if (!sh.fs.isDir(sh.fs.parent(p))) { io.err(`touch: cannot touch '${a}': No such file or directory\n`); return 1; }
      if (!sh.fs.exists(p)) await sh.fs.writeFile(p, "");
    }
    return 0;
  },
  async rm(sh, args, io) {
    const { flags, rest } = flagsAndArgs(args);
    let status = 0;
    for (const a of rest) {
      const p = sh.abs(a);
      if (!sh.fs.exists(p)) { if (!flags.has("f")) { io.err(`rm: cannot remove '${a}': No such file or directory\n`); status = 1; } continue; }
      if (sh.fs.isDir(p)) {
        if (!flags.has("r") && !flags.has("R")) { io.err(`rm: cannot remove '${a}': Is a directory\n`); status = 1; continue; }
        for (const k of [...sh.fs.nodes.keys()].filter((k) => k === p || k.startsWith(p + "/")).sort().reverse()) sh.fs.nodes.delete(k);
      } else await sh.fs.unlink(p);
    }
    return status;
  },
  async mv(sh, args, io) {
    if (args.length !== 2) { io.err("mv: expected a source and a destination\n"); return 1; }
    const [from, to] = args.map((a) => sh.abs(a));
    if (!sh.fs.exists(from)) { io.err(`mv: cannot stat '${args[0]}': No such file or directory\n`); return 1; }
    const dest = sh.fs.isDir(to) ? to + "/" + from.slice(from.lastIndexOf("/") + 1) : to;
    for (const k of [...sh.fs.nodes.keys()].filter((k) => k === from || k.startsWith(from + "/")).sort()) {
      const node = sh.fs.nodes.get(k);
      sh.fs.nodes.delete(k);
      sh.fs.nodes.set(dest + k.slice(from.length), { ...node, mtime: sh.fs.tick() });
    }
    return 0;
  },
  async cp(sh, args, io) {
    const { flags, rest } = flagsAndArgs(args);
    if (rest.length !== 2) { io.err("cp: expected a source and a destination\n"); return 1; }
    const [from, to] = rest.map((a) => sh.abs(a));
    if (!sh.fs.exists(from)) { io.err(`cp: cannot stat '${rest[0]}': No such file or directory\n`); return 1; }
    if (sh.fs.isDir(from) && !flags.has("r")) { io.err(`cp: -r not specified; omitting directory '${rest[0]}'\n`); return 1; }
    const dest = sh.fs.isDir(to) ? to + "/" + from.slice(from.lastIndexOf("/") + 1) : to;
    for (const k of [...sh.fs.nodes.keys()].filter((k) => k === from || k.startsWith(from + "/")).sort()) {
      const node = sh.fs.nodes.get(k);
      sh.fs.nodes.set(dest + k.slice(from.length), { ...node, data: node.data && node.data.slice(), mtime: sh.fs.tick(), ino: ++sh.fs.inode });
    }
    return 0;
  },
  async head(sh, args, io) { return headTail(sh, args, io, true); },
  async tail(sh, args, io) { return headTail(sh, args, io, false); },
  async wc(sh, args, io) {
    const { flags, rest } = flagsAndArgs(args);
    const text = rest.length ? (sh.fs.text(sh.abs(rest[0])) ?? "") : io.stdin;
    const lines = (text.match(/\n/g) || []).length;
    const words = (text.match(/\S+/g) || []).length;
    if (flags.has("l")) io.out(`${lines}${rest[0] ? " " + rest[0] : ""}\n`);
    else if (flags.has("w")) io.out(`${words}${rest[0] ? " " + rest[0] : ""}\n`);
    else io.out(`${String(lines).padStart(7)} ${String(words).padStart(7)} ${String(text.length).padStart(7)}${rest[0] ? " " + rest[0] : ""}\n`);
    return 0;
  },
  async grep(sh, args, io) {
    let after = 0, before = 0;
    const plain = [];
    for (let k = 0; k < args.length; k++) {
      const m = /^-([ABC])(\d*)$/.exec(args[k]);
      if (m) { const n = Number(m[2] || args[++k]); if (m[1] !== "B") after = n; if (m[1] !== "A") before = n; }
      else plain.push(args[k]);
    }
    args = plain;
    const { flags, rest } = flagsAndArgs(args);
    const [pattern, ...files] = rest;
    if (pattern === undefined) { io.err("Usage: grep [OPTION]... PATTERNS [FILE]...\n"); return 2; }
    let src = flags.has("F") ? pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : regexSource(pattern, flags.has("E"));
    if (flags.has("x")) src = `^(?:${src})$`;
    if (flags.has("w")) src = `\\b(?:${src})\\b`;
    let re;
    try { re = new RegExp(src, flags.has("i") ? "i" : ""); } catch { io.err(`grep: Unmatched ( or \\(\n`); return 2; }
    let found = false, count = 0;
    const sources = files.length ? files.map((f) => [f, sh.fs.text(sh.abs(f))]) : [[null, io.stdin]];
    let lastPrinted = -1, printedAny = false;
    for (const [name, text] of sources) {
      if (text === null) { io.err(`grep: ${name}: No such file or directory\n`); continue; }
      const all = text.split("\n");
      if (all.at(-1) === "") all.pop();
      const pre = (i, sep) => `${files.length > 1 ? name + sep : ""}${flags.has("n") ? i + 1 + sep : ""}`;
      lastPrinted = -1;
      let afterLeft = 0;
      all.forEach((ln, i) => {
        const hit = re.test(ln) !== flags.has("v");
        if (!hit) {
          if (afterLeft > 0 && !flags.has("q") && !flags.has("c")) { io.out(pre(i, "-") + ln + "\n"); lastPrinted = i; afterLeft--; }
          return;
        }
        found = true;
        count++;
        if (flags.has("q") || flags.has("c")) return;
        if (before || after) {
          const from = Math.max(lastPrinted + 1, i - before);
          if (printedAny && from > lastPrinted + 1) io.out("--\n");
          for (let k = from; k < i; k++) io.out(pre(k, "-") + all[k] + "\n");
        }
        if (flags.has("o") && !flags.has("v")) {
          const g = new RegExp(re.source, re.flags + "g");
          for (const m of ln.matchAll(g)) io.out(pre(i, ":") + m[0] + "\n");
        } else io.out(pre(i, ":") + ln + "\n");
        lastPrinted = i;
        printedAny = true;
        afterLeft = after;
      });
    }
    if (flags.has("c")) io.out(`${count}\n`);
    return found ? 0 : 1;
  },
  async sort(sh, args, io) {
    const { flags, rest } = flagsAndArgs(args);
    const text = rest.length ? (sh.fs.text(sh.abs(rest[0])) ?? "") : io.stdin;
    let lines = text.split("\n").filter((l, i, a) => !(i === a.length - 1 && l === ""));
    lines.sort();
    if (flags.has("r")) lines.reverse();
    io.out(lines.map((l) => l + "\n").join(""));
    return 0;
  },
  async sed(sh, args, io) {
    let inPlace = false, quiet = false, extended = false;
    const scripts = [], files = [];
    for (let k = 0; k < args.length; k++) {
      const a = args[k];
      if (a === "-i" || a === "--in-place") inPlace = true;
      else if (a === "-n") quiet = true;
      else if (a === "-e") scripts.push(args[++k] ?? "");
      else if (a === "-E" || a === "-r") extended = true;
      else if (!scripts.length) scripts.push(a);
      else files.push(a);
    }
    // s/old/new/flags commands, separated by ; or given with -e
    const cmds = [];
    for (const script of scripts) {
      let rest = script.trim();
      while (rest) {
        const del = /^(?:\/((?:\\.|[^/])*)\/|(\d+)|(\$))d\s*(?:;\s*|$)/.exec(rest);
        if (del) {
          let re = null;
          if (del[1] !== undefined) { try { re = new RegExp(regexSource(del[1], extended)); } catch { io.err(`sed: -e expression #1, char ${del[0].length}: Unmatched ( or \\(\n`); return 1; } }
          cmds.push({ del: true, re, line: del[2] ? Number(del[2]) : del[3] ? "$" : null });
          rest = rest.slice(del[0].length);
          continue;
        }
        const m = /^s(.)((?:\\.|(?!\1).)*)\1((?:\\.|(?!\1).)*)\1([gip]*)\s*(?:;\s*|$)/.exec(rest);
        if (!m) { io.err(`sed: this sandbox supports s/old/new/g substitutions and /pattern/d deletions (several separated by ;)\n`); return 1; }
        const flags = (m[4].includes("i") ? "i" : "") + (m[4].includes("g") ? "g" : "");
        let re;
        try { re = new RegExp(regexSource(m[2], extended), flags); } catch { io.err(`sed: -e expression #1, char ${m[0].length}: Unmatched ( or \\(\n`); return 1; }
        // the replacement: & is the match, \1-\9 groups, \n a newline, \t a tab, \& a literal &
        const rep = m[3].replace(/\$/g, "$$$$").replace(/\\(.)|&/g, (all, ch) => (all === "&" ? "$&" : /\d/.test(ch) ? "$" + ch : ch === "n" ? "\n" : ch === "t" ? "\t" : ch));
        cmds.push({ re, rep, print: m[4].includes("p") });
        rest = rest.slice(m[0].length);
      }
    }
    const run = (text) => {
      const lines = text.split("\n");
      const trailing = lines.at(-1) === "";
      if (trailing) lines.pop();
      const out = [];
      lines.forEach((line, i) => {
        let printed = false, cur = line, deleted = false;
        for (const c of cmds) {
          if (c.del) { if ((c.re && c.re.test(cur)) || c.line === i + 1 || (c.line === "$" && i === lines.length - 1)) { deleted = true; break; } continue; }
          const next = cur.replace(c.re, c.rep);
          if (next !== cur && c.print) printed = true;
          cur = next;
        }
        if (deleted) return;
        if (!quiet || printed) out.push(cur);
      });
      return out.length ? out.join("\n") + (trailing || quiet ? "\n" : "") : "";
    };
    if (!files.length) { io.out(run(io.stdin)); return 0; }
    for (const file of files) {
      const text = sh.fs.text(sh.abs(file));
      if (text === null) { io.err(`sed: can't read ${file}: No such file or directory\n`); return 2; }
      if (inPlace) await sh.fs.writeFile(sh.abs(file), run(text));
      else io.out(run(text));
    }
    return 0;
  },
  async clear(sh) { sh.parts.length = 0; sh.size = 0; return 0; },
  async true() { return 0; },
  async false() { return 1; },
  async tree(sh, args, io) {
    const root = sh.abs(args[0] ?? ".");
    const lines = [args[0] ?? "."];
    let dirs = 0, files = 0;
    const walk = async (dir, prefix) => {
      const names = (await sh.fs.readdir(dir)).filter((n) => !n.startsWith("."));
      names.forEach(() => {});
      for (const [i, name] of names.entries()) {
        const lastOne = i === names.length - 1;
        lines.push(`${prefix}${lastOne ? "└── " : "├── "}${name}`);
        const full = dir + "/" + name;
        if (sh.fs.isDir(full)) { dirs++; await walk(full, prefix + (lastOne ? "    " : "│   ")); } else files++;
      }
    };
    await walk(root, "");
    io.out(lines.join("\n") + `\n\n${dirs} director${dirs === 1 ? "y" : "ies"}, ${files} file${files === 1 ? "" : "s"}\n`);
    return 0;
  },
};

function headTail(sh, args, io, head) {
  let n = 10;
  const files = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-n") n = Number(args[++i]);
    else if (/^-\d+$/.test(args[i])) n = Number(args[i].slice(1));
    else files.push(args[i]);
  }
  const text = files.length ? (sh.fs.text(sh.abs(files[0])) ?? "") : io.stdin;
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  const picked = head ? lines.slice(0, n) : lines.slice(Math.max(0, lines.length - n));
  io.out(picked.map((l) => l + "\n").join(""));
  return Promise.resolve(0);
}

/* ---------------------------------------------------------------- diffs (line-based, like git diff) */

function splitLines(text) {
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

// Longest-common-subsequence diff of two line arrays: a list of [" " | "-" | "+", line].
export function diffLines(a, b) {
  const n = a.length, m = b.length;
  // trim common prefix and suffix to keep the table small
  let start = 0;
  while (start < n && start < m && a[start] === b[start]) start++;
  let endA = n, endB = m;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  const A = a.slice(start, endA), B = b.slice(start, endB);
  const rows = A.length + 1, cols = B.length + 1;
  const L = new Uint32Array(rows * cols);
  for (let i = A.length - 1; i >= 0; i--) {
    for (let j = B.length - 1; j >= 0; j--) {
      L[i * cols + j] = A[i] === B[j] ? L[(i + 1) * cols + j + 1] + 1 : Math.max(L[(i + 1) * cols + j], L[i * cols + j + 1]);
    }
  }
  const out = a.slice(0, start).map((l) => [" ", l]);
  let i = 0, j = 0;
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) { out.push([" ", A[i]]); i++; j++; }
    else if (L[(i + 1) * cols + j] >= L[i * cols + j + 1]) out.push(["-", A[i++]]);
    else out.push(["+", B[j++]]);
  }
  while (i < A.length) out.push(["-", A[i++]]);
  while (j < B.length) out.push(["+", B[j++]]);
  for (const l of a.slice(endA)) out.push([" ", l]);
  return out;
}

function hunks(ops, context = 3) {
  const result = [];
  let aLine = 1, bLine = 1;
  const marks = ops.map((op) => {
    const m = { op, a: aLine, b: bLine };
    if (op[0] !== "+") aLine++;
    if (op[0] !== "-") bLine++;
    return m;
  });
  const changed = marks.map((m, i) => (m.op[0] !== " " ? i : -1)).filter((i) => i >= 0);
  if (!changed.length) return result;
  let groupStart = changed[0], groupEnd = changed[0];
  const groups = [];
  for (const idx of changed.slice(1)) {
    if (idx - groupEnd <= context * 2) groupEnd = idx;
    else { groups.push([groupStart, groupEnd]); groupStart = groupEnd = idx; }
  }
  groups.push([groupStart, groupEnd]);
  for (const [s, e] of groups) {
    const from = Math.max(0, s - context), to = Math.min(marks.length - 1, e + context);
    const slice = marks.slice(from, to + 1);
    const aCount = slice.filter((m) => m.op[0] !== "+").length;
    const bCount = slice.filter((m) => m.op[0] !== "-").length;
    const aStart = aCount ? slice.find((m) => m.op[0] !== "+").a : slice[0].a - 1;
    const bStart = bCount ? slice.find((m) => m.op[0] !== "-").b : slice[0].b - 1;
    const range = (start, count) => (count === 1 ? `${start}` : `${start},${count}`);
    // like git without a diff driver: the nearest line above the hunk that starts with a letter, _ or $
    const firstOld = slice.find((m) => m.op[0] !== "+")?.a ?? aStart + 1;
    let func = "";
    for (const m of marks) {
      if (m.op[0] === "+" || m.a >= firstOld) continue;
      if (/^[A-Za-z_$]/.test(m.op[1])) func = m.op[1];
    }
    func = func.slice(0, 80).replace(/\s+$/, "");
    result.push({ header: `@@ -${range(aStart, aCount)} +${range(bStart, bCount)} @@${func ? " " + func : ""}`, lines: slice.map((m) => m.op[0] + m.op[1]) });
  }
  return result;
}

/* ---------------------------------------------------------------- git */

const short = (oid) => oid.slice(0, 7);

async function findRoot(sh, start = sh.cwd) {
  let dir = start;
  for (;;) {
    if (sh.fs.isDir(dir + "/.git")) return dir;
    if (dir === "/") return null;
    dir = sh.fs.parent(dir);
  }
}

class GitError extends Error {
  constructor(message, status = 128) { super(message); this.status = status; }
}

async function getConfigValue(sh, dir, key) {
  if (sh.configOverride?.has(key)) return sh.configOverride.get(key);
  if (dir) {
    const local = await git.getConfig({ fs: sh.fs, dir, path: key }).catch(() => undefined);
    if (local !== undefined) return local;
  }
  return sh.globalConfig.get(key);
}

async function identity(sh, dir) {
  const name = await getConfigValue(sh, dir, "user.name");
  const email = await getConfigValue(sh, dir, "user.email");
  if (!name || !email) {
    throw new GitError(`Author identity unknown

*** Please tell me who you are.

Run

  git config --global user.email "you@example.com"
  git config --global user.name "Your Name"

to set your account's default identity.
Omit --global to set the identity only in this repository.

fatal: unable to auto-detect email address (got '${sh.runner ? "runner@runnervm" + "0x1fz.ksj3lzpj4m5edcwpwdq3dwb2rh.dx.internal.cloudapp.net" : "learner@sandbox.(none)"}')`);
  }
  return { name, email, timestamp: sh.now(), timezoneOffset: 0 };
}

// Turn HEAD, HEAD~2, HEAD^, main, v1.0, a1b2c3d into a full commit id.
async function resolveCommit(sh, dir, rev) {
  const m = /^(.*?)((?:[~^]\d*)*)$/.exec(rev);
  let base = m[1] || "HEAD";
  const suffix = m[2];
  let oid;
  if (base === "@") base = "HEAD";
  try {
    oid = await git.resolveRef({ fs: sh.fs, dir, ref: base });
  } catch {
    if (/^[0-9a-f]{4,40}$/.test(base)) {
      try { oid = await git.expandOid({ fs: sh.fs, dir, oid: base }); } catch { oid = null; }
    }
  }
  if (!oid) {
    if (base === "HEAD") throw new GitError("fatal: ambiguous argument 'HEAD': unknown revision or path not in the working tree.\nYour current branch does not have any commits yet.");
    throw new GitError(`fatal: ambiguous argument '${rev}': unknown revision or path not in the working tree.`);
  }
  // annotated tags point at tag objects: peel to the commit
  let obj = await git.readObject({ fs: sh.fs, dir, oid });
  while (obj.type === "tag") { oid = obj.object.object; obj = await git.readObject({ fs: sh.fs, dir, oid }); }
  for (const step of suffix.match(/[~^]\d*/g) || []) {
    const n = step.length > 1 ? Number(step.slice(1)) : 1;
    const { commit } = await git.readCommit({ fs: sh.fs, dir, oid });
    if (step[0] === "^") {
      if (n === 0) continue;
      oid = commit.parent[n - 1];
      if (!oid) throw new GitError(`fatal: ambiguous argument '${rev}': unknown revision or path not in the working tree.`);
    } else {
      for (let k = 0; k < n; k++) {
        const c = k === 0 ? commit : (await git.readCommit({ fs: sh.fs, dir, oid })).commit;
        oid = c.parent[0];
        if (!oid) throw new GitError(`fatal: ambiguous argument '${rev}': unknown revision or path not in the working tree.`);
      }
    }
  }
  return oid;
}

// All files of a commit's tree: Map path -> blob oid.
async function treeFiles(sh, dir, commitOid) {
  const files = new Map();
  if (!commitOid) return files;
  const { commit } = await git.readCommit({ fs: sh.fs, dir, oid: commitOid });
  const walkTree = async (treeOid, prefix) => {
    const { tree } = await git.readTree({ fs: sh.fs, dir, oid: treeOid });
    for (const entry of tree) {
      const path = prefix + entry.path;
      if (entry.type === "tree") await walkTree(entry.oid, path + "/");
      else files.set(path, entry.oid);
    }
  };
  await walkTree(commit.tree, "");
  return files;
}

async function blobText(sh, dir, oid) {
  if (!oid) return "";
  const { blob } = await git.readBlob({ fs: sh.fs, dir, oid });
  return new TextDecoder().decode(blob);
}

async function headOid(sh, dir) {
  try { return await git.resolveRef({ fs: sh.fs, dir, ref: "HEAD" }); } catch { return null; }
}

async function indexFiles(sh, dir) {
  const files = new Map();
  await git.walk({
    fs: sh.fs, dir, trees: [git.STAGE()],
    map: async (path, [entry]) => {
      if (path === ".") return true;
      if (!entry) return null;
      if ((await entry.type()) === "blob") files.set(path, await entry.oid());
      return true;
    },
  });
  return files;
}

async function workFiles(sh, dir) {
  const files = new Map();
  for (const full of sh.fs.walkFiles(dir)) {
    const rel = full.slice(dir.length + 1);
    if (rel === ".git" || rel.startsWith(".git/")) continue;
    files.set(rel, sh.fs.text(full));
  }
  return files;
}

async function isIgnored(sh, dir, filepath) {
  return git.isIgnored({ fs: sh.fs, dir, filepath });
}

// Unified diff between two Maps of path -> text (null = absent), restricted to paths if given.
async function unifiedDiff(sh, dir, before, after, { paths = null, stat = false, nameOnly = false } = {}) {
  const all = [...new Set([...before.keys(), ...after.keys()])].sort();
  const chosen = paths && paths.length ? all.filter((p) => paths.some((q) => p === q || p.startsWith(q.replace(/\/$/, "") + "/") || q === ".")) : all;
  let out = "";
  const stats = [];
  for (const path of chosen) {
    const a = before.has(path) ? before.get(path) : null;
    const b = after.has(path) ? after.get(path) : null;
    if (a === b) continue;
    const ops = diffLines(splitLines(a ?? ""), splitLines(b ?? ""));
    const adds = ops.filter((o) => o[0] === "+").length, dels = ops.filter((o) => o[0] === "-").length;
    stats.push({ path, adds, dels, created: a === null, deleted: b === null });
    if (stat || nameOnly) continue;
    const oidA = a === null ? "0000000" : short(await git.hashBlob({ object: a }).then((r) => r.oid));
    const oidB = b === null ? "0000000" : short(await git.hashBlob({ object: b }).then((r) => r.oid));
    out += `diff --git a/${path} b/${path}\n`;
    if (a === null) out += `new file mode 100644\nindex ${oidA}..${oidB}\n`;
    else if (b === null) out += `deleted file mode 100644\nindex ${oidA}..${oidB}\n`;
    else out += `index ${oidA}..${oidB} 100644\n`;
    out += `--- ${a === null ? "/dev/null" : "a/" + path}\n+++ ${b === null ? "/dev/null" : "b/" + path}\n`;
    for (const h of hunks(ops)) {
      out += h.header + "\n" + h.lines.join("\n") + "\n";
      const lastIsA = a !== null && a !== "" && !a.endsWith("\n");
      const lastIsB = b !== null && b !== "" && !b.endsWith("\n");
      if (lastIsA || lastIsB) out += "\\ No newline at end of file\n";
    }
  }
  if (nameOnly) return stats.map((s) => s.path + "\n").join("");
  if (stat) return statText(stats);
  return out;
}

function statText(stats, summaryOnly = false) {
  if (!stats.length) return "";
  const width = Math.max(...stats.map((s) => s.path.length));
  const maxChange = Math.max(...stats.map((s) => s.adds + s.dels));
  const scale = maxChange > 50 ? 50 / maxChange : 1;
  let out = "";
  if (!summaryOnly) {
    for (const s of stats) {
      const n = s.adds + s.dels;
      const plus = Math.round(s.adds * scale), minus = Math.round(s.dels * scale);
      out += ` ${s.path.padEnd(width)} | ${String(n).padStart(String(maxChange).length)} ${"+".repeat(plus)}${"-".repeat(minus)}\n`;
    }
  }
  return out + summaryLine(stats);
}

function summaryLine(stats) {
  const files = stats.length, adds = stats.reduce((a, s) => a + s.adds, 0), dels = stats.reduce((a, s) => a + s.dels, 0);
  let line = ` ${files} file${files === 1 ? "" : "s"} changed`;
  if (adds || !dels) line += `, ${adds} insertion${adds === 1 ? "" : "s"}(+)`;
  if (dels) line += `, ${dels} deletion${dels === 1 ? "" : "s"}(-)`;
  return line + "\n";
}

async function filesAt(sh, dir, oid) {
  const map = new Map();
  for (const [path, blob] of await treeFiles(sh, dir, oid)) map.set(path, await blobText(sh, dir, blob));
  return map;
}
async function filesInIndex(sh, dir) {
  const map = new Map();
  for (const [path, blob] of await indexFiles(sh, dir)) map.set(path, await blobText(sh, dir, blob));
  return map;
}
async function filesInWorkdir(sh, dir, tracked) {
  const map = new Map();
  const work = await workFiles(sh, dir);
  for (const path of tracked) if (work.has(path)) map.set(path, work.get(path));
  return map;
}

// The decorations git log shows next to a commit: HEAD -> main, tag: v1, other branches.
async function decorations(sh, dir) {
  const map = new Map();
  const add = (oid, label) => { if (!map.has(oid)) map.set(oid, []); map.get(oid).push(label); };
  const current = await git.currentBranch({ fs: sh.fs, dir, fullname: false }).catch(() => undefined);
  const head = await headOid(sh, dir);
  if (head && !current) add(head, "HEAD");
  for (const b of await git.listBranches({ fs: sh.fs, dir })) {
    const oid = await git.resolveRef({ fs: sh.fs, dir, ref: b }).catch(() => null);
    if (oid) add(oid, b === current ? `HEAD -> ${b}` : b);
  }
  for (const remote of await git.listRemotes({ fs: sh.fs, dir }).catch(() => [])) {
    let remoteHead = null;
    for (const b of (await git.listBranches({ fs: sh.fs, dir, remote: remote.remote }).catch(() => [])).sort()) {
      const oid = await git.resolveRef({ fs: sh.fs, dir, ref: `refs/remotes/${remote.remote}/${b}` }).catch(() => null);
      if (!oid) continue;
      if (b === "HEAD") remoteHead = oid; else add(oid, `${remote.remote}/${b}`);
    }
    if (remoteHead) add(remoteHead, `${remote.remote}/HEAD`);
  }
  for (const t of await git.listTags({ fs: sh.fs, dir })) {
    let oid = await git.resolveRef({ fs: sh.fs, dir, ref: `refs/tags/${t}` }).catch(() => null);
    if (!oid) continue;
    const obj = await git.readObject({ fs: sh.fs, dir, oid });
    if (obj.type === "tag") oid = obj.object.object;
    add(oid, `tag: ${t}`);
  }
  for (const labels of map.values()) labels.sort((x, y) => rank(x) - rank(y));
  return map;
}
const rank = (label) => (label.startsWith("HEAD") ? 0 : label.startsWith("tag:") ? 3 : label.includes("/") ? 2 : 1);

// Every commit reachable from oid (including it).
async function ancestors(sh, dir, oid) {
  const seen = new Set();
  const stack = oid ? [oid] : [];
  while (stack.length) {
    const o = stack.pop();
    if (seen.has(o)) continue;
    seen.add(o);
    const { commit } = await git.readCommit({ fs: sh.fs, dir, oid: o });
    stack.push(...commit.parent);
  }
  return seen;
}

// The upstream a branch tracks ("origin/main"), from branch.<name>.remote and branch.<name>.merge.
async function upstreamOf(sh, dir, branch) {
  const remote = await git.getConfig({ fs: sh.fs, dir, path: `branch.${branch}.remote` }).catch(() => undefined);
  const merge = await git.getConfig({ fs: sh.fs, dir, path: `branch.${branch}.merge` }).catch(() => undefined);
  if (!remote || !merge) return null;
  const name = merge.replace(/^refs\/heads\//, "");
  const ref = remote === "." ? `refs/heads/${name}` : `refs/remotes/${remote}/${name}`;
  const oid = await git.resolveRef({ fs: sh.fs, dir, ref }).catch(() => null);
  return { remote, merge: name, short: remote === "." ? name : `${remote}/${name}`, ref, oid };
}

// How a branch compares with its upstream, worded like git status.
async function trackingInfo(sh, dir, branch) {
  const up = await upstreamOf(sh, dir, branch);
  if (!up) return null;
  if (!up.oid) {
    return { up, gone: true, ahead: 0, behind: 0, short: `[gone]`,
             long: `Your branch is based on '${up.short}', but the upstream is gone.\n  (use "git branch --unset-upstream" to fixup)\n` };
  }
  const local = await git.resolveRef({ fs: sh.fs, dir, ref: `refs/heads/${branch}` });
  const a = await ancestors(sh, dir, local), b = await ancestors(sh, dir, up.oid);
  const ahead = [...a].filter((o) => !b.has(o)).length, behind = [...b].filter((o) => !a.has(o)).length;
  const c = (n) => `${n} commit${n === 1 ? "" : "s"}`;
  let long;
  if (!ahead && !behind) long = `Your branch is up to date with '${up.short}'.\n`;
  else if (!behind) long = `Your branch is ahead of '${up.short}' by ${c(ahead)}.\n  (use "git push" to publish your local commits)\n`;
  else if (!ahead) long = `Your branch is behind '${up.short}' by ${c(behind)}, and can be fast-forwarded.\n  (use "git pull" to update your local branch)\n`;
  else long = `Your branch and '${up.short}' have diverged,\nand have ${ahead} and ${behind} different commits each, respectively.\n  (use "git pull" if you want to integrate the remote branch with yours)\n`;
  const parts = [ahead && `ahead ${ahead}`, behind && `behind ${behind}`].filter(Boolean);
  return { up, gone: false, ahead, behind, long, short: parts.length ? `[${parts.join(", ")}]` : "" };
}

async function statusInfo(sh, dir) {
  const head = await headOid(sh, dir);
  const headFiles = await treeFiles(sh, dir, head);
  const index = await indexFiles(sh, dir);
  const work = await workFiles(sh, dir);
  const staged = [], unstaged = [], untracked = [];
  for (const path of [...new Set([...headFiles.keys(), ...index.keys()])].sort()) {
    const h = headFiles.get(path), i = index.get(path);
    if (h === i) continue;
    staged.push({ path, kind: !h ? "new file" : !i ? "deleted" : "modified" });
  }
  for (const [path, oidI] of index) {
    if (!work.has(path)) { unstaged.push({ path, kind: "deleted" }); continue; }
    const { oid } = await git.hashBlob({ object: work.get(path) });
    if (oid !== oidI) unstaged.push({ path, kind: "modified" });
  }
  for (const path of work.keys()) {
    if (index.has(path)) continue;
    if (await isIgnored(sh, dir, path)) continue;
    untracked.push(path);
  }
  unstaged.sort((a, b) => a.path.localeCompare(b.path));
  return { head, staged, unstaged, untracked: untracked.sort(), index, headFiles };
}

// Show an untracked directory as "dir/" when everything in it is untracked, as git does.
function collapseUntracked(untracked, indexPaths) {
  const result = new Set();
  for (const path of untracked) {
    const parts = path.split("/");
    let shown = path;
    for (let k = 1; k < parts.length; k++) {
      const prefix = parts.slice(0, k).join("/") + "/";
      if (![...indexPaths].some((p) => p.startsWith(prefix))) { shown = prefix; break; }
    }
    result.add(shown);
  }
  return [...result].sort();
}

function parseOpts(args, spec) {
  // spec: { flag: "bool" | "value" }, aliases via "a|all"
  const opts = {}, rest = [];
  const lookup = new Map();
  for (const [names, type] of Object.entries(spec)) for (const n of names.split("|")) lookup.set(n, [names.split("|")[0], type]);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--") { rest.push(...args.slice(i + 1)); break; }
    const eq = a.startsWith("--") ? a.indexOf("=") : -1;
    const name = eq > 0 ? a.slice(0, eq) : a;
    if (lookup.has(name)) {
      const [key, type] = lookup.get(name);
      if (type === "bool") opts[key] = true;
      else if (type === "count") opts[key] = (opts[key] ?? 0) + 1;
      else if (type === "multi") { (opts[key] ??= []).push(eq > 0 ? a.slice(eq + 1) : args[++i]); }
      else opts[key] = eq > 0 ? a.slice(eq + 1) : args[++i];
    } else if (/^-\d+$/.test(a) && lookup.has("-n")) {
      opts[lookup.get("-n")[0]] = a.slice(1);
    } else if (/^-[a-zA-Z]{2,}$/.test(a) && [...a.slice(1)].every((c) => lookup.has("-" + c))
               && [...a.slice(1, -1)].every((c) => ["bool", "count"].includes(lookup.get("-" + c)[1]))) {
      // combined short options: git commit -am "message"
      for (const c of a.slice(1)) {
        const [key, type] = lookup.get("-" + c);
        if (type === "bool") opts[key] = true;
        else if (type === "count") opts[key] = (opts[key] ?? 0) + 1;
        else if (type === "multi") (opts[key] ??= []).push(args[++i]);
        else opts[key] = args[++i];
      }
    } else if (a.startsWith("-") && a !== "-") {
      throw new GitError(`error: unknown option \`${a.replace(/^-+/, "")}'`, 129);
    } else rest.push(a);
  }
  return { opts, rest };
}

const GIT_COMMANDS = {};

async function runGit(sh, args, io) {
  // global options: -C <dir> runs as if started there; -c key=value sets config for one command
  const savedCwd = sh.cwd, overrides = [];
  try {
    while (args[0] === "-C" || args[0] === "-c") {
      if (args[0] === "-C") {
        const target = sh.abs(args[1] ?? "");
        if (!sh.fs.isDir(target)) { io.err(`fatal: cannot change to '${args[1]}': No such file or directory\n`); return 128; }
        sh.cwd = target;
      } else {
        const [k, ...v] = (args[1] ?? "").split("=");
        (sh.configOverride ??= new Map());
        overrides.push([k, sh.configOverride.get(k)]);
        sh.configOverride.set(k, v.join("=") || "true");
      }
      args = args.slice(2);
    }
    return await runGitCommand(sh, args, io);
  } finally {
    sh.cwd = savedCwd;
    for (const [k, v] of overrides.reverse()) { if (v === undefined) sh.configOverride.delete(k); else sh.configOverride.set(k, v); }
  }
}

async function runGitCommand(sh, args, io) {
  const [sub, ...rest] = args;
  if (!sub || sub === "--help" || sub === "help") {
    io.out("usage: git <command> [<args>]\n\nCommands in this sandbox: " + Object.keys(GIT_COMMANDS).sort().join(", ") + "\n");
    return 0;
  }
  if (sub === "--version" || sub === "version") { io.out(`git version ${sh.gitVersion ?? "2.56.0"}${sh.runner ? "" : " (this sandbox runs git's commands on isomorphic-git)"}\n`); return 0; }
  const fn = GIT_COMMANDS[sub];
  if (!fn) {
    const real = "am apply archive bisect blame bundle cherry clean describe difftool fsck gc grep gui instaweb lfs maintenance mergetool notes prune range-diff reflog repack replace request-pull rerere shortlog sparse-checkout submodule worktree".split(" ");
    if (real.includes(sub)) {
      io.err(`git ${sub}: this command isn't available in the sandbox yet; try it on your own computer.\n`);
      return 1;
    }
    io.err(`git: '${sub}' is not a git command. See 'git --help'.\n`);
    return 1;
  }
  const needsRepo = !["init", "config", "clone"].includes(sub);
  const dir = await findRoot(sh);
  if (needsRepo && !dir) {
    io.err("fatal: not a git repository (or any of the parent directories): .git\n");
    return 128;
  }
  try {
    return (await fn(sh, dir, rest, io)) ?? 0;
  } catch (e) {
    if (e instanceof GitError) { io.err(e.message.endsWith("\n") ? e.message : e.message + "\n"); return e.status; }
    if (e && e.code === "NotFoundError") { io.err(`fatal: ${e.message}\n`); return 128; }
    throw e;
  }
}

function relPath(sh, dir, p) {
  const abs = sh.abs(p);
  if (abs === dir) return ".";
  if (!abs.startsWith(dir + "/")) throw new GitError(`fatal: ${p}: '${p}' is outside repository at '${dir}'`);
  return abs.slice(dir.length + 1);
}

// Expand pathspecs (files, directories, ".", globs) into repository paths that exist in the given set.
function matchPaths(spec, candidates) {
  if (spec === ".") return [...candidates];
  if (/[*?]/.test(spec)) {
    const re = new RegExp("^" + spec.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\//g, "(.*/)?").replace(/\*/g, "[^/]*").replace(/\?/g, ".") + "$");
    const base = new RegExp("(^|/)" + spec.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, ".") + "$");
    return [...candidates].filter((p) => re.test(p) || (!spec.includes("/") && base.test(p)));
  }
  const clean = spec.replace(/\/$/, "");
  return [...candidates].filter((p) => p === clean || p.startsWith(clean + "/"));
}

GIT_COMMANDS.init = async (sh, _dir, args, io) => {
  const { opts, rest } = parseOpts(args, { "-b|--initial-branch": "value", "-q|--quiet": "bool" });
  const target = sh.abs(rest[0] ?? ".");
  await sh.fs.mkdir(target, { recursive: true });
  const existed = sh.fs.isDir(target + "/.git");
  const branch = opts["-b"] ?? sh.globalConfig.get("init.defaultBranch") ?? "master";
  if (!existed) await git.init({ fs: sh.fs, dir: target, defaultBranch: branch });
  if (!opts["-q"]) io.out(`${existed ? "Reinitialized existing" : "Initialized empty"} Git repository in ${target}/.git/\n`);
  return 0;
};

GIT_COMMANDS.config = async (sh, dir, args, io) => {
  const { opts, rest } = parseOpts(args, { "--global": "bool", "--local": "bool", "--list|-l": "bool", "--unset": "bool", "--get": "bool" });
  if (opts["--list"]) {
    for (const [k, v] of sh.globalConfig) io.out(`${k}=${v}\n`);
    if (dir) {
      const text = sh.fs.text(dir + "/.git/config") ?? "";
      let section = "";
      for (const line of text.split("\n")) {
        const s = /^\[(\S+?)(?: "(.*)")?\]/.exec(line.trim());
        if (s) { section = s[2] ? `${s[1]}.${s[2]}` : s[1]; continue; }
        const kv = /^\s*(\w+)\s*=\s*(.*)$/.exec(line);
        if (kv) io.out(`${section}.${kv[1].toLowerCase()}=${kv[2]}\n`);
      }
    }
    return 0;
  }
  const [key, value] = rest;
  if (!key) throw new GitError("usage: git config [<options>]", 129);
  if (!/^[\w-]+(\.[\w-]+)+$/.test(key)) throw new GitError(`error: key does not contain a section: ${key}`, 2);
  const global = opts["--global"] || (!dir && !opts["--local"]);
  if (opts["--unset"]) {
    if (global) sh.globalConfig.delete(key); else await git.setConfig({ fs: sh.fs, dir, path: key, value: undefined });
    return 0;
  }
  if (value === undefined) {
    const v = global ? sh.globalConfig.get(key) : await getConfigValue(sh, dir, key);
    if (v === undefined) return 1;
    io.out(v + "\n");
    return 0;
  }
  if (global) sh.globalConfig.set(key, value);
  else {
    if (!dir) throw new GitError("fatal: --local can only be used inside a git repository");
    await git.setConfig({ fs: sh.fs, dir, path: key, value });
  }
  return 0;
};

GIT_COMMANDS.status = async (sh, dir, args, io) => {
  const { opts } = parseOpts(args, { "-s|--short": "bool", "-b|--branch": "bool" });
  const info = await statusInfo(sh, dir);
  const branch = await git.currentBranch({ fs: sh.fs, dir, fullname: false }).catch(() => undefined);
  const untracked = collapseUntracked(info.untracked, new Set(info.index.keys()));
  if (opts["-s"]) {
    if (opts["-b"]) {
      let line = info.head ? branch ?? "HEAD (no branch)" : `No commits yet on ${branch}`;
      const t = branch && info.head ? await trackingInfo(sh, dir, branch) : null;
      if (t) line += `...${t.up.short}${t.short ? " " + t.short : ""}`;
      io.out(`## ${line}\n`);
    }
    const codes = new Map();
    const letter = { "new file": "A", modified: "M", deleted: "D" };
    for (const s of info.staged) codes.set(s.path, [letter[s.kind], " "]);
    for (const u of info.unstaged) codes.set(u.path, [(codes.get(u.path) || [" "])[0], letter[u.kind]]);
    for (const p of conflictedPaths(sh, dir, info)) codes.set(p, ["U", "U"]);
    for (const [path, [x, y]] of [...codes].sort((a, b) => a[0].localeCompare(b[0]))) io.out(`${x}${y} ${path}\n`);
    for (const path of untracked) io.out(`?? ${path}\n`);
    return 0;
  }
  let out = branch ? `On branch ${branch}\n` : `HEAD detached at ${short(info.head)}\n`;
  const rebasing = sh.fs.exists(dir + "/.git/rebase-merge/head-name");
  if (rebasing) {
    const onto = sh.fs.text(dir + "/.git/rebase-merge/onto").trim();
    const headName = sh.fs.text(dir + "/.git/rebase-merge/head-name").trim().replace("refs/heads/", "");
    out = `interactive rebase in progress; onto ${short(onto)}\n`;
    const done = (sh.fs.text(dir + "/.git/rebase-merge/done") ?? "").split("\n").filter(Boolean);
    const todo = (sh.fs.text(dir + "/.git/rebase-merge/git-rebase-todo") ?? "").split("\n").filter(Boolean);
    if (!done.length) out += "No commands done.\n";
    else {
      out += done.length === 1 ? "Last command done (1 command done):\n" : `Last commands done (${done.length} commands done):\n`;
      for (const l of done.slice(-2)) out += `   ${l}\n`;
      if (done.length > 2) out += `  (see more in file .git/rebase-merge/done)\n`;
    }
    if (!todo.length) out += "No commands remaining.\n";
    else {
      out += todo.length === 1 ? "Next command to do (1 remaining command):\n" : `Next commands to do (${todo.length} remaining commands):\n`;
      for (const l of todo.slice(0, 2)) out += `   ${l}\n`;
      out += `  (use "git rebase --edit-todo" to view and edit)\n`;
    }
    out += `You are currently rebasing branch '${headName}' on '${short(onto)}'.\n`;
  }
  if (branch && info.head && !rebasing) {
    const t = await trackingInfo(sh, dir, branch);
    if (t) out += t.long + "\n";
  }
  const merging = sh.fs.exists(dir + "/.git/MERGE_HEAD");
  const picking = sh.fs.exists(dir + "/.git/CHERRY_PICK_HEAD");
  if (!info.head) out += "\nNo commits yet\n\n";
  const conflicts = conflictedPaths(sh, dir, info);
  if (rebasing) {
    out += conflicts.length ? "  (fix conflicts and then run \"git rebase --continue\")\n  (use \"git rebase --skip\" to skip this patch)\n  (use \"git rebase --abort\" to check out the original branch)\n\n"
      : "  (all conflicts fixed: run \"git rebase --continue\")\n\n";
  } else if (merging) {
    out += conflicts.length ? "You have unmerged paths.\n  (fix conflicts and run \"git commit\")\n  (use \"git merge --abort\" to abort the merge)\n\n"
      : "All conflicts fixed but you are still merging.\n  (use \"git commit\" to conclude merge)\n\n";
  } else if (picking) {
    const pick = short(sh.fs.text(dir + "/.git/CHERRY_PICK_HEAD").trim());
    out += `You are currently cherry-picking commit ${pick}.\n` + (conflicts.length
      ? "  (fix conflicts and run \"git cherry-pick --continue\")\n  (use \"git cherry-pick --skip\" to skip this patch)\n  (use \"git cherry-pick --abort\" to cancel the cherry-pick operation)\n\n"
      : "  (all conflicts fixed: run \"git cherry-pick --continue\")\n  (use \"git cherry-pick --skip\" to skip this patch)\n  (use \"git cherry-pick --abort\" to cancel the cherry-pick operation)\n\n");
  }
  const stagedNoConflict = info.staged.filter((s) => !conflicts.includes(s.path));
  if (stagedNoConflict.length) {
    out += "Changes to be committed:\n" + (merging || picking ? "" : `  (use "git ${info.head ? "restore --staged" : "rm --cached"} <file>..." to unstage)\n`);
    for (const s of stagedNoConflict) out += `\t${(s.kind + ":").padEnd(12)}${s.path}\n`;
    out += "\n";
  }
  if (conflicts.length) {
    out += "Unmerged paths:\n" + (merging || picking ? "" : `  (use "git restore --staged <file>..." to unstage)\n`) + `  (use "git add <file>..." to mark resolution)\n`;
    for (const p of conflicts) out += `\tboth modified:   ${p}\n`;
    out += "\n";
  }
  const unstagedNoConflict = info.unstaged.filter((u) => !conflicts.includes(u.path));
  if (unstagedNoConflict.length) {
    const anyDeleted = unstagedNoConflict.some((u) => u.kind === "deleted");
    out += `Changes not staged for commit:\n  (use "git ${anyDeleted ? "add/rm" : "add"} <file>..." to update what will be committed)\n  (use "git restore <file>..." to discard changes in working directory)\n`;
    for (const u of unstagedNoConflict) out += `\t${(u.kind + ":").padEnd(12)}${u.path}\n`;
    out += "\n";
  }
  if (untracked.length) {
    out += `Untracked files:\n  (use "git add <file>..." to include in what will be committed)\n`;
    for (const p of untracked) out += `\t${p}\n`;
    out += "\n";
  }
  if (conflicts.length && !unstagedNoConflict.length && !stagedNoConflict.length) out += `no changes added to commit (use "git add" and/or "git commit -a")\n`;
  if (!stagedNoConflict.length && !conflicts.length) {
    if (unstagedNoConflict.length) out += `no changes added to commit (use "git add" and/or "git commit -a")\n`;
    else if (untracked.length) out += `nothing added to commit but untracked files present (use "git add" to track)\n`;
    else if (!info.head) out += `nothing to commit (create/copy files and use "git add" to track)\n`;
    else out += `nothing to commit, working tree clean\n`;
  }
  io.out(out);
  return 0;
};

function conflictedPaths(sh, dir, info) {
  if (!["MERGE_HEAD", "CHERRY_PICK_HEAD", "REBASE_HEAD"].some((f) => sh.fs.exists(dir + "/.git/" + f))) return [];
  const result = [];
  for (const full of sh.fs.walkFiles(dir)) {
    const rel = full.slice(dir.length + 1);
    if (rel.startsWith(".git/")) continue;
    const text = sh.fs.text(full) ?? "";
    if (/^<<<<<<< /m.test(text) && /^>>>>>>> /m.test(text)) {
      const staged = info.index.get(rel);
      // a conflicted file stays "unmerged" until it's added without markers
      if (staged === undefined || sh.unmerged?.has(rel)) result.push(rel);
    }
  }
  for (const p of sh.unmerged ?? []) if (!result.includes(p)) result.push(p);
  return result.sort();
}

GIT_COMMANDS.add = async (sh, dir, args, io) => {
  const { opts, rest } = parseOpts(args, { "-A|--all": "bool", "-u|--update": "bool", "-f|--force": "bool", "-v|--verbose": "bool", "-n|--dry-run": "bool" });
  if (!rest.length && !opts["-A"] && !opts["-u"]) {
    io.err("Nothing specified, nothing added.\nhint: Maybe you wanted to say 'git add .'?\nhint: Disable this message with \"git config set advice.addEmptyPathspec false\"\n");
    return 0;
  }
  const specs = rest.length ? rest.map((p) => relPath(sh, dir, p)) : ["."];
  const info = await statusInfo(sh, dir);
  const work = await workFiles(sh, dir);
  const candidates = new Set([...work.keys(), ...info.index.keys()]);
  const ignoredHits = [];
  for (const spec of specs) {
    const matched = matchPaths(spec, candidates);
    if (!matched.length) {
      if (work.has(spec) || [...work.keys()].some((p) => p.startsWith(spec + "/"))) continue;
      throw new GitError(`fatal: pathspec '${rest[specs.indexOf(spec)] ?? spec}' did not match any files`);
    }
    for (const path of matched) {
      const inIndex = info.index.has(path);
      if (!work.has(path)) {
        if (inIndex) { await git.remove({ fs: sh.fs, dir, filepath: path }); if (opts["-v"]) io.out(`remove '${path}'\n`); }
        continue;
      }
      if (opts["-u"] && !inIndex) continue;
      if (!inIndex && !opts["-f"] && (await isIgnored(sh, dir, path))) {
        if (spec === path) ignoredHits.push(path);
        continue;
      }
      if (!opts["-n"]) await git.add({ fs: sh.fs, dir, filepath: path, force: !!opts["-f"] });
      if (opts["-v"] || opts["-n"]) io.out(`add '${path}'\n`);
      sh.unmerged?.delete(path);
    }
  }
  if (ignoredHits.length) {
    io.err(`The following paths are ignored by one of your .gitignore files:\n${ignoredHits.join("\n")}\nhint: Use -f if you really want to add them.\nhint: Disable this message with "git config set advice.addIgnoredFile false"\n`);
    return 1;
  }
  return 0;
};

GIT_COMMANDS.rm = async (sh, dir, args, io) => {
  const { opts, rest } = parseOpts(args, { "--cached": "bool", "-r": "bool", "-f|--force": "bool", "-q|--quiet": "bool" });
  if (!rest.length) throw new GitError("usage: git rm [<options>] [--] <file>...", 129);
  const index = await indexFiles(sh, dir);
  for (const p of rest) {
    const spec = relPath(sh, dir, p);
    const matched = matchPaths(spec, new Set(index.keys()));
    if (!matched.length) throw new GitError(`fatal: pathspec '${p}' did not match any files`);
    if (matched.some((m) => m !== spec) && !opts["-r"] && !/[*?]/.test(spec)) throw new GitError(`fatal: not removing '${p}' recursively without -r`);
    for (const path of matched) {
      await git.remove({ fs: sh.fs, dir, filepath: path });
      if (!opts["--cached"] && sh.fs.exists(dir + "/" + path)) await sh.fs.unlink(dir + "/" + path);
      if (!opts["-q"]) io.out(`rm '${path}'\n`);
    }
  }
  return 0;
};

GIT_COMMANDS.mv = async (sh, dir, args, io) => {
  if (args.length !== 2) throw new GitError("usage: git mv [<options>] <source>... <destination>", 129);
  const [from, to] = args.map((p) => relPath(sh, dir, p));
  const index = await indexFiles(sh, dir);
  if (!index.has(from)) throw new GitError(`fatal: not under version control, source=${from}, destination=${to}`);
  const dest = sh.fs.isDir(dir + "/" + to) ? `${to}/${from.split("/").pop()}` : to;
  await BUILTINS.mv(sh, [dir + "/" + from, dir + "/" + dest], io);
  await git.remove({ fs: sh.fs, dir, filepath: from });
  await git.add({ fs: sh.fs, dir, filepath: dest });
  return 0;
};

GIT_COMMANDS.commit = async (sh, dir, args, io) => {
  const { opts } = parseOpts(args, { "-m|--message": "multi", "-a|--all": "bool", "--amend": "bool", "--allow-empty": "bool", "--no-edit": "bool", "-q|--quiet": "bool" });
  const merging = sh.fs.exists(dir + "/.git/MERGE_HEAD");
  if (opts["-a"]) {
    const info = await statusInfo(sh, dir);
    for (const u of info.unstaged) {
      if (u.kind === "deleted") await git.remove({ fs: sh.fs, dir, filepath: u.path });
      else await git.add({ fs: sh.fs, dir, filepath: u.path });
      sh.unmerged?.delete(u.path);
    }
  }
  const info = await statusInfo(sh, dir);
  const conflicts = conflictedPaths(sh, dir, info);
  if (conflicts.length) {
    throw new GitError(`error: Committing is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use 'git add/rm <file>'\nhint: as appropriate to mark resolution and make a commit.\nfatal: Exiting because of an unresolved conflict.`);
  }
  let message = opts["-m"] ? opts["-m"].join("\n\n") : null;
  if (opts["--amend"] && message === null) {
    const prev = await git.readCommit({ fs: sh.fs, dir, oid: await resolveCommit(sh, dir, "HEAD") });
    message = prev.commit.message.replace(/\n$/, "");
  }
  if (merging && message === null) message = sh.fs.text(dir + "/.git/MERGE_MSG")?.replace(/\n$/, "") ?? "Merge";
  if (message === null) {
    throw new GitError(`error: this sandbox has no text editor, so write the message with -m:\n  git commit -m "Describe the change"`, 1);
  }
  if (!message.trim()) throw new GitError("Aborting commit due to empty commit message.", 1);
  const branch = await git.currentBranch({ fs: sh.fs, dir, fullname: false }).catch(() => undefined);
  if (!info.staged.length && !opts["--allow-empty"] && !opts["--amend"] && !merging) {
    const out = info.unstaged.length ? `no changes added to commit (use "git add" and/or "git commit -a")`
      : info.untracked.length ? `nothing added to commit but untracked files present (use "git add" to track)`
      : `nothing to commit, working tree clean`;
    io.out(`On branch ${branch}\n${out}\n`);
    return 1;
  }
  const author = await identity(sh, dir);
  const parentBefore = info.head;
  let oid;
  if (merging) {
    const mergeHead = sh.fs.text(dir + "/.git/MERGE_HEAD").trim();
    oid = await git.commit({ fs: sh.fs, dir, message, author, committer: author, parent: [info.head, mergeHead] });
    await sh.fs.unlink(dir + "/.git/MERGE_HEAD");
    if (sh.fs.exists(dir + "/.git/MERGE_MSG")) await sh.fs.unlink(dir + "/.git/MERGE_MSG");
    sh.unmerged = new Set();
  } else {
    oid = await git.commit({ fs: sh.fs, dir, message, author, committer: author, amend: !!opts["--amend"] });
  }
  if (opts["-q"]) return 0;
  const { commit } = await git.readCommit({ fs: sh.fs, dir, oid });
  const before = await treeFiles(sh, dir, commit.parent[0] ?? null);
  const after = await treeFiles(sh, dir, oid);
  const stats = [];
  for (const path of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    if (before.get(path) === after.get(path)) continue;
    const ops = diffLines(splitLines(await blobText(sh, dir, before.get(path))), splitLines(await blobText(sh, dir, after.get(path))));
    stats.push({ path, adds: ops.filter((o) => o[0] === "+").length, dels: ops.filter((o) => o[0] === "-").length, created: !before.has(path), deleted: !after.has(path) });
  }
  const root = !commit.parent.length ? " (root-commit)" : "";
  let out = `[${branch ?? "detached HEAD"}${root} ${short(oid)}] ${message.split("\n")[0]}\n`;
  if (commit.parent.length > 1) { io.out(out); return 0; }   // merge commits: just the header, like git
  if (opts["--amend"]) out += ` Date: ${gitDate(commit.author.timestamp)}\n`;
  out += stats.length ? summaryLine(stats) : " 0 files changed\n";
  for (const s of stats) {
    if (s.created) out += ` create mode 100644 ${s.path}\n`;
    if (s.deleted) out += ` delete mode 100644 ${s.path}\n`;
  }
  io.out(out);
  void parentBefore;
  return 0;
};

async function logCommits(sh, dir, start, { all = false, limit = Infinity, path = null } = {}) {
  // walk commits newest first (by date, then parents), like git log
  const starts = new Set();
  if (all) {
    for (const b of await git.listBranches({ fs: sh.fs, dir })) starts.add(await git.resolveRef({ fs: sh.fs, dir, ref: b }));
    for (const r of await git.listRemotes({ fs: sh.fs, dir }).catch(() => [])) {
      for (const b of await git.listBranches({ fs: sh.fs, dir, remote: r.remote }).catch(() => [])) {
        const oid = await git.resolveRef({ fs: sh.fs, dir, ref: `refs/remotes/${r.remote}/${b}` }).catch(() => null);
        if (oid) starts.add(oid);
      }
    }
    for (const t of await git.listTags({ fs: sh.fs, dir })) starts.add(await resolveCommit(sh, dir, t));
    const head = await headOid(sh, dir);
    if (head) starts.add(head);
  } else starts.add(start);
  const seen = new Set();
  const queue = [];
  const load = async (oid) => {
    if (seen.has(oid)) return;
    seen.add(oid);
    const { commit } = await git.readCommit({ fs: sh.fs, dir, oid });
    queue.push({ oid, commit });
  };
  for (const s of starts) await load(s);
  const out = [];
  while (queue.length && out.length < limit) {
    queue.sort((a, b) => b.commit.committer.timestamp - a.commit.committer.timestamp);
    const next = queue.shift();
    let include = true;
    if (path) {
      const mine = await treeFiles(sh, dir, next.oid);
      const parent = await treeFiles(sh, dir, next.commit.parent[0] ?? null);
      const matches = (m) => [...m.entries()].filter(([p]) => p === path || p.startsWith(path + "/")).map(([p, o]) => p + o).join();
      include = matches(mine) !== matches(parent);
    }
    if (include) out.push(next);
    for (const p of next.commit.parent) await load(p);
  }
  return out;
}

GIT_COMMANDS.log = async (sh, dir, args, io) => {
  const { opts, rest } = parseOpts(args, { "--oneline": "bool", "-n|--max-count": "value", "--all": "bool", "--graph": "bool", "--stat": "bool", "-p|--patch": "bool", "--decorate": "bool", "--format|--pretty": "value", "--reverse": "bool" });
  let rev = "HEAD", path = null, exclude = null;
  for (const r of rest) {
    if (r === "--") continue;
    if (sh.fs.exists(sh.abs(r)) && !(await resolveCommit(sh, dir, r).catch(() => null))) path = relPath(sh, dir, r);
    else rev = r;
  }
  const range = /^(.*?)\.\.(?!\.)(.*)$/.exec(rev);
  if (range) {
    exclude = await ancestors(sh, dir, await resolveCommit(sh, dir, range[1] || "HEAD"));
    rev = range[2] || "HEAD";
  }
  const head = await headOid(sh, dir);
  if (!head) {
    const branch = await git.currentBranch({ fs: sh.fs, dir, fullname: false }).catch(() => "main");
    throw new GitError(`fatal: your current branch '${branch}' does not have any commits yet`);
  }
  const start = await resolveCommit(sh, dir, rev);
  let commits = await logCommits(sh, dir, start, { all: opts["--all"], limit: opts["-n"] && !exclude ? Number(opts["-n"]) : Infinity, path });
  if (exclude) commits = commits.filter((c) => !exclude.has(c.oid)).slice(0, opts["-n"] ? Number(opts["-n"]) : Infinity);
  if (opts["--graph"]) commits = await topoOrder(sh, dir, commits);
  if (opts["--reverse"]) commits = commits.reverse();
  const deco = await decorations(sh, dir);
  const decoText = (oid, color = false) => (deco.has(oid) ? ` (${deco.get(oid).join(", ")})` : "");
  const graph = opts["--graph"] ? graphPrefixes(commits) : null;
  let out = "";
  for (const [k, { oid, commit }] of commits.entries()) {
    const g = graph ? graph[k] : null;
    const first = commit.message.split("\n")[0];
    if (opts["--format"]) {
      const f = opts["--format"].replace(/^format:|^tformat:/, "");
      const line = f.replace(/%H/g, oid).replace(/%h/g, short(oid)).replace(/%s/g, first).replace(/%an/g, commit.author.name)
        .replace(/%ae/g, commit.author.email).replace(/%ad/g, gitDate(commit.author.timestamp)).replace(/%d/g, decoText(oid)).replace(/%n/g, "\n");
      out += (g ? g.line : "") + line + "\n";
      continue;
    }
    const diffOf = async () => {
      const before = await filesAt(sh, dir, commit.parent[0] ?? null), after = await filesAt(sh, dir, oid);
      return unifiedDiff(sh, dir, before, after, { stat: !!opts["--stat"], paths: path ? [path] : null });
    };
    if (opts["--oneline"]) {
      out += `${g ? g.line : ""}${short(oid)}${decoText(oid)} ${first}\n`;
      if (opts["--stat"] || opts["-p"]) out += await diffOf();
    } else {
      const lead = g ? g.line : "", cont = g ? g.cont : "";
      out += `${lead}commit ${oid}${decoText(oid)}\n`;
      if (commit.parent.length > 1) out += `${cont}Merge: ${commit.parent.map(short).join(" ")}\n`;
      out += `${cont}Author: ${commit.author.name} <${commit.author.email}>\n${cont}Date:   ${gitDate(commit.author.timestamp, commit.author.timezoneOffset)}\n${cont}\n`;
      out += commit.message.replace(/\n$/, "").split("\n").map((l) => `${cont}    ${l}`).join("\n") + "\n";
      if (opts["--stat"] || opts["-p"]) {
        out += `${cont}\n` + (await diffOf());
      }
      if (k < commits.length - 1) out += `${cont}\n`;
    }
  }
  io.out(out);
  return 0;
};

// A text graph for git log --graph: one column per line of history, like git's (simplified for small histories).
function graphPrefixes(commits) {
  let columns = [];
  const rows = [];
  const render = (cells) => cells.join("").replace(/\s+$/, "");
  for (const { oid, commit } of commits) {
    let col = columns.indexOf(oid);
    if (col === -1) { columns.push(oid); col = columns.length - 1; }
    const parents = commit.parent;
    let next = columns.slice();
    const added = [];
    if (!parents.length) next.splice(col, 1);
    else {
      next[col] = parents[0];
      let at = col + 1;
      for (const p of parents.slice(1)) if (!next.includes(p)) { next.splice(at++, 0, p); added.push(p); }
    }
    // the commit's own row
    const cells = columns.map((c, i) => (i === col ? "* " : "| "));
    for (let k = 0; k < added.length; k++) cells.push("  ");
    const line = cells.join("");
    const after = [];
    if (added.length) {
      // |\ : a new line of history starts at the merge
      const chars = [];
      next.forEach((c, i) => { chars[2 * i] = i <= col ? "|" : " "; });
      for (let i = col + 1; i < next.length; i++) chars[2 * i - 1] = "\\";
      for (let i = 0; i < chars.length; i++) if (chars[i] === undefined) chars[i] = " ";
      after.push(render(chars));
    }
    // two lines reaching the same parent join: |/
    for (;;) {
      const dup = next.findIndex((c, i) => c !== null && next.indexOf(c) !== i);
      if (dup === -1) break;
      const chars = [];
      next.forEach((c, i) => {
        if (i < dup) chars[2 * i] = "|";
        else if (i === dup) chars[2 * i - 1] = "/";
        else chars[2 * i - 1] = "/";
      });
      for (let i = 0; i < chars.length; i++) if (chars[i] === undefined) chars[i] = " ";
      after.push(render(chars));
      next.splice(dup, 1);
    }
    columns = next;
    rows.push({ line, after, cont: columns.length ? columns.map(() => "| ").join("") : "  " });
  }
  return rows.map((r, i) => ({ line: (i > 0 && rows[i - 1].after.length ? rows[i - 1].after.join("\n") + "\n" : "") + r.line, cont: r.cont }));
}

// git log --graph lists commits in topological order: a commit only after all its children, keeping
// each line of history together (the most recently merged branch first).
async function topoOrder(sh, dir, commits) {
  const byOid = new Map(commits.map((c) => [c.oid, c]));
  const children = new Map(commits.map((c) => [c.oid, 0]));
  for (const c of commits) for (const p of c.commit.parent) if (children.has(p)) children.set(p, children.get(p) + 1);
  const stack = commits.filter((c) => children.get(c.oid) === 0).sort((a, b) => a.commit.committer.timestamp - b.commit.committer.timestamp);
  const out = [];
  while (stack.length) {
    const c = stack.pop();
    out.push(c);
    for (const p of c.commit.parent) {
      if (!children.has(p)) continue;
      children.set(p, children.get(p) - 1);
      if (children.get(p) === 0) stack.push(byOid.get(p));
    }
  }
  return out;
}

GIT_COMMANDS.diff = async (sh, dir, args, io) => {
  const { opts, rest } = parseOpts(args, { "--staged|--cached": "bool", "--stat": "bool", "--name-only": "bool" });
  const revs = [], paths = [];
  let sawDashes = false;
  for (const r of rest) {
    if (r === "--") { sawDashes = true; continue; }
    if (!sawDashes && (await resolveCommit(sh, dir, r).catch(() => null))) revs.push(r);
    else paths.push(relPath(sh, dir, r));
  }
  const fmt = { paths, stat: !!opts["--stat"], nameOnly: !!opts["--name-only"] };
  let before, after;
  if (revs.length === 2 || (revs.length === 1 && revs[0].includes(".."))) {
    const [a, b] = revs.length === 2 ? revs : revs[0].split("..");
    before = await filesAt(sh, dir, await resolveCommit(sh, dir, a || "HEAD"));
    after = await filesAt(sh, dir, await resolveCommit(sh, dir, b || "HEAD"));
  } else if (revs.length === 1) {
    before = await filesAt(sh, dir, await resolveCommit(sh, dir, revs[0]));
    after = opts["--staged"] ? await filesInIndex(sh, dir) : await filesInWorkdir(sh, dir, new Set([...before.keys(), ...(await indexFiles(sh, dir)).keys()]));
  } else if (opts["--staged"]) {
    before = await filesAt(sh, dir, await headOid(sh, dir));
    after = await filesInIndex(sh, dir);
  } else {
    before = await filesInIndex(sh, dir);
    after = await filesInWorkdir(sh, dir, new Set(before.keys()));
  }
  io.out(await unifiedDiff(sh, dir, before, after, fmt));
  return 0;
};

GIT_COMMANDS.show = async (sh, dir, args, io) => {
  const { opts, rest } = parseOpts(args, { "--stat": "bool", "--oneline": "bool", "--name-only": "bool" });
  const spec = rest[0] ?? "HEAD";
  const colon = spec.indexOf(":");
  if (colon > 0) {
    const oid = await resolveCommit(sh, dir, spec.slice(0, colon));
    const files = await treeFiles(sh, dir, oid);
    const path = spec.slice(colon + 1);
    if (!files.has(path)) throw new GitError(`fatal: path '${path}' does not exist in '${spec.slice(0, colon)}'`);
    io.out(await blobText(sh, dir, files.get(path)));
    return 0;
  }
  const oid = await resolveCommit(sh, dir, spec);
  const { commit } = await git.readCommit({ fs: sh.fs, dir, oid });
  const deco = await decorations(sh, dir);
  const d = deco.has(oid) ? ` (${deco.get(oid).join(", ")})` : "";
  let out;
  if (opts["--oneline"]) out = `${short(oid)}${d} ${commit.message.split("\n")[0]}\n`;
  else {
    out = `commit ${oid}${d}\n`;
    if (commit.parent.length > 1) out += `Merge: ${commit.parent.map(short).join(" ")}\n`;
    out += `Author: ${commit.author.name} <${commit.author.email}>\nDate:   ${gitDate(commit.author.timestamp)}\n\n` +
      commit.message.replace(/\n$/, "").split("\n").map((l) => "    " + l).join("\n") + "\n";
  }
  if (commit.parent.length > 1) { io.out(out); return 0; }
  const before = await filesAt(sh, dir, commit.parent[0] ?? null), after = await filesAt(sh, dir, oid);
  const body = await unifiedDiff(sh, dir, before, after, { stat: !!opts["--stat"], nameOnly: !!opts["--name-only"] });
  io.out(out + (body ? (opts["--oneline"] ? "" : "\n") + body : ""));
  return 0;
};

GIT_COMMANDS.restore = async (sh, dir, args, io) => {
  const { opts, rest } = parseOpts(args, { "-S|--staged": "bool", "-W|--worktree": "bool", "-s|--source": "value" });
  if (!rest.length) throw new GitError("fatal: you must specify path(s) to restore");
  const head = await headOid(sh, dir);
  const source = opts["-s"] ? await resolveCommit(sh, dir, opts["-s"]) : null;
  const index = await indexFiles(sh, dir);
  const headFiles = await treeFiles(sh, dir, head);
  const sourceFiles = source ? await treeFiles(sh, dir, source) : null;
  const work = await workFiles(sh, dir);
  for (const p of rest) {
    const spec = relPath(sh, dir, p);
    const candidates = new Set([...index.keys(), ...headFiles.keys(), ...(sourceFiles ? sourceFiles.keys() : [])]);
    const matched = matchPaths(spec, candidates);
    if (!matched.length) throw new GitError(`error: pathspec '${p}' did not match any file(s) known to git`, 1);
    for (const path of matched) {
      if (opts["-S"]) {
        // put the HEAD (or source) version back in the index
        const from = sourceFiles ?? headFiles;
        if (from.has(path)) await git.resetIndex({ fs: sh.fs, dir, filepath: path, ref: source ?? "HEAD" });
        else await git.remove({ fs: sh.fs, dir, filepath: path });
        if (opts["-W"]) await writeWork(sh, dir, path, from.has(path) ? await blobText(sh, dir, from.get(path)) : null);
      } else {
        const from = sourceFiles ?? index;
        if (!from.has(path)) { if (work.has(path) && !sourceFiles) continue; await writeWork(sh, dir, path, null); continue; }
        await writeWork(sh, dir, path, await blobText(sh, dir, from.get(path)));
      }
    }
  }
  return 0;
};

async function writeWork(sh, dir, path, text) {
  const full = dir + "/" + path;
  if (text === null) { if (sh.fs.exists(full)) await sh.fs.unlink(full); return; }
  await sh.fs.mkdir(sh.fs.parent(full), { recursive: true });
  await sh.fs.writeFile(full, text);
}

GIT_COMMANDS.reset = async (sh, dir, args, io) => {
  const { opts, rest } = parseOpts(args, { "--soft": "bool", "--mixed": "bool", "--hard": "bool", "-q|--quiet": "bool" });
  const head = await headOid(sh, dir);
  let target = "HEAD", paths = [];
  for (const r of rest) {
    if (r === "--") continue;
    if (await resolveCommit(sh, dir, r).catch(() => null)) target = r; else paths.push(r);
  }
  if (paths.length) {
    for (const p of paths) {
      const path = relPath(sh, dir, p);
      const headFiles = await treeFiles(sh, dir, head);
      if (headFiles.has(path)) await git.resetIndex({ fs: sh.fs, dir, filepath: path });
      else await git.remove({ fs: sh.fs, dir, filepath: path });
    }
    const info = await statusInfo(sh, dir);
    if (info.unstaged.length && !opts["-q"]) io.out("Unstaged changes after reset:\n" + info.unstaged.map((u) => `${u.kind === "deleted" ? "D" : "M"}\t${u.path}\n`).join(""));
    return 0;
  }
  const oid = await resolveCommit(sh, dir, target);
  const branch = await git.currentBranch({ fs: sh.fs, dir, fullname: true }).catch(() => undefined);
  await git.writeRef({ fs: sh.fs, dir, ref: branch ?? "HEAD", value: oid, force: true });
  if (opts["--soft"]) return 0;
  for (const f of [".git/MERGE_HEAD", ".git/MERGE_MSG", ".git/CHERRY_PICK_HEAD"]) if (sh.fs.exists(dir + "/" + f)) await sh.fs.unlink(dir + "/" + f);
  sh.unmerged = new Set();
  // mixed: index = target tree; hard: also the working tree
  const targetFiles = await treeFiles(sh, dir, oid);
  const index = await indexFiles(sh, dir);
  for (const path of index.keys()) if (!targetFiles.has(path)) {
    await git.remove({ fs: sh.fs, dir, filepath: path });
    if (opts["--hard"] && sh.fs.exists(dir + "/" + path)) await sh.fs.unlink(dir + "/" + path);
  }
  for (const [path] of targetFiles) {
    await git.resetIndex({ fs: sh.fs, dir, filepath: path, ref: oid });
    if (opts["--hard"]) await writeWork(sh, dir, path, await blobText(sh, dir, targetFiles.get(path)));
  }
  if (opts["--hard"]) {
    for (const f of [".git/MERGE_HEAD", ".git/MERGE_MSG"]) if (sh.fs.exists(dir + "/" + f)) await sh.fs.unlink(dir + "/" + f);
    sh.unmerged = new Set();
    const { commit } = await git.readCommit({ fs: sh.fs, dir, oid });
    if (!opts["-q"]) io.out(`HEAD is now at ${short(oid)} ${commit.message.split("\n")[0]}\n`);
  } else if (!opts["-q"]) {
    const info = await statusInfo(sh, dir);
    if (info.unstaged.length) io.out("Unstaged changes after reset:\n" + info.unstaged.map((u) => `${u.kind === "deleted" ? "D" : "M"}\t${u.path}\n`).join(""));
  }
  void head;
  return 0;
};

GIT_COMMANDS.revert = async (sh, dir, args, io) => {
  const { opts, rest } = parseOpts(args, { "--no-edit": "bool", "-n|--no-commit": "bool" });
  if (!rest.length) throw new GitError("usage: git revert [<options>] <commit-ish>...", 129);
  const info = await statusInfo(sh, dir);
  if (info.staged.length || info.unstaged.length) {
    throw new GitError("error: your local changes would be overwritten by revert.\nhint: commit your changes or stash them to proceed.\nfatal: revert failed");
  }
  const oid = await resolveCommit(sh, dir, rest[0]);
  const { commit } = await git.readCommit({ fs: sh.fs, dir, oid });
  if (commit.parent.length > 1) throw new GitError(`error: commit ${oid} is a merge but no -m option was given.\nfatal: revert failed`);
  const before = await treeFiles(sh, dir, commit.parent[0] ?? null);
  const after = await treeFiles(sh, dir, oid);
  const current = await treeFiles(sh, dir, info.head);
  const changes = [];
  for (const path of new Set([...before.keys(), ...after.keys()])) {
    if (before.get(path) === after.get(path)) continue;
    if (current.get(path) !== after.get(path)) {
      // the file changed again later: try a line-level undo when the commit's change is still intact
      const cur = await blobText(sh, dir, current.get(path)), aft = await blobText(sh, dir, after.get(path)), bef = await blobText(sh, dir, before.get(path));
      const undone = undoChange(bef, aft, cur);
      if (undone === null) {
        throw new GitError(`error: could not revert ${short(oid)}... ${commit.message.split("\n")[0]}\nhint: The change in ${path} was changed again by a later commit, so it can't be undone automatically.\nhint: Edit the file yourself and commit, or revert the later commit first.`, 1);
      }
      changes.push([path, undone]);
    } else changes.push([path, before.has(path) ? await blobText(sh, dir, before.get(path)) : null]);
  }
  for (const [path, text] of changes) {
    await writeWork(sh, dir, path, text);
    if (text === null) await git.remove({ fs: sh.fs, dir, filepath: path });
    else await git.add({ fs: sh.fs, dir, filepath: path });
  }
  if (opts["-n"]) return 0;
  const first = commit.message.split("\n")[0];
  return GIT_COMMANDS.commit(sh, dir, ["-m", `Revert "${first}"\n\nThis reverts commit ${oid}.`], io);
};

// Undo one change (before -> after) inside current, if the changed lines are still there unchanged.
function undoChange(before, after, current) {
  const ops = diffLines(splitLines(before), splitLines(after));
  const cur = splitLines(current), aft = splitLines(after);
  const map = diffLines(aft, cur);
  if (map.some(([k]) => k !== " ") && ops.every(([k]) => k === " ")) return null;
  // simple approach: if current = after with extra lines only added/removed elsewhere, apply reverse hunks by text search
  let text = cur.join("\n");
  const removed = ops.filter(([k]) => k === "-").map(([, l]) => l), added = ops.filter(([k]) => k === "+").map(([, l]) => l);
  const addedBlock = added.join("\n"), removedBlock = removed.join("\n");
  if (added.length && text.split(addedBlock).length === 2) text = text.replace(addedBlock, removedBlock);
  else if (!added.length) return null;
  else return null;
  return text.split("\n").filter((l, i, all) => !(l === "" && removed.length === 0 && i === all.length)).join("\n") + (current.endsWith("\n") ? "\n" : "");
}

GIT_COMMANDS["ls-files"] = async (sh, dir, args, io) => {
  const index = await indexFiles(sh, dir);
  io.out([...index.keys()].sort().map((p) => p + "\n").join(""));
  return 0;
};

GIT_COMMANDS["rev-parse"] = async (sh, dir, args, io) => {
  const { opts, rest } = parseOpts(args, { "--short": "bool", "--abbrev-ref": "bool", "--show-toplevel": "bool" });
  if (opts["--show-toplevel"]) { io.out(dir + "\n"); return 0; }
  for (const r of rest) {
    if (opts["--abbrev-ref"] && r === "HEAD") { io.out((await git.currentBranch({ fs: sh.fs, dir, fullname: false })) + "\n"); continue; }
    let oid;
    const colon = r.indexOf(":");
    if (colon > 0) {
      const files = await treeFiles(sh, dir, await resolveCommit(sh, dir, r.slice(0, colon)));
      oid = files.get(r.slice(colon + 1));
      if (!oid) throw new GitError(`fatal: path '${r.slice(colon + 1)}' does not exist in '${r.slice(0, colon)}'`);
    } else if (r.endsWith("^{tree}")) {
      oid = (await git.readCommit({ fs: sh.fs, dir, oid: await resolveCommit(sh, dir, r.slice(0, -7)) })).commit.tree;
    } else oid = await resolveCommit(sh, dir, r);
    io.out((opts["--short"] ? short(oid) : oid) + "\n");
  }
  return 0;
};

GIT_COMMANDS["cat-file"] = async (sh, dir, args, io) => {
  const { opts, rest } = parseOpts(args, { "-p": "bool", "-t": "bool", "-s": "bool" });
  const spec = rest[0];
  if (!spec) throw new GitError("usage: git cat-file (-t | -s | -p) <object>", 129);
  let oid;
  const colon = spec.indexOf(":");
  if (spec.endsWith("^{tree}")) {
    const { commit } = await git.readCommit({ fs: sh.fs, dir, oid: await resolveCommit(sh, dir, spec.slice(0, -7)) });
    oid = commit.tree;
  } else if (colon > 0) {
    const files = await treeFiles(sh, dir, await resolveCommit(sh, dir, spec.slice(0, colon)));
    oid = files.get(spec.slice(colon + 1));
    if (!oid) throw new GitError(`fatal: path '${spec.slice(colon + 1)}' does not exist in '${spec.slice(0, colon)}'`);
  } else if (/^[0-9a-f]{4,40}$/.test(spec)) {
    oid = await git.expandOid({ fs: sh.fs, dir, oid: spec }).catch(() => null);
    if (!oid) oid = await resolveCommit(sh, dir, spec);
  } else {
    const resolved = await git.resolveRef({ fs: sh.fs, dir, ref: spec.replace(/[~^].*$/, "") }).catch(() => null);
    oid = /[~^]/.test(spec) || !resolved ? await resolveCommit(sh, dir, spec) : resolved;
  }
  const obj = await git.readObject({ fs: sh.fs, dir, oid, format: "content" });
  const raw = new TextDecoder().decode(obj.object);
  if (opts["-t"]) { io.out(obj.type + "\n"); return 0; }
  if (opts["-s"]) { io.out(obj.object.length + "\n"); return 0; }
  if (obj.type === "tree") {
    const { tree } = await git.readTree({ fs: sh.fs, dir, oid });
    io.out(tree.map((e) => `${e.mode.padStart(6, "0")} ${e.type} ${e.oid}\t${e.path}\n`).join(""));
  } else io.out(raw);
  return 0;
};

GIT_COMMANDS["check-ignore"] = async (sh, dir, args, io) => {
  const { opts, rest } = parseOpts(args, { "-v|--verbose": "bool" });
  let any = false;
  for (const p of rest) {
    const path = relPath(sh, dir, p);
    if (await isIgnored(sh, dir, path)) {
      any = true;
      if (opts["-v"]) {
        const text = sh.fs.text(dir + "/.gitignore") ?? "";
        const lines = text.split("\n");
        let hit = 0;
        lines.forEach((line, i) => { if (line.trim() && !line.startsWith("#") && ignoreMatches(line.trim(), path)) hit = i + 1; });
        io.out(`.gitignore:${hit}:${hit ? lines[hit - 1].trim() : ""}\t${p}\n`);
      } else io.out(p + "\n");
    }
  }
  return any ? 0 : 1;
};

function ignoreMatches(pattern, path) {
  if (pattern.startsWith("!")) return false;
  const dirOnly = pattern.endsWith("/");
  let p = pattern.replace(/\/$/, "");
  const anchored = p.startsWith("/") || p.slice(0, -1).includes("/");
  p = p.replace(/^\//, "");
  const re = p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\//g, "(?:.*/)?").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]");
  const full = new RegExp(anchored ? `^${re}(/.*)?$` : `(^|/)${re}(/.*)?$`);
  if (!full.test(path)) return false;
  if (dirOnly) return new RegExp(anchored ? `^${re}/` : `(^|/)${re}/`).test(path);
  return true;
}

GIT_COMMANDS.branch = async (sh, dir, args, io) => {
  const { opts, rest } = parseOpts(args, { "-d|--delete": "bool", "-D": "bool", "-m|--move": "bool", "-a|--all": "bool", "-v|--verbose": "count",
    "-r|--remotes": "bool", "--show-current": "bool", "-u|--set-upstream-to": "value", "--unset-upstream": "bool", "-f|--force": "bool" });
  const current = await git.currentBranch({ fs: sh.fs, dir, fullname: false }).catch(() => undefined);
  if (opts["--show-current"]) { if (current) io.out(current + "\n"); return 0; }
  if (opts["-u"]) {
    const name = rest[0] ?? current;
    const target = opts["-u"];
    const m = /^([^/]+)\/(.+)$/.exec(target);
    const remotes = (await git.listRemotes({ fs: sh.fs, dir }).catch(() => [])).map((r) => r.remote);
    if (!m || !remotes.includes(m[1]) || !(await git.resolveRef({ fs: sh.fs, dir, ref: `refs/remotes/${target}` }).catch(() => null))) {
      throw new GitError(`fatal: the requested upstream branch '${target}' does not exist\nhint:\nhint: If you are planning on basing your work on an upstream\nhint: branch that already exists at the remote, you may need to\nhint: run "git fetch" to retrieve it.\nhint:\nhint: If you are planning to push out a new local branch that\nhint: will track its remote counterpart, you may want to use\nhint: "git push -u" to set the upstream config as you push.\nhint: Disable this message with "git config set advice.setUpstreamFailure false"`);
    }
    await git.setConfig({ fs: sh.fs, dir, path: `branch.${name}.remote`, value: m[1] });
    await git.setConfig({ fs: sh.fs, dir, path: `branch.${name}.merge`, value: `refs/heads/${m[2]}` });
    io.out(`branch '${name}' set up to track '${target}'.\n`);
    return 0;
  }
  if (opts["--unset-upstream"]) {
    const name = rest[0] ?? current;
    if (!(await upstreamOf(sh, dir, name))) throw new GitError(`fatal: branch '${name}' has no upstream information`);
    await git.setConfig({ fs: sh.fs, dir, path: `branch.${name}.remote`, value: undefined });
    await git.setConfig({ fs: sh.fs, dir, path: `branch.${name}.merge`, value: undefined });
    return 0;
  }
  if (opts["-d"] || opts["-D"]) {
    if (opts["-r"]) {
      for (const name of rest) {
        const oid = await git.resolveRef({ fs: sh.fs, dir, ref: `refs/remotes/${name}` }).catch(() => null);
        if (!oid) throw new GitError(`error: remote-tracking branch '${name}' not found`, 1);
        await git.deleteRef({ fs: sh.fs, dir, ref: `refs/remotes/${name}` });
        io.out(`Deleted remote-tracking branch ${name} (was ${short(oid)}).\n`);
      }
      return 0;
    }
    let status = 0;
    for (const name of rest) {
      if (name === current) { io.err(`error: cannot delete branch '${name}' used by worktree at '${dir}'\n`); status = 1; continue; }
      const oid = await git.resolveRef({ fs: sh.fs, dir, ref: `refs/heads/${name}` }).catch(() => null);
      if (!oid) { io.err(`error: branch '${name}' not found\n`); status = 1; continue; }
      if (!opts["-D"] && !opts["-f"]) {
        // merged into its upstream if it has one, otherwise into HEAD
        const up = await upstreamOf(sh, dir, name);
        const head = await headOid(sh, dir);
        const into = async (target) => !!target && (oid === target || (await ancestors(sh, dir, target)).has(oid));
        const inHead = await into(head);
        if (up && up.oid) {
          if (!(await into(up.oid))) {
            io.err(`error: the branch '${name}' is not fully merged\nhint: If you are sure you want to delete it, run 'git branch -D ${name}'\nhint: Disable this message with "git config set advice.forceDeleteBranch false"\n`);
            status = 1; continue;
          }
          if (!inHead) io.err(`warning: deleting branch '${name}' that has been merged to\n         '${up.ref}', but not yet merged to HEAD\n`);
        } else if (!inHead) {
          io.err(`error: the branch '${name}' is not fully merged\nhint: If you are sure you want to delete it, run 'git branch -D ${name}'\nhint: Disable this message with "git config set advice.forceDeleteBranch false"\n`);
          status = 1; continue;
        }
      }
      await git.deleteBranch({ fs: sh.fs, dir, ref: name });
      for (const k of ["remote", "merge"]) await git.setConfig({ fs: sh.fs, dir, path: `branch.${name}.${k}`, value: undefined }).catch(() => {});
      io.out(`Deleted branch ${name} (was ${short(oid)}).\n`);
    }
    return status;
  }
  if (opts["-m"]) {
    const [a, b] = rest.length === 2 ? rest : [current, rest[0]];
    await git.renameBranch({ fs: sh.fs, dir, oldref: a, ref: b, checkout: a === current });
    return 0;
  }
  if (rest.length) {
    const [name, start] = rest;
    if (!(await headOid(sh, dir)) && !start) throw new GitError(`fatal: not a valid object name: '${current}'`);
    if (await git.resolveRef({ fs: sh.fs, dir, ref: `refs/heads/${name}` }).catch(() => null)) {
      if (!opts["-f"]) throw new GitError(`fatal: a branch named '${name}' already exists`);
      if (name === current) throw new GitError(`fatal: cannot force update the branch '${name}' used by worktree at '${dir}'`);
      await git.writeRef({ fs: sh.fs, dir, ref: `refs/heads/${name}`, value: await resolveCommit(sh, dir, start ?? "HEAD"), force: true });
      return 0;
    }
    if (!isValidBranch(name)) throw new GitError(`fatal: '${name}' is not a valid branch name`);
    const oid = await resolveCommit(sh, dir, start ?? "HEAD");
    await git.writeRef({ fs: sh.fs, dir, ref: `refs/heads/${name}`, value: oid });
    // starting from a remote-tracking branch sets up tracking, like git's branch.autoSetupMerge
    const m = start && /^([^/]+)\/(.+)$/.exec(start);
    if (m && (await git.resolveRef({ fs: sh.fs, dir, ref: `refs/remotes/${start}` }).catch(() => null))) {
      await git.setConfig({ fs: sh.fs, dir, path: `branch.${name}.remote`, value: m[1] });
      await git.setConfig({ fs: sh.fs, dir, path: `branch.${name}.merge`, value: `refs/heads/${m[2]}` });
      io.out(`branch '${name}' set up to track '${start}'.\n`);
    }
    return 0;
  }
  const names = (await git.listBranches({ fs: sh.fs, dir })).sort();
  const head = await headOid(sh, dir);
  const verbose = opts["-v"] ? Number(opts["-v"]) : 0;
  const rows = [];   // [marker, name, oid, symref]
  if (!current && head) rows.push(["*", `(HEAD detached at ${short(head)})`, head]);
  if (!opts["-r"]) for (const n of names) rows.push([n === current ? "*" : " ", n, await git.resolveRef({ fs: sh.fs, dir, ref: `refs/heads/${n}` }), null, true]);
  if (opts["-a"] || opts["-r"]) {
    for (const r of await git.listRemotes({ fs: sh.fs, dir }).catch(() => [])) {
      for (const b of (await git.listBranches({ fs: sh.fs, dir, remote: r.remote }).catch(() => [])).sort()) {
        const label = `${opts["-a"] ? "remotes/" : ""}${r.remote}/${b}`;
        if (b === "HEAD") {
          const target = await git.resolveRef({ fs: sh.fs, dir, ref: `refs/remotes/${r.remote}/HEAD`, depth: 2 }).catch(() => null);
          if (target) rows.push([" ", label, null, target.replace(/^refs\/remotes\//, "")]);
          continue;
        }
        rows.push([" ", label, await git.resolveRef({ fs: sh.fs, dir, ref: `refs/remotes/${r.remote}/${b}` })]);
      }
    }
  }
  const width = Math.max(0, ...rows.filter((r) => !r[3]).map((r) => r[1].length));
  let out = "";
  for (const [mark, name, oid, symref, local] of rows) {
    if (symref) { out += `${mark} ${name} -> ${symref}\n`; continue; }
    if (!verbose) { out += `${mark} ${name}\n`; continue; }
    const { commit } = await git.readCommit({ fs: sh.fs, dir, oid });
    let track = "";
    if (local) {
      const t = await trackingInfo(sh, dir, name);
      if (t && verbose >= 2) track = `[${t.up.short}${t.gone ? ": gone" : t.short ? ": " + t.short.slice(1, -1) : ""}] `;
      else if (t && (t.short || t.gone)) track = `[${t.gone ? "gone" : t.short.slice(1, -1)}] `;
    }
    out += `${mark} ${name.padEnd(width)} ${short(oid)} ${track}${commit.message.split("\n")[0]}\n`;
  }
  io.out(out);
  return 0;
};

function isValidBranch(name) {
  return /^[^\s~^:?*[\\]+$/.test(name) && !name.startsWith("-") && !name.endsWith("/") && !name.endsWith(".lock") && !name.includes("..") && !name.includes("//") && name !== "HEAD";
}

async function switchTo(sh, dir, target, { create = false, force = false, detach = false, start = null, fresh = false }, io) {
  const current = await git.currentBranch({ fs: sh.fs, dir, fullname: false }).catch(() => undefined);
  if (create) {
    if (await git.resolveRef({ fs: sh.fs, dir, ref: `refs/heads/${target}` }).catch(() => null)) throw new GitError(`fatal: a branch named '${target}' already exists`);
    if (!isValidBranch(target)) throw new GitError(`fatal: '${target}' is not a valid branch name`);
    const head = await headOid(sh, dir);
    if (start) {
      const oid = await resolveCommit(sh, dir, start);
      // check the switch is possible before creating the branch
      await checkSwitch(sh, dir, oid, force);
      await git.writeRef({ fs: sh.fs, dir, ref: `refs/heads/${target}`, value: oid });
      await switchTo(sh, dir, target, { force }, { out: () => {}, err: io.err });
      const m = /^([^/]+)\/(.+)$/.exec(start);
      if (m && (await git.resolveRef({ fs: sh.fs, dir, ref: `refs/remotes/${start}` }).catch(() => null))) {
        await git.setConfig({ fs: sh.fs, dir, path: `branch.${target}.remote`, value: m[1] });
        await git.setConfig({ fs: sh.fs, dir, path: `branch.${target}.merge`, value: `refs/heads/${m[2]}` });
        if (!fresh) io.out(`branch '${target}' set up to track '${start}'.\n`);
      }
    } else {
      if (head) await git.writeRef({ fs: sh.fs, dir, ref: `refs/heads/${target}`, value: head });
      await git.writeRef({ fs: sh.fs, dir, ref: "HEAD", value: `refs/heads/${target}`, symbolic: true, force: true });
    }
    io.out(`Switched to a new branch '${target}'\n`);
    return 0;
  }
  const isBranch = !!(await git.resolveRef({ fs: sh.fs, dir, ref: `refs/heads/${target}` }).catch(() => null));
  if (!isBranch) {
    // a remote branch with the same name: create a tracking branch, like git does
    const remote = await remoteHaving(sh, dir, target);
    if (remote && !detach) {
      const remoteOid = await git.resolveRef({ fs: sh.fs, dir, ref: `refs/remotes/${remote}/${target}` });
      const status = await switchTo(sh, dir, target, { create: true, start: `${remote}/${target}`, force, fresh: true }, { out: () => {}, err: io.err });
      io.out(`branch '${target}' set up to track '${remote}/${target}'.\nSwitched to a new branch '${target}'\n`);
      void remoteOid;
      return status;
    }
  }
  if (!isBranch && !detach) throw new GitError(`fatal: invalid reference: ${target}`);
  if (isBranch && target === current) { io.out(`Already on '${target}'\n`); return 0; }
  const oid = await resolveCommit(sh, dir, target);
  const { info, from, to, blocked } = await checkSwitch(sh, dir, oid, force);
  // update files that differ between the two commits (keeping other local changes)
  for (const path of new Set([...from.keys(), ...to.keys()])) {
    if (from.get(path) === to.get(path) && !force) continue;
    await writeWork(sh, dir, path, to.has(path) ? await blobText(sh, dir, to.get(path)) : null);
    if (to.has(path)) await git.resetIndex({ fs: sh.fs, dir, filepath: path, ref: oid }); else await git.remove({ fs: sh.fs, dir, filepath: path });
  }
  if (isBranch) {
    await git.writeRef({ fs: sh.fs, dir, ref: "HEAD", value: `refs/heads/${target}`, symbolic: true, force: true });
    io.out(`Switched to branch '${target}'\n`);
  } else {
    await git.writeRef({ fs: sh.fs, dir, ref: "HEAD", value: oid, force: true });
    const { commit } = await git.readCommit({ fs: sh.fs, dir, oid });
    io.out(`Note: switching to '${target}'.\n\nYou are in 'detached HEAD' state. You can look around, make experimental\nchanges and commit them, and you can discard any commits you make in this\nstate without impacting any branches by switching back to a branch.\n\nHEAD is now at ${short(oid)} ${commit.message.split("\n")[0]}\n`);
  }
  const left = info.unstaged.filter((u) => !blocked.includes(u.path));
  for (const u of left) io.out(`M\t${u.path}\n`);
  return 0;
}

// Refuse to switch when it would overwrite local changes or untracked files, like git.
async function checkSwitch(sh, dir, oid, force) {
  const info = await statusInfo(sh, dir);
  const from = await treeFiles(sh, dir, info.head), to = await treeFiles(sh, dir, oid);
  const dirty = [...info.staged.map((s) => s.path), ...info.unstaged.map((u) => u.path)];
  const blocked = dirty.filter((p) => from.get(p) !== to.get(p));
  if (blocked.length && !force) {
    throw new GitError(`error: Your local changes to the following files would be overwritten by checkout:\n${blocked.map((p) => "\t" + p).join("\n")}\nPlease commit your changes or stash them before you switch branches.\nAborting`, 1);
  }
  const untrackedClash = info.untracked.filter((p) => to.has(p));
  if (untrackedClash.length && !force) {
    throw new GitError(`error: The following untracked working tree files would be overwritten by checkout:\n${untrackedClash.map((p) => "\t" + p).join("\n")}\nPlease move or remove them before you switch branches.\nAborting`, 1);
  }
  return { info, from, to, blocked };
}

// The remote that has a branch with this name (for "git switch feature" when only origin/feature exists).
async function remoteHaving(sh, dir, name) {
  for (const r of await git.listRemotes({ fs: sh.fs, dir }).catch(() => [])) {
    if (await git.resolveRef({ fs: sh.fs, dir, ref: `refs/remotes/${r.remote}/${name}` }).catch(() => null)) return r.remote;
  }
  return null;
}

GIT_COMMANDS.switch = async (sh, dir, args, io) => {
  const { opts, rest } = parseOpts(args, { "-c|--create": "value", "-C": "value", "--detach|-d": "bool", "-f|--force|--discard-changes": "bool", "-q|--quiet": "bool", "-t|--track": "bool" });
  if (opts["-q"]) io = { ...io, out: () => {} };
  if (opts["-c"]) {
    await switchTo(sh, dir, opts["-c"], { create: true, start: rest[0] ?? null }, io);
    return 0;
  }
  if (!rest.length) throw new GitError("fatal: missing branch or commit argument", 128);
  if (rest[0] === "-") {
    const prev = sh.previousBranch?.get(dir);
    if (!prev) throw new GitError("fatal: no previous branch");
    rest[0] = prev;
  }
  const before = await git.currentBranch({ fs: sh.fs, dir, fullname: false }).catch(() => undefined);
  const isBranch = await git.resolveRef({ fs: sh.fs, dir, ref: `refs/heads/${rest[0]}` }).catch(() => null);
  if (!isBranch && !opts["--detach"] && !(await remoteHaving(sh, dir, rest[0]))) {
    if (await resolveCommit(sh, dir, rest[0]).catch(() => null)) throw new GitError(`fatal: a branch is expected, got commit '${rest[0]}'\nhint: If you want to detach HEAD at the commit, try again with the --detach option.`);
    throw new GitError(`fatal: invalid reference: ${rest[0]}`);
  }
  const status = await switchTo(sh, dir, rest[0], { force: !!opts["-f"], detach: !!opts["--detach"] }, io);
  if (before) (sh.previousBranch ??= new Map()).set(dir, before);
  return status;
};

GIT_COMMANDS.checkout = async (sh, dir, args, io) => {
  const { opts, rest } = parseOpts(args, { "-b": "value", "-B": "value", "-f|--force": "bool", "-q|--quiet": "bool", "-t|--track": "bool" });
  if (opts["-q"]) io = { ...io, out: () => {} };
  if (opts["-b"]) { await switchTo(sh, dir, opts["-b"], { create: true, start: rest[0] ?? null }, io); return 0; }
  const dashes = rest.indexOf("--");
  if (dashes !== -1 || (rest.length && rest.every((r) => sh.fs.exists(sh.abs(r)) || false) && !(await resolveCommit(sh, dir, rest[0]).catch(() => null)))) {
    const files = dashes === -1 ? rest : rest.slice(dashes + 1);
    const source = dashes > 0 ? rest[0] : null;
    return GIT_COMMANDS.restore(sh, dir, [...(source ? ["--source", source, "--staged", "--worktree"] : []), ...files], io);
  }
  if (!rest.length) throw new GitError("fatal: you must specify a branch or commit", 128);
  const before = await git.currentBranch({ fs: sh.fs, dir, fullname: false }).catch(() => undefined);
  const isBranch = await git.resolveRef({ fs: sh.fs, dir, ref: `refs/heads/${rest[0]}` }).catch(() => null);
  const status = await switchTo(sh, dir, rest[0], { force: !!opts["-f"], detach: !isBranch && !(await remoteHaving(sh, dir, rest[0])) }, io);
  if (before) (sh.previousBranch ??= new Map()).set(dir, before);
  return status;
};

GIT_COMMANDS.tag = async (sh, dir, args, io) => {
  const { opts, rest } = parseOpts(args, { "-a|--annotate": "bool", "-m|--message": "value", "-d|--delete": "bool", "-l|--list": "bool", "-n": "bool" });
  if (opts["-d"]) {
    for (const t of rest) {
      const oid = await git.resolveRef({ fs: sh.fs, dir, ref: `refs/tags/${t}` }).catch(() => null);
      if (!oid) throw new GitError(`error: tag '${t}' not found.`, 1);
      await git.deleteTag({ fs: sh.fs, dir, ref: t });
      io.out(`Deleted tag '${t}' (was ${short(oid)})\n`);
    }
    return 0;
  }
  if (!rest.length || opts["-l"]) {
    const tags = (await git.listTags({ fs: sh.fs, dir })).sort();
    for (const t of tags) {
      if (opts["-n"]) {
        const oid = await git.resolveRef({ fs: sh.fs, dir, ref: `refs/tags/${t}` });
        const obj = await git.readObject({ fs: sh.fs, dir, oid });
        const msg = obj.type === "tag" ? obj.object.message : (await git.readCommit({ fs: sh.fs, dir, oid })).commit.message;
        io.out(`${t.padEnd(15)} ${msg.split("\n")[0]}\n`);
      } else io.out(t + "\n");
    }
    return 0;
  }
  const [name, target] = rest;
  if (await git.resolveRef({ fs: sh.fs, dir, ref: `refs/tags/${name}` }).catch(() => null)) throw new GitError(`fatal: tag '${name}' already exists`);
  const oid = await resolveCommit(sh, dir, target ?? "HEAD");
  if (opts["-a"] || opts["-m"]) {
    if (!opts["-m"]) throw new GitError(`error: this sandbox has no text editor, so write the tag message with -m:\n  git tag -a ${name} -m "Release ${name}"`, 1);
    const who = await identity(sh, dir);
    await git.annotatedTag({ fs: sh.fs, dir, ref: name, object: oid, message: opts["-m"], tagger: who });
  } else {
    await git.tag({ fs: sh.fs, dir, ref: name, object: oid });
  }
  return 0;
};

GIT_COMMANDS.merge = async (sh, dir, args, io) => {
  const { opts, rest } = parseOpts(args, { "--no-ff": "bool", "--ff-only": "bool", "--abort": "bool", "-m|--message": "value", "--squash": "bool", "--continue": "bool", "-q|--quiet": "bool", "--no-edit": "bool", "-e|--edit": "bool" });
  if (opts["-q"]) io = { ...io, out: () => {} };
  if (opts["--abort"]) {
    if (!sh.fs.exists(dir + "/.git/MERGE_HEAD")) throw new GitError("fatal: There is no merge to abort (MERGE_HEAD missing).");
    return GIT_COMMANDS.reset(sh, dir, ["--hard", "-q", "HEAD"], io);
  }
  if (opts["--continue"]) return GIT_COMMANDS.commit(sh, dir, [], io);
  if (!rest.length) {
    const cur = await git.currentBranch({ fs: sh.fs, dir, fullname: false }).catch(() => undefined);
    const up = cur ? await upstreamOf(sh, dir, cur) : null;
    if (!up || !up.oid) throw new GitError("fatal: No remote for the current branch.");
    rest.push(up.short);
  }
  const theirsName = rest[0];
  const theirs = await resolveCommit(sh, dir, theirsName).catch(() => null);
  if (!theirs) throw new GitError(`merge: ${theirsName} - not something we can merge`, 1);
  const ours = await headOid(sh, dir);
  const branch = await git.currentBranch({ fs: sh.fs, dir, fullname: false });
  if (ours === theirs || (await git.isDescendent({ fs: sh.fs, dir, oid: ours, ancestor: theirs, depth: -1 }))) { io.out("Already up to date.\n"); return 0; }
  const canFF = await git.isDescendent({ fs: sh.fs, dir, oid: theirs, ancestor: ours, depth: -1 });
  const from = await filesAt(sh, dir, ours), to = await filesAt(sh, dir, theirs);
  const info = await statusInfo(sh, dir);
  const touched = [...info.staged, ...info.unstaged].map((x) => x.path).filter((p) => from.get(p) !== to.get(p));
  if (info.staged.length || touched.length) {
    const list = info.staged.length ? [...info.staged, ...info.unstaged].map((x) => x.path) : touched;
    throw new GitError(`error: Your local changes to the following files would be overwritten by merge:\n${[...new Set(list)].map((x) => "\t" + x).join("\n")}\nPlease commit your changes or stash them before you merge.\nAborting\nMerge with strategy ort failed.`, 2);
  }
  if (canFF && !opts["--no-ff"] && !opts["--squash"]) {
    await switchFiles(sh, dir, ours, theirs);
    await git.writeRef({ fs: sh.fs, dir, ref: `refs/heads/${branch}`, value: theirs, force: true });
    io.out(`Updating ${short(ours)}..${short(theirs)}\nFast-forward\n` + (await unifiedDiff(sh, dir, from, to, { stat: true })));
    return 0;
  }
  if (opts["--ff-only"]) throw new GitError("hint: Diverging branches can't be fast-forwarded, you need to either:\nhint:\nhint: \tgit merge --no-ff\nhint:\nhint: or:\nhint:\nhint: \tgit rebase\nhint:\nfatal: Not possible to fast-forward, aborting.");
  // a real three-way merge
  const base = (await git.findMergeBase({ fs: sh.fs, dir, oids: [ours, theirs] }))[0];
  const baseFiles = await filesAt(sh, dir, base);
  const conflicts = [], contentMerged = new Set();
  const result = new Map(from);
  for (const path of new Set([...baseFiles.keys(), ...from.keys(), ...to.keys()])) {
    const b = baseFiles.get(path) ?? null, o = from.get(path) ?? null, t = to.get(path) ?? null;
    if (o === t) continue;
    if (b === o) { if (t === null) result.delete(path); else result.set(path, t); continue; }
    if (b === t) continue;
    if (o === null || t === null) { conflicts.push(path); result.set(path, o ?? t); continue; }
    contentMerged.add(path);
    const merged = mergeText(b ?? "", o, t, "HEAD", sh.mergeLabel ?? theirsName);
    if (merged.conflict) conflicts.push(path);
    result.set(path, merged.text);
  }
  for (const path of new Set([...from.keys(), ...result.keys()])) {
    const text = result.has(path) ? result.get(path) : null;
    if (text === (from.get(path) ?? null)) continue;
    io.out(contentMerged.has(path) ? `Auto-merging ${path}\n` + (conflicts.includes(path) ? `CONFLICT (content): Merge conflict in ${path}\n` : "") : "");
    await writeWork(sh, dir, path, text);
    if (!conflicts.includes(path)) { if (text === null) await git.remove({ fs: sh.fs, dir, filepath: path }); else await git.add({ fs: sh.fs, dir, filepath: path }); }
  }
  const isRemote = !!(await git.resolveRef({ fs: sh.fs, dir, ref: `refs/remotes/${theirsName}` }).catch(() => null)) && !(await git.resolveRef({ fs: sh.fs, dir, ref: `refs/heads/${theirsName}` }).catch(() => null));
  const message = opts["-m"] ?? `Merge ${isRemote ? "remote-tracking branch" : "branch"} '${theirsName}'${branch === "main" || branch === "master" ? "" : ` into ${branch}`}`;
  if (opts["--squash"]) {
    io.out("Squash commit -- not updating HEAD\n" + (conflicts.length ? "Automatic merge failed; fix conflicts and then commit the result.\n" : ""));
    return conflicts.length ? 1 : 0;
  }
  await sh.fs.writeFile(dir + "/.git/MERGE_HEAD", theirs + "\n");
  await sh.fs.writeFile(dir + "/.git/MERGE_MSG", message + "\n");
  if (conflicts.length) {
    sh.unmerged = new Set(conflicts);
    io.out("Automatic merge failed; fix conflicts and then commit the result.\n");
    return 1;
  }
  const author = await identity(sh, dir);
  const oid = await git.commit({ fs: sh.fs, dir, message, author, committer: author, parent: [ours, theirs] });
  await sh.fs.unlink(dir + "/.git/MERGE_HEAD");
  await sh.fs.unlink(dir + "/.git/MERGE_MSG");
  io.out("Merge made by the 'ort' strategy.\n" + (await unifiedDiff(sh, dir, from, await filesAt(sh, dir, oid), { stat: true })));
  return 0;
};

async function switchFiles(sh, dir, fromOid, toOid) {
  const from = await treeFiles(sh, dir, fromOid), to = await treeFiles(sh, dir, toOid);
  for (const path of new Set([...from.keys(), ...to.keys()])) {
    if (from.get(path) === to.get(path)) continue;
    await writeWork(sh, dir, path, to.has(path) ? await blobText(sh, dir, to.get(path)) : null);
    if (to.has(path)) await git.resetIndex({ fs: sh.fs, dir, filepath: path, ref: toOid }); else await git.remove({ fs: sh.fs, dir, filepath: path });
  }
}

// Line-based three-way merge with conflict markers, like git's default.
export function mergeText(base, ours, theirs, oursName = "HEAD", theirsName = "theirs") {
  const B = splitLines(base), O = splitLines(ours), T = splitLines(theirs);
  const chunks = (X) => {
    // map of base line index ranges changed in X: list of { start, end, lines }
    const ops = diffLines(B, X);
    const res = [];
    let bi = 0, cur = null;
    for (const [k, line] of ops) {
      if (k === " ") { if (cur) { res.push(cur); cur = null; } bi++; continue; }
      if (!cur) cur = { start: bi, end: bi, lines: [] };
      if (k === "-") { bi++; cur.end = bi; } else cur.lines.push(line);
    }
    if (cur) res.push(cur);
    return res;
  };
  const co = chunks(O), ct = chunks(T);
  const out = [];
  let conflict = false, bi = 0, i = 0, j = 0;
  while (i < co.length || j < ct.length) {
    const a = co[i], b = ct[j];
    const next = !b || (a && a.start <= b.start) ? a : b;
    // gather overlapping chunks from both sides
    let start = next.start, end = next.end;
    const mine = [], theirsC = [];
    let grew = true;
    while (grew) {
      grew = false;
      while (i < co.length && co[i].start <= end && (co[i].start < end || co[i].end > co[i].start || co[i].start === start)) {
        if (co[i].start > end) break;
        mine.push(co[i]); end = Math.max(end, co[i].end); start = Math.min(start, co[i].start); i++; grew = true;
      }
      while (j < ct.length && ct[j].start <= end && (ct[j].start < end || ct[j].end > ct[j].start || ct[j].start === start)) {
        if (ct[j].start > end) break;
        theirsC.push(ct[j]); end = Math.max(end, ct[j].end); start = Math.min(start, ct[j].start); j++; grew = true;
      }
    }
    out.push(...B.slice(bi, start));
    const apply = (cs) => {
      const res = [];
      let k = start;
      for (const c of cs) { res.push(...B.slice(k, c.start), ...c.lines); k = c.end; }
      res.push(...B.slice(k, end));
      return res;
    };
    const oursLines = apply(mine), theirsLines = apply(theirsC);
    if (!theirsC.length) out.push(...oursLines);
    else if (!mine.length) out.push(...theirsLines);
    else if (oursLines.join("\n") === theirsLines.join("\n")) out.push(...oursLines);
    else {
      conflict = true;
      out.push(`<<<<<<< ${oursName}`, ...oursLines, "=======", ...theirsLines, `>>>>>>> ${theirsName}`);
    }
    bi = end;
  }
  out.push(...B.slice(bi));
  return { text: out.length ? out.join("\n") + "\n" : "", conflict };
}

async function withLocalIdentity(sh, dir, fn) {
  const who = await identity(sh, dir);
  const had = { name: await git.getConfig({ fs: sh.fs, dir, path: "user.name" }), email: await git.getConfig({ fs: sh.fs, dir, path: "user.email" }) };
  if (had.name === undefined) await git.setConfig({ fs: sh.fs, dir, path: "user.name", value: who.name });
  if (had.email === undefined) await git.setConfig({ fs: sh.fs, dir, path: "user.email", value: who.email });
  try { return await fn(); } finally {
    if (had.name === undefined) await git.setConfig({ fs: sh.fs, dir, path: "user.name", value: undefined });
    if (had.email === undefined) await git.setConfig({ fs: sh.fs, dir, path: "user.email", value: undefined });
  }
}

GIT_COMMANDS.stash = async (sh, dir, args, io) => {
  const op = args[0] && !args[0].startsWith("-") ? args[0] : "push";
  const opts = parseOpts(args.slice(op === args[0] ? 1 : 0), { "-m|--message": "value", "-u|--include-untracked": "bool", "--index": "bool", "-q|--quiet": "bool" }).opts;
  const branch = await git.currentBranch({ fs: sh.fs, dir, fullname: false });
  if (op === "push" || op === "save") {
    const info = await statusInfo(sh, dir);
    if (!info.staged.length && !info.unstaged.length) { io.out("No local changes to save\n"); return 0; }
    const head = await headOid(sh, dir);
    const { commit } = await git.readCommit({ fs: sh.fs, dir, oid: head });
    await withLocalIdentity(sh, dir, () => git.stash({ fs: sh.fs, dir, op: "push", message: opts["-m"] ?? "" }));
    io.out(`Saved working directory and index state ${opts["-m"] ? `On ${branch}: ${opts["-m"]}` : `WIP on ${branch}: ${short(head)} ${commit.message.split("\n")[0]}`}\n`);
    return 0;
  }
  if (op === "list") {
    const list = await git.stash({ fs: sh.fs, dir, op: "list" });
    io.out((list || []).map((s, k) => (typeof s === "string" && s.startsWith("stash@") ? s : `stash@{${k}}: ${typeof s === "string" ? s : s.message ?? ""}`) + "\n").join(""));
    return 0;
  }
  if (op === "pop" || op === "apply") {
    const stashOid = await git.resolveRef({ fs: sh.fs, dir, ref: "refs/stash" }).catch(() => null);
    if (!stashOid) throw new GitError("error: No stash entries found.", 1);
    try { await withLocalIdentity(sh, dir, () => git.stash({ fs: sh.fs, dir, op })); }
    catch (e) { throw new GitError(e.message.includes("No stash") || e.code === "NotFoundError" ? "error: No stash entries found." : `error: ${e.message}`, 1); }
    if (!opts["--index"]) {
      // like git, changes to existing files come back unstaged (new files stay added) unless --index
      const after = await statusInfo(sh, dir);
      for (const st of after.staged) if (st.kind === "modified") await git.resetIndex({ fs: sh.fs, dir, filepath: st.path });
    }
    // like git, show the status afterwards
    await GIT_COMMANDS.status(sh, dir, [], io);
    if (op === "pop") io.out(`Dropped refs/stash@{0} (${stashOid})\n`);
    return 0;
  }
  if (op === "drop" || op === "clear") { await git.stash({ fs: sh.fs, dir, op }); return 0; }
  throw new GitError(`error: unknown subcommand: ${op}`, 129);
};

const GH_API = installGitHub({
  git, GIT_COMMANDS, GitError, parseOpts, resolveCommit, filesAt, headOid, statusInfo, switchFiles, mergeText, unifiedDiff, short,
  identity, writeWork, registerCommand, ancestors, upstreamOf, getConfigValue, findRoot, gitDate, conflictedPaths, summaryLine,
  diffLines, splitLines, START,
});
const ACTIONS_API = installActions(GH_API, { git, Shell, registerCommand, parseOpts, filesAt, START });

installNode({ registerCommand, ExitSignal });
export const gitCommands = GIT_COMMANDS;
export { GitError, resolveCommit, treeFiles, blobText, statusInfo, findRoot, filesAt, unifiedDiff, headOid };

/* ---------------------------------------------------------------- running scripts and checks */

export async function runShell(script, { setup = "", stdin = "" } = {}) {
  const t0 = Date.now();
  const sh = new Shell();
  await sh.init();
  try {
    if (setup) { sh.quiet = true; await sh.runScript(setup, { echo: false }); sh.quiet = false; sh.history = []; sh.lastStatus = 0; }
    await sh.runScript(script);
  } catch (e) {
    sh.quiet = false;
    sh.push("err", `Sandbox error: ${e && e.message}\n`);
    return { ok: false, parts: sh.parts, figures: [], ms: Date.now() - t0, shell: sh };
  }
  const ok = !sh.parts.some(([k]) => k === "err") || sh.lastStatus === 0;
  return { ok: sh.lastStatus === 0 && ok, parts: sh.parts, figures: [], ms: Date.now() - t0, shell: sh };
}

class AssertionError extends Error {
  constructor(msg) { super(msg); this.name = "AssertionError"; }
}

function show(v) {
  try { return typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v, null, 1).replace(/\n\s*/g, " "); } catch { return String(v); }
}

// Helpers exercise checks use to look at what the learner did.
function makeShellHelpers(sh) {
  const output = () => sh.parts.filter(([k]) => k !== "cmd").map(([, t]) => t).join("");
  const repoDir = async (path) => {
    if (path) return sh.abs(path);
    const root = await findRoot(sh, sh.cwd);
    if (root) return root;
    for (const candidate of sh.fs.walkFiles(HOME).filter((f) => f.endsWith("/.git/HEAD"))) return candidate.slice(0, -"/.git/HEAD".length);
    return sh.abs("~");
  };
  async function repo(path) {
    const dir = await repoDir(path);
    if (!sh.fs.isDir(dir + "/.git")) throw new AssertionError(`There's no Git repository in ${dir.replace(HOME, "~")} yet (git init creates one).`);
    const api = {
      dir,
      async log(ref = "HEAD") {
        const head = await headOid(sh, dir);
        if (!head) return [];
        const oid = await resolveCommit(sh, dir, ref);
        const commits = await logCommits(sh, dir, oid, {});
        return commits.map(({ oid, commit }) => ({ oid, message: commit.message.replace(/\n$/, ""), subject: commit.message.split("\n")[0], parents: commit.parent, author: commit.author }));
      },
      async files(ref = "HEAD") {
        const head = await headOid(sh, dir);
        if (!head) return {};
        return Object.fromEntries(await filesAt(sh, dir, await resolveCommit(sh, dir, ref)));
      },
      async staged() { return Object.fromEntries(await filesInIndex(sh, dir)); },
      async status() {
        const info = await statusInfo(sh, dir);
        return { staged: info.staged.map((s) => s.path), modified: info.unstaged.map((u) => u.path), untracked: info.untracked, clean: !info.staged.length && !info.unstaged.length && !info.untracked.length };
      },
      async branch() { return (await git.currentBranch({ fs: sh.fs, dir, fullname: false })) ?? null; },
      async branches() { return (await git.listBranches({ fs: sh.fs, dir })).sort(); },
      async tags() { return (await git.listTags({ fs: sh.fs, dir })).sort(); },
      async resolve(ref) { return resolveCommit(sh, dir, ref).catch(() => null); },
      async config(key) { return getConfigValue(sh, dir, key); },
      read(path) { return sh.fs.text(dir + "/" + path); },
      exists(path) { return sh.fs.exists(dir + "/" + path); },
      async ignored(path) { return isIgnored(sh, dir, path); },
      async upstream(branch) {
        const b = branch ?? (await git.currentBranch({ fs: sh.fs, dir, fullname: false }));
        const up = b ? await upstreamOf(sh, dir, b) : null;
        return up ? up.short : null;
      },
      async remotes() {
        const out = {};
        for (const r of await git.listRemotes({ fs: sh.fs, dir }).catch(() => [])) out[r.remote] = r.url;
        return out;
      },
      async remoteBranches() {
        const out = [];
        for (const r of await git.listRemotes({ fs: sh.fs, dir }).catch(() => [])) {
          for (const b of await git.listBranches({ fs: sh.fs, dir, remote: r.remote }).catch(() => [])) if (b !== "HEAD") out.push(`${r.remote}/${b}`);
        }
        return out.sort();
      },
      async tracking(branch) {
        const b = branch ?? (await git.currentBranch({ fs: sh.fs, dir, fullname: false }));
        const t = b ? await trackingInfo(sh, dir, b) : null;
        return t ? { upstream: t.up.short, ahead: t.ahead, behind: t.behind, gone: t.gone } : null;
      },
      inProgress() {
        return sh.fs.exists(dir + "/.git/MERGE_HEAD") ? "merge" : sh.fs.exists(dir + "/.git/rebase-merge") ? "rebase"
          : sh.fs.exists(dir + "/.git/CHERRY_PICK_HEAD") ? "cherry-pick" : null;
      },
    };
    return api;
  }
  // A repository on the pretend GitHub, by "owner/name".
  async function github(full) {
    const dir = `${GH_API.GH}/${full}`;
    if (!sh.fs.isDir(dir + "/.git")) throw new AssertionError(`There's no repository ${full} on GitHub yet.`);
    const commitList = async (ref) => {
      const oid = await resolveCommit(sh, dir, ref).catch(() => null);
      if (!oid) return [];
      return (await logCommits(sh, dir, oid, {})).map(({ oid, commit }) => ({ oid, message: commit.message.replace(/\n$/, ""), subject: commit.message.split("\n")[0], parents: commit.parent, author: commit.author, committer: commit.committer }));
    };
    return {
      dir,
      defaultBranch: GH_API.defaultBranchOf(sh, dir),
      async branches() { return [...(await GH_API.branchesOf(sh, dir)).keys()]; },
      async resolve(ref) { return resolveCommit(sh, dir, ref).catch(() => null); },
      log: commitList,
      async files(ref) { const oid = await resolveCommit(sh, dir, ref ?? GH_API.defaultBranchOf(sh, dir)).catch(() => null); return oid ? Object.fromEntries(await filesAt(sh, dir, oid)) : {}; },
      pulls() { return GH_API.ghLoad(sh, dir).pulls; },
      rulesets() { return GH_API.ghLoad(sh, dir).rulesets; },
      releases() { return GH_API.ghLoad(sh, dir).releases ?? []; },
      async tag(name) {
        const oid = await git.resolveRef({ fs: sh.fs, dir, ref: `refs/tags/${name}` }).catch(() => null);
        if (!oid) return null;
        const obj = await git.readObject({ fs: sh.fs, dir, oid });
        return obj.type === "tag" ? { annotated: true, commit: obj.object.object, message: obj.object.message.replace(/\n$/, "") } : { annotated: false, commit: oid, message: null };
      },
      async tags() { return (await git.listTags({ fs: sh.fs, dir })).sort(); },
      // GitHub Actions: runs newest first, each { id, workflow, workflowName, event, headBranch, status, conclusion, jobs: [{ name, conclusion, steps, annotations }] }
      runs() { return [...(ACTIONS_API.store(sh, dir).actions.runs)].reverse(); },
      secrets() { return Object.keys(ACTIONS_API.store(sh, dir).actions.secrets).sort(); },
      variables() { return Object.fromEntries(Object.entries(ACTIONS_API.store(sh, dir).actions.variables).map(([k, v]) => [k, v.value])); },
      pages() { const p = ACTIONS_API.store(sh, dir).actions.pages; return { enabled: !!p.enabled, files: p.files ?? null, url: p.url ?? null }; },
      // the full text a job printed: every log line without its timestamp
      jobLog(run, name) { const j = run.jobs.find((x) => x.name === name); return j ? j.steps.flatMap((st) => st.log.map((l) => l.text)).join("\n") : null; },
    };
  }
  const commands = () => sh.history.slice();
  return {
    repo, github, commands,
    // read a workflow file like GitHub: { wf (the YAML as an object), errors (actionlint's) }
    workflow(path) { const text = sh.fs.text(sh.abs(path)); if (text === null) throw new AssertionError(`There's no file ${path} yet.`); return ACTIONS_API.readWorkflow(path, text); },
    ran: (re) => sh.history.some((c) => (re instanceof RegExp ? re.test(c) : c.includes(re))),
    read: (path) => sh.fs.text(sh.abs(path)),
    exists: (path) => sh.fs.exists(sh.abs(path)),
    isDir: (path) => sh.fs.isDir(sh.abs(path)),
    async sh(cmd) {
      const before = sh.parts.length;
      const saved = sh.parts.slice();
      sh.parts = [];
      sh.quiet = false;
      await sh.runScript(cmd, { echo: false });
      const text = sh.parts.map(([, t]) => t).join("");
      sh.parts = saved;
      void before;
      return text;
    },
    globalConfig: (key) => sh.globalConfig.get(key),
    cwd: () => sh.cwd.replace(HOME, "~"),
    same(actual, expected, what = "Your result") {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new AssertionError(`${what} isn't right yet.\nExpected: ${show(expected)}\nGot:      ${show(actual)}`);
      }
      return true;
    },
    printed: (...texts) => texts.every((t) => output().includes(String(t))),
    __output__: output(),
    AssertionError,
  };
}

export async function checkShell(script, checkSrc, { setup = "" } = {}) {
  const res = await runShell(script, { setup });
  const sh = res.shell;
  delete res.shell;
  if (res.parts.some(([k, t]) => k === "err" && /^Sandbox error/.test(t))) {
    return { ...res, verdict: { ok: false, msg: "The sandbox hit a problem running your commands (see above)." } };
  }
  const helpers = makeShellHelpers(sh);
  const names = Object.keys(helpers);
  const AsyncFunction = (async () => {}).constructor;
  let verdict;
  try {
    const fn = new AsyncFunction(...names, `"use strict";\n${checkSrc}`);
    await fn(...names.map((n) => helpers[n]));
    verdict = { ok: true, msg: "All checks passed." };
  } catch (e) {
    verdict = e && e.name === "AssertionError" ? { ok: false, msg: e.message } : { ok: false, msg: `Checking stopped with ${e && e.name}: ${e && e.message}` };
  }
  return { ...res, ok: true, verdict };
}
