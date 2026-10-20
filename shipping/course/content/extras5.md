@@ kafka-basics
topics: why services exchange events instead of calling each other, Apache Kafka as an append-only log, events (key, value, timestamp, headers), topics, partitions, offsets, brokers, clusters and controllers, producers and consumers, Kafka versus a message queue (RabbitMQ, SQS) and retention, KRaft and the end of ZooKeeper in Kafka 4.0, Kafka 4.3.1 and the apache/kafka image, single-node combined mode, waiting for "Kafka Server started", the tools in /opt/kafka/bin, --bootstrap-server, kafka-topics.sh --create, --list and --describe (topic ID, partition count, replication factor, configs, leader, replicas, ISR), topic names, the console producer and docker exec -i, the console consumer (--from-beginning, --max-messages, --timeout-ms), reading doesn't remove events, apache/kafka-native, Kafbat UI
terms:
- **Event:** a record of something that happened, with a key, a value, a timestamp and optional headers.
- **Topic:** a named, append-only stream of events, such as orders.
- **Partition:** one ordered log of a topic; a topic is split into partitions spread over brokers.
- **Offset:** an event's position in its partition, counting from 0.
- **Broker:** a Kafka server that stores partitions and serves clients.
- **Producer / consumer:** a program that writes events / reads them.
- **Bootstrap server:** the broker address a client contacts first to learn about the whole cluster.
- **Retention:** how long a topic keeps events (7 days by default), however often they're read.
- **KRaft:** Kafka's built-in consensus protocol for managing the cluster, which replaced ZooKeeper.
mistakes:
- Calling a tool by name (kafka-topics.sh) when /opt/kafka/bin isn't on the PATH.
- Piping input to docker exec without -i, so the producer sends nothing and still succeeds.
- Forgetting --from-beginning and wondering why a new consumer prints nothing.
- Running the console consumer without --max-messages or --timeout-ms, so it never stops.
- Treating Kafka like a queue that deletes events once they're read.

glance:
- Run Kafka in Docker | docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1 | starts a broker | docker rm -f kafka
- Create a topic | kafka-topics.sh --bootstrap-server B --create --topic T --partitions 3 | adds a topic | kafka-topics.sh … --delete --topic T
- List / describe topics | kafka-topics.sh --bootstrap-server B --list / --describe --topic T | nothing | —
- Send events from a file or here-document | docker exec -i kafka …kafka-console-producer.sh --bootstrap-server B --topic T | appends events | — (retention removes them)
- Read a topic from the start | kafka-console-consumer.sh --bootstrap-server B --topic T --from-beginning --max-messages N | nothing | —

@@ kafka-partitions
topics: why topics have partitions, offsets per partition, ordering within a partition only, keys and the default partitioner (murmur2 modulo the partition count), choosing a key, print.partition, print.offset and print.key formatter properties, parse.key and key.separator reader properties (--property deprecated in Kafka 4.2), reading one partition from an offset (--partition, --offset), keyless events and the sticky partitioner, end offsets with kafka-get-offsets.sh (--time -2 for the earliest), adding partitions with --alter and why keys move, choosing a partition count, retention.ms and retention.bytes, segments, kafka-configs.sh --alter --add-config, --delete-config and --describe, dynamic topic configs, compacted topics (cleanup.policy=compact) and tombstones, clients whose default hash differs (librdkafka's CRC32)
terms:
- **Key:** the part of an event that picks its partition; events with the same key stay in order.
- **Partitioner:** the producer code that chooses a partition: murmur2(key) modulo the partition count by default.
- **Sticky partitioner:** the Java producer's way of sending keyless events: fill a batch for one partition, then switch.
- **End offset (log-end offset):** the offset the next event in a partition will get.
- **Segment:** one of the files a partition is stored in; retention deletes whole segments.
- **Dynamic config:** a topic setting changed at runtime with kafka-configs.sh, stored in the cluster's metadata.
- **Compacted topic:** a topic that keeps at least the latest event for each key (cleanup.policy=compact).
- **Tombstone:** an event with a key and a null value, which deletes the key from a compacted topic.
mistakes:
- Expecting events in different partitions to be read in the order they were written.
- Keying by a unique ID (each order) when the events that must stay in order share a customer or account.
- Adding partitions to a keyed topic and breaking the order of each key's events.
- Writing durations like 30d: Kafka's settings take plain milliseconds.
- Recreating a topic to change a setting instead of using kafka-configs.sh, and losing its events.

glance:
- Show partition, offset and key | kafka-console-consumer.sh … --formatter-property print.partition=true --formatter-property print.offset=true --formatter-property print.key=true | nothing | —
- Send keyed events | kafka-console-producer.sh … --reader-property parse.key=true --reader-property key.separator=: | appends events | —
- Read one partition from an offset | kafka-console-consumer.sh … --partition 2 --offset 3 | nothing | —
- Show end offsets | kafka-get-offsets.sh --bootstrap-server B --topic T | nothing | —
- Add partitions | kafka-topics.sh … --alter --topic T --partitions N | more partitions (keys move) | — (can't remove)
- Change a topic setting | kafka-configs.sh … --entity-type topics --entity-name T --alter --add-config retention.ms=MS | the topic's config | --alter --delete-config retention.ms

@@ consumer-groups
topics: consumer groups and splitting partitions between members, more members than partitions, independent groups each reading every event, rebalances, committed offsets and __consumer_offsets, auto commit every 5 seconds, --group on the console consumer, kafka-consumer-groups.sh --list, --describe, --members and --state, CURRENT-OFFSET, LOG-END-OFFSET and LAG, why lag matters and what growing lag means, background consumers with docker exec -d, member IDs and hosts, the range assignor, stopping consumers with pkill -f, the classic and consumer rebalance protocols (KIP-848, group.protocol=consumer), --reset-offsets (to-earliest, to-latest, shift-by, to-offset, to-datetime, by-duration, dry run and --execute), resetting only an inactive group, at-least-once and at-most-once processing, idempotent consumers, share groups (KIP-932, queues for Kafka in 4.2), group.initial.rebalance.delay.ms
terms:
- **Consumer group:** consumers sharing a group ID; each partition goes to one member, so the group processes each event once.
- **Rebalance:** moving partitions between a group's members when one joins or leaves.
- **Committed offset:** the offset of the next event a group will process in a partition, stored in __consumer_offsets.
- **Lag:** log-end offset minus committed offset: events written but not yet processed by a group.
- **Auto commit:** the consumer committing its position every 5 seconds and on close.
- **At-least-once:** committing after processing, so a crash leads to some events being processed again.
- **Idempotent consumer:** a consumer that can safely see the same event twice.
- **Share group:** a group (production-ready since Kafka 4.2) where members share partitions and acknowledge events one by one, like a work queue.
mistakes:
- Running more consumers in a group than the topic has partitions and expecting them all to work.
- Starting a new group without --from-beginning, so it commits the end offsets and skips existing events.
- Resetting offsets without --execute (a dry run) and expecting the group to move.
- Trying to reset offsets while the group's consumers are still running.
- Assuming each event is processed exactly once and writing consumers that break on duplicates.

glance:
- Read as a group | kafka-console-consumer.sh … --topic T --group G | commits the group's offsets | kafka-consumer-groups.sh … --reset-offsets
- List groups | kafka-consumer-groups.sh --bootstrap-server B --list | nothing | —
- Show offsets and lag | kafka-consumer-groups.sh … --describe --group G | nothing | —
- Show members / state | kafka-consumer-groups.sh … --describe --group G --members / --state | nothing | —
- Start a consumer in the background | docker exec -d kafka …kafka-console-consumer.sh … --group G | adds a member | docker exec kafka pkill -f ConsoleConsumer
- Reprocess everything | kafka-consumer-groups.sh … --reset-offsets --group G --topic T --to-earliest --execute | the group's offsets | reset again to the old offsets (--to-offset)

@@ kafka-reliability
topics: why one broker isn't enough, replication factor, leaders and followers, in-sync replicas (ISR), combined and isolated KRaft modes, a cluster with Docker Compose (a controller and three brokers), the image's KAFKA_* variables and losing the defaults, CLUSTER_ID and controller quorum voters, YAML anchors and merge keys, topics with --replication-factor 3, leaders spread over brokers, leader election when a broker stops, --under-replicated-partitions, preferred leaders and auto.leader.rebalance.enable, acks (0, 1, all) and min.insync.replicas, NotEnoughReplicasException and the console producer's retries, the durable recipe (RF 3, min ISR 2, acks=all), idempotent producers (default since Kafka 3.0), retries and delivery.timeout.ms, linger.ms, transactions, read_committed and exactly_once_v2, eligible leader replicas (KIP-966, on by default since 4.1), kafka-metadata-quorum.sh, three controllers, availability zones and broker.rack
terms:
- **Replication factor:** how many brokers keep a copy of each partition.
- **Leader / follower:** the copy clients use / a copy that fetches from the leader to keep up.
- **In-sync replicas (ISR):** the copies fully caught up with the leader; only they can become leader.
- **Controller:** the node that manages the cluster's metadata and elects new leaders.
- **acks:** how many replicas must have an event before the leader confirms it (0, 1 or all).
- **min.insync.replicas:** the fewest in-sync copies an acks=all write needs; below it, writes are refused.
- **Under-replicated partition:** a partition with fewer in-sync replicas than replicas.
- **Idempotent producer:** a producer whose retries can't create duplicates or reorder events.
- **Transaction:** writes to several partitions (and offset commits) that become visible all together or not at all.
mistakes:
- Using replication factor 1 in production, so one broken broker loses its partitions.
- Setting min.insync.replicas equal to the replication factor, so any single broker restart stops writes.
- Switching to acks=1 to "fix" NotEnoughReplicas errors and risking lost events.
- Setting one KAFKA_* variable in the image and forgetting the others the defaults used to provide.
- Running a single controller in production, so losing it stops the cluster.

glance:
- Start a cluster from a Compose file | docker compose up -d | creates containers | docker compose down
- Create a durable topic | kafka-topics.sh … --create --topic T --partitions N --replication-factor 3 --config min.insync.replicas=2 | adds a topic | kafka-topics.sh … --delete --topic T
- Find under-replicated partitions | kafka-topics.sh … --describe --under-replicated-partitions | nothing | —
- Stop / start a broker | docker compose stop kafka-3 / docker compose start kafka-3 | the broker's container | the other one
- Send with weaker durability | kafka-console-producer.sh … --command-property acks=1 | appends events | —
- Show the controller quorum | kafka-metadata-quorum.sh --bootstrap-server B describe --status | nothing | —

@@ kafka-apps
topics: Node.js clients in 2026 (@confluentinc/kafka-javascript, KafkaJS, @platformatic/kafka), npm install and the package's prebuilt librdkafka, the KafkaJS-compatible API (KafkaJS.Kafka, kafkaJS settings), producer.connect, send and disconnect, delivery reports, the client's log objects, murmur2 for keys and random partitions without, publishing order events from the shop's API, the billing worker (consumer, subscribe, run, eachMessage), graceful shutdown on SIGTERM and session.timeout.ms, Kafka in Docker Compose with health checks, creating topics explicitly and auto.create.topics.enable, listeners, advertised listeners and the listener security protocol map, internal and external listeners, the "bootstrap works but sending fails" mistake, message.timeout.ms, scaling a worker with --scale, designing events (past-tense names, keys, IDs, versions, compatible changes), schemas and Schema Registry, the dual-write problem, the outbox pattern and Debezium, Kafka Connect, Kafka Streams, Apache Flink, MirrorMaker 2, managed Kafka (Confluent Cloud, Amazon MSK, Google Cloud, Aiven, Azure Event Hubs) and Kafka-compatible systems (Redpanda, WarpStream), confluent-kafka for Python, kafka-clients for Java
terms:
- **Client library:** the package a program uses to talk to Kafka, such as @confluentinc/kafka-javascript.
- **Delivery report:** the producer's confirmation of where an event was written (partition and offset).
- **Listener:** a name, protocol and port a broker accepts connections on.
- **Advertised listener:** the address a broker tells clients to use for a listener; it must work from where the client runs.
- **Graceful shutdown:** closing a consumer on SIGTERM so it commits and leaves its group at once.
- **Schema registry:** a service that stores event schemas and rejects incompatible changes.
- **Dual write:** writing to a database and to Kafka as two separate steps, which can leave them inconsistent.
- **Outbox pattern:** saving events in the same database transaction as the data, then publishing them from there.
- **Change data capture (CDC):** turning a database's changes into events, as Debezium does.
mistakes:
- Advertising localhost to other containers, so clients bootstrap and then can't connect.
- Changing code and restarting the container without rebuilding its image.
- Passing an object as a message value instead of a string or buffer.
- Relying on auto-created topics, which get the broker's defaults (and typos become new topics).
- Saving data and publishing its event as two writes with nothing to recover a failed publish.

glance:
- Install the Node.js client | npm install @confluentinc/kafka-javascript | package.json, package-lock.json, node_modules | npm uninstall @confluentinc/kafka-javascript
- Run Kafka with the app | docker compose up -d kafka, then create topics, then docker compose up -d | starts containers | docker compose down
- Rebuild and restart one service | docker compose up -d --build api | rebuilds the image, recreates the container | —
- Run more workers | docker compose up -d --scale billing=2 | adds containers | docker compose up -d --scale billing=1
- Check a worker's group | kafka-consumer-groups.sh … --describe --group billing --members | nothing | —
