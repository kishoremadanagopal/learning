@@ ci-cd
topics: what continuous integration, continuous delivery and continuous deployment are, pipelines, why small frequent changes break less (DORA research), the Node.js project (package.json, scripts, prices.js and its tests), npm test and exit statuses, GitHub Actions' building blocks (workflow, event, job, step, runner, action), hosted runner labels and the 2026 image changes, free minutes, YAML maps, lists, block strings and its traps, writing and pushing a first workflow, actions/checkout and actions/setup-node, gh run list and gh run view, reading a run's log, actionlint, act and the VS Code extension
terms:
- **Continuous integration (CI):** merging small changes often, with every change built and tested automatically.
- **Continuous delivery:** every change that passes is ready to release with one action.
- **Continuous deployment:** every change that passes is released automatically.
- **Pipeline:** the automated sequence of steps (build, test, deploy) a change goes through.
- **Exit status:** the number a command returns when it ends: 0 for success, anything else for failure.
- **Workflow:** an automated process defined in a YAML file in `.github/workflows/`.
- **Event:** something that starts a workflow, such as a push or a pull request.
- **Job:** a set of steps that run in order on one runner.
- **Step:** one shell command (`run:`) or one action (`uses:`) in a job.
- **Runner:** the machine, usually a fresh virtual machine, that runs a job.
- **Action:** a packaged, reusable step, like `actions/checkout`.
- **Run:** one execution of a workflow, with an ID.
- **YAML:** a text format for nested data that uses indentation for structure.
mistakes:
- Saving the workflow outside `.github/workflows/` (for example in `.github/workflow/`), so it never runs.
- Indenting YAML with tabs, or misaligning list items.
- Writing `run: echo "Total: 5"`: a colon followed by a space inside a plain value is a YAML error.
- Forgetting `actions/checkout`, so later steps find an empty folder.
- Expecting `git push` to print the CI result; check with `gh run list`.

glance:
- Run the project's tests | npm test | nothing | —
- Start CI on every push to main | .github/workflows/ci.yml with on: push: branches: [main] | a file in the repository | delete the file, or gh workflow disable CI
- List recent runs | gh run list | nothing | —
- See a run's jobs | gh run view <ID> | nothing | —
- Read a run's log | gh run view <ID> --log | nothing | —

@@ failing-builds
topics: reading a failed run (gh run view, annotations, --log-failed), the test runner's failure report, reproducing failures locally, fixing forward and reverting, never rewriting shared history, re-running runs and failed jobs, flaky tests, choosing events (push, pull_request, branches, branches-ignore, tags, paths), filter patterns, the merge commit a pull request run tests, gh pr checks, required status checks in rulesets, strict checks, status badges, notifications
terms:
- **Red / green build:** a failed / passed run.
- **Annotation:** a message attached to a run, such as an error from a step.
- **Fix forward:** correcting a failure with a new commit.
- **Flaky test:** a test that passes or fails on the same code by chance.
- **Trigger:** the event (with filters) that starts a workflow, set in `on:`.
- **Check:** the result of one job on a commit, shown on pull requests.
- **Required status check:** a check that must pass before a branch can be merged into (or pushed to) a protected branch.
- **Merge ref:** `refs/pull/N/merge`, the test merge of a pull request into its base that `pull_request` runs test.
mistakes:
- Changing the test's expected value to make a real bug pass.
- Re-running a red run until it's green instead of fixing a flaky test.
- Force-pushing over a broken commit on a shared branch.
- Renaming a job that a ruleset requires as a status check, which blocks every pull request.
- Using `branches:` on `pull_request` and expecting it to match the head branch: it matches the base.

glance:
- See why a run failed | gh run view <ID> --log-failed | nothing | —
- Run a workflow again | gh run rerun <ID> --failed | a new attempt of the run | —
- Undo the commit that broke main | git revert <commit>; git push | adds a commit | git revert the revert
- Test pull requests | on: pull_request in the workflow | the workflow file | remove the trigger
- See a pull request's checks | gh pr checks | nothing | —
- Require tests to pass | a ruleset with required_status_checks | repository rules | delete or disable the ruleset

@@ workflow-syntax
topics: several jobs and needs, parallel jobs and skipped dependants, matrices (combinations, include, exclude, fail-fast), supported Node.js versions in October 2026, expressions and ${{ }}, contexts (github, env, vars, secrets, matrix, strategy, steps, needs, runner), operators and functions, if conditions and the implicit success(), status functions, env at three levels, GITHUB_ENV, GITHUB_OUTPUT and step outputs, job outputs and needs, workflow commands (notice, warning, error, group, add-mask), actionlint and its rules, debug logging
terms:
- **`needs:`:** a job setting that makes the job wait for other jobs, and skips it if they fail.
- **Matrix:** a set of values that runs a job once per combination.
- **fail-fast:** cancelling the rest of a matrix when one job fails (on by default).
- **Expression:** code between `${{` and `}}`, evaluated by GitHub before a step runs.
- **Context:** an object of information available to expressions, like `github` or `matrix`.
- **Status function:** `success()`, `failure()`, `always()` or `cancelled()` in an `if:`.
- **Step output:** a value a step writes to `$GITHUB_OUTPUT`, read as `steps.<id>.outputs.<name>`.
- **Job output:** a value a job exposes to the jobs that need it.
- **Workflow command:** a line starting with `::` that a step prints to talk to the runner.
- **actionlint:** a linter that checks workflow files for errors before you push.
mistakes:
- Writing `node-version: matrix.node` without `${{ }}`.
- Using double quotes for strings in expressions: they need single quotes.
- Expecting `if: failure()` steps to run in a different job: status functions look at the current job (and its needs).
- Setting a variable with `export` in one step and expecting it in the next; use `$GITHUB_ENV`.
- Using the deprecated `::set-output` command instead of `$GITHUB_OUTPUT`.

glance:
- Run jobs in order | needs: <job> | the workflow file | remove needs
- Test on several versions | strategy: matrix: node: [22, 24, 26] | the workflow file | remove the matrix
- Run a step only on main | if: github.ref == 'refs/heads/main' | the workflow file | remove the if
- Pass a value to later steps | echo "name=value" >> "$GITHUB_OUTPUT" | the step's outputs | —
- Check workflow files | actionlint | nothing | —

@@ secrets-security
topics: env, configuration variables and secrets, gh variable set and gh secret set, masking and its limits, environment secrets, secrets and fork pull requests, the GITHUB_TOKEN, default read-only permissions, the permissions key and least privilege, script injection through expressions and the env fix, third-party actions as a supply-chain risk, the tj-actions compromise of March 2025, pinning to commit SHAs, Dependabot for actions, SHA-pinning policies, pull_request_target and pwn requests, checkout v7's refusal of fork code, OIDC instead of stored cloud keys, zizmor
terms:
- **Secret:** an encrypted value stored on GitHub, given to workflows as `${{ secrets.NAME }}` and masked in logs.
- **Configuration variable:** a non-secret value stored on GitHub, read as `${{ vars.NAME }}`.
- **Masking:** replacing a secret's value with `***` in logs.
- **GITHUB_TOKEN:** the short-lived token each job gets to use GitHub's API for its repository.
- **Least privilege:** giving a token or person only the permissions they need.
- **Script injection:** untrusted text ending up inside a script and running as code.
- **Supply-chain attack:** an attack through software you depend on, such as a compromised action.
- **Pinning:** referring to an exact, unchangeable version, such as a full commit SHA.
- **Dependabot:** GitHub's bot that opens pull requests to update dependencies, including actions.
- **OIDC (OpenID Connect):** a standard for short-lived identity tokens; clouds accept a job's OIDC token instead of a stored key.
mistakes:
- Writing a secret's value in the workflow file or a committed `.env`.
- Printing secrets, or transformed secrets, in logs.
- Putting `${{ github.event… }}` values straight into `run:` scripts.
- Using `permissions: write-all`, or no permissions block in a repository with a write-all default.
- Using third-party actions by a movable tag, or checking out fork code in `pull_request_target`.

glance:
- Store a secret | gh secret set NAME --body "…" | encrypted repository secret | gh secret delete NAME
- Store a setting | gh variable set NAME --body "…" | repository variable | gh variable delete NAME
- Give a step a secret | env: NAME: ${{ secrets.NAME }} | the workflow file | remove it
- Limit the token | permissions: contents: read | the workflow file | remove the permissions block
- Use untrusted text safely | env: X: ${{ … }}, then "$X" in the script | the workflow file | —
- Pin an action | uses: owner/action@<full SHA> # vX.Y.Z | the workflow file | use the tag again

@@ deploying
topics: building once and deploying what was tested, artifacts (upload-artifact, download-artifact, retention, gh run download), GitHub Pages and the GitHub Actions source, upload-pages-artifact and deploy-pages, pages and id-token permissions, the github-pages environment, smoke tests with curl, environments and protection rules (required reviewers, wait timers, deployment branches, environment secrets), workflow_dispatch with typed inputs, deploying on releases and tags, concurrency for deployments, rolling back by reverting or re-running, other static hosts
terms:
- **Artifact:** files a job uploads so later jobs, or people, can download them.
- **GitHub Pages:** GitHub's hosting for static websites, at `https://<owner>.github.io/<repository>/`.
- **Environment:** a named deployment target with its own protection rules and secrets.
- **Protection rule:** a condition a job must meet before deploying to an environment, such as a reviewer's approval.
- **Smoke test:** a quick check that a deployment basically works, such as fetching its home page.
- **workflow_dispatch:** the event for starting a workflow by hand, with optional inputs.
- **Rollback:** returning production to a previous good version.
- **Concurrency group:** a name that makes runs queue (or cancel each other) instead of overlapping.
mistakes:
- Building the site again in the deploy job instead of using the tested artifact.
- Forgetting to set the Pages source to GitHub Actions, or the `pages: write` and `id-token: write` permissions.
- Calling a deployment done without a smoke test.
- Using `cancel-in-progress: true` for deployments, which can stop one halfway.
- Running `gh workflow run` before the `workflow_dispatch` trigger is pushed.

glance:
- Pass files between jobs | actions/upload-artifact, then actions/download-artifact | the run's artifacts | they expire (90 days by default)
- Turn on Pages for workflows | gh api repos/{owner}/{repo}/pages -X POST -f build_type=workflow | repository settings | gh api … -X DELETE
- Deploy a static site | upload-pages-artifact + deploy-pages, with pages and id-token write | the live site | deploy an older commit
- Deploy by hand | gh workflow run <file> -f name=value | starts a run | —
- Check a live page | curl -sSf <url> | nothing | —

@@ pipelines
topics: why speed matters, caching with actions/cache, keys, restore keys and hashFiles, setup-node's npm cache, cache scope, size and expiry, path filters and required checks, concurrency with cancel-in-progress, timeout-minutes, reusable workflows (workflow_call, inputs, secrets), composite actions, sharing from an organisation repository, scheduled workflows (cron fields, UTC, the timezone key, limits, the 60-day rule), what Actions costs in 2026 (included minutes, per-minute prices, larger runners), self-hosted runners and their risks, other CI systems, CI for analysts and AI engineers (SQL tests, notebooks, data contracts, evaluation gates)
terms:
- **Cache:** saved files restored into later jobs, looked up by a key.
- **Cache key:** the name a cache is saved under, usually including a hash of the files it depends on.
- **`hashFiles()`:** an expression function that returns a fingerprint of matching files.
- **Path filter:** `paths` or `paths-ignore` in a trigger, which skips runs that don't touch matching files.
- **Reusable workflow:** a workflow triggered by `workflow_call`, used as a job by other workflows.
- **Composite action:** an action made of steps, defined in an `action.yml`.
- **Cron:** a five-field schedule format: minute, hour, day of month, month, day of week.
- **Self-hosted runner:** your own machine running GitHub's runner program.
- **Evaluation gate:** a CI step that fails when a model's quality score drops below a threshold.
mistakes:
- Using a fixed cache key, so stale dependencies are restored forever.
- Filtering a workflow by path when its job is a required check, which then never reports.
- Forgetting that schedules run in UTC unless a timezone is given.
- Copy-pasting the same jobs into many workflows instead of sharing them.
- Using self-hosted runners for public repositories.

glance:
- Cache a folder | actions/cache with path and key: ${{ hashFiles(…) }} | the repository's caches | gh cache delete <key>
- Skip docs-only changes | paths-ignore: ['**.md'] | the workflow file | remove the filter
- Cancel outdated runs | concurrency: group + cancel-in-progress: true | the workflow file | remove concurrency
- Share a job | on: workflow_call, then uses: ./.github/workflows/x.yml | workflow files | inline the job again
- Run on a schedule | on: schedule: - cron: "30 2 * * *" | the workflow file | gh workflow disable <name>
