/* A module Web Worker that runs Python (Pyodide) off the main thread, so long runs never freeze the page and Stop can end them. */
import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs";
const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/";

let py = null;

async function start(files, torchFiles) {
  py = await loadPyodide({ indexURL: PYODIDE });
  // The course's PyTorch is a pure-Python package on NumPy: load NumPy, then write the package into Python's files.
  const loadNumpy = py.loadPackage("numpy");
  await Promise.all(torchFiles.map(async (name) => {
    const text = await (await fetch(name + self.location.search)).text();
    const dir = "/home/pyodide/" + name.split("/").slice(0, -1).join("/");
    py.FS.mkdirTree(dir);
    py.FS.writeFile("/home/pyodide/" + name, text);
  }));
  await loadNumpy;
  py.FS.mkdirTree("/home/pyodide/work");
  py.FS.chdir("/home/pyodide/work");
  const runnerSrc = await (await fetch("runner.py" + self.location.search)).text();
  py.FS.writeFile("/home/pyodide/runner.py", runnerSrc);
  const data = {};
  await Promise.all(files.map(async (name) => {
    const buf = await (await fetch("data/" + name + self.location.search)).arrayBuffer();
    data[name] = new Uint8Array(buf);
  }));
  py.globals.set("_files", py.toPy(data));
  await py.runPythonAsync(`
import sys
sys.path.insert(0, "/home/pyodide")
import runner, json
import torch
runner.setup({k: bytes(v) for k, v in _files.items()})
del _files
`);
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === "init") {
      await start(msg.files, msg.torch || []);
      self.postMessage({ type: "ready" });
      return;
    }
    // Load numpy, matplotlib... only if the code imports them.
    let loading = false;
    await py.loadPackagesFromImports(msg.code + "\n" + (msg.check || ""), {
      messageCallback: () => { if (!loading) { loading = true; self.postMessage({ type: "loading", id: msg.id }); } },
    });
    py.globals.set("_src", msg.code);
    py.globals.set("_check", msg.check || "");
    py.globals.set("_stdin", msg.stdin || "");
    const out = py.runPython(msg.type === "check"
      ? "json.dumps(runner.check(_src, _check, _stdin))"
      : "json.dumps(runner.run(_src, _stdin))");
    self.postMessage({ type: "result", id: msg.id, result: JSON.parse(out) });
  } catch (err) {
    const text = String(err && err.message || err);
    // A JavaScript stack overflow kills Python for good; the page restarts the worker when it sees fatal: true.
    const fatal = /fatally failed|Maximum call stack size exceeded|fatal error/i.test(text);
    const parts = fatal
      ? [["err", "Python ran out of stack space and is restarting. In the browser this can happen with very deep recursion " +
                 "or when Python frees a very long chain of objects (a linked list or a tree thousands of levels deep). " +
                 "Try a smaller input or a loop instead of recursion. Your code is still in the editor."]]
      : [["err", text]];
    self.postMessage({ type: "result", id: msg.id, result: { ok: false, fatal, parts, figures: [] } });
  }
};
