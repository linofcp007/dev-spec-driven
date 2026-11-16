"use strict";
// +port's execution gate (1.36 — port first, improve later): the fence of the two [PORT] anchors (the baseline, the differential check) on
// spec_complete_task and the brief, an unverified / verify-less anchor, the anchors' fallbacks, the brief's port rule; doctor's port-verify (the
// size matrix, the tasks approval's probe, baselineLate, a _Depends:_ escape) and the runs — port-recheck (spec_finish blocks), port-fence.

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, all, eq, S, tmp, approveBefore, handRoadmap, require }) => {
  const js = (v) => JSON.stringify(v);
  const rd = (...p) => fs.readFileSync(path.join(...p), "utf8");
  const chk = (doc, id) => doc.checks.find((c) => c.id === id) || {};
  const G = S.msg("en").gates, P = S.msg("en").port, B = require("./lib/i18n.js").brief("en");
  const run = (n, code = 0) => ({ command: "node verify-" + n + ".js", exitCode: code, summary: code ? "1 failing" : "ok" });
  // distinct instants between the steps (the re-check compares the evidence `at` and `ticks`, millisecond ISO stamps)
  const tick = () => { const until = Date.now() + 4; while (Date.now() < until) { /* wait */ } };
  const SLOT = /\[(?!shared\]|US\d+\]|[ xX]\]|P\]|PORT\]|NEEDS)[^\]\n]*\]/g;
  const fill = (dir, files) => {
    for (const file of files) {
      const fp = path.join(dir, file);
      if (!fs.existsSync(fp)) continue;
      let t = rd(fp);
      for (let i = 0; i < 3; i++) t = t.replace(SLOT, "the ledger import");
      fs.writeFileSync(fp, t.split(/\r?\n/).map((l) => (/^\s*>\s*\*\*TODO\*\*/.test(l) ? "Decided for this feature: the concrete answer written here." : l)).join("\n"));
    }
  };
  const LEAD = "## Story US-1 — Behaviour Baseline (before the port)", MAIN = "## Story US-1 — Differential Check (the port's proof)";
  // the baseline first (1), the port's work (2–4, 3 citing US-1.AC-36, 4 _Depends: 3_), the differential check (5), improvements after it (6 citing
  // US-1.AC-36, 7 _Depends: 4_ — a chain through 4 and 3 that reaches the baseline by tasks order)
  const TASKS = (dVerify = "node verify-5.js", bVerify = "  - _Verify: node verify-1.js_\n") => `# Tasks: Port fixture

${LEAD}
- [ ] 1. [US1] Record the baseline from the old importer
  - _Requirements: US-1.AC-36, US-1.AC-37_
  - _Implements: tests/baseline/cases.json_
${bVerify}
## Phase: Setup
- [ ] 2. [shared] Set up the new module
  - _Verify: node verify-2.js_

## Story US-1 (P1 — MVP)
- [ ] 3. [US1] Port the parser
  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-36_
  - _Verify: node verify-3.js_
- [ ] 4. [US1] Port the writer
  - _Requirements: US-1.AC-3, US-1.AC-4_
  - _Depends: 3_
  - _Verify: node verify-4.js_
**Checkpoint:** the port is complete.

${MAIN}
- [ ] 5. [US1] Differential check over the corpus
  - _Requirements: US-1.AC-36, US-1.AC-37_
  - _Verify: ${dVerify}_

## Story US-2 (P2)
- [ ] 6. [US2] Clearer error messages
  - _Requirements: US-2.AC-1, US-1.AC-36_
  - _Verify: node verify-6.js_

## Phase: Polish (cross-cutting)
- [ ] 7. [shared] Remove the old importer
  - _Depends: 4_
  - _Verify: node verify-7.js_
`;
  const mk = (name, o = {}) => {
    const p = path.join(tmp, "p36g-" + name);
    S.initProject(p, ["core"], "en");
    handRoadmap(p);
    const f = S.createFeature(p, "Port fixture", ["port"], "", undefined, "en", undefined, o.size ? { size: o.size } : {});
    fill(f.dir, ["classification.md", "requirements.md", "design.md"]);
    fs.writeFileSync(path.join(f.dir, "tasks.md"), o.tasks || TASKS(o.dVerify, o.bVerify));
    return { p, f, slug: f.slug, done: (n, ev, op) => S.completeTask(p, f.slug, n, ev, op || {}) };
  };

  { // the fence: everything after the baseline waits for it (the port's work, the differential check, the improvements), nothing is recorded;
    // a failed run of a held task too; a ticked-but-unverified baseline (a note) opens nothing
    const x = mk("fence");
    const before = [rd(x.f.dir, ".state.json"), rd(x.f.dir, "tasks.md")];
    const r2 = x.done(2, run(2)), r3 = x.done(3, run(3)), r5 = x.done(5, run(5)), r6 = x.done(6, run(6)), r4 = x.done(4, run(4, 1));
    const after = [rd(x.f.dir, ".state.json"), rd(x.f.dir, "tasks.md")];
    all("1.36: +port's fence — while the baseline (task 1) is open, the setup, the port's work (citing a [PORT] criterion or not), the differential check and an improvement are refused (gated port-order, heldBy, never waitsOn), a failed run of a held task too; .state.json and tasks.md unchanged (got " +
      js([r2, r5.heldBy, r6.heldBy]) + ")", [
      () => r2.ok === false, () => r2.gated === "port-order", () => js(r2.heldBy) === "[1]", () => r2.error === G.portHeld(2, 1, x.slug), () => !("waitsOn" in r2),
      () => js(r3.heldBy) === "[1]", () => js(r5.heldBy) === "[1]", () => js(r6.heldBy) === "[1,5]", () => r4.gated === "port-order" && !r4.recorded,
      () => after[0] === before[0], () => after[1] === before[1],
    ]);
    const note = x.done(1, { summary: "recorded by hand" });
    const r2b = x.done(2, run(2));
    all("1.36: a baseline ticked with a note only (UNVERIFIED) opens nothing — the next task is refused, naming the run it needs (got " + js([note.verified, r2b.error]) + ")", [
      () => note.ok, () => note.verified === false, () => r2b.gated === "port-order", () => js(r2b.heldBy) === "[1]", () => r2b.error === G.portHeldUnverified(2, 1, x.slug),
    ]);
    // the baseline verified: the port's work ticks (a task whose _Depends:_ is open still ticks early: waitsOn, no heldBy); an improvement
    // waits for the differential check; then it ticks
    const r1 = x.done(1, run(1));
    tick();
    const t2 = x.done(2, run(2)), t4 = x.done(4, run(4)), t3 = x.done(3, run(3)), h6 = x.done(6, run(6)), b6 = S.taskBrief(x.p, x.slug, 6), b3 = S.taskBrief(x.p, x.slug, 3);
    tick();
    const t5 = x.done(5, run(5));
    tick();
    const t6 = x.done(6, run(6));
    tick();
    const t7 = x.done(7, run(7));
    all("1.36: once the baseline's run verifies it the port's work ticks (a task ticked before its _Depends:_ keeps waitsOn, never heldBy), an improvement waits for the differential check (heldBy [5]) and ticks after it (got " +
      js([r1.verified, t4.waitsOn, h6.heldBy, t6.ok, t7.ok]) + ")", [
      () => r1.ok && r1.verified, () => t2.ok && t2.verified, () => t4.ok && js(t4.waitsOn) === "[3]" && !("heldBy" in t4), () => t3.ok,
      () => h6.gated === "port-order", () => js(h6.heldBy) === "[5]", () => h6.error === G.portHeld(6, 5, x.slug), () => t5.ok && t5.verified, () => t6.ok, () => t7.ok,
    ]);
    // the brief: the gate up front (done --run runs nothing), the task's role in the fence and its definition-of-done rule
    const bB = S.taskBrief(x.p, x.slug, 1), bD = S.taskBrief(x.p, x.slug, 5), bW = S.taskBrief(x.p, x.slug, 6, { write: true });
    all("1.36: the brief — a held task carries gated / gateError / heldBy; a task of the port portRole 'port' and the port rule in its definition of done, one after the differential check portRole 'after' + differential 5 and the 'after' rule; the anchors carry no role; write:true keeps them (got " +
      js([b3.portRole, b6.gated, b6.heldBy, b6.portRole, b6.differential, bB.portRole, bD.portRole, bW.portRole]) + ")", [
      () => b3.portRole === "port" && !("differential" in b3), () => b3.brief.includes(B.portRules.port()), () => b6.gated === "port-order", () => b6.gateError === G.portHeld(6, 5, x.slug),
      () => js(b6.heldBy) === "[5]", () => b6.portRole === "after", () => b6.differential === 5, () => b6.brief.includes(B.portRules.after(5)),
      () => !("portRole" in bB) && !bB.gated, () => !("portRole" in bD), () => bW.portRole === "after" && bW.differential === 5 && !bW.gated && !("brief" in bW),
    ]);
    // the plan as doctor reads it: the fence's pass detail (the _Depends:_ chain 7 → 4 → 3 reaches the baseline); the runs: the improvements
    // ticked after the differential check's run (the re-check is due), no fence gone round
    const doc = S.specDoctor(x.p, x.slug);
    ok(chk(doc, "port-verify").status === "pass" && chk(doc, "port-verify").detail === P.verifyOk(1, 5, "#6, #7") &&
      chk(doc, "port-recheck").detail === P.recheck(5, "#6, #7", x.slug) && !chk(doc, "port-fence").status,
      "1.36: port-verify passes with the fence as the plan reads it (a _Depends:_ chain reaching the baseline is no escape); after an in-order run the improvements ticked after the differential check ask for it again (port-recheck), no port-fence (got " +
      js([chk(doc, "port-verify"), chk(doc, "port-recheck"), chk(doc, "port-fence")]) + ")");
    // undo is never gated; once the differential check is unticked, an improvement already ticked stays ticked and a new tick is refused
    const u5 = S.completeTask(x.p, x.slug, 5, undefined, { undo: true }), u7 = S.completeTask(x.p, x.slug, 7, undefined, { undo: true });
    const r7 = x.done(7, run(7));
    const st = S.statusFeature(x.p, x.slug).tasks.list || [];
    all("1.36: undo is never gated; with the differential check unticked an improvement already ticked stays ticked, a new tick is refused (heldBy [5]) (got " + js([u5.ok, u7.ok, r7.heldBy]) + ")", [
      () => u5.ok && u5.unticked, () => u7.ok && u7.unticked, () => r7.gated === "port-order", () => js(r7.heldBy) === "[5]",
      () => (st.find((t) => t.number === 6) || {}).done === true,
    ]);
    tick();
    x.done(5, run(5));
    tick();
    x.done(7, run(7));
    // the re-check: the differential check last passed before 7 was ticked (and 6 — re-run since); doctor warns, spec_finish blocks; running it
    // again clears it; an improvement re-run after it (no new tick) asks again
    const docR = S.specDoctor(x.p, x.slug), finR = S.finishFeature(x.p, x.slug, { gateOnly: true });
    tick();
    x.done(5, run(5));
    const docC = S.specDoctor(x.p, x.slug), finC = S.finishFeature(x.p, x.slug, { gateOnly: true });
    tick();
    x.done(6, run(6));
    const docA = S.specDoctor(x.p, x.slug);
    all("1.36: port-recheck — the differential check last passed before an improvement listed after it was ticked: doctor warns and spec_finish blocks (port-recheck) naming done <f> 5 --run; re-running it clears both; an improvement re-run after it asks again (got " +
      js([chk(docR, "port-recheck").detail, (finR.checks || []).map((c) => c.id), chk(docC, "port-recheck"), chk(docA, "port-recheck").detail]) + ")", [
      () => chk(docR, "port-recheck").status === "warn", () => chk(docR, "port-recheck").detail === P.recheck(5, "#7", x.slug),
      () => (finR.checks || []).some((c) => c.id === "port-recheck" && c.detail === P.recheck(5, "#7", x.slug)), () => !chk(docC, "port-recheck").status,
      () => !(finC.checks || []).some((c) => c.id === "port-recheck"), () => chk(docA, "port-recheck").detail === P.recheck(5, "#6", x.slug),
    ]);
    // +port turned off: no gate, no port-* check, no port-recheck blocker — even with tasks citing a [PORT] criterion left active (3, 6)
    tick();
    x.done(7, run(7));
    S.removeTrack(x.p, x.slug, "port");
    const docOff = S.specDoctor(x.p, x.slug), finOff = S.finishFeature(x.p, x.slug, { gateOnly: true });
    const u3 = S.completeTask(x.p, x.slug, 3, undefined, { undo: true }), u1 = S.completeTask(x.p, x.slug, 1, undefined, { undo: true });
    const r3off = x.done(3, run(3));
    all("1.36: +port removed — no port-* doctor check, no port-recheck blocker, the fence is gone (a task citing US-1.AC-36 ticks with the baseline open) (got " +
      js([docOff.checks.filter((c) => /^port-/.test(c.id)).map((c) => c.id), (finOff.checks || []).map((c) => c.id), r3off.gated]) + ")", [
      () => !docOff.checks.some((c) => /^port-/.test(c.id)), () => !(finOff.checks || []).some((c) => c.id === "port-recheck"), () => u3.ok && u1.ok, () => r3off.ok,
    ]);
  }

  { // the fence gone round: +port off → a task ticked → +port on again, and a checkbox ticked by hand — doctor's port-fence names them
    const x = mk("round");
    S.removeTrack(x.p, x.slug, "port");
    const r3 = x.done(3, run(3));
    const re = S.addTrack(x.p, x.slug, "port");
    const t = rd(x.f.dir, "tasks.md");
    fs.writeFileSync(path.join(x.f.dir, "tasks.md"), t.replace("- [ ] 4. ", "- [x] 4. "));
    const doc = S.specDoctor(x.p, x.slug);
    ok(r3.ok && re.ok && chk(doc, "port-fence").status === "warn" && chk(doc, "port-fence").detail === P.fence("#3 (#1), #4 (#1)"),
      "1.36: port-fence — a task ticked while +port was off (the baseline never passed) and a checkbox ticked by hand are named with the anchor they wait for (got " + js(chk(doc, "port-fence")) + ")");
  }

  { // an anchor without a runnable _Verify:_ never opens the fence — a verify-less baseline ticks (nothing to verify), the next task stays held
    const x = mk("noverify", { bVerify: "" });
    const r1 = x.done(1), r2 = x.done(2, run(2));
    const doc = S.specDoctor(x.p, x.slug);
    all("1.36: a baseline without a runnable _Verify:_ ticks (nothingToVerify) but opens nothing — the next task names it unverified; port-verify warns no runnable _Verify:_ (got " + js([r1.nothingToVerify, r2.error, chk(doc, "port-verify")]) + ")", [
      () => r1.ok && r1.nothingToVerify === true, () => r2.gated === "port-order", () => r2.error === G.portHeldUnverified(2, 1, x.slug),
      () => chk(doc, "port-verify").status === "warn", () => chk(doc, "port-verify").detail === P.noVerify("#1"),
    ]);
  }

  { // a hand-written plan (no template heading): the first task citing a [PORT] criterion is the baseline, the last the differential check;
    // a task before the baseline is never held
    const HAND = "# Tasks: Hand\n\n## Phase A\n- [ ] 1. Setup\n  - _Verify: node verify-1.js_\n- [ ] 2. Record the baseline\n  - _Requirements: US-1.AC-36_\n  - _Verify: node verify-2.js_\n" +
      "- [ ] 3. Port it\n  - _Requirements: US-1.AC-1_\n  - _Verify: node verify-3.js_\n- [ ] 4. Compare\n  - _Requirements: US-1.AC-37_\n  - _Verify: node verify-4.js_\n" +
      "- [ ] 5. Improve\n  - _Requirements: US-2.AC-1_\n  - _Verify: node verify-5.js_\n";
    const x = mk("hand", { tasks: HAND });
    const r1 = x.done(1, run(1)), h3 = x.done(3, run(3)), b1 = S.taskBrief(x.p, x.slug, 1);
    x.done(2, run(2));
    const r3 = x.done(3, run(3)), h5 = x.done(5, run(5));
    all("1.36: a hand-written plan — the first task citing a [PORT] criterion is the baseline (task 2), the last one the differential check (task 4); task 1, before the baseline, is never held nor given a role (got " +
      js([r1.ok, h3.heldBy, h5.heldBy, b1.portRole]) + ")", [
      () => r1.ok, () => js(h3.heldBy) === "[2]", () => r3.ok, () => js(h5.heldBy) === "[4]", () => !("portRole" in b1) && !b1.gated,
    ]);
  }

  { // a plan with ONE [PORT] task (the differential check deleted): everything after it waits for it (heldBy once), its tasks are the
    // port's (no "after" role, no re-check), and port-verify says the port needs both
    const ONE = "# Tasks: One\n\n## Phase A\n- [ ] 1. Record the baseline\n  - _Requirements: US-1.AC-36, US-1.AC-37_\n  - _Verify: node verify-1.js_\n" +
      "- [ ] 2. Port it\n  - _Requirements: US-1.AC-1_\n  - _Verify: node verify-2.js_\n- [ ] 3. Port the rest\n  - _Requirements: US-1.AC-2_\n  - _Verify: node verify-3.js_\n";
    const x = mk("one", { tasks: ONE });
    const h2 = x.done(2, run(2));
    x.done(1, run(1));
    tick();
    x.done(2, run(2));
    const b3 = S.taskBrief(x.p, x.slug, 3);
    tick();
    x.done(3, run(3));
    const doc = S.specDoctor(x.p, x.slug);
    all("1.36: a plan with one [PORT] task — the tasks after it wait for it (heldBy [1], once), they are the port's (portRole 'port', no differential), no re-check; port-verify warns the port needs both anchors (got " +
      js([h2.heldBy, b3.portRole, chk(doc, "port-verify"), chk(doc, "port-recheck")]) + ")", [
      () => js(h2.heldBy) === "[1]", () => b3.portRole === "port" && !("differential" in b3), () => !chk(doc, "port-recheck").status,
      () => chk(doc, "port-verify").status === "warn", () => chk(doc, "port-verify").detail === P.verifyMissing,
    ]);
  }

  { // +port added to a written plan: the baseline and the differential check appended (their criteria a placeholder — the anchors by their
    // headings); doctor warns baselineLate and a _Depends:_ that never reaches the baseline
    const p = path.join(tmp, "p36g-late");
    S.initProject(p, ["core"], "en");
    handRoadmap(p);
    const f = S.createFeature(p, "Late port", ["core"], "", undefined, "en");
    fill(f.dir, ["classification.md", "requirements.md", "design.md"]);
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks: Late\n\n## Story US-1 (P1 — MVP)\n- [ ] 1. [US1] Build\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4_\n  - _Verify: node verify-1.js_\n" +
      "- [ ] 2. [US2] More\n  - _Requirements: US-2.AC-1_\n  - _Verify: node verify-2.js_\n");
    const add = S.addTrack(p, f.slug, "port");
    const t = rd(f.dir, "tasks.md").replace(/_Verify: \[[^\]]*OLD[^\]]*\]_/, "_Verify: node verify-3.js_").replace(/_Verify: \[[^\]]*NEW[^\]]*\]_/, "_Verify: node verify-4.js_")
      .replace(/_Implements: \[[^\]]*\]_/, "_Implements: tests/baseline/cases.json_");
    fs.writeFileSync(path.join(f.dir, "tasks.md"), t + "\n## Phase: Polish\n- [ ] 5. [shared] Tidy\n  - _Depends: 1_\n  - _Verify: node verify-5.js_\n");
    const h4 = S.completeTask(p, f.slug, 4, run(4));
    const doc = S.specDoctor(p, f.slug);
    all("1.36: add_track +port on a written plan — the appended differential check waits for the appended baseline (anchors by heading, no [PORT] criterion cited); port-verify warns baselineLate (#1, #2 before task 3) and the _Depends:_ of task 5 that never reaches it (got " +
      js([add.ok, h4.heldBy, chk(doc, "port-verify")]) + ")", [
      () => add.ok, () => js(h4.heldBy) === "[3]", () => chk(doc, "port-verify").status === "warn",
      () => chk(doc, "port-verify").detail === P.baselineLate("#1, #2", 3) + "; " + P.dependsEscape("#5", 3),
    ]);
  }

  { // the size matrix: an anchor whose _Verify:_ is still a [slot] — port-verify FAILS at size m (the tasks approval refuses it), warns at s and with
    // no size, and warns once the tasks are approved (forced); a runnable one passes the approval; a fresh scaffold (tasks.md a template) has none
    const SLOTV = "[command that runs the NEW implementation on the corpus and compares it with the recorded baseline]";
    const m = mk("m", { size: "m", dVerify: SLOTV }), s = mk("s", { size: "s", dVerify: SLOTV }), n = mk("none", { dVerify: SLOTV });
    const dm = S.specDoctor(m.p, m.slug), ds = S.specDoctor(s.p, s.slug), dn = S.specDoctor(n.p, n.slug);
    approveBefore(m.p, m.slug, "tasks");
    const refused = S.approvePhase(m.p, m.slug, "tasks", "t");
    const forced = S.approvePhase(m.p, m.slug, "tasks", "t", { force: true });
    const dmApproved = S.specDoctor(m.p, m.slug);
    const g = mk("m-good", { size: "m" });
    approveBefore(g.p, g.slug, "tasks");
    const good = S.approvePhase(g.p, g.slug, "tasks", "t");
    const fresh = S.createFeature(m.p, "Fresh port", ["port"], "", undefined, "en", undefined, { size: "m" });
    const df = S.specDoctor(m.p, fresh.slug);
    all("1.36: port-verify's size matrix — a [slot] _Verify:_ on the differential check FAILS at size m and the tasks approval refuses on it, warns at s / no size and after a forced approval (approved already); a runnable one approves; a fresh scaffold has no port-verify yet (got " +
      js([chk(dm, "port-verify"), chk(ds, "port-verify").status, chk(dn, "port-verify").status, refused.failing, chk(dmApproved, "port-verify"), good.failing, chk(df, "port-verify")]) + ")", [
      () => chk(dm, "port-verify").status === "fail", () => chk(dm, "port-verify").detail === P.noVerify("#5"), () => chk(ds, "port-verify").status === "warn",
      () => chk(dn, "port-verify").status === "warn", () => !refused.ok, () => (refused.failing || []).includes("port-verify"), () => forced.ok,
      () => chk(dmApproved, "port-verify").status === "warn", () => chk(dmApproved, "port-verify").detail === P.noVerify("#5") + " " + P.approvedAlready,
      () => good.ok && !(good.failing || []).includes("port-verify"), () => fresh.ok && !chk(df, "port-verify").status,
    ]);
  }
};
