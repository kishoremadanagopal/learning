/* Pocket Python Course: app logic (routing, rendering, editor, progress). */
(function () {
  "use strict";

  const COURSE = window.COURSE;
  const LESSONS = COURSE.lessons;
  const PARTS = COURSE.parts;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /* ---------- Storage (per-browser progress) ---------- */
  const KEY = "pocket-python-course:v1";
  let state = { passed: {}, quiz: {}, code: {}, last: null, quizOrder: 2 };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.quizOrder !== 2 && saved.quiz) {
        // Quiz options used to appear in the order they were written; map saved answers to the shuffled order.
        const remapped = {};
        for (const [key, chosen] of Object.entries(saved.quiz)) {
          const [id, qi] = key.split("#");
          const l = LESSONS.find((x) => x.id === id), q = l && l.quiz[+qi];
          if (q && q.order && q.order.indexOf(chosen) >= 0) remapped[key] = q.order.indexOf(chosen);
        }
        saved.quiz = remapped;
      }
      state = Object.assign(state, saved, { quizOrder: 2 });
    }
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
  const KW = new Set("False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case".split(" "));
  const BI = new Set("print len range input int str float list dict set tuple bool sum min max abs sorted enumerate zip map filter open isinstance issubclass type super object repr round any all iter next reversed format hash id ord chr divmod pow vars dir getattr setattr hasattr callable Exception ValueError TypeError KeyError IndexError ZeroDivisionError StopIteration AssertionError RuntimeError NotImplementedError self cls".split(" "));
  const TOKEN_RE = /(#[^\n]*)|([rbfuRBFU]{0,2}(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?))|(@[A-Za-z_][\w.]*)|(\b\d[\d_]*(?:\.[\d_]*)?(?:[eE][+-]?\d+)?j?\b|\b0[xXoObB][\da-fA-F_]+\b)|([A-Za-z_]\w*)/g;
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
      else if (prev === "def" || prev === "class") out += `<span class="f">${m}</span>`;
      else if (BI.has(word)) out += `<span class="b">${m}</span>`;
      else out += esc(m);
      if (word) prev = word; else prev = "";
      return m;
    });
    return out + esc(src.slice(last));
  }

  /* ---------- Editor ---------- */
  const code = $("code"), hl = $("hl"), gutter = $("gutter"), view = $("view"), stdinBox = $("stdin");
  const runBtn = $("runBtn"), checkBtn = $("checkBtn"), resetBtn = $("resetBtn");
  let pyReady = false;
  let ctx = { mode: "scratch" };          // or {mode:"example"} / {mode:"exercise", lesson, index}
  let currentView = "output";
  let outputHTML = '<span class="meta">Press Run on any example, or write your own code here.</span>';

  if (/Mac|iPhone|iPad/.test(navigator.platform)) $("kbd").textContent = "⌘ ↵";

  function refreshEditor() {
    hl.innerHTML = highlight(code.value) + "\n";
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
        const strip = v.slice(ls, ls + 4).match(/^ {1,4}/);
        if (strip) { code.setRangeText("", ls, ls + strip[0].length, "end"); code.selectionStart = code.selectionEnd = Math.max(ls, s - strip[0].length); }
      } else {
        code.setRangeText("    ", s, en, "end");
      }
      code.dispatchEvent(new Event("input"));
    } else if (e.key === "Enter" && !e.shiftKey) {
      const ls = v.lastIndexOf("\n", s - 1) + 1;
      const line = v.slice(ls, s);
      let indent = line.match(/^\s*/)[0];
      if (/:\s*(#.*)?$/.test(line)) indent += "    ";
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
  }

  /* ---------- Output and tabs ---------- */
  const EMPTY = '<span class="meta">(no output)</span>';
  let buffer = "";
  window.pyEmit = (kind, s) => {
    buffer += kind === "err" ? `<span class="err">${esc(s)}</span>` : esc(s);
  };
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
    currentView = t.dataset.view;
    document.querySelectorAll(".tab").forEach((x) => x.setAttribute("aria-selected", x === t ? "true" : "false"));
    renderView();
  }));
  function selectOutputTab() {
    if (currentView !== "output") document.querySelector('.tab[data-view="output"]').click();
  }
  function renderView() {
    view.classList.toggle("code", currentView !== "output");
    if (currentView === "output") { view.innerHTML = outputHTML; view.scrollTop = view.scrollHeight; return; }
    if (!pyReady) { view.innerHTML = '<span class="meta">Python is still loading…</span>'; return; }
    try {
      if (currentView === "tokens") view.textContent = window.pyTokens(code.value);
      else if (currentView === "ast") view.textContent = window.pyAst(code.value);
      else view.textContent = window.__BRYTHON__.python_to_js(code.value);
    } catch (err) {
      view.innerHTML = `<span class="err">This code can't be compiled yet. Fix the syntax error and look again.</span>`;
    }
    view.scrollTop = 0;
  }
  function fmtMs(ms) { return ms < 1000 ? `${ms.toFixed(0)} ms` : `${(ms / 1000).toFixed(2)} s`; }
  function setTiming(ok, ms, label) {
    $("timing").innerHTML = `<span class="dot" style="background:var(${ok ? "--ok" : "--err"})"></span>${label} · ${fmtMs(ms)}`;
  }

  function busy(on) {
    runBtn.disabled = on || !pyReady;
    checkBtn.disabled = on || !pyReady;
    if (on) $("timing").textContent = "running…";
  }

  function doRun() {
    if (!pyReady) return;
    selectOutputTab();
    openSheet();
    busy(true);
    setTimeout(() => {
      buffer = "";
      const t0 = performance.now();
      let ok = false;
      try { ok = window.pyRun(code.value, stdinBox.value); }
      catch (err) { buffer += `<span class="err">${esc(err && err.message || err)}</span>`; }
      outputHTML = buffer || EMPTY;
      setTiming(ok, performance.now() - t0, ok ? "ok" : "error");
      busy(false);
      renderView();
    }, 16);
  }

  function doCheck() {
    if (!pyReady || ctx.mode !== "exercise") return;
    const lesson = ctx.lesson, i = ctx.index, ex = lesson.exercises[i];
    selectOutputTab();
    openSheet();
    busy(true);
    setTimeout(() => {
      buffer = "";
      const t0 = performance.now();
      let res;
      try { res = JSON.parse(window.pyCheck(code.value, ex.check, ex.stdin || stdinBox.value)); }
      catch (err) { res = { ok: false, msg: "The checker crashed: " + (err && err.message || err) }; }
      const before = lessonDone(lesson);
      if (res.ok) { state.passed[exKey(lesson, i)] = true; save(); }
      let verdict = res.ok ? "✓ All checks passed. Nice work!" : "✗ " + res.msg;
      if (res.ok && !before && lessonDone(lesson)) verdict += "\nLesson complete.";
      outputHTML = (buffer || "") + `<span class="verdict ${res.ok ? "pass" : "fail"}">${esc(verdict)}</span>`;
      setTiming(res.ok, performance.now() - t0, res.ok ? "passed" : "not yet");
      busy(false);
      renderView();
      updateExerciseCard(lesson, i);
      renderNav();
    }, 16);
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

  window.pyReady = () => {
    pyReady = true;
    busy(false);
    $("status").classList.add("ready");
    $("statusText").textContent = "Python ready";
    if (currentView !== "output") renderView();
  };
  setTimeout(() => {
    if (!pyReady) { $("status").classList.add("fail"); $("statusText").textContent = "Python failed to load. Check your connection and reload."; }
  }, 30000);

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
        <span class="eyebrow">Python from scratch to advanced</span>
        <h1>Learn Python by <em>running it</em>, one lesson at a time.</h1>
        <p>Every lesson explains one idea in plain language, shows examples you can run and change, then checks your understanding with exercises and a short quiz. No installs: Python runs right here in your browser.</p>
        <div class="stats"><span><b>${PARTS.length}</b> parts</span><span><b>${LESSONS.length}</b> lessons</span><span><b>${nRun}</b> runnable examples</span><span><b>${nEx}</b> auto-checked exercises</span><span><b>${nQ}</b> quiz questions</span></div>
        <div class="cta-row">
          <a class="btn-primary" href="#${target.id}">${done || resume ? "Continue" : "Start"}: ${esc(target.title)} →</a>
          <a class="btn-ghost" href="playground.html">Open the playground</a>
        </div>
      </section>
      <section class="how">
        <div><b>Read and run</b><span>Press Run on any example to load it into the editor beside the lesson. Change it and run it again.</span></div>
        <div><b>Practise</b><span>Exercises open in the editor. Press Check and the tests tell you exactly what to fix.</span></div>
        <div><b>Track progress</b><span>A lesson is complete when its exercises pass. Progress is saved in this browser.</span></div>
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
            <button class="mini-btn" data-act="hint" type="button">Hint</button>
            <button class="mini-btn" data-act="solution" type="button">Solution</button>
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
      const tag = ex.error ? '<span class="tag warn">Example · raises an error</span>' : '<span class="tag">Example</span>';
      el.outerHTML = `<div class="codeblock" data-ex="${el.dataset.ex}">
        <div class="codeblock-bar">${tag}${ex.stdin ? '<span class="tag">uses input</span>' : ""}<button class="run-btn" type="button" data-act="run">▶ Run</button></div>
        <pre>${highlight(ex.code)}</pre></div>`;
    });
    page.querySelectorAll("pre.plain").forEach((el) => { el.innerHTML = highlight(el.textContent); });

    page.querySelectorAll(".codeblock .run-btn").forEach((btn) => btn.addEventListener("click", () => {
      const ex = lesson.examples[+btn.closest(".codeblock").dataset.ex];
      ctx = { mode: "example", page: lesson.id };
      clearActiveExercise();
      setIdeHeader("Example", lesson.title);
      setCode(ex.code);
      stdinBox.value = ex.stdin || "";
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
        else if (a === "hint") {
          if (slot.dataset.kind === "hint" && !slot.hidden) { slot.hidden = true; return; }
          slot.dataset.kind = "hint";
          slot.innerHTML = `<b>Hint</b>${ex.hint || "<p>No hint for this one. Re-read the examples above.</p>"}`;
          slot.hidden = false;
        } else if (a === "solution") {
          if (slot.dataset.kind === "solution" && !slot.hidden) { slot.hidden = true; return; }
          slot.dataset.kind = "confirm";
          slot.innerHTML = `<p>Try the hint first if you haven't. Looking at the solution is fine once you've had a real go: compare it with your own and understand the difference.</p>
            <div class="reveal-actions"><button class="mini-btn" data-act="show-solution" type="button">Show solution</button><button class="mini-btn" data-act="close" type="button">Keep trying</button></div>`;
          slot.hidden = false;
        } else if (a === "show-solution") {
          slot.dataset.kind = "solution";
          slot.innerHTML = `<b>One possible solution</b><pre>${highlight(ex.solution)}</pre>
            <div class="reveal-actions"><button class="mini-btn" data-act="load-solution" type="button">Load into editor</button></div>`;
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
    ctx = { mode: "exercise", lesson, index: i, page: lesson.id };
    setIdeHeader(`Exercise ${ex.number}`, ex.title);
    const saved = state.code[exKey(lesson, i)];
    const src = overrideCode != null ? overrideCode : (saved != null ? saved : ex.starter);
    setCode(src);
    if (overrideCode != null) { state.code[exKey(lesson, i)] = overrideCode; save(); }
    stdinBox.value = ex.stdin || "";
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
  setIdeHeader("Scratchpad", "main.py");
  setCode('# Your scratchpad. Try anything!\nname = "world"\nprint(f"Hello, {name}!")\n');
  renderView();
  route();
})();
