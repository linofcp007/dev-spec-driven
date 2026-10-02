"use strict";
// Spec quality — steering amendments, cross-feature criteria, the glossary, Reuse & Integration and clean code.
// Also re-checks the behavioural fixtures 17-docs-evals built (no new warning on them).

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

// Runs after 17-docs-evals, in the same process: it reads the behavioural fixtures it built under tmp (a3-eval-fixtures/): 1.16 Q2 and 1.19 R1 re-check them.
exports.deps = ["17-docs-evals"];
exports.run = async ({ ok, rpc, payload, S, root, tmp, approveBefore, shipFeature, require, __dirname }) => {

  // 1.16 package (Q) — spec quality: steering amendments, cross-feature ACs, glossary.

  {
    const js = (v) => JSON.stringify(v);
    const call = async (name, args) => { const r = await rpc("tools/call", { name, arguments: args }); return { isError: !!(r.result && r.result.isError), p: r.result ? payload(r) : null }; };
    const qDir = (n) => path.join(tmp, "proj-116-q-" + n);
    const reqOf = (dir, slug, body, head) => fs.writeFileSync(path.join(dir, ".specs", slug, "requirements.md"), "# Feature: " + slug + "\n\n" + (head || "### US-1 (P1): Story\n#### Acceptance Criteria (EARS)\n") + body);
    const steer = (dir, f, text) => fs.writeFileSync(path.join(dir, ".specs", "steering", f), text);
    const approveAll = (dir, slug, phases) => phases.forEach((ph) => S.approvePhase(dir, slug, ph, "t", { force: true }));
    const QIDS = ["glossary", "cross-feature-acs", "steering-changed-since-approval"];
    const qChecks = (dir, slug) => (S.specDoctor(dir, slug).checks || []).filter((c) => QIDS.includes(c.id));

    // --- Q1: steering amendments ---
    const q1 = qDir("q1");
    S.initProject(q1, ["core", "sec"], "en");
    steer(q1, "constitution.md", "# Constitution\n\n1. Every write is idempotent.\n");
    steer(q1, "api-rules.md", "---\ninclusion: fileMatch\nfileMatchPattern: \"src/api/**\"\n---\n# API rules\n- JSON only\n");
    steer(q1, "notes.md", "# Notes (no front matter: never governing)\n- x\n");
    const q1a = S.createFeature(q1, "Alpha", ["core", "sec"], "x", undefined, "en");
    S.createFeature(q1, "Beta", ["core"], "x", undefined, "en");
    S.createFeature(q1, "Legacy", ["core"], "x", undefined, "en");
    fs.writeFileSync(path.join(q1a.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. Build the API\n  - _Implements: src/api/users.js_\n");
    for (const f of ["alpha", "beta", "legacy"]) approveAll(q1, f, ["classification", "requirements", "design"]);
    // Legacy: approvals made before 1.16 carry no steering fingerprints (removed by hand here).
    const lgPath = path.join(q1, ".specs", "legacy", ".state.json");
    const lg = JSON.parse(fs.readFileSync(lgPath, "utf8"));
    for (const ph of ["requirements", "design"]) delete lg.approvals[ph].steering;
    lg.approvalHistory.forEach((h) => delete h.steering);
    fs.writeFileSync(lgPath, JSON.stringify(lg, null, 2));
    const stA = S.readState(q1, "alpha");
    const hA = (stA.approvalHistory || []).filter((h) => h.phase === "design").pop() || {};
    const naBefore = S.nextAction(q1, "alpha");
    ok(js(Object.keys(stA.approvals.requirements.steering || {})) === js(["api-rules.md", "constitution.md", "security.md"]) &&
      js(Object.keys(S.readState(q1, "beta").approvals.design.steering || {})) === js(["api-rules.md", "constitution.md"]) &&
      js(S.readState(q1, "beta").approvals.design.steeringMatch) === js({ "api-rules.md": ["src/api/**"] }) && js(hA.steeringMatch) === js({ "api-rules.md": ["src/api/**"] }) &&
      hA.steering && hA.steering["constitution.md"] === stA.approvals.design.steering["constitution.md"] && stA.approvals.classification.steering === undefined &&
      !qChecks(q1, "alpha").length && !naBefore.steeringChanged,
      "1.16 Q1: a requirements / design approval records `steering` {file: fingerprint} — constitution.md, the active tracks' files (+sec: security.md), every fileMatch file with its patterns (`steeringMatch` — counted while the feature's _Implements:_ match it), never a file without front matter; the history record carries it; classification none; no warning while unchanged (got " +
      js([Object.keys(stA.approvals.requirements.steering || {}), Object.keys(S.readState(q1, "beta").approvals.design.steering || {})]) + ")");
    steer(q1, "constitution.md", "# Constitution\n\n1. Every write is idempotent.\n2. No PII in logs.\n");
    fs.rmSync(path.join(q1, ".specs", "steering", "security.md"));
    const dA = S.specDoctor(q1, "alpha");
    const cA = dA.checks.find((c) => c.id === "steering-changed-since-approval") || {};
    const naA = S.nextAction(q1, "alpha");
    ok(cA.status === "warn" && /constitution\.md \(changed\), security\.md \(removed\)/.test(cA.detail) && /requirements \(approved \d{4}-\d\d-\d\d\)/.test(cA.detail) &&
      /node "[^"]*dev-spec\.js" impact alpha --phase steering/.test(cA.detail) && dA.verdict !== "pass" &&
      js(dA.steeringChanged.map((c) => [c.phase, c.files.map((x) => x.file + ":" + x.change)])) === js([["requirements", ["constitution.md:modified", "security.md:removed"]], ["design", ["constitution.md:modified", "security.md:removed"]]]) &&
      !dA.checks.some((c) => c.id === "steering-changed-since-approval" && c.status === "fail") &&
      naA.step === naBefore.step && /Also: steering changed after the approval of requirements, design \(constitution\.md, security\.md\)/.test(naA.recommendation) && naA.steeringChanged.length === 2 &&
      !qChecks(q1, "legacy").length,
      "1.16 Q1: steering changed after approval → doctor warns steering-changed-since-approval (which files, changed / removed, which approvals; `steeringChanged` stable codes); next_action keeps its step and adds a re-review hint; a pre-1.16 approval (no fingerprints) is never warned about (got " + js([cA.detail, naA.step, naBefore.step]) + ")");
    const imP = await call("spec_impact", { phase: "steering", projectDir: q1 });
    const imB = S.impactReport(q1, "Beta", { phase: "STEERING" });
    const imNo = await call("spec_impact", { projectDir: q1 });
    const imRe = S.impactReport(q1, "alpha", { phase: "steering", reopen: true });
    ok(!imP.isError && imP.p.ok && imP.p.scope === "project" && imP.p.changed === true && js(imP.p.features.map((f) => f.feature)) === js(["alpha", "beta"]) &&
      js(imP.p.files) === js(["constitution.md", "security.md"]) && js(imP.p.untracked) === js([{ feature: "legacy", phases: ["requirements", "design"] }]) &&
      imB.ok && imB.scope === "feature" && imB.feature === "beta" && imB.features.length === 1 && js(imB.features[0].approvals[0].files) === js([{ file: "constitution.md", change: "modified" }]) &&
      /^Steering — beta: approved under an older version of steering/.test(S.impactLines(imB)[0]) &&
      imNo.isError && /name required — only phase 'steering' works project-wide/.test(imNo.p.error) && imRe.ok === false && /reopen doesn't apply to phase 'steering'/.test(imRe.error),
      "1.16 Q1: spec_impact {phase: 'steering'} without a name lists every active feature approved under changed steering (+ the pre-1.16 ones as untracked); with a name, that feature; no name for another phase and reopen are refused (got " + js([imP.p && imP.p.features, imNo.p]) + ")");
    approveAll(q1, "alpha", ["requirements", "design"]);
    const imAfter = S.impactReport(q1, undefined, { phase: "steering" });
    ok(!qChecks(q1, "alpha").some((c) => c.id === "steering-changed-since-approval") && !S.nextAction(q1, "alpha").steeringChanged &&
      js(imAfter.features.map((f) => f.feature)) === js(["beta"]) && js(Object.keys(S.readState(q1, "alpha").approvals.design.steering)) === js(["api-rules.md", "constitution.md"]),
      "1.16 Q1: re-approving the phase records the current steering — the warning and the hint clear; the project view keeps the others (got " + js(imAfter.features) + ")");
    // PT: the doctor detail and the impact lines speak the feature's language; CRLF / a BOM re-save is no amendment.
    const q1pt = qDir("q1pt");
    S.initProject(q1pt, ["core"], "pt");
    steer(q1pt, "constitution.md", "# Constituição\n\n1. Toda a escrita é idempotente.\n");
    S.createFeature(q1pt, "Faturas", ["core"], "x", undefined, "pt");
    approveAll(q1pt, "faturas", ["classification", "requirements", "design"]);
    steer(q1pt, "constitution.md", String.fromCharCode(0xfeff) + "# Constituição\r\n\r\n1. Toda a escrita é idempotente.\r\n");
    const ptSame = qChecks(q1pt, "faturas").length;
    steer(q1pt, "constitution.md", "# Constituição\n\n1. Toda a escrita é idempotente.\n2. Sem PII nos logs.\n");
    const ptC = qChecks(q1pt, "faturas").find((c) => c.id === "steering-changed-since-approval") || {};
    ok(ptSame === 0 && /^steering alterado depois da aprovação — requirements \(aprovado em \d{4}-\d\d-\d\d\): constitution\.md \(alterado\)/.test(ptC.detail || "") &&
      /^Steering — 1 feature\(s\) ativa\(s\) aprovada\(s\)/.test(S.impactLines(S.impactReport(q1pt, null, { phase: "steering" }))[0]),
      "1.16 Q1 (PT): a BOM / CRLF re-save is no amendment; a real edit warns in Portuguese, and the project-wide impact speaks the project language (got " + js(ptC.detail) + ")");

    // --- Q2: cross-feature acceptance criteria ---
    const q2 = qDir("q2");
    S.initProject(q2, ["core"], "en");
    ["Alpha", "Beta", "Gamma"].forEach((n) => S.createFeature(q2, n, ["core"], "x", undefined, "en"));
    reqOf(q2, "alpha", "1. **US-1.AC-1** — WHEN a login fails 5 times THE SYSTEM SHALL lock the account for 15 minutes\n2. **US-1.AC-2** — WHEN a user signs up THE SYSTEM SHALL send a welcome email to the user\n" +
      "3. **US-1.AC-3** — THE SYSTEM SHALL store the card number encrypted at rest\n4. **US-1.AC-4** — WHEN a user uploads a file THE SYSTEM SHALL reject files larger than 10 MB\n");
    reqOf(q2, "beta", "1. **US-1.AC-1** — WHEN a login fails 3 times THE SYSTEM SHALL lock the account for 15 minutes\n2. **US-1.AC-2** — WHEN users sign up THE SYSTEM SHALL send a welcome email to each user\n" +
      "3. **US-1.AC-3** — THE SYSTEM SHALL NOT store the card number encrypted at rest\n4. **US-1.AC-4** — WHEN a user uploads an avatar image THE SYSTEM SHALL reject files larger than 2 MB\n");
    reqOf(q2, "gamma", "1. **US-1.AC-1** — WHEN the report is exported THE SYSTEM SHALL produce a CSV file\n");
    const x2 = await call("spec_catalog", { projectDir: q2 });
    const pr = (x2.p.crossAcs || { pairs: [] }).pairs.map((p) => [p.kind, p.reason, p.a.feature + "/" + p.a.id, p.b.feature + "/" + p.b.id]);
    const dAl = qChecks(q2, "alpha").find((c) => c.id === "cross-feature-acs") || {};
    const dBe = qChecks(q2, "beta").find((c) => c.id === "cross-feature-acs") || {};
    ok(js(pr) === js([["conflict", "different-numbers", "alpha/US-1.AC-1", "beta/US-1.AC-1"], ["duplicate", "near-duplicate", "alpha/US-1.AC-2", "beta/US-1.AC-2"], ["conflict", "opposite-modal", "alpha/US-1.AC-3", "beta/US-1.AC-3"]]) &&
      js(x2.p.crossAcs.pairs[0].numbers) === js({ a: ["5", "15"], b: ["3", "15"] }) && x2.p.crossAcs.truncated === false &&
      /\n## ⚠ Possible duplicates \/ conflicts\n/.test(x2.p.markdown) && /- ≈ alpha\/US-1\.AC-2 ↔ beta\/US-1\.AC-2 \(near-duplicate: 100% alike\)/.test(x2.p.markdown) &&
      /- ⚡ alpha\/US-1\.AC-3 ↔ beta\/US-1\.AC-3 \(possible conflict: SHALL vs SHALL NOT, 100% alike\)/.test(x2.p.markdown) &&
      dAl.status === "warn" && /^3 criterion pair\(s\)/.test(dAl.detail) && /US-1\.AC-1 ↔ beta\/US-1\.AC-1 \(possible conflict: different numbers 5\/15 ↔ 3\/15/.test(dAl.detail) &&
      /US-1\.AC-3 ↔ alpha\/US-1\.AC-3/.test(dBe.detail || "") && !qChecks(q2, "gamma").length,
      "1.16 Q2 (EN): spec_catalog crossAcs — a different-numbers conflict, a near-duplicate (plural / 'each' folded), a SHALL vs SHALL NOT conflict; the upload pair with different triggers is none; SPECS.md section; doctor warns cross-feature-acs on both features naming the other's AC; gamma has none (got " + js(pr) + ")");
    // PT / ES: accents folded, NÃO DEVE / NO DEBE, PT plural "-es"/"-s".
    const q2pt = qDir("q2pt");
    S.initProject(q2pt, ["core"], "pt");
    ["Pagamentos", "Cartoes"].forEach((n) => S.createFeature(q2pt, n, ["core"], "x", undefined, "pt"));
    const ptHead = "### US-1 (P1): História\n#### Critérios de Aceitação (EARS)\n";
    reqOf(q2pt, "pagamentos", "1. **US-1.AC-1** — QUANDO um login falhar 5 vezes O SISTEMA DEVE bloquear a conta durante 15 minutos\n2. **US-1.AC-2** — O SISTEMA DEVE guardar o número do cartão cifrado em repouso\n", ptHead);
    reqOf(q2pt, "cartoes", "1. **US-1.AC-1** — QUANDO um login falhar 3 vezes O SISTEMA DEVE bloquear a conta durante 15 minutos\n2. **US-1.AC-2** — O SISTEMA NÃO DEVE guardar o número do cartão cifrado em repouso\n", ptHead);
    const q2es = qDir("q2es");
    S.initProject(q2es, ["core"], "es");
    ["Pedidos", "Envios"].forEach((n) => S.createFeature(q2es, n, ["core"], "x", undefined, "es"));
    const esHead = "### US-1 (P1): Historia\n#### Criterios de Aceptación (EARS)\n";
    reqOf(q2es, "pedidos", "1. **US-1.AC-1** — CUANDO un usuario confirme el pedido EL SISTEMA DEBE enviar un correo de confirmación al usuario\n2. **US-1.AC-2** — EL SISTEMA DEBE conservar las facturas durante 5 años\n", esHead);
    reqOf(q2es, "envios", "1. **US-1.AC-1** — CUANDO un usuario confirme el pedido EL SISTEMA DEBE enviar un correo de confirmación al usuario\n2. **US-1.AC-2** — EL SISTEMA DEBE conservar las facturas durante 10 años\n", esHead);
    const kinds = (dir) => S.crossFeatureAcs(dir).pairs.map((p) => p.kind + ":" + p.reason + ":" + p.a.id);
    const ptDoc = qChecks(q2pt, "pagamentos").find((c) => c.id === "cross-feature-acs") || {};
    const esDoc = qChecks(q2es, "envios").find((c) => c.id === "cross-feature-acs") || {};
    ok(js(kinds(q2pt)) === js(["conflict:different-numbers:US-1.AC-1", "conflict:opposite-modal:US-1.AC-2"]) &&
      js(kinds(q2es)) === js(["duplicate:near-duplicate:US-1.AC-1", "conflict:different-numbers:US-1.AC-2"]) &&
      /^2 par\(es\) de critérios parecem-se com os de outra feature ativa/.test(ptDoc.detail || "") && /DEVE vs NÃO DEVE/.test(ptDoc.detail || "") &&
      /^2 par\(es\) de criterios se parecen a los de otra función activa/.test(esDoc.detail || "") && /casi duplicado/.test(esDoc.detail || "") &&
      /\n## ⚠ Possíveis duplicados \/ conflitos\n/.test(S.catalog(q2pt).markdown) && /\n## ⚠ Posibles duplicados \/ conflictos\n/.test(S.catalog(q2es).markdown),
      "1.16 Q2 (PT / ES): QUANDO / CUANDO criteria compared with accents folded; NÃO DEVE vs DEVE and different numbers are conflicts, the same ES criterion a near-duplicate — doctor and SPECS.md in the language (got " + js([kinds(q2pt), kinds(q2es)]) + ")");
    // Template criteria are never compared: three features of every track, in every language (+ a bugfix); two +ai / +saas
    // features whose scaffolded criteria got their own numbers, or a light edit of the same template criterion.
    const tplCounts = ["en", "pt", "es", "pt-BR"].map((l) => {
      const d = qDir("q2tpl-" + l);
      S.initProject(d, ["core"], l);
      ["Alpha", "Beta", "Gamma"].forEach((n) => S.createFeature(d, n, ["core", "tdd", "saas", "ai", "sec", "privacy"], "x", undefined, l));
      S.createFeature(d, "Bug One", ["core"], "x", undefined, l, "bugfix");
      const x = S.crossFeatureAcs(d);
      return x.criteria + "/" + x.pairs.length;
    });
    const q2f = qDir("q2filled");
    S.initProject(q2f, ["core"], "en");
    [["Alpha", "90", "0.05", "200", "invoices"], ["Beta", "80", "0.02", "300", "reports"]].forEach(([n, a, b, c, what]) => {
      const cr = S.createFeature(q2f, n, ["core", "saas", "ai", "sec", "privacy"], "x", undefined, "en");
      const fp = path.join(cr.dir, "requirements.md");
      fs.writeFileSync(fp, fs.readFileSync(fp, "utf8").replace("[85]", a).replace("[0.03]", b).replace("[N]ms", c + "ms").replace("requests data,", "requests " + what + ","));
    });
    ok(js(tplCounts) === js(["0/0", "0/0", "0/0", "0/0"]) && S.crossFeatureAcs(q2f).pairs.length === 0,
      "1.16 Q2: template criteria are never compared — untouched scaffolds of every track in EN / PT / ES / pt-BR, the bugfix's, +ai / +saas criteria with their numbers filled in, a light edit of the same template criterion (got " + js(tplCounts) + ")");
    // _Supersedes:_: a pending declaration skips the pair; once the declarer ships the older criterion is retired (compared with nothing).
    const q2s = qDir("q2sup");
    S.initProject(q2s, ["core"], "en");
    ["Old", "New", "Other"].forEach((n) => S.createFeature(q2s, n, ["core"], "x", undefined, "en"));
    const lockAc = "WHEN a login fails 5 times THE SYSTEM SHALL lock the account for 15 minutes";
    reqOf(q2s, "old", "1. **US-1.AC-1** — " + lockAc + "\n");
    reqOf(q2s, "new", "1. **US-1.AC-1** — WHEN a login fails 3 times THE SYSTEM SHALL lock the account for 15 minutes _Supersedes: old/US-1.AC-1_\n");
    reqOf(q2s, "other", "1. **US-1.AC-1** — WHEN a sign-up form is submitted THE SYSTEM SHALL validate the email address\n");
    const supPending = S.crossFeatureAcs(q2s).pairs.length;
    reqOf(q2s, "other", "1. **US-1.AC-1** — " + lockAc + "\n");
    const withOther = S.crossFeatureAcs(q2s).pairs.map((p) => p.a.feature + "~" + p.b.feature + ":" + p.kind);
    shipFeature(q2s, "new");
    const afterShip = S.crossFeatureAcs(q2s).pairs.map((p) => p.a.feature + "~" + p.b.feature + ":" + p.kind);
    ok(supPending === 0 && js(withOther) === js(["new~other:conflict", "old~other:duplicate"]) && js(afterShip) === js(["new~other:conflict"]) &&
      !qChecks(q2s, "old").length,
      "1.16 Q2: a criterion declaring _Supersedes:_ of another is never reported against it (pending); a third feature is still compared with both; once the declarer ships, the superseded criterion is retired and compared with nothing (got " + js([withOther, afterShip]) + ")");
    // No false positive on the shipped examples and the eval fixtures (copies): no Q warning, no catalog pair.
    const copies = [["demo", path.join(root, "examples", "demo-project"), null], ["specs-en", path.join(root, "evals", "fixtures", "specs-en"), ".specs"], ["specs-es", path.join(root, "evals", "fixtures", "specs-es"), ".specs"]];
    const fpBad = [];
    for (const [n, src, sub] of copies) {
      const d = qDir("fp-" + n);
      fs.cpSync(src, sub ? path.join(d, sub) : d, { recursive: true });
      if (S.catalog(d).crossAcs.pairs.length) fpBad.push(n + ": catalog pairs");
      for (const f of S.listFeatures(d).features || []) for (const c of qChecks(d, f.name)) if (c.status !== "pass") fpBad.push(n + "/" + f.name + ": " + c.id);
    }
    const fxRoot = path.join(tmp, "a3-eval-fixtures"); // the behavioural fixtures built above (when bash is here)
    let fxSeen = 0;
    for (const c of fs.existsSync(fxRoot) ? fs.readdirSync(fxRoot) : []) {
      const d = path.join(fxRoot, c);
      if (!fs.existsSync(path.join(d, ".specs"))) continue;
      fxSeen++;
      if (S.catalog(d).crossAcs.pairs.length) fpBad.push(c + ": catalog pairs");
      for (const f of S.listFeatures(d).features || []) for (const q of qChecks(d, f.name)) if (q.status !== "pass") fpBad.push(c + "/" + f.name + ": " + q.id);
    }
    ok(!fpBad.length, "1.16 Q2 / Q1 / Q3: no new warning on copies of examples/demo-project, evals/fixtures/specs-en / specs-es and the " + fxSeen + " built behavioural fixture(s) with a .specs/ — no cross-feature pair, no steering amendment, no glossary (got " + js(fpBad) + ")");
    // Bounded: 50 features × 20 criteria.
    const q2t = qDir("q2time");
    S.initProject(q2t, ["core"], "en");
    const vocab = "account invoice payment report export order cart product price discount coupon shipment address refund review rating search filter page token session role permission audit backup schedule queue webhook email message notification upload download image video comment tag category inventory stock supplier warehouse tax currency locale theme profile avatar password".split(" ");
    let seed = 7;
    const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    for (let f = 0; f < 50; f++) {
      const cr = S.createFeature(q2t, "Feature " + f, ["core"], "x", undefined, "en");
      let body = "# Feature: f" + f + "\n\n### US-1 (P1): Story\n#### Acceptance Criteria (EARS)\n";
      for (let i = 1; i <= 20; i++) {
        const w = () => vocab[rnd(vocab.length)];
        body += `${i}. **US-1.AC-${i}** — WHEN the ${w()} ${w()} is ${["created", "updated", "deleted", "viewed"][rnd(4)]} THE SYSTEM SHALL ${["store", "send", "show", "validate"][rnd(4)]} the ${w()} ${w()} within ${rnd(10) + 1} seconds\n`;
      }
      fs.writeFileSync(path.join(cr.dir, "requirements.md"), body);
    }
    let t0 = Date.now();
    const xt = S.crossFeatureAcs(q2t);
    const msAll = Date.now() - t0;
    t0 = Date.now();
    S.specDoctor(q2t, "feature-7");
    const msDoc = Date.now() - t0;
    ok(xt.criteria === 1000 && xt.pairs.length <= 200 && xt.comparisons <= 200000 && msAll < 5000 && msDoc < 8000,
      "1.16 Q2: bounded — 50 features × 20 criteria compared through the inverted index (" + xt.comparisons + " comparisons, " + xt.pairs.length + " pair(s), truncated=" + xt.truncated + ") in " + msAll + " ms; one doctor " + msDoc + " ms");

    // --- Q3: the glossary ---
    const q3 = qDir("q3");
    S.initProject(q3, ["core"], "en");
    const inv = S.createFeature(q3, "Invoices", ["core"], "x", undefined, "en");
    reqOf(q3, "invoices", "1. **US-1.AC-1** — WHEN a client pays THE SYSTEM SHALL email the receipt to the Customer\n2. **US-1.AC-2** — WHEN an end user opens a bill THE SYSTEM SHALL show it <!-- a user in a comment -->\n" +
      "3. **US-1.AC-3** — THE SYSTEM SHALL keep `user_id` for the Customer _Supersedes: client-portal/US-1.AC-1_ and list its clients\n```\nuser client\n```\n");
    fs.writeFileSync(path.join(inv.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. Send invoices\n  - _Requirements: US-1.AC-1_\n- [ ] 2. Tune the cache\n");
    const cl0 = S.clarify(q3, "invoices"), br0 = S.taskBrief(q3, "invoices", 1);
    const noGloss = !qChecks(q3, "invoices").some((c) => c.id === "glossary") && !cl0.glossary && !br0.glossary && !/## Glossary/.test(br0.brief) &&
      !fs.existsSync(path.join(q3, ".specs", "steering", "glossary.md"));
    const sc = await call("steering_scaffold", { file: "glossary.md", projectDir: q3 });
    const stubOnly = S.glossaryEntries(path.join(q3, ".specs"));
    const stubDoc = S.specDoctor(q3, "invoices").checks;
    ok(noGloss && !sc.isError && sc.p.created === true && !sc.p.custom && /^# Glossary\n/.test(fs.readFileSync(sc.p.file, "utf8")) && /_Avoid: \[word\], \[word\]_/.test(fs.readFileSync(sc.p.file, "utf8")) &&
      stubOnly.entries.length === 0 && !stubDoc.some((c) => c.id === "glossary") && /glossary\.md \(\d+\)/.test((stubDoc.find((c) => c.id === "steering") || {}).detail || "") &&
      js(S.clarify(q3, "invoices").questions) === js(cl0.questions),
      "1.16 Q3: no glossary → clarify, doctor and the brief are unchanged; spec_init never creates it; steering_scaffold glossary.md writes the EN stub (a known template, `_Avoid:_` marker) — its [Term] slot is no entry and steering names it as a template (got " + js(stubOnly.entries) + ")");
    fs.writeFileSync(sc.p.file, "# Glossary\n\n- **Customer** — a person or company with a signed contract. _Avoid: client, user_\n- **End user** — a person who logs in.\n" +
      "- **Invoice**: a bill sent to a Customer.\n  - _Avoid: bill, receipt_\n<!-- - **Ghost** — x. _Avoid: phantom_ -->\n```\n- **Code** — y. _Avoid: snippet_\n```\n");
    const ents = S.glossaryEntries(path.join(q3, ".specs")).entries;
    const cl1 = (await call("spec_clarify", { name: "invoices", projectDir: q3 })).p;
    const gq = cl1.questions.filter((q) => /the glossary says/.test(q));
    const gDoc = qChecks(q3, "invoices").find((c) => c.id === "glossary") || {};
    ok(js(ents.map((e) => [e.term, e.definition, e.avoid])) === js([["Customer", "a person or company with a signed contract", ["client", "user"]], ["End user", "a person who logs in", []], ["Invoice", "a bill sent to a Customer", ["bill", "receipt"]]]) &&
      js(cl1.glossary) === js([{ word: "client", term: "Customer", count: 2, locations: ["requirements.md:5", "requirements.md:7"] }, { word: "receipt", term: "Invoice", count: 1, locations: ["requirements.md:5"] }, { word: "bill", term: "Invoice", count: 1, locations: ["requirements.md:6"] }]) &&
      gq.length === 3 && gq[0] === "requirements.md:5, requirements.md:7: 'client' — the glossary says Customer (a person or company with a signed contract). Use \"Customer\", or amend .specs/steering/glossary.md if 'client' means something else here." &&
      gDoc.status === "warn" && /^4 use\(s\) of words the glossary says to avoid — 'client' → Customer \(requirements\.md:5, requirements\.md:7\)/.test(gDoc.detail),
      "1.16 Q3: glossary entries (a sub-line's _Avoid:_, 'Term:' form; comments and fenced code hold none); spec_clarify asks about each avoided word (file:line, the term to use; `glossary` field) — never inside a comment, a code span, fenced code, a _Supersedes:_ tag or the term 'End user'; a plural counts; doctor warns glossary with the count (got " + js([cl1.glossary, gDoc.detail]) + ")");
    const br1 = S.taskBrief(q3, "invoices", 1), br2 = S.taskBrief(q3, "invoices", 2), bw = S.taskBrief(q3, "invoices", 1, { write: true });
    ok(js((br1.glossary || []).map((g) => g.term)) === js(["Customer", "Invoice"]) && /\n## Glossary \(terms this task uses\)\n/.test(br1.brief) &&
      /\n- \*\*Customer\*\* — a person or company with a signed contract _\(avoid: client, user\)_\n/.test(br1.brief) && !br2.glossary && !/## Glossary/.test(br2.brief) &&
      js(bw.refs.glossary) === js(["Customer", "Invoice"]) && bw.glossary === undefined,
      "1.16 Q3: the brief quotes the glossary entries the task's text and criteria use (term, definition, words to avoid) — none for an unrelated task; write:true keeps refs.glossary only (got " + js(br1.glossary) + ")");
    // PT: the stub, the questions and the doctor in Portuguese; the `_Avoid:_` marker stays English.
    const q3pt = qDir("q3pt");
    S.initProject(q3pt, ["core"], "pt");
    S.createFeature(q3pt, "Faturas", ["core"], "x", undefined, "pt");
    const scPt = S.scaffoldSteeringFile(q3pt, "glossary.md");
    const ptStub = fs.readFileSync(scPt.file, "utf8");
    fs.writeFileSync(scPt.file, "# Glossário\n\n- **Cliente** — pessoa ou empresa com contrato assinado. _Avoid: comprador, consumidor_\n");
    reqOf(q3pt, "faturas", "1. **US-1.AC-1** — QUANDO os compradores pagarem O SISTEMA DEVE emitir a fatura ao Cliente\n", "### US-1 (P1): História\n#### Critérios de Aceitação (EARS)\n");
    const ptQ = S.clarify(q3pt, "faturas").questions.filter((q) => /o glossário diz/.test(q));
    const ptG = qChecks(q3pt, "faturas").find((c) => c.id === "glossary") || {};
    ok(/^# Glossário\n/.test(ptStub) && /_Avoid: \[palavra\], \[palavra\]_/.test(ptStub) &&
      js(ptQ) === js(["requirements.md:5: 'comprador' — o glossário diz Cliente (pessoa ou empresa com contrato assinado). Usa \"Cliente\", ou corrige o .specs/steering/glossary.md se 'comprador' significar outra coisa aqui."]) &&
      /^1 uso\(s\) de palavras que o glossário manda evitar/.test(ptG.detail || ""),
      "1.16 Q3 (PT): the PT stub keeps `_Avoid:_`; 'compradores' (plural) is asked about in Portuguese and doctor warns glossary (got " + js([ptQ, ptG.detail]) + ")");

    // --- 1.16 Q review ---
    // Two features, one criterion each → the cross-feature verdict ("none" | "<kind>:<reason>").
    let pairN = 0;
    const pairOf = (lang, a, b) => {
      const d = qDir("rv-pair-" + ++pairN);
      S.initProject(d, ["core"], lang);
      const head = { en: undefined, pt: "### US-1 (P1): História\n#### Critérios de Aceitação (EARS)\n", es: "### US-1 (P1): Historia\n#### Criterios de Aceptación (EARS)\n" }[lang];
      ["Alpha", "Beta"].forEach((n, i) => { S.createFeature(d, n, ["core"], "x", undefined, lang); reqOf(d, n.toLowerCase(), "1. **US-1.AC-1** — " + [a, b][i] + "\n", head); });
      const p = S.crossFeatureAcs(d).pairs;
      return p.length ? p.map((x) => x.kind + ":" + x.reason).join(",") : "none";
    };
    // Review 1: a negative in the TRIGGER never flips the response's polarity; opposite conditions are never a pair.
    const rv1 = [
      pairOf("en", "IF the payment service cannot be reached THEN THE SYSTEM SHALL retry the charge", "IF the payment service cannot be reached THEN THE SYSTEM SHALL NOT retry the charge"),
      pairOf("en", "WHEN a user can't log in THE SYSTEM SHALL email a reset link", "WHEN a user can't log in THE SYSTEM SHALL NOT email a reset link"),
      pairOf("pt", "SE o serviço de pagamento não puder ser contactado ENTÃO O SISTEMA DEVE repetir a cobrança", "SE o serviço de pagamento não puder ser contactado ENTÃO O SISTEMA NÃO DEVE repetir a cobrança"),
      pairOf("es", "SI el servicio de pago no puede ser contactado ENTONCES EL SISTEMA DEBE reintentar el cobro", "SI el servicio de pago no puede ser contactado ENTONCES EL SISTEMA NO DEBE reintentar el cobro"),
      pairOf("en", "WHEN the email address is not verified THE SYSTEM SHALL send a reminder every 3 days", "WHEN the email address is verified THE SYSTEM SHALL send a reminder every 7 days"),
      pairOf("en", "WHEN the email address is not verified THE SYSTEM SHALL block the checkout", "WHEN the email address is verified THE SYSTEM SHALL block the checkout"),
      pairOf("en", "WHEN an admin deletes a project THE SYSTEM SHALL remove every file of the project", "WHEN a non-admin deletes a project THE SYSTEM SHALL remove every file of the project"),
      pairOf("pt", "QUANDO o utilizador não está verificado O SISTEMA DEVE bloquear o pagamento", "QUANDO o utilizador está verificado O SISTEMA DEVE bloquear o pagamento"),
      pairOf("es", "CUANDO el usuario no está verificado EL SISTEMA DEBE bloquear el pago", "CUANDO el usuario está verificado EL SISTEMA DEBE bloquear el pago"),
      pairOf("en", "WHEN a user is banned THE SYSTEM SHALL ensure the user cannot post comments", "WHEN a user is banned THE SYSTEM SHALL ensure the user can post comments"),
    ];
    ok(js(rv1) === js(["conflict:opposite-modal", "conflict:opposite-modal", "conflict:opposite-modal", "conflict:opposite-modal", "none", "none", "none", "none", "none", "conflict:opposite-modal"]),
      "1.16 Q review 1: the polarity is the RESPONSE's — 'cannot be reached' / 'can't log in' / 'não puder' / 'no puede' in the trigger never hide SHALL vs SHALL NOT (EN / PT / ES); a word negated in one trigger only (not verified / verified, non-admin / admin, não está / está, no está / está) is a complementary condition — no duplicate, no different-numbers conflict; 'cannot' in the response still flips it (got " + js(rv1) + ")");

    // Review 2: a fresh scaffold (every track, EN / PT / ES / pt-BR) with the stub's own example entry and avoided words its
    // template text uses warns about nothing; a slot the user filled in and the user's own heading are still read.
    const rv2 = ["en", "pt", "es", "pt-BR"].map((l) => {
      const d = qDir("rv2-" + l);
      S.initProject(d, ["core"], l);
      S.createFeature(d, "Alpha", ["core", "tdd", "saas", "ai", "sec", "privacy"], "x", undefined, l);
      const g = S.scaffoldSteeringFile(d, "glossary.md");
      const stub = fs.readFileSync(g.file, "utf8");
      const example = (stub.match(/- \*\*(?:Customer|Cliente)\*\*[^\n]*_Avoid:[^\n]*_/) || [""])[0];
      fs.writeFileSync(g.file, stub + "\n" + example + "\n- **Account** — x. _Avoid: user, users, utilizador, usuario, usuário, story, história, historia, tenant, inquilino_\n");
      const c = S.clarify(d, "alpha");
      const gd = qChecks(d, "alpha").find((x) => x.id === "glossary") || {};
      return l + ":" + (example ? "ex" : "no-ex") + ":" + gd.status + ":" + (c.glossary ? c.glossary.map((h) => h.word).join("/") : "-");
    });
    const d2 = qDir("rv2-en");
    const rq2 = path.join(d2, ".specs", "alpha", "requirements.md");
    fs.writeFileSync(rq2, fs.readFileSync(rq2, "utf8").replace(/^### US-1 \(P1 — MVP\): \[Story Title\]$/m, "### US-1 (P1 — MVP): Tenant onboarding for each user").replace("## Out of Scope", "## Story notes"));
    const rv2b = (S.clarify(d2, "alpha").glossary || []).map((h) => h.word + "@" + h.locations.join("|"));
    ok(js(rv2) === js(["en:ex:pass:-", "pt:ex:pass:-", "es:ex:pass:-", "pt-BR:ex:pass:-"]) && rv2b.length === 3 && rv2b.every((x) => /@requirements\.md:\d+$/.test(x)) && rv2b.some((x) => /^story@/.test(x)),
      "1.16 Q review 2: the glossary never reads template text — a fresh scaffold of every track in EN / PT / ES / pt-BR with the stub's example entry and avoided words its headings, track criteria and slot examples use gives no glossary warning; a filled slot ('Tenant onboarding for each user') and the user's own heading ('Story notes') are read (got " + js([rv2, rv2b]) + ")");

    // Review 3: a fileMatch file is recorded at approval even before tasks.md names a file, and counts once the feature's
    // CURRENT _Implements:_ match it — never for a feature whose files don't.
    const q3r = qDir("rv3");
    S.initProject(q3r, ["core"], "en");
    steer(q3r, "api-rules.md", "---\ninclusion: fileMatch\nfileMatchPattern: \"src/api/**\"\n---\n# API rules\n- JSON only\n");
    ["Api", "Export"].forEach((n) => S.createFeature(q3r, n, ["core"], "x", undefined, "en"));
    for (const f of ["api", "export"]) approveAll(q3r, f, ["classification", "requirements"]); // tasks.md is still the template
    fs.writeFileSync(path.join(q3r, ".specs", "api", "tasks.md"), "# Tasks\n\n- [ ] 1. Build the API\n  - _Implements: src/api/users.js_\n");
    fs.writeFileSync(path.join(q3r, ".specs", "export", "tasks.md"), "# Tasks\n\n- [ ] 1. Export CSV\n  - _Implements: src/export/csv.js_\n");
    const recorded = Object.keys(S.readState(q3r, "api").approvals.requirements.steering || {});
    steer(q3r, "api-rules.md", "---\ninclusion: fileMatch\nfileMatchPattern: \"src/api/**\"\n---\n# API rules\n- JSON only\n- Pagination by cursor\n");
    const w3 = (f) => (qChecks(q3r, f).find((c) => c.id === "steering-changed-since-approval") || {}).detail || "";
    const w3api = w3("api"), w3exp = w3("export");
    const im3 = S.impactReport(q3r, undefined, { phase: "steering" }).features.map((f) => f.feature);
    // An approval recorded before steeringMatch existed counts every file it recorded (the old rule recorded matching ones only).
    const ep = path.join(q3r, ".specs", "export", ".state.json");
    const est = JSON.parse(fs.readFileSync(ep, "utf8"));
    delete est.approvals.requirements.steeringMatch;
    fs.writeFileSync(ep, JSON.stringify(est, null, 2));
    ok(js(recorded) === js(["api-rules.md", "constitution.md"]) && /api-rules\.md \(changed\)/.test(w3api) && w3exp === "" && js(im3) === js(["api"]) &&
      /api-rules\.md \(changed\)/.test(w3("export")),
      "1.16 Q review 3: a fileMatch steering file is fingerprinted at the requirements approval although tasks.md named no file yet; once the feature's tasks implement src/api/… its change warns there — not in the feature implementing src/export/…; a record without steeringMatch keeps the old rule (got " + js([recorded, w3api, w3exp, im3]) + ")");

    // Review 4: roles, directions and number order matter; one differing word of five is no duplicate; the true positives hold.
    const rv4 = [
      pairOf("en", "WHEN a buyer rates a seller THE SYSTEM SHALL record the rating", "WHEN a seller rates a buyer THE SYSTEM SHALL record the rating"),
      pairOf("en", "WHEN the admin resets a password THE SYSTEM SHALL email the user", "WHEN the user resets a password THE SYSTEM SHALL email the admin"),
      pairOf("en", "WHEN a user transfers money from savings to checking THE SYSTEM SHALL charge no fee", "WHEN a user transfers money from checking to savings THE SYSTEM SHALL charge no fee"),
      pairOf("en", "WHEN a user fails 5 attempts THE SYSTEM SHALL lock the account for 15 minutes", "WHEN a user fails 15 attempts THE SYSTEM SHALL lock the account for 5 minutes"),
      pairOf("en", "WHEN a guest opens the dashboard THE SYSTEM SHALL show the chart", "WHEN a guest opens the dashboard THE SYSTEM SHALL show the table"),
      pairOf("en", "WHEN a user resets the password THE SYSTEM SHALL send a reset link by email within 1 minute", "WHEN a user resets their password THE SYSTEM SHALL send a reset link by email within 1 minute"),
      pairOf("en", "WHEN an order total exceeds 1,000 EUR THE SYSTEM SHALL require a manager approval", "WHEN an order total exceeds 1000 EUR THE SYSTEM SHALL require a manager approval"),
      pairOf("en", "WHEN a user logs in THE SYSTEM SHALL record the login time in the audit log", "WHEN a user logs out THE SYSTEM SHALL record the logout time in the audit log"),
      pairOf("en", "WHEN a guest opens the dashboard THE SYSTEM SHALL show the revenue chart", "WHEN a guest opens the dashboard THE SYSTEM SHALL NOT show the revenue chart"),
    ];
    ok(js(rv4) === js(["none", "none", "none", "conflict:different-numbers", "none", "duplicate:near-duplicate", "duplicate:near-duplicate", "none", "conflict:opposite-modal"]),
      "1.16 Q review 4: clause- and order-aware — buyer/seller swapped, admin/user swapped across trigger and response, savings→checking vs checking→savings are no duplicate; '5 attempts … 15 minutes' vs '15 attempts … 5 minutes' is a different-numbers conflict (numbers paired with their unit); one word of five differing (0.8) is no duplicate (strictly more than 0.8 per clause); the true duplicate, 1,000 = 1000, login/logout none and SHALL vs SHALL NOT stay (got " + js(rv4) + ")");

    // Review 5: the cross-feature table is cached across calls (file signatures) — a warm call is much cheaper than a cold one,
    // an edit is picked up at once, and next_action (whose own doctor may skip the warn-only check) keeps doctor's verdict.
    // Rewritten (a new signature: the cold call), then dated a minute back — a file modified in the last 2 s is never trusted.
    const past = new Date(Date.now() - 60000);
    const touchAll = () => {
      for (let f = 0; f < 50; f++) {
        const fp = path.join(q2t, ".specs", "feature-" + f, "requirements.md");
        fs.writeFileSync(fp, fs.readFileSync(fp, "utf8") + "\n");
        for (const x of [fp, path.join(q2t, ".specs", "feature-" + f, ".state.json")]) fs.utimesSync(x, past, past);
      }
    };
    touchAll();
    t0 = Date.now();
    const xCold = S.crossFeatureAcs(q2t);
    const msCold = Date.now() - t0;
    const warm = [];
    for (let i = 0; i < 3; i++) { t0 = Date.now(); S.crossFeatureAcs(q2t); warm.push(Date.now() - t0); }
    const msWarm = Math.min(...warm);
    const f7 = path.join(q2t, ".specs", "feature-7", "requirements.md"), f8 = path.join(q2t, ".specs", "feature-8", "requirements.md");
    const f7raw = fs.readFileSync(f7, "utf8");
    fs.writeFileSync(f7, f7raw + "21. **US-1.AC-21** — WHEN a webhook delivery fails twice THE SYSTEM SHALL pause the webhook subscription\n");
    fs.writeFileSync(f8, fs.readFileSync(f8, "utf8") + "21. **US-1.AC-21** — WHEN a webhook delivery fails twice THE SYSTEM SHALL NOT pause the webhook subscription\n");
    const added = S.crossFeatureAcs(q2t).pairs.filter((p) => p.a.id === "US-1.AC-21" && p.b.id === "US-1.AC-21").map((p) => p.a.feature + "~" + p.b.feature + ":" + p.kind);
    fs.writeFileSync(f7, f7raw);
    const gone = S.crossFeatureAcs(q2t).pairs.filter((p) => p.a.id === "US-1.AC-21" || p.b.id === "US-1.AC-21").length;
    const dv = S.specDoctor(q2, "alpha"), nv = S.nextAction(q2, "alpha");
    ok(msWarm * 2 <= msCold + 10 && js(S.crossFeatureAcs(q2t).pairs.length) === js(xCold.pairs.length) && msWarm < 3000 && js(added) === js(["feature-7~feature-8:conflict"]) && gone === 0 &&
      dv.checks.some((c) => c.id === "cross-feature-acs") && nv.verdict === dv.verdict,
      "1.16 Q review 5: cross-call cache — 50 features × 20 criteria: cold " + msCold + " ms, warm " + msWarm + " ms (warm ≤ half); an edited requirements.md is re-read at once (a new conflict appears, then disappears); doctor still reports cross-feature-acs and next_action's verdict equals doctor's (got " + js([added, gone, nv.verdict, dv.verdict]) + ")");

    // Review 6: glossary parsing — `_client_` is the word client (snake_case isn't), a loose list's indented _Avoid:_ paragraph
    // belongs to its entry, and a glossary past 300 entries says so (doctor warn + clarify's glossaryTruncated).
    const q6 = qDir("rv6");
    S.initProject(q6, ["core"], "en");
    S.createFeature(q6, "Invoices", ["core"], "x", undefined, "en");
    reqOf(q6, "invoices", "1. **US-1.AC-1** — WHEN the _client_ uploads a file THE SYSTEM SHALL store it in the __org__ bucket\n2. **US-1.AC-2** — THE SYSTEM SHALL keep client_id and org_name unchanged\n");
    steer(q6, "glossary.md", "# Glossary\n\n- **Customer** — a person with a contract. _Avoid: client_\n- **Workspace** — the tenant's container.\n\n  _Avoid: org_\n\n- **Invoice** — a bill.\n");
    const e6 = S.glossaryEntries(path.join(q6, ".specs")).entries.map((e) => e.term + ":" + e.avoid.join("/"));
    const g6 = (S.clarify(q6, "invoices").glossary || []).map((h) => h.word + "@" + h.locations.join("|"));
    let many = "# Glossary\n\n";
    for (let i = 0; i < 305; i++) many += `- **Term${i}** — definition ${i}. _Avoid: zzword${i}_\n`;
    steer(q6, "glossary.md", many);
    const c6 = S.clarify(q6, "invoices"), d6 = qChecks(q6, "invoices").find((c) => c.id === "glossary") || {};
    const g6e = S.glossaryEntries(path.join(q6, ".specs"));
    ok(js(e6) === js(["Customer:client", "Workspace:org", "Invoice:"]) && js(g6) === js(["client@requirements.md:5", "org@requirements.md:5"]) &&
      g6e.entries.length === 300 && g6e.total === 305 && g6e.truncated === true && js(c6.glossaryTruncated) === js({ read: 300, total: 305 }) &&
      /only the first 300 are read/.test(c6.glossaryNote || "") && d6.status === "warn" && /glossary\.md holds 305 entries — only the first 300 are read/.test(d6.detail || ""),
      "1.16 Q review 6: `_client_` / `__org__` (underscore emphasis) are read, client_id / org_name are not; a loose list's indented `_Avoid:_` paragraph after a blank line belongs to its entry; 305 entries → the first 300 read, doctor warns and clarify reports glossaryTruncated {read, total} (got " + js([e6, g6, c6.glossaryTruncated, d6.detail]) + ")");

    // Verify NEW-2: the cross-call criteria cache is keyed by the call's ghost markers too. Yankee used the audit pack (its
    // .state.json packMarkers); the pack is deleted (Yankee's ghost [AUDIT] makes Xray's [AUDIT] criteria inactive everywhere), then
    // Yankee is removed — no ghost left, so Xray's [AUDIT] criterion is an ordinary one again and conflicts with Zulu's, as a fresh
    // process says. Files are dated a minute back: a file modified in the last 2 s is never trusted, which would hide the cache.
    const vq = qDir("verify-ghost");
    S.initProject(vq, ["core"], "en");
    fs.mkdirSync(path.join(vq, ".specs", "tracks", "audit"), { recursive: true });
    fs.writeFileSync(path.join(vq, ".specs", "tracks", "audit", "track.json"), js({ name: "audit", marker: "AUDIT", title: { en: "Audit trail" }, sections: [{ name: "Audit log" }] }));
    const vqY = S.createFeature(vq, "Yankee", ["core", "audit"], "y", undefined, "en");
    S.createFeature(vq, "Xray", ["core"], "x", undefined, "en");
    S.createFeature(vq, "Zulu", ["core"], "z", undefined, "en");
    reqOf(vq, "xray", "- US-1.AC-1: WHEN a clerk prints an invoice THE SYSTEM SHALL add the company logo\n\n#### [AUDIT] Audit\n\n- US-1.AC-2: WHEN an admin deletes a record THE SYSTEM SHALL keep a tombstone copy\n");
    reqOf(vq, "zulu", "- US-1.AC-1: WHEN a guest opens the page THE SYSTEM SHALL show a banner\n- US-1.AC-2: WHEN an admin deletes a record THE SYSTEM SHALL NOT keep a tombstone copy\n");
    const vqPast = new Date(Date.now() - 60000);
    for (const f of ["xray", "zulu", "yankee"]) for (const x of ["requirements.md", ".state.json"]) fs.utimesSync(path.join(vq, ".specs", f, x), vqPast, vqPast);
    const vqPairs = () => js(S.crossFeatureAcs(vq).pairs.map((q) => q.kind + ":" + q.a.feature + "/" + q.a.id + "~" + q.b.feature + "/" + q.b.id));
    const vq1 = vqPairs();
    fs.rmSync(path.join(vq, ".specs", "tracks"), { recursive: true, force: true });
    const vq2 = [vqPairs(), vqPairs()];
    const vqRm = S.manageFeature(vq, "remove", "yankee", null, { confirm: true });
    const vq3 = vqPairs();
    const vqFresh = spawnSync(process.execPath, ["-e", "const S = require(process.argv[1]); console.log(JSON.stringify(S.crossFeatureAcs(process.argv[2]).pairs.map((q) => q.kind + ':' + q.a.feature + '/' + q.a.id + '~' + q.b.feature + '/' + q.b.id)))",
      path.join(__dirname, "lib", "spec.js"), vq], { encoding: "utf8", timeout: 60000 });
    ok(vqY.ok && vq1 === "[]" && js(vq2) === js(["[]", "[]"]) && vqRm.ok && vq3 === js(["conflict:xray/US-1.AC-2~zulu/US-1.AC-2"]) && (vqFresh.stdout || "").trim() === vq3,
      "1.16 verify NEW-2: the cross-feature criteria cache follows the call's ghost markers — once the feature holding a deleted pack's marker is removed, a long-lived process reports the conflict a fresh process reports (got " +
      js([vq1, vq2, vq3, (vqFresh.stdout || "").trim(), vqFresh.stderr && vqFresh.stderr.slice(0, 200)]) + ")");
  }

  // 1.19 package (R) — reuse and clean code.
  {
    const js = (v) => JSON.stringify(v);
    const call = (name, args) => rpc("tools/call", { name, arguments: args });
    const I = require("./lib/i18n.js");
    const rRd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n");
    const rDir = (n) => path.join(tmp, "p19r-" + n);
    const chk = (d, id) => (d.checks || []).find((c) => c.id === id) || {};
    const reuseSt = (d) => chk(d, "design-reuse").status || "-";
    const st3 = (d) => ["design-tradeoffs", "design-risks", "design-reuse"].map((id) => chk(d, id).status || "-").join(",");
    const wDesign = (f, text) => fs.writeFileSync(path.join(f.dir, "design.md"), text);
    const readSt = (f) => JSON.parse(fs.readFileSync(path.join(f.dir, ".state.json"), "utf8"));
    const writeSt = (f, s) => fs.writeFileSync(path.join(f.dir, ".state.json"), JSON.stringify(s, null, 2));
    const cut = (t, from, to) => t.slice(t.indexOf(from), t.indexOf(to));
    const REQ = "# Feature: Orders\n\n## Summary\nPlace an order.\n\n## User Stories\n### US-1 (P1): Place an order\nAs a buyer I want to order.\n**Independent Test:** place one order.\n\n" +
      "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the buyer submits a cart THE SYSTEM SHALL store the order.\n" +
      "2. **US-1.AC-2** — IF the cart is empty THEN THE SYSTEM SHALL reject it.\n\n## Success Criteria\n- **SC-001** — 95% of orders placed in under 2 s.\n\n" +
      "## Edge Cases & Error Handling\n- **EC-1** — WHEN stock runs out THE SYSTEM SHALL refuse the order.\n\n## Non-Functional Requirements\n- **NFR-1** — p95 < 2 s.\n\n## Out of Scope\n- Refunds.\n";
    const ALT = "## Alternatives & Trade-offs\n| Decision | Option | Pros | Cons | Cost if wrong | Chosen |\n|---|---|---|---|---|---|\n" +
      "| Storage | One table | Simple | Wide rows | A migration later | ✓ |\n| Storage | Two tables | Normalized | A join per read | Slower reads | ✗ |\n\n";
    const RISKS = "## Risks\n| Risk | Likelihood | Impact | Mitigation | Owner |\n|---|---|---|---|---|\n| Lost order on a crash | low | high | One transaction per order | backend |\n\n";
    const REUSE = "## Reuse & Integration\n| Kind | What | Where (path) | Why / notes |\n|---|---|---|---|\n" +
      "| Reuse | `withRetry` | `src/lib/http/retry.ts` | the same backoff as the rest of the app |\n" +
      "| Extend | `Money` | `src/lib/money.ts` | adds allocate(); existing callers unchanged |\n" +
      "| New | the order store | `src/orders/store.ts` | nothing stores orders yet (searched store, repository, persist) |\n\n" +
      "**Module boundaries:** src/orders/ imports src/lib/, never the reverse.\n\n";
    const design = (reuse) => "# Design: Orders\n\n## Overview\nOrders are stored.\n\n## Architecture\n```mermaid\ngraph TD\n  A[API] --> S[Store]\n```\n\n" + reuse + ALT +
      "## Data Models\nOrder {id, total}.\n\n## Testing Strategy\nUnit tests.\n\n" + RISKS + "## Constitution Check\n- [x] Small functions — complies.\n\n## Complexity Tracking\nNone.\n";

    // R1 — a fresh scaffold, EN / PT / ES / pt-BR: Reuse & Integration between Architecture and Alternatives & Trade-offs, holding
    // template slots the placeholder lookup knows (the corpus renders them) — and no design-reuse check while design.md is a later
    // phase's template.
    const H = {
      en: ["## Architecture", "## Reuse & Integration", "## Alternatives & Trade-offs", "[existing module, component, helper or service]", "[its path]"],
      pt: ["## Arquitetura", "## Reutilização e Integração", "## Alternativas e Compromissos", "[módulo, componente, helper ou serviço existente]", "[o seu caminho]"],
      es: ["## Arquitectura", "## Reutilización e Integración", "## Alternativas y Compensaciones", "[módulo, componente, helper o servicio existente]", "[su ruta]"],
      "pt-BR": ["## Arquitetura", "## Reutilização e Integração", "## Alternativas e Compromissos", "[módulo, componente, helper ou serviço existente]", "[o seu caminho]"],
    };
    const fresh = Object.keys(H).map((lang) => {
      const p = rDir("fresh-" + lang);
      S.initProject(p, ["core"], lang);
      const f = S.createFeature(p, "Orders", ["core", "tdd", "saas"], "", undefined, lang);
      const t = fs.readFileSync(path.join(f.dir, "design.md"), "utf8");
      const at = H[lang].slice(0, 3).map((h) => t.indexOf(h + "\n"));
      const slots = S.featurePlaceholders(p, f.slug, "design.md").items.map((x) => x.text);
      const good = at.every((i) => i >= 0) && at[0] < at[1] && at[1] < at[2] && slots.includes(H[lang][3]) && slots.includes(H[lang][4]) &&
        reuseSt(S.specDoctor(p, f.slug)) === "-";
      return { lang, good, at, slots: slots.filter((s) => s === H[lang][3] || s === H[lang][4]) };
    });
    ok(fresh.every((r) => r.good),
      "1.19 R1: a fresh design.md (EN / PT / ES / pt-BR, +tdd +saas) has Reuse & Integration between Architecture and Alternatives & Trade-offs, its slots read as template placeholders; while design.md is a later phase's template doctor adds no design-reuse check (got " + js(fresh) + ")");

    // R1 — the gate: the section still template → the design approval is refused on `placeholders` (like every template section);
    // filled → pass; empty → warn; one line of prose ("greenfield") → pass; deleted → warn only (readyToAdvance, the approval goes
    // through unforced) and the approval is stamped `reuse: true` — a 1.19 approval keeps the warn.
    const gp = rDir("gate");
    S.initProject(gp, ["core"], "en");
    const gf = S.createFeature(gp, "Orders", ["core"]);
    fs.writeFileSync(path.join(gf.dir, "requirements.md"), REQ);
    approveBefore(gp, gf.slug, "design");
    const tpl = fs.readFileSync(path.join(gf.dir, "design.md"), "utf8");
    const tplReuse = cut(tpl, "## Reuse & Integration", "## Alternatives & Trade-offs");
    wDesign(gf, design(tplReuse));
    const gDocT = S.specDoctor(gp, gf.slug);
    const gApT = S.approvePhase(gp, gf.slug, "design", "t");
    wDesign(gf, design(REUSE));
    const gDocF = S.specDoctor(gp, gf.slug);
    const gMcp = payload(await call("spec_doctor", { projectDir: gp, name: gf.slug }));
    wDesign(gf, design("## Reuse & Integration\n\n"));
    const gDocE = S.specDoctor(gp, gf.slug);
    wDesign(gf, design("## Reuse & Integration\nGreenfield: nothing to reuse yet — the first module of the app.\n\n"));
    const gDocP = S.specDoctor(gp, gf.slug);
    wDesign(gf, design(""));
    const gDocDel = S.specDoctor(gp, gf.slug);
    const gSave = S.designSaveCheck(gp, gf.slug);
    const gAp = S.approvePhase(gp, gf.slug, "design", "t");
    const gSt = readSt(gf);
    const gDocAfter = S.specDoctor(gp, gf.slug);
    ok(gApT.ok === false && js(gApT.failing) === js(["placeholders"]) && /\[existing module, component, helper or service\]/.test(gApT.checks[0].detail) &&
      reuseSt(gDocT) === "warn" && /^Reuse & Integration is still the template/.test(chk(gDocT, "design-reuse").detail) &&
      st3(gDocF) === "pass,pass,pass" && chk(gDocF, "design-reuse").detail === "3 item(s) named (reused / extended / new)" &&
      st3(gMcp) === "pass,pass,pass" && gMcp.checks.findIndex((c) => c.id === "design-reuse") === gMcp.checks.findIndex((c) => c.id === "design-risks") + 1 &&
      reuseSt(gDocE) === "warn" && /^Reuse & Integration is empty/.test(chk(gDocE, "design-reuse").detail) &&
      reuseSt(gDocP) === "pass" && /^written \(no row or bullet/.test(chk(gDocP, "design-reuse").detail) &&
      reuseSt(gDocDel) === "warn" && /^no Reuse & Integration section/.test(chk(gDocDel, "design-reuse").detail) && gDocDel.readyToAdvance === true &&
      gDocDel.checks.every((c) => c.status !== "fail") && gSave.reuse === "missing" && gSave.clean === true && /\n  ▲ no Reuse & Integration section/.test(gSave.text) &&
      gAp.ok === true && !gAp.forced && gSt.approvals.design.reuse === true && gSt.approvals.design.weigh === true &&
      gSt.approvalHistory[gSt.approvalHistory.length - 1].reuse === true && gSt.approvals.requirements.reuse === undefined && reuseSt(gDocAfter) === "warn",
      "1.19 R1: the Reuse & Integration slots refuse the design approval on placeholders only; filled → design-reuse passes (MCP too, right after design-risks); empty → warn; a line of prose ('greenfield') passes; deleted → warn, readyToAdvance, the approval goes through unforced and stamps reuse: true (approval + history, design only) — the 1.19 approval keeps the warn; the design-save check notes it with ▲ (got " +
      js([gApT.failing, reuseSt(gDocT), st3(gDocF), chk(gDocF, "design-reuse").detail, reuseSt(gDocE), reuseSt(gDocP), reuseSt(gDocDel), gSave.reuse, gAp.ok, gSt.approvals.design, reuseSt(gDocAfter)]) + ")");

    // R1 — the stamp scheme: a design approval without `reuse` (made by 1.17 / 1.18: `weigh` only) is never flagged by design-reuse
    // (a pass with 'approved before 1.19') while design-tradeoffs still warns for it; without `weigh` either (pre-1.17) nothing warns.
    // spec_upgrade lists a 1.19 design-reuse warn under doctor.warnings but never counts it toward `attention`.
    const lSt = readSt(gf);
    delete lSt.approvals.design.reuse;
    writeSt(gf, lSt);
    wDesign(gf, design("").replace(ALT, ""));
    const l17 = S.specDoctor(gp, gf.slug);
    delete lSt.approvals.design.weigh;
    writeSt(gf, lSt);
    const lPre = S.specDoctor(gp, gf.slug);
    const dm = rDir("demo");
    fs.cpSync(path.join(root, "examples", "demo-project"), dm, { recursive: true });
    const dmDoc = S.specDoctor(dm, "api-keys");
    const dmAp = S.approvePhase(dm, "api-keys", "design", "t");
    const dmUp = S.specUpgrade(dm).features.find((x) => x.name === "api-keys");
    ok(st3(l17) === "warn,pass,pass" && /^design approved before 1\.19 — asked only from its next approval \(no Reuse & Integration section/.test(chk(l17, "design-reuse").detail) &&
      st3(lPre) === "pass,pass,pass" && /^design approved before 1\.17/.test(chk(lPre, "design-tradeoffs").detail) && /^design approved before 1\.19/.test(chk(lPre, "design-reuse").detail) &&
      /^design aprovado antes da 1\.19 — só é exigido/.test(I.msg("pt").designWeigh.legacyApproval("x", "1.19")) && /^diseño aprobado antes de la 1\.19/.test(I.msg("es").designWeigh.legacyApproval("x", "1.19")) &&
      /^design aprovado antes da 1\.19/.test(I.msg("pt-BR").designWeigh.legacyApproval("x", "1.19")) && /antes de la 1\.17/.test(I.msg("es").designWeigh.legacyApproval("x")) &&
      reuseSt(dmDoc) === "pass" && dmAp.ok === true && dmUp.doctor.warnings.includes("design-reuse") && !dmUp.attention.includes("warnings"),
      "1.19 R1: a 1.17 / 1.18 design approval (weigh, no reuse) → design-reuse passes with 'approved before 1.19' while design-tradeoffs still warns; an unstamped (pre-1.17) one → all three pass (EN / PT / ES / pt-BR notes); spec_upgrade lists a 1.19 design-reuse warn under doctor.warnings without the 'warnings' attention (got " +
      js([st3(l17), chk(l17, "design-reuse").detail, st3(lPre), reuseSt(dmDoc), dmAp.ok, dmUp.doctor.warnings, dmUp.attention]) + ")");

    // R1 — exempt: a bugfix (bug.md stands in for its design) and a spike (its own doctor).
    const ep = rDir("exempt");
    S.initProject(ep, ["core"], "en");
    const bf = S.createFeature(ep, "Crash on save", ["tdd"], "", undefined, "en", "bugfix");
    wDesign(bf, "# Design: Crash on save\n\n## Notes\nThe fix stays inside the save handler.\n");
    const sp = S.createFeature(ep, "Queue spike", undefined, "Kafka or RabbitMQ?", undefined, "en", "spike");
    const bDoc = S.specDoctor(ep, bf.slug), sDoc = S.specDoctor(ep, sp.slug);
    ok(reuseSt(bDoc) === "-" && S.designSaveCheck(ep, bf.slug).reuse === null && reuseSt(sDoc) === "-" && sDoc.ok !== false,
      "1.19 R1: a bugfix and a spike are exempt (no design-reuse check; the bugfix's design-save check reports reuse: null) (got " + js([reuseSt(bDoc), reuseSt(sDoc)]) + ")");

    // R1 — hand-written headings (EN / PT / ES / pt-BR synonyms — the heading must NAME the section, never a modifier), localized
    // details, and a brownfield feature's integration-plan.md → Integration Points standing in for a missing section.
    const hp = rDir("hand");
    S.initProject(hp, ["core"], "en");
    const hand = (sec) => "# Design\n\n## Overview\nx.\n\n## Architecture\n```mermaid\ngraph TD\n  A-->B\n```\n\n" + sec + "\n## Constitution Check\n- [x] ok\n";
    const cases = [["en", "## Reuse and integration\n- Reuse `src/lib/http.ts` as is.\n", "pass"],
      ["en", "## Existing components: what we build on\n- `src/components/Button.tsx` as is.\n", "pass"],
      ["en", "## Integration Points\n- The order service (`src/orders/service.ts`).\n", "pass"],
      ["en", "## Code reuse\nGreenfield: nothing to reuse yet.\n", "pass"],
      ["en", "## Reuse-based caching\n- A cache in front of the store.\n", "warn"],
      ["en", "## Existing code paths\n- The checkout flow.\n", "warn"],
      ["pt", "## Reutilização e integração\n- Reutilizar `src/lib/http.ts` tal como está.\n", "pass"],
      ["pt", "## Pontos de Integração\n- O serviço de encomendas.\n", "pass"],
      ["pt-BR", "## Reúso\n- `src/lib/http.ts` como está.\n", "pass"],
      ["es", "## Componentes existentes\n- `src/lib/http.ts` tal cual.\n", "pass"],
      ["es", "## Reutilización e Integración\n- Reutilizar `src/lib/http.ts` tal cual.\n", "pass"],
      ["pt-BR", "", "warn"]];
    const handGot = cases.map(([lang, sec], i) => {
      const f = S.createFeature(hp, "Hand " + i, ["core"], "", undefined, lang);
      wDesign(f, hand(sec));
      const d = S.specDoctor(hp, f.slug);
      return [lang, reuseSt(d), chk(d, "design-reuse").detail];
    });
    const bp = rDir("brownfield");
    S.initProject(bp, ["core"], "en");
    const bw = S.createFeature(bp, "Orders", ["core"], "", undefined, "en", undefined, { brownfield: true });
    fs.writeFileSync(path.join(bw.dir, "requirements.md"), REQ);
    approveBefore(bp, bw.slug, "design"); // the design is the current phase: its template section is checked (a warn)
    wDesign(bw, design(""));
    const bwTpl = S.specDoctor(bp, bw.slug);
    fs.writeFileSync(path.join(bw.dir, "integration-plan.md"), "# Integration Plan: Orders\n\n## Integration Points\n- `src/orders/service.ts` — the order service this feature extends.\n" +
      "- `src/lib/db.ts` — the shared database client, reused as is.\n\n## Required Modifications\n- The service gains a store() method.\n\n## Sequencing\n- Phase 1: the store.\n\n" +
      "## Risks & Mitigations\n- None.\n\n## Affected Files (best estimate)\n- src/orders/service.ts → store()\n");
    const bwDoc = S.specDoctor(bp, bw.slug);
    const bwSave = S.designSaveCheck(bp, bw.slug);
    wDesign(bw, design(tplReuse));
    const bwT = S.specDoctor(bp, bw.slug);
    ok(handGot.every((g, i) => g[1] === cases[i][2]) && handGot[6][2] === "1 item(ns) indicado(s) (reutilizado / estendido / novo)" &&
      handGot[9][2] === "1 elemento(s) indicado(s) (reutilizado / extendido / nuevo)" && /^sem seção Reutilização e Integração — indique/.test(handGot[11][2]) &&
      reuseSt(bwTpl) === "warn" && /^no Reuse & Integration section/.test(chk(bwTpl, "design-reuse").detail) &&
      reuseSt(bwDoc) === "pass" && chk(bwDoc, "design-reuse").detail === "covered by integration-plan.md → Integration Points (2 item(s))" &&
      bwSave.reuse === "integration" && !/▲ no Reuse/.test(bwSave.text) && reuseSt(bwT) === "warn",
      "1.19 R1: hand-written Reuse and integration / Existing components: … / Integration Points / Code reuse / Reutilização e integração / Pontos de Integração / Reúso / Componentes existentes / Reutilización e Integración pass (localized details), 'Reuse-based caching' and 'Existing code paths' don't name the section; a brownfield feature's filled integration-plan.md → Integration Points covers a missing section (the template plan doesn't), a template section still warns (got " +
      js([handGot, reuseSt(bwTpl), chk(bwDoc, "design-reuse").detail, bwSave.reuse, reuseSt(bwT)]) + ")");

    // R1 — templates check: a project design template without the section warns reuse-missing (localized), a synonym heading
    // doesn't, and the built-in template never does.
    const tp = rDir("tpl");
    S.initProject(tp, ["core"], "en");
    S.templates(tp, "init", { artifact: "design" });
    const tpOk = S.templates(tp, "check");
    const tplDesign = (reuse) => "# Design: {{name}}\n\n## Overview\n[How it works]\n\n" + reuse + "## Alternatives & Trade-offs\n- [option A]\n- [option B]\n\n## Risks\n- [what could go wrong]\n\n## Constitution Check\n- [ ] [Principle 1] — complies\n";
    fs.writeFileSync(path.join(tp, ".specs", "templates", "design.md"), tplDesign(""));
    const tpBad = S.templates(tp, "check");
    fs.writeFileSync(path.join(tp, ".specs", "templates", "design.md"), tplDesign("## Existing components\n- [what this feature reuses]\n\n"));
    const tpSyn = S.templates(tp, "check");
    const tpPt = rDir("tpl-pt");
    S.initProject(tpPt, ["core"], "pt");
    fs.mkdirSync(path.join(tpPt, ".specs", "templates"), { recursive: true });
    fs.writeFileSync(path.join(tpPt, ".specs", "templates", "design.md"), tplDesign(""));
    const tpPtR = S.templates(tpPt, "check");
    const codes = (r) => (r.problems || []).filter((x) => /design/.test(x.file)).map((x) => x.code + ":" + x.severity);
    const ptMsg = ((tpPtR.problems || []).find((x) => x.code === "reuse-missing") || {}).message || "";
    ok(!codes(tpOk).length && codes(tpBad).includes("reuse-missing:warn") && !codes(tpSyn).includes("reuse-missing:warn") && tpBad.verdict === "warn" &&
      /^sem secção Reutilização e Integração — o doctor avisa \(design-reuse\)/.test(ptMsg),
      "1.19 R1: templates check warns reuse-missing on a design template without Reuse & Integration (PT message too), not on one with a synonym heading, never on the built-in one (got " +
      js([codes(tpOk), codes(tpBad), codes(tpSyn), ptMsg]) + ")");

    // R2 — the brief's Reuse section: the design's entries that name the task's file / a sibling / its folder / its ACs (a table row's
    // cells joined), the existing source files next to its own (non-test first, its own file, dot files, docs and ignored folders
    // out); the Reuse & Integration section is no longer quoted whole under "Design context"; write:true keeps refs.reuse.
    const rp = rDir("brief");
    S.initProject(rp, ["core"], "en");
    const rf = S.createFeature(rp, "Orders", ["core"]);
    fs.writeFileSync(path.join(rf.dir, "requirements.md"), REQ);
    const REUSE2 = "## Reuse & Integration\n| Kind | What | Where (path) | Why / notes |\n|---|---|---|---|\n" +
      "| Reuse | the order repository | `src/orders/repo.ts` | reads and writes orders already |\n" +
      "| Extend | `Money` | `src/lib/money.ts` | adds allocate() |\n" +
      "| New | the cart validator | `src/cart/validate.ts` | nothing validates carts (searched validate, check, schema) |\n" +
      "- US-1.AC-2 — an empty cart: reuse `ValidationError` from src/lib/errors.ts\n\n";
    wDesign(rf, design(REUSE2));
    fs.writeFileSync(path.join(rf.dir, "tasks.md"), "# Tasks\n\n## Story US-1 (P1)\n" +
      "- [ ] 1. [US1] Store the order\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/orders/api.ts_\n" +
      "- [ ] 2. [US1] Reject an empty cart\n  - _Requirements: US-1.AC-2_\n  - _Implements: src/cart/validate.ts_\n" +
      "- [ ] 3. [US1] Document the order endpoint\n  - _Requirements: US-1.AC-1_\n" +
      "- [ ] 4. [US1] Many helpers\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/many/_\n" +
      "- [ ] 5. [US1] Vendored\n  - _Requirements: US-1.AC-1_\n  - _Implements: node_modules/lib/x.js_\n");
    const put = (rel, s = "x") => { const p = path.join(rp, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
    for (const n of ["api.ts", "repo.ts", "helpers.ts", "api.test.ts", "README.md", ".hidden.ts"]) put("src/orders/" + n);
    for (let i = 0; i < 30; i++) put("src/many/m" + String(i).padStart(2, "0") + ".ts");
    put("src/many/node_modules/y.js");
    put("node_modules/lib/x.js");
    put("node_modules/lib/z.js");
    const b1 = S.taskBrief(rp, rf.slug, 1), b2 = S.taskBrief(rp, rf.slug, 2), b3 = S.taskBrief(rp, rf.slug, 3), b4 = S.taskBrief(rp, rf.slug, 4), b5 = S.taskBrief(rp, rf.slug, 5);
    const sec = (b) => (b.brief.split("## Reuse — search before you write")[1] || "").split("\n## ")[0];
    const b1W = S.taskBrief(rp, rf.slug, 1, { write: true });
    const b1Mcp = payload(await call("spec_task_brief", { projectDir: rp, name: rf.slug, number: 1, write: true }));
    const b1File = fs.readFileSync(b1W.paths.brief, "utf8");
    ok(js(b1.reuse.entries) === js(["| Reuse | the order repository | `src/orders/repo.ts` | reads and writes orders already |"]) && b1.reuse.total === 4 &&
      js(b1.reuse.files) === js(["src/orders/helpers.ts", "src/orders/repo.ts", "src/orders/api.test.ts"]) && b1.reuse.state === "filled" &&
      /\n- Reuse · the order repository · `src\/orders\/repo\.ts` · reads and writes orders already\n/.test(sec(b1)) && /\n- `src\/orders\/helpers\.ts`\n/.test(sec(b1)) &&
      /search the codebase by concept and synonyms \(references\/code-reuse-and-quality\.md\)/.test(sec(b1)) && !b1.designSections.includes("Reuse & Integration") &&
      b2.reuse.entries.length === 2 && /US-1\.AC-2 — an empty cart/.test(b2.reuse.entries[1]) && !b2.reuse.files.length &&
      !b3.reuse.entries.length && b3.reuse.total === 4 && /lists 4 item\(s\), none naming this task's files or criteria/.test(sec(b3)) &&
      b4.reuse.files.length === 15 && b4.reuse.more === 15 && b4.reuse.files[0] === "src/many/m00.ts" && /…and 15 more in the same folder\(s\)\./.test(sec(b4)) &&
      !b5.reuse.files.length &&
      b1W.reuse === undefined && js(b1W.refs.reuse) === js({ entries: 1, files: ["src/orders/helpers.ts", "src/orders/repo.ts", "src/orders/api.test.ts"] }) &&
      js(b1Mcp.refs.reuse) === js(b1W.refs.reuse) && b1Mcp.reuse === undefined && /## Reuse — search before you write/.test(b1File),
      "1.19 R2: the brief's Reuse section quotes the design's entries naming the task (a sibling file, its own file, its AC; a table row's cells joined by ' · '), says when none does, and lists the existing source files next to its own (non-test first; its own file, dot files, docs, node_modules out; ≤ 15 + 'more'); a Reuse & Integration section not naming the task stays out of Design context; write:true (MCP too) keeps refs.reuse {entries, files} (got " +
      js([b1.reuse, b2.reuse.entries, b3.reuse, b4.reuse.more, b5.reuse, b1W.refs, b1.designSections]) + ")");

    // R2 — bounded: at most 8 entries (the rest counted in `omitted`), a 200,000-character line with no '/' is read once (the path
    // token only starts at a token boundary), the brief is localized (PT).
    const many = "## Reuse & Integration\n" + Array.from({ length: 12 }, (_, i) => `- Reuse \`src/orders/r${i}.ts\` — helper ${i}.\n`).join("") + "- " + "a".repeat(200000) + "\n\n";
    wDesign(rf, design(many));
    const t0 = Date.now();
    const bMany = S.taskBrief(rp, rf.slug, 1);
    const manyMs = Date.now() - t0;
    const ptp = rDir("brief-pt");
    S.initProject(ptp, ["core"], "pt");
    const ptf = S.createFeature(ptp, "Encomendas", ["core"], "", undefined, "pt");
    wDesign(ptf, design("## Reutilização e Integração\n- Reutilizar o repositório (`src/orders/repo.ts`).\n\n"));
    fs.writeFileSync(path.join(ptf.dir, "tasks.md"), "# Tarefas\n\n## História US-1 (P1)\n- [ ] 1. [US1] Guardar a encomenda\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/orders/api.ts_\n");
    const bPt = S.taskBrief(ptp, ptf.slug, 1);
    ok(bMany.reuse.entries.length === 8 && bMany.reuse.omitted === 4 && /4 more matching item\(s\) — read them in design\.md/.test(bMany.brief) && manyMs < 3000 &&
      /## Reutilização — pesquisar antes de escrever\nProcura no código, pelo conceito e por sinónimos/.test(bPt.brief) && /As entradas de Reutilização e Integração do design para esta tarefa/.test(bPt.brief),
      "1.19 R2: the Reuse section is bounded (8 entries, the rest counted), a 200,000-character slash-less line stays fast, and the brief speaks the feature's language (PT) (got " +
      js([bMany.reuse.entries.length, bMany.reuse.omitted, manyMs, (bPt.brief.split("## Reutiliza")[1] || "").slice(0, 160)]) + ")");

    // R3 — the prose: the implementer searches before it writes (a hard step) and reports a Reuse block; the reviewer checks new code
    // against the EXISTING codebase (a duplicate is Important); the controller files refactor candidates in the backlog; /executeTask,
    // red-flags, /design, AGENTS.md and SKILL.md (≤ 5,000 words — 1.21 F3) say so — and none of the new text steers toward PRs or CI.
    const impl = rRd("agents", "spec-implementer.md"), rev = rRd("agents", "spec-reviewer.md"), sub = rRd("skills", "dev-spec-driven", "references", "subagent-execution.md");
    const exec = rRd("commands", "executeTask.md"), flags = rRd("skills", "dev-spec-driven", "references", "red-flags.md"), skill = rRd("skills", "dev-spec-driven", "SKILL.md");
    const dcmd = rRd("commands", "design.md"), agentsMd = rRd("AGENTS.md"), guide = rRd("skills", "dev-spec-driven", "references", "code-reuse-and-quality.md");
    const implSearch = cut(impl, "3. **Search before you write**", "4. If anything is unclear");
    const implReuse = cut(impl, "- **Reuse** — a `### Reuse` block", "- Files changed; commits");
    const revQuality = cut(rev, "### 4. Code quality", "### Calibration");
    const subRefactor = cut(sub, "**Refactor candidates are filed", "## Parallel mode");
    const execReuse = cut(exec, "**Search before you write**", "**Can't run the");
    ok(/concept and at least three synonyms/.test(implSearch) && /brief's \*\*Reuse\*\* section/.test(implSearch) && /\*\*reuse\*\*, else \*\*extend\*\*/.test(implSearch) &&
      /copy-paste/.test(implSearch) && /rule of three/.test(implSearch) && /No new helper, component or client without the search/.test(impl) && /filed, not done/.test(impl) &&
      ["### Reuse", "Reused:", "Extended:", "Created:", "searched:", "Duplicated on purpose:", "Refactor candidates:"].every((w) => implReuse.includes(w)) &&
      /Duplication against the EXISTING codebase, not only inside the diff/.test(revQuality) && /duplicates an existing one is \*\*Important\*\*/.test(revQuality) &&
      /Grep the name's stem and two synonyms/.test(revQuality) && /report's \*\*Reuse\*\* block/.test(revQuality) && /\*\*Minor\*\* unless they hide a defect/.test(revQuality) &&
      /Duplication is always such a risk/.test(rev) && /a new unit duplicating an existing one/.test(rev) &&
      /spec_backlog \{action: "add", name: "refactor-<topic>"/.test(subRefactor) && /Task 3: refactor candidate filed/.test(sub) && /check the report has its \*\*Reuse\*\* block/.test(sub) &&
      /refactor:/.test(execReuse) && /duplicate in the existing codebase/.test(exec) &&
      /"I'll write a quick helper" \| Search first/.test(flags) && /"I'll copy this function and tweak it"/.test(flags) && /rule of three/.test(flags) &&
      /\*\*Reuse & Integration\*\*/.test(skill) && /design-reuse/.test(skill) && /code-reuse-and-quality\.md/.test(skill) && /\*\*Search before you write:\*\*/.test(skill) &&
      skill.split(/\s+/).filter(Boolean).length <= 5000 && /\*\*Every design names what it reuses:\*\*/.test(dcmd) && /design-reuse/.test(dcmd) &&
      /\*\*Reuse & Integration\*\*/.test(agentsMd) && /design-reuse/.test(agentsMd) && /Search before you write/.test(agentsMd) && /design-reuse/.test(guide) &&
      [implSearch, implReuse, revQuality, subRefactor, execReuse].every((t) => t.length > 100 && !/pull request|\bPRs?\b|\bCI\b/.test(t)),
      "1.19 R3: spec-implementer searches before it writes (a hard step: concept + synonyms, reuse → extend → create, no copy-paste) and reports a Reuse block; spec-reviewer checks every new unit against the existing codebase (a duplicate is Important, smells Minor); the controller files refactor candidates in the backlog (subagent-execution.md, /executeTask); red-flags, /design, AGENTS.md and SKILL.md (≤ 5,000 words — 1.21 F3) name them; no PR / CI steering in the new text (got " +
      js([implSearch.length, implReuse.length, revQuality.length, subRefactor.length, execReuse.length, skill.split(/\s+/).filter(Boolean).length]) + ")");

    // 1.22 — the prose of the verify pass, the written-rules / history angle and the simplification pass (adapted from
    // Anthropic's code-review / code-simplifier plugins): the reviewer rates findings and lists what is not one, the
    // controller verifies each before a fix round (80+), /prReview verifies before it reports, the simplifier keeps the
    // feature's lines, never a test, one commit each, and proves it — and none of the new text steers toward PRs or CI.
    const simp = rRd("agents", "spec-simplifier.md"), scmd = rRd("commands", "spec-simplify.md"), prr = rRd("commands", "prReview.md");
    const revNot = cut(rev, "**Not a finding**", "## Re-review mode"), revVerify = cut(rev, "## Verify mode", "## Final mode");
    const revRules = cut(rev, "### 5. Written rules and history", "### Calibration"), revSimp = cut(rev, "## Simplify mode", "## Verify mode");
    const subVerify = cut(sub, "### 6. Verify the findings", "### 7. Fix loop"), subSimp = cut(sub, "## The simplification pass", "## Closing");
    const guideSimp = cut(guide, "## The simplification pass", "## The refactor-candidate backlog");
    ok(["**Pre-existing**", "**Outside the diff's lines**", "**Intended**", "**Disproved by a run**", "**Silenced on purpose**", "**A nitpick**"].every((w) => revNot.includes(w)) &&
      /only \*\*80 or more\*\* there opens a fix round/.test(revNot) && /adapted from Anthropic's `code-review` plugin/.test(revNot) &&
      ["**Exists at HEAD?**", "**Introduced by this diff?**", "**Intended?**", "**Already answered?**"].every((w) => revVerify.includes(w)) && /CONFIRMED \(80\+\) \| UNCONFIRMED \(50–79\) \| REFUTED \(under 50\)/.test(cut(rev, "Verify mode replaces them with:", "Simplify mode keeps")) &&
      /quotes the rule with its file:line/.test(revRules) && /git blame -L <start>,<end> BASE -- <file>/.test(revRules) && /A fixed bug brought back is\s+\*\*Critical\*\*/.test(revRules) &&
      /no test file, fixture or snapshot in the diff \(any is \*\*Critical\*\*/.test(revSimp) &&
      /\*\*80 or more\*\* → confirmed/.test(subVerify) && /\*\*50–79\*\* → unconfirmed/.test(subVerify) && /\*\*Under 50\*\* → refuted/.test(subVerify) && /Task 3: refuted \(20, pre-existing\)/.test(sub) &&
      /\*\*reverted\*\*, not repaired/.test(subSimp) && /dev-spec-driven:spec-simplifier/.test(subSimp) && /Verify pass \(one finding\) \| cheapest/.test(sub) &&
      /\*\*Verify before you report\.\*\*/.test(prr) && /"Unconfirmed \(below 80\)"/.test(prr) && /\*\*History\*\*/.test(prr) && /\*\*Written rules\*\*/.test(prr) &&
      /Only lines the branch added or changed/.test(simp) && /\*\*Never a test\*\*/.test(simp) && /\*\*Never a contract:\*\*/.test(simp) && /commit it alone/.test(simp) &&
      /never edit the test, never fix forward/.test(simp) && /\*\*Final runs\*\* — LAST in the file/.test(simp) && /NO_CHANGES/.test(simp) && /Adapted from Anthropic's `code-simplifier` plugin/.test(simp) &&
      /\*\*before\*\*\s+`\/spec-finish`/.test(scmd) && /\*\*reverted\*\* \(`git revert <sha>`\)/.test(scmd) && /done <feature> <n> --run/.test(scmd) && /Never "behaviour unchanged" without the runs/.test(scmd) &&
      /\| Never a test, fixture or snapshot \|/.test(guideSimp) && /\/spec-simplify/.test(skill) && /\/spec-simplify/.test(exec) && /verify-mode reviewer/.test(exec) &&
      /agents\/spec-reviewer\.md` → Verify mode/.test(agentsMd) && /commands\/spec-simplify\.md/.test(agentsMd) &&
      [revNot, revVerify, revRules, revSimp, subVerify, subSimp, guideSimp, simp, scmd].every((t) => t.length > 200 && !/pull request|\bPRs?\b|\bCI\b/.test(t)),
      "1.22: spec-reviewer rates findings, lists what is not one, verifies one finding fresh (verify mode), checks the written rules + history and a simplification diff (simplify mode); the controller verifies each finding before a fix round (80+ confirmed, 50–79 unconfirmed, < 50 refuted) and runs the simplification pass (reverted, not repaired); /prReview verifies before it reports; the simplifier keeps the feature's lines, never a test or contract, one commit each, the final runs last; /spec-simplify, /executeTask, SKILL.md, AGENTS.md and the guide name them; no PR / CI steering (got " +
      js([revNot.length, revVerify.length, revRules.length, revSimp.length, subVerify.length, subSimp.length, guideSimp.length, simp.length, scmd.length]) + ")");

    // R4 — steering: structure.md gains Module Boundaries and Shared Code slots, the constitution's example principles a reuse rule
    // (EN / PT / ES / pt-BR) — slots, so a fresh stub still reads as a template.
    const steerWant = { en: ["## Module Boundaries", "## Shared Code", "[e.g., Search before you write: extend an existing module before adding a new one.]"],
      pt: ["## Fronteiras de Módulos", "## Código Partilhado", "[ex.: Pesquisar antes de escrever: estender um módulo existente antes de criar um novo.]"],
      es: ["## Límites de Módulos", "## Código Compartido", "[p.ej., Buscar antes de escribir: extender un módulo existente antes de crear uno nuevo.]"],
      "pt-BR": ["## Fronteiras de Módulos", "## Código Compartilhado", "[ex.: Pesquisar antes de escrever: estender um módulo existente antes de criar um novo.]"] };
    const steerGot = Object.entries(steerWant).map(([l, [a, b, c]]) => {
      const s = I.steeringStub("structure.md", l), k = I.steeringStub("constitution.md", l);
      const slots = S.placeholderReport(s).map((x) => x.text);
      return [l, s.indexOf(a + "\n") > s.indexOf("## Layout") && s.indexOf(b + "\n") > s.indexOf(a) && k.includes(c) && slots.length >= 3];
    });
    ok(steerGot.every((g) => g[1]),
      "1.19 R4: the structure.md stub has Module Boundaries and Shared Code (slots) after Layout and the constitution stub a 'search before you write' example principle — EN / PT / ES / pt-BR (got " + js(steerGot) + ")");

    // The demo and the eval fixtures stay clean for this check: the demo's api-keys design was approved before 1.19 (a pass with the
    // note, no warning — examples/README.md pastes it); the fixtures' designs name what they reuse, so approving them (as the
    // behavioural fixtures do) keeps design-reuse passing on its own merits.
    const fxBad = [];
    for (const [lang, feat] of [["en", "csv-export"], ["es", "exportar-csv"]]) {
      const d = rDir("fx-" + lang);
      S.initProject(d, ["core"], lang);
      S.createFeature(d, feat, ["core"], "x", undefined, lang);
      fs.cpSync(path.join(root, "evals", "fixtures", "specs-" + lang, feat), path.join(d, ".specs", feat), { recursive: true });
      approveBefore(d, feat, "design");
      const ap = S.approvePhase(d, feat, "design", "t");
      const doc = S.specDoctor(d, feat);
      if (!ap.ok || reuseSt(doc) !== "pass" || /approved before/.test(chk(doc, "design-reuse").detail || "")) fxBad.push(lang + ": " + ap.ok + " " + reuseSt(doc) + " " + chk(doc, "design-reuse").detail);
    }
    const fxRoot = path.join(tmp, "a3-eval-fixtures"); // the behavioural fixtures built above (when bash is here)
    let fxSeen = 0;
    for (const c of fs.existsSync(fxRoot) ? fs.readdirSync(fxRoot) : []) {
      const d = path.join(fxRoot, c);
      if (!fs.existsSync(path.join(d, ".specs"))) continue;
      for (const f of S.listFeatures(d).features || []) {
        const st = S.readState(d, f.name);
        if (!st.approvals || !st.approvals.design) continue;
        fxSeen++;
        if (reuseSt(S.specDoctor(d, f.name)) !== "pass") fxBad.push(c + "/" + f.name);
      }
    }
    ok(dmDoc.verdict === "pass" && /^design approved before 1\.19/.test(chk(dmDoc, "design-reuse").detail) && !dmDoc.checks.some((c) => c.status === "warn") && !fxBad.length,
      "1.19 R1: examples/demo-project stays doctor PASS with no warning (its pre-1.19 design approval → design-reuse passes with the note); evals/fixtures specs-en / specs-es designs pass design-reuse once approved, and so do the " + fxSeen + " approved design(s) of the built behavioural fixtures (got " +
      js([dmDoc.verdict, chk(dmDoc, "design-reuse").detail, fxBad]) + ")");

    // 1.19 R review 1 (security) — a network _Implements:_ never reaches the file system: the brief decides on the TEXT that a UNC
    // reference (//host/share, \\host\share, \\?\UNC\…, a UNC glob) lies outside the project, before any stat — it opened an SMB
    // connection to the host a spec named (4.7–7.2 s on an unreachable one; NTLM credentials on Windows). A non-resolving name and
    // TEST-NET-1, in a child process with a timeout. A `..` or absolute reference outside the project names nothing either; an
    // absolute path INTO the project reads as its relative spelling.
    const rv = rDir("rv-net"), rvOut = rDir("rv-outside");
    S.initProject(rv, ["core"], "en");
    const rvf = S.createFeature(rv, "Orders", ["core"]);
    fs.writeFileSync(path.join(rvf.dir, "requirements.md"), REQ);
    wDesign(rvf, design(REUSE2));
    const rvPut = (base, rel) => { const p = path.join(base, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, "x"); };
    for (const n of ["api.ts", "repo.ts", "helpers.ts"]) rvPut(rv, "src/orders/" + n);
    for (const n of ["other.ts", "secret-helper.ts"]) rvPut(rvOut, n);
    for (let i = 0; i < 1005; i++) rvPut(rv, "src/big/b" + String(i).padStart(4, "0") + ".ts");
    const fwd = (p) => p.split(path.sep).join("/");
    fs.writeFileSync(path.join(rvf.dir, "tasks.md"), "# Tasks\n\n## Story US-1 (P1)\n" +
      "- [ ] 1. [US1] A\n  - _Implements: //nonexistent-host-zz9.invalid/share/x.ts_\n" +
      "- [ ] 2. [US1] B\n  - _Implements: \\\\192.0.2.1\\share\\y.ts_\n" +
      "- [ ] 3. [US1] C\n  - _Implements: //nonexistent-host-zz9.invalid/share/*.ts, \\\\?\\UNC\\192.0.2.1\\share\\z.ts_\n" +
      "- [ ] 4. [US1] D\n  - _Implements: ../p19r-rv-outside/other.ts_\n" +
      "- [ ] 5. [US1] E\n  - _Implements: " + fwd(rvOut) + "/_\n" +
      "- [ ] 6. [US1] F\n  - _Implements: " + fwd(path.join(rv, "src", "orders", "api.ts")) + "_\n" +
      "- [ ] 7. [US1] G\n  - _Implements: src/link/new.ts_\n" +
      "- [ ] 8. [US1] H\n  - _Implements: src/link/_\n" +
      "- [ ] 9. [US1] I\n  - _Implements: src/link/sub/deep.ts_\n" +
      "- [ ] 10. [US1] J\n  - _Implements: src/big/_\n");
    const rvChild = path.join(tmp, "p19r-rv-child.js");
    fs.writeFileSync(rvChild, "const S = require(" + JSON.stringify(path.join(root, "mcp", "lib", "spec.js")) + ");\n" +
      "const out = [1, 2, 3].map((n) => { const t0 = Date.now(); const b = S.taskBrief(" + JSON.stringify(rv) + ", " + JSON.stringify(rvf.slug) + ", n);\n" +
      "  return { n, ms: Date.now() - t0, ok: b.ok, files: b.reuse ? b.reuse.files : [], entries: b.reuse ? b.reuse.entries : [] }; });\n" +
      "process.stdout.write(JSON.stringify(out));\n");
    const rvT0 = Date.now();
    const rvNet = spawnSync(process.execPath, [rvChild], { encoding: "utf8", timeout: 20000 });
    const rvWall = Date.now() - rvT0;
    let rvGot = null;
    try { rvGot = JSON.parse(rvNet.stdout); } catch { rvGot = null; }
    const [rv4, rv5, rv6] = [4, 5, 6].map((n) => S.taskBrief(rv, rvf.slug, n));
    ok(!rvNet.error && rvNet.status === 0 && Array.isArray(rvGot) && rvGot.length === 3 && rvGot.every((x) => x.ok && x.ms < 3000 && !x.files.length && !x.entries.length) && rvWall < 15000 &&
      !rv4.reuse.files.length && !rv4.reuse.entries.length && !rv5.reuse.files.length && !js([rv4, rv5]).includes("secret-helper") &&
      js(rv6.reuse.files) === js(["src/orders/helpers.ts", "src/orders/repo.ts"]) && rv6.reuse.entries.length === 1 && /src\/orders\/repo\.ts/.test(rv6.reuse.entries[0]),
      "1.19 R review 1: a UNC _Implements:_ (//host/share, \\\\host\\share on TEST-NET, \\\\?\\UNC\\…, a UNC glob) makes no fs call — each brief returns at once (child process, 20 s timeout); a `..` or absolute reference outside the project lists nothing; an absolute path into the project reads as its relative spelling (got " +
      js([rvNet.error && rvNet.error.code, rvNet.status, rvWall, rvGot, (rvNet.stderr || "").slice(0, 300), rv4.reuse, rv5.reuse, rv6.reuse]) + ")");

    // 1.19 R review 3 (security) — a folder reached through a link (a junction on Windows, a symlink elsewhere) is never listed:
    // each segment below the project root is lstat'ed and nothing is followed (src/link → a folder outside listed its files).
    let rvLink = true;
    try { fs.symlinkSync(rvOut, path.join(rv, "src", "link"), "junction"); } catch (e) { rvLink = e.code || String(e); }
    const rvL = [7, 8, 9].map((n) => S.taskBrief(rv, rvf.slug, n));
    ok(rvLink !== true || (rvL.every((b) => b.ok && !(b.reuse && b.reuse.files.length)) && !js(rvL).includes("secret-helper") && !js(rvL).includes("other.ts")),
      "1.19 R review 3: a task implementing src/link/new.ts, src/link/ or src/link/sub/deep.ts, where src/link is a junction / symlink to a folder outside the project, lists none of its files (got " +
      js([rvLink, rvL.map((b) => b.reuse)]) + ")");

    // 1.19 R review 4 — a folder read up to its cap: at most 1,000 entries per folder (opendir, never the whole listing), and the
    // count past the 15 listed is a lower bound — "at least N more" (EN / PT / ES / pt-BR; "possibly more" when none is counted).
    const rvBig = S.taskBrief(rv, rvf.slug, 10);
    const moreTxt = ["en", "pt", "es", "pt-BR"].map((l) => I.brief(l).reuseFilesMore(985, true));
    ok(rvBig.reuse.files.length === 15 && rvBig.reuse.more === 985 && rvBig.reuse.truncated === true &&
      /\n…and at least 985 more in the same folder\(s\) — a large folder: only its first entries were read\.\n/.test(rvBig.brief) &&
      b4.reuse.truncated === undefined && /pelo menos mais 985/.test(moreTxt[1]) && /al menos 985 más/.test(moreTxt[2]) && moreTxt[3] === I.toPtBr(moreTxt[1]) &&
      /possibly more/.test(I.brief("en").reuseFilesMore(0, true)) && I.brief("en").reuseFilesMore(15, false) === "…and 15 more in the same folder(s).",
      "1.19 R review 4: a 1,005-file folder lists 15 and says 'at least 985 more' (truncated: true — only its first 1,000 entries are read); a small one keeps the exact count; PT / ES / pt-BR (got " +
      js([rvBig.reuse.files.length, rvBig.reuse.more, rvBig.reuse.truncated, moreTxt]) + ")");

    // 1.19 R review 2 — the design context. Differential vs 1.18 for designs WITHOUT a Reuse & Integration section: the sections a
    // synonym names ("Integration Points" with a handler's contract bullets, "Existing code", "Reuse of HTTP connections") are
    // selected exactly as 1.18 did (ref118: the needle rule — the task's ACs, files and 5+-character basenames in a `##` section's
    // title or body) and quoted whole. With a Reuse & Integration section, only THAT one leaves Design context, and only when the
    // Reuse part quotes all of it (every entry, no code block); a second synonym section ("Integration Points") always stays.
    const ref118 = (text, files, acs) => {
      const secs = [];
      let cur = null;
      for (const l of text.split("\n")) { const m = /^## (.*)$/.exec(l); if (m) { cur = { title: m[1].trim(), body: [] }; secs.push(cur); } else if (cur) cur.body.push(l); }
      const needles = [...acs, ...files, ...files.map((f) => path.posix.basename(f)).filter((b) => b.length >= 5)];
      return secs.filter((s) => needles.some((x) => (s.title + "\n" + s.body.join("\n").trim()).includes(x))).map((s) => s.title);
    };
    const cx = rDir("rv-ctx");
    S.initProject(cx, ["core"], "en");
    const cxf = S.createFeature(cx, "Hooks", ["core"]);
    fs.writeFileSync(path.join(cxf.dir, "requirements.md"), REQ);
    const cxTasks = [["src/hooks/stripe.ts", "US-1.AC-1"], ["src/lib/money.ts", "US-1.AC-2"], ["src/http/pool.ts", null], ["src/other/x.ts", null]];
    fs.writeFileSync(path.join(cxf.dir, "tasks.md"), "# Tasks\n\n## Story US-1 (P1)\n" +
      cxTasks.map(([f, ac], i) => `- [ ] ${i + 1}. [US1] Task ${i + 1}\n` + (ac ? `  - _Requirements: ${ac}_\n` : "") + `  - _Implements: ${f}_\n`).join(""));
    const D118 = "# Design: Hooks\n\n## Overview\nStripe webhooks.\n\n## Integration Points\nThe Stripe webhook handler src/hooks/stripe.ts:\n" +
      "- verifies the X-Sig header with HMAC-SHA256 over the raw body\n- dedups on event.id in the processed_events table\n\n" +
      "## Existing code\n- src/lib/money.ts formats amounts (reuse it in the receipt)\n\n## Reuse of HTTP connections\nA keep-alive agent in src/http/pool.ts.\n\n" +
      "## Data Models\nEvent {id}.\n";
    wDesign(cxf, D118);
    const cx118 = cxTasks.map(([f, ac], i) => {
      const b = S.taskBrief(cx, cxf.slug, i + 1);
      const want = ref118(D118, [f], ac ? [ac] : []);
      return { n: i + 1, got: b.designSections, want, same: js(b.designSections) === js(want), ctx: (b.brief.split("\n## Design context\n")[1] || "") };
    });
    const RI = (rows) => "## Reuse & Integration\n| Kind | What | Where (path) | Why / notes |\n|---|---|---|---|\n" + rows + "\n";
    const IP = "## Integration Points\n- src/hooks/stripe.ts answers 2xx within 3 s; Stripe retries for 3 days\n\n";
    const rowHook = "| Extend | the webhook router | `src/hooks/stripe.ts` | registers the handler |\n";
    const cxWith = (reuse) => { wDesign(cxf, "# Design: Hooks\n\n## Overview\nStripe webhooks.\n\n" + reuse + IP + "## Data Models\nEvent {id}.\n"); return S.taskBrief(cx, cxf.slug, 1); };
    const cxAll = cxWith(RI(rowHook));
    const cxPart = cxWith(RI(rowHook + "| Reuse | Money | `src/lib/money.ts` | formats amounts |\n"));
    const cxCode = cxWith(RI(rowHook) + "```ts\nexport function register(r: Router): void\n```\n\n");
    ok(cx118.every((r) => r.same) && /dedups on event\.id in the processed_events table/.test(cx118[0].ctx) && /X-Sig header/.test(cx118[0].ctx) &&
      js(cx118[0].got) === js(["Integration Points"]) && js(cx118[1].got) === js(["Existing code"]) && js(cx118[2].got) === js(["Reuse of HTTP connections"]) && !cx118[3].got.length &&
      js(cxAll.designSections) === js(["Integration Points"]) && js(cxAll.reuse.entries) === js([rowHook.trim()]) &&
      js(cxPart.designSections) === js(["Reuse & Integration", "Integration Points"]) && cxPart.reuse.entries.length === 1 &&
      js(cxCode.designSections) === js(["Reuse & Integration", "Integration Points"]),
      "1.19 R review 2: a 1.18-style design (Integration Points with its contract bullets, Existing code, Reuse of HTTP connections) gets the 1.18 Design context, whole; with a Reuse & Integration section only that one leaves it, and only when the Reuse part quotes all of it (not with a row left out or a code block); Integration Points beside it stays (got " +
      js([cx118.map((r) => [r.n, r.got, r.want]), cxAll.designSections, cxPart.designSections, cxCode.designSections]) + ")");

    // T review 6 — a task emitting metrics reads the design's observability: on an +obs feature (and saas + obs) its [OBS] Telemetry
    // section reaches the brief although the task cites a core AC; without _Emits metrics:_ it doesn't; PT's heading too.
    const ob = rDir("rv-obs");
    S.initProject(ob, ["core"], "en");
    const obTasks = "# Tasks\n\n## Story US-1 (P1)\n- [ ] 1. [US1] Count orders\n  - _Requirements: US-1.AC-1_\n  - _Emits metrics: orders_placed_total_\n  - _Implements: src/orders/api.ts_\n" +
      "- [ ] 2. [US1] Store orders\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/orders/store.ts_\n";
    const obBrief = (name, tracks, lang) => {
      const f = S.createFeature(ob, name, tracks, "", undefined, lang);
      fs.writeFileSync(path.join(f.dir, "tasks.md"), obTasks);
      // the sections quoted, plus the "Relevant but not included (size)" line (a section that didn't fit the design budget still counts)
      return [1, 2].map((n) => { const b = S.taskBrief(ob, f.slug, n); return [...b.designSections, ...(b.brief.match(/^Relevant(?:es)? [^\n]*$/m) || [])]; });
    };
    const obEn = obBrief("Metrics", ["core", "obs"], "en"), obBoth = obBrief("Metrics Saas", ["core", "saas", "obs"], "en"), obPt = obBrief("Métricas", ["core", "obs"], "pt");
    ok(obEn[0].includes("[OBS] Telemetry") && !obEn[1].includes("[OBS] Telemetry") &&
      obBoth[0].includes("[OBS] Telemetry") && obBoth[0].includes("[SaaS] Observability") && obPt[0].includes("[OBS] Telemetria") && !obPt[1].includes("[OBS] Telemetria"),
      "1.19 R review T-6: _Emits metrics:_ pulls the +obs feature's [OBS] Telemetry section into the brief (with [SaaS] Observability on a saas + obs feature; PT Telemetria) for a task citing a core AC; a task without it doesn't (got " +
      js([obEn, obBoth, obPt]) + ")");

    // 1.19 R review 5 — spec_backlog add of a name already there keeps the entry and APPENDS the new note (one line, ' · '): a second
    // refactor candidate filed under the same name was dropped while add answered ok. exists / appended / a localized note; the same
    // note again changes nothing; a note past 2,000 characters is refused (nothing written); PT project → PT note.
    const bl = rDir("rv-backlog");
    S.initProject(bl, ["core"], "en");
    const blAdd = async (p, name, note) => payload(await call("spec_backlog", { projectDir: p, action: "add", name, note }));
    const bl1 = await blAdd(bl, "refactor-pricing", "refactor: Repeated Switches in pricing.ts, invoice.ts");
    const bl2 = await blAdd(bl, "Refactor-Pricing", "refactor: a rounding helper copied in cart.ts");
    const bl3 = await blAdd(bl, "refactor-pricing", "refactor: a rounding helper copied in cart.ts");
    const blBig = await blAdd(bl, "refactor-pricing", "x".repeat(2000));
    const blNote = (S.backlog(bl, "list").backlog.find((b) => b.name === "refactor-pricing") || {}).note;
    const blp = rDir("rv-backlog-pt");
    S.initProject(blp, ["core"], "pt");
    await blAdd(blp, "refactor-precos", "refactor: a");
    const blPt = await blAdd(blp, "refactor-precos", "refactor: b");
    ok(bl1.exists === undefined && bl2.exists === true && bl2.appended === true && bl2.note === "'refactor-pricing' is already in the backlog — the new note was appended to its note." &&
      bl3.exists === true && bl3.appended === false && /with that note — nothing changed/.test(bl3.note) &&
      blBig.exists === true && /would pass 2000 characters — the new note was not added/.test(blBig.error || "") &&
      blNote === "refactor: Repeated Switches in pricing.ts, invoice.ts · refactor: a rounding helper copied in cart.ts" &&
      S.backlog(bl, "list").backlog.length === 1 && blPt.appended === true && /já está no backlog — a nova nota foi acrescentada/.test(blPt.note) &&
      I.toPtBr(blPt.note) === I.msg("pt-BR").featureOps.backlogAppended("refactor-precos"),
      "1.19 R review 5: backlog add of an existing name (case-insensitive) appends the new note to its entry (exists, appended, a localized note — EN / PT / pt-BR), the same note twice changes nothing, past 2,000 characters it is refused; one entry, both notes (got " +
      js([bl1, bl2, bl3, blBig, blNote, blPt]) + ")");

    // 1.19 R review 6 — the PT / ES "integration with the existing system" headings name the section (EN had it); and the prose: a
    // unit to extend OUTSIDE the task's files is never edited silently — NEEDS_CONTEXT / a converge task (spec_append_tasks) or a note
    // in the report, the scope guard named — in the implementer, the guide, the protocol, /executeTask and the brief (EN / PT / ES /
    // pt-BR); refactor candidates get one name each (an existing name appends).
    const sysGot = [["pt", "## Integração com o sistema existente\n- O serviço de encomendas (`src/orders/service.ts`).\n"],
      ["pt-BR", "## Integracao com o sistema existente\n- O serviço de pedidos.\n"],
      ["es", "## Integración con el sistema existente\n- El servicio de pedidos (`src/orders/service.ts`).\n"]].map(([lang, sec], i) => {
      const f = S.createFeature(hp, "Sistema " + i, ["core"], "", undefined, lang);
      wDesign(f, hand(sec));
      return reuseSt(S.specDoctor(hp, f.slug));
    });
    const impl6 = rRd("agents", "spec-implementer.md"), guide6 = rRd("skills", "dev-spec-driven", "references", "code-reuse-and-quality.md");
    const sub6 = rRd("skills", "dev-spec-driven", "references", "subagent-execution.md"), exec6 = rRd("commands", "executeTask.md");
    const step3 = cut(impl6, "3. **Search before you write**", "4. If anything is unclear");
    const outside6 = cut(guide6, "**Extending a unit outside the task's files.**", "## Module boundaries");
    const rules6 = ["en", "pt", "es", "pt-BR"].map((l) => I.brief(l).reuseRule);
    ok(sysGot.every((s) => s === "pass") &&
      /never edited silently/.test(step3) && /\*\*NEEDS_CONTEXT\*\*/.test(step3) && /spec_append_tasks/.test(step3) && /meta\.guard: "scope"/.test(step3) &&
      /NEEDS_CONTEXT/.test(outside6) && /spec_append_tasks/.test(outside6) && /meta\.guard: "scope"/.test(outside6) && /Reuse\*\* block/.test(outside6) &&
      /extend a unit outside\s+the task's files/.test(sub6) && /One name per candidate/.test(sub6) && /spec_append_tasks/.test(cut(exec6, "**Search before you write**", "**Can't run the")) &&
      /its \*\*own name\*\*/.test(guide6) && /never edited silently — stop and ask \(NEEDS_CONTEXT\)/.test(rules6[0]) && /nunca é editada em silêncio — pede contexto \(NEEDS_CONTEXT\)/.test(rules6[1]) &&
      /nunca se edita en silencio/.test(rules6[2]) && rules6[3] === I.toPtBr(rules6[1]) && /peça contexto/.test(rules6[3]) &&
      [step3, outside6].every((t) => !/pull request|\bPRs?\b|\bCI\b/.test(t)),
      "1.19 R review 6: PT / ES 'integração com o sistema existente' / 'integración con el sistema existente' name the Reuse section; extending a unit outside the task's files is NEEDS_CONTEXT or a converge task, never a silent edit (the scope guard named) — implementer, guide, protocol, /executeTask and the brief's rule in EN / PT / ES / pt-BR; one backlog name per refactor candidate (got " +
      js([sysGot, step3.length, outside6.length, rules6.map((r) => r.slice(-160))]) + ")");

    // 1.19 verify 5 — a NEW backlog entry's note has the same cap as an appended one: one line, at most 2,000 characters; past it
    // add is refused with a localized error and nothing is written (MCP and CLI — the CLI exits 1)
    const bl5 = rDir("vf-backlog");
    S.initProject(bl5, ["core"], "en");
    const v5Long = await blAdd(bl5, "long-note", "y".repeat(2500));
    const v5Max = await blAdd(bl5, "max-note", "z".repeat(2000));
    const v5Lines = await blAdd(bl5, "lines-note", "first line\n\nsecond  line");
    const v5Cli = spawnSync(process.execPath, [path.join(__dirname, "..", "cli", "dev-spec.js"), "backlog", "add", "cli-long", "w".repeat(2001), "--project", bl5],
      { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: "", CLAUDE_PROJECT_DIR: "" } });
    const v5Pt = await blAdd(blp, "nota-longa", "n".repeat(2001));
    const v5List = S.backlog(bl5, "list").backlog, v5Rm = JSON.parse(fs.readFileSync(path.join(bl5, ".specs", "roadmap.json"), "utf8"));
    ok(v5Long.ok === false && v5Long.error === "The note for 'long-note' passes 2000 characters — nothing was added to the backlog: shorten the note." &&
      v5Max.ok === true && v5Lines.ok === true && (v5List.find((b) => b.name === "lines-note") || {}).note === "first line second line" &&
      v5List.map((b) => b.name).join() === "max-note,lines-note" && (v5Rm.backlog || []).every((b) => b.note.length <= 2000) &&
      v5Cli.status === 1 && /The note for 'cli-long' passes 2000 characters/.test(v5Cli.stdout + v5Cli.stderr) &&
      v5Pt.ok === false && /A nota de 'nota-longa' passa de 2000 caracteres — nada foi acrescentado ao backlog: encurta a nota\./.test(v5Pt.error || "") &&
      I.toPtBr(v5Pt.error) === I.msg("pt-BR").featureOps.backlogNoteLong("nota-longa", 2000) && /encurte a nota/.test(I.msg("pt-BR").featureOps.backlogNoteLong("x", 1)) &&
      !S.backlog(blp, "list").backlog.some((b) => b.name === "nota-longa"),
      "1.19 verify 5: backlog add of a NEW name with a 2,500-character note is refused (localized — EN / PT / pt-BR; the CLI exits 1), nothing written; 2,000 characters pass; a multi-line note is stored on one line (got " +
      js([v5Long, v5Max.ok, v5Lines.ok, v5List, v5Cli.status, (v5Cli.stdout + v5Cli.stderr).slice(0, 200), v5Pt.error]) + ")");
  }
};
