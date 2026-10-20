# Lesson 26: Partitions, keys and ordering

**You'll learn:** why topics have partitions, offsets per partition, ordering within a partition only, keys and the default partitioner (murmur2 modulo the partition count), choosing a key, print.partition, print.offset and print.key formatter properties, parse.key and key.separator reader properties (--property deprecated in Kafka 4.2), reading one partition from an offset (--partition, --offset), keyless events and the sticky partitioner, end offsets with kafka-get-offsets.sh (--time -2 for the earliest), adding partitions with --alter and why keys move, choosing a partition count, retention.ms and retention.bytes, segments, kafka-configs.sh --alter --add-config, --delete-config and --describe, dynamic topic configs, compacted topics (cleanup.policy=compact) and tombstones, clients whose default hash differs (librdkafka's CRC32).

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#kafka-partitions)**: run every example and check your exercise answers.

## Key terms

- **Key:** the part of an event that picks its partition; events with the same key stay in order.
- **Partitioner:** the producer code that chooses a partition: murmur2(key) modulo the partition count by default.
- **Sticky partitioner:** the Java producer's way of sending keyless events: fill a batch for one partition, then switch.
- **End offset (log-end offset):** the offset the next event in a partition will get.
- **Segment:** one of the files a partition is stored in; retention deletes whole segments.
- **Dynamic config:** a topic setting changed at runtime with kafka-configs.sh, stored in the cluster's metadata.
- **Compacted topic:** a topic that keeps at least the latest event for each key (cleanup.policy=compact).
- **Tombstone:** an event with a key and a null value, which deletes the key from a compacted topic.

A topic is split into **partitions**. Each partition is its own ordered log on a broker, with its own offsets starting at 0. Partitions are what let Kafka scale: different partitions can live on different brokers, and different consumers can read them at the same time (lesson 27).

The price is ordering. **Kafka keeps events in order within a partition, not across a topic.** Events in partition 0 and partition 2 have no order between them.

![Six events with keys ada, grace, ada, linus, grace, ada go through the partitioner, which computes murmur2(key) modulo 3: ada goes to partition 2, grace to partition 0 and linus to partition 2. Partition 0 holds grace's two events at offsets 0 and 1, partition 1 is empty, partition 2 holds ada's three events and linus's, in the order they were sent. Each partition is ordered; there's no order between partitions](../figures/kafka-partitions.svg)

## Keys decide the partition

The event's **key** solves the ordering problem. A producer sends every event with the same key to the same partition, so **all events with one key stay in order**. Kafka's default partitioner computes a hash of the key (murmur2) and takes it modulo the number of partitions.

The setup sent six orders keyed by customer. Print where each landed with `--formatter-property`:

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1 > /dev/null 2>&1
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3 > /dev/null
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --reader-property parse.key=true --reader-property key.separator=: <<'EOF'
ada:{"id":1,"customer":"ada","items":["bell"]}
grace:{"id":2,"customer":"grace","items":["pump","lock"]}
ada:{"id":3,"customer":"ada","items":["lock"]}
linus:{"id":4,"customer":"linus","items":["bell","bell"]}
grace:{"id":5,"customer":"grace","items":["bell"]}
ada:{"id":6,"customer":"ada","items":["pump"]}
EOF
```

</details>

```bash
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --from-beginning --max-messages 6 --formatter-property print.partition=true --formatter-property print.offset=true --formatter-property print.key=true 2>/dev/null
```

All of `ada`'s orders are in partition 2, in the order they were placed, and both of `grace`'s are in partition 0. `linus` shares partition 2 with `ada`: with only three partitions, many keys share each one. Partition 1 happens to get no key here; with more customers it would.

Choose the key as the thing whose events must stay in order: a customer, an order, a bank account, a device. Events without a common key can't be ordered relative to each other anyway.

## Sending keys from the console

The console producer splits each line into key and value when you set **reader properties** (`--property` in older guides, deprecated since Kafka 4.2):

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1 > /dev/null 2>&1
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3 > /dev/null
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --reader-property parse.key=true --reader-property key.separator=: <<'EOF'
ada:{"id":1,"customer":"ada","items":["bell"]}
grace:{"id":2,"customer":"grace","items":["pump","lock"]}
ada:{"id":3,"customer":"ada","items":["lock"]}
linus:{"id":4,"customer":"linus","items":["bell","bell"]}
grace:{"id":5,"customer":"grace","items":["bell"]}
ada:{"id":6,"customer":"ada","items":["pump"]}
EOF
```

</details>

```bash
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --reader-property parse.key=true --reader-property key.separator=: <<'EOF'
ada:{"id":7,"customer":"ada","items":["bell"]}
EOF
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --partition 2 --offset 4 --max-messages 1 --formatter-property print.offset=true --formatter-property print.key=true 2>/dev/null
```

`--partition 2 --offset 4` reads one partition from a given offset (`earliest` and `latest` work too): the new event is at offset 4, right after `ada`'s order 6. A line without the separator makes the producer stop with `No key separator found on line number 1`.

## Events without a key

Events with no key can go to any partition. The Java producer uses a **sticky partitioner**: it fills one batch for one partition, then picks another. A quick burst of keyless events, like the console producer's, often lands in a single partition:

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1 > /dev/null 2>&1
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3 > /dev/null
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --reader-property parse.key=true --reader-property key.separator=: <<'EOF'
ada:{"id":1,"customer":"ada","items":["bell"]}
grace:{"id":2,"customer":"grace","items":["pump","lock"]}
ada:{"id":3,"customer":"ada","items":["lock"]}
linus:{"id":4,"customer":"linus","items":["bell","bell"]}
grace:{"id":5,"customer":"grace","items":["bell"]}
ada:{"id":6,"customer":"ada","items":["pump"]}
EOF
```

</details>

```bash
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders <<'EOF'
{"note":"keyless 1"}
{"note":"keyless 2"}
EOF
docker exec kafka /opt/kafka/bin/kafka-get-offsets.sh --bootstrap-server localhost:9092 --topic orders
```

`kafka-get-offsets.sh` prints each partition's **end offset** (the offset the next event will get), as `topic:partition:offset`. Before, the partitions held 2, 0 and 4 events; both keyless events went to the same partition. Use keys whenever order matters; leave them out only when it doesn't.

## Adding partitions moves keys

You can add partitions to a topic (never remove them):

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1 > /dev/null 2>&1
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3 > /dev/null
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --reader-property parse.key=true --reader-property key.separator=: <<'EOF'
ada:{"id":1,"customer":"ada","items":["bell"]}
grace:{"id":2,"customer":"grace","items":["pump","lock"]}
ada:{"id":3,"customer":"ada","items":["lock"]}
linus:{"id":4,"customer":"linus","items":["bell","bell"]}
grace:{"id":5,"customer":"grace","items":["bell"]}
ada:{"id":6,"customer":"ada","items":["pump"]}
EOF
```

</details>

```bash
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

## How long events stay: retention

Kafka deletes old events by **retention**, not by reading. By default a topic keeps events for 7 days (`retention.ms` = 604800000), with no size limit (`retention.bytes` = -1). Change it for one topic with `kafka-configs.sh`:

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1 > /dev/null 2>&1
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3 > /dev/null
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --reader-property parse.key=true --reader-property key.separator=: <<'EOF'
ada:{"id":1,"customer":"ada","items":["bell"]}
grace:{"id":2,"customer":"grace","items":["pump","lock"]}
ada:{"id":3,"customer":"ada","items":["lock"]}
linus:{"id":4,"customer":"linus","items":["bell","bell"]}
grace:{"id":5,"customer":"grace","items":["bell"]}
ada:{"id":6,"customer":"ada","items":["pump"]}
EOF
```

</details>

```bash
docker exec kafka /opt/kafka/bin/kafka-configs.sh --bootstrap-server localhost:9092 --entity-type topics --entity-name orders --alter --add-config retention.ms=1209600000
docker exec kafka /opt/kafka/bin/kafka-configs.sh --bootstrap-server localhost:9092 --entity-type topics --entity-name orders --describe
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic orders
```

`1209600000` milliseconds is 14 days. Retention works on whole **segments** (the files a partition is stored in), so events are deleted a little after they expire, a segment at a time, and offsets keep counting up: the oldest offset still kept becomes the partition's start. `--delete-config retention.ms` goes back to the default, and `--config retention.ms=…` sets it when creating a topic.

## Compacted topics

Some topics hold the **latest state** per key rather than a history: a customer's address, a product's price. With `cleanup.policy=compact`, Kafka keeps at least the newest event for each key and removes older ones in the background. An event with a key and an empty (null) value, a **tombstone**, means "delete this key".

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1 > /dev/null 2>&1
```

</details>

```bash
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic customers --partitions 3 --config cleanup.policy=compact
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic customers
```

Compaction only runs on older segments (never the one being written), so on a quiet topic you won't see it happen soon. A service that reads a compacted topic from the beginning ends up with the current state of every key; that's how Kafka Streams and Kafka Connect store their own state.

## Try it on your own computer

- Partition placement is the same with every Java client and with `@confluentinc/kafka-javascript` (lesson 29), which both use murmur2. Some clients default to a different hash, such as librdkafka's own C and Python clients (CRC32 unless you set `partitioner=murmur2_random`), so the same key can land in different partitions depending on which program wrote it.
- `kafka-get-offsets.sh --time -2` prints the earliest offsets instead of the end.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Show partition, offset and key | kafka-console-consumer.sh … --formatter-property print.partition=true --formatter-property print.offset=true --formatter-property print.key=true | nothing | — |
| Send keyed events | kafka-console-producer.sh … --reader-property parse.key=true --reader-property key.separator=: | appends events | — |
| Read one partition from an offset | kafka-console-consumer.sh … --partition 2 --offset 3 | nothing | — |
| Show end offsets | kafka-get-offsets.sh --bootstrap-server B --topic T | nothing | — |
| Add partitions | kafka-topics.sh … --alter --topic T --partitions N | more partitions (keys move) | — (can't remove) |
| Change a topic setting | kafka-configs.sh … --entity-type topics --entity-name T --alter --add-config retention.ms=MS | the topic's config | --alter --delete-config retention.ms |

## Common mistakes

- Expecting events in different partitions to be read in the order they were written.
- Keying by a unique ID (each order) when the events that must stay in order share a customer or account.
- Adding partitions to a keyed topic and breaking the order of each key's events.
- Writing durations like 30d: Kafka's settings take plain milliseconds.
- Recreating a topic to change a setting instead of using kafka-configs.sh, and losing its events.

## Exercises

### 1. Keep each customer's orders together

`orders` (3 partitions) already has six events. Add three more orders for the customer `ada`, keyed by `ada` so they stay in order with her earlier ones:

```text
{"id":10,"customer":"ada","items":["bell"]}
{"id":11,"customer":"ada","items":["pump"]}
{"id":12,"customer":"ada","items":["lock"]}
```

Then print partition 2 from offset 3, showing the offsets and keys, to check they went where `ada`'s other orders are.

<details>
<summary>The sandbox starts this exercise with these commands (run them first on your own computer)</summary>

```bash
docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1 > /dev/null 2>&1
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3 > /dev/null
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --reader-property parse.key=true --reader-property key.separator=: <<'EOF'
ada:{"id":1,"customer":"ada","items":["bell"]}
grace:{"id":2,"customer":"grace","items":["pump","lock"]}
ada:{"id":3,"customer":"ada","items":["lock"]}
linus:{"id":4,"customer":"linus","items":["bell","bell"]}
grace:{"id":5,"customer":"grace","items":["bell"]}
ada:{"id":6,"customer":"ada","items":["pump"]}
EOF
```

</details>

Starter:

```bash
docker exec kafka /opt/kafka/bin/kafka-get-offsets.sh --bootstrap-server localhost:9092 --topic orders
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** the key decides the partition, and order is kept within a partition.
2. **Examples:** the lesson sent `ada:{"id":7,…}` with `parse.key=true` and found it in partition 2.
3. **Brute force:** sending the lines without keys spreads them by the sticky partitioner, away from `ada`'s other orders.
4. **Pattern:** **key = the thing whose events must stay in order**.
5. **Plan:** produce three keyed lines; consume partition 2 from offset 3 with offsets and keys shown.
6. **Code and test:** the consumer shows `Offset:3 ada …` (order 6), then orders 10, 11 and 12 at offsets 4, 5 and 6.

</details>

<details>
<summary>💡 Hint 1</summary>

Turn on key parsing with `--reader-property parse.key=true --reader-property key.separator=:`, then write each line as `ada:{…}`.

</details>

<details>
<summary>💡 Hint 2</summary>

The default partitioner puts every event with the key `ada` in the same partition, partition 2 for this topic.

</details>

<details>
<summary>💡 Hint 3</summary>

To read one partition from an offset: `--partition 2 --offset 3`; add `--formatter-property print.offset=true --formatter-property print.key=true` and `--max-messages`.

</details>

### 2. Keep payments for 30 days

The topic `orders` keeps events for the default 7 days. Make it keep them for 30 days, with `kafka-configs.sh`, then show the topic's dynamic configs to check. (A day is 86,400,000 milliseconds.)

<details>
<summary>The sandbox starts this exercise with these commands (run them first on your own computer)</summary>

```bash
docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1 > /dev/null 2>&1
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3 > /dev/null
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --reader-property parse.key=true --reader-property key.separator=: <<'EOF'
ada:{"id":1,"customer":"ada","items":["bell"]}
grace:{"id":2,"customer":"grace","items":["pump","lock"]}
ada:{"id":3,"customer":"ada","items":["lock"]}
linus:{"id":4,"customer":"linus","items":["bell","bell"]}
grace:{"id":5,"customer":"grace","items":["bell"]}
ada:{"id":6,"customer":"ada","items":["pump"]}
EOF
```

</details>

Starter:

```bash
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic orders
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** retention is a per-topic setting (`retention.ms`), changed without restarting anything.
2. **Examples:** the lesson set 14 days, `retention.ms=1209600000`.
3. **Brute force:** recreating the topic with `--config retention.ms=…` would lose its events.
4. **Pattern:** **kafka-configs.sh --alter --add-config KEY=VALUE** for one topic's settings.
5. **Plan:** compute 30 days in ms, alter, describe.
6. **Code and test:** `Completed updating config for topic orders.`, then `retention.ms=2592000000 sensitive=false synonyms={DYNAMIC_TOPIC_CONFIG:retention.ms=2592000000}`.

</details>

<details>
<summary>💡 Hint 1</summary>

30 × 86,400,000 = 2,592,000,000 milliseconds.

</details>

<details>
<summary>💡 Hint 2</summary>

`kafka-configs.sh --entity-type topics --entity-name orders --alter --add-config retention.ms=…` changes one topic.

</details>

<details>
<summary>💡 Hint 3</summary>

The same command with `--describe` instead of `--alter --add-config …` shows the settings you changed.

</details>

**In the sandbox:** exercises 51–52. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Keep each customer's orders together</summary>

```bash
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --reader-property parse.key=true --reader-property key.separator=: <<'EOF'
ada:{"id":10,"customer":"ada","items":["bell"]}
ada:{"id":11,"customer":"ada","items":["pump"]}
ada:{"id":12,"customer":"ada","items":["lock"]}
EOF
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --partition 2 --offset 3 --max-messages 4 --formatter-property print.offset=true --formatter-property print.key=true
```

**Line by line**

- `--reader-property parse.key=true --reader-property key.separator=:` makes the producer split each line at the first `:` into key and value.
- Each `ada:{…}` line becomes an event with the key `ada`; murmur2(`ada`) modulo 3 is 2, so all three go to partition 2, in the order sent.
- The consumer reads only partition 2 from offset 3 and prints `Offset:N`, the key and the value, separated by tabs.

**Trace:** offsets 0 to 3 hold orders 1 and 3 (`ada`), 4 (`linus`) and 6 (`ada`); offsets 4 to 6 hold orders 10 to 12.

**Common wrong approach:** keying by order id. Each order would land in its own partition, and a consumer could see `ada`'s orders out of order.

</details>

<details>
<summary>✅ 2. Keep payments for 30 days</summary>

```bash
docker exec kafka /opt/kafka/bin/kafka-configs.sh --bootstrap-server localhost:9092 --entity-type topics --entity-name orders --alter --add-config retention.ms=2592000000
docker exec kafka /opt/kafka/bin/kafka-configs.sh --bootstrap-server localhost:9092 --entity-type topics --entity-name orders --describe
```

**Line by line**

- `--entity-type topics --entity-name orders` picks the topic; `--alter --add-config retention.ms=2592000000` sets the value on it (a **dynamic** config, stored in the cluster's metadata).
- `--describe` lists the topic's dynamic configs with where each value comes from: `DYNAMIC_TOPIC_CONFIG` means "set on this topic".

**Trace:** `kafka-topics.sh --describe` now also shows `retention.ms=2592000000` among the topic's `Configs`.

**Common wrong approach:** writing `retention.ms=30d`. Kafka's durations are plain numbers of milliseconds, and the broker rejects anything else.

</details>

## Quick quiz

1. What does Kafka guarantee about the order of events?
   - A) There are no ordering guarantees at all
   - B) Events in the same partition are read in the order they were written; there's no order across partitions
   - C) All events in a topic are read in the order they were written
   - D) Events are sorted by timestamp

2. Two events have the same key. Where do they go?
   - A) To the partition with the fewest events
   - B) To partition 0
   - C) To the same partition (as long as the partition count doesn't change)
   - D) To different partitions, to spread the load

3. You add partitions to a topic whose events are keyed by customer. What's the risk?
   - A) Keys now hash to different partitions, so a customer's new events can be read before their older ones
   - B) Nothing: keys keep their old partitions
   - C) Kafka deletes the existing events
   - D) Consumers stop working until restarted

4. When does Kafka delete events from a normal topic?
   - A) As soon as every consumer group has read them
   - B) When the producer disconnects
   - C) After the retention period (or size limit) passes, a whole segment at a time
   - D) Never: Kafka keeps everything forever

<details>
<summary>Quiz answers</summary>

1. **B) Events in the same partition are read in the order they were written; there's no order across partitions**: Use a key to keep related events in one partition.
2. **C) To the same partition (as long as the partition count doesn't change)**: The default partitioner hashes the key (murmur2) and takes it modulo the number of partitions.
3. **A) Keys now hash to different partitions, so a customer's new events can be read before their older ones**: hash modulo 3 and hash modulo 4 usually differ; choose the partition count up front for keyed topics.
4. **C) After the retention period (or size limit) passes, a whole segment at a time**: cleanup.policy=delete with retention.ms (7 days by default); compacted topics keep the latest event per key instead.

</details>

---
Previous: [Lesson 25](25-kafka-basics.md) · Next: [Lesson 27: Consumer groups and offsets](27-consumer-groups.md)
