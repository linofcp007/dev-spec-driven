"use strict";
// Design trade-offs / risks, /grill constraint questions, the TDD micro-cycle.

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, rpc, payload, S, root, tmp, approveBefore, require }) => {

  // 1.17 package (A) — design trade-offs / risks, /grill constraint questions, the TDD micro-cycle.
  {
    const js = (v) => JSON.stringify(v);
    const call = (name, args) => rpc("tools/call", { name, arguments: args });
    const aRd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n");
    const aDir = (n) => path.join(tmp, "p17a-" + n);
    const chk = (d, id) => (d.checks || []).find((c) => c.id === id) || {};
    const weigh = (d) => ["design-tradeoffs", "design-risks"].map((id) => chk(d, id).status || "-").join(",");
    const wDesign = (f, text) => fs.writeFileSync(path.join(f.dir, "design.md"), text);
    const REQ = "# Feature: Orders\n\n## Summary\nPlace an order.\n\n## User Stories\n### US-1 (P1): Place an order\nAs a buyer I want to order.\n**Independent Test:** place one order.\n\n" +
      "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the buyer submits a cart THE SYSTEM SHALL hand the order to the warehouse queue.\n" +
      "2. **US-1.AC-2** — IF the cart is empty THEN THE SYSTEM SHALL reject it.\n\n## Success Criteria\n- **SC-001** — 95% of orders placed in under 2 s.\n\n" +
      "## Edge Cases & Error Handling\n- **EC-1** — WHEN stock runs out THE SYSTEM SHALL refuse the order.\n\n## Non-Functional Requirements\n- **NFR-1** — p95 < 2 s.\n\n## Out of Scope\n- Refunds.\n";
    const ALT = "## Alternatives & Trade-offs\n| Decision | Option | Pros | Cons | Cost if wrong | Chosen |\n|---|---|---|---|---|---|\n" +
      "| Hand-off | Synchronous call | Simple | Couples uptime | Lost orders | ✗ |\n| Hand-off | Queue + outbox | Survives outages | At-least-once: duplicates | A double shipment | ✓ — idempotency key per order |\n\n";
    const RISKS = "## Risks\n| Risk | Likelihood | Impact | Mitigation | Owner |\n|---|---|---|---|---|\n| Duplicate delivery | medium | high | Idempotency key per order | backend |\n\n";
    const design = (alt, risks) => "# Design: Orders\n\n## Overview\nOrders go to the warehouse through a queue.\n\n## Architecture\n```mermaid\ngraph TD\n  A[API] --> Q[Queue]\n```\n\n" + alt +
      "## Data Models\nOrder {id, total}.\n\n## Error Handling\nRetries with backoff.\n\n## Testing Strategy\nUnit and integration tests.\n\n" + risks +
      "## Constitution Check\n- [x] Idempotent writes — complies.\n\n## Complexity Tracking\nNone.\n";
    const cut = (t, from, to) => t.slice(t.indexOf(from), t.indexOf(to));

    // A1 — a fresh scaffold, EN / PT / ES / pt-BR: both sections, after Architecture and before the Constitution Check, holding template
    // slots the placeholder lookup knows (the corpus renders them) — and the scaffold's own text never fires the clarify nudge.
    const H = {
      en: ["## Architecture", "## Alternatives & Trade-offs", "## Data Models", "## Testing Strategy", "## Risks", "## Constitution Check", "[option A]", "[what could go wrong]"],
      pt: ["## Arquitetura", "## Alternativas e Compromissos", "## Modelos de Dados", "## Estratégia de Testes", "## Riscos", "## Verificação da Constituição", "[opção A]", "[o que pode falhar]"],
      es: ["## Arquitectura", "## Alternativas y Compensaciones", "## Modelos de Datos", "## Estrategia de Pruebas", "## Riesgos", "## Verificación de la Constitución", "[opción A]", "[qué podría salir mal]"],
      "pt-BR": ["## Arquitetura", "## Alternativas e Compromissos", "## Modelos de Dados", "## Estratégia de Testes", "## Riscos", "## Verificação da Constituição", "[opção A]", "[o que pode falhar]"],
    };
    const fresh = Object.keys(H).map((lang) => {
      const p = aDir("fresh-" + lang);
      S.initProject(p, ["core"], lang);
      const f = S.createFeature(p, "Orders", ["core"], "", undefined, lang);
      const t = fs.readFileSync(path.join(f.dir, "design.md"), "utf8");
      const at = H[lang].slice(0, 6).map((h) => t.indexOf(h + "\n"));
      const slots = S.featurePlaceholders(p, f.slug, "design.md").items.map((x) => x.text);
      const good = at.every((i) => i >= 0) && at[0] < at[1] && at[1] < at[2] && at[3] < at[4] && at[4] < at[5] &&
        slots.includes(H[lang][6]) && slots.includes(H[lang][7]) && S.clarify(p, f.slug).nudges === undefined && weigh(S.specDoctor(p, f.slug)) === "-,-";
      return { lang, good, at, slots: slots.filter((s) => s === H[lang][6] || s === H[lang][7]) };
    });
    ok(fresh.every((r) => r.good),
      "1.17 A1: a fresh design.md (EN / PT / ES / pt-BR) has Alternatives & Trade-offs after Architecture and Risks before the Constitution Check, their slots read as template placeholders; while design.md is a later phase's template doctor adds no design-tradeoffs / design-risks check and clarify no nudge (got " + js(fresh) + ")");

    // A1 — the gate: the new sections still template → the design approval is refused on `placeholders` (the same mechanism as every
    // template section); filled → both checks pass; deleted → only warns, the approval goes through (never an approval check).
    const gp = aDir("gate");
    S.initProject(gp, ["core"], "en");
    const gf = S.createFeature(gp, "Orders", ["core"]);
    fs.writeFileSync(path.join(gf.dir, "requirements.md"), REQ);
    approveBefore(gp, gf.slug, "design");
    const tpl = fs.readFileSync(path.join(gf.dir, "design.md"), "utf8");
    wDesign(gf, design(cut(tpl, "## Alternatives & Trade-offs", "## Data Models"), cut(tpl, "## Risks", "## Constitution Check")));
    const gDocT = S.specDoctor(gp, gf.slug);
    const gApT = S.approvePhase(gp, gf.slug, "design", "t");
    wDesign(gf, design(ALT, RISKS));
    const gDocF = S.specDoctor(gp, gf.slug);
    const gMcp = payload(await call("spec_doctor", { projectDir: gp, name: gf.slug }));
    wDesign(gf, design(ALT.split("\n").slice(0, 4).join("\n") + "\n\n", RISKS)); // one option only
    const gDocFew = S.specDoctor(gp, gf.slug);
    const gSaveFew = S.designSaveCheck(gp, gf.slug);
    wDesign(gf, design("", ""));
    const gDocDel = S.specDoctor(gp, gf.slug);
    const gSaveDel = S.designSaveCheck(gp, gf.slug);
    const gApDel = S.approvePhase(gp, gf.slug, "design", "t");
    ok(gApT.ok === false && js(gApT.failing) === js(["placeholders"]) && /\[option A\]/.test(gApT.checks[0].detail) &&
      weigh(gDocT) === "warn,warn" && /still the template/.test(chk(gDocT, "design-tradeoffs").detail) && /Risks is still the template/.test(chk(gDocT, "design-risks").detail) &&
      weigh(gDocF) === "pass,pass" && chk(gDocF, "design-tradeoffs").detail === "2 option(s) weighed" && chk(gDocF, "design-risks").detail === "1 risk(s) listed" &&
      weigh(gMcp) === "pass,pass" && gMcp.checks.findIndex((c) => c.id === "design-tradeoffs") === gMcp.checks.findIndex((c) => c.id === "constitution-check") + 1 &&
      weigh(gDocFew) === "warn,pass" && /lists 1 option\(s\) — weigh at least 2 per key decision/.test(chk(gDocFew, "design-tradeoffs").detail) &&
      js(gSaveFew.weigh) === js({ tradeoffs: "few", risks: "filled" }) && gSaveFew.clean === true && /\n  ▲ Alternatives & Trade-offs lists 1 option/.test(gSaveFew.text) &&
      weigh(gDocDel) === "warn,warn" && /^no Alternatives & Trade-offs section/.test(chk(gDocDel, "design-tradeoffs").detail) && /^no Risks section/.test(chk(gDocDel, "design-risks").detail) &&
      gDocDel.readyToAdvance === true && gDocDel.checks.every((c) => c.status !== "fail") &&
      js(gSaveDel.weigh) === js({ tradeoffs: "missing", risks: "missing" }) && (gSaveDel.text.match(/▲ no (?:Alternatives|Risks)/g) || []).length === 2 && // (+ design-reuse's ▲, 1.19 R1)
      gApDel.ok === true && !gApDel.forced,
      "1.17 A1: template sections refuse the design approval on placeholders only; filled → design-tradeoffs / design-risks pass (MCP too, right after constitution-check); one option → warn 'few'; deleted → two warns, readyToAdvance, the approval goes through unforced; the design-save check notes them with ▲ (got " +
      js([gApT.failing, weigh(gDocT), weigh(gDocF), chk(gDocFew, "design-tradeoffs").detail, gSaveFew.weigh, weigh(gDocDel), gSaveDel.weigh, gApDel.ok]) + ")");

    // A1 — hand-written PT / ES designs: the synonyms (Alternativas consideradas, Riscos e mitigações, Opciones consideradas, one ### per option,
    // a prose Risks section) are recognized, and the details are in the feature's language.
    const hp = aDir("hand");
    S.initProject(hp, ["core"], "en");
    const ptF = S.createFeature(hp, "Encomendas", ["core"], "", undefined, "pt");
    const esF = S.createFeature(hp, "Pedidos", ["core"], "", undefined, "es");
    const brF = S.createFeature(hp, "Pedidos BR", ["core"], "", undefined, "pt-BR");
    const hand = (lang, alt, risks) => "# Design\n\n## Visão Geral\nx.\n\n## Arquitetura\n```mermaid\ngraph TD\n  A-->B\n```\n\n" + alt + "\n" + risks + "\n## " +
      (lang === "es" ? "Verificación de la Constitución" : "Verificação da Constituição") + "\n- [x] ok\n";
    wDesign(ptF, hand("pt", "## Alternativas consideradas\n- **Chamada síncrona** — simples, mas acopla a disponibilidade.\n- **Fila + outbox** — escolhida: sobrevive a falhas.\n",
      "## Riscos e mitigações\n- Entrega duplicada — média — chave de idempotência.\n"));
    wDesign(esF, hand("es", "## Opciones consideradas\n### Opción A: llamada síncrona\nSimple.\n### Opción B: cola + outbox\nElegida.\n",
      "## Riesgos\nNingún riesgo relevante: la función solo lee datos existentes.\n"));
    wDesign(brF, hand("pt-BR", "## Trade-offs\n1. Cache local — rápido.\n2. Sem cache — sempre consistente.\n", "## Risco\n- Cache desatualizado — baixo.\n"));
    const hDocs = [ptF, esF, brF].map((f) => S.specDoctor(hp, f.slug));
    ok(hDocs.every((d) => weigh(d) === "pass,pass") && chk(hDocs[0], "design-tradeoffs").detail === "2 opção(ões) ponderada(s)" && chk(hDocs[0], "design-risks").detail === "1 risco(s) listado(s)" &&
      chk(hDocs[1], "design-tradeoffs").detail === "2 opción(es) sopesada(s)" && /^escrita \(sin fila ni punto/.test(chk(hDocs[1], "design-risks").detail),
      "1.17 A1: hand-written PT / ES / pt-BR designs — Alternativas consideradas, Riscos e mitigações, Opciones consideradas (one ### per option), a prose Riesgos, Trade-offs / Risco — pass, with localized details (got " +
      js(hDocs.map((d) => [weigh(d), chk(d, "design-tradeoffs").detail, chk(d, "design-risks").detail])) + ")");

    // A1 — exempt: a bugfix (bug.md stands in for its design) and a spike (its own doctor); design-first: the design is the current phase,
    // so its template sections warn at once, and deleting them never blocks its approval.
    const ep = aDir("exempt");
    S.initProject(ep, ["core"], "en");
    const bf = S.createFeature(ep, "Crash on save", ["tdd"], "", undefined, "en", "bugfix");
    wDesign(bf, "# Design: Crash on save\n\n## Notes\nThe fix stays inside the save handler.\n");
    const sp = S.createFeature(ep, "Queue spike", undefined, "Kafka or RabbitMQ?", undefined, "en", "spike");
    const df = S.createFeature(ep, "Arch first", ["core"], "x", undefined, "en", undefined, { flow: "design-first" });
    const dfDocT = S.specDoctor(ep, df.slug);
    wDesign(df, design("", ""));
    S.approvePhase(ep, df.slug, "classification", "t", { force: true }); // design-first: the design follows the classification
    const dfDoc = S.specDoctor(ep, df.slug);
    const dfAp = S.approvePhase(ep, df.slug, "design", "t");
    const bDoc = S.specDoctor(ep, bf.slug), sDoc = S.specDoctor(ep, sp.slug);
    ok(weigh(bDoc) === "-,-" && S.designSaveCheck(ep, bf.slug).weigh === null && weigh(sDoc) === "-,-" && sDoc.ok !== false &&
      dfDocT.phase === "design" && weigh(dfDocT) === "warn,warn" && weigh(dfDoc) === "warn,warn" && dfAp.ok === true && !dfAp.forced,
      "1.17 A1: a bugfix and a spike are exempt (no design-tradeoffs / design-risks check); design-first: the design's template sections warn at once, and without them the design approval still goes through (got " +
      js([weigh(bDoc), weigh(sDoc), dfDocT.phase, weigh(dfDocT), weigh(dfDoc), dfAp.ok, dfAp.failing]) + ")");

    // A1 — the demo stays clean (a copy: doctor PASS with both checks passing, the approved design's fingerprint still matching, no
    // clarify nudge); a project design template without the sections is flagged by `templates check` (warn), the built-in one isn't.
    const dm = aDir("demo");
    fs.cpSync(path.join(root, "examples", "demo-project"), dm, { recursive: true });
    const dmDoc = S.specDoctor(dm, "api-keys");
    const dmCl = S.clarify(dm, "api-keys");
    const tp = aDir("tpl");
    S.initProject(tp, ["core"], "en");
    S.templates(tp, "init", { artifact: "design" });
    const tpOk = S.templates(tp, "check");
    fs.writeFileSync(path.join(tp, ".specs", "templates", "design.md"), "# Design: {{name}}\n\n## Overview\n[How it works]\n\n## Constitution Check\n- [ ] [Principle 1] — complies\n");
    const tpBad = S.templates(tp, "check");
    const codes = (r) => (r.problems || []).filter((x) => /design/.test(x.file)).map((x) => x.code + ":" + x.severity);
    ok(dmDoc.verdict === "pass" && weigh(dmDoc) === "pass,pass" && chk(dmDoc, "design-tradeoffs").detail === "4 option(s) weighed" && !chk(dmDoc, "changed-since-approval").id &&
      dmCl.nudges === undefined && dmCl.questions.length === 1 &&
      !codes(tpOk).length && js(codes(tpBad)) === js(["tradeoffs-missing:warn", "risks-missing:warn", "reuse-missing:warn"]) && tpBad.verdict === "warn", // (+ reuse-missing, 1.19 R1)
      "1.17 A1: examples/demo-project stays doctor PASS (design-tradeoffs 4 options, design-risks pass, design approval fingerprint current), no nudge; templates check warns tradeoffs-missing / risks-missing on a design template without them — not on the built-in one (got " +
      js([dmDoc.verdict, weigh(dmDoc), dmCl.questions, codes(tpOk), codes(tpBad)]) + ")");

    // A2 — the clarify nudge: queue / event / concurrency / transaction words and nothing about consistency or idempotency in the design's
    // Alternatives & Trade-offs / Risks → ONE question (stable code, ≤ 3 signals); answered there → gone. Language-aware words ("fila" is a
    // queue in PT, a table row in ES; "cola" the reverse); a bugfix is never asked.
    const cp = aDir("nudge");
    S.initProject(cp, ["core"], "en");
    const cf = S.createFeature(cp, "Orders", ["core"]);
    fs.writeFileSync(path.join(cf.dir, "requirements.md"), REQ);
    // (A review 2: an answer counts anywhere in the design — this fixture's Constitution Check line "Idempotent writes" is one.)
    const noIdem = (t) => t.replace("Idempotent writes", "Small functions");
    wDesign(cf, noIdem(design("", "")));
    const n1 = S.clarify(cp, cf.slug);
    const n1Mcp = payload(await call("spec_clarify", { projectDir: cp, name: cf.slug }));
    wDesign(cf, design(ALT, RISKS));
    const n2 = S.clarify(cp, cf.slug);
    fs.writeFileSync(path.join(cf.dir, "requirements.md"), REQ.replace("warehouse queue", "warehouse queue, emit events, call a webhook and commit one transaction"));
    wDesign(cf, noIdem(design("", RISKS.replace("Idempotency key per order", "Manual review"))));
    const n3 = S.clarify(cp, cf.slug);
    const lp = (lang, name, body) => {
      const f = S.createFeature(cp, name, ["core"], "", undefined, lang);
      fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ.replace("hand the order to the warehouse queue", body));
      return S.clarify(cp, f.slug).nudges;
    };
    // (A review 7: one weak word never fires alone — each case pairs its queue word with an event.)
    const nPt = lp("pt", "Encomendas pt", "pôr a encomenda na fila do armazém e emitir um evento");
    const nEsRow = lp("es", "Filas es", "escribir cada fila del CSV y emitir un evento");
    const nEsQ = lp("es", "Cola es", "enviar el pedido a la cola del almacén y emitir un evento");
    const nBug = S.createFeature(cp, "Queue crash", ["tdd"], "", undefined, "en", "bugfix");
    fs.writeFileSync(path.join(nBug.dir, "requirements.md"), REQ);
    const nB = S.clarify(cp, nBug.slug);
    ok(js(n1.nudges) === js([{ code: "consistency-unstated", signals: ["queue", "retries"] }]) &&
      n1.questions.some((q) => /^The spec mentions 'queue', 'retries', but neither the requirements nor the design say anything about consistency or idempotency \(the answer goes in the design's Alternatives & Trade-offs \/ Risks, or in a requirement\)/.test(q)) &&
      js(n1Mcp.nudges) === js(n1.nudges) && n2.nudges === undefined && n3.nudges && n3.nudges[0].signals.length === 3 && js(n3.nudges[0].signals) === js(["queue", "events", "webhook"]) &&
      js(nPt) === js([{ code: "consistency-unstated", signals: ["fila", "evento"] }]) && nEsRow === undefined && js(nEsQ) === js([{ code: "consistency-unstated", signals: ["cola", "evento"] }]) &&
      nB.nudges === undefined,
      "1.17 A2: spec_clarify asks ONE consistency question (nudges consistency-unstated, ≤ 3 signals) when the spec names a queue / events / a transaction and neither the requirements nor the design answer it; answered → none; PT 'fila' + 'evento' fires, ES 'fila' (a row) + 'evento' doesn't (one concept), ES 'cola' + 'evento' does; a bugfix is never asked (got " +
      js([n1.nudges, n2.nudges, n3.nudges, nPt, nEsRow, nEsQ, nB.nudges]) + ")");

    // A2 / A3 — the prose: /grill's constraints round, the micro-cycle (spec-implementer, test-patterns, /executeTask, the superpowers
    // precedence row), the critic's trade-offs row, /design and SKILL.md — and none of the new text steers toward PRs or CI.
    const grill = aRd("commands", "grill.md"), impl = aRd("agents", "spec-implementer.md"), tpat = aRd("skills", "dev-spec-driven", "references", "test-patterns.md");
    const exec = aRd("commands", "executeTask.md"), sup = aRd("commands", "spec-superpowers.md"), critic = aRd("agents", "spec-critic.md"), dcmd = aRd("commands", "design.md");
    const skill = aRd("skills", "dev-spec-driven", "SKILL.md");
    const round = cut(grill, "**Constraints round**", "4. When you reach");
    const micro = cut(tpat, "## The micro-cycle inside a task", "## Anti-Patterns to Reject");
    const implCycle = cut(impl, "## The micro-cycle (tdd tasks)", "## Hard rules");
    const excuses = ["Too simple to test", "I'll test after", "Just this once", "keep the code as a reference", "Manual testing is enough", "TDD slows me down"];
    const flags = ["passed on its first run", "can't explain why it failed", "written after the code"];
    const newProse = [round, micro, implCycle, cut(dcmd, "**Every design weighs", "Re-read steering"), (critic.match(/^\| \*\*Trade-offs & risks\*\*.*$/m) || [""])[0]];
    ok(["Atomicity", "ACID and isolation", "isolation level", "Race conditions", "concurrently", "Consistency model", "Delivery and idempotency", "idempoten", "Dependency failure", "Volume and growth", "Business outcome", "Success Criterion"]
      .every((w) => round.includes(w)) && /\*\*Alternatives & Trade-offs\*\*/.test(round) &&
      /obra\/superpowers[^\n]*\n?[^\n]*\(MIT\)/.test(micro) && excuses.every((e) => micro.includes(e)) && flags.every((f) => micro.includes(f)) && /one\s+behaviour at a time/.test(micro) &&
      /deleted and redone/.test(micro) && /for the right reason/.test(micro) && /Refactor only on green/.test(micro) && /_Makes green:_/.test(micro) && /_Expect: fail_/.test(micro) &&
      /one behaviour at a time/.test(implCycle) && /obra\/superpowers/.test(implCycle) && /\(MIT\)/.test(implCycle) && /deleted and redone from the test/.test(implCycle) &&
      /Watch it fail for the right reason/.test(implCycle) && /Refactor only on green/.test(implCycle) && /No production code without a failing test first/.test(impl) &&
      /micro-cycle/.test(exec) && /deleted and redone/.test(exec) && /\| test-driven-development \| [^\n]*micro-cycle[^\n]*\|/.test(sup) &&
      /Trade-offs & risks/.test(critic) && /at least two REAL options/.test(critic) && /Alternatives & Trade-offs/.test(dcmd) && /\*\*Risks\*\*/.test(dcmd) &&
      /\*\*Alternatives & Trade-offs\*\*/.test(skill) && /design-tradeoffs/.test(skill) && /micro-cycle/.test(skill) && /constraints round/.test(skill) && skill.split(/\s+/).filter(Boolean).length <= 5000 &&
      newProse.every((t) => t.length > 50 && !/pull request|\bPRs?\b|\bCI\b/.test(t)),
      "1.17 A2 / A3: /grill has the constraints round (atomicity, ACID + isolation, races, consistency, delivery + idempotency, dependency failure, volume, a measurable outcome); the micro-cycle (credited to obra/superpowers, MIT) with its rationalizations and red flags is in test-patterns.md, spec-implementer.md and /executeTask; the superpowers row, the critic's trade-offs row, /design and SKILL.md (≤ 5,000 words — 1.21 F3) name them; no PR / CI steering in the new text (got " +
      js([newProse.map((t) => t.length), skill.split(/\s+/).filter(Boolean).length]) + ")");

    // 1.17 A review 1 — the nudge never reads the plugin's own template text: a pristine scaffold of every track (+saas's "Concurrent users …
    // queue strategy … (events+fields)", +sec's "record a security audit event") fires nothing in EN / PT / ES / pt-BR; a template criterion
    // KEPT as written beside the user's own queue is still template text (one concept — no nudge); rewritten by the user, its "event" counts.
    const rv1 = aDir("rv1");
    S.initProject(rv1, ["core"], "en");
    const rv1Fired = [];
    for (const lang of ["en", "pt", "es", "pt-BR"]) {
      [["core"], ["core", "tdd"], ["core", "saas"], ["core", "ai"], ["core", "sec"], ["core", "privacy"], ["core", "dist"], ["core", "tdd", "saas", "ai", "sec", "privacy"]].forEach((tr, i) => {
        const f = S.createFeature(rv1, `Pristine ${lang} ${i}`, tr, "", undefined, lang);
        const c = f.ok ? S.clarify(rv1, f.slug) : {};
        if (!f.ok || c.nudges !== undefined) rv1Fired.push([lang, tr.join("+"), f.ok, c.nudges]);
      });
    }
    const rv1Sec = S.createFeature(rv1, "Sec kept", ["core", "sec"]);
    const rv1Req = fs.readFileSync(path.join(rv1Sec.dir, "requirements.md"), "utf8");
    const rv1Block = rv1Req.slice(rv1Req.indexOf("#### [SEC]"), rv1Req.indexOf("\n\n", rv1Req.indexOf("**US-1.AC-12**")));
    fs.writeFileSync(path.join(rv1Sec.dir, "requirements.md"), REQ.replace("## Success Criteria", rv1Block + "\n\n## Success Criteria"));
    const rv1Kept = S.clarify(rv1, rv1Sec.slug).nudges;
    fs.writeFileSync(path.join(rv1Sec.dir, "requirements.md"), REQ.replace("## Success Criteria", rv1Block.replace("record a security audit event", "write an audit event to the security log") + "\n\n## Success Criteria"));
    const rv1Own = S.clarify(rv1, rv1Sec.slug).nudges;
    const rv1Demo = S.clarify(dm, "usage-metering").nudges;
    ok(!rv1Fired.length && /record a security audit event/.test(rv1Block) && rv1Kept === undefined &&
      js(rv1Own) === js([{ code: "consistency-unstated", signals: ["queue", "event"] }]) && rv1Demo === undefined,
      "1.17 A review 1: a pristine scaffold of every track (EN / PT / ES / pt-BR) never fires the nudge; +sec's template criterion kept as written is template text (no nudge beside one user queue), rewritten it counts (queue + event); the demo's usage-metering (+saas template lines) no longer fires (got " +
      js([rv1Fired, rv1Kept, rv1Own, rv1Demo]) + ")");

    // 1.17 A review 2 — the answer counts where /clarify and /grill put it: in requirements.md (the design still a template) or anywhere in
    // design.md (a "## Consistency" section, not only Alternatives & Trade-offs / Risks).
    const rv2 = aDir("rv2");
    S.initProject(rv2, ["core"], "en");
    const rv2F = S.createFeature(rv2, "Webhooks", ["core"]);
    const rv2Req = REQ.replace("hand the order to the warehouse queue", "send each order to the warehouse through a webhook");
    fs.writeFileSync(path.join(rv2F.dir, "requirements.md"), rv2Req);
    const rv2Asked = S.clarify(rv2, rv2F.slug).nudges;
    fs.writeFileSync(path.join(rv2F.dir, "requirements.md"), rv2Req.replace("## Out of Scope", "- **NFR-2** — Webhook deliveries are at-least-once: THE SYSTEM SHALL process each order idempotently (the order id is the idempotency key).\n\n## Out of Scope"));
    const rv2InReq = S.clarify(rv2, rv2F.slug).nudges;
    const rv2InReqMcp = payload(await call("spec_clarify", { projectDir: rv2, name: rv2F.slug })).nudges;
    fs.writeFileSync(path.join(rv2F.dir, "requirements.md"), rv2Req);
    wDesign(rv2F, "# Design: Webhooks\n\n## Overview\nOrders leave through a webhook.\n\n## Consistency\nAt-least-once delivery; the warehouse deduplicates by order id.\n\n## Constitution Check\n- [x] ok\n");
    const rv2InDesign = S.clarify(rv2, rv2F.slug).nudges;
    ok(js(rv2Asked) === js([{ code: "consistency-unstated", signals: ["webhook"] }]) && rv2InReq === undefined && rv2InReqMcp === undefined && rv2InDesign === undefined,
      "1.17 A review 2: the consistency answer clears the nudge in requirements.md (design.md still the template — MCP too) and in any design.md section (got " +
      js([rv2Asked, rv2InReq, rv2InReqMcp, rv2InDesign]) + ")");

    // 1.17 A review 3 — a design approved before 1.17 (no `weigh` stamp) is never flagged: a pass with a note; a 1.17 design approval is
    // stamped (approval + history record) and warns; spec_upgrade lists the two ids but never counts them toward `attention`.
    const rv3 = aDir("rv3");
    fs.cpSync(path.join(root, "examples", "demo-project"), rv3, { recursive: true });
    const rv3Design = path.join(rv3, ".specs", "api-keys", "design.md");
    const cutSec = (t, h) => { const a = t.indexOf(h); const b = t.indexOf("\n## ", a + 3); return t.slice(0, a) + t.slice(b + 1); };
    fs.writeFileSync(rv3Design, cutSec(cutSec(fs.readFileSync(rv3Design, "utf8"), "## Alternatives & Trade-offs"), "## Risks"));
    const rv3Legacy = S.specDoctor(rv3, "api-keys");
    const rv3Ap = S.approvePhase(rv3, "api-keys", "design", "t");
    const rv3St = JSON.parse(fs.readFileSync(path.join(rv3, ".specs", "api-keys", ".state.json"), "utf8"));
    const rv3Doc = S.specDoctor(rv3, "api-keys");
    const rv3Up = S.specUpgrade(rv3).features.find((x) => x.name === "api-keys");
    const W3 = require("./lib/i18n.js");
    ok(weigh(rv3Legacy) === "pass,pass" && /^design approved before 1\.17 — asked only from its next approval \(no Alternatives & Trade-offs section/.test(chk(rv3Legacy, "design-tradeoffs").detail) &&
      /^design approved before 1\.17/.test(chk(rv3Legacy, "design-risks").detail) &&
      rv3Ap.ok === true && rv3St.approvals.design.weigh === true && rv3St.approvalHistory[rv3St.approvalHistory.length - 1].weigh === true && rv3St.approvals.requirements.weigh === undefined &&
      weigh(rv3Doc) === "warn,warn" && js(rv3Up.doctor.warnings) === js(["design-tradeoffs", "design-risks", "design-reuse"]) && !rv3Up.attention.includes("warnings") && // (+ design-reuse, 1.19 R1)
      /^design aprovado antes da 1\.17 — só é exigido/.test(W3.msg("pt").designWeigh.legacyApproval("x")) && /^diseño aprobado antes de la 1\.17/.test(W3.msg("es").designWeigh.legacyApproval("x")) &&
      /^design aprovado antes da 1\.17/.test(W3.msg("pt-BR").designWeigh.legacyApproval("x")),
      "1.17 A review 3: a pre-1.17 design approval → design-tradeoffs / design-risks pass with 'approved before 1.17' (EN / PT / ES / pt-BR); a 1.17 design approval carries weigh: true (approval + history, not on other phases) and warns; spec_upgrade lists them under doctor.warnings without the 'warnings' attention (got " +
      js([weigh(rv3Legacy), chk(rv3Legacy, "design-tradeoffs").detail, rv3Ap.ok, rv3St.approvals.design.weigh, weigh(rv3Doc), rv3Up.doctor.warnings, rv3Up.attention]) + ")");

    // 1.17 A review 4 — the micro-cycle's red flags are scoped to a NEW behaviour's test; guard tests, characterization tests and a T-ID an
    // earlier task turned green are exempt everywhere the red flags are repeated (and bugfix.md / improvement-specs.md keep their rules).
    const agents = aRd("AGENTS.md"), bugRef = aRd("skills", "dev-spec-driven", "references", "bugfix.md"), impRef = aRd("skills", "dev-spec-driven", "references", "improvement-specs.md");
    const exempt = (t) => /guard\s+test/.test(t) && /characteri[sz]ation\s+tests?/.test(t) && /earlier\s+task\s+(?:already\s+)?turned\s+green/.test(t);
    const rv4 = [["test-patterns", exempt(micro) && /For the test of a NEW behaviour/.test(micro) && /Green on its first run is expected — not a red flag/.test(micro) && /\(bugfix\.md\)/.test(micro) && /\(improvement-specs\.md\)/.test(micro)],
      ["implementer", exempt(implCycle) && /for the test of a NEW behaviour/.test(implCycle) && /never make it fail artificially/.test(implCycle) && /a new behaviour's code/.test(impl)],
      ["executeTask", exempt(exec) && /red flags for a NEW behaviour's test/.test(exec)],
      ["AGENTS", /a new behaviour's test first/.test(agents) && /guard tests, characterization tests of existing code and T-IDs an earlier task turned green pass at once/.test(agents)],
      ["SKILL", /a new behaviour's test/.test(skill) && /guard \/ characterization tests and T-IDs an earlier task turned green pass at once/.test(skill) && skill.split(/\s+/).filter(Boolean).length <= 5000],
      ["refs", /Never make a guard test fail\s+artificially/.test(bugRef) && /characterization tests → refactor →\s+tests still green/.test(impRef)]];
    ok(rv4.every((x) => x[1]),
      "1.17 A review 4: the red flags ('passed on its first run', 'written after the code') apply to a NEW behaviour's test — guard / characterization tests and T-IDs already green are exempt in test-patterns.md, spec-implementer.md, /executeTask, AGENTS.md and SKILL.md (≤ 5,000 words — 1.21 F3) (got " +
      js(rv4.filter((x) => !x[1]).map((x) => x[0])) + ")");

    // 1.17 A review 5 — the reviewer's untested-behaviour rule counts the target T-IDs (committed in Phase 4, outside the task's diff).
    const reviewer = aRd("agents", "spec-reviewer.md");
    ok(/Production behaviour in the diff that no test\s+exercises \(a target T-ID — committed in Phase 4, so usually not in this diff — or a helper test in the diff\) is\s+\*\*Important\*\*/.test(reviewer) &&
      !/that no test in it exercises/.test(reviewer) && /never\s+a finding/.test(reviewer),
      "1.17 A review 5: spec-reviewer flags production behaviour no test exercises (a target T-ID or a helper test in the diff) — never 'no test in the diff'; a guard / characterization / already-green T-ID showing no RED is never a finding (got " +
      js((reviewer.match(/Production behaviour[^\n]*\n[^\n]*\n[^\n]*/) || [""])[0]) + ")");

    // 1.17 A review 6 — headings NAME the section (whole heading or a separator / connector after the synonym); the new synonyms; a plain
    // "Decisions" (the imports' decision log) is not one; 2–3-space bullets and bold-led options count; a header-only Risks table is empty,
    // a bare TODO a template; a trade-offs section with no option list passes on a written sentence ("no key decision").
    const rv6 = aDir("rv6");
    S.initProject(rv6, ["core"], "en");
    const rv6F = S.createFeature(rv6, "Weigh", ["core"]);
    fs.writeFileSync(path.join(rv6F.dir, "requirements.md"), REQ);
    const rv6W = (alt, risks) => { wDesign(rv6F, design(alt, risks)); const d = S.specDoctor(rv6, rv6F.slug); return [chk(d, "design-tradeoffs"), chk(d, "design-risks")].map((c) => c.status + ":" + String(c.detail).split(" — ")[0]).join(" | "); };
    const two = "- Option A\n- Option B\n\n", riskOk = "## Risks\n- outage — low\n\n";
    const rv6Got = {
      riskBased: rv6W("## Alternatives\n" + two, "## Risk-based rate limiting\n- buckets per risk score\n\n"),
      tradeoffAnalysis: rv6W("## Trade-off analysis\n" + two, riskOk),
      tradeoffs: rv6W("## Tradeoffs\n" + two, riskOk),
      madr: rv6W("## Considered Options\n" + two, riskOk),
      keyDecisions: rv6W("## Key Decisions\n" + two, riskOk),
      designDecisions: rv6W("## Design Decisions\n" + two, riskOk),
      plainDecisions: rv6W("## Decisions\n" + two, riskOk),
      esCompromisos: rv6W("## Compromisos\n" + two, "## Riesgos y mitigaciones\n- caída — baja\n\n"),
      esOpciones: rv6W("## Opciones\n" + two, riskOk),
      ptDecisoes: rv6W("## Decisões e alternativas\n" + two, "## Riscos\n- falha — baixa\n\n"),
      indented: rv6W("## Alternatives\n  - Option A\n    - pro: known\n    - con: ops\n  - Option B\n\n", "## Risks\n   - outage — low\n\n"),
      bold: rv6W("## Alternatives\n**Option A — Postgres.** Known, but one more server.\n\n**Option B — SQLite.** Simple, single writer.\n\n", riskOk),
      riskHeaderOnly: rv6W("## Alternatives\n" + two, "## Risks\n| Risk | Likelihood | Impact |\n|---|---|---|\n\n"),
      riskTodo: rv6W("## Alternatives\n" + two, "## Risks\nTODO\n\n"),
      noKeyDecision: rv6W("## Alternatives & Trade-offs\nNo key decision here: the feature only reads existing data.\n\n", riskOk),
      oneWord: rv6W("## Alternatives & Trade-offs\nNone.\n\n", riskOk),
    };
    const P2 = "pass:2 option(s) weighed | pass:1 risk(s) listed";
    ok(rv6Got.riskBased === "pass:2 option(s) weighed | warn:no Risks section" &&
      ["tradeoffAnalysis", "tradeoffs", "madr", "keyDecisions", "designDecisions", "esCompromisos", "esOpciones", "ptDecisoes", "indented", "bold"].every((k) => rv6Got[k] === P2) &&
      rv6Got.plainDecisions === "warn:no Alternatives & Trade-offs section | pass:1 risk(s) listed" &&
      rv6Got.riskHeaderOnly === "pass:2 option(s) weighed | warn:Risks is empty" && rv6Got.riskTodo === "pass:2 option(s) weighed | warn:Risks is still the template" &&
      rv6Got.noKeyDecision === "pass:written as prose (no option list | pass:1 risk(s) listed" && /^warn:Alternatives & Trade-offs lists 0 option\(s\)/.test(rv6Got.oneWord),
      "1.17 A review 6: 'Risk-based rate limiting' is no Risks section; Trade-off analysis / Tradeoffs / Considered Options / Key & Design Decisions / Compromisos / Opciones / Decisões e alternativas are, a plain 'Decisions' isn't; 2–3-space bullets (nested pros / cons not counted) and bold-led options count; a header-only Risks table is empty, a bare TODO a template; 'No key decision here: …' passes as prose, 'None.' doesn't (got " +
      js(rv6Got) + ")");

    // 1.17 A review 7 — one weak word never fires ("click event", "Retry button", "Images load async", "transactions"); two concepts or one
    // strong phrase do (EN / PT / ES); the answer is a multi-word phrase — "consistent UI styling", "eventually add caching", "atomic design",
    // "tenant isolation" answer nothing, PT "consistência eventual" / ES "al menos una vez" do.
    const rv7 = aDir("rv7");
    S.initProject(rv7, ["core"], "en");
    const rv7N = (lang, body, designText) => {
      const f = S.createFeature(rv7, "N " + lang + " " + (rv7N.n = (rv7N.n || 0) + 1), ["core"], "", undefined, lang);
      fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ.replace("hand the order to the warehouse queue", body));
      if (designText) wDesign(f, noIdem(design(designText, "")));
      const n = S.clarify(rv7, f.slug).nudges;
      return n ? n[0].signals : null;
    };
    const rv7Got = {
      click: rv7N("en", "open the menu on a click event"), retry: rv7N("en", "show a Retry button"), async: rv7N("en", "load images async"),
      statement: rv7N("en", "list the transactions of the month"), twoWeak: rv7N("en", "queue the order and emit an event"),
      strongPublish: rv7N("en", "publish an OrderPlaced event"), strongJob: rv7N("en", "run the export as a background job"),
      ptStrong: rv7N("pt", "pôr a encomenda na fila de mensagens"), esStrong: rv7N("es", "enviar el pedido a la cola de mensajes"),
      falseUi: rv7N("en", "call the warehouse webhook", "## Alternatives\n- A: consistent UI styling\n- B: custom styling\n\n"),
      falseEventually: rv7N("en", "call the warehouse webhook", "## Alternatives\n- A: we will eventually add caching\n- B: no cache\n\n"),
      falseAtomic: rv7N("en", "call the warehouse webhook", "## Alternatives\n- A: atomic design components\n- B: plain components\n\n"),
      falseTenant: rv7N("en", "call the warehouse webhook", "## Alternatives\n- A: tenant isolation by schema\n- B: by row\n\n"),
      ptAnswer: rv7N("pt", "pôr a encomenda na fila de mensagens, com consistência eventual"), esAnswer: rv7N("es", "enviar el pedido a la cola de mensajes al menos una vez"),
    };
    ok(rv7Got.click === null && rv7Got.retry === null && rv7Got.async === null && rv7Got.statement === null && js(rv7Got.twoWeak) === js(["queue", "event"]) &&
      js(rv7Got.strongPublish) === js(["publish an orderplaced event"]) && js(rv7Got.strongJob) === js(["background job"]) &&
      js(rv7Got.ptStrong) === js(["fila de mensagens"]) && js(rv7Got.esStrong) === js(["cola de mensajes"]) &&
      ["falseUi", "falseEventually", "falseAtomic", "falseTenant"].every((k) => Array.isArray(rv7Got[k]) && rv7Got[k][0] === "webhook") && rv7Got.ptAnswer === null && rv7Got.esAnswer === null,
      "1.17 A review 7: a single weak word never fires; two concepts or one strong phrase (publish … event, background job, fila de mensagens, cola de mensajes) do; 'consistent UI', 'eventually', 'atomic design', 'tenant isolation' answer nothing, 'consistência eventual' / 'al menos una vez' do (got " +
      js(rv7Got) + ")");
  }
};
