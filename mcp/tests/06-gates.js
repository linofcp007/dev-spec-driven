"use strict";
// Gates — placeholders, approve (refused / --force / phase order), next_action's steps, change requests.
// The bugfix gate, finish, the approval history and snapshots, spec_impact and reopen, metrics and retro.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, all, rpc, payload, S, root, tmp, approveBefore, list, __dirname }) => {

  { // --- 1.13 WP5: gates — placeholders, approve --force, finish/next-action, bugfix gate, clarify/EARS, roadmap, templates ---
    const w5 = path.join(tmp, "proj-wp5");
    S.initProject(w5, ["core"], "en");
    const read5 = (f, rel) => fs.readFileSync(path.join(f.dir, rel), "utf8");
    const write5 = (f, rel, text) => fs.writeFileSync(path.join(f.dir, rel), text);
    const chk = (doc, id) => doc.checks.find((c) => c.id === id) || {};
    const stateOf = (f) => JSON.parse(read5(f, ".state.json"));
    // Real content for the core chain (IDs match the template tasks, so traceability passes).
    const REQ = "# Feature: x\n\n## Summary\nExport invoices as CSV.\n\n### US-1 (P1 — MVP): Export\n#### Acceptance Criteria (EARS)\n" +
      "1. **US-1.AC-1** — WHEN an admin clicks Export THE SYSTEM SHALL download a CSV.\n2. **US-1.AC-2** — WHILE an export runs, WHEN the admin clicks again THE SYSTEM SHALL ignore it.\n" +
      "3. **US-1.AC-3** — IF the export fails THEN THE SYSTEM SHALL show the error code.\n4. **US-1.AC-4** — THE SYSTEM SHALL name files invoices-YYYY-MM.csv.\n\n" +
      "### US-2 (P2): Schedule\n#### Acceptance Criteria (EARS)\n1. **US-2.AC-1** — WHEN a schedule is due THE SYSTEM SHALL email the CSV.\n\n" +
      "## Success Criteria\n- **SC-001** — 95% of exports finish in under 5 s.\n\n## Edge Cases & Error Handling\n- **EC-1** — WHEN the month has no invoices THE SYSTEM SHALL return a header-only CSV.\n\n" +
      "## Non-Functional Requirements\n- **NFR-1** — p95 export time < 5 s.\n\n## Out of Scope\n- PDF export.\n";
    const DESIGN = "# Design: x\n\n## Overview\nA nightly job and an endpoint.\n\n## Architecture\n```mermaid\ngraph TD\n  A-->B\n```\n\n## Constitution Check\n- [x] Principle 1 — complies\n";

    // (1) placeholder gate: an untouched scaffold is never readyToAdvance; file:line detail, bounded
    const f1 = S.createFeature(w5, "Fresh gate", ["core"]);
    const d1 = S.specDoctor(w5, f1.slug);
    const ph1 = chk(d1, "placeholders");
    ok(d1.readyToAdvance === false && ph1.status === "fail" && /requirements\.md \(\d+\): requirements\.md:4 \[1-2 sentences/.test(ph1.detail) && /\+\d+ more/.test(ph1.detail) &&
      (ph1.detail.match(/requirements\.md:\d+/g) || []).length === 5,
      "doctor: a fresh scaffold fails 'placeholders' (file:line + text, first 5 + a count) and is NOT readyToAdvance");
    write5(f1, "requirements.md", REQ);
    write5(f1, "design.md", DESIGN);
    const d1b = S.specDoctor(w5, f1.slug);
    ok(d1b.phase === "design" && chk(d1b, "placeholders").status === "warn" && /tasks\.md/.test(chk(d1b, "placeholders").detail) && d1b.readyToAdvance === true &&
      chk(d1b, "success-criteria").status === "pass" && chk(d1b, "priorities").status === "pass",
      "a LATER phase still being a template (tasks.md at phase design) is only a warn; real SC-001 / P1 lines pass");
    // ...and so are the trace gaps that come only from that template: with ACs of its own (not the template's IDs), the
    // untouched tasks.md's "_Requirements: US-1.AC-3…_" lines are no typos at the design gate — traceability is deferred
    // (a warn), readyToAdvance holds and the approve gate agrees. Once tasks.md is written, a phantom there fails again.
    const f1g = S.createFeature(w5, "Digest gate", ["core"]);
    write5(f1g, "requirements.md", "# Feature: Digest\n\n## Summary\nWeekly digest.\n\n### US-1 (P1 — MVP): Digest\n#### Acceptance Criteria (EARS)\n" +
      "1. **US-1.AC-1** — WHEN the weekly job runs THE SYSTEM SHALL email each active account a digest.\n2. **US-1.AC-2** — IF an account has no activity THEN THE SYSTEM SHALL skip the email.\n\n" +
      "## Success Criteria\n- **SC-001** — 95% delivered within 1 hour.\n");
    write5(f1g, "design.md", DESIGN);
    const d1g = S.specDoctor(w5, f1g.slug);
    const tr1g = chk(d1g, "traceability");
    write5(f1g, "tasks.md", "# Tasks\n\n- [ ] 1. [US1] Send the digest\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3_\n");
    const tr1g2 = chk(S.specDoctor(w5, f1g.slug), "traceability");
    ok(d1g.phase === "design" && d1g.readyToAdvance === true && tr1g.status === "warn" && /^not traced yet — still a later phase's template: tasks\.md/.test(tr1g.detail) &&
      !/\(typos\?\)|unknown ACs/.test(tr1g.detail) && d1g.nextGate.phase === "classification" && (approveBefore(w5, f1g.slug, "design"), S.approvePhase(w5, f1g.slug, "design").ok) &&
      tr1g2.status === "fail" && /tasks reference unknown ACs \(typos\?\): US-1\.AC-3/.test(tr1g2.detail) &&
      /^ainda não rastreado/.test(S.msg("pt").gates.traceDeferred("tasks.md")) && /^aún no trazado/.test(S.msg("es").gates.traceDeferred("tasks.md")),
      "doctor at the design gate: an untouched tasks.md template's AC references are deferred (warn, 'not traced yet'), never 'typos?' — readyToAdvance, the approve gate agrees; a written tasks.md's phantom still fails (got " + tr1g.status + ": " + tr1g.detail + " | " + [d1g.phase, d1g.readyToAdvance, d1g.nextGate && d1g.nextGate.phase, tr1g2.status, tr1g2.detail].join(" · ") + ")");
    // EARS: a template criterion is reported with the stable code 'placeholder' (warn) — never 'clean'
    const e1 = S.earsValidate("1. **US-1.AC-1** — WHEN [trigger] THE SYSTEM SHALL [behavior]\n2. **US-1.AC-2** — WHEN x THE SYSTEM SHALL y");
    ok(e1.verdict === "pass" && e1.summary.placeholders === 1 && e1.issues.filter((i) => i.code === "placeholder").length === 1 &&
      e1.issues.find((i) => i.code === "placeholder").severity === "warn" && /\[trigger\] \[behavior\]/.test(e1.issues.find((i) => i.code === "placeholder").msg),
      "ears_validate reports template placeholder criteria with code 'placeholder' (warn)");
    const hookReq = (file) => { const r = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "spec-hook.js")], { input: JSON.stringify({ hook_event_name: "PostToolUse", tool_input: { file_path: file } }), encoding: "utf8" }); try { return JSON.parse(r.stdout).hookSpecificOutput.additionalContext; } catch { return ""; } };
    const f1h = S.createFeature(w5, "Hook gate", ["core"]);
    write5(f1h, "requirements.md", REQ.replace("Export invoices as CSV.", "[1-2 sentences: what this does and why it matters]"));
    const hk1 = hookReq(path.join(f1h.dir, "requirements.md"));
    write5(f1h, "requirements.md", REQ);
    const hk2 = hookReq(path.join(f1h.dir, "requirements.md"));
    ok(/Template placeholders: 1 left in requirements\.md \(L4 \[1-2 sentences: what this does and why …\)/.test(hk1) && !/all clean/.test(hk1) && /all clean ✓/.test(hk2),
      "PostToolUse on requirements.md: a placeholder outside any criterion still stops 'all clean' (count + line, localized); clean once filled");
    // The hook's EARS severity label is the one `dev-spec ears` prints in the spec's language (PT 'aviso' / ES 'error').
    const hkL = ["pt", "es"].map((l) => {
      const d = path.join(tmp, "proj-wp5-hook-" + l);
      const f = S.createFeature(d, "Gancho " + l, ["core"], undefined, undefined, l);
      fs.writeFileSync(path.join(f.dir, "requirements.md"), "## Critérios de Aceitação\n1. **US-1.AC-1** — " + (l === "pt" ? "QUANDO x O SISTEMA DEVE responder.\n2. QUANDO y O SISTEMA DEVE responder de forma rápida e adequada.\n" : "CUANDO x EL SISTEMA DEBE responder.\n2. CUANDO y EL SISTEMA DEBE responder de forma rápida y adecuada.\n"));
      return hookReq(path.join(f.dir, "requirements.md"));
    });
    ok(hkL.every((h) => /\[aviso\]/.test(h) && !/\[warn\]/.test(h)),
      "PostToolUse on a PT/ES requirements.md: the EARS severity is localized ([aviso]) like `dev-spec ears`, never [warn] (got " + JSON.stringify(hkL) + ")");
    // A stray, never-closed "<!--" above the criteria: the requirements approve gate still sees (and refuses) the broken
    // AC below it, and a placeholder below it is still a placeholder — EARS used to see 0 criteria and pass.
    const f1u = S.createFeature(w5, "Unclosed gate", ["core"]);
    write5(f1u, "requirements.md", REQ.replace("#### Acceptance Criteria (EARS)\n1.", "#### Acceptance Criteria (EARS)\n<!-- TODO: revisit wording\n1.")
      .replace("4. **US-1.AC-4** — THE SYSTEM SHALL name files invoices-YYYY-MM.csv.", "4. **US-1.AC-4** — passwords are stored hashed, fast and secure."));
    const ap1u = S.approvePhase(w5, f1u.slug, "requirements");
    const ph1u = S.placeholderReport("# x\n<!-- stray\n- [trigger]\n");
    ok(ap1u.ok === false && ap1u.failing.includes("ears") && chk(S.specDoctor(w5, f1u.slug), "ears").status === "fail" &&
      S.traceCheck(w5, f1u.slug).totalAcs === 5 && ph1u.length === 1 && ph1u[0].text === "[trigger]" && ph1u[0].line === 3,
      "an unclosed '<!--' above the ACs: approve requirements is refused on 'ears' (doctor ears fails; trace still counts 5 ACs); a placeholder below a stray marker is still reported");

    // (2) approve gate: refused while the phase's checks fail; force records forced + failing ids; nothing to approve = error
    const f2 = S.createFeature(w5, "Approve gate", ["core"]);
    approveBefore(w5, f2.slug, "requirements"); // the classification (a template: forced) — phase by phase
    const ap1 = S.approvePhase(w5, f2.slug, "requirements");
    ok(ap1.ok === false && ap1.refused && ap1.failing.join() === "placeholders,success-criteria,priorities" && /✗ placeholders — requirements\.md \(\d+\): requirements\.md:4/.test(ap1.error) &&
      /force: true/.test(ap1.error) && !stateOf(f2).approvals.requirements, "approve on the template is REFUSED, listing the failing check ids + details — nothing recorded");
    const ap2 = payload(await rpc("tools/call", { name: "spec_approve", arguments: { name: f2.slug, phase: "requirements", force: true, projectDir: w5 } }));
    const d2 = S.specDoctor(w5, f2.slug);
    ok(ap2.ok && ap2.forced === true && stateOf(f2).approvals.requirements.forced === true && stateOf(f2).approvals.requirements.failing.join() === "placeholders,success-criteria,priorities" &&
      chk(d2, "approval-gates").status === "warn" && /approved with force over failing checks: classification \(placeholders\), requirements \(placeholders, success-criteria, priorities\)/.test(chk(d2, "approval-gates").detail) &&
      d2.forcedGates.join() === "classification,requirements", "spec_approve {force: true} records forced + failing ids; doctor's approval-gates shows it as a warn (got " +
      JSON.stringify([ap2.ok, ap2.forced, stateOf(f2).approvals.requirements, chk(d2, "approval-gates").detail, d2.forcedGates]) + ")");
    write5(f2, "requirements.md", REQ);
    const ap3 = S.approvePhase(w5, f2.slug, "requirements");
    ok(ap3.ok && !ap3.forced && !stateOf(f2).approvals.requirements.forced, "a clean re-approval replaces the forced one");
    const noEval = S.approvePhase(w5, f2.slug, "eval-plan", undefined, { force: true });
    const noPlan = payload(await rpc("tools/call", { name: "spec_approve", arguments: { name: f2.slug, phase: "test-plan", force: true, projectDir: w5 } }));
    ok(noEval.ok === false && noEval.nothingToApprove && /Nothing to approve: 'eval-plan'/.test(noEval.error) && noPlan.ok === false && /test-plan\.md/.test(noPlan.error) &&
      !stateOf(f2).approvals["eval-plan"], "approving a phase with no artifact (eval-plan without +ai, test-plan without +tdd) is an error even with force");
    // execution is the sign-off after a READY finish: spec_finish's blockers are its checks (stable ids); forced otherwise.
    // tests (Phase 4) is track-conditional: a core-only feature has nothing to approve, not even with force.
    const ex2 = S.approvePhase(w5, f2.slug, "execution");
    const exMcp2 = payload(await rpc("tools/call", { name: "spec_approve", arguments: { name: f2.slug, phase: "execution", projectDir: w5 } }));
    const noTests2 = S.approvePhase(w5, f2.slug, "tests", undefined, { force: true });
    const before2 = stateOf(f2).approvals;
    const exF2 = S.approvePhase(w5, f2.slug, "execution", undefined, { force: true });
    const m2 = S.metrics(w5, f2.slug);
    all("approve execution runs spec_finish's blockers (open-tasks, placeholders, approval-gates… — same on MCP) and is refused on an unfinished feature; --force records it as forced; tests on a core-only feature: nothing to approve (got " + ex2.failing + ")", [
      () => ex2.ok === false, () => ex2.refused, () => ["placeholders", "open-tasks", "approval-gates"].every((id) => ex2.failing.includes(id)),
      () => /✗ open-tasks — /.test(ex2.error), () => exMcp2.ok === false, () => exMcp2.failing.join() === ex2.failing.join(),
      () => !before2.execution, () => !before2.tests, () => noTests2.ok === false, () => noTests2.nothingToApprove,
      () => /Nothing to approve: 'tests'/.test(noTests2.error), () => exF2.ok, () => exF2.forced,
      () => stateOf(f2).approvals.execution.forced === true, () => stateOf(f2).approvals.execution.failing.includes("open-tasks"),
      () => m2.forcedApprovals >= 1, () => m2.leadTime.finished != null,
    ]);
    // A core-only classification.md: the Signals line is the tool's own final answer ("- none beyond core", no brackets)
    // — filling the real slots (Blast Radius, Compliance) is enough to approve it; a pre-1.13 file's bracketed
    // "- [none beyond core]" is no placeholder either (EN/PT/ES).
    const coreOnly = [["en", "none beyond core"], ["pt", "nenhum além de core"], ["es", "ninguno además de core"]].map(([lng, phrase]) => {
      const d = path.join(tmp, "proj-core-only-" + lng);
      const fc = S.createFeature(d, "Stock alerts", ["core"], "Alert when stock is low", undefined, lng);
      const file = path.join(fc.dir, "classification.md");
      const raw = fs.readFileSync(file, "utf8");
      fs.writeFileSync(file, raw.split("\n").map((l) => (/^- /.test(l) ? l : l.replace(/\[[^\]]*\]/g, "filled"))).join("\n"));
      const fresh = raw.includes("\n- " + phrase + "\n") && S.approvePhase(d, fc.slug, "classification").ok;
      fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("- " + phrase, "- [" + phrase + "]"));
      const legacy = S.approvePhase(d, fc.slug, "classification");
      return fresh && legacy.ok && !S.featurePlaceholders(d, fc.slug, "classification.md").items.length ? "ok" : lng + ":" + (legacy.error || "fresh");
    });
    ok(coreOnly.join() === "ok,ok,ok", "a core-only classification approves once its real slots are filled — '- none beyond core' (and a legacy '[none beyond core]') is no placeholder, EN/PT/ES (got " + coreOnly.join() + ")");
    const apD = S.approvePhase(w5, f2.slug, "design");
    write5(f2, "design.md", DESIGN.replace("- [x] Principle 1 — complies\n", ""));
    const apD2 = S.approvePhase(w5, f2.slug, "design");
    write5(f2, "design.md", DESIGN);
    ok(apD.ok === false && apD.failing.includes("placeholders") && apD.failing.includes("constitution-check") && apD2.failing.join() === "constitution-check" &&
      S.approvePhase(w5, f2.slug, "design").ok, "design gate: placeholders and an empty Constitution Check refuse it; a filled design is approved");
    const apT = S.approvePhase(w5, f2.slug, "tasks");
    write5(f2, "tasks.md", "# Tasks\n\n- [ ] 1. [US1] Build the CSV writer\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-9_\n");
    const apT2 = S.approvePhase(w5, f2.slug, "tasks");
    write5(f2, "tasks.md", "# Tasks\n\n- [ ] 1. [US1] Build the CSV writer\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4, US-2.AC-1_\n  - _Verify: [manual: open the CSV in a spreadsheet]_\n");
    ok(apT.ok === false && apT.failing.includes("placeholders") && apT2.ok === false && apT2.failing.join() === "traceability" &&
      /US-1\.AC-4/.test(apT2.error) && /US-1\.AC-9/.test(apT2.error) && S.approvePhase(w5, f2.slug, "tasks").ok,
      "tasks gate: template tasks, uncovered ACs and phantom IDs refuse it; a '[manual: …]' _Verify:_ is not a placeholder");
    const f2t = S.createFeature(w5, "Plan gate", ["tdd"]);
    write5(f2t, "requirements.md", REQ);
    write5(f2t, "test-plan.md", "# Test Plan\n\n| Test ID | Covers |\n|---|---|\n| T-01 | US-1.AC-1 |\n");
    approveBefore(w5, f2t.slug, "test-plan");
    const apP = S.approvePhase(w5, f2t.slug, "test-plan");
    ok(apP.ok === false && apP.failing.join() === "traceability" && /ACs with no planned test: US-1\.AC-2/.test(apP.error), "test-plan gate: every AC needs a planned test");
    const f2b = S.createFeature(w5, "Bug gate", undefined, "crash", undefined, "en", "bugfix");
    const apB1 = S.approvePhase(w5, f2b.slug, "requirements", undefined, { force: true });
    const apB2 = S.approvePhase(w5, f2b.slug, "design");
    const apB3 = S.approvePhase(w5, f2b.slug, "classification", undefined, { force: true });
    // (1.24 review 6, E8: the design gate — bug.md — also reads its Reproduction and its slots, as doctor does)
    ok(apB1.forced && apB1.failing.includes("reproduction") && apB2.ok === false && apB2.failing.join() === "root-cause,reproduction,placeholders" && apB3.ok === false && apB3.nothingToApprove,
      "bugfix: requirements needs bug.md Reproduction, design needs its Root Cause (+ its Reproduction, no bug.md slot left; no design.md), classification has nothing to approve (got " + JSON.stringify(apB2.failing) + ")");
    const w5pt = path.join(tmp, "proj-wp5-pt");
    S.initProject(w5pt, ["core"], "pt");
    const fpt = S.createFeature(w5pt, "Aprovação", ["core"]);
    const apPt = S.approvePhase(w5pt, fpt.slug, "requirements").error;
    ok(/Não é possível aprovar 'requirements' de 'aprovacao' — verificações a falhar: phase-order, placeholders/.test(apPt) &&
      /há fases anteriores ainda por aprovar: classification — aprova-as primeiro, por ordem \(\/approve aprovacao classification\)/.test(apPt) &&
      /Nada para aprovar/.test(S.approvePhase(w5pt, fpt.slug, "eval-plan").error), "the approve refusal (its phase-order line naming the earlier phase too) / nothing-to-approve errors are localized (PT)");
    const apTool = list.result.tools.find((t) => t.name === "spec_approve");
    ok(apTool.inputSchema.properties.force.type === "boolean" && !apTool.inputSchema.required.includes("force") && /REFUSES/.test(apTool.description), "spec_approve advertises force: boolean (optional) and the gate");

    // (3) _Implements:_ of an OPEN task is planned, not a gap; a DONE task's missing file is
    const f3 = S.createFeature(w5, "Planned files", ["core"]);
    write5(f3, "requirements.md", "## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n");
    write5(f3, "tasks.md", "- [ ] 1. a\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/not-yet.js_\n");
    const t3a = S.traceCheck(w5, f3.slug);
    write5(f3, "tasks.md", "- [x] 1. a\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/not-yet.js_\n");
    const t3b = S.traceCheck(w5, f3.slug);
    ok(t3a.verdict === "pass" && t3a.plannedImplFiles.join() === "src/not-yet.js" && t3a.missingImplFiles.length === 0 && S.traceGaps(t3a).length === 0 &&
      t3b.verdict === "gaps-found" && t3b.missingImplFiles.join() === "src/not-yet.js" && t3b.plannedImplFiles.length === 0,
      "trace: an OPEN task's not-yet-written _Implements:_ file is plannedImplFiles (no gap); once the task is done it is a gap");

    // (4) spec_finish blocks on what next_action flags (changed since approval), placeholders anywhere, the root cause
    const f4 = S.createFeature(w5, "Finish gate", ["core"]);
    write5(f4, "requirements.md", REQ);
    approveBefore(w5, f4.slug, "requirements");
    S.approvePhase(w5, f4.slug, "requirements");
    fs.appendFileSync(path.join(f4.dir, "requirements.md"), "\n## Assumptions\n- Admins are logged in.\n");
    const na4 = S.nextAction(w5, f4.slug);
    const fin4 = S.finishFeature(w5, f4.slug);
    ok(na4.changedSinceApproval.join() === "requirements.md" && fin4.changedSinceApproval.join() === "requirements.md" &&
      fin4.blockers.some((b) => /changed after their approval \(re-review, then re-approve\): requirements\.md/.test(b)) &&
      fin4.blockers.some((b) => /template placeholders left in the spec chain: design\.md/.test(b)) && fin4.placeholders.includes("tasks.md") && fin4.readyToFinish === false,
      "spec_finish: an artifact changed after its approval (the same list next_action shows) and placeholders anywhere in the chain are blockers");
    const fin4b = S.finishFeature(w5, f2b.slug);
    ok(fin4b.blockers.some((b) => b === "bug.md → Root Cause is not filled — no fix before the root cause is known") && !fin4b.blockers.some((b) => /blocking checks: [^\n]*root-cause/.test(b)),
      "spec_finish on a bugfix: an unfilled Root Cause is its own blocker");

    // (5) bugfix execution gate + brief context — on a tasks.md that has a root-cause task: the four-task form every bugfix
    // (but an XS one) was scaffolded with before the short form, kept verbatim in projects (never rewritten), EN and PT.
    const legacyBugTasks = (lang) => (lang === "pt"
      ? "# Tasks: x\n\n## Fase: Correção\n- [ ] 1. [shared] Reproduzir o bug de forma fiável e escrever os passos em bug.md → Reprodução\n  - _Requirements: US-1.AC-1_\n" +
        "- [ ] 2. [shared] Encontrar a causa raiz com evidência; preencher bug.md → Causa Raiz (ainda sem corrigir)\n  - _Requirements: US-1.AC-1_\n" +
        "- [ ] 3. [US1] Escrever o teste de regressão T-01 e vê-lo falhar pela razão certa (colar o output); acrescentar o teste de proteção T-02 (já passa)\n  - _Requirements: US-1.AC-1_\n  - _Verify: [comando que executa o T-01]_\n  - _Expect: fail_\n" +
        "- [ ] 4. [US1] Corrigir a causa raiz — uma alteração, não um pacote; o teste de proteção T-02 continua verde\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Makes green: T-01_\n  - _Verify: [comando da suite de testes completa]_\n"
      : "# Tasks: x\n\n## Phase: Fix\n- [ ] 1. [shared] Reproduce the bug reliably and write the steps in bug.md → Reproduction\n  - _Requirements: US-1.AC-1_\n" +
        "- [ ] 2. [shared] Find the root cause with evidence; fill bug.md → Root Cause (no fix yet)\n  - _Requirements: US-1.AC-1_\n" +
        "- [ ] 3. [US1] Write regression test T-01 and watch it fail for the right reason (paste the output); add guard test T-02 (it passes already)\n  - _Requirements: US-1.AC-1_\n  - _Verify: [command that runs T-01]_\n  - _Expect: fail_\n" +
        "- [ ] 4. [US1] Fix the root cause — one change, not a bundle; guard test T-02 stays green\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Makes green: T-01_\n  - _Verify: [full test suite command]_\n");
    const f5 = S.createFeature(w5, "Null deref", undefined, "crash on save", undefined, "en", "bugfix");
    write5(f5, "tasks.md", legacyBugTasks("en"));
    const tasks5 = () => read5(f5, "tasks.md");
    const c51 = S.completeTask(w5, f5.slug, 1);
    const c50 = S.completeTask(w5, f5.slug, 3); // the root-cause task (#2) still open: "do task 2 first"
    const c52 = S.completeTask(w5, f5.slug, 2);
    const c53 = payload(await rpc("tools/call", { name: "spec_complete_task", arguments: { name: f5.slug, number: 4, evidence: { command: "npm test", exitCode: 0 }, projectDir: w5 } }));
    ok(c51.ok && !c51.rootCausePending && c50.ok === false && /do task 2 first/.test(c50.error) &&
      c52.ok && c52.rootCausePending === true && /^Task 2 is ticked, but bug\.md → Root Cause is still empty — write the root cause there/.test(c52.note) &&
      c53.ok === false && c53.gated === "root-cause" && /Task 4 can't be completed yet: bug\.md → Root Cause is still empty — task 2 is ticked, but its deliverable is that section/.test(c53.error) &&
      !/do task 2 first/.test(c53.error) && /- \[ \] 4\./.test(tasks5()) && !(stateOf(f5).evidence || {})["4"],
      "bugfix: while Root Cause is unfilled, tasks after the root-cause task are refused (nothing ticked, no evidence recorded) — 'do task 2 first' while #2 is open; once #2 is ticked (rootCausePending + a note) the refusal says the section is still empty, never 'do task 2 first'");
    const br5 = S.taskBrief(w5, f5.slug, 4);
    const bug5 = path.join(f5.dir, "bug.md");
    fs.writeFileSync(bug5, fs.readFileSync(bug5, "utf8").replace(/## Reproduction\n> \*\*TODO\*\*[^\n]*/, "## Reproduction\nSave an empty form.")
      .replace(/## Root Cause\n> \*\*TODO\*\*[^\n]*/, "## Root Cause\nform.owner is null when the form is empty (save.js:12)."));
    const br5b = S.taskBrief(w5, f5.slug, 4);
    ok(br5.bug.rootCause === null && /## The bug \(bug\.md\)/.test(br5.brief) && /Not written yet/.test(br5.brief) &&
      br5b.bug.reproduction === "Save an empty form." && /\*\*Root cause\*\*\nform\.owner is null/.test(br5b.brief) && S.completeTask(w5, f5.slug, 3).ok,
      "spec_task_brief on a bugfix task carries bug.md's Reproduction and Root Cause; once written, the gate opens");
    const f5b = S.createFeature(w5, "Odd bug", undefined, "x", undefined, "en", "bugfix");
    write5(f5b, "tasks.md", "- [ ] 1. Investigate\n- [ ] 2. Patch it\n");
    const f5pt = S.createFeature(w5pt, "Falha", undefined, "x", undefined, "pt", "bugfix");
    write5(f5pt, "tasks.md", legacyBugTasks("pt"));
    const pt3 = S.completeTask(w5pt, f5pt.slug, 3).error;
    const pt2 = S.completeTask(w5pt, f5pt.slug, 2);
    ok(/only task 1 can be completed/.test(S.completeTask(w5, f5b.slug, 2).error) && S.completeTask(w5, f5b.slug, 1).ok &&
      /A tarefa 3 ainda não pode ser concluída/.test(pt3) && /faz primeiro a tarefa 2/.test(pt3) && /^A tarefa 2 está marcada, mas bug\.md → Causa Raiz continua vazia/.test(pt2.note) &&
      /a tarefa 2 está marcada, mas o que ela entrega é essa secção/.test(S.completeTask(w5pt, f5pt.slug, 3).error),
      "no task mentions the Root Cause → only the first task can be completed; the refusal (and the ticked-root-cause-task note / refusal) is localized (PT)");
    // The scaffold today (every size): no reproduce / root-cause task — 1 the red regression test, 2 the fix. With Root Cause
    // empty (a design approval forced over it, or the section emptied) the iron law still holds: the fix is refused before
    // anything is recorded ("only task 1"), the brief reports it gated; the red test itself can be recorded (no rootCausePending).
    {
      const fN = S.createFeature(w5, "Short bug", undefined, "x", undefined, "en", "bugfix");
      write5(fN, "tasks.md", read5(fN, "tasks.md").replace("[command that runs T-01]", "node tests/t01.test.js").replace("[full test suite command]", "npm test"));
      const bt = S.taskBlocks(read5(fN, "tasks.md"));
      const fix = S.completeTask(w5, fN.slug, 2, { command: "npm test", exitCode: 0 });
      const brFix = S.taskBrief(w5, fN.slug, 2);
      const red = S.completeTask(w5, fN.slug, 1, { command: "node tests/t01.test.js", exitCode: 1, summary: "T-01 fails" });
      ok(bt.length === 2 && S.expectsFail(bt[0]) && fix.ok === false && fix.gated === "root-cause" &&
        /^Task 2 can't be completed yet: bug\.md → Root Cause is not filled and no task writes it — only task 1 can be completed/.test(fix.error) &&
        !(stateOf(fN).evidence || {})["2"] && brFix.gated === "root-cause" && red.ok && !red.rootCausePending && /- \[x\] 1\./.test(read5(fN, "tasks.md")),
        "bugfix short form: with Root Cause empty the fix (task 2) is refused and nothing recorded — only task 1 (the red regression test) can be completed; the brief says gated (got " +
        JSON.stringify([bt.length, fix.error, brFix.gated, red.ok, red.rootCausePending]) + ")");
    }
    // Once bug.md and the plan are written and approved phase by phase, next_action points at task #1 — the failing regression
    // test (it named "Reproduce the bug", work the requirements / design gates had already signed off). A tasks.md with the
    // four tasks (scaffolded before) stays as it is and valid: a fresh one is still in `requirements` (its reproduce /
    // root-cause steps are bug steps, never a breakdown), doctor reads it like a new one, spec_upgrade flags nothing about it
    // and its apply leaves it byte for byte.
    {
      const pS = path.join(tmp, "proj-wp5-short");
      S.initProject(pS, ["core"], "en");
      const bS = S.createFeature(pS, "Sum skips first", undefined, "the sum skips the first item", undefined, "en", "bugfix");
      const fillS = (rel, pairs) => { const fp = path.join(bS.dir, rel); let t = fs.readFileSync(fp, "utf8"); pairs.forEach(([x, y]) => { t = t.split(x).join(y); }); fs.writeFileSync(fp, t); };
      fillS("requirements.md", [["[the condition that triggers the bug]", "the list has two or more items"], ["[the correct behavior]", "return the sum of every item"],
        ["[the neighbouring behavior that already worked]", "the sum of an empty list as 0"], ["[nearby inputs that must keep working]", "an empty list"]]);
      fillS("test-plan.md", [["[unit/integration]", "unit"], ["`[path]`", "`tests/t01.test.js`"]]);
      fillS("tasks.md", [["[command that runs T-01]", "node tests/t01.test.js"], ["[exact values the fix must respect — versions, limits, formats]", "Node >= 18"], ["[full test suite command]", "npm test"]]);
      fillS("bug.md", [["[correct behavior]", "the sum of every item"], ["[what happens — error message, output, log lines]", "the first item is missing"],
        ["> **TODO** — exact steps, input and environment that reproduce it every time.", "total([1, 2]) returns 2."],
        ["> **TODO** — the cause, with evidence (stack trace, log, failing assertion, the change that introduced it). Not \"probably\".", "The loop starts at index 1 (sum.js:3)."],
        ["[What changes and why it removes the root cause — one fix, not a bundle.]", "Start the loop at 0."]]);
      const apS = ["requirements", "design", "test-plan", "tasks"].map((ph) => S.approvePhase(pS, bS.slug, ph, "u"));
      const naS = S.nextAction(pS, bS.slug);
      const redS = S.completeTask(pS, bS.slug, 1, { command: "node tests/t01.test.js", exitCode: 1, summary: "T-01 fails: got 2" });
      const naS2 = S.nextAction(pS, bS.slug);
      const greenS = S.completeTask(pS, bS.slug, 2, { command: "npm test", exitCode: 0, summary: "all passing" });
      ok(apS.every((r) => r.ok) && naS.step === "implement" && /^Implement task #1: Write regression test T-01 and watch it fail/.test(naS.recommendation) &&
        redS.ok && redS.redRecorded && naS2.step === "implement" && /^Implement task #2: Fix the root cause/.test(naS2.recommendation) &&
        greenS.ok && greenS.verified && S.finishFeature(pS, bS.slug).readyToFinish === true,
        "bugfix short form, gate by gate: after the tasks approval next_action → #1 the failing regression test, its red run recorded → #2 the fix, green → finish ready (got " +
        JSON.stringify([apS.map((r) => r.ok), naS.recommendation, naS2.recommendation, redS.redRecorded, greenS.verified]) + ")");
      const bN = S.createFeature(pS, "New one", undefined, "x", undefined, "en", "bugfix");
      const bL = S.createFeature(pS, "Old one", undefined, "x", undefined, "en", "bugfix");
      write5(bL, "tasks.md", legacyBugTasks("en"));
      const bLp = S.createFeature(pS, "Antigo", undefined, "x", undefined, "pt", "bugfix");
      write5(bLp, "tasks.md", legacyBugTasks("pt"));
      const bLbr = S.createFeature(pS, "Antigo BR", undefined, "x", undefined, "pt-BR", "bugfix");
      write5(bLbr, "tasks.md", legacyBugTasks("pt").replace("de forma fiável", "de forma confiável"));
      const bLes = S.createFeature(pS, "Antiguo", undefined, "x", undefined, "es", "bugfix");
      write5(bLes, "tasks.md", "# Tareas: x\n\n- [ ] 1. [shared] Reproducir el bug de forma fiable y escribir los pasos en bug.md → Reproducción\n  - _Requirements: US-1.AC-1_\n" +
        "- [ ] 2. [shared] Encontrar la causa raíz con evidencia; rellenar bug.md → Causa Raíz (aún sin corregir)\n  - _Requirements: US-1.AC-1_\n");
      const sig = (slug) => S.specDoctor(pS, slug).checks.map((c) => c.id + ":" + c.status).join();
      const up = S.specUpgrade(pS);
      const upOf = (slug) => { const f = up.features.find((x) => x.name === slug) || {}; return JSON.stringify([f.group, (f.doctor || {}).failing && f.doctor.failing.map((c) => c.id), (f.doctor || {}).warnings, f.pendingGates]); };
      const upA = S.specUpgrade(pS, { apply: true });
      ok([bL, bLp, bLbr, bLes, bN].every((b) => S.statusFeature(pS, b.slug).phase === "requirements") &&
        sig(bL.slug) === sig(bN.slug) && upOf(bL.slug) === upOf(bN.slug) && upA.ok && read5(bL, "tasks.md") === legacyBugTasks("en") && read5(bLp, "tasks.md") === legacyBugTasks("pt"),
        "a bugfix tasks.md with the four tasks (scaffolded before the short form) stays valid: phase requirements while fresh (its steps are bug steps — EN / PT / ES), doctor and the spec_upgrade audit read it like a new one, the upgrade's apply never rewrites it (got " +
        JSON.stringify([S.statusFeature(pS, bL.slug).phase, sig(bL.slug), sig(bN.slug), upOf(bL.slug), upOf(bN.slug)]).slice(0, 900) + ")");
    }

    // A red-phase task (its test must FAIL) carrying a must-pass _Verify:_ can never be verified: the refusal of its red
    // run, its unverified note and next_action's verify step say how to fix the TASK (move the command to the fix task, or
    // drop it and record the red run as a note) — never only "re-run it" / "fix the code first". EN / PT.
    const redBug = (d, lang) => {
      const b = S.createFeature(d, "Red loop " + lang, undefined, "loop", undefined, lang, "bugfix");
      const tp = path.join(b.dir, "tasks.md");
      fs.writeFileSync(tp, fs.readFileSync(tp, "utf8").replace(/  - _Verify: \[[^\]\n]*T-01\]_\n  - _Expect: fail_\n/, "  - _Verify: node tests/t01.test.js_\n")); // a must-pass _Verify:_ (no _Expect: fail_) on the red task
      // A written bugfix (every template slot filled), its phases approved in order — so next_action reaches `verify`.
      const bp = path.join(b.dir, "bug.md");
      fs.writeFileSync(bp, fs.readFileSync(bp, "utf8").replace(/> \*\*TODO\*\*[^\n]*/g, "The handler redirects before clearing the cookie (auth.js:88).").replace(/\[[^\]\n]+\]/g, "the dashboard opens"));
      const fillAll = (rel, re, by) => { const p = path.join(b.dir, rel); fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(re, by)); };
      fillAll("requirements.md", /\[[^\]\n]+\]/g, "the refresh token has expired");
      fillAll("test-plan.md", /\[[^\]\n]+\]/g, "tests/t01.test.js");
      fillAll("tasks.md", /\[(?!shared\]|US\d+\]|[ xX]\])[^\]\n]+\]/g, "npm test");
      ["requirements", "design", "test-plan", "tasks"].forEach((ph) => S.approvePhase(d, b.slug, ph)); // task 1 is the red one
      return b;
    };
    const rb = redBug(w5, "en");
    const rbRun = S.completeTask(w5, rb.slug, 1, { command: "node tests/t01.test.js", exitCode: 1, summary: "1 failing" });
    const rbNote = S.completeTask(w5, rb.slug, 1, { summary: "T-01 fails: the redirect loop" });
    write5(rb, "tasks.md", read5(rb, "tasks.md").replace(/- \[ \] 2\./, "- [x] 2."));
    const rbNext = S.nextAction(w5, rb.slug);
    const rbPt = redBug(w5pt, "pt");
    const rbPtRun = S.completeTask(w5pt, rbPt.slug, 1, { command: "node tests/t01.test.js", exitCode: 1 });
    const plain = S.completeTask(w5, rb.slug, 2, { command: "npm test", exitCode: 1 });
    all("a red-phase task with a must-pass _Verify:_: its red run's refusal, its note and next_action's verify step explain the fix (mark it _Expect: fail_, or move the command to the fix task) — PT too; a normal failing task gets no such hint; the bugfix template says so (got " +
      JSON.stringify([rbRun.error, rbNote.note, rbNext.step, plain.error].map((x) => String(x).slice(0, 90))) + ")", [
      () => rbRun.ok === false, () => rbRun.redPhaseVerify === true,
      () => /verification failed \(exit 1\).*Task 1 writes a test that must FAIL \(the red phase\)/.test(rbRun.error),
      () => /Mark task 1 with _Expect: fail_ — a run that FAILS is then its proof \(T-01 fails before the fix\)/.test(rbRun.error),
      () => /node "[^"]*dev-spec\.js" done red-loop-en 1 --run\. Or move the command to the task that makes it green/.test(rbRun.error),
      () => rbNote.ok, () => rbNote.unverifiedReason === "failed-run", () => rbNote.redPhaseVerify === true,
      () => / — Task 1 writes a test that must FAIL/.test(rbNote.note), () => rbNext.step === "verify",
      () => /Task 1 writes a test that must FAIL/.test(rbNext.recommendation), () => rbPtRun.redPhaseVerify === true,
      () => /A tarefa 1 escreve um teste que tem de FALHAR \(a fase vermelha\)/.test(rbPtRun.error), () => plain.ok === false,
      () => !plain.redPhaseVerify, () => !/red phase/.test(plain.error), () => /Task 1 is red by design/.test(read5(rb, "tasks.md")),
      () => /A tarefa 1 é vermelha por natureza/.test(read5(rbPt, "tasks.md")),
    ]);

    // Quoted evidence in bug.md is content, not a template slot: a Reproduction / Root Cause quoting `[object Object]`, a regex
    // class `[A-Z]` or a log tag `[WARN]` is documented (doctor, the requirements / design approvals, the root-cause gate,
    // finish, the placeholders check) — 1.13 reported it "not filled" in every language. The bug report's own slots, and a
    // section holding nothing but brackets, still count as unfilled.
    const f5e = S.createFeature(w5, "Profile shows object", undefined, "the header shows object text", undefined, "en", "bugfix");
    const bugE5 = path.join(f5e.dir, "bug.md");
    const bugE5Text = fs.readFileSync(bugE5, "utf8").replace(/## Reproduction\n> \*\*TODO\*\*[^\n]*/, "## Reproduction\n1. Log in.\n2. Open /profile: the header reads [object Object].")
      .replace(/## Root Cause\n> \*\*TODO\*\*[^\n]*/, "## Root Cause\nheader.js interpolates the whole user object, so it prints [object Object]; norm() only maps [A-Z]. Log: [WARN] name missing.")
      .replace("[correct behavior]", "the user's name").replace("[what happens — error message, output, log lines]", "the text [object Object]")
      .replace("[What changes and why it removes the root cause — one fix, not a bundle.]", "Interpolate user.name, not the user object.");
    fs.writeFileSync(bugE5, bugE5Text);
    const docE5 = S.specDoctor(w5, f5e.slug);
    const stE5 = (id) => (docE5.checks.find((c) => c.id === id) || {}).status;
    const phE5 = docE5.checks.find((c) => c.id === "placeholders") || { detail: "" };
    approveBefore(w5, f5e.slug, "design");
    const apE5 = S.approvePhase(w5, f5e.slug, "design");
    S.completeTask(w5, f5e.slug, 1);
    const cFixE5 = S.completeTask(w5, f5e.slug, 2); // the fix: after task 1, gated only while Root Cause is unfilled
    const finE5 = S.finishFeature(w5, f5e.slug);
    fs.writeFileSync(bugE5, bugE5Text.replace(/## Root Cause\n[^\n]*/, "## Root Cause\n[the cause, with evidence]"));
    const onlyE5 = (S.specDoctor(w5, f5e.slug).checks.find((c) => c.id === "root-cause") || {}).status;
    fs.writeFileSync(bugE5, bugE5Text.replace("the user's name", "[correct behavior]"));
    const slotE5 = S.featurePlaceholders(w5, f5e.slug, "bug.md").items.map((p) => p.text).join();
    const f5ept = S.createFeature(w5pt, "Falha acentos", undefined, "x", undefined, "pt", "bugfix");
    const bugP5 = path.join(f5ept.dir, "bug.md");
    fs.writeFileSync(bugP5, fs.readFileSync(bugP5, "utf8").replace(/## Causa Raiz\n> \*\*TODO\*\*[^\n]*/, "## Causa Raiz\nnorm() só converte [A-Z] para minúsculas, por isso 'É' não bate certo (auth.js:40)."));
    const ptE5 = (S.specDoctor(w5pt, f5ept.slug).checks.find((c) => c.id === "root-cause") || {}).status;
    ok(stE5("reproduction") === "pass" && stE5("root-cause") === "pass" && !/bug\.md/.test(phE5.detail) && apE5.ok && cFixE5.ok && !cFixE5.gated &&
      !finE5.blockers.some((b) => /Root Cause/.test(b)) && !finE5.placeholders.includes("bug.md") && onlyE5 === "fail" && slotE5 === "[correct behavior]" && ptE5 === "pass",
      "bugfix: a Reproduction / Root Cause quoting [object Object], [A-Z], [WARN] is documented (doctor, approve design, the root-cause gate, finish, placeholders; PT too); a bracket-only section and the report's own slots still count as unfilled (got " +
      JSON.stringify([stE5("reproduction"), stE5("root-cause"), phE5.detail.slice(0, 80), apE5.ok, cFixE5.ok, finE5.blockers.slice(0, 2), onlyE5, slotE5, ptE5]) + ")");

    // (6) next_action: phase by phase — re-review → the first unapproved phase (fill → fix → approve) → implement → finish
    const f6 = S.createFeature(w5, "Order", ["saas"]);
    const n6a = S.nextAction(w5, f6.slug);
    write5(f6, "classification.md", read5(f6, "classification.md").replace(/\[[^\]]*\]/g, "filled"));
    S.approvePhase(w5, f6.slug, "classification");
    const n6a2 = S.nextAction(w5, f6.slug);
    ok(n6a.step === "fill" && n6a.file === "classification.md" && /^Fill classification\.md — \d+ template placeholder/.test(n6a.recommendation) && /\/classify order/.test(n6a.recommendation) &&
      !/saas-sections|traceability/.test(n6a.recommendation) &&
      n6a2.step === "fill" && n6a2.file === "requirements.md" && /^Fill requirements\.md — \d+ template placeholder/.test(n6a2.recommendation) && /\/clarify order/.test(n6a2.recommendation),
      "next_action on a fresh +saas feature: 'fill classification.md' (Phase 0, /classify), then — once approved — 'fill requirements.md' (with /clarify); never the later phases' failing checks");
    // The design is never asked for before the requirements are approved, the tasks never before the design: each phase is
    // filled, fixed and approved before the next one starts (the requirements, filled first, wait for their approval).
    const f6c = S.createFeature(w5, "Order core", ["core"]);
    write5(f6c, "requirements.md", REQ);
    const n6b = S.nextAction(w5, f6c.slug);
    write5(f6c, "classification.md", read5(f6c, "classification.md").replace(/\[[^\]]*\]/g, "filled"));
    const n6b2 = S.nextAction(w5, f6c.slug);
    S.approvePhase(w5, f6c.slug, "classification");
    const n6b3 = S.nextAction(w5, f6c.slug);
    S.approvePhase(w5, f6c.slug, "requirements");
    const n6b4 = S.nextAction(w5, f6c.slug);
    write5(f6c, "design.md", DESIGN);
    write5(f6c, "tasks.md", "# Tasks\n\n- [ ] 1. [US1] Build it\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4, US-2.AC-7_\n");
    const n6c = S.nextAction(w5, f6c.slug);
    S.approvePhase(w5, f6c.slug, "design");
    const n6c2 = S.nextAction(w5, f6c.slug);
    write5(f6c, "tasks.md", "# Tasks\n\n- [ ] 1. [US1] Build it\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4, US-2.AC-1_\n");
    const n6d = S.nextAction(w5, f6c.slug);
    all("next_action phase by phase: classification (fill → approve) → requirements approved BEFORE the design is asked for → design approved before the tasks' checks count → what the tasks gate refuses (traceability) → approve tasks (got " +
      [n6b.step + ":" + n6b.file, n6b2.step, n6b3.step, n6b4.step + ":" + n6b4.file, n6c.step, n6c2.step, n6d.step].join(" · ") + ")", [
      () => n6b.step === "fill", () => n6b.file === "classification.md", () => n6b2.step === "approve",
      () => /\/approve order-core classification/.test(n6b2.recommendation), () => !n6b2.refusedGate, () => n6b3.step === "approve",
      () => /\/approve order-core requirements/.test(n6b3.recommendation), () => n6b4.step === "fill", () => n6b4.file === "design.md",
      () => n6c.step === "approve", () => /\/approve order-core design/.test(n6c.recommendation), () => n6c2.step === "fix",
      () => n6c2.refusedGate.phase === "tasks", () => n6c2.refusedGate.failing.join() === "traceability",
      () => /Before approving 'tasks'.*US-2\.AC-7/.test(n6c2.recommendation), () => n6d.step === "approve",
      () => /\/approve order-core tasks/.test(n6d.recommendation),
    ]);
    S.approvePhase(w5, f6c.slug, "tasks");
    const n6e = S.nextAction(w5, f6c.slug);
    S.completeTask(w5, f6c.slug, 1, "built and checked");
    const n6f = S.nextAction(w5, f6c.slug);
    ok(n6e.step === "implement" && /#1/.test(n6e.recommendation) && n6f.step === "finish" && /\/spec-finish order-core \(spec_finish\)/.test(n6f.recommendation),
      "next_action: approvals done → implement the next task; all tasks done → spec_finish / /spec-finish by name");
    // A phase approved with force over a failing check (the human's call): the walk moves on to the next phase; once every
    // phase is approved, the check still failing is what next_action asks to fix — before any task.
    const f6x = S.createFeature(w5, "Order forced", ["core"]);
    write5(f6x, "classification.md", read5(f6x, "classification.md").replace(/\[[^\]]*\]/g, "filled"));
    write5(f6x, "requirements.md", REQ.replace("## Success Criteria", "5. **US-1.AC-5** — the export is quick.\n\n## Success Criteria"));
    write5(f6x, "design.md", DESIGN);
    write5(f6x, "tasks.md", "# Tasks\n\n- [ ] 1. [US1] Build it\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4, US-1.AC-5, US-2.AC-1_\n");
    S.approvePhase(w5, f6x.slug, "classification");
    const ap6x = S.approvePhase(w5, f6x.slug, "requirements", undefined, { force: true });
    const n6x = S.nextAction(w5, f6x.slug);
    S.approvePhase(w5, f6x.slug, "design"); S.approvePhase(w5, f6x.slug, "tasks");
    const n6x2 = S.nextAction(w5, f6x.slug);
    ok(ap6x.forced && ap6x.failing.includes("ears") && n6x.step === "approve" && /\/approve order-forced design/.test(n6x.recommendation) &&
      n6x2.step === "fix" && /^Fix blocking checks \(ears\)/.test(n6x2.recommendation) && n6x2.gatesOk === true,
      "a forced approval over a failing check: the walk goes on (approve design), and once every phase is approved the failing check comes before any task (got " + [n6x.step, n6x2.step, n6x2.recommendation.slice(0, 40)].join(" · ") + ")");
    // Phase 4 is the hard gate (+tdd): once test-plan.md exists, `tests` is pending — after test-plan, before tasks — so
    // next_action asks for the failing tests (/writeTests) and never jumps to "implement"; gatesOk and finish count it.
    // A core feature (order-core above) has no Phase 4.
    const f6t = S.createFeature(w5, "Order tdd", ["tdd"]);
    write5(f6t, "classification.md", read5(f6t, "classification.md").replace(/\[[^\]]*\]/g, "filled"));
    write5(f6t, "requirements.md", REQ);
    write5(f6t, "design.md", DESIGN);
    const acs6t = ["US-1.AC-1", "US-1.AC-2", "US-1.AC-3", "US-1.AC-4", "US-2.AC-1"];
    write5(f6t, "test-plan.md", "# Test Plan\n\n| Test ID | Covers |\n|---|---|\n" + acs6t.map((ac, i) => `| T-0${i + 1} | ${ac} |`).join("\n") + "\n");
    write5(f6t, "tasks.md", "# Tasks\n\n- [ ] 1. [US1] Build it\n  - _Requirements: " + acs6t.join(", ") + "_\n  - _Makes green: T-01, T-02, T-03, T-04, T-05_\n");
    ["classification", "requirements", "design", "test-plan"].forEach((p) => S.approvePhase(w5, f6t.slug, p));
    const d6t = S.specDoctor(w5, f6t.slug);
    const n6t = S.nextAction(w5, f6t.slug);
    const ap6t = S.approvePhase(w5, f6t.slug, "tasks");
    const n6t2 = S.nextAction(w5, f6t.slug);
    const fin6t = S.finishFeature(w5, f6t.slug);
    // The tests gate checks what Phase 4 asks for: every planned T-ID named by a test file (trace_check's code scan).
    const noCode6t = S.approvePhase(w5, f6t.slug, "tests");
    write5(f6t, "tests/unit/order.test.js", ["T-01", "T-02", "T-03", "T-04"].map((t) => `test("${t} builds it", () => { throw new Error("not implemented"); });`).join("\n") + "\n");
    const part6t = S.approvePhase(w5, f6t.slug, "tests");
    fs.appendFileSync(path.join(f6t.dir, "tests", "unit", "order.test.js"), `test("T-05 builds it", () => { throw new Error("not implemented"); });\n`);
    const ap6tT = S.approvePhase(w5, f6t.slug, "tests");
    const ap6t3 = S.approvePhase(w5, f6t.slug, "tasks");
    const n6t3 = S.nextAction(w5, f6t.slug);
    ok(noCode6t.refused && noCode6t.failing.join() === "tests-in-code" && /planned tests no test file names yet: T-01, T-02, T-03, T-04, T-05/.test(noCode6t.error) &&
      part6t.refused && /names yet: T-05 —/.test(part6t.error) && ap6tT.ok && !ap6tT.forced,
      "approve tests (+tdd) is refused until every planned T-ID is named by a test file (tests-in-code, the missing ones listed); then approved unforced");
    all("+tdd: Phase 4 (`tests`) is a pending gate — next_action asks for the failing tests + /approve tests before implementing, the tasks can't be approved before it (phase-order), finish is blocked; approved → tasks → implement (got " + d6t.pendingGates.join() + " / " + n6t.step + " / " + n6t3.step + ")", [
      () => d6t.pendingGates.join() === "tests,tasks", () => d6t.gatesOk === false, () => n6t.step === "fix", () => n6t.refusedGate.phase === "tests",
      () => n6t.refusedGate.failing.join() === "tests-in-code", () => /^Phase 4, the hard gate: write every planned test/.test(n6t.recommendation),
      () => /\/writeTests order-tdd/.test(n6t.recommendation), () => /\/approve order-tdd tests/.test(n6t.recommendation),
      () => /\(the approve gate checks this: tests-in-code\)/.test(n6t.recommendation), () => ap6t.ok === false,
      () => ap6t.failing.join() === "phase-order", () => /earlier phases are not approved yet: tests/.test(ap6t.error), () => n6t2.step === "fix",
      () => n6t2.pendingGates.join() === "tests,tasks", () => fin6t.blockers.some((b) => /tests/.test(b)), () => ap6t3.ok,
      () => n6t3.step === "implement", () => n6t3.gatesOk === true, () => !S.specDoctor(w5, f6c.slug).pendingGates.length,
      () => /^Fase 4, o gate rígido/.test(S.msg("pt").next.approveTests("x", "tdd")),
      () => /harness de evals/.test(S.msg("es").next.approveTests("x", "ai")),
    ]);
    ok(/\/spec-finish x \(spec_finish\)/.test(S.msg("pt").next.allDone("x")) && /\/spec-finish x/.test(S.msg("es").next.allDone("x")), "the all-done recommendation names /spec-finish in PT/ES too");
    // A feature whose tasks are already ticked (a 1.12 feature upgraded — it had no tests gate — or any executing one):
    // "write every planned test and confirm each fails … no implementation code until then" is impossible once the code
    // exists. next_action words the same gate as a sign-off for the existing tests (T-IDs in test names), never /writeTests.
    const f6l = S.createFeature(w5, "Order legacy", ["tdd"]);
    write5(f6l, "classification.md", read5(f6l, "classification.md").replace(/\[[^\]]*\]/g, "filled"));
    write5(f6l, "requirements.md", REQ);
    write5(f6l, "design.md", DESIGN);
    write5(f6l, "test-plan.md", "# Test Plan\n\n| Test ID | Covers |\n|---|---|\n" + acs6t.map((ac, i) => `| T-0${i + 1} | ${ac} |`).join("\n") + "\n");
    write5(f6l, "tasks.md", "# Tasks\n\n- [ ] 1. [US1] Build it\n  - _Requirements: " + acs6t.join(", ") + "_\n  - _Makes green: T-01, T-02, T-03, T-04, T-05_\n" +
      "- [ ] 2. [US1] Polish it\n  - _Requirements: US-1.AC-1_\n");
    ["classification", "requirements", "design", "test-plan"].forEach((p) => S.approvePhase(w5, f6l.slug, p));
    S.approvePhase(w5, f6l.slug, "tasks", undefined, { force: true }); // 1.12 approved the tasks with no tests gate before them
    const n6l0 = S.nextAction(w5, f6l.slug); // nothing ticked yet: test-first wording
    const ap6l0 = S.approvePhase(w5, f6l.slug, "tests"); // refused: tests-in-code, worded test-first
    S.completeTask(w5, f6l.slug, 1, "built under 1.12");
    const n6l1 = S.nextAction(w5, f6l.slug); // executing, no test names the T-IDs: gate refuses → sign-off + what it checks
    const ap6l1 = S.approvePhase(w5, f6l.slug, "tests"); // refused too — worded as the sign-off, like next_action
    fs.writeFileSync(path.join(f6l.dir, ".state.json"), JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(f6l.dir, ".state.json"), "utf8")), lang: "pt" }));
    const ap6l1pt = S.approvePhase(w5, f6l.slug, "tests");
    fs.writeFileSync(path.join(f6l.dir, ".state.json"), JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(f6l.dir, ".state.json"), "utf8")), lang: "en" }));
    S.completeTask(w5, f6l.slug, 2, "polished");
    write5(f6l, "tests/unit/order.test.js", ["T-01", "T-02", "T-03", "T-04", "T-05"].map((t) => `test("${t} builds it", () => {});`).join("\n") + "\n");
    const n6l2 = S.nextAction(w5, f6l.slug); // complete, tests named: approve (sign-off)
    all("next_action on an executing / complete +tdd feature with `tests` pending: a sign-off for the existing tests (T-IDs in test names, what the gate checks) — never 'write failing tests first, no implementation code' (got " +
      JSON.stringify([n6l0.step, n6l1.phase, n6l1.step, n6l2.phase, n6l2.step, n6l2.recommendation.slice(0, 40)]) + ")", [
      () => /^Phase 4, the hard gate/.test(n6l0.recommendation), () => n6l1.phase === "executing", () => n6l1.step === "fix", () => n6l1.refusedGate,
      () => n6l1.refusedGate.failing.join() === "tests-in-code",
      () => /^Phase 4 sign-off: the implementation has already started/.test(n6l1.recommendation),
      () => /T-ID in the test's name/.test(n6l1.recommendation), () => /\/approve order-legacy tests/.test(n6l1.recommendation),
      () => /\(the approve gate checks this: tests-in-code\)/.test(n6l1.recommendation), () => n6l2.phase === "complete",
      () => n6l2.step === "approve", () => n6l2.pendingGates.join() === "tests", () => /^Phase 4 sign-off/.test(n6l2.recommendation),
      () => ![n6l1, n6l2].some((n) => /no implementation code|confirm each fails|\/writeTests/.test(n.recommendation)),
      () => /^Aprovação da Fase 4/.test(S.msg("pt").next.signOffTests("x", "tdd")),
      () => /línea base \(\/eval x --set-baseline\)/.test(S.msg("es").next.signOffTests("x", "ai")),
    ]);
    const tic = (r) => ((r.checks || []).find((c) => c.id === "tests-in-code") || {}).detail || "";
    ok(ap6l0.refused && /write each failing test/.test(tic(ap6l0)) &&
      ap6l1.refused && /implementation has already started/.test(tic(ap6l1)) && /T-ID in the test's name/.test(tic(ap6l1)) && !/failing/.test(tic(ap6l1)) && /T-01/.test(tic(ap6l1)) &&
      /a implementação já começou/.test(tic(ap6l1pt)) && !/a falhar/.test(tic(ap6l1pt)) &&
      /la implementación ya empezó/.test(S.msg("es").gates.testsNotInCodeSignOff("T-01")) && !/que falla/.test(S.msg("es").gates.testsNotInCodeSignOff("T-01")),
      "approve tests on an executing/complete feature: the tests-in-code refusal is the sign-off wording (EN/PT/ES) — 'write each failing test' only before any task is ticked (got " + JSON.stringify([tic(ap6l0), tic(ap6l1), tic(ap6l1pt)]) + ")");
    // +ai: the tests gate needs an eval set of the feature's own — the scaffold's sample golden.json is refused (eval-sets).
    const f6a = S.createFeature(w5, "Order ai", ["ai"], undefined, undefined, "pt");
    approveBefore(w5, f6a.slug, "tests");
    const aiSample = S.approvePhase(w5, f6a.slug, "tests");
    fs.writeFileSync(path.join(f6a.dir, "evals", "golden.json"), JSON.stringify({ set: "golden", items: [] }));
    const aiEmpty = S.approvePhase(w5, f6a.slug, "tests");
    fs.writeFileSync(path.join(f6a.dir, "evals", "golden.json"), JSON.stringify({ set: "golden", items: [{ id: "o1", input: "Total da encomenda 7?", expect: { type: "contains", value: "7" } }] }));
    const aiOwn = S.approvePhase(w5, f6a.slug, "tests");
    ok(aiSample.refused && aiSample.failing.join() === "eval-sets" && /conjunto de exemplo do scaffold/.test(aiSample.error) &&
      aiEmpty.refused && /não tem itens de eval/.test(aiEmpty.error) && aiOwn.ok && !aiOwn.forced,
      "approve tests (+ai) is refused while evals/golden.json is the scaffold's sample (or empty) — eval-sets, localized; an eval set of its own passes");
    // execution on a READY feature (order-core: every task done, its gates approved) is approved unforced. spec_metrics'
    // finished = the earliest of that approval and the finish spec_finish {write} records (state.finished.at).
    const exReady = S.approvePhase(w5, f6c.slug, "execution");
    const mReady = S.metrics(w5, f6c.slug);
    const f6f = S.createFeature(w5, "Order fin", ["core"]);
    const st6f = JSON.parse(read5(f6f, ".state.json"));
    write5(f6f, ".state.json", JSON.stringify({ ...st6f, createdAt: "2026-01-01T00:00:00.000Z", finished: { at: "2026-01-03T00:00:00.000Z", files: {} } }));
    const mFin = S.metrics(w5, f6f.slug);
    ok(exReady.ok && !exReady.forced && mReady.leadTime.finished && mReady.leadTime.finished.at === stateOf(f6c).approvals.execution.at &&
      mFin.leadTime.finished && mFin.leadTime.finished.at === "2026-01-03T00:00:00.000Z" && mFin.leadTime.finished.hours === 48,
      "approve execution on a ready-to-finish feature: approved unforced; spec_metrics reads finished from it, or from spec_finish's state.finished.at (48h)");

    // (7) clarify: IF…THEN per criterion, natural rate-limit wording, grouped placeholders; the classifier
    const f7 = S.createFeature(w5, "Clarify gate", ["saas"]);
    write5(f7, "requirements.md", REQ.replace("3. **US-1.AC-3** — IF the export fails THEN THE SYSTEM SHALL show the error code.", "3. **US-1.AC-3** — IF the export fails,\n   THEN THE SYSTEM SHALL show the error code.") +
      "\n## Tenancy\nEvery query is scoped by tenant; exports are throttled to 10 per minute per tenant.\n");
    const q7 = S.clarify(w5, f7.slug).questions;
    ok(!q7.some((q) => /unwanted-behavior/.test(q)) && !q7.some((q) => /rate limits/.test(q)), "clarify: IF on one line and THEN on the next counts; 'throttled' answers the rate-limit question");
    const ptRate = S.createFeature(w5pt, "Limites", ["saas"]);
    write5(ptRate, "requirements.md", "## Critérios\n1. **US-1.AC-1** — SE o inquilino excede o limite de pedidos, ENTÃO O SISTEMA DEVE responder 429.\n");
    const esW5 = path.join(tmp, "proj-wp5-es");
    S.initProject(esW5, ["core"], "es");
    const esRate = S.createFeature(esW5, "Limites", ["saas"]);
    write5(esRate, "requirements.md", "## Criterios\n1. **US-1.AC-1** — SI se supera el límite de solicitudes, ENTONCES EL SISTEMA DEBE responder 429.\n");
    ok(!S.clarify(w5pt, ptRate.slug).questions.some((q) => /limites de taxa/.test(q)) && !S.clarify(esW5, esRate.slug).questions.some((q) => /límites de tasa/.test(q)),
      "clarify: 'limite de pedidos' (PT) / 'límite de solicitudes' (ES) count as rate limits");
    const q7b = S.clarify(w5, f1h.slug).questions;
    write5(f1h, "requirements.md", REQ.replace("Export invoices as CSV.", "[1-2 sentences: what this does and why it matters]").replace("PDF export.", "[What this feature does NOT include] TBD"));
    const q7c = S.clarify(w5, f1h.slug).questions.filter((q) => /placeholder/.test(q));
    ok(!q7b.some((q) => /placeholder/.test(q)) && q7c.length === 1 && /^Replace the 3 template placeholder\(s\)\/TBD in requirements\.md: requirements\.md:4 \[1-2 sentences: what this does and why …, requirements\.md:\d+ \[What this feature does NOT include\], requirements\.md:\d+ TBD$/.test(q7c[0]),
      "clarify groups the placeholders/TBDs into ONE question naming file:line and the bracketed text");
    const cls7 = ["Página simples sem uso de IA", "Página simple sin uso de IA", "Simple page without AI", "A page with no use of AI"].map((x) => S.classify(x));
    ok(cls7.every((r) => !r.tracks.includes("ai") && !r.possible.some((p) => p.track === "ai") && r.negated.ai.length === 1) &&
      S.classify("Summarize tickets with an LLM, no use of AI moderation").tracks.includes("ai"),
      "classifier: 'sem/sin uso de IA', 'without AI', 'no use of AI' negate the weak signal (no 'Possible +ai'); a strong signal still turns +ai on");

    // (8) EARS: EC-/NFR-/SC- are stable IDs; a deeper numbered sub-list continues its criterion
    const e8 = S.earsValidate("## Edge Cases\n- **EC-1** — WHEN the payload is empty THE SYSTEM SHALL respond 400.\n- **NFR-1** — THE SYSTEM SHALL answer in < 200 ms.\n- **SC-001** — THE SYSTEM SHALL keep errors < 1%.\n");
    ok(e8.summary.criteriaDetected === 3 && e8.summary.withStableId === 3 && !e8.issues.some((i) => i.code === "no-id"), "EARS: EC-1 / NFR-1 / SC-001 are stable IDs (no 'Criterion has no stable ID')");
    const e8b = S.earsValidate("1. **US-1.AC-1** — WHEN the form is submitted THE SYSTEM SHALL:\n   2. show an inline error when a field is invalid\n   3. keep the entered values\n2. **US-1.AC-2** — WHEN x THE SYSTEM SHALL y\n");
    const e8c = S.earsValidate("- Criteria:\n  - **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n  - **US-1.AC-2** — WHEN c THE SYSTEM SHALL d\n");
    ok(e8b.verdict === "pass" && e8b.summary.criteriaDetected === 2 && e8b.issues.length === 0 && e8c.summary.criteriaDetected === 2 && e8c.summary.withStableId === 2,
      "EARS: a numbered sub-list indented under 'THE SYSTEM SHALL:' continues that criterion; a sub-item that defines its own AC still starts one");

    // (9) templates internally consistent (EN/PT/ES, feature and bugfix); track criteria under [SaaS]/[AI] headings
    const tplOk = ["en", "pt", "es"].every((l) => {
      const f = S.createFeature(w5, "Tpl full " + l, ["tdd", "saas", "ai"], undefined, undefined, l);
      const b = S.createFeature(w5, "Tpl bug " + l, undefined, "x", undefined, l, "bugfix");
      const t = S.traceCheck(w5, f.slug), tb = S.traceCheck(w5, b.slug);
      const req = read5(f, "requirements.md");
      return t.verdict === "pass" && t.totalAcs === 10 && t.plannedTests === 10 && tb.verdict === "pass" && /^#### \[SaaS\] .*\n5\. \*\*US-1\.AC-5\*\*/m.test(req) && /^#### \[AI\] .*\n7\. \*\*US-1\.AC-7\*\*/m.test(req);
    });
    const t9 = S.traceCheck(w5, S.createFeature(w5, "Tpl tdd", ["tdd"]).slug);
    ok(tplOk && t9.verdict === "pass" && t9.plannedTests === 5 && t9.uncoveredByTests.length === 0 && t9.testsNotMappedToTasks.length === 0,
      "fresh scaffolds trace clean: every template AC has a planned test and a task, every T-ID a task (EN/PT/ES, +tdd+saas+ai, +tdd, bugfix); track ACs sit under [SaaS]/[AI] headings");
    const f9 = S.createFeature(w5, "Ai off", ["ai"]);
    S.removeTrack(w5, f9.slug, "ai");
    const ph9 = S.featurePlaceholders(w5, f9.slug, "requirements.md").items;
    write5(f9, "requirements.md", read5(f9, "requirements.md").split("\n").map((l, i) => (ph9.some((p) => p.line === i + 1) ? l.replace(/\[[^\]]*\]/g, "x") : l)).join("\n"));
    ok(!ph9.some((p) => /85|0\.03/.test(p.text)) && S.featurePlaceholders(w5, f9.slug, "requirements.md").state === "filled" && S.statusFeature(w5, f9.slug).phase === "design",
      "after add_track ai --remove, the [AI] criteria ([85]%, $[0.03]) are inactive: requirements.md can be 'filled' and the phase moves on");

    // (10) roadmap: a placeholder next task gets a localized marker; the icon agrees with the percent; attention lists the gates
    const w10 = path.join(tmp, "proj-wp5-rm");
    S.initProject(w10, ["core"], "en");
    const r1 = S.createFeature(w10, "Fresh one", ["saas"]);
    const r2 = S.createFeature(w10, "Designing", ["core"]);
    write5(r2, "requirements.md", REQ);
    S.approvePhase(w10, r2.slug, "classification", undefined, { force: true });
    S.approvePhase(w10, r2.slug, "requirements");
    fs.appendFileSync(path.join(r2.dir, "requirements.md"), "\n## Assumptions\n- none.\n");
    const md10 = S.renderRoadmapMd(w10, "en");
    const row = (n) => md10.split("\n").find((l) => l.includes("[" + n + "]")) || "";
    ok(/#1 \(placeholder\)/.test(row("fresh-one")) && /^\| ⬜ \|.* 8% /.test(row("fresh-one")) && /^\| 🟡 \|.* 16% /.test(row("designing")) && !/#1 \|/.test(md10),
      "roadmap: a placeholder next task reads '#1 (placeholder)'; 16% (design) is 🟡 in progress, ⬜ only below");
    ok(/\*\*fresh-one\*\* — mandatory sections missing\/unfilled: \[SaaS\] Performance Budget \(unfilled\)/.test(md10) && /\*\*fresh-one\*\* — template placeholders in the current phase: requirements\.md/.test(md10) &&
      /\*\*designing\*\* — changed since approval — re-review: requirements\.md/.test(md10) && /\*\*designing\*\* — approved with --force \(checks were failing\): classification/.test(md10) &&
      /\*\*designing\*\* — template placeholders in the current phase: design\.md/.test(md10),
      "roadmap 'needs attention': mandatory sections, current-phase placeholders, changed since approval, forced approvals");
    const pt10 = S.renderRoadmapMd(w10, "pt"), html10 = S.renderRoadmapHtml(w10, "es");
    ok(/#1 \(por preencher\)/.test(pt10) && /secções obrigatórias em falta\/por preencher: \[SaaS\] Orçamento de Desempenho \(por preencher\)/.test(pt10) &&
      /#1 \(sin rellenar\)/.test(html10) && /aprobado con --force/.test(html10) && /modificado desde la aprobación/.test(html10), "the roadmap markers and attention lines are localized (MD PT, HTML ES)");

    // --- review fixes ---
    // next_action never recommends an approval the approve gate refuses (it looped: approve → refused → approve…)
    const fR = S.createFeature(w5, "No loop", ["core"]);
    write5(fR, "classification.md", read5(fR, "classification.md").replace(/\[[^\]]*\]/g, "filled"));
    write5(fR, "requirements.md", REQ.replace(/## Success Criteria\n[^\n]*\n\n/, ""));
    write5(fR, "design.md", DESIGN);
    write5(fR, "tasks.md", "# Tasks\n\n- [ ] 1. [US1] Build it\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4, US-2.AC-1_\n");
    const apR0 = S.approvePhase(w5, fR.slug, "classification");
    const nR1 = S.nextAction(w5, fR.slug);
    const apR = S.approvePhase(w5, fR.slug, "requirements");
    const nR2 = S.nextAction(w5, fR.slug);
    const dR = S.specDoctor(w5, fR.slug);
    ok(apR0.ok && nR1.step === "fix" && nR1.refusedGate.phase === "requirements" && nR1.refusedGate.failing.join() === "success-criteria" &&
      /^Before approving 'requirements', fix what the approve gate would refuse: success-criteria \(no measurable SC-### success criteria\)/.test(nR1.recommendation) &&
      apR.ok === false && apR.failing.join() === "success-criteria" && nR2.step === "fix" && nR2.recommendation === nR1.recommendation &&
      chk(dR, "success-criteria").status === "warn" && dR.nextGate.phase === "requirements" && dR.nextGate.ready === false &&
      /approving 'requirements' would be refused \(success-criteria\)/.test(chk(dR, "approval-gates").detail),
      "next_action never recommends an approval the gate would refuse (no loop) — it names the failing check; doctor's approval-gates says so too");
    ok(/^Antes de aprovar 'design', corrige/.test(S.msg("pt").gates.fixGate("design", "x", "f")) && /^Antes de aprobar 'design', corrige/.test(S.msg("es").gates.fixGate("design", "x", "f")),
      "the refused-gate recommendation is localized (PT/ES)");

    // clarify: TBDs are reported at their real line after a multi-line comment; one in an inactive [AI] section is not asked
    const fT = S.createFeature(w5, "Tbd lines", ["core"]);
    write5(fT, "requirements.md", "# Feature: Q\n<!-- guidance\n   more guidance\n   even more -->\n\n## Summary\nA thing.\n\n- Retention period: TBD\n\n" +
      "#### [AI] Acceptance Criteria (EARS)\n7. **US-1.AC-7** — THE SYSTEM SHALL be good TBD\n\n## Edge Cases\n- none\n## Non-Functional Requirements\n- none\n");
    const qT = S.clarify(w5, fT.slug).questions.filter((q) => /placeholder/.test(q));
    ok(qT.length === 1 && qT[0] === "Replace the 1 template placeholder(s)/TBD in requirements.md: requirements.md:9 TBD",
      "clarify: a TBD below a multi-line HTML comment keeps its real line; a TBD in an inactive [AI] section is not asked about");

    // classifier: PT 'no uso do/de' is the contraction em+o, never a negation across filler words
    const clsNo = ["Guia no uso do LLM", "Chatbot no uso do LLM para suporte", "Painel no uso de IA"].map((x) => S.classify(x));
    ok(clsNo[0].tracks.includes("ai") && !clsNo[0].negated.ai.length && !clsNo[0].notes.length &&
      // (1.24 r6 F6: "IA" in capitals is a strong +ai signal — "Painel no uso de IA" is +ai, no longer a hint)
      clsNo[1].tracks.includes("ai") && !clsNo[1].notes.some((n) => /negated/.test(n)) && !clsNo[2].negated.ai.length && clsNo[2].tracks.includes("ai"),
      "classifier: 'Guia no uso do LLM' keeps +ai ON (no negation, no false conflict note); 'no use of AI' still negates");

    // bugfix gate: the template's own FIX task ("Fix the root cause") never counts as the task that writes the root cause
    // (on the four-task form bugfixes were scaffolded with before the short form, its root-cause step reworded)
    const fG = S.createFeature(w5, "Login crash", undefined, "crashes", undefined, "en", "bugfix");
    write5(fG, "tasks.md", legacyBugTasks("en").replace("Find the root cause with evidence; fill bug.md → Root Cause (no fix yet)", "Find why it crashes, with evidence, and document it in bug.md"));
    const g1 = S.completeTask(w5, fG.slug, 1), g4 = S.completeTask(w5, fG.slug, 4), g2 = S.completeTask(w5, fG.slug, 2);
    const brG = S.taskBrief(w5, fG.slug, 4);
    ok(g1.ok && g4.ok === false && g4.gated === "root-cause" && /only task 1 can be completed/.test(g4.error) && g2.ok === false && !/- \[x\] [24]\./.test(read5(fG, "tasks.md")) &&
      brG.gated === "root-cause" && brG.gateError === g4.error && S.taskBrief(w5, fG.slug, 1).gated === undefined,
      "bugfix gate: with step 2 reworded, 'Fix the root cause' does not open the gate for itself — only the first task; spec_task_brief reports the gate");

    // the scaffold's concrete track tasks are real tasks (doctor / next_action / finish); a list of ONLY template tasks can't be approved
    const fK = S.createFeature(w5, "Track tasks kept", ["core"]);
    write5(fK, "classification.md", read5(fK, "classification.md").replace(/\[[^\]]*\]/g, "filled"));
    write5(fK, "requirements.md", REQ);
    write5(fK, "design.md", DESIGN);
    write5(fK, "tasks.md", "# Tasks\n\n- [ ] 1. [US1] Emit metrics, add dashboard, configure alerts\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n" +
      "- [ ] 2. [US1] Enforce tenant isolation — every query scoped by tenant_id\n  - _Requirements: US-1.AC-3, US-1.AC-4, US-2.AC-1_\n");
    approveBefore(w5, fK.slug, "tasks");
    const apK1 = S.approvePhase(w5, fK.slug, "tasks");
    write5(fK, "tasks.md", "# Tasks\n\n- [x] 1. [US1] Build the CSV writer\n  - _Requirements: US-1.AC-1_\n- [ ] 2. [US1] Emit metrics, add dashboard, configure alerts\n  - _Requirements: US-1.AC-2_\n" +
      "- [ ] 3. [US1] Enforce tenant isolation — every query scoped by tenant_id\n  - _Requirements: US-1.AC-3, US-1.AC-4, US-2.AC-1_\n");
    const approvedK = ["classification", "requirements", "design", "tasks"].every((p) => S.approvePhase(w5, fK.slug, p).ok);
    const nK = S.nextAction(w5, fK.slug);
    const dK = S.specDoctor(w5, fK.slug);
    ok(apK1.ok === false && apK1.failing.join() === "placeholders" && /only the scaffold's template tasks/.test(apK1.error) &&
      S.featurePlaceholders(w5, fK.slug, "tasks.md").state === "filled" && approvedK && nK.phase === "executing" && nK.step === "implement" && /#2/.test(nK.recommendation) &&
      chk(dK, "placeholders").status === "pass" && !S.finishFeature(w5, fK.slug).placeholders.length,
      "verbatim track tasks (tenant isolation, metrics) are not placeholders mid-execution: doctor passes, next_action implements; ONLY template tasks refuse the tasks gate");

    // trace: an OPEN task's path outside the project root can never be created there — it stays a gap, never 'planned'
    write5(f3, "tasks.md", "- [ ] 1. a\n  - _Requirements: US-1.AC-1_\n  - _Implements: ../../outside/secret.js, src/not-yet.js_\n");
    const t3c = S.traceCheck(w5, f3.slug);
    ok(t3c.verdict === "gaps-found" && t3c.missingImplFiles.join() === "../../outside/secret.js" && t3c.plannedImplFiles.join() === "src/not-yet.js",
      "trace: an open task's _Implements:_ path outside the project root is missingImplFiles (only in-root files are planned)");
  }

  // --- 1.13 WP8: change requests (approval history + snapshots, spec_impact, reopen) + metrics & retro ---
  {
    const call8 = async (name, args) => { const r = await rpc("tools/call", { name, arguments: args }); return { isError: r.result.isError === true, p: payload(r) }; };
    const w8 = path.join(tmp, "proj-wp8");
    S.initProject(w8, ["tdd"]);
    const cr8 = S.createFeature(w8, "Drafts", ["tdd"]);
    const f8 = (x) => path.join(cr8.dir, x);
    const st8 = () => JSON.parse(fs.readFileSync(f8(".state.json"), "utf8"));
    ok(typeof st8().createdAt === "string" && /^\d{4}-\d\d-\d\dT/.test(st8().createdAt) && Math.abs(Date.now() - Date.parse(st8().createdAt)) < 600000,
      "createFeature stores createdAt (ISO) in the new .state.json");
    ok(["spec_impact", "spec_metrics"].every((t) => list.result.tools.some((x) => x.name === t)), "tools/list advertises spec_impact and spec_metrics");
    const mtDesc = (list.result.tools.find((t) => t.name === "spec_metrics") || {}).description || "";
    // 1.26: the description says what the tool measures; the phase list and finished's exact rule are references/tooling-reference.md's
    ok(/each phase's first approval, to complete and to finished/.test(mtDesc) && !/finished \(execution approved\)/.test(mtDesc),
      "spec_metrics' description says what the engine does — the lead time to each phase's first approval, to complete and to finished (never 'finished (execution approved)')");

    // Fixture — CRLF requirements and tasks (Windows editors), a test plan and a design that cite the ACs.
    const reqA = ["# Feature: Drafts", "", "## Summary", "Save drafts.", "", "### US-1 (P1 — MVP): Save drafts", "", "#### Acceptance Criteria (EARS)",
      "1. **US-1.AC-1** — WHEN a user saves THE SYSTEM SHALL store the draft", "2. **US-1.AC-2** — WHEN the parser meets a BOM THE SYSTEM SHALL skip it",
      "3. **US-1.AC-3** — WHEN the writer runs THE SYSTEM SHALL keep CRLF endings", "", "## Success Criteria", "- **SC-001** — 95% of saves finish under 200 ms", "",
      "## Edge Cases & Error Handling", "- **EC-1** — an empty draft is rejected with a message", ""].join("\r\n");
    const designA = "# Design: Drafts\n\n## Data Model\nDrafts keyed by id (US-1.AC-1).\n\n## Parser\nSkips a BOM (US-1.AC-2, T-02).\n\n## Writer\nKeeps line endings (US-1.AC-3).\n";
    const tasksA = ["# Tasks: Drafts", "", "## Story US-1 (P1 — MVP)", "- [x] 1. [US1] Store drafts", "  - _Requirements: US-1.AC-1_", '  - _Verify: node -e "process.exit(0)"_',
      "- [x] 2. [US1] Skip the BOM", "  - _Requirements: US-1.AC-2, SC-001_", "  - _Makes green: T-02_", "- [x] 3. [US1] Keep CRLF", "  - _Requirements: US-1.AC-3_",
      "- [ ] 4. [US1] Reject empty drafts", "  - _Requirements: EC-1_", "**Checkpoint:** drafts work.", ""].join("\r\n");
    fs.writeFileSync(f8("requirements.md"), reqA);
    fs.writeFileSync(f8("design.md"), designA);
    fs.writeFileSync(f8("test-plan.md"), "| Test ID | Covers |\n|---|---|\n| T-01 | US-1.AC-1 |\n| T-02 | US-1.AC-2 |\n| T-03 | US-1.AC-3 |\n");
    fs.writeFileSync(f8("tasks.md"), tasksA);
    S.completeTask(w8, "drafts", 1, { command: 'node -e "process.exit(0)"', exitCode: 0, summary: "ok" });
    S.completeTask(w8, "drafts", 2, { summary: "BOM skipped (checked by hand)" });

    // 1. Approval history + snapshots.
    const ap8 = await call8("spec_approve", { name: "drafts", phase: "requirements", force: true, projectDir: w8 });
    const h8 = st8().approvalHistory, a8 = st8().approvals.requirements;
    ok(!ap8.isError && ap8.p.snapshot === ".history/requirements@1.md" && h8.length === 1 && h8[0].phase === "requirements" && h8[0].at === a8.at && h8[0].by === a8.by &&
      h8[0].fingerprint === a8.fingerprint && h8[0].snapshot === ".history/requirements@1.md" && !("snapshot" in a8) &&
      fs.readFileSync(f8(".history/requirements@1.md"), "utf8") === reqA && !fs.existsSync(f8(".history/.gitignore")),
      "spec_approve keeps approvals[phase] and appends approvalHistory {phase, at, by, fingerprint, snapshot}; the snapshot is the file verbatim (CRLF kept), not self-ignored");
    const apD8 = S.approvePhase(w8, "drafts", "design", "rev", { force: true });
    const hD8 = st8().approvalHistory[1];
    ok(apD8.forced === true && hD8.phase === "design" && hD8.forced === true && hD8.failing.includes("constitution-check") && hD8.snapshot === ".history/design@1.md",
      "a forced approval is recorded in the history too (forced + failing ids), with its snapshot");
    S.approvePhase(w8, "drafts", "tasks", "rev", { force: true });
    const snapT8 = fs.readFileSync(f8(".history/tasks@1.md"), "utf8");
    ok(snapT8 === tasksA.replace(/- \[x\]/g, "- [ ]") && snapT8.includes("\r\n"), "the tasks snapshot stores tasks.md with its checkboxes normalized (like the fingerprint), CRLF kept");
    S.approvePhase(w8, "drafts", "tests", "rev", { force: true });
    const hT8 = st8().approvalHistory[3];
    ok(hT8.phase === "tests" && hT8.snapshot === undefined && hT8.fingerprint === undefined && !fs.readdirSync(f8(".history")).some((x) => x.startsWith("tests")),
      "a phase with no artifact (tests) is recorded in the history without a snapshot");
    const im0 = (await call8("spec_impact", { name: "drafts", projectDir: w8 })).p;
    ok(im0.ok && im0.baseline === "snapshot" && im0.changed === false && im0.added.length + im0.modified.length + im0.removed.length === 0 &&
      !S.specDoctor(w8, "drafts").checks.some((c) => c.id === "changed-since-approval"), "right after the approval: spec_impact finds no change and doctor has no changed-since-approval check");

    // 2. spec_impact on requirements: whitespace-only reflow of AC-1 (not a change), AC-2 + SC-001 modified, AC-3 → AC-4.
    const reqB = reqA.replace("1. **US-1.AC-1** — WHEN a user saves THE SYSTEM SHALL store the draft", "1. **US-1.AC-1** — WHEN a user saves\r\n   THE SYSTEM SHALL   store the draft")
      .replace("SHALL skip it", "SHALL strip it and log a warning").replace("3. **US-1.AC-3** — WHEN the writer runs THE SYSTEM SHALL keep CRLF endings", "3. **US-1.AC-4** — WHEN a draft is older than 30 days THE SYSTEM SHALL archive it")
      .replace("under 200 ms", "under 150 ms");
    fs.writeFileSync(f8("requirements.md"), reqB);
    const im1 = (await call8("spec_impact", { name: "drafts", phase: "requirements", projectDir: w8 })).p;
    const imp8 = (id) => im1.impacted.find((x) => x.id === id) || { tasks: [], tests: [], designSections: [] };
    ok(im1.changed === true && im1.added.map((a) => a.id).join() === "US-1.AC-4" && im1.added[0].tasks.length === 0 && im1.modified.map((m) => m.id).join() === "US-1.AC-2,SC-001" &&
      /skip it$/.test(im1.modified[0].before) && /strip it and log a warning$/.test(im1.modified[0].after) && im1.removed.map((r) => r.id).join() === "US-1.AC-3",
      "requirements diff by stable ID: added / modified (a whitespace-only reflow is NOT a change) / removed — SC-/EC-/NFR- IDs too");
    ok(imp8("US-1.AC-2").tasks.map((t) => [t.number, t.done, t.evidence].join(":")).join() === "2:true:verified" && imp8("US-1.AC-2").tests.map((t) => t.id).join() === "T-02" &&
      imp8("US-1.AC-2").designSections.join() === "Parser" && imp8("US-1.AC-3").tasks.map((t) => [t.number, t.evidence, t.nothingToVerify].join(":")).join() === "3:verified:true" &&
      imp8("US-1.AC-3").tests.map((t) => t.id).join() === "T-03" && imp8("US-1.AC-3").designSections.join() === "Writer" && imp8("SC-001").tasks.map((t) => t.number).join() === "2" &&
      im1.affectedTasks.map((t) => t.number + ":" + t.via.join("+")).join() === "2:US-1.AC-2+SC-001,3:US-1.AC-3" && /--reopen/.test(im1.hint),
      "each modified/removed ID lists the tasks citing it (done + evidence state), its T-IDs and design sections; affectedTasks names each task once (+ a reopen hint)");
    const imL8 = S.impactLines(im1).join("\n");
    ok(/^Impact: drafts · requirements — against the approval of \d{4}-\d\d-\d\d \(\.history\/requirements@1\.md\)/.test(imL8) && imL8.includes("  ~ US-1.AC-2  WHEN the parser meets a BOM THE SYSTEM SHALL strip it") &&
      imL8.includes("  - US-1.AC-3  WHEN the writer runs") && imL8.includes("US-1.AC-2 (modified) — tasks: #2 [x] verified · tests: T-02 · design: Parser") && imL8.includes("tasks: #3 [x] nothing to verify (no _Verify:_ command, nothing recorded)") && /new, no task cites them yet: US-1\.AC-4/.test(imL8),
      "impactLines: the diff, what each change reaches, the uncovered new AC");

    // 3. next_action + doctor name spec_impact. (The classification gate comes first: re-review asks only for what can be
    //    re-approved now — an earlier pending gate would refuse the re-approval on phase-order.)
    S.approvePhase(w8, "drafts", "classification", "rev", { force: true });
    const na8 = S.nextAction(w8, "drafts");
    const dc8 = S.specDoctor(w8, "drafts").checks.find((c) => c.id === "changed-since-approval");
    ok(na8.step === "re-review" && /Re-review: requirements\.md changed/.test(na8.recommendation) && /spec_impact \(node "[^"]*dev-spec\.js" impact drafts --phase requirements\)/.test(na8.recommendation) &&
      na8.impact && na8.impact.tool === "spec_impact" && na8.impact.phases.join() === "requirements" && dc8 && dc8.status === "warn" && /^changed after their approval: requirements\.md/.test(dc8.detail) &&
      /spec_impact/.test(dc8.detail), "next_action's re-review recommends spec_impact (tool + command) before re-approval; doctor warns changed-since-approval with the artifacts");
    ok(/spec_impact \(node "[^"]*dev-spec\.js" impact drafts --phase requirements\)/.test(dc8.detail), "doctor's changed-since-approval names the phase to diff (dev-spec impact defaults to requirements)");

    // Reopen: the done tasks citing a MODIFIED ID are unticked, their evidence marked stale; nothing else is edited. A task that
    // implemented a REMOVED criterion (US-1.AC-3 → #3) is not redone: it stays ticked, listed in `retire` with its test rows.
    const designBefore8 = fs.readFileSync(f8("design.md"), "utf8");
    const ro8 = (await call8("spec_impact", { name: "drafts", reopen: true, projectDir: w8 })).p;
    const s8 = st8();
    ok(ro8.ok && ro8.recorded === true && ro8.reopened.join() === "2" && fs.readFileSync(f8("tasks.md"), "utf8") === tasksA.replace("- [x] 2.", "- [ ] 2.") &&
      s8.evidence["2"].stale === true && !s8.evidence["1"].stale && fs.readFileSync(f8("requirements.md"), "utf8") === reqB && fs.readFileSync(f8("design.md"), "utf8") === designBefore8 &&
      JSON.stringify(ro8.retire) === JSON.stringify([{ id: "US-1.AC-3", tasks: [3], tests: ["T-03"] }]) &&
      /^Reopened #2: /.test(ro8.note) && /Removed criteria are not redone — still cited: US-1\.AC-3 → tasks #3 · tests T-03/.test(ro8.note),
      "reopen unticks the DONE tasks a modified AC reaches (CRLF kept), marks their evidence stale, never edits requirements.md / design.md; a removed AC's task (#3) stays ticked, listed in retire");
    const ch8 = s8.changes[0];
    ok(s8.changes.length === 1 && ch8.phase === "requirements" && ch8.added.join() === "US-1.AC-4" && ch8.modified.join() === "US-1.AC-2,SC-001" && ch8.removed.join() === "US-1.AC-3" &&
      ch8.reopened.join() === "2" && /^\d{4}-/.test(ch8.at) && ch8.snapshot === ".history/requirements@1.md", "reopen records {at, phase, added, modified, removed, reopened} in .state.json changes");
    const re8 = S.completeTask(w8, "drafts", 2);
    ok(re8.ok && re8.verified === false && re8.unverifiedReason === "stale-evidence" && /predates a spec change/.test(re8.note) &&
      S.specDoctor(w8, "drafts").checks.find((c) => c.id === "verification").detail.includes("#2"), "re-ticking a reopened task without new evidence: stale-evidence (unverified), doctor names it");
    const vd8 = S.specDoctor(w8, "drafts").checks.find((c) => c.id === "verification").detail;
    const sv8 = S.impactReport(w8, "drafts", {});
    const tv8 = sv8.affectedTasks.find((t) => t.number === 2);
    ok(vd8.includes("#2 (the spec changed since this evidence; spec_impact reopened the task)") && !/evidence is for another task/.test(vd8) && tv8.evidence === "stale-evidence" &&
      tv8.specChanged === true && S.impactLines(sv8).join("\n").includes("#2 [x] the spec changed since this evidence") &&
      S.finishFeature(w8, "drafts").blockers.some((b) => b.includes("#2 (the spec changed since this evidence")) &&
      /^- \*\*drafts\*\* — .*#2 \(the spec changed since this evidence; spec_impact reopened the task\)/m.test(S.renderRoadmapMd(w8, "en")),
      "evidence staled by a reopen keeps the stale-evidence code but says the spec changed (doctor, impact, finish, ROADMAP.md) — not 'evidence is for another task'");
    const re8b = S.completeTask(w8, "drafts", 2, { summary: "re-checked against the new AC-2" });
    ok(re8b.verified === true && !st8().evidence["2"].stale, "a task without a runnable _Verify:_: a new note clears the stale mark");
    const hi8 = S.impactReport(w8, "drafts", {});
    ok(!!hi8.hint && !/--reopen/.test(hi8.hint) && /^Removed criteria still cited — US-1\.AC-3 → tasks #3 · tests T-03: don't redo those tasks/.test(hi8.hint) &&
      hi8.affectedTasks.some((t) => t.number === 2 && t.done),
      "no reopen hint once an earlier reopen against this approval covered every change (task #2, redone since, is done) — only the removed AC still cited, --reopen not offered again");
    // doctor / trace: the task still citing the removed AC is a phantom a change request explains — named, never "(typos?)"; EN/PT/ES.
    const trR8 = S.traceCheck(w8, "drafts");
    const trD8 = S.specDoctor(w8, "drafts").checks.find((c) => c.id === "traceability");
    ok(JSON.stringify(trR8.removedAcs) === JSON.stringify([{ id: "US-1.AC-3", changeRequest: 1 }]) && trR8.phantomAcsInTasks.includes("US-1.AC-3") && !S.traceGaps(trR8).some((g) => g.kind === "removedAcs") &&
      trD8.status === "fail" && /tasks still cite ACs a change request removed \(delete or update those tasks — not a typo\): US-1\.AC-3 \(change request #1\)/.test(trD8.detail) && !/unknown ACs \(typos\?\): [^;]*US-1\.AC-3/.test(trD8.detail) &&
      /pedido de alteração #1/.test(S.traceGapLines(trR8, "pt").join()) && /solicitud de cambio #1/.test(S.traceGapLines(trR8, "es").join()),
      "trace_check removedAcs: a phantom AC a recorded change request removed — doctor's traceability names the request (delete or update the task), not a typo (EN/PT/ES)");
    const beforeT8 = fs.readFileSync(f8("tasks.md"), "utf8"), beforeS8 = fs.readFileSync(f8(".state.json"), "utf8");
    const ro8b = S.impactReport(w8, "drafts", { reopen: true });
    ok(ro8b.ok && ro8b.recorded === false && ro8b.reopened.length === 0 && /Nothing new since the last reopen/.test(ro8b.note) &&
      fs.readFileSync(f8("tasks.md"), "utf8") === beforeT8 && fs.readFileSync(f8(".state.json"), "utf8") === beforeS8, "a second reopen with nothing new changes nothing (task #2, redone since, stays ticked)");

    // design: section-level diff; reopen reaches the done task citing an ID of a changed section.
    fs.writeFileSync(f8("design.md"), designA.replace("keyed by id", "keyed by uuid").replace("## Writer\nKeeps line endings (US-1.AC-3).\n", "") + "\n## Archive\nOld drafts move (US-1.AC-4).\n");
    const di8 = (await call8("spec_impact", { name: "drafts", phase: "design", projectDir: w8 })).p;
    ok(di8.ok && di8.added.map((x) => x.section).join() === "Archive" && di8.modified.map((x) => x.section).join() === "Data Model" && di8.removed.map((x) => x.section).join() === "Writer" &&
      di8.impacted.find((x) => x.section === "Data Model").tasks.map((t) => t.number).join() === "1" && di8.impacted.find((x) => x.section === "Writer").ids.join() === "US-1.AC-3",
      "design diff by ## section (added / modified by normalized body / removed) with the IDs each names and the tasks citing them");
    ok(S.specDoctor(w8, "drafts").checks.find((c) => c.id === "changed-since-approval").detail
      .includes("spec_impact (" + S.DEV_SPEC + " impact drafts --phase requirements · " + S.DEV_SPEC + " impact drafts --phase design)"), "doctor names one impact command per changed phase with a snapshot");
    const dro8 = S.impactReport(w8, "drafts", { phase: "design", reopen: true });
    ok(dro8.reopened.join() === "1" && st8().evidence["1"].stale === true && st8().changes[1].phase === "design" && st8().changes[1].removed.join() === "Writer" &&
      /- \[x\] 3\./.test(fs.readFileSync(f8("tasks.md"), "utf8")),
      "design reopen: only the DONE task citing an ID of a changed section is reopened, its run marked stale — the removed 'Writer' section names only US-1.AC-3, which requirements.md no longer defines: its task #3 is not redone");
    const n8 = S.completeTask(w8, "drafts", 1, { summary: "looked fine" });
    const r8 = S.completeTask(w8, "drafts", 1, { command: 'node -e "process.exit(0)"', exitCode: 0, summary: "ok" });
    ok(n8.verified === false && n8.unverifiedReason === "stale-evidence" && r8.verified === true && !st8().evidence["1"].stale && st8().evidence["1"].history.length === 2,
      "a runnable _Verify:_: a note doesn't clear the stale run, a new passing run does (history keeps both runs)");
    fs.writeFileSync(f8("requirements.md"), fs.readFileSync(f8("requirements.md"), "utf8").replace("log a warning", "log an error"));
    ok(/--phase requirements --reopen/.test(S.impactReport(w8, "drafts", {}).hint), "a NEW edit reaching a done task brings the reopen hint back");
    const ro8c = S.impactReport(w8, "drafts", { reopen: true });
    ok(ro8c.recorded === true && ro8c.reopened.join() === "2" && st8().changes.length === 3 && Object.keys(st8().changes[2].digests).length === 4,
      "a NEW edit of an AC already reopened once is new: the task citing it is reopened again");

    // tasks: added / removed / changed numbers (checkbox state is not a change); reopen/phase validation.
    fs.writeFileSync(f8("tasks.md"), fs.readFileSync(f8("tasks.md"), "utf8").replace("[US1] Reject empty drafts", "[US1] Reject empty drafts with a message")
      .replace("- [x] 3. [US1] Keep CRLF\r\n  - _Requirements: US-1.AC-3_\r\n", "") + "- [ ] 5. [US1] Archive old drafts\r\n  - _Requirements: US-1.AC-4_\r\n");
    const ti8 = (await call8("spec_impact", { name: "drafts", phase: "tasks", projectDir: w8 })).p;
    ok(ti8.ok && ti8.added.map((x) => x.number).join() === "5" && ti8.modified.map((x) => x.number).join() === "4" && ti8.removed.map((x) => x.number).join() === "3" && ti8.affectedTasks === undefined,
      "tasks diff: added / changed / removed task numbers (unticked checkboxes are not a change)");
    const rt8 = S.impactReport(w8, "drafts", { phase: "tasks", reopen: true });
    const bad8m = await call8("spec_impact", { name: "drafts", phase: "plan", projectDir: w8 });
    const bad8e = S.impactReport(w8, "drafts", { phase: "plan" });
    ok(rt8.ok === false && /reopen applies to requirements, design, test-plan and eval-plan/.test(rt8.error) && bad8m.isError && /phase must be one of: requirements, design, test-plan, eval-plan, tasks/.test(bad8m.p.error) &&
      bad8e.ok === false && /Unknown phase 'plan' for spec_impact/.test(bad8e.error), "reopen on tasks is refused; an unknown phase is refused (MCP schema and engine)");

    // test-plan: T-ID row diff (a row keyed by its first cell; re-padding is no change) → the tasks making a changed test
    // green; reopen unticks a MODIFIED test's done tasks, a REMOVED test's tasks are listed in retire (never redone);
    // next_action / doctor name `--phase test-plan` for a changed test-plan.md (they offered only --phase design).
    const pe8 = S.createFeature(w8, "Plan edits", ["tdd"]);
    const tpf = (x) => path.join(pe8.dir, x);
    fs.writeFileSync(tpf("requirements.md"), "# Feature: Plan edits\n\n## Summary\nPlans.\n\n### US-1 (P1 — MVP): Plans\n#### Acceptance Criteria (EARS)\n" +
      "1. **US-1.AC-1** — WHEN a plan is saved THE SYSTEM SHALL store it.\n2. **US-1.AC-2** — WHEN a plan is deleted THE SYSTEM SHALL archive it.\n\n## Success Criteria\n- **SC-001** — 99% saved in 1 s.\n");
    const planA = "# Test Plan\n\n| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---|---|---|---|---|---|\n" +
      "| T-01 | unit | example | a saved plan is stored | US-1.AC-1 | `tests/unit/plan.test.js` |\n| T-02 | unit | example | a deleted plan is archived | US-1.AC-2 | `tests/unit/plan.test.js` |\n" +
      "| T-03 | unit | property | archive keeps every field | US-1.AC-2 | `tests/unit/plan.test.js` |\n";
    fs.writeFileSync(tpf("test-plan.md"), planA);
    fs.writeFileSync(tpf("tasks.md"), "# Tasks\n\n- [x] 1. [US1] Store plans\n  - _Requirements: US-1.AC-1_\n  - _Makes green: T-01_\n- [x] 2. [US1] Archive plans\n  - _Requirements: US-1.AC-2_\n  - _Makes green: T-02_\n" +
      "- [x] 3. [US1] Keep archived fields\n  - _Requirements: US-1.AC-2_\n  - _Makes green: T-03_\n");
    approveBefore(w8, pe8.slug, "test-plan");
    const tpAp = S.approvePhase(w8, pe8.slug, "test-plan");
    fs.writeFileSync(tpf("test-plan.md"), planA.replace("a saved plan is stored", "a saved plan is stored with its owner").replace("| T-02 | unit | example |", "|T-02|  unit |example|")
      .replace(/\| T-03 [^\n]*\n/, "") + "| T-04 | integration | example | a plan survives a restart | US-1.AC-1 | `tests/integration/plan.test.js` |\n");
    const tpIm = (await call8("spec_impact", { name: pe8.slug, phase: "test-plan", projectDir: w8 })).p;
    const tpNext = S.nextAction(w8, pe8.slug);
    const tpDoc = S.specDoctor(w8, pe8.slug).checks.find((c) => c.id === "changed-since-approval");
    const tpLines = S.impactLines(tpIm).join("\n");
    all("impact --phase test-plan: added / modified / removed T-IDs (re-padding is no change), the tasks making them green, a removed test in retire; next_action and doctor name --phase test-plan (got " +
      JSON.stringify([tpIm.added, tpIm.modified, tpIm.removed, tpIm.retire, tpNext.recommendation]).slice(0, 400) + ")", [
      () => tpAp.ok, () => tpIm.ok, () => tpIm.phase === "test-plan", () => tpIm.file === "test-plan.md", () => tpIm.baseline === "snapshot",
      () => tpIm.added.map((x) => x.id).join() === "T-04", () => tpIm.modified.map((x) => x.id).join() === "T-01",
      () => tpIm.removed.map((x) => x.id).join() === "T-03",
      () => tpIm.impacted.find((x) => x.id === "T-01").tasks.map((t) => t.number).join() === "1",
      () => tpIm.affectedTasks.map((t) => t.number).join() === "1,3",
      () => JSON.stringify(tpIm.retire) === JSON.stringify([{ id: "T-03", tasks: [3], tests: [] }]),
      () => /Removed tests still made green by tasks — T-03 → tasks #3: don't redo those tasks/.test(tpIm.hint),
      () => /--phase test-plan --reopen/.test(tpIm.hint), () => /~ T-01 {2}unit \| example \| a saved plan is stored with its owner/.test(tpLines),
      () => /T-03 \(removed\) — tasks: #3 \[x\]/.test(tpLines), () => tpNext.step === "re-review",
      () => /node "[^"]*dev-spec\.js" impact plan-edits --phase test-plan/.test(tpNext.recommendation),
      () => tpNext.impact.phases.join() === "test-plan", () => tpDoc,
      () => /\(node "[^"]*dev-spec\.js" impact plan-edits --phase test-plan\)/.test(tpDoc.detail),
    ]);
    const tpRo = S.impactReport(w8, pe8.slug, { phase: "test-plan", reopen: true });
    const tpSt = JSON.parse(fs.readFileSync(tpf(".state.json"), "utf8"));
    const tpTasks = fs.readFileSync(tpf("tasks.md"), "utf8");
    ok(tpRo.ok && tpRo.recorded && tpRo.reopened.join() === "1" && /- \[ \] 1\./.test(tpTasks) && /- \[x\] 2\./.test(tpTasks) && /- \[x\] 3\./.test(tpTasks) &&
      tpSt.changes.slice(-1)[0].phase === "test-plan" && tpSt.changes.slice(-1)[0].modified.join() === "T-01" && tpSt.changes.slice(-1)[0].removed.join() === "T-03" &&
      /Removed tests are not redone — still named in _Makes green:_: T-03 → tasks #3/.test(tpRo.note) &&
      /Testes removidos que tarefas ainda põem a verde/.test(S.msg("pt").impact.retireTests.retireHint("T-03 → tarefas #3", "x", "test-plan", false)) &&
      /Pruebas eliminadas que aún ponen en verde/.test(S.msg("es").impact.retireTests.retireHint("T-03 → tareas #3", "x", "test-plan", false)),
      "impact --phase test-plan --reopen: unticks only the done task making a MODIFIED test green (#1), keeps the removed test's task (#3) ticked and listed, records the change request (retire wording EN/PT/ES)");
    // eval-plan: diffed by section like the design; next_action names --phase eval-plan.
    const ep8 = S.createFeature(w8, "Eval edits", ["ai"]);
    approveBefore(w8, ep8.slug, "eval-plan");
    S.approvePhase(w8, ep8.slug, "eval-plan", "x", { force: true });
    const epf = path.join(ep8.dir, "eval-plan.md");
    fs.writeFileSync(epf, fs.readFileSync(epf, "utf8").replace("Every fixed production failure becomes a permanent eval case.", "Every fixed production failure becomes a permanent eval case, tagged with its incident."));
    const epIm = S.impactReport(w8, ep8.slug, { phase: "eval-plan" });
    const epNext = S.nextAction(w8, ep8.slug);
    ok(epIm.ok && epIm.modified.map((x) => x.section).join() === "Regression Set" && !epIm.added.length && !epIm.removed.length &&
      epNext.step === "re-review" && /node "[^"]*dev-spec\.js" impact eval-edits --phase eval-plan/.test(epNext.recommendation),
      "impact --phase eval-plan: a section-level diff like design; next_action names --phase eval-plan (got " + JSON.stringify([epIm.modified, epNext.recommendation]).slice(0, 300) + ")");
    // A ticked sub-step is progress (like the fingerprint), not a changed task; doctor names only the phase that changed.
    const sb8 = S.createFeature(w8, "Steps", ["core"]);
    const sbf = (x) => path.join(sb8.dir, x);
    fs.writeFileSync(sbf("tasks.md"), "# Tasks\n\n## S\n- [ ] 1. Do A\n  - [ ] 1.1 first sub-step\n  - _Requirements: US-1.AC-1_\n");
    ["requirements", "design", "tasks"].forEach((ph) => S.approvePhase(w8, "steps", ph, "x", { force: true }));
    fs.writeFileSync(sbf("tasks.md"), "# Tasks\n\n## S\n- [ ] 1. Do A\n  - [x] 1.1 first sub-step\n  - _Requirements: US-1.AC-1_\n");
    const sbT = S.impactReport(w8, "steps", { phase: "tasks" });
    fs.appendFileSync(sbf("design.md"), "\n## Extra\nmore\n");
    const sbD = S.specDoctor(w8, "steps").checks.find((c) => c.id === "changed-since-approval");
    ok(sbT.ok && sbT.changed === false && sbT.modified.length === 0 && sbD && /^changed after their approval: design\.md —/.test(sbD.detail) &&
      sbD.detail.includes("(" + S.DEV_SPEC + " impact steps --phase design)") && !sbD.detail.includes("--phase requirements"),
      "impact tasks: a ticked sub-step is not a changed task; doctor's hint names --phase design when only design.md changed");

    // Never approved; an existing snapshot file is never overwritten; a pre-1.13 approval is fingerprint-only.
    const fr8 = S.createFeature(w8, "Fresh", ["core"]);
    const nv8 = await call8("spec_impact", { name: "fresh", projectDir: w8 });
    fs.mkdirSync(path.join(fr8.dir, ".history"), { recursive: true });
    fs.writeFileSync(path.join(fr8.dir, ".history", "requirements@1.md"), "hand-made\n");
    const frAp = S.approvePhase(w8, "fresh", "requirements", "x", { force: true });
    ok(nv8.isError && nv8.p.neverApproved === true && /'requirements' was never approved for 'fresh'/.test(nv8.p.error) && frAp.snapshot === ".history/requirements@2.md" &&
      fs.readFileSync(path.join(fr8.dir, ".history", "requirements@1.md"), "utf8") === "hand-made\n", "never approved → a clear error; an existing snapshot file is never overwritten (@2)");
    const lg8 = S.createFeature(w8, "Legacy", ["core"]);
    S.approvePhase(w8, "legacy", "requirements", "old", { force: true });
    const lgFile = path.join(lg8.dir, ".state.json");
    const lgSt = JSON.parse(fs.readFileSync(lgFile, "utf8"));
    delete lgSt.approvalHistory;
    fs.writeFileSync(lgFile, JSON.stringify(lgSt));
    fs.rmSync(path.join(lg8.dir, ".history"), { recursive: true, force: true });
    const lf0 = S.impactReport(w8, "legacy", {});
    fs.appendFileSync(path.join(lg8.dir, "requirements.md"), "\n- one more assumption\n");
    const lf1 = (await call8("spec_impact", { name: "legacy", reopen: true, projectDir: w8 })).p;
    const lgDoc = S.specDoctor(w8, "legacy").checks.find((c) => c.id === "changed-since-approval");
    ok(lf0.baseline === "fingerprint-only" && lf0.changed === false && /Re-approve to start the history: \/approve legacy requirements/.test(lf0.hint) && lf1.baseline === "fingerprint-only" &&
      lf1.changed === true && lf1.reopened.length === 0 && lf1.recorded === false && lf1.added === undefined && lgDoc && !/spec_impact/.test(lgDoc.detail),
      "a pre-1.13 approval (no history) → baseline fingerprint-only, changed from the fingerprint + a re-approve hint; reopen reopens nothing; doctor doesn't point to spec_impact");
    const lgRe = S.approvePhase(w8, "legacy", "requirements", "new", { force: true });
    const lgH = JSON.parse(fs.readFileSync(lgFile, "utf8")).approvalHistory;
    ok(lgRe.snapshot === ".history/requirements@1.md" && S.impactReport(w8, "legacy", {}).baseline === "snapshot" &&
      lgH.length === 2 && lgH[0].legacy === true && lgH[0].by === "old" && lgH[0].snapshot === undefined && lgH[1].by === "new" && !lgH[1].legacy,
      "re-approving a legacy phase starts its history: the approval it replaces is seeded first as a legacy record (no snapshot; @1 counts snapshots)");
    const bh8 = S.createFeature(w8, "Badhist", ["core"]);
    const bhFile = path.join(bh8.dir, ".state.json");
    fs.writeFileSync(bhFile, JSON.stringify({ lang: "en", approvals: {}, approvalHistory: { requirements: 1 }, changes: "x" }));
    const bhAp = S.approvePhase(w8, "badhist", "requirements", "x", { force: true });
    const bhIm = S.impactReport(w8, "badhist", {});
    const bhM = S.metrics(w8, "badhist");
    ok(bhAp.ok === false && /'approvalHistory' must be an array; 'changes' must be an array/.test(bhAp.error) && JSON.parse(fs.readFileSync(bhFile, "utf8")).approvalHistory.requirements === 1 &&
      bhIm.ok === false && bhM.ok === true && /approvalHistory/.test(bhM.warning) && bhM.rework === null && bhM.changeRequests === 0,
      "a non-list approvalHistory / changes is refused by approve and impact (never replaced); metrics uses the valid parts and says so");

    // PT feature: impact lines, the next_action hint, errors and the retro template are European Portuguese.
    const pt8 = S.createFeature(w8, "Rascunhos", ["core"], undefined, undefined, "pt");
    const ptf = (x) => path.join(pt8.dir, x);
    const ptReq = "# Funcionalidade: Rascunhos\n\n## Resumo\nGuardar rascunhos.\n\n### US-1 (P1 — MVP): Guardar\n\n#### Critérios de Aceitação (EARS)\n1. **US-1.AC-1** — QUANDO o utilizador guarda O SISTEMA DEVE guardar o rascunho\n";
    fs.writeFileSync(ptf("requirements.md"), ptReq);
    fs.writeFileSync(ptf("design.md"), "# Design: Rascunhos\n\n## Modelo de dados\nRascunhos por id (US-1.AC-1).\n");
    fs.writeFileSync(ptf("tasks.md"), "# Tarefas: Rascunhos\n\n## História US-1\n- [x] 1. [US1] Guardar rascunhos\n  - _Requirements: US-1.AC-1_\n");
    ["classification", "requirements", "design", "tasks"].forEach((ph) => S.approvePhase(w8, "rascunhos", ph, "x", { force: true }));
    fs.writeFileSync(ptf("requirements.md"), ptReq.replace("guardar o rascunho", "guardar o rascunho em menos de 1 segundo"));
    const ptL8 = S.impactLines(S.impactReport(w8, "rascunhos", {})).join("\n");
    const ptNa8 = S.nextAction(w8, "rascunhos");
    const ptNv8 = S.impactReport(w8, "rascunhos", { phase: "design", reopen: true });
    const ptDg = S.specDoctor(w8, "rascunhos").checks.find((c) => c.id === "changed-since-approval");
    ok(/^Impacto: rascunhos · requirements — face à aprovação de \d{4}/.test(ptL8) && ptL8.includes("US-1.AC-1 (alterado) — tarefas: #1 [x] nada a verificar (sem comando _Verify:_, nada registado)") && /volta a aprovar: \/approve rascunhos requirements/.test(ptL8) &&
      /Vê primeiro o que a edição afeta com spec_impact/.test(ptNa8.recommendation) && ptNv8.ok && ptNv8.changed === false && ptNv8.recorded === false &&
      /^alterado\(s\) após a aprovação: requirements\.md/.test(ptDg.detail) && /nunca foi aprovada em 'fresca'/.test(S.impactReport(w8, S.createFeature(w8, "Fresca", ["core"], undefined, undefined, "pt").slug, {}).error),
      "PT feature: impact lines, next_action's spec_impact hint, doctor's check and errors are in European Portuguese");

    // K. Metrics: deterministic state (createdAt, history with a re-approval and a forced one, evidence runs, change requests).
    const w8m = path.join(tmp, "proj-wp8m");
    S.initProject(w8m, ["tdd"]);
    const mt8 = S.createFeature(w8m, "Metered", ["tdd"]);
    fs.writeFileSync(path.join(mt8.dir, "tasks.md"), "# Tasks\n\n## S\n- [x] 1. A\n- [x] 2. B\n");
    fs.writeFileSync(path.join(mt8.dir, "requirements.md"), "# R\n\n1. **US-1.AC-1** — WHEN x THE SYSTEM SHALL y [NEEDS CLARIFICATION: which store?]\n");
    const T8 = (d, h = "00") => `2026-01-${d}T${h}:00:00.000Z`;
    fs.writeFileSync(path.join(mt8.dir, ".state.json"), JSON.stringify({ lang: "en", tracks: ["core", "tdd"], createdAt: T8("01"),
      approvals: { requirements: { at: T8("02"), by: "a" }, design: { at: T8("03"), by: "a", forced: true, failing: ["constitution-check"] }, tasks: { at: T8("04"), by: "a" }, execution: { at: T8("06"), by: "a" } },
      approvalHistory: [{ phase: "requirements", at: T8("01", "12"), by: "a" }, { phase: "requirements", at: T8("02"), by: "a" }, { phase: "design", at: T8("03"), by: "a", forced: true, failing: ["constitution-check"] },
        { phase: "tasks", at: T8("04"), by: "a" }, { phase: "execution", at: T8("06"), by: "a" }],
      evidence: { 1: { command: "npm test", exitCode: 0, at: T8("05"), history: [{ command: "npm test", exitCode: 1, at: T8("04", "12") }, { command: "npm test", exitCode: 0, at: T8("05") }], task: "A", verify: "" },
        2: { summary: "checked by hand", manual: true, at: T8("04", "18"), task: "B", verify: "" } },
      changes: [{ at: T8("05"), phase: "requirements", reopened: [1, 2] }, { at: T8("05"), phase: "design", reopened: [2] }] }));
    const m8 = (await call8("spec_metrics", { name: "metered", projectDir: w8m })).p;
    const lt8 = m8.leadTime;
    ok(m8.ok && m8.scope === "feature" && m8.createdAt === T8("01") && m8.createdAtApproximate === false && lt8.requirements.hours === 12 && lt8.design.hours === 48 && lt8.tasks.hours === 72 &&
      lt8["test-plan"] === null && lt8.complete.hours === 96 && !lt8.complete.approximate && lt8.finished.hours === 120,
      "spec_metrics: createdAt from state; lead time (hours) to each phase's FIRST approval, to complete (latest evidence of the done tasks) and to finished (the first execution approval or the spec_finish {write} record, whichever is earlier)");
    ok(m8.approvalsTotal === 5 && m8.rework === 1 && m8.reworkByPhase.requirements === 1 && m8.forcedApprovals === 1 && m8.changeRequests === 2 && m8.reopenedTasks === 3 &&
      m8.reopenedTasksUnique === 2 && m8.evidence.runs === 2 && m8.evidence.passing === 1 && m8.evidence.passRate === 50 && m8.tasks.done === 2 && m8.tasks.total === 2 && m8.openClarifications === 1,
      "spec_metrics: rework (re-approvals), forced approvals, change requests + reopened tasks, evidence pass rate from the run history, tasks, open clarification markers");
    ok(JSON.stringify(m8) === JSON.stringify(S.metrics(w8m, "metered")) && S.metricsLines(m8).join("\n").includes("lead time from creation: requirements 12h · design 2d · tasks 3d · complete 4d · finished 5d") &&
      S.metricsLines(m8).includes("  approvals: 5 · rework: 1 (requirements 1) · forced: 1") && S.metricsLines(m8).includes("  evidence: 50% of runs passing (1/2)"),
      "MCP spec_metrics = the engine call; metricsLines formats durations (h/d) and counts");
    // Phase 4 ('tests', the hard gate) is measured like every other gated phase: lead time, CLI line, retro row, project key.
    const w8t = path.join(tmp, "proj-wp8m-tests"); // its own project: w8m's project view counts exactly two features
    const tp8 = S.createFeature(w8t, "Tested", ["tdd"]);
    fs.writeFileSync(path.join(tp8.dir, ".state.json"), JSON.stringify({ lang: "en", tracks: ["core", "tdd"], createdAt: T8("01"),
      approvals: { "test-plan": { at: T8("02"), by: "a" }, tests: { at: T8("03"), by: "a" }, tasks: { at: T8("04"), by: "a" } },
      approvalHistory: [{ phase: "test-plan", at: T8("02"), by: "a" }, { phase: "tests", at: T8("03"), by: "a" }, { phase: "tests", at: T8("03", "06"), by: "a" }, { phase: "tasks", at: T8("04"), by: "a" }] }));
    const tm8 = S.metrics(w8t, "tested");
    const tl8 = S.metricsLines(tm8).join("\n");
    const tr8 = S.msg("en").metrics.retro(tm8, { dur: (h) => h + "h", today: "2026-01-09" });
    const tpt8 = S.msg("pt").metrics.retro(tm8, { dur: (h) => h + "h", today: "2026-01-09" });
    const tp8all = S.metrics(w8t);
    ok(tm8.leadTime.tests && tm8.leadTime.tests.hours === 48 && tm8.reworkByPhase.tests === 1 && /test plan 24h · tests 2d · tasks 3d/.test(tl8) && /rework: 1 \(tests 1\)/.test(tl8) &&
      /\| Lead time → tests \| 48h \|/.test(tr8) && /testes/.test(tpt8) && Object.keys(tp8all.aggregates.leadTimeHours).join() === "classification,requirements,design,test-plan,eval-plan,tests,tasks,complete,finished" &&
      m8.leadTime.tests === null,
      "spec_metrics measures Phase 4 ('tests'): leadTime.tests, the CLI line, retro.md's 'Lead time → tests' row (PT 'testes'), rework by phase and the project's leadTimeHours key; null where never approved (got " + tl8 + ")");
    const old8 = S.createFeature(w8m, "Oldie", ["core"]);
    fs.writeFileSync(path.join(old8.dir, ".state.json"), JSON.stringify({ lang: "en", approvals: { requirements: { at: "2026-02-01T00:00:00.000Z", by: "x" }, design: { at: "2026-02-03T00:00:00.000Z", by: "x", forced: true } } }));
    const om8 = S.metrics(w8m, "oldie");
    all("a legacy feature (no createdAt, no history): createdAt from the earliest approval (approximate), rework unknown (null) — never throws", [
      () => om8.ok, () => om8.createdAt === "2026-02-01T00:00:00.000Z", () => om8.createdAtApproximate === true,
      () => om8.createdAtSource === "approval", () => om8.leadTime.requirements.approximate === true, () => om8.leadTime.design.hours === 48,
      () => om8.rework === null, () => om8.approvalsTotal === 2, () => om8.legacyPhases.join() === "requirements,design",
      () => om8.reworkLowerBound === false, () => om8.forcedApprovals === 1, () => om8.changeRequests === 0, () => om8.evidence.passRate === null,
      () => /rework: unknown/.test(S.metricsLines(om8).join("\n")), () => /\(approximate: from the earliest approval\)/.test(S.metricsLines(om8)[0]),
    ]);
    const bare8 = S.createFeature(w8, "Bare", ["core"]);
    fs.writeFileSync(path.join(bare8.dir, ".state.json"), JSON.stringify({ lang: "en", approvals: {} }));
    const bm8 = S.metrics(w8, "bare");
    ok(bm8.ok && bm8.createdAtSource === "filesystem" && bm8.createdAtApproximate === true && typeof bm8.createdAt === "string" && ["classification", "requirements", "design", "test-plan", "eval-plan", "tasks"].every((p) => bm8.leadTime[p] === null) && bm8.leadTime.complete === null,
      "no createdAt and no approval: the folder's date, flagged approximate; no lead times");
    // A feature with no approval yet has an empty history (createFeature doesn't seed approvalHistory) — rework 0, not unknown.
    const nw8 = S.createFeature(w8, "Brand new", ["core"]);
    const nm8 = S.metrics(w8, nw8.slug, { write: true });
    ok(nm8.approvalsTotal === 0 && nm8.rework === 0 && nm8.forcedApprovals === 0 && nm8.createdAtApproximate === false && bm8.rework === 0 &&
      S.metricsLines(nm8).includes("  approvals: 0 · rework: 0 · forced: 0") && fs.readFileSync(path.join(nw8.dir, "retro.md"), "utf8").includes("| Rework (re-approvals) | 0 |"),
      "a feature never approved: approvals 0, rework 0 (not 'unknown — the approvals predate the change history'), in the lines and retro.md");
    // Pass rate follows the evidence gate: a bare {exitCode: 0} (v1.12) is no run; a non-zero exit code is a failed run.
    const lr8 = S.createFeature(w8, "Legacy runs", ["core"]);
    fs.writeFileSync(path.join(lr8.dir, ".state.json"), JSON.stringify({ lang: "en", approvals: {}, evidence: { 1: { exitCode: 0 }, 2: { exitCode: 2, summary: "crashed" },
      3: { command: "npm test", exitCode: 0, history: [{ exitCode: 0 }, { command: "npm test", exitCode: 0 }] } } }));
    const lrm8 = S.metrics(w8, "legacy-runs");
    ok(lrm8.evidence.runs === 2 && lrm8.evidence.passing === 1 && lrm8.evidence.passRate === 50,
      "evidence pass rate: a bare exit code 0 (record or history entry) is not a passing run — only {command, exitCode: 0} is; a non-zero exit is a failed run");
    const pm8 = (await call8("spec_metrics", { projectDir: w8m })).p;
    all("spec_metrics without name: per-feature rows + averages/medians (nulls skipped) + totals", [
      () => pm8.ok, () => pm8.scope === "project", () => pm8.features.map((x) => x.feature).join() === "metered,oldie",
      () => pm8.aggregates.rework.n === 1, () => pm8.aggregates.rework.avg === 1, () => pm8.aggregates.leadTimeHours.requirements.avg === 6,
      () => pm8.aggregates.leadTimeHours.requirements.median === 6, () => pm8.aggregates.leadTimeHours.design.median === 48,
      () => pm8.aggregates.forcedApprovals.avg === 1, () => pm8.aggregates.evidencePassRate.n === 1, () => pm8.totals.features === 2,
      () => pm8.totals.changeRequests === 2, () => pm8.totals.evidencePassRate === 50, () => /^Metrics — 2 feature\(s\)/.test(S.metricsLines(pm8)[0]),
      () => S.metricsLines(pm8).some((l) => /^ {2}median /.test(l)),
    ]);

    // 6. Retro: create-only, localized, pre-filled; never overwritten; needs a feature.
    const rw8 = S.metrics(w8m, "metered", { write: true });
    const retro8 = path.join(mt8.dir, "retro.md");
    const retroTxt = fs.readFileSync(retro8, "utf8");
    ok(rw8.retro.written === true && rw8.retro.path === ".specs/metered/retro.md" && retroTxt.startsWith("# Retrospective: metered\n") &&
      ["## What went well", "## What hurt", "## Proposed steering or constitution amendments", "## Follow-ups", "| Rework (re-approvals) | 1 (requirements 1) |",
        "| Evidence pass rate | 50% (1/2 runs) |", "| Lead time → complete | 4d |", "never applied automatically", "3 task(s) reopened by change requests"].every((s) => retroTxt.includes(s)) &&
      !/NEEDS CLARIFICATION|\*\*TODO\*\*/.test(retroTxt), "metrics {write:true} creates retro.md: metrics table + What went well / What hurt / amendments (human approval) / Follow-ups");
    ok(retroTxt.includes("'requirements' approved 2 time(s)") && !/re-approved/.test(retroTxt), "the retro signal counts approvals (rework 1 = approved 2 times), like PT/ES — never 're-approved 2 time(s)'");
    fs.appendFileSync(retro8, "\nmy notes\n");
    const rw8b = await call8("spec_metrics", { name: "metered", write: true, projectDir: w8m });
    const pw8 = await call8("spec_metrics", { write: true, projectDir: w8m });
    ok(!rw8b.isError && rw8b.p.retro.written === false && /already exists — left untouched/.test(rw8b.p.note) && fs.readFileSync(retro8, "utf8").endsWith("my notes\n") &&
      pw8.isError && /write needs a feature name/.test(pw8.p.error), "an existing retro.md is never overwritten (said so); write without a feature is an error");
    S.metrics(w8, "rascunhos", { write: true });
    const ptRetro = fs.readFileSync(ptf("retro.md"), "utf8");
    ok(ptRetro.startsWith("# Retrospetiva: rascunhos") && ["## O que correu bem", "## O que custou", "## Alterações propostas ao steering ou à constituição", "## Seguimento", "| Tempo até requisitos |"]
      .every((s) => ptRetro.includes(s)) && /^Métricas: rascunhos \[core\] — criada a \d{4}/.test(S.metricsLines(S.metrics(w8, "rascunhos"))[0]), "PT feature: the retro template and metrics lines are European Portuguese");

    // A feature upgraded mid-flight (a pre-1.13 approval, then 1.13 ones): the legacy approval still counts — approvals,
    // forced (agreeing with doctor's approval-gates) — and rework becomes a lower bound, in the JSON, the lines and retro.md.
    const mx8 = S.createFeature(w8m, "Mixed", ["core"]);
    const mxFile = path.join(mx8.dir, ".state.json");
    fs.writeFileSync(mxFile, JSON.stringify({ lang: "en", tracks: ["core"], approvals: { requirements: { at: "2026-01-01T00:00:00.000Z", by: "old", forced: true, failing: ["placeholders"] } } }));
    S.approvePhase(w8m, "mixed", "design", "x", { force: true });
    const mx1 = S.metrics(w8m, "mixed");
    const mxGates = S.specDoctor(w8m, "mixed").checks.find((c) => c.id === "approval-gates").detail;
    ok(mx1.approvalsTotal === 2 && mx1.forcedApprovals === 2 && mx1.rework === 0 && mx1.reworkLowerBound === true && mx1.legacyPhases.join() === "requirements" &&
      mx1.leadTime.requirements.approximate === true && /requirements \(placeholders\), design/.test(mxGates) &&
      S.metricsLines(mx1).includes("  approvals: 2 · rework: at least 0 · forced: 2 — rework unknown for requirements (approved before the change history)"),
      "mixed legacy + 1.13 approvals: the legacy one is counted (approvals 2, forced 2 like doctor's approval-gates), rework is a lower bound");
    S.approvePhase(w8m, "mixed", "requirements", "x", { force: true });
    const mx2 = S.metrics(w8m, "mixed");
    const mxH = JSON.parse(fs.readFileSync(mxFile, "utf8")).approvalHistory;
    S.metrics(w8m, "mixed", { write: true });
    ok(mxH.map((h) => h.phase + (h.legacy ? "*" : "")).join() === "requirements*,design,requirements" && mxH[0].forced === true && mx2.approvalsTotal === 3 && mx2.forcedApprovals === 3 &&
      mx2.rework === 1 && mx2.reworkLowerBound === true &&
      fs.readFileSync(path.join(mx8.dir, "retro.md"), "utf8").includes("| Rework (re-approvals) | at least 1 (requirements 1) — unknown for requirements (approved before the change history) |") &&
      S.metricsLines(S.metrics(w8m)).some((l) => /^ {2}mixed .* · rework 1\+ · forced 3 /.test(l)),
      "the replaced legacy approval stays in the history (seeded legacy record): re-approving its phase is rework 1 (at least) — JSON, retro.md, project row");

    // Bugfix: the design approval signs off bug.md (its Root Cause) — snapshot, fingerprint, impact and doctor follow it.
    const bf8 = S.createFeature(w8, "Crash on save", ["core"], undefined, undefined, undefined, "bugfix");
    const bff = (x) => path.join(bf8.dir, x);
    const bug8 = fs.readFileSync(bff("bug.md"), "utf8");
    const bfAp = S.approvePhase(w8, "crash-on-save", "design", "x", { force: true });
    const bfSt = JSON.parse(fs.readFileSync(bff(".state.json"), "utf8"));
    ok(bfAp.ok && bfAp.snapshot === ".history/design@1.md" && fs.readFileSync(bff(".history/design@1.md"), "utf8") === bug8 && !fs.existsSync(bff("design.md")) &&
      bfSt.approvals.design.file === "bug.md" && bfSt.approvalHistory[0].file === "bug.md" && typeof bfSt.approvals.design.fingerprint === "string" && S.finishFeature(w8, "crash-on-save").changedSinceApproval.length === 0,
      "a bugfix's design approval snapshots and fingerprints bug.md (the artifact its gate signs off), recorded as file: bug.md");
    fs.writeFileSync(bff("bug.md"), bug8.replace(/## Root Cause[^\n]*\n/, (h) => h + "The save handler swallowed ENOSPC (US-1.AC-1).\n"));
    const bfIm = S.impactReport(w8, "crash-on-save", { phase: "design" });
    const bfDc = S.specDoctor(w8, "crash-on-save").checks.find((c) => c.id === "changed-since-approval");
    ok(bfIm.ok && bfIm.file === "bug.md" && bfIm.baseline === "snapshot" && bfIm.changed === true && bfIm.modified.map((x) => x.section + "|" + x.file).join() === "bug.md: Root Cause|bug.md" &&
      bfDc && /^changed after their approval: bug\.md —/.test(bfDc.detail) && bfDc.detail.includes("(" + S.DEV_SPEC + " impact crash-on-save --phase design)"),
      "an edit to bug.md after a bugfix's design approval: spec_impact --phase design diffs bug.md's sections; doctor flags bug.md and names --phase design");
    S.addTrack(w8, "crash-on-save", "saas");
    const ob8 = S.createFeature(w8, "Old bug", ["core"], undefined, undefined, undefined, "bugfix");
    const obFile = path.join(ob8.dir, ".state.json");
    fs.writeFileSync(obFile, JSON.stringify({ ...JSON.parse(fs.readFileSync(obFile, "utf8")), approvals: { design: { at: "2026-01-01T00:00:00.000Z", by: "x" } } }));
    fs.appendFileSync(path.join(ob8.dir, "bug.md"), "\nmore\n");
    // A pre-1.13 bugfix design approval (no fingerprint, no file) signed off bug.md, and nothing about bug.md was recorded:
    // its file date is no evidence (a clone resets it) — untracked, never "changed", a finish WARNING to re-approve.
    const obFin = S.finishFeature(w8, "old-bug");
    const obIm = S.impactReport(w8, "old-bug", { phase: "design" });
    ok(S.finishFeature(w8, "crash-on-save").changedSinceApproval.join() === "bug.md,design.md" && obFin.changedSinceApproval.join() === "" &&
      !obFin.blockers.some((b) => /changed after their approval/.test(b)) && obFin.warnings.some((w) => /^approved before change tracking .*: design \(bug\.md\) — re-approve .*\/approve old-bug design/.test(w)) &&
      obIm.baseline === "none" && obIm.changed === null && /predates content fingerprints/.test(obIm.hint) && S.impactLines(obIm)[0] === "Impact: old-bug · design — no fingerprint recorded: whether it changed can't be told",
      "a design.md created after a bugfix's design approval (track added) counts as changed too; a pre-1.13 bugfix approval (no file) never judges bug.md by its date — untracked (finish warning); impact: baseline none");
    const csI = S.impactReport(w8, "crash-on-save", { phase: "design" });
    ok(csI.designMd && csI.designMd.baseline === "absent" && csI.designMd.changed === true && csI.added.length > 0 &&
      csI.added.every((x) => x.file === "design.md" && x.section.startsWith("design.md: ")) && csI.modified.map((x) => x.section).join() === "bug.md: Root Cause",
      "spec_impact on that bugfix: design.md (absent at approval) adds every section, keyed by its file, next to bug.md's change");

    // A bugfix with +saas: its design approval snapshots design.md too (the [SaaS] sections its gate checks) — an edit there
    // is diffed by spec_impact --phase design and reopened, agreeing with doctor (it used to read "no changes").
    const sp8 = S.createFeature(w8, "Slow page", ["saas"], undefined, undefined, "en", "bugfix");
    const spf = (x) => path.join(sp8.dir, x);
    const spAp = S.approvePhase(w8, "slow-page", "design", "x", { force: true });
    const spDesign = fs.readFileSync(spf("design.md"), "utf8");
    ok(spAp.snapshot === ".history/design@1.md" && spAp.designSnapshot === ".history/design@1.design.md" && fs.readFileSync(spf(".history/design@1.design.md"), "utf8") === spDesign &&
      JSON.parse(fs.readFileSync(spf(".state.json"), "utf8")).approvalHistory[0].designSnapshot === ".history/design@1.design.md",
      "a bugfix +saas design approval snapshots design.md too (<phase>@<n>.design.md, recorded as designSnapshot)");
    fs.writeFileSync(spf("design.md"), spDesign.replace(/(## \[SaaS\] Performance Budget[^\n]*\n)/, "$1p95 under 200 ms on the listing (US-1.AC-1)\n"));
    const spI = (await call8("spec_impact", { name: "slow-page", phase: "design", projectDir: w8 })).p;
    const spDc = S.specDoctor(w8, "slow-page").checks.find((c) => c.id === "changed-since-approval");
    const spL = S.impactLines(spI).join("\n");
    ok(spI.ok && spI.changed === true && spI.designMd.baseline === "snapshot" && spI.modified.map((x) => x.section + "|" + x.file).join() === "design.md: [SaaS] Performance Budget|design.md" &&
      spI.impacted[0].ids.includes("US-1.AC-1") && spL.includes("(.history/design@1.md, .history/design@1.design.md)") && spL.includes("  ~ design.md: [SaaS] Performance Budget") &&
      !spL.includes("no changes since the approval") && /^changed after their approval: design\.md —/.test(spDc.detail) && spDc.detail.includes("(" + S.DEV_SPEC + " impact slow-page --phase design)"),
      "an edit to a bugfix's design.md after its design approval: spec_impact --phase design diffs it (keyed by file), agreeing with doctor");
    const spR = S.impactReport(w8, "slow-page", { phase: "design", reopen: true });
    const spR2 = S.impactReport(w8, "slow-page", { phase: "design", reopen: true });
    ok(spR.recorded === true && spR.changeRequest === 1 && spR2.recorded === false && /Nothing new since the last reopen/.test(spR2.note),
      "reopen on a bugfix's design.md edit records the change request; a second reopen is 'nothing new' (a prior reopen exists)");
    // An approval that kept only design.md's fingerprint (no designSnapshot): impact says THAT design.md changed, never
    // "no changes"; reopen says why nothing was reopened; doctor doesn't send to an impact that can't diff it.
    const fp8 = S.createFeature(w8, "Slow list", ["saas"], undefined, undefined, "en", "bugfix");
    S.approvePhase(w8, "slow-list", "design", "x", { force: true });
    const fpFile = path.join(fp8.dir, ".state.json");
    const fpSt = JSON.parse(fs.readFileSync(fpFile, "utf8"));
    delete fpSt.approvalHistory[0].designSnapshot;
    fs.writeFileSync(fpFile, JSON.stringify(fpSt));
    fs.appendFileSync(path.join(fp8.dir, "design.md"), "\nmore budget notes\n");
    const fpI = S.impactReport(w8, "slow-list", { phase: "design" });
    const fpR = S.impactReport(w8, "slow-list", { phase: "design", reopen: true });
    const fpDc = S.specDoctor(w8, "slow-list").checks.find((c) => c.id === "changed-since-approval");
    ok(fpI.changed === true && fpI.designMd.baseline === "fingerprint-only" && /design\.md changed since the approval too, but this approval kept no snapshot of it/.test(fpI.designHint) &&
      !S.impactLines(fpI).join("\n").includes("no changes since the approval") && fpR.recorded === false && /design\.md changed, but without a snapshot of it/.test(fpR.note) &&
      /^changed after their approval: design\.md — re-review/.test(fpDc.detail),
      "a bugfix approval with only design.md's fingerprint: impact and reopen say design.md changed but can't be diffed; doctor doesn't send to spec_impact");

    // reopen with nothing to reopen: say why — never "nothing new since the last reopen" when no reopen preceded it.
    const nc8 = S.createFeature(w8, "Unchanged", ["core"]);
    S.approvePhase(w8, "unchanged", "requirements", "x", { force: true });
    const nc0 = (await call8("spec_impact", { name: "unchanged", reopen: true, projectDir: w8 })).p;
    fs.appendFileSync(path.join(nc8.dir, "requirements.md"), "\nA closing remark outside any criterion.\n");
    const nc1 = S.impactReport(w8, "unchanged", { reopen: true });
    ok(nc0.recorded === false && nc0.note === "Nothing changed since the approval — nothing to reopen." && nc1.changed === true && nc1.recorded === false &&
      /^Nothing to reopen: the edit changed no criterion or section/.test(nc1.note) && !(JSON.parse(fs.readFileSync(path.join(nc8.dir, ".state.json"), "utf8")).changes || []).length &&
      ptNv8.note === "Nada mudou desde a aprovação — nada a reabrir.",
      "reopen with nothing changed (or only text outside the criteria) says so (EN/PT) — not 'nothing new since the last reopen', which no reopen preceded");

    // Every WP8 message exists in EN, PT and ES (same keys).
    const keys8 = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys8(v, pre + k + ".") : [pre + k])).sort();
    ok(["impact", "metrics"].every((ns) => { const en = JSON.stringify(keys8(S.msg("en")[ns])); return ["pt", "es"].every((l) => JSON.stringify(keys8(S.msg(l)[ns])) === en); }) &&
      ["approvalHistory", "changes"].every((k) => ["en", "pt", "es"].every((l) => typeof S.msg(l).jsonShape[k] === "string")) &&
      /^# Retrospectiva: x/.test(S.msg("es").metrics.retro({ feature: "x", leadTime: {}, evidence: { runs: 0 }, tasks: { done: 0, total: 0 }, openClarifications: 0, forcedApprovals: 0, changeRequests: 0, reopenedTasks: 0, rework: null }, { dur: String, today: "2026-01-01" })),
      "WP8 messages (impact, metrics, retro, jsonShape) exist in EN, PT and ES with the same keys");
  }

  { // Final verification: a changed artifact of a phase AFTER the first pending gate never loops next_action on a
    // re-review that approve would refuse (phase-order) — the pending gate (here the test plan +tdd just added) comes first.
    const lp = path.join(tmp, "proj-reloop");
    const lf = S.createFeature(lp, "Loop check", ["core"], "", undefined, "en");
    for (const ph of ["classification", "requirements", "design", "tasks"]) S.approvePhase(lp, lf.slug, ph, "tester", { force: true });
    S.addTrack(lp, lf.slug, "tdd");
    fs.appendFileSync(path.join(lf.dir, "tasks.md"), "\n<!-- edited after approval -->\n- [ ] 99. [US1] a later task\n");
    let na = S.nextAction(lp, lf.slug);
    const seen = [na.step + ":" + (na.recommendation || "").slice(0, 60)];
    // add_track also rewrote classification.md (Active Tracks) and added design.md's Testability section — EARLIER phases than
    // the pending test plan: those are re-reviewed (and re-approved) first.
    for (let i = 0; i < 3 && na.step === "re-review" && /classification\.md|design\.md/.test(na.recommendation); i++) {
      for (const ph of ["classification", "design"]) if (na.recommendation.includes(ph + ".md")) S.approvePhase(lp, lf.slug, ph, "tester", { force: true });
      na = S.nextAction(lp, lf.slug);
      seen.push(na.step + ":" + (na.recommendation || "").slice(0, 60));
    }
    const reapTasks = S.approvePhase(lp, lf.slug, "tasks", "tester");
    ok(na.step !== "re-review" && /test-plan\.md/.test(na.recommendation) && na.changedSinceApproval.includes("tasks.md") &&
      reapTasks.ok === false && reapTasks.failing.includes("phase-order"),
      "next_action never recommends re-reviewing tasks.md while the earlier test-plan gate is pending (approve would refuse it on phase-order) — it points at test-plan.md (got " + seen.join(" | ") + ")");
  }

  // 1.14 full review (C) — change management: one regression per confirmed finding.
  {
    const cr = path.join(tmp, "proj-full-review-c");
    S.initProject(cr, ["core"], "en");
    const mk = (name) => S.createFeature(cr, name, ["core"], "x", undefined, "en");
    const stOf = (c) => path.join(c.dir, ".state.json");
    // C1: a role's PARTIAL execution sign-off before `since` doesn't hide the feature from Added once the last role signs.
    const c1 = mk("Partial ship");
    const tA = "2026-09-20T10:00:00.000Z", tB = "2026-09-22T10:00:00.000Z";
    const s1 = JSON.parse(fs.readFileSync(stOf(c1), "utf8"));
    s1.approvals = { execution: { at: tB, by: "pat", roles: { qa: { by: "quinn", at: tA }, product: { by: "pat", at: tB } } } };
    s1.approvalHistory = [{ phase: "execution", at: tA, by: "quinn", role: "qa", partial: true }, { phase: "execution", at: tB, by: "pat", role: "product", roles: ["qa", "product"] }];
    fs.writeFileSync(stOf(c1), JSON.stringify(s1, null, 2));
    const cl1 = S.changelog(cr, { since: "2026-09-21" });
    ok(cl1.ok && cl1.added.some((x) => x.feature === "partial-ship"),
      "full review C1: a partial (one role) execution sign-off before `since` is no shipment — the feature is Added once the last role signs (got " + JSON.stringify([cl1.ok, cl1.counts]) + ")");
    // C2: decisions.md ending inside an unclosed fence: the new entry is readable and numbers are never reused.
    const c2 = mk("Fenced log");
    S.decide(cr, "fenced-log", { title: "First", decision: "x" });
    fs.appendFileSync(path.join(c2.dir, "decisions.md"), "\n```js\nconst x = 1;\n");
    const d2 = S.decide(cr, "fenced-log", { title: "Second", decision: "y" });
    const d3 = S.decide(cr, "fenced-log", { title: "Third", decision: "z" });
    const log2 = S.decisionLog(fs.readFileSync(path.join(c2.dir, "decisions.md"), "utf8")).map((e) => e.id);
    ok(d2.id === "D-2" && d3.id === "D-3" && JSON.stringify(log2) === '["D-1","D-2","D-3"]' && /const x = 1;\n```\n/.test(fs.readFileSync(path.join(c2.dir, "decisions.md"), "utf8")),
      "full review C2: spec_decide closes a code fence left open at the end of decisions.md (appended) — the entries stay readable, D-n never reused (got " + JSON.stringify([d2.id, d3.id, log2]) + ")");
    // C3: a dependency on a feature that is archived too comes back, whichever of the two is restored first.
    for (const order of [["dep-b", "dep-a"], ["dep-a", "dep-b"]]) {
      mk("Dep A"); mk("Dep B");
      S.setDependency(cr, "dep-b", ["dep-a"]);
      S.manageFeature(cr, "archive", "dep-b"); S.manageFeature(cr, "archive", "dep-a");
      const first = S.restoreFeature(cr, order[0]);
      S.restoreFeature(cr, order[1]);
      const deps = JSON.parse(fs.readFileSync(path.join(cr, ".specs", "roadmap.json"), "utf8")).features["dep-b"];
      ok(deps && JSON.stringify(deps.dependsOn) === '["dep-a"]' && (order[0] !== "dep-b" || first.skipped.some((s) => s.reason === "archived")),
        "full review C3: restoring " + order.join(" then ") + " (both archived) keeps dep-b → dep-a — the edge is handed to the archived feature's record, never dropped as 'gone' (got " + JSON.stringify([deps, first.skipped]) + ")");
      S.manageFeature(cr, "remove", "dep-a", undefined, { confirm: true }); S.manageFeature(cr, "remove", "dep-b", undefined, { confirm: true });
    }
    // C5: a task number held only by a leftover tick time is not reused by append.
    const c5 = mk("Tick gap");
    fs.writeFileSync(path.join(c5.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] one\n- [ ] 2. [US1] two\n");
    const s5 = JSON.parse(fs.readFileSync(stOf(c5), "utf8"));
    s5.ticks = { 3: "2026-09-01T10:00:00.000Z" };
    fs.writeFileSync(stOf(c5), JSON.stringify(s5, null, 2));
    const ap5 = S.appendTasks(cr, "tick-gap", [{ text: "New" }]);
    ok(ap5.ok && ap5.appended[0].number === 4,
      "full review C5: append_tasks numbers after a removed task's leftover tick time (never inherits its completion time) (got " + JSON.stringify(ap5.appended || ap5.error) + ")");
    // C6: a line break in a backlog note never becomes markdown structure in ROADMAP.md.
    S.backlog(cr, "add", "search\nlater", "soon\n\n## ⚠ Needs attention\n\nx");
    const rmMd = S.roadmapReport(cr, { write: true }) && fs.readFileSync(path.join(cr, ".specs", "ROADMAP.md"), "utf8");
    ok((rmMd.match(/^## ⚠/gm) || []).length === 1 && /\*\*search later\*\* — soon ## ⚠ Needs attention x/.test(rmMd),
      "full review C6: backlog name / note are one line (folded on add and when rendered) — no heading injected into ROADMAP.md (got " + JSON.stringify((rmMd.match(/^.*search.*$/m) || [])[0]) + ")");
    // C7: the export shows a stored entity reference as its character (decisions.md keeps "<!--" as "&lt;!--"), never a
    // literal "&lt;"; a link loses its brackets only in the <…> form (a trailing '>' belongs to the URL).
    const c7 = mk("Esc view");
    S.decide(cr, "esc-view", { title: "Comments", decision: "keep <!-- as text" });
    const rq7 = path.join(c7.dir, "requirements.md");
    fs.writeFileSync(rq7, fs.readFileSync(rq7, "utf8").replace(/(## Summary\s*\n)/, "$1See [a](https://a.b/c>) and [b](<https://a.b/d>).\n\n"));
    const ex7 = S.exportSpecs(cr, { name: "esc-view" }).content || "";
    ok(/keep &lt;!-- as text/.test(ex7) && !/&amp;lt;!--/.test(ex7) && ex7.includes('href="https://a.b/c&gt;"') && ex7.includes('href="https://a.b/d"'),
      "full review C7: export renders decisions.md's '&lt;!--' as '<!--' (no double escape); only a <…> link target loses its brackets (got " +
      JSON.stringify([(ex7.match(/keep [^<]{0,30}/) || [])[0], (ex7.match(/href="https:\/\/a\.b\/[^"]*"/g) || [])]) + ")");
  }

  { // 1.21 F3 — the merge title: the WHOLE line ≤ 72 characters, cut at the last clause boundary (, ; — –) that fits — no
    // ellipsis there —, else at a word with "…" (the 1.19 eval run's title ran to ~90 characters, cut mid-clause).
    const tt = path.join(tmp, "proj-121-titles");
    S.initProject(tt, ["core"], "en");
    const title = (name, summary, kind) => S.finishFeature(tt, S.createFeature(tt, name, ["core"], summary, undefined, "en", kind).slug).mergeTitle;
    const t1 = title("CSV export", "Export the orders list as CSV from the command line, so it opens cleanly in a spreadsheet.");
    const t2 = title("Key rotation", "Rotate every tenant API key daily; the old key stays valid for a twenty-four hour grace period.");
    const t3 = title("Dash title", "Keep the old key valid during the grace period — then revoke it everywhere at once please.");
    const t4 = title("No boundary", "A very long summary without any clause boundary at all that goes on and on and on forever and ever");
    const t5 = title("An extremely long feature slug that eats the budget", "Short words fit in the floor budget of twenty four characters or so.");
    const t6 = title("Short one", "Short summary.", "bugfix");
    const titles = [t1, t2, t3, t4, t5];
    ok(t1 === "feat(csv-export): Export the orders list as CSV from the command line" && t2 === "feat(key-rotation): Rotate every tenant API key daily" &&
      t3 === "feat(dash-title): Keep the old key valid during the grace period" && /^feat\(no-boundary\): A very long summary [^,;]*…$/.test(t4) && t4.length <= 72 &&
      titles.slice(0, 4).every((t) => t.length <= 72) && t5.length <= "feat(an-extremely-long-feature-slug-that-eats-the-budget): ".length + 24 && /…$|[a-z]$/.test(t5) &&
      /^fix\(short-one\): /.test(t6) && !/Short summary\./.test(t6),
      "1.21 F3: the merge title is ≤ 72 characters in all — the summary cut at its last , ; — that fits (no ellipsis), else at a word with …; a very long slug keeps a 24-character floor (got " +
      JSON.stringify(titles.concat(t6).map((t) => [t, t.length])) + ")");
    // 1.21 review A5 — the word-boundary fallback (no space: half the budget) used to cut an emoji in two, and a lone high surrogate
    // landed in merge-summary.md: the cut never splits a surrogate pair. "feat(emoji-cut): " leaves 55 → the fallback cuts at 27,
    // right inside the emoji at 26–27; one at 25–26 stays whole.
    const emoji = String.fromCodePoint(0x1f600);
    const lone = (s) => { for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (c >= 0xd800 && c <= 0xdbff) { const d = s.charCodeAt(i + 1); if (!(d >= 0xdc00 && d <= 0xdfff)) return true; i++; } else if (c >= 0xdc00 && c <= 0xdfff) return true; } return false; };
    const e1 = title("Emoji cut", "a".repeat(26) + emoji + "b".repeat(60));
    const e2 = title("Emoji two", "a".repeat(25) + emoji + "b".repeat(60));
    ok(!lone(e1) && e1 === "feat(emoji-cut): " + "a".repeat(26) + "…" && !lone(e2) && e2.includes(emoji) && e2.length <= 72,
      "1.21 review A5: the merge title never splits an emoji (a UTF-16 surrogate pair) at its cut — no lone surrogate reaches the title / merge-summary.md; a whole emoji before the cut stays (got " +
      JSON.stringify([e1, e2].map((t) => [t, t.length])) + ")");
  }

  { // 1.21 F3 — spec_create {kind: "bugfix"} prefill (reproduction · rootCause · condition · behaviour) + includeBody; the gates unchanged.
    const bp = path.join(tmp, "proj-121-bugprefill");
    S.initProject(bp, ["core"], "en");
    const rd = (f, x) => fs.readFileSync(path.join(f.dir, x), "utf8");
    const sec = (md, h) => (md.split("\n## " + h + "\n")[1] || "").split("\n## ")[0].trim();
    const ac1 = (md) => (md.match(/^1\. \*\*US-1\.AC-1\*\* — (.*)$/m) || [])[1] || "";
    const kw = { en: ["IF", "THEN THE SYSTEM SHALL", "Reproduction", "Root Cause", "**Expected:**"], pt: ["SE", "ENTÃO O SISTEMA DEVE", "Reprodução", "Causa Raiz", "**Esperado:**"],
      es: ["SI", "ENTONCES EL SISTEMA DEBE", "Reproducción", "Causa Raíz", "**Esperado:**"] };
    const got = {};
    const langOk = ["en", "pt", "es"].every((l) => {
      const [kIf, kThen, hRepro, hRoot, hExp] = kw[l];
      const r = S.createFeature(bp, "Coupon twice " + l, undefined, "The same coupon applies twice.", undefined, l, "bugfix", {
        reproduction: "1. Cart of 100\n2. Apply PROMO10 twice\n3. Total reads 81", rootCause: "applyCoupon() never checks cart.coupons — src/discount.js:12 pushes the code again (log: coupons=[PROMO10,PROMO10]).",
        condition: kIf + " the same coupon code is applied a second time " + kThen.split(" ")[0], behaviour: kThen + " keep the first discount only", includeBody: true });
      const bug = rd(r, "bug.md"), req = rd(r, "requirements.md"), doc = S.specDoctor(bp, r.slug);
      const rc = doc.checks.find((c) => c.id === "root-cause"), rp = doc.checks.find((c) => c.id === "reproduction");
      got[l] = { ac: ac1(req), rc: rc && rc.status, rp: rp && rp.status, prefilled: r.prefilled };
      return r.ok && ac1(req) === kIf + " the same coupon code is applied a second time " + kThen + " keep the first discount only" &&
        sec(bug, hRepro) === "1. Cart of 100\n2. Apply PROMO10 twice\n3. Total reads 81" && /^applyCoupon\(\) never checks/.test(sec(bug, hRoot)) &&
        bug.includes("- " + hExp + " keep the first discount only") && rc.status === "pass" && rp.status === "pass" &&
        JSON.stringify(r.prefilled) === JSON.stringify({ "bug.md": ["reproduction", "rootCause", "behaviour"], "requirements.md": ["condition", "behaviour"] }) &&
        !r.prefillSkipped && r.bodies["bug.md"] === bug && r.bodies["requirements.md"] === req && Object.keys(r.bodies).sort().join() === "bug.md,requirements.md,tasks.md,test-plan.md" &&
        !S.earsValidate(ac1(req) ? "1. **US-1.AC-1** — " + ac1(req) : "").issues.some((i) => i.severity === "error");
    });
    // The gate is unchanged: a slot-only, an empty or a sentinel Root Cause is no root cause; no prefill = the template, byte for byte.
    const slot = S.createFeature(bp, "Slot cause", undefined, "x", undefined, "en", "bugfix", { rootCause: "[the cause, with evidence]" });
    const todo = S.createFeature(bp, "Todo cause", undefined, "x", undefined, "en", "bugfix", { rootCause: "> **TODO** — later" });
    const blank = S.createFeature(bp, "Blank cause", undefined, "x", undefined, "en", "bugfix", { rootCause: "   ", reproduction: "" });
    const rcOf = (f) => S.specDoctor(bp, f.slug).checks.find((c) => c.id === "root-cause").status;
    const apSlot = S.approvePhase(bp, slot.slug, "design", "t");
    const plain = S.createFeature(bp, "Plain bug", undefined, "s", undefined, "en", "bugfix");
    const gateOk = rcOf(slot) === "fail" && rcOf(todo) === "fail" && rcOf(blank) === "fail" && apSlot.ok === false && apSlot.failing.includes("root-cause") &&
      blank.prefilled === undefined && rd(plain, "bug.md") === require(path.join(__dirname, "lib", "i18n.js")).bugReport({ name: "Plain bug", summary: "s" }, "en");
    // Refusals: a prefill on a feature (nothing created), a condition over 500 characters, a non-string.
    const onFeature = S.createFeature(bp, "Not a bug", ["core"], "x", undefined, "en", "feature", { rootCause: "abc" });
    const tooLong = S.createFeature(bp, "Long cond", undefined, "x", undefined, "en", "bugfix", { condition: "x".repeat(501) });
    const notStr = S.createFeature(bp, "Obj cond", undefined, "x", undefined, "en", "bugfix", { behaviour: { a: 1 } });
    const refusals = onFeature.ok === false && /rootCause is a bugfix's input/.test(onFeature.error) && !fs.existsSync(path.join(bp, ".specs", "not-a-bug")) &&
      tooLong.ok === false && /condition must be one line of at most 500 characters/.test(tooLong.error) && !fs.existsSync(path.join(bp, ".specs", "long-cond")) &&
      notStr.ok === false && /behaviour/.test(notStr.error);
    // A project template supplies bug.md: the prefill can't land there — prefillSkipped + a localized note (PT); requirements.md still gets it.
    const bpt = path.join(tmp, "proj-121-bugprefill-tpl");
    S.initProject(bpt, ["core"], "pt");
    fs.mkdirSync(path.join(bpt, ".specs", "templates"), { recursive: true });
    fs.writeFileSync(path.join(bpt, ".specs", "templates", "bug.md"), "# Bug: {{name}}\n\n## Reprodução\n> **TODO** — passos\n\n## Causa Raiz\n> **TODO** — a causa\n");
    const tp = S.createFeature(bpt, "Cupão", undefined, "x", undefined, "pt", "bugfix", { rootCause: "A causa, com evidência: o log mostra o cupão duas vezes.", condition: "o cupão é aplicado duas vezes" });
    const tplOk = tp.ok && JSON.stringify(tp.prefillSkipped) === JSON.stringify({ "bug.md": ["rootCause"] }) && JSON.stringify(tp.prefilled) === JSON.stringify({ "requirements.md": ["condition"] }) &&
      /Não foi pré-preenchido — rootCause \(bug\.md\)/.test(tp.note) && /> \*\*TODO\*\* — a causa/.test(rd(tp, "bug.md")) && /^SE o cupão é aplicado duas vezes ENTÃO O SISTEMA DEVE \[/.test(ac1(rd(tp, "requirements.md")));
    // MCP: the schema carries the four inputs + includeBody; spec_create passes them through.
    const ctool = list.result.tools.find((t) => t.name === "spec_create");
    const viaMcp = payload(await rpc("tools/call", { name: "spec_create", arguments: { projectDir: bp, name: "Mcp bug", kind: "bugfix", lang: "es",
      reproduction: "Paso 1", condition: "SI el cupón se aplica dos veces", behaviour: "aplicar el descuento una sola vez", includeBody: true } }));
    const mcpOk = ["reproduction", "rootCause", "condition", "behaviour"].every((k) => ctool.inputSchema.properties[k] && ctool.inputSchema.properties[k].type === "string") &&
      ctool.inputSchema.properties.includeBody.type === "boolean" && /prefilled/.test(ctool.description) && viaMcp.ok &&
      /^SI el cupón se aplica dos veces ENTONCES EL SISTEMA DEBE aplicar el descuento una sola vez$/.test(ac1(viaMcp.bodies["requirements.md"] || ""));
    ok(langOk && gateOk && refusals && tplOk && mcpOk,
      "1.21 F3: spec_create {kind: 'bugfix'} prefills bug.md (Reproduction, Root Cause, Expected) and US-1.AC-1's IF … THEN (EN/PT/ES keywords; a leading IF / trailing THEN / THE SYSTEM SHALL dropped), returns `prefilled` and — with includeBody — every scaffold's body; a slot-only, sentinel or blank Root Cause still fails root-cause and the design gate; no prefill = the template byte for byte; refused on a feature / over 500 characters / a non-string; a project template's bug.md is left alone (prefillSkipped + a PT note); MCP schema + call (got " +
      JSON.stringify({ got, gate: [rcOf(slot), rcOf(todo), rcOf(blank), apSlot.failing], refusals: [onFeature.error, tooLong.error, notStr.error], tp: [tp.prefilled, tp.prefillSkipped, tp.note], mcp: viaMcp.error || ac1(viaMcp.bodies && viaMcp.bodies["requirements.md"] || "") }).slice(0, 1500) + ")");
  }

  { // 1.22 review — the Phase 4 `tests` sign-off covers the plan it was given: a T-ID planned since (or a plan re-approved since)
    // makes it pending again; an approval recorded before 1.22 (no `testsPlan` stamp) is never flagged. On copies of the demo.
    const js = JSON.stringify;
    const demo = (n) => { const p = path.join(tmp, "proj-122-tests-" + n); fs.cpSync(path.join(root, "examples", "demo-project"), p, { recursive: true }); return p; };
    const planFile = (p) => path.join(p, ".specs", "api-keys", "test-plan.md");
    const addRow = (p, id) => fs.writeFileSync(planFile(p), fs.readFileSync(planFile(p), "utf8").replace(/(\| T-07 [^\n]*\n)/, (m) => m + `| ${id} | unit | example | a key prefix is unique per tenant | US-1.AC-1 | \`tests/unit/create.test.ts\` |\n`));
    const legacy = demo("legacy");
    addRow(legacy, "T-08");
    const reL = S.approvePhase(legacy, "api-keys", "test-plan", "u");
    const naL = S.nextAction(legacy, "api-keys");
    ok(reL.ok && naL.step === "implement" && js(naL.pendingGates) === "[]" && !S.readState(legacy, "api-keys").approvals.tests.testsPlan,
      "1.22 review: a tests approval recorded before 1.22 (no testsPlan stamp) is never flagged — the demo's T-08 + test-plan re-approval keeps next_action on implement (got " + js([naL.step, naL.pendingGates]) + ")");

    const p = demo("stamped");
    const rT = S.approvePhase(p, "api-keys", "tests", "u");
    const stamp = rT.ok ? rT.approvals.tests.testsPlan : null;
    const histStamp = (S.readState(p, "api-keys").approvalHistory || []).slice(-1)[0] || {};
    const naIn = S.nextAction(p, "api-keys");
    addRow(p, "T-08");
    const reP = S.approvePhase(p, "api-keys", "test-plan", "u");
    const na = S.nextAction(p, "api-keys");
    const doc = S.specDoctor(p, "api-keys");
    const gates = doc.checks.find((c) => c.id === "approval-gates") || {};
    const rTasks = S.approvePhase(p, "api-keys", "tasks", "u");
    const stale = /^The Phase 4 sign-off of \d{4}-\d\d-\d\d no longer covers the plan \(planned since: T-08; approval changed since: test-plan\) — the tests phase is to be approved again\. Phase 4, the hard gate/;
    all("1.22 review: a stamped tests approval (testsPlan {tests, plans}, on the approval and its history record) goes stale once the test plan gains T-08 and is re-approved — pendingGates [tests], next_action fix (refusedGate tests-in-code, the reason first), doctor warns, and the tasks can't be approved past it (phase-order) (got " +
      js([stamp, na.step, na.pendingGates, na.recommendation, doc.pendingGates, gates.detail, rTasks.failing]) + ")", [
      () => rT.ok, () => stamp, () => js(stamp.tests) === js(["T-01", "T-02", "T-03", "T-04", "T-05", "T-06", "T-07"]),
      () => typeof stamp.plans["test-plan"] === "string", () => js(histStamp.testsPlan) === js(stamp), () => naIn.step === "implement", () => reP.ok,
      () => na.step === "fix", () => js(na.pendingGates) === '["tests"]', () => na.refusedGate, () => na.refusedGate.phase === "tests",
      () => js(na.refusedGate.failing) === '["tests-in-code"]', () => stale.test(na.recommendation), () => js(doc.pendingGates) === '["tests"]',
      () => doc.verdict === "warn", () => gates.status === "warn", () => /no longer covers the plan \(planned since: T-08/.test(gates.detail),
      () => rTasks.ok === false, () => js(rTasks.failing) === '["phase-order"]',
    ]);
    // The test written → approve; approved again → in force. Then, executing (a task ticked), Phase 4's sign-off wording.
    const tf = path.join(p, "tests", "unit", "create.test.ts");
    fs.writeFileSync(tf, fs.readFileSync(tf, "utf8") + '\ntest("T-08 a key prefix is unique per tenant", () => {});\n');
    const naW = S.nextAction(p, "api-keys");
    const rT2 = S.approvePhase(p, "api-keys", "tests", "u");
    const naA = S.nextAction(p, "api-keys");
    const tick = S.completeTask(p, "api-keys", 2);
    addRow(p, "T-09");
    S.approvePhase(p, "api-keys", "test-plan", "u");
    const naX = S.nextAction(p, "api-keys");
    const ff = S.approvePhase(p, "api-keys", null, "u", { through: "tasks" });
    ok(naW.step === "approve" && /^The Phase 4 sign-off of .* — \/approve api-keys tests\./.test(naW.recommendation) && rT2.ok && js(rT2.approvals.tests.testsPlan.tests.slice(-1)) === '["T-08"]' &&
      naA.step === "implement" && js(naA.pendingGates) === "[]" && tick.ok && naX.step === "fix" && /planned since: T-09/.test(naX.recommendation) &&
      /Phase 4 sign-off: the implementation has already started/.test(naX.recommendation) && ff.ok === false && ff.stoppedAt === "tests" && js(ff.approved) === "[]",
      "1.22 review: once T-08 is in the test code next_action asks to approve tests, the new approval is in force (implement); on an executing feature a stale sign-off is asked for with Phase 4's sign-off wording, and a fast-forward re-runs the tests gate (got " +
      js([naW.step, naW.recommendation, naA.step, naX.step, naX.recommendation, ff.stoppedAt, ff.approved]) + ")");
  }

  { // 1.22 review — a deleted approved artifact is a change since its approval, and Phase 4 stays due once its plan was approved
    // (deleting test-plan.md and its T-IDs dropped the hard gate: the tasks approved at once).
    const js = JSON.stringify;
    const p = path.join(tmp, "proj-122-deleted-plan");
    fs.cpSync(path.join(root, "examples", "demo-project"), p, { recursive: true });
    const dir = path.join(p, ".specs", "api-keys");
    const st = JSON.parse(fs.readFileSync(path.join(dir, ".state.json"), "utf8"));
    delete st.approvals.tests; delete st.approvals.tasks;
    fs.writeFileSync(path.join(dir, ".state.json"), JSON.stringify(st, null, 2));
    fs.rmSync(path.join(dir, "test-plan.md"));
    fs.writeFileSync(path.join(dir, "tasks.md"), fs.readFileSync(path.join(dir, "tasks.md"), "utf8").replace(/^\s*- _Makes green: [^\n]*\n/gm, "").replace(/T-0\d, /g, "").replace(/T-07 /, ""));
    const r = S.approvePhase(p, "api-keys", "tasks", "u");
    const na = S.nextAction(p, "api-keys");
    const doc = S.specDoctor(p, "api-keys");
    const chg = doc.checks.find((c) => c.id === "changed-since-approval") || {};
    const fin = S.finishFeature(p, "api-keys");
    const rv = S.approvePhase(p, "api-keys", "test-plan", "u", { revoke: true, reason: "the plan is gone for good" });
    const r2 = S.approvePhase(p, "api-keys", "tasks", "u");
    all("1.22 review: deleting an approved test-plan.md is a change since its approval (next_action re-review: restore it or revoke — no spec_impact on a missing file; doctor and finish name it) and Phase 4 stays due (tasks refused on phase-order); revoking the plan's approval is the way out (got " +
      js([r.failing, na.step, na.changedSinceApproval, na.recommendation, doc.pendingGates, chg.detail, rv.ok, r2.ok]) + ")", [
      () => r.ok === false, () => js(r.failing) === '["phase-order"]', () => /earlier phases are not approved yet: tests/.test(r.error),
      () => na.step === "re-review", () => js(na.changedSinceApproval) === '["test-plan.md"]', () => js(na.missingApproved) === '["test-plan.md"]',
      () => !na.impact,
      () => /^test-plan\.md was approved but no longer exists — restore it .* \/approve api-keys test-plan --revoke\./.test(na.recommendation),
      () => !/^Re-review/.test(na.recommendation), () => chg.status === "warn", () => /test-plan\.md/.test(chg.detail),
      () => js(doc.pendingGates) === '["tests","tasks"]', () => fin.blockers.some((b) => /changed after their approval .*test-plan\.md/.test(b)),
      () => rv.ok, () => r2.ok, () => r2.approved === "tasks",
    ]);
    // The engine's rule: a deleted approved artifact counts (a plain feature's requirements.md, a bugfix's bug.md) — a bugfix's
    // deleted design.md does not (it only held a track's sections).
    const E = require(path.join(__dirname, "lib", "engine", "index.js"));
    const bd = path.join(tmp, "proj-122-deleted-unit");
    fs.mkdirSync(bd, { recursive: true });
    fs.writeFileSync(path.join(bd, "bug.md"), "# Bug\n");
    fs.writeFileSync(path.join(bd, "design.md"), "# Design\n");
    fs.writeFileSync(path.join(bd, "requirements.md"), "# Req\n");
    const fp = (f, ph) => E.textFingerprint(fs.readFileSync(path.join(bd, f), "utf8"), ph);
    const appr = { design: { at: "2026-01-01T00:00:00.000Z", by: "u", fingerprint: fp("bug.md", "design"), file: "bug.md", designFingerprint: fp("design.md", "design") },
      requirements: { at: "2026-01-01T00:00:00.000Z", by: "u", fingerprint: fp("requirements.md", "requirements") } };
    const before = E.changedSinceApproval(bd, appr, ["core", "saas"], "bugfix");
    fs.rmSync(path.join(bd, "design.md"));
    const noDesign = E.changedSinceApproval(bd, appr, ["core", "saas"], "bugfix");
    fs.rmSync(path.join(bd, "bug.md"));
    fs.rmSync(path.join(bd, "requirements.md"));
    const gone = E.changedSinceApproval(bd, appr, ["core", "saas"], "bugfix");
    ok(js(before) === "[]" && js(noDesign) === "[]" && js(gone.slice().sort()) === '["bug.md","requirements.md"]',
      "1.22 review: changedSinceApproval reports a deleted approved bug.md / requirements.md, never a bugfix's deleted design.md (got " + js([before, noDesign, gone]) + ")");
  }

  { // 1.22 review 2 — doctor names the stale Phase 4 sign-off ("the tests phase is to be approved again") only while `tests` IS
    // pending: a stamped tests approval, then test-plan.md deleted and its approval revoked (the way out next_action gives) left
    // the note while `approve tests` answered "Nothing to approve".
    const js = JSON.stringify;
    const p = path.join(tmp, "proj-122r2-stale-tests");
    fs.cpSync(path.join(root, "examples", "demo-project"), p, { recursive: true });
    const rT = S.approvePhase(p, "api-keys", "tests", "u"); // stamped (testsPlan)
    fs.rmSync(path.join(p, ".specs", "api-keys", "test-plan.md"));
    const rv = S.approvePhase(p, "api-keys", "test-plan", "u", { revoke: true, reason: "the plan is gone for good" });
    const doc = S.specDoctor(p, "api-keys");
    const gates = doc.checks.find((c) => c.id === "approval-gates") || {};
    const at = S.approvePhase(p, "api-keys", "tests", "u", { force: true });
    ok(rT.ok && rT.approvals.tests.testsPlan && rv.ok && !doc.pendingGates.includes("tests") && !/approved again|no longer covers the plan/.test(gates.detail || "") &&
      at.ok === false && /^Nothing to approve/.test(at.error || ""),
      "1.22 review 2: with test-plan.md deleted and its approval revoked, `tests` is not pending and doctor's approval-gates no longer says the tests phase is to be approved again (approve tests: nothing to approve) (got " +
      js([rT.ok, rv.ok, doc.pendingGates, gates.detail, at.error]) + ")");
  }
  { // r5 review (gates) — a .state.json that can't be read, an artifact that can't be read, bug.md's open questions, whitespace-only
    // edits of an approved artifact, identical re-approvals.
    const js = JSON.stringify;
    const REQ = ["# Feature: Widget", "", "## Summary", "Users can save widgets.", "", "### US-1 (P1 — MVP): Save widgets",
      "**As a** user, **I want** to save a widget, **so that** I keep it.", "**Independent Test:** save one and reload the page.", "",
      "#### Acceptance Criteria (EARS)", "1. **US-1.AC-1** — WHEN a user saves a widget THE SYSTEM SHALL store it",
      "2. **US-1.AC-2** — IF the widget name is empty THEN THE SYSTEM SHALL reject it with a message", "",
      "## Success Criteria", "- **SC-001** — 95% of saves finish under 200 ms", "", "## Edge Cases & Error Handling", "- **EC-1** — an empty widget is rejected", ""].join("\n");
    const filled = (name) => {
      const p = path.join(tmp, "proj-r5g-" + name);
      S.initProject(p, ["core"], "en");
      const f = S.createFeature(p, "Widget", ["core"]);
      const w = (rel, text) => fs.writeFileSync(path.join(f.dir, rel), text);
      w("classification.md", "# Classification: Widget\n\n## Mode\nSpec\n\n## Active Tracks\ncore\n\n## Signals\n- none beyond core\n\n## Blast Radius\nThe widget page only.\n\n## Compliance Tags\nnone\n");
      w("requirements.md", REQ);
      w("design.md", "# Design: Widget\n\n## Overview\nA store module.\n\n## Architecture\n```mermaid\ngraph TD\n  A[UI] --> B[Store]\n```\n\n## Constitution Check\n- [x] Simplicity — complies\n");
      w("tasks.md", "# Tasks: Widget\n\n## Story US-1 (P1 — MVP)\n- [ ] 1. [US1] Store widgets\n  - _Requirements: US-1.AC-1, SC-001_\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 2. [US1] Reject empty names\n  - _Requirements: US-1.AC-2, EC-1_\n  - _Verify: node -e \"process.exit(0)\"_\n");
      return { p, f, w };
    };

    // M1: an unreadable .state.json (a text merge's conflict markers) — doctor fails `state`, next_action's one step is to repair it
    // (never "approve" — every mutator refuses on that file), finish blocks on it, the status line says so.
    const a = filled("state");
    for (const ph of ["classification", "requirements", "design", "tasks"]) S.approvePhase(a.p, "widget", ph, "u");
    const good = fs.readFileSync(path.join(a.f.dir, ".state.json"), "utf8");
    a.w(".state.json", good.replace('"approvals": {', '"approvals": {\n<<<<<<< HEAD'));
    const docA = S.specDoctor(a.p, "widget"), naA = S.nextAction(a.p, "widget"), finA = S.finishFeature(a.p, "widget", {}), slA = S.statusLine(a.p);
    const apA = S.approvePhase(a.p, "widget", "requirements", "u");
    a.w(".state.json", JSON.stringify({ ...JSON.parse(good), approvals: [] })); // valid JSON, the wrong shape
    const naShape = S.nextAction(a.p, "widget");
    const stateCheck = docA.checks.find((c) => c.id === "state") || {};
    all("r5 review M1: an unreadable / wrong-shaped .state.json → doctor fails `state` (naming the file), next_action's step is `fix` (stateInvalid, repair it — never 'approve' everything again), finish blocks on it first (no 'every phase awaiting approval'), the status line says repair (got " +
      js([docA.verdict, stateCheck, naA.step, naA.recommendation.slice(0, 160), finA.blockers, slA.line, naShape.step]) + ")", [
      () => docA.verdict === "fail", () => stateCheck.status === "fail", () => /widget\/\.state\.json is not valid JSON/.test(stateCheck.detail),
      () => naA.step === "fix", () => naA.stateInvalid === true,
      () => /^widget\/\.state\.json is not valid JSON .* Until it is repaired nothing can be approved, ticked or finished/.test(naA.recommendation),
      () => /merge-state --install/.test(naA.recommendation), () => !naA.fastForward, () => js(naA.pendingGates) === "[]",
      () => finA.readyToFinish === false, () => /not valid JSON/.test(finA.blockers[0]),
      () => !finA.blockers.some((b) => /awaiting approval/.test(b)), () => js(finA.pendingGates) === "[]",
      () => js(slA.next) === '{"step":"fix","file":".state.json"}', () => /next: repair \.state\.json \(it can't be read\)/.test(slA.line),
      () => apA.ok === false, () => naShape.step === "fix", () => /unexpected shape/.test(naShape.recommendation),
    ]);
    // PT / ES wording
    const aPt = filled("state-pt");
    aPt.w(".state.json", "{");
    const naPt = S.nextAction(aPt.p, "widget");
    aPt.w(".state.json", JSON.stringify({ lang: "pt", approvals: "x" }));
    const naPt2 = S.nextAction(aPt.p, "widget");
    aPt.w(".state.json", JSON.stringify({ lang: "es", approvals: "x" }));
    const naEs2 = S.nextAction(aPt.p, "widget");
    ok(naPt.step === "fix" && /Until it is repaired/.test(naPt.recommendation) && /Enquanto não for reparado/.test(naPt2.recommendation) && /Mientras no se repare/.test(naEs2.recommendation),
      "r5 review M1: next_action's repair step is localized (the feature's language — EN, PT, ES) (got " + js([naPt2.recommendation.slice(0, 90), naEs2.recommendation.slice(0, 90)]) + ")");

    // The crash: an artifact that exists but can't be read (a folder named requirements.md) — approve, doctor, next_action, finish and
    // the fast-forward answer (approve: unreadable, localized) instead of a TypeError.
    const c = filled("unreadable");
    S.approvePhase(c.p, "widget", "classification", "u");
    fs.rmSync(path.join(c.f.dir, "requirements.md"));
    fs.mkdirSync(path.join(c.f.dir, "requirements.md"));
    const run = (fn) => { try { return fn(); } catch (e) { return { threw: e.message }; } };
    const cAp = run(() => S.approvePhase(c.p, "widget", "requirements", "u")), cDoc = run(() => S.specDoctor(c.p, "widget"));
    const cNa = run(() => S.nextAction(c.p, "widget")), cFin = run(() => S.finishFeature(c.p, "widget", {}));
    const cFf = run(() => S.approvePhase(c.p, "widget", null, "u", { through: "tasks" }));
    ok(cAp.ok === false && cAp.unreadable === true && cAp.nothingToApprove === true && /^Nothing to approve: requirements\.md in 'widget' can't be read/.test(cAp.error) &&
      cDoc.ok === true && cNa.ok === true && cFin.ok === true && cFin.readyToFinish === false && cFf.ok === false && cFf.stopReason === "nothing-to-approve",
      "r5 review: an artifact that exists but can't be read (a folder named requirements.md) — approve answers a localized 'can't be read' (unreadable), doctor / next_action / finish / the fast-forward answer instead of throwing (got " +
      js([cAp, cDoc.threw, cNa.threw, cFin.threw, cFf.stopReason || cFf.threw]) + ")");
    // the same after its approval: next_action says restore it (missingApproved), never "re-approve"
    const c2 = filled("unreadable-approved");
    for (const ph of ["classification", "requirements"]) S.approvePhase(c2.p, "widget", ph, "u");
    fs.rmSync(path.join(c2.f.dir, "requirements.md"));
    fs.mkdirSync(path.join(c2.f.dir, "requirements.md"));
    const c2Na = run(() => S.nextAction(c2.p, "widget"));
    ok(c2Na.step === "re-review" && js(c2Na.missingApproved) === '["requirements.md"]' && /was approved but no longer exists — restore it/.test(c2Na.recommendation),
      "r5 review: an approved artifact that can't be read any more → next_action's re-review names it in missingApproved (restore it or revoke) (got " + js([c2Na.step, c2Na.missingApproved, c2Na.threw]) + ")");

    // M11: a bugfix's bug.md is its design — an open [NEEDS CLARIFICATION] in its Root Cause (or Reproduction) refuses the approval;
    // doctor's clarifications check and spec_clarify see it too.
    const bp = path.join(tmp, "proj-r5g-bug");
    S.initProject(bp, ["core"], "en");
    const bf = S.createFeature(bp, "Login fails", ["core"], undefined, undefined, "en", "bugfix");
    const bw = (rel, re, by) => fs.writeFileSync(path.join(bf.dir, rel), fs.readFileSync(path.join(bf.dir, rel), "utf8").replace(re, by));
    fs.writeFileSync(path.join(bf.dir, "requirements.md"), "# Bugfix: Login fails\n\n## Summary\nLogin fails.\n\n### US-1 (P1 — fix): Login fails\n**Independent Test:** T-01.\n\n#### Acceptance Criteria (EARS)\n" +
      "1. **US-1.AC-1** — IF the e-mail holds an accented letter THEN THE SYSTEM SHALL log the user in\n2. **US-1.AC-2** — THE SYSTEM SHALL keep plain e-mails logging in unchanged\n\n## Success Criteria\n- **SC-001** — the bug no longer reproduces.\n");
    bw("bug.md", /## Summary\n\[[^\]]*\]/, "## Summary\nLogin fails for accented e-mails.");
    bw("bug.md", /## Reproduction\n> \*\*TODO\*\*[^\n]*/, "## Reproduction\nLog in as josé@example.com: 401 [NEEDS CLARIFICATION: which browser?]");
    bw("bug.md", /- \*\*Expected:\*\* \[[^\]]*\]/, "- **Expected:** logged in");
    bw("bug.md", /- \*\*Actual:\*\* \[[^\]]*\]/, "- **Actual:** 401");
    bw("bug.md", /## Fix\n\[[^\]]*\]/, "## Fix\nNormalize with NFC.");
    const bReq1 = S.approvePhase(bp, "login-fails", "requirements", "u");
    bw("bug.md", " [NEEDS CLARIFICATION: which browser?]", "");
    const bReq2 = S.approvePhase(bp, "login-fails", "requirements", "u");
    bw("bug.md", /## Root Cause\n> \*\*TODO\*\*[^\n]*/, "## Root Cause\nProbably the stored NFD form [NEEDS CLARIFICATION: confirm it in the DB]");
    const bDes1 = S.approvePhase(bp, "login-fails", "design", "u");
    const bDoc = S.specDoctor(bp, "login-fails");
    const bCl = S.clarify(bp, "login-fails");
    bw("bug.md", "Probably the stored NFD form [NEEDS CLARIFICATION: confirm it in the DB]", "The DB stores NFD (users.email, checked in psql); the lookup compares NFC.");
    const bDes2 = S.approvePhase(bp, "login-fails", "design", "u");
    const bClar = bDoc.checks.find((x) => x.id === "clarifications") || {};
    ok(bReq1.ok === false && bReq1.failing.includes("clarifications") && bReq2.ok && bDes1.ok === false && js(bDes1.failing) === '["clarifications"]' &&
      /1 unresolved \[NEEDS CLARIFICATION\] in bug\.md/.test(bDes1.checks[0].detail) && bClar.status === "fail" && /in bug\.md/.test(bClar.detail) &&
      bCl.questions.some((q) => /confirm it in the DB/.test(q)) && bDes2.ok,
      "r5 review M11: a bugfix's [NEEDS CLARIFICATION] in bug.md → Reproduction refuses the requirements gate, in its Root Cause the design gate (bug.md is its design); doctor's clarifications check fails and spec_clarify asks it (got " +
      js([bReq1.failing, bDes1.failing, bClar, bCl.questions]) + ")");

    // Improvement a: a whitespace-only edit of an approved artifact (trailing spaces, blank lines at the end) is no change since its
    // approval — judged against the approval's own snapshot; an approval without one (pre-1.13) keeps the fingerprint alone.
    const d = filled("ws");
    for (const ph of ["classification", "requirements"]) S.approvePhase(d.p, "widget", ph, "u");
    d.w("requirements.md", REQ.replace("store it\n", "store it   \t\n").replace(/\n$/, "\n\n\n"));
    const dNa = S.nextAction(d.p, "widget"), dIm = S.impactReport(d.p, "widget", { phase: "requirements" }), dDoc = S.specDoctor(d.p, "widget");
    d.w("requirements.md", REQ.replace(/\n/g, "\r\n").replace(/\r\n$/, "")); // CRLF and no final newline
    const dNa2 = S.nextAction(d.p, "widget");
    d.w("requirements.md", REQ.replace("store it", "store it durably"));
    const dNa3 = S.nextAction(d.p, "widget");
    // no snapshot: the approval's wsFingerprint decides (1.24 review 6, E-I5); an approval without one either (before 1.24): the
    // fingerprint alone decides
    const dSt = JSON.parse(fs.readFileSync(path.join(d.f.dir, ".state.json"), "utf8"));
    dSt.approvalHistory.forEach((h) => { delete h.snapshot; });
    d.w(".state.json", JSON.stringify(dSt, null, 2));
    d.w("requirements.md", REQ + "\n");
    const dNa4 = S.nextAction(d.p, "widget");
    for (const a of [...Object.values(dSt.approvals), ...dSt.approvalHistory]) delete a.wsFingerprint;
    d.w(".state.json", JSON.stringify(dSt, null, 2));
    const dNa5 = S.nextAction(d.p, "widget");
    ok(js(dNa.changedSinceApproval) === "[]" && dNa.step !== "re-review" && dIm.changed === false && !dDoc.checks.some((x) => x.id === "changed-since-approval") &&
      js(dNa2.changedSinceApproval) === "[]" && js(dNa3.changedSinceApproval) === '["requirements.md"]' && js(dNa4.changedSinceApproval) === "[]" && js(dNa5.changedSinceApproval) === '["requirements.md"]',
      "r5 review: a whitespace-only edit of an approved artifact (trailing spaces / tabs, blank lines at the end, a final newline dropped) is no change since its approval — next_action, doctor, spec_impact agree; a real edit still is; without the approval's snapshot its wsFingerprint decides (1.24), without either the fingerprint alone (got " +
      js([dNa.changedSinceApproval, dIm.changed, dNa2.changedSinceApproval, dNa3.changedSinceApproval, dNa4.changedSinceApproval, dNa5.changedSinceApproval]) + ")");

    // Improvement b: an identical re-approval shares the previous snapshot (no second copy) and is no rework in spec_metrics; new
    // content gets the next snapshot number.
    const e = filled("reuse");
    for (const ph of ["classification", "requirements"]) S.approvePhase(e.p, "widget", ph, "u");
    const eRe = [1, 2, 3].map(() => S.approvePhase(e.p, "widget", "requirements", "u"));
    const eSnaps = () => fs.readdirSync(path.join(e.f.dir, ".history")).filter((x) => x.startsWith("requirements")).sort();
    const eM1 = S.metrics(e.p, "widget");
    const eSnaps1 = eSnaps();
    e.w("requirements.md", REQ.replace("store it", "store it durably"));
    const eNew = S.approvePhase(e.p, "widget", "requirements", "u");
    const eM2 = S.metrics(e.p, "widget");
    ok(eRe.every((r) => r.ok && r.snapshot === ".history/requirements@1.md") && js(eSnaps1) === '["requirements@1.md"]' && eM1.rework === 0 && eM1.approvalsTotal === 5 &&
      eNew.snapshot === ".history/requirements@2.md" && js(eSnaps()) === '["requirements@1.md","requirements@2.md"]' && eM2.rework === 1 && eM2.reworkByPhase.requirements === 1,
      "r5 review: an identical re-approval shares the previous snapshot (.history/requirements@1.md, no copy) and is no rework in spec_metrics (still an approval in approvalsTotal); new content → requirements@2.md, rework 1 (got " +
      js([eRe.map((r) => r.snapshot), eSnaps1, eM1.rework, eM1.approvalsTotal, eNew.snapshot, eM2.rework]) + ")");
  }
};
