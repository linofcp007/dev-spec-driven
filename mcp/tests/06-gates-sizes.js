"use strict";
// Right-sized rigor (1.21 F5) — feature sizes (xs = a change · s · m · l), the size-aware scaffolds, the stricter filled rule,
// the n/a answer, the overlap registry, the plan approved in one call, the size suggestion; no size = the 1.20 scaffold.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

exports.run = async ({ ok, rpc, payload, S, tmp, list, require, __dirname }) => {
  const i18n = require("./lib/i18n.js");
  const rd = (dir, f) => fs.readFileSync(path.join(dir, f), "utf8");
  const wr = (dir, f, t) => fs.writeFileSync(path.join(dir, f), t);
  const has = (dir, f) => fs.existsSync(path.join(dir, f));
  const chk = (doc, id) => doc.checks.find((c) => c.id === id) || {};
  const stateOf = (dir) => JSON.parse(rd(dir, ".state.json"));
  const fresh = (name, lang) => { const p = path.join(tmp, "proj-121-f5-" + name); S.initProject(p, ["core"], lang || "en"); return p; };
  // The friction audit's filler: every template placeholder replaced with real text, each `> **TODO**` line answered by a line
  // of its own, every _Verify:_ a runnable command.
  let fillN = 0;
  const filler = (ph) => {
    const t = ph.replace(/^\[|\]$/g, "").trim();
    fillN++;
    if (/^N$|^\d+(\.\d+)?$/.test(t)) return "200";
    if (/path|\.\.\.|file|caminho|ruta/i.test(t)) return "src/feature/mod" + fillN + ".js";
    if (/command|comando/i.test(t)) return 'node -e "process.exit(0)"';
    return "concrete item " + fillN;
  };
  const fillText = (text) => {
    for (let round = 0; round < 4; round++) {
      const ph = S.placeholderReport(text);
      if (!ph.length) break;
      const lines = text.split("\n");
      for (const p of ph) {
        const i = p.line - 1;
        if (p.kind === "todo") { lines[i] = "Decided for this feature: the concrete answer written here."; continue; }
        const k = lines[i].indexOf(p.text);
        if (k >= 0) lines[i] = lines[i].slice(0, k) + filler(p.text) + lines[i].slice(k + p.text.length);
      }
      text = lines.join("\n");
    }
    return text.replace(/_Verify:[^\n]*_/g, '_Verify: node -e "process.exit(0)"_');
  };
  const fill = (dir, f) => { if (has(dir, f)) wr(dir, f, fillText(rd(dir, f))); };
  const writeTests = (p, dir, slug) => {
    const ids = [...new Set(rd(dir, "test-plan.md").match(/T-\d+/g) || [])];
    for (const sub of ["tests/unit", "tests/integration", "tests/e2e", "tests/contract", "tests/component", "tests/visual"]) {
      fs.mkdirSync(path.join(p, sub), { recursive: true });
      fs.writeFileSync(path.join(p, sub, slug + ".test.js"), ids.map((id) => `test("${id} behaves", () => {});`).join("\n") + "\n");
    }
  };
  // Every task ticked with a passing (or, _Expect: fail_, a red) run of its _Verify:_.
  const tickAll = (p, slug, file) => {
    const out = [];
    for (const b of S.taskBlocks(rd(path.join(p, ".specs", slug), file))) {
      if (b.done) continue;
      const cmd = (S.taskMarkers(b).verify || [])[0] || 'node -e "process.exit(0)"';
      out.push(S.completeTask(p, slug, b.number, S.expectsFail(b) ? { command: cmd, exitCode: 1, summary: "AssertionError: expected 1, got 2" } : { command: cmd, exitCode: 0, summary: "ok" }));
    }
    return out;
  };

  { // no size = the 1.20 scaffolds, byte for byte: every builder output of every pre-1.21 track combination (EN / PT / ES — pt-BR
    // derives from PT), hashed and pinned — the sha1 of the same outputs rendered by the engine before the sizes existed. Changed
    // ON PURPOSE since: bugTasks — every bugfix's tasks.md is the short form (the red regression test, the fix; no
    // reproduce / root-cause tasks — bug.md's gates hold them); was ba448c6e3d63408cfd7451b9b568673889a43e91. 1.25.1 review: ES says
    // "fichero" for a file (tasks.md's comment and parallel slot, the test plan's Fichero column, the integration plan's
    // heading); was 7b47ddfbbd0af1421ea315ecbdca5a1e65b5fadb.
    const TR = ["tdd", "saas", "ai", "sec", "privacy", "dist", "api", "ui", "obs"];
    const combos = [[], ...TR.map((t) => [t]), ...TR.flatMap((t, i) => TR.slice(i + 1).map((u) => [t, u])), TR].map((x) => ["core", ...x]);
    const label = (t) => t.map((x) => (x === "core" ? "core" : "+" + x)).join(" ");
    const res = {};
    for (const l of ["en", "pt", "es"]) {
      for (const tracks of combos) {
        const a = { name: "x", tracks, label: label(tracks), slug: "x", summary: "" };
        const k = l + ":" + tracks.join("+");
        res[k + ":classification"] = i18n.classification(a, l);
        res[k + ":requirements"] = i18n.requirements(a, l);
        res[k + ":design"] = i18n.design(a, l);
        res[k + ":tasks"] = i18n.tasks(a, l);
        res[k + ":testPlan"] = i18n.testPlan("x", l, tracks);
        res[k + ":checklist"] = i18n.checklist(a, l);
      }
      for (const tr of ["core", ...TR]) {
        res[l + ":block:" + tr] = i18n.trackDesignBlock(tr, l);
        res[l + ":taskBlock:" + tr] = i18n.msg(l).tracks.taskBlock(tr, 1);
      }
      res[l + ":bugReport"] = i18n.bugReport({ name: "x" }, l);
      res[l + ":bugRequirements"] = i18n.bugRequirements({ name: "x" }, l);
      res[l + ":bugTestPlan"] = i18n.bugTestPlan("x", l);
      res[l + ":bugTasks"] = i18n.bugTasks("x", l);
      res[l + ":quickstart"] = i18n.quickstart("x", l);
    }
    const keys = Object.keys(res).sort();
    const h = crypto.createHash("sha1");
    for (const k of keys) h.update(k + "\0" + res[k] + "\0");
    const got = h.digest("hex");
    // a feature created without a size: no size key, classification.md, the builders' own text (the scaffold path passes none)
    const p = fresh("nosize");
    const f = S.createFeature(p, "Plain", ["core", "sec"], "", undefined, "en");
    const same = rd(f.dir, "design.md") === i18n.design({ name: "Plain", tracks: ["core", "sec"], label: "core +sec" }, "en") &&
      rd(f.dir, "requirements.md") === i18n.requirements({ name: "Plain", tracks: ["core", "sec"], summary: "" }, "en");
    ok(got === "352db345bb4e29784823bc13ccc166d02077172b" && keys.length === 921 && f.ok && !("size" in stateOf(f.dir)) && f.size === undefined &&
      has(f.dir, "classification.md") && same,
      "1.21 F5: no size = the 1.20 scaffolds byte for byte (but the bugfix tasks.md, the short form on purpose) — the pinned sha1 of every no-size builder output of every pre-1.21 track combination (EN / PT / ES), and a create without a size writes no size key and the builders' own text (got " +
      JSON.stringify({ got, n: keys.length, state: stateOf(f.dir).size, same }) + ")");
  }

  { // every size, EN / PT / ES / pt-BR: scaffolds, every fresh artifact reads 'placeholder', gates as designed
    const MERGED = /^## (?:Decisions, reuse & risks|Decisões, reutilização e riscos|Decisiones, reutilización y riesgos)$/m;
    const SECCONS = /^## (?:Security Considerations|Considerações de Segurança|Consideraciones de Seguridad)$/m;
    const APICON = /^## (?:API Contracts|Contratos de API)$/m;
    const ERRH = /^## (?:Error Handling|Tratamento de Erros|Manejo de Errores)$/m;
    const TESTS = /^## (?:Testing Strategy|Estratégia de Testes|Estrategia de Pruebas)$/m;
    const got = [];
    let allOk = true;
    for (const lang of ["en", "pt", "es", "pt-BR"]) {
      const p = fresh("sizes-" + lang, lang);
      // size s — +tdd +saas +sec +obs: one story, no classification.md, the merged weigh section, the core tiers, overlaps
      const s = S.createFeature(p, "Small " + lang, ["core", "tdd", "saas", "sec", "obs"], "", undefined, lang, undefined, { size: "s" });
      const des = rd(s.dir, "design.md"), req = rd(s.dir, "requirements.md"), tasks = rd(s.dir, "tasks.md");
      const tb = S.taskBlocks(tasks);
      const heads = (des.match(/^## \[(?:SaaS|SEC|OBS)\] .*$/gm) || []);
      const doc = S.specDoctor(p, s.slug);
      const na = S.nextAction(p, s.slug);
      const sConds = [s.ok && s.size === "s" && stateOf(s.dir).size === "s" && !has(s.dir, "classification.md"), MERGED.test(des) && !SECCONS.test(des) && !APICON.test(des) && !TESTS.test(des),
        heads.length === 2 + 2 + 3 && !/^## \[SaaS\] (?:Performance Budget|Orçamento|Presupuesto|Observab)/m.test(des), /US-1\.AC-2\b/.test(req) && !/US-1\.AC-3\b|US-2\.AC-1/.test(req) &&
        /US-1\.AC-5\b/.test(req) && /US-1\.AC-31\b/.test(req), tb.length === 1 + 2 + 2 + 4 && tb.map((b) => b.number).join() === "1,2,3,4,5,6,7,8,9",
        ["requirements.md", "design.md", "tasks.md", "test-plan.md"].every((f) => S.artifactState({ file: path.join(s.dir, f) }) === "placeholder"),
        chk(doc, "placeholders").status === "fail" && doc.readyToAdvance === false, na.step === "fill" && !!na.fastForward && na.fastForward.through === "test-plan" &&
        na.fastForward.phases.join() === "requirements,design,test-plan", S.approvePhase(p, s.slug, "design", "t").failing.includes("placeholders")]; // (+tdd: the one call ends before Phase 4 — 1.21 review C3)
      const sOk = sConds.every(Boolean);
      if (!sOk) got.push({ lang, sConds, heads, tb: tb.length });
      // size m — +api +dist +saas +obs +tdd: the full chain, the overlaps and the superseded core sections left out
      const m = S.createFeature(p, "Medium " + lang, ["core", "tdd", "saas", "api", "dist", "obs"], "", undefined, lang, undefined, { size: "m" });
      const mdes = rd(m.dir, "design.md"), mtasks = rd(m.dir, "tasks.md");
      const mOk = m.ok && has(m.dir, "classification.md") && !MERGED.test(mdes) && !APICON.test(mdes) && !ERRH.test(mdes) && !TESTS.test(mdes) && SECCONS.test(mdes) &&
        /^## \[API\] (?:Pagination|Paginação|Paginación)/m.test(mdes) && /^## \[DIST\]/m.test(mdes) && (mdes.match(/<!-- [^\n]*\[(?:SaaS|API)\] /g) || []).length === 2 && // (1.21 review C8: +api / +dist keep both)
        !/Emit metrics, add dashboard|Emitir métricas, adicionar dashboard|Emitir métricas, añadir dashboard/.test(mtasks) && /US-2\.AC-1/.test(rd(m.dir, "requirements.md")) &&
        S.artifactState({ file: path.join(m.dir, "design.md") }) === "placeholder" && S.traceCheck(p, m.slug).uncoveredByTasks.length === 0;
      // size xs — a change: ONE change.md, placeholder, its plan approval refused while it is the template
      const x = S.createFeature(p, "Tiny " + lang, undefined, "", undefined, lang, undefined, { size: "xs" });
      const xOk = x.ok && x.kind === "change" && x.size === "xs" && x.created.join() === "change.md" && fs.readdirSync(x.dir).filter((n) => n.endsWith(".md")).join() === "change.md" &&
        S.artifactState({ file: path.join(x.dir, "change.md") }) === "placeholder" && S.approvePhase(p, x.slug, null, "t", { through: "tasks" }).failing.includes("placeholders");
      // an XS bugfix: two tasks (the red regression test, the fix) — the same tasks.md as a bugfix of no size (one builder)
      const b = S.createFeature(p, "Bug " + lang, undefined, "", undefined, lang, "bugfix", { size: "xs" });
      const bt = S.taskBlocks(rd(b.dir, "tasks.md"));
      const b0 = S.createFeature(p, "Bug0 " + lang, undefined, "", undefined, lang, "bugfix");
      const bOk = b.ok && b.kind === "bugfix" && stateOf(b.dir).size === "xs" && bt.length === 2 && S.expectsFail(bt[0]) && /T-01/.test(S.taskMarkers(bt[1])["makes green"].join()) &&
        b0.ok && rd(b0.dir, "tasks.md").replace("Bug0 " + lang, "N") === rd(b.dir, "tasks.md").replace("Bug " + lang, "N");
      got.push({ lang, sOk, mOk, xOk, bOk });
      allOk = allOk && sOk && mOk && xOk && bOk;
    }
    ok(allOk, "1.21 F5: every size scaffolds in EN / PT / ES / pt-BR — s: one story (AC-1 WHEN, AC-2 IF…THEN + every track criterion), no classification.md, the merged 'Decisions, reuse & risks', only the core-tier track sections, [SaaS] Performance Budget / Observability left to [OBS], a track task per criterion (9 tasks), every artifact 'placeholder', next_action fill + fastForward through test-plan (+tdd: Phase 4 after the plan); m: the full chain with [API] Pagination kept beside [DIST], the core API Contracts / Error Handling / Testing Strategy left out, no duplicate +saas telemetry task, trace covered; xs: ONE change.md; an XS bugfix: two tasks, the tasks.md of a bugfix of no size (got " +
      JSON.stringify(got) + ")");
  }

  { // gates as designed: a filled size S feature finishes with ONE planning approval call; a filled size M feature phase by phase
    const p = fresh("drive");
    const s = S.createFeature(p, "Export csv", ["core", "tdd", "sec"], "add a CSV export button", undefined, "en", undefined, { size: "s" });
    ["requirements.md", "design.md", "test-plan.md", "tasks.md"].forEach((f) => fill(s.dir, f));
    writeTests(p, s.dir, s.slug);
    const ff = S.approvePhase(p, s.slug, null, "t", { through: "tasks" });
    const ticks = tickAll(p, s.slug, "tasks.md");
    const fin = S.finishFeature(p, s.slug, { write: true });
    const ex = S.approvePhase(p, s.slug, "execution", "t");
    const doc = S.specDoctor(p, s.slug);
    const m = S.createFeature(p, "Payments", ["core", "saas", "obs"], "", undefined, "pt", undefined, { size: "m" });
    ["classification.md", "requirements.md", "design.md", "tasks.md"].forEach((f) => fill(m.dir, f));
    const steps = ["classification", "requirements", "design", "tasks"].map((ph) => S.approvePhase(p, m.slug, ph, "t"));
    const mDoc = S.specDoctor(p, m.slug);
    const saas = chk(mDoc, "saas-sections");
    ok(ff.ok && ff.approved.join() === "requirements,design,test-plan,tests,tasks" && ticks.every((t) => t.ok && t.verified) && fin.readyToFinish && ex.ok &&
      doc.verdict !== "fail" && chk(doc, "sec-sections").status === "pass" && ["design-tradeoffs", "design-risks", "design-reuse"].every((id) => chk(doc, id).status === "pass") &&
      steps.every((a) => a.ok) && saas.status === "pass" && /cobertas pela secção de outro track: 2/.test(saas.detail) &&
      S.statusFeature(p, m.slug).scaleSections.filter((r) => r.status === "covered").map((r) => r.section).join() === "Performance Budget,Observability",
      "1.21 F5: gates as designed — a filled size S feature approves its whole plan in ONE call (requirements → design → test-plan → tests → tasks, each gate run), ticks with evidence, finishes and is signed off; the merged weigh section passes the three weigh checks; a filled size M feature (PT) approves phase by phase and its [SaaS] Performance Budget / Observability read 'covered' by the [OBS] sections (got " +
      JSON.stringify({ ff: ff.approved || ff.failing, fin: fin.blockers, ex: ex.error, doc: doc.checks.filter((c) => c.status === "fail").map((c) => c.id), steps: steps.map((a) => a.failing || a.ok), saas: saas.detail }) + ")");
  }

  { // the n/a rule (size s): an extended section may be absent or answered by ONE "n/a — <reason of 4+ words>" line; core ones must be filled
    const res = [];
    for (const [lang, na, short] of [["en", "n/a — the page is server-rendered, no asset added.", "n/a — no."], ["pt", "Não se aplica — a página é gerada no servidor, sem novos recursos.", "n/a"],
      ["es", "No aplica — la página se genera en el servidor, sin recursos nuevos.", "N/A: nada"]]) {
      const p = fresh("na-" + lang, lang);
      const f = S.createFeature(p, "Page " + lang, ["core", "ui"], "", undefined, lang, undefined, { size: "s" });
      const base = rd(f.dir, "design.md").split("\n").map((l) => (/^> \*\*TODO\*\*/.test(l) ? "Decided for this feature: the concrete answer written here." : l)).join("\n");
      const ext = { en: "## [UI] UI Performance Budget", pt: "## [UI] Orçamento de Desempenho da Interface", es: "## [UI] Presupuesto de Rendimiento de la Interfaz" }[lang];
      const run = (text) => { wr(f.dir, "design.md", text); return chk(S.specDoctor(p, f.slug), "ui-sections"); };
      const absent = run(base);
      const answered = run(base + "\n" + ext + "\n" + na + "\n");
      const tooShort = run(base + "\n" + ext + "\n" + short + "\n");
      const todo = run(base + "\n" + ext + "\n> **TODO** — later.\n");
      const coreNa = run(base.replace(/(## \[UI\] [^\n]*\n)Decided for this feature: the concrete answer written here\./, "$1" + na)); // a core section answered n/a: its own text
      res.push({ lang, absent: absent.status, answered: answered.status, tooShort: [tooShort.status, tooShort.detail], todo: todo.status, coreNa: coreNa.status });
    }
    // the same design, no size: an extended section is mandatory again (1.20 rules) and an n/a line is just text
    const p = fresh("na-nosize");
    const f = S.createFeature(p, "Page", ["core", "ui"], "", undefined, "en");
    const filled = rd(f.dir, "design.md").split("\n").map((l) => (/^> \*\*TODO\*\*/.test(l) ? "Decided for this feature: the concrete answer written here." : l)).join("\n");
    wr(f.dir, "design.md", filled.replace(/## \[UI\] UI Performance Budget\n[\s\S]*?(?=\n## |\n<!--)/, "## [UI] UI Performance Budget\nn/a\n"));
    const unsized = chk(S.specDoctor(p, f.slug), "ui-sections");
    wr(f.dir, "design.md", filled.replace(/## \[UI\] UI Performance Budget\n[\s\S]*?(?=\n## |\n<!--)/, ""));
    const unsizedGone = chk(S.specDoctor(p, f.slug), "ui-sections");
    ok(res.every((r) => r.absent === "pass" && r.answered === "pass" && r.tooShort[0] === "fail" && r.todo === "fail" && r.coreNa === "pass") &&
      /n\/a without a reason \(4\+ words\)/.test(res[0].tooShort[1]) && /n\/a sem uma razão/.test(res[1].tooShort[1]) && /n\/a sin una razón/.test(res[2].tooShort[1]) &&
      unsized.status === "pass" && unsizedGone.status === "fail" && /UI Performance Budget:missing/.test(unsizedGone.detail),
      "1.21 F5: the n/a rule at size s (EN / PT / ES) — an extended section absent passes, answered by one 'n/a — <reason of 4+ words>' / 'Não se aplica — …' / 'No aplica — …' line passes, a shorter n/a fails (na-short, named), a TODO fails; no size: the section is mandatory as in 1.20 and an n/a line is plain text (got " +
      JSON.stringify({ res, unsized: unsized.status, gone: unsizedGone.detail }) + ")");
  }

  { // the stricter filled rule (every size and no size): the template's guidance line alone is not an answer — a new approval refuses
    // it; a design approved already only warns (never a phase failed retroactively), and nothing else about it changes
    const p = fresh("strict");
    const f = S.createFeature(p, "Login", ["core", "sec"], "", undefined, "en");
    fill(f.dir, "classification.md");
    fill(f.dir, "requirements.md");
    const design = fillText(rd(f.dir, "design.md").split("\n").filter((l) => !/^> \*\*TODO\*\*/.test(l)).join("\n")) + "\n"; // the core slots filled, TODO lines gone
    const guidanceOnly = design; // the TODO lines deleted, the guidance bullets kept
    wr(f.dir, "design.md", guidanceOnly);
    const d1 = chk(S.specDoctor(p, f.slug), "sec-sections");
    const save = S.designSaveCheck(p, f.slug);
    // one guidance bullet edited = the user's text; one own line added under another = filled
    const edited = guidanceOnly.replace(/^- Assets · actors · trust boundaries[^\n]*$/m, "- Assets: the session cookie; actors: anonymous users and admins.")
      .replace(/(## \[SEC\] Security Requirements\n- [^\n]*\n)/, "$1ASVS L2: the admin area handles personal data.\n");
    wr(f.dir, "design.md", edited);
    const d2 = S.specDoctor(p, f.slug).checks.find((c) => c.id === "sec-sections");
    // the 1.20 case: a design approved with guidance-only sections (its approval recorded over this very content) → a warn
    wr(f.dir, "design.md", guidanceOnly);
    const stp = path.join(f.dir, ".state.json");
    const state = stateOf(f.dir);
    const fp = (text) => crypto.createHash("sha1").update(text.replace(/\r\n/g, "\n")).digest("hex");
    state.approvals.classification = { at: "2026-09-01T00:00:00.000Z", by: "old", fingerprint: fp(rd(f.dir, "classification.md")) };
    state.approvals.requirements = { at: "2026-09-01T00:00:00.000Z", by: "old", fingerprint: fp(rd(f.dir, "requirements.md")) };
    state.approvals.design = { at: "2026-09-01T00:00:00.000Z", by: "old", fingerprint: fp(guidanceOnly), weigh: true, reuse: true };
    fs.writeFileSync(stp, JSON.stringify(state, null, 2));
    const d3doc = S.specDoctor(p, f.slug);
    const d3 = chk(d3doc, "sec-sections");
    const na3 = S.nextAction(p, f.slug);
    const reapprove = S.approvePhase(p, f.slug, "design", "t");
    ok(d1.status === "fail" && /Threat Model:only the template's guidance/.test(d1.detail) && save.clean === false && save.sections.length === 1 &&
      d2.status === "fail" && !/Threat Model/.test(d2.detail) && !/Security Requirements/.test(d2.detail) && /Authentication & Authorization:only the template's guidance/.test(d2.detail) &&
      d3.status === "warn" && /approved before 1\.21's stricter rule/.test(d3.detail) && !d3doc.changedSinceApproval && d3doc.readyToAdvance === true &&
      na3.step !== "fix" && (na3.changedSinceApproval || []).length === 0 && reapprove.ok === false && reapprove.failing.includes("sec-sections"),
      "1.21 F5: the stricter filled rule — the TODO line deleted and the guidance bullet kept is 'only the template's guidance': doctor fails and the save check lists it; a bullet edited or a line of one's own fills the section; a design approved with such sections (the 1.20 case) only warns — ready to advance, no change since approval, next_action doesn't send it back — while a NEW approval refuses it (got " +
      JSON.stringify({ d1: d1.detail, d2: d2.detail, d3: [d3.status, d3.detail], na: na3.step, re: reapprove.failing }) + ")");
  }

  { // the overlap registry: a sized design that keeps both headings is judged on each; data sanity; an unsized one is unaffected
    const p = fresh("overlap");
    const f = S.createFeature(p, "Obs", ["core", "saas", "obs"], "", undefined, "en", undefined, { size: "m" });
    const filled = rd(f.dir, "design.md").split("\n").map((l) => (/^> \*\*TODO\*\*/.test(l) ? "Decided for this feature: the concrete answer written here." : l)).join("\n");
    wr(f.dir, "design.md", filled);
    const covered = chk(S.specDoctor(p, f.slug), "saas-sections");
    wr(f.dir, "design.md", filled + "\n## [SaaS] Observability\n> **TODO** — later.\n");
    const ownTodo = chk(S.specDoctor(p, f.slug), "saas-sections");
    wr(f.dir, "design.md", filled + "\n## [SaaS] Observability\nThe tenant dashboards: p95 per tenant, error budget per plan.\n");
    const ownFilled = chk(S.specDoctor(p, f.slug), "saas-sections");
    wr(f.dir, "design.md", filled.replace(/## \[OBS\] Telemetry\n[\s\S]*?(?=\n## )/, "").replace(/## \[OBS\] Alerting & Runbooks\n[\s\S]*?(?=\n## )/, ""));
    const noCover = chk(S.specDoctor(p, f.slug), "saas-sections");
    // unsized: no overlap applies — the 1.20 rule (a deleted [SaaS] Observability is missing even beside [OBS] Telemetry)
    const u = S.createFeature(p, "Obs plain", ["core", "saas", "obs"], "", undefined, "en");
    const ufilled = rd(u.dir, "design.md").split("\n").map((l) => (/^> \*\*TODO\*\*/.test(l) ? "Decided for this feature: the concrete answer written here." : l)).join("\n");
    wr(u.dir, "design.md", ufilled.replace(/## \[SaaS\] Observability\n[\s\S]*?(?=\n## )/, ""));
    const unsized = chk(S.specDoctor(p, u.slug), "saas-sections");
    const marker = S.VALID_TRACKS.filter((t) => S.trackSections(t));
    const tiers = marker.map((t) => [t, S.trackSections(t).filter((s) => s.tier !== "extended").length]);
    const known = (t, n) => (S.trackSections(t) || []).some((s) => s.name === n);
    ok(covered.status === "pass" && ownTodo.status === "fail" && /Observability:unfilled/.test(ownTodo.detail) && ownFilled.status === "pass" &&
      noCover.status === "fail" && /Observability:missing/.test(noCover.detail) && unsized.status === "fail" && /Observability:missing/.test(unsized.detail) &&
      tiers.every(([, n]) => n >= 2) && S.TRACK_OVERLAPS.every((o) => known(...o.drop) && o.by.every(([t, n]) => known(t, n))) &&
      S.TRACK_TASK_OVERLAPS.every((o) => S.VALID_TRACKS.includes(o.drop[0]) && S.VALID_TRACKS.includes(o.by)),
      "1.21 F5: overlaps (sized) — [SaaS] Observability left to the [OBS] sections reads covered; kept with a TODO it fails on its own, filled it passes; with no covering section left it is missing; no size: no overlap applies (1.20); the registries are sound data (every track keeps ≥ 2 core-tier sections, every overlap names real sections) (got " +
      JSON.stringify({ covered: covered.detail, ownTodo: ownTodo.detail, noCover: noCover.detail, unsized: unsized.detail, tiers }) + ")");
  }

  { // the change kind end to end: create → fill → approve the plan (one call) → tick with evidence → finish → the execution sign-off
    const p = fresh("change");
    const c = S.createFeature(p, "Footer typo", undefined, "fix a typo in the footer", undefined, "en", "change");
    const fileTxt = "# Change: footer typo\n\n## Summary\nThe footer says \"Copyrigth\"; it must say \"Copyright\".\n\n## Acceptance Criteria (EARS)\n" +
      "1. **US-1.AC-1** — WHEN any page renders THE SYSTEM SHALL show the footer text \"Copyright 2026 Acme\".\n\n## Approach\nOne string in templates/footer.html.\n\n" +
      "## Tasks\n- [ ] 1. [US1] Fix the footer string in templates/footer.html\n  - _Requirements: US-1.AC-1_\n  - _Verify: node -e \"process.exit(0)\"_\n";
    const na0 = S.nextAction(p, c.slug);
    wr(c.dir, "change.md", fileTxt);
    const d1 = S.specDoctor(p, c.slug);
    const na1 = S.nextAction(p, c.slug);
    const reqRefused = S.approvePhase(p, c.slug, "requirements", "t");
    const ff = S.approvePhase(p, c.slug, null, "t", { through: "tasks" });
    const tick = S.completeTask(p, c.slug, 1, { command: 'node -e "process.exit(0)"', exitCode: 0, summary: "ok" });
    const ticked = /^- \[x\] 1\. /m.test(rd(c.dir, "change.md")) && !has(c.dir, "tasks.md") && !has(c.dir, "requirements.md");
    const fin = S.finishFeature(p, c.slug, { write: true });
    const ex = S.approvePhase(p, c.slug, "execution", "t");
    const st = S.statusFeature(p, c.slug);
    const tr = S.traceCheck(p, c.slug);
    const exp = S.exportSpecs(p, c.slug, { format: "md" });
    wr(c.dir, "change.md", rd(c.dir, "change.md") + "\nOne more line.\n");
    const naEdit = S.nextAction(p, c.slug);
    const listed = S.listFeatures(p).features.find((x) => x.name === c.slug);
    ok(c.ok && c.kind === "change" && c.size === "xs" && na0.step === "fill" && na0.file === "change.md" && /through: "tasks"/.test(na0.recommendation) &&
      d1.verdict !== "fail" && chk(d1, "change-scope").status === "pass" && !chk(d1, "design").id && !chk(d1, "success-criteria").id && na1.step === "approve" &&
      reqRefused.ok === false && reqRefused.change === true && ff.ok && ff.approved.join() === "tasks" && tick.ok && tick.verified && ticked &&
      fin.readyToFinish && /change\.md/.test(fin.mergeSummary || "") === false && ex.ok && st.kind === "change" && st.phase === "complete" && tr.verdict === "pass" && tr.totalAcs === 1 &&
      exp.ok !== false && naEdit.step === "re-review" && naEdit.changedSinceApproval.join() === "change.md" && listed.kind === "change",
      "1.21 F5: the change kind end to end — ONE change.md; next_action fill change.md (then the plan in one call) → approve → the plan approved with spec_approve {through: 'tasks'} (the requirements phase refused: a change has none), the task ticked IN change.md with its run (verified), trace passes, finish ready, the execution signed off; an edit after the approval asks a re-review of change.md (got " +
      JSON.stringify({ na0: [na0.step, na0.file], d1: d1.checks.filter((x) => x.status !== "pass").map((x) => x.id), ff: ff.approved || ff.failing, tick: tick.error, fin: fin.blockers, ex: ex.error, st: st.phase, naEdit: naEdit.changedSinceApproval }) + ")");
    // never ratcheted silently: a fourth task, a track, another size, add_track
    const big = S.createFeature(p, "Too big", undefined, "x", undefined, "en", "change");
    wr(big.dir, "change.md", fileTxt.replace("## Tasks\n", "## Tasks\n- [ ] 2. [US1] a\n  - _Requirements: US-1.AC-1_\n- [ ] 3. [US1] b\n  - _Requirements: US-1.AC-1_\n- [ ] 4. [US1] c\n  - _Requirements: US-1.AC-1_\n"));
    const bigAp = S.approvePhase(p, big.slug, null, "t", { through: "tasks" });
    const bigDoc = chk(S.specDoctor(p, big.slug), "change-scope");
    const withTrack = S.createFeature(p, "Tracked", ["core", "sec"], "x", undefined, "en", "change");
    const wrongSize = S.createFeature(p, "Wrong size", undefined, "x", undefined, "en", "change", { size: "s" });
    const spike = S.createFeature(p, "Sized spike", undefined, "x", undefined, "en", "spike", { size: "s" });
    const badSize = S.createFeature(p, "Bad size", undefined, "x", undefined, "en", undefined, { size: "xl" });
    const addTr = S.addTrack(p, c.slug, "sec");
    const kept = S.createFeature(p, "Footer typo", undefined, "", undefined, "en", undefined, { size: "m" });
    ok(bigAp.ok === false && bigAp.failing.includes("change-scope") && bigDoc.status === "fail" && /4 task\(s\)/.test(bigDoc.detail) && /size s/.test(bigDoc.detail) &&
      withTrack.ok === false && /\+sec/.test(withTrack.error) && !fs.existsSync(path.join(p, ".specs", "tracked")) && wrongSize.ok === false && /size xs/.test(wrongSize.error) &&
      spike.ok === false && /not sized/.test(spike.error) && badSize.ok === false && /size must be one of: xs, s, m, l/.test(badSize.error) && addTr.ok === false && addTr.change === true &&
      kept.ok && stateOf(c.dir).size === "xs" && /size is xs — kept it/.test(kept.note || ""),
      "1.21 F5: a change stays XS, never silently — four tasks: the plan approval refuses and doctor fails change-scope (named, 'size s'); a track, kind change with size s, a sized spike, an unknown size and add_track on a change are refused before any write; a re-create keeps the size (a note) (got " +
      JSON.stringify({ bigAp: bigAp.failing, bigDoc: bigDoc.detail, withTrack: withTrack.error, wrongSize: wrongSize.error, spike: spike.error, badSize: badSize.error, addTr: addTr.error, kept: kept.note }).slice(0, 1400) + ")");
  }

  { // an XS bugfix keeps the iron law: only task 1 (the red regression test) can be ticked while bug.md → Root Cause is empty
    const p = fresh("xsbug");
    const b = S.createFeature(p, "Crash on save", undefined, "", undefined, "en", "bugfix", { size: "xs" });
    const fix = S.completeTask(p, b.slug, 2, { command: 'node -e "process.exit(0)"', exitCode: 0, summary: "ok" });
    const red = S.completeTask(p, b.slug, 1, { command: 'node -e "process.exit(1)"', exitCode: 1, summary: "AssertionError: expected saved, got crash" });
    wr(b.dir, "bug.md", rd(b.dir, "bug.md").replace(/> \*\*TODO\*\* — the cause[^\n]*/, "save.js:88 dereferences a null draft when the form is empty — the stack trace shows it."));
    const fix2 = S.completeTask(p, b.slug, 2, { command: 'node -e "process.exit(0)"', exitCode: 0, summary: "ok" });
    const des = S.approvePhase(p, b.slug, "design", "t", { force: true });
    ok(fix.ok === false && fix.gated === "root-cause" && /only task 1 can be completed/.test(fix.error) && red.ok && red.redRecorded && fix2.ok && des.ok,
      "1.21 F5: an XS bugfix (no reproduce / root-cause tasks) keeps the iron law — the fix (task 2) is refused while bug.md → Root Cause is empty, the red regression test (task 1) is not; once the cause is written the fix ticks (got " +
      JSON.stringify({ fix: fix.error, red: red.error, fix2: fix2.error }) + ")");
  }

  { // spec_classify suggests a size with a reason (EN / PT / ES) — deterministic, never the track count alone; never applied by itself
    const cases = [["fix a typo in the footer", "xs", "trivial-change"], ["add a CSV export button to the orders page", "s", "single-unit"],
      ["add a GET endpoint returning a user's orders", "s", "single-unit"], ["Stripe checkout for subscriptions", "m", "default"],
      ["an LLM summary of support tickets", "m", "default"], ["a public REST API v2 with rate limits and SLO alerts", "l", "several-tracks"],
      ["corrigir uma gralha no rodapé", "xs", "trivial-change"], ["Añadir una pantalla de administración para gestionar roles y permisos de los usuarios", "s", "single-unit"],
      ["corregir una errata en el pie de página", "xs", "trivial-change"], ["Permitir aos clientes exportar e apagar os seus dados pessoais (RGPD), com registo de consentimento", "m", "default"]];
    const got = cases.map(([t]) => { const r = S.classify(t, {}); return [r.suggestedSize, r.sizeReason, r.sizeNote]; });
    const p = fresh("suggest");
    const created = S.createFeature(p, "Typo", undefined, "fix a typo in the footer", undefined, "en");
    ok(got.every((g, i) => g[0] === cases[i][1] && g[1] === cases[i][2] && typeof g[2] === "string" && /spec_create \{size/.test(g[2])) &&
      /^Tamanho sugerido xs/.test(got[6][2]) && /^Tamaño sugerido s/.test(got[7][2]) && created.ok && created.kind === "feature" && !("size" in stateOf(created.dir)),
      "1.21 F5: spec_classify suggests a size (suggestedSize · stable sizeReason · a localized sizeNote) — a typo xs, one button / endpoint / screen s, a feature m, three tracks l, in EN / PT / ES; spec_create without a size never applies it (got " +
      JSON.stringify(got.map((g) => g.slice(0, 2))) + ")");
  }

  { // spec_upgrade is unaffected: it never assigns a size, and audits sized features and changes like any other
    const p = fresh("upgrade");
    const a = S.createFeature(p, "Old style", ["core"], "", undefined, "en");
    const b = S.createFeature(p, "Sized", ["core"], "", undefined, "en", undefined, { size: "s" });
    const c = S.createFeature(p, "A change", undefined, "", undefined, "en", "change");
    const audit = S.specUpgrade(p, {});
    const applied = S.specUpgrade(p, { apply: true });
    ok(audit.ok && applied.ok && !("size" in stateOf(a.dir)) && stateOf(b.dir).size === "s" && stateOf(c.dir).size === "xs" && stateOf(c.dir).kind === "change" &&
      audit.features.length === 3 && audit.features.every((f) => !f.error),
      "1.21 F5: spec_upgrade (audit and apply) never assigns a size — an unsized feature stays unsized, a sized one and a change keep theirs, all three audited without error (got " +
      JSON.stringify({ a: stateOf(a.dir).size, feats: (audit.features || []).map((f) => [f.name, f.status, f.error]) }) + ")");
  }

  { // MCP: spec_create's schema (size enum, kind change) and the call; spec_classify's suggestedSize — the same engine as the CLI
    const tool = list.result.tools.find((t) => t.name === "spec_create");
    const p = fresh("mcp");
    const viaMcp = payload(await rpc("tools/call", { name: "spec_create", arguments: { projectDir: p, name: "Mcp small", tracks: ["core", "ui"], size: "S", lang: "es" } }));
    const viaEngine = S.createFeature(p, "Engine small", ["core", "ui"], "", undefined, "es", undefined, { size: "s" });
    const sameText = (f) => rd(viaMcp.dir, f).replace(/Mcp small/g, "X") === rd(viaEngine.dir, f).replace(/Engine small/g, "X");
    const change = payload(await rpc("tools/call", { name: "spec_create", arguments: { projectDir: p, name: "Mcp change", kind: "change" } }));
    const cls = payload(await rpc("tools/call", { name: "spec_classify", arguments: { description: "fix a typo in the footer" } }));
    ok(JSON.stringify(tool.inputSchema.properties.size.enum) === JSON.stringify(["xs", "s", "m", "l"]) && tool.inputSchema.properties.kind.enum.includes("change") &&
      viaMcp.ok && viaMcp.size === "s" && ["requirements.md", "design.md", "tasks.md", "checklist.md"].every(sameText) && change.ok && change.kind === "change" &&
      change.created.join() === "change.md" && cls.suggestedSize === "xs" && cls.sizeReason === "trivial-change",
      "1.21 F5: MCP — spec_create advertises size (xs · s · m · l, case-folded: 'S') and kind 'change'; the call scaffolds exactly what the engine does (ES, size s); kind change writes one change.md; spec_classify returns suggestedSize / sizeReason (got " +
      JSON.stringify({ size: viaMcp.size, err: viaMcp.error, change: change.created, cls: [cls.suggestedSize, cls.sizeReason] }) + ")");
  }

  // --- 1.21 review C — right-sized rigor (F5), the independent review's findings ---
  const CHANGE_HEAD = "# Change: footer\n\n## Summary\nFix the footer text and its year.\n\n## Acceptance Criteria (EARS)\n" +
    "1. **US-1.AC-1** — WHEN any page renders THE SYSTEM SHALL show the footer text \"Copyright\".\n" +
    "2. **US-1.AC-2** — WHEN the footer renders THE SYSTEM SHALL show the year 2026.\n\n## Approach\nTwo strings in templates/footer.html.\n\n## Tasks\n";
  const changeTask = (n, reqs, extra = "") => `- [ ] ${n}. [US1] Fix string ${n}${extra}\n  - _Requirements: ${reqs}_\n  - _Verify: node -e "process.exit(0)"_\n`;
  const OK_RUN = { command: 'node -e "process.exit(0)"', exitCode: 0, summary: "ok" };

  { // C1 — a change's traceability can fail: change.md is read as two views, its criteria WITHOUT the task blocks and the task
    // blocks alone — a task's _Requirements:_ reference never defines a criterion, and a criterion never covers itself
    const p = fresh("c1");
    const c = S.createFeature(p, "Footer", undefined, "x", undefined, "en", "change");
    wr(c.dir, "change.md", CHANGE_HEAD + changeTask(1, "US-1.AC-1")); // (a) AC-2 cited by no task
    const tr1 = S.traceCheck(p, c.slug);
    const doc1 = chk(S.specDoctor(p, c.slug), "traceability");
    const ap1 = S.approvePhase(p, c.slug, null, "t", { through: "tasks" });
    wr(c.dir, "change.md", CHANGE_HEAD.replace(/2\. \*\*US-1\.AC-2\*\*[^\n]*\n/, "") + changeTask(1, "US-1.AC-1, US-1.AC-7")); // (b) a phantom US-1.AC-7
    const tr2 = S.traceCheck(p, c.slug);
    const scope2 = chk(S.specDoctor(p, c.slug), "change-scope");
    const ap2 = S.approvePhase(p, c.slug, null, "t", { through: "tasks" });
    const mx2 = S.traceMatrix(p, c.slug);
    // (c) a task line that reads like a criterion (a modal verb) is never linted as one; the views keep every line number
    const modal = CHANGE_HEAD + changeTask(1, "US-1.AC-1", " — THE SYSTEM SHALL render it") + changeTask(2, "US-1.AC-2");
    wr(c.dir, "change.md", modal);
    const v = S.changeViews(modal);
    const ears = S.earsFeature(p, c.slug);
    const tr3 = S.traceCheck(p, c.slug);
    const ap3 = S.approvePhase(p, c.slug, null, "t", { through: "tasks" });
    const n = modal.split("\n").length;
    ok(tr1.verdict === "gaps-found" && tr1.uncoveredByTasks.join() === "US-1.AC-2" && tr1.totalAcs === 2 && doc1.status === "fail" && ap1.ok === false && ap1.failing.includes("traceability") &&
      tr2.verdict === "gaps-found" && tr2.phantomAcsInTasks.join() === "US-1.AC-7" && tr2.totalAcs === 1 && /XS: 1 criteria/.test(scope2.detail) && ap2.ok === false && ap2.failing.includes("traceability") &&
      mx2.rows.map((r) => r.id).join() === "US-1.AC-1" &&
      v.criteria.split("\n").length === n && v.tasks.split("\n").length === n && !/- \[ \] \d/.test(v.criteria) && !/US-1\.AC-1\*\*/.test(v.tasks) && /- \[ \] 2\. /.test(v.tasks) &&
      ears.summary.criteriaDetected === 2 && ears.issues.length === 0 && tr3.verdict === "pass" && ap3.ok,
      "1.21 review C1: a change's traceability can fail — AC-2 cited by no task: trace gaps-found, doctor fails, the plan approval refuses (traceability); a task citing a phantom US-1.AC-7: a phantom gap, change-scope counts 1 criterion (not 2), refused, the matrix has one row; changeViews keeps every line (the criteria without the task blocks, the task blocks alone); a task with a modal verb is never linted as a criterion (EARS: 2 criteria, no issue); written right, trace passes and the plan is approved (got " +
      JSON.stringify({ tr1: [tr1.verdict, tr1.uncoveredByTasks], ap1: ap1.failing, tr2: [tr2.phantomAcsInTasks, tr2.totalAcs], scope2: scope2.detail, ears: ears.summary, tr3: tr3.verdict, ap3: ap3.failing || ap3.ok }) + ")");
    // the pre-commit validator traces the STAGED change.md (a mirror with .state.json): a staged phantom blocks, never "traceability clean"
    const { spawnSync } = require("child_process");
    if (spawnSync("git", ["--version"], { encoding: "utf8" }).status !== 0) console.log("  skip - git not available: 1.21 review C1 pre-commit not run");
    else {
      const repo = fresh("c1-git");
      const g = S.createFeature(repo, "Footer", undefined, "x", undefined, "en", "change");
      wr(g.dir, "change.md", CHANGE_HEAD.replace(/2\. \*\*US-1\.AC-2\*\*[^\n]*\n/, "") + changeTask(1, "US-1.AC-1, US-1.AC-7"));
      const git = (...a) => spawnSync("git", a, { cwd: repo, encoding: "utf8" });
      git("init", "-q");
      git("add", "-A");
      const pc = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "precommit-check.js")], { cwd: repo, encoding: "utf8" });
      ok(pc.status === 1 && /change\.md: 1 phantom AC\/test reference\(s\)[^\n]*US-1\.AC-7/.test(pc.stdout) && !/traceability clean|all \d+ ACs covered/i.test(pc.stdout),
        "1.21 review C1: the pre-commit validator blocks a staged change.md whose task cites a phantom AC (it printed 'traceability clean') (got " + JSON.stringify([pc.status, pc.stdout.slice(0, 400), String(pc.stderr).slice(0, 300)]) + ")");
    }
  }

  { // C2 — fenced code the user wrote is the user's answer: a section holding only a ```json / ```yaml / ```mermaid block is filled
    // (unsized: the 1.20 verdict; sized too) — "template" only when what remains is exactly the template's own lines
    const fenced = [];
    for (const l of ["en", "pt", "es", "pt-BR"]) for (const t of S.VALID_TRACKS) if (/```|~~~/.test(i18n.trackDesignBlock(t, l))) fenced.push(l + ":" + t);
    const p = fresh("c2");
    const got = [];
    for (const size of [undefined, "m", "s"]) {
      const f = S.createFeature(p, "Data " + (size || "none"), ["core", "data"], "", undefined, "en", undefined, size ? { size } : undefined);
      const filled = rd(f.dir, "design.md").split("\n").map((x) => (/^> \*\*TODO\*\*/.test(x) ? "Decided for this feature: the concrete answer written here." : x)).join("\n");
      const put = (body) => { wr(f.dir, "design.md", filled.replace(/(## \[DATA\] Data Contracts & Schema Evolution\n)[\s\S]*?(?=\n## |\n<!--)/, "$1" + body)); return chk(S.specDoctor(p, f.slug), "data-sections"); };
      const row = { size: size || "none" };
      row.json = put("```json\n{ \"type\": \"object\", \"required\": [\"id\"] }\n```\n").status;
      row.yaml = put("```yaml\nopenapi: 3.1.0\ninfo:\n  title: orders\n```\n").status;
      row.mermaid = put("```mermaid\nerDiagram\n  ORDER ||--o{ LINE : has\n```\n").status;
      row.emptyFence = put("```json\n```\n").status; // an empty block answers nothing
      put("```json\n{ \"type\": \"object\" }\n```\n");
      row.approve = S.approvePhase(p, f.slug, "design", "t", { force: false }).failing || [];
      got.push(row);
    }
    ok(!fenced.length && got.every((r) => r.json === "pass" && r.yaml === "pass" && r.mermaid === "pass" && r.emptyFence === "fail" && !r.approve.includes("data-sections")),
      "1.21 review C2: a [DATA] Data Contracts section answered only by a ```json schema, an OpenAPI ```yaml or a ```mermaid diagram is the user's own content — pass, unsized (as in 1.20) and sized (m, s), and the design approval doesn't refuse it on data-sections; an empty fence answers nothing; no built-in track block holds a fence (got " +
      JSON.stringify({ fenced, got }) + ")");
  }

  { // C3 — the plan in one call at size s with +tdd / +ai ends BEFORE Phase 4 (its gate needs the written failing tests / eval sets)
    const p = fresh("c3");
    const s = S.createFeature(p, "Export csv", ["core", "tdd", "sec"], "add a CSV export button", undefined, "en", undefined, { size: "s" });
    const na0 = S.nextAction(p, s.slug);
    ["requirements.md", "design.md", "test-plan.md", "tasks.md"].forEach((f) => fill(s.dir, f));
    const na1 = S.nextAction(p, s.slug);
    const ff = S.approvePhase(p, s.slug, null, "t", { through: (na1.fastForward || {}).through || "tasks" });
    const na2 = S.nextAction(p, s.slug);
    writeTests(p, s.dir, s.slug);
    const tests = S.approvePhase(p, s.slug, "tests", "t");
    const tasks = S.approvePhase(p, s.slug, "tasks", "t");
    const ai = S.nextAction(p, S.createFeature(p, "Summaries", ["core", "ai"], "", undefined, "en", undefined, { size: "s" }).slug);
    const plain = S.nextAction(p, S.createFeature(p, "Button", ["core", "ui"], "", undefined, "en", undefined, { size: "s" }).slug);
    const bug = S.nextAction(p, S.createFeature(p, "Crash", undefined, "", undefined, "en", "bugfix", { size: "xs" }).slug);
    const pt = S.nextAction(p, S.createFeature(p, "Exportar", ["core", "tdd"], "", undefined, "pt", undefined, { size: "s" }).slug);
    const es = S.nextAction(p, S.createFeature(p, "Exportar es", ["core", "tdd"], "", undefined, "es", undefined, { size: "s" }).slug);
    ok(na0.step === "fill" && na0.fastForward.through === "test-plan" && na0.fastForward.phases.join() === "requirements,design,test-plan" &&
      /approve it through test-plan in one call: spec_approve \{name: "export-csv", through: "test-plan"\}/.test(na0.recommendation) && /write the failing tests \(\/spec export-csv tests\), approve tests/.test(na0.recommendation) &&
      na1.step === "approve" && na1.fastForward && na1.fastForward.through === "test-plan" && /\/approve export-csv --through test-plan/.test(na1.recommendation) &&
      ff.ok && ff.approved.join() === "requirements,design,test-plan" && na2.step === "fix" && /\/spec export-csv tests/.test(na2.recommendation) && !na2.fastForward &&
      tests.ok && tasks.ok && ai.fastForward.through === "eval-plan" && plain.fastForward.through === "tasks" && bug.fastForward.through === "tasks" &&
      /aprová-lo até test-plan numa só chamada/.test(pt.recommendation) && /escrever os testes que falham/.test(pt.recommendation) &&
      /apruébalo hasta test-plan en una sola llamada/.test(es.recommendation) && /escribe las pruebas que fallan/.test(es.recommendation),
      "1.21 review C3: size s with +tdd — next_action's fastForward ends at test-plan (requirements → design → test-plan; the text: then /spec <f> tests, approve tests, then the tasks), the approve step names /approve <f> --through test-plan, the call is approved whole, then Phase 4 (write the tests), tests and tasks; +ai ends at eval-plan; no +tdd / +ai and an XS bugfix still end at tasks; PT / ES localized (got " +
      JSON.stringify({ na0: na0.fastForward, na1: [na1.step, na1.fastForward], ff: ff.approved || ff.failing, na2: na2.step, tests: tests.failing || tests.ok, tasks: tasks.failing || tasks.ok, ai: ai.fastForward, plain: plain.fastForward, bug: bug.fastForward }) + ")");
  }

  { // C4 — spec_impact works on a change: the default phase is tasks; its criteria diffed by ID, its tasks by number; --reopen works
    const p = fresh("c4");
    const c = S.createFeature(p, "Footer", undefined, "x", undefined, "en", "change");
    wr(c.dir, "change.md", CHANGE_HEAD + changeTask(1, "US-1.AC-1") + changeTask(2, "US-1.AC-2"));
    const ap = S.approvePhase(p, c.slug, null, "t", { through: "tasks" });
    const tick = S.completeTask(p, c.slug, 1, OK_RUN);
    wr(c.dir, "change.md", rd(c.dir, "change.md").replace("the footer text \"Copyright\"", "the footer text \"Copyright 2026 Acme\""));
    const imp = S.impactReport(p, c.slug, {});
    const lines = S.impactLines(imp).join("\n");
    const viaMcp = payload(await rpc("tools/call", { name: "spec_impact", arguments: { projectDir: p, name: c.slug } }));
    const wrong = S.impactReport(p, c.slug, { phase: "requirements" });
    const na = S.nextAction(p, c.slug);
    const re = S.impactReport(p, c.slug, { reopen: true });
    const st = stateOf(c.dir);
    const after = rd(c.dir, "change.md");
    ok(ap.ok && tick.ok && imp.ok && imp.phase === "tasks" && imp.file === "change.md" && imp.changed === true && imp.modified.map((m) => m.id).join() === "US-1.AC-1" &&
      imp.tasks && imp.tasks.modified.length === 0 && imp.affectedTasks.map((t) => t.number).join() === "1" && /--phase tasks --reopen/.test(imp.hint || "") &&
      /~ US-1\.AC-1/.test(lines) && /Impact: footer · tasks/.test(lines) && viaMcp.phase === "tasks" && viaMcp.modified.map((m) => m.id).join() === "US-1.AC-1" &&
      wrong.ok === false && wrong.change === true && /one file, change\.md/.test(wrong.error) &&
      na.step === "re-review" && /impact footer --phase tasks/.test(na.recommendation) &&
      re.ok && re.reopened.join() === "1" && /^- \[ \] 1\. /m.test(after) && /US-1\.AC-1\*\* — WHEN any page renders/.test(after) && /## Approach/.test(after) &&
      st.evidence["1"].stale === true && st.changes.length === 1 && st.changes[0].phase === "tasks" && st.changes[0].modified.join() === "US-1.AC-1",
      "1.21 review C4: spec_impact on a change — the default phase is tasks (change.md): the edited AC-1 is 'modified' (by stable ID), its done task #1 affected, the hint names --phase tasks --reopen (MCP = engine); another phase is refused (change: true); next_action's re-review names --phase tasks; --reopen unticks #1 in change.md (its criteria untouched), marks its evidence stale and records the change request (phase tasks) (got " +
      JSON.stringify({ imp: [imp.phase, imp.error, (imp.modified || []).map((m) => m.id), imp.hint], wrong: wrong.error, na: na.recommendation, re: [re.reopened, re.error], ch: st.changes }).slice(0, 1600) + ")");
  }

  { // C5 — the export and the matrix read a change as a change: its kind, its criteria once (no tasks inside), one Tasks table, no
    // design; changed-since / awaiting-approval rows from the kind-aware helpers; the matrix reads the plan's approval
    const p = fresh("c5");
    const c = S.createFeature(p, "Footer", undefined, "x", undefined, "en", "change");
    wr(c.dir, "change.md", CHANGE_HEAD + changeTask(1, "US-1.AC-1") + changeTask(2, "US-1.AC-2"));
    const md0 = S.exportSpecs(p, { name: c.slug, format: "md" }).content;
    S.approvePhase(p, c.slug, null, "t", { through: "tasks" });
    const mx1 = S.traceMatrix(p, c.slug);
    wr(c.dir, "change.md", rd(c.dir, "change.md").replace("the year 2026", "the year 2027"));
    const md1 = S.exportSpecs(p, { name: c.slug, format: "md" }).content;
    const mx2 = S.traceMatrix(p, c.slug);
    const proj = S.exportSpecs(p, { format: "md" }).content;
    const pt = S.createFeature(p, "Rodape", undefined, "x", undefined, "pt", "change");
    const mdPt = S.exportSpecs(p, { name: pt.slug, format: "md" }).content;
    const count = (s, re) => (s.match(re) || []).length;
    ok(/\*\*Kind:\*\* change \(size xs\)/.test(md0) && /_Change specification · /.test(md0) && !/^## Design/m.test(md0) && count(md0, /^## Tasks$/gm) === 1 &&
      /^## Acceptance Criteria \(EARS\)\n\n1\. \*\*US-1\.AC-1\*\*/m.test(md0) && !/_Requirements:/.test(md0) && /\| Plan \(change\.md\) \| — \| — \| awaiting approval \|/.test(md0) &&
      /Plan \(change\.md\) not approved yet\./.test(md0) && mx1.kind === "change" && mx1.approval && mx1.approval.baseline === "snapshot" && mx1.approval.changed === false &&
      /\| Plan \(change\.md\) \| t \| [^|]+ \| changed since this approval/.test(md1) && /Plan \(change\.md\) approved /.test(md1) && mx2.approval.changed === true &&
      mx2.rows.find((r) => r.id === "US-1.AC-2").approval.changed === true && mx2.rows.find((r) => r.id === "US-1.AC-1").approval.changed === false && /changed since the plan approval/.test(md1) &&
      /change \(size xs\) · core/.test(proj) && /### Acceptance criteria/.test(proj) && /\*\*Tipo:\*\* alteração \(tamanho xs\)/.test(mdPt),
      "1.21 review C5: a change's export — Kind 'change (size xs)', its criteria once (no task lines), ONE Tasks table, no design section, the plan's row awaiting approval then 'changed since this approval' after an edit; the matrix reads the plan approval (snapshot, per-row changed) and says so; the project export lists its acceptance criteria; PT localized (got " +
      JSON.stringify({ md0: md0.slice(0, 900), mx1: mx1.approval, mx2: mx2.approval }).slice(0, 1800) + ")");
  }

  { // C6 — a track pack's guidance line holding {{name}} / {{slug}} is still the template once the scaffold filled the feature's name in
    const p = fresh("c6");
    const pd = path.join(p, ".specs", "tracks", "kbd");
    fs.mkdirSync(pd, { recursive: true });
    fs.writeFileSync(path.join(pd, "track.json"), JSON.stringify({ name: "kbd", marker: "KBD", title: "Keyboard", sections: [{ name: "Keyboard Map", guidance: "The keyboard map of {{name}} ({{slug}}, {{marker}})." }] }));
    const f = S.createFeature(p, "Search box", ["kbd"], "x", undefined, "en");
    const noTodo = rd(f.dir, "design.md").split("\n").filter((x) => !/^> \*\*TODO\*\*/.test(x)).join("\n");
    wr(f.dir, "design.md", noTodo);
    const tmpl = chk(S.specDoctor(p, f.slug), "kbd-sections");
    wr(f.dir, "design.md", noTodo.replace("The keyboard map of Search box (search-box, [KBD]).", "Tab moves through the results; Enter opens one; Escape clears the box."));
    const own = chk(S.specDoctor(p, f.slug), "kbd-sections");
    ok(/The keyboard map of Search box \(search-box, \[KBD\]\)\./.test(noTodo) && tmpl.status === "fail" && /Keyboard Map:only the template's guidance/.test(tmpl.detail) && own.status === "pass",
      "1.21 review C6: a pack section whose guidance holds {{name}} / {{slug}} (filled in by the scaffold) reads 'only the template's guidance' while untouched (a linear wildcard, never a regex from template text); the user's own line fills it (got " +
      JSON.stringify([tmpl.status, tmpl.detail, own.status]) + ")");
  }

  { // C7 — removing a covering track writes back the sections of the remaining tracks it covered (sized designs)
    const p = fresh("c7");
    const m = S.createFeature(p, "Obs", ["core", "saas", "obs"], "", undefined, "en", undefined, { size: "m" });
    const before = chk(S.specDoctor(p, m.slug), "saas-sections");
    const r = S.addTrack(p, m.slug, "obs", { remove: true });
    const des = rd(m.dir, "design.md");
    const after = chk(S.specDoctor(p, m.slug), "saas-sections");
    const again = S.addTrack(p, m.slug, "obs", { remove: true });
    const u = S.createFeature(p, "Obs plain", ["core", "saas", "obs"], "", undefined, "en");
    const ur = S.addTrack(p, u.slug, "obs", { remove: true });
    const pt = S.createFeature(p, "Obs pt", ["core", "saas", "obs"], "", undefined, "pt", undefined, { size: "m" });
    const rp = S.addTrack(p, pt.slug, "obs", { remove: true });
    ok(!/Performance Budget:missing|Observability:missing/.test(before.detail) && r.ok && JSON.stringify(r.restoredSections) === JSON.stringify(["[SaaS] Performance Budget", "[SaaS] Observability"]) &&
      /added back to design\.md, to be filled: \[SaaS\] Performance Budget, \[SaaS\] Observability/.test(r.note) &&
      (des.match(/^## \[SaaS\] Performance Budget\n> \*\*TODO\*\*/gm) || []).length === 1 && (des.match(/^## \[SaaS\] Observability\n> \*\*TODO\*\*/gm) || []).length === 1 &&
      after.status === "fail" && /Performance Budget:unfilled/.test(after.detail) && !/:missing/.test(after.detail) && !again.restoredSections && !ur.restoredSections &&
      rp.restoredSections && rp.restoredSections.length === 2 && /voltaram ao design\.md/.test(rp.note),
      "1.21 review C7: removing +obs from a size m +saas +obs feature appends the [SaaS] Performance Budget / Observability sections it covered (heading + TODO + guidance, write-if-missing) — restoredSections + a note (EN / PT); doctor then asks to fill them (unfilled, never 'missing' with nothing to restore them); a second remove and an unsized feature restore nothing (got " +
      JSON.stringify({ before: before.detail, r: [r.restoredSections, r.note], after: after.detail, rp: rp.restoredSections }) + ")");
  }

  { // C8 — +api / +dist have no overlap: [API] Pagination, Idempotency & Concurrency is scaffolded and judged on its own
    const p = fresh("c8");
    const m = S.createFeature(p, "Orders api", ["core", "api", "dist"], "", undefined, "en", undefined, { size: "m" });
    const filled = rd(m.dir, "design.md").split("\n").map((x) => (/^> \*\*TODO\*\*/.test(x) ? "Decided for this feature: the concrete answer written here." : x)).join("\n");
    wr(m.dir, "design.md", filled.replace(/## \[API\] Pagination, Idempotency & Concurrency\n[\s\S]*?(?=\n## )/, ""));
    const gone = chk(S.specDoctor(p, m.slug), "api-sections");
    ok(/^## \[API\] Pagination, Idempotency & Concurrency$/m.test(filled) && !S.TRACK_OVERLAPS.some((o) => o.drop[0] === "api") && gone.status === "fail" &&
      /Pagination, Idempotency & Concurrency:missing/.test(gone.detail),
      "1.21 review C8: at size m with +api +dist the [API] Pagination, Idempotency & Concurrency section is scaffolded (If-Match / 412 and 202 are asked nowhere else) and, deleted, it is missing — never 'covered' by [DIST] (got " + JSON.stringify(gone.detail) + ")");
  }

  { // C9 — spec_create on an EXISTING change with tracks: nothing added, never silently (tracksIgnored + a note), MCP = engine
    const p = fresh("c9");
    const c = S.createFeature(p, "Footer typo", undefined, "x", undefined, "en", "change");
    const again = S.createFeature(p, "Footer typo", ["core", "saas"], "", undefined, "en");
    const viaMcp = payload(await rpc("tools/call", { name: "spec_create", arguments: { projectDir: p, name: "Footer typo", tracks: ["core", "sec"] } }));
    const plain = S.createFeature(p, "Footer typo", undefined, "", undefined, "en");
    ok(c.ok && again.ok && JSON.stringify(again.tracksIgnored) === JSON.stringify(["saas"]) && /Tracks not added — \+saas: 'footer-typo' is a change/.test(again.note) &&
      viaMcp.ok && JSON.stringify(viaMcp.tracksIgnored) === JSON.stringify(["sec"]) && stateOf(c.dir).tracks.join() === "core" && !has(c.dir, "design.md") && plain.ok && !plain.tracksIgnored,
      "1.21 review C9: spec_create on an existing change naming tracks adds none and says so — tracksIgnored + a localized note (MCP and engine); without tracks nothing is said (got " +
      JSON.stringify({ again: [again.tracksIgnored, again.note], mcp: viaMcp.tracksIgnored }) + ")");
  }

  { // C10 — messages name the kind's real file; status and doctor agree on an unsized feature; spec_templates knows `change`; wording
    const p = fresh("c10");
    const c = S.createFeature(p, "Footer", undefined, "x", undefined, "en", "change");
    wr(c.dir, "change.md", CHANGE_HEAD + changeTask(1, "US-1.AC-1") + changeTask(2, "US-1.AC-2"));
    S.approvePhase(p, c.slug, null, "t", { through: "tasks" });
    const nf = S.completeTask(p, c.slug, 9, OK_RUN);
    const app = S.appendTasks(p, c.slug, [{ text: "Third string", requirements: ["US-1.AC-1"], verify: 'node -e "process.exit(0)"' }]);
    const phantom = S.appendTasks(p, c.slug, [{ text: "Fourth", requirements: ["US-1.AC-9"] }]);
    S.completeTask(p, c.slug, 1); // ticked with no evidence
    const stop = S.stopCheck(p, { message: "Done — all tests pass and everything is verified." });
    const mid = S.createFeature(p, "Mid", undefined, "x", undefined, "en", "change");
    wr(mid.dir, "change.md", "# Change: mid\n\n## Summary\nOne fix.\n\n## Acceptance Criteria (EARS)\nThe footer behaviour of US-1.AC-1 changes.\n\n## Approach\nOne line.\n\n## Tasks\n" + changeTask(1, "US-1.AC-1"));
    const earsMid = chk(S.specDoctor(p, mid.slug), "ears");
    const u = S.createFeature(p, "Login", ["core", "sec"], "", undefined, "en");
    wr(u.dir, "design.md", rd(u.dir, "design.md").split("\n").filter((x) => !/^> \*\*TODO\*\*/.test(x)).join("\n"));
    const row = S.statusFeature(p, u.slug).secSections.find((x) => x.section === "Threat Model");
    const tpl = list.result.tools.find((t) => t.name === "spec_templates");
    const E = S.msg("en");
    ok(nf.ok === false && /Task 9 not found in change\.md/.test(nf.error) && app.ok && app.file === "change.md" && /^change\.md changed after its approval/.test(app.note) &&
      phantom.ok === false && /not in change\.md/.test(phantom.error) && stop.block === true && /\.specs\/footer\/change\.md \(task 1 first\)/.test(stop.reason) &&
      earsMid.status === "fail" && /^change\.md cites AC IDs \(US-1\.AC-1\)/.test(earsMid.detail) &&
      row.status === "template" && row.filled === false && /\bchange\b/.test(tpl.inputSchema.properties.artifact.description) && S.templates(p, "list").templates.some((x) => x.artifact === "change" && x.file === "change.md") &&
      /a track \(\+sec\) makes it a feature of size s/.test(E.sizes.changeTracks("+sec")) && !/\ba \[/.test(E.sizes.coveredComment("[SaaS] Observability")) &&
      /um track \(\+sec\) faz dela/.test(S.msg("pt").sizes.changeTracks("+sec")) && /un track \(\+sec\) lo convierte/.test(S.msg("es").sizes.changeTracks("+sec")),
      "1.21 review C10: a change's messages name change.md — task not found, append-tasks (file, 'change.md changed after its approval', phantom 'not in change.md'), the stop gate ('read … .specs/<f>/change.md'), EARS 'change.md cites AC IDs'; spec_status gives an unsized row its status ('template', as doctor); spec_templates lists 'change'; 'a track (+sec) makes it' (EN / PT / ES) (got " +
      JSON.stringify({ nf: nf.error, app: [app.file, app.note], phantom: phantom.error, stop: String(stop.reason).slice(0, 300), ears: earsMid.detail, row }).slice(0, 1600) + ")");
  }

  // --- 1.21 verify — the verification pass on the merged 1.21 (the change kind at the seams) ---
  const CHANGE_ONE = "# Change: footer\n\n## Summary\nFix the footer text.\n\n## Acceptance Criteria (EARS)\n" +
    "1. **US-1.AC-1** — WHEN any page renders THE SYSTEM SHALL show the footer text \"Copyright\".\n\n## Approach\nOne string in templates/footer.html.\n\n## Tasks\n" +
    "- [ ] 1. [US1] Fix the footer string\n  - _Requirements: US-1.AC-1_\n  - _Verify: node -e \"process.exit(0)\"_\n";

  { // V4 — a change with roles on `tasks`: a role's sign-off of change.md counts (phaseContent read tasks.md — the alias of that
    // very change.md — as a second fingerprint no record carries, so every sign-off read stale and signoffsComplete never fired)
    const p = fresh("v4");
    S.initProject(p, ["core"], "en", { approvalRoles: { tasks: ["tech", "qa"] } });
    const c = S.createFeature(p, "Footer", undefined, "x", undefined, "en", "change");
    wr(c.dir, "change.md", CHANGE_ONE);
    const tech = S.approvePhase(p, c.slug, "tasks", "t", { role: "tech" });
    const na1 = S.nextAction(p, c.slug);
    const doc1 = S.specDoctor(p, c.slug);
    S.writeRoadmapMd(p);
    const roadmap = rd(path.join(p, ".specs"), "ROADMAP.md");
    // the merged-branches case: qa's sign-off recorded apart (same content) — every role signed, the phase not approved
    const st = stateOf(c.dir);
    st.signoffs.tasks.qa = { ...st.signoffs.tasks.tech, by: "q" };
    wr(c.dir, ".state.json", JSON.stringify(st, null, 2));
    const na2 = S.nextAction(p, c.slug);
    const doc2 = S.specDoctor(p, c.slug);
    const qa = S.approvePhase(p, c.slug, "tasks", "q", { role: "qa" });
    ok(tech.ok && tech.pending === true && JSON.stringify(na1.missingRoles) === JSON.stringify(["qa"]) && JSON.stringify(doc1.pendingRoles.tasks.missing) === JSON.stringify(["qa"]) &&
      doc1.pendingRoles.tasks.stale.length === 0 && !/no longer count/.test(JSON.stringify(doc1.checks)) && /awaiting role sign-off: tasks \(qa\)$/m.test(roadmap) &&
      na2.signoffsComplete === true && /Every role has signed off 'tasks' \(tech, qa\)/.test(na2.recommendation) && doc2.nextGate && doc2.nextGate.signoffsComplete === true &&
      qa.ok && qa.approved === "tasks",
      "1.21 verify V4: a change with roles on tasks — tech's sign-off of change.md counts (missing: qa only, nothing stale, doctor / ROADMAP.md agree); with qa's recorded apart every role has signed (signoffsComplete, next_action and doctor), and qa's sign-off approves the plan (got " +
      JSON.stringify({ na1: na1.missingRoles, pr: doc1.pendingRoles, na2: [na2.signoffsComplete, na2.recommendation.slice(0, 160)], qa: qa.error || qa.approved }) + ")");
  }

  { // V6 — spec_clarify asks what the kind / size's doctor asks: a change its criteria view, own sections, EARS and markers (named
    // change.md, the right line); a size s feature no edge cases / NFRs (they mean size m); MCP = engine
    const p = fresh("v6");
    const c = S.createFeature(p, "Footer", undefined, "x", undefined, "en", "change");
    wr(c.dir, "change.md", CHANGE_ONE);
    const done = S.clarify(p, c.slug);
    const viaMcp = payload(await rpc("tools/call", { name: "spec_clarify", arguments: { projectDir: p, name: c.slug } }));
    const tmpl = S.clarify(p, S.createFeature(p, "Template", undefined, "x", undefined, "en", "change").slug);
    const gaps = S.createFeature(p, "Gaps", undefined, "x", undefined, "en", "change");
    wr(gaps.dir, "change.md", CHANGE_ONE.replace("Fix the footer text.", "").replace("One string in templates/footer.html.", "").replace("the footer text \"Copyright\"", "a fast footer [NEEDS CLARIFICATION: which text?]"));
    const g = S.clarify(p, gaps.slug);
    const pt = S.createFeature(p, "Rodape", undefined, "x", undefined, "pt", "change");
    wr(pt.dir, "change.md", "# Alteração: rodapé\n\n## Resumo\n\n## Critérios de Aceitação (EARS)\n1. **US-1.AC-1** — QUANDO a página abre O SISTEMA DEVE mostrar \"Copyright\".\n\n## Abordagem\nUma linha.\n\n## Tarefas\n- [ ] 1. [US1] Corrigir\n  - _Requirements: US-1.AC-1_\n");
    const gp = S.clarify(p, pt.slug);
    const sz = S.createFeature(p, "Small", ["core"], "", undefined, "en", undefined, { size: "s" });
    fill(sz.dir, "requirements.md");
    wr(sz.dir, "requirements.md", rd(sz.dir, "requirements.md").replace(/<!--[\s\S]*?-->\s*/g, "")); // filled: the template's comment removed too
    const small = S.clarify(p, sz.slug);
    const un = S.createFeature(p, "Unsized", ["core"], "", undefined, "en");
    wr(un.dir, "requirements.md", rd(sz.dir, "requirements.md"));
    const unsized = S.clarify(p, un.slug);
    const E = S.msg("en").clarify;
    const featureOnly = [E.addSuccessCriteria, E.prioritize, E.independentTest, E.edgeCases, E.outOfScope, E.nfr, E.unwanted];
    ok(done.verdict === "clear" && done.questions.length === 0 && JSON.stringify(viaMcp.questions) === JSON.stringify(done.questions) &&
      tmpl.questions.length === 1 && /change\.md:7 \[trigger\]/.test(tmpl.questions[0]) && /change\.md:13 \[the change\]/.test(tmpl.questions[0]) && !/requirements\.md/.test(JSON.stringify(tmpl)) &&
      g.questions.includes(E.changeSummary) && g.questions.includes(E.changeApproach) && g.questions.some((x) => /Resolve \[NEEDS CLARIFICATION\]: which text\?/.test(x)) &&
      g.questions.some((x) => /Quantify the vague term on line 7/.test(x)) && !g.questions.some((x) => featureOnly.includes(x)) &&
      gp.questions.includes(S.msg("pt").clarify.changeSummary) && gp.questions.length === 1 &&
      small.verdict === "clear" && !small.questions.includes(E.edgeCases) && !small.questions.includes(E.nfr) && unsized.questions.includes(E.edgeCases) && unsized.questions.includes(E.nfr),
      "1.21 verify V6: spec_clarify on a change asks only its own — clear once written (MCP = engine), the template's slots named change.md:<line> (the task line too), a missing Summary / Approach, its markers and vague terms (line into change.md), never stories / SC / P1 / edge cases / out of scope / NFRs / IF…THEN (PT localized); a filled size s feature is clear — no edge-case / NFR question — while the same text unsized is asked both (got " +
      JSON.stringify({ done: done.questions, tmpl: tmpl.questions, g: g.questions, gp: gp.questions, small: small.questions, unsized: unsized.questions }).slice(0, 1800) + ")");
  }

  { // V7 — a change's messages name change.md and never its design: doctor's clarifications, the gherkin / tracker sources, decide
    // --affects (a change.md section is a target; the refusal names change.md)
    const p = fresh("v7");
    const c = S.createFeature(p, "Footer", undefined, "x", undefined, "en", "change");
    wr(c.dir, "change.md", CHANGE_ONE);
    const gh = S.exportSpecs(p, { name: c.slug, format: "gherkin" }).content;
    const jira = S.exportSpecs(p, { name: c.slug, format: "jira" }).content;
    const dOk = S.decide(p, c.slug, { title: "One string", decision: "keep it in footer.html", affects: ["Approach", "US-1.AC-1", "Summary"] });
    const dBad = S.decide(p, c.slug, { title: "x", decision: "y", affects: ["Data Model"] });
    const tr = S.traceCheck(p, c.slug);
    wr(c.dir, "change.md", CHANGE_ONE.replace("One string in templates/footer.html.", "One string [NEEDS CLARIFICATION: which file?]."));
    const cl = chk(S.specDoctor(p, c.slug), "clarifications");
    const ap = S.approvePhase(p, c.slug, null, "t", { through: "tasks" });
    const apCl = (ap.checks || []).find((x) => x.id === "clarifications") || {};
    const pt = S.msg("pt"), es = S.msg("es");
    ok(/^# Source: \.specs\/footer\/change\.md — /m.test(gh) && /dev-spec task #1 — \.specs\/footer\/change\.md/.test(jira) && !/tasks\.md|requirements\.md/.test(gh + jira) &&
      dOk.ok && dOk.affects.join() === "Approach,US-1.AC-1,Summary" && dBad.ok === false && /a section heading of change\.md \(Summary, Acceptance Criteria, Approach, Tasks\)/.test(dBad.error) &&
      !/design\.md/.test(dBad.error) && (tr.phantomAffects || []).length === 0 &&
      cl.status === "fail" && /in change\.md — resolve before approving the plan/.test(cl.detail) && !/design/.test(cl.detail) && ap.ok === false && /approving the plan/.test(apCl.detail || "") &&
      /em change\.md — [\s\S]*aprovar o plano/.test(pt.hook.earsIssues(1, 0, "L1", true, "change.md")) && /antes de aprobar el plan/.test(es.gates.hookPlaceholders(1, "L1 [x]", "change.md")) &&
      /before advancing to design/.test(S.msg("en").hook.earsIssues(1, 0, "L1", true)) && /in requirements\.md/.test(S.msg("en").gates.hookPlaceholders(1, "L1 [x]")),
      "1.21 verify V7: a change names change.md — gherkin '# Source: .specs/<f>/change.md', the tracker's 'dev-spec task #1 — .specs/<f>/change.md', decide --affects takes a change.md section (Approach, Summary) and its refusal names change.md's sections; doctor's and the plan gate's clarifications say 'before approving the plan', never design; the save hook's EARS / placeholder lines (EN / PT / ES) name the file, requirements.md keeps its wording (got " +
      JSON.stringify({ gh: gh.split("\n")[2], dOk: dOk.error || dOk.affects, dBad: dBad.error, cl: cl.detail, ap: apCl.detail }).slice(0, 1400) + ")");
  }
};
