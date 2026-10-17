@@ containers
topics: "it works on my machine", what images, containers, layers and registries are, containers versus virtual machines (namespaces and cgroups, Docker Desktop's Linux VM), the OCI standard, docker run and what it does (pull, create, start), running commands in images (--rm), image names, tags, variants (alpine, slim, Debian) and digests, Node.js LTS tags in October 2026, Docker 29's docker images view (disk usage, content size, in use), docker ps and docker ps -a, container names, docker container prune, docker rm and docker rmi, running a server detached with a published port (-d, -p, --name), docker logs, docker stop, installing Docker Desktop or Docker Engine and its license, alternatives (Podman, Rancher Desktop, Colima, OrbStack), Docker Hub pull limits
terms:
- **Image:** a read-only package of a program and everything it needs to run, built from layers.
- **Container:** a running or stopped instance of an image: an isolated process with its own file system and network.
- **Layer:** one set of file changes in an image; images share the layers they have in common.
- **Registry:** a server that stores and serves images, such as Docker Hub or ghcr.io.
- **Tag:** a movable name for an image version, like 24-alpine.
- **Digest:** a sha256 hash that identifies an image's exact content and never changes.
- **Docker Engine:** the background service (daemon) that builds images and runs containers.
- **Detached:** running in the background (-d), with the terminal free for other commands.
- **Publish a port:** connect a port on the host to a port in a container (-p host:container).
mistakes:
- Writing -p 3000:8080 when the app listens on 3000 inside the container: the order is host:container.
- Forgetting -d for a server, so the terminal stays attached to it.
- Expecting a container to keep running after its main process has finished.
- Using latest and being surprised when the publisher moves it to a new major version.
- Trying to delete an image while stopped containers still use it.

glance:
- Run a command in a new container | docker run --rm IMAGE COMMAND | pulls the image if needed | —
- Run a server in the background | docker run -d -p 8080:80 --name web IMAGE | creates and starts a container | docker stop web; docker rm web
- List running / all containers | docker ps / docker ps -a | nothing | —
- List images | docker images | nothing | —
- Show a container's output | docker logs NAME | nothing | —
- Remove stopped containers | docker container prune -f | deletes containers | —
- Remove an image | docker rmi IMAGE | deletes the image | docker pull IMAGE

@@ dockerfile
topics: the shop as a node:http web API (routes, PORT), a Dockerfile's instructions (FROM, WORKDIR, COPY, RUN, EXPOSE, CMD), docker build -t and the build context, reading BuildKit's plain output (steps, CACHED, DONE, exporting and naming), --progress=plain, npm ci --omit=dev, running your image and curl -i, what COPY . . copies (.git, README.md, .env, node_modules) and .dockerignore, docker build -q, exec form versus shell form, signals and the shell, BuildKit build checks and warnings (JSONArgsRecommended), docker build --check, ENTRYPOINT and CMD, the node image's docker-entrypoint.sh, overriding CMD with docker run arguments, reading build errors (>>>, unknown instruction, file not found), listening on all interfaces (127.0.0.1 versus 0.0.0.0) and Connection reset by peer, docker init, VS Code's Docker DX and Container Tools extensions
terms:
- **Dockerfile:** a text file of instructions for building an image.
- **Build context:** the folder (minus .dockerignore) that docker build sends to the builder; COPY copies from it.
- **.dockerignore:** a file listing paths to leave out of the build context.
- **BuildKit:** Docker's builder; it runs the steps, caches them and checks the Dockerfile.
- **Exec form:** CMD ["node", "server.js"], a JSON list that runs the program directly.
- **Shell form:** CMD node server.js, which runs the command through /bin/sh -c.
- **ENTRYPOINT:** the program a container runs; CMD then supplies its default arguments.
- **Build check:** a BuildKit rule that warns about Dockerfile problems, such as JSONArgsRecommended.
mistakes:
- Forgetting the dot in docker build -t shop:1.0 . (the build context).
- Building without a .dockerignore, so .git, .env and node_modules end up in the image.
- Using the shell form of CMD, so docker stop can't reach the app.
- Listening on 127.0.0.1 inside a container, so published ports can't reach the server.
- Expecting EXPOSE to publish a port: only -p does.

glance:
- Build an image | docker build -t NAME:TAG . | adds an image | docker rmi NAME:TAG
- Build and print only the ID | docker build -q -t NAME:TAG . | adds an image | docker rmi NAME:TAG
- Check a Dockerfile | docker build --check . | nothing | —
- Leave files out of the image | .dockerignore | the build context | edit the file
- Run a command instead of CMD | docker run --rm IMAGE COMMAND | nothing (with --rm) | —

@@ layers
topics: layers and the container's writable layer, docker history and `<missing>`, shared base layers, how BuildKit's cache works, ordering a Dockerfile (dependency files, install, then code), --no-cache, choosing a base image (node:24, -slim, -alpine, distroless, Docker Hardened Images), musl versus glibc, NODE_ENV=production and npm ci --omit=dev, running as the node user (USER), file ownership and chown for writable folders, multi-stage builds (AS, COPY --from, stage labels, skipped stages, deduplicated steps), running tests in the build, secrets in ENV and ARG (SecretsUsedInArgOrEnv, docker history), build secrets (RUN --mount=type=secret), pinning tags and digests, Dependabot and Renovate for base images, scanning (Docker Scout, Trivy, Grype), attestations and SBOMs
terms:
- **Build cache:** layers BuildKit reuses when a step and its inputs haven't changed.
- **Cache invalidation:** a changed step makes every later step run again.
- **Base image:** the image a Dockerfile starts FROM.
- **Multi-stage build:** a Dockerfile with several FROM stages, where the final stage copies results from earlier ones.
- **Stage:** the part of a Dockerfile from one FROM to the next; AS gives it a name.
- **Non-root user:** running the container's process as an ordinary user (USER node) instead of root.
- **Distroless image:** an image with only the runtime and the app, without a shell or package manager.
- **Build secret:** a secret mounted into one RUN step without being stored in the image.
- **SBOM:** a software bill of materials, the list of packages inside an image.
mistakes:
- Copying all the code before installing dependencies, so every code change reinstalls them.
- Putting secrets in ENV or ARG, where docker history shows them.
- Deleting a secret file in a later RUN and thinking it's gone (it's still in an earlier layer).
- A test stage that the final stage never copies from, so BuildKit skips the tests.
- Running as root because it's the default.

glance:
- See an image's layers | docker history IMAGE | nothing | —
- Build without the cache | docker build --no-cache -t NAME . | adds an image | —
- Build one stage | docker build --target test . | nothing (untagged) | —
- Copy from a stage | COPY --from=test /app/file ./ | the final image | edit the Dockerfile
- Run as a non-root user | USER node | the image's default user | remove the line

@@ running
topics: configuration with environment variables (-e, --env-file), docker inspect and Go templates, secrets at run time, logs on stdout and stderr (docker logs, -f, --tail), docker exec and PID 1, docker exec -it for a shell, docker stop (SIGTERM, the 10-second timeout, SIGKILL), why Node.js as PID 1 ignores SIGTERM, graceful shutdown with server.close, docker run --init, exit codes (0, 1, 125, 126, 127, 137, 143), uncaught errors and crashes, restart policies (no, on-failure, always, unless-stopped) and RestartCount, health checks (HEALTHCHECK, wget in Alpine, starting, healthy, unhealthy), named volumes and bind mounts (-v, :ro), docker rm -f, docker volume ls and rm, memory and CPU limits (--memory, --cpus) and docker stats
terms:
- **Environment variable:** a named setting a container's process reads at run time.
- **PID 1:** the first process in a container, its main process; signals have no default effect on it.
- **SIGTERM:** the signal docker stop sends to ask a process to finish.
- **SIGKILL:** the signal that ends a process immediately; exit code 137.
- **Graceful shutdown:** finishing work in progress and exiting cleanly on SIGTERM.
- **Restart policy:** when Docker restarts a container whose process ended.
- **Health check:** a command Docker runs inside a container to see if the app works.
- **Volume:** storage managed by Docker that outlives containers, mounted at a path.
- **Bind mount:** a folder of the host mounted into a container.
mistakes:
- Baking settings into the image instead of passing them with -e.
- Writing logs to files inside the container instead of standard output.
- Not handling SIGTERM, so every docker stop takes 10 seconds and kills requests.
- Treating a restart policy as a fix instead of reading the crash in the logs.
- Keeping data in the container's writable layer, where docker rm deletes it.
- Using curl in a health check on an Alpine image, which doesn't have it.

glance:
- Set a variable | docker run -e NAME=value … | the new container | —
- Follow a container's log | docker logs -f NAME | nothing | Ctrl+C
- Run a command inside | docker exec NAME COMMAND | depends on the command | —
- Read one setting | docker inspect -f '{{.State.Status}}' NAME | nothing | —
- Stop / kill | docker stop NAME / docker kill NAME | stops the container | docker start NAME
- Restart after crashes | docker run --restart unless-stopped … | the container's policy | docker update --restart no NAME
- Keep data | docker run -v NAME:/path … | creates a volume | docker volume rm NAME
- Limit resources | docker run --memory 256m --cpus 0.5 … | the container's limits | docker update

@@ compose
topics: why Compose, compose.yaml and its services (build, image, ports, environment), the project name, docker compose up -d, ps, logs, exec, stop and down (-v), the project network and service names as host names, localhost inside a container, the default bridge network has no names, depends_on and its conditions (service_started, service_healthy, service_completed_successfully), healthcheck in Compose, named volumes in Compose (project_volume names), restart, environment interpolation from the shell and .env with defaults, docker compose config, the obsolete version key and the retired docker-compose program, Compose 5, develop.watch (sync, sync+restart, rebuild) and docker compose watch, compose.override.yaml, adding a database service
terms:
- **Docker Compose:** a tool that runs a multi-container app described in compose.yaml.
- **Service:** one container definition in a Compose file.
- **Project:** a Compose app; its name (the folder by default) prefixes containers, networks and volumes.
- **Service discovery:** finding another service by its name on the project network.
- **depends_on:** start-order rules between services, optionally waiting for health.
- **Interpolation:** filling ${VAR} in compose.yaml from the environment or .env.
- **Compose watch:** keeping containers in sync with files you edit, by copying or rebuilding.
mistakes:
- Using localhost to reach another service: inside a container it's the container itself.
- Expecting plain depends_on to wait until the dependency is ready.
- Starting a file with version: and expecting it to change anything.
- Publishing every service's port when only the entry point needs one.
- Running docker compose down -v and losing the database volume.

glance:
- Start the app in the background | docker compose up -d | builds, creates and starts | docker compose down
- Rebuild and start | docker compose up -d --build | new images and containers | —
- See the services | docker compose ps | nothing | —
- Read the logs | docker compose logs [SERVICE] | nothing | —
- Run a command in a service | docker compose exec SERVICE COMMAND | depends on the command | —
- Stop and remove everything | docker compose down | removes containers and network | docker compose up -d
- Check the resolved file | docker compose config | nothing | —

@@ publishing
topics: registries (Docker Hub, ghcr.io, cloud registries), full image names, docker tag, docker push and why it's refused without a login, personal access tokens (classic) and write:packages, docker login --password-stdin, ~/.docker/config.json and credential helpers, private packages on ghcr.io and pulling after login, docker logout, choosing tags (versions, SHAs, branches, latest), building in GitHub Actions with docker/setup-buildx-action, docker/login-action, docker/metadata-action and docker/build-push-action, permissions: packages: write and the GITHUB_TOKEN, labels linking a package to its repository, the Git context of build-push-action, releasing with a Git tag (semver tags and latest), multi-platform images (QEMU, ARM runners), provenance attestations, SBOMs and gh attestation verify
terms:
- **Push:** upload an image's layers and manifest to a registry.
- **Pull:** download an image from a registry.
- **Personal access token (classic):** a GitHub token with scopes, which ghcr.io accepts as a password.
- **Credential helper:** a program that stores registry logins in the operating system's keychain.
- **GITHUB_TOKEN:** the token a workflow run gets automatically; permissions: decides what it can do.
- **Semantic version tags:** 1.2.0, 1.2 and 1 tags computed from a Git tag v1.2.0.
- **Multi-platform image:** one name with variants for several CPU architectures, such as amd64 and arm64.
- **Provenance attestation:** a record of how and where an image was built, attached to it.
mistakes:
- Pushing shop:1.0 without a registry in the name.
- Passing a token with docker login -p, which leaves it in the shell history.
- Forgetting permissions: packages: write in the workflow.
- Running latest in production, so nobody knows which version is live.
- Expecting a new ghcr.io package to be public.
- Building only for amd64 and running the image on an ARM server.

glance:
- Name an image for a registry | docker tag SOURCE ghcr.io/OWNER/NAME:TAG | adds a name | docker rmi ghcr.io/OWNER/NAME:TAG
- Log in to a registry | docker login ghcr.io -u USER --password-stdin (token on standard input) | stores credentials | docker logout ghcr.io
- Upload an image | docker push ghcr.io/OWNER/NAME:TAG | the registry | delete the version on GitHub
- Download an image | docker pull IMAGE | adds an image | docker rmi IMAGE
- Build and push in CI | docker/build-push-action with push: true | the registry | —
- Release a version | git tag v1.2.0; git push origin v1.2.0 | starts the workflow | —
