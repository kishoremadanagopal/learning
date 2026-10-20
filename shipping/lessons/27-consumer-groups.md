# Lesson 27: Consumer groups and offsets

**You'll learn:** consumer groups and splitting partitions between members, more members than partitions, independent groups each reading every event, rebalances, committed offsets and __consumer_offsets, auto commit every 5 seconds, --group on the console consumer, kafka-consumer-groups.sh --list, --describe, --members and --state, CURRENT-OFFSET, LOG-END-OFFSET and LAG, why lag matters and what growing lag means, background consumers with docker exec -d, member IDs and hosts, the range assignor, stopping consumers with pkill -f, the classic and consumer rebalance protocols (KIP-848, group.protocol=consumer), --reset-offsets (to-earliest, to-latest, shift-by, to-offset, to-datetime, by-duration, dry run and --execute), resetting only an inactive group, at-least-once and at-most-once processing, idempotent consumers, share groups (KIP-932, queues for Kafka in 4.2), group.initial.rebalance.delay.ms.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#consumer-groups)**: run every example and check your exercise answers.

## Key terms

- **Consumer group:** consumers sharing a group ID; each partition goes to one member, so the group processes each event once.
- **Rebalance:** moving partitions between a group's members when one joins or leaves.
- **Committed offset:** the offset of the next event a group will process in a partition, stored in __consumer_offsets.
- **Lag:** log-end offset minus committed offset: events written but not yet processed by a group.
- **Auto commit:** the consumer committing its position every 5 seconds and on close.
- **At-least-once:** committing after processing, so a crash leads to some events being processed again.
- **Idempotent consumer:** a consumer that can safely see the same event twice.
- **Share group:** a group (production-ready since Kafka 4.2) where members share partitions and acknowledge events one by one, like a work queue.

One billing worker can only go so fast. To share the work, run several copies of it in the same **consumer group**: Kafka assigns each partition of the topic to exactly one member of the group, so the members split the partitions between them and each event is processed once by the group.

![The topic orders with three partitions. The consumer group billing has two members: member A reads partitions 0 and 1, member B reads partition 2. The group analytics has one member reading all three partitions. Each group keeps its own committed offsets; for billing, partition 2 is at offset 5 while the log ends at 7, a lag of 2](../figures/kafka-groups.svg)

- A group with **more members than partitions** leaves some members idle: the partition count is the limit on parallelism.
- **Different groups are independent.** Each group gets every event: billing and analytics both read all orders, each at its own pace.
- When a member joins or leaves, the group **rebalances**: Kafka moves partitions between the members that are left.

## Committed offsets

A group remembers how far it has read: for each partition, its **committed offset**, the offset of the next event to process. Kafka stores them in an internal topic, `__consumer_offsets`. By default consumers **auto-commit** every 5 seconds, and again when they close.

The console consumer joins a group with `--group`:

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

## Lag

**Lag** is the most important number for a consumer group: it says how far behind the group is. Lag that keeps growing means the consumers can't keep up (add members, up to one per partition, or make them faster); lag that stays at 0 means they're up to date.

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
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group billing --from-beginning --timeout-ms 1000 > /dev/null 2>&1
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --reader-property parse.key=true --reader-property key.separator=: <<'EOF'
linus:{"id":7,"customer":"linus","items":["pump"]}
ada:{"id":8,"customer":"ada","items":["bell","lock"]}
grace:{"id":9,"customer":"grace","items":["lock"]}
EOF
```

</details>

```bash
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group billing --timeout-ms 1000
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing 2>/dev/null
```

Three orders arrived after `billing` stopped: a lag of 1 on partition 0 and 2 on partition 2 (`linus` and `ada` both hash to partition 2). The next run of the group read exactly those three, then the lag was back to 0.

A different group reads everything again, without affecting `billing`:

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
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group billing --from-beginning --timeout-ms 1000 > /dev/null 2>&1
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --reader-property parse.key=true --reader-property key.separator=: <<'EOF'
linus:{"id":7,"customer":"linus","items":["pump"]}
ada:{"id":8,"customer":"ada","items":["bell","lock"]}
grace:{"id":9,"customer":"grace","items":["lock"]}
EOF
```

</details>

```bash
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group analytics --from-beginning --timeout-ms 1000 2>&1 | tail -1
```

## Members, live

Real consumers run all the time. `docker exec -d` starts a console consumer in the background, inside the container; start two in the group `billing`:

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
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group billing --from-beginning --timeout-ms 1000 > /dev/null 2>&1
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --reader-property parse.key=true --reader-property key.separator=: <<'EOF'
linus:{"id":7,"customer":"linus","items":["pump"]}
ada:{"id":8,"customer":"ada","items":["bell","lock"]}
grace:{"id":9,"customer":"grace","items":["lock"]}
EOF
```

</details>

```bash
docker exec -d kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group billing
docker exec -d kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group billing
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing --members
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing --state
```

The two members split the three partitions (2 and 1, with the default range assignor), caught up at once, and committed: lag 0. Each member has an ID made of its client ID and a random UUID; HOST is the address it connects from, here `127.0.0.1`, since it runs in the broker's own container. `--state` shows the group as `Stable`, with 2 members.

To stop the background consumers, send them the stop signal, as Ctrl+C would. `pkill -f` matches their full command line, which contains the Java class `ConsoleConsumer`:

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
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group billing --from-beginning --timeout-ms 1000 > /dev/null 2>&1
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --reader-property parse.key=true --reader-property key.separator=: <<'EOF'
linus:{"id":7,"customer":"linus","items":["pump"]}
ada:{"id":8,"customer":"ada","items":["bell","lock"]}
grace:{"id":9,"customer":"grace","items":["lock"]}
EOF
docker exec -d kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group billing
docker exec -d kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group billing
```

</details>

```bash
docker exec kafka pkill -f ConsoleConsumer
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing --state
```

On closing, each consumer committed its offsets and left the group, which is now `Empty`.

## Rebalance protocols

Every console consumer prints a notice: *The consumer rebalance protocol (KIP-848) is production-ready!* Kafka has two ways of running a group:

| | `classic` (still the clients' default) | `consumer` (KIP-848, GA since Kafka 4.0) |
|---|---|---|
| who assigns partitions | one of the members, after all of them rejoin | the broker, incrementally |
| during a rebalance | members pause while partitions move | only the moved partitions pause |
| how to use it | default | the consumer setting `group.protocol=consumer` |

For a console consumer, add `--command-property group.protocol=consumer`. New applications should use the new protocol; existing groups can switch without downtime.

## Resetting offsets

To reprocess events (after fixing a bug) or skip a backlog, move a group's committed offsets with `--reset-offsets`. The group must have no running members, and without `--execute` the command only shows what it would do:

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
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group billing --from-beginning --timeout-ms 1000 > /dev/null 2>&1
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --reader-property parse.key=true --reader-property key.separator=: <<'EOF'
linus:{"id":7,"customer":"linus","items":["pump"]}
ada:{"id":8,"customer":"ada","items":["bell","lock"]}
grace:{"id":9,"customer":"grace","items":["lock"]}
EOF
```

</details>

```bash
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --reset-offsets --group billing --topic orders --to-earliest --dry-run
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --reset-offsets --group billing --topic orders --to-earliest --execute
```

Other targets: `--to-latest` (skip everything not yet processed), `--shift-by -2` (back two events per partition), `--to-offset N`, `--to-datetime 2026-10-17T09:00:00.000` (the first event at or after that time) and `--by-duration PT1H` (an hour ago). `--topic orders:0,1` limits the reset to some partitions. Run against a group with members, it refuses: `Assignments can only be reset if the group 'billing' is inactive`.

## Processing exactly once?

Committing and processing are two steps, and a consumer can crash between them:

| Commit… | If the consumer crashes in between | Called |
|---|---|---|
| after processing (the usual) | the events are processed again after the restart | **at-least-once** |
| before processing | the events are never processed | **at-most-once** |

Auto commit is close to at-least-once: events processed since the last commit come again after a crash. So write consumers that can safely see an event twice, **idempotent consumers**: use an ID from the event (the order ID) and skip events already handled, or make the effect naturally repeatable ("set the status to paid" instead of "add 10 to the balance"). Kafka's transactions (lesson 28) give exactly-once within Kafka itself; across other systems, idempotence is the practical answer.

## Queues: share groups

A consumer group can't use more members than partitions, and one slow event holds up its whole partition. Kafka 4.2 made **share groups** production-ready ("queues for Kafka", KIP-932): members of a share group read the same partitions together, each event goes to one member, and members acknowledge events one by one, like a classic work queue. Use them for jobs that don't need ordering, such as sending emails; keep consumer groups when order per key matters. The tool `kafka-console-share-consumer.sh` and the client's share-consumer API work with them.

## Try it on your own computer

- On a real broker, give a new group a few seconds: the first rebalance waits `group.initial.rebalance.delay.ms` (3 seconds by default) for more members to arrive.
- Monitoring systems (Part 8) watch consumer lag as a metric; Kafbat UI shows it per group.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Read as a group | kafka-console-consumer.sh … --topic T --group G | commits the group's offsets | kafka-consumer-groups.sh … --reset-offsets |
| List groups | kafka-consumer-groups.sh --bootstrap-server B --list | nothing | — |
| Show offsets and lag | kafka-consumer-groups.sh … --describe --group G | nothing | — |
| Show members / state | kafka-consumer-groups.sh … --describe --group G --members / --state | nothing | — |
| Start a consumer in the background | docker exec -d kafka …kafka-console-consumer.sh … --group G | adds a member | docker exec kafka pkill -f ConsoleConsumer |
| Reprocess everything | kafka-consumer-groups.sh … --reset-offsets --group G --topic T --to-earliest --execute | the group's offsets | reset again to the old offsets (--to-offset) |

## Common mistakes

- Running more consumers in a group than the topic has partitions and expecting them all to work.
- Starting a new group without --from-beginning, so it commits the end offsets and skips existing events.
- Resetting offsets without --execute (a dry run) and expecting the group to move.
- Trying to reset offsets while the group's consumers are still running.
- Assuming each event is processed exactly once and writing consumers that break on duplicates.

## Exercises

### 1. Catch up the shipping service

The shipping service will read `orders` as the consumer group `shipping`, which hasn't read anything yet. Process all existing orders with a console consumer in the group `shipping` that stops by itself, then show the group's offsets to confirm its lag is 0.

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
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a group's progress is its committed offsets; lag is what's left to process.
2. **Examples:** the lesson's `billing` group read from the beginning and showed LAG 0.
3. **Brute force:** reading without `--group` processes the events but leaves no committed offsets anywhere.
4. **Pattern:** **--group G --from-beginning** for a new group; **--describe --group G** to check.
5. **Plan:** consume with the group until a timeout; describe it.
6. **Code and test:** six orders printed; every partition's LAG is 0.

</details>

<details>
<summary>💡 Hint 1</summary>

`--group shipping` makes the console consumer a member of that group and commits its offsets when it closes.

</details>

<details>
<summary>💡 Hint 2</summary>

A new group starts at the end of the topic unless you add `--from-beginning`; `--timeout-ms 1000` makes it stop when there's nothing more to read.

</details>

<details>
<summary>💡 Hint 3</summary>

Then `kafka-consumer-groups.sh --describe --group shipping` shows CURRENT-OFFSET equal to LOG-END-OFFSET on every partition.

</details>

### 2. Reprocess billing

A bug in the billing service produced wrong invoices. It's fixed, and the group `billing` must process every order again. Two `billing` consumers are still running in the background in the `kafka` container. Stop them, then reset the group's offsets for `orders` to the earliest, for real.

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
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group billing --from-beginning --timeout-ms 1000 > /dev/null 2>&1
docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --reader-property parse.key=true --reader-property key.separator=: <<'EOF'
linus:{"id":7,"customer":"linus","items":["pump"]}
ada:{"id":8,"customer":"ada","items":["bell","lock"]}
grace:{"id":9,"customer":"grace","items":["lock"]}
EOF
docker exec -d kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group billing
docker exec -d kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group billing
```

</details>

Starter:

```bash
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** resetting rewrites the group's committed offsets, which running members would immediately overwrite, so Kafka requires an empty group.
2. **Examples:** the lesson's reset printed `Assignments can only be reset if the group 'billing' is inactive` while members ran.
3. **Brute force:** deleting and recreating the topic would destroy the events themselves.
4. **Pattern:** **stop the consumers → reset (dry run) → reset --execute → start the consumers**.
5. **Plan:** pkill, then reset with `--to-earliest --execute`.
6. **Code and test:** NEW-OFFSET 0 for every partition; `--describe` shows the full lag.

</details>

<details>
<summary>💡 Hint 1</summary>

Offsets can only be reset while the group has no members: stop the background consumers with `docker exec kafka pkill -f ConsoleConsumer`.

</details>

<details>
<summary>💡 Hint 2</summary>

`kafka-consumer-groups.sh --reset-offsets --group billing --topic orders --to-earliest` shows the plan.

</details>

<details>
<summary>💡 Hint 3</summary>

Add `--execute` to apply it; `--describe --group billing` should then show CURRENT-OFFSET 0 everywhere.

</details>

**In the sandbox:** exercises 53–54. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Catch up the shipping service</summary>

```bash
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group shipping --from-beginning --timeout-ms 1000
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group shipping
```

**Line by line**

- `--group shipping --from-beginning`: the group has no committed offsets, so it starts at the earliest offset of each partition.
- `--timeout-ms 1000` ends the consumer once no event has arrived for a second; on closing it commits its position.
- `--describe --group shipping` compares the committed offsets with the partitions' ends.

**Trace:** CURRENT-OFFSET and LOG-END-OFFSET are 2, 0 and 4 on partitions 0, 1 and 2, and LAG is 0 everywhere; the group has no active members.

**Common wrong approach:** leaving out `--from-beginning` for a new group. It starts at the end, reads nothing, and commits the end offsets: the existing orders are skipped for good, unless you reset the group.

</details>

<details>
<summary>✅ 2. Reprocess billing</summary>

```bash
docker exec kafka pkill -f ConsoleConsumer
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --reset-offsets --group billing --topic orders --to-earliest --execute
```

**Line by line**

- `docker exec kafka pkill -f ConsoleConsumer` sends SIGTERM to every process whose command line contains `ConsoleConsumer`; each consumer commits and leaves the group, which becomes `Empty`.
- `--reset-offsets --group billing --topic orders --to-earliest --execute` sets the committed offset of each partition to its earliest offset (0 here).

**Trace:** the reset prints a NEW-OFFSET of 0 for partitions 0, 1 and 2; the next `billing` consumer starts again from the first order.

**Common wrong approach:** resetting without `--execute`. It prints the same table, with a warning, but changes nothing.

</details>

## Quick quiz

1. A topic has 4 partitions. You run 6 consumers in the same group. What happens?
   - A) Kafka splits the partitions into 6 pieces
   - B) The group refuses the extra members with an error
   - C) Each consumer gets every event
   - D) 4 consumers get one partition each; 2 sit idle

2. Billing and analytics read the same topic in different consumer groups. Billing falls behind. What happens to analytics?
   - A) It can't read events billing hasn't read yet
   - B) It takes over billing's partitions
   - C) Nothing: each group has its own committed offsets and reads at its own pace
   - D) It slows down to match billing

3. What does LAG mean in kafka-consumer-groups.sh --describe?
   - A) How long the last rebalance took
   - B) How many seconds behind the group is
   - C) The number of failed events
   - D) How many events the group still has to process in that partition: LOG-END-OFFSET − CURRENT-OFFSET

4. A consumer crashes after processing an event but before committing it. What happens after it restarts?
   - A) The group is deleted
   - B) It processes the event again (at-least-once), so consumers should be idempotent
   - C) Kafka detects the crash and skips the event
   - D) The event is lost

<details>
<summary>Quiz answers</summary>

1. **D) 4 consumers get one partition each; 2 sit idle**: A partition goes to one member of a group, so the partition count limits a group's parallelism.
2. **C) Nothing: each group has its own committed offsets and reads at its own pace**: Groups are independent; every group receives every event.
3. **D) How many events the group still has to process in that partition: LOG-END-OFFSET − CURRENT-OFFSET**: Growing lag means consumers can't keep up.
4. **B) It processes the event again (at-least-once), so consumers should be idempotent**: It resumes from the last committed offset, which is before the event.

</details>

---
Previous: [Lesson 26](26-kafka-partitions.md) · Next: [Lesson 28: Replication and reliable producers](28-kafka-reliability.md)
