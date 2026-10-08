"use strict";
// Lifecycle — review 6 regressions: the ONE write gate under .specs/ (linked folders and files, paths of the wrong kind), velocity after an archive, comment-proof names, rename vs the backlog, every dependency cycle.
// (12-lifecycle.js and 12-lifecycle-review.js hold the area's earlier tests; this file the findings of the sixth review of the feature
// lifecycle, the scaffolds and the write paths.)

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, rpc, payload, S, tmp, __dirname }) => {
  const js = JSON.stringify;
  const CLI = path.join(__dirname, "..", "cli", "dev-spec.js");
  const fresh = (n, lang) => { const p = path.join(tmp, "proj-r6-" + n); S.initProject(p, ["core"], lang); return p; };
  const rd = (...a) => fs.readFileSync(path.join(...a), "utf8");
  const link = (target, at) => { try { fs.symlinkSync(target, at, "junction"); return true; } catch { return false; } };
  const fileLink = (target, at) => { try { fs.symlinkSync(target, at, "file"); return true; } catch { return false; } };
  // Every file under a folder (relative path + size + mtime) — what a refused write must leave as it was.
  const snap = (dir) => {
    const out = [];
    const walk = (d, rel) => {
      for (const e of fs.readdirSync(d).sort()) {
        const p = path.join(d, e);
        const st = fs.lstatSync(p);
        if (st.isDirectory()) walk(p, rel + e + "/");
        else out.push(rel + e + ":" + st.size + ":" + st.mtimeMs);
      }
    };
    walk(dir, "");
    return out.join("\n");
  };

  // 1.24 r6 G1: a feature folder linked outside .specs/ (a junction / symlink) — every feature mutator wrote through it (ticks, approvals,
  // briefs, retro.md, decisions, appended tasks, the merge summary, the lock). Refused once, up front (the lock is the first write):
  // { ok: false, linked: true }, nothing written where the link points, no .lock left there.
  {
    const p = fresh("linked-feature");
    const out = path.join(tmp, "r6-outside-feature");
    S.createFeature(p, "Victim", ["core"], "Users can export a report");
    const real = path.join(p, ".specs", "victim");
    fs.writeFileSync(path.join(real, "tasks.md"), "# Tasks\n\n- [ ] 1. Do the thing\n  - _Requirements: US-1.AC-1_\n  - _Verify: npm test_\n");
    fs.cpSync(real, out, { recursive: true });
    fs.rmSync(real, { recursive: true, force: true });
    if (link(out, real)) {
      const before = snap(out);
      const calls = {
        approve: () => S.approvePhase(p, "victim", "classification", "x", { force: true }),
        complete: () => S.completeTask(p, "victim", 1, { summary: "all green", exitCode: 0, command: "npm test" }),
        brief: () => S.taskBrief(p, "victim", 1, { write: true }),
        metrics: () => S.metrics(p, "victim", { write: true }),
        decide: () => S.decide(p, "victim", { title: "t", decision: "d" }),
        append: () => S.appendTasks(p, "victim", [{ text: "More", requirements: ["US-1.AC-1"] }]),
        finish: () => S.finishFeature(p, "victim", { write: true }),
        removeTrack: () => S.removeTrack(p, "victim", "tdd"),
        flow: () => S.manageFeature(p, "flow", "victim", "design-first"),
        rename: () => S.manageFeature(p, "rename", "victim", "victim-two"),
        archive: () => S.manageFeature(p, "archive", "victim"),
      };
      const res = Object.fromEntries(Object.entries(calls).map(([k, fn]) => [k, fn()]));
      const bad = Object.entries(res).filter(([, r]) => !(r.ok === false && r.linked === true && /Refused to write into \.specs\/victim\/: that folder is a link/.test(r.error)));
      ok(!bad.length && snap(out) === before && !fs.existsSync(path.join(out, ".lock")) && fs.existsSync(real),
        "1.24 r6 G1: every feature mutator (approve, done, brief --write, metrics --write, decide, append-tasks, finish --write, remove-track, flow, rename, archive) refuses a feature folder linked outside .specs/ — nothing written through it, no lock left there (got " +
        js(bad.map(([k, r]) => [k, r.ok, String(r.error).slice(0, 80)])) + ")");
      // the MCP surface answers the same refusal (isError) — and the CLI exits 1 with it
      const mcp = await rpc("tools/call", { name: "spec_complete_task", arguments: { name: "victim", number: 1, projectDir: p, evidence: { command: "npm test", exitCode: 0, summary: "ok" } } });
      const cli = spawnSync(process.execPath, [CLI, "decide", "victim", "--title", "t", "--decision", "d", "--project", p], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: p } });
      ok(mcp.result.isError === true && /that folder is a link/.test(js(payload(mcp))) && cli.status === 1 && /that folder is a link/.test(cli.stderr + cli.stdout) && snap(out) === before,
        "1.24 r6 G1: spec_complete_task (MCP, isError) and `dev-spec decide` (exit 1) refuse the linked feature folder alike (got " + js([mcp.result.isError, cli.status, (cli.stderr || cli.stdout).slice(0, 120)]) + ")");
      // remove: the link alone goes — the preview says so (no file of the target counted), the target keeps every file and gets no lock
      const pv = S.manageFeature(p, "remove", "victim");
      const rm = S.manageFeature(p, "remove", "victim", undefined, { confirm: true });
      ok(pv.needsConfirm === true && pv.link === true && pv.wouldDelete.files === 0 && /deletes only the link — the folder it points at and its files are kept/.test(pv.error) &&
        rm.ok === true && rm.link === true && !fs.existsSync(real) && snap(out) === before && !fs.existsSync(path.join(out, ".lock")) && !S.roadmap(p).features.some((f) => f.name === "victim"),
        "1.24 r6 G1: remove of a linked feature folder previews 'only the link' (0 files, link: true) and removes the link alone — the target folder and its files untouched, no lock created through it (got " +
        js([pv.wouldDelete, pv.error && pv.error.slice(0, 60), rm.ok, rm.error]) + ")");
    } else ok(true, "1.24 r6 G1: links not creatable here — skipped");
  }

  // 1.24 r6 G1: .specs/_archive/ linked outside the project — archive moved the whole feature there, restore pulled any folder the
  // target holds into .specs/. Both refused, nothing moved.
  {
    const p = fresh("linked-archive");
    const out = path.join(tmp, "r6-outside-archive");
    fs.mkdirSync(path.join(out, "planted"), { recursive: true });
    fs.writeFileSync(path.join(out, "planted", "requirements.md"), "# Feature: planted\n");
    fs.writeFileSync(path.join(out, "planted", ".state.json"), js({ lang: "en", approvals: { requirements: { at: "2026-01-01T00:00:00Z", by: "boss" } } }));
    S.createFeature(p, "Billing", ["core"], "Users can pay invoices");
    if (link(out, path.join(p, ".specs", "_archive"))) {
      const a = S.manageFeature(p, "archive", "billing");
      const r = S.manageFeature(p, "restore", "planted");
      ok(a.ok === false && a.linked === true && /\.specs\/_archive\/: that folder is a link/.test(a.error) && fs.existsSync(path.join(p, ".specs", "billing", "requirements.md")) &&
        js(fs.readdirSync(out)) === js(["planted"]) && r.ok === false && r.linked === true && !fs.existsSync(path.join(p, ".specs", "planted")) && !fs.existsSync(path.join(out, "planted", ".lock")),
        "1.24 r6 G1: archive into a linked .specs/_archive/ and restore out of it are refused — nothing moved either way, no lock created in the target (got " + js([a.error, r.error]) + ")");
    } else ok(true, "1.24 r6 G1 (_archive): links not creatable here — skipped");
    // an archived feature folder that is itself a link (.specs/_archive/<slug> -> outside) is never restored into .specs/
    const p2 = fresh("linked-archived-slug");
    const out2 = path.join(tmp, "r6-outside-archived-slug");
    fs.mkdirSync(out2, { recursive: true });
    fs.writeFileSync(path.join(out2, "requirements.md"), "# Feature: ghost\n");
    fs.mkdirSync(path.join(p2, ".specs", "_archive"), { recursive: true });
    if (link(out2, path.join(p2, ".specs", "_archive", "ghost"))) {
      const r2 = S.manageFeature(p2, "restore", "ghost");
      ok(r2.ok === false && r2.linked === true && /\.specs\/_archive\/ghost\//.test(r2.error) && !fs.existsSync(path.join(p2, ".specs", "ghost")) && js(fs.readdirSync(out2)) === js(["requirements.md"]),
        "1.24 r6 G1: restore refuses an archived folder that is a link (.specs/_archive/<slug> -> elsewhere) — never pulled into .specs/ (got " + js(r2.error) + ")");
    }
  }

  // 1.24 r6 G2: a committed FILE symlink inside a plain feature folder — the merge summary, a task brief, the spike summary and the
  // harness-observed log were written THROUGH it (fs.writeFileSync / appendFileSync follow links): spec text into whatever file the
  // link names. Refused now (linked, the file named), the target untouched; .specs/.gitignore linked is left alone (the lock lines
  // were appended to the file it points at); a ROADMAP.md that is a link is never written either.
  {
    const p = fresh("file-links");
    const c = S.createFeature(p, "Evil", ["core"], "Users can export a report");
    fs.writeFileSync(path.join(c.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. Do it\n  - _Requirements: US-1.AC-1_\n  - _Verify: npm test_\n");
    const victim = path.join(tmp, "r6-victim-hook.sh");
    fs.writeFileSync(victim, "#!/bin/sh\necho original\n");
    const ex = path.join(c.dir, ".execution");
    fs.mkdirSync(ex, { recursive: true });
    if (fileLink(victim, path.join(ex, "merge-summary.md")) && fileLink(victim + ".brief", path.join(ex, "task-1-brief.md")) && fileLink(victim + ".log", path.join(ex, "observed.jsonl"))) {
      const f = S.finishFeature(p, "evil", { write: true });
      const b = S.taskBrief(p, "evil", 1, { write: true });
      const o = S.observeRun(p, { command: "npm test", exitCode: 0 });
      ok(f.ok === false && f.linked === true && /Refused to write \.specs\/evil\/\.execution\/merge-summary\.md: that file is a link/.test(f.error) &&
        b.ok === false && /task-1-brief\.md: that file is a link/.test(b.error) && rd(victim) === "#!/bin/sh\necho original\n" && !fs.existsSync(victim + ".brief") &&
        js(o.recorded) === "[]" && !fs.existsSync(victim + ".log"),
        "1.24 r6 G2: finish --write, brief --write and the observed-run log refuse a file that is a symlink (the merge summary, the brief, observed.jsonl) — the file it names is untouched / never created (got " +
        js([f.error, b.error, o.recorded]) + ")");
      // a spike's merge summary takes the same path
      const sp = S.createFeature(p, "Probe", ["core"], undefined, undefined, undefined, "spike", { question: "Can we?" });
      fs.mkdirSync(path.join(sp.dir, ".execution"), { recursive: true });
      fileLink(victim, path.join(sp.dir, ".execution", "merge-summary.md"));
      const sf = S.finishFeature(p, "probe", { write: true });
      ok(sf.ok === false && /merge-summary\.md: that file is a link/.test(sf.error) && rd(victim) === "#!/bin/sh\necho original\n",
        "1.24 r6 G2: a spike's finish --write refuses a linked merge-summary.md too (got " + js(sf.error) + ")");
    } else ok(true, "1.24 r6 G2: file symlinks not creatable here — skipped");
    const p2 = fresh("gitignore-link");
    const target = path.join(tmp, "r6-some-config.txt");
    fs.writeFileSync(target, "user setting = 1\n");
    fs.rmSync(path.join(p2, ".specs", ".gitignore"));
    if (fileLink(target, path.join(p2, ".specs", ".gitignore"))) {
      const cr = S.createFeature(p2, "A", ["core"], "Users can a");
      ok(cr.ok && rd(target) === "user setting = 1\n" && fs.lstatSync(path.join(p2, ".specs", ".gitignore")).isSymbolicLink(),
        "1.24 r6 G2: a .specs/.gitignore that is a symlink is left alone — the lock lines are never appended to the file it points at (got " + js(rd(target)) + ")");
      const rmTarget = path.join(tmp, "r6-roadmap-target.md");
      fs.rmSync(path.join(p2, ".specs", "ROADMAP.md"), { force: true });
      fileLink(rmTarget, path.join(p2, ".specs", "ROADMAP.md"));
      const w = S.roadmapReport(p2, { write: true });
      ok(w.ok === false && w.linked === true && /ROADMAP\.md: that file is a link/.test(w.error) && !fs.existsSync(rmTarget) && fs.lstatSync(path.join(p2, ".specs", "ROADMAP.md")).isSymbolicLink(),
        "1.24 r6 G2: roadmap --write refuses a ROADMAP.md that is a symlink (nothing created where it points; the refresh after a mutation skips it) (got " + js(w.error) + ")");
    }
  }

  // 1.24 r6 G7: a path of the wrong kind answered a raw EEXIST / ENOTDIR / EISDIR (an exception on MCP, a stack on the CLI): a file
  // where .specs/, a feature folder or _archive/ go, a folder where ROADMAP.md or an export goes. Each is a localized refusal now
  // ({ ok: false, wrongKind: true, path }), in the project's language.
  {
    const p = fresh("kinds");
    fs.writeFileSync(path.join(p, ".specs", "notes"), "my notes\n");
    const c1 = S.createFeature(p, "notes", ["core"], "Users can take notes");
    const p2 = path.join(tmp, "proj-r6-specs-file");
    fs.mkdirSync(p2, { recursive: true });
    fs.writeFileSync(path.join(p2, ".specs"), "not a folder\n");
    const i2 = S.initProject(p2, ["core"]);
    const c2 = S.createFeature(p2, "a", ["core"], "Users can a");
    const p3 = fresh("archive-file");
    S.createFeature(p3, "B", ["core"], "Users can b");
    fs.writeFileSync(path.join(p3, ".specs", "_archive"), "file\n");
    const a3 = S.manageFeature(p3, "archive", "b");
    const p4 = fresh("roadmap-dir");
    S.createFeature(p4, "C", ["core"], "Users can c");
    fs.rmSync(path.join(p4, ".specs", "ROADMAP.md"));
    fs.mkdirSync(path.join(p4, ".specs", "ROADMAP.md"));
    const r4 = S.roadmapReport(p4, { write: true });
    const after = S.createFeature(p4, "D", ["core"], "Users can d"); // the best-effort refresh never fails a mutation
    fs.mkdirSync(path.join(p4, ".specs", "exports", "project.html"), { recursive: true });
    const e4 = S.exportSpecs(p4, { write: true });
    const kind = (r) => r.ok === false && r.wrongKind === true;
    ok(kind(c1) && /^\.specs\/notes is a file where dev-spec needs a folder/.test(c1.error) && kind(i2) && /^\.specs is a file where dev-spec needs a folder/.test(i2.error) &&
      kind(c2) && kind(a3) && /^\.specs\/_archive is a file/.test(a3.error) && fs.existsSync(path.join(p3, ".specs", "b", "requirements.md")) &&
      kind(r4) && /^\.specs\/ROADMAP\.md is a folder where dev-spec writes a file/.test(r4.error) && after.ok && kind(e4) && /exports\/project\.html is a folder/.test(e4.error),
      "1.24 r6 G7: a file where .specs/, a feature folder or _archive/ go, a folder where ROADMAP.md or an export goes — each a localized refusal (wrongKind), never a raw EEXIST / ENOTDIR / EISDIR; the archive moved nothing (got " +
      js([c1.error, i2.error, c2.error, a3.error, r4.error, e4.error]) + ")");
    const pp = fresh("kinds-pt", "pt");
    fs.writeFileSync(path.join(pp, ".specs", "notas"), "x\n");
    const cp = S.createFeature(pp, "notas", ["core"], "Os utilizadores tiram notas");
    const mcp = await rpc("tools/call", { name: "spec_create", arguments: { name: "notes", projectDir: p, summary: "Users can take notes" } });
    const cli = spawnSync(process.execPath, [CLI, "create", "notes", "--project", p], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: p } });
    ok(kind(cp) && /^\.specs\/notas é um ficheiro onde o dev-spec precisa de uma pasta/.test(cp.error) && mcp.result.isError === true && /is a file where dev-spec needs a folder/.test(js(payload(mcp))) &&
      cli.status === 1 && /is a file where dev-spec needs a folder/.test(cli.stderr) && !/EEXIST|at Object\./.test(cli.stderr),
      "1.24 r6 G7: the refusal in the project's language (PT), on MCP (isError) and the CLI (exit 1, one line, no stack) (got " + js([cp.error, cli.status, cli.stderr.slice(0, 160)]) + ")");
  }

  // 1.24 r6 G3: archiving a feature finished this week wiped the project velocity — the roadmap and spec_metrics counted the active
  // folders alone, so every other feature's ETA turned "not enough data". The archived features' completions count too.
  {
    const p = fresh("velocity");
    S.createFeature(p, "Shipped", ["core"], "Users can export a report");
    S.createFeature(p, "Next", ["core"], "Users can import a report");
    const now = Date.now();
    const iso = (d) => new Date(now - d * 86400000).toISOString();
    const sd = path.join(p, ".specs", "shipped");
    fs.writeFileSync(path.join(sd, "tasks.md"), "# Tasks\n\n" + [1, 2, 3, 4, 5].map((n) => `- [x] ${n}. Step ${n}\n  - _Size: M_\n`).join(""));
    const st = JSON.parse(rd(sd, ".state.json"));
    st.ticks = { 1: iso(6), 2: iso(5), 3: iso(4), 4: iso(2), 5: iso(1) };
    fs.writeFileSync(path.join(sd, ".state.json"), JSON.stringify(st, null, 2));
    fs.writeFileSync(path.join(p, ".specs", "next", "tasks.md"), "# Tasks\n\n" + [1, 2, 3, 4].map((n) => `- [ ] ${n}. Step ${n}\n  - _Size: M_\n`).join(""));
    const view = () => { const r = S.roadmapReport(p, {}); const rm = r.roadmap || r; return { v: rm.velocity, next: (rm.features.find((f) => f.name === "next") || {}).forecast, m: S.metrics(p, null, {}).velocity }; };
    const before = view();
    const a = S.manageFeature(p, "archive", "shipped");
    const after = view();
    const fixed = S.metrics(p, null, { now: new Date(now).toISOString() }).velocity; // opts.now: every archived folder read
    ok(a.ok && before.v.completed === 5 && after.v.completed === 5 && after.v.enough === true && after.v.pointsPerDay === before.v.pointsPerDay &&
      after.next && after.next.eta === before.next.eta && after.m.completed === 5 && fixed.completed === 5,
      "1.24 r6 G3: the project velocity (spec_roadmap, ROADMAP.md, spec_metrics) keeps an archived feature's completions — the other features' ETAs survive the archive (got " +
      js({ before: [before.v.completed, before.next && before.next.eta], after: [after.v.completed, after.v.enough, after.next && (after.next.eta || after.next.reason)], metrics: after.m.completed }) + ")");
  }

  // 1.24 r6 G4: a feature NAME holding "<!--" opened an HTML comment in every title it reached (# Feature: Login <!-- v2 …): the
  // scaffold's criteria were hidden (trace 0 ACs) — the summary was made inert in 1.22, the name not. "<!--" / "-->" in a name are
  // written as &lt;!-- / --&gt; wherever the name lands (titles, {{name}}; create, add_track, an import's given name); the slug
  // is the name's, as before.
  {
    const p = fresh("name-comment");
    const c = S.createFeature(p, "Login <!-- v2", ["core"], "Users can log in with email");
    const plain = S.createFeature(p, "Login plain", ["core"], "Users can log in with email");
    const d = S.createFeature(p, "Logout --> v3", ["core"], "Users can log out");
    const at = S.addTrack(p, c.slug, "sec");
    const imp = S.importSpec(p, "plan", null, { text: "# Plan\n\n## Steps\n1. Do `src/a.js`\n\n## Acceptance\n- WHEN a user logs in THE SYSTEM SHALL show the dashboard\n", name: "Import <!-- x" });
    const heads = (dir) => ["requirements.md", "design.md", "tasks.md"].map((f) => rd(dir, f).split("\n")[0]);
    const acs = (s) => S.traceCheck(p, s).totalAcs;
    ok(c.ok && c.slug === "login-v2" && acs(c.slug) === acs(plain.slug) && acs(c.slug) > 0 && heads(c.dir).every((h) => /: Login &lt;!-- v2$/.test(h)) &&
      d.ok && d.slug === "logout-v3" && heads(d.dir).every((h) => /: Logout --&gt; v3$/.test(h)) && at.ok && !/<!--/.test(rd(c.dir, "design.md").split("\n")[0]) &&
      imp.ok && imp.feature === "import-x" && heads(path.join(p, ".specs", "import-x")).every((h) => /: Import &lt;!-- x$/.test(h)) && acs("import-x") === 1,
      "1.24 r6 G4: '<!--' / '-->' in a feature name are written inert in every title (create, add_track, an import's given name) — the criteria stay visible (trace counts them), the slug is the name's (got " +
      js([c.slug, acs(c.slug), acs(plain.slug), heads(c.dir), heads(d.dir), imp.feature]) + ")");
  }

  // 1.24 r6 G5: rename onto a backlog item's name kept the backlog item — ROADMAP.md listed the feature under Features AND under
  // Backlog (create and restore already drop it: pruneBacklog). Rename drops it too and says so (removedFromBacklog).
  {
    const p = fresh("rename-backlog");
    S.createFeature(p, "login", ["core"], "Users can log in");
    const b = S.backlog(p, "add", "Single sign on", "later");
    const rn = S.renameFeature(p, "login", "Single sign on");
    ok(b.ok && rn.ok && rn.to === "single-sign-on" && js(rn.removedFromBacklog) === js(["Single sign on"]) && js(S.readRoadmap(p).backlog) === "[]" &&
      !/\*\*Single sign on\*\*/.test(rd(p, ".specs", "ROADMAP.md")),
      "1.24 r6 G5: renaming a feature onto a backlog item's name drops that item (removedFromBacklog) — never listed twice in ROADMAP.md (got " + js([rn.removedFromBacklog, S.readRoadmap(p).backlog]) + ")");
  }

  // 1.24 r6 G6: only the FIRST dependency cycle was reported (findCycle) — a → a hid b ↔ c — and a member of a cycle the forecast walk
  // met second was overwritten with reason "dependency". Every cycle is reported now (the strongly connected components: roadmap
  // `cycles`, one ROADMAP.md / .html line each, `cycle` = the first), and each member's forecast reason is "cycle".
  {
    const p = fresh("cycles");
    for (const n of ["a", "b", "c", "d", "e", "f"]) S.createFeature(p, n, ["core"], "Users can do " + n);
    for (const n of ["a", "b", "c", "d", "e", "f"]) fs.writeFileSync(path.join(p, ".specs", n, "tasks.md"), "# Tasks\n\n- [ ] 1. Step\n  - _Size: M_\n");
    const rmf = path.join(p, ".specs", "roadmap.json");
    const rm = JSON.parse(rd(rmf));
    const deps = { a: ["a"], b: ["c"], c: ["b"], d: ["e"], e: ["f"], f: ["d"] };
    for (const [k, v] of Object.entries(deps)) rm.features[k] = { ...(rm.features[k] || {}), dependsOn: v };
    fs.writeFileSync(rmf, JSON.stringify(rm, null, 2));
    // three completions so the project has a velocity (a forecast reason other than not-enough-data must come from the graph)
    const g = S.createFeature(p, "Go", ["core"], "Users can go");
    const now = Date.now();
    fs.writeFileSync(path.join(g.dir, "tasks.md"), "# Tasks\n\n" + [1, 2, 3].map((n) => `- [x] ${n}. Step ${n}\n`).join("") + "- [ ] 4. Left\n");
    const gs = JSON.parse(rd(g.dir, ".state.json"));
    gs.ticks = { 1: new Date(now - 3 * 864e5).toISOString(), 2: new Date(now - 2 * 864e5).toISOString(), 3: new Date(now - 864e5).toISOString() };
    fs.writeFileSync(path.join(g.dir, ".state.json"), JSON.stringify(gs, null, 2));
    const r = S.roadmapReport(p, { write: true });
    const view = r.roadmap || r;
    const md = rd(p, ".specs", "ROADMAP.md");
    const reasons = Object.fromEntries(view.features.map((f) => [f.name, f.forecast && f.forecast.reason]));
    const lines = md.split("\n").filter((l) => /Circular dependency/.test(l));
    const sets = (view.cycles || []).map((c) => [...new Set(c)].sort().join(","));
    ok(r.ok && js(sets.slice().sort()) === js(["a", "b,c", "d,e,f"]) && js(view.cycle) === js(view.cycles[0]) && view.cycles.every((c) => c[0] === c[c.length - 1]) &&
      lines.length === 3 && ["a", "b", "c", "d", "e", "f"].every((n) => reasons[n] === "cycle") && /a → a/.test(md) && /Circular dependency/.test(rd(p, ".specs", "ROADMAP.md")),
      "1.24 r6 G6: every dependency cycle is reported (a → a, b ↔ c, d → e → f → d: roadmap `cycles`, one ROADMAP.md line each) and every member's forecast reason is 'cycle' (got " +
      js({ cycles: view.cycles, lines, reasons }) + ")");
    // G-I6: a dependency whose tasks are all ticked (no execution sign-off yet) is complete — 100%, met: its dependents get an ETA
    const p2 = fresh("signoff-dep");
    S.createFeature(p2, "A", ["core"], "Users can a");
    S.createFeature(p2, "B", ["core"], "Users can b");
    fs.writeFileSync(path.join(p2, ".specs", "a", "tasks.md"), "# Tasks\n\n" + [1, 2, 3, 4].map((n) => `- [x] ${n}. Step ${n}\n`).join(""));
    const as = JSON.parse(rd(p2, ".specs", "a", ".state.json"));
    as.ticks = { 1: new Date(now - 4 * 864e5).toISOString(), 2: new Date(now - 3 * 864e5).toISOString(), 3: new Date(now - 2 * 864e5).toISOString(), 4: new Date(now - 864e5).toISOString() };
    fs.writeFileSync(path.join(p2, ".specs", "a", ".state.json"), JSON.stringify(as, null, 2));
    fs.writeFileSync(path.join(p2, ".specs", "b", "tasks.md"), "# Tasks\n\n- [ ] 1. Step\n- [ ] 2. Step\n");
    S.setDependency(p2, "b", ["a"]);
    const v2 = S.roadmapReport(p2, {});
    const fb = ((v2.roadmap || v2).features.find((f) => f.name === "b") || {});
    ok(!S.readState(p2, "a").approvals.execution && !fb.blocked && fb.forecast && /^\d{4}-\d{2}-\d{2}$/.test(fb.forecast.eta || ""),
      "1.24 r6 G-I6: a dependency whose every task is ticked but whose execution is not signed off is complete (100%) — its dependent is not blocked and gets an ETA (got " + js(fb.forecast) + ")");
  }
};
