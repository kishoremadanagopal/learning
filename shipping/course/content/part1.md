@@@ part
id: 1
title: Git basics
level: Beginner
blurb: Version control from zero: the terminal commands you need, creating a repository, the three areas (working tree, staging area, repository), making good commits, reading history and diffs, ignoring files and keeping secrets out, undoing mistakes safely, and what Git stores inside .git. Every command runs on a real Git engine in your browser.

@@@ lesson
id: version-control
title: Version control, Git and the terminal
minutes: 22
summary: What version control solves, Git and how it differs from GitHub, the terminal and how this course's sandbox runs commands, the handful of shell commands you need (pwd, ls, cd, mkdir, echo, cat, redirection, here-documents), installing Git on your own computer, and configuring your name, email and default branch.
---
Without version control, projects end up as `report_final_v2_REALLY_final.docx`, and nobody knows which copy is current, what changed between them, or how to get yesterday's version back. **Version control** records every change to a set of files: who made it, when, and why, so you can see the history, undo mistakes, and work with other people on the same files without overwriting each other.

**Git** is the version control system almost every team uses, for code, configuration, documentation, SQL and analysis notebooks alike. It was created in 2005 by Linus Torvalds to manage the Linux kernel. It's **distributed**: every copy of a project, on every laptop, has the full history, so you can work offline and nothing depends on a single server.

**GitHub** (and GitLab, Bitbucket and others) is a website that hosts Git repositories and adds collaboration around them: pull requests, code review, issues, and the automation you'll meet in Part 3. Git is the tool; GitHub is a place to share what Git records. This part teaches Git; Part 2 adds GitHub.

### The terminal

Git is used from a **terminal** (also called the command line or shell): you type a command, press Enter, and read its output. Editors and apps have Git buttons too, but every team's documentation, every CI system and every server speaks commands, and the buttons are easier once you know what they do.

A command is a program name followed by **arguments**, often with **options** that start with `-` or `--`:

```bash
ls -a ~/shop          # program: ls   option: -a   argument: ~/shop
git commit -m "Add README"
```

### This course's terminal

The sandbox on the right is a terminal that runs in your browser. Write commands in the editor, one per line, and press **Run**: each line runs in order, and the output shows every command (after its prompt, `~ $`) followed by what it printed.

- Each Run starts fresh, in your home folder `~` (`/home/learner`): nothing is kept between runs, so you can't break anything.
- Git is real: a full Git engine reads and writes real `.git` repositories inside the sandbox. A few interactive features (a text editor, `git add -p`) aren't available; the lessons show the non-interactive form.
- Some examples start from a prepared project, shown in the editor's title as **starts from: …**. On GitHub, each lesson lists the commands that create it.

```sh
pwd
mkdir shop
cd shop
pwd
echo "# Bike shop" > README.md
ls
cat README.md
```

### The commands you need

| Command | Does |
|---|---|
| `pwd` | print the folder you're in (the **working directory**) |
| `ls`, `ls -a`, `ls -l` | list files; `-a` includes hidden ones (names starting with `.`), `-l` shows details |
| `cd shop`, `cd ..`, `cd ~` | change folder: into `shop`, up one level, home |
| `mkdir docs`, `mkdir -p a/b/c` | make a folder (`-p`: with any missing parents) |
| `echo "text" > file` | write text to a file, **replacing** it |
| `echo "more" >> file` | **append** a line to a file |
| `cat file` | print a file |
| `touch file` | create an empty file |
| `mv old new`, `cp a b`, `rm file`, `rm -r dir` | move or rename, copy, delete (no recycle bin!) |
| `tree` | show a folder's files as a tree |

`>` and `>>` are **redirection**: they send a command's output into a file instead of the screen. For a file with several lines, a **here-document** feeds everything up to a closing word into the command:

```sh
mkdir -p shop/docs
cd shop
cat > docs/opening-hours.txt <<'EOF'
Monday to Friday: 9 to 6
Saturday: 9 to 5
Sunday: closed
EOF
cat docs/opening-hours.txt
echo "Bank holidays: 10 to 4" >> docs/opening-hours.txt
cat docs/opening-hours.txt
tree
```

The quotes in `<<'EOF'` mean "take the text exactly as written". On your own computer you'll usually edit files in an editor such as VS Code; in the sandbox, `echo`, here-documents and `sed -i 's/old/new/' file` do the editing.

### Setting up Git

Git records an author name and email with every commit, so set them once:

```sh
git --version
git config --global user.name "Ada Lovelace"
git config --global user.email "ada@example.com"
git config --global init.defaultBranch main
git config --list
```

- `--global` settings apply to every repository on your computer (they're saved in `~/.gitconfig`); the same command without `--global`, inside a repository, overrides them there, for example a work email for work projects.
- `init.defaultBranch main` names the first branch of new repositories `main`, which GitHub and most teams use. Git 2 still defaults to `master` without it; the coming Git 3.0 (no release date yet) switches the default to `main`.
- Use the email of your GitHub account (or GitHub's private `…@users.noreply.github.com` address) so your commits are linked to you.

The sandbox comes with Ada's settings already made, so commits work straight away; change them to yours if you like.

### Try it on your own computer

1. **Install Git.**
   - **Windows:** download Git for Windows from [git-scm.com/downloads/win](https://git-scm.com/downloads/win) and run the installer (the default options are fine). It includes **Git Bash**, a terminal where every command in this course works.
   - **macOS:** open Terminal and run `git --version`; if Git isn't installed, macOS offers to install the Command Line Developer Tools. Or install [Homebrew](https://brew.sh) and run `brew install git` for the newest version.
   - **Linux:** `sudo apt install git` (Debian, Ubuntu) or `sudo dnf install git` (Fedora).
2. Open a terminal (Git Bash on Windows) and check: `git --version`.
3. Run the three `git config --global` commands above with your own name and email.
4. Optional: make your editor Git's editor, for example `git config --global core.editor "code --wait"` for VS Code.

:::exercise Set up a project folder
In your home folder, create this project:

- a folder `shop` containing `README.md` with exactly one line: `# Bike shop`
- inside it, a folder `docs` containing `notes.txt` with exactly two lines: `Order more inner tubes` and `Call the bell supplier`
```sh starter
# Create the folders and files here.
```
```js check
if (!isDir("~/shop")) throw new AssertionError("There's no folder ~/shop yet (mkdir shop).");
if (!exists("~/shop/README.md")) throw new AssertionError("~/shop/README.md doesn't exist yet.");
same(read("~/shop/README.md"), "# Bike shop\n", "The content of ~/shop/README.md");
if (!isDir("~/shop/docs")) throw new AssertionError("There's no folder ~/shop/docs yet.");
if (!exists("~/shop/docs/notes.txt")) throw new AssertionError("~/shop/docs/notes.txt doesn't exist yet.");
same(read("~/shop/docs/notes.txt"), "Order more inner tubes\nCall the bell supplier\n", "The content of ~/shop/docs/notes.txt");
```
```sh solution
mkdir -p shop/docs
cd shop
echo "# Bike shop" > README.md
echo "Order more inner tubes" > docs/notes.txt
echo "Call the bell supplier" >> docs/notes.txt
cat docs/notes.txt
```
hint: `mkdir -p shop/docs` creates both folders at once. Then `cd shop`.
hint: `echo "# Bike shop" > README.md` writes the first file. The quotes matter: without them, `#` would start a comment.
hint: For two lines, use `>` for the first line and `>>` for the second (or a here-document). Check with `cat docs/notes.txt`.
approach:
1. **Understand:** two folders, two files, exact contents.
2. **Examples:** `>` replaces a file; `>>` adds to its end.
3. **Brute force:** `mkdir shop`, `mkdir shop/docs`, then one command per line of text. Fine!
4. **Pattern:** **create folders, then write files with redirection**.
5. **Plan:** mkdir -p → cd → echo > → echo > → echo >>.
6. **Code and test:** finish with `cat` and `ls -a` to see what you made.
walkthrough:
**Line by line**

- `mkdir -p shop/docs` makes `shop` and `docs` inside it in one go.
- `cd shop` moves into the project, so the following paths are relative to it.
- `echo "# Bike shop" > README.md` writes one line (echo adds the line break at the end).
- The first `echo … > docs/notes.txt` creates the file with line one; `>>` appends line two.

**Trace:** after the commands, `cat docs/notes.txt` prints both lines in order.

**Common wrong approach:** using `>` for both lines: the second `>` replaces the file, leaving only "Call the bell supplier".
:::

:::exercise Configure Git
Set your Git identity globally to the name `Grace Hopper` and the email `grace@example.com`, and make sure new repositories start on a branch called `main`. Then print the name back with `git config user.name`.
```sh starter
# Configure Git here.
```
```js check
same(globalConfig("user.name"), "Grace Hopper", "Your global user.name");
same(globalConfig("user.email"), "grace@example.com", "Your global user.email");
same(globalConfig("init.defaultBranch"), "main", "Your global init.defaultBranch");
if (!ran(/git config --global init\.defaultBranch\s+["']?main/)) throw new AssertionError("Set the default branch too: git config --global init.defaultBranch main (the sandbox already uses main, but your own computer may not).");
if (!ran(/git config (--global )?user\.name\s*$/) && !ran(/git config --get user\.name/)) throw new AssertionError("Print the name back with git config user.name.");
if (!printed("Grace Hopper")) throw new AssertionError("git config user.name should print Grace Hopper.");
```
```sh solution
git config --global user.name "Grace Hopper"
git config --global user.email "grace@example.com"
git config --global init.defaultBranch main
git config user.name
```
hint: The command is `git config --global <key> <value>`; the keys are `user.name`, `user.email` and `init.defaultBranch`.
hint: Put values with spaces in quotes: `"Grace Hopper"`. Without them, Git would get two separate arguments.
hint: Leave out the value to read a setting: `git config user.name`.
approach:
1. **Understand:** three global settings, then read one back.
2. **Examples:** `git config --global user.email "grace@example.com"`.
3. **Brute force:** editing `~/.gitconfig` by hand works on your computer, but the command is safer.
4. **Pattern:** **set with a value, read without one**.
5. **Plan:** name → email → defaultBranch → print name.
6. **Code and test:** `git config --list` shows everything.
walkthrough:
**Line by line**

- `--global` stores the settings for your user account, so every repository uses them.
- Quoting `"Grace Hopper"` passes the name as one argument.
- `init.defaultBranch main` only affects repositories created from now on.
- `git config user.name` (no value) prints the current setting.

**Trace:** the sandbox started with Ada's identity; after these commands, commits would be credited to Grace.

**Common wrong approach:** `git config user.name Grace Hopper` without quotes: Git sees `Grace` as the value and `Hopper` as an extra argument, and reports an error.
:::

:::quiz
? What's the difference between Git and GitHub?
+ Git records the history of files; GitHub is a website that hosts Git repositories and adds collaboration tools
- They're two names for the same program
- GitHub is the newer version of Git
= You can use Git with no GitHub at all, or with GitLab or Bitbucket instead.
? What does echo "lock 2900" >> prices.txt do?
+ Adds the line to the end of prices.txt
- Replaces prices.txt with that line
- Prints the line and prices.txt
= > replaces a file; >> appends to it.
? What does "distributed" mean for Git?
+ Every copy of a repository contains the full history
- The files are split across several servers
- Only one person can work on a file at a time
= You can commit, browse history and branch without any network.
? Why set user.email to the email of your GitHub account?
+ So GitHub links your commits to your account
- Git refuses to work otherwise
- GitHub sends you an email for every commit
= The email in each commit is how hosting sites know who made it.
:::

@@@ lesson
id: first-commits
title: Your first repository and commits
minutes: 24
summary: Creating a repository with git init, the working tree, staging area and repository, git status, staging with git add, committing with git commit -m, viewing history with git log, what a commit is (a snapshot with an id, author, date, message and parent), committing only some changes, git commit -a, and writing good commit messages.
---
A **repository** (repo) is a project folder whose history Git tracks. `git init` turns a folder into one by creating a hidden `.git` folder, where Git keeps everything it records.

```sh
mkdir shop
cd shop
git init
ls -a
git status
```

### The three areas

Git separates your work into three places, and most commands move changes between them:

![Three boxes: the working tree (the files you edit, such as README.md, a changed prices.txt and a new notes.txt), the staging area or index (what the next commit will contain: README.md and the changed prices.txt), and the repository in .git (every commit, forever). git add copies changes from the working tree to the staging area; git commit records the staging area as a new commit in the repository. git restore and git switch copy files back from the repository](figures/three-areas.svg)

| Area | What it is |
|---|---|
| **working tree** | the files in the folder, as you see and edit them |
| **staging area** (also called the **index**) | the next commit, being assembled: changes you've chosen with `git add` |
| **repository** | the `.git` folder: every commit ever made |

The staging area lets you choose what goes into each commit. You might change five files but commit two of them now, as one meaningful step, and the rest later.

### add, commit, log

```sh
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

### What a commit is

A commit is a **snapshot** of the whole project at one moment, plus:

- a unique **id** (a **hash**) such as `7c3a1f9…`, usually shortened to 7 characters;
- the **author** and **date**;
- the **message** explaining the change;
- a pointer to its **parent**, the commit before it.

![Three commits in a row, 9f8e7d6 Add README, a1b2c3d Add prices and c4d5e6f Add the lock, each pointing back to its parent. A label main points at the newest commit, and HEAD points at main: a branch is a name pointing at a commit, and HEAD is the branch you're on](figures/commit-chain.svg)

**`main`** is a **branch**: a name that points at the newest commit and moves forward with every new commit. **HEAD** means "where you are now", normally the current branch. Part 2 is all about branches.

### Committing only some changes

```sh setup=shop-work-in-progress
git status
git add prices.txt
git commit -m "Add inner tubes to the price list"
git status
git log --oneline
```

Here `hours.txt` was already staged, so the commit contained both staged files: the staging area holds **everything** you've added since the last commit, not just your latest `git add`. Check `git status` before committing. `ideas.txt` stays untracked until you add it.

`git commit -a -m "…"` (or `-am`) stages every change to **tracked** files and commits in one step. It's handy, but skips new files, and makes it easy to commit something you didn't mean to.

### Good commit messages

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

### Try it on your own computer

Make a folder, `git init`, create a file in your editor, then `git add` and `git commit -m "…"`. Run `git status` between every step. Without `-m`, Git opens your configured editor for the message: write it, save, and close the editor.

:::exercise Make two commits
Create a repository in a new folder `~/shop` and make two commits, in this order:

1. `README.md` containing `# Bike shop`, with the message `Add README`;
2. `prices.txt` containing the two lines `bell 800` and `pump 3200`, with the message `Add price list`.

Finish with a clean working tree.
```sh starter
# Your commands here.
```
```js check
const r = await repo("~/shop");
const log = await r.log();
same(log.map((c) => c.subject), ["Add price list", "Add README"], "The commit messages, newest first");
same(await r.files("HEAD~1"), { "README.md": "# Bike shop\n" }, "The files in the first commit");
same(await r.files("HEAD"), { "README.md": "# Bike shop\n", "prices.txt": "bell 800\npump 3200\n" }, "The files in the second commit");
if (!(await r.status()).clean) throw new AssertionError("The working tree should be clean (everything committed): run git status.");
```
```sh solution
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
hint: Start with `mkdir shop`, `cd shop` and `git init`.
hint: Each commit is "write the file, `git add` it, `git commit -m "…"`". Make the README commit before creating `prices.txt`.
hint: For the two-line file, use `echo … >` and `echo … >>`, or `printf "bell 800\npump 3200\n" > prices.txt`. Check with `git log --oneline` and `git status`.
approach:
1. **Understand:** two snapshots: the first with one file, the second with both.
2. **Examples:** if you create both files and then commit twice, the first commit could contain both.
3. **Brute force:** `git add .` then one commit: one commit, not two.
4. **Pattern:** **edit → add → commit**, repeated per logical change.
5. **Plan:** init → README → add → commit → prices → add → commit.
6. **Code and test:** `git log --oneline` shows two commits; `git status` says the tree is clean.
walkthrough:
**Line by line**

- `git init` creates the repository; until the first commit, `git log` has nothing to show.
- Staging and committing `README.md` alone makes the first snapshot contain only it.
- `printf` writes both lines in one command (`\n` is a line break).
- The second commit's snapshot includes both files: commits are full snapshots, not just the latest change.

**Trace:** `git log --oneline` → `… Add price list` above `… Add README`.

**Common wrong approach:** forgetting `git add` before the second commit: Git answers "nothing added to commit but untracked files present", and no commit is made.
:::

:::exercise Commit only what's ready
In this repository, `hours.txt` is already staged (new opening hours), `prices.txt` has an unstaged change (inner tubes added) and `ideas.txt` is new. Make **one** commit with the message `Add inner tubes to the price list` that contains **only** the `prices.txt` change. Leave the opening-hours change and `ideas.txt` out of the commit, but keep both in the folder.
```sh starter setup=shop-work-in-progress
git status
```
```js check
const r = await repo("~/shop");
const log = await r.log();
same(log.map((c) => c.subject), ["Add inner tubes to the price list", "Start the shop"], "The commit messages, newest first");
const files = await r.files("HEAD");
same(files["prices.txt"], "bell 800\npump 3000\nlock 2900\ntube 600\n", "prices.txt in your commit");
same(files["hours.txt"], "Open 9 to 5, Monday to Saturday.\n", "hours.txt in your commit (the new hours shouldn't be committed yet)");
if ("ideas.txt" in files) throw new AssertionError("ideas.txt shouldn't be in the commit.");
same(r.read("hours.txt"), "Open 9 to 6, Monday to Saturday.\n", "hours.txt in the working tree (keep the change)");
if (!r.exists("ideas.txt")) throw new AssertionError("Keep ideas.txt in the folder.");
```
```sh solution setup=shop-work-in-progress
git status
git restore --staged hours.txt
git add prices.txt
git commit -m "Add inner tubes to the price list"
git status
```
hint: Read `git status` first: it lists "Changes to be committed" (staged) separately from "Changes not staged for commit".
hint: The staged `hours.txt` would go into the commit too. `git restore --staged hours.txt` takes it out of the staging area without touching the file (`git status` even suggests this command).
hint: Then `git add prices.txt` and commit. Check with `git show --stat` that only `prices.txt` changed.
approach:
1. **Understand:** a commit takes the whole staging area, so the staging area must contain exactly the price change.
2. **Examples:** committing now, after `git add prices.txt`, would include `hours.txt` as well.
3. **Brute force:** commit everything, then try to split it afterwards: much harder.
4. **Pattern:** **shape the staging area, then commit**.
5. **Plan:** status → unstage hours → stage prices → commit → status.
6. **Code and test:** `git show --stat` lists only `prices.txt`.
walkthrough:
**Line by line**

- `git status` shows `hours.txt` under "Changes to be committed": it was added earlier.
- `git restore --staged hours.txt` removes that change from the staging area; the file on disk keeps the new hours.
- `git add prices.txt` stages the price change.
- The commit contains exactly what's staged: the price change.

**Trace:** after the commit, `git status` shows `hours.txt` as modified (not staged) and `ideas.txt` as untracked.

**Common wrong approach:** `git commit -am "…"`: it stages and commits every tracked change, including the hours.
:::

:::quiz
? Which area holds the changes your next commit will contain?
+ The staging area (index)
- The working tree
- The .git/objects folder
= git add puts changes there; git commit records them.
? You run git add a.txt, then edit a.txt again, then git commit. What's committed?
+ The version of a.txt from when you ran git add
- The latest version on disk
- Nothing, because the file changed
= git add stages a snapshot of the file; stage again to include later edits.
? Which is the best commit summary line?
+ Fix total when the cart is empty
- fixed it
- Changes
= Imperative, specific and short: it says what the commit does.
? What does git commit -am "message" skip?
+ New (untracked) files
- Changed files
- Deleted tracked files
= -a stages changes to files Git already tracks; new files need git add.
:::

@@@ lesson
id: seeing-changes
title: "Seeing changes: status, diff, log and show"
minutes: 24
summary: Short status codes, git diff for unstaged and staged changes and between commits, reading a unified diff and its hunk headers, git log options (--oneline, -n, --stat, -p, a file path, --format), naming commits with HEAD~n, git show for a commit or a file at a commit, and investigating when and why something changed.
---
Before committing, and whenever you need to understand a project, you'll ask Git three questions: **what's changed?** (`status`, `diff`), **what happened?** (`log`), and **what exactly did this commit do?** (`show`).

### Short status

`git status -s` gives one line per file, with two columns: the **left** is the staging area, the **right** is the working tree.

```sh setup=shop-work-in-progress
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

### git diff

`git diff` shows changes that **aren't staged yet**; `git diff --staged` shows what **is** staged, the content of your next commit:

```sh setup=shop-work-in-progress
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

### git log

```sh setup=shop-history
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

### Naming commits

You can name a commit by its id (the first 7 characters are enough) or relative to HEAD:

| Name | Commit |
|---|---|
| `HEAD` | the current commit |
| `HEAD~1` (or `HEAD^`) | its parent |
| `HEAD~3` | three commits back |
| `main`, `v1.0` | what a branch or tag points to |

### git show

`git show` prints a commit with its diff; `git show <commit>:<file>` prints a file as it was in that commit:

```sh setup=shop-history
git show HEAD~1
git show HEAD~3:prices.txt
git diff HEAD~3 HEAD -- prices.txt
```

`git diff A B` compares two commits; adding `-- <file>` limits it to one file.

### Investigating a change

A typical question: "when did the pump price change, and why?" Narrow down with the file, then read the commit:

```sh setup=shop-history
git log --oneline -p prices.txt
```

`git log -p <file>` shows every change to a file with its commit, and the message says why. (On your own computer, `git blame prices.txt` shows the last commit for each line, and `git log -S "3000"` finds commits that added or removed a piece of text.)

### Try it on your own computer

Git shows long output in a **pager**: scroll with the arrow keys or space, and press `q` to quit. Run `git config --global core.pager cat` if you'd rather not use one. Editors show the same information visually: in VS Code, the Source Control panel shows diffs side by side, and the Timeline view shows a file's history.

:::exercise Investigate the history
In this repository, find the commit that **lowered the pump price**, and save its **short id** (the 7 characters `git log --oneline` shows) to the file `~/answer.txt`, on its own line. Use Git commands to find it; you can write the file with `echo`.
```sh starter setup=shop-history
git log --oneline
```
```js check
const r = await repo("~/shop");
const target = (await r.resolve("HEAD~1")).slice(0, 7);
if (!exists("~/answer.txt")) throw new AssertionError("Write the short id to ~/answer.txt (for example: echo abc1234 > ~/answer.txt).");
const answer = read("~/answer.txt").trim();
if (answer.length < 7 || !target.startsWith(answer.slice(0, 7))) {
  throw new AssertionError(`~/answer.txt contains ${JSON.stringify(answer)}, which isn't the commit that lowered the pump price. Look at git log -p prices.txt.`);
}
```
```sh solution setup=shop-history
git log --oneline prices.txt
git show HEAD~1 --stat
git log --oneline -1 HEAD~1
git rev-parse --short HEAD~1 > ~/answer.txt
cat ~/answer.txt
```
hint: `git log --oneline` lists the commits; one of the messages describes the price change. To be sure, check its diff with `git show <id>`.
hint: `git log -p prices.txt` shows every change to the price list; look for `-pump 3200` and `+pump 3000`.
hint: Write the id with `echo abc1234 > ~/answer.txt` (your id, not abc1234), or let Git do it: `git rev-parse --short <commit> > ~/answer.txt`.
approach:
1. **Understand:** find one commit by what it changed, then save its id.
2. **Examples:** the summary "Lower the pump price" suggests it, and the diff proves it.
3. **Brute force:** `git show` every commit one by one: works for five commits, not for five thousand.
4. **Pattern:** **filter the log by file, then read the diff**.
5. **Plan:** `git log -p prices.txt` → spot the pump line → save the id.
6. **Code and test:** `cat ~/answer.txt`.
walkthrough:
**Line by line**

- `git log --oneline prices.txt` lists only the commits that touched the price list: three of the five.
- `git show <id>` (or `-p` in the log) confirms which one changed `pump 3200` to `pump 3000`.
- `git rev-parse --short HEAD~1` prints that commit's short id; `>` saves it. Typing the id with `echo` works just as well.

**Trace:** the commits are Add README, Add price list, Add the bike lock, Lower the pump price, Add opening hours: the pump change is the second newest, `HEAD~1`.

**Common wrong approach:** saving the newest commit's id because it's at the top of the log: the newest commit added opening hours.
:::

:::exercise What's about to be committed?
Before committing, a teammate wants two lists. Save the **names of the files with staged changes** to `~/staged.txt`, and the **names of the files with unstaged changes** to `~/unstaged.txt`, one name per line, using `git diff`. Don't stage, unstage or commit anything.
```sh starter setup=shop-work-in-progress
git status
```
```js check
if (!exists("~/staged.txt") || !exists("~/unstaged.txt")) throw new AssertionError("Create both ~/staged.txt and ~/unstaged.txt.");
same(read("~/staged.txt"), "hours.txt\n", "~/staged.txt");
same(read("~/unstaged.txt"), "prices.txt\n", "~/unstaged.txt");
const r = await repo("~/shop");
same(await r.status(), { staged: ["hours.txt"], modified: ["prices.txt"], untracked: ["ideas.txt"], clean: false }, "The repository's status (it shouldn't change)");
if (!ran(/git diff/)) throw new AssertionError("Use git diff to produce the lists.");
```
```sh solution setup=shop-work-in-progress
git diff --staged --name-only > ~/staged.txt
git diff --name-only > ~/unstaged.txt
cat ~/staged.txt ~/unstaged.txt
git status -s
```
hint: `git diff` compares the working tree with the staging area (unstaged changes); `git diff --staged` compares the staging area with the last commit (staged changes).
hint: `--name-only` prints just the file names instead of the full diff.
hint: Redirect each command's output into a file: `git diff --staged --name-only > ~/staged.txt`.
approach:
1. **Understand:** two diffs, names only, saved to files.
2. **Examples:** `ideas.txt` is untracked, so neither diff includes it.
3. **Brute force:** copying names from `git status` by hand: error-prone, and not what a script would do.
4. **Pattern:** **choose the right comparison, format it, redirect it**.
5. **Plan:** `git diff --staged --name-only > …` and `git diff --name-only > …`.
6. **Code and test:** `cat` both files; `git status -s` should be unchanged.
walkthrough:
**Line by line**

- `git diff --staged --name-only` lists files whose staged version differs from the last commit: `hours.txt`.
- `git diff --name-only` lists files whose working-tree version differs from the staging area: `prices.txt`.
- Untracked files aren't in either list: Git doesn't compare files it isn't tracking.
- `>` saves each list; nothing in the repository changes.

**Trace:** `git status -s` shows `M  hours.txt`, ` M prices.txt`, `?? ideas.txt`: the left column matches the staged list, the right column the unstaged one.

**Common wrong approach:** `git diff --cached` vs `--staged` confusion: they're the same option. The real trap is using plain `git diff` for both, which never shows staged changes.
:::

:::quiz
? What does git diff show with no options?
+ Changes in the working tree that aren't staged yet
- Changes in the last commit
- Everything that differs from the remote
= Use git diff --staged for what will be committed.
? In git status -s, what does "M " (M then a space) mean?
+ Modified and staged; no further unstaged changes
- Modified but not staged
- Merged
= Left column: staging area; right column: working tree.
? What is HEAD~2?
+ The commit two before the current one
- The second branch
- The current commit, twice
= ~n walks back n parents.
? Which command shows prices.txt as it was in the commit before last?
+ git show HEAD~2:prices.txt
- git log prices.txt
- git diff prices.txt
= commit:path prints a file from any commit.
:::

@@@ lesson
id: ignoring-files
title: .gitignore and what never to commit
minutes: 22
summary: What shouldn't be in a repository (dependencies, build output, logs, local settings, secrets, large data), .gitignore patterns and negation, git check-ignore, untracking a committed file with git rm --cached, why a committed secret must be rotated, secret scanning and push protection, and large files with Git LFS.
---
Some files should never be committed: they're generated, personal, huge, or secret. Committing them bloats the repository, causes pointless conflicts, and in the case of secrets, can be a security incident.

| Don't commit | Examples | Why |
|---|---|---|
| dependencies | `node_modules/`, `.venv/`, `vendor/` | huge, and recreated from `package.json` or `requirements.txt` |
| build output | `dist/`, `build/`, `*.pyc`, `__pycache__/` | generated from the source |
| logs and temporary files | `*.log`, `*.tmp` | change constantly |
| personal and OS files | `.DS_Store`, `Thumbs.db`, `.idea/`, `.vscode/` (usually) | belong to one person's computer |
| secrets | `.env`, `*.pem`, credentials files | anyone with the repository could use them |
| large data and models | `*.csv` exports, `*.parquet`, model weights | Git keeps every version forever |

### .gitignore

A `.gitignore` file in the repository lists patterns of files Git should ignore. Ignored files don't appear in `git status`, and `git add .` skips them:

```sh
mkdir -p shop/node_modules/express shop/dist shop/src && cd shop && git init -q
echo "app" > src/app.js && echo "lib" > node_modules/express/index.js
echo "bundle" > dist/app.js && echo "boom" > error.log && echo "KEY=123" > .env
git status
cat > .gitignore <<'EOF'
# dependencies and build output
node_modules/
dist/
# logs
*.log
# secrets
.env
EOF
git status
git check-ignore -v error.log
```

| Pattern | Ignores |
|---|---|
| `*.log` | every file ending in `.log`, in any folder |
| `node_modules/` | folders called `node_modules`, anywhere |
| `/build` | `build` only at the top of the repository |
| `docs/*.pdf` | PDFs directly in `docs` |
| `**/temp` | `temp` in any folder |
| `!keep.log` | **not** `keep.log`, even though `*.log` matches it |
| `# …` | a comment |

- Commit `.gitignore` itself, so the whole team ignores the same files.
- `git check-ignore -v <file>` tells you which line ignores a file, which helps when something unexpectedly doesn't show up.
- GitHub keeps ready-made templates for most languages and tools at [github.com/github/gitignore](https://github.com/github/gitignore), and offers one when you create a repository.
- Files only **your** computer creates, like `.DS_Store` on macOS, belong in a **global** ignore file (`git config --global core.excludesFile ~/.gitignore_global`), not in every project.

### Already committed? Untrack it

`.gitignore` only affects untracked files. A file that's already committed stays tracked; to stop tracking it but keep it on disk, remove it from the index:

```sh
mkdir shop && cd shop && git init -q
echo "DB_PASSWORD=hunter2" > .env && echo "app" > app.js
git add . && git commit -qm "Start the app"
echo ".env" >> .gitignore
git rm --cached .env
git add .gitignore
git commit -m "Stop tracking .env"
git status
ls -a
git log --oneline
git show HEAD~1:.env
```

The last command is the important lesson: **the secret is still in the history**. Anyone with a copy of the repository can read it from the earlier commit. So:

1. **Treat a committed secret as leaked: revoke or rotate it** (create a new key, disable the old one). This is the only real fix.
2. Optionally rewrite history to remove it (with a tool such as `git filter-repo`), which every copy of the repository must then accept; Part 2 explains why rewriting shared history is disruptive.
3. Prevent it next time: `.env` in `.gitignore` from the start, an `.env.example` file with dummy values for teammates, and secret scanning.

GitHub's **secret scanning** and **push protection** detect many kinds of keys (cloud providers, payment services, LLM APIs) and can block a push that contains one. Turn them on.

### Large files

Git stores every version of every file, so a 200 MB dataset committed ten times costs 2 GB in every copy. Keep large data in storage built for it (a database, object storage such as S3, a data catalogue) and commit the code that reads it. When large binary files must live with the code (images for a game, model files), **Git LFS** (Large File Storage) keeps them on a server and only small pointer files in the repository. For data scientists: tools such as **nbstripout** remove outputs from Jupyter notebooks before committing, so diffs show code changes, not megabytes of plots.

### Try it on your own computer

When you start a project, create `.gitignore` before the first commit; GitHub's "Add .gitignore" template menu, or the `github/gitignore` repository, gives you a sensible start. Turn on secret scanning and push protection in your GitHub repository's settings, under **Advanced Security**.

:::exercise Write a .gitignore
This project has dependencies, build output, logs and a secrets file lying around. Create a `.gitignore` so that `git status` shows only the files that belong in the repository. Ignore:

- the `node_modules/` and `dist/` folders;
- the `.env` file;
- every `.log` file **except** `keep.log`.

Don't commit anything.
```sh starter
mkdir -p shop/node_modules/express shop/dist shop/src && cd shop && git init -q
echo "app" > src/app.js && echo "lib" > node_modules/express/index.js && echo "bundle" > dist/app.js
echo "KEY=123" > .env && echo "boom" > error.log && echo "debug" > src/debug.log && echo "keep me" > keep.log
echo "# Bike shop" > README.md
git status
```
```js check
const r = await repo("~/shop");
if (!r.exists(".gitignore")) throw new AssertionError("Create ~/shop/.gitignore.");
const st = await r.status();
same(st.untracked, [".gitignore", "README.md", "keep.log", "src/app.js"], "The untracked files git status reports (everything else should be ignored)");
for (const p of ["node_modules/express/index.js", "dist/app.js", ".env", "error.log", "src/debug.log"]) {
  if (!(await r.ignored(p))) throw new AssertionError(`${p} should be ignored.`);
}
if (await r.ignored("keep.log")) throw new AssertionError("keep.log shouldn't be ignored (use a ! pattern).");
if ((await r.log()).length) throw new AssertionError("Don't commit anything in this exercise.");
```
```sh solution
mkdir -p shop/node_modules/express shop/dist shop/src && cd shop && git init -q
echo "app" > src/app.js && echo "lib" > node_modules/express/index.js && echo "bundle" > dist/app.js
echo "KEY=123" > .env && echo "boom" > error.log && echo "debug" > src/debug.log && echo "keep me" > keep.log
echo "# Bike shop" > README.md
cat > .gitignore <<'EOF'
node_modules/
dist/
.env
*.log
!keep.log
EOF
git status
git check-ignore -v src/debug.log
```
hint: Write the file with a here-document: `cat > .gitignore <<'EOF'`, one pattern per line, then a line with just `EOF`.
hint: A trailing `/` matches folders (`node_modules/`), and `*.log` matches `.log` files in every folder, including `src/debug.log`.
hint: A line starting with `!` re-includes a file a previous pattern ignored: `!keep.log` after `*.log`. Check with `git status` and `git check-ignore -v <file>`.
approach:
1. **Understand:** four rules, one exception, and nothing committed.
2. **Examples:** `src/debug.log` must be ignored too; `keep.log` must stay visible.
3. **Brute force:** listing every file by name: misses the next log file anyone creates.
4. **Pattern:** **patterns for kinds of files, then an exception with `!`**.
5. **Plan:** folders → `.env` → `*.log` → `!keep.log` → check with `git status`.
6. **Code and test:** `git status` should list `.gitignore`, `README.md`, `keep.log` and `src/`.
walkthrough:
**Line by line**

- `node_modules/` and `dist/` ignore those folders and everything inside them.
- `.env` ignores the secrets file wherever it is.
- `*.log` has no `/`, so it matches log files in every folder: `error.log` and `src/debug.log`.
- `!keep.log` comes after `*.log`, so it wins for that one file: order matters, later lines override earlier ones.

**Trace:** `git status` lists `.gitignore`, `README.md`, `keep.log` and `src/` (which contains only `app.js` now that `debug.log` is ignored).

**Common wrong approach:** putting `!keep.log` before `*.log`: the later `*.log` line ignores it again.
:::

:::exercise Stop tracking a secret
Someone committed `.env` (with a password) to this repository. Stop tracking it **without deleting it from disk**, make sure it can't be added again by accident, and commit the fix with the message `Stop tracking .env`. Afterwards the working tree should be clean.
```sh starter
mkdir shop && cd shop && git init -q
echo "app" > app.js && echo "DB_PASSWORD=hunter2" > .env
git add . && git commit -qm "Start the app"
git status
```
```js check
const r = await repo("~/shop");
const log = await r.log();
same(log.map((c) => c.subject), ["Stop tracking .env", "Start the app"], "The commit messages, newest first");
const files = await r.files("HEAD");
if (".env" in files) throw new AssertionError(".env is still in the latest commit: remove it from the index with git rm --cached.");
if (!files[".gitignore"] || !/^\.env\s*$/m.test(files[".gitignore"])) throw new AssertionError("Commit a .gitignore that contains .env.");
if (!r.exists(".env")) throw new AssertionError(".env was deleted from disk: use git rm --cached, which only untracks it.");
same(r.read(".env"), "DB_PASSWORD=hunter2\n", ".env on disk");
if (!(await r.ignored(".env"))) throw new AssertionError(".env should now be ignored.");
if (!(await r.status()).clean) throw new AssertionError("The working tree should be clean afterwards.");
```
```sh solution
mkdir shop && cd shop && git init -q
echo "app" > app.js && echo "DB_PASSWORD=hunter2" > .env
git add . && git commit -qm "Start the app"
echo ".env" >> .gitignore
git rm --cached .env
git add .gitignore
git commit -m "Stop tracking .env"
git status
ls -a
```
hint: Two things: ignore it (`.env` in `.gitignore`) and untrack it (`git rm --cached .env`), which removes it from the index but leaves the file.
hint: `git rm --cached` stages the removal; stage the new `.gitignore` too, then commit both together.
hint: Check with `git status` (clean) and `ls -a` (`.env` still there). In real life, also change the password: it's still in the first commit.
approach:
1. **Understand:** untrack, ignore, keep the file, one commit.
2. **Examples:** adding `.env` to `.gitignore` alone does nothing for a file that's already tracked.
3. **Brute force:** `git rm .env`: deletes the file from disk too.
4. **Pattern:** **`git rm --cached` + `.gitignore`**.
5. **Plan:** append `.env` to `.gitignore` → `git rm --cached .env` → `git add .gitignore` → commit.
6. **Code and test:** `git status` clean; `ls -a` shows `.env`; `git show HEAD --stat` shows the removal.
walkthrough:
**Line by line**

- `echo ".env" >> .gitignore` creates the ignore file with one pattern.
- `git rm --cached .env` stages "delete `.env` from the repository" while leaving the file in the folder.
- `git add .gitignore` stages the new ignore file, so both changes land in one commit.
- After the commit, `.env` is untracked and ignored, so `git status` is clean.

**Trace:** `git show --stat` → `.env | 1 -` and `.gitignore | 1 +`.

**Common wrong approach:** stopping here and keeping the password: it's still in "Start the app", readable with `git show HEAD~1:.env`. Rotate it.
:::

:::quiz
? You add *.log to .gitignore, but app.log, committed last week, still shows changes. Why?
+ .gitignore only affects untracked files; untrack it with git rm --cached app.log
- .gitignore needs a restart of Git
- The pattern should be **.log
= Tracked files stay tracked until you remove them from the index.
? A teammate committed an API key, then removed it in the next commit. What must happen?
+ Revoke or rotate the key: it's still readable in the history
- Nothing, it's been deleted
- Delete the repository's latest commit
= Treat any committed secret as leaked.
? What does the pattern !keep.log do after *.log?
+ Keeps keep.log visible to Git even though *.log matches it
- Ignores only keep.log
- Deletes keep.log
= ! re-includes files an earlier pattern ignored.
? Where should .DS_Store (a macOS file) be ignored?
+ In your global ignore file (core.excludesFile)
- In every project's .gitignore
- Nowhere; commit it
= Files your computer creates belong in your own global ignore file.
:::

@@@ lesson
id: undoing
title: Undoing things safely
minutes: 26
summary: Choosing the right undo: discarding working-tree changes with git restore, unstaging with git restore --staged, fixing the last commit with --amend, moving a branch back with git reset --soft, --mixed and --hard, undoing a shared commit with git revert, why you never rewrite history others have, and recovering with the reflog.
---
Everyone makes mistakes with Git: a typo in a message, a forgotten file, a commit that broke something. Git can undo almost anything, but the right command depends on **where** the mistake is, and whether anyone else already has it.

| Situation | Command | What it changes |
|---|---|---|
| I changed a file and want the last committed version back | `git restore <file>` | the working tree (your edits are **lost**) |
| I staged something by mistake | `git restore --staged <file>` | the staging area only |
| The last commit's message is wrong, or I forgot a file | `git commit --amend` | replaces the last commit |
| My last commits (not pushed yet) should be undone, keeping the changes | `git reset --soft HEAD~1` (or `--mixed`) | moves the branch back |
| My last commits (not pushed yet) should be thrown away completely | `git reset --hard HEAD~1` | moves the branch back and **deletes** the changes |
| A commit others already have is wrong | `git revert <commit>` | adds a new commit that undoes it |

### Discard and unstage

```sh setup=shop-work-in-progress
git status -s
git restore prices.txt
git restore --staged hours.txt
git status -s
cat hours.txt
```

`git restore prices.txt` threw the tube line away: there's no undo for discarded working-tree changes, because Git never recorded them. `git restore --staged hours.txt` only unstaged; the new hours are still in the file.

### Fixing the last commit

```sh setup=shop-history
echo "Closed on bank holidays." >> hours.txt
git add hours.txt
git commit --amend -m "Add opening hours and holidays"
git log --oneline -3
```

`--amend` replaces the last commit with a new one (with a new id) containing whatever is staged now and the new message. Without `-m`, it keeps the old message.

### reset: move the branch back

`git reset <commit>` moves the current branch to an earlier commit, as if later commits never happened. The three modes differ in what happens to those commits' changes:

| Mode | Branch | Staging area | Working tree |
|---|---|---|---|
| `--soft` | moved | keeps the changes, staged | unchanged |
| `--mixed` (default) | moved | reset | keeps the changes, unstaged |
| `--hard` | moved | reset | **reset: changes are gone** |

```sh setup=shop-history
git reset --soft HEAD~2
git status -s
git log --oneline
git commit -m "Lower the pump price and add opening hours"
git log --oneline
```

Here two commits became one: `reset --soft` is a simple way to combine your last few commits before sharing them. `git reset --hard` is the dangerous one: it overwrites your files. Run `git status` first, and be sure.

### revert: undo a commit others have

Once commits are pushed (Part 2), teammates have built on them. Rewriting them with `reset` or `--amend` would make your history disagree with theirs. Instead, **revert** creates a new commit that does the opposite:

```sh setup=shop-history
git revert HEAD~1 --no-edit
git log --oneline -3
cat prices.txt
```

The history now says exactly what happened: the price was lowered, then the lowering was reverted. This is the safe way to undo anything that's shared.

### The golden rule

**Don't rewrite commits that other people have.** `--amend`, `reset` and (in Part 2) `rebase` replace commits with new ones; that's fine for commits only you have, and causes confusion and lost work for commits already pushed to a shared branch. Use `revert` there.

### The safety net: the reflog

Git keeps a log of where `HEAD` and each branch have been, the **reflog**. By default entries stay for 90 days, or 30 days for commits that are no longer on any branch. If you `reset --hard` the wrong commit away, the commit still exists:

```bash
git reflog                      # HEAD@{1}: commit: Add opening hours …
git reset --hard HEAD@{1}       # go back to where you were one step ago
```

(The sandbox doesn't keep a reflog; on your own computer it's always there.) What the reflog can't bring back is work that was **never committed**: commit often, even small steps; you can combine them later.

:::exercise Fix the last commit
The last commit was meant to add the price list **and** the delivery rates, but `delivery.txt` was forgotten and the message has a typo (`Add prces`). Fix it so that the history has **the same number of commits**, and the last one has the message `Add prices and delivery rates` and contains both files.
```sh starter
mkdir shop && cd shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\n" > prices.txt && git add prices.txt && git commit -qm "Add prces"
echo "standard 399" > delivery.txt
git log --oneline
git status
```
```js check
const r = await repo("~/shop");
const log = await r.log();
same(log.map((c) => c.subject), ["Add prices and delivery rates", "Add README"], "The commit messages, newest first (still two commits)");
same(await r.files("HEAD"), { "README.md": "# Bike shop\n", "delivery.txt": "standard 399\n", "prices.txt": "bell 800\npump 3000\n" }, "The files in the last commit");
if (!(await r.status()).clean) throw new AssertionError("The working tree should be clean.");
```
```sh solution
mkdir shop && cd shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\n" > prices.txt && git add prices.txt && git commit -qm "Add prces"
echo "standard 399" > delivery.txt
git add delivery.txt
git commit --amend -m "Add prices and delivery rates"
git log --oneline
git show --stat
```
hint: Stage the forgotten file first: `git add delivery.txt`.
hint: `git commit --amend` replaces the last commit with one that includes what's staged now.
hint: Give the new message with `-m` in the same command: `git commit --amend -m "Add prices and delivery rates"`.
approach:
1. **Understand:** change the last commit (content and message), not add a new one.
2. **Examples:** a new commit "Add delivery" would leave the typo and make three commits.
3. **Brute force:** `git reset --soft HEAD~1`, add, commit again: also works, in two steps.
4. **Pattern:** **stage the fix, then `--amend`**.
5. **Plan:** add delivery.txt → commit --amend -m.
6. **Code and test:** `git log --oneline` shows two commits; `git show --stat` lists both files.
walkthrough:
**Line by line**

- `git add delivery.txt` stages the forgotten file on top of what the last commit already has.
- `git commit --amend -m "…"` builds a new commit from the staging area (prices and delivery) with the new message, and moves `main` to it in place of the old one.
- The old commit isn't deleted immediately, but nothing points to it any more.

**Trace:** before: `Add prces` (prices only). After: `Add prices and delivery rates` (prices and delivery), with a different id.

**Common wrong approach:** amending a commit that's already been pushed: it's fine here, but on a shared branch it rewrites history others have.
:::

:::exercise Undo a shared commit
The commit `Show prices in USD` broke the shop, and it has already been pushed, so the team agreed to undo it **without rewriting history**. Undo exactly that commit (the later commit, which added opening hours, must stay) so that `prices.txt` shows pounds again.
```sh starter
mkdir shop && cd shop && git init -q
printf "bell £8.00\npump £30.00\n" > prices.txt && git add . && git commit -qm "Add price list"
printf "bell \$10.00\npump \$38.00\n" > prices.txt && git commit -qam "Show prices in USD"
echo "Open 9 to 5" > hours.txt && git add hours.txt && git commit -qm "Add opening hours"
git log --oneline
```
```js check
const r = await repo("~/shop");
const log = await r.log();
same(log.map((c) => c.subject), ['Revert "Show prices in USD"', "Add opening hours", "Show prices in USD", "Add price list"],
  "The commit messages, newest first (all the old commits kept, plus one that reverts)");
same(await r.files("HEAD"), { "hours.txt": "Open 9 to 5\n", "prices.txt": "bell £8.00\npump £30.00\n" }, "The files in the latest commit");
if (!(await r.status()).clean) throw new AssertionError("The working tree should be clean.");
if (!ran(/git revert/)) throw new AssertionError("Use git revert, so Git works out the undo and records which commit it reverts.");
```
```sh solution
mkdir shop && cd shop && git init -q
printf "bell £8.00\npump £30.00\n" > prices.txt && git add . && git commit -qm "Add price list"
printf "bell \$10.00\npump \$38.00\n" > prices.txt && git commit -qam "Show prices in USD"
echo "Open 9 to 5" > hours.txt && git add hours.txt && git commit -qm "Add opening hours"
git revert HEAD~1 --no-edit
git log --oneline
cat prices.txt
```
hint: Pushed history must not be rewritten, so `reset` and `--amend` are out. `git revert <commit>` adds a new commit that undoes one.
hint: The USD commit isn't the latest: name it by its id from `git log --oneline`, or as `HEAD~1`.
hint: `--no-edit` keeps Git's suggested message (`Revert "Show prices in USD"`) without opening an editor.
approach:
1. **Understand:** undo one older commit, keep everything else, add to history rather than change it.
2. **Examples:** `git reset --hard HEAD~2` would also remove the opening hours, and rewrite shared history.
3. **Brute force:** edit `prices.txt` back by hand and commit: works, but loses the link to what was undone.
4. **Pattern:** **`git revert` for shared commits**.
5. **Plan:** find the commit → `git revert <it> --no-edit` → check the log and the file.
6. **Code and test:** `cat prices.txt` shows £ again; `hours.txt` is still there.
walkthrough:
**Line by line**

- `git log --oneline` shows the USD commit is `HEAD~1`.
- `git revert HEAD~1 --no-edit` computes the opposite of that commit's changes (dollars back to pounds), applies it, and commits with the message `Revert "Show prices in USD"` and a body naming the reverted commit.
- The opening-hours commit is untouched, because the revert only reverses the USD commit's own changes.

**Trace:** history: Add price list → Show prices in USD → Add opening hours → Revert "Show prices in USD".

**Common wrong approach:** `git revert HEAD`: that undoes the opening hours, the wrong commit.
:::

:::quiz
? Which command throws away uncommitted edits to app.js, with no way back?
+ git restore app.js
- git restore --staged app.js
- git revert app.js
= Changes that were never committed can't be recovered.
? A commit is already on the shared main branch. How do you undo it?
+ git revert <commit>
- git reset --hard <commit>~1
- git commit --amend
= Revert adds a new commit instead of rewriting shared history.
? What does git reset --soft HEAD~1 do?
+ Moves the branch back one commit and keeps that commit's changes staged
- Deletes the last commit and its changes
- Only unstages files
= --soft leaves the staging area and working tree as they were.
? You ran git reset --hard and lost a commit. What can help?
+ git reflog, which still lists where HEAD was
- Nothing; it's gone
- git restore
= Commits stay reachable through the reflog for about 90 days.
:::

@@@ lesson
id: inside-git
title: How Git stores your work
minutes: 20
summary: What's inside .git, Git's four object types (blobs, trees, commits and tags), content-addressed storage and hashes (SHA-1 today, SHA-256 coming), snapshots rather than diffs, packfiles, refs and HEAD as small text files, git cat-file and git rev-parse, and why this explains cheap branches, immutable commits and --amend.
---
Git's commands make more sense once you know what they do to the data underneath, and the design is small enough to understand completely in one lesson.

### Inside .git

```sh setup=shop-history
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

### Four kinds of objects

![A commit object (c4d5e6f) lists its tree, its parent commit, the author and the message. The tree lists the files: a blob for README.md and a blob for prices.txt. Each blob holds a file's content. Every object is stored under the SHA-1 hash of its content, so the same content always has the same name](figures/git-objects.svg)

| Object | Holds |
|---|---|
| **blob** | the content of one file (no name, just the bytes) |
| **tree** | a folder: names, permissions, and the blobs and trees inside |
| **commit** | one tree (the whole project), parent commit(s), author, committer, date, message |
| **tag** | a named, annotated pointer to a commit (Part 2) |

`git cat-file -p` prints any object, so you can walk the structure yourself:

```sh setup=shop-history
git cat-file -p HEAD
git cat-file -p HEAD^{tree}
git cat-file -p HEAD:prices.txt
git cat-file -t HEAD
```

### Content-addressed storage

Every object is stored under the **hash** of its content: a 40-character hexadecimal id computed with SHA-1. The same content always produces the same id, and any change, even one character, produces a completely different one. Consequences:

- **Identical files are stored once**, however many commits or folders contain them.
- **Commits can't change.** A commit's id covers its tree, its parent and its message, so changing anything gives a new commit. That's why `--amend` and `reset` "replace" commits rather than edit them, and why rewriting a shared commit changes every commit after it.
- **History is tamper-evident**: if someone altered an old file, every id after it would change.

Git is moving from SHA-1 to the stronger **SHA-256** for new repositories; Git 3.0 plans to make it the default. The ideas stay the same, with 64-character ids.

```sh
mkdir shop && cd shop && git init -q
echo "bell 800" > a.txt
echo "bell 800" > b.txt
git add . && git commit -qm "Two identical files"
git cat-file -p HEAD^{tree}
```

Both names point at the same blob.

### Snapshots, not diffs

Each commit records a complete snapshot of the project, not a list of changes; `git diff` and `git show` compute differences when you ask. Storing snapshots is cheap because unchanged files reuse the same blobs, and Git later compresses objects into **packfiles**, storing similar versions as deltas, so a repository with years of history is often smaller than you'd expect.

### Why branches are cheap

A branch is a 41-byte file with a commit id in it. Creating one doesn't copy anything; committing moves it forward by writing a new id into it. That's why teams create branches for every small piece of work, which is where Part 2 begins.

:::exercise Follow the pointers
Without changing anything, save to `~/answer.txt` the **full id** (40 characters) of the **blob** that stores `prices.txt` as it was **two commits before** the latest one (`HEAD~2`).
```sh starter setup=shop-history
git cat-file -p HEAD~2
```
```js check
const r = await repo("~/shop");
if (!exists("~/answer.txt")) throw new AssertionError("Save the blob id to ~/answer.txt.");
const answer = read("~/answer.txt").trim();
const expected = (await sh("git rev-parse HEAD~2:prices.txt")).trim();
if (answer.length !== 40) throw new AssertionError(`Save the full 40-character id; ~/answer.txt contains ${JSON.stringify(answer)} (${answer.length} characters).`);
if (answer !== expected) throw new AssertionError("That isn't the blob of prices.txt in HEAD~2. Follow commit → tree → blob with git cat-file -p.");
same((await r.log()).length, 5, "The number of commits (nothing should change)");
```
```sh solution setup=shop-history
git cat-file -p HEAD~2
git cat-file -p HEAD~2^{tree}
git rev-parse HEAD~2:prices.txt > ~/answer.txt
cat ~/answer.txt
```
hint: `git cat-file -p HEAD~2` prints the commit, including the id of its `tree`. `git cat-file -p <tree id>` lists the files and their blob ids.
hint: `HEAD~2^{tree}` names that commit's tree directly, so `git cat-file -p HEAD~2^{tree}` saves a step.
hint: `git rev-parse HEAD~2:prices.txt` prints the blob id of a file in a commit; redirect it into `~/answer.txt`.
approach:
1. **Understand:** commit → tree → blob, at a specific commit.
2. **Examples:** the latest commit only added `hours.txt`, so `prices.txt` has the same blob in `HEAD` and `HEAD~1`; in `HEAD~2` the pump still cost 3200, so its blob is different.
3. **Brute force:** copying ids by hand from `cat-file` output: works, error-prone.
4. **Pattern:** **follow the pointers, or name the path in the commit directly**.
5. **Plan:** cat-file the commit → its tree → find `prices.txt` → save the id.
6. **Code and test:** `git cat-file -p $(cat ~/answer.txt)`, on your own computer, prints the price list.
walkthrough:
**Line by line**

- `git cat-file -p HEAD~2` shows `tree <id>`, the snapshot of that commit.
- `git cat-file -p HEAD~2^{tree}` lists entries like `100644 blob 1a2b… prices.txt`.
- `git rev-parse HEAD~2:prices.txt` resolves the path inside the commit to the same blob id.

**Trace:** `HEAD~2` is "Add the bike lock"; its `prices.txt` is `bell 800`, `pump 3200`, `lock 2900`, a different blob from today's.

**Common wrong approach:** saving the commit id or the tree id instead: all three are 40-character hashes, so check the type with `git cat-file -t <id>`.
:::

:::exercise Where does main point?
Use the files in `.git` (not `git log`) to save the **full id of the commit `main` points to** into `~/main.txt`, and the **branch HEAD refers to** (the text after `ref: `, such as `refs/heads/main`) into `~/head.txt`.
```sh starter setup=shop-history
ls .git
```
```js check
const r = await repo("~/shop");
if (!exists("~/main.txt") || !exists("~/head.txt")) throw new AssertionError("Create both ~/main.txt and ~/head.txt.");
same(read("~/main.txt").trim(), await r.resolve("main"), "~/main.txt");
same(read("~/head.txt").trim(), "refs/heads/main", "~/head.txt");
if (!ran(/cat .*\.git\/(HEAD|refs)/) && !ran(/\.git\/refs\/heads\/main/)) throw new AssertionError("Read the files in .git (with cat) rather than using git log.");
```
```sh solution setup=shop-history
cat .git/HEAD
cat .git/refs/heads/main
cat .git/refs/heads/main > ~/main.txt
sed 's/ref: //' .git/HEAD > ~/head.txt
cat ~/main.txt ~/head.txt
```
hint: `cat .git/HEAD` shows which branch you're on; `cat .git/refs/heads/main` shows the commit that branch points to.
hint: Redirect the branch file straight into the answer: `cat .git/refs/heads/main > ~/main.txt`.
hint: For `~/head.txt`, write the part after `ref: `: either `echo refs/heads/main > ~/head.txt`, or remove the prefix with `sed 's/ref: //' .git/HEAD > ~/head.txt`.
approach:
1. **Understand:** a branch and HEAD are small text files.
2. **Examples:** `.git/HEAD` contains `ref: refs/heads/main`.
3. **Brute force:** `git log` and copying the top id: works, but the exercise is about seeing the files.
4. **Pattern:** **refs are files; HEAD is a reference to a ref**.
5. **Plan:** cat HEAD → cat the branch file → save both.
6. **Code and test:** compare with `git rev-parse main`.
walkthrough:
**Line by line**

- `.git/HEAD` holds `ref: refs/heads/main`: HEAD is a **symbolic reference** to the branch.
- `.git/refs/heads/main` holds the 40-character id of the newest commit on `main`.
- Committing writes a new id into that file; switching branches rewrites `.git/HEAD`.

**Trace:** `cat .git/refs/heads/main` and `git rev-parse main` print the same id.

**Common wrong approach:** writing the whole `ref: refs/heads/main` line into `~/head.txt`: the exercise asks for the part after `ref: `.
:::

:::quiz
? What is a branch, in Git's storage?
+ A small file containing the id of a commit
- A copy of all the project's files
- A folder in .git/objects
= That's why creating a branch is instant.
? Two files in different folders have exactly the same content. How many blobs does Git store?
+ One, because blobs are named by their content's hash
- Two, one per file
- None, until they differ
= Identical content means an identical hash.
? Why does git commit --amend give the commit a new id?
+ The id is a hash of the commit's content, so any change makes a new commit
- Git numbers commits in order
- Amending also changes the parent
= Commits can't be edited, only replaced.
? What does a commit object point to?
+ A tree (the project snapshot) and its parent commit(s)
- A list of changed lines
- The files in the working tree
= Diffs are computed from snapshots when you ask for them.
:::
