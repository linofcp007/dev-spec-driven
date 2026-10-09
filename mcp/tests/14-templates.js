"use strict";
// Project templates (.specs/templates/) — scaffolds, variables, track blocks, the placeholder corpus, spec_templates.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, rpc, payload, S, tmp, list, __dirname }) => {

  { // 1.14 B1 — project templates (.specs/templates/): scaffolds, variables, track blocks, the placeholder corpus, spec_templates
    const b1Root = path.join(tmp, "b1-templates");
    const b1 = (n) => path.join(b1Root, n);
    const tw = (p, rel, text) => { const f = path.join(p, ".specs", "templates", ...rel.split("/")); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); return f; };
    const rd = (dir, f) => fs.readFileSync(path.join(dir, f), "utf8");
    const chk = (doc, id) => doc.checks.find((c) => c.id === id) || {};
    const today = () => S.today(); // the local calendar date (1.25.1)

    // --- an override is used for new features: variables substituted, the active tracks' blocks appended (EN)
    const pe = b1("en");
    const reqTpl = "# Requirements — {{name}}\n\nSlug: {{slug}} · Tracks: {{tracks}} · Lang: {{lang}} · Date: {{date}} · Owner: {{owner}} · {{ Name }}\n\n## Summary\n{{summary}}\n\n" +
      "## Context\n[Describe the business context of {{name}} in two lines]\n\n## Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN [zeta trigger] THE SYSTEM SHALL [zeta behaviour]\n" +
      "2. **US-1.AC-2** — THE SYSTEM SHALL [zeta invariant]\n\n## Success Criteria\n- **SC-001** — [zeta metric]\n";
    tw(pe, "requirements.md", reqTpl);
    tw(pe, "design.md", "# Design — {{name}}\n\n## Context\n[zeta design context]\n\n## Constitution Check\n- [ ] [zeta principle] — complies\n");
    tw(pe, "tasks.md", "# Tasks — {{name}}\n\n## Phase: Build\n- [ ] 1. [US1] Write the ADR for {{name}}\n  - _Requirements: US-1.AC-1_\n- [ ] 2. [US1] [zeta task]\n  - _Requirements: US-1.AC-2_\n");
    const d0 = today();
    const fe = S.createFeature(pe, "Billing Portal", ["saas"], "Pay invoices online", undefined, "en");
    const d1 = today();
    const feReq = rd(fe.dir, "requirements.md"), feDesign = rd(fe.dir, "design.md"), feTasks = rd(fe.dir, "tasks.md");
    ok(fe.ok && fe.templates && fe.templates["requirements.md"] === ".specs/templates/requirements.md" && fe.templates["design.md"] === ".specs/templates/design.md" &&
      fe.templates["tasks.md"] === ".specs/templates/tasks.md" && !fe.templates["quickstart.md"] && /^# Quickstart: Billing Portal/.test(rd(fe.dir, "quickstart.md")) &&
      /^# Requirements — Billing Portal$/m.test(feReq) && /Slug: billing-portal · Tracks: core \+saas · Lang: en · Date: /.test(feReq) &&
      (feReq.includes("Date: " + d0) || feReq.includes("Date: " + d1)) && feReq.includes("Owner: {{owner}} · Billing Portal\n") &&
      feReq.includes("## Summary\nPay invoices online\n") && feReq.includes("[Describe the business context of Billing Portal in two lines]"),
      "B1: spec_create scaffolds from .specs/templates/<artifact>.md — {{name}} {{slug}} {{tracks}} {{lang}} {{date}} {{summary}} substituted ({{ Name }}: case and spacing ignored), an unknown {{owner}} left as is; the result names the templates used; quickstart.md (no template) stays built-in");
    ok(/^#### \[SaaS\] Acceptance Criteria \(EARS\)\n5\. \*\*US-1\.AC-5\*\* — WHEN a user from tenant A/m.test(feReq) && /^6\. \*\*US-1\.AC-6\*\*/m.test(feReq) &&
      /\n## \[SaaS\] Performance Budget\n> \*\*TODO\*\*/.test(feDesign) && /## \[SaaS\] Cost Envelope/.test(feDesign) && feDesign.indexOf("[zeta design context]") < feDesign.indexOf("[SaaS]") &&
      /^- \[ \] 3\. \[US1\] Emit metrics, add dashboard, configure alerts\n  - _Requirements: US-1\.AC-6_/m.test(feTasks) && /Enforce tenant isolation[^\n]*\n  - _Requirements: US-1\.AC-5_/.test(feTasks) &&
      chk(S.specDoctor(pe, fe.slug), "ac-uniqueness").status === "pass" && S.traceCheck(pe, fe.slug).verdict === "pass",
      "B1: an overridden requirements.md / design.md / tasks.md still gets the active track's criteria, mandatory sections (> **TODO** seeded) and task block, appended at the end after the template's own tasks — trace_check passes");
    const fe2 = S.createFeature(pe, "No Summary", ["core"], "", undefined, "en");
    const fe2Req = rd(fe2.dir, "requirements.md");
    ok(fe2Req.includes("## Summary\n[TBD]\n") && !/\[SaaS\]/.test(fe2Req) && !/\[SaaS\]|Testability/.test(rd(fe2.dir, "design.md")) && !/\[SaaS\]/.test(rd(fe2.dir, "tasks.md")),
      "B1: {{summary}} of a feature created without one is the generic [TBD] slot (still a placeholder); a core feature gets no track block");

    // --- the untouched custom scaffold reads 'placeholder' (doctor / approve / next_action) — its template's slots are the corpus
    const zeta = "[Describe the business context of Billing Portal in two lines]";
    const repFe = S.featurePlaceholders(pe, fe.slug, "requirements.md");
    ok(repFe.state === "placeholder" && repFe.items.some((i) => i.text === zeta) && repFe.items.some((i) => i.text === "[zeta trigger]") &&
      S.placeholderReport(zeta + " and [zeta trigger]").length === 0,
      "B1: the project's template slots are template placeholders — a {{name}} slot matches what the name became — while the same brackets outside this project are the user's content");
    S.approvePhase(pe, fe.slug, "classification", "t", { force: true });
    const apFe = S.approvePhase(pe, fe.slug, "requirements", "t");
    const docFe = S.specDoctor(pe, fe.slug);
    const naFe = S.nextAction(pe, fe.slug);
    ok(!apFe.ok && apFe.refused && apFe.failing.includes("placeholders") && !apFe.failing.includes("phase-order") && chk(docFe, "placeholders").status === "fail" &&
      /\[zeta trigger\]|Describe the business context/.test(chk(docFe, "placeholders").detail) && docFe.phase === "requirements" && naFe.step === "fill" && /requirements\.md/.test(naFe.recommendation),
      "B1: an untouched custom scaffold is refused by spec_approve (placeholders), fails doctor's placeholders check and next_action says fill requirements.md; the template's verbatim task ('Write the ADR for …') doesn't make it 'tasks-ready'");
    fs.writeFileSync(path.join(fe.dir, "requirements.md"), feReq.replace(zeta, "Customers pay their invoices online.")
      .replace("WHEN [zeta trigger] THE SYSTEM SHALL [zeta behaviour]", "WHEN a customer pays an invoice THE SYSTEM SHALL mark it paid within 5 seconds")
      .replace("THE SYSTEM SHALL [zeta invariant]", "THE SYSTEM SHALL never charge one invoice twice").replace("[zeta metric]", "95% of invoices are paid within a day").replace("[N]ms", "300ms"));
    const apFe2 = S.approvePhase(pe, fe.slug, "requirements", "t");
    ok(S.featurePlaceholders(pe, fe.slug, "requirements.md").items.length === 0 && !(apFe2.failing || []).includes("placeholders"),
      "B1: once the template's slots are written, requirements.md is no longer 'placeholder' for the gate (" + (apFe2.ok ? "approved" : (apFe2.failing || []).join(",")) + ")");
    // The corpus follows the templates: an edited template no longer makes its old slot a placeholder (no stale cache).
    const fe2Before = S.featurePlaceholders(pe, fe2.slug, "requirements.md").items.map((i) => i.text);
    tw(pe, "requirements.md", reqTpl.replace("[zeta trigger]", "[omega trigger]"));
    const fe2After = S.featurePlaceholders(pe, fe2.slug, "requirements.md").items.map((i) => i.text);
    ok(fe2Before.includes("[zeta trigger]") && !fe2After.includes("[zeta trigger]") && fe2After.includes("[zeta behaviour]"),
      "B1: the per-project corpus is invalidated when a template changes — the edited template's old slot no longer counts, the others still do");

    // --- PT: the <lang>/ template wins for a PT feature, the shared one serves EN; track blocks in the feature's language
    const pp = b1("pt");
    S.initProject(pp, ["core"], "pt");
    tw(pp, "requirements.md", "# EN shared — {{name}}\n\n## Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN [shared trigger] THE SYSTEM SHALL [shared behaviour]\n");
    tw(pp, "pt/requirements.md", "# Requisitos — {{name}}\n\n## Resumo\n{{summary}}\n\n## Contexto\n[Descreve o contexto de {{name}}]\n\n## Critérios de Aceitação (EARS)\n" +
      "1. **US-1.AC-1** — QUANDO [gatilho zeta] O SISTEMA DEVE [comportamento zeta]\n");
    const fp = S.createFeature(pp, "Faturação", ["saas"], "", undefined, "pt");
    const fen = S.createFeature(pp, "Invoices EN", ["core"], "", undefined, "en");
    const fpReq = rd(fp.dir, "requirements.md");
    const fpRep = S.featurePlaceholders(pp, fp.slug, "requirements.md").items.map((i) => i.text);
    ok(fp.ok && fp.lang === "pt" && fp.templates["requirements.md"] === ".specs/templates/pt/requirements.md" && /^# Requisitos — Faturação$/m.test(fpReq) &&
      fpReq.includes("## Resumo\n[a definir]\n") && /^#### \[SaaS\] Critérios de Aceitação \(EARS\)$/m.test(fpReq) && /## \[SaaS\] Orçamento de Desempenho/.test(rd(fp.dir, "design.md")) &&
      fpRep.includes("[Descreve o contexto de Faturação]") && fpRep.includes("[gatilho zeta]") && fpRep.includes("[a definir]") &&
      fen.templates["requirements.md"] === ".specs/templates/requirements.md" && /^# EN shared — Invoices EN/.test(rd(fen.dir, "requirements.md")),
      "B1: PT — .specs/templates/pt/requirements.md wins for a PT feature (the shared one serves the EN feature); {{summary}} → [a definir]; the +saas criteria and design sections are appended in Portuguese; its slots read as placeholders");

    // --- a template with its own US-1.AC-5/6: the track criteria are renumbered (no duplicate), tasks and test rows follow
    const pc = b1("collide");
    const six = [1, 2, 3, 4, 5, 6];
    tw(pc, "requirements.md", "# Requirements — {{name}}\n\n## Acceptance Criteria (EARS)\n" + six.map((n) => `${n}. **US-1.AC-${n}** — WHEN [kappa trigger ${n}] THE SYSTEM SHALL [kappa behaviour ${n}]`).join("\n") + "\n");
    tw(pc, "test-plan.md", "# Test Plan — {{name}}\n\n## Matrix\n| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---|---|---|---|---|---|\n" +
      six.map((n) => `| T-0${n} | unit | example | [kappa test ${n}] | US-1.AC-${n} | \`tests/unit/...\` |`).join("\n") + "\n");
    tw(pc, "tasks.md", "# Tasks — {{name}}\n\n## Phase: Build\n" + six.map((n) => `- [ ] ${n}. [US1] [kappa task ${n}]\n  - _Requirements: US-1.AC-${n}_`).join("\n") + "\n");
    const fc = S.createFeature(pc, "Tenants", ["tdd", "saas"], "", undefined, "en");
    const fcReq = rd(fc.dir, "requirements.md"), fcPlan = rd(fc.dir, "test-plan.md"), fcTasks = rd(fc.dir, "tasks.md");
    ok(fc.templates["test-plan.md"] === ".specs/templates/test-plan.md" && /^7\. \*\*US-1\.AC-7\*\* — WHEN a user from tenant A/m.test(fcReq) && /^8\. \*\*US-1\.AC-8\*\* — THE SYSTEM SHALL respond/m.test(fcReq) &&
      (fcReq.match(/\*\*US-1\.AC-5\*\*/g) || []).length === 1 && chk(S.specDoctor(pc, fc.slug), "ac-uniqueness").status === "pass" &&
      /^## \[SaaS\] Traceability Matrix$/m.test(fcPlan) && /\| T-07 \| integration \| property \| tenant A never reads tenant B's records \| US-1\.AC-7 \|/.test(fcPlan) && /\| T-08 \| load \| example \|[^\n]*\| US-1\.AC-8 \|/.test(fcPlan) &&
      /Enforce tenant isolation[^\n]*\n  - _Requirements: US-1\.AC-7_/.test(fcTasks) && /Emit metrics[^\n]*\n  - _Requirements: US-1\.AC-8_/.test(fcTasks) && S.traceCheck(pc, fc.slug).verdict === "pass",
      "B1: a template defining its own US-1.AC-5/6 → the +saas criteria are renumbered after them (US-1.AC-7/8, no duplicate ID); the test rows appended to the test-plan template (T-07/T-08 under '## [SaaS] Traceability Matrix') and the task block cite the new IDs — trace_check passes");
    const ckTasks = S.templates(pc, "check", { artifact: "tasks" });
    ok(ckTasks.ok && ckTasks.checked.length === 1 && ckTasks.checked[0].file === ".specs/templates/tasks.md" && !ckTasks.problems.some((p) => /phantom/.test(p.code)) &&
      S.templates(pc, "check").problems.every((p) => !/phantom/.test(p.code)),
      "B1: check <artifact> judges a tasks template against the project's requirements template (not the built-in one) and reports on that file only");

    // --- steering: spec_init / steering_scaffold / spec_add_track use .specs/templates/[<lang>/]steering/<file>.md
    const ps = b1("steer");
    tw(ps, "steering/constitution.md", "# Constitution of {{name}}\n\n1. [kappa principle]\n");
    tw(ps, "steering/api-rules.md", "---\ninclusion: fileMatch\nfileMatchPattern: \"src/api/**\"\n---\n# API rules ({{slug}})\n\n- [kappa rule]\n");
    tw(ps, "pt/steering/tech.md", "# Stack técnica de {{name}}\n\n- [kappa stack]\n");
    tw(ps, "steering/tech.md", "# Shared tech {{name}}\n");
    const is = S.initProject(ps, ["core"], "pt");
    const ss = S.scaffoldSteeringFile(ps, "api-rules.md", "pt");
    const stDir = path.join(ps, ".specs", "steering");
    const sDoc = S.specDoctor(ps, S.createFeature(ps, "Uma Coisa", ["core"], "", undefined, "pt").slug);
    ok(is.templates && is.templates["constitution.md"] === ".specs/templates/steering/constitution.md" && is.templates["tech.md"] === ".specs/templates/pt/steering/tech.md" && !is.templates["product.md"] &&
      rd(stDir, "constitution.md") === "# Constitution of steer\n\n1. [kappa principle]\n" && rd(stDir, "tech.md").startsWith("# Stack técnica de steer") &&
      ss.ok && ss.created && ss.template === ".specs/templates/steering/api-rules.md" && /# API rules \(steer\)/.test(rd(stDir, "api-rules.md")) &&
      S.steeringFrontMatter(rd(stDir, "api-rules.md")).inclusion === "fileMatch" && /constitution\.md/.test(chk(sDoc, "steering").detail),
      "B1: spec_init / steering_scaffold write the steering stubs from .specs/templates/[<lang>/]steering/<file>.md (the PT one wins in a PT project; {{name}} / {{slug}} = the project folder), a custom scoped file included; an untouched one is still a template for doctor's steering check");
    const pa = b1("addtrack");
    tw(pa, "test-plan.md", "# Test Plan — {{name}} ({{tracks}})\n\n| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---|---|---|---|---|---|\n| T-01 | unit | example | [lambda test] | US-1.AC-1 | `tests/unit/...` |\n");
    tw(pa, "load-test.md", "# Load — {{name}}\n\n[lambda load scenario]\n");
    tw(pa, "steering/scale.md", "# Scale ({{tracks}})\n\n[lambda scale]\n");
    const fa = S.createFeature(pa, "Reports", ["core"], "", undefined, "en");
    const at = S.addTrack(pa, "Reports", "tdd saas");
    ok(at.ok && at.templates && at.templates["test-plan.md"] === ".specs/templates/test-plan.md" && at.templates["load-test.md"] === ".specs/templates/load-test.md" &&
      at.templates["steering/scale.md"] === ".specs/templates/steering/scale.md" && /^# Test Plan — Reports \(core \+tdd \+saas\)$/m.test(rd(fa.dir, "test-plan.md")) &&
      rd(path.join(pa, ".specs", "steering"), "scale.md").startsWith("# Scale (core +tdd +saas)") && /^# Load — Reports/.test(rd(fa.dir, "load-test.md")),
      "B1: spec_add_track scaffolds the new track's artifacts and steering from the project's templates too ({{tracks}} = the tracks after the change)");

    // --- spec_import scaffolds what it doesn't import from the project's templates (a test-plan template is kept as is)
    const pim = b1("import");
    const kiroDir = path.join(pim, ".kiro", "specs", "login");
    fs.mkdirSync(kiroDir, { recursive: true });
    fs.writeFileSync(path.join(kiroDir, "requirements.md"), "### Requirement 1\n\n**User Story:** As a user, I want to log in, so that I can use the app.\n\n#### Acceptance Criteria\n\n" +
      "1. WHEN the user submits valid credentials THEN the system SHALL create a session\n2. IF the password is wrong THEN the system SHALL show an error\n");
    tw(pim, "quickstart.md", "# Try {{name}} by hand\n\n1. [omicron step]\n");
    tw(pim, "test-plan.md", "# Plan — {{name}}\n\n| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---|---|---|---|---|---|\n| T-01 | unit | example | [omicron test] | US-1.AC-1 | `tests/unit/...` |\n");
    const imp = S.importSpec(pim, "kiro", ".kiro/specs/login", { tracks: "tdd" });
    ok(imp.ok && /^# Try login by hand/.test(rd(imp.dir, "quickstart.md")) && /^# Plan — login/.test(rd(imp.dir, "test-plan.md")) && rd(imp.dir, "test-plan.md").includes("[omicron test]") &&
      /US-1\.AC-2/.test(rd(imp.dir, "requirements.md")) && !/\{\{/.test(rd(imp.dir, "requirements.md")),
      "B1: spec_import scaffolds the files it doesn't import from the project's templates — a test-plan template is the team's format and is kept (not re-planned); the imported requirements stay the imported ones");

    // --- bugfix: bug.md / bug-tasks.md templates; the root-cause gate holds on the template's own slot
    const pb = b1("bug");
    tw(pb, "bug.md", "# Bug — {{name}}\n\n## Reproduction\nSteps: [mu steps]\n\n## Root Cause\nThe cause, with evidence: [mu cause]\n");
    tw(pb, "bug-tasks.md", "# Tasks — {{name}}\n\n## Phase: Fix\n- [ ] 1. [shared] Reproduce {{name}} and write the steps\n  - _Requirements: US-1.AC-1_\n" +
      "- [ ] 2. [shared] Find the root cause of {{name}}\n  - _Requirements: US-1.AC-1_\n");
    const fb = S.createFeature(pb, "Crash on save", ["core"], "", undefined, "en", "bugfix");
    const dbug = S.specDoctor(pb, fb.slug);
    ok(fb.ok && fb.kind === "bugfix" && fb.templates["bug.md"] === ".specs/templates/bug.md" && fb.templates["tasks.md"] === ".specs/templates/bug-tasks.md" && !fb.templates["requirements.md"] &&
      /^# Bug — Crash on save/.test(rd(fb.dir, "bug.md")) && chk(dbug, "root-cause").status === "fail" && chk(dbug, "reproduction").status === "warn" && dbug.phase === "requirements",
      "B1: a bugfix scaffolds from the bug.md / bug-tasks.md templates; a Root Cause holding the template's own slot beside its prose stays unfilled (the root-cause gate holds) and the template's steps don't make it 'tasks-ready'");

    // --- spec_templates list / init
    const lsPt = S.templates(pp, "list", { lang: "pt" });
    const lsEn = S.templates(pp, "list");
    const lreq = (l) => l.templates.find((e) => e.artifact === "requirements");
    ok(lsPt.ok && lsPt.action === "list" && lreq(lsPt).source === "override" && lreq(lsPt).override === ".specs/templates/pt/requirements.md" && lreq(lsPt).overrides.length === 2 &&
      lsPt.templates.find((e) => e.artifact === "design").source === "built-in" && lsPt.templates.length === 33 /* 1.21: + steering/data.md (F4), + change (F5) */ && /^Templates para features em 'pt'/.test(S.templatesLines(lsPt)[0]) &&
      lsEn.lang === "pt" && lreq(S.templates(pp, "list", { lang: "en" })).override === ".specs/templates/requirements.md" &&
      S.templates(ps, "list").templates.some((e) => e.artifact === "steering/api-rules.md" && e.source === "override"),
      "B1: spec_templates list — built-in vs project template per artifact for a language (the <lang>/ one wins; default: the project language), in that language, custom steering templates included");
    const pi = b1("init");
    const i1 = S.templates(pi, "init", { artifact: "requirements.md" });
    fs.appendFileSync(path.join(pi, ".specs", "templates", "requirements.md"), "\n<!-- team edit -->\n");
    const i2 = S.templates(pi, "init", { artifact: "Requirements" });
    const i3 = S.templates(pi, "init", { lang: "es" });
    const tplDir = path.join(pi, ".specs", "templates");
    ok(i1.ok && i1.created.join() === ".specs/templates/requirements.md" && rd(tplDir, "requirements.md").startsWith("# Feature: {{name}}\n\n## Summary\n{{summary}}\n") &&
      i2.ok && !i2.created.length && i2.kept.join() === ".specs/templates/requirements.md" && /Nothing copied/.test(S.templatesLines(i2)[0]) && rd(tplDir, "requirements.md").includes("<!-- team edit -->") &&
      i3.created.length === 33 && i3.created.every((c) => c.startsWith(".specs/templates/es/")) && rd(path.join(tplDir, "es"), "design.md").startsWith("# Diseño: {{name}}") &&
      fs.existsSync(path.join(tplDir, "es", "steering", "constitution.md")) && /copiada\(s\) en \.specs\/templates\//.test(S.templatesLines(i3)[0]) &&
      S.templates(pi, "check").verdict === "pass" && S.templates(pi, "check", { lang: "es" }).verdict === "pass",
      "B1: spec_templates init copies the built-in template(s) with the variables in place — one artifact or all 33 (1.16: + steering/glossary.md; 1.17: + steering/distributed.md; 1.19: + steering/api.md, ui.md; 1.21: + change.md, steering/data.md), --lang into <lang>/ (in that language) — never over an edited file; the copies check clean");

    // --- spec_templates check: a design template with some [SaaS] headings but not Observability, and the other rules
    const pk = b1("check");
    tw(pk, "design.md", "# Design — {{name}}\n\n## Constitution Check\n- [ ] [p] — complies\n\n## [SaaS] Performance Budget\n> **TODO** — fill it.\n\n## [SaaS] Scale Design\n> **TODO** — fill it.\n\n" +
      "## [SaaS] Multi-tenancy Model\n> **TODO** — fill it.\n\n## [SaaS] Cost Envelope\n- $ per 1000 users per month\n");
    tw(pk, "requirements.md", "# R — {{name}} {{owner}}\n\n## Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN [a] THE SYSTEM SHALL [b]\n2. **US-1.AC-1** — WHEN [c] THE SYSTEM SHALL [d]\n3. **US-1.AC-2** — WHEN [e] the page [f]\n");
    tw(pk, "tasks.md", "# T\n\n- [ ] 1. [x]\n  - _Requirements: US-1.AC-9_\n");
    tw(pk, "bug.md", "# Bug\n\n## Reproduction\n> **TODO** — steps.\n\n## Root Cause\nA race condition in the save handler.\n");
    tw(pk, "eval-plan.md", "# Eval plan {{name}}\n\nGolden set of 100 items, judged by a rubric.\n");
    tw(pk, "notes.md", "not a template\n");
    tw(pk, "fr/requirements.md", "# FR\n");
    tw(pk, "quickstart.md", "   \n");
    const ck = S.templates(pk, "check");
    const has = (code, file, sev) => ck.problems.some((p) => p.code === code && p.file === ".specs/templates/" + file && (!sev || p.severity === sev));
    const msgOf = (code) => (ck.problems.find((p) => p.code === code) || {}).message || "";
    ok(ck.ok && ck.verdict === "fail" && has("missing-section", "design.md", "error") && /^\[SaaS\] Observability is missing/.test(msgOf("missing-section")) &&
      ck.problems.filter((p) => p.code === "missing-section").length === 1 && has("no-sentinel", "design.md", "warn") && /\[SaaS\] Cost Envelope/.test(msgOf("no-sentinel")) &&
      has("ears-no-modal", "requirements.md", "error") && has("ac-duplicate", "requirements.md", "error") && ck.problems.some((p) => p.code === "unknown-variable" && p.line === 1 && /\{\{owner\}\}/.test(p.message)) &&
      has("phantom-ac", "tasks.md", "warn") && /US-1\.AC-9/.test(msgOf("phantom-ac")) && has("builtin-phantom", "requirements.md", "warn") && /test-plan\.md/.test(msgOf("builtin-phantom")) &&
      has("root-cause-filled", "bug.md", "error") && has("no-placeholders", "eval-plan.md", "warn") && has("unknown-file", "notes.md") && has("unknown-file", "fr/") && has("empty", "quickstart.md") &&
      ck.errors === ck.problems.filter((p) => p.severity === "error").length && /^\d+ template file\(s\) checked — [1-9]\d* error\(s\)/.test(S.templatesLines(ck)[0]) && S.templatesLines(ck).some((l) => /^  ✗ \.specs\/templates\/design\.md — \[SaaS\] Observability/.test(l)),
      "B1: spec_templates check flags a design template missing a +saas mandatory section (error) and one without its > **TODO** line, EARS / AC-ID errors, unknown {{variables}}, phantom AC IDs, a Root Cause that already reads as written, a chain template with no slot, empty and unknown files");
    // Only the test plan is the team's: the built-in tasks of a +tdd feature make green T-02…T-05 it never plans (check warns);
    // the appended +saas rows keep the built-in T-06 / T-07 those tasks cite.
    const ptp = b1("testplan-only");
    tw(ptp, "test-plan.md", "# Test Plan — {{name}}\n\n| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---|---|---|---|---|---|\n| T-01 | unit | example | [xi test] | US-1.AC-1 | `tests/unit/...` |\n");
    const ckTp = S.templates(ptp, "check");
    const ftp = S.createFeature(ptp, "Plan Only", ["tdd", "saas"], "", undefined, "en");
    const ftpPlan = rd(ftp.dir, "test-plan.md");
    const ftpGaps = S.traceGapLines(S.traceCheck(ptp, ftp.slug), "en").join(" | ");
    ok(ckTp.problems.some((p) => p.code === "builtin-phantom-test" && p.file === ".specs/templates/test-plan.md" && /T-02, T-03, T-04, T-05/.test(p.message) && /tasks\.md/.test(p.message)) &&
      /\| T-06 \| integration \| property \| tenant A never reads tenant B's records \| US-1\.AC-5 \|/.test(ftpPlan) && /\| T-07 \| load \|/.test(ftpPlan) && !/T-0[67]/.test(ftpGaps) && /T-02/.test(ftpGaps),
      "B1: check warns that the built-in tasks of a +tdd feature make green T-IDs a test-plan template doesn't plan; the +saas rows appended to it keep the built-in T-06 / T-07 the built-in tasks cite (" + ftpGaps + ")");
    const fk = S.createFeature(pk, "Checked", ["saas"], "", undefined, "en");
    ok(/Observability:missing/.test(chk(S.specDoctor(pk, fk.slug), "saas-sections").detail) && !/\[SaaS\] Observability/.test(rd(fk.dir, "design.md")) && !(fk.templates || {})["quickstart.md"],
      "B1: the rule check enforces — a design template carrying some [SaaS] headings gets none appended, so the section it lacks is missing for doctor; an empty template is ignored (built-in used)");

    // --- confinement: only allowlisted names, nothing outside .specs/templates/ is read or written
    const pt0 = b1("trav");
    const bad = ["../evil", "..\\evil", "steering/../../evil", "steering/NUL.md", "steering/__proto__.md", "steering/sub/x.md", "__proto__", "constructor", "requirements/../../x",
      "/etc/passwd", "C:\\x\\requirements.md", "templates/requirements.md", "Requirements.md/.."];
    const badRes = bad.map((a) => S.templates(pt0, "init", { artifact: a }));
    ok(badRes.every((r) => !r.ok && /^Unknown template '/.test(r.error)) && !fs.existsSync(path.join(pt0, ".specs")) && !fs.existsSync(path.join(b1Root, "evil")) &&
      !S.templates(pt0, "delete").ok && /Unknown templates action 'delete'/.test(S.templates(pt0, "delete").error) && !S.templates(pt0, "list", { lang: "fr" }).ok &&
      S.templateKey("steering/api-rules") === "steering/api-rules.md" && S.templateKey("steering\\tech.md") === "steering/tech.md" && S.templateKey(" Bug-Tasks.md ") === "bug-tasks",
      "B1: spec_templates refuses any template name outside the allowlist (traversal, absolute paths, device / prototype names, nested steering) and an unknown action / lang — nothing is written");
    const outDir = b1("outside-tpl");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "requirements.md"), "# OUTSIDE {{name}}\n");
    const pj = b1("junction");
    fs.mkdirSync(path.join(pj, ".specs", "templates"), { recursive: true });
    let linked = false;
    try { fs.symlinkSync(outDir, path.join(pj, ".specs", "templates", "pt"), "junction"); linked = true; } catch { /* no link support: the lexical allowlist above still holds */ }
    const fj = S.createFeature(pj, "Ligada", ["core"], "", undefined, "pt");
    // …and a templates/ folder that is itself a link out of the project: nothing is read from it, init writes nothing into it.
    const pj2 = b1("junction2");
    fs.mkdirSync(path.join(pj2, ".specs"), { recursive: true });
    let linked2 = false;
    try { fs.symlinkSync(outDir, path.join(pj2, ".specs", "templates"), "junction"); linked2 = true; } catch { /* no link support */ }
    const fj2 = S.createFeature(pj2, "Linked", ["core"], "", undefined, "en");
    const ij2 = linked2 ? S.templates(pj2, "init") : { ok: false, error: "Refused to write" };
    ok(!/OUTSIDE/.test(rd(fj.dir, "requirements.md")) && (!linked || S.templates(pj, "list", { lang: "pt" }).ignored.includes(".specs/templates/pt")) &&
      !/OUTSIDE/.test(rd(fj2.dir, "requirements.md")) && !ij2.ok && /^Refused to write \.specs\/templates\/classification\.md/.test(ij2.error) &&
      fs.readdirSync(outDir).join() === "requirements.md",
      "B1: a linked folder under .specs/templates/ — or templates/ itself linked out of the project — is never read, and init writes nothing through it" + (linked && linked2 ? "" : " (links unavailable here)"));
    const resv = S.createFeature(pe, "templates", ["core"], "", undefined, "en");
    tw(pe, ".gitkeep", "");
    ok(!resv.ok && /reserved/.test(resv.error) && !S.listFeatures(pe).features.some((x) => x.name === "templates") && !(S.listFeatures(pe).ignored || []).includes("templates") &&
      !S.templates(pe, "list").ignored.length && !S.templates(pe, "check").problems.some((p) => /gitkeep/.test(p.file)),
      "B1: 'templates' is a reserved folder name under .specs/ — never a new feature, never listed; a dotfile in it (.gitkeep) is not reported");
    // A feature named "templates" created before 1.14 (its folder holds a .state.json) stays a feature — never read as templates.
    const pl = b1("legacy");
    const lf = S.createFeature(pl, "Old Templates", ["core"], "Email templates editor", undefined, "en");
    fs.renameSync(lf.dir, path.join(pl, ".specs", "templates"));
    const lfNew = S.createFeature(pl, "Fresh", ["core"], "", undefined, "en");
    const lfList = S.templates(pl, "list"), lfInit = S.templates(pl, "init");
    const lfSeen = S.listFeatures(pl).features.some((x) => x.name === "templates") && S.specDoctor(pl, "templates").ok;
    const lfRen = S.manageFeature(pl, "rename", "templates", "old-templates");
    ok(lfNew.ok && !lfNew.templates && /^# Feature: Fresh/.test(rd(lfNew.dir, "requirements.md")) && !lfList.ok && lfList.legacyFeature && /stays that feature/.test(lfList.error) &&
      !lfInit.ok && lfInit.legacyFeature && !fs.existsSync(path.join(pl, ".specs", "old-templates", "steering")) && lfSeen && lfRen.ok && S.templates(pl, "list").ok,
      "B1: a pre-1.14 feature folder named 'templates' (it holds .state.json) stays a listed, reachable feature — new scaffolds never read it, every spec_templates action refuses (legacyFeature) — until it is renamed away");

    // --- MCP parity + the hook ignores template edits
    const mcpL = payload(await rpc("tools/call", { name: "spec_templates", arguments: { projectDir: pp, lang: "pt" } }));
    const mcpC = payload(await rpc("tools/call", { name: "spec_templates", arguments: { action: " CHECK ", projectDir: pk } }));
    const mcpBad = await rpc("tools/call", { name: "spec_templates", arguments: { action: "delete", projectDir: pk } });
    fs.mkdirSync(pt0, { recursive: true }); // a projectDir names an existing folder (1.24 r6 A3) — the allowlist is what this checks
    const mcpTrav = payload(await rpc("tools/call", { name: "spec_templates", arguments: { action: "init", artifact: "../x", projectDir: pt0 } }));
    ok(mcpL.ok && JSON.stringify(mcpL) === JSON.stringify(S.templates(pp, "list", { lang: "pt" })) && mcpC.action === "check" && mcpC.verdict === "fail" &&
      JSON.stringify(mcpC.problems) === JSON.stringify(ck.problems) && mcpBad.result.isError && /action must be one of: list, init, check/.test(payload(mcpBad).error) &&
      !mcpTrav.ok && /Unknown template/.test(mcpTrav.error) && list.result.tools.some((t) => t.name === "spec_templates" && !/\n/.test(t.description)),
      "B1: spec_templates (MCP) returns what the engine returns (list / check, a case-folded action), refuses an unknown action by its enum and a traversal by the allowlist");
    S.createFeature(pk, "pt", ["core"], "", undefined, "en");
    const hkTpl = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "spec-hook.js")], {
      input: JSON.stringify({ hook_event_name: "PostToolUse", tool_input: { file_path: tw(pk, "pt/design.md", "# D\n") } }), encoding: "utf8" });
    ok(hkTpl.status === 0 && hkTpl.stdout.trim() === "", "B1: the PostToolUse hook stays silent for .specs/templates/ files (pt/design.md is not feature 'pt''s design)");
  }

  { // 1.22 review — the summary is written through safeSpecText (built-in scaffolds AND a project template's {{summary}}): its "<!--"
    // paired with the scaffold's closing EARS-guidance "-->" and hid every criterion (placeholders 30 → 0, trace 5 ACs → 0, EARS 0 criteria)
    const js = (v) => JSON.stringify(v);
    const p = path.join(tmp, "proj-122-summary");
    S.initProject(p, ["core"], "en");
    const sum = "Escape a stray <!-- in imported markdown";
    const rd = (dir, f) => fs.readFileSync(path.join(dir, f), "utf8");
    const ph = (slug, f) => (S.featurePlaceholders(p, slug, f) || { items: [] }).items.length;
    const fe = S.createFeature(p, "escape", undefined, sum, undefined, "en");
    const ch = S.createFeature(p, "escape change", ["core"], sum, undefined, "en", "change");
    const bg = S.createFeature(p, "escape bug", ["tdd"], sum, undefined, "en", "bugfix");
    const pT = path.join(tmp, "proj-122-summary-template");
    S.initProject(pT, ["core"], "en");
    const tpl = path.join(pT, ".specs", "templates", "requirements.md");
    fs.mkdirSync(path.dirname(tpl), { recursive: true });
    fs.writeFileSync(tpl, "# Requirements — {{name}}\n\n## Summary\n{{summary}}\n\n## Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN [trigger] THE SYSTEM SHALL [behaviour].\n\n<!-- one EARS criterion per line -->\n");
    const tf = S.createFeature(pT, "templated", ["core"], sum, undefined, "en");
    const got = [S.traceCheck(p, fe.slug).totalAcs, S.earsFeature(p, fe.slug).summary.criteriaDetected, ph(fe.slug, "requirements.md"),
      S.traceCheck(p, ch.slug).totalAcs, S.traceCheck(p, bg.slug).totalAcs, ph(bg.slug, "bug.md"), S.traceCheck(pT, tf.slug).totalAcs];
    ok(got[0] === 5 && got[1] === 5 && got[2] >= 5 && got[3] > 0 && got[4] > 0 && got[5] > 0 && got[6] === 1 &&
      [[fe.dir, "requirements.md"], [fe.dir, "classification.md"], [ch.dir, "change.md"], [bg.dir, "bug.md"], [bg.dir, "requirements.md"], [tf.dir, "requirements.md"]]
        .every(([dir, f]) => rd(dir, f).includes("stray &lt;!-- in") && !rd(dir, f).includes("stray <!--")) &&
      js(fe.tracks) === js(S.classify(sum).tracks),
      "1.22 review: a summary holding '<!--' is written neutralized (&lt;!--) into requirements.md / classification.md, change.md, bug.md and a template's {{summary}} — every criterion still read (trace, EARS, placeholders); the classifier reads the raw text (got " + js(got) + ")");
  }
};
