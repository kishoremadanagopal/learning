/* k8s.js: Kubernetes 1.37 in the sandbox, with kind v0.33.0 and kubectl v1.37.1, on top of the pretend Docker (docker.js).
   - kind creates clusters whose nodes are Docker containers (kindest/node:v1.37.0) on the `kind` network, writes
     ~/.kube/config, loads images from Docker into the nodes and deletes clusters
   - each node runs its pods' containers in its own container runtime (a separate engine, invisible to `docker ps`),
     so a pod really runs the image's program: the shop's node server.js, nginx, BusyBox commands
   - an API with the usual objects (pods, deployments, replica sets, services, endpoint slices, config maps, secrets,
     namespaces, events, horizontal pod autoscalers, jobs, cron jobs, persistent volume claims), with the API server's
     defaults and validation, and controllers (deployments with rolling updates and rollbacks, replica sets, jobs,
     cron jobs, autoscaling, endpoint slices, volume binding, garbage collection), a scheduler and a kubelet (image
     pulls with back-off, restarts with CrashLoopBackOff, probes, out-of-memory kills, graceful termination)
   - cluster networking: pod IPs, service IPs and DNS names, load balancing to ready pods, NodePorts and
     kubectl port-forward
   - kubectl's commands and output formats (tables, describe, -o yaml/json/jsonpath/name, errors and warnings), read
     from kubectl's source code
   It's a teaching simulation: time moves on a second or two with each command, and commands that wait (rollout
   status, wait, delete) move it on until they're done. */
import { parseDocument } from "./yamllib.js?v=9640047aae";

export function installKubernetes(D, api) {
  const { registerCommand, addHelpers, NET } = api;
  const V = { k8s: "v1.37.0", kubectl: "v1.37.1", kustomize: "v5.8.1", kind: "v0.33.0", kindGo: "go1.26.5", containerd: "2.3.4", coredns: "v1.14.6", pause: "3.10.2", etcd: "3.7.0-0" };
  const NODE_IMAGE = "kindest/node:v1.37.0";
  const NODE_DIGEST = "a1ed56cfb0e7b93589bdf97c8cd566405a265939e3620fc4f5de89adff580ae5";
  const HOME = "/home/learner";

  /* ------------------------------------------------------------ images: the kind node, BusyBox */

  D.HUB["kindest/node"] = {
    tags: { "v1.37.0": "n" },
    images: {
      n: {
        digest: NODE_DIGEST, content: 431280011, unpacked: 1093000000, created: "2026-08-26T19:12:44Z", layers: [117204810, 314075201], os: "debian",
        bins: ["sh", "bash", "ls", "cat", "echo", "env", "printenv", "ps", "mkdir", "rm", "grep", "hostname", "uname", "crictl", "systemctl", "mount", "ip"],
        files: { "/usr/local/bin/entrypoint": "#!/bin/bash\n# kind's node entrypoint: fixes up the container, then starts systemd\n", "/sbin/init": "(systemd)", "/etc/os-release": 'PRETTY_NAME="Debian GNU/Linux 13 (trixie)"\nNAME="Debian GNU/Linux"\nVERSION_ID="13"\nVERSION="13 (trixie)"\nVERSION_CODENAME=trixie\nID=debian\nHOME_URL="https://www.debian.org/"\n', "/kind/version": V.k8s + "\n" },
        config: { Env: ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", "container=docker"], Entrypoint: ["/usr/local/bin/entrypoint", "/sbin/init"], StopSignal: "SIGRTMIN+3" },
        history: [["# debian.sh --arch 'amd64' out/ 'trixie' '@1755216000'", 85000000], ["COPY --chmod=0755 files/usr/local/bin/* /usr/local/bin/ # buildkit", 5800], ["RUN /bin/sh -c ... install containerd, runc, crictl, CNI plugins # buildkit", 182000000], ["ENTRYPOINT [\"/usr/local/bin/entrypoint\" \"/sbin/init\"]", 0], ["STOPSIGNAL SIGRTMIN+3", 0], ["COPY kubernetes binaries and images # buildkit", 826000000]],
      },
    },
  };
  D.HUB["library/busybox"] = {
    tags: Object.fromEntries(["1.37", "1.37.0", "latest", "stable", "1", "1.37-musl", "musl"].map((t) => [t, "b"])),
    images: { b: { digest: "d82f458899c9696cb26a7c02d5568f81c8c8223f8661bb2a7988b269c8b9051e", content: 2223685, unpacked: 4430000, created: "2026-09-26T21:31:42Z", layers: [2223685], os: "alpine", busybox: true, bins: [...D.BUSYBOX, "nslookup", "ping", "top", "vi", "netstat"], config: { Env: ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"], Cmd: ["sh"] }, history: [["ADD busybox.tar.xz / # buildkit", 4430000], ['CMD ["sh"]', 0]] } },
  };

  /* ------------------------------------------------------------ small helpers */

  // a deterministic random generator per Docker engine (names, UIDs, IPs)
  function rnd(e) {
    const k = (e.k8s ??= { clusters: new Map(), seed: 0x2f6b9c13 });
    k.seed ^= k.seed << 13; k.seed ^= k.seed >>> 17; k.seed ^= k.seed << 5;
    return (k.seed >>> 0) / 4294967296;
  }
  const ALNUM = "bcdfghjklmnpqrstvwxz2456789";     // k8s.io/apimachinery/pkg/util/rand's alphabet (no vowels, no 0, 1, 3)
  const rand5 = (e, n = 5) => Array.from({ length: n }, () => ALNUM[Math.floor(rnd(e) * ALNUM.length)]).join("");
  const hexr = (e, n) => Array.from({ length: n }, () => Math.floor(rnd(e) * 16).toString(16)).join("");
  const newUid = (e) => { const h = hexr(e, 32); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${"89ab"[Math.floor(rnd(e) * 4)]}${h.slice(17, 20)}-${h.slice(20, 32)}`; };
  // the pod-template-hash: FNV-32a of the template, written with SafeEncodeString (so only 4–9, b, c, d, f appear)
  function templateHash(tpl, collisions = 0) {
    let h = 0x811c9dc5;
    const s = canon(tpl) + (collisions ? String(collisions) : "");
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return String(h).split("").map((ch) => ALNUM[ch.charCodeAt(0) % ALNUM.length]).join("");
  }
  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  // JSON with sorted keys (stable comparisons, last-applied-configuration)
  function canon(x) {
    if (Array.isArray(x)) return "[" + x.map(canon).join(",") + "]";
    if (x && typeof x === "object") return "{" + Object.keys(x).sort().filter((k) => x[k] !== undefined).map((k) => JSON.stringify(k) + ":" + canon(x[k])).join(",") + "}";
    return JSON.stringify(x);
  }
  const same = (a, b) => canon(a) === canon(b);

  // time: the Docker clock in seconds; RFC 3339 and the format kubectl describe uses
  const rfc = (t) => new Date(Math.floor(t) * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const longTime = (t) => { const d = new Date(Math.floor(t) * 1000); const p = (n) => String(n).padStart(2, "0"); return `${DAYS[d.getUTCDay()]}, ${p(d.getUTCDate())} ${MONS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} +0000`; };
  // k8s.io/apimachinery/pkg/util/duration.HumanDuration
  function age(sec) {
    const s = Math.max(0, Math.floor(sec));
    if (s < 120) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 10) return s % 60 === 0 ? `${m}m` : `${m}m${s % 60}s`;
    if (m < 180) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 8) return m % 60 === 0 ? `${h}h` : `${h}h${m % 60}m`;
    if (h < 48) return `${h}h`;
    const d = Math.floor(h / 24);
    if (h < 24 * 8) return h % 24 === 0 ? `${d}d` : `${d}d${h % 24}h`;
    if (d < 365 * 2) return `${d}d`;
    return `${Math.floor(d / 365)}y`;
  }
  // Go's time.Duration printing, truncated to milliseconds ("4.563s", "812ms")
  const goDur = (ms) => (ms < 1000 ? `${Math.round(ms)}ms` : `${(Math.floor(ms) / 1000).toString()}s`);

  // Go's text/tabwriter: cells end at \t; a column block is a run of consecutive lines with a cell in that column
  function tabwrite(text, { padding = 3, minwidth = 6 } = {}) {
    const lines = text.split("\n").map((l) => l.split("\t"));
    const widths = lines.map((cells) => new Array(Math.max(0, cells.length - 1)).fill(0));
    const format = (start, end, col) => {
      let i = start;
      while (i < end) {
        if (lines[i].length - 1 <= col) { i++; continue; }
        let j = i;
        let w = minwidth;
        while (j < end && lines[j].length - 1 > col) { w = Math.max(w, [...lines[j][col]].length + padding); j++; }
        for (let k = i; k < j; k++) widths[k][col] = w;
        format(i, j, col + 1);
        i = j;
      }
    };
    format(0, lines.length, 0);
    return lines.map((cells, i) => cells.map((c, k) => (k < cells.length - 1 ? c + " ".repeat(Math.max(0, widths[i][k] - [...c].length)) : c)).join("")).join("\n");
  }
  // kubectl get's tables (tabwriter 6, 4, 3), with trailing spaces removed the way a terminal shows them
  const table = (rows) => tabwrite(rows.map((r) => r.join("\t") + "\t").join("\n"), { padding: 3, minwidth: 6 }).split("\n").map((l) => l.replace(/\s+$/, "")).join("\n") + "\n";
  // kubectl describe's layout (tabwriter 0, 8, 2)
  const describeText = (text) => tabwrite(text, { padding: 2, minwidth: 0 });

  // resource quantities: CPU in millicores, memory in bytes
  function cpuMilli(q) {
    if (q === undefined || q === null) return null;
    const s = String(q);
    if (/^\d+(\.\d+)?m$/.test(s)) return Number(s.slice(0, -1));
    if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s) * 1000);
    return NaN;
  }
  const MEM = { Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4, k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12, m: 1e-3 };
  function memBytes(q) {
    if (q === undefined || q === null) return null;
    const m = /^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti|k|K|M|G|T|m)?$/.exec(String(q));
    if (!m) return NaN;
    return Math.round(Number(m[1]) * (m[2] ? MEM[m[2]] : 1));
  }
  const validQuantity = (q) => /^[+-]?(\d+(\.\d*)?|\.\d+)(m|k|M|G|T|P|E|Ki|Mi|Gi|Ti|Pi|Ei|e\d+)?$/.test(String(q));

  // label selectors: "app=shop,tier!=web", "env in (a,b)", "!canary", "app"
  function parseSelector(s) {
    const reqs = [];
    const parts = [];
    let depth = 0, cur = "";
    for (const ch of String(s ?? "")) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && !depth) { parts.push(cur); cur = ""; } else cur += ch; }
    if (cur.trim()) parts.push(cur);
    for (const raw of parts) {
      const p = raw.trim();
      let m;
      if ((m = /^([\w./-]+)\s+(in|notin)\s+\(([^)]*)\)$/.exec(p))) reqs.push({ key: m[1], op: m[2], values: m[3].split(",").map((v) => v.trim()) });
      else if ((m = /^([\w./-]+)\s*(==|=|!=)\s*([\w.-]*)$/.exec(p))) reqs.push({ key: m[1], op: m[2] === "!=" ? "!=" : "=", values: [m[3]] });
      else if ((m = /^!([\w./-]+)$/.exec(p))) reqs.push({ key: m[1], op: "!" });
      else if ((m = /^([\w./-]+)$/.exec(p))) reqs.push({ key: m[1], op: "exists" });
      else return { error: `unable to parse requirement: found '${p}', expected: identifier` };
    }
    return { reqs };
  }
  function matches(labels, sel) {
    const l = labels ?? {};
    return sel.reqs.every((r) => {
      const has = Object.prototype.hasOwnProperty.call(l, r.key);
      if (r.op === "=") return has && l[r.key] === r.values[0];
      if (r.op === "!=") return !has || l[r.key] !== r.values[0];
      if (r.op === "in") return has && r.values.includes(l[r.key]);
      if (r.op === "notin") return !has || !r.values.includes(l[r.key]);
      if (r.op === "!") return !has;
      return has;
    });
  }
  const matchLabelsOk = (labels, ml) => Object.entries(ml ?? {}).every(([k, v]) => (labels ?? {})[k] === v);
  function selectorMatch(labels, ls) {
    if (!ls) return false;
    if (!matchLabelsOk(labels, ls.matchLabels)) return false;
    for (const ex of ls.matchExpressions ?? []) {
      const op = { In: "in", NotIn: "notin", Exists: "exists", DoesNotExist: "!" }[ex.operator];
      if (!matches(labels, { reqs: [{ key: ex.key, op, values: ex.values ?? [] }] })) return false;
    }
    return true;
  }
  const labelString = (l) => (l && Object.keys(l).length ? Object.keys(l).sort().map((k) => `${k}=${l[k]}`).join(",") : "<none>");

  /* ------------------------------------------------------------ YAML and JSON the way kubectl prints them */

  // sigs.k8s.io/yaml (go-yaml): sorted keys, "- " at the parent's indentation, quotes only where needed
  const YAML11 = /^(y|Y|yes|Yes|YES|n|N|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF|null|Null|NULL|~|[-+]?(0|[1-9][0-9_]*)|[-+]?0[0-7_]+|[-+]?0x[0-9a-fA-F_]+|[-+]?([0-9][0-9_]*)?\.[0-9_]*([eE][-+][0-9]+)?|[-+]?\.(inf|Inf|INF)|\.(nan|NaN|NAN)|\d{4}-\d\d?-\d\d?([Tt ].*)?|[-+]?[0-9]+e[-+]?[0-9]+)$/;
  function yamlScalar(s) {
    if (s === null || s === undefined) return "null";
    if (typeof s === "number" || typeof s === "boolean") return String(s);
    if (s === "") return '""';
    if (YAML11.test(s)) return JSON.stringify(s);
    if (/[\u0000-\u0008\u000b-\u001f\u007f]/.test(s)) return JSON.stringify(s);
    const plain = !/^[\s\-?:,[\]{}#&*!|>'"%@`]/.test(s) || /^-[^\s]/.test(s) && !/^--- |^---$/.test(s);
    if (plain && !/: |\s#|:$|\s$|\t/.test(s) && !/^[-?:]$/.test(s)) return s;
    return `'${s.replace(/'/g, "''")}'`;
  }
  function toYaml(v, indent = 0) {
    const pad = " ".repeat(indent);
    if (Array.isArray(v)) {
      if (!v.length) return "[]";
      return v.map((item) => {
        if (item && typeof item === "object" && !Array.isArray(item) && Object.keys(item).length) {
          const body = toYaml(item, indent + 2);
          return pad + "- " + body.slice(indent + 2);
        }
        return pad + "- " + (item && typeof item === "object" ? toYaml(item, indent + 2).trimStart() : yamlScalar(item));
      }).join("\n");
    }
    if (v && typeof v === "object") {
      const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
      if (!keys.length) return "{}";
      return keys.map((k) => {
        const x = v[k];
        const key = pad + yamlScalar(k) + ":";
        if (typeof x === "string" && x.includes("\n")) return `${key} |${x.endsWith("\n") ? "" : "-"}\n` + x.replace(/\n$/, "").split("\n").map((l) => (l ? pad + "  " + l : "")).join("\n");
        if (Array.isArray(x)) return x.length ? `${key}\n${toYaml(x, indent)}` : `${key} []`;
        if (x && typeof x === "object") return Object.keys(x).length ? `${key}\n${toYaml(x, indent + 2)}` : `${key} {}`;
        return `${key} ${yamlScalar(x)}`;
      }).join("\n");
    }
    return pad + yamlScalar(v);
  }
  const yamlDoc = (v) => toYaml(v) + "\n";
  const jsonDoc = (v) => JSON.stringify(v, null, 4) + "\n";

  // kubectl's JSONPath: {.a.b}, {.items[*].x}, {.items[0].x}, {range .items[*]}…{end}, quoted text and \n
  function jsonpath(tpl, data) {
    const toks = [];
    const re = /\{([^{}]*)\}/g;
    let last = 0, m;
    while ((m = re.exec(tpl))) { if (m.index > last) toks.push({ text: tpl.slice(last, m.index) }); toks.push({ expr: m[1].trim() }); last = re.lastIndex; }
    if (last < tpl.length) toks.push({ text: tpl.slice(last) });
    const evalPath = (expr, ctx) => {
      if (expr === "" || expr === "." || expr === "@") return [ctx];
      const steps = [];
      const sre = /\.([^.[\]]+)|\[(\*|-?\d+|'[^']*'|"[^"]*")\]/g;
      let s;
      const e = expr.replace(/^@/, "").replace(/^\$/, "");
      while ((s = sre.exec(e))) steps.push(s[1] ?? s[2]);
      let cur = [ctx];
      for (const st of steps) {
        const next = [];
        for (const c of cur) {
          if (c === undefined || c === null) continue;
          if (st === "*") { if (Array.isArray(c)) next.push(...c); else if (typeof c === "object") next.push(...Object.values(c)); }
          else if (/^-?\d+$/.test(st)) { const i = Number(st); if (Array.isArray(c)) { const v = c[i < 0 ? c.length + i : i]; if (v !== undefined) next.push(v); } }
          else { const k = st.replace(/^['"]|['"]$/g, "").replace(/\\\./g, "."); if (typeof c === "object" && k in c) next.push(c[k]); }
        }
        cur = next;
      }
      return cur;
    };
    const fmt = (v) => (typeof v === "string" ? v : JSON.stringify(v));
    let out = "";
    const run = (list, ctx) => {
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (t.text !== undefined) { out += t.text; continue; }
        if (/^range\s/.test(t.expr)) {
          let depth = 1, j = i + 1;
          for (; j < list.length; j++) { if (list[j].expr && /^range\s/.test(list[j].expr)) depth++; if (list[j].expr === "end" && !--depth) break; }
          for (const item of evalPath(t.expr.replace(/^range\s+/, ""), ctx)) run(list.slice(i + 1, j), item);
          i = j;
          continue;
        }
        if (/^"(.*)"$/.test(t.expr)) { out += JSON.parse(t.expr); continue; }
        out += evalPath(t.expr, ctx).map(fmt).join(" ");
      }
    };
    run(toks, data);
    return out;
  }

  const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
  const unb64 = (s) => { try { return new TextDecoder().decode(Uint8Array.from(atob(String(s).replace(/\s/g, "")), (c) => c.charCodeAt(0))); } catch { return null; } };

  /* ------------------------------------------------------------ the API's resource types */

  const RES = {
    pods: { kind: "Pod", group: "", version: "v1", short: ["po", "pod"] },
    deployments: { kind: "Deployment", group: "apps", version: "v1", short: ["deploy", "deployment"] },
    replicasets: { kind: "ReplicaSet", group: "apps", version: "v1", short: ["rs", "replicaset"] },
    daemonsets: { kind: "DaemonSet", group: "apps", version: "v1", short: ["ds", "daemonset"] },
    statefulsets: { kind: "StatefulSet", group: "apps", version: "v1", short: ["sts", "statefulset"] },
    services: { kind: "Service", group: "", version: "v1", short: ["svc", "service"] },
    endpoints: { kind: "Endpoints", group: "", version: "v1", short: ["ep"] },
    endpointslices: { kind: "EndpointSlice", group: "discovery.k8s.io", version: "v1", short: ["endpointslice"] },
    configmaps: { kind: "ConfigMap", group: "", version: "v1", short: ["cm", "configmap"] },
    secrets: { kind: "Secret", group: "", version: "v1", short: ["secret"] },
    serviceaccounts: { kind: "ServiceAccount", group: "", version: "v1", short: ["sa", "serviceaccount"] },
    namespaces: { kind: "Namespace", group: "", version: "v1", cluster: true, short: ["ns", "namespace"] },
    nodes: { kind: "Node", group: "", version: "v1", cluster: true, short: ["no", "node"] },
    events: { kind: "Event", group: "", version: "v1", short: ["ev", "event"] },
    horizontalpodautoscalers: { kind: "HorizontalPodAutoscaler", group: "autoscaling", version: "v2", short: ["hpa", "horizontalpodautoscaler"] },
    jobs: { kind: "Job", group: "batch", version: "v1", short: ["job"] },
    cronjobs: { kind: "CronJob", group: "batch", version: "v1", short: ["cj", "cronjob"] },
    persistentvolumeclaims: { kind: "PersistentVolumeClaim", group: "", version: "v1", short: ["pvc", "persistentvolumeclaim"] },
    persistentvolumes: { kind: "PersistentVolume", group: "", version: "v1", cluster: true, short: ["pv", "persistentvolume"] },
    storageclasses: { kind: "StorageClass", group: "storage.k8s.io", version: "v1", cluster: true, short: ["sc", "storageclass"] },
    ingresses: { kind: "Ingress", group: "networking.k8s.io", version: "v1", short: ["ing", "ingress"] },
  };
  const singular = (r) => RES[r].kind.toLowerCase();
  const kindString = (r) => (RES[r].group ? `${singular(r)}.${RES[r].group}` : singular(r));       // deployment.apps
  const pluralString = (r) => (RES[r].group ? `${r}.${RES[r].group}` : r);                          // deployments.apps
  const apiVersionOf = (r) => (RES[r].group ? `${RES[r].group}/${RES[r].version}` : RES[r].version);
  const resOfKind = (kind) => Object.keys(RES).find((r) => RES[r].kind === kind);
  // "po", "pods", "deploy", "deployment.apps", "hpa"
  function resolveRes(word) {
    const w = String(word).toLowerCase().replace(/\.(apps|batch|autoscaling|discovery\.k8s\.io|storage\.k8s\.io|networking\.k8s\.io)$/, "");
    for (const r of Object.keys(RES)) if (r === w || RES[r].short.includes(w)) return r;
    return null;
  }

  /* ------------------------------------------------------------ clusters and their objects */

  const kstate = (e) => (e.k8s ??= { clusters: new Map(), seed: 0x2f6b9c13 });
  const key = (r, ns, name) => `${r}/${RES[r].cluster ? "" : ns}/${name}`;
  const nowOf = (cl) => D.now(cl.e);
  // a counter of milliseconds within the current second, for event and log timestamps
  function list(cl, r, ns = null) {
    const out = [];
    for (const [k, o] of cl.objs) if (k.startsWith(r + "/") && (ns === null || RES[r].cluster || o.metadata.namespace === ns)) out.push(o);
    return out.sort((a, b) => (a.metadata.namespace ?? "").localeCompare(b.metadata.namespace ?? "") || a.metadata.name.localeCompare(b.metadata.name));
  }
  const getObj = (cl, r, ns, name) => cl.objs.get(key(r, ns, name)) ?? null;
  function putObj(cl, r, obj, { fresh = false } = {}) {
    const m = obj.metadata;
    if (fresh) {
      m.uid ??= newUid(cl.e);
      m.creationTimestamp ??= rfc(nowOf(cl));
      m.created = undefined;
    }
    m.resourceVersion = String(++cl.rv);
    cl.objs.set(key(r, m.namespace, m.name), obj);
    return obj;
  }
  function delObj(cl, r, obj) { cl.objs.delete(key(r, obj.metadata.namespace, obj.metadata.name)); }
  const created = (o) => Date.parse(o.metadata.creationTimestamp) / 1000;
  const ownedBy = (o, owner) => (o.metadata.ownerReferences ?? []).some((x) => x.uid === owner.metadata.uid);
  const ownerRef = (r, owner) => ({ apiVersion: apiVersionOf(r), blockOwnerDeletion: true, controller: true, kind: RES[r].kind, name: owner.metadata.name, uid: owner.metadata.uid });

  // events, merged the way the event recorder does it: the same reason and message on one object counts up
  function event(cl, obj, type, reason, message, source) {
    const r = resOfKind(obj.kind);
    const t = nowOf(cl);
    const ns = obj.metadata.namespace ?? "default";
    const found = cl.events.find((x) => x.obj.uid === obj.metadata.uid && x.reason === reason && x.message === message && x.source === source);
    if (found) { found.count++; found.last = t; found.lastSeq = ++cl.evSeq; return; }
    cl.events.push({ name: `${obj.metadata.name}.${hexr(cl.e, 16)}`, ns, obj: { kind: obj.kind, name: obj.metadata.name, uid: obj.metadata.uid, ns: obj.metadata.namespace, r }, type, reason, message, source, first: t, last: t, count: 1, seq: ++cl.evSeq, lastSeq: cl.evSeq });
  }
  const eventsOf = (cl, obj) => cl.events.filter((x) => x.obj.uid === obj.metadata.uid).sort((a, b) => a.seq - b.seq);

  /* ------------------------------------------------------------ decoding: the API's field names and types */

  // strict decoding knows every field: unknown ones are errors, and wrong types fail like Go's encoding/json
  const S = "string", I32 = "int32", I64 = "int64", B = "bool", IOS = "intstr", Q = "quantity", MAP = "map", ANY = "any", TIME = "time";
  const T = (name, fields) => ({ name, fields });
  const QMAP = { quantities: true };
  const Meta = T("ObjectMeta", { name: S, generateName: S, namespace: S, labels: MAP, annotations: MAP, uid: S, resourceVersion: S, generation: I64, creationTimestamp: TIME, deletionTimestamp: TIME, deletionGracePeriodSeconds: I64, ownerReferences: [ANY], finalizers: [S], managedFields: [ANY] });
  const LabelSelector = T("LabelSelector", { matchLabels: MAP, matchExpressions: [T("LabelSelectorRequirement", { key: S, operator: S, values: [S] })] });
  const KeyRef = (n) => T(n, { name: S, key: S, optional: B });
  const EnvVar = T("EnvVar", { name: S, value: S, valueFrom: T("EnvVarSource", { configMapKeyRef: KeyRef("ConfigMapKeySelector"), secretKeyRef: KeyRef("SecretKeySelector"), fieldRef: T("ObjectFieldSelector", { apiVersion: S, fieldPath: S }), resourceFieldRef: T("ResourceFieldSelector", { containerName: S, resource: S, divisor: Q }) }) });
  const EnvFrom = T("EnvFromSource", { prefix: S, configMapRef: T("ConfigMapEnvSource", { name: S, optional: B }), secretRef: T("SecretEnvSource", { name: S, optional: B }) });
  const HTTPGet = T("HTTPGetAction", { path: S, port: IOS, host: S, scheme: S, httpHeaders: [T("HTTPHeader", { name: S, value: S })] });
  const Probe = T("Probe", { httpGet: HTTPGet, tcpSocket: T("TCPSocketAction", { port: IOS, host: S }), exec: T("ExecAction", { command: [S] }), grpc: T("GRPCAction", { port: I32, service: S }), initialDelaySeconds: I32, timeoutSeconds: I32, periodSeconds: I32, successThreshold: I32, failureThreshold: I32, terminationGracePeriodSeconds: I64 });
  const Resources = T("ResourceRequirements", { limits: QMAP, requests: QMAP, claims: [ANY] });
  const SecCtx = T("SecurityContext", { runAsUser: I64, runAsGroup: I64, runAsNonRoot: B, readOnlyRootFilesystem: B, allowPrivilegeEscalation: B, privileged: B, capabilities: T("Capabilities", { add: [S], drop: [S] }), seccompProfile: T("SeccompProfile", { type: S, localhostProfile: S }) });
  const Container = T("Container", {
    name: S, image: S, command: [S], args: [S], workingDir: S,
    ports: [T("ContainerPort", { name: S, containerPort: I32, hostPort: I32, protocol: S, hostIP: S })],
    env: [EnvVar], envFrom: [EnvFrom], resources: Resources, resizePolicy: [ANY], restartPolicy: S,
    volumeMounts: [T("VolumeMount", { name: S, mountPath: S, readOnly: B, subPath: S, recursiveReadOnly: S, mountPropagation: S, subPathExpr: S })],
    livenessProbe: Probe, readinessProbe: Probe, startupProbe: Probe, lifecycle: ANY,
    terminationMessagePath: S, terminationMessagePolicy: S, imagePullPolicy: S, securityContext: SecCtx, stdin: B, stdinOnce: B, tty: B,
  });
  const Volume = T("Volume", {
    name: S, emptyDir: T("EmptyDirVolumeSource", { medium: S, sizeLimit: Q }),
    configMap: T("ConfigMapVolumeSource", { name: S, items: [T("KeyToPath", { key: S, path: S, mode: I32 })], defaultMode: I32, optional: B }),
    secret: T("SecretVolumeSource", { secretName: S, items: [T("KeyToPath", { key: S, path: S, mode: I32 })], defaultMode: I32, optional: B }),
    persistentVolumeClaim: T("PersistentVolumeClaimVolumeSource", { claimName: S, readOnly: B }),
    hostPath: T("HostPathVolumeSource", { path: S, type: S }), projected: ANY, downwardAPI: ANY,
  });
  const PodSpec = T("PodSpec", {
    containers: [Container], initContainers: [Container], volumes: [Volume], restartPolicy: S, terminationGracePeriodSeconds: I64,
    activeDeadlineSeconds: I64, dnsPolicy: S, nodeSelector: MAP, serviceAccountName: S, serviceAccount: S, automountServiceAccountToken: B,
    nodeName: S, hostNetwork: B, securityContext: T("PodSecurityContext", { runAsUser: I64, runAsGroup: I64, runAsNonRoot: B, fsGroup: I64, seccompProfile: ANY }),
    imagePullSecrets: [T("LocalObjectReference", { name: S })], hostname: S, subdomain: S, affinity: ANY, schedulerName: S, tolerations: [ANY],
    priorityClassName: S, priority: I32, enableServiceLinks: B, preemptionPolicy: S, topologySpreadConstraints: [ANY], shareProcessNamespace: B, resources: Resources,
  });
  const PodTemplate = T("PodTemplateSpec", { metadata: Meta, spec: PodSpec });
  const SCHEMAS = {
    Pod: T("Pod", { apiVersion: S, kind: S, metadata: Meta, spec: PodSpec, status: ANY }),
    Deployment: T("Deployment", { apiVersion: S, kind: S, metadata: Meta, status: ANY, spec: T("DeploymentSpec", {
      replicas: I32, selector: LabelSelector, template: PodTemplate, minReadySeconds: I32, revisionHistoryLimit: I32, paused: B, progressDeadlineSeconds: I32,
      strategy: T("DeploymentStrategy", { type: S, rollingUpdate: T("RollingUpdateDeployment", { maxUnavailable: IOS, maxSurge: IOS }) }),
    }) }),
    ReplicaSet: T("ReplicaSet", { apiVersion: S, kind: S, metadata: Meta, status: ANY, spec: T("ReplicaSetSpec", { replicas: I32, minReadySeconds: I32, selector: LabelSelector, template: PodTemplate }) }),
    Service: T("Service", { apiVersion: S, kind: S, metadata: Meta, status: ANY, spec: T("ServiceSpec", {
      ports: [T("ServicePort", { name: S, protocol: S, appProtocol: S, port: I32, targetPort: IOS, nodePort: I32 })],
      selector: MAP, clusterIP: S, clusterIPs: [S], type: S, externalIPs: [S], sessionAffinity: S, loadBalancerIP: S, externalName: S,
      externalTrafficPolicy: S, internalTrafficPolicy: S, ipFamilies: [S], ipFamilyPolicy: S, publishNotReadyAddresses: B, trafficDistribution: S, allocateLoadBalancerNodePorts: B, loadBalancerClass: S, sessionAffinityConfig: ANY,
    }) }),
    ConfigMap: T("ConfigMap", { apiVersion: S, kind: S, metadata: Meta, data: MAP, binaryData: ANY, immutable: B }),
    Secret: T("Secret", { apiVersion: S, kind: S, metadata: Meta, data: MAP, stringData: MAP, type: S, immutable: B }),
    Namespace: T("Namespace", { apiVersion: S, kind: S, metadata: Meta, spec: ANY, status: ANY }),
    ServiceAccount: T("ServiceAccount", { apiVersion: S, kind: S, metadata: Meta, secrets: [ANY], imagePullSecrets: [ANY], automountServiceAccountToken: B }),
    HorizontalPodAutoscaler: T("HorizontalPodAutoscaler", { apiVersion: S, kind: S, metadata: Meta, status: ANY, spec: T("HorizontalPodAutoscalerSpec", {
      scaleTargetRef: T("CrossVersionObjectReference", { kind: S, name: S, apiVersion: S }), minReplicas: I32, maxReplicas: I32, behavior: ANY,
      metrics: [T("MetricSpec", { type: S, resource: T("ResourceMetricSource", { name: S, target: T("MetricTarget", { type: S, averageUtilization: I32, averageValue: Q, value: Q }) }), pods: ANY, object: ANY, external: ANY, containerResource: ANY })],
    }) }),
    Job: T("Job", { apiVersion: S, kind: S, metadata: Meta, status: ANY, spec: T("JobSpec", { template: PodTemplate, completions: I32, parallelism: I32, backoffLimit: I32, activeDeadlineSeconds: I64, ttlSecondsAfterFinished: I32, selector: LabelSelector, manualSelector: B, completionMode: S, suspend: B, podReplacementPolicy: S, backoffLimitPerIndex: I32, maxFailedIndexes: I32, podFailurePolicy: ANY, successPolicy: ANY }) }),
    CronJob: T("CronJob", { apiVersion: S, kind: S, metadata: Meta, status: ANY, spec: T("CronJobSpec", { schedule: S, timeZone: S, startingDeadlineSeconds: I64, concurrencyPolicy: S, suspend: B, successfulJobsHistoryLimit: I32, failedJobsHistoryLimit: I32, jobTemplate: T("JobTemplateSpec", { metadata: Meta, spec: ANY }) }) }),
    PersistentVolumeClaim: T("PersistentVolumeClaim", { apiVersion: S, kind: S, metadata: Meta, status: ANY, spec: T("PersistentVolumeClaimSpec", { accessModes: [S], resources: T("VolumeResourceRequirements", { requests: QMAP, limits: QMAP }), storageClassName: S, volumeName: S, volumeMode: S, selector: LabelSelector, dataSource: ANY }) }),
    Ingress: T("Ingress", { apiVersion: S, kind: S, metadata: Meta, spec: ANY, status: ANY }),
  };
  const QUANTITY_RE = "^([+-]?[0-9.]+)([eEinumkKMGTP]*[-+]?[0-9]*)$";
  // returns { unknown: ["spec.replica"], typeError: "json: cannot unmarshal …" }
  function decodeCheck(obj, schema) {
    const unknown = [];
    let typeError = null;
    const goType = { [S]: "string", [I32]: "int32", [I64]: "int64", [B]: "bool" };
    const jsType = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v === "number" ? "number" : typeof v === "boolean" ? "bool" : typeof v === "object" ? "object" : "string");
    const walk = (v, sch, path, jsonPath, structName) => {
      if (typeError || v === null || v === undefined || sch === ANY) return;
      if (Array.isArray(sch)) {
        if (!Array.isArray(v)) { typeError = `json: cannot unmarshal ${jsType(v)} into Go struct field ${structName}.${jsonPath} of type []${sch[0] && sch[0].name ? "v1." + sch[0].name : goType[sch[0]] ?? "string"}`; return; }
        v.forEach((x, i) => walk(x, sch[0], `${path}[${i}]`, jsonPath, structName));
        return;
      }
      if (sch === MAP) {
        if (typeof v !== "object" || Array.isArray(v)) { typeError = `json: cannot unmarshal ${jsType(v)} into Go struct field ${structName}.${jsonPath} of type map[string]string`; return; }
        for (const [k, x] of Object.entries(v)) if (typeof x !== "string" && x !== null) { typeError = `json: cannot unmarshal ${jsType(x)} into Go struct field ${structName}.${jsonPath} of type string`; return; }
        return;
      }
      if (sch === QMAP) {
        if (typeof v !== "object" || Array.isArray(v)) { typeError = `json: cannot unmarshal ${jsType(v)} into Go struct field ${structName}.${jsonPath} of type v1.ResourceList`; return; }
        for (const x of Object.values(v)) if (!(typeof x === "number" || (typeof x === "string" && validQuantity(x)))) { typeError = `quantities must match the regular expression '${QUANTITY_RE}'`; return; }
        return;
      }
      if (sch === Q) { if (!(typeof v === "number" || (typeof v === "string" && validQuantity(v)))) typeError = `quantities must match the regular expression '${QUANTITY_RE}'`; return; }
      if (sch === IOS) { if (typeof v !== "number" && typeof v !== "string") typeError = `json: cannot unmarshal ${jsType(v)} into Go struct field ${structName}.${jsonPath} of type intstr.IntOrString`; return; }
      if (sch === TIME) return;
      if (typeof sch === "string") {
        const want = sch === S ? "string" : sch === B ? "bool" : "number";
        if (jsType(v) !== want || (want === "number" && !Number.isInteger(v))) typeError = `json: cannot unmarshal ${jsType(v)} into Go struct field ${structName}.${jsonPath} of type ${goType[sch]}`;
        return;
      }
      if (typeof v !== "object" || Array.isArray(v)) { typeError = `json: cannot unmarshal ${jsType(v)} into Go struct field ${structName}.${jsonPath} of type v1.${sch.name}`; return; }
      for (const [k, x] of Object.entries(v)) {
        const sub = sch.fields[k];
        const p = path ? `${path}.${k}` : k;
        if (sub === undefined) { unknown.push(p); continue; }
        walk(x, sub, p, jsonPath ? `${jsonPath}.${k}` : k, sch.name);
      }
    };
    walk(obj, schema, "", "", schema.name);
    return { unknown, typeError };
  }

  /* ------------------------------------------------------------ the API server's defaults */

  const imageTag = (img) => { const s = String(img ?? "").split("@")[0]; const slash = s.lastIndexOf("/"); const c = s.lastIndexOf(":"); return c > slash ? s.slice(c + 1) : null; };
  const pullPolicyFor = (img) => (String(img).includes("@") ? "IfNotPresent" : !imageTag(img) || imageTag(img) === "latest" ? "Always" : "IfNotPresent");
  function defaultContainer(c) {
    c.imagePullPolicy ??= pullPolicyFor(c.image);
    for (const p of c.ports ?? []) p.protocol ??= "TCP";
    c.resources ??= {};
    // a limit with no request: the request equals the limit
    if (c.resources.limits) { c.resources.requests ??= {}; for (const [k, v] of Object.entries(c.resources.limits)) if (c.resources.requests[k] === undefined) c.resources.requests[k] = v; }
    for (const pr of ["livenessProbe", "readinessProbe", "startupProbe"]) {
      const p = c[pr];
      if (!p) continue;
      p.failureThreshold ??= 3; p.periodSeconds ??= 10; p.successThreshold ??= 1; p.timeoutSeconds ??= 1;
      if (p.httpGet) { p.httpGet.path ??= "/"; p.httpGet.scheme ??= "HTTP"; }
    }
    c.terminationMessagePath ??= "/dev/termination-log";
    c.terminationMessagePolicy ??= "File";
    for (const e of c.env ?? []) { if (e.valueFrom?.fieldRef) e.valueFrom.fieldRef.apiVersion ??= "v1"; }
    return c;
  }
  function defaultPodSpec(spec) {
    for (const c of spec.containers ?? []) defaultContainer(c);
    for (const c of spec.initContainers ?? []) defaultContainer(c);
    spec.dnsPolicy ??= "ClusterFirst";
    spec.restartPolicy ??= "Always";
    spec.schedulerName ??= "default-scheduler";
    spec.securityContext ??= {};
    spec.terminationGracePeriodSeconds ??= 30;
    for (const v of spec.volumes ?? []) {
      if (v.configMap) v.configMap.defaultMode ??= 420;
      if (v.secret) v.secret.defaultMode ??= 420;
    }
    return spec;
  }
  // what the API server adds to a new pod: the service account and its token volume, tolerations, priority
  function admitPod(cl, pod) {
    const s = pod.spec;
    defaultPodSpec(s);
    s.enableServiceLinks ??= true;
    s.preemptionPolicy ??= "PreemptLowerPriority";
    s.priority ??= 0;
    s.serviceAccountName ??= s.serviceAccount ?? "default";
    s.serviceAccount = s.serviceAccountName;
    s.tolerations ??= [];
    for (const k of ["node.kubernetes.io/not-ready", "node.kubernetes.io/unreachable"]) if (!s.tolerations.some((t) => t.key === k)) s.tolerations.push({ effect: "NoExecute", key: k, operator: "Exists", tolerationSeconds: 300 });
    if (s.automountServiceAccountToken !== false) {
      const vname = `kube-api-access-${rand5(cl.e)}`;
      s.volumes = [...(s.volumes ?? []), { name: vname, projected: { defaultMode: 420, sources: [{ serviceAccountToken: { expirationSeconds: 3607, path: "token" } }, { configMap: { items: [{ key: "ca.crt", path: "ca.crt" }], name: "kube-root-ca.crt" } }, { downwardAPI: { items: [{ fieldRef: { apiVersion: "v1", fieldPath: "metadata.namespace" }, path: "namespace" }] } }] } }];
      for (const c of s.containers) c.volumeMounts = [...(c.volumeMounts ?? []), { mountPath: "/var/run/secrets/kubernetes.io/serviceaccount", name: vname, readOnly: true }];
    }
    pod.status = { phase: "Pending", qosClass: qosClass(s) };
    return pod;
  }
  function qosClass(spec) {
    const cs = spec.containers ?? [];
    const any = cs.some((c) => Object.keys(c.resources?.requests ?? {}).length || Object.keys(c.resources?.limits ?? {}).length);
    if (!any) return "BestEffort";
    const guaranteed = cs.every((c) => ["cpu", "memory"].every((r) => c.resources?.limits?.[r] !== undefined && String(c.resources?.requests?.[r] ?? c.resources.limits[r]) === String(c.resources.limits[r])));
    return guaranteed ? "Guaranteed" : "Burstable";
  }
  function defaultObject(cl, r, o) {
    const s = o.spec;
    if (r === "deployments") {
      s.replicas ??= 1; s.revisionHistoryLimit ??= 10; s.progressDeadlineSeconds ??= 600;
      s.strategy ??= {};
      s.strategy.type ??= "RollingUpdate";
      if (s.strategy.type === "RollingUpdate") { s.strategy.rollingUpdate ??= {}; s.strategy.rollingUpdate.maxSurge ??= "25%"; s.strategy.rollingUpdate.maxUnavailable ??= "25%"; }
      defaultPodSpec(s.template.spec);
    }
    if (r === "replicasets") { s.replicas ??= 1; defaultPodSpec(s.template.spec); }
    if (r === "services") {
      s.type ??= "ClusterIP";
      s.sessionAffinity ??= "None";
      s.internalTrafficPolicy ??= "Cluster";
      if (s.type === "NodePort" || s.type === "LoadBalancer") s.externalTrafficPolicy ??= "Cluster";
      for (const p of s.ports ?? []) { p.protocol ??= "TCP"; p.targetPort ??= p.port; }
      o.status ??= { loadBalancer: {} };
    }
    if (r === "jobs") {
      s.backoffLimit ??= 6; s.completions ??= 1; s.parallelism ??= 1; s.completionMode ??= "NonIndexed"; s.suspend ??= false; s.manualSelector ??= undefined; s.podReplacementPolicy ??= "TerminatingOrFailed";
      s.template.spec.restartPolicy ??= "Never";
      defaultPodSpec(s.template.spec);
    }
    if (r === "cronjobs") {
      s.concurrencyPolicy ??= "Allow"; s.failedJobsHistoryLimit ??= 1; s.successfulJobsHistoryLimit ??= 3; s.suspend ??= false;
      s.jobTemplate ??= {}; s.jobTemplate.spec ??= {}; s.jobTemplate.spec.template ??= { spec: {} };
      s.jobTemplate.spec.template.spec.restartPolicy ??= "Never";
      defaultPodSpec(s.jobTemplate.spec.template.spec);
    }
    if (r === "secrets") {
      o.type ??= "Opaque";
      if (o.stringData) { o.data = { ...(o.data ?? {}) }; for (const [k, v] of Object.entries(o.stringData)) o.data[k] = b64(v); delete o.stringData; }
    }
    if (r === "persistentvolumeclaims") {
      s.volumeMode ??= "Filesystem";
      s.storageClassName ??= "standard";
      o.status ??= { phase: "Pending" };
    }
    if (r === "horizontalpodautoscalers") { s.minReplicas ??= 1; }
    if (r === "namespaces") { o.spec = { finalizers: ["kubernetes"] }; o.status = { phase: "Active" }; o.metadata.labels = { ...(o.metadata.labels ?? {}), "kubernetes.io/metadata.name": o.metadata.name }; }
    return o;
  }

  /* ------------------------------------------------------------ validation */

  const DNS1123_SUB = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
  const DNS1123_LABEL = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
  const subdomainMsg = (v) => `Invalid value: ${JSON.stringify(v)}: a lowercase RFC 1123 subdomain must consist of lower case alphanumeric characters, '-' or '.', and must start and end with an alphanumeric character (e.g. 'example.com', regex used for validation is '[a-z0-9]([-a-z0-9]*[a-z0-9])?(\\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*')`;
  const labelMsg = (v) => `Invalid value: ${JSON.stringify(v)}: a lowercase RFC 1123 label must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character (e.g. 'my-name',  or '123-abc', regex used for validation is '[a-z0-9]([-a-z0-9]*[a-z0-9])?')`;
  const goMap = (m) => `map[string]string{${Object.keys(m ?? {}).sort().map((k) => `${JSON.stringify(k)}:${JSON.stringify(m[k])}`).join(", ")}}`;
  function validatePodSpec(spec, p, errs, { template = false } = {}) {
    if (!spec || !Array.isArray(spec.containers) || !spec.containers.length) { errs.push(`${p}.containers: Required value`); return; }
    const vols = new Set((spec.volumes ?? []).map((v) => v.name));
    const names = new Set();
    spec.containers.forEach((c, i) => {
      const cp = `${p}.containers[${i}]`;
      if (!c.name) errs.push(`${cp}.name: Required value`);
      else if (!DNS1123_LABEL.test(c.name)) errs.push(`${cp}.name: ${labelMsg(c.name)}`);
      else if (names.has(c.name)) errs.push(`${cp}.name: Duplicate value: ${JSON.stringify(c.name)}`);
      names.add(c.name);
      if (!c.image) errs.push(`${cp}.image: Required value`);
      for (const [j, port] of (c.ports ?? []).entries()) if (!(port.containerPort >= 1 && port.containerPort <= 65535)) errs.push(`${cp}.ports[${j}].containerPort: Invalid value: ${port.containerPort ?? 0}: must be between 1 and 65535, inclusive`);
      for (const [j, e] of (c.env ?? []).entries()) if (!e.name) errs.push(`${cp}.env[${j}].name: Required value`);
      for (const [j, m] of (c.volumeMounts ?? []).entries()) if (!vols.has(m.name)) errs.push(`${cp}.volumeMounts[${j}].name: Not found: ${JSON.stringify(m.name)}`);
      const req = c.resources?.requests ?? {}, lim = c.resources?.limits ?? {};
      for (const res of ["cpu", "memory"]) {
        if (req[res] === undefined || lim[res] === undefined) continue;
        const a = res === "cpu" ? cpuMilli(req[res]) : memBytes(req[res]), b = res === "cpu" ? cpuMilli(lim[res]) : memBytes(lim[res]);
        if (a > b) errs.push(`${cp}.resources.requests: Invalid value: ${JSON.stringify(String(req[res]))}: must be less than or equal to ${res} limit of ${lim[res]}`);
      }
      for (const pr of ["livenessProbe", "readinessProbe", "startupProbe"]) {
        const pb = c[pr];
        if (!pb) continue;
        const kinds = ["httpGet", "tcpSocket", "exec", "grpc"].filter((k) => pb[k]);
        if (!kinds.length) errs.push(`${cp}.${pr}: Required value: must specify a handler type`);
        if (pb.httpGet && pb.httpGet.port === undefined) errs.push(`${cp}.${pr}.httpGet.port: Required value`);
      }
    });
    if (spec.restartPolicy && !["Always", "OnFailure", "Never"].includes(spec.restartPolicy)) errs.push(`${p}.restartPolicy: Unsupported value: ${JSON.stringify(spec.restartPolicy)}: supported values: "Always", "OnFailure", "Never"`);
    if (template === "job" && spec.restartPolicy === "Always") errs.push(`${p}.restartPolicy: Required value: valid values: "OnFailure", "Never"`);
    for (const [j, v] of (spec.volumes ?? []).entries()) if (!v.name) errs.push(`${p}.volumes[${j}].name: Required value`);
  }
  function validate(cl, r, o, old) {
    const errs = [];
    const name = o.metadata?.name;
    if (!name) errs.push("metadata.name: Required value: name or generateName is required");
    else if (["services", "namespaces"].includes(r) ? !DNS1123_LABEL.test(name) : !DNS1123_SUB.test(name)) errs.push(`metadata.name: ${["services", "namespaces"].includes(r) ? labelMsg(name).replace("a lowercase RFC 1123 label", r === "services" ? "a DNS-1035 label" : "a lowercase RFC 1123 label") : subdomainMsg(name)}`);
    const s = o.spec ?? {};
    if (r === "pods") validatePodSpec(s, "spec", errs);
    if (r === "deployments" || r === "replicasets") {
      if (!s.selector) errs.push("spec.selector: Required value");
      else if (!Object.keys(s.selector.matchLabels ?? {}).length && !(s.selector.matchExpressions ?? []).length) errs.push("spec.selector: Invalid value: v1.LabelSelector{MatchLabels:map[string]string(nil), MatchExpressions:[]v1.LabelSelectorRequirement(nil)}: empty selector is invalid for deployment");
      else if (!selectorMatch(s.template?.metadata?.labels, s.selector)) errs.push(`spec.template.metadata.labels: Invalid value: ${goMap(s.template?.metadata?.labels)}: \`selector\` does not match template \`labels\``);
      if (s.replicas !== undefined && s.replicas < 0) errs.push(`spec.replicas: Invalid value: ${s.replicas}: must be greater than or equal to 0`);
      validatePodSpec(s.template?.spec, "spec.template.spec", errs);
      if (old && s.selector && !same(old.spec.selector, s.selector)) errs.push(`spec.selector: Invalid value: v1.LabelSelector{MatchLabels:${goMap(s.selector.matchLabels)}, MatchExpressions:[]v1.LabelSelectorRequirement(nil)}: field is immutable`);
    }
    if (r === "services") {
      if (s.type === "ExternalName") { if (!s.externalName) errs.push("spec.externalName: Required value"); }
      else if (!(s.ports ?? []).length) errs.push("spec.ports: Required value");
      (s.ports ?? []).forEach((p, i) => {
        if (!(p.port >= 1 && p.port <= 65535)) errs.push(`spec.ports[${i}].port: Invalid value: ${p.port ?? 0}: must be between 1 and 65535, inclusive`);
        if (typeof p.targetPort === "number" && !(p.targetPort >= 1 && p.targetPort <= 65535)) errs.push(`spec.ports[${i}].targetPort: Invalid value: ${p.targetPort}: must be between 1 and 65535, inclusive`);
        if ((s.ports.length > 1) && !p.name) errs.push(`spec.ports[${i}].name: Required value`);
        if (p.nodePort !== undefined && !(p.nodePort >= 30000 && p.nodePort <= 32767)) errs.push(`spec.ports[${i}].nodePort: Invalid value: ${p.nodePort}: provided port is not in the valid range. The range of valid ports is 30000-32767`);
        if (p.nodePort !== undefined && s.type === "ClusterIP") errs.push(`spec.ports[${i}].nodePort: Forbidden: may not be used when \`type\` is 'ClusterIP'`);
      });
      if (s.type && !["ClusterIP", "NodePort", "LoadBalancer", "ExternalName"].includes(s.type)) errs.push(`spec.type: Unsupported value: ${JSON.stringify(s.type)}: supported values: "ClusterIP", "ExternalName", "LoadBalancer", "NodePort"`);
    }
    if (r === "jobs") validatePodSpec(s.template?.spec, "spec.template.spec", errs, { template: "job" });
    if (r === "cronjobs") {
      if (!s.schedule) errs.push("spec.schedule: Required value");
      else if (!parseCron(s.schedule)) errs.push(`spec.schedule: Invalid value: ${JSON.stringify(s.schedule)}: unparseable schedule`);
      validatePodSpec(s.jobTemplate?.spec?.template?.spec, "spec.jobTemplate.spec.template.spec", errs, { template: "job" });
    }
    if (r === "horizontalpodautoscalers") {
      if (!s.maxReplicas) errs.push("spec.maxReplicas: Required value");
      if (s.minReplicas !== undefined && s.maxReplicas !== undefined && s.minReplicas > s.maxReplicas) errs.push(`spec.maxReplicas: Invalid value: ${s.maxReplicas}: must be greater than or equal to \`minReplicas\``);
      if (!s.scaleTargetRef?.name) errs.push("spec.scaleTargetRef.name: Required value");
    }
    if (r === "persistentvolumeclaims") {
      if (!(s.accessModes ?? []).length) errs.push("spec.accessModes: Required value: at least 1 access mode is required");
      if (!s.resources?.requests?.storage) errs.push("spec.resources[storage]: Required value");
    }
    if ((r === "configmaps" || r === "secrets") && o.data) for (const k of Object.keys(o.data)) if (!/^[-._a-zA-Z0-9]+$/.test(k)) errs.push(`data[${k}]: Invalid value: ${JSON.stringify(k)}: a valid config key must consist of alphanumeric characters, '-', '_' or '.' (e.g. 'key.name',  or 'KEY_NAME',  or 'key-name', regex used for validation is '[-._a-zA-Z0-9]+')`);
    if (r === "secrets" && o.data) for (const [k, v] of Object.entries(o.data)) if (unb64(v) === null) return { decode: `illegal base64 data at input byte ${Math.max(0, String(v).search(/[^A-Za-z0-9+/=]/))}` , key: k };
    return { errs };
  }
  const invalidText = (kind, name, errs) => `The ${kind} ${JSON.stringify(name)} is invalid: ${errs.length === 1 ? errs[0] : "\n" + errs.map((x) => "* " + x).join("\n")}`;

  // cron schedules: five fields, with *, */n, a-b, lists and names, or @hourly / @daily
  function parseCron(s) {
    const MAC = { "@yearly": "0 0 1 1 *", "@annually": "0 0 1 1 *", "@monthly": "0 0 1 * *", "@weekly": "0 0 * * 0", "@daily": "0 0 * * *", "@midnight": "0 0 * * *", "@hourly": "0 * * * *" };
    const f = (MAC[String(s).trim()] ?? String(s)).trim().split(/\s+/);
    if (f.length !== 5) return null;
    const ranges = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]];
    const names = [null, null, null, ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]];
    const sets = [];
    for (let i = 0; i < 5; i++) {
      const set = new Set();
      for (const part of f[i].split(",")) {
        const m = /^(\*|[\w]+(?:-[\w]+)?)(?:\/(\d+))?$/.exec(part);
        if (!m) return null;
        const val = (x) => { const n = names[i]?.indexOf(x.toLowerCase()); return n !== undefined && n >= 0 ? n + (i === 3 ? 1 : 0) : /^\d+$/.test(x) ? Number(x) : NaN; };
        let [lo, hi] = ranges[i];
        if (m[1] !== "*") { const [a, b] = m[1].split("-"); lo = val(a); hi = b !== undefined ? val(b) : m[2] ? ranges[i][1] : lo; }
        if (Number.isNaN(lo) || Number.isNaN(hi) || lo < ranges[i][0] || hi > ranges[i][1] || lo > hi) return null;
        for (let v = lo; v <= hi; v += Number(m[2] ?? 1)) set.add(v);
      }
      sets.push(set);
    }
    return (t) => { const d = new Date(t * 1000); return sets[0].has(d.getUTCMinutes()) && sets[1].has(d.getUTCHours()) && sets[2].has(d.getUTCDate()) && sets[3].has(d.getUTCMonth() + 1) && sets[4].has(d.getUTCDay()); };
  }

  /* ------------------------------------------------------------ clusters: kind's nodes and what kubeadm sets up */

  const clustersOf = (e) => kstate(e).clusters;
  // each node's container runtime (containerd): its own images and containers, on the Docker clock
  function nodeEngine(e, node) {
    const ne = { owner: e.owner, images: new Map(), tags: new Map(), containers: new Map(), networks: new Map(), volumes: new Map(), cache: new Map(), content: new Set(), auth: {}, counter: 0, builder: { name: "default", driver: "docker" }, lastBuild: null, k8sNode: node };
    Object.defineProperty(ne, "ticks", { get: () => e.ticks, set: (v) => { e.ticks = v; } });
    ne.networks.set("pods", { name: "pods", id: D.hex("pods" + node.name), driver: "ptp", subnet: `10.244.${node.index}.0/24`, gateway: `10.244.${node.index}.1`, prefix: `10.244.${node.index}.`, next: 2, builtin: true });
    return ne;
  }
  const IMAGE_SIZES = { "coredns": 22403416, "etcd": 58938593, "kube-apiserver": 30092416, "kube-controller-manager": 25632113, "kube-scheduler": 19922187, "kube-proxy": 31028164, "kindnetd": 16612341, "local-path-provisioner": 22541737, "pause": 320368 };
  function nodeObject(cl, node, workers) {
    const cp = node.role === "control-plane";
    return {
      apiVersion: "v1", kind: "Node",
      metadata: {
        name: node.name,
        annotations: { "node.alpha.kubernetes.io/ttl": "0", "volumes.kubernetes.io/controller-managed-attach-detach": "true" },
        labels: { "beta.kubernetes.io/arch": "amd64", "beta.kubernetes.io/os": "linux", "kubernetes.io/arch": "amd64", "kubernetes.io/hostname": node.name, "kubernetes.io/os": "linux", ...(cp ? { "node-role.kubernetes.io/control-plane": "", "node.kubernetes.io/exclude-from-external-load-balancers": "" } : {}) },
      },
      spec: { podCIDR: `10.244.${node.index}.0/24`, podCIDRs: [`10.244.${node.index}.0/24`], providerID: `kind://docker/${cl.name}/${node.name}`, ...(cp && workers ? { taints: [{ effect: "NoSchedule", key: "node-role.kubernetes.io/control-plane" }] } : {}) },
      status: {
        addresses: [{ address: node.ip, type: "InternalIP" }, { address: node.name, type: "Hostname" }],
        allocatable: { cpu: "4", "ephemeral-storage": "61202244Ki", "hugepages-1Gi": "0", "hugepages-2Mi": "0", memory: "8021504Ki", pods: "110" },
        capacity: { cpu: "4", "ephemeral-storage": "61202244Ki", "hugepages-1Gi": "0", "hugepages-2Mi": "0", memory: "8021504Ki", pods: "110" },
        conditions: [], daemonEndpoints: { kubeletEndpoint: { Port: 10250 } },
        nodeInfo: { architecture: "amd64", bootID: newUid(cl.e), containerRuntimeVersion: `containerd://${V.containerd}`, kernelVersion: "6.12.54-linuxkit", kubeProxyVersion: "", kubeletVersion: V.k8s, machineID: hexr(cl.e, 32), operatingSystem: "linux", osImage: "Debian GNU/Linux 13 (trixie)", systemUUID: newUid(cl.e) },
      },
    };
  }
  function nodeReady(cl, node) { return node.container.state === "running" && node.container.daemon?.kindNode === node; }
  function setNodeConditions(cl, node) {
    const o = getObj(cl, "nodes", null, node.name);
    if (!o) return;
    const t = rfc(nowOf(cl));
    const ready = nodeReady(cl, node);
    const prev = o.status.conditions.find((c) => c.type === "Ready");
    if (prev && (prev.status === "True") === ready) return;
    const since = prev ? t : o.metadata.creationTimestamp;
    const cond = (type, status, reason, message) => ({ lastHeartbeatTime: t, lastTransitionTime: since, message, reason, status, type });
    o.status.conditions = ready ? [
      cond("MemoryPressure", "False", "KubeletHasSufficientMemory", "kubelet has sufficient memory available"),
      cond("DiskPressure", "False", "KubeletHasNoDiskPressure", "kubelet has no disk pressure"),
      cond("PIDPressure", "False", "KubeletHasSufficientPID", "kubelet has sufficient PID available"),
      cond("Ready", "True", "KubeletReady", "kubelet is posting ready status"),
    ] : ["MemoryPressure", "DiskPressure", "PIDPressure", "Ready"].map((ty) => cond(ty, "Unknown", "NodeStatusUnknown", "Kubelet stopped posting node status."));
    putObj(cl, "nodes", o);
  }

  // what a new kind cluster has: namespaces, the API's service, CoreDNS, kindnet, kube-proxy, the storage provisioner
  function bootstrap(cl) {
    const t = nowOf(cl);
    const mk = (r, o) => { o.apiVersion = apiVersionOf(r); o.kind = RES[r].kind; return putObj(cl, r, o, { fresh: true }); };
    for (const ns of ["default", "kube-node-lease", "kube-public", "kube-system", "local-path-storage"]) {
      mk("namespaces", defaultObject(cl, "namespaces", { metadata: { name: ns } }));
      mk("serviceaccounts", { metadata: { name: "default", namespace: ns } });
      mk("configmaps", { metadata: { name: "kube-root-ca.crt", namespace: ns, annotations: { "kubernetes.io/description": "Contains a CA bundle that can be used to verify the kube-apiserver when using internal endpoints such as the internal service IP or kubernetes.default.svc. No other usage is guaranteed across distributions of Kubernetes clusters." } }, data: { "ca.crt": "-----BEGIN CERTIFICATE-----\nMIIDBTCCAe2gAwIBAgIIQ2V4YW1wbGVDQTANBgkqhkiG9w0BAQsFADAVMRMwEQYD\nVQQDEwprdWJlcm5ldGVzMB4XDTI2MTAxNzA4NTUwMFoXDTM2MTAxNTA5MDAwMFow\n-----END CERTIFICATE-----\n" } });
    }
    const workers = cl.nodes.some((n) => n.role === "worker");
    for (const node of cl.nodes) { mk("nodes", nodeObject(cl, node, workers)); setNodeConditions(cl, node); }
    mk("storageclasses", { metadata: { name: "standard", annotations: { "storageclass.kubernetes.io/is-default-class": "true" } }, provisioner: "rancher.io/local-path", reclaimPolicy: "Delete", volumeBindingMode: "WaitForFirstConsumer" });
    const svc = (ns, name, ip, ports, selector, labels) => mk("services", defaultObject(cl, "services", { metadata: { name, namespace: ns, labels }, spec: { clusterIP: ip, clusterIPs: [ip], ipFamilies: ["IPv4"], ipFamilyPolicy: "SingleStack", ports, ...(selector ? { selector } : {}) } }));
    svc("default", "kubernetes", "10.96.0.1", [{ name: "https", port: 443, protocol: "TCP", targetPort: 6443 }], null, { component: "apiserver", provider: "kubernetes" });
    svc("kube-system", "kube-dns", "10.96.0.10", [{ name: "dns", port: 53, protocol: "UDP", targetPort: 53 }, { name: "dns-tcp", port: 53, protocol: "TCP", targetPort: 53 }, { name: "metrics", port: 9153, protocol: "TCP", targetPort: 9153 }], { "k8s-app": "kube-dns" }, { "k8s-app": "kube-dns", "kubernetes.io/cluster-service": "true", "kubernetes.io/name": "CoreDNS" });
    cl.svcIPs.add("10.96.0.1"); cl.svcIPs.add("10.96.0.10");
    const sysDeploy = (ns, name, image, replicas, labels) => mk("deployments", defaultObject(cl, "deployments", { metadata: { name, namespace: ns, labels, generation: 1 }, spec: { replicas, selector: { matchLabels: labels }, template: { metadata: { labels }, spec: { containers: [{ name: name.replace(/-provisioner$/, "-provisioner"), image }] } } } }));
    sysDeploy("kube-system", "coredns", `registry.k8s.io/coredns/coredns:${V.coredns}`, 2, { "k8s-app": "kube-dns" });
    sysDeploy("local-path-storage", "local-path-provisioner", "docker.io/kindest/local-path-provisioner:v20260812-5b2c1e4f", 1, { app: "local-path-provisioner" });
    for (const [name, image, labels] of [["kindnet", "docker.io/kindest/kindnetd:v20260812-3f9b2d1a", { app: "kindnet", "k8s-app": "kindnet", tier: "node" }], ["kube-proxy", `registry.k8s.io/kube-proxy:${V.k8s}`, { "k8s-app": "kube-proxy" }]]) {
      const ds = mk("daemonsets", { metadata: { name, namespace: "kube-system", labels, generation: 1 }, spec: { selector: { matchLabels: { [Object.keys(labels)[0] === "app" ? "app" : "k8s-app"]: labels.app ?? labels["k8s-app"] } }, template: { metadata: { labels }, spec: { containers: [{ name: name === "kindnet" ? "kindnet-cni" : name, image }], hostNetwork: true } }, updateStrategy: { rollingUpdate: { maxSurge: 0, maxUnavailable: 1 }, type: "RollingUpdate" } }, status: {} });
      for (const node of cl.nodes) createPod(cl, { metadata: { name: `${name}-${rand5(cl.e)}`, namespace: "kube-system", labels: { ...labels, "controller-revision-hash": templateHash(ds.spec.template).slice(0, 10), "pod-template-generation": "1" }, ownerReferences: [ownerRef("daemonsets", ds)] }, spec: clone({ ...ds.spec.template.spec, nodeName: node.name }) }, { virtual: true, node });
    }
    const cpNode = cl.nodes[0];
    for (const comp of ["etcd", "kube-apiserver", "kube-controller-manager", "kube-scheduler"]) {
      const image = comp === "etcd" ? `registry.k8s.io/etcd:${V.etcd}` : `registry.k8s.io/${comp}:${V.k8s}`;
      createPod(cl, { metadata: { name: `${comp}-${cpNode.name}`, namespace: "kube-system", labels: { component: comp, tier: "control-plane" }, ownerReferences: [{ apiVersion: "v1", controller: true, kind: "Node", name: cpNode.name, uid: getObj(cl, "nodes", null, cpNode.name).metadata.uid }] }, spec: { containers: [{ name: comp, image }], hostNetwork: true, priorityClassName: "system-node-critical", nodeName: cpNode.name } }, { virtual: true, node: cpNode, static: true });
    }
    void t;
  }

  /* ------------------------------------------------------------ pods: the scheduler and the kubelet */

  const CPU_ALLOC = 4000, MEM_ALLOC = 8021504 * 1024;
  const isVirtualImage = (img) => /^(registry\.k8s\.io|docker\.io\/kindest)\//.test(String(img));
  function createPod(cl, pod, { virtual = false, node = null, static: isStatic = false } = {}) {
    pod.apiVersion = "v1"; pod.kind = "Pod";
    admitPod(cl, pod);
    putObj(cl, "pods", pod, { fresh: true });
    const rt = { uid: pod.metadata.uid, node: null, virtual: virtual || pod.spec.containers.every((c) => isVirtualImage(c.image)), static: isStatic, cs: new Map(), ip: null, deleting: null, lastSchedEvent: -1e9, born: nowOf(cl) };
    cl.rt.set(pod.metadata.uid, rt);
    if (node) bindPod(cl, pod, rt, node, { silent: isStatic || pod.metadata.namespace === "kube-system" && virtual });
    return pod;
  }
  const podsOn = (cl, node) => list(cl, "pods").filter((p) => p.spec.nodeName === node.name && !["Succeeded", "Failed"].includes(p.status.phase));
  const podRequests = (p) => p.spec.containers.reduce((a, c) => ({ cpu: a.cpu + (cpuMilli(c.resources?.requests?.cpu) ?? 0), mem: a.mem + (memBytes(c.resources?.requests?.memory) ?? 0) }), { cpu: 0, mem: 0 });
  function bindPod(cl, pod, rt, node, { silent = false } = {}) {
    pod.spec.nodeName = node.name;
    rt.node = node;
    rt.scheduledAt = nowOf(cl);
    pod.status.conditions = [{ lastProbeTime: null, lastTransitionTime: rfc(nowOf(cl)), status: "True", type: "PodScheduled" }];
    if (!silent) event(cl, pod, "Normal", "Scheduled", `Successfully assigned ${pod.metadata.namespace}/${pod.metadata.name} to ${node.name}`, "default-scheduler");
    putObj(cl, "pods", pod);
  }
  function schedule(cl, pod, rt) {
    const t = nowOf(cl);
    const nodes = cl.nodes;
    const reasons = {};
    const add = (r) => { reasons[r] = (reasons[r] ?? 0) + 1; };
    const need = podRequests(pod);
    // persistent volume claims: they must exist; a bound one pins the pod to its volume's node
    let pinned = null;
    for (const v of pod.spec.volumes ?? []) {
      if (!v.persistentVolumeClaim) continue;
      const pvc = getObj(cl, "persistentvolumeclaims", pod.metadata.namespace, v.persistentVolumeClaim.claimName);
      if (!pvc) return unschedulable(`0/${nodes.length} nodes are available: persistentvolumeclaim "${v.persistentVolumeClaim.claimName}" not found. preemption: 0/${nodes.length} nodes are available: ${nodes.length} Preemption is not helpful for scheduling.`);
      if (pvc.spec.volumeName) pinned = cl.pvNode.get(pvc.spec.volumeName) ?? null;
    }
    const fits = [];
    for (const n of nodes) {
      const o = getObj(cl, "nodes", null, n.name);
      if (!nodeReady(cl, n)) { add("node(s) had untolerated taint {node.kubernetes.io/unreachable: }"); continue; }
      if ((o.spec.taints ?? []).some((tn) => tn.effect === "NoSchedule" && !(pod.spec.tolerations ?? []).some((x) => x.key === tn.key || x.operator === "Exists" && !x.key))) { add("node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }"); continue; }
      if (pod.spec.nodeSelector && !matchLabelsOk(o.metadata.labels, pod.spec.nodeSelector)) { add("node(s) didn't match Pod's node affinity/selector"); continue; }
      if (pinned && pinned !== n.name) { add("node(s) had volume node affinity conflict"); continue; }
      const used = podsOn(cl, n).filter((p) => p !== pod).reduce((a, p) => { const r = podRequests(p); return { cpu: a.cpu + r.cpu, mem: a.mem + r.mem }; }, { cpu: 0, mem: 0 });
      let ok = true;
      if (used.cpu + need.cpu > CPU_ALLOC) { add("Insufficient cpu"); ok = false; }
      if (used.mem + need.mem > MEM_ALLOC) { add("Insufficient memory"); ok = false; }
      if (ok) fits.push({ n, load: podsOn(cl, n).length });
    }
    if (!fits.length) {
      const parts = Object.entries(reasons).sort(([a], [b]) => a.localeCompare(b)).map(([r, k]) => `${k} ${r}`).join(", ");
      const resourceOnly = Object.keys(reasons).every((r) => r.startsWith("Insufficient"));
      return unschedulable(`0/${nodes.length} nodes are available: ${parts}. preemption: 0/${nodes.length} nodes are available: ${resourceOnly ? `${nodes.length} No preemption victims found for incoming pod` : `${nodes.length} Preemption is not helpful for scheduling`}.`);
    }
    fits.sort((a, b) => a.load - b.load || a.n.index - b.n.index);
    for (const v of pod.spec.volumes ?? []) {
      const pvc = v.persistentVolumeClaim && getObj(cl, "persistentvolumeclaims", pod.metadata.namespace, v.persistentVolumeClaim.claimName);
      if (pvc && !pvc.spec.volumeName) provision(cl, pvc, fits[0].n);
    }
    bindPod(cl, pod, rt, fits[0].n);
    return true;
    function unschedulable(msg) {
      if (t - rt.lastSchedEvent >= 60) {
        rt.lastSchedEvent = t;
        event(cl, pod, "Warning", "FailedScheduling", msg, "default-scheduler");
        pod.status.conditions = [{ lastProbeTime: null, lastTransitionTime: rfc(t), message: msg, reason: "Unschedulable", status: "False", type: "PodScheduled" }];
        putObj(cl, "pods", pod);
      }
      return false;
    }
  }

  // how much memory a container's program uses (nginx, Node.js, a small command)
  function memUsed(dc) {
    if (!dc || dc.state !== "running") return 0;
    if (dc.nginxAlive) return 9.8 * 1024 ** 2;
    if (/node/.test(dc.mainProc?.cmd ?? "")) return (41.3 + (parseInt(dc.id.slice(0, 2), 16) % 30) / 10) * 1024 ** 2;
    return 0.4 * 1024 ** 2;
  }
  // does the program stop when the kubelet sends SIGTERM? (otherwise it's killed when the grace period ends)
  function exitsOnTerm(dc) {
    if (!dc || dc.state !== "running") return true;
    if (dc.nginxAlive || dc.init) return true;
    const p = dc.shell?.proc;
    if (p && !p.ended && dc.signalsReach && (p.signals?.SIGTERM ?? []).length) return true;
    return !p || p.ended ? true : false;
  }

  // containerd's messages for an image it can't pull
  function pullError(ne, image) {
    const r = D.parseRef(image);
    if (!r.valid) return { invalid: `couldn't parse image name ${JSON.stringify(image)}: invalid reference format: repository name (${r.path}) must be lowercase` };
    const res = D.pull(ne, image, () => {}, { quiet: true });
    if (!res.error) return { image: res.image, fresh: res.fresh };
    const ref = r.full;
    if (/not found$/.test(res.error)) return { error: `failed to pull and unpack image ${JSON.stringify(ref)}: failed to resolve reference ${JSON.stringify(ref)}: ${ref}: not found` };
    if (r.registry === "ghcr.io") return { error: `failed to pull and unpack image ${JSON.stringify(ref)}: failed to resolve reference ${JSON.stringify(ref)}: failed to authorize: failed to fetch anonymous token: unexpected status from GET request to https://ghcr.io/token?scope=repository%3A${r.path.replace(/\//g, "%2F")}%3Apull&service=ghcr.io: 401 Unauthorized` };
    return { error: `failed to pull and unpack image ${JSON.stringify(ref)}: failed to resolve reference ${JSON.stringify(ref)}: pull access denied, repository does not exist or may require authorization: server message: insufficient_scope: authorization failed` };
  }
  const nodeHasImage = (node, image) => !!D.imageOf(node.ne, image);

  // the environment a container gets: the image's, Kubernetes' service variables, then env and envFrom
  function containerEnv(cl, pod, c) {
    const ns = pod.metadata.namespace;
    const env = {};
    const svcEnv = (s) => {
      const n = s.metadata.name.toUpperCase().replace(/-/g, "_");
      const ip = s.spec.clusterIP;
      if (!ip || ip === "None" || !s.spec.ports?.length) return;
      const p0 = s.spec.ports[0];
      env[`${n}_SERVICE_HOST`] = ip;
      env[`${n}_SERVICE_PORT`] = String(p0.port);
      for (const p of s.spec.ports) if (p.name) env[`${n}_SERVICE_PORT_${p.name.toUpperCase().replace(/-/g, "_")}`] = String(p.port);
      env[`${n}_PORT`] = `${p0.protocol.toLowerCase()}://${ip}:${p0.port}`;
      for (const p of s.spec.ports) {
        const pre = `${n}_PORT_${p.port}_${p.protocol}`;
        env[pre] = `${p.protocol.toLowerCase()}://${ip}:${p.port}`;
        env[`${pre}_PROTO`] = p.protocol.toLowerCase();
        env[`${pre}_PORT`] = String(p.port);
        env[`${pre}_ADDR`] = ip;
      }
    };
    if (pod.spec.enableServiceLinks !== false) for (const s of list(cl, "services", ns)) if (s.metadata.name !== "kubernetes") svcEnv(s);
    svcEnv(getObj(cl, "services", "default", "kubernetes"));
    const errs = [];
    const cmOf = (kind, name) => getObj(cl, kind === "ConfigMap" ? "configmaps" : "secrets", ns, name);
    const valOf = (kind, o, k) => (kind === "ConfigMap" ? o.data?.[k] : o.data?.[k] !== undefined ? unb64(o.data[k]) : undefined);
    for (const ef of c.envFrom ?? []) {
      const kind = ef.configMapRef ? "ConfigMap" : "Secret";
      const ref = ef.configMapRef ?? ef.secretRef;
      const o = cmOf(kind, ref.name);
      if (!o) { if (!ref.optional) errs.push(`${kind.toLowerCase()} ${JSON.stringify(ref.name)} not found`); continue; }
      for (const k of Object.keys(o.data ?? {})) env[(ef.prefix ?? "") + k] = valOf(kind, o, k);
    }
    const expand = (v) => String(v).replace(/\$\(([A-Za-z_][A-Za-z0-9_]*)\)/g, (all, n) => (env[n] !== undefined ? env[n] : all)).replace(/\$\$/g, "$");
    for (const ev of c.env ?? []) {
      if (ev.valueFrom) {
        const vf = ev.valueFrom;
        if (vf.configMapKeyRef || vf.secretKeyRef) {
          const kind = vf.configMapKeyRef ? "ConfigMap" : "Secret";
          const ref = vf.configMapKeyRef ?? vf.secretKeyRef;
          const o = cmOf(kind, ref.name);
          if (!o) { if (!ref.optional) errs.push(`${kind.toLowerCase()} ${JSON.stringify(ref.name)} not found`); continue; }
          const v = valOf(kind, o, ref.key);
          if (v === undefined) { if (!ref.optional) errs.push(`couldn't find key ${ref.key} in ${kind} ${ns}/${ref.name}`); continue; }
          env[ev.name] = v;
        } else if (vf.fieldRef) {
          const f = vf.fieldRef.fieldPath;
          env[ev.name] = f === "metadata.name" ? pod.metadata.name : f === "metadata.namespace" ? ns : f === "status.podIP" ? pod.status.podIP ?? "" : f === "spec.nodeName" ? pod.spec.nodeName : f === "status.hostIP" ? pod.status.hostIP ?? "" : "";
        } else if (vf.resourceFieldRef) {
          const res = vf.resourceFieldRef.resource;
          const v = res.endsWith("cpu") ? Math.ceil((cpuMilli(c.resources?.[res.startsWith("limits") ? "limits" : "requests"]?.cpu) ?? 4000) / 1000) : Math.floor((memBytes(c.resources?.[res.startsWith("limits") ? "limits" : "requests"]?.memory) ?? MEM_ALLOC));
          env[ev.name] = String(v);
        }
      } else env[ev.name] = expand(ev.value ?? "");
    }
    return { env, errs };
  }

  // the volumes a container mounts, as volumes in the node's container runtime
  function containerMounts(cl, pod, rt, c) {
    const mounts = [];
    const ne = rt.node.ne;
    const fileNode = (text, mode = 0o100644) => ({ type: "file", data: new TextEncoder().encode(text), mtime: 2, mode, ino: 70000 + Math.floor(rnd(cl.e) * 9999) });
    for (const vm of c.volumeMounts ?? []) {
      const v = (pod.spec.volumes ?? []).find((x) => x.name === vm.name);
      if (!v) continue;
      let source;
      if (v.emptyDir) source = `${pod.metadata.uid}-${v.name}`;
      else if (v.persistentVolumeClaim) {
        const pvc = getObj(cl, "persistentvolumeclaims", pod.metadata.namespace, v.persistentVolumeClaim.claimName);
        source = pvc?.spec.volumeName ?? `${pod.metadata.uid}-${v.name}`;
        if (!ne.volumes.has(source)) ne.volumes.set(source, { name: source, created: nowOf(cl), files: new Map(), labels: {} });
      } else if (v.configMap || v.secret || v.projected) {
        source = `${pod.metadata.uid}-${v.name}`;
        const files = new Map();
        if (v.configMap) { const o = getObj(cl, "configmaps", pod.metadata.namespace, v.configMap.name); for (const [k, x] of Object.entries(o?.data ?? {})) if (!v.configMap.items || v.configMap.items.some((it) => it.key === k)) files.set(v.configMap.items?.find((it) => it.key === k)?.path ?? k, fileNode(x)); }
        if (v.secret) { const o = getObj(cl, "secrets", pod.metadata.namespace, v.secret.secretName); for (const [k, x] of Object.entries(o?.data ?? {})) files.set(k, fileNode(unb64(x) ?? "")); }
        if (v.projected) { files.set("token", fileNode(`eyJhbGciOiJSUzI1NiIsImtpZCI6I${hexr(cl.e, 20)}.${hexr(cl.e, 40)}`)); files.set("ca.crt", fileNode(getObj(cl, "configmaps", pod.metadata.namespace, "kube-root-ca.crt")?.data?.["ca.crt"] ?? "")); files.set("namespace", fileNode(pod.metadata.namespace)); }
        ne.volumes.set(source, { name: source, created: nowOf(cl), files, labels: {} });
      } else continue;
      mounts.push({ type: "volume", source, target: vm.mountPath, ro: !!vm.readOnly || !!(v.configMap || v.secret || v.projected) });
    }
    return mounts;
  }

  /* ------------------------------------------------------------ the kubelet: one pod at a time */

  const containerID = (cl) => `containerd://${hexr(cl.e, 64)}`;
  function stOf(rt, c) {
    if (!rt.cs.has(c.name)) rt.cs.set(c.name, { name: c.name, stage: "new", at: 0, restarts: 0, dc: null, prev: null, ready: false, pullBackoff: 0, crashBackoff: 0, probe: {}, waiting: "ContainerCreating", term: null, lastTerm: null, configErr: null });
    return rt.cs.get(c.name);
  }
  const pullDuration = (img) => 600 + Math.round((img.content ?? 20e6) / 15e6 * 1000);
  async function kubelet(cl, pod, rt) {
    const t = nowOf(cl);
    const node = rt.node;
    if (!node) return;
    if (!nodeReady(cl, node)) return;
    const s = pod.status;
    if (rt.deleting) return terminating(cl, pod, rt);
    if (!s.startTime) {
      s.startTime = rfc(t);
      s.hostIP = node.ip; s.hostIPs = [{ ip: node.ip }];
      if (pod.spec.hostNetwork) rt.ip = node.ip;
      else { const net = node.ne.networks.get("pods"); rt.ip = net.prefix + net.next++; }
      s.podIP = rt.ip; s.podIPs = [{ ip: rt.ip }];
      setCond(pod, "PodReadyToStartContainers", "True", t);
      setCond(pod, "Initialized", "True", t);
    }
    for (const c of pod.spec.containers) await containerSync(cl, pod, rt, c, stOf(rt, c), t);
    updatePodStatus(cl, pod, rt, t);
  }
  function setCond(pod, type, status, t, reason) {
    const cs = (pod.status.conditions ??= []);
    const c = cs.find((x) => x.type === type);
    if (c) { if (c.status !== status) { c.status = status; c.lastTransitionTime = rfc(t); } if (reason) c.reason = reason; else delete c.reason; return; }
    cs.push({ lastProbeTime: null, lastTransitionTime: rfc(t), ...(reason ? { reason } : {}), status, type });
  }
  async function containerSync(cl, pod, rt, c, st, t) {
    const node = rt.node;
    const ne = node.ne;
    const src = "kubelet";
    if (rt.virtual) {
      if (st.stage === "new") { st.stage = "running"; st.startedAt = rt.born + 1; st.id = containerID(cl); st.imageID = `${c.image.replace(/:[^/:]*$/, "")}@sha256:${hexr(cl.e, 64)}`; }
      st.ready = virtualReady(cl, pod, c, t);
      return;
    }
    switch (st.stage) {
      case "new": case "pull": {
        if (st.at > t) return;
        if (st.stage === "new") st.waiting = "ContainerCreating";
        const r = D.parseRef(c.image);
        if (!r.valid) {
          if (st.waiting !== "InvalidImageName") event(cl, pod, "Warning", "InspectFailed", `Failed to apply default image tag ${JSON.stringify(c.image)}: couldn't parse image name ${JSON.stringify(c.image)}: invalid reference format: repository name (${r.path}) must be lowercase`, src);
          event(cl, pod, "Warning", "Failed", "Error: InvalidImageName", src);
          st.waiting = "InvalidImageName"; st.stage = "pull"; st.at = t + 300;
          return;
        }
        const present = nodeHasImage(node, c.image);
        if (present && c.imagePullPolicy !== "Always") {
          if (st.stage === "new" || st.waiting !== "ContainerCreating" || true) event(cl, pod, "Normal", "Pulled", `Container image ${JSON.stringify(c.image)} already present on machine`, src);
          st.stage = "create"; st.at = t;
          return containerSync(cl, pod, rt, c, st, t);
        }
        if (c.imagePullPolicy === "Never") {
          event(cl, pod, "Warning", "ErrImageNeverPull", `Container image ${JSON.stringify(c.image)} is not present with pull policy of Never`, src);
          event(cl, pod, "Warning", "Failed", "Error: ErrImageNeverPull", src);
          st.waiting = "ErrImageNeverPull"; st.stage = "pull"; st.at = t + 30;
          return;
        }
        event(cl, pod, "Normal", "Pulling", `Pulling image ${JSON.stringify(c.image)}`, src);
        const busy = node.pulling.get(D.parseRef(c.image).full);
        const res = pullError(ne, c.image);
        if (res.error) { st.stage = "pullfail"; st.at = t + 1; st.pullErr = res.error; return; }
        const own = pullDuration(res.image);
        const wait = busy && busy > t * 1000 ? busy - t * 1000 : 0;
        const done = t * 1000 + Math.max(own, wait) + Math.floor(rnd(cl.e) * 400);
        if (!busy || busy <= t * 1000) node.pulling.set(D.parseRef(c.image).full, done);
        st.stage = "pulling"; st.at = Math.ceil(done / 1000); st.pullMsg = `Successfully pulled image ${JSON.stringify(c.image)} in ${goDur(own + Math.floor(rnd(cl.e) * 300))} (${goDur(done - t * 1000)} including waiting). Image size: ${res.image.content} bytes.`;
        return;
      }
      case "pullfail": {
        if (st.at > t) return;
        event(cl, pod, "Warning", "Failed", `Failed to pull image ${JSON.stringify(c.image)}: ${st.pullErr}`, src);
        event(cl, pod, "Warning", "Failed", "Error: ErrImagePull", src);
        st.waiting = "ErrImagePull";
        st.pullBackoff = st.pullBackoff ? Math.min(300, st.pullBackoff * 2) : 10;
        st.stage = "pullbackoff"; st.at = t + 1; st.retryAt = t + st.pullBackoff;
        return;
      }
      case "pullbackoff": {
        if (st.at > t) return;
        if (st.waiting === "ErrImagePull") {
          event(cl, pod, "Normal", "BackOff", `Back-off pulling image ${JSON.stringify(c.image)}`, src);
          event(cl, pod, "Warning", "Failed", "Error: ImagePullBackOff", src);
          st.waiting = "ImagePullBackOff";
        }
        if (t >= st.retryAt) { st.stage = "pull"; st.at = t; return containerSync(cl, pod, rt, c, st, t); }
        st.at = st.retryAt;
        return;
      }
      case "pulling": {
        if (st.at > t) return;
        event(cl, pod, "Normal", "Pulled", st.pullMsg, src);
        st.stage = "create"; st.at = t;
        return containerSync(cl, pod, rt, c, st, t);
      }
      case "create": case "configwait": {
        if (st.at > t) return;
        const { env, errs } = containerEnv(cl, pod, c);
        if (errs.length) {
          event(cl, pod, "Warning", "Failed", `Error: ${errs[0]}`, src);
          st.waiting = "CreateContainerConfigError"; st.waitMsg = errs[0];
          st.stage = "configwait"; st.at = t + 10;
          return;
        }
        const img = D.imageOf(ne, c.image);
        for (const v of pod.spec.volumes ?? []) if (v.emptyDir && !ne.volumes.has(`${pod.metadata.uid}-${v.name}`)) ne.volumes.set(`${pod.metadata.uid}-${v.name}`, { name: `${pod.metadata.uid}-${v.name}`, created: t, files: new Map(), labels: {} });
        const mounts = containerMounts(cl, pod, rt, c);
        const memLimit = memBytes(c.resources?.limits?.memory) ?? 0;
        const dc = D.createContainer(ne, img, {
          name: `k8s_${c.name}_${pod.metadata.name}_${pod.metadata.namespace}_${pod.metadata.uid}_${st.restarts}`, imageRef: c.image, hostname: pod.metadata.name,
          env: { HOSTNAME: pod.metadata.name, ...env }, entrypoint: c.command, cmd: c.args ?? (c.command ? [] : undefined), workdir: c.workingDir,
          user: pod.spec.securityContext?.runAsUser !== undefined || c.securityContext?.runAsUser !== undefined ? String(c.securityContext?.runAsUser ?? pod.spec.securityContext.runAsUser) : undefined,
          network: "pods", mounts, memory: memLimit,
        });
        // every container of a pod shares the pod's IP address and network namespace
        dc.networks = { pods: { ip: rt.ip, aliases: [], net: ne.networks.get("pods") } };
        const first = [...rt.cs.values()].find((x) => x !== st && x.dc && x.dc.state === "running");
        if (first) dc.netns = first.dc.netns;
        dc.pod = { cl, uid: pod.metadata.uid, ns: pod.metadata.namespace, name: pod.metadata.name };
        if (st.dc) { st.prev = st.dc; }
        st.dc = dc;
        st.id = containerID(cl);
        st.imageID = img.repoDigest ? `docker.io/${img.repoDigest.includes("/") ? img.repoDigest : "library/" + img.repoDigest}` : `import-${new Date(t * 1000).toISOString().slice(0, 10)}@sha256:${img.id}`;
        event(cl, pod, "Normal", "Created", "Container created", src);
        const err = await D.startContainer(ne, dc);
        if (err) {
          const msg = String(err.error).replace(/^failed to create task for container: /, "failed to create containerd task: ").replace(/: unknown$/, "");
          event(cl, pod, "Warning", "Failed", `Error: ${msg}`, src);
          st.term = { exitCode: 128, reason: "StartError", message: msg, startedAt: rfc(0), finishedAt: rfc(t) };
          return crashed(cl, pod, rt, c, st, t);
        }
        event(cl, pod, "Normal", "Started", "Container started", src);
        st.stage = "running"; st.startedAt = t; st.waiting = null; st.term = null; st.ready = false;
        st.probe = { readyOk: 0, readyFail: 0, liveFail: 0, nextReady: t + (c.readinessProbe?.initialDelaySeconds ?? 0), nextLive: t + (c.livenessProbe?.initialDelaySeconds ?? 0) };
        if (memLimit && memUsed(dc) > memLimit) {
          await D.stopContainer(ne, dc, 0, { kill: true });
          st.term = { exitCode: 137, reason: "OOMKilled", startedAt: rfc(t), finishedAt: rfc(t) };
          return crashed(cl, pod, rt, c, st, t);
        }
        if (dc.state !== "running") { st.term = { exitCode: dc.exitCode, reason: dc.exitCode === 0 ? "Completed" : "Error", startedAt: rfc(t), finishedAt: rfc(t) }; return crashed(cl, pod, rt, c, st, t); }
        await probes(cl, pod, rt, c, st, t);
        return;
      }
      case "running": {
        const dc = st.dc;
        if (dc.state !== "running") { st.term = { exitCode: dc.exitCode, reason: dc.exitCode === 0 ? "Completed" : "Error", startedAt: rfc(st.startedAt), finishedAt: rfc(t) }; return crashed(cl, pod, rt, c, st, t); }
        if (t - st.startedAt >= 600) st.crashBackoff = 0;
        await probes(cl, pod, rt, c, st, t);
        return;
      }
      case "backoff": {
        if (st.at > t) return;
        if (t >= st.retryAt) { st.restarts++; st.stage = "create"; st.at = t; return containerSync(cl, pod, rt, c, st, t); }
        if (st.waiting !== "CrashLoopBackOff") {
          st.waiting = "CrashLoopBackOff";
          event(cl, pod, "Warning", "BackOff", `Back-off restarting failed container ${c.name} in pod ${pod.metadata.name}_${pod.metadata.namespace}(${pod.metadata.uid})`, "kubelet");
        }
        st.at = st.retryAt;
        return;
      }
      default: return;
    }
  }
  // the container stopped: restart it after a back-off, or leave it (restartPolicy Never / OnFailure after success)
  function crashed(cl, pod, rt, c, st, t) {
    st.ready = false;
    st.lastTerm = st.term;
    const policy = pod.spec.restartPolicy;
    const restart = policy === "Always" || (policy === "OnFailure" && st.term.exitCode !== 0);
    if (!restart) { st.stage = "done"; return; }
    st.crashBackoff = st.crashBackoff ? Math.min(300, st.crashBackoff * 2) : 10;
    st.stage = "backoff"; st.retryAt = t + st.crashBackoff; st.at = t + 1;
    st.waiting = null;
    st.backoffFrom = t + 1;
  }
  // readiness and liveness probes, run when they're due
  async function probes(cl, pod, rt, c, st, t) {
    const rp = c.readinessProbe, lp = c.livenessProbe;
    if (!rp) st.ready = true;
    else while (st.probe.nextReady <= t && st.stage === "running") {
      const r = await runProbe(cl, pod, rt, c, rp, st);
      st.probe.nextReady += rp.periodSeconds;
      if (r.ok) { st.probe.readyFail = 0; if (++st.probe.readyOk >= rp.successThreshold) st.ready = true; }
      else { st.probe.readyOk = 0; event(cl, pod, "Warning", "Unhealthy", `Readiness probe failed: ${r.msg}`, "kubelet"); if (++st.probe.readyFail >= rp.failureThreshold) st.ready = false; }
    }
    if (lp) while (st.probe.nextLive <= t && st.stage === "running") {
      const r = await runProbe(cl, pod, rt, c, lp, st);
      st.probe.nextLive += lp.periodSeconds;
      if (r.ok) { st.probe.liveFail = 0; continue; }
      event(cl, pod, "Warning", "Unhealthy", `Liveness probe failed: ${r.msg}`, "kubelet");
      if (++st.probe.liveFail >= lp.failureThreshold) {
        event(cl, pod, "Normal", "Killing", `Container ${c.name} failed liveness probe, will be restarted`, "kubelet");
        await D.stopContainer(rt.node.ne, st.dc, 0, { kill: true });
        st.term = { exitCode: st.dc.exitCode || 137, reason: "Error", startedAt: rfc(st.startedAt), finishedAt: rfc(t) };
        st.crashBackoff = 0;
        st.lastTerm = st.term; st.ready = false;
        st.restarts++; st.stage = "create"; st.at = t;
        return;
      }
    }
  }
  async function runProbe(cl, pod, rt, c, p, st) {
    const dc = st.dc;
    if (p.exec) { const r = await D.execIn(rt.node.ne, dc, p.exec.command, { quietExec: true }); return r.code === 0 ? { ok: true } : { ok: false, msg: r.out.trimEnd() }; }
    const portOf = (port) => (typeof port === "number" ? port : Number((c.ports ?? []).find((x) => x.name === port)?.containerPort ?? NaN));
    if (p.tcpSocket) { const port = portOf(p.tcpSocket.port); return dc.netns.listeners.has(port) ? { ok: true } : { ok: false, msg: `dial tcp ${rt.ip}:${port}: connect: connection refused` }; }
    if (p.httpGet) {
      const port = portOf(p.httpGet.port);
      const url = `${p.httpGet.scheme === "HTTPS" ? "https" : "http"}://${rt.ip}:${port}${p.httpGet.path}`;
      const lst = dc.netns.listeners.get(port);
      if (!lst) return { ok: false, msg: `Get ${JSON.stringify(url)}: dial tcp ${rt.ip}:${port}: connect: connection refused` };
      D.syncIn(dc);
      const res = await lst.handle({ method: "GET", url: p.httpGet.path, headers: { Host: `${rt.ip}:${port}`, "User-Agent": `kube-probe/${V.k8s.slice(1, 5)}`, Accept: "*/*" }, body: "", remote: rt.node.ne.networks.get("pods").gateway, now: nowOf(cl) });
      D.syncOut(dc);
      if (res.error) return { ok: false, msg: `Get ${JSON.stringify(url)}: EOF` };
      return res.status >= 200 && res.status < 400 ? { ok: true } : { ok: false, msg: `HTTP probe failed with statuscode: ${res.status}` };
    }
    return { ok: true };
  }

  // graceful termination: SIGTERM, then the pod is gone once its containers stop (or the grace period ends)
  async function terminating(cl, pod, rt) {
    const t = nowOf(cl);
    const d = rt.deleting;
    if (!d.started) {
      d.started = true;
      for (const st of rt.cs.values()) {
        if (rt.virtual || st.dc?.state === "running") event(cl, pod, "Normal", "Killing", `Stopping container ${st.name}`, "kubelet");
        st.willExit = rt.virtual || exitsOnTerm(st.dc);
      }
    }
    const running = [...rt.cs.values()].filter((st) => st.dc && st.dc.state === "running");
    const done = t >= d.until || running.every((st) => st.willExit && t >= d.at + 1) || (!running.length && !rt.virtual) || (rt.virtual && t >= d.at + 1);
    if (!done) return;
    for (const st of rt.cs.values()) if (st.dc) { if (st.dc.state === "running") await D.stopContainer(rt.node.ne, st.dc, 0, { kill: !st.willExit }); D.removeContainer(rt.node.ne, st.dc); if (st.prev) D.removeContainer(rt.node.ne, st.prev); }
    for (const k of [...rt.node.ne.volumes.keys()]) if (k.startsWith(pod.metadata.uid + "-")) rt.node.ne.volumes.delete(k);
    removePod(cl, pod);
  }
  function removePod(cl, pod) {
    delObj(cl, "pods", pod);
    cl.rt.delete(pod.metadata.uid);
  }
  // a running container's status in the pod's status
  function containerStatus(cl, pod, rt, c, st) {
    const out = { containerID: st.id, image: c.image, imageID: st.imageID ?? "", name: c.name, ready: !!st.ready && (st.stage === "running"), restartCount: st.restarts, started: st.stage === "running", state: {} };
    if (!st.id) { delete out.containerID; out.imageID = ""; out.started = false; }
    if (st.stage === "running") out.state.running = { startedAt: rfc(st.startedAt) };
    else if (st.waiting) out.state.waiting = { reason: st.waiting, ...(st.waiting === "CrashLoopBackOff" ? { message: `back-off ${st.crashBackoff >= 60 ? `${Math.floor(st.crashBackoff / 60)}m${st.crashBackoff % 60}s` : `${st.crashBackoff}s`} restarting failed container=${c.name} pod=${pod.metadata.name}_${pod.metadata.namespace}(${pod.metadata.uid})` } : st.waitMsg && st.waiting === "CreateContainerConfigError" ? { message: st.waitMsg } : {}) };
    else if (st.term) out.state.terminated = { containerID: st.id, exitCode: st.term.exitCode, finishedAt: st.term.finishedAt, reason: st.term.reason, startedAt: st.term.startedAt, ...(st.term.message ? { message: st.term.message } : {}) };
    else out.state.waiting = { reason: "ContainerCreating" };
    const last = st.stage === "running" || st.waiting === "CrashLoopBackOff" ? st.lastTerm : null;
    out.lastState = last && st.restarts ? { terminated: { containerID: st.prevId ?? st.id, exitCode: last.exitCode, finishedAt: last.finishedAt, reason: last.reason, startedAt: last.startedAt } } : {};
    if (out.state.running || out.state.terminated) out.volumeMounts = (c.volumeMounts ?? []).map((m) => ({ mountPath: m.mountPath, name: m.name, ...(m.readOnly ? { readOnly: true } : {}), recursiveReadOnly: "Disabled" }));
    return out;
  }
  function updatePodStatus(cl, pod, rt, t) {
    const s = pod.status;
    const sts = pod.spec.containers.map((c) => stOf(rt, c));
    s.containerStatuses = pod.spec.containers.map((c, i) => containerStatus(cl, pod, rt, c, sts[i]));
    const allReady = s.containerStatuses.every((x) => x.ready);
    const anyRunning = sts.some((x) => x.stage === "running" || x.stage === "backoff" || (x.stage === "create" && x.restarts));
    const allDone = sts.every((x) => x.stage === "done");
    if (allDone) s.phase = sts.every((x) => x.term?.exitCode === 0) ? "Succeeded" : "Failed";
    else if (anyRunning) s.phase = "Running";
    else s.phase = "Pending";
    setCond(pod, "PodReadyToStartContainers", "True", t);
    setCond(pod, "Initialized", "True", t);
    const notReady = s.containerStatuses.filter((x) => !x.ready).map((x) => x.name);
    setCond(pod, "Ready", allReady && !allDone ? "True" : "False", t, allDone ? "PodCompleted" : allReady ? null : "ContainersNotReady");
    setCond(pod, "ContainersReady", allReady && !allDone ? "True" : "False", t, allDone ? "PodCompleted" : allReady ? null : "ContainersNotReady");
    for (const c of pod.status.conditions) { if (c.reason === "ContainersNotReady") c.message = `containers with unready status: [${notReady.join(" ")}]`; else delete c.message; if (c.type === "PodScheduled") { delete c.message; delete c.reason; } }
    const order = ["PodReadyToStartContainers", "Initialized", "Ready", "ContainersReady", "PodScheduled"];
    pod.status.conditions.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    if (allDone) for (const c of pod.status.conditions) if (c.type === "PodReadyToStartContainers") c.status = "False";
    if (canon(pod.status) !== cl.lastStatus.get(pod.metadata.uid)) { cl.lastStatus.set(pod.metadata.uid, canon(pod.status)); putObj(cl, "pods", pod); }
  }
  // pods of Kubernetes' own components: they run images the sandbox doesn't have, so they're simply ready
  function virtualReady(cl, pod, c, t) {
    if (/metrics-server/.test(c.image)) {
      const ok = (c.args ?? []).includes("--kubelet-insecure-tls");
      return ok && t - (cl.rt.get(pod.metadata.uid)?.born ?? t) >= 20;
    }
    return t - (cl.rt.get(pod.metadata.uid)?.born ?? t) >= 1;
  }

  /* ------------------------------------------------------------ controllers */

  const isActive = (p) => !p.metadata.deletionTimestamp && !["Succeeded", "Failed"].includes(p.status.phase);
  const podReady = (p) => (p.status.conditions ?? []).some((c) => c.type === "Ready" && c.status === "True");
  const readySince = (p) => Date.parse((p.status.conditions ?? []).find((c) => c.type === "Ready")?.lastTransitionTime ?? 0) / 1000;
  const podAvailable = (p, minReady, t) => podReady(p) && t - readySince(p) >= (minReady ?? 0);
  // delete a pod the way the API does: right away if it never got a node, otherwise with a grace period
  function startDelete(cl, pod, grace = null) {
    const rt = cl.rt.get(pod.metadata.uid);
    const g = grace ?? pod.spec.terminationGracePeriodSeconds ?? 30;
    if (!rt || !rt.node || g === 0 || (rt && [...rt.cs.values()].every((st) => !st.dc || st.dc.state !== "running") && !rt.virtual && !pod.spec.nodeName)) {
      if (rt && rt.node) for (const st of rt.cs.values()) if (st.dc) { if (st.dc.state === "running") D.stopContainer(rt.node.ne, st.dc, 0, { kill: true }); D.removeContainer(rt.node.ne, st.dc); }
      removePod(cl, pod);
      return;
    }
    if (pod.metadata.deletionTimestamp) return;
    const t = nowOf(cl);
    pod.metadata.deletionTimestamp = rfc(t + g);
    pod.metadata.deletionGracePeriodSeconds = g;
    rt.deleting = { at: t, until: t + g };
    putObj(cl, "pods", pod);
  }
  function newPodFromTemplate(cl, owner, r, tpl, name, extraLabels = {}) {
    const pod = { metadata: { name, namespace: owner.metadata.namespace, labels: { ...(tpl.metadata?.labels ?? {}), ...extraLabels }, ...(tpl.metadata?.annotations ? { annotations: { ...tpl.metadata.annotations } } : {}), ownerReferences: [ownerRef(r, owner)] }, spec: clone(tpl.spec) };
    delete pod.spec.nodeName;
    return createPod(cl, pod);
  }

  function syncReplicaSet(cl, rs, t) {
    const pods = list(cl, "pods", rs.metadata.namespace).filter((p) => ownedBy(p, rs));
    const active = pods.filter(isActive);
    const want = rs.spec.replicas;
    let changed = false;
    if (active.length < want) {
      for (let i = active.length; i < want; i++) {
        const p = newPodFromTemplate(cl, rs, "replicasets", rs.spec.template, `${rs.metadata.name}-${rand5(cl.e)}`);
        event(cl, rs, "Normal", "SuccessfulCreate", `Created pod: ${p.metadata.name}`, "replicaset-controller");
      }
      changed = true;
    } else if (active.length > want) {
      const rank = (p) => [p.spec.nodeName ? 1 : 0, p.status.phase === "Running" ? 1 : 0, podReady(p) ? 1 : 0, -created(p)];
      const victims = [...active].sort((a, b) => { const x = rank(a), y = rank(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; }).slice(0, active.length - want);
      for (const p of victims) { startDelete(cl, p); event(cl, rs, "Normal", "SuccessfulDelete", `Deleted pod: ${p.metadata.name}`, "replicaset-controller"); }
      changed = true;
    }
    const now = list(cl, "pods", rs.metadata.namespace).filter((p) => ownedBy(p, rs) && isActive(p));
    const st = { availableReplicas: now.filter((p) => podAvailable(p, rs.spec.minReadySeconds, t)).length, fullyLabeledReplicas: now.length, observedGeneration: rs.metadata.generation ?? 1, readyReplicas: now.filter(podReady).length, replicas: now.length };
    const terminating = list(cl, "pods", rs.metadata.namespace).filter((p) => ownedBy(p, rs) && p.metadata.deletionTimestamp).length;
    if (terminating) st.terminatingReplicas = terminating;
    for (const k of ["availableReplicas", "readyReplicas", "fullyLabeledReplicas"]) if (!st[k]) delete st[k];
    if (!same(rs.status, st)) { rs.status = st; putObj(cl, "replicasets", rs); changed = true; }
    return changed;
  }

  const revisionOf = (rs) => Number(rs.metadata.annotations?.["deployment.kubernetes.io/revision"] ?? 0);
  const intOrPercent = (v, total, up) => { if (typeof v === "number") return v; const m = /^(\d+)%$/.exec(String(v)); if (!m) return Number(v) || 0; const x = (Number(m[1]) * total) / 100; return up ? Math.ceil(x) : Math.floor(x); };
  const stripHash = (tpl) => { const x = clone(tpl); if (x.metadata?.labels) delete x.metadata.labels["pod-template-hash"]; return x; };
  function syncDeployment(cl, d, t) {
    const ns = d.metadata.namespace;
    const all = list(cl, "replicasets", ns).filter((rs) => ownedBy(rs, d));
    const tpl = d.spec.template;
    let changed = false;
    let newRS = all.find((rs) => same(stripHash(rs.spec.template), tpl));
    const maxRev = Math.max(0, ...all.map(revisionOf));
    const replicas = d.spec.replicas;
    const ru = d.spec.strategy.rollingUpdate ?? {};
    const surge = d.spec.strategy.type === "Recreate" ? 0 : intOrPercent(ru.maxSurge ?? "25%", replicas, true);
    let unavail = d.spec.strategy.type === "Recreate" ? replicas : intOrPercent(ru.maxUnavailable ?? "25%", replicas, false);
    if (!surge && !unavail) unavail = 1;
    const ann = (rs, rev) => { rs.metadata.annotations = { ...(rs.metadata.annotations ?? {}), "deployment.kubernetes.io/desired-replicas": String(replicas), "deployment.kubernetes.io/max-replicas": String(replicas + surge), "deployment.kubernetes.io/revision": String(rev) }; };
    if (d.spec.paused) return false;
    if (!newRS) {
      const hash = templateHash(tpl, d.status?.collisionCount ?? 0);
      const rtpl = clone(tpl);
      rtpl.metadata = { ...(rtpl.metadata ?? {}), labels: { ...(rtpl.metadata?.labels ?? {}), "pod-template-hash": hash } };
      const oldPods = all.reduce((n, rs) => n + rs.spec.replicas, 0);
      const startReplicas = d.spec.strategy.type === "Recreate" ? (oldPods ? 0 : replicas) : Math.max(0, Math.min(replicas, replicas + surge - oldPods));
      newRS = { apiVersion: "apps/v1", kind: "ReplicaSet", metadata: { name: `${d.metadata.name}-${hash}`, namespace: ns, labels: { ...(tpl.metadata?.labels ?? {}), "pod-template-hash": hash }, ownerReferences: [ownerRef("deployments", d)], generation: 1 }, spec: { replicas: 0, selector: { matchLabels: { ...(d.spec.selector.matchLabels ?? {}), "pod-template-hash": hash }, ...(d.spec.selector.matchExpressions ? { matchExpressions: clone(d.spec.selector.matchExpressions) } : {}) }, template: rtpl, ...(d.spec.minReadySeconds ? { minReadySeconds: d.spec.minReadySeconds } : {}) }, status: { replicas: 0 } };
      ann(newRS, maxRev + 1);
      putObj(cl, "replicasets", newRS, { fresh: true });
      d.status = d.status ?? {};
      setDeployCond(d, "Progressing", "True", "NewReplicaSetCreated", `Created new replica set "${newRS.metadata.name}"`, t);
      if (startReplicas > 0) scaleRS(cl, d, newRS, startReplicas);
      changed = true;
    } else if (revisionOf(newRS) < maxRev) {
      // rolling back (or forward) to a template an older replica set already has: it gets the next revision number
      const old = revisionOf(newRS);
      newRS.metadata.annotations["deployment.kubernetes.io/revision-history"] = [newRS.metadata.annotations["deployment.kubernetes.io/revision-history"], String(old)].filter(Boolean).join(",");
      ann(newRS, maxRev + 1);
      putObj(cl, "replicasets", newRS);
      setDeployCond(d, "Progressing", "True", "FoundNewReplicaSet", `Found new replica set "${newRS.metadata.name}"`, t);
      changed = true;
    }
    const olds = all.filter((rs) => rs !== newRS);
    const sumSpec = () => [newRS, ...olds].reduce((n, rs) => n + rs.spec.replicas, 0);
    if (d.spec.strategy.type === "Recreate") {
      const oldActive = olds.some((rs) => rs.spec.replicas > 0 || list(cl, "pods", ns).some((p) => ownedBy(p, rs)));
      for (const rs of olds) if (rs.spec.replicas > 0) { scaleRS(cl, d, rs, 0); changed = true; }
      if (!oldActive && newRS.spec.replicas !== replicas) { scaleRS(cl, d, newRS, replicas); changed = true; }
    } else {
      // scale the new replica set up, as far as maxSurge allows
      if (newRS.spec.replicas > replicas) { scaleRS(cl, d, newRS, replicas); changed = true; }
      else if (newRS.spec.replicas < replicas) {
        const room = replicas + surge - sumSpec();
        if (room > 0) { scaleRS(cl, d, newRS, Math.min(replicas, newRS.spec.replicas + room)); changed = true; }
      }
      // scale old replica sets down, as far as maxUnavailable allows (unhealthy pods first)
      const oldWithPods = olds.filter((rs) => rs.spec.replicas > 0);
      if (oldWithPods.length) {
        const avail = (rs) => rs.status?.availableReplicas ?? 0;
        const minAvailable = replicas - unavail;
        const newUnavail = newRS.spec.replicas - avail(newRS);
        let budget = sumSpec() - minAvailable - newUnavail;
        for (const rs of oldWithPods) {
          const unhealthy = rs.spec.replicas - avail(rs);
          if (budget <= 0) break;
          const down = Math.min(unhealthy, budget);
          if (down > 0) { scaleRS(cl, d, rs, rs.spec.replicas - down); budget -= down; changed = true; }
        }
        const totalAvail = [newRS, ...olds].reduce((n, rs) => n + Math.min(avail(rs), rs.spec.replicas), 0);
        let canDown = totalAvail - minAvailable;
        for (const rs of [...oldWithPods].sort((a, b) => created(a) - created(b))) {
          if (canDown <= 0) break;
          if (rs.spec.replicas <= 0) continue;
          const down = Math.min(rs.spec.replicas, canDown);
          scaleRS(cl, d, rs, rs.spec.replicas - down);
          canDown -= down;
          changed = true;
        }
      }
    }
    // keep revisionHistoryLimit old replica sets
    const spare = olds.filter((rs) => rs.spec.replicas === 0 && (rs.status?.replicas ?? 0) === 0).sort((a, b) => revisionOf(a) - revisionOf(b));
    while (spare.length > (d.spec.revisionHistoryLimit ?? 10)) { const rs = spare.shift(); delObj(cl, "replicasets", rs); changed = true; }
    return deploymentStatus(cl, d, newRS, olds, unavail, t) || changed;
  }
  function scaleRS(cl, d, rs, n) {
    const from = rs.spec.replicas;
    if (from === n) return;
    rs.spec.replicas = n;
    rs.metadata.annotations["deployment.kubernetes.io/desired-replicas"] = String(d.spec.replicas);
    rs.metadata.generation = (rs.metadata.generation ?? 1) + 1;
    putObj(cl, "replicasets", rs);
    event(cl, d, "Normal", "ScalingReplicaSet", `Scaled ${n > from ? "up" : "down"} replica set ${rs.metadata.name} from ${from} to ${n}`, "deployment-controller");
  }
  function setDeployCond(d, type, status, reason, message, t) {
    const cs = (d.status.conditions ??= []);
    let c = cs.find((x) => x.type === type);
    if (!c) { c = { lastTransitionTime: rfc(t), lastUpdateTime: rfc(t), message, reason, status, type }; cs.push(c); }
    else {
      if (c.status !== status) c.lastTransitionTime = rfc(t);
      if (c.reason !== reason || c.message !== message || c.status !== status) c.lastUpdateTime = rfc(t);
      Object.assign(c, { message, reason, status });
    }
    cs.sort((a, b) => (a.type === "Available" ? -1 : 1) - (b.type === "Available" ? -1 : 1));
  }
  function deploymentStatus(cl, d, newRS, olds, unavail, t) {
    const before = canon(d.status);
    const rsAll = [newRS, ...olds];
    const pods = list(cl, "pods", d.metadata.namespace).filter((p) => rsAll.some((rs) => ownedBy(p, rs)));
    const active = pods.filter(isActive);
    const s = d.status ?? (d.status = {});
    const replicas = d.spec.replicas;
    const avail = active.filter((p) => podAvailable(p, d.spec.minReadySeconds, t)).length;
    const updated = active.filter((p) => ownedBy(p, newRS)).length;
    Object.assign(s, { observedGeneration: d.metadata.generation, replicas: active.length, updatedReplicas: updated, readyReplicas: active.filter(podReady).length, availableReplicas: avail, unavailableReplicas: Math.max(0, replicas - avail) });
    const term = pods.filter((p) => p.metadata.deletionTimestamp).length;
    if (term) s.terminatingReplicas = term; else delete s.terminatingReplicas;
    for (const k of ["replicas", "updatedReplicas", "readyReplicas", "availableReplicas", "unavailableReplicas"]) if (!s[k]) delete s[k];
    setDeployCond(d, "Available", avail >= replicas - unavail ? "True" : "False", avail >= replicas - unavail ? "MinimumReplicasAvailable" : "MinimumReplicasUnavailable", avail >= replicas - unavail ? "Deployment has minimum availability." : "Deployment does not have minimum availability.", t);
    const prog = s.conditions.find((c) => c.type === "Progressing");
    const complete = updated === replicas && avail === replicas && active.length === replicas && olds.every((rs) => rs.spec.replicas === 0);
    if (complete) setDeployCond(d, "Progressing", "True", "NewReplicaSetAvailable", `ReplicaSet "${newRS.metadata.name}" has successfully progressed.`, t);
    else if (prog && prog.reason === "ProgressDeadlineExceeded") { /* stays */ }
    else if (prog && t - Date.parse(prog.lastUpdateTime) / 1000 > (d.spec.progressDeadlineSeconds ?? 600) && prog.reason !== "NewReplicaSetAvailable") {
      setDeployCond(d, "Progressing", "False", "ProgressDeadlineExceeded", `ReplicaSet "${newRS.metadata.name}" has timed out progressing.`, t);
    } else {
      const progress = canon([updated, avail, active.length]) !== cl.progress.get(d.metadata.uid);
      if (progress || !prog || prog.reason === "NewReplicaSetAvailable") {
        setDeployCond(d, "Progressing", "True", "ReplicaSetUpdated", `ReplicaSet "${newRS.metadata.name}" is progressing.`, t);
        s.conditions.find((c) => c.type === "Progressing").lastUpdateTime = rfc(t);
      }
    }
    cl.progress.set(d.metadata.uid, canon([updated, avail, active.length]));
    d.metadata.annotations = { ...(d.metadata.annotations ?? {}), "deployment.kubernetes.io/revision": String(revisionOf(newRS)) };
    if (canon(d.status) !== before) { putObj(cl, "deployments", d); return true; }
    return false;
  }

  function syncJob(cl, job, t) {
    const s = job.status ?? (job.status = {});
    if ((s.conditions ?? []).some((c) => (c.type === "Complete" || c.type === "Failed") && c.status === "True")) return false;
    const before = canon(s);
    const pods = list(cl, "pods", job.metadata.namespace).filter((p) => ownedBy(p, job));
    const active = pods.filter(isActive);
    const succeeded = pods.filter((p) => p.status.phase === "Succeeded").length + (cl.jobGone.get(job.metadata.uid)?.ok ?? 0);
    const failed = pods.filter((p) => p.status.phase === "Failed").length + (cl.jobGone.get(job.metadata.uid)?.failed ?? 0);
    s.startTime ??= rfc(t);
    const cond = (type, reason, message) => ({ lastProbeTime: rfc(t), lastTransitionTime: rfc(t), ...(message ? { message } : {}), ...(reason ? { reason } : {}), status: "True", type });
    if (succeeded >= job.spec.completions) {
      s.conditions = [cond("SuccessCriteriaMet", "CompletionsReached", "Reached expected number of succeeded pods"), cond("Complete", "CompletionsReached", "Reached expected number of succeeded pods")];
      s.completionTime = rfc(t);
      event(cl, job, "Normal", "Completed", "Job completed", "job-controller");
    } else if (failed > job.spec.backoffLimit) {
      s.conditions = [cond("FailureTarget", "BackoffLimitExceeded", "Job has reached the specified backoff limit"), cond("Failed", "BackoffLimitExceeded", "Job has reached the specified backoff limit")];
      for (const p of active) startDelete(cl, p);
      event(cl, job, "Warning", "BackoffLimitExceeded", "Job has reached the specified backoff limit", "job-controller");
    } else if (!job.spec.suspend && active.length < job.spec.parallelism && succeeded + active.length < job.spec.completions) {
      const lastFail = cl.jobFailAt.get(job.metadata.uid) ?? -1e9;
      if (!failed || t >= lastFail + 10 * 2 ** Math.max(0, failed - 1)) {
        const labels = { "batch.kubernetes.io/controller-uid": job.metadata.uid, "batch.kubernetes.io/job-name": job.metadata.name, "controller-uid": job.metadata.uid, "job-name": job.metadata.name };
        const p = newPodFromTemplate(cl, job, "jobs", job.spec.template, `${job.metadata.name}-${rand5(cl.e)}`, labels);
        event(cl, job, "Normal", "SuccessfulCreate", `Created pod: ${p.metadata.name}`, "job-controller");
      }
    }
    for (const p of pods) if (p.status.phase === "Failed" && !cl.jobSeen.has(p.metadata.uid)) { cl.jobSeen.add(p.metadata.uid); cl.jobFailAt.set(job.metadata.uid, t); }
    const now = list(cl, "pods", job.metadata.namespace).filter((p) => ownedBy(p, job));
    const act = now.filter(isActive).length;
    if (act) s.active = act; else delete s.active;
    s.ready = now.filter((p) => isActive(p) && podReady(p)).length;
    if (succeeded) s.succeeded = succeeded; else delete s.succeeded;
    if (failed) s.failed = failed; else delete s.failed;
    s.terminating = now.filter((p) => p.metadata.deletionTimestamp).length;
    s.uncountedTerminatedPods = {};
    if (canon(s) !== before) { putObj(cl, "jobs", job); return true; }
    return false;
  }
  function makeJob(cl, ns, name, spec, owner, annotations) {
    const job = { apiVersion: "batch/v1", kind: "Job", metadata: { name, namespace: ns, ...(owner ? { ownerReferences: [ownerRef("cronjobs", owner)] } : {}), ...(annotations ? { annotations } : {}), generation: 1 }, spec: clone(spec) };
    defaultObject(cl, "jobs", job);
    putObj(cl, "jobs", job, { fresh: true });
    const labels = { "batch.kubernetes.io/controller-uid": job.metadata.uid, "batch.kubernetes.io/job-name": name, "controller-uid": job.metadata.uid, "job-name": name };
    job.spec.selector = { matchLabels: { "batch.kubernetes.io/controller-uid": job.metadata.uid } };
    job.spec.template.metadata = { ...(job.spec.template.metadata ?? {}), labels: { ...(job.spec.template.metadata?.labels ?? {}), ...labels } };
    job.metadata.labels = { ...(job.metadata.labels ?? {}), ...labels };
    putObj(cl, "jobs", job);
    return job;
  }
  function syncCronJob(cl, cj, t) {
    const minute = Math.floor(t / 60) * 60;
    const last = cl.cronSeen.get(cj.metadata.uid) ?? Math.floor(created(cj) / 60) * 60;
    let changed = false;
    const fire = parseCron(cj.spec.schedule);
    for (let m = last + 60; m <= minute && fire; m += 60) {
      if (cj.spec.suspend || !fire(m)) continue;
      const name = `${cj.metadata.name}-${Math.floor(m / 60)}`;
      if (getObj(cl, "jobs", cj.metadata.namespace, name)) continue;
      makeJob(cl, cj.metadata.namespace, name, cj.spec.jobTemplate.spec, cj, { "batch.kubernetes.io/cronjob-scheduled-timestamp": rfc(m) });
      event(cl, cj, "Normal", "SuccessfulCreate", `Created job ${name}`, "cronjob-controller");
      cj.status = { ...(cj.status ?? {}), lastScheduleTime: rfc(m) };
      changed = true;
    }
    cl.cronSeen.set(cj.metadata.uid, minute);
    const jobs = list(cl, "jobs", cj.metadata.namespace).filter((j) => ownedBy(j, cj));
    const running = jobs.filter((j) => !(j.status?.conditions ?? []).some((c) => c.status === "True" && (c.type === "Complete" || c.type === "Failed")));
    const st = { ...(cj.status ?? {}) };
    if (running.length) st.active = running.map((j) => ({ apiVersion: "batch/v1", kind: "Job", name: j.metadata.name, namespace: j.metadata.namespace, resourceVersion: j.metadata.resourceVersion, uid: j.metadata.uid })); else delete st.active;
    const done = jobs.filter((j) => (j.status?.conditions ?? []).some((c) => c.type === "Complete" && c.status === "True")).sort((a, b) => created(a) - created(b));
    if (done.length) st.lastSuccessfulTime = done[done.length - 1].status.completionTime;
    while (done.length > cj.spec.successfulJobsHistoryLimit) { const j = done.shift(); deleteCascade(cl, "jobs", j); event(cl, cj, "Normal", "SuccessfulDelete", `Deleted job ${j.metadata.name}`, "cronjob-controller"); changed = true; }
    if (!same(st, cj.status ?? {})) { cj.status = st; putObj(cl, "cronjobs", cj); changed = true; }
    return changed;
  }

  // the metrics pipeline: metrics-server must be running and ready, and it scrapes every 15 seconds
  function metricsUp(cl, t) {
    const p = list(cl, "pods", "kube-system").find((x) => x.metadata.labels?.["k8s-app"] === "metrics-server" && podReady(x));
    return !!p && t - readySince(p) >= 15;
  }
  function cpuUsage(cl, pod, t) {
    const rt = cl.rt.get(pod.metadata.uid);
    if (!rt || rt.virtual) return 3;
    let m = 0;
    for (const st of rt.cs.values()) {
      if (st.stage !== "running") continue;
      const recent = (cl.hits.get(pod.metadata.uid) ?? []).filter((x) => x > t - 60).length;
      m += (st.dc?.nginxAlive ? 0 : 1) + Math.round(recent * 2.5);
    }
    return Math.max(1, m);
  }
  const memUsage = (cl, pod) => { const rt = cl.rt.get(pod.metadata.uid); if (!rt) return 0; if (rt.virtual) return 18 * 1024 ** 2; return [...rt.cs.values()].reduce((n, st) => n + memUsed(st.dc), 0); };
  function syncHPA(cl, hpa, t) {
    if (t < (cl.hpaNext.get(hpa.metadata.uid) ?? 0)) return false;
    cl.hpaNext.set(hpa.metadata.uid, t + 15);
    const ns = hpa.metadata.namespace;
    const ref = hpa.spec.scaleTargetRef;
    const r = ref.kind === "Deployment" ? "deployments" : ref.kind === "ReplicaSet" ? "replicasets" : null;
    const target = r && getObj(cl, r, ns, ref.name);
    const s = hpa.status ?? (hpa.status = { currentReplicas: 0, desiredReplicas: 0 });
    const before = canon(s);
    const cond = (type, status, reason, message) => { s.conditions ??= []; let c = s.conditions.find((x) => x.type === type); if (!c) { c = { type, status, lastTransitionTime: rfc(t), reason, message }; s.conditions.push(c); } else { if (c.status !== status) c.lastTransitionTime = rfc(t); Object.assign(c, { status, reason, message }); } };
    if (!target) {
      cond("AbleToScale", "False", "FailedGetScale", `the HPA controller was unable to get the target's current scale: ${pluralString(r ?? "deployments")} "${ref.name}" not found`);
      event(cl, hpa, "Warning", "FailedGetScale", `${pluralString(r ?? "deployments")} "${ref.name}" not found`, "horizontal-pod-autoscaler");
    } else {
      const cur = target.spec.replicas;
      s.currentReplicas = target.status?.replicas ?? cur;
      cond("AbleToScale", "True", "SucceededGetScale", "the HPA controller was able to get the target's current scale");
      const pods = list(cl, "pods", ns).filter((p) => selectorMatch(p.metadata.labels, target.spec.selector) && isActive(p));
      const metric = (hpa.spec.metrics ?? []).find((m) => m.type === "Resource" && m.resource?.name === "cpu");
      let desired = cur, reason = null, util = null;
      if (metric) {
        const tgt = metric.resource.target.averageUtilization;
        if (!metricsUp(cl, t)) {
          const msg = "failed to get cpu utilization: unable to get metrics for resource cpu: unable to fetch metrics from resource metrics API: the server could not find the requested resource (get pods.metrics.k8s.io)";
          event(cl, hpa, "Warning", "FailedGetResourceMetric", msg, "horizontal-pod-autoscaler");
          event(cl, hpa, "Warning", "FailedComputeMetricsReplicas", `invalid metrics (1 invalid out of 1), first error is: failed to get cpu resource metric value: ${msg}`, "horizontal-pod-autoscaler");
          cond("ScalingActive", "False", "FailedGetResourceMetric", `the HPA was unable to compute the replica count: ${msg}`);
          s.currentMetrics = [{ type: "" }];
        } else {
          const missing = pods.flatMap((p) => p.spec.containers.filter((c) => cpuMilli(c.resources?.requests?.cpu) === null).map((c) => `missing request for cpu in container ${c.name} of Pod ${p.metadata.name}`));
          if (missing.length) {
            const msg = `failed to get cpu utilization: ${missing[0]}`;
            event(cl, hpa, "Warning", "FailedGetResourceMetric", msg, "horizontal-pod-autoscaler");
            event(cl, hpa, "Warning", "FailedComputeMetricsReplicas", `invalid metrics (1 invalid out of 1), first error is: failed to get cpu resource metric value: ${msg}`, "horizontal-pod-autoscaler");
            cond("ScalingActive", "False", "FailedGetResourceMetric", `the HPA was unable to compute the replica count: ${msg}`);
            s.currentMetrics = [{ type: "" }];
          } else if (pods.length) {
            const ready = pods.filter(podReady);
            const use = ready.reduce((n, p) => n + cpuUsage(cl, p, t), 0);
            const req = ready.reduce((n, p) => n + p.spec.containers.reduce((m, c) => m + cpuMilli(c.resources.requests.cpu), 0), 0);
            util = req ? Math.round((use / req) * 100) : 0;
            s.currentMetrics = [{ resource: { current: { averageUtilization: util, averageValue: `${Math.round(use / Math.max(1, ready.length))}m` }, name: "cpu" }, type: "Resource" }];
            cond("ScalingActive", "True", "ValidMetricFound", "the HPA was able to successfully calculate a replica count from cpu resource utilization (percentage of request)");
            const ratio = util / tgt;
            if (Math.abs(ratio - 1) > 0.1) desired = Math.ceil(ready.length * ratio);
            reason = desired > cur ? "cpu resource utilization (percentage of request) above target" : "All metrics below target";
          }
        }
      }
      const recs = (cl.hpaRecs.get(hpa.metadata.uid) ?? []).filter((x) => x.t > t - 300);
      recs.push({ t, n: desired });
      cl.hpaRecs.set(hpa.metadata.uid, recs);
      if (desired < cur) desired = Math.max(...recs.map((x) => x.n));
      let limited = null;
      if (desired < hpa.spec.minReplicas) { desired = hpa.spec.minReplicas; reason = "Current number of replicas below Spec.MinReplicas"; limited = "TooFewReplicas"; }
      if (desired > hpa.spec.maxReplicas) { desired = hpa.spec.maxReplicas; reason = reason ?? "Current number of replicas above Spec.MaxReplicas"; limited = "TooManyReplicas"; }
      if (cur < hpa.spec.minReplicas) reason = "Current number of replicas below Spec.MinReplicas";
      cond("ScalingLimited", limited ? "True" : "False", limited ?? "DesiredWithinRange", limited === "TooFewReplicas" ? "the desired replica count is less than the minimum replica count" : limited ? "the desired replica count is more than the maximum replica count" : "the desired count is within the acceptable range");
      s.desiredReplicas = desired;
      if (desired !== cur) {
        target.spec.replicas = desired;
        target.metadata.generation = (target.metadata.generation ?? 1) + 1;
        putObj(cl, r, target);
        s.lastScaleTime = rfc(t);
        event(cl, hpa, "Normal", "SuccessfulRescale", `New size: ${desired}; reason: ${reason}`, "horizontal-pod-autoscaler");
      }
      void util;
    }
    if (canon(s) !== before) { putObj(cl, "horizontalpodautoscalers", hpa); return true; }
    return false;
  }

  // endpoint slices (and the old Endpoints): the ready pods behind each service with a selector
  function syncEndpoints(cl, svc) {
    const ns = svc.metadata.namespace;
    const name = svc.metadata.name;
    let addrs = [];
    if (name === "kubernetes" && ns === "default") addrs = [{ ip: cl.nodes[0].ip, ready: true, node: cl.nodes[0].name, port: 6443 }];
    else if (svc.spec.selector) {
      for (const p of list(cl, "pods", ns)) {
        if (!matchLabelsOk(p.metadata.labels, svc.spec.selector) || !Object.keys(svc.spec.selector).length || !p.status.podIP || ["Succeeded", "Failed"].includes(p.status.phase)) continue;
        const term = !!p.metadata.deletionTimestamp;
        addrs.push({ ip: p.status.podIP, ready: podReady(p) && !term, serving: podReady(p), terminating: term, node: p.spec.nodeName, pod: p });
      }
    } else return false;
    const ports = (svc.spec.ports ?? []).map((sp) => {
      let port = sp.targetPort;
      if (typeof port === "string") {
        const p = addrs.find((a) => a.pod)?.pod;
        port = Number(p?.spec.containers.flatMap((c) => c.ports ?? []).find((x) => x.name === port)?.containerPort ?? NaN);
      }
      return { name: sp.name ?? "", port: name === "kubernetes" ? 6443 : port, protocol: sp.protocol };
    }).filter((p) => !Number.isNaN(p.port));
    let slice = list(cl, "endpointslices", ns).find((x) => x.metadata.labels?.["kubernetes.io/service-name"] === name);
    const endpoints = addrs.sort((a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true })).map((a) => ({ addresses: [a.ip], conditions: { ready: a.ready, serving: a.serving ?? true, terminating: a.terminating ?? false }, nodeName: a.node, ...(a.pod ? { targetRef: { kind: "Pod", name: a.pod.metadata.name, namespace: ns, uid: a.pod.metadata.uid } } : {}) }));
    const want = { endpoints: endpoints.length ? endpoints : null, ports: ports.length ? ports : null };
    if (!slice) {
      slice = { addressType: "IPv4", apiVersion: "discovery.k8s.io/v1", kind: "EndpointSlice", metadata: { name: name === "kubernetes" ? "kubernetes" : `${name}-${rand5(cl.e)}`, namespace: ns, labels: { "endpointslice.kubernetes.io/managed-by": name === "kubernetes" ? "endpointslicemirroring-controller.k8s.io" : "endpointslice-controller.k8s.io", "kubernetes.io/service-name": name, ...(svc.metadata.labels ?? {}) }, generateName: name === "kubernetes" ? undefined : `${name}-`, ownerReferences: [{ apiVersion: "v1", blockOwnerDeletion: true, controller: true, kind: "Service", name, uid: svc.metadata.uid }] }, ...want };
      putObj(cl, "endpointslices", slice, { fresh: true });
    } else if (!same({ endpoints: slice.endpoints, ports: slice.ports }, want)) { Object.assign(slice, want); putObj(cl, "endpointslices", slice); }
    else return false;
    // the deprecated v1 Endpoints, kept in step
    const ready = addrs.filter((a) => a.ready && !a.terminating), notReady = addrs.filter((a) => !a.ready && !a.terminating);
    const ep = getObj(cl, "endpoints", ns, name) ?? { apiVersion: "v1", kind: "Endpoints", metadata: { name, namespace: ns, labels: { ...(svc.metadata.labels ?? {}) } } };
    const addr = (a) => ({ ip: a.ip, nodeName: a.node, ...(a.pod ? { targetRef: { kind: "Pod", name: a.pod.metadata.name, namespace: ns, uid: a.pod.metadata.uid } } : {}) });
    ep.subsets = ready.length || notReady.length ? [{ ...(ready.length ? { addresses: ready.map(addr) } : {}), ...(notReady.length ? { notReadyAddresses: notReady.map(addr) } : {}), ports: ports.map((p) => ({ ...(p.name ? { name: p.name } : {}), port: p.port, protocol: p.protocol })) }] : undefined;
    putObj(cl, "endpoints", ep, { fresh: !ep.metadata.uid });
    return true;
  }

  // local-path-provisioner: a claim gets a volume on the node of the first pod that uses it
  function provision(cl, pvc, node) {
    const t = nowOf(cl);
    const name = `pvc-${pvc.metadata.uid}`;
    const ns = pvc.metadata.namespace;
    event(cl, pvc, "Normal", "ExternalProvisioning", "Waiting for a volume to be created either by the external provisioner 'rancher.io/local-path' or manually by the system administrator. If volume creation is delayed, please verify that the volume plugin is installed correctly.", "persistentvolume-controller");
    const prov = list(cl, "pods", "local-path-storage")[0]?.metadata.name ?? "local-path-provisioner";
    event(cl, pvc, "Normal", "Provisioning", `External provisioner is provisioning volume for claim "${ns}/${pvc.metadata.name}"`, `rancher.io/local-path_${prov}_${newUid(cl.e)}`);
    const pv = { apiVersion: "v1", kind: "PersistentVolume", metadata: { name, annotations: { "local.path.provisioner/selected-node": node.name, "pv.kubernetes.io/provisioned-by": "rancher.io/local-path" }, finalizers: ["kubernetes.io/pv-protection"] }, spec: { accessModes: [...pvc.spec.accessModes], capacity: { storage: pvc.spec.resources.requests.storage }, claimRef: { apiVersion: "v1", kind: "PersistentVolumeClaim", name: pvc.metadata.name, namespace: ns, resourceVersion: pvc.metadata.resourceVersion, uid: pvc.metadata.uid }, hostPath: { path: `/var/local-path-provisioner/${name}_${ns}_${pvc.metadata.name}`, type: "DirectoryOrCreate" }, nodeAffinity: { required: { nodeSelectorTerms: [{ matchExpressions: [{ key: "kubernetes.io/hostname", operator: "In", values: [node.name] }] }] } }, persistentVolumeReclaimPolicy: "Delete", storageClassName: pvc.spec.storageClassName, volumeMode: "Filesystem" }, status: { lastPhaseTransitionTime: rfc(t), phase: "Bound" } };
    putObj(cl, "persistentvolumes", pv, { fresh: true });
    cl.pvNode.set(name, node.name);
    node.ne.volumes.set(name, { name, created: t, files: new Map(), labels: {} });
    event(cl, pvc, "Normal", "ProvisioningSucceeded", `Successfully provisioned volume ${name}`, `rancher.io/local-path_${prov}_${newUid(cl.e)}`);
    pvc.spec.volumeName = name;
    pvc.metadata.annotations = { ...(pvc.metadata.annotations ?? {}), "pv.kubernetes.io/bind-completed": "yes", "pv.kubernetes.io/bound-by-controller": "yes", "volume.beta.kubernetes.io/storage-provisioner": "rancher.io/local-path", "volume.kubernetes.io/selected-node": node.name, "volume.kubernetes.io/storage-provisioner": "rancher.io/local-path" };
    pvc.metadata.finalizers = ["kubernetes.io/pvc-protection"];
    pvc.status = { accessModes: [...pvc.spec.accessModes], capacity: { storage: pvc.spec.resources.requests.storage }, phase: "Bound" };
    putObj(cl, "persistentvolumeclaims", pvc);
  }
  function syncPVC(cl, pvc, t) {
    if (pvc.status?.phase === "Bound") {
      if (pvc.metadata.deletionTimestamp && !list(cl, "pods", pvc.metadata.namespace).some((p) => (p.spec.volumes ?? []).some((v) => v.persistentVolumeClaim?.claimName === pvc.metadata.name))) {
        delObj(cl, "persistentvolumeclaims", pvc);
        const pv = getObj(cl, "persistentvolumes", null, pvc.spec.volumeName);
        if (pv) { delObj(cl, "persistentvolumes", pv); for (const n of cl.nodes) n.ne.volumes.delete(pv.metadata.name); }
        return true;
      }
      return false;
    }
    if (!cl.pvcWaitEvent.has(pvc.metadata.uid)) { cl.pvcWaitEvent.add(pvc.metadata.uid); event(cl, pvc, "Normal", "WaitForFirstConsumer", "waiting for first consumer to be created before binding", "persistentvolume-controller"); }
    const user = list(cl, "pods", pvc.metadata.namespace).find((p) => (p.spec.volumes ?? []).some((v) => v.persistentVolumeClaim?.claimName === pvc.metadata.name) && !p.spec.nodeName);
    void user; void t;
    return false;
  }

  // the garbage collector: objects whose owner is gone are deleted too
  function deleteCascade(cl, r, o, grace = null) {
    if (r === "pods") return startDelete(cl, o, grace);
    delObj(cl, r, o);
    if (r === "jobs") cl.jobGone.delete(o.metadata.uid);
    for (const [k, x] of [...cl.objs]) if (ownedBy(x, o)) deleteCascade(cl, k.split("/")[0], x, grace);
    if (r === "services") { const ep = getObj(cl, "endpoints", o.metadata.namespace, o.metadata.name); if (ep) delObj(cl, "endpoints", ep); }
  }
  function collectGarbage(cl) {
    const uids = new Set([...cl.objs.values()].map((o) => o.metadata.uid));
    let changed = false;
    for (const [k, o] of [...cl.objs]) {
      const refs = o.metadata.ownerReferences ?? [];
      if (refs.length && refs.every((x) => !uids.has(x.uid)) && !(k.startsWith("pods/") && o.metadata.deletionTimestamp)) { deleteCascade(cl, k.split("/")[0], o); changed = true; }
    }
    for (const ns of list(cl, "namespaces")) {
      if (ns.status.phase !== "Terminating") continue;
      const left = [...cl.objs].filter(([k, o]) => o.metadata.namespace === ns.metadata.name && !RES[k.split("/")[0]].cluster);
      for (const [k, o] of left) if (!(k.startsWith("pods/") && o.metadata.deletionTimestamp)) deleteCascade(cl, k.split("/")[0], o);
      if (!left.some(([k]) => k.startsWith("pods/"))) { delObj(cl, "namespaces", ns); changed = true; }
    }
    return changed;
  }

  /* ------------------------------------------------------------ time: everything that happens between commands */

  async function work(cl) {
    const t = nowOf(cl);
    for (const n of cl.nodes) setNodeConditions(cl, n);
    for (let pass = 0; pass < 30; pass++) {
      const rv0 = cl.rv;
      for (const d of list(cl, "deployments")) syncDeployment(cl, d, t);
      for (const rs of list(cl, "replicasets")) syncReplicaSet(cl, rs, t);
      for (const j of list(cl, "jobs")) syncJob(cl, j, t);
      if (pass === 0) for (const cj of list(cl, "cronjobs")) syncCronJob(cl, cj, t);
      if (pass === 0) for (const h of list(cl, "horizontalpodautoscalers")) syncHPA(cl, h, t);
      for (const pvc of list(cl, "persistentvolumeclaims")) syncPVC(cl, pvc, t);
      for (const p of list(cl, "pods")) { const rt = cl.rt.get(p.metadata.uid); if (rt && !rt.node && !p.metadata.deletionTimestamp) schedule(cl, p, rt); }
      for (const p of list(cl, "pods")) { const rt = cl.rt.get(p.metadata.uid); if (rt?.node) await kubelet(cl, p, rt); }
      for (const s of list(cl, "services")) syncEndpoints(cl, s);
      collectGarbage(cl);
      for (const ds of list(cl, "daemonsets")) {
        const n = list(cl, "pods", ds.metadata.namespace).filter((p) => ownedBy(p, ds));
        const ready = n.filter(podReady).length;
        const st = { currentNumberScheduled: n.length, desiredNumberScheduled: cl.nodes.length, numberAvailable: ready, numberMisscheduled: 0, numberReady: ready, observedGeneration: 1, updatedNumberScheduled: n.length };
        if (!same(st, ds.status)) { ds.status = st; putObj(cl, "daemonsets", ds); }
      }
      if (cl.rv === rv0) break;
    }
    cl.synced = t;
  }
  // move the clock on, one second at a time, until done() says so (or the limit passes)
  async function advance(cl, seconds, done = null, each = null) {
    for (let i = 0; i < seconds; i++) {
      if (done && done()) return true;
      D.tick(cl.e, 1);
      await work(cl);
      if (each) each();
    }
    return done ? done() : true;
  }

  /* ------------------------------------------------------------ the cluster network */

  // a request from inside a pod: Service names and IPs, pod IPs, and the node's addresses
  function resolveInCluster(cl, ns, host) {
    const h = host.toLowerCase().replace(/\.$/, "");
    const svcNamed = (name, sns) => getObj(cl, "services", sns, name);
    let m;
    if ((m = /^([a-z0-9-]+)(?:\.([a-z0-9-]+))?(?:\.svc(?:\.cluster\.local)?)?$/.exec(h)) && !/^\d/.test(h)) {
      const s = svcNamed(m[1], m[2] ?? ns);
      if (s && (h.split(".").length <= 2 || /\.svc(\.cluster\.local)?$/.test(h))) return { svc: s };
    }
    for (const s of list(cl, "services")) if (s.spec.clusterIP === h) return { svc: s };
    for (const p of list(cl, "pods")) if (p.status.podIP === h && !p.spec.hostNetwork) return { pod: p };
    for (const n of cl.nodes) if (n.ip === h || n.name === h) return { node: n };
    return null;
  }
  const podListener = (cl, pod, port) => {
    const rt = cl.rt.get(pod.metadata.uid);
    if (!rt) return null;
    for (const st of rt.cs.values()) if (st.dc && st.dc.state === "running" && st.dc.netns.listeners.has(port)) return { lst: st.dc.netns.listeners.get(port), dc: st.dc };
    return null;
  };
  // kube-proxy: a ready endpoint of the service, chosen at random
  function pickEndpoint(cl, svc, port) {
    const sp = (svc.spec.ports ?? []).find((p) => p.port === port || p.nodePort === port);
    if (!sp) return { error: "refused" };
    const slice = list(cl, "endpointslices", svc.metadata.namespace).find((x) => x.metadata.labels?.["kubernetes.io/service-name"] === svc.metadata.name);
    const ready = (slice?.endpoints ?? []).filter((e) => e.conditions.ready);
    if (!ready.length) return { error: "refused" };
    const ep = ready[Math.floor(rnd(cl.e) * ready.length)];
    const target = (slice.ports ?? []).find((p) => p.name === (sp.name ?? "")) ?? slice.ports?.[0];
    const pod = list(cl, "pods", svc.metadata.namespace).find((p) => p.metadata.uid === ep.targetRef?.uid);
    return { pod, port: target?.port };
  }
  async function deliverToPod(cl, pod, port, req, remote) {
    const hit = podListener(cl, pod, port);
    if (!hit) return { error: "refused", ip: pod.status.podIP, port };
    const hits = cl.hits.get(pod.metadata.uid) ?? [];
    hits.push(nowOf(cl)); if (hits.length > 500) hits.shift();
    cl.hits.set(pod.metadata.uid, hits);
    D.syncIn(hit.dc);
    const r = await hit.lst.handle({ ...req, remote, now: D.now(cl.e) });
    D.syncOut(hit.dc);
    return r;
  }
  const origRequest = NET.request;
  NET.request = async (sh, req) => {
    const pod = sh.container?.pod;
    if (!pod) return origRequest(sh, req);
    const m = /^(https?):\/\/(\[[^\]]+\]|[^/:?#]+)(?::(\d+))?([^?#]*)(\?[^#]*)?/i.exec(req.url);
    if (!m) return origRequest(sh, req);
    const [, scheme, rawHost, portStr, path = "", query = ""] = m;
    const host = rawHost.toLowerCase();
    if (D.LOOPBACK.has(host) || host === sh.container.hostname) return origRequest(sh, req);
    const cl = pod.cl;
    const port = Number(portStr ?? (scheme === "https" ? 443 : 80));
    const hit = resolveInCluster(cl, pod.ns, host);
    if (!hit) return { error: "dns", host };
    const self = list(cl, "pods", pod.ns).find((p) => p.metadata.uid === pod.uid);
    const remote = self?.status.podIP ?? "10.244.0.1";
    const hdrs = { Host: portStr ? `${rawHost}:${portStr}` : rawHost, "User-Agent": req.userAgent ?? "Wget", Accept: "*/*", ...(req.headers ?? {}) };
    if (req.body) hdrs["Content-Length"] = String(new TextEncoder().encode(req.body).length);
    const r0 = { method: req.method ?? "GET", url: (path || "/") + query, headers: hdrs, body: req.body ?? "" };
    if (hit.svc) {
      if (hit.svc.metadata.name === "kubernetes") return { error: "tls", host, port };
      const ep = pickEndpoint(cl, hit.svc, port);
      if (ep.error) return { error: ep.error, host, port, ip: hit.svc.spec.clusterIP };
      if (scheme === "https") return { error: "tls", host, port };
      const r = await deliverToPod(cl, ep.pod, ep.port, r0, remote);
      return r.error ? { ...r, ip: hit.svc.spec.clusterIP, port } : r;
    }
    if (hit.pod) {
      const r = await deliverToPod(cl, hit.pod, port, r0, remote);
      return r.error ? { ...r, ip: hit.pod.status.podIP } : r;
    }
    return { error: "refused", ip: hit.node.ip, port };
  };
  // NodePorts: kube-proxy listens on every node (kind publishes some of them with extraPortMappings)
  function nodePortListeners(cl) {
    for (const n of cl.nodes) {
      const ns = n.container.netns;
      for (const [port, l] of [...ns.listeners]) if (l.nodePort && !list(cl, "services").some((s) => (s.spec.ports ?? []).some((p) => p.nodePort === port))) ns.listeners.delete(port);
      for (const s of list(cl, "services")) for (const p of s.spec.ports ?? []) {
        if (!p.nodePort || ns.listeners.has(p.nodePort)) continue;
        ns.listeners.set(p.nodePort, { host: null, nodePort: true, handle: async (req) => {
          const svc = getObj(cl, "services", s.metadata.namespace, s.metadata.name);
          if (!svc) return { error: "refused" };
          await work(cl);
          const ep = pickEndpoint(cl, svc, p.nodePort);
          if (ep.error) return { error: "reset" };
          return deliverToPod(cl, ep.pod, ep.port, req, n.ip);
        } });
      }
    }
  }

  /* ------------------------------------------------------------ kind */

  // the node container's entrypoint: kind's script, then systemd, containerd and the kubelet
  D.EXTRA.programs["/usr/local/bin/entrypoint"] = async (sh) => {
    const c = sh.container;
    if (!c) return 1;
    const cl = [...clustersOf(c.engine.owner.docker ?? c.engine).values()].find((x) => x.nodes.some((n) => n.container === c));
    const node = cl?.nodes.find((n) => n.container === c) ?? null;
    c.daemon = {
      kindNode: node,
      stop: () => {
        if (node) for (const p of list(cl, "pods")) {
          const rt = cl.rt.get(p.metadata.uid);
          if (rt?.node !== node) continue;
          for (const st of rt.cs.values()) if (st.dc && st.dc.state === "running") { D.stopContainer(node.ne, st.dc, 0, { kill: true }); st.stage = "create"; st.at = 0; st.restarts++; st.ready = false; }
        }
        return 129;
      },
    };
    if (node) { node.ip = Object.values(c.networks)[0]?.ip ?? node.ip; for (const p of list(cl, "pods")) { const rt = cl.rt.get(p.metadata.uid); if (rt?.node === node && rt.virtual) for (const st of rt.cs.values()) st.restarts += st.stage === "running" && cl.booted ? 1 : 0; } }
    c.procs[c.procs.length - 1].cmd = "/sbin/init";
    return 0;
  };
  const kubeconfigPath = (sh) => (sh.env.KUBECONFIG || `${HOME}/.kube/config`).split(":")[0];
  function readKubeconfig(sh) {
    const text = sh.fs.text(kubeconfigPath(sh));
    if (text === null) return null;
    try { return parseDocument(text).toJS() ?? null; } catch { return null; }
  }
  async function writeKubeconfig(sh, cfg) {
    const p = kubeconfigPath(sh);
    D.mkdirp(sh.fs, p.slice(0, p.lastIndexOf("/")));
    const sorted = { apiVersion: "v1", clusters: cfg.clusters ?? [], contexts: cfg.contexts ?? [], "current-context": cfg["current-context"] ?? "", kind: "Config", preferences: cfg.preferences ?? {}, users: cfg.users ?? [] };
    await sh.fs.writeFile(p, yamlDoc(sorted));
  }
  const fakeCert = (e, n) => b64(`-----BEGIN ${n}-----\n${Array.from({ length: 6 }, () => b64(hexr(e, 48)).slice(0, 64)).join("\n")}\n-----END ${n}-----\n`);
  async function kindCmd(sh, args, io) {
    const e = D.engine(sh);
    const flag = (name, short) => { const i = args.findIndex((a) => a === name || a === short || a.startsWith(name + "=")); if (i < 0) return null; return args[i].includes("=") ? args[i].split("=").slice(1).join("=") : args[i + 1]; };
    // positional words only: skip flags and the value of --name / -n / --config (kind takes them as "--flag value")
    const valued = new Set(["--name", "-n", "--config", "-c", "--image", "--kubeconfig"]);
    const sub = args.filter((a, i) => !a.startsWith("-") && !valued.has(args[i - 1]));
    const name = flag("--name", "-n") ?? "kind";
    const [verb, noun] = sub;
    if (verb === "version" || args[0] === "--version") { io.out(`kind ${V.kind} ${V.kindGo} linux/amd64\n`); return 0; }
    if (!verb || verb === "help" || args.includes("--help") || args.includes("-h")) {
      io.out("kind creates and manages local Kubernetes clusters using Docker container 'nodes'\n\nUsage:\n  kind [command]\n\nAvailable Commands:\n  build       Build one of [node-image]\n  completion  Output shell completion code for the specified shell (bash, zsh or fish)\n  create      Creates one of [cluster]\n  delete      Deletes one of [cluster]\n  export      Exports one of [kubeconfig, logs]\n  get         Gets one of [clusters, nodes, kubeconfig]\n  help        Help about any command\n  load        Loads images into nodes\n  version     Prints the kind CLI version\n\nFlags:\n  -h, --help              help for kind\n  -q, --quiet             silence all stderr output\n  -v, --verbosity int32   info log verbosity, higher value produces more output\n      --version           version for kind\n\nUse \"kind [command] --help\" for more information about a command.\n");
      return 0;
    }
    if (verb === "get" && noun === "clusters") {
      const names = [...clustersOf(e).keys()].sort();
      if (!names.length) { io.err("No kind clusters found.\n"); return 0; }
      io.out(names.map((n) => n + "\n").join(""));
      return 0;
    }
    if (verb === "get" && noun === "nodes") {
      const cl = clustersOf(e).get(name);
      if (!cl) { io.err(`No kind nodes found for cluster "${name}".\n`); return 0; }
      io.out(cl.nodes.map((n) => n.name + "\n").join(""));
      return 0;
    }
    if (verb === "create" && noun === "cluster") return kindCreate(sh, e, name, flag("--config"), io);
    if (verb === "delete" && noun === "cluster") {
      io.err(`Deleting cluster "${name}" ...\n`);
      const cl = clustersOf(e).get(name);
      if (cl) {
        for (const n of cl.nodes) { if (n.container.state === "running") await D.stopContainer(e, n.container, 0, { kill: true }); D.removeContainer(e, n.container); }
        clustersOf(e).delete(name);
        const cfg = readKubeconfig(sh);
        if (cfg) {
          const ctx = `kind-${name}`;
          cfg.clusters = (cfg.clusters ?? []).filter((x) => x.name !== ctx);
          cfg.contexts = (cfg.contexts ?? []).filter((x) => x.name !== ctx);
          cfg.users = (cfg.users ?? []).filter((x) => x.name !== ctx);
          if (cfg["current-context"] === ctx) cfg["current-context"] = "";
          await writeKubeconfig(sh, cfg);
        }
        io.err(`Deleted nodes: [${cl.nodes.map((n) => JSON.stringify(n.name)).join(" ")}]\n`);
      }
      return 0;
    }
    if (verb === "load" && noun === "docker-image") {
      const images = sub.slice(2);
      const cl = clustersOf(e).get(name);
      if (!images.length) { io.err("ERROR: a list of image names is required\n"); return 1; }
      if (!cl) { io.err(`ERROR: no nodes found for cluster "${name}"\n`); return 1; }
      for (const ref of images) {
        const img = D.imageOf(e, ref);
        if (!img) { io.err(`ERROR: image: "${ref}" not present locally\n`); return 1; }
        const missing = cl.nodes.filter((n) => D.imageOf(n.ne, ref)?.id !== img.id);
        if (!missing.length) { io.err(`Image: "${ref}" with ID "sha256:${img.id}" found to be already present on all nodes.\n`); continue; }
        for (const n of missing) {
          io.err(`Image: "${ref}" with ID "sha256:${img.id}" not yet present on node "${n.name}", loading...\n`);
          n.ne.images.set(img.id, img);
          D.setTag(n.ne, ref, img);
          for (const l of img.layers) n.ne.content.add(l.digest);
        }
        D.tick(e, 3);
      }
      return 0;
    }
    if (verb === "export" && noun === "kubeconfig") {
      const cl = clustersOf(e).get(name);
      if (!cl) { io.err(`ERROR: could not locate any control plane nodes for cluster named '${name}'. Use the --name option to select a different cluster\n`); return 1; }
      await mergeKubeconfig(sh, cl);
      io.err(`Set kubectl context to "kind-${name}"\n`);
      return 0;
    }
    if (verb === "build") { io.err("ERROR: the sandbox's kind can't build node images; use the prebuilt kindest/node images\n"); return 1; }
    io.err(`ERROR: unknown command "${verb}" for "kind"\nRun 'kind --help' for usage.\n`);
    return 1;
  }
  async function mergeKubeconfig(sh, cl) {
    const cfg = readKubeconfig(sh) ?? {};
    const ctx = `kind-${cl.name}`;
    cfg.clusters = (cfg.clusters ?? []).filter((x) => x.name !== ctx).concat([{ cluster: { "certificate-authority-data": fakeCert(cl.e, "CERTIFICATE"), server: `https://127.0.0.1:${cl.apiPort}` }, name: ctx }]);
    cfg.contexts = (cfg.contexts ?? []).filter((x) => x.name !== ctx).concat([{ context: { cluster: ctx, user: ctx }, name: ctx }]);
    cfg.users = (cfg.users ?? []).filter((x) => x.name !== ctx).concat([{ name: ctx, user: { "client-certificate-data": fakeCert(cl.e, "CERTIFICATE"), "client-key-data": fakeCert(cl.e, "RSA PRIVATE KEY") } }]);
    cfg["current-context"] = ctx;
    await writeKubeconfig(sh, cfg);
  }
  async function kindCreate(sh, e, name, configFile, io) {
    let spec = { nodes: [{ role: "control-plane" }] };
    if (configFile) {
      const text = sh.fs.text(sh.abs(configFile));
      if (text === null) { io.err(`ERROR: failed to create cluster: error reading file: open ${configFile}: no such file or directory\n`); return 1; }
      let doc;
      try { doc = parseDocument(text).toJS(); } catch (err) { io.err(`ERROR: failed to create cluster: unable to decode config: ${err.message}\n`); return 1; }
      if (doc?.kind !== "Cluster" || !/^kind\.x-k8s\.io\/v1alpha4$/.test(doc?.apiVersion ?? "")) { io.err(`ERROR: failed to create cluster: unknown apiVersion: ${doc?.apiVersion ?? ""}\n`); return 1; }
      spec = { nodes: doc.nodes?.length ? doc.nodes : [{ role: "control-plane" }] };
      if (doc.name && !args0(name)) name = doc.name;
    }
    if (clustersOf(e).has(name) || [...e.containers.values()].some((c) => c.name === `${name}-control-plane`)) { io.err(`ERROR: failed to create cluster: node(s) already exist for a cluster with the name "${name}"\n`); return 1; }
    io.err(`Creating cluster "${name}" ...\n`);
    if (!D.imageOf(e, NODE_IMAGE)) { D.pull(e, NODE_IMAGE, () => {}, { quiet: true }); D.tick(e, 38); }
    io.err(` ✓ Ensuring node image (${NODE_IMAGE}) 🖼\n`);
    if (!e.networks.has("kind")) D.createNetwork(e, "kind", {});
    const img = D.imageOf(e, NODE_IMAGE);
    const cl = { name, e, objs: new Map(), rv: 400, events: [], evSeq: 0, rt: new Map(), nodes: [], apiPort: 32768 + Math.floor(rnd(e) * 28000), svcIPs: new Set(), nodePorts: new Set(), progress: new Map(), lastStatus: new Map(), jobGone: new Map(), jobSeen: new Set(), jobFailAt: new Map(), cronSeen: new Map(), hpaNext: new Map(), hpaRecs: new Map(), pvNode: new Map(), pvcWaitEvent: new Set(), hits: new Map(), pfs: [], booted: false };
    let workers = 0;
    spec.nodes.forEach((n, i) => {
      const role = n.role === "worker" ? "worker" : "control-plane";
      const nodeName = role === "control-plane" ? `${name}-control-plane${i ? i + 1 : ""}` : `${name}-worker${workers++ ? workers : ""}`;
      const ports = (n.extraPortMappings ?? []).map((p) => ({ hostIp: p.listenAddress && p.listenAddress !== "0.0.0.0" ? p.listenAddress : null, hostPort: Number(p.hostPort), containerPort: Number(p.containerPort), proto: (p.protocol ?? "TCP").toLowerCase() }));
      if (i === 0) ports.unshift({ hostIp: "127.0.0.1", hostPort: cl.apiPort, containerPort: 6443, proto: "tcp" });
      const c = D.createContainer(e, img, { name: nodeName, imageRef: NODE_IMAGE, hostname: nodeName, network: "kind", aliases: [nodeName], ports, restart: { name: "on-failure", max: 1 }, labels: { "io.x-k8s.kind.cluster": name, "io.x-k8s.kind.role": role } });
      const node = { name: nodeName, role, container: c, index: i, ip: Object.values(c.networks)[0].ip, pulling: new Map() };
      node.ne = nodeEngine(e, node);
      cl.nodes.push(node);
    });
    io.err(` ✓ Preparing nodes ${"📦 ".repeat(cl.nodes.length)}\n`);
    clustersOf(e).set(name, cl);
    for (const n of cl.nodes) await D.startContainer(e, n.container);
    D.tick(e, 4);
    io.err(" ✓ Writing configuration 📜\n");
    D.tick(e, 17);
    io.err(" ✓ Starting control-plane 🕹️\n");
    bootstrap(cl);
    cl.booted = true;
    D.tick(e, 2);
    io.err(" ✓ Installing CNI 🔌\n");
    D.tick(e, 1);
    io.err(" ✓ Installing StorageClass 💾\n");
    if (cl.nodes.length > 1) { D.tick(e, 14); io.err(" ✓ Joining worker nodes 🚜\n"); }
    await work(cl);
    await mergeKubeconfig(sh, cl);
    const salutations = ["Have a nice day! 👋", "Thanks for using kind! 😊", "Not sure what to do next? 😅  Check out https://kind.sigs.k8s.io/docs/user/quick-start/", "Have a question, bug, or feature request? Let us know! https://kind.sigs.k8s.io/#community 🙂"];
    io.err(`Set kubectl context to "kind-${name}"\nYou can now use your cluster with:\n\nkubectl cluster-info --context kind-${name}\n\n${salutations[Math.floor(rnd(e) * 4)]}\n`);
    return 0;
  }
  const args0 = () => false;
  registerCommand("kind", async (sh, args, io) => {
    if (sh.container) { io.err(sh.notFound ? sh.notFound("kind") : "sh: kind: not found\n"); return 127; }
    return kindCmd(sh, args, io);
  });

  /* ------------------------------------------------------------ kubectl: flags, the kubeconfig, the connection */

  const VALUE_FLAGS = new Set(["n", "namespace", "o", "output", "l", "selector", "f", "filename", "c", "container", "image", "port", "replicas", "env", "labels", "timeout", "for", "tail", "type", "from-literal", "from-file", "from-env-file", "from", "schedule", "target-port", "protocol", "name", "min", "max", "cpu", "cpu-percent", "memory", "revision", "grace-period", "sort-by", "field-selector", "context", "kubeconfig", "restart", "overrides", "cascade", "cluster", "user", "since", "k", "kustomize", "since-time", "template", "output-watch-events", "pod-running-timeout", "limits", "requests", "external-ip", "cert-file", "server", "image-pull-policy", "address", "max-log-requests", "field-manager", "validate", "chunk-size", "selector-label", "to-revision"]);
  const BOOL_FLAGS = new Set(["A", "all-namespaces", "w", "watch", "show-labels", "i", "stdin", "t", "tty", "rm", "all", "force", "prefix", "previous", "command", "overwrite", "ignore-not-found", "wait", "server-side", "minify", "raw", "R", "recursive", "q", "quiet", "follow", "current", "save-config", "no-headers", "client", "flatten", "attach", "privileged", "allow-missing-template-keys", "local", "dry-run", "show-kind", "watch-only", "all-containers", "timestamps", "insecure-skip-tls-verify", "record", "help", "h", "v", "verbose", "show-managed-fields", "expose", "leave-stdin-open", "keep-annotations", "include-uninitialized"]);
  function parseArgs(argv, cmd) {
    const pos = [], flags = {}, multi = {};
    let rest = null;
    const set = (k, v) => { (multi[k] ??= []).push(v); flags[k] = v; };
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === "--") { rest = argv.slice(i + 1); break; }
      if (a.startsWith("--") && a.length > 2) {
        const eq = a.indexOf("=");
        const k = a.slice(2, eq < 0 ? undefined : eq);
        if (k === "dry-run") { set("dry-run", eq < 0 ? "client" : a.slice(eq + 1)); continue; }
        if (eq >= 0) { if (!VALUE_FLAGS.has(k) && !BOOL_FLAGS.has(k) && k !== "patch") return { error: `unknown flag: --${k}` }; set(k, a.slice(eq + 1)); continue; }
        if (k === "patch" || VALUE_FLAGS.has(k)) { if (i + 1 >= argv.length) return { error: `flag needs an argument: --${k}` }; set(k, argv[++i]); continue; }
        if (BOOL_FLAGS.has(k)) { set(k, "true"); continue; }
        return { error: `unknown flag: --${k}` };
      }
      if (a.startsWith("-") && a.length > 1 && !/^-\d/.test(a)) {
        const chars = a.slice(1);
        for (let j = 0; j < chars.length; j++) {
          let ch = chars[j];
          // per-command meanings: logs -f follows and -p shows the previous container; patch -p is the patch
          if (cmd === "logs" && ch === "f") { set("follow", "true"); continue; }
          if (cmd === "logs" && ch === "p") { set("previous", "true"); continue; }
          if (cmd === "patch" && ch === "p") ch = "patch";
          if (ch === "patch" || VALUE_FLAGS.has(ch)) {
            const v = chars.slice(j + 1).replace(/^=/, "") || argv[++i];
            if (v === undefined) return { error: `flag needs an argument: '${ch === "patch" ? "p" : ch}' in -${ch === "patch" ? "p" : ch}` };
            set(ch, v); break;
          }
          if (BOOL_FLAGS.has(ch)) { set(ch, "true"); continue; }
          return { error: `unknown shorthand flag: '${ch}' in ${a}` };
        }
        continue;
      }
      pos.push(a);
    }
    const f = (...names) => { for (const n of names) if (flags[n] !== undefined) return flags[n]; return undefined; };
    const m = (...names) => names.flatMap((n) => multi[n] ?? []);
    const b = (...names) => names.some((n) => flags[n] !== undefined && flags[n] !== "false");
    return { pos, flags, f, m, b, rest };
  }
  // the cluster the current context points at, if its API server can be reached
  function connect(sh, a) {
    const e = D.engine(sh);
    const cfg = readKubeconfig(sh);
    const ctxName = a.f("context") ?? cfg?.["current-context"];
    const ctx = (cfg?.contexts ?? []).find((x) => x.name === ctxName);
    if (!cfg || !ctxName) return { error: "noconfig" };
    if (!ctx) return { error: `context was not found for specified context: ${ctxName}` };
    const cluster = (cfg.clusters ?? []).find((x) => x.name === ctx.context?.cluster);
    const server = cluster?.cluster?.server ?? "";
    const port = Number((/:(\d+)$/.exec(server) ?? [])[1]);
    const cl = [...clustersOf(e).values()].find((x) => x.apiPort === port);
    const up = cl && cl.nodes[0].container.state === "running" && cl.nodes[0].container.daemon?.kindNode;
    if (!up) return { error: "refused", server };
    return { cl, ns: ctx.context?.namespace || "default", ctxName, cfg };
  }
  function connError(e, io, c) {
    const host = c.server ? c.server.replace(/^https?:\/\//, "") : "localhost:8080";
    const url = c.server ? `${c.server}/api?timeout=32s` : "http://localhost:8080/api?timeout=32s";
    const dial = c.server ? `dial tcp ${host}: connect: connection refused` : "dial tcp [::1]:8080: connect: connection refused";
    const d = new Date(D.now(e) * 1000);
    const p = (n, w = 2) => String(n).padStart(w, "0");
    for (let i = 0; i < 5; i++) io.err(`E${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}.${p(Math.floor(rnd(e) * 1e6), 6)}   ${4300 + Math.floor(rnd(e) * 500)} memcache.go:265] "Unhandled Error" err="couldn't get current server API group list: Get \\"${url}\\": ${dial}"\n`);
    io.err(`The connection to the server ${host} was refused - did you specify the right host or port?\n`);
    return 1;
  }

  /* ------------------------------------------------------------ kubectl get: the tables */

  function podStatusText(p) {
    let reason = p.status.reason ?? p.status.phase;
    let ready = 0, restarts = 0, lastRestart = 0;
    const cs = p.status.containerStatuses ?? [];
    for (const c of cs) {
      restarts += c.restartCount;
      if (c.lastState?.terminated) lastRestart = Math.max(lastRestart, Date.parse(c.lastState.terminated.finishedAt) / 1000);
    }
    for (let i = cs.length - 1; i >= 0; i--) {
      const c = cs[i];
      if (c.state.waiting?.reason) reason = c.state.waiting.reason;
      else if (c.state.terminated?.reason) reason = c.state.terminated.reason;
      else if (c.state.terminated) reason = c.state.terminated.signal ? `Signal:${c.state.terminated.signal}` : `ExitCode:${c.state.terminated.exitCode}`;
      else if (c.ready && c.state.running) ready++;
    }
    if (reason === "Completed" && cs.some((c) => c.ready)) reason = "Running";
    if (p.metadata.deletionTimestamp) reason = "Terminating";
    if (reason === "Pending" && (p.status.conditions ?? []).some((c) => c.type === "PodScheduled" && c.status === "False")) reason = "Pending";
    return { reason, ready: `${ready}/${p.spec.containers.length}`, restarts, lastRestart };
  }
  const svcPorts = (s) => (s.spec.ports ?? []).map((p) => `${p.port}${p.nodePort ? ":" + p.nodePort : ""}/${p.protocol}`).join(",") || "<none>";
  const svcExternal = (s) => (s.spec.type === "LoadBalancer" ? (s.status?.loadBalancer?.ingress ?? []).map((i) => i.ip).join(",") || "<pending>" : s.spec.type === "ExternalName" ? s.spec.externalName : (s.spec.externalIPs ?? []).join(",") || "<none>");
  const selText = (sel) => (sel ? [...Object.keys(sel.matchLabels ?? {}).sort().map((k) => `${k}=${sel.matchLabels[k]}`), ...(sel.matchExpressions ?? []).map((x) => `${x.key} ${x.operator.toLowerCase()} (${(x.values ?? []).join(",")})`)].join(",") : "<none>");
  const hpaTargets = (h) => {
    const m = (h.spec.metrics ?? [])[0];
    if (!m) return "<none>";
    const tgt = m.resource?.target?.averageUtilization !== undefined ? `${m.resource.target.averageUtilization}%` : m.resource?.target?.averageValue ?? "";
    const cur = (h.status?.currentMetrics ?? []).find((x) => x.resource?.name === m.resource?.name)?.resource?.current;
    const curText = cur ? (m.resource.target.averageUtilization !== undefined ? `${cur.averageUtilization}%` : cur.averageValue) : "<unknown>";
    return `${m.resource?.name}: ${curText}/${tgt}`;
  };
  const jobDone = (j) => (j.status?.conditions ?? []).find((c) => (c.type === "Complete" || c.type === "Failed") && c.status === "True");
  function printers(cl, t) {
    const ago = (o) => age(t - created(o));
    return {
      pods: { cols: ["NAME", "READY", "STATUS", "RESTARTS", "AGE"], wide: ["IP", "NODE", "NOMINATED NODE", "READINESS GATES"], row: (p) => { const s = podStatusText(p); return [s.ready, s.reason, s.lastRestart ? `${s.restarts} (${age(t - s.lastRestart)} ago)` : String(s.restarts), ago(p)]; }, wrow: (p) => [p.status.podIP ?? "<none>", p.spec.nodeName ?? "<none>", "<none>", "<none>"] },
      deployments: { cols: ["NAME", "READY", "UP-TO-DATE", "AVAILABLE", "AGE"], wide: ["CONTAINERS", "IMAGES", "SELECTOR"], row: (d) => [`${d.status?.readyReplicas ?? 0}/${d.spec.replicas}`, String(d.status?.updatedReplicas ?? 0), String(d.status?.availableReplicas ?? 0), ago(d)], wrow: (d) => [d.spec.template.spec.containers.map((c) => c.name).join(","), d.spec.template.spec.containers.map((c) => c.image).join(","), selText(d.spec.selector)] },
      replicasets: { cols: ["NAME", "DESIRED", "CURRENT", "READY", "AGE"], wide: ["CONTAINERS", "IMAGES", "SELECTOR"], row: (r) => [String(r.spec.replicas), String(r.status?.replicas ?? 0), String(r.status?.readyReplicas ?? 0), ago(r)], wrow: (r) => [r.spec.template.spec.containers.map((c) => c.name).join(","), r.spec.template.spec.containers.map((c) => c.image).join(","), selText(r.spec.selector)] },
      daemonsets: { cols: ["NAME", "DESIRED", "CURRENT", "READY", "UP-TO-DATE", "AVAILABLE", "NODE SELECTOR", "AGE"], wide: ["CONTAINERS", "IMAGES", "SELECTOR"], row: (d) => [String(d.status?.desiredNumberScheduled ?? 0), String(d.status?.currentNumberScheduled ?? 0), String(d.status?.numberReady ?? 0), String(d.status?.updatedNumberScheduled ?? 0), String(d.status?.numberAvailable ?? 0), d.spec.template.spec.nodeSelector ? labelString(d.spec.template.spec.nodeSelector) : "<none>", ago(d)], wrow: (d) => [d.spec.template.spec.containers.map((c) => c.name).join(","), d.spec.template.spec.containers.map((c) => c.image).join(","), selText(d.spec.selector)] },
      statefulsets: { cols: ["NAME", "READY", "AGE"], row: (s) => [`${s.status?.readyReplicas ?? 0}/${s.spec.replicas}`, ago(s)] },
      services: { cols: ["NAME", "TYPE", "CLUSTER-IP", "EXTERNAL-IP", "PORT(S)", "AGE"], wide: ["SELECTOR"], row: (s) => [s.spec.type, s.spec.clusterIP ?? "<none>", svcExternal(s), svcPorts(s), ago(s)], wrow: (s) => [s.spec.selector ? labelString(s.spec.selector) : "<none>"] },
      endpoints: { cols: ["NAME", "ENDPOINTS", "AGE"], row: (e) => { const ips = (e.subsets ?? []).flatMap((ss) => (ss.addresses ?? []).flatMap((a) => (ss.ports ?? []).map((p) => `${a.ip}:${p.port}`))); return [ips.length > 3 ? ips.slice(0, 3).join(",") + ` + ${ips.length - 3} more...` : ips.join(",") || "<none>", ago(e)]; } },
      endpointslices: { cols: ["NAME", "ADDRESSTYPE", "PORTS", "ENDPOINTS", "AGE"], row: (s) => { const ips = (s.endpoints ?? []).flatMap((e) => e.addresses); return [s.addressType, (s.ports ?? []).map((p) => p.port).join(",") || "<unset>", ips.length > 3 ? ips.slice(0, 3).join(",") + ` + ${ips.length - 3} more...` : ips.join(",") || "<unset>", ago(s)]; } },
      configmaps: { cols: ["NAME", "DATA", "AGE"], row: (c) => [String(Object.keys(c.data ?? {}).length + Object.keys(c.binaryData ?? {}).length), ago(c)] },
      secrets: { cols: ["NAME", "TYPE", "DATA", "AGE"], row: (s) => [s.type, String(Object.keys(s.data ?? {}).length), ago(s)] },
      serviceaccounts: { cols: ["NAME", "SECRETS", "AGE"], row: (s) => [String((s.secrets ?? []).length), ago(s)] },
      namespaces: { cols: ["NAME", "STATUS", "AGE"], row: (n) => [n.status.phase, ago(n)] },
      nodes: { cols: ["NAME", "STATUS", "ROLES", "AGE", "VERSION"], wide: ["INTERNAL-IP", "EXTERNAL-IP", "OS-IMAGE", "KERNEL-VERSION", "CONTAINER-RUNTIME"], row: (n) => [((n.status.conditions ?? []).find((c) => c.type === "Ready")?.status === "True" ? "Ready" : "NotReady") + (n.spec.unschedulable ? ",SchedulingDisabled" : ""), Object.keys(n.metadata.labels).filter((k) => k.startsWith("node-role.kubernetes.io/")).map((k) => k.split("/")[1]).join(",") || "<none>", ago(n), n.status.nodeInfo.kubeletVersion], wrow: (n) => [n.status.addresses[0].address, "<none>", n.status.nodeInfo.osImage, n.status.nodeInfo.kernelVersion, n.status.nodeInfo.containerRuntimeVersion] },
      horizontalpodautoscalers: { cols: ["NAME", "REFERENCE", "TARGETS", "MINPODS", "MAXPODS", "REPLICAS", "AGE"], row: (h) => [`${h.spec.scaleTargetRef.kind}/${h.spec.scaleTargetRef.name}`, hpaTargets(h), String(h.spec.minReplicas ?? 1), String(h.spec.maxReplicas), String(h.status?.currentReplicas ?? 0), ago(h)] },
      jobs: { cols: ["NAME", "STATUS", "COMPLETIONS", "DURATION", "AGE"], wide: ["CONTAINERS", "IMAGES", "SELECTOR"], row: (j) => { const d = jobDone(j); const start = j.status?.startTime ? Date.parse(j.status.startTime) / 1000 : t; const end = j.status?.completionTime ? Date.parse(j.status.completionTime) / 1000 : t; return [d ? d.type === "Complete" ? "Complete" : "Failed" : j.spec.suspend ? "Suspended" : "Running", `${j.status?.succeeded ?? 0}/${j.spec.completions}`, age(end - start), ago(j)]; }, wrow: (j) => [j.spec.template.spec.containers.map((c) => c.name).join(","), j.spec.template.spec.containers.map((c) => c.image).join(","), selText(j.spec.selector)] },
      cronjobs: { cols: ["NAME", "SCHEDULE", "TIMEZONE", "SUSPEND", "ACTIVE", "LAST SCHEDULE", "AGE"], wide: ["CONTAINERS", "IMAGES", "SELECTOR"], row: (c) => [c.spec.schedule, c.spec.timeZone ?? "<none>", String(!!c.spec.suspend), String((c.status?.active ?? []).length), c.status?.lastScheduleTime ? age(t - Date.parse(c.status.lastScheduleTime) / 1000) : "<none>", ago(c)], wrow: (c) => [c.spec.jobTemplate.spec.template.spec.containers.map((x) => x.name).join(","), c.spec.jobTemplate.spec.template.spec.containers.map((x) => x.image).join(","), "<none>"] },
      persistentvolumeclaims: { cols: ["NAME", "STATUS", "VOLUME", "CAPACITY", "ACCESS MODES", "STORAGECLASS", "VOLUMEATTRIBUTESCLASS", "AGE"], wide: ["VOLUMEMODE"], row: (p) => [p.metadata.deletionTimestamp ? "Terminating" : p.status?.phase ?? "Pending", p.spec.volumeName ?? "", p.status?.capacity?.storage ?? "", (p.status?.accessModes ?? []).map((m) => ({ ReadWriteOnce: "RWO", ReadOnlyMany: "ROX", ReadWriteMany: "RWX", ReadWriteOncePod: "RWOP" })[m]).join(","), p.spec.storageClassName ?? "<unset>", "<unset>", ago(p)], wrow: (p) => [p.spec.volumeMode] },
      persistentvolumes: { cols: ["NAME", "CAPACITY", "ACCESS MODES", "RECLAIM POLICY", "STATUS", "CLAIM", "STORAGECLASS", "VOLUMEATTRIBUTESCLASS", "REASON", "AGE"], row: (p) => [p.spec.capacity.storage, p.spec.accessModes.map((m) => ({ ReadWriteOnce: "RWO", ReadOnlyMany: "ROX", ReadWriteMany: "RWX", ReadWriteOncePod: "RWOP" })[m]).join(","), p.spec.persistentVolumeReclaimPolicy, p.status.phase, `${p.spec.claimRef.namespace}/${p.spec.claimRef.name}`, p.spec.storageClassName, "<unset>", "", ago(p)] },
      storageclasses: { cols: ["NAME", "PROVISIONER", "RECLAIMPOLICY", "VOLUMEBINDINGMODE", "ALLOWVOLUMEEXPANSION", "AGE"], row: (s) => [s.provisioner, s.reclaimPolicy, s.volumeBindingMode, String(!!s.allowVolumeExpansion), ago(s)], name: (s) => s.metadata.name + (s.metadata.annotations?.["storageclass.kubernetes.io/is-default-class"] === "true" ? " (default)" : "") },
      events: { cols: ["LAST SEEN", "TYPE", "REASON", "OBJECT", "MESSAGE"], noName: true },
      ingresses: { cols: ["NAME", "CLASS", "HOSTS", "ADDRESS", "PORTS", "AGE"], row: (i) => [i.spec?.ingressClassName ?? "<none>", (i.spec?.rules ?? []).map((r) => r.host ?? "*").join(",") || "*", "", "80", ago(i)] },
    };
  }

  const META_ORDER = ["name", "generateName", "namespace", "uid", "resourceVersion", "generation", "creationTimestamp", "deletionTimestamp", "deletionGracePeriodSeconds", "labels", "annotations", "ownerReferences", "finalizers"];
  // an object the way kubectl prints it as JSON: apiVersion, kind, metadata, spec, status, in Go's field order
  function forJson(o) {
    const out = {};
    for (const k of ["apiVersion", "kind", "metadata"]) if (o[k] !== undefined) out[k] = o[k];
    if (o.metadata) { const m = {}; for (const k of META_ORDER) if (o.metadata[k] !== undefined) m[k] = o.metadata[k]; out.metadata = m; }
    for (const k of Object.keys(o)) if (!(k in out) && k !== "status") out[k] = o[k];
    if (o.status !== undefined) out.status = o.status;
    return out;
  }
  const eventObj = (cl, ev) => ({ apiVersion: "v1", kind: "Event", count: ev.count, firstTimestamp: rfc(ev.first), involvedObject: { apiVersion: apiVersionOf(ev.obj.r ?? "pods"), kind: ev.obj.kind, name: ev.obj.name, ...(ev.obj.ns ? { namespace: ev.obj.ns } : {}), uid: ev.obj.uid }, lastTimestamp: rfc(ev.last), message: ev.message, metadata: { name: ev.name, namespace: ev.ns, creationTimestamp: rfc(ev.first) }, reason: ev.reason, source: { component: ev.source === "kubelet" ? "kubelet" : ev.source, ...(ev.source === "kubelet" ? { host: cl.nodes[0].name } : {}) }, type: ev.type });
  function eventsTable(cl, evs, t, { ns = false } = {}) {
    const rows = [[...(ns ? ["NAMESPACE"] : []), "LAST SEEN", "TYPE", "REASON", "OBJECT", "MESSAGE"]];
    for (const ev of evs) rows.push([...(ns ? [ev.ns] : []), ev.count > 1 ? `${age(t - ev.last)} (x${ev.count} over ${age(t - ev.first)})` : age(t - ev.last), ev.type, ev.reason, `${ev.obj.kind.toLowerCase()}/${ev.obj.name}`, ev.message]);
    return table(rows);
  }

  // kubectl get
  function cmdGet(sh, cl, a, ns, io) {
    const t = nowOf(cl);
    if (!a.pos.length && !a.m("f", "filename").length) {
      io.err('You must specify the type of resource to get. Use "kubectl api-resources" for a complete list of supported resources.\n\nerror: Required resource not specified.\nUse "kubectl explain <resource>" for a detailed description of that resource (e.g. kubectl explain pods).\nSee \'kubectl get -h\' for help and examples\n');
      return 1;
    }
    const all = a.b("A", "all-namespaces");
    const out = a.f("o", "output");
    if (a.b("w", "watch")) io.err("");
    let sel = null;
    if (a.f("l", "selector") !== undefined) { sel = parseSelector(a.f("l", "selector")); if (sel.error) { io.err(`error: ${sel.error}\n`); return 1; } }
    // requests: "pods", "pods name", "deploy,svc", "pod/hello", "all"
    const reqs = [];
    if (a.m("f", "filename").length) {
      for (const f of a.m("f", "filename")) {
        const docs = readManifests(sh, f, io);
        if (!docs) return 1;
        for (const d of docs) { const r = resOfKind(d.obj.kind); if (r) reqs.push({ r, names: [d.obj.metadata?.name], ns: RES[r].cluster ? null : d.obj.metadata?.namespace ?? ns }); }
      }
    } else if (a.pos[0].includes("/")) {
      for (const p of a.pos) { const [w, n] = p.split("/"); const r = resolveRes(w); if (!r) { io.err(`error: the server doesn't have a resource type "${w}"\n`); return 1; } reqs.push({ r, names: [n] }); }
    } else {
      const words = a.pos[0].split(",");
      const types = [];
      for (const w of words) {
        if (w === "all") { types.push("pods", "services", "daemonsets", "deployments", "replicasets", "statefulsets", "horizontalpodautoscalers", "jobs", "cronjobs"); continue; }
        const r = resolveRes(w);
        if (!r) { io.err(`error: the server doesn't have a resource type "${w}"\n`); return 1; }
        types.push(r);
      }
      const names = a.pos.slice(1);
      if (names.length && types.length > 1) { io.err("error: arguments in resource/name form must have a single resource and name\n"); return 1; }
      for (const r of types) reqs.push({ r, names: names.length ? names : null });
    }
    const multiType = new Set(reqs.map((x) => x.r)).size > 1 || (a.pos[0] ?? "").includes("/") && new Set(reqs.map((x) => x.r)).size > 1 || a.pos[0] === "all";
    const P = printers(cl, t);
    const found = [];
    let errors = 0;
    for (const q of reqs) {
      const qns = all ? null : q.ns ?? ns;
      if (q.r === "events") {
        let evs = cl.events.filter((x) => all || x.ns === qns);
        evs = [...evs].sort((x, y) => x.obj.name.localeCompare(y.obj.name) || x.seq - y.seq);
        found.push({ r: "events", objs: evs, isEvents: true });
        continue;
      }
      if (q.names) {
        for (const n of q.names) {
          const o = getObj(cl, q.r, qns ?? ns, n);
          if (!o) { io.err(`Error from server (NotFound): ${pluralString(q.r)} "${n}" not found\n`); errors++; continue; }
          found.push({ r: q.r, objs: [o], named: true });
        }
      } else {
        let objs = list(cl, q.r, RES[q.r].cluster ? null : qns);
        if (sel) objs = objs.filter((o) => matches(o.metadata.labels, sel));
        found.push({ r: q.r, objs });
      }
    }
    const groups = new Map();
    for (const f of found) { if (!groups.has(f.r)) groups.set(f.r, { r: f.r, objs: [], isEvents: f.isEvents }); groups.get(f.r).objs.push(...f.objs); }
    const items = [...groups.values()];
    const total = items.reduce((n, g) => n + g.objs.length, 0);
    if (out && !/^(wide|name)$/.test(out)) {
      const objs = items.flatMap((g) => (g.isEvents ? g.objs.map((ev) => eventObj(cl, ev)) : g.objs.map((o) => clone(o))));
      const single = found.length === 1 && found[0].named;
      const doc = single ? objs[0] : { apiVersion: "v1", items: objs, kind: "List", metadata: { resourceVersion: "" } };
      if (!objs.length && single) return 1;
      if (out === "yaml") io.out(yamlDoc(doc));
      else if (out === "json") io.out(jsonDoc(single ? forJson(doc) : { ...doc, items: doc.items.map(forJson) }));
      else if (/^jsonpath=|^jsonpath-as-json=/.test(out) || /^jsonpath$/.test(out)) {
        const tpl = out.replace(/^jsonpath(-as-json)?=/, "").replace(/^'(.*)'$/, "$1");
        io.out(jsonpath(tpl, doc));
      } else if (/^custom-columns=/.test(out)) {
        const cols = out.slice("custom-columns=".length).split(",").map((x) => { const [h, p] = x.split(":"); return { h, p }; });
        const rows = [cols.map((c) => c.h)];
        for (const o of single ? [doc] : doc.items) rows.push(cols.map((c) => { const v = jsonpath(`{${c.p}}`, o); return v === "" ? "<none>" : v; }));
        io.out(table(rows));
      } else { io.err(`error: unable to match a printer suitable for the output format "${out}", allowed formats are: custom-columns,custom-columns-file,go-template,go-template-file,json,jsonpath,jsonpath-as-json,jsonpath-file,name,template,templatefile,wide,yaml\n`); return 1; }
      return errors ? 1 : 0;
    }
    if (!total) {
      if (!errors) io.err(all ? "No resources found\n" : `No resources found in ${ns} namespace.\n`);
      return errors ? 1 : 0;
    }
    if (out === "name") { for (const g of items) for (const o of g.objs) io.out(`${kindString(g.r)}/${o.metadata?.name ?? o.name}\n`); return errors ? 1 : 0; }
    const blocks = [];
    for (const g of items) {
      if (!g.objs.length) continue;
      if (g.isEvents) { blocks.push(eventsTable(cl, g.objs, t, { ns: all })); continue; }
      const pr = P[g.r] ?? { cols: ["NAME", "AGE"], row: (o) => [age(t - created(o))] };
      const wide = out === "wide" && pr.wide;
      const showNs = all && !RES[g.r].cluster;
      const rows = [[...(showNs ? ["NAMESPACE"] : []), ...pr.cols, ...(wide ? pr.wide : []), ...(a.b("show-labels") ? ["LABELS"] : [])]];
      for (const o of g.objs) {
        const nm = pr.name ? pr.name(o) : o.metadata.name;
        rows.push([...(showNs ? [o.metadata.namespace] : []), multiType ? `${kindString(g.r)}/${nm}` : nm, ...pr.row(o), ...(wide ? pr.wrow(o) : []), ...(a.b("show-labels") ? [labelString(o.metadata.labels)] : [])]);
      }
      if (a.b("no-headers")) rows.shift();
      blocks.push(table(rows));
    }
    io.out(blocks.join("\n"));
    if (a.b("w", "watch")) io.err("(kubectl get --watch keeps printing changes until you press Ctrl+C; the sandbox stops here. Run the command again to see what changed.)\n");
    return errors ? 1 : 0;
  }

  /* ------------------------------------------------------------ manifests: reading, creating, applying */

  // metrics-server's manifest (kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/download/v0.9.0/components.yaml)
  const METRICS_URL = /^https:\/\/github\.com\/kubernetes-sigs\/metrics-server\/releases\/(latest\/download|download\/v0\.9\.0)\/components\.yaml$/;
  const METRICS_OBJS = () => {
    const labels = { "k8s-app": "metrics-server" };
    return [
      ["serviceaccount", "metrics-server"], ["clusterrole.rbac.authorization.k8s.io", "system:aggregated-metrics-reader"], ["clusterrole.rbac.authorization.k8s.io", "system:metrics-server"],
      ["rolebinding.rbac.authorization.k8s.io", "metrics-server-auth-reader"], ["clusterrolebinding.rbac.authorization.k8s.io", "metrics-server:system:auth-delegator"], ["clusterrolebinding.rbac.authorization.k8s.io", "system:metrics-server"],
      ["service", { apiVersion: "v1", kind: "Service", metadata: { labels, name: "metrics-server", namespace: "kube-system" }, spec: { ports: [{ appProtocol: "https", name: "https", port: 443, protocol: "TCP", targetPort: "https" }], selector: labels } }],
      ["deployment.apps", { apiVersion: "apps/v1", kind: "Deployment", metadata: { labels, name: "metrics-server", namespace: "kube-system" }, spec: { selector: { matchLabels: labels }, strategy: { rollingUpdate: { maxUnavailable: 0 } }, template: { metadata: { labels }, spec: { containers: [{ args: ["--cert-dir=/tmp", "--secure-port=10250", "--kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname", "--kubelet-use-node-status-port", "--metric-resolution=15s"], image: "registry.k8s.io/metrics-server/metrics-server:v0.9.0", imagePullPolicy: "IfNotPresent", name: "metrics-server", ports: [{ containerPort: 10250, name: "https", protocol: "TCP" }], readinessProbe: { failureThreshold: 3, httpGet: { path: "/readyz", port: "https", scheme: "HTTPS" }, initialDelaySeconds: 20, periodSeconds: 10 }, resources: { requests: { cpu: "100m", memory: "200Mi" } } }], priorityClassName: "system-cluster-critical", serviceAccountName: "metrics-server" } } } }],
      ["apiservice.apiregistration.k8s.io", "v1beta1.metrics.k8s.io"],
    ];
  };
  function readManifests(sh, f, io, stdin = "") {
    let sources = [];
    if (f === "-") sources = [{ name: "STDIN", text: stdin }];
    else if (/^https?:\/\//.test(f)) {
      if (METRICS_URL.test(f)) return [{ metrics: true, file: f }];
      io.err(`error: unable to read URL "${f}", server reported 404 Not Found, status code=404\n`);
      return null;
    } else {
      const p = sh.abs(f);
      if (sh.fs.isDir(p)) {
        const files = [...sh.fs.nodes.keys()].filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/") && /\.(ya?ml|json)$/.test(k)).sort();
        sources = files.map((k) => ({ name: f.replace(/\/$/, "") + "/" + k.slice(p.length + 1), text: sh.fs.text(k) }));
      } else {
        const text = sh.fs.text(p);
        if (text === null) { io.err(`error: the path "${f}" does not exist\n`); return null; }
        sources = [{ name: f, text }];
      }
    }
    const docs = [];
    for (const src of sources) {
      const parts = src.text.split(/^---[ \t]*(?:#.*)?$/m);
      let line = 1;
      for (const part of parts) {
        const lines = part.split("\n").length - 1;
        if (!part.trim() || part.split("\n").every((l) => /^\s*(#.*)?$/.test(l))) { line += lines + 1; continue; }
        let obj;
        if (/^\s*\{/.test(part)) { try { obj = JSON.parse(part); } catch (err) { io.err(`error: error parsing ${src.name}: ${err.message}\n`); return null; } }
        else {
          const doc = parseDocument(part, { prettyErrors: false, uniqueKeys: true });
          if (doc.errors.length) {
            const er = doc.errors[0];
            const at = (er.linePos?.[0]?.line ?? 1) + line - 1;
            const msg = /tab/i.test(er.message) ? "found character that cannot start any token" : /same column|indent/i.test(er.message) ? "did not find expected key" : /duplicate key|unique/i.test(er.message) ? `mapping key "${(/"([^"]+)"/.exec(er.message) ?? [])[1] ?? ""}" already defined` : "mapping values are not allowed in this context";
            io.err(`error: error parsing ${src.name}: error converting YAML to JSON: yaml: line ${at}: ${msg}\n`);
            return null;
          }
          obj = doc.toJS();
        }
        line += lines + 1;
        if (obj === null || obj === undefined) continue;
        if (typeof obj !== "object" || Array.isArray(obj)) { io.err(`error: error parsing ${src.name}: error converting YAML to JSON: yaml: cannot unmarshal into a Kubernetes object\n`); return null; }
        if (obj.kind === "List" && Array.isArray(obj.items)) { for (const it of obj.items) docs.push({ obj: it, file: src.name }); continue; }
        docs.push({ obj, file: src.name });
      }
    }
    return docs;
  }
  // resource for a manifest's apiVersion and kind, or kubectl's "no matches" error
  function mapping(o) {
    const r = resOfKind(o.kind);
    if (r && (o.apiVersion === apiVersionOf(r) || (r === "horizontalpodautoscalers" && o.apiVersion === "autoscaling/v1"))) return { r };
    return { error: `resource mapping not found for name: ${JSON.stringify(o.metadata?.name ?? "")} namespace: ${JSON.stringify(o.metadata?.namespace ?? "")} from ${"FILE"}: no matches for kind ${JSON.stringify(o.kind)} in version ${JSON.stringify(o.apiVersion)}\nensure CRDs are installed first` };
  }
  function allocServiceIP(cl, svc) {
    const s = svc.spec;
    if (s.type === "ExternalName") return;
    if (s.clusterIP === "None") { s.clusterIPs = ["None"]; s.ipFamilies = ["IPv4"]; s.ipFamilyPolicy = "SingleStack"; return; }
    if (!s.clusterIP) { let ip; do ip = `10.96.${Math.floor(rnd(cl.e) * 255)}.${1 + Math.floor(rnd(cl.e) * 254)}`; while (cl.svcIPs.has(ip)); s.clusterIP = ip; }
    cl.svcIPs.add(s.clusterIP);
    s.clusterIPs = [s.clusterIP]; s.ipFamilies = ["IPv4"]; s.ipFamilyPolicy = "SingleStack";
    if (s.type === "NodePort" || s.type === "LoadBalancer") for (const p of s.ports) { if (!p.nodePort) { let n; do n = 30000 + Math.floor(rnd(cl.e) * 2768); while (cl.nodePorts.has(n)); p.nodePort = n; } cl.nodePorts.add(p.nodePort); }
    if (s.type === "LoadBalancer") s.allocateLoadBalancerNodePorts = true;
  }
  // HPA autoscaling/v1 → v2
  function hpaToV2(o) {
    if (o.apiVersion !== "autoscaling/v1") return o;
    const x = clone(o);
    x.apiVersion = "autoscaling/v2";
    if (x.spec?.targetCPUUtilizationPercentage !== undefined) { x.spec.metrics = [{ resource: { name: "cpu", target: { averageUtilization: x.spec.targetCPUUtilizationPercentage, type: "Utilization" } }, type: "Resource" }]; delete x.spec.targetCPUUtilizationPercentage; }
    return x;
  }
  // create a new object: the API's defaults and validation, then what its kind needs (an IP, a pod)
  function createObject(cl, r, o, file = null) {
    o.apiVersion = apiVersionOf(r); o.kind = RES[r].kind;
    if (!o.spec && ["deployments", "services", "jobs", "cronjobs", "horizontalpodautoscalers", "persistentvolumeclaims", "pods", "replicasets"].includes(r)) o.spec = {};
    const v = validate(cl, r, o, null);
    if (v.decode) return { error: `Error from server (BadRequest): ${file ? `error when creating ${JSON.stringify(file)}: ` : ""}Secret in version "v1" cannot be handled as a Secret: ${v.decode}` };
    if (v.errs.length) return { error: invalidText(RES[r].kind, o.metadata.name, v.errs) };
    if (r === "pods") { createPod(cl, o); return { obj: o }; }
    defaultObject(cl, r, o);
    if (r === "services") allocServiceIP(cl, o);
    if (["deployments", "replicasets", "jobs", "cronjobs", "horizontalpodautoscalers", "daemonsets"].includes(r)) o.metadata.generation = 1;
    if (r === "deployments") o.status = {};
    if (r === "jobs") {
      putObj(cl, "jobs", o, { fresh: true });
      const labels = { "batch.kubernetes.io/controller-uid": o.metadata.uid, "batch.kubernetes.io/job-name": o.metadata.name, "controller-uid": o.metadata.uid, "job-name": o.metadata.name };
      o.spec.selector ??= { matchLabels: { "batch.kubernetes.io/controller-uid": o.metadata.uid } };
      o.spec.template.metadata = { ...(o.spec.template.metadata ?? {}), labels: { ...(o.spec.template.metadata?.labels ?? {}), ...labels } };
      o.metadata.labels = { ...labels, ...(o.metadata.labels ?? {}) };
      putObj(cl, "jobs", o);
      return { obj: o };
    }
    if (r === "persistentvolumeclaims") o.metadata.finalizers = ["kubernetes.io/pvc-protection"];
    putObj(cl, r, o, { fresh: true });
    return { obj: o };
  }
  // kubectl apply's merge: fields from the manifest win, fields dropped since the last apply go, others stay
  function merge3(live, last, want) {
    if (Array.isArray(want) || want === null || typeof want !== "object") return clone(want);
    const out = live && typeof live === "object" && !Array.isArray(live) ? clone(live) : {};
    for (const k of Object.keys(want)) out[k] = merge3(out[k], last?.[k], want[k]);
    if (last && typeof last === "object") for (const k of Object.keys(last)) if (!(k in want)) delete out[k];
    return out;
  }
  const LAST = "kubectl.kubernetes.io/last-applied-configuration";

  // kubectl apply -f / create -f
  async function cmdApplyFiles(sh, cl, a, ns, io, { create = false } = {}) {
    const files = a.m("f", "filename");
    if (a.f("k", "kustomize")) { io.err("error: the sandbox's kubectl doesn't build kustomizations; apply the files with -f instead\n"); return 1; }
    if (!files.length) { io.err(`error: must specify one of -f and -k\n\n`); return 1; }
    const dry = a.f("dry-run");
    let code = 0;
    const explicitNs = a.f("n", "namespace");
    for (const f of files) {
      const docs = readManifests(sh, f, io, io.stdin ?? "");
      if (!docs) return 1;
      for (const d of docs) {
        if (d.metrics) { code = applyMetricsServer(cl, io, create) || code; continue; }
        let o = clone(d.obj);
        if (!o.kind || !o.apiVersion) { io.err(`error: error validating ${JSON.stringify(d.file)}: error validating data: ${!o.apiVersion && !o.kind ? "[apiVersion not set, kind not set]" : !o.kind ? "kind not set" : "apiVersion not set"}; if you choose to ignore these errors, turn validation off with --validate=false\n`); code = 1; continue; }
        const mp = mapping(o);
        if (mp.error) { io.err(`error: ${mp.error.replace("FILE", JSON.stringify(d.file))}\n`); code = 1; continue; }
        const r = mp.r;
        if (r === "horizontalpodautoscalers") o = hpaToV2(o);
        const manifest = clone(o);
        o.metadata ??= {};
        if (!RES[r].cluster) {
          if (explicitNs && o.metadata.namespace && o.metadata.namespace !== explicitNs) { io.err(`error: the namespace from the provided object ${JSON.stringify(o.metadata.namespace)} does not match the namespace ${JSON.stringify(explicitNs)}. You must pass '--namespace=${o.metadata.namespace}' to perform this operation.\n`); code = 1; continue; }
          o.metadata.namespace ??= ns;
        }
        const name = o.metadata.name;
        const dc = decodeCheck(o, SCHEMAS[o.kind] ?? T(o.kind, {}));
        const live = name ? getObj(cl, r, o.metadata.namespace, name) : null;
        const verb = live ? "patching" : "creating";
        if (dc.typeError || dc.unknown.length) {
          const why = dc.typeError ?? `strict decoding error: ${dc.unknown.map((u) => `unknown field ${JSON.stringify(u)}`).join(", ")}`;
          io.err(`Error from server (BadRequest): error when ${verb} ${JSON.stringify(d.file)}: ${o.kind} in version ${JSON.stringify(RES[r].version)} cannot be handled as a ${o.kind}: ${why}\n`);
          code = 1; continue;
        }
        if (!RES[r].cluster && !getObj(cl, "namespaces", null, o.metadata.namespace) && r !== "namespaces") { io.err(`Error from server (NotFound): error when ${verb} ${JSON.stringify(d.file)}: namespaces ${JSON.stringify(o.metadata.namespace)} not found\n`); code = 1; continue; }
        if (!name) { io.err(`error: error when retrieving current configuration of:\nResource: "${RES[r].group ? RES[r].group + "/" : ""}${RES[r].version}, Resource=${r}", GroupVersionKind: "${RES[r].group ? RES[r].group + "/" : ""}${RES[r].version}, Kind=${o.kind}"\nName: "", Namespace: "${o.metadata.namespace ?? ""}"\nfrom server for: ${JSON.stringify(d.file)}: resource name may not be empty\n`); code = 1; continue; }
        const lastApplied = { ...manifest, metadata: { ...manifest.metadata, annotations: { ...(manifest.metadata?.annotations ?? {}) }, ...(RES[r].cluster ? {} : { namespace: o.metadata.namespace }) } };
        const lastText = canon(lastApplied) + "\n";
        if (create) {
          if (live) { io.err(`Error from server (AlreadyExists): error when creating ${JSON.stringify(d.file)}: ${pluralString(r)} ${JSON.stringify(name)} already exists\n`); code = 1; continue; }
          if (dry) { io.out(`${kindString(r)}/${name} created (${dry === "server" ? "server dry run" : "dry run"})\n`); continue; }
          if (a.b("save-config")) o.metadata.annotations = { ...(o.metadata.annotations ?? {}), [LAST]: lastText };
          const res = createObject(cl, r, o, d.file);
          if (res.error) { io.err(res.error + "\n"); code = 1; continue; }
          io.out(`${kindString(r)}/${name} created\n`);
          continue;
        }
        if (!live) {
          if (dry) { io.out(`${kindString(r)}/${name} created (${dry === "server" ? "server dry run" : "dry run"})\n`); continue; }
          o.metadata.annotations = { ...(o.metadata.annotations ?? {}), [LAST]: lastText };
          const res = createObject(cl, r, o, d.file);
          if (res.error) { io.err(res.error + "\n"); code = 1; continue; }
          io.out(`${kindString(r)}/${name} created\n`);
          continue;
        }
        // an existing object: merge, validate, update
        let last = null;
        if (live.metadata.annotations?.[LAST]) { try { last = JSON.parse(live.metadata.annotations[LAST]); } catch { last = null; } }
        else io.err(`Warning: resource ${r}/${name} is missing the ${LAST} annotation which is required by kubectl apply. kubectl apply should only be used on resources created declaratively by either kubectl create --save-config or kubectl apply. The missing annotation will be patched automatically.\n`);
        const res = updateObject(cl, r, live, (cur) => {
          const merged = merge3(cur, last, { ...o, metadata: { ...o.metadata, annotations: { ...(o.metadata.annotations ?? {}), [LAST]: lastText } } });
          merged.metadata = { ...cur.metadata, labels: merged.metadata.labels, annotations: { ...(cur.metadata.annotations ?? {}), ...(merged.metadata.annotations ?? {}) } };
          for (const k of Object.keys(last?.metadata?.annotations ?? {})) if (!(k in (o.metadata.annotations ?? {}))) delete merged.metadata.annotations[k];
          if (!merged.metadata.labels) delete merged.metadata.labels;
          return merged;
        }, { dry });
        if (res.error) { io.err(res.error + "\n"); code = 1; continue; }
        io.out(`${kindString(r)}/${name} ${res.changed ? "configured" : "unchanged"}${dry ? ` (${dry === "server" ? "server dry run" : "dry run"})` : ""}\n`);
      }
    }
    return code;
  }
  // change an object: fn(copy) returns the new version; defaults, validation, generation and the pod rules apply
  function updateObject(cl, r, live, fn, { dry = false } = {}) {
    const cur = clone(live);
    let next = fn(clone(live));
    next.apiVersion = live.apiVersion; next.kind = live.kind;
    next.status = cur.status;
    next.metadata.uid = cur.metadata.uid; next.metadata.creationTimestamp = cur.metadata.creationTimestamp; next.metadata.resourceVersion = cur.metadata.resourceVersion; next.metadata.generation = cur.metadata.generation;
    if (cur.metadata.ownerReferences) next.metadata.ownerReferences = cur.metadata.ownerReferences;
    if (r === "pods") {
      // the API keeps the pod's defaults; only images (and a few other fields) may change
      for (const k of Object.keys(cur.spec)) if (next.spec[k] === undefined) next.spec[k] = cur.spec[k];
      next.spec.containers = next.spec.containers.map((c) => defaultContainer({ ...c, volumeMounts: c.volumeMounts ?? cur.spec.containers.find((x) => x.name === c.name)?.volumeMounts }));
      const strip = (s) => ({ ...s, containers: s.containers.map((c) => ({ ...c, image: "" })) });
      if (!same(strip(next.spec), strip(cur.spec))) return { error: `The Pod ${JSON.stringify(cur.metadata.name)} is invalid: spec: Forbidden: pod updates may not change fields other than \`spec.containers[*].image\`,\`spec.initContainers[*].image\`,\`spec.activeDeadlineSeconds\`,\`spec.tolerations\` (only additions to existing tolerations),\`spec.terminationGracePeriodSeconds\` (allow it to be set to 1 if it was previously negative)` };
    } else {
      defaultObject(cl, r, next);
      if (r === "services") { next.spec.clusterIP ??= cur.spec.clusterIP; if (next.spec.clusterIP !== cur.spec.clusterIP) return { error: `The Service ${JSON.stringify(cur.metadata.name)} is invalid: spec.clusterIPs[0]: Invalid value: []string{${JSON.stringify(next.spec.clusterIP)}}: may not change once set` }; allocServiceIP(cl, next); }
      const v = validate(cl, r, next, cur);
      if (v.errs?.length) return { error: invalidText(RES[r].kind, cur.metadata.name, v.errs) };
    }
    const changed = !same({ ...next, status: undefined, metadata: { ...next.metadata, resourceVersion: "" } }, { ...cur, status: undefined, metadata: { ...cur.metadata, resourceVersion: "" } });
    if (!changed || dry) return { changed, obj: live };
    if (["deployments", "replicasets", "daemonsets", "jobs", "cronjobs", "horizontalpodautoscalers"].includes(r) && !same(next.spec, cur.spec)) next.metadata.generation = (cur.metadata.generation ?? 1) + 1;
    putObj(cl, r, next);
    if (r === "pods") podSpecChanged(cl, next, cur);
    return { changed, obj: next };
  }
  // a pod's image changed: the kubelet restarts that container with the new image
  function podSpecChanged(cl, pod, old) {
    const rt = cl.rt.get(pod.metadata.uid);
    if (!rt) return;
    for (const c of pod.spec.containers) {
      const o = old.spec.containers.find((x) => x.name === c.name);
      if (!o || o.image === c.image) continue;
      const st = stOf(rt, c);
      if (st.dc && st.dc.state === "running") { event(cl, pod, "Normal", "Killing", `Container ${c.name} definition changed, will be restarted`, "kubelet"); D.stopContainer(rt.node.ne, st.dc, 0, { kill: true }); st.restarts++; }
      st.stage = "new"; st.at = 0; st.pullBackoff = 0; st.ready = false;
    }
  }
  function applyMetricsServer(cl, io, create) {
    for (const [k, v] of METRICS_OBJS()) {
      const name = typeof v === "string" ? v : v.metadata.name;
      if (typeof v === "string") { io.out(`${k}/${name} ${cl.extra?.has(k + name) ? "unchanged" : "created"}\n`); (cl.extra ??= new Set()).add(k + name); continue; }
      const r = resolveRes(v.kind);
      const live = getObj(cl, r, "kube-system", name);
      if (live) { io.out(`${k}/${name} unchanged\n`); continue; }
      const o = clone(v);
      o.metadata.annotations = { [LAST]: canon(v) + "\n" };
      createObject(cl, r, o);
      io.out(`${k}/${name} created\n`);
    }
    void create;
    return 0;
  }

  // "deploy/shop", "deployment shop", "pod hello" → [{ r, name }]
  function targets(a, startAt = 0) {
    const p = a.pos.slice(startAt);
    if (!p.length) return { list: [] };
    if (p[0].includes("/")) { const out = []; for (const x of p) { const [w, n] = x.split("/"); const r = resolveRes(w); if (!r) return { error: `the server doesn't have a resource type "${w}"` }; out.push({ r, name: n }); } return { list: out }; }
    const r = resolveRes(p[0]);
    if (!r) return { error: `the server doesn't have a resource type "${p[0]}"` };
    return { r, list: p.slice(1).map((name) => ({ r, name })) };
  }
  async function cmdDelete(sh, cl, a, ns, io) {
    const grace = a.f("grace-period") !== undefined ? Number(a.f("grace-period")) : a.b("force") && a.f("grace-period") === undefined ? null : null;
    const force = a.b("force");
    const g = force && a.f("grace-period") === undefined ? 0 : grace;
    if (force && g === 0) io.err("Warning: Immediate deletion does not wait for confirmation that the running resource has been terminated. The resource may continue to run on the cluster indefinitely.\n");
    const op = g === 0 ? "force deleted" : "deleted";
    let todo = [];
    let code = 0;
    if (a.m("f", "filename").length) {
      for (const f of a.m("f", "filename")) {
        const docs = readManifests(sh, f, io);
        if (!docs) return 1;
        for (const d of docs) {
          if (d.metrics) continue;
          const mp = mapping(d.obj);
          if (mp.error) { io.err(`error: ${mp.error.replace("FILE", JSON.stringify(d.file))}\n`); code = 1; continue; }
          const n2 = RES[mp.r].cluster ? null : d.obj.metadata?.namespace ?? ns;
          const o = getObj(cl, mp.r, n2, d.obj.metadata?.name);
          if (!o) { if (!a.b("ignore-not-found")) { io.err(`Error from server (NotFound): error when deleting ${JSON.stringify(d.file)}: ${pluralString(mp.r)} ${JSON.stringify(d.obj.metadata?.name)} not found\n`); code = 1; } continue; }
          todo.push({ r: mp.r, o });
        }
      }
    } else {
      const tg = targets(a);
      if (tg.error) { io.err(`error: ${tg.error}\n`); return 1; }
      const sel = a.f("l", "selector");
      if (!tg.list.length && !sel && !a.b("all")) {
        if (!a.pos.length) { io.err("error: You must provide one or more resources by argument or filename.\nExample resource specifications include:\n   '-f rsrc.yaml'\n   '--filename=rsrc.json'\n   '<resource> <name>'\n   '<resource>'\n"); return 1; }
        io.err(`error: resource(s) were provided, but no name was specified\n`); return 1;
      }
      if (sel || a.b("all")) {
        const s = sel ? parseSelector(sel) : { reqs: [] };
        for (const o of list(cl, tg.r, RES[tg.r].cluster ? null : ns)) if (matches(o.metadata.labels, s)) todo.push({ r: tg.r, o });
        if (!todo.length) { io.out("No resources found\n"); return 0; }
      } else for (const t of tg.list) {
        const o = getObj(cl, t.r, ns, t.name);
        if (!o) { if (!a.b("ignore-not-found")) { io.err(`Error from server (NotFound): ${pluralString(t.r)} ${JSON.stringify(t.name)} not found\n`); code = 1; } continue; }
        todo.push(t.r === "pods" ? { r: t.r, o } : { r: t.r, o });
      }
    }
    for (const { r, o } of todo) {
      if (r === "namespaces") {
        if (["default", "kube-system", "kube-public", "kube-node-lease"].includes(o.metadata.name)) { io.err(`Error from server (Forbidden): namespaces "${o.metadata.name}" is forbidden: this namespace may not be deleted\n`); code = 1; continue; }
        o.status.phase = "Terminating"; o.metadata.deletionTimestamp = rfc(nowOf(cl)); putObj(cl, "namespaces", o);
      } else if (r === "persistentvolumeclaims" && list(cl, "pods", o.metadata.namespace).some((p) => (p.spec.volumes ?? []).some((v) => v.persistentVolumeClaim?.claimName === o.metadata.name))) {
        o.metadata.deletionTimestamp = rfc(nowOf(cl)); o.metadata.deletionGracePeriodSeconds = 0; putObj(cl, r, o);
      } else if (r === "persistentvolumeclaims") { delObj(cl, r, o); const pv = o.spec.volumeName && getObj(cl, "persistentvolumes", null, o.spec.volumeName); if (pv) { delObj(cl, "persistentvolumes", pv); for (const n of cl.nodes) n.ne.volumes.delete(pv.metadata.name); } }
      else deleteCascade(cl, r, o, g);
      io.out(a.f("o", "output") === "name" ? `${kindString(r)}/${o.metadata.name}\n` : `${kindString(r)} ${JSON.stringify(o.metadata.name)} ${op}${RES[r].cluster ? "" : ` from ${o.metadata.namespace} namespace`}\n`);
    }
    // kubectl delete waits until the objects are really gone (pods finish terminating)
    if (a.f("wait") !== "false") await advance(cl, 120, () => todo.every(({ r, o }) => !getObj(cl, r, o.metadata.namespace, o.metadata.name)));
    return code;
  }

  // kubectl run NAME --image=IMAGE [--port] [--env] [--restart=Never] [--rm -i] [-- COMMAND ARGS]
  async function cmdRun(sh, cl, a, ns, io) {
    const name = a.pos[0];
    const image = a.f("image");
    if (!name) { io.err("error: NAME is required for run\nSee 'kubectl run -h' for help and examples\n"); return 1; }
    if (!image) { io.err("error: required flag(s) \"image\" not set\n"); return 1; }
    const restart = a.f("restart") ?? "Always";
    const labels = a.f("labels") ? Object.fromEntries(a.f("labels").split(",").map((kv) => kv.split("="))) : { run: name };
    const c = { name, image };
    if (a.rest?.length) { if (a.b("command")) { c.command = a.rest; } else c.args = a.rest; }
    if (a.f("port")) c.ports = [{ containerPort: Number(a.f("port")) }];
    if (a.m("env").length) c.env = a.m("env").map((kv) => { const i = kv.indexOf("="); return { name: kv.slice(0, i), value: kv.slice(i + 1) }; });
    if (a.f("image-pull-policy")) c.imagePullPolicy = a.f("image-pull-policy");
    const interactive = a.b("i", "stdin") || a.b("t", "tty") || a.b("attach");
    if (a.b("i", "stdin")) { c.stdin = true; c.stdinOnce = true; }
    if (a.b("t", "tty")) c.tty = true;
    const pod = { apiVersion: "v1", kind: "Pod", metadata: { labels, name, namespace: ns }, spec: { containers: [c], dnsPolicy: "ClusterFirst", restartPolicy: restart } };
    if (a.f("dry-run")) {
      const out = a.f("o", "output");
      const doc = { apiVersion: "v1", kind: "Pod", metadata: { labels, name }, spec: { containers: [{ ...c, resources: {} }], dnsPolicy: "ClusterFirst", restartPolicy: restart }, status: {} };
      if (out === "yaml") io.out(yamlDoc(doc)); else if (out === "json") io.out(jsonDoc(doc)); else io.out(`pod/${name} created (dry run)\n`);
      return 0;
    }
    if (a.b("rm") && !interactive) { io.err("error: --rm should only be used for attached containers\n"); return 1; }
    if (getObj(cl, "pods", ns, name)) { io.err(`Error from server (AlreadyExists): pods ${JSON.stringify(name)} already exists\n`); return 1; }
    const res = createObject(cl, "pods", pod);
    if (res.error) { io.err(res.error + "\n"); return 1; }
    await work(cl);
    if (!interactive) { io.out(`pod/${name} created\n`); return 0; }
    // attached: wait for the container to run, show its output, then (--rm) delete the pod
    const rt = cl.rt.get(pod.metadata.uid);
    const st = () => rt && rt.cs.get(name);
    await advance(cl, 300, () => st() && (st().stage === "running" || st().stage === "done" || st().stage === "backoff" || /BackOff|Error/.test(st().waiting ?? "")));
    if (a.b("t", "tty")) io.err("All commands and output from this session will be recorded in container logs, including credentials and sensitive information passed through the command prompt.\nIf you don't see a command prompt, try pressing enter.\n");
    const s = st();
    if (s?.dc) io.out(s.dc.logs.map(([, txt]) => txt).join(""));
    if (s?.stage === "running") io.err("(The container is still running: an attached kubectl run stays connected until it ends or you press Ctrl+C, and the sandbox can't type into it. Run a command that finishes, like wget, after --.)\n");
    let failed = s?.term && s.term.exitCode !== 0 ? s.term : null;
    if (!s?.dc && s?.waiting) { io.err(`error: timed out waiting for the condition\n`); failed = { reason: s.waiting }; }
    if (a.b("rm")) {
      deleteCascade(cl, "pods", getObj(cl, "pods", ns, name), 0);
      await work(cl);
      io.out(`pod "${name}" deleted from ${ns} namespace\n`);
    }
    if (failed && s?.dc) { io.err(`pod ${ns}/${name} terminated (${failed.reason})\n`); return 1; }
    return failed ? 1 : 0;
  }

  // kubectl create deployment|namespace|configmap|secret|job|cronjob NAME …
  async function cmdCreate(sh, cl, a, ns, io) {
    if (a.m("f", "filename").length) return cmdApplyFiles(sh, cl, a, ns, io, { create: true });
    const what = a.pos[0], name = a.pos[1];
    const dry = a.f("dry-run"), out = a.f("o", "output");
    const emit = (r, doc) => {
      if (dry) {
        if (out === "yaml") io.out(yamlDoc(doc)); else if (out === "json") io.out(jsonDoc(forJson(doc))); else io.out(`${kindString(r)}/${doc.metadata.name} created (${dry === "server" ? "server dry run" : "dry run"})\n`);
        return 0;
      }
      if (!RES[r].cluster && !getObj(cl, "namespaces", null, ns)) { io.err(`error: failed to create ${singular(r)}: namespaces ${JSON.stringify(ns)} not found\n`); return 1; }
      if (getObj(cl, r, ns, doc.metadata.name)) { io.err(`error: failed to create ${singular(r)}: ${pluralString(r)} ${JSON.stringify(doc.metadata.name)} already exists\n`); return 1; }
      const o = clone(doc);
      delete o.status;
      if (!RES[r].cluster) o.metadata.namespace = ns;
      const res = createObject(cl, r, o);
      if (res.error) { io.err(res.error + "\n"); return 1; }
      io.out(`${kindString(r)}/${doc.metadata.name} created\n`);
      return 0;
    };
    const literalPairs = () => {
      const data = {};
      for (const kv of a.m("from-literal")) { const i = kv.indexOf("="); if (i < 1) { io.err(`error: invalid literal source ${kv}, expected key=value\n`); return null; } data[kv.slice(0, i)] = kv.slice(i + 1); }
      for (const spec of a.m("from-file")) { const [k, p] = spec.includes("=") ? spec.split("=") : [spec.split("/").pop(), spec]; const text = sh.fs.text(sh.abs(p)); if (text === null) { io.err(`error: error reading ${p}: no such file or directory\n`); return null; } data[k] = text; }
      for (const p of a.m("from-env-file")) { const text = sh.fs.text(sh.abs(p)); if (text === null) { io.err(`error: open ${p}: no such file or directory\n`); return null; } for (const line of text.split("\n")) { const m = /^\s*([^#=\s][^=]*)=(.*)$/.exec(line); if (m) data[m[1].trim()] = m[2]; } }
      return data;
    };
    if (!what) { io.err("error: must specify one of -f and -k\n\n"); return 1; }
    if (what !== "secret" && !name) { io.err(`error: exactly one NAME is required, got 0\nSee 'kubectl create ${what} -h' for help and examples\n`); return 1; }
    switch (what) {
      case "deployment": case "deploy": {
        const images = a.m("image");
        if (!images.length) { io.err('error: required flag(s) "image" not set\n'); return 1; }
        const labels = { app: name };
        const containers = images.map((img) => ({ ...(a.rest?.length && images.length === 1 ? { command: a.rest } : {}), image: img, name: img.split("@")[0].split("/").pop().replace(/:[^:]*$/, "").replace(/[._]/g, "-"), ...(a.f("port") ? { ports: [{ containerPort: Number(a.f("port")) }] } : {}), resources: {} }));
        return emit("deployments", { apiVersion: "apps/v1", kind: "Deployment", metadata: { labels, name }, spec: { replicas: Number(a.f("replicas") ?? 1), selector: { matchLabels: labels }, strategy: {}, template: { metadata: { labels }, spec: { containers } } }, status: {} });
      }
      case "namespace": case "ns": return emit("namespaces", { apiVersion: "v1", kind: "Namespace", metadata: { name }, spec: {}, status: {} });
      case "configmap": case "cm": { const data = literalPairs(); if (!data) return 1; return emit("configmaps", { apiVersion: "v1", ...(Object.keys(data).length ? { data } : {}), kind: "ConfigMap", metadata: { name } }); }
      case "secret": {
        const sub = a.pos[1], sname = a.pos[2];
        if (sub !== "generic") { io.err(sub === "docker-registry" || sub === "tls" ? `error: the sandbox's kubectl creates generic secrets; write a manifest for a ${sub} secret\n` : "error: must specify one of: docker-registry, generic, tls\n"); return 1; }
        if (!sname) { io.err("error: exactly one NAME is required, got 0\nSee 'kubectl create secret generic -h' for help and examples\n"); return 1; }
        const data = literalPairs(); if (!data) return 1;
        return emit("secrets", { apiVersion: "v1", ...(Object.keys(data).length ? { data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, b64(v)])) } : {}), kind: "Secret", metadata: { name: sname }, ...(a.f("type") ? { type: a.f("type") } : {}) });
      }
      case "job": {
        const from = a.f("from");
        if (from) {
          const [w, n] = from.split("/");
          if (resolveRes(w) !== "cronjobs") { io.err(`error: unknown object type ${w}\n`); return 1; }
          const cj = getObj(cl, "cronjobs", ns, n);
          if (!cj) { io.err(`error: cronjobs.batch ${JSON.stringify(n)} not found\n`); return 1; }
          if (dry) { io.out(`job.batch/${name} created (dry run)\n`); return 0; }
          if (getObj(cl, "jobs", ns, name)) { io.err(`error: failed to create job: jobs.batch ${JSON.stringify(name)} already exists\n`); return 1; }
          makeJob(cl, ns, name, cj.spec.jobTemplate.spec, cj, { "cronjob.kubernetes.io/instantiate": "manual" });
          io.out(`job.batch/${name} created\n`);
          return 0;
        }
        if (!a.f("image")) { io.err("error: either --image or --from must be specified\n"); return 1; }
        return emit("jobs", { apiVersion: "batch/v1", kind: "Job", metadata: { name }, spec: { template: { metadata: {}, spec: { containers: [{ ...(a.rest?.length ? { command: a.rest } : {}), image: a.f("image"), name, resources: {} }], restartPolicy: a.f("restart") ?? "Never" } } }, status: {} });
      }
      case "cronjob": case "cj": {
        if (!a.f("image")) { io.err('error: required flag(s) "image", "schedule" not set\n'.replace(a.f("schedule") ? ', "schedule"' : "", "")); return 1; }
        if (!a.f("schedule")) { io.err('error: required flag(s) "schedule" not set\n'); return 1; }
        return emit("cronjobs", { apiVersion: "batch/v1", kind: "CronJob", metadata: { name }, spec: { jobTemplate: { metadata: { name }, spec: { template: { metadata: {}, spec: { containers: [{ ...(a.rest?.length ? { command: a.rest } : {}), image: a.f("image"), name, resources: {} }], restartPolicy: a.f("restart") ?? "OnFailure" } } } }, schedule: a.f("schedule") }, status: {} });
      }
      case "service": case "svc": io.err("error: the sandbox's kubectl creates services with kubectl expose or a manifest\n"); return 1;
      default: io.err(`error: unknown command "${what}" for "kubectl create"\n`); return 1;
    }
  }

  function oneTarget(cl, a, ns, io, start = 0) {
    const tg = targets(a, start);
    if (tg.error) { io.err(`error: ${tg.error}\n`); return null; }
    if (!tg.list.length) { io.err("error: required resource not specified\n"); return null; }
    const t0 = tg.list[0];
    const o = getObj(cl, t0.r, ns, t0.name);
    if (!o) { io.err(`Error from server (NotFound): ${pluralString(t0.r)} ${JSON.stringify(t0.name)} not found\n`); return null; }
    return { r: t0.r, o };
  }
  async function cmdExpose(sh, cl, a, ns, io) {
    const x = oneTarget(cl, a, ns, io);
    if (!x) return 1;
    const { r, o } = x;
    const selector = r === "pods" ? { ...o.metadata.labels } : r === "services" ? { ...o.spec.selector } : { ...(o.spec.selector?.matchLabels ?? {}) };
    const cport = (r === "pods" ? o.spec : o.spec.template?.spec)?.containers?.flatMap((c) => c.ports ?? [])[0]?.containerPort;
    const port = a.f("port") !== undefined ? Number(a.f("port")) : cport;
    if (!port) { io.err("error: couldn't find port via --port flag or introspection\nSee 'kubectl expose -h' for help and examples\n"); return 1; }
    const tp = a.f("target-port");
    const name = a.f("name") ?? o.metadata.name;
    const svc = { apiVersion: "v1", kind: "Service", metadata: { ...(o.metadata.labels ? { labels: { ...o.metadata.labels } } : {}), name }, spec: { ports: [{ port, protocol: a.f("protocol") ?? "TCP", targetPort: tp !== undefined ? (/^\d+$/.test(tp) ? Number(tp) : tp) : port }], selector, ...(a.f("type") ? { type: a.f("type") } : {}) }, status: { loadBalancer: {} } };
    if (a.f("dry-run")) { const out = a.f("o", "output"); if (out === "yaml") io.out(yamlDoc(svc)); else io.out(`service/${name} exposed (dry run)\n`); return 0; }
    if (getObj(cl, "services", ns, name)) { io.err(`Error from server (AlreadyExists): services ${JSON.stringify(name)} already exists\n`); return 1; }
    const o2 = clone(svc); delete o2.status; o2.metadata.namespace = ns;
    const res = createObject(cl, "services", o2);
    if (res.error) { io.err(res.error + "\n"); return 1; }
    io.out(`service/${name} exposed\n`);
    return 0;
  }
  async function cmdScale(sh, cl, a, ns, io) {
    if (a.f("replicas") === undefined) { io.err('error: required flag(s) "replicas" not set\n'); return 1; }
    const x = oneTarget(cl, a, ns, io);
    if (!x) return 1;
    if (!["deployments", "replicasets", "statefulsets"].includes(x.r)) { io.err(`error: no scaler has been implemented for {"${RES[x.r].group}" "${RES[x.r].kind}"}\n`); return 1; }
    const n = Number(a.f("replicas"));
    if (!Number.isInteger(n) || n < 0) { io.err("error: The --replicas=COUNT flag is required, and COUNT must be greater than or equal to 0\n"); return 1; }
    updateObject(cl, x.r, x.o, (o) => { o.spec.replicas = n; return o; });
    io.out(`${kindString(x.r)}/${x.o.metadata.name} scaled\n`);
    return 0;
  }
  const podSpecOf = (r, o) => (r === "pods" ? o.spec : r === "cronjobs" ? o.spec.jobTemplate.spec.template.spec : o.spec.template.spec);
  async function cmdSet(sh, cl, a, ns, io) {
    const what = a.pos[0];
    if (what === "image") {
      const tg = targets({ ...a, pos: a.pos.slice(1).filter((p) => !p.includes("=") || p.includes("/") && !/=/.test(p)) });
      const pairs = a.pos.slice(1).filter((p) => /=/.test(p) && !/^[a-z]+\/[^=]*$/.test(p));
      if (tg.error) { io.err(`error: ${tg.error}\n`); return 1; }
      if (!pairs.length) { io.err("error: at least one image update is required\n"); return 1; }
      let code = 0;
      for (const t of tg.list) {
        const o = getObj(cl, t.r, ns, t.name);
        if (!o) { io.err(`Error from server (NotFound): ${pluralString(t.r)} ${JSON.stringify(t.name)} not found\n`); code = 1; continue; }
        const spec = podSpecOf(t.r, o);
        for (const p of pairs) { const [cn] = p.split("="); if (cn !== "*" && !spec.containers.some((c) => c.name === cn)) { io.err(`error: unable to find container named ${JSON.stringify(cn)}\n`); return 1; } }
        const res = updateObject(cl, t.r, o, (cur) => { for (const p of pairs) { const i = p.indexOf("="); const cn = p.slice(0, i), img = p.slice(i + 1); for (const c of podSpecOf(t.r, cur).containers) if (cn === "*" || c.name === cn) { c.image = img; delete c.imagePullPolicy; } } return cur; });
        if (res.error) { io.err(res.error + "\n"); code = 1; continue; }
        if (res.changed) io.out(`${kindString(t.r)}/${t.name} image updated\n`);
      }
      return code;
    }
    if (what === "env") {
      const tg = targets({ ...a, pos: a.pos.slice(1).filter((p) => !/=|-$/.test(p) || p.includes("/")) });
      const pairs = a.pos.slice(1).filter((p) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(p) || /^[A-Za-z_][A-Za-z0-9_]*-$/.test(p));
      if (tg.error || !tg.list.length) { io.err(`error: ${tg.error ?? "one or more resources must be specified as <resource> <name> or <resource>/<name>"}\n`); return 1; }
      for (const t of tg.list) {
        const o = getObj(cl, t.r, ns, t.name);
        if (!o) { io.err(`Error from server (NotFound): ${pluralString(t.r)} ${JSON.stringify(t.name)} not found\n`); return 1; }
        const res = updateObject(cl, t.r, o, (cur) => {
          for (const c of podSpecOf(t.r, cur).containers) {
            let env = c.env ?? [];
            for (const p of pairs) { if (p.endsWith("-")) env = env.filter((e) => e.name !== p.slice(0, -1)); else { const i = p.indexOf("="); const k = p.slice(0, i), v = p.slice(i + 1); const ex = env.find((e) => e.name === k); if (ex) { ex.value = v; delete ex.valueFrom; } else env.push({ name: k, value: v }); } }
            if (env.length) c.env = env; else delete c.env;
          }
          return cur;
        });
        if (res.error) { io.err(res.error + "\n"); return 1; }
        if (res.changed) io.out(`${kindString(t.r)}/${t.name} env updated\n`);
      }
      return 0;
    }
    if (what === "resources") {
      const tg = targets({ ...a, pos: a.pos.slice(1) });
      if (tg.error || !tg.list.length) { io.err(`error: ${tg.error ?? "one or more resources must be specified"}\n`); return 1; }
      const parse = (s) => Object.fromEntries((s ?? "").split(",").filter(Boolean).map((kv) => kv.split("=")));
      for (const t of tg.list) {
        const o = getObj(cl, t.r, ns, t.name);
        if (!o) { io.err(`Error from server (NotFound): ${pluralString(t.r)} ${JSON.stringify(t.name)} not found\n`); return 1; }
        const res = updateObject(cl, t.r, o, (cur) => { for (const c of podSpecOf(t.r, cur).containers) { c.resources ??= {}; if (a.f("limits")) c.resources.limits = { ...(c.resources.limits ?? {}), ...parse(a.f("limits")) }; if (a.f("requests")) c.resources.requests = { ...(c.resources.requests ?? {}), ...parse(a.f("requests")) }; } return cur; });
        if (res.error) { io.err(res.error + "\n"); return 1; }
        if (res.changed) io.out(`${kindString(t.r)}/${t.name} resource requirements updated\n`);
      }
      return 0;
    }
    io.err(`error: unknown command "${what ?? ""}" for "kubectl set"\n`);
    return 1;
  }

  // kubectl rollout status|history|undo|restart|pause|resume
  function rolloutMessage(d) {
    const s = d.status ?? {};
    const name = d.metadata.name;
    if ((d.metadata.generation ?? 1) > (s.observedGeneration ?? 0)) return { msg: "Waiting for deployment spec update to be observed...\n" };
    const prog = (s.conditions ?? []).find((c) => c.type === "Progressing");
    if (prog?.reason === "ProgressDeadlineExceeded") return { error: `error: deployment ${JSON.stringify(name)} exceeded its progress deadline\n` };
    const want = d.spec.replicas;
    if ((s.updatedReplicas ?? 0) < want) return { msg: `Waiting for deployment ${JSON.stringify(name)} rollout to finish: ${s.updatedReplicas ?? 0} out of ${want} new replicas have been updated...\n` };
    if ((s.replicas ?? 0) > (s.updatedReplicas ?? 0)) return { msg: `Waiting for deployment ${JSON.stringify(name)} rollout to finish: ${(s.replicas ?? 0) - (s.updatedReplicas ?? 0)} old replicas are pending termination...\n` };
    if ((s.availableReplicas ?? 0) < (s.updatedReplicas ?? 0)) return { msg: `Waiting for deployment ${JSON.stringify(name)} rollout to finish: ${s.availableReplicas ?? 0} of ${s.updatedReplicas ?? 0} updated replicas are available...\n` };
    return { done: `deployment ${JSON.stringify(name)} successfully rolled out\n` };
  }
  async function cmdRollout(sh, cl, a, ns, io) {
    const sub = a.pos[0];
    const x = oneTarget(cl, a, ns, io, 1);
    if (!x) return 1;
    const { r, o } = x;
    if (r !== "deployments") { io.err(`error: no ${sub === "status" ? "status viewer" : sub === "history" ? "history viewer" : "rollbacker"} has been implemented for {"${RES[r].group}" "${RES[r].kind}"}\n`); return 1; }
    const name = o.metadata.name;
    const rss = () => list(cl, "replicasets", ns).filter((rs) => ownedBy(rs, getObj(cl, "deployments", ns, name)));
    switch (sub) {
      case "status": {
        let last = null;
        const limit = Number((a.f("timeout") ?? "0").replace(/s$/, "").replace(/m$/, "") || 0) * (/m$/.test(a.f("timeout") ?? "") ? 60 : 1) || 700;
        for (let i = 0; i <= limit; i++) {
          const d = getObj(cl, "deployments", ns, name);
          if (!d) { io.err(`error: deployments.apps ${JSON.stringify(name)} not found\n`); return 1; }
          const m = rolloutMessage(d);
          if (m.error) { io.err(m.error); return 1; }
          if (m.done) { io.out(m.done); return 0; }
          if (m.msg !== last) { io.out(m.msg); last = m.msg; }
          if (a.f("watch") === "false" || a.f("w") === "false") return 0;
          D.tick(cl.e, 1);
          await work(cl);
        }
        io.err("error: timed out waiting for the condition\n");
        return 1;
      }
      case "history": {
        const list2 = rss().sort((x1, x2) => revisionOf(x1) - revisionOf(x2));
        if (a.f("revision")) {
          const rs = list2.find((x1) => revisionOf(x1) === Number(a.f("revision")));
          if (!rs) { io.err(`error: unable to find the specified revision\n`); return 1; }
          io.out(`deployment.apps/${name} with revision #${a.f("revision")}\n` + describeText(templateText(rs.spec.template, "")) + "\n");
          return 0;
        }
        const rows = ["REVISION\tCHANGE-CAUSE"];
        for (const rs of list2) rows.push(`${revisionOf(rs)}\t${rs.metadata.annotations?.["kubernetes.io/change-cause"] ?? "<none>"}`);
        io.out(`deployment.apps/${name} \n` + tabwrite(rows.join("\n"), { padding: 2, minwidth: 0 }) + "\n\n");
        return 0;
      }
      case "undo": {
        const list2 = rss().sort((x1, x2) => revisionOf(x2) - revisionOf(x1));
        const to = a.f("to-revision") !== undefined ? Number(a.f("to-revision")) : 0;
        const cur = list2[0];
        const target = to ? list2.find((x1) => revisionOf(x1) === to) : list2[1];
        if (!target) { io.err(to ? `error: unable to find specified revision ${to} in history\n` : `error: no rollout history found for deployment ${JSON.stringify(name)}\n`); return 1; }
        if (target === cur) { io.out(`deployment.apps/${name} skipped rollback (current template already matches revision ${revisionOf(target)})\n`); return 0; }
        updateObject(cl, "deployments", o, (d) => { d.spec.template = stripHash(target.spec.template); if (d.spec.template.metadata && !Object.keys(d.spec.template.metadata).length) d.spec.template.metadata = {}; return d; });
        event(cl, getObj(cl, "deployments", ns, name), "Normal", "DeploymentRollback", `Rolled back deployment "${name}" to revision ${revisionOf(target)}`, "deployment-controller");
        io.out(`deployment.apps/${name} rolled back\n`);
        return 0;
      }
      case "restart": {
        updateObject(cl, "deployments", o, (d) => { d.spec.template.metadata = { ...(d.spec.template.metadata ?? {}), annotations: { ...(d.spec.template.metadata?.annotations ?? {}), "kubectl.kubernetes.io/restartedAt": new Date(nowOf(cl) * 1000).toISOString().replace(/\.\d{3}Z$/, "Z") } }; return d; });
        io.out(`deployment.apps/${name} restarted\n`);
        return 0;
      }
      case "pause": case "resume": {
        const want = sub === "pause";
        if (!!o.spec.paused === want) { io.err(`error: deployments.apps ${JSON.stringify(name)} is ${want ? "already paused" : "not paused"}\n`); return 1; }
        updateObject(cl, "deployments", o, (d) => { if (want) d.spec.paused = true; else delete d.spec.paused; return d; });
        io.out(`deployment.apps/${name} ${want ? "paused" : "resumed"}\n`);
        return 0;
      }
      default: io.err(`error: unknown command "${sub ?? ""}" for "kubectl rollout"\n`); return 1;
    }
  }
  async function cmdAutoscale(sh, cl, a, ns, io) {
    const x = oneTarget(cl, a, ns, io);
    if (!x) return 1;
    if (!["deployments", "replicasets", "statefulsets"].includes(x.r)) { io.err(`error: cannot autoscale a ${RES[x.r].kind}: cannot autoscale a ${RES[x.r].kind}\n`); return 1; }
    const max = Number(a.f("max") ?? 0);
    if (max < 1) { io.err(`error: --max=MAXPODS is required and must be at least 1, max replicas: ${max}\n`); return 1; }
    let cpu = a.f("cpu");
    if (a.f("cpu-percent") !== undefined) { io.err("Flag --cpu-percent has been deprecated, Use --cpu with percentage or resource quantity format (e.g., '70%' for utilization or '500m' for milliCPU).\n"); cpu = cpu ?? `${a.f("cpu-percent")}%`; }
    const min = a.f("min") !== undefined ? Number(a.f("min")) : undefined;
    const metrics = [];
    if (cpu) metrics.push(/%$/.test(cpu) ? { resource: { name: "cpu", target: { averageUtilization: Number(cpu.slice(0, -1)), type: "Utilization" } }, type: "Resource" } : { resource: { name: "cpu", target: { averageValue: /m$/.test(cpu) ? cpu : `${cpu}m`, type: "AverageValue" } }, type: "Resource" });
    const mem = a.f("memory");
    if (mem) metrics.push(/%$/.test(mem) ? { resource: { name: "memory", target: { averageUtilization: Number(mem.slice(0, -1)), type: "Utilization" } }, type: "Resource" } : { resource: { name: "memory", target: { averageValue: /i$/.test(mem) ? mem : `${mem}Mi`, type: "AverageValue" } }, type: "Resource" });
    if (!metrics.length) metrics.push({ resource: { name: "cpu", target: { averageUtilization: 80, type: "Utilization" } }, type: "Resource" });
    const name = a.f("name") ?? x.o.metadata.name;
    const hpa = { apiVersion: "autoscaling/v2", kind: "HorizontalPodAutoscaler", metadata: { name, namespace: ns }, spec: { maxReplicas: max, metrics, ...(min !== undefined ? { minReplicas: min } : {}), scaleTargetRef: { apiVersion: apiVersionOf(x.r), kind: RES[x.r].kind, name: x.o.metadata.name } } };
    if (a.f("dry-run")) { if (a.f("o", "output") === "yaml") io.out(yamlDoc({ ...hpa, metadata: { name }, status: { currentMetrics: null, desiredReplicas: 0 } })); else io.out(`horizontalpodautoscaler.autoscaling/${name} autoscaled (dry run)\n`); return 0; }
    if (getObj(cl, "horizontalpodautoscalers", ns, name)) { io.err(`Error from server (AlreadyExists): horizontalpodautoscalers.autoscaling ${JSON.stringify(name)} already exists\n`); return 1; }
    const res = createObject(cl, "horizontalpodautoscalers", hpa);
    if (res.error) { io.err(res.error + "\n"); return 1; }
    io.out(`horizontalpodautoscaler.autoscaling/${name} autoscaled\n`);
    return 0;
  }

  // kubectl patch: strategic merge (lists of containers merge by name), JSON merge, or JSON patch
  function strategic(live, patch) {
    if (Array.isArray(patch)) {
      if (Array.isArray(live) && patch.every((x) => x && typeof x === "object" && "name" in x) && live.every((x) => x && typeof x === "object" && "name" in x)) {
        const out = clone(live);
        for (const p of patch) { const i = out.findIndex((x) => x.name === p.name); if (i >= 0) out[i] = strategic(out[i], p); else out.push(clone(p)); }
        return out;
      }
      return clone(patch);
    }
    if (patch === null) return undefined;
    if (typeof patch !== "object") return patch;
    const out = live && typeof live === "object" && !Array.isArray(live) ? clone(live) : {};
    for (const [k, v] of Object.entries(patch)) { const m = strategic(out[k], v); if (m === undefined) delete out[k]; else out[k] = m; }
    return out;
  }
  function jsonPatch(doc, ops) {
    const d = clone(doc);
    for (const op of ops) {
      const parts = String(op.path).split("/").slice(1).map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
      let cur = d;
      for (let i = 0; i < parts.length - 1; i++) { cur = Array.isArray(cur) ? cur[Number(parts[i])] : cur?.[parts[i]]; if (cur === undefined) return { error: `jsonpatch ${op.op} operation does not apply: doc is missing path: ${op.path}` }; }
      const last = parts[parts.length - 1];
      if (op.op === "add") { if (Array.isArray(cur)) { if (last === "-") cur.push(op.value); else cur.splice(Number(last), 0, op.value); } else cur[last] = op.value; }
      else if (op.op === "replace") { if (!(Array.isArray(cur) ? Number(last) < cur.length : last in cur)) return { error: `jsonpatch replace operation does not apply: doc is missing key: ${op.path}` }; cur[last] = op.value; }
      else if (op.op === "remove") { if (Array.isArray(cur)) cur.splice(Number(last), 1); else delete cur[last]; }
      else return { error: `Unexpected kind: ${op.op}` };
    }
    return { doc: d };
  }
  async function cmdPatch(sh, cl, a, ns, io) {
    const x = oneTarget(cl, a, ns, io);
    if (!x) return 1;
    const text = a.f("patch");
    if (!text) { io.err("error: must specify -p to patch\n"); return 1; }
    let p;
    try { p = JSON.parse(text); } catch { try { p = parseDocument(text).toJS(); } catch { p = undefined; } }
    if (p === undefined) { io.err(`error: unable to parse "${text}": yaml: did not find expected node content\n`); return 1; }
    const type = a.f("type") ?? "strategic";
    let err = null;
    const res = updateObject(cl, x.r, x.o, (cur) => {
      if (type === "json") { const j = jsonPatch(cur, Array.isArray(p) ? p : []); if (j.error) { err = j.error; return cur; } return j.doc; }
      return type === "merge" ? merge3(cur, null, p) : strategic(cur, p);
    });
    if (err) { io.err(`The request is invalid: the server rejected our request due to an error in our request\n`); io.err(`error: ${err}\n`); return 1; }
    if (res.error) { io.err(res.error + "\n"); return 1; }
    io.out(`${kindString(x.r)}/${x.o.metadata.name} ${res.changed ? "patched" : "patched (no change)"}\n`);
    return 0;
  }
  async function cmdLabel(sh, cl, a, ns, io, field = "labels") {
    const changes = a.pos.filter((p) => p.includes("=") || p.endsWith("-"));
    const rest = a.pos.filter((p) => !changes.includes(p));
    const tg = targets({ ...a, pos: rest });
    if (tg.error || !tg.list.length) { io.err(`error: ${tg.error ?? "one or more resources must be specified as <resource> <name> or <resource>/<name>"}\n`); return 1; }
    for (const t of tg.list) {
      const o = getObj(cl, t.r, ns, t.name);
      if (!o) { io.err(`Error from server (NotFound): ${pluralString(t.r)} ${JSON.stringify(t.name)} not found\n`); return 1; }
      for (const c of changes) { if (c.endsWith("-")) continue; const [k, v] = c.split("="); if (o.metadata[field]?.[k] !== undefined && o.metadata[field][k] !== v && !a.b("overwrite")) { io.err(`error: '${k}' already has a value (${o.metadata[field][k]}), and --overwrite is false\n`); return 1; } }
      const res = updateObject(cl, t.r, o, (cur) => { cur.metadata[field] = { ...(cur.metadata[field] ?? {}) }; for (const c of changes) { if (c.endsWith("-")) delete cur.metadata[field][c.slice(0, -1)]; else { const i = c.indexOf("="); cur.metadata[field][c.slice(0, i)] = c.slice(i + 1); } } if (!Object.keys(cur.metadata[field]).length) delete cur.metadata[field]; return cur; });
      if (res.error) { io.err(res.error + "\n"); return 1; }
      const verb = field === "labels" ? (changes.every((c) => c.endsWith("-")) ? "unlabeled" : "labeled") : "annotated";
      io.out(`${kindString(t.r)}/${t.name} ${res.changed ? verb : "not " + verb}\n`);
    }
    return 0;
  }

  /* ------------------------------------------------------------ kubectl describe */

  function multiline(label, m, indent = "", { skipLast = false, sep = "=" } = {}) {
    const keys = Object.keys(m ?? {}).filter((k) => !(skipLast && k === LAST)).sort();
    if (!keys.length) return `${indent}${label}:\t<none>\n`;
    return keys.map((k, i) => `${i ? indent + "\t" : `${indent}${label}:\t`}${k}${sep}${sep === ": " ? m[k] : m[k]}\n`).join("");
  }
  const probeText = (p) => {
    const tail = `delay=${p.initialDelaySeconds ?? 0}s timeout=${p.timeoutSeconds ?? 1}s period=${p.periodSeconds ?? 10}s #success=${p.successThreshold ?? 1} #failure=${p.failureThreshold ?? 3}`;
    if (p.httpGet) return `http-get ${(p.httpGet.scheme ?? "HTTP").toLowerCase()}://${p.httpGet.host ?? ""}:${p.httpGet.port}${p.httpGet.path ?? "/"} ${tail}`;
    if (p.tcpSocket) return `tcp-socket ${p.tcpSocket.host ?? ""}:${p.tcpSocket.port} ${tail}`;
    if (p.exec) return `exec [${(p.exec.command ?? []).join(" ")}] ${tail}`;
    return tail;
  };
  function envText(c, pad) {
    let s = "";
    if ((c.envFrom ?? []).length) s += `${pad}Environment Variables from:\n` + c.envFrom.map((ef) => `${pad}  ${(ef.configMapRef ?? ef.secretRef).name}\t${ef.configMapRef ? "ConfigMap" : "Secret"}\tOptional: ${!!(ef.configMapRef ?? ef.secretRef).optional}\n`).join("");
    if (!(c.env ?? []).length) return s + `${pad}Environment:\t<none>\n`;
    s += `${pad}Environment:\n`;
    for (const e of c.env) {
      const vf = e.valueFrom;
      if (!vf) s += `${pad}  ${e.name}:\t${e.value ?? ""}\n`;
      else if (vf.configMapKeyRef) s += `${pad}  ${e.name}:\t<set to the key '${vf.configMapKeyRef.key}' of config map '${vf.configMapKeyRef.name}'>\tOptional: ${!!vf.configMapKeyRef.optional}\n`;
      else if (vf.secretKeyRef) s += `${pad}  ${e.name}:\t<set to the key '${vf.secretKeyRef.key}' in secret '${vf.secretKeyRef.name}'>\tOptional: ${!!vf.secretKeyRef.optional}\n`;
      else if (vf.fieldRef) s += `${pad}  ${e.name}:\t (${vf.fieldRef.apiVersion ?? "v1"}:${vf.fieldRef.fieldPath})\n`;
      else if (vf.resourceFieldRef) s += `${pad}  ${e.name}:\t${vf.resourceFieldRef.resource}\n`;
    }
    return s;
  }
  const resText = (c, pad) => ["limits", "requests"].map((k) => (Object.keys(c.resources?.[k] ?? {}).length ? `${pad}${k === "limits" ? "Limits" : "Requests"}:\n` + Object.keys(c.resources[k]).sort().map((r) => `${pad}  ${r}:\t${c.resources[k][r]}\n`).join("") : "")).join("");
  const portText = (c) => { const ps = c.ports ?? []; if (!ps.length) return ["Port:\t<none>", "Host Port:\t<none>"]; const one = ps.map((p) => `${p.containerPort}/${p.protocol ?? "TCP"}${p.name ? ` (${p.name})` : ""}`).join(", "); const hp = ps.map((p) => `${p.hostPort ?? 0}/${p.protocol ?? "TCP"}${p.name ? ` (${p.name})` : ""}`).join(", "); return ps.length > 1 ? [`Ports:\t${one}`, `Host Ports:\t${hp}`] : [`Port:\t${one}`, `Host Port:\t${hp}`]; };
  function volumesText(vols, pad) {
    if (!(vols ?? []).length) return `${pad}Volumes:\t<none>\n`;
    let s = `${pad}Volumes:\n`;
    for (const v of vols) {
      s += `${pad}  ${v.name}:\n`;
      const p = pad + "    ";
      if (v.projected) s += `${p}Type:\tProjected (a volume that contains injected data from multiple sources)\n${p}TokenExpirationSeconds:\t3607\n${p}ConfigMapName:\tkube-root-ca.crt\n${p}Optional:\tfalse\n${p}DownwardAPI:\ttrue\n`;
      else if (v.configMap) s += `${p}Type:\tConfigMap (a volume populated by a ConfigMap)\n${p}Name:\t${v.configMap.name}\n${p}Optional:\t${!!v.configMap.optional}\n`;
      else if (v.secret) s += `${p}Type:\tSecret (a volume populated by a Secret)\n${p}SecretName:\t${v.secret.secretName}\n${p}Optional:\t${!!v.secret.optional}\n`;
      else if (v.emptyDir) s += `${p}Type:\tEmptyDir (a temporary directory that shares a pod's lifetime)\n${p}Medium:\t${v.emptyDir.medium ?? ""}\n${p}SizeLimit:\t${v.emptyDir.sizeLimit ?? "<unset>"}\n`;
      else if (v.persistentVolumeClaim) s += `${p}Type:\tPersistentVolumeClaim (a reference to a PersistentVolumeClaim in the same namespace)\n${p}ClaimName:\t${v.persistentVolumeClaim.claimName}\n${p}ReadOnly:\t${!!v.persistentVolumeClaim.readOnly}\n`;
      else if (v.hostPath) s += `${p}Type:\tHostPath (bare host directory volume)\n${p}Path:\t${v.hostPath.path}\n${p}HostPathType:\t${v.hostPath.type ?? ""}\n`;
    }
    return s;
  }
  // a pod template (deployments, replica sets, rollout history --revision)
  function templateText(tpl, pad = "  ") {
    let s = multiline("Labels", tpl.metadata?.labels, pad);
    if (Object.keys(tpl.metadata?.annotations ?? {}).length) s += multiline("Annotations", tpl.metadata.annotations, pad, { sep: ": " });
    if (tpl.spec.serviceAccountName) s += `${pad}Service Account:\t${tpl.spec.serviceAccountName}\n`;
    s += `${pad}Containers:\n`;
    for (const c of tpl.spec.containers) {
      const p = pad + "  ";
      s += `${pad} ${c.name}:\n${p}Image:\t${c.image}\n${portText(c).map((l) => p + l + "\n").join("")}`;
      if (c.command) s += `${p}Command:\n` + c.command.map((x) => `${p}  ${x}\n`).join("");
      if (c.args) s += `${p}Args:\n` + c.args.map((x) => `${p}  ${x}\n`).join("");
      s += resText(c, p);
      for (const [k, lbl] of [["livenessProbe", "Liveness"], ["readinessProbe", "Readiness"], ["startupProbe", "Startup"]]) if (c[k]) s += `${p}${lbl}:\t${probeText(c[k])}\n`;
      s += envText(c, p);
      const mounts = (c.volumeMounts ?? []);
      s += mounts.length ? `${p}Mounts:\n` + mounts.map((m) => `${p}  ${m.mountPath} from ${m.name} (${m.readOnly ? "ro" : "rw"})\n`).join("") : `${p}Mounts:\t<none>\n`;
    }
    s += volumesText(tpl.spec.volumes, pad);
    s += multiline("Node-Selectors", tpl.spec.nodeSelector, pad);
    s += `${pad}Tolerations:\t${(tpl.spec.tolerations ?? []).length ? tpl.spec.tolerations.map((x) => `${x.key}${x.operator === "Exists" ? "" : "=" + (x.value ?? "")}:${x.effect ?? ""}`).join("\n" + pad + "\t") : "<none>"}\n`;
    return s;
  }
  function eventsText(cl, obj, t) {
    const evs = eventsOf(cl, obj);
    if (!evs.length) return "Events:\t<none>\n";
    let s = "Events:\n  Type\tReason\tAge\tFrom\tMessage\n  ----\t------\t----\t----\t-------\n";
    for (const ev of evs) s += `  ${ev.type}\t${ev.reason}\t${ev.count > 1 ? `${age(t - ev.last)} (x${ev.count} over ${age(t - ev.first)})` : age(t - ev.last)}\t${ev.source}\t${ev.message}\n`;
    return s;
  }
  const condTable = (conds, cols) => `Conditions:\n  ${cols.join("\t")}\n  ${cols.map((c) => "-".repeat(c.length)).join("\t")}\n` + conds.map((c) => `  ${cols.map((k) => (k === "Type" ? c.type : k === "Status" ? c.status : k === "Reason" ? c.reason ?? "" : k === "Message" ? c.message ?? "" : "")).join("\t")}${cols.length === 2 ? " \t" : ""}\n`).join("");
  function describePod(cl, p, t) {
    const rt = cl.rt.get(p.metadata.uid);
    let s = `Name:\t${p.metadata.name}\nNamespace:\t${p.metadata.namespace}\nPriority:\t${p.spec.priority ?? 0}\n`;
    if (p.spec.priorityClassName) s += `Priority Class Name:\t${p.spec.priorityClassName}\n`;
    s += `Service Account:\t${p.spec.serviceAccountName ?? "default"}\n`;
    s += `Node:\t${p.spec.nodeName ? `${p.spec.nodeName}/${p.status.hostIP ?? ""}` : "<none>"}\n`;
    if (p.status.startTime) s += `Start Time:\t${longTime(Date.parse(p.status.startTime) / 1000)}\n`;
    s += multiline("Labels", p.metadata.labels) + multiline("Annotations", p.metadata.annotations, "", { skipLast: true, sep: ": " });
    s += p.metadata.deletionTimestamp ? `Status:\tTerminating (lasts ${age(Date.parse(p.metadata.deletionTimestamp) / 1000 - t + (p.metadata.deletionGracePeriodSeconds ?? 30) - (p.metadata.deletionGracePeriodSeconds ?? 30))})\nTermination Grace Period:\t${p.metadata.deletionGracePeriodSeconds}s\n` : `Status:\t${p.status.phase}\n`;
    s += `IP:\t${p.status.podIP ?? ""}\n`;
    s += p.status.podIP ? `IPs:\n  IP:\t${p.status.podIP}\n` : "IPs:\t<none>\n";
    const owner = (p.metadata.ownerReferences ?? []).find((x) => x.controller);
    if (owner) s += `Controlled By:\t${owner.kind}/${owner.name}\n`;
    s += "Containers:\n";
    for (const c of p.spec.containers) {
      const cs = (p.status.containerStatuses ?? []).find((x) => x.name === c.name);
      const pad = "    ";
      s += `  ${c.name}:\n`;
      if (cs?.containerID) s += `${pad}Container ID:\t${cs.containerID}\n`;
      s += `${pad}Image:\t${c.image}\n`;
      if (cs) s += `${pad}Image ID:\t${cs.imageID ?? ""}\n`;
      s += portText(c).map((l) => pad + l + "\n").join("");
      if (c.command) s += `${pad}Command:\n` + c.command.map((x) => `${pad}  ${x}\n`).join("");
      if (c.args) s += `${pad}Args:\n` + c.args.map((x) => `${pad}  ${x}\n`).join("");
      const state = (st, label) => {
        if (st.running) return `${pad}${label}:\tRunning\n${pad}  Started:\t${longTime(Date.parse(st.running.startedAt) / 1000)}\n`;
        if (st.waiting) return `${pad}${label}:\tWaiting\n${pad}  Reason:\t${st.waiting.reason}\n`;
        if (st.terminated) return `${pad}${label}:\tTerminated\n${pad}  Reason:\t${st.terminated.reason}\n${st.terminated.message ? `${pad}  Message:\t${st.terminated.message}\n` : ""}${pad}  Exit Code:\t${st.terminated.exitCode}\n${pad}  Started:\t${longTime(Date.parse(st.terminated.startedAt) / 1000)}\n${pad}  Finished:\t${longTime(Date.parse(st.terminated.finishedAt) / 1000)}\n`;
        return "";
      };
      if (cs) {
        s += state(cs.state, "State");
        if (cs.lastState?.terminated) s += state(cs.lastState, "Last State");
        s += `${pad}Ready:\t${cs.ready ? "True" : "False"}\n${pad}Restart Count:\t${cs.restartCount}\n`;
      }
      s += resText(c, pad);
      for (const [k, lbl] of [["livenessProbe", "Liveness"], ["readinessProbe", "Readiness"], ["startupProbe", "Startup"]]) if (c[k]) s += `${pad}${lbl}:\t${probeText(c[k])}\n`;
      s += envText(c, pad);
      const mounts = c.volumeMounts ?? [];
      s += mounts.length ? `${pad}Mounts:\n` + mounts.map((m) => `${pad}  ${m.mountPath} from ${m.name} (${m.readOnly ? "ro" : "rw"})\n`).join("") : `${pad}Mounts:\t<none>\n`;
    }
    if ((p.status.conditions ?? []).length) s += "Conditions:\n  Type\tStatus\n" + p.status.conditions.map((c) => `  ${c.type} \t${c.status} \n`).join("");
    s += volumesText(p.spec.volumes, "");
    s += `QoS Class:\t${p.status.qosClass ?? "BestEffort"}\n`;
    s += multiline("Node-Selectors", p.spec.nodeSelector);
    const tol = (p.spec.tolerations ?? []).map((x) => `${x.key ?? ""}${x.operator === "Exists" ? "" : "=" + (x.value ?? "")}${x.effect ? ":" + x.effect : ""} op=${x.operator ?? "Equal"}${x.tolerationSeconds !== undefined ? ` for ${x.tolerationSeconds}s` : ""}`);
    s += `Tolerations:\t${tol.length ? tol.join("\n\t") : "<none>"}\n`;
    s += eventsText(cl, p, t);
    void rt;
    return s;
  }
  function describeDeployment(cl, d, t) {
    const s0 = d.status ?? {};
    let s = `Name:\t${d.metadata.name}\nNamespace:\t${d.metadata.namespace}\nCreationTimestamp:\t${longTime(created(d))}\n`;
    s += multiline("Labels", d.metadata.labels) + multiline("Annotations", d.metadata.annotations, "", { skipLast: true, sep: ": " });
    s += `Selector:\t${selText(d.spec.selector)}\n`;
    s += `Replicas:\t${d.spec.replicas} desired | ${s0.updatedReplicas ?? 0} updated | ${s0.replicas ?? 0} total | ${s0.availableReplicas ?? 0} available | ${s0.unavailableReplicas ?? 0} unavailable\n`;
    s += `StrategyType:\t${d.spec.strategy.type}\nMinReadySeconds:\t${d.spec.minReadySeconds ?? 0}\n`;
    if (d.spec.strategy.type === "RollingUpdate") s += `RollingUpdateStrategy:\t${d.spec.strategy.rollingUpdate.maxUnavailable} max unavailable, ${d.spec.strategy.rollingUpdate.maxSurge} max surge\n`;
    s += "Pod Template:\n" + templateText(d.spec.template, "  ");
    if ((s0.conditions ?? []).length) s += condTable(s0.conditions, ["Type", "Status", "Reason"]);
    const rss = list(cl, "replicasets", d.metadata.namespace).filter((rs) => ownedBy(rs, d));
    const newRS = rss.find((rs) => same(stripHash(rs.spec.template), d.spec.template));
    const olds = rss.filter((rs) => rs !== newRS && rs.spec.replicas > 0);
    const rsText = (rs) => `${rs.metadata.name} (${rs.status?.replicas ?? 0}/${rs.spec.replicas} replicas created)`;
    s += `OldReplicaSets:\t${olds.length ? olds.map(rsText).join(", ") : "<none>"}\nNewReplicaSet:\t${newRS ? rsText(newRS) : "<none>"}\n`;
    s += eventsText(cl, d, t);
    return s;
  }
  function describeReplicaSet(cl, rs, t) {
    const pods = list(cl, "pods", rs.metadata.namespace).filter((p) => ownedBy(p, rs));
    const owner = (rs.metadata.ownerReferences ?? [])[0];
    let s = `Name:\t${rs.metadata.name}\nNamespace:\t${rs.metadata.namespace}\nSelector:\t${selText(rs.spec.selector)}\n` + multiline("Labels", rs.metadata.labels) + multiline("Annotations", rs.metadata.annotations, "", { sep: ": " });
    if (owner) s += `Controlled By:\t${owner.kind}/${owner.name}\n`;
    s += `Replicas:\t${rs.status?.replicas ?? 0} current / ${rs.spec.replicas} desired\n`;
    const c = (ph) => pods.filter((p) => p.status.phase === ph).length;
    s += `Pods Status:\t${c("Running")} Running / ${c("Pending")} Waiting / ${c("Succeeded")} Succeeded / ${c("Failed")} Failed\n`;
    s += "Pod Template:\n" + templateText(rs.spec.template, "  ") + eventsText(cl, rs, t);
    return s;
  }
  function describeService(cl, svc, t) {
    const sp = svc.spec;
    let s = `Name:\t${svc.metadata.name}\nNamespace:\t${svc.metadata.namespace}\n` + multiline("Labels", svc.metadata.labels) + multiline("Annotations", svc.metadata.annotations, "", { skipLast: true, sep: ": " });
    s += `Selector:\t${sp.selector ? labelString(sp.selector) : "<none>"}\nType:\t${sp.type}\n`;
    if (sp.type !== "ExternalName") s += `IP Family Policy:\t${sp.ipFamilyPolicy}\nIP Families:\t${(sp.ipFamilies ?? []).join(",")}\nIP:\t${sp.clusterIP}\nIPs:\t${(sp.clusterIPs ?? []).join(",")}\n`;
    if (sp.type === "LoadBalancer") s += `LoadBalancer Ingress:\t${(svc.status?.loadBalancer?.ingress ?? []).map((i) => i.ip).join(", ") || ""}\n`;
    const slice = list(cl, "endpointslices", svc.metadata.namespace).find((x) => x.metadata.labels?.["kubernetes.io/service-name"] === svc.metadata.name);
    for (const p of sp.ports ?? []) {
      s += `Port:\t${p.name || "<unset>"}  ${p.port}/${p.protocol}\nTargetPort:\t${p.targetPort}/${p.protocol}\n`;
      if (p.nodePort) s += `NodePort:\t${p.name || "<unset>"}  ${p.nodePort}/${p.protocol}\n`;
      const port = (slice?.ports ?? []).find((x) => x.name === (p.name ?? ""))?.port;
      const eps = (slice?.endpoints ?? []).filter((e) => e.conditions.ready).map((e) => `${e.addresses[0]}:${port}`);
      s += `Endpoints:\t${eps.length > 3 ? eps.slice(0, 3).join(",") + ` + ${eps.length - 3} more...` : eps.join(",")}\n`;
    }
    s += `Session Affinity:\t${sp.sessionAffinity}\n`;
    if (sp.externalTrafficPolicy) s += `External Traffic Policy:\t${sp.externalTrafficPolicy}\n`;
    s += `Internal Traffic Policy:\t${sp.internalTrafficPolicy}\n`;
    s += eventsText(cl, svc, t);
    return s;
  }
  function describeNode(cl, n, t) {
    const pods = list(cl, "pods").filter((p) => p.spec.nodeName === n.metadata.name && isActive(p));
    let s = `Name:\t${n.metadata.name}\nRoles:\t${Object.keys(n.metadata.labels).filter((k) => k.startsWith("node-role.kubernetes.io/")).map((k) => k.split("/")[1]).join(",") || "<none>"}\n`;
    s += multiline("Labels", n.metadata.labels) + multiline("Annotations", n.metadata.annotations, "", { sep: ": " });
    s += `CreationTimestamp:\t${longTime(created(n))}\nTaints:\t${(n.spec.taints ?? []).map((x) => `${x.key}:${x.effect}`).join("\n\t") || "<none>"}\nUnschedulable:\tfalse\n`;
    s += "Conditions:\n  Type\tStatus\tLastHeartbeatTime\tLastTransitionTime\tReason\tMessage\n  ----\t------\t-----------------\t------------------\t------\t-------\n";
    for (const c of n.status.conditions) s += `  ${c.type}\t${c.status}\t${longTime(t)}\t${longTime(Date.parse(c.lastTransitionTime) / 1000)}\t${c.reason}\t${c.message}\n`;
    s += `Addresses:\n  InternalIP:\t${n.status.addresses[0].address}\n  Hostname:\t${n.metadata.name}\n`;
    for (const k of ["Capacity", "Allocatable"]) s += `${k}:\n` + Object.entries(n.status[k.toLowerCase()]).map(([r, v]) => `  ${r}:\t${v}\n`).join("");
    const ni = n.status.nodeInfo;
    s += `System Info:\n  Machine ID:\t${ni.machineID}\n  System UUID:\t${ni.systemUUID}\n  Boot ID:\t${ni.bootID}\n  Kernel Version:\t${ni.kernelVersion}\n  OS Image:\t${ni.osImage}\n  Operating System:\tlinux\n  Architecture:\tamd64\n  Container Runtime Version:\t${ni.containerRuntimeVersion}\n  Kubelet Version:\t${ni.kubeletVersion}\n`;
    s += `PodCIDR:\t${n.spec.podCIDR}\nPodCIDRs:\t${n.spec.podCIDRs.join(",")}\nProviderID:\t${n.spec.providerID}\n`;
    const pct = (v, total) => `${Math.floor((v / total) * 100)}%`;
    const fmtCpu = (m) => (m % 1000 === 0 && m ? String(m / 1000) : `${m}m`);
    const fmtMem = (b) => (b === 0 ? "0" : b % 1024 ** 3 === 0 ? `${b / 1024 ** 3}Gi` : b % 1024 ** 2 === 0 ? `${b / 1024 ** 2}Mi` : `${Math.round(b / 1024)}Ki`);
    s += `Non-terminated Pods:\t(${pods.length} in total)\n  Namespace\tName\tCPU Requests\tCPU Limits\tMemory Requests\tMemory Limits\tAge\n  ---------\t----\t------------\t----------\t---------------\t-------------\t---\n`;
    let rc = 0, lc = 0, rm = 0, lm = 0;
    for (const p of pods) {
      const sum = (k, res) => p.spec.containers.reduce((a2, c) => a2 + ((res === "cpu" ? cpuMilli : memBytes)(c.resources?.[k]?.[res]) ?? 0), 0);
      const r1 = sum("requests", "cpu"), l1 = sum("limits", "cpu"), r2 = sum("requests", "memory"), l2 = sum("limits", "memory");
      rc += r1; lc += l1; rm += r2; lm += l2;
      s += `  ${p.metadata.namespace}\t${p.metadata.name}\t${fmtCpu(r1)} (${pct(r1, CPU_ALLOC)})\t${fmtCpu(l1)} (${pct(l1, CPU_ALLOC)})\t${fmtMem(r2)} (${pct(r2, MEM_ALLOC)})\t${fmtMem(l2)} (${pct(l2, MEM_ALLOC)})\t${age(t - created(p))}\n`;
    }
    s += `Allocated resources:\n  (Total limits may be over 100 percent, i.e., overcommitted.)\n  Resource\tRequests\tLimits\n  --------\t--------\t------\n  cpu\t${fmtCpu(rc)} (${pct(rc, CPU_ALLOC)})\t${fmtCpu(lc)} (${pct(lc, CPU_ALLOC)})\n  memory\t${fmtMem(rm)} (${pct(rm, MEM_ALLOC)})\t${fmtMem(lm)} (${pct(lm, MEM_ALLOC)})\n  ephemeral-storage\t0 (0%)\t0 (0%)\n  hugepages-1Gi\t0 (0%)\t0 (0%)\n  hugepages-2Mi\t0 (0%)\t0 (0%)\n`;
    s += eventsText(cl, n, t);
    return s;
  }
  function describeGeneric(cl, r, o, t) {
    let s = `Name:\t${o.metadata.name}\n${RES[r].cluster ? "" : `Namespace:\t${o.metadata.namespace}\n`}` + multiline("Labels", o.metadata.labels) + multiline("Annotations", o.metadata.annotations, "", { skipLast: true, sep: ": " });
    if (r === "configmaps") { s += "\nData\n====\n"; for (const k of Object.keys(o.data ?? {}).sort()) s += `${k}:\n----\n${o.data[k]}\n\n`; s += "\nBinaryData\n====\n\n"; }
    else if (r === "secrets") { s += `\nType:\t${o.type}\n\nData\n====\n`; for (const k of Object.keys(o.data ?? {}).sort()) s += `${k}:\t${(unb64(o.data[k]) ?? "").length} bytes\n`; }
    else if (r === "namespaces") s += `Status:\t${o.status.phase}\n\nNo resource quota.\n\nNo LimitRange resource.\n`;
    else if (r === "horizontalpodautoscalers") {
      s += `CreationTimestamp:\t${longTime(created(o))}\nReference:\t${o.spec.scaleTargetRef.kind}/${o.spec.scaleTargetRef.name}\nMetrics:\t( current / target )\n`;
      for (const m of o.spec.metrics ?? []) { const cur = (o.status?.currentMetrics ?? []).find((x) => x.resource?.name === m.resource.name)?.resource?.current; s += m.resource.target.averageUtilization !== undefined ? `  resource ${m.resource.name} on pods  (as a percentage of request):\t${cur ? `${cur.averageUtilization}% (${cur.averageValue})` : "<unknown>"} / ${m.resource.target.averageUtilization}%\n` : `  resource ${m.resource.name} on pods:\t${cur?.averageValue ?? "<unknown>"} / ${m.resource.target.averageValue}\n`; }
      s += `Min replicas:\t${o.spec.minReplicas}\nMax replicas:\t${o.spec.maxReplicas}\n${o.spec.scaleTargetRef.kind} pods:\t${o.status?.currentReplicas ?? 0} current / ${o.status?.desiredReplicas ?? 0} desired\n`;
      if ((o.status?.conditions ?? []).length) s += condTable(o.status.conditions, ["Type", "Status", "Reason", "Message"]);
    } else if (r === "jobs") {
      s += `Selector:\t${selText(o.spec.selector)}\nParallelism:\t${o.spec.parallelism}\nCompletions:\t${o.spec.completions}\nCompletion Mode:\t${o.spec.completionMode}\nSuspend:\t${o.spec.suspend}\nBackoff Limit:\t${o.spec.backoffLimit}\n`;
      if (o.status?.startTime) s += `Start Time:\t${longTime(Date.parse(o.status.startTime) / 1000)}\n`;
      if (o.status?.completionTime) s += `Completed At:\t${longTime(Date.parse(o.status.completionTime) / 1000)}\nDuration:\t${age(Date.parse(o.status.completionTime) / 1000 - Date.parse(o.status.startTime) / 1000)}\n`;
      s += `Pods Statuses:\t${o.status?.active ?? 0} Active (${o.status?.ready ?? 0} Ready) / ${o.status?.succeeded ?? 0} Succeeded / ${o.status?.failed ?? 0} Failed\nPod Template:\n` + templateText(o.spec.template, "  ");
    } else if (r === "persistentvolumeclaims") {
      s += `StorageClass:\t${o.spec.storageClassName}\nStatus:\t${o.status?.phase ?? "Pending"}\nVolume:\t${o.spec.volumeName ?? ""}\nFinalizers:\t[${(o.metadata.finalizers ?? []).join(" ")}]\nCapacity:\t${o.status?.capacity?.storage ?? ""}\nAccess Modes:\t${(o.status?.accessModes ?? []).map((m) => ({ ReadWriteOnce: "RWO" })[m] ?? m).join(",")}\nVolumeMode:\t${o.spec.volumeMode}\nUsed By:\t${list(cl, "pods", o.metadata.namespace).filter((p) => (p.spec.volumes ?? []).some((v) => v.persistentVolumeClaim?.claimName === o.metadata.name)).map((p) => p.metadata.name).join("\n\t") || "<none>"}\n`;
    }
    s += eventsText(cl, o, t);
    return s;
  }
  function cmdDescribe(sh, cl, a, ns, io) {
    const t = nowOf(cl);
    let objs = [];
    if (!a.pos.length) { io.err('You must specify the type of resource to describe. Use "kubectl api-resources" for a complete list of supported resources.\n\nerror: Required resource not specified.\nSee \'kubectl describe -h\' for help and examples\n'); return 1; }
    const tg = targets(a);
    if (tg.error) { io.err(`error: ${tg.error}\n`); return 1; }
    if (tg.list.length) {
      for (const x of tg.list) {
        let o = getObj(cl, x.r, ns, x.name);
        if (!o) { const pre = list(cl, x.r, RES[x.r].cluster ? null : ns).filter((y) => y.metadata.name.startsWith(x.name)); if (pre.length) { objs.push(...pre.map((y) => ({ r: x.r, o: y }))); continue; } io.err(`Error from server (NotFound): ${pluralString(x.r)} ${JSON.stringify(x.name)} not found\n`); return 1; }
        objs.push({ r: x.r, o });
      }
    } else {
      const sel = a.f("l", "selector") ? parseSelector(a.f("l", "selector")) : { reqs: [] };
      objs = list(cl, tg.r, RES[tg.r].cluster ? null : ns).filter((o) => matches(o.metadata.labels, sel)).map((o) => ({ r: tg.r, o }));
      if (!objs.length) { io.err(`No resources found in ${ns} namespace.\n`); return 0; }
    }
    const texts = objs.map(({ r, o }) => describeText(r === "pods" ? describePod(cl, o, t) : r === "deployments" ? describeDeployment(cl, o, t) : r === "replicasets" ? describeReplicaSet(cl, o, t) : r === "services" ? describeService(cl, o, t) : r === "nodes" ? describeNode(cl, o, t) : describeGeneric(cl, r, o, t)));
    io.out(texts.join("\n\n\n"));
    return 0;
  }

  /* ------------------------------------------------------------ logs, exec, port-forward, wait, top */

  // a pod for "hello", "pod/hello", "deploy/shop", "svc/shop" (kubectl picks the first one)
  function podFor(cl, ns, ref, io, { quiet = false } = {}) {
    let [w, n] = ref.includes("/") ? ref.split("/") : ["pod", ref];
    const r = resolveRes(w);
    if (!r) { io.err(`error: the server doesn't have a resource type "${w}"\n`); return null; }
    if (r === "pods") { const p = getObj(cl, "pods", ns, n); if (!p) io.err(`Error from server (NotFound): pods ${JSON.stringify(n)} not found\n`); return p; }
    const o = getObj(cl, r, ns, n);
    if (!o) { io.err(`Error from server (NotFound): ${pluralString(r)} ${JSON.stringify(n)} not found\n`); return null; }
    const sel = r === "services" ? (o.spec.selector ? { matchLabels: o.spec.selector } : null) : o.spec.selector;
    const pods = list(cl, "pods", ns).filter((p) => sel && selectorMatch(p.metadata.labels, sel) && isActive(p)).sort((x, y) => (podReady(y) - podReady(x)) || created(x) - created(y));
    if (!pods.length) { io.err(`error: timed out waiting for the condition\n`); return null; }
    if (!quiet && pods.length > 1 && w !== "svc" && w !== "service") io.err(`Found ${pods.length} pods, using pod/${pods[0].metadata.name}\n`);
    return pods[0];
  }
  const containerOf = (pod, a, io, verb) => {
    const want = a.f("c", "container");
    const c = want ? pod.spec.containers.find((x) => x.name === want) : pod.spec.containers[0];
    if (!c) { io.err(`error: container ${want} is not valid for pod ${pod.metadata.name}\n`); return null; }
    if (!want && pod.spec.containers.length > 1 && verb === "logs") io.err(`Defaulted container "${c.name}" out of: ${pod.spec.containers.map((x) => x.name).join(", ")}\n`);
    return c;
  };
  function cmdLogs(sh, cl, a, ns, io) {
    const sel = a.f("l", "selector");
    let pods;
    if (sel) {
      const s = parseSelector(sel);
      pods = list(cl, "pods", ns).filter((p) => matches(p.metadata.labels, s));
      if (!pods.length) { io.err(`No resources found in ${ns} namespace.\n`); return 0; }
    } else {
      if (!a.pos.length) { io.err("error: expected 'logs [-f] [-p] (POD | TYPE/NAME) [-c CONTAINER]'.\nPOD or TYPE/NAME is a required argument for the logs command\nSee 'kubectl logs -h' for help and examples\n"); return 1; }
      const p = podFor(cl, ns, a.pos[0], io);
      if (!p) return 1;
      pods = [p];
      if (a.pos[1]) a.flags.c = a.pos[1];
    }
    const tail = a.f("tail") !== undefined ? Number(a.f("tail")) : sel ? 10 : -1;
    for (const pod of pods) {
      const c = containerOf(pod, a, io, "logs");
      if (!c) return 1;
      const rt = cl.rt.get(pod.metadata.uid);
      const st = rt?.cs.get(c.name);
      if (rt?.virtual) { io.out(virtualLogs(cl, pod, c)); continue; }
      const dc = a.b("previous") ? st?.prev : st?.dc;
      if (!dc) {
        if (a.b("previous")) { io.err(`Error from server (BadRequest): previous terminated container ${JSON.stringify(c.name)} in pod ${JSON.stringify(pod.metadata.name)} not found\n`); return 1; }
        io.err(`Error from server (BadRequest): container ${JSON.stringify(c.name)} in pod ${JSON.stringify(pod.metadata.name)} is waiting to start: ${st?.waiting === "ImagePullBackOff" || st?.waiting === "ErrImagePull" ? `trying and failing to pull image` : st?.waiting === "CreateContainerConfigError" ? "CreateContainerConfigError" : "ContainerCreating"}\n`);
        if (!sel) return 1;
        continue;
      }
      let lines = dc.logs.map(([, txt]) => txt).join("").split("\n");
      if (lines[lines.length - 1] === "") lines.pop();
      if (tail >= 0) lines = lines.slice(-tail);
      const pre = a.b("prefix") ? `[pod/${pod.metadata.name}/${c.name}] ` : "";
      io.out(lines.map((l) => pre + l + "\n").join(""));
    }
    if (a.b("follow")) io.err("(kubectl logs -f keeps printing new lines until you press Ctrl+C; the sandbox stops here.)\n");
    return 0;
  }
  function virtualLogs(cl, pod, c) {
    if (/metrics-server/.test(c.image)) {
      const ok = (c.args ?? []).includes("--kubelet-insecure-tls");
      const node = cl.nodes[0];
      const born = cl.rt.get(pod.metadata.uid)?.born ?? nowOf(cl);
      const d = new Date(born * 1000), p = (n, w = 2) => String(n).padStart(w, "0");
      const k = (s, code, file) => `${code}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds() + s % 60)}.${p(100000 + s * 7919 % 899999, 6)}       1 ${file}] `;
      let out = `${k(1, "I", "serving.go:380")}Generated self-signed cert (/tmp/apiserver.crt, /tmp/apiserver.key)\n${k(2, "I", "handler.go:288")}Adding GroupVersion metrics.k8s.io v1beta1 to ResourceManager\n${k(2, "I", "secure_serving.go:213")}Serving securely on [::]:10250\n`;
      if (!ok) for (let i = 0; i < 3; i++) out += `${k(16 + i * 15, "E", "scraper.go:149")}"Failed to scrape node" err="Get \\"https://${node.ip}:10250/metrics/resource\\": tls: failed to verify certificate: x509: cannot validate certificate for ${node.ip} because it doesn't contain any IP SANs" node="${node.name}"\n`;
      return out;
    }
    if (/coredns/.test(c.image)) return `.:53\n[INFO] plugin/reload: Running configuration SHA512 = 591cf328cccc12bc490481273e738df59329c62c0b729d94e8b61db9961c2fa5f046dd37f1cf888b953814040d180f52594972691cd6ff41be96639138a43908\nCoreDNS-${V.coredns.slice(1)}\nlinux/amd64, go1.25.7, 1db4568\n`;
    return "";
  }
  async function cmdExec(sh, cl, a, ns, io) {
    if (!a.rest) { io.err(a.pos.length > 1 ? `error: exec [POD] [COMMAND] is not supported anymore. Use exec [POD] -- [COMMAND] instead\nSee 'kubectl exec -h' for help and examples\n` : "error: you must specify at least one command for the container\n"); return 1; }
    if (!a.pos.length) { io.err("error: expected 'exec (POD | TYPE/NAME) [-c CONTAINER] [flags] -- COMMAND [args...]'.\nPOD or TYPE/NAME is a required argument for the exec command\nSee 'kubectl exec -h' for help and examples\n"); return 1; }
    const pod = podFor(cl, ns, a.pos[0], io, { quiet: true });
    if (!pod) return 1;
    const c = containerOf(pod, a, io, "exec");
    if (!c) return 1;
    if (pod.spec.containers.length > 1 && !a.f("c", "container")) io.err(`Defaulted container "${c.name}" out of: ${pod.spec.containers.map((x) => x.name).join(", ")}\n`);
    const rt = cl.rt.get(pod.metadata.uid);
    const st = rt?.cs.get(c.name);
    if (rt?.virtual) { io.err(`error: Internal error occurred: error executing command in container: failed to exec in container: the sandbox doesn't run Kubernetes' own components\n`); return 1; }
    if (!st?.dc || st.dc.state !== "running") { io.err(`error: unable to upgrade connection: container not found (${JSON.stringify(c.name)})\n`); return 1; }
    const argv = a.rest;
    if (a.b("t", "tty") && ["sh", "/bin/sh", "bash", "/bin/bash", "ash"].includes(argv[0]) && argv.length === 1) { io.err("(The sandbox can't open an interactive shell in a container. Run one command at a time instead, like kubectl exec POD -- ls /app.)\n"); return 0; }
    const exe = argv[0];
    if (!exe.includes("/") && !st.dc.image.bins.includes(exe) && !["sh", "echo", "cd", "test"].includes(exe)) {
      io.err(`error: Internal error occurred: Internal error occurred: error executing command in container: failed to exec in container: failed to start exec "${hexr(cl.e, 64)}": OCI runtime exec failed: exec failed: unable to start container process: exec: "${exe}": executable file not found in $PATH\n`);
      return 1;
    }
    const r = await D.execIn(rt.node.ne, st.dc, argv, { io, stdin: io.stdin ?? "" });
    if (r.code) io.err(`command terminated with exit code ${r.code}\n`);
    return r.code;
  }
  async function cmdPortForward(sh, cl, a, ns, io) {
    const ref = a.pos[0], spec = a.pos.slice(1).filter((x) => x !== "&");
    if (!ref || !spec.length) { io.err("error: TYPE/NAME and list of ports are required for port-forward\nSee 'kubectl port-forward -h' for help and examples\n"); return 1; }
    const bg = a.pos.includes("&");
    const [w, n] = ref.includes("/") ? ref.split("/") : ["pod", ref];
    const r = resolveRes(w);
    const svc = r === "services" ? getObj(cl, "services", ns, n) : null;
    if (r === "services" && !svc) { io.err(`Error from server (NotFound): services ${JSON.stringify(n)} not found\n`); return 1; }
    const pod = podFor(cl, ns, ref, io, { quiet: true });
    if (!pod) return 1;
    if (pod.status.phase !== "Running") { io.err(`error: unable to forward port because pod is not running. Current status=${pod.status.phase}\n`); return 1; }
    const hostNs = NET.ns(sh);
    for (const pr of spec) {
      const [lp, rp0] = pr.includes(":") ? pr.split(":") : [pr, pr];
      let rp = Number(rp0);
      if (svc) {
        const sp = (svc.spec.ports ?? []).find((p) => p.port === rp || p.name === rp0);
        if (!sp) { io.err(`error: Service ${n} does not have a service port ${rp0}\n`); return 1; }
        rp = typeof sp.targetPort === "number" ? sp.targetPort : Number(pod.spec.containers.flatMap((c) => c.ports ?? []).find((p) => p.name === sp.targetPort)?.containerPort);
      }
      const local = Number(lp || 0) || 30000 + Math.floor(rnd(cl.e) * 30000);
      if (hostNs.listeners.has(local) || [...cl.e.containers.values()].some((c) => c.state === "running" && c.ports.some((p) => p.hostPort === local))) {
        io.err(`Unable to listen on port ${local}: Listeners failed to create with the following errors: [unable to create listener: Error listen tcp4 127.0.0.1:${local}: bind: address already in use unable to create listener: Error listen tcp6 [::1]:${local}: bind: address already in use]\nerror: unable to listen on any of the requested ports: [{${local} ${rp}}]\n`);
        return 1;
      }
      io.out(`Forwarding from 127.0.0.1:${local} -> ${rp}\nForwarding from [::1]:${local} -> ${rp}\n`);
      const target = pod;
      hostNs.listeners.set(local, {
        host: "127.0.0.1", portForward: true,
        handle: async (req) => {
          const live = getObj(cl, "pods", target.metadata.namespace, target.metadata.name);
          if (!live || live.metadata.uid !== target.metadata.uid) { hostNs.listeners.delete(local); return { error: "reset" }; }
          await work(cl);
          const res = await deliverToPod(cl, live, rp, req, "127.0.0.1");
          if (res.error) return { error: "empty" };
          return res;
        },
      });
    }
    if (!bg) io.err("(kubectl port-forward keeps running until you press Ctrl+C. The sandbox leaves it running in the background, so your next commands can use it; on your own computer, run it in a second terminal, or add & at the end of the line.)\n");
    return 0;
  }
  async function cmdWait(sh, cl, a, ns, io) {
    const forSpec = a.f("for");
    if (!forSpec) { io.err("error: --for must be specified\n"); return 1; }
    const timeout = (() => { const m = /^(\d+)(s|m|h)?$/.exec(a.f("timeout") ?? "30s"); return m ? Number(m[1]) * ({ s: 1, m: 60, h: 3600 }[m[2] ?? "s"]) : 30; })();
    const tg = targets(a);
    if (tg.error) { io.err(`error: ${tg.error}\n`); return 1; }
    const sel = a.f("l", "selector") ? parseSelector(a.f("l", "selector")) : null;
    const pick = () => (tg.list.length ? tg.list.map((x) => ({ r: x.r, name: x.name, o: getObj(cl, x.r, ns, x.name) })) : list(cl, tg.r, ns).filter((o) => !sel || matches(o.metadata.labels, sel)).map((o) => ({ r: tg.r, name: o.metadata.name, o })));
    let items = pick();
    if (!items.length) { io.err(a.b("all") || sel ? `error: no matching resources found\n` : "error: resource name may not be empty\n"); return 1; }
    for (const it of items) if (!it.o && forSpec !== "delete") { io.err(`Error from server (NotFound): ${pluralString(it.r)} ${JSON.stringify(it.name)} not found\n`); return 1; }
    const m = /^condition=([\w]+)(?:=(\w+))?$/i.exec(forSpec);
    const jp = /^jsonpath=\{(.+)\}=(.*)$/.exec(forSpec);
    const met = (it) => {
      const o = getObj(cl, it.r, ns, it.name);
      if (forSpec === "delete") return !o || (it.o && o.metadata.uid !== it.o.metadata.uid);
      if (!o) return false;
      if (jp) return jsonpath(`{${jp[1]}}`, o) === jp[2].replace(/^['"]|['"]$/g, "");
      if (!m) return false;
      const want = (m[2] ?? "True").toLowerCase();
      const conds = it.r === "deployments" || it.r === "pods" || it.r === "jobs" || it.r === "nodes" ? o.status?.conditions ?? [] : [];
      return conds.some((c) => c.type.toLowerCase() === m[1].toLowerCase() && String(c.status).toLowerCase() === want);
    };
    if (!m && !jp && forSpec !== "delete") { io.err(`error: unrecognized condition: ${JSON.stringify(forSpec)}\n`); return 1; }
    const printed = new Set();
    const report = () => { for (const it of items) if (!printed.has(it.name) && met(it)) { printed.add(it.name); io.out(`${kindString(it.r)}/${it.name} condition met\n`); } };
    report();
    await advance(cl, timeout, () => items.every((it) => printed.has(it.name)), report);
    report();
    if (items.every((it) => printed.has(it.name))) return 0;
    for (const it of items) if (!printed.has(it.name)) io.err(`error: timed out waiting for the condition on ${pluralString(it.r)}/${it.name}\n`);
    return 1;
  }
  function cmdTop(sh, cl, a, ns, io) {
    const t = nowOf(cl);
    if (!metricsUp(cl, t)) { io.err("error: Metrics API not available\n"); return 1; }
    const what = resolveRes(a.pos[0] ?? "");
    const fmtMi = (b) => `${Math.max(1, Math.round(b / 1024 ** 2))}Mi`;
    if (what === "nodes") {
      const rows = [["NAME", "CPU(cores)", "CPU(%)", "MEMORY(bytes)", "MEMORY(%)"]];
      for (const n of cl.nodes) { const pods = list(cl, "pods").filter((p) => p.spec.nodeName === n.name && isActive(p)); const cpu = 160 + pods.reduce((x, p) => x + cpuUsage(cl, p, t), 0); const mem = 620 * 1024 ** 2 + pods.reduce((x, p) => x + memUsage(cl, p), 0); rows.push([n.name, `${cpu}m`, `${Math.round((cpu / CPU_ALLOC) * 100)}%`, fmtMi(mem), `${Math.round((mem / MEM_ALLOC) * 100)}%`]); }
      io.out(table(rows));
      return 0;
    }
    if (what !== "pods") { io.err(`error: unknown command "${a.pos[0] ?? ""}" for "kubectl top"\n`); return 1; }
    const all = a.b("A", "all-namespaces");
    const sel = a.f("l", "selector") ? parseSelector(a.f("l", "selector")) : null;
    const pods = list(cl, "pods", all ? null : ns).filter((p) => p.status.phase === "Running" && (!sel || matches(p.metadata.labels, sel)) && (!a.pos[1] || p.metadata.name === a.pos[1]) && t - (cl.rt.get(p.metadata.uid)?.born ?? t) >= 15);
    if (!pods.length) { io.err(`No resources found in ${ns} namespace.\n`); return 0; }
    const rows = [[...(all ? ["NAMESPACE"] : []), "NAME", "CPU(cores)", "MEMORY(bytes)"]];
    for (const p of pods) rows.push([...(all ? [p.metadata.namespace] : []), p.metadata.name, `${cpuUsage(cl, p, t)}m`, fmtMi(memUsage(cl, p))]);
    io.out(table(rows));
    return 0;
  }

  /* ------------------------------------------------------------ kubectl config, version, cluster-info and the dispatcher */

  async function cmdConfig(sh, a, io) {
    const sub = a.pos[0];
    const cfg = readKubeconfig(sh);
    const none = () => { io.err(`error: current-context is not set\n`); return 1; };
    switch (sub) {
      case "current-context": if (!cfg?.["current-context"]) return none(); io.out(cfg["current-context"] + "\n"); return 0;
      case "get-contexts": {
        const rows = [["CURRENT", "NAME", "CLUSTER", "AUTHINFO", "NAMESPACE"]];
        for (const c of cfg?.contexts ?? []) rows.push([c.name === cfg["current-context"] ? "*" : "", c.name, c.context?.cluster ?? "", c.context?.user ?? "", c.context?.namespace ?? ""]);
        io.out(table(rows));
        return 0;
      }
      case "get-clusters": io.out("NAME\n" + (cfg?.clusters ?? []).map((c) => c.name + "\n").join("")); return 0;
      case "use-context": case "use": {
        const name = a.pos[1];
        if (!(cfg?.contexts ?? []).some((c) => c.name === name)) { io.err(`error: no context exists with the name: "${name}"\n`); return 1; }
        cfg["current-context"] = name;
        await writeKubeconfig(sh, cfg);
        io.out(`Switched to context "${name}".\n`);
        return 0;
      }
      case "set-context": {
        const name = a.b("current") ? cfg?.["current-context"] : a.pos[1];
        if (!name) return none();
        const ctx = (cfg.contexts ?? []).find((c) => c.name === name);
        const exists = !!ctx;
        const c = ctx ?? { name, context: {} };
        if (a.f("n", "namespace") !== undefined) c.context.namespace = a.f("n", "namespace");
        if (a.f("cluster")) c.context.cluster = a.f("cluster");
        if (a.f("user")) c.context.user = a.f("user");
        if (!exists) cfg.contexts.push(c);
        await writeKubeconfig(sh, cfg);
        io.out(`Context "${name}" ${exists ? "modified" : "created"}.\n`);
        return 0;
      }
      case "view": {
        if (!cfg) { io.out("apiVersion: v1\nclusters: null\ncontexts: null\ncurrent-context: \"\"\nkind: Config\npreferences: {}\nusers: null\n"); return 0; }
        const red = (x) => (a.b("raw") ? x : x === undefined ? x : "DATA+OMITTED");
        let v = clone(cfg);
        if (a.b("minify")) { const cur = v["current-context"]; const ctx = v.contexts.find((c) => c.name === cur); v.contexts = [ctx]; v.clusters = v.clusters.filter((c) => c.name === ctx.context.cluster); v.users = v.users.filter((u) => u.name === ctx.context.user); }
        v.clusters = v.clusters.map((c) => ({ ...c, cluster: { ...c.cluster, "certificate-authority-data": red(c.cluster["certificate-authority-data"]) } }));
        v.users = v.users.map((u) => ({ ...u, user: { ...u.user, "client-certificate-data": red(u.user["client-certificate-data"]), "client-key-data": a.b("raw") ? u.user["client-key-data"] : "DATA+OMITTED" } }));
        v = { apiVersion: "v1", clusters: v.clusters, contexts: v.contexts, "current-context": v["current-context"], kind: "Config", preferences: {}, users: v.users };
        io.out(yamlDoc(v).replace(/: DATA\+OMITTED/g, ": DATA+OMITTED"));
        return 0;
      }
      default: io.err(`error: unknown command "${sub ?? ""}" for "kubectl config"\n`); return 1;
    }
  }
  const API_RESOURCES = [["bindings", "", "v1", "true", "Binding"], ["componentstatuses", "cs", "v1", "false", "ComponentStatus"], ["configmaps", "cm", "v1", "true", "ConfigMap"], ["endpoints", "ep", "v1", "true", "Endpoints"], ["events", "ev", "v1", "true", "Event"], ["limitranges", "limits", "v1", "true", "LimitRange"], ["namespaces", "ns", "v1", "false", "Namespace"], ["nodes", "no", "v1", "false", "Node"], ["persistentvolumeclaims", "pvc", "v1", "true", "PersistentVolumeClaim"], ["persistentvolumes", "pv", "v1", "false", "PersistentVolume"], ["pods", "po", "v1", "true", "Pod"], ["podtemplates", "", "v1", "true", "PodTemplate"], ["replicationcontrollers", "rc", "v1", "true", "ReplicationController"], ["resourcequotas", "quota", "v1", "true", "ResourceQuota"], ["secrets", "", "v1", "true", "Secret"], ["serviceaccounts", "sa", "v1", "true", "ServiceAccount"], ["services", "svc", "v1", "true", "Service"], ["controllerrevisions", "", "apps/v1", "true", "ControllerRevision"], ["daemonsets", "ds", "apps/v1", "true", "DaemonSet"], ["deployments", "deploy", "apps/v1", "true", "Deployment"], ["replicasets", "rs", "apps/v1", "true", "ReplicaSet"], ["statefulsets", "sts", "apps/v1", "true", "StatefulSet"], ["horizontalpodautoscalers", "hpa", "autoscaling/v2", "true", "HorizontalPodAutoscaler"], ["cronjobs", "cj", "batch/v1", "true", "CronJob"], ["jobs", "", "batch/v1", "true", "Job"], ["endpointslices", "", "discovery.k8s.io/v1", "true", "EndpointSlice"], ["ingressclasses", "", "networking.k8s.io/v1", "false", "IngressClass"], ["ingresses", "ing", "networking.k8s.io/v1", "true", "Ingress"], ["networkpolicies", "netpol", "networking.k8s.io/v1", "true", "NetworkPolicy"], ["poddisruptionbudgets", "pdb", "policy/v1", "true", "PodDisruptionBudget"], ["clusterrolebindings", "", "rbac.authorization.k8s.io/v1", "false", "ClusterRoleBinding"], ["clusterroles", "", "rbac.authorization.k8s.io/v1", "false", "ClusterRole"], ["rolebindings", "", "rbac.authorization.k8s.io/v1", "true", "RoleBinding"], ["roles", "", "rbac.authorization.k8s.io/v1", "true", "Role"], ["priorityclasses", "pc", "scheduling.k8s.io/v1", "false", "PriorityClass"], ["storageclasses", "sc", "storage.k8s.io/v1", "false", "StorageClass"]];
  const HELP = `kubectl controls the Kubernetes cluster manager.\n\n Find more information at: https://kubernetes.io/docs/reference/kubectl/\n\nBasic Commands (Beginner):\n  create          Create a resource from a file or from stdin\n  expose          Take a replication controller, service, deployment or pod and expose it as a new Kubernetes service\n  run             Run a particular image on the cluster\n  set             Set specific features on objects\n\nBasic Commands (Intermediate):\n  explain         Get documentation for a resource\n  get             Display one or many resources\n  edit            Edit a resource on the server\n  delete          Delete resources by file names, stdin, resources and names, or by resources and label selector\n\nDeploy Commands:\n  rollout         Manage the rollout of a resource\n  scale           Set a new size for a deployment, replica set, or replication controller\n  autoscale       Auto-scale a deployment, replica set, stateful set, or replication controller\n\nCluster Management Commands:\n  certificate     Modify certificate resources\n  cluster-info    Display cluster information\n  top             Display resource (CPU/memory) usage\n  cordon          Mark node as unschedulable\n  uncordon        Mark node as schedulable\n  drain           Drain node in preparation for maintenance\n  taint           Update the taints on one or more nodes\n\nTroubleshooting and Debugging Commands:\n  describe        Show details of a specific resource or group of resources\n  logs            Print the logs for a container in a pod\n  attach          Attach to a running container\n  exec            Execute a command in a container\n  port-forward    Forward one or more local ports to a pod\n  proxy           Run a proxy to the Kubernetes API server\n  cp              Copy files and directories to and from containers\n  auth            Inspect authorization\n  debug           Create debugging sessions for troubleshooting workloads and nodes\n  events          List events\n\nAdvanced Commands:\n  diff            Diff the live version against a would-be applied version\n  apply           Apply a configuration to a resource by file name or stdin\n  patch           Update fields of a resource\n  replace         Replace a resource by file name or stdin\n  wait            Experimental: Wait for a specific condition on one or many resources\n  kustomize       Build a kustomization target from a directory or URL\n\nSettings Commands:\n  label           Update the labels on a resource\n  annotate        Update the annotations on a resource\n  completion      Output shell completion code for the specified shell (bash, zsh, fish, or powershell)\n\nSubcommands provided by plugins:\n\nOther Commands:\n  api-resources   Print the supported API resources on the server\n  api-versions    Print the supported API versions on the server, in the form of "group/version"\n  config          Modify kubeconfig files\n  plugin          Provides utilities for interacting with plugins\n  version         Print the client and server version information\n\nUsage:\n  kubectl [flags] [options]\n\nUse "kubectl <command> --help" for more information about a given command.\nUse "kubectl options" for a list of global command-line options (applies to all commands).\n`;
  const NEEDS_NO_CLUSTER = new Set(["config", "completion", "help", "options", "plugin", "kustomize"]);
  async function kubectl(sh, argv, io) {
    if (!argv.length) { io.out(HELP); return 0; }
    // the first word that isn't a flag is the command
    let ci = 0;
    while (ci < argv.length && argv[ci].startsWith("-")) ci += VALUE_FLAGS.has(argv[ci].replace(/^-+/, "").split("=")[0]) && !argv[ci].includes("=") ? 2 : 1;
    const cmd = argv[ci];
    if (!cmd) { io.out(HELP); return 0; }
    const a = parseArgs([...argv.slice(0, ci), ...argv.slice(ci + 1)], cmd);
    if (a.error) { io.err(`error: ${a.error}\nSee 'kubectl ${cmd} --help' for usage.\n`); return 1; }
    if (a.b("help", "h")) { io.out(cmd === "help" ? HELP : `(kubectl ${cmd} --help prints the command's documentation; see https://kubernetes.io/docs/reference/kubectl/generated/kubectl_${cmd}/)\n`); return 0; }
    if (cmd === "help") { io.out(HELP); return 0; }
    if (cmd === "version" && a.b("client")) { io.out(`Client Version: ${V.kubectl}\nKustomize Version: ${V.kustomize}\n`); return 0; }
    if (cmd === "config") return cmdConfig(sh, a, io);
    if (cmd === "completion") { io.out(`# bash completion for kubectl                              -*- shell-script -*-\n# (the sandbox prints only the start of the script)\n`); return 0; }
    // client-side dry runs of create/run/expose/autoscale don't need a cluster
    const dryClient = a.f("dry-run") === "client" && ["create", "run"].includes(cmd) && !a.m("f", "filename").length && !(cmd === "create" && a.pos[0] === "job" && a.f("from"));
    if (dryClient) {
      const fake = { e: D.engine(sh), objs: new Map(), rv: 0, svcIPs: new Set(), nodePorts: new Set() };
      return cmd === "run" ? cmdRun(sh, fake, a, a.f("n", "namespace") ?? "default", io) : cmdCreate(sh, fake, a, a.f("n", "namespace") ?? "default", io);
    }
    if (NEEDS_NO_CLUSTER.has(cmd)) { io.err(`error: the sandbox's kubectl doesn't include "${cmd}"\n`); return 1; }
    const KNOWN = ["get", "describe", "apply", "create", "delete", "run", "logs", "exec", "port-forward", "expose", "scale", "set", "rollout", "autoscale", "patch", "label", "annotate", "wait", "top", "version", "cluster-info", "api-resources", "api-versions", "events", "explain", "edit", "replace", "diff", "cordon", "uncordon", "drain", "taint", "cp", "debug", "attach", "proxy", "auth"];
    if (!KNOWN.includes(cmd)) {
      const close = KNOWN.find((k) => k.startsWith(cmd.slice(0, 3)));
      io.err(`error: unknown command "${cmd}" for "kubectl"${close ? `\n\nDid you mean this?\n\t${close}\n` : "\n"}`);
      return 1;
    }
    const conn = connect(sh, a);
    if (conn.error) {
      if (cmd === "version") io.out(`Client Version: ${V.kubectl}\nKustomize Version: ${V.kustomize}\n`);
      if (conn.error === "noconfig" || conn.error === "refused") return connError(D.engine(sh), io, conn);
      io.err(`error: ${conn.error}\n`);
      return 1;
    }
    const cl = conn.cl;
    const ns = a.f("n", "namespace") ?? conn.ns;
    D.tick(cl.e, 1);
    await work(cl);
    let code;
    switch (cmd) {
      case "version": io.out(`Client Version: ${V.kubectl}\nKustomize Version: ${V.kustomize}\nServer Version: ${V.k8s}\n`); code = 0; break;
      case "cluster-info": {
        const url = `https://127.0.0.1:${cl.apiPort}`;
        io.out(`Kubernetes control plane is running at ${url}\nCoreDNS is running at ${url}/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy\n\nTo further debug and diagnose cluster problems, use 'kubectl cluster-info dump'.\n`);
        code = 0; break;
      }
      case "api-resources": {
        const rows = [["NAME", "SHORTNAMES", "APIVERSION", "NAMESPACED", "KIND"], ...API_RESOURCES];
        io.out(table(rows)); code = 0; break;
      }
      case "api-versions": io.out(["admissionregistration.k8s.io/v1", "apiextensions.k8s.io/v1", "apiregistration.k8s.io/v1", "apps/v1", "authentication.k8s.io/v1", "authorization.k8s.io/v1", "autoscaling/v1", "autoscaling/v2", "batch/v1", "certificates.k8s.io/v1", "coordination.k8s.io/v1", "discovery.k8s.io/v1", "events.k8s.io/v1", "flowcontrol.apiserver.k8s.io/v1", "networking.k8s.io/v1", "node.k8s.io/v1", "policy/v1", "rbac.authorization.k8s.io/v1", "resource.k8s.io/v1", "scheduling.k8s.io/v1", "storage.k8s.io/v1", "v1"].map((x) => x + "\n").join("")); code = 0; break;
      case "get": code = cmdGet(sh, cl, a, ns, io); break;
      case "describe": code = cmdDescribe(sh, cl, a, ns, io); break;
      case "apply": code = await cmdApplyFiles(sh, cl, a, ns, io); break;
      case "create": code = await cmdCreate(sh, cl, a, ns, io); break;
      case "replace": code = await cmdApplyFiles(sh, cl, a, ns, io); break;
      case "delete": code = await cmdDelete(sh, cl, a, ns, io); break;
      case "run": code = await cmdRun(sh, cl, a, ns, io); break;
      case "logs": code = cmdLogs(sh, cl, a, ns, io); break;
      case "exec": code = await cmdExec(sh, cl, a, ns, io); break;
      case "port-forward": code = await cmdPortForward(sh, cl, a, ns, io); break;
      case "expose": code = await cmdExpose(sh, cl, a, ns, io); break;
      case "scale": code = await cmdScale(sh, cl, a, ns, io); break;
      case "set": code = await cmdSet(sh, cl, a, ns, io); break;
      case "rollout": code = await cmdRollout(sh, cl, a, ns, io); break;
      case "autoscale": code = await cmdAutoscale(sh, cl, a, ns, io); break;
      case "patch": code = await cmdPatch(sh, cl, a, ns, io); break;
      case "label": code = await cmdLabel(sh, cl, a, ns, io); break;
      case "annotate": code = await cmdLabel(sh, cl, a, ns, io, "annotations"); break;
      case "wait": code = await cmdWait(sh, cl, a, ns, io); break;
      case "top": code = cmdTop(sh, cl, a, ns, io); break;
      case "events": {
        const all = a.b("A", "all-namespaces");
        const evs = cl.events.filter((x) => all || x.ns === ns).sort((x, y) => x.lastSeq - y.lastSeq);
        if (!evs.length) { io.err(`No events found in ${ns} namespace.\n`); code = 0; break; }
        io.out(eventsTable(cl, evs, nowOf(cl), { ns: all })); code = 0; break;
      }
      case "edit": io.err("(kubectl edit opens the object in your editor and applies what you save; the sandbox has no editor. Change the manifest file and kubectl apply it, or use kubectl patch or kubectl set.)\n"); code = 1; break;
      case "explain": io.out(`(kubectl explain ${a.pos[0] ?? ""} prints the API's documentation for a field; read it at https://kubernetes.io/docs/reference/kubernetes-api/ or run it on your own computer.)\n`); code = 0; break;
      default: io.err(`(The sandbox's kubectl doesn't include "kubectl ${cmd}"; it works the same way on your own computer.)\n`); code = 1;
    }
    await work(cl);
    nodePortListeners(cl);
    return code;
  }
  registerCommand("kubectl", async (sh, args, io) => {
    if (sh.container) { io.err(sh.notFound ? sh.notFound("kubectl") : "sh: kubectl: not found\n"); return 127; }
    return kubectl(sh, args, io);
  });
  // base64 (GNU coreutils), for writing and reading Secrets
  registerCommand("base64", async (sh, args, io) => {
    const decode = args.includes("-d") || args.includes("--decode");
    const file = args.find((x) => !x.startsWith("-"));
    const input = file ? sh.fs.text(sh.abs(file)) : io.stdin ?? "";
    if (input === null) { io.err(`base64: ${file}: No such file or directory\n`); return 1; }
    if (decode) { const out = unb64(input); if (out === null) { io.err("base64: invalid input\n"); return 1; } io.out(out); return 0; }
    const enc = b64(input);
    const wrap = args.includes("-w0") || args.includes("--wrap=0") ? enc : enc.replace(/(.{76})/g, "$1\n").replace(/\n$/, "");
    io.out(wrap + (args.includes("-w0") || args.includes("--wrap=0") ? "" : "\n"));
    return 0;
  });

  /* ------------------------------------------------------------ for exercise checks */

  addHelpers((sh) => ({
    // the kind cluster the current kubectl context points at (or the one named), as plain objects
    k8s(name) {
      const e = D.engine(sh);
      let cl = name ? clustersOf(e).get(name) : null;
      if (!cl) { const c = connect(sh, { f: () => undefined }); cl = c.cl ?? [...clustersOf(e).values()][0]; }
      if (!cl) return null;
      const r = (k) => resolveRes(k) ?? k;
      return {
        name: cl.name,
        nodes: () => cl.nodes.map((n) => ({ name: n.name, role: n.role, ready: nodeReady(cl, n), images: [...n.ne.tags.keys()].map((t) => D.parseRef(t).familiar) })),
        list: (k, ns = "default") => list(cl, r(k), RES[r(k)]?.cluster ? null : ns).map(clone),
        get: (k, nm, ns = "default") => clone(getObj(cl, r(k), ns, nm)),
        pods: (sel = "", ns = "default") => { const s = parseSelector(sel); return list(cl, "pods", ns).filter((p) => matches(p.metadata.labels, s)).map((p) => ({ name: p.metadata.name, phase: p.status.phase, status: podStatusText(p).reason, ready: podReady(p), image: p.spec.containers[0].image, restarts: podStatusText(p).restarts, terminating: !!p.metadata.deletionTimestamp, labels: { ...(p.metadata.labels ?? {}) }, obj: clone(p) })); },
        endpoints: (svc, ns = "default") => { const sl = list(cl, "endpointslices", ns).find((x) => x.metadata.labels?.["kubernetes.io/service-name"] === svc); return (sl?.endpoints ?? []).filter((x) => x.conditions.ready).map((x) => x.addresses[0]); },
        logs: (pod, ns = "default") => { const p = getObj(cl, "pods", ns, pod); const rt = p && cl.rt.get(p.metadata.uid); return rt ? [...rt.cs.values()].map((st) => (st.dc ? st.dc.logs.map(([, x]) => x).join("") : "")).join("") : null; },
        events: (ns = "default") => cl.events.filter((x) => x.ns === ns).map((x) => ({ type: x.type, reason: x.reason, message: x.message, object: `${x.obj.kind}/${x.obj.name}`, count: x.count })),
        env: (pod, ns = "default") => { const p = getObj(cl, "pods", ns, pod); const st = p && [...(cl.rt.get(p.metadata.uid)?.cs.values() ?? [])][0]; return st?.dc ? { ...st.dc.env } : null; },
        async request(url, ns = "default") {
          const p = list(cl, "pods", ns).find((x) => podReady(x)) ?? list(cl, "pods", "default")[0];
          const fake = { container: { pod: { cl, uid: p?.metadata.uid, ns, name: p?.metadata.name }, hostname: "check" } };
          const r = await NET.request(fake, { url, userAgent: "check" });
          return r.body ?? r.error ?? "";
        },
      };
    },
  }));
}
