# Lesson 10: Keeping in sync: rebase, pull and force-with-lease

**You'll learn:** diverged branches, git pull's divergent-branches message, git pull --no-rebase (merge) and --rebase, pull.rebase and pull.ff settings, why rebased commits get new ids, git rebase origin/main on a feature branch, conflicts during a rebase, git rebase --continue, --skip and --abort, which side HEAD is during a rebase, git push --force-with-lease versus --force, --force-if-includes, when rewriting history is safe, git cherry-pick, interactive rebase on your own computer (reword, squash, fixup, drop), rebase.autoStash.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#syncing)**: run every example and check your exercise answers.

## Key terms

- **Diverged:** two copies of a branch each have commits the other doesn't.
- **Rebase:** replay a branch's commits on top of another commit, creating new commits with new ids.
- **Force push:** replace a remote branch with your version, even if that drops commits it had.
- **`--force-with-lease`:** a force push that refuses if the remote branch changed since you last fetched.
- **Cherry-pick:** apply the change from one commit onto the current branch as a new commit.
- **Interactive rebase:** `git rebase -i`, which lets you reword, squash, reorder or drop your recent commits.

When you and a teammate both commit to the same branch, the two copies **diverge**: each has a commit the other lacks. Git can't push until they're joined again, and there are two ways to join them.

![Before: from commit B, GitHub's main gained Grace's commit G and your main gained your commit Y. git pull --no-rebase joins them with a merge commit M whose parents are G and Y. git pull --rebase instead replays your commit on top of G as a new commit Y-prime, giving a straight line; Y-prime has a new id and the old Y is left behind](../figures/merge-vs-rebase.svg)

## Pull when you've diverged

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
echo "Open 9 to 5, Monday to Saturday." > hours.txt && git add . && git commit -qm "Add opening hours"
gh repo create shop --public --source=. --push
gh repo clone shop /tmp/grace/shop && cd /tmp/grace/shop
git config user.name "Grace Hopper" && git config user.email grace@example.com
sed -i "s/bell 800/bell 850/" prices.txt && git commit -qam "Raise the bell price"
git push
cd ~/shop
sed -i "s/lock 2900/lock 2700/" prices.txt && git commit -qam "Lower the lock price"
```

</details>

*This example raises an error on purpose.*

```bash
git pull
```

Current versions of Git refuse to guess when branches have diverged: `git pull` stops and asks you to choose. You can choose each time with an option, or once with a setting.

**Merging** (`--no-rebase`) keeps both commits as they were and joins them with a merge commit:

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
echo "Open 9 to 5, Monday to Saturday." > hours.txt && git add . && git commit -qm "Add opening hours"
gh repo create shop --public --source=. --push
gh repo clone shop /tmp/grace/shop && cd /tmp/grace/shop
git config user.name "Grace Hopper" && git config user.email grace@example.com
sed -i "s/bell 800/bell 850/" prices.txt && git commit -qam "Raise the bell price"
git push
cd ~/shop
sed -i "s/lock 2900/lock 2700/" prices.txt && git commit -qam "Lower the lock price"
```

</details>

```bash
git pull --no-rebase
git log --oneline --graph
```

**Rebasing** (`--rebase`) sets your commit aside, updates your branch to GitHub's, then **replays** your commit on top, as a new commit:

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
echo "Open 9 to 5, Monday to Saturday." > hours.txt && git add . && git commit -qm "Add opening hours"
gh repo create shop --public --source=. --push
gh repo clone shop /tmp/grace/shop && cd /tmp/grace/shop
git config user.name "Grace Hopper" && git config user.email grace@example.com
sed -i "s/bell 800/bell 850/" prices.txt && git commit -qam "Raise the bell price"
git push
cd ~/shop
sed -i "s/lock 2900/lock 2700/" prices.txt && git commit -qam "Lower the lock price"
```

</details>

```bash
git pull --rebase
git log --oneline --graph
git push
```

The history stays a straight line, and the push succeeds. Your commit got a new id: rebasing rewrites the commits it moves. That's fine here, because nobody else had that commit yet.

Most teams prefer rebasing for this everyday case, because a merge commit that only says "I pulled" adds noise without information. Set it once:

```bash
git config --global pull.rebase true
```

## Rebasing a feature branch

The same idea updates a feature branch with the latest `main`: `git rebase origin/main` replays the branch's commits on top of `origin/main`, as if you'd started the branch today. Here Grace added helmets to `main` while you added tubes on your branch, at the same place in the file:

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
gh repo create shop --public --source=. --push
git switch -c add-tubes
echo "tube 600" >> prices.txt && git commit -qam "Add inner tubes"
git push -u origin add-tubes
gh repo clone shop /tmp/grace/shop && cd /tmp/grace/shop
git config user.name "Grace Hopper" && git config user.email grace@example.com
echo "helmet 4500" >> prices.txt && git commit -qam "Add helmets"
git push
cd ~/shop
```

</details>

*This example raises an error on purpose.*

```bash
git fetch
git log --oneline --graph --all
git rebase origin/main
```

A rebase can stop on a conflict, just like a merge, once for each commit that clashes. Resolve it the same way, then continue instead of committing:

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
gh repo create shop --public --source=. --push
git switch -c add-tubes
echo "tube 600" >> prices.txt && git commit -qam "Add inner tubes"
git push -u origin add-tubes
gh repo clone shop /tmp/grace/shop && cd /tmp/grace/shop
git config user.name "Grace Hopper" && git config user.email grace@example.com
echo "helmet 4500" >> prices.txt && git commit -qam "Add helmets"
git push
cd ~/shop
```

</details>

```bash
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

## Pushing a rewritten branch

You had already pushed `add-tubes`. After the rebase, your branch and GitHub's have different commits, so a normal push is rejected. You must **force** it, replacing GitHub's version with yours, and you should do that safely:

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
gh repo create shop --public --source=. --push
git switch -c add-tubes
echo "tube 600" >> prices.txt && git commit -qam "Add inner tubes"
git push -u origin add-tubes
gh repo clone shop /tmp/grace/shop && cd /tmp/grace/shop
git config user.name "Grace Hopper" && git config user.email grace@example.com
echo "helmet 4500" >> prices.txt && git commit -qam "Add helmets"
git push
cd ~/shop
```

</details>

```bash
git fetch -q
git rebase origin/main
printf "bell 800\npump 3000\nlock 2900\nhelmet 4500\ntube 600\n" > prices.txt
git add prices.txt
git rebase --continue
git push
git push --force-with-lease
```

`--force-with-lease` replaces the remote branch only if it's still where your `origin/add-tubes` says it is. If a colleague pushed to the branch since you last fetched, it refuses instead of silently deleting their work, which plain `--force` would do. Make it your only way of forcing.

## The rule for rewriting

Rebase, amend and reset create **new** commits and abandon the old ones. That's harmless for commits only you have, and for your own feature branch before or during review. It's harmful for commits other people have built on, above all a shared `main`: their copies still contain the old commits, and the histories no longer agree.

| Situation | Safe? |
|---|---|
| `git pull --rebase` on your unpushed commits | yes |
| rebasing your own feature branch, then `--force-with-lease` | yes, if nobody else commits to it (tell them if they do) |
| rebasing or force-pushing a shared `main` | no: use `git revert` and merges there |

## Copying one commit: cherry-pick

`git cherry-pick <commit>` applies the change from one commit onto your current branch, as a new commit. It's handy for taking an urgent fix from a feature branch, or for back-porting a fix to a release branch:

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
git cherry-pick add-tubes
git log --oneline --graph --all
```

The copy has a new id; the original stays on its branch. Use it for single commits, not as a replacement for merging whole branches.

## Try it on your own computer

- **Interactive rebase** rewrites your own recent commits before sharing them: `git rebase -i HEAD~3` opens a list where you can **reword** messages, **squash** or **fixup** commits together, **drop** or reorder them. The sandbox has no editor for this list, so practise it on your computer.
- `git config --global rebase.autoStash true` stashes uncommitted changes before a rebase and restores them after.
- Add `--force-if-includes` to `--force-with-lease` (Git 2.30 or later) for extra protection when tools fetch in the background.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Integrate remote work, keep history straight | git pull --rebase | your unpushed commits get new ids | git reset --hard ORIG_HEAD |
| Make rebase the default for pull | git config --global pull.rebase true | ~/.gitconfig | git config --global --unset pull.rebase |
| Update a feature branch | git fetch; git rebase origin/main | the branch's commits are rewritten | git rebase --abort (during) |
| Push a rewritten branch | git push --force-with-lease | the remote branch | push the old commit back with --force-with-lease |
| Copy one commit | git cherry-pick <commit> | adds a commit to the current branch | git reset --hard HEAD~1 (not pushed yet) |

## Common mistakes

- Force-pushing with plain `--force` and deleting a teammate's commits.
- Rebasing or force-pushing a shared `main`.
- Running `git commit` instead of `git rebase --continue` after resolving a rebase conflict.
- Expecting `HEAD` to be your side during a rebase; it's the branch you're rebasing onto.
- Cherry-picking a whole branch commit by commit instead of merging it.

## Exercises

### 1. Push after a rejection

Grace pushed a commit to `ada/shop`, and you've made a commit of your own that isn't pushed yet, so your `main` and GitHub's have diverged. Get your commit onto GitHub **on top of** Grace's, with no merge commit.

<details>
<summary>The sandbox starts this exercise with these commands (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
echo "Open 9 to 5, Monday to Saturday." > hours.txt && git add . && git commit -qm "Add opening hours"
gh repo create shop --public --source=. --push
gh repo clone shop /tmp/grace/shop && cd /tmp/grace/shop
git config user.name "Grace Hopper" && git config user.email grace@example.com
sed -i "s/bell 800/bell 850/" prices.txt && git commit -qam "Raise the bell price"
git push
cd ~/shop
sed -i "s/lock 2900/lock 2700/" prices.txt && git commit -qam "Lower the lock price"
```

</details>

Starter:

```bash
git push
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** two commits started from the same point; one must go after the other.
2. **Examples:** `git pull --no-rebase` works too, but adds a merge commit.
3. **Brute force:** `git push --force`: it would delete Grace's commit from GitHub.
4. **Pattern:** **fetch their work, replay yours on top, push**.
5. **Plan:** pull --rebase → check the graph → push.
6. **Code and test:** `git log --oneline --graph` is a straight line; `git status` says up to date.

</details>

<details>
<summary>💡 Hint 1</summary>

The push is rejected with `fetch first`: GitHub has Grace's commit, which you don't have.

</details>

<details>
<summary>💡 Hint 2</summary>

A plain `git pull` asks you to choose between merging and rebasing. You want your commit replayed on top of Grace's.

</details>

<details>
<summary>💡 Hint 3</summary>

`git pull --rebase`, then `git push`.

</details>

### 2. Update a feature branch

You pushed the branch `add-tubes` to `ada/shop`, and meanwhile Grace added helmets to `main` on GitHub, at the same place in `prices.txt`. Update `add-tubes` by **rebasing** it onto the latest `main` from GitHub. Keep both new lines, helmet first:

```text
bell 800
pump 3000
lock 2900
helmet 4500
tube 600
```

Then update the branch on GitHub, safely.

<details>
<summary>The sandbox starts this exercise with these commands (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
gh repo create shop --public --source=. --push
git switch -c add-tubes
echo "tube 600" >> prices.txt && git commit -qam "Add inner tubes"
git push -u origin add-tubes
gh repo clone shop /tmp/grace/shop && cd /tmp/grace/shop
git config user.name "Grace Hopper" && git config user.email grace@example.com
echo "helmet 4500" >> prices.txt && git commit -qam "Add helmets"
git push
cd ~/shop
```

</details>

Starter:

```bash
git log --oneline --graph --all
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** your one commit must end up on top of Grace's, and GitHub's copy of the branch must be replaced.
2. **Examples:** `git merge origin/main` would also update the branch, but with a merge commit, which the task rules out.
3. **Brute force:** deleting the branch and starting again: possible, but loses the branch's history and review comments.
4. **Pattern:** **fetch → rebase → resolve → continue → force-with-lease**.
5. **Plan:** fetch → rebase → write the resolved file → add → continue → push.
6. **Code and test:** `git log --oneline --graph --all` shows `add-tubes` directly on top of `origin/main`.

</details>

<details>
<summary>💡 Hint 1</summary>

`git fetch` first, so `origin/main` includes Grace's helmets. Then, on `add-tubes`, `git rebase origin/main`.

</details>

<details>
<summary>💡 Hint 2</summary>

The rebase stops with a conflict at the end of `prices.txt`. Write the file with both lines (helmet first), `git add prices.txt`, then `git rebase --continue`.

</details>

<details>
<summary>💡 Hint 3</summary>

A plain `git push` is rejected now, because the branch was rewritten. Use `git push --force-with-lease`.

</details>

**In the sandbox:** exercises 19–20. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Push after a rejection</summary>

```bash
git push
git pull --rebase
git log --oneline --graph
git push
```

**Line by line**

- `git pull --rebase` fetches Grace's commit, moves your `main` to it, and replays `Lower the lock price` on top.
- Both edits are to different lines, so there's no conflict: `prices.txt` has `bell 850` and `lock 2700`.
- The push is now a fast-forward for GitHub.

**Trace:** `git log --oneline` → `Lower the lock price` above `Raise the bell price`.

**Common wrong approach:** `git push --force`, which would make GitHub's `main` match yours and drop Grace's commit.

</details>

<details>
<summary>✅ 2. Update a feature branch</summary>

```bash
git fetch
git rebase origin/main
printf "bell 800\npump 3000\nlock 2900\nhelmet 4500\ntube 600\n" > prices.txt
git add prices.txt
git rebase --continue
git push --force-with-lease
git log --oneline --graph --all
```

**Line by line**

- `git fetch` moves `origin/main` to Grace's `Add helmets`.
- `git rebase origin/main` replays `Add inner tubes` on top of it and stops: both commits added a line at the end of the file.
- In the conflict, `HEAD` is Grace's side (`helmet 4500`) and the other side is your commit (`tube 600`); the resolution keeps both.
- `git rebase --continue` makes the new commit and finishes; `--force-with-lease` replaces GitHub's `add-tubes`, because nobody else had changed it.

**Trace:** the push prints `+ …...… add-tubes -> add-tubes (forced update)`.

**Common wrong approach:** `git commit` instead of `git rebase --continue` after resolving: the rebase is still in progress and the remaining steps never run.

</details>

## Quick quiz

1. Your main and origin/main have diverged, and you want a straight-line history. Which command?
   - A) git pull --rebase
   - B) git pull --no-rebase
   - C) git push --force
   - D) git fetch

2. Why does rebasing change your commits' ids?
   - A) It creates new commits with a different parent; ids depend on a commit's contents, including its parent
   - B) Git renames commits after every pull
   - C) The ids are random each time
   - D) It doesn't; ids stay the same

3. Why prefer git push --force-with-lease over --force?
   - A) It refuses if the remote branch changed since you last fetched, so you can't silently delete someone else's push
   - B) It's faster
   - C) It doesn't need a network
   - D) It also merges the branches

4. Which of these should you avoid?
   - A) Rebasing and force-pushing a shared main branch
   - B) Rebasing your unpushed commits with git pull --rebase
   - C) Rebasing your own feature branch before review
   - D) Cherry-picking a fix onto a release branch

<details>
<summary>Quiz answers</summary>

1. **A) git pull --rebase**: Rebasing replays your commits on top of the remote's; merging adds a merge commit.
2. **A) It creates new commits with a different parent; ids depend on a commit's contents, including its parent**: A commit's id is the hash of its contents, and the parent id is part of them.
3. **A) It refuses if the remote branch changed since you last fetched, so you can't silently delete someone else's push**: It's a force push with a safety check.
4. **A) Rebasing and force-pushing a shared main branch**: Rewriting history others have built on makes their copies disagree with the remote.

</details>

---
Previous: [Lesson 9](09-remotes.md) · Next: [Lesson 11: Pull requests and code review](11-pull-requests.md)
