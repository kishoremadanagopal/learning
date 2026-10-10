# Lesson 12: Protecting main, workflows and releases

**You'll learn:** rulesets and what they enforce (require a pull request and approvals, block force pushes, restrict deletions, require status checks, require linear history), creating rulesets in Settings or with gh api, ~DEFAULT_BRANCH, branch protection rules, plan availability, rescuing a commit made on a protected main, admin bypass, GitHub flow, trunk-based development and feature flags, Git flow, forks and the upstream remote, semantic versioning, annotated tags and pushing them, GitHub releases with gh release create and --generate-notes, never moving published tags, Conventional Commits and release tools.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#team-workflows)**: run every example and check your exercise answers.

## Key terms

- **Ruleset:** a set of rules GitHub enforces on matching branches or tags, such as requiring pull requests.
- **Default branch:** the branch GitHub shows first and merges pull requests into by default, usually `main`.
- **GitHub flow:** short-lived branches merged into an always-deployable `main` through pull requests.
- **Trunk-based development:** everyone merges small changes into `main` at least daily, hiding unfinished work behind feature flags.
- **Feature flag:** a setting that switches code on or off without deploying again.
- **Fork:** your own copy of someone else's repository on GitHub, used to propose changes to projects you can't push to.
- **Semantic Versioning (SemVer):** `MAJOR.MINOR.PATCH` version numbers that say whether a release breaks, adds or fixes.
- **Release:** a GitHub page for a tag, with notes and downloadable files.

A team agrees that `main` must always work, but agreements get forgotten under pressure. GitHub can **enforce** them, and a few shared habits (how branches flow, how versions are named) make everyone's work predictable.

## Protecting main with rulesets

A **ruleset** is a set of rules GitHub enforces on matching branches or tags. For the default branch, the usual ones are:

| Rule | Effect |
|---|---|
| **Require a pull request before merging** | no direct pushes; changes arrive through PRs, optionally with a number of approvals |
| **Block force pushes** | nobody can rewrite the branch's history |
| **Restrict deletions** | the branch can't be deleted |
| **Require status checks to pass before merging** | CI must be green before merging (Part 3) |
| **Require linear history** | no merge commits (squash or rebase merges only) |

On the website: the repository's **Settings → Rules → Rulesets → New ruleset → New branch ruleset**, target **Include default branch**, tick the rules, set enforcement to **Active**. Rulesets are free for public repositories; private ones need a paid plan (Pro, Team or Enterprise). Older repositories may use **branch protection rules** (Settings → Branches) instead; they do the same job, and both can apply at once.

Rulesets can also be created through GitHub's REST API, which is handy for setting up many repositories the same way. `gh api` sends the request:

<details><summary>Commands that set up this example (run them first on your own computer)</summary>

```bash
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
echo "Open 9 to 5, Monday to Saturday." > hours.txt && git add . && git commit -qm "Add opening hours"
gh repo create shop --public --source=. --push
```

</details>

*This example raises an error on purpose.*

```bash
cat > ruleset.json <<'EOF'
{
  "name": "Protect main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false } },
    { "type": "non_fast_forward" },
    { "type": "deletion" }
  ]
}
EOF
gh api repos/ada/shop/rulesets --method POST --input ruleset.json --jq .name
echo "tube 600" >> prices.txt
git commit -qam "Add inner tubes"
git push
```

`~DEFAULT_BRANCH` means "whichever branch is the default"; `non_fast_forward` is **Block force pushes**, and `deletion` is **Restrict deletions**. The API insists on all five `pull_request` parameters, even the ones you leave off. The direct push is now refused, and pull requests need one approval to merge. To rescue a commit made on `main` by mistake, move it to a branch and put `main` back:

```bash
git switch -c add-tubes           # the commit comes along on the new branch
git branch -f main origin/main    # move main back to GitHub's version
git push -u origin add-tubes      # then open a pull request
```

Repository owners and admins can be allowed to bypass rules (`gh pr merge --admin`); use it for emergencies only.

## Team workflows

| Workflow | How it works | Fits |
|---|---|---|
| **GitHub flow** | `main` is always deployable; each change is a short-lived branch, a pull request, a review, then a merge | most teams and web services |
| **Trunk-based development** | everyone merges small changes into `main` at least daily; unfinished features hide behind **feature flags** (settings that switch code on) | teams with strong automated tests and continuous deployment |
| **Git flow** | long-lived `develop` and `main`, plus `feature/`, `release/` and `hotfix/` branches | software shipped in numbered versions with several supported releases |

Git flow was popular in the 2010s; its author now recommends something simpler, like GitHub flow, for software that's delivered continuously. Whatever you choose, the common thread is the same: **short-lived branches, small pull requests, and a `main` that always works**.

**Forks** are for projects you can't push to, such as open source. You **fork** (copy) the repository to your account, push branches to your fork, and open pull requests from there into the original. Locally, `origin` is your fork and a second remote, conventionally `upstream`, is the original: `git fetch upstream` brings in other people's work. `gh repo fork owner/project --clone` sets all of that up on your own computer.

## Versions, tags and releases

When you ship software others depend on, give each version a name. **Semantic Versioning** (SemVer) uses `MAJOR.MINOR.PATCH`:

| Part | Increase when | Example |
|---|---|---|
| MAJOR | you make incompatible changes | 1.4.2 → 2.0.0 |
| MINOR | you add features, compatibly | 1.4.2 → 1.5.0 |
| PATCH | you fix bugs, compatibly | 1.4.2 → 1.4.3 |

A version is marked with an **annotated tag** (Part 1 showed the object behind it): it records who tagged, when, and a message. Tags aren't pushed with branches; push them by name, or all at once with `--tags`.

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
git tag -a v1.0.0 -m "First release"
git tag -n
git push origin v1.0.0
gh release create v1.0.0 --title "Version 1.0.0" --generate-notes
gh release list
```

A **GitHub release** turns a tag into a page with notes and downloadable files. `--generate-notes` lists the pull requests merged since the previous release. Tags should never move once published: if `v1.0.0` was wrong, release `v1.0.1`.

**Conventional Commits** is a widely used message format that makes history machine-readable: `feat: add inner tubes`, `fix: correct the pump price`, `docs: explain opening hours`, with `feat!:` or a `BREAKING CHANGE:` footer for incompatible changes. Tools such as release-please and semantic-release read these messages to choose the next version number and write the changelog automatically. Adopt it if your team or project uses it; consistency matters more than the format.

## Try it on your own computer

- On a repository of your own: add a ruleset requiring a pull request, try `git push` to `main`, and watch it refused.
- `gh ruleset list` and `gh ruleset view` show a repository's rulesets; `gh release create v0.1.0 ./dist/*.zip --generate-notes` attaches files to a release.
- Read [GitHub's rulesets documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets) and [semver.org](https://semver.org).

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Protect main | ruleset: pull request + approvals, block force pushes (Settings or gh api) | what GitHub accepts | disable or delete the ruleset |
| Undo a commit made on protected main | git switch -c fix; git branch -f main origin/main | your local branches | — |
| Tag a version | git tag -a v1.0.0 -m "First release" | a tag object | git tag -d v1.0.0 (before pushing) |
| Publish the tag | git push origin v1.0.0 | the tag on GitHub | git push origin --delete v1.0.0 (avoid once used) |
| Create a release | gh release create v1.0.0 --generate-notes | a release page | gh release delete v1.0.0 (own computer) |

## Common mistakes

- Leaving the default branch unprotected on a team repository.
- Setting a ruleset's enforcement to `evaluate` and assuming it's enforced.
- Using admin bypass as a routine shortcut.
- Moving or deleting a tag that's already published instead of releasing a new version.
- Forgetting that `git push` doesn't send tags.

## Exercises

### 1. Protect main

Protect `main` on `ada/shop` with an **active** ruleset named `Protect main` that applies to the default branch, requires a pull request with **1** approval, and blocks force pushes. Create it with `gh api` and a JSON file (write the file with a here-document).

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
gh api repos/ada/shop/rulesets
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a ruleset is a JSON document: what it applies to (conditions) and what it enforces (rules).
2. **Examples:** `"enforcement": "evaluate"` or `"disabled"` would record the rules without enforcing them.
3. **Brute force:** asking everyone to remember: works until a busy day.
4. **Pattern:** **describe the policy as data, send it to the API**.
5. **Plan:** write the file → POST it → list rulesets to confirm.
6. **Code and test:** `gh api repos/ada/shop/rulesets` lists `Protect main` as `active`.

</details>

<details>
<summary>💡 Hint 1</summary>

Start from the ruleset in the lesson: the fields are `name`, `target`, `enforcement`, `conditions` and `rules`.

</details>

<details>
<summary>💡 Hint 2</summary>

Write it with `cat > ruleset.json <<'EOF'` … `EOF`, then `gh api repos/ada/shop/rulesets --method POST --input ruleset.json`.

</details>

<details>
<summary>💡 Hint 3</summary>

The rules you need are `pull_request` and `non_fast_forward`. The API requires all five `pull_request` parameters (copy them from the lesson), with `required_approving_review_count` set to 1.

</details>

### 2. Ship a release

Release the current `main` of `ada/shop` as version **1.0.0**: create an **annotated** tag `v1.0.0` with the message `First release` on your latest commit, push the tag to GitHub, and create a GitHub release for it titled `Version 1.0.0` with generated notes.

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
git log --oneline
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** three parts: a local annotated tag, the same tag on GitHub, a release page for it.
2. **Examples:** `git tag v1.0.0` (no `-a`) makes a lightweight tag with no message or author.
3. **Brute force:** creating the release first: GitHub makes a plain tag for you, without your message.
4. **Pattern:** **tag → push the tag → release**.
5. **Plan:** tag -a → push origin v1.0.0 → gh release create → gh release list.
6. **Code and test:** `gh release list` shows `Version 1.0.0` as `Latest`.

</details>

<details>
<summary>💡 Hint 1</summary>

`git tag -a v1.0.0 -m "First release"` tags the commit you're on.

</details>

<details>
<summary>💡 Hint 2</summary>

Tags don't travel with `git push`: push it by name, `git push origin v1.0.0`.

</details>

<details>
<summary>💡 Hint 3</summary>

`gh release create v1.0.0 --title "Version 1.0.0" --generate-notes` (the sandbox needs `--notes` or `--generate-notes`, as there's no editor).

</details>

**In the sandbox:** exercises 23–24. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Protect main</summary>

```bash
cat > ruleset.json <<'EOF'
{
  "name": "Protect main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false } },
    { "type": "non_fast_forward" }
  ]
}
EOF
gh api repos/ada/shop/rulesets --method POST --input ruleset.json --jq .name
gh api repos/ada/shop/rulesets
```

**Line by line**

- `"target": "branch"` and `"include": ["~DEFAULT_BRANCH"]` aim the ruleset at `main`.
- `pull_request` with `required_approving_review_count: 1` means every change needs a PR and one approval.
- `non_fast_forward` blocks force pushes.
- `gh api … --method POST --input ruleset.json` creates it; `--jq .name` prints just the name from the reply.

**Trace:** the POST prints `Protect main`; the GET lists it with `"enforcement": "active"`.

**Common wrong approach:** naming the rule after its label on the website, such as `"type": "block_force_pushes"`: the API calls it `non_fast_forward`, and rejects the request with HTTP 422.

</details>

<details>
<summary>✅ 2. Ship a release</summary>

```bash
git tag -a v1.0.0 -m "First release"
git push origin v1.0.0
gh release create v1.0.0 --title "Version 1.0.0" --generate-notes
gh release list
```

**Line by line**

- `git tag -a` creates a tag object with your name, the date and the message, pointing at `HEAD`.
- `git push origin v1.0.0` sends it: ` * [new tag]  v1.0.0 -> v1.0.0`.
- `gh release create` finds the tag on GitHub and publishes a release page for it.

**Trace:** `gh release create` prints `https://github.com/ada/shop/releases/tag/v1.0.0`.

**Common wrong approach:** `git push --tags` before tagging: there's nothing to push yet, and the release creates a lightweight tag instead.

</details>

## Quick quiz

1. Which rule stops anyone from pushing straight to main?
   - A) Require a pull request before merging
   - B) Block force pushes
   - C) Restrict deletions
   - D) Require linear history

2. In trunk-based development, how do teams ship unfinished features safely?
   - A) They merge small changes daily and hide unfinished work behind feature flags
   - B) They keep feature branches open for months
   - C) They push to main without tests
   - D) They use a separate repository per feature

3. A release fixes a bug without changing behaviour otherwise. Version 2.3.1 becomes…
   - A) 2.3.2
   - B) 2.4.0
   - C) 3.0.0
   - D) 2.3.1-fix

4. You contribute to an open-source project you can't push to. Where do you push your branch?
   - A) To your fork, then open a pull request into the original repository
   - B) Straight to the project's main
   - C) Nowhere; you email the files
   - D) To the project's upstream remote

<details>
<summary>Quiz answers</summary>

1. **A) Require a pull request before merging**: With it, changes reach main only through pull requests.
2. **A) They merge small changes daily and hide unfinished work behind feature flags**: Feature flags let incomplete code be merged but switched off.
3. **A) 2.3.2**: Compatible bug fixes increase PATCH.
4. **A) To your fork, then open a pull request into the original repository**: Forks are your own copy on GitHub; the PR proposes your branch to the original.

</details>

---
Previous: [Lesson 11](11-pull-requests.md) · Back to the [course home](../README.md)
