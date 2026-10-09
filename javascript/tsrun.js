/* TypeScript support for the sandbox: type-checks the learner's TypeScript with the real compiler (in strict
   mode), turns it into JavaScript, and runs that with runner.js, reporting errors at the lines of the
   TypeScript the learner wrote. Used by worker.js in the browser and by harness.mjs in the tests.

   makeTs(R, ts, libs) -> { run(src, stdin), check(src, checkSrc, stdin, typecheckSrc) }
     R      the runner.js module (passed in, so this file has no imports and shares the caller's runner)
     ts     the TypeScript compiler API (typescript.js)
     libs   { "lib.esnext.d.ts": "…", … } the built-in type declarations, from ts-libs.json

   A check's optional typecheckSrc is TypeScript appended to the learner's code that must compile cleanly.
   Lines marked `// @ts-expect-error why` must be type errors: that's how exercises test the learner's types. */

const MAIN = "/main.ts";
const SANDBOX_DTS = "/sandbox.d.ts";
// The sandbox runs code in a Web Worker, so the worker's globals (console, fetch, setTimeout…) are declared by
// lib.webworker.d.ts. prompt() is the sandbox's own; it reads the Input box like the browser's window.prompt.
const SANDBOX_TYPES = "declare function prompt(message?: string): string | null;\n";
const MAX_ERRORS = 6;

export function makeTs(R, ts, libs) {
  const libCache = new Map();
  const options = {
    strict: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleDetection: ts.ModuleDetectionKind.Force,     // top-level await works, and names don't clash with globals
    lib: ["lib.esnext.d.ts", "lib.webworker.d.ts"],
    types: [],
    skipLibCheck: true,
    sourceMap: true,
    newLine: ts.NewLineKind.LineFeed,
    noEmitOnError: false,
  };

  function compile(text) {
    const outputs = {};
    const base = (name) => name.replace(/^.*\//, "");
    const host = {
      getSourceFile(name, langOrOptions) {
        if (name === MAIN) return ts.createSourceFile(MAIN, text, langOrOptions, true);
        if (name === SANDBOX_DTS) return ts.createSourceFile(SANDBOX_DTS, SANDBOX_TYPES, langOrOptions, false);
        const b = base(name);
        if (!(b in libs)) return undefined;
        if (!libCache.has(b)) libCache.set(b, ts.createSourceFile(name, libs[b], langOrOptions, false));
        return libCache.get(b);
      },
      getDefaultLibFileName: () => "/lib.esnext.d.ts",
      getDefaultLibLocation: () => "/",
      writeFile: (name, data) => { outputs[base(name)] = data; },
      getCurrentDirectory: () => "/",
      getDirectories: () => [],
      fileExists: (name) => name === MAIN || name === SANDBOX_DTS || base(name) in libs,
      readFile: (name) => (name === MAIN ? text : name === SANDBOX_DTS ? SANDBOX_TYPES : libs[base(name)]),
      getCanonicalFileName: (name) => name,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => "\n",
    };
    const program = ts.createProgram([MAIN, SANDBOX_DTS], options, host);
    const diagnostics = ts.getPreEmitDiagnostics(program).filter((d) => !d.file || d.file.fileName === MAIN);
    program.emit();
    const js = (outputs["main.js"] || "").replace(/^export \{\};\n/m, "").replace(/\n\/\/# sourceMappingURL=.*$/, "");
    return { diagnostics, js, mapLine: lineMapper(outputs["main.js.map"]), file: program.getSourceFile(MAIN) };
  }

  function describe(d, srcLines, firstExtraLine) {
    const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    if (!d.file || d.start === undefined) return `${msg} (TS${d.code})`;
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
    const full = srcLines[line] ?? "";
    const indent = full.length - full.trimStart().length;
    const shown = full.trim();
    const width = Math.max(1, Math.min(d.length || 1, full.length - character));
    const caret = " ".repeat(Math.max(0, character - indent)) + "^".repeat(width);
    if (firstExtraLine !== undefined && line >= firstExtraLine) {
      if (d.code === 2578) {                                  // unused @ts-expect-error: this line should be an error
        const why = (/@ts-expect-error\s*:?\s*(.*)$/.exec(full) || [])[1];
        const next = (srcLines[line + 1] ?? "").trim();
        return `TypeScript should reject this, but your types allow it:\n  ${next}${why ? `\n  (${why})` : ""}`;
      }
      return `Your types don't allow this correct use:\n  ${shown}\n  ${caret}\n${msg} (TS${d.code})`;
    }
    return `Line ${line + 1}: ${shown}\n${" ".repeat(String(line + 1).length + 7)}${caret}\n${msg} (TS${d.code})`;
  }

  function errorParts(diagnostics, text, firstExtraLine) {
    const lines = text.split("\n");
    const shown = diagnostics.slice(0, MAX_ERRORS).map((d) => describe(d, lines, firstExtraLine));
    const n = diagnostics.length;
    let tail = `\nTypeScript found ${n} error${n === 1 ? "" : "s"}${n > MAX_ERRORS ? ` (the first ${MAX_ERRORS} are shown)` : ""}, so the code didn't run.`;
    return [["err", shown.join("\n\n") + "\n" + tail + "\n"]];
  }

  async function run(src, stdin = "") {
    const c = compile(src);
    if (c.diagnostics.length) return { ok: false, typeErrors: true, parts: errorParts(c.diagnostics, src), figures: [] };
    return R.run(c.js, stdin, {}, { source: src, mapLine: c.mapLine });
  }

  async function check(src, checkSrc, stdin = "", typecheckSrc = "") {
    const c = compile(src);
    if (c.diagnostics.length) {
      return { ok: false, parts: errorParts(c.diagnostics, src), figures: [],
               verdict: { ok: false, msg: "TypeScript found errors in your code (see above). Fix them and check again." } };
    }
    if (typecheckSrc) {
      const combined = src + "\n" + typecheckSrc;
      const t = compile(combined);
      if (t.diagnostics.length) {
        const first = src.split("\n").length;
        const msgs = t.diagnostics.slice(0, 3).map((d) => describe(d, combined.split("\n"), first));
        return { ok: true, parts: [], figures: [],
                 verdict: { ok: false, msg: "Your code runs, but its types aren't right yet.\n\n" + msgs.join("\n\n") } };
      }
    }
    return R.check(c.js, checkSrc, stdin, {}, { source: src, mapLine: c.mapLine });
  }

  return { run, check, compile };
}

/* Source maps: for each line of the JavaScript, the line of the TypeScript it came from. */
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function decodeVlq(segment) {
  const out = [];
  let value = 0, shift = 0;
  for (const ch of segment) {
    const digit = B64.indexOf(ch);
    value += (digit & 31) << shift;
    if (digit & 32) { shift += 5; continue; }
    out.push(value & 1 ? -(value >>> 1) : value >>> 1);
    value = 0; shift = 0;
  }
  return out;
}

function lineMapper(mapText) {
  const lines = [];
  try {
    const { mappings } = JSON.parse(mapText);
    let srcLine = 0;
    for (const genLine of mappings.split(";")) {
      let first = null;
      for (const seg of genLine.split(",")) {
        if (!seg) continue;
        const f = decodeVlq(seg);
        if (f.length >= 4) {
          srcLine += f[2];
          if (first === null) first = srcLine;
        }
      }
      lines.push(first);
    }
  } catch { /* no map: lines stay unknown */ }
  return (jsLine) => {
    const v = lines[jsLine - 1];
    return v === null || v === undefined ? null : v + 1;
  };
}
