"use strict";
// Evidence — whose record a task reads after a renumber (evidence-moved); what a run's OUTPUT proves: the could-not-run table (one fixture per runner), a vacuous pass (no test ran), node --test's file-level failures; _Expect:_ values.

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, S, tmp, __dirname, require }) => {
  const js = JSON.stringify;
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const proj = (name) => { const d = path.join(tmp, "proj-r6-" + name); S.initProject(d, ["core"], "en"); return d; };
  const state = (f) => JSON.parse(fs.readFileSync(path.join(f.dir, ".state.json"), "utf8"));

  // 1.24 r6 D1: a renumbered task never inherits another task's run — ownRecord's fallback rejects a record stamped with the
  // text of ANOTHER block of the same tasks.md (a pure title edit keeps its record); doctor evidence-moved names it.
  {
    const d = proj("renum");
    const f = S.createFeature(d, "Renum", ["core"], "", undefined, "en");
    const tasks = (t) => fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n## Phase 1\n\n" + t.join("\n") + "\n");
    tasks(["- [ ] 1. Write the parser _Verify: npm test_", "- [ ] 2. Write the lexer _Verify: npm test_"]);
    const c1 = S.completeTask(d, f.slug, 1, { command: "npm test", exitCode: 0 });
    // the user inserts a task at the top and renumbers the list (a plain markdown edit)
    tasks(["- [ ] 1. Add the config loader _Verify: npm test_", "- [x] 2. Write the parser _Verify: npm test_", "- [ ] 3. Write the lexer _Verify: npm test_"]);
    const c2 = S.completeTask(d, f.slug, 1); // no evidence at all
    const vs = S.verificationStatus(d, f.slug, f.dir).unverifiedDetail;
    const doc = S.specDoctor(d, f.slug).checks.find((c) => c.id === "evidence-moved");
    ok(c1.ok && c1.verified && c2.ok && c2.verified === false && c2.unverifiedReason === "stale-evidence" &&
      vs.some((x) => x.number === 1 && x.reason === "stale-evidence") && vs.some((x) => x.number === 2 && x.reason === "no-evidence") &&
      doc && doc.status === "warn" && /#1 → #2/.test(doc.detail) && /Write the parser/.test(doc.detail),
      "1.24 r6 D1: after a renumber, the new task 1 never inherits the run recorded for the old task 1 (now #2) — stale-evidence; doctor evidence-moved names #1 → #2 (got " +
      js([c2.verified, c2.unverifiedReason, vs, doc]) + ")");
    // storeEvidence: the new task 1's run is its own record — the parser's run is kept aside in `others`, never extended
    const c3 = S.completeTask(d, f.slug, 1, { command: "npm test", exitCode: 0 });
    const e1 = state(f).evidence["1"];
    ok(c3.ok && c3.verified && /config loader/.test(e1.task) && e1.history.length === 1 && Array.isArray(e1.others) && e1.others.some((r) => /Write the parser/.test(r.task)),
      "1.24 r6 D1: a run recorded for the renumbered task 1 starts its own record (history 1) and keeps the parser's run in `others` (got " + js({ task: e1.task, history: e1.history.length, others: (e1.others || []).map((r) => r.task) }) + ")");
    // a pure title edit keeps the record (no other block carries the stamped text)
    tasks(["- [x] 1. Add the config loader module _Verify: npm test_", "- [x] 2. Write the parser _Verify: npm test_", "- [ ] 3. Write the lexer _Verify: npm test_"]);
    const v1 = S.verificationStatus(d, f.slug, f.dir).unverifiedDetail;
    ok(!v1.some((x) => x.number === 1), "1.24 r6 D1: a pure title edit keeps the task's record (task 1 stays verified) (got " + js(v1) + ")");
  }
  { // 1.24 r6 D1: untick never stales another task's record a renumber left under the number
    const d = proj("renum-undo");
    const f = S.createFeature(d, "Undo renum", ["core"], "", undefined, "en");
    const tasks = (t) => fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n" + t.join("\n") + "\n");
    tasks(["- [ ] 1. Alpha step _Verify: npm test_", "- [ ] 2. Beta step _Verify: npm test_"]);
    S.completeTask(d, f.slug, 1, { command: "npm test", exitCode: 0 });
    tasks(["- [x] 1. Beta step _Verify: npm test_", "- [x] 2. Alpha step _Verify: npm test_"]); // swapped by hand
    const u = S.completeTask(d, f.slug, 1, undefined, { undo: true });
    const e1 = state(f).evidence["1"];
    ok(u.ok && u.unticked && u.evidenceStale === false && e1.stale === undefined && /Alpha step/.test(e1.task),
      "1.24 r6 D1: unticking task 1 (now Beta) leaves Alpha's record under #1 alone — no stale mark, evidenceStale false (got " + js([u.evidenceStale, e1.stale, e1.task]) + ")");
    const doc = S.specDoctor(d, f.slug).checks.find((c) => c.id === "evidence-moved");
    ok(doc && /#1 → #2/.test(doc.detail) && /Alpha step/.test(doc.detail), "1.24 r6 D1: doctor evidence-moved names the swapped record (#1 → #2) (got " + js(doc) + ")");
    const pt = S.createFeature(d, "Renum PT", ["core"], "", undefined, "pt");
    fs.writeFileSync(path.join(pt.dir, "tasks.md"), "- [ ] 1. Alfa _Verify: npm test_\n- [ ] 2. Beta _Verify: npm test_\n");
    S.completeTask(d, pt.slug, 1, { command: "npm test", exitCode: 0 });
    fs.writeFileSync(path.join(pt.dir, "tasks.md"), "- [ ] 1. Zero _Verify: npm test_\n- [x] 2. Alfa _Verify: npm test_\n- [ ] 3. Beta _Verify: npm test_\n");
    const dpt = S.specDoctor(d, pt.slug).checks.find((c) => c.id === "evidence-moved");
    const keys = (l) => typeof S.msg(l).evidenceGate.evidenceMoved;
    ok(dpt && dpt.detail !== doc.detail && /#1 → #2/.test(dpt.detail) && !/^the run/.test(dpt.detail) && keys("en") === "function" && keys("pt") === "function" && keys("es") === "function" && keys("pt-BR") === "function",
      "1.24 r6 D1: evidence-moved is localized (PT) and evidenceGate.evidenceMoved exists in EN / PT / ES / pt-BR (got " + js(dpt) + ")");
    // a feature without a moved record has no such check
    const clean = S.createFeature(d, "Clean", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(clean.dir, "tasks.md"), "- [ ] 1. One _Verify: npm test_\n");
    S.completeTask(d, clean.slug, 1, { command: "npm test", exitCode: 0 });
    ok(!S.specDoctor(d, clean.slug).checks.some((c) => c.id === "evidence-moved") && E.CHECK_PHASE["evidence-moved"] === 6, "1.24 r6 D1: no evidence-moved check without a moved record; its CHECK_PHASE is 6 (verification)");
  }

  // 1.24 r6 D7 + D-I8: an _Expect:_ value other than `fail` (failure / fails / red / PT falha) left a must-pass task silently —
  // doctor expect-value names it, and the failed-run refusal names the value (unknownExpect, stable).
  {
    const d = proj("expect");
    const got = {};
    for (const v of ["failure", "`fails`", "red", "falha"]) {
      const f = S.createFeature(d, "X " + v.replace(/`/g, ""), ["core"], "", undefined, v === "falha" ? "pt" : "en");
      fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. Write the regression test T-01 _Verify: node --test tests/x.test.js_\n  - _Expect: " + v + "_\n");
      const r = S.completeTask(d, f.slug, 1, { command: "node --test tests/x.test.js", exitCode: 1, summary: "not ok 1 - T-01\n# fail 1" });
      const doc = S.specDoctor(d, f.slug).checks.find((c) => c.id === "expect-value");
      got[v] = { ok: r.ok, recorded: r.recorded, unknown: r.unknownExpect, error: r.error, doc: doc && doc.status + ":" + doc.detail };
    }
    const bare = (v) => v.replace(/`/g, "");
    const wrong = Object.keys(got).filter((v) => { const g = got[v]; return g.ok !== false || g.recorded !== true || js(g.unknown) !== js([bare(v)]) ||
      !g.error.includes("_Expect: " + bare(v) + "_") || !/_Expect: fail_/.test(g.error) || !g.doc || !/^warn:/.test(g.doc) || !g.doc.includes("#1") || !g.doc.includes(bare(v)); });
    ok(!wrong.length && /Tarefa 1/.test(got.falha.error) && /^warn:.*_Expect: fail_/.test(got.failure.doc),
      "1.24 r6 D7: an _Expect:_ value other than fail — the failed-run refusal names it (unknownExpect) and says to write _Expect: fail_; doctor expect-value (warn) names the task and the value; PT localized (wrong: " + js(wrong.map((v) => [v, got[v]])) + ")");
    const f = S.createFeature(d, "Expect ok", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "- [ ] 1. Red T-01 _Verify: node --test tests/x.test.js_\n  - _Expect: `FAIL`_\n- [ ] 2. Plain _Verify: npm test_\n");
    const r2 = S.completeTask(d, f.slug, 2, { command: "npm test", exitCode: 1 });
    ok(!S.specDoctor(d, f.slug).checks.some((c) => c.id === "expect-value") && r2.ok === false && r2.unknownExpect === undefined && !/_Expect/.test(r2.error) && E.CHECK_PHASE["expect-value"] === 5,
      "1.24 r6 D7: _Expect: `FAIL`_ is the known value (no expect-value check), a task without _Expect:_ keeps its plain refusal (got " + js(r2) + ")");
  }
};
