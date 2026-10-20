/* kafka.js: Apache Kafka 4.3.1 in the sandbox's pretend Docker (docker.js), from the official apache/kafka image.
   - a broker runs in each apache/kafka container, configured like the image does it: the image's default single-node
     configuration, or KAFKA_* environment variables only (as Docker Compose files set them); brokers with the same
     CLUSTER_ID on one Docker network form a cluster with replication, leaders, in-sync replicas and leader election
   - Kafka's command-line tools in /opt/kafka/bin (kafka-topics.sh, kafka-console-producer.sh,
     kafka-console-consumer.sh, kafka-consumer-groups.sh, kafka-configs.sh, kafka-get-offsets.sh), printing like
     Kafka 4.3.1's tools do (read from Kafka's source code), including their warnings and errors
   - topics with partitions and offsets, keys placed with Kafka's murmur2 partitioner, retention settings, consumer
     groups with committed offsets, lag, rebalances and offset resets, and producers with acks and min.insync.replicas
   - the @confluentinc/kafka-javascript client (its KafkaJS-compatible API) for Node.js programs, installed with npm
   It's a teaching simulation: there's no JVM and no network protocol, and everything happens instantly. */
import { Buffer } from "./gitlib.js?v=176761161d";
import { NODE_PACKAGES, NPM_PACKAGES } from "./nodejs.js?v=176761161d";

export function installKafka(D, api) {
  const { addHelpers, NET } = api;
  const VERSION = "4.3.1";
  const COMMIT_ID = "26b251a451ce941d";
  const DEFAULT_CLUSTER_ID = "5L6g3nShT-eMCtK--X86sw";
  const BIN = "/opt/kafka/bin/";

  /* ------------------------------------------------------------ small helpers */

  // Kafka's murmur2 hash (org.apache.kafka.common.utils.Utils.murmur2), on UTF-8 bytes
  function murmur2(bytes) {
    const len = bytes.length, m = 0x5bd1e995, r = 24;
    let h = (0x9747b28c ^ len) | 0;
    const len4 = len >> 2;
    for (let i = 0; i < len4; i++) {
      const i4 = i << 2;
      let k = (bytes[i4] & 0xff) | ((bytes[i4 + 1] & 0xff) << 8) | ((bytes[i4 + 2] & 0xff) << 16) | ((bytes[i4 + 3] & 0xff) << 24);
      k = Math.imul(k, m); k ^= k >>> r; k = Math.imul(k, m);
      h = Math.imul(h, m); h ^= k;
    }
    const idx = len4 << 2;
    switch (len - idx) {
      case 3: h ^= (bytes[idx + 2] & 0xff) << 16;   // falls through
      case 2: h ^= (bytes[idx + 1] & 0xff) << 8;    // falls through
      case 1: h ^= bytes[idx] & 0xff; h = Math.imul(h, m);
    }
    h ^= h >>> 13; h = Math.imul(h, m); h ^= h >>> 15;
    return h | 0;
  }
  const utf8 = (s) => new TextEncoder().encode(s);
  // the partition Kafka's default partitioner picks for a key: toPositive(murmur2(key)) % partitions
  const partitionFor = (key, n) => (murmur2(key instanceof Uint8Array ? key : utf8(String(key))) & 0x7fffffff) % n;

  // a deterministic pseudo-random generator per engine (UUIDs, sticky partitions, group names)
  function rand(e) {
    const k = (e.kafka ??= { clusters: new Map(), seed: 0x2545f491, ms: 0 });
    k.seed ^= k.seed << 13; k.seed ^= k.seed >>> 17; k.seed ^= k.seed << 5;
    return (k.seed >>> 0) / 4294967296;
  }
  const hexOf = (e, n) => Array.from({ length: n }, () => Math.floor(rand(e) * 16).toString(16)).join("");
  const uuid = (e) => { const h = hexOf(e, 32); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${"89ab"[Math.floor(rand(e) * 4)]}${h.slice(17, 20)}-${h.slice(20, 32)}`; };
  // Kafka's Uuid.toString(): 16 bytes in URL-safe base64 without padding (22 characters)
  function kafkaUuid(e) {
    const bytes = Array.from({ length: 16 }, () => Math.floor(rand(e) * 256));
    const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let out = "";
    for (let i = 0; i < 16; i += 3) {
      const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
      out += A[(n >> 18) & 63] + A[(n >> 12) & 63] + (i + 1 < 16 ? A[(n >> 6) & 63] : "") + (i + 2 < 16 ? A[n & 63] : "");
    }
    return out;
  }

  // Kafka's clock in milliseconds: the Docker clock, plus a few ms for each thing that happens
  function nowMs(e) {
    const k = (e.kafka ??= { clusters: new Map(), seed: 0x2545f491, ms: 0 });
    const base = D.now(e) * 1000;
    if (k.ms < base) k.ms = base + 100 + Math.floor(rand(e) * 800);
    k.ms += 1 + Math.floor(rand(e) * 4);
    return k.ms;
  }
  // log4j's timestamp in Kafka's logs: [2026-10-17 09:00:03,412]
  const stamp = (ms) => { const d = new Date(ms); const p = (n, w = 2) => String(n).padStart(w, "0"); return `[${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())},${p(d.getUTCMilliseconds(), 3)}]`; };

  // Java's String.hashCode and HashMap iteration order (Kafka prints some configs in that order)
  function javaHash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return h; }
  function hashMapOrder(keys, capacity) {
    const bucket = (k) => { const h = javaHash(k); return (h ^ (h >>> 16)) & (capacity - 1); };
    return keys.map((k, i) => [k, i]).sort((a, b) => bucket(a[0]) - bucket(b[0]) || a[1] - b[1]).map(([k]) => k);
  }

  // printf("%-15s") the way Java does it
  const pad = (s, n) => (n < 0 ? String(s).padEnd(-n) : String(s).padStart(n));

  /* ------------------------------------------------------------ the apache/kafka image */

  const SCRIPTS = ["connect-distributed.sh", "connect-mirror-maker.sh", "connect-plugin-path.sh", "connect-standalone.sh", "kafka-acls.sh", "kafka-broker-api-versions.sh", "kafka-client-metrics.sh", "kafka-cluster.sh", "kafka-configs.sh", "kafka-console-consumer.sh", "kafka-console-producer.sh", "kafka-console-share-consumer.sh", "kafka-consumer-groups.sh", "kafka-consumer-perf-test.sh", "kafka-delegation-tokens.sh", "kafka-delete-records.sh", "kafka-dump-log.sh", "kafka-e2e-latency.sh", "kafka-features.sh", "kafka-get-offsets.sh", "kafka-groups.sh", "kafka-jmx.sh", "kafka-leader-election.sh", "kafka-log-dirs.sh", "kafka-metadata-quorum.sh", "kafka-metadata-shell.sh", "kafka-producer-perf-test.sh", "kafka-reassign-partitions.sh", "kafka-replica-verification.sh", "kafka-run-class.sh", "kafka-server-start.sh", "kafka-server-stop.sh", "kafka-share-consumer-perf-test.sh", "kafka-share-groups.sh", "kafka-storage.sh", "kafka-streams-application-reset.sh", "kafka-streams-groups.sh", "kafka-topics.sh", "kafka-transactions.sh", "kafka-verifiable-consumer.sh", "kafka-verifiable-producer.sh", "kafka-verifiable-share-consumer.sh", "trogdor.sh"];
  const CLASSES = {
    "kafka-topics.sh": "org.apache.kafka.tools.TopicCommand", "kafka-console-producer.sh": "org.apache.kafka.tools.ConsoleProducer",
    "kafka-console-consumer.sh": "org.apache.kafka.tools.consumer.ConsoleConsumer", "kafka-consumer-groups.sh": "org.apache.kafka.tools.consumer.group.ConsumerGroupCommand",
    "kafka-configs.sh": "kafka.admin.ConfigCommand", "kafka-get-offsets.sh": "org.apache.kafka.tools.GetOffsetShell",
  };
  const LICENSE = "# Licensed to the Apache Software Foundation (ASF) under one or more\n# contributor license agreements.  See the NOTICE file distributed with\n# this work for additional information regarding copyright ownership.\n# The ASF licenses this file to You under the Apache License, Version 2.0\n# (the \"License\"); you may not use this file except in compliance with\n# the License.  You may obtain a copy of the License at\n#\n#    http://www.apache.org/licenses/LICENSE-2.0\n#\n# Unless required by applicable law or agreed to in writing, software\n# distributed under the License is distributed on an \"AS IS\" BASIS,\n# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n# See the License for the specific language governing permissions and\n# limitations under the License.\n";
  const DEFAULT_PROPERTIES = "process.roles=broker,controller\nnode.id=1\ncontroller.quorum.voters=1@localhost:9093\nlisteners=PLAINTEXT://:9092,CONTROLLER://:9093\ninter.broker.listener.name=PLAINTEXT\nadvertised.listeners=PLAINTEXT://localhost:9092\ncontroller.listener.names=CONTROLLER\nlistener.security.protocol.map=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,SSL:SSL,SASL_PLAINTEXT:SASL_PLAINTEXT,SASL_SSL:SASL_SSL\nnum.network.threads=3\nnum.io.threads=8\nsocket.send.buffer.bytes=102400\nsocket.receive.buffer.bytes=102400\nsocket.request.max.bytes=104857600\nlog.dirs=/tmp/kraft-combined-logs\nnum.partitions=1\nnum.recovery.threads.per.data.dir=2\noffsets.topic.replication.factor=1\nshare.coordinator.state.topic.replication.factor=1\nshare.coordinator.state.topic.min.isr=1\ntransaction.state.log.replication.factor=1\ntransaction.state.log.min.isr=1\nlog.retention.hours=168\nlog.segment.bytes=1073741824\nlog.retention.check.interval.ms=300000\n";
  function imageFiles() {
    const files = {};
    for (const s of SCRIPTS) {
      files[BIN + s] = s === "kafka-run-class.sh" || s === "kafka-server-start.sh" || s === "kafka-storage.sh" || s === "trogdor.sh"
        ? `#!/bin/bash\n${LICENSE}\n# (Kafka's launcher script: it starts the JVM with Kafka's libraries on the classpath)\n`
        : `#!/bin/bash\n${LICENSE}\n${s === "kafka-console-consumer.sh" || s === "kafka-console-producer.sh" ? 'if [ "x$KAFKA_HEAP_OPTS" = "x" ]; then\n    export KAFKA_HEAP_OPTS="-Xmx512M"\nfi\n\n' : ""}exec $(dirname $0)/kafka-run-class.sh ${CLASSES[s] ?? "org.apache.kafka.tools." + s.replace(/\.sh$/, "")} "$@"\n`;
    }
    files["/opt/kafka/config/server.properties"] = DEFAULT_PROPERTIES;
    files["/opt/kafka/config/producer.properties"] = "bootstrap.servers=localhost:9092\ncompression.type=none\n";
    files["/opt/kafka/config/consumer.properties"] = "bootstrap.servers=localhost:9092\ngroup.id=test-consumer-group\n";
    files["/opt/kafka/config/log4j2.yaml"] = "Configuration:\n  Properties:\n    Property:\n      - name: \"logPattern\"\n        value: \"[%d] %p %m (%c)%n\"\n";
    files["/opt/kafka/config/tools-log4j2.yaml"] = "Configuration:\n  Properties:\n    Property:\n      - name: \"logPattern\"\n        value: \"[%d] %p %m (%c)%n\"\n  Loggers:\n    Root:\n      level: WARN\n";
    files["/etc/kafka/docker/server.properties"] = DEFAULT_PROPERTIES;
    files["/etc/kafka/docker/run"] = "#!/usr/bin/env bash\n# (the image's start script: it prepares server.properties from the defaults or KAFKA_* variables, formats the storage, then starts Kafka)\n";
    files["/etc/kafka/docker/launch"] = "#!/usr/bin/env bash\n";
    files["/etc/kafka/docker/configure"] = "#!/usr/bin/env bash\n";
    files["/etc/kafka/docker/configureDefaults"] = "#!/usr/bin/env bash\n";
    files["/opt/kafka/LICENSE"] = "Apache License\nVersion 2.0, January 2004\n";
    files["/opt/kafka/NOTICE"] = "Apache Kafka\nCopyright 2026 The Apache Software Foundation.\n";
    files["/opt/kafka/libs/kafka_2.13-" + VERSION + ".jar"] = "(Kafka's broker)";
    files["/opt/kafka/libs/kafka-clients-" + VERSION + ".jar"] = "(Kafka's Java client)";
    files["/opt/kafka/libs/kafka-tools-" + VERSION + ".jar"] = "(Kafka's command-line tools)";
    return files;
  }
  const kafkaImage = (version, digest, created) => ({
    digest, content: 167942518, unpacked: 418600000, created, os: "alpine", release: D.ALPINE_RELEASE,
    layers: [3849738, 17024311, 52130802, 2212045, 128377921, 38220, 22180443, 2311, 1205, 452],
    bins: [...D.BUSYBOX, "bash", "java", "pgrep", "pkill", "gcompat"],
    binDirs: { java: "/opt/java/openjdk/bin/", bash: "/bin/", pgrep: "/usr/bin/", pkill: "/usr/bin/" },
    users: { appuser: 1000 }, homes: { appuser: "/home/appuser" }, shells: { appuser: "/bin/bash" },
    files: imageFiles, dirs: ["/opt/kafka/libs", "/var/lib/kafka/data", "/etc/kafka/secrets", "/mnt/shared/config", "/usr/logs", "/opt/java/openjdk/lib"],
    config: {
      Env: ["PATH=/opt/java/openjdk/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", "JAVA_HOME=/opt/java/openjdk", "LANG=en_US.UTF-8", "LANGUAGE=en_US:en", "LC_ALL=en_US.UTF-8", "JAVA_VERSION=jdk-21.0.9+10"],
      Cmd: ["/etc/kafka/docker/run"], User: "appuser", ExposedPorts: { "9092/tcp": {} },
      Volumes: { "/etc/kafka/secrets": {}, "/mnt/shared/config": {}, "/var/lib/kafka/data": {} },
      Labels: { "org.label-schema.build-date": created.slice(0, 10), "org.label-schema.description": "Apache Kafka", "org.label-schema.name": "kafka", "org.label-schema.vcs-url": "https://github.com/apache/kafka", "org.opencontainers.image.authors": "Apache Kafka" },
    },
    history: [[`ADD alpine-minirootfs-${D.ALPINE_RELEASE}-x86_64.tar.gz / # buildkit`, 8790000], ['CMD ["/bin/sh"]', 0], ["ENV JAVA_HOME=/opt/java/openjdk", 0], ["ENV PATH=/opt/java/openjdk/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", 0], ["ENV LANG=en_US.UTF-8 LANGUAGE=en_US:en LC_ALL=en_US.UTF-8", 0], ["RUN /bin/sh -c set -eux;     apk add --no-cache         fontconfig ttf-dejavu         gnupg         ca-certificates p11-kit-trust         musl-locales musl-locales-lang         tzdata         coreutils         openssl     ; ... # buildkit", 44100000], ["ENV JAVA_VERSION=jdk-21.0.9+10", 0], ["RUN /bin/sh -c set -eux;     ARCH=\"$(apk --print-arch)\";     case \"${ARCH}\" in ... # buildkit", 141800000], ["EXPOSE map[9092/tcp:{}]", 0], ["USER root", 0], ["RUN |2 kafka_url=https://archive.apache.org/dist/kafka/" + version + "/kafka_2.13-" + version + ".tgz build_date=" + created.slice(0, 10) + " /bin/sh -c mkdir opt/kafka;     set -eux ;     apk update ;     apk upgrade ;     apk add --no-cache bash; ... # buildkit", 141600000], ["COPY server.properties /etc/kafka/docker/server.properties # buildkit", 1260], ["COPY /opt/kafka/kafka.jsa /opt/kafka/kafka.jsa # buildkit", 75600000], ["COPY /opt/kafka/storage.jsa /opt/kafka/storage.jsa # buildkit", 6700000], ["COPY --chown=appuser:appuser resources/common-scripts /etc/kafka/docker # buildkit", 8650], ["COPY --chown=appuser:appuser launch /etc/kafka/docker/launch # buildkit", 2920], ["USER appuser", 0], ["VOLUME [/etc/kafka/secrets /var/lib/kafka/data /mnt/shared/config]", 0], ['CMD ["/etc/kafka/docker/run"]', 0]],
  });
  D.HUB["apache/kafka"] = {
    tags: { [VERSION]: "k431", latest: "k431", "4.2.2": "k422" },
    images: {
      k431: kafkaImage(VERSION, "8d1f6c0b3a2e4f75c9d8e1a0b7f3c6d2e5a49b1f0c7d3e8a6b2f9c4d1e0a7b35", "2026-06-24T11:06:15Z"),
      k422: { ...kafkaImage("4.2.2", "3b9e7a1c5d2f4086b1e3c7a9d5f0e2b4c6a8d1f3e5b7c9a0d2f4e6b8a1c3d5e7", "2026-09-29T08:41:57Z") },
    },
  };

  /* ------------------------------------------------------------ brokers and clusters */

  const DEFAULTS = {
    "num.partitions": "1", "default.replication.factor": "1", "min.insync.replicas": "1", "auto.create.topics.enable": "true",
    "offsets.topic.replication.factor": "3", "offsets.topic.num.partitions": "50", "log.retention.hours": "168",
    "group.initial.rebalance.delay.ms": "3000", "unclean.leader.election.enable": "false",
  };
  // KAFKA_ADVERTISED_LISTENERS → advertised.listeners (the image's rules: _ → ., __ → _, ___ → -)
  const EXCLUDED = new Set(["KAFKA_VERSION", "KAFKA_HEAP_OPTS", "KAFKA_LOG4J_OPTS", "KAFKA_OPTS", "KAFKA_JMX_OPTS", "KAFKA_JVM_PERFORMANCE_OPTS", "KAFKA_GC_LOG_OPTS", "KAFKA_LOG4J_ROOT_LOGLEVEL", "KAFKA_LOG4J_LOGGERS", "KAFKA_TOOLS_LOG4J_LOGLEVEL", "KAFKA_JMX_HOSTNAME"]);
  const envToProp = (k) => k.replace(/^KAFKA_/, "").toLowerCase().replace(/_/g, ".").replace(/\.\.\./g, "-").replace(/\.\./g, "_");
  function parseProps(text) {
    const out = {};
    for (const line of text.split("\n")) { const m = /^\s*([^#=\s][^=]*?)\s*=\s*(.*?)\s*$/.exec(line); if (m) out[m[1]] = m[2]; }
    return out;
  }
  function parseListeners(text) {
    return String(text ?? "").split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
      const m = /^([A-Za-z0-9_]+):\/\/(\[[^\]]*\]|[^:]*):(\d+)$/.exec(s);
      return m ? { name: m[1].toUpperCase(), host: m[2], port: Number(m[3]) } : null;
    }).filter(Boolean);
  }

  const clustersOf = (e) => (e.kafka ??= { clusters: new Map(), seed: 0x2545f491, ms: 0 }).clusters;
  // drop brokers whose containers are gone, and clusters with no brokers left
  function prune(e) {
    for (const [key, cl] of clustersOf(e)) {
      for (const [id, b] of cl.brokers) if (!e.containers.has(b.container.id)) cl.brokers.delete(id);
      if (!cl.brokers.size) clustersOf(e).delete(key);
    }
  }
  const alive = (b) => b && b.container.state === "running" && b.container.daemon?.kafka === b;

  // the broker's configuration, as the image's start script prepares it
  function brokerConfig(c) {
    const env = c.env;
    const fromEnv = Object.entries(env).filter(([k]) => k.startsWith("KAFKA_") && !EXCLUDED.has(k));
    const mounted = c.fs.text("/mnt/shared/config/server.properties");
    let props;
    if (mounted !== null) props = { ...parseProps(mounted), ...Object.fromEntries(fromEnv.map(([k, v]) => [envToProp(k), v])) };
    else if (fromEnv.length) props = Object.fromEntries(fromEnv.map(([k, v]) => [envToProp(k), v]));
    else props = parseProps(DEFAULT_PROPERTIES);
    // configure: with advertised listeners but no listeners, listen on the same ports on every interface
    if (!props.listeners && props["advertised.listeners"] && props["process.roles"] !== "controller") props.listeners = props["advertised.listeners"].replace(/:\/\/[^:]*:/g, "://0.0.0.0:");
    return { props, fromEnv: fromEnv.length > 0, staticProps: { ...props } };
  }
  const setting = (cl, b, name) => b?.props[name] ?? DEFAULTS[name];

  // the start script and Kafka's startup (the image's CMD, /etc/kafka/docker/run)
  async function startBroker(sh, args, io) {
    const c = sh.container;
    const e = c.engine;
    const out = (t) => io.out(t);
    const clusterId = c.env.CLUSTER_ID || DEFAULT_CLUSTER_ID;
    out("===> User\nuid=1000(appuser) gid=1000(appuser) groups=1000(appuser)\n===> Setting default values of environment variables if not already set.\n");
    if (!c.env.CLUSTER_ID) out(`CLUSTER_ID not set. Setting it to default value: "${DEFAULT_CLUSTER_ID}"\n`);
    out("===> Configuring ...\n");
    const { props, fromEnv } = brokerConfig(c);
    if (c.env.KAFKA_PROCESS_ROLES) out("Running in KRaft mode...\n");
    out("===> Launching ... \n");
    out(`===> Using provided cluster id ${clusterId} ...\n`);
    const fail = (msg) => { io.out(msg + "\n"); return 1; };
    for (const req of ["process.roles", "node.id", "controller.listener.names"]) {
      if (props[req] === undefined) return fail(`Exception in thread "main" org.apache.kafka.common.config.ConfigException: Missing required configuration "${req}" which has no default value. at org.apache.kafka.common.config.ConfigDef.parseValue(ConfigDef.java:497) at org.apache.kafka.common.config.ConfigDef.parse(ConfigDef.java:483) at org.apache.kafka.common.config.AbstractConfig.<init>(AbstractConfig.java:112) at kafka.server.KafkaConfig.<init>(KafkaConfig.scala:186) at kafka.tools.StorageTool$.execute(StorageTool.scala:84) at kafka.tools.StorageTool$.main(StorageTool.scala:51) at kafka.docker.KafkaDockerWrapper$.main(KafkaDockerWrapper.scala:57) at kafka.docker.KafkaDockerWrapper.main(KafkaDockerWrapper.scala)`);
    }
    if (!props["controller.quorum.voters"] && !props["controller.quorum.bootstrap.servers"]) {
      return fail("Because controller.quorum.voters is not set on this controller, you must specify one of the following: --standalone, --initial-controllers, or --no-initial-controllers.");
    }
    const listeners = parseListeners(props.listeners);
    const advertised = parseListeners(props["advertised.listeners"]);
    const ctrlNames = String(props["controller.listener.names"]).split(",").map((s) => s.trim().toUpperCase());
    const interBroker = (props["inter.broker.listener.name"] ?? "PLAINTEXT").toUpperCase();
    for (const a of advertised) {
      if (!listeners.some((l) => l.name === a.name)) return fail(`Exception in thread "main" java.lang.IllegalArgumentException: requirement failed: advertised.listeners listener names must be equal to or a subset of the ones defined in listeners. Found ${advertised.map((x) => x.name).join(",")}. The valid options based on the current configuration are ${listeners.map((x) => x.name).join(",")}`);
    }
    const nodeId = Number(props["node.id"]);
    const voters = String(props["controller.quorum.voters"] ?? "").split(",").map((s) => s.trim()).filter(Boolean).map((v) => { const m = /^(\d+)@(.+):(\d+)$/.exec(v); return m ? { id: Number(m[1]), host: m[2], port: Number(m[3]) } : null; }).filter(Boolean);
    const local = voters.length <= 1 && voters.every((v) => D.LOOPBACK.has(v.host) || v.host === c.hostname || v.host === c.name);
    const key = local ? `local:${c.id}` : `${clusterId}|${Object.keys(c.networks).sort().join(",")}`;
    const clusters = clustersOf(e);
    prune(e);
    let cl = clusters.get(key);
    if (!cl) {
      cl = { key, id: clusterId, brokers: new Map(), topics: new Map(), groups: new Map(), voters, epoch: 0 };
      clusters.set(key, cl);
    }
    const b = { nodeId, container: c, props, fromEnv, listeners, advertised, ctrlNames, interBroker, voter: voters.some((v) => v.id === nodeId), cluster: cl, roles: String(props["process.roles"]).split(",").map((s) => s.trim()) };
    cl.brokers.set(nodeId, b);
    c.daemon = {
      kafka: b,
      // docker stop: Kafka shuts down cleanly on SIGTERM; the JVM then exits with 143 (128 + 15)
      stop: (cc, { kill = false } = {}) => {
        const t = nowMs(e);
        if (!kill) {
          for (const line of [`INFO [BrokerServer id=${nodeId}] Transition from STARTED to SHUTTING_DOWN (kafka.server.BrokerServer)`, `INFO [BrokerServer id=${nodeId}] shutting down (kafka.server.BrokerServer)`, `INFO [BrokerServer id=${nodeId}] shut down completed (kafka.server.BrokerServer)`, `INFO [BrokerServer id=${nodeId}] Transition from SHUTTING_DOWN to SHUTDOWN (kafka.server.BrokerServer)`, `INFO App info kafka.server for ${nodeId} unregistered (org.apache.kafka.common.utils.AppInfoParser)`]) cc.shell.push("out", `${stamp(t)} ${line}\n`);
        }
        brokerDown(cl, b, { clean: !kill });
        return kill ? 137 : 143;
      },
    };
    c.procs[c.procs.length - 1].cmd = `/opt/java/openjdk/bin/java -Xmx1G -Xms1G -server -XX:+UseG1GC -XX:MaxGCPauseMillis=20 -XX:InitiatingHeapOccupancyPercent=35 -XX:+ExplicitGCInvokesConcurrent -XX:MaxInlineLevel=15 -Djava.awt.headless=true -XX:SharedArchiveFile=/opt/kafka/kafka.jsa -Dlog4j2.configurationFile=/opt/kafka/config/log4j2.yaml -cp /opt/kafka/bin/../libs/* kafka.Kafka /opt/kafka/config/server.properties`;
    c.procs[c.procs.length - 1].user = "appuser";
    c.fs.nodes.set("/opt/kafka/config/server.properties", { type: "file", data: utf8(Object.entries(props).map(([k, v]) => `${k}=${v}`).join("\n") + "\n"), mtime: 2, mode: 0o100644, ino: 9001 });
    let t = nowMs(e);
    const log = (line) => { t += 7 + Math.floor(rand(e) * 40); io.out(`${stamp(t)} ${line}\n`); };
    log("INFO Registered `kafka:type=kafka.Log4jController` MBean (kafka.utils.Log4jControllerRegistration$)");
    log("INFO Registered signal handlers for TERM, INT, HUP (org.apache.kafka.common.utils.LoggingSignalHandler)");
    if (b.roles.includes("controller")) log(`INFO [ControllerServer id=${nodeId}] Starting controller (kafka.server.ControllerServer)`);
    log(`INFO [RaftManager id=${nodeId}] Completed transition to ${quorumUp(cl) && leaderOfQuorum(cl) === nodeId ? `Leader(localReplicaKey=ReplicaKey(id=${nodeId}), epoch=${cl.epoch + 1})` : `FollowerState(epoch=${cl.epoch + 1}, leaderId=${leaderOfQuorum(cl) ?? -1})`} (org.apache.kafka.raft.QuorumState)`);
    if (b.roles.includes("broker")) {
      log(`INFO [BrokerServer id=${nodeId}] Transition from SHUTDOWN to STARTING (kafka.server.BrokerServer)`);
      log(`INFO [BrokerLifecycleManager id=${nodeId}] The broker has been unfenced. Transitioning from RECOVERY to RUNNING. (kafka.server.BrokerLifecycleManager)`);
      log(`INFO [BrokerServer id=${nodeId}] Transition from STARTING to STARTED (kafka.server.BrokerServer)`);
    }
    log(`INFO Kafka version: ${VERSION} (org.apache.kafka.common.utils.AppInfoParser)`);
    log(`INFO Kafka commitId: ${COMMIT_ID} (org.apache.kafka.common.utils.AppInfoParser)`);
    log(`INFO Kafka startTimeMs: ${t - 1650} (org.apache.kafka.common.utils.AppInfoParser)`);
    log(`INFO [KafkaRaftServer nodeId=${nodeId}] Kafka Server started (kafka.server.KafkaRaftServer)`);
    cl.epoch++;
    brokerUp(cl, b);
    return 0;
  }
  const quorumUp = (cl) => { const vs = cl.voters.length ? cl.voters : [...cl.brokers.values()].filter((b) => b.voter).map((b) => ({ id: b.nodeId })); const up = vs.filter((v) => alive(cl.brokers.get(v.id))).length; return up > vs.length / 2; };
  const leaderOfQuorum = (cl) => { for (const v of cl.voters) if (alive(cl.brokers.get(v.id))) return v.id; return null; };

  // a broker came back: it catches up and rejoins the in-sync replicas; partitions without a leader get one
  function brokerUp(cl, b) {
    for (const t of cl.topics.values()) for (const p of t.partitions) {
      if (!p.replicas.includes(b.nodeId)) continue;
      if (!p.isr.includes(b.nodeId) && (p.leader !== -1 || !p.isr.length)) p.isr.push(b.nodeId);
      p.isr.sort((x, y) => p.replicas.indexOf(x) - p.replicas.indexOf(y));
      p.elr = p.elr.filter((x) => x !== b.nodeId);
      if (p.leader === -1 && p.isr.includes(b.nodeId)) { p.leader = b.nodeId; p.leaderEpoch++; }
    }
    rebalanceAll(cl);
  }
  // a broker stopped: it leaves the in-sync replicas, and its partitions elect a new leader from the rest
  function brokerDown(cl, b, { clean = true } = {}) {
    for (const t of cl.topics.values()) for (const p of t.partitions) {
      if (!p.replicas.includes(b.nodeId)) continue;
      const minIsr = Number(topicSetting(cl, t, "min.insync.replicas"));
      if (p.isr.includes(b.nodeId)) {
        if (p.isr.length > 1) {
          p.isr = p.isr.filter((x) => x !== b.nodeId);
          // Eligible Leader Replicas (on by default since Kafka 4.1): a replica that leaves while the ISR is below min.insync.replicas stays eligible
          if (p.isr.length < minIsr && clean) p.elr.push(b.nodeId);
        }
      }
      if (p.leader === b.nodeId) {
        const next = p.isr.find((x) => x !== b.nodeId && alive(cl.brokers.get(x)));
        p.leader = next ?? -1;
        p.leaderEpoch++;
      }
    }
    // consumers and background tools running inside the stopped container end
    for (const g of cl.groups.values()) {
      const before = g.members.length;
      g.members = g.members.filter((m) => m.container !== b.container);
      if (g.members.length !== before) rebalance(cl, g);
    }
  }

  function topicSetting(cl, t, name) {
    if (t.configs[name] !== undefined) return t.configs[name];
    const any = [...cl.brokers.values()][0];
    if (name === "retention.ms") { const p = any?.props ?? {}; return p["log.retention.ms"] ?? String(Number(p["log.retention.minutes"] ?? (Number(p["log.retention.hours"] ?? 168) * 60)) * 60000); }
    if (name === "cleanup.policy") return any?.props["log.cleanup.policy"] ?? "delete";
    if (name === "segment.bytes") return any?.props["log.segment.bytes"] ?? "1073741824";
    return any?.props[name] ?? DEFAULTS[name] ?? TOPIC_DEFAULTS[name];
  }
  const TOPIC_DEFAULTS = { "retention.bytes": "-1", "max.message.bytes": "1048588", "compression.type": "producer", "min.insync.replicas": "1", "cleanup.policy": "delete" };
  // topic configs in the order the broker returns them (Java HashMap order of LogConfig's 33 settings)
  const LOG_CONFIG_KEYS = ["segment.bytes", "segment.ms", "segment.jitter.ms", "segment.index.bytes", "flush.messages", "flush.ms", "retention.bytes", "retention.ms", "max.message.bytes", "index.interval.bytes", "delete.retention.ms", "min.compaction.lag.ms", "max.compaction.lag.ms", "file.delete.delay.ms", "min.cleanable.dirty.ratio", "cleanup.policy", "unclean.leader.election.enable", "min.insync.replicas", "compression.type", "compression.gzip.level", "compression.lz4.level", "compression.zstd.level", "preallocate", "message.timestamp.type", "message.timestamp.before.max.ms", "message.timestamp.after.max.ms", "leader.replication.throttled.replicas", "follower.replication.throttled.replicas", "remote.storage.enable", "local.retention.ms", "local.retention.bytes", "remote.log.copy.disable", "remote.log.delete.on.disable"];
  const CONFIG_ORDER = hashMapOrder(LOG_CONFIG_KEYS, 64);
  // the topic's non-default configs as kafka-topics.sh --describe prints them: set on the topic, or in the broker's server.properties
  function nonDefaultConfigs(cl, t) {
    const any = [...cl.brokers.values()][0];
    const stat = any?.props ?? {};
    const out = [];
    for (const k of CONFIG_ORDER) {
      if (t.configs[k] !== undefined) out.push(`${k}=${t.configs[k]}`);
      else if (stat["log." + k] !== undefined && k !== "retention.ms") out.push(`${k}=${stat["log." + k]}`);
      else if (k === "retention.ms" && stat["log.retention.ms"] !== undefined) out.push(`${k}=${stat["log.retention.ms"]}`);
      else if (k === "min.insync.replicas" && stat["min.insync.replicas"] !== undefined) out.push(`${k}=${stat["min.insync.replicas"]}`);
      else if (k === "unclean.leader.election.enable" && stat["unclean.leader.election.enable"] !== undefined) out.push(`${k}=${stat["unclean.leader.election.enable"]}`);
    }
    return out;
  }

  /* ------------------------------------------------------------ connecting: bootstrap servers and advertised listeners */

  // connect from a shell (the sandbox's terminal, or a container) to host:port: a broker's listener, or an error
  function connect(sh, hostport) {
    const m = /^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/.exec(String(hostport).trim());
    if (!m) return { error: "invalid", host: hostport };
    const host = m[1].toLowerCase(), port = Number(m[2] ?? 9092);
    const e = D.engine(sh);
    prune(e);
    const from = NET.ns(sh);
    let target = null, tport = port, sameNs = false;
    if (from.kind === "host") {
      if (!D.LOOPBACK.has(host)) return { error: "dns", host, port };
      for (const c of e.containers.values()) {
        if (c.state !== "running") continue;
        const p = c.ports.find((x) => x.hostPort === port);
        if (p) { target = c; tport = p.containerPort; break; }
      }
      if (!target) return { error: "refused", host, port, ip: "127.0.0.1" };
    } else {
      const self = from.container;
      if (D.LOOPBACK.has(host) || host === self.hostname) { target = self; sameNs = true; }
      else {
        target = D.containerByName(e, self, host);
        if (!target) return { error: "dns", host, port };
      }
    }
    const b = target.daemon?.kafka;
    const ip = sameNs ? "127.0.0.1" : Object.values(target.networks)[0]?.ip ?? "172.17.0.2";
    if (!b || !alive(b)) return { error: "refused", host, port, ip };
    const l = b.listeners.find((x) => x.port === tport && (!x.host || x.host === "0.0.0.0" || x.host === "::" || (D.LOOPBACK.has(x.host) ? sameNs : true)));
    if (!l) return { error: "refused", host, port, ip };
    if (b.ctrlNames.includes(l.name)) return { error: "controller", host, port, broker: b };
    const clientIp = from.kind === "host" ? "172.17.0.1" : sameNs ? "127.0.0.1" : Object.values(from.container.networks)[0]?.ip ?? "172.18.0.1";
    return { broker: b, cluster: b.cluster, listener: l.name, clientIp, host, port };
  }
  // a client's session: bootstrap, then metadata with every broker's advertised address for that listener; the client
  // checks it can reach the advertised addresses from where it runs (the usual Docker networking mistake)
  function session(sh, bootstrap) {
    const tried = [];
    for (const hp of String(bootstrap).split(",").map((s) => s.trim()).filter(Boolean)) {
      const r = connect(sh, hp);
      tried.push(r);
      if (r.broker) {
        const cl = r.cluster;
        const addr = (bb) => bb.advertised.find((a) => a.name === r.listener) ?? bb.listeners.find((x) => x.name === r.listener);
        const reach = (bb) => {
          const a = addr(bb);
          if (!a) return { error: "nolistener" };
          const host = a.host || bb.container.hostname;
          const rr = connect(sh, `${host}:${a.port}`);
          return rr.broker === bb ? rr : { ...rr, error: rr.error ?? "wrong", advertised: `${host}:${a.port}` };
        };
        return { ok: true, cl, listener: r.listener, clientIp: r.clientIp, reach, addr, bootstrap: r };
      }
    }
    return { ok: false, tried };
  }

  /* ------------------------------------------------------------ topics, records and groups */

  const LEGAL = /^[a-zA-Z0-9._-]+$/;
  function createTopic(cl, name, { partitions, rf, configs = {}, internal = false } = {}) {
    const brokers = [...cl.brokers.values()].filter((b) => alive(b) && b.roles.includes("broker")).sort((a, b) => a.nodeId - b.nodeId);
    const anyB = brokers[0];
    const n = partitions ?? Number(anyB?.props["num.partitions"] ?? 1);
    const r = rf ?? Number(anyB?.props["default.replication.factor"] ?? 1);
    if (r > brokers.length) return { error: "InvalidReplicationFactorException", message: `Unable to replicate the partition ${r} time(s): The target replication factor of ${r} cannot be reached because only ${brokers.length} broker(s) are registered.` };
    const e = brokers[0]?.container.engine;
    const start = brokers.length ? Math.abs(javaHash(name)) % brokers.length : 0;
    const parts = [];
    for (let i = 0; i < n; i++) {
      const replicas = Array.from({ length: r }, (_, k) => brokers[(start + i + k) % brokers.length].nodeId);
      parts.push({ index: i, replicas, isr: [...replicas], elr: [], leader: replicas[0], leaderEpoch: 0, log: [], start: 0 });
    }
    const t = { name, id: kafkaUuid(e), partitions: parts, configs: { ...configs }, internal, sticky: null };
    cl.topics.set(name, t);
    // consumers already subscribed to this name start reading it after a rebalance
    for (const g of cl.groups.values()) if (g.members.some((m) => m.topics.has(name))) rebalance(cl, g);
    return { topic: t };
  }
  const endOffset = (p) => p.start + p.log.length;
  const visible = (p) => p.log;

  // append a record to a partition's log, as the leader does: returns the offset, or an error class and message
  function append(cl, t, p, rec, acks = "-1") {
    const leader = cl.brokers.get(p.leader);
    if (!alive(leader)) return { error: "NotLeaderOrFollowerException", retriable: true, message: "For requests intended only for the leader, this error indicates that the broker is not the current leader. For requests intended for any replica, this error indicates that the broker is not a replica of the topic partition." };
    if (String(acks) === "-1" || acks === "all") {
      const minIsr = Number(topicSetting(cl, t, "min.insync.replicas"));
      if (p.isr.length < minIsr) return { error: "NotEnoughReplicasException", retriable: true, message: "Messages are rejected since there are fewer in-sync replicas than required." };
    }
    const offset = endOffset(p);
    p.log.push({ offset, ...rec });
    return { offset };
  }

  // consumer groups: members, assignment (Kafka's RangeAssignor for the classic protocol, the server-side uniform
  // assignor for the consumer protocol), committed offsets
  function groupOf(cl, id, protocol = "classic") {
    let g = cl.groups.get(id);
    if (!g) { g = { id, protocol, members: [], offsets: new Map(), generation: 0, state: "Empty" }; cl.groups.set(id, g); }
    return g;
  }
  // the __consumer_offsets topic, created when the first group appears; it needs offsets.topic.replication.factor brokers
  function ensureOffsetsTopic(cl) {
    if (cl.topics.has("__consumer_offsets")) return true;
    const any = [...cl.brokers.values()].filter(alive)[0];
    const rf = Number(any?.props["offsets.topic.replication.factor"] ?? 3);
    const brokers = [...cl.brokers.values()].filter((b) => alive(b) && b.roles.includes("broker")).length;
    if (rf > brokers) return false;
    createTopic(cl, "__consumer_offsets", { partitions: Number(any?.props["offsets.topic.num.partitions"] ?? 50), rf, configs: { "cleanup.policy": "compact", "compression.type": "producer", "segment.bytes": "104857600" }, internal: true });
    return true;
  }
  const coordinatorProblem = (cl) => {
    if (ensureOffsetsTopic(cl)) return null;
    const any = [...cl.brokers.values()].filter(alive)[0];
    const brokers = [...cl.brokers.values()].filter((b) => alive(b) && b.roles.includes("broker")).length;
    return `The group coordinator never becomes available: Kafka can't create its __consumer_offsets topic, because offsets.topic.replication.factor (${any?.props["offsets.topic.replication.factor"] ?? 3}) is more than the ${brokers} broker(s) running. With one broker, set KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1.`;
  };
  function rebalance(cl, g) {
    g.generation++;
    const members = g.protocol === "classic" ? [...g.members].sort((a, b) => (a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0)) : [...g.members];
    for (const m of g.members) m.assignment = [];
    const topics = new Set(g.members.flatMap((m) => [...m.topics]));
    for (const tn of [...topics].sort()) {
      const t = cl.topics.get(tn);
      if (!t) continue;
      const subs = members.filter((m) => m.topics.has(tn));
      if (!subs.length) continue;
      const n = t.partitions.length;
      if (g.protocol === "classic") {
        const per = Math.floor(n / subs.length), extra = n % subs.length;
        let next = 0;
        subs.forEach((m, i) => { const cnt = per + (i < extra ? 1 : 0); for (let k = 0; k < cnt; k++) m.assignment.push([tn, next++]); });
      } else {
        for (let i = 0; i < n; i++) subs[i % subs.length].assignment.push([tn, i]);
      }
    }
    g.state = g.members.length ? "Stable" : "Empty";
    for (const m of g.members) m.position = new Map(m.assignment.map(([tn, i]) => [`${tn}:${i}`, null]));
    for (const m of g.members) if (m.onAssign) m.onAssign(m.assignment);
    deliverAll(cl, g);
  }
  function rebalanceAll(cl) { for (const g of cl.groups.values()) if (g.members.length) deliverAll(cl, g); }
  // where a member starts reading a partition: its committed offset, or auto.offset.reset
  function startOffset(g, m, t, p) {
    const key = `${t.name}:${p.index}`;
    if (m.position?.get(key) != null) return m.position.get(key);
    const committed = g.offsets.get(key);
    if (committed !== undefined) return committed;
    return m.reset === "earliest" ? p.start : endOffset(p);
  }
  // hand new records to the group's live members (background console consumers and Node.js consumers)
  function deliverAll(cl, g) {
    for (const m of g.members) {
      if (!m.live) continue;
      for (const [tn, i] of m.assignment) {
        const t = cl.topics.get(tn);
        if (!t) continue;
        const p = t.partitions[i];
        if (!alive(cl.brokers.get(p.leader))) continue;
        let pos = startOffset(g, m, t, p);
        const batch = p.log.filter((r) => r.offset >= pos);
        for (const r of batch) { m.live(t, p, r); pos = r.offset + 1; }
        m.position.set(`${tn}:${i}`, pos);
        // auto commit (every 5 seconds by default) commits the position of every assigned partition
        if (m.autoCommit !== false) g.offsets.set(`${tn}:${i}`, pos);
      }
    }
  }
  function newRecordsArrived(cl) { for (const g of cl.groups.values()) if (g.members.some((m) => m.live)) deliverAll(cl, g); }

  /* ------------------------------------------------------------ the command-line tools */

  // joptsimple-style options: --name value, --name=value; repeatable ones collect into arrays
  function parseOpts(args, spec) {
    const opts = {}, rest = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (!a.startsWith("--")) { rest.push(a); continue; }
      const eq = a.indexOf("=");
      const name = eq > 0 ? a.slice(2, eq) : a.slice(2);
      const kind = spec[name];
      if (kind === undefined) return { error: `${name} is not a recognized option` };
      if (kind === "flag") { opts[name] = true; continue; }
      const v = eq > 0 ? a.slice(eq + 1) : args[++i];
      if (v === undefined) return { error: `Option ${name} requires an argument` };
      if (kind === "multi") (opts[name] ??= []).push(v); else opts[name] = v;
    }
    return { opts, rest };
  }
  const kv = (list) => Object.fromEntries((list ?? []).map((s) => { const i = s.indexOf("="); return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i + 1)]; }));
  const usageExit = (io, tool, msg) => { io.err(`${msg}\n(${tool} then prints its full list of options.)\n`); return 1; };
  const toolLog = (e, level, msg, cls) => `${stamp(nowMs(e))} ${level} ${msg} (${cls})\n`;

  // what the tools print when they can't reach a broker: the Java client logs a warning per attempt, then gives up
  function unreachable(e, io, r, cls, clientId, what) {
    const host = r.host;
    if (r.error === "dns") {
      io.err(toolLog(e, "WARN", `Couldn't resolve server ${host}:${r.port} from bootstrap.servers as DNS resolution failed for ${host}`, "org.apache.kafka.clients.ClientUtils"));
      io.err(`Exception in thread "main" org.apache.kafka.common.KafkaException: Failed to create new ${what}\n\tat ${cls}\nCaused by: org.apache.kafka.common.config.ConfigException: No resolvable bootstrap urls given in bootstrap.servers\n`);
      return 1;
    }
    for (let k = 1; k <= 3; k++) io.err(toolLog(e, "WARN", `[${clientId}] Connection to node -1 (${host}/${r.ip ?? "127.0.0.1"}:${r.port}) could not be established. Node may not be available.`, "org.apache.kafka.clients.NetworkClient"));
    io.err(`(The sandbox stops here: the tool keeps retrying until it times out. Is the broker running, and is ${host}:${r.port} the right address from where the tool runs?)\n`);
    return 1;
  }

  function sessionOrFail(sh, io, bootstrap, cls, clientId, what) {
    if (!bootstrap) return { exit: usageExit(io, cls, "Missing required argument \"[bootstrap-server]\"") };
    const s = session(sh, bootstrap);
    if (!s.ok) return { exit: unreachable(D.engine(sh), io, s.tried[0], cls, clientId, what) };
    if (!quorumUp(s.cl)) {
      io.err(`(The sandbox stops here: the cluster's controllers have no quorum, so the tool waits until it times out. Start enough controllers again.)\n`);
      return { exit: 1 };
    }
    return { s };
  }

  // kafka-topics.sh
  async function topicsTool(sh, args, io) {
    const e = D.engine(sh);
    const p = parseOpts(args, { "bootstrap-server": "value", create: "flag", list: "flag", describe: "flag", delete: "flag", alter: "flag", topic: "value", partitions: "value", "replication-factor": "value", config: "multi", "if-not-exists": "flag", "if-exists": "flag", "exclude-internal": "flag", "under-replicated-partitions": "flag", "under-min-isr-partitions": "flag", "unavailable-partitions": "flag", "topics-with-overrides": "flag", "command-config": "value", help: "flag", version: "flag" });
    const err = (msg, stackClass, frames) => { io.out(`Error while executing topic command : ${msg}\n`); io.err(`${stamp(nowMs(e))} ERROR ${stackClass}: ${msg}\n${frames ?? ""} (org.apache.kafka.tools.TopicCommand)\n`); return 1; };
    if (p.error) { io.err(`${p.error}\njoptsimple.UnrecognizedOptionException: ${p.error}\n\tat joptsimple.OptionException.unrecognizedOption(OptionException.java:108)\n\tat joptsimple.OptionParser.handleLongOptionToken(OptionParser.java:510)\n\tat org.apache.kafka.tools.TopicCommand$TopicCommandOptions.<init>(TopicCommand.java:777)\n\tat org.apache.kafka.tools.TopicCommand.execute(TopicCommand.java:99)\n\tat org.apache.kafka.tools.TopicCommand.mainNoExit(TopicCommand.java:89)\n\tat org.apache.kafka.tools.TopicCommand.main(TopicCommand.java:84)\n`); return 1; }
    const o = p.opts;
    if (o.version) { io.out(`${VERSION} (Commit:${COMMIT_ID})\n`); return 0; }
    const actions = ["create", "list", "describe", "delete", "alter"].filter((a) => o[a]);
    if (actions.length !== 1) return usageExit(io, "kafka-topics.sh", "Command must include exactly one action: --list, --describe, --create, --alter or --delete");
    if (!o["bootstrap-server"]) { io.err(`--bootstrap-server must be specified\njava.lang.IllegalArgumentException: --bootstrap-server must be specified\n\tat org.apache.kafka.tools.TopicCommand$TopicCommandOptions.checkArgs(TopicCommand.java:924)\n\tat org.apache.kafka.tools.TopicCommand.execute(TopicCommand.java:100)\n\tat org.apache.kafka.tools.TopicCommand.mainNoExit(TopicCommand.java:89)\n\tat org.apache.kafka.tools.TopicCommand.main(TopicCommand.java:84)\n`); return 1; }
    const { s, exit } = sessionOrFail(sh, io, o["bootstrap-server"], "org.apache.kafka.tools.TopicCommand", "AdminClient clientId=adminclient-1", "admin client");
    if (exit !== undefined) return exit;
    const cl = s.cl;
    const action = actions[0];
    if ((action === "create" || action === "delete" || action === "alter") && !o.topic) return usageExit(io, "kafka-topics.sh", `Missing required argument "[topic]"`);
    if (action === "create") {
      const name = o.topic;
      if (!LEGAL.test(name) || name === "." || name === ".." || name.length > 249) {
        const why = name.length > 249 ? `Topic name is illegal, it can't be longer than 249 characters, topic name: ${name}` : name === "." || name === ".." ? "Topic name cannot be \".\" or \"..\"" : `Topic name "${name}" is illegal, it contains a character other than ASCII alphanumerics, '.', '_' and '-'`;
        return err(why, "org.apache.kafka.common.errors.InvalidTopicException");
      }
      if (/[._]/.test(name)) io.out("WARNING: Due to limitations in metric names, topics with a period ('.') or underscore ('_') could collide. To avoid issues it is best to use either, but not both.\n");
      const rf = o["replication-factor"] !== undefined ? Number(o["replication-factor"]) : undefined;
      const parts = o.partitions !== undefined ? Number(o.partitions) : undefined;
      if (rf !== undefined && (rf < 1 || rf > 32767)) { io.out("Error while executing topic command : The replication factor must be between 1 and 32767 inclusive\n"); io.err(`${stamp(nowMs(e))} ERROR java.lang.IllegalArgumentException: The replication factor must be between 1 and 32767 inclusive\n\tat org.apache.kafka.tools.TopicCommand$TopicService.createTopic(TopicCommand.java:447)\n\tat org.apache.kafka.tools.TopicCommand$TopicService.createTopic(TopicCommand.java:442)\n\tat org.apache.kafka.tools.TopicCommand.execute(TopicCommand.java:103)\n\tat org.apache.kafka.tools.TopicCommand.mainNoExit(TopicCommand.java:89)\n\tat org.apache.kafka.tools.TopicCommand.main(TopicCommand.java:84)\n (org.apache.kafka.tools.TopicCommand)\n`); return 1; }
      if (parts !== undefined && parts < 1) { io.out("Error while executing topic command : The partitions must be greater than 0\n"); io.err(`${stamp(nowMs(e))} ERROR java.lang.IllegalArgumentException: The partitions must be greater than 0\n\tat org.apache.kafka.tools.TopicCommand$TopicService.createTopic(TopicCommand.java:450)\n\tat org.apache.kafka.tools.TopicCommand$TopicService.createTopic(TopicCommand.java:442)\n\tat org.apache.kafka.tools.TopicCommand.execute(TopicCommand.java:103)\n\tat org.apache.kafka.tools.TopicCommand.mainNoExit(TopicCommand.java:89)\n\tat org.apache.kafka.tools.TopicCommand.main(TopicCommand.java:84)\n (org.apache.kafka.tools.TopicCommand)\n`); return 1; }
      const configs = kv(o.config);
      for (const [k, v] of Object.entries(configs)) {
        if (!LOG_CONFIG_KEYS.includes(k)) return err(`Unknown topic config name: ${k}`, "org.apache.kafka.common.errors.InvalidConfigurationException");
        if (k === "cleanup.policy" && !v.split(",").every((x) => ["delete", "compact"].includes(x))) return err(`Invalid value ${v} for configuration cleanup.policy: String must be one of: compact, delete`, "org.apache.kafka.common.errors.InvalidConfigurationException");
      }
      if (cl.topics.has(name)) {
        if (o["if-not-exists"]) return 0;
        return err(`Topic '${name}' already exists.`, "org.apache.kafka.common.errors.TopicExistsException");
      }
      const r = createTopic(cl, name, { partitions: parts, rf, configs });
      if (r.error) return err(r.message, "org.apache.kafka.common.errors." + r.error);
      io.out(`Created topic ${name}.\n`);
      return 0;
    }
    const matching = () => {
      let names = [...cl.topics.keys()].sort();
      if (o["exclude-internal"]) names = names.filter((n) => !cl.topics.get(n).internal);
      if (o.topic) { const re = new RegExp("^(?:" + o.topic.replace(/\./g, "\\.").replace(/\*/g, ".*") + ")$"); names = names.filter((n) => re.test(n) || n === o.topic); }
      return names;
    };
    const ensureExists = (names) => {
      if (!names.length && o.topic && !o["if-exists"]) {
        io.out(`Error while executing topic command : Topic '${o.topic}' does not exist as expected\n`);
        io.err(`${stamp(nowMs(e))} ERROR java.lang.IllegalArgumentException: Topic '${o.topic}' does not exist as expected\n\tat org.apache.kafka.tools.TopicCommand.ensureTopicExists(TopicCommand.java:207)\n\tat org.apache.kafka.tools.TopicCommand$TopicService.${action}Topic(TopicCommand.java:${{ describe: 579, delete: 657, alter: 484 }[action]})\n\tat org.apache.kafka.tools.TopicCommand.execute(TopicCommand.java:${{ describe: 109, delete: 111, alter: 105 }[action]})\n\tat org.apache.kafka.tools.TopicCommand.mainNoExit(TopicCommand.java:89)\n\tat org.apache.kafka.tools.TopicCommand.main(TopicCommand.java:84)\n (org.apache.kafka.tools.TopicCommand)\n`);
        return false;
      }
      return true;
    };
    if (action === "list") { const names = matching(); io.out(names.join("\n") + "\n"); return 0; }
    if (action === "describe") {
      const names = matching();
      if (!ensureExists(names)) return 1;
      const liveIds = new Set([...cl.brokers.values()].filter(alive).map((b) => b.nodeId));
      const filter = o["under-replicated-partitions"] ? (t, pp) => pp.isr.length < pp.replicas.length
        : o["under-min-isr-partitions"] ? (t, pp) => pp.leader === -1 || pp.isr.length < Number(topicSetting(cl, t, "min.insync.replicas"))
        : o["unavailable-partitions"] ? (t, pp) => pp.leader === -1 || !liveIds.has(pp.leader) : null;
      let text = "";
      for (const n of names) {
        const t = cl.topics.get(n);
        if (!filter) text += `Topic: ${t.name}\tTopicId: ${t.id}\tPartitionCount: ${t.partitions.length}\tReplicationFactor: ${t.partitions[0].replicas.length}\tConfigs: ${nonDefaultConfigs(cl, t).join(",")}\n`;
        for (const pp of t.partitions) {
          if (filter && !filter(t, pp)) continue;
          text += `\tTopic: ${t.name}\tPartition: ${pp.index}\tLeader: ${pp.leader === -1 ? "none" : pp.leader}\tReplicas: ${pp.replicas.join(",")}\tIsr: ${pp.isr.join(",")}\tElr: ${pp.elr.join(",")}\tLastKnownElr: \n`;
        }
      }
      io.out(text);
      return 0;
    }
    if (action === "delete") {
      const names = matching();
      if (!ensureExists(names)) return 1;
      for (const n of names) {
        if (cl.topics.get(n).internal) return err(`Topic ${n} is a kafka internal topic and is not allowed to be marked for deletion.`, "java.lang.IllegalArgumentException");
        cl.topics.delete(n);
        for (const g of cl.groups.values()) for (const k of [...g.offsets.keys()]) if (k.startsWith(n + ":")) g.offsets.delete(k);
      }
      return 0;
    }
    if (action === "alter") {
      const names = matching();
      if (!ensureExists(names)) return 1;
      if (o.partitions === undefined) return usageExit(io, "kafka-topics.sh", "Missing required argument \"[partitions]\"");
      const want = Number(o.partitions);
      for (const n of names) {
        const t = cl.topics.get(n);
        if (want < t.partitions.length) return err(`Topic currently has ${t.partitions.length} partitions, which is higher than the requested ${want}.`, "org.apache.kafka.common.errors.InvalidPartitionsException");
        if (want === t.partitions.length) return err(`Topic already has ${want} partitions.`, "org.apache.kafka.common.errors.InvalidPartitionsException");
        const brokers = [...cl.brokers.values()].filter(alive).sort((a, b) => a.nodeId - b.nodeId);
        const rf = t.partitions[0].replicas.length;
        for (let i = t.partitions.length; i < want; i++) {
          const replicas = Array.from({ length: rf }, (_, k) => brokers[(i + k) % brokers.length].nodeId);
          t.partitions.push({ index: i, replicas, isr: [...replicas], elr: [], leader: replicas[0], leaderEpoch: 0, log: [], start: 0 });
        }
      }
      for (const g of cl.groups.values()) if (g.members.length) rebalance(cl, g);
      return 0;
    }
    return 0;
  }

  // the producer's partitioner: a key's murmur2 hash, or (no key) one partition per batch: Kafka's sticky partitioner
  function choosePartition(e, t, key, state) {
    if (key !== null) return partitionFor(key, t.partitions.length);
    if (state.sticky === undefined || state.sticky >= t.partitions.length) state.sticky = Math.floor(rand(e) * t.partitions.length);
    return state.sticky;
  }

  // auto.create.topics.enable: a producer (or a subscribing consumer) that asks for a missing topic creates it
  function autoCreate(cl, name) {
    const any = [...cl.brokers.values()].find(alive);
    if (String(any?.props["auto.create.topics.enable"] ?? "true") !== "true" || !LEGAL.test(name)) return null;
    return createTopic(cl, name, {}).topic ?? null;
  }

  // kafka-console-producer.sh: one record per line of stdin
  async function producerTool(sh, args, io) {
    const e = D.engine(sh);
    const p = parseOpts(args, { "bootstrap-server": "value", topic: "value", "reader-property": "multi", property: "multi", "command-property": "multi", "producer-property": "multi", "command-config": "value", "producer.config": "value", "request-required-acks": "value", sync: "flag", "compression-codec": "value", "line-reader": "value", "batch-size": "value", timeout: "value", "message-send-max-retries": "value", "retry-backoff-ms": "value", "request-timeout-ms": "value", "max-block-ms": "value", "max-memory-bytes": "value", "max-partition-memory-bytes": "value", "metadata-expiry-ms": "value", "socket-buffer-size": "value", help: "flag", version: "flag" });
    if (p.error) return usageExit(io, "kafka-console-producer.sh", p.error);
    const o = p.opts;
    if (o.version) { io.out(`${VERSION} (Commit:${COMMIT_ID})\n`); return 0; }
    if (!o.topic) return usageExit(io, "kafka-console-producer.sh", "Missing required argument \"[topic]\"");
    if (o.property && o["reader-property"]) return usageExit(io, "kafka-console-producer.sh", "Options --reader-property and --property cannot be specified together.");
    if (o["producer-property"] && o["command-property"]) return usageExit(io, "kafka-console-producer.sh", "Options --command-property and --producer-property cannot be specified together.");
    if (o["producer-property"]) io.out("Warning: --producer-property is deprecated and will be removed in a future version. Use --command-property instead.\n");
    if (o["producer.config"]) io.out("Warning: --producer.config is deprecated and will be removed in a future version. Use --command-config instead.\n");
    if (o.property) io.out("Warning: --property is deprecated and will be removed in a future version. Use --reader-property instead.\n");
    const reader = kv(o["reader-property"] ?? o.property);
    const cmdProps = kv(o["command-property"] ?? o["producer-property"]);
    const acks = String(cmdProps.acks ?? o["request-required-acks"] ?? "-1");
    const { s, exit } = sessionOrFail(sh, io, o["bootstrap-server"], "org.apache.kafka.tools.ConsoleProducer", "Producer clientId=console-producer", "producer");
    if (exit !== undefined) return exit;
    const cl = s.cl;
    const parseKey = String(reader["parse.key"] ?? "false").trim().toLowerCase() === "true";
    const keySep = reader["key.separator"] ?? "\t";
    const parseHeaders = String(reader["parse.headers"] ?? "false").trim().toLowerCase() === "true";
    const nullMarker = reader["null.marker"];
    const ignoreError = String(reader["ignore.error"] ?? "false").trim().toLowerCase() === "true";
    const text = io.stdin ?? "";
    const lines = text === "" ? [] : text.replace(/\n$/, "").split("\n");
    let t = cl.topics.get(o.topic);
    const state = {};
    let corr = 1;
    if (!t && lines.length) {
      t = autoCreate(cl, o.topic);
      if (!t) {
        for (let k = 0; k < 3; k++) io.err(toolLog(e, "WARN", `[Producer clientId=console-producer] Error while fetching metadata with correlation id ${corr++} : {${o.topic}=UNKNOWN_TOPIC_OR_PARTITION}`, "org.apache.kafka.clients.NetworkClient"));
        io.err(`(The sandbox stops here: the producer keeps asking for the topic until max.block.ms (60 seconds) passes, then fails with "Topic ${o.topic} not present in metadata after 60000 ms.")\n`);
        return 1;
      }
      io.err(toolLog(e, "WARN", `[Producer clientId=console-producer] The metadata response from the cluster reported a recoverable issue with correlation id ${corr++} : {${o.topic}=UNKNOWN_TOPIC_OR_PARTITION}`, "org.apache.kafka.clients.NetworkClient"));
    }
    let lineNumber = 0;
    for (const line of lines) {
      lineNumber++;
      let rest = line, headers = [], key = null;
      if (parseHeaders) {
        const hd = reader["headers.delimiter"] ?? "\t";
        const i = rest.indexOf(hd);
        if (i < 0 && !ignoreError) { io.err(`No headers delimiter found on line number ${lineNumber}: '${line}'\norg.apache.kafka.common.KafkaException: No headers delimiter found on line number ${lineNumber}: '${line}'\n\tat org.apache.kafka.tools.LineMessageReader.parse(LineMessageReader.java:177)\n\tat org.apache.kafka.tools.LineMessageReader$1.hasNext(LineMessageReader.java:126)\n\tat org.apache.kafka.tools.ConsoleProducer.loopReader(ConsoleProducer.java:99)\n\tat org.apache.kafka.tools.ConsoleProducer.start(ConsoleProducer.java:71)\n\tat org.apache.kafka.tools.ConsoleProducer.main(ConsoleProducer.java:59)\n`); return 1; }
        if (i >= 0) {
          const hs = rest.slice(0, i); rest = rest.slice(i + hd.length);
          const sep = reader["headers.separator"] ?? ",", ks = reader["headers.key.separator"] ?? ":";
          headers = hs.split(sep).map((x) => { const j = x.indexOf(ks); return j < 0 ? [x, null] : [x.slice(0, j), x.slice(j + ks.length)]; });
        }
      }
      if (parseKey) {
        const i = rest.indexOf(keySep);
        if (i < 0) {
          if (!ignoreError) { io.err(`No key separator found on line number ${lineNumber}: '${line}'\norg.apache.kafka.common.KafkaException: No key separator found on line number ${lineNumber}: '${line}'\n\tat org.apache.kafka.tools.LineMessageReader.parse(LineMessageReader.java:177)\n\tat org.apache.kafka.tools.LineMessageReader$1.hasNext(LineMessageReader.java:129)\n\tat org.apache.kafka.tools.ConsoleProducer.loopReader(ConsoleProducer.java:99)\n\tat org.apache.kafka.tools.ConsoleProducer.start(ConsoleProducer.java:71)\n\tat org.apache.kafka.tools.ConsoleProducer.main(ConsoleProducer.java:59)\n`); return 1; }
        } else { key = rest.slice(0, i); rest = rest.slice(i + keySep.length); }
      }
      if (key !== null && nullMarker !== undefined && key === nullMarker) key = null;
      const value = nullMarker !== undefined && rest === nullMarker ? null : rest;
      const part = t.partitions[choosePartition(e, t, key, state)];
      const r = append(cl, t, part, { key, value, headers, ts: nowMs(e), type: "CreateTime" }, acks);
      if (r.error) {
        let detail = r.message;
        if (r.error === "NotEnoughReplicasException") {
          // the console producer retries 3 times (--message-send-max-retries), logging each failure, then gives up
          detail = `The size of the current ISR : ${part.isr.length} is insufficient to satisfy the min.isr requirement of ${topicSetting(cl, t, "min.insync.replicas")} for partition ${t.name}-${part.index}, live replica(s) broker.id are : Set(${part.isr.join(", ")})`;
          for (let left = 2; left >= 0; left--) io.err(toolLog(e, "WARN", `[Producer clientId=console-producer] Got error produce response with correlation id ${corr++ + 3} on topic-partition ${t.name}-${part.index}, retrying (${left} attempts left). Error: NOT_ENOUGH_REPLICAS. Error Message: ${detail}`, "org.apache.kafka.clients.producer.internals.Sender"));
        }
        io.err(toolLog(e, "ERROR", `Error when sending message to topic ${t.name} with key: ${key === null ? "null" : utf8(key).length + " bytes"}, value: ${value === null ? "null" : utf8(value).length + " bytes"} with error:`, "org.apache.kafka.clients.producer.internals.ErrorLoggingCallback") + `org.apache.kafka.common.errors.${r.error === "NotLeaderOrFollowerException" ? "TimeoutException" : r.error}: ${r.error === "NotLeaderOrFollowerException" ? `Expiring 1 record(s) for ${t.name}-${part.index}:120000 ms has passed since batch creation` : detail}\n`);
      }
    }
    newRecordsArrived(cl);
    return 0;
  }

  const KIP848 = "The consumer rebalance protocol (KIP-848) is production-ready! Set group.protocol=consumer to try it out. See https://kafka.apache.org/documentation/#consumer_rebalance_protocol\n";
  // kafka-console-consumer.sh
  async function consumerTool(sh, args, io) {
    const e = D.engine(sh);
    const p = parseOpts(args, { "bootstrap-server": "value", topic: "value", include: "value", group: "value", "from-beginning": "flag", "max-messages": "value", "timeout-ms": "value", partition: "value", offset: "value", "formatter-property": "multi", property: "multi", "command-property": "multi", "consumer-property": "multi", "command-config": "value", "consumer.config": "value", formatter: "value", "skip-message-on-error": "flag", "isolation-level": "value", "key-deserializer": "value", "value-deserializer": "value", "enable-systest-events": "flag", help: "flag", version: "flag" });
    if (p.error) return usageExit(io, "kafka-console-consumer.sh", p.error);
    const o = p.opts;
    if (o.version) { io.out(`${VERSION} (Commit:${COMMIT_ID})\n`); return 0; }
    if (!o["bootstrap-server"]) return usageExit(io, "kafka-console-consumer.sh", "Missing required argument \"[bootstrap-server]\"");
    if (!o.topic && !o.include) return usageExit(io, "kafka-console-consumer.sh", "Exactly one of --include/--topic is required.");
    if (o.partition !== undefined && !o.topic) return usageExit(io, "kafka-console-consumer.sh", "The topic is required when partition is specified.");
    if (o["from-beginning"] && o.offset !== undefined) return usageExit(io, "kafka-console-consumer.sh", "Options from-beginning and offset cannot be specified together.");
    if (o.offset !== undefined && o.partition === undefined) return usageExit(io, "kafka-console-consumer.sh", "The partition is required when offset is specified.");
    if (o["consumer-property"] && o["command-property"]) return usageExit(io, "kafka-console-consumer.sh", "Options --consumer-property and --command-property cannot be specified together.");
    if (o.property && o["formatter-property"]) return usageExit(io, "kafka-console-consumer.sh", "Options --property and --formatter-property cannot be specified together.");
    if (o["consumer-property"]) io.out("Option --consumer-property is deprecated and will be removed in a future version. Use --command-property instead.\n");
    if (o["consumer.config"]) io.out("Option --consumer.config is deprecated and will be removed in a future version. Use --command-config instead.\n");
    const cmdProps = kv(o["command-property"] ?? o["consumer-property"]);
    if (o.group && o.partition !== undefined) return usageExit(io, "kafka-console-consumer.sh", "Options group and partition cannot be specified together.");
    if (o.group && cmdProps["group.id"] && cmdProps["group.id"] !== o.group) return usageExit(io, "kafka-console-consumer.sh", `The group ids provided in different places (directly using '--group', via '--consumer-property', or via '--consumer.config') do not match. Detected group ids: '${o.group}', '${cmdProps["group.id"]}'`);
    if (o.property) io.out("Option --property is deprecated and will be removed in a future version. Use --formatter-property instead.\n");
    const fmt = kv(o["formatter-property"] ?? o.property);
    const bool = (k, d) => (fmt[k] === undefined ? d : String(fmt[k]).trim().toLowerCase() === "true");
    const F = { ts: bool("print.timestamp", false), key: bool("print.key", false), value: bool("print.value", true), partition: bool("print.partition", false), offset: bool("print.offset", false), headers: bool("print.headers", false), sep: fmt["key.separator"] ?? "\t", nul: fmt["null.literal"] ?? "null", hsep: fmt["headers.separator"] ?? "," };
    const reset = o["from-beginning"] ? "earliest" : cmdProps["auto.offset.reset"] ?? "latest";
    if (o["from-beginning"] && cmdProps["auto.offset.reset"] && cmdProps["auto.offset.reset"] !== "earliest") { io.err(`Can't simultaneously specify --from-beginning and 'auto.offset.reset=${cmdProps["auto.offset.reset"]}', to make sure the consumer starts from the beginning of the log, consider removing 'auto.offset.reset' parameter.\n`); return 1; }
    const protocol = (cmdProps["group.protocol"] ?? "classic").toLowerCase();
    const maxMessages = o["max-messages"] !== undefined ? Number(o["max-messages"]) : -1;
    const timeoutMs = o["timeout-ms"] !== undefined ? Number(o["timeout-ms"]) : null;
    const { s, exit } = sessionOrFail(sh, io, o["bootstrap-server"], "org.apache.kafka.tools.consumer.ConsoleConsumer", "Consumer clientId=console-consumer, groupId=" + (o.group ?? "console-consumer"), "consumer");
    if (exit !== undefined) return exit;
    const cl = s.cl;
    if (o.partition === undefined && protocol === "classic") io.err(KIP848);
    const format = (t, pp, r) => {
      let line = "";
      const sep = (more) => (more ? F.sep : "\n");
      if (F.ts) line += `${r.type}:${r.ts}` + sep(F.partition || F.offset || F.headers || F.key || F.value);
      if (F.partition) line += `Partition:${pp.index}` + sep(F.offset || F.headers || F.key || F.value);
      if (F.offset) line += `Offset:${r.offset}` + sep(F.headers || F.key || F.value);
      if (F.headers) line += (r.headers?.length ? r.headers.map(([k, v]) => `${k}:${v ?? F.nul}`).join(F.hsep) : "NO_HEADERS") + sep(F.key || F.value);
      if (F.key) line += (r.key ?? F.nul) + sep(F.value);
      if (F.value) line += (r.value ?? F.nul) + "\n";
      return line;
    };
    // which partitions this consumer reads, and from where
    let assignment, g = null, member = null;
    const topicNames = () => (o.topic ? [o.topic] : [...cl.topics.keys()].filter((n) => !cl.topics.get(n).internal && new RegExp("^(?:" + o.include + ")$").test(n)));
    if (o.topic && !cl.topics.get(o.topic)) {
      if (!autoCreate(cl, o.topic)) { /* nothing to read */ }
      else io.err(toolLog(e, "WARN", `[Consumer clientId=console-consumer, groupId=${o.group ?? "console-consumer-" + Math.floor(rand(e) * 100000)}] Error while fetching metadata with correlation id 2 : {${o.topic}=UNKNOWN_TOPIC_OR_PARTITION}`, "org.apache.kafka.clients.NetworkClient"));
    }
    if (o.partition !== undefined) {
      const t = cl.topics.get(o.topic);
      const pi = Number(o.partition);
      if (!t || pi >= t.partitions.length) { io.err(`(The sandbox stops here: partition ${o.partition} of ${o.topic} doesn't exist, so the consumer waits for it forever.)\nProcessed a total of 0 messages\n`); return 0; }
      const pp = t.partitions[pi];
      const off = o.offset === undefined || o.offset === "latest" ? (o["from-beginning"] ? pp.start : endOffset(pp)) : o.offset === "earliest" ? pp.start : Number(o.offset);
      if (o.offset !== undefined && !["earliest", "latest"].includes(o.offset) && !/^\d+$/.test(o.offset)) return usageExit(io, "kafka-console-consumer.sh", `The provided offset value '${o.offset}' is incorrect. Valid values are 'earliest', 'latest', or a non-negative long.`);
      assignment = [[t, pp, off]];
    } else {
      const problem = coordinatorProblem(cl);
      if (problem) { io.err(`(The sandbox stops here: the consumer waits for its group forever. ${problem})\nProcessed a total of 0 messages\n`); return 0; }
      const groupId = o.group ?? cmdProps["group.id"] ?? `console-consumer-${Math.floor(rand(e) * 100000)}`;
      const autoCommit = o.group || cmdProps["group.id"] ? String(cmdProps["enable.auto.commit"] ?? "true") === "true" : String(cmdProps["enable.auto.commit"] ?? "false") === "true";
      g = groupOf(cl, groupId, protocol);
      if (g.members.length && g.protocol !== protocol && g.protocol === "classic" && protocol === "consumer") { /* a classic group upgrades when a consumer-protocol member joins (online migration) */ g.protocol = "consumer"; }
      const c = sh.container;
      member = {
        memberId: protocol === "classic" ? `console-consumer-${uuid(e)}` : kafkaUuid(e), clientId: cmdProps["client.id"] ?? "console-consumer",
        host: "/" + s.clientIp, topics: new Set(topicNames()), assignment: [], reset, autoCommit, container: c, protocol,
      };
      g.members.push(member);
      rebalance(cl, g);
      assignment = member.assignment.map(([tn, i]) => { const t = cl.topics.get(tn); const pp = t.partitions[i]; return [t, pp, startOffset(g, member, t, pp)]; });
    }
    // detached (docker exec -d): it keeps running in the background as a member of its group
    if (sh.detached && member) {
      const proc = sh.execProc;
      if (proc) { proc.background = true; proc.cmd = `/opt/java/openjdk/bin/java -Xmx512M -server -XX:+UseG1GC -Djava.awt.headless=true -Dlog4j2.configurationFile=/opt/kafka/bin/../config/tools-log4j2.yaml -cp /opt/kafka/bin/../libs/* org.apache.kafka.tools.consumer.ConsoleConsumer ${args.join(" ")}`; member.proc = proc; }
      member.live = () => {};
      deliverAll(cl, g);
      return 0;
    }
    // read what's there, in partition order, up to --max-messages
    let count = 0;
    const assigned = assignment;
    for (const [t, pp, off] of assigned) {
      if (maxMessages !== -1 && count >= maxMessages) break;
      if (!alive(cl.brokers.get(pp.leader))) continue;
      let pos = off;
      for (const r of pp.log) {
        if (r.offset < off) continue;
        if (maxMessages !== -1 && count >= maxMessages) break;
        io.out(format(t, pp, r));
        count++;
        pos = r.offset + 1;
      }
      if (member) member.position.set(`${t.name}:${pp.index}`, pos);
    }
    const leave = () => {
      if (!member) return;
      // closing commits what was consumed (auto commit), then leaves the group
      if (member.autoCommit) for (const [k, v] of member.position) if (v !== null) g.offsets.set(k, v);
      g.members = g.members.filter((m) => m !== member);
      if (!g.offsets.size && !g.members.length) cl.groups.delete(g.id);
      else rebalance(cl, g);
    };
    if (maxMessages !== -1 && count >= maxMessages) { leave(); io.err(`Processed a total of ${count} messages\n`); return 0; }
    if (timeoutMs !== null) {
      leave();
      io.err(`${stamp(nowMs(e) + timeoutMs)} ERROR Error processing message, terminating consumer process:  (org.apache.kafka.tools.consumer.ConsoleConsumer)\norg.apache.kafka.common.errors.TimeoutException\nProcessed a total of ${count} messages\n`);
      return 0;
    }
    leave();
    io.err(`(The sandbox stopped the consumer here: kafka-console-consumer.sh keeps waiting for new events until you press Ctrl+C. Add --max-messages N or --timeout-ms 5000 to make it stop by itself.)\nProcessed a total of ${count} messages\n`);
    return 0;
  }

  // kafka-consumer-groups.sh
  async function groupsTool(sh, args, io) {
    const e = D.engine(sh);
    const p = parseOpts(args, { "bootstrap-server": "value", list: "flag", describe: "flag", delete: "flag", "reset-offsets": "flag", "delete-offsets": "flag", group: "multi", "all-groups": "flag", topic: "multi", "all-topics": "flag", "to-earliest": "flag", "to-latest": "flag", "to-current": "flag", "to-offset": "value", "shift-by": "value", "to-datetime": "value", "by-duration": "value", execute: "flag", "dry-run": "flag", members: "flag", offsets: "flag", state: "flag", verbose: "flag", type: "value", timeout: "value", "command-config": "value", help: "flag", version: "flag" });
    if (p.error) return usageExit(io, "kafka-consumer-groups.sh", p.error);
    const o = p.opts;
    if (o.version) { io.out(`${VERSION} (Commit:${COMMIT_ID})\n`); return 0; }
    const actions = ["list", "describe", "delete", "reset-offsets", "delete-offsets"].filter((a) => o[a]);
    if (actions.length !== 1) return usageExit(io, "kafka-consumer-groups.sh", "Command must include exactly one action: --list, --describe, --delete, --reset-offsets, --delete-offsets");
    const action = actions[0];
    if (action === "describe" && !o.group && !o["all-groups"]) return usageExit(io, "kafka-consumer-groups.sh", "Option [describe] takes one of these options: [all-groups], [group]");
    if (action === "delete" && !o.group && !o["all-groups"]) return usageExit(io, "kafka-consumer-groups.sh", "Option [delete] takes one of these options: [all-groups], [group]");
    if (action === "reset-offsets") {
      if (o["dry-run"] && o.execute) return usageExit(io, "kafka-consumer-groups.sh", "Option [reset-offsets] only accepts one of [execute] and [dry-run]");
      if (!o["dry-run"] && !o.execute) io.err("WARN: No action will be performed as the --execute option is missing. In version 5.0, this command will require either --dry-run or --execute to be specified. You should add the --dry-run option explicitly if you are scripting this command and want to keep the current default behavior without prompting.\n");
      if (!o.group && !o["all-groups"]) return usageExit(io, "kafka-consumer-groups.sh", "Option [reset-offsets] takes one of these options: [all-groups], [group]");
    }
    const { s, exit } = sessionOrFail(sh, io, o["bootstrap-server"], "org.apache.kafka.tools.consumer.group.ConsumerGroupCommand", "AdminClient clientId=adminclient-1", "admin client");
    if (exit !== undefined) return exit;
    const cl = s.cl;
    const gids = o["all-groups"] ? [...cl.groups.keys()].sort() : o.group ?? [];
    if (action === "list") { io.out([...cl.groups.keys()].map((x) => x + "\n").join("")); return 0; }
    if (action === "describe") {
      for (const gid of [...gids].sort()) {
        const g = cl.groups.get(gid);
        if (!g) { io.out(`\nError: Consumer group '${gid}' does not exist.\n`); continue; }
        if (o.state) {
          const coord = [...cl.brokers.values()].find(alive);
          const a = coord?.advertised[0] ?? coord?.listeners[0];
          const coordinator = `${a?.host || coord?.container.hostname}:${a?.port}  (${coord?.nodeId})`;
          const strategy = g.protocol === "classic" ? (g.members.length ? "range" : "-") : "uniform";
          const gl = Math.max(15, gid.length), cw = Math.max(25, coordinator.length);
          if (g.state === "Empty") io.err(`\nConsumer group '${gid}' has no active members.\n`);
          io.out(`\n${pad("GROUP", -gl)} ${pad("COORDINATOR (ID)", -cw)} ${pad("ASSIGNMENT-STRATEGY", -20)} ${pad("STATE", -20)} #MEMBERS\n${pad(gid, -gl)} ${pad(coordinator, -cw)} ${pad(strategy, -20)} ${pad(g.state, -20)} ${g.members.length}\n`);
          continue;
        }
        if (o.members) {
          if (g.state === "Empty") { io.err(`\nConsumer group '${gid}' has no active members.\n`); continue; }
          const ms = g.members;
          const cid = Math.max(15, ...ms.map((m) => m.memberId.length)), hl = Math.max(15, ...ms.map((m) => m.host.length)), cl2 = Math.max(15, ...ms.map((m) => m.clientId.length));
          const gl = Math.max(15, gid.length);
          let text = `\n${pad("GROUP", -gl)} ${pad("CONSUMER-ID", -cid)} ${pad("HOST", -hl)} ${pad("CLIENT-ID", -cl2)} ${pad("#PARTITIONS", -15)} \n`;
          for (const m of ms) text += `${pad(gid, -gl)} ${pad(m.memberId, -cid)} ${pad(m.host, -hl)} ${pad(m.clientId, -cl2)} ${pad(m.assignment.length, -15)} \n`;
          io.out(text);
          continue;
        }
        if (g.state === "Empty") io.err(`\nConsumer group '${gid}' has no active members.\n`);
        const rows = [];
        const assigned = new Set();
        const byMember = [...g.members].filter((m) => m.assignment.length).sort((a, b) => b.assignment.length - a.assignment.length);
        for (const m of byMember) {
          const list = m.assignment.map(([tn, i]) => [tn, i]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
          for (const [tn, i] of list) {
            assigned.add(`${tn}:${i}`);
            const t = cl.topics.get(tn);
            const end = endOffset(t.partitions[i]);
            const cur = g.offsets.get(`${tn}:${i}`);
            rows.push([gid, tn, i, cur ?? "-", end, cur === undefined ? "-" : end - cur, m.memberId, m.host, m.clientId]);
          }
        }
        const rest = [...g.offsets.keys()].filter((k) => !assigned.has(k)).map((k) => { const i = k.lastIndexOf(":"); return [k.slice(0, i), Number(k.slice(i + 1))]; }).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
        for (const [tn, i] of rest) {
          const t = cl.topics.get(tn);
          if (!t) continue;
          const end = endOffset(t.partitions[i]);
          const cur = g.offsets.get(`${tn}:${i}`);
          rows.push([gid, tn, i, cur, end, end - cur, "-", "-", "-"]);
        }
        if (!rows.length) { if (g.state !== "Empty") io.out(""); continue; }
        const gl = Math.max(15, ...rows.map((r) => r[0].length)), tl = Math.max(15, ...rows.map((r) => r[1].length)), cid = Math.max(15, ...rows.map((r) => String(r[6]).length)), hl = Math.max(15, ...rows.map((r) => String(r[7]).length));
        const line = (r) => `\n${pad(r[0], -gl)} ${pad(r[1], -tl)} ${pad(r[2], -10)} ${pad(r[3], -15)} ${pad(r[4], -15)} ${pad(r[5], -15)} ${pad(r[6], -cid)} ${pad(r[7], -hl)} ${r[8]}`;
        io.out(line(["GROUP", "TOPIC", "PARTITION", "CURRENT-OFFSET", "LOG-END-OFFSET", "LAG", "CONSUMER-ID", "HOST", "CLIENT-ID"]) + rows.map(line).join("") + "\n");
      }
      return 0;
    }
    if (action === "delete") {
      const ok = [], failed = [];
      for (const gid of gids) {
        const g = cl.groups.get(gid);
        if (!g) failed.push([gid, "org.apache.kafka.common.errors.GroupIdNotFoundException: The group id does not exist."]);
        else if (g.members.length) failed.push([gid, "org.apache.kafka.common.errors.GroupNotEmptyException: The group is not empty."]);
        else { cl.groups.delete(gid); ok.push(gid); }
      }
      if (!failed.length) io.out(`Deletion of requested consumer groups (${ok.map((x) => `'${x}'`).join(", ")}) was successful.\n`);
      else {
        io.out("Deletion of some consumer groups failed:\n" + failed.map(([gid, err]) => `* Group '${gid}' could not be deleted due to: ${err}\n`).join(""));
        if (ok.length) io.out(`\nThese consumer groups were deleted successfully: ${ok.map((x) => `'${x}'`).join(", ")}\n`);
      }
      return 0;
    }
    if (action === "reset-offsets") {
      if (!o.topic && !o["all-topics"]) return usageExit(io, "kafka-consumer-groups.sh", "Option [reset-offsets] takes one of these options: [all-topics], [topic]");
      const scenario = ["to-earliest", "to-latest", "to-current", "to-offset", "shift-by", "to-datetime", "by-duration"].filter((k) => o[k] !== undefined);
      if (scenario.length !== 1) return usageExit(io, "kafka-consumer-groups.sh", "Option [reset-offsets] takes exactly one of these options: [to-datetime], [by-duration], [to-earliest], [to-latest], [shift-by], [from-file], [to-current], [to-offset]");
      const plan = new Map();
      for (const gid of gids) {
        const g = cl.groups.get(gid) ?? { id: gid, members: [], offsets: new Map(), state: "Dead" };
        if (g.members.length) { io.out(`\nError: Assignments can only be reset if the group '${gid}' is inactive, but the current state is ${g.state}.\n`); plan.set(gid, []); continue; }
        const targets = [];
        const topicSpecs = o["all-topics"] ? [...new Set([...g.offsets.keys()].map((k) => k.slice(0, k.lastIndexOf(":"))))].map((n) => [n, null]) : o.topic.map((spec) => { const [n, ps] = spec.split(":"); return [n, ps ? ps.split(",").map(Number) : null]; });
        for (const [tn, parts] of topicSpecs) {
          const t = cl.topics.get(tn);
          if (!t) continue;
          for (const pp of t.partitions) {
            if (parts && !parts.includes(pp.index)) continue;
            const cur = g.offsets.get(`${tn}:${pp.index}`) ?? pp.start;
            let to;
            if (o["to-earliest"]) to = pp.start;
            else if (o["to-latest"]) to = endOffset(pp);
            else if (o["to-current"]) to = cur;
            else if (o["to-offset"] !== undefined) to = Number(o["to-offset"]);
            else if (o["shift-by"] !== undefined) to = cur + Number(o["shift-by"]);
            else if (o["to-datetime"] !== undefined) { const ms = Date.parse(o["to-datetime"].replace(/(\.\d{3})$/, "$1Z")); const r = pp.log.find((x) => x.ts >= ms); to = r ? r.offset : endOffset(pp); }
            else if (o["by-duration"] !== undefined) { const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(o["by-duration"]); const ms = nowMs(e) - ((Number(m?.[1] ?? 0) * 60 + Number(m?.[2] ?? 0)) * 60 + Number(m?.[3] ?? 0)) * 1000; const r = pp.log.find((x) => x.ts >= ms); to = r ? r.offset : endOffset(pp); }
            to = Math.max(pp.start, Math.min(endOffset(pp), to));
            targets.push([tn, pp.index, to]);
          }
        }
        plan.set(gid, targets);
        if (o.execute) { const gg = groupOf(cl, gid); for (const [tn, i, to] of targets) gg.offsets.set(`${tn}:${i}`, to); }
      }
      const gl = Math.max(15, ...[...plan.keys()].map((x) => x.length)), tl = Math.max(15, ...[...plan.values()].flat().map((x) => x[0].length));
      let text = "";
      if (plan.size) text += `\n${pad("GROUP", -gl)} ${pad("TOPIC", -tl)} ${pad("PARTITION", -10)} NEW-OFFSET`;
      for (const [gid, targets] of plan) for (const [tn, i, to] of targets) text += `\n${pad(gid, -gl)} ${pad(tn, -tl)} ${pad(i, -10)} ${to}`;
      io.out(text + "\n");
      return 0;
    }
    return 0;
  }

  // kafka-configs.sh (topics only)
  async function configsTool(sh, args, io) {
    const p = parseOpts(args, { "bootstrap-server": "value", "entity-type": "value", "entity-name": "value", "entity-default": "flag", topic: "value", alter: "flag", describe: "flag", "add-config": "value", "delete-config": "value", all: "flag", "command-config": "value", help: "flag", version: "flag" });
    if (p.error) return usageExit(io, "kafka-configs.sh", p.error);
    const o = p.opts;
    if (o.version) { io.out(`${VERSION} (Commit:${COMMIT_ID})\n`); return 0; }
    const type = o.topic ? "topics" : o["entity-type"];
    const name = o.topic ?? o["entity-name"];
    if (!o.alter && !o.describe) return usageExit(io, "kafka-configs.sh", "Command must include exactly one action: --describe, --alter");
    if (type !== "topics") { io.err(`(The sandbox's kafka-configs.sh handles topics: use --entity-type topics --entity-name NAME, or --topic NAME.)\n`); return 1; }
    const { s, exit } = sessionOrFail(sh, io, o["bootstrap-server"], "kafka.admin.ConfigCommand", "AdminClient clientId=adminclient-1", "admin client");
    if (exit !== undefined) return exit;
    const cl = s.cl;
    const t = name ? cl.topics.get(name) : null;
    if (o.describe) {
      const list = name ? (t ? [t] : []) : [...cl.topics.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
      if (name && !t) { io.err(`Error while executing config command with args '${args.join(" ")}'\norg.apache.kafka.common.errors.UnknownTopicOrPartitionException: This server does not host this topic-partition.\n`); return 1; }
      for (const tt of list) {
        io.out(`Dynamic configs for topic ${tt.name} are:\n`);
        for (const k of CONFIG_ORDER) {
          if (tt.configs[k] === undefined) continue;
          const syn = [`DYNAMIC_TOPIC_CONFIG:${k}=${tt.configs[k]}`];
          const stat = [...cl.brokers.values()][0]?.props ?? {};
          if (k === "cleanup.policy") syn.push(stat["log.cleanup.policy"] ? `STATIC_BROKER_CONFIG:log.cleanup.policy=${stat["log.cleanup.policy"]}` : "DEFAULT_CONFIG:log.cleanup.policy=delete");
          else if (k === "min.insync.replicas") syn.push(stat["min.insync.replicas"] ? `STATIC_BROKER_CONFIG:min.insync.replicas=${stat["min.insync.replicas"]}` : "DEFAULT_CONFIG:min.insync.replicas=1");
          else if (k === "segment.bytes") syn.push(...(stat["log.segment.bytes"] ? [`STATIC_BROKER_CONFIG:log.segment.bytes=${stat["log.segment.bytes"]}`] : []), "DEFAULT_CONFIG:log.segment.bytes=1073741824");
          else if (k === "retention.bytes") syn.push("DEFAULT_CONFIG:log.retention.bytes=-1");
          io.out(`  ${k}=${tt.configs[k]} sensitive=false synonyms={${syn.join(", ")}}\n`);
        }
      }
      return 0;
    }
    if (!t) { io.err(`Error while executing config command with args '${args.join(" ")}'\njava.util.concurrent.ExecutionException: org.apache.kafka.common.errors.UnknownTopicOrPartitionException: This server does not host this topic-partition.\n`); return 1; }
    if (o["add-config"]) {
      const parts = [];
      let cur = "", depth = 0;
      for (const ch of o["add-config"]) { if (ch === "[") depth++; if (ch === "]") depth--; if (ch === "," && !depth) { parts.push(cur); cur = ""; } else cur += ch; }
      if (cur) parts.push(cur);
      for (const kvp of parts) {
        const i = kvp.indexOf("=");
        const k = kvp.slice(0, i), v = kvp.slice(i + 1).replace(/^\[(.*)\]$/, "$1");
        if (!LOG_CONFIG_KEYS.includes(k)) { io.err(`Error while executing config command with args '${args.join(" ")}'\njava.util.concurrent.ExecutionException: org.apache.kafka.common.errors.InvalidConfigurationException: Unknown topic config name: ${k}\n`); return 1; }
        t.configs[k] = v;
      }
    }
    if (o["delete-config"]) for (const k of o["delete-config"].split(",")) delete t.configs[k.trim()];
    io.out(`Completed updating config for topic ${t.name}.\n`);
    return 0;
  }

  // kafka-get-offsets.sh: the end (or earliest) offset of each partition
  async function offsetsTool(sh, args, io) {
    const p = parseOpts(args, { "bootstrap-server": "value", topic: "value", "topic-partitions": "value", partitions: "value", time: "value", "exclude-internal-topics": "flag", "command-config": "value", help: "flag" });
    if (p.error) return usageExit(io, "kafka-get-offsets.sh", p.error);
    const o = p.opts;
    const { s, exit } = sessionOrFail(sh, io, o["bootstrap-server"], "org.apache.kafka.tools.GetOffsetShell", "AdminClient clientId=adminclient-1", "admin client");
    if (exit !== undefined) return exit;
    const cl = s.cl;
    const time = o.time ?? "-1";
    let names = [...cl.topics.keys()].sort();
    if (o.topic) { const re = new RegExp("^(?:" + o.topic + ")$"); names = names.filter((n) => re.test(n)); }
    if (o["exclude-internal-topics"]) names = names.filter((n) => !cl.topics.get(n).internal);
    const only = o.partitions ? o.partitions.split(",").map(Number) : null;
    let text = "";
    for (const n of names) for (const pp of cl.topics.get(n).partitions) {
      if (only && !only.includes(pp.index)) continue;
      const off = time === "-2" || time === "earliest" ? pp.start : time === "-1" || time === "latest" ? endOffset(pp) : (pp.log.find((r) => r.ts >= Number(time))?.offset ?? endOffset(pp));
      text += `${n}:${pp.index}:${off}\n`;
    }
    io.out(text);
    return 0;
  }

  const TOOLS = { "kafka-topics.sh": topicsTool, "kafka-console-producer.sh": producerTool, "kafka-console-consumer.sh": consumerTool, "kafka-consumer-groups.sh": groupsTool, "kafka-configs.sh": configsTool, "kafka-get-offsets.sh": offsetsTool };
  const runTool = (fn) => async (sh, args, io) => {
    if (!sh.container || !sh.fs.exists("/opt/kafka/bin")) return null;   // not in a Kafka image: the shell reports it
    return fn(sh, args, io);
  };
  for (const [name, fn] of Object.entries(TOOLS)) {
    D.EXTRA.programs[BIN + name] = runTool(fn);
    D.EXTRA.programs["/opt/kafka/bin/../bin/" + name] = runTool(fn);
  }
  for (const s of SCRIPTS) if (!TOOLS[s]) D.EXTRA.programs[BIN + s] = async (sh, args, io) => {
    if (!sh.container || !sh.fs.exists(BIN + s)) return null;
    io.err(`(The sandbox's Kafka runs kafka-topics.sh, kafka-console-producer.sh, kafka-console-consumer.sh, kafka-consumer-groups.sh, kafka-configs.sh and kafka-get-offsets.sh; ${s} works the same way on your own computer.)\n`);
    return 1;
  };
  D.EXTRA.programs["/etc/kafka/docker/run"] = async (sh, args, io) => {
    if (!sh.container || !sh.fs.exists("/etc/kafka/docker/run")) return null;
    return startBroker(sh, args, io);
  };

  // pgrep and pkill (procps): find and stop background processes, like a console consumer started with docker exec -d
  function matchProcs(sh, args) {
    const full = args.includes("-f");
    const pat = args.filter((a) => !a.startsWith("-")).pop() ?? "";
    const re = new RegExp(pat);
    return (sh.container?.procs ?? []).filter((p) => !p.ended && p.pid !== sh.execProc?.pid && re.test(full ? p.cmd : p.cmd.split(" ")[0].split("/").pop()));
  }
  D.EXTRA.programs.pgrep = async (sh, args, io) => {
    if (!sh.container || !sh.commands?.has("pgrep")) return null;
    const ps = matchProcs(sh, args);
    io.out(ps.map((p) => (args.includes("-a") || args.includes("-l") ? `${p.pid} ${args.includes("-a") ? p.cmd : p.cmd.split(" ")[0].split("/").pop()}` : String(p.pid)) + "\n").join(""));
    return ps.length ? 0 : 1;
  };
  D.EXTRA.programs.pkill = async (sh, args, io) => {
    if (!sh.container || !sh.commands?.has("pkill")) return null;
    const ps = matchProcs(sh, args).filter((p) => p.pid !== 1);
    for (const p of ps) {
      p.ended = true;
      // a console consumer stopped with SIGTERM closes: it commits its offsets and leaves its group
      for (const cl of clustersOf(sh.container.engine).values()) for (const g of cl.groups.values()) {
        const before = g.members.length;
        g.members = g.members.filter((m) => m.proc !== p);
        if (g.members.length !== before) rebalance(cl, g);
      }
    }
    return ps.length ? 0 : 1;
  };

  /* ------------------------------------------------------------ the @confluentinc/kafka-javascript client */

  // npm's view of the package (npm install / npm ci): 26 packages with its dependencies, from npm in October 2026
  NPM_PACKAGES["@confluentinc/kafka-javascript"] = { version: "1.11.0", range: "^1.11.0", added: 26, funding: 1, lockPackages: CONFLUENT_LOCK };

  class KafkaJSError extends Error {
    constructor(message, { code = -1, retriable = false } = {}) { super(message); this.name = "KafkaJSError"; this.code = code; this.retriable = retriable; }
  }
  NODE_PACKAGES.set("@confluentinc/kafka-javascript", ({ sh, proc, console: konsole }) => {
    const e = D.engine(sh);
    let producers = 0, consumers = 0;
    const meta = (name) => ({ name, fac: "BINDING", timestamp: nowMs(e) });
    const toBuf = (v) => (v === null || v === undefined ? null : Buffer.from(v instanceof Uint8Array ? v : String(v)));
    // librdkafka's logs when it can't reach a broker
    const connFail = (name, r, advertised) => {
      const where = advertised ?? `${r.host}:${r.port}`;
      const what = r.error === "dns" ? `Failed to resolve '${where}': Name does not resolve (after 1ms in state CONNECT)` : `Connect to ipv4#${r.ip ?? "127.0.0.1"}:${r.port ?? where.split(":").pop()} failed: Connection refused (after 0ms in state CONNECT)`;
      konsole.error({ message: `[thrd:${where}/${advertised ? "1" : "bootstrap"}]: ${where}/${advertised ? "1" : "bootstrap"}: ${what}`, fac: "FAIL", timestamp: nowMs(e), name });
    };
    class Kafka {
      constructor(config = {}) { this.config = config; }
      producer(config = {}) { return new Producer({ ...(this.config.kafkaJS ?? {}), ...(config.kafkaJS ?? {}) }, { ...this.config, ...config }); }
      consumer(config = {}) { return new Consumer({ ...(this.config.kafkaJS ?? {}), ...(config.kafkaJS ?? {}) }, { ...this.config, ...config }); }
      admin() { throw new KafkaJSError("The sandbox's client supports producer() and consumer(); create topics with kafka-topics.sh."); }
    }
    const bootstrapOf = (kjs, raw) => (kjs.brokers ? kjs.brokers.join(",") : raw["bootstrap.servers"]);
    class Producer {
      constructor(kjs, raw) { this.kjs = kjs; this.raw = raw; this.connected = false; this.state = {}; }
      async connect() {
        const bootstrap = bootstrapOf(this.kjs, this.raw);
        if (!bootstrap) throw new KafkaJSError("Producer: bootstrap.servers or kafkaJS.brokers must be set.", { code: -146 });
        this.name = `${this.kjs.clientId ?? this.raw["client.id"] ?? "rdkafka"}#producer-${++producers}`;
        const s = session(sh, bootstrap);
        if (!s.ok) {
          connFail(this.name, s.tried[0]);
          throw new KafkaJSError("Broker transport failure", { code: -195, retriable: true });
        }
        this.s = s;
        this.connected = true;
        if ((this.kjs.logLevel ?? 4) >= 4) konsole.info({ message: "Producer connected", ...meta(this.name) });
      }
      async send({ topic, messages, acks } = {}) {
        if (!this.connected) throw new KafkaJSError("Cannot send without awaiting connect()", { code: -172 });
        const cl = this.s.cl;
        let t = cl.topics.get(topic);
        if (!t) t = autoCreate(cl, topic);
        if (!t) throw new KafkaJSError("Broker: Unknown topic or partition", { code: 3 });
        const out = [];
        for (const m of messages ?? []) {
          const key = m.key === undefined || m.key === null ? null : String(m.key instanceof Uint8Array ? new TextDecoder().decode(m.key) : m.key);
          const value = m.value === undefined || m.value === null ? null : String(m.value instanceof Uint8Array ? new TextDecoder().decode(m.value) : m.value);
          // librdkafka in KafkaJS mode uses murmur2_random: murmur2 for keys (like Java), a random partition without one
          const pi = m.partition ?? (key !== null ? partitionFor(key, t.partitions.length) : Math.floor(rand(e) * t.partitions.length));
          const pp = t.partitions[pi];
          const leader = cl.brokers.get(pp.leader);
          const reach = alive(leader) ? this.s.reach(leader) : { error: "refused" };
          if (reach.error) {
            connFail(this.name, reach, reach.advertised);
            throw new KafkaJSError("Local: Message timed out", { code: -192, retriable: true });
          }
          const headers = Object.entries(m.headers ?? {}).map(([k, v]) => [k, v === null ? null : String(v)]);
          const r = append(cl, t, pp, { key, value, headers, ts: m.timestamp ? Number(m.timestamp) : nowMs(e), type: "CreateTime" }, String(acks ?? this.kjs.acks ?? -1));
          if (r.error) throw new KafkaJSError(r.error === "NotEnoughReplicasException" ? "Broker: Not enough in-sync replicas" : "Local: Message timed out", { code: r.error === "NotEnoughReplicasException" ? 19 : -192, retriable: true });
          out.push({ topicName: topic, partition: pi, errorCode: 0, baseOffset: String(r.offset), logAppendTime: "-1", logStartOffset: "0" });
        }
        // records with the same topic and partition are reported once, with the first offset
        const merged = [];
        for (const r of out) { const x = merged.find((y) => y.partition === r.partition); if (!x) merged.push(r); }
        newRecordsArrived(cl);
        return merged;
      }
      async sendBatch({ topicMessages = [] } = {}) { const res = []; for (const tm of topicMessages) res.push(...(await this.send(tm))); return res; }
      async flush() {}
      async disconnect() { if (this.connected && (this.kjs.logLevel ?? 4) >= 4) konsole.info({ message: "Producer disconnected", ...meta(this.name) }); this.connected = false; }
      logger() { return { info: (m, x) => konsole.info({ message: m, ...x }), error: (m, x) => konsole.error({ message: m, ...x }), warn: (m, x) => konsole.warn({ message: m, ...x }), debug: () => {} }; }
    }
    class Consumer {
      constructor(kjs, raw) { this.kjs = kjs; this.raw = raw; this.topics = new Set(); this.connected = false; }
      async connect() {
        const bootstrap = bootstrapOf(this.kjs, this.raw);
        const groupId = this.kjs.groupId ?? this.raw["group.id"];
        if (!groupId) throw new KafkaJSError("Consumer: groupId must be set.", { code: -146 });
        this.name = `${this.kjs.clientId ?? this.raw["client.id"] ?? "rdkafka"}#consumer-${++consumers}`;
        const s = session(sh, bootstrap);
        if (!s.ok) { connFail(this.name, s.tried[0]); throw new KafkaJSError("Broker transport failure", { code: -195, retriable: true }); }
        this.s = s;
        this.groupId = groupId;
        this.connected = true;
        if ((this.kjs.logLevel ?? 4) >= 4) konsole.info({ message: "Consumer connected", ...meta(this.name) });
      }
      async subscribe({ topics, topic } = {}) {
        for (const t of topics ?? [topic]) this.topics.add(t instanceof RegExp ? t.source : String(t));
      }
      async run({ eachMessage, eachBatch } = {}) {
        if (!this.connected) throw new KafkaJSError("Run must be called after a successful connect().", { code: -172 });
        if (this.running) throw new KafkaJSError("Consumer is already running.", { code: -172 });
        this.running = true;
        const cl = this.s.cl;
        const protocol = String(this.raw["group.protocol"] ?? "classic");
        const problem = coordinatorProblem(cl);
        if (problem) { konsole.error({ message: `(sandbox) ${problem}`, ...meta(this.name) }); this.keepAlive = { _consumer: true, _drop: () => {} }; if (proc) proc.servers.add(this.keepAlive); return; }
        // the group coordinator is a broker reached at its advertised address: if that fails, the consumer keeps retrying and never joins
        const coord = [...cl.brokers.values()].find((b) => alive(b) && b.roles.includes("broker"));
        const creach = coord ? this.s.reach(coord) : { error: "refused" };
        if (creach.error) { connFail(this.name, creach, creach.advertised); this.keepAlive = { _consumer: true, _drop: () => {} }; if (proc) proc.servers.add(this.keepAlive); return; }
        const g = groupOf(cl, this.groupId, protocol);
        const clientId = this.kjs.clientId ?? this.raw["client.id"] ?? "rdkafka";
        const member = {
          memberId: protocol === "classic" ? `${clientId}-${uuid(e)}` : kafkaUuid(e), clientId, host: "/" + this.s.clientIp, topics: new Set(this.topics), assignment: [],
          reset: this.kjs.fromBeginning || this.raw["auto.offset.reset"] === "earliest" ? "earliest" : "latest", autoCommit: true, container: sh.container ?? null, protocol,
        };
        // librdkafka logs each rebalance through the KafkaJS logger
        member.onAssign = (assignment) => {
          if ((this.kjs.logLevel ?? 4) >= 4) konsole.info({ message: `Received rebalance event with message: 'Local: Assign partitions' and ${assignment.length} partition(s), isLost: false`, ...meta(this.name) });
        };
        const queue = [];
        let busy = false;
        const pump = async () => {
          if (busy) return;
          busy = true;
          try {
            while (queue.length) {
              const { t, pp, r } = queue.shift();
              const message = { key: toBuf(r.key), value: toBuf(r.value), timestamp: String(r.ts), attributes: 0, offset: String(r.offset), size: utf8(r.value ?? "").length, leaderEpoch: pp.leaderEpoch, headers: Object.fromEntries((r.headers ?? []).map(([k, v]) => [k, toBuf(v)])) };
              try {
                if (eachMessage) await eachMessage({ topic: t.name, partition: pp.index, message, heartbeat: async () => {}, pause: () => () => {} });
                else if (eachBatch) await eachBatch({ batch: { topic: t.name, partition: pp.index, messages: [message], highWatermark: String(endOffset(pp)) }, resolveOffset: () => {}, heartbeat: async () => {}, isRunning: () => true, isStale: () => false });
              } catch (err) {
                konsole.error({ message: `Consumer encountered error while processing message. Error details: ${err && err.stack ? err.stack.split("\n")[0] : err}. The same message may be reprocessed.`, ...meta(this.name) });
              }
            }
          } finally { busy = false; }
        };
        member.live = (t, pp, r) => { queue.push({ t, pp, r }); pending.add(pump()); };
        const pending = new Set();
        this.member = member; this.group = g; this.pending = pending;
        g.members.push(member);
        rebalance(cl, g);
        deliverAll(cl, g);
        // a running consumer keeps the Node.js process alive, like a server does
        this.keepAlive = { _consumer: true, _drop: () => this.leave() };
        if (proc) proc.servers.add(this.keepAlive);
        await Promise.all([...pending]);
      }
      leave() {
        if (!this.member) return;
        const cl = this.s.cl, g = this.group;
        g.members = g.members.filter((m) => m !== this.member);
        if (g.members.length) rebalance(cl, g); else g.state = "Empty";
        this.member = null;
        if (proc) proc.servers.delete(this.keepAlive);
      }
      async commitOffsets() {}
      async seek({ topic, partition, offset }) { if (this.group) this.group.offsets.set(`${topic}:${partition}`, Number(offset)); }
      pause() {} resume() {}
      async disconnect() {
        if (this.member) {
          if ((this.kjs.logLevel ?? 4) >= 4) konsole.info({ message: `Received rebalance event with message: 'Local: Revoke partitions' and ${this.member.assignment.length} partition(s), isLost: false`, ...meta(this.name) });
          this.leave();
        }
        if (this.connected && (this.kjs.logLevel ?? 4) >= 4) konsole.info({ message: "Consumer disconnected", ...meta(this.name) });
        this.connected = false;
      }
    }
    const logLevel = { NOTHING: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4 };
    const KafkaJS = { Kafka, logLevel, KafkaJSError, CompressionTypes: { None: "none", GZIP: "gzip", Snappy: "snappy", LZ4: "lz4", ZSTD: "zstd" } };
    return { KafkaJS, default: { KafkaJS } };
  });

  /* ------------------------------------------------------------ for exercise checks */

  addHelpers((sh) => ({
    // the Kafka cluster a container runs (default: the container named kafka, or the only cluster)
    kafka(name) {
      const e = D.engine(sh);
      prune(e);
      const clusters = [...clustersOf(e).values()];
      let cl = null;
      if (name) cl = clusters.find((x) => [...x.brokers.values()].some((b) => b.container.name === name));
      else cl = clusters.find((x) => [...x.brokers.values()].some((b) => b.container.name === "kafka")) ?? clusters[0];
      if (!cl) return null;
      const rec = (r) => ({ key: r.key, value: r.value, offset: r.offset, headers: Object.fromEntries(r.headers ?? []) });
      return {
        brokers: () => [...cl.brokers.values()].map((b) => ({ id: b.nodeId, container: b.container.name, running: alive(b) })),
        topics: () => [...cl.topics.keys()].filter((n) => !cl.topics.get(n).internal).sort(),
        topic: (n) => {
          const t = cl.topics.get(n);
          if (!t) return null;
          return {
            name: t.name, configs: { ...t.configs },
            partitions: t.partitions.map((pp) => ({ index: pp.index, leader: pp.leader, replicas: [...pp.replicas], isr: [...pp.isr], records: pp.log.map(rec) })),
            records: () => t.partitions.flatMap((pp) => pp.log.map((r) => ({ ...rec(r), partition: pp.index }))).sort((a, b) => a.offset - b.offset || a.partition - b.partition),
          };
        },
        groups: () => [...cl.groups.keys()].sort(),
        group: (id) => {
          const g = cl.groups.get(id);
          if (!g) return null;
          return { state: g.state, members: g.members.map((m) => ({ id: m.memberId, client: m.clientId, partitions: m.assignment.map(([t, i]) => `${t}:${i}`) })), offsets: Object.fromEntries(g.offsets), lag: (topic) => { const t = cl.topics.get(topic); return t ? t.partitions.reduce((n, pp) => n + (endOffset(pp) - (g.offsets.get(`${topic}:${pp.index}`) ?? pp.start)), 0) : null; } };
        },
        partitionFor: (key, n) => partitionFor(key, n),
      };
    },
  }));

  return { murmur2, partitionFor };
}

// package-lock.json entries npm writes for @confluentinc/kafka-javascript 1.11.0 and its 25 dependencies (npm 11, October 2026)
const CONFLUENT_LOCK = {"node_modules/@confluentinc/kafka-javascript":{"version":"1.11.0","resolved":"https://registry.npmjs.org/@confluentinc/kafka-javascript/-/kafka-javascript-1.11.0.tgz","integrity":"sha512-DKv7bvUiT60UlBEBNYq54v8kKaRlN/zMhZFTtkjm/qXDxiUSkiEP1JQRncr2I9QEa9Tq51kuDTyVnR4ZQFzmMw==","hasInstallScript":true,"license":"MIT","workspaces":[".","schemaregistry","schemaregistry-examples"],"dependencies":{"@mapbox/node-pre-gyp":"^2.0.3","bindings":"^1.3.1","js-yaml":"^4.3.2","nan":"^2.22.0","tar":"^7.5.16"},"engines":{"node":">=18.0.0"}},"node_modules/@isaacs/fs-minipass":{"version":"4.0.1","resolved":"https://registry.npmjs.org/@isaacs/fs-minipass/-/fs-minipass-4.0.1.tgz","integrity":"sha512-wgm9Ehl2jpeqP3zw/7mo3kRHFp5MEDhqAdwy1fTGkHAwnkGOVsgpvQhL8B5n1qlb01jV3n/bI0ZfZp5lWA1k4w==","license":"ISC","dependencies":{"minipass":"^7.0.4"},"engines":{"node":">=18.0.0"}},"node_modules/@mapbox/node-pre-gyp":{"version":"2.0.3","resolved":"https://registry.npmjs.org/@mapbox/node-pre-gyp/-/node-pre-gyp-2.0.3.tgz","integrity":"sha512-uwPAhccfFJlsfCxMYTwOdVfOz3xqyj8xYL3zJj8f0pb30tLohnnFPhLuqp4/qoEz8sNxe4SESZedcBojRefIzg==","license":"BSD-3-Clause","dependencies":{"consola":"^3.2.3","detect-libc":"^2.0.0","https-proxy-agent":"^7.0.5","node-fetch":"^2.6.7","nopt":"^8.0.0","semver":"^7.5.3","tar":"^7.4.0"},"bin":{"node-pre-gyp":"bin/node-pre-gyp"},"engines":{"node":">=18"}},"node_modules/abbrev":{"version":"3.0.1","resolved":"https://registry.npmjs.org/abbrev/-/abbrev-3.0.1.tgz","integrity":"sha512-AO2ac6pjRB3SJmGJo+v5/aK6Omggp6fsLrs6wN9bd35ulu4cCwaAU9+7ZhXjeqHVkaHThLuzH0nZr0YpCDhygg==","license":"ISC","engines":{"node":"^18.17.0 || >=20.5.0"}},"node_modules/agent-base":{"version":"7.1.4","resolved":"https://registry.npmjs.org/agent-base/-/agent-base-7.1.4.tgz","integrity":"sha512-MnA+YT8fwfJPgBx3m60MNqakm30XOkyIoH1y6huTQvC0PwZG7ki8NacLBcrPbNoo8vEZy7Jpuk7+jMO+CUovTQ==","license":"MIT","engines":{"node":">= 14"}},"node_modules/argparse":{"version":"2.0.1","resolved":"https://registry.npmjs.org/argparse/-/argparse-2.0.1.tgz","integrity":"sha512-8+9WqebbFzpX9OR+Wa6O29asIogeRMzcGtAINdpMHHyAg10f05aSFVBbcEqGf/PXw1EjAZ+q2/bEBg3DvurK3Q==","license":"Python-2.0"},"node_modules/bindings":{"version":"1.5.0","resolved":"https://registry.npmjs.org/bindings/-/bindings-1.5.0.tgz","integrity":"sha512-p2q/t/mhvuOj/UeLlV6566GD/guowlr0hHxClI0W9m7MWYkL1F0hLo+0Aexs9HSPCtR1SXQ0TD3MMKrXZajbiQ==","license":"MIT","dependencies":{"file-uri-to-path":"1.0.0"}},"node_modules/chownr":{"version":"3.0.0","resolved":"https://registry.npmjs.org/chownr/-/chownr-3.0.0.tgz","integrity":"sha512-+IxzY9BZOQd/XuYPRmrvEVjF/nqj5kgT4kEq7VofrDoM1MxoRjEWkrCC3EtLi59TVawxTAn+orJwFQcrqEN1+g==","license":"BlueOak-1.0.0","engines":{"node":">=18"}},"node_modules/consola":{"version":"3.4.2","resolved":"https://registry.npmjs.org/consola/-/consola-3.4.2.tgz","integrity":"sha512-5IKcdX0nnYavi6G7TtOhwkYzyjfJlatbjMjuLSfE2kYT5pMDOilZ4OvMhi637CcDICTmz3wARPoyhqyX1Y+XvA==","license":"MIT","engines":{"node":"^14.18.0 || >=16.10.0"}},"node_modules/debug":{"version":"4.4.3","resolved":"https://registry.npmjs.org/debug/-/debug-4.4.3.tgz","integrity":"sha512-RGwwWnwQvkVfavKVt22FGLw+xYSdzARwm0ru6DhTVA3umU5hZc28V3kO4stgYryrTlLpuvgI9GiijltAjNbcqA==","license":"MIT","dependencies":{"ms":"^2.1.3"},"engines":{"node":">=6.0"},"peerDependenciesMeta":{"supports-color":{"optional":true}}},"node_modules/detect-libc":{"version":"2.1.2","resolved":"https://registry.npmjs.org/detect-libc/-/detect-libc-2.1.2.tgz","integrity":"sha512-Btj2BOOO83o3WyH59e8MgXsxEQVcarkUOpEYrubB0urwnN10yQ364rsiByU11nZlqWYZm05i/of7io4mzihBtQ==","license":"Apache-2.0","engines":{"node":">=8"}},"node_modules/file-uri-to-path":{"version":"1.0.0","resolved":"https://registry.npmjs.org/file-uri-to-path/-/file-uri-to-path-1.0.0.tgz","integrity":"sha512-0Zt+s3L7Vf1biwWZ29aARiVYLx7iMGnEUl9x33fbB/j3jR81u/O2LbqK+Bm1CDSNDKVtJ/YjwY7TUd5SkeLQLw==","license":"MIT"},"node_modules/https-proxy-agent":{"version":"7.0.6","resolved":"https://registry.npmjs.org/https-proxy-agent/-/https-proxy-agent-7.0.6.tgz","integrity":"sha512-vK9P5/iUfdl95AI+JVyUuIcVtd4ofvtrOr3HNtM2yxC9bnMbEdp3x01OhQNnjb8IJYi38VlTE3mBXwcfvywuSw==","license":"MIT","dependencies":{"agent-base":"^7.1.2","debug":"4"},"engines":{"node":">= 14"}},"node_modules/js-yaml":{"version":"4.3.2","resolved":"https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.2.tgz","integrity":"sha512-SFNOvSJ+Dgf/9An904Yx+CgSlIPCkIpao4qo51lpee25TIRejdH3rhR4EZMGoNx3/TP3O+wzWuiTFl4sqbltzA==","funding":[{"type":"github","url":"https://github.com/sponsors/puzrin"},{"type":"github","url":"https://github.com/sponsors/nodeca"}],"license":"MIT","dependencies":{"argparse":"^2.0.1"},"bin":{"js-yaml":"bin/js-yaml.js"}},"node_modules/minipass":{"version":"7.1.3","resolved":"https://registry.npmjs.org/minipass/-/minipass-7.1.3.tgz","integrity":"sha512-tEBHqDnIoM/1rXME1zgka9g6Q2lcoCkxHLuc7ODJ5BxbP5d4c2Z5cGgtXAku59200Cx7diuHTOYfSBD8n6mm8A==","license":"BlueOak-1.0.0","engines":{"node":">=16 || 14 >=14.17"}},"node_modules/minizlib":{"version":"3.1.0","resolved":"https://registry.npmjs.org/minizlib/-/minizlib-3.1.0.tgz","integrity":"sha512-KZxYo1BUkWD2TVFLr0MQoM8vUUigWD3LlD83a/75BqC+4qE0Hb1Vo5v1FgcfaNXvfXzr+5EhQ6ing/CaBijTlw==","license":"MIT","dependencies":{"minipass":"^7.1.2"},"engines":{"node":">= 18"}},"node_modules/ms":{"version":"2.1.3","resolved":"https://registry.npmjs.org/ms/-/ms-2.1.3.tgz","integrity":"sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==","license":"MIT"},"node_modules/nan":{"version":"2.30.0","resolved":"https://registry.npmjs.org/nan/-/nan-2.30.0.tgz","integrity":"sha512-P5mokDkSvCGBz6mZDD/2l+w9QoICRXdCyZ9ONGmTePr40oihJg3Kpn0YU3twKd6PJnwSlLBWNQeOT6yWEV2c4A==","license":"MIT"},"node_modules/node-fetch":{"version":"2.7.0","resolved":"https://registry.npmjs.org/node-fetch/-/node-fetch-2.7.0.tgz","integrity":"sha512-c4FRfUm/dbcWZ7U+1Wq0AwCyFL+3nt2bEw05wfxSz+DWpWsitgmSgYmy2dQdWyKC1694ELPqMs/YzUSNozLt8A==","license":"MIT","dependencies":{"whatwg-url":"^5.0.0"},"engines":{"node":"4.x || >=6.0.0"},"peerDependencies":{"encoding":"^0.1.0"},"peerDependenciesMeta":{"encoding":{"optional":true}}},"node_modules/nopt":{"version":"8.1.0","resolved":"https://registry.npmjs.org/nopt/-/nopt-8.1.0.tgz","integrity":"sha512-ieGu42u/Qsa4TFktmaKEwM6MQH0pOWnaB3htzh0JRtx84+Mebc0cbZYN5bC+6WTZ4+77xrL9Pn5m7CV6VIkV7A==","license":"ISC","dependencies":{"abbrev":"^3.0.0"},"bin":{"nopt":"bin/nopt.js"},"engines":{"node":"^18.17.0 || >=20.5.0"}},"node_modules/semver":{"version":"7.8.5","resolved":"https://registry.npmjs.org/semver/-/semver-7.8.5.tgz","integrity":"sha512-Y7/KDsb8LjooZpwaqGyulO6DQlksgCncchHGk+sZIY4SBvUocMBEFH5Ur1fI4dV+Jvl0w6cjvucaIi40puRioA==","license":"ISC","bin":{"semver":"bin/semver.js"},"engines":{"node":">=10"}},"node_modules/tar":{"version":"7.5.22","resolved":"https://registry.npmjs.org/tar/-/tar-7.5.22.tgz","integrity":"sha512-MFO/QzvtAOmJbkhOaCTvbGcFN9L9b+JunIsDwaKljSOdcLMea3NJ1k9Usz/rjdfSXTq4dfzfeS7W4p4YOAAHeA==","license":"BlueOak-1.0.0","dependencies":{"@isaacs/fs-minipass":"^4.0.0","chownr":"^3.0.0","minipass":"^7.1.2","minizlib":"^3.1.0","yallist":"^5.0.0"},"engines":{"node":">=18"}},"node_modules/tr46":{"version":"0.0.3","resolved":"https://registry.npmjs.org/tr46/-/tr46-0.0.3.tgz","integrity":"sha512-N3WMsuqV66lT30CrXNbEjx4GEwlow3v6rr4mCcv6prnfwhS01rkgyFdjPNBYd9br7LpXV1+Emh01fHnq2Gdgrw==","license":"MIT"},"node_modules/webidl-conversions":{"version":"3.0.1","resolved":"https://registry.npmjs.org/webidl-conversions/-/webidl-conversions-3.0.1.tgz","integrity":"sha512-2JAn3z8AR6rjK8Sm8orRC0h/bcl/DqL7tRPdGZ4I1CjdF+EaMLmYxBHyXuKL849eucPFhvBoxMsflfOb8kxaeQ==","license":"BSD-2-Clause"},"node_modules/whatwg-url":{"version":"5.0.0","resolved":"https://registry.npmjs.org/whatwg-url/-/whatwg-url-5.0.0.tgz","integrity":"sha512-saE57nupxk6v3HY35+jzBwYa0rKSy0XR8JSxZPwgLr7ys0IBzhGviA1/TUGJLmSVqs8pb9AnvICXEuOHLprYTw==","license":"MIT","dependencies":{"tr46":"~0.0.3","webidl-conversions":"^3.0.0"}},"node_modules/yallist":{"version":"5.0.0","resolved":"https://registry.npmjs.org/yallist/-/yallist-5.0.0.tgz","integrity":"sha512-YgvUTfwqyc7UXVMrB+SImsVYSmTS8X/tSrtdNZMImM+n7+QTriRXyXim0mBrTXNeqzVF0KWGgHPeiyViFFrNDw==","license":"BlueOak-1.0.0","engines":{"node":">=18"}}};
