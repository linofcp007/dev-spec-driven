"use strict";
// dev-spec templates [list|init|check] [artifact] [--lang] = spec_templates.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, tmp, require, __dirname }) => {
  const SB1 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const b1 = path.join(tmp, "pb1-proj");
  fs.mkdirSync(b1, { recursive: true }); // 1.23 review: --project names an existing folder (only init creates one)
  const tpl = (...p) => path.join(b1, ".specs", "templates", ...p);
  const jsonOf = (r) => { try { return JSON.parse(r.out); } catch { return null; } };
  const lsEmpty = run(["templates", "--project", b1]);
  const lsEmptyJ = jsonOf(run(["templates", "list", "--json", "--project", b1]));
  ok(lsEmpty.code === 0 && /^Templates for 'en' features — 0 project override\(s\) in \.specs\/templates\//.test(lsEmpty.out) && /· requirements\s+built-in/.test(lsEmpty.out) &&
    lsEmptyJ && JSON.stringify(lsEmptyJ) === JSON.stringify(SB1.templates(b1, "list")),
    "templates (no action) lists every template as built-in; --json is spec_templates' result");
  const in1 = run(["templates", "init", "requirements", "--project", b1]);
  const in2 = run(["templates", "init", "requirements.md", "--project", b1]);
  const inPt = run(["templates", "init", "--lang", "pt", "--project", b1]);
  ok(in1.code === 0 && /1 built-in template\(s\) copied into \.specs\/templates\//.test(in1.out) && /\+ \.specs\/templates\/requirements\.md/.test(in1.out) &&
    fs.readFileSync(tpl("requirements.md"), "utf8").startsWith("# Feature: {{name}}") && in2.code === 0 && /Nothing copied/.test(in2.out) &&
    inPt.code === 0 && /33 template\(s\) de base copiado\(s\) para \.specs\/templates\//.test(inPt.out) && fs.readFileSync(tpl("pt", "design.md"), "utf8").startsWith("# Design: {{name}}") &&
    fs.existsSync(tpl("pt", "steering", "tech.md")),
    "templates init <artifact> copies one built-in template (never over an existing one); init --lang pt copies all 33 (1.16: + steering/glossary.md; 1.17: + steering/distributed.md; 1.19: + steering/api.md, ui.md; 1.21: + change.md, steering/data.md) into .specs/templates/pt/, reported in Portuguese");
  const ckClean = run(["templates", "check", "--project", b1]);
  // (the root requirements.md + the 33 pt/ copies — 1.21: + steering/data.md (F4), + change.md (F5))
  ok(ckClean.code === 0 && /^34 template file\(s\) checked — 0 error\(s\), 0 warning\(s\)\./.test(ckClean.out), "templates check on the copied built-in templates: clean, exit 0");
  // A team template: used by `create`, variables substituted; a broken design template → check exits 1 naming the missing section.
  fs.writeFileSync(tpl("requirements.md"), "# Req — {{name}} ({{slug}}, {{tracks}})\n\n## Summary\n{{summary}}\n\n## Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN [nu trigger] THE SYSTEM SHALL [nu behaviour]\n");
  const cr = run(["create", "Team Report", "--tracks", "saas", "--summary", "Weekly numbers", "--json", "--project", b1]);
  const crJ = jsonOf(cr);
  const crReq = crJ && crJ.ok ? fs.readFileSync(path.join(crJ.dir, "requirements.md"), "utf8") : "";
  ok(cr.code === 0 && crJ.templates["requirements.md"] === ".specs/templates/requirements.md" && crReq.startsWith("# Req — Team Report (team-report, core +saas)\n\n## Summary\nWeekly numbers\n") &&
    /#### \[SaaS\] Acceptance Criteria \(EARS\)/.test(crReq) && run(["doctor", "team-report", "--project", b1]).code === 1,
    "create uses the project's requirements template ({{name}}, {{slug}}, {{tracks}}, {{summary}} substituted, the +saas criteria appended); doctor still fails the untouched scaffold");
  fs.writeFileSync(tpl("design.md"), "# D — {{name}}\n\n## Constitution Check\n- [ ] [p]\n\n## [SaaS] Performance Budget\n> **TODO** — fill.\n");
  const ckBad = run(["templates", "check", "design", "--project", b1]);
  const ckBadJ = jsonOf(run(["templates", "check", "design", "--json", "--project", b1]));
  ok(ckBad.code === 1 && /✗ \.specs\/templates\/design\.md — \[SaaS\] Scale Design is missing/.test(ckBad.out) && /✗ \.specs\/templates\/design\.md — \[SaaS\] Observability is missing/.test(ckBad.out) &&
    ckBadJ && JSON.stringify(ckBadJ.problems) === JSON.stringify(SB1.templates(b1, "check", { artifact: "design" }).problems) && ckBadJ.verdict === "fail",
    "templates check <artifact> exits 1 on an error (a design template with one [SaaS] heading lacks the other mandatory sections); --json = spec_templates check");
  const ckPt = run(["templates", "check", "--lang", "pt", "--project", b1]);
  ok(ckPt.code === 1 && /ficheiro\(s\) de template verificado\(s\)/.test(ckPt.out) && /falta \[SaaS\] Observabilidade|falta \[SaaS\] Observability/.test(ckPt.out),
    "templates check --lang pt: the shared templates plus pt/, reported in Portuguese");
  const badAct = run(["templates", "delete", "--project", b1]);
  const trav = run(["templates", "init", "../../evil", "--project", b1]);
  const travJ = jsonOf(run(["templates", "init", "steering/../../x", "--json", "--project", b1]));
  const badLang = run(["templates", "list", "--lang", "fr", "--project", b1]);
  const extra = run(["templates", "list", "a", "b", "--project", b1]);
  ok(badAct.code === 1 && /Unknown templates action 'delete'/.test(badAct.out) && trav.code === 1 && /Unknown template '\.\.\/\.\.\/evil'/.test(trav.out) &&
    travJ && travJ.ok === false && /Unknown template/.test(travJ.error) && !fs.existsSync(path.join(tmp, "evil")) && !fs.existsSync(path.join(b1, ".specs", "evil")) &&
    badLang.code === 1 && /--lang must be one of: en, pt, es/.test(badLang.out) && extra.code === 1 && /dev-spec templates \[list\|init\|check\]/.test(extra.out),
    "templates refuses an unknown action, a name outside the allowlist (traversal — --json prints the refusal), an unknown --lang and extra arguments (exit 1)");
  const help = run(["help"]);
  ok(/templates \[list\|init\|check\] \[artifact\] \[--lang\]/.test(help.out), "help lists the templates command");
};
