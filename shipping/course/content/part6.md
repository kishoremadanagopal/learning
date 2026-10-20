@@@ part
id: 6
title: Kubernetes Basics
level: Intermediate
blurb: Running containers on a cluster: pods, deployments and rolling updates, services that find pods by label, configuration and secrets, and scaling with health checks. A pretend Kubernetes 1.37 runs in the sandbox on kind (Kubernetes in Docker), with the real kubectl commands and their output.

@@@ lesson
id: k8s-first-cluster
title: Clusters, nodes and pods
minutes: 30
summary: What Kubernetes does and why, the control plane and worker nodes, creating a local cluster with kind, kubectl contexts and kubeconfig, system pods, loading a local image into the cluster, writing a Pod manifest in YAML, kubectl apply, get, describe, logs and delete, pod phases and common errors, and why a bare pod doesn't come back after it's deleted.
---
You've packed the shop into an image and run it on one machine with Docker Compose. That works until the shop must run on many machines, restart itself when a process crashes, survive a machine failing, and roll out a new version without downtime. **Kubernetes** does that job: you describe what should be running, and it keeps the cluster matching that description.

You don't tell Kubernetes *how* to start a container on a particular machine. You tell it *what* you want ("three copies of the shop, reachable on port 80"), and control loops work out the rest, all the time, for as long as the cluster runs.

### Control plane and nodes

A cluster has two kinds of machines:

| Part | What it does |
|---|---|
| **control plane** | the API server (the only thing that talks to storage), **etcd** (the database holding every object), the **scheduler** (picks a node for each new pod), and the **controller manager** (the loops that keep reality matching the objects) |
| **nodes** (workers) | run your containers. Each has a **kubelet** (the agent that starts and watches pods), a container runtime (containerd) and networking |

Everything goes through the API server: `kubectl`, the controllers, the kubelets. You never change a container directly; you change an object, and the control loops act on it.

### A local cluster with kind

**kind** (Kubernetes IN Docker) runs each node of a cluster as a Docker container, which is how this course can run a real cluster in the sandbox. On your own computer it needs Docker (or Podman, Rancher Desktop, OrbStack) and works the same way.

```sh setup=docker-shop-built
kind version
kind create cluster
kubectl get nodes
kubectl get pods -A
```

`kind create cluster` writes the cluster's connection details into `~/.kube/config` (the **kubeconfig**) and makes it the current **context**, `kind-kind`. `kubectl` uses the current context unless you pass `--context`. `kubectl get nodes` shows the one node, `kind-control-plane`, and `kubectl get pods -A` the system pods of the control plane and networking, in namespaces such as `kube-system`.

```sh setup=k8s-cluster
kubectl config current-context
kubectl cluster-info
kubectl config get-contexts
```

A **namespace** groups objects inside a cluster. Most of this course uses `default`; `-A` (`--all-namespaces`) lists every namespace and `-n kube-system` picks one.

### Images in the cluster

The cluster's nodes have their own image storage: they don't see the images on your computer. A real cluster pulls images from a registry such as ghcr.io (Part 4). Locally, `kind load` copies an image from Docker into every node:

```sh setup=k8s-cluster
kind load docker-image shop:1.0
```

### A pod

A **pod** is the smallest unit Kubernetes runs: one or more containers that share a network address and storage. Almost always one container per pod. You describe a pod in a YAML **manifest**:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: shop-pod
  labels:
    app: shop
spec:
  containers:
    - name: shop
      image: shop:1.0
      ports:
        - containerPort: 3000
```

- `apiVersion` and `kind` say which type of object this is.
- `metadata.name` is the object's name, unique within its kind and namespace; `labels` are key–value tags you use to select objects later (lesson 32).
- `spec` is what you want: here, one container from `shop:1.0`. `containerPort` documents the port the process listens on; it doesn't publish it.

Write the manifest to a file and apply it. `kubectl apply` creates the object, or updates it if it already exists:

```sh setup=k8s-shop-loaded
cd ~/shop
cat > pod.yaml <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: shop-pod
  labels:
    app: shop
spec:
  containers:
    - name: shop
      image: shop:1.0
      ports:
        - containerPort: 3000
EOF
kubectl apply -f pod.yaml
kubectl get pods
```

### Looking at a pod

```sh setup=k8s-pod
kubectl get pods -o wide
kubectl describe pod shop-pod
kubectl logs shop-pod
```

- `get pods` shows READY (containers ready out of total), STATUS, RESTARTS and AGE; `-o wide` adds the pod's IP and node.
- `describe` prints everything about the pod, including its **events** at the bottom: the scheduler's choice of node, the image pull, each container start. When something's wrong, the events say why.
- `logs` prints what the container wrote to standard output, like `docker logs`.

Pod phases you'll see: `Pending` (waiting for a node or an image), `ContainerCreating` (pulling and starting), `Running`, `Completed` (finished successfully, for jobs), and `Error` or `CrashLoopBackOff` (the container failed and is restarted with growing delays). A missing image shows up as `ErrImagePull` and then `ImagePullBackOff`:

```sh setup=k8s-pod
kubectl run broken --image=shop:9.9
kubectl get pods broken
kubectl describe pod broken | tail -4
kubectl delete pod broken
```

### A bare pod doesn't come back

```sh setup=k8s-pod
kubectl delete pod shop-pod
kubectl get pods
```

Nothing recreates it. A pod is not self-healing on its own: if its node fails or it's deleted, it's gone. Lesson 31 introduces the object that keeps pods alive: the **Deployment**.

### Run a one-off command

`kubectl run` creates a pod from the command line. With `--restart=Never` it runs once and stops; `--rm -i` removes it when the command ends:

```sh setup=k8s-shop-loaded
kubectl run hello --image=busybox:1.37 --restart=Never -- echo "hi from the cluster"
kubectl logs hello
kubectl delete pod hello
```

### Try it on your own computer

- Install kind from [kind.sigs.k8s.io](https://kind.sigs.k8s.io/docs/user/quick-start/) and kubectl from [kubernetes.io](https://kubernetes.io/docs/tasks/tools/). Docker must be running.
- Docker Desktop can also run a single-node cluster: turn on Kubernetes in its settings. Use `kubectl config use-context docker-desktop` to switch to it.
- `kubectl explain pod.spec.containers` documents every field, straight from the cluster's API.

:::exercise Run the shop as a pod
The shop image is loaded into the cluster. Write a manifest `~/shop/pod.yaml` for a pod named `shop-pod` that runs `shop:1.0`, apply it, and check that the pod is running.
```sh starter setup=k8s-shop-loaded
cd ~/shop
ls
```
```js check
const k = k8s();
if (!k) throw new AssertionError("There's no cluster yet: kind create cluster.");
const p = k.pods("", "default").find((x) => x.name === "shop-pod");
if (!p) throw new AssertionError("There's no pod named shop-pod in the default namespace. Write the manifest and run kubectl apply -f pod.yaml.");
same(p.image, "shop:1.0", "The pod's image");
same(p.phase, "Running", "The pod's phase");
if (!ran(/kubectl apply\b/)) throw new AssertionError("Create the pod with kubectl apply -f pod.yaml.");
```
```sh solution setup=k8s-shop-loaded
cd ~/shop
cat > pod.yaml <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: shop-pod
  labels:
    app: shop
spec:
  containers:
    - name: shop
      image: shop:1.0
      ports:
        - containerPort: 3000
EOF
kubectl apply -f pod.yaml
kubectl get pods
```
hint: A pod manifest needs `apiVersion: v1`, `kind: Pod`, a `metadata.name` and a `spec.containers` list with a `name` and an `image`.
hint: Save the manifest as `pod.yaml` with `cat > pod.yaml <<'EOF'` … `EOF`, then `kubectl apply -f pod.yaml`.
hint: Use the image `shop:1.0`, the one `kind load` copied into the cluster.
approach:
1. **Understand:** a pod is described by a manifest, and `kubectl apply` makes the cluster match it.
2. **Examples:** the lesson's `pod.yaml` runs `shop:1.0` as `shop-pod`.
3. **Brute force:** `kubectl run shop-pod --image=shop:1.0` also works, but it can't be reviewed or kept in Git.
4. **Pattern:** **manifest → kubectl apply -f → kubectl get pods**.
5. **Plan:** write the manifest, apply it, check the phase.
6. **Code and test:** `pod/shop-pod created`, then `shop-pod   1/1   Running`.
walkthrough:
**Line by line**

- `apiVersion: v1` and `kind: Pod` say which object to create.
- `metadata.name: shop-pod` is its name; `labels` are optional here but useful later.
- `containers` lists one container: `name` for the container, `image` for what to run.
- `kubectl apply -f pod.yaml` creates the pod; `get pods` shows it is `Running`.

**Trace:** `pod/shop-pod created`, then `shop-pod   1/1   Running   0   …`.

**Common wrong approach:** writing the manifest with a tab indent. YAML forbids tabs; use spaces.
:::

:::exercise A one-off pod
Run a pod named `greeting` from `busybox:1.37` that prints `hello from kubernetes`, then read its logs.
```sh starter setup=k8s-shop-loaded
kubectl get pods
```
```js check
const k = k8s();
const logs = k.logs("greeting");
if (logs === null) throw new AssertionError("There's no pod named greeting, or it was deleted before you could check. Start it with kubectl run greeting --image=busybox:1.37 --restart=Never -- echo …");
if (!/hello from kubernetes/.test(logs)) throw new AssertionError(`The logs don't show the greeting. They say: ${JSON.stringify(logs.trim())}`);
if (!ran(/kubectl logs\b.*greeting/)) throw new AssertionError("Read the output with kubectl logs greeting.");
```
```sh solution setup=k8s-shop-loaded
kubectl run greeting --image=busybox:1.37 --restart=Never -- echo "hello from kubernetes"
kubectl logs greeting
```
hint: `kubectl run NAME --image=IMAGE --restart=Never -- COMMAND` runs a command once in a new pod.
hint: The command after `--` is `echo "hello from kubernetes"`.
hint: `kubectl logs greeting` prints what the container wrote.
approach:
1. **Understand:** a pod with `--restart=Never` runs its command once, and its output stays in the logs until the pod is deleted.
2. **Examples:** the lesson ran `hello` with `echo "hi from the cluster"`.
3. **Brute force:** `kubectl run` without `--restart=Never` would keep restarting the command.
4. **Pattern:** **kubectl run NAME --image=… --restart=Never -- COMMAND**, then **kubectl logs**.
5. **Plan:** run, read the logs, delete.
6. **Code and test:** `kubectl logs greeting` prints `hello from kubernetes`.
walkthrough:
**Line by line**

- `kubectl run greeting --image=busybox:1.37 --restart=Never -- echo "hello from kubernetes"` creates a pod whose one container runs `echo`.
- `kubectl logs greeting` prints the container's output.

**Trace:** `hello from kubernetes`.

**Common wrong approach:** leaving out `--restart=Never`. The pod then runs the command, exits, and is restarted over and over (CrashLoopBackOff is for failures; for a finished command the phase is Completed when the restart policy is Never).
:::

:::quiz
? What does a control loop in Kubernetes do?
+ It compares the objects you declared with what's running and acts to close the gap
- It runs your containers once and then stops
- It copies images from your computer into the cluster
- It deletes pods that have been running for too long
= Controllers run all the time, so the cluster keeps converging on the declared state.
? Why does kind load docker-image exist?
+ Cluster nodes have their own image storage and can't see the images on your computer
- Kubernetes can't run images that were built with Docker
- It makes containers start faster
- It's required for every kubectl command
= Real clusters pull images from a registry; locally, kind copies them into the nodes.
? A pod you created directly is deleted. What happens?
+ Nothing: a bare pod isn't recreated, so it stays deleted
- Kubernetes recreates it at once with the same name
- It moves to another node
- It's restarted after 5 minutes
= Controllers such as Deployments are what keep pods alive.
? Which is the smallest unit Kubernetes runs?
+ A pod, which holds one or more containers that share a network address
- A container
- A node
- A deployment
= Pods share network and storage; most pods hold one container.
:::

@@@ lesson
id: k8s-deployments
title: Deployments and rolling updates
minutes: 30
summary: Why pods are created by controllers, Deployments, ReplicaSets and pod templates, labels and selectors, the pod-template-hash, self-healing when a pod is deleted, scaling with kubectl scale, rolling updates with kubectl set image and rollout status, maxSurge and maxUnavailable, rollout history and undo, kubectl create deployment --dry-run=client -o yaml, and declarative updates with apply.
---
A Deployment keeps a set number of identical pods running, and it updates them to a new version without downtime. You never create its pods yourself: you declare how many you want and which image they run, and the Deployment's controllers do the rest.

![Deployment shop owns ReplicaSet shop-64f8dc496f, which owns three pods with the labels app=shop and pod-template-hash=64f8dc496f. When a pod is deleted, the ReplicaSet notices there are two instead of three and creates a new one. During a rolling update, a second ReplicaSet with a different hash scales up as the old one scales down](figures/k8s-deployment.svg)

Three objects make up a Deployment:

| Object | Job |
|---|---|
| **Deployment** | what you declare: the number of replicas, the pod template, the update strategy; it manages ReplicaSets |
| **ReplicaSet** | keeps exactly N pods matching a template running; one ReplicaSet per version of the template |
| **Pod** | the running containers, created from the template |

### Creating one

```sh setup=k8s-shop-loaded
kubectl create deployment shop --image=shop:1.0 --replicas=3
kubectl rollout status deployment/shop
kubectl get deployments,replicasets,pods
```

`rollout status` waits until the new pods are ready. The ReplicaSet's name is the Deployment's name plus a **pod-template-hash**, a hash of the pod template: when the template changes, the hash changes, and a new ReplicaSet is made for it. The pods' names add a random suffix.

Labels link the objects. The Deployment selects pods with `app=shop`; the ReplicaSet does too, plus its own hash label:

```sh setup=k8s-deployment
kubectl get pods --show-labels
kubectl get pods -l app=shop
```

`-l` (`--selector`) filters by label: you'll use the same syntax for Services (lesson 32).

### Self-healing

```sh setup=k8s-deployment
kubectl delete $(kubectl get pods -o name | head -1)
kubectl get pods
```

The ReplicaSet saw two pods instead of three and made a new one. Deleting a pod is how you'd restart a broken pod: the Deployment replaces it. Deleting a node does the same thing: its pods are recreated on the other nodes.

### Scaling

```sh setup=k8s-deployment
kubectl scale deployment shop --replicas=5
kubectl get pods
kubectl scale deployment shop --replicas=2
kubectl get pods
```

Scaling down removes pods; which ones is the ReplicaSet's choice (the youngest, or those on busy nodes).

### Rolling updates

Change the image and the Deployment replaces the pods gradually, so some are always serving:

```sh setup=k8s-deployment-v2
kubectl set image deployment/shop shop=shop:2.0
kubectl rollout status deployment/shop
kubectl get replicasets
```

The old ReplicaSet is kept, scaled to zero, so you can go back. Two settings in the Deployment's `strategy` control the pace:

- `maxSurge` (default 25%): how many extra pods may exist during the update (new ones starting before old ones stop).
- `maxUnavailable` (default 25%): how many pods may be unavailable at once.

With 3 replicas and the defaults, Kubernetes starts one new pod, waits for it to be ready, then stops one old pod, and so on.

```yaml
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0      # never fewer than 3 ready pods
```

### History and rollback

```sh setup=k8s-deployment-v2
kubectl set image deployment/shop shop=shop:2.0
kubectl rollout status deployment/shop > /dev/null
kubectl rollout history deployment/shop
kubectl rollout undo deployment/shop
kubectl rollout status deployment/shop
kubectl get deployment shop -o jsonpath='{.spec.template.spec.containers[0].image}'
```

`rollout undo` goes back to the previous ReplicaSet's template. The history lists each revision; its CHANGE-CAUSE column is empty unless you annotate the Deployment with `kubernetes.io/change-cause` (the old `--record` flag is deprecated).

### Declarative updates

`kubectl create` and `set image` change the cluster directly; the manifest in Git doesn't change. The usual way is a manifest file and `apply`, so the file is the truth:

```sh setup=k8s-shop-loaded
kubectl create deployment shop --image=shop:1.0 --replicas=3 --dry-run=client -o yaml > deployment.yaml
kubectl apply -f deployment.yaml
kubectl get deployment shop
```

`--dry-run=client -o yaml` prints the object the command would create, without creating it: a quick way to start a manifest. Edit the file, and `kubectl apply -f deployment.yaml` makes the cluster match it.

### Try it on your own computer

- `kubectl rollout restart deployment/shop` replaces every pod with the same image: useful after a configuration change (lesson 33).
- `kubectl diff -f deployment.yaml` shows what an apply would change before you run it.
- Argo CD and Flux keep a cluster matching a Git repository; that's the next step once manifests live in Git.

:::exercise Three copies of the shop
Create a Deployment named `shop` that runs `shop:1.0` with 3 replicas, and wait for the rollout to finish.
```sh starter setup=k8s-shop-loaded
kubectl get deployments
```
```js check
const k = k8s();
const d = k.get("deployments", "shop");
if (!d) throw new AssertionError("There's no deployment named shop yet: kubectl create deployment shop --image=shop:1.0 --replicas=3.");
same(d.spec.replicas, 3, "The number of replicas");
same(d.spec.template.spec.containers[0].image, "shop:1.0", "The image");
const ready = k.pods("app=shop").filter((p) => p.ready && !p.terminating);
same(ready.length, 3, "The number of ready shop pods");
```
```sh solution setup=k8s-shop-loaded
kubectl create deployment shop --image=shop:1.0 --replicas=3
kubectl rollout status deployment/shop
kubectl get deployments
```
hint: `kubectl create deployment NAME --image=IMAGE --replicas=N` creates the deployment and its pods.
hint: `kubectl rollout status deployment/shop` waits until all three pods are ready.
hint: The command is `kubectl create deployment shop --image=shop:1.0 --replicas=3`.
approach:
1. **Understand:** a Deployment's replicas field is the number of pods it keeps running.
2. **Examples:** the lesson created `shop` with 3 replicas.
3. **Brute force:** running three bare pods works, but nothing replaces them when they fail.
4. **Pattern:** **Deployment = image + replicas**, then wait with rollout status.
5. **Plan:** create the deployment, wait.
6. **Code and test:** `deployment "shop" successfully rolled out`, and 3/3 ready.
walkthrough:
**Line by line**

- `create deployment shop --image=shop:1.0` makes the Deployment with the pod template `shop:1.0`.
- `--replicas=3` asks the ReplicaSet for three pods.
- `rollout status` blocks until all three report ready.

**Trace:** `deployment.apps/shop created`, then `deployment "shop" successfully rolled out`.

**Common wrong approach:** creating a pod named shop-pod and calling it done (lesson 30): nothing keeps it running.
:::

:::exercise Roll out version 2
The cluster runs `shop` at `shop:1.0`, and `shop:2.0` is loaded too. Update the Deployment to `shop:2.0`, wait for the rollout, and check that every pod runs the new image.
```sh starter setup=k8s-deployment-v2
kubectl get deployment shop -o wide
```
```js check
const k = k8s();
const d = k.get("deployments", "shop");
if (!d) throw new AssertionError("The deployment shop is missing.");
same(d.spec.template.spec.containers[0].image, "shop:2.0", "The deployment's image");
const pods = k.pods("app=shop").filter((p) => !p.terminating);
same(pods.length, 3, "The number of shop pods");
for (const p of pods) same(p.image, "shop:2.0", `The image of ${p.name}`);
if (!ran(/kubectl (set image|rollout)\b|kubectl apply\b/)) throw new AssertionError("Update the image with kubectl set image deployment/shop shop=shop:2.0, then kubectl rollout status deployment/shop.");
```
```sh solution setup=k8s-deployment-v2
kubectl set image deployment/shop shop=shop:2.0
kubectl rollout status deployment/shop
kubectl get pods -l app=shop
```
hint: `kubectl set image deployment/NAME CONTAINER=IMAGE` changes the image; the container is named `shop`.
hint: After the change, `kubectl rollout status deployment/shop` waits until the new pods are ready.
hint: `kubectl set image deployment/shop shop=shop:2.0`, then `kubectl rollout status deployment/shop`.
approach:
1. **Understand:** changing a pod template's image starts a rolling update.
2. **Examples:** the lesson ran `kubectl set image deployment/shop shop=shop:2.0`.
3. **Brute force:** deleting the deployment and creating it again would drop every pod at once.
4. **Pattern:** **set image → rollout status**.
5. **Plan:** set the image, wait.
6. **Code and test:** `deployment "shop" successfully rolled out` and three pods with `shop:2.0`.
walkthrough:
**Line by line**

- `set image deployment/shop shop=shop:2.0` changes the image of the container named `shop`.
- The Deployment creates a new ReplicaSet with a new template hash and scales it up while the old one scales down.
- `rollout status` waits until the update is complete.

**Trace:** the pods' names change (new hash), and all three run `shop:2.0`.

**Common wrong approach:** `kubectl delete deployment shop` and recreating it. That's a full outage while it restarts.
:::

:::quiz
? What does the pod-template-hash label identify?
+ The version of the pod template: a changed template gets a new ReplicaSet with a new hash
- The node a pod runs on
- The number of replicas
- The pod's IP address
= Each template version has its own ReplicaSet, which is how rollbacks work.
? You delete one of three shop pods. What happens?
+ The ReplicaSet notices there are two and creates a replacement
- Nothing: the other two keep serving forever
- The Deployment is deleted
- The pod is restarted with the same name
= A ReplicaSet keeps the number of matching pods at the declared count.
? What does maxUnavailable: 0 with maxSurge: 1 guarantee during an update?
+ Never fewer than the declared number of ready pods, at the cost of briefly running one extra
- The update completes in one step
- No pods are ever restarted
- The image is pulled before the update
= Kubernetes starts a new pod, waits for it to be ready, then stops an old one.
? Which command goes back to the previous version of a Deployment?
+ kubectl rollout undo deployment/NAME
- kubectl delete deployment NAME
- kubectl scale deployment NAME --replicas=0
- kubectl apply --rollback
= Rollouts keep the old ReplicaSets, so undo just switches back to the previous template.
:::

@@@ lesson
id: k8s-services
title: Services and networking
minutes: 30
summary: Why pod IPs aren't stable, Services and label selectors, ClusterIP addresses, cluster DNS names (short names, namespaces and svc.cluster.local), kubectl expose and the Service's ports (port, targetPort), endpoints and EndpointSlices, load balancing across ready pods, testing from a temporary pod, kubectl port-forward to reach a service from your computer, NodePort and LoadBalancer, and Ingress.
---
Pods come and go, and each new pod gets a new IP address. The shop's frontend can't keep track of those addresses. A **Service** gives a set of pods one stable name and address, and sends traffic to whichever pods are ready.

![A Service named shop with cluster IP 10.96.143.166 and port 80 selects pods labelled app=shop. Traffic to shop:80 is forwarded to port 3000 of the ready pods, which have IPs 10.244.0.5, 10.244.0.7 and 10.244.0.9. A pod that is not ready is left out of the list of endpoints](figures/k8s-service.svg)

A Service has:

- a **selector**: the labels of the pods it sends traffic to (here `app=shop`);
- a **port** (what callers connect to, 80) and a **targetPort** (the port the container listens on, 3000);
- a **type**, which decides how it's reachable.

### Creating one

```sh setup=k8s-deployment
kubectl expose deployment shop --port=80 --target-port=3000
kubectl get service shop
kubectl get endpointslices -l kubernetes.io/service-name=shop
```

`kubectl expose` writes a Service that selects the deployment's pods. `CLUSTER-IP` is a virtual address, reachable from inside the cluster only. The **endpoints** (EndpointSlice) list the pod IPs that are ready: a pod that fails its readiness check is removed from the list, and returns when it recovers (lesson 34).

### Names inside the cluster

Cluster DNS gives each Service a name. From a pod in the same namespace, `shop` is enough; the full name is `shop.default.svc.cluster.local`. A temporary pod shows it:

```sh setup=k8s-service
kubectl run tester --image=busybox:1.37 --restart=Never --rm -i -- wget -qO- http://shop
kubectl run tester --image=busybox:1.37 --restart=Never --rm -i -- wget -qO- http://shop.default.svc.cluster.local/health
```

`--rm -i` runs the command in a pod and deletes it afterwards. Each request goes to one of the ready pods, so you'd see different pods answer over time: read the shop's logs to see which:

```sh setup=k8s-service
for i in 1 2 3 4 5 6; do kubectl run tester$i --image=busybox:1.37 --restart=Never --rm -i -- wget -qO- http://shop/health > /dev/null; done
kubectl get pods -l app=shop
kubectl logs -l app=shop --prefix --tail=2
```

`--prefix` puts the pod name on each log line, so you can see which pods handled the requests. The load balancing is by connection, not by request, so a long-lived connection stays on one pod.

### Reaching it from your computer

A ClusterIP isn't reachable from outside the cluster. `port-forward` tunnels a local port to a Service or pod:

```bash
kubectl port-forward service/shop 8080:80
# Forwarding from 127.0.0.1:8080 -> 3000
# in another terminal: curl -s localhost:8080/health   (prints ok)
# Ctrl+C stops the tunnel
```

For development this is enough. For real traffic, three types of Service exist:

| Type | Reachable from |
|---|---|
| `ClusterIP` (default) | inside the cluster only |
| `NodePort` | every node's IP on a port from 30000 to 32767 |
| `LoadBalancer` | an external load balancer that the cloud provider creates (Part 7 uses one) |

An **Ingress** (or the newer Gateway API) sits in front of several Services and routes by host name and path: `shop.example.com` to the shop, `api.example.com` to the API.

### Try it on your own computer

- On Docker Desktop, `kubectl port-forward` works the same way; kind also supports `extraPortMappings` in its configuration file, to publish a NodePort on your computer.
- `kubectl get endpoints shop` (the older API, still printed) lists the same addresses.
- Each Service also gets an environment variable in its pods (`SHOP_SERVICE_HOST`, `SHOP_SERVICE_PORT`), a legacy way to find it that DNS has replaced.

:::exercise Give the shop a stable name
The Deployment `shop` runs three pods. Expose it as a Service named `shop-svc` on port 80, forwarding to the container's port 3000. Then check from a temporary pod that `http://shop-svc/` answers with the shop's welcome page.
```sh starter setup=k8s-deployment
kubectl get pods -l app=shop
```
```js check
const k = k8s();
const s = k.get("services", "shop-svc");
if (!s) throw new AssertionError("There's no Service named shop-svc yet: kubectl expose deployment shop --name=shop-svc --port=80 --target-port=3000.");
same(s.spec.ports[0].port, 80, "The Service's port");
same(s.spec.ports[0].targetPort, 3000, "The Service's targetPort");
const body = await k.request("http://shop-svc/");
if (!/Welcome to/.test(body)) throw new AssertionError(`The shop didn't answer through shop-svc: ${JSON.stringify(String(body).slice(0, 80))}`);
```
```sh solution setup=k8s-deployment
kubectl expose deployment shop --name=shop-svc --port=80 --target-port=3000
kubectl run tester --image=busybox:1.37 --restart=Never --rm -i -- wget -qO- http://shop-svc/
```
hint: `kubectl expose deployment shop --name=shop-svc --port=80 --target-port=3000` creates the Service.
hint: `--port` is what callers use (80); `--target-port` is the container's port (3000).
hint: Test with `kubectl run tester --image=busybox:1.37 --restart=Never --rm -i -- wget -qO- http://shop-svc/`.
approach:
1. **Understand:** a Service selects pods by label and forwards `port` to each pod's `targetPort`.
2. **Examples:** the lesson exposed `shop` on 80 → 3000.
3. **Brute force:** calling a pod's IP works only until that pod is replaced.
4. **Pattern:** **expose: name, port, target port; test by DNS name**.
5. **Plan:** expose, then test from inside the cluster.
6. **Code and test:** `service/shop-svc exposed`, and the welcome page answers.
walkthrough:
**Line by line**

- `expose deployment shop` selects the pods of that deployment, using their labels.
- `--name=shop-svc` names the Service (default: the deployment's name).
- `--port=80 --target-port=3000` maps the Service's port 80 to the containers' port 3000.
- `wget -qO- http://shop-svc/` resolves `shop-svc` through cluster DNS and prints the response.

**Trace:** `Welcome to the bike shop!` from one of the three pods.

**Common wrong approach:** `--target-port=80`. The shop listens on 3000, so the Service would send traffic to a closed port.
:::

:::quiz
? Why does a Service exist?
+ Pods get new IP addresses when they're replaced, so callers need a stable name that sends traffic to whichever pods are ready
- To run containers faster
- To store configuration
- To make pods run on the same node
= The selector finds pods by label; DNS gives the Service a name.
? A pod fails its readiness check. What happens to Service traffic?
+ The pod is removed from the endpoints, so no traffic goes to it until it's ready again
- The Service stops working for everyone
- The pod is deleted immediately
- Traffic is sent to it anyway
= Readiness decides whether a pod is in the endpoints.
? In expose --port=80 --target-port=3000, what is 3000?
+ The port the container listens on
- The port on your computer
- The Service's cluster IP
- The number of pods
= Callers use port 80; the Service forwards to 3000 on each pod.
? Which Service type makes a ClusterIP reachable from your computer during development?
+ None of them: kubectl port-forward tunnels a local port to it
- ClusterIP always works from the internet
- NodePort is required
- Ingress is required
= port-forward is a development tool; NodePort and LoadBalancer serve real traffic.
:::

@@@ lesson
id: k8s-config
title: Configuration and secrets
minutes: 30
summary: Keeping configuration out of the image, ConfigMaps and their use as environment variables (env with valueFrom, envFrom), creating ConfigMaps with kubectl create configmap and from files, Secrets and why base64 isn't encryption, creating secrets, reading them back with jsonpath and base64 -d, mounting configuration as files, and making pods pick up a changed ConfigMap with a rollout restart.
---
The shop reads `SHOP_NAME` from its environment. In Docker Compose you set it in the file (Part 4). In Kubernetes, the same values live in objects that can change without rebuilding the image: **ConfigMaps** for ordinary settings, **Secrets** for passwords and tokens.

### ConfigMaps

```sh setup=k8s-service
kubectl create configmap shop-config --from-literal=SHOP_NAME="the bike shop"
kubectl get configmap shop-config -o yaml
```

`--from-literal` adds one key; `--from-file` adds a file's content, which is how you ship a whole settings file. A ConfigMap holds plain text and is not encrypted.

A Deployment reads a ConfigMap into the container's environment:

```yaml
spec:
  template:
    spec:
      containers:
        - name: shop
          image: shop:2.0
          env:
            - name: SHOP_NAME
              valueFrom:
                configMapKeyRef:
                  name: shop-config
                  key: SHOP_NAME
```

`envFrom` imports every key at once:

```yaml
          envFrom:
            - configMapRef:
                name: shop-config
```

Changing a ConfigMap doesn't restart the pods: environment variables are read once, when a container starts. Make the pods pick it up with a rollout:

```sh setup=k8s-config-wired
kubectl create configmap shop-config --from-literal=SHOP_NAME="the cycle shop" --dry-run=client -o yaml | kubectl apply -f -
kubectl rollout restart deployment/shop
kubectl rollout status deployment/shop
kubectl exec deploy/shop -- printenv SHOP_NAME
```

`--dry-run=client -o yaml | kubectl apply -f -` is the way to update a ConfigMap in place. The first time, `apply` warns that the object was created without it; that's harmless, and from then on apply keeps track of the object. `rollout restart` replaces the pods one at a time, so they all start with the new value.

### Secrets

```sh setup=k8s-config-wired
kubectl create secret generic shop-secret --from-literal=ADMIN_TOKEN=s3cret-token-123
kubectl get secret shop-secret -o yaml
kubectl get secret shop-secret -o jsonpath='{.data.ADMIN_TOKEN}' | base64 -d; echo
```

Secret values are stored **base64-encoded**. That's an encoding, not encryption: anyone who can read the Secret can decode it, as the last command shows. What protects Secrets in practice is access control (RBAC, so only some people can read them), encryption at rest in etcd, and keeping the values out of Git. Tools such as External Secrets, Sealed Secrets and the cloud's secret stores sit on top of this.

A pod uses a Secret like a ConfigMap, with `secretKeyRef` or `secretRef`:

```yaml
          env:
            - name: ADMIN_TOKEN
              valueFrom:
                secretKeyRef:
                  name: shop-secret
                  key: ADMIN_TOKEN
```

### Files instead of variables

A ConfigMap can also appear as files in the container: each key becomes a file under the mount path, and updates eventually reach those files without a restart (though the app must reread them):

```yaml
          volumeMounts:
            - name: config
              mountPath: /app/config
      volumes:
        - name: config
          configMap:
            name: shop-config
```

### Try it on your own computer

- Keep the manifests in Git, and the secret values out of it: a placeholder in the file, the real value applied from a secure place.
- `kubectl create secret generic --from-env-file=.env` loads several secrets at once from a file that you never commit.
- Kustomize (built into kubectl as `kubectl apply -k`) adds per-environment values to shared manifests with `configMapGenerator` and `secretGenerator`.

:::exercise Name the shop from a ConfigMap
Create a ConfigMap named `shop-config` with `SHOP_NAME` set to `the cycle shop`, make the `shop` Deployment read it with `envFrom`, and restart the deployment so its pods pick up the value. Then check the environment of a pod.
```sh starter setup=k8s-service
kubectl get deployment shop -o yaml | grep -A3 env
```
```js check
const k = k8s();
const cm = k.get("configmaps", "shop-config");
if (!cm) throw new AssertionError("There's no ConfigMap shop-config yet: kubectl create configmap shop-config --from-literal=SHOP_NAME=\"the cycle shop\".");
same(cm.data.SHOP_NAME, "the cycle shop", "The ConfigMap's SHOP_NAME");
const d = k.get("deployments", "shop");
const refs = d.spec.template.spec.containers[0].envFrom ?? [];
if (!refs.some((r) => r.configMapRef && r.configMapRef.name === "shop-config")) throw new AssertionError("The deployment doesn't read shop-config with envFrom (configMapRef). Edit it with kubectl edit or apply a manifest.");
const pods = k.pods("app=shop").filter((p) => !p.terminating);
for (const p of pods) { const env = k.env(p.name); if (!env || env.SHOP_NAME !== "the cycle shop") throw new AssertionError(`${p.name} doesn't have SHOP_NAME set to "the cycle shop" yet: restart the deployment with kubectl rollout restart deployment/shop.`); }
const page = await k.request("http://shop/");
if (!/the cycle shop/.test(page)) throw new AssertionError(`The welcome page says: ${JSON.stringify(String(page).trim())}`);
```
```sh solution setup=k8s-service
kubectl create configmap shop-config --from-literal=SHOP_NAME="the cycle shop"
kubectl patch deployment shop --patch '{"spec":{"template":{"spec":{"containers":[{"name":"shop","envFrom":[{"configMapRef":{"name":"shop-config"}}]}]}}}}'
kubectl rollout status deployment/shop
kubectl exec deploy/shop -- printenv SHOP_NAME
```
hint: `kubectl create configmap shop-config --from-literal=SHOP_NAME="the cycle shop"` creates it.
hint: The deployment needs `envFrom` with a `configMapRef` pointing at `shop-config`; `kubectl patch` can add it.
hint: After changing the pod template, `kubectl rollout status deployment/shop` waits for new pods; `kubectl exec deploy/shop -- printenv SHOP_NAME` checks the value.
approach:
1. **Understand:** a container reads its environment when it starts, so a new value needs new pods.
2. **Examples:** the lesson used `envFrom` with a `configMapRef`, then `rollout restart`.
3. **Brute force:** editing the image to change a setting works but rebuilds the image for a config change.
4. **Pattern:** **ConfigMap → envFrom in the pod template → rollout**.
5. **Plan:** create, wire, roll out, check.
6. **Code and test:** `printenv` prints `the cycle shop`, and the welcome page says so too.
walkthrough:
**Line by line**

- `create configmap` stores `SHOP_NAME` as a key of the object.
- `patch` changes the Deployment's pod template: a template change starts a rollout, so the new pods read the ConfigMap when they start.
- `kubectl exec deploy/shop -- printenv SHOP_NAME` runs a command in one of the pods.

**Trace:** the new pods print `the cycle shop`.

**Common wrong approach:** changing the ConfigMap and expecting running pods to change. Environment variables are read only at container start.
:::

:::exercise Store a token in a Secret
Create a Secret named `shop-secret` with the key `ADMIN_TOKEN` and the value `s3cret-token-123`, then read the value back in plain text.
```sh starter setup=k8s-service
kubectl get secrets
```
```js check
const k = k8s();
const s = k.get("secrets", "shop-secret");
if (!s) throw new AssertionError("There's no Secret named shop-secret yet: kubectl create secret generic shop-secret --from-literal=ADMIN_TOKEN=s3cret-token-123.");
const decoded = atob(s.data.ADMIN_TOKEN);
same(decoded, "s3cret-token-123", "The decoded ADMIN_TOKEN");
if (!ran(/base64 -d|base64 --decode/)) throw new AssertionError("Read the value back with kubectl get secret shop-secret -o jsonpath='{.data.ADMIN_TOKEN}' | base64 -d.");
```
```sh solution setup=k8s-service
kubectl create secret generic shop-secret --from-literal=ADMIN_TOKEN=s3cret-token-123
kubectl get secret shop-secret -o jsonpath='{.data.ADMIN_TOKEN}' | base64 -d; echo
```
hint: `kubectl create secret generic NAME --from-literal=KEY=VALUE` creates a Secret.
hint: The stored value is base64; `kubectl get secret … -o jsonpath='{.data.ADMIN_TOKEN}'` prints it encoded.
hint: Pipe that into `base64 -d` to decode it.
approach:
1. **Understand:** Secret values are base64-encoded, not encrypted.
2. **Examples:** the lesson read `shop-secret` back with jsonpath and base64 -d.
3. **Brute force:** reading the YAML and decoding by hand is slower than jsonpath.
4. **Pattern:** **create secret generic → get -o jsonpath → base64 -d**.
5. **Plan:** create, read back.
6. **Code and test:** `s3cret-token-123`.
walkthrough:
**Line by line**

- `create secret generic shop-secret --from-literal=ADMIN_TOKEN=…` stores the value base64-encoded under `data.ADMIN_TOKEN`.
- `-o jsonpath='{.data.ADMIN_TOKEN}'` prints only that field.
- `base64 -d` decodes it; `; echo` adds the missing newline.

**Trace:** `s3cret-token-123`.

**Common wrong approach:** believing base64 protects the value. It only makes it safe to store in YAML; access control protects it.
:::

:::quiz
? Why keep configuration out of the image?
+ So the same image runs everywhere and a setting can change without rebuilding it
- Images can't contain environment variables
- It makes images smaller by law
- Kubernetes can't run images with configuration
= One image, many environments: the configuration is supplied by the cluster.
? You edit a ConfigMap. What do running pods see?
+ Nothing until they restart: environment variables are read at container start
- The new value immediately, in every variable
- The pods are deleted automatically
- An error
= A rollout restart gives the pods the new value.
? Is a Secret encrypted by default?
+ No: its values are base64-encoded, so access control and encryption at rest must protect it
- Yes, with a key that only Kubernetes holds
- Yes, always, with the pod's name
- It depends on the image
= base64 is an encoding; anyone who can read the Secret can decode it.
? Which command restarts every pod of a deployment with the same image?
+ kubectl rollout restart deployment/NAME
- kubectl delete pods
- kubectl apply --restart
- kubectl reset deployment
= A rollout restart replaces the pods one at a time, so they pick up configuration.
:::

@@@ lesson
id: k8s-health-scaling
title: Health checks, resources and scaling
minutes: 30
summary: Liveness, readiness and startup probes (httpGet, the difference between restarting a container and removing it from a Service), probe settings (initialDelaySeconds, periodSeconds, failureThreshold), CrashLoopBackOff and restart counts, resource requests and limits (CPU and memory, the scheduler's use of requests, OOMKilled), graceful shutdown with terminationGracePeriodSeconds, horizontal scaling with kubectl scale and kubectl autoscale, and what to watch when a rollout hangs.
---
A process can be running and still be broken: stuck, out of memory, or not yet ready to serve. Kubernetes asks each container to prove it's healthy with **probes**, and it uses the answers in different ways.

| Probe | If it fails | Use it for |
|---|---|---|
| **readiness** | the pod is removed from Service endpoints (no traffic) | "I'm not ready for requests yet" or "I'm busy right now" |
| **liveness** | the container is restarted | "I'm stuck, restart me" |
| **startup** | liveness and readiness wait until it succeeds | slow starts, so liveness doesn't kill a pod that's still booting |

### A readiness probe

The shop answers `/health` with `ok`. Add a readiness probe so the Service only sends traffic to a pod after that answer:

```yaml
containers:
  - name: shop
    image: shop:2.0
    readinessProbe:
      httpGet:
        path: /health
        port: 3000
      initialDelaySeconds: 2
      periodSeconds: 5
      failureThreshold: 3
```

- `initialDelaySeconds`: wait before the first check.
- `periodSeconds`: how often to check.
- `failureThreshold`: how many failures in a row count as failing (3 by default).

```sh setup=k8s-service
kubectl patch deployment shop --patch '{"spec":{"template":{"spec":{"containers":[{"name":"shop","readinessProbe":{"httpGet":{"path":"/health","port":3000},"periodSeconds":5}}]}}}}'
kubectl rollout status deployment/shop
kubectl get pods -l app=shop
kubectl describe pod -l app=shop | grep -i readiness
```

### A failing probe

```sh setup=k8s-service
kubectl patch deployment shop --patch '{"spec":{"template":{"spec":{"containers":[{"name":"shop","readinessProbe":{"httpGet":{"path":"/missing","port":3000},"periodSeconds":5}}]}}}}'
kubectl get pods -l app=shop
kubectl describe pod -l app=shop | grep -i "readiness probe failed" | head -1
```

The new pods start but never become ready, so the rollout stops: the old pods keep serving because `maxUnavailable` keeps enough of them ready. Roll back with `kubectl rollout undo deployment/shop`. A broken version that never becomes ready is the most common reason a rollout hangs.

### Restarts and CrashLoopBackOff

A container that exits (or fails its liveness probe) is restarted by the kubelet, with an increasing delay: 10 seconds, 20, 40 and so on, up to five minutes. The pod shows `CrashLoopBackOff`, and RESTARTS counts up. `kubectl logs --previous` shows the output of the last crashed run; it's the first thing to check.

### Resources

Each container can ask for resources and set a limit:

```yaml
resources:
  requests:
    cpu: 100m        # 0.1 of a CPU core: what the scheduler reserves for the pod
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi    # above this, the container is killed (OOMKilled)
```

The scheduler places a pod only on a node with enough unreserved requests. A container over its memory limit is killed and restarted; a container over its CPU limit is slowed down, not killed.

### Scaling

Scale by hand with `kubectl scale`, or let the **HorizontalPodAutoscaler** adjust the replica count from CPU use:

```sh setup=k8s-service
kubectl set resources deployment shop --requests=cpu=50m --limits=cpu=200m
kubectl autoscale deployment shop --min=2 --max=6 --cpu=70%
kubectl get hpa
```

The autoscaler reads CPU use every 15 seconds, compares it with the target, and scales between the minimum and maximum. It needs CPU requests set to work out a percentage, which is why the first command sets them. It also needs the **metrics server** to read CPU use at all: until it has numbers, `TARGETS` shows `<unknown>` (kind doesn't install it, so the sandbox shows that too). Use `kubectl scale` for a fixed count and an autoscaler for changing load.

### Graceful shutdown

When a pod is deleted or updated, Kubernetes sends `SIGTERM`, waits `terminationGracePeriodSeconds` (30 by default), then sends `SIGKILL`. The shop's Node.js server should finish open requests on SIGTERM (Part 4, lesson 22), and the pod should also leave the Service first: a short `preStop` sleep gives the endpoint change time to reach every node.

### Try it on your own computer

- The metrics server (`kubectl top pods`) provides CPU and memory use; kind installs it only if you ask.
- `kubectl get events --sort-by=.lastTimestamp` lists what happened recently, which explains most surprises.
- Probes that call a database make a database outage remove every pod from its Service at once. Keep readiness checks about the process, and use separate checks for dependencies.

:::exercise Only healthy pods get traffic
The deployment `shop` has no probe. Add a readiness probe that checks `/health` on port 3000 every 5 seconds, wait for the rollout, and check that all three pods are ready.
```sh starter setup=k8s-service
kubectl get deployment shop -o yaml | grep -c readinessProbe
```
```js check
const k = k8s();
const d = k.get("deployments", "shop");
const c = d.spec.template.spec.containers[0];
if (!c.readinessProbe || !c.readinessProbe.httpGet) throw new AssertionError("The shop container has no readinessProbe with httpGet yet.");
same(c.readinessProbe.httpGet.path, "/health", "The probe's path");
same(c.readinessProbe.httpGet.port, 3000, "The probe's port");
same(k.pods("app=shop").filter((p) => p.ready && !p.terminating).length, 3, "The number of ready shop pods");
```
```sh solution setup=k8s-service
kubectl patch deployment shop --patch '{"spec":{"template":{"spec":{"containers":[{"name":"shop","readinessProbe":{"httpGet":{"path":"/health","port":3000},"periodSeconds":5}}]}}}}'
kubectl rollout status deployment/shop
kubectl get pods -l app=shop
```
hint: A readiness probe goes inside the container entry: `readinessProbe: { httpGet: { path: /health, port: 3000 }, periodSeconds: 5 }`.
hint: `kubectl patch deployment shop --patch '…'` accepts the same JSON; the container is named `shop`.
hint: After the patch, `kubectl rollout status deployment/shop` waits until the new pods pass their checks.
approach:
1. **Understand:** a readiness probe decides whether a pod receives traffic.
2. **Examples:** the lesson patched a readiness probe onto the shop.
3. **Brute force:** a liveness probe on the same path restarts pods that are merely busy.
4. **Pattern:** **readinessProbe: httpGet: path, port; then rollout status**.
5. **Plan:** patch, wait, check.
6. **Code and test:** three pods with READY 1/1.
walkthrough:
**Line by line**

- `readinessProbe.httpGet` asks for `/health` on port 3000.
- `periodSeconds: 5` checks every five seconds.
- The rollout waits until the new pods pass; the Service sends them traffic only after that.

**Trace:** `deployment "shop" successfully rolled out`, three pods 1/1.

**Common wrong approach:** a liveness probe that restarts the pod whenever a request is slow. Use readiness for "not right now" and liveness only for "stuck for good".
:::

:::quiz
? A pod fails its readiness probe but keeps running. What happens?
+ It's removed from Service endpoints, so it gets no traffic until the probe passes again
- It's restarted immediately
- It's deleted
- Nothing: probes don't affect traffic
= Readiness controls traffic; liveness controls restarts.
? What does CrashLoopBackOff mean?
+ A container keeps failing and is restarted with increasing delays
- The cluster is out of memory
- The pod was deleted on purpose
- The image is being pulled
= Check the last run with kubectl logs --previous.
? A container exceeds its memory limit. What happens?
+ It's killed (OOMKilled) and restarted
- It's slowed down
- Nothing until the node runs out
- The pod is moved to a bigger node
= CPU over its limit is throttled; memory over its limit is fatal to the container.
? What do resource requests decide?
+ Where the scheduler can place the pod, by reserving that much on a node
- The maximum a container may use
- The image size
- The number of replicas
= Requests are reservations; limits are the ceiling.
:::
