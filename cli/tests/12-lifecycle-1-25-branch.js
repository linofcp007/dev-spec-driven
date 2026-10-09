"use strict";
// 1.25 create --branch [<name>] in a real git repository: switched to, base recorded; outside git; a branch that exists; git failing / missing; status, next-action, finish, log.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, all, spawnIn, tmp, CLI }) => {
  const js = JSON.stringify;
  // git isolated from the user's config (no global hooks, signing or default branch), the CLI with the same environment
  const cfg = path.join(tmp, "br-gitconfig");
  fs.writeFileSync(cfg, "");
  const env = { ...process.env, SPEC_PROJECT_DIR: tmp, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: cfg, HOME: tmp, XDG_CONFIG_HOME: tmp, GIT_TERMINAL_PROMPT: "0",
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" };
  const cli = (args, e) => { // in-process (1.27), but a --run — it waits for its commands: spawned
    const o = { encoding: "utf8", env: e || env };
    const r = args.includes("--run") ? spawnSync(process.execPath, [CLI, ...args], o) : spawnIn(args, o);
    return { out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "", code: r.status };
  };
  const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8", env });
  const hasGit = (() => { const g = git(tmp, "--version"); return !g.error && g.status === 0; })();
  const st = (p, slug) => JSON.parse(fs.readFileSync(path.join(p, ".specs", slug, ".state.json"), "utf8"));
  const jsonOf = (s) => { try { return JSON.parse(s); } catch { return null; } };
  const current = (p) => String(git(p, "branch", "--show-current").stdout || "").trim();

  // outside a repository: created, nothing recorded, exit 1 (tmp may sit inside one — then skipped)
  const outside = path.join(tmp, "br-outside");
  fs.mkdirSync(outside, { recursive: true });
  const inRepo = hasGit && git(outside, "rev-parse", "--is-inside-work-tree").status === 0;
  if (!inRepo) {
    const o = cli(["create", "Loose", "core", "--branch", "--project", outside]);
    ok(o.code === 1 && /No git repository here — no branch was recorded \(feature\/loose would have been the feature's branch; the feature was created\)/.test(o.out) &&
      fs.existsSync(path.join(outside, ".specs", "loose", "requirements.md")) && !("branch" in st(outside, "loose")),
      "1.25 create --branch: outside a git repository the feature is created, no branch recorded, the note says it — exit 1 (asked for a branch, not on one) (got " + js([o.code, o.out.slice(-220)]) + ")");
  } else ok(true, "1.25 create --branch: outside git — skipped: tmp sits inside a repository");

  // usage: a track word after --branch is ambiguous; an invalid name — both refused before anything is written
  const amb = cli(["create", "Amb", "--branch", "tdd", "--project", outside]);
  const bad = cli(["create", "Bad", "core", "--branch", "a..b", "--project", outside]);
  const notFor = cli(["list", "--branch", "--project", outside]);
  ok(amb.code === 1 && /--branch tdd: 'tdd' is a track — put the tracks before --branch/.test(amb.out) && !fs.existsSync(path.join(outside, ".specs", "amb")) &&
    bad.code === 1 && /'a\.\.b' is not a branch name dev-spec can hand to git/.test(bad.out) && !fs.existsSync(path.join(outside, ".specs", "bad")) &&
    notFor.code === 1 && /--branch/.test(notFor.out),
    "1.25 create --branch: `--branch tdd` (a track word as its value) and an invalid name are refused, nothing created; --branch is create / bugfix / spike's only (got " + js([amb.out.slice(0, 160), bad.out.slice(0, 120), notFor.out.slice(0, 120)]) + ")");

  if (!hasGit) { ok(true, "1.25 create --branch: the git checks — skipped: no git"); return; }

  const repo = path.join(tmp, "br-repo");
  fs.mkdirSync(repo, { recursive: true });
  git(repo, "-c", "init.defaultBranch=main", "init", "-q");
  git(repo, "commit", "-q", "--allow-empty", "-m", "init");
  const baseSha = String(git(repo, "rev-parse", "HEAD").stdout).trim();
  cli(["init", "--project", repo]);

  // create --branch: git switch -c feature/<slug>, base + commit recorded, exit 0
  const c1 = cli(["create", "Login flow", "core", "--branch", "--project", repo]);
  const s1 = st(repo, "login-flow");
  ok(c1.code === 0 && new RegExp("Branch feature/login-flow created from main \\(" + baseSha.slice(0, 7) + "\\) — you are on it now\\.").test(c1.out) && current(repo) === "feature/login-flow" &&
    s1.branch && s1.branch.name === "feature/login-flow" && s1.branch.base === "main" && s1.branch.commit === baseSha && s1.branch.at === s1.createdAt && !/run git switch/.test(c1.out),
    "1.25 create --branch: in a repository the CLI records {name, base, commit} (git's own answer) and runs git switch -c feature/<slug> — you are on it, exit 0 (got " + js([c1.code, c1.out.slice(-200), current(repo), s1.branch]) + ")");

  // status names it; off the branch next-action says to switch first; a re-run switches back onto the feature's OWN branch
  git(repo, "switch", "-q", "main");
  const stOff = cli(["status", "login-flow", "--project", repo]);
  const naOff = cli(["next-action", "login-flow", "--project", repo]);
  const re = cli(["create", "Login flow", "--branch", "--project", repo]);
  const onAfter = current(repo);
  const reOn = cli(["create", "Login flow", "--branch", "--project", repo]);
  ok(/ {2}branch: feature\/login-flow \(from main at [0-9a-f]{7}\) — you are on main/.test(stOff.out) &&
    /This feature's branch is feature\/login-flow and you are on main — git switch feature\/login-flow first\./.test(naOff.out) &&
    re.code === 0 && /Now on the feature's branch feature\/login-flow\./.test(re.out) && onAfter === "feature/login-flow" &&
    reOn.code === 0 && /On the feature's branch feature\/login-flow\./.test(reOn.out) && js(st(repo, "login-flow").branch) === js(s1.branch),
    "1.25 create --branch: status shows the branch (and where HEAD is), next-action asks to switch first; a re-run of create --branch switches onto the feature's own branch (git switch, no -c), exit 0 — the record unchanged (got " +
    js([stOff.out.slice(-120), re.out.slice(-120), onAfter, reOn.out.slice(-80)]) + ")");

  // --json: the engine's result + what the CLI did (switched, created, current); a name given; bugfix → fix/, spike → spike/
  git(repo, "switch", "-q", "main");
  const j = cli(["create", "Named", "core", "--branch=team/named", "--json", "--project", repo]);
  const jr = jsonOf(j.stdout);
  git(repo, "switch", "-q", "main");
  const bf = cli(["bugfix", "Crash on save", "--branch", "--project", repo]);
  const bfOn = current(repo);
  git(repo, "switch", "-q", "main");
  const sp = cli(["spike", "Cache choice", "--question", "Which cache?", "--branch", "--project", repo]);
  const spOn = current(repo);
  all("1.25 create --branch: --json prints the engine's result with switched / created / current; --branch=<name> names it; bugfix --branch → fix/<slug>, spike --branch → spike/<slug> (got " + js([j.code, jr && jr.branch, bfOn, spOn]) + ")", [
    () => j.code === 0, () => jr, () => jr.ok, () => jr.branch.name === "team/named", () => jr.branch.recorded === true,
    () => jr.branch.switched === true, () => jr.branch.created === true, () => jr.branch.current === "team/named",
    () => jr.branch.command === "git switch -c team/named", () => current(repo) === "spike/cache-choice", () => bf.code === 0,
    () => bfOn === "fix/crash-on-save", () => sp.code === 0, () => spOn === "spike/cache-choice",
    () => st(repo, "cache-choice").branch.name === "spike/cache-choice",
  ]);

  // a branch that exists: never recorded nor switched to, exit 1; git failing (a ref the new name can't live beside) → the record stays, exit 1
  git(repo, "switch", "-q", "main");
  git(repo, "branch", "taken");
  const tk = cli(["create", "Taken", "core", "--branch", "taken", "--project", repo]);
  git(repo, "branch", "zz");
  const df = cli(["create", "Clash", "core", "--branch", "zz/clash", "--project", repo]);
  const dfJ = cli(["create", "Clash", "--branch", "--json", "--project", repo]);
  const dfR = jsonOf(dfJ.stdout);
  all("1.25 create --branch: a branch of that name that exists is refused (not recorded, HEAD unchanged, the feature created) — exit 1; git refusing the switch (refs/heads/zz exists, so zz/<x> can't) keeps the record and says to run the command, exit 1 — a re-run tries again: --json switched: false + git's error (got " +
    js([tk.code, tk.out.slice(-160), df.code, df.out.slice(-200), dfR && dfR.branch]) + ")", [
    () => tk.code === 1, () => /A git branch named taken already exists — not recorded, and never switched to/.test(tk.out),
    () => current(repo) === "main", () => !("branch" in st(repo, "taken")),
    () => fs.existsSync(path.join(repo, ".specs", "taken", "requirements.md")), () => df.code === 1,
    () => /▲ git switch -c zz\/clash failed: .+ — the branch is recorded; run the command once that is fixed\./.test(df.out),
    () => current(repo) === "main", () => st(repo, "clash").branch.name === "zz/clash", () => dfJ.code === 1, () => dfR, () => dfR.ok === true,
    () => dfR.branch.kept === true, () => dfR.branch.switched === false, () => typeof dfR.branch.error === "string",
    () => dfR.branch.error.length > 0,
  ]);

  // git missing (not on PATH): the engine reads the repository's files and records the branch; the CLI can't switch — exit 1, the command printed
  const noGitEnv = { ...env, PATH: path.dirname(process.execPath), Path: path.dirname(process.execPath) };
  const probe = spawnSync("git", ["--version"], { encoding: "utf8", env: noGitEnv });
  if (probe.error) {
    const gm = cli(["create", "No tool", "core", "--branch", "--project", repo], noGitEnv);
    ok(gm.code === 1 && /▲ git could not run here — the branch is recorded but was not created: git switch -c feature\/no-tool/.test(gm.out) &&
      st(repo, "no-tool").branch.name === "feature/no-tool" && st(repo, "no-tool").branch.base === "main" && current(repo) === "main",
      "1.25 create --branch: git not on PATH — the record is made from the repository's files (base main), nothing switched, the command printed, exit 1 (got " + js([gm.code, gm.out.slice(-200)]) + ")");
  } else ok(true, "1.25 create --branch: git missing — skipped: git found beside node");

  // finish names the branch (a change: one change.md, the plan in one approval, one task) and log reads from the feature's start
  git(repo, "switch", "-q", "main");
  const ch = cli(["create", "Footer typo", "--size", "xs", "--summary", "fix the footer typo", "--branch", "--project", repo]);
  fs.writeFileSync(path.join(repo, ".specs", "footer-typo", "change.md"), "# Change: footer typo\n\n## Summary\nThe footer says \"Copyrigth\"; it must say \"Copyright\".\n\n## Acceptance Criteria (EARS)\n" +
    "1. **US-1.AC-1** — WHEN any page renders THE SYSTEM SHALL show the footer text \"Copyright 2026 Acme\".\n\n## Approach\nOne string in templates/footer.html.\n\n" +
    "## Tasks\n- [ ] 1. [US1] Fix the footer string in templates/footer.html\n  - _Requirements: US-1.AC-1_\n  - _Verify: node -e \"process.exit(0)\"_\n");
  const ap = cli(["approve", "footer-typo", "--through", "tasks", "--project", repo]);
  const dn = cli(["done", "footer-typo", "1", "--run", "--project", repo]);
  const fin = cli(["finish", "footer-typo", "--project", repo]);
  git(repo, "commit", "-q", "--allow-empty", "-m", "fix(footer-typo): task #1 — the footer string");
  const lg = cli(["log", "footer-typo", "--project", repo]);
  const lgJ = jsonOf(cli(["log", "footer-typo", "--json", "--project", repo]).stdout);
  ok(ch.code === 0 && current(repo) === "feature/footer-typo" && ap.code === 0 && dn.code === 0 && fin.code === 0 &&
    /Branch feature\/footer-typo \(from main\): 1\. merge it into main locally — git switch main, then git merge feature\/footer-typo · 2\. keep the branch\./.test(fin.out) &&
    /Branch: `feature\/footer-typo` — from `main` at [0-9a-f]{7}/.test(fin.out) &&
    new RegExp("read since the feature started: main at " + baseSha.slice(0, 7) + " \\(git log " + baseSha.slice(0, 7) + "\\.\\.HEAD\\)").test(lg.out) &&
    lgJ && lgJ.since && lgJ.since.commit === baseSha && lgJ.commits === 1 && lgJ.citing === 1,
    "1.25 create --branch: finish names the branch — the two local options (merge into main / keep it) and the merge summary's line; log reads only the commits since the feature started (<base commit>..HEAD) and says so (got " +
    js([ch.code, ap.code, dn.code, fin.code, fin.out.slice(0, 260), lg.out.slice(0, 200), lgJ && [lgJ.since, lgJ.commits]]) + ")");
};
