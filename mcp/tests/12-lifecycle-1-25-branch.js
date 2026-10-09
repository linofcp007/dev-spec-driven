"use strict";
// Lifecycle — 1.25 create --branch: a feature's own git branch (spec_create {branch}) — the name, its validation, the record, the merge driver, the readers.
// The engine never runs git: these tests build the repository's FILES (HEAD, loose refs, packed-refs, a worktree's .git file) —
// no git needed. cli/tests/12-lifecycle-1-25-branch.js runs the CLI in a real repository.

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, rpc, payload, S, tmp }) => {
  const js = JSON.stringify;
  const SHA = "a".repeat(40), SHA2 = "b".repeat(40);
  const rd = (...a) => fs.readFileSync(path.join(...a), "utf8");
  const state = (p, slug) => JSON.parse(rd(p, ".specs", slug, ".state.json"));
  const fresh = (n) => { const p = path.join(tmp, "proj-branch-" + n); S.initProject(p, ["core"], "en"); return p; };
  // .git as git writes it: HEAD, loose refs (refs/heads/<name>), packed-refs
  const fakeGit = (p, head, refs = {}, packed = null) => {
    const g = path.join(p, ".git");
    fs.mkdirSync(path.join(g, "refs", "heads"), { recursive: true });
    fs.writeFileSync(path.join(g, "HEAD"), head + "\n");
    for (const [name, sha] of Object.entries(refs)) {
      const f = path.join(g, "refs", "heads", ...name.split("/"));
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, sha + "\n");
    }
    if (packed) fs.writeFileSync(path.join(g, "packed-refs"), "# pack-refs with: peeled fully-peeled sorted \n" + Object.entries(packed).map(([n, s]) => s + " refs/heads/" + n).join("\n") + "\n");
    return g;
  };
  // a folder with no .git at or above it (tmp itself may sit inside a repository — then the no-git checks are skipped)
  const noRepoAbove = (() => { let d = path.resolve(tmp); for (;;) { if (fs.existsSync(path.join(d, ".git"))) return false; const up = path.dirname(d); if (up === d) return true; d = up; } })();

  // 1.25 create --branch: the default name by kind, the record, the command — over MCP (spec_create {branch: true})
  {
    const p = fresh("mcp");
    fakeGit(p, "ref: refs/heads/main", { main: SHA });
    const r = payload(await rpc("tools/call", { name: "spec_create", arguments: { name: "Login flow", tracks: ["core"], branch: true, projectDir: p } }));
    const st = state(p, "login-flow");
    ok(r.ok && r.branch && r.branch.name === "feature/login-flow" && r.branch.base === "main" && r.branch.commit === SHA && r.branch.recorded === true &&
      r.branch.command === "git switch -c feature/login-flow" && js(r.branch.args) === '["switch","-c","feature/login-flow"]' && r.branch.current === "main" &&
      /run git switch -c feature\/login-flow to start on it \(this server never runs git\)/.test(r.note) &&
      js(st.branch) === js({ name: "feature/login-flow", base: "main", commit: SHA, at: st.createdAt }) && r.branch.at === st.createdAt,
      "1.25 create --branch: spec_create {branch: true} names feature/<slug>, RECORDS .state.json branch {name, base, commit, at} read from the repository's files (HEAD, its ref) and returns branch.command (git switch -c …) + its args for the agent to run — the server runs no git (got " + js([r.branch, r.note, st.branch]) + ")");

    const b = S.createFeature(p, "Crash on save", undefined, undefined, undefined, "en", "bugfix", { branch: true });
    const s = S.createFeature(p, "Cache choice", undefined, undefined, undefined, "en", "spike", { branch: true });
    const c = S.createFeature(p, "Footer typo", undefined, "fix a typo", undefined, "en", "change", { branch: true });
    const g = S.createFeature(p, "Named one", ["core"], undefined, undefined, "en", undefined, { branch: "team/ana/named+1.2" });
    const off = S.createFeature(p, "No branch", ["core"], undefined, undefined, "en", undefined, { branch: false });
    ok(b.branch.name === "fix/crash-on-save" && s.branch.name === "spike/cache-choice" && c.kind === "change" && c.branch.name === "feature/footer-typo" &&
      g.branch.name === "team/ana/named+1.2" && g.branch.recorded && state(p, g.slug).branch.name === "team/ana/named+1.2" &&
      off.ok && !("branch" in off) && !("branch" in state(p, off.slug)),
      "1.25 create --branch: the default name follows the kind — fix/<slug> (bugfix), spike/<slug>, feature/<slug> (a feature, a change); a name given is used as given; branch: false is no branch (no key) (got " +
      js([b.branch, s.branch.name, c.branch.name, g.branch.name, off.branch]) + ")");
    const sna = S.nextAction(p, s.slug), sfin = S.finishFeature(p, s.slug);
    ok(sna.kind === "spike" && sna.branch && sna.branch.name === "spike/cache-choice" && /This feature's branch is spike\/cache-choice and you are on main — git switch -c spike\/cache-choice first\./.test(sna.recommendation) &&
      sfin.kind === "spike" && sfin.branch && sfin.branch.name === "spike/cache-choice" && !sfin.readyToFinish && !/Branch spike/.test(sfin.message),
      "1.25 create --branch: a spike's next_action and finish name its branch too (-c while the branch isn't there) (got " + js([sna.branch, sna.recommendation.slice(-110), sfin.branch && sfin.branch.name]) + ")");
  }

  // the name is validated BEFORE anything is written — git's rules AND a shell-safe set (the command is handed out unquoted)
  {
    const p = fresh("names");
    fakeGit(p, "ref: refs/heads/main", { main: SHA });
    const bad = ["a b", "a..b", ".x", "x/.y", "x.lock", "x/y.LOCK", "-x", "/x", "x/", "x.", "a//b", "HEAD", "a~b", "a^b", "a:b", "a?b", "a*b", "a[b", "a\\b",
      "a;b", "$x", "a'b", "a\"b", "a|b", "a&b", "a@{b", "@", "a,b", "a(b)", "x".repeat(201), "a\tb"];
    const refused = bad.map((n, i) => {
      const r = S.createFeature(p, "Bad " + i, ["core"], undefined, undefined, "en", undefined, { branch: n });
      return r.ok === false && /is not a branch name dev-spec can hand to git/.test(r.error) && !fs.existsSync(path.join(p, ".specs", "bad-" + i)) ? null : n;
    }).filter((x) => x !== null);
    const good = ["feature/login", "release-1.2", "user/joe/x+y", "ação/ünï", "a_b", "x".repeat(200)].map((n, i) => S.createFeature(p, "Good " + i, ["core"], undefined, undefined, "en", undefined, { branch: n }));
    const empty = S.createFeature(p, "Empty", ["core"], undefined, undefined, "en", undefined, { branch: "  " });
    const wrongType = S.createFeature(p, "Wrong", ["core"], undefined, undefined, "en", undefined, { branch: 3 });
    const pt = S.createFeature(p, "Mau", ["core"], undefined, undefined, "pt", undefined, { branch: "a b" });
    ok(!refused.length && good.every((r) => r.ok && r.branch.recorded) && good[4].branch.name === "a_b" &&
      empty.ok === false && /give a name, or true for the default/.test(empty.error) && wrongType.ok === false && /branch must be a boolean \(true\/false\) \| a string/.test(wrongType.error) &&
      pt.ok === false && /não é um nome de branch que o dev-spec possa passar ao git/.test(pt.error) && !fs.existsSync(path.join(p, ".specs", "empty")),
      "1.25 create --branch: a name git refuses (.., //, a part starting with '.' or ending with .lock, a leading -, /, a trailing / or ., HEAD, ~^:?*[\\ …) or a shell would read (space, quotes, ; | & $ , ( )) — or over 200 characters — is refused, localized, nothing written; letters (any script), digits, . _ + - / pass; an empty name / a non-string is refused (got " +
      js([refused, good.map((r) => r.ok), empty.error, wrongType.error]) + ")");
    // MCP: the schema types it ONE plain string ('true' or a name — a list-valued type is rejected by some clients); a boolean is read as
    // its word before validation, anything else is refused before the engine
    const tool = (await rpc("tools/list", {})).result.tools.find((t) => t.name === "spec_create");
    const num = await rpc("tools/call", { name: "spec_create", arguments: { name: "Num", branch: 1, projectDir: p } });
    const word = payload(await rpc("tools/call", { name: "spec_create", arguments: { name: "Word", tracks: ["core"], branch: " TRUE ", projectDir: p } }));
    const no = payload(await rpc("tools/call", { name: "spec_create", arguments: { name: "Nope", tracks: ["core"], branch: false, projectDir: p } }));
    const noWord = payload(await rpc("tools/call", { name: "spec_create", arguments: { name: "Nope word", tracks: ["core"], branch: "false", projectDir: p } }));
    ok(tool.inputSchema.properties.branch.type === "string" && /this server never runs git/.test(tool.inputSchema.properties.branch.description) &&
      num.result && num.result.isError && /branch must be a string/.test(payload(num).error || JSON.stringify(num.result)) && !fs.existsSync(path.join(p, ".specs", "num")) &&
      word.ok && word.branch.name === "feature/word" && no.ok && !("branch" in no) && noWord.ok && !("branch" in noWord),
      "1.25 create --branch: spec_create's schema types branch as a plain string ('true' — any case — is the default name, 'false' none); a boolean is read as its word; branch: 1 is an invalid argument, nothing created (got " + js([num.result, word.branch, no.branch]).slice(0, 400) + ")");
  }

  // an existing branch of that name is never recorded (nor switched to); outside a repository nothing is recorded; detached / unborn HEAD
  {
    const p = fresh("exists");
    fakeGit(p, "ref: refs/heads/main", { main: SHA, "feature/taken": SHA2 }, { "feature/packed": SHA2 });
    const loose = S.createFeature(p, "Taken", ["core"], undefined, undefined, "en", undefined, { branch: true });
    const packed = S.createFeature(p, "Packed", ["core"], undefined, undefined, "en", undefined, { branch: true });
    ok(loose.ok && loose.branch.recorded === false && loose.branch.reason === "exists" && !loose.branch.command && /A git branch named feature\/taken already exists — not recorded, and never switched to/.test(loose.note) &&
      !("branch" in state(p, loose.slug)) && packed.ok && packed.branch.reason === "exists" && !("branch" in state(p, packed.slug)) && fs.existsSync(path.join(loose.dir, "requirements.md")),
      "1.25 create --branch: a branch of that name that exists already (a loose ref, or one in packed-refs) is NOT recorded and no command is handed out — the feature is created, the note says why (got " + js([loose.branch, packed.branch]) + ")");

    const d = fresh("detached");
    fakeGit(d, SHA2);
    const det = S.createFeature(d, "Det", ["core"], undefined, undefined, "en", undefined, { branch: true });
    const u = fresh("unborn");
    fakeGit(u, "ref: refs/heads/trunk");
    const unb = S.createFeature(u, "Unb", ["core"], undefined, undefined, "en", undefined, { branch: true });
    ok(det.branch.recorded && det.branch.base === null && det.branch.commit === SHA2 && state(d, det.slug).branch.base === null &&
      unb.branch.recorded && unb.branch.base === "trunk" && unb.branch.commit === null && unb.branch.command === "git switch -c feature/unb",
      "1.25 create --branch: a detached HEAD records base null + its commit; a repository without a commit records its branch (base) and commit null (got " + js([det.branch, unb.branch]) + ")");

    // a linked worktree: .git is a FILE (gitdir: …); HEAD lives in the worktree's gitdir, the branches in the common dir (commondir)
    const main = path.join(tmp, "proj-branch-wt-main");
    const gm = fakeGit(main, "ref: refs/heads/main", { main: SHA, "feature/wt": SHA2 });
    const wtGit = path.join(gm, "worktrees", "w1");
    fs.mkdirSync(wtGit, { recursive: true });
    fs.writeFileSync(path.join(wtGit, "HEAD"), "ref: refs/heads/dev\n");
    fs.writeFileSync(path.join(wtGit, "commondir"), "../..\n");
    fs.mkdirSync(path.join(gm, "refs", "heads"), { recursive: true });
    fs.writeFileSync(path.join(gm, "refs", "heads", "dev"), SHA + "\n");
    const wt = path.join(tmp, "proj-branch-wt");
    S.initProject(wt, ["core"], "en");
    fs.writeFileSync(path.join(wt, ".git"), "gitdir: " + wtGit + "\n");
    const w1 = S.createFeature(wt, "Wt", ["core"], undefined, undefined, "en", undefined, { branch: true });
    const w2 = S.createFeature(wt, "Other wt", ["core"], undefined, undefined, "en", undefined, { branch: true });
    ok(w1.branch.reason === "exists" && w2.branch.recorded && w2.branch.base === "dev" && w2.branch.commit === SHA,
      "1.25 create --branch: in a linked worktree (.git FILE → gitdir, commondir) HEAD is the worktree's own, the branches the common dir's (got " + js([w1.branch, w2.branch]) + ")");

    if (noRepoAbove) {
      const n = path.join(tmp, "proj-branch-nogit");
      S.initProject(n, ["core"], "pt");
      const r = payload(await rpc("tools/call", { name: "spec_create", arguments: { name: "Solto", tracks: ["core"], branch: true, projectDir: n } }));
      ok(r.ok && r.branch.recorded === false && r.branch.reason === "no-git" && r.branch.name === "feature/solto" && !r.branch.command &&
        /Não há aqui um repositório git — nenhum branch foi registado/.test(r.note) && !("branch" in state(n, "solto")) && fs.existsSync(path.join(n, ".specs", "solto", "requirements.md")),
        "1.25 create --branch: outside a git repository the feature is created, nothing recorded, no command — the note says it (in the feature's language) (got " + js([r.branch, r.note]) + ")");
    } else ok(true, "1.25 create --branch: no-git — skipped: tmp sits inside a repository");
  }

  // a re-run keeps the branch the feature started on; an existing feature without one gets it; the readers name it
  {
    const p = fresh("rerun");
    const g = fakeGit(p, "ref: refs/heads/main", { main: SHA });
    const c = S.createFeature(p, "Pay", ["core"], undefined, undefined, "en", undefined, { branch: true });
    const rec = state(p, c.slug).branch;
    const again = S.createFeature(p, "Pay", undefined, undefined, undefined, undefined, undefined, { branch: "other/name" });
    ok(again.ok && again.existed && again.branch.kept === true && again.branch.name === "feature/pay" && js(state(p, c.slug).branch) === js(rec) &&
      again.branch.command === "git switch -c feature/pay" && /The feature's branch stays feature\/pay, recorded when it started \(other\/name was not recorded\)/.test(again.note),
      "1.25 create --branch: a re-run keeps the recorded branch (another name asked is noted, never recorded) and hands out the way onto it — -c while the branch isn't there yet (got " + js([again.branch, again.note]) + ")");

    // HEAD on main, the branch now there: status / next_action name it, next_action asks for the switch first (the step itself unchanged)
    fs.mkdirSync(path.join(g, "refs", "heads", "feature"), { recursive: true });
    fs.writeFileSync(path.join(g, "refs", "heads", "feature", "pay"), SHA2 + "\n");
    const stOff = S.statusFeature(p, c.slug);
    const naOff = S.nextAction(p, c.slug);
    const reOff = S.createFeature(p, "Pay", undefined, undefined, undefined, undefined, undefined, { branch: true });
    fs.writeFileSync(path.join(g, "HEAD"), "ref: refs/heads/feature/pay\n");
    const stOn = S.statusFeature(p, c.slug);
    const naOn = S.nextAction(p, c.slug);
    const reOn = S.createFeature(p, "Pay", undefined, undefined, undefined, undefined, undefined, { branch: true });
    ok(stOff.branch && stOff.branch.name === "feature/pay" && stOff.branch.base === "main" && stOff.branch.current === "main" && stOff.branch.exists === true &&
      /This feature's branch is feature\/pay and you are on main — git switch feature\/pay first\./.test(naOff.recommendation) && naOff.branch.name === "feature/pay" &&
      reOff.branch.command === "git switch feature/pay" && js(reOff.branch.args) === '["switch","feature/pay"]' &&
      stOn.branch.current === "feature/pay" && !/This feature's branch is/.test(naOn.recommendation) && naOn.step === naOff.step && !reOn.branch.command && reOn.branch.current === "feature/pay",
      "1.25 create --branch: status / next_action carry `branch` (+ current, exists); off the branch next_action appends `git switch <name> first` to the same step, on it nothing; a re-run hands out `git switch <name>` (no -c) or nothing when HEAD is on it (got " +
      js([stOff.branch, naOff.recommendation.slice(-120), reOff.branch.command, stOn.branch.current, reOn.branch]) + ")");

    const plain = S.createFeature(p, "Later", ["core"], undefined, undefined, "en");
    const plainHad = "branch" in state(p, plain.slug) || "branch" in plain || "branch" in S.statusFeature(p, plain.slug);
    const later = S.createFeature(p, "Later", undefined, undefined, undefined, undefined, undefined, { branch: true });
    ok(!plainHad && later.ok && later.existed && later.branch.recorded && !later.branch.kept && state(p, plain.slug).branch.name === "feature/later" && state(p, plain.slug).branch.base === "feature/pay" &&
      S.statusFeature(p, plain.slug).branch.name === "feature/later",
      "1.25 create --branch: a feature created without a branch has no key (nor status); a re-run on it WITH branch records one now (its base: the branch HEAD is on) (got " + js([plainHad, later.branch, state(p, plain.slug).branch]) + ")");
    // a hand-broken record reads as none; a feature without one shows nothing
    const sp = path.join(p, ".specs", plain.slug, ".state.json");
    fs.writeFileSync(sp, JSON.stringify({ ...state(p, plain.slug), branch: { name: "a b" } }, null, 2));
    ok(!("branch" in S.statusFeature(p, plain.slug)) && S.featureBranch(p, plain.slug) === null && S.featureBranch(p, c.slug).name === "feature/pay" && S.featureBranch(p, "nope") === null,
      "1.25 create --branch: a record that is no usable branch (a hand edit) reads as none; featureBranch() → the view or null");
  }

  // spec_finish names the branch: in the result, the merge summary and — ready — the two local options
  {
    const p = fresh("finish");
    fakeGit(p, "ref: refs/heads/main", { main: SHA });
    const c = S.createFeature(p, "Footer typo", undefined, "fix a typo in the footer", undefined, "en", "change", { branch: true });
    fs.writeFileSync(path.join(c.dir, "change.md"), "# Change: footer typo\n\n## Summary\nThe footer says \"Copyrigth\"; it must say \"Copyright\".\n\n## Acceptance Criteria (EARS)\n" +
      "1. **US-1.AC-1** — WHEN any page renders THE SYSTEM SHALL show the footer text \"Copyright 2026 Acme\".\n\n## Approach\nOne string in templates/footer.html.\n\n" +
      "## Tasks\n- [ ] 1. [US1] Fix the footer string in templates/footer.html\n  - _Requirements: US-1.AC-1_\n  - _Verify: node -e \"process.exit(0)\"_\n");
    const ff = S.approvePhase(p, c.slug, null, "t", { through: "tasks" });
    const tick = S.completeTask(p, c.slug, 1, { command: 'node -e "process.exit(0)"', exitCode: 0, summary: "ok" });
    const fin = payload(await rpc("tools/call", { name: "spec_finish", arguments: { name: c.slug, projectDir: p } }));
    const fw = S.finishFeature(p, c.slug, { write: true });
    const file = rd(c.dir, ".execution", "merge-summary.md");
    const pt = fresh("finish-pt");
    fakeGit(pt, "ref: refs/heads/main", { main: SHA });
    const cpt = S.createFeature(pt, "Rodapé", ["core"], undefined, undefined, "pt", undefined, { branch: true });
    const fpt = S.finishFeature(pt, cpt.slug);
    ok(ff.ok && tick.ok && fin.readyToFinish && fin.branch && fin.branch.name === "feature/footer-typo" && fin.branch.base === "main" && fin.branch.commit === SHA &&
      / Branch feature\/footer-typo \(from main\): 1\. merge it into main locally — git switch main, then git merge feature\/footer-typo · 2\. keep the branch\.$/.test(fin.message) &&
      /^## Summary\n.+\n\nBranch: `feature\/footer-typo` — from `main` at aaaaaaa\n/m.test(fin.mergeSummary) && /Branch: `feature\/footer-typo` — from `main` at aaaaaaa/.test(file) &&
      fw.branch.name === "feature/footer-typo" && !fpt.readyToFinish && !/Branch rodape/.test(fpt.message) && /^Branch: `feature\/rodape` — a partir de `main` em aaaaaaa$/m.test(fpt.mergeSummary || ""),
      "1.25 create --branch: spec_finish names the branch — `branch` in the result, a line in the merge summary (file too), and once ready the two local options with it (merge into the base / keep it); not ready: no options line; localized (got " +
      js([fin.branch, fin.message, (fin.mergeSummary || "").slice(0, 200), fpt.message]) + ")");
  }

  // the git merge driver: the branch record of two branches
  {
    const rec = (name, at, extra) => ({ name, base: "main", commit: SHA, at, ...(extra || {}) });
    const base = { lang: "en", tracks: ["core"], approvals: {} };
    const one = S.mergeStateJson(base, { ...base, branch: rec("feature/x", "2026-10-01T00:00:00.000Z") }, base, "state");
    const earlier = S.mergeStateJson(base, { ...base, branch: rec("feature/x", "2026-10-02T00:00:00.000Z") }, { ...base, branch: rec("feature/y", "2026-10-01T00:00:00.000Z") }, "state");
    const tie = S.mergeStateJson(base, { ...base, branch: rec("feature/x", "2026-10-01T00:00:00.000Z") }, { ...base, branch: rec("feature/y", "2026-10-01T00:00:00.000Z") }, "state");
    const same = S.mergeStateJson(base, { ...base, branch: rec("feature/x", "2026-10-01T00:00:00.000Z") }, { ...base, branch: rec("feature/x", "2026-10-01T00:00:00.000Z", { base: "dev", note: "t" }) }, "state");
    const noTime = S.mergeStateJson(base, { ...base, branch: { name: "feature/x" } }, { ...base, branch: rec("feature/y", "2026-10-01T00:00:00.000Z") }, "state");
    const text = S.mergeStateText(js(base), js({ ...base, branch: rec("feature/x", "2026-10-03T00:00:00.000Z") }, null, 2) + "\n", js({ ...base, branch: rec("feature/y", "2026-10-01T00:00:00.000Z") }), { path: ".specs/x/.state.json" });
    ok(one.merged.branch.name === "feature/x" && !one.conflicts.length && earlier.merged.branch.name === "feature/y" && !earlier.conflicts.length &&
      tie.merged.branch.name === "feature/x" && tie.conflicts.length === 1 && tie.conflicts[0].path === "branch" &&
      same.merged.branch.base === "main" && same.merged.branch.note === "t" && !same.conflicts.length && noTime.merged.branch.name === "feature/y" && !noTime.conflicts.length &&
      text.ok && text.clean && JSON.parse(text.text).branch.name === "feature/y",
      "1.25 create --branch: the merge driver knows `branch` — one side's record is taken; two records → the EARLIER (`at`: where the feature started first; none = later); the same time and two names → a conflict (ours kept); the same name → one record (ours' fields over theirs') (got " +
      js([earlier.merged.branch, tie.conflicts, same.merged.branch, noTime.merged.branch]) + ")");
  }

  // 1.25.1 (review 7): spec_log = `dev-spec log <f> --json` for a feature on its own branch — the CLI reads `git log <commit>..HEAD`;
  // spec_log's description names that range, and a log handed in that holds the start commit (a full log) is cut there (it and the
  // older commits are no work of the feature) and labelled `since`, as the CLI's. Without a branch record nothing changes.
  {
    const p = fresh("log");
    fakeGit(p, "ref: refs/heads/main", { main: SHA });
    payload(await rpc("tools/call", { name: "spec_create", arguments: { name: "Pay", tracks: ["core"], branch: true, projectDir: p } }));
    fs.writeFileSync(path.join(p, ".specs", "pay", "tasks.md"), "# Tasks\n\n## Phase: Build\n- [ ] 1. [US1] First\n- [ ] 2. [US1] Second\n");
    const commit = (sha, msg) => `commit ${sha}\nAuthor: T <t@example.com>\nDate:   2026-10-01T10:00:00+00:00\n\n    ${msg}\n\nsrc/a.js\n`;
    const full = [commit("c".repeat(40), "feat(pay): task #2"), commit("d".repeat(40), "feat(pay): task #1"), commit(SHA, "chore: start"), commit("e".repeat(40), "feat(pay): task #2 (older work, before the branch)")].join("\n");
    const ranged = full.slice(0, full.indexOf("commit " + SHA));
    const viaFull = payload(await rpc("tools/call", { name: "spec_log", arguments: { name: "pay", gitLog: full, projectDir: p } }));
    const viaRange = payload(await rpc("tools/call", { name: "spec_log", arguments: { name: "pay", gitLog: ranged, projectDir: p } }));
    const cli = S.taskCommits(p, "pay", ranged, { max: 1000, since: { base: "main", commit: SHA } }); // what `dev-spec log pay` hands the engine
    const whole = S.taskCommits(p, "pay", full, { since: null }); // the CLI's fallback (git no longer knows the commit): the whole log
    const desc = (await rpc("tools/list", {})).result.tools.find((t) => t.name === "spec_log").description;
    const plain = fresh("log-plain");
    S.createFeature(plain, "Pay", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(plain, ".specs", "pay", "tasks.md"), "# Tasks\n\n## Phase: Build\n- [ ] 1. [US1] First\n- [ ] 2. [US1] Second\n");
    const noBranch = payload(await rpc("tools/call", { name: "spec_log", arguments: { name: "pay", gitLog: full, projectDir: plain } }));
    const counts = (r) => r.tasks.map((t) => t.commits.length).join();
    ok(viaFull.ok && viaFull.commits === 2 && counts(viaFull) === "1,1" && js(viaFull.since) === js({ base: "main", commit: SHA }) &&
      viaRange.commits === 2 && js(viaRange.tasks) === js(viaFull.tasks) && js(viaRange.since) === js(viaFull.since) &&
      js(cli.tasks) === js(viaFull.tasks) && js(cli.since) === js(viaFull.since) && whole.commits === 4 && !whole.since &&
      noBranch.commits === 4 && counts(noBranch) === "1,2" && !noBranch.since &&
      /git log <branch\.commit>\.\.HEAD --name-only --relative/.test(desc),
      "1.25.1 r7: spec_log on a feature with its own branch reads the range the CLI reads (<commit>..HEAD) — a full log is cut at the start commit, a ranged one taken as it is, both labelled since, the same result as the CLI's; the description names the range; a feature without a branch reads the whole log (got " +
      js([viaFull.commits, counts(viaFull), viaFull.since, viaRange.commits, cli.commits, whole.commits, noBranch.commits, counts(noBranch)]) + ")");
  }
};
