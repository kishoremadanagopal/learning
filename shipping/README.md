# Shipping software: Git, CI/CD, Docker, Kafka, Kubernetes, the cloud and observability

A hands-on course that starts from zero: 18 lessons on how code gets from your computer to users and stays healthy there: version control with Git and GitHub, automated testing and deployment with GitHub Actions, containers with Docker, event streaming with Kafka, running containers with Kubernetes, deploying to the cloud, and observing running systems with logs, metrics and traces, ending with a project that ships a small service end to end.

Every engineering and data team uses these tools every day. AI engineers ship models and agents as containerised services behind CI/CD pipelines; analysts version their SQL and notebooks with Git and schedule pipelines that read event streams. Knowing them is what turns code that works on your laptop into software other people can rely on.

## ▶ [Open the practice sandbox](https://kishoremadanagopal.github.io/learning/shipping/)

The sandbox is a terminal in your browser. Type real `git` commands: a real Git engine runs in the page, with branches, merges, conflicts and a pretend GitHub. Docker, Kubernetes, Kafka and cloud commands run against faithful simulations, and you write real Dockerfiles, workflow files and manifests that are checked automatically. Nothing to install and no sign-up. Lessons also include **Try it on your own computer** labs, with official download links, for when you want to run the real tools.

- every lesson, with **68 examples** you can run and change
- **36 exercises** with automatic checks, each with an approach, hints and a walkthrough
- **72 quiz questions**, with explanations
- your progress and work saved in your own browser

**Before you start:** nothing. Lesson 1 teaches the few terminal commands you need. Some later examples read short Python or JavaScript programs; you don't need to write either.

## Course materials

| | |
|---|---|
| 📘 [Lessons](#lessons) | 18 lessons, each with key terms, examples, common mistakes, exercises, walkthroughs and a quiz |
| 📖 [Glossary](glossary.md) | every term used in the course, defined in plain English |
| 🧾 [Cheat sheet](cheatsheet.md) | the syntax and patterns on one page, and every task at a glance |

## How to use this course

1. Read a lesson, here on GitHub or in the sandbox. Start with its **Key terms**.
2. Run the examples in the sandbox and change them to see what happens.
3. Try each exercise before opening help; press **Check** to run the hidden tests.
4. Stuck? Open **How to approach it**, then the hints one at a time, and the **walkthrough** only after a real attempt.

## Lessons

### Part 1: Git basics (Beginner)

| # | Lesson | Topics | Sandbox |
|---|---|---|---|
| 1 | [Version control, Git and the terminal](lessons/01-version-control.md) | what version control solves, Git as a distributed version control system, Git compared with GitHub, GitLab and Bitbucket, the terminal and the shell, prompts and the current folder, pwd, ls, cd, mkdir, echo, cat, redirection with > and >>, here-documents, chaining with &&, how the sandbox terminal runs real Git, installing Git on Windows, macOS and Linux, git --version, git config --global for name, email and the default branch, where configuration is stored | 1–2 |
| 2 | [Your first repository and commits](lessons/02-first-commits.md) | git init and the .git folder, the working tree, staging area (index) and repository, git status, git add for files, folders and everything, git commit -m, git log, what a commit records (snapshot, id, author, date, message, parent), the first (root) commit, staging only some files, git commit -a and its limits, git add -p on your own computer, writing good commit messages (imperative subject, about 50 characters, a body that says why), small focused commits | 3–4 |
| 3 | [Seeing changes: status, diff, log and show](lessons/03-seeing-changes.md) | git status -s and its two-letter codes, git diff for unstaged changes, git diff --staged, git diff between two commits, reading a unified diff (---, +++, hunk headers, + and - lines), git diff --stat and --name-only, git log --oneline, -n, --stat, -p, --format, a file path and --all, naming commits with HEAD, HEAD~1 and short ids, git show for a commit and for a file at a commit (rev:path), finding when and why a line changed, git log -S and git blame on your own computer | 5–6 |
| 4 | [.gitignore and what never to commit](lessons/04-ignoring-files.md) | what doesn't belong in a repository (dependencies, build output, caches, logs, editor and OS files, local settings, secrets, large data), .gitignore syntax (names, *, **, a trailing / for folders, a leading / for the root, comments, ! for exceptions), git status --ignored, git check-ignore -v, global ignores, committing .env.example instead of .env, git rm --cached to untrack a committed file, why removing a secret doesn't remove it from history, rotating leaked secrets, GitHub secret scanning and push protection, history rewriting tools, large files and Git LFS | 7–8 |
| 5 | [Undoing things safely](lessons/05-undoing.md) | choosing an undo by what you want to change, git restore to discard working-tree changes, git restore --staged to unstage, git restore --source to bring back an old version, git commit --amend to fix the last message or add a forgotten file, git reset --soft, --mixed and --hard with what each moves, git revert to undo a commit with a new commit, reverting an older commit, the golden rule about shared history, the reflog and recovering after reset --hard, why uncommitted work can't be recovered | 9–10 |
| 6 | [How Git stores your work](lessons/06-inside-git.md) | what's in the .git folder (HEAD, config, objects, refs, index), the four object types (blob, tree, commit, annotated tag), content-addressed storage, hashes and the same content giving the same id, SHA-1 today and SHA-256 as the Git 3.0 default, snapshots rather than diffs, loose objects and packfiles, refs and HEAD as small text files, symbolic refs, git cat-file -t and -p, git rev-parse, rev:path and ^{tree}, why branches are cheap, why commits can't change and --amend makes a new one | 11–12 |

### Part 2: Branches, GitHub and pull requests (Intermediate)

| # | Lesson | Topics | Sandbox |
|---|---|---|---|
| 7 | [Branches and stashes](lessons/07-branches.md) | what a branch is (a movable name for a commit), HEAD and the current branch, git branch, git switch -c, git switch -, git checkout -b in older guides, how switching rewrites files, uncommitted changes when switching, git branch -v, git log --oneline --graph --all, git stash, stash list, pop, apply and -u, naming conventions and prefixes, git branch -d and -D, detached HEAD | 13–14 |
| 8 | [Merging and conflicts](lessons/08-merging.md) | git merge, fast-forward merges, the merge base, three-way merges, merge commits with two parents, the default merge message and --no-edit, --no-ff and --ff-only, reading merges in git log --graph, merge conflicts, conflict markers (<<<<<<< ======= >>>>>>>), resolving and marking resolved with git add, finishing with git commit, git merge --abort, conflictStyle zdiff3, editor merge tools, keeping conflicts rare | 15–16 |
| 9 | [GitHub and remotes: clone, push and pull](lessons/09-remotes.md) | remote repositories and hosting (GitHub, GitLab, Bitbucket), remotes and origin, gh repo create with --source and --push, git remote add and -v, public and private repositories, git clone, remote-tracking branches such as origin/main, origin/HEAD, upstream branches and -u, ahead and behind in git status, git push, pushing new branches, push.autoSetupRemote, git fetch, git pull, rejected pushes (fetch first), signing in with gh auth login, Git Credential Manager and SSH keys, never storing tokens in URLs | 17–18 |
| 10 | [Keeping in sync: rebase, pull and force-with-lease](lessons/10-syncing.md) | diverged branches, git pull's divergent-branches message, git pull --no-rebase (merge) and --rebase, pull.rebase and pull.ff settings, why rebased commits get new ids, git rebase origin/main on a feature branch, conflicts during a rebase, git rebase --continue, --skip and --abort, which side HEAD is during a rebase, git push --force-with-lease versus --force, --force-if-includes, when rewriting history is safe, git cherry-pick, interactive rebase on your own computer (reword, squash, fixup, drop), rebase.autoStash | 19–20 |
| 11 | [Pull requests and code review](lessons/11-pull-requests.md) | what a pull request is, merge requests on GitLab, the pull request workflow, gh pr create with title, body, reviewer and draft, gh pr list and view, what a good PR description contains, Closes #12, small pull requests, reviewing (comment, approve, request changes), not approving your own PR, gh auth switch, gh pr diff and gh pr review, review etiquette, AI reviewers such as Copilot code review, merge methods (merge commit, squash and merge, rebase and merge), gh pr merge --delete-branch, updating main afterwards, git branch -D after a squash merge, fetch --prune | 21–22 |
| 12 | [Protecting main, workflows and releases](lessons/12-team-workflows.md) | rulesets and what they enforce (require a pull request and approvals, block force pushes, restrict deletions, require status checks, require linear history), creating rulesets in Settings or with gh api, ~DEFAULT_BRANCH, branch protection rules, plan availability, rescuing a commit made on a protected main, admin bypass, GitHub flow, trunk-based development and feature flags, Git flow, forks and the upstream remote, semantic versioning, annotated tags and pushing them, GitHub releases with gh release create and --generate-notes, never moving published tags, Conventional Commits and release tools | 23–24 |

### Part 3: CI/CD with GitHub Actions (Intermediate)

| # | Lesson | Topics | Sandbox |
|---|---|---|---|
| 13 | [CI/CD and your first workflow](lessons/13-ci-cd.md) | what continuous integration, continuous delivery and continuous deployment are, pipelines, why small frequent changes break less (DORA research), the Node.js project (package.json, scripts, prices.js and its tests), npm test and exit statuses, GitHub Actions' building blocks (workflow, event, job, step, runner, action), hosted runner labels and the 2026 image changes, free minutes, YAML maps, lists, block strings and its traps, writing and pushing a first workflow, actions/checkout and actions/setup-node, gh run list and gh run view, reading a run's log, actionlint, act and the VS Code extension | 25–26 |
| 14 | [When the build fails](lessons/14-failing-builds.md) | reading a failed run (gh run view, annotations, --log-failed), the test runner's failure report, reproducing failures locally, fixing forward and reverting, never rewriting shared history, re-running runs and failed jobs, flaky tests, choosing events (push, pull_request, branches, branches-ignore, tags, paths), filter patterns, the merge commit a pull request run tests, gh pr checks, required status checks in rulesets, strict checks, status badges, notifications | 27–28 |
| 15 | [Jobs, matrices and expressions](lessons/15-workflow-syntax.md) | several jobs and needs, parallel jobs and skipped dependants, matrices (combinations, include, exclude, fail-fast), supported Node.js versions in October 2026, expressions and ${{ }}, contexts (github, env, vars, secrets, matrix, strategy, steps, needs, runner), operators and functions, if conditions and the implicit success(), status functions, env at three levels, GITHUB_ENV, GITHUB_OUTPUT and step outputs, job outputs and needs, workflow commands (notice, warning, error, group, add-mask), actionlint and its rules, debug logging | 29–30 |
| 16 | [Secrets, permissions and safe workflows](lessons/16-secrets-security.md) | env, configuration variables and secrets, gh variable set and gh secret set, masking and its limits, environment secrets, secrets and fork pull requests, the GITHUB_TOKEN, default read-only permissions, the permissions key and least privilege, script injection through expressions and the env fix, third-party actions as a supply-chain risk, the tj-actions compromise of March 2025, pinning to commit SHAs, Dependabot for actions, SHA-pinning policies, pull_request_target and pwn requests, checkout v7's refusal of fork code, OIDC instead of stored cloud keys, zizmor | 31–32 |
| 17 | [Continuous delivery with GitHub Actions](lessons/17-deploying.md) | building once and deploying what was tested, artifacts (upload-artifact, download-artifact, retention, gh run download), GitHub Pages and the GitHub Actions source, upload-pages-artifact and deploy-pages, pages and id-token permissions, the github-pages environment, smoke tests with curl, environments and protection rules (required reviewers, wait timers, deployment branches, environment secrets), workflow_dispatch with typed inputs, deploying on releases and tags, concurrency for deployments, rolling back by reverting or re-running, other static hosts | 33–34 |
| 18 | [Fast, reusable pipelines](lessons/18-pipelines.md) | why speed matters, caching with actions/cache, keys, restore keys and hashFiles, setup-node's npm cache, cache scope, size and expiry, path filters and required checks, concurrency with cancel-in-progress, timeout-minutes, reusable workflows (workflow_call, inputs, secrets), composite actions, sharing from an organisation repository, scheduled workflows (cron fields, UTC, the timezone key, limits, the 60-day rule), what Actions costs in 2026 (included minutes, per-minute prices, larger runners), self-hosted runners and their risks, other CI systems, CI for analysts and AI engineers (SQL tests, notebooks, data contracts, evaluation gates) | 35–36 |

### Coming next

The course is being written one part at a time. Still to come:

4. Docker: images and containers, writing a Dockerfile, layers and caching, volumes, networks and Compose
5. Kafka and event streaming: topics, partitions, producers, consumers and consumer groups
6. Kubernetes basics: pods, deployments, services, configuration and scaling
7. Deploying to the cloud: regions, managed services, containers in the cloud, costs and security
8. Observability: logs, metrics, traces, dashboards and alerts
9. Project: ship a small service end to end

## Running it on your own computer

Every terminal example also works in a real terminal with the real tools: each lesson's **Try it on your own computer** section says what to install and where to download it. Where an example starts from prepared files or commits, the lesson shows the commands that create them, so you can run those first.

## Editing the course

Lessons are generated from the Markdown sources in [`course/`](course/). See [course/README.md](course/README.md).
