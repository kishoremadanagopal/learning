/* The page-preview prelude. dom.js puts this file, together with runner.js (its `export`s removed), inside one
   function and runs it at the very top of the learner's page, in a sandboxed iframe, before any of the page's
   own scripts. It gives the page:
     - a console whose output is shown in the Output panel (the same formatting as the JavaScript lessons)
     - the pretend shop API for fetch("https://shop.example/api/...")
     - alert / confirm / prompt that write to the Output panel instead of opening a dialog
     - error reports with the line number in the learner's file, and the same hints as the JavaScript lessons
     - a guard against forms reloading the page and links leaving it
   and runs exercise checks inside the page when the sandbox asks for them.

   It runs with these values in scope: __CFG ({ token, src }) and everything defined in runner.js. */

const CFG = __CFG;
const parentWindow = window.parent;
const send = (msg) => parentWindow.postMessage(Object.assign({ __domSandbox: CFG.token }, msg), "*");
const realSetTimeout = window.setTimeout.bind(window);
const realClearTimeout = window.clearTimeout.bind(window);
const tick = (ms = 0) => new Promise((resolve) => realSetTimeout(resolve, ms));

const pageParts = [];
const pageEnv = makeEnv(pageParts, "", (kind, text) => send({ type: "out", kind, text }));
let pageErrors = 0;

// console, fetch and the dialogs
window.console = pageEnv.console;
window.fetch = makeFakeShop((fn, ms) => {
  const id = realSetTimeout(fn, ms);
  return { cancel: () => realClearTimeout(id) };
}, window.fetch.bind(window));
window.alert = (message = "") => { pageEnv.push("out", `[alert] ${message}\n`); };
window.confirm = (message = "") => { pageEnv.push("out", `[confirm] ${message} → OK (the preview always answers OK)\n`); return true; };
window.prompt = (message = "", value = "") => {
  pageEnv.push("out", `[prompt] ${message} → ${value === "" ? "(empty)" : value} (the preview can't ask, so it answers with the default)\n`);
  return String(value);
};

// Errors: report them with the line in the learner's file (this prelude adds no lines before it).
function lineOf(error, lineno) {
  const m = /about:srcdoc:(\d+):\d+/.exec(String((error && error.stack) || ""));
  return m ? Number(m[1]) : lineno || null;
}
function pageError(text) {
  pageErrors++;
  send({ type: "error" });
  pageEnv.push("err", text + "\n");
}
window.addEventListener("error", (e) => {
  const error = e.error != null ? e.error : new Error(String(e.message || "Unknown error").replace(/^Uncaught (\w*Error: )?/, ""));
  pageError(report(error, CFG.src, lineOf(e.error, e.lineno)));
});
window.addEventListener("unhandledrejection", (e) => {
  e.preventDefault();
  const r = e.reason;
  pageError("Uncaught (in promise) " + report(r, CFG.src, r instanceof Error ? lineOf(r) : null));
});

// A real form submit reloads the page, and a link leaves it: both would wipe the preview, so stop them and say why.
window.addEventListener("submit", (e) => {
  if (e.defaultPrevented) return;
  e.preventDefault();
  pageEnv.push("err", "(The form was submitted and a real page would reload now, losing everything on it. " +
    "The preview stopped the reload. Call event.preventDefault() in your submit handler.)\n");
});
window.addEventListener("click", (e) => {
  const a = e.target instanceof Element && e.target.closest("a[href]");
  if (!a || e.defaultPrevented || a.getAttribute("href").startsWith("#")) return;
  e.preventDefault();
  pageEnv.push("out", `(Link to ${a.getAttribute("href")}: links don't leave the preview.)\n`);
});

window.addEventListener("load", () => {
  realSetTimeout(() => send({ type: "loaded", errors: pageErrors }), 0);
});

// Helpers that exercise checks use to read and drive the page, like a person would.
function domHelpers() {
  const isElement = (v) => v && typeof v === "object" && v.nodeType === 1;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  function pick(target, what) {
    if (isElement(target)) return target;
    const el = document.querySelector(target);
    if (!el) throw new AssertionError(`Your page needs ${what || `an element matching \`${target}\``}.`);
    return el;
  }
  const text = (target) => {
    const el = isElement(target) ? target : document.querySelector(target);
    return el ? el.textContent.replace(/\s+/g, " ").trim() : null;
  };
  async function click(target, what) {
    pick(target, what).click();
    await tick();
  }
  async function type(target, value, what) {
    const el = pick(target, what);
    if (el.focus) el.focus();
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await tick();
  }
  async function submit(target = "form", what) {
    const el = pick(target, what || "a <form>");
    const form = el.tagName === "FORM" ? el : el.form;
    if (!form) throw new AssertionError("That element isn't inside a <form>.");
    form.requestSubmit();
    await tick();
  }
  async function waitFor(fn, what = "the page to update", ms = 3000) {
    const t0 = performance.now();
    for (;;) {
      let v;
      try { v = fn(); } catch { v = false; }
      if (v) return v;
      if (performance.now() - t0 > ms) throw new AssertionError(`Waited ${ms / 1000} s for ${what}, but it didn't happen.`);
      await tick(20);
    }
  }
  const settle = (ms = 100) => tick(ms);
  return { $, $$, pick, text, click, type, submit, waitFor, settle };
}

window.addEventListener("message", async (e) => {
  const m = e.data;
  if (e.source !== parentWindow || !m || m.__domSandbox !== CFG.token || m.type !== "check") return;
  e.stopImmediatePropagation();
  if (pageErrors) {
    send({ type: "verdict", verdict: { ok: false, msg: "Your page raised an error (see above). Fix it and check again." } });
    return;
  }
  const pending = [];
  const output = () => pageParts.filter((p) => p[0] === "out").map((p) => p[1]).join("");
  const helpers = Object.assign(makeHelpers((name) => (0, eval)(name), output, CFG.src, pending), domHelpers());
  const names = Object.keys(helpers);
  let verdict;
  try {
    const fn = new AsyncFunction(...names, "AssertionError", `"use strict";\n${m.code}`);
    await withLimit(fn(...names.map((n) => helpers[n]), AssertionError), 15000, "The checks took longer than 15 s.");
    await Promise.all(pending);
    await tick(20);
    verdict = pageErrors
      ? { ok: false, msg: "Your page raised an error while the checks were using it (see above)." }
      : { ok: true, msg: "All checks passed." };
  } catch (err) {
    verdict = err instanceof AssertionError || (err && err.name === "AssertionError")
      ? { ok: false, msg: err.message || "One of the checks failed." }
      : { ok: false, msg: `Checking stopped with ${err && err.name}: ${err && err.message}` };
  }
  send({ type: "verdict", verdict });
});
