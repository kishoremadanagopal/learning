# Shipping software cheat sheet

The commands of the course on one page. The number in brackets is the lesson. The table of every task with its command and how to undo it is at the end.

## The terminal [1]

```bash
pwd                      # where am I?
ls -a                    # list files, including hidden ones such as .git
cd shop    cd ..    cd ~ # go into a folder, up one, home
mkdir -p src/app         # make folders (and any missing parents)
echo "bell 800" > prices.txt     # write a file (replaces it)
echo "lock 2900" >> prices.txt   # add a line to the end
cat prices.txt           # print a file
cmd1 && cmd2             # run cmd2 only if cmd1 worked
```

## Set up Git once [1]

```bash
git --version
git config --global user.name "Ada Lovelace"
git config --global user.email "ada@example.com"
git config --global init.defaultBranch main
git config --global --list
```

## Make commits [2]

```bash
git init                         # start tracking this folder
git status                       # what's changed, what's staged
git add prices.txt               # stage one file   (git add . = everything here)
git commit -m "Add price list"   # save the staged snapshot
git commit -am "Lower the pump price"   # stage tracked files and commit (not new files)
git log --oneline                # history, newest first
```

| Area | What's in it | Move changes with |
|---|---|---|
| Working tree | the files you edit | `git add` → staging area |
| Staging area (index) | the next commit | `git commit` → repository |
| Repository (`.git`) | every commit | `git restore`, `git switch` → working tree |

Good message: an imperative subject of about 50 characters (`Add opening hours`), a blank line, then *why* if it isn't obvious.

## See changes and history [3]

```bash
git status -s                    # M = modified, A = added, ?? = untracked (left column staged, right unstaged)
git diff                         # unstaged changes
git diff --staged                # staged changes
git diff HEAD~2 HEAD --stat      # between two commits
git log --oneline -n 5           # the last five commits
git log --stat                   # which files each commit changed
git log -p                       # with the full diffs
git log --oneline -- prices.txt  # commits that touched one file
git log --format="%h %an %s"     # your own format
git show HEAD~1                  # one commit in full
git show HEAD~2:prices.txt       # a file as it was
```

`HEAD` is where you are; `HEAD~1` is its parent, `HEAD~2` the grandparent. In a diff, `@@ -1,3 +1,4 @@` means "from line 1, 3 old lines became 4 new lines".

## Ignore files and keep secrets out [4]

| Pattern in `.gitignore` | Ignores |
|---|---|
| `node_modules/` | a folder with that name, anywhere |
| `*.log` | any file ending `.log` |
| `!keep.log` | …except this one (after the `*.log` line) |
| `/build/` | only the `build` folder at the top of the repository |
| `docs/**/*.pdf` | PDFs at any depth inside `docs` |
| `.env` | your secrets file: commit a `.env.example` instead |

Comments go on their own line, starting with `#`.

```bash
git check-ignore -v debug.log    # which rule ignores it?
git rm --cached .env             # stop tracking, keep the file; then commit
```

A secret that was ever committed (or pushed) is leaked: **rotate it first**, then remove it.

## Undo [5]

| You want to | Run | Safe after pushing? |
|---|---|---|
| throw away edits to a file | `git restore file` | yes (edits are lost) |
| unstage a file, keep the edits | `git restore --staged file` | yes |
| get a file as it was | `git restore --source HEAD~2 file` | yes |
| fix the last commit | `git add …` then `git commit --amend -m "…"` | no |
| undo commits, keep the changes staged | `git reset --soft HEAD~1` | no |
| undo commits, keep the changes unstaged | `git reset HEAD~1` (`--mixed`) | no |
| undo commits and throw the changes away | `git reset --hard HEAD~1` | no |
| undo a commit others already have | `git revert <commit>` | yes |
| find a commit you lost | `git reflog`, then `git reset --hard HEAD@{1}` | — |

## Inside .git [6]

```bash
cat .git/HEAD                    # ref: refs/heads/main
cat .git/refs/heads/main         # the commit id main points to
git rev-parse HEAD~1             # name → full id
git cat-file -t HEAD             # commit / tree / blob / tag
git cat-file -p HEAD             # tree, parent, author, committer, message
git cat-file -p HEAD^{tree}      # the files and folders of that snapshot
git cat-file -p HEAD:prices.txt  # one file's contents (a blob)
```

Commits are snapshots named by the hash of their contents, so a commit can't change: `--amend` makes a new one. A branch is a file holding one commit id, so branches are cheap.

## Branches and stashes [7]

```bash
git branch                       # list branches (* = current); -v adds the latest commit
git switch -c add-tubes          # create a branch here and switch to it
git switch main                  # switch (git switch - goes back to the previous one)
git log --oneline --graph --all  # every branch, as a graph
git stash                        # put uncommitted changes aside (-u: untracked files too)
git stash list                   # saved stashes, newest is stash@{0}
git stash pop                    # bring the newest back and drop it
git branch -d add-tubes          # delete a merged branch (-D: delete anyway)
```

## Merging and conflicts [8]

```bash
git merge add-tubes              # bring add-tubes into the branch you're on
git merge --no-ff add-tubes      # always make a merge commit
git merge --abort                # give up during a conflict
```

A conflict looks like this; edit the file to the right result, delete the markers, then `git add` the file and `git commit`:

```text
<<<<<<< HEAD
your branch's version
=======
the other branch's version
>>>>>>> add-tubes
```

## Remotes and GitHub [9]

```bash
gh auth login                                  # sign in (own computer)
gh repo create shop --public --source=. --push # create on GitHub, add origin, push
git remote -v                                  # list remotes
git clone https://github.com/ada/shop.git      # copy a repository
git push -u origin add-tubes                   # first push of a new branch (sets the upstream)
git push                                       # later pushes
git fetch                                      # download; moves origin/* only
git pull                                       # fetch + integrate into your branch
git status                                     # ahead / behind origin/main (as last fetched)
```

| Name | Means |
|---|---|
| `origin` | the main remote (usually GitHub) |
| `origin/main` | where `main` was on `origin` when you last fetched or pushed |
| upstream | the remote branch your branch is paired with (`git branch -vv`) |

## Keeping in sync [10]

```bash
git pull --rebase                       # replay your unpushed commits on top of the remote's
git config --global pull.rebase true    # make that the default
git rebase origin/main                  # update a feature branch with the latest main
git rebase --continue                   # after resolving a conflict and git add
git rebase --abort                      # give up, back to before
git push --force-with-lease             # push a rewritten branch, safely
git cherry-pick <commit>                # copy one commit onto the current branch
git rebase -i HEAD~3                    # reword, squash or drop recent commits (own computer)
```

Rewrite (rebase, amend, reset, force-push) only commits nobody else has built on. Never on a shared `main`.

## Pull requests [11]

```bash
gh pr create --title "…" --body "…" --reviewer grace   # open (--draft for early feedback)
gh pr list          gh pr view 1         gh pr diff 1
gh pr review 1 --approve                 # or --request-changes / --comment with --body "…"
gh pr merge 1 --squash --delete-branch   # or --merge / --rebase
gh pr checkout 1                         # get someone's PR branch locally
```

| Merge method | Lands on `main` |
|---|---|
| merge commit | all the branch's commits + a merge commit |
| squash and merge | one commit with all the changes (then `git branch -D` the local branch) |
| rebase and merge | each commit, replayed; no merge commit |

## Protecting main, workflows and releases [12]

```bash
gh api repos/OWNER/REPO/rulesets --method POST --input ruleset.json   # create a ruleset
git tag -a v1.2.0 -m "Release 1.2.0"     # annotated tag
git push origin v1.2.0                   # tags aren't pushed with branches (--tags: all)
gh release create v1.2.0 --generate-notes
git fetch upstream                       # forks: upstream = the original repository
```

SemVer `MAJOR.MINOR.PATCH`: breaking change → MAJOR, new feature → MINOR, bug fix → PATCH. Usual ruleset for `main`: require a pull request with 1+ approvals, block force pushes, restrict deletions, require status checks (Part 3).

## CI/CD with GitHub Actions [13–18]

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
    paths-ignore: ['**.md']
  pull_request:
  workflow_dispatch:                       # a Run workflow button / gh workflow run
permissions:
  contents: read                           # least privilege for the GITHUB_TOKEN
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true                 # false for deployments
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    strategy:
      matrix:
        node: [22, 24, 26]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ matrix.node }}
      - run: npm test
  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    env:
      API_TOKEN: ${{ secrets.API_TOKEN }}  # secrets through env:, never pasted into run:
    steps:
      - run: ./deploy.sh
```

| Task | Command |
|---|---|
| list runs / one run / its log | `gh run list`, `gh run view <ID>`, `gh run view <ID> --log` (`--log-failed`) |
| wait for a run | `gh run watch <ID> --exit-status` |
| run again | `gh run rerun <ID>` (`--failed` for failed jobs only) |
| start a manual run | `gh workflow run <file> -f name=value` |
| a pull request's checks | `gh pr checks` |
| secrets and variables | `gh secret set NAME --body "…"`, `gh variable set NAME --body "…"`, `gh secret list` |
| download artifacts | `gh run download <ID> --name <artifact>` |
| check workflow files | `actionlint` |

| Expression | Means |
|---|---|
| `${{ github.ref }}`, `${{ github.sha }}`, `${{ github.actor }}` | the event's ref, commit and user |
| `${{ matrix.node }}`, `${{ inputs.reason }}` | matrix value, workflow input |
| `${{ steps.<id>.outputs.x }}`, `${{ needs.<job>.outputs.x }}` | outputs (`echo "x=1" >> "$GITHUB_OUTPUT"`) |
| `${{ secrets.NAME }}`, `${{ vars.NAME }}` | secret (masked as `***`), configuration variable |
| `if: failure()`, `if: always()` | run after a failure / whatever happened |
| `${{ hashFiles('package-lock.json') }}` | a fingerprint for cache keys |

Pages deployment: `gh api repos/{owner}/{repo}/pages -X POST -f build_type=workflow` once, then a build job ending in `actions/upload-pages-artifact@v5` (`path: dist`) and a deploy job with `needs: build`, `permissions: pages: write, id-token: write`, `environment: github-pages` and `actions/deploy-pages@v5`.

## Every task at a glance

Generated from the **At a glance** table at the end of each lesson. The number in brackets links to the lesson.

| Task | Command | What it changes | How to undo | Lesson |
|---|---|---|---|---|
| Where am I? | pwd, then ls -a | nothing | — | [1](lessons/01-version-control.md) |
| Make a folder and go in | mkdir -p name && cd name | creates a folder | rm -r name | [1](lessons/01-version-control.md) |
| Write a file | echo "text" > file (>> to append) | replaces (or extends) the file | rewrite the file | [1](lessons/01-version-control.md) |
| Set your identity | git config --global user.name "…" and user.email "…" | ~/.gitconfig | git config --global --unset key | [1](lessons/01-version-control.md) |
| Default branch main | git config --global init.defaultBranch main | ~/.gitconfig | git config --global --unset init.defaultBranch | [1](lessons/01-version-control.md) |
| Start tracking a folder | git init | creates .git | rm -rf .git (deletes all history) | [2](lessons/02-first-commits.md) |
| Stage a change | git add file (git add . for all) | staging area | git restore --staged file | [2](lessons/02-first-commits.md) |
| Save a snapshot | git commit -m "Add price list" | new commit on the branch | git reset --soft HEAD~1 | [2](lessons/02-first-commits.md) |
| Stage tracked files and commit | git commit -am "…" | staging area and history | git reset --soft HEAD~1 | [2](lessons/02-first-commits.md) |
| See where you are | git status | nothing | — | [2](lessons/02-first-commits.md) |
| Short status | git status -s | nothing | — | [3](lessons/03-seeing-changes.md) |
| Unstaged changes | git diff | nothing | — | [3](lessons/03-seeing-changes.md) |
| Staged changes | git diff --staged | nothing | — | [3](lessons/03-seeing-changes.md) |
| Compact history | git log --oneline -n 5 | nothing | — | [3](lessons/03-seeing-changes.md) |
| One commit in full | git show HEAD~1 | nothing | — | [3](lessons/03-seeing-changes.md) |
| A file at a commit | git show HEAD~2:prices.txt | nothing | — | [3](lessons/03-seeing-changes.md) |
| Ignore files | patterns in .gitignore, committed | which files Git sees | remove the pattern | [4](lessons/04-ignoring-files.md) |
| Why is it ignored? | git check-ignore -v path | nothing | — | [4](lessons/04-ignoring-files.md) |
| Stop tracking, keep the file | git rm --cached file, add to .gitignore, commit | index and next commit | git add -f file | [4](lessons/04-ignoring-files.md) |
| Leaked a secret | rotate it first, then remove it from the code | the key itself | — (assume it's public) | [4](lessons/04-ignoring-files.md) |
| Large binary files | git lfs track "*.psd" (own computer) | .gitattributes | git lfs untrack | [4](lessons/04-ignoring-files.md) |
| Throw away edits to a file | git restore file | working tree (edits lost) | — (not recoverable) | [5](lessons/05-undoing.md) |
| Unstage, keep edits | git restore --staged file | staging area | git add file | [5](lessons/05-undoing.md) |
| Fix the last commit | git add …; git commit --amend -m "…" | replaces the last commit | git reset --soft HEAD@{1} (own computer) | [5](lessons/05-undoing.md) |
| Undo commits, keep changes | git reset --soft HEAD~1 (or --mixed) | branch (and index) | git reset ORIG_HEAD | [5](lessons/05-undoing.md) |
| Undo a pushed commit | git revert <commit> | adds a new commit | git revert the revert | [5](lessons/05-undoing.md) |
| Recover after reset --hard | git reflog, then git reset --hard HEAD@{1} | branch and files | — | [5](lessons/05-undoing.md) |
| Which object is this? | git cat-file -t <id> | nothing | — | [6](lessons/06-inside-git.md) |
| Show an object | git cat-file -p <id> (HEAD, HEAD^{tree}, HEAD:file) | nothing | — | [6](lessons/06-inside-git.md) |
| Turn a name into an id | git rev-parse HEAD~1 | nothing | — | [6](lessons/06-inside-git.md) |
| Where does a branch point? | cat .git/refs/heads/main | nothing | — | [6](lessons/06-inside-git.md) |
| What is HEAD? | cat .git/HEAD | nothing | — | [6](lessons/06-inside-git.md) |
| Create a branch and switch to it | git switch -c add-tubes | new branch name; HEAD | git switch main; git branch -d add-tubes | [7](lessons/07-branches.md) |
| Switch branches | git switch main (git switch - for the previous one) | HEAD and your files | git switch - | [7](lessons/07-branches.md) |
| See all branches | git log --oneline --graph --all | nothing | — | [7](lessons/07-branches.md) |
| Put work aside | git stash (-u for untracked files) | working tree and the stash | git stash pop | [7](lessons/07-branches.md) |
| Delete a merged branch | git branch -d add-tubes | the branch name | git branch add-tubes <commit> | [7](lessons/07-branches.md) |
| Merge a branch into the current one | git merge add-tubes | current branch (and a merge commit) | git reset --hard ORIG_HEAD (not pushed yet) | [8](lessons/08-merging.md) |
| Always record a merge | git merge --no-ff add-tubes | current branch, new merge commit | git reset --hard ORIG_HEAD | [8](lessons/08-merging.md) |
| Resolve a conflict | edit the file, git add file, git commit | the merge result | git merge --abort before committing | [8](lessons/08-merging.md) |
| Give up on a merge | git merge --abort | files and branch back to before | — | [8](lessons/08-merging.md) |
| Publish a repository | gh repo create shop --public --source=. --push | a GitHub repository, origin, upstream | gh repo delete (own computer) | [9](lessons/09-remotes.md) |
| Copy a repository | git clone https://github.com/ada/shop.git | a new folder with origin | rm -r shop | [9](lessons/09-remotes.md) |
| Send commits | git push (first time: git push -u origin branch) | the remote branch | git revert, then push | [9](lessons/09-remotes.md) |
| Check for new work | git fetch, then git status | origin/* only | — | [9](lessons/09-remotes.md) |
| Get and integrate new work | git pull | your branch and files | git reset --hard ORIG_HEAD (not pushed yet) | [9](lessons/09-remotes.md) |
| Integrate remote work, keep history straight | git pull --rebase | your unpushed commits get new ids | git reset --hard ORIG_HEAD | [10](lessons/10-syncing.md) |
| Make rebase the default for pull | git config --global pull.rebase true | ~/.gitconfig | git config --global --unset pull.rebase | [10](lessons/10-syncing.md) |
| Update a feature branch | git fetch; git rebase origin/main | the branch's commits are rewritten | git rebase --abort (during) | [10](lessons/10-syncing.md) |
| Push a rewritten branch | git push --force-with-lease | the remote branch | push the old commit back with --force-with-lease | [10](lessons/10-syncing.md) |
| Copy one commit | git cherry-pick <commit> | adds a commit to the current branch | git reset --hard HEAD~1 (not pushed yet) | [10](lessons/10-syncing.md) |
| Open a pull request | git push -u origin branch; gh pr create --title "…" --body "…" | a PR on GitHub | gh pr close <number> | [11](lessons/11-pull-requests.md) |
| Review | gh pr diff <n>; gh pr review <n> --approve (or --request-changes, --comment) | the PR's reviews | submit a new review | [11](lessons/11-pull-requests.md) |
| Merge and tidy up | gh pr merge <n> --squash --delete-branch | base branch on GitHub; branches deleted | git revert the merge commit, in a new PR | [11](lessons/11-pull-requests.md) |
| Get someone's PR locally | gh pr checkout <n> | a local branch | git switch main; git branch -D branch | [11](lessons/11-pull-requests.md) |
| Protect main | ruleset: pull request + approvals, block force pushes (Settings or gh api) | what GitHub accepts | disable or delete the ruleset | [12](lessons/12-team-workflows.md) |
| Undo a commit made on protected main | git switch -c fix; git branch -f main origin/main | your local branches | — | [12](lessons/12-team-workflows.md) |
| Tag a version | git tag -a v1.0.0 -m "First release" | a tag object | git tag -d v1.0.0 (before pushing) | [12](lessons/12-team-workflows.md) |
| Publish the tag | git push origin v1.0.0 | the tag on GitHub | git push origin --delete v1.0.0 (avoid once used) | [12](lessons/12-team-workflows.md) |
| Create a release | gh release create v1.0.0 --generate-notes | a release page | gh release delete v1.0.0 (own computer) | [12](lessons/12-team-workflows.md) |
| Run the project's tests | npm test | nothing | — | [13](lessons/13-ci-cd.md) |
| Start CI on every push to main | .github/workflows/ci.yml with on: push: branches: [main] | a file in the repository | delete the file, or gh workflow disable CI | [13](lessons/13-ci-cd.md) |
| List recent runs | gh run list | nothing | — | [13](lessons/13-ci-cd.md) |
| See a run's jobs | gh run view <ID> | nothing | — | [13](lessons/13-ci-cd.md) |
| Read a run's log | gh run view <ID> --log | nothing | — | [13](lessons/13-ci-cd.md) |
| See why a run failed | gh run view <ID> --log-failed | nothing | — | [14](lessons/14-failing-builds.md) |
| Run a workflow again | gh run rerun <ID> --failed | a new attempt of the run | — | [14](lessons/14-failing-builds.md) |
| Undo the commit that broke main | git revert <commit>; git push | adds a commit | git revert the revert | [14](lessons/14-failing-builds.md) |
| Test pull requests | on: pull_request in the workflow | the workflow file | remove the trigger | [14](lessons/14-failing-builds.md) |
| See a pull request's checks | gh pr checks | nothing | — | [14](lessons/14-failing-builds.md) |
| Require tests to pass | a ruleset with required_status_checks | repository rules | delete or disable the ruleset | [14](lessons/14-failing-builds.md) |
| Run jobs in order | needs: <job> | the workflow file | remove needs | [15](lessons/15-workflow-syntax.md) |
| Test on several versions | strategy: matrix: node: [22, 24, 26] | the workflow file | remove the matrix | [15](lessons/15-workflow-syntax.md) |
| Run a step only on main | if: github.ref == 'refs/heads/main' | the workflow file | remove the if | [15](lessons/15-workflow-syntax.md) |
| Pass a value to later steps | echo "name=value" >> "$GITHUB_OUTPUT" | the step's outputs | — | [15](lessons/15-workflow-syntax.md) |
| Check workflow files | actionlint | nothing | — | [15](lessons/15-workflow-syntax.md) |
| Store a secret | gh secret set NAME --body "…" | encrypted repository secret | gh secret delete NAME | [16](lessons/16-secrets-security.md) |
| Store a setting | gh variable set NAME --body "…" | repository variable | gh variable delete NAME | [16](lessons/16-secrets-security.md) |
| Give a step a secret | env: NAME: ${{ secrets.NAME }} | the workflow file | remove it | [16](lessons/16-secrets-security.md) |
| Limit the token | permissions: contents: read | the workflow file | remove the permissions block | [16](lessons/16-secrets-security.md) |
| Use untrusted text safely | env: X: ${{ … }}, then "$X" in the script | the workflow file | — | [16](lessons/16-secrets-security.md) |
| Pin an action | uses: owner/action@<full SHA> # vX.Y.Z | the workflow file | use the tag again | [16](lessons/16-secrets-security.md) |
| Pass files between jobs | actions/upload-artifact, then actions/download-artifact | the run's artifacts | they expire (90 days by default) | [17](lessons/17-deploying.md) |
| Turn on Pages for workflows | gh api repos/{owner}/{repo}/pages -X POST -f build_type=workflow | repository settings | gh api … -X DELETE | [17](lessons/17-deploying.md) |
| Deploy a static site | upload-pages-artifact + deploy-pages, with pages and id-token write | the live site | deploy an older commit | [17](lessons/17-deploying.md) |
| Deploy by hand | gh workflow run <file> -f name=value | starts a run | — | [17](lessons/17-deploying.md) |
| Check a live page | curl -sSf <url> | nothing | — | [17](lessons/17-deploying.md) |
| Cache a folder | actions/cache with path and key: ${{ hashFiles(…) }} | the repository's caches | gh cache delete <key> | [18](lessons/18-pipelines.md) |
| Skip docs-only changes | paths-ignore: ['**.md'] | the workflow file | remove the filter | [18](lessons/18-pipelines.md) |
| Cancel outdated runs | concurrency: group + cancel-in-progress: true | the workflow file | remove concurrency | [18](lessons/18-pipelines.md) |
| Share a job | on: workflow_call, then uses: ./.github/workflows/x.yml | workflow files | inline the job again | [18](lessons/18-pipelines.md) |
| Run on a schedule | on: schedule: - cron: "30 2 * * *" | the workflow file | gh workflow disable <name> | [18](lessons/18-pipelines.md) |
