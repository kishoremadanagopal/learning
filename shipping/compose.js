/* compose.js: Docker Compose v5 for the sandbox's pretend Docker (docker.js), printing like `docker compose` does
   when its output isn't a terminal (one line per event), and the docker/* actions that GitHub Actions uses to log in
   to a registry, work out tags and labels, and build and push images. */
import { parseDocument } from "./yamllib.js?v=11948bf18f";

export function installCompose(D, api) {
  const { MemFS } = api;
  const ev = (io, id, text) => io.out(` ${id} ${text} \n`);   // compose's plain progress: fmt.Fprintln("", ID, Text, Details)

  /* ------------------------------------------------------------ reading compose.yaml */

  const FILES = ["compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"];
  function interpolate(text, env) {
    return text.replace(/\$\$|\$\{([A-Za-z_]\w*)(?:(:?[-?])([^}]*))?\}|\$([A-Za-z_]\w*)/g, (m, a, op, arg, b) => {
      if (m === "$$") return "$";
      const k = a ?? b;
      const v = env[k];
      if (op === ":-") return v ? v : arg;
      if (op === "-") return v !== undefined ? v : arg;
      if (op === ":?" || op === "?") { if (!v) throw new D.DockerError(`required variable ${k} is missing a value: ${arg}`); return v; }
      return v ?? "";
    });
  }
  function loadProject(e, sh, opts) {
    const dir = sh.cwd;
    const file = opts.file ? sh.abs(opts.file) : FILES.map((f) => `${dir}/${f}`).find((f) => sh.fs.exists(f));
    if (!file || !sh.fs.exists(file)) throw new D.DockerError(opts.file ? `open ${sh.abs(opts.file)}: no such file or directory` : "no configuration file provided: not found");
    const env = { ...sh.env };
    const dotenv = sh.fs.text(`${dir}/.env`);
    if (dotenv) for (const line of dotenv.split("\n")) { const m = /^\s*([A-Za-z_]\w*)\s*=\s*(.*?)\s*$/.exec(line); if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2"); }
    const text = interpolate(sh.fs.text(file), env);
    const doc = parseDocument(text, { uniqueKeys: false });
    if (doc.errors.length) {
      const err = doc.errors[0];
      throw new D.DockerError(`yaml: line ${err.linePos?.[0]?.line ?? 1}: ${err.message.split("\n")[0].replace(/ at line \d+, column \d+:?$/, "")}`);
    }
    const data = doc.toJS() ?? {};
    const warnings = [];
    if ("version" in data) warnings.push(`${file}: the attribute \`version\` is obsolete, it will be ignored, please remove it to avoid potential confusion`);
    const name = String(opts.project ?? data.name ?? env.COMPOSE_PROJECT_NAME ?? dir.split("/").pop()).toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!data.services || typeof data.services !== "object") throw new D.DockerError(`${file}: services must be a mapping`);
    const services = [];
    for (const [sname, s0] of Object.entries(data.services)) {
      const s = s0 ?? {};
      const known = ["image", "build", "ports", "environment", "env_file", "depends_on", "healthcheck", "volumes", "command", "entrypoint", "restart", "user", "working_dir", "networks", "develop", "container_name", "expose", "init", "mem_limit", "deploy", "labels", "stop_grace_period", "profiles", "hostname", "secrets"];
      for (const k of Object.keys(s)) if (!known.includes(k)) throw new D.DockerError(`validating ${file}: services.${sname} additional properties '${k}' not allowed`);
      if (!s.image && !s.build) throw new D.DockerError(`service "${sname}" has neither an image nor a build context specified: invalid compose project`);
      const build = s.build === undefined ? null : typeof s.build === "string" ? { context: s.build } : { context: s.build.context ?? ".", dockerfile: s.build.dockerfile, target: s.build.target, args: s.build.args };
      const listToMap = (v) => (Array.isArray(v) ? Object.fromEntries(v.map((kv) => { const i = String(kv).indexOf("="); return i < 0 ? [kv, env[kv] ?? ""] : [kv.slice(0, i), kv.slice(i + 1)]; })) : Object.fromEntries(Object.entries(v ?? {}).map(([k, x]) => [k, x === null ? env[k] ?? "" : String(x)])));
      let environment = {};
      for (const f of [].concat(s.env_file ?? [])) {
        const p = typeof f === "string" ? f : f.path;
        const t = sh.fs.text(sh.abs(p));
        if (t === null) { if (typeof f === "object" && f.required === false) continue; throw new D.DockerError(`env file ${sh.abs(p)} not found: stat ${sh.abs(p)}: no such file or directory`); }
        for (const line of t.split("\n")) { const m = /^\s*([A-Za-z_]\w*)\s*=\s*(.*?)\s*$/.exec(line); if (m) environment[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2"); }
      }
      environment = { ...environment, ...listToMap(s.environment) };
      const deps = Array.isArray(s.depends_on) ? Object.fromEntries(s.depends_on.map((d) => [d, { condition: "service_started", required: true }])) : Object.fromEntries(Object.entries(s.depends_on ?? {}).map(([d, c]) => [d, { condition: c?.condition ?? "service_started", required: c?.required !== false }]));
      for (const d of Object.keys(deps)) if (!data.services[d]) throw new D.DockerError(`service "${sname}" depends on undefined service "${d}": invalid compose project`);
      let healthcheck = null;
      if (s.healthcheck) {
        const t = s.healthcheck.test;
        const test = s.healthcheck.disable ? ["NONE"] : Array.isArray(t) ? t : ["CMD-SHELL", String(t)];
        healthcheck = { Test: test, Interval: D.durationNs(s.healthcheck.interval ?? "30s"), Timeout: D.durationNs(s.healthcheck.timeout ?? "30s"), Retries: s.healthcheck.retries ?? 3, StartPeriod: D.durationNs(s.healthcheck.start_period ?? "0s") };
      }
      const ports = (s.ports ?? []).map((p) => (typeof p === "object" ? `${p.published ?? ""}${p.published ? ":" : ""}${p.target}` : String(p)));
      services.push({
        name: sname, image: s.image ?? null, build, ports, environment, deps, healthcheck, volumes: (s.volumes ?? []).map((v) => (typeof v === "string" ? v : `${v.source}:${v.target}${v.read_only ? ":ro" : ""}`)),
        command: s.command === undefined ? undefined : Array.isArray(s.command) ? s.command.map(String) : ["/bin/sh", "-c", String(s.command)],
        entrypoint: s.entrypoint === undefined ? undefined : Array.isArray(s.entrypoint) ? s.entrypoint.map(String) : ["/bin/sh", "-c", String(s.entrypoint)],
        restart: s.restart ?? "no", user: s.user, workdir: s.working_dir, containerName: s.container_name, init: !!s.init,
        memory: D.parseMemory(String(s.mem_limit ?? s.deploy?.resources?.limits?.memory ?? "").toLowerCase().replace(/b$/, "")),
        develop: s.develop ?? null, labels: listToMap(s.labels),
      });
    }
    const volumes = Object.keys(data.volumes ?? {});
    for (const s of services) for (const v of s.volumes) {
      const src = v.split(":")[0];
      if (v.includes(":") && !/^[./~]/.test(src) && !volumes.includes(src)) throw new D.DockerError(`service "${s.name}" refers to undefined volume ${src}: invalid compose project`);
    }
    return { name, dir, file, services, volumes, warnings, env };
  }
  // services in dependency order (dependencies first)
  function ordered(project, only = null) {
    const out = [];
    const seen = new Set();
    const visit = (s) => {
      if (seen.has(s.name)) return;
      seen.add(s.name);
      for (const d of Object.keys(s.deps)) visit(project.services.find((x) => x.name === d));
      out.push(s);
    };
    for (const s of project.services) if (!only || only.includes(s.name)) visit(s);
    return out;
  }
  const containerName = (p, s) => s.containerName ?? `${p.name}-${s.name}-1`;
  const containersOf = (e, p) => [...e.containers.values()].filter((c) => c.compose?.project === p.name);
  const imageName = (p, s) => s.image ?? `${p.name}-${s.name}`;
  const logName = (c) => (c.compose && c.name === `${c.compose.project}-${c.compose.service}-${c.compose.number}` ? c.name.slice(c.compose.project.length + 1) : c.name);

  /* ------------------------------------------------------------ docker compose … */

  async function run(e, sh, args, io) {
    const top = { file: null, project: null };
    while (args.length && args[0].startsWith("-")) {
      if (args[0] === "-f" || args[0] === "--file") { top.file = args[1]; args = args.slice(2); }
      else if (args[0] === "-p" || args[0] === "--project-name") { top.project = args[1]; args = args.slice(2); }
      else if (args[0] === "version" || args[0] === "--version" || args[0] === "-v") break;
      else break;
    }
    const [cmd, ...rest] = args;
    if (cmd === "version" || cmd === "--version" || cmd === "-v") { io.out(`Docker Compose version ${D.VERSION.compose}\n`); return 0; }
    if (!cmd || cmd === "--help") { io.out(`\nUsage:  docker compose [OPTIONS] COMMAND\n\nDefine and run multi-container applications with Docker\n\nCommands:\n  build       Build or rebuild services\n  config      Parse, resolve and render compose file in canonical format\n  down        Stop and remove containers, networks\n  exec        Execute a command in a running container\n  logs        View output from containers\n  ps          List containers\n  restart     Restart service containers\n  stop        Stop services\n  up          Create and start containers\n  version     Show the Docker Compose version information\n  watch       Watch build context for service and rebuild/refresh containers when files are updated\n`); return 0; }
    const p = loadProject(e, sh, top);
    for (const w of p.warnings) io.err(`WARN[0000] ${w} \n`);
    const flags = rest.filter((a) => a.startsWith("-"));
    const names = rest.filter((a) => !a.startsWith("-"));
    const has = (...f) => f.some((x) => flags.includes(x));
    switch (cmd) {
      case "up": return up(e, sh, p, io, { detach: has("-d", "--detach"), build: has("--build"), wait: has("--wait"), only: names.length ? names : null, quietPull: has("--quiet-pull") });
      case "build": return buildAll(e, sh, p, io, names.length ? names : null, { force: true });
      case "ps": {
        const all = has("-a", "--all");
        const list = containersOf(e, p).filter((c) => all || c.state === "running").sort((a, b) => (a.name < b.name ? -1 : 1));
        if (has("-q", "--quiet")) { io.out(list.map((c) => c.id + "\n").join("")); return 0; }
        const rows = [["NAME", "IMAGE", "COMMAND", "SERVICE", "CREATED", "STATUS", "PORTS"]];
        for (const c of list) rows.push([c.name, c.imageRef, D.quoteGo(D.ellipsis(D.commandString(c), 20)), c.compose.service, D.humanDuration(D.now(e) - c.created) + " ago", D.statusText(e, c), D.portsText(c, { compose: true })]);
        io.out(D.table(rows));
        return 0;
      }
      case "logs": {
        const list = containersOf(e, p).filter((c) => !names.length || names.includes(c.compose.service)).sort((a, b) => (a.name < b.name ? -1 : 1));
        const noPrefix = has("--no-log-prefix");
        const width = Math.max(...list.map((c) => logName(c).length), 0);
        const tailIdx = rest.findIndex((a) => a === "--tail" || a === "-n");
        const tail = tailIdx >= 0 ? Number(rest[tailIdx + 1]) : null;
        // lines from all containers, in the order they were written
        for (const c of list) {
          const lines = [];
          for (const [k, t] of c.logs) for (const l of t.replace(/\n$/, "").split("\n")) if (t) lines.push([k, l]);
          for (const [k, l] of tail !== null ? lines.slice(-tail) : lines) {
            const text = (noPrefix ? "" : `${logName(c).padEnd(width)} | `) + l + "\n";
            (k === "err" ? io.err(text) : io.out(text));
          }
        }
        if (has("-f", "--follow")) io.out("(docker compose logs -f keeps printing new output until you press Ctrl+C; the sandbox stops here.)\n");
        return 0;
      }
      case "down": {
        const list = containersOf(e, p);
        const order = ordered(p).reverse().map((s) => list.find((c) => c.compose.service === s.name)).filter(Boolean);
        for (const c of list) if (!order.includes(c)) order.push(c);
        for (const c of order) {
          if (c.state === "running") { ev(io, `Container ${c.name}`, "Stopping"); await D.stopContainer(e, c); ev(io, `Container ${c.name}`, "Stopped"); }
          ev(io, `Container ${c.name}`, "Removing");
          D.removeContainer(e, c);
          ev(io, `Container ${c.name}`, "Removed");
        }
        if (has("-v", "--volumes")) for (const v of p.volumes) { const vn = `${p.name}_${v}`; if (e.volumes.has(vn)) { ev(io, `Volume ${vn}`, "Removing"); e.volumes.delete(vn); ev(io, `Volume ${vn}`, "Removed"); } }
        const net = `${p.name}_default`;
        if (e.networks.has(net)) { ev(io, `Network ${net}`, "Removing"); e.networks.delete(net); ev(io, `Network ${net}`, "Removed"); }
        if (rest.includes("--rmi")) for (const s of p.services) if (s.build && !s.image) { const img = D.imageOf(e, imageName(p, s)); if (img) { ev(io, `Image ${imageName(p, s)}:latest`, "Removing"); for (const t of D.tagsOf(e, img)) e.tags.delete(D.parseRef(t).full); e.images.delete(img.id); ev(io, `Image ${imageName(p, s)}:latest`, "Removed"); } }
        return 0;
      }
      case "stop": case "restart": case "start": {
        const list = containersOf(e, p).filter((c) => !names.length || names.includes(c.compose.service));
        for (const c of (cmd === "start" ? list : list.reverse())) {
          if (cmd !== "start" && c.state === "running") { ev(io, `Container ${c.name}`, cmd === "stop" ? "Stopping" : "Restarting"); await D.stopContainer(e, c); if (cmd === "stop") ev(io, `Container ${c.name}`, "Stopped"); }
          if (cmd !== "stop") { c.stoppedByUser = false; if (cmd === "start") ev(io, `Container ${c.name}`, "Starting"); await D.startContainer(e, c); ev(io, `Container ${c.name}`, cmd === "start" ? "Started" : "Started"); }
        }
        await D.settle(e);
        return 0;
      }
      case "exec": {
        const k = rest.findIndex((a) => !a.startsWith("-") && rest[rest.indexOf(a) - 1] !== "-u" && rest[rest.indexOf(a) - 1] !== "-w");
        const svc = rest[k];
        const argv = rest.slice(k + 1);
        const c = containersOf(e, p).find((x) => x.compose.service === svc && x.state === "running");
        if (!p.services.some((s) => s.name === svc)) throw new D.DockerError(`service "${svc}" is not running`);
        if (!c) throw new D.DockerError(`service "${svc}" is not running`);
        if (!argv[0].includes("/") && !c.image.bins.includes(argv[0])) throw new D.DockerError(`OCI runtime exec failed: exec failed: unable to start container process: exec: "${argv[0]}": executable file not found in $PATH: unknown`, 127);
        const r = await D.execIn(e, c, argv[0] === "sh" && argv[1] === "-c" ? ["/bin/sh", "-c", argv.slice(2).join(" ")] : argv, { io });
        await D.settle(e);
        return r.code;
      }
      case "config": {
        if (has("--services")) { io.out(p.services.map((s) => s.name + "\n").join("")); return 0; }
        // the project as Compose understands it, after interpolation and defaults
        let y = `name: ${p.name}\nservices:\n`;
        for (const s of [...p.services].sort((a, b) => (a.name < b.name ? -1 : 1))) {
          y += `  ${s.name}:\n`;
          if (s.build) y += `    build:\n      context: ${MemFS.norm(p.dir + "/" + s.build.context)}\n      dockerfile: ${s.build.dockerfile ?? "Dockerfile"}\n`;
          if (Object.keys(s.deps).length) y += `    depends_on:\n${Object.entries(s.deps).map(([d, c]) => `      ${d}:\n        condition: ${c.condition}\n        required: ${c.required}\n`).join("")}`;
          if (Object.keys(s.environment).length) y += `    environment:\n${Object.entries(s.environment).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `      ${k}: ${/^[\w./:-]*$/.test(v) && v !== "" ? v : JSON.stringify(v)}\n`).join("")}`;
          if (s.image) y += `    image: ${s.image}\n`;
          y += `    networks:\n      default: null\n`;
          if (s.ports.length) y += `    ports:\n${s.ports.map((pp) => { const pr = D.parsePorts([pp])[0]; return `      - mode: ingress\n        target: ${pr.containerPort}\n        published: "${pr.hostPort}"\n        protocol: tcp\n`; }).join("")}`;
          if (s.restart !== "no") y += `    restart: ${s.restart}\n`;
        }
        y += `networks:\n  default:\n    name: ${p.name}_default\n`;
        if (p.volumes.length) y += `volumes:\n${p.volumes.map((v) => `  ${v}:\n    name: ${p.name}_${v}\n`).join("")}`;
        io.out(y);
        return 0;
      }
      case "watch":
        io.out("(docker compose watch keeps running and syncs or rebuilds when you save a file, following each service's develop.watch rules. The sandbox can't wait for you to edit files: on your own computer, run it in its own terminal.)\n");
        return 0;
      default:
        throw new D.DockerError(`unknown docker command: "compose ${cmd}"`);
    }
  }

  async function buildAll(e, sh, p, io, only, { force = false } = {}) {
    const ctr = { n: 0 };
    for (const s of ordered(p, only)) {
      if (!s.build) continue;
      const tag = imageName(p, s);
      if (!force && D.imageOf(e, tag)) continue;
      ev(io, `Image ${tag}`, "Building");
      let text = "";
      const saved = sh.cwd;
      sh.cwd = p.dir;
      const r = await D.build(e, sh, { context: s.build.context, file: s.build.dockerfile ? MemFS.norm(s.build.context + "/" + s.build.dockerfile) : undefined, tags: [tag], target: s.build.target, buildArgs: s.build.args ?? {}, prefix: s.name, noHeader: true, counter: ctr }, (t) => { text += t; });
      sh.cwd = saved;
      if (!r.ok) {
        const j = text.search(/\n------\n|\nDockerfile:\d+\n|\nERROR: /);
        io.out(text.slice(0, j >= 0 ? j + 1 : text.length));
        io.err(text.slice(j >= 0 ? j + 1 : text.length).replace(/^ERROR: failed to build: /m, "failed to solve: ").replace(/^failed to solve: failed to solve:/m, "failed to solve:"));
        return 1;
      }
      io.out(text);
      ev(io, `Image ${tag}`, "Built");
    }
    return 0;
  }

  async function up(e, sh, p, io, o) {
    const services = ordered(p, o.only);
    // images: build or pull what's missing
    const toBuild = services.filter((s) => s.build && (o.build || !D.imageOf(e, imageName(p, s))));
    if (toBuild.length) { const code = await buildAll(e, sh, p, io, toBuild.map((s) => s.name), { force: true }); if (code) return code; }
    for (const s of services) {
      if (s.build || D.imageOf(e, s.image)) continue;
      ev(io, `Image ${s.image}`, "Pulling");
      const r = D.pull(e, s.image, () => {}, { quiet: true });
      if (r.error) { ev(io, `Image ${s.image}`, `Error ${r.error}`); io.err(`Error response from daemon: ${r.error}\n`); return 1; }
      ev(io, `Image ${s.image}`, "Pulled");
    }
    // the project's network and volumes
    const netName = `${p.name}_default`;
    if (!e.networks.has(netName)) { ev(io, `Network ${netName}`, "Creating"); D.createNetwork(e, netName, { "com.docker.compose.network": "default", "com.docker.compose.project": p.name }); ev(io, `Network ${netName}`, "Created"); }
    for (const v of p.volumes) {
      const vn = `${p.name}_${v}`;
      if (!e.volumes.has(vn)) { ev(io, `Volume ${vn}`, "Creating"); e.volumes.set(vn, { name: vn, created: D.now(e), files: null, labels: { "com.docker.compose.project": p.name, "com.docker.compose.volume": v } }); ev(io, `Volume ${vn}`, "Created"); }
    }
    // containers: create what's missing or changed, in dependency order
    const existing = containersOf(e, p);
    const plan = [];
    for (const s of services) {
      const name = containerName(p, s);
      const img = D.imageOf(e, imageName(p, s));
      const cfgHash = D.hex(JSON.stringify([s, img.id]));
      let c = existing.find((x) => x.compose.service === s.name);
      if (c && c.compose.hash !== cfgHash) {
        ev(io, `Container ${c.name}`, "Recreate");
        if (c.state === "running") await D.stopContainer(e, c);
        D.removeContainer(e, c);
        c = null;
        plan.push({ s, c: null, recreated: true, name, img, cfgHash });
      } else plan.push({ s, c, name, img, cfgHash });
    }
    for (const step of plan) {
      if (step.c) continue;
      const { s, name, img, cfgHash } = step;
      if (!step.recreated) ev(io, `Container ${name}`, "Creating");
      const mounts = s.volumes.map((v) => {
        const [src, target, mode] = v.split(":");
        if (!target) return { type: "volume", source: D.hex("anon" + v + name), target: src, anonymous: true };
        if (/^[./~]/.test(src)) return { type: "bind", source: sh.abs(MemFS.norm(p.dir + "/" + src.replace(/^\.\//, ""))), target, ro: mode === "ro" };
        return { type: "volume", source: `${p.name}_${src}`, target, ro: mode === "ro" };
      });
      for (const m of mounts) if (m.type === "bind" && !sh.fs.exists(m.source)) D.mkdirp(sh.fs, m.source);
      const [rname, rmax] = String(s.restart).split(":");
      const c = D.createContainer(e, img, {
        name, imageRef: imageName(p, s), cmd: s.command, entrypoint: s.entrypoint, ports: D.parsePorts(s.ports), env: s.environment, mounts,
        network: netName, aliases: [s.name], restart: { name: rname, max: Number(rmax ?? 0) }, user: s.user, workdir: s.workdir, init: s.init, memory: s.memory,
        healthcheck: s.healthcheck ?? undefined,
        labels: { "com.docker.compose.project": p.name, "com.docker.compose.service": s.name, "com.docker.compose.container-number": "1", "com.docker.compose.oneoff": "False", ...s.labels },
        compose: { project: p.name, service: s.name, number: 1, hash: cfgHash },
      });
      c.compose.hash = cfgHash;
      step.c = c;
      ev(io, `Container ${name}`, step.recreated ? "Recreated" : "Created");
    }
    // start, waiting for each container's dependencies
    for (const step of plan) {
      const { s, c } = step;
      if (c.state === "running") { ev(io, `Container ${c.name}`, "Running"); continue; }
      for (const [dep, cfg] of Object.entries(s.deps)) {
        if (cfg.condition === "service_started") continue;
        const dc = plan.find((x) => x.s.name === dep)?.c;
        if (!dc) continue;
        ev(io, `Container ${dc.name}`, "Waiting");
        if (cfg.condition === "service_healthy") {
          // health checks run every interval: wait until the dependency reports healthy (or gives up)
          for (let k = 0; k < 40 && dc.health && dc.health.status === "starting" && dc.state === "running"; k++) { D.tick(e, Math.max(1, Math.round((dc.healthcheck?.Interval ?? 30e9) / 1e9))); await D.refreshHealth(e, dc); }
          if (!dc.health || dc.state !== "running" || dc.health.status !== "healthy") {
            ev(io, `Container ${dc.name}`, `Error dependency ${dep} failed to start`);
            io.err(dc.state !== "running" ? `dependency failed to start: container ${dc.name} exited (${dc.exitCode})\n` : !dc.health ? `dependency failed to start: container ${dc.name} has no healthcheck configured\n` : `dependency failed to start: container ${dc.name} is unhealthy\n`);
            return 1;
          }
          ev(io, `Container ${dc.name}`, "Healthy");
        } else if (cfg.condition === "service_completed_successfully") {
          if (dc.state === "running" || dc.exitCode !== 0) { io.err(`service "${dep}" didn't complete successfully: exit ${dc.exitCode}\n`); return 1; }
          ev(io, `Container ${dc.name}`, "Exited");
        }
      }
      ev(io, `Container ${c.name}`, "Starting");
      for (const pp of c.ports) {
        const busy = [...e.containers.values()].find((x) => x !== c && x.state === "running" && x.ports.some((q) => q.hostPort === pp.hostPort));
        if (busy) { ev(io, `Container ${c.name}`, `Error response from daemon: failed to set up container networking: driver failed programming external connectivity on endpoint ${c.name} (${D.hex(c.id + "ep")}): Bind for 0.0.0.0:${pp.hostPort} failed: port is already allocated`); io.err(`Error response from daemon: failed to set up container networking: driver failed programming external connectivity on endpoint ${c.name} (${D.hex(c.id + "ep")}): Bind for 0.0.0.0:${pp.hostPort} failed: port is already allocated\n`); return 1; }
      }
      c.stoppedByUser = false;
      const err = await D.startContainer(e, c);
      if (err) { ev(io, `Container ${c.name}`, `Error response from daemon: ${err.error}`); io.err(`Error response from daemon: ${err.error}\n`); return 1; }
      D.tick(e);
      ev(io, `Container ${c.name}`, "Started");
    }
    await D.settle(e);
    if (o.wait) {
      for (const { c } of plan) {
        ev(io, `Container ${c.name}`, "Waiting");
        for (let k = 0; k < 40 && c.health && c.health.status === "starting"; k++) { D.tick(e, Math.max(1, Math.round((c.healthcheck?.Interval ?? 30e9) / 1e9))); await D.refreshHealth(e, c); }
        if (c.state !== "running" || (c.health && c.health.status !== "healthy")) { io.err(`container ${c.name} ${c.state !== "running" ? `exited (${c.exitCode})` : "is unhealthy"}\n`); return 1; }
        ev(io, `Container ${c.name}`, "Healthy");
      }
    }
    if (!o.detach) {
      const list = plan.map((x) => x.c);
      const width = Math.max(...list.map((c) => logName(c).length));
      io.out(`Attaching to ${list.map(logName).join(", ")}\n`);
      for (const c of list) for (const [k, t] of c.logs) for (const l of t.replace(/\n$/, "").split("\n")) if (t) { const line = `${logName(c).padEnd(width)} | ${l}\n`; (k === "err" ? io.err(line) : io.out(line)); }
      io.out(`\n(Without -d, docker compose up stays attached and streams every container's output until you press Ctrl+C, which stops them. The sandbox gives you the prompt back with the containers still running; use docker compose up -d to start them in the background, and docker compose down to stop them.)\n`);
    }
    return 0;
  }

  /* ------------------------------------------------------------ the docker/* actions on GitHub Actions */

  const A = api.dockerActions;
  if (A) {
    const runnerEngine = (o) => {
      const e = D.engine(o.rsh);
      return e;
    };
    A["docker/setup-qemu-action"] = async ({ log, group }) => {
      group({ image: "docker.io/tonistiigi/binfmt:latest", platforms: "all", "cache-image": "true" });
      log("##[group]Docker info\n[command]/usr/bin/docker version\n##[endgroup]");
      log("##[group]Pulling binfmt Docker image\n[command]/usr/bin/docker pull docker.io/tonistiigi/binfmt:latest\nlatest: Pulling from tonistiigi/binfmt\nStatus: Downloaded newer image for tonistiigi/binfmt:latest\n##[endgroup]");
      log("##[group]Installing QEMU static binaries\n[command]/usr/bin/docker run --rm --privileged docker.io/tonistiigi/binfmt:latest --install all\n##[endgroup]");
      log("##[group]Extracting available platforms\nlinux/amd64,linux/amd64/v2,linux/amd64/v3,linux/arm64,linux/riscv64,linux/ppc64le,linux/s390x,linux/386,linux/mips64le,linux/mips64,linux/loong64,linux/arm/v7,linux/arm/v6\n##[endgroup]");
      return "success";
    };
    A["docker/setup-buildx-action"] = async ({ log, group, o, withV, s }) => {
      group({ version: withV.version ?? "", driver: withV.driver ?? "docker-container", "cache-binary": "true", install: "false", "use": "true", "cleanup": "true", keep_state: "false" });
      const e = runnerEngine(o);
      const name = `builder-${D.uuid(String(o.run.id) + o.job.name)}`;
      log(`##[group]Docker info\n[command]/usr/bin/docker version\n##[endgroup]`);
      log(`##[group]Buildx version\n[command]/usr/bin/docker buildx version\ngithub.com/docker/buildx ${D.VERSION.buildx} 6f1b2a4\n##[endgroup]`);
      log(`##[group]Creating a new builder instance\n[command]/usr/bin/docker buildx create --name ${name} --driver docker-container --buildkitd-flags --allow-insecure-entitlement security.insecure --allow-insecure-entitlement network.host --use\n${name}\n##[endgroup]`);
      log(`##[group]Booting builder\n[command]/usr/bin/docker buildx inspect --bootstrap --builder ${name}\n#1 [internal] booting buildkit\n#1 pulling image moby/buildkit:buildx-stable-1\n#1 pulling image moby/buildkit:buildx-stable-1 1.4s done\n#1 creating container buildx_buildkit_${name}0\n#1 creating container buildx_buildkit_${name}0 0.6s done\n#1 DONE 2.0s\n##[endgroup]`);
      log(`##[group]Inspect builder\n{\n  "nodes": [\n    {\n      "name": "${name}0",\n      "endpoint": "unix:///var/run/docker.sock",\n      "status": "running",\n      "buildkit": "${D.VERSION.buildkit}",\n      "platforms": "linux/amd64,linux/amd64/v2,linux/amd64/v3,linux/386"\n    }\n  ],\n  "name": "${name}",\n  "driver": "docker-container"\n}\n##[endgroup]`);
      e.builder = { name, driver: "docker-container" };
      o.outputs.name = name;
      o.outputs.driver = "docker-container";
      o.outputs.platforms = "linux/amd64,linux/amd64/v2,linux/amd64/v3,linux/386";
      o.posts.push({ name: s.uses, fn: async (L) => { L(`##[group]Removing builder\n[command]/usr/bin/docker buildx rm ${name}\n${name} removed\n##[endgroup]`); } });
      return "success";
    };
    A["docker/login-action"] = async ({ log, group, o, withV, s }) => {
      group({ ...withV, password: withV.password ? "***" : "", ecr: "auto", logout: "true" });
      const e = runnerEngine(o);
      const registry = withV.registry || "docker.io";
      if (!withV.username) { log("##[error]Username and password required"); return "failure"; }
      if (!withV.password) { log("##[error]Username and password required"); return "failure"; }
      log(`Logging into ${registry === "docker.io" ? "Docker Hub" : registry}...`);
      const user = withV.username, token = withV.password;
      if (!D.tokenOk(registry, user, token, o.rsh) && !(registry === "ghcr.io" && token.startsWith("ghs_"))) {
        log(`##[error]Error response from daemon: Get "https://${registry === "docker.io" ? "registry-1.docker.io" : registry}/v2/": ${registry === "ghcr.io" ? "denied: denied" : "unauthorized: incorrect username or password"}`);
        return "failure";
      }
      const key = registry === "docker.io" ? "https://index.docker.io/v1/" : registry;
      e.auth[key] = { user, token };
      log("Login Succeeded!");
      o.posts.push({ name: s.uses, fn: async (L) => { L(`Logging out of ${registry === "docker.io" ? "Docker Hub" : registry}...\n[command]/usr/bin/docker logout ${registry === "docker.io" ? "" : registry}\nRemoving login credentials for ${key}`); delete e.auth[key]; } });
      return "success";
    };
    A["docker/metadata-action"] = async ({ log, group, o, withV }) => {
      group({ ...withV });
      const images = String(withV.images ?? "").split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
      if (!images.length) { log("##[warning]No Docker image version has been generated. Check tags input."); }
      const run = o.run;
      const ctx = o.exprCtx();
      const ref = run.ref;
      const sha = run.sha;
      const isTag = ref.startsWith("refs/tags/");
      const isPr = ref.startsWith("refs/pull/");
      const branch = ref.replace(/^refs\/heads\//, "");
      const def = ctx.github?.event?.repository?.default_branch ?? "main";
      log(`##[group]Context info\neventName: ${run.event}\nsha: ${sha}\nref: ${ref}\nworkflow: ${run.workflowName}\naction: __docker_metadata-action\nactor: ${run.actor}\nrunNumber: ${run.number}\nrunId: ${run.id}\ncommitDate: ${new Date(run.createdAt * 1000).toISOString()}\n##[endgroup]`);
      const specs = (withV.tags ? String(withV.tags).split("\n").map((x) => x.trim()).filter(Boolean) : ["type=schedule", "type=ref,event=branch", "type=ref,event=tag", "type=ref,event=pr"]);
      const tags = [];
      let version = "";
      const semver = (t) => /^v?(\d+)\.(\d+)\.(\d+)(?:-[\w.]+)?$/.exec(t);
      let latest = false;
      for (const spec of specs) {
        const kv = Object.fromEntries(spec.split(",").map((p) => { const i = p.indexOf("="); return [p.slice(0, i).trim(), p.slice(i + 1).trim()]; }));
        const enable = kv.enable === undefined ? true : String(kv.enable).replace("{{is_default_branch}}", String(branch === def && !isTag && !isPr)) === "true";
        if (!enable) continue;
        let val = null;
        if (kv.type === "ref" && kv.event === "branch" && !isTag && !isPr) val = branch.replace(/[^\w.-]/g, "-");
        else if (kv.type === "ref" && kv.event === "tag" && isTag) val = ref.slice(10);
        else if (kv.type === "ref" && kv.event === "pr" && isPr) val = `pr-${run.pr}`;
        else if (kv.type === "sha") val = `${kv.prefix ?? "sha-"}${sha.slice(0, Number(kv.format === "long" ? 40 : 7))}`;
        else if (kv.type === "raw") val = String(kv.value).replace("{{branch}}", branch).replace("{{sha}}", sha.slice(0, 7)).replace("{{is_default_branch}}", String(branch === def));
        else if (kv.type === "semver" && isTag) {
          const m = semver(ref.slice(10));
          if (m) { val = String(kv.pattern ?? "{{version}}").replace("{{version}}", `${m[1]}.${m[2]}.${m[3]}`).replace("{{major}}", m[1]).replace("{{minor}}", m[2]).replace("{{patch}}", m[3]); latest = true; }
        }
        if (val) { tags.push(val); if (!version) version = val; }
      }
      const flavor = String(withV.flavor ?? "latest=auto");
      if (/latest=true/.test(flavor) || (/latest=auto/.test(flavor) && latest)) tags.push("latest");
      log(`##[group]Processing images input\nname=${images.join("\nname=")}\n##[endgroup]`);
      log(`##[group]Processing tags input\n${specs.map((x) => x).join("\n")}\n##[endgroup]`);
      log(`##[group]Processing flavor input\nlatest=auto\nprefix=\nprefixLatest=false\nsuffix=\nsuffixLatest=false\n##[endgroup]`);
      log(`##[group]Docker image version\n${version}\n##[endgroup]`);
      const full = [];
      for (const img of images) for (const t of tags) full.push(`${img.toLowerCase()}:${t}`);
      log(`##[group]Docker tags\n${full.join("\n")}\n##[endgroup]`);
      const created = new Date(run.createdAt * 1000).toISOString();
      const repoUrl = `https://github.com/${o.owner}/${o.repo}`;
      const labels = {
        "org.opencontainers.image.created": created, "org.opencontainers.image.description": "", "org.opencontainers.image.licenses": "",
        "org.opencontainers.image.revision": sha, "org.opencontainers.image.source": repoUrl, "org.opencontainers.image.title": o.repo,
        "org.opencontainers.image.url": repoUrl, "org.opencontainers.image.version": version,
      };
      log(`##[group]Docker labels\n${Object.entries(labels).map(([k, v]) => `${k}=${v}`).join("\n")}\n##[endgroup]`);
      log(`##[group]Annotations\n${Object.entries(labels).map(([k, v]) => `manifest:${k}=${v}`).join("\n")}\n##[endgroup]`);
      log(`##[group]JSON output\n${JSON.stringify({ tags: full, labels }, null, 2)}\n##[endgroup]`);
      Object.assign(o.outputs, { version, tags: full.join("\n"), labels: Object.entries(labels).map(([k, v]) => `${k}=${v}`).join("\n"), json: JSON.stringify({ tags: full, labels }), annotations: Object.entries(labels).map(([k, v]) => `manifest:${k}=${v}`).join("\n") });
      return "success";
    };
    A["docker/build-push-action"] = async ({ log, group, o, withV }) => {
      group({ ...withV, "github-token": "***" });
      const e = runnerEngine(o);
      const push = String(withV.push ?? "false") === "true";
      const load = String(withV.load ?? "false") === "true";
      const tags = String(withV.tags ?? "").split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
      const labels = Object.fromEntries(String(withV.labels ?? "").split("\n").map((x) => x.trim()).filter(Boolean).map((kv) => { const i = kv.indexOf("="); return [kv.slice(0, i), kv.slice(i + 1)]; }));
      const platforms = String(withV.platforms ?? "").split(",").map((x) => x.trim()).filter(Boolean);
      // without a context input, the action builds the commit straight from GitHub (a Git context), not the checked-out folder
      const gitContext = !withV.context;
      const contextDir = gitContext ? `/home/runner/work/_temp/git-context-${o.run.sha.slice(0, 7)}` : withV.context;
      if (gitContext) {
        const files = await api.filesAt(o.rsh, o.rdir, o.run.sha);
        for (const [p, text] of files) { const abs = `${contextDir}/${p}`; D.mkdirp(o.rsh.fs, abs.slice(0, abs.lastIndexOf("/"))); await o.rsh.fs.writeFile(abs, text); }
      }
      log(`##[group]GitHub Actions runtime token ACs\nrefs/heads/${o.run.ref.replace(/^refs\/heads\//, "")}: read/write\n##[endgroup]`);
      log(`##[group]Docker info\n[command]/usr/bin/docker version\n##[endgroup]`);
      log(`##[group]Buildx version\n[command]/usr/bin/docker buildx version\ngithub.com/docker/buildx ${D.VERSION.buildx} 6f1b2a4\n##[endgroup]`);
      if (platforms.length > 1) log("(The sandbox builds for linux/amd64 only; on GitHub, this step builds every platform listed, using QEMU emulation for the ones the runner can't run natively.)");
      const ctxArg = gitContext ? `https://github.com/${o.owner}/${o.repo}.git#${o.run.sha}` : withV.context;
      log(`[command]/usr/bin/docker buildx build --iidfile /home/runner/work/_temp/docker-actions-toolkit/build-iidfile.txt${Object.entries(labels).map(([k, v]) => ` --label ${k}=${v}`).join("")}${platforms.length ? ` --platform ${platforms.join(",")}` : ""} --attest type=provenance,mode=max,builder-id=https://github.com/${o.owner}/${o.repo}/actions/runs/${o.run.id} ${tags.map((t) => `--tag ${t}`).join(" ")} --metadata-file /home/runner/work/_temp/docker-actions-toolkit/build-metadata.json${push ? " --push" : ""}${load ? " --load" : ""} ${ctxArg}`);
      let text = "";
      const r = await D.build(e, o.rsh, { context: contextDir, file: withV.file ? `${contextDir}/${withV.file.replace(/^\.\//, "")}` : undefined, tags, labels, push, load, target: withV.target }, (t) => { text += t; });
      for (const line of text.replace(/\n$/, "").split("\n")) log(line);
      if (!r.ok) { log(`##[error]buildx failed with: ${text.split("\n").filter((l) => l.startsWith("ERROR: ")).pop() ?? "ERROR: failed to build"}`); return "failure"; }
      if (push) {
        for (const t of tags) {
          const res = D.pushImage(e, o.rsh, t, r.image, null, { packagesWrite: o.permissions.packages === "write" });
          if (res.error) { log(`##[error]buildx failed with: ERROR: failed to build: failed to solve: failed to push ${D.parseRef(t).full}: ${res.error}`); return "failure"; }
        }
      }
      if (load) { e.images.set(r.image.id, r.image); for (const t of tags) D.setTag(e, t, r.image); }
      log(`##[group]Build summary\nBuild record will be uploaded as a workflow artifact: ${o.repo}~${D.hex(String(o.run.id)).slice(0, 6).toUpperCase()}.dockerbuild\n##[endgroup]`);
      Object.assign(o.outputs, { imageid: `sha256:${r.image.id}`, digest: `sha256:${r.image.id}`, metadata: JSON.stringify({ "containerimage.digest": `sha256:${r.image.id}`, "image.name": tags.join(",") }) });
      return "success";
    };
  }

  return { run };
}
