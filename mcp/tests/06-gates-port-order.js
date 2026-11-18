"use strict";
// +port's execution gate (1.36 — port first, improve later): the fence of the two [PORT] anchors (the baseline, the differential check) on
// spec_complete_task and the brief, an unverified / verify-less anchor, the anchors' fallbacks, the brief's port rule; doctor's port-verify (the
// size matrix, the tasks approval's probe, baselineLate, a _Depends:_ escape) and the runs — port-recheck (spec_finish blocks), port-fence.
// 1.36.0 review 1: a verify-less anchor's note tick, the fence audit past the 5-run history, D's rule (its heading's last citing task), a D
// listed before B, spec_next_task / next_action / the status line over held tasks, next_action's re-check step before the finish.

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
    S.initProject(p, ["core"], "en", o.init || {});
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

  { // +port added to a written plan with a task ticked: the baseline and the differential check appended (their criteria a placeholder — the
    // anchors by their headings); doctor warns baselineLate and a _Depends:_ that never reaches the baseline. 1.36 review 3 (PF3-1): the same
    // plan with no task ticked gets the baseline's section before its first task section — no baselineLate
    const PLAN = "# Tasks: Late\n\n## Story US-1 (P1 — MVP)\n- [ ] 1. [US1] Build\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4_\n  - _Verify: node verify-1.js_\n" +
      "- [ ] 2. [US2] More\n  - _Requirements: US-2.AC-1_\n  - _Verify: node verify-2.js_\n";
    const late = (name, tick1) => {
      const p = path.join(tmp, "p36g-" + name);
      S.initProject(p, ["core"], "en");
      handRoadmap(p);
      const f = S.createFeature(p, "Late port", ["core"], "", undefined, "en");
      fill(f.dir, ["classification.md", "requirements.md", "design.md"]);
      fs.writeFileSync(path.join(f.dir, "tasks.md"), PLAN);
      const t1 = tick1 ? S.completeTask(p, f.slug, 1, run(1)) : null;
      return { p, f, t1, add: S.addTrack(p, f.slug, "port") };
    };
    const un = late("late-unticked", false), unT = rd(un.f.dir, "tasks.md"), unPv = chk(S.specDoctor(un.p, un.f.slug), "port-verify");
    ok(un.add.ok && unT.indexOf(LEAD) > 0 && unT.indexOf(LEAD) < unT.indexOf("## Story US-1 (P1") && unT.indexOf(MAIN) > unT.indexOf("- [ ] 2. ") &&
      S.nextTask(un.p, un.f.slug).next.number === 3 && !String(unPv.detail).includes(P.baselineLate("#1", 3).split(" (")[0]),
      "1.36 review 3 (PF3-1): add_track +port on a written plan with no task ticked — the baseline's section before the first task section, the differential check appended; next_task serves the baseline, no baselineLate (got " +
      js([unT.split("\n").filter((l) => /^#/.test(l)), unPv]) + ")");
    const { p, f, t1, add } = late("late", true);
    const t = rd(f.dir, "tasks.md").replace(/_Verify: \[[^\]]*OLD[^\]]*\]_/, "_Verify: node verify-3.js_").replace(/_Verify: \[[^\]]*NEW[^\]]*\]_/, "_Verify: node verify-4.js_")
      .replace(/_Implements: \[[^\]]*\]_/, "_Implements: tests/baseline/cases.json_");
    fs.writeFileSync(path.join(f.dir, "tasks.md"), t + "\n## Phase: Polish\n- [ ] 5. [shared] Tidy\n  - _Depends: 1_\n  - _Verify: node verify-5.js_\n");
    const h4 = S.completeTask(p, f.slug, 4, run(4));
    const doc = S.specDoctor(p, f.slug);
    all("1.36: add_track +port on a written plan with a task ticked — the appended differential check waits for the appended baseline (anchors by heading, no [PORT] criterion cited); port-verify warns baselineLate (#1, #2 before task 3), the _Depends:_ of task 5 that never reaches it and (1.36 review 2, P2-4) the differential check citing no [PORT] criterion (got " +
      js([t1.ok, add.ok, h4.heldBy, chk(doc, "port-verify")]) + ")", [
      () => t1.ok && add.ok, () => js(h4.heldBy) === "[3]", () => chk(doc, "port-verify").status === "warn",
      () => chk(doc, "port-verify").detail === P.baselineLate("#1, #2", 3) + "; " + P.dependsEscape("#5", 3) + "; " + P.dUncited(4),
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
    // (T2) the probe is the tasks approval's at size m / l only: at s and with no size a differential check with no _Verify:_ line approves
    // the tasks (port-verify a warn, never among the failing checks)
    const NOD = TASKS().replace("  - _Verify: node verify-5.js_\n", "");
    // (size s: one story — the plan cites its criteria only)
    const as = mk("s-nod", { size: "s", tasks: NOD.replace("US-1.AC-3, US-1.AC-4", "US-1.AC-2").replace("US-2.AC-1, ", "") }), an = mk("none-nod", { tasks: NOD });
    approveBefore(as.p, as.slug, "tasks");
    approveBefore(an.p, an.slug, "tasks");
    const okS = S.approvePhase(as.p, as.slug, "tasks", "t"), okN = S.approvePhase(an.p, an.slug, "tasks", "t");
    all("1.36 review 1 (T2): at size s and with no size a differential check without a _Verify:_ line approves the tasks — port-verify warns, never among the failing checks (got " +
      js([okS.ok, okS.failing, okN.ok, okN.failing, chk(S.specDoctor(as.p, as.slug), "port-verify").status]) + ")", [
      () => okS.ok && !okS.forced, () => okN.ok && !okN.forced, () => chk(S.specDoctor(as.p, as.slug), "port-verify").status === "warn",
      () => chk(S.specDoctor(an.p, an.slug), "port-verify").detail === P.noVerify("#5") + " " + P.approvedAlready,
    ]);
  }

  { // 1.36 review 1 (PORT-1): a [PORT] task without a runnable _Verify:_ — its [slot] left, or its line deleted — never opens the fence, whatever
    // ticks it: a note ticks it (the verify-less evidence rule) and the next task stays held, naming it; the same for the differential check
    // (the improvements stay held); a passing run of a runnable _Verify:_ opens it
    const SLOT_OLD = "  - _Verify: [command that runs the OLD implementation on the corpus and compares it with the baseline]_\n";
    const sl = mk("slot-note", { bVerify: SLOT_OLD }), nv = mk("nov-note", { bVerify: "" });
    const sN = sl.done(1, { summary: "baseline recorded" }), s2 = sl.done(2, run(2));
    const nN = nv.done(1, { summary: "baseline recorded" }), n2 = nv.done(2, run(2));
    const dv = mk("d-note", { tasks: TASKS().replace("  - _Verify: node verify-5.js_\n", "") });
    dv.done(1, run(1));
    tick();
    for (const n of [2, 3, 4]) dv.done(n, run(n));
    const dN = dv.done(5, { summary: "compared by hand" }), d6 = dv.done(6, run(6));
    const ctl = mk("run-opens");
    const c1 = ctl.done(1, run(1)), c2 = ctl.done(2, run(2));
    all("1.36 review 1 (PORT-1): a baseline whose _Verify:_ is still its [slot], or has none, ticked with a note opens nothing (the next task refused, heldBy [1], unverified); a differential check without one, ticked with a note, keeps the improvements held; a passing run opens the fence (got " +
      js([sN.ok, s2.heldBy, nN.ok, n2.heldBy, dN.ok, d6.heldBy, c2.ok]) + ")", [
      () => sN.ok, () => s2.gated === "port-order" && js(s2.heldBy) === "[1]" && s2.error === G.portHeldUnverified(2, 1, sl.slug),
      () => nN.ok, () => n2.gated === "port-order" && js(n2.heldBy) === "[1]",
      () => dN.ok, () => d6.gated === "port-order" && js(d6.heldBy) === "[5]" && d6.error === G.portHeldUnverified(6, 5, dv.slug),
      () => c1.ok && c1.verified, () => c2.ok && c2.verified,
    ]);
  }

  { // 1.36 review 1 (PORT-2): the fence audit never flags honest work, however often an anchor is re-run — its evidence history keeps 5 runs, so
    // once it is full the anchor's first pass is unknown (no task is flagged for being ticked before it); a checkbox ticked by hand still is
    const inOrder = (x) => { for (const n of [1, 2, 3, 4, 5]) { tick(); x.done(n, run(n)); } };
    const fence = (x) => chk(S.specDoctor(x.p, x.slug), "port-fence");
    // G: the brief's 'after' rule — the differential check re-run after each improvement, then after a fix round
    const g = mk("audit-g");
    inOrder(g);
    for (const n of [6, 7]) { tick(); g.done(n, run(n)); tick(); g.done(5, run(5)); }
    for (let k = 0; k < 3; k++) { tick(); g.done(5, run(5)); }
    // H: one improvement, then the differential check re-run five times, the baseline five times; then task 7 ticked by hand
    const h = mk("audit-h");
    inOrder(h);
    tick();
    h.done(6, run(6));
    for (let k = 0; k < 5; k++) { tick(); h.done(5, run(5)); }
    for (let k = 0; k < 5; k++) { tick(); h.done(1, run(1)); }
    const hClean = fence(h);
    fs.writeFileSync(path.join(h.f.dir, "tasks.md"), rd(h.f.dir, "tasks.md").replace("- [ ] 7. ", "- [x] 7. "));
    // J: a flaky differential check — four failing re-runs, then a passing one
    const j = mk("audit-j");
    inOrder(j);
    tick();
    j.done(6, run(6));
    for (let k = 0; k < 4; k++) { tick(); j.done(5, run(5, 1)); }
    tick();
    j.done(5, run(5));
    all("1.36 review 1 (PORT-2): port-fence stays quiet after the differential check is re-run past its 5-run history (re-run after each improvement and a fix round; five re-runs after one; four failed re-runs and a pass); a checkbox ticked by hand after it is still named (got " +
      js([fence(g), hClean, fence(h), fence(j)]) + ")", [
      () => !fence(g).status, () => !hClean.status, () => fence(h).status === "warn" && fence(h).detail === P.fence("#7 (#1)"), () => !fence(j).status,
    ]);
  }

  { // 1.36 review 1 (PORT-4, PORT-5): the differential check is the last task under its heading that cites a [PORT] criterion — a task written
    // after it in its section waits for it, one before it is the port's —; listed before the baseline it holds nothing (the baseline holds every
    // task after it, nothing before it is held) and port-verify names the order
    const DSEC = `# Tasks: D rule\n\n${LEAD}\n- [ ] 1. [US1] Record the baseline\n  - _Requirements: US-1.AC-36, US-1.AC-37_\n  - _Verify: node verify-1.js_\n\n` +
      "## Story US-1 (P1 — MVP)\n- [ ] 2. [US1] Port the parser\n  - _Requirements: US-1.AC-1_\n  - _Verify: node verify-2.js_\n\n" +
      `${MAIN}\n- [ ] 3. [US1] Prepare the corpus runner\n  - _Requirements: US-1.AC-2_\n  - _Verify: node verify-3.js_\n` +
      "- [ ] 4. [US1] Differential check over the corpus\n  - _Requirements: US-1.AC-36, US-1.AC-37_\n  - _Verify: node verify-4.js_\n" +
      "- [ ] 5. [US1] Clearer error messages\n  - _Requirements: US-1.AC-1_\n  - _Verify: node verify-5.js_\n";
    const x = mk("d-rule", { tasks: DSEC });
    x.done(1, run(1));
    tick();
    const t2 = x.done(2, run(2)), t3 = x.done(3, run(3)), h5 = x.done(5, run(5)), b5 = S.taskBrief(x.p, x.slug, 5), b3 = S.taskBrief(x.p, x.slug, 3);
    const dp = chk(S.specDoctor(x.p, x.slug), "port-verify");
    const EARLY = `# Tasks: Early\n\n${MAIN}\n- [ ] 1. [US1] Differential check\n  - _Requirements: US-1.AC-36, US-1.AC-37_\n  - _Verify: node verify-1.js_\n\n` +
      "## Phase: Setup\n- [ ] 2. [shared] Set up\n  - _Verify: node verify-2.js_\n\n" +
      `${LEAD}\n- [ ] 3. [US1] Record the baseline\n  - _Requirements: US-1.AC-36, US-1.AC-37_\n  - _Verify: node verify-3.js_\n\n` +
      "## Story US-1 (P1 — MVP)\n- [ ] 4. [US1] Port it\n  - _Requirements: US-1.AC-1_\n  - _Verify: node verify-4.js_\n";
    const e = mk("early", { tasks: EARLY });
    const eb1 = S.taskBrief(e.p, e.slug, 1), eb4 = S.taskBrief(e.p, e.slug, 4), e2 = e.done(2, run(2)), e1 = e.done(1, run(1)), e4 = e.done(4, run(4));
    const ev = chk(S.specDoctor(e.p, e.slug), "port-verify");
    all("1.36 review 1 (PORT-4, PORT-5): a task written after the differential check in its section waits for it (heldBy [4], portRole 'after'), one before it is the port's; port-verify names task 4 as the check; a differential check listed before the baseline holds nothing — the tasks before the baseline tick, the one after waits for the baseline alone — and port-verify names the order (got " +
      js([t3.ok, h5.heldBy, b5.portRole, b3.portRole, dp.detail, eb1.gated, e2.ok, e1.ok, e4.heldBy, eb4.portRole, ev]) + ")", [
      () => t2.ok && t3.ok, () => h5.gated === "port-order" && js(h5.heldBy) === "[4]", () => b5.portRole === "after" && b5.differential === 4, () => b3.portRole === "port",
      () => dp.status === "pass" && dp.detail === P.verifyOk(1, 4, "#5"), () => !eb1.gated && !("portRole" in eb1), () => e2.ok, () => e1.ok,
      () => e4.gated === "port-order" && js(e4.heldBy) === "[3]", () => eb4.portRole === "port", () => ev.status === "warn" && ev.detail === P.verifyOrder(1, 3),
    ]);
  }

  { // 1.36 review 1 (INT-2): spec_next_task, next_action and the status line never send the agent to a task the fence holds — the held ones are
    // passed over (gated, heldBy); nothing else can start while the anchor holding them is ticked but not verified: next_action's step is that
    // anchor's run (verify — the gate's own way out), its note on next_task; with no runnable _Verify:_, its plan change first
    // every phase approved (next_action reaches the tasks), the baseline's _Implements:_ file there (a ticked task's file is traced)
    const approveAll = (x) => {
      approveBefore(x.p, x.slug, "execution");
      fs.mkdirSync(path.join(x.p, "tests", "baseline"), { recursive: true });
      fs.writeFileSync(path.join(x.p, "tests", "baseline", "cases.json"), "[]\n");
      return x;
    };
    const B1 = approveAll(mk("held-b"));
    const u1 = B1.done(1, { command: "node verify-1.js --record", exitCode: 0, summary: "ok" });
    const nt = S.nextTask(B1.p, B1.slug), na = S.nextAction(B1.p, B1.slug), sl = S.statusLine(B1.p);
    const D1 = approveAll(mk("held-d"));
    for (const n of [1, 2, 3, 4]) { tick(); D1.done(n, run(n)); }
    D1.done(5, { summary: "compared by hand" });
    const ntD = S.nextTask(D1.p, D1.slug), naD = S.nextAction(D1.p, D1.slug);
    const V1 = approveAll(mk("held-nov", { bVerify: "" }));
    V1.done(1, { summary: "baseline recorded" });
    const naV = S.nextAction(V1.p, V1.slug);
    // a task listed before the baseline that tasks order serves after a held one (one section: by number) — served; --batch never adds a held one
    const SKIP = "# Tasks: Skip\n\n## Phase A\n- [ ] 5. [P] Write the docs page\n  - _Implements: docs/a.md_\n  - _Verify: node verify-5.js_\n" +
      "- [ ] 1. Record the baseline\n  - _Requirements: US-1.AC-36_\n  - _Verify: node verify-1.js_\n" +
      "- [ ] 2. [P] Port it\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4, US-2.AC-1_\n  - _Implements: src/b.js_\n  - _Verify: node verify-2.js_\n" +
      "- [ ] 3. Compare\n  - _Requirements: US-1.AC-37_\n  - _Verify: node verify-3.js_\n";
    const K = approveAll(mk("held-skip", { tasks: SKIP }));
    K.done(1, { summary: "recorded by hand" });
    const ntK = S.nextTask(K.p, K.slug, { batch: true }), naK = S.nextAction(K.p, K.slug);
    all("1.36 review 1 (INT-2): the baseline ticked unverified — next_task serves nothing (gated port-order, heldBy [1], the note names its run), next_action's step is verify with that run, the status line says verify task 1; the differential check likewise (heldBy [5]); a baseline with no runnable _Verify:_ asks for its command first; a task before the baseline is served past a held one, alone in --batch (got " +
      js([u1.verified, nt, na.step, sl.next, ntD.heldBy, naD.step, naV.recommendation, ntK.next, ntK.batch, naK.step]) + ")", [
      () => u1.ok && u1.verified === false, () => nt.next === null && nt.gated === "port-order" && js(nt.heldBy) === "[1]", () => nt.note === P.naHeld(2, 1, B1.slug, true),
      () => na.step === "verify" && na.recommendation === P.naHeld(2, 1, B1.slug, true), () => js(sl.next) === js({ step: "verify", task: 1 }),
      () => ntD.next === null && js(ntD.heldBy) === "[5]" && ntD.note === P.naHeld(6, 5, D1.slug, true), () => naD.step === "verify" && naD.recommendation === P.naHeld(6, 5, D1.slug, true),
      () => naV.step === "verify" && naV.recommendation === P.naHeld(2, 1, V1.slug, false),
      () => ntK.next && ntK.next.number === 5 && ntK.gated === "port-order" && js(ntK.heldBy) === "[1]", () => js((ntK.batch || []).map((b) => b.number)) === "[5]",
      () => naK.step === "implement" && /#5/.test(naK.recommendation),
    ]);
    // 1.36 review 2 (P2-3): complete_task's `next`, spec_status's next and the brief's default task pass over a held task too — nothing
    // else can start: none, the tick's note and the brief's naming the anchor's run (next_task's note); a task the fence doesn't hold is
    // still served
    const stB = S.statusFeature(B1.p, B1.slug).tasks, brB = S.taskBrief(B1.p, B1.slug), stD = S.statusFeature(D1.p, D1.slug).tasks, brD = S.taskBrief(D1.p, D1.slug);
    const nD = S.completeTask(D1.p, D1.slug, 5, { summary: "compared by hand again" });
    const stK = S.statusFeature(K.p, K.slug).tasks, brK = S.taskBrief(K.p, K.slug);
    const nV = S.completeTask(V1.p, V1.slug, 1, { summary: "baseline recorded again" });
    all("1.36 review 2 (P2-3): the baseline ticked unverified — complete_task's next is none (its note names the baseline's run), spec_status's next none, the brief's default task none (naHeld); the differential check likewise; a task before the baseline is still served (got " +
      js([u1.next, stB.next, brB.task, brB.note, stD.next, brD.task, nD.next, stK.next, brK.task && brK.task.number]) + ")", [
      () => u1.next === null && u1.note.endsWith(P.naHeld(2, 1, B1.slug, true)), () => stB.next === null, () => brB.ok && brB.task === null && brB.note === P.naHeld(2, 1, B1.slug, true),
      () => stD.next === null && brD.task === null && brD.note === P.naHeld(6, 5, D1.slug, true), () => nD.ok && nD.next === null,
      () => nV.ok && nV.next === null && nV.note.endsWith(P.naHeld(2, 1, V1.slug, false)),
      () => stK.next && stK.next.number === 5, () => brK.task && brK.task.number === 5,
    ]);
    // 1.36 review 3 (PF3-5): the baseline [P] beside [P] port tasks of its section (disjoint _Implements:_) — next --batch never adds a task the
    // fence holds while the next task is the open baseline itself; once it passes, the port's [P] tasks batch together
    const PB = `# Tasks: Batch\n\n${LEAD}\n- [ ] 1. [US1][P] Record the baseline\n  - _Requirements: US-1.AC-36, US-1.AC-37_\n  - _Implements: tests/baseline.json_\n  - _Verify: node verify-1.js_\n` +
      "- [ ] 2. [US1][P] Port the lexer\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Implements: src/lexer.js_\n  - _Verify: node verify-2.js_\n" +
      "- [ ] 3. [US1][P] Port the parser\n  - _Requirements: US-1.AC-3, US-1.AC-4, US-2.AC-1_\n  - _Implements: src/parser.js_\n  - _Verify: node verify-3.js_\n\n" +
      `${MAIN}\n- [ ] 4. [US1] Differential check\n  - _Requirements: US-1.AC-36, US-1.AC-37_\n  - _Verify: node verify-4.js_\n`;
    const PBx = approveAll(mk("held-batch", { size: "s", tasks: PB }));
    const bt0 = S.nextTask(PBx.p, PBx.slug, { batch: true });
    PBx.done(1, run(1));
    const bt1 = S.nextTask(PBx.p, PBx.slug, { batch: true });
    const nums = (r) => js((r.batch || []).map((b) => b.number));
    all("1.36 review 3 (PF3-5): next --batch with the open [P] baseline next — the batch is the baseline alone (no held task); once it passes, the port's [P] tasks batch (got " +
      js([bt0.next, bt0.batch, bt1.next, bt1.batch]) + ")", [
      () => bt0.next && bt0.next.number === 1 && nums(bt0) === "[1]", () => bt1.next && bt1.next.number === 2 && nums(bt1) === "[2,3]",
    ]);
  }

  { // 1.36 review 1 (INT-3): all ticked with the differential check not passed again since a task after it — next_action's step is that run
    // (verify), before the review panel's finish sentence and the project checks (they run once); an unverified tick comes first; the status
    // line says it too; once re-run, the finish step (the panel first, the checks' hint after)
    const x = mk("recheck-order", { init: { checks: { tc: "node tc.js" }, reviewModels: ["opus", "sonnet"] } });
    approveBefore(x.p, x.slug, "execution");
    fs.mkdirSync(path.join(x.p, "tests", "baseline"), { recursive: true });
    fs.writeFileSync(path.join(x.p, "tests", "baseline", "cases.json"), "[]\n");
    for (const n of [1, 2, 3, 4, 5, 6]) { tick(); x.done(n, run(n)); }
    tick();
    x.done(7, { command: "node verify-7.js --fast", exitCode: 0, summary: "ok" }); // a run of another command: ticked, unverified
    const naU = S.nextAction(x.p, x.slug);
    tick();
    x.done(7, run(7));
    const naR = S.nextAction(x.p, x.slug), slR = S.statusLine(x.p);
    tick();
    x.done(5, run(5));
    const naF = S.nextAction(x.p, x.slug), NX = S.msg("en").next;
    const panelAt = (naF.recommendation || "").indexOf(NX.reviewBranch(x.slug, "opus, sonnet")), doneAt = (naF.recommendation || "").indexOf(NX.allDone(x.slug));
    all("1.36 review 1 (INT-3): next_action — an unverified improvement first (verify #7), then the differential check's re-run (verify, its own text: no panel sentence, no project-checks hint) and the status line's verify task 5; re-run, the finish step: the panel's branch review first, then the finish text and the checks' hint (got " +
      js([naU.step, naR.step, naR.recommendation, slR.next, naF.step, panelAt, doneAt]) + ")", [
      () => naU.step === "verify" && /\b7\b/.test(naU.recommendation) && !naU.recommendation.includes(P.naRecheck(5, "#6, #7", x.slug)),
      () => naR.step === "verify" && naR.recommendation === P.naRecheck(5, "#6, #7", x.slug), () => js(slR.next) === js({ step: "verify", task: 5 }),
      () => naF.step === "finish" && panelAt === 0 && doneAt > panelAt, () => naF.recommendation.includes("finish " + x.slug + " --run"),
    ]);
    // 1.36 review 2 (P2-2): port-recheck reads only the tasks listed after the differential check, so a fix after its re-run — the branch
    // review's included — is never asked for: the finish step says to run it again first (after the finish text, before the checks' hint),
    // and so does the re-check step's text; a plan with one anchor has no differential check to name
    const portAt = naF.recommendation.indexOf(P.naFinishCheck(5, x.slug)), hintAt = naF.recommendation.indexOf("finish " + x.slug + " --run");
    const one = mk("finish-one", { tasks: "# Tasks: One\n\n## Phase A\n- [ ] 1. Record the baseline\n  - _Requirements: US-1.AC-36, US-1.AC-37_\n  - _Verify: node verify-1.js_\n" +
      "- [ ] 2. Port it\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4, US-2.AC-1_\n  - _Verify: node verify-2.js_\n" });
    approveBefore(one.p, one.slug, "execution");
    for (const n of [1, 2]) { tick(); one.done(n, run(n)); }
    const naOne = S.nextAction(one.p, one.slug);
    all("1.36 review 2 (P2-2): the +port finish step names the differential check's re-run after any fix (after the finish text, before the project checks' hint); the re-check text says it too; a one-anchor plan's finish names none (got " +
      js([portAt, doneAt, hintAt, naOne.step, naOne.recommendation]) + ")", [
      () => portAt > doneAt && portAt < hintAt, () => /review panel/.test(P.naRecheck(5, "#6", x.slug)) && /before \/spec-finish/.test(P.naRecheck(5, "#6", x.slug)),
      () => naOne.step === "finish" && !naOne.recommendation.includes("+port:"),
    ]);
    // 1.36 review 3 (PF3-3): a differential check with no runnable _Verify:_ (no size: port-verify only warns; ticked on a note) — the finish
    // step names no `done --run` of it (that command exits 1 — port-recheck never reads such a check either)
    const dl = mk("finish-dless", { tasks: `# Tasks: Port fixture\n\n${LEAD}\n- [ ] 1. [US1] Record the baseline\n  - _Requirements: US-1.AC-36, US-1.AC-37_\n  - _Verify: node verify-1.js_\n\n` +
      "## Story US-1 (P1 — MVP)\n- [ ] 2. [US1] Port the reader\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4, US-2.AC-1_\n  - _Verify: node verify-2.js_\n\n" +
      `${MAIN}\n- [ ] 3. [US1] Differential check, compared by hand\n  - _Requirements: US-1.AC-36, US-1.AC-37_\n` });
    approveBefore(dl.p, dl.slug, "execution");
    for (const n of [1, 2]) { tick(); dl.done(n, run(n)); }
    tick();
    const dl3 = dl.done(3, { summary: "compared by hand" }), naDl = S.nextAction(dl.p, dl.slug);
    all("1.36 review 3 (PF3-3): a verify-less differential check ticked on a note — the finish step has no +port line naming a `done --run` that cannot run (got " +
      js([dl3.ok, naDl.step, naDl.recommendation]) + ")", [
      () => dl3.ok, () => naDl.step === "finish", () => !naDl.recommendation.includes("+port:") && !naDl.recommendation.includes("done " + dl.slug + " 3 --run"),
    ]);
  }

  { // 1.36 review 2 (P2-1): a project tasks template with no level-2 heading over its first task (Kiro's tasks right under the title, ###-only
    // sections) gets the baseline appended after the template's tasks (the insertion is unchanged): at size m / l the tasks approval refuses
    // the plan until the baseline comes first — doctor's port-verify fails and next_action names the move —, once approved anyway it is a warn
    // (the next approval requires it); at s a warn, the approval passes. A built-in scaffold (the baseline first) never trips it.
    const KIRO = "# Implementation Plan\n\n- [ ] 1. [placeholder task]\n  - _Requirements: [criterion]_\n";
    const H3 = "# Tasks\n\n### Setup\n- [ ] 1. [placeholder task]\n  - _Requirements: [criterion]_\n\n### Core\n- [ ] 2. [placeholder task]\n  - _Requirements: [criterion]_\n";
    // the scaffold filled in place: each template task covers its share of the story's criteria (cover[k]), every other slot a value
    const tpl = (name, body, size, cover) => {
      const p = path.join(tmp, "p36g-tpl-" + name);
      S.initProject(p, ["core"], "en");
      handRoadmap(p);
      fs.mkdirSync(path.join(p, ".specs", "templates"), { recursive: true });
      fs.writeFileSync(path.join(p, ".specs", "templates", "tasks.md"), body);
      const f = S.createFeature(p, "Port fixture", ["port"], "", undefined, "en", undefined, { size });
      let k = 0;
      fs.writeFileSync(path.join(f.dir, "tasks.md"), rd(f.dir, "tasks.md").replace(/_Requirements: \[criterion\]_/g, () => "_Requirements: " + cover[k++] + "_"));
      fill(f.dir, ["classification.md", "requirements.md", "design.md", "tasks.md"]);
      approveBefore(p, f.slug, "tasks");
      return { p, f, slug: f.slug };
    };
    const M_ALL = ["US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4, US-2.AC-1"], S_ALL = ["US-1.AC-1, US-1.AC-2"];
    const km = tpl("kiro-m", KIRO, "m", M_ALL), hm = tpl("h3-m", H3, "m", ["US-1.AC-1, US-1.AC-2", "US-1.AC-3, US-1.AC-4, US-2.AC-1"]);
    const ks = tpl("kiro-s", KIRO, "s", S_ALL), hs = tpl("h3-s", H3, "s", ["US-1.AC-1", "US-1.AC-2"]);
    const lateK = P.baselineLate("#1", 2), lateH = P.baselineLate("#1, #2", 3);
    const refK = S.approvePhase(km.p, km.slug, "tasks", "t"), refH = S.approvePhase(hm.p, hm.slug, "tasks", "t");
    const pvK = chk(S.specDoctor(km.p, km.slug), "port-verify"), naK = S.nextAction(km.p, km.slug);
    const okKs = S.approvePhase(ks.p, ks.slug, "tasks", "t"), okHs = S.approvePhase(hs.p, hs.slug, "tasks", "t");
    const pvKs = chk(S.specDoctor(ks.p, ks.slug), "port-verify"), pvHs = chk(S.specDoctor(hs.p, hs.slug), "port-verify");
    // approved anyway (forced): a warn, the next approval requires the move
    S.approvePhase(km.p, km.slug, "tasks", "t", { force: true, reason: "fixture" });
    const pvKa = chk(S.specDoctor(km.p, km.slug), "port-verify");
    // the move baselineLate names (1.36 review 3, PF3-2): the baseline's section first, then the template's tasks under a level-2 heading of
    // their own — approved; removing +port then leaves the template's tasks active (moved INTO the baseline's section, they were hidden with
    // it). 1.36 review 4 (PF4-1): the tasks KEEP their numbers (renumbered, a ticked task's run went to another one): the plan is served by
    // section in file order, so the baseline (#3) is next — never gated, never held by itself
    const L = rd(hm.f.dir, "tasks.md").split("\n");
    const at = L.indexOf(LEAD), end = L.indexOf(MAIN);
    const moved = [...L.slice(0, L.indexOf("### Setup")), ...L.slice(at, end), "## Build", "", ...L.slice(L.indexOf("### Setup"), at), ...L.slice(end)];
    fs.writeFileSync(path.join(hm.f.dir, "tasks.md"), moved.join("\n"));
    const okHm = S.approvePhase(hm.p, hm.slug, "tasks", "t");
    const ntHm = S.nextTask(hm.p, hm.slug, { batch: true }), rmHm = S.addTrack(hm.p, hm.slug, "port", { remove: true });
    const leftHm = S.statusFeature(hm.p, hm.slug).tasks, ntRm = S.nextTask(hm.p, hm.slug);
    const named = ["en", "pt", "es"].filter((l) => { const t = S.msg(l).port.baselineLate("#1", 2); return !(t.includes("## …") && /level-2|nível 2|nivel 2/.test(t) && /their numbers|seus números|sus números/.test(t) && !/renumber|renumerad/i.test(t)); });
    // a built-in scaffold, filled, at every size, with and without +tdd: the baseline first — no baselineLate
    const builtIn = [];
    for (const size of ["s", "m", "l"]) for (const tr of [["port"], ["tdd", "port"]]) {
      const p = path.join(tmp, "p36g-builtin-" + size + "-" + tr.length);
      S.initProject(p, ["core"], "en");
      handRoadmap(p);
      const f = S.createFeature(p, "Port fixture", tr, "", undefined, "en", undefined, { size });
      fill(f.dir, ["classification.md", "requirements.md", "design.md", "tasks.md"]);
      const pv = chk(S.specDoctor(p, f.slug), "port-verify");
      if (pv.status === "fail" || /listed before the baseline/.test(pv.detail || "")) builtIn.push([size, tr.join("+"), pv]);
    }
    // 1.36 review 3 (PF3-1): add_track +port right after create — tasks.md still the built-in scaffold nobody wrote — puts the baseline's section
    // before the first task section at every size, with and without +tdd, in PT / ES too: filled in place, no baselineLate, the tasks approval
    // passes (no force) and next_task serves the baseline
    const added = [];
    for (const [lang, size, tr] of [["en", "s", "core"], ["en", "s", "tdd"], ["en", "m", "core"], ["en", "m", "tdd"], ["en", "l", "core"], ["en", "l", "tdd"],
      ["pt", "m", "core"], ["pt", "m", "tdd"], ["es", "m", "core"], ["es", "m", "tdd"]]) {
      const p = path.join(tmp, "p36g-added-" + lang + "-" + size + "-" + tr);
      S.initProject(p, ["core"], lang);
      handRoadmap(p);
      const f = S.createFeature(p, "Port fixture", [tr], "", undefined, lang, undefined, { size });
      const before = S.statusFeature(p, f.slug).tasks.total;
      const a = S.addTrack(p, f.slug, "port");
      fill(f.dir, ["classification.md", "requirements.md", "design.md", "test-plan.md", "tasks.md"]);
      const pv = chk(S.specDoctor(p, f.slug), "port-verify");
      approveBefore(p, f.slug, "tasks");
      const ap = S.approvePhase(p, f.slug, "tasks", "t"), nt = S.nextTask(p, f.slug);
      if (!a.ok || pv.status === "fail" || String(pv.detail).includes(S.msg(lang).port.baselineLate("#1", 2).split(" (")[0]) || !ap.ok || ap.forced || !nt.next || nt.next.number !== before + 1) {
        added.push([lang, size, tr, a.ok, pv, ap.failing, nt.next]);
      }
    }
    all("1.36 review 2 (P2-1) + review 3 (PF3-1, PF3-2) + review 4 (PF4-1): Kiro's and a ###-only template at size m — the tasks approval refuses the plan on port-verify alone, naming the move (baselineLate: the baseline's section first, the template's tasks under a level-2 heading of their own, keeping their numbers — never renumbered — EN / PT / ES), doctor fails it and next_action names it; approved anyway, a warn (approved already); that move made with the numbers kept, approved, the baseline (#3) served first — no gated, no heldBy, a batch of itself —, and removing +port leaves the template's tasks active (#1, #2); at s a warn and the approval passes; a built-in scaffold never trips it, nor add_track +port on one nobody wrote (got " +
      js([refK.failing, refK.checks, refH.failing, pvK, okKs.ok, okHs.ok, pvKs, pvHs, pvKa, okHm.ok, okHm.failing, ntHm.next, rmHm.ok, leftHm, ntRm.next, named, builtIn, added]) + ")", [
      () => !refK.ok && js(refK.failing) === '["port-verify"]' && (refK.checks || []).some((c) => c.id === "port-verify" && c.detail === lateK),
      () => !refH.ok && js(refH.failing) === '["port-verify"]' && (refH.checks || []).some((c) => c.id === "port-verify" && c.detail === lateH),
      () => pvK.status === "fail" && pvK.detail === lateK, () => naK.step === "fix" && naK.recommendation.includes(lateK),
      () => pvKa.status === "warn" && pvKa.detail === lateK + " " + P.approvedAlready,
      () => okHm.ok && !okHm.forced, () => named.length === 0,
      () => ntHm.next && ntHm.next.number === 3 && ntHm.gated === undefined && ntHm.heldBy === undefined && js((ntHm.batch || []).map((x) => x.number)) === "[3]",
      () => rmHm.ok && leftHm.total === 2 && js(leftHm.list.map((x) => x.number)) === "[1,2]" && ntRm.next && ntRm.next.number === 1,
      () => okKs.ok && !okKs.forced && okHs.ok && !okHs.forced, () => pvKs.status === "warn" && pvKs.detail === lateK, () => pvHs.status === "warn" && pvHs.detail === lateH,
      () => !builtIn.length, () => !added.length,
    ]);
  }

  { // 1.36 review 2 (P2-4): no task under the differential check's heading cites a [PORT] criterion — its first task (here a prep task) is taken
    // for the check (the fallback order unchanged): port-verify warns, naming it
    const PREP = `# Tasks: Prep\n\n${LEAD}\n- [ ] 1. [US1] Record the baseline\n  - _Requirements: US-1.AC-36, US-1.AC-37_\n  - _Verify: node verify-1.js_\n\n` +
      "## Story US-1 (P1 — MVP)\n- [ ] 2. [US1] Port the reader\n  - _Requirements: US-1.AC-1_\n  - _Verify: node verify-2.js_\n\n" +
      `${MAIN}\n- [ ] 3. [US1] Write the comparison harness\n  - _Requirements: US-1.AC-2_\n  - _Verify: node verify-3.js_\n` +
      "- [ ] 4. [US1] Differential check over the corpus\n  - _Requirements: US-1.AC-1_\n  - _Verify: node verify-4.js_\n\n" +
      "## Story US-2 (P2)\n- [ ] 5. [US2] Clearer errors\n  - _Requirements: US-2.AC-1_\n  - _Verify: node verify-5.js_\n";
    const x = mk("d-uncited", { tasks: PREP });
    const pv = chk(S.specDoctor(x.p, x.slug), "port-verify");
    ok(pv.status === "warn" && pv.detail === P.dUncited(3),
      "1.36 review 2 (P2-4): no task under the differential check's heading cites a [PORT] criterion — port-verify warns that its first task (3) is taken for the check (got " + js(pv) + ")");
  }
};
