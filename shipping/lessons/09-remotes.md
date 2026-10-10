# Lesson 9: GitHub and remotes: clone, push and pull

**You'll learn:** remote repositories and hosting (GitHub, GitLab, Bitbucket), remotes and origin, gh repo create with --source and --push, git remote add and -v, public and private repositories, git clone, remote-tracking branches such as origin/main, origin/HEAD, upstream branches and -u, ahead and behind in git status, git push, pushing new branches, push.autoSetupRemote, git fetch, git pull, rejected pushes (fetch first), signing in with gh auth login, Git Credential Manager and SSH keys, never storing tokens in URLs.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#remotes)**: run every example and check your exercise answers.

## Key terms

- **Remote:** a named link to another copy of the repository, usually on GitHub.
- **`origin`:** the conventional name for the main remote; `git clone` sets it up.
- **Remote-tracking branch:** your repository's record of a branch on a remote, such as `origin/main`; it moves only when you fetch, pull or push.
- **Upstream:** the remote branch a local branch is paired with, used by plain `git push`, `git pull` and `git status`.
- **Push:** send your commits to a remote branch.
- **Fetch:** download new commits from a remote and update remote-tracking branches, without changing your branches.
- **Pull:** fetch, then integrate the remote branch into your current branch (by merging or rebasing).
- **GitHub CLI (`gh`):** GitHub's official command-line tool for repositories, pull requests, releases and more.

Until now the repository lived only on your computer. To share it, back it up and collaborate, you put a copy on a server everyone can reach. **GitHub** is the most widely used host; GitLab, Bitbucket and Azure DevOps work the same way for everything in this lesson.

A **remote** is a named link to another copy of the repository, usually on GitHub. By convention the main one is called **origin**. Git never syncs by itself: you send commits with `git push` and get other people's commits with `git fetch` or `git pull`.

![On your computer, ~/shop has your branch main and origin/main, Git's record of what main looked like on GitHub when you last talked to it. On GitHub, ada/shop has its own main. git push sends your commits to GitHub's main; git fetch brings GitHub's commits back and updates origin/main. git pull is git fetch followed by merging (or rebasing) origin/main into main](../figures/remotes.svg)

## Publishing a repository

On github.com you create a repository with **New repository**, then connect your local one to it. With **GitHub CLI** (`gh`), it's one command from the project folder. The sandbox has a pretend GitHub, and you're signed in as `ada`:

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

## Cloning

`git clone` copies a repository, all its history included, into a new folder and sets up `origin` and `main`'s upstream for you:

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
echo "Open 9 to 5, Monday to Saturday." > hours.txt && git add . && git commit -qm "Add opening hours"
gh repo create shop --public --source=. --push
```

</details>

```bash
cd ~
git clone https://github.com/ada/shop.git shop-copy
cd shop-copy
git log --oneline
git branch -a
```

`git branch -a` lists remote-tracking branches too. `origin/HEAD` records which branch GitHub considers the default (`main`).

## Pushing

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
echo "Open 9 to 5, Monday to Saturday." > hours.txt && git add . && git commit -qm "Add opening hours"
gh repo create shop --public --source=. --push
```

</details>

```bash
echo "tube 600" >> prices.txt
git commit -qam "Add inner tubes"
git status
git push
git status
```

After the commit, your branch is **ahead** of `origin/main` by one commit; `git push` sends it, and both point at the same commit again. The line `a1b2c3d..e4f5a6b  main -> main` says GitHub's `main` moved from one commit to the other.

A **new** branch has no upstream yet, so plain `git push` refuses and tells you exactly what to run:

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
echo "Open 9 to 5, Monday to Saturday." > hours.txt && git add . && git commit -qm "Add opening hours"
gh repo create shop --public --source=. --push
```

</details>

```bash
git switch -c add-helmets
echo "helmet 4500" >> prices.txt
git commit -qam "Add helmets"
git push
git push -u origin add-helmets
```

GitHub's reply (the `remote:` lines) even suggests opening a pull request: that's Lesson 5. If you'd rather not type `-u origin <branch>` every time, `git config --global push.autoSetupRemote true` (Git 2.37 or later) makes the first plain `git push` of a new branch set the upstream itself.

## Fetching and pulling

Your teammate Grace pushed a commit to GitHub. Your copy doesn't know until you ask:

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
```

</details>

```bash
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

## When a push is rejected

If someone pushed while you were working, GitHub's `main` has a commit yours doesn't:

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
git push
```

Git refuses rather than throw Grace's commit away. You need to integrate her work first; the next lesson shows how.

## Try it on your own computer

1. **Create a GitHub account** at [github.com/signup](https://github.com/signup) if you don't have one (free).
2. **Install GitHub CLI** from [cli.github.com](https://cli.github.com): Windows `winget install --id GitHub.cli`, macOS `brew install gh`, Linux: see [the Linux install page](https://github.com/cli/cli/blob/trunk/docs/install_linux.md).
3. **Sign in:** `gh auth login`, choose GitHub.com and HTTPS, and say yes to "Authenticate Git with your GitHub credentials". It signs you in through your browser and sets Git up to use the same login.

GitHub stopped accepting account passwords for Git operations in 2021. Besides `gh`, the alternatives are **Git Credential Manager** (included with Git for Windows; [other systems](https://github.com/git-ecosystem/git-credential-manager)), or **SSH keys**: `ssh-keygen -t ed25519 -C "you@example.com"`, add the `.pub` file under GitHub **Settings → SSH and GPG keys**, and use `git@github.com:you/shop.git` URLs ([GitHub's SSH guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)). Never put a password or token inside a remote URL: it's saved in plain text in `.git/config`.

To practise with a "teammate" on your own, clone your repository a second time into another folder, set a different `user.name` there with `git config user.name "…"`, and push from both.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Publish a repository | gh repo create shop --public --source=. --push | a GitHub repository, origin, upstream | gh repo delete (own computer) |
| Copy a repository | git clone https://github.com/ada/shop.git | a new folder with origin | rm -r shop |
| Send commits | git push (first time: git push -u origin branch) | the remote branch | git revert, then push |
| Check for new work | git fetch, then git status | origin/* only | — |
| Get and integrate new work | git pull | your branch and files | git reset --hard ORIG_HEAD (not pushed yet) |

## Common mistakes

- Trusting `git status` without fetching: it compares with `origin/main` as last seen.
- Pushing a new branch without `-u`, so it has no upstream.
- Starting work without pulling, then hitting a rejected push.
- Putting a password or token inside the remote URL.
- Making a repository public by accident when it contains private data.

## Exercises

### 1. Publish to GitHub

Publish `~/shop` to GitHub as a **public** repository called `shop` (you're signed in as `ada`, so it becomes `ada/shop`). Push `main`, and make sure your `main` tracks `origin/main`.

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
gh auth status
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** three things: a repository on GitHub, a remote called `origin` pointing at it, and `main` pushed with an upstream.
2. **Examples:** creating the repository without pushing leaves it empty.
3. **Brute force:** uploading files through the website: no history, and no link to your local repository.
4. **Pattern:** **create remote → connect → push -u**.
5. **Plan:** `gh repo create … --source=. --push`, then check with `git status` and `git remote -v`.
6. **Code and test:** `git log --oneline` shows `origin/main` next to `HEAD -> main`.

</details>

<details>
<summary>💡 Hint 1</summary>

`gh repo create` can do everything at once. `gh repo create --help` on your own computer lists its options; you need the name, `--public`, `--source=.` and `--push`.

</details>

<details>
<summary>💡 Hint 2</summary>

Alternatively: `gh repo create shop --public` creates an empty repository; then `git remote add origin https://github.com/ada/shop.git` and `git push -u origin main`.

</details>

<details>
<summary>💡 Hint 3</summary>

`git status` should end up saying `Your branch is up to date with 'origin/main'.`

</details>

### 2. Catch up, then contribute

Your teammate Grace pushed a commit to `ada/shop` since you last synced. Bring her commit into your `main`, then add the line `tube 600` at the end of `prices.txt`, commit it as `Add inner tubes`, and push. GitHub's `main` should end up as a straight line of commits: no merge commits.

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
```

</details>

Starter:

```bash
git status
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** get up to date first, then add your commit on top, then share it.
2. **Examples:** committing first makes your `main` and GitHub's diverge, and the push is rejected.
3. **Brute force:** pushing with `--force`: it would delete Grace's commit from GitHub.
4. **Pattern:** **pull → commit → push**.
5. **Plan:** pull → edit → commit → push → check the graph.
6. **Code and test:** `git log --oneline --graph` is a straight line with `HEAD -> main, origin/main` at the top.

</details>

<details>
<summary>💡 Hint 1</summary>

Start with `git pull`: Grace's commit is new on GitHub, and your `main` has nothing new, so it's a fast-forward.

</details>

<details>
<summary>💡 Hint 2</summary>

Then the usual edit and `git commit -am "Add inner tubes"`.

</details>

<details>
<summary>💡 Hint 3</summary>

`git push` sends your commit; `git status` then says you're up to date with `origin/main`.

</details>

**In the sandbox:** exercises 17–18. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Publish to GitHub</summary>

```bash
gh repo create shop --public --source=. --push
git status
git log --oneline
```

**Line by line**

- `gh repo create shop --public` creates `github.com/ada/shop`.
- `--source=.` adds it as the remote `origin` of the repository in the current folder.
- `--push` runs `git push --set-upstream origin HEAD`, pushing `main` and setting its upstream.

**Trace:** `git status` → `Your branch is up to date with 'origin/main'.`

**Common wrong approach:** `git push origin main` without `-u`: the commits arrive, but `main` has no upstream, so `git status` can't tell you whether you're ahead or behind.

</details>

<details>
<summary>✅ 2. Catch up, then contribute</summary>

```bash
git pull
echo "tube 600" >> prices.txt
git commit -am "Add inner tubes"
git push
git log --oneline --graph
```

**Line by line**

- `git pull` fetches Grace's commit and fast-forwards your `main` to it; `prices.txt` now says `bell 850`.
- Your commit's parent is Grace's commit, so it extends the line.
- `git push` is a fast-forward for GitHub's `main`, so it's accepted.

**Trace:** `git push` prints `… main -> main`, and `prices.txt` ends with `tube 600`.

**Common wrong approach:** committing before pulling: the push is rejected (`fetch first`). Lesson 4 shows how to fix that state with `git pull --rebase`.

</details>

## Quick quiz

1. What is origin/main?
   - A) Your repository's record of where main was on the remote origin when you last fetched or pushed
   - B) The main branch on GitHub itself, updated live
   - C) A backup copy of your own main
   - D) The first commit of the repository

2. What's the difference between git fetch and git pull?
   - A) fetch only downloads and updates origin/main; pull also integrates it into your branch
   - B) They're the same command
   - C) fetch uploads your commits; pull downloads others'
   - D) pull only works on new branches

3. What does -u do in git push -u origin add-helmets?
   - A) Sets origin/add-helmets as the branch's upstream, so later plain git push and git pull work
   - B) Uploads untracked files
   - C) Forces the push
   - D) Updates every branch

4. Your push is rejected with "fetch first". Why?
   - A) The remote branch has commits you don't have yet
   - B) Your password is wrong
   - C) The repository is private
   - D) You need to commit first

<details>
<summary>Quiz answers</summary>

1. **A) Your repository's record of where main was on the remote origin when you last fetched or pushed**: It only moves when you talk to the remote (fetch, pull or push).
2. **A) fetch only downloads and updates origin/main; pull also integrates it into your branch**: Fetching is always safe; pulling changes your branch and files.
3. **A) Sets origin/add-helmets as the branch's upstream, so later plain git push and git pull work**: It's short for --set-upstream.
4. **A) The remote branch has commits you don't have yet**: Git won't overwrite other people's commits; integrate them first, then push.

</details>

---
Previous: [Lesson 8](08-merging.md) · Next: [Lesson 10: Keeping in sync: rebase, pull and force-with-lease](10-syncing.md)
