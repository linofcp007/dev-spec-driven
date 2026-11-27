"use strict";
// Tasks — the plan's approval at the task surfaces (1.42 UX-02): planApproved / planNote on next_task, the brief and status, beforeApproval on a tick, a bugfix's investigation task exempt, the pending-gates property, the cost as counts.

const fs = require("fs");
const path = require("path");

// UX-02 A (CRITIQUE-GATES): spec_next_task, spec_task_brief and spec_complete_task read no approval — an agent was served and
// ticked the scaffold's template tasks before the plan existed. While the plan (phase `tasks`; a change's change.md) is not
// approved, the results say so: planApproved: false (stable), planNote (its own key — never `note`, the evidence channel) when a
// task is served or ticked, beforeApproval on a tick. Never a refusal. A bugfix's investigation task (it names bug.md, runs
// nothing, carries no _Makes green:_ / _Verify:_ — the four-task scaffold of ≤ 1.23.0 ticks 1 and 2 before the tasks approval,
// references/bugfix.md says so) carries no planNote. An approved plan's results are the parent's (the keys absent, not true).
// Mutations listed before the fixtures: A1 planApproved always true · A2 a waiting role sign-off counts · A3 the spike exemption
// dropped · A4 the key emitted on an approved plan · A5 the investigation exemption dropped · A6 the exemption widened to every
// bugfix task · A7 the exemption keyed on the legacy step names · A8 planNote with no task served · A9 planNote appended to
// `note` · A10 planNote on an alreadyDone re-check · A11 an isRecord test instead of the pending-gates truthiness · A12 planNote in
// the brief's markdown · A13 planNote on a done briefed task · A14 status without the fields · A15 a memo of the exemption keyed
// on the task text alone ([INT-1]: features with identical tasks.md may share one scan's blocks) · A16 a read in planGateFields.
exports.run = async ({ all, eq, S, tmp, fsCalls, handRoadmap, planGateMismatches, require, __dirname }) => {
  const js = JSON.stringify;
  const E = require("./lib/engine/index.js");
  const PG = (l) => S.msg(l).planGate;
  const NEW = ["planApproved", "planNote", "beforeApproval"];
  const newKeys = (r) => NEW.filter((k) => r && Object.prototype.hasOwnProperty.call(r, k));
  const project = (n, lang = "en", opts) => { const p = path.join(tmp, "proj-plan-" + n); S.initProject(p, ["core"], lang, opts); return p; };
  const put = (dir, rel, text) => fs.writeFileSync(path.join(dir, rel), text);
  const state = (dir) => JSON.parse(fs.readFileSync(path.join(dir, ".state.json"), "utf8"));
  const setState = (dir, fn) => { const s = state(dir); fn(s); fs.writeFileSync(path.join(dir, ".state.json"), JSON.stringify(s, null, 2)); };
  // The four-task bugfix scaffold every bugfix got until 1.23.0 (i18n bugTasks, en, no size) — the engine's own past output,
  // verbatim but for the two _Verify:_ slots filled. Tasks 1 and 2 are the investigation steps.
  const LEGACY_BUG_TASKS = "# Tasks: Login crash\n\n<!-- Bugfix order is fixed: reproduce → root cause → failing regression test → fix → verify.\n" +
    "     No fix before bug.md → Root Cause is filled with evidence. -->\n\n## Global Constraints\n- Node 20\n\n## Phase: Fix\n" +
    "- [ ] 1. [shared] Reproduce the bug reliably and write the steps in bug.md → Reproduction\n  - _Requirements: US-1.AC-1_\n" +
    "- [ ] 2. [shared] Find the root cause with evidence; fill bug.md → Root Cause (no fix yet)\n  - _Requirements: US-1.AC-1_\n" +
    "- [ ] 3. [US1] Write regression test T-01 and watch it fail for the right reason (paste the output); add guard test T-02 (it passes already)\n" +
    "  - _Requirements: US-1.AC-1_\n  - _Verify: node --test test/login.test.js_\n  - _Expect: fail_\n" +
    "- [ ] 4. [US1] Fix the root cause — one change, not a bundle; guard test T-02 stays green\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n" +
    "  - _Makes green: T-01_\n  - _Verify: node --test test/_\n**Checkpoint:** the bug no longer reproduces and the full suite is green.\n";
  const BUG = "# Bug: Login crash\n\n## Summary\nLogin crashes on an empty password.\n\n## Reproduction\n1. Open /login\n2. Submit with an empty password\n" +
    "3. The server answers 500 with TypeError.\n\n## Expected vs Actual\n- **Expected:** a validation error\n- **Actual:** TypeError: cannot read properties of undefined\n\n" +
    "## Root Cause\nauth.js:42 reads password.length before the null check (stack trace: TypeError at auth.js:42).\n\n## Fix\nMove the null check before the length read.\n";
  const legacyBugfix = (p, name) => { const f = S.createFeature(p, name, ["core"], "Login crashes on an empty password", undefined, "en", "bugfix"); put(f.dir, "tasks.md", LEGACY_BUG_TASKS); put(f.dir, "bug.md", BUG); return f; };

  // F1 — the research probe's project: a 3-file Node repo (greet() and one node --test) and an xs change, greet-empty-name, its
  // change.md written for real. Unapproved: next / brief / status carry planApproved: false and the planNote naming change.md; the
  // tick carries beforeApproval and the tick's planNote (never in `note`); a re-check of the ticked task and a brief of the done task
  // carry no planNote. Approved: none of the keys.
  {
    const p = project("greet");
    handRoadmap(p);
    fs.mkdirSync(path.join(p, "src"));
    fs.mkdirSync(path.join(p, "test"));
    put(p, "package.json", js({ name: "greet", private: true, scripts: { test: "node --test test/" } }, null, 2) + "\n");
    put(p, "src/greet.js", "exports.greet = (name) => \"Hello, \" + name;\n");
    put(p, "test/greet.test.js", "const test = require(\"node:test\");\nconst assert = require(\"node:assert\");\nconst { greet } = require(\"../src/greet.js\");\n" +
      "test(\"greets by name\", () => assert.strictEqual(greet(\"Ann\"), \"Hello, Ann\"));\n");
    const f = S.createFeature(p, "greet-empty-name", ["core"], "greet('') says Hello, stranger", undefined, "en", undefined, { size: "xs" });
    put(f.dir, "change.md", "# Change: greet-empty-name\n\n## Summary\ngreet('') printed \"Hello, \" — it should greet a stranger.\n\n## Acceptance Criteria (EARS)\n" +
      "1. **US-1.AC-1** — WHEN greet is called with an empty name THE SYSTEM SHALL return \"Hello, stranger\"\n\n## Approach\nOne guard in src/greet.js; nothing else reads the name.\n\n" +
      "## Tasks\n- [ ] 1. [US1] Return \"Hello, stranger\" for an empty name\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/greet.js_\n  - _Verify: node --test test/_\n");
    const note = PG("en").notApproved(f.slug, "change.md");
    const nx = S.nextTask(p, f.slug), br = S.taskBrief(p, f.slug, 1), stt = S.statusFeature(p, f.slug).tasks;
    const tick = S.completeTask(p, f.slug, 1, { command: "node --test test/", exitCode: 0, summary: "tests 1\npass 1\nfail 0" });
    const again = S.completeTask(p, f.slug, 1, { command: "node --test test/", exitCode: 0, summary: "tests 1\npass 1\nfail 0" });
    const brDone = S.taskBrief(p, f.slug, 1);
    all("1.42 UX-02 (F1): an xs change's plan not approved — next / brief / status say planApproved: false with the planNote naming change.md; the tick says beforeApproval with its own planNote (note untouched); a re-check and a done task's brief carry none (got " +
      js([nx, newKeys(br), stt.planApproved, stt.planNote, tick, again, newKeys(brDone)]) + ")", {
      "next: planApproved false": nx.ok && nx.next && nx.next.number === 1 && nx.planApproved === false,
      "next: planNote is the entry (change.md)": nx.planNote === note, "next: note untouched": nx.note === undefined,
      "brief: planApproved false + planNote": br.ok && br.planApproved === false && br.planNote === note,
      "brief: its markdown is unchanged (A12)": typeof br.brief === "string" && !br.brief.includes(note) && !/not approved yet/.test(br.brief),
      "status: tasks.planApproved false + planNote": stt.planApproved === false && stt.planNote === note,
      "tick: ticked, beforeApproval": tick.ok && tick.completed === 1 && tick.alreadyDone === false && tick.beforeApproval === true,
      "tick: its planNote is tickedEarly": tick.planNote === PG("en").tickedEarly(1, f.slug), "tick: note untouched (A9)": tick.note === undefined,
      "re-check: no beforeApproval / planNote (A10)": again.ok && again.alreadyDone === true && newKeys(again).length === 0,
      "done task's brief: planApproved false, no planNote (A13)": brDone.ok && brDone.task.done && brDone.planApproved === false && brDone.planNote === undefined,
    });
    // the plan approved (its own gate: a change's change.md) — every surface as the parent answers: no key, not `true` (A4)
    const ap = S.approvePhase(p, f.slug, "tasks", "alice");
    const un = S.completeTask(p, { name: f.slug, number: 1, undo: true });
    const nx2 = S.nextTask(p, f.slug), br2 = S.taskBrief(p, f.slug), st2 = S.statusFeature(p, f.slug).tasks;
    const tick2 = S.completeTask(p, f.slug, 1, { command: "node --test test/", exitCode: 0, summary: "tests 1\npass 1\nfail 0" });
    all("1.42 UX-02 (F1): once the change's plan is approved, next / brief / status / the tick carry none of planApproved / planNote / beforeApproval (got " +
      js([ap.ok, ap.failing, un.ok, newKeys(nx2), newKeys(br2), newKeys(st2), newKeys(tick2)]) + ")", {
      "approved": ap.ok === true, "unticked": un.ok === true, "next served #1": !!nx2.next && nx2.next.number === 1, "next": newKeys(nx2).length === 0,
      "brief": br2.ok && br2.task && newKeys(br2).length === 0, "status": newKeys(st2).length === 0, "tick": tick2.ok && newKeys(tick2).length === 0,
    });
  }

  // F2 — a bugfix scaffolded with four tasks (≤ 1.23.0), bug.md filled, nothing approved: tasks 1 and 2 (reproduce, root cause —
  // they name bug.md, run nothing) carry no planNote, served or ticked (beforeApproval stays a fact); task 3 (the red test) and 4 (the
  // fix) carry it (A5, A6). A user-written PT investigation task naming bug.md is one too — no name list (A7).
  {
    const p = project("legacy-bug");
    handRoadmap(p);
    const f = legacyBugfix(p, "Login crash");
    const n1 = S.nextTask(p, f.slug), b = [1, 2, 3, 4].map((n) => S.taskBrief(p, f.slug, n));
    const t1 = S.completeTask(p, f.slug, 1, "steps written in bug.md → Reproduction");
    const t2 = S.completeTask(p, f.slug, 2, "root cause written in bug.md → Root Cause");
    const n3 = S.nextTask(p, f.slug);
    const pt = project("legacy-bug-pt", "pt");
    handRoadmap(pt);
    const fp = S.createFeature(pt, "Falha no login", ["core"], "O login falha com a palavra-passe vazia", undefined, "pt", "bugfix");
    put(fp.dir, "tasks.md", "# Tarefas\n\n## Fase: Correção\n- [ ] 1. [shared] Escrever a causa raiz em bug.md, com a evidência\n  - _Requirements: US-1.AC-1_\n" +
      "- [ ] 2. [US1] Corrigir a causa raiz\n  - _Requirements: US-1.AC-1_\n  - _Verify: node --test test/_\n");
    const pn1 = S.nextTask(pt, fp.slug), pb2 = S.taskBrief(pt, fp.slug, 2);
    all("1.42 UX-02 (F2): a four-task bugfix before the tasks approval — its investigation tasks 1 / 2 carry no planNote (served, briefed or ticked; beforeApproval still says the tick came first), tasks 3 / 4 carry it; a user-written PT task naming bug.md is exempt too (got " +
      js([n1, b.map(newKeys), t1, t2, n3, pn1, newKeys(pb2)]) + ")", {
      "next #1: planApproved false, no planNote (A5)": n1.next && n1.next.number === 1 && n1.planApproved === false && n1.planNote === undefined,
      "brief #1 / #2: no planNote": b[0].planApproved === false && b[0].planNote === undefined && b[1].planApproved === false && b[1].planNote === undefined,
      "brief #3 / #4: planNote (A6)": b[2].planNote === PG("en").notApproved(f.slug, "tasks.md") && b[3].planNote === PG("en").notApproved(f.slug, "tasks.md"),
      "tick #1 / #2: beforeApproval, no planNote": t1.ok && t1.beforeApproval === true && t1.planNote === undefined && t2.ok && t2.beforeApproval === true && t2.planNote === undefined,
      "next #3: planNote": n3.next && n3.next.number === 3 && n3.planNote === PG("en").notApproved(f.slug, "tasks.md"),
      "PT: a user-written investigation task is exempt (A7)": pn1.next && pn1.next.number === 1 && pn1.planApproved === false && pn1.planNote === undefined,
      "PT: its fix carries the PT planNote": pb2.planNote === PG("pt").notApproved(fp.slug, "tasks.md"),
    });
  }

  // F3 — a fresh short-form bugfix (the current scaffold: 1 the red test, 2 the fix), in en / pt / pt-BR / es, no size and xs: no
  // built-in bugfix task is an investigation task — next and every brief carry the planNote, in the feature's language (A6).
  {
    const got = [];
    for (const lang of ["en", "pt", "pt-BR", "es"]) {
      for (const size of [undefined, "xs"]) {
        const p = project("short-" + lang.toLowerCase() + "-" + (size || "none"), lang);
        handRoadmap(p);
        const f = S.createFeature(p, "Login crash " + lang, ["core"], "Login crashes", undefined, lang, "bugfix", size ? { size } : {});
        const note = PG(lang).notApproved(f.slug, "tasks.md");
        const nx = S.nextTask(p, f.slug);
        const tasks = S.statusFeature(p, f.slug).tasks.list.map((t) => t.number);
        got.push({ lang, size, n: tasks.length, next: nx.planNote === note, briefs: tasks.every((n) => S.taskBrief(p, f.slug, n).planNote === note) });
      }
    }
    all("1.42 UX-02 (F3): a fresh short-form bugfix's tasks all carry the planNote before the approval — en / pt / pt-BR / es, no size and xs (got " + js(got) + ")",
      Object.fromEntries(got.map((g) => [g.lang + "/" + (g.size || "none"), g.n === 2 && g.next && g.briefs])));
  }

  // F4 roles (tasks: product + tech; only product signed: no approvals.tasks — A2) · F5 a spike (no plan gate — A3) · F6 an imported
  // Kiro spec whose every task is done (no task served: planApproved: false, no planNote — A8; status and the default brief alike).
  {
    const pr = project("roles", "en", { approvalRoles: { tasks: ["product", "tech"] } });
    handRoadmap(pr);
    const fr = S.createFeature(pr, "Roles", ["core"]);
    const signed = S.approvePhase(pr, fr.slug, "tasks", "pat", { force: true, role: "product" });
    const stR = S.readState(pr, fr.slug);
    const nR = S.nextTask(pr, fr.slug);
    const ps = project("spike");
    handRoadmap(ps);
    const fs5 = S.createFeature(ps, "Queue spike", undefined, "Can the queue keep up?", undefined, "en", "spike");
    const nS = S.nextTask(ps, fs5.slug), bS = S.taskBrief(ps, fs5.slug), tS = S.completeTask(ps, fs5.slug, 1, "measured: 3k msg/s");
    const pk = project("kiro");
    handRoadmap(pk);
    const k = (rel, text) => { fs.mkdirSync(path.dirname(path.join(pk, rel)), { recursive: true }); fs.writeFileSync(path.join(pk, rel), text); };
    k(".kiro/specs/user-auth/requirements.md", "# Requirements Document\n\n## Introduction\n\nUsers sign in with email and password.\n\n## Requirements\n\n### Requirement 1\n\n" +
      "**User Story:** As a user, I want to sign in with my email, so that I can reach my account.\n\n#### Acceptance Criteria\n\n" +
      "1. WHEN a user submits valid credentials THEN the system SHALL create a session\n2. IF the password is wrong THEN the system SHALL show an error and keep the form\n");
    k(".kiro/specs/user-auth/design.md", "# Design Document\n\n## Overview\nSession cookies, bcrypt.\n");
    k(".kiro/specs/user-auth/tasks.md", "# Implementation Plan\n\n- [x] 1. Set up the auth module\n  - _Requirements: 1.1_\n\n- [x] 2. Implement sign-in\n  - _Requirements: 1.1, 1.2_\n");
    const imp = S.importSpec(pk, "kiro", ".kiro/specs/user-auth");
    const nK = imp.ok ? S.nextTask(pk, imp.feature) : {}, sK = imp.ok ? S.statusFeature(pk, imp.feature).tasks : {}, bK = imp.ok ? S.taskBrief(pk, imp.feature) : {};
    all("1.42 UX-02 (F4–F6): a waiting role sign-off is no approval; a spike has no plan gate (no key on next / brief / a tick); an imported all-done feature serves no task — planApproved: false and no planNote on next, status and the brief (got " +
      js([signed.ok, signed.partial, Object.keys(stR.approvals), nR.planApproved, newKeys(nS), newKeys(bS), newKeys(tS), imp.ok, nK, newKeys(sK), newKeys(bK)]) + ")", {
      "F4 precondition: product signed, no approvals.tasks": signed.ok && !stR.approvals.tasks && !!stR.signoffs,
      "F4: planApproved false + planNote (A2)": nR.planApproved === false && nR.planNote === PG("en").notApproved(fr.slug, "tasks.md"),
      "F5: spike next / brief / tick carry no key (A3)": nS.ok && !!nS.next && newKeys(nS).length === 0 && bS.ok && !!bS.task && newKeys(bS).length === 0 && tS.ok && newKeys(tS).length === 0,
      "F6: imported, every task done": imp.ok === true && nK.ok && nK.next === null && nK.remaining === 0,
      "F6: next planApproved false, no planNote (A8)": nK.planApproved === false && nK.planNote === undefined,
      "F6: status tasks.planApproved false, no planNote": sK.planApproved === false && sK.planNote === undefined,
      "F6: the default brief: no task, planApproved false, no planNote": bK.ok && bK.task === null && bK.planApproved === false && bK.planNote === undefined,
    });
  }

  // F7 — the demo's api-keys (every plan phase approved): next / brief / status / a tick answer as the parent does — none of the keys.
  {
    const p = path.join(tmp, "proj-plan-demo");
    fs.cpSync(path.join(__dirname, "..", "examples", "demo-project"), p, { recursive: true });
    const nx = S.nextTask(p, "api-keys"), br = S.taskBrief(p, "api-keys"), stt = S.statusFeature(p, "api-keys").tasks;
    const tk = S.completeTask(p, "api-keys", nx.next ? nx.next.number : 1, "recorded the red run by hand");
    all("1.42 UX-02 (F7): the demo's approved api-keys — next, the brief, status and a tick carry none of planApproved / planNote / beforeApproval (got " +
      js([newKeys(nx), newKeys(br), newKeys(stt), newKeys(tk)]) + ")", {
      "next": nx.ok && !!nx.next && newKeys(nx).length === 0, "brief": br.ok && !!br.task && newKeys(br).length === 0,
      "status": newKeys(stt).length === 0, "tick": tk.ok && newKeys(tk).length === 0,
    });
  }

  // [INT-1] — a bugfix and a plain feature with byte-identical tasks.md (the four-task text): the exemption is the bugfix's alone. A
  // memo of the answer by the task's text (DS-PERF's perf-2 shares one scan's blocks between such features) would carry the bugfix's
  // answer to the plain feature, or the reverse (A15).
  {
    const p = project("twins-int1");
    handRoadmap(p);
    const fb = legacyBugfix(p, "Login crash");
    const ff = S.createFeature(p, "Login crash plain", ["core"]);
    put(ff.dir, "tasks.md", LEGACY_BUG_TASKS);
    const nb = S.nextTask(p, fb.slug), nf = S.nextTask(p, ff.slug), nb2 = S.nextTask(p, fb.slug);
    all("1.42 UX-02 [INT-1]: byte-identical tasks.md — the bugfix's investigation task #1 carries no planNote, the plain feature's same-text #1 does, either order (got " +
      js([nb, nf, nb2]) + ")", {
      "bugfix #1: no planNote": nb.next && nb.next.number === 1 && nb.planApproved === false && nb.planNote === undefined,
      "plain #1: planNote": nf.next && nf.next.number === 1 && nf.planNote === PG("en").notApproved(ff.slug, "tasks.md"),
      "bugfix again: still none": nb2.planNote === undefined,
    });
  }

  // The property: spec_next_task's planApproved IS the pending-gates rule (gates.js pendingGateList reads phase tasks by truthiness;
  // approvalsInForce strips only `tests`) — on every fixture of this file, plus the shapes where a second predicate would differ: a
  // hand-written approvals.tasks string (A11), a malformed evidence beside a valid approval (stateFromFile keeps the valid parts —
  // no false note), unparseable JSON (no approvals: not approved), a revoked approval, a design-first flow, a stale +tdd Phase 4
  // sign-off (tests pending, the plan approved).
  {
    const p = project("shapes");
    handRoadmap(p);
    const mk = (n, tracks = ["core"], o) => S.createFeature(p, n, tracks, "", undefined, "en", undefined, o || {});
    const str = mk("Approval string"); setState(str.dir, (s) => { s.approvals = { tasks: "yes" }; });
    const mal = mk("Bad evidence"); setState(mal.dir, (s) => { s.approvals = { tasks: { at: "2026-11-01T00:00:00.000Z", by: "t" } }; s.evidence = "broken"; });
    const bad = mk("Bad json"); fs.writeFileSync(path.join(bad.dir, ".state.json"), "{ not json");
    const rev = mk("Revoked"); S.approvePhase(p, rev.slug, "tasks", "t", { force: true }); S.approvePhase(p, rev.slug, "tasks", "t", { revoke: true });
    const dfst = mk("Design first", ["core"], { flow: "design-first" }); S.approvePhase(p, dfst.slug, "tasks", "t", { force: true });
    const tdd = mk("Stale tests", ["core", "tdd"]);
    for (const ph of ["classification", "requirements", "design", "test-plan", "tests", "tasks"]) S.approvePhase(p, tdd.slug, ph, "t", { force: true });
    fs.appendFileSync(path.join(tdd.dir, "test-plan.md"), "\n| T-99 | unit | example | a test planned after the sign-off | US-1.AC-1 | `test/x.test.js` |\n");
    const shapes = { str, mal, bad, rev, dfst, tdd };
    const view = Object.fromEntries(Object.entries(shapes).map(([k, f]) => [k, S.nextTask(p, f.slug).planApproved !== false]));
    const tddPending = S.specDoctor(p, tdd.slug).pendingGates || [];
    const prop = planGateMismatches(tmp);
    all("1.42 UX-02: next_task's planApproved equals 'phase tasks is not pending' (pendingGateList) and approvalsInForce keeps `tasks`, on every feature of this file (" +
      prop.checked + " checked; got " + js([view, tddPending, prop.mismatches]) + ")", {
      "a string approvals.tasks reads approved (A11)": view.str === true, "a malformed evidence beside a valid approval: approved": view.mal === true,
      "unparseable .state.json: not approved": view.bad === false, "revoked: not approved": view.rev === false, "design-first, approved": view.dfst === true,
      "stale Phase 4 sign-off: tests pending, the plan approved": tddPending.includes("tests") && view.tdd === true,
      "every fixture of this file checked": Object.values(shapes).every((f) => prop.dirs.includes(f.dir)) && prop.checked >= 20, "no mismatch": prop.mismatches.length === 0,
    });
  }

  // The cost, as counts: the plan fields read nothing (planGateFields over a state and a block the caller holds — A16), and next /
  // the brief / status / a tick make the same fs calls under the project for twin features whose only difference is the approval
  // (the note is built from what the call already read). The same calls on both sides — never a pinned total.
  {
    const p = project("cost");
    handRoadmap(p);
    const TASKS = "# Tasks\n\n## Phase: Core\n- [ ] 1. [US1] Build the export endpoint\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/export.js_\n" +
      "  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 2. [US1] Show the error code\n  - _Requirements: US-1.AC-1_\n";
    const twin = (n, approved) => {
      const f = S.createFeature(p, n, ["core"]);
      put(f.dir, "tasks.md", TASKS);
      if (approved) setState(f.dir, (s) => { s.approvals = { tasks: { at: "2026-11-01T00:00:00.000Z", by: "t" } }; });
      return f;
    };
    const fa = twin("Twin approved", true), fu = twin("Twin open", false);
    const under = p + path.sep;
    const sum = (c) => Object.values(c).reduce((a, b) => a + b, 0);
    // inside one call's read scope, as the surfaces run it: the state the caller read is all it reads (the file a change's tasks
    // live in comes from that same .state.json)
    let fields = null;
    S.withReadCache(() => { const st = E.readState(p, fu.slug), block = E.taskBlocks(TASKS)[0]; fields = fsCalls(under, () => E.planGateFields(st, block, fu.dir, fu.slug, "en")); });
    const ops = {
      next: (f) => S.nextTask(p, f.slug), brief: (f) => S.taskBrief(p, f.slug, 1), status: (f) => S.statusFeature(p, f.slug),
      tick: (f) => S.completeTask(p, f.slug, 2, "shown to the user"),
    };
    const counts = Object.fromEntries(Object.entries(ops).map(([k, op]) => [k, [js(fsCalls(under, () => op(fa))), js(fsCalls(under, () => op(fu)))]]));
    const r = S.nextTask(p, fu.slug);
    all("1.42 UX-02: the plan fields read nothing, and next / brief / status / a tick make the same fs calls with the plan approved and not (got " +
      js([fields, counts]) + ")", {
      "planGateFields: no fs call (A16)": sum(fields) === 0, "the open twin's next carries the note": r.planNote === PG("en").notApproved(fu.slug, "tasks.md"),
      ...Object.fromEntries(Object.entries(counts).map(([k, [a, u]]) => [k + ": the same calls", a === u && a !== "{}"])),
    });
  }
};
