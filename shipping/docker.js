/* docker.js: a pretend Docker Engine 29 for the sandbox, with the docker CLI printing like Docker 29.9 does.
   - images are file systems in memory: a few official images from Docker Hub (node, alpine, nginx, hello-world) and
     the images you build from a Dockerfile, with BuildKit's plain progress output, its build cache, multi-stage builds
     and its build checks (warnings)
   - containers run for real in their own file system and shell: node runs your server.js, busybox commands work, and
     a pretend network connects them: curl on the sandbox's terminal reaches published ports, containers on a
     user-defined network find each other by name, and node:http servers answer
   - volumes, bind mounts, environment variables, restart policies, health checks, signals and exit codes
   - docker compose (compose.js), registries (Docker Hub and ghcr.io) with docker login/push/pull, and the docker/*
     actions GitHub Actions uses to build and push images (compose.js)
   Everything finishes instantly with realistic, fixed timings. It's a teaching simulation: real Docker runs Linux
   containers with namespaces and cgroups; this runs JavaScript in your browser. */
import { installCompose } from "./compose.js?v=176761161d";
import { installKafka } from "./kafka.js?v=176761161d";

export function installDocker(api) {
  const { Shell, MemFS, registerCommand, registeredCommand, NET, addHelpers, tokenize } = api;
  const VERSION = { cli: "29.9.1", build: "dfc520d", compose: "v5.6.0", buildx: "v0.38.0", buildkit: "v0.34.0" };
  const BASE_TIME = Date.UTC(2026, 9, 17, 9, 0, 0) / 1000;      // the Docker clock starts on 17 October 2026, 09:00 UTC

  // programs and images that other parts of the sandbox add (kafka.js)
  const EXTRA = { programs: {} };

  /* ------------------------------------------------------------ small helpers */

  // a deterministic 64-character hex string for a seed (stands in for sha256 digests and IDs)
  function hex(seed, len = 64) {
    let out = "";
    let h1 = 0x811c9dc5, k = 0;
    while (out.length < len) {
      let h = h1 ^ k++;
      for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15;
      out += (h >>> 0).toString(16).padStart(8, "0");
      h1 = h;
    }
    return out.slice(0, len);
  }
  const base36 = (seed, len) => { let s = ""; const h = hex(seed, len * 2); for (let i = 0; i < len; i++) s += "abcdefghijklmnopqrstuvwxyz0123456789"[parseInt(h.slice(2 * i, 2 * i + 2), 16) % 36]; return s; };
  const uuid = (seed) => { const h = hex(seed, 32); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; };
  const short = (id) => id.replace(/^sha256:/, "").slice(0, 12);
  // go-units HumanSizeWithPrecision(size, 3): decimal units, three significant digits
  function humanSize(n) {
    const units = ["B", "kB", "MB", "GB", "TB"];
    let i = 0;
    while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
    let s = Number(n.toPrecision(3)).toString();
    return s + units[i];
  }
  // BuildKit's progress bytes: "%.2f" of a binary size, like 3.85MB or 446B
  function bkBytes(n) {
    const units = ["B", "kB", "MB", "GB"];
    let i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return i === 0 ? `${n}B` : `${n.toFixed(2)}${units[i]}`;
  }
  // go-units HumanDuration
  function humanDuration(sec) {
    const s = Math.floor(sec);
    if (s < 1) return "Less than a second";
    if (s === 1) return "1 second";
    if (s < 60) return `${s} seconds`;
    const m = Math.floor(s / 60);
    if (m === 1) return "About a minute";
    if (m < 60) return `${m} minutes`;
    const h = Math.floor(s / 3600 + 0.5);
    if (h === 1) return "About an hour";
    if (h < 48) return `${h} hours`;
    if (h < 24 * 7 * 2) return `${Math.floor(h / 24)} days`;
    if (h < 24 * 30 * 2) return `${Math.floor(h / 24 / 7)} weeks`;
    if (h < 24 * 365 * 2) return `${Math.floor(h / 24 / 30)} months`;
    return `${Math.floor(sec / 3600 / 24 / 365)} years`;
  }
  // Go's text/tabwriter as the docker CLI uses it: minwidth 10, padding 3; the last column isn't padded
  function table(rows) {
    const len = (s) => [...String(s)].length;
    const cols = Math.max(...rows.map((r) => r.length));
    const widths = [];
    for (let c = 0; c < cols - 1; c++) widths[c] = Math.max(10, ...rows.map((r) => (r[c] === undefined ? 0 : len(r[c]) + 3)));
    return rows.map((r) => r.map((cell, c) => (c < r.length - 1 ? String(cell) + " ".repeat(widths[c] - len(cell)) : String(cell))).join("")).join("\n") + "\n";
  }
  const shq = (a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`);
  const iso = (t) => new Date(t * 1000).toISOString().replace(/\.\d{3}Z$/, `.${String(Math.floor((t % 1) * 1e9) || 123456789).padStart(9, "0")}Z`);
  const textBytes = (s) => new TextEncoder().encode(s).length;

  /* ------------------------------------------------------------ the official images the sandbox knows (Docker Hub, 17 October 2026, linux/amd64) */

  const BUSYBOX = ["sh", "ash", "ls", "cat", "echo", "env", "printenv", "pwd", "mkdir", "rm", "rmdir", "cp", "mv", "touch", "head", "tail", "wc", "grep", "sed", "sort", "uniq", "cut", "tr", "date", "sleep", "whoami", "id", "hostname", "ps", "wget", "chmod", "basename", "dirname", "find", "du", "df", "free", "kill", "nc", "tee", "xargs", "vi", "less", "printf", "test", "uname", "nproc", "chown", "chgrp", "ln", "stat", "which"];
  const COREUTILS = ["sh", "bash", "dash", "ls", "cat", "echo", "env", "printenv", "pwd", "mkdir", "rm", "rmdir", "cp", "mv", "touch", "head", "tail", "wc", "grep", "sed", "sort", "uniq", "cut", "tr", "date", "sleep", "whoami", "id", "hostname", "chmod", "basename", "dirname", "find", "du", "df", "kill", "tee", "xargs", "printf", "test", "uname", "nproc", "chown", "chgrp", "ln", "stat", "which"];
  const NODE_BINS = ["node", "npm", "npx", "corepack", "docker-entrypoint.sh"];
  const ALPINE_RELEASE = "3.24.2";
  const osRelease = {
    alpine: `NAME="Alpine Linux"\nID=alpine\nVERSION_ID=${ALPINE_RELEASE}\nPRETTY_NAME="Alpine Linux v3.24"\nHOME_URL="https://alpinelinux.org/"\nBUG_REPORT_URL="https://gitlab.alpinelinux.org/alpine/aports/-/issues"\n`,
    bookworm: `PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"\nNAME="Debian GNU/Linux"\nVERSION_ID="12"\nVERSION="12 (bookworm)"\nVERSION_CODENAME=bookworm\nID=debian\nHOME_URL="https://www.debian.org/"\nSUPPORT_URL="https://www.debian.org/support"\nBUG_REPORT_URL="https://bugs.debian.org/"\n`,
  };
  const NODE_ENTRYPOINT = `#!/bin/sh\nset -e\n\n# Run command with node if the first argument contains a "-" or is not a system command. The last\n# part inside the "{}" is a workaround for the following bug in ash/dash:\n# https://bugs.debian.org/cgi-bin/bugreport.cgi?bug=874264\nif [ "\${1#-}" != "\${1}" ] || [ -z "$(command -v "\${1}")" ] || { [ -f "\${1}" ] && ! [ -x "\${1}" ]; }; then\n  set -- node "$@"\nfi\n\nexec "$@"\n`;
  const NGINX_INDEX = `<!DOCTYPE html>\n<html>\n<head>\n<title>Welcome to nginx!</title>\n<style>\nhtml { color-scheme: light dark; }\nbody { width: 35em; margin: 0 auto;\nfont-family: Tahoma, Verdana, Arial, sans-serif; }\n</style>\n</head>\n<body>\n<h1>Welcome to nginx!</h1>\n<p>If you see this page, nginx is successfully installed and working.\nFurther configuration is required for the web server, reverse proxy, \nAPI gateway, load balancer, content cache, or other features.</p>\n\n<p>For online documentation and support please refer to\n<a href="https://nginx.org/">nginx.org</a>.<br/>\nTo engage with the community please visit\n<a href="https://community.nginx.org/">community.nginx.org</a>.<br/>\nFor enterprise grade support, professional services, additional \nsecurity features and capabilities please refer to\n<a href="https://f5.com/nginx">f5.com/nginx</a>.</p>\n\n<p><em>Thank you for using nginx.</em></p>\n</body>\n</html>\n`;
  const NGINX_50X = `<!DOCTYPE html>\n<html>\n<head>\n<title>Error</title>\n<style>\nhtml { color-scheme: light dark; }\nbody { width: 35em; margin: 0 auto;\nfont-family: Tahoma, Verdana, Arial, sans-serif; }\n</style>\n</head>\n<body>\n<h1>An error occurred.</h1>\n<p>Sorry, the page you are looking for is currently unavailable.<br/>\nPlease try again later.</p>\n</body>\n</html>\n`;
  const PASSWD = { alpine: "root:x:0:0:root:/root:/bin/sh\nbin:x:1:1:bin:/bin:/sbin/nologin\ndaemon:x:2:2:daemon:/sbin:/sbin/nologin\nnobody:x:65534:65534:nobody:/:/sbin/nologin\n", debian: "root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nbin:x:2:2:bin:/bin:/usr/sbin/nologin\nnobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin\n" };
  const HELLO = `\nHello from Docker!\nThis message shows that your installation appears to be working correctly.\n\nTo generate this message, Docker took the following steps:\n 1. The Docker client contacted the Docker daemon.\n 2. The Docker daemon pulled the "hello-world" image from the Docker Hub.\n    (amd64)\n 3. The Docker daemon created a new container from that image which runs the\n    executable that produces the output you are currently reading.\n 4. The Docker daemon streamed that output to the Docker client, which sent it\n    to your terminal.\n\nTo try something more ambitious, you can run an Ubuntu container with:\n $ docker run -it ubuntu bash\n\nShare images, automate workflows, and more with a free Docker ID:\n https://hub.docker.com/\n\nFor more examples and ideas, visit:\n https://docs.docker.com/get-started/\n\n`;

  const nodeImage = (major, version, flavor, digest, content, unpacked, created, layers) => ({
    repo: "library/node", flavor, digest, content, unpacked, created, layers, node: major,
    os: flavor === "alpine" ? "alpine" : "bookworm",
    bins: [...(flavor === "alpine" ? BUSYBOX : COREUTILS), ...NODE_BINS, ...(flavor === "full" ? ["curl", "wget", "git", "ps", "python3", "make", "gcc"] : []), ...(major < 26 ? ["yarn"] : [])],
    users: { node: 1000 },
    config: {
      Env: ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", `NODE_VERSION=${version}`, ...(major < 26 ? ["YARN_VERSION=1.22.22"] : [])],
      Entrypoint: ["docker-entrypoint.sh"], Cmd: ["node"], WorkingDir: "", User: "",
    },
    history: flavor === "alpine" ? [
      [`ADD alpine-minirootfs-${ALPINE_RELEASE}-x86_64.tar.gz / # buildkit`, 8790000], ['CMD ["/bin/sh"]', 0],
      [`ENV NODE_VERSION=${version}`, 0],
      ["RUN /bin/sh -c addgroup -g 1000 node     && adduser -u 1000 -G node -s /bin/sh -D node     && apk add --no-cache         libstdc++     && apk add --no-cache --virtual .build-deps         curl ... # buildkit", unpacked - 8790000 - (major < 26 ? 5340000 : 0) - 388],
      ...(major < 26 ? [["ENV YARN_VERSION=1.22.22", 0], ["RUN /bin/sh -c apk add --no-cache --virtual .build-deps-yarn curl gnupg tar   && export GNUPGHOME=\"$(mktemp -d)\" ... # buildkit", 5340000]] : []),
      ["COPY docker-entrypoint.sh /usr/local/bin/ # buildkit", 388], ['ENTRYPOINT ["docker-entrypoint.sh"]', 0], ['CMD ["node"]', 0],
    ] : [
      ["# debian.sh --arch 'amd64' out/ 'bookworm' '@1759104000'", flavor === "slim" ? 74800000 : 117000000],
      ...(flavor === "full" ? [["RUN /bin/sh -c set -eux; \tapt-get update; \tapt-get install -y --no-install-recommends \t\tca-certificates \t\tcurl ... # buildkit", 23400000], ["RUN /bin/sh -c set -eux; \tapt-get update; \tapt-get install -y --no-install-recommends \t\tgit \t\tmercurial ... # buildkit", 184000000], ["RUN /bin/sh -c set -ex; \tapt-get update; \tapt-get install -y --no-install-recommends \t\tautoconf \t\tautomake ... # buildkit", 586000000]] : []),
      ["RUN /bin/sh -c groupadd --gid 1000 node   && useradd --uid 1000 --gid node --shell /bin/bash --create-home node # buildkit", 9180],
      [`ENV NODE_VERSION=${version}`, 0],
      ['RUN /bin/sh -c ARCH= OPENSSL_ARCH= && dpkgArch="$(dpkg --print-architecture)"     && case "${dpkgArch##*-}" in ... # buildkit', 192000000],
      ["ENV YARN_VERSION=1.22.22", 0],
      ['RUN /bin/sh -c set -ex   && savedAptMark="$(apt-mark showmanual)"   && apt-get update && apt-get install -y ca-certificates curl wget gnupg dirmngr --no-install-recommends ... # buildkit', 5340000],
      ["COPY docker-entrypoint.sh /usr/local/bin/ # buildkit", 388], ['ENTRYPOINT ["docker-entrypoint.sh"]', 0], ['CMD ["node"]', 0],
    ],
  });
  const HUB = {
    "library/alpine": {
      tags: { "3.24": "a", "3.24.2": "a", "3": "a", latest: "a", "3.23": "a23", "3.23.6": "a23" },
      images: {
        a: { digest: "294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6", content: 3859203, unpacked: 8790000, created: "2026-09-18T17:24:40Z", layers: [3849738], os: "alpine", bins: BUSYBOX, config: { Env: ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"], Cmd: ["/bin/sh"] }, history: [[`ADD alpine-minirootfs-${ALPINE_RELEASE}-x86_64.tar.gz / # buildkit`, 8790000], ['CMD ["/bin/sh"]', 0]] },
        a23: { digest: hex("alpine:3.23.6"), content: 3812000, unpacked: 8460000, created: "2026-09-18T17:24:12Z", layers: [3802510], os: "alpine", release: "3.23.6", bins: BUSYBOX, config: { Env: ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"], Cmd: ["/bin/sh"] }, history: [["ADD alpine-minirootfs-3.23.6-x86_64.tar.gz / # buildkit", 8460000], ['CMD ["/bin/sh"]', 0]] },
      },
    },
    "library/node": {
      tags: {
        ...Object.fromEntries(["24-alpine", "24-alpine3.24", "24.22-alpine", "24.22-alpine3.24", "24.22.0-alpine", "24.22.0-alpine3.24", "lts-alpine", "lts-alpine3.24", "krypton-alpine", "krypton-alpine3.24"].map((t) => [t, "24a"])),
        ...Object.fromEntries(["24-slim", "24-bookworm-slim", "24.22-slim", "24.22.0-slim", "24.22.0-bookworm-slim", "lts-slim", "krypton-slim"].map((t) => [t, "24s"])),
        ...Object.fromEntries(["24", "24-bookworm", "24.22", "24.22.0", "24.22.0-bookworm", "lts", "krypton", "lts-bookworm"].map((t) => [t, "24f"])),
        ...Object.fromEntries(["26-alpine", "26-alpine3.24", "26.12-alpine", "26.12.0-alpine", "26.12.0-alpine3.24", "current-alpine", "alpine", "alpine3.24"].map((t) => [t, "26a"])),
        ...Object.fromEntries(["22-alpine", "22-alpine3.24", "22.23-alpine", "22.23.3-alpine", "jod-alpine"].map((t) => [t, "22a"])),
      },
      images: {
        "24a": nodeImage(24, "24.22.0", "alpine", "44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f", 62771664, 171400000, "2026-10-14T20:38:55Z", [3849738, 57270344, 1326040, 446]),
        "24s": nodeImage(24, "24.22.0", "slim", "a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5", 81339880, 246100000, "2026-10-14T20:39:23Z", [28230124, 3318, 51428302, 1345012, 396]),
        "24f": nodeImage(24, "24.22.0", "full", "be23f54a88d34e8824c741b19b91064094f92c1c97b194144bfc8b50d67258e2", 409947012, 1131000000, "2026-10-14T20:41:02Z", [48492115, 24015823, 64394107, 211366720, 3326, 58008014, 1332641, 448]),
        "26a": nodeImage(26, "26.12.0", "alpine", "6f08a523443ddedf52941874c203475b0ad503e859ad70cb26ab8be9a517dbd5", 63229040, 173100000, "2026-10-14T20:40:51Z", [3849738, 59053772, 444]),
        "22a": nodeImage(22, "22.23.3", "alpine", hex("node:22.23.3-alpine3.24"), 55418002, 151600000, "2026-10-14T20:37:30Z", [3849738, 50238176, 1326040, 444]),
      },
    },
    "library/nginx": {
      tags: Object.fromEntries(["alpine", "1.31.7-alpine", "mainline-alpine", "1-alpine", "1.31-alpine", "1.31.7-alpine3.24", "alpine3.24"].map((t) => [t, "n"])),
      images: {
        n: { digest: "892bb2152464f0c5d8972593a5f5afaf8054552580b699d95f8ff4af08c2d33d", content: 29126702, unpacked: 79600000, created: "2026-10-15T16:51:48Z", layers: [3849738, 1801254, 628, 955, 405, 1210, 1398, 21345938], os: "alpine", nginx: true,
          bins: [...BUSYBOX, "nginx", "envsubst"],
          users: { nginx: 101 },
          config: { Env: ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", "NGINX_VERSION=1.31.7", "PKG_RELEASE=1", "DYNPKG_RELEASE=1", "NJS_VERSION=1.0.2", "NJS_RELEASE=1", "ACME_VERSION=0.4.1"], Entrypoint: ["/docker-entrypoint.sh"], Cmd: ["nginx", "-g", "daemon off;"], ExposedPorts: { "80/tcp": {} }, StopSignal: "SIGQUIT" },
          history: [[`ADD alpine-minirootfs-${ALPINE_RELEASE}-x86_64.tar.gz / # buildkit`, 8790000], ['CMD ["/bin/sh"]', 0], ["LABEL maintainer=NGINX Docker Maintainers <docker-maint@nginx.com>", 0], ["ENV NGINX_VERSION=1.31.7", 0], ["RUN /bin/sh -c set -x     && addgroup -g 101 -S nginx     && adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx ... # buildkit", 5420000], ["COPY docker-entrypoint.sh / # buildkit", 1620], ["ENTRYPOINT [\"/docker-entrypoint.sh\"]", 0], ["EXPOSE map[80/tcp:{}]", 0], ["STOPSIGNAL SIGQUIT", 0], ['CMD ["nginx" "-g" "daemon off;"]', 0], ["ENV NJS_VERSION=1.0.2", 0], ["RUN /bin/sh -c set -x     && apkArch=\"$(cat /etc/apk/arch)\" ... # buildkit", 65300000]] },
      },
    },
    "library/hello-world": {
      tags: { latest: "h", linux: "h" },
      images: { h: { digest: "5e23090353324d887c48ad5e5c56d294eab81588df9605b07d1afe895f9cc8f8", content: 13906, unpacked: 10070, created: "2026-09-10T00:41:14Z", layers: [2415], os: "scratch", bins: [], config: { Env: ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"], Cmd: ["/hello"] }, history: [["COPY hello / # buildkit", 10070], ['CMD ["/hello"]', 0]] } },
    },
  };

  // The base file system an official image starts with.
  function baseFiles(def) {
    const files = {}, dirs = ["/tmp", "/root", "/home", "/etc", "/bin", "/lib", "/media", "/mnt", "/opt", "/proc", "/run", "/sbin", "/srv", "/sys", "/dev", "/usr/bin", "/usr/lib", "/usr/sbin", "/usr/share", "/usr/local/bin", "/usr/local/lib", "/var", "/var/log", "/var/cache"];
    if (def.os === "scratch") return { files: { "/hello": "\u007fELF (the hello program)" }, dirs: ["/dev", "/proc", "/etc"] };
    files["/etc/os-release"] = def.os === "alpine" ? osRelease.alpine.replace(ALPINE_RELEASE, def.release ?? ALPINE_RELEASE) : osRelease.bookworm;
    if (def.os === "alpine") files["/etc/alpine-release"] = (def.release ?? ALPINE_RELEASE) + "\n";
    else files["/etc/debian_version"] = "12.12\n";
    let passwd = def.os === "alpine" ? PASSWD.alpine : PASSWD.debian;
    let group = "root:x:0:root\n";
    for (const [u, id] of Object.entries(def.users ?? {})) {
      const home = def.homes?.[u] ?? (u === "node" ? "/home/node" : "/var/cache/nginx");
      passwd += `${u}:x:${id}:${id}:${u === "nginx" ? "nginx" : "Linux User,,,"}:${home}:${u === "nginx" ? "/sbin/nologin" : def.shells?.[u] ?? (def.os === "alpine" ? "/bin/sh" : "/bin/bash")}\n`;
      group += `${u}:x:${id}:${u}\n`;
      dirs.push(home);
    }
    files["/etc/passwd"] = passwd;
    files["/etc/group"] = group;
    for (const b of def.bins) files[(def.binDirs?.[b] ?? (["node", "npm", "npx", "corepack", "docker-entrypoint.sh", "yarn"].includes(b) ? "/usr/local/bin/" : "/bin/")) + b] = b === "docker-entrypoint.sh" ? NODE_ENTRYPOINT : `(the ${b} program)`;
    if (def.node) {
      files["/usr/local/lib/node_modules/npm/package.json"] = `{\n  "name": "npm",\n  "version": "${{ 22: "10.9.9", 24: "11.19.1", 26: "11.20.0" }[def.node]}"\n}\n`;
      if (def.node < 26) dirs.push("/opt/yarn-v1.22.22");
    }
    if (def.files) Object.assign(files, typeof def.files === "function" ? def.files() : def.files);
    if (def.dirs) dirs.push(...def.dirs);
    if (def.nginx) {
      files["/usr/share/nginx/html/index.html"] = NGINX_INDEX;
      files["/usr/share/nginx/html/50x.html"] = NGINX_50X;
      files["/etc/nginx/nginx.conf"] = "\nuser  nginx;\nworker_processes  auto;\n\nerror_log  /var/log/nginx/error.log notice;\npid        /run/nginx.pid;\n\n\nevents {\n    worker_connections  1024;\n}\n\n\nhttp {\n    include       /etc/nginx/mime.types;\n    default_type  application/octet-stream;\n\n    log_format  main  '$remote_addr - $remote_user [$time_local] \"$request\" '\n                      '$status $body_bytes_sent \"$http_referer\" '\n                      '\"$http_user_agent\" \"$http_x_forwarded_for\"';\n\n    access_log  /var/log/nginx/access.log  main;\n\n    sendfile        on;\n    #tcp_nopush     on;\n\n    keepalive_timeout  65;\n\n    #gzip  on;\n\n    include /etc/nginx/conf.d/*.conf;\n}\n";
      files["/etc/nginx/conf.d/default.conf"] = "server {\n    listen       80;\n    listen  [::]:80;\n    server_name  localhost;\n\n    location / {\n        root   /usr/share/nginx/html;\n        index  index.html index.htm;\n    }\n\n    error_page   500 502 503 504  /50x.html;\n    location = /50x.html {\n        root   /usr/share/nginx/html;\n    }\n}\n";
      files["/docker-entrypoint.sh"] = "#!/bin/sh\n# vim:sw=4:ts=4:et\n\nset -e\n";
      dirs.push("/docker-entrypoint.d", "/var/cache/nginx", "/var/log/nginx");
    }
    return { files, dirs };
  }
  function nodesFrom({ files, dirs }) {
    const fs = new MemFS();
    for (const d of dirs) fs.nodes.set(d, null);
    const all = new Map([["/", { type: "dir", mtime: 1, mode: 0o40755 }]]);
    const addDir = (d) => { if (d === "/" || all.has(d)) return; addDir(d.slice(0, d.lastIndexOf("/")) || "/"); all.set(d, { type: "dir", mtime: 1, mode: d === "/tmp" ? 0o41777 : 0o40755, ino: all.size + 1 }); };
    for (const d of dirs) addDir(d);
    for (const [p, text] of Object.entries(files)) {
      addDir(p.slice(0, p.lastIndexOf("/")) || "/");
      all.set(p, { type: "file", data: new TextEncoder().encode(text), mtime: 1, mode: /\/(s?bin)\//.test(p) || p.endsWith(".sh") || p === "/hello" ? 0o100755 : 0o100644, ino: all.size + 1 });
    }
    return all;
  }

  /* ------------------------------------------------------------ the engine: one per machine (the sandbox's terminal, each CI runner) */

  function engine(sh) {
    if (sh.container) return sh.container.engine;
    if (!sh.docker) {
      sh.docker = {
        owner: sh, images: new Map(), tags: new Map(), containers: new Map(), networks: new Map(), volumes: new Map(),
        cache: new Map(), content: new Set(), auth: {}, ticks: 0, counter: 0, builder: { name: "default", driver: "docker" },
        lastBuild: null,
      };
      const e = sh.docker;
      e.networks.set("bridge", { name: "bridge", id: hex("net:bridge"), driver: "bridge", subnet: "172.17.0.0/16", gateway: "172.17.0.1", prefix: "172.17.0.", next: 2, builtin: true, created: BASE_TIME - 86400 * 3 });
      e.networks.set("host", { name: "host", id: hex("net:host"), driver: "host", builtin: true, created: BASE_TIME - 86400 * 3 });
      e.networks.set("none", { name: "none", id: hex("net:none"), driver: "null", builtin: true, created: BASE_TIME - 86400 * 3 });
    }
    return sh.docker;
  }
  const now = (e) => BASE_TIME + e.ticks + (e.owner.slept ?? 0);
  const tick = (e, n = 1) => { e.ticks += n; };
  // the shared registries (Docker Hub and ghcr.io): every machine in the sandbox sees the same ones
  const registries = (fs) => (fs.registries ??= {});

  // "node:24-alpine" → { registry, path, tag, full, familiar }
  function parseRef(ref) {
    let s = String(ref);
    let digest = null;
    const at = s.indexOf("@");
    if (at >= 0) { digest = s.slice(at + 1).replace(/^sha256:/, ""); s = s.slice(0, at); }
    let registry = "docker.io";
    const first = s.split("/")[0];
    if (s.includes("/") && (first.includes(".") || first.includes(":") || first === "localhost")) { registry = first; s = s.slice(first.length + 1); }
    let tag = "latest";
    const colon = s.lastIndexOf(":");
    if (colon > 0) { tag = s.slice(colon + 1); s = s.slice(0, colon); }
    let path = s;
    if (registry === "docker.io" && !path.includes("/")) path = "library/" + path;
    const valid = /^[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*(?:\/[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*)*$/.test(path) && /^[\w][\w.-]{0,127}$/.test(tag);
    const familiarRepo = registry === "docker.io" ? path.replace(/^library\//, "") : `${registry}/${path}`;
    return { registry, path, tag, digest, valid, repo: `${registry}/${path}`, full: `${registry}/${path}:${tag}`, familiar: `${familiarRepo}:${tag}`, familiarRepo };
  }
  const imageOf = (e, ref) => {
    const r = parseRef(ref);
    if (r.digest) { for (const img of e.images.values()) if (img.id.startsWith(r.digest)) return img; return null; }
    const id = e.tags.get(r.full);
    if (id) return e.images.get(id) ?? null;
    // an image ID or a unique prefix of one
    if (/^[0-9a-f]{4,64}$/.test(String(ref).replace(/^sha256:/, ""))) {
      const p = String(ref).replace(/^sha256:/, "");
      const hits = [...e.images.values()].filter((i) => i.id.startsWith(p));
      if (hits.length === 1) return hits[0];
    }
    return null;
  };
  const tagsOf = (e, img) => [...e.tags.entries()].filter(([, id]) => id === img.id).map(([full]) => parseRef(full).familiar).sort();
  function setTag(e, ref, img) {
    const r = parseRef(ref);
    const old = e.tags.get(r.full);
    e.tags.set(r.full, img.id);
    if (old && old !== img.id) {
      const oi = e.images.get(old);
      if (oi) oi.untaggedAt = now(e);
    }
  }

  // an official image from Docker Hub, as an image record
  function hubImage(r) {
    const repo = HUB[r.path];
    if (!repo || r.registry !== "docker.io") return null;
    const key = repo.tags[r.tag];
    if (!key) return { repoExists: true };
    const def = repo.images[key];
    return { def, record: imageFromDef(def, r) };
  }
  function imageFromDef(def, r) {
    const created = Date.parse(def.created) / 1000;
    return {
      id: def.digest, created, os: "linux", arch: "amd64", nodes: nodesFrom(baseFiles(def)), bins: def.bins, nodeMajor: def.node ?? null,
      osName: def.os, users: def.users ?? {},
      config: { Env: [...def.config.Env], Cmd: def.config.Cmd ?? null, Entrypoint: def.config.Entrypoint ?? null, WorkingDir: def.config.WorkingDir ?? "", User: def.config.User ?? "", ExposedPorts: def.config.ExposedPorts ?? null, Labels: def.config.Labels ?? null, StopSignal: def.config.StopSignal, Healthcheck: null, Volumes: def.config.Volumes ?? null },
      // images built on the same Alpine release share its base layer, so it downloads once
      layers: def.layers.map((size, i) => ({ digest: i === 0 && def.os === "alpine" ? hex(`alpine-minirootfs-${def.release ?? ALPINE_RELEASE}`) : hex(`${r.path}:${def.digest}:layer${i}`), size })),
      history: def.history.map(([createdBy, size], i) => ({ createdBy, size, created: created - (def.history.length - i) * 30 })),
      content: def.content, unpacked: def.unpacked, attest: true, nginx: !!def.nginx, hello: def.os === "scratch",
      source: r.full, repoDigest: `${r.familiarRepo}@sha256:${def.digest}`,
    };
  }
  // pull an image into the engine; out(line) prints like docker pull; returns the image or an error message
  function pull(e, ref, out, { quiet = false } = {}) {
    const r = parseRef(ref);
    if (!r.valid) return { error: `invalid reference format: repository name (${r.path}) must be lowercase` };
    let rec = null, layerSizes = null;
    if (r.registry === "docker.io" && (r.path.startsWith("library/") || HUB[r.path])) {
      const h = hubImage(r);
      if (!h) return { error: `pull access denied for ${r.familiarRepo}, repository does not exist or may require 'docker login'` };
      if (h.repoExists) return { error: `failed to resolve reference "${r.full}": ${r.full}: not found` };
      rec = h.record;
    } else {
      const reg = registries(e.owner.fs)[r.repo];
      if (!reg) {
        if (r.registry === "ghcr.io") return { error: e.auth["ghcr.io"] ? `failed to resolve reference "${r.full}": ${r.full}: not found` : `failed to resolve reference "${r.full}": failed to authorize: failed to fetch anonymous token: unexpected status from GET request to https://ghcr.io/token?scope=repository%3A${r.path.replace(/\//g, "%2F")}%3Apull&service=ghcr.io: 403 Forbidden` };
        return { error: `pull access denied for ${r.familiarRepo}, repository does not exist or may require 'docker login'` };
      }
      const login = e.auth[r.registry];
      if (reg.visibility === "private" && !(login && (login.user === reg.owner || login.token.startsWith("ghs_")))) {
        return { error: `failed to resolve reference "${r.full}": failed to authorize: failed to fetch anonymous token: unexpected status from GET request to https://ghcr.io/token?scope=repository%3A${r.path.replace(/\//g, "%2F")}%3Apull&service=ghcr.io: 403 Forbidden` };
      }
      const id = reg.tags[r.tag];
      if (!id) return { error: `failed to resolve reference "${r.full}": ${r.full}: not found` };
      rec = { ...reg.images[id], nodes: new Map(reg.images[id].nodes), repoDigest: `${r.familiarRepo}@sha256:${id}` };
    }
    layerSizes = rec.layers;
    const existing = e.images.get(rec.id);
    if (!quiet) out(`${r.tag}: Pulling from ${r.registry === "docker.io" ? r.path : r.path}`);
    if (existing && e.tags.get(r.full) === rec.id) {
      if (!quiet) { out(`Digest: sha256:${rec.id}`); out(`Status: Image is up to date for ${r.familiar}`); }
      return { image: existing, fresh: false };
    }
    for (const l of layerSizes) {
      const have = e.content.has(l.digest);
      if (!quiet) out(`${l.digest.slice(0, 12)}: ${have ? "Already exists" : "Pull complete"}`);
      e.content.add(l.digest);
    }
    if (!quiet) { out(`Digest: sha256:${rec.id}`); out(`Status: Downloaded newer image for ${r.familiar}`); }
    const img = existing ?? { ...rec, pulledAt: now(e) };
    e.images.set(img.id, img);
    setTag(e, ref, img);
    return { image: img, fresh: true };
  }

  /* ------------------------------------------------------------ the network */

  const LOOPBACK = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);
  // a shell's network namespace: the host's (the sandbox terminal, a CI runner) or a container's
  NET.ns = (sh) => (sh.container ? sh.container.netns : (sh.netns ??= { kind: "host", listeners: new Map() }));
  function containerByName(e, from, host) {
    const nets = Object.keys(from.networks);
    for (const c of e.containers.values()) {
      if (c.state !== "running" && c.state !== "restarting") continue;
      for (const n of nets) {
        const ep = c.networks[n];
        if (!ep) continue;
        const userNet = n !== "bridge";
        if (ep.ip === host) return c;
        if (userNet && (c.name === host || ep.aliases.includes(host) || c.id.startsWith(host) && host.length >= 12)) return c;
      }
    }
    return null;
  }
  // One HTTP request from a shell. Returns { status, statusMessage, headers, body } or { error, ... }.
  NET.request = async (sh, { url, method = "GET", headers = {}, body = "", userAgent = "node" }) => {
    const m = /^(https?):\/\/(\[[^\]]+\]|[^/:?#]+)(?::(\d+))?([^?#]*)(\?[^#]*)?/i.exec(url);
    if (!m) return { error: "url" };
    const [, scheme, rawHost, portStr, path = "", query = ""] = m;
    const host = rawHost.toLowerCase();
    const port = Number(portStr ?? (scheme === "https" ? 443 : 80));
    const e = engine(sh);
    const from = NET.ns(sh);
    let target = null, ns = null, viaProxy = false, ip = host;
    if (from.kind === "host") {
      if (!LOOPBACK.has(host)) return { error: "dns", host };
      if (from.listeners.has(port)) ns = from;
      else {
        for (const c of e.containers.values()) {
          if (c.state !== "running") continue;
          const p = c.ports.find((x) => x.hostPort === port);
          if (p) { target = c; ns = c.netns; viaProxy = true; ip = Object.values(c.networks)[0]?.ip; return deliver(p.containerPort); }
        }
        return { error: "refused", host, port };
      }
    } else {
      const self = from.container;
      if (LOOPBACK.has(host) || host === self.hostname) { ns = from; target = self; }
      else {
        const c = containerByName(e, self, host);
        if (!c) {
          // names resolve only on user-defined networks; IP addresses work on any shared network
          return { error: "dns", host };
        }
        target = c; ns = c.netns; ip = Object.values(c.networks).find((x) => x)?.ip;
      }
      if (scheme === "https") return { error: "tls", host, port };
    }
    return deliver(port);

    async function deliver(p) {
      const lst = ns.listeners.get(p);
      const sameNs = ns === from;
      if (!lst || (lst.host && LOOPBACK.has(lst.host) && !sameNs)) return viaProxy ? { error: "reset", host, port } : { error: "refused", ip, port: p, host };
      if (target) syncIn(target);
      const remote = from.kind === "host" ? "172.17.0.1" : sameNs ? "127.0.0.1" : Object.values(from.container.networks)[0]?.ip ?? "172.18.0.1";
      const hdrs = { Host: portStr ? `${rawHost}:${portStr}` : rawHost, "User-Agent": userAgent, Accept: "*/*", ...headers };
      if (body) hdrs["Content-Length"] = String(textBytes(body));
      const r = await lst.handle({ method, url: (path || "/") + query, headers: hdrs, body, remote, now: now(e) });
      if (target) { syncOut(target); await settle(e); }
      return r;
    }
  };

  /* ------------------------------------------------------------ curl and wget */

  const githubCurl = registeredCommand("curl");
  registerCommand("curl", async (sh, args, io) => {
    const flat = args.flatMap((a) => (/^-[a-zA-Z]{2,}$/.test(a) ? a.slice(1).split("").map((c) => "-" + c) : [a]));
    const url = flat.find((a, i) => !a.startsWith("-") && !["-X", "--request", "-H", "--header", "-d", "--data", "-o", "--output", "-w", "--write-out", "--json", "-m", "--max-time", "--retry", "-u", "--data-raw"].includes(flat[i - 1]));
    if (url && /^(https?:\/\/)?[a-z0-9-]+\.github\.io\b/i.test(url)) return githubCurl(sh, args.map((a) => (a === url && !/^https?:/.test(a) ? "https://" + a : a)), io);
    if (!url) { io.err("curl: try 'curl --help' or 'curl --manual' for more information\n"); return 2; }
    const target = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : "http://" + url;
    const o = { headers: {}, method: null, data: null };
    for (let i = 0; i < flat.length; i++) {
      const a = flat[i];
      if (a === "-X" || a === "--request") o.method = flat[++i];
      else if (a === "-H" || a === "--header") { const h = flat[++i] ?? ""; const k = h.indexOf(":"); if (k > 0) o.headers[h.slice(0, k).trim()] = h.slice(k + 1).trim(); }
      else if (a === "-d" || a === "--data" || a === "--data-raw") o.data = flat[++i] ?? "";
      else if (a === "--json") { o.data = flat[++i] ?? ""; o.headers["Content-Type"] = "application/json"; o.headers.Accept = "application/json"; }
      else if (a === "-o" || a === "--output") o.output = flat[++i];
      else if (a === "-w" || a === "--write-out") o.write = flat[++i];
      else if (a === "-m" || a === "--max-time" || a === "--retry" || a === "-u") i++;
      else if (a === "-s" || a === "--silent") o.silent = true;
      else if (a === "-S" || a === "--show-error") o.showError = true;
      else if (a === "-f" || a === "--fail") o.fail = true;
      else if (a === "--fail-with-body") o.failBody = true;
      else if (a === "-i" || a === "--include") o.include = true;
      else if (a === "-I" || a === "--head") { o.head = true; o.method = o.method ?? "HEAD"; }
      else if (a === "-L" || a === "--location" || a === "-v" || a === "--verbose") { /* nothing to follow in the sandbox */ }
    }
    if (o.data !== null && !o.headers["Content-Type"]) o.headers["Content-Type"] = "application/x-www-form-urlencoded";
    const method = o.method ?? (o.data !== null ? "POST" : "GET");
    const showErr = !o.silent || o.showError;
    const r = await NET.request(sh, { url: target, method, headers: o.headers, body: o.data ?? "", userAgent: "curl/8.5.0" });
    const hostOf = (/^[a-z]+:\/\/(\[[^\]]+\]|[^/:?#]+)/i.exec(target) ?? [])[1] ?? url;
    const portOf = Number((/^[a-z]+:\/\/(?:\[[^\]]+\]|[^/:?#]+):(\d+)/i.exec(target) ?? [])[1] ?? (target.startsWith("https") ? 443 : 80));
    const fail = (code, msg) => { if (showErr) io.err(`curl: (${code}) ${msg}\n`); if (o.write) io.out(o.write.replace(/%\{http_code\}/g, "000").replace(/\\n/g, "\n")); return code; };
    if (r.error === "url") return fail(3, `URL rejected: Malformed input to a URL function`);
    if (r.error === "dns") return fail(6, `Could not resolve host: ${hostOf}${sh.container ? "" : (LOOPBACK.has(hostOf) ? "" : "")}`);
    if (r.error === "refused") return fail(7, `Failed to connect to ${hostOf} port ${portOf} after 0 ms: Couldn't connect to server`);
    if (r.error === "reset") return fail(56, "Recv failure: Connection reset by peer");
    if (r.error === "empty") return fail(52, "Empty reply from server");
    if (r.error === "timeout") return fail(28, `Operation timed out after 300000 milliseconds with 0 bytes received`);
    if (r.error === "tls") return fail(35, "OpenSSL/3.0.13: error:0A00010B:SSL routines::wrong version number");
    const head = `HTTP/1.1 ${r.status} ${r.statusMessage}\r\n${r.headers.map(([k, v]) => `${k}: ${v}\r\n`).join("")}\r\n`;
    if (r.status >= 400 && (o.fail || o.failBody)) {
      if (o.failBody) io.out(r.body);
      if (showErr) io.err(`curl: (22) The requested URL returned error: ${r.status}\n`);
      return 22;
    }
    const text = o.head ? head : (o.include ? head : "") + r.body;
    if (o.output) await sh.fs.writeFile(sh.abs(o.output), r.body);
    else io.out(text);
    if (o.write) io.out(o.write.replace(/%\{http_code\}/g, String(r.status)).replace(/%\{content_type\}/g, r.headers.find(([k]) => k.toLowerCase() === "content-type")?.[1] ?? "").replace(/\\n/g, "\n"));
    return 0;
  });

  // BusyBox wget (alpine images have it; they don't have curl)
  registerCommand("wget", async (sh, args, io) => {
    let quiet = false, out = null, spider = false, url = null;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-q" || a === "--quiet") quiet = true;
      else if (a === "-O") out = args[++i];
      else if (a.startsWith("-O")) out = a.slice(2);
      else if (a === "-qO-" || a === "-qO") { quiet = true; out = a === "-qO-" ? "-" : args[++i]; }
      else if (a === "--spider") spider = true;
      else if (a === "-T" || a === "--timeout" || a === "-t" || a === "--tries") i++;
      else if (/^-/.test(a)) { if (a.includes("q")) quiet = true; if (a.endsWith("O")) out = args[++i]; else if (a.includes("O-")) out = "-"; }
      else url = a;
    }
    if (!url) { io.err("BusyBox v1.37.0 (2026-04-14 10:02:39 UTC) multi-call binary.\n\nUsage: wget [-cqS] [--spider] [-O FILE] [-o LOGFILE] [--header STR]\n\t[--post-data STR | --post-file FILE] [-Y on/off]\n\t[-P DIR] [-U AGENT] [-T SEC] URL...\n"); return 1; }
    if (!/^https?:\/\//.test(url)) url = "http://" + url;
    const m = /^https?:\/\/([^/:?#]+)(?::(\d+))?/.exec(url);
    const host = m[1], port = m[2] ?? "80";
    const r = await NET.request(sh, { url, method: spider ? "HEAD" : "GET", userAgent: "Wget" });
    const ipOf = LOOPBACK.has(host) ? "127.0.0.1" : r.ip ?? host;
    if (r.error === "dns") { io.err(`wget: bad address '${host}'\n`); return 1; }
    if (!quiet) io.err(`Connecting to ${host}:${port} (${ipOf}:${port})\n`);
    if (r.error === "refused") { io.err(`wget: can't connect to remote host (${ipOf}): Connection refused\n`); return 1; }
    if (r.error) { io.err("wget: error getting response: Connection reset by peer\n"); return 1; }
    if (r.status >= 400) { io.err(`wget: server returned error: HTTP/1.1 ${r.status} ${r.statusMessage}\n`); return 1; }
    if (spider) { if (!quiet) io.err("remote file exists\n"); return 0; }
    const file = out ?? ((url.replace(/[?#].*$/, "").split("/").pop()) || "index.html");
    if (file === "-") {
      if (!quiet) io.err("writing to stdout\n");
      io.out(r.body);
      if (!quiet) io.err(`-                    100% |********************************| ${textBytes(r.body)}  0:00:00 ETA\nwritten to stdout\n`);
    } else {
      if (sh.fs.exists(sh.abs(file)) && !out) { io.err(`wget: can't open '${file}': File exists\n`); return 1; }
      await sh.fs.writeFile(sh.abs(file), r.body);
      if (!quiet) io.err(`saving to '${file}'\n${file.padEnd(20)} 100% |********************************| ${textBytes(r.body)}  0:00:00 ETA\n'${file}' saved\n`);
    }
    return 0;
  });

  /* ------------------------------------------------------------ who am I (inside containers too) */

  const userOf = (sh) => (sh.container ? sh.user ?? { name: "root", uid: 0 } : { name: sh.env.USER ?? "learner", uid: sh.env.USER === "runner" ? 1001 : 1000 });
  registerCommand("whoami", async (sh, args, io) => { const u = userOf(sh); if (u.name === null) { io.err(`whoami: unknown uid ${u.uid}\n`); return 1; } io.out(u.name + "\n"); return 0; });
  registerCommand("id", async (sh, args, io) => {
    const u = userOf(sh);
    if (u.uid === 0 && sh.container) io.out(sh.container.osName === "alpine" ? "uid=0(root) gid=0(root) groups=0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel),11(floppy),20(dialout),26(tape),27(video)\n" : "uid=0(root) gid=0(root) groups=0(root)\n");
    else if (u.name === null) io.out(`uid=${u.uid} gid=${u.uid} groups=${u.uid}\n`);
    else io.out(`uid=${u.uid}(${u.name}) gid=${u.uid}(${u.name}) groups=${u.uid}(${u.name})\n`);
    return 0;
  });
  // file owners: the sandbox's file system doesn't track them, so chown only checks its arguments
  registerCommand("chown", async (sh, args, io) => {
    const rest = args.filter((a) => !a.startsWith("-"));
    if (rest.length < 2) { io.err("chown: missing operand\n"); return 1; }
    const user = rest[0].split(":")[0];
    const passwd = sh.fs.text("/etc/passwd");
    if (passwd !== null && user && !/^\d+$/.test(user) && !passwd.split("\n").some((l) => l.split(":")[0] === user)) { io.err(`chown: unknown user ${user}\n`); return 1; }
    for (const f of rest.slice(1)) if (!sh.fs.exists(sh.abs(f))) { io.err(`chown: ${f}: No such file or directory\n`); return 1; }
    for (const f of rest.slice(1)) { const n = sh.fs.get(sh.abs(f)); if (n && user) n.owner = user; }
    return 0;
  });
  registerCommand("hostname", async (sh, args, io) => { io.out((sh.container ? sh.container.hostname : sh.env.USER === "runner" ? "runnervm6qbrg" : "sandbox") + "\n"); return 0; });
  registerCommand("uname", async (sh, args, io) => { io.out(args.includes("-a") ? `Linux ${sh.container ? sh.container.hostname : "sandbox"} 6.12.54-linuxkit #1 SMP PREEMPT_DYNAMIC x86_64 Linux\n` : args.includes("-m") ? "x86_64\n" : args.includes("-r") ? "6.12.54-linuxkit\n" : "Linux\n"); return 0; });
  registerCommand("nproc", async (sh, args, io) => { io.out(`${sh.container?.cpus ? Math.ceil(sh.container.cpus) : 4}\n`); return 0; });
  registerCommand("ps", async (sh, args, io) => {
    const c = sh.container;
    if (!c) { io.out("    PID TTY          TIME CMD\n   4242 pts/0    00:00:00 bash\n   4318 pts/0    00:00:00 ps\n"); return 0; }
    const procs = c.procs.filter((p) => !p.ended).sort((a, b) => a.pid - b.pid);
    if (c.osName === "alpine") io.out("PID   USER     TIME  COMMAND\n" + procs.map((p) => `${String(p.pid).padStart(5)} ${String(p.user).padEnd(8).slice(0, 8)}  0:00 ${p.cmd}`).join("\n") + "\n");
    else io.out("    PID TTY          TIME CMD\n" + procs.map((p) => `${String(p.pid).padStart(7)} ?        00:00:00 ${p.cmd.split(" ")[0].split("/").pop()}`).join("\n") + "\n");
    return 0;
  });

  /* ------------------------------------------------------------ containers */

  const ADJ = ["admiring", "affectionate", "agitated", "amazing", "angry", "awesome", "blissful", "bold", "brave", "charming", "clever", "compassionate", "confident", "cool", "dazzling", "determined", "dreamy", "eager", "ecstatic", "elegant", "eloquent", "epic", "festive", "focused", "friendly", "funny", "gallant", "gifted", "goofy", "gracious", "happy", "hopeful", "hungry", "inspiring", "jolly", "jovial", "keen", "kind", "laughing", "loving", "lucid", "magical", "modest", "musing", "nice", "nifty", "nostalgic", "optimistic", "peaceful", "pensive", "practical", "quirky", "relaxed", "romantic", "serene", "sharp", "sleepy", "stoic", "sweet", "tender", "upbeat", "vibrant", "vigilant", "wizardly", "wonderful", "youthful", "zealous", "zen"];
  const SCI = ["albattani", "allen", "archimedes", "babbage", "banach", "bhabha", "bose", "brahmagupta", "chandrasekhar", "curie", "darwin", "dijkstra", "einstein", "euler", "feynman", "franklin", "galileo", "goldberg", "goodall", "hamilton", "hodgkin", "hopper", "hypatia", "johnson", "kalam", "keller", "lamarr", "lovelace", "meitner", "mirzakhani", "noether", "pasteur", "raman", "ramanujan", "ritchie", "sammet", "shannon", "swartz", "tesla", "torvalds", "turing", "wilson", "wozniak", "yalow"];
  const randomName = (e) => { const n = e.counter * 7 + 3; return `${ADJ[n % ADJ.length]}_${SCI[(n * 5 + 1) % SCI.length]}`; };

  const parseEnvList = (list) => Object.fromEntries((list ?? []).map((kv) => { const i = kv.indexOf("="); return i < 0 ? [kv, ""] : [kv.slice(0, i), kv.slice(i + 1)]; }));

  // Make a shell that runs inside a file system with an image's programs (containers and RUN steps share this).
  function makeShell(owner, { fs, env, cwd, user, bins, osName, nodeMajor, container = null }) {
    const csh = new Shell();
    csh.fs = fs;
    csh.env = { ...env };
    csh.cwd = cwd || "/";
    csh.globalConfig = new Map();
    csh.commands = new Set(bins);
    csh.nodeMajor = nodeMajor ?? 24;
    csh.container = container;
    csh.user = user;
    csh.gitVersion = owner.gitVersion;
    csh.notFound = (cmd) => (osName === "alpine" ? `sh: ${cmd}: not found\n` : `/bin/sh: 1: ${cmd}: not found\n`);
    // ls -l the way BusyBox (Alpine) or GNU coreutils (Debian) prints it, with the owners chown set
    csh.longLine = (full, name) => {
      const n = fs.get(full);
      const dir = n.type === "dir";
      const mode = dir ? 0o755 : n.mode & 0o777;
      const bits = [6, 3, 0].map((sft) => { const b = (mode >> sft) & 7; return (b & 4 ? "r" : "-") + (b & 2 ? "w" : "-") + (b & 1 ? "x" : "-"); }).join("");
      const owner = n.owner ?? "root";
      const size = dir ? 4096 : n.data.length;
      const when = owner === "root" && (n.mtime ?? 1) <= 1 ? "Oct 14 20:38" : "Oct 17 09:00";
      return osName === "alpine"
        ? `${dir ? "d" : "-"}${bits}    ${dir ? 2 : 1} ${owner.padEnd(8)} ${owner.padEnd(8)} ${String(size).padStart(9)} ${when} ${name}\n`
        : `${dir ? "d" : "-"}${bits} ${dir ? 2 : 1} ${owner} ${owner} ${String(size).padStart(4)} ${when} ${name}\n`;
    };
    csh.programs = {
      "docker-entrypoint.sh": async (s, args, io) => {
        // the node image's entrypoint: put node in front of arguments that aren't commands
        let a = args;
        if (!a.length || a[0].startsWith("-") || !s.commands.has(a[0]) && !a[0].includes("/") || /\.m?js$/.test(a[0])) a = ["node", ...a];
        return s.runScript(a.map(shq).join(" "), { echo: false, errexit: false });
      },
      npm: npmIn,
      // node with no script reads its program from stdin; a container's stdin is empty, so it just ends
      node: async (s, args, io) => (args.length ? nodeCmd(s, args, io) : 0),
      "/hello": async (s, args, io) => { io.out(HELLO); return 0; },
      ...EXTRA.programs,
    };
    // a shell with no script reads commands from stdin; a container's stdin is empty, so it ends at once
    for (const name of ["sh", "/bin/sh", "ash", "bash", "/bin/bash"]) {
      if (name.includes("bash") && !csh.commands.has("bash")) continue;
      csh.programs[name] = async (s, args) => (args.length ? null : 0);
    }
    return csh;
  }
  // npm inside an image: installing packages needs the internet, which the sandbox doesn't have
  const npmCmd = registeredCommand("npm");
  const nodeCmd = registeredCommand("node");
  async function npmIn(sh, args, io) {
    // npm ci --omit=dev skips devDependencies, so a project whose only dependencies are for development installs nothing
    if (["ci", "install", "i"].includes(args[0]) && args.includes("--omit=dev")) {
      const pkgText = sh.fs.text(sh.cwd + "/package.json");
      let pkg = null;
      try { pkg = JSON.parse(pkgText ?? ""); } catch { /* npm reports it */ }
      if (pkg && !Object.keys(pkg.dependencies ?? {}).length && (args[0] !== "ci" || sh.fs.exists(sh.cwd + "/package-lock.json"))) {
        io.out(`\nup to date, audited 1 package in ${80 + (pkgText.length % 90)}ms\n\nfound 0 vulnerabilities\n`);
        return 0;
      }
    }
    return npmCmd(sh, args, io);
  }

  function hostnameFor(id) { return id.slice(0, 12); }
  function createContainer(e, img, o) {
    e.counter++;
    const id = hex(`container:${e.counter}:${o.name ?? ""}:${img.id}`);
    const name = o.name ?? randomName(e);
    const env = { ...parseEnvList(img.config.Env), ...o.env };
    if (!env.HOSTNAME) env.HOSTNAME = o.hostname ?? hostnameFor(id);
    env.HOME = (o.user ?? img.config.User) === "node" ? "/home/node" : (o.user ?? img.config.User) === "nginx" ? "/var/cache/nginx" : "/root";
    const fs = new MemFS();
    fs.nodes = new Map([...img.nodes].map(([k, n]) => [k, { ...n }]));
    const c = {
      id, name, engine: e, image: img, imageRef: o.imageRef, created: now(e), startedAt: null, finishedAt: null,
      state: "created", exitCode: 0, error: "", fs, env, hostname: o.hostname ?? hostnameFor(id), osName: img.osName,
      cmd: o.cmd, entrypoint: o.entrypoint, workdir: o.workdir ?? img.config.WorkingDir ?? "", userSpec: o.user ?? img.config.User ?? "",
      ports: o.ports ?? [], mounts: o.mounts ?? [], networks: {}, restart: o.restart ?? { name: "no", max: 0 }, restartCount: 0,
      autoRemove: !!o.rm, init: !!o.init, memory: o.memory ?? 0, cpus: o.cpus ?? 0, labels: o.labels ?? {},
      healthcheck: o.healthcheck !== undefined ? o.healthcheck : img.config.Healthcheck, health: null,
      logs: [], procs: [], nextPid: 1, netns: null, compose: o.compose ?? null, stopSignal: img.config.StopSignal ?? "SIGTERM",
    };
    c.netns = { kind: "container", listeners: new Map(), container: c };
    const net = e.networks.get(o.network ?? "bridge");
    if (net && net.prefix) c.networks[net.name] = { ip: net.prefix + net.next++, aliases: o.aliases ?? [], net };
    for (const m of c.mounts) prepareMount(e, c, m);
    e.containers.set(id, c);
    return c;
  }
  function resolveUser(c) {
    const spec = c.userSpec || "";
    if (!spec || spec === "root" || spec === "0") return { name: "root", uid: 0 };
    const u = spec.split(":")[0];
    const passwd = c.fs.text("/etc/passwd") ?? "";
    for (const line of passwd.split("\n")) {
      const [n, , uid] = line.split(":");
      if (n === u || uid === u) return { name: n, uid: Number(uid) };
    }
    if (/^\d+$/.test(u)) return { name: null, uid: Number(u) };
    return { error: `unable to find user ${u}: no matching entries in passwd file` };
  }

  // volumes and bind mounts: the mounted folder in the container mirrors its source
  function prepareMount(e, c, m) {
    if (m.type === "volume") {
      let v = e.volumes.get(m.source);
      if (!v) { v = { name: m.source, created: now(e), files: null, labels: m.labels ?? {} }; e.volumes.set(m.source, v); }
      if (!v.files) {
        // a new, empty volume gets a copy of what the image has at that path
        v.files = new Map();
        for (const [p, n] of c.image.nodes) if (p.startsWith(m.target + "/")) v.files.set(p.slice(m.target.length + 1), { ...n });
      }
    }
  }
  function syncIn(c) {
    for (const m of c.mounts) {
      const prefix = m.target + "/";
      for (const k of [...c.fs.nodes.keys()]) if (k.startsWith(prefix)) c.fs.nodes.delete(k);
      if (!c.fs.nodes.has(m.target)) mkdirp(c.fs, m.target);
      if (m.type === "volume") {
        const v = c.engine.volumes.get(m.source);
        for (const [rel, n] of v?.files ?? []) { mkdirp(c.fs, (prefix + rel).slice(0, (prefix + rel).lastIndexOf("/"))); c.fs.nodes.set(prefix + rel, { ...n }); }
      } else {
        const hfs = c.engine.owner.fs;
        const src = m.source;
        if (hfs.isDir(src)) for (const [k, n] of hfs.nodes) if (k.startsWith(src + "/")) { const dest = prefix + k.slice(src.length + 1); if (n.type === "dir") mkdirp(c.fs, dest); else { mkdirp(c.fs, dest.slice(0, dest.lastIndexOf("/"))); c.fs.nodes.set(dest, { ...n }); } }
        else if (hfs.exists(src)) { c.fs.nodes.delete(m.target); c.fs.nodes.set(m.target, { ...hfs.get(src) }); }
      }
    }
  }
  function syncOut(c) {
    for (const m of c.mounts) {
      if (m.ro) continue;
      const prefix = m.target + "/";
      if (m.type === "volume") {
        const v = c.engine.volumes.get(m.source);
        if (!v) continue;
        v.files = new Map();
        for (const [k, n] of c.fs.nodes) if (k.startsWith(prefix)) v.files.set(k.slice(prefix.length), { ...n });
      } else {
        const hfs = c.engine.owner.fs;
        const src = m.source;
        if (!hfs.isDir(src)) { if (c.fs.get(m.target)?.type === "file") hfs.nodes.set(src, { ...c.fs.get(m.target) }); continue; }
        for (const k of [...hfs.nodes.keys()]) if (k.startsWith(src + "/")) hfs.nodes.delete(k);
        for (const [k, n] of c.fs.nodes) if (k.startsWith(prefix)) hfs.nodes.set(src + "/" + k.slice(prefix.length), { ...n });
      }
    }
  }
  function mkdirp(fs, path) {
    if (!path || path === "/" || fs.nodes.has(path)) return;
    mkdirp(fs, path.slice(0, path.lastIndexOf("/")) || "/");
    fs.nodes.set(path, { type: "dir", mtime: fs.tick(), mode: 0o40755, ino: ++fs.inode });
  }

  // the command a container runs: entrypoint + command, as Docker stores them
  function argvOf(c) {
    const ep = c.entrypoint !== undefined ? c.entrypoint : c.image.config.Entrypoint;
    const cmd = c.cmd !== undefined ? c.cmd : c.image.config.Cmd;
    return [...(ep ?? []), ...(cmd ?? [])];
  }
  const commandString = (c) => argvOf(c).join(" ");

  // Start (or restart) the main process. Returns null, or an error message (the container didn't start).
  async function startContainer(e, c) {
    const user = resolveUser(c);
    if (user.error) return { error: `failed to create task for container: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: error during container init: ${user.error}: unknown`, code: 126 };
    const argv = argvOf(c);
    if (!argv.length) return { error: "no command specified", code: 125 };
    const exe = argv[0];
    const bins = new Set(c.image.bins);
    if (!exe.includes("/") ? !bins.has(exe) : !c.fs.exists(exe) && !(exe === "/bin/sh" && bins.has("sh"))) {
      return { error: `failed to create task for container: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: error during container init: exec: "${exe}": ${exe.includes("/") ? "stat " + exe + ": no such file or directory" : "executable file not found in $PATH"}: unknown`, code: 127 };
    }
    for (const n of Object.values(c.networks)) void n;
    c.state = "running";
    c.startedAt = now(e);
    c.finishedAt = null;
    c.exitCode = 0;
    c.health = c.healthcheck && c.healthcheck.Test && c.healthcheck.Test[0] !== "NONE" ? { status: "starting", streak: 0, log: [], checkedAt: c.startedAt } : null;
    c.procs = [];
    c.nextPid = 1;
    c.netns.listeners.clear();
    syncIn(c);
    const csh = makeShell(e.owner, { fs: c.fs, env: c.env, cwd: c.workdir || "/", user, bins: c.image.bins, osName: c.osName, nodeMajor: c.image.nodeMajor, container: c });
    csh.pid = 1;
    csh.keepServers = true;
    csh.push = (kind, text) => { if (kind === "cmd" || !text) return; const last = c.logs[c.logs.length - 1]; if (last && last[0] === kind) last[1] += text; else c.logs.push([kind, text]); };
    csh.liveIO = { out: (t) => csh.push("out", String(t)), err: (t) => csh.push("err", String(t)), stdin: "" };
    c.shell = csh;
    c.user = user;
    // what really runs as PID 1: the image's entrypoint scripts decide
    let eff = argv;
    if (eff[0] === "docker-entrypoint.sh") {
      // the node image's entrypoint puts node in front of arguments that aren't commands
      const rest = eff.slice(1);
      const isCmd = (a) => (a.includes("/") ? c.fs.exists(a) && !/\.m?js$/.test(a) : bins.has(a));
      eff = !rest.length || rest[0].startsWith("-") || !isCmd(rest[0]) ? ["node", ...rest] : rest;
    } else if (eff[0] === "/docker-entrypoint.sh") {
      // nginx's entrypoint runs its configuration scripts, then nginx
      if (eff[1] === "nginx") {
        for (const l of ["/docker-entrypoint.sh: /docker-entrypoint.d/ is not empty, will attempt to perform configuration", "/docker-entrypoint.sh: Looking for shell scripts in /docker-entrypoint.d/", "/docker-entrypoint.sh: Launching /docker-entrypoint.d/10-listen-on-ipv6-by-default.sh", "10-listen-on-ipv6-by-default.sh: info: Getting the checksum of /etc/nginx/conf.d/default.conf", "10-listen-on-ipv6-by-default.sh: info: Enabled listen on IPv6 in /etc/nginx/conf.d/default.conf", "/docker-entrypoint.sh: Sourcing /docker-entrypoint.d/15-local-resolvers.envsh", "/docker-entrypoint.sh: Launching /docker-entrypoint.d/20-envsubst-on-templates.sh", "/docker-entrypoint.sh: Launching /docker-entrypoint.d/30-tune-worker-processes.sh", "/docker-entrypoint.sh: Configuration complete; ready for start up"]) csh.push("out", l + "\n");
      }
      eff = eff.slice(1);
    }
    let script;
    const pid1 = { pid: c.nextPid++, user: user.name ?? String(user.uid), cmd: eff.join(" ") };
    if (c.init) { c.procs.push({ ...pid1, cmd: "/sbin/docker-init -- " + argv.join(" ") }); pid1.pid = c.nextPid++; }
    c.procs.push(pid1);
    c.mainProc = pid1;
    c.shellForm = false;
    if ((eff[0] === "/bin/sh" || eff[0] === "sh") && eff[1] === "-c") {
      // shell form: sh is PID 1 and runs the command as its child, so signals for PID 1 never reach it
      script = eff.slice(2).join(" ");
      c.procs.push({ pid: 7, user: pid1.user, cmd: script.split(/[;&|]/)[0].trim() });
      c.nextPid = 8;
      c.shellForm = true;
    } else script = eff.map(shq).join(" ");
    if (pid1.cmd.startsWith("nginx")) pid1.cmd = "nginx: master process " + pid1.cmd;
    c.signalsReach = !c.shellForm;
    c.alive = false;
    const status = await csh.runScript(script, { echo: false, errexit: false });
    if (c.state !== "running") return null;    // stopped meanwhile
    const proc = csh.proc;
    if (c.nginxAlive || c.daemon || (proc && proc.alive && !proc.ended)) {
      c.alive = true;
      if (proc && !c.nginxAlive && !c.daemon) proc.onEnd = (code) => { exited(e, c, code); };
    } else exited(e, c, status);
    syncOut(c);
    return null;
  }
  // the main process ended
  function exited(e, c, code) {
    if (c.state !== "running") return;
    c.state = "exited";
    c.exitCode = code;
    c.finishedAt = now(e);
    c.alive = false;
    c.netns.listeners.clear();
    for (const p of c.procs) p.ended = true;
    c.pendingRestart = shouldRestart(c, code);
  }
  function shouldRestart(c, code) {
    const r = c.restart.name;
    if (c.stoppedByUser) return false;
    if (r === "always" || r === "unless-stopped") return true;
    if (r === "on-failure") return code !== 0 && (!c.restart.max || c.restartCount < c.restart.max);
    return false;
  }
  // after anything happens: restart containers whose policy says so, remove --rm containers, update health
  async function settle(e) {
    for (const c of [...e.containers.values()]) {
      if (c.state === "exited" && c.pendingRestart && !c.restarting) {
        c.pendingRestart = false;
        c.restarting = true;
        c.restartCount++;
        tick(e);
        await startContainer(e, c);
        c.restarting = false;
        if (c.state === "exited") { c.pendingRestart = false; c.crashLoop = true; }
      } else if (c.state === "exited" && c.autoRemove) removeContainer(e, c);
    }
  }
  async function refreshHealth(e, c) {
    if (!c.health || c.state !== "running") return;
    const hc = c.healthcheck;
    const ns = (v, d) => (v ? v / 1e9 : d);
    const interval = ns(hc.Interval, 30), startPeriod = ns(hc.StartPeriod, 0), retries = hc.Retries || 3;
    const t = now(e);
    const due = c.health.checkedAt + interval;
    if (t < due) return;
    const runs = Math.max(1, Math.floor((t - c.health.checkedAt) / interval));
    const argv = hc.Test[0] === "CMD-SHELL" ? ["/bin/sh", "-c", hc.Test[1]] : hc.Test.slice(1);
    const r = await execIn(e, c, argv, { quietExec: true });
    for (let k = 0; k < Math.min(runs, retries + 1); k++) {
      const start = c.health.checkedAt + interval * (k + 1);
      c.health.log.push({ Start: iso(start), End: iso(start + 0.05), ExitCode: r.code, Output: r.out });
      if (c.health.log.length > 5) c.health.log.shift();
      if (r.code === 0) { c.health.status = "healthy"; c.health.streak = 0; }
      else if (start - c.startedAt >= startPeriod) { c.health.streak++; if (c.health.streak >= retries) c.health.status = "unhealthy"; }
    }
    c.health.checkedAt += runs * interval;
  }
  // run a command in a running container (docker exec, health checks)
  async function execIn(e, c, argv, { user = null, workdir = null, env = {}, quietExec = false, io = null, stdin = "", detached = false } = {}) {
    syncIn(c);
    const u = user ? resolveUser({ ...c, userSpec: user }) : c.user ?? resolveUser(c);
    const xsh = makeShell(e.owner, { fs: c.fs, env: { ...c.env, ...env }, cwd: workdir ?? (c.workdir || "/"), user: u, bins: c.image.bins, osName: c.osName, nodeMajor: c.image.nodeMajor, container: c });
    xsh.pid = c.nextPid;
    const p = { pid: c.nextPid++, user: u.name ?? String(u.uid), cmd: argv.join(" ") };
    c.procs.push(p);
    let out = "";
    xsh.push = (kind, text) => { if (kind === "cmd" || !text) return; out += text; if (io) (kind === "err" ? io.err(text) : io.out(text)); };
    const script = argv[0] === "/bin/sh" && argv[1] === "-c" ? argv.slice(2).join(" ") : argv.map(shq).join(" ");
    xsh.inheritedStdin = stdin;
    xsh.detached = detached;
    xsh.execProc = p;
    const code = await xsh.runScript(script, { echo: false, errexit: false });
    if (!p.background) p.ended = true;
    syncOut(c);
    void quietExec;
    return { code, out };
  }
  // docker stop: the stop signal, then SIGKILL after the timeout
  async function stopContainer(e, c, timeout = null, { kill = false } = {}) {
    if (c.state !== "running") return;
    c.stoppedByUser = true;
    const wait = timeout ?? c.stopTimeout ?? 10;
    const proc = c.shell?.proc;
    let code = null;
    if (c.daemon) code = c.daemon.stop(c, { kill });
    if (code !== null) { /* the daemon decided */ }
    else if (kill) code = 137;
    else if (c.nginxAlive) code = 0;
    else if (c.signalsReach && proc && !proc.ended) {
      const handlers = proc.signals[c.stopSignal] ?? [];
      if (handlers.length) {
        for (const h of handlers) { try { const r = h(c.stopSignal); if (r && typeof r.then === "function") r.catch((err) => proc.crash(err)); } catch (err) { proc.crash(err); } }    // async handlers: process.exit() inside rejects their promise
        for (let k = 0; k < 40 && !proc.ended; k++) await new Promise((r) => setTimeout(r, 5));
        if (proc.ended) code = proc.exitCode;
      } else if (c.init) code = 143;    // with --init, Node.js gets SIGTERM and its default action ends it
    }
    if (code === null) { tick(e, wait); code = 137; }    // nobody handled the signal: killed after the timeout
    else tick(e, 0);
    if (proc && !proc.ended) { proc.alive = false; proc.end(code); }
    c.nginxAlive = false;
    c.daemon = null;
    c.state = "running";
    exited(e, c, code);
    c.pendingRestart = false;
    syncOut(c);
  }
  function removeContainer(e, c) {
    e.containers.delete(c.id);
    for (const n of Object.values(c.networks)) void n;
    for (const m of c.mounts) if (m.anonymous) e.volumes.delete(m.source);
  }

  // the nginx program: serves /usr/share/nginx/html on port 80 and logs each request
  function nginxProgram(sh, args, io) {
    const c = sh.container;
    if (!c) { io.err("nginx: the sandbox runs nginx only inside its official image\n"); return Promise.resolve(1); }
    const e = c.engine;
    const stamp = () => { const d = new Date(now(e) * 1000); const p = (n) => String(n).padStart(2, "0"); return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`; };
    io.err(`${stamp()} [notice] 1#1: using the "epoll" event method\n${stamp()} [notice] 1#1: nginx/1.31.7\n${stamp()} [notice] 1#1: OS: Linux 6.12.54-linuxkit\n${stamp()} [notice] 1#1: getrlimit(RLIMIT_NOFILE): 1048576:1048576\n${stamp()} [notice] 1#1: start worker processes\n${stamp()} [notice] 1#1: start worker process 29\n${stamp()} [notice] 1#1: start worker process 30\n`);
    c.procs.push({ pid: 29, user: "nginx", cmd: "nginx: worker process" }, { pid: 30, user: "nginx", cmd: "nginx: worker process" });
    c.nextPid = 31;
    const clf = () => { const d = new Date(now(e) * 1000); const p = (n) => String(n).padStart(2, "0"); const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]; return `${p(d.getUTCDate())}/${mon}/${d.getUTCFullYear()}:${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} +0000`; };
    c.netns.listeners.set(80, {
      host: null,
      handle: async ({ method, url, headers, remote, now: t }) => {
        let path = decodeURIComponent(url.split("?")[0]);
        if (path.endsWith("/")) path += "index.html";
        const root = "/usr/share/nginx/html";
        let file = c.fs.text(root + path);
        if (file === null && c.fs.isDir(root + path)) return { status: 301, statusMessage: "Moved Permanently", headers: [["Server", "nginx/1.31.7"], ["Date", new Date(t * 1000).toUTCString()], ["Content-Type", "text/html"], ["Content-Length", "169"], ["Location", `http://${headers.Host}${path}/`], ["Connection", "keep-alive"]], body: `<html>\r\n<head><title>301 Moved Permanently</title></head>\r\n<body>\r\n<center><h1>301 Moved Permanently</h1></center>\r\n<hr><center>nginx/1.31.7</center>\r\n</body>\r\n</html>\r\n` };
        const status = file === null ? 404 : 200;
        if (file === null) file = `<html>\r\n<head><title>404 Not Found</title></head>\r\n<body>\r\n<center><h1>404 Not Found</h1></center>\r\n<hr><center>nginx/1.31.7</center>\r\n</body>\r\n</html>\r\n`;
        const type = status === 404 ? "text/html" : /\.css$/.test(path) ? "text/css" : /\.js$/.test(path) ? "application/javascript" : /\.json$/.test(path) ? "application/json" : /\.txt$/.test(path) ? "text/plain" : /\.svg$/.test(path) ? "image/svg+xml" : "text/html";
        const len = textBytes(file);
        c.shell.push("out", `${remote} - - [${clf()}] "${method} ${url} HTTP/1.1" ${status} ${method === "HEAD" ? 0 : len} "-" "${headers["User-Agent"] ?? "-"}" "-"\n`);
        if (status === 404) c.shell.push("err", `${stamp()} [error] 29#29: *1 open() "${root}${path}" failed (2: No such file or directory), client: ${remote}, server: localhost, request: "${method} ${url} HTTP/1.1", host: "${headers.Host}"\n`);
        const hdrs = [["Server", "nginx/1.31.7"], ["Date", new Date(t * 1000).toUTCString()], ["Content-Type", type], ["Content-Length", String(len)]];
        if (status === 200) hdrs.push(["Last-Modified", "Wed, 15 Oct 2026 16:51:48 GMT"]);
        hdrs.push(["Connection", "keep-alive"]);
        if (status === 200) hdrs.push(["ETag", `"${hex(path + file, 8)}-${len.toString(16)}"`], ["Accept-Ranges", "bytes"]);
        return { status, statusMessage: status === 200 ? "OK" : "Not Found", headers: hdrs, body: method === "HEAD" ? "" : file };
      },
    });
    c.nginxAlive = true;
    return Promise.resolve(0);
  }
  registerCommand("nginx", async (sh, args, io) => {
    if (args[0] === "-v") { io.err("nginx version: nginx/1.31.7\n"); return 0; }
    if (args[0] === "-t") { io.err("nginx: the configuration file /etc/nginx/nginx.conf syntax is ok\nnginx: configuration file /etc/nginx/nginx.conf test is successful\n"); return 0; }
    return nginxProgram(sh, args, io);
  });

  /* ------------------------------------------------------------ the Dockerfile */

  const INSTRUCTIONS = ["from", "run", "cmd", "label", "maintainer", "expose", "env", "add", "copy", "entrypoint", "volume", "user", "workdir", "arg", "onbuild", "stopsignal", "healthcheck", "shell"];
  function levenshtein(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  // Parse a Dockerfile into instructions with their line numbers; { error } on a parse error.
  function parseDockerfile(text) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let i = 0;
    while (i < lines.length) {
      let line = lines[i];
      const start = i + 1;
      if (/^\s*(#.*)?$/.test(line)) { i++; continue; }
      let full = line;
      while (/\\\s*$/.test(full) && i + 1 < lines.length) {
        full = full.replace(/\\\s*$/, "");
        i++;
        if (/^\s*#/.test(lines[i])) continue;
        full += "\n" + lines[i];
      }
      const end = i + 1;
      i++;
      const m = /^\s*(\S+)\s*([\s\S]*)$/.exec(full);
      const kw = m[1];
      const lower = kw.toLowerCase();
      if (!INSTRUCTIONS.includes(lower)) {
        let best = null, bd = 3;
        for (const k of INSTRUCTIONS) { const d = levenshtein(lower, k); if (d < bd) { bd = d; best = k; } }
        return { error: `dockerfile parse error on line ${start}: unknown instruction: ${kw}${best ? ` (did you mean ${best}?)` : ""}`, line: start, end: start };
      }
      out.push({ kw: lower, raw: kw, args: m[2].replace(/\n\s*/g, " ").trim(), text: full.replace(/\n\s*/g, " ").trim(), line: start, end });
    }
    return { instructions: out, lines };
  }
  // ["a", "b"] (exec form) or a string (shell form)
  function argForm(args) {
    const t = args.trim();
    if (t.startsWith("[")) { try { const v = JSON.parse(t); if (Array.isArray(v) && v.every((x) => typeof x === "string")) return { exec: v }; } catch { /* shell form */ } }
    return { shell: t };
  }
  const goList = (arr) => "[" + arr.map((x) => JSON.stringify(x)).join(" ") + "]";
  function subst(text, vars) {
    return text.replace(/\$\{([A-Za-z_]\w*)(?::?-([^}]*))?\}|\$([A-Za-z_]\w*)/g, (m, a, def, b) => { const k = a ?? b; return vars[k] !== undefined && vars[k] !== "" ? vars[k] : def ?? ""; });
  }
  function parseKV(args) {
    // ENV KEY=value KEY2="value 2" (or the legacy ENV KEY value)
    const toks = tokenize(args).filter((t) => typeof t === "string");
    if (toks.length && !toks[0].includes("=")) return { legacy: true, pairs: [[toks[0], args.trim().slice(toks[0].length).trim()]] };
    return { pairs: toks.map((t) => { const k = t.indexOf("="); return [t.slice(0, k), t.slice(k + 1)]; }) };
  }
  function durationNs(s) { const m = /^(\d+(?:\.\d+)?)(ms|s|m|h)$/.exec(String(s)); if (!m) return 0; return Math.round(Number(m[1]) * { ms: 1e6, s: 1e9, m: 60e9, h: 3600e9 }[m[2]]); }
  function parseHealthcheck(args) {
    const toks = args.split(/\s+/);
    const hc = { Test: null };
    let k = 0;
    while (toks[k] && toks[k].startsWith("--")) {
      const [name, val] = toks[k].slice(2).split("=");
      if (name === "interval") hc.Interval = durationNs(val);
      if (name === "timeout") hc.Timeout = durationNs(val);
      if (name === "start-period") hc.StartPeriod = durationNs(val);
      if (name === "start-interval") hc.StartInterval = durationNs(val);
      if (name === "retries") hc.Retries = Number(val);
      k++;
    }
    const rest = toks.slice(k).join(" ");
    if (/^NONE$/i.test(rest)) return { Test: ["NONE"] };
    const m = /^CMD\s+([\s\S]*)$/i.exec(rest);
    if (!m) return null;
    const f = argForm(m[1]);
    hc.Test = f.exec ? ["CMD", ...f.exec] : ["CMD-SHELL", f.shell];
    return hc;
  }

  // .dockerignore patterns (Go filepath.Match with ** and ! exceptions)
  function ignoreMatcher(text) {
    const rules = (text ?? "").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => {
      const neg = l.startsWith("!");
      let p = (neg ? l.slice(1) : l).replace(/^\/+/, "").replace(/\/+$/, "");
      if (p.startsWith("./")) p = p.slice(2);
      const re = new RegExp("^" + p.split("/").map((seg) => (seg === "**" ? "(?:.*)" : seg.replace(/[.+^${}()|\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]"))).join("/").replace(/\(\?:\.\*\)\//g, "(?:.*/)?") + "(?:/.*)?$");
      return { neg, re };
    });
    return (rel) => { let ignored = false; for (const r of rules) if (r.re.test(rel)) ignored = !r.neg; return ignored; };
  }

  /* ------------------------------------------------------------ docker build (BuildKit, plain progress) */

  // Build an image. out(text) receives the progress; returns { ok, image, code, digestShown }.
  async function build(e, sh, o, out) {
    const ctxDir = sh.abs(o.context ?? ".");
    const dfPath = o.file ? sh.abs(o.file) : ctxDir + "/Dockerfile";
    const dfName = o.file ? o.file.split("/").pop() : "Dockerfile";
    let P = (s) => out(s + "\n");
    const pfx = o.prefix ? o.prefix + " " : "";
    const ctr = o.counter ?? { n: 0 };
    const vtx = (name) => { ctr.n++; if (ctr.n > 1 || o.headerShown) P(""); P(`#${ctr.n} ${name}`); return ctr.n; };
    if (!o.noHeader) { P(`#0 building with "${e.builder.name}" instance using ${e.builder.driver} driver`); o.headerShown = true; }
    if (!sh.fs.isDir(ctxDir)) { P(`ERROR: failed to build: unable to prepare context: path "${o.context}" not found`); return { ok: false, code: 1 }; }
    const dfText = sh.fs.text(dfPath);
    let v = vtx(`[${pfx}internal] load build definition from ${dfName}`);
    if (dfText === null) {
      P(`#${v} transferring dockerfile: 2B done`); P(`#${v} DONE 0.0s`);
      P(`ERROR: failed to build: failed to solve: failed to read dockerfile: open ${dfName}: no such file or directory`);
      return { ok: false, code: 1 };
    }
    P(`#${v} transferring dockerfile: ${textBytes(dfText)}B done`);
    const parsed = parseDockerfile(dfText);
    const showSource = (line, endLine = line) => {
      const lines = dfText.split("\n");
      let start = line, end = endLine;
      const pad = end === start ? 4 : 2;
      let p = 0;
      const pre = start;
      while (p < pad) { if (start > 1) { start--; p++; } if (end !== lines.length) { end++; p++; } p++; }
      let s = `${dfName}:${pre}\n--------------------\n`;
      for (let k = start; k <= end; k++) s += ` ${String(k).padStart(3)} | ${k >= line && k <= endLine ? ">>>" : "   "} ${lines[k - 1]}\n`;
      return s + "--------------------";
    };
    if (parsed.error) {
      P(`#${v} DONE 0.0s`);
      P(showSource(parsed.line));
      P(`ERROR: failed to build: failed to solve: ${parsed.error}`);
      return { ok: false, code: 1 };
    }
    const ins = parsed.instructions;
    // stages
    const stages = [];
    const warnings = [];
    let cur = null;
    const globalArgs = {};
    for (const it of ins) {
      if (it.kw === "from") {
        const toks = it.args.split(/\s+/).filter((t) => !t.startsWith("--platform"));
        const asIdx = toks.findIndex((t) => /^as$/i.test(t));
        const name = asIdx > 0 ? toks[asIdx + 1] : null;
        if (asIdx > 0 && ((it.raw === it.raw.toUpperCase()) !== (toks[asIdx] === toks[asIdx].toUpperCase()))) warnings.push(`FromAsCasing: '${toks[asIdx]}' and '${it.raw}' keywords' casing do not match (line ${it.line})`);
        cur = { index: stages.length, name: name ? name.toLowerCase() : null, base: subst(toks[0], globalArgs), from: it, steps: [] };
        stages.push(cur);
        continue;
      }
      if (!cur) {
        if (it.kw === "arg") { for (const [k, val] of parseKV(it.args).pairs) globalArgs[k] = (o.buildArgs ?? {})[k] ?? val; continue; }
        P(`#${v} DONE 0.0s`); P(showSource(it.line));
        P(`ERROR: failed to build: failed to solve: dockerfile parse error on line ${it.line}: no build stage in current context`);
        return { ok: false, code: 1 };
      }
      cur.steps.push(it);
    }
    if (!stages.length) { P(`#${v} DONE 0.0s`); P("ERROR: failed to build: failed to solve: the Dockerfile (Dockerfile) cannot be empty"); return { ok: false, code: 1 }; }
    for (const st of stages) {
      const cmds = st.steps.filter((x) => x.kw === "cmd" || x.kw === "entrypoint");
      for (const x of cmds) if (!argForm(x.args).exec) warnings.push(`JSONArgsRecommended: JSON arguments recommended for ${x.raw.toUpperCase()} to prevent unintended behavior related to OS signals (line ${x.line})`);
      for (const x of st.steps.filter((y) => y.kw === "env" || y.kw === "arg")) {
        const kv = parseKV(x.args);
        if (kv.legacy) warnings.push(`LegacyKeyValueFormat: "${x.raw.toUpperCase()} key=value" should be used instead of legacy "${x.raw.toUpperCase()} key value" format (line ${x.line})`);
        for (const [k] of kv.pairs) if (/(?:^|_)(?:TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|AUTH|CREDENTIALS?)(?:_|$)/i.test(k) && !/^(?:PUBLIC|NEXT_PUBLIC)_/.test(k)) warnings.push(`SecretsUsedInArgOrEnv: Do not use ARG or ENV instructions for sensitive data (${x.raw.toUpperCase()} "${k}") (line ${x.line})`);
      }
      for (const x of st.steps.filter((y) => y.kw === "maintainer")) warnings.push(`MaintainerDeprecated: Maintainer instruction is deprecated in favor of using label (line ${x.line})`);
    }
    for (const w of warnings) P(`#${v} WARN: ${w}`);
    P(`#${v} DONE 0.0s`);

    // which stages the target needs
    const byName = (ref) => stages.find((s) => s.name === ref.toLowerCase()) ?? (/^\d+$/.test(ref) ? stages[Number(ref)] : null);
    let target = stages[stages.length - 1];
    if (o.target) {
      target = byName(o.target);
      if (!target) { P(`ERROR: failed to build: failed to solve: target stage "${o.target}" could not be found`); return { ok: false, code: 1 }; }
    }
    const needed = new Set();
    const need = (st) => {
      if (needed.has(st)) return;
      needed.add(st);
      const parent = byName(st.base);
      if (parent && parent.index < st.index) need(parent);
      for (const x of st.steps) { const m = /--from=(\S+)/.exec(x.args); if ((x.kw === "copy" || x.kw === "add") && m) { const s2 = byName(m[1]); if (s2) need(s2); } }
    };
    need(target);
    const order = stages.filter((s) => needed.has(s));
    const multi = stages.length > 1;
    const label = (st) => (st.name ?? (multi ? `stage-${st.index}` : null));
    const stepCount = (st) => 1 + st.steps.filter((x) => ["run", "copy", "add", "workdir"].includes(x.kw)).length;

    // base images: load metadata
    const bases = [];
    for (const st of order) if (!byName(st.base) && st.base !== "scratch" && !bases.includes(st.base)) bases.push(st.base);
    const baseImages = {};
    for (const b of bases) {
      const r = parseRef(b);
      v = vtx(`[${pfx}internal] load metadata for ${r.full}`);
      let img = null;
      if (r.registry === "docker.io" && r.path.startsWith("library/")) { const h = hubImage(r); img = h && h.record ? h.record : null; }
      else { const reg = registries(e.owner.fs)[r.repo]; const id = reg?.tags[r.tag]; if (id) img = { ...reg.images[id], nodes: new Map(reg.images[id].nodes) }; }
      const local = imageOf(e, b);
      if (!img && local && e.builder.driver === "docker") img = { ...local, local: true };
      if (!img) {
        const msg = r.registry === "docker.io" && !HUB[r.path] ? `pull access denied, repository does not exist or may require authorization: server message: insufficient_scope: authorization failed` : `${r.full}: not found`;
        P(`#${v} ERROR: ${msg}`);
        P("------"); P(` > [${pfx}internal] load metadata for ${r.full}:`); P("------");
        const st = order.find((s) => s.base === b);
        P(showSource(st.from.line));
        P(`ERROR: failed to build: failed to solve: ${b}: failed to resolve source metadata for ${r.full}: ${msg}`);
        return { ok: false, code: 1 };
      }
      P(`#${v} DONE ${img.local ? "0.0" : (0.4 + (hex(b).charCodeAt(0) % 7) / 10).toFixed(1)}s`);
      baseImages[b] = img;
    }
    // .dockerignore and the build context
    const ignText = sh.fs.text(ctxDir + "/.dockerignore");
    v = vtx(`[${pfx}internal] load .dockerignore`);
    P(`#${v} transferring context: ${ignText === null ? 2 : textBytes(ignText)}B done`);
    P(`#${v} DONE 0.0s`);
    const ignored = ignoreMatcher(ignText);
    const ctxFiles = new Map();
    for (const f of sh.fs.walkFiles(ctxDir)) {
      const rel = f.slice(ctxDir.length + 1);
      if (ignored(rel)) continue;
      ctxFiles.set(rel, sh.fs.get(f));
    }
    const usesContext = order.some((st) => st.steps.some((x) => (x.kw === "copy" || x.kw === "add") && !/--from=/.test(x.args)));

    // run the stages
    const results = new Map();     // stage → { nodes, config, key, layers, history }
    const shown = new Set();       // BuildKit runs identical steps once (two stages FROM the same image share the FROM)
    let ctxShown = false;
    const timeFor = (seed, lo, span) => (lo + (parseInt(hex(seed, 4), 16) % 100) / 100 * span);
    for (const st of order) {
      const lbl = label(st);
      const total = stepCount(st);
      let k = 1;
      const tag = () => `[${pfx}${lbl ? lbl + " " : ""}${k}/${total}]`;
      // FROM
      let state;
      const parent = byName(st.base);
      if (parent && results.has(parent)) {
        const pr = results.get(parent);
        state = { nodes: new Map([...pr.nodes].map(([p, nd]) => [p, { ...nd }])), config: structuredClone(pr.config), key: pr.key, layers: [...pr.layers], history: [...pr.history], bins: pr.bins, osName: pr.osName, nodeMajor: pr.nodeMajor, baseContent: pr.baseContent, baseUnpacked: pr.baseUnpacked, users: pr.users };
      } else if (st.base === "scratch") {
        state = { nodes: new Map([["/", { type: "dir", mtime: 1, mode: 0o40755 }]]), config: { Env: [], Cmd: null, Entrypoint: null, WorkingDir: "", User: "" }, key: "scratch", layers: [], history: [], bins: [], osName: "scratch", baseContent: 0, baseUnpacked: 0, users: {} };
      } else {
        const img = baseImages[st.base];
        const r = parseRef(st.base);
        const name = img.local ? `FROM ${r.full}` : `FROM ${r.full}@sha256:${img.id}`;
        const dup = shown.has(img.id);
        shown.add(img.id);
        const P0 = P;
        if (dup) P = () => {};
        v = dup ? v : vtx(`${tag()} ${name}`);
        const fresh = !img.local && img.layers.some((l) => !e.content.has(l.digest));
        if (!img.local) P(`#${v} resolve ${r.full}@sha256:${img.id} 0.0s done`);
        let dt = 0;
        if (fresh) {
          const ls = [...img.layers].reverse();
          for (const l of ls) { const tm = Math.max(0.1, l.size / 4e7); dt = Math.max(dt, tm); P(`#${v} sha256:${l.digest} ${bkBytes(l.size)} / ${bkBytes(l.size)} ${tm.toFixed(1)}s done`); }
          for (const l of img.layers) { const tm = l.size / 5e7; dt += tm; P(`#${v} extracting sha256:${l.digest}${tm > 0.01 ? ` ${tm.toFixed(1)}s` : ""} done`); e.content.add(l.digest); }
        }
        P(`#${v} DONE ${dt.toFixed(1)}s`);
        P = P0;
        state = { nodes: new Map([...img.nodes].map(([p, nd]) => [p, { ...nd }])), config: structuredClone(img.config), key: img.id, layers: [...img.layers], history: [...img.history], bins: img.bins, osName: img.osName, nodeMajor: img.nodeMajor, baseContent: img.content, baseUnpacked: img.unpacked, users: img.users };
      }
      if (parent && results.has(parent)) {
        v = vtx(`${tag()} FROM ${parent.name ?? `stage-${parent.index}`}`);
        P(`#${v} DONE 0.0s`);
      }
      k++;
      const args = { ...globalArgs };
      const env = () => ({ ...parseEnvList(state.config.Env), ...args });
      const fsOf = () => { const f = new MemFS(); f.nodes = state.nodes; f.inode = 100000; return f; };
      for (const x of st.steps) {
        const vars = env();
        if (x.kw === "arg") { for (const [kk, val] of parseKV(x.args).pairs) args[kk] = (o.buildArgs ?? {})[kk] ?? globalArgs[kk] ?? val; continue; }
        if (x.kw === "env") {
          for (const [kk, val] of parseKV(x.args).pairs) {
            const value = subst(val.replace(/^"(.*)"$/s, "$1"), vars);
            state.config.Env = state.config.Env.filter((p) => !p.startsWith(kk + "=")).concat(`${kk}=${value}`);
            state.history.push({ createdBy: `ENV ${kk}=${value}`, size: 0, created: now(e) });
          }
          continue;
        }
        if (x.kw === "label") { state.config.Labels = { ...(state.config.Labels ?? {}), ...Object.fromEntries(parseKV(x.args).pairs.map(([a, b]) => [a, b.replace(/^"(.*)"$/s, "$1")])) }; state.history.push({ createdBy: `LABEL ${x.args}`, size: 0, created: now(e) }); continue; }
        if (x.kw === "maintainer") continue;
        if (x.kw === "expose") { for (const p of subst(x.args, vars).split(/\s+/)) { const pp = p.includes("/") ? p.toLowerCase() : p + "/tcp"; state.config.ExposedPorts = { ...(state.config.ExposedPorts ?? {}), [pp]: {} }; } state.history.push({ createdBy: `EXPOSE map[${Object.keys(state.config.ExposedPorts).map((p) => p + ":{}").join(" ")}]`, size: 0, created: now(e) }); continue; }
        if (x.kw === "user") { state.config.User = subst(x.args, vars); state.history.push({ createdBy: `USER ${state.config.User}`, size: 0, created: now(e) }); continue; }
        if (x.kw === "cmd" || x.kw === "entrypoint") {
          const f = argForm(x.args);
          const val = f.exec ?? ["/bin/sh", "-c", f.shell];
          if (x.kw === "cmd") state.config.Cmd = val; else { state.config.Entrypoint = val; state.config.Cmd = null; }
          state.history.push({ createdBy: `${x.kw.toUpperCase()} ${goList(val)}`, size: 0, created: now(e) });
          continue;
        }
        if (x.kw === "healthcheck") { const hc = parseHealthcheck(x.args); state.config.Healthcheck = hc; state.history.push({ createdBy: `HEALTHCHECK &{${JSON.stringify(hc.Test)} ...}`, size: 0, created: now(e) }); continue; }
        if (x.kw === "stopsignal") { state.config.StopSignal = x.args.trim(); continue; }
        if (x.kw === "volume") { state.config.Volumes = { ...(state.config.Volumes ?? {}), ...Object.fromEntries((argForm(x.args).exec ?? x.args.split(/\s+/)).map((p) => [p, {}])) }; continue; }
        if (x.kw === "shell" || x.kw === "onbuild") continue;
        // the steps that make layers: WORKDIR, COPY, ADD, RUN
        const name = `${tag()} ${x.raw.toUpperCase()} ${x.args}`;
        if ((x.kw === "copy" || x.kw === "add") && !/--from=/.test(x.args) && usesContext && !ctxShown) {
          const vv = vtx(`[${pfx}internal] load build context`);
          const size = [...ctxFiles.values()].reduce((s2, nd) => s2 + nd.data.length, 0) + 32 * ctxFiles.size;
          P(`#${vv} transferring context: ${size >= 1024 ? (size / 1024).toFixed(2) + "kB" : size + "B"} done`);
          P(`#${vv} DONE 0.0s`);
          ctxShown = true;
        }
        let extra = "";
        let copyPlan = null;
        if (x.kw === "copy" || x.kw === "add") {
          copyPlan = planCopy(x, state, vars, ctxFiles, results, byName);
          if (copyPlan.error) {
            v = vtx(name);
            const ref = `${uuid(dfText + x.line)}::${base36(x.args, 25)}`;
            P(`#${v} ERROR: failed to calculate checksum of ref ${ref}: "${copyPlan.error}": not found`);
            P("------"); P(` > ${name}:`); P("------");
            P(showSource(x.line, x.end));
            P(`ERROR: failed to build: failed to solve: failed to compute cache key: failed to calculate checksum of ref ${ref}: "${copyPlan.error}": not found`);
            return { ok: false, code: 1 };
          }
          extra = hex(copyPlan.items.map(([dst, nd]) => dst + ":" + (nd.data ? new TextDecoder().decode(nd.data) : "")).join("\n"));
        }
        if (x.kw === "run") extra = hex(JSON.stringify([state.config.Env, state.config.User, state.config.WorkingDir, args]));
        const key = hex(`${state.key}|${x.kw}|${x.args}|${extra}`);
        if (shown.has(key) && e.cache.get(key)) {
          // the same step already ran in this build (in another stage): reuse it without a new vertex
          const same = e.cache.get(key);
          state.nodes = new Map([...same.nodes].map(([p, nd]) => [p, { ...nd }]));
          if (x.kw === "workdir") state.config.WorkingDir = same.config.WorkingDir;
          state.layers.push(same.layer); state.history.push(same.hist); state.key = key; k++;
          continue;
        }
        shown.add(key);
        const cached = !o.noCache && e.cache.get(key);
        v = vtx(name);
        if (cached) {
          P(`#${v} CACHED`);
          state.nodes = new Map([...cached.nodes].map(([p, nd]) => [p, { ...nd }]));
          if (x.kw === "workdir") state.config.WorkingDir = cached.config.WorkingDir;
          state.layers.push(cached.layer);
          state.history.push(cached.hist);
          state.key = key;
          k++;
          continue;
        }
        const before = new Map(state.nodes);
        let dt = 0.0;
        if (x.kw === "workdir") {
          const wd = subst(x.args, vars);
          const abs = wd.startsWith("/") ? wd : MemFS.norm((state.config.WorkingDir || "/") + "/" + wd);
          mkdirp(fsOf(), abs);
          state.config.WorkingDir = abs;
          dt = 0.1;
        } else if (copyPlan) {
          const f = fsOf();
          for (const [dst, nd, isDir] of copyPlan.items) {
            if (isDir) { mkdirp(f, dst); continue; }
            mkdirp(f, dst.slice(0, dst.lastIndexOf("/")) || "/");
            f.nodes.set(dst, { ...nd, mtime: f.tick(), ino: ++f.inode });
          }
          dt = copyPlan.items.length > 20 ? 0.2 : 0.0;
        } else if (x.kw === "run") {
          const f = argForm(x.args);
          const userInfo = state.config.User ? resolveUser({ fs: fsOf(), userSpec: state.config.User }) : { name: "root", uid: 0 };
          const rsh = makeShell(e.owner, { fs: fsOf(), env: env(), cwd: state.config.WorkingDir || "/", user: userInfo, bins: state.bins, osName: state.osName, nodeMajor: state.nodeMajor });
          let logText = "";
          rsh.push = (kind, t) => { if (kind !== "cmd" && t) logText += t; };
          const script = f.exec ? f.exec.map(shq).join(" ") : f.shell;
          const code = await rsh.runScript(script, { echo: false, errexit: false });
          const lines = logText.replace(/\n$/, "").split("\n");
          let ts = 0.2 + timeFor(x.args, 0.05, 0.25);
          const logLines = [];
          if (logText) for (const l of lines) { logLines.push(`${ts.toFixed(3)} ${l}`); ts += 0.003 + (l.length % 7) / 1000; }
          for (const l of logLines) P(`#${v} ${l}`);
          dt = /\bnpm (ci|install|i)\b/.test(script) ? 1.2 + timeFor(script, 0, 0.6) : /\b(npm|node)\b/.test(script) ? 0.6 + timeFor(script, 0, 0.4) : 0.2 + timeFor(script, 0, 0.2);
          if (code !== 0) {
            const proc = f.exec ? f.exec.join(" ") : `/bin/sh -c ${f.shell}`;
            const msg = `process "${proc}" did not complete successfully: exit code: ${code}`;
            P(`#${v} ERROR: ${msg}`);
            P("------"); P(` > ${name}:`);
            for (const l of logLines.slice(-10)) P(l);
            P("------");
            P(showSource(x.line, x.end));
            P(`ERROR: failed to build: failed to solve: ${msg}`);
            return { ok: false, code: 1 };
          }
        }
        P(`#${v} DONE ${dt.toFixed(1)}s`);
        // the new layer: what changed
        let size = 0;
        for (const [p, nd] of state.nodes) { const b = before.get(p); if (nd.type === "file" && (!b || b.data !== nd.data)) size += nd.data.length; }
        if (x.kw === "workdir" && !size) size = 0;
        // npm leaves its cache and logs behind in a layer, even when it installs nothing
        const layer = { digest: hex(key + ":layer"), size: Math.round(size * 0.42) + 96, raw: size + (x.kw === "run" && /\bnpm\b/.test(x.args) ? 4096 : 0) };
        const createdBy = x.kw === "run" ? `RUN /bin/sh -c ${x.args} # buildkit`.replace("/bin/sh -c [", "[") : `${x.raw.toUpperCase()} ${x.args}${x.kw === "workdir" ? "" : " # buildkit"}`;
        const hist = { createdBy, size: layer.raw, created: now(e) };
        state.layers.push(layer);
        state.history.push(hist);
        state.key = key;
        e.cache.set(key, { nodes: new Map(state.nodes), config: structuredClone(state.config), layer, hist });
        k++;
      }
      results.set(st, state);
    }
    // export
    const fin = results.get(target);
    const cfgJson = JSON.stringify([fin.config, fin.key, (o.labels ?? {})]);
    const id = hex("image:" + cfgJson);
    const exists = e.images.get(id);
    const allCached = !!exists;
    const exporting = o.push ? "exporting to image" : "exporting to image";
    v = vtx(exporting);
    P(`#${v} exporting layers${allCached ? "" : " 0.1s"} done`);
    P(`#${v} exporting manifest sha256:${hex(id + "manifest")} done`);
    P(`#${v} exporting config sha256:${hex(id + "config")} done`);
    P(`#${v} exporting attestation manifest sha256:${hex(id + "attest")}${allCached ? "" : " 0.0s"} done`);
    P(`#${v} exporting manifest list sha256:${id} done`);
    const tags = (o.tags ?? []).map((t) => parseRef(t));
    if (e.builder.driver === "docker" || o.load) {
      for (const t of tags) P(`#${v} naming to ${t.full} done`);
      for (const t of tags) P(`#${v} unpacking to ${t.full} 0.0s done`);
    }
    let exportTime = allCached ? 0 : 0.2 + timeFor(id, 0, 0.2);
    if (o.push) {
      const lt = 0.6 + timeFor(id, 0, 0.8);
      P(`#${v} pushing layers ${lt.toFixed(1)}s done`);
      exportTime += lt;
      for (const t of tags) { const mt = 0.3 + timeFor(t.full, 0, 0.3); exportTime += mt; P(`#${v} pushing manifest for ${t.full}@sha256:${id} ${mt.toFixed(1)}s done`); }
    }
    P(`#${v} DONE ${exportTime.toFixed(1)}s`);
    if (warnings.length && !o.quietWarnings) {
      P("");
      P(` ${warnings.length} warning${warnings.length === 1 ? "" : "s"} found (use docker --debug to expand):`);
      for (const w of warnings) P(` - ${w}`);
    }
    const added = fin.layers.filter((l) => l.raw !== undefined);
    const img = exists ?? {
      id, created: now(e), os: "linux", arch: "amd64", nodes: new Map(fin.nodes), bins: fin.bins, nodeMajor: fin.nodeMajor, osName: fin.osName, users: fin.users,
      config: { ...fin.config, Labels: { ...(fin.config.Labels ?? {}), ...(o.labels ?? {}) } }, layers: fin.layers, history: fin.history,
      content: fin.baseContent + added.reduce((s2, l) => s2 + l.size, 0) + 2950, unpacked: fin.baseUnpacked + added.reduce((s2, l) => s2 + l.raw, 0),
      attest: true, built: true,
    };
    if (e.builder.driver === "docker" || o.load) {
      e.images.set(id, img);
      for (const t of tags) setTag(e, t.full, img);
    }
    tick(e, 2);
    return { ok: true, image: img, code: 0, warnings };
  }
  // What a COPY/ADD copies: [[destination, node, isDir]], or { error: "/missing" }
  function planCopy(x, state, vars, ctxFiles, results, byName) {
    const toks = tokenize(x.args).filter((t) => typeof t === "string");
    const flags = toks.filter((t) => t.startsWith("--"));
    const rest = toks.filter((t) => !t.startsWith("--")).map((t) => subst(t, vars));
    let srcs = rest.slice(0, -1);
    const f = argForm(x.args.replace(/^(--\S+\s+)+/, ""));
    if (f.exec) srcs = f.exec.slice(0, -1);
    let dest = f.exec ? f.exec[f.exec.length - 1] : rest[rest.length - 1];
    const fromFlag = flags.find((t) => t.startsWith("--from="));
    const wd = state.config.WorkingDir || "/";
    const destAbs = dest.startsWith("/") ? MemFS.norm(dest) : MemFS.norm(wd + "/" + dest);
    const destIsDir = dest.endsWith("/") || dest === "." || srcs.length > 1 || srcs.some((s) => /[*?]/.test(s));
    // the files available: the build context, or another stage's file system
    let files;
    if (fromFlag) {
      const st = byName(fromFlag.slice(7));
      const r = st ? results.get(st) : null;
      files = new Map();
      if (r) for (const [p, nd] of r.nodes) if (p !== "/") files.set(p.slice(1), nd);
    } else files = ctxFiles;
    const items = [];
    for (const s of srcs) {
      const clean = s.replace(/^\.?\//, "").replace(/\/$/, "");
      if (clean === "" || clean === ".") {
        for (const [rel, nd] of files) if (nd.type !== "dir") items.push([MemFS.norm(destAbs + "/" + rel), nd]);
        continue;
      }
      if (/[*?]/.test(clean)) {
        const re = new RegExp("^" + clean.replace(/[.+^${}()|\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]") + "$");
        const hits = [...files].filter(([rel, nd]) => re.test(rel) && nd.type !== "dir");
        if (!hits.length) return { error: "/" + clean };
        for (const [rel, nd] of hits) items.push([MemFS.norm(destAbs + "/" + rel.split("/").pop()), nd]);
        continue;
      }
      const exact = files.get(clean);
      if (exact && exact.type !== "dir") { items.push([destIsDir ? MemFS.norm(destAbs + "/" + clean.split("/").pop()) : destAbs, exact]); continue; }
      const under = [...files].filter(([rel]) => rel.startsWith(clean + "/"));
      if (!under.length && !files.has(clean)) return { error: "/" + clean };
      for (const [rel, nd] of under) items.push(nd.type === "dir" ? [MemFS.norm(destAbs + "/" + rel.slice(clean.length + 1)), nd, true] : [MemFS.norm(destAbs + "/" + rel.slice(clean.length + 1)), nd]);
      if (!under.length) items.push([destAbs, null, true]);
    }
    return { items };
  }

  /* ------------------------------------------------------------ the docker command */

  class DockerError extends Error { constructor(msg, code = 1) { super(msg); this.code = code; } }
  // docker's flag parser: --flag value, --flag=value, -abc, repeated flags
  function parseFlags(args, spec, { stopAtArg = false } = {}) {
    const opts = {}, rest = [];
    const look = new Map();
    for (const [names, type] of Object.entries(spec)) for (const nm of names.split("|")) look.set(nm, [names.split("|")[0], type]);
    const set = (key, type, val) => { if (type === "multi") (opts[key] ??= []).push(val); else opts[key] = val; };
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (stopAtArg && rest.length) { rest.push(a); continue; }
      if (a === "--") { rest.push(...args.slice(i + 1)); break; }
      if (a.startsWith("--")) {
        const eq = a.indexOf("=");
        const nm = eq > 0 ? a.slice(0, eq) : a;
        const hit = look.get(nm);
        if (!hit) throw new DockerError(`unknown flag: ${nm}\n\nSee 'docker ${spec.__cmd ?? ""} --help'.`.replace("docker  --", "docker --"), 125);
        const [key, type] = hit;
        if (type === "bool") set(key, type, eq > 0 ? a.slice(eq + 1) !== "false" : true);
        else set(key, type, eq > 0 ? a.slice(eq + 1) : args[++i]);
      } else if (/^-[a-zA-Z]+$/.test(a)) {
        const letters = a.slice(1);
        for (let k = 0; k < letters.length; k++) {
          const hit = look.get("-" + letters[k]);
          if (!hit) throw new DockerError(`unknown shorthand flag: '${letters[k]}' in ${a}\n\nSee 'docker ${spec.__cmd ?? ""} --help'.`, 125);
          const [key, type] = hit;
          if (type === "bool") set(key, type, true);
          else { const val = k < letters.length - 1 ? letters.slice(k + 1) : args[++i]; set(key, type, val); break; }
        }
      } else if (/^-[a-zA-Z]=/.test(a)) {
        const hit = look.get(a.slice(0, 2));
        if (!hit) throw new DockerError(`unknown shorthand flag: '${a[1]}' in ${a}`, 125);
        set(hit[0], hit[1], a.slice(3));
      } else rest.push(a);
    }
    return { opts, rest };
  }
  function findContainer(e, ref) {
    if (!ref) return null;
    for (const c of e.containers.values()) if (c.name === ref || c.name === ref.replace(/^\//, "")) return c;
    const hits = [...e.containers.values()].filter((c) => c.id.startsWith(ref));
    return hits.length === 1 ? hits[0] : null;
  }
  const mustContainer = (e, ref) => { const c = findContainer(e, ref); if (!c) throw new DockerError(`Error response from daemon: No such container: ${ref}`); return c; };

  function statusText(e, c) {
    const t = now(e);
    if (c.state === "created") return "Created";
    if (c.state === "running") {
      const h = c.health ? ` (${c.health.status === "starting" ? "health: starting" : c.health.status})` : "";
      return `Up ${humanDuration(t - c.startedAt)}${h}`;
    }
    if (c.crashLoop && c.restart.name !== "no") return `Restarting (${c.exitCode}) ${humanDuration(t - c.finishedAt)} ago`;
    return `Exited (${c.exitCode}) ${humanDuration(t - c.finishedAt)} ago`;
  }
  function portsText(c, { compose = false } = {}) {
    const items = [];
    const exposed = new Set(Object.keys(c.image.config.ExposedPorts ?? {}).concat(c.exposeExtra ?? []));
    if (c.state === "running") {
      for (const p of [...c.ports].sort((a, b) => a.containerPort - b.containerPort)) {
        exposed.delete(`${p.containerPort}/${p.proto}`);
        const ips = p.hostIp ? [p.hostIp] : ["0.0.0.0", "::"];
        for (const ip of ips) items.push({ priv: p.containerPort, text: `${ip.includes(":") ? `[${ip}]` : ip}:${p.hostPort}->${p.containerPort}/${p.proto}`, pub: p.hostPort !== p.containerPort });
      }
    }
    if (c.state !== "running" && !compose) return "";
    const plain = [...exposed].filter((x) => !c.ports.some((p) => `${p.containerPort}/${p.proto}` === x)).map((x) => ({ priv: Number(x.split("/")[0]), text: x }));
    const grouped = [...plain, ...items.filter((x) => !x.pub)].sort((a, b) => a.priv - b.priv);
    return [...grouped.map((x) => x.text), ...items.filter((x) => x.pub).map((x) => x.text)].join(", ");
  }
  const ellipsis = (s, n) => ([...s].length <= n ? s : [...s].slice(0, n - 1).join("") + "…");
  const quoteGo = (s) => JSON.stringify(s);

  function imageRows(e) {
    const rows = [];
    for (const img of e.images.values()) {
      const tags = tagsOf(e, img);
      const inUse = [...e.containers.values()].some((c) => c.image.id === img.id);
      const det = { id: short(img.id), disk: humanSize(img.content + img.unpacked), content: humanSize(img.content), inUse };
      if (!tags.length) rows.push({ name: null, ...det });
      for (const t of tags) rows.push({ name: t, ...det });
    }
    rows.sort((a, b) => ((a.name === null) !== (b.name === null) ? (a.name === null ? 1 : -1) : (a.name ?? "") < (b.name ?? "") ? -1 : (a.name ?? "") > (b.name ?? "") ? 1 : 0));
    return rows;
  }
  function printImages(e, io, opts) {
    const rows = imageRows(e).filter((r) => !opts.filter || (r.name ?? "").startsWith(opts.filter.split(":")[0]) && (!opts.filter.includes(":") || r.name === opts.filter));
    if (opts.quiet) { io.out([...new Set(rows.map((r) => r.id))].map((x) => x + "\n").join("")); return; }
    const anyUse = rows.some((r) => r.inUse);
    const nameW = Math.max(5, ...rows.map((r) => (r.name ?? "<untagged>").length));
    const extraW = 5;
    const pad = (s, w) => s + " ".repeat(Math.max(0, w - [...s].length));
    const rpad = (s, w) => " ".repeat(Math.max(0, w - [...s].length)) + s;
    let text = `${pad("IMAGE", nameW)}   ${pad("ID", 12)}   ${rpad("DISK USAGE", 10)}   ${rpad("CONTENT SIZE", 12)}   ${pad("EXTRA", extraW)}\n`;
    for (const r of rows) text += `${pad(r.name ?? "<untagged>", nameW)}   ${pad(r.id, 12)}   ${rpad(r.disk, 10)}   ${rpad(r.content, 12)}   ${pad(anyUse ? (r.inUse ? "U" : " ") : "", extraW)}\n`;
    io.out(text);
  }

  function inspectContainer(e, c) {
    const argv = argvOf(c);
    const ports = {};
    for (const p of Object.keys(c.image.config.ExposedPorts ?? {})) ports[p] = null;
    for (const p of c.ports) ports[`${p.containerPort}/${p.proto}`] = c.state === "running" ? [{ HostIp: "0.0.0.0", HostPort: String(p.hostPort) }, { HostIp: "::", HostPort: String(p.hostPort) }] : null;
    return {
      Id: c.id, Created: iso(c.created), Path: argv[0], Args: argv.slice(1),
      State: { Status: c.state, Running: c.state === "running", Paused: false, Restarting: false, OOMKilled: false, Dead: false, Pid: c.state === "running" ? 4300 + (parseInt(c.id.slice(0, 4), 16) % 900) : 0, ExitCode: c.exitCode, Error: c.error ?? "", StartedAt: c.startedAt ? iso(c.startedAt) : "0001-01-01T00:00:00Z", FinishedAt: c.finishedAt ? iso(c.finishedAt) : "0001-01-01T00:00:00Z", ...(c.health ? { Health: { Status: c.health.status, FailingStreak: c.health.streak, Log: c.health.log } } : {}) },
      Image: `sha256:${c.image.id}`, Name: `/${c.name}`, RestartCount: c.restartCount,
      HostConfig: { PortBindings: Object.fromEntries(c.ports.map((p) => [`${p.containerPort}/${p.proto}`, [{ HostIp: p.hostIp ?? "", HostPort: String(p.hostPort) }]])), RestartPolicy: { Name: c.restart.name, MaximumRetryCount: c.restart.max ?? 0 }, AutoRemove: c.autoRemove, Init: c.init, Memory: c.memory, NanoCpus: Math.round(c.cpus * 1e9), NetworkMode: Object.keys(c.networks)[0] ?? "bridge" },
      Mounts: c.mounts.map((m) => (m.type === "volume" ? { Type: "volume", Name: m.source, Source: `/var/lib/docker/volumes/${m.source}/_data`, Destination: m.target, Driver: "local", Mode: m.ro ? "ro" : "z", RW: !m.ro, Propagation: "" } : { Type: "bind", Source: m.source, Destination: m.target, Mode: m.ro ? "ro" : "", RW: !m.ro, Propagation: "rprivate" })),
      Config: { Hostname: c.hostname, User: c.userSpec, ExposedPorts: c.image.config.ExposedPorts ?? undefined, Env: Object.entries(c.env).filter(([k]) => k !== "HOME").map(([k, v]) => `${k}=${v}`), Cmd: c.cmd !== undefined ? c.cmd : c.image.config.Cmd, Image: c.imageRef, WorkingDir: c.workdir, Entrypoint: c.entrypoint !== undefined ? c.entrypoint : c.image.config.Entrypoint, Labels: c.labels, ...(c.healthcheck ? { Healthcheck: c.healthcheck } : {}) },
      NetworkSettings: { Ports: ports, Networks: Object.fromEntries(Object.entries(c.networks).map(([nm, ep]) => [nm, { Aliases: ep.aliases.length ? ep.aliases : null, NetworkID: ep.net.id, Gateway: ep.net.gateway, IPAddress: c.state === "running" ? ep.ip : "", IPPrefixLen: 16, MacAddress: c.state === "running" ? "02:42:" + hex(c.id + nm, 8).match(/../g).join(":") : "", DNSNames: nm === "bridge" ? null : [c.name, ...ep.aliases, c.id.slice(0, 12)] }])) },
    };
  }
  function inspectImage(e, img) {
    return {
      Id: `sha256:${img.id}`, RepoTags: tagsOf(e, img), RepoDigests: img.repoDigest ? [img.repoDigest] : [], Created: iso(img.created),
      Config: { Env: img.config.Env, Cmd: img.config.Cmd, Entrypoint: img.config.Entrypoint, WorkingDir: img.config.WorkingDir, User: img.config.User, ExposedPorts: img.config.ExposedPorts ?? undefined, Labels: img.config.Labels ?? null, ...(img.config.Healthcheck ? { Healthcheck: img.config.Healthcheck } : {}), ...(img.config.StopSignal ? { StopSignal: img.config.StopSignal } : {}) },
      Architecture: img.arch, Os: img.os, Size: img.content + img.unpacked,
      RootFS: { Type: "layers", Layers: img.layers.map((l) => `sha256:${hex(l.digest + "diff")}`) },
    };
  }
  // Go templates, the useful part: {{.A.B}}, {{json .A}}, {{index .A "k"}}, {{.A}} of maps and lists
  function goTemplate(tpl, obj) {
    const lookup = (path) => path.split(".").filter(Boolean).reduce((v, k) => (v === null || v === undefined ? undefined : v[k]), obj);
    const fmt = (v) => {
      if (v === undefined || v === null) return "<no value>";
      if (Array.isArray(v)) return "[" + v.map(fmt).join(" ") + "]";
      if (typeof v === "object") return "map[" + Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => `${k}:${fmt(x)}`).join(" ") + "]";
      return String(v);
    };
    if (/\{\{\s*(range|if|with)\b/.test(tpl)) throw new DockerError("template: the sandbox's docker supports {{.Field}}, {{json .Field}} and {{index .Field \"key\"}} (not range, if or with)");
    return tpl.replace(/\{\{\s*(.*?)\s*\}\}/g, (m, expr) => {
      let mm;
      if ((mm = /^json\s+(\.\S*)$/.exec(expr))) return JSON.stringify(mm[1] === "." ? obj : lookup(mm[1]) ?? null);
      if ((mm = /^index\s+(\.\S*)\s+"([^"]*)"$/.exec(expr))) { const v = lookup(mm[1]); return fmt(v ? v[mm[2]] : undefined); }
      if ((mm = /^(\.\S*)$/.exec(expr))) return fmt(mm[1] === "." ? obj : lookup(mm[1]));
      throw new DockerError(`template parsing error: template: :1: function "${expr.split(/\s/)[0]}" not defined`);
    }).replace(/\\n/g, "\n");
  }

  // docker run / create options → container options
  function parsePorts(list) {
    return (list ?? []).map((spec) => {
      const m = /^(?:(\d+\.\d+\.\d+\.\d+|\[[^\]]+\]):)?(?:(\d+):)?(\d+)(?:\/(tcp|udp))?$/.exec(spec);
      if (!m) throw new DockerError(`docker: invalid containerPort: ${spec}\n\nRun 'docker run --help' for more information`, 125);
      const containerPort = Number(m[3]);
      return { hostIp: m[1] ? m[1].replace(/[[\]]/g, "") : null, hostPort: m[2] ? Number(m[2]) : 32768 + (containerPort % 1000), containerPort, proto: m[4] ?? "tcp" };
    });
  }
  function parseMounts(e, sh, vols, mounts) {
    const out = [];
    for (const spec of vols ?? []) {
      const parts = spec.split(":");
      if (parts.length === 1) { out.push({ type: "volume", source: hex("anon" + spec + e.counter), target: parts[0], anonymous: true }); continue; }
      const [src, target, mode] = parts;
      const ro = mode === "ro";
      if (src.startsWith("/") || src.startsWith(".") || src.startsWith("~")) {
        const abs = sh.abs(src);
        if (!sh.fs.exists(abs)) mkdirp(sh.fs, abs);
        out.push({ type: "bind", source: abs, target, ro });
      } else out.push({ type: "volume", source: src, target, ro });
    }
    for (const spec of mounts ?? []) {
      const kv = Object.fromEntries(spec.split(",").map((p) => { const i = p.indexOf("="); return i < 0 ? [p, "true"] : [p.slice(0, i), p.slice(i + 1)]; }));
      const target = kv.target ?? kv.destination ?? kv.dst;
      const src = kv.source ?? kv.src;
      const ro = kv.readonly === "true" || kv.ro === "true";
      if ((kv.type ?? "volume") === "bind") {
        const abs = sh.abs(src);
        if (!sh.fs.exists(abs)) throw new DockerError(`docker: Error response from daemon: invalid mount config for type "bind": bind source path does not exist: ${abs}\n\nRun 'docker run --help' for more information`, 125);
        out.push({ type: "bind", source: abs, target, ro });
      } else out.push({ type: "volume", source: src ?? hex("anon" + target + e.counter), target, ro, anonymous: !src });
    }
    return out;
  }
  function parseEnvFiles(sh, files) {
    const env = {};
    for (const f of files ?? []) {
      const text = sh.fs.text(sh.abs(f));
      if (text === null) throw new DockerError(`docker: open ${f}: no such file or directory\n\nRun 'docker run --help' for more information`, 125);
      for (const line of text.split("\n")) {
        const l = line.trim();
        if (!l || l.startsWith("#")) continue;
        const i = l.indexOf("=");
        if (i < 0) { if (sh.env[l] !== undefined) env[l] = sh.env[l]; continue; }
        env[l.slice(0, i)] = l.slice(i + 1);
      }
    }
    return env;
  }
  const parseMemory = (s) => { if (!s) return 0; const m = /^(\d+(?:\.\d+)?)([bkmg]?)$/i.exec(s); if (!m) return 0; return Math.round(Number(m[1]) * { "": 1, b: 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3 }[m[2].toLowerCase()]); };

  const RUN_FLAGS = { __cmd: "run", "-d|--detach": "bool", "--rm": "bool", "-i|--interactive": "bool", "-t|--tty": "bool", "-p|--publish": "multi", "-P|--publish-all": "bool", "-e|--env": "multi", "--env-file": "multi", "-v|--volume": "multi", "--mount": "multi", "--name": "value", "--network|--net": "value", "--network-alias": "multi", "--restart": "value", "-w|--workdir": "value", "-u|--user": "value", "--entrypoint": "value", "-m|--memory": "value", "--cpus": "value", "--init": "bool", "--pull": "value", "--platform": "value", "-l|--label": "multi", "-h|--hostname": "value", "--health-cmd": "value", "--health-interval": "value", "--health-retries": "value", "--read-only": "bool", "--stop-timeout": "value", "-a|--attach": "multi" };

  async function cmdRun(e, sh, args, io, { createOnly = false } = {}) {
    const { opts, rest } = parseFlags(args, RUN_FLAGS, { stopAtArg: true });
    const [ref, ...cmd] = rest;
    if (!ref) throw new DockerError(`docker: '${createOnly ? "create" : "run"}' requires at least 1 argument\n\nUsage:  docker ${createOnly ? "create" : "run"} [OPTIONS] IMAGE [COMMAND] [ARG...]\n\nSee 'docker ${createOnly ? "create" : "run"} --help' for more information`, 125);
    const name = opts["--name"];
    if (name !== undefined) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/.test(name)) throw new DockerError(`docker: Error response from daemon: Invalid container name (${name}), only [a-zA-Z0-9][a-zA-Z0-9_.-] are allowed\n\nRun 'docker run --help' for more information`, 125);
      const clash = findContainer(e, name);
      if (clash && clash.name === name) throw new DockerError(`docker: Error response from daemon: Conflict. The container name "/${name}" is already in use by container "${clash.id}". You have to remove (or rename) that container to be able to reuse that name.\n\nRun 'docker run --help' for more information`, 125);
    }
    const r = parseRef(ref);
    if (!r.valid) throw new DockerError(`docker: invalid reference format: repository name (${r.path}) must be lowercase\n\nRun 'docker run --help' for more information`, 125);
    let img = opts["--pull"] === "always" ? null : imageOf(e, ref);
    if (!img) {
      if (opts["--pull"] === "never") throw new DockerError(`docker: Error response from daemon: No such image: ${r.familiar}\n\nRun 'docker run --help' for more information`, 125);
      if (opts["--pull"] !== "always") io.err(`Unable to find image '${r.familiar}' locally\n`);
      const res = pull(e, ref, (l) => io.err(l + "\n"));
      if (res.error) throw new DockerError(`docker: Error response from daemon: ${res.error}\n\nRun 'docker run --help' for more information`, 125);
      img = res.image;
    }
    if (opts["-i"] && opts["-t"] && !createOnly && !opts["-d"]) {
      io.err(`(The sandbox has no interactive terminal, so docker run -it can't give you a shell inside the container. Start it in the background with -d, then run single commands in it with docker exec <name> <command>.)\n`);
      return 1;
    }
    const network = opts["--network"] ?? "bridge";
    if (!e.networks.has(network)) throw new DockerError(`docker: Error response from daemon: network ${network} not found\n\nRun 'docker run --help' for more information`, 125);
    const ports = parsePorts(opts["-p"]);
    if (opts["-P"]) for (const p of Object.keys(img.config.ExposedPorts ?? {})) ports.push({ hostIp: null, hostPort: 32768 + (Number(p.split("/")[0]) % 1000), containerPort: Number(p.split("/")[0]), proto: "tcp" });
    for (const p of ports) {
      const busy = [...e.containers.values()].find((c) => c.state === "running" && c.ports.some((q) => q.hostPort === p.hostPort));
      if (busy && !createOnly) {
        // Docker creates the container, then can't start it
        const c = createContainer(e, img, { name, imageRef: ref, cmd: cmd.length ? cmd : undefined, ports, env: {}, network });
        throw new DockerError(`docker: Error response from daemon: failed to set up container networking: driver failed programming external connectivity on endpoint ${c.name} (${hex(c.id + "ep")}): Bind for 0.0.0.0:${p.hostPort} failed: port is already allocated\n\nRun 'docker run --help' for more information`, 125);
      }
    }
    const env = { ...parseEnvFiles(sh, opts["--env-file"]) };
    for (const kv of opts["-e"] ?? []) { const i = kv.indexOf("="); if (i < 0) { if (sh.env[kv] !== undefined) env[kv] = sh.env[kv]; } else env[kv.slice(0, i)] = kv.slice(i + 1); }
    const restartSpec = opts["--restart"] ?? "no";
    const [rname, rmax] = restartSpec.split(":");
    if (!["no", "always", "unless-stopped", "on-failure"].includes(rname)) throw new DockerError(`docker: invalid restart policy '${restartSpec}'\n\nRun 'docker run --help' for more information`, 125);
    if (opts["--rm"] && rname !== "no") throw new DockerError(`docker: conflicting options: cannot specify both --restart and --rm\n\nRun 'docker run --help' for more information`, 125);
    const labels = Object.fromEntries((opts["-l"] ?? []).map((kv) => { const i = kv.indexOf("="); return i < 0 ? [kv, ""] : [kv.slice(0, i), kv.slice(i + 1)]; }));
    const healthcheck = opts["--health-cmd"] ? { Test: ["CMD-SHELL", opts["--health-cmd"]], Interval: durationNs(opts["--health-interval"] ?? "30s"), Retries: Number(opts["--health-retries"] ?? 3) } : undefined;
    const c = createContainer(e, img, {
      name, imageRef: ref, cmd: cmd.length ? cmd : undefined, entrypoint: opts["--entrypoint"] !== undefined ? (opts["--entrypoint"] ? [opts["--entrypoint"]] : null) : undefined,
      ports, env, mounts: parseMounts(e, sh, opts["-v"], opts["--mount"]), network, aliases: opts["--network-alias"] ?? [],
      restart: { name: rname, max: Number(rmax ?? 0) }, rm: opts["--rm"], init: opts["--init"], workdir: opts["-w"], user: opts["-u"],
      memory: parseMemory(opts["-m"]), cpus: Number(opts["--cpus"] ?? 0), labels, hostname: opts["-h"], healthcheck,
    });
    if (opts["--stop-timeout"]) c.stopTimeout = Number(opts["--stop-timeout"]);
    tick(e);
    if (createOnly) { io.out(c.id + "\n"); return 0; }
    const err = await startContainer(e, c);
    if (err) {
      c.state = "created"; c.exitCode = err.code;
      if (opts["--rm"]) removeContainer(e, c);
      throw new DockerError(`docker: Error response from daemon: ${err.error}\n\nRun 'docker run --help' for more information`, err.code);
    }
    tick(e);
    if (opts["-d"]) {
      io.out(c.id + "\n");
      await settle(e);
      return 0;
    }
    // in the foreground: the container's output, and its exit status
    for (const [k, t] of c.logs) (k === "err" ? io.err(t) : io.out(t));
    if (c.state === "running") {
      io.out(`\n(The container ${c.name} is still running: its process is a server. In a real terminal, docker run would stay attached and show its output until you stop it; the sandbox gives you the prompt back. Use -d to run it in the background, and docker stop ${c.name} to stop it.)\n`);
      return 0;
    }
    const code = c.exitCode;
    await settle(e);
    return code;
  }

  async function dispatch(sh, args, io) {
    const e = engine(sh);
    tick(e);
    for (const c of e.containers.values()) await refreshHealth(e, c);
    const [cmd, ...rest] = args;
    const sub = rest[0];
    switch (cmd) {
      case undefined: case "help": case "--help":
        io.out(`\nUsage:  docker [OPTIONS] COMMAND\n\nA self-sufficient runtime for containers\n\nCommon Commands:\n  run         Create and run a new container from an image\n  exec        Execute a command in a running container\n  ps          List containers\n  build       Build an image from a Dockerfile\n  pull        Download an image from a registry\n  push        Upload an image to a registry\n  images      List images\n  login       Authenticate to a registry\n  logout      Log out from a registry\n  version     Show the Docker version information\n\nManagement Commands:\n  compose*    Docker Compose\n  container   Manage containers\n  image       Manage images\n  network     Manage networks\n  volume      Manage volumes\n\nCommands:\n  history     Show the history of an image\n  inspect     Return low-level information on Docker objects\n  kill        Kill one or more running containers\n  logs        Fetch the logs of a container\n  restart     Restart one or more containers\n  rm          Remove one or more containers\n  rmi         Remove one or more images\n  start       Start one or more stopped containers\n  stats       Display a live stream of container(s) resource usage statistics\n  stop        Stop one or more running containers\n  tag         Create a tag TARGET_IMAGE that refers to SOURCE_IMAGE\n\nRun 'docker COMMAND --help' for more information on a command.\n`);
        return 0;
      case "--version": case "-v": io.out(`Docker version ${VERSION.cli}, build ${VERSION.build}\n`); return 0;
      case "version":
        io.out(`Client:\n Version:           ${VERSION.cli}\n API version:       1.53\n Go version:        go1.26.2\n Git commit:        ${VERSION.build}\n Built:             Tue Oct 14 18:09:52 2026\n OS/Arch:           linux/amd64\n Context:           default\n\nServer: Docker Engine - Community\n Engine:\n  Version:          ${VERSION.cli}\n  API version:      1.53 (minimum version 1.44)\n  Go version:       go1.26.2\n  Git commit:       512aee9\n  Built:            Tue Oct 14 18:12:20 2026\n  OS/Arch:          linux/amd64\n containerd:\n  Version:          v2.2.4\n runc:\n  Version:          1.4.2\n`);
        return 0;
      case "run": return cmdRun(e, sh, rest, io);
      case "create": return cmdRun(e, sh, rest, io, { createOnly: true });
      case "container": {
        const map = { ls: "ps", list: "ps", run: "run", rm: "rm", stop: "stop", start: "start", restart: "restart", logs: "logs", exec: "exec", inspect: "inspect", kill: "kill", create: "create", prune: "container-prune", stats: "stats" };
        if (!map[sub]) { io.out("\nUsage:  docker container COMMAND\n\nManage containers\n\nCommands:\n  create, exec, inspect, kill, logs, ls, prune, restart, rm, run, start, stats, stop\n"); return sub ? 1 : 0; }
        return dispatch(sh, [map[sub], ...rest.slice(1)], io).finally(() => { e.ticks--; });
      }
      case "image": {
        const map = { ls: "images", list: "images", rm: "rmi", remove: "rmi", pull: "pull", push: "push", tag: "tag", history: "history", inspect: "image-inspect", build: "build", prune: "image-prune" };
        if (!map[sub]) { io.out("\nUsage:  docker image COMMAND\n\nManage images\n\nCommands:\n  build, history, inspect, ls, prune, pull, push, rm, tag\n"); return sub ? 1 : 0; }
        return dispatch(sh, [map[sub], ...rest.slice(1)], io).finally(() => { e.ticks--; });
      }
      case "ps": {
        const { opts } = parseFlags(rest, { __cmd: "ps", "-a|--all": "bool", "-q|--quiet": "bool", "--format": "value", "-f|--filter": "multi", "-n|--last": "value", "-l|--latest": "bool", "-s|--size": "bool", "--no-trunc": "bool" });
        let list = [...e.containers.values()].reverse().filter((c) => opts["-a"] || c.state === "running" || (c.crashLoop && c.restart.name !== "no"));
        for (const f of opts["-f"] ?? []) {
          const [k, v] = f.split("=");
          list = list.filter((c) => (k === "status" ? c.state === v : k === "name" ? c.name.includes(v) : k === "ancestor" ? c.imageRef === v || tagsOf(e, c.image).includes(v) : k === "label" ? (v.includes("=") ? c.labels[v.split("=")[0]] === v.split("=")[1] : v in c.labels) : true));
        }
        if (opts["-q"]) { io.out(list.map((c) => short(c.id) + "\n").join("")); return 0; }
        if (opts["--format"]) {
          for (const c of list) io.out(goTemplate(opts["--format"].replace(/^table\s+/, ""), { ID: short(c.id), Names: c.name, Image: c.imageRef, Status: statusText(e, c), State: c.state, Ports: portsText(c), Command: quoteGo(ellipsis(commandString(c), 20)), RunningFor: humanDuration(now(e) - c.created) + " ago" }) + "\n");
          return 0;
        }
        const rows = [["CONTAINER ID", "IMAGE", "COMMAND", "CREATED", "STATUS", "PORTS", "NAMES"]];
        for (const c of list) rows.push([short(c.id), c.imageRef, quoteGo(ellipsis(commandString(c), 20)), humanDuration(now(e) - c.created) + " ago", statusText(e, c), portsText(c), c.name]);
        io.out(table(rows));
        return 0;
      }
      case "images": {
        const { opts, rest: r2 } = parseFlags(rest, { __cmd: "images", "-a|--all": "bool", "-q|--quiet": "bool", "--tree": "bool", "--digests": "bool", "--format": "value", "-f|--filter": "multi" });
        if (opts["-f"]?.some((f) => f === "dangling=true")) {
          const rows = imageRows(e).filter((x) => !x.name);
          if (opts["-q"]) { io.out(rows.map((x) => x.id + "\n").join("")); return 0; }
        }
        printImages(e, io, { quiet: opts["-q"], filter: r2[0] });
        return 0;
      }
      case "pull": {
        const { opts, rest: r2 } = parseFlags(rest, { __cmd: "pull", "-q|--quiet": "bool", "--platform": "value", "-a|--all-tags": "bool" });
        if (!r2[0]) throw new DockerError("docker: 'docker pull' requires 1 argument\n\nUsage:  docker pull [OPTIONS] NAME[:TAG|@DIGEST]\n\nRun 'docker pull --help' for more information", 1);
        const res = pull(e, r2[0], (l) => io.out(l + "\n"), { quiet: opts["-q"] });
        if (res.error) throw new DockerError(`Error response from daemon: ${res.error}`);
        io.out(parseRef(r2[0]).full + "\n");
        return 0;
      }
      case "build": return cmdBuild(e, sh, rest, io);
      case "buildx": {
        if (sub === "build" || sub === "b") return cmdBuild(e, sh, rest.slice(1), io, true);
        if (sub === "version") { io.out(`github.com/docker/buildx ${VERSION.buildx} 6f1b2a4\n`); return 0; }
        if (sub === "ls") { io.out(table([["NAME/NODE", "DRIVER/ENDPOINT", "STATUS", "BUILDKIT", "PLATFORMS"], [`${e.builder.name}*`, e.builder.driver, "", "", ""], [` \\_ ${e.builder.name}`, ` \\_ ${e.builder.name}`, "running", VERSION.buildkit, "linux/amd64 (+3), linux/386"]])); return 0; }
        io.out("Usage:  docker buildx [OPTIONS] COMMAND\n\nIn the sandbox: docker buildx build, docker buildx ls, docker buildx version\n"); return sub ? 1 : 0;
      }
      case "tag": {
        const [src, dst] = rest;
        if (!src || !dst) throw new DockerError("docker: 'docker tag' requires 2 arguments\n\nUsage:  docker tag SOURCE_IMAGE[:TAG] TARGET_IMAGE[:TAG]\n\nRun 'docker tag --help' for more information", 1);
        const img = imageOf(e, src);
        if (!img) throw new DockerError(`Error response from daemon: No such image: ${parseRef(src).familiar}`);
        const d = parseRef(dst);
        if (!d.valid) throw new DockerError(`Error parsing reference: "${dst}" is not a valid repository/tag: invalid reference format${/[A-Z]/.test(dst) ? ": repository name (" + d.path + ") must be lowercase" : ""}`);
        setTag(e, dst, img);
        return 0;
      }
      case "rmi": {
        const { opts, rest: r2 } = parseFlags(rest, { __cmd: "rmi", "-f|--force": "bool", "--no-prune": "bool" });
        let status = 0;
        for (const ref of r2) {
          const img = imageOf(e, ref);
          if (!img) { io.err(`Error response from daemon: No such image: ${parseRef(ref).familiar}\n`); status = 1; continue; }
          const users = [...e.containers.values()].filter((c) => c.image.id === img.id);
          const byTag = e.tags.get(parseRef(ref).full) === img.id;
          const tags = tagsOf(e, img);
          if (byTag && tags.length > 1) { e.tags.delete(parseRef(ref).full); io.out(`Untagged: ${parseRef(ref).familiar}\n`); continue; }
          if (users.length && !opts["-f"]) {
            const run = users.find((c) => c.state === "running");
            io.err(`Error response from daemon: conflict: unable to delete ${byTag ? parseRef(ref).familiar : short(img.id)} (${run ? "cannot be forced" : "must be forced"}) - image is being used by ${run ? "running" : "stopped"} container ${short((run ?? users[0]).id)}\n`);
            status = 1; continue;
          }
          if (users.some((c) => c.state === "running")) { io.err(`Error response from daemon: conflict: unable to delete ${parseRef(ref).familiar} (cannot be forced) - image is being used by running container ${short(users.find((c) => c.state === "running").id)}\n`); status = 1; continue; }
          for (const t of tags) { e.tags.delete(parseRef(t).full); io.out(`Untagged: ${t}\n`); }
          e.images.delete(img.id);
          io.out(`Deleted: sha256:${img.id}\n`);
        }
        return status;
      }
      case "image-prune": {
        const { opts } = parseFlags(rest, { __cmd: "image prune", "-a|--all": "bool", "-f|--force": "bool" });
        let freed = 0, out = "";
        for (const img of [...e.images.values()]) {
          const used = [...e.containers.values()].some((c) => c.image.id === img.id);
          const tags = tagsOf(e, img);
          if (used || (tags.length && !opts["-a"])) continue;
          for (const t of tags) { e.tags.delete(parseRef(t).full); out += `untagged: ${t}\n`; }
          out += `deleted: sha256:${img.id}\n`;
          freed += img.unpacked + img.content;
          e.images.delete(img.id);
        }
        if (!opts["-f"]) io.out(`WARNING! This will remove all ${opts["-a"] ? "images without at least one container associated to them" : "dangling images"}.\n(The sandbox can't ask "Are you sure you want to continue? [y/N]": it answers y for you. Add -f to skip the question.)\n`);
        io.out((out ? "Deleted Images:\n" + out + "\n" : "") + `Total reclaimed space: ${humanSize(freed)}\n`);
        return 0;
      }
      case "history": {
        const { opts, rest: r2 } = parseFlags(rest, { __cmd: "history", "--no-trunc": "bool", "-q|--quiet": "bool", "-H|--human": "bool", "--format": "value" });
        const img = imageOf(e, r2[0] ?? "");
        if (!img) throw new DockerError(`Error response from daemon: No such image: ${parseRef(r2[0] ?? "").familiar}`);
        const rows = [["IMAGE", "CREATED", "CREATED BY", "SIZE", "COMMENT"]];
        const hist = [...img.history].reverse();
        hist.forEach((h, i) => rows.push([i === 0 ? short(img.id) : "<missing>", humanDuration(now(e) - h.created) + " ago", opts["--no-trunc"] ? h.createdBy : ellipsis(h.createdBy, 45), humanSize(h.size), "buildkit.dockerfile.v0"]));
        io.out(table(rows));
        return 0;
      }
      case "image-inspect": case "inspect": {
        const { opts, rest: r2 } = parseFlags(rest, { __cmd: "inspect", "-f|--format": "value", "--type": "value", "-s|--size": "bool" });
        if (!r2.length) throw new DockerError("docker: 'docker inspect' requires at least 1 argument", 1);
        const objs = [];
        let status = 0;
        for (const ref of r2) {
          const c = cmd === "inspect" && opts["--type"] !== "image" ? findContainer(e, ref) : null;
          const img = !c ? imageOf(e, ref) : null;
          const v = !c && !img && cmd === "inspect" ? e.volumes.get(ref) : null;
          const n = !c && !img && !v && cmd === "inspect" ? e.networks.get(ref) : null;
          if (c) objs.push(inspectContainer(e, c));
          else if (img) objs.push(inspectImage(e, img));
          else if (v) objs.push(volumeInfo(e, v));
          else if (n) objs.push(networkInfo(e, n));
          else { io.err(`Error: No such ${cmd === "image-inspect" ? "image" : "object"}: ${ref}\n`); status = 1; }
        }
        if (opts["-f"]) for (const o of objs) io.out(goTemplate(opts["-f"], o) + "\n");
        else io.out(JSON.stringify(objs, null, 4).replace(/^/gm, "") + "\n");
        return status;
      }
      case "logs": {
        const { opts, rest: r2 } = parseFlags(rest, { __cmd: "logs", "-f|--follow": "bool", "-n|--tail": "value", "-t|--timestamps": "bool", "--since": "value", "--until": "value", "--details": "bool" });
        const c = mustContainer(e, r2[0]);
        let parts = c.logs.map(([k, t]) => [k, t]);
        if (opts["-n"] !== undefined && opts["-n"] !== "all") {
          const n = Number(opts["-n"]);
          const lines = [];
          for (const [k, t] of parts) for (const l of t.replace(/\n$/, "").split("\n")) if (t) lines.push([k, l + "\n"]);
          parts = lines.slice(Math.max(0, lines.length - n));
        }
        for (const [k, t] of parts) (k === "err" ? io.err(t) : io.out(t));
        if (opts["-f"] && c.state === "running") io.out(`(docker logs -f keeps printing new output until you press Ctrl+C; the sandbox stops here.)\n`);
        return 0;
      }
      case "exec": {
        const { opts, rest: r2 } = parseFlags(rest, { __cmd: "exec", "-i|--interactive": "bool", "-t|--tty": "bool", "-u|--user": "value", "-w|--workdir": "value", "-e|--env": "multi", "-d|--detach": "bool" }, { stopAtArg: true });
        const [ref, ...argv] = r2;
        if (!ref || !argv.length) throw new DockerError("docker: 'docker exec' requires at least 2 arguments\n\nUsage:  docker exec [OPTIONS] CONTAINER COMMAND [ARG...]\n\nSee 'docker exec --help' for more information", 1);
        const c = mustContainer(e, ref);
        if (c.state !== "running") throw new DockerError(`Error response from daemon: container ${c.id} is not running`);
        const exe = argv[0];
        if (!exe.includes("/") && !c.image.bins.includes(exe)) {
          throw new DockerError(`OCI runtime exec failed: exec failed: unable to start container process: exec: "${exe}": executable file not found in $PATH: unknown`, 127);
        }
        if (opts["-i"] && opts["-t"] && ["sh", "bash", "ash", "/bin/sh", "/bin/bash"].includes(exe) && argv.length === 1) {
          io.err(`(The sandbox has no interactive terminal, so docker exec -it ${ref} ${exe} can't open a shell. Run single commands instead, like docker exec ${ref} ls, or several at once with docker exec ${ref} sh -c "cd /app && ls".)\n`);
          return 1;
        }
        const env = Object.fromEntries((opts["-e"] ?? []).map((kv) => { const i = kv.indexOf("="); return [kv.slice(0, i), kv.slice(i + 1)]; }));
        const r = await execIn(e, c, argv[0] === "sh" && argv[1] === "-c" ? ["/bin/sh", "-c", argv.slice(2).join(" ")] : argv, { user: opts["-u"], workdir: opts["-w"], env, io: opts["-d"] ? null : io, stdin: opts["-i"] ? io.stdin : "", detached: !!opts["-d"] });
        await settle(e);
        return opts["-d"] ? 0 : r.code;
      }
      case "stop": case "kill": case "restart": {
        const { opts, rest: r2 } = parseFlags(rest, { __cmd: cmd, "-t|--timeout|--time": "value", "-s|--signal": "value" });
        if (!r2.length) throw new DockerError(`docker: 'docker ${cmd}' requires at least 1 argument\n\nUsage:  docker ${cmd} [OPTIONS] CONTAINER [CONTAINER...]\n\nRun 'docker ${cmd} --help' for more information`, 1);
        let status = 0;
        for (const ref of r2) {
          const c = findContainer(e, ref);
          if (!c) { io.err(`Error response from daemon: No such container: ${ref}\n`); status = 1; continue; }
          if (cmd === "kill" && c.state !== "running") { io.err(`Error response from daemon: cannot kill container: ${ref}: container ${c.id} is not running\n`); status = 1; continue; }
          await stopContainer(e, c, opts["-t"] !== undefined ? Number(opts["-t"]) : null, { kill: cmd === "kill" });
          if (cmd === "restart") { c.stoppedByUser = false; c.restartCount++; await startContainer(e, c); }
          else if (c.autoRemove) removeContainer(e, c);
          io.out(ref + "\n");
        }
        await settle(e);
        return status;
      }
      case "start": {
        const { opts, rest: r2 } = parseFlags(rest, { __cmd: "start", "-a|--attach": "bool", "-i|--interactive": "bool" });
        let status = 0;
        for (const ref of r2) {
          const c = findContainer(e, ref);
          if (!c) { io.err(`Error response from daemon: No such container: ${ref}\n`); status = 1; continue; }
          if (c.state !== "running") {
            c.stoppedByUser = false;
            const before = c.logs.length;
            const err = await startContainer(e, c);
            if (err) { io.err(`Error response from daemon: ${err.error}\nError: failed to start containers: ${ref}\n`); status = 1; continue; }
            if (opts["-a"]) { for (const [k, t] of c.logs.slice(before)) (k === "err" ? io.err(t) : io.out(t)); continue; }
          }
          io.out(ref + "\n");
        }
        await settle(e);
        return status;
      }
      case "rm": {
        const { opts, rest: r2 } = parseFlags(rest, { __cmd: "rm", "-f|--force": "bool", "-v|--volumes": "bool" });
        if (!r2.length) throw new DockerError("docker: 'docker rm' requires at least 1 argument\n\nUsage:  docker rm [OPTIONS] CONTAINER [CONTAINER...]\n\nSee 'docker rm --help' for more information", 1);
        let status = 0;
        for (const ref of r2) {
          const c = findContainer(e, ref);
          if (!c) { io.err(`Error response from daemon: No such container: ${ref}\n`); status = 1; continue; }
          if (c.state === "running" && !opts["-f"]) { io.err(`Error response from daemon: cannot remove container "${ref}": container is running: stop the container before removing or force remove\n`); status = 1; continue; }
          if (c.state === "running") await stopContainer(e, c, 0, { kill: true });
          removeContainer(e, c);
          io.out(ref + "\n");
        }
        return status;
      }
      case "container-prune": {
        const gone = [...e.containers.values()].filter((c) => c.state !== "running");
        for (const c of gone) removeContainer(e, c);
        io.out((gone.length ? "Deleted Containers:\n" + gone.map((c) => c.id + "\n").join("") + "\n" : "") + `Total reclaimed space: ${humanSize(gone.length * 4096)}\n`);
        return 0;
      }
      case "stats": {
        const list = [...e.containers.values()].filter((c) => c.state === "running").reverse();
        const rows = [["CONTAINER ID", "NAME", "CPU %", "MEM USAGE / LIMIT", "MEM %", "NET I/O", "BLOCK I/O", "PIDS"]];
        for (const c of list) {
          const isNode = /node/.test(c.mainProc?.cmd ?? "");
          const used = c.nginxAlive ? 9.8 : isNode ? 41.3 + (parseInt(c.id.slice(0, 2), 16) % 30) / 10 : 1.2;
          const limit = c.memory ? c.memory / 1024 ** 2 : 7.65 * 1024;
          rows.push([short(c.id), c.name, "0.00%", `${used.toFixed(2)}MiB / ${c.memory ? Number((c.memory / 1024 ** 2).toFixed(2)) + "MiB" : "7.65GiB"}`, `${(used / limit * 100).toFixed(2)}%`, "1.17kB / 126B", "0B / 0B", c.nginxAlive ? "3" : isNode ? "7" : "1"]);
        }
        io.out(table(rows));
        if (!rest.includes("--no-stream")) io.out("(docker stats keeps refreshing until you press Ctrl+C; the sandbox shows it once, like docker stats --no-stream.)\n");
        return 0;
      }
      case "volume": return cmdVolume(e, sh, rest, io);
      case "network": return cmdNetwork(e, sh, rest, io);
      case "login": return cmdLogin(e, sh, rest, io);
      case "logout": {
        const host = rest[0] ?? "https://index.docker.io/v1/";
        const key = host === "docker.io" ? "https://index.docker.io/v1/" : host;
        if (!e.auth[key]) { io.out(`Not logged in to ${host === "https://index.docker.io/v1/" ? "docker.io" : host}\n`); return 0; }
        delete e.auth[key];
        writeDockerConfig(sh, e);
        io.out(`Removing login credentials for ${key}\n`);
        return 0;
      }
      case "push": return cmdPush(e, sh, rest, io);
      case "compose": return COMPOSE.run(e, sh, rest, io);
      case "system": {
        if (sub === "df") {
          const imgs = [...e.images.values()];
          const active = imgs.filter((i) => [...e.containers.values()].some((c) => c.image.id === i.id));
          const total = imgs.reduce((s, i) => s + i.content + i.unpacked, 0);
          io.out(table([["TYPE", "TOTAL", "ACTIVE", "SIZE", "RECLAIMABLE"], ["Images", String(imgs.length), String(active.length), humanSize(total), `${humanSize(total - active.reduce((s, i) => s + i.content + i.unpacked, 0))} (${total ? Math.round((1 - active.reduce((s, i) => s + i.content + i.unpacked, 0) / total) * 100) : 0}%)`], ["Containers", String(e.containers.size), String([...e.containers.values()].filter((c) => c.state === "running").length), humanSize(e.containers.size * 4096), "0B (0%)"], ["Local Volumes", String(e.volumes.size), String(e.volumes.size), humanSize([...e.volumes.values()].reduce((s, v) => s + [...(v.files ?? new Map()).values()].reduce((a, n) => a + (n.data?.length ?? 0), 0), 0)), "0B (0%)"], ["Build Cache", String(e.cache.size), "0", humanSize(e.cache.size * 4096), humanSize(e.cache.size * 4096)]]));
          return 0;
        }
        if (sub === "prune") {
          const gone = [...e.containers.values()].filter((c) => c.state !== "running");
          for (const c of gone) removeContainer(e, c);
          let freed = 0;
          for (const img of [...e.images.values()]) if (!tagsOf(e, img).length && ![...e.containers.values()].some((c) => c.image.id === img.id)) { freed += img.content + img.unpacked; e.images.delete(img.id); }
          for (const [nm, n] of [...e.networks]) if (!n.builtin && ![...e.containers.values()].some((c) => c.networks[nm])) e.networks.delete(nm);
          freed += e.cache.size * 4096; e.cache.clear();
          io.out(`(docker system prune asks "Are you sure you want to continue? [y/N]"; the sandbox answers y for you.)\nTotal reclaimed space: ${humanSize(freed)}\n`);
          return 0;
        }
        io.out("Usage:  docker system COMMAND\n\nIn the sandbox: docker system df, docker system prune\n");
        return sub ? 1 : 0;
      }
      case "info": io.out(`Client:\n Version:    ${VERSION.cli}\n Context:    default\n Plugins:\n  buildx: Docker Buildx (Docker Inc.)\n    Version:  ${VERSION.buildx}\n  compose: Docker Compose (Docker Inc.)\n    Version:  ${VERSION.compose}\n\nServer:\n Containers: ${e.containers.size}\n  Running: ${[...e.containers.values()].filter((c) => c.state === "running").length}\n Images: ${e.images.size}\n Server Version: ${VERSION.cli}\n Storage Driver: overlayfs\n  driver-type: io.containerd.snapshotter.v1\n Cgroup Driver: systemd\n Cgroup Version: 2\n Default Runtime: runc\n Operating System: Ubuntu 24.04.3 LTS\n Architecture: x86_64\n CPUs: 4\n Total Memory: 7.65GiB\n`); return 0;
      case "scout": io.out("(Docker Scout scans an image's packages for known vulnerabilities and needs a Docker account and the internet: try docker scout quickview shop:1.0 on your own computer. The sandbox can't run it.)\n"); return 0;
      case "init": io.out("(docker init asks questions interactively and writes a Dockerfile, compose.yaml and .dockerignore for your project: try it on your own computer. The sandbox can't run interactive prompts.)\n"); return 0;
      default:
        throw new DockerError(`docker: unknown command: docker ${cmd}\n\nRun 'docker --help' for more information`, 1);
    }
  }

  async function cmdBuild(e, sh, args, io) {
    const { opts, rest } = parseFlags(args, { __cmd: "build", "-t|--tag": "multi", "-f|--file": "value", "--target": "value", "--build-arg": "multi", "--no-cache": "bool", "--progress": "value", "-q|--quiet": "bool", "--platform": "value", "--push": "bool", "--load": "bool", "--label": "multi", "--pull": "bool", "--secret": "multi", "--iidfile": "value", "--provenance": "value", "--sbom": "value", "--check": "bool" });
    if (!rest.length) throw new DockerError("ERROR: docker: 'docker buildx build' requires 1 argument\n\nUsage:  docker buildx build [OPTIONS] PATH | URL | -\n\nRun 'docker buildx build --help' for more information", 1);
    for (const t of opts["-t"] ?? []) {
      const r = parseRef(t);
      if (!r.valid) { io.err(`ERROR: failed to build: invalid tag "${t}": invalid reference format${/[A-Z]/.test(t) ? ": repository name (" + r.path + ") must be lowercase" : ""}\n`); return 1; }
    }
    const platforms = (opts["--platform"] ?? "").split(",").filter(Boolean);
    if (platforms.length > 1 || platforms.some((p) => p !== "linux/amd64")) io.err(`(The sandbox builds for linux/amd64 only. On your own computer, Docker builds each platform in --platform, using emulation (QEMU) for the ones your machine can't run natively.)\n`);
    const buildArgs = Object.fromEntries((opts["--build-arg"] ?? []).map((kv) => { const i = kv.indexOf("="); return i < 0 ? [kv, sh.env[kv] ?? ""] : [kv.slice(0, i), kv.slice(i + 1)]; }));
    const labels = Object.fromEntries((opts["--label"] ?? []).map((kv) => { const i = kv.indexOf("="); return [kv.slice(0, i), kv.slice(i + 1)]; }));
    let text = "";
    const quiet = opts["-q"];
    if (opts["--check"]) {
      // docker build --check: run the build checks only
      const df = sh.fs.text(opts["-f"] ? sh.abs(opts["-f"]) : sh.abs(rest[0]) + "/Dockerfile");
      if (df === null) { io.err("ERROR: failed to build: failed to solve: failed to read dockerfile: open Dockerfile: no such file or directory\n"); return 1; }
      const r = await build(e, sh, { context: rest[0], file: opts["-f"], tags: [], noHeader: true, quietWarnings: true }, () => {});
      const ws = r.warnings ?? [];
      if (!ws.length) { io.out("Check complete, no warnings found.\n"); return 0; }
      // each warning with its rule's documentation page, then the count
      for (const w of ws) {
        const [rule, rest] = [w.slice(0, w.indexOf(":")), w.slice(w.indexOf(":") + 2)];
        const kebab = rule.replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
        io.out(`\nWARNING: ${rule} - https://docs.docker.com/go/dockerfile/rule/${kebab}/\n${rest.replace(/ \(line \d+\)$/, "")}\n`);
      }
      io.out(`\nCheck complete, ${ws.length} warning${ws.length === 1 ? " has" : "s have"} been found!\n`);
      return 1;
    }
    const r = await build(e, sh, { context: rest[0], file: opts["-f"], tags: opts["-t"] ?? [], target: opts["--target"], buildArgs, noCache: opts["--no-cache"], labels, push: opts["--push"], load: opts["--load"] }, (s) => { text += s; });
    if (quiet) { if (r.ok) io.out(`sha256:${r.image.id}\n`); else io.err(text); return r.code; }
    // BuildKit writes its progress to stderr; the sandbox shows it as ordinary output (it's not an error)
    if (r.ok) io.out(text); else {
      const i = text.lastIndexOf("\nERROR: ");
      const j = text.search(/\n------\n|\nDockerfile:\d+\n|\nERROR: /);
      io.out(text.slice(0, j >= 0 ? j + 1 : text.length));
      io.err(text.slice(j >= 0 ? j + 1 : text.length));
      void i;
    }
    if (r.ok && opts["--iidfile"]) await sh.fs.writeFile(sh.abs(opts["--iidfile"]), `sha256:${r.image.id}`);
    if (r.ok && opts["--push"]) for (const t of opts["-t"] ?? []) { const res = pushImage(e, sh, t, r.image, null); if (res.error) { io.err(`ERROR: failed to build: failed to solve: failed to push ${parseRef(t).full}: ${res.error}\n`); return 1; } }
    return r.code;
  }

  /* ------------------------------------------------------------ volumes and networks */

  function volumeInfo(e, v) { return { CreatedAt: iso(v.created).replace(/\.\d+Z$/, "Z"), Driver: "local", Labels: v.labels ?? null, Mountpoint: `/var/lib/docker/volumes/${v.name}/_data`, Name: v.name, Options: null, Scope: "local" }; }
  function cmdVolume(e, sh, args, io) {
    const [sub, ...rest] = args;
    if (sub === "create") {
      const name = rest.find((a) => !a.startsWith("-")) ?? hex("vol" + e.counter++);
      if (!e.volumes.has(name)) e.volumes.set(name, { name, created: now(e), files: null });
      io.out(name + "\n");
      return 0;
    }
    if (sub === "ls" || sub === "list") {
      const q = rest.includes("-q") || rest.includes("--quiet");
      const vols = [...e.volumes.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
      io.out(q ? vols.map((v) => v.name + "\n").join("") : table([["DRIVER", "VOLUME NAME"], ...vols.map((v) => ["local", v.name])]));
      return 0;
    }
    if (sub === "inspect") {
      const out = [];
      let status = 0;
      for (const n of rest.filter((a) => !a.startsWith("-"))) { const v = e.volumes.get(n); if (!v) { io.err(`Error response from daemon: get ${n}: no such volume\n`); status = 1; } else out.push(volumeInfo(e, v)); }
      if (out.length || !status) io.out(JSON.stringify(out, null, 4) + "\n");
      return status;
    }
    if (sub === "rm" || sub === "remove") {
      let status = 0;
      for (const n of rest.filter((a) => !a.startsWith("-"))) {
        if (!e.volumes.has(n)) { io.err(`Error response from daemon: get ${n}: no such volume\n`); status = 1; continue; }
        const users = [...e.containers.values()].filter((c) => c.mounts.some((m) => m.type === "volume" && m.source === n));
        if (users.length) { io.err(`Error response from daemon: remove ${n}: volume is in use - [${users.map((c) => c.id).join(", ")}]\n`); status = 1; continue; }
        e.volumes.delete(n);
        io.out(n + "\n");
      }
      return status;
    }
    if (sub === "prune") {
      const all = rest.includes("-a") || rest.includes("--all");
      const gone = [...e.volumes.values()].filter((v) => (all || v.anonymous || /^[0-9a-f]{64}$/.test(v.name)) && ![...e.containers.values()].some((c) => c.mounts.some((m) => m.source === v.name)));
      for (const v of gone) e.volumes.delete(v.name);
      io.out((gone.length ? "Deleted Volumes:\n" + gone.map((v) => v.name + "\n").join("") + "\n" : "") + "Total reclaimed space: 0B\n");
      return 0;
    }
    io.out("\nUsage:  docker volume COMMAND\n\nManage volumes\n\nCommands:\n  create, inspect, ls, prune, rm\n");
    return sub ? 1 : 0;
  }
  function networkInfo(e, n) {
    return { Name: n.name, Id: n.id, Created: iso(n.created ?? BASE_TIME), Scope: "local", Driver: n.driver, IPAM: n.subnet ? { Driver: "default", Config: [{ Subnet: n.subnet, Gateway: n.gateway }] } : { Driver: "default", Config: [] },
      Containers: Object.fromEntries([...e.containers.values()].filter((c) => c.networks[n.name] && c.state === "running").map((c) => [c.id, { Name: c.name, IPv4Address: c.networks[n.name].ip + "/16" }])), Labels: n.labels ?? {} };
  }
  function createNetwork(e, name, labels = {}) {
    const k = [...e.networks.values()].filter((x) => x.prefix).length;
    const net = { name, id: hex("net:" + name + e.counter++), driver: "bridge", subnet: `172.${17 + k}.0.0/16`, gateway: `172.${17 + k}.0.1`, prefix: `172.${17 + k}.0.`, next: 2, labels, created: now(e) };
    e.networks.set(name, net);
    return net;
  }
  function cmdNetwork(e, sh, args, io) {
    const [sub, ...rest] = args;
    const names = rest.filter((a) => !a.startsWith("-"));
    if (sub === "create") {
      const name = names[0];
      if (!name) throw new DockerError("docker: 'docker network create' requires 1 argument", 1);
      if (e.networks.has(name)) throw new DockerError(`Error response from daemon: network with name ${name} already exists`);
      io.out(createNetwork(e, name).id + "\n");
      return 0;
    }
    if (sub === "ls" || sub === "list") {
      const nets = [...e.networks.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
      io.out(rest.includes("-q") ? nets.map((n) => n.id.slice(0, 12) + "\n").join("") : table([["NETWORK ID", "NAME", "DRIVER", "SCOPE"], ...nets.map((n) => [n.id.slice(0, 12), n.name, n.driver, "local"])]));
      return 0;
    }
    if (sub === "inspect") {
      const out = [];
      for (const nm of names) { const n = e.networks.get(nm); if (!n) { io.err(`Error response from daemon: network ${nm} not found\n`); return 1; } out.push(networkInfo(e, n)); }
      io.out(JSON.stringify(out, null, 4) + "\n");
      return 0;
    }
    if (sub === "connect") {
      const [nm, ref] = names;
      const n = e.networks.get(nm);
      if (!n) throw new DockerError(`Error response from daemon: network ${nm} not found`);
      const c = mustContainer(e, ref);
      if (!c.networks[nm]) c.networks[nm] = { ip: n.prefix + n.next++, aliases: [], net: n };
      return 0;
    }
    if (sub === "rm" || sub === "remove") {
      let status = 0;
      for (const nm of names) {
        const n = e.networks.get(nm);
        if (!n) { io.err(`Error response from daemon: network ${nm} not found\n`); status = 1; continue; }
        if (n.builtin) { io.err(`Error response from daemon: ${nm} is a pre-defined network and cannot be removed\n`); status = 1; continue; }
        const users = [...e.containers.values()].filter((c) => c.networks[nm] && c.state === "running");
        if (users.length) { io.err(`Error response from daemon: error while removing network: network ${nm} has active endpoints (name:"${users[0].name}" id:"${users[0].id.slice(0, 12)}")\n`); status = 1; continue; }
        e.networks.delete(nm);
        io.out(nm + "\n");
      }
      return status;
    }
    io.out("\nUsage:  docker network COMMAND\n\nManage networks\n\nCommands:\n  connect, create, inspect, ls, rm\n");
    return sub ? 1 : 0;
  }

  /* ------------------------------------------------------------ registries: docker login, docker push */

  const b64 = (s) => (typeof btoa === "function" ? btoa(s) : Buffer.from(s).toString("base64"));
  function writeDockerConfig(sh, e) {
    const home = sh.env.HOME ?? "/home/learner";
    mkdirp(sh.fs, home + "/.docker");
    const auths = Object.fromEntries(Object.entries(e.auth).map(([k, v]) => [k, { auth: b64(`${v.user}:${v.token}`) }]));
    sh.fs.nodes.set(home + "/.docker/config.json", { type: "file", data: new TextEncoder().encode(JSON.stringify({ auths }, null, "\t") + "\n"), mtime: sh.fs.tick(), mode: 0o100600, ino: ++sh.fs.inode });
  }
  // the tokens the sandbox's registries accept: a GitHub token for ghcr.io, a Docker personal access token for Docker Hub
  const tokenOk = (host, user, token, sh) => {
    // ghcr.io takes a personal access token (classic) or a workflow's GITHUB_TOKEN; fine-grained tokens don't work for packages
    if (host === "ghcr.io") return /^(ghp_|ghs_)\w{10,}/.test(token) && (user === "ada" || token.startsWith("ghs_") || user === sh.env.GITHUB_ACTOR);
    return /^dckr_pat_\w{10,}/.test(token) && user === "ada";
  };
  async function cmdLogin(e, sh, args, io) {
    const { opts, rest } = parseFlags(args, { __cmd: "login", "-u|--username": "value", "-p|--password": "value", "--password-stdin": "bool" });
    const host = rest[0] ?? "docker.io";
    const key = host === "docker.io" || host === "index.docker.io" ? "https://index.docker.io/v1/" : host;
    let token = opts["-p"];
    if (opts["--password-stdin"]) {
      if (!opts["-u"]) throw new DockerError("the --password-stdin option requires --username to be set", 1);
      token = (io.stdin ?? "").replace(/\n$/, "");
    }
    if (opts["-p"] !== undefined) io.err("WARNING! Using --password via the CLI is insecure. Use --password-stdin.\n");
    if (!opts["-u"] || token === undefined) {
      io.err(`(docker login asks for your username and password interactively; the sandbox can't. Use: echo "$TOKEN" | docker login ${host === "docker.io" ? "" : host + " "}-u USERNAME --password-stdin)\n`);
      return 1;
    }
    const user = opts["-u"];
    if (!tokenOk(host, user, token, sh)) {
      throw new DockerError(host === "ghcr.io" ? `Error response from daemon: Get "https://ghcr.io/v2/": denied: denied` : `Error response from daemon: Get "https://registry-1.docker.io/v2/": unauthorized: incorrect username or password`);
    }
    e.auth[key] = { user, token };
    if (e.owner === sh) writeDockerConfig(sh, e);
    if (!sh.env.GITHUB_ACTIONS) io.err(`\nWARNING! Your credentials are stored unencrypted in '${sh.env.HOME}/.docker/config.json'.\nConfigure a credential helper to remove this warning. See\nhttps://docs.docker.com/go/credential-store/\n\n`);
    io.out("Login Succeeded\n");
    return 0;
  }
  // push an image to its registry; returns { lines, digest } or { error }
  function pushImage(e, sh, ref, img, out, { packagesWrite = true } = {}) {
    const r = parseRef(ref);
    const key = r.registry === "docker.io" ? "https://index.docker.io/v1/" : r.registry;
    const login = e.auth[key];
    const repoOwner = r.registry === "docker.io" ? r.path.split("/")[0] : r.path.split("/")[0];
    if (r.registry === "docker.io" && r.path.startsWith("library/")) return { error: "denied: requested access to the resource is denied" };
    if (!login) return { error: r.registry === "ghcr.io" ? "unauthorized: unauthenticated: User cannot be authenticated with the token provided." : "denied: requested access to the resource is denied" };
    if (r.registry === "ghcr.io" && login.token.startsWith("ghs_") && !packagesWrite) return { error: "denied: permission_denied: write_package" };
    if (r.registry !== "ghcr.io" && r.registry !== "docker.io") return { error: `Get "https://${r.registry}/v2/": dial tcp: lookup ${r.registry}: no such host` };
    if (repoOwner !== login.user && !(login.token.startsWith("ghs_") && repoOwner === (sh.env.GITHUB_REPOSITORY_OWNER ?? ""))) return { error: r.registry === "ghcr.io" ? "denied: permission_denied: The token provided does not match expected scopes." : "denied: requested access to the resource is denied" };
    const regs = registries(e.owner.fs);
    // a new package on ghcr.io starts private; Docker Hub repositories of free accounts start public
    const reg = regs[r.repo] ??= { tags: {}, images: {}, layers: new Set(), created: now(e), visibility: r.registry === "ghcr.io" ? "private" : "public", owner: repoOwner };
    if (out) out(`The push refers to repository [${r.repo}]`);
    for (const l of [...img.layers].reverse()) {
      if (out) out(`${l.digest.slice(0, 12)}: ${reg.layers.has(l.digest) ? "Layer already exists" : "Pushed"}`);
      reg.layers.add(l.digest);
    }
    reg.images[img.id] = { ...img, nodes: new Map(img.nodes) };
    reg.tags[r.tag] = img.id;
    reg.pushedAt = now(e);
    if (out) out(`${r.tag}: digest: sha256:${img.id} size: 856`);
    return { digest: img.id };
  }
  async function cmdPush(e, sh, args, io) {
    const { rest } = parseFlags(args, { __cmd: "push", "-a|--all-tags": "bool", "-q|--quiet": "bool", "--platform": "value" });
    const ref = rest[0];
    if (!ref) throw new DockerError("docker: 'docker push' requires 1 argument\n\nUsage:  docker push [OPTIONS] NAME[:TAG]\n\nRun 'docker push --help' for more information", 1);
    const img = imageOf(e, ref);
    const r = parseRef(ref);
    if (!img) throw new DockerError(`Error response from daemon: An image does not exist locally with the tag: ${r.familiarRepo}`);
    let lines = "";
    const res = pushImage(e, sh, ref, img, (l) => { lines += l + "\n"; });
    io.out(lines);
    if (res.error) {
      if (!lines) io.out(`The push refers to repository [${r.repo}]\n`);
      throw new DockerError(res.error);
    }
    return 0;
  }

  /* ------------------------------------------------------------ the docker command itself */

  registerCommand("docker", async (sh, args, io) => {
    if (sh.container) { io.err(sh.notFound ? sh.notFound("docker") : "sh: docker: not found\n"); return 127; }
    // global flags before the command
    while (args[0] === "--debug" || args[0] === "-D" || args[0] === "-l" && args.splice(1, 1)) args = args.slice(1);
    try {
      return await dispatch(sh, args, io);
    } catch (err) {
      if (err instanceof DockerError) { io.err(err.message + "\n"); return err.code; }
      throw err;
    }
  });

  /* ------------------------------------------------------------ for compose.js, actions and exercise checks */

  const DOCKER = { EXTRA, HUB, BUSYBOX, ALPINE_RELEASE, BASE_TIME, LOOPBACK, containerByName, syncIn, syncOut, engine, now, tick, hex, short, humanSize, humanDuration, table, parseRef, imageOf, tagsOf, setTag, pull, build, createContainer, startContainer, stopContainer, removeContainer, execIn, settle, refreshHealth, statusText, portsText, ellipsis, quoteGo, commandString, createNetwork, parsePorts, parseEnvList, durationNs, DockerError, findContainer, pushImage, registries, iso, uuid, VERSION, parseMemory, writeDockerConfig, tokenOk, mkdirp };
  const COMPOSE = installCompose(DOCKER, api);
  installKafka(DOCKER, api);

  addHelpers((sh, AssertionError) => ({
    // the sandbox's Docker: images, containers, volumes and networks, for exercise checks
    docker() {
      const e = engine(sh);
      const containerInfo = (c) => ({
        id: c.id, name: c.name, image: c.imageRef, imageId: c.image.id, state: c.state, exitCode: c.exitCode, running: c.state === "running",
        ports: c.ports.map((p) => `${p.hostPort}:${p.containerPort}`), env: { ...c.env }, mounts: c.mounts.map((m) => ({ type: m.type, source: m.type === "bind" ? m.source.replace(/^\/home\/learner/, "~") : m.source, target: m.target, ro: !!m.ro })),
        networks: Object.keys(c.networks), restart: c.restart.name, restartCount: c.restartCount, health: c.health?.status ?? null, user: c.user?.name ?? c.userSpec, memory: c.memory, cpus: c.cpus, init: c.init,
        compose: c.compose, command: commandString(c), logs: c.logs.map(([, t]) => t).join(""), labels: { ...c.labels },
        read: (p) => c.fs.text(p), exists: (p) => c.fs.exists(p),
      });
      const imageInfo = (img) => ({ id: img.id, tags: tagsOf(e, img), config: structuredClone(img.config), history: img.history.map((h) => h.createdBy), size: img.content + img.unpacked, base: img.layers[0]?.digest, layers: img.layers.length, read: (p) => { const n = img.nodes.get(p); return n && n.type === "file" ? new TextDecoder().decode(n.data) : null; }, files: () => [...img.nodes].filter(([, n]) => n.type === "file").map(([p]) => p).sort(), built: !!img.built });
      return {
        images: () => [...e.images.values()].map(imageInfo),
        image: (ref) => { const img = imageOf(e, ref); return img ? imageInfo(img) : null; },
        containers: () => [...e.containers.values()].map(containerInfo),
        container: (ref) => { const c = findContainer(e, ref); return c ? containerInfo(c) : null; },
        volumes: () => [...e.volumes.values()].map((v) => ({ name: v.name, files: Object.fromEntries([...(v.files ?? new Map())].filter(([, n]) => n.type === "file").map(([p, n]) => [p, new TextDecoder().decode(n.data)])) })),
        networks: () => [...e.networks.values()].filter((n) => !n.builtin).map((n) => n.name),
        async request(url) { return NET.request(sh, { url, userAgent: "check" }); },
        loggedIn: (host) => !!e.auth[host === "docker.io" ? "https://index.docker.io/v1/" : host],
      };
    },
    // an image repository on a registry (ghcr.io/ada/shop), as the pushes left it
    registry(name) {
      const reg = registries(sh.fs)[parseRef(name + ":x").repo];
      if (!reg) return null;
      return { visibility: reg.visibility, tags: Object.keys(reg.tags).sort(), digest: (tag) => reg.tags[tag] ?? null, image: (tag) => { const img = reg.images[reg.tags[tag]]; return img ? { id: img.id, config: structuredClone(img.config), labels: { ...(img.config.Labels ?? {}) }, read: (p) => { const n = img.nodes.get(p); return n && n.type === "file" ? new TextDecoder().decode(n.data) : null; } } : null; } };
    },
  }));

  return DOCKER;
}
