# Shipping software glossary

Every term used in the course, A to Z. The number in brackets is the lesson where it's introduced.

| Term | Meaning |
|---|---|
| **Amend** | Replaces the last commit with a new one that has your fixes. [5] |
| **Blob** | An object holding a file's contents (without its name). [6] |
| **Branch** | A movable name that points to a commit; committing moves the current branch forward. [7] |
| **Cherry-pick** | Apply the change from one commit onto the current branch as a new commit. [10] |
| **Commit** | A saved snapshot of the staged files, with an id, author, date, message and a link to its parent. [2] |
| **Commit id (hash)** | A 40-character code that names a commit uniquely; the first 7 characters are usually enough. [2] |
| **Conflict markers** | The `<<<<<<<`, `=======` and `>>>>>>>` lines Git writes around each clash. [8] |
| **Content-addressed storage** | Storing data under a name computed from the data itself, its hash. [6] |
| **Current branch** | The branch `HEAD` points to; new commits go onto it. [7] |
| **Default branch** | The branch GitHub shows first and merges pull requests into by default, usually `main`. [12] |
| **Detached HEAD** | `HEAD` pointing straight at a commit instead of a branch; new commits there belong to no branch. [7] |
| **Diff** | The differences between two versions, shown line by line. [3] |
| **Distributed** | Every copy of a Git repository holds the full history, so most commands work offline. [1] |
| **Diverged** | Two copies of a branch each have commits the other doesn't. [10] |
| **Draft pull request** | A PR shared for early feedback that can't be merged until it's marked ready. [11] |
| **Fast-forward** | A merge where the current branch has no new commits, so Git just moves it forward. [8] |
| **Feature branch** | A short-lived branch for one piece of work, merged when it's done. [7] |
| **Feature flag** | A setting that switches code on or off without deploying again. [12] |
| **Fetch** | Download new commits from a remote and update remote-tracking branches, without changing your branches. [9] |
| **Force push** | Replace a remote branch with your version, even if that drops commits it had. [10] |
| **`--force-with-lease`** | A force push that refuses if the remote branch changed since you last fetched. [10] |
| **Fork** | Your own copy of someone else's repository on GitHub, used to propose changes to projects you can't push to. [12] |
| **Git** | The most widely used version control system; free, open source and distributed. [1] |
| **`git check-ignore -v`** | Shows which pattern in which file ignores a path. [4] |
| **`git config`** | Reads and sets Git's settings; `--global` settings apply to every repository on your computer. [1] |
| **GitHub** | A website that hosts Git repositories and adds pull requests, issues and automation; it isn't Git itself. [1] |
| **GitHub CLI (`gh`)** | GitHub's official command-line tool for repositories, pull requests, releases and more. [9] |
| **GitHub flow** | Short-lived branches merged into an always-deployable `main` through pull requests. [12] |
| **`.gitignore`** | A file listing patterns for files Git should not track. [4] |
| **Git LFS (Large File Storage)** | An extension that stores large files outside the repository and keeps small pointers in it. [4] |
| **`git reset`** | Moves the current branch to another commit; `--soft`, `--mixed` and `--hard` decide what happens to the staging area and files. [5] |
| **`git restore`** | Puts a file back to the version in the staging area (or, with `--staged`, unstages it). [5] |
| **`git revert`** | Makes a new commit that undoes an earlier commit, keeping the history. [5] |
| **`git switch`** | Changes the current branch and updates your files to match it; `-c` creates the branch first. [7] |
| **Hash** | A fixed-length fingerprint of data; Git uses SHA-1 now, and SHA-256 in new repositories from Git 3.0. [6] |
| **`HEAD`** | The commit you're on now, usually the newest commit of the current branch. [3] |
| **Head branch / base branch** | The branch with the changes, and the branch it should merge into. [11] |
| **`HEAD~n`** | The commit n steps back from `HEAD` along first parents. [3] |
| **Here-document** | Several lines of text given to a command, written between `<<'EOF'` and a line holding only `EOF`. [1] |
| **Hunk** | One block of changes in a diff, starting with a header such as `@@ -1,3 +1,4 @@`. [3] |
| **Interactive rebase** | `git rebase -i`, which lets you reword, squash, reorder or drop your recent commits. [10] |
| **Merge** | Combining the work of another branch into the current one. [8] |
| **Merge base** | The last commit two branches have in common. [8] |
| **Merge commit** | A commit with two parents that joins two lines of history. [8] |
| **Merge conflict** | Both branches changed the same lines differently; Git stops and asks you to decide. [8] |
| **Negation (`!`)** | A pattern that re-includes something an earlier pattern ignored. [4] |
| **Object** | A piece of data Git stores under its hash: a blob, tree, commit or tag. [6] |
| **`origin`** | The conventional name for the main remote; `git clone` sets it up. [9] |
| **Packfile** | A compressed file holding many objects, with similar objects stored as deltas. [6] |
| **Pattern** | A name with wildcards: `*` matches anything except `/`, `**` matches any number of folders. [4] |
| **Pull** | Fetch, then integrate the remote branch into your current branch (by merging or rebasing). [9] |
| **Pull request (PR)** | A proposal to merge one branch into another, with a place for review, discussion and automated checks. [11] |
| **Push** | Send your commits to a remote branch. [9] |
| **Rebase** | Replay a branch's commits on top of another commit, creating new commits with new ids. [10] |
| **Rebase and merge** | Merging a PR by replaying each of its commits onto the base branch. [11] |
| **Redirection** | Sending a command's output into a file: `>` replaces the file, `>>` adds to the end. [1] |
| **Ref** | A name that points to a commit, such as `refs/heads/main`, stored as a small file. [6] |
| **Reflog** | Git's local log of where `HEAD` and each branch have been, used to find "lost" commits. [5] |
| **Release** | A GitHub page for a tag, with notes and downloadable files. [12] |
| **Remote** | A named link to another copy of the repository, usually on GitHub. [9] |
| **Remote-tracking branch** | Your repository's record of a branch on a remote, such as `origin/main`; it moves only when you fetch, pull or push. [9] |
| **Repository (repo)** | A project folder whose history Git tracks; the history lives in its `.git` folder. [2] |
| **Reviewer** | A person asked to read the changes and comment, approve or request changes. [11] |
| **`rev:path`** | A file as it was in a given commit, such as `HEAD~2:prices.txt`. [3] |
| **Rewriting history** | Replacing commits with new ones (amend, reset, rebase); safe only for commits nobody else has. [5] |
| **Root commit** | The first commit in a repository, the only one with no parent. [2] |
| **Rotating a secret** | Replacing it with a new one and disabling the old one. [4] |
| **Ruleset** | A set of rules GitHub enforces on matching branches or tags, such as requiring pull requests. [12] |
| **Secret** | A password, API key or token that gives access to something. [4] |
| **Secret scanning** | A service that finds secrets in code; push protection blocks a push that contains one. [4] |
| **Semantic Versioning (SemVer)** | `MAJOR.MINOR.PATCH` version numbers that say whether a release breaks, adds or fixes. [12] |
| **Short id** | The first few characters of a commit id, enough to name it while it's unique. [3] |
| **Squash and merge** | Merging a PR as one new commit containing all its changes. [11] |
| **Staging area (index)** | The list of changes that will go into the next commit. [2] |
| **Stash** | A saved set of uncommitted changes, kept aside so you can switch with a clean working tree. [7] |
| **Symbolic ref** | A ref that points to another ref; `HEAD` usually holds `ref: refs/heads/main`. [6] |
| **Terminal** | A window where you type commands as text; the program inside it that runs them is the **shell**. [1] |
| **Tracked file** | A file that's in the last commit or the staging area. [2] |
| **Tree** | An object listing names, modes and the ids of blobs and other trees: a folder. [6] |
| **Trunk-based development** | Everyone merges small changes into `main` at least daily, hiding unfinished work behind feature flags. [12] |
| **Unified diff** | The standard diff format: `-` for removed lines, `+` for added lines, and some unchanged lines around them. [3] |
| **Untracked file** | A file in the folder that Git has never been told to track. [2] |
| **Upstream** | The remote branch a local branch is paired with, used by plain `git push`, `git pull` and `git status`. [9] |
| **Version control** | A system that records every saved version of a project, who made it and why, so you can compare, undo and work together. [1] |
| **Working directory (current folder)** | The folder your commands act on; `pwd` prints it. [1] |
| **Working tree** | The files you see and edit. [2] |
