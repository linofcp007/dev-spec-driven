"use strict";
// Gates — the critical-flow warns (1.33): doctor's critical-flows (the design) and critical-flow-tests (the test plan), never an approval check; the `critical` stamp.

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, all, remeasure, rpc, payload, S, root, tmp, approveBefore, handRoadmap }) => {
  const js = JSON.stringify;
  const E = require(path.join(root, "mcp", "lib", "engine", "index.js"));
  const call = (name, args) => rpc("tools/call", { name, arguments: args });
  const chk = (d, id) => (d.checks || []).find((c) => c.id === id) || null;
  const view = (d, id) => { const c = chk(d, id); return c ? c.status + ": " + c.detail : "-"; };
  const wr = (f, n, t) => fs.writeFileSync(path.join(f.dir, n), t);
  const stateOf = (f) => JSON.parse(fs.readFileSync(path.join(f.dir, ".state.json"), "utf8"));
  const unstamp = (f, phase) => { const st = stateOf(f); delete st.approvals[phase].critical; fs.writeFileSync(path.join(f.dir, ".state.json"), JSON.stringify(st, null, 2)); };
  const REQ = (own = " on my own orders") => "# Feature: Discounts\n\n## Summary\nDiscounts for buyers.\n\n## User Stories\n### US-1 (P1): Discount\nAs a buyer I want a discount" + own + ".\n" +
    "**Independent Test:** get one.\n\n#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the buyer enters a coupon code at checkout THE SYSTEM SHALL apply the discount once.\n" +
    "2. **US-1.AC-2** — IF the code is expired THEN THE SYSTEM SHALL reject it.\n\n## Success Criteria\n- **SC-001** — 95% applied in under 1 s.\n\n" +
    "## Edge Cases & Error Handling\n- **EC-1** — WHEN the code is unknown THE SYSTEM SHALL say so.\n\n## Non-Functional Requirements\n- **NFR-1** — p95 < 1 s.\n\n## Out of Scope\n- Gift cards.\n";
  const DESIGN = (extra = "") => "# Design: Discounts\n\n## Overview\nThe till applies a discount code.\n\n## Architecture\n```mermaid\ngraph TD\n  A[Till] --> C[Codes]\n```\n\n" +
    "## Reuse & Integration\n- Reuse the cart service (src/cart.js).\n\n## Alternatives & Trade-offs\n- A: validate in the cart\n- B: validate at the till\n\n" +
    "## Data Models\nCode {code, max_uses, used}.\n\n" + extra + "## Risks\n- Abuse — low — a rate limit.\n\n## Constitution Check\n- [x] Small functions — complies.\n";
  const project = (name) => { const p = path.join(tmp, name); S.initProject(p, ["core", "tdd"], "en"); handRoadmap(p); return p; };
  const designed = (p, name, tracks, o = {}) => {
    const f = S.createFeature(p, name, tracks, "", undefined, o.lang || "en", o.kind, o.size ? { size: o.size } : undefined);
    wr(f, "requirements.md", o.req || REQ());
    approveBefore(p, f.slug, "design");
    wr(f, "design.md", o.design || DESIGN());
    return f;
  };

  { // critical-flows: a WARN while neither the requirements nor the design answer the race — never refused by the design approval,
    // which stamps `critical: true` (approval + history record); answered by a phrase or a written Critical flows section; a design
    // approved before 1.33 (no stamp) passes with a note; MCP's spec_doctor says the same.
    const p = project("cf-design");
    const f = designed(p, "Discounts", ["core", "tdd"]);
    const open = S.specDoctor(p, f.slug);
    const openMcp = payload(await call("spec_doctor", { projectDir: p, name: f.slug }));
    const ap = S.approvePhase(p, f.slug, "design", "t");
    const st = stateOf(f);
    const after = S.specDoctor(p, f.slug);
    unstamp(f, "design");
    const legacy = S.specDoctor(p, f.slug);
    wr(f, "design.md", DESIGN("## Critical flows\nA unique constraint on (code, buyer_id) makes a second redemption fail; `UPDATE codes SET used = used + 1 WHERE code = $1 AND used < max_uses` checks the affected rows.\n\n"));
    const answered = S.specDoctor(p, f.slug);
    wr(f, "design.md", DESIGN("## Critical flows\nNone: the discount is computed at read time and nothing is stored.\n\n"));
    const section = S.specDoctor(p, f.slug);
    const { CHECK_PHASE, GATES } = E;
    const probes = Object.values(GATES).filter((g) => g.probes).flatMap((g) => [g.probes({ kind: "feature", testsTdd: true, testsAi: true }), g.probes({ kind: "bugfix" })]).flat();
    all("1.33 critical-flows: a design naming a critical flow (coupon, checkout) with no database rule warns — never a fail, the design approval goes through unforced and stamps critical: true (approval + record); a design approved before 1.33 passes with a note; a unique constraint / conditional update answers it, so does a written Critical flows section; MCP alike (got " +
      js({ open: view(open, "critical-flows"), ap: [ap.ok, ap.forced, ap.failing], after: view(after, "critical-flows"), legacy: view(legacy, "critical-flows"), answered: view(answered, "critical-flows"), section: view(section, "critical-flows") }) + ")", {
      open: () => /^warn: the spec names a critical flow \('coupon', 'checkout'\) but neither the requirements nor the design say what two identical requests at once do — settle it in the database/.test(view(open, "critical-flows")) &&
        /references\/critical-flows\.md/.test(view(open, "critical-flows")),
      mcp: () => js(chk(openMcp, "critical-flows")) === js(chk(open, "critical-flows")),
      neverAGate: () => ap.ok === true && !ap.forced && !(ap.failing || []).includes("critical-flows"),
      stamped: () => st.approvals.design.critical === true && st.approvalHistory[st.approvalHistory.length - 1].critical === true && st.approvals.requirements.critical === undefined,
      stillWarns: () => /^warn: the spec names a critical flow/.test(view(after, "critical-flows")),
      legacy: () => /^pass: design approved before 1\.33 — asked only from its next approval \(the spec names a critical flow/.test(view(legacy, "critical-flows")),
      answered: () => view(answered, "critical-flows") === "pass: critical flow ('coupon', 'checkout') — the spec says what two identical requests at once do",
      section: () => view(section, "critical-flows") === "pass: critical flow ('coupon', 'checkout') — answered in the design's Critical flows section",
      registry: () => CHECK_PHASE["critical-flows"] === 2 && CHECK_PHASE["critical-flow-tests"] === 3 && !probes.some((x) => /^critical-flow/.test(x)),
      afterDesignWeigh: () => open.checks.findIndex((c) => c.id === "critical-flows") === open.checks.findIndex((c) => c.id === "design-reuse") + 1,
    });
  }

  { // critical-flow-tests: the test plan's rows (lines holding a T-ID) need a repetition row and — the spec being about the user's own
    // data — another user's access; the template's Strategy comment ("twice, and two at once") is no row; a stamped test-plan
    // approval keeps the warn, one approved before 1.33 passes with a note.
    const p = project("cf-plan");
    const f = designed(p, "Discounts", ["core", "tdd"], { design: DESIGN("## Critical flows\nA unique constraint on (code, buyer_id).\n\n") });
    S.approvePhase(p, f.slug, "design", "t");
    const fresh = fs.readFileSync(path.join(f.dir, "test-plan.md"), "utf8");
    const head = fresh.slice(0, fresh.indexOf("| Test ID")).replace(/\[\]/g, "set");
    const row = (id, desc) => `| ${id} | integration | example | ${desc} | US-1.AC-1 | \`test/codes.test.js\` |\n`;
    const plan = (...rows) => head + "| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---|---|---|---|---|---|\n" + row("T-01", "a valid code applies the discount") +
      row("T-02", "an expired code is rejected").replace("US-1.AC-1", "US-1.AC-2") + rows.join("") + "\n## Coverage Check\nEvery AC covered.\n";
    wr(f, "test-plan.md", plan());
    const none = S.specDoctor(p, f.slug);
    wr(f, "test-plan.md", plan(row("T-03", "the same code redeemed twice, and two at once: one discount")));
    const rep = S.specDoctor(p, f.slug);
    wr(f, "test-plan.md", plan(row("T-03", "the same code redeemed twice, and two at once: one discount"), row("T-04", "user B cannot redeem user A's single-use code")));
    const both = S.specDoctor(p, f.slug);
    const ap = S.approvePhase(p, f.slug, "test-plan", "t");
    const stamped = stateOf(f).approvals["test-plan"].critical === true;
    wr(f, "test-plan.md", plan(row("T-03", "the same code redeemed twice, and two at once: one discount")));
    const afterEdit = S.specDoctor(p, f.slug);
    unstamp(f, "test-plan");
    const legacy = S.specDoctor(p, f.slug);
    // the requirements say nothing about own data: the repetition row alone is enough
    const g = designed(p, "Codes", ["core", "tdd"], { req: REQ(""), design: DESIGN("## Critical flows\nA unique constraint on (code, buyer_id).\n\n") });
    const gHead = fs.readFileSync(path.join(g.dir, "test-plan.md"), "utf8");
    wr(g, "test-plan.md", gHead.slice(0, gHead.indexOf("| Test ID")).replace(/\[\]/g, "set") + "| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---|---|---|---|---|---|\n" +
      row("T-01", "two requests at once (Promise.all): exactly one redemption") + row("T-02", "an expired code is rejected").replace("US-1.AC-1", "US-1.AC-2"));
    const noOwn = S.specDoctor(p, g.slug);
    all("1.33 critical-flow-tests: the plan of a critical flow warns until it has a repetition row (twice / two at once) and, the spec being about the user's own data, a row for another user's access — the template's guidance comment is no row; never refused by the test-plan approval, which stamps critical: true; edited after it the warn returns; approved before 1.33 → a pass with a note; no own data → the repetition row is enough (got " +
      js({ none: view(none, "critical-flow-tests"), rep: view(rep, "critical-flow-tests"), both: view(both, "critical-flow-tests"), ap: [ap.ok, ap.failing], afterEdit: view(afterEdit, "critical-flow-tests"), legacy: view(legacy, "critical-flow-tests"), noOwn: view(noOwn, "critical-flow-tests") }) + ")", {
      commentIsNoRow: () => /twice, and two at once/.test(head) && /^warn: critical flow \('coupon', 'checkout'\) — the test plan lacks a repetition row \(the same request twice, and two at once: one effect\); a row for another user's data \(refused, nothing changed\): integration tests on the real route against a separate test database, never production/.test(view(none, "critical-flow-tests")),
      repetitionOnly: () => /^warn: critical flow \('coupon', 'checkout'\) — the test plan lacks a row for another user's data/.test(view(rep, "critical-flow-tests")),
      both: () => /^pass: critical flow \('coupon', 'checkout'\) — the test plan repeats the request/.test(view(both, "critical-flow-tests")),
      neverAGate: () => ap.ok === true && !ap.forced && stamped,
      afterEdit: () => /^warn: critical flow/.test(view(afterEdit, "critical-flow-tests")),
      legacy: () => /^pass: test plan approved before 1\.33 — asked only from its next approval \(critical flow/.test(view(legacy, "critical-flow-tests")),
      noOwn: () => /^pass: /.test(view(noOwn, "critical-flow-tests")),
    });
  }

  { // The skips: +dist / +api (their sections ask it), a bugfix, a design still a later phase's template, a feature naming no flow; the
    // details in the feature's language (PT / ES / pt-BR).
    const p = project("cf-skips");
    const dist = designed(p, "Dist", ["core", "tdd", "dist"]);
    const api = designed(p, "Api", ["core", "tdd", "api"]);
    const bug = S.createFeature(p, "Double discount", ["tdd"], "", undefined, "en", "bugfix");
    wr(bug, "requirements.md", REQ());
    wr(bug, "design.md", DESIGN());
    const fresh = S.createFeature(p, "Fresh", ["core", "tdd"]);
    wr(fresh, "requirements.md", REQ() + "\n## Notes\n> **TODO**\n"); // requirements still the current phase: design.md a LATER template
    const plain = designed(p, "Plain", ["core", "tdd"], { req: REQ().split("coupon code at checkout").join("name").split("discount").join("greeting"),
      design: DESIGN().split("discount code").join("greeting") }); // ("a discount code" is a coupon: a signal)
    const PT_REQ = "# Funcionalidade: Descontos\n\n## Resumo\nDescontos.\n\n## Histórias\n### US-1 (P1): Desconto\nComo comprador quero um desconto.\n\n#### Critérios de Aceitação (EARS)\n1. **US-1.AC-1** — QUANDO o comprador aplica um cupão O SISTEMA DEVE dar o desconto uma vez.\n";
    const ES_REQ = "# Función: Descuentos\n\n## Resumen\nDescuentos.\n\n## Historias\n### US-1 (P1): Descuento\nComo comprador quiero un descuento.\n\n#### Criterios de Aceptación (EARS)\n1. **US-1.AC-1** — CUANDO el comprador canjea un cupón EL SISTEMA DEBE aplicar el descuento una vez.\n";
    const pt = designed(p, "Descontos", ["core", "tdd"], { lang: "pt", req: PT_REQ });
    const br = designed(p, "Descontos BR", ["core", "tdd"], { lang: "pt-BR", req: PT_REQ.replace("cupão", "cupom") });
    const es = designed(p, "Descuentos", ["core", "tdd"], { lang: "es", req: ES_REQ });
    const d = (f) => S.specDoctor(p, f.slug);
    const has = (f) => ["critical-flows", "critical-flow-tests"].filter((id) => chk(d(f), id));
    all("1.33 critical flows: no critical-flows / critical-flow-tests check with +dist or +api, on a bugfix, while design.md is still a later phase's template, or when the spec names no flow; PT / pt-BR / ES details in the feature's language (got " +
      js({ dist: has(dist), api: has(api), bug: has(bug), fresh: has(fresh), plain: has(plain), pt: view(d(pt), "critical-flows"), br: view(d(br), "critical-flows"), es: view(d(es), "critical-flows") }) + ")", {
      dist: () => !has(dist).length, api: () => !has(api).length, bugfix: () => !has(bug).length, fresh: () => !has(fresh).length, plain: () => !has(plain).length,
      pt: () => /^warn: a spec nomeia um fluxo crítico \('cupão'\) mas nem os requisitos nem o design dizem o que fazem dois pedidos idênticos em simultâneo — resolve-o na base de dados/.test(view(d(pt), "critical-flows")),
      ptBr: () => /^warn: a spec nomeia um fluxo crítico \('cupom'\) .* — resolva-o no banco de dados/.test(view(d(br), "critical-flows")),
      es: () => /^warn: la spec nombra un flujo crítico \('canjea'\) pero ni los requisitos ni el diseño dicen qué hacen dos peticiones idénticas a la vez/.test(view(d(es), "critical-flows")),
    });
  }

  { // 1.33 review: one question bank BY SIZE — +api's Pagination, Idempotency & Concurrency and +dist's Concurrency are tier
    // "extended": a size-s scaffold leaves them out, so nothing else asks the question there and the critical-flow checks (and the
    // nudge) run; a size-s design that holds the section anyway, and a size-m / unsized feature, keep the skip.
    const p = project("cf-sizes");
    const sApi = designed(p, "Api s", ["core", "tdd", "api"], { size: "s" });
    const sDist = designed(p, "Dist s", ["core", "tdd", "dist"], { size: "s" });
    const mApi = designed(p, "Api m", ["core", "tdd", "api"], { size: "m" });
    const mDist = designed(p, "Dist m", ["core", "tdd", "dist"], { size: "m" });
    const kept = designed(p, "Api s kept", ["core", "tdd", "api"], { size: "s",
      design: DESIGN("## [API] Pagination, Idempotency & Concurrency\nCursor pagination on the list of codes.\n\n") });
    const keptDist = designed(p, "Dist s kept", ["core", "tdd", "dist"], { size: "s", design: DESIGN("## [DIST] Concurrency\nOne writer per code.\n\n") });
    const scaffold = (size) => { const f = S.createFeature(p, "Scaffold " + size, ["core", "tdd", "api", "dist"], "", undefined, "en", undefined, { size }); return fs.readFileSync(path.join(f.dir, "design.md"), "utf8"); };
    const sScaf = scaffold("s"), mScaf = scaffold("m");
    const d = (f) => S.specDoctor(p, f.slug);
    const has = (f) => ["critical-flows", "critical-flow-tests"].filter((id) => chk(d(f), id));
    const nudge = (f) => (S.clarify(p, f.slug).nudges || []).some((n) => n.code === "critical-flow-unstated");
    all("1.33 review (one question bank by size): a size-s core +api / +dist coupon feature — its scaffold has no Pagination, Idempotency & Concurrency / Concurrency section — is asked (critical-flows warns, clarify nudges); one whose design holds that section, and size m, are not (got " +
      js({ sApi: [has(sApi), nudge(sApi)], sDist: [has(sDist), nudge(sDist)], mApi: [has(mApi), nudge(mApi)], mDist: [has(mDist), nudge(mDist)], kept: has(kept), keptDist: has(keptDist) }) + ")", {
      scaffoldS: () => !/^## \[API\] Pagination, Idempotency & Concurrency$/m.test(sScaf) && !/^## \[DIST\] Concurrency$/m.test(sScaf),
      scaffoldM: () => /^## \[API\] Pagination, Idempotency & Concurrency$/m.test(mScaf) && /^## \[DIST\] Concurrency$/m.test(mScaf),
      apiS: () => has(sApi).includes("critical-flows") && /^warn: the spec names a critical flow/.test(view(d(sApi), "critical-flows")) && nudge(sApi),
      distS: () => has(sDist).includes("critical-flows") && nudge(sDist),
      apiM: () => !has(mApi).length && !nudge(mApi), distM: () => !has(mDist).length && !nudge(mDist),
      keptSection: () => !has(kept).length && !nudge(kept) && !has(keptDist).length,
    });
  }

  { // 1.33 review: critical-flow-tests reads the plan's OWN rows — the scaffold's (+ui's "an error with Retry", +data's "re-run … twice
    // … no duplicate", +sec's "user B never reads user A's resource") never answer it, in EN / PT / ES / pt-BR; a bare retry is
    // retry-on-failure, not the same request twice; twice / again with the same / two at once / duplicate (PT / ES too) are.
    const I = require(path.join(root, "mcp", "lib", "i18n.js"));
    const ALL = ["core", "tdd", "saas", "ai", "sec", "privacy", "ui", "obs", "data"]; // (+dist / +api: their sections ask it)
    const st = { signals: ["coupon"], answered: false, user: "As a buyer I want a discount on my own orders." };
    const check = (plan, lang = "en") => E.criticalFlowCheck("test-plan", st, lang, { plan });
    const row = (id, desc) => `| ${id} | integration | example | ${desc} | US-1.AC-1 | \`tests/codes.test.js\` |\n`;
    const tpl = (lang) => I.testPlan("x", lang, ALL);
    const gaps = (r) => (r.status === "pass" ? "pass" : ["repetition row", "another user's data", "linha de repetição", "outro utilizador", "outro usuário", "fila de repetición", "otro usuario"].filter((w) => r.detail.includes(w)).join("+"));
    const got = {
      templates: ["en", "pt", "es", "pt-BR"].map((l) => [l, check(tpl(l), l).status, gaps(check(tpl(l), l))]),
      twice: gaps(check(tpl("en") + row("T-90", "the same code redeemed twice"))),
      retry: gaps(check(tpl("en") + row("T-90", "the redemption retries after a gateway timeout"))),
      again: gaps(check(tpl("en") + row("T-90", "sent again with the same Idempotency-Key: one discount"))),
      atOnce: gaps(check(tpl("en") + row("T-90", "two buyers at once on the last code") + row("T-91", "user B cannot redeem user A's code"))),
      pt: gaps(check(tpl("pt") + row("T-90", "o mesmo cupão aplicado duas vezes") + row("T-91", "outro utilizador não usa o cupão"), "pt")),
      ptRetry: gaps(check(tpl("pt") + row("T-90", "nova tentativa após um timeout"), "pt")),
      es: gaps(check(tpl("es") + row("T-90", "el mismo cupón canjeado dos veces") + row("T-91", "otro usuario no lo canjea"), "es")),
    };
    all("1.33 review: critical-flow-tests never reads the scaffold's rows (a full track combination's template plan lacks both rows — EN / PT / ES / pt-BR); a bare retry is no repetition, twice / again with the same / two at once are (PT / ES too) (got " + js(got) + ")", {
      templates: () => got.templates.every(([, s, g]) => s === "warn" && g.split("+").length === 2),
      twice: () => got.twice === "another user's data", retry: () => got.retry === "repetition row+another user's data",
      again: () => got.again === "another user's data", atOnce: () => got.atOnce === "pass",
      pt: () => got.pt === "pass", ptRetry: () => got.ptRetry === "linha de repetição+outro utilizador", es: () => got.es === "pass",
    });

    // 1.33 review 2: a template row the user EDITED is the user's (a cell is template text only when it equals a template cell —
    // sectionOwnLines' rule): +dist's "delivered twice" and +sec's "user B never reads user A's" rows, extended, answer; verbatim they
    // don't. A retried / redelivered / replayed webhook or event IS the same request again (the clarify question's "a retried
    // webhook"); a Retry button or a retry after a failure is not. EN / PT (both genders) / ES.
    const ownMine = tpl("en") + row("T-90", "the same message delivered twice (or N times) has exactly one effect — for the coupon webhook") +
      row("T-91", "abuse case: user B never reads user A's resource (403 + audit event) — the coupon endpoint");
    const ownTpl = tpl("en") + I.testPlan("x", "en", ["core", "tdd", "dist"]).split("\n").filter((l) => /delivered twice/.test(l)).join("\n") + "\n";
    const rep = (desc, lang = "en") => gaps(check(tpl(lang) + row("T-90", desc) + row("T-91", "user B cannot redeem user A's code"), lang)) === "pass";
    const YES = [["the redemption request repeated: one discount"], ["two buyers press Pay at the same time"], ["two requests in the same millisecond"],
      ["two identical requests: one charge"], ["the redelivered event has no second effect"], ["a resubmitted form: one order"], ["the replayed webhook is ignored"],
      ["the webhook is retried by the gateway: one effect"], ["a retried webhook: one effect"], ["o pedido repetido não dá dois descontos", "pt"],
      ["a mensagem repetida tem um só efeito", "pt"], ["o webhook reenviado é ignorado", "pt"], ["com a mesma chave: um só pagamento", "pt"],
      ["dois pedidos no mesmo milissegundo", "pt"], ["la petición repetida no aplica dos descuentos", "es"], ["el webhook reenviado se ignora", "es"],
      ["con la misma clave: un solo pago", "es"], ["dois compradores pagam ao mesmo tempo", "pt"], ["dos compradores pagan al mismo tiempo", "es"],
      // (1.33 review 4: a provider's retry of a received webhook / event / a payment is a redelivery, after a failure or not; a repeated
      // button press / link click is a double click; PT / ES repetido(a) beyond a password field; a wider window before "at the same time")
      ["the payment webhook is retried after a 500 and applies once"], ["the webhook is retried once more: one effect"], ["the webhook is retried after a timeout"],
      ["the repeated button press creates one order"], ["the repeated link click is idempotent"], ["o código repetido é rejeitado", "pt"], ["clave repetida: un solo pago", "es"],
      ["two sessions decrement the stock at the same time"], ["the same coupon redeemed by Alice and Bob at the same time"],
      // (review 5: each language's own number word and phrase)
      ["dos usuarios canjean el cupón a la vez", "es"], ["duas sessões debitam o saldo ao mesmo tempo", "pt"], ["both tabs submit the order at the same time"],
      ["3 requests at the same time: one charge"],
      // (review 6: a quantity, then an action verb within three words — any actor —; ES envían with its accent)
      ["both admins approve the refund at the same time"], ["two drivers accept the same ride at the same time"], ["two replicas consume the message at the same time"],
      ["2 pods process the job at the same time"], ["dois administradores aprovam o reembolso ao mesmo tempo", "pt"],
      ["dos administradores aprueban el reembolso al mismo tiempo", "es"], ["Ana y Luis envían el pago al mismo tiempo", "es"],
      // (review 7: the phrase first, then the quantity; ES cajeros)
      ["at the same time, two users redeem the same coupon"], ["ao mesmo tempo, dois clientes pagam a encomenda", "pt"],
      ["al mismo tiempo, dos cajeros cobran la venta", "es"], ["dos cajeros al mismo tiempo: un solo cobro", "es"]];
    // (1.33 review 3 / 4: a repeated / repetida password field, a Resubmit button, a render "at the same time", notifications retried after a
    // failure)
    const NO = [["the Retry button reloads the list"], ["retries after a gateway timeout"], ["the repeat password field must match"], ["nova tentativa após um timeout", "pt"],
      ["the repeated password field must match"], ["senha repetida deve coincidir", "pt"], ["la contraseña repetida debe coincidir", "es"],
      ["the list and the badge render at the same time"], ["a lista e o ícone aparecem ao mesmo tempo", "pt"], ["la lista y el icono se muestran a la vez", "es"],
      ["a Resubmit button shows after a validation error"], ["notifications are retried after the provider fails"],
      ["the toast and the redirect happen at the same time"], ["users see the list and the badge at the same time"], ["the order summary and the total show at the same time"],
      ["payments page and the receipt load at the same time"], ["os clientes veem o total e o desconto ao mesmo tempo", "pt"],
      // (1.33 review 5: PT "dos" is "of the", never ES's two; "both" / a number quantifying UI parts, not requests or actors; a repeated
      // form field)
      ["o carregamento dos saldos e do histórico ao mesmo tempo", "pt"], ["a lista dos produtos e o contador atualizam ao mesmo tempo", "pt"],
      ["both the list and the badge render at the same time"], ["the header and 3 widgets render at the same time"], ["a repeated field is highlighted"],
      ["o campo repetido fica destacado", "pt"],
      // (review 6: a step number is no quantity)
      ["step 2 the user and the admin see the badge at the same time"], ["passo 2 o cliente e o administrador veem o aviso ao mesmo tempo", "pt"],
      ["paso 2 el cliente y el administrador ven el aviso al mismo tiempo", "es"],
      // (review 7: a quantity of UI / structural parts or of a unit, the digits of a time; a noun-like action alone — "the click")
      ["2 columns are edited at the same time"], ["both forms save the draft at the same time"], ["two filters apply at the same time"],
      ["2 panels handle the click at the same time"], ["3 steps process the data at the same time"], ["dos columnas procesan los datos al mismo tiempo", "es"],
      ["dois botões processam o pedido ao mesmo tempo", "pt"], ["at 10:00 the scheduler processes the queue at the same time"],
      ["the 2 MB upload is saved at the same time"], ["a reserva e o mapa carregam ao mesmo tempo", "pt"], ["el canje y el aviso aparecen a la vez", "es"]];
    const yesBad = YES.filter(([d, l]) => !rep(d, l)).map(([d]) => d), noBad = NO.filter(([d, l]) => rep(d, l)).map(([d]) => d);
    // (review 6 / 7: the step lookbehind before a quantity is bounded — read backwards over a run of hyphens it was quadratic in the
    // cell, 30 rows of 3,800 hyphens took 5 s; measured against a plan of the same size in two-letter words — a linear read)
    const hyPlan = (fill, n) => "# Test plan\n\n| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---|---|---|---|---|---|\n" +
      Array.from({ length: 30 }, (_, i) => row("T-" + (100 + i), "a" + fill.repeat(n) + " 2 x")).join("");
    const hyFast = (x) => x.big < Math.max(250, 4 * x.base);
    const hy = remeasure(() => {
      const t0 = Date.now(); check(hyPlan("-", 3800)); const big = Date.now() - t0;
      const t1 = Date.now(); check(hyPlan("x ", 1900)); return { big, base: Date.now() - t1 };
    }, hyFast);
    all("1.33 review 2: an edited template row is the user's (+dist's 'delivered twice … — for the coupon webhook', +sec's 'user B … — the coupon endpoint' answer; verbatim they don't); a repeated / redelivered / resubmitted / replayed / retried webhook, the same time / millisecond, identical requests, PT repetido(a) / reenviado / com a mesma chave, ES repetida / reenviado / con la misma clave count — a Retry button, a retry after a timeout, a repeat-password field don't; 30 rows of 3,800 hyphens stay linear (got " +
      js({ edited: gaps(check(ownMine)), verbatim: gaps(check(ownTpl)), yesBad, noBad, hyphens: { big: hy.big, base: hy.base, tries: hy.tries } }) + ")", {
      edited: () => gaps(check(ownMine)) === "pass", verbatim: () => gaps(check(ownTpl)) === "repetition row+another user's data",
      yes: () => !yesBad.length, no: () => !noBad.length, linear: () => hyFast(hy),
    });
  }

  { // 1.33 review 2: a track pack's test-plan rows and the project's own test-plan template are template text too (as the design check
    // reads glossProjectLines): verbatim they never answer, edited they do.
    const p = project("cf-packs");
    const pd = path.join(p, ".specs", "tracks", "hooks");
    fs.mkdirSync(pd, { recursive: true });
    fs.writeFileSync(path.join(pd, "track.json"), js({ name: "hooks", marker: "HOOKS", title: { en: "Webhooks" }, signals: { strong: ["webhook receiver"], weak: [] },
      sections: [{ name: "Receivers", guidance: "Which events, which signature check." }] }));
    fs.writeFileSync(path.join(pd, "test-plan.md"), "| Test ID | Layer | Kind | Description | Covers | File |\n|---|---|---|---|---|---|\n" +
      "| T-00 | integration | example | the same webhook delivered twice has one effect | {{ac1}} | `tests/hooks.test.js` |\n");
    fs.mkdirSync(path.join(p, ".specs", "templates"), { recursive: true });
    fs.writeFileSync(path.join(p, ".specs", "templates", "test-plan.md"), "# Test Plan: {{name}}\n\n| Test ID | Layer | Kind | Description | Covers | File |\n|---|---|---|---|---|---|\n" +
      "| T-01 | integration | example | the order is submitted twice: one order for {{name}} | {{acs}} | `tests/orders.test.js` |\n");
    const f = designed(p, "Discounts", ["core", "tdd", "hooks"], { design: DESIGN("## Critical flows\nA unique constraint on (code, buyer_id).\n\n") });
    const head = "# Test Plan: Discounts\n\n## Strategy\n- **Test runner:** node --test\n\n| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---|---|---|---|---|---|\n";
    const row = (id, desc) => `| ${id} | integration | example | ${desc} | US-1.AC-1 | \`tests/codes.test.js\` |\n`;
    const other = row("T-09", "user B cannot redeem user A's code");
    const plan = (r) => { wr(f, "test-plan.md", head + row("T-01", "a valid code applies the discount") + r + other); return view(S.specDoctor(p, f.slug), "critical-flow-tests"); };
    const got = {
      packVerbatim: plan(row("T-02", "the same webhook delivered twice has one effect")),
      packEdited: plan(row("T-02", "the same webhook delivered twice has one effect — the coupon webhook")),
      projectVerbatim: plan(row("T-02", "the order is submitted twice: one order for Discounts")),
      // (1.33 review 3: a template cell with a variable gives only its filled-in text — the user's words are what they added there)
      projectEdited: plan(row("T-02", "the order is submitted twice: one order for Discounts, two buyers at the same time")),
    };
    all("1.33 review 2: a track pack's test-plan row and the project's test-plan template row ({{name}} filled) are template text — verbatim the plan still lacks a repetition row; edited, they answer (got " + js(got) + ")", {
      packVerbatim: () => /^warn: critical flow .* lacks a repetition row/.test(got.packVerbatim), packEdited: () => /^pass: /.test(got.packEdited),
      projectVerbatim: () => /^warn: critical flow .* lacks a repetition row/.test(got.projectVerbatim), projectEdited: () => /^pass: /.test(got.projectEdited),
    });
  }

  { // 1.33 review 3: the template cells with variables go through the glossary's LINEAR wildcard (glossPatternSegs / glossSpans — never a
    // regex built from template text), and a matched cell gives only its filled-in values: (1) a value holding punctuation still matches
    // ({{acs}} = two ACs, a pack {{title}} "Webhooks (Stripe)", {{name}} "Checkout (v2)") — the verbatim rows stay template; (2) a
    // variable beside a short word ("{{name}} for {{acs}}", "Behavior of {{name}}") no longer swallows a real row — the text in its place
    // is the user's; (3) 4 variables over long cells stay linear. planFold folds _italic_ and a final period (a verbatim cell stays template).
    const p = project("cf-wild");
    const pd = path.join(p, ".specs", "tracks", "hooks");
    fs.mkdirSync(pd, { recursive: true });
    fs.writeFileSync(path.join(pd, "track.json"), js({ name: "hooks", marker: "HOOKS", title: { en: "Webhooks (Stripe)" }, signals: { strong: ["webhook receiver"], weak: [] },
      sections: [{ name: "Receivers", guidance: "Which events." }] }));
    fs.writeFileSync(path.join(pd, "test-plan.md"), "| Test ID | Layer | Kind | Description | Covers | File |\n|---|---|---|---|---|---|\n" +
      "| T-00 | integration | example | {{acs}} the same webhook delivered twice has one effect | {{acs}} | `tests/hooks.test.js` |\n" +
      "| T-00 | integration | example | {{title}}: the event delivered twice has one effect | {{acs}} | `tests/hooks.test.js` |\n" +
      "| T-00 | integration | example | the same callback delivered _twice_ has one effect. | {{acs}} | `tests/hooks.test.js` |\n");
    const tdir = path.join(p, ".specs", "templates");
    fs.mkdirSync(tdir, { recursive: true });
    const tplRows = (...descs) => fs.writeFileSync(path.join(tdir, "test-plan.md"), "# Test Plan: {{name}}\n\n| Test ID | Layer | Kind | Description | Covers | File |\n|---|---|---|---|---|---|\n" +
      descs.map((d, i) => `| T-0${i + 1} | integration | example | ${d} | {{acs}} | \`tests/{{slug}}.test.js\` |\n`).join(""));
    tplRows("the order is submitted twice: one order for {{name}}", "{{name}} for {{acs}}", "Behavior of {{name}}");
    const f = designed(p, "Discounts", ["core", "tdd", "hooks"], { design: DESIGN("## Critical flows\nA unique constraint on (code, buyer_id).\n\n") });
    const head = "# Test Plan: Discounts\n\n| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---|---|---|---|---|---|\n";
    const row = (id, desc) => `| ${id} | integration | example | ${desc} | US-1.AC-1 | \`tests/codes.test.js\` |\n`;
    const other = row("T-09", "user B cannot redeem user A's code");
    const plan = (...rows) => head + row("T-01", "a valid code applies the discount") + rows.join("") + other;
    const doc = (text) => { wr(f, "test-plan.md", text); return view(S.specDoctor(p, f.slug), "critical-flow-tests"); };
    const warn = (v) => /^warn: critical flow .* lacks a repetition row/.test(v), pass = (v) => /^pass: /.test(v);
    // (1.33 review 4: the feature's values are FILLED before a template cell is compared — {{name}} is the feature's own; a feature
    // named "Checkout (v2)" reads its punctuated name back from its artifacts' titles)
    const g = designed(p, "Checkout (v2)", ["core", "tdd", "hooks"], { design: DESIGN("## Critical flows\nA unique constraint on (code, buyer_id).\n\n") });
    const gDoc = (r) => { wr(g, "test-plan.md", head.replace("Discounts", "Checkout (v2)") + row("T-01", "a valid code applies the discount") + r + other); return view(S.specDoctor(p, g.slug), "critical-flow-tests"); };
    const got = {
      acs2: doc(plan(row("T-02", "US-1.AC-5, US-1.AC-6 the same webhook delivered twice has one effect"))),
      title: doc(plan(row("T-02", "Webhooks (Stripe): the event delivered twice has one effect"))),
      nameParens: gDoc(row("T-02", "the order is submitted twice: one order for Checkout (v2)")),
      otherName: doc(plan(row("T-02", "the order is submitted twice: one order for Checkout (v2)"))), // not this feature's name: edited — the user's
      folded: doc(plan(row("T-02", "the same callback delivered twice has one effect"))),
      forRow: doc(plan(row("T-02", "the same coupon redeemed twice for one buyer gives one discount"))),
      behaviorRow: doc(plan(row("T-02", "behavior of two buyers paying at the same time"))),
    };
    // (3) linear — the cell reaches glossSpans' indexOf loop: a pattern whose start and end literals match, three per-row variables between
    // literals the cell repeats 400 times (20 rows) — the per-variable lazy regex took 1.7 s a cell
    tplRows("t: {{acs}} then {{t1}} then {{tests}} done");
    const long = (i) => row("T-" + (20 + i), "t:" + " then".repeat(400) + " done");
    const s = remeasure(() => {
      const t0 = Date.now(); doc(plan()); const base = Date.now() - t0;
      const t1 = Date.now(); doc(plan(...Array.from({ length: 20 }, (_, i) => long(i)))); return { base, big: Date.now() - t1 };
    }, (x) => x.big < 5 * Math.max(x.base, 100) + 1500);
    all("1.33 review 3 / 4: template cells match through the glossary's linear wildcard once the feature's values are filled in — a punctuated value (two ACs, 'Webhooks (Stripe)', the feature's own 'Checkout (v2)') keeps a verbatim row template, another name is the user's edit, '{{name}} for {{acs}}' / 'Behavior of {{name}}' swallow no real row, _italic_ and a final period fold, 3 variables over 20 × 2,000 characters stay linear (got " +
      js({ got, timing: { base: s.base, big: s.big, tries: s.tries } }) + ")", {
      acs2: () => warn(got.acs2), title: () => warn(got.title), nameParens: () => warn(got.nameParens), otherName: () => pass(got.otherName), folded: () => warn(got.folded),
      forRow: () => pass(got.forRow), behaviorRow: () => pass(got.behaviorRow),
      linear: () => s.big < 5 * Math.max(s.base, 100) + 1500,
    });
  }

  { // 1.33 review 4: (A) only the Description column answers — its header found as the scaffold writes it (EN / PT / ES / pt-BR); the
    // File / Covers / Layer / Kind cells never do (a template's `tests/{{slug}}.test.js` beside a verbatim description made it pass); a
    // table without that header reads its cells but the IDs. (B) a feature NAMED after its race scaffolded from a project template row
    // "{{name}} happy path" keeps it template — the filled name supplies no repetition word. (C) a pack row opening with {{marker}} is
    // no slot. (D) a pattern with no literal at its start nor its end ("{{acs}} with {{t1}}") is dropped — it cut "with" out of real rows.
    const p = project("cf-desc");
    const pd = path.join(p, ".specs", "tracks", "hooks");
    fs.mkdirSync(pd, { recursive: true });
    fs.writeFileSync(path.join(pd, "track.json"), js({ name: "hooks", marker: "HOOKS", title: { en: "Webhooks" }, signals: { strong: ["webhook receiver"], weak: [] },
      sections: [{ name: "Receivers", guidance: "Which events." }] }));
    fs.writeFileSync(path.join(pd, "test-plan.md"), "| Test ID | Layer | Kind | Description | Covers | File |\n|---|---|---|---|---|---|\n" +
      "| T-00 | integration | example | {{marker}} the same webhook delivered twice has one effect | {{acs}} | `tests/hooks.test.js` |\n");
    const tdir = path.join(p, ".specs", "templates");
    fs.mkdirSync(tdir, { recursive: true });
    fs.writeFileSync(path.join(tdir, "test-plan.md"), "# Test Plan: {{name}}\n\n| Test ID | Layer | Kind | Description | Covers | File |\n|---|---|---|---|---|---|\n" +
      "| T-01 | integration | example | {{name}} happy path | {{acs}} | `tests/{{slug}}-twice.test.js` |\n| T-02 | unit | example | {{acs}} with {{t1}} | {{acs}} | `tests/{{slug}}.test.js` |\n");
    // B: the scaffold writes the template's rows with the feature's name; the plan kept as scaffolded (+ an other-user row)
    const named = ["Coupon codes", "Duplicate charge guard", "Double booking guard", "Concurrent seat booking"].map((n) => {
      const f = designed(p, n, ["core", "tdd"], { design: DESIGN("## Critical flows\nA unique constraint on (code, buyer_id).\n\n") });
      const scaffolded = fs.readFileSync(path.join(f.dir, "test-plan.md"), "utf8");
      wr(f, "test-plan.md", scaffolded.replace(/\{\{acs\}\}|\{\{t1\}\}/g, "US-1.AC-1") + "\n| T-09 | integration | example | user B cannot redeem user A's code | US-1.AC-1 | `t.js` |\n");
      return [n, /happy path/i.test(scaffolded), view(S.specDoctor(p, f.slug), "critical-flow-tests")];
    });
    const f = designed(p, "Discounts", ["core", "tdd", "hooks"], { design: DESIGN("## Critical flows\nA unique constraint on (code, buyer_id).\n\n") });
    const other = "| T-09 | integration | example | user B cannot redeem user A's code | US-1.AC-1 | `t.js` |\n";
    const doc = (text) => { wr(f, "test-plan.md", text + other); return view(S.specDoctor(p, f.slug), "critical-flow-tests"); };
    const I = require(path.join(root, "mcp", "lib", "i18n.js"));
    const H = (lang) => { const l = I.testPlan("x", lang, ["core", "tdd"]).split("\n"); const k = l.findIndex((x) => /^\|/.test(x)); return l[k] + "\n" + l[k + 1] + "\n"; };
    const r6 = (desc, file) => `| T-02 | integration | example | ${desc} | US-1.AC-1 | \`${file}\` |\n`;
    const got = {
      fileOnly: doc(H("en") + r6("a valid code applies the discount", "tests/codes-twice-concurrent.test.js")),
      descPt: doc(H("pt") + r6("o mesmo cupão aplicado duas vezes", "t.js")), descEs: doc(H("es") + r6("el mismo cupón canjeado dos veces", "t.js")),
      descBr: doc(H("pt-BR") + r6("o mesmo cupom aplicado duas vezes", "t.js")),
      noHeader: doc("| T-02 | the same code redeemed twice | US-1.AC-1 |\n"),
      marker: doc(H("en") + r6("[HOOKS] the same webhook delivered twice has one effect", "t.js")),
      withRow: doc(H("en") + r6("sent again with the same key: one charge", "t.js")),
    };
    all("1.33 review 4: the Description column alone answers (its header in EN / PT / ES / pt-BR; a File cell saying 'twice' never), a table without that header reads its non-ID cells; a feature named 'Duplicate charge guard' / 'Double booking guard' / 'Concurrent seat booking' keeps its scaffolded '{{name}} happy path' row template; a pack row opening with {{marker}} stays template; '{{acs}} with {{t1}}' cuts nothing out of a real row (got " +
      js({ named, got }) + ")", {
      named: () => named.every(([, scaffolded, v]) => scaffolded && /^warn: critical flow .* lacks a repetition row/.test(v)),
      fileOnly: () => /^warn: critical flow .* lacks a repetition row/.test(got.fileOnly),
      descLangs: () => [got.descPt, got.descEs, got.descBr].every((v) => /^pass: /.test(v)),
      noHeader: () => /^pass: /.test(got.noHeader),
      marker: () => /^warn: critical flow .* lacks a repetition row/.test(got.marker),
      withRow: () => /^pass: /.test(got.withRow),
    });
  }
};
