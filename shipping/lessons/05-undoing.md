# Lesson 5: Undoing things safely

**You'll learn:** choosing an undo by what you want to change, git restore to discard working-tree changes, git restore --staged to unstage, git restore --source to bring back an old version, git commit --amend to fix the last message or add a forgotten file, git reset --soft, --mixed and --hard with what each moves, git revert to undo a commit with a new commit, reverting an older commit, the golden rule about shared history, the reflog and recovering after reset --hard, why uncommitted work can't be recovered.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#undoing)**: run every example and check your exercise answers.

## Key terms

- **`git restore`:** puts a file back to the version in the staging area (or, with `--staged`, unstages it).
- **Amend:** replaces the last commit with a new one that has your fixes.
- **`git reset`:** moves the current branch to another commit; `--soft`, `--mixed` and `--hard` decide what happens to the staging area and files.
- **`git revert`:** makes a new commit that undoes an earlier commit, keeping the history.
- **Rewriting history:** replacing commits with new ones (amend, reset, rebase); safe only for commits nobody else has.
- **Reflog:** Git's local log of where `HEAD` and each branch have been, used to find "lost" commits.

Everyone makes mistakes with Git: a typo in a message, a forgotten file, a commit that broke something. Git can undo almost anything, but the right command depends on **where** the mistake is, and whether anyone else already has it.

| Situation | Command | What it changes |
|---|---|---|
| I changed a file and want the last committed version back | `git restore <file>` | the working tree (your edits are **lost**) |
| I staged something by mistake | `git restore --staged <file>` | the staging area only |
| The last commit's message is wrong, or I forgot a file | `git commit --amend` | replaces the last commit |
| My last commits (not pushed yet) should be undone, keeping the changes | `git reset --soft HEAD~1` (or `--mixed`) | moves the branch back |
| My last commits (not pushed yet) should be thrown away completely | `git reset --hard HEAD~1` | moves the branch back and **deletes** the changes |
| A commit others already have is wrong | `git revert <commit>` | adds a new commit that undoes it |

## Discard and unstage

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
git restore prices.txt
git restore --staged hours.txt
git status -s
cat hours.txt
```

`git restore prices.txt` threw the tube line away: there's no undo for discarded working-tree changes, because Git never recorded them. `git restore --staged hours.txt` only unstaged; the new hours are still in the file.

## Fixing the last commit

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
echo "Closed on bank holidays." >> hours.txt
git add hours.txt
git commit --amend -m "Add opening hours and holidays"
git log --oneline -3
```

`--amend` replaces the last commit with a new one (with a new id) containing whatever is staged now and the new message. Without `-m`, it keeps the old message.

## reset: move the branch back

`git reset <commit>` moves the current branch to an earlier commit, as if later commits never happened. The three modes differ in what happens to those commits' changes:

| Mode | Branch | Staging area | Working tree |
|---|---|---|---|
| `--soft` | moved | keeps the changes, staged | unchanged |
| `--mixed` (default) | moved | reset | keeps the changes, unstaged |
| `--hard` | moved | reset | **reset: changes are gone** |

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
git reset --soft HEAD~2
git status -s
git log --oneline
git commit -m "Lower the pump price and add opening hours"
git log --oneline
```

Here two commits became one: `reset --soft` is a simple way to combine your last few commits before sharing them. `git reset --hard` is the dangerous one: it overwrites your files. Run `git status` first, and be sure.

## revert: undo a commit others have

Once commits are pushed (Part 2), teammates have built on them. Rewriting them with `reset` or `--amend` would make your history disagree with theirs. Instead, **revert** creates a new commit that does the opposite:

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
git revert HEAD~1 --no-edit
git log --oneline -3
cat prices.txt
```

The history now says exactly what happened: the price was lowered, then the lowering was reverted. This is the safe way to undo anything that's shared.

## The golden rule

**Don't rewrite commits that other people have.** `--amend`, `reset` and (in Part 2) `rebase` replace commits with new ones; that's fine for commits only you have, and causes confusion and lost work for commits already pushed to a shared branch. Use `revert` there.

## The safety net: the reflog

Git keeps a log of where `HEAD` and each branch have been, the **reflog**. By default entries stay for 90 days, or 30 days for commits that are no longer on any branch. If you `reset --hard` the wrong commit away, the commit still exists:

```bash
git reflog                      # HEAD@{1}: commit: Add opening hours …
git reset --hard HEAD@{1}       # go back to where you were one step ago
```

(The sandbox doesn't keep a reflog; on your own computer it's always there.) What the reflog can't bring back is work that was **never committed**: commit often, even small steps; you can combine them later.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Throw away edits to a file | git restore file | working tree (edits lost) | — (not recoverable) |
| Unstage, keep edits | git restore --staged file | staging area | git add file |
| Fix the last commit | git add …; git commit --amend -m "…" | replaces the last commit | git reset --soft HEAD@{1} (own computer) |
| Undo commits, keep changes | git reset --soft HEAD~1 (or --mixed) | branch (and index) | git reset ORIG_HEAD |
| Undo a pushed commit | git revert <commit> | adds a new commit | git revert the revert |
| Recover after reset --hard | git reflog, then git reset --hard HEAD@{1} | branch and files | — |

## Common mistakes

- Running `git reset --hard` with uncommitted work you wanted; that work is gone for good.
- Amending or resetting commits that are already pushed to a shared branch.
- Using `git revert` with the wrong commit; check it with `git show` first.
- Confusing `git restore file` (throws away edits) with `git restore --staged file` (keeps them).
- Using `git checkout` for everything; `git switch` and `git restore` split its jobs safely.

## Exercises

### 1. Fix the last commit

The last commit was meant to add the price list **and** the delivery rates, but `delivery.txt` was forgotten and the message has a typo (`Add prces`). Fix it so that the history has **the same number of commits**, and the last one has the message `Add prices and delivery rates` and contains both files.

Starter:

```bash
mkdir shop && cd shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\n" > prices.txt && git add prices.txt && git commit -qm "Add prces"
echo "standard 399" > delivery.txt
git log --oneline
git status
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** change the last commit (content and message), not add a new one.
2. **Examples:** a new commit "Add delivery" would leave the typo and make three commits.
3. **Brute force:** `git reset --soft HEAD~1`, add, commit again: also works, in two steps.
4. **Pattern:** **stage the fix, then `--amend`**.
5. **Plan:** add delivery.txt → commit --amend -m.
6. **Code and test:** `git log --oneline` shows two commits; `git show --stat` lists both files.

</details>

<details>
<summary>💡 Hint 1</summary>

Stage the forgotten file first: `git add delivery.txt`.

</details>

<details>
<summary>💡 Hint 2</summary>

`git commit --amend` replaces the last commit with one that includes what's staged now.

</details>

<details>
<summary>💡 Hint 3</summary>

Give the new message with `-m` in the same command: `git commit --amend -m "Add prices and delivery rates"`.

</details>

### 2. Undo a shared commit

The commit `Show prices in USD` broke the shop, and it has already been pushed, so the team agreed to undo it **without rewriting history**. Undo exactly that commit (the later commit, which added opening hours, must stay) so that `prices.txt` shows pounds again.

Starter:

```bash
mkdir shop && cd shop && git init -q
printf "bell £8.00\npump £30.00\n" > prices.txt && git add . && git commit -qm "Add price list"
printf "bell \$10.00\npump \$38.00\n" > prices.txt && git commit -qam "Show prices in USD"
echo "Open 9 to 5" > hours.txt && git add hours.txt && git commit -qm "Add opening hours"
git log --oneline
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** undo one older commit, keep everything else, add to history rather than change it.
2. **Examples:** `git reset --hard HEAD~2` would also remove the opening hours, and rewrite shared history.
3. **Brute force:** edit `prices.txt` back by hand and commit: works, but loses the link to what was undone.
4. **Pattern:** **`git revert` for shared commits**.
5. **Plan:** find the commit → `git revert <it> --no-edit` → check the log and the file.
6. **Code and test:** `cat prices.txt` shows £ again; `hours.txt` is still there.

</details>

<details>
<summary>💡 Hint 1</summary>

Pushed history must not be rewritten, so `reset` and `--amend` are out. `git revert <commit>` adds a new commit that undoes one.

</details>

<details>
<summary>💡 Hint 2</summary>

The USD commit isn't the latest: name it by its id from `git log --oneline`, or as `HEAD~1`.

</details>

<details>
<summary>💡 Hint 3</summary>

`--no-edit` keeps Git's suggested message (`Revert "Show prices in USD"`) without opening an editor.

</details>

**In the sandbox:** exercises 9–10. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Fix the last commit</summary>

```bash
mkdir shop && cd shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\n" > prices.txt && git add prices.txt && git commit -qm "Add prces"
echo "standard 399" > delivery.txt
git add delivery.txt
git commit --amend -m "Add prices and delivery rates"
git log --oneline
git show --stat
```

**Line by line**

- `git add delivery.txt` stages the forgotten file on top of what the last commit already has.
- `git commit --amend -m "…"` builds a new commit from the staging area (prices and delivery) with the new message, and moves `main` to it in place of the old one.
- The old commit isn't deleted immediately, but nothing points to it any more.

**Trace:** before: `Add prces` (prices only). After: `Add prices and delivery rates` (prices and delivery), with a different id.

**Common wrong approach:** amending a commit that's already been pushed: it's fine here, but on a shared branch it rewrites history others have.

</details>

<details>
<summary>✅ 2. Undo a shared commit</summary>

```bash
mkdir shop && cd shop && git init -q
printf "bell £8.00\npump £30.00\n" > prices.txt && git add . && git commit -qm "Add price list"
printf "bell \$10.00\npump \$38.00\n" > prices.txt && git commit -qam "Show prices in USD"
echo "Open 9 to 5" > hours.txt && git add hours.txt && git commit -qm "Add opening hours"
git revert HEAD~1 --no-edit
git log --oneline
cat prices.txt
```

**Line by line**

- `git log --oneline` shows the USD commit is `HEAD~1`.
- `git revert HEAD~1 --no-edit` computes the opposite of that commit's changes (dollars back to pounds), applies it, and commits with the message `Revert "Show prices in USD"` and a body naming the reverted commit.
- The opening-hours commit is untouched, because the revert only reverses the USD commit's own changes.

**Trace:** history: Add price list → Show prices in USD → Add opening hours → Revert "Show prices in USD".

**Common wrong approach:** `git revert HEAD`: that undoes the opening hours, the wrong commit.

</details>

## Quick quiz

1. Which command throws away uncommitted edits to app.js, with no way back?
   - A) git restore app.js
   - B) git restore --staged app.js
   - C) git revert app.js

2. A commit is already on the shared main branch. How do you undo it?
   - A) git revert <commit>
   - B) git reset --hard <commit>~1
   - C) git commit --amend

3. What does git reset --soft HEAD~1 do?
   - A) Moves the branch back one commit and keeps that commit's changes staged
   - B) Deletes the last commit and its changes
   - C) Only unstages files

4. You ran git reset --hard and lost a commit. What can help?
   - A) git reflog, which still lists where HEAD was
   - B) Nothing; it's gone
   - C) git restore

<details>
<summary>Quiz answers</summary>

1. **A) git restore app.js**: Changes that were never committed can't be recovered.
2. **A) git revert <commit>**: Revert adds a new commit instead of rewriting shared history.
3. **A) Moves the branch back one commit and keeps that commit's changes staged**: --soft leaves the staging area and working tree as they were.
4. **A) git reflog, which still lists where HEAD was**: Commits stay reachable through the reflog for about 90 days.

</details>

---
Previous: [Lesson 4](04-ignoring-files.md) · Next: [Lesson 6: How Git stores your work](06-inside-git.md)
