@@@ part
id: 4
title: Docker
level: Intermediate
blurb: Packaging software so it runs the same everywhere: what containers and images are, running them, writing a Dockerfile for the shop's web API, layers and the build cache, multi-stage builds and smaller, safer images, configuration, logs, signals, restart policies, health checks and volumes, several services together with Docker Compose, and publishing images to a registry from GitHub Actions. A pretend Docker Engine 29 runs in the sandbox: images build, containers really run your Node.js server, and curl reaches them.

@@@ lesson
id: containers
title: Containers and images
minutes: 30
summary: Why containers exist ("it works on my machine"), containers versus virtual machines, images, layers, tags and registries, running a first container with docker run, running commands in images you didn't install, listing and removing containers and images, choosing image tags (alpine, slim, LTS), and running a web server in the background with a published port.
---
Part 3's workflow installed Node.js 24 on a fresh runner before testing. Your laptop might have Node.js 22, a teammate's has 26, and the production server has whatever was installed two years ago. Add operating-system libraries, environment variables and file paths, and you get the oldest excuse in software: *it works on my machine*. **Containers** fix this by shipping the program together with everything it needs to run.

### Containers, images and registries

![Two stacks side by side. Virtual machines: hardware, a host operating system, a hypervisor, then for each app its own guest OS, libraries and app. Containers: hardware, the host OS (Linux kernel), a container engine, then for each app only its libraries and the app; containers share the host's kernel](figures/containers-vs-vms.svg)

| Word | Meaning |
|---|---|
| **image** | a read-only package of a program and its files: an operating system's userland, a runtime like Node.js, your code, and the command to start it |
| **container** | a running (or stopped) instance of an image: an ordinary process that gets its own file system, network and process list |
| **layer** | images are stacks of layers; images that share a base share its layers on disk |
| **registry** | a server that stores images, like Docker Hub (`docker.io`) or GitHub's `ghcr.io` |
| **Docker Engine** | the background service (daemon) that pulls images and runs containers; the `docker` command talks to it |

A virtual machine pretends to be a whole computer and boots its own operating system, which takes seconds to minutes and gigabytes of memory. A container is just a process on the host's Linux kernel that the kernel walls off (with *namespaces*) and limits (with *cgroups*), so it starts in milliseconds. On macOS and Windows, Docker Desktop runs a small Linux virtual machine and puts your containers inside it.

Images follow an open standard (OCI), so an image you build with Docker also runs on Podman, on Kubernetes (Part 6) and on every cloud's container service (Part 7).

### Your first container

```sh
docker run hello-world
```

`docker run` did four things: it didn't find `hello-world` locally, so it **pulled** the image from Docker Hub (one layer, then a digest that identifies exactly this content), **created** a container from it, **started** it, and showed its output. The container's program printed a message and ended, so the container stopped: a container lives exactly as long as its main process.

### Programs you didn't install

An image brings its own userland, so you can run a different Node.js version, or a different Linux distribution, without installing anything:

```sh
docker run --rm node:24-alpine node --version
docker run --rm node:26-alpine node --version
docker run --rm alpine cat /etc/os-release
```

The text after the image name is the command to run inside the container. `--rm` deletes the container when it ends, which keeps throwaway runs from piling up. The second image only had to download the layers it didn't share with the first (`Already exists`).

### Images: names, tags and digests

An image name has up to four parts: `registry/owner/repository:tag`. `node:24-alpine` is short for `docker.io/library/node:24-alpine`: Docker Hub, the official images (`library`), the `node` repository, the tag `24-alpine`.

```sh setup=docker-pulled
docker images
```

Docker 29 lists each tag with its ID, its **disk usage** (unpacked files plus the compressed download) and its **content size** (what was downloaded); `U` in EXTRA means a container uses it. Tags are labels a publisher moves: on 17 October 2026, `node:24-alpine` is Node.js 24.22.0 on Alpine Linux 3.24. Official images come in variants:

| Tag | Base | Disk usage |
|---|---|---|
| `node:24-alpine` | Alpine Linux (musl, BusyBox) | 234MB |
| `node:24-slim` | Debian 12, minimal packages | 327MB |
| `node:24` | Debian 12 with build tools | 1.54GB |

Smaller images download faster and contain fewer programs an attacker could use; the course uses Alpine. Some tags move further than others: `node:lts` is Node.js 24 until Node.js 26 becomes the LTS version on 28 October 2026, and `latest` is just a tag name, not a promise of anything. For something that must not change at all, use the **digest**: `node:24-alpine@sha256:44fce696…` always means the same bytes.

### Containers come and go

```sh setup=docker-pulled
docker ps
docker ps -a
docker container prune -f
docker ps -a
```

`docker ps` lists running containers; `-a` includes stopped ones. Each has an ID, the image, the command it runs, its status (`Exited (0)` means its process ended with exit status 0, success) and a name: Docker makes one up (an adjective and a famous scientist) unless you give `--name`. `docker container prune` removes all stopped containers, and `docker rm NAME` removes one.

### A server in a container

A web server's main process doesn't end, so its container keeps running. Start it in the background (`-d`, detached) and **publish** a port so your computer can reach it:

```sh
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

### Try it on your own computer

- **Docker Desktop** (macOS, Windows and Linux) is the easiest install: [docs.docker.com/get-started/get-docker](https://docs.docker.com/get-started/get-docker/). It's free for personal use, education, non-commercial open source and companies with fewer than 250 employees *and* less than $10 million in annual revenue; larger companies need a paid subscription.
- On a Linux server, install **Docker Engine** on its own: [docs.docker.com/engine/install](https://docs.docker.com/engine/install/). Free alternatives that run the same images include [Podman](https://podman.io/), [Rancher Desktop](https://rancherdesktop.io/), [Colima](https://github.com/abiosoft/colima) (macOS) and OrbStack (macOS, free for personal use).
- Check it works with `docker version` and `docker run hello-world`. In a real terminal, `docker run` without `-d` stays attached to a server's output until you press Ctrl+C, and `docker run -it alpine sh` opens a shell inside a container (type `exit` to leave).
- Docker Hub limits downloads: 100 pulls per 6 hours for anonymous users (per IP address) and 200 for a free account. `docker login` with a free account doubles your limit, which matters on shared office or CI networks.

:::exercise Your first web server
Run the official `nginx:alpine` image in the background as a container named `web`, with port 8080 on your computer published to port 80 in the container. Then fetch its home page with curl.
```sh starter
docker ps
```
```js check
const c = docker().container("web");
if (!c) throw new AssertionError("There's no container named web yet: give docker run --name web.");
same(c.image, "nginx:alpine", "The web container's image");
if (!c.running) throw new AssertionError(`The web container isn't running (its status is ${c.state}). Start it with -d so it runs in the background.`);
if (!c.ports.includes("8080:80")) throw new AssertionError(`Publish port 8080 to the container's port 80 with -p 8080:80 (it publishes ${c.ports.join(", ") || "no ports"}).`);
if (!ran(/curl\b.*(localhost|127\.0\.0\.1):8080/)) throw new AssertionError("Fetch the page with curl localhost:8080.");
if (!c.logs.includes('"GET / HTTP/1.1" 200')) throw new AssertionError("nginx hasn't served the home page yet: curl localhost:8080.");
```
```sh solution
docker run -d -p 8080:80 --name web nginx:alpine
curl localhost:8080
```
hint: Three options: `-d` (detached), `-p HOST:CONTAINER` and `--name`. They go between `docker run` and the image name.
hint: nginx listens on port 80 inside the container, so the mapping is `-p 8080:80`.
hint: `docker run -d -p 8080:80 --name web nginx:alpine`, then `curl localhost:8080`.
approach:
1. **Understand:** a server's container keeps running, so it should run in the background with a port your computer can reach.
2. **Examples:** `docker run -d -p 8080:80 nginx:alpine` publishes port 80 of the container on port 8080.
3. **Brute force:** without `-d` the terminal stays attached; without `-p`, curl can't reach it.
4. **Pattern:** **docker run -d -p HOST:CONTAINER --name NAME IMAGE** is how most servers are started.
5. **Plan:** run → `docker ps` to see the mapping → curl.
6. **Code and test:** curl prints nginx's welcome page, and `docker logs web` shows the request.
walkthrough:
**Line by line**

- `docker run -d -p 8080:80 --name web nginx:alpine` pulls the image if needed, creates the container `web` and starts nginx in the background.
- `curl localhost:8080` goes to port 8080 on your computer, which Docker forwards to port 80 in the container.

**Trace:** `docker ps` shows `0.0.0.0:8080->80/tcp, [::]:8080->80/tcp`, and `docker logs web` ends with `"GET / HTTP/1.1" 200`.

**Common wrong approach:** `-p 80:8080`, the wrong way round: that publishes port 80 on your computer to port 8080 in the container, where nothing listens, so curl gets `Connection reset by peer`.
:::

:::exercise Clean up
Trying things out leaves containers and images behind. Remove every **stopped** container, then the `hello-world` and `alpine` images. Leave the running `web` container and its `nginx:alpine` image alone.
```sh starter setup=docker-mess
docker ps -a
docker images
```
```js check
const d = docker();
const stopped = d.containers().filter((c) => !c.running);
if (stopped.length) throw new AssertionError(`${stopped.length} stopped container${stopped.length === 1 ? " is" : "s are"} still there (${stopped.map((c) => c.name).join(", ")}): docker rm, or docker container prune.`);
const web = d.container("web");
if (!web || !web.running) throw new AssertionError("Keep the running web container: it should still be up.");
if (d.image("hello-world")) throw new AssertionError("The hello-world image is still there: docker rmi hello-world.");
if (d.image("alpine")) throw new AssertionError("The alpine image is still there: docker rmi alpine.");
if (!d.image("nginx:alpine")) throw new AssertionError("Keep the nginx:alpine image: the web container uses it.");
```
```sh solution setup=docker-mess
docker container prune -f
docker rmi hello-world alpine
docker ps -a
docker images
```
hint: `docker ps -a` shows the stopped containers; `docker container prune -f` removes all of them at once.
hint: Docker refuses to delete an image that a container (even a stopped one) still uses, so remove the containers first.
hint: `docker container prune -f`, then `docker rmi hello-world alpine`.
approach:
1. **Understand:** stopped containers keep their images in use, so images can only go after their containers.
2. **Examples:** `docker rmi hello-world` while its containers exist fails with `image is being used by stopped container`.
3. **Brute force:** `docker rm` each stopped container by name, one by one.
4. **Pattern:** **remove containers before their images**; `prune` removes everything of one kind that nothing needs.
5. **Plan:** prune the stopped containers → `docker rmi` the two images → check with `docker ps -a` and `docker images`.
6. **Code and test:** `docker ps -a` lists only `web`; `docker images` lists `nginx:alpine` and `node:24-slim`.
walkthrough:
**Line by line**

- `docker container prune -f` removes the three stopped containers (`-f` skips the "Are you sure?" question) and leaves the running one.
- `docker rmi hello-world alpine` untags and deletes both images, now that nothing uses them.

**Trace:** prune prints the IDs of three deleted containers; `docker rmi` prints `Untagged:` and `Deleted:` for each image.

**Common wrong approach:** `docker rmi hello-world` first: Docker answers `conflict: unable to delete hello-world (must be forced) - image is being used by stopped container …`. Forcing it with `-f` works, but leaves containers whose image is gone.
:::

:::quiz
? What is the difference between an image and a container?
+ An image is a read-only package; a container is a running or stopped instance created from it
- An image runs in the cloud; a container runs on your computer
- They're two names for the same thing
- A container is a compressed image
= You can create many containers from one image, like many processes from one program.
? Why does a container start much faster than a virtual machine?
+ It's a process on the host's kernel, so there's no operating system to boot
- Containers are written in a faster language
- Docker keeps every container running in advance
- Containers have no files
= A VM boots a whole guest OS; a container only starts its main process, walled off by kernel features.
? What does -p 8080:3000 do?
+ Forwards port 8080 on your computer to port 3000 inside the container
- Forwards port 3000 on your computer to port 8080 in the container
- Limits the container to 8080 MB of memory
- Runs 3000 copies of the container
= The order is always host:container.
? You need an image that never changes, even if its publisher moves the tag. What do you use?
+ The image's digest (name@sha256:…)
- The latest tag
- The lts tag
- docker run --rm
= Tags are movable labels; a digest names exact content.
:::


@@@ lesson
id: dockerfile
title: Writing a Dockerfile
minutes: 34
summary: The shop as a Node.js web API, a Dockerfile's instructions (FROM, WORKDIR, COPY, RUN, EXPOSE, CMD), docker build and its BuildKit output, running and calling your own image, the build context and .dockerignore, exec form versus shell form and BuildKit's build checks, CMD versus ENTRYPOINT, reading build errors, and why a server in a container must listen on every interface.
---
To run your own program in a container, you build your own image. The recipe is a **Dockerfile**: a text file of instructions, each of which changes the image a little.

### The shop as a web API

The bike shop has grown into a small web API, `server.js`, written with Node.js's built-in `node:http` module, so there are no packages to install. It answers `GET /` with a welcome, `GET /prices` with the price list as JSON, `GET /health` with `ok`, and takes orders on `POST /orders`:

```sh setup=docker-shop
ls
head -16 server.js
```

It listens on the port in the `PORT` environment variable, 3000 by default. You don't need to change the JavaScript in this part; you'll package it.

### A first Dockerfile

```sh setup=docker-shop
cat > Dockerfile <<'EOF'
FROM node:24-alpine
WORKDIR /app
COPY . .
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["node", "server.js"]
EOF
docker build -t shop:1.0 .
```

| Instruction | What it does |
|---|---|
| `FROM node:24-alpine` | start from this image (every Dockerfile starts with `FROM`) |
| `WORKDIR /app` | create `/app` and make it the current folder for the next instructions and for the container |
| `COPY . .` | copy files from the **build context** (the folder you build) into the image's current folder |
| `RUN npm ci --omit=dev` | run a command while building; its changes to files become part of the image |
| `EXPOSE 3000` | document the port the app listens on (it publishes nothing by itself) |
| `CMD ["node", "server.js"]` | the command a container runs when it starts |

`docker build -t shop:1.0 .` builds the image from the Dockerfile in `.`, the current folder, and tags it `shop:1.0`. Docker's builder, **BuildKit**, numbers its steps: `#1` reads the Dockerfile, `#2` looks up the base image, then `[1/4]` to `[4/4]` are your `FROM`, `WORKDIR`, `COPY` and `RUN` (instructions like `EXPOSE` and `CMD` only change settings, so they aren't steps). The `RUN` step shows npm's output, with the seconds since the step started. At the end, BuildKit exports the image and names it `docker.io/library/shop:1.0`.

`npm ci` installs exactly what `package-lock.json` says (Part 3), and `--omit=dev` skips development-only packages like test tools. The shop has no packages yet, so it's up to date in a moment.

The sandbox shows BuildKit's *plain* output, which is also what you see in CI. In your own terminal, `docker build` shows a compact view that redraws itself; add `--progress=plain` to get this one.

### Run your image

```sh setup=docker-shop-v1
docker run -d -p 8080:3000 --name shop shop:1.0
curl localhost:8080/
curl -i localhost:8080/prices
docker logs shop
```

`curl -i` shows the response's status line and headers too: `HTTP/1.1 200 OK` and the `Content-Type` that `server.js` set. The container printed one log line when it started and one per request.

### The build context and .dockerignore

`COPY . .` copied the whole folder, including things that don't belong in an image:

```sh setup=docker-shop-v1
docker run --rm shop:1.0 ls -a
```

The image contains `.git`, the whole history of the repository, and `README.md`. Worse candidates are `.env` files with passwords and a local `node_modules` built for your computer's operating system. A **`.dockerignore`** file lists what to leave out of the build context, with the same patterns as `.gitignore`:

```sh setup=docker-shop-v1
cat > .dockerignore <<'EOF'
node_modules
npm-debug.log
.git
.env
data
*.md
EOF
docker build -q -t shop:1.0 .
docker run --rm shop:1.0 ls -a
```

`docker build -q` prints only the new image's ID. The context is smaller, which makes builds faster, and `.git` and `README.md` stay out of the image. (The `Dockerfile` and `.dockerignore` themselves are harmless in the image; some teams list them too.)

### CMD, exec form and shell form

`CMD` has two forms:

- **exec form**, a JSON list: `CMD ["node", "server.js"]`. Docker runs `node` directly as the container's main process.
- **shell form**, plain text: `CMD node server.js`. Docker runs `/bin/sh -c "node server.js"`, so the shell is the main process and `node` is its child. When Docker later asks the container to stop, the signal goes to the shell, which doesn't pass it on (lesson 22 shows what that costs).

BuildKit checks every Dockerfile for problems like this and prints **warnings**, such as `JSONArgsRecommended: JSON arguments recommended for CMD to prevent unintended behavior related to OS signals (line 6)`. `docker build --check .` runs only the checks. Use the exec form.

`ENTRYPOINT` is similar: it's the program, and `CMD` becomes its default arguments. The `node` images set `ENTRYPOINT ["docker-entrypoint.sh"]`, a small script that runs whatever command you give and puts `node` in front of arguments that aren't commands. That's why `docker run --rm shop:1.0 ls -a` ran `ls -a` instead of the server: arguments after the image name replace `CMD`.

### When the build fails

BuildKit shows the failing step, the lines of the Dockerfile around it, and the error:

```sh setup=docker-shop error
cat > Dockerfile <<'EOF'
FROM node:24-alpine
WORKDIR /app
COPPY . .
CMD ["node", "server.js"]
EOF
docker build -t shop:1.0 .
```

`>>>` marks line 3, and BuildKit even suggests the instruction you probably meant. Errors from `RUN` steps show the command's last output lines; errors from `COPY` say which file wasn't found (`"/sever.js": not found`).

### Listen on every interface

Inside a container, `localhost` (127.0.0.1) means *the container itself*. A server that listens only on 127.0.0.1 accepts connections from inside its container, and nothing from outside, including Docker's port forwarding:

```sh setup=docker-shop-v1 error
sed -i 's/server.listen(port,/server.listen(port, "127.0.0.1",/' server.js
grep -n "listen(" server.js
docker build -q -t shop:1.1 .
docker run -d -p 8081:3000 --name local-only shop:1.1
curl localhost:8081/prices
```

The container runs, but curl's connection is dropped. Node.js's `server.listen(port)` listens on every interface by default, which is what a containerized server needs; other frameworks often need `0.0.0.0` (Python's Flask, for example) or `--host 0.0.0.0` (Vite).

### Try it on your own computer

- Everything above runs as shown with Docker Desktop or Docker Engine. Run `npm install` once on your computer if your project has dependencies, so `package-lock.json` exists for `npm ci`.
- `docker init` asks a few questions about your project and writes a starter `Dockerfile`, `compose.yaml` and `.dockerignore`.
- In VS Code, Docker's **Docker DX** extension shows BuildKit's build checks as you type a Dockerfile, and the **Container Tools** extension lists your images and containers.

:::exercise Containerize the shop
`~/shop` has the shop's API but no Dockerfile. Write a Dockerfile that starts from `node:24-alpine`, works in `/app`, copies the project in, runs `npm ci --omit=dev`, documents port 3000 and starts the server with `node server.js` in exec form. Build it as `shop:1.0`, run it in the background as a container named `shop` with port 8080 published to port 3000, and fetch `/prices` with curl.
```sh starter setup=docker-shop
ls
```
```js check
const img = docker().image("shop:1.0");
if (!img) throw new AssertionError("There's no image shop:1.0 yet: docker build -t shop:1.0 .");
if (!img.built) throw new AssertionError("Build shop:1.0 from your Dockerfile.");
same(img.config.Cmd, ["node", "server.js"], "The image's CMD (in exec form)");
same(img.config.WorkingDir, "/app", "The image's WORKDIR");
if (!img.config.ExposedPorts || !("3000/tcp" in img.config.ExposedPorts)) throw new AssertionError("Document the port with EXPOSE 3000.");
if (!img.read("/app/server.js")) throw new AssertionError("server.js isn't in /app in the image: COPY . . after WORKDIR /app.");
if (!/^FROM node:24-alpine\b/im.test(read("~/shop/Dockerfile") ?? "")) throw new AssertionError("Start the Dockerfile with FROM node:24-alpine.");
if (!/^RUN npm ci --omit=dev\s*$/m.test(read("~/shop/Dockerfile") ?? "")) throw new AssertionError("Install the dependencies with RUN npm ci --omit=dev.");
const c = docker().container("shop");
if (!c || !c.running) throw new AssertionError("Run the image in the background as a container named shop (docker run -d … --name shop shop:1.0).");
same(c.image, "shop:1.0", "The shop container's image");
if (!c.ports.includes("8080:3000")) throw new AssertionError("Publish port 8080 to the container's port 3000: -p 8080:3000.");
if (!c.logs.includes("GET /prices")) throw new AssertionError("Fetch the price list: curl localhost:8080/prices.");
```
```sh solution setup=docker-shop
cat > Dockerfile <<'EOF'
FROM node:24-alpine
WORKDIR /app
COPY . .
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["node", "server.js"]
EOF
docker build -t shop:1.0 .
docker run -d -p 8080:3000 --name shop shop:1.0
curl localhost:8080/prices
```
hint: Six instructions, one per line: `FROM`, `WORKDIR`, `COPY`, `RUN`, `EXPOSE`, `CMD`. Write the file with `cat > Dockerfile <<'EOF'` … `EOF`.
hint: Exec form is a JSON list with double quotes: `CMD ["node", "server.js"]`.
hint: Build with `docker build -t shop:1.0 .` (don't forget the final dot), then `docker run -d -p 8080:3000 --name shop shop:1.0` and `curl localhost:8080/prices`.
approach:
1. **Understand:** an image is your app plus a base; the Dockerfile says how to put them together and how to start the app.
2. **Examples:** the lesson's Dockerfile builds in four steps and runs `node server.js`.
3. **Brute force:** you could start `node:24-alpine`, copy files in with `docker cp` and commit the container, but nobody could repeat that.
4. **Pattern:** **FROM a base, WORKDIR, COPY, RUN the install, CMD the start command**: the skeleton of most Dockerfiles.
5. **Plan:** write the Dockerfile → build with a tag → run with a published port → curl.
6. **Code and test:** the build ends with `naming to docker.io/library/shop:1.0`; curl prints the JSON price list.
walkthrough:
**Line by line**

- `FROM node:24-alpine` starts from Node.js 24 on Alpine Linux.
- `WORKDIR /app` makes `/app` the folder for the rest of the build and for the running container.
- `COPY . .` copies the build context into `/app`; `RUN npm ci --omit=dev` installs the production dependencies (none yet).
- `EXPOSE 3000` documents the port; `CMD ["node", "server.js"]` starts the server as the container's main process.
- `docker run -d -p 8080:3000 --name shop shop:1.0` runs it; curl calls it through port 8080.

**Trace:** the build shows `[1/4] FROM …`, `[2/4] WORKDIR /app`, `[3/4] COPY . .`, `[4/4] RUN npm ci --omit=dev`; curl prints `{"bell":800,"pump":3000,"lock":2900}`.

**Common wrong approach:** `CMD node server.js` works, but BuildKit warns `JSONArgsRecommended`, and the container won't stop cleanly because the signal goes to a shell instead of Node.js.
:::

:::exercise Fix the broken build
The Dockerfile in `~/shop` doesn't build. Fix it so that `docker build -t shop:1.0 .` succeeds with no errors **and no warnings**, keeping the same instructions: the image must still contain `server.js` and `prices.js` in `/app`, document port 3000, and start with `node server.js`.
```sh starter setup=docker-shop-broken
cat Dockerfile
docker build -t shop:1.0 .
```
```js check
const df = read("~/shop/Dockerfile") ?? "";
const out = await sh("cd ~/shop && docker build -t check:1 .");
if (/ERROR:/.test(out)) throw new AssertionError("The Dockerfile still doesn't build: " + (out.split("\n").filter((l) => l.startsWith("ERROR:")).pop() ?? ""));
if (/warning/.test(out)) throw new AssertionError("The build still has warnings: " + (out.split("\n").filter((l) => l.startsWith(" - ")).join("; ")));
const img = docker().image("shop:1.0");
if (!img) throw new AssertionError("Build the fixed Dockerfile as shop:1.0.");
if (!img.read("/app/server.js") || !img.read("/app/prices.js")) throw new AssertionError("The image needs both server.js and prices.js in /app.");
same(img.config.Cmd, ["node", "server.js"], "The image's CMD");
if (!img.config.ExposedPorts || !("3000/tcp" in img.config.ExposedPorts)) throw new AssertionError("Keep EXPOSE 3000.");
if (!/^COPY package\*\.json \.\/\s*$/m.test(df) || !/^RUN npm ci --omit=dev\s*$/m.test(df)) throw new AssertionError("Keep the COPY package*.json ./ and RUN npm ci --omit=dev lines.");
```
```sh solution setup=docker-shop-broken
sed -i 's/^COPY sever.js/COPY server.js/; s/^EXPOS 3000/EXPOSE 3000/; s/^CMD node server.js/CMD ["node", "server.js"]/' Dockerfile
cat Dockerfile
docker build -t shop:1.0 .
```
hint: Build, read the error, fix that line, and build again. BuildKit stops at the first error, so the errors appear one at a time.
hint: There are two typos (an instruction and a file name) and one warning (`JSONArgsRecommended`).
hint: `COPY server.js prices.js ./`, `EXPOSE 3000` and `CMD ["node", "server.js"]`.
approach:
1. **Understand:** a Dockerfile is parsed first (unknown instructions fail before anything runs), then each step runs, then the build checks report warnings.
2. **Examples:** `>>>` points at the failing line, and the error says what's wrong.
3. **Brute force:** rewriting the whole file from memory risks new mistakes.
4. **Pattern:** **fix the first error, rebuild, repeat**, then make the warnings go away too.
5. **Plan:** build → fix `EXPOS` → build → fix `sever.js` → build → exec-form `CMD` → build.
6. **Code and test:** the last build ends with `naming to docker.io/library/shop:1.0` and no warning list.
walkthrough:
**Line by line**

- The `sed` command makes three substitutions at once: the file name in `COPY`, the instruction `EXPOS` and the shell-form `CMD`.
- `docker build -t shop:1.0 .` now runs every step.

**Trace:** the first build fails with `dockerfile parse error on line 6: unknown instruction: EXPOS (did you mean expose?)`; after that fix, `COPY` fails with `"/sever.js": not found`; after that, the build passes but warns about line 7.

**Common wrong approach:** stopping when the build succeeds. The warning is about a real problem: with a shell-form `CMD`, `docker stop` has to kill the container after 10 seconds.
:::

:::quiz
? What does COPY . . copy?
+ The build context (the folder given to docker build, minus .dockerignore) into the image's working directory
- Every file on your computer
- The image into the current folder
- Only the Dockerfile
= The first dot is the context, the second is the destination (WORKDIR).
? Which instruction runs while the image is built, not when a container starts?
+ RUN
- CMD
- ENTRYPOINT
- EXPOSE
= RUN changes the image during the build; CMD and ENTRYPOINT say what a container runs later.
? Why is CMD ["node", "server.js"] better than CMD node server.js?
+ It runs node directly as the main process, so it receives the stop signal
- It's faster to type
- Shell form doesn't work on Alpine
- Exec form makes the image smaller
= Shell form runs /bin/sh -c, and the shell doesn't forward signals to node.
? A server in a container listens on 127.0.0.1:3000 and is published with -p 8080:3000. What happens when you curl localhost:8080?
+ The connection fails: 127.0.0.1 inside the container only accepts connections from inside it
- It works: localhost is the same everywhere
- It works only on macOS
- Docker rewrites the address automatically
= Servers in containers must listen on all interfaces (0.0.0.0 or ::), which node:http does by default.
:::


@@@ lesson
id: layers
title: Layers, caching and smaller images
minutes: 32
summary: How layers make up an image, docker history, how the build cache works and ordering instructions so dependencies don't reinstall on every code change, choosing a base image (alpine, slim, full, distroless, hardened), NODE_ENV and production installs, running as a non-root user, multi-stage builds that test in one stage and ship from another, keeping secrets out of images, and pinning versions with tags and digests.
---
A working image is a start. A good one builds fast, is small, and gives an attacker as little as possible. All three come from understanding **layers**.

### Layers

![A stack of read-only layers, bottom to top: ADD alpine-minirootfs 8.79MB, RUN install Node.js 157MB, RUN install Yarn 5.34MB, COPY docker-entrypoint.sh 388B (together node:24-alpine), then your build steps WORKDIR /app 0B, COPY package*.json 311B, RUN npm ci 4.1kB and COPY . . 2.18kB, and on top a container's thin writable layer](figures/image-layers.svg)

Each `RUN`, `COPY` and `WORKDIR` adds a read-only layer with the files that step changed. A container adds a thin writable layer on top; deleting the container deletes that layer and everything written to it. `docker history` lists an image's layers, newest first:

```sh setup=docker-shop-built
docker history shop:1.0
```

Only the top line names an image; `<missing>` means that layer isn't an image of its own, not that anything is wrong. Two images built `FROM node:24-alpine` share its layers on disk and in downloads.

### The build cache

BuildKit keeps every layer it builds. Next time, a step whose inputs haven't changed (the same instruction, on the same parent layer, copying files with the same content) is `CACHED` and takes no time. Once one step changes, every step after it runs again. That makes the *order* of a Dockerfile matter:

```sh setup=docker-shop-slow
cat Dockerfile
echo "// a small change" >> server.js
docker build -t shop:1.1 . | grep -A2 -E "\] (COPY|RUN)"
```

Changing one line of `server.js` changed what `COPY . .` copies, so `npm ci` ran again, and in a real project downloads hundreds of packages. Copy the files that decide the dependencies first, install, and copy the code last:

```sh setup=docker-shop-slow
cat > Dockerfile <<'EOF'
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
EOF
docker build -q -t shop:1.1 .
echo "// a small change" >> server.js
docker build -t shop:1.1 . | grep -A2 -E "\] (COPY|RUN)"
```

Now a code change only reruns `COPY . .`. Dependencies are re-installed only when `package.json` or `package-lock.json` change. `docker build --no-cache` ignores the cache when you need a completely fresh build.

### Smaller and safer images

The base image is most of your image. The shop's API works on any of these:

```sh setup=docker-shop-built
docker pull -q node:24-slim
docker pull -q node:24
docker images
```

| Base | Disk usage | Has |
|---|---|---|
| `node:24` | 1.54GB | Debian with compilers, git, curl, Python: useful for building, wasteful for running |
| `node:24-slim` | 327MB | Debian's minimal userland, glibc |
| `node:24-alpine` | 234MB | Alpine's musl and BusyBox (no bash, no curl; `wget` instead) |

Even smaller: Google's **distroless** Node.js images (`gcr.io/distroless/nodejs…`) contain Node.js and nothing else, not even a shell, and **Docker Hardened Images**, free and open source since December 2025, are minimal, regularly patched versions of popular images. Fewer programs mean fewer known vulnerabilities to patch and fewer tools for an attacker. The trade-off is debugging: with no shell, `docker exec … sh` doesn't work. Alpine's musl occasionally breaks packages with native code; switch to `-slim` if that happens.

Two more settings belong in every production Node.js image: `ENV NODE_ENV=production`, which many libraries read to turn off development features, and `npm ci --omit=dev`, which leaves test tools out.

### Don't run as root

By default a container's process runs as `root`. Container root is restricted, but if an attacker finds a hole in your app, root makes the next step easier. The `node` images include a user called `node`:

```sh setup=docker-shop-v1
docker run --rm shop:1.0 whoami
cat > Dockerfile <<'EOF'
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p data && chown node:node data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
EOF
docker build -q -t shop:1.0 .
docker run --rm shop:1.0 whoami
```

`USER node` makes everything after it, and the container, run as `node`. Files copied in belong to `root`, so `node` can read the code but not change it, which is what you want. The shop writes orders to `data/`, so the Dockerfile creates that one folder and gives it to `node` before switching user.

### Multi-stage builds

A Dockerfile can have several `FROM`s. Each starts a **stage**, and a later stage can copy files from an earlier one with `COPY --from=NAME`. The final stage is the image; everything else is thrown away. Use it to run the tests during the build, or to compile with tools the final image doesn't need:

```sh setup=docker-shop-built
cat > Dockerfile <<'EOF'
FROM node:24-alpine AS test
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm test

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=test /app/prices.js /app/server.js ./
RUN mkdir -p data && chown node:node data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
EOF
docker build -t shop:2.0 . | grep -E "^#[0-9]+ \[|✔|ℹ (pass|fail)"
docker run --rm shop:2.0 ls
```

The steps are labeled with their stage (`test`, and `stage-1` for the unnamed final one), and steps that are identical in both stages run once. The tests ran inside the build: if one fails, the build fails, and no image is made. The final image has no test files. BuildKit builds only the stages the final stage needs, so the final stage copies `prices.js` and `server.js` *from* the test stage: copy them from the build context instead, and BuildKit would skip the tests entirely.

### Keep secrets out of images

Every layer and every `ENV` value is readable by anyone who has the image:

```sh setup=docker-shop-built
printf 'FROM shop:1.0\nENV PAYMENT_API_TOKEN=tok_live_83d1c47e\n' > Dockerfile.bad
docker build -f Dockerfile.bad -t shop:leaky . | grep -A1 "warning found"
docker history shop:leaky | head -2
```

BuildKit's `SecretsUsedInArgOrEnv` check warns about variable names that look like secrets, and `docker history` shows the value to anyone. Deleting a file in a later `RUN` doesn't help either: it's still in the earlier layer. Give secrets to the *container* when it starts (next lesson), and for secrets the *build* needs, such as a private package registry's token, use build secrets: `RUN --mount=type=secret,id=npmrc …`, which mounts the secret for that one step without storing it.

### Pin, update and scan

- Pin the base image so builds are repeatable: `node:24.22.0-alpine3.24`, or exactly with a digest, `node:24-alpine@sha256:44fce696…`.
- Pinning means updates don't happen by themselves: Dependabot or Renovate (Part 3) can open pull requests that bump `FROM` lines, so you get security fixes on purpose.
- Scanners list known vulnerabilities in an image's packages: `docker scout quickview shop:1.0` (Docker Scout) on your own computer, or Trivy and Grype in CI.
- BuildKit attaches an **attestation** to images (`exporting attestation manifest`): a signed record of how the image was built. Add `--sbom=true` for a software bill of materials, the list of everything inside.

### Try it on your own computer

- Try the build cache on a real project with dependencies: add a package (`npm install express`), build, change a source file, and build again: the `npm ci` step says `CACHED`.
- Compare base images with `docker images` after `docker pull node:24-slim` and `docker pull node:24`.
- `docker scout quickview` and `docker scout cves` need a free Docker account; [Trivy](https://trivy.dev/) is a free, open-source alternative.

:::exercise Order for the cache
In `~/shop`, every change to the code re-installs the dependencies. Reorder the Dockerfile so that `package.json` and `package-lock.json` are copied and `npm ci --omit=dev` runs **before** the rest of the code is copied, and build it as `shop:1.1`. Keep everything else the same.
```sh starter setup=docker-shop-slow
cat Dockerfile
```
```js check
const df = (read("~/shop/Dockerfile") ?? "").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
const iPkg = df.findIndex((l) => /^COPY package(\*|\.json)?/.test(l) && !/^COPY \. \./.test(l));
const iCi = df.findIndex((l) => /^RUN npm ci --omit=dev$/.test(l));
const iAll = df.findIndex((l) => /^COPY \. \.$/.test(l));
if (iCi < 0) throw new AssertionError("Keep RUN npm ci --omit=dev.");
if (iAll < 0) throw new AssertionError("Keep COPY . . to copy the code.");
if (iPkg < 0) throw new AssertionError("Copy the package files on their own first: COPY package*.json ./");
if (!(iPkg < iCi && iCi < iAll)) throw new AssertionError("The order should be: COPY package*.json ./, then RUN npm ci --omit=dev, then COPY . .");
if (!docker().image("shop:1.1")) throw new AssertionError("Build the reordered Dockerfile as shop:1.1.");
// prove it: change the code and build again; the install must come from the cache
const out = await sh("cd ~/shop && echo '// touched by the check' >> server.js && docker build -t check:1 .");
const ci = out.split("\n\n").find((b) => /\] RUN npm ci --omit=dev/.test(b)) ?? "";
if (!/CACHED/.test(ci)) throw new AssertionError("After a code change, RUN npm ci should be CACHED, but it ran again.");
```
```sh solution setup=docker-shop-slow
cat > Dockerfile <<'EOF'
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
EOF
docker build -t shop:1.1 .
echo "// a change" >> server.js
docker build -t shop:1.1 .
```
hint: The cache is lost from the first step whose inputs change. Which files does `npm ci` actually need?
hint: Only `package.json` and `package-lock.json`: copy them with `COPY package*.json ./` before `RUN npm ci --omit=dev`, then `COPY . .`.
hint: Build twice, changing `server.js` in between, and look for `CACHED` on the `RUN npm ci` step.
approach:
1. **Understand:** a step is cached only if its parent layer and its own inputs are unchanged.
2. **Examples:** with `COPY . .` first, any edit changes that layer, so every later step reruns.
3. **Brute force:** `--no-cache` everywhere would be slow; never changing code isn't an option.
4. **Pattern:** **order a Dockerfile from what changes least to what changes most**: base, dependency files, install, code.
5. **Plan:** move the package files and the install above `COPY . .` → build → edit → build.
6. **Code and test:** the second build shows `CACHED` for `COPY package*.json` and `RUN npm ci`, and only `COPY . .` runs.
walkthrough:
**Line by line**

- `COPY package*.json ./` copies only `package.json` and `package-lock.json`, so this layer changes only when dependencies change.
- `RUN npm ci --omit=dev` sits on that layer, so it's cached as long as the dependencies are the same.
- `COPY . .` comes last: code changes only invalidate this one, cheap step.

**Trace:** after the edit, the build prints `#7 [3/5] COPY package*.json ./` → `CACHED`, `#8 [4/5] RUN npm ci --omit=dev` → `CACHED`, then `#9 [5/5] COPY . .` → `DONE`.

**Common wrong approach:** `COPY package.json ./` without the lock file: `npm ci` refuses to run without `package-lock.json`, so the build fails.
:::

:::exercise Test in one stage, ship from another
Turn the shop's Dockerfile into a multi-stage build, tagged `shop:2.0`. A first stage named `test` installs **all** dependencies (`npm ci`), copies the project and runs `npm test`. The final stage starts again from `node:24-alpine`, sets `NODE_ENV=production`, installs production dependencies, copies only `prices.js` and `server.js` **from the test stage**, creates the `data` folder owned by `node`, runs as `node` and starts the server. The final image must not contain the test file.
```sh starter setup=docker-shop-built
cat Dockerfile
```
```js check
const df = read("~/shop/Dockerfile") ?? "";
const froms = df.split("\n").filter((l) => /^FROM\s/i.test(l.trim()));
if (froms.length < 2) throw new AssertionError("A multi-stage build has two FROM lines: one for the test stage and one for the final image.");
if (!/^FROM node:24-alpine AS test\s*$/im.test(df)) throw new AssertionError("Name the first stage test: FROM node:24-alpine AS test.");
if (!/--from=test\b/.test(df)) throw new AssertionError("Copy the code into the final stage with COPY --from=test …, so BuildKit has to run the test stage.");
const img = docker().image("shop:2.0");
if (!img) throw new AssertionError("Build it as shop:2.0.");
if (img.read("/app/prices.test.js") !== null) throw new AssertionError("The final image still contains prices.test.js: copy only prices.js and server.js into it.");
if (!img.read("/app/server.js") || !img.read("/app/prices.js")) throw new AssertionError("The final image needs /app/server.js and /app/prices.js.");
same(img.config.User, "node", "The final image's USER");
if (!(img.config.Env ?? []).includes("NODE_ENV=production")) throw new AssertionError("Set ENV NODE_ENV=production in the final stage.");
same(img.config.Cmd, ["node", "server.js"], "The final image's CMD");
const out = await sh("cd ~/shop && docker build --no-cache -t check:2 .");
if (!/\[test \d+\/\d+\] RUN npm test/.test(out) || !/✔ adds up a basket/.test(out)) throw new AssertionError("The build doesn't run the tests: the test stage needs RUN npm test, and the final stage must copy from it.");
```
```sh solution setup=docker-shop-built
cat > Dockerfile <<'EOF'
FROM node:24-alpine AS test
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm test

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=test /app/prices.js /app/server.js ./
RUN mkdir -p data && chown node:node data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
EOF
docker build -t shop:2.0 .
docker run --rm shop:2.0 ls
```
hint: Two stages: `FROM node:24-alpine AS test` with the test steps, then a second `FROM node:24-alpine` for the final image.
hint: In the final stage, `COPY --from=test /app/prices.js /app/server.js ./` copies just those two files out of the test stage.
hint: The lesson's multi-stage example is the whole answer; build it with `docker build -t shop:2.0 .` and check with `docker run --rm shop:2.0 ls`.
approach:
1. **Understand:** each `FROM` starts a fresh stage; only the last one becomes the image, and BuildKit skips stages the last one doesn't use.
2. **Examples:** `COPY --from=test` makes the final stage depend on the test stage, so the tests must pass first.
3. **Brute force:** running `npm test` in the final stage would ship test files and dev dependencies.
4. **Pattern:** **build and test in one stage, copy only the results into a clean final stage**.
5. **Plan:** write the two stages → build `shop:2.0` → list `/app` in the image.
6. **Code and test:** the build shows `✔` lines from the `test` stage; `ls` in the image shows `node_modules`? No: `data`, `package-lock.json`, `package.json`, `prices.js`, `server.js`.
walkthrough:
**Line by line**

- Stage `test` installs every dependency (`npm ci`, including dev tools), copies the project and runs `npm test`; a failing test fails the whole build.
- The final stage installs only production dependencies and copies the two source files from the test stage, which makes BuildKit run that stage.
- `chown` and `USER node` make the app run without root, able to write only to `data/`.

**Trace:** the output shows `[test 6/6] RUN npm test` with `✔ adds up a basket` and `ℹ pass 2`, then `[stage-1 5/6] COPY --from=test …`.

**Common wrong approach:** `COPY prices.js server.js ./` in the final stage: the image is fine, but nothing needs the test stage any more, so BuildKit never runs the tests.
:::

:::quiz
? You change one line in server.js. With COPY . . before RUN npm ci, what happens on the next build?
+ npm ci runs again, because the layer it's built on changed
- Nothing is rebuilt
- Only the CMD changes
- The build fails
= Every step after the first changed one runs again; copy the package files and install first.
? What does USER node do?
+ Runs the following instructions and the container's process as the user node instead of root
- Creates a new user called node
- Lets the node image run without Docker
- Gives node access to the host's files
= The node images already have a node user; USER switches to it.
? In a multi-stage build, which stage becomes the image?
+ The last stage (or the one named with --target)
- The first stage
- All stages, merged together
- The largest stage
= Earlier stages only exist to produce files the final stage copies in.
? Why is ENV API_TOKEN=… in a Dockerfile dangerous?
+ Anyone with the image can read it, for example with docker history or docker inspect
- ENV only works for numbers
- It makes the image larger
- Docker refuses to build it
= BuildKit warns (SecretsUsedInArgOrEnv); give secrets to containers at run time, or use build secrets.
:::


@@@ lesson
id: running
title: "Running containers: configuration, logs, signals and data"
minutes: 36
summary: Configuring containers with environment variables and env files, reading logs, running commands with docker exec and docker inspect, how docker stop works (SIGTERM, PID 1, the 10-second timeout and exit codes 0, 1, 137 and 143) and shutting down gracefully, restart policies after a crash, health checks, keeping data in volumes and bind mounts, and limiting memory and CPU.
---
Images are built once and run in many places: on your laptop, in CI, in production. This lesson is about everything that happens at run time.

### Configuration with environment variables

The same image should run everywhere, so settings that differ between places come from **environment variables**, not from the image. The shop reads `PORT` and `SHOP_NAME`:

```sh setup=docker-shop-built
docker run -d -p 8080:3000 -e SHOP_NAME="Ada's Bikes" --name shop shop:1.0
curl localhost:8080/
docker inspect -f '{{json .Config.Env}}' shop
```

`-e NAME=value` sets a variable (repeat it for more); `--env-file .env` reads `NAME=value` lines from a file. `docker inspect` shows a container's full configuration, and `-f` picks one field with a Go template. Note that anyone who can run `docker inspect` sees the variables: real secrets come from a secrets manager in production (Part 7), and `.env` files belong in `.gitignore` and `.dockerignore`.

### Logs, exec and inspect

```sh setup=docker-shop-running
curl -s localhost:8080/prices > /dev/null
docker logs shop
docker exec shop ls -l
docker exec shop ps
docker inspect -f '{{.State.Status}} since {{.State.StartedAt}}' shop
```

- **Logs:** Docker collects whatever the main process writes to standard output and standard error. Containerized apps should log there instead of to files. `docker logs -f` follows new lines (Ctrl+C to stop), and `--tail 20` shows only the last 20.
- **`docker exec`** runs another command inside a running container, here `ls` and `ps`. `ps` shows `node server.js` as **PID 1**, the container's main process. In a real terminal, `docker exec -it shop sh` opens a shell inside it (Alpine images have `sh`, not `bash`).

### Stopping: signals, PID 1 and exit codes

`docker stop` sends the main process the signal **SIGTERM** ("please finish"), waits up to 10 seconds, then sends **SIGKILL**, which can't be refused. A program normally ends on SIGTERM, but PID 1 is special: Linux doesn't apply default signal actions to it, so Node.js as PID 1 ignores SIGTERM unless the code handles it:

```sh setup=docker-shop-running
docker stop shop
docker ps -a
```

The stop took the full 10 seconds, and `Exited (137)` (128 + 9, SIGKILL) shows the container was killed, mid-request if there was one. Handle SIGTERM: stop accepting connections, let the open requests finish, then exit:

```sh setup=docker-shop-built
cat >> server.js <<'EOF'

// docker stop sends SIGTERM: finish the open requests, then exit
process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing the server");
  server.close(() => process.exit(0));
});
EOF
docker build -q -t shop:1.1 .
docker run -d -p 8080:3000 --name shop shop:1.1
docker stop shop
docker ps -a
docker logs shop
```

Now it stops at once with `Exited (0)`. Exit codes tell you how a container ended:

| Exit code | Meaning |
|---|---|
| 0 | the process ended normally |
| 1 | the process failed, for example with an uncaught error |
| 137 | killed with SIGKILL (128 + 9): `docker stop` timed out, `docker kill`, or out of memory |
| 143 | ended by SIGTERM (128 + 15) without handling it, for example with `docker run --init` |
| 125, 126, 127 | Docker couldn't run it: a bad option, a command that can't run, a command not found |

`docker run --init` puts a tiny init process as PID 1 that forwards signals, a quick fix when you can't change the code. Shell-form `CMD`s have the same problem as unhandled SIGTERM, which is why BuildKit warns about them.

### When the process crashes: restart policies

A bug that throws an uncaught error ends Node.js, and with it the container. The shop has one: an order that isn't valid JSON. A **restart policy** tells Docker to start the container again:

```sh setup=docker-shop-built
docker run -d -p 8080:3000 --restart on-failure --name shop shop:1.0
curl -s -d 'not json' localhost:8080/orders
docker ps
docker inspect -f '{{.RestartCount}}' shop
docker logs shop
```

The request killed the process (curl got an empty reply), Docker restarted the container, and the logs show the error and the second start. Policies: `no` (the default), `on-failure[:N]` (only after a non-zero exit, at most N times), `always`, and `unless-stopped` (like `always`, but not after you stopped it yourself). A restart policy keeps a service available; it doesn't fix the bug, so read the logs.

### Health checks

A process can be running and still broken, for example stuck or unable to reach its database. A **health check** is a command Docker runs inside the container at intervals; exit status 0 means healthy:

```sh setup=docker-shop-built
cat >> Dockerfile <<'EOF'
HEALTHCHECK --interval=10s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
EOF
docker build -q -t shop:1.1 .
docker run -d -p 8080:3000 --name shop shop:1.1
docker ps
sleep 12
docker ps
docker inspect -f '{{.State.Health.Status}}' shop
```

The status goes from `health: starting` to `healthy`, or to `unhealthy` after three failed checks in a row. Alpine images have BusyBox's `wget` but no `curl`, hence `wget -qO-` (print the page) in the check. Docker itself only reports health; Compose (next lesson) and orchestrators like Kubernetes act on it.

### Data that outlives a container

Anything a container writes goes to its writable layer and disappears with the container. The shop saves orders in `/app/data`; mount a **volume** there and the data survives:

```sh setup=docker-shop-built
docker run -d -p 8080:3000 -v shop-data:/app/data --name shop shop:1.0
curl -s -d '{"items": ["bell", "lock"]}' localhost:8080/orders
docker rm -f shop
docker run -d -p 8080:3000 -v shop-data:/app/data --name shop shop:1.0
curl localhost:8080/orders
docker volume ls
```

`-v shop-data:/app/data` mounts the **named volume** `shop-data` (Docker creates it the first time) at `/app/data`. `docker rm -f` stops and removes a container in one go; the volume is untouched, so the new container sees the order. Remove volumes deliberately with `docker volume rm`.

A **bind mount** mounts a folder of your computer instead, `-v ./site:/usr/share/nginx/html:ro`: edit the files on your computer and the container sees the change immediately, which is handy during development. `:ro` makes it read-only for the container. Use volumes for data that belongs to the container, bind mounts for files you edit.

### Limits

Without limits, one container can use all of the machine's memory and CPU:

```sh setup=docker-shop-built
docker run -d -p 8080:3000 --memory 256m --cpus 0.5 --name shop shop:1.0
docker stats --no-stream
```

`--memory 256m` caps memory (a container that goes over is killed, exit code 137); `--cpus 0.5` gives it at most half a CPU. `docker stats` shows live usage; Node.js 24 sizes its memory use to the container's limit automatically.

### Try it on your own computer

- In a real terminal, `docker logs -f shop` follows the log until Ctrl+C, and `docker exec -it shop sh` gives you a shell inside the container; `exit` leaves it.
- Time the difference: `time docker stop shop` takes 10 seconds without the SIGTERM handler and well under one with it.
- Docker Desktop's **Containers** view shows the same logs, files, stats and an exec terminal for each container.

:::exercise Graceful shutdown
`docker stop` takes 10 seconds on the shop and then kills it. Add a SIGTERM handler at the end of `server.js` that closes the server and exits with status 0, build the image as `shop:1.1`, run it as a container named `shop` (port 8080 to 3000), and stop it. It should end with exit code 0.
```sh starter setup=docker-shop-built
tail -3 server.js
```
```js check
const src = read("~/shop/server.js") ?? "";
if (!/process\.on\(\s*["']SIGTERM["']/.test(src)) throw new AssertionError('Handle the signal in server.js: process.on("SIGTERM", () => { … }).');
const img = docker().image("shop:1.1");
if (!img) throw new AssertionError("Build the changed code as shop:1.1.");
if (!/SIGTERM/.test(img.read("/app/server.js") ?? "")) throw new AssertionError("shop:1.1 doesn't have the SIGTERM handler: build it after changing server.js.");
const c = docker().container("shop");
if (!c) throw new AssertionError("Run shop:1.1 as a container named shop.");
same(c.image, "shop:1.1", "The shop container's image");
if (c.running) throw new AssertionError("Stop the container with docker stop shop.");
same(c.exitCode, 0, "The stopped container's exit code");
```
```sh solution setup=docker-shop-built
cat >> server.js <<'EOF'

process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing the server");
  server.close(() => process.exit(0));
});
EOF
docker build -t shop:1.1 .
docker run -d -p 8080:3000 --name shop shop:1.1
docker stop shop
docker ps -a
```
hint: Append the handler with `cat >> server.js <<'EOF'` … `EOF`; `server` is the variable the file already uses for the HTTP server.
hint: `server.close(callback)` stops accepting new connections and calls the callback when the open ones are done; exit there with `process.exit(0)`.
hint: Rebuild (`docker build -t shop:1.1 .`) after editing: a running container never sees changes to your files. Then run, `docker stop shop`, and `docker ps -a`.
approach:
1. **Understand:** Node.js as PID 1 ignores SIGTERM unless the program handles it, so Docker kills it after 10 seconds.
2. **Examples:** without a handler, `docker ps -a` shows `Exited (137)`.
3. **Brute force:** `docker kill` is instant but drops requests in progress, the same as SIGKILL.
4. **Pattern:** **handle SIGTERM: stop accepting work, finish what's in progress, exit 0**.
5. **Plan:** append the handler → rebuild with a new tag → run → stop → check the exit code.
6. **Code and test:** `docker stop shop` returns at once and `docker ps -a` shows `Exited (0)`; the log ends with `SIGTERM received, closing the server`.
walkthrough:
**Line by line**

- `process.on("SIGTERM", …)` registers a function Node.js calls when the signal arrives.
- `server.close(…)` stops listening and waits for open connections; its callback runs `process.exit(0)`.
- The new image `shop:1.1` contains the changed file; the old container would still run the old code.

**Trace:** `docker stop shop` prints `shop` immediately; `docker ps -a` shows `Exited (0) Less than a second ago`.

**Common wrong approach:** editing `server.js` and running `shop:1.0` again: images don't change when files do, so the handler isn't there until you rebuild.
:::

:::exercise Keep the orders
Run the shop so that it survives crashes and keeps its data: a container named `shop` from `shop:1.0`, port 8080 to 3000, a named volume `shop-data` mounted at `/app/data`, the restart policy `unless-stopped`, and `SHOP_NAME` set to `Ada's Bikes`. Place an order (`curl -d '{"items": ["bell"]}' localhost:8080/orders`), then remove the container and start it again the same way. `curl localhost:8080/orders` must still list the order.
```sh starter setup=docker-shop-built
docker volume ls
```
```js check
const d = docker();
const c = d.container("shop");
if (!c || !c.running) throw new AssertionError("Run the shop again as a container named shop.");
same(c.image, "shop:1.0", "The shop container's image");
if (!c.ports.includes("8080:3000")) throw new AssertionError("Publish port 8080 to 3000: -p 8080:3000.");
const m = c.mounts.find((x) => x.target === "/app/data");
if (!m || m.type !== "volume" || m.source !== "shop-data") throw new AssertionError("Mount the named volume shop-data at /app/data: -v shop-data:/app/data.");
same(c.restart, "unless-stopped", "The container's restart policy");
same(c.env.SHOP_NAME, "Ada's Bikes", "SHOP_NAME in the container");
if (!ran(/docker (container )?rm\b/)) throw new AssertionError("Remove the first container (docker rm -f shop) and start a new one, to show the data survives.");
const vol = d.volumes().find((v) => v.name === "shop-data");
if (!vol || !/"bell"/.test(vol.files["orders.jsonl"] ?? "")) throw new AssertionError("The volume has no order with a bell yet: curl -d '{\"items\": [\"bell\"]}' localhost:8080/orders.");
const r = await d.request("http://localhost:8080/orders");
if (!r.body || !r.body.includes('"bell"')) throw new AssertionError("The running container doesn't list the order: is the volume mounted at /app/data?");
```
```sh solution setup=docker-shop-built
docker run -d -p 8080:3000 -v shop-data:/app/data --restart unless-stopped -e SHOP_NAME="Ada's Bikes" --name shop shop:1.0
curl -d '{"items": ["bell"]}' localhost:8080/orders
docker rm -f shop
docker run -d -p 8080:3000 -v shop-data:/app/data --restart unless-stopped -e SHOP_NAME="Ada's Bikes" --name shop shop:1.0
curl localhost:8080/orders
curl localhost:8080/
```
hint: All the settings are options of `docker run`: `-p`, `-v NAME:PATH`, `--restart POLICY`, `-e NAME=value` and `--name`.
hint: Quote the shop name because of the space and the apostrophe: `-e SHOP_NAME="Ada's Bikes"`.
hint: `docker rm -f shop` removes the running container; then run exactly the same `docker run` again and `curl localhost:8080/orders`.
approach:
1. **Understand:** containers are disposable; data that matters lives in a volume, outside any one container.
2. **Examples:** without `-v`, a new container starts with an empty `data/` folder.
3. **Brute force:** `docker cp` the file out before removing the container, and back in after: easy to forget.
4. **Pattern:** **treat containers as replaceable and mount volumes for state**; the restart policy covers crashes.
5. **Plan:** run with all the options → order → remove → run again → list orders.
6. **Code and test:** the second container's `/orders` still shows `{"items":["bell"],"total":800}`, and `/` says `Welcome to Ada's Bikes!`.
walkthrough:
**Line by line**

- `-v shop-data:/app/data` creates the volume on first use and mounts it where the shop writes `orders.jsonl`.
- `--restart unless-stopped` restarts the container after crashes (and after the Docker daemon restarts), but not after `docker stop`.
- `docker rm -f shop` deletes the container and its writable layer; the volume stays.
- The second `docker run` mounts the same volume, so the new container reads the old orders.

**Trace:** the order request returns `201` with `{"items":["bell"],"total":800}`; after the new container starts, `curl localhost:8080/orders` prints the same line.

**Common wrong approach:** `-v ./data:/app/data` makes a bind mount of a folder on your computer: it also keeps the data, but this exercise asks for the named volume Docker manages.
:::

:::quiz
? docker stop took 10 seconds and the container shows Exited (137). Why?
+ The process didn't end on SIGTERM, so Docker killed it with SIGKILL after the timeout
- The container ran out of disk space
- The image is 137 MB
- The container crashed 137 times
= PID 1 doesn't get default signal handling; handle SIGTERM or use --init.
? Where should a containerized app write its logs?
+ To standard output and standard error, which docker logs collects
- To a log file inside the container
- To the image's history
- Nowhere: containers can't log
= Files in the container disappear with it and need extra tools to read; stdout/stderr go to Docker's logging.
? A container's data must survive docker rm. What do you use?
+ A volume (or a bind mount) mounted where the app writes
- docker commit after every change
- A larger writable layer
- --restart always
= The writable layer is deleted with the container; volumes live outside it.
? What does --restart on-failure do?
+ Starts the container again when its process exits with a non-zero status
- Restarts it every time it exits, even after docker stop
- Fixes the bug that crashed it
- Retries docker run if the image is missing
= on-failure restarts after crashes; unless-stopped and always also restart after a clean exit.
:::


@@@ lesson
id: compose
title: "Docker Compose: several containers together"
minutes: 34
summary: Describing a multi-container app in compose.yaml, services built from Dockerfiles, docker compose up, ps, logs, exec, stop and down, the project network and finding services by name, why localhost is the wrong address between containers, start order with depends_on and health checks, named volumes, environment variables and .env interpolation, docker compose config, the obsolete version key, and develop.watch for local development.
---
The `docker run` commands in the last lesson were already long. A real app has several parts (an API, a website, a database, a queue), each with its own options, and they must find each other. **Docker Compose** describes all of them in one file, `compose.yaml`, and starts them with one command.

### A compose.yaml

The shop now has a storefront in `web/`: a second small server that fetches the prices from the API and shows them as a page. Its `API_URL` variable says where the API is.

```sh setup=docker-compose-shop
cat > compose.yaml <<'EOF'
services:
  api:
    build: .
  web:
    build: ./web
    ports:
      - "8080:8080"
    environment:
      API_URL: http://api:3000
EOF
docker compose up -d
docker compose ps
curl localhost:8080
```

- `services:` lists the containers; each **service** is built from a Dockerfile (`build: ./web`) or started from an image (`image: nginx:alpine`).
- `ports` and `environment` are `docker run`'s `-p` and `-e`, written down.
- `docker compose up -d` builds the images that are missing (named after the project and the service: `shop-api`, `shop-web`), creates a network for the project, and starts the containers in the background. The **project** name is the folder's name, `shop`.

![Your computer runs curl localhost:8080, which reaches the web service through its published port. Inside the network shop_default, web calls http://api:3000; the api service isn't published, and the volume shop_data is attached to it](figures/compose-network.svg)

### Services find each other by name

Compose puts the project's containers on their own network, `shop_default`, where each service's name is a host name. The storefront reaches the API at `http://api:3000`, and the API doesn't publish any port: only the storefront can reach it, which is safer.

```sh setup=docker-compose-up
docker compose exec web wget -qO- http://api:3000/prices
docker compose exec web wget -qO- http://localhost:3000/prices
docker network ls
```

Inside the `web` container, `localhost` is the web container itself, where nothing listens on port 3000. Between containers, use the service name. (Containers on Docker's default `bridge` network can't find each other by name at all, which is one reason Compose makes a network for every project.)

### Logs and the life cycle

```sh setup=docker-compose-up
curl -s localhost:8080 > /dev/null
docker compose logs
docker compose logs api
docker compose down
docker compose ps
```

`docker compose logs` merges every service's log, each line prefixed with the container's name; give service names to see only those. `docker compose stop` stops the containers and keeps them; `docker compose down` stops and removes them and the network. Named volumes survive `down`; `docker compose down -v` deletes them too.

### Start order and health

`depends_on` makes Compose start one service after another. By default it only waits until the dependency's container has *started*, not until its program is ready. With a health check and `condition: service_healthy`, it waits until the dependency is healthy:

```sh setup=docker-compose-shop
cat > compose.yaml <<'EOF'
services:
  api:
    build: .
    environment:
      SHOP_NAME: ${SHOP_NAME:-the bike shop}
    volumes:
      - orders:/app/data
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 5s
      retries: 3
    restart: unless-stopped

  web:
    build: ./web
    ports:
      - "8080:8080"
    environment:
      API_URL: http://api:3000
    depends_on:
      api:
        condition: service_healthy
    restart: unless-stopped

volumes:
  orders:
EOF
docker compose up -d
docker compose ps
```

Compose waited until `shop-api-1` was `Healthy` before starting the storefront. The file also shows:

- `volumes:` at the top declares the named volume `orders` (Docker calls it `shop_orders`); the service mounts it at `/app/data`, so orders survive `docker compose down`.
- `${SHOP_NAME:-the bike shop}` is **interpolation**: Compose fills it from your shell's environment or from a `.env` file next to `compose.yaml`, with a default after `:-`.
- `restart:` is the restart policy from the last lesson.

`docker compose config` prints the file as Compose understands it, with variables filled in: a quick way to check interpolation and spot typos.

### Old files: version and docker-compose

Tutorials from before 2023 start compose files with `version: "3.8"` and run `docker-compose` (with a hyphen). The hyphenated Python program was retired in 2023; today Compose is part of Docker (`docker compose`, version 5.6 in October 2026), and the `version` key is ignored with a warning:

```sh setup=docker-compose-shop
printf 'version: "3.8"\nservices:\n  api:\n    build: .\n' > compose.yaml
docker compose config
```

### Developing with Compose

On your own computer, `docker compose watch` keeps your containers in step with your editor: with a `develop.watch` section, saving a file can copy it into the running container (`action: sync`) or rebuild the image (`action: rebuild`, for example when `package.json` changes):

```yaml
services:
  api:
    build: .
    develop:
      watch:
        - action: sync+restart
          path: ./server.js
          target: /app/server.js
        - action: rebuild
          path: package.json
```

A `compose.override.yaml` next to `compose.yaml` is merged in automatically, which is a common place for development-only settings, such as publishing the API's port so you can call it directly.

### Try it on your own computer

- Compose comes with Docker Desktop; on Linux, install the `docker-compose-plugin` package with Docker Engine. Check with `docker compose version`.
- Without `-d`, `docker compose up` shows every container's log live; Ctrl+C stops them all.
- Add a real database to the project: a service with `image: postgres:18-alpine`, a volume for `/var/lib/postgresql/data` and `POSTGRES_PASSWORD` in its environment. The API would reach it at `postgres:5432`.

:::exercise Compose the shop
Write `~/shop/compose.yaml` with two services: `api`, built from `.`, with a named volume `orders` mounted at `/app/data`; and `web`, built from `./web`, publishing port 8080 to 8080, with `API_URL` set to `http://api:3000` and depending on `api`. Start everything in the background and check with curl that the storefront shows the prices.
```sh starter setup=docker-compose-shop
ls web
```
```js check
const d = docker();
const api = d.container("shop-api-1"), web = d.container("shop-web-1");
if (!api || !web) throw new AssertionError("Start the project with docker compose up -d: there should be containers shop-api-1 and shop-web-1.");
if (!api.running || !web.running) throw new AssertionError("Both containers should be running (docker compose ps).");
same(web.env.API_URL, "http://api:3000", "API_URL in the web service");
if (!web.ports.includes("8080:8080")) throw new AssertionError("Publish the storefront's port: ports: - \"8080:8080\".");
if (api.ports.length) throw new AssertionError("The api service doesn't need to publish a port: the storefront reaches it on the project's network.");
const m = api.mounts.find((x) => x.target === "/app/data");
if (!m || m.type !== "volume" || m.source !== "shop_orders") throw new AssertionError("Mount a named volume orders at /app/data in the api service, and declare it under volumes: at the top level.");
const text = read("~/shop/compose.yaml") ?? "";
if (!/depends_on:/.test(text)) throw new AssertionError("Make web depend on api with depends_on.");
const r = await d.request("http://localhost:8080/");
if (r.status !== 200 || !r.body.includes("bell: 8.00")) throw new AssertionError("The storefront doesn't show the prices yet: curl localhost:8080 should list bell: 8.00.");
if (!ran(/curl\b.*8080/)) throw new AssertionError("Check the storefront with curl localhost:8080.");
```
```sh solution setup=docker-compose-shop
cat > compose.yaml <<'EOF'
services:
  api:
    build: .
    volumes:
      - orders:/app/data
  web:
    build: ./web
    ports:
      - "8080:8080"
    environment:
      API_URL: http://api:3000
    depends_on:
      - api

volumes:
  orders:
EOF
docker compose up -d
docker compose ps
curl localhost:8080
```
hint: Start from the lesson's first `compose.yaml` and add `volumes:` to `api` and `depends_on:` to `web`.
hint: A named volume is used in two places: `- orders:/app/data` in the service, and `orders:` under a top-level `volumes:` key.
hint: `docker compose up -d`, then `curl localhost:8080` should list `bell: 8.00`.
approach:
1. **Understand:** each service is one container; Compose connects them on a network where service names are host names.
2. **Examples:** `API_URL: http://api:3000` works because the API's service is called `api`.
3. **Brute force:** `docker network create`, two `docker build`s and two long `docker run`s do the same, and nobody can repeat them exactly.
4. **Pattern:** **write the app's containers, ports, variables and volumes down in compose.yaml**, and start it with one command.
5. **Plan:** write the file → `docker compose up -d` → `docker compose ps` → curl.
6. **Code and test:** curl shows the page with three prices; `docker volume ls` lists `shop_orders`.
walkthrough:
**Line by line**

- `api` builds the Dockerfile in `.` and mounts the volume where the API writes orders.
- `web` builds `./web`, publishes port 8080, and gets the API's address through `API_URL`.
- `depends_on: - api` starts `api` before `web`.
- The top-level `volumes: orders:` declares the volume; Compose names it `shop_orders`.

**Trace:** `docker compose up -d` builds `shop-api` and `shop-web`, creates `shop_default` and `shop_orders`, and starts both containers; curl prints `<h1>Bike shop</h1>` and the list.

**Common wrong approach:** `API_URL: http://localhost:3000`: inside the web container, localhost is the web container itself, so every page says `The shop is closed for a moment.`
:::

:::exercise Fix the old compose file
`~/shop/compose.yaml` came from an old tutorial: Compose warns about it, and the storefront always says the shop is closed. Remove the obsolete `version` line, point `API_URL` at the API service, add a health check to `api` (`wget -qO- http://localhost:3000/health`, every 5 seconds) and make `web` wait until `api` is healthy. Start it and check the storefront with curl.
```sh starter setup=docker-compose-broken
cat compose.yaml
docker compose up -d
curl localhost:8080
docker compose logs web
```
```js check
const text = read("~/shop/compose.yaml") ?? "";
if (/^version\s*:/m.test(text)) throw new AssertionError("Remove the version line: Compose ignores it and warns about it.");
const d = docker();
const api = d.container("shop-api-1"), web = d.container("shop-web-1");
if (!api || !web || !api.running || !web.running) throw new AssertionError("Start the project with docker compose up -d.");
same(web.env.API_URL, "http://api:3000", "API_URL in the running web container");
if (!api.health) throw new AssertionError("Give the api service a healthcheck (and run docker compose up -d again).");
same(api.health, "healthy", "The api container's health");
if (!/condition:\s*service_healthy/.test(text)) throw new AssertionError("Make web wait for a healthy api: depends_on: api: condition: service_healthy.");
const r = await d.request("http://localhost:8080/");
if (r.status !== 200) throw new AssertionError("The storefront still can't reach the API.");
```
```sh solution setup=docker-compose-broken
cat > compose.yaml <<'EOF'
services:
  api:
    build: .
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 5s
  web:
    build: ./web
    ports:
      - "8080:8080"
    environment:
      API_URL: http://api:3000
    depends_on:
      api:
        condition: service_healthy
EOF
docker compose up -d
curl localhost:8080
```
hint: The storefront's log says why it can't reach the API: `ECONNREFUSED`. Inside its container, what is `localhost`?
hint: The API's address on the project network is its service name: `http://api:3000`.
hint: Copy the `healthcheck:` and `depends_on: … condition: service_healthy` blocks from the lesson, and run `docker compose up -d` again: Compose recreates the containers whose configuration changed.
approach:
1. **Understand:** the warning is harmless; the real bug is the address, and the start order is a robustness fix.
2. **Examples:** `docker compose logs web` shows `Can't reach the API at http://localhost:3000: ECONNREFUSED`.
3. **Brute force:** publishing the API's port and using `host.docker.internal` works only on Docker Desktop and exposes the API.
4. **Pattern:** **between containers, use service names; wait for health, not just for start**.
5. **Plan:** rewrite the file → `docker compose up -d` (recreates both) → curl.
6. **Code and test:** curl shows the prices; `docker compose ps` shows `api` as `(healthy)`.
walkthrough:
**Line by line**

- Removing `version:` silences `the attribute version is obsolete`.
- `API_URL: http://api:3000` uses the service name, which Compose's network resolves to the API container.
- The health check runs `wget` inside the API container every 5 seconds; `condition: service_healthy` makes Compose wait for it before starting `web`.

**Trace:** `up -d` prints `Container shop-api-1 Recreate`, `Waiting`, `Healthy`, then `Container shop-web-1 Started`; curl prints the price list.

**Common wrong approach:** adding `depends_on` but leaving `localhost` in `API_URL`: the start order was never the problem, so the page still says the shop is closed.
:::

:::quiz
? In a Compose project, how does the web service reach the api service?
+ By its service name, http://api:3000, on the project's network
- At http://localhost:3000
- Only through a published port on your computer
- Services can't talk to each other
= Compose creates a network where each service name resolves to its container.
? What does docker compose down do by default?
+ Stops and removes the containers and the project network, but keeps named volumes
- Deletes the images and volumes too
- Only stops the containers
- Pulls newer images
= Add -v to delete named volumes as well.
? depends_on: api (without a condition) makes Compose wait until…
+ the api container has started, not until its program is ready
- api's health check passes
- api has exited successfully
- api has finished building only
= Use a healthcheck with condition: service_healthy to wait for readiness.
? A compose file starts with version: "3.8". What happens?
+ Compose ignores it and warns that the attribute is obsolete
- Compose uses an older file format
- The file is rejected
- It selects Docker Engine 3.8
= The version key is from the old docker-compose tool; today's Compose doesn't need it.
:::


@@@ lesson
id: publishing
title: Publishing images and building them in CI
minutes: 34
summary: Registries and image names, tagging an image for GitHub Container Registry, logging in with a token and --password-stdin, pushing and pulling, where Docker stores credentials, private packages, a tagging strategy (versions, commit SHAs, latest), building and pushing from GitHub Actions with docker/login-action, docker/metadata-action and docker/build-push-action, the GITHUB_TOKEN and packages permission, version tags from Git tags, multi-platform images, and provenance and SBOM attestations.
---
An image on your computer helps nobody else. A **registry** stores images so that servers, teammates and CI can pull them: Docker Hub (`docker.io`), GitHub Container Registry (`ghcr.io`), and every cloud's own (Amazon ECR, Google Artifact Registry, Azure Container Registry). This lesson publishes the shop to `ghcr.io`, free for public images, by hand and then from GitHub Actions.

### Image names point to registries

The full name says where an image lives: `ghcr.io/ada/shop:1.0` is the repository `ada/shop` on `ghcr.io`, tag `1.0`. Names without a registry mean Docker Hub. To push an image, give it a name in the registry first; `docker tag` adds a name to an existing image, without copying anything:

```sh setup=docker-shop-built error
docker tag shop:1.0 ghcr.io/ada/shop:1.0
docker images
docker push ghcr.io/ada/shop:1.0
```

Both names have the same ID: one image, two names. The push fails because the registry doesn't know who you are.

### Log in with a token

`ghcr.io` doesn't take your GitHub password. It takes a **personal access token (classic)** with the `write:packages` scope (fine-grained tokens don't work with packages yet). Never type a token as an argument, where it lands in your shell history; pipe it in with `--password-stdin`:

```sh setup=docker-shop-token
docker tag shop:1.0 ghcr.io/ada/shop:1.0
echo "$CR_PAT" | docker login ghcr.io -u ada --password-stdin
docker push ghcr.io/ada/shop:1.0
cat ~/.docker/config.json
```

The push sent every layer, then the image's **digest**. Note the warning: Docker saved your login in `~/.docker/config.json`, and `auth` is just base64, which anyone can decode. Docker Desktop stores logins in the operating system's keychain instead; on Linux, configure a [credential helper](https://docs.docker.com/go/credential-store/).

A new package on `ghcr.io` is **private**: other people (and servers that aren't logged in) can't pull it until you make it public in the package's settings on GitHub. Pulling it on a server works after `docker login`:

```sh setup=docker-shop-pushed
docker rmi ghcr.io/ada/shop:1.0
docker logout ghcr.io
docker pull ghcr.io/ada/shop:1.0
echo "$CR_PAT" | docker login ghcr.io -u ada --password-stdin 2> /dev/null
docker pull ghcr.io/ada/shop:1.0
```

Layers the computer already has say `Already exists`; only the shop's own layers are downloaded.

### Which tags?

A tag is a movable label, so choose tags people can rely on:

- **Versions** (`1.2.0`, plus `1.2` and `1` that move to the newest patch) for releases.
- **Commit SHAs** (`sha-a1b2c3d`) so every build can be traced back to its code.
- **Branch names** (`main`) for "the newest build of main", handy for test environments.
- **`latest`** only as a convenience: production should run a specific version or digest, so you know what's running and can roll back.

### Build and push from GitHub Actions

Pushing by hand means images built from whatever happened to be on your laptop. CI builds from the commit, every time. Docker's official actions do the work:

```sh setup=docker-shop-gh
mkdir -p .github/workflows
cat > .github/workflows/docker.yml <<'EOF'
name: Docker

on:
  push:
    branches: [main]
    tags: ["v*"]

permissions:
  contents: read
  packages: write

jobs:
  image:
    runs-on: ubuntu-latest
    steps:
      - uses: docker/setup-buildx-action@v4
      - uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v6
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha
      - uses: docker/build-push-action@v7
        with:
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
EOF
git add .github/workflows/docker.yml
git commit -qm "Build and push the image"
git push -q
gh run list
gh run view 22417304019 --log | grep -A3 "Docker tags" | cut -f3
```

- `permissions: packages: write` lets the job's automatic `GITHUB_TOKEN` push to the repository's own packages; no personal token needed.
- `setup-buildx-action` starts a BuildKit builder; `login-action` logs in and logs out again in its post step.
- `metadata-action` turns the event into tags and labels: on a push to `main`, `main` and `sha-…`; on a tag `v1.2.0`, `1.2.0`, `1.2` and `latest`. Its labels (`org.opencontainers.image.source` and others) link the package to the repository on GitHub.
- `build-push-action` builds and pushes. Without a `context` input it builds straight from the pushed commit on GitHub, so it doesn't even need `actions/checkout` (add `context: .` and a checkout step if earlier steps generate files the image needs).

A release is then just a Git tag:

```sh setup=docker-shop-ci
git tag v1.2.0
git push -q origin v1.2.0
gh run list
gh run view 22417308038 --log | grep -A4 "Docker tags" | cut -f3
```

### Multi-platform images and attestations

Laptops with Apple silicon and many cloud servers use ARM processors, while GitHub's standard runners are x86 (`amd64`). An image built for one doesn't run natively on the other. `docker/build-push-action` can build for several platforms into one name: add `docker/setup-qemu-action@v4` before Buildx and `platforms: linux/amd64,linux/arm64`, and Docker pulls the right variant on each machine. Emulated builds are slow; GitHub's ARM runners (`runs-on: ubuntu-24.04-arm`, free for public repositories) build ARM images natively.

The build also attaches a **provenance attestation**, a record of which workflow, commit and builder produced the image, and `sbom: true` adds a software bill of materials. `actions/attest-build-provenance` signs one that `gh attestation verify oci://ghcr.io/ada/shop:1.2.0 --owner ada` can check, so a server can prove an image came from your CI.

### Try it on your own computer

- Create a personal access token (classic) with only `write:packages` at [github.com/settings/tokens](https://github.com/settings/tokens) (selecting it also ticks `repo` for private repositories; untick it if you don't need it), and store it in a password manager.
- Push a workflow like the one above to a repository of yours; the image appears under **Packages** on the repository's page, private at first. Make it public in **Package settings → Change visibility**.
- To use Docker Hub instead, create a free account and an access token at [app.docker.com](https://app.docker.com/), log in with `docker login -u USER`, and name images `USER/shop:1.0`.

:::exercise Push by hand
Publish `shop:1.0` to GitHub Container Registry as `ghcr.io/ada/shop:1.0`. A personal access token (classic) with `write:packages` is in the environment variable `CR_PAT`. Log in without putting the token on the command line, and push.
```sh starter setup=docker-shop-token
docker images
```
```js check
const reg = registry("ghcr.io/ada/shop");
if (!reg) throw new AssertionError("There's no ghcr.io/ada/shop on the registry yet: tag the image and docker push it.");
if (!reg.tags.includes("1.0")) throw new AssertionError(`Push the tag 1.0 (the registry has: ${reg.tags.join(", ")}).`);
const img = docker().image("shop:1.0");
same(reg.digest("1.0"), img.id, "The pushed image's digest (it should be shop:1.0)");
if (!ran(/docker login\b.*--password-stdin/)) throw new AssertionError("Log in with --password-stdin, piping the token in: echo \"$CR_PAT\" | docker login ghcr.io -u ada --password-stdin.");
if (ran(/docker login\b.*(\s-p\s|--password\s|--password=)/)) throw new AssertionError("Don't pass the token with -p: it ends up in your shell history. Use --password-stdin.");
```
```sh solution setup=docker-shop-token
docker tag shop:1.0 ghcr.io/ada/shop:1.0
echo "$CR_PAT" | docker login ghcr.io -u ada --password-stdin
docker push ghcr.io/ada/shop:1.0
```
hint: First give the image its registry name with `docker tag SOURCE TARGET`.
hint: `echo "$CR_PAT" | docker login ghcr.io -u ada --password-stdin` sends the token through standard input.
hint: Then `docker push ghcr.io/ada/shop:1.0`.
approach:
1. **Understand:** the image's name decides where it's pushed, and the registry needs a login.
2. **Examples:** `docker push shop:1.0` would try Docker Hub's official library, which you can't push to.
3. **Brute force:** `docker login -p TOKEN` works but leaks the token into your history and process list.
4. **Pattern:** **tag with the registry's name, log in through stdin, push**.
5. **Plan:** `docker tag` → `docker login --password-stdin` → `docker push`.
6. **Code and test:** the push ends with `1.0: digest: sha256:… size: 856`.
walkthrough:
**Line by line**

- `docker tag shop:1.0 ghcr.io/ada/shop:1.0` adds a second name to the same image.
- `echo "$CR_PAT" | docker login ghcr.io -u ada --password-stdin` logs in; the token never appears as an argument.
- `docker push ghcr.io/ada/shop:1.0` uploads the layers the registry doesn't have and the image's manifest.

**Trace:** `Login Succeeded` (after the warning about unencrypted storage), then one `Pushed` line per layer and the digest.

**Common wrong approach:** `docker push shop:1.0`: without a registry in the name, Docker pushes to Docker Hub's `library/shop`, and the push is denied.
:::

:::exercise Publish from CI
`ada/shop` has no workflows yet. Add `.github/workflows/docker.yml` that runs on pushes to `main` and on tags starting with `v`, gives the token `contents: read` and `packages: write`, logs in to `ghcr.io` with the `GITHUB_TOKEN`, computes tags with `docker/metadata-action@v6` for `ghcr.io/ada/shop` (the branch name, `{{version}}` for version tags, and the commit SHA), and builds and pushes with `docker/build-push-action@v7`. Push it, then release version 1.0.0 with the Git tag `v1.0.0`.
```sh starter setup=docker-shop-gh
gh run list
```
```js check
const { wf, errors } = workflow("~/shop/.github/workflows/docker.yml");
if (errors.length) throw new AssertionError(`docker.yml has a problem: line ${errors[0].line}: ${errors[0].message} (run actionlint).`);
const perms = wf.permissions ?? Object.values(wf.jobs ?? {})[0]?.permissions;
if (!perms || perms.packages !== "write") throw new AssertionError("The GITHUB_TOKEN needs permissions: packages: write to push to ghcr.io.");
const gh = await github("ada/shop");
const runs = gh.runs().filter((r) => r.workflowName === wf.name);
if (!runs.length) throw new AssertionError("The workflow hasn't run yet: commit it and git push.");
const failed = runs.find((r) => r.conclusion !== "success");
if (failed) throw new AssertionError(`A run of ${wf.name} failed (${failed.event} on ${failed.headBranch}): gh run view ${failed.id} --log-failed.`);
const reg = registry("ghcr.io/ada/shop");
if (!reg) throw new AssertionError("Nothing was pushed to ghcr.io/ada/shop yet.");
if (!reg.tags.includes("main")) throw new AssertionError(`A push to main should publish the tag main (the registry has: ${reg.tags.join(", ")}).`);
if (!reg.tags.some((t) => /^sha-[0-9a-f]{7}$/.test(t))) throw new AssertionError("Add type=sha to the metadata tags, so each build has a sha-… tag.");
if (!reg.tags.includes("1.0.0")) throw new AssertionError("Release 1.0.0: git tag v1.0.0 and git push origin v1.0.0 (and use type=semver,pattern={{version}}).");
```
```sh solution setup=docker-shop-gh
mkdir -p .github/workflows
cat > .github/workflows/docker.yml <<'EOF'
name: Docker

on:
  push:
    branches: [main]
    tags: ["v*"]

permissions:
  contents: read
  packages: write

jobs:
  image:
    runs-on: ubuntu-latest
    steps:
      - uses: docker/setup-buildx-action@v4
      - uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v6
        with:
          images: ghcr.io/ada/shop
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=sha
      - uses: docker/build-push-action@v7
        with:
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
EOF
git add .github/workflows/docker.yml
git commit -qm "Build and push the image"
git push -q
git tag v1.0.0
git push -q origin v1.0.0
gh run list
```
hint: The lesson's workflow is a good start; you need three tag rules: `type=ref,event=branch`, `type=semver,pattern={{version}}` and `type=sha`.
hint: Without `permissions: packages: write`, the push fails with `denied: permission_denied: write_package`.
hint: After the first run passes, `git tag v1.0.0` and `git push origin v1.0.0` start a second run that publishes `1.0.0` (and `latest`).
approach:
1. **Understand:** CI should build the image from each pushed commit and publish it under tags people can use.
2. **Examples:** on `main`, metadata-action produces `main` and `sha-…`; on `v1.0.0`, `1.0.0` and `latest`.
3. **Brute force:** `docker build` and `docker push` in `run:` steps with a stored personal token: more to maintain, and a long-lived secret.
4. **Pattern:** **login-action with GITHUB_TOKEN + metadata-action + build-push-action**, triggered by branches and version tags.
5. **Plan:** write the workflow → push → check the run → tag `v1.0.0` → push the tag → check again.
6. **Code and test:** `gh run list` shows two green runs (on `main` and on `v1.0.0`).
walkthrough:
**Line by line**

- `on: push: branches: [main]` and `tags: ["v*"]` run the workflow for new commits on main and for version tags.
- `permissions` limits the token to reading code and writing packages.
- `login-action` uses `github.actor` and the automatic `GITHUB_TOKEN`; `metadata-action` computes tags and labels; `build-push-action` builds the commit and pushes every tag.

**Trace:** the first run pushes `ghcr.io/ada/shop:main` and `ghcr.io/ada/shop:sha-…`; the tag's run pushes `ghcr.io/ada/shop:1.0.0` and `ghcr.io/ada/shop:latest`.

**Common wrong approach:** forgetting `packages: write` when `permissions:` is set: every other permission becomes `none`/read-only, and the push is denied.
:::

:::quiz
? What does docker tag shop:1.0 ghcr.io/ada/shop:1.0 do?
+ Gives the existing image a second name; nothing is copied or uploaded
- Uploads the image to ghcr.io
- Builds a new image
- Renames the image and deletes shop:1.0
= Tags are names; docker push uploads.
? Why log in with --password-stdin instead of -p TOKEN?
+ So the token doesn't end up in the shell history or the process list
- -p doesn't work with ghcr.io
- --password-stdin encrypts the token on disk
- It's faster
= Pipe the token in; Docker still stores it, so use a credential helper.
? In GitHub Actions, what lets the job push to ghcr.io without a personal token?
+ The GITHUB_TOKEN with permissions: packages: write
- secrets.CR_PAT
- actions/checkout
- Making the repository public
= login-action logs in with github.actor and the GITHUB_TOKEN.
? Which tag should a production server run?
+ A specific version or digest, so you know exactly what runs and can roll back
- latest, so it always has the newest
- main
- Any tag; they're all the same image
= latest and branch tags move; versions and digests don't.
:::
