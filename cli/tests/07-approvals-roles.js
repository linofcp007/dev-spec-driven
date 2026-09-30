"use strict";
// Approvals by role (init --roles, approve --role) and the fast-forward (approve --through), EN / PT.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, tmp, CLI, require, __dirname }) => {
  const Sb3 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const jsonB3 = (r) => { try { return JSON.parse(r.out); } catch { return null; } };
  const REQb3 = "# Feature: x\n\n## Summary\nExport invoices as CSV.\n\n### US-1 (P1 — MVP): Export\n#### Acceptance Criteria (EARS)\n" +
    "1. **US-1.AC-1** — WHEN an admin clicks Export THE SYSTEM SHALL download a CSV.\n2. **US-1.AC-2** — WHILE an export runs, WHEN the admin clicks again THE SYSTEM SHALL ignore it.\n" +
    "3. **US-1.AC-3** — IF the export fails THEN THE SYSTEM SHALL show the error code.\n4. **US-1.AC-4** — THE SYSTEM SHALL name files invoices-YYYY-MM.csv.\n\n" +
    "### US-2 (P2): Schedule\n#### Acceptance Criteria (EARS)\n1. **US-2.AC-1** — WHEN a schedule is due THE SYSTEM SHALL email the CSV.\n\n" +
    "## Success Criteria\n- **SC-001** — 95% of exports finish in under 5 s.\n\n## Out of Scope\n- PDF export.\n";
  const DESIGNb3 = "# Design: x\n\n## Overview\nA nightly job and an endpoint.\n\n## Architecture\n```mermaid\ngraph TD\n  A-->B\n```\n\n## Constitution Check\n- [x] Principle 1 — complies\n";
  const TASKSb3 = "# Tasks\n\n- [ ] 1. [US1] Build the CSV writer\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4, US-2.AC-1_\n  - _Verify: [manual: open the CSV in a spreadsheet]_\n";
  const fillB3 = (proj, slug, skip = []) => {
    const dir = path.join(proj, ".specs", slug);
    const w = (rel, text) => fs.writeFileSync(path.join(dir, rel), text);
    w("classification.md", fs.readFileSync(path.join(dir, "classification.md"), "utf8").split("\n").map((l) => (/^- /.test(l) ? l : l.replace(/\[[^\]]*\]/g, "filled"))).join("\n"));
    if (!skip.includes("requirements")) w("requirements.md", REQb3);
    if (!skip.includes("design")) w("design.md", DESIGNb3);
    if (!skip.includes("tasks")) w("tasks.md", TASKSb3);
  };
  const metaB3 = (proj) => (JSON.parse(fs.readFileSync(path.join(proj, ".specs", "roadmap.json"), "utf8")).meta || {});

  // init --roles = spec_init {approvalRoles}: stored, refused when malformed, --roles none clears
  const pr = path.join(tmp, "pb3-roles");
  const init = run(["init", "--roles", "requirements=product,design=tech+security", "--project", pr]);
  const bad = run(["init", "--roles", "tech", "--project", pr]);
  const badPhase = run(["init", "--roles", "plan=tech", "--project", pr]);
  const badJ = jsonB3(run(["init", "--roles", "design=tech lead!", "--json", "--project", pr]));
  ok(init.code === 0 && /Approval roles: requirements=product · design=tech\+security — /.test(init.out) &&
    JSON.stringify(metaB3(pr).approvalRoles) === '{"requirements":["product"],"design":["tech","security"]}' &&
    bad.code === 1 && /approvalRoles must map phases to role lists/.test(bad.out) && badPhase.code === 1 && /unknown phase 'plan'/.test(badPhase.out) &&
    badJ && badJ.ok === false && /invalid role name/.test(badJ.error) && JSON.stringify(metaB3(pr).approvalRoles) === '{"requirements":["product"],"design":["tech","security"]}',
    "init --roles stores roadmap.json meta.approvalRoles and prints the roles; a role before any phase, an unknown phase or a bad role name exits 1 and changes nothing");

  // approve --role: required on a listed phase, a sign-off leaves it pending until every role signed; doctor / next-action / finish name the missing role
  run(["create", "Invoice export", "core", "--project", pr]);
  fillB3(pr, "invoice-export");
  run(["approve", "invoice-export", "classification", "--project", pr]);
  const noRole = run(["approve", "invoice-export", "requirements", "--project", pr]);
  const noRoleJ = jsonB3(run(["approve", "invoice-export", "requirements", "--json", "--project", pr]));
  const prod = run(["approve", "invoice-export", "requirements", "--role", "product", "--project", pr]);
  const tech = run(["approve", "invoice-export", "design", "--role", "tech", "--by", "tom", "--project", pr]);
  ok(noRole.code === 1 && /'requirements' is signed off per role \(product\) — say which role you sign for: \/approve invoice-export requirements --role <role>/.test(noRole.out) &&
    noRoleJ && noRoleJ.ok === false && noRoleJ.roleRequired === true && noRoleJ.roles.join() === "product" &&
    prod.code === 0 && /^Approved 'requirements' for invoice-export ✓\n {2}'requirements' is approved — every role signed off the current content: product\./.test(prod.out) &&
    tech.code === 0 && /^Signed off 'design' for invoice-export as tech ✓\n {2}⚠ 'design' stays pending until every role has signed off its current content — missing role: security\./.test(tech.out),
    "approve --role: a listed phase refuses an approval without a role (exit 1; --json roleRequired); its only role approves it; one of two roles leaves it pending (the missing role named)");
  const doc = run(["doctor", "invoice-export", "--project", pr]);
  const na = run(["next-action", "invoice-export", "--project", pr]);
  const fin = run(["finish", "invoice-export", "--project", pr]);
  ok(/▲ approval-gates — awaiting human approval: design \(missing role: security\), tasks/.test(doc.out) &&
    /→ Review & sign off 'design' — missing role: security \(signed: tech\): \/approve invoice-export design --role security\./.test(na.out) &&
    fin.code === 1 && /phases awaiting approval: design \(missing role: security\), tasks/.test(fin.out),
    "doctor, next-action and finish name the role a pending phase still waits for (the same engine view as MCP)");

  // approve --through (the fast-forward) with a role: security completes design, then tasks (no roles there: the role is recorded)
  const ff = run(["approve", "invoice-export", "--through", "tasks", "--role", "security", "--project", pr]);
  const st = JSON.parse(fs.readFileSync(path.join(pr, ".specs", "invoice-export", ".state.json"), "utf8"));
  ok(ff.code === 0 && /^Fast-forward 'invoice-export': approved design, tasks, in order, each through its own gate/.test(ff.out) && /\n {2}✓ design \[security\]\n {2}✓ tasks \[security\]/.test(ff.out) &&
    Object.keys(st.approvals.design.roles).sort().join() === "security,tech" && st.approvals.design.batch === true && st.approvals.tasks.role === "security",
    "approve --through tasks --role security: the fast-forward signs each phase as that role — design completes (tech + security), tasks is approved; one line per phase");

  // the fast-forward without roles: next-action names it; a refused gate stops it (exit 1) with what was approved before
  const pf = path.join(tmp, "pb3-ff");
  run(["init", "--project", pf]);
  run(["create", "Quick spec", "core", "--project", pf]);
  fillB3(pf, "quick-spec");
  const na2 = run(["next-action", "quick-spec", "--project", pf]);
  const ff2 = run(["approve", "quick-spec", "--through", "tasks", "--project", pf]);
  const met2 = run(["metrics", "quick-spec", "--project", pf]);
  ok(/fast-forward: \/spec-ff quick-spec \(CLI: dev-spec approve quick-spec --through tasks\) approves classification, requirements, design, tasks in order/.test(na2.out) &&
    ff2.code === 0 && /approved classification, requirements, design, tasks/.test(ff2.out) && /batch approvals \(fast-forward\): 4/.test(met2.out) &&
    /→ Implement task #1/.test(run(["next-action", "quick-spec", "--project", pf]).out),
    "next-action names the fast-forward (/spec-ff + approve --through tasks); approve --through approves every phase; metrics counts the batch approvals");
  run(["create", "Refused ff", "core", "--project", pf]);
  fillB3(pf, "refused-ff", ["design"]);
  const ffR = run(["approve", "refused-ff", "--through", "tasks", "--project", pf]);
  const ffRj = jsonB3(run(["approve", "refused-ff", "--through", "tasks", "--json", "--project", pf]));
  ok(ffR.code === 1 && /^dev-spec: Fast-forward 'refused-ff' stopped at 'design' \(approved before it: classification, requirements\) — its gate refuses it — failing checks: placeholders/.test(ffR.out) &&
    ffRj && ffRj.ok === false && ffRj.refused === true && ffRj.stoppedAt === "design" && ffRj.approved.length === 0 && ffRj.failing.includes("placeholders") &&
    /stopped at 'design' \(nothing approved\)/.test(ffRj.error),
    "approve --through stops at the first refused gate: exit 1 naming the phases approved before it and the failing checks; --json → {ok:false, refused, stoppedAt, approved} (a rerun resumes there)");

  // CLI = MCP: the same engine call gives the same fast-forward on a twin project; usage and argument errors
  const tw = path.join(tmp, "pb3-twin");
  Sb3.initProject(tw, ["core"], "en");
  Sb3.createFeature(tw, "Quick spec", ["core"]);
  fillB3(tw, "quick-spec");
  const eng = Sb3.approvePhase(tw, "quick-spec", undefined, "x", { through: "tasks" });
  const pf2 = path.join(tmp, "pb3-twin-cli");
  run(["init", "--project", pf2]); run(["create", "Quick spec", "core", "--project", pf2]); fillB3(pf2, "quick-spec");
  const cliJ = jsonB3(run(["approve", "quick-spec", "--through", "tasks", "--by", "x", "--json", "--project", pf2]));
  const usageB3 = run(["approve", "quick-spec", "--project", pf2]);
  const bothB3 = run(["approve", "quick-spec", "design", "--through", "tasks", "--project", pf2]);
  const execB3 = run(["approve", "quick-spec", "--through", "execution", "--project", pf2]);
  ok(cliJ && JSON.stringify([cliJ.ok, cliJ.complete, cliJ.approved, cliJ.steps, cliJ.message]) === JSON.stringify([eng.ok, eng.complete, eng.approved, eng.steps, eng.message]) &&
    usageB3.code === 1 && /approve <feature> --through <phase>/.test(usageB3.out) && bothB3.code === 1 && /either a phase or through/.test(bothB3.out) &&
    execB3.code === 1 && /covers the planning phases only/.test(execB3.out),
    "approve --through --json = spec_approve {through} (same approved / steps / message); approve without a phase or --through is a usage error; a phase plus --through and --through execution are refused");

  // PT: role sign-off and fast-forward messages in European Portuguese; --roles none clears
  const pp = path.join(tmp, "pb3-pt");
  run(["init", "--lang", "pt", "--roles", "design=tech+security", "--project", pp]);
  run(["create", "Exportar faturas", "core", "--project", pp]);
  fillB3(pp, "exportar-faturas");
  run(["approve", "exportar-faturas", "classification", "--project", pp]);
  run(["approve", "exportar-faturas", "requirements", "--project", pp]);
  const ptSign = run(["approve", "exportar-faturas", "design", "--role", "tech", "--project", pp]);
  const ptFf = run(["approve", "exportar-faturas", "--through", "tasks", "--role", "security", "--project", pp]);
  const ptClear = run(["init", "--roles", "none", "--project", pp]);
  ok(/^'design' de exportar-faturas validada como tech ✓\n {2}⚠ 'design' continua pendente até todos os papéis validarem o seu conteúdo atual — falta o papel: security\./.test(ptSign.out) &&
    /^Avanço rápido de 'exportar-faturas': design, tasks aprovadas, por ordem/.test(ptFf.out) &&
    /Papéis de aprovação removidos — cada fase volta a precisar de uma única aprovação\./.test(ptClear.out) && metaB3(pp).approvalRoles === undefined,
    "PT: the role sign-off, the fast-forward summary and --roles none (cleared) print in European Portuguese");

  const helpB3 = run(["help"]).out;
  const docB3 = fs.readFileSync(CLI, "utf8").split("*/")[0];
  ok(/--roles requirements=product,design=tech\+security/.test(helpB3) && /approve <feature> --through <phase> {2}Fast-forward \(\/spec-ff\)/.test(helpB3) &&
    /--role ROLE \/ --through PHASE \(approve\)/.test(helpB3) && /--roles requirements=product,design=tech\+security/.test(docB3) && /approve <feature> --through <phase>/.test(docB3) &&
    /--role ROLE = the role you sign off for/.test(docB3),
    "help and the header docblock document init --roles, approve --role and approve --through");
};
