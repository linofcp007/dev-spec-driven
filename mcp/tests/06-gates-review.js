"use strict";
// Gates — 1.24 review 6 regressions: phase order over a changed approved phase, the governance roadmap.json holds read fail closed, the bugfix design gate on bug.md.
// (06-gates.js holds the gates area's earlier tests; this file the findings of the sixth review of the gates, the state and the
// approvals.)

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, S, tmp }) => {
  const js = JSON.stringify;
  const fresh = (n, opts) => { const p = path.join(tmp, "proj-r6g-" + n); S.initProject(p, ["core"], "en", opts); return p; };
  const w = (f, rel, text) => fs.writeFileSync(path.join(f.dir, rel), text);
  const r = (f, rel) => fs.readFileSync(path.join(f.dir, rel), "utf8");
  const st = (f) => JSON.parse(r(f, ".state.json"));
  const REQ = "# Feature: x\n\n## Summary\nExport invoices as CSV.\n\n### US-1 (P1 — MVP): Export\n#### Acceptance Criteria (EARS)\n" +
    "1. **US-1.AC-1** — WHEN an admin clicks Export THE SYSTEM SHALL download a CSV.\n2. **US-1.AC-2** — WHILE an export runs, WHEN the admin clicks again THE SYSTEM SHALL ignore it.\n" +
    "3. **US-1.AC-3** — IF the export fails THEN THE SYSTEM SHALL show the error code.\n\n" +
    "## Success Criteria\n- **SC-001** — 95% of exports finish in under 5 s.\n\n## Out of Scope\n- PDF export.\n";
  const DESIGN = "# Design: x\n\n## Overview\nA nightly job and an endpoint.\n\n## Architecture\n```mermaid\ngraph TD\n  A-->B\n```\n\n## Constitution Check\n- [x] Principle 1 — complies\n\n" +
    "## Alternatives & Trade-offs\nChose a sync endpoint over a queue: simpler, enough for the volume.\n\n## Risks\nLarge months may be slow; mitigated by streaming.\n\n" +
    "## Reuse & Integration\n| Need | Reuse | Why |\n|---|---|---|\n| CSV | the existing csv writer | already tested |\n";
  const TASKS = "# Tasks\n\n- [ ] 1. [US1] Build the export endpoint\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Verify: node -e \"process.exit(0)\"_\n" +
    "- [ ] 2. [US1] Show the error code\n  - _Requirements: US-1.AC-3_\n  - _Verify: node -e \"process.exit(0)\"_\n";
  const CLASS = "# Classification\n\n## Active tracks\ncore\n\n## Why\nA small export feature with no special risk.\n";
  const feature = (p, name) => {
    const f = S.createFeature(p, name, ["core"]);
    w(f, "classification.md", CLASS); w(f, "requirements.md", REQ); w(f, "design.md", DESIGN); w(f, "tasks.md", TASKS);
    return f;
  };
  const check = (doc, id) => (doc.checks || []).find((c) => c.id === id) || null;

  // 1.24 r6 E1: an earlier phase whose approved CONTENT changed since its approval is no approval to build on — approving a later
  // phase was accepted (one by one and by a fast-forward) while next_action said "re-review requirements" the whole time. The
  // phase-order check names it (re-approve it first); a whitespace-only edit is no change; a re-approval clears it.
  {
    const p = fresh("e1");
    const f = feature(p, "Export");
    const t0 = S.approvePhase(p, f.slug, null, "alice", { through: "requirements" });
    w(f, "requirements.md", REQ.replace("IF the export fails THEN THE SYSTEM SHALL show the error code.", "IF the export fails THEN THE SYSTEM SHALL retry 3 times silently."));
    const ad = S.approvePhase(p, f.slug, "design", "alice");
    const po = ad.checks ? ad.checks.find((c) => c.id === "phase-order") : null;
    const ff = S.approvePhase(p, f.slug, null, "alice", { through: "tasks" });
    const after = st(f).approvals;
    const forced = S.approvePhase(p, f.slug, "design", "alice", { force: true });
    ok(t0.ok && ad.ok === false && ad.refused === true && ad.failing.includes("phase-order") && po && /requirements/.test(po.detail) && /changed since/.test(po.detail) &&
      /\/approve export requirements/.test(po.detail) && ff.ok === false && ff.stoppedAt === "design" && js(ff.approved) === "[]" && ff.failing.includes("phase-order") &&
      !after.design && !after.tasks && forced.ok && forced.forced && forced.failing.includes("phase-order"),
      "1.24 r6 E1: approving a phase after one whose approved content changed is refused on phase-order (it names the phase to re-approve) — one by one and by a fast-forward; force records it forced (got " +
      js([ad.failing, po && po.detail, ff.stoppedAt, ff.approved, ff.failing, forced.failing]) + ")");
    // the same feature, design's forced approval revoked; requirements re-approved → design approvable again
    S.approvePhase(p, f.slug, "design", "alice", { revoke: true });
    const rq = S.approvePhase(p, f.slug, "requirements", "alice");
    const ad2 = S.approvePhase(p, f.slug, "design", "alice");
    ok(rq.ok && ad2.ok && !ad2.forced, "1.24 r6 E1: once the changed phase is re-approved, the later phase is approvable again (got " + js([rq.ok, ad2.ok, ad2.failing]) + ")");
    // a whitespace-only edit (trailing spaces, blank lines at the end) of the approved requirements is no change: tasks approvable
    w(f, "requirements.md", r(f, "requirements.md").replace("download a CSV.", "download a CSV.   ") + "\n\n");
    const at = S.approvePhase(p, f.slug, "tasks", "alice");
    ok(at.ok && !at.forced, "1.24 r6 E1: a whitespace-only edit of an earlier approved phase never blocks a later approval (got " + js([at.ok, at.failing]) + ")");
  }

  // 1.24 r6 E4: roadmap.json that exists but can't be read (a text merge's conflict markers) held the approval roles and the project
  // checks — read as "none": one person approved a role-governed phase alone, and spec_finish / the execution sign-off passed with
  // the project checks never run. The governance read fails CLOSED: approve / revoke / the fast-forward refuse (code
  // roadmap-invalid), finish blocks on `roadmap`, doctor fails `roadmap`, next_action's one step is to repair it; backlog list
  // refuses like milestone / depend.
  {
    const p = fresh("e4", { approvalRoles: { requirements: ["product", "tech"] }, checks: { suite: "node -e \"process.exit(0)\"" } });
    const f = feature(p, "Export");
    S.approvePhase(p, f.slug, "classification", "carol");
    const rp = path.join(p, ".specs", "roadmap.json");
    const good = fs.readFileSync(rp, "utf8");
    const bad = "<<<<<<< HEAD\n" + good + "=======\n" + good + ">>>>>>> other\n";
    fs.writeFileSync(rp, bad);
    const a = S.approvePhase(p, f.slug, "requirements", "mallory");
    const aRole = S.approvePhase(p, f.slug, "requirements", "mallory", { role: "product" });
    const aDry = S.approvePhase(p, f.slug, "requirements", "mallory", { dryRun: true });
    const thr = S.approvePhase(p, f.slug, null, "mallory", { through: "tasks" });
    const rv = S.approvePhase(p, f.slug, "classification", "mallory", { revoke: true });
    const doc = S.specDoctor(p, f.slug);
    const na = S.nextAction(p, f.slug);
    const bl = S.backlog(p, "list");
    const fin = S.finishFeature(p, f.slug, {});
    const s1 = st(f);
    ok(a.ok === false && a.roadmapInvalid === true && a.code === "roadmap-invalid" && /roadmap\.json/.test(a.error) && /approval roles/.test(a.error) &&
      aRole.ok === false && aRole.code === "roadmap-invalid" && aDry.ok === false && aDry.code === "roadmap-invalid" &&
      thr.ok === false && thr.code === "roadmap-invalid" && rv.ok === false && rv.code === "roadmap-invalid" &&
      !s1.approvals.requirements && !!s1.approvals.classification && !s1.signoffs,
      "1.24 r6 E4: with roadmap.json unreadable, approve (any role, a dry run), the fast-forward and revoke refuse with code roadmap-invalid — nothing recorded (got " +
      js([a.code, a.error, aRole.code, thr.code, rv.code, Object.keys(s1.approvals)]) + ")");
    ok(check(doc, "roadmap") && check(doc, "roadmap").status === "fail" && /roadmap\.json/.test(check(doc, "roadmap").detail) && doc.readyToAdvance === false &&
      na.step === "fix" && na.roadmapInvalid === true && /roadmap\.json/.test(na.recommendation) && !/spec-ff/.test(na.recommendation) && !na.fastForward &&
      bl.ok === false && /roadmap\.json/.test(bl.error) &&
      fin.readyToFinish === false && fin.blockers.some((b) => /roadmap\.json/.test(b)),
      "1.24 r6 E4: doctor fails `roadmap`, next_action's one step is fix (roadmapInvalid — never an approval nor a role-less /spec-ff), backlog list refuses, spec_finish blocks on it (got " +
      js([check(doc, "roadmap"), na.step, na.recommendation.slice(0, 120), bl.ok, fin.blockers]) + ")");
    // the execution gate (spec_finish's blockers) names it too; the status line says repair it
    const gate = S.finishFeature(p, f.slug, { gateOnly: true });
    const sl = S.statusLine(p);
    ok(sl.next && sl.next.step === "fix" && sl.next.file === "roadmap.json" && /repair roadmap\.json/.test(sl.line),
      "1.24 r6 E4: the status line's next step is to repair roadmap.json (got " + js([sl.next, sl.line]) + ")");
    fs.writeFileSync(rp, good);
    const back = S.approvePhase(p, f.slug, "requirements", "mallory");
    const doc2 = S.specDoctor(p, f.slug);
    ok(gate.ok && gate.checks.some((c) => c.id === "roadmap") && back.ok === false && back.roleRequired === true && !check(doc2, "roadmap") && S.backlog(p, "list").ok === true,
      "1.24 r6 E4: the execution gate's blockers carry `roadmap`; once roadmap.json is repaired the roles apply again (a role-less approval is refused on roleRequired) and doctor drops the check (got " +
      js([gate.checks && gate.checks.map((c) => c.id), back.roleRequired, back.error]) + ")");
  }

  // 1.24 r6 E8: a bugfix's design gate signs off bug.md — it checked the Root Cause only: a Reproduction emptied after the requirements
  // approval, or bug.md's own slots ([correct behavior]) left in Expected vs Actual, were approved while doctor failed placeholders.
  // It checks what doctor checks: bug.md's placeholders (bugPlaceholders — quoted evidence stays content) and the Reproduction.
  {
    const p = fresh("e8");
    const f = S.createFeature(p, "Login crash", ["core"], "Login crashes on an empty password", undefined, "en", "bugfix");
    const BUG = (repro, expected) => "# Bug: Login crash\n\n## Summary\nLogin crashes on an empty password.\n\n## Reproduction\n" + repro +
      "\n\n## Expected vs Actual\n- **Expected:** " + (expected || "a validation error") + "\n- **Actual:** TypeError: cannot read properties of undefined [object Object]\n\n## Root Cause\n" +
      "auth.js:42 reads password.length before the null check; introduced by commit abc123 (stack trace: TypeError at auth.js:42).\n\n## Fix\nMove the null check before the length read.\n\n" +
      "## Regression Test\n- **T-01** — reproduces the bug: fails before the fix, passes after it.\n";
    const REPRO = "1. Open /login\n2. Submit with an empty password\n3. The server answers 500 with TypeError.";
    w(f, "bug.md", BUG(REPRO));
    w(f, "requirements.md", r(f, "requirements.md").replace("[the condition that triggers the bug]", "a login is submitted with an empty password")
      .replace("[the correct behavior]", "answer 400 with a validation error").replace("[the neighbouring behavior that already worked]", "logins with a password working")
      .replace("[nearby inputs that must keep working]", "a whitespace-only password is also rejected with 400"));
    const rq = S.approvePhase(p, f.slug, "requirements", "alice");
    w(f, "bug.md", BUG("> **TODO** — exact steps, input and environment that reproduce it every time."));
    const d1 = S.approvePhase(p, f.slug, "design", "alice");
    w(f, "bug.md", BUG(REPRO, "[correct behavior]"));
    const d2 = S.approvePhase(p, f.slug, "design", "alice");
    w(f, "bug.md", BUG(REPRO));
    const d3 = S.approvePhase(p, f.slug, "design", "alice");
    ok(rq.ok && d1.ok === false && d1.refused && d1.failing.includes("reproduction") && d2.ok === false && d2.failing.includes("placeholders") &&
      d2.checks.find((c) => c.id === "placeholders").detail.includes("[correct behavior]") && !d2.failing.includes("reproduction") && d3.ok && !d3.forced,
      "1.24 r6 E8: the bugfix design gate refuses a bug.md whose Reproduction is the TODO sentinel again, and one holding its own slots ([correct behavior]); quoted evidence ([object Object]) stays content (got " +
      js([rq.ok, d1.failing, d2.failing, d3.ok, d3.failing]) + ")");
  }
};
