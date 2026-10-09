# Lesson 1: Version control, Git and the terminal

**You'll learn:** what version control solves, Git as a distributed version control system, Git compared with GitHub, GitLab and Bitbucket, the terminal and the shell, prompts and the current folder, pwd, ls, cd, mkdir, echo, cat, redirection with > and >>, here-documents, chaining with &&, how the sandbox terminal runs real Git, installing Git on Windows, macOS and Linux, git --version, git config --global for name, email and the default branch, where configuration is stored.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#version-control)**: run every example and check your exercise answers.

## Key terms

- **Version control:** a system that records every saved version of a project, who made it and why, so you can compare, undo and work together.
- **Git:** the most widely used version control system; free, open source and distributed.
- **Distributed:** every copy of a Git repository holds the full history, so most commands work offline.
- **GitHub:** a website that hosts Git repositories and adds pull requests, issues and automation; it isn't Git itself.
- **Terminal:** a window where you type commands as text; the program inside it that runs them is the **shell**.
- **Working directory (current folder):** the folder your commands act on; `pwd` prints it.
- **Redirection:** sending a command's output into a file: `>` replaces the file, `>>` adds to the end.
- **Here-document:** several lines of text given to a command, written between `<<'EOF'` and a line holding only `EOF`.
- **`git config`:** reads and sets Git's settings; `--global` settings apply to every repository on your computer.

Without version control, projects end up as `report_final_v2_REALLY_final.docx`, and nobody knows which copy is current, what changed between them, or how to get yesterday's version back. **Version control** records every change to a set of files: who made it, when, and why, so you can see the history, undo mistakes, and work with other people on the same files without overwriting each other.

**Git** is the version control system almost every team uses, for code, configuration, documentation, SQL and analysis notebooks alike. It was created in 2005 by Linus Torvalds to manage the Linux kernel. It's **distributed**: every copy of a project, on every laptop, has the full history, so you can work offline and nothing depends on a single server.

**GitHub** (and GitLab, Bitbucket and others) is a website that hosts Git repositories and adds collaboration around them: pull requests, code review, issues, and the automation you'll meet in Part 3. Git is the tool; GitHub is a place to share what Git records. This part teaches Git; Part 2 adds GitHub.

## The terminal

Git is used from a **terminal** (also called the command line or shell): you type a command, press Enter, and read its output. Editors and apps have Git buttons too, but every team's documentation, every CI system and every server speaks commands, and the buttons are easier once you know what they do.

A command is a program name followed by **arguments**, often with **options** that start with `-` or `--`:

```bash
ls -a ~/shop          # program: ls   option: -a   argument: ~/shop
git commit -m "Add README"
```

## This course's terminal

The sandbox on the right is a terminal that runs in your browser. Write commands in the editor, one per line, and press **Run**: each line runs in order, and the output shows every command (after its prompt, `~ $`) followed by what it printed.

- Each Run starts fresh, in your home folder `~` (`/home/learner`): nothing is kept between runs, so you can't break anything.
- Git is real: a full Git engine reads and writes real `.git` repositories inside the sandbox. A few interactive features (a text editor, `git add -p`) aren't available; the lessons show the non-interactive form.
- Some examples start from a prepared project, shown in the editor's title as **starts from: …**. On GitHub, each lesson lists the commands that create it.

```bash
pwd
mkdir shop
cd shop
pwd
echo "# Bike shop" > README.md
ls
cat README.md
```

## The commands you need

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

```bash
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

## Setting up Git

Git records an author name and email with every commit, so set them once:

```bash
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

## Try it on your own computer

1. **Install Git.**
   - **Windows:** download Git for Windows from [git-scm.com/downloads/win](https://git-scm.com/downloads/win) and run the installer (the default options are fine). It includes **Git Bash**, a terminal where every command in this course works.
   - **macOS:** open Terminal and run `git --version`; if Git isn't installed, macOS offers to install the Command Line Developer Tools. Or install [Homebrew](https://brew.sh) and run `brew install git` for the newest version.
   - **Linux:** `sudo apt install git` (Debian, Ubuntu) or `sudo dnf install git` (Fedora).
2. Open a terminal (Git Bash on Windows) and check: `git --version`.
3. Run the three `git config --global` commands above with your own name and email.
4. Optional: make your editor Git's editor, for example `git config --global core.editor "code --wait"` for VS Code.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Where am I? | pwd, then ls -a | nothing | — |
| Make a folder and go in | mkdir -p name && cd name | creates a folder | rm -r name |
| Write a file | echo "text" > file (>> to append) | replaces (or extends) the file | rewrite the file |
| Set your identity | git config --global user.name "…" and user.email "…" | ~/.gitconfig | git config --global --unset key |
| Default branch main | git config --global init.defaultBranch main | ~/.gitconfig | git config --global --unset init.defaultBranch |

## Common mistakes

- Typing `>` when you meant `>>` and replacing a whole file.
- Running Git commands in the wrong folder; check with `pwd` first.
- Committing before setting `user.name` and `user.email`, so commits carry a made-up identity.
- Thinking GitHub is required to use Git; Git works entirely on your own computer.
- Copying commands with a leading `$` from documentation; the `$` is the prompt, not part of the command.

## Exercises

### 1. Set up a project folder

In your home folder, create this project:

- a folder `shop` containing `README.md` with exactly one line: `# Bike shop`
- inside it, a folder `docs` containing `notes.txt` with exactly two lines: `Order more inner tubes` and `Call the bell supplier`

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** two folders, two files, exact contents.
2. **Examples:** `>` replaces a file; `>>` adds to its end.
3. **Brute force:** `mkdir shop`, `mkdir shop/docs`, then one command per line of text. Fine!
4. **Pattern:** **create folders, then write files with redirection**.
5. **Plan:** mkdir -p → cd → echo > → echo > → echo >>.
6. **Code and test:** finish with `cat` and `ls -a` to see what you made.

</details>

<details>
<summary>💡 Hint 1</summary>

`mkdir -p shop/docs` creates both folders at once. Then `cd shop`.

</details>

<details>
<summary>💡 Hint 2</summary>

`echo "# Bike shop" > README.md` writes the first file. The quotes matter: without them, `#` would start a comment.

</details>

<details>
<summary>💡 Hint 3</summary>

For two lines, use `>` for the first line and `>>` for the second (or a here-document). Check with `cat docs/notes.txt`.

</details>

### 2. Configure Git

Set your Git identity globally to the name `Grace Hopper` and the email `grace@example.com`, and make sure new repositories start on a branch called `main`. Then print the name back with `git config user.name`.

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** three global settings, then read one back.
2. **Examples:** `git config --global user.email "grace@example.com"`.
3. **Brute force:** editing `~/.gitconfig` by hand works on your computer, but the command is safer.
4. **Pattern:** **set with a value, read without one**.
5. **Plan:** name → email → defaultBranch → print name.
6. **Code and test:** `git config --list` shows everything.

</details>

<details>
<summary>💡 Hint 1</summary>

The command is `git config --global <key> <value>`; the keys are `user.name`, `user.email` and `init.defaultBranch`.

</details>

<details>
<summary>💡 Hint 2</summary>

Put values with spaces in quotes: `"Grace Hopper"`. Without them, Git would get two separate arguments.

</details>

<details>
<summary>💡 Hint 3</summary>

Leave out the value to read a setting: `git config user.name`.

</details>

**In the sandbox:** exercises 1–2. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Set up a project folder</summary>

```bash
mkdir -p shop/docs
cd shop
echo "# Bike shop" > README.md
echo "Order more inner tubes" > docs/notes.txt
echo "Call the bell supplier" >> docs/notes.txt
cat docs/notes.txt
```

**Line by line**

- `mkdir -p shop/docs` makes `shop` and `docs` inside it in one go.
- `cd shop` moves into the project, so the following paths are relative to it.
- `echo "# Bike shop" > README.md` writes one line (echo adds the line break at the end).
- The first `echo … > docs/notes.txt` creates the file with line one; `>>` appends line two.

**Trace:** after the commands, `cat docs/notes.txt` prints both lines in order.

**Common wrong approach:** using `>` for both lines: the second `>` replaces the file, leaving only "Call the bell supplier".

</details>

<details>
<summary>✅ 2. Configure Git</summary>

```bash
git config --global user.name "Grace Hopper"
git config --global user.email "grace@example.com"
git config --global init.defaultBranch main
git config user.name
```

**Line by line**

- `--global` stores the settings for your user account, so every repository uses them.
- Quoting `"Grace Hopper"` passes the name as one argument.
- `init.defaultBranch main` only affects repositories created from now on.
- `git config user.name` (no value) prints the current setting.

**Trace:** the sandbox started with Ada's identity; after these commands, commits would be credited to Grace.

**Common wrong approach:** `git config user.name Grace Hopper` without quotes: Git sees `Grace` as the value and `Hopper` as an extra argument, and reports an error.

</details>

## Quick quiz

1. What's the difference between Git and GitHub?
   - A) Git records the history of files; GitHub is a website that hosts Git repositories and adds collaboration tools
   - B) They're two names for the same program
   - C) GitHub is the newer version of Git

2. What does echo "lock 2900" >> prices.txt do?
   - A) Adds the line to the end of prices.txt
   - B) Replaces prices.txt with that line
   - C) Prints the line and prices.txt

3. What does "distributed" mean for Git?
   - A) Every copy of a repository contains the full history
   - B) The files are split across several servers
   - C) Only one person can work on a file at a time

4. Why set user.email to the email of your GitHub account?
   - A) So GitHub links your commits to your account
   - B) Git refuses to work otherwise
   - C) GitHub sends you an email for every commit

<details>
<summary>Quiz answers</summary>

1. **A) Git records the history of files; GitHub is a website that hosts Git repositories and adds collaboration tools**: You can use Git with no GitHub at all, or with GitLab or Bitbucket instead.
2. **A) Adds the line to the end of prices.txt**: > replaces a file; >> appends to it.
3. **A) Every copy of a repository contains the full history**: You can commit, browse history and branch without any network.
4. **A) So GitHub links your commits to your account**: The email in each commit is how hosting sites know who made it.

</details>

---
Back to the [course home](../README.md) · Next: [Lesson 2: Your first repository and commits](02-first-commits.md)
