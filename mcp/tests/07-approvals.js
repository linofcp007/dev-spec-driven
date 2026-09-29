"use strict";
// Approvals — roles, the fast-forward (spec_approve {through}), undo / revoke, waivers.
// meta.approvalRoles and sign-offs, the MCP-only stop-check / log tools.

const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

exports.run = async ({ ok, rpc, payload, S, tmp, libSources, list, __dirname }) => {

  { // 1.14 B3 — team governance (approvals by role, roadmap.json meta.approvalRoles) and the fast-forward approval (spec_approve {through})
    const b3Root = path.join(tmp, "b3-governance");
    const b3 = (n) => path.join(b3Root, n);
    const chk = (doc, id) => doc.checks.find((c) => c.id === id) || {};
    const read3 = (f, rel) => fs.readFileSync(path.join(f.dir, rel), "utf8");
    const write3 = (f, rel, text) => fs.writeFileSync(path.join(f.dir, rel), text);
    const state3 = (f) => JSON.parse(read3(f, ".state.json"));
    const meta3 = (p) => (JSON.parse(fs.readFileSync(path.join(p, ".specs", "roadmap.json"), "utf8")).meta || {});
    // Real content for the core chain (every gate passes; the tasks trace every AC).
    const REQ3 = "# Feature: x\n\n## Summary\nExport invoices as CSV.\n\n### US-1 (P1 — MVP): Export\n#### Acceptance Criteria (EARS)\n" +
      "1. **US-1.AC-1** — WHEN an admin clicks Export THE SYSTEM SHALL download a CSV.\n2. **US-1.AC-2** — WHILE an export runs, WHEN the admin clicks again THE SYSTEM SHALL ignore it.\n" +
      "3. **US-1.AC-3** — IF the export fails THEN THE SYSTEM SHALL show the error code.\n4. **US-1.AC-4** — THE SYSTEM SHALL name files invoices-YYYY-MM.csv.\n\n" +
      "### US-2 (P2): Schedule\n#### Acceptance Criteria (EARS)\n1. **US-2.AC-1** — WHEN a schedule is due THE SYSTEM SHALL email the CSV.\n\n" +
      "## Success Criteria\n- **SC-001** — 95% of exports finish in under 5 s.\n\n## Edge Cases & Error Handling\n- **EC-1** — WHEN the month has no invoices THE SYSTEM SHALL return a header-only CSV.\n\n" +
      "## Non-Functional Requirements\n- **NFR-1** — p95 export time < 5 s.\n\n## Out of Scope\n- PDF export.\n";
    const DESIGN3 = "# Design: x\n\n## Overview\nA nightly job and an endpoint.\n\n## Architecture\n```mermaid\ngraph TD\n  A-->B\n```\n\n## Constitution Check\n- [x] Principle 1 — complies\n";
    const TASKS3 = "# Tasks\n\n- [ ] 1. [US1] Build the CSV writer\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4, US-2.AC-1_\n  - _Verify: [manual: open the CSV in a spreadsheet]_\n";
    const fillAll = (f, skip = []) => {
      if (!skip.includes("classification")) write3(f, "classification.md", read3(f, "classification.md").split("\n").map((l) => (/^- /.test(l) ? l : l.replace(/\[[^\]]*\]/g, "filled"))).join("\n"));
      if (!skip.includes("requirements")) write3(f, "requirements.md", REQ3);
      if (!skip.includes("design")) write3(f, "design.md", DESIGN3);
      if (!skip.includes("tasks")) write3(f, "tasks.md", TASKS3);
    };
    const ROLES3 = { requirements: ["product"], design: ["tech", "security"], tasks: ["tech"] };

    // --- spec_init {approvalRoles} (MCP) — validated, stored in roadmap.json meta.approvalRoles, {} clears
    const pR = b3("roles");
    const i1 = payload(await rpc("tools/call", { name: "spec_init", arguments: { projectDir: pR, tracks: ["core"], lang: "en", approvalRoles: { requirements: ["Product"], design: "tech+security", tasks: ["tech"] } } }));
    const iBadPhase = S.initProject(pR, ["core"], undefined, { approvalRoles: { plan: ["tech"] } });
    const iBadRole = S.initProject(pR, ["core"], undefined, { approvalRoles: { design: ["tech lead!"] } });
    const iEmpty = S.initProject(pR, ["core"], undefined, { approvalRoles: { design: [] } });
    const iShape = payload(await rpc("tools/call", { name: "spec_init", arguments: { projectDir: pR, approvalRoles: ["tech"] } }));
    ok(i1.approvalRoles && JSON.stringify(i1.approvalRoles) === JSON.stringify(ROLES3) && JSON.stringify(meta3(pR).approvalRoles) === JSON.stringify(ROLES3) &&
      /^Approval roles: requirements=product · design=tech\+security · tasks=tech — /.test(i1.rolesNote) &&
      iBadPhase.ok === false && /unknown phase 'plan'/.test(iBadPhase.error) && iBadRole.ok === false && /invalid role name 'tech lead!'/.test(iBadRole.error) &&
      iEmpty.ok === false && /approvalRoles\.design: name at least one role/.test(iEmpty.error) && iShape.ok === false &&
      JSON.stringify(meta3(pR).approvalRoles) === JSON.stringify(ROLES3) && S.initProject(pR, ["core"]).approvalRoles.design.join() === "tech,security",
      "B3: spec_init {approvalRoles} stores roadmap.json meta.approvalRoles (roles lower-cased, 'a+b' split, PHASES order) with a rolesNote; an unknown phase / bad role / empty list / non-object is refused and nothing changes; a later init reports the current roles (got " + JSON.stringify([i1.approvalRoles, iShape.error]) + ")");
    const pC = b3("roles-clear");
    S.initProject(pC, ["core"], "en", { approvalRoles: { design: ["tech"] } });
    const iClear = S.initProject(pC, ["core"], undefined, { approvalRoles: {} });
    ok(iClear.rolesNote === "Approval roles cleared — every phase takes a single approval again." && meta3(pC).approvalRoles === undefined && JSON.stringify(iClear.approvalRoles) === "{}" &&
      S.parseApprovalRolesText("requirements=product,design=tech+security").design.join() === "tech,security" &&
      S.parseApprovalRolesText("design=tech,security;tasks=tech").design.join() === "tech,security" && JSON.stringify(S.parseApprovalRolesText("none")) === "{}" &&
      !!S.parseApprovalRolesText("tech").error && JSON.stringify(S.approvalRolesOf(pC)) === "{}",
      "B3: approvalRoles {} clears meta.approvalRoles; the CLI's --roles text parses to the same object ('design=tech,security' keeps both roles, 'none' clears, a role before any phase is an error)");

    // --- a role sign-off leaves the phase PENDING until every role signed; the missing role is named everywhere
    const fR = S.createFeature(pR, "Invoice export", ["core"]);
    fillAll(fR);
    S.approvePhase(pR, fR.slug, "classification", "ana"); // no roles for classification: a single approval, as before
    const noRole = payload(await rpc("tools/call", { name: "spec_approve", arguments: { projectDir: pR, name: fR.slug, phase: "requirements" } }));
    const wrongRole = S.approvePhase(pR, fR.slug, "requirements", "ana", { role: "qa" });
    const prod = S.approvePhase(pR, fR.slug, "requirements", "paula", { role: "Product" });
    ok(noRole.ok === false && noRole.roleRequired === true && noRole.roles.join() === "product" && /'requirements' is signed off per role \(product\).*--role <role>.*Nothing recorded/.test(noRole.error) &&
      wrongRole.ok === false && wrongRole.roleNotListed === true && /'qa' is not a role that signs off 'requirements'/.test(wrongRole.error) &&
      prod.ok && prod.approved === "requirements" && prod.complete === true && prod.role === "product" && state3(fR).approvals.requirements.roles.product.by === "paula" &&
      state3(fR).approvals.requirements.roles.product.fingerprint === state3(fR).approvals.requirements.fingerprint && !state3(fR).signoffs,
      "B3: a phase with roles refuses an approval without a role (roleRequired) or with a role it doesn't list (roleNotListed) — nothing recorded; its only role's sign-off approves it (approvals[phase].roles[role] = {by, at, fingerprint})");
    const tech1 = payload(await rpc("tools/call", { name: "spec_approve", arguments: { projectDir: pR, name: fR.slug, phase: "design", role: "tech", by: "tom" } }));
    const st1 = state3(fR);
    const lastRec1 = st1.approvalHistory[st1.approvalHistory.length - 1];
    const d1 = S.specDoctor(pR, fR.slug);
    const n1 = S.nextAction(pR, fR.slug);
    const fin1 = S.finishFeature(pR, fR.slug);
    const order1 = S.approvePhase(pR, fR.slug, "tasks", "tom", { role: "tech" });
    ok(tech1.ok && tech1.approved === null && tech1.signedOff === "design" && tech1.pending === true && tech1.complete === false && tech1.missingRoles.join() === "security" &&
      /'design' stays pending until every role has signed off its current content — missing role: security\./.test(tech1.note) &&
      !st1.approvals.design && st1.signoffs.design.tech.by === "tom" && lastRec1.phase === "design" && lastRec1.role === "tech" && lastRec1.partial === true && !lastRec1.snapshot &&
      d1.pendingGates[0] === "design" && d1.pendingRoles.design.missing.join() === "security" && d1.pendingRoles.design.signed.join() === "tech" && d1.nextGate.missingRoles.join() === "security" &&
      /awaiting human approval: design \(missing role: security\), tasks \(missing role: tech\)/.test(chk(d1, "approval-gates").detail) && d1.gatesOk === false &&
      n1.step === "approve" && /missing role: security \(signed: tech\): \/approve invoice-export design --role security/.test(n1.recommendation) && n1.missingRoles.join() === "security" &&
      fin1.blockers.some((b) => b === "phases awaiting approval: design (missing role: security), tasks (missing role: tech)") && fin1.pendingRoles.design.missing.join() === "security" &&
      order1.ok === false && order1.failing.includes("phase-order"),
      "B3: one role's sign-off leaves the phase pending (approved: null, signoffs[phase][role], a `partial` history record without snapshot) — doctor's approval-gates, next_action ('missing role: security' + the --role to sign as), finish's blockers name the missing role; a later phase is refused on phase-order (got " +
      JSON.stringify([tech1.note, chk(d1, "approval-gates").detail, n1.recommendation]) + ")");
    const rm1 = fs.readFileSync(path.join(pR, ".specs", "ROADMAP.md"), "utf8");
    ok(/awaiting role sign-off: design \(security\)/.test(rm1), "B3: ROADMAP.md 'Needs attention' lists a sign-off round under way (design waits for security)");

    // content changed after tech signed → tech's sign-off no longer counts (stale), security's does; tech re-signs → approved
    fs.appendFileSync(path.join(fR.dir, "design.md"), "\n## Data Model\nOne table: exports (id, month, status).\n");
    const d2 = S.specDoctor(pR, fR.slug);
    const sec2 = S.approvePhase(pR, fR.slug, "design", "sara", { role: "security" });
    const st2 = state3(fR);
    const tech3 = S.approvePhase(pR, fR.slug, "design", "tom", { role: "tech" });
    const st3 = state3(fR);
    const lastRec3 = st3.approvalHistory[st3.approvalHistory.length - 1];
    ok(d2.pendingRoles.design.stale.join() === "tech" && d2.pendingRoles.design.missing.join() === "tech,security" &&
      /sign-offs made before the artifact changed no longer count \(re-sign the current content\): design \(tech\)/.test(chk(d2, "approval-gates").detail) &&
      sec2.ok && sec2.pending && sec2.missingRoles.join() === "tech" && Object.keys(st2.signoffs.design).join() === "security" && !st2.approvals.design &&
      tech3.ok && tech3.approved === "design" && tech3.complete === true && tech3.signedRoles.sort().join() === "security,tech" &&
      st3.approvals.design.roles.tech.fingerprint === st3.approvals.design.fingerprint && st3.approvals.design.roles.security.fingerprint === st3.approvals.design.fingerprint &&
      !st3.signoffs && lastRec3.role === "tech" && !lastRec3.partial && lastRec3.roles.join() === "tech,security" && typeof lastRec3.snapshot === "string" &&
      fs.existsSync(path.join(fR.dir, lastRec3.snapshot)) && !S.specDoctor(pR, fR.slug).pendingGates.includes("design"),
      "B3: an edit after a role signed invalidates that sign-off (doctor: stale, both roles missing); the other role's sign-off of the new content waits; once every role signed the CURRENT content the phase is approved (roles recorded, snapshot, signoffs cleared)");
    const m3 = S.metrics(pR, fR.slug);
    ok(m3.approvalsTotal === 3 && m3.rework === 0 && m3.leadTime.design && m3.leadTime.design.at === st3.approvals.design.at && m3.batchApprovals === 0,
      "B3: metrics count completed approvals only — a partial role sign-off is no approval (approvalsTotal 3, no rework, design's lead time = its completion) (got " + JSON.stringify([m3.approvalsTotal, m3.rework, m3.leadTime.design]) + ")");
    const imp3 = S.impactReport(pR, fR.slug, { phase: "design" });
    ok(imp3.ok && imp3.baseline !== "none" && imp3.baseline !== "fingerprint-only", "B3: spec_impact diffs against the completed role approval's snapshot (partial records are skipped) (got " + JSON.stringify(imp3.baseline) + ")");
    fs.appendFileSync(path.join(fR.dir, "design.md"), "\n## Rollout\nBehind a flag for one week.\n");
    const n4 = S.nextAction(pR, fR.slug);
    S.approvePhase(pR, fR.slug, "design", "tom", { role: "tech" });
    const n5 = S.nextAction(pR, fR.slug);
    ok(n4.step === "re-review" && /Each role signs the new content again — design \(missing roles: tech, security\): \/approve invoice-export design --role tech\./.test(n4.recommendation) &&
      n5.step === "re-review" && /design \(missing role: security\): \/approve invoice-export design --role security\./.test(n5.recommendation) &&
      chk(S.specDoctor(pR, fR.slug), "changed-since-approval").status === "warn" && !S.specDoctor(pR, fR.slug).pendingGates.includes("design"),
      "B3: an approved role phase edited afterwards — next_action's re-review asks every role to sign the new content again (the roles not re-signed yet, the next --role); the phase stays approved as it was meanwhile (got " + n4.recommendation + ")");

    // --- forced sign-offs: the completed approval is forced when a sign-off that counts was forced
    const pF = b3("forced");
    S.initProject(pF, ["core"], "en", { approvalRoles: { design: ["tech", "security"] } });
    const fF = S.createFeature(pF, "Forced roles", ["core"]);
    fillAll(fF);
    write3(fF, "design.md", DESIGN3.replace("- [x] Principle 1 — complies\n", ""));
    S.approvePhase(pF, fF.slug, "classification", "a"); S.approvePhase(pF, fF.slug, "requirements", "a");
    const fT = S.approvePhase(pF, fF.slug, "design", "tom", { role: "tech" });
    const stFT = state3(fF);
    const fT2 = S.approvePhase(pF, fF.slug, "design", "tom", { role: "tech", force: true });
    const stFT2 = state3(fF);
    const fS = S.approvePhase(pF, fF.slug, "design", "sara", { role: "security", force: true });
    const dF = S.specDoctor(pF, fF.slug);
    ok(fT.ok === false && fT.refused && fT.failing.join() === "constitution-check" && !stFT.signoffs && !stFT.approvals.design &&
      fT2.ok && fT2.forced && fT2.pending && /^Signed off with force — the failing checks are recorded with the sign-off: constitution-check\. 'design' stays pending/.test(fT2.note) &&
      stFT2.signoffs.design.tech.forced === true && stFT2.signoffs.design.tech.failing.join() === "constitution-check" && state3(fF).signoffs === undefined && fS.ok && fS.approved === "design" && state3(fF).approvals.design.forced === true && state3(fF).approvals.design.failing.join() === "constitution-check" &&
      dF.forcedGates.includes("design") && S.metrics(pF, fF.slug).forcedApprovals === 1,
      "B3: each role sign-off runs the phase's gate (refused → nothing recorded; force records the sign-off forced); the completed approval is forced, counted once by metrics");

    // --- guard hook: a tasks phase waiting for a role is not approved tasks
    const pG = b3("guard");
    S.initProject(pG, ["core"], "en", { guard: true, approvalRoles: { tasks: ["tech", "qa"] } });
    const fG = S.createFeature(pG, "Guarded", ["core"]);
    fillAll(fG);
    for (const ph of ["classification", "requirements", "design"]) S.approvePhase(pG, fG.slug, ph, "a");
    S.approvePhase(pG, fG.slug, "tasks", "tom", { role: "tech" });
    const gAsk = S.guardCheck(pG, "src/app.js");
    S.approvePhase(pG, fG.slug, "tasks", "quinn", { role: "qa" });
    const gAllow = S.guardCheck(pG, "src/app.js");
    ok(gAsk.decision === "ask" && gAsk.pending.includes(fG.slug) && gAllow.decision === "allow" && gAllow.why === "approved" && gAllow.covering.includes(fG.slug),
      "B3: guard mode — tasks signed by one of two roles don't cover code edits (ask, pending); once qa signed too they do (allow)");

    // --- no roles configured: exactly today's behavior (a role given is only recorded)
    const pN = b3("no-roles");
    S.initProject(pN, ["core"], "en");
    const fN = S.createFeature(pN, "Plain", ["core"]);
    fillAll(fN);
    S.approvePhase(pN, fN.slug, "classification", "a");
    const nR = S.approvePhase(pN, fN.slug, "requirements", "a", { role: "product" });
    const nPlain = S.approvePhase(pN, fN.slug, "design", "a");
    const dN = S.specDoctor(pN, fN.slug);
    ok(nR.ok && nR.approved === "requirements" && nR.complete === undefined && state3(fN).approvals.requirements.role === "product" && !state3(fN).approvals.requirements.roles &&
      nPlain.ok && nPlain.approved === "design" && nPlain.role === undefined && nPlain.note === undefined && !("pendingRoles" in dN) && !("unsignedRoles" in dN) &&
      chk(dN, "approval-gates").detail === "awaiting human approval: tasks — run /approve before advancing" && JSON.stringify(S.approvalRolesOf(pN)) === "{}",
      "B3: without meta.approvalRoles an approval is single, as before — a role given is only recorded (entry.role); doctor has no role fields and the same approval-gates text (got " + chk(dN, "approval-gates").detail + ")");

    // --- legacy approvals (made before the roles were configured) stay approved — by an unknown role; doctor/finish warn
    const pL = b3("legacy");
    S.initProject(pL, ["core"], "en");
    const fL = S.createFeature(pL, "Legacy", ["core"]);
    fillAll(fL);
    for (const ph of ["classification", "requirements", "design"]) S.approvePhase(pL, fL.slug, ph, "a");
    S.initProject(pL, ["core"], undefined, { approvalRoles: { design: ["tech", "security"] } });
    const dL = S.specDoctor(pL, fL.slug);
    const finL = S.finishFeature(pL, fL.slug);
    const reL = S.approvePhase(pL, fL.slug, "design", "tom", { role: "tech" });
    const stL = state3(fL);
    const dL2 = S.specDoctor(pL, fL.slug);
    const reL2 = S.approvePhase(pL, fL.slug, "design", "sara", { role: "security" });
    const dL3 = S.specDoctor(pL, fL.slug);
    ok(!dL.pendingGates.includes("design") && dL.unsignedRoles.design.join() === "tech,security" && chk(dL, "approval-gates").status === "warn" &&
      /approved without the role sign-offs now required \(approved before the roles were configured or changed — counted as approved by an unknown role; ask each role to re-sign\): design \(tech, security\)/.test(chk(dL, "approval-gates").detail) &&
      finL.warnings.some((w) => /approved without the role sign-offs now required.*design \(tech, security\)/.test(w)) && !finL.blockers.some((b) => /design/.test(b)) &&
      reL.ok && reL.pending && stL.approvals.design && !stL.approvals.design.roles && stL.signoffs.design.tech && !dL2.pendingGates.includes("design") &&
      /re-sign in progress \(the phase stays approved as it was until every role has signed the new content\): design \(missing role: security\)/.test(chk(dL2, "approval-gates").detail) &&
      reL2.ok && reL2.approved === "design" && Object.keys(state3(fL).approvals.design.roles).sort().join() === "security,tech" && !("design" in dL3.unsignedRoles) &&
      !/approved without the role sign-offs/.test(chk(dL3, "approval-gates").detail),
      "B3: an approval made before the roles were configured stays approved (unknown role) — doctor's approval-gates warns and names the roles to re-sign, finish lists it as a warning (never a blocker); a re-sign round keeps it approved until every role signed (got " + chk(dL, "approval-gates").detail + ")");

    // a single approval that named a role (no role was required then) counts as THAT role's sign-off once roles are required;
    // sign-offs left waiting are dropped when the phase no longer needs roles; a "__proto__" phase is a refused key
    const pL2 = b3("legacy-role");
    S.initProject(pL2, ["core"], "en");
    const fL2 = S.createFeature(pL2, "Legacy role", ["core"]);
    fillAll(fL2);
    for (const ph of ["classification", "requirements"]) S.approvePhase(pL2, fL2.slug, ph, "a");
    S.approvePhase(pL2, fL2.slug, "design", "tom", { role: "tech" });
    S.initProject(pL2, ["core"], undefined, { approvalRoles: { design: ["tech", "security"], tasks: ["tech", "qa"] } });
    const dL4 = S.specDoctor(pL2, fL2.slug);
    const reL4 = S.approvePhase(pL2, fL2.slug, "design", "sara", { role: "security" });
    const taskSign = S.approvePhase(pL2, fL2.slug, "tasks", "tom", { role: "tech" });
    const stL4 = state3(fL2);
    S.initProject(pL2, ["core"], undefined, { approvalRoles: { design: ["tech", "security"] } });
    const taskPlain = S.approvePhase(pL2, fL2.slug, "tasks", "tom");
    const stL5 = state3(fL2);
    const protoTxt = S.parseApprovalRolesText("__proto__=tech");
    const protoInit = S.initProject(pL2, ["core"], undefined, { approvalRoles: protoTxt });
    ok(dL4.unsignedRoles.design.join() === "security" && reL4.ok && reL4.approved === "design" && reL4.signedRoles.sort().join() === "security,tech" &&
      taskSign.pending && stL4.signoffs.tasks.tech && taskPlain.ok && taskPlain.approved === "tasks" && !stL5.signoffs && !stL5.approvals.tasks.roles &&
      Object.keys(protoTxt).join() === "__proto__" && protoInit.ok === false && /unknown phase '__proto__'/.test(protoInit.error) &&
      JSON.stringify(S.approvalRolesOf(pL2)) === '{"design":["tech","security"]}',
      "B3: an earlier single approval that named a role counts as that role's sign-off once roles are required (only security left to sign; its sign-off completes it); waiting sign-offs are dropped when the phase no longer needs roles; a '__proto__' phase is refused (got " + JSON.stringify([dL4.unsignedRoles, reL4.signedRoles]) + ")");

    // --- fast-forward: happy path — next_action suggests it, one call approves every phase in order (batch)
    const pFF = b3("ff");
    S.initProject(pFF, ["core"], "en");
    const fA = S.createFeature(pFF, "Quick spec", ["core"]);
    fillAll(fA);
    const nA = S.nextAction(pFF, fA.slug);
    const ffA = payload(await rpc("tools/call", { name: "spec_approve", arguments: { projectDir: pFF, name: fA.slug, through: "tasks", by: "ana" } }));
    const stA = state3(fA);
    const mA = S.metrics(pFF, fA.slug);
    ok(nA.step === "approve" && nA.fastForward && nA.fastForward.phases.join() === "classification,requirements,design,tasks" && nA.fastForward.through === "tasks" && nA.fastForward.role === null &&
      /fast-forward: \/spec-ff quick-spec \(CLI: node "[^"]*dev-spec\.js" approve quick-spec --through tasks\) approves classification, requirements, design, tasks in order, each through its own gate\./.test(nA.recommendation) &&
      ffA.ok && ffA.complete === true && ffA.approved.join() === "classification,requirements,design,tasks" && ffA.batch === true && ffA.steps.every((s) => s.approved) &&
      ffA.message === "Fast-forward 'quick-spec': approved classification, requirements, design, tasks, in order, each through its own gate — every phase through 'tasks' is approved." &&
      ["classification", "requirements", "design", "tasks"].every((ph) => stA.approvals[ph].batch === true && stA.approvals[ph].by === "ana") &&
      stA.approvalHistory.filter((h) => h.batch === true && typeof h.snapshot === "string").length === 4 &&
      mA.batchApprovals === 4 && S.metricsLines(mA).includes("  batch approvals (fast-forward): 4") && S.nextAction(pFF, fA.slug).step === "implement",
      "B3: next_action names the fast-forward (/spec-ff + the CLI) when every planning artifact through tasks is filled and passes its gate; spec_approve {through: 'tasks'} approves them in order — each snapshotted, recorded batch: true, counted apart by metrics (got " + nA.recommendation + ")");
    const ffAgain = S.approvePhase(pFF, fA.slug, undefined, "ana", { through: "tasks" });
    ok(ffAgain.ok && ffAgain.nothingToDo && ffAgain.approved.length === 0 && /^Nothing to fast-forward: every active phase of 'quick-spec' through 'tasks' is already approved\.$/.test(ffAgain.message),
      "B3: a second fast-forward has nothing to do and says so");

    // stop at a refused gate (design placeholders): the phases before it stay approved, nothing after it
    const fB = S.createFeature(pFF, "Refused ff", ["core"]);
    fillAll(fB, ["design"]);
    const nB = S.nextAction(pFF, fB.slug);
    const ffB = S.approvePhase(pFF, fB.slug, undefined, "ana", { through: "tasks" });
    const stB = state3(fB);
    ok(!nB.fastForward && ffB.ok === false && ffB.refused && ffB.stoppedAt === "design" && ffB.stopReason === "refused" && ffB.approved.join() === "classification,requirements" &&
      ffB.failing.includes("placeholders") && ffB.checks.length >= 1 && stB.approvals.requirements.batch === true && !stB.approvals.design && !stB.approvals.tasks &&
      /^Fast-forward 'refused-ff' stopped at 'design' \(approved before it: classification, requirements\) — its gate refuses it — failing checks: placeholders/.test(ffB.error) &&
      /✗ placeholders — design\.md/.test(ffB.error) && /it resumes at 'design'/.test(ffB.error),
      "B3: the fast-forward never skips a gate — it stops at the first refused one (design placeholders), keeps the phases approved before it and names the failing checks; next_action suggests no fast-forward while a gate would refuse");
    const ffBF = S.approvePhase(pFF, fB.slug, undefined, "ana", { through: "tasks", force: true });
    ok(ffBF.ok && ffBF.approved.join() === "design,tasks" && state3(fB).approvals.design.forced === true && ffBF.steps[0].forced === true && state3(fB).approvals.design.batch === true,
      "B3: force (only when the user asked) forces each gate of the fast-forward, recorded as forced like approve --force");

    // argument errors: phase + through, through execution, an inactive phase, neither phase nor through; MCP schema
    const fE = S.createFeature(pFF, "Errors ff", ["core"]);
    const eBoth = S.approvePhase(pFF, fE.slug, "design", "a", { through: "tasks" });
    const eExec = S.approvePhase(pFF, fE.slug, undefined, "a", { through: "execution" });
    const eInact = S.approvePhase(pFF, fE.slug, undefined, "a", { through: "test-plan" });
    const eNone = payload(await rpc("tools/call", { name: "spec_approve", arguments: { projectDir: pFF, name: fE.slug } }));
    const eEnum = await rpc("tools/call", { name: "spec_approve", arguments: { projectDir: pFF, name: fE.slug, through: "execution" } });
    const apTool3 = list.result.tools.find((t) => t.name === "spec_approve");
    ok(eBoth.ok === false && /either a phase or through/.test(eBoth.error) && eExec.ok === false && /covers the planning phases only/.test(eExec.error) &&
      eInact.ok === false && eInact.notActive && /'test-plan' is not an approvable phase of 'errors-ff'/.test(eInact.error) &&
      eNone.ok === false && /Name the phase to approve — or through: <phase>/.test(eNone.error) && JSON.stringify(eEnum).includes("execution") && !(payload(eEnum) || {}).approved &&
      apTool3.inputSchema.required.join() === "name" && apTool3.inputSchema.properties.through.enum.join() === "classification,requirements,design,test-plan,eval-plan,tests,tasks" &&
      apTool3.inputSchema.properties.role.type === "string" && /APPROVALS BY ROLE/.test(apTool3.description) && /FAST-FORWARD/.test(apTool3.description) &&
      !Object.keys(state3(fE).approvals).length,
      "B3: phase and through together, through 'execution', an inactive phase and neither of them are refused (nothing approved); spec_approve advertises role + through (phase optional)");

    // with roles: the given role signs each phase; a phase that needs another role stops it; next_action suggests it with --role
    const pFR = b3("ff-roles");
    S.initProject(pFR, ["core"], "en", { approvalRoles: ROLES3 });
    const fC = S.createFeature(pFR, "Roles ff", ["core"]);
    fillAll(fC);
    const nC0 = S.nextAction(pFR, fC.slug);
    const ffC1 = S.approvePhase(pFR, fC.slug, undefined, "paula", { through: "tasks", role: "product" });
    S.approvePhase(pFR, fC.slug, "design", "sara", { role: "security" });
    const nC1 = S.nextAction(pFR, fC.slug);
    const ffC2 = payload(await rpc("tools/call", { name: "spec_approve", arguments: { projectDir: pFR, name: fC.slug, through: "tasks", role: "tech", by: "tom" } }));
    const stC = state3(fC);
    ok(!nC0.fastForward && ffC1.ok === false && ffC1.stopReason === "role" && ffC1.stoppedAt === "design" && ffC1.approved.join() === "classification,requirements" &&
      /'product' is not a role that signs off 'design'/.test(ffC1.error) && stC.approvals.requirements.roles.product.by === "paula" &&
      nC1.fastForward && nC1.fastForward.role === "tech" && nC1.fastForward.phases.join() === "design,tasks" && /\/spec-ff roles-ff --role tech \(CLI: node "[^"]*dev-spec\.js" approve roles-ff --through tasks --role tech\)/.test(nC1.recommendation) &&
      ffC2.ok && ffC2.complete && ffC2.approved.join() === "design,tasks" && Object.keys(stC.approvals.design.roles).sort().join() === "security,tech" &&
      stC.approvals.design.batch === true && stC.approvals.tasks.roles.tech.batch === true,
      "B3: fast-forward with roles — the given role signs each phase; a phase that role doesn't sign stops it (role, nothing recorded there); next_action suggests it with --role when one role is all each remaining phase waits for (got " + nC1.recommendation + ")");
    const fD = S.createFeature(pFR, "Roles wait", ["core"]);
    fillAll(fD);
    S.approvePhase(pFR, fD.slug, "classification", "a"); S.approvePhase(pFR, fD.slug, "requirements", "p", { role: "product" });
    const ffD = S.approvePhase(pFR, fD.slug, undefined, "tom", { through: "tasks", role: "tech" });
    ok(ffD.ok === true && ffD.complete === false && ffD.stopReason === "roles" && ffD.stoppedAt === "design" && ffD.missingRoles.join() === "security" && ffD.approved.length === 0 &&
      ffD.steps[0].signedOff === true && state3(fD).signoffs.design.tech.batch === true && !state3(fD).approvals.tasks &&
      /stopped at 'design' \(nothing approved\) — signed off, but it waits for the other roles \(missing role: security\)/.test(ffD.message),
      "B3: fast-forward with roles stops at a phase that, once signed, still waits for another role (ok, complete: false, missingRoles) — the later phases wait for it");

    // --- PT / ES: the role and fast-forward messages follow the feature's language
    const pPT = b3("pt");
    S.initProject(pPT, ["core"], "pt", { approvalRoles: { design: ["tech", "security"] } });
    const fPT = S.createFeature(pPT, "Exportar faturas", ["core"]);
    fillAll(fPT);
    S.approvePhase(pPT, fPT.slug, "classification", "a"); S.approvePhase(pPT, fPT.slug, "requirements", "a");
    const ptNo = S.approvePhase(pPT, fPT.slug, "design", "a");
    const ptSign = S.approvePhase(pPT, fPT.slug, "design", "t", { role: "tech" });
    const ptNa = S.nextAction(pPT, fPT.slug);
    const ptDoc = S.specDoctor(pPT, fPT.slug);
    const ptFf = S.approvePhase(pPT, fPT.slug, undefined, "s", { through: "tasks", role: "security" });
    const pES = b3("es");
    S.initProject(pES, ["core"], "es");
    const fES = S.createFeature(pES, "Exportar facturas", ["core"]);
    fillAll(fES, ["design"]);
    const esFf = S.approvePhase(pES, fES.slug, undefined, "a", { through: "tasks" });
    const esInit = S.initProject(pES, ["core"], undefined, { approvalRoles: { tasks: ["qa", "tech"] } });
    const esNo = S.approvePhase(pES, fES.slug, "design", "a", { force: true });
    S.approvePhase(pES, fES.slug, "tasks", "q", { role: "qa", force: true });
    const esNa = S.finishFeature(pES, fES.slug);
    ok(/^'design' é validada por papel \(tech, security\) — indica o papel com que validas: \/approve exportar-faturas design --role <papel>/.test(ptNo.error) &&
      /'design' continua pendente até todos os papéis validarem o seu conteúdo atual — falta o papel: security\./.test(ptSign.note) &&
      /Revê e valida 'design' — falta o papel: security \(já validaram: tech\): \/approve exportar-faturas design --role security\./.test(ptNa.recommendation) &&
      /a aguardar aprovação humana: design \(falta o papel: security\)/.test(chk(ptDoc, "approval-gates").detail) &&
      /^Avanço rápido de 'exportar-faturas': design, tasks aprovadas, por ordem/.test(ptFf.message) &&
      /^El avance rápido de 'exportar-facturas' se detuvo en 'design' \(aprobadas antes: classification, requirements\) — su gate la rechaza/.test(esFf.error) &&
      /^Roles de aprobación: tasks=qa\+tech/.test(esInit.rolesNote) && esNo.ok &&
      esNa.blockers.some((b) => /\(falta el rol: tech\)/.test(b)) && /^'x' no es un rol que valide 'tasks'/.test(S.approvePhase(pES, fES.slug, "tasks", "x", { role: "x" }).error),
      "B3: PT / ES — role errors, the pending note, next_action's sign-off step, doctor's list, the fast-forward summaries and finish's blockers are localized (got " +
      JSON.stringify([ptNa.recommendation, esNa.blockers.slice(-1)]) + ")");

    const govKeys = (l) => Object.keys(S.msg(l).governance).sort().join();
    ok(govKeys("en") === govKeys("pt") && govKeys("en") === govKeys("es") && ["en", "pt", "es"].every((l) => typeof S.msg(l).jsonShape.signoffs === "string") &&
      S.msg("pt").governance.missing(["a", "b"]) === "faltam os papéis: a, b" && S.msg("es").governance.missing(["a"]) === "falta el rol: a",
      "B3: EN / PT / ES parity — the same governance messages (roles, fast-forward) in every language, singular / plural role wording");

    // --- .state.json signoffs of the wrong shape is refused like approvals of the wrong shape
    const fS3 = S.createFeature(pN, "Shape", ["core"]);
    const s3 = state3(fS3); s3.signoffs = ["tech"]; write3(fS3, ".state.json", JSON.stringify(s3));
    const shape3 = S.approvePhase(pN, fS3.slug, "classification", "a", { force: true });
    ok(shape3.ok === false && /'signoffs' must be an object/.test(shape3.error), "B3: a .state.json whose signoffs is not an object is refused (never 'repaired')");
  }

  // 1.16 package (U) — usability: undo, waivers, stop-check / log tools.

  {
    const uDir = (n) => path.join(tmp, "p16u-" + n);
    const uW = (dir, rel, txt) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), txt); };
    const uR = (dir, rel) => fs.readFileSync(path.join(dir, rel), "utf8");
    const uSt = (dir) => JSON.parse(uR(dir, ".state.json"));
    const uPut = (dir, st) => fs.writeFileSync(path.join(dir, ".state.json"), JSON.stringify(st, null, 2));
    const js = (v) => JSON.stringify(v);
    const uCall = async (name, args) => { const r = await rpc("tools/call", { name, arguments: args }); return { isError: r.result.isError === true, p: payload(r) }; };
    const uRun = 'node -e "process.exit(0)"';
    const CLI16 = path.join(__dirname, "..", "cli", "dev-spec.js");
    const cli16 = (args, input) => { const r = spawnSync(process.execPath, [CLI16, ...args], { encoding: "utf8", input, env: { ...process.env, SPEC_PROJECT_DIR: "", CLAUDE_PROJECT_DIR: "" } }); return { out: r.stdout || "", err: r.stderr || "", code: r.status }; };
    const uTasks = "# Tasks: login\n\n## Global Constraints\n- Node >= 18\n\n## Story US-1 (P1 — MVP)\n" +
      "- [ ] 1. [US1] Implement the login handler (EC-1, NFR-1)\n  - _Requirements: US-1.AC-1_\n  - _Verify: " + uRun + "_\n" +
      "- [ ] 2. [US1] Show the error message\n  - _Requirements: US-1.AC-2_\n  - _Verify: " + uRun + "_\n**Checkpoint:** US-1 works.\n";
    // A core feature whose whole planning chain is filled (the fast-forward through tasks passes every gate) — the Gb helper's.
    const uFeature = (p, name, tasks) => {
      const r = S.createFeature(p, name, ["core"], "", null, "en");
      uW(r.dir, "classification.md", `# Classification: ${name}\n\n## Mode\nSpec\n\n## Active Tracks\ncore\n\n## Signals\n- none, plain feature\n\n## Blast Radius\nLow; only the login page.\n\n## Compliance Tags\nnone\n`);
      uW(r.dir, "requirements.md", `# Feature: ${name}\n\n## Summary\nUsers log in with email and password.\n\n## User Stories (prioritized — each independently testable)\n\n### US-1 (P1 — MVP): Log in\n` +
        "**As a** user, **I want** to log in, **so that** I see my account.\n**Why P1:** nothing works without it.\n**Independent Test:** Can be fully tested by logging in and delivers access, without the other stories.\n\n" +
        "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the user submits valid credentials THE SYSTEM SHALL open a session\n2. **US-1.AC-2** — IF the credentials are wrong THEN THE SYSTEM SHALL show an error\n\n" +
        "## Success Criteria (measurable, technology-agnostic)\n- **SC-001** — 95% of logins complete in under 2 seconds\n\n## Edge Cases & Error Handling\n- **EC-1** — Locked account: show the lock message\n\n" +
        "## Non-Functional Requirements\n- **NFR-1** — p95 latency under 300 ms\n\n## Out of Scope\n- Social login\n\n## Assumptions\n- Users already have accounts\n");
      uW(r.dir, "design.md", `# Design: ${name}\n\n## Overview\nA form posts to /login; the server checks the hash.\n\n## Architecture\nThe web app calls the auth service.\n\n## Data Models\nUser { id, email, hash }\n\n` +
        "## API Contracts\nPOST /login returns 200 or 401.\n\n## Security Considerations\nHashes use bcrypt.\n\n## Error Handling\nWrong credentials give 401.\n\n## Testing Strategy\n- Unit tests for the handler.\n\n" +
        "## Constitution Check\n- [x] Simplicity — complies\n\n## Complexity Tracking\nNone.\n");
      uW(r.dir, "tasks.md", tasks || uTasks);
      return r;
    };

    // ---- U1: undo a tick ----
    const p1 = uDir("undo");
    S.initProject(p1, ["core"], "en");
    const f1 = uFeature(p1, "login");
    S.approvePhase(p1, "login", null, "u", { through: "tasks" });
    const BOM = String.fromCharCode(0xfeff);
    const crlf1 = BOM + uTasks.replace(/\n/g, "\r\n"); // a BOM and CRLF line ends are encoding: kept byte for byte
    uW(f1.dir, "tasks.md", crlf1);
    const t1 = (await uCall("spec_complete_task", { name: "login", number: 1, evidence: { command: uRun, exitCode: 0 }, projectDir: p1 })).p;
    const u1 = (await uCall("spec_complete_task", { name: "login", number: 1, undo: true, reason: "ticked  the wrong\ntask", projectDir: p1 })).p;
    const st1 = uSt(f1.dir);
    ok(t1.ok && t1.verified && u1.ok && u1.unticked === true && u1.evidenceStale === true && u1.done === 0 && u1.next.number === 1 && u1.reason === "ticked the wrong task" &&
      uR(f1.dir, "tasks.md") === crlf1 && st1.evidence["1"].stale === true && st1.evidence["1"].staleBy === "undo" && !(st1.ticks && st1.ticks["1"]) &&
      st1.unticks.length === 1 && st1.unticks[0].n === 1 && st1.unticks[0].reason === "ticked the wrong task" && !isNaN(Date.parse(st1.unticks[0].at)) &&
      /Task 1 is open again \(unticked\)\. Its recorded evidence no longer counts — ticking it again needs a new run of its _Verify:_ command: node "[^"]*dev-spec\.js" done login 1 --run\./.test(u1.note),
      "1.16 U1: spec_complete_task {undo, reason} unticks the task — tasks.md byte-identical to before the tick (BOM + CRLF kept) —, marks its evidence stale (staleBy undo), drops ticks[1] and appends unticks [{n, at, reason}] (reason folded to one line) (got " +
      js([u1, st1.unticks]) + ")");
    const n1 = (await uCall("spec_complete_task", { name: "login", number: 1, evidence: { summary: "looked fine" }, projectDir: p1 })).p;
    const doc1 = S.specDoctor(p1, "login").checks.find((c) => c.id === "verification") || {};
    const fin1 = S.finishFeature(p1, "login");
    const r1 = (await uCall("spec_complete_task", { name: "login", number: 1, evidence: { command: uRun, exitCode: 0 }, projectDir: p1 })).p;
    ok(n1.ok && n1.verified === false && n1.unverifiedReason === "stale-evidence" && /Task 1: it was unticked after this evidence was recorded/.test(n1.note) &&
      /#1 \(unticked since this evidence was recorded\)/.test(doc1.detail || "") && fin1.blockers.some((b) => /#1 \(unticked since this evidence was recorded\)/.test(b)) &&
      r1.verified === true && !uSt(f1.dir).evidence["1"].stale && !uSt(f1.dir).evidence["1"].staleBy,
      "1.16 U1: a re-tick after an undo needs a NEW run — a note leaves it unverified (stale-evidence, with its own 'unticked' wording in the note, doctor and finish); a passing run verifies it again (got " +
      js([n1.note, doc1.detail]) + ")");
    const a1 = (await uCall("spec_complete_task", { name: "login", number: 2, undo: true, projectDir: p1 })).p;
    const e1 = await uCall("spec_complete_task", { name: "login", number: 1, undo: true, evidence: { command: uRun, exitCode: 0 }, projectDir: p1 });
    const e2 = await uCall("spec_complete_task", { name: "login", number: 2, reason: "why", projectDir: p1 });
    const e3 = await uCall("spec_complete_task", { name: "login", number: 9, undo: true, projectDir: p1 });
    const e4 = await uCall("spec_complete_task", { name: "login", number: 1, undo: true, reason: "x".repeat(501), projectDir: p1 });
    const e5 = await rpc("tools/call", { name: "spec_complete_task", arguments: { name: "login", number: 1, undo: "yes", projectDir: p1 } });
    ok(a1.ok && a1.alreadyOpen === true && a1.unticked === false && /Task 2 is not ticked — nothing to undo\./.test(a1.note) && uSt(f1.dir).unticks.length === 1 &&
      e1.isError && /undo takes no evidence/.test(e1.p.error) && e2.isError && /reason goes with undo/.test(e2.p.error) && e3.isError && e4.isError && /at most 500 characters/.test(e4.p.error) &&
      e5.result.isError === true && /- \[x\] 1\./.test(uR(f1.dir, "tasks.md")) && uSt(f1.dir).unticks.length === 1,
      "1.16 U1: undoing an open task answers ok with a note and records nothing; undo with evidence, reason without undo, an unknown task, a reason over 500 characters and a non-boolean undo are refused — nothing changed (got " +
      js([a1.note, e1.p.error, e2.p.error, e4.p.error]) + ")");
    // Localized: a PT feature's undo note, an ES feature's.
    const fPt = S.createFeature(p1, "Pagamentos", ["core"], "x", undefined, "pt");
    const fEs = S.createFeature(p1, "Pagos", ["core"], "x", undefined, "es");
    uW(fPt.dir, "tasks.md", "- [ ] 1. uma tarefa\n  - _Verify: " + uRun + "_\n");
    uW(fEs.dir, "tasks.md", "- [ ] 1. una tarea\n");
    S.completeTask(p1, fPt.slug, 1, { command: uRun, exitCode: 0 });
    S.completeTask(p1, fEs.slug, 1);
    const uPt = S.completeTask(p1, fPt.slug, 1, undefined, { undo: true });
    const uEs = S.completeTask(p1, fEs.slug, 1, undefined, { undo: true });
    const uEs2 = S.completeTask(p1, fEs.slug, 1, undefined, { undo: true });
    ok(/^A tarefa 1 voltou a ficar aberta \(desmarcada\)\. A evidência registada deixou de contar — voltar a marcá-la exige uma nova execução/.test(uPt.note) &&
      uEs.note === "La tarea 1 vuelve a estar abierta (desmarcada)." && uEs.evidenceStale === false && /nada que deshacer/.test(uEs2.note),
      "1.16 U1: the undo notes are in the feature's language (PT with stale evidence, ES without a record, ES already open) (got " + js([uPt.note, uEs.note, uEs2.note]) + ")");

    // Locks: six processes undoing six ticks of ONE feature at once — no lost update.
    const p2 = uDir("undo-lock");
    S.initProject(p2, ["core"], "en");
    const f2 = S.createFeature(p2, "Many", ["core"], "x", undefined, "en");
    uW(f2.dir, "tasks.md", Array.from({ length: 6 }, (_, i) => `- [ ] ${i + 1}. task ${i + 1}\n`).join(""));
    for (let i = 1; i <= 6; i++) S.completeTask(p2, "many", i, { summary: "done by hand" });
    const specJs = path.join(__dirname, "lib", "spec.js");
    await Promise.all(Array.from({ length: 6 }, (_, i) => new Promise((resolve) => {
      const k = spawn(process.execPath, ["-e", `require(${js(specJs)}).completeTask(${js(p2)}, "many", ${i + 1}, undefined, { undo: true, reason: "r${i + 1}" })`], { stdio: "ignore" });
      k.on("close", resolve);
      k.on("error", resolve);
    })));
    const st2 = uSt(f2.dir);
    ok(!/- \[x\]/.test(uR(f2.dir, "tasks.md")) && st2.unticks.length === 6 && new Set(st2.unticks.map((u) => u.n)).size === 6 && Object.keys(st2.evidence).every((k) => st2.evidence[k].stale === true),
      "1.16 U1: six processes undoing six ticks of one feature at once — under the feature lock no update is lost: every task open, six unticks records, six stale records (got " +
      js([st2.unticks.map((u) => u.n), uR(f2.dir, "tasks.md")]) + ")");

    // A finished, signed-off feature: undo reopens it (drift), and once re-ticked the finish baseline is stale (finish again).
    const p3 = uDir("undo-finished");
    S.initProject(p3, ["core"], "en");
    uFeature(p3, "login");
    S.approvePhase(p3, "login", null, "u", { through: "tasks" });
    [1, 2].forEach((n) => S.completeTask(p3, "login", n, { command: uRun, exitCode: 0 }));
    const fin3 = S.finishFeature(p3, "login", { write: true });
    const ex3 = S.approvePhase(p3, "login", "execution", "u");
    const u3 = S.completeTask(p3, "login", 2, undefined, { undo: true });
    const dr3 = S.drift(p3, "login");
    const na3 = S.nextAction(p3, "login");
    S.completeTask(p3, "login", 2, { command: uRun, exitCode: 0 });
    const dr3b = S.drift(p3, "login");
    const na3b = S.nextAction(p3, "login");
    ok(fin3.readyToFinish && ex3.ok && u3.ok && /finish it again \(\/spec-finish login\) and sign it off again \(\/approve login execution\)/.test(u3.note) &&
      dr3.reopened.includes("login") && na3.step === "implement" &&
      dr3b.verdict === "stale" && dr3b.stale[0].since.some((x) => x.kind === "untick" && x.task === 2) && /unticked since: #2/.test(dr3b.stale[0].why) &&
      na3b.step === "finish" && na3b.staleBaseline && na3b.staleBaseline.since.some((x) => x.kind === "untick" && x.task === 2),
      "1.16 U1: undoing a tick of a finished, signed-off feature reopens it (drift: reopened; next_action: implement); re-ticked, its finish baseline is stale (since: untick #2 — drift verdict stale, next_action finish) (got " +
      js([dr3.reopened, na3.step, dr3b.verdict, dr3b.stale[0] && dr3b.stale[0].why, na3b.step]) + ")");

    // Bugfix: an undo is never gated (it completes nothing); a spike's investigation task unticks like any other.
    const p4 = uDir("undo-kinds");
    S.initProject(p4, ["core"], "en");
    const bf4 = S.createFeature(p4, "Login Loop", undefined, "users bounce back to /login", undefined, "en", "bugfix");
    const rcTodo = "> **TODO** — the cause, with evidence (stack trace, log, failing assertion, the change that introduced it). Not \"probably\".";
    const bug4 = uR(bf4.dir, "bug.md");
    uW(bf4.dir, "tasks.md", "- [ ] 1. Reproduce the bug\n- [ ] 2. Write the root cause in bug.md → Root Cause\n- [ ] 3. Fix the handler\n  - _Verify: " + uRun + "_\n");
    uW(bf4.dir, "bug.md", bug4.split(rcTodo).join("The refresh handler redirects before clearing the cookie (auth.js:88)."));
    [1, 2].forEach((n) => S.completeTask(p4, "login-loop", n));
    const tk4 = S.completeTask(p4, "login-loop", 3, { command: uRun, exitCode: 0 });
    uW(bf4.dir, "bug.md", bug4); // Root Cause emptied again: a tick after the root-cause task is refused now
    const un4 = S.completeTask(p4, "login-loop", 3, undefined, { undo: true, reason: "fix reverted" });
    const re4 = S.completeTask(p4, "login-loop", 3, { command: uRun, exitCode: 0 });
    const sp4 = S.createFeature(p4, "Cache spike", undefined, undefined, undefined, "en", "spike", { question: "Can Redis hold the sessions under 5 ms?" });
    const spTasks = uR(sp4.dir, "tasks.md");
    const spTick = S.completeTask(p4, sp4.slug, 1);
    const spUn = S.completeTask(p4, sp4.slug, 1, undefined, { undo: true });
    ok(bug4.includes(rcTodo) && tk4.ok && tk4.verified && un4.ok && un4.unticked && re4.ok === false && re4.gated === "root-cause" &&
      spTick.ok && spUn.ok && spUn.unticked && uR(sp4.dir, "tasks.md") === spTasks && S.finishFeature(p4, sp4.slug).openTasks.includes(1),
      "1.16 U1: a bugfix's fix task is unticked while bug.md → Root Cause is empty again (the root-cause gate refuses ticks, never an undo — the re-tick is gated); a spike's investigation task unticks and finish sees it open (got " +
      js([un4.ok, re4.gated, spUn.unticked]) + ")");

    // ---- U2: revoke an approval ----
    const p6 = uDir("revoke");
    S.initProject(p6, ["core"], "en");
    const f6 = uFeature(p6, "login");
    S.approvePhase(p6, "login", null, "u", { through: "tasks" });
    const hist6 = () => fs.readdirSync(path.join(f6.dir, ".history")).length;
    const h0 = hist6();
    const rv6 = (await uCall("spec_approve", { name: "login", phase: "requirements", revoke: true, reason: "the scope changed", by: "ana", projectDir: p6 })).p;
    const st6 = uSt(f6.dir);
    const rec6 = st6.approvalHistory[st6.approvalHistory.length - 1];
    const doc6 = S.specDoctor(p6, "login");
    const na6 = S.nextAction(p6, "login");
    const apLater = S.approvePhase(p6, "login", "design", "u");
    const fin6 = S.finishFeature(p6, "login");
    ok(rv6.ok && rv6.revoked === "requirements" && rv6.revokedApproval === true && js(rv6.laterApproved) === '["design","tasks"]' && !st6.approvals.requirements &&
      st6.approvals.design && st6.approvals.tasks && rec6.revoked === true && rec6.phase === "requirements" && rec6.by === "ana" && rec6.reason === "the scope changed" &&
      rec6.snapshot === undefined && typeof rec6.approvedAt === "string" && hist6() === h0 &&
      /^Revoked the approval of 'requirements' for login — the phase is pending again .* Nothing cascades: the later phases stay approved \(design, tasks\)/.test(rv6.message) &&
      doc6.pendingGates.includes("requirements") && na6.step === "approve" && /requirements/.test(na6.recommendation) &&
      apLater.ok === false && apLater.failing.includes("phase-order") && fin6.pendingGates.includes("requirements") && !fin6.readyToFinish,
      "1.16 U2: spec_approve {revoke, reason} removes the approval and appends {phase, at, by, revoked, reason, approvedAt} to approvalHistory (no snapshot); it never cascades (laterApproved stay approved) — the phase is pending again for doctor / next_action / finish, and a later phase's re-approval is refused on phase-order (got " +
      js([rv6.message, na6.step, apLater.failing]) + ")");
    const ra6 = S.approvePhase(p6, "login", "requirements", "u");
    const m6 = S.metrics(p6, "login");
    const im6 = S.impactReport(p6, "login", { phase: "requirements" });
    const eR = [S.approvePhase(p6, "login", "eval-plan", "u", { revoke: true }), S.approvePhase(p6, "login", "design", "u", { revoke: true, force: true }),
      S.approvePhase(p6, "login", null, "u", { revoke: true, through: "tasks" }), S.approvePhase(p6, "login", "design", "u", { revoke: true, expires: "30d" }),
      S.approvePhase(p6, "login", null, "u", { revoke: true })];
    ok(ra6.ok && ra6.snapshot && m6.revokedApprovals === 1 && m6.reworkByPhase && m6.reworkByPhase.requirements === 1 && m6.untickedTasks === 0 && im6.ok && im6.changed === false &&
      eR.every((r) => r.ok === false) && eR[0].notApproved === true && /nothing to revoke/.test(eR[0].error) && /revoke takes no force or expires/.test(eR[1].error) &&
      /not through/.test(eR[2].error) && /revoke takes no force or expires/.test(eR[3].error) && /Name the phase whose approval to revoke/.test(eR[4].error) && uSt(f6.dir).approvals.design,
      "1.16 U2: re-approving a revoked phase snapshots it again (metrics: revokedApprovals 1, rework counts approvals only; spec_impact diffs the new snapshot); revoking an unapproved phase, with force / expires / through, or without a phase is refused (got " +
      js([m6.revokedApprovals, m6.reworkByPhase, eR.map((r) => r.error)]) + ")");
    // Roles: a waiting sign-off is withdrawn (history record partial), then a completed approval by roles is revoked with its sign-offs.
    const p7 = uDir("revoke-roles");
    S.initProject(p7, ["core"], "en", { approvalRoles: { design: ["tech", "security"] } });
    const f7 = uFeature(p7, "login");
    ["classification", "requirements"].forEach((ph) => S.approvePhase(p7, "login", ph, "u"));
    const tech7 = S.approvePhase(p7, "login", "design", "u", { role: "tech" });
    const w7 = S.approvePhase(p7, "login", "design", "u", { revoke: true, reason: "signed the wrong draft" });
    const st7a = uSt(f7.dir);
    const rec7 = st7a.approvalHistory[st7a.approvalHistory.length - 1];
    S.approvePhase(p7, "login", "design", "u", { role: "tech" });
    const sec7 = S.approvePhase(p7, "login", "design", "u", { role: "security" });
    const v7 = S.approvePhase(p7, "login", "design", "u", { revoke: true });
    const st7b = uSt(f7.dir);
    ok(tech7.ok && tech7.pending && w7.ok && w7.revokedApproval === false && js(w7.withdrawnSignOffs) === '["tech"]' && /Withdrew the role sign-off\(s\) waiting for 'design' of login: tech/.test(w7.message) &&
      st7a.signoffs === undefined && rec7.revoked === true && rec7.partial === true && js(rec7.roles) === '["tech"]' &&
      sec7.ok && sec7.complete === true && v7.ok && v7.revokedApproval === true && !st7b.approvals.design && st7b.signoffs === undefined &&
      S.specDoctor(p7, "login").pendingRoles.design && js(S.specDoctor(p7, "login").pendingRoles.design.missing) === '["tech","security"]',
      "1.16 U2 + roles: revoking a phase that only waits for sign-offs withdraws them (history record revoked + partial, the roles listed); a completed approval by roles is revoked with them — every role signs again (got " +
      js([w7, rec7, S.specDoctor(p7, "login").pendingRoles]) + ")");
    // execution: its sign-off is asked for again; ES wording; the approval guard reads a revocation as one (never as an approval).
    const p8 = uDir("revoke-exec");
    S.initProject(p8, ["core"], "en");
    uFeature(p8, "login");
    S.approvePhase(p8, "login", null, "u", { through: "tasks" });
    [1, 2].forEach((n) => S.completeTask(p8, "login", n, { command: uRun, exitCode: 0 }));
    S.finishFeature(p8, "login", { write: true });
    S.approvePhase(p8, "login", "execution", "u");
    const na8a = S.nextAction(p8, "login");
    const rv8 = S.approvePhase(p8, "login", "execution", "u", { revoke: true, reason: "QA found a regression" });
    const na8b = S.nextAction(p8, "login");
    const fEs8 = S.createFeature(p8, "Pagos", ["core"], "x", undefined, "es");
    S.approvePhase(p8, fEs8.slug, "classification", "u", { force: true });
    const rvEs = S.approvePhase(p8, fEs8.slug, "classification", "u", { revoke: true });
    const g8 = S.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: "mcp__plugin_dev-spec-driven_spec-driven__spec_approve", tool_input: { name: "login", phase: "design", revoke: true, reason: "no longer valid" } }, "deny", { cli: "/x/cli/dev-spec.js" });
    ok(na8a.step === "finished" && /Nothing left to do here/.test(na8a.recommendation) && rv8.ok && rv8.revoked === "execution" && js(rv8.laterApproved) === "[]" &&
      na8b.step === "finished" && /\/approve login execution/.test(na8b.recommendation) &&
      /^Aprobación de 'classification' revocada en pagos — la fase vuelve a estar pendiente/.test(rvEs.message) &&
      g8.decision === "deny" && g8.actions[0].revoke === true && /revoke the approval of the design phase of 'login'/.test(g8.reason) &&
      g8.command === '! node "/x/cli/dev-spec.js" approve login design --revoke --reason "no longer valid"',
      "1.16 U2: revoking the execution sign-off has next_action ask for it again; an ES feature's message is Spanish; the approval guard gates a revocation (deny) and hands the human an `approve … --revoke` line — never an approve line (got " +
      js([na8b.recommendation, rvEs.message, g8.command]) + ")");

    // ---- U3: waivers on a forced approval ----
    const p9 = uDir("waiver");
    S.initProject(p9, ["core"], "en");
    const f9 = S.createFeature(p9, "Checkout", ["core"], "x", undefined, "en"); // a fresh scaffold: every gate fails on its placeholders
    const w9 = (await uCall("spec_approve", { name: "checkout", phase: "classification", force: true, reason: "demo on Friday", expires: "30d", projectDir: p9 })).p;
    const exp30 = new Date(Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z") + 30 * 864e5).toISOString().slice(0, 10);
    const st9 = uSt(f9.dir);
    ok(w9.ok && w9.forced === true && js(w9.waiver) === js({ reason: "demo on Friday", expires: exp30 }) && js(st9.approvals.classification.waiver) === js(w9.waiver) &&
      js(st9.approvalHistory[st9.approvalHistory.length - 1].waiver) === js(w9.waiver) && new RegExp("Waiver recorded: demo on Friday \\(expires " + exp30 + "\\)\\.$").test(w9.note) &&
      !S.specDoctor(p9, "checkout").checks.some((c) => c.id === "waiver-expired"),
      "1.16 U3: spec_approve {force, reason, expires: '30d'} records waiver {reason, expires: today + 30 d} on the approval and its history record, and says so; not expired → no waiver-expired (got " + js([w9.waiver, w9.note]) + ")");
    const bad9 = [S.approvePhase(p9, "checkout", "requirements", "u", { reason: "no force" }), S.approvePhase(p9, "checkout", "requirements", "u", { expires: "30d" }),
      S.approvePhase(p9, "checkout", "requirements", "u", { force: true, expires: "2020-01-01" }), S.approvePhase(p9, "checkout", "requirements", "u", { force: true, expires: "3651d" }),
      S.approvePhase(p9, "checkout", "requirements", "u", { force: true, expires: "soon" }), S.approvePhase(p9, "checkout", "requirements", "u", { force: true, expires: "2027-02-30" }),
      S.approvePhase(p9, "checkout", "requirements", "u", { force: true, expires: "0d" })];
    const badMcp = await rpc("tools/call", { name: "spec_approve", arguments: { name: "checkout", phase: "requirements", force: true, expires: 30, projectDir: p9 } });
    ok(bad9.every((r) => r.ok === false) && /go with force/.test(bad9[0].error) && /go with force/.test(bad9[1].error) &&
      bad9.slice(2).every((r) => /expires must be an ISO date \(YYYY-MM-DD, today or later, at most 3650 days ahead\) or a number of days/.test(r.error)) &&
      badMcp.result.isError === true && !uSt(f9.dir).approvals.requirements,
      "1.16 U3: reason / expires without force, an expiry in the past, beyond 3650 days, unreadable, an impossible date or 0d, and a non-string expires (schema) are refused — nothing recorded (got " + js(bad9.map((r) => r.error)) + ")");
    // Expired: doctor warns waiver-expired, ROADMAP.md flags it, spec_finish lists every forced approval (waivers, merge summary) and warns.
    const s9 = uSt(f9.dir);
    s9.approvals.classification.waiver.expires = "2020-01-01";
    uPut(f9.dir, s9);
    S.approvePhase(p9, "checkout", "requirements", "u", { force: true }); // a force without a reason stays allowed: no waiver, no new warning
    const d9 = S.specDoctor(p9, "checkout").checks.find((c) => c.id === "waiver-expired");
    S.roadmapReport(p9, { write: true });
    const rm9 = uR(path.join(p9, ".specs"), "ROADMAP.md");
    const fn9 = S.finishFeature(p9, "checkout", { includeBody: true });
    ok(d9 && d9.status === "warn" && /^forced approvals whose waiver expired: classification \(expired 2020-01-01 — demo on Friday\) — /.test(d9.detail) && !/requirements \(expired/.test(d9.detail) &&
      /classification \(waiver: demo on Friday, EXPIRED 2020-01-01\), requirements\n/.test(rm9) && uSt(f9.dir).approvals.requirements.waiver === undefined &&
      fn9.waivers.length === 2 && fn9.waivers[0].expired === true && fn9.waivers[0].reason === "demo on Friday" && fn9.waivers[1].reason === undefined && fn9.waivers[1].expired === false &&
      fn9.warnings.some((w) => /^waivers expired on forced approvals: classification \(expired 2020-01-01/.test(w)) &&
      /## Waived gates \(forced approvals\)\n- classification — forced over: [^\n]*· reason: demo on Friday · EXPIRED 2020-01-01\n- requirements — forced over: [^\n]*· no reason recorded\n/.test(fn9.mergeSummary),
      "1.16 U3: an expired waiver — doctor warns waiver-expired (stable id), ROADMAP.md shows the forced approval with its waiver flagged EXPIRED, spec_finish lists every forced approval (`waivers`, the merge summary's Waived gates) and warns; a force without a reason records no waiver (got " +
      js([d9 && d9.detail, fn9.waivers, (rm9.match(/^.*--force.*$/m) || [])[0]]) + ")");
    // A passing gate waives nothing; roles: the completed approval carries the forced sign-off's waiver; PT wording.
    const p10 = uDir("waiver-more");
    S.initProject(p10, ["core"], "en", { approvalRoles: { requirements: ["product", "qa"] } });
    uFeature(p10, "login");
    const ok10 = S.approvePhase(p10, "login", "classification", "u", { force: true, reason: "just in case" });
    const f10 = S.createFeature(p10, "Search", ["core"], "x", undefined, "en");
    S.approvePhase(p10, "search", "classification", "u", { force: true });
    const pr10 = S.approvePhase(p10, "search", "requirements", "u", { force: true, role: "product", reason: "legal review pending", expires: "10d" });
    const qa10 = S.approvePhase(p10, "search", "requirements", "u", { force: true, role: "qa" });
    const a10 = uSt(f10.dir).approvals.requirements;
    const fPt10 = S.createFeature(p10, "Pagamentos", ["core"], "x", undefined, "pt");
    S.approvePhase(p10, fPt10.slug, "classification", "u", { force: true, reason: "demo" });
    const sPt = uSt(fPt10.dir);
    sPt.approvals.classification.waiver.expires = "2021-03-04";
    uPut(fPt10.dir, sPt);
    const dPt = S.specDoctor(p10, fPt10.slug).checks.find((c) => c.id === "waiver-expired") || {};
    ok(ok10.ok && !ok10.forced && ok10.waiverIgnored === true && /nothing was waived/.test(ok10.note) && !uSt(path.join(p10, ".specs", "login")).approvals.classification.waiver &&
      pr10.ok && pr10.pending && js(pr10.waiver) === js({ reason: "legal review pending", expires: new Date(Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z") + 10 * 864e5).toISOString().slice(0, 10) }) &&
      qa10.ok && qa10.complete === true && a10.forced === true && js(a10.waiver) === js(pr10.waiver) && a10.roles.product.waiver && !a10.roles.qa.waiver &&
      /^aprovações forçadas cuja exceção expirou: classification \(expirou a 2021-03-04 — demo\)/.test(dPt.detail || ""),
      "1.16 U3: a force whose gate passes waives nothing (waiverIgnored, nothing stored); with roles the completed approval carries the forced sign-off's waiver; doctor's waiver-expired is in the feature's language (PT) (got " +
      js([ok10.note, a10.waiver, dPt.detail]) + ")");
    const ga = S.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: 'node cli/dev-spec.js approve login design --force --reason "demo day" --expires 30d' } }, "deny", { cli: "/x/cli/dev-spec.js" });
    const gb = S.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: `node cli/dev-spec.js approve login design --force --reason "it's late"` } }, "deny", { cli: "/x/cli/dev-spec.js" });
    ok(ga.decision === "deny" && ga.force === true && ga.command === '! node "/x/cli/dev-spec.js" approve login design --force --reason "demo day" --expires 30d' &&
      gb.command === '! node "/x/cli/dev-spec.js" approve login design --force --reason "<reason>"',
      "1.16 U3: the approval guard's command for the human carries the waiver (--reason / --expires) — a reason that isn't plainly safe to paste becomes a <reason> placeholder (got " + js([ga.command, gb.command]) + ")");

    // ---- U4: spec_stop_check and spec_log for MCP-only clients (the server never runs a command) ----
    const tl16 = (await rpc("tools/list", {})).result.tools;
    const stc = tl16.find((t) => t.name === "spec_stop_check") || {};
    const lgt = tl16.find((t) => t.name === "spec_log") || {};
    ok(js(stc.inputSchema && stc.inputSchema.required) === '["message"]' && js(lgt.inputSchema && lgt.inputSchema.required) === '["name","gitLog"]' &&
      lgt.inputSchema.properties.max.type === "integer" && lgt.inputSchema.properties.max.minimum === 1 && !/\n/.test(stc.description + lgt.description) &&
      /NEVER RUNS GIT/.test(lgt.description) && !/child_process/.test(fs.readFileSync(path.join(__dirname, "server.js"), "utf8")) && libSources().every((f) => !/child_process/.test(fs.readFileSync(f, "utf8"))),
      "1.16 U4: tools/list advertises spec_stop_check {message, agent?} and spec_log {name, gitLog, max?} (single-line descriptions); neither server.js nor the engine loads child_process (got " + js([stc.inputSchema, lgt.inputSchema]) + ")");
    const p12 = uDir("stop");
    S.initProject(p12, ["core"], "en");
    uFeature(p12, "login");
    S.approvePhase(p12, "login", null, "u", { through: "tasks" });
    S.completeTask(p12, "login", 1, { summary: "looked at it" }); // a note on a runnable _Verify:_: ticked, unverified
    const claim = "All tasks are done and verified.";
    const sc1 = (await uCall("spec_stop_check", { message: claim, projectDir: p12 })).p;
    const sc1cli = cli16(["stop-check", "--message", claim, "--json", "--project", p12]);
    const sc2 = (await uCall("spec_stop_check", { message: "Task 2 is done, but task 1 is not verified yet — I could not run the check here.", projectDir: p12 })).p;
    const sc3 = (await uCall("spec_stop_check", { message: "Here is the diff for review.", projectDir: p12 })).p;
    const sc4 = await rpc("tools/call", { name: "spec_stop_check", arguments: { projectDir: p12 } });
    let sc1j = null;
    try { sc1j = JSON.parse(sc1cli.out); } catch { /* stays null */ }
    ok(sc1.ok && sc1.block === true && sc1.why === "unverified" && sc1.features[0].feature === "login" && sc1.features[0].unverified[0].number === 1 &&
      /tasks are ticked without verification evidence/.test(sc1.reason) && sc1cli.code === 1 && js(sc1) === js(sc1j) &&
      sc2.block === false && sc2.why === "admitted" && sc3.block === false && sc3.why === "no-claim" && sc4.result.isError === true && /Missing required argument\(s\): message/.test(sc4.result.content[0].text),
      "1.16 U4: spec_stop_check sends a 'done' claim back while a recent tick is unverified (block, why unverified — the same JSON as `dev-spec stop-check --json`, exit 1); an honest admission and a message without a claim pass; message is required (got " +
      js([sc1.why, sc2.why, sc3.why]) + ")");
    const p13 = uDir("log");
    S.initProject(p13, ["core"], "en");
    uFeature(p13, "login");
    const log13 = ["commit 1111111111111111111111111111111111111111", "Author: Ana <ana@example.com>", "Date:   2026-09-20T10:00:00+00:00", "", "    feat(login): show the error", "", "    Part of .specs/login/ task #2.", "", "src/login.js", "",
      "commit 2222222222222222222222222222222222222222", "Author: Ana <ana@example.com>", "Date:   2026-09-19T10:00:00+00:00", "", "    feat(login): the handler", "", "    Part of .specs/login/ task #1.", "", "src/handler.js", "",
      "commit 3333333333333333333333333333333333333333", "Author: Bo <bo@example.com>", "Date:   2026-09-18T10:00:00+00:00", "", "    chore: bump deps (task #1 of billing)", "", "package.json", ""].join("\n");
    const lg1 = (await uCall("spec_log", { name: "login", gitLog: log13, projectDir: p13 })).p;
    const lg2 = (await uCall("spec_log", { name: "login", gitLog: log13, max: 3, projectDir: p13 })).p;
    const lgC1 = cli16(["log", "login", "-", "--json", "--project", p13], log13);
    const lgC2 = cli16(["log", "login", "-", "--max", "3", "--json", "--project", p13], log13);
    const lg3 = await rpc("tools/call", { name: "spec_log", arguments: { name: "login", projectDir: p13 } });
    const lg4 = await uCall("spec_log", { name: "nope", gitLog: log13, projectDir: p13 });
    let lgj1 = null, lgj2 = null;
    try { lgj1 = JSON.parse(lgC1.out); lgj2 = JSON.parse(lgC2.out); } catch { /* stay null */ }
    ok(lg1.ok && lg1.commits === 3 && lg1.citing === 2 && lg1.truncated === false && lg1.tasks[0].commits[0].short === "2222222" && lg1.tasks[1].commits[0].short === "1111111" &&
      js(lg1.tasks[0].commits[0].via) === '["#1"]' && lg2.truncated === true && js(lg1) === js(lgj1) && js(lg2) === js(lgj2) && !fs.existsSync(path.join(p13, ".git")) &&
      lg3.result.isError === true && /Missing required argument\(s\): gitLog/.test(lg3.result.content[0].text) && lg4.isError,
      "1.16 U4: spec_log reads the git log TEXT the client passes (no repository needed — the server runs no git): commits per task, a foreign feature's '#1' ignored, `max` marks a full window (truncated) — the same JSON as `dev-spec log <f> - [--max N] --json`; gitLog is required (got " +
      js([lg1.citing, lg1.tasks.map((t) => t.commits.map((c) => c.short)), lg2.truncated]) + ")");

    // ---- 1.16 U review fixes ----
    // 1: an _Expect: fail_ task undone after its fix went green keeps its red run (staleBy "undo" still proves the red phase): the
    // re-tick's pass is the fix going green. An EDITED _Verify:_ still drops it; a spec_impact reopen (stale, no staleBy) too.
    const pR1 = uDir("review-red");
    S.initProject(pR1, ["core"], "en");
    const tR1 = "# Tasks\n\n- [ ] 1. Write test T-01 and watch it fail\n  - _Verify: node t01.js_\n  - _Expect: fail_\n- [ ] 2. Make T-01 pass\n  - _Verify: node t01.js_\n" +
      "- [ ] 3. Write test T-02 and watch it fail\n  - _Verify: node t02.js_\n  - _Expect: fail_\n";
    const fR1 = uFeature(pR1, "redg", tR1);
    const redR1 = S.completeTask(pR1, "redg", 1, { command: "node t01.js", exitCode: 1, summary: "not ok 1 T-01" });
    const fixR1 = S.completeTask(pR1, "redg", 2, { command: "node t01.js", exitCode: 0 });
    const unR1 = (await uCall("spec_complete_task", { name: "redg", number: 1, undo: true, reason: "meant task 2", projectDir: pR1 })).p;
    const reR1 = S.completeTask(pR1, "redg", 1, { command: "node t01.js", exitCode: 0 }); // the fix is in: the test passes now
    const recR1 = uSt(fR1.dir).evidence["1"];
    S.completeTask(pR1, "redg", 3, { command: "node t02.js", exitCode: 1, summary: "not ok 1 T-02" });
    S.completeTask(pR1, "redg", 3, undefined, { undo: true });
    uW(fR1.dir, "tasks.md", uR(fR1.dir, "tasks.md").replace("_Verify: node t02.js_", "_Verify: node t02b.js_")); // the command changed
    const edR1 = S.completeTask(pR1, "redg", 3, { command: "node t02b.js", exitCode: 0 });
    const stR1 = uSt(fR1.dir);
    stR1.evidence["1"].stale = true; // what spec_impact --reopen writes (no staleBy): the spec changed — the red run must be made again
    uPut(fR1.dir, stR1);
    const roR1 = S.completeTask(pR1, "redg", 1, { command: "node t01.js", exitCode: 0 });
    ok(redR1.verified && fixR1.verified && unR1.ok && unR1.unticked && unR1.redKept === true &&
      /Its red run of \d{4}-\d\d-\d\d \(the _Expect: fail_ proof\) is kept: .* a passing run counts as the fix going green: node "[^"]*dev-spec\.js" done redg 1 --run\./.test(unR1.note) &&
      !/no longer counts/.test(unR1.note) && reR1.ok && reR1.verified === true && !reR1.unverifiedReason && recR1.stale === undefined && recR1.red && recR1.red.exitCode === 1 &&
      edR1.ok === false && edR1.unexpectedPass === true && roR1.ok === false && roR1.unexpectedPass === true &&
      S.msg("pt").undo.redKept(1, "x", "d") !== S.msg("en").undo.redKept(1, "x", "d") && /prueba de _Expect: fail_/.test(S.msg("es").undo.redKept(1, "x", "d")),
      "1.16 U review 1: undoing an _Expect: fail_ task after its fix went green keeps its red run (redKept, a note that says so — EN / PT / ES) and a passing re-tick verifies it (the red run carried as `red`); an edited _Verify:_ or a spec_impact reopen (stale without staleBy) still needs a new red run — unexpected-pass (got " +
      js([unR1.note, reR1.unverifiedReason, recR1.red, edR1.error, roR1.unexpectedPass]) + ")");
    // 1 (observed mode): the red proof's own stamp still decides — a CLI-made red run proves, an unobserved one leaves it unobserved.
    const pR1o = uDir("review-red-observed");
    S.initProject(pR1o, ["core"], "en", { evidence: "observed" });
    uFeature(pR1o, "redg", tR1);
    S.completeTask(pR1o, "redg", 1, { command: "node t01.js", exitCode: 1, summary: "not ok 1 T-01" }, { ranBy: "cli" });
    S.completeTask(pR1o, "redg", 3, { command: "node t02.js", exitCode: 1, summary: "not ok 1 T-02" }); // reported, never observed
    [1, 3].forEach((n) => S.completeTask(pR1o, "redg", n, undefined, { undo: true }));
    const o1 = S.completeTask(pR1o, "redg", 1, { command: "node t01.js", exitCode: 0 }, { ranBy: "cli" });
    const o3 = S.completeTask(pR1o, "redg", 3, { command: "node t02.js", exitCode: 0 }, { ranBy: "cli" });
    ok(o1.ok && o1.verified === true && o3.ok && o3.verified === false && o3.unverifiedReason === "unobserved",
      "1.16 U review 1 (meta.evidence observed): after an undo the kept red run's own stamp decides — a CLI-made red run verifies the passing re-tick, a reported one leaves it unobserved (got " +
      js([o1.unverifiedReason, o3.unverifiedReason]) + ")");

    // 2: several TICKED tasks share a number — undo refuses (duplicateTicked, the tasks named), nothing changed; once renumbered it works.
    const pR2 = uDir("review-dup");
    S.initProject(pR2, ["core"], "en");
    const fR2 = uFeature(pR2, "dup", "# Tasks\n\n- [ ] 1. Alpha\n  - _Verify: " + uRun + "_\n- [ ] 1. Beta\n  - _Verify: " + uRun + "_\n- [ ] 2. Gamma\n");
    S.completeTask(pR2, "dup", 1, { command: uRun, exitCode: 0 }); // Alpha, verified
    S.completeTask(pR2, "dup", 1); // Beta, ticked by mistake
    const bR2 = [uR(fR2.dir, "tasks.md"), uR(fR2.dir, ".state.json")];
    const dR2 = await uCall("spec_complete_task", { name: "dup", number: 1, undo: true, reason: "undo the mistaken tick", projectDir: pR2 });
    const aR2 = [uR(fR2.dir, "tasks.md"), uR(fR2.dir, ".state.json")];
    uW(fR2.dir, "tasks.md", bR2[0].replace("- [x] 1. Beta", "- [x] 3. Beta"));
    const nR2 = S.completeTask(pR2, "dup", 3, undefined, { undo: true });
    const sR2 = uSt(fR2.dir).evidence["1"];
    ok(dR2.isError && dR2.p.duplicateTicked === true && js(dR2.p.tasks) === js([{ number: 1, line: 3, text: "Alpha" }, { number: 1, line: 5, text: "Beta" }]) &&
      /^Several ticked tasks share number 1 \(line 3: "Alpha", line 5: "Beta"\) — undo can't tell which tick was the mistake\. .*Nothing was changed\.$/.test(dR2.p.error) &&
      aR2[0] === bR2[0] && aR2[1] === bR2[1] && nR2.ok && nR2.unticked && /- \[x\] 1\. Alpha/.test(uR(fR2.dir, "tasks.md")) &&
      [sR2].concat(sR2.others || []).every((r) => r.stale === undefined) && /^Varias tareas marcadas comparten el número 1/.test(S.msg("es").undo.duplicateTicked(1, "x")),
      "1.16 U review 2: undo with several ticked tasks sharing the number is refused (duplicateTicked + tasks [{number, line, text}], localized) — tasks.md and .state.json untouched, Alpha's passing run never staled; renumbered, the mistaken tick undoes alone (got " +
      js([dR2.p, nR2.ok]) + ")");

    // 3: a revocation after the finish makes the finish stale — the catalog / SPECS.md read complete (not finished), drift says stale
    // (CLI exit 1, the why names it) — and the pending gate alone keeps the catalog off "finished"; re-approved and finished again, it is finished.
    const pR3 = uDir("review-revoke-finished");
    S.initProject(pR3, ["core"], "en");
    uFeature(pR3, "login");
    S.approvePhase(pR3, "login", null, "u", { through: "tasks" });
    [1, 2].forEach((n) => S.completeTask(pR3, "login", n, { command: uRun, exitCode: 0 }));
    S.finishFeature(pR3, "login", { write: true });
    S.approvePhase(pR3, "login", "execution", "u");
    S.catalog(pR3, { write: true }); // SPECS.md exists: every mutation refreshes it
    const catR3 = () => (S.catalog(pR3, {}).features.find((x) => x.feature === "login") || {}).status;
    const c0R3 = catR3();
    const rvR3 = (await uCall("spec_approve", { name: "login", phase: "requirements", revoke: true, projectDir: pR3 })).p;
    const c1R3 = catR3();
    const mdR3 = uR(path.join(pR3, ".specs"), "SPECS.md");
    const drR3 = S.drift(pR3, "login");
    const dcR3 = cli16(["drift", "login", "--project", pR3]);
    const stR3 = uSt(path.join(pR3, ".specs", "login"));
    const hiddenR3 = { ...stR3, approvalHistory: stR3.approvalHistory.filter((h) => !h.revoked) }; // the pending gate alone (no revoke record)
    uPut(path.join(pR3, ".specs", "login"), hiddenR3);
    const c2R3 = catR3();
    uPut(path.join(pR3, ".specs", "login"), stR3);
    S.approvePhase(pR3, "login", "requirements", "u");
    const naR3 = S.nextAction(pR3, "login");
    S.finishFeature(pR3, "login", { write: true });
    S.approvePhase(pR3, "login", "execution", "u");
    ok(c0R3 === "finished" && rvR3.ok && c1R3 === "complete" && /## ☑ login/.test(mdR3) && drR3.verdict === "stale" &&
      drR3.stale[0].since.some((x) => x.kind === "revoke" && x.phase === "requirements") && /approval revoked: requirements/.test(drR3.stale[0].why) &&
      dcR3.code === 1 && /login: changed since finish .*approval revoked: requirements/.test(dcR3.out) && c2R3 === "complete" &&
      naR3.step === "finish" && /re-approved: requirements/.test(naR3.recommendation) && !/approval revoked/.test(naR3.recommendation) &&
      catR3() === "finished" && S.drift(pR3, "login").verdict === "clean",
      "1.16 U review 3: revoking a phase of a finished feature makes its finish stale (changesSince kind revoke) — catalog / SPECS.md complete, spec_drift stale with the revocation named (CLI exit 1); a pending gate alone keeps the catalog off 'finished'; re-approved (next_action names the re-approval only) and finished again, it is finished and clean (got " +
      js([c0R3, c1R3, drR3.verdict, drR3.stale[0] && drR3.stale[0].why, c2R3, naR3.step]) + ")");

    // 5: MCP accepts an empty gitLog / message (the CLI does — an empty git log is a repository without commits); `undone` refuses
    // done's evidence flags instead of ignoring them.
    const pR5 = uDir("review-empty");
    S.initProject(pR5, ["core"], "en");
    const fR5 = uFeature(pR5, "login");
    const l5a = await uCall("spec_log", { name: "login", gitLog: "", projectDir: pR5 });
    const l5b = await uCall("spec_log", { name: "login", gitLog: "\n", projectDir: pR5 });
    const s5a = await uCall("spec_stop_check", { message: "", projectDir: pR5 });
    const n5a = await uCall("spec_log", { name: " ", gitLog: "", projectDir: pR5 }); // name stays required
    const l5cli = cli16(["log", "login", "-", "--json", "--project", pR5], "");
    S.completeTask(pR5, "login", 1, { command: uRun, exitCode: 0 });
    const tR5 = uR(fR5.dir, "tasks.md");
    const u5 = [["--evidence", "x"], ["--exit", "0"], ["--cmd", uRun], ["--run"]].map((fl) => cli16(["undone", "login", "1", ...fl, "--project", pR5]));
    const u5j = cli16(["undone", "login", "1", "--run", "--json", "--project", pR5]);
    let l5j = null, u5jj = null;
    try { l5j = JSON.parse(l5cli.out); u5jj = JSON.parse(u5j.out); } catch { /* stay null */ }
    ok(!l5a.isError && l5a.p.ok && l5a.p.commits === 0 && js(l5a.p) === js(l5j) && !l5b.isError && l5b.p.commits === 0 &&
      !s5a.isError && s5a.p.ok && s5a.p.block === false && s5a.p.why === "no-claim" && n5a.isError && /Missing required argument\(s\): name/.test(n5a.p.error) &&
      u5.every((r) => r.code === 1 && /undo takes no evidence/.test(r.err)) && u5j.code === 1 && u5jj && u5jj.ok === false && /undo takes no evidence/.test(u5jj.error) &&
      uR(fR5.dir, "tasks.md") === tR5 && !uSt(fR5.dir).unticks,
      "1.16 U review 5: spec_log {gitLog: ''} (0 commits, the CLI's JSON) and spec_stop_check {message: ''} (no-claim) are accepted — name stays required; `dev-spec undone` refuses --evidence / --exit / --cmd / --run (exit 1, localized, --json the refusal) and changes nothing (got " +
      js([l5a.p.error, s5a.p.why, n5a.p.error, u5.map((r) => r.code), u5jj]) + ")");
  }
};
