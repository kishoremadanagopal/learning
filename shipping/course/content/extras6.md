@@ k8s-first-cluster
topics: what Kubernetes does and why (desired state, control loops), the control plane (API server, etcd, scheduler, controller manager) and nodes (kubelet, container runtime), kind (Kubernetes in Docker) and its nodes as containers, kubectl create cluster and the kubeconfig, contexts (kind-kind), kubectl cluster-info and config get-contexts, namespaces and -A, system pods in kube-system, kind load docker-image, the Pod object and its YAML manifest (apiVersion, kind, metadata, spec.containers), kubectl apply -f, get pods -o wide, describe and its events, kubectl logs, pod phases (Pending, ContainerCreating, Running, Completed, Error, CrashLoopBackOff), ErrImagePull and ImagePullBackOff, kubectl run with --restart=Never, deleting a bare pod, Docker Desktop's Kubernetes and Rancher, OrbStack
terms:
- **Kubernetes:** a system that runs containers across machines and keeps them matching the objects you declare.
- **Control plane:** the API server, etcd, the scheduler and the controller manager.
- **Node:** a machine (or kind container) that runs pods; it has a kubelet and a container runtime.
- **kubelet:** the agent on each node that starts and watches the node's pods.
- **Pod:** the smallest unit Kubernetes runs: one or more containers sharing a network address and storage.
- **Manifest:** a YAML file describing an object, applied with kubectl apply.
- **kubeconfig and context:** the file (~/.kube/config) with cluster addresses and credentials, and the named pairing of a cluster with a user and namespace.
- **Namespace:** a group of objects inside a cluster; the default is `default`.
- **Event:** a record of something that happened to an object, shown at the bottom of kubectl describe.
mistakes:
- Expecting a cluster node to see the images on your computer; load them with kind load, or pull them from a registry.
- Using tabs in YAML, which isn't allowed.
- Deleting a bare pod and expecting it to come back: only controllers recreate pods.
- Forgetting --restart=Never on kubectl run, so a one-off command is restarted again and again.
- Working in the wrong context: check kubectl config current-context before deleting anything.

glance:
- Create a local cluster | kind create cluster | creates containers and a context | kind delete cluster
- Apply a manifest | kubectl apply -f FILE.yaml | creates or updates objects | kubectl delete -f FILE.yaml
- List pods | kubectl get pods (-o wide, -A) | nothing | —
- Explain a pod's state | kubectl describe pod NAME | nothing | —
- Read a container's output | kubectl logs NAME (--previous) | nothing | —
- Run a one-off command | kubectl run NAME --image=IMAGE --restart=Never -- COMMAND | creates a pod | kubectl delete pod NAME
- Copy a local image into kind | kind load docker-image IMAGE | copies into each node | —
- Delete a pod | kubectl delete pod NAME | removes the pod (a Deployment replaces it) | —

@@ k8s-deployments
topics: why controllers create pods, Deployments, ReplicaSets and pod templates, labels and selectors (app=shop), the pod-template-hash, self-healing when a pod is deleted, scaling with kubectl scale (which pods are removed), rolling updates with kubectl set image and rollout status, the strategy with maxSurge and maxUnavailable, rollout history and rollout undo, the old ReplicaSets kept at zero replicas, kubectl create deployment --dry-run=client -o yaml, declarative updates with kubectl apply, kubectl diff, rollout restart, and GitOps (Argo CD, Flux)
terms:
- **Deployment:** an object that keeps a set number of identical pods running and updates them to a new template.
- **ReplicaSet:** an object that keeps exactly N pods matching its template running; each template version has its own.
- **Pod template:** the pod spec inside a Deployment or ReplicaSet, from which the pods are created.
- **Label selector:** a rule that matches objects by their labels, such as app=shop; used by Deployments, ReplicaSets and Services.
- **Pod-template-hash:** a label derived from the pod template, so each version gets its own ReplicaSet.
- **Rolling update:** replacing pods gradually so some are always serving.
- **maxSurge / maxUnavailable:** how many extra pods may run, and how many may be unavailable, during an update.
- **Rollback:** going back to a previous ReplicaSet's template with kubectl rollout undo.
mistakes:
- Changing pods directly (kubectl delete pod or kubectl set image on a bare pod) when the Deployment should be changed instead.
- Deleting and recreating a Deployment to update it, which takes every pod down at once.
- Editing a Deployment with kubectl set image and never updating the manifest in Git, so the next apply reverts it.
- Using maxUnavailable: 1 with a single replica, which turns every update into an outage.
- Forgetting that the selector of a Deployment can't be changed after creation.

glance:
- Create a Deployment | kubectl create deployment NAME --image=IMAGE --replicas=N | creates the Deployment, ReplicaSet and pods | kubectl delete deployment NAME
- Scale | kubectl scale deployment NAME --replicas=N | adds or removes pods | scale back
- Update the image | kubectl set image deployment/NAME CONTAINER=IMAGE | starts a rolling update | kubectl rollout undo deployment/NAME
- Wait for a rollout | kubectl rollout status deployment/NAME | nothing | —
- Show history | kubectl rollout history deployment/NAME | nothing | —
- Roll back | kubectl rollout undo deployment/NAME | a new rollout to the previous template | kubectl rollout undo again
- Restart all pods | kubectl rollout restart deployment/NAME | replaces every pod | —
- Write a manifest from a command | kubectl create deployment … --dry-run=client -o yaml > FILE | nothing in the cluster | —
- See what an apply would change | kubectl diff -f FILE.yaml | nothing | —

@@ k8s-services
topics: why pod IPs change, Services and label selectors, ClusterIP addresses, cluster DNS (short names, namespaces, svc.cluster.local), kubectl expose with --name, --port and --target-port, endpoints and EndpointSlices, readiness and endpoints, load balancing by connection, testing from a temporary pod with kubectl run --rm -i, kubectl logs with label selectors and --prefix, kubectl port-forward, service types ClusterIP, NodePort and LoadBalancer, Ingress and the Gateway API, service environment variables
terms:
- **Service:** a stable name and address that sends traffic to the pods matching its selector.
- **ClusterIP:** a virtual address for a Service, reachable only inside the cluster.
- **Endpoints / EndpointSlice:** the list of ready pod addresses a Service forwards to.
- **port and targetPort:** the Service's port that callers use, and the container port it forwards to.
- **Cluster DNS:** the name service that resolves Service names such as shop and shop.default.svc.cluster.local.
- **NodePort:** a Service port opened on every node, from 30000 to 32767 by default.
- **LoadBalancer:** a Service type that asks the cloud for an external load balancer.
- **Ingress:** routes outside traffic by host name and path to Services.
- **port-forward:** a development tunnel from a local port to a Service or pod.
mistakes:
- Setting targetPort to the Service's port (80) when the container listens on 3000, so the Service forwards to a closed port.
- Expecting a ClusterIP to be reachable from your computer or the internet.
- Calling a pod's IP directly; it changes when the pod is replaced.
- A selector that matches no pods, so the Service has no endpoints and every request fails.
- Assuming one connection spreads across pods: load balancing happens per connection.

glance:
- Expose a Deployment | kubectl expose deployment NAME --name=SVC --port=80 --target-port=3000 | creates a Service | kubectl delete service SVC
- List services | kubectl get services (svc) | nothing | —
- See endpoints | kubectl get endpointslices -l kubernetes.io/service-name=SVC | nothing | —
- Test from inside the cluster | kubectl run tester --image=busybox:1.37 --restart=Never --rm -i -- wget -qO- http://SVC | runs and removes a pod | —
- Tunnel to your computer | kubectl port-forward service/SVC 8080:80 | forwards until stopped | Ctrl+C
- Logs of all matching pods | kubectl logs -l app=NAME --prefix | nothing | —

@@ k8s-config
topics: keeping configuration out of the image, ConfigMaps (--from-literal, --from-file, -o yaml), env with valueFrom.configMapKeyRef, envFrom with configMapRef, why changing a ConfigMap doesn't restart pods, rollout restart, kubectl create --dry-run=client -o yaml | kubectl apply -f -, Secrets (generic, --from-literal), base64 as encoding not encryption, jsonpath and base64 -d, secretKeyRef, mounting ConfigMaps as files (volumes and volumeMounts), kubectl patch with a JSON patch, kubectl exec and printenv, RBAC, encryption at rest, External Secrets and Sealed Secrets, Kustomize generators
terms:
- **ConfigMap:** an object holding plain-text configuration as key–value pairs (or whole files).
- **Secret:** an object holding sensitive values, stored base64-encoded.
- **envFrom / valueFrom:** how a container's environment gets values from a ConfigMap or Secret.
- **Volume mount:** a ConfigMap or Secret made available as files at a path inside the container.
- **base64:** an encoding of bytes as text; not encryption.
- **Encryption at rest:** encrypting objects in etcd so the stored data is unreadable without a key.
- **RBAC:** role-based access control: who may read, change or delete which objects.
mistakes:
- Treating base64 in a Secret as protection, and committing Secret manifests with real values to Git.
- Changing a ConfigMap and expecting running pods to see the new value without a restart.
- Putting a whole config file into the image, so every change needs a rebuild.
- Using a ConfigMap for a password.
- Forgetting the newline when printing a decoded secret.

glance:
- Create a ConfigMap | kubectl create configmap NAME --from-literal=KEY=VALUE | creates the object | kubectl delete configmap NAME
- Update a ConfigMap | kubectl create configmap NAME … --dry-run=client -o yaml \| kubectl apply -f - | changes the object | —
- Create a Secret | kubectl create secret generic NAME --from-literal=KEY=VALUE | creates the object | kubectl delete secret NAME
- Read a Secret value | kubectl get secret NAME -o jsonpath='{.data.KEY}' \| base64 -d | nothing | —
- Make pods pick up changes | kubectl rollout restart deployment/NAME | replaces every pod | —
- Check a pod's environment | kubectl exec deploy/NAME -- printenv KEY | nothing | —

@@ k8s-health-scaling
topics: readiness, liveness and startup probes, httpGet probes, initialDelaySeconds, periodSeconds and failureThreshold, what each probe does on failure, a readiness failure and a stuck rollout, rollout undo after a bad release, CrashLoopBackOff and kubectl logs --previous, restart back-off, resource requests and limits (CPU and memory), the scheduler's use of requests, OOMKilled and CPU throttling, kubectl set resources, kubectl autoscale and the HorizontalPodAutoscaler, metrics and kubectl top, terminationGracePeriodSeconds and SIGTERM, preStop hooks, kubectl get events, separate checks for dependencies
terms:
- **Readiness probe:** a check that decides whether a pod receives Service traffic.
- **Liveness probe:** a check that restarts a container when it fails.
- **Startup probe:** a check that holds off liveness and readiness until a slow start has finished.
- **CrashLoopBackOff:** a container that keeps failing and is restarted with increasing delays.
- **Resource request:** the amount the scheduler reserves for a container on a node.
- **Resource limit:** the most a container may use; over the memory limit it's killed (OOMKilled).
- **HorizontalPodAutoscaler (HPA):** an object that changes a Deployment's replicas based on a metric, such as CPU use.
- **Graceful shutdown:** SIGTERM, a grace period, then SIGKILL, during which the app finishes its requests.
mistakes:
- Using a liveness probe on a slow endpoint, so busy pods are restarted in a loop.
- Making readiness depend on a database, so a database outage removes every pod from its Service.
- Setting no memory limit, or one below the app's normal use, so it's OOMKilled under load.
- Autoscaling on CPU without setting CPU requests: the percentage has nothing to compare with.
- Ignoring a rollout that hangs: a pod that never becomes ready is the usual cause.

glance:
- Add a readiness probe | edit the container with readinessProbe.httpGet, or kubectl patch | pods get new readiness rules | remove the probe in the manifest
- See probe failures | kubectl describe pod NAME (events) | nothing | —
- Read the last crashed run | kubectl logs NAME --previous | nothing | —
- Set resources | kubectl set resources deployment/NAME --requests=cpu=50m --limits=cpu=200m | new pods get the values | kubectl set resources again
- Autoscale | kubectl autoscale deployment NAME --min=2 --max=6 --cpu-percent=70 | creates an HPA | kubectl delete hpa NAME
- Scale by hand | kubectl scale deployment NAME --replicas=N | changes the count | scale back
- See recent events | kubectl get events --sort-by=.lastTimestamp | nothing | —
