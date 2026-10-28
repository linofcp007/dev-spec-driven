"use strict";
// Gates — the critical-flow warns (1.33): doctor's critical-flows (the design) and critical-flow-tests (the test plan), never an approval check; the `critical` stamp.

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, all, rpc, payload, S, root, tmp, approveBefore, handRoadmap }) => {
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
      ["con la misma clave: un solo pago", "es"]];
    const NO = [["the Retry button reloads the list"], ["retries after a gateway timeout"], ["the repeat password field must match"], ["nova tentativa após um timeout", "pt"]];
    const yesBad = YES.filter(([d, l]) => !rep(d, l)).map(([d]) => d), noBad = NO.filter(([d, l]) => rep(d, l)).map(([d]) => d);
    all("1.33 review 2: an edited template row is the user's (+dist's 'delivered twice … — for the coupon webhook', +sec's 'user B … — the coupon endpoint' answer; verbatim they don't); a repeated / redelivered / resubmitted / replayed / retried webhook, the same time / millisecond, identical requests, PT repetido(a) / reenviado / com a mesma chave, ES repetida / reenviado / con la misma clave count — a Retry button, a retry after a timeout, a repeat-password field don't (got " +
      js({ edited: gaps(check(ownMine)), verbatim: gaps(check(ownTpl)), yesBad, noBad }) + ")", {
      edited: () => gaps(check(ownMine)) === "pass", verbatim: () => gaps(check(ownTpl)) === "repetition row+another user's data",
      yes: () => !yesBad.length, no: () => !noBad.length,
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
      projectEdited: plan(row("T-02", "the order is submitted twice: one order for Discounts, both at the same second")),
    };
    all("1.33 review 2: a track pack's test-plan row and the project's test-plan template row ({{name}} filled) are template text — verbatim the plan still lacks a repetition row; edited, they answer (got " + js(got) + ")", {
      packVerbatim: () => /^warn: critical flow .* lacks a repetition row/.test(got.packVerbatim), packEdited: () => /^pass: /.test(got.packEdited),
      projectVerbatim: () => /^warn: critical flow .* lacks a repetition row/.test(got.projectVerbatim), projectEdited: () => /^pass: /.test(got.projectEdited),
    });
  }
};
