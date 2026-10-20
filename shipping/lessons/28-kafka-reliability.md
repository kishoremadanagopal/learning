# Lesson 28: Replication and reliable producers

**You'll learn:** why one broker isn't enough, replication factor, leaders and followers, in-sync replicas (ISR), combined and isolated KRaft modes, a cluster with Docker Compose (a controller and three brokers), the image's KAFKA_* variables and losing the defaults, CLUSTER_ID and controller quorum voters, YAML anchors and merge keys, topics with --replication-factor 3, leaders spread over brokers, leader election when a broker stops, --under-replicated-partitions, preferred leaders and auto.leader.rebalance.enable, acks (0, 1, all) and min.insync.replicas, NotEnoughReplicasException and the console producer's retries, the durable recipe (RF 3, min ISR 2, acks=all), idempotent producers (default since Kafka 3.0), retries and delivery.timeout.ms, linger.ms, transactions, read_committed and exactly_once_v2, eligible leader replicas (KIP-966, on by default since 4.1), kafka-metadata-quorum.sh, three controllers, availability zones and broker.rack.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#kafka-reliability)**: run every example and check your exercise answers.

## Key terms

- **Replication factor:** how many brokers keep a copy of each partition.
- **Leader / follower:** the copy clients use / a copy that fetches from the leader to keep up.
- **In-sync replicas (ISR):** the copies fully caught up with the leader; only they can become leader.
- **Controller:** the node that manages the cluster's metadata and elects new leaders.
- **acks:** how many replicas must have an event before the leader confirms it (0, 1 or all).
- **min.insync.replicas:** the fewest in-sync copies an acks=all write needs; below it, writes are refused.
- **Under-replicated partition:** a partition with fewer in-sync replicas than replicas.
- **Idempotent producer:** a producer whose retries can't create duplicates or reorder events.
- **Transaction:** writes to several partitions (and offset commits) that become visible all together or not at all.

With one broker, a broken disk or a restart loses access to every event. Real clusters keep several copies of each partition on different brokers: **replication**.

![Three brokers. Partition 0's leader is on broker 3, with followers on brokers 1 and 2; partition 1's leader is on broker 1; partition 2's on broker 2. Producers write to the leader and followers copy from it; the copies that are up to date form the in-sync replicas (ISR). When broker 3 stops, broker 1 becomes partition 0's leader and the ISR shrinks to 1 and 2. A controller (node 4) manages the cluster](../figures/kafka-replication.svg)

| Word | Meaning |
|---|---|
| **replication factor** | how many brokers keep a copy of each partition (3 in production) |
| **leader** | the copy that producers and consumers use |
| **follower** | a copy that keeps up by fetching from the leader |
| **in-sync replicas (ISR)** | the copies that are fully caught up, including the leader; only these can become leader |
| **controller** | the node that runs the cluster: it creates topics and picks a new leader when one fails |

## A cluster with Compose

The setup started a cluster in **isolated mode**: one node is only a KRaft controller, three are only brokers. (Production runs three controllers, so that losing one doesn't stop the cluster; the single node that played both roles in lesson 25 is called **combined mode**, fine for development.)

```bash
services:
  controller:
    image: apache/kafka:4.3.1
    environment:
      KAFKA_NODE_ID: 4
      KAFKA_PROCESS_ROLES: controller
      KAFKA_LISTENERS: CONTROLLER://:9093
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 4@controller:9093
      CLUSTER_ID: 4L6g3nShT-eMCtK--X86sw
  kafka-1:
    image: apache/kafka:4.3.1
    ports:
      - "9092:9092"
    environment: &broker
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker
      KAFKA_LISTENERS: PLAINTEXT://:19092,EXTERNAL://:9092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-1:19092,EXTERNAL://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,EXTERNAL:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 4@controller:9093
      CLUSTER_ID: 4L6g3nShT-eMCtK--X86sw
  kafka-2:
    image: apache/kafka:4.3.1
    environment:
      <<: *broker
      KAFKA_NODE_ID: 2
      KAFKA_LISTENERS: PLAINTEXT://:19092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-2:19092
  kafka-3:
    …the same, with node ID 3 and kafka-3
```

- The image turns `KAFKA_*` variables into broker settings: `KAFKA_NODE_ID` becomes `node.id`, `KAFKA_PROCESS_ROLES` becomes `process.roles`, and so on (underscores become dots). **Once you set any `KAFKA_*` variable, the image's defaults are dropped**, so every required setting must be there.
- `CLUSTER_ID` must be the same on all nodes; `KAFKA_CONTROLLER_QUORUM_VOTERS` lists the controllers as `id@host:port`.
- `&broker` names kafka-1's environment as a YAML **anchor**; `<<: *broker` copies it into kafka-2 and kafka-3, which then override what differs. Compose supports these **merge keys**.
- Listeners are covered in lesson 29: brokers talk to each other and to other containers on `PLAINTEXT` (port 19092), and kafka-1 also accepts connections from your computer on `EXTERNAL` (9092).

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/cluster && cd ~/cluster
cat > compose.yaml <<'EOF'
services:
  controller:
    image: apache/kafka:4.3.1
    environment:
      KAFKA_NODE_ID: 4
      KAFKA_PROCESS_ROLES: controller
      KAFKA_LISTENERS: CONTROLLER://:9093
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 4@controller:9093
      CLUSTER_ID: 4L6g3nShT-eMCtK--X86sw
  kafka-1:
    image: apache/kafka:4.3.1
    ports:
      - "9092:9092"
    environment: &broker
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker
      KAFKA_LISTENERS: PLAINTEXT://:19092,EXTERNAL://:9092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-1:19092,EXTERNAL://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,EXTERNAL:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 4@controller:9093
      CLUSTER_ID: 4L6g3nShT-eMCtK--X86sw
  kafka-2:
    image: apache/kafka:4.3.1
    environment:
      <<: *broker
      KAFKA_NODE_ID: 2
      KAFKA_LISTENERS: PLAINTEXT://:19092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-2:19092
  kafka-3:
    image: apache/kafka:4.3.1
    environment:
      <<: *broker
      KAFKA_NODE_ID: 3
      KAFKA_LISTENERS: PLAINTEXT://:19092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-3:19092
EOF
docker compose up -d > /dev/null 2>&1
```

</details>

```bash
docker compose ps
docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --create --topic payments --partitions 3 --replication-factor 3 --config min.insync.replicas=2
docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --describe --topic payments
```

Each partition has three replicas and a different leader, so the work is spread over the brokers. All three replicas are in sync.

## When a broker stops

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/cluster && cd ~/cluster
cat > compose.yaml <<'EOF'
services:
  controller:
    image: apache/kafka:4.3.1
    environment:
      KAFKA_NODE_ID: 4
      KAFKA_PROCESS_ROLES: controller
      KAFKA_LISTENERS: CONTROLLER://:9093
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 4@controller:9093
      CLUSTER_ID: 4L6g3nShT-eMCtK--X86sw
  kafka-1:
    image: apache/kafka:4.3.1
    ports:
      - "9092:9092"
    environment: &broker
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker
      KAFKA_LISTENERS: PLAINTEXT://:19092,EXTERNAL://:9092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-1:19092,EXTERNAL://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,EXTERNAL:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 4@controller:9093
      CLUSTER_ID: 4L6g3nShT-eMCtK--X86sw
  kafka-2:
    image: apache/kafka:4.3.1
    environment:
      <<: *broker
      KAFKA_NODE_ID: 2
      KAFKA_LISTENERS: PLAINTEXT://:19092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-2:19092
  kafka-3:
    image: apache/kafka:4.3.1
    environment:
      <<: *broker
      KAFKA_NODE_ID: 3
      KAFKA_LISTENERS: PLAINTEXT://:19092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-3:19092
EOF
docker compose up -d > /dev/null 2>&1
docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --create --topic payments --partitions 3 --replication-factor 3 --config min.insync.replicas=2 > /dev/null
```

</details>

```bash
docker compose stop kafka-3
docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --describe --topic payments
docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --describe --under-replicated-partitions
```

The controller noticed: broker 3 left every ISR, and partition 0, which it led, got a new leader from its ISR, broker 1. Producers and consumers follow the new leader automatically. `--under-replicated-partitions` lists partitions with fewer in-sync copies than replicas: in production, an alert should fire when this list isn't empty.

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/cluster && cd ~/cluster
cat > compose.yaml <<'EOF'
services:
  controller:
    image: apache/kafka:4.3.1
    environment:
      KAFKA_NODE_ID: 4
      KAFKA_PROCESS_ROLES: controller
      KAFKA_LISTENERS: CONTROLLER://:9093
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 4@controller:9093
      CLUSTER_ID: 4L6g3nShT-eMCtK--X86sw
  kafka-1:
    image: apache/kafka:4.3.1
    ports:
      - "9092:9092"
    environment: &broker
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker
      KAFKA_LISTENERS: PLAINTEXT://:19092,EXTERNAL://:9092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-1:19092,EXTERNAL://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,EXTERNAL:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 4@controller:9093
      CLUSTER_ID: 4L6g3nShT-eMCtK--X86sw
  kafka-2:
    image: apache/kafka:4.3.1
    environment:
      <<: *broker
      KAFKA_NODE_ID: 2
      KAFKA_LISTENERS: PLAINTEXT://:19092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-2:19092
  kafka-3:
    image: apache/kafka:4.3.1
    environment:
      <<: *broker
      KAFKA_NODE_ID: 3
      KAFKA_LISTENERS: PLAINTEXT://:19092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-3:19092
EOF
docker compose up -d > /dev/null 2>&1
docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --create --topic payments --partitions 3 --replication-factor 3 --config min.insync.replicas=2 > /dev/null
```

</details>

```bash
docker compose stop kafka-3
docker compose start kafka-3
docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --describe --topic payments
```

The restarted broker caught up and rejoined the ISR. Partition 0 keeps its new leader for now; Kafka moves leadership back to the **preferred** leader (the first replica listed) every few minutes (`auto.leader.rebalance.enable`).

## acks and min.insync.replicas

How sure is a producer that an event is safe? Its **acks** setting decides when the leader answers:

| acks | The leader answers when… | Can lose events? |
|---|---|---|
| `0` | never: the producer doesn't wait | yes, any failure |
| `1` | it has written the event itself | yes, if it fails before followers copy it |
| `all` (`-1`, the default since Kafka 3.0) | every in-sync replica has the event | no, as long as an in-sync copy survives |

With `acks=all`, a shrinking ISR is a risk: if only the leader is left in sync, "all" means one copy. The topic setting **min.insync.replicas** sets a floor: with fewer in-sync replicas, the leader refuses `acks=all` writes instead of accepting an unsafe one.

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/cluster && cd ~/cluster
cat > compose.yaml <<'EOF'
services:
  controller:
    image: apache/kafka:4.3.1
    environment:
      KAFKA_NODE_ID: 4
      KAFKA_PROCESS_ROLES: controller
      KAFKA_LISTENERS: CONTROLLER://:9093
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 4@controller:9093
      CLUSTER_ID: 4L6g3nShT-eMCtK--X86sw
  kafka-1:
    image: apache/kafka:4.3.1
    ports:
      - "9092:9092"
    environment: &broker
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker
      KAFKA_LISTENERS: PLAINTEXT://:19092,EXTERNAL://:9092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-1:19092,EXTERNAL://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,EXTERNAL:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 4@controller:9093
      CLUSTER_ID: 4L6g3nShT-eMCtK--X86sw
  kafka-2:
    image: apache/kafka:4.3.1
    environment:
      <<: *broker
      KAFKA_NODE_ID: 2
      KAFKA_LISTENERS: PLAINTEXT://:19092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-2:19092
  kafka-3:
    image: apache/kafka:4.3.1
    environment:
      <<: *broker
      KAFKA_NODE_ID: 3
      KAFKA_LISTENERS: PLAINTEXT://:19092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-3:19092
EOF
docker compose up -d > /dev/null 2>&1
docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --create --topic payments --partitions 3 --replication-factor 3 --config min.insync.replicas=2 > /dev/null
```

</details>

```bash
docker compose stop kafka-2 kafka-3
echo '{"id":1,"amount":3800}' | docker compose exec -T kafka-1 /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server kafka-1:19092 --topic payments
echo '{"id":1,"amount":3800}' | docker compose exec -T kafka-1 /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server kafka-1:19092 --topic payments --command-property acks=1
docker compose exec kafka-1 /opt/kafka/bin/kafka-get-offsets.sh --bootstrap-server kafka-1:19092 --topic payments
```

With two brokers down, each partition has one in-sync replica, fewer than the 2 required. The producer retried 3 times (the console producer's limit), then gave up with `NotEnoughReplicasException`. The same event with `acks=1` was accepted, with only one copy: a broker failure now could lose it. (`-T` turns off the terminal for `docker compose exec`, which pipes need.)

**The durable recipe**: replication factor 3, `min.insync.replicas=2`, producers with `acks=all`. One broker can fail (or be upgraded) without stopping writes or risking data; two failing at once stops writes rather than losing events.

## Producer retries and idempotence

Producers retry failed sends automatically, which raises a question: what if the first attempt succeeded and only the reply was lost? The retry would write the event twice. Since Kafka 3.0, producers are **idempotent** by default (`enable.idempotence=true`): each producer has an ID and numbers its events, so the broker drops duplicates and keeps the order within a partition, even across retries.

| Producer setting | Default (Java client) | What it controls |
|---|---|---|
| `acks` | `all` | how many replicas must have the event |
| `enable.idempotence` | `true` | no duplicates or reordering from retries |
| `retries` | unlimited (2147483647) | retries until `delivery.timeout.ms` |
| `delivery.timeout.ms` | 120000 (2 minutes) | how long a send may take, retries included |
| `linger.ms` | 5 | how long to wait to fill a batch |

## Exactly once

Idempotence prevents duplicates from one producer's retries. **Transactions** go further: a producer can write to several partitions and commit consumer offsets **atomically**, so either all of it happens or none; consumers set `isolation.level=read_committed` to skip aborted writes. That's how Kafka Streams offers exactly-once processing from Kafka to Kafka (`processing.guarantee=exactly_once_v2`). Anything outside Kafka (a database, an email) still needs idempotent handling (lesson 27).

## Eligible leader replicas

The partition lines end with `Elr` and `LastKnownElr`. Kafka 4.1 turned on **eligible leader replicas** (KIP-966) for new clusters: when the ISR shrinks below `min.insync.replicas`, the replicas that just left are remembered as still safe to lead, because they have every write the producers were told was committed. After a bad outage, Kafka can then choose a leader without losing acknowledged events. The lists are usually empty.

## Try it on your own computer

- The same Compose file runs on Docker Desktop; give the brokers 10 to 20 seconds to start. The official repository's [Docker examples](https://github.com/apache/kafka/tree/trunk/docker/examples) include clusters in combined and isolated mode, with SSL and SASL.
- `kafka-metadata-quorum.sh --bootstrap-server … describe --status` shows the controller quorum: its leader, its voters and how far behind each is.
- In production, run three (or five) controllers, spread brokers across availability zones, and use `broker.rack` so replicas of each partition go to different zones.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Start a cluster from a Compose file | docker compose up -d | creates containers | docker compose down |
| Create a durable topic | kafka-topics.sh … --create --topic T --partitions N --replication-factor 3 --config min.insync.replicas=2 | adds a topic | kafka-topics.sh … --delete --topic T |
| Find under-replicated partitions | kafka-topics.sh … --describe --under-replicated-partitions | nothing | — |
| Stop / start a broker | docker compose stop kafka-3 / docker compose start kafka-3 | the broker's container | the other one |
| Send with weaker durability | kafka-console-producer.sh … --command-property acks=1 | appends events | — |
| Show the controller quorum | kafka-metadata-quorum.sh --bootstrap-server B describe --status | nothing | — |

## Common mistakes

- Using replication factor 1 in production, so one broken broker loses its partitions.
- Setting min.insync.replicas equal to the replication factor, so any single broker restart stops writes.
- Switching to acks=1 to "fix" NotEnoughReplicas errors and risking lost events.
- Setting one KAFKA_* variable in the image and forgetting the others the defaults used to provide.
- Running a single controller in production, so losing it stops the cluster.

## Exercises

### 1. A durable topic for invoices

The cluster (a controller and three brokers) is running in `~/cluster`. Create the topic `invoices` with 6 partitions that survives a broker failure without losing acknowledged events: replication factor 3 and `min.insync.replicas` of 2. Then describe it.

<details>
<summary>The sandbox starts this exercise with these commands (run them first on your own computer)</summary>

```bash
mkdir -p ~/cluster && cd ~/cluster
cat > compose.yaml <<'EOF'
services:
  controller:
    image: apache/kafka:4.3.1
    environment:
      KAFKA_NODE_ID: 4
      KAFKA_PROCESS_ROLES: controller
      KAFKA_LISTENERS: CONTROLLER://:9093
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 4@controller:9093
      CLUSTER_ID: 4L6g3nShT-eMCtK--X86sw
  kafka-1:
    image: apache/kafka:4.3.1
    ports:
      - "9092:9092"
    environment: &broker
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker
      KAFKA_LISTENERS: PLAINTEXT://:19092,EXTERNAL://:9092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-1:19092,EXTERNAL://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,EXTERNAL:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 4@controller:9093
      CLUSTER_ID: 4L6g3nShT-eMCtK--X86sw
  kafka-2:
    image: apache/kafka:4.3.1
    environment:
      <<: *broker
      KAFKA_NODE_ID: 2
      KAFKA_LISTENERS: PLAINTEXT://:19092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-2:19092
  kafka-3:
    image: apache/kafka:4.3.1
    environment:
      <<: *broker
      KAFKA_NODE_ID: 3
      KAFKA_LISTENERS: PLAINTEXT://:19092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-3:19092
EOF
docker compose up -d > /dev/null 2>&1
```

</details>

Starter:

```bash
docker compose ps
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** durability comes from replicas on different brokers plus a minimum number in sync for `acks=all`.
2. **Examples:** the lesson created `payments` with the same settings and 3 partitions.
3. **Brute force:** replication factor 1 is fast, but a broker failure makes its partitions unavailable, or lost with its disk.
4. **Pattern:** **RF 3 + min.insync.replicas=2 + acks=all**.
5. **Plan:** create with all three options; describe.
6. **Code and test:** six partition lines, each with three replicas and three in sync, and `Configs: min.insync.replicas=2`.

</details>

<details>
<summary>💡 Hint 1</summary>

Run the tool in one of the brokers with `docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 …`.

</details>

<details>
<summary>💡 Hint 2</summary>

`--replication-factor 3` gives each partition three copies; `--config min.insync.replicas=2` sets the topic's floor.

</details>

<details>
<summary>💡 Hint 3</summary>

`--create --topic invoices --partitions 6 --replication-factor 3 --config min.insync.replicas=2`, then `--describe --topic invoices`.

</details>

### 2. Back to full health

In the cluster, broker `kafka-3` stopped, and `payments` now has under-replicated partitions. Find them, bring the cluster back to full health, and check that no partition is under-replicated any more.

<details>
<summary>The sandbox starts this exercise with these commands (run them first on your own computer)</summary>

```bash
mkdir -p ~/cluster && cd ~/cluster
cat > compose.yaml <<'EOF'
services:
  controller:
    image: apache/kafka:4.3.1
    environment:
      KAFKA_NODE_ID: 4
      KAFKA_PROCESS_ROLES: controller
      KAFKA_LISTENERS: CONTROLLER://:9093
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 4@controller:9093
      CLUSTER_ID: 4L6g3nShT-eMCtK--X86sw
  kafka-1:
    image: apache/kafka:4.3.1
    ports:
      - "9092:9092"
    environment: &broker
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker
      KAFKA_LISTENERS: PLAINTEXT://:19092,EXTERNAL://:9092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-1:19092,EXTERNAL://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,EXTERNAL:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 4@controller:9093
      CLUSTER_ID: 4L6g3nShT-eMCtK--X86sw
  kafka-2:
    image: apache/kafka:4.3.1
    environment:
      <<: *broker
      KAFKA_NODE_ID: 2
      KAFKA_LISTENERS: PLAINTEXT://:19092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-2:19092
  kafka-3:
    image: apache/kafka:4.3.1
    environment:
      <<: *broker
      KAFKA_NODE_ID: 3
      KAFKA_LISTENERS: PLAINTEXT://:19092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-3:19092
EOF
docker compose up -d > /dev/null 2>&1
docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --create --topic payments --partitions 3 --replication-factor 3 --config min.insync.replicas=2 > /dev/null
```

</details>

Starter:

```bash
docker compose stop kafka-3 > /dev/null 2>&1
docker compose ps
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** under-replicated means some replica isn't in sync, usually because its broker is down or slow.
2. **Examples:** the lesson stopped kafka-3 and saw broker 3 leave every ISR.
3. **Brute force:** recreating the topic would lose its events.
4. **Pattern:** **find (under-replicated list) → fix the broker → confirm the list is empty**.
5. **Plan:** describe, start kafka-3, describe again.
6. **Code and test:** the first describe lists three partitions; the second prints nothing.

</details>

<details>
<summary>💡 Hint 1</summary>

`kafka-topics.sh --describe --under-replicated-partitions` lists partitions whose ISR is smaller than their replica list.

</details>

<details>
<summary>💡 Hint 2</summary>

`docker compose ps` shows which broker is down; `docker compose start kafka-3` starts it again.

</details>

<details>
<summary>💡 Hint 3</summary>

Run the same describe again: an empty result means every partition is fully replicated.

</details>

**In the sandbox:** exercises 55–56. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. A durable topic for invoices</summary>

```bash
docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --create --topic invoices --partitions 6 --replication-factor 3 --config min.insync.replicas=2
docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --describe --topic invoices
```

**Line by line**

- `docker compose exec kafka-1 …` runs the tool in the broker kafka-1; `--bootstrap-server kafka-1:19092` uses the cluster's internal listener.
- `--replication-factor 3` puts each partition's copies on all three brokers, with leaders spread among them.
- `--config min.insync.replicas=2` makes `acks=all` writes fail rather than land on a single copy.

**Trace:** `Created topic invoices.`, then the topic line with `ReplicationFactor: 3	Configs: min.insync.replicas=2` and six partition lines.

**Common wrong approach:** `min.insync.replicas=3`. With all three replicas required, any single broker restart stops writes: that's less availability, not more safety.

</details>

<details>
<summary>✅ 2. Back to full health</summary>

```bash
docker compose stop kafka-3 > /dev/null 2>&1
docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --describe --under-replicated-partitions
docker compose start kafka-3
docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --describe --under-replicated-partitions
```

**Line by line**

- `--describe --under-replicated-partitions` prints only partitions with `Isr` shorter than `Replicas`: here all three, each missing broker 3.
- `docker compose start kafka-3` restarts the stopped container; the broker catches up from the leaders and the controller adds it back to each ISR.
- The second describe prints nothing: every partition is fully in sync again.

**Trace:** before, `Isr: 1,2` (or `2,1`) on each partition; after, an empty list.

**Common wrong approach:** `docker compose up -d` after editing nothing. It also starts the stopped container, but `start` says exactly what you mean and can't recreate a container whose configuration changed.

</details>

## Quick quiz

1. A topic has replication factor 3 and min.insync.replicas=2, and producers use acks=all. One broker fails. What happens?
   - A) Events on the failed broker are lost
   - B) Producers switch to acks=1
   - C) Writes stop until the broker returns
   - D) Writes continue, since two replicas are still in sync, and no acknowledged event is lost

2. What does acks=1 trade away?
   - A) Durability: the event is acknowledged once the leader has it, so it can be lost if the leader fails before followers copy it
   - B) Nothing; it's the safest setting
   - C) The ability to use keys
   - D) Ordering within a partition

3. What does an idempotent producer prevent?
   - A) Two different producers writing the same value
   - B) Duplicate (and reordered) events caused by its own retries
   - C) Consumers reading an event twice
   - D) Events being deleted by retention

4. A partition's leader broker stops. Which broker becomes the new leader?
   - A) None: the partition stays offline until the broker returns
   - B) The producer chooses one
   - C) Another replica from the partition's in-sync replicas, chosen by the controller
   - D) Any broker in the cluster, even one without a copy

<details>
<summary>Quiz answers</summary>

1. **D) Writes continue, since two replicas are still in sync, and no acknowledged event is lost**: This is why RF 3 with min.insync.replicas=2 is the usual production setting.
2. **A) Durability: the event is acknowledged once the leader has it, so it can be lost if the leader fails before followers copy it**: acks=all (the default) waits for every in-sync replica.
3. **B) Duplicate (and reordered) events caused by its own retries**: The broker uses the producer's ID and sequence numbers to drop retried duplicates; it's on by default since Kafka 3.0.
4. **C) Another replica from the partition's in-sync replicas, chosen by the controller**: Only in-sync replicas have every committed event; unclean.leader.election.enable (off by default) would allow others, with data loss.

</details>

---
Previous: [Lesson 27](27-consumer-groups.md) · Next: [Lesson 29: Kafka in your services](29-kafka-apps.md)
