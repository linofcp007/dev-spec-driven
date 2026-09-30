"use strict";
// Built-in tracks end to end — +sec / +privacy, +dist, +api / +ui / +obs.
// Registry, classifier (EN / PT / ES), scaffolds (EN / PT / ES / pt-BR), gates, views, add_track / remove.

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, rpc, payload, S, tmp, list, require, __dirname }) => {

  { // 1.14 A2 — the composable +sec (security) and +privacy (GDPR / RGPD) tracks, end to end, EN / PT / ES.
    const a2Root = path.join(tmp, "a2-tracks");
    const a2 = (name) => path.join(a2Root, name);
    const dropTodo = (file) => fs.writeFileSync(file, fs.readFileSync(file, "utf8").split(/\r?\n/).filter((l) => !/^\s*>\s*\*\*TODO\*\*/.test(l)).join("\n"));
    const chk = (doc, id) => doc.checks.find((c) => c.id === id) || {};

    // --- the track list itself
    ok(S.VALID_TRACKS.join() === "core,tdd,saas,ai,sec,privacy,dist,api,ui,obs,data" && S.OPTIONAL_TRACKS.join() === "tdd,saas,ai,sec,privacy,dist,api,ui,obs,data" && // 1.17 D: + dist; 1.19 T: + api, ui, obs; 1.21 F4: + data
      S.TRACK_MARKER.sec === "[SEC]" && S.TRACK_MARKER.privacy === "[PRIVACY]" && S.trackLabel(S.normalizeTracks("privacy sec saas")) === "core +saas +sec +privacy",
      "A2: sec and privacy are valid, composable tracks with English-stable markers, labelled in track order");
    const typo = S.createFeature(a2("typo"), "Typo", "privcy");
    const alias = S.createFeature(a2("typo"), "Typo", ["gdpr"]);
    ok(!typo.ok && /did you mean 'privacy'/.test(typo.error) && !alias.ok && /'gdpr' \(did you mean 'privacy'\?\)/.test(alias.error) && /sec, privacy/.test(alias.error),
      "A2: an unknown track near sec/privacy gets a did-you-mean ('privcy', 'gdpr' → privacy) and the valid list names them (" + typo.error + ")");

    // --- classify: EN / PT / ES, strong + weak, negation notes, no cross-track noise
    const cls = (d, lang) => S.classify(d, lang ? { lang } : {});
    const secEn = cls("Threat model the upload API against the OWASP Top 10 and fix the stored XSS");
    const secPt = cls("Modelo de ameaças e testes de intrusão à API de carregamento de ficheiros");
    const secEs = cls("Modelo de amenazas y pruebas de penetración de la API de subida de archivos");
    ok([secEn, secPt, secEs].every((r) => r.tracks.includes("sec") && r.confidence.sec !== "none") && secPt.lang === "pt" && secEs.lang === "es" &&
      secEn.signals.sec.includes("owasp") && secPt.signals.sec.includes("testes de intrusão") && secEs.signals.sec.includes("pruebas de penetración"),
      "A2: classify turns +sec on from strong EN/PT/ES signals (threat model / OWASP / XSS · modelo de ameaças / testes de intrusão · modelo de amenazas / pruebas de penetración)");
    ok(!secEn.signals.ai.length && !secPt.signals.ai.length && !secEs.signals.ai.length && !(secEn.possible || []).some((p) => p.track === "ai"),
      "A2: 'model' inside 'threat model' / 'modelo de ameaças' / 'modelo de amenazas' is no +ai hint (a weak signal inside another track's strong phrase is shadowed)");
    const privEn = cls("Add a GDPR data export and the right to erasure for user accounts");
    const privPt = cls("Exportação dos dados pessoais e direito ao apagamento (RGPD)");
    const privEs = cls("Exportación de datos personales y derecho de supresión (RGPD)");
    ok([privEn, privPt, privEs].every((r) => r.tracks.includes("privacy") && !r.tracks.includes("saas")) &&
      privPt.signals.privacy.includes("dados pessoais") && privEs.signals.privacy.includes("datos personales"),
      "A2: classify turns +privacy on from EN/PT/ES signals (GDPR / right to erasure · dados pessoais / RGPD · datos personales) — GDPR no longer switches +saas on");
    const weakSec = cls("Login with a password, RBAC permissions for admins");
    const oneWeak = cls("User profile page with an avatar upload");
    ok(weakSec.tracks.includes("sec") && weakSec.weak.includes("sec") && weakSec.tracks.includes("tdd") &&
      !oneWeak.tracks.includes("privacy") && oneWeak.possible.some((p) => p.track === "privacy" && p.signal === "user profile"),
      "A2: two weak +sec signals turn it on (flagged weak-only) beside +tdd; one weak +privacy signal is only 'possible'");
    const negated = cls("Internal sales dashboard: no personal data, no authentication needed");
    const negPt = cls("Relatório interno de vendas, sem dados pessoais");
    const negEs = cls("Informe interno de ventas, sin datos personales ni autenticación");
    const onAlthough = cls("OWASP review of the export API — no authentication changes");
    ok(!negated.tracks.includes("privacy") && !negated.tracks.includes("sec") && negated.notes.some((n) => /\+privacy kept off — 'personal data'/.test(n)) &&
      negated.notes.some((n) => /\+sec kept off — 'authentication'/.test(n)) && !negPt.tracks.includes("privacy") && negPt.notes.some((n) => /\+privacy mantido inativo/.test(n)) &&
      negEs.lang === "es" && !negEs.tracks.includes("privacy") && negEs.negated.privacy.includes("datos personales") && negEs.notes.some((n) => /\+privacy/.test(n)) &&
      onAlthough.tracks.includes("sec") && onAlthough.notes.some((n) => /\+sec is ON although 'authentication' appeared negated/.test(n)),
      "A2: negation never vetoes a track, it annotates it — +privacy / +sec kept off with a note (EN, PT, ES) and '+sec is ON although …' when a strong signal wins");
    ok(/\+sec: ON/.test(secEn.reasoning) && /\+privacy: off/.test(secEn.reasoning) && /\+privacy: ON \[high confidence\]/.test(privEn.reasoning),
      "A2: the reasoning has a line per track, sec and privacy included");
    const nonSec = cls("Dependency injection container for the services layer; store uploads in object storage");
    const bruteAlgo = cls("Replace the brute-force search with an index");
    const bruteAttack = cls("Lock accounts after repeated brute-force attacks");
    ok(nonSec.tracks.join() === "core" && !nonSec.signals.sec.length && !nonSec.signals.privacy.length &&
      !bruteAlgo.tracks.includes("sec") && bruteAlgo.possible.some((p) => p.track === "sec") && bruteAttack.tracks.includes("sec"),
      "A2: no phantom +sec from 'dependency injection' or a brute-force SEARCH (weak, possible only) — a brute-force ATTACK is strong; no +privacy from 'storage'");
    const sweep = [];
    // (full review Pb5: a VERB stem matches only with one of its endings — probed as its infinitive)
    const verbStem = { encript: "encriptar", cifr: "cifrar", criptograf: "criptografar" };
    for (const tr of ["sec", "privacy"]) {
      const sg = S.trackSignals(tr);
      for (const tier of ["strong", "weak"]) for (const kw of sg[tier]) {
        const r = S.classify("We need " + (verbStem[kw] || kw) + " here");
        if (!r.signals[tr].some((m) => m === kw || m.includes(kw)) || (tier === "strong" && !r.tracks.includes(tr))) sweep.push(tr + ":" + kw);
      }
    }
    ok(sweep.length === 0 && S.trackSignals("sec").strong.length > 40 && S.trackSignals("privacy").strong.length > 40,
      "A2: self-match sweep — every +sec / +privacy keyword (EN/PT/ES) matches itself as a word, and a strong one alone turns its track on (misses: " + sweep.join(", ") + ")");
    const mcpCls = payload(await rpc("tools/call", { name: "spec_classify", arguments: { description: "Pseudonymize personal data and threat model the export", projectDir: a2("mcp") } }));
    ok(mcpCls.tracks.includes("sec") && mcpCls.tracks.includes("privacy") && mcpCls.label === "core +sec +privacy",
      "A2: spec_classify (MCP) reports +sec and +privacy (" + mcpCls.label + ")");

    // --- scaffold per track, per language: fail while TODO, pass once filled; the design approval is refused meanwhile
    const titles = { en: ["Threat Model", "Personal Data Inventory"], pt: ["Modelo de Ameaças", "Inventário de Dados Pessoais"], es: ["Modelo de Amenazas", "Inventario de Datos Personales"] };
    for (const lang of ["en", "pt", "es"]) {
      const p = a2("scaffold-" + lang);
      for (const tr of ["sec", "privacy"]) {
        const f = S.createFeature(p, tr + " " + lang, [tr], "", undefined, lang);
        const id = tr + "-sections";
        const other = tr === "sec" ? "privacy-sections" : "sec-sections";
        const design = fs.readFileSync(path.join(f.dir, "design.md"), "utf8");
        const reqs = fs.readFileSync(path.join(f.dir, "requirements.md"), "utf8");
        const tasks = fs.readFileSync(path.join(f.dir, "tasks.md"), "utf8");
        const marker = tr === "sec" ? "[SEC]" : "[PRIVACY]";
        const heads = (design.match(new RegExp("^## \\" + marker.slice(0, -1) + "\\] .*$", "gm")) || []);
        const e = S.earsValidate(reqs, lang);
        const trackIssues = e.issues.filter((i) => i.code !== "placeholder" && /US-1\.AC-1[0-5]/.test(i.text || ""));
        const reqPh = S.featurePlaceholders(p, f.slug, "requirements.md").items.map((x) => x.text);
        const before = S.specDoctor(p, f.slug);
        S.approvePhase(p, f.slug, "classification", "t", { force: true });
        S.approvePhase(p, f.slug, "requirements", "t", { force: true });
        const refused = S.approvePhase(p, f.slug, "design", "t");
        dropTodo(path.join(f.dir, "design.md"));
        const after = S.specDoctor(p, f.slug);
        const retry = S.approvePhase(p, f.slug, "design", "t");
        const want = tr === "sec" ? 5 : 6;
        ok(f.ok && f.label === "core +" + tr && heads.length === want && design.includes(titles[lang][tr === "sec" ? 0 : 1]) &&
          (design.match(/^> \*\*TODO\*\*/gm) || []).length === want && reqs.includes("#### " + marker) && tasks.includes("US-1.AC-1" + (tr === "sec" ? "0" : "3")) &&
          !trackIssues.length && e.issues.every((i) => i.severity !== "error") && !reqPh.some((x) => /SEC|PRIVACY/.test(x)) &&
          chk(before, id).status === "fail" && /unfilled|por preencher|sin rellenar|sin completar/.test(chk(before, id).detail) && !chk(before, other).status &&
          !refused.ok && refused.failing.includes(id) &&
          chk(after, id).status === "pass" && /5|6/.test(chk(after, id).detail) && !retry.failing.includes(id),
          `A2: ${lang} +${tr} scaffold — ${want} ${marker} sections with the TODO sentinel, ${marker} EARS criteria (no EARS issue, no placeholder), ${id} fails and the design approval is refused while TODO, passes once filled (${chk(before, id).detail} → ${chk(after, id).detail})`);
      }
    }

    // --- a +sec +privacy feature whose templates are filled is ready: doctor passes and every gate approves without force
    const SLOT = /\[(?!shared\]|US\d+\]|[ xX]\]|P\]|SEC\]|PRIVACY\]|NEEDS)[^\]\n]*\]/g;
    for (const lang of ["en", "pt", "es"]) {
      const p = a2("filled-" + lang);
      S.initProject(p, ["core", "sec", "privacy"], lang);
      const f = S.createFeature(p, "Filled " + lang, ["sec", "privacy"], "", undefined, lang);
      for (const file of ["classification.md", "requirements.md", "design.md", "tasks.md"]) {
        const fp = path.join(f.dir, file);
        let t = fs.readFileSync(fp, "utf8");
        for (let i = 0; i < 3; i++) t = t.replace(SLOT, "the account export"); // nested slots ("[e.g., … [N] …]") need a few passes
        fs.writeFileSync(fp, t.split(/\r?\n/).filter((l) => !/^\s*>\s*\*\*TODO\*\*/.test(l)).join("\n"));
      }
      const doc = S.specDoctor(p, f.slug);
      const gates = ["classification", "requirements", "design", "tasks"].map((ph) => [ph, S.approvePhase(p, f.slug, ph, "t")]);
      ok(doc.readyToAdvance && !doc.checks.some((c) => c.status === "fail") && chk(doc, "sec-sections").status === "pass" && chk(doc, "privacy-sections").status === "pass" &&
        chk(doc, "ears").status === "pass" && chk(doc, "traceability").status === "pass" && gates.every(([ph, r]) => r.ok && r.approved === ph && !r.forced),
        `A2: ${lang} — a filled +sec +privacy feature is ready (doctor has no fail, EARS + traceability pass) and classification → requirements → design → tasks approve without force (` +
        gates.filter(([, r]) => !r.ok).map(([ph, r]) => ph + ":" + (r.failing || []).join(",")).join(" ") + ")");
    }

    // --- steering: security.md / privacy.md in the project language; still templates → doctor's steering warns
    const stP = a2("steering-pt");
    const initPt = S.initProject(stP, ["core", "sec", "privacy"], "pt");
    const secMd = fs.readFileSync(path.join(stP, ".specs", "steering", "security.md"), "utf8");
    const privMd = fs.readFileSync(path.join(stP, ".specs", "steering", "privacy.md"), "utf8");
    const stF = S.createFeature(stP, "Contas", ["privacy"]);
    ok(initPt.created.includes("security.md") && initPt.created.includes("privacy.md") && /^# Padrões de Segurança/.test(secMd) && /CNPD/.test(privMd) &&
      /security\.md.*privacy\.md|privacy\.md.*security\.md/.test(chk(S.specDoctor(stP, stF.slug), "steering").detail) &&
      ["en", "pt", "es"].every((l) => ["security.md", "privacy.md"].every((f) => typeof S.msg(l) === "object" && require("./lib/i18n.js").steeringStub(f, l))),
      "A2: spec_init +sec +privacy writes steering/security.md and privacy.md (PT: Padrões de Segurança, CNPD) — flagged as templates until filled; EN/PT/ES stubs exist");

    // --- add-track / remove-track for both (additive, non-destructive), then re-add
    const at = a2("add-track");
    S.initProject(at, ["core"], "en");
    const plain = S.createFeature(at, "Plain", ["core"], "", undefined, "en");
    const tasksBefore = S.statusFeature(at, plain.slug).tasks.total;
    const add = S.addTrack(at, plain.slug, "+sec +privacy");
    const pDesign = fs.readFileSync(path.join(plain.dir, "design.md"), "utf8");
    const pTasks = fs.readFileSync(path.join(plain.dir, "tasks.md"), "utf8");
    const pCls = fs.readFileSync(path.join(plain.dir, "classification.md"), "utf8");
    const docAdd = S.specDoctor(at, plain.slug);
    ok(add.ok && add.tracks === "core +sec +privacy" && add.addedTracks.join() === "sec,privacy" && add.added.includes("steering/security.md") && add.added.includes("steering/privacy.md") &&
      /## \[SEC\] Threat Model/.test(pDesign) && /## \[PRIVACY\] DPIA/.test(pDesign) && /## Story US-1 — Security/.test(pTasks) && /## Story US-1 — Privacy/.test(pTasks) &&
      /_Requirements: \[the \+sec criterion this task proves\]_/.test(pTasks) && /## Active Tracks\ncore \+sec \+privacy/.test(pCls) &&
      chk(docAdd, "sec-sections").status === "fail" && chk(docAdd, "privacy-sections").status === "fail" && S.statusFeature(at, plain.slug).tasks.total === tasksBefore + 7,
      "A2: add_track sec+privacy — sections, steering, template tasks (placeholder ACs: the requirements predate the track), Active Tracks, doctor checks");
    const again = S.addTrack(at, plain.slug, "sec");
    const rmSec = S.removeTrack(at, plain.slug, "sec");
    const docRm = S.specDoctor(at, plain.slug);
    const stRm = S.statusFeature(at, plain.slug);
    ok(again.ok && !again.addedTracks.length && rmSec.ok && rmSec.tracks === "core +privacy" && rmSec.inactive.includes("design.md ([SEC] sections)") &&
      rmSec.inactive.includes("tasks.md (Story US-1 — Security)") && !chk(docRm, "sec-sections").status && chk(docRm, "privacy-sections").status === "fail" &&
      stRm.secSections === null && Array.isArray(stRm.privacySections) && stRm.tasks.total === tasksBefore + 3 && fs.readFileSync(path.join(plain.dir, "design.md"), "utf8").includes("[SEC] Threat Model"),
      "A2: add_track --remove sec is non-destructive — [SEC] sections/tasks stay on disk but inactive: no sec-sections check, secSections null, its 4 tasks not counted");
    const rmPriv = S.removeTrack(at, plain.slug, "privacy");
    const reAdd = S.addTrack(at, plain.slug, "sec,privacy");
    const reTasks = fs.readFileSync(path.join(plain.dir, "tasks.md"), "utf8");
    ok(rmPriv.ok && rmPriv.tracks === "core" && rmPriv.inactive.includes("design.md ([PRIVACY] sections)") && reAdd.ok && reAdd.tracks === "core +sec +privacy" &&
      (reTasks.match(/## Story US-1 — Security/g) || []).length === 1 && S.statusFeature(at, plain.slug).tasks.total === tasksBefore + 7 &&
      chk(S.specDoctor(at, plain.slug), "privacy-sections").status === "fail",
      "A2: remove privacy then re-add both — the kept sections and tasks count again, nothing duplicated");

    // --- core + saas + sec + privacy (no +tdd): the three section checks side by side, the design gate names all three
    const c3 = a2("combined-3");
    const three = S.createFeature(c3, "Tenant Accounts", ["saas", "sec", "privacy"], "", undefined, "es");
    const d3 = S.specDoctor(c3, three.slug);
    ["classification", "requirements"].forEach((ph) => S.approvePhase(c3, three.slug, ph, "t", { force: true }));
    const g3 = S.approvePhase(c3, three.slug, "design", "t");
    const t3 = S.traceCheck(c3, three.slug);
    ok(three.label === "core +saas +sec +privacy" && ["saas-sections", "sec-sections", "privacy-sections"].every((id) => chk(d3, id).status === "fail") &&
      !fs.existsSync(path.join(three.dir, "test-plan.md")) && fs.existsSync(path.join(three.dir, "load-test.md")) && !g3.ok &&
      ["saas-sections", "sec-sections", "privacy-sections"].every((id) => g3.failing.includes(id)) && !t3.uncoveredByTasks.length && !t3.phantomAcsInTasks.length &&
      /## Historia US-1 — Seguridad[\s\S]*## Historia US-1 — Privacidad/.test(fs.readFileSync(path.join(three.dir, "tasks.md"), "utf8")),
      "A2: core+saas+sec+privacy (ES) — saas/sec/privacy section checks all fail while TODO, the design approval names all three, every template AC is tasked");

    // --- the combined feature: core + tdd + saas + sec + privacy
    const cb = a2("combined");
    const combo = S.createFeature(cb, "Tenant Export", ["tdd", "saas", "sec", "privacy"], "", undefined, "en");
    const cDoc = S.specDoctor(cb, combo.slug);
    const cTr = S.traceCheck(cb, combo.slug);
    const cPlan = fs.readFileSync(path.join(combo.dir, "test-plan.md"), "utf8");
    const cReq = fs.readFileSync(path.join(combo.dir, "requirements.md"), "utf8");
    ok(combo.label === "core +tdd +saas +sec +privacy" && ["saas-sections", "sec-sections", "privacy-sections"].every((id) => chk(cDoc, id).status === "fail") && !chk(cDoc, "ai-sections").status &&
      /\| T-08 \| integration \| example \| abuse case: an unauthenticated request gets 401/.test(cPlan) && /\| T-09 \| integration \| property \|/.test(cPlan) && /US-1\.AC-15/.test(cPlan) &&
      cReq.indexOf("[SaaS]") < cReq.indexOf("[SEC]") && cReq.indexOf("[SEC]") < cReq.indexOf("[PRIVACY]") &&
      !cTr.uncoveredByTasks.length && !cTr.uncoveredByTests.length && !cTr.phantomAcsInTasks.length && !cTr.phantomTestsInTasks.length && !(cTr.testsNotMappedToTasks || []).length,
      "A2: core+tdd+saas+sec+privacy — saas/sec/privacy section checks, abuse-case + privacy test rows (T-08… after the +saas ones), every template AC planned and tasked");
    dropTodo(path.join(combo.dir, "design.md"));
    const cDoc2 = S.specDoctor(cb, combo.slug);
    const cStatus = S.statusFeature(cb, combo.slug);
    ok(["saas-sections", "sec-sections", "privacy-sections"].every((id) => chk(cDoc2, id).status === "pass") && cStatus.scaleSections.every((s) => s.filled) &&
      cStatus.secSections.length === 5 && cStatus.secSections.every((s) => s.filled) && cStatus.privacySections.length === 6 && cStatus.privacySections.every((s) => s.filled),
      "A2: once filled, every track section check passes; spec_status reports secSections (5) / privacySections (6) as filled");
    const fin = S.finishFeature(cb, combo.slug);
    ok(fin.checks.some((c) => /^\+sec: SAST/.test(c)) && fin.checks.some((c) => /^\+privacy: access\/export and erasure/.test(c)) && fin.checks.some((c) => /^\+saas:/.test(c)),
      "A2: spec_finish lists the +sec and +privacy checks only a fresh run or a human can confirm");
    const cTasks = S.parseTasks(fs.readFileSync(path.join(combo.dir, "tasks.md"), "utf8"));
    const authz = S.taskBrief(cb, combo.slug, cTasks.find((x) => /object-level authorization/.test(x.text)).number);
    const reten = S.taskBrief(cb, combo.slug, cTasks.find((x) => /^\[US1\] Retention/.test(x.text)).number);
    ok(authz.ok && authz.designSections.includes("[SEC] Authentication & Authorization") && !authz.designSections.some((s) => /\[PRIVACY\]/.test(s)) &&
      authz.acceptanceCriteria.some((a) => /401/.test(a.text || a)) && reten.ok && reten.designSections.includes("[PRIVACY] Retention & Deletion") &&
      !reten.designSections.some((s) => /\[SEC\]/.test(s)),
      "A2: spec_task_brief — a task proving a +sec / +privacy criterion carries that track's design sections (and only those)");
    fs.writeFileSync(path.join(combo.dir, "requirements.md"), "# F\n\n## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a user asks THE SYSTEM SHALL answer\n");
    const cq = S.clarify(cb, combo.slug).questions;
    const M = S.msg("en").secPrivacy.clarify;
    ok([M.secAccess, M.secSecrets, M.privacyRights, M.privacyRetention].every((q) => cq.includes(q)),
      "A2: spec_clarify asks for the access-denied criterion, the secrets, the data subject rights and the retention periods when requirements.md is silent");

    // --- legacy detection (no .state.json tracks) and spec_upgrade
    const stp = path.join(combo.dir, ".state.json");
    const st = JSON.parse(fs.readFileSync(stp, "utf8"));
    delete st.tracks;
    fs.writeFileSync(stp, JSON.stringify(st, null, 2));
    const up = S.specUpgrade(cb, {});
    const upF = (up.features || []).find((x) => x.name === combo.slug) || {};
    ok(S.statusFeature(cb, combo.slug).tracks === "core +tdd +saas +sec +privacy" && upF.tracksSource === "inferred" && upF.tracks === "core +tdd +saas +sec +privacy" && upF.tracksPending === true,
      "A2: a feature without saved tracks has +sec / +privacy inferred from its [SEC] / [PRIVACY] design headings; spec_upgrade shows them as inferred, pending apply");

    // --- PT: design-save check, roadmap attention and status names are localized; the markers stay English
    const pt = a2("pt-views");
    S.initProject(pt, ["core"], "pt");
    const ptF = S.createFeature(pt, "Exportar dados", ["sec", "privacy"], "", undefined, "pt");
    const ptSave = S.designSaveCheck(pt, ptF.slug);
    const ptMap = fs.readFileSync(path.join(pt, ".specs", "ROADMAP.md"), "utf8");
    ok(ptSave.sections.map((s) => s.track).join() === "sec,privacy" && /secções \[SEC\]: Modelo de Ameaças:por preencher/.test(ptSave.text) && /\[PRIVACY\] AIPD \(por preencher\)/.test(ptMap) &&
      /Fundamento de Licitude e Finalidade/.test(chk(S.specDoctor(pt, ptF.slug), "privacy-sections").detail),
      "A2: PT — the design-save check, ROADMAP.md attention and doctor name the [SEC] / [PRIVACY] sections in Portuguese");

    // --- spec_import with --tracks sec,privacy
    const im = a2("import");
    fs.mkdirSync(path.join(im, ".kiro", "specs", "accounts"), { recursive: true });
    fs.writeFileSync(path.join(im, ".kiro", "specs", "accounts", "requirements.md"), "### Requirement 1\n\n**User Story:** As a user, I want to delete my account.\n\n#### Acceptance Criteria\n\n1. WHEN the user confirms THEN the system SHALL delete the account\n");
    fs.writeFileSync(path.join(im, ".kiro", "specs", "accounts", "design.md"), "# Design\n\n## Overview\nA delete button.\n");
    const imp = S.importSpec(im, "kiro", ".kiro/specs/accounts", { tracks: "sec,privacy" });
    const impDesign = imp.ok ? fs.readFileSync(path.join(im, ".specs", "accounts", "design.md"), "utf8") : "";
    const impTasks = imp.ok ? fs.readFileSync(path.join(im, ".specs", "accounts", "tasks.md"), "utf8") : "";
    ok(imp.ok && imp.tracks.join() === "core,sec,privacy" && /A delete button/.test(impDesign) && /## \[SEC\] Threat Model/.test(impDesign) && /## \[PRIVACY\] Retention & Deletion/.test(impDesign) &&
      !/US-1\.AC-1[0-5]/.test(impTasks) && chk(S.specDoctor(im, "accounts"), "privacy-sections").status === "fail",
      "A2: spec_import --tracks sec,privacy appends the [SEC] / [PRIVACY] sections to the imported design; the kept track tasks cite no template AC the import lacks");

    // --- placeholders, i18n parity, MCP descriptions
    ok(!S.placeholderReport("## [SEC] Threat Model\n## [PRIVACY] DPIA\nSee [SEC] and [PRIVACY].").length,
      "A2: [SEC] / [PRIVACY] are English-stable markers, never template placeholders");
    const spKeys = (l) => JSON.stringify(Object.keys(S.msg(l).secPrivacy).concat(Object.keys(S.msg(l).secPrivacy.clarify), Object.keys(S.msg(l).secPrivacy.finishChecks)));
    const names = [...S.trackSections("sec"), ...S.trackSections("privacy")].map((s) => s.name);
    ok(spKeys("pt") === spKeys("en") && spKeys("es") === spKeys("en") && ["pt", "es"].every((l) => names.every((n) => S.msg(l).sectionNames[n] && S.msg(l).secPrivacy.sectionNames[n])) &&
      S.trackSections("core") === undefined && S.trackSections("sec").length === 5 && S.trackSections("privacy").length === 6,
      "A2: EN/PT/ES parity — the same secPrivacy messages in every language, PT/ES names for all 11 [SEC] / [PRIVACY] sections");
    const desc = (n) => (list.result.tools.find((t) => t.name === n) || {}).description || "";
    const trackItem = (n) => JSON.stringify((list.result.tools.find((t) => t.name === n) || {}).inputSchema || {});
    ok(/sec-sections \/ privacy-sections/.test(desc("spec_doctor")) && /\+sec/.test(desc("spec_classify")) && /\+privacy/.test(desc("spec_add_track")) &&
      /core \| tdd \| saas \| ai \| sec \| privacy/.test(trackItem("spec_create")) && /core \| tdd \| saas \| ai \| sec \| privacy/.test(trackItem("spec_init")) &&
      /tdd \| saas \| ai \| sec \| privacy/.test(trackItem("spec_add_track")) && !/"enum"[^\]]*"privacy"/.test(trackItem("spec_create")),
      "A2: the MCP tool descriptions name sec / privacy (tracks keep no schema enum — unknown names get the did-you-mean)");
  }

  // 1.17 package (D) — +dist track: distributed systems and data consistency.

  { // 1.17 D — the built-in +dist track end to end: registry, classifier (EN / PT / ES), scaffolds (EN / PT / ES / pt-BR), gates, views
    const I = require("./lib/i18n.js");
    const js = (v) => JSON.stringify(v);
    const rd = (...p) => fs.readFileSync(path.join(...p), "utf8");
    const dRoot = path.join(tmp, "p17d");
    const d = (n) => path.join(dRoot, n);
    const chk = (doc, id) => doc.checks.find((c) => c.id === id) || {};
    const dropTodo = (file) => fs.writeFileSync(file, rd(file).split(/\r?\n/).filter((l) => !/^\s*>\s*\*\*TODO\*\*/.test(l)).join("\n"));
    const cls = (t, lang) => S.classify(t, lang ? { lang } : {});

    // --- D1: the registry
    const typo = S.createFeature(d("typo"), "Typo", "distt");
    const alias = S.createFeature(d("typo"), "Typo", ["kafka"]);
    ok(S.VALID_TRACKS.includes("dist") && S.OPTIONAL_TRACKS.indexOf("dist") === S.OPTIONAL_TRACKS.indexOf("privacy") + 1 && S.TRACK_MARKER.dist === "[DIST]" &&
      S.trackLabel(S.normalizeTracks("+dist privacy tdd")) === "core +tdd +privacy +dist" && S.trackSections("dist").map((x) => x.name).join() === "Consistency Model,Cross-system Writes,Delivery & Idempotency,Concurrency,Failure Modes" &&
      !typo.ok && /did you mean 'dist'/.test(typo.error) && !alias.ok && /'kafka' \(did you mean 'dist'\?\)/.test(alias.error),
      "1.17 D1: dist is a valid, composable marker track ([DIST], 5 sections, labelled after privacy); 'distt' / 'kafka' get a did-you-mean (got " + js([S.OPTIONAL_TRACKS, typo.error, alias.error]) + ")");

    // --- D2: the user's example turns +dist on in EN / PT / ES (and without Kafka, from the gap phrase + other services)
    const exEn = cls("Create an endpoint that writes a user to Postgres and publishes a UserCreated event to Kafka for other services");
    const exPt = cls("Criar um endpoint que grava um utilizador no Postgres e publica um evento UserCreated no Kafka para outros serviços");
    const exEs = cls("Crear un endpoint que escribe un usuario en Postgres y publica un evento UserCreated en Kafka para otros servicios");
    const exNoKafka = cls("Create an endpoint that writes a user to Postgres and publishes a UserCreated event for other services");
    ok([exEn, exPt, exEs].every((r) => r.label === "core +dist" && r.signals.dist.includes("kafka") && r.confidence.dist === "high") && exPt.lang === "pt" && exEs.lang === "es" &&
      exEn.signals.dist.includes("publish … event") && exPt.signals.dist.includes("public … evento") && exEs.signals.dist.includes("otros servicios") &&
      exNoKafka.tracks.includes("dist") && exNoKafka.weak.includes("dist") && /\+dist: ON/.test(exEn.reasoning),
      "1.17 D2: the user's example (Postgres + a UserCreated event to Kafka for other services) is core +dist in EN / PT / ES; without Kafka the gap phrase 'publish … event' + 'other services' still turn it on (weak-only) (got " +
      js([exEn.signals.dist, exPt.signals.dist, exEs.signals.dist, exNoKafka.signals.dist]) + ")");

    // --- D3: negatives and 'possible' — plain CRUD, a lone retry, an events app, DOM events, video streaming, an account lock, CDC the agency
    const neg = {
      crud: cls("Create an endpoint that writes a user to Postgres and returns it"),
      retry: cls("Retry the image upload when the network drops"),
      retries: cls("Retry failed uploads; limit retries to 3"),
      events: cls("Organizers can publish an event and sell tickets"),
      click: cls("Add a click event listener to the button"),
      video: cls("Video streaming page with a playlist"),
      lock: cls("Lock the account after 5 failed login attempts; the user can retry after 15 minutes"),
      cdc: cls("Health dashboard following CDC guidelines"),
      audit: cls("Store audit events in Postgres"),
    };
    const offAll = Object.values(neg).every((r) => !r.tracks.includes("dist"));
    const possible = (r) => r.possible.some((p) => p.track === "dist");
    ok(offAll && !neg.crud.signals.dist.length && !possible(neg.crud) && possible(neg.retry) && possible(neg.retries) && js(neg.retries.signals.dist) === js(["retry"]) &&
      possible(neg.events) && !neg.click.signals.dist.length && !neg.video.signals.dist.length && possible(neg.lock) && neg.lock.tracks.includes("tdd") && possible(neg.cdc) &&
      !neg.audit.signals.dist.length && cls("the health CDC report").signals.dist.includes("CDC") && !cls("the cdc report").signals.dist.length,
      "1.17 D3: no +dist from plain CRUD, a click event, video streaming or audit events; a lone retry (one concept: 'retry' + 'retries'), 'publish an event' on an events app, an account lock's retry, 'CDC' — only 'possible' (got " +
      js(Object.fromEntries(Object.entries(neg).map(([k, r]) => [k, [r.label, r.signals.dist]]))) + ")");

    // --- D4: pairs of weak signals, shadowing, shared keywords, negation annotates
    const pair = cls("Queue the welcome email and retry with exponential backoff");
    const mq = cls("Consume orders from a message queue");
    const both = cls("Stream processing of clicks with exactly-once semantics");
    const kept = cls("Plain CRUD endpoint for users, no Kafka and no events");
    const although = cls("Kafka consumer for orders — no distributed transactions");
    const saga = cls("Implement checkout as a saga with compensating transactions across the order and payment services");
    const lockOpt = cls("Use optimistic locking so concurrent updates to the cart never overwrite each other");
    // (1.17 D review 4: "message queue" is a +saas weak phrase too — the +saas hint survives; the bare 'queue' inside it is still no second hint)
    ok(pair.tracks.includes("dist") && pair.weak.includes("dist") && mq.tracks.includes("dist") && !mq.signals.saas.includes("queue") && js(mq.signals.saas) === js(["message queue"]) &&
      both.tracks.includes("dist") && both.tracks.includes("tdd") && both.signals.tdd.includes("exactly-once") && both.signals.dist.includes("exactly-once") &&
      !kept.tracks.includes("dist") && kept.notes.some((n) => /\+dist kept off — 'kafka'/.test(n)) &&
      although.tracks.includes("dist") && although.notes.some((n) => /\+dist is ON although 'distributed transaction' appeared negated/.test(n)) &&
      saga.tracks.includes("dist") && saga.signals.dist.includes("compensating transaction") && lockOpt.signals.dist.includes("optimistic locking"),
      "1.17 D4: two weak signals turn +dist on (weak-only); 'queue' inside 'message queue' is no second +saas hint (the phrase itself is one); 'exactly-once' serves +tdd and +dist; a negated signal keeps it off with a note or annotates it when a strong one wins (got " +
      js([pair.signals.dist, mq.signals, both.signals.dist, kept.notes, although.notes]) + ")");

    // --- D5: self-match sweep — every +dist keyword (EN / PT / ES) matches itself as a word; a strong one alone turns the track on
    const probe = { "public … evento": "publicar … evento", "public … mensagem": "publicou … mensagem", "public … mensaje": "publicó … mensaje", reintento: "reintentar",
      "envi … mensagem": "enviar … mensagem", "envi … mensaje": "enviar … mensaje" }; // (1.17 D review: + the generic tier)
    const sweep = [];
    const sg = S.trackSignals("dist");
    for (const tier of ["strong", "weak", "generic"]) for (const kw of sg[tier]) {
      const r = S.classify("We need " + (probe[kw] || kw) + " here");
      if (!r.signals.dist.some((m) => m === kw || m.includes(kw)) || (tier === "strong" && !r.tracks.includes("dist"))) sweep.push(tier + ":" + kw);
    }
    const ctxAlone = cls("The transaction keeps the totals consistent and atomic");
    ok(sweep.length === 0 && sg.strong.length > 60 && sg.weak.length > 40 && sg.context.includes("transaction") && !ctxAlone.signals.dist.length && !possible(ctxAlone) &&
      cls("We publish updates. The event page lists them").signals.dist.length === 0 && cls("publishes an OrderPlaced domain event").signals.dist.includes("domain event"),
      "1.17 D5: self-match sweep — every +dist keyword matches itself (gap phrases and verb stems probed by a conjugation); context words alone are no signal; a gap never crosses a sentence (misses: " + sweep.join(", ") + ")");
    const mcpCls = payload(await rpc("tools/call", { name: "spec_classify", arguments: { description: "Create an endpoint that writes a user to Postgres and publishes a UserCreated event to Kafka for other services", projectDir: d("mcp") } }));
    const tl = await rpc("tools/list", {});
    const addDesc = ((tl.result.tools.find((t) => t.name === "spec_add_track") || {}).inputSchema || { properties: { track: {} } }).properties.track.description || "";
    ok(mcpCls.label === "core +dist" && /sec \| privacy \| dist/.test(addDesc),
      "1.17 D5: spec_classify (MCP) reports core +dist for the example; the spec_add_track schema names dist (got " + js([mcpCls.label, addDesc]) + ")");

    // --- D6: scaffold per language: 5 [DIST] sections with the TODO sentinel, the [DIST] criteria, fresh artifacts read 'placeholder',
    // dist-sections fails and the design approval is refused while TODO; filled, it passes
    const unfilledWord = { en: /unfilled/, pt: /por preencher/, es: /sin rellenar/, "pt-BR": /sem preencher/ };
    const titles = { en: "Cross-system Writes", pt: "Escritas entre Sistemas", es: "Escrituras entre Sistemas", "pt-BR": "Escritas entre Sistemas" };
    for (const lang of ["en", "pt", "es", "pt-BR"]) {
      const p = d("scaffold-" + lang);
      const f = S.createFeature(p, "Dist " + lang, ["dist"], "", undefined, lang);
      const design = rd(f.dir, "design.md"), reqs = rd(f.dir, "requirements.md"), tasks = rd(f.dir, "tasks.md");
      const heads = design.split("\n").filter((l) => /^## \[DIST\] /.test(l));
      const e = S.earsValidate(reqs, lang);
      const own = e.issues.filter((i) => i.code !== "placeholder" && /US-1\.AC-1[6-9]/.test(i.text || ""));
      const states = fs.readdirSync(f.dir).filter((n) => n.endsWith(".md") && n !== "checklist.md").map((n) => [n, S.artifactState(path.join(f.dir, n))]);
      const before = S.specDoctor(p, f.slug);
      S.approvePhase(p, f.slug, "classification", "t", { force: true });
      S.approvePhase(p, f.slug, "requirements", "t", { force: true });
      const refused = S.approvePhase(p, f.slug, "design", "t");
      dropTodo(path.join(f.dir, "design.md"));
      const after = S.specDoctor(p, f.slug);
      const retry = S.approvePhase(p, f.slug, "design", "t");
      ok(f.ok && f.label === "core +dist" && heads.length === 5 && design.includes(titles[lang]) && (design.match(/^> \*\*TODO\*\*/gm) || []).length === 5 &&
        reqs.includes("#### [DIST]") && ["16", "17", "18", "19"].every((n) => reqs.includes("US-1.AC-" + n) && tasks.includes("US-1.AC-" + n)) &&
        !own.length && e.issues.every((i) => i.severity !== "error") && states.length >= 4 && states.every(([, st]) => st === "placeholder") &&
        chk(before, "dist-sections").status === "fail" && unfilledWord[lang].test(chk(before, "dist-sections").detail) && !chk(before, "sec-sections").status &&
        !refused.ok && refused.failing.includes("dist-sections") && chk(after, "dist-sections").status === "pass" && /5/.test(chk(after, "dist-sections").detail) &&
        !(retry.failing || []).includes("dist-sections"),
        `1.17 D6: ${lang} +dist scaffold — 5 [DIST] sections with the TODO sentinel, [DIST] criteria US-1.AC-16..19 (no EARS issue but slots), every fresh artifact reads 'placeholder', dist-sections fails and the design approval is refused while TODO, passes once filled (got ` +
        js([heads, own.map((i) => i.code), states.filter(([, st]) => st !== "placeholder"), chk(before, "dist-sections").detail, chk(after, "dist-sections").detail]) + ")");
    }

    // --- D7: a filled +dist feature is ready — doctor passes and every gate approves without force (EN / PT / ES round trip)
    const SLOT = /\[(?!shared\]|US\d+\]|[ xX]\]|P\]|DIST\]|NEEDS)[^\]\n]*\]/g;
    for (const lang of ["en", "pt", "es"]) {
      const p = d("filled-" + lang);
      S.initProject(p, ["core", "dist"], lang);
      const f = S.createFeature(p, "Filled " + lang, ["dist"], "", undefined, lang);
      for (const file of ["classification.md", "requirements.md", "design.md", "tasks.md"]) {
        const fp = path.join(f.dir, file);
        let t = rd(fp);
        for (let i = 0; i < 3; i++) t = t.replace(SLOT, "the order event");
        fs.writeFileSync(fp, t.split(/\r?\n/).filter((l) => !/^\s*>\s*\*\*TODO\*\*/.test(l)).join("\n"));
      }
      const doc = S.specDoctor(p, f.slug);
      const gates = ["classification", "requirements", "design", "tasks"].map((ph) => [ph, S.approvePhase(p, f.slug, ph, "t")]);
      ok(doc.readyToAdvance && !doc.checks.some((c) => c.status === "fail") && chk(doc, "dist-sections").status === "pass" && chk(doc, "ears").status === "pass" &&
        chk(doc, "traceability").status === "pass" && gates.every(([ph, r]) => r.ok && r.approved === ph && !r.forced),
        `1.17 D7: ${lang} — a filled +dist feature is ready (doctor has no fail, EARS + traceability pass) and classification → requirements → design → tasks approve without force (got ` +
        js(gates.filter(([, r]) => !r.ok).map(([ph, r]) => ph + ":" + (r.failing || []).join(","))) + ")");
    }

    // --- D8: every marker track together (+tdd +saas +sec +privacy +dist): criteria in track order, T-IDs after the others, property rows, traced
    const cb = d("combined");
    const combo = S.createFeature(cb, "Order Events", ["tdd", "saas", "sec", "privacy", "dist"], "", undefined, "en");
    const cReq = rd(combo.dir, "requirements.md"), cPlan = rd(combo.dir, "test-plan.md");
    const cTr = S.traceCheck(cb, combo.slug);
    ok(combo.label === "core +tdd +saas +sec +privacy +dist" && cReq.indexOf("[PRIVACY]") < cReq.indexOf("[DIST]") &&
      /\| T-14 \| integration \| example \| crash between the DB commit and the publish: the event is still delivered \| US-1\.AC-16 \|/.test(cPlan) &&
      /\| T-15 \| integration \| property \| the same message delivered twice \(or N times\) has exactly one effect \| US-1\.AC-17 \|/.test(cPlan) &&
      /\| T-16 \| integration \| property \| .* \| US-1\.AC-18 \|/.test(cPlan) && /\| T-17 \| integration \| example \| .* \| US-1\.AC-19 \|/.test(cPlan) &&
      !cTr.uncoveredByTasks.length && !cTr.uncoveredByTests.length && !cTr.phantomAcsInTasks.length && !cTr.phantomTestsInTasks.length && !(cTr.testsNotMappedToTasks || []).length &&
      ["saas-sections", "sec-sections", "privacy-sections", "dist-sections"].every((id) => chk(S.specDoctor(cb, combo.slug), id).status === "fail"),
      "1.17 D8: core+tdd+saas+sec+privacy+dist — [DIST] criteria after [PRIVACY], its 4 test rows T-14..17 (duplicate delivery and lost update are property rows), every template AC planned and tasked, four section checks (got " +
      js(cPlan.split("\n").filter((l) => /US-1\.AC-1[6-9]/.test(l))) + ")");
    dropTodo(path.join(combo.dir, "design.md"));
    const cStatus = S.statusFeature(cb, combo.slug);
    const fin = S.finishFeature(cb, combo.slug);
    const cTasks = S.parseTasks(rd(combo.dir, "tasks.md"));
    const outboxTask = cTasks.find((x) => /^\[US1\] Transactional outbox/.test(x.text));
    const brief = S.taskBrief(cb, combo.slug, outboxTask.number);
    const secTask = cTasks.find((x) => /object-level authorization/.test(x.text));
    const secBrief = S.taskBrief(cb, combo.slug, secTask.number);
    const mx = S.traceMatrix(cb, combo.slug);
    const mRow = (mx.rows || []).find((r) => r.id === "US-1.AC-17") || {};
    ok(Array.isArray(cStatus.distSections) && cStatus.distSections.length === 5 && cStatus.distSections.every((s) => s.filled) &&
      fin.checks.some((c) => /^\+dist: failure-injection tests green/.test(c)) && fin.checks.some((c) => /^\+sec: SAST/.test(c)) &&
      brief.ok && brief.designSections.includes("[DIST] Cross-system Writes") && brief.designSections.includes("[DIST] Failure Modes") && !brief.designSections.some((s) => /\[SEC\]|\[PRIVACY\]/.test(s)) &&
      secBrief.ok && !secBrief.designSections.some((s) => /\[DIST\]/.test(s)) && (mRow.design || []).includes("[DIST] Delivery & Idempotency"),
      "1.17 D8: once filled — spec_status distSections (5, filled), spec_finish lists the +dist checks, a task proving a [DIST] criterion gets the [DIST] design sections in its brief (and only those), the matrix links a [DIST] criterion to them (got " +
      js([cStatus.distSections, brief.designSections, secBrief.designSections, mRow.design]) + ")");
    fs.writeFileSync(path.join(combo.dir, "requirements.md"), "# F\n\n## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a user asks THE SYSTEM SHALL answer\n");
    const cq = S.clarify(cb, combo.slug).questions;
    fs.writeFileSync(path.join(combo.dir, "requirements.md"), "# F\n\n## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a message is delivered more than once THE SYSTEM SHALL apply it once\n2. **US-1.AC-2** — IF the broker is unavailable THEN THE SYSTEM SHALL keep the events in the outbox\n");
    const cq2 = S.clarify(cb, combo.slug).questions;
    const Q = S.msg("en").secPrivacy.clarify;
    ok(cq.includes(Q.distDelivery) && cq.includes(Q.distFailure) && !cq2.includes(Q.distDelivery) && !cq2.includes(Q.distFailure),
      "1.17 D8: spec_clarify asks for the delivery guarantee / duplicates and each dependency's failure while requirements.md is silent, not once they are written (got " + js(cq.filter((q) => /delivery|dependency/i.test(q))) + ")");

    // --- D9: steering distributed.md (EN / PT / ES / pt-BR), doctor's steering warns while it is a template
    const stP = d("steering-pt");
    const initPt = S.initProject(stP, ["core", "dist"], "pt");
    const stF = S.createFeature(stP, "Eventos", ["dist"]);
    ok(initPt.created.includes("distributed.md") && /^# Padrões de Sistemas Distribuídos e Consistência de Dados/.test(rd(stP, ".specs", "steering", "distributed.md")) &&
      /distributed\.md/.test(chk(S.specDoctor(stP, stF.slug), "steering").detail) && I.steeringKnownFiles().includes("distributed.md") &&
      ["en", "pt", "es", "pt-BR"].every((l) => /outbox/.test(I.steeringStub("distributed.md", l) || "")) && /^# Estándares de Sistemas Distribuidos/.test(I.steeringStub("distributed.md", "es")),
      "1.17 D9: spec_init +dist writes steering/distributed.md in the project language, flagged as a template until filled; EN / PT / ES / pt-BR stubs exist (got " + js([initPt.created, chk(S.specDoctor(stP, stF.slug), "steering").detail]) + ")");

    // --- D10: add_track / remove / re-add (additive, non-destructive)
    const at = d("add-track");
    S.initProject(at, ["core"], "en");
    const plain = S.createFeature(at, "Plain", ["core"], "", undefined, "en");
    const tBefore = S.statusFeature(at, plain.slug).tasks.total;
    const add = S.addTrack(at, plain.slug, "+dist");
    const pDesign = rd(plain.dir, "design.md"), pTasks = rd(plain.dir, "tasks.md");
    const docAdd = S.specDoctor(at, plain.slug);
    const tAdded = S.statusFeature(at, plain.slug).tasks.total;
    const rm = S.removeTrack(at, plain.slug, "dist");
    const docRm = S.specDoctor(at, plain.slug), stRm = S.statusFeature(at, plain.slug);
    const reAdd = S.addTrack(at, plain.slug, "dist");
    ok(add.ok && add.tracks === "core +dist" && add.added.includes("steering/distributed.md") && /## \[DIST\] Consistency Model/.test(pDesign) && /## Story US-1 — Data Consistency/.test(pTasks) &&
      /_Requirements: \[the \+dist criterion this task proves\]_/.test(pTasks) && /## Active Tracks\ncore \+dist/.test(rd(plain.dir, "classification.md")) && chk(docAdd, "dist-sections").status === "fail" &&
      tAdded === tBefore + 5 && rm.ok && rm.tracks === "core" && rm.inactive.includes("design.md ([DIST] sections)") && rm.inactive.includes("tasks.md (Story US-1 — Data Consistency)") &&
      !chk(docRm, "dist-sections").status && stRm.distSections === null && stRm.tasks.total === tBefore && rd(plain.dir, "design.md").includes("[DIST] Consistency Model") &&
      reAdd.ok && reAdd.tracks === "core +dist" && (rd(plain.dir, "tasks.md").match(/## Story US-1 — Data Consistency/g) || []).length === 1 && S.statusFeature(at, plain.slug).tasks.total === tBefore + 5,
      "1.17 D10: add_track dist (sections, steering, 5 template tasks with placeholder ACs, Active Tracks, dist-sections fails); --remove is non-destructive (inactive, no check, distSections null, tasks not counted); re-adding duplicates nothing (got " +
      js([add.added, rm.inactive, tBefore, tAdded]) + ")");

    // --- D11: markers are case-sensitive; the loose synonyms only count in the [DIST] context; [DIST] is no placeholder
    const cs = d("case");
    const csF = S.createFeature(cs, "Timeouts", ["core"], "", undefined, "en");
    fs.appendFileSync(path.join(csF.dir, "design.md"), "\n### Queue [dist]\n- the retry delay, in [dist] units\n");
    const csState = path.join(csF.dir, ".state.json");
    const csSt = JSON.parse(rd(csState)); delete csSt.tracks; fs.writeFileSync(csState, JSON.stringify(csSt, null, 2));
    const csTracks = S.statusFeature(cs, csF.slug).tracks;
    fs.appendFileSync(path.join(csF.dir, "design.md"), "\n## [DIST] Consistency Model\n- one transaction\n");
    const csInferred = S.statusFeature(cs, csF.slug).tracks;
    const lz = S.createFeature(d("loose"), "Loose", ["dist"], "", undefined, "en");
    dropTodo(path.join(lz.dir, "design.md"));
    fs.writeFileSync(path.join(lz.dir, "design.md"), rd(lz.dir, "design.md").replace("## [DIST] Concurrency", "## Concurrency"));
    const lzDoc = chk(S.specDoctor(d("loose"), lz.slug), "dist-sections");
    ok(csTracks === "core" && csInferred === "core +dist" && lzDoc.status === "fail" && /Concurrency:missing/.test(lzDoc.detail) && !/Consistency Model:/.test(lzDoc.detail) &&
      S.artifactState({ text: "# Notes\n\nThe [DIST] sections were reviewed on Monday by the whole team.\n" }) === "filled",
      "1.17 D11: '### Queue [dist]' is prose (no +dist inferred), '## [DIST] Consistency Model' infers it; a core '## Concurrency' never satisfies [DIST] Concurrency (loose synonym); [DIST] is a stable bracket, not a slot (got " +
      js([csTracks, csInferred, lzDoc.detail]) + ")");

    // --- D12: a track pack can't take the name or the marker (nor an alias: kafka)
    const tp = d("packs");
    S.initProject(tp, ["core"], "en");
    const pDist = S.trackPacks(tp, "init", { name: "dist" });
    const pKafka = S.trackPacks(tp, "init", { name: "kafka" });
    fs.mkdirSync(path.join(tp, ".specs", "tracks", "events"), { recursive: true });
    fs.writeFileSync(path.join(tp, ".specs", "tracks", "events", "track.json"), JSON.stringify({ name: "events", marker: "DIST", title: { en: "Events" }, sections: [{ name: "Event Catalog" }] }));
    const pChk = S.trackPacks(tp, "check");
    const probs = JSON.stringify(pChk);
    ok(!pDist.ok && /reserved/.test(pDist.error) && !pKafka.ok && /reserved/.test(pKafka.error) && /marker-reserved/.test(probs) &&
      !S.parseTracks("events").tracks.includes("events") && S.trackPacks(tp, "list").builtIn.map((b) => b.name).join() === "core,tdd,saas,ai,sec,privacy,dist,api,ui,obs,data",
      "1.17 D12: a track pack named dist (or kafka) is refused, one with the marker DIST is invalid (marker-reserved); spec_tracks list names the built-in tracks (got " + js([pDist.error, pKafka.error, probs.slice(0, 300)]) + ")");

    // --- D13: project templates — the copied built-ins check clean; a design template with some [DIST] headings needs them all
    const tt = d("templates");
    S.initProject(tt, ["core"], "en");
    const tInit = S.templates(tt, "init", {});
    const tClean = S.templates(tt, "check");
    fs.writeFileSync(path.join(tt, ".specs", "templates", "design.md"), "# Design: {{name}}\n\n## Overview\n[how]\n\n## Constitution Check\n- [ ] [Principle 1]\n\n## [DIST] Consistency Model\n> **TODO** — fill it.\n- [what is atomic]\n");
    const tBad = S.templates(tt, "check");
    const miss = (tBad.problems || []).filter((x) => x.code === "missing-section" && /\[DIST\]/.test(x.message));
    const tf = S.createFeature(tt, "From Template", ["dist"], "", undefined, "en");
    const tfDesign = rd(tf.dir, "design.md");
    ok(tInit.ok && tInit.created.includes(".specs/templates/steering/distributed.md") && tClean.verdict === "pass" && tBad.verdict === "fail" && miss.length === 4 &&
      (tfDesign.match(/^## \[DIST\] Consistency Model/gm) || []).length === 1,
      "1.17 D13: spec_templates init copies steering/distributed.md and the copies check clean; a design template carrying one [DIST] section must carry all five (4 missing-section errors); a +dist feature from it keeps the template's section (got " +
      js([tClean.verdict, miss.map((x) => x.message)]) + ")");

    // --- D14: spec_import auto-classifies +dist and appends the [DIST] sections; the Gherkin export tags the feature @DIST
    const im = d("import");
    fs.mkdirSync(path.join(im, ".kiro", "specs", "signup"), { recursive: true });
    fs.writeFileSync(path.join(im, ".kiro", "specs", "signup", "requirements.md"), "### Requirement 1\n\n**User Story:** As a user, I want to sign up.\n\n#### Acceptance Criteria\n\n1. WHEN the user signs up THEN the system SHALL store the user and publish a UserCreated event to Kafka\n");
    fs.writeFileSync(path.join(im, ".kiro", "specs", "signup", "design.md"), "# Design\n\n## Overview\nA signup endpoint.\n");
    const imp = S.importSpec(im, "kiro", ".kiro/specs/signup", {});
    const impDesign = imp.ok ? rd(im, ".specs", "signup", "design.md") : "";
    const gk = S.exportSpecs(im, { name: "signup", format: "gherkin" });
    ok(imp.ok && imp.tracks.includes("dist") && /A signup endpoint/.test(impDesign) && /## \[DIST\] Cross-system Writes/.test(impDesign) && /^@DIST\b/m.test(gk.content || ""),
      "1.17 D14: spec_import classifies a Kafka-publishing spec as +dist and appends the [DIST] sections to the imported design; the Gherkin export tags it @DIST (got " + js([imp.tracks, (gk.content || "").split("\n").filter((l) => l.startsWith("@")).slice(0, 2)]) + ")");

    // --- D15: PT views (design-save check, ROADMAP.md attention) and the pt-BR twins of the new PT strings
    const pv = d("pt-views");
    S.initProject(pv, ["core"], "pt");
    const pvF = S.createFeature(pv, "Publicar eventos", ["dist"], "", undefined, "pt");
    const pvSave = S.designSaveCheck(pv, pvF.slug);
    const pvMap = rd(pv, ".specs", "ROADMAP.md");
    const aBr = { name: "ARGN", tracks: ["core", "tdd", "dist"], label: "core +tdd +dist", slug: "argn", summary: "" };
    const brTexts = [...["requirements", "design", "tasks", "checklist"].map((b) => I[b](aBr, "pt-BR")), I.testPlan("ARGN", "pt-BR", aBr.tracks), I.steeringStub("distributed.md", "pt-BR"),
      ...S.msg("pt-BR").secPrivacy.finishChecks.dist, S.msg("pt-BR").secPrivacy.clarify.distDelivery, S.msg("pt-BR").secPrivacy.clarify.distFailure].join("\n");
    const EU = /(?<![\p{L}])(?:utilizador(?:es)?|registos?|partilhad[oa]s?|atómic[oa]s?|secç(?:ão|ões))(?![\p{L}])|por omissão|em baixo|condições de executada/iu;
    ok(/secções \[DIST\]: Modelo de Consistência:por preencher/.test(pvSave.text) && /\[DIST\] Modos de Falha \(por preencher\)/.test(pvMap) &&
      !EU.test(brTexts) && /Condições de corrida/.test(brTexts) && /atômico/.test(brTexts) && I.toPtBr(brTexts) === brTexts &&
      (brTexts.match(/US-1\.AC-1[6-9]/g) || []).length >= 12 && /## \[DIST\] Modelo de Consistência/.test(brTexts),
      "1.17 D15: PT — the design-save check and ROADMAP.md name the [DIST] sections in Portuguese; the pt-BR twins hold no European-only word ('condição de corrida' kept, atômico), are idempotent and keep [DIST] / the AC IDs (got " +
      js([(brTexts.match(EU) || [])[0], pvSave.text.split("\n")[1]]) + ")");

    // --- 1.17 D review 1: a 1.16 track pack whose name 1.17 reserves ('dist' — now a built-in track —, 'kafka' — an alias). The feature
    // recorded it in .state.json packMarkers: it stays that feature's missing pack (never dropped, never the built-in track), doctor and
    // spec_upgrade say why and how out; add-track <built-in name> adopts the built-in track, add-track <name> --remove drops the pack.
    const lp = d("legacy-packs");
    S.initProject(lp, ["core"], "en");
    const legacyFeature = (name, marker, section) => {
      const pdir = path.join(lp, ".specs", "tracks", name); // the 1.16 pack folder (invalid now: name-reserved)
      fs.mkdirSync(pdir, { recursive: true });
      fs.writeFileSync(path.join(pdir, "track.json"), JSON.stringify({ name, marker, title: { en: "Legacy " + name }, sections: [{ name: section, guidance: "Say how." }] }));
      const f = S.createFeature(lp, "f-" + name, ["core"], "", undefined, "en");
      const sp = path.join(f.dir, ".state.json");
      const st = JSON.parse(rd(sp));
      st.tracks = ["core", name];
      st.packMarkers = { [name]: "[" + marker + "]" }; // what a 1.16 create with the pack recorded
      fs.writeFileSync(sp, JSON.stringify(st, null, 2));
      fs.appendFileSync(path.join(f.dir, "design.md"), "\n## [" + marker + "] " + section + "\n- decided: our " + section.toLowerCase() + ".\n");
      return f;
    };
    const lpDist = legacyFeature("dist", "DIST", "Release Channels");
    const lpKafka = legacyFeature("kafka", "KAFKA", "Topic Catalog");
    const lpDocD = S.specDoctor(lp, "f-dist"), lpDocK = S.specDoctor(lp, "f-kafka");
    const lpStD = S.statusFeature(lp, "f-dist"), lpStK = S.statusFeature(lp, "f-kafka");
    const lpUp = S.specUpgrade(lp);
    const lpUpF = (n) => lpUp.features.find((x) => x.name === n) || {};
    ok(lpStD.tracks === "core" && js(lpStD.missingPacks) === js(["dist"]) && !chk(lpDocD, "dist-sections").status && chk(lpDocD, "track-pack-missing").status === "warn" &&
      /\+dist \(a track pack from before 1\.17 — 'dist' is a reserved name now, and the built-in \+dist track is NOT applied to this feature: rename \.specs\/tracks\/dist\//.test(chk(lpDocD, "track-pack-missing").detail) &&
      /node "[^"]*dev-spec\.js" add-track f-dist dist --remove; to adopt the built-in track instead: node "[^"]*dev-spec\.js" add-track f-dist dist\)/.test(chk(lpDocD, "track-pack-missing").detail) &&
      lpStK.tracks === "core" && js(lpStK.missingPacks) === js(["kafka"]) && /'kafka' is a reserved name now: rename/.test(chk(lpDocK, "track-pack-missing").detail) &&
      lpUpF("f-dist").attention.includes("track-pack-reserved") && js(lpUpF("f-kafka").reservedPacks) === js(["kafka"]) &&
      lpUp.lines.some((l) => /Rename its track pack\(s\) from before 1\.17 — \+kafka: the name is reserved now/.test(l)),
      "1.17 D review 1: a 1.16 pack named 'dist' / 'kafka' (recorded in packMarkers) is the feature's missing pack — tracks read core, the built-in +dist is NOT switched on (no dist-sections), doctor's track-pack-missing names the reserved name and the way out, spec_upgrade flags track-pack-reserved (got " +
      js([lpStD.tracks, lpStD.missingPacks, chk(lpDocD, "dist-sections").status, chk(lpDocK, "track-pack-missing").detail, lpUpF("f-dist").attention]) + ")");
    const lpAdopt = S.addTrack(lp, "f-dist", "dist");
    const lpAdoptSt = JSON.parse(rd(lpDist.dir, ".state.json"));
    const lpAdoptDoc = S.specDoctor(lp, "f-dist");
    const lpDrop = S.addTrack(lp, "f-kafka", "kafka", { remove: true });
    const lpDropSt = JSON.parse(rd(lpKafka.dir, ".state.json"));
    ok(lpAdopt.ok && js(lpAdopt.adopted) === js(["dist"]) && lpAdopt.tracks === "core +dist" && !("packMarkers" in lpAdoptSt) && js(lpAdoptSt.tracks) === js(["core", "dist"]) &&
      /## \[DIST\] Consistency Model/.test(rd(lpDist.dir, "design.md")) && chk(lpAdoptDoc, "dist-sections").status === "fail" && !chk(lpAdoptDoc, "track-pack-missing").status &&
      lpDrop.ok && js(lpDrop.removedTracks) === js(["kafka"]) && js(lpDropSt.tracks) === js(["core"]) && lpDropSt.packMarkers.kafka === "[KAFKA]" && !chk(S.specDoctor(lp, "f-kafka"), "track-pack-missing").status,
      "1.17 D review 1: add-track f-dist dist adopts the built-in track (the pack's record goes, the five [DIST] sections are appended although a [DIST] heading existed); add-track f-kafka kafka --remove drops the legacy pack from the list (its marker stays recorded: its sections stay inactive) (got " +
      js([lpAdopt.adopted, lpAdopt.tracks, lpAdoptSt.tracks, lpDrop.removedTracks, lpDrop.error, lpDropSt]) + ")");

    // --- 1.17 D review 2: precision — app-level words (a print queue, a music player's retry, a farmers' market, a newsletter, an email
    // Outbox, a live event stream, Vue's event bus, a club's leader election, "2PCS", an event-driven game loop) never turn +dist on; one
    // concept is one signal; recall stays high. A compact corpus (EN / PT / ES), before this review: precision 17%, recall 17%.
    const corpus = [
      ["N", "Email client: the outbox folder shows messages waiting to be sent."], ["N", "Add a live event stream page where attendees watch the keynote and chat."],
      ["N", "Replace the Vue event bus with Pinia stores for component communication."], ["N", "Chess club: members hold a leader election every spring."],
      ["N", "Product page for the 2PCS silicone lid set."], ["N", "An event-driven game loop for the browser puzzle game."],
      ["N", "A farmers' marketplace connecting local producers with consumers, with product listings and checkout."], ["N", "Newsletter: editors publish the weekly message to all subscribers."],
      ["N", "Print queue: users send documents to the office printer queue and can retry failed prints."],
      ["N", "Music player: users queue up songs, and the app retries playback when the connection drops."],
      ["N", "Offline mode: queue form submissions while offline and retry them when back online."],
      ["N", "Deduplicate contacts in the CRM: a nightly job finds duplicates and lets the admin dedupe them."],
      ["N", "Video call stats panel: show network jitter and packet loss; retry the connection when it drops."],
      ["N", "The content producer uploads videos and the consumer watches them on the TV app."], ["N", "Show a success message after the user saves the profile form."],
      ["N", "Marketplace que liga produtores locais a consumidores, com catálogo e checkout."], ["N", "Newsletter: o editor publica a mensagem semanal para todos os subscritores."],
      ["N", "Fila de impressão: os utilizadores enviam documentos para a fila da impressora e podem fazer nova tentativa."],
      ["N", "Uma janela temporal de cinco minutos para confirmar a encomenda."],
      ["N", "Cola de impresión: los usuarios envían documentos a la cola de la impresora y pueden reintentar."],
      ["N", "Marketplace que conecta productores locales con consumidores."], ["N", "Boletín: el editor publica el mensaje semanal para todos los suscriptores."],
      ["D", "Create an endpoint that writes a user to Postgres and publishes a UserCreated event to Kafka for other services."],
      ["D", "When an order is paid, send a message to the notification service so it emails the customer."],
      ["D", "A background job that calls another service to sync inventory every night."], ["D", "A worker processes jobs from Redis and updates the orders table."],
      ["D", "Use Google Pub/Sub to notify the search indexer when a product changes."], ["D", "Services communicate over NATS; the pricing service subscribes to product updates."],
      ["D", "Orchestrate the checkout with Temporal workflows across payment, stock and shipping."], ["D", "Stream changes from Postgres to the data warehouse with a CDC pipeline."],
      ["D", "Stripe webhook handler: mark the invoice paid when Stripe calls us; handle duplicate deliveries."],
      ["D", "Sidekiq jobs send the welcome email and sync the user to the CRM after sign-up."],
      ["D", "Celery tasks resize images and update the product record; failed tasks are retried."],
      ["D", "Two warehouses update the same stock count; make sure concurrent updates never oversell."],
      ["D", "Apache Pulsar topics carry telemetry from devices to the processing service."], ["D", "Azure Event Hubs ingests clickstream events for the recommendation service."],
      ["D", "Implement the outbox pattern for order events."],
      ["D", "Criar um endpoint que grava o utilizador no Postgres e publica um evento UserCreated no Kafka para outros serviços."],
      ["D", "Enviar uma mensagem para o serviço de notificações quando a encomenda é paga."],
      ["D", "Um worker em background processa jobs do Redis e atualiza a tabela de encomendas."],
      ["D", "Dois armazéns atualizam o mesmo stock em simultâneo; nenhuma atualização pode ser perdida."], ["D", "Publicar eventos no Kafka."],
      ["D", "Crear un endpoint que guarda el usuario en Postgres y publica un evento UserCreated en Kafka para otros servicios."],
      ["D", "Enviar un mensaje al servicio de notificaciones cuando se paga el pedido."],
      ["D", "Un worker en segundo plano procesa trabajos de Redis y actualiza la tabla de pedidos."],
    ];
    let cTp = 0, cFp = 0, cFn = 0;
    const cWrong = [];
    for (const [tag, t] of corpus) {
      const on = cls(t).tracks.includes("dist");
      if (tag === "D" && on) cTp++;
      else if (tag === "D") { cFn++; cWrong.push("FN " + t); } else if (on) { cFp++; cWrong.push("FP " + t); }
    }
    const precision = cTp / (cTp + cFp || 1), recall = cTp / (cTp + cFn || 1);
    const pq = cls("Print queue: users send documents to the office printer queue and can retry failed prints.");
    const dd = cls("Deduplicate contacts: dedupe them nightly"), fmk = cls("Local producers sell to consumers"), rj = cls("Show the network jitter and retry the call");
    ok(precision >= 0.9 && recall >= 0.85 && corpus.slice(0, 6).every(([, t]) => !cls(t).tracks.includes("dist")) &&
      !pq.tracks.includes("dist") && pq.possible.some((p) => p.track === "dist" && js(p.generic) === js(["queue", "retry"])) && pq.notes.some((n) => /only app-level words \('queue', 'retry'\)/.test(n)) &&
      [dd, fmk, rj].every((r) => r.signals.dist.length === 1 && !r.tracks.includes("dist")) && S.signalConcept("dist", "jitter") === "retry" && S.signalConcept("saas", "worker") === null &&
      !cls("Kitchen set, 2pcs of lids").signals.dist.length && cls("Use 2PC across the two databases").tracks.includes("dist") && cls("Implement the transactional outbox").tracks.includes("dist"),
      `1.17 D review 2: +dist precision ${(precision * 100).toFixed(0)}% / recall ${(recall * 100).toFixed(0)}% on ${corpus.length} texts (≥ 90% / 85%); the six strong-word false positives are off; generic words alone stay 'possible' (named); one concept = one signal (dedupe, producers / consumers, retry / jitter); '2PC' is exact (got ` +
      js([cWrong, pq.notes, dd.signals.dist, fmk.signals.dist, rj.signals.dist]) + ")");

    // --- 1.17 D review 3: recall — named platforms (case-sensitive where they are common words), a service named by its role, a worker
    // on Redis, a hazard written negated ("never oversell", "no lost updates" count)
    const plat = ["Use Google Pub/Sub for the order topic", "Services talk over NATS", "Apache Pulsar carries telemetry", "Azure Event Hubs ingests clicks",
      "Temporal workflows orchestrate checkout", "Sidekiq sends the emails", "Celery tasks resize images", "A CDC pipeline feeds the warehouse"].map((t) => [t, cls(t)]);
    const common = ["Uma janela temporal de cinco minutos", "Celery soup recipe for the menu", "The pulsar detection telescope", "nats on the porch"].map((t) => [t, cls(t)]);
    const lostNeg = cls("The system shall have no lost updates"), overwrite = cls("Use optimistic locking so concurrent updates to the cart never overwrite each other");
    ok(plat.every(([, r]) => r.tracks.includes("dist") && r.confidence.dist !== "none") && common.every(([, r]) => !r.signals.dist.length) &&
      lostNeg.tracks.includes("dist") && !lostNeg.negated.dist.length && !overwrite.notes.some((n) => /appeared negated/.test(n)) &&
      cls("The order service calls the payment service over gRPC").tracks.includes("dist") && cls("Keep the search index in sync with the products table").tracks.includes("dist") &&
      !cls("Users can send a message to customer support").tracks.includes("dist") && cls("No distributed transactions: a simple CRUD form").negated.dist.includes("distributed transaction"),
      "1.17 D review 3: Google Pub/Sub, NATS, Pulsar, Event Hubs, Temporal, Sidekiq, Celery and a CDC pipeline turn +dist on (the PT adjective 'temporal', celery soup, a pulsar, lower-case 'nats' do not); a hazard written negated counts (no 'appeared negated' note); a service named by its role, gRPC, a search index kept in sync count (got " +
      js([plat.filter(([, r]) => !r.tracks.includes("dist")).map(([t]) => t), common.filter(([, r]) => r.signals.dist.length).map(([t, r]) => t + ":" + r.signals.dist), lostNeg.negated.dist]) + ")");

    // --- 1.17 D review 4: "message queue" (EN / PT / ES) serves +dist (strong) AND +saas (weak) — the 1.16 +saas hint survives
    const mqEn = cls("Use a message queue and a background worker to send emails.");
    const mqPt = cls("Usar uma fila de mensagens e um worker em background para enviar emails.");
    const mqEs = cls("Usar una cola de mensajes y un worker en segundo plano para enviar correos.");
    ok([mqEn, mqPt, mqEs].every((r) => r.label === "core +saas +dist") && mqEn.signals.saas.includes("message queue") && mqPt.signals.saas.includes("fila de mensagens") &&
      mqEs.signals.saas.includes("cola de mensajes") && !mqEn.signals.saas.includes("queue") && cls("A distributed cache in front of the catalog").signals.saas.includes("distributed cache"),
      "1.17 D review 4: 'message queue' / 'fila de mensagens' / 'cola de mensajes' count for +dist and +saas (1.16 read the message-queue-and-worker example as +saas) — core +saas +dist in EN / PT / ES (got " +
      js([mqEn.label, mqPt.label, mqEs.label, mqPt.signals.saas]) + ")");

    // --- 1.17 D review 5: a short PT / ES line opening with an infinitive is read in its language — "no Kafka" is PT em + o, never a negation
    const g1 = cls("Publicar eventos no Kafka."), g2 = cls("Gravar o pedido no Postgres e publicar o evento no Kafka."), g3 = cls("Publicar eventos en Kafka.");
    const enNeg = ["no Kafka, just Postgres", "Validate the order; no Kafka.", "Plain CRUD endpoint for users, no Kafka and no events"].map((t) => cls(t));
    ok(g1.lang === "pt" && g2.lang === "pt" && g3.lang === "es" && [g1, g2, g3].every((r) => r.tracks.includes("dist") && r.signals.dist.includes("kafka") && !r.negated.dist.length) &&
      enNeg.every((r) => r.lang === "en" && r.negated.dist.includes("kafka") && !r.tracks.includes("dist")) && cls("Corrigir o cálculo do IVA no checkout").tracks.includes("tdd"),
      "1.17 D review 5: 'Publicar eventos no Kafka.' / 'Gravar o pedido … no Kafka.' read as PT (a clause-start infinitive), ES 'en Kafka' as ES — Kafka not negated; English 'no Kafka' stays a negation (got " +
      js([[g1.lang, g1.negated.dist], [g2.lang, g2.negated.dist], [g3.lang], enNeg.map((r) => r.lang + ":" + r.negated.dist)]) + ")");

    // --- 1.17 D review 6: Failure Modes has strict names — a marker-less hand-written design with the five headings passes (EN / PT / ES);
    // the singular 'Failure mode' alone stays loose
    const sx = d("sections");
    const sxF = S.createFeature(sx, "Strict", ["dist"], "", undefined, "en");
    const sxCore = rd(sxF.dir, "design.md").split("\n## [DIST]")[0];
    const sxCheck = (heads) => {
      fs.writeFileSync(path.join(sxF.dir, "design.md"), sxCore + heads.map((h) => "\n## " + h + "\n- a real decision about this.\n").join(""));
      return chk(S.specDoctor(sx, sxF.slug), "dist-sections");
    };
    const sxEn = sxCheck(["Consistency Model", "Cross-system Writes", "Delivery & Idempotency", "Concurrency Control", "Failure Modes"]);
    const sxPt = sxCheck(["Modelo de Consistência", "Escritas entre Sistemas", "Entrega e Idempotência", "Controle de Concorrência", "Modos de Falha"]);
    const sxEs = sxCheck(["Modelo de Consistencia", "Escrituras entre Sistemas", "Entrega y Idempotencia", "Control de Concurrencia", "Modos de Fallo"]);
    const sxSing = sxCheck(["Consistency Model", "Cross-system Writes", "Delivery & Idempotency", "Concurrency Control", "Failure mode"]);
    ok([sxEn, sxPt, sxEs].every((c) => c.status === "pass") && sxSing.status === "fail" && /Failure Modes:missing/.test(sxSing.detail),
      "1.17 D review 6: 'Failure Modes' / 'Modos de Falha' / 'Modos de Fallo' are strict synonyms — a marker-less hand-written design with all five headings passes dist-sections; a bare 'Failure mode' is loose (got " +
      js([sxEn.detail, sxPt.detail, sxEs.detail, sxSing.detail]) + ")");

    // --- 1.17 D review 7: spec_clarify reads "arrives twice" / "está caído" / "fora do ar" / "duas vezes" as written delivery / failure criteria
    const clq = (reqs) => { fs.writeFileSync(path.join(combo.dir, "requirements.md"), "# F\n\n## Acceptance Criteria\n" + reqs); return S.clarify(cb, combo.slug).questions; };
    const clEn = clq("1. **US-1.AC-1** — WHEN a message arrives twice THE SYSTEM SHALL apply it once\n2. **US-1.AC-2** — IF the broker goes down THEN THE SYSTEM SHALL keep the events\n");
    const clEs = clq("1. **US-1.AC-1** — CUANDO un mensaje llega dos veces EL SISTEMA DEBE aplicarlo una vez\n2. **US-1.AC-2** — SI el broker está caído ENTONCES EL SISTEMA DEBE guardar los eventos\n");
    const clBr = clq("1. **US-1.AC-1** — QUANDO uma mensagem chega duas vezes O SISTEMA DEVE aplicá-la uma vez\n2. **US-1.AC-2** — SE o broker estiver fora do ar ENTÃO O SISTEMA DEVE guardar os eventos\n");
    ok([clEn, clEs, clBr].every((q) => !q.includes(Q.distDelivery) && !q.includes(Q.distFailure)),
      "1.17 D review 7: spec_clarify stops asking for the delivery guarantee / dependency failure once the criteria say 'arrives twice' / 'goes down', 'dos veces' / 'está caído', 'duas vezes' / 'fora do ar' (got " +
      js([clEn, clEs, clBr].map((q) => q.filter((x) => x === Q.distDelivery || x === Q.distFailure))) + ")");

    // --- 1.17 D review 8: the glossary stub keeps its space ("produto: uma", "producto: una") and still reads as a template
    const glPt = I.steeringStub("glossary.md", "pt"), glEs = I.steeringStub("glossary.md", "es");
    ok(/linguagem ubíqua do produto: uma entrada/.test(glPt) && /lenguaje ubicuo del producto: una entrada/.test(glEs) && !/produto:uma|producto:una/.test(glPt + glEs) &&
      S.artifactState({ text: glPt }) === "placeholder" && S.artifactState({ text: glEs }) === "placeholder",
      "1.17 D review 8: the PT / ES glossary stubs read 'produto: uma' / 'producto: una' again (a stray edit), and still read 'placeholder' (got " + js([glPt.slice(0, 80), glEs.slice(0, 80)]) + ")");

    // --- 1.17 D review 9: AC-16's slot reads well once filled ("a publicação [do evento]", "la publicación [del evento]"); no European idiom in pt-BR
    const r9 = (lang) => I.requirements({ name: "X", tracks: ["core", "dist"], label: "core +dist", slug: "x", summary: "" }, lang);
    const br9 = [r9("pt-BR"), I.design({ name: "X", tracks: ["core", "dist"], label: "core +dist", slug: "x", summary: "" }, "pt-BR"), I.testPlan("X", "pt-BR", ["core", "tdd", "dist"])].join("\n");
    ok(/SE a publicação \[do evento\] falhar/.test(r9("pt")) && /SI la publicación \[del evento\] falla/.test(r9("es")) && !/de \[o evento\]|de \[el evento\]/.test(r9("pt") + r9("es")) &&
      !/na mesma"|entregue na mesma|sem o perder|falhar depressa/.test(br9) && /sem que se perca/.test(br9) && /o evento é entregue mesmo assim/.test(br9) && /falhar rapidamente/.test(br9),
      "1.17 D review 9: the PT / ES AC-16 slot is '[do evento]' / '[del evento]'; the pt-BR twins say 'sem que se perca', 'mesmo assim', 'falhar rapidamente' (no European idiom) (got " +
      js([(r9("pt").match(/SE a publicação[^,]*/) || [])[0], (br9.match(/(?:sem o perder|na mesma|depressa)/) || [])[0]]) + ")");

    // --- 1.17 D review 10: the classifier stays linear on repeated keywords (100 KB of "queue …" took 6.9 s — each hit compared with every
    // hit); a track pack's keyword is a literal word (VERB_STEMS / irregular forms are the built-in signals' only: a pack keyword "public")
    const big = "queue ".repeat(Math.ceil(102400 / 6)); // (6.9 s before this review, 1.8 s in 1.16)
    const t0 = Date.now();
    const bigR = S.classify(big);
    const bigMs = Date.now() - t0;
    const vp = d("pack-public");
    S.initProject(vp, ["core"], "en");
    fs.mkdirSync(path.join(vp, ".specs", "tracks", "opendata"), { recursive: true });
    fs.writeFileSync(path.join(vp, ".specs", "tracks", "opendata", "track.json"), JSON.stringify({ name: "opendata", marker: "OPEN", title: { en: "Open Data" }, signals: { strong: ["public"] }, sections: [{ name: "Licensing" }] }));
    const vr = S.classify("Expose the public dataset for researchers", { projectDir: vp });
    ok(bigMs < 4000 && !bigR.tracks.includes("dist") && vr.tracks.includes("opendata") && (vr.signals.opendata || []).includes("public") && !cls("A public API for partners").signals.dist.length,
      "1.17 D review 10: 100 KB of repeated +dist / +saas keywords classify in " + bigMs + " ms (< 4 s; the shadowing sweep is linear); a track pack keyword 'public' matches the English word (no verb-stem ending required) while the built-in 'public …' gap still needs one (got " +
      js([bigMs, vr.tracks, vr.signals.opendata]) + ")");

    // --- 1.17 D review (references): the patterns guide's corrections — write skew under Postgres repeatable read / Oracle serializable, an
    // order-safe "set", a race-safe upsert, retriable 408 / 429, the record key vs the message-ID header, 4³ = 64 calls
    const ref = fs.readFileSync(path.join(__dirname, "..", "skills", "dev-spec-driven", "references", "distributed-data-patterns.md"), "utf8");
    const stubs = ["en", "pt", "es", "pt-BR"].map((l) => I.steeringStub("distributed.md", l)).join("\n");
    ok(/write skew[^\n]*commits silently/i.test(ref) && /Oracle's SERIALIZABLE is snapshot isolation/.test(ref) && /version < :v/.test(ref) && /`MERGE` is \*\*not\*\*/.test(ref) &&
      /\*\*408\*\*[^\n]*\*\*429\*\*/.test(ref) && /4³ = 64 calls/.test(ref) && !/27 calls/.test(ref) && !/key header/.test(ref) && /record header `event-id`/.test(ref) &&
      (stubs.match(/408/g) || []).length === 4 && (stubs.match(/429/g) || []).length === 4,
      "1.17 D review (references): distributed-data-patterns.md fixes write skew (Postgres RR, Oracle SERIALIZABLE), order-safe set semantics, MERGE, retriable 408 / 429, key vs header, 4³ = 64; the distributed.md stubs (EN / PT / ES / pt-BR) name 408 / 429 as retriable");

    // --- 1.17 verify N1: the clause-start infinitive — a verb Spanish has too (alterar, excluir, mudar, adicionar…) is no PT
    // evidence over ES, "no" + an infinitive is Spanish, a UI label list ("Guardar, Enviar") is no clause, and an English text's
    // infinitives don't count — "no" negates again where 1.16 read it so; D review 5's PT lines stay PT
    const vEs = ["Alterar el formulario de registro; no usar LLM.", "Excluir usuarios inactivos. No usar LLM.", "Mudar la base de datos a otro servidor; no usar LLM.",
      "Adicionar productos al carrito, no usar LLM.", "Excluir los pedidos cancelados del informe; no usar Kafka."].map((t) => [t, cls(t)]);
    const vEn = ["Spanish UI labels: Guardar, Enviar, Cancelar; no LLM.", "Translate buttons. Enviar. Pagar. No LLM translation."].map((t) => [t, cls(t)]);
    const vEsProj = S.classify("Alterar el formulario de registro; no usar LLM.", { fallbackLang: "es" });
    const vTie = [S.classify("Excluir contas inativas").lang, S.classify("Excluir contas inativas", { fallbackLang: "es" }).lang, S.classify("Publicar eventos no Kafka.", { fallbackLang: "pt" }).lang];
    ok(vEs.every(([, r]) => r.lang === "es" && r.tracks.join(",") === "core") && vEn.every(([, r]) => r.lang === "en" && r.tracks.join(",") === "core") &&
      vEsProj.lang === "es" && vEsProj.tracks.join(",") === "core" && /siempre activo/.test(vEsProj.reasoning) && js(vTie) === js(["pt", "es", "pt"]) &&
      g1.lang === "pt" && g1.tracks.includes("dist") && g2.lang === "pt" && g2.tracks.includes("dist") && enNeg.every((r) => r.lang === "en" && !r.tracks.includes("dist")) &&
      cls("Corrigir o cálculo do IVA no checkout").lang === "pt",
      "1.17 verify N1: 'Alterar el formulario…; no usar LLM.', 'Excluir usuarios…', 'Mudar la base…', 'Adicionar productos…', 'Excluir los pedidos…; no usar Kafka.' read ES, core (LLM / Kafka negated, also in an ES project — the reasoning in Spanish); English UI-label texts stay EN, core; a PT / ES tie goes to the project's language; 'Publicar eventos no Kafka.' / 'Gravar o pedido…' stay PT +dist (got " +
      js([vEs.map(([, r]) => r.lang + ":" + r.tracks), vEn.map(([, r]) => r.lang + ":" + r.tracks), vEsProj.lang, vTie, g1.lang, g2.lang]) + ")");

    // --- 1.17 verify N1: differential against 1.16 — the language-sensitive texts of the classifier corpus keep 1.16's track decision
    // (+dist aside); the only change is the documented one, "Corrigir o cálculo do IVA no checkout" → +tdd (1.16 read 'no' as a negator)
    const v116 = [
      ["Página de eventos: organizadores publicam um evento e participantes confirmam presença.", "core"], ["Publicar um artigo no blog e agendar a publicação.", "core"],
      ["Fila de atendimento: tickets de suporte numa fila ordenada por prioridade.", "core"], ["Repetir o upload quando a rede cai, com nova tentativa automática.", "core"],
      ["Bloquear a conta após cinco tentativas de login falhadas.", "core,tdd"], ["Migração do Postgres: adicionar uma coluna e preencher os dados.", "core,tdd"],
      ["Transmissão de vídeo ao vivo com legendas.", "core"], ["Marketplace que liga produtores locais a consumidores, com catálogo e checkout.", "core,tdd"],
      ["Fila de impressão: os utilizadores enviam documentos para a fila da impressora e podem fazer nova tentativa.", "core"], ["Cadastro de produtos com paginação e pesquisa.", "core"],
      ["Página para o consumidor ver as suas encomendas e o histórico de compras.", "core"],
      ["Criar um endpoint que grava o utilizador no Postgres e publica um evento UserCreated no Kafka para outros serviços.", "core"],
      ["Enviar uma mensagem para o serviço de notificações quando a encomenda é paga.", "core"], ["Consistência eventual entre os serviços de encomendas e faturação.", "core,tdd"],
      ["Um worker em background processa jobs do Redis e atualiza a tabela de encomendas.", "core"], ["Dois armazéns atualizam o mesmo stock em simultâneo; nenhuma atualização pode ser perdida.", "core"],
      ["Página de eventos: los organizadores publican un evento y los asistentes se inscriben.", "core"], ["Cola de impresión: los usuarios envían documentos a la cola de la impresora y pueden reintentar.", "core"],
      ["Marketplace que conecta productores locales con consumidores.", "core"], ["Bloquear la cuenta tras cinco intentos fallidos de inicio de sesión.", "core,tdd"],
      ["Migración de la base de datos Postgres para añadir una columna.", "core,tdd"], ["Reintentar la subida de archivos cuando falla la red.", "core"],
      ["Los suscriptores del boletín reciben un correo cada lunes.", "core"], ["Transmisión de video en streaming con subtítulos.", "core"],
      ["Boletín: el editor publica el mensaje semanal para todos los suscriptores.", "core"],
      ["Crear un endpoint que guarda el usuario en Postgres y publica un evento UserCreated en Kafka para otros servicios.", "core"],
      ["Consistencia eventual entre los servicios de pedidos y facturación.", "core,tdd"], ["Un worker en segundo plano procesa trabajos de Redis y actualiza la tabla de pedidos.", "core"],
      ["Enviar un mensaje al servicio de notificaciones cuando se paga el pedido.", "core"], ["Replicación de la base de datos para alta disponibilidad con réplicas de lectura.", "core,saas"],
      ["No distributed transactions and no LLM: a simple CRUD form.", "core"], ["Validate the order; no Kafka.", "core"], ["Plain CRUD endpoint for users, no Kafka and no events", "core"],
      ["Corrigir o desvio", "core"], ["Pagar o carrinho.", "core"], ["Pagar el carrito.", "core"], ["Apagar o registo antigo no servidor.", "core"],
      ["Cambiar el idioma de la interfaz sin usar IA.", "core"], ["Agregar un filtro por fecha al informe.", "core"], ["Testar o fluxo de checkout sem IA.", "core,tdd"],
      ["Criar um relatório de vendas por região.", "core"], ["Gravar o rascunho no navegador.", "core"], ["Substituir o motor de busca por um mais rápido.", "core"],
      ["Exibir o saldo do cliente no ecrã inicial.", "core"], ["Gerar faturas em PDF e enviar por email.", "core,tdd"], ["Crear un informe de ventas por región.", "core"],
      ["Reintentar la subida de archivos.", "core"], ["Guardar el borrador en el navegador; no usar IA.", "core"], ["Enviar notificaciones push, no usar Kafka.", "core"],
      ["Use no LLM for this; just rules.", "core"], ["No LLM: plain validation rules for the signup form.", "core"],
    ];
    const vDiff = v116.filter(([t, want]) => cls(t).tracks.filter((x) => x !== "dist").join(",") !== want).map(([t]) => t + " → " + cls(t).tracks);
    ok(!vDiff.length && cls("Corrigir o cálculo do IVA no checkout").tracks.join(",") === "core,tdd",
      "1.17 verify N1: " + v116.length + " language-sensitive texts (PT / ES / infinitive-led / 'no …') keep their 1.16 track decision (+dist aside); only 'Corrigir o cálculo do IVA no checkout' changes, to core +tdd (got " + js(vDiff) + ")");

    // --- 1.17 verify N2: the clause-start pattern is linear — a run of blank lines (CRLF or LF) no longer costs seconds (40,000 CRLF
    // blank lines: 7.8 s); the infinitive after them still reads
    const vTimed = (t) => { const t0v = Date.now(); const r = S.classify(t); return [Date.now() - t0v, r]; };
    const [vBaseMs] = vTimed("Nota. " + "palavra ".repeat(10000) + "Publicar eventos no Kafka.");
    const [vCrlfMs, vCrlf] = vTimed("Nota." + "\r\n".repeat(40000) + "Publicar eventos no Kafka.");
    const [vLfMs, vLf] = vTimed("Nota." + "\n".repeat(80000) + "Publicar eventos no Kafka.");
    ok(vCrlfMs <= 5 * vBaseMs + 500 && vLfMs <= 5 * vBaseMs + 500 && vCrlf.lang === "pt" && vLf.lang === "pt" && vCrlf.tracks.includes("dist"),
      "1.17 verify N2: 40,000 CRLF / 80,000 LF blank lines classify within 5 × an 80 KB prose text + 0.5 s (the spaces after a clause start never cross a line break), and the infinitive after them still reads PT (got " +
      js({ base: vBaseMs, crlf: vCrlfMs, lf: vLfMs, lang: [vCrlf.lang, vLf.lang] }) + ")");
  }

  // 1.19 package (T) — the +api, +ui and +obs tracks.

  { // 1.19 T — the built-in +api / +ui / +obs tracks end to end: registry, classifier (EN / PT / ES), scaffolds (EN / PT / ES / pt-BR), gates,
    // views, add_track / remove, legacy packs of a now-reserved name. Each new track is one entry of T19: the checks below run for each.
    const I = require("./lib/i18n.js");
    const js = (v) => JSON.stringify(v);
    const rd = (...p) => fs.readFileSync(path.join(...p), "utf8");
    const tRoot = path.join(tmp, "p19t");
    const d = (n) => path.join(tRoot, n);
    const chk = (doc, id) => doc.checks.find((c) => c.id === id) || {};
    const dropTodo = (file) => fs.writeFileSync(file, rd(file).split(/\r?\n/).filter((l) => !/^\s*>\s*\*\*TODO\*\*/.test(l)).join("\n"));
    const cls = (t, lang) => S.classify(t, lang ? { lang } : {});
    const unfilledWord = { en: /unfilled/, pt: /por preencher/, es: /sin rellenar/, "pt-BR": /sem preencher/ };
    const T19 = [
      { tr: "api", marker: "[API]", token: "API", ids: ["20", "21", "22", "23"], steering: "api.md", typo: "apii", alias: "openapi", legacy: "rest",
        sections: ["API Contract", "Versioning & Compatibility", "Error Model", "Pagination, Idempotency & Concurrency", "Rate Limits & Quotas"],
        title: { en: "Error Model", pt: "Modelo de Erros", es: "Modelo de Errores", "pt-BR": "Modelo de Erros" }, taskHead: "Story US-1 — API Contract",
        loose: ["## [API] API Contract", "## API Contract", "API Contract:missing"], prose: "### Errors [api]\n- the error rate, in [api] calls\n", infer: "## [API] Error Model\n- problem+json\n",
        briefTask: /^\[US1\] Error model/, briefSection: "[API] Error Model", matrixAc: "US-1.AC-21", matrixSection: "[API] Pagination, Idempotency & Concurrency",
        finish: /^\+api: contract tests/, statusKey: "apiSections", plan: [/\| T-(\d+) \| contract \| example \| contract test: a request missing a required field gets 400 problem\+json naming it \| US-1\.AC-20 \|/,
          /\| T-\d+ \| integration \| property \| a create replayed with the same Idempotency-Key has one effect and returns the first response \| US-1\.AC-21 \|/],
        importAc: "WHEN a partner calls the public REST API v2 THEN the system SHALL return the order as the OpenAPI spec defines it",
        steeringHead: { en: /^# API Standards/, pt: /^# Padrões de API/, es: /^# Estándares de API/, "pt-BR": /^# Padrões de API/ } },
      { tr: "ui", marker: "[UI]", token: "UI", ids: ["24", "25", "26", "27"], steering: "ui.md", typo: "uii", alias: "frontend", legacy: "wcag",
        sections: ["Design System Usage", "UI States", "Accessibility", "Responsiveness & i18n", "UI Performance Budget"],
        title: { en: "UI States", pt: "Estados da Interface", es: "Estados de la Interfaz", "pt-BR": "Estados da Interface" }, taskHead: "Story US-1 — User Interface",
        loose: ["## [UI] Accessibility", "## Accessibility", "Accessibility:missing"], prose: "### Colours [ui]\n- the spacing, in [ui] units\n", infer: "## [UI] UI States\n- loading, empty, error\n",
        briefTask: /^\[US1\] UI states/, briefSection: "[UI] Accessibility", matrixAc: "US-1.AC-25", matrixSection: "[UI] UI States",
        finish: /^\+ui: the automated accessibility check/, statusKey: "uiSections",
        plan: [/\| T-\d+ \| e2e \| example \| keyboard-only walk-through \+ an automated accessibility check \(axe\): every action reachable, focus visible, no violation \| US-1\.AC-24 \|/,
          /\| T-\d+ \| component \| property \| a form with invalid fields: every value kept, each error named in text, focus on the summary \| US-1\.AC-25 \|/],
        importAc: "WHEN the user opens the settings page THEN the system SHALL show it with the design system components and meet WCAG 2.2 AA",
        steeringHead: { en: /^# UI Standards/, pt: /^# Padrões de Interface/, es: /^# Estándares de Interfaz/, "pt-BR": /^# Padrões de Interface/ } },
      { tr: "obs", marker: "[OBS]", token: "OBS", ids: ["28", "29", "30", "31"], steering: "observability.md", typo: "obss", alias: "monitoring", legacy: "sre",
        sections: ["SLIs & SLOs", "Telemetry", "Alerting & Runbooks", "Rollout & Rollback", "Health & Capacity"],
        title: { en: "Alerting & Runbooks", pt: "Alertas e Runbooks", es: "Alertas y Runbooks", "pt-BR": "Alertas e Runbooks" }, taskHead: "Story US-1 — Operability",
        loose: ["## [OBS] Rollout & Rollback", "## Rollback", "Rollout & Rollback:missing"], prose: "### Retries [obs]\n- the delay, in [obs] units\n", infer: "## [OBS] Telemetry\n- metrics\n",
        briefTask: /^\[US1\] Telemetry/, briefSection: "[OBS] SLIs & SLOs", matrixAc: "US-1.AC-30", matrixSection: "[OBS] Rollout & Rollback",
        finish: /^\+obs: an alert fired/, statusKey: "obsSections",
        plan: [/\| T-\d+ \| integration \| property \| every request emits the metric, a structured log line and a trace with one correlation ID; no personal data in the log \| US-1\.AC-28 \|/,
          /\| T-\d+ \| integration \| example \| rollback drill: a canary whose error rate crosses the threshold stops the rollout and rolls back \| US-1\.AC-30 \|/],
        importAc: "WHEN the checkout SLO burns its error budget THEN the system SHALL page the on-call engineer with a link to the runbook",
        steeringHead: { en: /## SLOs & Error Budgets/, pt: /## SLOs e Orçamentos de Erro/, es: /## SLOs y Presupuestos de Error/, "pt-BR": /## SLOs e Orçamentos de Erro/ } },
    ];
    const SLOT = /\[(?!shared\]|US\d+\]|[ xX]\]|P\]|DIST\]|API\]|UI\]|OBS\]|NEEDS)[^\]\n]*\]/g;

    for (const X of T19) {
      const n0 = X.tr;
      // --- registry: a valid, composable marker track after the one before it; a typo and an alias get a did-you-mean
      const typo = S.createFeature(d("typo-" + n0), "Typo", X.typo), alias = S.createFeature(d("typo-" + n0), "Typo", [X.alias]);
      const vi = S.VALID_TRACKS.indexOf(n0);
      ok(vi > S.VALID_TRACKS.indexOf("dist") && S.OPTIONAL_TRACKS.includes(n0) && S.TRACK_MARKER[n0] === X.marker && js(S.trackSections(n0).map((x) => x.name)) === js(X.sections) &&
        S.trackLabel(S.normalizeTracks(n0 + " dist tdd")) === "core +tdd +dist +" + n0 && !typo.ok && new RegExp("did you mean '" + n0 + "'").test(typo.error) &&
        !alias.ok && new RegExp("'" + X.alias + "' \\(did you mean '" + n0 + "'\\?\\)").test(alias.error),
        `1.19 T1: +${n0} is a valid, composable marker track (${X.marker}, ${X.sections.length} sections, labelled after +dist); '${X.typo}' / '${X.alias}' get a did-you-mean (got ` + js([S.OPTIONAL_TRACKS, typo.error, alias.error]) + ")");

      // --- scaffold per language: the sections with the TODO sentinel, the criteria, every fresh artifact reads 'placeholder'; <track>-sections
      // fails and the design approval is refused while TODO; filled, it passes
      for (const lang of ["en", "pt", "es", "pt-BR"]) {
        const p = d(n0 + "-scaffold-" + lang);
        const f = S.createFeature(p, n0 + " " + lang, [n0], "", undefined, lang);
        const design = rd(f.dir, "design.md"), reqs = rd(f.dir, "requirements.md"), tasks = rd(f.dir, "tasks.md");
        const heads = design.split("\n").filter((l) => l.startsWith("## " + X.marker + " "));
        const e = S.earsValidate(reqs, lang);
        const own = e.issues.filter((i) => i.code !== "placeholder" && X.ids.some((id) => (i.text || "").includes("US-1.AC-" + id)));
        const states = fs.readdirSync(f.dir).filter((nm) => nm.endsWith(".md") && nm !== "checklist.md").map((nm) => [nm, S.artifactState(path.join(f.dir, nm))]);
        const before = S.specDoctor(p, f.slug);
        S.approvePhase(p, f.slug, "classification", "t", { force: true });
        S.approvePhase(p, f.slug, "requirements", "t", { force: true });
        const refused = S.approvePhase(p, f.slug, "design", "t");
        dropTodo(path.join(f.dir, "design.md"));
        const after = S.specDoctor(p, f.slug);
        const retry = S.approvePhase(p, f.slug, "design", "t");
        const id = n0 + "-sections";
        ok(f.ok && f.label === "core +" + n0 && heads.length === X.sections.length && design.includes(X.title[lang]) && (design.match(/^> \*\*TODO\*\*/gm) || []).length === X.sections.length &&
          reqs.includes("#### " + X.marker) && X.ids.every((n) => reqs.includes("US-1.AC-" + n) && tasks.includes("US-1.AC-" + n)) &&
          !own.length && e.issues.every((i) => i.severity !== "error") && states.length >= 4 && states.every(([, st]) => st === "placeholder") &&
          chk(before, id).status === "fail" && unfilledWord[lang].test(chk(before, id).detail) && !chk(before, "dist-sections").status &&
          !refused.ok && refused.failing.includes(id) && chk(after, id).status === "pass" && new RegExp(String(X.sections.length)).test(chk(after, id).detail) && !(retry.failing || []).includes(id),
          `1.19 T2: ${lang} +${n0} scaffold — ${X.sections.length} ${X.marker} sections with the TODO sentinel, criteria US-1.AC-${X.ids[0]}..${X.ids[X.ids.length - 1]} (no EARS issue but slots), every fresh artifact reads 'placeholder', ${id} fails and the design approval is refused while TODO, passes once filled (got ` +
          js([heads, own.map((i) => i.code), states.filter(([, st]) => st !== "placeholder"), chk(before, id).detail, chk(after, id).detail]) + ")");
      }

      // --- a filled feature is ready: doctor has no fail and every gate approves without force (EN / PT / ES round trip)
      for (const lang of ["en", "pt", "es"]) {
        const p = d(n0 + "-filled-" + lang);
        S.initProject(p, ["core", n0], lang);
        const f = S.createFeature(p, "Filled " + lang, [n0], "", undefined, lang);
        for (const file of ["classification.md", "requirements.md", "design.md", "tasks.md"]) {
          const fp = path.join(f.dir, file);
          let t = rd(fp);
          for (let i = 0; i < 3; i++) t = t.replace(SLOT, "the order record");
          fs.writeFileSync(fp, t.split(/\r?\n/).filter((l) => !/^\s*>\s*\*\*TODO\*\*/.test(l)).join("\n"));
        }
        const doc = S.specDoctor(p, f.slug);
        const gates = ["classification", "requirements", "design", "tasks"].map((ph) => [ph, S.approvePhase(p, f.slug, ph, "t")]);
        ok(doc.readyToAdvance && !doc.checks.some((c) => c.status === "fail") && chk(doc, n0 + "-sections").status === "pass" && chk(doc, "ears").status === "pass" &&
          chk(doc, "traceability").status === "pass" && gates.every(([ph, r]) => r.ok && r.approved === ph && !r.forced),
          `1.19 T3: ${lang} — a filled +${n0} feature is ready (doctor has no fail, EARS + traceability pass) and classification → requirements → design → tasks approve without force (got ` +
          js([doc.checks.filter((c) => c.status === "fail").map((c) => c.id + ": " + c.detail), gates.filter(([, r]) => !r.ok).map(([ph, r]) => ph + ":" + (r.failing || []).join(","))]) + ")");
      }

      // --- add_track / remove / re-add (additive, non-destructive)
      const at = d(n0 + "-add");
      S.initProject(at, ["core"], "en");
      const plain = S.createFeature(at, "Plain", ["core"], "", undefined, "en");
      const tBefore = S.statusFeature(at, plain.slug).tasks.total;
      const add = S.addTrack(at, plain.slug, "+" + n0);
      const pTasks = rd(plain.dir, "tasks.md");
      const docAdd = S.specDoctor(at, plain.slug);
      const tAdded = S.statusFeature(at, plain.slug).tasks.total;
      const rm = S.removeTrack(at, plain.slug, n0);
      const docRm = S.specDoctor(at, plain.slug), stRm = S.statusFeature(at, plain.slug);
      const reAdd = S.addTrack(at, plain.slug, n0);
      const added = (add.added || []).join("|");
      ok(add.ok && add.tracks === "core +" + n0 && added.includes("steering/" + X.steering) && rd(plain.dir, "design.md").includes("## " + X.marker + " " + X.sections[0]) && pTasks.includes("## " + X.taskHead) &&
        pTasks.includes("_Requirements: [the +" + n0 + " criterion this task proves]_") && rd(plain.dir, "classification.md").includes("## Active Tracks\ncore +" + n0) && chk(docAdd, n0 + "-sections").status === "fail" &&
        tAdded === tBefore + 5 && rm.ok && rm.tracks === "core" && rm.inactive.includes("design.md (" + X.marker + " sections)") && rm.inactive.includes("tasks.md (" + X.taskHead + ")") &&
        !chk(docRm, n0 + "-sections").status && stRm[X.statusKey] === null && stRm.tasks.total === tBefore && rd(plain.dir, "design.md").includes(X.marker + " " + X.sections[0]) &&
        reAdd.ok && reAdd.tracks === "core +" + n0 && rd(plain.dir, "tasks.md").split("## " + X.taskHead).length === 2 && S.statusFeature(at, plain.slug).tasks.total === tBefore + 5,
        `1.19 T4: add_track ${n0} (sections, steering/${X.steering}, 5 template tasks with placeholder ACs, Active Tracks, ${n0}-sections fails); --remove is non-destructive (inactive, no check, ${X.statusKey} null, tasks not counted); re-adding duplicates nothing (got ` +
        js([add.added, rm.inactive, tBefore, tAdded]) + ")");

      // --- markers are case-sensitive; the loose (ordinary) names count only in the track's context; the marker is no placeholder
      const cs = d(n0 + "-case");
      const csF = S.createFeature(cs, "Case", ["core"], "", undefined, "en");
      fs.appendFileSync(path.join(csF.dir, "design.md"), "\n" + X.prose);
      const csState = path.join(csF.dir, ".state.json");
      const csSt = JSON.parse(rd(csState)); delete csSt.tracks; fs.writeFileSync(csState, JSON.stringify(csSt, null, 2));
      const csTracks = S.statusFeature(cs, csF.slug).tracks;
      fs.appendFileSync(path.join(csF.dir, "design.md"), "\n" + X.infer);
      const csInferred = S.statusFeature(cs, csF.slug).tracks;
      const lz = S.createFeature(d(n0 + "-loose"), "Loose", [n0], "", undefined, "en");
      dropTodo(path.join(lz.dir, "design.md"));
      fs.writeFileSync(path.join(lz.dir, "design.md"), rd(lz.dir, "design.md").replace(X.loose[0], X.loose[1]));
      const lzDoc = chk(S.specDoctor(d(n0 + "-loose"), lz.slug), n0 + "-sections");
      ok(csTracks === "core" && csInferred === "core +" + n0 && lzDoc.status === "fail" && lzDoc.detail.includes(X.loose[2]) &&
        S.artifactState({ text: "# Notes\n\nThe " + X.marker + " sections were reviewed on Monday by the whole team.\n" }) === "filled",
        `1.19 T5: a lower-case '${X.prose.split("\n")[0]}' is prose (no +${n0} inferred), a '${X.marker}' heading infers it; '${X.loose[1]}' (an ordinary design heading) never satisfies ${X.loose[0].slice(3)}; ${X.marker} is a stable bracket, not a slot (got ` +
        js([csTracks, csInferred, lzDoc.detail]) + ")");

      // --- a track pack named like the new track (or its alias), recorded by a feature before 1.19, is that feature's MISSING pack — never the
      // built-in track; doctor / spec_upgrade say why ("from before 1.19"); add-track <track> adopts the built-in one, --remove drops the pack
      const lp = d(n0 + "-legacy");
      S.initProject(lp, ["core"], "en");
      const legacyFeature = (name, marker) => {
        const pdir = path.join(lp, ".specs", "tracks", name);
        fs.mkdirSync(pdir, { recursive: true });
        fs.writeFileSync(path.join(pdir, "track.json"), JSON.stringify({ name, marker, title: { en: "Legacy " + name }, sections: [{ name: "Team Section", guidance: "Say how." }] }));
        const f = S.createFeature(lp, "f-" + name, ["core"], "", undefined, "en");
        const sp = path.join(f.dir, ".state.json");
        const st = JSON.parse(rd(sp));
        st.tracks = ["core", name];
        st.packMarkers = { [name]: "[" + marker + "]" };
        fs.writeFileSync(sp, JSON.stringify(st, null, 2));
        fs.appendFileSync(path.join(f.dir, "design.md"), "\n## [" + marker + "] Team Section\n- decided.\n");
        return f;
      };
      const lpMain = legacyFeature(n0, X.token), lpAlias = legacyFeature(X.legacy, X.legacy.toUpperCase());
      const lpDoc = S.specDoctor(lp, "f-" + n0), lpDocA = S.specDoctor(lp, "f-" + X.legacy);
      const lpSt = S.statusFeature(lp, "f-" + n0);
      const lpUp = S.specUpgrade(lp);
      const lpUpF = (nm) => lpUp.features.find((x) => x.name === nm) || {};
      const adopt = S.addTrack(lp, "f-" + n0, n0);
      const drop = S.addTrack(lp, "f-" + X.legacy, X.legacy, { remove: true });
      ok(lpSt.tracks === "core" && js(lpSt.missingPacks) === js([n0]) && !chk(lpDoc, n0 + "-sections").status && chk(lpDoc, "track-pack-missing").status === "warn" &&
        new RegExp("\\+" + n0 + " \\(a track pack from before 1\\.19 — '" + n0 + "' is a reserved name now, and the built-in \\+" + n0 + " track is NOT applied").test(chk(lpDoc, "track-pack-missing").detail) &&
        new RegExp("'" + X.legacy + "' is a reserved name now: rename").test(chk(lpDocA, "track-pack-missing").detail) && lpUpF("f-" + n0).attention.includes("track-pack-reserved") &&
        lpUp.lines.some((l) => /Rename its track pack\(s\) from before 1\.19 — /.test(l)) &&
        adopt.ok && js(adopt.adopted) === js([n0]) && adopt.tracks === "core +" + n0 && rd(lpMain.dir, "design.md").includes("## " + X.marker + " " + X.sections[0]) &&
        chk(S.specDoctor(lp, "f-" + n0), n0 + "-sections").status === "fail" && drop.ok && js(drop.removedTracks) === js([X.legacy]) && js(JSON.parse(rd(lpAlias.dir, ".state.json")).tracks) === js(["core"]),
        `1.19 T6: a pre-1.19 pack named '${n0}' / '${X.legacy}' is the feature's missing pack (tracks read core, the built-in +${n0} is NOT applied, doctor and spec_upgrade say 'from before 1.19'); add-track adopts the built-in track, --remove drops the alias pack (got ` +
        js([lpSt.tracks, lpSt.missingPacks, chk(lpDoc, "track-pack-missing").detail, chk(lpDocA, "track-pack-missing").detail, adopt.adopted, drop.error]) + ")");

      // --- views: the test rows, status, spec_finish checks, the brief's and the matrix's track sections, the Gherkin tag, spec_import, steering
      const vw = d(n0 + "-views");
      const initV = S.initProject(vw, ["core", n0], "en");
      const vf = S.createFeature(vw, "Views", ["tdd", n0], "", undefined, "en");
      const vPlan = rd(vf.dir, "test-plan.md");
      const vTr = S.traceCheck(vw, vf.slug);
      dropTodo(path.join(vf.dir, "design.md"));
      const vSt = S.statusFeature(vw, vf.slug), vFin = S.finishFeature(vw, vf.slug);
      const vTask = S.parseTasks(rd(vf.dir, "tasks.md")).find((x) => X.briefTask.test(x.text)) || {};
      const vBrief = S.taskBrief(vw, vf.slug, vTask.number);
      const vRow = ((S.traceMatrix(vw, vf.slug).rows) || []).find((r) => r.id === X.matrixAc) || {};
      const vGk = S.exportSpecs(vw, { name: vf.slug, format: "gherkin" });
      ok(X.plan.every((re) => re.test(vPlan)) && !vTr.uncoveredByTasks.length && !vTr.uncoveredByTests.length && !vTr.phantomAcsInTasks.length && !(vTr.testsNotMappedToTasks || []).length &&
        Array.isArray(vSt[X.statusKey]) && vSt[X.statusKey].length === X.sections.length && vSt[X.statusKey].every((s) => s.filled) && vFin.checks.some((c) => X.finish.test(c)) &&
        vBrief.ok && vBrief.designSections.includes(X.briefSection) && (vRow.design || []).includes(X.matrixSection) &&
        new RegExp("(^|\\s)@" + X.token + "(\\s|$)", "m").test(vGk.content || "") && initV.created.includes(X.steering) && I.steeringKnownFiles().includes(X.steering) &&
        ["en", "pt", "es", "pt-BR"].every((l) => X.steeringHead[l].test(I.steeringStub(X.steering, l) || "")) && (chk(S.specDoctor(vw, vf.slug), "steering").detail || "").includes(X.steering),
        `1.19 T7: +${n0} views — its test rows are planned and traced, spec_status ${X.statusKey}, spec_finish's +${n0} checks, the brief and the matrix link a ${X.marker} criterion to its sections, Gherkin @${X.token}, steering/${X.steering} in EN / PT / ES / pt-BR (got ` +
        js([vPlan.split("\n").filter((l) => X.ids.some((i) => l.includes("US-1.AC-" + i))), vSt[X.statusKey], vBrief.designSections, vRow.design, (vGk.content || "").split("\n")[0]]) + ")");
      const im = d(n0 + "-import");
      fs.mkdirSync(path.join(im, ".kiro", "specs", "orders"), { recursive: true });
      fs.writeFileSync(path.join(im, ".kiro", "specs", "orders", "requirements.md"), "### Requirement 1\n\n**User Story:** As a partner, I want the orders.\n\n#### Acceptance Criteria\n\n1. " + X.importAc + "\n");
      fs.writeFileSync(path.join(im, ".kiro", "specs", "orders", "design.md"), "# Design\n\n## Overview\nThe orders feature.\n");
      const imp = S.importSpec(im, "kiro", ".kiro/specs/orders", {});
      const impDesign = imp.ok ? rd(im, ".specs", "orders", "design.md") : "";
      ok(imp.ok && imp.tracks.includes(n0) && /The orders feature/.test(impDesign) && impDesign.includes("## " + X.marker + " " + X.sections[1]),
        `1.19 T7: spec_import auto-classifies +${n0} and appends the ${X.marker} sections to the imported design (got ` + js([imp.tracks, imp.error]) + ")");

      // --- classifier: self-match sweep (every keyword, EN / PT / ES, matches itself as a word; a strong one alone turns the track on; a generic
      // one alone never does)
      const sg = S.trackSignals(n0);
      const sweep = [];
      for (const tier of ["strong", "weak", "generic"]) for (const kw of sg[tier]) {
        const r = S.classify("We need " + kw + " here");
        if (!r.signals[n0].some((m) => m === kw || m.includes(kw)) || (tier === "strong" && !r.tracks.includes(n0)) || (tier === "generic" && r.tracks.includes(n0))) sweep.push(tier + ":" + kw);
      }
      ok(sweep.length === 0 && sg.strong.length >= 25 && sg.weak.length >= 15 && sg.generic.length >= 5,
        `1.19 T8: +${n0} self-match sweep — every keyword matches itself; a strong one alone turns +${n0} on, a generic one alone never does (misses: ` + sweep.join(", ") + ")");
    }

    // --- 1.19 T8: precision / recall on a corpus of EN / PT / ES texts (positives and hard negatives) — ≥ 90% / ≥ 85% per track
    const CORPUS = [
      // +api — positives
      ["api", "Publish an OpenAPI spec for the orders REST API and generate the client SDKs from it"], ["api", "Version the public API: ship v2 and deprecate v1 with a Sunset header"],
      ["api", "Return every error as application/problem+json with a stable error code"], ["api", "Add cursor-based pagination to the list endpoints without breaking existing clients"],
      ["api", "Expose a GraphQL schema for the product catalog"], ["api", "Define the pricing service's gRPC contract in protobuf"],
      ["api", "Accept an Idempotency-Key header on POST /payments so a retried request never charges twice"], ["api", "Return rate limit headers and Retry-After on every 429 response"],
      ["api", "Third-party developers integrate through our developer portal"], ["api", "Add ETag support and require If-Match on updates to the orders endpoint"],
      ["api", "Avoid breaking changes to the webhooks API for existing consumers"], ["api", "Contract tests validate the implementation against the Swagger document"],
      ["api", "Design a RESTful API for managing invoices"], ["api", "The mobile app's API must stay backward compatible for six months"],
      ["api", "Document every status code the refunds endpoint returns"], ["api", "Build an internal API for the billing team with stable status codes"],
      ["api", "Partners call the shipment tracking endpoint; keep its response schema stable"],
      ["api", "Publicar a especificação OpenAPI da API REST de encomendas"], ["api", "Versionar a API pública e descontinuar a v1"],
      ["api", "Devolver os erros em formato problem+json com códigos estáveis"], ["api", "Paginação por cursor nos endpoints de listagem da API"],
      ["api", "Os programadores externos integram através do portal do programador"], ["api", "Nenhuma alteração incompatível no contrato da API sem uma nova versão"],
      ["api", "Criar um esquema GraphQL para o catálogo de produtos"],
      ["api", "Versionar la API pública y retirar la v1 con una cabecera Sunset"], ["api", "Devolver los errores como problem+json con códigos estables"],
      ["api", "Añadir paginación por cursor a los endpoints de la API sin cambios incompatibles"], ["api", "Los desarrolladores externos se integran a través del portal de desarrolladores"],
      ["api", "Definir el contrato gRPC del servicio de precios en protobuf"], ["api", "Publicar la especificación de la API con OpenAPI"],
      // +api — hard negatives
      ["ui", "API key management page where admins create and revoke keys"], ["", "Call the Stripe API to charge the customer's card"],
      ["", "Fix the route guard so logged-out users are redirected to the login page"], ["", "Upgrade React to version 19 and fix the breaking changes in the router"],
      ["", "Send an HTTP request to the weather service and cache the response for ten minutes"], ["", "Bump the AWS SDK to v3"], ["", "Add pagination to the admin users table"],
      ["", "Users can request a refund from their order history"], ["", "Plan the delivery route for each driver"], ["", "Store the uploaded photos in S3"],
      ["", "Handle HTTP status 500 from the payment gateway with a retry"], ["", "Create a JSON schema for the config file"],
      ["", "Chamar a API do Stripe para cobrar o cartão"], ["", "Planear a rota de entrega de cada motorista"], ["", "Atualizar o SDK da AWS para a versão 3"],
      ["", "O utilizador pode pedir o reembolso de uma encomenda"],
      ["", "Llamar a la API de Stripe para cobrar la tarjeta"], ["", "Calcular la ruta de reparto de cada conductor"], ["", "Actualizar el SDK de AWS a la versión 3"],
      // +ui — positives
      ["ui", "Build the settings page with design-system components and WCAG 2.2 AA accessibility"], ["ui", "Make the checkout form usable with a screen reader and keyboard navigation"],
      ["ui", "Add a dark mode using the design tokens"], ["ui", "Redesign the dashboard as a responsive layout for mobile and desktop"],
      ["ui", "Create a reusable date picker in the component library, documented in Storybook"], ["ui", "Show an empty state and a skeleton screen while the orders load"],
      ["ui", "Improve the Core Web Vitals of the product page: LCP under 2.5 s"], ["ui", "Fix the color contrast and the focus indicator on the login page"],
      ["ui", "Implement the new onboarding UI from the Figma designs"], ["ui", "Add visual regression tests for the invoice screens"], ["ui", "Admin panel to manage users and roles"],
      ["ui", "Build the profile page with inline form validation"], ["ui", "Rewrite the frontend in React"], ["ui", "Support right-to-left languages in the mobile app UI"],
      ["ui", "Add alt text to every product image"], ["ui", "A modal with a dropdown to pick the delivery slot"],
      ["ui", "Criar a página de definições com componentes do design system e acessibilidade WCAG"], ["ui", "Tornar o formulário de checkout utilizável com leitor de ecrã e navegação por teclado"],
      ["ui", "Adicionar modo escuro à aplicação"], ["ui", "Mostrar um estado vazio quando a lista de encomendas não tem itens"], ["ui", "Layout responsivo para o painel de administração"],
      ["ui", "Melhorar o contraste de cores e o texto alternativo das imagens"],
      ["ui", "Crear la página de ajustes con el sistema de diseño y accesibilidad WCAG"], ["ui", "Hacer el formulario de pago usable con lector de pantalla y navegación por teclado"],
      ["ui", "Añadir modo oscuro a la aplicación"], ["ui", "Mostrar un estado vacío cuando no hay pedidos"], ["ui", "Diseño responsivo para el panel de administración"],
      // +ui — hard negatives
      ["", "Add a button to export orders as CSV"], ["", "Log in form"], ["", "Metrics dashboard for sales"], ["", "The support team screens job applicants before the interview"],
      ["", "Nightly job that recalculates the loyalty points of every customer"], ["", "Form a committee to review the refund policy"], ["", "Translate the error messages into Portuguese"],
      ["", "Add a React Native push notification handler"], ["", "Update the page count in the PDF export"], ["", "Generate the monthly PDF report for the accountants"],
      ["", "Adicionar um botão para exportar as encomendas em CSV"], ["", "Formulário de login"], ["", "Gerar o relatório mensal em PDF"],
      ["", "Añadir un botón para exportar los pedidos a CSV"], ["", "Formulario de inicio de sesión"], ["", "Generar el informe mensual en PDF"],
      // +obs — positives
      ["obs", "Define an SLO for checkout availability and alert on the error budget burn rate"], ["obs", "Instrument the payments service with OpenTelemetry distributed tracing"],
      ["obs", "Add structured logging with a correlation ID to the order service"], ["obs", "Roll out the new pricing engine behind a feature flag with a canary release and automatic rollback"],
      ["obs", "Write runbooks for the on-call rotation and wire the alerts to PagerDuty"], ["obs", "Add liveness and readiness probes to the worker deployment"],
      ["obs", "Grafana dashboard and Prometheus alerts for the queue depth"], ["obs", "Zero-downtime deployment of the billing service with a rollback plan"],
      ["obs", "Page the on-call engineer when the queue backs up"], ["obs", "Add monitoring and alerts for the nightly import job"],
      ["obs", "Progressive rollout of the new search, gated on the error rate"], ["obs", "Incident response: a postmortem template and severity levels"],
      ["obs", "Capture front-end errors in Sentry with the release version"], ["obs", "Chaos engineering game day: kill a cache node and verify the fallback"],
      ["obs", "Alert the on-call when the 5xx error rate exceeds 1%"], ["obs", "Roll it out as a canary and roll back when the error rate rises"],
      ["obs", "Definir um SLO para a disponibilidade do checkout e alertas sobre o orçamento de erro"], ["obs", "Instrumentar o serviço de pagamentos com OpenTelemetry e rastreio distribuído"],
      ["obs", "Logs estruturados com ID de correlação no serviço de encomendas"], ["obs", "Lançamento canário do novo motor de preços com plano de rollback"],
      ["obs", "Adicionar monitorização e alertas ao processo de importação noturno"], ["obs", "Observabilidade do serviço de faturação: métricas, logs e traces"],
      ["obs", "Definir un SLO para la disponibilidad del checkout y alertas sobre el presupuesto de errores"], ["obs", "Instrumentar el servicio de pagos con OpenTelemetry y trazas distribuidas"],
      ["obs", "Logs estructurados con ID de correlación en el servicio de pedidos"], ["obs", "Despliegue canario del nuevo motor de precios con plan de reversión"],
      ["obs", "Añadir monitorización y alertas al proceso de importación nocturno"],
      // +obs — hard negatives
      ["ui", "Show the user's activity logs in the account page"], ["", "Send price alerts to users when a product gets cheaper"],
      ["", "Roll back the database transaction when the payment fails"], ["", "Incident report form for the hospital staff"], ["", "A heart rate monitor screen for the fitness app"],
      ["", "Log the user's search terms for product analytics"], ["", "Canary Islands shipping rates"], ["", "Upgrade the logging library to the latest version"],
      ["", "The latency of the search results is too high"], ["", "The doctor on call receives the patient's lab results"],
      ["", "Enviar alertas de preço aos clientes quando um produto fica mais barato"], ["", "Reverter a transação quando o pagamento falha"],
      ["", "Enviar alertas de precio a los clientes cuando un producto baja"], ["", "Formulario de incidencias para el personal del hospital"],
    ];
    for (const X of T19) {
      let tp = 0, fp = 0, fn = 0, pos = 0;
      const wrong = [];
      for (const [labels, t] of CORPUS) {
        const want = labels.split(/[ ,]+/).includes(X.tr), on = cls(t).tracks.includes(X.tr);
        if (want) pos++;
        if (on && want) tp++; else if (on) { fp++; wrong.push("FP " + t); } else if (want) { fn++; wrong.push("FN " + t); }
      }
      const precision = tp / (tp + fp || 1), recall = tp / (pos || 1);
      ok(CORPUS.length >= 40 && pos >= 20 && precision >= 0.9 && recall >= 0.85,
        `1.19 T8: +${X.tr} precision ${(precision * 100).toFixed(0)}% / recall ${(recall * 100).toFixed(0)}% on ${CORPUS.length} EN / PT / ES texts, ${pos} positives (≥ 90% / 85%) (wrong: ` + js(wrong) + ")");
    }
    const keyPage = cls("API key management page where admins create and revoke keys"), stripe = cls("Call the Stripe API to charge the customer's card");
    const noBreak = cls("Avoid breaking changes to the webhooks API for existing consumers"), sdk = cls("Bump the AWS SDK to v3");
    ok(!keyPage.tracks.includes("api") && !stripe.tracks.includes("api") && stripe.possible.some((p) => p.track === "api") && noBreak.tracks.includes("api") && !noBreak.negated.api.length &&
      !sdk.tracks.includes("api") && sdk.possible.some((p) => p.track === "api" && p.signal === "sdk") && S.signalConcept("api", "if-match") === "etag" &&
      cls("Add an endpoint and a route for the orders request").possible.some((p) => p.track === "api" && (p.generic || []).length >= 2) &&
      cls("Add an endpoint and a route for the orders request").notes.some((n) => /only app-level words .*none names an API contract/.test(n)),
      "1.19 T8: +api — an API key page, a call to the Stripe API and an SDK bump are no API contract ('possible' at most); 'no breaking changes' states the concern (a hazard, never negated); generic words alone are named as such (got " +
      js([keyPage.signals.api, stripe.possible, noBreak.negated.api, sdk.possible]) + ")");
    const btn = cls("Add a button to export orders as CSV"), login = cls("Log in form"), sales = cls("Metrics dashboard for sales");
    ok(keyPage.tracks.includes("ui") && keyPage.signals.ui.includes("management page") && !btn.tracks.includes("ui") && btn.possible.some((p) => p.track === "ui") &&
      !login.tracks.includes("ui") && !(login.signals.obs || []).length && !sales.tracks.includes("ui") &&
      cls("The screening of job applicants").signals.ui.length === 0 && cls("A team formed in 2020").signals.ui.length === 0 &&
      !cls("Translate the UI into Spanish").tracks.includes("ui") && cls("Build the UI for invoices in React").tracks.includes("ui") && !cls("no UI change: a backend-only fix").tracks.includes("ui") && S.signalConcept("ui", "Vue") === "framework" &&
      cls("A modal with a dropdown").notes.some((n) => /on from weak signals only/i.test(n)) && btn.notes.some((n) => /none names a UI concern of its own/.test(n) || /weak signal 'button'|app-level words \('button'\)/.test(n)),
      "1.19 T8: +ui — an API key management page is UI (not API); a button, the log in form (no +obs from 'log') and a sales dashboard are 'possible' at most; 'screening' / 'formed' are no screen / form; 'UI' (capitals) is an anchor — 'translate the UI' alone stays possible, UI + React turns it on, 'no UI' keeps it off (got " +
      js([keyPage.signals, btn.possible, login.signals.ui, sales.possible]) + ")");
    const grafana = cls("A Grafana dashboard for the checkout"), obsSaas = cls("Add observability to the billing service"), noDown = cls("Deploy the billing service without downtime and roll back on errors");
    ok(!sales.tracks.includes("obs") && sales.possible.some((p) => p.track === "obs") && grafana.tracks.includes("obs") && !(grafana.signals.ui || []).includes("dashboard") &&
      obsSaas.tracks.includes("obs") && obsSaas.tracks.includes("saas") && noDown.tracks.includes("obs") && !noDown.negated.obs.length &&
      !cls("Canary Islands shipping rates").tracks.includes("obs") && !cls("Send price alerts to users").tracks.includes("obs") && !cls("Log in form").signals.obs.length &&
      cls("Roll it out as a canary and roll back when the error rate rises").tracks.includes("obs") && S.signalConcept("obs", "p99") === "latency",
      "1.19 T8: +obs — a sales metrics dashboard is 'possible' at most (never +obs), a Grafana dashboard is +obs and no +ui dashboard; 'observability' serves +saas and +obs; 'without downtime' states the concern (a hazard); Canary Islands, price alerts and the log in form are no operability (got " +
      js([sales.possible, grafana.signals, obsSaas.label, noDown.signals.obs, noDown.negated.obs]) + ")");

    // --- 1.19 T9: every built-in track together — criteria in track order with unique IDs (US-1.AC-1..31), one T-ID per template AC,
    // every template AC planned and tasked, one <track>-sections check per marker track
    const all = d("all-tracks");
    const every = S.createFeature(all, "Everything", S.OPTIONAL_TRACKS.slice(), "", undefined, "en");
    const aReq = rd(every.dir, "requirements.md"), aPlan = rd(every.dir, "test-plan.md"), aTasks = S.parseTasks(rd(every.dir, "tasks.md"));
    const acIds = [...aReq.matchAll(/\*\*(US-\d+\.AC-\d+)\*\*/g)].map((m) => m[1]);
    const tIds = [...aPlan.matchAll(/^\| (T-\d+) \|/gm)].map((m) => m[1]);
    const aTr = S.traceCheck(all, every.slug), aDoc = S.specDoctor(all, every.slug);
    // (1.21 F4: + [DATA], US-1.AC-32..35 — eleven tracks, 36 criteria and T-IDs, nine <track>-sections checks)
    const order = ["[SaaS]", "[AI]", "[SEC]", "[PRIVACY]", "[DIST]", "[API]", "[UI]", "[OBS]", "[DATA]"].map((m) => aReq.indexOf("#### " + m));
    ok(every.ok && every.label === "core +tdd +saas +ai +sec +privacy +dist +api +ui +obs +data" && acIds.length === 36 && new Set(acIds).size === 36 && acIds.includes("US-1.AC-35") &&
      tIds.length === 36 && new Set(tIds).size === 36 && new Set(aTasks.map((t) => t.number)).size === aTasks.length && order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])) &&
      !aTr.uncoveredByTasks.length && !aTr.uncoveredByTests.length && !aTr.phantomAcsInTasks.length && !aTr.phantomTestsInTasks.length && !(aTr.testsNotMappedToTasks || []).length &&
      ["saas", "ai", "sec", "privacy", "dist", "api", "ui", "obs", "data"].every((t) => chk(aDoc, t + "-sections").status === "fail"),
      "1.19 T9: every built-in track — 36 unique criteria (the [API] / [UI] / [OBS] / [DATA] blocks after [DIST], US-1.AC-20..35), 36 unique T-IDs, unique task numbers, every template AC planned and tasked, nine <track>-sections checks (got " +
      js([every.label, acIds.length, tIds.length, order, aTr.uncoveredByTasks, aTr.uncoveredByTests]) + ")");

    // --- 1.19 T10: the placeholder corpus stays bounded as tracks are added (every set of at most two optional tracks + all of them):
    // its texts are counted and its render time is compared with one all-tracks scaffold (relative — no absolute milliseconds)
    const EI = require("./lib/engine/index.js");
    const renderAll = () => { for (const l of ["en", "pt", "es"]) { const a = { name: "x", tracks: S.VALID_TRACKS.slice(), label: "core", slug: "x", summary: "" };
      I.classification(a, l); I.requirements(a, l); I.design(a, l); I.tasks(a, l); I.testPlan("x", l, a.tracks); I.checklist(a, l); } };
    renderAll();
    const ratios = [];
    let texts = 0;
    for (let k = 0; k < 3; k++) {
      let t0 = process.hrtime.bigint(); for (let i = 0; i < 10; i++) renderAll(); const unit = Number(process.hrtime.bigint() - t0) / 10;
      t0 = process.hrtime.bigint(); texts = EI.templateCorpus().length; ratios.push(Number(process.hrtime.bigint() - t0) / unit);
    }
    ratios.sort((a, b) => a - b);
    ok(texts > 900 && texts <= 1400 && ratios[1] <= 60,
      `1.19 T10: the template corpus renders ${texts} texts (≤ 1400) in ~${ratios[1].toFixed(0)}× one all-tracks scaffold (≤ 60×; 1.18: 628 texts, ~19×)`);

    // --- 1.19 T11: the pt-BR twins of the new PT strings hold no European-only word, are idempotent and keep the markers / IDs
    const aBr = { name: "ARGN", tracks: ["core", "tdd", "api", "ui", "obs"], label: "core +tdd +api +ui +obs", slug: "argn", summary: "" };
    const brTexts = [...["requirements", "design", "tasks", "checklist"].map((b) => I[b](aBr, "pt-BR")), I.testPlan("ARGN", "pt-BR", aBr.tracks),
      ...["api.md", "ui.md", "observability.md"].map((f) => I.steeringStub(f, "pt-BR")), ...["api", "ui", "obs"].flatMap((t) => S.msg("pt-BR").secPrivacy.finishChecks[t])].join("\n");
    const EU = /(?<![\p{L}])(?:utilizador(?:es)?|registos?|partilhad[oa]s?|atómic[oa]s?|secç(?:ão|ões)|ficheiros?|ecrã|controlo)(?![\p{L}])|por omissão|em baixo/iu;
    ok(!EU.test(brTexts) && I.toPtBr(brTexts) === brTexts && (brTexts.match(/US-1\.AC-(?:2\d|3[01])/g) || []).length >= 36 && /## \[API\] Contrato da API/.test(brTexts) &&
      /## \[UI\] Estados da Interface/.test(brTexts) && /## \[OBS\] SLIs e SLOs/.test(brTexts) && /leitor de tela/.test(brTexts) && /Interface do Usuário/.test(brTexts),
      "1.19 T11: the pt-BR twins of the +api / +ui / +obs strings hold no European-only word (arquivo, tela, usuário, controle…), are idempotent and keep the markers and AC IDs (got " +
      js([(brTexts.match(EU) || [])[0]]) + ")");

    // --- 1.19 T review 1: +obs — business monitoring / alerts, help-desk incidents and SLAs, a clinical health check are no operability:
    // the watch words are ONE concept, SLA / incident / health check are context, on-call / game day / postmortem / a lower-case otel are
    // weak; a technical target (a job, a service, ops…) backs a lone weak word; "customer service" is no target
    const onOf = (t, tr) => cls(t).tracks.includes(tr);
    const bizObs = ["Monitor stock levels and send alerts to the purchasing team when inventory is low.",
      "Warehouse temperature monitoring: sensors report every minute and alerts go to the shift manager.", "Send price-drop alerts to shoppers and monitor competitor prices daily.",
      "Monitorização dos níveis de stock e alertas ao responsável do armazém.", "Monitoramento da temperatura das câmaras frigoríficas com alertas por SMS.",
      "Monitoreo del inventario y alertas al responsable del almacén.", "Monitorización de la temperatura de los camiones frigoríficos con alertas.",
      "Support incident escalation: a ticket not answered within the SLA escalates to the team lead.", "O incidente de suporte deve ser atribuído a um agente em 2 horas, conforme o SLA de suporte.",
      "Patients fill a health check questionnaire before the visit; any adverse incident is reported to the doctor.", "Alertas de incidentes de seguridad física en la tienda para el gerente.",
      "Customer service alerts: flag VIP tickets that wait more than an hour.", "Incidencias de clientes con SLA de 24 horas y alertas al supervisor."];
    const otherDomain = ["On-call schedule for the hospital's nurses with shift swaps.", "Game day ticketing: open the box office two hours before kickoff.",
      "Postmortem report for the pathology lab.", "Otel reservations for the sales team's offsite."];
    const stock = cls(bizObs[0]), desk = cls(bizObs[7]);
    const opsObs = ["Monitor the ERP sync job and send alerts to ops when it fails.", "Alert the team when the nightly backup job hasn't completed by 6 am.",
      "Monitorizar o serviço de pagamentos e alertar o plantão quando a taxa de erro subir.", "Monitoreo del servicio de búsqueda con alertas cuando la latencia supera 500 ms.",
      "OTel instrumentation for the gateway.", "Page the on-call engineer when the queue backs up"];
    ok(bizObs.every((t) => !onOf(t, "obs")) && otherDomain.every((t) => { const r = cls(t); return !r.tracks.includes("obs") && r.possible.some((p) => p.track === "obs"); }) &&
      stock.possible.some((p) => p.track === "obs") && stock.signals.obs.length === 1 && !desk.signals.obs.length && opsObs.every((t) => onOf(t, "obs")) &&
      ["monitoring", "monitor", "alerts", "alert", "incident", "sla", "postmortem", "alertas", "monitoreo"].every((k) => S.signalConcept("obs", k) === "watch") &&
      S.signalConcept("obs", "sync job") === "target" && S.trackSignals("obs").context.includes("incident") && S.trackSignals("obs").weak.includes("on-call") && S.trackSignals("obs").strong.includes("OTel"),
      "1.19 T review 1: +obs — business monitoring / alerts (EN / PT / ES), a help desk's incident + SLA, a clinical health check stay off (one 'watch' hint at most); on-call / game day / postmortem / Otel from other domains are 'possible' only; a watch word + a technical target (a job, a service, ops) and OTel / paging the on-call are +obs (got " +
      js([bizObs.filter((t) => onOf(t, "obs")), otherDomain.map((t) => cls(t).tracks), stock.signals.obs, desk.signals.obs, opsObs.filter((t) => !onOf(t, "obs"))]) + ")");

    // --- 1.19 T review 2: +api — consuming someone else's API is app-level ('possible' at most, EN / PT / ES); the ownership-ambiguous
    // names are weak — strong beside an own cue or as the clause's own subject; a consumer verb counts only when it governs the API phrase
    const consumed = ["Call Stripe's REST API to create payment intents and handle webhooks for payment confirmation.", "Integrate with the Salesforce REST API to sync contacts every hour.",
      "Sync contacts from HubSpot's public API into our CRM table nightly.", "Replace our calls to Shopify's old GraphQL endpoint with their new Admin API version.",
      "Generate a typed client from the payment provider's OpenAPI spec and use it in the checkout.", "Book the courier through the partner API.", "Send the order to the supplier's HTTP API.",
      "Integrate the Google Maps JSON API.", "Use the Shopify API version 2024-04.", "Integrar com a API REST do Stripe para criar pagamentos.",
      "Integrar con la API REST de Stripe para crear pagos.", "Llamar a la API REST del banco para consultar el saldo de las cuentas."];
    const weakAmbig = ["Stripe REST API integration for subscriptions.", "The About dialog shows the app version and the API version it talks to.",
      "Show the problem details for each support ticket in the agent view."];
    const ownApi = ["Expose our product catalog to partners through a versioned REST API with OAuth2 client credentials.",
      "Add CRUD endpoints for the products resource to our public REST API, with cursor pagination, versioned under /v2.", "Version the public API: ship v2 and deprecate v1 with a Sunset header",
      "Add rate limiting to the public API", "REST API for the mobile app to list and filter orders.", "Criar uma API REST pública para parceiros, com versionamento e limites de pedidos.",
      "SDK de JavaScript para nuestra API pública con reintentos automáticos.", "Management API for tenants: create, suspend and delete tenants through the internal API.",
      "The order service calls the payment service over gRPC"];
    const sfc = cls(consumed[1]);
    ok(consumed.every((t) => { const r = cls(t); return !r.tracks.includes("api") && r.possible.some((p) => p.track === "api"); }) && weakAmbig.every((t) => !onOf(t, "api")) &&
      ownApi.every((t) => onOf(t, "api")) && sfc.signals.api.includes("rest api") && S.trackSignals("api").weak.includes("rest api") && S.signalConcept("api", "public api") === "kind",
      "1.19 T review 2: +api — calling / integrating with / syncing from someone else's API (a possessive owner, 'their', the <Name>, PT / ES 'do Stripe' / 'del banco', a governing consumer verb) is 'possible' at most; an ambiguous name without an owner cue stays weak; our own API — an own cue, the clause's subject, 'to the public API', an internal / management API, services calling each other over gRPC — is +api (got " +
      js([consumed.filter((t) => onOf(t, "api")), weakAmbig.filter((t) => onOf(t, "api")), ownApi.filter((t) => !onOf(t, "api"))]) + ")");

    // --- 1.19 T review 3: +ui — a page type in a backend-only sentence, an empty state in a state machine, a venue's accessibility are no UI
    // work; the reviewer's negations still keep +ui off; a backend sentence of its own leaves the page's sentence alone
    const backendUi = ["Build the data layer for the admin page (a SQL view and a repository method); the page itself is built by the frontend team.",
      "Add a PATCH /me/preferences handler that the settings page calls to save preferences; the UI already exists.", "The profile page backend should return the user's avatar URL and display name.",
      "Expose the admin page's API so the mobile app can fetch the same stats.", "Endpoint interno para o painel de administração obter estatísticas; a interface já existe.",
      "Order state machine: an order moves from the empty state to draft to submitted; the empty state is created when a cart is opened.",
      "State machine for the vending machine: states empty, ready, dispensing; the empty state blocks sales.", "Wheelchair accessibility of each venue and its entrances.",
      "Acessibilidade das lojas físicas para cadeiras de rodas.", "Accesibilidad de los edificios: rampas y ascensores en cada sede.",
      "Backend only, no UI changes: move the invoice PDF generation to a background worker.", "No frontend work: add a nightly job that purges soft-deleted accounts after 30 days.",
      "Apenas backend, sem interface do utilizador: nova tarefa que apaga contas inativas.", "Sin interfaz de usuario: solo un proceso nocturno que borra cuentas inactivas."];
    const realUi = ["Settings page for notifications. The backend exposes a PATCH endpoint.", "Página de configurações para gerir as chaves de API.",
      "Management page for API keys: create, revoke and see the last-used date.", "The cart page should show an empty state with a call to action when there are no items.",
      "Improve the accessibility of the signup form.", "Rever a acessibilidade do formulário de checkout: ordem de foco e leitor de ecrã.", "Mostrar un estado vacío en la pantalla de pedidos."];
    const venue = cls(backendUi[7]);
    ok(backendUi.every((t) => !onOf(t, "ui")) && realUi.every((t) => onOf(t, "ui")) && venue.possible.some((p) => p.track === "ui") &&
      S.trackSignals("ui").weak.includes("accessibility") && S.trackSignals("ui").strong.includes("wcag") && cls(backendUi[1]).signals.ui.includes("settings page"),
      "1.19 T review 3: +ui — a settings / admin / profile page named in a backend-only sentence (a handler, an endpoint, the backend, an API, a data layer, 'the UI already exists'), an empty state in a state machine and a venue's wheelchair accessibility (EN / PT / ES) stay off; 'no UI changes' / 'sem interface do utilizador' / 'Sin interfaz de usuario' too; API keys are no backend cue (got " +
      js([backendUi.filter((t) => onOf(t, "ui")), realUi.filter((t) => !onOf(t, "ui")), venue.signals.ui]) + ")");

    // --- 1.19 T review 4: a pack of ANOTHER name whose recorded marker is a built-in track's now ('webui' [UI], 'contracts' [API], 'ops' [OBS]):
    // doctor and spec_upgrade explain it; add-track <track> adopts it (the built-in sections are appended although a heading carries the
    // marker, the pack leaves the list and packMarkers); --remove drops it by its name
    const mp = d("marker-legacy");
    S.initProject(mp, ["core"], "en");
    const markerFeature = (name, marker, lang) => {
      const pdir = path.join(mp, ".specs", "tracks", name);
      fs.mkdirSync(pdir, { recursive: true });
      fs.writeFileSync(path.join(pdir, "track.json"), JSON.stringify({ name, marker, title: { en: "Pack " + name }, sections: [{ name: "Thing " + name, guidance: "Say how." }] }));
      const f = S.createFeature(mp, "f-" + name, ["core"], "", undefined, lang || "en");
      const sp = path.join(f.dir, ".state.json");
      const st = JSON.parse(rd(sp));
      st.tracks = ["core", name];
      st.packMarkers = { [name]: "[" + marker + "]" };
      fs.writeFileSync(sp, JSON.stringify(st, null, 2));
      fs.appendFileSync(path.join(f.dir, "design.md"), "\n## [" + marker + "] Thing " + name + "\n- decided.\n");
      return f;
    };
    const mWeb = markerFeature("webui", "UI"), mCon = markerFeature("contracts", "API"), mOps = markerFeature("ops", "OBS", "pt");
    const mDoc = chk(S.specDoctor(mp, "f-webui"), "track-pack-missing"), mDocPt = chk(S.specDoctor(mp, "f-ops"), "track-pack-missing");
    const mUp = S.specUpgrade(mp), mUpF = mUp.features.find((x) => x.name === "f-webui") || {};
    const mAdopt = S.addTrack(mp, "f-webui", "ui");
    const mWebSt = JSON.parse(rd(mWeb.dir, ".state.json")), mWebDesign = rd(mWeb.dir, "design.md");
    const mUiDoc = chk(S.specDoctor(mp, "f-webui"), "ui-sections");
    const mDrop = S.addTrack(mp, "f-contracts", "contracts", { remove: true });
    ok(/\+webui \(a track pack from before 1\.19 — its marker \[UI\] is the built-in \+ui track's now/.test(mDoc.detail || "") && /node "[^"]*dev-spec\.js" add-track f-webui ui/.test(mDoc.detail || "") &&
      /o seu marcador \[OBS\] é agora o do track \+obs incluído/.test(mDocPt.detail || "") && js(mUpF.reservedMarkers) === js([{ name: "webui", marker: "[UI]", track: "ui" }]) &&
      (mUpF.attention || []).includes("track-pack-reserved") && mUp.lines.some((l) => /Change the marker of its track pack\(s\) from before 1\.19 — \+webui \[UI\]/.test(l)) &&
      mAdopt.ok && js(mAdopt.adopted) === js(["ui"]) && js(mAdopt.adoptedPacks) === js(["webui"]) && mWebDesign.includes("## [UI] Design System Usage") && mWebDesign.includes("## [UI] Thing webui") &&
      !mWebSt.tracks.includes("webui") && !(mWebSt.packMarkers || {}).webui && mUiDoc.status === "fail" && !/:missing/.test(mUiDoc.detail) && !chk(S.specDoctor(mp, "f-webui"), "track-pack-missing").status &&
      mDrop.ok && js(mDrop.removedTracks) === js(["contracts"]) && js(JSON.parse(rd(mCon.dir, ".state.json")).tracks) === js(["core"]) && mOps.ok,
      "1.19 T review 4: a pre-1.19 pack of another name with a now-reserved marker ('webui' [UI]) — doctor says why (EN / PT) and spec_upgrade lists it (reservedMarkers, track-pack-reserved); add-track ui adopts it (the five [UI] sections appended beside the pack's heading, adopted / adoptedPacks, the pack's record gone, ui-sections 'unfilled' not 'missing'); add-track contracts --remove drops the pack (got " +
      js([mDoc.detail, mDocPt.detail, mUpF.reservedMarkers, mAdopt.adopted, mAdopt.adoptedPacks, mUiDoc.detail, mDrop.error || mDrop.removedTracks]) + ")");

    // --- 1.19 T review 5: the burn-rate guidance agrees with observability-patterns.md (the SRE workbook): 14.4× / 1 h and 6× / 6 h page,
    // 1× / 3 days opens a ticket — in the observability.md stub (EN / PT / ES / pt-BR) and in references/steering-templates.md
    const refDir = path.join(__dirname, "..", "skills", "dev-spec-driven", "references");
    const obsGuide = fs.readFileSync(path.join(refDir, "observability-patterns.md"), "utf8"), stTpl = fs.readFileSync(path.join(refDir, "steering-templates.md"), "utf8");
    const burn = { en: /the fast ones page \(e\.g\. 14\.4× over 1 h, 6× over 6 h\), the slow one \(e\.g\. 1× over 3 days\) opens a ticket/, pt: /os rápidos chamam \(ex\.: 14,4× em 1 h, 6× em 6 h\), o lento \(ex\.: 1× em 3 dias\) abre um ticket/,
      es: /las rápidas avisan \(p\. ej\., 14,4× en 1 h, 6× en 6 h\), la lenta \(p\. ej\., 1× en 3 días\) abre un ticket/, "pt-BR": /os rápidos acionam o plantão \(ex\.: 14,4× em 1 h, 6× em 6 h\)/ };
    ok(Object.entries(burn).every(([l, re]) => re.test(I.steeringStub("observability.md", l) || "")) && burn.en.test(stTpl) && !/6× over 6 h\) opens a ticket/.test(stTpl) &&
      /\| \*\*Page\*\* \| 6 hours \| 30 minutes \| 6 \|/.test(obsGuide) && /\| \*\*Ticket\*\* \| 3 days \| 6 hours \| 1 \|/.test(obsGuide),
      "1.19 T review 5: the observability.md stub (EN / PT / ES / pt-BR) and steering-templates.md say 6× over 6 h PAGES and 1× over 3 days opens a ticket, as observability-patterns.md's table does (got " +
      js((I.steeringStub("observability.md", "en") || "").split("\n").filter((l) => /Burn-rate/.test(l))) + ")");

    // --- 1.19 T review 7: pt-BR — the runbook gets a "link" (a "ligação" is a phone call in Brazil), the on-call person is "de plantão"
    const brObs = { name: "x", tracks: ["core", "tdd", "obs"], label: "core +tdd +obs", slug: "x", summary: "" };
    const brReq = I.requirements(brObs, "pt-BR"), brPlan = I.testPlan("x", "pt-BR", brObs.tracks);
    const ac29 = brReq.split("\n").find((l) => l.includes("US-1.AC-29")) || "", t29 = brPlan.split("\n").find((l) => /US-1\.AC-29/.test(l) && /runbook/.test(l)) || "";
    ok(/alertar a pessoa de plantão \(on-call\) com um link para o runbook/.test(ac29) && /dispara e aciona o plantão com o link para o runbook/.test(t29) &&
      ![ac29, t29].some((l) => /ligação|pessoa de serviço/.test(l)) && I.toPtBr(brReq + brPlan) === brReq + brPlan && /ligação para o runbook/.test(I.requirements(brObs, "pt")),
      "1.19 T review 7: pt-BR — US-1.AC-29 pages 'a pessoa de plantão' with 'um link para o runbook' and its test row 'aciona o plantão com o link'; no 'ligação' / 'pessoa de serviço' left; PT keeps its wording; idempotent (got " + js([ac29, t29]) + ")");

    // --- 1.19 T review 8: recall — PT implantação canário / gradual, ES revertir el despliegue + comprobaciones de salud, PT verificação de saúde,
    // a singular "alert" beside a job (alone: 'possible'), X-Request-ID, the X-RateLimit-* headers by name, form validation + inline errors
    const lone = cls("Alert the team when the report is ready."), rl = cls("Return X-RateLimit-Remaining and X-RateLimit-Reset on every response.");
    const recallT = ["Implantação canário do novo motor de recomendações para 5% dos utilizadores.", "Implantação gradual da nova versão com reversão automática.",
      "Revertir el despliegue automáticamente si fallan las comprobaciones de salud.", "Reverter a implantação se a verificação de saúde falhar.",
      "Alert the team when the nightly backup job hasn't completed by 6 am.", "Propagate the X-Request-ID header through all services and include it in every log line."];
    ok(recallT.every((t) => onOf(t, "obs")) && !lone.tracks.includes("obs") && lone.possible.some((p) => p.track === "obs" && p.signal === "alert") &&
      rl.tracks.includes("api") && rl.signals.api.includes("x-ratelimit-remaining") && onOf("Form validation for the signup form: email format, password strength and inline errors.", "ui") &&
      onOf("Translate the UI into Spanish and German and add a language picker to the header.", "ui"),
      "1.19 T review 8: recall — PT 'implantação canário / gradual', ES 'revertir el despliegue' / 'comprobaciones de salud', PT 'verificação de saúde', 'alert' + a nightly job, X-Request-ID are +obs ('alert the team' alone is 'possible'); X-RateLimit-Remaining / -Reset are +api; form validation + inline errors and the UI + a language picker are +ui (got " +
      js([recallT.filter((t) => !onOf(t, "obs")), lone.possible, rl.signals.api]) + ")");

    // --- 1.19 T review: precision / recall on the reviewer's hardest texts (EN / PT / ES — the false positives and misses of the review, their
    // positives and hard negatives): ≥ 90% precision and ≥ 85% recall per track
    const HARD = [
      ["api", "Add CRUD endpoints for the products resource to our public REST API, with cursor pagination, versioned under /v2."],
      ["api", "Our public API must return RFC 9457 problem details for every error and document all status codes in the OpenAPI spec."],
      ["api", "Deprecate the legacy /v1/orders endpoints: add Sunset and Deprecation headers and a migration guide for API consumers."],
      ["api", "Expose our product catalog to partners through a versioned REST API with OAuth2 client credentials."],
      ["api", "Management API for tenants: create, suspend and delete tenants through the internal API."],
      ["api", "Add rate limiting to the partner API: 1000 requests per hour per key, with X-RateLimit headers."],
      ["api", "Return proper HTTP status codes from the internal API instead of 200 with an error field."],
      ["api", "Endpoint REST para listar encomendas com paginação por cursor e versionamento da API."], ["api", "SDK de JavaScript para nuestra API pública con reintentos automáticos."],
      ["api", "Versionado de la API: /v2 con cambios incompatibles documentados en OpenAPI."], ["api", "Criar uma API REST pública para parceiros, com versionamento e limites de pedidos."],
      ["api", "Add an X-RateLimit-Remaining header to every response of our API."], ["api", "REST API for the mobile app to list and filter orders."],
      ["api", "Nuestra API REST debe devolver errores con códigos de estado consistentes."],
      ["", "Call Stripe's REST API to create payment intents and handle webhooks for payment confirmation."], ["", "Integrate with the Salesforce REST API to sync contacts every hour."],
      ["", "Sync contacts from HubSpot's public API into our CRM table nightly."], ["", "Replace our calls to Shopify's old GraphQL endpoint with their new Admin API version."],
      ["", "Generate a typed client from the payment provider's OpenAPI spec and use it in the checkout."], ["", "Integrar com a API REST do Stripe para criar pagamentos."],
      ["", "Integrar con la API REST de Stripe para crear pagos."], ["", "Llamar a la API REST del banco para consultar el saldo de las cuentas."],
      ["", "Book the courier through the partner API."], ["", "Send the order to the supplier's HTTP API."], ["", "Integrate the Google Maps JSON API."],
      ["", "Use the Shopify API version 2024-04."], ["", "Show the problem details for each support ticket in the agent view."],
      ["ui", "Settings page where users can change their notification preferences, email frequency and language."], ["ui", "Admin panel to manage coupons: list, create, disable, with search and filters."],
      ["ui", "The cart page should show an empty state with a call to action when there are no items."], ["ui", "Form validation for the signup form: email format, password strength and inline errors."],
      ["ui", "Translate the UI into Spanish and German and add a language picker to the header."],
      ["ui", "Accessibility fixes: focus order in the checkout form, a visible focus indicator, screen reader announcements for errors."],
      ["ui", "Management page for API keys: create, revoke and see the last-used date."], ["ui", "Página de configurações onde o utilizador altera o idioma e as notificações por email."],
      ["ui", "Rever a acessibilidade do formulário de checkout: ordem de foco e leitor de ecrã."], ["ui", "Mostrar un estado vacío en la pantalla de pedidos."],
      ["ui", "Improve the accessibility of the signup form."], ["ui", "Cancel subscription flow: a confirm dialog, a reason survey and a win-back offer screen."],
      ["", "Build the data layer for the admin page (a SQL view and a repository method); the page itself is built by the frontend team."],
      ["", "Add a PATCH /me/preferences handler that the settings page calls to save preferences; the UI already exists."],
      ["", "The profile page backend should return the user's avatar URL and display name."], ["", "Endpoint interno para o painel de administração obter estatísticas; a interface já existe."],
      ["", "Order state machine: an order moves from the empty state to draft to submitted; the empty state is created when a cart is opened."],
      ["", "State machine for the vending machine: states empty, ready, dispensing; the empty state blocks sales."], ["", "Wheelchair accessibility information for each venue and its entrances."],
      ["", "Accesibilidad de los edificios: rampas y ascensores en cada sede."], ["", "Backend only, no UI changes: move the invoice PDF generation to a background worker."],
      ["", "Sin interfaz de usuario: solo un proceso nocturno que borra cuentas inactivas."], ["", "Apenas backend, sem interface do utilizador: nova tarefa que apaga contas inativas."],
      ["obs", "Add latency metrics and request logs to the image resizing service."], ["obs", "Propagate the X-Request-ID header through all services and include it in every log line."],
      ["obs", "Alert the team when the nightly backup job hasn't completed by 6 am."], ["obs", "Monitor the ERP sync job and send alerts to ops when it fails."],
      ["obs", "Uptime monitoring for our public status page with alerts to Slack."], ["obs", "If the deploy fails its health checks, automatically roll back to the previous release."],
      ["obs", "Implantação canário do novo motor de recomendações para 5% dos utilizadores."], ["obs", "Revertir el despliegue automáticamente si fallan las comprobaciones de salud."],
      ["obs", "Monitorizar o serviço de pagamentos e alertar o plantão quando a taxa de erro subir."], ["obs", "Page the on-call engineer via PagerDuty when the checkout error rate exceeds 2% for 5 minutes."],
      ["obs", "Monitoreo del servicio de búsqueda con alertas cuando la latencia supera 500 ms."], ["obs", "Rollout da nova versão da app para 10% dos utilizadores com monitorização da taxa de erro."],
      ["", "Monitor stock levels and send alerts to the purchasing team when inventory is low."], ["", "Warehouse temperature monitoring: sensors report every minute and alerts go to the shift manager."],
      ["", "Send price-drop alerts to shoppers and monitor competitor prices daily."], ["", "Monitorização dos níveis de stock e alertas ao responsável do armazém."],
      ["", "Monitoramento da temperatura das câmaras frigoríficas com alertas por SMS."], ["", "Monitoreo del inventario y alertas al responsable del almacén."],
      ["", "Monitorización de la temperatura de los camiones frigoríficos con alertas."], ["", "Support incident escalation: a ticket not answered within the SLA escalates to the team lead."],
      ["", "O incidente de suporte deve ser atribuído a um agente em 2 horas, conforme o SLA de suporte."],
      ["", "Patients fill a health check questionnaire before the visit; any adverse incident is reported to the doctor."], ["", "On-call schedule for the hospital's nurses with shift swaps."],
      ["", "Game day ticketing: open the box office two hours before kickoff."], ["", "Postmortem report for the pathology lab."], ["", "Otel reservations for the sales team's offsite."],
      ["", "Alertas de incidentes de seguridad física en la tienda para el gerente."], ["", "Customer service alerts: flag VIP tickets that wait more than an hour."],
      // 1.19 verify 1: +ui was lost when the backend was negated or named in another clause; the page consuming an API is UI work
      ["ui", "Frontend only, no backend changes: a new landing page with a hero section and a signup form."],
      ["ui", "The redesign does not touch the backend: only the landing page, the header and the footer change."],
      ["ui", "The settings page redesign needs no API changes."], ["ui", "Redesign the admin panel; the backend team will add the endpoints later."],
      ["ui", "The landing page loads its testimonials from the CMS API."], ["ui", "Apenas frontend, sem backend: nova página de perfil com foto e biografia."],
      ["ui", "Sin backend: nueva página de ajustes y panel de administración."],
      ["", "Backend for the profile page: the GET /me handler must return the avatar URL and the locale."],
      ["", "Profile page: the GET /me handler must also return the avatar URL."], ["", "A lógica fica no backend da página de definições."],
    ];
    const hardStats = T19.map((X) => {
      let tp = 0, fp = 0, pos = 0;
      const wrong = [];
      for (const [labels, t] of HARD) {
        const want = labels.split(/[ ,]+/).includes(X.tr), on = onOf(t, X.tr);
        if (want) pos++;
        if (on && want) tp++; else if (on) { fp++; wrong.push("FP " + t); } else if (want) wrong.push("FN " + t);
      }
      return { tr: X.tr, precision: tp / (tp + fp || 1), recall: tp / (pos || 1), pos, wrong };
    });
    ok(HARD.length >= 60 && hardStats.every((x) => x.pos >= 10 && x.precision >= 0.9 && x.recall >= 0.85),
      `1.19 T review: precision / recall on ${HARD.length} of the reviewer's hardest EN / PT / ES texts ≥ 90% / 85% per track — ` +
      hardStats.map((x) => `+${x.tr} ${(x.precision * 100).toFixed(0)}% / ${(x.recall * 100).toFixed(0)}% (${x.pos} positives)`).join(", ") + " (got " + js(hardStats.flatMap((x) => x.wrong)) + ")");

    // --- 1.19 verify 1: +ui — the backend cue reads the page word's CLAUSE (a short label before a colon joins what it introduces),
    // a negated backend word and one the page consumes never demote it, "frontend only" demotes nothing, "the frontend team" is a
    // team; the reviewer's backend-only texts stay off; the genericOnly note no longer offers "the frontend" as an anchor
    const v1On = ["Frontend only, no backend changes: a new landing page with a hero section and a signup form.",
      "The redesign does not touch the backend: only the landing page, the header and the footer change.", "The settings page redesign needs no API changes.",
      "Redesign the admin panel; the backend team will add the endpoints later.", "The landing page loads its testimonials from the CMS API.",
      "Apenas frontend, sem backend: nova página de perfil com foto e biografia.", "Sin backend: nueva página de ajustes y panel de administración.",
      "O redesenho não mexe no backend: só muda a página de perfil e o cabeçalho.", "El rediseño no toca el backend: solo cambian la página de ajustes y la cabecera.",
      "A página de definições carrega os dados da API de preferências.", "La página de ajustes carga los datos desde la API de preferencias.",
      "Redesign the settings page; the endpoint already exists.", "Frontend-only change: the settings page gets a new layout; the PATCH endpoint already exists."];
    const v1Off = [...backendUi, "Backend for the profile page: the GET /me handler must return the avatar URL and the locale.",
      "Profile page: the GET /me handler must also return the avatar URL.", "Backend: the settings page calls the new PATCH /me/preferences endpoint.",
      "Settings page: a PATCH handler saves the preferences; the form already exists.", "Settings page preferences are saved through a new handler; the UI already exists.",
      "A lógica fica no backend da página de definições.", "Apenas backend: o endpoint da página de perfil passa a devolver também a morada de faturação.",
      "Solo backend: el endpoint de la página de perfil devuelve también la dirección de facturación."];
    const v1Team = cls(backendUi[0]), v1Note = v1Team.notes.find((n) => /Possible \+ui/.test(n)) || "";
    ok(v1On.every((t) => onOf(t, "ui")) && v1Off.every((t) => !onOf(t, "ui")) && v1Team.signals.ui.includes("frontend") && !v1Team.tracks.includes("ui") &&
      /only app-level words \('admin page', 'frontend'\)/.test(v1Note) && !/the frontend/.test(v1Note) &&
      ["pt", "es"].every((l) => !/o frontend|el frontend/.test(I.msg(l).classify.genericOnly("ui", "'x'"))),
      "1.19 verify 1: +ui — a negated backend ('no backend changes', 'does not touch the backend', 'needs no API changes', sem / sin backend), a backend in another clause, an API the page loads from and 'frontend only' keep the page words (EN / PT / ES); a backend word before / right after the page, a label ('Profile page: the GET /me handler…'), 'the UI already exists' and PT 'no backend' (em + o) still demote; 'the frontend team' is generic; the note offers no 'frontend' anchor (got " +
      js([v1On.filter((t) => !onOf(t, "ui")), v1Off.filter((t) => onOf(t, "ui")), v1Team.signals.ui, v1Note]) + ")");

    // --- 1.19 verify 2: +api — "the deprecated X API" is an adjective (no own verb), an ALL-CAPS organisation after / before the API
    // phrase owns it (a technical acronym doesn't), and breaking compatibility as a verb is a compat anchor + hazard in EN / PT / ES
    const v2Off = ["Replace the deprecated Google Places API calls with the new Places API version before they are shut down.",
      "Obtener las tasas de cambio de la API pública del BCE cada mañana.", "Sync the ECB's public API rates into the ledger.", "Use the documented Stripe API version."];
    const v2On = ["Expose the REST API of the CRM to partners.", "Deprecate the old public API and publish v2.",
      "This change must not break the public API; existing clients keep working without changes.",
      "Esta alteração não pode quebrar a compatibilidade da API pública com os clientes existentes.",
      "Este cambio no puede romper la compatibilidad de la API pública con los clientes existentes.", "The public API must not break compatibility with existing clients."];
    const v2Pt = cls(v2On[3]), v2Places = cls(v2Off[0]);
    ok(v2Off.every((t) => !onOf(t, "api")) && v2Places.possible.some((p) => p.track === "api") && v2On.every((t) => onOf(t, "api")) &&
      v2Pt.signals.api.includes("quebrar a compatibilidade") && !v2Pt.negated.api.length && S.signalConcept("api", "romper la compatibilidad") === "compat" &&
      S.signalConcept("api", "break compatibility") === "compat",
      "1.19 verify 2: +api — 'the deprecated … API' is no own cue, 'del BCE' / 'the ECB's' own the API ('of the CRM' doesn't), PT 'não pode quebrar a compatibilidade da API pública' is +api like EN / ES (a compat hazard, never negated) (got " +
      js([v2Off.filter((t) => onOf(t, "api")), v2On.filter((t) => !onOf(t, "api")), v2Pt.signals.api, v2Pt.negated.api, v2Places.signals.api]) + ")");

    // --- 1.19 verify 3: +obs recall — PT "alertar" / ES "avisar" are the watch concept (a technical target makes them +obs, a business
    // target leaves a hint); a health check endpoint is strong in PT / ES as in EN
    const v3On = ["Alertar a equipa de operações quando a tarefa agendada de cópias de segurança falhar.",
      "Avisar al equipo de operaciones cuando falle la tarea programada de copias de seguridad.", "Adicionar um endpoint de verificação de saúde ao serviço de encomendas.",
      "Añadir un endpoint de comprobación de salud.", "Criar um endpoint de verificação de saúde."];
    const v3Off = ["Avisar al encargado de la tienda cuando el stock de un producto baje del mínimo.", "Alertar o gestor da loja quando o stock de um produto ficar abaixo do mínimo."];
    ok(v3On.every((t) => onOf(t, "obs")) && v3Off.every((t) => { const r = cls(t); return !r.tracks.includes("obs") && r.possible.some((p) => p.track === "obs"); }) &&
      ["alertar", "avisar"].every((k) => S.signalConcept("obs", k) === "watch" && S.trackSignals("obs").weak.includes(k)) &&
      S.trackSignals("obs").strong.includes("endpoint de comprobación de salud"),
      "1.19 verify 3: +obs — 'Alertar' / 'Avisar' + a scheduled job are +obs, + a store manager a hint only; 'endpoint de verificação de saúde' / 'endpoint de comprobación de salud' alone turn +obs on (got " +
      js([v3On.filter((t) => !onOf(t, "obs")), v3Off.map((t) => cls(t).signals.obs)]) + ")");

    // --- 1.19 verify 4: pt-BR — the [OBS] Alerting guidance, the observability.md heading and the +obs finish check: nobody is
    // "chamado", no alert "liga" to a runbook (a phone call in Brazil); PT keeps its wording; idempotent
    const v4Arg = { name: "x", tracks: ["core", "obs"], label: "core +obs", slug: "x", summary: "" };
    const v4Br = [I.design(v4Arg, "pt-BR"), I.steeringStub("observability.md", "pt-BR"), S.msg("pt-BR").secPrivacy.finishChecks.obs.join("\n")].join("\n");
    const v4Pt = I.design(v4Arg, "pt") + I.steeringStub("observability.md", "pt");
    ok(/quem é acionado · cada alerta aponta para um runbook \(triagem, mitigação, verificação\) · o que vira um ticket e não aciona o plantão/.test(v4Br) &&
      /## Alertas \(cada um com um link para o runbook\)/.test(v4Br) && /runbooks para os quais os alertas apontam existem/.test(v4Br) &&
      !/(?<![\p{L}])(?:liga|ligam|ligação|ligações)(?![\p{L}])|quem é chamado|uma chamada/u.test(v4Br) && I.toPtBr(v4Br) === v4Br &&
      /quem é chamado · cada chamada liga a um runbook/.test(v4Pt) && /## Alertas \(cada um liga a um runbook\)/.test(v4Pt),
      "1.19 verify 4: pt-BR — '[OBS] Alerting' says 'quem é acionado · cada alerta aponta para um runbook … o que vira um ticket e não aciona o plantão', the steering heading 'Alertas (cada um com um link para o runbook)', the finish check 'os runbooks para os quais os alertas apontam'; no liga / ligação / chamada left; PT unchanged; idempotent (got " +
      js(v4Br.split("\n").filter((l) => /runbook/.test(l))) + ")");
  }

  { // 1.21 F2a — the 1.19 verification's remaining misses: a negation reaches every item of a coordinated list (every track), +ui
    // named with everyday words, +api's "our API needs a v2", the settings screen + a public API (the mixed case)
    const js = (v) => JSON.stringify(v);
    const cls = (t, lang) => S.classify(t, lang ? { lang } : {});
    const onOf = (t, tr) => cls(t).tracks.includes(tr);
    // coordinated negation: "not add X or Y", PT "nem", ES "ni", a comma list closed by "or", "neither … nor" — and never past a
    // contrast word ("just"), an "and" (a new predicate) or a comma that no conjunction closes; a hazard's negation opens no list
    const coordOff = [["obs", "We will not add feature flags or canary releases for this internal script."],
      ["obs", "Não vamos usar feature flags nem lançamento canário neste script interno."], ["obs", "No usaremos feature flags ni despliegue canario en este script interno."],
      ["dist", "Without Kafka, RabbitMQ or SQS: a Postgres table is enough."], ["dist", "Neither Kafka nor RabbitMQ — the export runs in-process."],
      ["ai", "Sem LLM nem embeddings: regras fixas."], ["tdd", "Informe interno de ventas, sin datos personales ni autenticación"]];
    const coordOn = [["obs", "No feature flags, just a canary release behind a manual switch."], ["obs", "Without feature flags, the canary release is done by hand."],
      ["obs", "Deploy the billing service without downtime and roll back on errors."], ["obs", "No Kafka and a canary release for the new consumer."],
      ["obs", "Sem Kafka, apenas um lançamento canário com feature flags."]];
    const neg3 = [cls(coordOff[0][1]), cls(coordOff[1][1]), cls(coordOff[2][1])];
    ok(coordOff.every(([tr, t]) => !onOf(t, tr)) && coordOn.every(([tr, t]) => onOf(t, tr)) &&
      neg3.every((r) => r.negated.obs.length === 2 && !r.signals.obs.length) && neg3[1].lang === "pt" &&
      cls(coordOff[6][1]).negated.tdd.includes("autenticación") && S.classify("Sem uso de IA nem LLM.").negated.ai.includes("llm") && !onOf("Sem uso de IA nem LLM.", "ai"),
      "1.21 F2a: a negation reaches every item of the coordinated list it opens, for every track — 'not add feature flags or canary releases', PT 'nem', ES 'ni', 'Without Kafka, RabbitMQ or SQS', 'Neither … nor', ES 'sin datos personales ni autenticación' (+tdd off); never past 'just', an 'and' or an unclosed comma; 'without downtime' (a hazard) opens no list (got " +
      js([coordOff.filter(([tr, t]) => onOf(t, tr)), coordOn.filter(([tr, t]) => !onOf(t, tr)), neg3.map((r) => [r.negated.obs, r.signals.obs])]) + ")");
    // +ui everyday words: a confirm dialog / toast notification / snackbar is UI work; a widget a display verb shows is strong; errors
    // next to each field and a mobile-friendly screen are anchors; a "snack bar", "the modal verbs", a login FORM alone stay off
    const uiOn = ["Show a confirm dialog before a user deletes a project, with the project name typed to confirm.",
      "Toast notifications for saved changes, replacing the old alert() popups in the editor.", "Show a snackbar when the upload finishes.",
      "Show a modal asking the user to confirm the logout.", "Downtime notice: show a banner 24 hours before scheduled maintenance.",
      "O ecrã de login deve mostrar os erros de validação junto a cada campo.", "La pantalla de inicio de sesión debe mostrar los errores de validación junto a cada campo.",
      "Pantalla de pago adaptada al móvil con el botón de pagar siempre visible.", "Mostrar um diálogo de confirmação antes de apagar o projeto.",
      "Mostrar una notificación toast al guardar los cambios."];
    const uiOff = ["The stadium's snack bar sells drinks and hot dogs.", "Teach the modal verbs in the English course.", "Log in form", "Formulário de login",
      "Formulario de inicio de sesión", "Add a button to export orders as CSV", "Metrics dashboard for sales", "Show the monthly totals in the PDF report."];
    ok(uiOn.every((t) => onOf(t, "ui")) && uiOff.every((t) => !onOf(t, "ui")) && S.trackSignals("ui").strong.includes("snackbar") &&
      S.signalConcept("ui", "junto a cada campo") === "inline" && S.signalConcept("ui", "mobile-friendly") === "responsive",
      "1.21 F2a: +ui from everyday words — a confirm dialog, a toast notification, a snackbar, a modal / banner a display verb shows, errors next to each field, a mobile-friendly screen (EN / PT / ES); a snack bar, the modal verbs, a login form, a button, a sales dashboard stay off (got " +
      js([uiOn.filter((t) => !onOf(t, "ui")), uiOff.filter((t) => onOf(t, "ui"))]) + ")");
    // +api: our own API + a new version in the sentence is contract work; someone else's versioned API is not; the settings screen of
    // a PUBLIC API is UI work too (the mixed case) — the page's own API still demotes it
    const apiOn = ["Our webhooks API needs a v2 with a new payload shape; keep v1 working for existing consumers until March.",
      "A nossa API de webhooks precisa de uma v2 com um novo formato de payload.", "Nuestra API de pagos necesita una nueva versión con otro formato."];
    const apiOff = ["Our app calls the Shopify API v3 for the orders.", "Call the Stripe API v2 to charge the card.", "Our API docs need a new logo."];
    const mixed = ["Expose a public REST API for the mobile app's settings screen, with SLO alerts on its latency.",
      "Expor uma API REST pública para o ecrã de definições da aplicação móvel, com alertas de SLO sobre a latência.",
      "Exponer una API REST pública para la pantalla de ajustes de la app móvil, con alertas de SLO sobre su latencia."];
    ok(apiOn.every((t) => onOf(t, "api")) && apiOff.every((t) => !onOf(t, "api")) &&
      mixed.every((t) => { const r = cls(t); return ["api", "ui", "obs"].every((tr) => r.tracks.includes(tr)); }) &&
      !onOf("Expose the admin page's API so the mobile app can fetch the same stats.", "ui") && !onOf("Backend for the profile page: the GET /me handler must return the avatar URL.", "ui"),
      "1.21 F2a: +api — 'our webhooks API needs a v2' (EN / PT / ES) is ours and versioned (strong); a third party's versioned API is not; the mixed case (a public API for the settings screen) is +api +ui +obs, while 'the admin page's API' still says backend-only (got " +
      js([apiOn.filter((t) => !onOf(t, "api")), apiOff.filter((t) => onOf(t, "api")), mixed.map((t) => cls(t).label)]) + ")");
    // precision / recall on a compact corpus: the 1.19 verification's misses and false positives (EN / PT / ES) with their hard negatives
    const F2 = [...uiOn.map((t) => ["ui", t]), ...uiOff.map((t) => ["", t]), ...apiOn.map((t) => ["api", t]), ...apiOff.map((t) => ["", t]),
      ...mixed.map((t) => ["api ui obs", t]), ...coordOff.filter(([tr]) => tr === "obs").map(([, t]) => ["", t]),
      ["obs", "Roll out the new pricing engine behind a feature flag to 5% of traffic, with a kill switch."], ["obs", "Implantação canário do novo motor de recomendações para 5% dos utilizadores."],
      ["obs", "Despliegue canario del nuevo motor de precios con plan de reversión."], ["obs", "No feature flags, just a canary release behind a manual switch."],
      ["", "Expose the admin page's API so the mobile app can fetch the same stats."], ["ui", "Settings page where users can change their notification preferences."],
      ["api", "Design a versioned REST API for partners with an OpenAPI document."], ["", "Fetch exchange rates from the ECB's API every morning."],
      ["ui", "Painel de administração para gerir utilizadores: pesquisa, filtros e desativação em massa."], ["", "Monitor stock levels and send alerts to the purchasing team."]];
    const f2 = ["api", "ui", "obs"].map((tr) => {
      let tp = 0, fp = 0, pos = 0;
      const wrong = [];
      for (const [labels, t] of F2) {
        const want = labels.split(" ").includes(tr), on = onOf(t, tr);
        if (want) pos++;
        if (on && want) tp++; else if (on) { fp++; wrong.push("FP +" + tr + " " + t); } else if (want) wrong.push("FN +" + tr + " " + t);
      }
      return { tr, precision: tp / (tp + fp || 1), recall: tp / (pos || 1), pos, wrong };
    });
    ok(F2.length >= 40 && f2.every((x) => x.pos >= 5 && x.precision >= 0.95 && x.recall >= 0.95),
      `1.21 F2a: precision / recall on ${F2.length} EN / PT / ES texts (the verification's misses and false positives + hard negatives) ≥ 95% per track — ` +
      f2.map((x) => `+${x.tr} ${(x.precision * 100).toFixed(0)}% / ${(x.recall * 100).toFixed(0)}% (${x.pos} positives)`).join(", ") + " (got " + js(f2.flatMap((x) => x.wrong)) + ")");
  }
};
