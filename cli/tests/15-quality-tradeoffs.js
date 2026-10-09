"use strict";
// Design trade-offs / risks, /grill constraint questions, the TDD micro-cycle on the CLI.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, runIn, tmp, require, __dirname }) => {
  const SA = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = (v) => JSON.stringify(v);
  const jsonOf = (r) => { try { return JSON.parse(r.out); } catch { return {}; } };
  const REQ = "# Feature: Orders\n\n## Summary\nPlace an order.\n\n## User Stories\n### US-1 (P1): Place an order\nAs a buyer I want to order.\n**Independent Test:** place one order.\n\n" +
    "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the buyer submits a cart THE SYSTEM SHALL hand the order to the warehouse queue.\n" +
    "2. **US-1.AC-2** — IF the cart is empty THEN THE SYSTEM SHALL reject it.\n\n## Success Criteria\n- **SC-001** — 95% of orders placed in under 2 s.\n\n" +
    "## Edge Cases & Error Handling\n- **EC-1** — WHEN stock runs out THE SYSTEM SHALL refuse the order.\n\n## Non-Functional Requirements\n- **NFR-1** — p95 < 2 s.\n\n## Out of Scope\n- Refunds.\n";
  const DESIGN = "# Design: Orders\n\n## Overview\nOrders go to the warehouse.\n\n## Architecture\n```mermaid\ngraph TD\n  A[API] --> W[Warehouse]\n```\n\n" +
    "## Data Models\nOrder {id, total}.\n\n## Constitution Check\n- [x] Small functions — complies.\n"; // (A review 2: "Idempotent writes" anywhere in the design answers the nudge)

  // EN: a design without Alternatives & Trade-offs / Risks — doctor warns (▲, exit 0), --json carries both ids; the design approval goes
  // through (warn only); clarify asks the consistency question (the spec names a queue) and --json carries nudges.
  const ap = path.join(tmp, "p17a-en");
  SA.initProject(ap, ["core"], "en");
  const af = SA.createFeature(ap, "Orders", ["core"]);
  fs.writeFileSync(path.join(af.dir, "requirements.md"), REQ.replace("warehouse queue", "warehouse message queue")); // A review 7: a strong phrase fires alone
  fs.writeFileSync(path.join(af.dir, "design.md"), DESIGN);
  const doc = runIn(["doctor", "orders", "--project", ap]);
  const docJ = jsonOf(runIn(["doctor", "orders", "--json", "--project", ap]));
  const cl = runIn(["clarify", "orders", "--project", ap]);
  const clJ = jsonOf(runIn(["clarify", "orders", "--json", "--project", ap]));
  runIn(["approve", "orders", "classification", "--force", "--project", ap]);
  const apReq = runIn(["approve", "orders", "requirements", "--project", ap]);
  const apDes = runIn(["approve", "orders", "design", "--project", ap]);
  const ids = (docJ.checks || []).filter((c) => /^design-(?:tradeoffs|risks)$/.test(c.id)).map((c) => c.id + ":" + c.status);
  ok(/  ▲ design-tradeoffs — no Alternatives & Trade-offs section/.test(doc.out) && /  ▲ design-risks — no Risks section/.test(doc.out) &&
    js(ids) === js(["design-tradeoffs:warn", "design-risks:warn"]) && docJ.readyToAdvance === true &&
    apReq.code === 0 && apDes.code === 0 && !/forced|refused/i.test(apDes.out) &&
    cl.code === 0 && /The spec mentions 'message queue', but neither the requirements nor the design say anything about consistency or idempotency/.test(cl.out) &&
    js(clJ.nudges) === js([{ code: "consistency-unstated", signals: ["message queue"] }]),
    "1.17 A1 / A2 (CLI): doctor warns design-tradeoffs / design-risks (▲; --json ids, readyToAdvance), the design approval still goes through; clarify asks the consistency question (--json nudges) (got " +
    js([doc.code, ids, apReq.code, apDes.code, apDes.out.slice(0, 160), cl.out.slice(0, 200), clJ.nudges]) + ")");

  // Filled (one table row per option, one risk): both pass and the question is gone.
  fs.writeFileSync(path.join(af.dir, "design.md"), DESIGN.replace("## Data Models",
    "## Alternatives & Trade-offs\n| Decision | Option | Pros | Cons | Cost if wrong | Chosen |\n|---|---|---|---|---|---|\n| Hand-off | Synchronous call | Simple | Couples uptime | Lost orders | ✗ |\n" +
    "| Hand-off | Queue + outbox | Survives outages | At-least-once | A double shipment | ✓ — idempotency key |\n\n## Risks\n- Duplicate delivery — medium — idempotency key per order.\n\n## Data Models"));
  const doc2 = runIn(["doctor", "orders", "--project", ap]);
  const cl2 = jsonOf(runIn(["clarify", "orders", "--json", "--project", ap]));
  ok(/  ✓ design-tradeoffs — 2 option\(s\) weighed/.test(doc2.out) && /  ✓ design-risks — 1 risk\(s\) listed/.test(doc2.out) && cl2.nudges === undefined,
    "1.17 A1 / A2 (CLI): filled sections → ✓ design-tradeoffs (2 options) / ✓ design-risks; clarify no longer asks (got " + js([doc2.out.split("\n").filter((l) => /design-/.test(l)), cl2.nudges]) + ")");

  // PT: the details and the question in the feature's language; `templates check` warns (exit 0) on a design template without the sections.
  const pp = path.join(tmp, "p17a-pt");
  SA.initProject(pp, ["core"], "pt");
  const pf = SA.createFeature(pp, "Encomendas", ["core"], "", undefined, "pt");
  fs.writeFileSync(path.join(pf.dir, "requirements.md"), REQ.replace("hand the order to the warehouse queue", "pôr a encomenda na fila de mensagens do armazém"));
  fs.writeFileSync(path.join(pf.dir, "design.md"), "# Design: Encomendas\n\n## Visão Geral\nx.\n\n## Alternativas consideradas\n- Chamada síncrona.\n\n## Verificação da Constituição\n- [x] ok\n");
  const pDoc = runIn(["doctor", "encomendas", "--project", pp]);
  const pCl = runIn(["clarify", "encomendas", "--project", pp]);
  runIn(["templates", "init", "design", "--project", pp]);
  fs.writeFileSync(path.join(pp, ".specs", "templates", "design.md"), "# Design: {{name}}\n\n## Visão Geral\n[Como funciona]\n\n## Verificação da Constituição\n- [ ] [Princípio 1] — cumpre\n");
  const pTpl = runIn(["templates", "check", "--project", pp]);
  ok(/▲ design-tradeoffs — Alternativas e Compromissos lista 1 opção\(ões\) — o mínimo são 2 por decisão-chave/.test(pDoc.out) && /▲ design-risks — sem secção Riscos/.test(pDoc.out) &&
    /A spec menciona 'fila de mensagens', mas nem os requisitos nem o design dizem nada sobre consistência ou idempotência/.test(pCl.out) &&
    pTpl.code === 0 && /sem secção Alternativas e Compromissos — o doctor avisa \(design-tradeoffs\)/.test(pTpl.out) && /sem secção Riscos — o doctor avisa \(design-risks\)/.test(pTpl.out),
    "1.17 A1 / A2 (CLI, PT): doctor's design-tradeoffs ('lista 1 opção') / design-risks details and the clarify question are Portuguese; templates check warns (exit 0) on a design template without the sections (got " +
    js([pDoc.out.split("\n").filter((l) => /design-/.test(l)), pCl.out.slice(0, 160), pTpl.code, pTpl.out.slice(0, 300)]) + ")");

  // 1.17 A review 3 (CLI): a design approval made by 1.17 is stamped (weigh) and its missing sections warn (▲); the same approval without the
  // stamp (made before 1.17) → ✓ with the 'approved before 1.17' note — a finished pre-1.17 feature is never asked to reopen its design.
  fs.writeFileSync(path.join(af.dir, "design.md"), DESIGN);
  const rApp = runIn(["approve", "orders", "design", "--project", ap]);
  const rStamped = runIn(["doctor", "orders", "--project", ap]);
  const rState = path.join(af.dir, ".state.json");
  const rSt = JSON.parse(fs.readFileSync(rState, "utf8"));
  const rWeigh = rSt.approvals.design.weigh;
  delete rSt.approvals.design.weigh;
  fs.writeFileSync(rState, JSON.stringify(rSt, null, 2));
  const rLegacy = runIn(["doctor", "orders", "--project", ap]);
  ok(rApp.code === 0 && rWeigh === true && /  ▲ design-tradeoffs — no Alternatives & Trade-offs section/.test(rStamped.out) &&
    /  ✓ design-tradeoffs — design approved before 1\.17 — asked only from its next approval \(no Alternatives & Trade-offs section/.test(rLegacy.out) &&
    /  ✓ design-risks — design approved before 1\.17/.test(rLegacy.out),
    "1.17 A review 3 (CLI): a 1.17 design approval carries weigh: true and doctor warns (▲) on its missing sections; without the stamp (approved before 1.17) both read ✓ 'design approved before 1.17' (got " +
    js([rApp.code, rWeigh, rStamped.out.split("\n").filter((l) => /design-/.test(l)), rLegacy.out.split("\n").filter((l) => /design-/.test(l))]) + ")");
};
