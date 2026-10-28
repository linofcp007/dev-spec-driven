"use strict";
// Critical flows (1.33): the critical-flow nudge — its signals (a corpus of positives and hard negatives, EN / PT / ES), its answers, its skips, clarify's nudges.

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, all, rpc, payload, S, root, tmp, handRoadmap }) => {
  const js = JSON.stringify;
  const E = require(path.join(root, "mcp", "lib", "engine", "index.js"));
  const call = (name, args) => rpc("tools/call", { name, arguments: args });
  // the detector over one requirements text (no design) — { signals, answered } or null when not asked
  const state = (text, lang = "en", o = {}) => E.criticalFlowState(tmp, o.tracks || ["core"], o.kind || "feature", lang, { reqs: "# Requirements\n\n" + text + "\n", design: o.design || "" });
  const sig = (text, lang) => { const s = state(text, lang); return s ? s.signals : null; };

  { // The signals: ONE word is enough (the user never writes "concurrency") — every concept, EN / PT (pt-BR spellings too) / ES.
    const POS = [
      ["en", "WHEN the buyer places an order THE SYSTEM SHALL decrement the stock.", ["stock"]],
      ["en", "Show the remaining inventory per warehouse.", ["inventory"]],
      ["en", "Sold out items show a waitlist.", ["sold out", "waitlist"]],
      ["en", "Users redeem a coupon at checkout.", ["redeem", "checkout"]],
      ["en", "Apply a promo code to the cart.", ["promo code"]],
      ["en", "Customers pay with a gift card.", ["gift card"]],
      ["en", "Deduct the amount from the account balance.", ["balance"]],
      ["en", "Top up the wallet.", ["top up"]],
      ["en", "Users spend credits to export reports.", ["credits"]],
      ["en", "Refunds go back as store credit.", ["refunds", "store credit"]],
      ["en", "Book a time slot with the dentist.", ["slot"]],
      ["en", "One reservation per table and evening.", ["reservation"]],
      ["en", "Patients book appointments online.", ["appointments"]],
      ["en", "Buyers pick their seats for the concert.", ["seats"]],
      ["en", "Organizers sell tickets for the festival.", ["sell tickets"]],
      ["en", "Admins invite teammates by e-mail.", ["invite"]],
      ["en", "Each plan has a monthly export quota.", ["quota"]],
      ["en", "Process the payment and send a receipt.", ["payment"]],
      ["en", "Charge the customer's card when the order ships.", ["charge"]],
      ["en", "Upgrade the subscription to the Pro plan.", ["upgrade the subscription"]],
      ["en", "Handle the Stripe webhook for invoice.paid.", ["stripe"]],
      ["en", "Pick coupons/vouchers from a list.", ["coupons"]],
      ["pt", "O cliente aplica um cupão no checkout e o stock desce.", ["cupão", "checkout", "stock"]],
      ["pt", "Usar um cupom de desconto.", ["cupom"]],
      ["pt", "Atualizar o estoque após a venda.", ["estoque"]],
      ["pt", "As existências descem a cada venda.", ["existências"]],
      ["pt", "Carregar o saldo da conta.", ["saldo"]],
      ["pt", "Marcação de consultas online.", ["marcação"]],
      ["pt", "Agendamento de consultas no centro de saúde.", ["agendamento"]],
      ["pt", "Reservas de mesa para o jantar.", ["reservas"]],
      ["pt", "Vagas limitadas no workshop.", ["vagas"]],
      ["pt", "Convites para a equipa.", ["convites"]],
      ["pt", "Pagamentos com MB WAY.", ["pagamentos"]],
      ["pt", "Ativar a assinatura do plano Pro.", ["assinatura"]],
      ["es", "El usuario canjea un cupón.", ["canjea"]],
      ["es", "Reservar una cita con el médico.", ["cita"]],
      ["es", "Actualizar el inventario tras cada venta.", ["inventario"]],
      ["es", "Plazas limitadas para el curso.", ["plazas"]],
      ["es", "Recargar el saldo del monedero.", ["saldo", "monedero"]],
      ["es", "Venta de entradas para el concierto.", ["venta de entradas"]],
      ["es", "Invitaciones al equipo.", ["invitaciones"]],
      ["es", "Pagos con tarjeta y reembolsos.", ["pagos"]],
    ];
    // Hard negatives: the everyday senses (CRITICAL_CUES and +tdd's credit / charge cues) — none fires.
    const NEG = [
      ["en", "Add stock photos to the landing page."], ["en", "Show the stock price ticker."], ["en", "Ship a stock Android image."],
      ["en", "Simmer the chicken stock."], ["en", "List the API inventory of the endpoints."], ["en", "Show photo credits under each image."],
      ["en", "Roll the end credits."], ["en", "Students need 30 ECTS credits."], ["en", "Use Vue slots for the card layout."],
      ["en", "Add a named slot to the web component."], ["en", "Install RAM in the free memory slot."], ["en", "Put the API behind a load balancer."],
      ["en", "Promote a healthy work-life balance."], ["en", "Adjust the white balance of photos."], ["en", "Export the balance sheet."],
      ["en", "Add a credit card field to the profile form."], ["en", "The service is free of charge."], ["en", "Show who is in charge of each project."],
      ["en", "Charge the battery to 80%."], ["en", "Run git checkout on the release branch."], ["en", "Fasten the seat belt."],
      ["en", "Sync the calendar invite to Outlook."], ["en", "Manage the newsletter subscription."], ["en", "Use a GraphQL subscription for live scores."],
      ["en", "The bond pays a coupon rate of 3%."], ["en", "A zero-coupon bond."], ["en", "Withdrawal of consent is honoured."],
      ["en", "Record the appointment of a director."], ["en", "This invites abuse."], ["en", "Show the sales quota of each rep."],
      ["en", "Add to Apple Wallet."],
      ["pt", "Mostrar o cupom fiscal da venda."], ["pt", "Linguagem de marcação HTML."], ["pt", "Agendamento de tarefas noturnas."],
      ["pt", "Época de saldos na loja."], ["pt", "Vagas de emprego na empresa."], ["pt", "Fotos de stock na página inicial."],
      ["pt", "Validar a assinatura digital do documento."], ["pt", "Créditos finais do filme."], ["pt", "Bilhete de identidade do cliente."],
      ["es", "Citas bibliográficas en el texto."], ["es", "App de citas para solteros."], ["es", "Rebajas y saldos de verano."],
      ["es", "Reservas naturales protegidas."], ["es", "Las plazas mayores del país."], ["es", "Créditos ECTS del curso."],
    ];
    const posBad = POS.filter(([l, t, want]) => js(sig(t, l)) !== js(want)).map(([l, t]) => [l, t, sig(t, l)]);
    const negBad = NEG.filter(([l, t]) => js(sig(t, l)) !== "[]").map(([l, t]) => [l, t, sig(t, l)]);
    all("1.33 critical flows: one signal fires — stock, a coupon, a balance, credits, a booking / slot / seat / appointment / ticket, an invite, a quota, a checkout, a payment, a charge, a subscription, a capitalised gateway (EN / PT / pt-BR / ES, ≤ 3 words, one per concept); their everyday senses never do — stock photos, photo / end / ECTS credits, UI / Vue / memory slots, a load balancer, a work-life / white balance, a bare credit card field, free of charge, git checkout, a seat belt, a calendar invite, a newsletter / GraphQL subscription, a bond's coupon, cupom fiscal, linguagem de marcação, vagas de emprego, citas bibliográficas… (got " + js({ posBad, negBad }) + ")", {
      positives: () => POS.length >= 40 && !posBad.length,
      negatives: () => NEG.length >= 40 && !negBad.length,
      atMostThree: () => sig("Redeem a coupon, spend the balance, book a seat and pay the invoice.", "en").length === 3,
    });
  }

  { // The answers: any of them, anywhere in the user's text (code spans and fenced code included) — multi-word only.
    const base = "Users redeem a coupon at checkout.\n";
    const ans = (t, design) => { const s = state(base + t, "en", { design }); return s.answered; };
    const YES = ["A unique constraint on (coupon_id, user_id).", "A unique index on redemptions.", "`UPDATE coupons SET used = used + 1 WHERE id = $1 AND used < max_uses`",
      "Check the affected rows.", "```sql\nSELECT qty FROM stock WHERE sku = $1 FOR UPDATE;\n```", "Optimistic locking with a version column.",
      "A processed_events table keyed by the event id.", "Every charge carries an idempotency key.", "The stock is decremented atomically.",
      "INSERT … ON CONFLICT DO NOTHING.", "Restrição de unicidade em (cupão, utilizador).", "Una actualización condicional comprueba las filas afectadas.",
      "Um bloqueio de linha com SELECT … FOR UPDATE."];
    const NO = ["Each coupon code is unique.", "Lock the screen after 5 minutes.", "Eventual consistency is fine.", "Delivery is at-least-once.",
      "The button is disabled after the first click.", "Use an atomic design system.", "The version number is shown in the footer."];
    const yesBad = YES.filter((t) => ans(t) !== "answer"), noBad = NO.filter((t) => ans(t) !== false);
    const section = ans("", "# Design\n\n## Critical flows\nNone: this feature only reads the coupon list.\n");
    const sectionPt = E.criticalFlowState(tmp, ["core"], "feature", "pt", { reqs: "# R\n\nO cliente aplica um cupão.\n", design: "# Design\n\n## Fluxos críticos\nNenhum: só lê a lista.\n" }).answered;
    const sectionEmpty = ans("", "# Design\n\n## Critical flows\n\n## Overview\nx\n");
    all("1.33 critical flows: answered by a unique constraint / index, a conditional or atomic update, the affected rows, SELECT … FOR UPDATE (in a fence too), optimistic locking / a version column, processed events, an idempotency key, ON CONFLICT, PT / ES twins — or a written Critical flows / Fluxos críticos section; never by a bare 'unique' / 'lock' / 'atomic', eventual consistency, at-least-once, a disabled button or a version number (got " +
      js({ yesBad, noBad, section, sectionPt, sectionEmpty }) + ")", {
      yes: () => !yesBad.length, no: () => !noBad.length, section: () => section === "section", sectionPt: () => sectionPt === "section", sectionEmpty: () => sectionEmpty === false,
    });
  }

  { // The skips: a bugfix / spike / change (kind), +dist and +api (their sections ask it — one question bank); +sec is asked.
    const t = "Users redeem a coupon at checkout.";
    const of = (o) => state(t, "en", o);
    const oos = state("Place an order.\n\n## Out of Scope\n- Refunds and coupons.\n\n## Notes\nnone", "en");
    all("1.33 critical flows: never asked of a bugfix, a spike or a change, nor with +dist / +api; +sec / +tdd features are; an Out of Scope section names no flow (got " +
      js([of({ kind: "bugfix" }), of({ kind: "spike" }), of({ kind: "change" }), of({ tracks: ["core", "dist"] }), of({ tracks: ["core", "api"] }), of({ tracks: ["core", "tdd", "sec"] }), oos]) + ")", {
      bugfix: () => of({ kind: "bugfix" }) === null, spike: () => of({ kind: "spike" }) === null, change: () => of({ kind: "change" }) === null,
      dist: () => of({ tracks: ["core", "dist"] }) === null, api: () => of({ tracks: ["core", "api"] }) === null,
      sec: () => js(of({ tracks: ["core", "tdd", "sec"] }).signals) === js(["redeem", "checkout"]),
      outOfScope: () => js(oos.signals) === "[]",
    });
  }

  { // spec_clarify (MCP and the engine): ONE question with its own stable code, after consistency-unstated (both may be returned);
    // answered → none; the template text of every track never fires it; PT / ES questions in the feature's language.
    const p = path.join(tmp, "cf-clarify");
    S.initProject(p, ["core"], "en"); handRoadmap(p);
    const REQ = (crit, extra = "") => "# Feature: Discounts\n\n## Summary\nDiscounts for buyers.\n\n## User Stories\n### US-1 (P1): Discount\nAs a buyer I want a discount.\n**Independent Test:** get one.\n\n" +
      "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — " + crit + "\n2. **US-1.AC-2** — IF the code is expired THEN THE SYSTEM SHALL reject it.\n\n" +
      "## Success Criteria\n- **SC-001** — 95% redeemed in under 1 s.\n\n## Edge Cases & Error Handling\n- **EC-1** — WHEN the code is unknown THE SYSTEM SHALL say so.\n\n" +
      "## Non-Functional Requirements\n- **NFR-1** — p95 < 1 s.\n" + extra + "\n## Out of Scope\n- Gift cards.\n";
    const f = S.createFeature(p, "Coupons", ["core"]);
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ("WHEN the buyer enters a coupon code at checkout THE SYSTEM SHALL apply the discount once."));
    const asked = S.clarify(p, f.slug);
    const askedMcp = payload(await call("spec_clarify", { projectDir: p, name: f.slug }));
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ("WHEN the buyer enters a coupon code at checkout THE SYSTEM SHALL apply the discount once.",
      "- **NFR-2** — A unique constraint on (coupon, buyer) makes a second redemption fail.\n"));
    const answered = S.clarify(p, f.slug);
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ("WHEN the buyer enters a coupon code at checkout THE SYSTEM SHALL publish a CouponRedeemed event to the queue."));
    const both = S.clarify(p, f.slug).nudges;
    const pt = S.createFeature(p, "Cupoes", ["core"], "", undefined, "pt");
    fs.writeFileSync(path.join(pt.dir, "requirements.md"), REQ("QUANDO o cliente aplica um cupão O SISTEMA DEVE dar o desconto uma vez."));
    const ptQ = S.clarify(p, pt.slug);
    const es = S.createFeature(p, "Cupones", ["core"], "", undefined, "es");
    fs.writeFileSync(path.join(es.dir, "requirements.md"), REQ("CUANDO el cliente canjea un cupón EL SISTEMA DEBE aplicar el descuento una vez."));
    const esQ = S.clarify(p, es.slug);
    // a pristine scaffold of every track combination (but +dist / +api), EN / PT / ES / pt-BR: never fires
    const fired = [];
    for (const lang of ["en", "pt", "es", "pt-BR"]) {
      for (const tr of [["core"], ["core", "tdd"], ["core", "saas"], ["core", "ai"], ["core", "sec"], ["core", "privacy"], ["core", "ui"], ["core", "obs"], ["core", "data"], ["core", "tdd", "saas", "ai", "sec", "privacy", "ui", "obs", "data"]]) {
        const g = S.createFeature(p, "Pristine cf " + lang + " " + tr.join(" "), tr, "", undefined, lang);
        const n = g.ok ? (S.clarify(p, g.slug).nudges || []).filter((x) => x.code === "critical-flow-unstated") : ["create failed"];
        if (n.length) fired.push([lang, tr.join("+"), n]);
      }
    }
    const q = (r) => (r.questions || []).find((x) => /critical flow|fluxo crítico|flujo crítico/.test(x)) || "";
    all("1.33 critical flows: spec_clarify asks ONE question (nudges critical-flow-unstated with its signals) when a coupon / checkout is named and no database rule answers it — MCP too; a unique constraint in a requirement answers it; with a queue + an event both nudges come back, consistency-unstated first; PT / ES ask in the feature's language; a pristine scaffold of any track never fires it (got " +
      js({ asked: asked.nudges, answered: answered.nudges, both, fired, pt: q(ptQ).slice(0, 60), es: q(esQ).slice(0, 60) }) + ")", {
      asked: () => js(asked.nudges) === js([{ code: "critical-flow-unstated", signals: ["coupon", "checkout"] }]),
      question: () => /^The spec mentions 'coupon', 'checkout' — a critical flow: two identical requests in the same millisecond/.test(q(asked)) && /references\/critical-flows\.md/.test(q(asked)),
      mcp: () => js(askedMcp.nudges) === js(asked.nudges) && askedMcp.questions.includes(q(asked)),
      answered: () => answered.nudges === undefined && !q(answered),
      both: () => js((both || []).map((x) => x.code)) === js(["consistency-unstated", "critical-flow-unstated"]),
      pt: () => /^A spec menciona 'cupão' — um fluxo crítico/.test(q(ptQ)) && js(ptQ.nudges[0].signals) === js(["cupão"]),
      es: () => /^La spec menciona 'canjea' — un flujo crítico/.test(q(esQ)), // (canjea + cupón: one concept)
      pristine: () => !fired.length,
    });
  }

  { // The guidance: the reference (and its index entry), SKILL.md's pointer, /clarify --grill's constraints round, the critic's row, the
    // test patterns and the implementer's one wording of the never-weaken rule; the test plan's Strategy comment in EN / PT / ES, which
    // the placeholder lookup never reads (a fresh plan's slots are its old ones) — and none of the new text steers toward PRs or CI.
    const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n");
    const ref = rd("skills", "dev-spec-driven", "references", "critical-flows.md"), idx = rd("skills", "dev-spec-driven", "references", "index.md");
    const skill = rd("skills", "dev-spec-driven", "SKILL.md"), grill = rd("commands", "clarify.md"), critic = rd("agents", "spec-critic.md");
    const tpat = rd("skills", "dev-spec-driven", "references", "test-patterns.md"), impl = rd("agents", "spec-implementer.md");
    const ws = (t) => t.replace(/\s+/g, " ");
    const section = tpat.slice(tpat.indexOf("## Critical flows: twice, and two at once"), tpat.indexOf("## Negative Tests Are First-Class"));
    const criticRow = (critic.match(/^\| \*\*Critical flows\*\* \|.*$/m) || [""])[0];
    const p = path.join(tmp, "cf-plan-template");
    S.initProject(p, ["core"], "en"); handRoadmap(p);
    const plans = ["en", "pt", "es", "pt-BR"].map((l) => {
      const f = S.createFeature(p, "Plan " + l, ["core", "tdd"], "", undefined, l);
      const text = fs.readFileSync(path.join(f.dir, "test-plan.md"), "utf8");
      const items = S.featurePlaceholders(p, f.slug, "test-plan.md").items.map((x) => x.text);
      return { l, comment: /<!-- (?:Integration tests call the real route|Os testes de integração chamam a rota real|Las pruebas de integración llaman a la ruta real)/.test(text),
        rows: /(?:twice, and two at once|duas vezes, e dois em simultâneo|dos veces, y dos a la vez)/.test(text), slots: items.length, leak: items.filter((x) => /twice|vezes|veces|produc/.test(x)) };
    });
    all("1.33 critical flows — the guidance: references/critical-flows.md (database order, webhooks, idempotency keys, server-side prices, the twice / two-at-once tests) listed in index.md and pointed at by SKILL.md, /clarify --grill's round, the critic's Critical flows row and test-patterns.md; the implementer's hard rule names skip / delete / weaken (one wording, repeated by the references); the test plan's Strategy comment in EN / PT / ES / pt-BR, never read as a slot; no PR / CI steering (got " +
      js({ plans, criticRow: criticRow.length, section: section.length }) + ")", {
      reference: () => ["unique constraint", "UPDATE stock SET qty = qty - 1 WHERE sku = $1 AND qty > 0", "affected rows", "SELECT … FOR UPDATE", "disabled button is UX comfort",
        "RAW body", "processed-events table", "Never rely on arrival order", "Idempotency-Key", "Never personal data as the key", "recomputes the price", "Promise.all",
        "separate test database", "another user's data", "never skip, delete or weaken a test or an assertion"].every((w) => ws(ref).includes(w)),
      index: () => /`references\/critical-flows\.md` — a critical flow/.test(idx),
      skill: () => /A critical flow — stock, a coupon, a\s+balance, a booking, a payment \(`critical-flows`, `critical-flow-tests`\): `references\/critical-flows\.md`/.test(skill),
      grill: () => /\*\*Critical flows\*\* \(stock, a\s+coupon, a balance, a booking, a payment: what two identical requests at once do/.test(grill) &&
        /`\$\{CLAUDE_PLUGIN_ROOT\}\/skills\/dev-spec-driven\/references\/critical-flows\.md`/.test(grill),
      critic: () => /IN THE DATABASE/.test(criticRow) && /idempotency key reused on retry/.test(criticRow) && /the same request twice, twice at once/.test(criticRow) &&
        /`skills\/dev-spec-driven\/references\/critical-flows\.md`/.test(criticRow),
      testPatterns: () => /integration tests on the real route/.test(ws(section)) && /never production/.test(ws(section)) && /mock only what is external/.test(ws(section)) &&
        /Never skip, delete or weaken a test or an assertion to make it pass/.test(ws(section)),
      implementer: () => /\*\*Never edit a planned test's expectation, and never skip, delete or weaken a test or an assertion to make it pass\.\*\*/.test(impl),
      templates: () => plans.every((x) => x.comment && x.rows && x.slots > 0 && !x.leak.length),
      noPrCi: () => [ref, section, criticRow].every((t) => !/pull request|\bPRs?\b|\bCI\b/.test(t)),
    });
  }
};
