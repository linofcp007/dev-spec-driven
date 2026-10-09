"use strict";
// The built-in +data track (1.21 F4 — data pipelines & data quality) end to end, and the example +mobile track pack (examples/track-packs/mobile).
// Registry, classifier (EN / PT / ES, precision / recall, cues), scaffolds (EN / PT / ES / pt-BR), gates, views, add_track / remove, legacy packs.

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, all, rpc, payload, S, tmp, require, __dirname }) => {
  const I = require("./lib/i18n.js");
  const js = (v) => JSON.stringify(v);
  const rd = (...p) => fs.readFileSync(path.join(...p), "utf8");
  const chk = (doc, id) => doc.checks.find((c) => c.id === id) || {};
  const dropTodo = (file) => fs.writeFileSync(file, rd(file).split(/\r?\n/).map((l) => (/^\s*>\s*\*\*TODO\*\*/.test(l) ? "Decided for this feature: the concrete answer written here." : l)).join("\n"));
  const cls = (t, lang) => S.classify(t, lang ? { lang } : {});
  const onOf = (t, tr) => cls(t).tracks.includes(tr);

  { // 1.21 F4 — the built-in +data track: registry, scaffolds, gates, views, add_track / remove, legacy packs of a now-reserved name
    const dRoot = path.join(tmp, "p21-data");
    const d = (n) => path.join(dRoot, n);
    const SECTIONS = ["Data Contracts & Schema Evolution", "Data Quality", "Pipeline Idempotency & Backfills", "Lineage & Ownership", "Retention & Cost"];
    const IDS = ["32", "33", "34", "35"];
    const unfilledWord = { en: /unfilled/, pt: /por preencher/, es: /sin rellenar/, "pt-BR": /sem preencher/ };
    const title = { en: "Data Quality", pt: "Qualidade dos Dados", es: "Calidad de los Datos", "pt-BR": "Qualidade dos Dados" };

    // --- registry: a valid, composable marker track after +obs; a typo and an alias get a did-you-mean; the reserved pack names
    const typo = S.createFeature(d("typo"), "Typo", "dataa"), alias = S.createFeature(d("typo"), "Typo", ["etl"]);
    const reserved = ["data", "etl", "elt", "pipeline", "pipelines", "warehouse", "dbt", "lakehouse"].filter((n) => !S.trackPacks(d("typo"), "init", { name: n }).ok);
    ok(S.VALID_TRACKS.indexOf("data") === S.VALID_TRACKS.indexOf("obs") + 1 && S.OPTIONAL_TRACKS.includes("data") && S.TRACK_MARKER.data === "[DATA]" &&
      js(S.trackSections("data").map((x) => x.name)) === js(SECTIONS) && S.trackLabel(S.normalizeTracks("data dist tdd")) === "core +tdd +dist +data" &&
      !typo.ok && /did you mean 'data'/.test(typo.error) && !alias.ok && /'etl' \(did you mean 'data'\?\)/.test(alias.error) && reserved.length === 8,
      "1.21 F4: +data is a valid, composable marker track ([DATA], 5 sections, after +obs); 'dataa' / 'etl' get a did-you-mean; data / etl / elt / pipeline(s) / warehouse / dbt / lakehouse are reserved pack names (got " +
      js([S.OPTIONAL_TRACKS, typo.error, alias.error, reserved]) + ")");

    // --- scaffold per language: 5 [DATA] sections with the TODO sentinel, US-1.AC-32..35, every fresh artifact reads 'placeholder'; data-sections
    // fails and the design approval is refused while TODO; filled, it passes
    const scaffolds = [];
    for (const lang of ["en", "pt", "es", "pt-BR"]) {
      const p = d("scaffold-" + lang);
      const f = S.createFeature(p, "data " + lang, ["data"], "", undefined, lang);
      const design = rd(f.dir, "design.md"), reqs = rd(f.dir, "requirements.md"), tasks = rd(f.dir, "tasks.md");
      const heads = design.split("\n").filter((l) => l.startsWith("## [DATA] "));
      const e = S.earsValidate(reqs, lang);
      const own = e.issues.filter((i) => i.code !== "placeholder" && IDS.some((id) => (i.text || "").includes("US-1.AC-" + id)));
      const states = fs.readdirSync(f.dir).filter((nm) => nm.endsWith(".md") && nm !== "checklist.md").map((nm) => [nm, S.artifactState(path.join(f.dir, nm))]);
      const before = S.specDoctor(p, f.slug);
      S.approvePhase(p, f.slug, "classification", "t", { force: true });
      S.approvePhase(p, f.slug, "requirements", "t", { force: true });
      const refused = S.approvePhase(p, f.slug, "design", "t");
      dropTodo(path.join(f.dir, "design.md"));
      const after = S.specDoctor(p, f.slug);
      const good = f.ok && f.label === "core +data" && heads.length === 5 && design.includes(title[lang]) && (design.match(/^> \*\*TODO\*\*/gm) || []).length === 5 &&
        reqs.includes("#### [DATA]") && IDS.every((n) => reqs.includes("US-1.AC-" + n) && tasks.includes("US-1.AC-" + n)) && !own.length &&
        e.issues.every((i) => i.severity !== "error") && states.length >= 4 && states.every(([, st]) => st === "placeholder") &&
        chk(before, "data-sections").status === "fail" && unfilledWord[lang].test(chk(before, "data-sections").detail) && !refused.ok && refused.failing.includes("data-sections") &&
        chk(after, "data-sections").status === "pass" && /5/.test(chk(after, "data-sections").detail);
      if (!good) scaffolds.push([lang, heads, own.map((i) => i.code), states.filter(([, st]) => st !== "placeholder"), chk(before, "data-sections").detail, chk(after, "data-sections").detail]);
    }
    ok(!scaffolds.length,
      "1.21 F4: EN / PT / ES / pt-BR +data scaffolds — 5 [DATA] sections with the TODO sentinel, criteria US-1.AC-32..35 (no EARS issue but slots), every fresh artifact reads 'placeholder', data-sections fails ('unfilled' in the feature's language) and the design approval is refused while TODO, passes once filled (got " +
      js(scaffolds) + ")");

    // --- a filled +data feature is ready: doctor has no fail and every gate approves without force (EN / PT / ES round trip)
    const SLOT = /\[(?!shared\]|US\d+\]|[ xX]\]|P\]|DATA\]|NEEDS)[^\]\n]*\]/g;
    const filled = [];
    for (const lang of ["en", "pt", "es"]) {
      const p = d("filled-" + lang);
      S.initProject(p, ["core", "data"], lang);
      const f = S.createFeature(p, "Filled " + lang, ["data"], "", undefined, lang);
      for (const file of ["classification.md", "requirements.md", "design.md", "tasks.md"]) {
        const fp = path.join(f.dir, file);
        let t = rd(fp);
        for (let i = 0; i < 3; i++) t = t.replace(SLOT, "the orders table");
        fs.writeFileSync(fp, t.split(/\r?\n/).map((l) => (/^\s*>\s*\*\*TODO\*\*/.test(l) ? "Decided for this feature: the concrete answer written here." : l)).join("\n"));
      }
      const doc = S.specDoctor(p, f.slug);
      const gates = ["classification", "requirements", "design", "tasks"].map((ph) => [ph, S.approvePhase(p, f.slug, ph, "t")]);
      if (!(doc.readyToAdvance && !doc.checks.some((c) => c.status === "fail") && chk(doc, "data-sections").status === "pass" && gates.every(([ph, r]) => r.ok && r.approved === ph && !r.forced)))
        filled.push([lang, doc.checks.filter((c) => c.status === "fail").map((c) => c.id + ": " + c.detail), gates.filter(([, r]) => !r.ok).map(([ph, r]) => ph + ":" + (r.failing || []).join(","))]);
    }
    ok(!filled.length, "1.21 F4: EN / PT / ES — a filled +data feature is ready (doctor has no fail) and classification → requirements → design → tasks approve without force (got " + js(filled) + ")");

    // --- add_track / remove / re-add (additive, non-destructive)
    const at = d("add");
    S.initProject(at, ["core"], "en");
    const plain = S.createFeature(at, "Plain", ["core"], "", undefined, "en");
    const tBefore = S.statusFeature(at, plain.slug).tasks.total;
    const add = S.addTrack(at, plain.slug, "+data");
    const pTasks = rd(plain.dir, "tasks.md");
    const docAdd = S.specDoctor(at, plain.slug), tAdded = S.statusFeature(at, plain.slug).tasks.total;
    const rm = S.removeTrack(at, plain.slug, "data");
    const docRm = S.specDoctor(at, plain.slug), stRm = S.statusFeature(at, plain.slug);
    const reAdd = S.addTrack(at, plain.slug, "data");
    all("1.21 F4: add_track data (sections, steering/data.md, 5 template tasks with placeholder ACs, data-sections fails); --remove is non-destructive (inactive, no check, dataSections null, tasks not counted); re-adding duplicates nothing (got " +
      js([add.added, rm.inactive, tBefore, tAdded]) + ")", [
      () => add.ok, () => add.tracks === "core +data", () => (add.added || []).join("|").includes("steering/data.md"),
      () => rd(plain.dir, "design.md").includes("## [DATA] Data Contracts & Schema Evolution"),
      () => pTasks.includes("## Story US-1 — Data Pipeline"), () => pTasks.includes("_Requirements: [the +data criterion this task proves]_"),
      () => chk(docAdd, "data-sections").status === "fail", () => tAdded === tBefore + 5, () => rm.ok, () => rm.tracks === "core",
      () => rm.inactive.includes("design.md ([DATA] sections)"), () => rm.inactive.includes("tasks.md (Story US-1 — Data Pipeline)"),
      () => !chk(docRm, "data-sections").status, () => stRm.dataSections === null, () => stRm.tasks.total === tBefore, () => reAdd.ok,
      () => reAdd.tracks === "core +data", () => rd(plain.dir, "tasks.md").split("## Story US-1 — Data Pipeline").length === 2,
      () => S.statusFeature(at, plain.slug).tasks.total === tBefore + 5,
    ]);

    // --- markers are case-sensitive; the loose (ordinary) names count only in the track's context — a core "## Ownership" note, +privacy's
    // "[PRIVACY] Retention & Deletion" never stand in for a deleted [DATA] section; [DATA] is a stable bracket, not a slot
    const cs = d("case");
    const csF = S.createFeature(cs, "Case", ["core"], "", undefined, "en");
    fs.appendFileSync(path.join(csF.dir, "design.md"), "\n### Timestamps [data]\n- the rows, in [data] units\n");
    const csState = path.join(csF.dir, ".state.json");
    const csSt = JSON.parse(rd(csState)); delete csSt.tracks; fs.writeFileSync(csState, JSON.stringify(csSt, null, 2));
    const csTracks = S.statusFeature(cs, csF.slug).tracks;
    fs.appendFileSync(path.join(csF.dir, "design.md"), "\n## [DATA] Data Quality\n- null checks\n");
    const csInferred = S.statusFeature(cs, csF.slug).tracks;
    const lz = S.createFeature(d("loose"), "Loose", ["data", "privacy"], "", undefined, "en");
    dropTodo(path.join(lz.dir, "design.md"));
    fs.writeFileSync(path.join(lz.dir, "design.md"), rd(lz.dir, "design.md").replace("## [DATA] Lineage & Ownership", "## Ownership").replace("## [DATA] Retention & Cost", "## Retention"));
    const lzDoc = chk(S.specDoctor(d("loose"), lz.slug), "data-sections");
    ok(csTracks === "core" && csInferred === "core +data" && lzDoc.status === "fail" && lzDoc.detail.includes("Lineage & Ownership:missing") && lzDoc.detail.includes("Retention & Cost:missing") &&
      S.artifactState({ text: "# Notes\n\nThe [DATA] sections were reviewed on Monday by the whole team.\n" }) === "filled",
      "1.21 F4: a lower-case '[data]' is prose (no +data inferred), a '[DATA]' heading infers it; a core '## Ownership' / '## Retention' and +privacy's '[PRIVACY] Retention & Deletion' never satisfy a deleted [DATA] section; [DATA] is a stable bracket (got " +
      js([csTracks, csInferred, lzDoc.detail]) + ")");

    // --- 1.21 review B5: a strict [DATA] name nested under ANOTHER track's section is part of that section — "### Qualidade dos dados (LGPD art.
    // 6º, V)" under "## [PRIVACY] Fundamento de Licitude e Finalidade" never stands in for a deleted "## [DATA] Qualidade dos Dados" (EN / PT /
    // pt-BR / ES); an unmarked top-level heading still does (a strict synonym, by design)
    const nested = [];
    for (const [lang, head, note] of [["en", "Data quality", "(GDPR art. 5(1)(d))"], ["pt", "Qualidade dos dados", "(RGPD art. 5.º)"],
      ["pt-BR", "Qualidade dos dados", "(LGPD art. 6º, V)"], ["es", "Calidad de los datos", "(RGPD art. 5)"]]) {
      const p = d("nested-" + lang);
      const f = S.createFeature(p, "Nested " + lang, ["privacy", "data"], "", undefined, lang);
      const dp = path.join(f.dir, "design.md");
      dropTodo(dp);
      const lines = rd(dp).split("\n");
      const di = lines.indexOf("## [DATA] " + title[lang]);
      let de = di + 1;
      while (de < lines.length && !/^#{1,2}\s/.test(lines[de])) de++;
      lines.splice(di, de - di);
      const pi = lines.findIndex((l, i) => l.startsWith("## [PRIVACY] ") && i > lines.findIndex((x) => x.startsWith("## [PRIVACY] ")));
      let pe = pi + 1;
      while (pe < lines.length && !/^#{1,2}\s/.test(lines[pe])) pe++;
      lines.splice(pe, 0, "### " + head + " " + note, "Accurate and up to date: the subject corrects them in the profile.", "");
      fs.writeFileSync(dp, lines.join("\n"));
      const under = chk(S.specDoctor(p, f.slug), "data-sections");
      fs.writeFileSync(dp, lines.join("\n").replace("### " + head + " " + note, "## " + head));
      const top = chk(S.specDoctor(p, f.slug), "data-sections");
      if (!(under.status === "fail" && under.detail.includes(title[lang]) && top.status === "pass")) nested.push([lang, lines[pi], under.status, under.detail, top.status, top.detail]);
    }
    // (every track: +sec's strict "Threat Model" under "## [DIST] Failure Modes" is +dist's text; top-level or under [SEC] it is +sec's)
    const secUnder = S.extractSection("# F\n\n## [DIST] Failure Modes\n- x\n### Threat Model\n- STRIDE done\n\n## Other\n", ["threat model"], "[SEC]");
    const secTop = S.extractSection("# F\n\n## Threat Model\n- STRIDE\n", ["threat model"], "[SEC]"), secOwn = S.extractSection("# F\n\n## [SEC] Security\n### Threat Model\n- STRIDE\n", ["threat model"], "[SEC]");
    ok(!nested.length && secUnder === null && /STRIDE/.test(secTop || "") && /STRIDE/.test(secOwn || ""),
      "1.21 review B5: a [DATA] section's strict name on a heading nested under another track's section ([PRIVACY]) never satisfies the deleted [DATA] section (EN / PT / pt-BR / ES); an unmarked top-level heading still does; the same for every track ([SEC] under [DIST]) (got " +
      js([nested, secUnder, secTop, secOwn]) + ")");

    // --- a track pack named 'data' (or 'etl'), recorded by a feature before 1.21, is that feature's MISSING pack — never the built-in track; doctor and
    // spec_upgrade say "from before 1.21"; add-track data adopts the built-in one, --remove drops the alias pack
    const lp = d("legacy");
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
    const lpMain = legacyFeature("data", "DATA"), lpAlias = legacyFeature("etl", "ETL");
    const lpDoc = S.specDoctor(lp, "f-data"), lpDocA = S.specDoctor(lp, "f-etl"), lpSt = S.statusFeature(lp, "f-data");
    const lpUp = S.specUpgrade(lp), lpUpF = lpUp.features.find((x) => x.name === "f-data") || {};
    const adopt = S.addTrack(lp, "f-data", "data"), drop = S.addTrack(lp, "f-etl", "etl", { remove: true });
    all("1.21 F4: a pre-1.21 pack named 'data' / 'etl' is the feature's missing pack (tracks read core, the built-in +data is NOT applied, doctor and spec_upgrade say 'from before 1.21'); add-track data adopts the built-in track, --remove drops the alias pack (got " +
      js([lpSt.tracks, lpSt.missingPacks, chk(lpDoc, "track-pack-missing").detail, chk(lpDocA, "track-pack-missing").detail, adopt.adopted, drop.error]) + ")", [
      () => lpSt.tracks === "core", () => js(lpSt.missingPacks) === js(["data"]), () => !chk(lpDoc, "data-sections").status,
      () => chk(lpDoc, "track-pack-missing").status === "warn",
      () => /\+data \(a track pack from before 1\.21 — 'data' is a reserved name now, and the built-in \+data track is NOT applied/.test(chk(lpDoc, "track-pack-missing").detail),
      () => /'etl' is a reserved name now: rename/.test(chk(lpDocA, "track-pack-missing").detail),
      () => (lpUpF.attention || []).includes("track-pack-reserved"),
      () => S.upgradeLines(lpUp).some((l) => /Rename its track pack\(s\) from before 1\.21 — /.test(l)), () => adopt.ok,
      () => js(adopt.adopted) === js(["data"]), () => adopt.tracks === "core +data",
      () => rd(lpMain.dir, "design.md").includes("## [DATA] Data Contracts & Schema Evolution"),
      () => chk(S.specDoctor(lp, "f-data"), "data-sections").status === "fail", () => drop.ok, () => js(drop.removedTracks) === js(["etl"]),
      () => js(JSON.parse(rd(lpAlias.dir, ".state.json")).tracks) === js(["core"]),
    ]);

    // --- views: the test rows, status, spec_finish checks, the brief's and the matrix's [DATA] sections, the Gherkin tag, spec_import, steering
    const vw = d("views");
    const initV = S.initProject(vw, ["core", "data"], "en");
    const vf = S.createFeature(vw, "Views", ["tdd", "data"], "", undefined, "en");
    const vPlan = rd(vf.dir, "test-plan.md"), vTr = S.traceCheck(vw, vf.slug);
    dropTodo(path.join(vf.dir, "design.md"));
    const vSt = S.statusFeature(vw, vf.slug), vFin = S.finishFeature(vw, vf.slug);
    const vTask = S.parseTasks(rd(vf.dir, "tasks.md")).find((x) => /^\[US1\] Data-quality checks/.test(x.text)) || {};
    const vBrief = S.taskBrief(vw, vf.slug, vTask.number);
    const vRow = ((S.traceMatrix(vw, vf.slug).rows) || []).find((r) => r.id === "US-1.AC-33") || {};
    const vGk = S.exportSpecs(vw, { name: vf.slug, format: "gherkin" });
    const plan = [/\| T-\d+ \| integration \| property \| data-quality checks on fixture batches: a null key, a duplicate and an out-of-range row are quarantined with their rule, the valid rows load \| US-1\.AC-32 \|/,
      /\| T-\d+ \| integration \| property \| a partition re-run or backfilled twice leaves the same rows as one run — no duplicate, no gap \| US-1\.AC-33 \|/,
      /\| T-\d+ \| contract \| example \| schema-change compatibility: an added optional column passes, a removed \/ renamed column or a narrowed type is rejected before the load \| US-1\.AC-35 \|/];
    const steeringHead = { en: /^# Data Pipeline Standards/, pt: /^# Padrões de Pipelines de Dados/, es: /^# Estándares de Pipelines de Datos/, "pt-BR": /^# Padrões de Pipelines de Dados/ };
    all("1.21 F4: +data views — its test rows are planned and traced, spec_status dataSections, spec_finish's +data checks, the brief and the matrix link a [DATA] criterion to its sections, Gherkin @DATA, steering/data.md in EN / PT / ES / pt-BR (got " +
      js([vPlan.split("\n").filter((l) => IDS.some((i) => l.includes("US-1.AC-" + i))), vSt.dataSections, vBrief.designSections, vRow.design, (vGk.content || "").split("\n")[0]]) + ")", [
      () => plan.every((re) => re.test(vPlan)), () => !vTr.uncoveredByTasks.length, () => !vTr.uncoveredByTests.length,
      () => !vTr.phantomAcsInTasks.length, () => !(vTr.testsNotMappedToTasks || []).length, () => Array.isArray(vSt.dataSections),
      () => vSt.dataSections.length === 5, () => vSt.dataSections.every((s) => s.filled),
      () => vFin.checks.some((c) => /^\+data: the data-quality checks/.test(c)), () => vBrief.ok,
      () => vBrief.designSections.includes("[DATA] Data Quality"), () => (vRow.design || []).includes("[DATA] Pipeline Idempotency & Backfills"),
      () => /(^|\s)@DATA(\s|$)/m.test(vGk.content || ""), () => initV.created.includes("data.md"), () => I.steeringKnownFiles().includes("data.md"),
      () => ["en", "pt", "es", "pt-BR"].every((l) => steeringHead[l].test(I.steeringStub("data.md", l) || "")),
      () => (chk(S.specDoctor(vw, vf.slug), "steering").detail || "").includes("data.md"),
    ]);
    const im = d("import");
    fs.mkdirSync(path.join(im, ".kiro", "specs", "orders"), { recursive: true });
    fs.writeFileSync(path.join(im, ".kiro", "specs", "orders", "requirements.md"), "### Requirement 1\n\n**User Story:** As an analyst, I want the orders.\n\n#### Acceptance Criteria\n\n1. WHEN the nightly ETL job re-runs a partition THEN the system SHALL replace it in the data warehouse without duplicate rows\n");
    fs.writeFileSync(path.join(im, ".kiro", "specs", "orders", "design.md"), "# Design\n\n## Overview\nThe orders feature.\n");
    const imp = S.importSpec(im, "kiro", ".kiro/specs/orders", {});
    const impDesign = imp.ok ? rd(im, ".specs", "orders", "design.md") : "";
    ok(imp.ok && imp.tracks.includes("data") && /The orders feature/.test(impDesign) && impDesign.includes("## [DATA] Data Quality"),
      "1.21 F4: spec_import auto-classifies +data and appends the [DATA] sections to the imported design (got " + js([imp.tracks, imp.error]) + ")");

    // --- 1.21 F4: the pt-BR twins of the new PT strings hold no European-only word, are idempotent and keep the markers / IDs
    const aBr = { name: "ARGN", tracks: ["core", "tdd", "data"], label: "core +tdd +data", slug: "argn", summary: "" };
    const brTexts = [...["requirements", "design", "tasks", "checklist"].map((b) => I[b](aBr, "pt-BR")), I.testPlan("ARGN", "pt-BR", aBr.tracks), I.steeringStub("data.md", "pt-BR"),
      ...S.msg("pt-BR").secPrivacy.finishChecks.data].join("\n");
    const EU = /(?<![\p{L}])(?:utilizador(?:es)?|registos?|partilhad[oa]s?|atómic[oa]s?|secç(?:ão|ões)|ficheiros?|ecrã|controlo)(?![\p{L}])|por omissão|em baixo/iu;
    ok(!EU.test(brTexts) && I.toPtBr(brTexts) === brTexts && (brTexts.match(/US-1\.AC-3[2-5]/g) || []).length >= 12 && /## \[DATA\] Qualidade dos Dados/.test(brTexts) &&
      /arquivo de esquema/.test(brTexts) && /registro de esquemas/.test(brTexts),
      "1.21 F4: the pt-BR twins of the +data strings hold no European-only word (arquivo, registro…), are idempotent and keep the markers and AC IDs (got " + js([(brTexts.match(EU) || [])[0]]) + ")");

    // --- classifier: self-match sweep (every +data keyword, EN / PT / ES, matches itself as a word; a strong one alone turns +data on; a generic one
    // alone never does)
    const sg = S.trackSignals("data");
    const sweep = [];
    for (const tier of ["strong", "weak", "generic"]) for (const kw of sg[tier]) {
      const r = S.classify("We need " + kw + " here");
      if (!r.signals.data.some((m) => m === kw || m.includes(kw)) || (tier === "strong" && !r.tracks.includes("data")) || (tier === "generic" && r.tracks.includes("data"))) sweep.push(tier + ":" + kw);
    }
    ok(sweep.length === 0 && sg.strong.length >= 25 && sg.weak.length >= 15 && sg.generic.length >= 5,
      "1.21 F4: +data self-match sweep — every keyword matches itself; a strong one alone turns +data on, a generic one alone never does (misses: " + sweep.join(", ") + ")");
  }

  { // 1.21 F4 — the +data classifier: precision / recall on EN / PT / ES texts (positives and hard negatives), the cues, and the older tracks untouched
    // 1.21 review B3 / B4: the reviewer's everyday texts — a lakehouse to rent, ELT teachers, a kitchen's freshness check, parquet flooring, SCD
    // patients, medication / water / calorie ingestion, duplicate rows in the users table, React Query's stale data, the Portuguese BI (ID card),
    // a training plan's "carga incremental", a horse's lineage, a stock screen per warehouse "in a table" — and their data senses
    const B3_OFF = ["Guests can book a lakehouse or a cabin for the weekend and pay a deposit online.", "ELT teachers can assign graded reading exercises to their classes.",
      "Kitchen staff log a freshness check for each produce crate at delivery.", "Sell parquet and laminate flooring; show the price per square metre in a table.",
      "Store SCD patient records in the patients table.", "Track medication ingestion times per patient in a table.",
      "Prevent duplicate rows in the users table when the signup form is double-submitted.", "Use React Query so the dashboard never shows stale data after a mutation.",
      "Registar a ingestão diária de água de cada utente numa tabela.", "Validar o número do BI e o NIF na tabela de clientes.",
      "Plano de treino com carga incremental semanal para cada atleta.", "Mostrar a linhagem de cada cavalo numa tabela.",
      "Registrar la ingesta diaria de calorías de cada paciente en una tabla.", "Mostrar el linaje de cada caballo en una tabla.",
      "Plan de entrenamiento con carga incremental semanal para cada atleta.",
      "Show stock levels per warehouse so pickers know which shelf to restock.", "Show stock levels per warehouse in a table so pickers know which shelf to restock."];
    const B3_ON = ["The raw zone of the lakehouse keeps 30 days of events in Delta tables.", "Replace the vendor's ELT tool with our own ELT job that loads the raw events every hour.",
      "Add a freshness check on the orders table so the owner knows when the nightly load is late.",
      "The finance team's BI dashboard reads the monthly revenue from the warehouse snapshots.", "Carga incremental de dados das encomendas para o armazém de dados.",
      "Mostrar a linhagem de cada métrica do painel até às tabelas de origem.", "Write the clickstream as Parquet partitioned by day."];
    // 1.21 verify V3: plain data sentences a data-term anchor + a table / a query make (1.21 wins the review's first fix lost), a data sense
    // beside an everyday word (the data-sense cue runs first), and BI phrases at a sentence start or in title case
    const V3_ON = ["A BI dashboard over the orders table.", "Load the orders table into the warehouse every night.", "Backfill the orders table for the last two years.",
      "Query the warehouse for monthly revenue.", "A Power BI report over the sales table.", "Nightly export of the orders table to parquet.",
      "Carga incremental diária da tabela de encomendas.", "Load the bookkeeping entries into the lakehouse tables.",
      "Guest checkout events land in the lakehouse bronze tables.", "Keep 30 nights of raw data in the lakehouse.", "The lakehouse stays in sync with the Postgres tables.",
      "Add a freshness check to the grocery orders pipeline.", "Show the column lineage of each metric per product family.",
      "Relatório de BI sobre as vendas com backfill mensal.", "Informe de BI con backfill mensual.", "Herramienta de BI con backfill mensual.",
      "Ferramenta de BI com backfill mensal.", "BI Dashboard with a monthly backfill.", "Relatório de BI com backfill mensal."];
    // 1.21 verify R3 / R4: a lineage of reports / fields (after the animals and families), ingestion of files / feeds into a table or a lake,
    // a type-2 SCD — and their everyday twins; R1: a data phrase an exclusion negates
    const R34_ON = ["Lineage between the orders table and the revenue report.", "Lineage from the orders table to the revenue report.",
      "Field-level lineage for the revenue report.", "Show the lineage of each field in the revenue report.", "Linhagem de cada campo do relatório de receitas.",
      "Linaje de cada campo del informe de ingresos.", "Ingestion of CSV files into the orders table.", "Ingestão dos ficheiros CSV para a tabela de encomendas.",
      "Ingesta de ficheros CSV en la tabla de pedidos.", "SCD type 2 on the customers table."];
    const R34_OFF = ["Mostrar a linhagem de cada cavalo num relatório.", "We do not need a data warehouse.", "We will not build a data pipeline.",
      "Show the lineage of each horse in the breeding report.",
      // 1.21 verify N2: what is ingested named next to the word is the everyday sense, even beside a CSV file
      "Log the daily water ingestion of each patient in a CSV file.", "Registar a ingestão diária de água de cada utente num ficheiro CSV.",
      "Registrar la ingesta diaria de agua de cada paciente en un fichero CSV.", "Track medication ingestion per patient and export it as a CSV file."];
    const CORPUS = [
      // positives — EN
      ["data", "Build an ETL pipeline that loads the orders from Postgres into BigQuery every night."], ["data", "A nightly job that recomputes the loyalty points in the warehouse."],
      ["data", "Add dbt tests for not-null and unique keys on the customers model."], ["data", "Backfill the last 90 days of the events table partitions after fixing the sessionization bug."],
      ["data", "Data quality checks on the payments feed: nulls, duplicates and out-of-range amounts are quarantined."],
      ["data", "Model the sales mart as a star schema with a fact table for orders and dimension tables for customers and products."],
      ["data", "Track the lineage of every dashboard metric back to its source tables."],
      ["data", "Schema evolution for the clickstream events: new optional fields must not break the downstream consumers."],
      ["data", "Airflow DAG that ingests the partner CSV drops from S3 and loads them into Snowflake."], ["data", "Move the reporting queries from the production database to the data warehouse."],
      ["data", "Handle late-arriving data in the daily revenue aggregation with a three-day lookback window."],
      ["data", "Keep a history of customer address changes as a slowly changing dimension (type 2)."], ["data", "Stream changes from Postgres to the data warehouse with a CDC pipeline."],
      ["data", "Set a freshness SLA on the orders table and alert the owner when it is stale."], ["data", "Migrate our Spark jobs to Databricks and make every run idempotent per partition."],
      ["data", "Ingestion pipeline for IoT sensor readings into the data lake, partitioned by day."],
      ["data", "Define data contracts between the checkout team and the analytics team for the orders dataset."], ["data", "Load the Stripe payouts into the warehouse tables every hour with Fivetran."],
      ["data", "Reduce the BigQuery cost of the weekly cohort report by partitioning and clustering the events table."],
      ["data", "Rebuild the incremental dbt models so a re-run of a day's partition replaces it instead of appending duplicate rows."],
      ["data", "Retention policy for the raw zone of the lakehouse: keep 30 days, then move to cold storage."],
      ["data", "The finance team needs a daily snapshot of the invoices table in the warehouse for their BI reports."],
      ["data", "Replicate the CRM contacts into Snowflake every hour and dedupe them by email."],
      // positives — PT
      ["data", "Pipeline de dados que carrega as encomendas no armazém de dados todas as noites."], ["data", "Verificações de qualidade de dados na ingestão: as linhas com chaves nulas ficam em quarentena."],
      ["data", "Fazer o backfill das partições dos últimos 30 dias do pipeline de eventos."], ["data", "Modelo em esquema em estrela com uma tabela de factos de vendas e tabelas de dimensão."],
      ["data", "Linhagem de dados dos indicadores do painel de gestão até às tabelas de origem."], ["data", "Job ETL noturno que agrega as vendas por loja no data warehouse."],
      ["data", "Evolução do esquema dos eventos de clique sem quebrar os consumidores."], ["data", "Carga incremental dos pedidos no BigQuery com modelos dbt."],
      // positives — ES
      ["data", "Pipeline de datos que carga los pedidos en el almacén de datos cada noche."], ["data", "Comprobaciones de calidad de datos en la ingesta: las filas con claves nulas van a cuarentena."],
      ["data", "Backfill de las particiones de los últimos 90 días del pipeline de eventos."], ["data", "Linaje de datos de cada métrica del cuadro de mando hasta sus tablas de origen."],
      ["data", "Proceso ETL nocturno que agrega las ventas por tienda en Snowflake."], ["data", "Evolución del esquema de los eventos sin romper a los consumidores."],
      ["data", "Tabla de hechos de pedidos y tablas de dimensiones de clientes y productos."],
      // hard negatives — EN
      ["", "Export orders as CSV."], ["", "A sales dashboard with revenue by region."], ["", "Migrate the users table to add a last_login column."], ["", "Import a CSV of contacts into the CRM."],
      ["", "Analytics events for the signup funnel."], ["", "Warehouse temperature monitoring: sensors report every minute and alerts go to the shift manager."],
      ["", "Sync stock levels between our three warehouses every 15 minutes."], ["", "Nightly job that recalculates the loyalty points of every customer and emails a summary."],
      ["", "Migrate the orders table to add a currency column; backfill existing rows with EUR."], ["", "Add a Snowflake icon to the winter theme."], ["", "Show the monthly totals in the PDF report."],
      ["", "The picking app shows the warehouse location of each item."], ["", "Improve the search query performance with an index on the products table."],
      ["", "Generate a dataset of synthetic users for the load test."], ["", "DBT skills diary for the therapy app."], ["", "Measure the airflow of each vent in the server room."],
      ["", "Partition the audit log table by month to speed up deletes."], ["", "Track button clicks with Google Analytics."],
      ["", "Deduplicate customer records in the CRM when two accounts share an email."], ["", "Redshift calculator for the astronomy club: estimate a galaxy's distance from its spectrum."],
      ["", "Ask the data engineer which export format the accountants need."], ["", "Warehouse staff scan pallets at the loading dock."],
      ["", "The data engineer wants a new column in the users table."], ["", "Add a column for the customer's VAT number and backfill it from the billing provider."],
      // hard negatives — PT / ES
      ["", "Exportar as encomendas em CSV."], ["", "Migrar a tabela de utilizadores para acrescentar uma coluna."], ["", "Importar um CSV de contactos."], ["", "Sincronizar o stock entre os armazéns."],
      ["", "Painel de vendas por região."], ["", "Exportar los pedidos a CSV."], ["", "Migrar la tabla de usuarios para añadir una columna."], ["", "Importar un CSV de contactos."],
      ["", "Sincronizar el stock entre los almacenes."], ["", "Informe mensual de ventas en PDF."],
      // 1.21 review B3 / B4 — words that mean something else in everyday text (hard negatives) and their data senses (positives)
      ...B3_OFF.map((t) => ["", t]), ...B3_ON.map((t) => ["data", t]), ...V3_ON.map((t) => ["data", t]),
      ...R34_ON.map((t) => ["data", t]), ...R34_OFF.map((t) => ["", t]),
    ];
    let tp = 0, fp = 0, pos = 0;
    const wrong = [];
    for (const [label, t] of CORPUS) {
      const want = label === "data", on = onOf(t, "data");
      if (want) pos++;
      if (on && want) tp++; else if (on) { fp++; wrong.push("FP " + t); } else if (want) wrong.push("FN " + t);
    }
    const precision = tp / (tp + fp || 1), recall = tp / (pos || 1);
    ok(CORPUS.length >= 40 && pos >= 20 && precision >= 0.9 && recall >= 0.85,
      `1.21 F4: +data precision ${(precision * 100).toFixed(0)}% / recall ${(recall * 100).toFixed(0)}% on ${CORPUS.length} EN / PT / ES texts, ${pos} positives (≥ 90% / 85%) (wrong: ` + js(wrong) + ")");
    // 1.21 review B3: every everyday text is off (+ui stays on for React Query), every data sense on; a table / a query backs no anchor with an
    // everyday sense (everydayAnchors — 1.21 verify V3: a data-term anchor it still backs); ELT, a freshness check, BI and "carga incremental"
    // count only as data phrases; B4: a stock screen per warehouse is the building — "in a table" no longer keeps the warehouse
    const b3Off = B3_OFF.filter((t) => onOf(t, "data")), b3On = B3_ON.filter((t) => !onOf(t, "data"));
    const rq = cls(B3_OFF[7]), scd = cls(B3_OFF[4]), orders = cls("Load the orders table into the warehouse every night with a Spark job.");
    ok(!b3Off.length && !b3On.length && rq.tracks.includes("ui") && !scd.tracks.includes("data") && scd.possible.some((p) => p.track === "data") &&
      orders.signals.data.includes("table") && !S.trackSignals("data").strong.includes("elt") && !S.trackSignals("data").weak.includes("BI") && S.trackSignals("data").weak.includes("lakehouse"),
      "1.21 review B3: +data turns on from data phrases only — a lakehouse to rent, ELT teachers, a kitchen's freshness check, parquet flooring, SCD patients, medication / water / calorie ingestion, duplicate rows in the users table, React Query's stale data (+ui only), the Portuguese BI, a training plan's carga incremental, a horse's lineage (EN / PT / ES) stay off; their data senses turn it on; a table never backs an everyday anchor (got " +
      js([b3Off, b3On, rq.label, scd.possible, orders.signals.data]) + ")");
    // 1.21 verify V3: a data-term anchor + a table / a query is +data again (a warehouse, a backfill, a BI dashboard, Power BI, parquet, carga
    // incremental), the data-sense cue beats an everyday word in the same sentence (bookkeeping, guests, nights, stays, grocery, family),
    // and a BI phrase matches at a sentence start or in title case ("Relatório de BI", "BI Dashboard" — "BI" itself still case-sensitive)
    const v3Off = V3_ON.filter((t) => !onOf(t, "data"));
    const guest = cls(V3_ON[8]), bi = cls("Relatório de BI sobre as vendas."), biLower = cls("o número do bi e o relatório de bi da loja.");
    ok(!v3Off.length && guest.tracks.includes("tdd") && bi.signals.data.includes("relatório de BI") && !biLower.signals.data.length &&
      S.trackSignals("data").weak.includes("warehouse") && !B3_OFF.some((t) => onOf(t, "data")),
      "1.21 verify V3: 'A BI dashboard over the orders table', 'Load the orders table into the warehouse every night', 'Backfill the orders table…', 'Query the warehouse…', 'A Power BI report over the sales table', 'Nightly export of the orders table to parquet', 'Carga incremental diária da tabela de encomendas' are +data; a lakehouse / freshness check / lineage beside bookkeeping, guests, nights, stays, grocery or a product family is +data; 'Relatório de BI' / 'Informe de BI' / 'Herramienta de BI' / 'Ferramenta de BI' / 'BI Dashboard' match (a lower-case 'bi' never does); every everyday negative stays off (got " +
      js([v3Off, guest.label, bi.signals.data, biLower.signals.data]) + ")");
    // 1.21 verify R3: the lineage of reports / fields / models is data work — tried after the animals / families (a horse's lineage in a
    // report stays off); R4: ingestion of CSV files / feeds into a table or a lake and a type-2 SCD are strong (medication / water ingestion,
    // SCD patients stay off); R1: "We do not need a data warehouse", "We will not build a data pipeline" exclude +data
    const r3 = R34_ON.slice(0, 6).filter((t) => !onOf(t, "data")), r4 = R34_ON.slice(6).filter((t) => !onOf(t, "data"));
    const r34Off = [...R34_OFF, B3_OFF[4], B3_OFF[5], B3_OFF[8], B3_OFF[12]].filter((t) => onOf(t, "data"));
    ok(!r3.length && !r4.length && !r34Off.length,
      "1.21 verify R3 / R4: 'Lineage between the orders table and the revenue report', 'Field-level lineage for the revenue report', 'Linhagem de cada campo do relatório', 'Linaje de cada campo del informe', 'Ingestion of CSV files into the orders table' (PT / ES) and 'SCD type 2 on the customers table' are +data; a horse's lineage in a report, medication / water / calorie ingestion, SCD patient records and 'We do not need a data warehouse' / 'We will not build a data pipeline' are not (got " +
      js([r3, r4, r34Off]) + ")");
    // 1.21 verify N2: water / medication ingestion named next to the word stays everyday even beside a CSV file (EN / PT / ES); ingestion of
    // JSON / CSV files into a bucket, a table or a lake stays data
    const n2Off = R34_OFF.slice(-4).filter((t) => onOf(t, "data"));
    const n2On = ["Ingestion of JSON files into the S3 bucket nightly.", "Ingestão de ficheiros JSON para o data lake.", "Ingesta de ficheros CSV en el bucket de S3."].filter((t) => !onOf(t, "data"));
    ok(!n2Off.length && !n2On.length,
      "1.21 verify N2: 'Log the daily water ingestion of each patient in a CSV file' (PT 'ingestão diária de água', ES 'ingesta diaria de agua') and 'Track medication ingestion … as a CSV file' are no +data; ingestion of JSON / CSV files into a bucket or a lake is (got " +
      js([n2Off, n2On]) + ")");
    const b4 = [cls(B3_OFF[15]), cls(B3_OFF[16])];
    ok(b4.every((r) => !r.tracks.includes("data") && !(r.signals.data || []).length) && cls("Load the Stripe payouts into the warehouse tables every hour with Fivetran.").tracks.includes("data"),
      "1.21 review B4: a warehouse in a sentence about stock is the building even with 'in a table' (no +data signal at all) — the keep rule no longer lists tables / columns / queries (got " + js(b4.map((r) => r.signals.data)) + ")");

    // the cues: a warehouse in a sentence about the building is no signal, one about data an anchor; a migration's backfill is app-level,
    // a pipeline's an anchor; "into Snowflake" is the product; DBT therapy, a vent's airflow, a galaxy's redshift are no signal; a role alone
    // and a table alone name no pipeline; the older tracks keep their words
    const wh = cls("Warehouse temperature monitoring: sensors report every minute and alerts go to the shift manager.");
    const whData = cls("A nightly job that recomputes the loyalty points in the warehouse.");
    const mig = cls("Migrate the orders table to add a currency column; backfill existing rows with EUR.");
    const bf = cls("Backfill the last 90 days of partitions in the events pipeline.");
    const snow = cls("Replicate the CRM contacts into Snowflake every hour."), icon = cls("Add a Snowflake icon to the winter theme.");
    const role = cls("The data engineer wants a new column in the users table."), tbl = cls("Migrate the users table.");
    const ana = cls("Analytics events for the signup funnel.");
    all("1.21 F4: +data cues — a warehouse among stock / temperature / shifts is no signal, among data words an anchor; a migration's backfill is app-level ('possible' at most), a pipeline's backfill is data; 'into Snowflake' is the product, a Snowflake icon / DBT therapy / a vent's Airflow / a galaxy's Redshift are not; a data engineer or a table alone name no pipeline; analytics alone is 'possible' at most (got " +
      js([wh.signals.data, mig.signals.data, mig.label, snow.signals.data, role.signals.data, ana.possible]) + ")", [
      () => !(wh.signals.data || []).length, () => whData.tracks.includes("data"), () => !mig.tracks.includes("data"),
      () => mig.possible.some((p) => p.track === "data"), () => mig.tracks.includes("tdd"), () => bf.tracks.includes("data"),
      () => snow.tracks.includes("data"), () => !icon.signals.data.length, () => !cls("DBT skills diary for the therapy app.").signals.data.length,
      () => !cls("Measure the Airflow readings of each vent.").signals.data.length,
      () => !cls("Redshift of each galaxy in the survey.").signals.data.length, () => !role.tracks.includes("data"),
      () => role.possible.some((p) => p.track === "data"), () => !tbl.signals.data.length, () => !ana.tracks.includes("data"),
      () => ana.notes.some((n) => /none names a data pipeline concern/.test(n) || /Possible \+data/.test(n)),
      () => S.signalConcept("data", "row") === "sql", () => S.signalConcept("data", "table") === "sql",
      () => S.signalConcept("data", "looker") === "bi",
    ]);
    // the older tracks keep their decisions on shared phrases: an ETL job stays an +obs technical target, CDC stays +dist, data retention +privacy
    const etlObs = cls("Monitor the ETL job and alert the on-call engineer when it fails."), cdc = cls("Stream changes from Postgres to the data warehouse with a CDC pipeline.");
    const ret = cls("Data retention: delete the personal data of closed accounts after 30 days.");
    ok(etlObs.tracks.includes("obs") && etlObs.tracks.includes("data") && cdc.tracks.includes("dist") && cdc.tracks.includes("data") && ret.tracks.includes("privacy") &&
      !ret.tracks.includes("data") && cls("Monitor the ETL job and alert the on-call engineer when it fails.").signals.obs.includes("etl job"),
      "1.21 F4: shared phrases serve both tracks — an ETL job is +obs's technical target and +data's anchor, a CDC pipeline +dist and +data; data retention of personal data stays +privacy only (got " +
      js([etlObs.label, cdc.label, ret.label]) + ")");
  }

  { // 1.21 F4 — the example +mobile track pack (examples/track-packs/mobile): copied into a project's .specs/tracks/mobile/ it is a valid pack —
    // tracks check passes with no warning; a feature scaffolds its criteria, sections, tasks, test rows, checklist and steering (EN / PT / ES), its
    // sections gate the design, and the classifier reads its signals
    const src = path.join(__dirname, "..", "examples", "track-packs", "mobile");
    const mp = path.join(tmp, "p21-mobile");
    S.initProject(mp, ["core"], "en");
    fs.cpSync(src, path.join(mp, ".specs", "tracks", "mobile"), { recursive: true });
    const call = (name, args) => rpc("tools/call", { name, arguments: args });
    const chkM = payload(await call("spec_tracks", { action: "check", projectDir: mp }));
    const lst = S.trackPacks(mp, "list"), row = (lst.packs || []).find((p) => p.name === "mobile") || {};
    const f = S.createFeature(mp, "Offline orders", ["tdd", "mobile"], "", undefined, "en");
    const reqs = rd(f.dir, "requirements.md"), design = rd(f.dir, "design.md"), tasks = rd(f.dir, "tasks.md"), plan = rd(f.dir, "test-plan.md"), list = rd(f.dir, "checklist.md");
    const doc = S.specDoctor(mp, f.slug), tr = S.traceCheck(mp, f.slug);
    S.approvePhase(mp, f.slug, "classification", "t", { force: true });
    S.approvePhase(mp, f.slug, "requirements", "t", { force: true });
    const refused = S.approvePhase(mp, f.slug, "design", "t");
    dropTodo(path.join(f.dir, "design.md"));
    const after = chk(S.specDoctor(mp, f.slug), "mobile-sections");
    const pt = S.createFeature(mp, "Pedidos offline", ["mobile"], "", undefined, "pt"), es = S.createFeature(mp, "Pedidos sin conexion", ["mobile"], "", undefined, "es");
    const ptReq = rd(pt.dir, "requirements.md"), esReq = rd(es.dir, "requirements.md"), ptTasks = rd(pt.dir, "tasks.md");
    const c = S.classify("An offline-first mobile app for field technicians, with push notifications.", { projectDir: mp });
    all("1.21 F4: examples/track-packs/mobile copied into .specs/tracks/mobile/ is a valid pack (tracks check: pass, 0 errors, 0 warnings — [MOBILE], 5 sections, steering mobile.md); a +tdd +mobile feature gets US-1.AC-5..9, five [MOBILE] sections, the task block, test rows and checklist items, and mobile-sections gates the design until filled; PT / ES features read pt/ and es/; the classifier turns +mobile on; 'mobile' is no reserved name (got " +
      js([chkM.verdict, chkM.problems, row, doc.checks.filter((x) => x.status === "fail").map((x) => x.id), after.detail, c.label]) + ")", [
      () => chkM.ok, () => chkM.verdict === "pass", () => chkM.errors === 0, () => chkM.warnings === 0, () => row.valid,
      () => row.marker === "[MOBILE]", () => row.sections.length === 5, () => row.steering === "mobile.md", () => f.ok,
      () => f.label === "core +tdd +mobile", () => /#### \[MOBILE\] Mobile App — Acceptance Criteria \(EARS\)/.test(reqs),
      () => ["5", "6", "7", "8", "9"].every((n) => reqs.includes("US-1.AC-" + n)), () => (design.match(/^## \[MOBILE\] /gm) || []).length === 5,
      () => /## Story US-1 — \[MOBILE\] Mobile App/.test(tasks), () => /Offline store and sync queue for Offline orders/.test(tasks),
      () => /## \[MOBILE\] Traceability Matrix/.test(plan), () => /- \[ \] MOBILE: Airplane-mode walk-through done/.test(list),
      () => fs.existsSync(path.join(mp, ".specs", "steering", "mobile.md")), () => chk(doc, "mobile-sections").status === "fail", () => !refused.ok,
      () => refused.failing.includes("mobile-sections"), () => after.status === "pass", () => !tr.uncoveredByTasks.length,
      () => !tr.uncoveredByTests.length, () => !tr.phantomAcsInTasks.length,
      () => /#### \[MOBILE\] Aplicação Móvel — Critérios de Aceitação/.test(ptReq),
      () => /QUANDO o dispositivo estiver offline O SISTEMA DEVE/.test(ptReq), () => /Armazenamento offline e fila de sincronização/.test(ptTasks),
      () => /#### \[MOBILE\] Aplicación Móvil — Criterios de Aceptación/.test(esReq),
      () => /CUANDO el dispositivo esté sin conexión EL SISTEMA DEBE/.test(esReq), () => c.tracks.includes("mobile"),
    ]);
    // 1.21 review B6: the pack is localized whole — a PT / pt-BR / ES +tdd +mobile feature (a fresh project each: the steering file is the
    // first feature's) gets its test rows and steering/mobile.md in its language (pt-BR reads pt/, the folder chain); check stays clean
    const locRows = { pt: [/## \[MOBILE\] Matriz de Rastreabilidade/, /\| T-\d+ \| e2e \| example \| modo de avião: as ações principais continuam disponíveis/],
      "pt-BR": [/## \[MOBILE\] Matriz de Rastreabilidade/, /\| T-\d+ \| integração \| property \| dois dispositivos editam o mesmo registo offline/],
      es: [/## \[MOBILE\] Matriz de Trazabilidad/, /\| T-\d+ \| e2e \| example \| modo avión: las acciones principales siguen disponibles/] };
    const locSteer = { pt: /^# Padrões Móveis/, "pt-BR": /^# Padrões Móveis/, es: /^# Estándares Móviles/ };
    const loc = [];
    for (const lang of ["pt", "pt-BR", "es"]) {
      const lp = path.join(tmp, "p21-mobile-" + lang);
      S.initProject(lp, ["core"], lang);
      fs.cpSync(src, path.join(lp, ".specs", "tracks", "mobile"), { recursive: true });
      const lc = S.trackPacks(lp, "check");
      const lf = S.createFeature(lp, "App " + lang, ["tdd", "mobile"], "", undefined, lang);
      const lPlan = rd(lf.dir, "test-plan.md"), lSteer = rd(lp, ".specs", "steering", "mobile.md"), lTr = S.traceCheck(lp, lf.slug);
      if (!(lc.verdict === "pass" && lc.errors === 0 && lc.warnings === 0 && locRows[lang].every((re) => re.test(lPlan)) && locSteer[lang].test(lSteer) &&
        !/airplane mode|Mobile Standards/.test(lPlan + lSteer) && !lTr.uncoveredByTests.length && !lTr.uncoveredByTasks.length))
        loc.push([lang, lc.verdict, lc.problems, lPlan.split("\n").filter((l) => /US-1\.AC-[5-9] /.test(l)), lSteer.split("\n")[0]]);
    }
    ok(!loc.length && ["pt", "es"].every((l) => ["test-plan.md", "steering.md", "requirements.md", "tasks.md", "checklist.md"].every((fr) => fs.existsSync(path.join(src, l, fr)))),
      "1.21 review B6: the +mobile example pack is localized whole — pt/ and es/ hold test-plan.md and steering.md too; PT / pt-BR (pt/) / ES features get their [MOBILE] test rows and steering/mobile.md in their language; tracks check stays clean (got " +
      js(loc) + ")");
    // the guide and the README (1.26: each language's file) point to it
    const guide = fs.readFileSync(path.join(__dirname, "..", "skills", "dev-spec-driven", "references", "project-tracks.md"), "utf8");
    const readmes = ["README.md", "README.pt.md", "README.es.md"].map((f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8"));
    ok(/examples\/track-packs\/mobile/.test(guide) && /\.specs\/tracks\/mobile/.test(guide) && readmes.every((readme) => /examples\/track-packs\/mobile/.test(readme)),
      "1.21 F4: references/project-tracks.md and README.md / .pt.md / .es.md point to examples/track-packs/mobile (copy it to .specs/tracks/mobile to start)");
  }
};
