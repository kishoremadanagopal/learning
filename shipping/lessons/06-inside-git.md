# Lesson 6: How Git stores your work

**You'll learn:** what's in the .git folder (HEAD, config, objects, refs, index), the four object types (blob, tree, commit, annotated tag), content-addressed storage, hashes and the same content giving the same id, SHA-1 today and SHA-256 as the Git 3.0 default, snapshots rather than diffs, loose objects and packfiles, refs and HEAD as small text files, symbolic refs, git cat-file -t and -p, git rev-parse, rev:path and ^{tree}, why branches are cheap, why commits can't change and --amend makes a new one.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#inside-git)**: run every example and check your exercise answers.

## Key terms

- **Object:** a piece of data Git stores under its hash: a blob, tree, commit or tag.
- **Blob:** an object holding a file's contents (without its name).
- **Tree:** an object listing names, modes and the ids of blobs and other trees: a folder.
- **Content-addressed storage:** storing data under a name computed from the data itself, its hash.
- **Hash:** a fixed-length fingerprint of data; Git uses SHA-1 now, and SHA-256 in new repositories from Git 3.0.
- **Ref:** a name that points to a commit, such as `refs/heads/main`, stored as a small file.
- **Symbolic ref:** a ref that points to another ref; `HEAD` usually holds `ref: refs/heads/main`.
- **Packfile:** a compressed file holding many objects, with similar objects stored as deltas.

Git's commands make more sense once you know what they do to the data underneath, and the design is small enough to understand completely in one lesson.

## Inside .git

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
ls .git
cat .git/HEAD
cat .git/refs/heads/main
git rev-parse HEAD
```

- `.git/objects/` holds every version of every file, folder listing and commit.
- `.git/refs/heads/main` is a text file containing a commit id: that's all a branch is.
- `.git/HEAD` says which branch you're on: `ref: refs/heads/main`.
- `.git/index` is the staging area; `.git/config` holds the repository's settings.

On your own computer you'll also see `description`, `COMMIT_EDITMSG` (your last message) and `logs/` (the reflog). Git 3.0 plans to store refs in a single **reftable** database by default instead of one small file per branch; you can try it now with `git init --ref-format=reftable`. Either way, `git rev-parse main` always tells you where a branch points.

## Four kinds of objects

![A commit object (c4d5e6f) lists its tree, its parent commit, the author and the message. The tree lists the files: a blob for README.md and a blob for prices.txt. Each blob holds a file's content. Every object is stored under the SHA-1 hash of its content, so the same content always has the same name](../figures/git-objects.svg)

| Object | Holds |
|---|---|
| **blob** | the content of one file (no name, just the bytes) |
| **tree** | a folder: names, permissions, and the blobs and trees inside |
| **commit** | one tree (the whole project), parent commit(s), author, committer, date, message |
| **tag** | a named, annotated pointer to a commit (Part 2) |

`git cat-file -p` prints any object, so you can walk the structure yourself:

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
git cat-file -p HEAD
git cat-file -p HEAD^{tree}
git cat-file -p HEAD:prices.txt
git cat-file -t HEAD
```

## Content-addressed storage

Every object is stored under the **hash** of its content: a 40-character hexadecimal id computed with SHA-1. The same content always produces the same id, and any change, even one character, produces a completely different one. Consequences:

- **Identical files are stored once**, however many commits or folders contain them.
- **Commits can't change.** A commit's id covers its tree, its parent and its message, so changing anything gives a new commit. That's why `--amend` and `reset` "replace" commits rather than edit them, and why rewriting a shared commit changes every commit after it.
- **History is tamper-evident**: if someone altered an old file, every id after it would change.

Git is moving from SHA-1 to the stronger **SHA-256** for new repositories; Git 3.0 plans to make it the default. The ideas stay the same, with 64-character ids.

```bash
mkdir shop && cd shop && git init -q
echo "bell 800" > a.txt
echo "bell 800" > b.txt
git add . && git commit -qm "Two identical files"
git cat-file -p HEAD^{tree}
```

Both names point at the same blob.

## Snapshots, not diffs

Each commit records a complete snapshot of the project, not a list of changes; `git diff` and `git show` compute differences when you ask. Storing snapshots is cheap because unchanged files reuse the same blobs, and Git later compresses objects into **packfiles**, storing similar versions as deltas, so a repository with years of history is often smaller than you'd expect.

## Why branches are cheap

A branch is a 41-byte file with a commit id in it. Creating one doesn't copy anything; committing moves it forward by writing a new id into it. That's why teams create branches for every small piece of work, which is where Part 2 begins.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Which object is this? | git cat-file -t <id> | nothing | — |
| Show an object | git cat-file -p <id> (HEAD, HEAD^{tree}, HEAD:file) | nothing | — |
| Turn a name into an id | git rev-parse HEAD~1 | nothing | — |
| Where does a branch point? | cat .git/refs/heads/main | nothing | — |
| What is HEAD? | cat .git/HEAD | nothing | — |

## Common mistakes

- Editing files inside `.git` by hand; use Git commands.
- Thinking Git stores each commit as a diff; it stores full snapshots and reuses unchanged objects.
- Expecting `--amend` to change a commit in place; it makes a new commit with a new id.
- Thinking two files with the same contents take twice the space; they share one blob.

## Exercises

### 1. Follow the pointers

Without changing anything, save to `~/answer.txt` the **full id** (40 characters) of the **blob** that stores `prices.txt` as it was **two commits before** the latest one (`HEAD~2`).

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
git cat-file -p HEAD~2
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** commit → tree → blob, at a specific commit.
2. **Examples:** the latest commit only added `hours.txt`, so `prices.txt` has the same blob in `HEAD` and `HEAD~1`; in `HEAD~2` the pump still cost 3200, so its blob is different.
3. **Brute force:** copying ids by hand from `cat-file` output: works, error-prone.
4. **Pattern:** **follow the pointers, or name the path in the commit directly**.
5. **Plan:** cat-file the commit → its tree → find `prices.txt` → save the id.
6. **Code and test:** `git cat-file -p $(cat ~/answer.txt)`, on your own computer, prints the price list.

</details>

<details>
<summary>💡 Hint 1</summary>

`git cat-file -p HEAD~2` prints the commit, including the id of its `tree`. `git cat-file -p <tree id>` lists the files and their blob ids.

</details>

<details>
<summary>💡 Hint 2</summary>

`HEAD~2^{tree}` names that commit's tree directly, so `git cat-file -p HEAD~2^{tree}` saves a step.

</details>

<details>
<summary>💡 Hint 3</summary>

`git rev-parse HEAD~2:prices.txt` prints the blob id of a file in a commit; redirect it into `~/answer.txt`.

</details>

### 2. Where does main point?

Use the files in `.git` (not `git log`) to save the **full id of the commit `main` points to** into `~/main.txt`, and the **branch HEAD refers to** (the text after `ref: `, such as `refs/heads/main`) into `~/head.txt`.

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
ls .git
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a branch and HEAD are small text files.
2. **Examples:** `.git/HEAD` contains `ref: refs/heads/main`.
3. **Brute force:** `git log` and copying the top id: works, but the exercise is about seeing the files.
4. **Pattern:** **refs are files; HEAD is a reference to a ref**.
5. **Plan:** cat HEAD → cat the branch file → save both.
6. **Code and test:** compare with `git rev-parse main`.

</details>

<details>
<summary>💡 Hint 1</summary>

`cat .git/HEAD` shows which branch you're on; `cat .git/refs/heads/main` shows the commit that branch points to.

</details>

<details>
<summary>💡 Hint 2</summary>

Redirect the branch file straight into the answer: `cat .git/refs/heads/main > ~/main.txt`.

</details>

<details>
<summary>💡 Hint 3</summary>

For `~/head.txt`, write the part after `ref: `: either `echo refs/heads/main > ~/head.txt`, or remove the prefix with `sed 's/ref: //' .git/HEAD > ~/head.txt`.

</details>

**In the sandbox:** exercises 11–12. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Follow the pointers</summary>

```bash
git cat-file -p HEAD~2
git cat-file -p HEAD~2^{tree}
git rev-parse HEAD~2:prices.txt > ~/answer.txt
cat ~/answer.txt
```

**Line by line**

- `git cat-file -p HEAD~2` shows `tree <id>`, the snapshot of that commit.
- `git cat-file -p HEAD~2^{tree}` lists entries like `100644 blob 1a2b… prices.txt`.
- `git rev-parse HEAD~2:prices.txt` resolves the path inside the commit to the same blob id.

**Trace:** `HEAD~2` is "Add the bike lock"; its `prices.txt` is `bell 800`, `pump 3200`, `lock 2900`, a different blob from today's.

**Common wrong approach:** saving the commit id or the tree id instead: all three are 40-character hashes, so check the type with `git cat-file -t <id>`.

</details>

<details>
<summary>✅ 2. Where does main point?</summary>

```bash
cat .git/HEAD
cat .git/refs/heads/main
cat .git/refs/heads/main > ~/main.txt
sed 's/ref: //' .git/HEAD > ~/head.txt
cat ~/main.txt ~/head.txt
```

**Line by line**

- `.git/HEAD` holds `ref: refs/heads/main`: HEAD is a **symbolic reference** to the branch.
- `.git/refs/heads/main` holds the 40-character id of the newest commit on `main`.
- Committing writes a new id into that file; switching branches rewrites `.git/HEAD`.

**Trace:** `cat .git/refs/heads/main` and `git rev-parse main` print the same id.

**Common wrong approach:** writing the whole `ref: refs/heads/main` line into `~/head.txt`: the exercise asks for the part after `ref: `.

</details>

## Quick quiz

1. What is a branch, in Git's storage?
   - A) A small file containing the id of a commit
   - B) A copy of all the project's files
   - C) A folder in .git/objects

2. Two files in different folders have exactly the same content. How many blobs does Git store?
   - A) One, because blobs are named by their content's hash
   - B) Two, one per file
   - C) None, until they differ

3. Why does git commit --amend give the commit a new id?
   - A) The id is a hash of the commit's content, so any change makes a new commit
   - B) Git numbers commits in order
   - C) Amending also changes the parent

4. What does a commit object point to?
   - A) A tree (the project snapshot) and its parent commit(s)
   - B) A list of changed lines
   - C) The files in the working tree

<details>
<summary>Quiz answers</summary>

1. **A) A small file containing the id of a commit**: That's why creating a branch is instant.
2. **A) One, because blobs are named by their content's hash**: Identical content means an identical hash.
3. **A) The id is a hash of the commit's content, so any change makes a new commit**: Commits can't be edited, only replaced.
4. **A) A tree (the project snapshot) and its parent commit(s)**: Diffs are computed from snapshots when you ask for them.

</details>

---
Previous: [Lesson 5](05-undoing.md) · Back to the [course home](../README.md)
