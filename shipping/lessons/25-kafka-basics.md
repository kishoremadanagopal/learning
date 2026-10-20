# Lesson 25: Events and Apache Kafka

**You'll learn:** why services exchange events instead of calling each other, Apache Kafka as an append-only log, events (key, value, timestamp, headers), topics, partitions, offsets, brokers, clusters and controllers, producers and consumers, Kafka versus a message queue (RabbitMQ, SQS) and retention, KRaft and the end of ZooKeeper in Kafka 4.0, Kafka 4.3.1 and the apache/kafka image, single-node combined mode, waiting for "Kafka Server started", the tools in /opt/kafka/bin, --bootstrap-server, kafka-topics.sh --create, --list and --describe (topic ID, partition count, replication factor, configs, leader, replicas, ISR), topic names, the console producer and docker exec -i, the console consumer (--from-beginning, --max-messages, --timeout-ms), reading doesn't remove events, apache/kafka-native, Kafbat UI.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#kafka-basics)**: run every example and check your exercise answers.

## Key terms

- **Event:** a record of something that happened, with a key, a value, a timestamp and optional headers.
- **Topic:** a named, append-only stream of events, such as orders.
- **Partition:** one ordered log of a topic; a topic is split into partitions spread over brokers.
- **Offset:** an event's position in its partition, counting from 0.
- **Broker:** a Kafka server that stores partitions and serves clients.
- **Producer / consumer:** a program that writes events / reads them.
- **Bootstrap server:** the broker address a client contacts first to learn about the whole cluster.
- **Retention:** how long a topic keeps events (7 days by default), however often they're read.
- **KRaft:** Kafka's built-in consensus protocol for managing the cluster, which replaced ZooKeeper.

When a customer places an order, the shop has more to do than save it: billing writes an invoice, the warehouse packs the parcel, an email goes out, and the analytics team counts the sale. If the shop's API called each of those services in turn, one slow or broken service would slow down or break checkout, and every new service would mean changing the API again.

**Event streaming** turns this around. The API records one fact, *an order was placed*, as an **event**, and moves on. Each service that cares reads the events in its own time. The API doesn't know or wait for its readers, and adding a reader changes nothing for the others.

![Producers on the left (the shop's API, the website) append events to the topic orders, which has three partitions: each is a row of numbered records, offsets 0, 1, 2… with new events added at the right. On the right, two consumer groups read independently: in partition 0, billing will read offset 3 next, while analytics is further behind, at offset 1. Reading doesn't remove events; they stay until the retention period ends](../figures/kafka-log.svg)

## Apache Kafka

**Apache Kafka** stores events in **topics**: named, append-only logs. Producers add events to the end; consumers read from any position and remember how far they've got. LinkedIn built Kafka in 2011 to move its activity data around, and today it's the standard event platform: most large companies run it, and every major cloud sells it as a managed service.

| Word | Meaning |
|---|---|
| **event** (record, message) | a fact that happened, with a **key**, a **value** (the data, often JSON), a **timestamp** and optional **headers** |
| **topic** | a named stream of events, like `orders` or `payments` |
| **partition** | a topic is split into partitions, each an ordered log; they let a topic grow beyond one machine (lesson 26) |
| **offset** | an event's position in its partition: 0, 1, 2… |
| **broker** | a Kafka server that stores partitions and serves producers and consumers |
| **cluster** | a group of brokers working together; **controllers** manage it (with **KRaft**, Kafka's own consensus protocol) |
| **producer** | a program that writes events |
| **consumer** | a program that reads events; consumers in a **consumer group** share the work (lesson 27) |

Kafka isn't a **message queue** like RabbitMQ or Amazon SQS, where a message disappears once someone has handled it. A Kafka topic keeps its events for a **retention period** (7 days by default), however often they're read. That's why several services can read the same events, a new service can start from the beginning, and a service with a bug can be fixed and re-read the history.

Kafka 4.0 (March 2025) removed ZooKeeper, the separate service older clusters needed: since then, Kafka manages itself with KRaft. The current release is **Kafka 4.3.1** (June 2026), and the course runs it from the official Docker image `apache/kafka`.

## Running Kafka in Docker

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
docker run hello-world > /dev/null
docker run --rm node:24-alpine node --version > /dev/null
docker run --rm node:26-alpine node --version > /dev/null
docker run --rm alpine cat /etc/os-release > /dev/null
```

</details>

```bash
docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1
docker ps
docker logs kafka | grep "Kafka Server started"
```

With no settings, the image runs a single node that is both **broker** and **controller**, listening on port 9092 for clients (published to your computer by `-p`). A real broker takes 10 to 20 seconds to start: wait for `Kafka Server started` in its logs before using it.

## Kafka's tools

Kafka comes with command-line tools, shell scripts in `/opt/kafka/bin` inside the container. They're not on the `PATH`, so give the full path:

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1 > /dev/null 2>&1
```

</details>

*This example raises an error on purpose.*

```bash
docker exec kafka kafka-topics.sh --list
```

Every tool needs `--bootstrap-server`: the address of a broker to start from. Inside the container, the broker is `localhost:9092`.

## Topics

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1 > /dev/null 2>&1
```

</details>

```bash
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic orders
```

`--describe` prints the topic's ID, its partition count, its **replication factor** (how many brokers keep a copy of each partition: 1 here, since there's one broker; lesson 28 uses three), and any settings that differ from Kafka's defaults (`segment.bytes`, the size of the files a partition is stored in, comes from the image's configuration). Then a line per partition: which broker leads it, which hold copies (`Replicas`), and which copies are up to date (`Isr`, the **in-sync replicas**). Node `1` is our only broker.

Topic names may contain letters, digits, `.`, `_` and `-`. Pick a style and stick to it: `orders`, `payments`, `order-events`.

## Producing events

`kafka-console-producer.sh` sends each line it reads from standard input as one event. `docker exec -i` passes your input into the container:

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1 > /dev/null 2>&1
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3 > /dev/null
```

</details>

```bash
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders <<'EOF'
{"id":1,"customer":"ada","items":["bell"]}
{"id":2,"customer":"grace","items":["pump","lock"]}
EOF
```

It prints nothing when all goes well. Without `-i`, the tool's standard input is empty, so it sends nothing and still succeeds: a classic silent mistake. On your own computer you can also type the events: `docker exec -it kafka /opt/kafka/bin/kafka-console-producer.sh …` shows a `>` prompt for each line; press Ctrl+D when you're done.

## Consuming events

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1 > /dev/null 2>&1
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3 > /dev/null
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders <<'EOF'
{"id":1,"customer":"ada","items":["bell"]}
{"id":2,"customer":"grace","items":["pump","lock"]}
EOF
```

</details>

```bash
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --from-beginning --max-messages 2
```

- `--from-beginning` starts at the oldest event. Without it, a consumer starts at the end and only sees events that arrive after it started.
- `--max-messages 2` stops after two events. Without it (or `--timeout-ms`), the consumer keeps waiting for new events until you press Ctrl+C.
- The tool prints the events on standard output, and on standard error a notice about the new rebalance protocol (lesson 27) and the count at the end.

Run it again and you get the same two events: reading didn't remove them.

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1 > /dev/null 2>&1
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3 > /dev/null
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders <<'EOF'
{"id":1,"customer":"ada","items":["bell"]}
{"id":2,"customer":"grace","items":["pump","lock"]}
EOF
```

</details>

```bash
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --from-beginning --max-messages 2 2>/dev/null
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --timeout-ms 2000
```

The second consumer started at the end of the topic, found nothing new within 2 seconds, and exited. `--timeout-ms` ends with a `TimeoutException` logged as an `ERROR`: it looks alarming, but it's the normal way this option stops.

## Try it on your own computer

- You need Docker (Part 4). Then `docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1` gives you the same single-node Kafka. There's also `apache/kafka-native`, a GraalVM build that starts in under a second and uses less memory, made for testing, not production.
- Without Docker, download Kafka from [kafka.apache.org/downloads](https://kafka.apache.org/downloads) and follow the [quickstart](https://kafka.apache.org/quickstart): it needs Java 17 or newer, and you run `bin/kafka-storage.sh format` once before `bin/kafka-server-start.sh config/server.properties`.
- Graphical tools help you look inside: [Kafbat UI](https://github.com/kafbat/kafka-ui) (free, runs in Docker) and Confluent's VS Code extension both show topics, partitions, events and consumer groups.
- `docker stop kafka` stops it; `docker rm kafka` deletes it and its data, since the image keeps its data inside the container.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Run Kafka in Docker | docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1 | starts a broker | docker rm -f kafka |
| Create a topic | kafka-topics.sh --bootstrap-server B --create --topic T --partitions 3 | adds a topic | kafka-topics.sh … --delete --topic T |
| List / describe topics | kafka-topics.sh --bootstrap-server B --list / --describe --topic T | nothing | — |
| Send events from a file or here-document | docker exec -i kafka …kafka-console-producer.sh --bootstrap-server B --topic T | appends events | — (retention removes them) |
| Read a topic from the start | kafka-console-consumer.sh --bootstrap-server B --topic T --from-beginning --max-messages N | nothing | — |

## Common mistakes

- Calling a tool by name (kafka-topics.sh) when /opt/kafka/bin isn't on the PATH.
- Piping input to docker exec without -i, so the producer sends nothing and still succeeds.
- Forgetting --from-beginning and wondering why a new consumer prints nothing.
- Running the console consumer without --max-messages or --timeout-ms, so it never stops.
- Treating Kafka like a queue that deletes events once they're read.

## Exercises

### 1. A topic for payments

Kafka is running as the container `kafka`. Create a topic called `payments` with 2 partitions, then list the topics to check it's there.

<details>
<summary>The sandbox starts this exercise with these commands (run them first on your own computer)</summary>

```bash
docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1 > /dev/null 2>&1
```

</details>

Starter:

```bash
docker ps
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** topics are created with `kafka-topics.sh`, run inside the Kafka container.
2. **Examples:** the lesson created `orders` with `--create --topic orders --partitions 3`.
3. **Brute force:** `docker exec kafka kafka-topics.sh …` fails: the tools aren't on the container's `PATH`.
4. **Pattern:** **docker exec CONTAINER /opt/kafka/bin/TOOL --bootstrap-server localhost:9092 ACTION**.
5. **Plan:** create, then list.
6. **Code and test:** `Created topic payments.`, then `--list` prints `payments`.

</details>

<details>
<summary>💡 Hint 1</summary>

The tools are in `/opt/kafka/bin` inside the container: `docker exec kafka /opt/kafka/bin/kafka-topics.sh …`.

</details>

<details>
<summary>💡 Hint 2</summary>

Every tool needs `--bootstrap-server localhost:9092`; creating a topic needs `--create --topic payments --partitions 2`.

</details>

<details>
<summary>💡 Hint 3</summary>

`docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic payments --partitions 2`, then the same with `--list` instead of the create options.

</details>

### 2. Send and read three orders

The topic `orders` exists but is empty. Send these three events with the console producer, then read all of them back with the console consumer, making it stop by itself.

```text
{"id":1,"customer":"ada","items":["bell"]}
{"id":2,"customer":"grace","items":["pump"]}
{"id":3,"customer":"linus","items":["lock","bell"]}
```

<details>
<summary>The sandbox starts this exercise with these commands (run them first on your own computer)</summary>

```bash
docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1 > /dev/null 2>&1
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3 > /dev/null
```

</details>

Starter:

```bash
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic orders
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** one line in, one event out; reading starts at the end unless you ask for the beginning.
2. **Examples:** the lesson piped two orders in with a here-document and read them with `--from-beginning --max-messages 2`.
3. **Brute force:** without `-i` nothing reaches the producer, and nothing is sent, without any error.
4. **Pattern:** **producer: docker exec -i + stdin; consumer: --from-beginning + --max-messages**.
5. **Plan:** produce the three lines, consume three events.
6. **Code and test:** the consumer prints the three JSON lines and `Processed a total of 3 messages`.

</details>

<details>
<summary>💡 Hint 1</summary>

The console producer reads lines from standard input; `docker exec -i` connects your input to it. A here-document (`<<'EOF'` … `EOF`) supplies the lines.

</details>

<details>
<summary>💡 Hint 2</summary>

The consumer needs `--from-beginning`, since the events were written before it started.

</details>

<details>
<summary>💡 Hint 3</summary>

`--max-messages 3` makes it stop after the three events.

</details>

**In the sandbox:** exercises 49–50. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. A topic for payments</summary>

```bash
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic payments --partitions 2
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
```

**Line by line**

- `docker exec kafka …` runs the tool inside the running container, where the broker is `localhost:9092`.
- `--create --topic payments --partitions 2` asks the broker to create the topic; the replication factor defaults to the broker's `default.replication.factor`, 1 here.
- `--list` prints every topic name, one per line.

**Trace:** `Created topic payments.`, then `payments`.

**Common wrong approach:** leaving out `--partitions`. That works, but the topic gets the broker's `num.partitions` (1), and partitions are the unit of parallelism (lessons 26 and 27).

</details>

<details>
<summary>✅ 2. Send and read three orders</summary>

```bash
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders <<'EOF'
{"id":1,"customer":"ada","items":["bell"]}
{"id":2,"customer":"grace","items":["pump"]}
{"id":3,"customer":"linus","items":["lock","bell"]}
EOF
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --from-beginning --max-messages 3
```

**Line by line**

- `docker exec -i kafka …kafka-console-producer.sh … <<'EOF'` sends each line between the markers as an event. The quoted `'EOF'` stops the shell from changing anything inside.
- `kafka-console-consumer.sh … --from-beginning --max-messages 3` reads from offset 0 and stops after three events.

**Trace:** the producer prints nothing; the consumer prints the protocol notice, the three events and `Processed a total of 3 messages`.

**Common wrong approach:** forgetting `--from-beginning`. The consumer then starts at the end, after your three events, and waits for new ones.

</details>

## Quick quiz

1. How is a Kafka topic different from a classic message queue?
   - A) A topic deletes each event as soon as one consumer reads it
   - B) Topics can only have one consumer
   - C) Events stay in the topic for its retention period, however many consumers read them
   - D) Kafka only stores the latest event per topic

2. What does --bootstrap-server tell a Kafka tool or client?
   - A) Where to download Kafka from
   - B) Which partition to read
   - C) The topic to use
   - D) The address of a broker to connect to first; from there it learns about the whole cluster

3. Why does `docker exec kafka kafka-topics.sh --list` fail?
   - A) The container isn't running
   - B) The tools are in /opt/kafka/bin, which isn't on the container's PATH, so the full path is needed
   - C) --list isn't a real option
   - D) kafka-topics.sh needs to run as root

4. A consumer started without --from-beginning prints nothing, though the topic has events. Why?
   - A) The topic has too many partitions
   - B) The events were deleted when the producer finished
   - C) A new consumer starts at the end of the topic by default, so it only sees events that arrive later
   - D) It needs a consumer group

<details>
<summary>Quiz answers</summary>

1. **C) Events stay in the topic for its retention period, however many consumers read them**: That's why several services, and new ones later, can each read all the events.
2. **D) The address of a broker to connect to first; from there it learns about the whole cluster**: Clients start with any broker, then ask it for the cluster's metadata.
3. **B) The tools are in /opt/kafka/bin, which isn't on the container's PATH, so the full path is needed**: docker exec looks the program up on the PATH, and /opt/kafka/bin isn't on it.
4. **C) A new consumer starts at the end of the topic by default, so it only sees events that arrive later**: auto.offset.reset is latest by default; --from-beginning sets it to earliest.

</details>

---
Previous: [Lesson 24](24-publishing.md) · Next: [Lesson 26: Partitions, keys and ordering](26-kafka-partitions.md)
