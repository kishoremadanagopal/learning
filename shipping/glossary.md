# Shipping software glossary

Every term used in the course, A to Z. The number in brackets is the lesson where it's introduced.

| Term | Meaning |
|---|---|
| **Action** | A packaged, reusable step, like `actions/checkout`. [13] |
| **actionlint** | A linter that checks workflow files for errors before you push. [15] |
| **Amend** | Replaces the last commit with a new one that has your fixes. [5] |
| **Annotation** | A message attached to a run, such as an error from a step. [14] |
| **Artifact** | Files a job uploads so later jobs, or people, can download them. [17] |
| **Blob** | An object holding a file's contents (without its name). [6] |
| **Branch** | A movable name that points to a commit; committing moves the current branch forward. [7] |
| **Cache** | Saved files restored into later jobs, looked up by a key. [18] |
| **Cache key** | The name a cache is saved under, usually including a hash of the files it depends on. [18] |
| **Check** | The result of one job on a commit, shown on pull requests. [14] |
| **Cherry-pick** | Apply the change from one commit onto the current branch as a new commit. [10] |
| **Commit** | A saved snapshot of the staged files, with an id, author, date, message and a link to its parent. [2] |
| **Commit id (hash)** | A 40-character code that names a commit uniquely; the first 7 characters are usually enough. [2] |
| **Composite action** | An action made of steps, defined in an `action.yml`. [18] |
| **Concurrency group** | A name that makes runs queue (or cancel each other) instead of overlapping. [17] |
| **Configuration variable** | A non-secret value stored on GitHub, read as `${{ vars.NAME }}`. [16] |
| **Conflict markers** | The `<<<<<<<`, `=======` and `>>>>>>>` lines Git writes around each clash. [8] |
| **Content-addressed storage** | Storing data under a name computed from the data itself, its hash. [6] |
| **Context** | An object of information available to expressions, like `github` or `matrix`. [15] |
| **Continuous delivery** | Every change that passes is ready to release with one action. [13] |
| **Continuous deployment** | Every change that passes is released automatically. [13] |
| **Continuous integration (CI)** | Merging small changes often, with every change built and tested automatically. [13] |
| **Cron** | A five-field schedule format: minute, hour, day of month, month, day of week. [18] |
| **Current branch** | The branch `HEAD` points to; new commits go onto it. [7] |
| **Default branch** | The branch GitHub shows first and merges pull requests into by default, usually `main`. [12] |
| **Dependabot** | GitHub's bot that opens pull requests to update dependencies, including actions. [16] |
| **Detached HEAD** | `HEAD` pointing straight at a commit instead of a branch; new commits there belong to no branch. [7] |
| **Diff** | The differences between two versions, shown line by line. [3] |
| **Distributed** | Every copy of a Git repository holds the full history, so most commands work offline. [1] |
| **Diverged** | Two copies of a branch each have commits the other doesn't. [10] |
| **Draft pull request** | A PR shared for early feedback that can't be merged until it's marked ready. [11] |
| **Environment** | A named deployment target with its own protection rules and secrets. [17] |
| **Evaluation gate** | A CI step that fails when a model's quality score drops below a threshold. [18] |
| **Event** | Something that starts a workflow, such as a push or a pull request. [13] |
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
| **GITHUB_TOKEN** | The short-lived token each job gets to use GitHub's API for its repository. [16] |
| **`.gitignore`** | A file listing patterns for files Git should not track. [4] |
| **Git LFS (Large File Storage)** | An extension that stores large files outside the repository and keeps small pointers in it. [4] |
| **`git reset`** | Moves the current branch to another commit; `--soft`, `--mixed` and `--hard` decide what happens to the staging area and files. [5] |
| **`git restore`** | Puts a file back to the version in the staging area (or, with `--staged`, unstages it). [5] |
| **`git revert`** | Makes a new commit that undoes an earlier commit, keeping the history. [5] |
| **`git switch`** | Changes the current branch and updates your files to match it; `-c` creates the branch first. [7] |
| **Hash** | A fixed-length fingerprint of data; Git uses SHA-1 now, and SHA-256 in new repositories from Git 3.0. [6] |
| **`hashFiles()`** | An expression function that returns a fingerprint of matching files. [18] |
| **`HEAD`** | The commit you're on now, usually the newest commit of the current branch. [3] |
| **Head branch / base branch** | The branch with the changes, and the branch it should merge into. [11] |
| **`HEAD~n`** | The commit n steps back from `HEAD` along first parents. [3] |
| **Here-document** | Several lines of text given to a command, written between `<<'EOF'` and a line holding only `EOF`. [1] |
| **Hunk** | One block of changes in a diff, starting with a header such as `@@ -1,3 +1,4 @@`. [3] |
| **Interactive rebase** | `git rebase -i`, which lets you reword, squash, reorder or drop your recent commits. [10] |
| **Job** | A set of steps that run in order on one runner. [13] |
| **Job output** | A value a job exposes to the jobs that need it. [15] |
| **Least privilege** | Giving a token or person only the permissions they need. [16] |
| **Masking** | Replacing a secret's value with `***` in logs. [16] |
| **Matrix** | A set of values that runs a job once per combination. [15] |
| **Merge** | Combining the work of another branch into the current one. [8] |
| **Merge base** | The last commit two branches have in common. [8] |
| **Merge commit** | A commit with two parents that joins two lines of history. [8] |
| **Merge conflict** | Both branches changed the same lines differently; Git stops and asks you to decide. [8] |
| **Merge ref** | `refs/pull/N/merge`, the test merge of a pull request into its base that `pull_request` runs test. [14] |
| **`needs:`** | A job setting that makes the job wait for other jobs, and skips it if they fail. [15] |
| **Negation (`!`)** | A pattern that re-includes something an earlier pattern ignored. [4] |
| **Object** | A piece of data Git stores under its hash: a blob, tree, commit or tag. [6] |
| **OIDC (OpenID Connect)** | A standard for short-lived identity tokens; clouds accept a job's OIDC token instead of a stored key. [16] |
| **`origin`** | The conventional name for the main remote; `git clone` sets it up. [9] |
| **Packfile** | A compressed file holding many objects, with similar objects stored as deltas. [6] |
| **Path filter** | `paths` or `paths-ignore` in a trigger, which skips runs that don't touch matching files. [18] |
| **Pattern** | A name with wildcards: `*` matches anything except `/`, `**` matches any number of folders. [4] |
| **Pinning** | Referring to an exact, unchangeable version, such as a full commit SHA. [16] |
| **Pipeline** | The automated sequence of steps (build, test, deploy) a change goes through. [13] |
| **Protection rule** | A condition a job must meet before deploying to an environment, such as a reviewer's approval. [17] |
| **Pull** | Fetch, then integrate the remote branch into your current branch (by merging or rebasing). [9] |
| **Pull request (PR)** | A proposal to merge one branch into another, with a place for review, discussion and automated checks. [11] |
| **Push** | Send your commits to a remote branch. [9] |
| **Rebase** | Replay a branch's commits on top of another commit, creating new commits with new ids. [10] |
| **Rebase and merge** | Merging a PR by replaying each of its commits onto the base branch. [11] |
| **Red / green build** | A failed / passed run. [14] |
| **Redirection** | Sending a command's output into a file: `>` replaces the file, `>>` adds to the end. [1] |
| **Ref** | A name that points to a commit, such as `refs/heads/main`, stored as a small file. [6] |
| **Reflog** | Git's local log of where `HEAD` and each branch have been, used to find "lost" commits. [5] |
| **Release** | A GitHub page for a tag, with notes and downloadable files. [12] |
| **Remote** | A named link to another copy of the repository, usually on GitHub. [9] |
| **Remote-tracking branch** | Your repository's record of a branch on a remote, such as `origin/main`; it moves only when you fetch, pull or push. [9] |
| **Repository (repo)** | A project folder whose history Git tracks; the history lives in its `.git` folder. [2] |
| **Required status check** | A check that must pass before a branch can be merged into (or pushed to) a protected branch. [14] |
| **Reusable workflow** | A workflow triggered by `workflow_call`, used as a job by other workflows. [18] |
| **Reviewer** | A person asked to read the changes and comment, approve or request changes. [11] |
| **`rev:path`** | A file as it was in a given commit, such as `HEAD~2:prices.txt`. [3] |
| **Rewriting history** | Replacing commits with new ones (amend, reset, rebase); safe only for commits nobody else has. [5] |
| **Rollback** | Returning production to a previous good version. [17] |
| **Root commit** | The first commit in a repository, the only one with no parent. [2] |
| **Rotating a secret** | Replacing it with a new one and disabling the old one. [4] |
| **Ruleset** | A set of rules GitHub enforces on matching branches or tags, such as requiring pull requests. [12] |
| **Run** | One execution of a workflow, with an ID. [13] |
| **Runner** | The machine, usually a fresh virtual machine, that runs a job. [13] |
| **Script injection** | Untrusted text ending up inside a script and running as code. [16] |
| **Secret** | A password, API key or token that gives access to something. [4, 16] |
| **Secret scanning** | A service that finds secrets in code; push protection blocks a push that contains one. [4] |
| **Self-hosted runner** | Your own machine running GitHub's runner program. [18] |
| **Semantic Versioning (SemVer)** | `MAJOR.MINOR.PATCH` version numbers that say whether a release breaks, adds or fixes. [12] |
| **Short id** | The first few characters of a commit id, enough to name it while it's unique. [3] |
| **Smoke test** | A quick check that a deployment basically works, such as fetching its home page. [17] |
| **Squash and merge** | Merging a PR as one new commit containing all its changes. [11] |
| **Staging area (index)** | The list of changes that will go into the next commit. [2] |
| **Stash** | A saved set of uncommitted changes, kept aside so you can switch with a clean working tree. [7] |
| **Status function** | `success()`, `failure()`, `always()` or `cancelled()` in an `if:`. [15] |
| **Step** | One shell command (`run:`) or one action (`uses:`) in a job. [13] |
| **Step output** | A value a step writes to `$GITHUB_OUTPUT`, read as `steps.<id>.outputs.<name>`. [15] |
| **Supply-chain attack** | An attack through software you depend on, such as a compromised action. [16] |
| **Symbolic ref** | A ref that points to another ref; `HEAD` usually holds `ref: refs/heads/main`. [6] |
| **Terminal** | A window where you type commands as text; the program inside it that runs them is the **shell**. [1] |
| **Tracked file** | A file that's in the last commit or the staging area. [2] |
| **Tree** | An object listing names, modes and the ids of blobs and other trees: a folder. [6] |
| **Trigger** | The event (with filters) that starts a workflow, set in `on:`. [14] |
| **Trunk-based development** | Everyone merges small changes into `main` at least daily, hiding unfinished work behind feature flags. [12] |
| **Unified diff** | The standard diff format: `-` for removed lines, `+` for added lines, and some unchanged lines around them. [3] |
| **Untracked file** | A file in the folder that Git has never been told to track. [2] |
| **Upstream** | The remote branch a local branch is paired with, used by plain `git push`, `git pull` and `git status`. [9] |
| **Version control** | A system that records every saved version of a project, who made it and why, so you can compare, undo and work together. [1] |
| **Workflow** | An automated process defined in a YAML file in `.github/workflows/`. [13] |
| **Workflow command** | A line starting with `::` that a step prints to talk to the runner. [15] |
| **workflow_dispatch** | The event for starting a workflow by hand, with optional inputs. [17] |
| **Working directory (current folder)** | The folder your commands act on; `pwd` prints it. [1] |
| **Working tree** | The files you see and edit. [2] |
| **YAML** | A text format for nested data that uses indentation for structure. [13] |
