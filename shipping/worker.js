/* A module Web Worker that runs the sandbox's commands off the main thread, so a long or stuck run never freezes
   the page and Stop can end it. The same shell.js and runner.js are used by the Node.js test harness. */
const loading = import("./runner.js" + self.location.search);   // versioned like the page's other files
const shellLoading = import("./shell.js" + self.location.search);

self.addEventListener("unhandledrejection", async (e) => { e.preventDefault(); (await loading).reportUnhandled(e.reason); });
self.addEventListener("error", async (e) => { e.preventDefault(); (await loading).reportUnhandled(e.error || new Error(e.message)); });

self.onmessage = async (e) => {
  const msg = e.data;
  let R, S;
  try {
    [R, S] = await Promise.all([loading, shellLoading]);
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
    if (msg.lang === "sh") {
      result = msg.type === "check"
        ? await S.checkShell(msg.code, msg.check || "", { setup: msg.setup || "" })
        : await S.runShell(msg.code, { setup: msg.setup || "" });
      delete result.shell;
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
