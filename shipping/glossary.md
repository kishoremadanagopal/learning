# Shipping software glossary

Every term used in the course, A to Z. The number in brackets is the lesson where it's introduced.

| Term | Meaning |
|---|---|
| **acks** | How many replicas must have an event before the leader confirms it (0, 1 or all). [28] |
| **Action** | A packaged, reusable step, like `actions/checkout`. [13] |
| **actionlint** | A linter that checks workflow files for errors before you push. [15] |
| **Advertised listener** | The address a broker tells clients to use for a listener; it must work from where the client runs. [29] |
| **Amend** | Replaces the last commit with a new one that has your fixes. [5] |
| **Annotation** | A message attached to a run, such as an error from a step. [14] |
| **Artifact** | Files a job uploads so later jobs, or people, can download them. [17] |
| **At-least-once** | Committing after processing, so a crash leads to some events being processed again. [27] |
| **Auto commit** | The consumer committing its position every 5 seconds and on close. [27] |
| **base64** | An encoding of bytes as text; not encryption. [33] |
| **Base image** | The image a Dockerfile starts FROM. [21] |
| **Bind mount** | A folder of the host mounted into a container. [22] |
| **Blob** | An object holding a file's contents (without its name). [6] |
| **Bootstrap server** | The broker address a client contacts first to learn about the whole cluster. [25] |
| **Branch** | A movable name that points to a commit; committing moves the current branch forward. [7] |
| **Broker** | A Kafka server that stores partitions and serves clients. [25] |
| **Build cache** | Layers BuildKit reuses when a step and its inputs haven't changed. [21] |
| **Build check** | A BuildKit rule that warns about Dockerfile problems, such as JSONArgsRecommended. [20] |
| **Build context** | The folder (minus .dockerignore) that docker build sends to the builder; COPY copies from it. [20] |
| **BuildKit** | Docker's builder; it runs the steps, caches them and checks the Dockerfile. [20] |
| **Build secret** | A secret mounted into one RUN step without being stored in the image. [21] |
| **Cache** | Saved files restored into later jobs, looked up by a key. [18] |
| **Cache invalidation** | A changed step makes every later step run again. [21] |
| **Cache key** | The name a cache is saved under, usually including a hash of the files it depends on. [18] |
| **Change data capture (CDC)** | Turning a database's changes into events, as Debezium does. [29] |
| **Check** | The result of one job on a commit, shown on pull requests. [14] |
| **Cherry-pick** | Apply the change from one commit onto the current branch as a new commit. [10] |
| **Client library** | The package a program uses to talk to Kafka, such as @confluentinc/kafka-javascript. [29] |
| **Cluster DNS** | The name service that resolves Service names such as shop and shop.default.svc.cluster.local. [32] |
| **ClusterIP** | A virtual address for a Service, reachable only inside the cluster. [32] |
| **Commit** | A saved snapshot of the staged files, with an id, author, date, message and a link to its parent. [2] |
| **Commit id (hash)** | A 40-character code that names a commit uniquely; the first 7 characters are usually enough. [2] |
| **Committed offset** | The offset of the next event a group will process in a partition, stored in __consumer_offsets. [27] |
| **Compacted topic** | A topic that keeps at least the latest event for each key (cleanup.policy=compact). [26] |
| **Compose watch** | Keeping containers in sync with files you edit, by copying or rebuilding. [23] |
| **Composite action** | An action made of steps, defined in an `action.yml`. [18] |
| **Concurrency group** | A name that makes runs queue (or cancel each other) instead of overlapping. [17] |
| **ConfigMap** | An object holding plain-text configuration as key–value pairs (or whole files). [33] |
| **Configuration variable** | A non-secret value stored on GitHub, read as `${{ vars.NAME }}`. [16] |
| **Conflict markers** | The `<<<<<<<`, `=======` and `>>>>>>>` lines Git writes around each clash. [8] |
| **Consumer group** | Consumers sharing a group ID; each partition goes to one member, so the group processes each event once. [27] |
| **Container** | A running or stopped instance of an image: an isolated process with its own file system and network. [19] |
| **Content-addressed storage** | Storing data under a name computed from the data itself, its hash. [6] |
| **Context** | An object of information available to expressions, like `github` or `matrix`. [15] |
| **Continuous delivery** | Every change that passes is ready to release with one action. [13] |
| **Continuous deployment** | Every change that passes is released automatically. [13] |
| **Continuous integration (CI)** | Merging small changes often, with every change built and tested automatically. [13] |
| **Controller** | The node that manages the cluster's metadata and elects new leaders. [28] |
| **Control plane** | The API server, etcd, the scheduler and the controller manager. [30] |
| **CrashLoopBackOff** | A container that keeps failing and is restarted with increasing delays. [34] |
| **Credential helper** | A program that stores registry logins in the operating system's keychain. [24] |
| **Cron** | A five-field schedule format: minute, hour, day of month, month, day of week. [18] |
| **Current branch** | The branch `HEAD` points to; new commits go onto it. [7] |
| **Default branch** | The branch GitHub shows first and merges pull requests into by default, usually `main`. [12] |
| **Delivery report** | The producer's confirmation of where an event was written (partition and offset). [29] |
| **Dependabot** | GitHub's bot that opens pull requests to update dependencies, including actions. [16] |
| **depends_on** | Start-order rules between services, optionally waiting for health. [23] |
| **Deployment** | An object that keeps a set number of identical pods running and updates them to a new template. [31] |
| **Detached** | Running in the background (-d), with the terminal free for other commands. [19] |
| **Detached HEAD** | `HEAD` pointing straight at a commit instead of a branch; new commits there belong to no branch. [7] |
| **Diff** | The differences between two versions, shown line by line. [3] |
| **Digest** | A sha256 hash that identifies an image's exact content and never changes. [19] |
| **Distributed** | Every copy of a Git repository holds the full history, so most commands work offline. [1] |
| **Distroless image** | An image with only the runtime and the app, without a shell or package manager. [21] |
| **Diverged** | Two copies of a branch each have commits the other doesn't. [10] |
| **Docker Compose** | A tool that runs a multi-container app described in compose.yaml. [23] |
| **Docker Engine** | The background service (daemon) that builds images and runs containers. [19] |
| **Dockerfile** | A text file of instructions for building an image. [20] |
| **.dockerignore** | A file listing paths to leave out of the build context. [20] |
| **Draft pull request** | A PR shared for early feedback that can't be merged until it's marked ready. [11] |
| **Dual write** | Writing to a database and to Kafka as two separate steps, which can leave them inconsistent. [29] |
| **Dynamic config** | A topic setting changed at runtime with kafka-configs.sh, stored in the cluster's metadata. [26] |
| **Encryption at rest** | Encrypting objects in etcd so the stored data is unreadable without a key. [33] |
| **End offset (log-end offset)** | The offset the next event in a partition will get. [26] |
| **Endpoints / EndpointSlice** | The list of ready pod addresses a Service forwards to. [32] |
| **ENTRYPOINT** | The program a container runs; CMD then supplies its default arguments. [20] |
| **envFrom / valueFrom** | How a container's environment gets values from a ConfigMap or Secret. [33] |
| **Environment** | A named deployment target with its own protection rules and secrets. [17] |
| **Environment variable** | A named setting a container's process reads at run time. [22] |
| **Evaluation gate** | A CI step that fails when a model's quality score drops below a threshold. [18] |
| **Event** | Something that starts a workflow, such as a push or a pull request. [13, 25, 30] |
| **Exec form** | CMD ["node", "server.js"], a JSON list that runs the program directly. [20] |
| **Exit status** | The number a command returns when it ends: 0 for success, anything else for failure. [13] |
| **Expression** | Code between `${{` and `}}`, evaluated by GitHub before a step runs. [15] |
| **fail-fast** | Cancelling the rest of a matrix when one job fails (on by default). [15] |
| **Fast-forward** | A merge where the current branch has no new commits, so Git just moves it forward. [8] |
| **Feature branch** | A short-lived branch for one piece of work, merged when it's done. [7] |
| **Feature flag** | A setting that switches code on or off without deploying again. [12] |
| **Fetch** | Download new commits from a remote and update remote-tracking branches, without changing your branches. [9] |
| **Fix forward** | Correcting a failure with a new commit. [14] |
| **Flaky test** | A test that passes or fails on the same code by chance. [14] |
| **Force push** | Replace a remote branch with your version, even if that drops commits it had. [10] |
| **`--force-with-lease`** | A force push that refuses if the remote branch changed since you last fetched. [10] |
| **Fork** | Your own copy of someone else's repository on GitHub, used to propose changes to projects you can't push to. [12] |
| **Git** | The most widely used version control system; free, open source and distributed. [1] |
| **`git check-ignore -v`** | Shows which pattern in which file ignores a path. [4] |
| **`git config`** | Reads and sets Git's settings; `--global` settings apply to every repository on your computer. [1] |
| **GitHub** | A website that hosts Git repositories and adds pull requests, issues and automation; it isn't Git itself. [1] |
| **GitHub CLI (`gh`)** | GitHub's official command-line tool for repositories, pull requests, releases and more. [9] |
| **GitHub flow** | Short-lived branches merged into an always-deployable `main` through pull requests. [12] |
| **GitHub Pages** | GitHub's hosting for static websites, at `https://<owner>.github.io/<repository>/`. [17] |
| **GITHUB_TOKEN** | The short-lived token each job gets to use GitHub's API for its repository. [16, 24] |
| **`.gitignore`** | A file listing patterns for files Git should not track. [4] |
| **Git LFS (Large File Storage)** | An extension that stores large files outside the repository and keeps small pointers in it. [4] |
| **`git reset`** | Moves the current branch to another commit; `--soft`, `--mixed` and `--hard` decide what happens to the staging area and files. [5] |
| **`git restore`** | Puts a file back to the version in the staging area (or, with `--staged`, unstages it). [5] |
| **`git revert`** | Makes a new commit that undoes an earlier commit, keeping the history. [5] |
| **`git switch`** | Changes the current branch and updates your files to match it; `-c` creates the branch first. [7] |
| **Graceful shutdown** | Finishing work in progress and exiting cleanly on SIGTERM. [22, 29, 34] |
| **Hash** | A fixed-length fingerprint of data; Git uses SHA-1 now, and SHA-256 in new repositories from Git 3.0. [6] |
| **`hashFiles()`** | An expression function that returns a fingerprint of matching files. [18] |
| **`HEAD`** | The commit you're on now, usually the newest commit of the current branch. [3] |
| **Head branch / base branch** | The branch with the changes, and the branch it should merge into. [11] |
| **`HEAD~n`** | The commit n steps back from `HEAD` along first parents. [3] |
| **Health check** | A command Docker runs inside a container to see if the app works. [22] |
| **Here-document** | Several lines of text given to a command, written between `<<'EOF'` and a line holding only `EOF`. [1] |
| **HorizontalPodAutoscaler (HPA)** | An object that changes a Deployment's replicas based on a metric, such as CPU use. [34] |
| **Hunk** | One block of changes in a diff, starting with a header such as `@@ -1,3 +1,4 @@`. [3] |
| **Idempotent consumer** | A consumer that can safely see the same event twice. [27] |
| **Idempotent producer** | A producer whose retries can't create duplicates or reorder events. [28] |
| **Image** | A read-only package of a program and everything it needs to run, built from layers. [19] |
| **Ingress** | Routes outside traffic by host name and path to Services. [32] |
| **In-sync replicas (ISR)** | The copies fully caught up with the leader; only they can become leader. [28] |
| **Interactive rebase** | `git rebase -i`, which lets you reword, squash, reorder or drop your recent commits. [10] |
| **Interpolation** | Filling ${VAR} in compose.yaml from the environment or .env. [23] |
| **Job** | A set of steps that run in order on one runner. [13] |
| **Job output** | A value a job exposes to the jobs that need it. [15] |
| **Key** | The part of an event that picks its partition; events with the same key stay in order. [26] |
| **KRaft** | Kafka's built-in consensus protocol for managing the cluster, which replaced ZooKeeper. [25] |
| **kubeconfig and context** | The file (~/.kube/config) with cluster addresses and credentials, and the named pairing of a cluster with a user and namespace. [30] |
| **kubelet** | The agent on each node that starts and watches the node's pods. [30] |
| **Kubernetes** | A system that runs containers across machines and keeps them matching the objects you declare. [30] |
| **Label selector** | A rule that matches objects by their labels, such as app=shop; used by Deployments, ReplicaSets and Services. [31] |
| **Lag** | Log-end offset minus committed offset: events written but not yet processed by a group. [27] |
| **Layer** | One set of file changes in an image; images share the layers they have in common. [19] |
| **Leader / follower** | The copy clients use / a copy that fetches from the leader to keep up. [28] |
| **Least privilege** | Giving a token or person only the permissions they need. [16] |
| **Listener** | A name, protocol and port a broker accepts connections on. [29] |
| **Liveness probe** | A check that restarts a container when it fails. [34] |
| **LoadBalancer** | A Service type that asks the cloud for an external load balancer. [32] |
| **Manifest** | A YAML file describing an object, applied with kubectl apply. [30] |
| **Masking** | Replacing a secret's value with `***` in logs. [16] |
| **Matrix** | A set of values that runs a job once per combination. [15] |
| **maxSurge / maxUnavailable** | How many extra pods may run, and how many may be unavailable, during an update. [31] |
| **Merge** | Combining the work of another branch into the current one. [8] |
| **Merge base** | The last commit two branches have in common. [8] |
| **Merge commit** | A commit with two parents that joins two lines of history. [8] |
| **Merge conflict** | Both branches changed the same lines differently; Git stops and asks you to decide. [8] |
| **Merge ref** | `refs/pull/N/merge`, the test merge of a pull request into its base that `pull_request` runs test. [14] |
| **min.insync.replicas** | The fewest in-sync copies an acks=all write needs; below it, writes are refused. [28] |
| **Multi-platform image** | One name with variants for several CPU architectures, such as amd64 and arm64. [24] |
| **Multi-stage build** | A Dockerfile with several FROM stages, where the final stage copies results from earlier ones. [21] |
| **Namespace** | A group of objects inside a cluster; the default is `default`. [30] |
| **`needs:`** | A job setting that makes the job wait for other jobs, and skips it if they fail. [15] |
| **Negation (`!`)** | A pattern that re-includes something an earlier pattern ignored. [4] |
| **Node** | A machine (or kind container) that runs pods; it has a kubelet and a container runtime. [30] |
| **NodePort** | A Service port opened on every node, from 30000 to 32767 by default. [32] |
| **Non-root user** | Running the container's process as an ordinary user (USER node) instead of root. [21] |
| **Object** | A piece of data Git stores under its hash: a blob, tree, commit or tag. [6] |
| **Offset** | An event's position in its partition, counting from 0. [25] |
| **OIDC (OpenID Connect)** | A standard for short-lived identity tokens; clouds accept a job's OIDC token instead of a stored key. [16] |
| **`origin`** | The conventional name for the main remote; `git clone` sets it up. [9] |
| **Outbox pattern** | Saving events in the same database transaction as the data, then publishing them from there. [29] |
| **Packfile** | A compressed file holding many objects, with similar objects stored as deltas. [6] |
| **Partition** | One ordered log of a topic; a topic is split into partitions spread over brokers. [25] |
| **Partitioner** | The producer code that chooses a partition: murmur2(key) modulo the partition count by default. [26] |
| **Path filter** | `paths` or `paths-ignore` in a trigger, which skips runs that don't touch matching files. [18] |
| **Pattern** | A name with wildcards: `*` matches anything except `/`, `**` matches any number of folders. [4] |
| **Personal access token (classic)** | A GitHub token with scopes, which ghcr.io accepts as a password. [24] |
| **PID 1** | The first process in a container, its main process; signals have no default effect on it. [22] |
| **Pinning** | Referring to an exact, unchangeable version, such as a full commit SHA. [16] |
| **Pipeline** | The automated sequence of steps (build, test, deploy) a change goes through. [13] |
| **Pod** | The smallest unit Kubernetes runs: one or more containers sharing a network address and storage. [30] |
| **Pod template** | The pod spec inside a Deployment or ReplicaSet, from which the pods are created. [31] |
| **Pod-template-hash** | A label derived from the pod template, so each version gets its own ReplicaSet. [31] |
| **port and targetPort** | The Service's port that callers use, and the container port it forwards to. [32] |
| **port-forward** | A development tunnel from a local port to a Service or pod. [32] |
| **Producer / consumer** | A program that writes events / reads them. [25] |
| **Project** | A Compose app; its name (the folder by default) prefixes containers, networks and volumes. [23] |
| **Protection rule** | A condition a job must meet before deploying to an environment, such as a reviewer's approval. [17] |
| **Provenance attestation** | A record of how and where an image was built, attached to it. [24] |
| **Publish a port** | Connect a port on the host to a port in a container (-p host:container). [19] |
| **Pull** | Fetch, then integrate the remote branch into your current branch (by merging or rebasing). [9, 24] |
| **Pull request (PR)** | A proposal to merge one branch into another, with a place for review, discussion and automated checks. [11] |
| **Push** | Send your commits to a remote branch. [9, 24] |
| **RBAC** | Role-based access control: who may read, change or delete which objects. [33] |
| **Readiness probe** | A check that decides whether a pod receives Service traffic. [34] |
| **Rebalance** | Moving partitions between a group's members when one joins or leaves. [27] |
| **Rebase** | Replay a branch's commits on top of another commit, creating new commits with new ids. [10] |
| **Rebase and merge** | Merging a PR by replaying each of its commits onto the base branch. [11] |
| **Red / green build** | A failed / passed run. [14] |
| **Redirection** | Sending a command's output into a file: `>` replaces the file, `>>` adds to the end. [1] |
| **Ref** | A name that points to a commit, such as `refs/heads/main`, stored as a small file. [6] |
| **Reflog** | Git's local log of where `HEAD` and each branch have been, used to find "lost" commits. [5] |
| **Registry** | A server that stores and serves images, such as Docker Hub or ghcr.io. [19] |
| **Release** | A GitHub page for a tag, with notes and downloadable files. [12] |
| **Remote** | A named link to another copy of the repository, usually on GitHub. [9] |
| **Remote-tracking branch** | Your repository's record of a branch on a remote, such as `origin/main`; it moves only when you fetch, pull or push. [9] |
| **ReplicaSet** | An object that keeps exactly N pods matching its template running; each template version has its own. [31] |
| **Replication factor** | How many brokers keep a copy of each partition. [28] |
| **Repository (repo)** | A project folder whose history Git tracks; the history lives in its `.git` folder. [2] |
| **Required status check** | A check that must pass before a branch can be merged into (or pushed to) a protected branch. [14] |
| **Resource limit** | The most a container may use; over the memory limit it's killed (OOMKilled). [34] |
| **Resource request** | The amount the scheduler reserves for a container on a node. [34] |
| **Restart policy** | When Docker restarts a container whose process ended. [22] |
| **Retention** | How long a topic keeps events (7 days by default), however often they're read. [25] |
| **Reusable workflow** | A workflow triggered by `workflow_call`, used as a job by other workflows. [18] |
| **Reviewer** | A person asked to read the changes and comment, approve or request changes. [11] |
| **`rev:path`** | A file as it was in a given commit, such as `HEAD~2:prices.txt`. [3] |
| **Rewriting history** | Replacing commits with new ones (amend, reset, rebase); safe only for commits nobody else has. [5] |
| **Rollback** | Returning production to a previous good version. [17, 31] |
| **Rolling update** | Replacing pods gradually so some are always serving. [31] |
| **Root commit** | The first commit in a repository, the only one with no parent. [2] |
| **Rotating a secret** | Replacing it with a new one and disabling the old one. [4] |
| **Ruleset** | A set of rules GitHub enforces on matching branches or tags, such as requiring pull requests. [12] |
| **Run** | One execution of a workflow, with an ID. [13] |
| **Runner** | The machine, usually a fresh virtual machine, that runs a job. [13] |
| **SBOM** | A software bill of materials, the list of packages inside an image. [21] |
| **Schema registry** | A service that stores event schemas and rejects incompatible changes. [29] |
| **Script injection** | Untrusted text ending up inside a script and running as code. [16] |
| **Secret** | A password, API key or token that gives access to something. [4, 16, 33] |
| **Secret scanning** | A service that finds secrets in code; push protection blocks a push that contains one. [4] |
| **Segment** | One of the files a partition is stored in; retention deletes whole segments. [26] |
| **Self-hosted runner** | Your own machine running GitHub's runner program. [18] |
| **Semantic Versioning (SemVer)** | `MAJOR.MINOR.PATCH` version numbers that say whether a release breaks, adds or fixes. [12] |
| **Semantic version tags** | 1.2.0, 1.2 and 1 tags computed from a Git tag v1.2.0. [24] |
| **Service** | One container definition in a Compose file. [23, 32] |
| **Service discovery** | Finding another service by its name on the project network. [23] |
| **Share group** | A group (production-ready since Kafka 4.2) where members share partitions and acknowledge events one by one, like a work queue. [27] |
| **Shell form** | CMD node server.js, which runs the command through /bin/sh -c. [20] |
| **Short id** | The first few characters of a commit id, enough to name it while it's unique. [3] |
| **SIGKILL** | The signal that ends a process immediately; exit code 137. [22] |
| **SIGTERM** | The signal docker stop sends to ask a process to finish. [22] |
| **Smoke test** | A quick check that a deployment basically works, such as fetching its home page. [17] |
| **Squash and merge** | Merging a PR as one new commit containing all its changes. [11] |
| **Stage** | The part of a Dockerfile from one FROM to the next; AS gives it a name. [21] |
| **Staging area (index)** | The list of changes that will go into the next commit. [2] |
| **Startup probe** | A check that holds off liveness and readiness until a slow start has finished. [34] |
| **Stash** | A saved set of uncommitted changes, kept aside so you can switch with a clean working tree. [7] |
| **Status function** | `success()`, `failure()`, `always()` or `cancelled()` in an `if:`. [15] |
| **Step** | One shell command (`run:`) or one action (`uses:`) in a job. [13] |
| **Step output** | A value a step writes to `$GITHUB_OUTPUT`, read as `steps.<id>.outputs.<name>`. [15] |
| **Sticky partitioner** | The Java producer's way of sending keyless events: fill a batch for one partition, then switch. [26] |
| **Supply-chain attack** | An attack through software you depend on, such as a compromised action. [16] |
| **Symbolic ref** | A ref that points to another ref; `HEAD` usually holds `ref: refs/heads/main`. [6] |
| **Tag** | A movable name for an image version, like 24-alpine. [19] |
| **Terminal** | A window where you type commands as text; the program inside it that runs them is the **shell**. [1] |
| **Tombstone** | An event with a key and a null value, which deletes the key from a compacted topic. [26] |
| **Topic** | A named, append-only stream of events, such as orders. [25] |
| **Tracked file** | A file that's in the last commit or the staging area. [2] |
| **Transaction** | Writes to several partitions (and offset commits) that become visible all together or not at all. [28] |
| **Tree** | An object listing names, modes and the ids of blobs and other trees: a folder. [6] |
| **Trigger** | The event (with filters) that starts a workflow, set in `on:`. [14] |
| **Trunk-based development** | Everyone merges small changes into `main` at least daily, hiding unfinished work behind feature flags. [12] |
| **Under-replicated partition** | A partition with fewer in-sync replicas than replicas. [28] |
| **Unified diff** | The standard diff format: `-` for removed lines, `+` for added lines, and some unchanged lines around them. [3] |
| **Untracked file** | A file in the folder that Git has never been told to track. [2] |
| **Upstream** | The remote branch a local branch is paired with, used by plain `git push`, `git pull` and `git status`. [9] |
| **Version control** | A system that records every saved version of a project, who made it and why, so you can compare, undo and work together. [1] |
| **Volume** | Storage managed by Docker that outlives containers, mounted at a path. [22] |
| **Volume mount** | A ConfigMap or Secret made available as files at a path inside the container. [33] |
| **Workflow** | An automated process defined in a YAML file in `.github/workflows/`. [13] |
| **Workflow command** | A line starting with `::` that a step prints to talk to the runner. [15] |
| **workflow_dispatch** | The event for starting a workflow by hand, with optional inputs. [17] |
| **Working directory (current folder)** | The folder your commands act on; `pwd` prints it. [1] |
| **Working tree** | The files you see and edit. [2] |
| **YAML** | A text format for nested data that uses indentation for structure. [13] |
