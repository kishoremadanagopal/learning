# Lesson 11: Pull requests and code review

**You'll learn:** what a pull request is, merge requests on GitLab, the pull request workflow, gh pr create with title, body, reviewer and draft, gh pr list and view, what a good PR description contains, Closes #12, small pull requests, reviewing (comment, approve, request changes), not approving your own PR, gh auth switch, gh pr diff and gh pr review, review etiquette, AI reviewers such as Copilot code review, merge methods (merge commit, squash and merge, rebase and merge), gh pr merge --delete-branch, updating main afterwards, git branch -D after a squash merge, fetch --prune.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#pull-requests)**: run every example and check your exercise answers.

## Key terms

- **Pull request (PR):** a proposal to merge one branch into another, with a place for review, discussion and automated checks.
- **Reviewer:** a person asked to read the changes and comment, approve or request changes.
- **Draft pull request:** a PR shared for early feedback that can't be merged until it's marked ready.
- **Squash and merge:** merging a PR as one new commit containing all its changes.
- **Rebase and merge:** merging a PR by replaying each of its commits onto the base branch.
- **Head branch / base branch:** the branch with the changes, and the branch it should merge into.

A **pull request** (PR; GitLab calls it a merge request) is a proposal on GitHub: "please merge my branch into `main`". It shows the changes, runs automated checks (Part 3), and gives the team a place to discuss and approve before anything reaches `main`. Pull requests are how almost every team, and every open-source project, accepts changes.

![Six steps: 1, branch with git switch -c add-tubes; 2, push with git push -u origin add-tubes; 3, open a PR with gh pr create; 4, review with gh pr review, plus CI checks; 5, merge with gh pr merge --squash -d; 6, update with git switch main and git pull. Changes reach main only through a reviewed pull request](../figures/pr-flow.svg)

## Opening a pull request

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
git switch -c add-tubes
echo "tube 600" >> prices.txt
git commit -qam "Add inner tubes"
git push -u origin add-tubes
gh pr create --title "Add inner tubes to the price list" --body "Customers keep asking for spare tubes." --reviewer grace
gh pr list
gh pr view
```

On the website, the yellow **Compare & pull request** banner (or the link in the `remote:` lines) does the same. A pull request belongs to the **branch**, not to particular commits: pushing more commits to `add-tubes` updates it.

A good pull request is **small** (it can be reviewed in one sitting; a few hundred changed lines at most) and has a description that answers:

- **What** changes, and **why** (the reason isn't in the code).
- **How to check it**: steps to test, screenshots for anything visual.
- **Links**: writing `Closes #12` (or `Fixes #12`) in the description links issue 12 and closes it when the PR merges.

`gh pr create --draft` opens a **draft** pull request: visible for early feedback, but it can't be merged until you mark it ready (`gh pr ready`).

## Reviewing

Reviewers read the **Files changed** tab, comment on specific lines, and finish with one of three verdicts: **Comment**, **Approve** or **Request changes**. GitHub doesn't let you approve your own pull request:

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
gh repo create shop --public --source=. --push
git switch -c add-tubes
echo "tube 600" >> prices.txt && git commit -qam "Add inner tubes"
git push -u origin add-tubes
gh pr create --title "Add inner tubes to the price list" --body "Customers keep asking for spare tubes." --reviewer grace
```

</details>

*This example raises an error on purpose.*

```bash
gh pr review 1 --approve
```

In the sandbox you're also signed in as your teammate `grace`, so you can play both roles. (`gh auth switch` is the real command for moving between GitHub accounts.)

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
gh repo create shop --public --source=. --push
git switch -c add-tubes
echo "tube 600" >> prices.txt && git commit -qam "Add inner tubes"
git push -u origin add-tubes
gh pr create --title "Add inner tubes to the price list" --body "Customers keep asking for spare tubes." --reviewer grace
```

</details>

```bash
gh auth switch --user grace
gh pr diff 1
gh pr review 1 --approve --body "Looks good, thanks!"
gh auth switch --user ada
gh pr view 1
```

Good reviews are kind and specific: ask questions ("What happens if the price list is empty?"), suggest rather than order, separate must-fix from nice-to-have ("nit:"), and approve when it's good enough, not perfect. As the author, reply to every comment, and push fixes as new commits so reviewers can see what changed.

Many teams also request a review from an AI reviewer such as **Copilot code review** on GitHub. It's useful for catching slips quickly; treat its comments like any colleague's suggestions: check them, and keep a human approval for anything that matters.

## Merging

When the pull request is approved (and its checks pass), it's merged, usually with a button on the website or `gh pr merge`. GitHub offers three methods:

| Method | What lands on `main` | Good for |
|---|---|---|
| **Create a merge commit** (`--merge`) | all the branch's commits, plus a merge commit | keeping every commit of larger branches |
| **Squash and merge** (`--squash`) | one new commit with all the changes, titled after the PR | small PRs; a tidy `main` with one commit per change |
| **Rebase and merge** (`--rebase`) | each of the branch's commits, replayed on top, no merge commit | a linear history that keeps individual commits |

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
gh repo create shop --public --source=. --push
git switch -c add-tubes
echo "tube 600" >> prices.txt && git commit -qam "Add inner tubes"
git push -u origin add-tubes
gh pr create --title "Add inner tubes to the price list" --body "Customers keep asking for spare tubes." --reviewer grace
```

</details>

```bash
gh auth switch --user grace
gh pr review 1 --approve --body "Looks good, thanks!"
gh auth switch --user ada
gh pr merge 1 --squash --delete-branch
git log --oneline --graph --all
git status
```

`--delete-branch` (`-d`) deletes the branch on GitHub and locally, switches you to `main` and pulls the merged commit. Without it, finish yourself: `git switch main`, `git pull`, then delete the branch.

One surprise with squash merges: the squashed commit is new, so Git doesn't see your local branch's commits in `main`, and `git branch -d add-tubes` says "not fully merged". Once GitHub shows the PR as merged, `git branch -D add-tubes` is safe. `git fetch --prune` (or `git config --global fetch.prune true`) removes remote-tracking branches whose GitHub branch was deleted.

## Try it on your own computer

- `gh pr status` shows the PRs that involve you; `gh pr checkout 12` fetches someone's PR branch so you can run it locally; `gh pr view --web` opens the PR in your browser.
- In the repository's **Settings → General → Pull Requests**, choose which merge methods are allowed, and tick **Automatically delete head branches**.
- To practise reviewing, ask a friend to open a pull request on your repository, or review open pull requests on an open-source project you use.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Open a pull request | git push -u origin branch; gh pr create --title "…" --body "…" | a PR on GitHub | gh pr close <number> |
| Review | gh pr diff <n>; gh pr review <n> --approve (or --request-changes, --comment) | the PR's reviews | submit a new review |
| Merge and tidy up | gh pr merge <n> --squash --delete-branch | base branch on GitHub; branches deleted | git revert the merge commit, in a new PR |
| Get someone's PR locally | gh pr checkout <n> | a local branch | git switch main; git branch -D branch |

## Common mistakes

- Opening huge pull requests that nobody can review properly.
- Writing no description, so reviewers can't tell why the change is needed.
- Approving without reading, or blocking on matters of taste.
- Forgetting to update local `main` and delete the branch after merging.
- Deleting the local branch with `-d` after a squash merge and being confused when Git refuses; use `-D` once the PR is merged.

## Exercises

### 1. Open a pull request

In `~/shop` (published as `ada/shop`), create a branch `add-helmets`, add the line `helmet 4500` at the end of `prices.txt`, and commit it as `Add helmets`. Push the branch, then open a pull request into `main` titled `Add helmets to the price list`, with a description of your choice, and request a review from `grace`.

<details>
<summary>The sandbox starts this exercise with these commands (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
echo "Open 9 to 5, Monday to Saturday." > hours.txt && git add . && git commit -qm "Add opening hours"
gh repo create shop --public --source=. --push
```

</details>

Starter:

```bash
git status
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a pull request needs a pushed branch with commits that `main` doesn't have.
2. **Examples:** running `gh pr create` before pushing fails with "you must first push the current branch".
3. **Brute force:** pushing straight to `main`: no review, and many repositories forbid it (Lesson 6).
4. **Pattern:** **branch → commit → push -u → gh pr create**.
5. **Plan:** switch -c → edit → commit → push -u → gh pr create with title, body and reviewer.
6. **Code and test:** `gh pr list` shows the pull request; `gh pr view` shows the reviewer.

</details>

<details>
<summary>💡 Hint 1</summary>

Branch, edit and commit as in Lesson 1, then `git push -u origin add-helmets`: a pull request needs the branch on GitHub.

</details>

<details>
<summary>💡 Hint 2</summary>

`gh pr create --title "…" --body "…"`: in the sandbox both are required, because there's no editor to ask you.

</details>

<details>
<summary>💡 Hint 3</summary>

Add `--reviewer grace` to `gh pr create`. `gh pr view` shows `Reviewers: grace (Requested)`.

</details>

### 2. Review and merge

Pull request #1 on `ada/shop` (from `add-tubes`, by you) is waiting for Grace's review. Approve it **as `grace`**, then, as `ada` again, merge it with **squash and merge**, deleting the branch. End on an up-to-date `main` that contains the change.

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
gh pr create --title "Add inner tubes to the price list" --body "Customers keep asking for spare tubes." --reviewer grace
```

</details>

Starter:

```bash
gh pr view 1
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** an approval from someone other than the author, then a squash merge that tidies up afterwards.
2. **Examples:** approving as `ada` fails: you can't approve your own pull request.
3. **Brute force:** `git merge add-tubes` and `git push` on `main`: the pull request stays open and the review is skipped.
4. **Pattern:** **review as the reviewer, merge as the author**.
5. **Plan:** switch to grace → approve → switch to ada → merge with squash and delete.
6. **Code and test:** `git log --oneline` on `main` shows `Add inner tubes to the price list (#1)`.

</details>

<details>
<summary>💡 Hint 1</summary>

`gh auth switch --user grace` makes you Grace; `gh pr review 1 --approve` approves.

</details>

<details>
<summary>💡 Hint 2</summary>

Switch back with `gh auth switch --user ada` before merging, so the merge is yours.

</details>

<details>
<summary>💡 Hint 3</summary>

`gh pr merge 1 --squash --delete-branch` merges, deletes the branch on GitHub and locally, and updates your `main`.

</details>

**In the sandbox:** exercises 21–22. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Open a pull request</summary>

```bash
git switch -c add-helmets
echo "helmet 4500" >> prices.txt
git commit -am "Add helmets"
git push -u origin add-helmets
gh pr create --title "Add helmets to the price list" --body "Helmets are our most requested item." --reviewer grace
gh pr view
```

**Line by line**

- The branch and commit are ordinary Git.
- `git push -u origin add-helmets` creates the branch on GitHub; the `remote:` lines offer a link to open a PR.
- `gh pr create` opens pull request #1 from `add-helmets` into the default branch, `main`.

**Trace:** `gh pr create` prints `https://github.com/ada/shop/pull/1`.

**Common wrong approach:** committing on `main` and opening the PR from there: a pull request needs a separate branch to compare with `main`.

</details>

<details>
<summary>✅ 2. Review and merge</summary>

```bash
gh auth switch --user grace
gh pr review 1 --approve --body "Looks good, thanks!"
gh auth switch --user ada
gh pr merge 1 --squash --delete-branch
git log --oneline
```

**Line by line**

- As `grace`, `gh pr review 1 --approve` records the approval.
- As `ada`, `gh pr merge 1 --squash` makes one commit on GitHub's `main`, titled after the pull request with its number.
- `--delete-branch` deletes `add-tubes` on GitHub and locally, switches to `main` and pulls the new commit.

**Trace:** `gh pr merge` prints `✓ Squashed and merged pull request ada/shop#1 (Add inner tubes to the price list)`.

**Common wrong approach:** merging while still signed in as `grace`: it works, but the exercise asks the author to merge.

</details>

## Quick quiz

1. Which belongs in a pull request description?
   - A) What changes and why, how to check it, and links such as Closes #12
   - B) A copy of every changed line
   - C) The reviewer's password
   - D) Nothing; the code explains itself

2. You push two more commits to a branch that has an open pull request. What happens?
   - A) The pull request updates to include them
   - B) A second pull request is opened
   - C) The push is rejected until the PR is merged
   - D) The PR is closed

3. What does "Squash and merge" put on main?
   - A) One new commit containing all the branch's changes
   - B) Every commit of the branch plus a merge commit
   - C) Only the branch's first commit
   - D) Nothing until you pull

4. Who can approve a pull request on GitHub?
   - A) Someone other than its author
   - B) Only its author
   - C) Anyone, including the author
   - D) Only GitHub's bots

<details>
<summary>Quiz answers</summary>

1. **A) What changes and why, how to check it, and links such as Closes #12**: The diff shows what changed; the description explains why and how to verify it.
2. **A) The pull request updates to include them**: A pull request tracks its branch.
3. **A) One new commit containing all the branch's changes**: That's why git branch -d later calls the local branch "not fully merged".
4. **A) Someone other than its author**: Reviews are about a second pair of eyes.

</details>

---
Previous: [Lesson 10](10-syncing.md) · Next: [Lesson 12: Protecting main, workflows and releases](12-team-workflows.md)
