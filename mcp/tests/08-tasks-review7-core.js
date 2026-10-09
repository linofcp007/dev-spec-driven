"use strict";
// Tasks — 1.25.1 review 7 (engine core): a track's tasks numbered after a removed task's leftover evidence, mistyped / quoted / other-box task lines named (never swallowed), setext phase headings.
// (08-tasks.js holds the tasks area's earlier tests; this file the engine-core findings of the seventh review.)

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, all, S, tmp, require }) => {
  const js = JSON.stringify;
  const E = require("./lib/engine/index.js");
  const REQ = "# Feature: x\n\n## Summary\nExport invoices as CSV.\n\n### US-1 (P1 — MVP): Export\n#### Acceptance Criteria (EARS)\n" +
    "1. **US-1.AC-1** — WHEN an admin clicks Export THE SYSTEM SHALL download a CSV.\n2. **US-1.AC-2** — IF the export fails THEN THE SYSTEM SHALL show the error code.\n\n" +
    "## Success Criteria\n- **SC-001** — 95% of exports finish in under 5 s.\n\n## Out of Scope\n- PDF export.\n";
  const TASKS = "# Tasks\n\n## Phase 1\n- [ ] 1. [US1] Build the export\n  - _Requirements: US-1.AC-1_\n  - _Verify: node -e \"process.exit(0)\"_\n" +
    "- [ ] 2. [US1] Show the error code\n  - _Requirements: US-1.AC-2_\n  - _Verify: node -e \"process.exit(0)\"_\n";

  // Finding 2 — a track's template tasks (spec_add_track; a track pack's block too) were numbered after tasks.md's last task only:
  // a task removed from tasks.md left its evidence / tick under its number, and the track's first new task took that number —
  // ticked by hand, it read verified on the removed task's run. spec_append_tasks already skipped those numbers; now both ask
  // nextTaskNumber (tasks.md + the state's evidence and ticks).
  {
    const p = path.join(tmp, "proj-r7t-tracknum");
    S.initProject(p, ["core"], "en");
    const f = S.createFeature(p, "Export", ["core"]);
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
    fs.writeFileSync(path.join(f.dir, "tasks.md"), TASKS);
    const c2 = S.completeTask(p, f.slug, 2, { command: "node -e \"process.exit(0)\"", exitCode: 0 });
    const tp = path.join(f.dir, "tasks.md");
    fs.writeFileSync(tp, fs.readFileSync(tp, "utf8").replace(/- \[x\] 2\.[\s\S]*$/, "")); // task 2 descoped: its record stays
    const add = S.addTrack(p, f.slug, ["sec"]);
    const nums = S.taskBlocks(fs.readFileSync(tp, "utf8")).map((b) => b.number);
    const unit = [E.nextTaskNumber("- [ ] 1. a\n- [ ] 4. b\n", { evidence: { 7: {} }, ticks: { 9: "x" } }), E.nextTaskNumber("- [ ] 1. a\n", null),
      E.nextTaskNumber("", { evidence: { abc: {}, 3: {} } })];
    ok(c2.ok && add.ok && nums[0] === 1 && !nums.includes(2) && nums[1] === 3 && js(unit) === "[10,2,4]",
      "1.25.1 review 7: spec_add_track numbers the track's tasks after a removed task's leftover evidence / tick (task 2's number is never reused); nextTaskNumber = max(tasks.md, evidence, ticks) + 1 (got " +
      js([c2.ok, add.ok, nums, unit]) + ")");
  }

  // Finding 5 — right under `- [ ] 1. A`, a mistyped task line (`- [ ] 2 B`, `- [ ] 2) B`, `- [~] 2. B`) was read as task 1's BODY
  // (its markers included) and doctor's unread-tasks stayed silent; `- [-] 2.` after a blank line and a quoted `> - [ ] 1.` were
  // skipped silently. A checkbox item at the task's own indentation is a sibling, never body; any one-character box and a quoted one
  // are named by unread-tasks. A sub-step checkbox (deeper) stays the task's body.
  {
    const head = "# Tasks\n\n## Phase 1\n- [ ] 1. Build parser\n";
    const cases = {
      noDot: head + "- [ ] 2 Build lexer\n  - _Verify: rm -rf build_\n- [ ] 3. Wire it\n",
      paren: head + "- [ ] 2) Build lexer\n- [ ] 3. Wire it\n",
      tilde: head + "- [~] 2. Build lexer (in progress)\n- [ ] 3. Wire it\n",
      dash: head + "\n- [-] 2. Build lexer (cancelled?)\n\n- [ ] 3. Wire it\n",
      quoted: "# Tasks\n\n> - [ ] 1. Quoted task\n\n- [ ] 2. Real\n",
    };
    const got = {};
    for (const [k, t] of Object.entries(cases)) {
      const b = S.taskBlocks(t);
      got[k] = { nums: b.map((x) => x.number), body1: (b[0] || {}).body, unread: E.unreadTaskLines(t).map((u) => u.line) };
    }
    const sub = head + "  - [ ] write the grammar first\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 2. Wire it\n";
    const subB = S.taskBlocks(sub);
    const link = "# Tasks\n\n- [ ] 1. A\n\n- [a](https://example.com) a link, no box\n";
    const p = path.join(tmp, "proj-r7t-unread");
    S.initProject(p, ["core"], "en");
    const f = S.createFeature(p, "Parser", ["core"]);
    fs.writeFileSync(path.join(f.dir, "tasks.md"), cases.noDot);
    const doc = (S.specDoctor(p, f.slug).checks.find((c) => c.id === "unread-tasks") || {});
    all("1.25.1 review 7: a mistyped task line under a task (`- [ ] 2 B`, `2)`, `[~]`) is no longer its body — doctor's unread-tasks names it, like `- [-] 2.` and a quoted `> - [ ] 1.`; a deeper sub-step checkbox stays the task's body; a link is no box (got " +
      js([got, subB[0].body, doc.status, doc.detail]) + ")", [
      () => js(got.noDot.nums) === "[1,3]", () => js(got.noDot.body1) === "[]", () => js(got.noDot.unread) === "[5]",
      () => js(got.paren.body1) === "[]", () => js(got.paren.unread) === "[5]", () => js(got.tilde.body1) === "[]",
      () => js(got.tilde.unread) === "[5]", () => js(got.dash.unread) === "[6]", () => js(got.quoted.nums) === "[2]",
      () => js(got.quoted.unread) === "[3]",
      () => js(subB[0].body) === js(["- [ ] write the grammar first", "- _Verify: node -e \"process.exit(0)\"_"]),
      () => js(E.unreadTaskLines(sub)) === "[]", () => js(E.unreadTaskLines(link)) === "[]", () => doc.status === "warn",
      () => /L5 `- \[ \] 2 Build lexer`/.test(doc.detail || ""),
    ]);
  }

  // Finding 7 — the scanner read ATX phase headings only while activeTasks and the section readers read setext ones too: every task's
  // phase was null, so taskSchedule (sections first, then numbers) served task 3 of "Phase B" before task 5 of "Phase A", and
  // spec_append_tasks never found a setext phase (it opened a second "## Phase A").
  {
    const setext = "Phase A\n=======\n\n- [x] 1. A\n- [ ] 5. A-late (appended)\n\nPhase B\n-------\n\n- [ ] 3. C\n";
    const b = S.taskBlocks(setext);
    const next = S.taskSchedule(b).next;
    const p = path.join(tmp, "proj-r7t-setext");
    S.initProject(p, ["core"], "en");
    const f = S.createFeature(p, "Setext", ["core"]);
    const tp = path.join(f.dir, "tasks.md");
    fs.writeFileSync(tp, "# Tasks\n\nPhase A\n-------\n\n- [ ] 1. A\n\nPhase B\n-------\n\n- [ ] 2. B\n");
    const ap = S.appendTasks(p, f.slug, [{ text: "A again" }], { heading: "Phase A" });
    const after = fs.readFileSync(tp, "utf8");
    const ab = S.taskBlocks(after);
    // an empty setext phase: the new task lands under its underline, never between the heading's text and its underline
    fs.writeFileSync(tp, "# Tasks\n\nPhase C\n-------\n\nPhase D\n-------\n\n- [ ] 1. D\n");
    const ap2 = S.appendTasks(p, f.slug, [{ text: "C first" }], { heading: "Phase C" });
    const after2 = fs.readFileSync(tp, "utf8");
    ok(js(b.map((x) => x.phase)) === '["Phase A","Phase A","Phase B"]' && next && next.number === 5 &&
      ap.ok && ap.heading === "Phase A" && ap.headingCreated === false && (after.match(/Phase A/g) || []).length === 1 &&
      js(ab.map((x) => [x.number, x.phase])) === '[[1,"Phase A"],[3,"Phase A"],[2,"Phase B"]]' &&
      ap2.ok && ap2.headingCreated === false && /Phase C\n-------\n- \[ \] 2\. C first\n/.test(after2) && js(S.taskBlocks(after2).map((x) => [x.number, x.phase])) === '[[2,"Phase C"],[1,"Phase D"]]',
      "1.25.1 review 7: setext phase headings are phases to the task scanner (taskSchedule serves Phase A's open task first) and to spec_append_tasks (it appends into the setext phase, under its underline) (got " +
      js([b.map((x) => x.phase), next && next.number, ap.ok, ap.error, ap.headingCreated, ab.map((x) => [x.number, x.phase]), ap2.ok, ap2.error, after2]) + ")");
  }
};
