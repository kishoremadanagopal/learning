# Lesson 8: Merging and conflicts

**You'll learn:** git merge, fast-forward merges, the merge base, three-way merges, merge commits with two parents, the default merge message and --no-edit, --no-ff and --ff-only, reading merges in git log --graph, merge conflicts, conflict markers (<<<<<<< ======= >>>>>>>), resolving and marking resolved with git add, finishing with git commit, git merge --abort, conflictStyle zdiff3, editor merge tools, keeping conflicts rare.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#merging)**: run every example and check your exercise answers.

## Key terms

- **Merge:** combining the work of another branch into the current one.
- **Fast-forward:** a merge where the current branch has no new commits, so Git just moves it forward.
- **Merge base:** the last commit two branches have in common.
- **Merge commit:** a commit with two parents that joins two lines of history.
- **Merge conflict:** both branches changed the same lines differently; Git stops and asks you to decide.
- **Conflict markers:** the `<<<<<<<`, `=======` and `>>>>>>>` lines Git writes around each clash.

A branch is only useful if its work can come back. **Merging** combines the work of another branch into the one you're on: you stand on the branch that should receive the work (usually `main`) and run `git merge <other-branch>`.

![Top: a fast-forward. main points at B; add-tubes has one more commit C on top of B. git merge add-tubes simply moves main to C, with no new commit. Bottom: a three-way merge. From B, main went on to C and the branch to D. Git makes a merge commit M with two parents, C and D, combining the changes B to C and B to D; if both changed the same lines, that's a conflict](../figures/merge-types.svg)

## Fast-forward merges

If `main` hasn't moved since the branch started, there's nothing to combine: Git just moves `main` forward to the branch's commit. That's a **fast-forward**.

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt
git add . && git commit -qm "Start the shop"
git switch -qc add-tubes
echo "tube 600" >> prices.txt && git commit -qam "Add inner tubes"
git switch -q main
```

</details>

```bash
git merge add-tubes
git log --oneline --graph --all
```

No new commit is made, and the history stays a straight line.

## Three-way merges and merge commits

If both branches have new commits, Git finds the **merge base** (the last commit they share), works out what each side changed since then, and combines both sets of changes in a new **merge commit** with two parents.

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt
git add . && git commit -qm "Start the shop"
git switch -qc add-tubes
echo "tube 600" >> prices.txt && git commit -qam "Add inner tubes"
git switch -q main
echo "Open 9 to 5, Monday to Saturday." > hours.txt
git add hours.txt && git commit -qm "Add opening hours"
```

</details>

```bash
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

## Conflicts

Git combines changes line by line. If both sides changed **the same lines** differently, it can't know which version is right, so it stops with a **merge conflict** and asks you:

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt
git add . && git commit -qm "Start the shop"
git switch -qc cheaper-bell
sed -i "s/bell 800/bell 700/" prices.txt && git commit -qam "Lower the bell price"
git switch -q main
sed -i "s/bell 800/bell 850/" prices.txt && git commit -qam "Raise the bell price"
```

</details>

```bash
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

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt
git add . && git commit -qm "Start the shop"
git switch -qc cheaper-bell
sed -i "s/bell 800/bell 700/" prices.txt && git commit -qam "Lower the bell price"
git switch -q main
sed -i "s/bell 800/bell 850/" prices.txt && git commit -qam "Raise the bell price"
```

</details>

```bash
git merge cheaper-bell
printf "bell 750\npump 3000\nlock 2900\n" > prices.txt
git add prices.txt
git status
git commit --no-edit
git log --oneline --graph
```

`git add` marks the file as resolved; `git commit` without `-m` reuses the prepared message `Merge branch 'cheaper-bell'`. If a merge goes wrong, `git merge --abort` puts everything back as it was before the merge started.

## Keeping conflicts rare

Conflicts aren't errors; they're Git asking a question only a person can answer. They're rarer and smaller when you:

- keep branches **short-lived** (days, not weeks) and merge `main` into long-running ones regularly;
- make **small, focused commits** that don't reformat files they don't need to change;
- agree on formatting tools (Part 3 runs them automatically), so whitespace changes don't collide.

## Try it on your own computer

- VS Code highlights conflicts with **Accept Current Change**, **Accept Incoming Change** and **Accept Both Changes** buttons, and has a three-way **merge editor** (Resolve in Merge Editor). Current is your branch (`HEAD`); incoming is the branch you're merging.
- `git config --global merge.conflictStyle zdiff3` adds a third section to the markers showing the merge base's version, which makes it much easier to see what each side actually changed.
- `git diff` during a conflict shows only the conflicted parts; `git log --merge -p` shows the commits that caused it.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Merge a branch into the current one | git merge add-tubes | current branch (and a merge commit) | git reset --hard ORIG_HEAD (not pushed yet) |
| Always record a merge | git merge --no-ff add-tubes | current branch, new merge commit | git reset --hard ORIG_HEAD |
| Resolve a conflict | edit the file, git add file, git commit | the merge result | git merge --abort before committing |
| Give up on a merge | git merge --abort | files and branch back to before | — |

## Common mistakes

- Merging from the wrong branch: you merge **into** the branch you're on.
- Committing a file that still contains conflict markers.
- Resolving a conflict by blindly taking one side and losing the other side's change.
- Letting a branch live for weeks, so every merge brings big conflicts.
- Using `git merge --abort` after you've already committed the merge (it's too late; use `git reset --hard ORIG_HEAD` if nothing was pushed).

## Exercises

### 1. Merge a finished branch

In `~/shop`, the branch `add-tubes` is finished, and `main` has moved on since it started. Merge `add-tubes` into `main` so that `main` has both the opening hours and the inner tubes, with a merge commit, and then delete the branch.

<details>
<summary>The sandbox starts this exercise with these commands (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt
git add . && git commit -qm "Start the shop"
git switch -qc add-tubes
echo "tube 600" >> prices.txt && git commit -qam "Add inner tubes"
git switch -q main
echo "Open 9 to 5, Monday to Saturday." > hours.txt
git add hours.txt && git commit -qm "Add opening hours"
```

</details>

Starter:

```bash
git log --oneline --graph --all
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** `main` should end up with both lines of work, joined by a merge commit.
2. **Examples:** merging `main` into `add-tubes` instead would update the branch, not `main`.
3. **Brute force:** copying the tube line into `main` by hand: same files, but Git wouldn't know the branch was merged, and `-d` would refuse to delete it.
4. **Pattern:** **stand on the receiving branch, merge the other one in**.
5. **Plan:** check the graph → merge → delete the branch → check the graph.
6. **Code and test:** `git log --oneline --graph` shows the two lines joining at `Merge branch 'add-tubes'`.

</details>

<details>
<summary>💡 Hint 1</summary>

Merging brings the named branch into the branch you're on. You're already on `main`.

</details>

<details>
<summary>💡 Hint 2</summary>

`git merge add-tubes` makes a merge commit here, because both branches have new commits (a fast-forward isn't possible).

</details>

<details>
<summary>💡 Hint 3</summary>

`git branch -d add-tubes` works once its commit is part of `main`.

</details>

### 2. Resolve a conflict

In `~/shop`, `main` raised the bell's price to 850 while the branch `cheaper-bell` lowered it to 700. The owner has decided: the bell costs **700**. Merge `cheaper-bell` into `main`, resolve the conflict so `prices.txt` reads `bell 700`, `pump 3000`, `lock 2900`, and finish the merge with a merge commit.

<details>
<summary>The sandbox starts this exercise with these commands (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt
git add . && git commit -qm "Start the shop"
git switch -qc cheaper-bell
sed -i "s/bell 800/bell 700/" prices.txt && git commit -qam "Lower the bell price"
git switch -q main
sed -i "s/bell 800/bell 850/" prices.txt && git commit -qam "Raise the bell price"
```

</details>

Starter:

```bash
git log --oneline --graph --all
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** Git can't choose between two edits of the same line; you decide, then tell Git you're done.
2. **Examples:** keeping the file with markers and committing would break the price list.
3. **Brute force:** `git merge --abort` and copying the line by hand: no record that the branch was merged.
4. **Pattern:** **merge → edit to the right result → add → commit**.
5. **Plan:** merge → look at the markers → write the resolved file → add → commit.
6. **Code and test:** `git status` says the tree is clean; `git log --graph` shows the merge commit.

</details>

<details>
<summary>💡 Hint 1</summary>

`git merge cheaper-bell` stops with a conflict in `prices.txt`; `cat prices.txt` shows the markers around the two bell lines.

</details>

<details>
<summary>💡 Hint 2</summary>

Write the whole resolved file, for example `printf "bell 700\npump 3000\nlock 2900\n" > prices.txt`. The markers must be gone.

</details>

<details>
<summary>💡 Hint 3</summary>

`git add prices.txt` marks it resolved; `git commit --no-edit` (or `git commit -m "…"`) finishes the merge.

</details>

**In the sandbox:** exercises 15–16. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Merge a finished branch</summary>

```bash
git log --oneline --graph --all
git merge add-tubes
git branch -d add-tubes
git log --oneline --graph
```

**Line by line**

- The first graph shows `main` and `add-tubes` splitting after `Start the shop`.
- `git merge add-tubes` finds that split point, combines the tube line (from the branch) with the hours file (from `main`), and records a merge commit.
- `git branch -d add-tubes` removes only the name; its commit stays in `main`'s history.

**Trace:** `prices.txt` on `main` now ends with `tube 600`, and `hours.txt` is still there.

**Common wrong approach:** `git branch -d add-tubes` before merging: Git refuses with "not fully merged", which is exactly its job.

</details>

<details>
<summary>✅ 2. Resolve a conflict</summary>

```bash
git merge cheaper-bell
cat prices.txt
printf "bell 700\npump 3000\nlock 2900\n" > prices.txt
git add prices.txt
git commit --no-edit
git log --oneline --graph
```

**Line by line**

- The merge stops: `CONFLICT (content): Merge conflict in prices.txt`.
- Between `<<<<<<< HEAD` and `=======` is `main`'s line (`bell 850`); below it, up to `>>>>>>> cheaper-bell`, is the branch's (`bell 700`).
- Writing the file without markers, with `bell 700`, is the resolution.
- `git add` + `git commit` record a merge commit with both branches as parents.

**Trace:** `cat prices.txt` → `bell 700`, `pump 3000`, `lock 2900`.

**Common wrong approach:** running `git commit -am` while the markers are still in the file: Git commits them, and the price list is broken.

</details>

## Quick quiz

1. When does git merge make a fast-forward instead of a merge commit?
   - A) When the branch you're on has no new commits since the other branch started
   - B) When the branches changed different files
   - C) Always, unless there's a conflict
   - D) When you pass --no-ff

2. What is the merge base?
   - A) The last commit both branches share
   - B) The first commit in the repository
   - C) The newest commit on main
   - D) The commit with the conflict

3. What does the section between ======= and >>>>>>> cheaper-bell contain?
   - A) The version from the branch being merged in
   - B) The version from your current branch
   - C) The merge base's version
   - D) Git's suggested resolution

4. You're halfway through resolving a confusing conflict and want to start over. What do you run?
   - A) git merge --abort
   - B) git branch -D main
   - C) git commit -am "fix"
   - D) git switch -c retry

<details>
<summary>Quiz answers</summary>

1. **A) When the branch you're on has no new commits since the other branch started**: If there's nothing to combine, Git just moves the branch pointer forward.
2. **A) The last commit both branches share**: Git compares each side with the merge base to work out what each one changed.
3. **A) The version from the branch being merged in**: Above ======= is HEAD (your branch); below is the incoming branch.
4. **A) git merge --abort**: It restores the files and branch to how they were before the merge began.

</details>

---
Previous: [Lesson 7](07-branches.md) · Next: [Lesson 9: GitHub and remotes: clone, push and pull](09-remotes.md)
