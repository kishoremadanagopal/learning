@@@ part
id: 2
title: Branches, GitHub and pull requests
level: Intermediate
blurb: Working in parallel and working together: branches and stashes, merging and resolving conflicts, publishing to GitHub with remotes, keeping up with teammates through fetch, pull and rebase, opening, reviewing and merging pull requests, and the rules, workflows and releases teams use to keep main healthy. The terminal includes a pretend GitHub, driven with the real gh command.

@@@ lesson
id: branches
title: Branches and stashes
minutes: 24
summary: What a branch is (a movable name for a commit), creating and switching branches with git switch, how switching changes your files, listing branches, naming conventions, deleting branches with -d and -D, detached HEAD, and putting unfinished work aside with git stash.
---
So far every commit went onto one line of history, `main`. Real work rarely goes in a straight line: you start a feature, an urgent fix comes in, a colleague wants to try an idea. **Branches** let several lines of work exist side by side in the same repository, so each can be finished, reviewed and combined when it's ready, while `main` stays working.

### What a branch is

In Part 1 you saw that a branch is a tiny file holding one commit id. That's the whole trick: creating a branch writes a new name, it doesn't copy any files. When you commit, the branch you're on (the one `HEAD` points to) moves forward to the new commit; every other branch stays where it was.

![Commits A, B and C in a row with the label main pointing at C. A fourth commit D, Add inner tubes, has B as its parent, and the label add-tubes points at D. HEAD points at add-tubes. A branch is a pointer to a commit; committing moves the branch HEAD points to, and the others stay put](figures/branches.svg)

```sh setup=shop-history
git branch
git switch -c add-tubes
git branch
echo "tube 600" >> prices.txt
git commit -qam "Add inner tubes"
git log --oneline --graph --all
```

- `git branch` lists branches; `*` marks the one you're on.
- `git switch -c add-tubes` **c**reates a branch at the current commit and switches to it.
- `git log --oneline --graph --all` draws every branch; it's the quickest way to see where everything is.

`git switch` arrived in Git 2.23 (2019) to take over the branch half of the older, overloaded `git checkout`. You'll still see `git checkout -b add-tubes` in older guides; it does the same as `git switch -c add-tubes`.

### Switching changes your files

```sh setup=shop-branches
cat prices.txt
git switch add-tubes
cat prices.txt
git switch -
git branch -v
```

Switching rewrites the files in your folder to match the commit the branch points to: the tube line appears and disappears. `git switch -` goes back to the previous branch, and `git branch -v` adds each branch's latest commit.

Uncommitted changes come with you when you switch, as long as they don't clash. If a file you changed is also different on the other branch, Git refuses rather than overwrite your work:

```sh setup=shop-branches error
echo "tube 650" >> prices.txt
git switch add-tubes
```

### Putting work aside: git stash

When you need to switch but aren't ready to commit, **stash** the work: Git saves your changes in a special place and gives you a clean working tree.

```sh setup=shop-work-in-progress
git status -s
git stash
git status -s
git stash list
git stash pop
```

- `git stash` (short for `git stash push`) saves changes to tracked files, staged or not, and resets them. Untracked files, like `ideas.txt`, stay where they are; `git stash -u` takes them too.
- `git stash list` shows saved stashes, newest first as `stash@{0}`.
- `git stash pop` reapplies the newest stash and drops it; `git stash apply` reapplies and keeps it. Changes that were staged come back unstaged (add `--index` to restore the staging too).

Give a stash a name with `git stash push -m "half-done tube prices"`. Stashes are meant for minutes or hours: for anything longer, commit on a branch instead.

### Naming and deleting branches

Good branch names are short, lowercase and hyphenated, and say what the work is: `add-tubes`, `fix-pump-price`. Many teams add a prefix or a ticket number: `feature/checkout-page`, `fix/login-timeout`, `shop-142-add-tubes`. Names can't contain spaces, `..`, `~`, `^`, `:` or `?`.

```sh setup=shop-branches
git branch -d add-tubes
git branch -D add-tubes
git branch
```

`git branch -d` deletes a branch only if its commits are already in the current branch (or the branch's upstream, Lesson 3), so you can't lose work by accident. `-D` deletes it anyway; the commits stay in the repository until Git cleans up unreachable objects (weeks later), and the reflog can find them.

### Detached HEAD

`HEAD` normally points to a branch. If you switch to a commit instead (`git switch --detach HEAD~2`, or `git checkout <commit-id>`), you're in **detached HEAD**: fine for looking around, but new commits there belong to no branch and are easy to lose. If you make some you want to keep, give them a branch with `git switch -c new-name` before switching away.

### Try it on your own computer

- Make the graph a habit: `git config --global alias.lg "log --oneline --graph --all"` creates `git lg`.
- VS Code shows the current branch in the bottom-left corner; click it to switch or create branches. Most editors and Git GUIs (GitHub Desktop, GitKraken, Sourcetree) draw the same graph as `git log --graph`.
- `git stash show -p stash@{0}` shows what's in a stash before you pop it.

:::exercise Start a feature branch
In `~/shop`, start a branch called `add-helmets` from `main`. On it, add the line `helmet 4500` at the end of `prices.txt` and commit it with the message `Add helmets`. Then switch back to `main`, leaving `main` itself unchanged.
```sh starter setup=shop-history
git branch
```
```js check
const r = await repo("~/shop");
if (!(await r.branches()).includes("add-helmets")) throw new AssertionError("There's no branch add-helmets yet (git switch -c add-helmets).");
same(await r.branch(), "main", "The branch you're on at the end");
const log = await r.log("add-helmets");
same(log.slice(0, 2).map((c) => c.subject), ["Add helmets", "Add opening hours"], "The two newest commits on add-helmets");
same((await r.files("add-helmets"))["prices.txt"], "bell 800\npump 3000\nlock 2900\nhelmet 4500\n", "prices.txt on add-helmets");
same((await r.log("main")).length, 5, "The number of commits on main (main shouldn't change)");
if (!(await r.status()).clean) throw new AssertionError("The working tree should be clean: commit the change on add-helmets before switching back.");
same(r.read("prices.txt"), "bell 800\npump 3000\nlock 2900\n", "prices.txt in your folder, now that you're back on main");
```
```sh solution setup=shop-history
git switch -c add-helmets
echo "helmet 4500" >> prices.txt
git commit -am "Add helmets"
git switch main
git log --oneline --graph --all
```
hint: `git switch -c add-helmets` creates the branch and moves you onto it in one step.
hint: Append the line with `echo "helmet 4500" >> prices.txt`, then `git commit -am "Add helmets"` (the file is already tracked, so `-a` stages it).
hint: `git switch main` takes you back; `cat prices.txt` shows the helmet line has gone from your folder, because it's only on `add-helmets`.
approach:
1. **Understand:** one new commit, on a new branch; `main` stays where it was.
2. **Examples:** if you commit before creating the branch, the commit lands on `main`.
3. **Brute force:** copying the folder to try the change: slow, and Git can't combine the copies later.
4. **Pattern:** **branch first, then commit**.
5. **Plan:** switch -c → edit → commit → switch back → check the graph.
6. **Code and test:** `git log --oneline --graph --all` shows `add-helmets` one commit ahead of `main`.
walkthrough:
**Line by line**

- `git switch -c add-helmets` writes a new branch pointing at the same commit as `main` and makes it the current branch.
- The commit moves `add-helmets` forward; `main` doesn't move.
- `git switch main` rewrites `prices.txt` to `main`'s version.

**Trace:** the graph shows `* … (add-helmets) Add helmets` above `* … (HEAD -> main) Add opening hours`.

**Common wrong approach:** switching back to `main` before committing: the uncommitted helmet line comes with you, and `add-helmets` has no new commit.
:::

:::exercise Put unfinished work aside
Your work in progress in `~/shop` isn't ready: new opening hours (staged), an unfinished price change and a new `ideas.txt`. An urgent fix comes in: the README must say `# Ada's Bike Shop`.

Without committing your unfinished work: put it aside, create a branch `fix-readme` from `main`, commit the fix there with the message `Rename the shop` (changing only `README.md`), go back to `main`, and bring your unfinished work back. Leave nothing in the stash.
```sh starter setup=shop-work-in-progress
git status
```
```js check
const r = await repo("~/shop");
if (!(await r.branches()).includes("fix-readme")) throw new AssertionError("There's no branch fix-readme yet.");
same((await r.log("fix-readme")).map((c) => c.subject), ["Rename the shop", "Start the shop"], "The commits on fix-readme");
same(await r.files("fix-readme"), { "README.md": "# Ada's Bike Shop\n", "hours.txt": "Open 9 to 5, Monday to Saturday.\n", "prices.txt": "bell 800\npump 3000\nlock 2900\n" },
  "The files in the fix-readme commit (only README.md should change)");
same(await r.branch(), "main", "The branch you're on at the end");
same((await r.log("main")).length, 1, "The number of commits on main (the fix stays on its branch)");
same(r.read("hours.txt"), "Open 9 to 6, Monday to Saturday.\n", "hours.txt in your folder (your new hours should be back)");
same(r.read("prices.txt"), "bell 800\npump 3000\nlock 2900\ntube 600\n", "prices.txt in your folder (your unfinished price change should be back)");
if (!r.exists("ideas.txt")) throw new AssertionError("Keep ideas.txt in the folder.");
if (!ran(/git stash/)) throw new AssertionError("Use git stash to put the work aside.");
if ((await sh("git stash list")).trim()) throw new AssertionError("The stash should be empty at the end: git stash pop reapplies the work and drops it.");
```
```sh solution setup=shop-work-in-progress
git stash
git switch -c fix-readme
echo "# Ada's Bike Shop" > README.md
git commit -am "Rename the shop"
git switch main
git stash pop
git status -s
```
hint: `git stash` saves the changes to tracked files (staged and unstaged) and leaves you with a clean working tree. `ideas.txt` is untracked, so it simply stays in the folder.
hint: Then it's the usual: `git switch -c fix-readme`, write the new README line with `echo … > README.md`, and `git commit -am "Rename the shop"`.
hint: `git switch main`, then `git stash pop`. `git stash list` should print nothing afterwards.
approach:
1. **Understand:** the fix commit must contain only the README change, and your work must survive untouched.
2. **Examples:** switching without stashing carries your changes onto `fix-readme`, and `git commit -am` would sweep them into the fix.
3. **Brute force:** commit the unfinished work as "WIP": it ends up in history and in the fix branch.
4. **Pattern:** **stash, switch, fix, switch back, pop**.
5. **Plan:** stash → switch -c → edit → commit → switch main → pop.
6. **Code and test:** `git show --stat fix-readme` lists only `README.md`; `git status -s` on `main` shows your changes again.
walkthrough:
**Line by line**

- `git stash` records the staged hours and the unstaged price change, then resets both files.
- `git switch -c fix-readme` starts from the same commit as `main`, with a clean tree.
- The commit contains only the README.
- `git stash pop` reapplies the changes on `main` and drops the stash; the hours come back unstaged, which is fine.

**Trace:** `git status -s` at the end shows ` M hours.txt`, ` M prices.txt` and `?? ideas.txt`.

**Common wrong approach:** `git stash apply` instead of `pop`: the work comes back, but the stash stays in the list.
:::

:::quiz
? What does git switch -c add-tubes do?
+ Creates a branch at the current commit and switches to it
- Copies all files into a new folder called add-tubes
- Switches to add-tubes, which must already exist
- Creates a branch without switching to it
= Creating a branch only writes a new name pointing at a commit; -c also switches to it.
? You commit while on add-tubes. Which branch moves?
+ Only add-tubes
- Only main
- Both main and add-tubes
- Neither; branches never move
= The branch HEAD points to moves forward to the new commit; the others stay where they were.
? git switch main fails with "Your local changes … would be overwritten". What's a safe way forward?
+ Commit the changes or stash them, then switch
- Delete the .git folder
- Run git switch -f main
- Rename the branch
= -f would throw your changes away. Commit them on the current branch, or stash them for a short while.
? Which command deletes a branch only if its work is already merged?
+ git branch -d name
- git branch -D name
- git switch -d name
- git stash drop name
= -d refuses to delete unmerged work; -D deletes anyway.
:::

@@@ lesson
id: merging
title: Merging and conflicts
minutes: 26
summary: Combining branches with git merge, fast-forward merges and three-way merges with a merge commit, the merge base, --no-ff and --ff-only, reading merges in git log --graph, merge conflicts and their markers, resolving them and finishing the merge, git merge --abort, and habits that keep conflicts rare.
---
A branch is only useful if its work can come back. **Merging** combines the work of another branch into the one you're on: you stand on the branch that should receive the work (usually `main`) and run `git merge <other-branch>`.

![Top: a fast-forward. main points at B; add-tubes has one more commit C on top of B. git merge add-tubes simply moves main to C, with no new commit. Bottom: a three-way merge. From B, main went on to C and the branch to D. Git makes a merge commit M with two parents, C and D, combining the changes B to C and B to D; if both changed the same lines, that's a conflict](figures/merge-types.svg)

### Fast-forward merges

If `main` hasn't moved since the branch started, there's nothing to combine: Git just moves `main` forward to the branch's commit. That's a **fast-forward**.

```sh setup=shop-branches
git merge add-tubes
git log --oneline --graph --all
```

No new commit is made, and the history stays a straight line.

### Three-way merges and merge commits

If both branches have new commits, Git finds the **merge base** (the last commit they share), works out what each side changed since then, and combines both sets of changes in a new **merge commit** with two parents.

```sh setup=shop-diverged-branches
git log --oneline --graph --all
git merge add-tubes
git log --oneline --graph
```

The graph shows the two lines joining at the merge commit. On your own computer, Git opens your editor with the message `Merge branch 'add-tubes'` so you can add detail; save and close to accept it, or pass `--no-edit` (or `-m "…"`). The sandbox has no editor, so it accepts the default message.

Two options control fast-forwarding:

| Option | Effect | Used for |
|---|---|---|
| `--no-ff` | always make a merge commit, even when a fast-forward is possible | keeping a visible record that a feature branch existed |
| `--ff-only` | merge only if it's a fast-forward, otherwise stop | updating a branch that should never get merge commits |

### Conflicts

Git combines changes line by line. If both sides changed **the same lines** differently, it can't know which version is right, so it stops with a **merge conflict** and asks you:

```sh setup=shop-conflict
git merge cheaper-bell
git status
cat prices.txt
```

Inside the file, Git marks the clash:

```text
<<<<<<< HEAD          what your branch (main) has
bell 850
=======
bell 700
>>>>>>> cheaper-bell  what the branch you're merging has
```

Everything outside the markers merged cleanly. To resolve the conflict, edit the file to what it **should** be (one side, the other, or a combination), delete all three marker lines, then `git add` the file and commit to finish the merge:

```sh setup=shop-conflict
git merge cheaper-bell
printf "bell 750\npump 3000\nlock 2900\n" > prices.txt
git add prices.txt
git status
git commit --no-edit
git log --oneline --graph
```

`git add` marks the file as resolved; `git commit` without `-m` reuses the prepared message `Merge branch 'cheaper-bell'`. If a merge goes wrong, `git merge --abort` puts everything back as it was before the merge started.

### Keeping conflicts rare

Conflicts aren't errors; they're Git asking a question only a person can answer. They're rarer and smaller when you:

- keep branches **short-lived** (days, not weeks) and merge `main` into long-running ones regularly;
- make **small, focused commits** that don't reformat files they don't need to change;
- agree on formatting tools (Part 3 runs them automatically), so whitespace changes don't collide.

### Try it on your own computer

- VS Code highlights conflicts with **Accept Current Change**, **Accept Incoming Change** and **Accept Both Changes** buttons, and has a three-way **merge editor** (Resolve in Merge Editor). Current is your branch (`HEAD`); incoming is the branch you're merging.
- `git config --global merge.conflictStyle zdiff3` adds a third section to the markers showing the merge base's version, which makes it much easier to see what each side actually changed.
- `git diff` during a conflict shows only the conflicted parts; `git log --merge -p` shows the commits that caused it.

:::exercise Merge a finished branch
In `~/shop`, the branch `add-tubes` is finished, and `main` has moved on since it started. Merge `add-tubes` into `main` so that `main` has both the opening hours and the inner tubes, with a merge commit, and then delete the branch.
```sh starter setup=shop-diverged-branches
git log --oneline --graph --all
```
```js check
const r = await repo("~/shop");
same(await r.branch(), "main", "The branch you're on at the end");
const log = await r.log("main");
if (log[0].parents.length !== 2) throw new AssertionError("The newest commit on main should be a merge commit with two parents: run git merge add-tubes while on main.");
const subjects = log.map((c) => c.subject);
for (const s of ["Add inner tubes", "Add opening hours"]) if (!subjects.includes(s)) throw new AssertionError(`main's history should include "${s}".`);
same(await r.files("main"), { "README.md": "# Bike shop\n", "hours.txt": "Open 9 to 5, Monday to Saturday.\n", "prices.txt": "bell 800\npump 3000\nlock 2900\ntube 600\n" }, "The files on main after the merge");
if ((await r.branches()).includes("add-tubes")) throw new AssertionError("Delete the merged branch: git branch -d add-tubes.");
if (!(await r.status()).clean) throw new AssertionError("The working tree should be clean.");
```
```sh solution setup=shop-diverged-branches
git log --oneline --graph --all
git merge add-tubes
git branch -d add-tubes
git log --oneline --graph
```
hint: Merging brings the named branch into the branch you're on. You're already on `main`.
hint: `git merge add-tubes` makes a merge commit here, because both branches have new commits (a fast-forward isn't possible).
hint: `git branch -d add-tubes` works once its commit is part of `main`.
approach:
1. **Understand:** `main` should end up with both lines of work, joined by a merge commit.
2. **Examples:** merging `main` into `add-tubes` instead would update the branch, not `main`.
3. **Brute force:** copying the tube line into `main` by hand: same files, but Git wouldn't know the branch was merged, and `-d` would refuse to delete it.
4. **Pattern:** **stand on the receiving branch, merge the other one in**.
5. **Plan:** check the graph → merge → delete the branch → check the graph.
6. **Code and test:** `git log --oneline --graph` shows the two lines joining at `Merge branch 'add-tubes'`.
walkthrough:
**Line by line**

- The first graph shows `main` and `add-tubes` splitting after `Start the shop`.
- `git merge add-tubes` finds that split point, combines the tube line (from the branch) with the hours file (from `main`), and records a merge commit.
- `git branch -d add-tubes` removes only the name; its commit stays in `main`'s history.

**Trace:** `prices.txt` on `main` now ends with `tube 600`, and `hours.txt` is still there.

**Common wrong approach:** `git branch -d add-tubes` before merging: Git refuses with "not fully merged", which is exactly its job.
:::

:::exercise Resolve a conflict
In `~/shop`, `main` raised the bell's price to 850 while the branch `cheaper-bell` lowered it to 700. The owner has decided: the bell costs **700**. Merge `cheaper-bell` into `main`, resolve the conflict so `prices.txt` reads `bell 700`, `pump 3000`, `lock 2900`, and finish the merge with a merge commit.
```sh starter setup=shop-conflict
git log --oneline --graph --all
```
```js check
const r = await repo("~/shop");
if (r.inProgress() === "merge") throw new AssertionError("The merge isn't finished yet: git add the resolved file, then git commit.");
same(await r.branch(), "main", "The branch you're on at the end");
const log = await r.log("main");
if (log[0].parents.length !== 2) throw new AssertionError("The newest commit on main should be the merge commit (two parents).");
const text = (await r.files("main"))["prices.txt"];
if (/^(<<<<<<<|=======|>>>>>>>)/m.test(text)) throw new AssertionError("The committed prices.txt still contains conflict markers: delete the <<<<<<<, ======= and >>>>>>> lines.");
same(text, "bell 700\npump 3000\nlock 2900\n", "prices.txt in the merge commit");
if (!(await r.status()).clean) throw new AssertionError("The working tree should be clean.");
```
```sh solution setup=shop-conflict
git merge cheaper-bell
cat prices.txt
printf "bell 700\npump 3000\nlock 2900\n" > prices.txt
git add prices.txt
git commit --no-edit
git log --oneline --graph
```
hint: `git merge cheaper-bell` stops with a conflict in `prices.txt`; `cat prices.txt` shows the markers around the two bell lines.
hint: Write the whole resolved file, for example `printf "bell 700\npump 3000\nlock 2900\n" > prices.txt`. The markers must be gone.
hint: `git add prices.txt` marks it resolved; `git commit --no-edit` (or `git commit -m "…"`) finishes the merge.
approach:
1. **Understand:** Git can't choose between two edits of the same line; you decide, then tell Git you're done.
2. **Examples:** keeping the file with markers and committing would break the price list.
3. **Brute force:** `git merge --abort` and copying the line by hand: no record that the branch was merged.
4. **Pattern:** **merge → edit to the right result → add → commit**.
5. **Plan:** merge → look at the markers → write the resolved file → add → commit.
6. **Code and test:** `git status` says the tree is clean; `git log --graph` shows the merge commit.
walkthrough:
**Line by line**

- The merge stops: `CONFLICT (content): Merge conflict in prices.txt`.
- Between `<<<<<<< HEAD` and `=======` is `main`'s line (`bell 850`); below it, up to `>>>>>>> cheaper-bell`, is the branch's (`bell 700`).
- Writing the file without markers, with `bell 700`, is the resolution.
- `git add` + `git commit` record a merge commit with both branches as parents.

**Trace:** `cat prices.txt` → `bell 700`, `pump 3000`, `lock 2900`.

**Common wrong approach:** running `git commit -am` while the markers are still in the file: Git commits them, and the price list is broken.
:::

:::quiz
? When does git merge make a fast-forward instead of a merge commit?
+ When the branch you're on has no new commits since the other branch started
- When the branches changed different files
- Always, unless there's a conflict
- When you pass --no-ff
= If there's nothing to combine, Git just moves the branch pointer forward.
? What is the merge base?
+ The last commit both branches share
- The first commit in the repository
- The newest commit on main
- The commit with the conflict
= Git compares each side with the merge base to work out what each one changed.
? What does the section between ======= and >>>>>>> cheaper-bell contain?
+ The version from the branch being merged in
- The version from your current branch
- The merge base's version
- Git's suggested resolution
= Above ======= is HEAD (your branch); below is the incoming branch.
? You're halfway through resolving a confusing conflict and want to start over. What do you run?
+ git merge --abort
- git branch -D main
- git commit -am "fix"
- git switch -c retry
= It restores the files and branch to how they were before the merge began.
:::

@@@ lesson
id: remotes
title: GitHub and remotes: clone, push and pull
minutes: 28
summary: Remote repositories and GitHub, creating a GitHub repository with gh repo create, remotes and origin, git remote -v, cloning, pushing with git push and -u, upstream branches and remote-tracking branches such as origin/main, ahead and behind in git status, fetching and pulling, a rejected push, and signing in to GitHub from your own computer (gh auth login, credential managers and SSH keys).
---
Until now the repository lived only on your computer. To share it, back it up and collaborate, you put a copy on a server everyone can reach. **GitHub** is the most widely used host; GitLab, Bitbucket and Azure DevOps work the same way for everything in this lesson.

A **remote** is a named link to another copy of the repository, usually on GitHub. By convention the main one is called **origin**. Git never syncs by itself: you send commits with `git push` and get other people's commits with `git fetch` or `git pull`.

![On your computer, ~/shop has your branch main and origin/main, Git's record of what main looked like on GitHub when you last talked to it. On GitHub, ada/shop has its own main. git push sends your commits to GitHub's main; git fetch brings GitHub's commits back and updates origin/main. git pull is git fetch followed by merging (or rebasing) origin/main into main](figures/remotes.svg)

### Publishing a repository

On github.com you create a repository with **New repository**, then connect your local one to it. With **GitHub CLI** (`gh`), it's one command from the project folder. The sandbox has a pretend GitHub, and you're signed in as `ada`:

```sh setup=shop-history
gh auth status
gh repo create shop --public --source=. --push
git remote -v
git status
git log --oneline
```

`gh repo create` made `github.com/ada/shop`, added it as the remote `origin`, and pushed `main`. Without `gh`, the same takes two commands after creating the repository on the website:

```bash
git remote add origin https://github.com/ada/shop.git
git push -u origin main
```

Look at the new lines in `git status` and `git log`:

- **`origin/main`** is a **remote-tracking branch**: Git's memory of where `main` was on GitHub the last time you pushed or fetched. It only changes when you talk to GitHub.
- **`Your branch is up to date with 'origin/main'`**: your `main` has an **upstream**, the remote branch it's paired with. Once set (that's what `-u` does), plain `git push`, `git pull` and `git status` know where to compare and send.

Public repositories can be seen by anyone; use `--private` for work that isn't meant to be public.

### Cloning

`git clone` copies a repository, all its history included, into a new folder and sets up `origin` and `main`'s upstream for you:

```sh setup=shop-on-github
cd ~
git clone https://github.com/ada/shop.git shop-copy
cd shop-copy
git log --oneline
git branch -a
```

`git branch -a` lists remote-tracking branches too. `origin/HEAD` records which branch GitHub considers the default (`main`).

### Pushing

```sh setup=shop-on-github
echo "tube 600" >> prices.txt
git commit -qam "Add inner tubes"
git status
git push
git status
```

After the commit, your branch is **ahead** of `origin/main` by one commit; `git push` sends it, and both point at the same commit again. The line `a1b2c3d..e4f5a6b  main -> main` says GitHub's `main` moved from one commit to the other.

A **new** branch has no upstream yet, so plain `git push` refuses and tells you exactly what to run:

```sh setup=shop-on-github
git switch -c add-helmets
echo "helmet 4500" >> prices.txt
git commit -qam "Add helmets"
git push
git push -u origin add-helmets
```

GitHub's reply (the `remote:` lines) even suggests opening a pull request: that's Lesson 5. If you'd rather not type `-u origin <branch>` every time, `git config --global push.autoSetupRemote true` (Git 2.37 or later) makes the first plain `git push` of a new branch set the upstream itself.

### Fetching and pulling

Your teammate Grace pushed a commit to GitHub. Your copy doesn't know until you ask:

```sh setup=shop-teammate-pushed
git status
git fetch
git status
git log --oneline --graph --all
git pull
```

- `git status` compares with `origin/main` as Git last saw it, so at first it wrongly says you're up to date.
- `git fetch` downloads new commits and moves `origin/main`; your own `main` and your files don't change. Now status says you're **behind**.
- `git pull` is `git fetch` followed by integrating `origin/main` into your branch. Here your `main` had nothing new, so it's a fast-forward.

Fetching is always safe; pull when you're ready to integrate. **Pull before you start work** each day, and before you push.

### When a push is rejected

If someone pushed while you were working, GitHub's `main` has a commit yours doesn't:

```sh setup=shop-diverged error
git push
```

Git refuses rather than throw Grace's commit away. You need to integrate her work first; the next lesson shows how.

### Try it on your own computer

1. **Create a GitHub account** at [github.com/signup](https://github.com/signup) if you don't have one (free).
2. **Install GitHub CLI** from [cli.github.com](https://cli.github.com): Windows `winget install --id GitHub.cli`, macOS `brew install gh`, Linux: see [the Linux install page](https://github.com/cli/cli/blob/trunk/docs/install_linux.md).
3. **Sign in:** `gh auth login`, choose GitHub.com and HTTPS, and say yes to "Authenticate Git with your GitHub credentials". It signs you in through your browser and sets Git up to use the same login.

GitHub stopped accepting account passwords for Git operations in 2021. Besides `gh`, the alternatives are **Git Credential Manager** (included with Git for Windows; [other systems](https://github.com/git-ecosystem/git-credential-manager)), or **SSH keys**: `ssh-keygen -t ed25519 -C "you@example.com"`, add the `.pub` file under GitHub **Settings → SSH and GPG keys**, and use `git@github.com:you/shop.git` URLs ([GitHub's SSH guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)). Never put a password or token inside a remote URL: it's saved in plain text in `.git/config`.

To practise with a "teammate" on your own, clone your repository a second time into another folder, set a different `user.name` there with `git config user.name "…"`, and push from both.

:::exercise Publish to GitHub
Publish `~/shop` to GitHub as a **public** repository called `shop` (you're signed in as `ada`, so it becomes `ada/shop`). Push `main`, and make sure your `main` tracks `origin/main`.
```sh starter setup=shop-history
gh auth status
```
```js check
const r = await repo("~/shop");
const gh = await github("ada/shop");
const local = (await r.log("main")).map((c) => c.oid);
const remote = (await gh.log("main")).map((c) => c.oid);
if (!remote.length) throw new AssertionError("ada/shop exists, but main hasn't been pushed to it yet (git push -u origin main).");
same(remote, local, "The commits on GitHub's main (they should be the same as yours)");
same(await r.upstream("main"), "origin/main", "The upstream of your main");
same(await r.remotes(), { origin: "https://github.com/ada/shop.git" }, "Your remotes");
```
```sh solution setup=shop-history
gh repo create shop --public --source=. --push
git status
git log --oneline
```
hint: `gh repo create` can do everything at once. `gh repo create --help` on your own computer lists its options; you need the name, `--public`, `--source=.` and `--push`.
hint: Alternatively: `gh repo create shop --public` creates an empty repository; then `git remote add origin https://github.com/ada/shop.git` and `git push -u origin main`.
hint: `git status` should end up saying `Your branch is up to date with 'origin/main'.`
approach:
1. **Understand:** three things: a repository on GitHub, a remote called `origin` pointing at it, and `main` pushed with an upstream.
2. **Examples:** creating the repository without pushing leaves it empty.
3. **Brute force:** uploading files through the website: no history, and no link to your local repository.
4. **Pattern:** **create remote → connect → push -u**.
5. **Plan:** `gh repo create … --source=. --push`, then check with `git status` and `git remote -v`.
6. **Code and test:** `git log --oneline` shows `origin/main` next to `HEAD -> main`.
walkthrough:
**Line by line**

- `gh repo create shop --public` creates `github.com/ada/shop`.
- `--source=.` adds it as the remote `origin` of the repository in the current folder.
- `--push` runs `git push --set-upstream origin HEAD`, pushing `main` and setting its upstream.

**Trace:** `git status` → `Your branch is up to date with 'origin/main'.`

**Common wrong approach:** `git push origin main` without `-u`: the commits arrive, but `main` has no upstream, so `git status` can't tell you whether you're ahead or behind.
:::

:::exercise Catch up, then contribute
Your teammate Grace pushed a commit to `ada/shop` since you last synced. Bring her commit into your `main`, then add the line `tube 600` at the end of `prices.txt`, commit it as `Add inner tubes`, and push. GitHub's `main` should end up as a straight line of commits: no merge commits.
```sh starter setup=shop-teammate-pushed
git status
```
```js check
const r = await repo("~/shop");
const gh = await github("ada/shop");
const log = await gh.log("main");
if (log.some((c) => c.parents.length > 1)) throw new AssertionError("GitHub's main has a merge commit: pull before you commit, so your commit goes on top of Grace's.");
same(log.map((c) => c.subject), ["Add inner tubes", "Raise the bell price", "Add opening hours", "Add price list", "Add README"], "The commits on GitHub's main, newest first");
same((await gh.files("main"))["prices.txt"], "bell 850\npump 3000\nlock 2900\ntube 600\n", "prices.txt on GitHub");
same(await r.tracking("main"), { upstream: "origin/main", ahead: 0, behind: 0, gone: false }, "How your main compares with origin/main");
```
```sh solution setup=shop-teammate-pushed
git pull
echo "tube 600" >> prices.txt
git commit -am "Add inner tubes"
git push
git log --oneline --graph
```
hint: Start with `git pull`: Grace's commit is new on GitHub, and your `main` has nothing new, so it's a fast-forward.
hint: Then the usual edit and `git commit -am "Add inner tubes"`.
hint: `git push` sends your commit; `git status` then says you're up to date with `origin/main`.
approach:
1. **Understand:** get up to date first, then add your commit on top, then share it.
2. **Examples:** committing first makes your `main` and GitHub's diverge, and the push is rejected.
3. **Brute force:** pushing with `--force`: it would delete Grace's commit from GitHub.
4. **Pattern:** **pull → commit → push**.
5. **Plan:** pull → edit → commit → push → check the graph.
6. **Code and test:** `git log --oneline --graph` is a straight line with `HEAD -> main, origin/main` at the top.
walkthrough:
**Line by line**

- `git pull` fetches Grace's commit and fast-forwards your `main` to it; `prices.txt` now says `bell 850`.
- Your commit's parent is Grace's commit, so it extends the line.
- `git push` is a fast-forward for GitHub's `main`, so it's accepted.

**Trace:** `git push` prints `… main -> main`, and `prices.txt` ends with `tube 600`.

**Common wrong approach:** committing before pulling: the push is rejected (`fetch first`). Lesson 4 shows how to fix that state with `git pull --rebase`.
:::

:::quiz
? What is origin/main?
+ Your repository's record of where main was on the remote origin when you last fetched or pushed
- The main branch on GitHub itself, updated live
- A backup copy of your own main
- The first commit of the repository
= It only moves when you talk to the remote (fetch, pull or push).
? What's the difference between git fetch and git pull?
+ fetch only downloads and updates origin/main; pull also integrates it into your branch
- They're the same command
- fetch uploads your commits; pull downloads others'
- pull only works on new branches
= Fetching is always safe; pulling changes your branch and files.
? What does -u do in git push -u origin add-helmets?
+ Sets origin/add-helmets as the branch's upstream, so later plain git push and git pull work
- Uploads untracked files
- Forces the push
- Updates every branch
= It's short for --set-upstream.
? Your push is rejected with "fetch first". Why?
+ The remote branch has commits you don't have yet
- Your password is wrong
- The repository is private
- You need to commit first
= Git won't overwrite other people's commits; integrate them first, then push.
:::

@@@ lesson
id: syncing
title: Keeping in sync: rebase, pull and force-with-lease
minutes: 28
summary: Diverged branches, git pull's choice between merging and rebasing, git pull --no-rebase and --rebase, pull.rebase configuration, rebasing a feature branch onto main, resolving conflicts during a rebase with --continue, --skip and --abort, pushing rewritten branches safely with --force-with-lease, copying single commits with git cherry-pick, interactive rebase, and when not to rewrite history.
---
When you and a teammate both commit to the same branch, the two copies **diverge**: each has a commit the other lacks. Git can't push until they're joined again, and there are two ways to join them.

![Before: from commit B, GitHub's main gained Grace's commit G and your main gained your commit Y. git pull --no-rebase joins them with a merge commit M whose parents are G and Y. git pull --rebase instead replays your commit on top of G as a new commit Y-prime, giving a straight line; Y-prime has a new id and the old Y is left behind](figures/merge-vs-rebase.svg)

### Pull when you've diverged

```sh setup=shop-diverged error
git pull
```

Current versions of Git refuse to guess when branches have diverged: `git pull` stops and asks you to choose. You can choose each time with an option, or once with a setting.

**Merging** (`--no-rebase`) keeps both commits as they were and joins them with a merge commit:

```sh setup=shop-diverged
git pull --no-rebase
git log --oneline --graph
```

**Rebasing** (`--rebase`) sets your commit aside, updates your branch to GitHub's, then **replays** your commit on top, as a new commit:

```sh setup=shop-diverged
git pull --rebase
git log --oneline --graph
git push
```

The history stays a straight line, and the push succeeds. Your commit got a new id: rebasing rewrites the commits it moves. That's fine here, because nobody else had that commit yet.

Most teams prefer rebasing for this everyday case, because a merge commit that only says "I pulled" adds noise without information. Set it once:

```bash
git config --global pull.rebase true
```

### Rebasing a feature branch

The same idea updates a feature branch with the latest `main`: `git rebase origin/main` replays the branch's commits on top of `origin/main`, as if you'd started the branch today. Here Grace added helmets to `main` while you added tubes on your branch, at the same place in the file:

```sh setup=shop-feature-behind error
git fetch
git log --oneline --graph --all
git rebase origin/main
```

A rebase can stop on a conflict, just like a merge, once for each commit that clashes. Resolve it the same way, then continue instead of committing:

```sh setup=shop-feature-behind
git fetch -q
git rebase origin/main
git status
cat prices.txt
printf "bell 800\npump 3000\nlock 2900\nhelmet 4500\ntube 600\n" > prices.txt
git add prices.txt
git rebase --continue
git log --oneline --graph --all
```

Note the labels: during a rebase, `HEAD` is the branch you're rebasing **onto** (here Grace's helmets), and the other side is **your** commit being replayed. `git rebase --abort` gives up and restores the branch; `git rebase --skip` drops the commit being replayed.

### Pushing a rewritten branch

You had already pushed `add-tubes`. After the rebase, your branch and GitHub's have different commits, so a normal push is rejected. You must **force** it, replacing GitHub's version with yours, and you should do that safely:

```sh setup=shop-feature-behind
git fetch -q
git rebase origin/main
printf "bell 800\npump 3000\nlock 2900\nhelmet 4500\ntube 600\n" > prices.txt
git add prices.txt
git rebase --continue
git push
git push --force-with-lease
```

`--force-with-lease` replaces the remote branch only if it's still where your `origin/add-tubes` says it is. If a colleague pushed to the branch since you last fetched, it refuses instead of silently deleting their work, which plain `--force` would do. Make it your only way of forcing.

### The rule for rewriting

Rebase, amend and reset create **new** commits and abandon the old ones. That's harmless for commits only you have, and for your own feature branch before or during review. It's harmful for commits other people have built on, above all a shared `main`: their copies still contain the old commits, and the histories no longer agree.

| Situation | Safe? |
|---|---|
| `git pull --rebase` on your unpushed commits | yes |
| rebasing your own feature branch, then `--force-with-lease` | yes, if nobody else commits to it (tell them if they do) |
| rebasing or force-pushing a shared `main` | no: use `git revert` and merges there |

### Copying one commit: cherry-pick

`git cherry-pick <commit>` applies the change from one commit onto your current branch, as a new commit. It's handy for taking an urgent fix from a feature branch, or for back-porting a fix to a release branch:

```sh setup=shop-branches
git cherry-pick add-tubes
git log --oneline --graph --all
```

The copy has a new id; the original stays on its branch. Use it for single commits, not as a replacement for merging whole branches.

### Try it on your own computer

- **Interactive rebase** rewrites your own recent commits before sharing them: `git rebase -i HEAD~3` opens a list where you can **reword** messages, **squash** or **fixup** commits together, **drop** or reorder them. The sandbox has no editor for this list, so practise it on your computer.
- `git config --global rebase.autoStash true` stashes uncommitted changes before a rebase and restores them after.
- Add `--force-if-includes` to `--force-with-lease` (Git 2.30 or later) for extra protection when tools fetch in the background.

:::exercise Push after a rejection
Grace pushed a commit to `ada/shop`, and you've made a commit of your own that isn't pushed yet, so your `main` and GitHub's have diverged. Get your commit onto GitHub **on top of** Grace's, with no merge commit.
```sh starter setup=shop-diverged
git push
```
```js check
const r = await repo("~/shop");
const gh = await github("ada/shop");
const log = await gh.log("main");
if (log.some((c) => c.parents.length > 1)) throw new AssertionError("GitHub's main has a merge commit: use git pull --rebase, so your commit is replayed on top of Grace's instead of merged.");
same(log.map((c) => c.subject), ["Lower the lock price", "Raise the bell price", "Add opening hours", "Add price list", "Add README"], "The commits on GitHub's main, newest first");
same((await gh.files("main"))["prices.txt"], "bell 850\npump 3000\nlock 2700\n", "prices.txt on GitHub (both changes)");
same(await r.tracking("main"), { upstream: "origin/main", ahead: 0, behind: 0, gone: false }, "How your main compares with origin/main");
if (ran(/push\b.*(--force\b|-f\b)/)) throw new AssertionError("No force-pushing main: integrate Grace's commit instead.");
```
```sh solution setup=shop-diverged
git push
git pull --rebase
git log --oneline --graph
git push
```
hint: The push is rejected with `fetch first`: GitHub has Grace's commit, which you don't have.
hint: A plain `git pull` asks you to choose between merging and rebasing. You want your commit replayed on top of Grace's.
hint: `git pull --rebase`, then `git push`.
approach:
1. **Understand:** two commits started from the same point; one must go after the other.
2. **Examples:** `git pull --no-rebase` works too, but adds a merge commit.
3. **Brute force:** `git push --force`: it would delete Grace's commit from GitHub.
4. **Pattern:** **fetch their work, replay yours on top, push**.
5. **Plan:** pull --rebase → check the graph → push.
6. **Code and test:** `git log --oneline --graph` is a straight line; `git status` says up to date.
walkthrough:
**Line by line**

- `git pull --rebase` fetches Grace's commit, moves your `main` to it, and replays `Lower the lock price` on top.
- Both edits are to different lines, so there's no conflict: `prices.txt` has `bell 850` and `lock 2700`.
- The push is now a fast-forward for GitHub.

**Trace:** `git log --oneline` → `Lower the lock price` above `Raise the bell price`.

**Common wrong approach:** `git push --force`, which would make GitHub's `main` match yours and drop Grace's commit.
:::

:::exercise Update a feature branch
You pushed the branch `add-tubes` to `ada/shop`, and meanwhile Grace added helmets to `main` on GitHub, at the same place in `prices.txt`. Update `add-tubes` by **rebasing** it onto the latest `main` from GitHub. Keep both new lines, helmet first:

```text
bell 800
pump 3000
lock 2900
helmet 4500
tube 600
```

Then update the branch on GitHub, safely.
```sh starter setup=shop-feature-behind
git log --oneline --graph --all
```
```js check
const r = await repo("~/shop");
if (r.inProgress() === "rebase") throw new AssertionError("The rebase isn't finished: git add the resolved file, then git rebase --continue.");
const gh = await github("ada/shop");
const log = await gh.log("add-tubes");
same(log.map((c) => c.subject), ["Add inner tubes", "Add helmets", "Add price list", "Add README"], "The commits on GitHub's add-tubes, newest first");
if (log.some((c) => c.parents.length > 1)) throw new AssertionError("add-tubes has a merge commit: rebase instead of merging.");
same((await gh.files("add-tubes"))["prices.txt"], "bell 800\npump 3000\nlock 2900\nhelmet 4500\ntube 600\n", "prices.txt on GitHub's add-tubes");
if (!ran(/--force-with-lease/)) throw new AssertionError("Push the rewritten branch with git push --force-with-lease.");
if (ran(/push\b.*(--force(?!-with-lease)\b|\s-f\b)/)) throw new AssertionError("Use --force-with-lease, not --force: it won't overwrite work you haven't seen.");
same(await r.tracking("add-tubes"), { upstream: "origin/add-tubes", ahead: 0, behind: 0, gone: false }, "How add-tubes compares with origin/add-tubes");
```
```sh solution setup=shop-feature-behind
git fetch
git rebase origin/main
printf "bell 800\npump 3000\nlock 2900\nhelmet 4500\ntube 600\n" > prices.txt
git add prices.txt
git rebase --continue
git push --force-with-lease
git log --oneline --graph --all
```
hint: `git fetch` first, so `origin/main` includes Grace's helmets. Then, on `add-tubes`, `git rebase origin/main`.
hint: The rebase stops with a conflict at the end of `prices.txt`. Write the file with both lines (helmet first), `git add prices.txt`, then `git rebase --continue`.
hint: A plain `git push` is rejected now, because the branch was rewritten. Use `git push --force-with-lease`.
approach:
1. **Understand:** your one commit must end up on top of Grace's, and GitHub's copy of the branch must be replaced.
2. **Examples:** `git merge origin/main` would also update the branch, but with a merge commit, which the task rules out.
3. **Brute force:** deleting the branch and starting again: possible, but loses the branch's history and review comments.
4. **Pattern:** **fetch → rebase → resolve → continue → force-with-lease**.
5. **Plan:** fetch → rebase → write the resolved file → add → continue → push.
6. **Code and test:** `git log --oneline --graph --all` shows `add-tubes` directly on top of `origin/main`.
walkthrough:
**Line by line**

- `git fetch` moves `origin/main` to Grace's `Add helmets`.
- `git rebase origin/main` replays `Add inner tubes` on top of it and stops: both commits added a line at the end of the file.
- In the conflict, `HEAD` is Grace's side (`helmet 4500`) and the other side is your commit (`tube 600`); the resolution keeps both.
- `git rebase --continue` makes the new commit and finishes; `--force-with-lease` replaces GitHub's `add-tubes`, because nobody else had changed it.

**Trace:** the push prints `+ …...… add-tubes -> add-tubes (forced update)`.

**Common wrong approach:** `git commit` instead of `git rebase --continue` after resolving: the rebase is still in progress and the remaining steps never run.
:::

:::quiz
? Your main and origin/main have diverged, and you want a straight-line history. Which command?
+ git pull --rebase
- git pull --no-rebase
- git push --force
- git fetch
= Rebasing replays your commits on top of the remote's; merging adds a merge commit.
? Why does rebasing change your commits' ids?
+ It creates new commits with a different parent; ids depend on a commit's contents, including its parent
- Git renames commits after every pull
- The ids are random each time
- It doesn't; ids stay the same
= A commit's id is the hash of its contents, and the parent id is part of them.
? Why prefer git push --force-with-lease over --force?
+ It refuses if the remote branch changed since you last fetched, so you can't silently delete someone else's push
- It's faster
- It doesn't need a network
- It also merges the branches
= It's a force push with a safety check.
? Which of these should you avoid?
+ Rebasing and force-pushing a shared main branch
- Rebasing your unpushed commits with git pull --rebase
- Rebasing your own feature branch before review
- Cherry-picking a fix onto a release branch
= Rewriting history others have built on makes their copies disagree with the remote.
:::

@@@ lesson
id: pull-requests
title: Pull requests and code review
minutes: 28
summary: What a pull request is and why teams use them, the pull request workflow, opening one with gh pr create (title, description, reviewers, drafts), linking issues, reviewing with comments, approvals and requested changes, reviewing as a teammate with gh auth switch, the three merge methods (merge commit, squash, rebase) and their trade-offs, deleting merged branches and updating main, good review habits, and AI-assisted review.
---
A **pull request** (PR; GitLab calls it a merge request) is a proposal on GitHub: "please merge my branch into `main`". It shows the changes, runs automated checks (Part 3), and gives the team a place to discuss and approve before anything reaches `main`. Pull requests are how almost every team, and every open-source project, accepts changes.

![Six steps: 1, branch with git switch -c add-tubes; 2, push with git push -u origin add-tubes; 3, open a PR with gh pr create; 4, review with gh pr review, plus CI checks; 5, merge with gh pr merge --squash -d; 6, update with git switch main and git pull. Changes reach main only through a reviewed pull request](figures/pr-flow.svg)

### Opening a pull request

```sh setup=shop-on-github
git switch -c add-tubes
echo "tube 600" >> prices.txt
git commit -qam "Add inner tubes"
git push -u origin add-tubes
gh pr create --title "Add inner tubes to the price list" --body "Customers keep asking for spare tubes." --reviewer grace
gh pr list
gh pr view
```

On the website, the yellow **Compare & pull request** banner (or the link in the `remote:` lines) does the same. A pull request belongs to the **branch**, not to particular commits: pushing more commits to `add-tubes` updates it.

A good pull request is **small** (it can be reviewed in one sitting; a few hundred changed lines at most) and has a description that answers:

- **What** changes, and **why** (the reason isn't in the code).
- **How to check it**: steps to test, screenshots for anything visual.
- **Links**: writing `Closes #12` (or `Fixes #12`) in the description links issue 12 and closes it when the PR merges.

`gh pr create --draft` opens a **draft** pull request: visible for early feedback, but it can't be merged until you mark it ready (`gh pr ready`).

### Reviewing

Reviewers read the **Files changed** tab, comment on specific lines, and finish with one of three verdicts: **Comment**, **Approve** or **Request changes**. GitHub doesn't let you approve your own pull request:

```sh setup=shop-pr-open error
gh pr review 1 --approve
```

In the sandbox you're also signed in as your teammate `grace`, so you can play both roles. (`gh auth switch` is the real command for moving between GitHub accounts.)

```sh setup=shop-pr-open
gh auth switch --user grace
gh pr diff 1
gh pr review 1 --approve --body "Looks good, thanks!"
gh auth switch --user ada
gh pr view 1
```

Good reviews are kind and specific: ask questions ("What happens if the price list is empty?"), suggest rather than order, separate must-fix from nice-to-have ("nit:"), and approve when it's good enough, not perfect. As the author, reply to every comment, and push fixes as new commits so reviewers can see what changed.

Many teams also request a review from an AI reviewer such as **Copilot code review** on GitHub. It's useful for catching slips quickly; treat its comments like any colleague's suggestions: check them, and keep a human approval for anything that matters.

### Merging

When the pull request is approved (and its checks pass), it's merged, usually with a button on the website or `gh pr merge`. GitHub offers three methods:

| Method | What lands on `main` | Good for |
|---|---|---|
| **Create a merge commit** (`--merge`) | all the branch's commits, plus a merge commit | keeping every commit of larger branches |
| **Squash and merge** (`--squash`) | one new commit with all the changes, titled after the PR | small PRs; a tidy `main` with one commit per change |
| **Rebase and merge** (`--rebase`) | each of the branch's commits, replayed on top, no merge commit | a linear history that keeps individual commits |

```sh setup=shop-pr-open
gh auth switch --user grace
gh pr review 1 --approve --body "Looks good, thanks!"
gh auth switch --user ada
gh pr merge 1 --squash --delete-branch
git log --oneline --graph --all
git status
```

`--delete-branch` (`-d`) deletes the branch on GitHub and locally, switches you to `main` and pulls the merged commit. Without it, finish yourself: `git switch main`, `git pull`, then delete the branch.

One surprise with squash merges: the squashed commit is new, so Git doesn't see your local branch's commits in `main`, and `git branch -d add-tubes` says "not fully merged". Once GitHub shows the PR as merged, `git branch -D add-tubes` is safe. `git fetch --prune` (or `git config --global fetch.prune true`) removes remote-tracking branches whose GitHub branch was deleted.

### Try it on your own computer

- `gh pr status` shows the PRs that involve you; `gh pr checkout 12` fetches someone's PR branch so you can run it locally; `gh pr view --web` opens the PR in your browser.
- In the repository's **Settings → General → Pull Requests**, choose which merge methods are allowed, and tick **Automatically delete head branches**.
- To practise reviewing, ask a friend to open a pull request on your repository, or review open pull requests on an open-source project you use.

:::exercise Open a pull request
In `~/shop` (published as `ada/shop`), create a branch `add-helmets`, add the line `helmet 4500` at the end of `prices.txt`, and commit it as `Add helmets`. Push the branch, then open a pull request into `main` titled `Add helmets to the price list`, with a description of your choice, and request a review from `grace`.
```sh starter setup=shop-on-github
git status
```
```js check
const gh = await github("ada/shop");
const prs = gh.pulls();
if (!prs.length) throw new AssertionError("There's no pull request yet (gh pr create).");
const pr = prs[0];
same([pr.head, pr.base, pr.state], ["add-helmets", "main", "OPEN"], "The pull request's branch, base and state");
same(pr.title, "Add helmets to the price list", "The pull request's title");
if (!pr.body.trim()) throw new AssertionError("Write a description with --body: what changes, and why.");
if (!(pr.requested ?? []).includes("grace")) throw new AssertionError("Request a review from grace (--reviewer grace).");
same((await gh.log("add-helmets"))[0].subject, "Add helmets", "The newest commit on GitHub's add-helmets");
same((await gh.files("add-helmets"))["prices.txt"], "bell 800\npump 3000\nlock 2900\nhelmet 4500\n", "prices.txt on GitHub's add-helmets");
same((await gh.log("main")).length, 3, "The number of commits on GitHub's main (the change arrives through the pull request, later)");
```
```sh solution setup=shop-on-github
git switch -c add-helmets
echo "helmet 4500" >> prices.txt
git commit -am "Add helmets"
git push -u origin add-helmets
gh pr create --title "Add helmets to the price list" --body "Helmets are our most requested item." --reviewer grace
gh pr view
```
hint: Branch, edit and commit as in Lesson 1, then `git push -u origin add-helmets`: a pull request needs the branch on GitHub.
hint: `gh pr create --title "…" --body "…"`: in the sandbox both are required, because there's no editor to ask you.
hint: Add `--reviewer grace` to `gh pr create`. `gh pr view` shows `Reviewers: grace (Requested)`.
approach:
1. **Understand:** a pull request needs a pushed branch with commits that `main` doesn't have.
2. **Examples:** running `gh pr create` before pushing fails with "you must first push the current branch".
3. **Brute force:** pushing straight to `main`: no review, and many repositories forbid it (Lesson 6).
4. **Pattern:** **branch → commit → push -u → gh pr create**.
5. **Plan:** switch -c → edit → commit → push -u → gh pr create with title, body and reviewer.
6. **Code and test:** `gh pr list` shows the pull request; `gh pr view` shows the reviewer.
walkthrough:
**Line by line**

- The branch and commit are ordinary Git.
- `git push -u origin add-helmets` creates the branch on GitHub; the `remote:` lines offer a link to open a PR.
- `gh pr create` opens pull request #1 from `add-helmets` into the default branch, `main`.

**Trace:** `gh pr create` prints `https://github.com/ada/shop/pull/1`.

**Common wrong approach:** committing on `main` and opening the PR from there: a pull request needs a separate branch to compare with `main`.
:::

:::exercise Review and merge
Pull request #1 on `ada/shop` (from `add-tubes`, by you) is waiting for Grace's review. Approve it **as `grace`**, then, as `ada` again, merge it with **squash and merge**, deleting the branch. End on an up-to-date `main` that contains the change.
```sh starter setup=shop-pr-open
gh pr view 1
```
```js check
const r = await repo("~/shop");
const gh = await github("ada/shop");
const pr = gh.pulls().find((p) => p.number === 1);
if (!pr.reviews.some((x) => x.author === "grace" && x.state === "APPROVED")) throw new AssertionError("The pull request needs an approval from grace: gh auth switch --user grace, then gh pr review 1 --approve.");
if (pr.state !== "MERGED") throw new AssertionError("The pull request isn't merged yet (gh pr merge).");
same(pr.mergeMethod, "squash", "The merge method");
same(pr.mergedBy, "ada", "Who merged it (switch back to ada first)");
const log = await gh.log("main");
same(log[0].subject, "Add inner tubes to the price list (#1)", "The newest commit on GitHub's main");
same(await gh.branches(), ["main"], "The branches on GitHub (add-tubes should be deleted)");
same(await r.branch(), "main", "The branch you're on at the end");
if ((await r.branches()).includes("add-tubes")) throw new AssertionError("Delete your local add-tubes branch too (gh pr merge --delete-branch does both).");
same(r.read("prices.txt"), "bell 800\npump 3000\nlock 2900\ntube 600\n", "prices.txt in your folder");
same(await r.tracking("main"), { upstream: "origin/main", ahead: 0, behind: 0, gone: false }, "How your main compares with origin/main");
```
```sh solution setup=shop-pr-open
gh auth switch --user grace
gh pr review 1 --approve --body "Looks good, thanks!"
gh auth switch --user ada
gh pr merge 1 --squash --delete-branch
git log --oneline
```
hint: `gh auth switch --user grace` makes you Grace; `gh pr review 1 --approve` approves.
hint: Switch back with `gh auth switch --user ada` before merging, so the merge is yours.
hint: `gh pr merge 1 --squash --delete-branch` merges, deletes the branch on GitHub and locally, and updates your `main`.
approach:
1. **Understand:** an approval from someone other than the author, then a squash merge that tidies up afterwards.
2. **Examples:** approving as `ada` fails: you can't approve your own pull request.
3. **Brute force:** `git merge add-tubes` and `git push` on `main`: the pull request stays open and the review is skipped.
4. **Pattern:** **review as the reviewer, merge as the author**.
5. **Plan:** switch to grace → approve → switch to ada → merge with squash and delete.
6. **Code and test:** `git log --oneline` on `main` shows `Add inner tubes to the price list (#1)`.
walkthrough:
**Line by line**

- As `grace`, `gh pr review 1 --approve` records the approval.
- As `ada`, `gh pr merge 1 --squash` makes one commit on GitHub's `main`, titled after the pull request with its number.
- `--delete-branch` deletes `add-tubes` on GitHub and locally, switches to `main` and pulls the new commit.

**Trace:** `gh pr merge` prints `✓ Squashed and merged pull request ada/shop#1 (Add inner tubes to the price list)`.

**Common wrong approach:** merging while still signed in as `grace`: it works, but the exercise asks the author to merge.
:::

:::quiz
? Which belongs in a pull request description?
+ What changes and why, how to check it, and links such as Closes #12
- A copy of every changed line
- The reviewer's password
- Nothing; the code explains itself
= The diff shows what changed; the description explains why and how to verify it.
? You push two more commits to a branch that has an open pull request. What happens?
+ The pull request updates to include them
- A second pull request is opened
- The push is rejected until the PR is merged
- The PR is closed
= A pull request tracks its branch.
? What does "Squash and merge" put on main?
+ One new commit containing all the branch's changes
- Every commit of the branch plus a merge commit
- Only the branch's first commit
- Nothing until you pull
= That's why git branch -d later calls the local branch "not fully merged".
? Who can approve a pull request on GitHub?
+ Someone other than its author
- Only its author
- Anyone, including the author
- Only GitHub's bots
= Reviews are about a second pair of eyes.
:::

@@@ lesson
id: team-workflows
title: Protecting main, workflows and releases
minutes: 26
summary: Protecting the default branch with GitHub rulesets (require a pull request and approvals, block force pushes, restrict deletions, require status checks) through the settings page or gh api, branching workflows (GitHub flow, trunk-based development with feature flags, Git flow), forks and the upstream remote for open source, semantic versioning, annotated tags and pushing them, GitHub releases with gh release create, and Conventional Commits.
---
A team agrees that `main` must always work, but agreements get forgotten under pressure. GitHub can **enforce** them, and a few shared habits (how branches flow, how versions are named) make everyone's work predictable.

### Protecting main with rulesets

A **ruleset** is a set of rules GitHub enforces on matching branches or tags. For the default branch, the usual ones are:

| Rule | Effect |
|---|---|
| **Require a pull request before merging** | no direct pushes; changes arrive through PRs, optionally with a number of approvals |
| **Block force pushes** | nobody can rewrite the branch's history |
| **Restrict deletions** | the branch can't be deleted |
| **Require status checks to pass before merging** | CI must be green before merging (Part 3) |
| **Require linear history** | no merge commits (squash or rebase merges only) |

On the website: the repository's **Settings → Rules → Rulesets → New ruleset → New branch ruleset**, target **Include default branch**, tick the rules, set enforcement to **Active**. Rulesets are free for public repositories; private ones need a paid plan (Pro, Team or Enterprise). Older repositories may use **branch protection rules** (Settings → Branches) instead; they do the same job, and both can apply at once.

Rulesets can also be created through GitHub's REST API, which is handy for setting up many repositories the same way. `gh api` sends the request:

```sh setup=shop-on-github error
cat > ruleset.json <<'EOF'
{
  "name": "Protect main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false } },
    { "type": "non_fast_forward" },
    { "type": "deletion" }
  ]
}
EOF
gh api repos/ada/shop/rulesets --method POST --input ruleset.json --jq .name
echo "tube 600" >> prices.txt
git commit -qam "Add inner tubes"
git push
```

`~DEFAULT_BRANCH` means "whichever branch is the default"; `non_fast_forward` is **Block force pushes**, and `deletion` is **Restrict deletions**. The API insists on all five `pull_request` parameters, even the ones you leave off. The direct push is now refused, and pull requests need one approval to merge. To rescue a commit made on `main` by mistake, move it to a branch and put `main` back:

```bash
git switch -c add-tubes           # the commit comes along on the new branch
git branch -f main origin/main    # move main back to GitHub's version
git push -u origin add-tubes      # then open a pull request
```

Repository owners and admins can be allowed to bypass rules (`gh pr merge --admin`); use it for emergencies only.

### Team workflows

| Workflow | How it works | Fits |
|---|---|---|
| **GitHub flow** | `main` is always deployable; each change is a short-lived branch, a pull request, a review, then a merge | most teams and web services |
| **Trunk-based development** | everyone merges small changes into `main` at least daily; unfinished features hide behind **feature flags** (settings that switch code on) | teams with strong automated tests and continuous deployment |
| **Git flow** | long-lived `develop` and `main`, plus `feature/`, `release/` and `hotfix/` branches | software shipped in numbered versions with several supported releases |

Git flow was popular in the 2010s; its author now recommends something simpler, like GitHub flow, for software that's delivered continuously. Whatever you choose, the common thread is the same: **short-lived branches, small pull requests, and a `main` that always works**.

**Forks** are for projects you can't push to, such as open source. You **fork** (copy) the repository to your account, push branches to your fork, and open pull requests from there into the original. Locally, `origin` is your fork and a second remote, conventionally `upstream`, is the original: `git fetch upstream` brings in other people's work. `gh repo fork owner/project --clone` sets all of that up on your own computer.

### Versions, tags and releases

When you ship software others depend on, give each version a name. **Semantic Versioning** (SemVer) uses `MAJOR.MINOR.PATCH`:

| Part | Increase when | Example |
|---|---|---|
| MAJOR | you make incompatible changes | 1.4.2 → 2.0.0 |
| MINOR | you add features, compatibly | 1.4.2 → 1.5.0 |
| PATCH | you fix bugs, compatibly | 1.4.2 → 1.4.3 |

A version is marked with an **annotated tag** (Part 1 showed the object behind it): it records who tagged, when, and a message. Tags aren't pushed with branches; push them by name, or all at once with `--tags`.

```sh setup=shop-on-github
git tag -a v1.0.0 -m "First release"
git tag -n
git push origin v1.0.0
gh release create v1.0.0 --title "Version 1.0.0" --generate-notes
gh release list
```

A **GitHub release** turns a tag into a page with notes and downloadable files. `--generate-notes` lists the pull requests merged since the previous release. Tags should never move once published: if `v1.0.0` was wrong, release `v1.0.1`.

**Conventional Commits** is a widely used message format that makes history machine-readable: `feat: add inner tubes`, `fix: correct the pump price`, `docs: explain opening hours`, with `feat!:` or a `BREAKING CHANGE:` footer for incompatible changes. Tools such as release-please and semantic-release read these messages to choose the next version number and write the changelog automatically. Adopt it if your team or project uses it; consistency matters more than the format.

### Try it on your own computer

- On a repository of your own: add a ruleset requiring a pull request, try `git push` to `main`, and watch it refused.
- `gh ruleset list` and `gh ruleset view` show a repository's rulesets; `gh release create v0.1.0 ./dist/*.zip --generate-notes` attaches files to a release.
- Read [GitHub's rulesets documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets) and [semver.org](https://semver.org).

:::exercise Protect main
Protect `main` on `ada/shop` with an **active** ruleset named `Protect main` that applies to the default branch, requires a pull request with **1** approval, and blocks force pushes. Create it with `gh api` and a JSON file (write the file with a here-document).
```sh starter setup=shop-on-github
gh api repos/ada/shop/rulesets
```
```js check
const gh = await github("ada/shop");
const rs = gh.rulesets().find((x) => x.name === "Protect main");
if (!rs) throw new AssertionError("There's no ruleset named \"Protect main\" yet.");
same([rs.target, rs.enforcement], ["branch", "active"], "The ruleset's target and enforcement");
const inc = rs.conditions?.ref_name?.include ?? [];
if (!inc.includes("~DEFAULT_BRANCH") && !inc.includes("refs/heads/main")) throw new AssertionError("The ruleset should include the default branch: \"include\": [\"~DEFAULT_BRANCH\"].");
const pr = (rs.rules ?? []).find((x) => x.type === "pull_request");
if (!pr) throw new AssertionError("Add a rule of type pull_request.");
same(pr.parameters?.required_approving_review_count, 1, "required_approving_review_count");
if (!(rs.rules ?? []).some((x) => x.type === "non_fast_forward")) throw new AssertionError("Block force pushes with a rule of type non_fast_forward.");
```
```sh solution setup=shop-on-github
cat > ruleset.json <<'EOF'
{
  "name": "Protect main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false } },
    { "type": "non_fast_forward" }
  ]
}
EOF
gh api repos/ada/shop/rulesets --method POST --input ruleset.json --jq .name
gh api repos/ada/shop/rulesets
```
hint: Start from the ruleset in the lesson: the fields are `name`, `target`, `enforcement`, `conditions` and `rules`.
hint: Write it with `cat > ruleset.json <<'EOF'` … `EOF`, then `gh api repos/ada/shop/rulesets --method POST --input ruleset.json`.
hint: The rules you need are `pull_request` and `non_fast_forward`. The API requires all five `pull_request` parameters (copy them from the lesson), with `required_approving_review_count` set to 1.
approach:
1. **Understand:** a ruleset is a JSON document: what it applies to (conditions) and what it enforces (rules).
2. **Examples:** `"enforcement": "evaluate"` or `"disabled"` would record the rules without enforcing them.
3. **Brute force:** asking everyone to remember: works until a busy day.
4. **Pattern:** **describe the policy as data, send it to the API**.
5. **Plan:** write the file → POST it → list rulesets to confirm.
6. **Code and test:** `gh api repos/ada/shop/rulesets` lists `Protect main` as `active`.
walkthrough:
**Line by line**

- `"target": "branch"` and `"include": ["~DEFAULT_BRANCH"]` aim the ruleset at `main`.
- `pull_request` with `required_approving_review_count: 1` means every change needs a PR and one approval.
- `non_fast_forward` blocks force pushes.
- `gh api … --method POST --input ruleset.json` creates it; `--jq .name` prints just the name from the reply.

**Trace:** the POST prints `Protect main`; the GET lists it with `"enforcement": "active"`.

**Common wrong approach:** naming the rule after its label on the website, such as `"type": "block_force_pushes"`: the API calls it `non_fast_forward`, and rejects the request with HTTP 422.
:::

:::exercise Ship a release
Release the current `main` of `ada/shop` as version **1.0.0**: create an **annotated** tag `v1.0.0` with the message `First release` on your latest commit, push the tag to GitHub, and create a GitHub release for it titled `Version 1.0.0` with generated notes.
```sh starter setup=shop-on-github
git log --oneline
```
```js check
const r = await repo("~/shop");
const gh = await github("ada/shop");
const t = await gh.tag("v1.0.0");
if (!t) throw new AssertionError("There's no tag v1.0.0 on GitHub yet (git push origin v1.0.0).");
if (!t.annotated) throw new AssertionError("The tag on GitHub isn't annotated. Create it with git tag -a v1.0.0 -m \"First release\" and push it before creating the release (gh release create makes a plain tag if none exists).");
same(t.message, "First release", "The tag's message");
same(t.commit, await r.resolve("main"), "The commit the tag points to (your latest commit on main)");
const rel = gh.releases().find((x) => x.tag === "v1.0.0");
if (!rel) throw new AssertionError("There's no GitHub release for v1.0.0 yet (gh release create).");
same(rel.title, "Version 1.0.0", "The release's title");
```
```sh solution setup=shop-on-github
git tag -a v1.0.0 -m "First release"
git push origin v1.0.0
gh release create v1.0.0 --title "Version 1.0.0" --generate-notes
gh release list
```
hint: `git tag -a v1.0.0 -m "First release"` tags the commit you're on.
hint: Tags don't travel with `git push`: push it by name, `git push origin v1.0.0`.
hint: `gh release create v1.0.0 --title "Version 1.0.0" --generate-notes` (the sandbox needs `--notes` or `--generate-notes`, as there's no editor).
approach:
1. **Understand:** three parts: a local annotated tag, the same tag on GitHub, a release page for it.
2. **Examples:** `git tag v1.0.0` (no `-a`) makes a lightweight tag with no message or author.
3. **Brute force:** creating the release first: GitHub makes a plain tag for you, without your message.
4. **Pattern:** **tag → push the tag → release**.
5. **Plan:** tag -a → push origin v1.0.0 → gh release create → gh release list.
6. **Code and test:** `gh release list` shows `Version 1.0.0` as `Latest`.
walkthrough:
**Line by line**

- `git tag -a` creates a tag object with your name, the date and the message, pointing at `HEAD`.
- `git push origin v1.0.0` sends it: ` * [new tag]  v1.0.0 -> v1.0.0`.
- `gh release create` finds the tag on GitHub and publishes a release page for it.

**Trace:** `gh release create` prints `https://github.com/ada/shop/releases/tag/v1.0.0`.

**Common wrong approach:** `git push --tags` before tagging: there's nothing to push yet, and the release creates a lightweight tag instead.
:::

:::quiz
? Which rule stops anyone from pushing straight to main?
+ Require a pull request before merging
- Block force pushes
- Restrict deletions
- Require linear history
= With it, changes reach main only through pull requests.
? In trunk-based development, how do teams ship unfinished features safely?
+ They merge small changes daily and hide unfinished work behind feature flags
- They keep feature branches open for months
- They push to main without tests
- They use a separate repository per feature
= Feature flags let incomplete code be merged but switched off.
? A release fixes a bug without changing behaviour otherwise. Version 2.3.1 becomes…
+ 2.3.2
- 2.4.0
- 3.0.0
- 2.3.1-fix
= Compatible bug fixes increase PATCH.
? You contribute to an open-source project you can't push to. Where do you push your branch?
+ To your fork, then open a pull request into the original repository
- Straight to the project's main
- Nowhere; you email the files
- To the project's upstream remote
= Forks are your own copy on GitHub; the PR proposes your branch to the original.
:::
