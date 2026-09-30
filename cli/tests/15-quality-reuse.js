"use strict";
// Reuse & Integration — search before you write, duplication against the codebase.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, tmp, require, __dirname }) => {
  const SR = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = (v) => JSON.stringify(v);
  const jsonOf = (r) => { try { return JSON.parse(r.out); } catch { return {}; } };
  const REQ = "# Feature: Orders\n\n## Summary\nPlace an order.\n\n## User Stories\n### US-1 (P1): Place an order\nAs a buyer I want to order.\n**Independent Test:** place one order.\n\n" +
    "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the buyer submits a cart THE SYSTEM SHALL store the order.\n" +
    "2. **US-1.AC-2** — IF the cart is empty THEN THE SYSTEM SHALL reject it.\n\n## Success Criteria\n- **SC-001** — 95% of orders placed in under 2 s.\n\n" +
    "## Edge Cases & Error Handling\n- **EC-1** — WHEN stock runs out THE SYSTEM SHALL refuse the order.\n\n## Non-Functional Requirements\n- **NFR-1** — p95 < 2 s.\n\n## Out of Scope\n- Refunds.\n";
  const DESIGN = "# Design: Orders\n\n## Overview\nOrders are stored.\n\n## Architecture\n```mermaid\ngraph TD\n  A[API] --> S[Store]\n```\n\n" +
    "## Alternatives & Trade-offs\n| Decision | Option | Pros | Cons | Cost if wrong | Chosen |\n|---|---|---|---|---|---|\n" +
    "| Storage | One table | Simple | Wide rows | A migration later | ✓ |\n| Storage | Two tables | Normalized | A join per read | Slower reads | ✗ |\n\n" +
    "## Risks\n- Lost order on a crash — low — one transaction per order.\n\n## Constitution Check\n- [x] Small functions — complies.\n";
  const REUSE = "## Reuse & Integration\n- Reuse the order repository (`src/orders/repo.ts`) — it already reads and writes orders.\n" +
    "- New: `src/orders/api.ts` — nothing exposes orders over HTTP yet (searched api, route, handler).\n\n";

  // EN: a 1.19 design approval stamps reuse: true; without the section doctor warns (▲, exit 0) and --json carries the id; the same
  // approval without the stamp (a 1.17 / 1.18 one) → ✓ 'design approved before 1.19'.
  const rp = path.join(tmp, "p19r-en");
  SR.initProject(rp, ["core"], "en");
  const rf = SR.createFeature(rp, "Orders", ["core"]);
  fs.writeFileSync(path.join(rf.dir, "requirements.md"), REQ);
  for (const ph of ["classification", "requirements"]) SR.approvePhase(rp, rf.slug, ph, "t", { force: true });
  fs.writeFileSync(path.join(rf.dir, "design.md"), DESIGN);
  const ap = run(["approve", "orders", "design", "--project", rp]);
  const statePath = path.join(rf.dir, ".state.json");
  const st = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const doc = run(["doctor", "orders", "--project", rp]);
  const docJ = jsonOf(run(["doctor", "orders", "--project", rp, "--json"]));
  const stamped = st.approvals.design.reuse;
  delete st.approvals.design.reuse;
  fs.writeFileSync(statePath, JSON.stringify(st, null, 2));
  const docL = run(["doctor", "orders", "--project", rp]);
  ok(ap.code === 0 && stamped === true && st.approvals.design.weigh === true && doc.code === 0 && /  ▲ design-reuse — no Reuse & Integration section/.test(doc.out) &&
    (docJ.checks || []).some((c) => c.id === "design-reuse" && c.status === "warn") &&
    /  ✓ design-reuse — design approved before 1\.19 — asked only from its next approval \(no Reuse & Integration section/.test(docL.out),
    "1.19 R1 (CLI): approve design stamps reuse: true; doctor warns (▲, exit 0) on a missing Reuse & Integration and --json carries design-reuse; without the stamp (approved by 1.17 / 1.18) it reads ✓ 'design approved before 1.19' (got " +
    js([ap.code, stamped, doc.code, doc.out.split("\n").filter((l) => /design-/.test(l)), docL.out.split("\n").filter((l) => /design-reuse/.test(l))]) + ")");

  // R2 (CLI): `brief` prints the Reuse section (the design's entry for the task, the files next to its own); --write --json keeps
  // refs.reuse and drops the entries' text.
  fs.writeFileSync(path.join(rf.dir, "design.md"), DESIGN.replace("## Alternatives & Trade-offs", REUSE + "## Alternatives & Trade-offs"));
  fs.writeFileSync(path.join(rf.dir, "tasks.md"), "# Tasks\n\n## Story US-1 (P1)\n- [ ] 1. [US1] Expose the orders\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/orders/api.ts_\n");
  fs.mkdirSync(path.join(rp, "src", "orders"), { recursive: true });
  for (const n of ["api.ts", "repo.ts", "helpers.ts"]) fs.writeFileSync(path.join(rp, "src", "orders", n), "export {};\n");
  const br = run(["brief", "orders", "1", "--project", rp]);
  const brW = jsonOf(run(["brief", "orders", "1", "--write", "--json", "--project", rp]));
  const docF = run(["doctor", "orders", "--project", rp]);
  const brSec = (br.out.split("\n## Reuse — search before you write\n")[1] || "").split("\n## ")[0]; // (the Files section lists api.ts)
  ok(br.code === 0 && /\n- Reuse the order repository \(`src\/orders\/repo\.ts`\) — it already reads and writes orders\.\n/.test(brSec) &&
    /\n- `src\/orders\/helpers\.ts`\n- `src\/orders\/repo\.ts`\n/.test(brSec) && !/\n- `src\/orders\/api\.ts`\n/.test(brSec) &&
    brW.refs && js(brW.refs.reuse) === js({ entries: 2, files: ["src/orders/helpers.ts", "src/orders/repo.ts"] }) && brW.reuse === undefined &&
    /  ✓ design-reuse — 2 item\(s\) named/.test(docF.out),
    "1.19 R2 (CLI): brief prints the Reuse section — the design's entries for the task (a sibling, its own file) and the source files next to its own (not itself); brief --write --json keeps refs.reuse {entries, files}; a filled section passes doctor (got " +
    js([br.code, (br.out.split("## Reuse — search before you write")[1] || "").slice(0, 400), brW.refs, docF.out.split("\n").filter((l) => /design-reuse/.test(l))]) + ")");

  // PT: doctor's detail and `templates check` (a project design template without the section warns reuse-missing, exit 0) are Portuguese.
  const pp = path.join(tmp, "p19r-pt");
  SR.initProject(pp, ["core"], "pt");
  const pf = SR.createFeature(pp, "Encomendas", ["core"], "", undefined, "pt");
  fs.writeFileSync(path.join(pf.dir, "design.md"), "# Design: Encomendas\n\n## Visão Geral\nGuardar encomendas.\n\n## Arquitetura\n```mermaid\ngraph TD\n  A-->B\n```\n\n## Verificação da Constituição\n- [x] ok\n");
  const pDoc = run(["doctor", "encomendas", "--project", pp]);
  fs.mkdirSync(path.join(pp, ".specs", "templates"), { recursive: true });
  fs.writeFileSync(path.join(pp, ".specs", "templates", "design.md"), "# Design: {{name}}\n\n## Visão Geral\n[Como funciona]\n\n## Alternativas e Compromissos\n- [opção A]\n- [opção B]\n\n## Riscos\n- [o que pode falhar]\n\n## Verificação da Constituição\n- [ ] [Princípio 1] — cumpre\n");
  const pTpl = run(["templates", "check", "--project", pp]);
  ok(/  ▲ design-reuse — sem secção Reutilização e Integração — indica os módulos/.test(pDoc.out) &&
    pTpl.code === 0 && /sem secção Reutilização e Integração — o doctor avisa \(design-reuse\)/.test(pTpl.out),
    "1.19 R1 (CLI, PT): doctor's design-reuse detail is Portuguese; templates check warns (exit 0) on a design template without Reutilização e Integração (got " +
    js([pDoc.out.split("\n").filter((l) => /design-reuse/.test(l)), pTpl.code, pTpl.out.slice(0, 400)]) + ")");

  // R review 5 (CLI): `backlog add` of a name already in the backlog says so and appends the new note (it printed "✓ added" and kept
  // the old note); --json carries exists / appended; the same note again changes nothing; PT project → PT line.
  const b1 = run(["backlog", "add", "refactor-pricing", "refactor: Repeated Switches in pricing.ts", "--project", rp]);
  const b2 = run(["backlog", "add", "refactor-pricing", "refactor: rounding copied in cart.ts", "--project", rp]);
  const b3 = jsonOf(run(["backlog", "add", "refactor-pricing", "refactor: rounding copied in cart.ts", "--json", "--project", rp]));
  const bP = (run(["backlog", "add", "refactor-precos", "refactor: a", "--project", pp]), run(["backlog", "add", "refactor-precos", "refactor: b", "--project", pp]));
  ok(b1.code === 0 && /✓ 'refactor-pricing' added to the backlog/.test(b1.out) && b2.code === 0 && !/added to the backlog/.test(b2.out) &&
    /'refactor-pricing' is already in the backlog — the new note was appended to its note\./.test(b2.out) &&
    /  - refactor-pricing — refactor: Repeated Switches in pricing\.ts · refactor: rounding copied in cart\.ts\n/.test(b2.out) &&
    b3.exists === true && b3.appended === false && /nothing changed/.test(b3.note || "") && bP.code === 0 && /já está no backlog — a nova nota foi acrescentada/.test(bP.out),
    "1.19 R review 5 (CLI): backlog add of an existing name prints the engine's note (appended / nothing changed) instead of '✓ added', the entry keeps both notes; --json has exists / appended; PT line (got " +
    js([b1.out, b2.out, b3, bP.out]) + ")");
};
