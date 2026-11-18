"use strict";
// The built-in +port track (1.36 — port first, improve later): registry, classifier (suggest-only verbs, technique names, the network /
// schema cues), scaffolds (EN / PT / ES / pt-BR, sizes, +tdd — the baseline first), add_track / remove, a project template (1.36.0 review 1:
// Kiro-like, nested, under a level-1 heading), spec_import's no-fence warning, the bugfix refusal, legacy packs, views.

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, all, payload, rpc, S, tmp, require }) => {
  const I = require("./lib/i18n.js");
  const js = (v) => JSON.stringify(v);
  const rd = (...p) => fs.readFileSync(path.join(...p), "utf8");
  const chk = (doc, id) => doc.checks.find((c) => c.id === id) || {};
  const dropTodo = (file) => fs.writeFileSync(file, rd(file).split(/\r?\n/).map((l) => (/^\s*>\s*\*\*TODO\*\*/.test(l) ? "Decided for this feature: the concrete answer written here." : l)).join("\n"));
  const cls = (t, lang) => S.classify(t, lang ? { lang } : {});
  const pRoot = path.join(tmp, "p36-port");
  const d = (n) => path.join(pRoot, n);
  const SECTIONS = ["Behaviour Baseline", "Differential Check", "Deferred Improvements"];
  // the two template task headings of a language (the baseline's first), as tasks.md writes them
  const heads = (lang) => I.msg(lang).tracks.taskBlock("port", 1).match(/^## .*$/gm);
  const taskLine = (text, n) => text.split("\n").findIndex((l) => new RegExp("^- \\[ \\] " + n + "\\. ").test(l));

  { // 1.36 — the registry: a valid, composable marker track after +data, three sections (Deferred Improvements extended), no steering, no alias
    const typo = S.createFeature(d("typo"), "Typo", "portt");
    const reserved = ["port"].filter((n) => !S.trackPacks(d("typo"), "init", { name: n }).ok);
    all("1.36: +port is a valid, composable marker track ([PORT], 3 sections — Deferred Improvements optional at size s —, after +data, no steering file); 'portt' gets a did-you-mean; 'port' is a reserved pack name (got " +
      js([S.OPTIONAL_TRACKS, typo.error]) + ")", [
      () => S.VALID_TRACKS.indexOf("port") === S.VALID_TRACKS.indexOf("data") + 1, () => S.TRACK_MARKER.port === "[PORT]",
      () => js(S.trackSections("port").map((x) => x.name)) === js(SECTIONS), () => S.trackSections("port").map((x) => x.tier || "core").join() === "core,core,extended",
      () => S.trackLabel(S.normalizeTracks("port data tdd")) === "core +tdd +data +port", () => !typo.ok, () => /did you mean 'port'/.test(typo.error),
      () => reserved.length === 1, () => !S.trackSignals("port").strong.some((k) => /functional change|without changing/.test(k)),
    ]);
  }

  { // scaffolds per language (no size, +tdd): the [PORT] criteria US-1.AC-36 / 37, three [PORT] sections with the TODO sentinel, the baseline
    // task FIRST (task 1, under its own heading, before Setup) and the differential check after US-1's tasks, the test rows, the checklist items
    const bad = [];
    for (const lang of ["en", "pt", "es", "pt-BR"]) {
      const p = d("scaffold-" + lang);
      const f = S.createFeature(p, "port " + lang, ["tdd", "port"], "", undefined, lang);
      const design = rd(f.dir, "design.md"), reqs = rd(f.dir, "requirements.md"), tasks = rd(f.dir, "tasks.md"), plan = rd(f.dir, "test-plan.md"), list = rd(f.dir, "checklist.md");
      const [lead, main] = heads(lang);
      const lines = tasks.split("\n");
      const b = taskLine(tasks, 1), dl = lines.findIndex((l) => l === main);
      const setup = lines.findIndex((l) => /^## /.test(l) && l !== lead && lines.indexOf(l) > lines.indexOf(lead));
      const before = S.specDoctor(p, f.slug);
      const e = S.earsValidate(reqs, lang);
      const states = fs.readdirSync(f.dir).filter((nm) => nm.endsWith(".md") && nm !== "checklist.md").map((nm) => S.artifactState(path.join(f.dir, nm)));
      const conds = {
        ok: f.ok && f.label === "core +tdd +port", sections: design.split("\n").filter((l) => l.startsWith("## [PORT] ")).length === 3,
        todo: (design.match(/^> \*\*TODO\*\*/gm) || []).length === 3 + 0, criteria: reqs.includes("#### [PORT]") && /\*\*US-1\.AC-36\*\*/.test(reqs) && /\*\*US-1\.AC-37\*\*/.test(reqs),
        ears: !e.issues.some((i) => i.severity === "error"), leadFirst: lines.indexOf(lead) > 0 && b === lines.indexOf(lead) + 1 && setup > b,
        b: /_Requirements: US-1\.AC-36, US-1\.AC-37_/.test(lines[b + 1]) && /^ {2}- _Implements: \[/.test(lines[b + 2]) && /^ {2}- _Verify: \[/.test(lines[b + 3]),
        mainAfterUs1: dl > taskLine(tasks, 5) && taskLine(tasks, 6) === dl + 1, d: /_Makes green: T-06, T-07_/.test(lines[dl + 3]) && /^ {2}- _Verify: \[/.test(lines[dl + 4]),
        rows: /\| T-06 \| [^|]+ \| property \| [^|]+ \| US-1\.AC-36 \|/.test(plan) && /\| T-07 \| [^|]+ \| property \| [^|]+ \| US-1\.AC-37 \|/.test(plan),
        checklist: (list.match(/^- \[ \] PORT: /gm) || []).length === 3, placeholder: states.every((s) => s === "placeholder"),
        sectionsFail: chk(before, "port-sections").status === "fail", noVerifyCheck: !chk(before, "port-verify").status,
      };
      const miss = Object.keys(conds).filter((k) => !conds[k]);
      if (miss.length) bad.push([lang, miss]);
    }
    ok(!bad.length, "1.36: EN / PT / ES / pt-BR +port scaffolds — the [PORT] criteria US-1.AC-36 / 37 (EARS clean), three [PORT] sections with the TODO sentinel, the baseline task first (task 1 under its own heading, before Setup, with _Implements:_ / _Verify:_ slots), the differential check after US-1's tasks (_Makes green: T-06, T-07_, a _Verify:_ slot), property rows for AC-36 / 37, three PORT checklist items; every artifact a placeholder, port-sections fails, port-verify waits while tasks.md is a template (got " + js(bad) + ")");
    const br = rd(path.join(d("scaffold-pt-BR"), ".specs", "port-pt-br"), "tasks.md");
    ok(br.includes(heads("pt-BR")[0]) && I.toPtBr(br) === br && heads("pt")[0] === "## História US-1 — Linha de Base do Comportamento (antes do porte)",
      "1.36: pt-BR's +port tasks are pt's derived (idempotent), its headings the derived ones (got " + js(heads("pt-BR")) + ")");
  }

  { // a filled +port feature is ready (EN / PT / ES): doctor has no fail (port-verify passes) and every gate approves without force; markers are
    // case-sensitive ('[port]' is prose), an ordinary "## Baseline" never stands in for a deleted [PORT] section; spec_import classifies a
    // technique name as +port and appends the [PORT] sections to the imported design
    const SLOT = /\[(?!shared\]|US\d+\]|[ xX]\]|P\]|PORT\]|NEEDS)[^\]\n]*\]/g;
    const filled = [];
    for (const lang of ["en", "pt", "es"]) {
      const p = d("filled-" + lang);
      S.initProject(p, ["core"], lang);
      const f = S.createFeature(p, "Filled " + lang, ["port"], "", undefined, lang);
      for (const file of ["classification.md", "requirements.md", "design.md", "tasks.md"]) {
        const fp = path.join(f.dir, file);
        let t = rd(fp);
        for (let i = 0; i < 3; i++) t = t.replace(SLOT, "the ledger import");
        fs.writeFileSync(fp, t.split(/\r?\n/).map((l) => (/^\s*>\s*\*\*TODO\*\*/.test(l) ? "Decided for this feature: the concrete answer written here." : l)).join("\n"));
      }
      const doc = S.specDoctor(p, f.slug);
      const gates = ["classification", "requirements", "design", "tasks"].map((ph) => [ph, S.approvePhase(p, f.slug, ph, "t")]);
      if (!(!doc.checks.some((c) => c.status === "fail") && chk(doc, "port-verify").status === "pass" && chk(doc, "port-sections").status === "pass" && gates.every(([ph, r]) => r.ok && r.approved === ph && !r.forced)))
        filled.push([lang, doc.checks.filter((c) => c.status === "fail").map((c) => c.id + ": " + c.detail), chk(doc, "port-verify"), gates.filter(([, r]) => !r.ok).map(([ph, r]) => ph + ":" + (r.failing || []).join(","))]);
    }
    ok(!filled.length, "1.36: EN / PT / ES — a filled +port feature is ready (no doctor fail, port-verify and port-sections pass) and classification → requirements → design → tasks approve without force (got " + js(filled) + ")");
    const cs = d("case");
    const csF = S.createFeature(cs, "Case", ["core"], "", undefined, "en");
    fs.appendFileSync(path.join(csF.dir, "design.md"), "\n### Notes [port]\n- the [port] number of the proxy\n");
    const csState = path.join(csF.dir, ".state.json");
    const csSt = JSON.parse(rd(csState)); delete csSt.tracks; fs.writeFileSync(csState, JSON.stringify(csSt, null, 2));
    const csTracks = S.statusFeature(cs, csF.slug).tracks;
    fs.appendFileSync(path.join(csF.dir, "design.md"), "\n## [PORT] Behaviour Baseline\n- the old outputs\n");
    const csInferred = S.statusFeature(cs, csF.slug).tracks;
    const lz = S.createFeature(d("loose"), "Loose", ["port"], "", undefined, "en");
    dropTodo(path.join(lz.dir, "design.md"));
    fs.writeFileSync(path.join(lz.dir, "design.md"), rd(lz.dir, "design.md").replace("## [PORT] Behaviour Baseline", "## Baseline"));
    const lzDoc = chk(S.specDoctor(d("loose"), lz.slug), "port-sections");
    const im = d("import");
    fs.mkdirSync(path.join(im, ".kiro", "specs", "ledger"), { recursive: true });
    fs.writeFileSync(path.join(im, ".kiro", "specs", "ledger", "requirements.md"), "### Requirement 1\n\n**User Story:** As an accountant, I want the ledger ported.\n\n#### Acceptance Criteria\n\n1. WHEN the new importer reads a golden master case THEN the system SHALL produce the recorded output\n");
    fs.writeFileSync(path.join(im, ".kiro", "specs", "ledger", "design.md"), "# Design\n\n## Overview\nThe ledger port.\n");
    const imp = S.importSpec(im, "kiro", ".kiro/specs/ledger", {});
    const impDesign = imp.ok ? rd(im, ".specs", "ledger", "design.md") : "";
    const impTasks = imp.ok ? rd(im, ".specs", "ledger", "tasks.md") : "";
    all("1.36: a lower-case '[port]' is prose (no +port inferred), a '[PORT]' heading infers it; an ordinary '## Baseline' never satisfies [PORT] Behaviour Baseline; spec_import classifies a golden master as +port, appends the [PORT] sections and keeps the baseline task first (got " +
      js([csTracks, csInferred, lzDoc.detail, imp.tracks]) + ")", [
      () => csTracks === "core", () => csInferred === "core +port", () => lzDoc.status === "fail", () => lzDoc.detail.includes("Behaviour Baseline:missing"),
      () => imp.ok && imp.tracks.includes("port"), () => /The ledger port/.test(impDesign), () => impDesign.includes("## [PORT] Differential Check"),
      () => taskLine(impTasks, 1) === impTasks.split("\n").indexOf(heads("en")[0]) + 1, // the kept scaffold, fitted: the baseline still first
    ]);
  }

  { // 1.36 review 1 (PORT-7): spec_import of a source WITH tasks.md replaces the scaffold's plan — a +port feature whose imported plan has no
    // baseline and no differential check holds nothing: a warning names it and the way to get both (another marker track: no such warning; a
    // source without tasks.md keeps the scaffold's anchors, a source plan under the template's headings draws them: none)
    const PLAIN = "# Implementation Plan\n\n- [ ] 1. Write the Go reader\n  - _Requirements: 1.1_\n- [ ] 2. Remove the Python importer\n  - _Requirements: 1.1_\n";
    const [lead, main] = heads("en");
    const FENCED = `# Implementation Plan\n\n${lead}\n\n- [ ] 1. Record the old importer's rows\n  - _Requirements: 1.1_\n\n${main}\n\n- [ ] 2. Compare the Go reader's rows with them\n  - _Requirements: 1.1_\n`;
    const imw = (name, tr, tasks) => {
      const p = d("imp-fence-" + name);
      fs.mkdirSync(path.join(p, ".kiro", "specs", "ledger"), { recursive: true });
      fs.writeFileSync(path.join(p, ".kiro", "specs", "ledger", "requirements.md"), "### Requirement 1\n\n**User Story:** As an accountant, I want the ledger importer moved to Go.\n\n" +
        "#### Acceptance Criteria\n\n1. WHEN the new importer reads a ledger file THEN the system SHALL produce the same rows as the old one\n");
      if (tasks) fs.writeFileSync(path.join(p, ".kiro", "specs", "ledger", "tasks.md"), tasks);
      S.initProject(p, [], "en");
      return S.importSpec(p, "kiro", ".kiro/specs/ledger", { tracks: [tr] });
    };
    const W = S.msg("en").importSpec.wPortNoFence("ledger");
    const port = imw("port", "port", PLAIN), data = imw("data", "data", PLAIN), kept = imw("kept", "port", null), fenced = imw("fenced", "port", FENCED);
    all("1.36 review 1 (PORT-7): an imported tasks.md of a +port feature with no baseline / differential check warns (the fence holds nothing, add-track's way to both); +data's import, a +port import keeping the scaffold's plan and one whose plan sits under the template's headings don't (got " +
      js([port.warnings, data.warnings, kept.warnings, fenced.warnings]) + ")", [
      () => port.ok && port.warnings.includes(W), () => data.ok && !data.warnings.some((w) => /\+port/.test(w)), () => kept.ok && !kept.warnings.includes(W),
      () => fenced.ok && !fenced.warnings.includes(W),
    ]);
  }

  { // sizes: s — the baseline task 1, the core task 2, the differential check 3; Deferred Improvements left out (extended) with the comment;
    // m — the baseline first, before Setup
    const p = d("sizes");
    const s = S.createFeature(p, "Small port", ["port"], "", undefined, "en", undefined, { size: "s" });
    const m = S.createFeature(p, "Medium port", ["port"], "", undefined, "en", undefined, { size: "m" });
    const sT = rd(s.dir, "tasks.md"), sD = rd(s.dir, "design.md"), mT = rd(m.dir, "tasks.md");
    const [lead, main] = heads("en");
    const blocks = S.parseTasks(sT);
    all("1.36: size s — task 1 the baseline, 2 the core task, 3 the differential check; the design's two core [PORT] sections, Deferred Improvements left out with its comment (extended); size m — the baseline task first, before Setup (got " +
      js([blocks.map((x) => x.number + " " + x.text.slice(0, 30)), sD.split("\n").filter((l) => l.includes("[PORT]"))]) + ")", [
      () => blocks.length === 3, () => sT.indexOf(lead) < sT.indexOf("## Story US-1 (P1"), () => sT.indexOf("## Story US-1 (P1") < sT.indexOf(main),
      () => taskLine(sT, 1) === sT.split("\n").indexOf(lead) + 1, () => taskLine(sT, 3) === sT.split("\n").indexOf(main) + 1,
      () => sD.includes("## [PORT] Behaviour Baseline"), () => sD.includes("## [PORT] Differential Check"), () => !sD.includes("## [PORT] Deferred Improvements"),
      () => /<!-- .*\[PORT\].*Deferred Improvements/.test(sD),
      () => taskLine(mT, 1) === mT.split("\n").indexOf(lead) + 1, () => mT.indexOf(lead) < mT.indexOf("## Phase: Setup"),
    ]);
  }

  { // add_track on an untouched scaffold: both parts in order (1.36 review 3: the baseline's section before the first task section — no task is
    // ticked —, the differential check appended), numbered after the last task, a placeholder for the [PORT] criterion (the requirements predate
    // the track); --remove drops BOTH sections from the active tasks; re-add duplicates nothing
    const at = d("add");
    S.initProject(at, ["core"], "en");
    const plain = S.createFeature(at, "Plain", ["core"], "", undefined, "en");
    const tBefore = S.statusFeature(at, plain.slug).tasks.total;
    const add = S.addTrack(at, plain.slug, "+port");
    const t = rd(plain.dir, "tasks.md");
    const [lead, main] = heads("en");
    const tAdded = S.statusFeature(at, plain.slug).tasks.total;
    const rm = S.removeTrack(at, plain.slug, "port");
    const stRm = S.statusFeature(at, plain.slug);
    const reAdd = S.addTrack(at, plain.slug, "port");
    all("1.36: add_track +port writes the baseline (review 3: before the scaffold's first task section) then the differential check (numbered after the last task, placeholder criteria, no steering); --remove makes both sections inactive (portSections null, neither task counted); re-adding duplicates nothing (got " +
      js([add.added, rm.inactive, tBefore, tAdded, stRm.tasks.total]) + ")", [
      () => add.ok, () => add.tracks === "core +port", () => !(add.added || []).some((x) => x.startsWith("steering/")), () => t.indexOf(lead) > 0, () => t.indexOf(lead) < t.indexOf(main),
      () => t.indexOf(lead) < t.indexOf("## Phase: Setup"),
      () => taskLine(t, tBefore + 1) === t.split("\n").indexOf(lead) + 1, () => taskLine(t, tBefore + 2) === t.split("\n").indexOf(main) + 1,
      () => (t.match(/_Requirements: \[the \+port criterion this task proves\]_/g) || []).length === 2, () => tAdded === tBefore + 2,
      () => rm.ok, () => rm.inactive.includes("design.md ([PORT] sections)"), () => stRm.tasks.total === tBefore, () => stRm.portSections === null,
      () => reAdd.ok, () => rd(plain.dir, "tasks.md").split(main).length === 2, () => S.statusFeature(at, plain.slug).tasks.total === tBefore + 2,
    ]);
  }

  { // 1.36 review 3 (PF3-1): add_track's baseline insertion keeps tasks.md's own line ends (a CRLF scaffold stays CRLF — no bare LF), and where
    // no level-2 section holds the first task (Kiro's tasks under the title) the whole block is appended as before — a code block left open at
    // the end closed first, the baseline a task (never swallowed by the fence)
    const [lead, main] = heads("en");
    const cr = d("add-crlf");
    S.initProject(cr, ["core"], "en");
    const fc = S.createFeature(cr, "Crlf", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(fc.dir, "tasks.md"), rd(fc.dir, "tasks.md").replace(/\r?\n/g, "\r\n"));
    const cBefore = S.statusFeature(cr, fc.slug).tasks.total, cAdd = S.addTrack(cr, fc.slug, "port");
    const cT = rd(fc.dir, "tasks.md"), cNext = S.nextTask(cr, fc.slug).next;
    const kf = d("add-kiro-fence");
    S.initProject(kf, ["core"], "en");
    const fk = S.createFeature(kf, "Kiro fence", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(fk.dir, "tasks.md"), "# Implementation Plan\n\n- [ ] 1. Build it\n  - _Requirements: US-1.AC-1_\n- [ ] 2. Ship it\n  - _Requirements: US-1.AC-2_\n\n```text\nnotes left open\n");
    const kAdd = S.addTrack(kf, fk.slug, "port"), kT = rd(fk.dir, "tasks.md"), kSt = S.statusFeature(kf, fk.slug).tasks;
    all("1.36 review 3 (PF3-1): add_track +port on a CRLF scaffold — the baseline's section before the first task section in CRLF, no bare LF, next_task serves it; on Kiro's layout ending in an open code block — appended after the block is closed, both [PORT] tasks counted (got " +
      js([cAdd.ok, /[^\r]\n/.test(cT), cT.indexOf(lead) < cT.indexOf("## Phase: Setup"), cNext, kAdd.ok, kSt.total, kSt.list.map((x) => x.number)]) + ")", [
      () => cAdd.ok && !/(^|[^\r])\n/.test(cT) && cT.indexOf(lead) > 0 && cT.indexOf(lead) < cT.indexOf("## Phase: Setup") && cT.indexOf(main) > cT.indexOf("## Phase: Polish"),
      () => cNext && cNext.number === cBefore + 1,
      () => kAdd.ok && kT.indexOf(lead) > kT.indexOf("notes left open") && kSt.total === 4 && js(kSt.list.map((x) => x.number)) === "[1,2,3,4]",
    ]);
  }

  { // a project template tasks.md: the baseline section goes BEFORE the template's first task section (its heading), the differential check at
    // the end; next_task serves the baseline first (tasks order: by section in file order)
    const pt = d("template");
    S.initProject(pt, ["core"], "en");
    fs.mkdirSync(path.join(pt, ".specs", "templates"), { recursive: true });
    fs.writeFileSync(path.join(pt, ".specs", "templates", "tasks.md"), "# Tasks: {{name}}\n\nTeam notes.\n\n## Phase 1 — Build\n- [ ] 1. Build it\n  - _Requirements: US-1.AC-1_\n\n## Phase 2 — Ship\n- [ ] 2. Ship it\n");
    const f = S.createFeature(pt, "Templated port", ["port"], "", undefined, "en");
    const t = rd(f.dir, "tasks.md"), L = t.split("\n");
    const [lead, main] = heads("en");
    const next = S.nextTask(pt, f.slug);
    all("1.36: a project's tasks template + port — the baseline's section inserted right before the template's first task section, the differential check appended; next_task serves the baseline first (got " +
      js([L.filter((l) => /^#{1,2} /.test(l)), next.next]) + ")", [
      () => f.ok, () => L[L.indexOf(lead) + 1].startsWith("- [ ] 3. "), () => L.indexOf(lead) < L.indexOf("## Phase 1 — Build"),
      () => L.slice(L.indexOf(lead) + 1, L.indexOf("## Phase 1 — Build")).every((l) => !/^#/.test(l)) && L[L.indexOf("## Phase 1 — Build") - 1] === "",
      () => L.indexOf("Team notes.") < L.indexOf(lead), () => L.indexOf(main) > L.indexOf("## Phase 2 — Ship"), () => taskLine(t, 4) === L.indexOf(main) + 1,
      () => next.next && next.next.number === 3,
    ]);
  }

  { // 1.36 review 1 (PORT-3): the baseline's section goes before the OUTERMOST level-2 section holding the template's first task (a ## Phase over
    // ### headings); none holds it — Kiro's tasks right under the title, a level-1 heading closing an earlier ## — it is appended (port-verify:
    // baselineLate). Removing +port leaves every template task active; an import with the Kiro-like template keeps their references
    const [lead] = heads("en");
    const tpl = (name, body, imp) => {
      const p = d("tpl-" + name);
      S.initProject(p, ["core"], "en");
      fs.mkdirSync(path.join(p, ".specs", "templates"), { recursive: true });
      fs.writeFileSync(path.join(p, ".specs", "templates", "tasks.md"), body);
      if (imp) {
        fs.mkdirSync(path.join(p, ".kiro", "specs", "ledger"), { recursive: true });
        fs.writeFileSync(path.join(p, ".kiro", "specs", "ledger", "requirements.md"), "### Requirement 1\n\n**User Story:** As an accountant, I want the ledger importer moved to Go.\n\n" +
          "#### Acceptance Criteria\n\n1. WHEN the new importer reads a ledger file THEN the system SHALL produce the same rows as the old one\n2. IF a row is malformed THEN the system SHALL reject it with the same error\n");
        const r = S.importSpec(p, "kiro", ".kiro/specs/ledger", { tracks: ["port"] });
        return { r, t: r.ok ? rd(p, ".specs", "ledger", "tasks.md") : "" };
      }
      const f = S.createFeature(p, "Templated " + name, ["port"], "", undefined, "en");
      const t = rd(f.dir, "tasks.md");
      S.removeTrack(p, f.slug, "port");
      return { t, L: t.split("\n"), left: S.statusFeature(p, f.slug).tasks.list.map((x) => x.number).join() };
    };
    const kiro = tpl("kiro", "# Implementation Plan\n\n- [ ] 1. Build it\n  - _Requirements: US-1.AC-1_\n- [ ] 2. Ship it\n  - _Requirements: US-1.AC-2_\n");
    const nest = tpl("nest", "# Tasks: {{name}}\n\n## Phase 1\n\n### Setup\n- [ ] 1. Set it up\n\n### Ship\n- [ ] 2. Ship it\n\n## Phase 2\n- [ ] 3. Deploy it\n");
    const h1 = tpl("h1", "## Notes\n\nTeam notes.\n\n# Plan\n\n- [ ] 1. Build it\n- [ ] 2. Ship it\n");
    const im = tpl("import", "# Implementation Plan\n\n- [ ] 1. Build it\n  - _Requirements: US-1.AC-1_\n- [ ] 2. Ship it\n  - _Requirements: US-1.AC-2_\n", true);
    const at = (x, l) => x.L.indexOf(l);
    all("1.36 review 1 (PORT-3): a template's tasks never land in the baseline's section — Kiro-like (under the title) and under a level-1 heading it is appended, under a ## Phase holding ### headings it goes before that ## Phase; removing +port leaves every template task active; the import keeps their references (got " +
      js([kiro.L.filter((l) => /^#/.test(l)), kiro.left, nest.L.filter((l) => /^#/.test(l)), nest.left, h1.left, im.r && im.r.warnings]) + ")", [
      () => kiro.L[0] === "# Implementation Plan", () => at(kiro, lead) > at(kiro, "- [ ] 2. Ship it"), () => kiro.left === "1,2",
      () => at(nest, lead) < at(nest, "## Phase 1") && at(nest, lead) > at(nest, "# Tasks: Templated nest"), () => nest.left === "1,2,3",
      () => h1.L[0] === "## Notes" && at(h1, lead) > at(h1, "- [ ] 2. Ship it"), () => h1.left === "1,2",
      () => im.r.ok && /- \[ \] 1\. Build it\n {2}- _Requirements: US-1\.AC-1_/.test(im.t) && /- \[ \] 2\. Ship it\n {2}- _Requirements: US-1\.AC-2_/.test(im.t),
    ]);
  }

  { // +port and a bugfix: refused on create and on add_track, before anything is written
    const pb = d("bugfix");
    S.initProject(pb, ["core"], "en");
    const c = S.createFeature(pb, "Crash", ["port"], "", undefined, "en", "bugfix");
    const b = S.createFeature(pb, "Crash two", [], "", undefined, "en", "bugfix");
    const st0 = rd(b.dir, ".state.json"), tk0 = rd(b.dir, "tasks.md");
    const a = S.addTrack(pb, b.slug, "port");
    const E = S.msg("en").tracks.portBugfix;
    all("1.36: +port on a bugfix is refused — on create (no folder written) and on add_track (state and tasks.md unchanged) (got " + js([c.error, a.error]) + ")", [
      () => !c.ok, () => c.error === E, () => !fs.existsSync(path.join(pb, ".specs", "crash")), () => b.ok, () => !a.ok, () => a.error === E,
      () => rd(b.dir, ".state.json") === st0, () => rd(b.dir, "tasks.md") === tk0,
    ]);
  }

  { // a track pack named 'port', recorded by a feature before 1.36, is that feature's MISSING pack (never the built-in +port); a pack with the
    // marker PORT is invalid (marker-reserved); [PORT] is a stable bracket, never a placeholder
    const lp = d("legacy");
    S.initProject(lp, ["core"], "en");
    const pdir = path.join(lp, ".specs", "tracks", "port");
    fs.mkdirSync(pdir, { recursive: true });
    fs.writeFileSync(path.join(pdir, "track.json"), JSON.stringify({ name: "port", marker: "PRT", title: { en: "Legacy port" }, sections: [{ name: "Team Section", guidance: "Say how." }] }));
    const f = S.createFeature(lp, "f-port", ["core"], "", undefined, "en");
    const sp = path.join(f.dir, ".state.json");
    const st = JSON.parse(rd(sp));
    st.tracks = ["core", "port"];
    st.packMarkers = { port: "[PRT]" };
    fs.writeFileSync(sp, JSON.stringify(st, null, 2));
    const doc = S.specDoctor(lp, "f-port"), status = S.statusFeature(lp, "f-port");
    const mk = path.join(lp, ".specs", "tracks", "ports");
    fs.mkdirSync(mk, { recursive: true });
    fs.writeFileSync(path.join(mk, "track.json"), JSON.stringify({ name: "ports", marker: "PORT", title: { en: "Ports" }, sections: [{ name: "Port Map", guidance: "Say how." }] }));
    const pc = JSON.stringify(S.trackPacks(lp, "check"));
    all("1.36: a pre-1.36 pack named 'port' is the feature's missing pack — tracks read core, the built-in +port NOT applied, doctor says 'from before 1.36'; a pack with the marker PORT is marker-reserved; [PORT] is a stable bracket (got " +
      js([status.tracks, chk(doc, "track-pack-missing").detail]) + ")", [
      () => status.tracks === "core", () => js(status.missingPacks) === js(["port"]), () => !chk(doc, "port-sections").status,
      () => /\+port \(a track pack from before 1\.36 — 'port' is a reserved name now, and the built-in \+port track is NOT applied/.test(chk(doc, "track-pack-missing").detail),
      () => /marker-reserved/.test(pc), () => S.artifactState({ text: "# Notes\n\nThe [PORT] sections were reviewed on Monday by the whole team.\n" }) === "filled",
    ]);
  }

  { // views: spec_status portSections, spec_finish's +port checks, the brief and the matrix link a [PORT] criterion to the [PORT] sections, the
    // Gherkin tag, an inline [PORT] tag left out of the cross-feature criteria comparison
    const vw = d("views");
    S.initProject(vw, ["core"], "en");
    const vf = S.createFeature(vw, "Views", ["tdd", "port"], "", undefined, "en");
    dropTodo(path.join(vf.dir, "design.md"));
    const vSt = S.statusFeature(vw, vf.slug), vFin = S.finishFeature(vw, vf.slug);
    const vBrief = S.taskBrief(vw, vf.slug, 1);
    const vRow = ((S.traceMatrix(vw, vf.slug).rows) || []).find((r) => r.id === "US-1.AC-36") || {};
    const vGk = S.exportSpecs(vw, { name: vf.slug, format: "gherkin" });
    const xa = S.createFeature(vw, "Alpha", ["core"], "", undefined, "en"), xb = S.createFeature(vw, "Beta", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(xa.dir, "requirements.md"), "# Feature: Alpha\n\n## Acceptance Criteria\n1. **US-1.AC-1** — [PORT] WHEN the importer reads a ledger file THE SYSTEM SHALL return every ledger row in file order\n");
    fs.writeFileSync(path.join(xb.dir, "requirements.md"), "# Feature: Beta\n\n## Acceptance Criteria\n1. **US-1.AC-1** — WHEN the importer reads a ledger file THE SYSTEM SHALL return every ledger row in file order\n");
    const pair = (S.crossFeatureAcs(vw, { only: xa.slug }).pairs || [])[0] || {};
    all("1.36: +port views — spec_status portSections (3, filled), spec_finish's two +port checks, the baseline task's brief and the US-1.AC-36 matrix row carry the [PORT] sections, Gherkin @PORT, an inline [PORT] tag is no word of a criterion (got " +
      js([vSt.portSections, vBrief.designSections, vRow.design, pair.similarity]) + ")", [
      () => Array.isArray(vSt.portSections), () => vSt.portSections.length === 3, () => vSt.portSections.every((s) => s.filled),
      () => vFin.checks.filter((c) => /^\+port: /.test(c)).length === 2, () => vBrief.ok, () => vBrief.designSections.includes("[PORT] Behaviour Baseline"),
      () => (vRow.design || []).includes("[PORT] Differential Check"), () => /(^|\s)@PORT(\s|$)/m.test(vGk.content || ""), () => pair.similarity === 1,
    ]);
  }

  { // the classifier: +port is SUGGEST-ONLY from its verbs (one concept, at most a "Possible +port" note — never on, never a size), ON only from a
    // technique name; a network port and a schema migration are no signal at all; EN / PT / ES; the tool and the CLI read it alike
    const ON = ["Add characterization tests before the rewrite of the billing engine", "Use a golden master to pin the report output before porting it",
      "Strangler fig migration of the monolith's orders module", "Differential testing of the new parser against the old one",
      "A behaviour-preserving rewrite of the pricing module in Go",
      "Escrever testes de caracterização antes de reescrever o módulo de faturação", "Reescrita que preserva o comportamento do importador",
      "Pruebas de caracterización antes de reescribir el importador", "Una prueba diferencial entre el parser antiguo y el nuevo"];
    const POSSIBLE = [["Port the CSV importer from Python to Go", "port"], ["Port the TCP proxy from C to Rust", "port"], ["Port the billing engine to Rust and ship it", "port"],
      ["Port and rewrite the parser in Go", "port"], ["Reimplement the scheduler in Rust", "reimplement"], ["Migrate the legacy reports module to TypeScript", "migrate"],
      ["Rewrite the current behaviour of coupons so expired ones are rejected", "rewrite"], ["Migrate customers from the legacy billing system to Stripe", "migrate"],
      ["Portar o importador de CSV de Python para Go", "portar"], ["Reescribir el importador en Go", "reescribir"]];
    const NONE = ["Open port 8443 on the load balancer", "Forward port 80 to 8080", "Expose the metrics on the TCP port of the sidecar", "Restructure the billing module as ports and adapters",
      "Add a migration that renames the email column", "Migrate the users table", "Migrações de base de dados", "Run the database migrations before the deploy",
      "Upgrade to the Pro plan", "Replace the modal with a drawer", "Modernize the UI", "Refactor the checkout module", "Rename the variable in the parser, no functional change"];
    const wrong = [];
    for (const t of ON) { const r = cls(t); if (!r.tracks.includes("port") || !r.signals.port.length) wrong.push("ON? " + t + " " + r.label); }
    for (const [t, sig] of POSSIBLE) { const r = cls(t); if (r.tracks.includes("port") || !r.possible.some((p) => p.track === "port" && p.signal === sig)) wrong.push("POSSIBLE? " + t + " " + js([r.label, r.possible])); }
    for (const t of NONE) { const r = cls(t); if (r.tracks.includes("port") || r.signals.port.length || r.possible.some((p) => p.track === "port")) wrong.push("NONE? " + t + " " + js(r.signals.port)); }
    const tcp = cls("Port the TCP proxy from C to Rust"), rename = cls("Rename the variable in the parser, no functional change");
    const note = cls("Port the CSV importer from Python to Go").notes.find((n) => /\+port/.test(n)) || "";
    all("1.36: the +port classifier — ON only from a technique name (characterization tests, a golden master, the strangler fig, differential testing, a behaviour-preserving rewrite; EN / PT / ES), its verbs (port, rewrite, reimplement, migrate — one concept) a 'Possible +port' note only, a network port and a schema migration no signal at all, the size never moved by a verb (got " +
      js(wrong) + ")", [
      () => !wrong.length, () => tcp.suggestedSize === "m", () => rename.suggestedSize === "xs", () => !rename.tracks.includes("port"),
      () => note === S.msg("en").classify.possible("port", "port"), () => S.signalConcept("port", "rewrite") === S.signalConcept("port", "migrate"),
    ]);
    const mcp = payload(await rpc("tools/call", { name: "spec_classify", arguments: { description: "Port the CSV importer from Python to Go" } }));
    ok(mcp.possible.some((p) => p.track === "port") && !mcp.tracks.includes("port") && mcp.confidence.port === "none",
      "1.36: spec_classify (MCP) gives the same 'Possible +port' reading (got " + js([mcp.label, mcp.possible]) + ")");
    // self-match sweep: every +port keyword (EN / PT / ES) matches itself as a word; a strong one alone turns +port on, a weak one alone never does
    const sg = S.trackSignals("port");
    const sweep = [];
    for (const tier of ["strong", "weak"]) for (const kw of sg[tier]) {
      const r = S.classify("We need " + kw + " here");
      if (!r.signals.port.some((m) => m === kw || m.includes(kw)) || (tier === "strong") !== r.tracks.includes("port")) sweep.push(tier + ":" + kw);
    }
    ok(!sweep.length && sg.strong.length >= 20 && sg.weak.length >= 20 && !(sg.generic || []).length && !(sg.context || []).length,
      "1.36: +port self-match sweep — every keyword matches itself; a strong one alone turns +port on, a weak one alone never does; no generic or context tier (misses: " + sweep.join(", ") + ")");
  }
};
