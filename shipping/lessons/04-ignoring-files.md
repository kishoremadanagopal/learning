# Lesson 4: .gitignore and what never to commit

**You'll learn:** what doesn't belong in a repository (dependencies, build output, caches, logs, editor and OS files, local settings, secrets, large data), .gitignore syntax (names, *, **, a trailing / for folders, a leading / for the root, comments, ! for exceptions), git status --ignored, git check-ignore -v, global ignores, committing .env.example instead of .env, git rm --cached to untrack a committed file, why removing a secret doesn't remove it from history, rotating leaked secrets, GitHub secret scanning and push protection, history rewriting tools, large files and Git LFS.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/shipping/#ignoring-files)**: run every example and check your exercise answers.

## Key terms

- **`.gitignore`:** a file listing patterns for files Git should not track.
- **Pattern:** a name with wildcards: `*` matches anything except `/`, `**` matches any number of folders.
- **Negation (`!`):** a pattern that re-includes something an earlier pattern ignored.
- **`git check-ignore -v`:** shows which pattern in which file ignores a path.
- **Secret:** a password, API key or token that gives access to something.
- **Rotating a secret:** replacing it with a new one and disabling the old one.
- **Secret scanning:** a service that finds secrets in code; push protection blocks a push that contains one.
- **Git LFS (Large File Storage):** an extension that stores large files outside the repository and keeps small pointers in it.

Some files should never be committed: they're generated, personal, huge, or secret. Committing them bloats the repository, causes pointless conflicts, and in the case of secrets, can be a security incident.

| Don't commit | Examples | Why |
|---|---|---|
| dependencies | `node_modules/`, `.venv/`, `vendor/` | huge, and recreated from `package.json` or `requirements.txt` |
| build output | `dist/`, `build/`, `*.pyc`, `__pycache__/` | generated from the source |
| logs and temporary files | `*.log`, `*.tmp` | change constantly |
| personal and OS files | `.DS_Store`, `Thumbs.db`, `.idea/`, `.vscode/` (usually) | belong to one person's computer |
| secrets | `.env`, `*.pem`, credentials files | anyone with the repository could use them |
| large data and models | `*.csv` exports, `*.parquet`, model weights | Git keeps every version forever |

## .gitignore

A `.gitignore` file in the repository lists patterns of files Git should ignore. Ignored files don't appear in `git status`, and `git add .` skips them:

```bash
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

## Already committed? Untrack it

`.gitignore` only affects untracked files. A file that's already committed stays tracked; to stop tracking it but keep it on disk, remove it from the index:

```bash
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

## Large files

Git stores every version of every file, so a 200 MB dataset committed ten times costs 2 GB in every copy. Keep large data in storage built for it (a database, object storage such as S3, a data catalogue) and commit the code that reads it. When large binary files must live with the code (images for a game, model files), **Git LFS** (Large File Storage) keeps them on a server and only small pointer files in the repository. For data scientists: tools such as **nbstripout** remove outputs from Jupyter notebooks before committing, so diffs show code changes, not megabytes of plots.

## Try it on your own computer

When you start a project, create `.gitignore` before the first commit; GitHub's "Add .gitignore" template menu, or the `github/gitignore` repository, gives you a sensible start. Turn on secret scanning and push protection in your GitHub repository's settings, under **Advanced Security**.

## At a glance

| Task | Command | What it changes | How to undo |
|---|---|---|---|
| Ignore files | patterns in .gitignore, committed | which files Git sees | remove the pattern |
| Why is it ignored? | git check-ignore -v path | nothing | — |
| Stop tracking, keep the file | git rm --cached file, add to .gitignore, commit | index and next commit | git add -f file |
| Leaked a secret | rotate it first, then remove it from the code | the key itself | — (assume it's public) |
| Large binary files | git lfs track "*.psd" (own computer) | .gitattributes | git lfs untrack |

## Common mistakes

- Adding a pattern to `.gitignore` and expecting Git to stop tracking a file it already tracks.
- Deleting a leaked key in a new commit and keeping it in use; it's still in the history, so rotate it.
- Committing `.env` instead of a `.env.example` with placeholder values.
- Ignoring a folder with `logs/` and then trying to re-include one file inside it with `!`; Git doesn't look inside an ignored folder.
- Committing `node_modules`, virtual environments or build output instead of the files that recreate them.

## Exercises

### 1. Write a .gitignore

This project has dependencies, build output, logs and a secrets file lying around. Create a `.gitignore` so that `git status` shows only the files that belong in the repository. Ignore:

- the `node_modules/` and `dist/` folders;
- the `.env` file;
- every `.log` file **except** `keep.log`.

Don't commit anything.

Starter:

```bash
mkdir -p shop/node_modules/express shop/dist shop/src && cd shop && git init -q
echo "app" > src/app.js && echo "lib" > node_modules/express/index.js && echo "bundle" > dist/app.js
echo "KEY=123" > .env && echo "boom" > error.log && echo "debug" > src/debug.log && echo "keep me" > keep.log
echo "# Bike shop" > README.md
git status
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** four rules, one exception, and nothing committed.
2. **Examples:** `src/debug.log` must be ignored too; `keep.log` must stay visible.
3. **Brute force:** listing every file by name: misses the next log file anyone creates.
4. **Pattern:** **patterns for kinds of files, then an exception with `!`**.
5. **Plan:** folders → `.env` → `*.log` → `!keep.log` → check with `git status`.
6. **Code and test:** `git status` should list `.gitignore`, `README.md`, `keep.log` and `src/`.

</details>

<details>
<summary>💡 Hint 1</summary>

Write the file with a here-document: `cat > .gitignore <<'EOF'`, one pattern per line, then a line with just `EOF`.

</details>

<details>
<summary>💡 Hint 2</summary>

A trailing `/` matches folders (`node_modules/`), and `*.log` matches `.log` files in every folder, including `src/debug.log`.

</details>

<details>
<summary>💡 Hint 3</summary>

A line starting with `!` re-includes a file a previous pattern ignored: `!keep.log` after `*.log`. Check with `git status` and `git check-ignore -v <file>`.

</details>

### 2. Stop tracking a secret

Someone committed `.env` (with a password) to this repository. Stop tracking it **without deleting it from disk**, make sure it can't be added again by accident, and commit the fix with the message `Stop tracking .env`. Afterwards the working tree should be clean.

Starter:

```bash
mkdir shop && cd shop && git init -q
echo "app" > app.js && echo "DB_PASSWORD=hunter2" > .env
git add . && git commit -qm "Start the app"
git status
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** untrack, ignore, keep the file, one commit.
2. **Examples:** adding `.env` to `.gitignore` alone does nothing for a file that's already tracked.
3. **Brute force:** `git rm .env`: deletes the file from disk too.
4. **Pattern:** **`git rm --cached` + `.gitignore`**.
5. **Plan:** append `.env` to `.gitignore` → `git rm --cached .env` → `git add .gitignore` → commit.
6. **Code and test:** `git status` clean; `ls -a` shows `.env`; `git show HEAD --stat` shows the removal.

</details>

<details>
<summary>💡 Hint 1</summary>

Two things: ignore it (`.env` in `.gitignore`) and untrack it (`git rm --cached .env`), which removes it from the index but leaves the file.

</details>

<details>
<summary>💡 Hint 2</summary>

`git rm --cached` stages the removal; stage the new `.gitignore` too, then commit both together.

</details>

<details>
<summary>💡 Hint 3</summary>

Check with `git status` (clean) and `ls -a` (`.env` still there). In real life, also change the password: it's still in the first commit.

</details>

**In the sandbox:** exercises 7–8. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Write a .gitignore</summary>

```bash
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

**Line by line**

- `node_modules/` and `dist/` ignore those folders and everything inside them.
- `.env` ignores the secrets file wherever it is.
- `*.log` has no `/`, so it matches log files in every folder: `error.log` and `src/debug.log`.
- `!keep.log` comes after `*.log`, so it wins for that one file: order matters, later lines override earlier ones.

**Trace:** `git status` lists `.gitignore`, `README.md`, `keep.log` and `src/` (which contains only `app.js` now that `debug.log` is ignored).

**Common wrong approach:** putting `!keep.log` before `*.log`: the later `*.log` line ignores it again.

</details>

<details>
<summary>✅ 2. Stop tracking a secret</summary>

```bash
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

**Line by line**

- `echo ".env" >> .gitignore` creates the ignore file with one pattern.
- `git rm --cached .env` stages "delete `.env` from the repository" while leaving the file in the folder.
- `git add .gitignore` stages the new ignore file, so both changes land in one commit.
- After the commit, `.env` is untracked and ignored, so `git status` is clean.

**Trace:** `git show --stat` → `.env | 1 -` and `.gitignore | 1 +`.

**Common wrong approach:** stopping here and keeping the password: it's still in "Start the app", readable with `git show HEAD~1:.env`. Rotate it.

</details>

## Quick quiz

1. You add *.log to .gitignore, but app.log, committed last week, still shows changes. Why?
   - A) .gitignore only affects untracked files; untrack it with git rm --cached app.log
   - B) .gitignore needs a restart of Git
   - C) The pattern should be **.log

2. A teammate committed an API key, then removed it in the next commit. What must happen?
   - A) Revoke or rotate the key: it's still readable in the history
   - B) Nothing, it's been deleted
   - C) Delete the repository's latest commit

3. What does the pattern !keep.log do after *.log?
   - A) Keeps keep.log visible to Git even though *.log matches it
   - B) Ignores only keep.log
   - C) Deletes keep.log

4. Where should .DS_Store (a macOS file) be ignored?
   - A) In your global ignore file (core.excludesFile)
   - B) In every project's .gitignore
   - C) Nowhere; commit it

<details>
<summary>Quiz answers</summary>

1. **A) .gitignore only affects untracked files; untrack it with git rm --cached app.log**: Tracked files stay tracked until you remove them from the index.
2. **A) Revoke or rotate the key: it's still readable in the history**: Treat any committed secret as leaked.
3. **A) Keeps keep.log visible to Git even though *.log matches it**: ! re-includes files an earlier pattern ignored.
4. **A) In your global ignore file (core.excludesFile)**: Files your computer creates belong in your own global ignore file.

</details>

---
Previous: [Lesson 3](03-seeing-changes.md) · Next: [Lesson 5: Undoing things safely](05-undoing.md)
