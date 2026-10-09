"use strict";
// Gates — 1.25.1 review 7 (engine core): ONE "changed since approval" test for every reader (the edit guard, the traceability matrix, the Phase 4 stamp, the rework count), the bugfix fix gated before the root cause.
// (06-gates.js holds the gates area's earlier tests; this file the engine-core findings of the seventh review.)

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, S, tmp, root }) => {
  const js = JSON.stringify;
  const REQ = "# Feature: x\n\n## Summary\nExport invoices as CSV.\n\n### US-1 (P1 — MVP): Export\n#### Acceptance Criteria (EARS)\n" +
    "1. **US-1.AC-1** — WHEN an admin clicks Export THE SYSTEM SHALL download a CSV.\n2. **US-1.AC-2** — WHILE an export runs, WHEN the admin clicks again THE SYSTEM SHALL ignore it.\n" +
    "3. **US-1.AC-3** — IF the export fails THEN THE SYSTEM SHALL show the error code.\n\n" +
    "## Success Criteria\n- **SC-001** — 95% of exports finish in under 5 s.\n\n## Out of Scope\n- PDF export.\n";
  const DESIGN = "# Design: x\n\n## Overview\nA nightly job and an endpoint.\n\n## Architecture\n```mermaid\ngraph TD\n  A-->B\n```\n\n## Constitution Check\n- [x] Principle 1 — complies\n\n" +
    "## Alternatives & Trade-offs\nChose a sync endpoint over a queue: simpler, enough for the volume.\n\n## Risks\nLarge months may be slow; mitigated by streaming.\n\n" +
    "## Reuse & Integration\n| Need | Reuse | Why |\n|---|---|---|\n| CSV | the existing csv writer | already tested |\n";
  const TASKS = "# Tasks\n\n## Phase 1\n- [ ] 1. [US1] Build the export endpoint\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Implements: src/export.js_\n  - _Verify: node -e \"process.exit(0)\"_\n" +
    "- [ ] 2. [US1] Show the error code\n  - _Requirements: US-1.AC-3_\n  - _Implements: src/errors.js_\n  - _Verify: node -e \"process.exit(0)\"_\n";
  const CLASS = "# Classification\n\n## Active tracks\ncore\n\n## Why\nA small export feature with no special risk.\n";
  const approved = (n, tasks) => {
    const p = path.join(tmp, "proj-r7g-" + n);
    S.initProject(p, ["core"], "en");
    const f = S.createFeature(p, "Export", ["core"]);
    for (const [rel, text] of [["classification.md", CLASS], ["requirements.md", REQ], ["design.md", DESIGN], ["tasks.md", tasks || TASKS]]) fs.writeFileSync(path.join(f.dir, rel), text);
    const r = ["classification", "requirements", "design", "tasks"].map((ph) => S.approvePhase(p, f.slug, ph, "alice"));
    return { p, f, ok: r.every((x) => x.ok) };
  };
  const guardOn = (p, level) => {
    const rm = path.join(p, ".specs", "roadmap.json");
    const j = JSON.parse(fs.readFileSync(rm, "utf8"));
    j.meta = Object.assign(j.meta || {}, { guard: level });
    fs.writeFileSync(rm, JSON.stringify(j, null, 2));
  };

  // Finding 1 — the edit guard compared the tasks approval's fingerprint alone, while changedSinceApproval (next_action, finish) also
  // accepts its wsFingerprint / .history snapshot: trailing spaces and final blank lines in tasks.md, or a "\r\r\n" tasks.md normalized
  // to LF, made the guard ask "re-approve the tasks" (stale) while next_action said implement and finish listed nothing changed.
  {
    const a = approved("guard-ws");
    guardOn(a.p, true);
    const code = path.join(a.p, "src", "export.js");
    const before = S.guardCheck(a.p, code);
    const tp = path.join(a.f.dir, "tasks.md");
    fs.writeFileSync(tp, fs.readFileSync(tp, "utf8").replace("Build the export endpoint", "Build the export endpoint   ") + "\n\n\n");
    const na = S.nextAction(a.p, a.f.slug);
    const g = S.guardCheck(a.p, code);
    guardOn(a.p, "scope");
    const gs = S.guardCheck(a.p, code);
    // a real edit is still a change for every reader
    fs.writeFileSync(tp, fs.readFileSync(tp, "utf8").replace("Show the error code", "Show the error code and log it"));
    guardOn(a.p, true);
    const gEdit = S.guardCheck(a.p, code);
    const naEdit = S.nextAction(a.p, a.f.slug);
    // "\r\r\n" (a CRLF file converted again) approved, then normalized to LF by an editor
    const c = approved("guard-crcrlf", TASKS.replace(/\n/g, "\r\r\n"));
    guardOn(c.p, true);
    const ctp = path.join(c.f.dir, "tasks.md");
    fs.writeFileSync(ctp, fs.readFileSync(ctp, "utf8").replace(/\r+\n/g, "\n"));
    const gc = S.guardCheck(c.p, path.join(c.p, "src", "export.js"));
    const nc = S.nextAction(c.p, c.f.slug);
    ok(a.ok && c.ok && before.decision === "allow" && na.step === "implement" && js(na.changedSinceApproval || []) === "[]" &&
      g.decision === "allow" && g.why === "approved" && gs.decision === "allow" &&
      gEdit.decision === "ask" && js(gEdit.stale) === js([a.f.slug]) && js(naEdit.changedSinceApproval) === '["tasks.md"]' &&
      gc.decision === "allow" && js(nc.changedSinceApproval || []) === "[]",
      "1.25.1 review 7: the edit guard reads 'changed since approval' as next_action does (approvedContentSame) — trailing spaces / final blank lines in tasks.md and a \"\\r\\r\\n\" file normalized to LF keep the approval covering (guard on and scope); a real edit is stale for both (got " +
      js([before.decision, na.step, na.changedSinceApproval, g.decision, g.why, gs.decision, gEdit.decision, gEdit.stale, naEdit.changedSinceApproval, gc.decision, nc.changedSinceApproval]) + ")");
  }

  // Finding 1 — the traceability matrix compared the approved requirements by the strict fingerprint (with a snapshot: two strict
  // fingerprints): a whitespace-only edit read changed: true while next_action called requirements.md unchanged.
  {
    const a = approved("rtm-ws");
    const rp = path.join(a.f.dir, "requirements.md");
    fs.writeFileSync(rp, fs.readFileSync(rp, "utf8").replace("Export invoices as CSV.", "Export invoices as CSV.   ") + "\n\n");
    const m = S.traceMatrix(a.p, a.f.slug);
    const na = S.nextAction(a.p, a.f.slug);
    // without a snapshot (a .history/ not committed): the approval's own fingerprints decide
    fs.rmSync(path.join(a.f.dir, ".history"), { recursive: true, force: true });
    const m2 = S.traceMatrix(a.p, a.f.slug);
    fs.writeFileSync(rp, fs.readFileSync(rp, "utf8").replace("show the error code", "show the error code and a retry button"));
    const m3 = S.traceMatrix(a.p, a.f.slug);
    ok(a.ok && m.approval && m.approval.baseline === "snapshot" && m.approval.changed === false && js(na.changedSinceApproval || []) === "[]" &&
      m2.approval.baseline === "fingerprint-only" && m2.approval.changed === false && m3.approval.changed === true,
      "1.25.1 review 7: the traceability matrix's approval baseline calls a whitespace-only requirements edit unchanged (snapshot and fingerprint-only), a real edit changed (got " +
      js([m.approval, m2.approval && m2.approval.changed, m3.approval && m3.approval.changed]) + ")");
  }

  // Finding 1 — the Phase 4 `tests` sign-off stamps the test plan's approval fingerprint (testsSignOffStale): re-approving test-plan.md
  // after a whitespace-only edit made the sign-off stale (tests pending again) though the plan's content is the same; and the metrics
  // counted that re-approval as rework.
  {
    const p = path.join(tmp, "proj-r7g-tests-stamp");
    fs.cpSync(path.join(root, "examples", "demo-project"), p, { recursive: true });
    const plan = path.join(p, ".specs", "api-keys", "test-plan.md");
    const re0 = S.approvePhase(p, "api-keys", "test-plan", "u"); // the same content: the approval now carries its wsFingerprint
    const rT = S.approvePhase(p, "api-keys", "tests", "u"); // stamped with that approval
    const rw0 = S.metrics(p, "api-keys").reworkByPhase["test-plan"] || 0;
    fs.writeFileSync(plan, fs.readFileSync(plan, "utf8").replace(/\n/, "   \n") + "\n\n");
    const re1 = S.approvePhase(p, "api-keys", "test-plan", "u");
    const doc = S.specDoctor(p, "api-keys");
    const na = S.nextAction(p, "api-keys");
    const rw1 = S.metrics(p, "api-keys").reworkByPhase["test-plan"] || 0;
    // a real change of the plan still makes the sign-off stale
    fs.writeFileSync(plan, fs.readFileSync(plan, "utf8").replace(/(\| T-07 [^\n]*\n)/, (x) => x + "| T-08 | unit | example | a key prefix is unique per tenant | US-1.AC-1 | `tests/unit/create.test.ts` |\n"));
    const re2 = S.approvePhase(p, "api-keys", "test-plan", "u");
    const doc2 = S.specDoctor(p, "api-keys");
    const rw2 = S.metrics(p, "api-keys").reworkByPhase["test-plan"] || 0;
    ok(re0.ok && rT.ok && rT.approvals.tests.testsPlan && re1.ok && !doc.pendingGates.includes("tests") && na.step === "implement" && rw1 === rw0 &&
      re2.ok && doc2.pendingGates.includes("tests") && rw2 === rw0 + 1,
      "1.25.1 review 7: a test plan re-approved after a whitespace-only edit keeps the Phase 4 sign-off in force (no tests gate pending, next_action implement) and is no rework; a plan re-approved with a new T-ID still stales it and counts (got " +
      js([re0.ok, rT.ok, re1.ok, doc.pendingGates, na.step, rw0, rw1, re2.ok, doc2.pendingGates, rw2]) + ")");
  }
};
