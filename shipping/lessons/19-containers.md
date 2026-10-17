# Lesson 19: Containers and images

**You'll learn:** "it works on my machine", what images, containers, layers and registries are, containers versus virtual machines (namespaces and cgroups, Docker Desktop's Linux VM), the OCI standard, docker run and what it does (pull, create, start), running commands in images (--rm), image names, tags, variants (alpine, slim, Debian) and digests, Node.js LTS tags in October 2026, Docker 29's docker images view (disk usage, content size, in use), docker ps and docker ps -a, container names, docker container prune, docker rm and docker rmi, running a server detached with a published port (-d, -p, --name), docker logs, docker stop, installing Docker Desktop or Docker Engine and its license, alternatives (Podman, Rancher Desktop, Colima, OrbStack), Docker Hub pull limits.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#containers)**: run every example and check your exercise answers.

## Key terms

- **Image:** a read-only package of a program and everything it needs to run, built from layers.
- **Container:** a running or stopped instance of an image: an isolated process with its own file system and network.
- **Layer:** one set of file changes in an image; images share the layers they have in common.
- **Registry:** a server that stores and serves images, such as Docker Hub or ghcr.io.
- **Tag:** a movable name for an image version, like 24-alpine.
- **Digest:** a sha256 hash that identifies an image's exact content and never changes.
- **Docker Engine:** the background service (daemon) that builds images and runs containers.
- **Detached:** running in the background (-d), with the terminal free for other commands.
- **Publish a port:** connect a port on the host to a port in a container (-p host:container).

Part 3's workflow installed Node.js 24 on a fresh runner before testing. Your laptop might have Node.js 22, a teammate's has 26, and the production server has whatever was installed two years ago. Add operating-system libraries, environment variables and file paths, and you get the oldest excuse in software: *it works on my machine*. **Containers** fix this by shipping the program together with everything it needs to run.

## Containers, images and registries

![Two stacks side by side. Virtual machines: hardware, a host operating system, a hypervisor, then for each app its own guest OS, libraries and app. Containers: hardware, the host OS (Linux kernel), a container engine, then for each app only its libraries and the app; containers share the host's kernel](../figures/containers-vs-vms.svg)

| Word | Meaning |
|---|---|
| **image** | a read-only package of a program and its files: an operating system's userland, a runtime like Node.js, your code, and the command to start it |
| **container** | a running (or stopped) instance of an image: an ordinary process that gets its own file system, network and process list |
| **layer** | images are stacks of layers; images that share a base share its layers on disk |
| **registry** | a server that stores images, like Docker Hub (`docker.io`) or GitHub's `ghcr.io` |
| **Docker Engine** | the background service (daemon) that pulls images and runs containers; the `docker` command talks to it |

A virtual machine pretends to be a whole computer and boots its own operating system, which takes seconds to minutes and gigabytes of memory. A container is just a process on the host's Linux kernel that the kernel walls off (with *namespaces*) and limits (with *cgroups*), so it starts in milliseconds. On macOS and Windows, Docker Desktop runs a small Linux virtual machine and puts your containers inside it.

Images follow an open standard (OCI), so an image you build with Docker also runs on Podman, on Kubernetes (Part 6) and on every cloud's container service (Part 7).

## Your first container

```bash
docker run hello-world
```

`docker run` did four things: it didn't find `hello-world` locally, so it **pulled** the image from Docker Hub (one layer, then a digest that identifies exactly this content), **created** a container from it, **started** it, and showed its output. The container's program printed a message and ended, so the container stopped: a container lives exactly as long as its main process.

## Programs you didn't install

An image brings its own userland, so you can run a different Node.js version, or a different Linux distribution, without installing anything:

```bash
docker run --rm node:24-alpine node --version
docker run --rm node:26-alpine node --version
docker run --rm alpine cat /etc/os-release
```

The text after the image name is the command to run inside the container. `--rm` deletes the container when it ends, which keeps throwaway runs from piling up. The second image only had to download the layers it didn't share with the first (`Already exists`).

## Images: names, tags and digests

An image name has up to four parts: `registry/owner/repository:tag`. `node:24-alpine` is short for `docker.io/library/node:24-alpine`: Docker Hub, the official images (`library`), the `node` repository, the tag `24-alpine`.

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
docker run hello-world > /dev/null
docker run --rm node:24-alpine node --version > /dev/null
docker run --rm node:26-alpine node --version > /dev/null
docker run --rm alpine cat /etc/os-release > /dev/null
```

</details>

```bash
docker images
```

Docker 29 lists each tag with its ID, its **disk usage** (unpacked files plus the compressed download) and its **content size** (what was downloaded); `U` in EXTRA means a container uses it. Tags are labels a publisher moves: on 17 October 2026, `node:24-alpine` is Node.js 24.22.0 on Alpine Linux 3.24. Official images come in variants:

| Tag | Base | Disk usage |
|---|---|---|
| `node:24-alpine` | Alpine Linux (musl, BusyBox) | 234MB |
| `node:24-slim` | Debian 12, minimal packages | 327MB |
| `node:24` | Debian 12 with build tools | 1.54GB |

Smaller images download faster and contain fewer programs an attacker could use; the course uses Alpine. Some tags move further than others: `node:lts` is Node.js 24 until Node.js 26 becomes the LTS version on 28 October 2026, and `latest` is just a tag name, not a promise of anything. For something that must not change at all, use the **digest**: `node:24-alpine@sha256:44fce696…` always means the same bytes.

## Containers come and go

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
docker run hello-world > /dev/null
docker run --rm node:24-alpine node --version > /dev/null
docker run --rm node:26-alpine node --version > /dev/null
docker run --rm alpine cat /etc/os-release > /dev/null
```

</details>

```bash
docker ps
docker ps -a
docker container prune -f
docker ps -a
```

`docker ps` lists running containers; `-a` includes stopped ones. Each has an ID, the image, the command it runs, its status (`Exited (0)` means its process ended with exit status 0, success) and a name: Docker makes one up (an adjective and a famous scientist) unless you give `--name`. `docker container prune` removes all stopped containers, and `docker rm NAME` removes one.

## A server in a container

A web server's main process doesn't end, so its container keeps running. Start it in the background (`-d`, detached) and **publish** a port so your computer can reach it:

```bash
docker run -d -p 8080:80 --name web nginx:alpine
docker ps
curl -s localhost:8080 | head -4
docker logs --tail 1 web
docker stop web
docker rm web
```

- `-p 8080:80` connects port 8080 on your computer to port 80 inside the container, where nginx listens. The order is always *host:container*.
- `docker run -d` prints the new container's full ID; `docker ps` shows the port mapping on IPv4 (`0.0.0.0`) and IPv6 (`[::]`).
- `docker logs` shows what the container's process printed: nginx logs every request, here the one from curl.
- `docker stop` asks the process to end; `docker rm` deletes the stopped container.

## Try it on your own computer

- **Docker Desktop** (macOS, Windows and Linux) is the easiest install: [docs.docker.com/get-started/get-docker](https://docs.docker.com/get-started/get-docker/). It's free for personal use, education, non-commercial open source and companies with fewer than 250 employees *and* less than $10 million in annual revenue; larger companies need a paid subscription.
- On a Linux server, install **Docker Engine** on its own: [docs.docker.com/engine/install](https://docs.docker.com/engine/install/). Free alternatives that run the same images include [Podman](https://podman.io/), [Rancher Desktop](https://rancherdesktop.io/), [Colima](https://github.com/abiosoft/colima) (macOS) and OrbStack (macOS, free for personal use).
- Check it works with `docker version` and `docker run hello-world`. In a real terminal, `docker run` without `-d` stays attached to a server's output until you press Ctrl+C, and `docker run -it alpine sh` opens a shell inside a container (type `exit` to leave).
- Docker Hub limits downloads: 100 pulls per 6 hours for anonymous users (per IP address) and 200 for a free account. `docker login` with a free account doubles your limit, which matters on shared office or CI networks.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Run a command in a new container | docker run --rm IMAGE COMMAND | pulls the image if needed | — |
| Run a server in the background | docker run -d -p 8080:80 --name web IMAGE | creates and starts a container | docker stop web; docker rm web |
| List running / all containers | docker ps / docker ps -a | nothing | — |
| List images | docker images | nothing | — |
| Show a container's output | docker logs NAME | nothing | — |
| Remove stopped containers | docker container prune -f | deletes containers | — |
| Remove an image | docker rmi IMAGE | deletes the image | docker pull IMAGE |

## Common mistakes

- Writing -p 3000:8080 when the app listens on 3000 inside the container: the order is host:container.
- Forgetting -d for a server, so the terminal stays attached to it.
- Expecting a container to keep running after its main process has finished.
- Using latest and being surprised when the publisher moves it to a new major version.
- Trying to delete an image while stopped containers still use it.

## Exercises

### 1. Your first web server

Run the official `nginx:alpine` image in the background as a container named `web`, with port 8080 on your computer published to port 80 in the container. Then fetch its home page with curl.

Starter:

```bash
docker ps
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a server's container keeps running, so it should run in the background with a port your computer can reach.
2. **Examples:** `docker run -d -p 8080:80 nginx:alpine` publishes port 80 of the container on port 8080.
3. **Brute force:** without `-d` the terminal stays attached; without `-p`, curl can't reach it.
4. **Pattern:** **docker run -d -p HOST:CONTAINER --name NAME IMAGE** is how most servers are started.
5. **Plan:** run → `docker ps` to see the mapping → curl.
6. **Code and test:** curl prints nginx's welcome page, and `docker logs web` shows the request.

</details>

<details>
<summary>💡 Hint 1</summary>

Three options: `-d` (detached), `-p HOST:CONTAINER` and `--name`. They go between `docker run` and the image name.

</details>

<details>
<summary>💡 Hint 2</summary>

nginx listens on port 80 inside the container, so the mapping is `-p 8080:80`.

</details>

<details>
<summary>💡 Hint 3</summary>

`docker run -d -p 8080:80 --name web nginx:alpine`, then `curl localhost:8080`.

</details>

### 2. Clean up

Trying things out leaves containers and images behind. Remove every **stopped** container, then the `hello-world` and `alpine` images. Leave the running `web` container and its `nginx:alpine` image alone.

<details>
<summary>The sandbox starts this exercise with these commands (run them first on your own computer)</summary>

```bash
docker run hello-world > /dev/null
docker run hello-world > /dev/null
docker run alpine echo "hi" > /dev/null
docker run -d -p 8080:80 --name web nginx:alpine > /dev/null
docker pull -q node:24-slim > /dev/null
```

</details>

Starter:

```bash
docker ps -a
docker images
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** stopped containers keep their images in use, so images can only go after their containers.
2. **Examples:** `docker rmi hello-world` while its containers exist fails with `image is being used by stopped container`.
3. **Brute force:** `docker rm` each stopped container by name, one by one.
4. **Pattern:** **remove containers before their images**; `prune` removes everything of one kind that nothing needs.
5. **Plan:** prune the stopped containers → `docker rmi` the two images → check with `docker ps -a` and `docker images`.
6. **Code and test:** `docker ps -a` lists only `web`; `docker images` lists `nginx:alpine` and `node:24-slim`.

</details>

<details>
<summary>💡 Hint 1</summary>

`docker ps -a` shows the stopped containers; `docker container prune -f` removes all of them at once.

</details>

<details>
<summary>💡 Hint 2</summary>

Docker refuses to delete an image that a container (even a stopped one) still uses, so remove the containers first.

</details>

<details>
<summary>💡 Hint 3</summary>

`docker container prune -f`, then `docker rmi hello-world alpine`.

</details>

**In the sandbox:** exercises 37–38. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Your first web server</summary>

```bash
docker run -d -p 8080:80 --name web nginx:alpine
curl localhost:8080
```

**Line by line**

- `docker run -d -p 8080:80 --name web nginx:alpine` pulls the image if needed, creates the container `web` and starts nginx in the background.
- `curl localhost:8080` goes to port 8080 on your computer, which Docker forwards to port 80 in the container.

**Trace:** `docker ps` shows `0.0.0.0:8080->80/tcp, [::]:8080->80/tcp`, and `docker logs web` ends with `"GET / HTTP/1.1" 200`.

**Common wrong approach:** `-p 80:8080`, the wrong way round: that publishes port 80 on your computer to port 8080 in the container, where nothing listens, so curl gets `Connection reset by peer`.

</details>

<details>
<summary>✅ 2. Clean up</summary>

```bash
docker container prune -f
docker rmi hello-world alpine
docker ps -a
docker images
```

**Line by line**

- `docker container prune -f` removes the three stopped containers (`-f` skips the "Are you sure?" question) and leaves the running one.
- `docker rmi hello-world alpine` untags and deletes both images, now that nothing uses them.

**Trace:** prune prints the IDs of three deleted containers; `docker rmi` prints `Untagged:` and `Deleted:` for each image.

**Common wrong approach:** `docker rmi hello-world` first: Docker answers `conflict: unable to delete hello-world (must be forced) - image is being used by stopped container …`. Forcing it with `-f` works, but leaves containers whose image is gone.

</details>

## Quick quiz

1. What is the difference between an image and a container?
   - A) An image is a read-only package; a container is a running or stopped instance created from it
   - B) An image runs in the cloud; a container runs on your computer
   - C) They're two names for the same thing
   - D) A container is a compressed image

2. Why does a container start much faster than a virtual machine?
   - A) It's a process on the host's kernel, so there's no operating system to boot
   - B) Containers are written in a faster language
   - C) Docker keeps every container running in advance
   - D) Containers have no files

3. What does -p 8080:3000 do?
   - A) Forwards port 8080 on your computer to port 3000 inside the container
   - B) Forwards port 3000 on your computer to port 8080 in the container
   - C) Limits the container to 8080 MB of memory
   - D) Runs 3000 copies of the container

4. You need an image that never changes, even if its publisher moves the tag. What do you use?
   - A) The image's digest (name@sha256:…)
   - B) The latest tag
   - C) The lts tag
   - D) docker run --rm

<details>
<summary>Quiz answers</summary>

1. **A) An image is a read-only package; a container is a running or stopped instance created from it**: You can create many containers from one image, like many processes from one program.
2. **A) It's a process on the host's kernel, so there's no operating system to boot**: A VM boots a whole guest OS; a container only starts its main process, walled off by kernel features.
3. **A) Forwards port 8080 on your computer to port 3000 inside the container**: The order is always host:container.
4. **A) The image's digest (name@sha256:…)**: Tags are movable labels; a digest names exact content.

</details>

---
Previous: [Lesson 18](18-pipelines.md) · Next: [Lesson 20: Writing a Dockerfile](20-dockerfile.md)
