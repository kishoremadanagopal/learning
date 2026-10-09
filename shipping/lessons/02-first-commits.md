# Lesson 2: Your first repository and commits

**You'll learn:** git init and the .git folder, the working tree, staging area (index) and repository, git status, git add for files, folders and everything, git commit -m, git log, what a commit records (snapshot, id, author, date, message, parent), the first (root) commit, staging only some files, git commit -a and its limits, git add -p on your own computer, writing good commit messages (imperative subject, about 50 characters, a body that says why), small focused commits.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#first-commits)**: run every example and check your exercise answers.

## Key terms

- **Repository (repo):** a project folder whose history Git tracks; the history lives in its `.git` folder.
- **Working tree:** the files you see and edit.
- **Staging area (index):** the list of changes that will go into the next commit.
- **Commit:** a saved snapshot of the staged files, with an id, author, date, message and a link to its parent.
- **Commit id (hash):** a 40-character code that names a commit uniquely; the first 7 characters are usually enough.
- **Untracked file:** a file in the folder that Git has never been told to track.
- **Tracked file:** a file that's in the last commit or the staging area.
- **Root commit:** the first commit in a repository, the only one with no parent.

A **repository** (repo) is a project folder whose history Git tracks. `git init` turns a folder into one by creating a hidden `.git` folder, where Git keeps everything it records.

```bash
mkdir shop
cd shop
git init
ls -a
git status
```

## The three areas

Git separates your work into three places, and most commands move changes between them:

![Three boxes: the working tree (the files you edit, such as README.md, a changed prices.txt and a new notes.txt), the staging area or index (what the next commit will contain: README.md and the changed prices.txt), and the repository in .git (every commit, forever). git add copies changes from the working tree to the staging area; git commit records the staging area as a new commit in the repository. git restore and git switch copy files back from the repository](../figures/three-areas.svg)

| Area | What it is |
|---|---|
| **working tree** | the files in the folder, as you see and edit them |
| **staging area** (also called the **index**) | the next commit, being assembled: changes you've chosen with `git add` |
| **repository** | the `.git` folder: every commit ever made |

The staging area lets you choose what goes into each commit. You might change five files but commit two of them now, as one meaningful step, and the rest later.

## add, commit, log

```bash
mkdir shop && cd shop && git init -q
echo "# Bike shop" > README.md
git status
git add README.md
git status
git commit -m "Add README"
git status
git log
```

Read `git status` after every step; it always says what's going on and often suggests the next command.

- `git add <file>` stages a file (new or changed); `git add .` stages everything in the current folder.
- `git commit -m "message"` records the staged changes as a **commit**.
- `git log` lists commits, newest first.

## What a commit is

A commit is a **snapshot** of the whole project at one moment, plus:

- a unique **id** (a **hash**) such as `7c3a1f9…`, usually shortened to 7 characters;
- the **author** and **date**;
- the **message** explaining the change;
- a pointer to its **parent**, the commit before it.

![Three commits in a row, 9f8e7d6 Add README, a1b2c3d Add prices and c4d5e6f Add the lock, each pointing back to its parent. A label main points at the newest commit, and HEAD points at main: a branch is a name pointing at a commit, and HEAD is the branch you're on](../figures/commit-chain.svg)

**`main`** is a **branch**: a name that points at the newest commit and moves forward with every new commit. **HEAD** means "where you are now", normally the current branch. Part 2 is all about branches.

## Committing only some changes

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt
echo "Open 9 to 5, Monday to Saturday." > hours.txt
git add . && git commit -qm "Start the shop"
echo "Open 9 to 6, Monday to Saturday." > hours.txt
git add hours.txt
echo "tube 600" >> prices.txt
echo "Ideas: sell gloves?" > ideas.txt
```

</details>

```bash
git status
git add prices.txt
git commit -m "Add inner tubes to the price list"
git status
git log --oneline
```

Here `hours.txt` was already staged, so the commit contained both staged files: the staging area holds **everything** you've added since the last commit, not just your latest `git add`. Check `git status` before committing. `ideas.txt` stays untracked until you add it.

`git commit -a -m "…"` (or `-am`) stages every change to **tracked** files and commits in one step. It's handy, but skips new files, and makes it easy to commit something you didn't mean to.

## Good commit messages

Your future self and your teammates read commit messages to understand **why** something changed. The conventions:

- A short summary line, ideally under about 50 characters (72 at most), in the imperative mood: "Add opening hours", "Fix rounding of VAT", like completing the sentence "If applied, this commit will…".
- If the change needs explaining, a blank line and then a body saying why. With `-m`, give a second `-m` for the body: `git commit -m "Lower the pump price" -m "The supplier cut wholesale prices by 10%."`
- One logical change per commit: "Add login page" and "Fix typo in README" are two commits.

Many teams use **Conventional Commits**, a prefix saying what kind of change it is: `feat: add opening hours`, `fix: round VAT correctly`, `docs: …`, `chore: …`. Tools can then generate changelogs and version numbers from the history (Part 9).

| Weak | Better |
|---|---|
| `update` | `Add the bike lock to the price list` |
| `fixed stuff` | `Fix total when the cart is empty` |
| `WIP` | `Add draft of the returns page` |

## Try it on your own computer

Make a folder, `git init`, create a file in your editor, then `git add` and `git commit -m "…"`. Run `git status` between every step. Without `-m`, Git opens your configured editor for the message: write it, save, and close the editor.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Start tracking a folder | git init | creates .git | rm -rf .git (deletes all history) |
| Stage a change | git add file (git add . for all) | staging area | git restore --staged file |
| Save a snapshot | git commit -m "Add price list" | new commit on the branch | git reset --soft HEAD~1 |
| Stage tracked files and commit | git commit -am "…" | staging area and history | git reset --soft HEAD~1 |
| See where you are | git status | nothing | — |

## Common mistakes

- Running `git init` in your home folder instead of the project folder.
- Expecting `git commit -a` to include new files; it only stages files Git already tracks.
- Using `git add .` without checking `git status`, and committing stray files.
- Writing messages like "fix" or "changes" that won't mean anything in six months.
- Putting several unrelated changes in one commit, so none of them can be undone alone.
- Nesting a repository inside another by running `git init` in a subfolder.

## Exercises

### 1. Make two commits

Create a repository in a new folder `~/shop` and make two commits, in this order:

1. `README.md` containing `# Bike shop`, with the message `Add README`;
2. `prices.txt` containing the two lines `bell 800` and `pump 3200`, with the message `Add price list`.

Finish with a clean working tree.

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** two snapshots: the first with one file, the second with both.
2. **Examples:** if you create both files and then commit twice, the first commit could contain both.
3. **Brute force:** `git add .` then one commit: one commit, not two.
4. **Pattern:** **edit → add → commit**, repeated per logical change.
5. **Plan:** init → README → add → commit → prices → add → commit.
6. **Code and test:** `git log --oneline` shows two commits; `git status` says the tree is clean.

</details>

<details>
<summary>💡 Hint 1</summary>

Start with `mkdir shop`, `cd shop` and `git init`.

</details>

<details>
<summary>💡 Hint 2</summary>

Each commit is "write the file, `git add` it, `git commit -m "…"`". Make the README commit before creating `prices.txt`.

</details>

<details>
<summary>💡 Hint 3</summary>

For the two-line file, use `echo … >` and `echo … >>`, or `printf "bell 800\npump 3200\n" > prices.txt`. Check with `git log --oneline` and `git status`.

</details>

### 2. Commit only what's ready

In this repository, `hours.txt` is already staged (new opening hours), `prices.txt` has an unstaged change (inner tubes added) and `ideas.txt` is new. Make **one** commit with the message `Add inner tubes to the price list` that contains **only** the `prices.txt` change. Leave the opening-hours change and `ideas.txt` out of the commit, but keep both in the folder.

<details>
<summary>The sandbox starts this exercise with these commands (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt
echo "Open 9 to 5, Monday to Saturday." > hours.txt
git add . && git commit -qm "Start the shop"
echo "Open 9 to 6, Monday to Saturday." > hours.txt
git add hours.txt
echo "tube 600" >> prices.txt
echo "Ideas: sell gloves?" > ideas.txt
```

</details>

Starter:

```bash
git status
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a commit takes the whole staging area, so the staging area must contain exactly the price change.
2. **Examples:** committing now, after `git add prices.txt`, would include `hours.txt` as well.
3. **Brute force:** commit everything, then try to split it afterwards: much harder.
4. **Pattern:** **shape the staging area, then commit**.
5. **Plan:** status → unstage hours → stage prices → commit → status.
6. **Code and test:** `git show --stat` lists only `prices.txt`.

</details>

<details>
<summary>💡 Hint 1</summary>

Read `git status` first: it lists "Changes to be committed" (staged) separately from "Changes not staged for commit".

</details>

<details>
<summary>💡 Hint 2</summary>

The staged `hours.txt` would go into the commit too. `git restore --staged hours.txt` takes it out of the staging area without touching the file (`git status` even suggests this command).

</details>

<details>
<summary>💡 Hint 3</summary>

Then `git add prices.txt` and commit. Check with `git show --stat` that only `prices.txt` changed.

</details>

**In the sandbox:** exercises 3–4. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Make two commits</summary>

```bash
mkdir shop
cd shop
git init
echo "# Bike shop" > README.md
git add README.md
git commit -m "Add README"
printf "bell 800\npump 3200\n" > prices.txt
git add prices.txt
git commit -m "Add price list"
git log --oneline
git status
```

**Line by line**

- `git init` creates the repository; until the first commit, `git log` has nothing to show.
- Staging and committing `README.md` alone makes the first snapshot contain only it.
- `printf` writes both lines in one command (`\n` is a line break).
- The second commit's snapshot includes both files: commits are full snapshots, not just the latest change.

**Trace:** `git log --oneline` → `… Add price list` above `… Add README`.

**Common wrong approach:** forgetting `git add` before the second commit: Git answers "nothing added to commit but untracked files present", and no commit is made.

</details>

<details>
<summary>✅ 2. Commit only what's ready</summary>

```bash
git status
git restore --staged hours.txt
git add prices.txt
git commit -m "Add inner tubes to the price list"
git status
```

**Line by line**

- `git status` shows `hours.txt` under "Changes to be committed": it was added earlier.
- `git restore --staged hours.txt` removes that change from the staging area; the file on disk keeps the new hours.
- `git add prices.txt` stages the price change.
- The commit contains exactly what's staged: the price change.

**Trace:** after the commit, `git status` shows `hours.txt` as modified (not staged) and `ideas.txt` as untracked.

**Common wrong approach:** `git commit -am "…"`: it stages and commits every tracked change, including the hours.

</details>

## Quick quiz

1. Which area holds the changes your next commit will contain?
   - A) The staging area (index)
   - B) The working tree
   - C) The .git/objects folder

2. You run git add a.txt, then edit a.txt again, then git commit. What's committed?
   - A) The version of a.txt from when you ran git add
   - B) The latest version on disk
   - C) Nothing, because the file changed

3. Which is the best commit summary line?
   - A) Fix total when the cart is empty
   - B) fixed it
   - C) Changes

4. What does git commit -am "message" skip?
   - A) New (untracked) files
   - B) Changed files
   - C) Deleted tracked files

<details>
<summary>Quiz answers</summary>

1. **A) The staging area (index)**: git add puts changes there; git commit records them.
2. **A) The version of a.txt from when you ran git add**: git add stages a snapshot of the file; stage again to include later edits.
3. **A) Fix total when the cart is empty**: Imperative, specific and short: it says what the commit does.
4. **A) New (untracked) files**: -a stages changes to files Git already tracks; new files need git add.

</details>

---
Previous: [Lesson 1](01-version-control.md) · Next: [Lesson 3: Seeing changes: status, diff, log and show](03-seeing-changes.md)
