"use strict";
// Change requests (impact / --reopen) and metrics (+ retro.md) on the CLI, EN and PT.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, tmp, CLI, require, __dirname }) => {
  const S8 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const w8 = path.join(tmp, "wp8-proj");
  run(["init", "tdd", "--project", w8]);
  run(["create", "Drafts", "tdd", "--project", w8]);
  const d8 = (x) => path.join(w8, ".specs", "drafts", x);
  const req8 = ["# Feature: Drafts", "", "## Summary", "Save drafts.", "", "### US-1 (P1 — MVP): Save drafts", "", "#### Acceptance Criteria (EARS)",
    "1. **US-1.AC-1** — WHEN a user saves THE SYSTEM SHALL store the draft", "2. **US-1.AC-2** — WHEN the parser meets a BOM THE SYSTEM SHALL skip it", ""].join("\r\n");
  fs.writeFileSync(d8("requirements.md"), req8);
  fs.writeFileSync(d8("design.md"), "# Design: Drafts\n\n## Parser\nSkips a BOM (US-1.AC-2).\n");
  fs.writeFileSync(d8("test-plan.md"), "| Test ID | Covers |\n|---|---|\n| T-01 | US-1.AC-1 |\n| T-02 | US-1.AC-2 |\n");
  fs.writeFileSync(d8("tasks.md"), "# Tasks\r\n\r\n## Story US-1\r\n- [x] 1. [US1] Store drafts\r\n  - _Requirements: US-1.AC-1_\r\n- [x] 2. [US1] Skip the BOM\r\n  - _Requirements: US-1.AC-2_\r\n");
  run(["approve", "drafts", "classification", "--force", "--project", w8]); // next_action re-reviews only what can be re-approved now
  const ap8 = run(["approve", "drafts", "requirements", "--force", "--project", w8]);
  fs.writeFileSync(d8("requirements.md"), req8.replace("SHALL skip it", "SHALL strip it"));
  const im8 = run(["impact", "drafts", "--project", w8]);
  let im8j = null;
  try { im8j = JSON.parse(run(["impact", "drafts", "--json", "--project", w8]).out); } catch { /* invalid JSON */ }
  ok(ap8.code === 0 && im8.code === 0 && /Impact: drafts · requirements — against the approval of \d{4}-\d\d-\d\d \(\.history\/requirements@1\.md\)/.test(im8.out) &&
    im8.out.includes("~ US-1.AC-2  WHEN the parser meets a BOM THE SYSTEM SHALL strip it") && im8.out.includes("US-1.AC-2 (modified) — tasks: #2 [x] nothing to verify (no _Verify:_ command, nothing recorded) · tests: T-02 · design: Parser") &&
    /--reopen/.test(im8.out) && im8j && JSON.stringify(im8j) === JSON.stringify(S8.impactReport(w8, "drafts", {})),
    "impact prints the diff against the approved snapshot and what it reaches; --json = spec_impact (same engine call)");
  ok(/First see what the edit touches with spec_impact \(dev-spec impact drafts --phase requirements\)/.test(run(["next-action", "drafts", "--project", w8]).out) &&
    /▲ changed-since-approval — changed after their approval: requirements\.md/.test(run(["doctor", "drafts", "--project", w8]).out),
    "next-action recommends impact before re-approval; doctor shows the changed-since-approval warn");
  ok(/changed-since-approval — .*\(dev-spec impact drafts --phase requirements\)/.test(run(["doctor", "drafts", "--project", w8]).out),
    "doctor's changed-since-approval hint names the phase to pass to impact");
  const ro8 = run(["impact", "drafts", "--reopen", "--project", w8]);
  const ro8b = run(["impact", "drafts", "--reopen", "--project", w8]);
  ok(ro8.code === 0 && /Reopened #2: unticked, their evidence marked stale/.test(ro8.out) && fs.readFileSync(d8("tasks.md"), "utf8").includes("- [x] 1. [US1] Store drafts\r\n") &&
    fs.readFileSync(d8("tasks.md"), "utf8").includes("- [ ] 2. [US1] Skip the BOM\r\n") && ro8b.code === 0 && /Nothing new since the last reopen/.test(ro8b.out),
    "impact --reopen unticks the affected done task (CRLF kept); a second --reopen changes nothing");
  const bad8 = [["impact", "drafts", "--phase", "design"], ["impact", "drafts", "--phase", "plan"], ["impact", "drafts", "--phase"], ["impact", "drafts", "--phase", "tasks", "--reopen"], ["impact"]]
    .map((a) => run(a.concat(["--project", w8])));
  ok(bad8.every((r) => r.code === 1) && /'design' was never approved for 'drafts'/.test(bad8[0].out) && /Unknown phase 'plan'/.test(bad8[1].out) && /missing value for --phase/.test(bad8[2].out) &&
    /reopen applies to requirements, design, test-plan and eval-plan/.test(bad8[3].out) && /usage: dev-spec impact/.test(bad8[4].out), "impact: never approved / unknown phase / missing --phase value / reopen on tasks / no feature → exit 1 with a clear message");
  // --phase test-plan: the T-ID row diff, and next-action names that phase for a changed test-plan.md (the earlier gates —
  // requirements re-approved after the change, design — are approved, so the test plan is what can be re-approved now).
  run(["approve", "drafts", "requirements", "--force", "--project", w8]);
  run(["approve", "drafts", "design", "--force", "--project", w8]);
  run(["approve", "drafts", "test-plan", "--force", "--project", w8]);
  fs.writeFileSync(d8("test-plan.md"), "| Test ID | Covers |\n|---|---|\n| T-01 | US-1.AC-1 |\n| T-02 | US-1.AC-2, SC-001 |\n| T-03 | US-1.AC-1 |\n");
  const tp8 = run(["impact", "drafts", "--phase", "test-plan", "--project", w8]);
  let tp8j = null;
  try { tp8j = JSON.parse(run(["impact", "drafts", "--phase", "test-plan", "--json", "--project", w8]).out); } catch { /* invalid JSON */ }
  ok(tp8.code === 0 && /Impact: drafts · test-plan — against the approval of/.test(tp8.out) && /\+ T-03 {2}US-1\.AC-1/.test(tp8.out) && /~ T-02 {2}US-1\.AC-2, SC-001/.test(tp8.out) &&
    /T-02 \(modified\) — tasks: none/.test(tp8.out) && tp8j && JSON.stringify(tp8j) === JSON.stringify(S8.impactReport(w8, "drafts", { phase: "test-plan" })) &&
    /dev-spec impact drafts --phase test-plan/.test(run(["next-action", "drafts", "--project", w8]).out),
    "impact --phase test-plan prints the T-ID row diff (--json = spec_impact); next-action names --phase test-plan for a changed test-plan.md");
  const m8 = run(["metrics", "drafts", "--project", w8]);
  let m8j = null;
  try { m8j = JSON.parse(run(["metrics", "drafts", "--json", "--project", w8]).out); } catch { /* invalid JSON */ }
  ok(m8.code === 0 && /^Metrics: drafts \[core \+tdd\] — created \d{4}-\d\d-\d\d\n/.test(m8.out) && /lead time from creation: classification \S+ · requirements /.test(m8.out) && /change requests: 1 · reopened tasks: 1/.test(m8.out) &&
    m8j && m8j.scope === "feature" && m8j.changeRequests === 1 && m8j.createdAtApproximate === false, "metrics <feature>: lead times, change requests, reopened tasks (--json = spec_metrics)");
  const mw8 = run(["metrics", "drafts", "--write", "--project", w8]);
  const retro8 = fs.readFileSync(d8("retro.md"), "utf8");
  const mw8b = run(["metrics", "drafts", "--write", "--project", w8]);
  const mp8 = run(["metrics", "--project", w8]);
  const mpw8 = run(["metrics", "--write", "--project", w8]);
  ok(mw8.code === 0 && /Retrospective → \.specs\/drafts\/retro\.md/.test(mw8.out) && retro8.startsWith("# Retrospective: drafts") && retro8.includes("## Follow-ups") &&
    mw8b.code === 0 && /already exists — left untouched/.test(mw8b.out) && fs.readFileSync(d8("retro.md"), "utf8") === retro8 &&
    mp8.code === 0 && /^Metrics — 1 feature\(s\)/.test(mp8.out) && /\n {2}average /.test(mp8.out) && /\n {2}median /.test(mp8.out) && mpw8.code === 1 && /write needs a feature name/.test(mpw8.out),
    "metrics --write creates retro.md once (then says it exists); metrics (project) prints rows + average/median; metrics --write without a feature exits 1");
  // PT project: the same commands in European Portuguese.
  const p8 = path.join(tmp, "wp8-pt");
  run(["init", "core", "--lang", "pt", "--project", p8]);
  run(["create", "Rascunhos", "core", "--project", p8]);
  const pd8 = (x) => path.join(p8, ".specs", "rascunhos", x);
  const preq8 = "# Funcionalidade: Rascunhos\n\n## Resumo\nGuardar.\n\n### US-1 (P1 — MVP): Guardar\n\n#### Critérios de Aceitação (EARS)\n1. **US-1.AC-1** — QUANDO o utilizador guarda O SISTEMA DEVE guardar o rascunho\n";
  fs.writeFileSync(pd8("requirements.md"), preq8);
  fs.writeFileSync(pd8("design.md"), "# Design\n\n## Modelo\nPor id (US-1.AC-1).\n");
  fs.writeFileSync(pd8("tasks.md"), "# Tarefas\n\n## US-1\n- [x] 1. [US1] Guardar\n  - _Requirements: US-1.AC-1_\n");
  run(["approve", "rascunhos", "classification", "--force", "--project", p8]);
  run(["approve", "rascunhos", "requirements", "--force", "--project", p8]);
  fs.writeFileSync(pd8("requirements.md"), preq8.replace("o rascunho", "o rascunho cifrado"));
  const pim8 = run(["impact", "rascunhos", "--project", p8]);
  const pmw8 = run(["metrics", "rascunhos", "--write", "--project", p8]);
  ok(/Impacto: rascunhos · requirements — face à aprovação de/.test(pim8.out) && /Afetado:/.test(pim8.out) && /tarefas: #1 \[x\] nada a verificar \(sem comando _Verify:_, nada registado\)/.test(pim8.out) &&
    /Vê primeiro o que a edição afeta com spec_impact/.test(run(["na", "rascunhos", "--project", p8]).out) && /^Métricas: rascunhos \[core\] — criada a /.test(pmw8.out) &&
    /Retrospetiva → \.specs\/rascunhos\/retro\.md/.test(pmw8.out) && fs.readFileSync(pd8("retro.md"), "utf8").startsWith("# Retrospetiva: rascunhos") &&
    /nunca foi aprovada/.test(run(["impact", "rascunhos", "--phase", "design", "--project", p8]).out), "impact / next-action / metrics --write / errors (PT) are in European Portuguese");
  run(["create", "Nova", "core", "--project", p8]);
  const pn8 = run(["metrics", "nova", "--project", p8]);
  ok(pn8.code === 0 && pn8.out.includes("  aprovações: 0 · retrabalho: 0 · forçadas: 0") && !/desconhecido/.test(pn8.out),
    "metrics on a feature never approved: rework 0, not unknown (PT)");
  // impact --reopen with nothing changed says so (no reopen preceded it); a bugfix's design.md edit is diffed by --phase design.
  run(["create", "Plain", "core", "--project", w8]);
  run(["approve", "plain", "requirements", "--force", "--project", w8]);
  const pr8 = run(["impact", "plain", "--reopen", "--project", w8]);
  ok(pr8.code === 0 && pr8.out.includes("no changes since the approval") && pr8.out.includes("Nothing changed since the approval — nothing to reopen.") && !/Nothing new since the last reopen/.test(pr8.out),
    "impact --reopen right after the approval: 'nothing changed — nothing to reopen', never 'nothing new since the last reopen'");
  run(["bugfix", "Slow page", "saas", "--project", w8]);
  const sa8 = run(["approve", "slow-page", "design", "--force", "--project", w8]);
  const sd8 = path.join(w8, ".specs", "slow-page", "design.md");
  fs.writeFileSync(sd8, fs.readFileSync(sd8, "utf8").replace(/(## \[SaaS\] Performance Budget[^\n]*\n)/, "$1p95 under 200 ms\n"));
  const bi8 = run(["impact", "slow-page", "--phase", "design", "--project", w8]);
  ok(sa8.code === 0 && bi8.code === 0 && bi8.out.includes("  ~ design.md: [SaaS] Performance Budget") && bi8.out.includes(".history/design@1.design.md") && !bi8.out.includes("no changes since the approval"),
    "impact --phase design on a bugfix +saas lists the edited design.md section (its design approval snapshots design.md too)");
  const help8 = run(["help"]).out;
  const doc8 = fs.readFileSync(CLI, "utf8").split("*/")[0];
  const after8 = (t) => { const a = t.indexOf("approve <feature> <phase>"), i = t.indexOf("impact <feature>"), m = t.indexOf("metrics [feature]"); return a !== -1 && i > a && m > i && m < t.indexOf("add-track <feature>"); };
  ok(after8(help8) && after8(doc8) && ["--phase", "--reopen", "--write"].every((x) => help8.includes(x) && doc8.includes(x)),
    "help and the header docblock list impact + metrics right after approve, with --phase / --reopen / --write");
  // --reopen never unticks a REMOVED criterion's tasks (retire lists them) — help said it unticks "the affected done tasks", full stop.
  const reopenDoc8 = (t) => { const i = t.indexOf("impact <feature>"); return t.slice(i, t.indexOf("metrics [feature]", i)).replace(/\s+/g, " "); };
  ok([help8, doc8].every((t) => /--reopen unticks the affected done tasks.*never a removed criterion's.*retire`? lists/.test(reopenDoc8(t))),
    "help and the header docblock: --reopen never unticks a removed criterion's tasks — retire lists them");
};
