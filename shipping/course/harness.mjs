/* Test harness: runs examples and exercise checks with the same shell.js and runner.js as the browser, in Node.js.
   Usage: node harness.mjs jobs.json results.json
   Each job runs in a worker thread with a time limit, so an endless loop is reported instead of hanging. */
import { Worker } from "node:worker_threads";
import { readFileSync, writeFileSync } from "node:fs";

const [jobsFile, outFile] = process.argv.slice(2);
const jobs = JSON.parse(readFileSync(jobsFile, "utf8"));
const LIMIT = 20000;
const workerSrc = `
  const { parentPort } = require("node:worker_threads");
  (async () => {
    const R = await import(${JSON.stringify(new URL("./runner.js", import.meta.url).href)});
    const S = await import(${JSON.stringify(new URL("./shell.js", import.meta.url).href)});
    process.on("unhandledRejection", (e) => R.reportUnhandled(e));
    process.on("uncaughtException", (e) => R.reportUnhandled(e));
    parentPort.on("message", async (job) => {
      const t0 = performance.now();
      let result;
      try {
        if (job.lang === "sh") {
          result = job.type === "check" ? await S.checkShell(job.code, job.check, { setup: job.setup || "" })
                                        : await S.runShell(job.code, { setup: job.setup || "" });
          delete result.shell;
        } else {
          result = job.type === "check" ? await R.check(job.code, job.check, job.stdin || "") : await R.run(job.code, job.stdin || "");
        }
      } catch (e) {
        result = { ok: false, parts: [["err", "HARNESS: " + (e && e.stack || e)]], figures: [] };
      }
      result.ms = performance.now() - t0;
      parentPort.postMessage(result);
    });
    parentPort.postMessage("ready");
  })();`;

let worker = null;
function spawn() {
  return new Promise((resolve) => {
    worker = new Worker(workerSrc, { eval: true });
    worker.once("message", () => resolve());
  });
}
await spawn();
const results = [];
for (const job of jobs) {
  const result = await new Promise((resolve) => {
    const timer = setTimeout(async () => {
      worker.removeAllListeners("message");
      await worker.terminate();
      await spawn();
      resolve({ ok: false, timedOut: true, parts: [["err", `TIMED OUT after ${LIMIT / 1000} s`]], figures: [],
                verdict: { ok: false, msg: `TIMED OUT after ${LIMIT / 1000} s` } });
    }, LIMIT);
    worker.once("message", (r) => { clearTimeout(timer); resolve(r); });
    worker.postMessage(job);
  });
  results.push(result);
}
await worker.terminate();
writeFileSync(outFile, JSON.stringify(results));
