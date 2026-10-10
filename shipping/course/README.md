# Editing the course

Everything in the folder above (the sandbox, `lessons/`, `glossary.md`, `cheatsheet.md` and `README.md`) is generated from the files here. Edit the sources, then rebuild.

```bash
pip install markdown matplotlib
NODE_BIN=/path/to/node22-or-newer python course/build.py --test
```

`--test` runs every example and exercise with the same `shell.js` the browser sandbox uses (in Node.js, each run in a worker thread with a time limit), and fails if a solution doesn't pass its checks, a starter already passes, an exercise has no hint or walkthrough, or an example's error flag is wrong. `--show <lesson-id>` prints each example's output so you can check the lesson text matches it.

| File | What it is |
|---|---|
| `content/part1.md` … | lesson text, examples, exercises and quizzes |
| `content/extras*.md` | each lesson's topics, key terms, common mistakes and At-a-glance rows (task, command, what it changes, how to undo) |
| `content/setups.md` | named setup scripts (`## name` + a sh block) that prepare a sandbox before an example or exercise |
| `content/cheatsheet.md` | the cheat sheet |
| `figures.py` | draws the lesson diagrams in `figures/` |
| `shell.js` | the sandbox terminal: an in-memory file system, a small shell, and git's command-line interface on top of isomorphic-git; later parts register simulated tools |
| `github.js` | everything with more than one repository: clone, remote, fetch, push, pull, rebase, cherry-pick, and the pretend GitHub with the `gh` command (repositories live under `/github.com/<owner>/<name>`; you're signed in as `ada`, with a second account `grace`) |
| `nodejs.js` | the `node` and `npm` commands: runs JavaScript files with ES modules and a few built-in modules, `node --test` with Node.js's spec reporter (fixed durations), and package.json scripts |
| `actions.js` | GitHub Actions on the pretend GitHub: workflows start on push, pull requests, releases and `gh workflow run`; jobs run in a fresh runner shell; expressions, matrices, needs, outputs, secrets, artifacts, caches, environments, Pages deployments; `gh run`, `gh workflow`, `gh secret`, `gh variable`, `gh pr checks`, `actionlint` and `curl` for Pages sites |
| `yamllib.js` | yaml 2.9.1 (eemeli/yaml), bundled with esbuild, for reading workflow files |
| `gitlib.js` | isomorphic-git 1.42.2 with a Buffer polyfill, bundled with esbuild (`esbuild entry.js --bundle --format=esm --minify --inject:shim.js`) |
| `runner.js` | runs JavaScript examples and checks (shared with the JavaScript course) |
| `harness.mjs` | the Node.js test harness |
| `page.html`, `app.js`, `worker.js` | the sandbox page, its logic, and the Web Worker that runs commands |
| `build.py` | builds everything and tests the lesson code |

## Fences

| Fence | Becomes |
|---|---|
| ```` ```sh ```` | a runnable terminal example; ```` ```sh setup=name ```` starts from a named setup; ```` ```sh error ```` expects the last command to fail |
| ```` ```bash ```` , ```` ```yaml ````, ```` ```dockerfile ```` … | shown, not run |
| ```` ```text ```` | output shown as text |

Exercises: ```` ```sh starter ```` (optionally `setup=name`), ```` ```sh setup ```` (an exercise-specific setup), ```` ```sh solution ````, and a ```` ```js check ```` that runs after the learner's commands with these helpers:

| Helper | Use |
|---|---|
| `await repo(path?)` | the Git repository (the one the learner is in, by default): `log(ref)`, `files(ref)`, `staged()`, `status()`, `branch()`, `branches()`, `tags()`, `resolve(ref)`, `config(key)`, `read(path)`, `exists(path)`, `ignored(path)`, `upstream(branch)`, `remotes()`, `remoteBranches()`, `tracking(branch)` (`{upstream, ahead, behind, gone}`), `inProgress()` (`merge`, `rebase`, `cherry-pick` or null) |
| `await github("owner/name")` | a repository on the pretend GitHub: `log(ref)`, `files(ref)`, `branches()`, `resolve(ref)`, `tags()`, `tag(name)` (`{annotated, commit, message}`), `pulls()`, `rulesets()`, `releases()`, `defaultBranch` |
| `await sh("git status -s")` | run more commands in the same sandbox and get their output |
| `read(path)`, `exists(path)`, `isDir(path)` | files (paths relative to the final directory, or `~/…`) |
| `ran(/git add/)`, `commands()` | what the learner typed |
| `same(actual, expected, "what")`, `printed("text")` | comparisons; output |
| `globalConfig(key)`, `cwd()` | the global git config and the final directory |
