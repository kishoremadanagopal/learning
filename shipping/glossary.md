# Shipping software glossary

Every term used in the course, A to Z. The number in brackets is the lesson where it's introduced.

| Term | Meaning |
|---|---|
| **Amend** | Replaces the last commit with a new one that has your fixes. [5] |
| **Blob** | An object holding a file's contents (without its name). [6] |
| **Commit** | A saved snapshot of the staged files, with an id, author, date, message and a link to its parent. [2] |
| **Commit id (hash)** | A 40-character code that names a commit uniquely; the first 7 characters are usually enough. [2] |
| **Content-addressed storage** | Storing data under a name computed from the data itself, its hash. [6] |
| **Diff** | The differences between two versions, shown line by line. [3] |
| **Distributed** | Every copy of a Git repository holds the full history, so most commands work offline. [1] |
| **Git** | The most widely used version control system; free, open source and distributed. [1] |
| **`git check-ignore -v`** | Shows which pattern in which file ignores a path. [4] |
| **`git config`** | Reads and sets Git's settings; `--global` settings apply to every repository on your computer. [1] |
| **GitHub** | A website that hosts Git repositories and adds pull requests, issues and automation; it isn't Git itself. [1] |
| **`.gitignore`** | A file listing patterns for files Git should not track. [4] |
| **Git LFS (Large File Storage)** | An extension that stores large files outside the repository and keeps small pointers in it. [4] |
| **`git reset`** | Moves the current branch to another commit; `--soft`, `--mixed` and `--hard` decide what happens to the staging area and files. [5] |
| **`git restore`** | Puts a file back to the version in the staging area (or, with `--staged`, unstages it). [5] |
| **`git revert`** | Makes a new commit that undoes an earlier commit, keeping the history. [5] |
| **Hash** | A fixed-length fingerprint of data; Git uses SHA-1 now, and SHA-256 in new repositories from Git 3.0. [6] |
| **`HEAD`** | The commit you're on now, usually the newest commit of the current branch. [3] |
| **`HEAD~n`** | The commit n steps back from `HEAD` along first parents. [3] |
| **Here-document** | Several lines of text given to a command, written between `<<'EOF'` and a line holding only `EOF`. [1] |
| **Hunk** | One block of changes in a diff, starting with a header such as `@@ -1,3 +1,4 @@`. [3] |
| **Negation (`!`)** | A pattern that re-includes something an earlier pattern ignored. [4] |
| **Object** | A piece of data Git stores under its hash: a blob, tree, commit or tag. [6] |
| **Packfile** | A compressed file holding many objects, with similar objects stored as deltas. [6] |
| **Pattern** | A name with wildcards: `*` matches anything except `/`, `**` matches any number of folders. [4] |
| **Redirection** | Sending a command's output into a file: `>` replaces the file, `>>` adds to the end. [1] |
| **Ref** | A name that points to a commit, such as `refs/heads/main`, stored as a small file. [6] |
| **Reflog** | Git's local log of where `HEAD` and each branch have been, used to find "lost" commits. [5] |
| **Repository (repo)** | A project folder whose history Git tracks; the history lives in its `.git` folder. [2] |
| **`rev:path`** | A file as it was in a given commit, such as `HEAD~2:prices.txt`. [3] |
| **Rewriting history** | Replacing commits with new ones (amend, reset, rebase); safe only for commits nobody else has. [5] |
| **Root commit** | The first commit in a repository, the only one with no parent. [2] |
| **Rotating a secret** | Replacing it with a new one and disabling the old one. [4] |
| **Secret** | A password, API key or token that gives access to something. [4] |
| **Secret scanning** | A service that finds secrets in code; push protection blocks a push that contains one. [4] |
| **Short id** | The first few characters of a commit id, enough to name it while it's unique. [3] |
| **Staging area (index)** | The list of changes that will go into the next commit. [2] |
| **Symbolic ref** | A ref that points to another ref; `HEAD` usually holds `ref: refs/heads/main`. [6] |
| **Terminal** | A window where you type commands as text; the program inside it that runs them is the **shell**. [1] |
| **Tracked file** | A file that's in the last commit or the staging area. [2] |
| **Tree** | An object listing names, modes and the ids of blobs and other trees: a folder. [6] |
| **Unified diff** | The standard diff format: `-` for removed lines, `+` for added lines, and some unchanged lines around them. [3] |
| **Untracked file** | A file in the folder that Git has never been told to track. [2] |
| **Version control** | A system that records every saved version of a project, who made it and why, so you can compare, undo and work together. [1] |
| **Working directory (current folder)** | The folder your commands act on; `pwd` prints it. [1] |
| **Working tree** | The files you see and edit. [2] |
