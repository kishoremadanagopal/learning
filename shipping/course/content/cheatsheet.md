# Shipping software cheat sheet

The commands of the course on one page. The number in brackets is the lesson. The table of every task with its command and how to undo it is at the end.

## The terminal [1]

```bash
pwd                      # where am I?
ls -a                    # list files, including hidden ones such as .git
cd shop    cd ..    cd ~ # go into a folder, up one, home
mkdir -p src/app         # make folders (and any missing parents)
echo "bell 800" > prices.txt     # write a file (replaces it)
echo "lock 2900" >> prices.txt   # add a line to the end
cat prices.txt           # print a file
cmd1 && cmd2             # run cmd2 only if cmd1 worked
```

## Set up Git once [1]

```bash
git --version
git config --global user.name "Ada Lovelace"
git config --global user.email "ada@example.com"
git config --global init.defaultBranch main
git config --global --list
```

## Make commits [2]

```bash
git init                         # start tracking this folder
git status                       # what's changed, what's staged
git add prices.txt               # stage one file   (git add . = everything here)
git commit -m "Add price list"   # save the staged snapshot
git commit -am "Lower the pump price"   # stage tracked files and commit (not new files)
git log --oneline                # history, newest first
```

| Area | What's in it | Move changes with |
|---|---|---|
| Working tree | the files you edit | `git add` → staging area |
| Staging area (index) | the next commit | `git commit` → repository |
| Repository (`.git`) | every commit | `git restore`, `git switch` → working tree |

Good message: an imperative subject of about 50 characters (`Add opening hours`), a blank line, then *why* if it isn't obvious.

## See changes and history [3]

```bash
git status -s                    # M = modified, A = added, ?? = untracked (left column staged, right unstaged)
git diff                         # unstaged changes
git diff --staged                # staged changes
git diff HEAD~2 HEAD --stat      # between two commits
git log --oneline -n 5           # the last five commits
git log --stat                   # which files each commit changed
git log -p                       # with the full diffs
git log --oneline -- prices.txt  # commits that touched one file
git log --format="%h %an %s"     # your own format
git show HEAD~1                  # one commit in full
git show HEAD~2:prices.txt       # a file as it was
```

`HEAD` is where you are; `HEAD~1` is its parent, `HEAD~2` the grandparent. In a diff, `@@ -1,3 +1,4 @@` means "from line 1, 3 old lines became 4 new lines".

## Ignore files and keep secrets out [4]

| Pattern in `.gitignore` | Ignores |
|---|---|
| `node_modules/` | a folder with that name, anywhere |
| `*.log` | any file ending `.log` |
| `!keep.log` | …except this one (after the `*.log` line) |
| `/build/` | only the `build` folder at the top of the repository |
| `docs/**/*.pdf` | PDFs at any depth inside `docs` |
| `.env` | your secrets file: commit a `.env.example` instead |

Comments go on their own line, starting with `#`.

```bash
git check-ignore -v debug.log    # which rule ignores it?
git rm --cached .env             # stop tracking, keep the file; then commit
```

A secret that was ever committed (or pushed) is leaked: **rotate it first**, then remove it.

## Undo [5]

| You want to | Run | Safe after pushing? |
|---|---|---|
| throw away edits to a file | `git restore file` | yes (edits are lost) |
| unstage a file, keep the edits | `git restore --staged file` | yes |
| get a file as it was | `git restore --source HEAD~2 file` | yes |
| fix the last commit | `git add …` then `git commit --amend -m "…"` | no |
| undo commits, keep the changes staged | `git reset --soft HEAD~1` | no |
| undo commits, keep the changes unstaged | `git reset HEAD~1` (`--mixed`) | no |
| undo commits and throw the changes away | `git reset --hard HEAD~1` | no |
| undo a commit others already have | `git revert <commit>` | yes |
| find a commit you lost | `git reflog`, then `git reset --hard HEAD@{1}` | — |

## Inside .git [6]

```bash
cat .git/HEAD                    # ref: refs/heads/main
cat .git/refs/heads/main         # the commit id main points to
git rev-parse HEAD~1             # name → full id
git cat-file -t HEAD             # commit / tree / blob / tag
git cat-file -p HEAD             # tree, parent, author, committer, message
git cat-file -p HEAD^{tree}      # the files and folders of that snapshot
git cat-file -p HEAD:prices.txt  # one file's contents (a blob)
```

Commits are snapshots named by the hash of their contents, so a commit can't change: `--amend` makes a new one. A branch is a file holding one commit id, so branches are cheap.

## Branches and stashes [7]

```bash
git branch                       # list branches (* = current); -v adds the latest commit
git switch -c add-tubes          # create a branch here and switch to it
git switch main                  # switch (git switch - goes back to the previous one)
git log --oneline --graph --all  # every branch, as a graph
git stash                        # put uncommitted changes aside (-u: untracked files too)
git stash list                   # saved stashes, newest is stash@{0}
git stash pop                    # bring the newest back and drop it
git branch -d add-tubes          # delete a merged branch (-D: delete anyway)
```

## Merging and conflicts [8]

```bash
git merge add-tubes              # bring add-tubes into the branch you're on
git merge --no-ff add-tubes      # always make a merge commit
git merge --abort                # give up during a conflict
```

A conflict looks like this; edit the file to the right result, delete the markers, then `git add` the file and `git commit`:

```text
<<<<<<< HEAD
your branch's version
=======
the other branch's version
>>>>>>> add-tubes
```

## Remotes and GitHub [9]

```bash
gh auth login                                  # sign in (own computer)
gh repo create shop --public --source=. --push # create on GitHub, add origin, push
git remote -v                                  # list remotes
git clone https://github.com/ada/shop.git      # copy a repository
git push -u origin add-tubes                   # first push of a new branch (sets the upstream)
git push                                       # later pushes
git fetch                                      # download; moves origin/* only
git pull                                       # fetch + integrate into your branch
git status                                     # ahead / behind origin/main (as last fetched)
```

| Name | Means |
|---|---|
| `origin` | the main remote (usually GitHub) |
| `origin/main` | where `main` was on `origin` when you last fetched or pushed |
| upstream | the remote branch your branch is paired with (`git branch -vv`) |

## Keeping in sync [10]

```bash
git pull --rebase                       # replay your unpushed commits on top of the remote's
git config --global pull.rebase true    # make that the default
git rebase origin/main                  # update a feature branch with the latest main
git rebase --continue                   # after resolving a conflict and git add
git rebase --abort                      # give up, back to before
git push --force-with-lease             # push a rewritten branch, safely
git cherry-pick <commit>                # copy one commit onto the current branch
git rebase -i HEAD~3                    # reword, squash or drop recent commits (own computer)
```

Rewrite (rebase, amend, reset, force-push) only commits nobody else has built on. Never on a shared `main`.

## Pull requests [11]

```bash
gh pr create --title "…" --body "…" --reviewer grace   # open (--draft for early feedback)
gh pr list          gh pr view 1         gh pr diff 1
gh pr review 1 --approve                 # or --request-changes / --comment with --body "…"
gh pr merge 1 --squash --delete-branch   # or --merge / --rebase
gh pr checkout 1                         # get someone's PR branch locally
```

| Merge method | Lands on `main` |
|---|---|
| merge commit | all the branch's commits + a merge commit |
| squash and merge | one commit with all the changes (then `git branch -D` the local branch) |
| rebase and merge | each commit, replayed; no merge commit |

## Protecting main, workflows and releases [12]

```bash
gh api repos/OWNER/REPO/rulesets --method POST --input ruleset.json   # create a ruleset
git tag -a v1.2.0 -m "Release 1.2.0"     # annotated tag
git push origin v1.2.0                   # tags aren't pushed with branches (--tags: all)
gh release create v1.2.0 --generate-notes
git fetch upstream                       # forks: upstream = the original repository
```

SemVer `MAJOR.MINOR.PATCH`: breaking change → MAJOR, new feature → MINOR, bug fix → PATCH. Usual ruleset for `main`: require a pull request with 1+ approvals, block force pushes, restrict deletions, require status checks (Part 3).

## CI/CD with GitHub Actions [13–18]

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
    paths-ignore: ['**.md']
  pull_request:
  workflow_dispatch:                       # a Run workflow button / gh workflow run
permissions:
  contents: read                           # least privilege for the GITHUB_TOKEN
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true                 # false for deployments
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    strategy:
      matrix:
        node: [22, 24, 26]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ matrix.node }}
      - run: npm test
  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    env:
      API_TOKEN: ${{ secrets.API_TOKEN }}  # secrets through env:, never pasted into run:
    steps:
      - run: ./deploy.sh
```

| Task | Command |
|---|---|
| list runs / one run / its log | `gh run list`, `gh run view <ID>`, `gh run view <ID> --log` (`--log-failed`) |
| wait for a run | `gh run watch <ID> --exit-status` |
| run again | `gh run rerun <ID>` (`--failed` for failed jobs only) |
| start a manual run | `gh workflow run <file> -f name=value` |
| a pull request's checks | `gh pr checks` |
| secrets and variables | `gh secret set NAME --body "…"`, `gh variable set NAME --body "…"`, `gh secret list` |
| download artifacts | `gh run download <ID> --name <artifact>` |
| check workflow files | `actionlint` |

| Expression | Means |
|---|---|
| `${{ github.ref }}`, `${{ github.sha }}`, `${{ github.actor }}` | the event's ref, commit and user |
| `${{ matrix.node }}`, `${{ inputs.reason }}` | matrix value, workflow input |
| `${{ steps.<id>.outputs.x }}`, `${{ needs.<job>.outputs.x }}` | outputs (`echo "x=1" >> "$GITHUB_OUTPUT"`) |
| `${{ secrets.NAME }}`, `${{ vars.NAME }}` | secret (masked as `***`), configuration variable |
| `if: failure()`, `if: always()` | run after a failure / whatever happened |
| `${{ hashFiles('package-lock.json') }}` | a fingerprint for cache keys |

Pages deployment: `gh api repos/{owner}/{repo}/pages -X POST -f build_type=workflow` once, then a build job ending in `actions/upload-pages-artifact@v5` (`path: dist`) and a deploy job with `needs: build`, `permissions: pages: write, id-token: write`, `environment: github-pages` and `actions/deploy-pages@v5`.

## Docker [19–24]

```dockerfile
# Dockerfile: test in one stage, ship a small non-root image from another
FROM node:24-alpine AS test
WORKDIR /app
COPY package*.json ./                 # dependency files first: the install stays cached
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
HEALTHCHECK --interval=10s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "server.js"]             # exec form, so docker stop's SIGTERM reaches node
```

```yaml
# compose.yaml
services:
  api:
    build: .
    volumes: [orders:/app/data]
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 5s
  web:
    build: ./web
    ports: ["8080:8080"]
    environment:
      API_URL: http://api:3000          # service names are host names; localhost is the container itself
    depends_on:
      api:
        condition: service_healthy
volumes:
  orders:
```

| Task | Command |
|---|---|
| run a throwaway command | `docker run --rm node:24-alpine node --version` |
| run a server | `docker run -d -p 8080:3000 --name shop -e SHOP_NAME=… -v shop-data:/app/data --restart unless-stopped shop:1.0` |
| list | `docker ps` (`-a`), `docker images`, `docker volume ls`, `docker network ls` |
| look inside | `docker logs shop` (`-f`, `--tail 20`), `docker exec shop ls`, `docker inspect -f '{{.State.Status}}' shop`, `docker stats --no-stream` |
| stop and clean up | `docker stop shop`, `docker rm -f shop`, `docker container prune -f`, `docker rmi IMAGE`, `docker image prune` |
| build | `docker build -t shop:1.0 .` (`-q`, `--no-cache`, `--target test`, `--progress=plain`), `docker build --check .`, `docker history shop:1.0` |
| Compose | `docker compose up -d` (`--build`), `docker compose ps`, `docker compose logs api`, `docker compose exec web sh -c "…"`, `docker compose down` (`-v`), `docker compose config` |
| publish | `docker tag shop:1.0 ghcr.io/ada/shop:1.0`, `echo "$CR_PAT" \| docker login ghcr.io -u ada --password-stdin`, `docker push ghcr.io/ada/shop:1.0` |

Exit codes: 0 ended normally, 1 failed, 137 killed (SIGKILL: stop timeout or out of memory), 143 SIGTERM, 125–127 Docker couldn't run it. In CI: `permissions: packages: write`, then `docker/login-action@v4` (`password: ${{ secrets.GITHUB_TOKEN }}`), `docker/metadata-action@v6` and `docker/build-push-action@v7` with `push: true`.

## Kafka [25–29]

Kafka's tools live in `/opt/kafka/bin` in the `apache/kafka:4.3.1` image; run them with `docker exec kafka /opt/kafka/bin/TOOL --bootstrap-server localhost:9092 …` (B below).

| Task | Command |
|---|---|
| run one broker | `docker run -d --name kafka -p 9092:9092 apache/kafka:4.3.1` |
| topics | `kafka-topics.sh B --create --topic orders --partitions 3` (`--replication-factor 3 --config min.insync.replicas=2`), `--list`, `--describe --topic orders`, `--alter --partitions 4`, `--describe --under-replicated-partitions` |
| send | `docker exec -i kafka …kafka-console-producer.sh B --topic orders` (keys: `--reader-property parse.key=true --reader-property key.separator=:`; `--command-property acks=1`) |
| read | `kafka-console-consumer.sh B --topic orders --from-beginning --max-messages 5` (`--timeout-ms 2000`, `--group billing`, `--partition 2 --offset 4`, `--formatter-property print.key=true`) |
| offsets and lag | `kafka-get-offsets.sh B --topic orders`, `kafka-consumer-groups.sh B --list`, `--describe --group billing` (`--members`, `--state`) |
| reprocess | stop the consumers, then `kafka-consumer-groups.sh B --reset-offsets --group billing --topic orders --to-earliest --execute` (`--shift-by -2`, `--to-datetime …`, `--dry-run`) |
| topic settings | `kafka-configs.sh B --entity-type topics --entity-name orders --alter --add-config retention.ms=1209600000` (`--describe`, `--delete-config`) |

```js
// Node.js: npm install @confluentinc/kafka-javascript
import kafkajs from "@confluentinc/kafka-javascript";
const { Kafka } = kafkajs.KafkaJS;
const kafka = new Kafka({ kafkaJS: { brokers: ["kafka:19092"], clientId: "shop" } });

const producer = kafka.producer();
await producer.connect();
await producer.send({ topic: "orders", messages: [{ key: order.customer, value: JSON.stringify(event) }] });

const consumer = kafka.consumer({ kafkaJS: { groupId: "billing", fromBeginning: true } });
await consumer.connect();
await consumer.subscribe({ topics: ["orders"] });
await consumer.run({ eachMessage: async ({ partition, message }) => { /* handle it idempotently */ } });
process.on("SIGTERM", async () => { await consumer.disconnect(); process.exit(0); });
```

Remember: order is per partition, so key by what must stay in order; a group uses at most one consumer per partition; lag = log-end offset − committed offset; durable topics use replication factor 3, `min.insync.replicas=2` and `acks=all`; containers need a listener that advertises a name they can resolve (`kafka:19092`), your computer one that advertises `localhost:9092`.
