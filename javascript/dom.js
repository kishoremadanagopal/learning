/* Runs a learner's HTML page in a sandboxed iframe (the page preview), for the browser lessons.

   The iframe gets sandbox="allow-scripts allow-forms" and no allow-same-origin, so the page can't touch the
   course page, its storage or its cookies. dom-prelude.js (with runner.js) is placed at the top of the page, on
   the same line, so line numbers in error messages match the learner's file. The page sends its console output
   and errors here with postMessage.

     DomSandbox.load(version)               fetch runner.js and dom-prelude.js (once)
     DomSandbox.setSources(runner, prelude) or pass their text directly (the test harness)
     const s = DomSandbox.open(host, html, onOutput)
       s.result(settleMs) -> { ok, parts }            after the page loads (and settles)
       s.check(checkSrc)  -> { ok, parts, verdict }   runs the exercise checks inside the page
       s.dispose()                                    removes the iframe (also stops a frozen page)
   The same file runs in the sandbox page and in build.py's tests (headless Chromium). */
(function () {
  "use strict";
  let sources = null, loading = null;
  const LOAD_LIMIT_MS = 10000, CHECK_LIMIT_MS = 20000;

  function setSources(runnerText, preludeText) { sources = { runnerText, preludeText }; }

  function load(version) {
    if (sources) return Promise.resolve();
    if (!loading) {
      const v = "?v=" + (version || "0");
      loading = Promise.all(["runner.js", "dom-prelude.js"].map((f) => fetch(f + v).then((r) => {
        if (!r.ok) throw new Error(`Couldn't load ${f} (${r.status})`);
        return r.text();
      }))).then(([r, p]) => setSources(r, p));
      loading.catch(() => { loading = null; });
    }
    return loading;
  }

  function buildDoc(src, cfg) {
    const code = "(function (__CFG) {\n" + sources.runnerText.replace(/^export /gm, "") + "\n" + sources.preludeText +
      "\n})(" + JSON.stringify(cfg) + ");";
    // No "<" inside the script, so nothing in it (like "</script>") can end it early.
    const literal = JSON.stringify(code).replace(/</g, "\\u003c");
    const tag = `<script>(0, eval)(${literal})</script>`;
    // Keep a <!doctype html> first (otherwise the page renders in quirks mode); the tag goes on the same line.
    const m = /^\s*<!doctype[^>]*>/i.exec(src);
    return m ? src.slice(0, m[0].length) + tag + src.slice(m[0].length) : tag + src;
  }

  function open(host, src, onOutput) {
    if (!sources) throw new Error("DomSandbox: call load() first");
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts allow-forms");
    frame.setAttribute("title", "Your page");
    const parts = [];
    let errors = 0, disposed = false, verdictResolve = null;
    let loadedResolve;
    const loaded = new Promise((r) => { loadedResolve = r; });

    function push(kind, text) {
      const last = parts[parts.length - 1];
      if (last && last[0] === kind) last[1] += text; else parts.push([kind, text]);
      if (onOutput) onOutput(parts);
    }
    function onMessage(e) {
      if (disposed || e.source !== frame.contentWindow) return;
      const m = e.data;
      if (!m || m.__domSandbox !== token) return;
      if (m.type === "out") push(m.kind, m.text);
      else if (m.type === "error") errors++;
      else if (m.type === "loaded") loadedResolve(true);
      else if (m.type === "verdict" && verdictResolve) verdictResolve(m.verdict);
    }
    window.addEventListener("message", onMessage);
    frame.srcdoc = buildDoc(src, { token, src });
    host.replaceChildren(frame);

    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const timeout = (ms, value) => wait(ms).then(() => value);

    async function waitLoaded() {
      const ok = await Promise.race([loaded, timeout(LOAD_LIMIT_MS, false)]);
      if (!ok && !disposed) push("err", "The page didn't finish loading within 10 s (an endless loop, or a script that never ends?).\n");
      return ok;
    }

    return {
      frame, parts,
      async result(settleMs = 300) {
        const ok = await waitLoaded();
        if (ok) await wait(settleMs);
        return { ok: ok && errors === 0, parts: parts.map((p) => p.slice()) };
      },
      async check(checkSrc) {
        if (!(await waitLoaded())) {
          return { ok: false, parts: parts.map((p) => p.slice()), verdict: { ok: false, msg: "The page didn't load, so the checks couldn't run." } };
        }
        const verdict = await Promise.race([
          new Promise((r) => { verdictResolve = r; frame.contentWindow.postMessage({ __domSandbox: token, type: "check", code: checkSrc }, "*"); }),
          timeout(CHECK_LIMIT_MS, { ok: false, msg: "The checks didn't finish within 20 s." }),
        ]);
        return { ok: errors === 0, parts: parts.map((p) => p.slice()), verdict };
      },
      dispose() {
        disposed = true;
        window.removeEventListener("message", onMessage);
        frame.remove();
      },
    };
  }

  window.DomSandbox = { load, setSources, open };
})();
