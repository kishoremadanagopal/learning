@@@ part
id: 5
title: Kafka and Event Streaming
level: Intermediate
blurb: Letting services talk through events instead of calling each other: what Apache Kafka is, topics, partitions and offsets, keys and ordering, consumer groups, lag and offset resets, replication and safe producers, and finally the shop publishing order events that a billing worker processes. A pretend Kafka 4.3.1 runs in the sandbox's Docker, with Kafka's own command-line tools and the Node.js client.

@@@ lesson
id: kafka-basics
title: Events and Apache Kafka
minutes: 30
summary: Why services exchange events, what Apache Kafka is (an append-only log of events), events, topics, brokers, producers and consumers, how Kafka differs from a message queue, KRaft, running Kafka 4.3.1 in Docker, Kafka's command-line tools, creating, listing and describing topics, producing events with the console producer, reading them back with the console consumer, and why reading doesn't remove anything.
---
When a customer places an order, the shop has more to do than save it: billing writes an invoice, the warehouse packs the parcel, an email goes out, and the analytics team counts the sale. If the shop's API called each of those services in turn, one slow or broken service would slow down or break checkout, and every new service would mean changing the API again.

**Event streaming** turns this around. The API records one fact, *an order was placed*, as an **event**, and moves on. Each service that cares reads the events in its own time. The API doesn't know or wait for its readers, and adding a reader changes nothing for the others.

![Producers on the left (the shop's API, the website) append events to the topic orders, which has three partitions: each is a row of numbered records, offsets 0, 1, 2… with new events added at the right. On the right, two consumer groups read independently: in partition 0, billing will read offset 3 next, while analytics is further behind, at offset 1. Reading doesn't remove events; they stay until the retention period ends](figures/kafka-log.svg)

### Apache Kafka

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

### Running Kafka in Docker

```sh setup=docker-pulled
docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1
docker ps
docker logs kafka | grep "Kafka Server started"
```

With no settings, the image runs a single node that is both **broker** and **controller**, listening on port 9092 for clients (published to your computer by `-p`). A real broker takes 10 to 20 seconds to start: wait for `Kafka Server started` in its logs before using it.

### Kafka's tools

Kafka comes with command-line tools, shell scripts in `/opt/kafka/bin` inside the container. They're not on the `PATH`, so give the full path:

```sh error setup=kafka-running
docker exec kafka kafka-topics.sh --list
```

Every tool needs `--bootstrap-server`: the address of a broker to start from. Inside the container, the broker is `localhost:9092`.

### Topics

```sh setup=kafka-running
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic orders
```

`--describe` prints the topic's ID, its partition count, its **replication factor** (how many brokers keep a copy of each partition: 1 here, since there's one broker; lesson 28 uses three), and any settings that differ from Kafka's defaults (`segment.bytes`, the size of the files a partition is stored in, comes from the image's configuration). Then a line per partition: which broker leads it, which hold copies (`Replicas`), and which copies are up to date (`Isr`, the **in-sync replicas**). Node `1` is our only broker.

Topic names may contain letters, digits, `.`, `_` and `-`. Pick a style and stick to it: `orders`, `payments`, `order-events`.

### Producing events

`kafka-console-producer.sh` sends each line it reads from standard input as one event. `docker exec -i` passes your input into the container:

```sh setup=kafka-orders-empty
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders <<'EOF'
{"id":1,"customer":"ada","items":["bell"]}
{"id":2,"customer":"grace","items":["pump","lock"]}
EOF
```

It prints nothing when all goes well. Without `-i`, the tool's standard input is empty, so it sends nothing and still succeeds: a classic silent mistake. On your own computer you can also type the events: `docker exec -it kafka /opt/kafka/bin/kafka-console-producer.sh …` shows a `>` prompt for each line; press Ctrl+D when you're done.

### Consuming events

```sh setup=kafka-two-orders
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --from-beginning --max-messages 2
```

- `--from-beginning` starts at the oldest event. Without it, a consumer starts at the end and only sees events that arrive after it started.
- `--max-messages 2` stops after two events. Without it (or `--timeout-ms`), the consumer keeps waiting for new events until you press Ctrl+C.
- The tool prints the events on standard output, and on standard error a notice about the new rebalance protocol (lesson 27) and the count at the end.

Run it again and you get the same two events: reading didn't remove them.

```sh setup=kafka-two-orders
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --from-beginning --max-messages 2 2>/dev/null
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --timeout-ms 2000
```

The second consumer started at the end of the topic, found nothing new within 2 seconds, and exited. `--timeout-ms` ends with a `TimeoutException` logged as an `ERROR`: it looks alarming, but it's the normal way this option stops.

### Try it on your own computer

- You need Docker (Part 4). Then `docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1` gives you the same single-node Kafka. There's also `apache/kafka-native`, a GraalVM build that starts in under a second and uses less memory, made for testing, not production.
- Without Docker, download Kafka from [kafka.apache.org/downloads](https://kafka.apache.org/downloads) and follow the [quickstart](https://kafka.apache.org/quickstart): it needs Java 17 or newer, and you run `bin/kafka-storage.sh format` once before `bin/kafka-server-start.sh config/server.properties`.
- Graphical tools help you look inside: [Kafbat UI](https://github.com/kafbat/kafka-ui) (free, runs in Docker) and Confluent's VS Code extension both show topics, partitions, events and consumer groups.
- `docker stop kafka` stops it; `docker rm kafka` deletes it and its data, since the image keeps its data inside the container.

:::exercise A topic for payments
Kafka is running as the container `kafka`. Create a topic called `payments` with 2 partitions, then list the topics to check it's there.
```sh starter setup=kafka-running
docker ps
```
```js check
const k = kafka();
if (!k) throw new AssertionError("Kafka isn't running: is the kafka container up?");
const t = k.topic("payments");
if (!t) throw new AssertionError(`There's no topic called payments yet (topics: ${k.topics().join(", ") || "none"}). Use kafka-topics.sh --create --topic payments.`);
same(t.partitions.length, 2, "The number of partitions of payments");
if (!ran(/kafka-topics\.sh\b.*--list/)) throw new AssertionError("List the topics with kafka-topics.sh --list to check.");
```
```sh solution setup=kafka-running
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic payments --partitions 2
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
```
hint: The tools are in `/opt/kafka/bin` inside the container: `docker exec kafka /opt/kafka/bin/kafka-topics.sh …`.
hint: Every tool needs `--bootstrap-server localhost:9092`; creating a topic needs `--create --topic payments --partitions 2`.
hint: `docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic payments --partitions 2`, then the same with `--list` instead of the create options.
approach:
1. **Understand:** topics are created with `kafka-topics.sh`, run inside the Kafka container.
2. **Examples:** the lesson created `orders` with `--create --topic orders --partitions 3`.
3. **Brute force:** `docker exec kafka kafka-topics.sh …` fails: the tools aren't on the container's `PATH`.
4. **Pattern:** **docker exec CONTAINER /opt/kafka/bin/TOOL --bootstrap-server localhost:9092 ACTION**.
5. **Plan:** create, then list.
6. **Code and test:** `Created topic payments.`, then `--list` prints `payments`.
walkthrough:
**Line by line**

- `docker exec kafka …` runs the tool inside the running container, where the broker is `localhost:9092`.
- `--create --topic payments --partitions 2` asks the broker to create the topic; the replication factor defaults to the broker's `default.replication.factor`, 1 here.
- `--list` prints every topic name, one per line.

**Trace:** `Created topic payments.`, then `payments`.

**Common wrong approach:** leaving out `--partitions`. That works, but the topic gets the broker's `num.partitions` (1), and partitions are the unit of parallelism (lessons 26 and 27).
:::

:::exercise Send and read three orders
The topic `orders` exists but is empty. Send these three events with the console producer, then read all of them back with the console consumer, making it stop by itself.

```text
{"id":1,"customer":"ada","items":["bell"]}
{"id":2,"customer":"grace","items":["pump"]}
{"id":3,"customer":"linus","items":["lock","bell"]}
```
```sh starter setup=kafka-orders-empty
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic orders
```
```js check
const k = kafka();
const t = k && k.topic("orders");
if (!t) throw new AssertionError("The topic orders is missing.");
const values = t.records().map((r) => r.value);
for (const id of [1, 2, 3]) if (!values.some((v) => v && v.includes(`"id":${id}`))) throw new AssertionError(`The event with "id":${id} isn't in orders yet. Pipe the lines into kafka-console-producer.sh with docker exec -i.`);
same(values.length, 3, "The number of events in orders");
if (!ran(/kafka-console-consumer\.sh\b.*--from-beginning/)) throw new AssertionError("Read the events with kafka-console-consumer.sh --from-beginning.");
if (!ran(/kafka-console-consumer\.sh\b.*(--max-messages|--timeout-ms)/)) throw new AssertionError("Make the consumer stop by itself with --max-messages 3 (or --timeout-ms).");
if (!printed('{"id":3,"customer":"linus","items":["lock","bell"]}')) throw new AssertionError("The consumer should print the three events.");
```
```sh solution setup=kafka-orders-empty
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders <<'EOF'
{"id":1,"customer":"ada","items":["bell"]}
{"id":2,"customer":"grace","items":["pump"]}
{"id":3,"customer":"linus","items":["lock","bell"]}
EOF
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --from-beginning --max-messages 3
```
hint: The console producer reads lines from standard input; `docker exec -i` connects your input to it. A here-document (`<<'EOF'` … `EOF`) supplies the lines.
hint: The consumer needs `--from-beginning`, since the events were written before it started.
hint: `--max-messages 3` makes it stop after the three events.
approach:
1. **Understand:** one line in, one event out; reading starts at the end unless you ask for the beginning.
2. **Examples:** the lesson piped two orders in with a here-document and read them with `--from-beginning --max-messages 2`.
3. **Brute force:** without `-i` nothing reaches the producer, and nothing is sent, without any error.
4. **Pattern:** **producer: docker exec -i + stdin; consumer: --from-beginning + --max-messages**.
5. **Plan:** produce the three lines, consume three events.
6. **Code and test:** the consumer prints the three JSON lines and `Processed a total of 3 messages`.
walkthrough:
**Line by line**

- `docker exec -i kafka …kafka-console-producer.sh … <<'EOF'` sends each line between the markers as an event. The quoted `'EOF'` stops the shell from changing anything inside.
- `kafka-console-consumer.sh … --from-beginning --max-messages 3` reads from offset 0 and stops after three events.

**Trace:** the producer prints nothing; the consumer prints the protocol notice, the three events and `Processed a total of 3 messages`.

**Common wrong approach:** forgetting `--from-beginning`. The consumer then starts at the end, after your three events, and waits for new ones.
:::

:::quiz
? How is a Kafka topic different from a classic message queue?
+ Events stay in the topic for its retention period, however many consumers read them
- A topic deletes each event as soon as one consumer reads it
- Topics can only have one consumer
- Kafka only stores the latest event per topic
= That's why several services, and new ones later, can each read all the events.
? What does --bootstrap-server tell a Kafka tool or client?
+ The address of a broker to connect to first; from there it learns about the whole cluster
- Where to download Kafka from
- The topic to use
- Which partition to read
= Clients start with any broker, then ask it for the cluster's metadata.
? Why does `docker exec kafka kafka-topics.sh --list` fail?
+ The tools are in /opt/kafka/bin, which isn't on the container's PATH, so the full path is needed
- kafka-topics.sh needs to run as root
- The container isn't running
- --list isn't a real option
= docker exec looks the program up on the PATH, and /opt/kafka/bin isn't on it.
? A consumer started without --from-beginning prints nothing, though the topic has events. Why?
+ A new consumer starts at the end of the topic by default, so it only sees events that arrive later
- The events were deleted when the producer finished
- It needs a consumer group
- The topic has too many partitions
= auto.offset.reset is latest by default; --from-beginning sets it to earliest.
:::

@@@ lesson
id: kafka-partitions
title: Partitions, keys and ordering
minutes: 30
summary: Why topics have partitions, offsets per partition, keys and how the default partitioner picks a partition (murmur2 hash modulo the partition count), ordering guaranteed within a partition, events without a key and the sticky partitioner, printing partitions, offsets and keys with formatter properties, sending keys with reader properties, reading one partition from an offset, end offsets with kafka-get-offsets.sh, adding partitions and why it moves keys, choosing a partition count, retention (time and size) and changing it with kafka-configs.sh, compacted topics and tombstones.
---
A topic is split into **partitions**. Each partition is its own ordered log on a broker, with its own offsets starting at 0. Partitions are what let Kafka scale: different partitions can live on different brokers, and different consumers can read them at the same time (lesson 27).

The price is ordering. **Kafka keeps events in order within a partition, not across a topic.** Events in partition 0 and partition 2 have no order between them.

![Six events with keys ada, grace, ada, linus, grace, ada go through the partitioner, which computes murmur2(key) modulo 3: ada goes to partition 2, grace to partition 0 and linus to partition 2. Partition 0 holds grace's two events at offsets 0 and 1, partition 1 is empty, partition 2 holds ada's three events and linus's, in the order they were sent. Each partition is ordered; there's no order between partitions](figures/kafka-partitions.svg)

### Keys decide the partition

The event's **key** solves the ordering problem. A producer sends every event with the same key to the same partition, so **all events with one key stay in order**. Kafka's default partitioner computes a hash of the key (murmur2) and takes it modulo the number of partitions.

The setup sent six orders keyed by customer. Print where each landed with `--formatter-property`:

```sh setup=kafka-orders
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --from-beginning --max-messages 6 --formatter-property print.partition=true --formatter-property print.offset=true --formatter-property print.key=true 2>/dev/null
```

All of `ada`'s orders are in partition 2, in the order they were placed, and both of `grace`'s are in partition 0. `linus` shares partition 2 with `ada`: with only three partitions, many keys share each one. Partition 1 happens to get no key here; with more customers it would.

Choose the key as the thing whose events must stay in order: a customer, an order, a bank account, a device. Events without a common key can't be ordered relative to each other anyway.

### Sending keys from the console

The console producer splits each line into key and value when you set **reader properties** (`--property` in older guides, deprecated since Kafka 4.2):

```sh setup=kafka-orders
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --reader-property parse.key=true --reader-property key.separator=: <<'EOF'
ada:{"id":7,"customer":"ada","items":["bell"]}
EOF
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --partition 2 --offset 4 --max-messages 1 --formatter-property print.offset=true --formatter-property print.key=true 2>/dev/null
```

`--partition 2 --offset 4` reads one partition from a given offset (`earliest` and `latest` work too): the new event is at offset 4, right after `ada`'s order 6. A line without the separator makes the producer stop with `No key separator found on line number 1`.

### Events without a key

Events with no key can go to any partition. The Java producer uses a **sticky partitioner**: it fills one batch for one partition, then picks another. A quick burst of keyless events, like the console producer's, often lands in a single partition:

```sh setup=kafka-orders
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders <<'EOF'
{"note":"keyless 1"}
{"note":"keyless 2"}
EOF
docker exec kafka /opt/kafka/bin/kafka-get-offsets.sh --bootstrap-server localhost:9092 --topic orders
```

`kafka-get-offsets.sh` prints each partition's **end offset** (the offset the next event will get), as `topic:partition:offset`. Before, the partitions held 2, 0 and 4 events; both keyless events went to the same partition. Use keys whenever order matters; leave them out only when it doesn't.

### Adding partitions moves keys

You can add partitions to a topic (never remove them):

```sh setup=kafka-orders
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --alter --topic orders --partitions 4
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --reader-property parse.key=true --reader-property key.separator=: <<'EOF'
ada:{"id":7,"customer":"ada","items":["bell"]}
EOF
docker exec kafka /opt/kafka/bin/kafka-get-offsets.sh --bootstrap-server localhost:9092 --topic orders
```

With 4 partitions, `ada`'s hash modulo 4 is 1, not 2: her new order went to partition 1, while her old ones stay in partition 2. A consumer could now process order 7 before order 6. That's why you choose the partition count up front:

| | Guidance |
|---|---|
| more partitions | more consumers can read in parallel (at most one per partition in a group) |
| fewer partitions | less overhead per broker; each partition is files and memory |
| a starting point | enough for the throughput you expect in a year or two; small topics: 3 to 6; busy ones: dozens |
| changing later | possible for keyless topics; for keyed topics, create a new topic and move the data |

### How long events stay: retention

Kafka deletes old events by **retention**, not by reading. By default a topic keeps events for 7 days (`retention.ms` = 604800000), with no size limit (`retention.bytes` = -1). Change it for one topic with `kafka-configs.sh`:

```sh setup=kafka-orders
docker exec kafka /opt/kafka/bin/kafka-configs.sh --bootstrap-server localhost:9092 --entity-type topics --entity-name orders --alter --add-config retention.ms=1209600000
docker exec kafka /opt/kafka/bin/kafka-configs.sh --bootstrap-server localhost:9092 --entity-type topics --entity-name orders --describe
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic orders
```

`1209600000` milliseconds is 14 days. Retention works on whole **segments** (the files a partition is stored in), so events are deleted a little after they expire, a segment at a time, and offsets keep counting up: the oldest offset still kept becomes the partition's start. `--delete-config retention.ms` goes back to the default, and `--config retention.ms=…` sets it when creating a topic.

### Compacted topics

Some topics hold the **latest state** per key rather than a history: a customer's address, a product's price. With `cleanup.policy=compact`, Kafka keeps at least the newest event for each key and removes older ones in the background. An event with a key and an empty (null) value, a **tombstone**, means "delete this key".

```sh setup=kafka-running
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic customers --partitions 3 --config cleanup.policy=compact
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic customers
```

Compaction only runs on older segments (never the one being written), so on a quiet topic you won't see it happen soon. A service that reads a compacted topic from the beginning ends up with the current state of every key; that's how Kafka Streams and Kafka Connect store their own state.

### Try it on your own computer

- Partition placement is the same with every Java client and with `@confluentinc/kafka-javascript` (lesson 29), which both use murmur2. Some clients default to a different hash, such as librdkafka's own C and Python clients (CRC32 unless you set `partitioner=murmur2_random`), so the same key can land in different partitions depending on which program wrote it.
- `kafka-get-offsets.sh --time -2` prints the earliest offsets instead of the end.

:::exercise Keep each customer's orders together
`orders` (3 partitions) already has six events. Add three more orders for the customer `ada`, keyed by `ada` so they stay in order with her earlier ones:

```text
{"id":10,"customer":"ada","items":["bell"]}
{"id":11,"customer":"ada","items":["pump"]}
{"id":12,"customer":"ada","items":["lock"]}
```

Then print partition 2 from offset 3, showing the offsets and keys, to check they went where `ada`'s other orders are.
```sh starter setup=kafka-orders
docker exec kafka /opt/kafka/bin/kafka-get-offsets.sh --bootstrap-server localhost:9092 --topic orders
```
```js check
const t = kafka().topic("orders");
const recs = t.records();
for (const id of [10, 11, 12]) {
  const r = recs.find((x) => x.value && x.value.includes(`"id":${id}`));
  if (!r) throw new AssertionError(`Order ${id} isn't in orders yet.`);
  if (r.key !== "ada") throw new AssertionError(`Order ${id} has the key ${JSON.stringify(r.key)}: use parse.key=true with a separator, like ada:{...}.`);
  same(r.partition, 2, `The partition of order ${id}`);
}
const p2 = t.partitions[2].records.map((r) => r.value);
if (p2.findIndex((v) => v.includes('"id":10')) > p2.findIndex((v) => v.includes('"id":12'))) throw new AssertionError("Send the orders in order: 10, 11, 12.");
if (!ran(/kafka-console-consumer\.sh\b.*--partition 2/)) throw new AssertionError("Read partition 2 with --partition 2 --offset 3.");
if (!ran(/print\.key=true/) || !ran(/print\.offset=true/)) throw new AssertionError("Show the keys and offsets with --formatter-property print.key=true and print.offset=true.");
```
```sh solution setup=kafka-orders
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --reader-property parse.key=true --reader-property key.separator=: <<'EOF'
ada:{"id":10,"customer":"ada","items":["bell"]}
ada:{"id":11,"customer":"ada","items":["pump"]}
ada:{"id":12,"customer":"ada","items":["lock"]}
EOF
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --partition 2 --offset 3 --max-messages 4 --formatter-property print.offset=true --formatter-property print.key=true
```
hint: Turn on key parsing with `--reader-property parse.key=true --reader-property key.separator=:`, then write each line as `ada:{…}`.
hint: The default partitioner puts every event with the key `ada` in the same partition, partition 2 for this topic.
hint: To read one partition from an offset: `--partition 2 --offset 3`; add `--formatter-property print.offset=true --formatter-property print.key=true` and `--max-messages`.
approach:
1. **Understand:** the key decides the partition, and order is kept within a partition.
2. **Examples:** the lesson sent `ada:{"id":7,…}` with `parse.key=true` and found it in partition 2.
3. **Brute force:** sending the lines without keys spreads them by the sticky partitioner, away from `ada`'s other orders.
4. **Pattern:** **key = the thing whose events must stay in order**.
5. **Plan:** produce three keyed lines; consume partition 2 from offset 3 with offsets and keys shown.
6. **Code and test:** the consumer shows `Offset:3 ada …` (order 6), then orders 10, 11 and 12 at offsets 4, 5 and 6.
walkthrough:
**Line by line**

- `--reader-property parse.key=true --reader-property key.separator=:` makes the producer split each line at the first `:` into key and value.
- Each `ada:{…}` line becomes an event with the key `ada`; murmur2(`ada`) modulo 3 is 2, so all three go to partition 2, in the order sent.
- The consumer reads only partition 2 from offset 3 and prints `Offset:N`, the key and the value, separated by tabs.

**Trace:** offsets 0 to 3 hold orders 1 and 3 (`ada`), 4 (`linus`) and 6 (`ada`); offsets 4 to 6 hold orders 10 to 12.

**Common wrong approach:** keying by order id. Each order would land in its own partition, and a consumer could see `ada`'s orders out of order.
:::

:::exercise Keep payments for 30 days
The topic `orders` keeps events for the default 7 days. Make it keep them for 30 days, with `kafka-configs.sh`, then show the topic's dynamic configs to check. (A day is 86,400,000 milliseconds.)
```sh starter setup=kafka-orders
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic orders
```
```js check
const t = kafka().topic("orders");
if (t.configs["retention.ms"] === undefined) throw new AssertionError("orders has no retention.ms setting yet: add one with kafka-configs.sh --alter --add-config retention.ms=….");
same(t.configs["retention.ms"], "2592000000", "orders' retention.ms (30 days in milliseconds)");
if (!ran(/kafka-configs\.sh\b.*--describe/)) throw new AssertionError("Check it with kafka-configs.sh … --describe.");
```
```sh solution setup=kafka-orders
docker exec kafka /opt/kafka/bin/kafka-configs.sh --bootstrap-server localhost:9092 --entity-type topics --entity-name orders --alter --add-config retention.ms=2592000000
docker exec kafka /opt/kafka/bin/kafka-configs.sh --bootstrap-server localhost:9092 --entity-type topics --entity-name orders --describe
```
hint: 30 × 86,400,000 = 2,592,000,000 milliseconds.
hint: `kafka-configs.sh --entity-type topics --entity-name orders --alter --add-config retention.ms=…` changes one topic.
hint: The same command with `--describe` instead of `--alter --add-config …` shows the settings you changed.
approach:
1. **Understand:** retention is a per-topic setting (`retention.ms`), changed without restarting anything.
2. **Examples:** the lesson set 14 days, `retention.ms=1209600000`.
3. **Brute force:** recreating the topic with `--config retention.ms=…` would lose its events.
4. **Pattern:** **kafka-configs.sh --alter --add-config KEY=VALUE** for one topic's settings.
5. **Plan:** compute 30 days in ms, alter, describe.
6. **Code and test:** `Completed updating config for topic orders.`, then `retention.ms=2592000000 sensitive=false synonyms={DYNAMIC_TOPIC_CONFIG:retention.ms=2592000000}`.
walkthrough:
**Line by line**

- `--entity-type topics --entity-name orders` picks the topic; `--alter --add-config retention.ms=2592000000` sets the value on it (a **dynamic** config, stored in the cluster's metadata).
- `--describe` lists the topic's dynamic configs with where each value comes from: `DYNAMIC_TOPIC_CONFIG` means "set on this topic".

**Trace:** `kafka-topics.sh --describe` now also shows `retention.ms=2592000000` among the topic's `Configs`.

**Common wrong approach:** writing `retention.ms=30d`. Kafka's durations are plain numbers of milliseconds, and the broker rejects anything else.
:::

:::quiz
? What does Kafka guarantee about the order of events?
+ Events in the same partition are read in the order they were written; there's no order across partitions
- All events in a topic are read in the order they were written
- Events are sorted by timestamp
- There are no ordering guarantees at all
= Use a key to keep related events in one partition.
? Two events have the same key. Where do they go?
+ To the same partition (as long as the partition count doesn't change)
- To different partitions, to spread the load
- To the partition with the fewest events
- To partition 0
= The default partitioner hashes the key (murmur2) and takes it modulo the number of partitions.
? You add partitions to a topic whose events are keyed by customer. What's the risk?
+ Keys now hash to different partitions, so a customer's new events can be read before their older ones
- Kafka deletes the existing events
- Consumers stop working until restarted
- Nothing: keys keep their old partitions
= hash modulo 3 and hash modulo 4 usually differ; choose the partition count up front for keyed topics.
? When does Kafka delete events from a normal topic?
+ After the retention period (or size limit) passes, a whole segment at a time
- As soon as every consumer group has read them
- When the producer disconnects
- Never: Kafka keeps everything forever
= cleanup.policy=delete with retention.ms (7 days by default); compacted topics keep the latest event per key instead.
:::

@@@ lesson
id: consumer-groups
title: Consumer groups and offsets
minutes: 30
summary: Consumer groups and sharing partitions between their members, scaling up to one consumer per partition, several groups each reading everything, committed offsets and the __consumer_offsets topic, auto commit, kafka-consumer-groups.sh (list, describe, members, state), current offset, log-end offset and lag, background consumers with docker exec -d, rebalances, the classic and the new consumer rebalance protocol (KIP-848), resetting a group's offsets (to-earliest, shift-by, to-datetime, dry run and execute), at-least-once and at-most-once processing and idempotent consumers, and share groups (queues for Kafka).
---
One billing worker can only go so fast. To share the work, run several copies of it in the same **consumer group**: Kafka assigns each partition of the topic to exactly one member of the group, so the members split the partitions between them and each event is processed once by the group.

![The topic orders with three partitions. The consumer group billing has two members: member A reads partitions 0 and 1, member B reads partition 2. The group analytics has one member reading all three partitions. Each group keeps its own committed offsets; for billing, partition 2 is at offset 5 while the log ends at 7, a lag of 2](figures/kafka-groups.svg)

- A group with **more members than partitions** leaves some members idle: the partition count is the limit on parallelism.
- **Different groups are independent.** Each group gets every event: billing and analytics both read all orders, each at its own pace.
- When a member joins or leaves, the group **rebalances**: Kafka moves partitions between the members that are left.

### Committed offsets

A group remembers how far it has read: for each partition, its **committed offset**, the offset of the next event to process. Kafka stores them in an internal topic, `__consumer_offsets`. By default consumers **auto-commit** every 5 seconds, and again when they close.

The console consumer joins a group with `--group`:

```sh setup=kafka-orders
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group billing --from-beginning --timeout-ms 1000
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing
```

`--describe` shows, for each partition:

| Column | Meaning |
|---|---|
| CURRENT-OFFSET | the group's committed offset: where it will continue |
| LOG-END-OFFSET | the partition's end: the offset the next event will get |
| LAG | LOG-END-OFFSET − CURRENT-OFFSET: events written but not yet processed by this group |
| CONSUMER-ID, HOST, CLIENT-ID | the member reading the partition, or `-` when no member is |

With no members, it also says `Consumer group 'billing' has no active members.` (on standard error). `--from-beginning` only matters for a group with no committed offsets yet; after that, the group continues where it left off.

### Lag

**Lag** is the most important number for a consumer group: it says how far behind the group is. Lag that keeps growing means the consumers can't keep up (add members, up to one per partition, or make them faster); lag that stays at 0 means they're up to date.

```sh setup=kafka-billing-behind
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group billing --timeout-ms 1000
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing 2>/dev/null
```

Three orders arrived after `billing` stopped: a lag of 1 on partition 0 and 2 on partition 2 (`linus` and `ada` both hash to partition 2). The next run of the group read exactly those three, then the lag was back to 0.

A different group reads everything again, without affecting `billing`:

```sh setup=kafka-billing-behind
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group analytics --from-beginning --timeout-ms 1000 2>&1 | tail -1
```

### Members, live

Real consumers run all the time. `docker exec -d` starts a console consumer in the background, inside the container; start two in the group `billing`:

```sh setup=kafka-billing-behind
docker exec -d kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group billing
docker exec -d kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group billing
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing --members
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing --state
```

The two members split the three partitions (2 and 1, with the default range assignor), caught up at once, and committed: lag 0. Each member has an ID made of its client ID and a random UUID; HOST is the address it connects from, here `127.0.0.1`, since it runs in the broker's own container. `--state` shows the group as `Stable`, with 2 members.

To stop the background consumers, send them the stop signal, as Ctrl+C would. `pkill -f` matches their full command line, which contains the Java class `ConsoleConsumer`:

```sh setup=kafka-billing-running
docker exec kafka pkill -f ConsoleConsumer
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing --state
```

On closing, each consumer committed its offsets and left the group, which is now `Empty`.

### Rebalance protocols

Every console consumer prints a notice: *The consumer rebalance protocol (KIP-848) is production-ready!* Kafka has two ways of running a group:

| | `classic` (still the clients' default) | `consumer` (KIP-848, GA since Kafka 4.0) |
|---|---|---|
| who assigns partitions | one of the members, after all of them rejoin | the broker, incrementally |
| during a rebalance | members pause while partitions move | only the moved partitions pause |
| how to use it | default | the consumer setting `group.protocol=consumer` |

For a console consumer, add `--command-property group.protocol=consumer`. New applications should use the new protocol; existing groups can switch without downtime.

### Resetting offsets

To reprocess events (after fixing a bug) or skip a backlog, move a group's committed offsets with `--reset-offsets`. The group must have no running members, and without `--execute` the command only shows what it would do:

```sh setup=kafka-billing-behind
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --reset-offsets --group billing --topic orders --to-earliest --dry-run
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --reset-offsets --group billing --topic orders --to-earliest --execute
```

Other targets: `--to-latest` (skip everything not yet processed), `--shift-by -2` (back two events per partition), `--to-offset N`, `--to-datetime 2026-10-17T09:00:00.000` (the first event at or after that time) and `--by-duration PT1H` (an hour ago). `--topic orders:0,1` limits the reset to some partitions. Run against a group with members, it refuses: `Assignments can only be reset if the group 'billing' is inactive`.

### Processing exactly once?

Committing and processing are two steps, and a consumer can crash between them:

| Commit… | If the consumer crashes in between | Called |
|---|---|---|
| after processing (the usual) | the events are processed again after the restart | **at-least-once** |
| before processing | the events are never processed | **at-most-once** |

Auto commit is close to at-least-once: events processed since the last commit come again after a crash. So write consumers that can safely see an event twice, **idempotent consumers**: use an ID from the event (the order ID) and skip events already handled, or make the effect naturally repeatable ("set the status to paid" instead of "add 10 to the balance"). Kafka's transactions (lesson 28) give exactly-once within Kafka itself; across other systems, idempotence is the practical answer.

### Queues: share groups

A consumer group can't use more members than partitions, and one slow event holds up its whole partition. Kafka 4.2 made **share groups** production-ready ("queues for Kafka", KIP-932): members of a share group read the same partitions together, each event goes to one member, and members acknowledge events one by one, like a classic work queue. Use them for jobs that don't need ordering, such as sending emails; keep consumer groups when order per key matters. The tool `kafka-console-share-consumer.sh` and the client's share-consumer API work with them.

### Try it on your own computer

- On a real broker, give a new group a few seconds: the first rebalance waits `group.initial.rebalance.delay.ms` (3 seconds by default) for more members to arrive.
- Monitoring systems (Part 8) watch consumer lag as a metric; Kafbat UI shows it per group.

:::exercise Catch up the shipping service
The shipping service will read `orders` as the consumer group `shipping`, which hasn't read anything yet. Process all existing orders with a console consumer in the group `shipping` that stops by itself, then show the group's offsets to confirm its lag is 0.
```sh starter setup=kafka-orders
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list
```
```js check
const k = kafka();
const g = k.group("shipping");
if (!g) throw new AssertionError("There's no consumer group shipping yet: run kafka-console-consumer.sh with --group shipping.");
const lag = g.lag("orders");
if (lag === null) throw new AssertionError("The group shipping hasn't read orders.");
if (lag !== 0) throw new AssertionError(`The group shipping still has a lag of ${lag}. New groups start at the end unless you use --from-beginning; to read what's already there, reset it to the earliest offsets or use a new group.`);
const t = k.topic("orders");
for (const p of t.partitions) if (g.offsets[`orders:${p.index}`] === undefined) throw new AssertionError(`shipping has no committed offset for partition ${p.index}.`);
if (!ran(/kafka-console-consumer\.sh\b.*--from-beginning/)) throw new AssertionError("Start the new group from the beginning with --from-beginning, so it processes the existing orders.");
if (!ran(/kafka-consumer-groups\.sh\b.*--describe\b.*--group shipping|kafka-consumer-groups\.sh\b.*--group shipping\b.*--describe/)) throw new AssertionError("Show the group's offsets with kafka-consumer-groups.sh --describe --group shipping.");
```
```sh solution setup=kafka-orders
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group shipping --from-beginning --timeout-ms 1000
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group shipping
```
hint: `--group shipping` makes the console consumer a member of that group and commits its offsets when it closes.
hint: A new group starts at the end of the topic unless you add `--from-beginning`; `--timeout-ms 1000` makes it stop when there's nothing more to read.
hint: Then `kafka-consumer-groups.sh --describe --group shipping` shows CURRENT-OFFSET equal to LOG-END-OFFSET on every partition.
approach:
1. **Understand:** a group's progress is its committed offsets; lag is what's left to process.
2. **Examples:** the lesson's `billing` group read from the beginning and showed LAG 0.
3. **Brute force:** reading without `--group` processes the events but leaves no committed offsets anywhere.
4. **Pattern:** **--group G --from-beginning** for a new group; **--describe --group G** to check.
5. **Plan:** consume with the group until a timeout; describe it.
6. **Code and test:** six orders printed; every partition's LAG is 0.
walkthrough:
**Line by line**

- `--group shipping --from-beginning`: the group has no committed offsets, so it starts at the earliest offset of each partition.
- `--timeout-ms 1000` ends the consumer once no event has arrived for a second; on closing it commits its position.
- `--describe --group shipping` compares the committed offsets with the partitions' ends.

**Trace:** CURRENT-OFFSET and LOG-END-OFFSET are 2, 0 and 4 on partitions 0, 1 and 2, and LAG is 0 everywhere; the group has no active members.

**Common wrong approach:** leaving out `--from-beginning` for a new group. It starts at the end, reads nothing, and commits the end offsets: the existing orders are skipped for good, unless you reset the group.
:::

:::exercise Reprocess billing
A bug in the billing service produced wrong invoices. It's fixed, and the group `billing` must process every order again. Two `billing` consumers are still running in the background in the `kafka` container. Stop them, then reset the group's offsets for `orders` to the earliest, for real.
```sh starter setup=kafka-billing-running
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing
```
```js check
const k = kafka();
const g = k.group("billing");
if (g.members.length) throw new AssertionError(`billing still has ${g.members.length} running member(s): stop them first (docker exec kafka pkill -f ConsoleConsumer).`);
const t = k.topic("orders");
for (const p of t.partitions) {
  const off = g.offsets[`orders:${p.index}`];
  if (off !== 0) throw new AssertionError(`billing's committed offset for partition ${p.index} is ${off}, not 0. Reset with --to-earliest and --execute (without --execute it's only a dry run).`);
}
```
```sh solution setup=kafka-billing-running
docker exec kafka pkill -f ConsoleConsumer
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --reset-offsets --group billing --topic orders --to-earliest --execute
```
hint: Offsets can only be reset while the group has no members: stop the background consumers with `docker exec kafka pkill -f ConsoleConsumer`.
hint: `kafka-consumer-groups.sh --reset-offsets --group billing --topic orders --to-earliest` shows the plan.
hint: Add `--execute` to apply it; `--describe --group billing` should then show CURRENT-OFFSET 0 everywhere.
approach:
1. **Understand:** resetting rewrites the group's committed offsets, which running members would immediately overwrite, so Kafka requires an empty group.
2. **Examples:** the lesson's reset printed `Assignments can only be reset if the group 'billing' is inactive` while members ran.
3. **Brute force:** deleting and recreating the topic would destroy the events themselves.
4. **Pattern:** **stop the consumers → reset (dry run) → reset --execute → start the consumers**.
5. **Plan:** pkill, then reset with `--to-earliest --execute`.
6. **Code and test:** NEW-OFFSET 0 for every partition; `--describe` shows the full lag.
walkthrough:
**Line by line**

- `docker exec kafka pkill -f ConsoleConsumer` sends SIGTERM to every process whose command line contains `ConsoleConsumer`; each consumer commits and leaves the group, which becomes `Empty`.
- `--reset-offsets --group billing --topic orders --to-earliest --execute` sets the committed offset of each partition to its earliest offset (0 here).

**Trace:** the reset prints a NEW-OFFSET of 0 for partitions 0, 1 and 2; the next `billing` consumer starts again from the first order.

**Common wrong approach:** resetting without `--execute`. It prints the same table, with a warning, but changes nothing.
:::

:::quiz
? A topic has 4 partitions. You run 6 consumers in the same group. What happens?
+ 4 consumers get one partition each; 2 sit idle
- Each consumer gets every event
- Kafka splits the partitions into 6 pieces
- The group refuses the extra members with an error
= A partition goes to one member of a group, so the partition count limits a group's parallelism.
? Billing and analytics read the same topic in different consumer groups. Billing falls behind. What happens to analytics?
+ Nothing: each group has its own committed offsets and reads at its own pace
- It slows down to match billing
- It can't read events billing hasn't read yet
- It takes over billing's partitions
= Groups are independent; every group receives every event.
? What does LAG mean in kafka-consumer-groups.sh --describe?
+ How many events the group still has to process in that partition: LOG-END-OFFSET − CURRENT-OFFSET
- How many seconds behind the group is
- The number of failed events
- How long the last rebalance took
= Growing lag means consumers can't keep up.
? A consumer crashes after processing an event but before committing it. What happens after it restarts?
+ It processes the event again (at-least-once), so consumers should be idempotent
- The event is lost
- Kafka detects the crash and skips the event
- The group is deleted
= It resumes from the last committed offset, which is before the event.
:::

@@@ lesson
id: kafka-reliability
title: Replication and reliable producers
minutes: 30
summary: Why one broker isn't enough, replication factor, leaders and followers, in-sync replicas (ISR), a cluster in isolated KRaft mode (a controller and three brokers) with Docker Compose, YAML merge keys, topics with replication factor 3, leader election when a broker stops, under-replicated partitions, acks (0, 1, all) and min.insync.replicas, NotEnoughReplicasException, the producer's retries and idempotence, eligible leader replicas, transactions and exactly-once, and recommended settings for durable topics.
---
With one broker, a broken disk or a restart loses access to every event. Real clusters keep several copies of each partition on different brokers: **replication**.

![Three brokers. Partition 0's leader is on broker 3, with followers on brokers 1 and 2; partition 1's leader is on broker 1; partition 2's on broker 2. Producers write to the leader and followers copy from it; the copies that are up to date form the in-sync replicas (ISR). When broker 3 stops, broker 1 becomes partition 0's leader and the ISR shrinks to 1 and 2. A controller (node 4) manages the cluster](figures/kafka-replication.svg)

| Word | Meaning |
|---|---|
| **replication factor** | how many brokers keep a copy of each partition (3 in production) |
| **leader** | the copy that producers and consumers use |
| **follower** | a copy that keeps up by fetching from the leader |
| **in-sync replicas (ISR)** | the copies that are fully caught up, including the leader; only these can become leader |
| **controller** | the node that runs the cluster: it creates topics and picks a new leader when one fails |

### A cluster with Compose

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

```sh setup=kafka-cluster
docker compose ps
docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --create --topic payments --partitions 3 --replication-factor 3 --config min.insync.replicas=2
docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --describe --topic payments
```

Each partition has three replicas and a different leader, so the work is spread over the brokers. All three replicas are in sync.

### When a broker stops

```sh setup=kafka-cluster-payments
docker compose stop kafka-3
docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --describe --topic payments
docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --describe --under-replicated-partitions
```

The controller noticed: broker 3 left every ISR, and partition 0, which it led, got a new leader from its ISR, broker 1. Producers and consumers follow the new leader automatically. `--under-replicated-partitions` lists partitions with fewer in-sync copies than replicas: in production, an alert should fire when this list isn't empty.

```sh setup=kafka-cluster-payments
docker compose stop kafka-3
docker compose start kafka-3
docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --describe --topic payments
```

The restarted broker caught up and rejoined the ISR. Partition 0 keeps its new leader for now; Kafka moves leadership back to the **preferred** leader (the first replica listed) every few minutes (`auto.leader.rebalance.enable`).

### acks and min.insync.replicas

How sure is a producer that an event is safe? Its **acks** setting decides when the leader answers:

| acks | The leader answers when… | Can lose events? |
|---|---|---|
| `0` | never: the producer doesn't wait | yes, any failure |
| `1` | it has written the event itself | yes, if it fails before followers copy it |
| `all` (`-1`, the default since Kafka 3.0) | every in-sync replica has the event | no, as long as an in-sync copy survives |

With `acks=all`, a shrinking ISR is a risk: if only the leader is left in sync, "all" means one copy. The topic setting **min.insync.replicas** sets a floor: with fewer in-sync replicas, the leader refuses `acks=all` writes instead of accepting an unsafe one.

```sh setup=kafka-cluster-payments
docker compose stop kafka-2 kafka-3
echo '{"id":1,"amount":3800}' | docker compose exec -T kafka-1 /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server kafka-1:19092 --topic payments
echo '{"id":1,"amount":3800}' | docker compose exec -T kafka-1 /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server kafka-1:19092 --topic payments --command-property acks=1
docker compose exec kafka-1 /opt/kafka/bin/kafka-get-offsets.sh --bootstrap-server kafka-1:19092 --topic payments
```

With two brokers down, each partition has one in-sync replica, fewer than the 2 required. The producer retried 3 times (the console producer's limit), then gave up with `NotEnoughReplicasException`. The same event with `acks=1` was accepted, with only one copy: a broker failure now could lose it. (`-T` turns off the terminal for `docker compose exec`, which pipes need.)

**The durable recipe**: replication factor 3, `min.insync.replicas=2`, producers with `acks=all`. One broker can fail (or be upgraded) without stopping writes or risking data; two failing at once stops writes rather than losing events.

### Producer retries and idempotence

Producers retry failed sends automatically, which raises a question: what if the first attempt succeeded and only the reply was lost? The retry would write the event twice. Since Kafka 3.0, producers are **idempotent** by default (`enable.idempotence=true`): each producer has an ID and numbers its events, so the broker drops duplicates and keeps the order within a partition, even across retries.

| Producer setting | Default (Java client) | What it controls |
|---|---|---|
| `acks` | `all` | how many replicas must have the event |
| `enable.idempotence` | `true` | no duplicates or reordering from retries |
| `retries` | unlimited (2147483647) | retries until `delivery.timeout.ms` |
| `delivery.timeout.ms` | 120000 (2 minutes) | how long a send may take, retries included |
| `linger.ms` | 5 | how long to wait to fill a batch |

### Exactly once

Idempotence prevents duplicates from one producer's retries. **Transactions** go further: a producer can write to several partitions and commit consumer offsets **atomically**, so either all of it happens or none; consumers set `isolation.level=read_committed` to skip aborted writes. That's how Kafka Streams offers exactly-once processing from Kafka to Kafka (`processing.guarantee=exactly_once_v2`). Anything outside Kafka (a database, an email) still needs idempotent handling (lesson 27).

### Eligible leader replicas

The partition lines end with `Elr` and `LastKnownElr`. Kafka 4.1 turned on **eligible leader replicas** (KIP-966) for new clusters: when the ISR shrinks below `min.insync.replicas`, the replicas that just left are remembered as still safe to lead, because they have every write the producers were told was committed. After a bad outage, Kafka can then choose a leader without losing acknowledged events. The lists are usually empty.

### Try it on your own computer

- The same Compose file runs on Docker Desktop; give the brokers 10 to 20 seconds to start. The official repository's [Docker examples](https://github.com/apache/kafka/tree/trunk/docker/examples) include clusters in combined and isolated mode, with SSL and SASL.
- `kafka-metadata-quorum.sh --bootstrap-server … describe --status` shows the controller quorum: its leader, its voters and how far behind each is.
- In production, run three (or five) controllers, spread brokers across availability zones, and use `broker.rack` so replicas of each partition go to different zones.

:::exercise A durable topic for invoices
The cluster (a controller and three brokers) is running in `~/cluster`. Create the topic `invoices` with 6 partitions that survives a broker failure without losing acknowledged events: replication factor 3 and `min.insync.replicas` of 2. Then describe it.
```sh starter setup=kafka-cluster
docker compose ps
```
```js check
const k = kafka("cluster-kafka-1-1");
if (!k) throw new AssertionError("The cluster isn't running: docker compose up -d in ~/cluster.");
const t = k.topic("invoices");
if (!t) throw new AssertionError("There's no topic invoices yet.");
same(t.partitions.length, 6, "The number of partitions of invoices");
same(t.partitions[0].replicas.length, 3, "The replication factor of invoices");
if (t.configs["min.insync.replicas"] !== "2") throw new AssertionError(`invoices' min.insync.replicas is ${t.configs["min.insync.replicas"] ?? "the default, 1"}; set it with --config min.insync.replicas=2.`);
if (!ran(/kafka-topics\.sh\b.*--describe/)) throw new AssertionError("Describe the topic to check its replicas.");
```
```sh solution setup=kafka-cluster
docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --create --topic invoices --partitions 6 --replication-factor 3 --config min.insync.replicas=2
docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --describe --topic invoices
```
hint: Run the tool in one of the brokers with `docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 …`.
hint: `--replication-factor 3` gives each partition three copies; `--config min.insync.replicas=2` sets the topic's floor.
hint: `--create --topic invoices --partitions 6 --replication-factor 3 --config min.insync.replicas=2`, then `--describe --topic invoices`.
approach:
1. **Understand:** durability comes from replicas on different brokers plus a minimum number in sync for `acks=all`.
2. **Examples:** the lesson created `payments` with the same settings and 3 partitions.
3. **Brute force:** replication factor 1 is fast, but a broker failure makes its partitions unavailable, or lost with its disk.
4. **Pattern:** **RF 3 + min.insync.replicas=2 + acks=all**.
5. **Plan:** create with all three options; describe.
6. **Code and test:** six partition lines, each with three replicas and three in sync, and `Configs: min.insync.replicas=2`.
walkthrough:
**Line by line**

- `docker compose exec kafka-1 …` runs the tool in the broker kafka-1; `--bootstrap-server kafka-1:19092` uses the cluster's internal listener.
- `--replication-factor 3` puts each partition's copies on all three brokers, with leaders spread among them.
- `--config min.insync.replicas=2` makes `acks=all` writes fail rather than land on a single copy.

**Trace:** `Created topic invoices.`, then the topic line with `ReplicationFactor: 3	Configs: min.insync.replicas=2` and six partition lines.

**Common wrong approach:** `min.insync.replicas=3`. With all three replicas required, any single broker restart stops writes: that's less availability, not more safety.
:::

:::exercise Back to full health
In the cluster, broker `kafka-3` stopped, and `payments` now has under-replicated partitions. Find them, bring the cluster back to full health, and check that no partition is under-replicated any more.
```sh starter setup=kafka-cluster-payments
docker compose stop kafka-3 > /dev/null 2>&1
docker compose ps
```
```js check
const k = kafka("cluster-kafka-1-1");
for (const b of k.brokers()) if (!b.running) throw new AssertionError(`Broker ${b.id} (${b.container}) isn't running: start it with docker compose start.`);
const t = k.topic("payments");
for (const p of t.partitions) if (p.isr.length !== p.replicas.length) throw new AssertionError(`Partition ${p.index} still has ${p.isr.length} of ${p.replicas.length} replicas in sync.`);
if (!ran(/--under-replicated-partitions/)) throw new AssertionError("Use kafka-topics.sh --describe --under-replicated-partitions to find them, and again to check.");
```
```sh solution setup=kafka-cluster-payments
docker compose stop kafka-3 > /dev/null 2>&1
docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --describe --under-replicated-partitions
docker compose start kafka-3
docker compose exec kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --describe --under-replicated-partitions
```
hint: `kafka-topics.sh --describe --under-replicated-partitions` lists partitions whose ISR is smaller than their replica list.
hint: `docker compose ps` shows which broker is down; `docker compose start kafka-3` starts it again.
hint: Run the same describe again: an empty result means every partition is fully replicated.
approach:
1. **Understand:** under-replicated means some replica isn't in sync, usually because its broker is down or slow.
2. **Examples:** the lesson stopped kafka-3 and saw broker 3 leave every ISR.
3. **Brute force:** recreating the topic would lose its events.
4. **Pattern:** **find (under-replicated list) → fix the broker → confirm the list is empty**.
5. **Plan:** describe, start kafka-3, describe again.
6. **Code and test:** the first describe lists three partitions; the second prints nothing.
walkthrough:
**Line by line**

- `--describe --under-replicated-partitions` prints only partitions with `Isr` shorter than `Replicas`: here all three, each missing broker 3.
- `docker compose start kafka-3` restarts the stopped container; the broker catches up from the leaders and the controller adds it back to each ISR.
- The second describe prints nothing: every partition is fully in sync again.

**Trace:** before, `Isr: 1,2` (or `2,1`) on each partition; after, an empty list.

**Common wrong approach:** `docker compose up -d` after editing nothing. It also starts the stopped container, but `start` says exactly what you mean and can't recreate a container whose configuration changed.
:::

:::quiz
? A topic has replication factor 3 and min.insync.replicas=2, and producers use acks=all. One broker fails. What happens?
+ Writes continue, since two replicas are still in sync, and no acknowledged event is lost
- Writes stop until the broker returns
- Events on the failed broker are lost
- Producers switch to acks=1
= This is why RF 3 with min.insync.replicas=2 is the usual production setting.
? What does acks=1 trade away?
+ Durability: the event is acknowledged once the leader has it, so it can be lost if the leader fails before followers copy it
- Ordering within a partition
- The ability to use keys
- Nothing; it's the safest setting
= acks=all (the default) waits for every in-sync replica.
? What does an idempotent producer prevent?
+ Duplicate (and reordered) events caused by its own retries
- Two different producers writing the same value
- Consumers reading an event twice
- Events being deleted by retention
= The broker uses the producer's ID and sequence numbers to drop retried duplicates; it's on by default since Kafka 3.0.
? A partition's leader broker stops. Which broker becomes the new leader?
+ Another replica from the partition's in-sync replicas, chosen by the controller
- Any broker in the cluster, even one without a copy
- None: the partition stays offline until the broker returns
- The producer chooses one
= Only in-sync replicas have every committed event; unclean.leader.election.enable (off by default) would allow others, with data loss.
:::

@@@ lesson
id: kafka-apps
title: Kafka in your services
minutes: 35
summary: Choosing a Node.js client in 2026 (@confluentinc/kafka-javascript, KafkaJS, @platformatic/kafka), installing it with npm, producing from Node.js with the KafkaJS-compatible API, delivery reports, publishing order events from the shop's API, a billing worker with a consumer group, graceful shutdown on SIGTERM, Kafka with the shop in Docker Compose, listeners and advertised listeners (internal and external addresses), the "connects but can't send" mistake, scaling a worker, designing events (names, keys, versions, IDs), schemas and Schema Registry, the dual-write problem and the outbox pattern, Kafka Connect, Kafka Streams and Flink, and managed Kafka in the cloud.
---
The shop's API will publish an `order-placed` event for every order, and a separate billing worker will turn each event into an invoice. Neither knows about the other: they only share the topic.

### A Node.js client

Three clients are worth knowing in 2026:

| Package | What it is |
|---|---|
| `@confluentinc/kafka-javascript` (the course uses it) | Confluent's official client, built on the C library librdkafka; offers a **KafkaJS-compatible API** |
| `kafkajs` | the most popular pure-JavaScript client for years, unmaintained since 2023; many tutorials still use it, and its API carries on in Confluent's client |
| `@platformatic/kafka` | a newer pure-JavaScript client, with no native code |

Install the client in the shop:

```sh setup=docker-shop-built
npm install @confluentinc/kafka-javascript
git diff --stat
grep -A2 '"dependencies"' package.json
```

`npm install` added the package and the 25 it depends on, recorded the version range in `package.json` (`^1.11.0`: any 1.x from 1.11.0) and the exact versions in `package-lock.json`. The package includes a compiled part (librdkafka); npm downloads the right build for your system, including Alpine Linux in the shop's image.

### Producing from Node.js

```sh setup=kafka-orders-node
cat send.js
node send.js
```

- The package is CommonJS, so import its default export and take `KafkaJS` from it; `KafkaJS.Kafka` is the KafkaJS-style entry point.
- `kafkaJS: { brokers, clientId }` holds the KafkaJS-style settings. `brokers` are bootstrap servers: here the published port of the course's Kafka container.
- `send()` returns a **delivery report** per partition written: the partition and the offset of the first event. The client logs `Producer connected` and `Producer disconnected` as objects through its logger.
- Messages with a key go to murmur2(key) modulo the partition count, like the Java client, so `ada`'s orders join her others in partition 2. Keyless messages go to a random partition.

### The shop publishes order events

The setup for the rest of the lesson has the shop's code ready:

```sh setup=kafka-shop
cat events.js
```

`publishOrder()` connects once (the first call starts connecting; later calls wait for the same promise) and sends one event, keyed by customer, with a `type` so that readers know what happened. `server.js` calls it after saving each order:

```js-static
      try {
        await publishOrder(placed);
      } catch (err) {
        console.error(`Couldn't publish the order event: ${err.message}`);
      }
```

The billing worker is a consumer in the group `billing`:

```sh setup=kafka-shop
cat billing.js
```

`run()` calls `eachMessage` for every event, in order within each partition, and commits offsets automatically. A running consumer keeps the Node.js process alive, like a server. On `docker stop`, the `SIGTERM` handler disconnects cleanly: the consumer commits and leaves the group at once, instead of the group waiting for its session to time out (45 seconds) before giving its partitions to others.

### Kafka in the Compose project

```sh setup=kafka-shop
cat compose.yaml
```

The API and the worker are built from the same image (the worker overrides `command`), and both wait for Kafka's health check. Start Kafka, create the topic, then everything else:

```sh setup=kafka-shop
docker compose up -d kafka 2>&1 | tail -1
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3
docker compose up -d 2>&1 | tail -2
docker compose ps
```

Creating topics explicitly matters: with the broker's default `auto.create.topics.enable=true`, the first producer to mention a topic creates it with the broker's defaults (1 partition), and a typo silently creates a new topic. Production clusters usually turn it off (`KAFKA_AUTO_CREATE_TOPICS_ENABLE: "false"`).

```sh setup=kafka-shop-up
curl -s -X POST localhost:8080/orders -d '{"customer":"ada","items":["bell","pump"]}'
curl -s -X POST localhost:8080/orders -d '{"customer":"grace","items":["lock"]}'
docker compose logs billing | grep Invoice
```

The API answered as before, and the worker invoiced both orders, independently and in its own container.

### Listeners and advertised listeners

Connecting to Kafka happens in two steps. The client contacts a **bootstrap server**, which answers with the cluster's **metadata**: every broker and the address to reach it at, its **advertised listener**. The client then connects to those advertised addresses. So each broker needs an address that works *from wherever the client runs*.

![Kafka in a Compose network with two listeners. Containers such as api and billing connect to kafka:19092 on the INTERNAL listener, which advertises kafka:19092. Your computer connects to localhost:9092 through the published port, on the EXTERNAL listener, which advertises localhost:9092. Below, the mistake: a container bootstraps from kafka:9092 on a listener that advertises localhost:9092; inside the container, localhost is the container itself, so the second connection is refused](figures/kafka-listeners.svg)

| Listener | Listens on | Advertises | For |
|---|---|---|---|
| `INTERNAL` | `:19092` | `kafka:19092` | other containers in the network (and the brokers themselves) |
| `EXTERNAL` | `:9092` (published) | `localhost:9092` | programs on your computer |
| `CONTROLLER` | `:9093` | — | KRaft's controller traffic |

Advertising `localhost` to other containers is the classic mistake: inside a container, `localhost` is the container itself.

```sh setup=kafka-shop-wrong-listener
grep -n "KAFKA_BROKERS\|ADVERTISED" compose.yaml
curl -s -X POST localhost:8080/orders -d '{"customer":"ada","items":["bell"]}'
docker compose logs api
```

The API reached Kafka through `kafka:9092` (`Producer connected`: the bootstrap worked), learned that the broker is at `localhost:9092`, and failed to connect there. The order was saved, but its event never reached Kafka. On a real system the request would also have hung: librdkafka keeps retrying a message for `message.timeout.ms`, 5 minutes by default, before giving up. The billing worker has the same problem and never joins its group.

### Scaling the worker

Run more copies of the worker and the group spreads the partitions over them:

```sh setup=kafka-shop-up
docker compose up -d --scale billing=2 2>&1 | tail -1
docker compose exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server kafka:19092 --describe --group billing --members
```

The second worker joined the group, which rebalanced: one member now reads one partition, the other two. Each order is invoiced once, by whichever worker owns its partition. A later `docker compose up -d` without `--scale` goes back to one worker, and the group rebalances again.

### Designing events

| Guideline | Example |
|---|---|
| name events as facts, in the past tense | `order-placed`, `payment-failed`, not `create-invoice` |
| key by the thing whose order matters | the customer or order ID |
| include an ID, a timestamp and a version | `{"id":"…","type":"order-placed","version":1,…}` |
| carry the data readers need | the totals, not just an ID that every reader must look up |
| evolve compatibly | add optional fields; never change a field's meaning; use a new version or topic for breaking changes |

Teams that share topics usually agree on **schemas**: Avro, Protobuf or JSON Schema, stored in a **schema registry** (Confluent Schema Registry, or Apicurio). Producers register the schema; the registry rejects incompatible changes; consumers know exactly what they'll get. Confluent's client has a companion package, `@confluentinc/schemaregistry`.

### The dual-write problem

The shop writes the order to its file, then publishes the event: two writes to two systems. If the process crashes between them, or Kafka is down (as with the wrong listener), the order exists but the event doesn't, and billing never hears of it. The usual fix is the **outbox pattern**: save the event in the same database transaction as the order (an `outbox` table), and let a separate process, or **change data capture** with Debezium, publish the outbox to Kafka. Then the event is published if and only if the order was saved.

### The wider ecosystem

| Tool | What it does |
|---|---|
| **Kafka Connect** | moves data between Kafka and other systems with ready-made connectors (databases, S3, Elasticsearch…) |
| **Debezium** | change data capture: turns database changes into events, via Kafka Connect |
| **Kafka Streams** | a Java library for processing streams (filter, join, aggregate) with exactly-once |
| **Apache Flink** | a stream-processing engine for large stateful jobs, with SQL |
| **MirrorMaker 2** | copies topics between clusters |

### Kafka in the cloud

Running Kafka yourself means upgrades, disks, monitoring and rebalancing. Managed services do it for you: **Confluent Cloud**, **Amazon MSK** (including Express brokers), **Google Cloud Managed Service for Apache Kafka**, **Aiven**, and Azure Event Hubs, which speaks Kafka's protocol. Kafka-compatible alternatives such as **Redpanda** (one binary, no JVM) and **WarpStream** (stores data in object storage) work with the same clients. Part 7 covers choosing managed services.

### Try it on your own computer

- `npm install @confluentinc/kafka-javascript` needs Node.js 18 or newer; check the package's README for the Node.js versions its prebuilt binaries support before upgrading Node.js.
- Python's equivalent is `confluent-kafka` (`pip install confluent-kafka`), built on the same librdkafka; Java and Kotlin use Kafka's own client, `org.apache.kafka:kafka-clients:4.3.1`.
- On Docker Desktop, `localhost:9092` reaches the EXTERNAL listener, so `node send.js` on your computer works against the Compose project.

:::exercise Publish the order event
The shop's `events.js` connects a producer but doesn't send anything yet. Complete `publishOrder(order)` so it sends one event to the topic `orders`, keyed by `order.customer`, whose value is the JSON of `{ type: "order-placed", ...order }`. Then rebuild and restart the API (`docker compose up -d --build api`) and place an order for `grace` with the items `["pump"]`.
```sh starter setup=kafka-shop-todo
cat events.js
```
```js check
const ev = read("events.js");
if (!/producer\.send\(/.test(ev)) throw new AssertionError("publishOrder should call producer.send(...).");
const t = kafka().topic("orders");
if (!t) throw new AssertionError("The topic orders is missing.");
const recs = t.records();
const r = recs.find((x) => x.value && x.value.includes('"customer":"grace"'));
if (!r) throw new AssertionError("No order event for grace in orders yet: rebuild the API (docker compose up -d --build api), then POST an order to localhost:8080/orders.");
if (r.key !== "grace") throw new AssertionError(`The event's key is ${JSON.stringify(r.key)}; key it by the customer.`);
let v;
try { v = JSON.parse(r.value); } catch { throw new AssertionError(`The event's value isn't JSON: ${r.value}`); }
same(v.type, "order-placed", "The event's type");
same(JSON.stringify(v.items), '["pump"]', "The event's items");
same(v.total, 3000, "The event's total");
```
```sh solution setup=kafka-shop-todo
cat > events.js <<'EOF'
import kafkajs from "@confluentinc/kafka-javascript";

const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({
  kafkaJS: { brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","), clientId: "shop" },
});
const producer = kafka.producer();
let connecting = null;

// Publish an order-placed event, keyed by customer so each customer's events stay in order.
export async function publishOrder(order) {
  connecting ??= producer.connect();
  await connecting;
  await producer.send({
    topic: "orders",
    messages: [{ key: order.customer, value: JSON.stringify({ type: "order-placed", ...order }) }],
  });
}
EOF
docker compose up -d --build api > /dev/null 2>&1
curl -s -X POST localhost:8080/orders -d '{"customer":"grace","items":["pump"]}'
```
hint: `await producer.send({ topic: "orders", messages: [{ key: …, value: … }] })` sends a list of messages to one topic.
hint: The key is `order.customer`; the value must be a string: `JSON.stringify({ type: "order-placed", ...order })`.
hint: The container runs the image, so rebuild it after changing code: `docker compose up -d --build api`, then `curl -s -X POST localhost:8080/orders -d '{"customer":"grace","items":["pump"]}'`.
approach:
1. **Understand:** an event is a key and a string value sent to a topic; the API calls `publishOrder` for each new order.
2. **Examples:** `send.js` sent `{ key: "ada", value: JSON.stringify(…) }` to `orders`.
3. **Brute force:** sending the order without a key would scatter a customer's events over partitions.
4. **Pattern:** **producer.send({ topic, messages: [{ key, value }] })** after `connect()`.
5. **Plan:** add the send; rebuild; POST an order; check the topic.
6. **Code and test:** `kafka-console-consumer.sh … --formatter-property print.key=true` shows `grace	{"type":"order-placed","customer":"grace","items":["pump"],"total":3000}`.
walkthrough:
**Line by line**

- `connecting ??= producer.connect()` starts connecting on the first call only; `await connecting` waits for it every time.
- `producer.send({ topic: "orders", messages: [...] })` sends one message and resolves with the delivery report once the broker has it (with `acks=all`).
- `key: order.customer` keeps each customer's events in one partition; `JSON.stringify({ type: "order-placed", ...order })` puts the type first, then the order's fields.

**Trace:** the POST returns `{"customer":"grace","items":["pump"],"total":3000}`; the billing worker logs `Invoice for grace: 30.00 (partition 0, offset 0)`.

**Common wrong approach:** passing the order object as the value. Message values must be strings or buffers; serialise them yourself.
:::

:::exercise Fix the advertised listener
The shop's Compose project starts, but no order events reach Kafka: the API logs connection errors after each order. Fix `compose.yaml` so containers in the project can use Kafka, while your computer can still reach it on `localhost:9092`. Recreate the services, then place an order for `linus` with the items `["lock"]` and check the billing worker invoiced it.
```sh starter setup=kafka-shop-wrong-listener
grep -n "KAFKA" compose.yaml
```
```js check
const yaml = read("compose.yaml");
const t = kafka().topic("orders");
const r = t && t.records().find((x) => x.value && x.value.includes('"customer":"linus"'));
if (!r) throw new AssertionError("No order event for linus reached the topic orders. The API still can't reach the broker's advertised address: give containers a listener that advertises kafka:…, and point KAFKA_BROKERS at it.");
const logs = docker().containers().filter((c) => c.compose && c.compose.service === "billing").map((c) => c.logs).join("");
if (!/Invoice for linus/.test(logs)) throw new AssertionError("The billing worker hasn't invoiced linus's order. Is it running and connected to the right listener?");
if (!/localhost:9092/.test(yaml)) throw new AssertionError("Keep an advertised listener on localhost:9092 for programs on your computer.");
```
```sh solution setup=kafka-shop-wrong-listener
cat > compose.yaml <<'EOF'
services:
  kafka:
    image: apache/kafka:4.3.1
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: INTERNAL://:19092,EXTERNAL://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: INTERNAL://kafka:19092,EXTERNAL://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT,CONTROLLER:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: INTERNAL
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
    healthcheck:
      test: /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
      interval: 5s
      retries: 10
  api:
    build: .
    ports:
      - "8080:3000"
    environment:
      KAFKA_BROKERS: kafka:19092
    depends_on:
      kafka:
        condition: service_healthy
  billing:
    build: .
    command: ["node", "billing.js"]
    environment:
      KAFKA_BROKERS: kafka:19092
    depends_on:
      kafka:
        condition: service_healthy
EOF
docker compose up -d > /dev/null 2>&1
curl -s -X POST localhost:8080/orders -d '{"customer":"linus","items":["lock"]}'
docker compose logs billing | grep Invoice
```
hint: Containers must reach the broker at an address that works inside the network, `kafka:PORT`, and the broker must *advertise* that address on the listener they use.
hint: Add a second listener: `KAFKA_LISTENERS: INTERNAL://:19092,EXTERNAL://:9092,CONTROLLER://:9093` with `KAFKA_ADVERTISED_LISTENERS: INTERNAL://kafka:19092,EXTERNAL://localhost:9092`, and map both names to PLAINTEXT in `KAFKA_LISTENER_SECURITY_PROTOCOL_MAP`.
hint: Use `KAFKA_INTER_BROKER_LISTENER_NAME: INTERNAL`, set `KAFKA_BROKERS: kafka:19092` for api and billing, then `docker compose up -d` recreates what changed.
approach:
1. **Understand:** bootstrap succeeds, but the advertised `localhost:9092` points each container at itself.
2. **Examples:** the lesson's working `compose.yaml` has INTERNAL (`kafka:19092`) and EXTERNAL (`localhost:9092`) listeners.
3. **Brute force:** advertising only `kafka:9092` fixes the containers but breaks programs on your computer, which can't resolve `kafka`.
4. **Pattern:** **one listener per network: internal name for containers, localhost for the host**.
5. **Plan:** listeners, advertised listeners, protocol map, inter-broker listener, client addresses; recreate; test.
6. **Code and test:** the POST answers 201 with no error in the API's logs, and billing logs `Invoice for linus: 29.00 …`.
walkthrough:
**Line by line**

- `INTERNAL://:19092` and `EXTERNAL://:9092` are two listeners on different ports; `CONTROLLER://:9093` stays for KRaft.
- `KAFKA_ADVERTISED_LISTENERS` tells clients on INTERNAL to use `kafka:19092` (the service name, resolvable in the Compose network) and clients on EXTERNAL to use `localhost:9092` (the published port).
- `KAFKA_LISTENER_SECURITY_PROTOCOL_MAP` says both custom names use PLAINTEXT; `KAFKA_INTER_BROKER_LISTENER_NAME: INTERNAL` is how brokers talk to each other.
- `KAFKA_BROKERS: kafka:19092` makes the API and worker bootstrap on the internal listener.

**Trace:** after `docker compose up -d`, Compose recreates kafka, api and billing; the order is published and invoiced.

**Common wrong approach:** only changing `KAFKA_BROKERS` to `kafka:9092`. Bootstrapping works, but the advertised address is still `localhost:9092`, so every send fails exactly as before.
:::

:::quiz
? A client bootstraps from kafka:9092 and then fails to connect to localhost:9092. What's wrong?
+ The broker advertises localhost:9092 on that listener, which from inside the client's container means the container itself
- The broker isn't running
- The client needs --from-beginning
- The topic doesn't exist
= Clients connect to the advertised listeners from the metadata; give containers a listener that advertises a name they can resolve.
? Why does the billing worker disconnect its consumer on SIGTERM?
+ So it commits its offsets and leaves the group at once, letting the group rebalance immediately instead of waiting for its session to time out
- Because Docker requires it
- To delete the consumer group
- So the events are removed from the topic
= A clean leave is fast; a crashed member is only noticed after session.timeout.ms (45 seconds by default).
? The shop saves an order to its database and then publishes an event; the publish fails. What pattern prevents the lost event?
+ The outbox pattern: store the event in the same transaction as the order and publish it from there
- Publishing the event before saving the order
- Retrying the HTTP request
- Using acks=0
= Publishing first just moves the problem; the outbox (or change data capture) makes both happen or neither.
? Which name suits an event in the orders topic?
+ order-placed
- create-invoice
- processOrder
- orders
= Events are facts that happened (past tense); commands like create-invoice tell a specific service what to do.
:::
