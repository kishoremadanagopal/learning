# Lesson 3: Seeing changes: status, diff, log and show

**You'll learn:** git status -s and its two-letter codes, git diff for unstaged changes, git diff --staged, git diff between two commits, reading a unified diff (---, +++, hunk headers, + and - lines), git diff --stat and --name-only, git log --oneline, -n, --stat, -p, --format, a file path and --all, naming commits with HEAD, HEAD~1 and short ids, git show for a commit and for a file at a commit (rev:path), finding when and why a line changed, git log -S and git blame on your own computer.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#seeing-changes)**: run every example and check your exercise answers.

## Key terms

- **Diff:** the differences between two versions, shown line by line.
- **Unified diff:** the standard diff format: `-` for removed lines, `+` for added lines, and some unchanged lines around them.
- **Hunk:** one block of changes in a diff, starting with a header such as `@@ -1,3 +1,4 @@`.
- **`HEAD`:** the commit you're on now, usually the newest commit of the current branch.
- **`HEAD~n`:** the commit n steps back from `HEAD` along first parents.
- **Short id:** the first few characters of a commit id, enough to name it while it's unique.
- **`rev:path`:** a file as it was in a given commit, such as `HEAD~2:prices.txt`.

Before committing, and whenever you need to understand a project, you'll ask Git three questions: **what's changed?** (`status`, `diff`), **what happened?** (`log`), and **what exactly did this commit do?** (`show`).

## Short status

`git status -s` gives one line per file, with two columns: the **left** is the staging area, the **right** is the working tree.

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
git status -s
```

| Code | Means |
|---|---|
| `M ` | modified and staged |
| ` M` | modified, not staged |
| `MM` | staged, then changed again |
| `A ` | new file, staged |
| ` D` / `D ` | deleted (not staged / staged) |
| `??` | untracked (new, never added) |

## git diff

`git diff` shows changes that **aren't staged yet**; `git diff --staged` shows what **is** staged, the content of your next commit:

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
git diff
git diff --staged
```

Reading a diff:

```text
diff --git a/prices.txt b/prices.txt      which file
index 9ad26c8..5f2e8b3 100644            the old and new versions' blob ids
--- a/prices.txt                         the old version…
+++ b/prices.txt                         …and the new one
@@ -1,3 +1,4 @@                          a hunk: from line 1, 3 old lines; from line 1, 4 new lines
 bell 800                                unchanged context (starts with a space)
 pump 3000
 lock 2900
+tube 600                                added line (+); removed lines start with -
```

A changed line appears as a `-` line followed by a `+` line. Diffs show 3 lines of context around each change so you can see where it is.

## git log

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
git add README.md && git commit -qm "Add README"
printf "bell 800\npump 3200\n" > prices.txt
git add prices.txt && git commit -qm "Add price list"
echo "lock 2900" >> prices.txt
git commit -qam "Add the bike lock"
sed -i "s/pump 3200/pump 3000/" prices.txt
git commit -qam "Lower the pump price"
echo "Open 9 to 5, Monday to Saturday." > hours.txt
git add hours.txt && git commit -qm "Add opening hours"
```

</details>

```bash
git log --oneline
git log --oneline -2
git log --stat -1
git log --oneline prices.txt
git log --format="%h %an %s"
```

| Option | Shows |
|---|---|
| `--oneline` | one line per commit: short id and summary |
| `-n 3` or `-3` | only the newest 3 commits |
| `--stat` | which files each commit changed, and how much |
| `-p` | each commit's full diff |
| `<file>` | only commits that changed that file |
| `--format="%h %an %ad %s"` | your own format: short id, author, date, summary |
| `--graph --all` | branches drawn as a graph (Part 2) |

## Naming commits

You can name a commit by its id (the first 7 characters are enough) or relative to HEAD:

| Name | Commit |
|---|---|
| `HEAD` | the current commit |
| `HEAD~1` (or `HEAD^`) | its parent |
| `HEAD~3` | three commits back |
| `main`, `v1.0` | what a branch or tag points to |

## git show

`git show` prints a commit with its diff; `git show <commit>:<file>` prints a file as it was in that commit:

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
git add README.md && git commit -qm "Add README"
printf "bell 800\npump 3200\n" > prices.txt
git add prices.txt && git commit -qm "Add price list"
echo "lock 2900" >> prices.txt
git commit -qam "Add the bike lock"
sed -i "s/pump 3200/pump 3000/" prices.txt
git commit -qam "Lower the pump price"
echo "Open 9 to 5, Monday to Saturday." > hours.txt
git add hours.txt && git commit -qm "Add opening hours"
```

</details>

```bash
git show HEAD~1
git show HEAD~3:prices.txt
git diff HEAD~3 HEAD -- prices.txt
```

`git diff A B` compares two commits; adding `-- <file>` limits it to one file.

## Investigating a change

A typical question: "when did the pump price change, and why?" Narrow down with the file, then read the commit:

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
git add README.md && git commit -qm "Add README"
printf "bell 800\npump 3200\n" > prices.txt
git add prices.txt && git commit -qm "Add price list"
echo "lock 2900" >> prices.txt
git commit -qam "Add the bike lock"
sed -i "s/pump 3200/pump 3000/" prices.txt
git commit -qam "Lower the pump price"
echo "Open 9 to 5, Monday to Saturday." > hours.txt
git add hours.txt && git commit -qm "Add opening hours"
```

</details>

```bash
git log --oneline -p prices.txt
```

`git log -p <file>` shows every change to a file with its commit, and the message says why. (On your own computer, `git blame prices.txt` shows the last commit for each line, and `git log -S "3000"` finds commits that added or removed a piece of text.)

## Try it on your own computer

Git shows long output in a **pager**: scroll with the arrow keys or space, and press `q` to quit. Run `git config --global core.pager cat` if you'd rather not use one. Editors show the same information visually: in VS Code, the Source Control panel shows diffs side by side, and the Timeline view shows a file's history.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Short status | git status -s | nothing | — |
| Unstaged changes | git diff | nothing | — |
| Staged changes | git diff --staged | nothing | — |
| Compact history | git log --oneline -n 5 | nothing | — |
| One commit in full | git show HEAD~1 | nothing | — |
| A file at a commit | git show HEAD~2:prices.txt | nothing | — |

## Common mistakes

- Running `git diff` and seeing nothing because the changes are already staged; use `git diff --staged`.
- Reading the order of `git diff A B` backwards: it shows how to get from A to B.
- Using `HEAD~1` in a message or a script as if it were fixed; it moves with every commit.
- Reading `git log` without `--oneline` or `-n` and getting lost in the output.
- Forgetting `--` before a file name that looks like a branch name.

## Exercises

### 1. Investigate the history

In this repository, find the commit that **lowered the pump price**, and save its **short id** (the 7 characters `git log --oneline` shows) to the file `~/answer.txt`, on its own line. Use Git commands to find it; you can write the file with `echo`.

<details>
<summary>The sandbox starts this exercise with these commands (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
git add README.md && git commit -qm "Add README"
printf "bell 800\npump 3200\n" > prices.txt
git add prices.txt && git commit -qm "Add price list"
echo "lock 2900" >> prices.txt
git commit -qam "Add the bike lock"
sed -i "s/pump 3200/pump 3000/" prices.txt
git commit -qam "Lower the pump price"
echo "Open 9 to 5, Monday to Saturday." > hours.txt
git add hours.txt && git commit -qm "Add opening hours"
```

</details>

Starter:

```bash
git log --oneline
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** find one commit by what it changed, then save its id.
2. **Examples:** the summary "Lower the pump price" suggests it, and the diff proves it.
3. **Brute force:** `git show` every commit one by one: works for five commits, not for five thousand.
4. **Pattern:** **filter the log by file, then read the diff**.
5. **Plan:** `git log -p prices.txt` → spot the pump line → save the id.
6. **Code and test:** `cat ~/answer.txt`.

</details>

<details>
<summary>💡 Hint 1</summary>

`git log --oneline` lists the commits; one of the messages describes the price change. To be sure, check its diff with `git show <id>`.

</details>

<details>
<summary>💡 Hint 2</summary>

`git log -p prices.txt` shows every change to the price list; look for `-pump 3200` and `+pump 3000`.

</details>

<details>
<summary>💡 Hint 3</summary>

Write the id with `echo abc1234 > ~/answer.txt` (your id, not abc1234), or let Git do it: `git rev-parse --short <commit> > ~/answer.txt`.

</details>

### 2. What's about to be committed?

Before committing, a teammate wants two lists. Save the **names of the files with staged changes** to `~/staged.txt`, and the **names of the files with unstaged changes** to `~/unstaged.txt`, one name per line, using `git diff`. Don't stage, unstage or commit anything.

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

1. **Understand:** two diffs, names only, saved to files.
2. **Examples:** `ideas.txt` is untracked, so neither diff includes it.
3. **Brute force:** copying names from `git status` by hand: error-prone, and not what a script would do.
4. **Pattern:** **choose the right comparison, format it, redirect it**.
5. **Plan:** `git diff --staged --name-only > …` and `git diff --name-only > …`.
6. **Code and test:** `cat` both files; `git status -s` should be unchanged.

</details>

<details>
<summary>💡 Hint 1</summary>

`git diff` compares the working tree with the staging area (unstaged changes); `git diff --staged` compares the staging area with the last commit (staged changes).

</details>

<details>
<summary>💡 Hint 2</summary>

`--name-only` prints just the file names instead of the full diff.

</details>

<details>
<summary>💡 Hint 3</summary>

Redirect each command's output into a file: `git diff --staged --name-only > ~/staged.txt`.

</details>

**In the sandbox:** exercises 5–6. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Investigate the history</summary>

```bash
git log --oneline prices.txt
git show HEAD~1 --stat
git log --oneline -1 HEAD~1
git rev-parse --short HEAD~1 > ~/answer.txt
cat ~/answer.txt
```

**Line by line**

- `git log --oneline prices.txt` lists only the commits that touched the price list: three of the five.
- `git show <id>` (or `-p` in the log) confirms which one changed `pump 3200` to `pump 3000`.
- `git rev-parse --short HEAD~1` prints that commit's short id; `>` saves it. Typing the id with `echo` works just as well.

**Trace:** the commits are Add README, Add price list, Add the bike lock, Lower the pump price, Add opening hours: the pump change is the second newest, `HEAD~1`.

**Common wrong approach:** saving the newest commit's id because it's at the top of the log: the newest commit added opening hours.

</details>

<details>
<summary>✅ 2. What's about to be committed?</summary>

```bash
git diff --staged --name-only > ~/staged.txt
git diff --name-only > ~/unstaged.txt
cat ~/staged.txt ~/unstaged.txt
git status -s
```

**Line by line**

- `git diff --staged --name-only` lists files whose staged version differs from the last commit: `hours.txt`.
- `git diff --name-only` lists files whose working-tree version differs from the staging area: `prices.txt`.
- Untracked files aren't in either list: Git doesn't compare files it isn't tracking.
- `>` saves each list; nothing in the repository changes.

**Trace:** `git status -s` shows `M  hours.txt`, ` M prices.txt`, `?? ideas.txt`: the left column matches the staged list, the right column the unstaged one.

**Common wrong approach:** `git diff --cached` vs `--staged` confusion: they're the same option. The real trap is using plain `git diff` for both, which never shows staged changes.

</details>

## Quick quiz

1. What does git diff show with no options?
   - A) Changes in the working tree that aren't staged yet
   - B) Changes in the last commit
   - C) Everything that differs from the remote

2. In git status -s, what does "M " (M then a space) mean?
   - A) Modified and staged; no further unstaged changes
   - B) Modified but not staged
   - C) Merged

3. What is HEAD~2?
   - A) The commit two before the current one
   - B) The second branch
   - C) The current commit, twice

4. Which command shows prices.txt as it was in the commit before last?
   - A) git show HEAD~2:prices.txt
   - B) git log prices.txt
   - C) git diff prices.txt

<details>
<summary>Quiz answers</summary>

1. **A) Changes in the working tree that aren't staged yet**: Use git diff --staged for what will be committed.
2. **A) Modified and staged; no further unstaged changes**: Left column: staging area; right column: working tree.
3. **A) The commit two before the current one**: ~n walks back n parents.
4. **A) git show HEAD~2:prices.txt**: commit:path prints a file from any commit.

</details>

---
Previous: [Lesson 2](02-first-commits.md) · Next: [Lesson 4: .gitignore and what never to commit](04-ignoring-files.md)
