"use strict";
// Lifecycle — the read gate's ROOT (1.41.1): the project's own .specs/ (gateRootOf), never a folder merely named .specs — a link named .specs below it, a project below a folder named .specs, a .SPECS spelling, a monorepo's nested projects —; the readers outside the primitives (historyText, the MCP server's approval meta, coverage / trace existence, outside-code templates, the importers' warnings), the names a linked folder holds (drift, a milestone, the backlog), the listing's seed (seedParts) and its counts, and the doctor / importer / stub branches no other fixture reaches.
// (12-lifecycle-read-gate.js holds the gate itself: the maze, THE property over every operation, Addition A, R3.)

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

exports.run = async ({ ok, all, eq, S, tmp, fsCalls, require, __dirname }) => {
  const js = JSON.stringify;
  const E = require("./lib/engine/index.js");
  const { OPERATIONS } = require("./lib/operations.js");
  const WIN = process.platform === "win32";
  const FOLD = WIN || process.platform === "darwin";
  const fold = (s) => (FOLD ? String(s).toLowerCase() : String(s));
  const link = (target, at) => { try { fs.mkdirSync(path.dirname(at), { recursive: true }); fs.symlinkSync(target, at, "junction"); return true; } catch { return false; } };
  const fileLink = (target, at) => { try { fs.mkdirSync(path.dirname(at), { recursive: true }); fs.symlinkSync(target, at, "file"); return true; } catch { return false; } };
  const put = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
  const OUT = "OUTSIDE-";
  const has = (v) => js(v === undefined ? null : v).includes(OUT);
  const REQ = "# Feature: Feat\n\n## Summary\nA thing.\n\n### US-1 Save (P1)\n\n#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN a user saves an item THE SYSTEM SHALL store it\n";
  const TASKS = "# Tasks\n\n- [x] 1. [US1] Do it for US-1.AC-1\n  - _Requirements: US-1.AC-1_\n  - _Verify: node -v_\n";
  const project = (name, tracks = ["core"], opts = {}) => {
    const p = path.join(tmp, "rgr-" + name);
    fs.mkdirSync(p, { recursive: true });
    S.initProject(p, tracks, "en", opts);
    return p;
  };
  // every fs.*Sync call fn makes on a path whose REAL location lies in `outside` (a read, a stat, an existence probe through a link)
  const throughLinks = (outside, fn) => {
    const outReal = fold(fs.realpathSync.native(outside));
    const rp = fs.realpathSync.native;
    const hits = [], saved = [];
    let inside = false;
    for (const k of ["readFileSync", "openSync", "statSync", "existsSync", "readdirSync", "opendirSync"]) {
      const orig = fs[k];
      saved.push([k, orig]);
      fs[k] = function (q, ...rest) {
        if (!inside && typeof q === "string") {
          inside = true;
          try { let r = null; try { r = rp(q); } catch { r = null; } if (r && fold(r).startsWith(outReal)) hits.push(k + " " + q); } finally { inside = false; }
        }
        return orig.call(this, q, ...rest);
      };
    }
    let v;
    try { v = fn(); } finally { for (const [k, o] of saved) fs[k] = o; }
    return { v, hits };
  };

  // ---------------------------------------------------------------------------------------------------------------------------
  // THE root: the project's .specs/ — a deeper part named .specs is an ordinary part (A-1); historyText takes .history/<name> only
  // ---------------------------------------------------------------------------------------------------------------------------
  {
    const p = project("nested"), out = path.join(tmp, "rgr-nested-out");
    put(path.join(out, "requirements.md"), "# Feature: Other\n\n### US-1 Save (P1)\n\n#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN OUTSIDE-AC THE SYSTEM SHALL OUTSIDE-SHALL\n");
    const f = S.createFeature(p, { name: "feat", tracks: ["core"] });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
    S.approvePhase(p, "feat", "requirements", "t", { force: true, reason: "r" });
    if (link(out, path.join(f.dir, ".history", ".specs"))) {
      const target = path.join(f.dir, ".history", ".specs", "requirements.md");
      const scoped = E.withReadCache(() => { E.specsRoot(p); return [E.specsReadBlocked(target), E.readIfExists(target), E.existsRaw(target), E.isDirSafe(path.dirname(target))]; });
      const bare = E.withReadCache(() => [E.specsReadBlocked(target), E.readIfExists(target)]); // no project recorded: the outermost .specs
      // the snapshot route (spec_impact): an approval record naming the file behind it
      const sp = path.join(f.dir, ".state.json");
      const st = JSON.parse(fs.readFileSync(sp, "utf8"));
      st.approvalHistory.filter((h) => h.phase === "requirements").pop().snapshot = ".history/.specs/requirements.md";
      fs.writeFileSync(sp, js(st, null, 2));
      fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ.replace("store it", "keep it"));
      const imp = S.impactReport(p, "feat", {});
      const c = (S.specDoctor(p, "feat").checks || []).find((x) => x.id === "specs-links");
      all("1.41.1 fix round 1 (A-1): a link NAMED .specs below the project's .specs/ is an ordinary part — blocked and absent, with the call's project recorded and without; spec_impact's snapshot route reads nothing through it; doctor specs-links names it (got " + js({ scoped, bare, imp: js(imp).slice(0, 160), c }) + ")", {
        scoped: () => js(scoped) === js([true, null, false, false]), bare: () => bare[0] === true && bare[1] === null,
        impact: () => !has(imp), named: () => !!c && c.detail.includes(".specs/feat/.history/.specs"),
      });
    } else ok(true, "1.41.1 fix round 1 (A-1): links not creatable here — skipped");
    // historyText: `.history/<one file name>` as TEXT, before any read — a subfolder, `..`, a padded or absolute name is none
    put(path.join(f.dir, ".history", "sub", "x.md"), "# sub\n");
    put(path.join(f.dir, ".history", "x.md"), "# x\n");
    const ht = E.withReadCache(() => [".history/x.md", ".history\\x.md", ".history/sub/x.md", ".history/sub", ".history/..", ".history/.", ".history/ x.md", "../feat/.history/x.md",
      ".HISTORY/x.md", path.join(f.dir, ".history", "x.md"), ".history/", 7].map((r) => E.historyText(f.dir, r)));
    eq(ht, ["# x\n", "# x\n", null, null, null, null, null, null, null, null, null, null],
      "1.41.1 fix round 1 (A-1): historyText reads `.history/<one file name>` only — a subfolder, `..` / `.`, a padded name, a path out and back, another spelling, an absolute path or no string read nothing");
  }

  // B-1: a project that sits below a folder NAMED .specs — every read operation of the table answers as the same project elsewhere does,
  // with the same fs calls on its code (an in-project code junction included): its code is never gated, only its own .specs/ is
  {
    const mk = (base) => {
      const p = path.join(base, "app");
      fs.mkdirSync(p, { recursive: true });
      S.initProject(p, ["tdd"], "en");
      const f = S.createFeature(p, { name: "feat", tracks: ["tdd"] });
      put(path.join(p, "src", "real", "a.js"), "module.exports = 1; // US-1.AC-1\n");
      put(path.join(p, "tests", "a.test.js"), "// T-01 US-1.AC-1\ntest('x', () => {});\n");
      fs.writeFileSync(path.join(f.dir, "tasks.md"), TASKS.replace("  - _Verify", "  - _Implements: src/alias/a.js_\n  - _Verify"));
      fs.writeFileSync(path.join(f.dir, "test-plan.md"), "# Test Plan: feat\n\n## Traceability Matrix\n\n| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---|---|---|---|---|---|\n| T-01 | unit | example | it | US-1.AC-1 | `tests/a.test.js` |\n");
      return { p, j: link(path.join(p, "src", "real"), path.join(p, "src", "alias")) };
    };
    const A = mk(path.join(tmp, "rgr-b1", "plain")), B = mk(path.join(tmp, "rgr-b1", ".specs"));
    if (A.j && B.j) {
      const codeCalls = (p, fn) => {
        const pre = fold(p + path.sep), specs = fold(path.join(p, ".specs") + path.sep);
        const c = {}, saved = [];
        const spy = (orig, name) => function (q, ...rest) { if (typeof q === "string") { const a = fold(path.resolve(q)); if (a.startsWith(pre) && !a.startsWith(specs)) c[name] = (c[name] || 0) + 1; } return orig.call(this, q, ...rest); };
        for (const key of Object.keys(fs)) { const o = fs[key]; if (!/Sync$/.test(key) || typeof o !== "function") continue; const w = spy(o, key); if (typeof o.native === "function") w.native = spy(o.native, key + ".native"); saved.push([key, o]); fs[key] = w; }
        let v;
        try { v = fn(); } catch (e) { v = { threw: e.message }; } finally { for (const [k, o] of saved) fs[k] = o; }
        return { v, c };
      };
      const norm = (v, p) => js(v === undefined ? null : v).split(js(p).slice(1, -1)).join("<P>").split(p).join("<P>").split(fold(p)).join("<P>")
        .replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, "<T>").replace(/"fingerprint":"[0-9a-f]+"/g, "\"fingerprint\":\"<F>\"");
      const G = { name: "feat", number: 1, includeBody: true, includeBrief: true, code: true, matrix: true, waves: true, max: 3, phase: "requirements", lang: "en",
        text: "WHEN a user saves an item THE SYSTEM SHALL store it", description: "users save items", since: "all", cap: 100, minLines: 8, tests: true,
        message: "All tasks are done and verified.", file: path.join("src", "alias", "a.js") };
      const OWN = { backlog: [{ action: "list" }], milestone: [{ action: "list" }], templates: [{ action: "list" }], tracks: [{ action: "list" }], signals: [{ op: "list" }],
        export: [{ format: "md" }, { format: "csv" }], changelog: [{ since: "all" }], feature: [{ action: "remove" }], classify: [{}],
        import: [{ tool: "plan", text: "# Plan: OK\n\n## Steps\n1. do `src/alias/a.js`\n", dryRun: true }], steering: [{ file: "x.md", dryRun: true }] };
      const WRITES = new Set(["init", "create", "approve", "complete", "append", "decide", "clarify", "revoke", "undo", "signoff", "add-track", "upgrade", "depend"]);
      const diffs = [];
      let driven = 0;
      const one = (label, fa, fb) => {
        const ra = codeCalls(A.p, fa), rb = codeCalls(B.p, fb);
        driven++;
        if (norm(ra.v, A.p) !== norm(rb.v, B.p) || js(ra.c) !== js(rb.c)) diffs.push(label + " " + js([ra.c, rb.c]) + (norm(ra.v, A.p) === norm(rb.v, B.p) ? "" : " result: " + norm(rb.v, B.p).slice(0, 160)));
      };
      for (const op of OPERATIONS) {
        if (WRITES.has(op.id)) continue;
        for (const extra of OWN[op.id] || [{}]) {
          const o = {};
          for (const k of Object.keys(op.args || {})) if (G[k] !== undefined) o[k] = G[k];
          Object.assign(o, extra);
          one(op.id + js(extra), () => op.call(S, A.p, o), () => op.call(S, B.p, o));
        }
      }
      one("guardCheck", () => E.withReadCache(() => E.guardCheck(A.p, path.join(A.p, "src", "alias", "a.js"))), () => E.withReadCache(() => E.guardCheck(B.p, path.join(B.p, "src", "alias", "a.js"))));
      ok(driven > 30 && !diffs.length, "1.41.1 fix round 1 (B-1): a project below a folder NAMED .specs (~/.specs/work/app) reads as the same project elsewhere — every read operation of the table and the scope guard (" + driven + "), its results and its fs calls on its code equal, an in-project code junction read as ever: only its own .specs/ is gated (got " + js(diffs.slice(0, 6)) + ")");
    } else ok(true, "1.41.1 fix round 1 (B-1): links not creatable here — skipped");
  }

  // A-2: the project's .specs/ by another spelling (.SPECS on a case-folding volume; its 8.3 alias on Windows) is the same root — gated
  {
    const p = project("case"), out = path.join(tmp, "rgr-case-out");
    put(path.join(out, "tasks.md"), "# Tasks\n\n- [ ] 1. OUTSIDE-CASE\n");
    S.createFeature(p, { name: "plain" });
    if (link(out, path.join(p, ".specs", "lnk"))) {
      if (FOLD) {
        const t = path.join(p, ".SPECS", "lnk", "tasks.md");
        const r = E.withReadCache(() => { E.specsRoot(p); return [E.specsReadBlocked(t), E.readIfExists(t), E.existsRaw(t), E.specsReadBlocked(path.join(p, ".Specs", "lnk"))]; });
        eq(r, [true, null, false, true], "1.41.1 fix round 1 (A-2): on a case-folding volume `.SPECS/lnk/tasks.md` IS the project's .specs/lnk/tasks.md — the gate stands on it (blocked, absent), any spelling");
      } else ok(true, "1.41.1 fix round 1 (A-2): a case-sensitive volume — `.SPECS` is another folder");
      let short = null;
      if (WIN) {
        try {
          const kid = require("child_process").spawnSync("cmd", ["/c", "dir", "/x", "/a", p], { encoding: "utf8" });
          const m = /\s(\S*~\d\S*)\s+\.specs\s*$/m.exec(String(kid.stdout || ""));
          short = m ? m[1] : null;
        } catch { short = null; }
      }
      if (short) {
        const t = path.join(p, short, "lnk", "tasks.md");
        const r = E.withReadCache(() => { E.specsRoot(p); return [E.specsReadBlocked(t), E.readIfExists(t)]; });
        eq(r, [true, null], "1.41.1 fix round 1 (A-2): the 8.3 alias of .specs (" + short + ") is the root by its REAL path — `" + short + "/lnk/tasks.md` is blocked");
      } else ok(true, "1.41.1 fix round 1 (A-2): no 8.3 alias of .specs here — skipped");
    } else ok(true, "1.41.1 fix round 1 (A-2): links not creatable here — skipped");
  }

  // a monorepo: each project stands on its own .specs/ (the outer call reaching an inner project's spec, the inner call, the code between)
  {
    const outer = project("mono"), inner = path.join(outer, "packages", "app"), out = path.join(tmp, "rgr-mono-out");
    fs.mkdirSync(inner, { recursive: true });
    S.initProject(inner, ["core"], "en");
    put(path.join(out, "tasks.md"), "# Tasks\n\n- [ ] 1. OUTSIDE-MONO\n");
    put(path.join(inner, "src", "real", "x.js"), "x\n");
    if (link(out, path.join(inner, ".specs", "lnk")) && link(out, path.join(outer, ".specs", "olnk")) && link(path.join(inner, "src", "real"), path.join(inner, "src", "alias"))) {
      const it = path.join(inner, ".specs", "lnk", "tasks.md"), ot = path.join(outer, ".specs", "olnk", "tasks.md"), code = path.join(inner, "src", "alias", "x.js");
      const fromOuter = E.withReadCache(() => { E.specsRoot(outer); return [E.specsReadBlocked(it), E.specsReadBlocked(ot), E.readIfExists(code)]; });
      const fromInner = E.withReadCache(() => { E.specsRoot(inner); return [E.specsReadBlocked(it), E.readIfExists(code)]; });
      const calls = fsCalls(path.join(inner, "src") + path.sep, () => E.withReadCache(() => { E.specsRoot(outer); return E.readIfExists(code); }));
      const st = [S.statusFeature(inner, "lnk"), S.statusFeature(outer, "olnk")];
      all("1.41.1 fix round 1: a monorepo's nested projects each stand on their own .specs/ — a link below the inner one is refused from the outer call and the inner, the code between is never gated (one read, no lstat / realpath), and each answers feature-linked (got " + js({ fromOuter, fromInner, calls, st: st.map((r) => r.code) }) + ")", {
        outer: () => js(fromOuter) === js([true, true, "x\n"]), inner: () => js(fromInner) === js([true, "x\n"]),
        codeUngated: () => !calls.lstatSync && !calls["realpathSync.native"], linked: () => st.every((r) => r.ok === false && r.code === "feature-linked"),
      });
    } else ok(true, "1.41.1 fix round 1 (monorepo): links not creatable here — skipped");
  }

  // .specs ITSELF a link: still the root (exempt) — and a feature folder that is a link inside it is still refused
  {
    const base = path.join(tmp, "rgr-specs-link");
    const real = path.join(base, "real"), shared = path.join(base, "shared"), lp = path.join(base, "linked"), out = path.join(base, "out");
    fs.mkdirSync(real, { recursive: true }); fs.mkdirSync(lp, { recursive: true });
    put(path.join(out, "tasks.md"), "# Tasks\n\n- [ ] 1. OUTSIDE-ROOTLINK\n");
    S.initProject(real, ["core"], "en");
    const f = S.createFeature(real, { name: "login" });
    fs.writeFileSync(path.join(f.dir, "tasks.md"), TASKS);
    fs.cpSync(path.join(real, ".specs"), shared, { recursive: true });
    if (link(shared, path.join(lp, ".specs")) && link(out, path.join(shared, "lnk"))) {
      // the listing seeds the feature folders' real paths from the REAL .specs/ (the link's target), never the link's own path
      const seeded = E.withReadCache(() => { E.specsRoot(lp); E.featureDirs(lp); E.safeReaddir(path.join(lp, ".specs")); return [E.readIfExists(path.join(lp, ".specs", "login", "tasks.md")), E.readIfExists(path.join(lp, ".specs", "lnk", "tasks.md"))]; });
      const st = [S.statusFeature(lp, "login"), S.statusFeature(lp, "lnk")];
      all("1.41.1 fix round 1: .specs ITSELF a link stays the root — its features read as ever (after a listing of it too: the seed takes the real .specs/), a feature folder that is a link inside it is still refused (got " + js({ seeded, st: st.map((r) => r.ok + ":" + (r.code || "")) }) + ")", {
        read: () => seeded[0] === TASKS && st[0].ok === true, refused: () => seeded[1] === null && st[1].code === "feature-linked" && !has(st[1]),
      });
    } else ok(true, "1.41.1 fix round 1 (.specs a link): links not creatable here — skipped");
  }

  // ---------------------------------------------------------------------------------------------------------------------------
  // the listing's seed (seedParts): what a listing proved is not asked again — never a link, never over an lstat, a file is no folder
  // ---------------------------------------------------------------------------------------------------------------------------
  {
    const p = project("seed"), out = path.join(tmp, "rgr-seed-out");
    put(path.join(out, "tasks.md"), "# Tasks\n\n- [ ] 1. OUTSIDE-SEED\n");
    const f = S.createFeature(p, { name: "plain" });
    fs.writeFileSync(path.join(f.dir, "tasks.md"), TASKS);
    const root = path.join(p, ".specs");
    if (link(out, path.join(root, "lnk"))) {
      const lt = path.join(root, "lnk", "tasks.md"), pt = path.join(f.dir, "tasks.md");
      const listed = E.withReadCache(() => { E.specsRoot(p); E.featureDirs(p); E.readDirCached(root); E.safeReaddir(root); E.readDirCached(f.dir); E.safeReaddir(f.dir);
        return [E.readIfExists(lt), E.existsRaw(lt), E.isDirSafe(path.join(root, "lnk")), E.readIfExists(pt), E.isDirSafe(f.dir), E.isDirSafe(pt), E.existsRaw(pt)]; });
      // an lstat that refused a part (EACCES) stays refused after a listing names it plain
      const ls = fs.lstatSync, key = fold(path.resolve(f.dir));
      fs.lstatSync = function (q) { if (fold(path.resolve(String(q))) === key) throw Object.assign(new Error("EACCES"), { code: "EACCES" }); return ls.apply(this, arguments); };
      let kept;
      try { kept = E.withReadCache(() => { E.specsRoot(p); const a = E.readIfExists(pt); E.featureDirs(p); E.safeReaddir(root); E.readDirCached(root); return [a, E.readIfExists(pt), E.isDirSafe(f.dir)]; }); } finally { fs.lstatSync = ls; }
      all("1.41.1 fix round 1 (seedParts): after every listing of .specs/ and of a feature folder in one scope, a linked feature folder still reads as absent (a link's Dirent seeds nothing), a plain feature reads as ever, a file is no folder; a part an lstat refused stays refused after a listing names it plain (got " + js({ listed, kept }) + ")", {
        link: () => listed[0] === null && listed[1] === false && listed[2] === false, plain: () => listed[3] === TASKS && listed[4] === true,
        file: () => listed[5] === false && listed[6] === true, lstatWins: () => js(kept) === js([null, null, false]),
      });
    } else ok(true, "1.41.1 fix round 1 (seedParts): links not creatable here — skipped");
    // the counts: a project-wide drift (the SessionStart check) pays one lstat per feature (its .state.json) and no realpath per feature
    const mk = (n) => {
      const q = path.join(tmp, "rgr-drift-" + n);
      fs.mkdirSync(q, { recursive: true });
      S.initProject(q, ["core"], "en");
      for (let i = 1; i <= n; i++) S.createFeature(q, { name: "f" + i });
      return q;
    };
    const d = [2, 3, 4].map((n) => { const q = mk(n); return fsCalls(path.join(q, ".specs") + path.sep, () => S.drift(q)); });
    const k = (r, x) => r[x] || 0;
    all("1.41.1 fix round 1 (B-5): a project-wide drift's gate calls grow by ONE lstat per feature (its .state.json — the listing proved the folder) and no realpath at all: 2 → 3 → 4 features (got " + js(d) + ")", {
      lstat: () => k(d[1], "lstatSync") - k(d[0], "lstatSync") === 1 && k(d[2], "lstatSync") - k(d[1], "lstatSync") === 1,
      realpath: () => !k(d[0], "realpathSync.native") && !k(d[2], "realpathSync.native"),
    });
  }

  // ---------------------------------------------------------------------------------------------------------------------------
  // the readers outside the primitives (A-3 … A-6): no answer depends on a link's target
  // ---------------------------------------------------------------------------------------------------------------------------
  // A-4: coverage's archived list and onDisk, trace's missingImplFiles — the same answers whether a link's OUTSIDE target exists or not
  {
    const run = (exists) => {
      const base = path.join(tmp, "rgr-exist-" + (exists ? "e" : "m"));
      const p = path.join(base, "proj"), out = path.join(base, "out");
      if (exists) { fs.mkdirSync(path.join(out, "dir"), { recursive: true }); put(path.join(out, "file.js"), "x"); }
      fs.mkdirSync(p, { recursive: true });
      S.initProject(p, ["core"], "en");
      const f = S.createFeature(p, { name: "feat" });
      fs.writeFileSync(path.join(f.dir, "tasks.md"), TASKS.replace("  - _Verify", "  - _Implements: .specs/feat/lnk/file.js_\n  - _Verify"));
      if (!link(out, path.join(f.dir, "lnk")) || !link(path.join(out, "dir"), path.join(p, ".specs", "_archive", "ghost"))) return null;
      const norm = (r) => js(r).split(js(p).slice(1, -1)).join("<P>").split(p).join("<P>").replace(/"(at|generatedAt|date)":"[^"]*"/g, "");
      const tr = S.traceCheck(p, "feat");
      return [norm(S.coverage(p)), norm({ missingImplFiles: tr.missingImplFiles, plannedImplFiles: tr.plannedImplFiles, implementsFiles: tr.implementsFiles })];
    };
    const e = run(true), m = run(false);
    if (e && m) ok(e[0] === m[0] && e[1] === m[1] && !/ghost/.test(e[0]), "1.41.1 fix round 1 (A-4): coverage (its archived features, a path on disk) and trace's missing _Implements:_ files answer the same whether a link's outside target exists or not — an `_archive/<slug> ->` is no archived feature (got " + js({ e: e.map((x) => x.slice(0, 200)), m: m.map((x) => x.slice(0, 200)) }) + ")");
    else ok(true, "1.41.1 fix round 1 (A-4): links not creatable here — skipped");
  }
  // A-5: doctor's outside-code-artifacts never stats or reads a plan's file through a project-level link out (projectFileReal)
  {
    const p = project("otpl", ["tdd"]), out = path.join(tmp, "rgr-otpl-out");
    put(path.join(out, "plan.md"), "# OUTSIDE plan\n");
    const f = S.createFeature(p, { name: "feat", tracks: ["tdd"] });
    if (link(out, path.join(p, "docs", "lnk"))) {
      fs.writeFileSync(path.join(f.dir, "test-plan.md"), "# Test Plan: feat\n\n## Traceability Matrix\n\n| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---|---|---|---|---|---|\n| T-01 | e2e | example | load | US-1.AC-1 | `docs/lnk/plan.md` |\n");
      fs.writeFileSync(path.join(f.dir, "tasks.md"), TASKS);
      const t = throughLinks(out, () => S.specDoctor(p, "feat"));
      ok(!t.hits.length && !has(t.v), "1.41.1 fix round 1 (A-5): doctor's outside-code-artifacts resolves a plan's file by its REAL path — `docs/lnk/plan.md` through a link out of the project is never stat'ed nor read (got " + js(t.hits) + ")");
    } else ok(true, "1.41.1 fix round 1 (A-5): links not creatable here — skipped");
  }
  // A-6 + B15: the importers' warnings are decided on the ENTRY — a live link out and a dangling one answer alike; a folder linking
  // into the project's own hidden folder is named once, its entries never
  {
    const run = (exists) => {
      const base = path.join(tmp, "rgr-imp-" + (exists ? "e" : "m"));
      const ip = path.join(base, "proj"), io = path.join(base, "victim-dir");
      if (exists) put(path.join(io, "x.md"), "# x\n");
      fs.mkdirSync(path.join(ip, ".specs"), { recursive: true });
      fs.writeFileSync(path.join(ip, ".specs", "roadmap.json"), js({ meta: { lang: "en" }, features: {} }));
      put(path.join(ip, "specs", "001-x", "spec.md"), "# Feature Specification: X\n\n## User Scenarios & Testing\n\n### User Story 1 - Do (Priority: P1)\n\nU.\n\n**Acceptance Scenarios**:\n\n1. **Given** a, **When** b, **Then** c\n");
      put(path.join(ip, "specs", "001-x", "plan.md"), "# Plan\n");
      put(path.join(ip, "openspec", "changes", "add-x", "proposal.md"), "# Change: Add x\n\n## Why\nB.\n");
      if (!link(io, path.join(ip, "specs", "001-x", "contracts")) || !link(io, path.join(ip, "openspec", "changes", "add-x", "specs"))) return null;
      fileLink(path.join(io, "x.md"), path.join(ip, "specs", "001-x", "research.md"));
      const norm = (r) => js(r).split(ip).join("<P>").split(js(ip).slice(1, -1)).join("<P>");
      return [norm(S.importSpec(ip, "spec-kit", "specs/001-x", { dryRun: true }).warnings), norm(S.importSpec(ip, "openspec", "openspec/changes/add-x", { dryRun: true }).warnings)];
    };
    const e = run(true), m = run(false);
    // B15: contracts/ linking into the project's own hidden folder — inside the project, hidden by its real path
    const ip = path.join(tmp, "rgr-imp-hidden");
    put(path.join(ip, ".private", "c", "secret-name-one.md"), "# hidden\n");
    fs.mkdirSync(path.join(ip, ".specs"), { recursive: true });
    fs.writeFileSync(path.join(ip, ".specs", "roadmap.json"), js({ meta: { lang: "en" }, features: {} }));
    put(path.join(ip, "specs", "001-x", "spec.md"), "# Feature Specification: X\n\n## User Scenarios & Testing\n\n### User Story 1 - Do (Priority: P1)\n\nU.\n\n**Acceptance Scenarios**:\n\n1. **Given** a, **When** b, **Then** c\n");
    const hid = link(path.join(ip, ".private", "c"), path.join(ip, "specs", "001-x", "contracts")) ? S.importSpec(ip, "spec-kit", "specs/001-x", { dryRun: true }) : null;
    const W = S.msg("en").importSpec;
    if (e && m && hid) all("1.41.1 fix round 1 (A-6, B15): spec-kit's and OpenSpec's warnings are the same whether a linked folder's outside target exists or not (decided on the entry by real path, before existence); a contracts/ linking into the project's own hidden folder is named once, its entries never (got " + js({ e, m, hid: hid.warnings }) + ")", {
      noOracle: () => e[0] === m[0] && e[1] === m[1],
      hidden: () => hid.ok === true && hid.warnings.filter((w) => w === W.wUnreadable("specs/001-x/contracts")).length === 1 && !/secret-name-one/.test(js(hid)),
    });
    else ok(true, "1.41.1 fix round 1 (A-6): links not creatable here — skipped");
  }
  // A-3: the MCP server's approval meta reads roadmap.json through the gate — a linked one is unknown (every weakening counts): spec_init
  // repeating what the LINK's target says is asked like a change (the parent read the target: "no change", allowed)
  {
    const p = project("srvmeta", ["core"], { approvalGuard: "ask" }), out = path.join(tmp, "rgr-srvmeta-out");
    S.createFeature(p, { name: "feat" });
    const rm = path.join(p, ".specs", "roadmap.json");
    const j = JSON.parse(fs.readFileSync(rm, "utf8"));
    j.meta = { ...j.meta, approvalGuard: "ask", evidence: "reported", stopCheck: false };
    put(path.join(out, "roadmap.json"), js(j, null, 2));
    fs.rmSync(rm);
    if (fileLink(path.join(out, "roadmap.json"), rm)) {
      const kid = spawn(process.execPath, [path.join(__dirname, "server.js")], { env: { ...process.env, SPEC_MCP_APPROVAL_HOOK: "", DEV_SPEC_ELICIT_TIMEOUT_MS: "2500" }, stdio: ["pipe", "pipe", "inherit"] });
      const asked = [], waiting = new Map();
      let buf = "", n = 0;
      const write = (m) => kid.stdin.write(js(m) + "\n");
      kid.stdout.on("data", (d) => {
        buf += d.toString();
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const m = JSON.parse(line);
          if (m.method === "elicitation/create") { asked.push(m); setTimeout(() => write({ jsonrpc: "2.0", id: m.id, result: { action: "decline" } }), 20); continue; }
          if (m.method) continue;
          if (waiting.has(m.id)) { const cb = waiting.get(m.id); waiting.delete(m.id); cb(m); }
        }
      });
      const req = (method, params) => new Promise((resolve) => {
        const id = "rgr-" + ++n;
        const t = setTimeout(() => resolve({ timeout: true }), 15000);
        waiting.set(id, (m) => { clearTimeout(t); resolve(m); });
        write({ jsonrpc: "2.0", id, method, params });
      });
      await req("initialize", { protocolVersion: "2025-06-18", capabilities: { elicitation: {} }, clientInfo: { name: "rgr", version: "1" } });
      const r = await req("tools/call", { name: "spec_init", arguments: { projectDir: p, evidence: "reported", stopCheck: false } });
      await new Promise((resolve) => { kid.on("exit", resolve); kid.stdin.end(); });
      let res = null;
      try { res = JSON.parse(r.result.content[0].text); } catch { res = r; }
      all("1.41.1 fix round 1 (A-3): the MCP server's approval meta reads roadmap.json through the read gate — a linked one is unknown, so spec_init repeating its target's evidence / stopCheck is asked (elicitation) and, declined, writes nothing; the target is never read (got " + js({ asked: asked.length, res }) + ")", {
        asked: () => asked.length === 1, declined: () => !!res && res.ok === false && !has(res), targetKept: () => JSON.parse(fs.readFileSync(path.join(out, "roadmap.json"), "utf8")).meta.evidence === "reported",
      });
    } else ok(true, "1.41.1 fix round 1 (A-3): file symlinks not creatable here — skipped");
  }

  // ---------------------------------------------------------------------------------------------------------------------------
  // the names a linked feature folder holds (B-2, B-3) and the stop gate's report path (no weaker than a name no feature holds)
  // ---------------------------------------------------------------------------------------------------------------------------
  {
    const p = project("names"), out = path.join(tmp, "rgr-names-out");
    put(path.join(out, "requirements.md"), "# Feature: OUTSIDE-NAMES\n");
    put(path.join(out, ".execution", "task-1-report.md"), "# Task 1 OUTSIDE-REPORT\n`node -v` → exit 0\n");
    put(path.join(out, "tasks.md"), TASKS);
    S.createFeature(p, { name: "plain" });
    if (link(out, path.join(p, ".specs", "lnk"))) {
      const dr = S.drift(p, "lnk"), ms = S.milestone(p, "add", { name: "v1", date: "2027-01-15", features: ["plain", "lnk"] }), bl = S.backlog(p, "add", "lnk", "later");
      const rm = JSON.parse(fs.readFileSync(path.join(p, ".specs", "roadmap.json"), "utf8"));
      const linked = (r) => r.ok === false && r.linked === true && r.code === "feature-linked" && r.error === S.msg("en").err.featureLinked(".specs/lnk/") && !has(r);
      all("1.41.1 fix round 1 (B-2, B-3): `drift lnk`, a milestone naming lnk and `backlog add lnk` answer feature-linked for a linked feature folder — never \"not found\" / \"unknown\", nothing planned under its name (got " + js({ dr, ms, bl }) + ")", {
        drift: () => linked(dr), milestone: () => linked(ms), backlog: () => linked(bl),
        nothingWritten: () => !js(rm.backlog || []).includes("lnk") && !js(rm.milestones || {}).includes("lnk"),
      });
      const msg = (slug) => "**Status:** DONE\nReport: .specs/" + slug + "/.execution/task-1-report.md";
      const sl = S.stopCheck(p, { agent: "dev-spec-driven:spec-implementer", message: msg("lnk") }), sn = S.stopCheck(p, { agent: "dev-spec-driven:spec-implementer", message: msg("nosuch") });
      const ss = S.stopCheck(p, { agent: "dev-spec-driven:spec-simplifier", message: "**Status:** DONE\nReport: .specs/lnk/.execution/simplify-report.md" }), sm = S.stopCheck(p, { agent: "dev-spec-driven:spec-simplifier", message: "**Status:** DONE\nReport: .specs/nosuch/.execution/simplify-report.md" });
      all("1.41.1 fix round 1 (stop gate, DESIGN §3 row 17): a report path naming a linked feature folder answers exactly what a name no feature holds answers — the implementer's and the simplifier's — never weaker, nothing behind the link read (got " + js({ sl, sn, ss, sm }) + ")", {
        implementer: () => sl.block === false && sn.block === false && sl.why === sn.why && js(sl.claims) === js(sn.claims),
        simplifier: () => ss.block === false && sm.block === false && ss.why === sm.why && js(ss.claims) === js(sm.claims),
        inert: () => !has([sl, ss]),
      });
    } else ok(true, "1.41.1 fix round 1 (B-2, B-3): links not creatable here — skipped");
  }

  // ---------------------------------------------------------------------------------------------------------------------------
  // the review's surviving mutants (B-4): doctor specs-links' plain steering/ / _archive/ and its depth, a linked ROADMAP.html, a
  // realpath that throws
  // ---------------------------------------------------------------------------------------------------------------------------
  {
    const p = project("survivors"), out = path.join(tmp, "rgr-survivors-out");
    put(path.join(out, "tech.md"), "# Tech OUTSIDE-TECH\n");
    put(path.join(out, "dir", "x.md"), "# OUTSIDE-X\n");
    put(path.join(out, "ROADMAP.html"), "<html>OUTSIDE-HTML</html>\n");
    const f = S.createFeature(p, { name: "feat" });
    const root = path.join(p, ".specs");
    fs.mkdirSync(path.join(root, "_archive"), { recursive: true });
    const deep4 = path.join(f.dir, "a", "b", "c", "lnk4"), deep5 = path.join(f.dir, "a", "b", "c", "d", "lnk5");
    const made = fileLink(path.join(out, "tech.md"), path.join(root, "steering", "tech-shared.md")) && link(path.join(out, "dir"), path.join(root, "_archive", "ghost")) &&
      link(path.join(out, "dir"), deep4) && link(path.join(out, "dir"), deep5);
    if (made) {
      const c = (S.specDoctor(p, "feat").checks || []).find((x) => x.id === "specs-links");
      all("1.41.1 fix round 1 (B-4: B7, B8): doctor specs-links names a file link inside a PLAIN steering/, a link inside a PLAIN _archive/, and a link four levels below the feature folder (SPECS_LINKS_DEPTH) — the fifth level is past its bound (got " + js(c) + ")", {
        steering: () => !!c && c.detail.includes(".specs/steering/tech-shared.md"), archive: () => !!c && c.detail.includes(".specs/_archive/ghost"),
        depth4: () => !!c && c.detail.includes(".specs/feat/a/b/c/lnk4"), bound: () => !!c && !c.detail.includes("lnk5"), inert: () => !has(c),
      });
      // B9: a linked ROADMAP.html — the roadmap refresh after a mutation never probes it through the link
      const html = path.join(root, "ROADMAP.html");
      fs.rmSync(html, { force: true });
      if (fileLink(path.join(out, "ROADMAP.html"), html)) {
        const t = throughLinks(out, () => S.backlog(p, "add", "later-one", "n"));
        ok(t.v.ok === true && !t.hits.length, "1.41.1 fix round 1 (B-4: B9): a linked ROADMAP.html — the roadmap refresh after a mutation (backlog add) never stats, probes or reads it through the link (got " + js({ ok: t.v.ok, hits: t.hits }) + ")");
      } else ok(true, "1.41.1 fix round 1 (B9): file symlinks not creatable here — skipped");
    } else ok(true, "1.41.1 fix round 1 (B-4): links not creatable here — skipped");
    // B20: a folder below .specs/ whose realpath can't be resolved (it throws) reads as absent — every primitive, nothing thrown
    const g = S.createFeature(p, { name: "stub" });
    const tasks = path.join(g.dir, "tasks.md");
    const rp = fs.realpathSync.native, key = fold(path.resolve(g.dir));
    const read = () => { E.specsRoot(p); return [E.readIfExists(tasks) === null, E.existsRaw(tasks), E.isDirSafe(g.dir), E.readDirCached(g.dir) === null, E.safeReaddir(g.dir).length, E.readFileHead(tasks, 100) === null, E.specsReadBlocked(tasks)]; };
    fs.realpathSync.native = function (q) { if (fold(path.resolve(String(q))) === key) throw Object.assign(new Error("EIO"), { code: "EIO" }); return rp.apply(this, arguments); };
    let r;
    try { r = E.withReadCache(read); } finally { fs.realpathSync.native = rp; }
    eq(r, [true, false, false, true, 0, true, true], "1.41.1 fix round 1 (B-4: B20): a folder below .specs/ whose realpath throws reads as absent — every primitive, fail closed");
  }
};
