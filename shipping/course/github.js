/* github.js: everything in the sandbox that involves more than one repository.
   - git clone, remote, fetch, push and pull, which copy objects between in-memory repositories
   - git rebase and git cherry-pick, which replay commits and stop on conflicts like git does
   - a pretend GitHub: repositories live under /github.com/<owner>/<name>, and the gh command manages them
     (gh repo create/clone/view, gh pr create/list/view/diff/checkout/review/merge/close, gh auth, gh api for rulesets)
   shell.js calls installGitHub() with the pieces of its Git engine this file builds on. */

export function installGitHub(api) {
  const {
    git, GIT_COMMANDS, GitError, parseOpts, resolveCommit, filesAt, headOid, statusInfo, switchFiles,
    mergeText, unifiedDiff, short, identity, writeWork, registerCommand, ancestors, upstreamOf, getConfigValue,
    findRoot, gitDate, conflictedPaths, summaryLine, diffLines, splitLines, START,
  } = api;

  const GH = "/github.com";
  const HOST = "github.com";
  const USERS = {
    ada: { name: "Ada Lovelace", email: "ada@example.com" },
    grace: { name: "Grace Hopper", email: "grace@example.com" },
  };
  const GITHUB_BOT = { name: "GitHub", email: "noreply@github.com" };
  // Other parts of the sandbox (GitHub Actions in actions.js) plug in here.
  const hooks = { afterRefUpdate: [], prEvent: null, releaseEvent: null, checksFor: null, ghCommands: {}, prSubcommands: {}, apiRoutes: [] };

  const refOid = (sh, dir, ref) => git.resolveRef({ fs: sh.fs, dir, ref }).catch(() => null);
  const currentBranch = (sh, dir) => git.currentBranch({ fs: sh.fs, dir, fullname: false }).catch(() => undefined);
  const subjectOf = (message) => message.split("\n")[0];
  const isAncestor = async (sh, dir, a, b) => a === b || (await ancestors(sh, dir, b)).has(a);
  const hint = (text) => text.split("\n").map((l) => (l ? `hint: ${l}` : "hint:")).join("\n") + "\n";
  const clockNow = (sh) => START + 60 * sh.commits;

  /* ------------------------------------------------------------ where a remote lives */

  // https://github.com/ada/shop.git, git@github.com:ada/shop.git, or a path to another repository.
  function parseUrl(sh, url) {
    const m = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(url);
    if (m) return { dir: `${GH}/${m[1]}/${m[2]}`, github: true, ssh: !url.startsWith("https:"), owner: m[1], repo: m[2], url };
    return { dir: sh.abs(url.replace(/\/\.git\/?$/, "")), github: false, url };
  }
  const displayUrl = (url) => url.replace(/\/+$/, "").replace(/\.git$/, "");
  const looksLikeUrl = (s) => /[/:]/.test(s) || s.startsWith(".") || s.startsWith("~");

  function notARepository(name) {
    return new GitError(`fatal: '${name}' does not appear to be a git repository\nfatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists.`);
  }
  function repositoryNotFound(t) {
    if (t.github && t.ssh) return new GitError("ERROR: Repository not found.\nfatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists.");
    if (t.github) return new GitError(`remote: Repository not found.\nfatal: repository '${t.url.endsWith("/") ? t.url : t.url + "/"}' not found`);
    return notARepository(t.url);
  }

  async function remoteNames(sh, dir) {
    return (await git.listRemotes({ fs: sh.fs, dir }).catch(() => [])).map((r) => r.remote);
  }
  async function remoteUrl(sh, dir, name) {
    return git.getConfig({ fs: sh.fs, dir, path: `remote.${name}.url` }).catch(() => undefined);
  }

  // A remote by name (origin) or URL, checked to exist.
  async function openRemote(sh, dir, nameOrUrl) {
    let url = await remoteUrl(sh, dir, nameOrUrl), name = nameOrUrl;
    if (!url) {
      if (!looksLikeUrl(nameOrUrl)) throw notARepository(nameOrUrl);
      url = nameOrUrl;
      name = null;
    }
    const t = parseUrl(sh, url);
    if (!sh.fs.isDir(t.dir + "/.git")) throw repositoryNotFound(t);
    return { name, ...t };
  }

  async function branchesOf(sh, dir) {
    const map = new Map();
    for (const b of (await git.listBranches({ fs: sh.fs, dir })).sort()) {
      const oid = await refOid(sh, dir, `refs/heads/${b}`);
      if (oid) map.set(b, oid);
    }
    return map;
  }
  async function tagsOf(sh, dir) {
    const map = new Map();
    for (const t of (await git.listTags({ fs: sh.fs, dir })).sort()) map.set(t, await refOid(sh, dir, `refs/tags/${t}`));
    return map;
  }
  function defaultBranchOf(sh, dir) {
    const head = sh.fs.text(dir + "/.git/HEAD") ?? "";
    const m = /^ref: refs\/heads\/(.+)$/m.exec(head);
    return m ? m[1] : "main";
  }

  // Objects are content-addressed, so copying the files under .git/objects that the other side lacks is a correct
  // (if generous) transfer. The sandbox never packs objects, so they're all loose files.
  async function copyObjects(sh, fromDir, toDir) {
    const src = fromDir + "/.git/objects/", dst = toDir + "/.git/objects/";
    let n = 0;
    for (const f of sh.fs.walkFiles(fromDir + "/.git/objects")) {
      const rel = f.slice(src.length);
      if (rel.startsWith("info/") || rel.startsWith("pack/")) continue;
      if (sh.fs.exists(dst + rel)) continue;
      await sh.fs.mkdir(sh.fs.parent(dst + rel), { recursive: true });
      await sh.fs.writeFile(dst + rel, await sh.fs.readFile(f));
      n++;
    }
    return n;
  }
  const hasObject = async (sh, dir, oid) => !!(await git.readObject({ fs: sh.fs, dir, oid, format: "deflated" }).catch(() => null));

  async function setUpstream(sh, dir, branch, remote, merge) {
    await git.setConfig({ fs: sh.fs, dir, path: `branch.${branch}.remote`, value: remote });
    await git.setConfig({ fs: sh.fs, dir, path: `branch.${branch}.merge`, value: `refs/heads/${merge}` });
  }

  /* ------------------------------------------------------------ GitHub's own records: pull requests, rules */

  function ghPath(dir) { return dir + "/.git/github.json"; }
  function ghLoad(sh, dir) {
    const text = sh.fs.text(ghPath(dir));
    return text ? JSON.parse(text) : { pulls: [], rulesets: [], nextNumber: 1, private: false, description: "" };
  }
  async function ghSave(sh, dir, data) { await sh.fs.writeFile(ghPath(dir), JSON.stringify(data, null, 2)); }

  // The rules that apply to a branch: { pr: approvals | null, noForce, noDelete, names }.
  function rulesFor(sh, dir, branch) {
    const data = ghLoad(sh, dir);
    const def = defaultBranchOf(sh, dir);
    const out = { pr: null, noForce: false, noDelete: false, checks: [] };
    for (const rs of data.rulesets || []) {
      if (rs.enforcement !== "active") continue;
      const inc = rs.conditions?.ref_name?.include ?? [];
      const exc = rs.conditions?.ref_name?.exclude ?? [];
      const matches = (pat) => pat === "~ALL" || (pat === "~DEFAULT_BRANCH" && branch === def) || pat === `refs/heads/${branch}`
        || (pat.endsWith("*") && `refs/heads/${branch}`.startsWith(pat.slice(0, -1)));
      if (!inc.some(matches) || exc.some(matches)) continue;
      for (const r of rs.rules || []) {
        if (r.type === "pull_request") out.pr = Math.max(out.pr ?? 0, r.parameters?.required_approving_review_count ?? 0);
        if (r.type === "non_fast_forward") out.noForce = true;
        if (r.type === "deletion") out.noDelete = true;
        if (r.type === "required_status_checks") for (const c of r.parameters?.required_status_checks ?? []) if (c?.context && !out.checks.includes(c.context)) out.checks.push(c.context);
      }
    }
    return out;
  }

  /* ------------------------------------------------------------ git clone */

  GIT_COMMANDS.clone = async (sh, _dir, args, io) => {
    const { opts, rest } = parseOpts(args, { "-b|--branch": "value", "-q|--quiet": "bool", "--depth": "value", "-o|--origin": "value" });
    if (!rest.length) throw new GitError("fatal: You must specify a repository to clone.", 129);
    const url = rest[0];
    const t = parseUrl(sh, url);
    const name = rest[1] ?? url.replace(/\/+$/, "").replace(/\.git$/, "").split(/[/:]/).pop();
    const target = sh.abs(name);
    if (sh.fs.exists(target) && (!sh.fs.isDir(target) || (await sh.fs.readdir(target)).length)) {
      throw new GitError(`fatal: destination path '${name}' already exists and is not an empty directory.`);
    }
    if (!opts["-q"]) io.err(`Cloning into '${name}'...\n`);
    if (!sh.fs.isDir(t.dir + "/.git")) throw repositoryNotFound(t);
    const origin = opts["-o"] ?? "origin";
    const heads = await branchesOf(sh, t.dir);
    const def = defaultBranchOf(sh, t.dir);
    await sh.fs.mkdir(target, { recursive: true });
    const checkoutBranch = opts["-b"] ?? def;
    await git.init({ fs: sh.fs, dir: target, defaultBranch: checkoutBranch });
    await copyObjects(sh, t.dir, target);
    await git.addRemote({ fs: sh.fs, dir: target, remote: origin, url });
    for (const [b, oid] of heads) await git.writeRef({ fs: sh.fs, dir: target, ref: `refs/remotes/${origin}/${b}`, value: oid });
    for (const [tag, oid] of await tagsOf(sh, t.dir)) await git.writeRef({ fs: sh.fs, dir: target, ref: `refs/tags/${tag}`, value: oid });
    if (!heads.size) {
      io.err("warning: You appear to have cloned an empty repository.\n");
    } else {
      if (heads.has(def)) await git.writeRef({ fs: sh.fs, dir: target, ref: `refs/remotes/${origin}/HEAD`, value: `refs/remotes/${origin}/${def}`, symbolic: true, force: true });
      if (!heads.has(checkoutBranch)) {
        await sh.fs.writeFile(target + "/.git/HEAD", `ref: refs/heads/${def}\n`);
        throw new GitError(`warning: Could not find remote branch ${checkoutBranch} to clone.\nfatal: Remote branch ${checkoutBranch} not found in upstream ${origin}`);
      }
      await git.writeRef({ fs: sh.fs, dir: target, ref: `refs/heads/${checkoutBranch}`, value: heads.get(checkoutBranch), force: true });
      await setUpstream(sh, target, checkoutBranch, origin, checkoutBranch);
      await git.checkout({ fs: sh.fs, dir: target, ref: checkoutBranch, force: true });
    }
    if (!t.github && !opts["-q"]) io.err("done.\n");
    return 0;
  };

  /* ------------------------------------------------------------ git remote */

  GIT_COMMANDS.remote = async (sh, dir, args, io) => {
    const sub = args[0] && !args[0].startsWith("-") ? args[0] : null;
    const rest = sub ? args.slice(1) : args;
    const names = await remoteNames(sh, dir);
    if (!sub) {
      const verbose = rest.includes("-v") || rest.includes("--verbose");
      for (const n of names.sort()) {
        const url = await remoteUrl(sh, dir, n);
        io.out(verbose ? `${n}\t${url} (fetch)\n${n}\t${url} (push)\n` : `${n}\n`);
      }
      return 0;
    }
    if (sub === "add") {
      const [name, url] = rest.filter((a) => !a.startsWith("-"));
      if (!name || !url) throw new GitError("usage: git remote add [<options>] <name> <url>", 129);
      if (names.includes(name)) throw new GitError(`error: remote ${name} already exists.`, 3);
      await git.addRemote({ fs: sh.fs, dir, remote: name, url });
      return 0;
    }
    if (sub === "remove" || sub === "rm") {
      const [name] = rest;
      if (!names.includes(name)) throw new GitError(`error: No such remote: '${name}'`, 2);
      await git.deleteRemote({ fs: sh.fs, dir, remote: name });
      for (const b of await git.listBranches({ fs: sh.fs, dir, remote: name }).catch(() => [])) {
        await git.deleteRef({ fs: sh.fs, dir, ref: `refs/remotes/${name}/${b}` }).catch(() => {});
      }
      for (const b of await git.listBranches({ fs: sh.fs, dir })) {
        if ((await git.getConfig({ fs: sh.fs, dir, path: `branch.${b}.remote` })) === name) {
          await git.setConfig({ fs: sh.fs, dir, path: `branch.${b}.remote`, value: undefined });
          await git.setConfig({ fs: sh.fs, dir, path: `branch.${b}.merge`, value: undefined });
        }
      }
      return 0;
    }
    if (sub === "rename") {
      const [from, to] = rest;
      if (!names.includes(from)) throw new GitError(`error: No such remote: '${from}'`, 2);
      if (names.includes(to)) throw new GitError(`error: remote ${to} already exists.`, 3);
      const url = await remoteUrl(sh, dir, from);
      const refs = [];
      for (const b of await git.listBranches({ fs: sh.fs, dir, remote: from }).catch(() => [])) {
        if (b === "HEAD") continue;
        refs.push([b, await refOid(sh, dir, `refs/remotes/${from}/${b}`)]);
      }
      const head = sh.fs.text(dir + `/.git/refs/remotes/${from}/HEAD`);
      await GIT_COMMANDS.remote(sh, dir, ["remove", from], io);
      await git.addRemote({ fs: sh.fs, dir, remote: to, url });
      for (const [b, oid] of refs) await git.writeRef({ fs: sh.fs, dir, ref: `refs/remotes/${to}/${b}`, value: oid });
      if (head) await git.writeRef({ fs: sh.fs, dir, ref: `refs/remotes/${to}/HEAD`, value: head.replace(/^ref: /, "").trim().replace(`refs/remotes/${from}/`, `refs/remotes/${to}/`), symbolic: true, force: true });
      return 0;
    }
    if (sub === "get-url") {
      const [name] = rest;
      if (!names.includes(name)) throw new GitError(`error: No such remote '${name}'`, 2);
      io.out((await remoteUrl(sh, dir, name)) + "\n");
      return 0;
    }
    if (sub === "set-url") {
      const [name, url] = rest;
      if (!names.includes(name)) throw new GitError(`error: No such remote '${name}'`, 2);
      await git.setConfig({ fs: sh.fs, dir, path: `remote.${name}.url`, value: url });
      return 0;
    }
    if (sub === "show") {
      const [name] = rest;
      if (!names.includes(name)) throw notARepository(name);
      const r = await openRemote(sh, dir, name);
      const url = await remoteUrl(sh, dir, name);
      const heads = await branchesOf(sh, r.dir);
      let out = `* remote ${name}\n  Fetch URL: ${url}\n  Push  URL: ${url}\n  HEAD branch: ${defaultBranchOf(sh, r.dir)}\n`;
      out += `  Remote branch${heads.size === 1 ? "" : "es"}:\n`;
      const w = Math.max(...[...heads.keys()].map((b) => b.length));
      for (const b of heads.keys()) out += `    ${b.padEnd(w)} ${(await refOid(sh, dir, `refs/remotes/${name}/${b}`)) ? "tracked" : "new (next fetch will store in remotes/" + name + ")"}\n`;
      io.out(out);
      return 0;
    }
    throw new GitError(`error: unknown subcommand: \`${sub}'`, 129);
  };

  /* ------------------------------------------------------------ git fetch */

  function refLine(flag, summary, from, to, width, error) {
    return ` ${flag} ${summary.padEnd(17)} ${from.padEnd(width)} -> ${to}${error ? `  (${error})` : ""}\n`;
  }

  async function doFetch(sh, dir, remoteName, io, { prune = false, quiet = false, only = null, explicit = false } = {}) {
    const r = await openRemote(sh, dir, remoteName);
    await copyObjects(sh, r.dir, dir);
    const heads = await branchesOf(sh, r.dir);
    const lines = [];
    const stored = remoteName && r.name;
    if (explicit && only) lines.push(["*", "branch", only, "FETCH_HEAD"]);
    if (stored && prune) {
      for (const b of (await git.listBranches({ fs: sh.fs, dir, remote: r.name }).catch(() => [])).sort()) {
        if (b === "HEAD" || heads.has(b)) continue;
        await git.deleteRef({ fs: sh.fs, dir, ref: `refs/remotes/${r.name}/${b}` });
        lines.push(["-", "[deleted]", "(none)", `${r.name}/${b}`]);
      }
    }
    if (stored) {
      for (const [b, oid] of heads) {
        if (only && b !== only) continue;
        const old = await refOid(sh, dir, `refs/remotes/${r.name}/${b}`);
        if (old === oid) continue;
        if (!old) lines.push(["*", "[new branch]", b, `${r.name}/${b}`]);
        else if (await isAncestor(sh, dir, old, oid)) lines.push([" ", `${short(old)}..${short(oid)}`, b, `${r.name}/${b}`]);
        else lines.push(["+", `${short(old)}...${short(oid)}`, b, `${r.name}/${b}`, "forced update"]);
        await git.writeRef({ fs: sh.fs, dir, ref: `refs/remotes/${r.name}/${b}`, value: oid, force: true });
      }
      const def = defaultBranchOf(sh, r.dir);
      if (heads.has(def) && !sh.fs.exists(dir + `/.git/refs/remotes/${r.name}/HEAD`)) {
        await git.writeRef({ fs: sh.fs, dir, ref: `refs/remotes/${r.name}/HEAD`, value: `refs/remotes/${r.name}/${def}`, symbolic: true, force: true });
      }
      for (const [tag, oid] of await tagsOf(sh, r.dir)) {
        if (await refOid(sh, dir, `refs/tags/${tag}`)) continue;
        await git.writeRef({ fs: sh.fs, dir, ref: `refs/tags/${tag}`, value: oid });
        lines.push(["*", "[new tag]", tag, tag]);
      }
    }
    if (lines.length && !quiet) {
      const width = Math.max(10, ...lines.map((l) => l[2].length));
      io.err(`From ${displayUrl(r.url)}\n` + lines.map(([f, s, from, to, e]) => refLine(f, s, from, to, width, e)).join(""));
    }
    return { remote: r, heads };
  }

  GIT_COMMANDS.fetch = async (sh, dir, args, io) => {
    const { opts, rest } = parseOpts(args, { "-p|--prune": "bool", "--all": "bool", "-q|--quiet": "bool", "--tags": "bool", "-v|--verbose": "bool" });
    const prune = opts["-p"] || (await getConfigValue(sh, dir, "fetch.prune")) === "true";
    const names = await remoteNames(sh, dir);
    if (opts["--all"]) {
      for (const n of names) await doFetch(sh, dir, n, io, { prune, quiet: opts["-q"] });
      return 0;
    }
    let name = rest[0];
    if (!name) {
      const branch = await currentBranch(sh, dir);
      const up = branch ? await upstreamOf(sh, dir, branch) : null;
      name = up?.remote ?? (names.includes("origin") ? "origin" : names[0]);
      if (!name) throw new GitError("fatal: No remote repository specified.  Please, specify either a URL or a\nremote name from which new revisions should be fetched.");
    }
    await doFetch(sh, dir, name, io, { prune, quiet: opts["-q"], only: rest[1] ?? null, explicit: !!rest[1] });
    return 0;
  };

  /* ------------------------------------------------------------ git push */

  const ADVICE = {
    pullBeforePush: "Updates were rejected because the tip of your current branch is behind\nits remote counterpart. If you want to integrate the remote changes,\nuse 'git pull' before pushing again.\nSee the 'Note about fast-forwards' in 'git push --help' for details.",
    checkoutPullPush: "Updates were rejected because a pushed branch tip is behind its remote\ncounterpart. If you want to integrate the remote changes, use 'git pull'\nbefore pushing again.\nSee the 'Note about fast-forwards' in 'git push --help' for details.",
    fetchFirst: "Updates were rejected because the remote contains work that you do not\nhave locally. This is usually caused by another repository pushing to\nthe same ref. If you want to integrate the remote changes, use\n'git pull' before pushing again.\nSee the 'Note about fast-forwards' in 'git push --help' for details.",
    tagExists: "Updates were rejected because the tag already exists in the remote.",
  };

  GIT_COMMANDS.push = async (sh, dir, args, io) => {
    const { opts, rest } = parseOpts(args, { "-u|--set-upstream": "bool", "-f|--force": "bool", "--force-with-lease": "bool", "-d|--delete": "bool",
      "--tags": "bool", "-q|--quiet": "bool", "--all": "bool", "--no-verify": "bool" });
    const branch = await currentBranch(sh, dir);
    const names = await remoteNames(sh, dir);
    let remoteName = rest[0];
    let specs = rest.slice(1);
    const up = branch ? await upstreamOf(sh, dir, branch) : null;
    const defaultRemote = up?.remote ?? (names.includes("origin") ? "origin" : names[0]);
    if (!remoteName) {
      if (!defaultRemote) {
        throw new GitError("fatal: No configured push destination.\nEither specify the URL from the command-line or configure a remote repository using\n\n    git remote add <name> <url>\n\nand then push using the remote name\n\n    git push <name>\n\nTo push to multiple remotes at once, configure a remote group using\n\n    git config remotes.<groupname> \"<remote1> <remote2>\"\n\nand then push using the group name\n\n    git push <groupname>\n");
      }
      remoteName = defaultRemote;
    }
    const r = await openRemote(sh, dir, remoteName);
    let setUp = !!opts["-u"];
    if (!specs.length && !opts["--tags"] && !opts["--all"]) {
      if (!branch) throw new GitError("fatal: You are not currently on a branch.\nTo push the history leading to the current (detached HEAD)\nstate now, use\n\n    git push " + remoteName + " HEAD:<name-of-remote-branch>\n");
      const auto = (await getConfigValue(sh, dir, "push.autoSetupRemote")) === "true";
      if (up && up.remote === remoteName) specs = [`${branch}:${up.merge}`];
      else if (!up && remoteName === defaultRemote && !auto) {
        throw new GitError(`fatal: The current branch ${branch} has no upstream branch.\nTo push the current branch and set the remote as upstream, use\n\n    git push --set-upstream ${remoteName} ${branch}\n\nTo have this happen automatically for branches without a tracking\nupstream, see 'push.autoSetupRemote' in 'git help config'.\n`);
      } else {
        specs = [branch];
        if (!up && auto) setUp = true;
      }
    }
    if (opts["--all"]) specs.push(...(await git.listBranches({ fs: sh.fs, dir })).sort());
    if (opts["--tags"]) specs.push(...(await git.listTags({ fs: sh.fs, dir })).sort().map((t) => `refs/tags/${t}`));

    const results = [];   // { flag, summary, from, to, msg, ok, reason, dstRef, newOid, srcBranch }
    const remoteMsgs = [];
    const rejectReasons = new Set();
    for (let spec of specs) {
      let force = !!opts["-f"];
      if (spec.startsWith("+")) { force = true; spec = spec.slice(1); }
      let src, dst;
      if (opts["-d"]) { src = null; dst = spec; }
      else if (spec.startsWith(":")) { src = null; dst = spec.slice(1); }
      else [src, dst] = spec.includes(":") ? spec.split(":") : [spec, spec];
      const isTag = (src && (src.startsWith("refs/tags/") || (!(await refOid(sh, dir, `refs/heads/${src}`)) && (await refOid(sh, dir, `refs/tags/${src}`))))) || dst.startsWith("refs/tags/")
        || (!src && !(await refOid(sh, r.dir, `refs/heads/${dst}`)) && !!(await refOid(sh, r.dir, `refs/tags/${dst}`)));
      const bare = (n) => n.replace(/^refs\/(heads|tags)\//, "");
      let srcOid = null, srcBranch = null;
      if (src) {
        const name = bare(src);
        if (name === "HEAD") { srcOid = await headOid(sh, dir); srcBranch = branch; }
        else if (isTag) srcOid = await refOid(sh, dir, `refs/tags/${name}`);
        else {
          srcOid = await refOid(sh, dir, `refs/heads/${name}`);
          srcBranch = srcOid ? name : null;
          if (!srcOid) srcOid = await resolveCommit(sh, dir, name).catch(() => null);
        }
        if (!srcOid) throw new GitError(`error: src refspec ${name} does not match any\nerror: failed to push some refs to '${r.url}'`, 1);
      }
      let dstName = bare(dst);
      if (dstName === "HEAD") dstName = branch;
      const dstRef = `refs/${isTag ? "tags" : "heads"}/${dstName}`;
      const fromLabel = src ? bare(src) : null;
      const old = await refOid(sh, r.dir, dstRef);
      const res = { from: fromLabel, to: dstName, dstRef, newOid: srcOid, srcBranch, ok: false, isTag };
      const rules = r.github && !isTag ? rulesFor(sh, r.dir, dstName) : { pr: null, noForce: false, noDelete: false, checks: [] };
      const ruleBlock = (why) => {
        remoteMsgs.push(`remote: error: GH013: Repository rule violations found for ${dstRef}.\nremote: Review all repository rules at https://github.com/${r.owner}/${r.repo}/rules?ref=${encodeURIComponent(dstRef)}\nremote: \nremote: - ${why}\nremote: \n`);
        Object.assign(res, { flag: "!", summary: "[remote rejected]", msg: "push declined due to repository rule violations" });
      };
      if (!src) {
        if (!old) throw new GitError(`error: unable to delete '${dstName}': remote ref does not exist\nerror: failed to push some refs to '${r.url}'`, 1);
        if (rules.noDelete) ruleBlock("Cannot delete this branch.");
        else if (dstName === defaultBranchOf(sh, r.dir) && r.github) {
          Object.assign(res, { flag: "!", summary: "[remote rejected]", msg: "refusing to delete the current branch: " + dstRef });
        } else Object.assign(res, { flag: "-", summary: "[deleted]", ok: true, deleted: true });
      } else if (old === srcOid) {
        Object.assign(res, { upToDate: true, ok: true });
      } else if (!old) {
        if (rules.pr !== null) ruleBlock("Changes must be made through a pull request.");
        else Object.assign(res, { flag: "*", summary: isTag ? "[new tag]" : "[new branch]", ok: true, created: true });
      } else {
        const haveOld = await hasObject(sh, dir, old);
        const ff = haveOld && (await isAncestor(sh, dir, old, srcOid));
        if (isTag && !force) {
          Object.assign(res, { flag: "!", summary: "[rejected]", msg: "already exists" });
          rejectReasons.add("tagExists");
        } else if (!ff && !force && !opts["--force-with-lease"]) {
          Object.assign(res, { flag: "!", summary: "[rejected]", msg: haveOld ? "non-fast-forward" : "fetch first" });
          rejectReasons.add(!haveOld ? "fetchFirst" : srcBranch === branch ? "pullBeforePush" : "checkoutPullPush");
        } else if (!ff && opts["--force-with-lease"] && !force && (await refOid(sh, dir, `refs/remotes/${remoteName}/${dstName}`)) !== old) {
          Object.assign(res, { flag: "!", summary: "[rejected]", msg: "stale info" });
        } else if (rules.pr !== null) {
          ruleBlock("Changes must be made through a pull request.");
        } else if (rules.checks.length) {
          ruleBlock(rules.checks.map((c) => `Required status check "${c}" is expected.`).join("\nremote: - "));
        } else if (!ff && rules.noForce) {
          ruleBlock("Cannot force-push to this branch");
        } else if (ff) {
          Object.assign(res, { flag: " ", summary: `${short(old)}..${short(srcOid)}`, ok: true });
        } else {
          Object.assign(res, { flag: "+", summary: `${short(old)}...${short(srcOid)}`, msg: "forced update", ok: true });
        }
      }
      res.old = old;
      results.push(res);
    }

    const changed = results.filter((x) => !x.upToDate);
    if (!changed.length) {
      if (!opts["-q"]) io.err("Everything up-to-date\n");
      if (setUp) for (const x of results) if (x.srcBranch && r.name) { await setUpstream(sh, dir, x.srcBranch, r.name, x.to); if (!opts["-q"]) io.out(`branch '${x.srcBranch}' set up to track '${r.name}/${x.to}'.\n`); }
      return 0;
    }
    // apply the accepted updates
    if (changed.some((x) => x.ok)) await copyObjects(sh, dir, r.dir);
    const def = defaultBranchOf(sh, r.dir);
    for (const x of changed) {
      if (!x.ok) continue;
      if (x.deleted) {
        await git.deleteRef({ fs: sh.fs, dir: r.dir, ref: x.dstRef });
        if (r.name) await git.deleteRef({ fs: sh.fs, dir, ref: `refs/remotes/${r.name}/${x.to}` }).catch(() => {});
        continue;
      }
      await git.writeRef({ fs: sh.fs, dir: r.dir, ref: x.dstRef, value: x.newOid, force: true });
      if (r.name && !x.isTag) await git.writeRef({ fs: sh.fs, dir, ref: `refs/remotes/${r.name}/${x.to}`, value: x.newOid, force: true });
      if (r.github && x.created && !x.isTag && x.to !== def && !(await openPullFor(sh, r.dir, x.to))) {
        remoteMsgs.push(`remote: \nremote: Create a pull request for '${x.to}' on GitHub by visiting:\nremote:      https://github.com/${r.owner}/${r.repo}/pull/new/${x.to}\nremote: \n`);
      }
    }
    if (r.github) {
      const updates = changed.filter((x) => x.ok).map((x) => ({ ref: x.dstRef, before: x.old, after: x.deleted ? null : x.newOid, deleted: !!x.deleted }));
      for (const h of hooks.afterRefUpdate) await h(sh, r.dir, updates, ghState(sh).user);
    }
    if (!opts["-q"] || changed.some((x) => !x.ok)) {
      let out = remoteMsgs.join("") + `To ${r.url}\n`;
      for (const x of changed) {
        const label = x.from ? `${x.from} -> ${x.to}` : x.to;
        out += ` ${x.flag} ${x.summary.padEnd(17)} ${label}${x.msg ? ` (${x.msg})` : ""}\n`;
      }
      io.err(out);
    }
    const failed = changed.some((x) => !x.ok);
    if (failed) {
      let msg = `error: failed to push some refs to '${r.url}'\n`;
      for (const reason of ["pullBeforePush", "checkoutPullPush", "fetchFirst", "tagExists"]) if (rejectReasons.has(reason)) { msg += hint(ADVICE[reason]); break; }
      io.err(msg);
    }
    if (setUp) {
      for (const x of results) {
        if (!x.ok || !x.srcBranch || !r.name || x.isTag) continue;
        await setUpstream(sh, dir, x.srcBranch, r.name, x.to);
        if (!opts["-q"]) io.out(`branch '${x.srcBranch}' set up to track '${r.name}/${x.to}'.\n`);
      }
    }
    return failed ? 1 : 0;
  };

  /* ------------------------------------------------------------ git pull */

  GIT_COMMANDS.pull = async (sh, dir, args, io) => {
    const { opts, rest } = parseOpts(args, { "-r|--rebase": "bool", "--no-rebase": "bool", "--ff-only": "bool", "--ff": "bool", "--no-ff": "bool", "-q|--quiet": "bool" });
    const branch = await currentBranch(sh, dir);
    if (!branch) throw new GitError("You are not currently on a branch.\nPlease specify which branch you want to merge with.\nSee git-pull(1) for details.\n\n    git pull <remote> <branch>\n", 1);
    const info = await statusInfo(sh, dir);
    if (conflictedPaths(sh, dir, info).length) {
      throw new GitError("error: Pulling is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use 'git add/rm <file>'\nhint: as appropriate to mark resolution and make a commit.\nfatal: Exiting because of an unresolved conflict.");
    }
    const up = await upstreamOf(sh, dir, branch);
    let remoteName = rest[0], rbranch = rest[1];
    const rebaseCfg = await getConfigValue(sh, dir, "pull.rebase");
    const wantsRebase = opts["-r"] ? true : opts["--no-rebase"] ? false : rebaseCfg === "true" ? true : rebaseCfg === "false" ? false : null;
    if (!remoteName) {
      if (!up) {
        const names = await remoteNames(sh, dir);
        const only = names.length === 1 ? names[0] : "<remote>";
        throw new GitError(`There is no tracking information for the current branch.\nPlease specify which branch you want to ${wantsRebase ? "rebase against" : "merge with"}.\nSee git-pull(1) for details.\n\n    git pull <remote> <branch>\n\nIf you wish to set tracking information for this branch you can do so with:\n\n    git branch --set-upstream-to=${only}/<branch> ${branch}\n`, 1);
      }
      remoteName = up.remote;
      rbranch = up.merge;
    } else if (!rbranch) {
      if (up && up.remote === remoteName) rbranch = up.merge;
      else throw new GitError(`You asked to pull from the remote '${remoteName}', but did not specify\na branch. Because this is not the default configured remote\nfor your current branch, you must specify a branch on the command line.`, 1);
    }
    const fetched = await doFetch(sh, dir, remoteName, io, { only: rest[1] ? rbranch : null, explicit: !!rest[1], quiet: opts["-q"] });
    const theirs = fetched.heads.get(rbranch);
    if (!theirs) throw new GitError(`fatal: couldn't find remote ref ${rbranch}`, 1);
    const ours = await headOid(sh, dir);
    if (!ours) {
      await switchFiles(sh, dir, null, theirs);
      await git.writeRef({ fs: sh.fs, dir, ref: `refs/heads/${branch}`, value: theirs, force: true });
      return 0;
    }
    if (await isAncestor(sh, dir, theirs, ours)) { io.out("Already up to date.\n"); return 0; }
    const canFF = await isAncestor(sh, dir, ours, theirs);
    const ffCfg = await getConfigValue(sh, dir, "pull.ff");
    const ffOnly = opts["--ff-only"] || (ffCfg === "only" && !opts["--ff"] && !opts["--no-ff"] && wantsRebase === null);
    if (ffOnly && !canFF) {
      throw new GitError(hint("Diverging branches can't be fast-forwarded, you need to either:\n\n\tgit merge --no-ff\n\nor:\n\n\tgit rebase\n\nDisable this message with \"git config set advice.diverging false\"") + "fatal: Not possible to fast-forward, aborting.");
    }
    if (!canFF && wantsRebase === null && !opts["--ff"] && !opts["--no-ff"] && !ffCfg) {
      throw new GitError(hint("You have divergent branches and need to specify how to reconcile them.\nYou can do so by running one of the following commands sometime before\nyour next pull:\n\n  git config pull.rebase false  # merge\n  git config pull.rebase true   # rebase\n  git config pull.ff only       # fast-forward only\n\nYou can replace \"git config\" with \"git config --global\" to set a default\npreference for all repositories. You can also pass --rebase, --no-rebase,\nor --ff-only on the command line to override the configured default per\ninvocation.") + "fatal: Need to specify how to reconcile divergent branches.");
    }
    if (canFF && !opts["--no-ff"]) return GIT_COMMANDS.merge(sh, dir, [theirs], io);
    if (wantsRebase) return GIT_COMMANDS.rebase(sh, dir, [`${remoteName}/${rbranch}`], io);
    const into = branch === "main" || branch === "master" ? "" : ` into ${branch}`;
    sh.mergeLabel = theirs;
    try {
      return await GIT_COMMANDS.merge(sh, dir, ["-m", `Merge branch '${rbranch}' of ${displayUrl(fetched.remote.url)}${into}`, ...(opts["--no-ff"] ? ["--no-ff"] : []), theirs], io);
    } finally { sh.mergeLabel = null; }
  };

  /* ------------------------------------------------------------ replaying commits: shared by rebase and cherry-pick */

  // Apply the change one commit made on top of HEAD (a three-way merge of its parent, HEAD and the commit).
  async function applyCommit(sh, dir, oid, io, { quietWhenClean = false } = {}) {
    const { commit } = await git.readCommit({ fs: sh.fs, dir, oid });
    const label = `${short(oid)} (${subjectOf(commit.message)})`;
    const base = await filesAt(sh, dir, commit.parent[0] ?? null);
    const theirs = await filesAt(sh, dir, oid);
    const head = await headOid(sh, dir);
    const ours = await filesAt(sh, dir, head);
    const conflicts = [];
    const result = new Map(ours);
    let messages = "";
    for (const path of [...new Set([...base.keys(), ...ours.keys(), ...theirs.keys()])].sort()) {
      const b = base.get(path) ?? null, o = ours.get(path) ?? null, t = theirs.get(path) ?? null;
      if (b === t || o === t) continue;
      if (b === o) { if (t === null) result.delete(path); else result.set(path, t); continue; }
      if (o === null || t === null) {
        conflicts.push(path);
        messages += `CONFLICT (modify/delete): ${path} deleted in ${o === null ? "HEAD" : label} and modified in ${o === null ? label : "HEAD"}.  Version ${o === null ? label : "HEAD"} of ${path} left in tree.\n`;
        result.set(path, o ?? t);
        continue;
      }
      const merged = mergeText(b ?? "", o, t, "HEAD", label);
      messages += `Auto-merging ${path}\n`;
      if (merged.conflict) { conflicts.push(path); messages += `CONFLICT (content): Merge conflict in ${path}\n`; }
      result.set(path, merged.text);
    }
    for (const path of new Set([...ours.keys(), ...result.keys()])) {
      const text = result.has(path) ? result.get(path) : null;
      if (text === (ours.get(path) ?? null)) continue;
      await writeWork(sh, dir, path, text);
      if (!conflicts.includes(path)) {
        if (text === null) await git.remove({ fs: sh.fs, dir, filepath: path });
        else await git.add({ fs: sh.fs, dir, filepath: path });
      }
    }
    if (conflicts.length || !quietWhenClean) io.out(messages);
    const changed = [...result.keys(), ...ours.keys()].some((p) => (result.get(p) ?? null) !== (ours.get(p) ?? null));
    return { commit, conflicts, label, changed };
  }

  // Commit what's staged with another commit's author and message; returns the new id.
  async function commitAs(sh, dir, original, message) {
    const committer = await identity(sh, dir);
    return git.commit({ fs: sh.fs, dir, message, author: original.author, committer });
  }

  // "[main 1a2b3c4] Add bells" with git's summary of the change, as git commit prints it.
  async function commitSummary(sh, dir, oid, branchLabel, { date = false } = {}) {
    const { commit } = await git.readCommit({ fs: sh.fs, dir, oid });
    const before = await filesAt(sh, dir, commit.parent[0] ?? null), after = await filesAt(sh, dir, oid);
    const stats = [];
    for (const path of [...new Set([...before.keys(), ...after.keys()])].sort()) {
      if (before.get(path) === after.get(path)) continue;
      const ops = diffLines(splitLines(before.get(path) ?? ""), splitLines(after.get(path) ?? ""));
      stats.push({ path, adds: ops.filter((o) => o[0] === "+").length, dels: ops.filter((o) => o[0] === "-").length, created: !before.has(path), deleted: !after.has(path) });
    }
    let out = `[${branchLabel} ${short(oid)}] ${subjectOf(commit.message)}\n`;
    if (date) out += ` Date: ${gitDate(commit.author.timestamp, commit.author.timezoneOffset)}\n`;
    out += stats.length ? summaryLine(stats) : " 0 files changed\n";
    for (const s of stats) {
      if (s.created) out += ` create mode 100644 ${s.path}\n`;
      if (s.deleted) out += ` delete mode 100644 ${s.path}\n`;
    }
    return out;
  }

  // Commits in `tip` but not in `base`, oldest first, without merge commits (what rebase replays).
  async function commitsToReplay(sh, dir, tip, base) {
    const exclude = await ancestors(sh, dir, base);
    const order = [], seen = new Set();
    const visit = async (oid) => {
      const stack = [[oid, false]];
      while (stack.length) {
        const [o, done] = stack.pop();
        if (done) { order.push(o); continue; }
        if (seen.has(o) || exclude.has(o)) continue;
        seen.add(o);
        stack.push([o, true]);
        const { commit } = await git.readCommit({ fs: sh.fs, dir, oid: o });
        for (const p of [...commit.parent].reverse()) stack.push([p, false]);
      }
    };
    await visit(tip);
    const out = [];
    for (const o of order) {
      const { commit } = await git.readCommit({ fs: sh.fs, dir, oid: o });
      if (commit.parent.length <= 1) out.push(o);
    }
    return out;
  }

  async function requireClean(sh, dir, action) {
    const info = await statusInfo(sh, dir);
    if (info.unstaged.length) throw new GitError(`error: cannot ${action}: You have unstaged changes.\nerror: Please commit or stash them.`, 1);
    if (info.staged.length) throw new GitError(`error: cannot ${action}: Your index contains uncommitted changes.\nerror: Please commit or stash them.`, 1);
  }

  async function detachAt(sh, dir, oid) {
    const head = await headOid(sh, dir);
    await switchFiles(sh, dir, head, oid);
    await git.writeRef({ fs: sh.fs, dir, ref: "HEAD", value: oid, force: true });
  }

  /* ------------------------------------------------------------ git rebase */

  const RB = "/.git/rebase-merge";
  const rbRead = (sh, dir) => JSON.parse(sh.fs.text(dir + RB + "/sandbox-state.json"));
  async function rbWrite(sh, dir, st) {
    await sh.fs.mkdir(dir + RB, { recursive: true });
    await sh.fs.writeFile(dir + RB + "/sandbox-state.json", JSON.stringify(st));
    const line = async (oid) => `pick ${short(oid)} # ${subjectOf((await git.readCommit({ fs: sh.fs, dir, oid })).commit.message)}`;
    await sh.fs.writeFile(dir + RB + "/head-name", st.headName + "\n");
    await sh.fs.writeFile(dir + RB + "/onto", st.onto + "\n");
    await sh.fs.writeFile(dir + RB + "/orig-head", st.orig + "\n");
    await sh.fs.writeFile(dir + RB + "/interactive", "");
    await sh.fs.writeFile(dir + RB + "/done", (await Promise.all(st.done.map(line))).map((l) => l + "\n").join(""));
    await sh.fs.writeFile(dir + RB + "/git-rebase-todo", (await Promise.all(st.todo.map(line))).map((l) => l + "\n").join(""));
  }
  async function rbClear(sh, dir) {
    for (const f of sh.fs.walkFiles(dir + RB)) await sh.fs.unlink(f);
    for (const d of [dir + RB]) if (sh.fs.isDir(d)) await sh.fs.rmdir(d);
    if (sh.fs.exists(dir + "/.git/REBASE_HEAD")) await sh.fs.unlink(dir + "/.git/REBASE_HEAD");
    sh.unmerged = new Set();
  }

  async function rbRun(sh, dir, st, io) {
    while (st.todo.length) {
      const oid = st.todo.shift();
      st.done.push(oid);
      const { commit, conflicts, changed } = await applyCommit(sh, dir, oid, io, { quietWhenClean: true });
      if (conflicts.length) {
        st.current = oid;
        await rbWrite(sh, dir, st);
        await sh.fs.writeFile(dir + "/.git/REBASE_HEAD", oid + "\n");
        sh.unmerged = new Set(conflicts);
        io.err(`error: could not apply ${short(oid)}... ${subjectOf(commit.message)}\n` + hint("Resolve all conflicts manually, mark them as resolved with\n\"git add/rm <conflicted_files>\", then run \"git rebase --continue\".\nYou can instead skip this commit: run \"git rebase --skip\".\nTo abort and get back to the state before \"git rebase\", run \"git rebase --abort\".\nDisable this message with \"git config set advice.mergeConflict false\"") + `Could not apply ${short(oid)}... # ${subjectOf(commit.message)}\n`);
        return 1;
      }
      if (changed) await commitAs(sh, dir, commit, commit.message);
      await rbWrite(sh, dir, st);
    }
    // finish: move the branch to the new commits and attach HEAD again
    const head = await headOid(sh, dir);
    if (st.headName !== "detached HEAD") {
      await git.writeRef({ fs: sh.fs, dir, ref: st.headName, value: head, force: true });
      await git.writeRef({ fs: sh.fs, dir, ref: "HEAD", value: st.headName, symbolic: true, force: true });
    }
    await sh.fs.writeFile(dir + "/.git/ORIG_HEAD", st.orig + "\n");
    await rbClear(sh, dir);
    io.err(`Successfully rebased and updated ${st.headName}.\n`);
    return 0;
  }

  GIT_COMMANDS.rebase = async (sh, dir, args, io) => {
    const { opts, rest } = parseOpts(args, { "--continue": "bool", "--abort": "bool", "--skip": "bool", "-i|--interactive": "bool", "--onto": "value", "-q|--quiet": "bool" });
    const inProgress = sh.fs.exists(dir + RB + "/sandbox-state.json");
    if (opts["-i"]) throw new GitError("error: this sandbox has no text editor, so interactive rebase (git rebase -i) isn't available here; try it on your own computer.", 1);
    if ((opts["--continue"] || opts["--abort"] || opts["--skip"]) && !inProgress) throw new GitError("fatal: No rebase in progress?");
    if (opts["--abort"]) {
      const st = rbRead(sh, dir);
      const head = await headOid(sh, dir);
      await git.writeRef({ fs: sh.fs, dir, ref: "HEAD", value: head, force: true });
      await GIT_COMMANDS.reset(sh, dir, ["--hard", "-q", "HEAD"], io);
      await switchFiles(sh, dir, head, st.orig);
      if (st.headName !== "detached HEAD") {
        await git.writeRef({ fs: sh.fs, dir, ref: st.headName, value: st.orig, force: true });
        await git.writeRef({ fs: sh.fs, dir, ref: "HEAD", value: st.headName, symbolic: true, force: true });
      } else await git.writeRef({ fs: sh.fs, dir, ref: "HEAD", value: st.orig, force: true });
      await rbClear(sh, dir);
      return 0;
    }
    if (opts["--skip"]) {
      const st = rbRead(sh, dir);
      await GIT_COMMANDS.reset(sh, dir, ["--hard", "-q", "HEAD"], io);
      st.current = null;
      return rbRun(sh, dir, st, io);
    }
    if (opts["--continue"]) {
      const st = rbRead(sh, dir);
      const info = await statusInfo(sh, dir);
      if (conflictedPaths(sh, dir, info).length || info.unstaged.length) {
        io.out("You must edit all merge conflicts and then\nmark them as resolved using git add\n");
        return 1;
      }
      if (st.current && info.staged.length) {
        const { commit } = await git.readCommit({ fs: sh.fs, dir, oid: st.current });
        const oid = await commitAs(sh, dir, commit, commit.message);
        io.out(await commitSummary(sh, dir, oid, "detached HEAD"));
      }
      st.current = null;
      sh.unmerged = new Set();
      if (sh.fs.exists(dir + "/.git/REBASE_HEAD")) await sh.fs.unlink(dir + "/.git/REBASE_HEAD");
      return rbRun(sh, dir, st, io);
    }
    if (inProgress) {
      throw new GitError("fatal: It seems that there is already a rebase-merge directory, and\nI wonder if you are in the middle of another rebase.  If that is the\ncase, please try\n\tgit rebase (--continue | --abort | --skip)\nIf that is not the case, please\n\trm -fr \".git/rebase-merge\"\nand run me again.  I am stopping in case you still have something\nvaluable there.\n");
    }
    const branch = await currentBranch(sh, dir);
    let upstream = rest[0];
    if (!upstream) {
      const up = branch ? await upstreamOf(sh, dir, branch) : null;
      if (!up) throw new GitError(`There is no tracking information for the current branch.\nPlease specify which branch you want to rebase against.\nSee git-rebase(1) for details.\n\n    git rebase '<branch>'\n\nIf you wish to set tracking information for this branch you can do so with:\n\n    git branch --set-upstream-to=<remote>/<branch> ${branch}\n`, 1);
      upstream = up.short;
    }
    const upOid = await resolveCommit(sh, dir, upstream).catch(() => null);
    if (!upOid) throw new GitError(`fatal: invalid upstream '${upstream}'`);
    const onto = opts["--onto"] ? await resolveCommit(sh, dir, opts["--onto"]) : upOid;
    await requireClean(sh, dir, "rebase");
    const head = await headOid(sh, dir);
    const headName = branch ? `refs/heads/${branch}` : "detached HEAD";
    const todo = await commitsToReplay(sh, dir, head, upOid);
    if (onto === upOid && (await isAncestor(sh, dir, upOid, head))) {
      io.out(branch ? `Current branch ${branch} is up to date.\n` : "HEAD is up to date.\n");
      return 0;
    }
    if (!todo.length) {
      // nothing of ours to replay: fast-forward
      await switchFiles(sh, dir, head, onto);
      if (branch) await git.writeRef({ fs: sh.fs, dir, ref: headName, value: onto, force: true });
      else await git.writeRef({ fs: sh.fs, dir, ref: "HEAD", value: onto, force: true });
      io.err(`Successfully rebased and updated ${headName}.\n`);
      return 0;
    }
    const st = { headName, onto, orig: head, todo, done: [], current: null };
    await rbWrite(sh, dir, st);
    await detachAt(sh, dir, onto);
    return rbRun(sh, dir, st, io);
  };

  /* ------------------------------------------------------------ git cherry-pick */

  GIT_COMMANDS["cherry-pick"] = async (sh, dir, args, io) => {
    const { opts, rest } = parseOpts(args, { "--continue": "bool", "--abort": "bool", "--skip": "bool", "-x": "bool", "-n|--no-commit": "bool" });
    const pickFile = dir + "/.git/CHERRY_PICK_HEAD";
    const statePath = dir + "/.git/sequencer-sandbox.json";
    const branch = await currentBranch(sh, dir);
    const label = branch ?? "detached HEAD";
    const inProgress = sh.fs.exists(pickFile);
    if ((opts["--continue"] || opts["--abort"] || opts["--skip"]) && !inProgress) throw new GitError("error: no cherry-pick or revert in progress\nfatal: cherry-pick failed");
    const finishOne = async (oid, extra) => {
      const { commit } = await git.readCommit({ fs: sh.fs, dir, oid });
      const message = commit.message.replace(/\n+$/, "") + (extra ? `\n\n(cherry picked from commit ${oid})` : "") + "\n";
      const newOid = await commitAs(sh, dir, commit, message);
      io.out(await commitSummary(sh, dir, newOid, label, { date: true }));
    };
    const runList = async (list, x) => {
      while (list.length) {
        const oid = list.shift();
        const { commit, conflicts, changed } = await applyCommit(sh, dir, oid, io);
        if (conflicts.length) {
          await sh.fs.writeFile(pickFile, oid + "\n");
          await sh.fs.writeFile(statePath, JSON.stringify({ todo: list, x, orig: sh.pickOrig ?? null }));
          sh.unmerged = new Set(conflicts);
          io.err(`error: could not apply ${short(oid)}... ${subjectOf(commit.message)}\n` + hint("After resolving the conflicts, mark them with\n\"git add/rm <pathspec>\", then run\n\"git cherry-pick --continue\".\nYou can instead skip this commit with \"git cherry-pick --skip\".\nTo abort and get back to the state before \"git cherry-pick\",\nrun \"git cherry-pick --abort\".\nDisable this message with \"git config set advice.mergeConflict false\""));
          return 1;
        }
        if (opts["-n"]) continue;
        if (!changed) {
          io.out(`On branch ${label}\nnothing to commit, working tree clean\n`);
          io.err("The previous cherry-pick is now empty, possibly due to conflict resolution.\nIf you wish to commit it anyway, use:\n\n    git commit --allow-empty\n\nOtherwise, please use 'git cherry-pick --skip'\n");
          return 1;
        }
        await finishOne(oid, x);
      }
      if (sh.fs.exists(statePath)) await sh.fs.unlink(statePath);
      return 0;
    };
    if (opts["--abort"]) {
      const st = JSON.parse(sh.fs.text(statePath) ?? "{}");
      await GIT_COMMANDS.reset(sh, dir, ["--hard", "-q", st.orig ?? "HEAD"], io);
      for (const f of [pickFile, statePath]) if (sh.fs.exists(f)) await sh.fs.unlink(f);
      return 0;
    }
    if (opts["--skip"] || opts["--continue"]) {
      const st = JSON.parse(sh.fs.text(statePath) ?? "{}");
      const oid = sh.fs.text(pickFile).trim();
      if (opts["--continue"]) {
        const info = await statusInfo(sh, dir);
        if (conflictedPaths(sh, dir, info).length) {
          throw new GitError("error: Committing is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use 'git add/rm <file>'\nhint: as appropriate to mark resolution and make a commit.\nfatal: cherry-pick failed");
        }
        await sh.fs.unlink(pickFile);
        sh.unmerged = new Set();
        await finishOne(oid, st.x);
      } else {
        await sh.fs.unlink(pickFile);
        await GIT_COMMANDS.reset(sh, dir, ["--hard", "-q", "HEAD"], io);
      }
      return runList(st.todo ?? [], st.x);
    }
    if (!rest.length) throw new GitError("usage: git cherry-pick [--edit] [-n] [-m <parent-number>] [-s] [-x] [--ff]\n                       [-S[<keyid>]] <commit>...", 129);
    if (inProgress) throw new GitError("error: cherry-pick is already in progress\nhint: try \"git cherry-pick (--continue | --abort | --quit)\"\nfatal: cherry-pick failed");
    const info = await statusInfo(sh, dir);
    if (info.staged.length || info.unstaged.length) {
      throw new GitError(`error: your local changes would be overwritten by cherry-pick.\nhint: commit your changes or stash them to proceed.\nfatal: cherry-pick failed`);
    }
    const list = [];
    for (const r of rest) {
      const range = /^(.*?)\.\.(.*)$/.exec(r);
      if (range) list.push(...(await commitsToReplay(sh, dir, await resolveCommit(sh, dir, range[2] || "HEAD"), await resolveCommit(sh, dir, range[1] || "HEAD"))));
      else {
        const oid = await resolveCommit(sh, dir, r).catch(() => null);
        if (!oid) throw new GitError(`fatal: bad revision '${r}'`);
        list.push(oid);
      }
    }
    sh.pickOrig = await headOid(sh, dir);
    return runList(list, !!opts["-x"]);
  };

  /* ------------------------------------------------------------ the gh command */

  const ghState = (sh) => (sh.gh ??= { user: "ada", accounts: ["ada", "grace"] });

  function fuzzyAgo(sh, t) {
    const d = clockNow(sh) - t;
    if (d < 60) return "less than a minute ago";
    if (d < 3600) { const m = Math.floor(d / 60); return m === 1 ? "about 1 minute ago" : `about ${m} minutes ago`; }
    const h = Math.floor(d / 3600);
    return h === 1 ? "about 1 hour ago" : `about ${h} hours ago`;
  }
  function fuzzyAbbr(sh, t) {
    const d = clockNow(sh) - t;
    if (d < 60) return "now";
    if (d < 3600) return `${Math.floor(d / 60)}m`;
    return `${Math.floor(d / 3600)}h`;
  }

  class GhError extends Error { constructor(msg, status = 1) { super(msg); this.status = status; } }

  // The GitHub repository the current folder's "origin" (or "upstream") points at.
  async function baseRepo(sh) {
    const dir = await findRoot(sh);
    if (!dir) throw new GhError("failed to run git: fatal: not a git repository (or any of the parent directories): .git");
    for (const name of ["upstream", "origin", ...(await remoteNames(sh, dir))]) {
      const url = await remoteUrl(sh, dir, name);
      if (!url) continue;
      const t = parseUrl(sh, url);
      if (t.github && sh.fs.isDir(t.dir + "/.git")) return { local: dir, dir: t.dir, remote: name, owner: t.owner, repo: t.repo, full: `${t.owner}/${t.repo}` };
    }
    throw new GhError("none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`");
  }

  async function openPullFor(sh, rdir, head) {
    return ghLoad(sh, rdir).pulls.find((p) => p.head === head && p.state === "OPEN") ?? null;
  }

  async function findPull(sh, repo, arg) {
    const data = ghLoad(sh, repo.dir);
    let pr;
    if (arg) {
      const n = Number(String(arg).replace(/^#/, "").replace(/^.*\/pull\//, ""));
      pr = Number.isInteger(n) && n > 0 ? data.pulls.find((p) => p.number === n) : data.pulls.find((p) => p.head === arg && p.state === "OPEN");
      if (!pr) throw new GhError(Number.isInteger(n) && n > 0 ? `GraphQL: Could not resolve to a PullRequest with the number of ${n}. (repository.pullRequest)` : `no pull requests found for branch "${arg}"`);
    } else {
      const branch = await currentBranch(sh, repo.local);
      pr = data.pulls.find((p) => p.head === branch && p.state === "OPEN") ?? data.pulls.filter((p) => p.head === branch).at(-1);
      if (!pr) throw new GhError(`no pull requests found for branch "${branch}"`);
    }
    return { data, pr };
  }

  // Commits, additions and deletions of a pull request, compared with where its branch left the base.
  async function prStats(sh, rdir, pr) {
    if (pr.state === "MERGED") return pr.stats;
    const head = await refOid(sh, rdir, `refs/heads/${pr.head}`), base = await refOid(sh, rdir, `refs/heads/${pr.base}`);
    if (!head || !base) return pr.stats ?? { commits: 0, additions: 0, deletions: 0 };
    const mb = (await git.findMergeBase({ fs: sh.fs, dir: rdir, oids: [base, head] }))[0];
    const commits = await commitsToReplay(sh, rdir, head, base);
    const before = await filesAt(sh, rdir, mb), after = await filesAt(sh, rdir, head);
    let additions = 0, deletions = 0;
    for (const p of new Set([...before.keys(), ...after.keys()])) {
      if (before.get(p) === after.get(p)) continue;
      const ops = diffLines(splitLines(before.get(p) ?? ""), splitLines(after.get(p) ?? ""));
      additions += ops.filter((o) => o[0] === "+").length;
      deletions += ops.filter((o) => o[0] === "-").length;
    }
    return { commits: commits.length, additions, deletions, mergeBase: mb, head, base, commitList: commits };
  }

  // Latest review state per reviewer.
  function reviewStates(pr) {
    const latest = new Map();
    for (const r of pr.reviews) {
      if (r.state === "COMMENTED" && latest.has(r.author)) continue;
      latest.set(r.author, r.state);
    }
    for (const req of pr.requested ?? []) if (!latest.has(req)) latest.set(req, "REQUESTED");
    return latest;
  }

  // Write a commit straight into a repository from a map of files (GitHub merging on the server).
  async function writeCommitFromFiles(sh, rdir, files, { parents, message, author, committer }) {
    const root = new Map();
    for (const [path, text] of files) {
      const parts = path.split("/");
      let node = root;
      for (const d of parts.slice(0, -1)) { if (!node.has(d)) node.set(d, new Map()); node = node.get(d); }
      node.set(parts.at(-1), text);
    }
    const writeTree = async (node) => {
      const entries = [];
      for (const [name, value] of node) {
        if (value instanceof Map) entries.push({ mode: "040000", path: name, oid: await writeTree(value), type: "tree" });
        else entries.push({ mode: "100644", path: name, oid: await git.writeBlob({ fs: sh.fs, dir: rdir, blob: new TextEncoder().encode(value) }), type: "blob" });
      }
      return git.writeTree({ fs: sh.fs, dir: rdir, tree: entries });
    };
    const tree = await writeTree(root);
    return git.writeCommit({ fs: sh.fs, dir: rdir, commit: { message, tree, parent: parents, author, committer } });
  }

  // Three-way merge of whole trees on the server; null if there are conflicts.
  async function mergeTreesOnServer(sh, rdir, baseOid, oursOid, theirsOid) {
    const b = await filesAt(sh, rdir, baseOid), o = await filesAt(sh, rdir, oursOid), t = await filesAt(sh, rdir, theirsOid);
    const result = new Map(o);
    for (const p of new Set([...b.keys(), ...o.keys(), ...t.keys()])) {
      const bb = b.get(p) ?? null, oo = o.get(p) ?? null, tt = t.get(p) ?? null;
      if (bb === tt || oo === tt) continue;
      if (bb === oo) { if (tt === null) result.delete(p); else result.set(p, tt); continue; }
      if (oo === null || tt === null) return null;
      const m = mergeText(bb ?? "", oo, tt);
      if (m.conflict) return null;
      result.set(p, m.text);
    }
    return result;
  }

  const who = (login, sh) => ({ ...USERS[login], timestamp: sh.now(), timezoneOffset: 0 });

  async function prMerge(sh, repo, data, pr, method, io, opts) {
    const st = await prStats(sh, repo.dir, pr);
    const user = ghState(sh).user;
    const states = reviewStates(pr);
    const approvals = [...states.values()].filter((s) => s === "APPROVED").length;
    const changesRequested = [...states.values()].some((s) => s === "CHANGES_REQUESTED");
    const rules = rulesFor(sh, repo.dir, pr.base);
    let checksOk = true;
    if (rules.checks.length && hooks.checksFor) {
      const info = await hooks.checksFor(sh, repo.dir, pr);
      checksOk = rules.checks.every((name) => info.list.some((c) => c.name === name && (c.bucket === "pass" || c.bucket === "skipping")));
    }
    const blocked = !opts.admin && ((rules.pr !== null && approvals < rules.pr) || (rules.pr !== null && changesRequested) || !checksOk);
    const mergeTree = await mergeTreesOnServer(sh, repo.dir, st.mergeBase, st.base, st.head);
    const fail = (reason, conflicts) => {
      let msg = `X Pull request ${repo.full}#${pr.number} is not mergeable: ${reason}.\nTo have the pull request merged after all the requirements have been met, add the \`--auto\` flag.\n`;
      if (conflicts) msg += `Run the following to resolve the merge conflicts locally:\n  gh pr checkout ${pr.number} && git fetch ${repo.remote} ${pr.base} && git ${method === "rebase" ? "rebase" : "merge"} ${repo.remote}/${pr.base}\n`;
      else msg += "To use administrator privileges to immediately merge the pull request, add the `--admin` flag.\n";
      return new GhError(msg.replace(/\n$/, ""));
    };
    if (!mergeTree) throw fail("the merge commit cannot be cleanly created", true);
    if (blocked) throw fail("the base branch policy prohibits the merge", false);
    if (opts.auto) {
      io.err(`✓ Pull request ${repo.full}#${pr.number} will be automatically merged via ${method === "merge" ? "create a merge commit" : method === "squash" ? "squash and merge" : "rebase and merge"} when all requirements are met\n`);
      return;
    }
    let newBase;
    const merger = who(user, sh);
    if (method === "merge") {
      newBase = await writeCommitFromFiles(sh, repo.dir, mergeTree, { parents: [st.base, st.head], message: `Merge pull request #${pr.number} from ${pr.headOwner}/${pr.head}\n\n${pr.title}\n`, author: merger, committer: { ...GITHUB_BOT, timestamp: merger.timestamp, timezoneOffset: 0 } });
    } else if (method === "squash") {
      const author = who(pr.author, sh);
      const body = st.commitList.length > 1
        ? (await Promise.all(st.commitList.map(async (o) => `* ${subjectOf((await git.readCommit({ fs: sh.fs, dir: repo.dir, oid: o })).commit.message)}`))).join("\n\n")
        : (await git.readCommit({ fs: sh.fs, dir: repo.dir, oid: st.commitList[0] })).commit.message.split("\n").slice(1).join("\n").trim();
      newBase = await writeCommitFromFiles(sh, repo.dir, mergeTree, { parents: [st.base], message: `${pr.title} (#${pr.number})\n${body ? "\n" + body + "\n" : ""}`, author, committer: { ...GITHUB_BOT, timestamp: author.timestamp, timezoneOffset: 0 } });
    } else {
      // rebase and merge: replay each commit on top of the base
      let tip = st.base;
      for (const o of st.commitList) {
        const { commit } = await git.readCommit({ fs: sh.fs, dir: repo.dir, oid: o });
        const files = await mergeTreesOnServer(sh, repo.dir, commit.parent[0], tip, o);
        if (!files) throw fail("the merge commit cannot be cleanly created", true);
        const t = clockNow(sh); sh.now();
        tip = await writeCommitFromFiles(sh, repo.dir, files, { parents: [tip], message: commit.message, author: commit.author, committer: { ...GITHUB_BOT, timestamp: t, timezoneOffset: 0 } });
      }
      newBase = tip;
    }
    await git.writeRef({ fs: sh.fs, dir: repo.dir, ref: `refs/heads/${pr.base}`, value: newBase, force: true });
    pr.state = "MERGED";
    await ghSave(sh, repo.dir, data);
    for (const h of hooks.afterRefUpdate) await h(sh, repo.dir, [{ ref: `refs/heads/${pr.base}`, before: st.base, after: newBase }], user);
    Object.assign(data, ghLoad(sh, repo.dir), { pulls: data.pulls });
    pr.stats = { commits: st.commits, additions: st.additions, deletions: st.deletions };
    pr.mergedBy = user;
    pr.mergeCommit = newBase;
    pr.mergeMethod = method;
    await ghSave(sh, repo.dir, data);
    io.err(`✓ ${method === "merge" ? "Merged" : method === "squash" ? "Squashed and merged" : "Rebased and merged"} pull request ${repo.full}#${pr.number} (${pr.title})\n`);
    if (opts.deleteBranch) {
      const local = await refOid(sh, repo.local, `refs/heads/${pr.head}`);
      const current = await currentBranch(sh, repo.local);
      if (local) {
        let switched = "";
        if (current === pr.head) {
          const quiet = { out: () => {}, err: () => {} };
          await GIT_COMMANDS.switch(sh, repo.local, [pr.base], quiet);
          const ok = await GIT_COMMANDS.pull(sh, repo.local, ["--ff-only", "-q", repo.remote, pr.base], quiet).catch(() => 1);
          if (ok) io.err(`! warning: not possible to fast-forward to: "${pr.base}"\n`);
          switched = ` and switched to branch ${pr.base}`;
        }
        await git.deleteBranch({ fs: sh.fs, dir: repo.local, ref: pr.head });
        for (const k of ["remote", "merge"]) await git.setConfig({ fs: sh.fs, dir: repo.local, path: `branch.${pr.head}.${k}`, value: undefined }).catch(() => {});
        io.err(`✓ Deleted local branch ${pr.head}${switched}\n`);
      }
      await git.deleteRef({ fs: sh.fs, dir: repo.dir, ref: `refs/heads/${pr.head}` }).catch(() => {});
      await git.deleteRef({ fs: sh.fs, dir: repo.local, ref: `refs/remotes/${repo.remote}/${pr.head}` }).catch(() => {});
      io.err(`✓ Deleted remote branch ${pr.head}\n`);
    }
  }

  function table(rows) {
    const widths = rows[0].map((_, c) => Math.max(...rows.map((r) => r[c].length)));
    return rows.map((r) => r.map((cell, c) => (c === r.length - 1 ? cell : cell.padEnd(widths[c]))).join("  ").replace(/\s+$/, "")).join("\n") + "\n";
  }

  const GH_HELP = `Work seamlessly with GitHub from the command line.

USAGE
  gh <command> <subcommand> [flags]

COMMANDS IN THIS SANDBOX
  auth:       status, switch, login
  pr:         create, list, view, diff, checkout, review, merge, close, ready, checks
  release:    create, list, view
  repo:       create, clone, view
  api:        repos/{owner}/{repo}/rulesets (GET and POST), repos/{owner}/{repo}/pages
  run:        list, view, watch, rerun, download, delete
  workflow:   list, run, view, enable, disable
  secret:     set, list, delete
  variable:   set, list, delete
`;

  registerCommand("gh", async (sh, args, io) => {
    try {
      return await ghMain(sh, args, io);
    } catch (e) {
      if (e instanceof GhError) { io.err(e.message + "\n"); return e.status; }
      if (e instanceof GitError) { io.err(e.message.endsWith("\n") ? e.message : e.message + "\n"); return e.status; }
      throw e;
    }
  });

  async function ghMain(sh, args, io) {
    const [cmd, sub, ...rest] = args;
    const state = ghState(sh);
    if (!cmd || cmd === "help" || cmd === "--help") { io.out(GH_HELP); return 0; }
    if (cmd === "--version" || cmd === "version") { io.out("gh version 2.102.0 (this sandbox simulates GitHub)\nhttps://github.com/cli/cli/releases/tag/v2.102.0\n"); return 0; }
    if (cmd === "browse" || (cmd === "pr" && rest.includes("--web")) || (cmd === "repo" && sub === "view" && rest.includes("--web"))) {
      throw new GhError("The sandbox has no web browser. On your own computer this opens the page on github.com.");
    }
    if (cmd === "auth") return ghAuth(sh, sub, rest, io, state);
    if (cmd === "repo") return ghRepo(sh, sub, rest, io, state);
    if (cmd === "pr") return ghPr(sh, sub, rest, io, state);
    if (cmd === "api") return ghApi(sh, [sub, ...rest], io, state);
    if (cmd === "release") return ghRelease(sh, sub, rest, io, state);
    if (hooks.ghCommands[cmd]) return hooks.ghCommands[cmd](sh, sub, rest, io, state);
    throw new GhError(`unknown command "${cmd}" for "gh"\n\nUsage:  gh <command> <subcommand> [flags]\n\nRun 'gh help' to see the commands this sandbox supports.`);
  }

  function ghAuth(sh, sub, rest, io, state) {
    if (sub === "status") {
      let out = `${HOST}\n`;
      state.accounts.forEach((acc, k) => {
        out += `${k ? "\n" : ""}  ✓ Logged in to ${HOST} account ${acc} (keyring)\n  - Active account: ${acc === state.user}\n  - Git operations protocol: https\n  - Token: gho_************************************\n  - Token scopes: 'gist', 'read:org', 'repo', 'workflow'\n`;
      });
      io.out(out);
      return 0;
    }
    if (sub === "switch") {
      const { opts } = parseOpts(rest, { "-u|--user": "value", "-h|--hostname": "value" });
      const target = opts["-u"] ?? state.accounts.find((a) => a !== state.user);
      if (!state.accounts.includes(target)) throw new GhError(`not logged in to ${HOST} account ${target}`);
      state.user = target;
      io.err(`✓ Switched active account for ${HOST} to ${target}\n`);
      return 0;
    }
    if (sub === "login") {
      io.err(`In the sandbox you're already logged in as ${state.user} (gh auth status shows the accounts).\nOn your own computer, gh auth login opens your browser to sign in to GitHub.\n`);
      return 0;
    }
    throw new GhError(`unknown command "${sub}" for "gh auth"`);
  }

  async function ghRepo(sh, sub, rest, io, state) {
    if (sub === "create") {
      const { opts, rest: names } = parseOpts(rest, { "--public": "bool", "--private": "bool", "--internal": "bool", "-s|--source": "value", "-r|--remote": "value",
        "--push": "bool", "-d|--description": "value", "--clone|-c": "bool", "--add-readme": "bool" });
      if (!opts["--public"] && !opts["--private"] && !opts["--internal"]) throw new GhError("`--public`, `--private`, or `--internal` required when not running interactively");
      let name = names[0];
      let srcDir = null;
      if (opts["-s"]) {
        srcDir = sh.abs(opts["-s"]);
        if (!sh.fs.isDir(srcDir + "/.git")) throw new GhError(`current directory is not a git repository. Run \`git -C "${opts["-s"]}" init\` to initialize it`);
        name ??= srcDir.split("/").pop();
      }
      if (!name) throw new GhError("name argument required to create new remote repository");
      const [owner, repo] = name.includes("/") ? name.split("/") : [state.user, name];
      const rdir = `${GH}/${owner}/${repo}`;
      if (sh.fs.isDir(rdir + "/.git")) throw new GhError(`GraphQL: Name already exists on this account (createRepository)`);
      await sh.fs.mkdir(rdir, { recursive: true });
      await git.init({ fs: sh.fs, dir: rdir, defaultBranch: "main" });
      await ghSave(sh, rdir, { pulls: [], rulesets: [], nextNumber: 1, private: !opts["--public"], description: opts["-d"] ?? "", owner, name: repo });
      if (opts["--add-readme"]) {
        const author = who(state.user, sh);
        const oid = await writeCommitFromFiles(sh, rdir, new Map([["README.md", `# ${repo}\n${opts["-d"] ? opts["-d"] + "\n" : ""}`]]), { parents: [], message: "Initial commit\n", author, committer: { ...GITHUB_BOT, timestamp: author.timestamp, timezoneOffset: 0 } });
        await git.writeRef({ fs: sh.fs, dir: rdir, ref: "refs/heads/main", value: oid, force: true });
      }
      const url = `https://github.com/${owner}/${repo}`;
      io.out(`✓ Created repository ${owner}/${repo} on ${HOST}\n  ${url}\n`);
      if (srcDir) {
        const remote = opts["-r"] ?? "origin";
        if ((await remoteNames(sh, srcDir)).includes(remote)) throw new GhError(`Unable to add remote "${remote}"`);
        await git.addRemote({ fs: sh.fs, dir: srcDir, remote, url: url + ".git" });
        io.out(`✓ Added remote ${url}.git\n`);
        if (opts["--push"]) {
          const saved = sh.cwd;
          sh.cwd = srcDir;
          try {
            const status = await GIT_COMMANDS.push(sh, srcDir, ["--set-upstream", remote, "HEAD"], io);
            if (status) return status;
          } finally { sh.cwd = saved; }
          io.out(`✓ Pushed commits to ${url}.git\n`);
        }
      } else if (opts["--clone"]) {
        await GIT_COMMANDS.clone(sh, null, [url + ".git"], io);
      }
      return 0;
    }
    if (sub === "clone") {
      const [name, dirName] = rest;
      if (!name) throw new GhError("cannot clone: repository argument required");
      const [owner, repo] = name.includes("/") ? name.replace(/^https:\/\/github\.com\//, "").split("/") : [state.user, name];
      return GIT_COMMANDS.clone(sh, null, [`https://github.com/${owner}/${repo.replace(/\.git$/, "")}.git`, ...(dirName ? [dirName] : [])], io);
    }
    if (sub === "view") {
      const r = rest[0] && !rest[0].startsWith("-") ? (() => { const [o, n] = rest[0].split("/"); return { dir: `${GH}/${o}/${n}`, full: rest[0] }; })() : await baseRepo(sh);
      if (!sh.fs.isDir(r.dir + "/.git")) throw new GhError(`GraphQL: Could not resolve to a Repository with the name '${r.full}'. (repository)`);
      const data = ghLoad(sh, r.dir);
      const readme = (await filesAt(sh, r.dir, await refOid(sh, r.dir, `refs/heads/${defaultBranchOf(sh, r.dir)}`))).get("README.md");
      io.out(`${r.full}\n${data.description || "No description provided"}\n\n${readme ? readme.split("\n").map((l) => (l ? "  " + l : "")).join("\n") + "\n" : "This repository does not have a README\n\n"}\nView this repository on GitHub: https://github.com/${r.full}\n`);
      return 0;
    }
    throw new GhError(`unknown command "${sub}" for "gh repo"`);
  }

  async function ghPr(sh, sub, rest, io, state) {
    if (hooks.prSubcommands[sub]) return hooks.prSubcommands[sub](sh, rest, io, state);
    const repo = await baseRepo(sh);
    if (sub === "create") {
      const { opts } = parseOpts(rest, { "-t|--title": "value", "-b|--body": "value", "-B|--base": "value", "-H|--head": "value", "-d|--draft": "bool",
        "-f|--fill": "bool", "--fill-first": "bool", "-r|--reviewer": "multi", "-a|--assignee": "multi", "-l|--label": "multi" });
      const branch = await currentBranch(sh, repo.local);
      const head = opts["-H"] ?? branch;
      const base = opts["-B"] ?? defaultBranchOf(sh, repo.dir);
      const fill = opts["-f"] || opts["--fill-first"];
      if (!fill && (opts["-t"] === undefined || opts["-b"] === undefined)) {
        throw new GhError("must provide `--title` and `--body` (or `--fill` or `fill-first` or `--fillverbose`) when not running interactively");
      }
      const headOidRemote = await refOid(sh, repo.dir, `refs/heads/${head}`);
      if (!headOidRemote) throw new GhError("aborted: you must first push the current branch to a remote, or use the --head flag");
      const baseOidRemote = await refOid(sh, repo.dir, `refs/heads/${base}`);
      if (!baseOidRemote) throw new GhError(`pull request create failed: GraphQL: Base ref must be a branch (createPullRequest)`);
      const data = ghLoad(sh, repo.dir);
      const existing = data.pulls.find((p) => p.head === head && p.base === base && p.state === "OPEN");
      if (existing) throw new GhError(`a pull request for branch "${head}" into branch "${base}" already exists:\nhttps://github.com/${repo.full}/pull/${existing.number}`);
      const commits = await commitsToReplay(sh, repo.dir, headOidRemote, baseOidRemote);
      if (!commits.length) throw new GhError(`pull request create failed: GraphQL: No commits between ${base} and ${head} (createPullRequest)`);
      let title = opts["-t"], body = opts["-b"] ?? "";
      if (fill && title === undefined) {
        const msgs = await Promise.all(commits.map(async (o) => (await git.readCommit({ fs: sh.fs, dir: repo.dir, oid: o })).commit.message));
        if (msgs.length === 1 || opts["--fill-first"]) { title = subjectOf(msgs[0]); if (opts["-b"] === undefined) body = msgs[0].split("\n").slice(1).join("\n").trim(); }
        else { title = head.replace(/[-_]/g, " "); if (opts["-b"] === undefined) body = msgs.map((m) => `- **${subjectOf(m)}**\n`).join(""); }
      }
      const reviewers = (opts["-r"] ?? []).flatMap((r) => r.split(",")).filter(Boolean);
      for (const r of reviewers) if (!USERS[r]) throw new GhError(`could not request reviewer: '${r}' not found`);
      if (reviewers.includes(state.user)) throw new GhError("pull request create failed: GraphQL: Review cannot be requested from pull request author. (requestReviews)");
      const pr = { number: data.nextNumber++, title, body, head, headOwner: repo.owner, base, author: state.user, state: "OPEN", draft: !!opts["-d"],
        createdAt: clockNow(sh), reviews: [], requested: reviewers, comments: [] };
      data.pulls.push(pr);
      await ghSave(sh, repo.dir, data);
      if (hooks.prEvent) await hooks.prEvent(sh, repo.dir, pr, "opened", state.user);
      io.err(`\nCreating ${pr.draft ? "draft " : ""}pull request for ${head} into ${base} in ${repo.full}\n\n`);
      io.out(`https://github.com/${repo.full}/pull/${pr.number}\n`);
      return 0;
    }
    if (sub === "list") {
      const { opts } = parseOpts(rest, { "-s|--state": "value", "-A|--author": "value", "-B|--base": "value", "-H|--head": "value", "-L|--limit": "value" });
      const want = (opts["-s"] ?? "open").toUpperCase();
      const data = ghLoad(sh, repo.dir);
      const list = data.pulls.filter((p) => (want === "ALL" || p.state === want) && (!opts["-A"] || p.author === opts["-A"]) && (!opts["-B"] || p.base === opts["-B"]) && (!opts["-H"] || p.head === opts["-H"])).reverse();
      if (!list.length) throw new GhError(want === "OPEN" ? `no open pull requests in ${repo.full}` : `no pull requests match your search in ${repo.full}`);
      const total = list.length;
      const shown = list.slice(0, Number(opts["-L"] ?? 30));
      const rows = [["ID", "TITLE", "BRANCH", "CREATED AT"], ...shown.map((p) => [`#${p.number}`, p.title, p.head, fuzzyAgo(sh, p.createdAt)])];
      const noun = want === "OPEN" ? `open pull request${total === 1 ? "" : "s"}` : `pull request${total === 1 ? "" : "s"}`;
      io.out(`\nShowing ${shown.length} of ${total} ${noun} in ${repo.full}\n\n` + table(rows));
      return 0;
    }
    if (sub === "view") {
      const { opts, rest: r } = parseOpts(rest, { "-c|--comments": "bool" });
      const { pr } = await findPull(sh, repo, r[0]);
      const st = await prStats(sh, repo.dir, pr);
      const stateTitle = pr.state === "MERGED" ? "Merged" : pr.state === "CLOSED" ? "Closed" : pr.draft ? "Draft" : "Open";
      const verb = pr.state === "MERGED" ? "merged" : "wants to merge";
      let out = `${pr.title} ${repo.full}#${pr.number}\n`;
      out += `${stateTitle} • ${pr.author} ${verb} ${st.commits} commit${st.commits === 1 ? "" : "s"} into ${pr.base} from ${pr.head} • ${fuzzyAgo(sh, pr.createdAt)}\n`;
      let checks = "No checks";
      if (hooks.checksFor && pr.state === "OPEN") {
        const c = await hooks.checksFor(sh, repo.dir, pr);
        if (c.total) checks = c.failing ? (c.failing === c.total ? "× All checks failing" : `× ${c.failing}/${c.total} checks failing`) : c.pending ? "- Checks pending" : c.passing === c.total ? "✓ Checks passing" : "No checks";
      }
      out += `+${st.additions} -${st.deletions} • ${checks}\n`;
      const states = reviewStates(pr);
      if (states.size) {
        const label = { APPROVED: "Approved", CHANGES_REQUESTED: "Changes requested", COMMENTED: "Commented", REQUESTED: "Requested" };
        out += `Reviewers: ${[...states].map(([u, s]) => `${u} (${label[s]})`).join(", ")}\n`;
      }
      const md = pr.body ? `\n${pr.body.split("\n").map((l) => (l ? "  " + l : "")).join("\n")}\n\n` : "\n  No description provided\n\n";
      out += `\n${md}\n`;
      const reviews = pr.reviews.filter((x) => x.body || x.state !== "COMMENTED");
      const shown = opts["-c"] ? reviews : reviews.slice(-1);
      shown.forEach((rv, k) => {
        const status = rv.state === "APPROVED" ? " approved" : rv.state === "CHANGES_REQUESTED" ? " requested changes" : " commented";
        const newest = k === shown.length - 1 ? " • Newest comment" : "";
        out += `${rv.author}${status} (Collaborator) • ${fuzzyAbbr(sh, rv.at)}${newest}\n`;
        out += rv.body ? `\n${rv.body.split("\n").map((l) => (l ? "  " + l : "")).join("\n")}\n\n` : "\n  No body provided\n\n";
        out += `View the full review: https://github.com/${repo.full}/pull/${pr.number}#pullrequestreview-${rv.id}\n\n`;
      });
      out += `View this pull request on GitHub: https://github.com/${repo.full}/pull/${pr.number}\n`;
      io.out(out);
      return 0;
    }
    if (sub === "diff") {
      const { pr } = await findPull(sh, repo, rest.find((x) => !x.startsWith("-")));
      const st = await prStats(sh, repo.dir, pr);
      if (pr.state === "MERGED") throw new GhError("the pull request is already merged; see the merge commit with git show");
      const before = await filesAt(sh, repo.dir, st.mergeBase), after = await filesAt(sh, repo.dir, st.head);
      io.out(await unifiedDiff(sh, repo.dir, before, after, { nameOnly: rest.includes("--name-only") }));
      return 0;
    }
    if (sub === "checkout") {
      const { pr } = await findPull(sh, repo, rest[0]);
      if (!(await refOid(sh, repo.dir, `refs/heads/${pr.head}`))) throw new GhError(`couldn't find remote ref refs/heads/${pr.head}`);
      await doFetch(sh, repo.local, repo.remote, io, {});
      if (await refOid(sh, repo.local, `refs/heads/${pr.head}`)) {
        if ((await currentBranch(sh, repo.local)) !== pr.head) await GIT_COMMANDS.switch(sh, repo.local, [pr.head], io);
        const status = await GIT_COMMANDS.merge(sh, repo.local, ["--ff-only", `${repo.remote}/${pr.head}`], io);
        return status;
      }
      return GIT_COMMANDS.switch(sh, repo.local, ["-c", pr.head, `${repo.remote}/${pr.head}`], io);
    }
    if (sub === "review") {
      const { opts, rest: r } = parseOpts(rest, { "-a|--approve": "bool", "-r|--request-changes": "bool", "-c|--comment": "bool", "-b|--body": "value" });
      const { data, pr } = await findPull(sh, repo, r[0]);
      const kind = opts["-a"] ? "APPROVED" : opts["-r"] ? "CHANGES_REQUESTED" : opts["-c"] ? "COMMENTED" : null;
      if (!kind) throw new GhError("--approve, --request-changes, or --comment required when not running interactively");
      if (kind !== "APPROVED" && !opts["-b"]) throw new GhError(`body cannot be blank for ${kind === "COMMENTED" ? "comment" : "request-changes"} review`);
      if (pr.state !== "OPEN") throw new GhError(`failed to create review: GraphQL: Can not ${kind === "APPROVED" ? "approve" : "review"} a ${pr.state === "MERGED" ? "merged" : "closed"} pull request (addPullRequestReview)`);
      if (pr.author === state.user && kind !== "COMMENTED") {
        throw new GhError(`failed to create review: GraphQL: Review Can not ${kind === "APPROVED" ? "approve" : "request changes on"} your own pull request (addPullRequestReview)`);
      }
      pr.reviews.push({ id: 1000 + pr.reviews.length + 1, author: state.user, state: kind, body: opts["-b"] ?? "", at: clockNow(sh) });
      pr.requested = (pr.requested ?? []).filter((u) => u !== state.user);
      await ghSave(sh, repo.dir, data);
      io.err(kind === "APPROVED" ? `✓ Approved pull request ${repo.full}#${pr.number}\n` : kind === "CHANGES_REQUESTED" ? `+ Requested changes to pull request ${repo.full}#${pr.number}\n` : `- Reviewed pull request ${repo.full}#${pr.number}\n`);
      return 0;
    }
    if (sub === "merge") {
      const { opts, rest: r } = parseOpts(rest, { "-m|--merge": "bool", "-s|--squash": "bool", "-r|--rebase": "bool", "-d|--delete-branch": "bool", "--admin": "bool", "--auto": "bool" });
      const method = opts["-m"] ? "merge" : opts["-s"] ? "squash" : opts["-r"] ? "rebase" : null;
      if (!method) throw new GhError("--merge, --rebase, or --squash required when not running interactively");
      const { data, pr } = await findPull(sh, repo, r[0]);
      if (pr.state === "MERGED") { io.err(`! Pull request ${repo.full}#${pr.number} was already merged\n`); return 0; }
      if (pr.state === "CLOSED") throw new GhError(`X Pull request ${repo.full}#${pr.number} (${pr.title}) can't be merged because it is closed`);
      if (pr.draft) throw new GhError(`X Pull request ${repo.full}#${pr.number} is still a draft`);
      await prMerge(sh, repo, data, pr, method, io, { deleteBranch: opts["-d"], admin: opts["--admin"], auto: opts["--auto"] });
      return 0;
    }
    if (sub === "close") {
      const { opts, rest: r } = parseOpts(rest, { "-d|--delete-branch": "bool", "-c|--comment": "value" });
      const { data, pr } = await findPull(sh, repo, r[0]);
      if (pr.state !== "OPEN") { io.err(`! Pull request ${repo.full}#${pr.number} (${pr.title}) is already ${pr.state.toLowerCase()}\n`); return 0; }
      pr.state = "CLOSED";
      await ghSave(sh, repo.dir, data);
      io.err(`✓ Closed pull request ${repo.full}#${pr.number} (${pr.title})\n`);
      if (opts["-d"]) {
        await git.deleteRef({ fs: sh.fs, dir: repo.dir, ref: `refs/heads/${pr.head}` }).catch(() => {});
        io.err(`✓ Deleted branch ${pr.head}\n`);
      }
      return 0;
    }
    if (sub === "ready") {
      const { data, pr } = await findPull(sh, repo, rest[0]);
      pr.draft = false;
      await ghSave(sh, repo.dir, data);
      io.err(`✓ Pull request ${repo.full}#${pr.number} is marked as "ready for review"\n`);
      return 0;
    }
    throw new GhError(`unknown command "${sub}" for "gh pr"`);
  }

  async function ghRelease(sh, sub, rest, io, state) {
    const repo = await baseRepo(sh);
    const data = ghLoad(sh, repo.dir);
    data.releases ??= [];
    if (sub === "create") {
      const { opts, rest: r } = parseOpts(rest, { "-t|--title": "value", "-n|--notes": "value", "--generate-notes": "bool", "-d|--draft": "bool", "-p|--prerelease": "bool", "--target": "value", "--latest": "bool" });
      const tag = r[0];
      if (!tag) throw new GhError("could not create: no tag name provided");
      if (data.releases.some((x) => x.tag === tag)) throw new GhError(`a release with the same tag name already exists: ${tag}`);
      if (opts["-n"] === undefined && !opts["--generate-notes"]) throw new GhError("`--notes` or `--generate-notes` required when not running interactively");
      let target = await refOid(sh, repo.dir, `refs/tags/${tag}`);
      const createdTag = !target;
      if (!target) {
        // like GitHub, create the tag from the target branch (the default branch unless --target)
        const branchName = opts["--target"] ?? defaultBranchOf(sh, repo.dir);
        const oid = await refOid(sh, repo.dir, `refs/heads/${branchName}`) ?? await resolveCommit(sh, repo.dir, branchName).catch(() => null);
        if (!oid) throw new GhError(`HTTP 422: Validation Failed (https://api.github.com/repos/${repo.full}/releases)\nRelease.target_commitish is invalid`);
        await git.writeRef({ fs: sh.fs, dir: repo.dir, ref: `refs/tags/${tag}`, value: oid });
        target = oid;
      }
      let notes = opts["-n"] ?? "";
      if (opts["--generate-notes"]) {
        const prev = data.releases.at(-1);
        const merged = data.pulls.filter((p) => p.state === "MERGED").filter((p) => !prev || p.number > (prev.lastPull ?? 0));
        notes = "## What's Changed\n" + merged.map((p) => `* ${p.title} by @${p.author} in https://github.com/${repo.full}/pull/${p.number}`).join("\n")
          + (prev ? `\n\n**Full Changelog**: https://github.com/${repo.full}/compare/${prev.tag}...${tag}` : `\n\n**Full Changelog**: https://github.com/${repo.full}/commits/${tag}`);
      }
      data.releases.push({ tag, title: opts["-t"] ?? tag, notes, draft: !!opts["-d"], prerelease: !!opts["-p"], author: state.user, createdAt: clockNow(sh),
        lastPull: Math.max(0, ...data.pulls.filter((p) => p.state === "MERGED").map((p) => p.number)) });
      await ghSave(sh, repo.dir, data);
      if (createdTag) for (const h of hooks.afterRefUpdate) await h(sh, repo.dir, [{ ref: `refs/tags/${tag}`, before: null, after: target }], state.user);
      if (!opts["-d"] && hooks.releaseEvent) await hooks.releaseEvent(sh, repo.dir, data.releases.at(-1), target, state.user);
      if (repo.local) await doFetch(sh, repo.local, repo.remote, { out: () => {}, err: () => {} }, { quiet: true }).catch(() => {});
      io.out(`https://github.com/${repo.full}/releases/tag/${tag}\n`);
      return 0;
    }
    if (sub === "list") {
      if (!data.releases.length) throw new GhError("no releases found");
      const published = data.releases.filter((x) => !x.draft && !x.prerelease);
      const latest = published.at(-1);
      const rows = [["TITLE", "TYPE", "TAG NAME", "PUBLISHED"], ...[...data.releases].reverse().map((x) => [x.title, x === latest ? "Latest" : x.draft ? "Draft" : x.prerelease ? "Pre-release" : "", x.tag, fuzzyAgo(sh, x.createdAt)])];
      io.out(table(rows));
      return 0;
    }
    if (sub === "view") {
      const tag = rest[0] ?? data.releases.filter((x) => !x.draft && !x.prerelease).at(-1)?.tag;
      const rel = data.releases.find((x) => x.tag === tag);
      if (!rel) throw new GhError("release not found");
      io.out(`${rel.title}\n${rel.author} released this ${fuzzyAgo(sh, rel.createdAt)}\n\n${rel.notes ? rel.notes.split("\n").map((l) => (l ? "  " + l : "")).join("\n") + "\n" : ""}\n\nView on GitHub: https://github.com/${repo.full}/releases/tag/${rel.tag}\n`);
      return 0;
    }
    throw new GhError(`unknown command "${sub}" for "gh release"`);
  }

  // gh api, for repository rulesets: GET or POST repos/{owner}/{repo}/rulesets
  async function ghApi(sh, args, io, state) {
    const { opts, rest } = parseOpts(args, { "-X|--method": "value", "--input": "value", "-f|--raw-field": "multi", "-F|--field": "multi", "-H|--header": "multi", "--jq|-q": "value" });
    let path = rest[0] ?? "";
    if (path.includes("{owner}") || path.includes("{repo}")) {
      const b = await baseRepo(sh);
      path = path.replace("{owner}", b.owner).replace("{repo}", b.repo);
    }
    const m = /^\/?repos\/([^/]+)\/([^/]+)\/rulesets\/?$/.exec(path);
    if (!m) {
      const method0 = (opts["-X"] ?? (opts["--input"] || opts["-f"] || opts["-F"] ? "POST" : "GET")).toUpperCase();
      for (const route of hooks.apiRoutes) { const res = await route(sh, path, opts, io, method0); if (res !== null && res !== undefined) return res; }
    }
    if (!m) throw new GhError(`the sandbox's gh api only supports repos/{owner}/{repo}/rulesets (got "${path}")`);
    const rdir = `${GH}/${m[1]}/${m[2]}`;
    if (!sh.fs.isDir(rdir + "/.git")) throw new GhError("gh: Not Found (HTTP 404)");
    const data = ghLoad(sh, rdir);
    const method = (opts["-X"] ?? (opts["--input"] || opts["-f"] || opts["-F"] ? "POST" : "GET")).toUpperCase();
    const emit = (value) => {
      const jq = opts["--jq"];
      if (jq) {
        // simple jq paths only: .name, .[0].name, .[].name
        const pick = (v, path) => {
          if (!path) return [v];
          const mm = /^(\.\[\]|\.\[(\d+)\]|\.([A-Za-z_]\w*))(.*)$/.exec(path);
          if (!mm) throw new GhError(`the sandbox's gh api supports simple --jq paths like .name or .[].name (got "${jq}")`);
          if (mm[1] === ".[]") return (Array.isArray(v) ? v : []).flatMap((x) => pick(x, mm[4]));
          return pick(mm[2] !== undefined ? v?.[Number(mm[2])] : v?.[mm[3]], mm[4]);
        };
        for (const x of pick(value, jq === "." ? "" : jq)) io.out((typeof x === "string" ? x : JSON.stringify(x)) + "\n");
      } else io.out(JSON.stringify(value, null, 2) + "\n");
    };
    if (method === "GET") {
      emit(data.rulesets.map((r) => ({ id: r.id, name: r.name, target: r.target, source_type: "Repository", source: `${m[1]}/${m[2]}`, enforcement: r.enforcement })));
      return 0;
    }
    if (method !== "POST") throw new GhError(`the sandbox's gh api supports GET and POST here, not ${method}`);
    let body;
    try { body = JSON.parse(opts["--input"] ? sh.fs.text(sh.abs(opts["--input"])) ?? "" : "{}"); }
    catch { throw new GhError("gh: Problems parsing JSON (HTTP 400)"); }
    if (!body.name || !body.enforcement) throw new GhError("gh: Invalid request.\n\n\"name\" and \"enforcement\" are required. (HTTP 422)");
    const RULE_TYPES = ["creation", "update", "deletion", "required_linear_history", "merge_queue", "required_deployments", "required_signatures",
      "pull_request", "required_status_checks", "non_fast_forward", "commit_message_pattern", "commit_author_email_pattern", "committer_email_pattern",
      "branch_name_pattern", "tag_name_pattern", "file_path_restriction", "max_file_path_length", "file_extension_restriction", "max_file_size",
      "workflows", "code_scanning", "copilot_code_review"];
    const PR_PARAMS = ["dismiss_stale_reviews_on_push", "require_code_owner_review", "require_last_push_approval", "required_approving_review_count", "required_review_thread_resolution"];
    const invalid = (path) => new GhError(`gh: Invalid request.\n\nInvalid property ${path}: data matches no possible input. See \`documentation_url\`. (HTTP 422)`);
    if (!["active", "evaluate", "disabled"].includes(body.enforcement)) throw invalid("/enforcement");
    if (body.target && !["branch", "tag", "push"].includes(body.target)) throw invalid("/target");
    (body.rules ?? []).forEach((rule, k) => {
      if (!RULE_TYPES.includes(rule?.type)) throw invalid(`/rules/${k}`);
      if (rule.type === "pull_request" && PR_PARAMS.some((x) => rule.parameters?.[x] === undefined)) throw invalid(`/rules/${k}`);
    });
    const rs = { id: 4200000 + data.rulesets.length + 1, name: body.name, target: body.target ?? "branch", enforcement: body.enforcement, conditions: body.conditions ?? {}, rules: body.rules ?? [] };
    data.rulesets.push(rs);
    await ghSave(sh, rdir, data);
    emit({ id: rs.id, name: rs.name, target: rs.target, source_type: "Repository", source: `${m[1]}/${m[2]}`, enforcement: rs.enforcement, conditions: rs.conditions, rules: rs.rules });
    void state;
    return 0;
  }

  // For exercise checks: read what's on the pretend GitHub.
  return { ghLoad, ghSave, defaultBranchOf, branchesOf, GH, hooks, GhError, fuzzyAgo, table, baseRepo, ghState, copyObjects, findPull,
    mergeTreesOnServer, writeCommitFromFiles, rulesFor };
}
