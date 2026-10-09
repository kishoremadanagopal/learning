/* A module Web Worker that runs the learner's JavaScript off the main thread, so a long or endless loop never
   freezes the page and Stop can end it. The same runner.js is used by the Node.js test harness.
   TypeScript lessons also load the TypeScript compiler (once, on first use) to type-check and compile the code. */
const loading = import("./runner.js" + self.location.search);   // versioned like the page's other files

// The compiler is the same version build.py tests with; ts-libs.json holds its built-in type declarations.
const TS_VERSION = "6.0.3";
const TS_URLS = [
  `https://cdn.jsdelivr.net/npm/typescript@${TS_VERSION}/lib/typescript.js`,
  `https://unpkg.com/typescript@${TS_VERSION}/lib/typescript.js`,
];
let tsLoading = null;

async function fetchText(urls) {
  let last;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
      last = new Error(`HTTP ${res.status}`);
    } catch (e) { last = e; }
  }
  throw last;
}

function loadTypeScript(R) {
  if (!tsLoading) {
    self.postMessage({ type: "loading", what: "TypeScript" });
    tsLoading = (async () => {
      const [mod, source, libs] = await Promise.all([
        import("./tsrun.js" + self.location.search),
        fetchText(TS_URLS),
        fetch("ts-libs.json" + self.location.search).then((r) => r.json()),
      ]);
      const ts = new Function(source + "\n;return ts;")();
      return mod.makeTs(R, ts, libs);
    })();
    tsLoading.catch(() => { tsLoading = null; });
  }
  return tsLoading;
}

self.addEventListener("unhandledrejection", async (e) => { e.preventDefault(); (await loading).reportUnhandled(e.reason); });
self.addEventListener("error", async (e) => { e.preventDefault(); (await loading).reportUnhandled(e.error || new Error(e.message)); });

self.onmessage = async (e) => {
  const msg = e.data;
  let R;
  try {
    R = await loading;
  } catch (err) {
    self.postMessage({ type: "failed", error: String(err && err.message || err) });
    return;
  }
  if (msg.type === "init") {
    self.postMessage({ type: "ready" });
    return;
  }
  let result;
  try {
    if (msg.lang === "ts") {
      let T;
      try {
        T = await loadTypeScript(R);
      } catch (err) {
        throw new Error("The TypeScript compiler couldn't be downloaded. Check your connection and run again.");
      }
      result = msg.type === "check"
        ? await T.check(msg.code, msg.check || "", msg.stdin || "", msg.typecheck || "")
        : await T.run(msg.code, msg.stdin || "");
    } else {
      result = msg.type === "check"
        ? await R.check(msg.code, msg.check || "", msg.stdin || "")
        : await R.run(msg.code, msg.stdin || "");
    }
  } catch (err) {
    result = { ok: false, parts: [["err", String(err && err.message || err)]], figures: [] };
  }
  self.postMessage({ type: "result", id: msg.id, result });
};
