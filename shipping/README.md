# Shipping software: Git, CI/CD, Docker, Kafka, Kubernetes, the cloud and observability

A hands-on course that starts from zero: 6 lessons on how code gets from your computer to users and stays healthy there: version control with Git and GitHub, automated testing and deployment with GitHub Actions, containers with Docker, event streaming with Kafka, running containers with Kubernetes, deploying to the cloud, and observing running systems with logs, metrics and traces, ending with a project that ships a small service end to end.

Every engineering and data team uses these tools every day. AI engineers ship models and agents as containerised services behind CI/CD pipelines; analysts version their SQL and notebooks with Git and schedule pipelines that read event streams. Knowing them is what turns code that works on your laptop into software other people can rely on.

## ▶ [Open the practice sandbox](https://kishoremadanagopal.github.io/learning/shipping/)

The sandbox is a terminal in your browser. Type real `git` commands: a real Git engine runs in the page, with branches, merges, conflicts and a pretend GitHub. Docker, Kubernetes, Kafka and cloud commands run against faithful simulations, and you write real Dockerfiles, workflow files and manifests that are checked automatically. Nothing to install and no sign-up. Lessons also include **Try it on your own computer** labs, with official download links, for when you want to run the real tools.

- every lesson, with **20 examples** you can run and change
- **12 exercises** with automatic checks, each with an approach, hints and a walkthrough
- **24 quiz questions**, with explanations
- your progress and work saved in your own browser

**Before you start:** nothing. Lesson 1 teaches the few terminal commands you need. Some later examples read short Python or JavaScript programs; you don't need to write either.

## Course materials

| | |
|---|---|
| 📘 [Lessons](#lessons) | 6 lessons, each with key terms, examples, common mistakes, exercises, walkthroughs and a quiz |
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

### Coming next

The course is being written one part at a time. Still to come:

2. Branches, GitHub and pull requests: branching, merging and conflicts, remotes, push and pull, code review
3. CI/CD with GitHub Actions: workflows, jobs and steps, tests on every push, secrets, deploying automatically
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
