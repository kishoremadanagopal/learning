@@ version-control
topics: what version control solves, Git as a distributed version control system, Git compared with GitHub, GitLab and Bitbucket, the terminal and the shell, prompts and the current folder, pwd, ls, cd, mkdir, echo, cat, redirection with > and >>, here-documents, chaining with &&, how the sandbox terminal runs real Git, installing Git on Windows, macOS and Linux, git --version, git config --global for name, email and the default branch, where configuration is stored
terms:
- **Version control:** a system that records every saved version of a project, who made it and why, so you can compare, undo and work together.
- **Git:** the most widely used version control system; free, open source and distributed.
- **Distributed:** every copy of a Git repository holds the full history, so most commands work offline.
- **GitHub:** a website that hosts Git repositories and adds pull requests, issues and automation; it isn't Git itself.
- **Terminal:** a window where you type commands as text; the program inside it that runs them is the **shell**.
- **Working directory (current folder):** the folder your commands act on; `pwd` prints it.
- **Redirection:** sending a command's output into a file: `>` replaces the file, `>>` adds to the end.
- **Here-document:** several lines of text given to a command, written between `<<'EOF'` and a line holding only `EOF`.
- **`git config`:** reads and sets Git's settings; `--global` settings apply to every repository on your computer.
mistakes:
- Typing `>` when you meant `>>` and replacing a whole file.
- Running Git commands in the wrong folder; check with `pwd` first.
- Committing before setting `user.name` and `user.email`, so commits carry a made-up identity.
- Thinking GitHub is required to use Git; Git works entirely on your own computer.
- Copying commands with a leading `$` from documentation; the `$` is the prompt, not part of the command.

glance:
- Where am I? | pwd, then ls -a | nothing | —
- Make a folder and go in | mkdir -p name && cd name | creates a folder | rm -r name
- Write a file | echo "text" > file (>> to append) | replaces (or extends) the file | rewrite the file
- Set your identity | git config --global user.name "…" and user.email "…" | ~/.gitconfig | git config --global --unset key
- Default branch main | git config --global init.defaultBranch main | ~/.gitconfig | git config --global --unset init.defaultBranch

@@ first-commits
topics: git init and the .git folder, the working tree, staging area (index) and repository, git status, git add for files, folders and everything, git commit -m, git log, what a commit records (snapshot, id, author, date, message, parent), the first (root) commit, staging only some files, git commit -a and its limits, git add -p on your own computer, writing good commit messages (imperative subject, about 50 characters, a body that says why), small focused commits
terms:
- **Repository (repo):** a project folder whose history Git tracks; the history lives in its `.git` folder.
- **Working tree:** the files you see and edit.
- **Staging area (index):** the list of changes that will go into the next commit.
- **Commit:** a saved snapshot of the staged files, with an id, author, date, message and a link to its parent.
- **Commit id (hash):** a 40-character code that names a commit uniquely; the first 7 characters are usually enough.
- **Untracked file:** a file in the folder that Git has never been told to track.
- **Tracked file:** a file that's in the last commit or the staging area.
- **Root commit:** the first commit in a repository, the only one with no parent.
mistakes:
- Running `git init` in your home folder instead of the project folder.
- Expecting `git commit -a` to include new files; it only stages files Git already tracks.
- Using `git add .` without checking `git status`, and committing stray files.
- Writing messages like "fix" or "changes" that won't mean anything in six months.
- Putting several unrelated changes in one commit, so none of them can be undone alone.
- Nesting a repository inside another by running `git init` in a subfolder.

glance:
- Start tracking a folder | git init | creates .git | rm -rf .git (deletes all history)
- Stage a change | git add file (git add . for all) | staging area | git restore --staged file
- Save a snapshot | git commit -m "Add price list" | new commit on the branch | git reset --soft HEAD~1
- Stage tracked files and commit | git commit -am "…" | staging area and history | git reset --soft HEAD~1
- See where you are | git status | nothing | —

@@ seeing-changes
topics: git status -s and its two-letter codes, git diff for unstaged changes, git diff --staged, git diff between two commits, reading a unified diff (---, +++, hunk headers, + and - lines), git diff --stat and --name-only, git log --oneline, -n, --stat, -p, --format, a file path and --all, naming commits with HEAD, HEAD~1 and short ids, git show for a commit and for a file at a commit (rev:path), finding when and why a line changed, git log -S and git blame on your own computer
terms:
- **Diff:** the differences between two versions, shown line by line.
- **Unified diff:** the standard diff format: `-` for removed lines, `+` for added lines, and some unchanged lines around them.
- **Hunk:** one block of changes in a diff, starting with a header such as `@@ -1,3 +1,4 @@`.
- **`HEAD`:** the commit you're on now, usually the newest commit of the current branch.
- **`HEAD~n`:** the commit n steps back from `HEAD` along first parents.
- **Short id:** the first few characters of a commit id, enough to name it while it's unique.
- **`rev:path`:** a file as it was in a given commit, such as `HEAD~2:prices.txt`.
mistakes:
- Running `git diff` and seeing nothing because the changes are already staged; use `git diff --staged`.
- Reading the order of `git diff A B` backwards: it shows how to get from A to B.
- Using `HEAD~1` in a message or a script as if it were fixed; it moves with every commit.
- Reading `git log` without `--oneline` or `-n` and getting lost in the output.
- Forgetting `--` before a file name that looks like a branch name.

glance:
- Short status | git status -s | nothing | —
- Unstaged changes | git diff | nothing | —
- Staged changes | git diff --staged | nothing | —
- Compact history | git log --oneline -n 5 | nothing | —
- One commit in full | git show HEAD~1 | nothing | —
- A file at a commit | git show HEAD~2:prices.txt | nothing | —

@@ ignoring-files
topics: what doesn't belong in a repository (dependencies, build output, caches, logs, editor and OS files, local settings, secrets, large data), .gitignore syntax (names, *, **, a trailing / for folders, a leading / for the root, comments, ! for exceptions), git status --ignored, git check-ignore -v, global ignores, committing .env.example instead of .env, git rm --cached to untrack a committed file, why removing a secret doesn't remove it from history, rotating leaked secrets, GitHub secret scanning and push protection, history rewriting tools, large files and Git LFS
terms:
- **`.gitignore`:** a file listing patterns for files Git should not track.
- **Pattern:** a name with wildcards: `*` matches anything except `/`, `**` matches any number of folders.
- **Negation (`!`):** a pattern that re-includes something an earlier pattern ignored.
- **`git check-ignore -v`:** shows which pattern in which file ignores a path.
- **Secret:** a password, API key or token that gives access to something.
- **Rotating a secret:** replacing it with a new one and disabling the old one.
- **Secret scanning:** a service that finds secrets in code; push protection blocks a push that contains one.
- **Git LFS (Large File Storage):** an extension that stores large files outside the repository and keeps small pointers in it.
mistakes:
- Adding a pattern to `.gitignore` and expecting Git to stop tracking a file it already tracks.
- Deleting a leaked key in a new commit and keeping it in use; it's still in the history, so rotate it.
- Committing `.env` instead of a `.env.example` with placeholder values.
- Ignoring a folder with `logs/` and then trying to re-include one file inside it with `!`; Git doesn't look inside an ignored folder.
- Committing `node_modules`, virtual environments or build output instead of the files that recreate them.

glance:
- Ignore files | patterns in .gitignore, committed | which files Git sees | remove the pattern
- Why is it ignored? | git check-ignore -v path | nothing | —
- Stop tracking, keep the file | git rm --cached file, add to .gitignore, commit | index and next commit | git add -f file
- Leaked a secret | rotate it first, then remove it from the code | the key itself | — (assume it's public)
- Large binary files | git lfs track "*.psd" (own computer) | .gitattributes | git lfs untrack

@@ undoing
topics: choosing an undo by what you want to change, git restore to discard working-tree changes, git restore --staged to unstage, git restore --source to bring back an old version, git commit --amend to fix the last message or add a forgotten file, git reset --soft, --mixed and --hard with what each moves, git revert to undo a commit with a new commit, reverting an older commit, the golden rule about shared history, the reflog and recovering after reset --hard, why uncommitted work can't be recovered
terms:
- **`git restore`:** puts a file back to the version in the staging area (or, with `--staged`, unstages it).
- **Amend:** replaces the last commit with a new one that has your fixes.
- **`git reset`:** moves the current branch to another commit; `--soft`, `--mixed` and `--hard` decide what happens to the staging area and files.
- **`git revert`:** makes a new commit that undoes an earlier commit, keeping the history.
- **Rewriting history:** replacing commits with new ones (amend, reset, rebase); safe only for commits nobody else has.
- **Reflog:** Git's local log of where `HEAD` and each branch have been, used to find "lost" commits.
mistakes:
- Running `git reset --hard` with uncommitted work you wanted; that work is gone for good.
- Amending or resetting commits that are already pushed to a shared branch.
- Using `git revert` with the wrong commit; check it with `git show` first.
- Confusing `git restore file` (throws away edits) with `git restore --staged file` (keeps them).
- Using `git checkout` for everything; `git switch` and `git restore` split its jobs safely.

glance:
- Throw away edits to a file | git restore file | working tree (edits lost) | — (not recoverable)
- Unstage, keep edits | git restore --staged file | staging area | git add file
- Fix the last commit | git add …; git commit --amend -m "…" | replaces the last commit | git reset --soft HEAD@{1} (own computer)
- Undo commits, keep changes | git reset --soft HEAD~1 (or --mixed) | branch (and index) | git reset ORIG_HEAD
- Undo a pushed commit | git revert <commit> | adds a new commit | git revert the revert
- Recover after reset --hard | git reflog, then git reset --hard HEAD@{1} | branch and files | —

@@ inside-git
topics: what's in the .git folder (HEAD, config, objects, refs, index), the four object types (blob, tree, commit, annotated tag), content-addressed storage, hashes and the same content giving the same id, SHA-1 today and SHA-256 as the Git 3.0 default, snapshots rather than diffs, loose objects and packfiles, refs and HEAD as small text files, symbolic refs, git cat-file -t and -p, git rev-parse, rev:path and ^{tree}, why branches are cheap, why commits can't change and --amend makes a new one
terms:
- **Object:** a piece of data Git stores under its hash: a blob, tree, commit or tag.
- **Blob:** an object holding a file's contents (without its name).
- **Tree:** an object listing names, modes and the ids of blobs and other trees: a folder.
- **Content-addressed storage:** storing data under a name computed from the data itself, its hash.
- **Hash:** a fixed-length fingerprint of data; Git uses SHA-1 now, and SHA-256 in new repositories from Git 3.0.
- **Ref:** a name that points to a commit, such as `refs/heads/main`, stored as a small file.
- **Symbolic ref:** a ref that points to another ref; `HEAD` usually holds `ref: refs/heads/main`.
- **Packfile:** a compressed file holding many objects, with similar objects stored as deltas.
mistakes:
- Editing files inside `.git` by hand; use Git commands.
- Thinking Git stores each commit as a diff; it stores full snapshots and reuses unchanged objects.
- Expecting `--amend` to change a commit in place; it makes a new commit with a new id.
- Thinking two files with the same contents take twice the space; they share one blob.

glance:
- Which object is this? | git cat-file -t <id> | nothing | —
- Show an object | git cat-file -p <id> (HEAD, HEAD^{tree}, HEAD:file) | nothing | —
- Turn a name into an id | git rev-parse HEAD~1 | nothing | —
- Where does a branch point? | cat .git/refs/heads/main | nothing | —
- What is HEAD? | cat .git/HEAD | nothing | —
