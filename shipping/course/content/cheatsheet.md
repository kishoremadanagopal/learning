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
