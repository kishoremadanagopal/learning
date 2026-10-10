@@ branches
topics: what a branch is (a movable name for a commit), HEAD and the current branch, git branch, git switch -c, git switch -, git checkout -b in older guides, how switching rewrites files, uncommitted changes when switching, git branch -v, git log --oneline --graph --all, git stash, stash list, pop, apply and -u, naming conventions and prefixes, git branch -d and -D, detached HEAD
terms:
- **Branch:** a movable name that points to a commit; committing moves the current branch forward.
- **Current branch:** the branch `HEAD` points to; new commits go onto it.
- **`git switch`:** changes the current branch and updates your files to match it; `-c` creates the branch first.
- **Stash:** a saved set of uncommitted changes, kept aside so you can switch with a clean working tree.
- **Detached HEAD:** `HEAD` pointing straight at a commit instead of a branch; new commits there belong to no branch.
- **Feature branch:** a short-lived branch for one piece of work, merged when it's done.
mistakes:
- Committing on `main` and only then remembering to create a branch.
- Switching branches with uncommitted changes and committing them on the wrong branch.
- Leaving work in the stash for days and forgetting it; commit on a branch instead.
- Deleting an unmerged branch with `-D` without checking what was on it.
- Making commits in detached HEAD and switching away without creating a branch.

glance:
- Create a branch and switch to it | git switch -c add-tubes | new branch name; HEAD | git switch main; git branch -d add-tubes
- Switch branches | git switch main (git switch - for the previous one) | HEAD and your files | git switch -
- See all branches | git log --oneline --graph --all | nothing | —
- Put work aside | git stash (-u for untracked files) | working tree and the stash | git stash pop
- Delete a merged branch | git branch -d add-tubes | the branch name | git branch add-tubes <commit>

@@ merging
topics: git merge, fast-forward merges, the merge base, three-way merges, merge commits with two parents, the default merge message and --no-edit, --no-ff and --ff-only, reading merges in git log --graph, merge conflicts, conflict markers (<<<<<<< ======= >>>>>>>), resolving and marking resolved with git add, finishing with git commit, git merge --abort, conflictStyle zdiff3, editor merge tools, keeping conflicts rare
terms:
- **Merge:** combining the work of another branch into the current one.
- **Fast-forward:** a merge where the current branch has no new commits, so Git just moves it forward.
- **Merge base:** the last commit two branches have in common.
- **Merge commit:** a commit with two parents that joins two lines of history.
- **Merge conflict:** both branches changed the same lines differently; Git stops and asks you to decide.
- **Conflict markers:** the `<<<<<<<`, `=======` and `>>>>>>>` lines Git writes around each clash.
mistakes:
- Merging from the wrong branch: you merge **into** the branch you're on.
- Committing a file that still contains conflict markers.
- Resolving a conflict by blindly taking one side and losing the other side's change.
- Letting a branch live for weeks, so every merge brings big conflicts.
- Using `git merge --abort` after you've already committed the merge (it's too late; use `git reset --hard ORIG_HEAD` if nothing was pushed).

glance:
- Merge a branch into the current one | git merge add-tubes | current branch (and a merge commit) | git reset --hard ORIG_HEAD (not pushed yet)
- Always record a merge | git merge --no-ff add-tubes | current branch, new merge commit | git reset --hard ORIG_HEAD
- Resolve a conflict | edit the file, git add file, git commit | the merge result | git merge --abort before committing
- Give up on a merge | git merge --abort | files and branch back to before | —

@@ remotes
topics: remote repositories and hosting (GitHub, GitLab, Bitbucket), remotes and origin, gh repo create with --source and --push, git remote add and -v, public and private repositories, git clone, remote-tracking branches such as origin/main, origin/HEAD, upstream branches and -u, ahead and behind in git status, git push, pushing new branches, push.autoSetupRemote, git fetch, git pull, rejected pushes (fetch first), signing in with gh auth login, Git Credential Manager and SSH keys, never storing tokens in URLs
terms:
- **Remote:** a named link to another copy of the repository, usually on GitHub.
- **`origin`:** the conventional name for the main remote; `git clone` sets it up.
- **Remote-tracking branch:** your repository's record of a branch on a remote, such as `origin/main`; it moves only when you fetch, pull or push.
- **Upstream:** the remote branch a local branch is paired with, used by plain `git push`, `git pull` and `git status`.
- **Push:** send your commits to a remote branch.
- **Fetch:** download new commits from a remote and update remote-tracking branches, without changing your branches.
- **Pull:** fetch, then integrate the remote branch into your current branch (by merging or rebasing).
- **GitHub CLI (`gh`):** GitHub's official command-line tool for repositories, pull requests, releases and more.
mistakes:
- Trusting `git status` without fetching: it compares with `origin/main` as last seen.
- Pushing a new branch without `-u`, so it has no upstream.
- Starting work without pulling, then hitting a rejected push.
- Putting a password or token inside the remote URL.
- Making a repository public by accident when it contains private data.

glance:
- Publish a repository | gh repo create shop --public --source=. --push | a GitHub repository, origin, upstream | gh repo delete (own computer)
- Copy a repository | git clone https://github.com/ada/shop.git | a new folder with origin | rm -r shop
- Send commits | git push (first time: git push -u origin branch) | the remote branch | git revert, then push
- Check for new work | git fetch, then git status | origin/* only | —
- Get and integrate new work | git pull | your branch and files | git reset --hard ORIG_HEAD (not pushed yet)

@@ syncing
topics: diverged branches, git pull's divergent-branches message, git pull --no-rebase (merge) and --rebase, pull.rebase and pull.ff settings, why rebased commits get new ids, git rebase origin/main on a feature branch, conflicts during a rebase, git rebase --continue, --skip and --abort, which side HEAD is during a rebase, git push --force-with-lease versus --force, --force-if-includes, when rewriting history is safe, git cherry-pick, interactive rebase on your own computer (reword, squash, fixup, drop), rebase.autoStash
terms:
- **Diverged:** two copies of a branch each have commits the other doesn't.
- **Rebase:** replay a branch's commits on top of another commit, creating new commits with new ids.
- **Force push:** replace a remote branch with your version, even if that drops commits it had.
- **`--force-with-lease`:** a force push that refuses if the remote branch changed since you last fetched.
- **Cherry-pick:** apply the change from one commit onto the current branch as a new commit.
- **Interactive rebase:** `git rebase -i`, which lets you reword, squash, reorder or drop your recent commits.
mistakes:
- Force-pushing with plain `--force` and deleting a teammate's commits.
- Rebasing or force-pushing a shared `main`.
- Running `git commit` instead of `git rebase --continue` after resolving a rebase conflict.
- Expecting `HEAD` to be your side during a rebase; it's the branch you're rebasing onto.
- Cherry-picking a whole branch commit by commit instead of merging it.

glance:
- Integrate remote work, keep history straight | git pull --rebase | your unpushed commits get new ids | git reset --hard ORIG_HEAD
- Make rebase the default for pull | git config --global pull.rebase true | ~/.gitconfig | git config --global --unset pull.rebase
- Update a feature branch | git fetch; git rebase origin/main | the branch's commits are rewritten | git rebase --abort (during)
- Push a rewritten branch | git push --force-with-lease | the remote branch | push the old commit back with --force-with-lease
- Copy one commit | git cherry-pick <commit> | adds a commit to the current branch | git reset --hard HEAD~1 (not pushed yet)

@@ pull-requests
topics: what a pull request is, merge requests on GitLab, the pull request workflow, gh pr create with title, body, reviewer and draft, gh pr list and view, what a good PR description contains, Closes #12, small pull requests, reviewing (comment, approve, request changes), not approving your own PR, gh auth switch, gh pr diff and gh pr review, review etiquette, AI reviewers such as Copilot code review, merge methods (merge commit, squash and merge, rebase and merge), gh pr merge --delete-branch, updating main afterwards, git branch -D after a squash merge, fetch --prune
terms:
- **Pull request (PR):** a proposal to merge one branch into another, with a place for review, discussion and automated checks.
- **Reviewer:** a person asked to read the changes and comment, approve or request changes.
- **Draft pull request:** a PR shared for early feedback that can't be merged until it's marked ready.
- **Squash and merge:** merging a PR as one new commit containing all its changes.
- **Rebase and merge:** merging a PR by replaying each of its commits onto the base branch.
- **Head branch / base branch:** the branch with the changes, and the branch it should merge into.
mistakes:
- Opening huge pull requests that nobody can review properly.
- Writing no description, so reviewers can't tell why the change is needed.
- Approving without reading, or blocking on matters of taste.
- Forgetting to update local `main` and delete the branch after merging.
- Deleting the local branch with `-d` after a squash merge and being confused when Git refuses; use `-D` once the PR is merged.

glance:
- Open a pull request | git push -u origin branch; gh pr create --title "…" --body "…" | a PR on GitHub | gh pr close <number>
- Review | gh pr diff <n>; gh pr review <n> --approve (or --request-changes, --comment) | the PR's reviews | submit a new review
- Merge and tidy up | gh pr merge <n> --squash --delete-branch | base branch on GitHub; branches deleted | git revert the merge commit, in a new PR
- Get someone's PR locally | gh pr checkout <n> | a local branch | git switch main; git branch -D branch

@@ team-workflows
topics: rulesets and what they enforce (require a pull request and approvals, block force pushes, restrict deletions, require status checks, require linear history), creating rulesets in Settings or with gh api, ~DEFAULT_BRANCH, branch protection rules, plan availability, rescuing a commit made on a protected main, admin bypass, GitHub flow, trunk-based development and feature flags, Git flow, forks and the upstream remote, semantic versioning, annotated tags and pushing them, GitHub releases with gh release create and --generate-notes, never moving published tags, Conventional Commits and release tools
terms:
- **Ruleset:** a set of rules GitHub enforces on matching branches or tags, such as requiring pull requests.
- **Default branch:** the branch GitHub shows first and merges pull requests into by default, usually `main`.
- **GitHub flow:** short-lived branches merged into an always-deployable `main` through pull requests.
- **Trunk-based development:** everyone merges small changes into `main` at least daily, hiding unfinished work behind feature flags.
- **Feature flag:** a setting that switches code on or off without deploying again.
- **Fork:** your own copy of someone else's repository on GitHub, used to propose changes to projects you can't push to.
- **Semantic Versioning (SemVer):** `MAJOR.MINOR.PATCH` version numbers that say whether a release breaks, adds or fixes.
- **Release:** a GitHub page for a tag, with notes and downloadable files.
mistakes:
- Leaving the default branch unprotected on a team repository.
- Setting a ruleset's enforcement to `evaluate` and assuming it's enforced.
- Using admin bypass as a routine shortcut.
- Moving or deleting a tag that's already published instead of releasing a new version.
- Forgetting that `git push` doesn't send tags.

glance:
- Protect main | ruleset: pull request + approvals, block force pushes (Settings or gh api) | what GitHub accepts | disable or delete the ruleset
- Undo a commit made on protected main | git switch -c fix; git branch -f main origin/main | your local branches | —
- Tag a version | git tag -a v1.0.0 -m "First release" | a tag object | git tag -d v1.0.0 (before pushing)
- Publish the tag | git push origin v1.0.0 | the tag on GitHub | git push origin --delete v1.0.0 (avoid once used)
- Create a release | gh release create v1.0.0 --generate-notes | a release page | gh release delete v1.0.0 (own computer)
