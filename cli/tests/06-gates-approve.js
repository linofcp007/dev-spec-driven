"use strict";
// Gates on the CLI — approve (refused / --force / nothing to approve), next-action order, the bugfix gate, planned files.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, runIn, tmp }) => {
  const w5 = path.join(tmp, "wp5-proj");
  runIn(["init", "core", "--project", w5]);
  runIn(["create", "Gate", "core", "--project", w5]);
  const stateOf = (f) => JSON.parse(fs.readFileSync(path.join(w5, ".specs", f, ".state.json"), "utf8"));
  const naFresh = runIn(["next-action", "gate", "--project", w5]).out;
  const refused = runIn(["approve", "gate", "requirements", "--project", w5]);
  ok(refused.code === 1 && /Can't approve 'requirements' for 'gate' — failing checks: phase-order, placeholders, success-criteria, priorities/.test(refused.out) &&
    /✗ phase-order — earlier phases are not approved yet: classification — approve them first, in order \(\/approve gate classification\)/.test(refused.out) &&
    /✗ placeholders — requirements\.md \(\d+\): requirements\.md:4 /.test(refused.out) && /--force/.test(refused.out) && !stateOf("gate").approvals.requirements,
    "approve on a template exits 1 listing the failing checks — the unapproved classification before it (phase-order) too (nothing recorded)");
  runIn(["approve", "gate", "classification", "--force", "--project", w5]);
  const naReq = runIn(["next-action", "gate", "--project", w5]).out;
  ok(/→ Fill classification\.md — \d+ template placeholder\(s\) left .*\(\/spec gate\)/.test(naFresh) && /→ Fill requirements\.md — \d+ template placeholder\(s\) left .*\/clarify gate/.test(naReq),
    "next-action phase by phase: a fresh feature fills classification.md first (/spec — /classify until 1.26), then — once approved — requirements.md (/clarify)");
  const forced = runIn(["approve", "gate", "requirements", "--force", "--project", w5]);
  let forcedJ = null;
  try { forcedJ = JSON.parse(runIn(["approve", "gate", "design", "--force", "--json", "--project", w5]).out); } catch { /* invalid JSON */ }
  ok(forced.code === 0 && /Approved 'requirements' for gate ✓/.test(forced.out) && /⚠ Approved with force — the failing checks are recorded with the approval: placeholders, success-criteria, priorities\./.test(forced.out) &&
    stateOf("gate").approvals.requirements.forced === true && forcedJ && forcedJ.forced === true && forcedJ.failing.includes("placeholders"),
    "approve --force records a flagged approval (⚠ note; --json forced + failing)");
  const nothing = runIn(["approve", "gate", "eval-plan", "--force", "--project", w5]);
  ok(nothing.code === 1 && /Nothing to approve: 'eval-plan'/.test(nothing.out), "approve of a phase with no artifact exits 1 even with --force");
  const docG = runIn(["doctor", "gate", "--project", w5]);
  ok(/✗ placeholders — template placeholders left/.test(docG.out) && /▲ approval-gates — .*approved with force over failing checks: classification \(placeholders\), requirements \(placeholders/.test(docG.out),
    "doctor lists the placeholders failure and the forced approvals (warn)");
  ok(/→ Fill tasks\.md — \d+ template placeholder\(s\) left .*\/spec gate tasks/.test(runIn(["next-action", "gate", "--project", w5]).out),
    "next-action after the design approval: the tasks are the next phase (fill tasks.md)");
  ok(/approve <feature> <phase> \[--force\]/.test(runIn(["help"]).out) && /--by NAME \/ --force \(approve\)/.test(runIn(["help"]).out), "help documents approve --force");

  // PT: refusal, forced note and next-action are localized
  const p5 = path.join(tmp, "wp5-pt");
  runIn(["init", "core", "--lang", "pt", "--project", p5]);
  runIn(["create", "Pagamentos", "core", "--project", p5]);
  const ptRef = runIn(["approve", "pagamentos", "requirements", "--project", p5]);
  const ptForce = runIn(["approve", "pagamentos", "requirements", "--force", "--project", p5]);
  ok(ptRef.code === 1 && /Não é possível aprovar 'requirements' de 'pagamentos' — verificações a falhar: phase-order, placeholders/.test(ptRef.out) &&
    /há fases anteriores ainda por aprovar: classification/.test(ptRef.out) &&
    ptForce.code === 0 && /Fase 'requirements' de pagamentos aprovada ✓/.test(ptForce.out) && /⚠ Aprovado com force — as verificações a falhar ficam registadas/.test(ptForce.out) &&
    /→ Preenche classification\.md — \d+ placeholder\(s\) do template por preencher/.test(runIn(["next-action", "pagamentos", "--project", p5]).out),
    "approve refusal (phase-order included) / --force note / next-action speak the feature language (PT)");

  // bugfix: no fix before the root cause is written; an OPEN task's planned file is no trace gap. The scaffold's two tasks:
  // 1 the red regression test, 2 the fix — with Root Cause empty only task 1 can be completed.
  runIn(["bugfix", "Crash", "--summary", "crash on save", "--project", w5]);
  const bugDone = runIn(["done", "crash", "2", "--project", w5]);
  ok(bugDone.code === 1 && /Task 2 can't be completed yet: bug\.md → Root Cause is not filled/.test(bugDone.out) &&
    /- \[ \] 2\./.test(fs.readFileSync(path.join(w5, ".specs", "crash", "tasks.md"), "utf8")), "done on the bugfix's fix task exits 1 while bug.md → Root Cause is empty (only task 1 can be completed)");
  // done --run checks the same gate BEFORE running the task's _Verify:_ command (it used to run it, then refuse)
  const crashTasks = path.join(w5, ".specs", "crash", "tasks.md");
  fs.writeFileSync(crashTasks, fs.readFileSync(crashTasks, "utf8").replace("_Verify: [full test suite command]_", "_Verify: node -e \"require('fs').writeFileSync('ran-wp5.txt','x')\"_"));
  const bugRun = run(["done", "crash", "2", "--run", "--project", w5]);
  ok(/_Verify: node -e/.test(fs.readFileSync(crashTasks, "utf8")) && bugRun.code === 1 && /Task 2 can't be completed yet: bug\.md → Root Cause is not filled/.test(bugRun.out) &&
    !/\$ node/.test(bugRun.out) && !fs.existsSync(path.join(w5, "ran-wp5.txt")), "done --run on a gated bugfix task exits 1 WITHOUT running its _Verify:_ command");
  runIn(["create", "Plan", "core", "--project", w5]);
  fs.writeFileSync(path.join(w5, ".specs", "plan", "requirements.md"), "## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n");
  fs.writeFileSync(path.join(w5, ".specs", "plan", "tasks.md"), "- [ ] 1. a\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/not-yet.js_\n");
  const trP = runIn(["trace", "plan", "--project", w5]);
  ok(trP.code === 0 && /verdict=pass/.test(trP.out) && !/src\/not-yet\.js/.test(trP.out), "trace: an open task's not-yet-written _Implements:_ file is no gap (exit 0)");
  // A core-only feature: the Signals line is the tool's answer ("- none beyond core"), so filling Blast Radius and
  // Compliance is enough — approve classification exits 0 (1.13 used to refuse it on its own "[none beyond core]").
  runIn(["create", "Stock alerts", "--summary", "Alert when stock is low", "--project", w5]);
  const clsFile = path.join(w5, ".specs", "stock-alerts", "classification.md");
  fs.writeFileSync(clsFile, fs.readFileSync(clsFile, "utf8").replace(/^\[What breaks[^\n]*\]$/m, "A missed alert delays a restock by a day; recoverable.").replace(/^\[GDPR \| PCI[^\n]*\]$/m, "none"));
  const clsAp = runIn(["approve", "stock-alerts", "classification", "--project", w5]);
  ok(/^- none beyond core$/m.test(fs.readFileSync(clsFile, "utf8")) && clsAp.code === 0 && /Approved 'classification' for stock-alerts ✓/.test(clsAp.out),
    "approve classification of a core-only feature with its real slots filled exits 0 ('- none beyond core' is no placeholder)");
  // The gates next-action / doctor / finish follow: a bugfix's design gate is due on bug.md; +tdd adds Phase 4 (`tests`).
  runIn(["create", "Tdd gate", "tdd", "--project", w5]);
  let docCrash = null, docTdd = null;
  try { docCrash = JSON.parse(runIn(["doctor", "crash", "--json", "--project", w5]).out); docTdd = JSON.parse(runIn(["doctor", "tdd-gate", "--json", "--project", w5]).out); } catch { /* invalid JSON */ }
  ok(docCrash && docCrash.pendingGates.join() === "requirements,design,test-plan,tasks" && docTdd && docTdd.pendingGates.join() === "classification,requirements,design,test-plan,tests,tasks",
    "doctor --json: a bugfix's design gate (bug.md) and a +tdd feature's Phase 4 gate (tests) are pending like the MCP (got " + (docCrash ? docCrash.pendingGates.join() : "?") + " / " + (docTdd ? docTdd.pendingGates.join() : "?") + ")");
};
