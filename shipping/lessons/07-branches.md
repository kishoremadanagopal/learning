# Lesson 7: Branches and stashes

**You'll learn:** what a branch is (a movable name for a commit), HEAD and the current branch, git branch, git switch -c, git switch -, git checkout -b in older guides, how switching rewrites files, uncommitted changes when switching, git branch -v, git log --oneline --graph --all, git stash, stash list, pop, apply and -u, naming conventions and prefixes, git branch -d and -D, detached HEAD.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#branches)**: run every example and check your exercise answers.

## Key terms

- **Branch:** a movable name that points to a commit; committing moves the current branch forward.
- **Current branch:** the branch `HEAD` points to; new commits go onto it.
- **`git switch`:** changes the current branch and updates your files to match it; `-c` creates the branch first.
- **Stash:** a saved set of uncommitted changes, kept aside so you can switch with a clean working tree.
- **Detached HEAD:** `HEAD` pointing straight at a commit instead of a branch; new commits there belong to no branch.
- **Feature branch:** a short-lived branch for one piece of work, merged when it's done.

So far every commit went onto one line of history, `main`. Real work rarely goes in a straight line: you start a feature, an urgent fix comes in, a colleague wants to try an idea. **Branches** let several lines of work exist side by side in the same repository, so each can be finished, reviewed and combined when it's ready, while `main` stays working.

## What a branch is

In Part 1 you saw that a branch is a tiny file holding one commit id. That's the whole trick: creating a branch writes a new name, it doesn't copy any files. When you commit, the branch you're on (the one `HEAD` points to) moves forward to the new commit; every other branch stays where it was.

![Commits A, B and C in a row with the label main pointing at C. A fourth commit D, Add inner tubes, has B as its parent, and the label add-tubes points at D. HEAD points at add-tubes. A branch is a pointer to a commit; committing moves the branch HEAD points to, and the others stay put](../figures/branches.svg)

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

## Switching changes your files

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
cat prices.txt
git switch add-tubes
cat prices.txt
git switch -
git branch -v
```

Switching rewrites the files in your folder to match the commit the branch points to: the tube line appears and disappears. `git switch -` goes back to the previous branch, and `git branch -v` adds each branch's latest commit.

Uncommitted changes come with you when you switch, as long as they don't clash. If a file you changed is also different on the other branch, Git refuses rather than overwrite your work:

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

*This example raises an error on purpose.*

```bash
echo "tube 650" >> prices.txt
git switch add-tubes
```

## Putting work aside: git stash

When you need to switch but aren't ready to commit, **stash** the work: Git saves your changes in a special place and gives you a clean working tree.

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
git stash
git status -s
git stash list
git stash pop
```

- `git stash` (short for `git stash push`) saves changes to tracked files, staged or not, and resets them. Untracked files, like `ideas.txt`, stay where they are; `git stash -u` takes them too.
- `git stash list` shows saved stashes, newest first as `stash@{0}`.
- `git stash pop` reapplies the newest stash and drops it; `git stash apply` reapplies and keeps it. Changes that were staged come back unstaged (add `--index` to restore the staging too).

Give a stash a name with `git stash push -m "half-done tube prices"`. Stashes are meant for minutes or hours: for anything longer, commit on a branch instead.

## Naming and deleting branches

Good branch names are short, lowercase and hyphenated, and say what the work is: `add-tubes`, `fix-pump-price`. Many teams add a prefix or a ticket number: `feature/checkout-page`, `fix/login-timeout`, `shop-142-add-tubes`. Names can't contain spaces, `..`, `~`, `^`, `:` or `?`.

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
git branch -d add-tubes
git branch -D add-tubes
git branch
```

`git branch -d` deletes a branch only if its commits are already in the current branch (or the branch's upstream, Lesson 3), so you can't lose work by accident. `-D` deletes it anyway; the commits stay in the repository until Git cleans up unreachable objects (weeks later), and the reflog can find them.

## Detached HEAD

`HEAD` normally points to a branch. If you switch to a commit instead (`git switch --detach HEAD~2`, or `git checkout <commit-id>`), you're in **detached HEAD**: fine for looking around, but new commits there belong to no branch and are easy to lose. If you make some you want to keep, give them a branch with `git switch -c new-name` before switching away.

## Try it on your own computer

- Make the graph a habit: `git config --global alias.lg "log --oneline --graph --all"` creates `git lg`.
- VS Code shows the current branch in the bottom-left corner; click it to switch or create branches. Most editors and Git GUIs (GitHub Desktop, GitKraken, Sourcetree) draw the same graph as `git log --graph`.
- `git stash show -p stash@{0}` shows what's in a stash before you pop it.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Create a branch and switch to it | git switch -c add-tubes | new branch name; HEAD | git switch main; git branch -d add-tubes |
| Switch branches | git switch main (git switch - for the previous one) | HEAD and your files | git switch - |
| See all branches | git log --oneline --graph --all | nothing | — |
| Put work aside | git stash (-u for untracked files) | working tree and the stash | git stash pop |
| Delete a merged branch | git branch -d add-tubes | the branch name | git branch add-tubes <commit> |

## Common mistakes

- Committing on `main` and only then remembering to create a branch.
- Switching branches with uncommitted changes and committing them on the wrong branch.
- Leaving work in the stash for days and forgetting it; commit on a branch instead.
- Deleting an unmerged branch with `-D` without checking what was on it.
- Making commits in detached HEAD and switching away without creating a branch.

## Exercises

### 1. Start a feature branch

In `~/shop`, start a branch called `add-helmets` from `main`. On it, add the line `helmet 4500` at the end of `prices.txt` and commit it with the message `Add helmets`. Then switch back to `main`, leaving `main` itself unchanged.

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
git branch
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** one new commit, on a new branch; `main` stays where it was.
2. **Examples:** if you commit before creating the branch, the commit lands on `main`.
3. **Brute force:** copying the folder to try the change: slow, and Git can't combine the copies later.
4. **Pattern:** **branch first, then commit**.
5. **Plan:** switch -c → edit → commit → switch back → check the graph.
6. **Code and test:** `git log --oneline --graph --all` shows `add-helmets` one commit ahead of `main`.

</details>

<details>
<summary>💡 Hint 1</summary>

`git switch -c add-helmets` creates the branch and moves you onto it in one step.

</details>

<details>
<summary>💡 Hint 2</summary>

Append the line with `echo "helmet 4500" >> prices.txt`, then `git commit -am "Add helmets"` (the file is already tracked, so `-a` stages it).

</details>

<details>
<summary>💡 Hint 3</summary>

`git switch main` takes you back; `cat prices.txt` shows the helmet line has gone from your folder, because it's only on `add-helmets`.

</details>

### 2. Put unfinished work aside

Your work in progress in `~/shop` isn't ready: new opening hours (staged), an unfinished price change and a new `ideas.txt`. An urgent fix comes in: the README must say `# Ada's Bike Shop`.

Without committing your unfinished work: put it aside, create a branch `fix-readme` from `main`, commit the fix there with the message `Rename the shop` (changing only `README.md`), go back to `main`, and bring your unfinished work back. Leave nothing in the stash.

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

1. **Understand:** the fix commit must contain only the README change, and your work must survive untouched.
2. **Examples:** switching without stashing carries your changes onto `fix-readme`, and `git commit -am` would sweep them into the fix.
3. **Brute force:** commit the unfinished work as "WIP": it ends up in history and in the fix branch.
4. **Pattern:** **stash, switch, fix, switch back, pop**.
5. **Plan:** stash → switch -c → edit → commit → switch main → pop.
6. **Code and test:** `git show --stat fix-readme` lists only `README.md`; `git status -s` on `main` shows your changes again.

</details>

<details>
<summary>💡 Hint 1</summary>

`git stash` saves the changes to tracked files (staged and unstaged) and leaves you with a clean working tree. `ideas.txt` is untracked, so it simply stays in the folder.

</details>

<details>
<summary>💡 Hint 2</summary>

Then it's the usual: `git switch -c fix-readme`, write the new README line with `echo … > README.md`, and `git commit -am "Rename the shop"`.

</details>

<details>
<summary>💡 Hint 3</summary>

`git switch main`, then `git stash pop`. `git stash list` should print nothing afterwards.

</details>

**In the sandbox:** exercises 13–14. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Start a feature branch</summary>

```bash
git switch -c add-helmets
echo "helmet 4500" >> prices.txt
git commit -am "Add helmets"
git switch main
git log --oneline --graph --all
```

**Line by line**

- `git switch -c add-helmets` writes a new branch pointing at the same commit as `main` and makes it the current branch.
- The commit moves `add-helmets` forward; `main` doesn't move.
- `git switch main` rewrites `prices.txt` to `main`'s version.

**Trace:** the graph shows `* … (add-helmets) Add helmets` above `* … (HEAD -> main) Add opening hours`.

**Common wrong approach:** switching back to `main` before committing: the uncommitted helmet line comes with you, and `add-helmets` has no new commit.

</details>

<details>
<summary>✅ 2. Put unfinished work aside</summary>

```bash
git stash
git switch -c fix-readme
echo "# Ada's Bike Shop" > README.md
git commit -am "Rename the shop"
git switch main
git stash pop
git status -s
```

**Line by line**

- `git stash` records the staged hours and the unstaged price change, then resets both files.
- `git switch -c fix-readme` starts from the same commit as `main`, with a clean tree.
- The commit contains only the README.
- `git stash pop` reapplies the changes on `main` and drops the stash; the hours come back unstaged, which is fine.

**Trace:** `git status -s` at the end shows ` M hours.txt`, ` M prices.txt` and `?? ideas.txt`.

**Common wrong approach:** `git stash apply` instead of `pop`: the work comes back, but the stash stays in the list.

</details>

## Quick quiz

1. What does git switch -c add-tubes do?
   - A) Creates a branch at the current commit and switches to it
   - B) Copies all files into a new folder called add-tubes
   - C) Switches to add-tubes, which must already exist
   - D) Creates a branch without switching to it

2. You commit while on add-tubes. Which branch moves?
   - A) Only add-tubes
   - B) Only main
   - C) Both main and add-tubes
   - D) Neither; branches never move

3. git switch main fails with "Your local changes … would be overwritten". What's a safe way forward?
   - A) Commit the changes or stash them, then switch
   - B) Delete the .git folder
   - C) Run git switch -f main
   - D) Rename the branch

4. Which command deletes a branch only if its work is already merged?
   - A) git branch -d name
   - B) git branch -D name
   - C) git switch -d name
   - D) git stash drop name

<details>
<summary>Quiz answers</summary>

1. **A) Creates a branch at the current commit and switches to it**: Creating a branch only writes a new name pointing at a commit; -c also switches to it.
2. **A) Only add-tubes**: The branch HEAD points to moves forward to the new commit; the others stay where they were.
3. **A) Commit the changes or stash them, then switch**: -f would throw your changes away. Commit them on the current branch, or stash them for a short while.
4. **A) git branch -d name**: -d refuses to delete unmerged work; -D deletes anyway.

</details>

---
Previous: [Lesson 6](06-inside-git.md) · Next: [Lesson 8: Merging and conflicts](08-merging.md)
