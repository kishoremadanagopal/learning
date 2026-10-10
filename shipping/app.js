/* Shipping software course: app logic (routing, rendering, editor, progress, JavaScript worker). */
(function () {
  "use strict";

  const COURSE = window.COURSE;
  const LESSONS = COURSE.lessons;
  const PARTS = COURSE.parts;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /* ---------- Storage (per-browser progress) ---------- */
  const KEY = "shipping-course:v1";
  let state = { passed: {}, quiz: {}, code: {}, last: null };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = Object.assign(state, JSON.parse(raw));
  } catch (e) { /* storage unavailable: progress lasts for this visit only */ }
  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
    }, 150);
  }

  const exKey = (lesson, i) => `${lesson.id}#${i}`;
  const lessonDone = (lesson) =>
    lesson.exercises.length > 0
      ? lesson.exercises.every((_, i) => state.passed[exKey(lesson, i)])
      : lesson.quiz.every((_, i) => state.quiz[`${lesson.id}#${i}`] !== undefined);
  const partLessons = (partId) => LESSONS.filter((l) => l.part === partId);

  /* ---------- Syntax highlighting ---------- */
  const KW = new Set("as async await break case catch class const continue debugger default delete do else export extends false finally for from function get if import in instanceof let new null of return set static super switch this throw true try typeof undefined var void while with yield interface type enum implements readonly keyof satisfies declare namespace abstract private protected public".split(" "));
  const BI = new Set("console Math JSON Object Array String Number Boolean BigInt Symbol Map Set WeakMap WeakSet Promise Date RegExp Error TypeError RangeError SyntaxError ReferenceError Temporal Intl Iterator parseInt parseFloat isNaN isFinite structuredClone setTimeout setInterval clearTimeout clearInterval fetch prompt test describe assert process require globalThis document window NaN Infinity string number boolean unknown never any void object".split(" "));
  const TOKEN_RE = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\[\s\S]|[^`\\])*`?)|(@[A-Za-z_][\w.]*)|(\b\d[\d_]*(?:\.[\d_]*)?(?:[eE][+-]?\d+)?n?\b|\b0[xXoObB][\da-fA-F_]+n?\b)|([A-Za-z_$][\w$]*)/g;
  function highlight(src) {
    let out = "", last = 0, prev = "";
    src.replace(TOKEN_RE, (m, com, str, dec, num, word, idx) => {
      out += esc(src.slice(last, idx));
      last = idx + m.length;
      if (com) out += `<span class="c">${esc(m)}</span>`;
      else if (str) out += `<span class="s">${esc(m)}</span>`;
      else if (dec) out += `<span class="d">${esc(m)}</span>`;
      else if (num) out += `<span class="n">${esc(m)}</span>`;
      else if (KW.has(word)) out += `<span class="k">${m}</span>`;
      else if (prev === "function" || prev === "class") out += `<span class="f">${m}</span>`;
      else if (BI.has(word)) out += `<span class="b">${m}</span>`;
      else out += esc(m);
      if (word) prev = word; else prev = "";
      return m;
    });
    return out + esc(src.slice(last));
  }

  // HTML: tags, attribute names and values, comments; JavaScript inside <script> uses the highlighter above.
  const HTML_RE = /<!--[\s\S]*?(?:-->|$)|<!doctype[^>]*>?|<(script|style)\b(?:"[^"]*"|'[^']*'|[^'">])*>|<\/?[A-Za-z][\w-]*(?:"[^"]*"?|'[^']*'?|[^'">])*>?/gi;
  const ATTR_RE = /^<\/?[\w-]+|("[^"]*"?|'[^']*'?)|([^\s"'=<>/]+)(?=\s*=)|\/?>$/g;
  function highlightTag(t) {
    let out = "", last = 0;
    t.replace(ATTR_RE, (m, str, attr, idx) => {
      out += esc(t.slice(last, idx));
      last = idx + m.length;
      out += `<span class="${str ? "s" : attr ? "f" : "k"}">${esc(m)}</span>`;
      return m;
    });
    return out + esc(t.slice(last));
  }
  function highlightHTML(src) {
    let out = "", last = 0, m;
    HTML_RE.lastIndex = 0;
    while ((m = HTML_RE.exec(src))) {
      out += esc(src.slice(last, m.index));
      out += m[0].startsWith("<!") ? `<span class="c">${esc(m[0])}</span>` : highlightTag(m[0]);
      last = HTML_RE.lastIndex;
      if (m[1]) {
        const rest = src.slice(last);
        const close = new RegExp(`</${m[1]}\\s*>`, "i").exec(rest);
        const body = close ? rest.slice(0, close.index) : rest;
        out += m[1].toLowerCase() === "script" ? highlight(body) : esc(body);
        last += body.length;
        HTML_RE.lastIndex = last;
      }
    }
    return out + esc(src.slice(last));
  }
  // Shell scripts: commands, options, strings, comments and here-document bodies.
  function highlightShell(src) {
    const lines = src.split("\n");
    let heredocEnd = null;
    return lines.map((line) => {
      if (heredocEnd !== null) {
        if (line === heredocEnd) { heredocEnd = null; return `<span class="k">${esc(line)}</span>`; }
        return `<span class="s">${esc(line)}</span>`;
      }
      const hd = /<<-?\s*(['"]?)([A-Za-z_]\w*)\1/.exec(line);
      if (hd) heredocEnd = hd[2];
      let out = "", atCommand = true;
      const re = /(#.*$)|("(?:\\.|[^"\\])*"?|'[^']*'?)|(&&|\|\||[|;]|<<-?|>>?|2>&1)|(\s+)|([^\s"'|;&<>#]+)/g;
      line.replace(re, (m, com, str, op, ws, word) => {
        if (com) out += `<span class="c">${esc(m)}</span>`;
        else if (str) out += `<span class="s">${esc(m)}</span>`;
        else if (op) { out += `<span class="d">${esc(m)}</span>`; if (op !== ">" && op !== ">>" && !op.startsWith("<<")) atCommand = true; }
        else if (ws) out += m;
        else if (atCommand) { out += `<span class="k">${esc(m)}</span>`; atCommand = m === "sudo"; }
        else if (/^--?[\w-]/.test(m)) out += `<span class="b">${esc(m)}</span>`;
        else out += esc(m);
        return m;
      });
      return out;
    }).join("\n");
  }
  // YAML, Dockerfiles, INI and similar config files: keys or instructions, strings and comments.
  function highlightConfig(src, lang) {
    return src.split("\n").map((line) => {
      if (/^\s*#/.test(line)) return `<span class="c">${esc(line)}</span>`;
      if (lang === "dockerfile") {
        const m = /^(\s*)([A-Z]+)(\s.*)?$/.exec(line);
        return m ? `${m[1]}<span class="k">${m[2]}</span>${esc(m[3] ?? "")}` : esc(line);
      }
      const m = /^(\s*-?\s*)([\w.@/-]+)(\s*[:=])(.*)$/.exec(line);
      if (m) return `${esc(m[1])}<span class="f">${esc(m[2])}</span>${esc(m[3])}${m[4].trim().startsWith("#") ? `<span class="c">${esc(m[4])}</span>` : /^\s*["']/.test(m[4]) ? `<span class="s">${esc(m[4])}</span>` : esc(m[4])}`;
      return esc(line);
    }).join("\n");
  }
  const highlightAs = (src, lang) => (lang === "html" ? highlightHTML(src) : lang === "sh" || lang === "bash" ? highlightShell(src)
    : ["yaml", "dockerfile", "ini", "toml", "properties"].includes(lang) ? highlightConfig(src, lang)
    : lang === "js" ? highlight(src) : lang === "text" || lang === "diff" || lang === "json" ? (lang === "json" ? highlight(src) : esc(src)) : highlight(src));

  /* ---------- Editor ---------- */
  const code = $("code"), hl = $("hl"), gutter = $("gutter"), view = $("view"), stdinBox = $("stdin");
  const runBtn = $("runBtn"), checkBtn = $("checkBtn"), resetBtn = $("resetBtn"), stopBtn = $("stopBtn");
  let pyReady = false;
  let ctx = { mode: "scratch", lang: "sh", setup: "" };   // or {mode:"example"} / {mode:"exercise", lesson, index}; lang is "sh" or "js"
  let currentView = "output";
  let outputHTML = '<span class="meta">Press Run on any example, or write your own code here.</span>';

  if (/Mac|iPhone|iPad/.test(navigator.platform)) $("kbd").textContent = "⌘ ↵";

  function refreshEditor() {
    hl.innerHTML = highlightAs(code.value, ctx.lang) + "\n";
    const n = code.value.split("\n").length;
    let g = "";
    for (let i = 1; i <= n; i++) g += i + "\n";
    gutter.textContent = g;
    syncScroll();
  }
  function syncScroll() {
    hl.scrollTop = code.scrollTop; hl.scrollLeft = code.scrollLeft; gutter.scrollTop = code.scrollTop;
  }
  function setCode(src) {
    code.value = src;
    code.scrollTop = 0;
    refreshEditor();
    if (currentView !== "output") renderView();
  }
  code.addEventListener("scroll", syncScroll);
  code.addEventListener("input", () => {
    refreshEditor();
    if (ctx.mode === "exercise") { state.code[exKey(ctx.lesson, ctx.index)] = code.value; save(); }
    if (currentView !== "output") renderView();
  });
  code.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (ctx.mode === "exercise" && e.shiftKey) doCheck(); else doRun();
      return;
    }
    const s = code.selectionStart, en = code.selectionEnd, v = code.value;
    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        const ls = v.lastIndexOf("\n", s - 1) + 1;
        const strip = v.slice(ls, ls + 2).match(/^ {1,2}/);
        if (strip) { code.setRangeText("", ls, ls + strip[0].length, "end"); code.selectionStart = code.selectionEnd = Math.max(ls, s - strip[0].length); }
      } else {
        code.setRangeText("  ", s, en, "end");
      }
      code.dispatchEvent(new Event("input"));
    } else if (e.key === "Enter" && !e.shiftKey) {
      const ls = v.lastIndexOf("\n", s - 1) + 1;
      const line = v.slice(ls, s);
      let indent = line.match(/^\s*/)[0];
      if (/[{[(]\s*(\/\/.*)?$/.test(line)) indent += "  ";
      else if (ctx.lang === "html" && /<(?!\/|!|(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)\b)[A-Za-z][^<>]*[^/]>\s*$/.test(line) && !/<\/[\w-]+>\s*$/.test(line)) indent += "  ";
      e.preventDefault();
      code.setRangeText("\n" + indent, s, en, "end");
      code.dispatchEvent(new Event("input"));
    }
  });

  function setIdeHeader(modeLabel, title) {
    $("ideMode").textContent = modeLabel;
    $("ideTitle").textContent = title;
    const isEx = ctx.mode === "exercise";
    checkBtn.hidden = !isEx;
    resetBtn.hidden = !isEx;
    setPageMode(ctx.lang === "html");
  }

  /* ---------- Page preview (HTML lessons): the page runs in a sandboxed iframe, see dom.js ---------- */
  let pageSession = null, pageBusy = false, pageVerdictHTML = "", renderQueued = false;
  function setPageMode(on) {
    $("ide").classList.toggle("page-mode", on);
    $("preview").hidden = !on;
    if (!on && pageSession) { pageSession.dispose(); pageSession = null; }
    if (on && !pageSession) $("previewHost").innerHTML = '<p class="meta" style="padding:12px 14px;margin:0;font:italic 13px var(--body)">Press Run to open your page here.</p>';
  }
  function livePageOutput(parts) {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      outputHTML = (renderResult({ parts }) || '<span class="meta">Console output from your page appears here.</span>') + pageVerdictHTML;
      if (currentView === "output") renderView();
    });
  }
  function openPage(src) {
    if (pageSession) pageSession.dispose();
    pageVerdictHTML = "";
    outputHTML = '<span class="meta">Console output from your page appears here.</span>';
    renderView();
    pageSession = window.DomSandbox.open($("previewHost"), src, livePageOutput);
    return pageSession;
  }
  async function pageReady() {
    try { await window.DomSandbox.load(window.BUILD); return true; } catch (e) {
      outputHTML = `<span class="err">The page preview couldn't start (${esc(e.message)}). Check your connection and reload.</span>`;
      renderView();
      return false;
    }
  }

  /* ---------- JavaScript engine (a Web Worker, so endless loops can be stopped) ---------- */
  const EMPTY = '<span class="meta">(no output)</span>';
  let worker = null, pending = null, jobNo = 0, resolveReady, readyPromise;
  function startWorker() {
    pyReady = false;
    readyPromise = new Promise((r) => { resolveReady = r; });
    $("status").classList.remove("ready", "fail");
    $("statusText").textContent = "Starting the terminal…";
    worker = new Worker("worker.js?v=" + (window.BUILD || "0"), { type: "module" });
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "ready") {
        pyReady = true;
        resolveReady();
        $("status").classList.add("ready");
        $("statusText").textContent = "Terminal ready";
      } else if (m.type === "loading") {
        busyLabel = `loading ${m.what || "packages"} (first time only)`;
      } else if (m.type === "result" && pending && pending.id === m.id) {
        const p = pending; pending = null; p.resolve(m.result);
      }
    };
    worker.onerror = () => {
      $("status").classList.add("fail");
      $("statusText").textContent = "The sandbox couldn't start. Please use an up-to-date browser and reload.";
    };
    worker.postMessage({ type: "init", files: (window.DATASETS || []).map((d) => d.name) });
  }
  function job(type, src, check, stdin, extra = {}) {
    return new Promise((resolve) => {
      const id = ++jobNo;
      pending = { id, resolve };
      worker.postMessage({ type, id, code: src, check, stdin, lang: ctx.lang, ...extra });
    });
  }
  stopBtn.addEventListener("click", () => {
    if (pageBusy && pageSession) {
      pageSession.dispose();
      pageSession = null;
      pageBusy = false;
      busy(false);
      $("timing").textContent = "stopped";
      $("previewHost").innerHTML = "";
      outputHTML = '<span class="err">Stopped. The page was closed; your code is still in the editor.</span>';
      renderView();
      return;
    }
    if (!pending) return;
    worker.terminate();
    const p = pending; pending = null;
    p.resolve({ ok: false, stopped: true, parts: [["err", "Stopped. The sandbox restarted; your code is still in the editor."]], figures: [] });
    startWorker();
  });

  /* ---------- Output and tabs ---------- */
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
    currentView = t.dataset.view;
    document.querySelectorAll(".tab").forEach((x) => x.setAttribute("aria-selected", x === t ? "true" : "false"));
    renderView();
  }));
  function selectOutputTab() {
    if (currentView !== "output") document.querySelector('.tab[data-view="output"]').click();
  }
  function renderView() {
    view.classList.toggle("out", currentView === "output");
    view.classList.toggle("term", ctx.lang === "sh");
    view.innerHTML = outputHTML;
    view.scrollTop = view.scrollHeight;
  }
  function renderResult(res) {
    // Git writes progress and success messages to stderr too, so colour stderr by what each line says:
    // errors in red, hints muted, everything else like normal output.
    const errLine = (line) => /^(fatal|error|bash|remote: error|ERROR|X |failed|Sandbox error|warning|Could not apply|aborted|must provide|unknown|could not|gh: )\b|^ ! |^(Usage|usage): /.test(line) ? "err"
      : /^hint:/.test(line) ? "hint" : "";
    const errText = (t) => t.split(/(?<=\n)/).map((line) => { const c = errLine(line); return c ? `<span class="${c}">${esc(line)}</span>` : esc(line); }).join("");
    let h = (res.parts || []).map(([k, t]) => k === "err" ? errText(t) : k === "cmd" ? `<span class="cmd">${esc(t)}</span>` : esc(t)).join("");
    (res.figures || []).forEach((f, i) => { h += `<img alt="Chart ${i + 1} drawn by your code" src="data:image/png;base64,${f}">`; });
    return h;
  }
  function fmtMs(ms) { return ms < 1000 ? `${ms.toFixed(0)} ms` : `${(ms / 1000).toFixed(2)} s`; }
  function setTiming(ok, ms, label) {
    $("timing").innerHTML = `<span class="dot" style="background:var(${ok ? "--ok" : "--err"})"></span>${label} · ${fmtMs(ms)}`;
  }

  let busyTimer = null, busyLabel = "running";
  function busy(on, label) {
    runBtn.disabled = on;
    checkBtn.disabled = on;
    stopBtn.hidden = !on;
    clearInterval(busyTimer);
    if (on) {
      busyLabel = label || "running";
      const t0 = performance.now();
      const tick = () => { $("timing").textContent = `${busyLabel}… ${Math.floor((performance.now() - t0) / 1000)}s`; };
      tick();
      busyTimer = setInterval(tick, 500);
    }
  }
  function showStdin(text) {
    stdinBox.value = text || "";
    $("stdinRow").hidden = !text;
  }

  async function runPage() {
    if (pageBusy) return;
    pageBusy = true;
    selectOutputTab();
    openSheet();
    busy(true, "loading page");
    const t0 = performance.now();
    if (await pageReady()) {
      const s = openPage(code.value);
      const res = await s.result(0);
      if (s !== pageSession) return;      // stopped, or replaced by a newer run
      setTiming(res.ok, performance.now() - t0, res.ok ? "page loaded" : "error");
    }
    busy(false);
    pageBusy = false;
  }

  async function checkPage(lesson, i, ex) {
    if (pageBusy) return;
    pageBusy = true;
    selectOutputTab();
    openSheet();
    busy(true, "checking");
    const t0 = performance.now();
    let v = { ok: false, msg: "The page preview couldn't start." };
    if (await pageReady()) {
      const s = openPage(code.value);
      const res = await s.check(ex.check);
      if (s !== pageSession) return;
      v = res.verdict;
    }
    pageBusy = false;
    finishCheck(lesson, i, ex, v, t0, (renderResult({ parts: pageSession ? pageSession.parts : [] })));
  }

  async function doRun() {
    if (ctx.lang === "html") return runPage();
    if (pending) return;
    selectOutputTab();
    openSheet();
    busy(true, pyReady ? "running" : "starting");
    if (!pyReady) { outputHTML = '<span class="meta">The sandbox is starting. Your code will run in a moment.</span>'; renderView(); }
    await readyPromise;
    busyLabel = "running";
    const t0 = performance.now();
    const res = await job("run", code.value, null, stdinBox.value, { setup: ctx.setup || "" });
    outputHTML = renderResult(res) || EMPTY;
    setTiming(res.ok, performance.now() - t0, res.stopped ? "stopped" : res.ok ? "ok" : "error");
    busy(false);
    renderView();
  }

  async function doCheck() {
    if (pending || ctx.mode !== "exercise") return;
    const lesson = ctx.lesson, i = ctx.index, ex = lesson.exercises[i];
    if (ex.lang === "html") return checkPage(lesson, i, ex);
    selectOutputTab();
    openSheet();
    busy(true, pyReady ? "checking" : "starting");
    await readyPromise;
    busyLabel = "checking";
    const t0 = performance.now();
    const res = await job("check", code.value, ex.check, ex.stdin || stdinBox.value, { setup: ex.setup || "" });
    const v = res.verdict || { ok: false, msg: res.stopped ? "Stopped before the checks finished." : "The checker couldn't run." };
    finishCheck(lesson, i, ex, v, t0, renderResult(res));
  }

  function finishCheck(lesson, i, ex, v, t0, shownHTML) {
    const before = lessonDone(lesson);
    if (v.ok) { state.passed[exKey(lesson, i)] = true; save(); }
    let verdict = v.ok ? "✓ All checks passed. Nice work!" : "✗ " + v.msg;
    if (!v.ok && (ex.approach || ex.hints.length)) verdict += "\n\nStuck? On the exercise card, open 🧭 Approach, then the 💡 hints one at a time.";
    if (v.ok && !before && lessonDone(lesson)) verdict += "\nLesson complete.";
    const verdictHTML = `<span class="verdict ${v.ok ? "pass" : "fail"}">${esc(verdict)}</span>`;
    if (ex.lang === "html") pageVerdictHTML = verdictHTML;
    outputHTML = shownHTML + verdictHTML;
    setTiming(v.ok, performance.now() - t0, v.ok ? "passed" : "not yet");
    busy(false);
    renderView();
    updateExerciseCard(lesson, i);
    renderNav();
  }

  runBtn.addEventListener("click", doRun);
  checkBtn.addEventListener("click", doCheck);
  resetBtn.addEventListener("click", () => {
    if (ctx.mode !== "exercise") return;
    const ex = ctx.lesson.exercises[ctx.index];
    delete state.code[exKey(ctx.lesson, ctx.index)];
    save();
    setCode(ex.starter);
    outputHTML = '<span class="meta">Starter code restored.</span>';
    renderView();
  });

  /* ---------- Mobile sheet and nav drawer ---------- */
  const mqSheet = window.matchMedia ? window.matchMedia("(max-width: 759px)") : { matches: false };
  function openSheet() { if (mqSheet.matches) document.body.classList.add("sheet-open"); updateSheetBtn(); }
  function updateSheetBtn() { $("sheetBtn").textContent = document.body.classList.contains("sheet-open") ? "▼" : "▲"; }
  $("sheetBtn").addEventListener("click", () => { document.body.classList.toggle("sheet-open"); updateSheetBtn(); });
  $("menuBtn").addEventListener("click", () => document.body.classList.add("nav-open"));
  $("scrim").addEventListener("click", () => document.body.classList.remove("nav-open"));

  /* ---------- Navigation ---------- */
  function renderNav(activeId) {
    activeId = activeId || (ctx.page || null);
    const done = LESSONS.filter(lessonDone).length;
    $("progressText").textContent = `${done} of ${LESSONS.length} lessons`;
    $("progressBar").style.width = `${(done / LESSONS.length) * 100}%`;
    let n = 0;
    $("navList").innerHTML = PARTS.map((p) => {
      const ls = partLessons(p.id);
      const d = ls.filter(lessonDone).length;
      return `<div class="nav-part"><h3>${esc(p.title)}<span>${d}/${ls.length}</span></h3>` +
        ls.map((l) => {
          n++;
          const isDone = lessonDone(l);
          return `<a class="nav-link${isDone ? " done" : ""}" href="#${l.id}"${l.id === activeId ? ' aria-current="page"' : ""}>` +
            `<span class="nav-num">${isDone ? "✓" : n}</span><span>${esc(l.title)}</span></a>`;
        }).join("") + `</div>`;
    }).join("");
  }

  /* ---------- Pages ---------- */
  const page = $("page");

  function renderHome() {
    ctx.page = "home";
    $("crumb").innerHTML = "Course home";
    const done = LESSONS.filter(lessonDone).length;
    const nEx = LESSONS.reduce((a, l) => a + l.exercises.length, 0);
    const nQ = LESSONS.reduce((a, l) => a + l.quiz.length, 0);
    const nRun = LESSONS.reduce((a, l) => a + l.examples.length, 0);
    const next = LESSONS.find((l) => !lessonDone(l)) || LESSONS[0];
    const resume = state.last && LESSONS.find((l) => l.id === state.last);
    const target = resume && !lessonDone(resume) ? resume : next;
    let n = 0;
    page.innerHTML = `
      <section class="hero">
        <span class="eyebrow">Git · CI/CD · Docker · Kafka · Kubernetes · Cloud · Observability</span>
        <h1>From your laptop to <em>production</em>.</h1>
        <p>How code gets from your computer to users, and stays healthy there: Git and GitHub, CI/CD, Docker, Kafka, Kubernetes, the cloud and observability. Type real commands in a terminal that runs in your browser; your work is checked automatically, and when you're stuck you get an approach, hints and a full walkthrough.</p>
        <div class="stats"><span><b>${PARTS.length}</b> ${PARTS.length === 1 ? "part" : "parts"}</span><span><b>${LESSONS.length}</b> lessons</span><span><b>${nRun}</b> runnable examples</span><span><b>${nEx}</b> auto-checked exercises</span><span><b>${nQ}</b> quiz questions</span></div>
        <div class="cta-row">
          <a class="btn-primary" href="#${target.id}">${done || resume ? "Continue" : "Start"}: ${esc(target.title)} →</a>
          <a class="btn-ghost" href="#version-control">What is version control?</a>
        </div>
      </section>
      <section class="how">
        <div><b>Read and run</b><span>Press Run on any example to load it into the editor, then change it and run it again.</span></div>
        <div><b>Practise</b><span>Press Check and the sandbox inspects what your commands did: commits, branches, files and settings.</span></div>
        <div><b>Stuck?</b><span>Each exercise has a step-by-step approach, three hints and a full walkthrough with a trace of the code running.</span></div>
      </section>
      <section class="parts">
        ${PARTS.map((p) => {
          const ls = partLessons(p.id);
          const d = ls.filter(lessonDone).length;
          return `<article class="part-card">
            <div class="part-top"><span class="part-no">Part ${p.id}</span><h2>${esc(p.title)}</h2><span class="chip lvl-${esc(p.level)}">${esc(p.level)}</span><span class="part-prog">${d}/${ls.length} done</span></div>
            <p>${esc(p.blurb)}</p>
            <ol class="part-lessons">${ls.map((l) => { n++; const isDone = lessonDone(l); return `<li class="${isDone ? "done" : ""}"><a href="#${l.id}"><span class="tick">${isDone ? "✓" : n}</span><span>${esc(l.title)}</span></a></li>`; }).join("")}</ol>
          </article>`;
        }).join("")}
      </section>`;
    renderNav("home");
  }

  function renderLesson(lesson) {
    ctx.page = lesson.id;
    state.last = lesson.id; save();
    const idx = LESSONS.indexOf(lesson);
    const part = PARTS.find((p) => p.id === lesson.part);
    const prev = LESSONS[idx - 1], next = LESSONS[idx + 1];
    $("crumb").innerHTML = `<a href="#home">Home</a> / Part ${part.id}: ${esc(part.title)} / ${esc(lesson.title)}`;

    let html = `<header class="lesson-head">
        <div class="lesson-meta"><span>Lesson ${idx + 1} of ${LESSONS.length}</span><span class="chip lvl-${esc(part.level)}">${esc(part.level)}</span><span>About ${lesson.minutes} min</span></div>
        <h1>${esc(lesson.title)}</h1>
        <p>${esc(lesson.summary)}</p>
      </header>
      <section class="terms" aria-label="Key terms"><h2>Key terms</h2><ul>${lesson.terms.map((t) => `<li>${t}</li>`).join("")}</ul></section>
      <div class="prose">${lesson.html}</div>
      <section class="glance"><h2 class="section-title">At a glance</h2><div class="table-wrap"><table><thead><tr><th>Task</th><th>Command</th><th>What it changes</th><th>How to undo</th></tr></thead><tbody>${lesson.glance.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>
      <section class="mistakes"><h2 class="section-title">Common mistakes</h2><ul>${lesson.mistakes.map((m) => `<li>${m}</li>`).join("")}</ul></section>`;

    if (lesson.exercises.length) {
      const nums = lesson.exercises.map((e) => e.number);
      html += `<h2 class="section-title">Exercises <small>${nums.length > 1 ? `${nums[0]}–${nums[nums.length - 1]}` : nums[0]} · complete ${nums.length > 1 ? "them" : "it"} to finish this lesson</small></h2>`;
      lesson.exercises.forEach((ex, i) => {
        html += `<article class="exercise" id="ex-${i}" data-i="${i}">
          <div class="ex-head"><h4><span class="ex-num">Exercise ${ex.number}</span>${esc(ex.title)}</h4><span class="status-pill"></span></div>
          <div class="ex-body prose">${ex.prompt}</div>
          <div class="ex-actions">
            <button class="run-btn" data-act="open" type="button">Open in editor</button>
            ${ex.approach ? '<button class="mini-btn" data-act="approach" type="button">🧭 Approach</button>' : ""}
            ${ex.hints.length ? `<button class="mini-btn" data-act="hint" type="button">💡 Hint 1 of ${ex.hints.length}</button>` : ""}
            <button class="mini-btn" data-act="solution" type="button">✅ Walkthrough</button>
          </div>
          <div class="reveal" data-slot hidden></div>
        </article>`;
      });
    }
    if (lesson.quiz.length) {
      html += `<h2 class="section-title">Quick quiz <small>${lesson.quiz.length} questions</small></h2><div class="quiz">`;
      lesson.quiz.forEach((q, qi) => {
        html += `<div class="q" data-q="${qi}"><div class="q-text">${qi + 1}. ${q.q}</div><div class="q-opts">` +
          q.options.map((o, oi) => `<button class="q-opt" type="button" data-o="${oi}"><span class="key">${"ABCD"[oi]}</span><span>${o}</span></button>`).join("") +
          `</div><div class="q-explain" hidden></div></div>`;
      });
      html += `</div>`;
    }
    html += `<nav class="pager">
      ${prev ? `<a href="#${prev.id}"><small>← Previous</small>${esc(prev.title)}</a>` : `<a href="#home"><small>←</small>Course home</a>`}
      ${next ? `<a class="next" href="#${next.id}"><small>Next →</small>${esc(next.title)}</a>` : `<a class="next" href="#home"><small>Finished</small>Back to course home</a>`}
    </nav>`;
    page.innerHTML = html;

    // Examples
    page.querySelectorAll(".example").forEach((el) => {
      const ex = lesson.examples[+el.dataset.ex];
      const kind = ex.lang === "sh" ? "Terminal" : "Example";
      const tag = ex.error ? `<span class="tag warn">${kind} · raises an error</span>` : `<span class="tag">${kind}</span>`;
      el.outerHTML = `<div class="codeblock" data-ex="${el.dataset.ex}">
        <div class="codeblock-bar">${tag}${ex.stdin ? '<span class="tag">uses input</span>' : ""}<button class="run-btn" type="button" data-act="run">▶ Run</button></div>
        <pre>${highlightAs(ex.code, ex.lang)}</pre></div>`;
    });
    page.querySelectorAll("pre.plain").forEach((el) => { el.innerHTML = highlightAs(el.textContent, el.dataset.lang); });

    page.querySelectorAll(".codeblock .run-btn").forEach((btn) => btn.addEventListener("click", () => {
      const ex = lesson.examples[+btn.closest(".codeblock").dataset.ex];
      ctx = { mode: "example", page: lesson.id, lang: ex.lang, setup: ex.setup || "" };
      clearActiveExercise();
      setIdeHeader(ex.lang === "sh" ? (ex.setupName ? `Terminal example · starts from: ${ex.setupName}` : "Terminal example") : "Example", lesson.title);
      setCode(ex.code);
      showStdin(ex.stdin);
      doRun();
    }));

    // Exercises
    lesson.exercises.forEach((ex, i) => updateExerciseCard(lesson, i));
    page.querySelectorAll(".exercise").forEach((card) => {
      const i = +card.dataset.i, ex = lesson.exercises[i];
      const slot = card.querySelector("[data-slot]");
      card.addEventListener("click", (e) => {
        const act = e.target.closest("[data-act]");
        if (!act) return;
        const a = act.dataset.act;
        if (a === "open") openExercise(lesson, i);
        else if (a === "approach") {
          if (slot.dataset.kind === "approach" && !slot.hidden) { slot.hidden = true; return; }
          slot.dataset.kind = "approach";
          slot.innerHTML = `<b>🧭 How to approach it</b><div class="prose">${ex.approach}</div>`;
          highlightPanel(slot);
          slot.hidden = false;
        } else if (a === "hint") {
          const shown = slot.dataset.kind === "hint" && !slot.hidden ? +slot.dataset.hints : 0;
          const k = Math.min(shown + 1, ex.hints.length);
          slot.dataset.kind = "hint";
          slot.dataset.hints = k;
          slot.innerHTML = ex.hints.slice(0, k).map((h, j) => `<div class="hint-step"><b>💡 Hint ${j + 1}</b>${h}</div>`).join("") +
            (k < ex.hints.length ? "" : `<p class="meta-note">That's every hint. Still stuck? Open the walkthrough, then solve it again later without looking.</p>`);
          act.textContent = k < ex.hints.length ? `💡 Hint ${k + 1} of ${ex.hints.length}` : "💡 All hints shown";
          slot.hidden = false;
        } else if (a === "solution") {
          if (slot.dataset.kind === "solution" && !slot.hidden) { slot.hidden = true; return; }
          slot.dataset.kind = "confirm";
          slot.innerHTML = `<p>Have you tried the approach and the hints? The walkthrough shows the full solution and explains every line. Looking is fine after a real attempt: then close it and write the solution again yourself.</p>
            <div class="reveal-actions"><button class="mini-btn" data-act="show-solution" type="button">Show the walkthrough</button><button class="mini-btn" data-act="close" type="button">Keep trying</button></div>`;
          slot.hidden = false;
        } else if (a === "show-solution") {
          slot.dataset.kind = "solution";
          slot.innerHTML = `<b>✅ Solution</b><pre>${highlightAs(ex.solution, ex.lang)}</pre>
            ${ex.walkthrough ? `<div class="walkthrough prose">${ex.walkthrough}</div>` : ""}
            <div class="reveal-actions"><button class="mini-btn" data-act="load-solution" type="button">Load into editor</button></div>`;
          highlightPanel(slot);
        } else if (a === "load-solution") {
          openExercise(lesson, i, ex.solution);
        } else if (a === "close") {
          slot.hidden = true;
        }
      });
    });

    // Quiz
    page.querySelectorAll(".q").forEach((qel) => {
      const qi = +qel.dataset.q, q = lesson.quiz[qi];
      const key = `${lesson.id}#${qi}`;
      const show = (chosen) => {
        qel.querySelectorAll(".q-opt").forEach((b, oi) => {
          b.disabled = true;
          if (oi === q.answer) b.classList.add("right");
          else if (oi === chosen) b.classList.add("wrong");
        });
        const ex = qel.querySelector(".q-explain");
        ex.innerHTML = `<b>${chosen === q.answer ? "Correct." : "Not quite."}</b> ${q.explain}`;
        ex.hidden = false;
      };
      if (state.quiz[key] !== undefined) show(state.quiz[key]);
      qel.querySelectorAll(".q-opt").forEach((b) => b.addEventListener("click", () => {
        if (state.quiz[key] !== undefined) return;
        state.quiz[key] = +b.dataset.o; save();
        show(+b.dataset.o);
        renderNav(lesson.id);
      }));
    });

    if (ctx.mode === "exercise" && ctx.lesson === lesson) markActiveExercise(ctx.index);
    renderNav(lesson.id);
  }

  function highlightPanel(el) { el.querySelectorAll("pre.plain").forEach((p) => { p.innerHTML = highlightAs(p.textContent, p.dataset.lang); }); }

  function updateExerciseCard(lesson, i) {
    const card = document.getElementById(`ex-${i}`);
    if (!card || ctx.page !== lesson.id) return;
    const passed = !!state.passed[exKey(lesson, i)];
    card.classList.toggle("passed", passed);
    card.querySelector(".status-pill").textContent = passed ? "✓ Passed" : "Not yet";
  }
  function clearActiveExercise() { document.querySelectorAll(".exercise.active").forEach((c) => c.classList.remove("active")); }
  function markActiveExercise(i) {
    clearActiveExercise();
    const card = document.getElementById(`ex-${i}`);
    if (card) card.classList.add("active");
  }

  function openExercise(lesson, i, overrideCode) {
    const ex = lesson.exercises[i];
    ctx = { mode: "exercise", lesson, index: i, page: lesson.id, lang: ex.lang || "sh", setup: ex.setup || "" };
    setIdeHeader(`Exercise ${ex.number}`, ex.title);
    const saved = state.code[exKey(lesson, i)];
    const src = overrideCode != null ? overrideCode : (saved != null ? saved : ex.starter);
    setCode(src);
    if (overrideCode != null) { state.code[exKey(lesson, i)] = overrideCode; save(); }
    showStdin(ex.stdin);
    outputHTML = `<span class="meta">Write your answer, then press Check${navigator.platform.includes("Mac") ? " (⌘⇧↵)" : " (Ctrl+Shift+Enter)"}.\nRun just runs your code; Check runs it against the tests.</span>`;
    $("timing").textContent = "";
    selectOutputTab();
    renderView();
    markActiveExercise(i);
    openSheet();
    if (!mqSheet.matches) code.focus();
  }

  /* ---------- Router ---------- */
  function route() {
    const id = decodeURIComponent(location.hash.replace(/^#/, ""));
    document.body.classList.remove("nav-open");
    const lesson = LESSONS.find((l) => l.id === id);
    if (lesson) renderLesson(lesson); else renderHome();
    $("main").scrollTop = 0;
  }
  window.addEventListener("hashchange", route);

  /* ---------- Start ---------- */
  setIdeHeader("Scratchpad", "terminal");
  setCode("# Your terminal scratchpad: one command per line, then press Run.\n# Everything starts fresh on each run.\npwd\nmkdir demo && cd demo\ngit init\necho \"hello\" > hello.txt\ngit status\n");
  renderView();
  route();
  startWorker();
})();
