"use strict";
// Imports — spec-kit: its [USn] task tags → _Requirements:_, the paths a task names → _Implements:_, data-model.md / research.md / contracts/ carried into design.md, quickstart.md, plan.md's open fields, what an import leaves, its readers' cost.
// (13-imports.js holds the area's main tests.)

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, all, skip, S, tmp, remeasure, require }) => {
  const js = JSON.stringify;
  const fresh = (n) => { const p = path.join(tmp, "proj-r6i-" + n); S.initProject(p, ["core"]); return p; };
  const rd = (...a) => fs.readFileSync(path.join(...a), "utf8");
  const put = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
  // A realistic spec-kit feature folder (specs/001-photo-albums/): spec.md, plan.md, tasks.md and the design documents beside them.
  const speckit = (p) => {
    const k = path.join(p, "specs", "001-photo-albums");
    put(path.join(k, "spec.md"), "# Feature Specification: Photo Albums\n\n**Feature Branch**: `001-photo-albums`\n**Created**: 2025-01-01\n**Status**: Draft\n" +
      "**Input**: User description: \"Let users group photos into albums\"\n\n## User Scenarios & Testing *(mandatory)*\n\n### User Story 1 - Create album (Priority: P1)\n\n" +
      "Users create an album and drag photos into it.\n\n**Acceptance Scenarios**:\n\n1. **Given** a user with photos, **When** they create an album, **Then** the album appears in the list\n" +
      "2. **Given** an album, **When** the user renames it, **Then** the new name is shown\n\n---\n\n### User Story 2 - Share album (Priority: P2)\n\n**Acceptance Scenarios**:\n\n" +
      "1. **Given** an album, **When** the owner shares it, **Then** the invitee can view it\n\n## Requirements *(mandatory)*\n\n### Functional Requirements\n\n" +
      "- **FR-001**: System MUST allow users to create albums\n");
    put(path.join(k, "plan.md"), "# Implementation Plan: Photo Albums\n\n## Summary\nVite + SQLite.\n\n## Technical Context\n**Language/Version**: TypeScript 5\n");
    put(path.join(k, "tasks.md"), "# Tasks: Photo Albums\n\n## Phase 1: Setup\n\n- [ ] T001 Create project structure per implementation plan\n- [ ] T002 [P] Initialize the Vite project\n\n" +
      "## Phase 3: User Story 1 - Create album (Priority: P1)\n\n- [ ] T010 [P] [US1] Create the Album model in src/models/album.ts\n" +
      "- [x] T011 [US1] Implement AlbumService in src/services/album.ts and `src/api/albums.ts`\n\n## Phase 4: User Story 2 - Share album (Priority: P2)\n\n" +
      "- [ ] T020 [US2] Implement sharing in src/services/share.ts\n  - _Requirements: US2_\n\n```\n- [ ] T999 [US1] an example in a code block, never a task: src/x.ts\n```\n");
    return k;
  };

  // 1.24 r6 G-I1: spec-kit's [USn] tags named the story a task serves and its text the files it touches — the import kept both as
  // prose, so trace_check found every criterion uncovered ("gaps-found") right after an import. A tag becomes _Requirements:_ naming
  // that story's ACs, the paths become _Implements:_ (planPaths — a plan import's rule); a task citing its own _Requirements:_ keeps
  // it; a fenced example is never a task. The imported sample traces clean.
  {
    const p = fresh("speckit-trace");
    speckit(p);
    const r = S.importSpec(p, "spec-kit", "specs/001-photo-albums", {});
    const tasks = r.ok ? rd(r.dir, "tasks.md") : "";
    const blocks = S.taskBlocks(tasks);
    const mk = (n) => S.taskMarkers(blocks.find((b) => b.number === n) || { lines: [] });
    const tc = r.ok ? S.traceCheck(p, r.feature) : {};
    all("1.24 r6 G-I1: a spec-kit task's [USn] tag becomes _Requirements:_ (that story's ACs) and the paths it names _Implements:_ — its own _Requirements:_ kept, a fenced example untouched; trace_check finds every criterion covered (got " +
      js({ t3: mk(3), t4: mk(4).implements, t5: mk(5).requirements, unc: tc.uncoveredByTasks, warnings: r.warnings }) + ")", [
      () => r.ok, () => js(mk(3).requirements) === js(["US-1.AC-1", "US-1.AC-2"]), () => js(mk(3).implements) === js(["src/models/album.ts"]),
      () => js(mk(4).implements.slice().sort()) === js(["src/api/albums.ts", "src/services/album.ts"]),
      () => js(mk(5).requirements) === js(["US-2.AC-1"]), () => (tasks.match(/_Requirements:/g) || []).length === 3, () => !mk(1).requirements.length,
      () => !mk(1).implements.length, () => !mk(2).implements.length,
      () => /- \[ \] 3\. \[P\] \[US1\] Create the Album model in src\/models\/album\.ts/.test(tasks), () => /T999/.test(tasks),
      () => blocks.length === 5, () => tc.uncoveredByTasks, () => !tc.uncoveredByTasks.length, () => !tc.phantomAcsInTasks.length,
      () => !(r.warnings || []).some((w) => /_Requirements:_ references/.test(w)),
    ]);
  }

  // 1.24 r6 G-I3: spec-kit's data-model.md, research.md, contracts/ and quickstart.md were skipped with a warning ("not imported") — the
  // design they hold never reached design.md. Each goes under its own heading (its headings one level down, a contract that is no
  // markdown in a code block), bounded like the rest of the import (a file over the cap refuses the import; past
  // SPECKIT_CONTRACTS_MAX contract files the rest are named in a warning).
  {
    const p = fresh("speckit-docs");
    const k = speckit(p);
    put(path.join(k, "research.md"), "# Research: Photo Albums\n\n## Decision: SQLite\n\nRationale: one file, no server.\n");
    put(path.join(k, "data-model.md"), "# Data Model\n\n## Entities\n\n### Album\n- id, name, ownerId\n\n```sql\n# not a heading\nCREATE TABLE album (id int);\n```\n");
    put(path.join(k, "quickstart.md"), "# Quickstart\n\n1. npm install\n2. npm run dev\n");
    put(path.join(k, "contracts", "albums.yaml"), "openapi: 3.0.0\npaths:\n  /albums:\n    get: {}\n");
    put(path.join(k, "contracts", "events.md"), "# Events\n\n## album.created\nPayload: { id }\n");
    const r = S.importSpec(p, "spec-kit", "specs/001-photo-albums", {});
    const d = r.ok ? rd(r.dir, "design.md") : "";
    const order = ["## Summary", "## Research", "## Data Model", "## Contracts"].map((h) => d.indexOf("\n" + h + "\n"));
    const qs = r.ok ? rd(r.dir, "quickstart.md") : "";
    // (1.42 SK-05: quickstart.md is the feature's quickstart.md, no design.md section)
    ok(r.ok && order.every((i, j) => i > 0 && (j === 0 || i > order[j - 1])) && /\n### Decision: SQLite\n/.test(d) && /\n### Entities\n\n#### Album\n/.test(d) &&
      /# not a heading\nCREATE TABLE/.test(d) && /\n### `contracts\/albums\.yaml`\n\n```yaml\nopenapi: 3\.0\.0\n/.test(d) && /\n### `contracts\/events\.md`\n/.test(d) && /\n#### album\.created\n/.test(d) &&
      !/## Quickstart|npm install/.test(d) && /\n1\. npm install\n2\. npm run dev\n$/.test(qs) && !(r.warnings || []).some((w) => /not imported/.test(w)) && !/# Research: Photo Albums/.test(d),
      "1.24 r6 G-I3: spec-kit's research.md, data-model.md and contracts/ (markdown demoted, others fenced) land in design.md under their own headings, quickstart.md in the feature's quickstart.md — no 'not imported' warning (got " +
      js({ order, warnings: r.warnings, tail: d.slice(d.indexOf("## Research"), d.indexOf("## Research") + 400) }) + ")");
    // bounded: a design document over the import cap refuses the whole import (nothing created), as any source file does
    const p2 = fresh("speckit-big");
    const k2 = speckit(p2);
    put(path.join(k2, "research.md"), "# Research\n\n" + "x".repeat(2 * 1024 * 1024 + 10) + "\n");
    const r2 = S.importSpec(p2, "spec-kit", "specs/001-photo-albums", {});
    ok(r2.ok === false && r2.tooLarge === true && /research\.md/.test(r2.error) && !fs.existsSync(path.join(p2, ".specs", "photo-albums")),
      "1.24 r6 G-I3: a spec-kit design document over the import cap refuses the import (tooLarge, nothing created) (got " + js([r2.ok, r2.error]) + ")");
  }

  // 1.42 SK-04: Spec Kit's --timestamp folders (create-new-feature.sh: YYYYMMDD-HHMMSS-<name>; its own reader strips
  // ^[0-9]{8}-[0-9]{6}-) slugged as `101500-photo-albums`: the number is stripped once, sequential or timestamp
  {
    const p = fresh("speckit-ts");
    const one = (folder) => {
      const k = path.join(p, "specs", folder);
      put(path.join(k, "spec.md"), "# Feature Specification: \n\n### User Story 1 - T (Priority: P1)\n\n**Acceptance Scenarios**:\n\n1. **Given** a, **When** b, **Then** c\n");
      const r = S.importSpec(p, "spec-kit", "specs/" + folder, {});
      return r.ok ? r.feature : "ERR " + r.error;
    };
    const got = ["20261120-101500-photo-albums", "004-2026-roadmap", "12345678-1234567-x", "001-20260115-143022-y", "20261120_101500-z"].map(one);
    ok(js(got) === js(["photo-albums", "2026-roadmap", "1234567-x", "20260115-143022-y", "101500-z"]),
      "1.42 SK-04: a spec-kit folder's number is stripped once — YYYYMMDD-HHMMSS- (Spec Kit's --timestamp) or digits — 20261120-101500-photo-albums → photo-albums, 004-2026-roadmap keeps 2026-, a 7-digit time is no timestamp, one strip only (got " + js(got) + ")");
  }

  // 1.42 SK-06: spec-kit's /plan marks an unknown bare (`**Testing**: NEEDS CLARIFICATION`) and the engine counts only bracketed
  // markers — the imported design passed its gate with open unknowns. A field whose value opens with it gets
  // `[NEEDS CLARIFICATION: <field>]`, its tail verbatim after it; a fenced, indented or commented copy, prose after it and the
  // template's `[e.g., … or NEEDS CLARIFICATION]` stay. research.md resolving one (Phase 0) still reads open: fail closed.
  {
    const E = require("./lib/engine/index.js");
    const p = fresh("speckit-plan");
    const k = speckit(p);
    const long = "x".repeat(600);
    put(path.join(k, "plan.md"), ["# Implementation Plan: Photo Albums", "", "**Branch**: `001-photo-albums` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)", "",
      "## Summary", "", "Albums stored in SQLite, served by Fastify.", "", "## Technical Context", "", "<!--", "  ACTION REQUIRED: Replace the content in this section with the technical details",
      "  for the project.", "-->", "", "**Language/Version**: TypeScript 5.6", "**Primary Dependencies**: Fastify", "- **Storage**: needs clarification",
      "**Testing:** NEEDS CLARIFICATION - pytest or vitest?", "**Target Platform**: Linux server", "**Performance Goals**: NEEDS CLARIFICATION — " + long,
      "**Constraints**: NEEDS CLARIFICATION", "**Scale/Scope**: [e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]", "",
      "**Note**: NEEDS CLARIFICATION markers are resolved in research.md (Phase 0).", "", "<!--", "**Project Type**: NEEDS CLARIFICATION", "-->", "",
      "```text", "**Project Type**: NEEDS CLARIFICATION", "```", "", "Example:", "", "    **Project Type**: NEEDS CLARIFICATION", ""].join("\r\n"));
    put(path.join(k, "research.md"), "# Research: Photo Albums\n\n## Decision: Testing framework\n\n- Decision: vitest\n- Rationale: one runner for the API and the UI\n");
    const r = S.importSpec(p, "spec-kit", "specs/001-photo-albums", { tracks: ["core"] });
    const d = r.ok ? rd(r.dir, "design.md") : "";
    const doc = r.ok ? S.specDoctor(p, r.feature) : {};
    const cl = ((doc.checks || []).find((c) => c.id === "clarifications") || {}).detail || "";
    all("1.42 SK-06: plan.md's bare NEEDS CLARIFICATION values become markers the design gate counts — Storage, Testing, Performance Goals, Constraints; the field name alone in the marker, the tail verbatim after it; fenced / indented / commented copies, the Note's prose and the template's [e.g., …] untouched; research.md's resolution does not hide one (got " +
      js({ markers: E.clarificationMarkers(d), cl, tc: d.slice(d.indexOf("**Language"), d.indexOf("**Note")) }) + ")", [
      () => r.ok, () => js(E.clarificationMarkers(d)) === js(["Storage", "Testing", "Performance Goals", "Constraints"]),
      () => /\n- \*\*Storage\*\*: \[NEEDS CLARIFICATION: Storage\]\r?\n/.test(d), () => /\n\*\*Testing:\*\* \[NEEDS CLARIFICATION: Testing\] - pytest or vitest\?\r?\n/.test(d),
      () => d.includes("**Performance Goals**: [NEEDS CLARIFICATION: Performance Goals] — " + long), () => /\n\*\*Constraints\*\*: \[NEEDS CLARIFICATION: Constraints\]\r?\n/.test(d),
      () => d.includes("**Scale/Scope**: [e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]"), () => d.includes("**Note**: NEEDS CLARIFICATION markers are resolved"),
      () => /<!--\r?\n\*\*Project Type\*\*: NEEDS CLARIFICATION\r?\n-->/.test(d), () => /```text\r?\n\*\*Project Type\*\*: NEEDS CLARIFICATION\r?\n```/.test(d),
      () => /\n {4}\*\*Project Type\*\*: NEEDS CLARIFICATION\r?\n/.test(d), () => /\b4 unresolved \[NEEDS CLARIFICATION\] in design\.md/.test(cl),
      () => /- Decision: vitest/.test(d),
    ]);
  }

  // 1.42 SK-01: what a spec-kit import leaves in the feature folder is named — checklists/, a note, a contracts folder deeper than
  // two levels were dropped silently ("nothing is dropped silently"): every entry but a hidden one, a name the parser reads and
  // the case twin of one whose read reached it; a folder with "/", decided on the entry (a link without it — live or dangling, the
  // same words); at most 50 names, then "+N more". The exact-name rule's stated limit: a FOLDER named plan.md is not named.
  {
    const left = (r) => (r.warnings || []).filter((w) => w.startsWith("not imported (left in place): ")).map((w) => w.slice("not imported (left in place): ".length).split(", "));
    const p = fresh("speckit-left");
    const k = speckit(p);
    put(path.join(k, "checklists", "requirements.md"), "# Specification Quality Checklist: Photo Albums\n\n- [ ] No [NEEDS CLARIFICATION] markers remain\n");
    put(path.join(k, "checklists", "security.md"), "# Security Checklist: Photo Albums\n\n- [ ] CHK001 Are share-link lifetimes specified? [Completeness, Spec §FR-001]\n");
    put(path.join(k, "notes.txt"), "scratch\n");
    put(path.join(k, ".DS_Store"), "x");
    put(path.join(k, "contracts", "albums.yaml"), "openapi: 3.0.0\n");
    put(path.join(k, "contracts", "v1", "schemas", "album.json"), "{}\n");
    const r = S.importSpec(p, "spec-kit", "specs/001-photo-albums", {});
    // a folder of 60 extra notes, a FOLDER named plan.md (the stated limit: not named) and a case twin of a known name whose read
    // failed (a folder Quickstart.md: no file read it, on any file system — named)
    const p2 = fresh("speckit-left-cap");
    const k2 = path.join(p2, "specs", "002-cap");
    put(path.join(k2, "spec.md"), "# Feature Specification: Cap\n\n### User Story 1 - T (Priority: P1)\n\n**Acceptance Scenarios**:\n\n1. **Given** a, **When** b, **Then** c\n");
    put(path.join(k2, "tasks.md"), "# Tasks: Cap\n\n- [ ] T001 [US1] do it\n");
    fs.mkdirSync(path.join(k2, "plan.md"), { recursive: true });
    fs.mkdirSync(path.join(k2, "Quickstart.md"), { recursive: true });
    for (let i = 1; i <= 60; i++) put(path.join(k2, "n-" + String(i).padStart(2, "0") + ".md"), "note\n");
    const r2 = S.importSpec(p2, "spec-kit", "specs/002-cap", {});
    const l2 = left(r2)[0] || [];
    // the project root imported as a spec-kit folder (path "."): its entries are named, capped, never a hidden one (.specs, .git)
    const p3 = fresh("speckit-left-root");
    put(path.join(p3, "spec.md"), "# Feature Specification: Root\n\n### User Story 1 - T (Priority: P1)\n\n**Acceptance Scenarios**:\n\n1. **Given** a, **When** b, **Then** c\n");
    put(path.join(p3, "package.json"), "{}\n");
    put(path.join(p3, "src", "index.js"), "x\n");
    put(path.join(p3, ".git", "HEAD"), "ref: refs/heads/main\n");
    for (let i = 1; i <= 55; i++) put(path.join(p3, "f-" + String(i).padStart(2, "0") + ".txt"), "x\n");
    const r3 = S.importSpec(p3, "spec-kit", ".", { name: "root-import" });
    const l3 = left(r3)[0] || [];
    all("1.42 SK-01: a spec-kit import names what it leaves — checklists/, notes.txt, contracts/v1/schemas/ (never .DS_Store, never a name it reads); 50 names then '+N more'; a folder named plan.md is not named (the exact-name rule's limit), a Quickstart.md folder no read reached is; the project root's entries are named, never .specs/ or .git/ (got " +
      js({ r: left(r), r2: [l2.length, l2[0], l2[49], l2[50]], r3: [l3.length, l3.slice(0, 3), l3[50]] }) + ")", [
      () => r.ok, () => js(left(r)) === js([["contracts/v1/schemas/", "checklists/", "notes.txt"]]),
      () => r2.ok, () => left(r2).length === 1, () => l2.length === 51, () => l2[0] === "Quickstart.md/", () => l2[1] === "n-01.md", () => l2[49] === "n-49.md",
      () => l2[50] === "+11 more", () => !l2.some((x) => /^plan\.md/i.test(x)),
      () => r3.ok, () => l3.length === 51, () => l3[50] === "+7 more", () => l3[0] === "f-01.txt" && l3[49] === "f-50.txt", // (package.json and src/ sort after f-55.txt: among the 7 more)
      () => !l3.some((x) => x.startsWith(".")), () => !l3.includes("spec.md"),
      () => S.msg("pt").importSpec.more(3) === "+3 mais" && S.msg("es").importSpec.more(3) === "+3 más",
    ]);
    // the decision follows the read, never the file system: a lone Spec.md is the spec on a case-insensitive file system (read
    // reached it — not named) and none on a case-sensitive one (named)
    const probe = path.join(tmp, "proj-142-case-probe");
    put(path.join(probe, "a"), "x");
    const folds = fs.existsSync(path.join(probe, "A"));
    const p4 = fresh("speckit-left-case");
    const k4 = path.join(p4, "specs", "004-case");
    put(path.join(k4, "Spec.md"), "# Feature Specification: Case\n\n### User Story 1 - T (Priority: P1)\n\n**Acceptance Scenarios**:\n\n1. **Given** a, **When** b, **Then** c\n");
    put(path.join(k4, "tasks.md"), "# Tasks: Case\n\n- [ ] T001 do it\n");
    put(path.join(k4, "Contracts", "api.yaml"), "openapi: 3.0.0\n");
    const r4 = S.importSpec(p4, "spec-kit", "specs/004-case", {});
    const d4 = r4.ok && fs.existsSync(path.join(r4.dir, "design.md")) ? rd(r4.dir, "design.md") : "";
    ok(r4.ok && (folds ? !left(r4).length && r4.counts.stories === 1 && d4.includes("### `contracts/api.yaml`")
      : js(left(r4)) === js([["Contracts/", "Spec.md"]]) && r4.counts.stories === 0 && !d4.includes("api.yaml")),
      "1.42 SK-01: a lone Spec.md / Contracts/ is named only where the read of spec.md / the listing of contracts/ did not reach it — " + (folds ? "this file system folds case: they are the spec and the contracts, not named" : "this file system is case-sensitive: named") + " (got " + js([r4.ok, left(r4), r4.counts]) + ")");
  }
  // links (where they can be created): a link entry is named without "/" whether its target is there or not — the same warnings
  // both ways; `contracts` linked out of the project is one wUnreadable, never named as left
  {
    const out = path.join(tmp, "proj-142-left-outside");
    put(path.join(out, "x.yaml"), "openapi: 3.0.0\n");
    const p = fresh("speckit-left-link");
    const k = speckit(p);
    let linked = false;
    try { fs.symlinkSync(out, path.join(k, "contracts"), "junction"); fs.symlinkSync(out, path.join(k, "linked"), "junction"); linked = true; } catch { /* no link rights */ }
    if (!linked) skip("1.42 SK-01: a link entry is named without '/', live or dangling", "links cannot be created here");
    else {
      const live = S.importSpec(p, "spec-kit", "specs/001-photo-albums", { name: "live" });
      fs.rmSync(out, { recursive: true, force: true });
      const dead = S.importSpec(p, "spec-kit", "specs/001-photo-albums", { name: "dead" });
      const unread = (r) => (r.warnings || []).filter((w) => /contracts points outside the project/.test(w)).length;
      ok(live.ok && dead.ok && js(live.warnings) === js(dead.warnings) && (live.warnings || []).includes("not imported (left in place): linked") && unread(live) === 1,
        "1.42 SK-01: a link entry is named without '/', live or dangling (the same warnings both ways); contracts linked out is one wUnreadable, never named as left (got " + js([live.warnings, dead.warnings]) + ")");
    }
  }

  // 1.42 SK-05: Spec Kit's quickstart.md ("runnable validation scenarios that prove the feature works end-to-end") IS the feature's
  // quickstart.md — the file trace reads an SC's coverage from — but went into design.md and left the scaffold's template: doctor
  // said "SC-001 no test or quickstart step". Written there now (our title, the note, its text); one holding only its title leaves
  // the scaffold's.
  {
    const p = fresh("speckit-quickstart");
    const k = speckit(p);
    fs.appendFileSync(path.join(k, "spec.md"), "\n## Success Criteria *(mandatory)*\n\n### Measurable Outcomes\n\n- **SC-001**: 90% of users create an album in under 1 minute\n" +
      "- **SC-002**: a shared album opens in under 2 seconds\n");
    put(path.join(k, "quickstart.md"), "# Quickstart Guide\r\n\r\n## Validation\r\n\r\n1. `npm run dev`\r\n2. Create an album in under a minute - validates SC-001\r\n");
    const r = S.importSpec(p, "spec-kit", "specs/001-photo-albums", { tracks: ["core"] });
    const q = r.ok ? rd(r.dir, "quickstart.md") : "";
    const tc = r.ok ? S.traceCheck(p, r.feature) : {};
    const p2 = fresh("speckit-quickstart-title");
    const k2 = speckit(p2);
    put(path.join(k2, "quickstart.md"), "# Quickstart\n\n");
    const r2 = S.importSpec(p2, "spec-kit", "specs/001-photo-albums", { tracks: ["core"] });
    const q2 = r2.ok ? rd(r2.dir, "quickstart.md") : "";
    all("1.42 SK-05: spec-kit's quickstart.md becomes the feature's quickstart.md (our title, the note, its text as written; in `imported`) and covers the SC it names — SC-002 alone uncovered; none in design.md; a title-only one keeps the scaffold's (got " +
      js({ q: q.slice(0, 300), unc: tc.uncoveredSuccessCriteria, imported: r.imported, q2: q2.slice(0, 80) }) + ")", [
      () => r.ok, () => q.startsWith("# Quickstart: photo-albums\n\n> Imported from spec-kit `specs/001-photo-albums` on "),
      () => q.endsWith("\n\n## Validation\n\n1. `npm run dev`\n2. Create an album in under a minute - validates SC-001\n"), () => !/Quickstart Guide/.test(q),
      () => r.imported.includes("quickstart.md"), () => js(tc.uncoveredSuccessCriteria) === js(["SC-002"]), () => !/SC-001 - |validates SC-001/.test(rd(r.dir, "design.md")),
      () => r2.ok, () => !r2.imported.includes("quickstart.md"), () => /^# Quickstart: photo-albums\n\nA human-runnable acceptance scenario/.test(q2),
    ]);
  }

  // 1.42 SK-03: spec-kit's FR-xxx no acceptance scenario covers travelled as prose — the import only named them, and a task's
  // `_Requirements: FR-n_` passed refs() unchecked while trace ignored it. Exactly those FRs become the EARS criteria of ONE story
  // (the warning's own advice, done): a definition item per id (the first), coverage decided per item (frCovered, the parent's
  // rule), the story numbered past the source's AND past every story number it names (fix 1, R1-IMP-2: [US3] and a stale
  // US-3.AC-1 make it US-4 — the stale ID stays trace's phantom, never coverage); FR-n resolves to the criteria that hold it, else it is
  // reported; what stays prose keeps the parent's warning.
  {
    const p = fresh("speckit-fr");
    const k = path.join(p, "specs", "001-photo-albums");
    put(path.join(k, "spec.md"), ["# Feature Specification: Photo Albums", "", "**Feature Branch**: `001-photo-albums`", "**Created**: 2026-11-20", "**Status**: Draft",
      "**Input**: User description: \"Let users group photos into albums and share them\"", "", "## Clarifications", "", "### Session 2026-11-21", "",
      "- Q: Can photos be reordered (FR-003)? → A: by drag and drop", "", "## User Scenarios & Testing *(mandatory)*", "", "### User Story 1 - Create albums (Priority: P1)", "",
      "A user groups photos into a named album.", "", "**Acceptance Scenarios**:", "", "1. **Given** a user with photos, **When** they create an album named Trip, **Then** the album Trip is listed",
      "2. **Given** an album, **When** the user adds 501 photos, **Then** the system rejects the last one (FR-002)", "", "### User Story 2 - Share albums (Priority: P2)", "",
      "**Acceptance Scenarios**:", "", "1. **Given** an album, **When** the owner shares it by link, **Then** the invitee can view it", "", "## Requirements *(mandatory)*", "",
      "### Functional Requirements", "", "- **FR-001**: System MUST let users create albums", "- **FR-002**: System MUST limit an album to 500 photos",
      "- **FR-003**: Users MUST be able to reorder photos by drag and drop", "- **FR-004**: System MUST log every share link created",
      "- **FR-005**: System MUST retain albums for [NEEDS CLARIFICATION: retention period not specified]", "", "### Key Entities", "", "- **Album**: name, owner, photos", ""].join("\n"));
    put(path.join(k, "tasks.md"), ["# Tasks: Photo Albums", "", "## Phase 1: Setup", "", "- [X] T001 Create project structure per implementation plan", "",
      "## Phase 3: User Story 1 - Create albums (Priority: P1)", "", "- [ ] T012 [P] [US1] Create the Album model in packages/albums/src/album.ts",
      "- [ ] T013 Enforce the album cap", "  - _Requirements: FR-002_", "- [ ] T014 Wire album creation", "  - _Requirements: FR-001_", "",
      "## Phase 6: Stale", "", "- [ ] T030 [US3] Export albums as zip", "- [ ] T031 Keep the export", "  - _Requirements: US-3.AC-1_", ""].join("\n"));
    const r = S.importSpec(p, "spec-kit", "specs/001-photo-albums", {});
    const req = r.ok ? rd(r.dir, "requirements.md") : "";
    const tasks = r.ok ? rd(r.dir, "tasks.md") : "";
    const mk = (n) => S.taskMarkers(S.taskBlocks(tasks).find((b) => b.number === n) || { lines: [] }).requirements;
    const W = S.msg("en").importSpec;
    const tc = r.ok ? S.traceCheck(p, r.feature) : {};
    all("1.42 SK-03: the FRs no scenario covers (FR-003, FR-004, FR-005 — one still [NEEDS CLARIFICATION]) become US-4's EARS criteria (past the US3 / US-3.AC-1 the tasks name), their lines out of the prose; FR-001 (its words) stays prose, FR-002 (cited) maps to US-1.AC-2 — so does a task citing it; FR-001 cited by a task is reported, so is [US3] (kept); the stale US-3.AC-1 stays as written — trace's phantom, never the FR criteria's coverage; the classification is the parent's (got " +
      js({ warnings: r.warnings, mapping: r.mapping, counts: r.counts, tracks: r.tracks, t: [mk(3), mk(4), mk(5), mk(6)], trace: [tc.verdict, tc.phantomAcsInTasks, tc.uncoveredByTasks] }) + ")", [
      () => r.ok, () => /\n### US-4: Functional Requirements\n\n#### Acceptance Criteria \(EARS\)\n1\. \*\*US-4\.AC-1\*\* — THE SYSTEM SHALL ensure that users MUST be able to reorder photos by drag and drop \(FR-003\)\n {3}<!-- spec-kit: \*\*FR-003\*\*: Users MUST/.test(req),
      () => /\n2\. \*\*US-4\.AC-2\*\* — THE SYSTEM SHALL log every share link created \(FR-004\)\n/.test(req),
      () => /\n3\. \*\*US-4\.AC-3\*\* — THE SYSTEM SHALL retain albums for \[NEEDS CLARIFICATION: retention period not specified\] \(FR-005\)\n/.test(req),
      () => /\n## Functional Requirements\n\n- \*\*FR-001\*\*: System MUST let users create albums\n- \*\*FR-002\*\*: System MUST limit an album to 500 photos\n\n## Key Entities/.test(req),
      () => r.mapping["FR-001"] === "FR-001", () => r.mapping["FR-002"] === "US-1.AC-2", () => r.mapping["FR-003"] === "US-4.AC-1", () => r.mapping["FR-005"] === "US-4.AC-3",
      () => r.mapping["Functional Requirements"] === "US-4", () => r.counts.stories === 3 && r.counts.criteria === 6,
      () => r.warnings.includes(W.wFrCriteria("US-4", "FR-003 → US-4.AC-1, FR-004 → US-4.AC-2, FR-005 → US-4.AC-3")), () => !r.warnings.some((w) => /carried as prose/.test(w)),
      () => js(mk(3)) === js(["US-1.AC-2"]), () => js(mk(4)) === js(["FR-001"]) && r.warnings.includes(W.wUnknownRef(4, "FR-001")),
      () => js(mk(5)) === js(["US3"]) && r.warnings.includes(W.wUnknownRef(5, "US3")),
      () => js(mk(6)) === js(["US-3.AC-1"]) && !r.warnings.some((w) => w.includes("'US-3.AC-1'")),
      () => tc.verdict === "gaps-found" && js(tc.phantomAcsInTasks) === js(["US-3.AC-1"]) && js(tc.uncoveredByTasks) === js(["US-2.AC-1", "US-4.AC-1", "US-4.AC-2", "US-4.AC-3"]),
      () => js(r.tracks) === js(["core", "tdd"]), () => !r.warnings.some((w) => w === W.wNoRequirements("spec.md")),
    ]);
    // the FRs alone (no story): their criteria are the feature's — US-1, no "no requirements" warning; a PT modal kept as written,
    // a PT text with none takes the English tokens (no language guessing); a one-line definition with an empty text is no EARS
    const p2 = fresh("speckit-fr-only");
    put(path.join(p2, "specs", "002-fr-only", "spec.md"), "# Feature Specification: Só requisitos\n\n## Requirements\n\n### Functional Requirements\n\n" +
      "- **FR-001**: O sistema DEVE guardar cada álbum\n- **FR-002**: Fotos ordenadas por data\n- **FR-003**:\n");
    const r2 = S.importSpec(p2, "spec-kit", "specs/002-fr-only", { lang: "pt" });
    const req2 = r2.ok ? rd(r2.dir, "requirements.md") : "";
    all("1.42 SK-03: a spec of FRs only imports them as US-1's criteria (no 'no requirements' warning); a PT modal kept, a PT text with none in English tokens, an empty one no EARS (got " + js([r2.warnings, req2.slice(req2.indexOf("### US-1"), req2.indexOf("### US-1") + 500)]) + ")", [
      () => r2.ok, () => r2.counts.stories === 1 && r2.counts.criteria === 3, () => /\n### US-1: Requisitos Funcionais\n/.test(req2),
      () => !/\n## Requisitos Funcionais\n/.test(req2), // (its section, every line a criterion now, is dropped)
      () => /1\. \*\*US-1\.AC-1\*\* — O sistema DEVE guardar cada álbum \(FR-001\)\n/.test(req2), () => /2\. \*\*US-1\.AC-2\*\* — THE SYSTEM SHALL ensure that fotos ordenadas por data \(FR-002\)\n/.test(req2),
      () => /3\. \*\*US-1\.AC-3\*\* — \*\*FR-003\*\*: \[NEEDS CLARIFICATION: /.test(req2), () => !r2.warnings.some((w) => w === S.msg("pt").importSpec.wNoRequirements("spec.md")),
    ]);
    // one id reader: FR-001a / FR-1.1 / FR-1.2 define no FR-001 / FR-1 (the parent's reading named them; a second reader garbled
    // `**FR-1.1**:` into a criterion and silenced FR-001a); a second FR-003 line, a definition with no separator and a mention stay
    // prose — named in the parent's warning, the converted ones too (em dash, a dot after the bold id)
    const p3 = fresh("speckit-fr-ids");
    put(path.join(p3, "specs", "003-ids", "spec.md"), ["# Feature Specification: Ids", "", "### User Story 1 - Albums (Priority: P1)", "", "**Acceptance Scenarios**:", "",
      "1. **Given** a user, **When** they create an album named Trip, **Then** the album is listed", "", "### User Story 3 - Share (Priority: P2)", "", "**Acceptance Scenarios**:", "",
      "1. **Given** an album, **When** the owner shares it, **Then** the invitee views it", "", "## Requirements", "", "### Functional Requirements", "",
      "- **FR-001**: System MUST let users create albums", "- **FR-001a**: System MUST tag albums with colors", "- **FR-1.1**: System MUST cap uploads at 50 MB",
      "- **FR-1.2**: System MUST resize uploads", "- **FR-003**: System MUST export albums as zip", "- **FR-003**: System MUST export albums as tar",
      "- FR-006 — MUST keep originals", "- **FR-007**. Albums MUST sort by date", "- **FR-008** System MUST purge trash weekly", "- Note: FR-009 is TBD",
      "- **FR-010**: System MUST caption each photo with an LLM prompt", ""].join("\n"));
    put(path.join(p3, "specs", "003-ids", "tasks.md"), "# Tasks: Ids\n\n- [ ] T001 Export\n  - _Requirements: US-2.AC-1_\n- [ ] T002 Sort\n  - _Requirements: FR-007_\n");
    const r3 = S.importSpec(p3, "spec-kit", "specs/003-ids", {});
    const req3 = r3.ok ? rd(r3.dir, "requirements.md") : "";
    const W3 = S.msg("en").importSpec;
    all("1.42 SK-03: FR-001a / FR-1.1 / FR-1.2 are no definitions (prose, named as the parent named them: FR-001, FR-1), a second FR-003 line, a definition with no separator and a mention stay prose and are named; FR-003 (first), FR-006 (em dash), FR-007 ('**FR-007**.') convert; stories 1 and 3 make it US-4 (the highest number, never a count — a stale US-2.AC-1 the tasks name is below it, kept as written), FR-007 resolves (got " +
      js([r3.warnings, r3.mapping]) + ")", [
      () => r3.ok, () => r3.warnings.includes(W3.wFrCriteria("US-4", "FR-003 → US-4.AC-1, FR-006 → US-4.AC-2, FR-007 → US-4.AC-3, FR-010 → US-4.AC-4")),
      () => r3.tracks.includes("ai"), // the classifier still reads the converted FRs (the parent read them as prose): an LLM one is +ai
      () => r3.warnings.includes(W3.wUncoveredFr("FR-001, FR-1, FR-003, FR-008, FR-009")), () => !/\(FR-1\)|\(FR-001\)|SHALL ensure that 1\*\*:/.test(req3),
      () => /\n- \*\*FR-003\*\*: System MUST export albums as tar\n/.test(req3) && !/\n- \*\*FR-003\*\*: System MUST export albums as zip\n/.test(req3),
      () => /\n- \*\*FR-001a\*\*: System MUST tag albums with colors\n- \*\*FR-1\.1\*\*: System MUST cap uploads at 50 MB\n/.test(req3),
      () => /\n### US-4: Functional Requirements\n/.test(req3) && /\n### US-3 \(P2\): Share\n/.test(req3),
      () => /\*\*US-4\.AC-2\*\* — THE SYSTEM SHALL ensure that MUST keep originals \(FR-006\)/.test(req3), () => /\*\*US-4\.AC-3\*\* — THE SYSTEM SHALL ensure that albums MUST sort by date \(FR-007\)/.test(req3),
      () => /\n- \*\*FR-008\*\* System MUST purge trash weekly\n- Note: FR-009 is TBD\n/.test(req3),
      () => !r3.warnings.some((w) => w.includes("'US-2.AC-1'")) && /_Requirements: US-2\.AC-1_/.test(rd(r3.dir, "tasks.md")), () => r3.mapping["FR-007"] === "US-4.AC-3" && !r3.warnings.some((w) => /task 2:/.test(w)),
    ]);
  }

  // 1.42 SK-07: Spec Kit's /converge appends `- [ ] T042 <text> per <ref> (<gap-type>)` — the requirement the task works toward —
  // and the import gave those tasks no _Requirements:_. The ref at the line's end, after "per", becomes one (after the [USn] tag)
  // when the type means coverage (none, missing, partial, contradicts — an inclusion list: unrequested, optional, an unknown type
  // claim nothing); US<n>/AC<m> resolves through the parser's own keys (the story PRINTED n), FR-n through the FR criteria.
  {
    const p = fresh("speckit-converge");
    const k = path.join(p, "specs", "005-converge");
    put(path.join(k, "spec.md"), ["# Feature Specification: Converge", "", "### User Story 1 - Create albums (Priority: P1)", "", "**Acceptance Scenarios**:", "",
      "1. **Given** a user, **When** they create an album named Trip, **Then** the album is listed", "2. **Given** an album, **When** the user adds 501 photos, **Then** the system rejects the last one", "",
      "### User Story 3 - Share albums (Priority: P2)", "", "**Acceptance Scenarios**:", "", "1. **Given** an album, **When** the owner shares it, **Then** the invitee can view it", "",
      "## Requirements", "", "### Functional Requirements", "", "- **FR-001**: System MUST let users create albums", "- **FR-004**: System MUST log every share link created", ""].join("\n"));
    const lines = ["T042 Log every share link per FR-004 (missing)", "T043 Reject the 501st photo per US1/AC2 (partial)", "T044 Open a shared album under 2 s per SC-002 (partial)",
      "T045 Remove the debug album export per Constitution I (unrequested)", "T046 Remove the extra export per US3/AC1 (unrequested)", "T047 Per US1 rules, add an audit log in src/a.ts",
      "T048 [US3] Rate-limit shares per FR-004 (partial)", "T049 Fix the album link per US-1/AC-1", "T050 Cap uploads per FR-004.", "T051 Split exports per FR-004, FR-001 (missing)",
      "T052 Wire creation per FR-001 (missing)", "T053 Tidy per US1/AC1 (optional)", "T054 Re-check per US1/AC1 (drift)", "T055 Share per US3/AC1 (contradicts)",
      "T056 Ghost per US4/AC1 (missing)", "T057 Notes per FR-004 (see notes)", "T059 Glued per FR-004(missing)"];
    put(path.join(k, "tasks.md"), "# Tasks: Converge\n\n## Phase 5: Convergence\n\n" + lines.map((l) => "- [ ] " + l + "\n").join("") + "- [ ] T058 Own per FR-004 (missing)\n  - _Requirements: US1_\n");
    const r = S.importSpec(p, "spec-kit", "specs/005-converge", {});
    const tasks = r.ok ? rd(r.dir, "tasks.md") : "";
    const req = (n) => S.taskMarkers(S.taskBlocks(tasks).find((b) => b.number === n) || { lines: [] }).requirements;
    const got = Array.from({ length: 18 }, (_, i) => req(i + 1));
    const W = S.msg("en").importSpec;
    const want = [["US-5.AC-1"], ["US-1.AC-2"], ["SC-002"], [], [], [], ["US-3.AC-1", "US-5.AC-1"], ["US-1.AC-1"], ["US-5.AC-1"], [], ["FR-001"], [], [], ["US-3.AC-1"], ["US4/AC1"], [], [],
      ["US-1.AC-1", "US-1.AC-2"]];
    all("1.42 SK-07: a /converge task's `per <ref> (<type>)` becomes its _Requirements:_ (after its [USn] tag) for none / missing / partial / contradicts — FR-004 → its FR criterion US-5.AC-1 (the FR story past the US4 the tasks name), US1/AC2 and US-1/AC-1 by the parser's keys, US3/AC1 → the story printed 3, SC-002 as written; unrequested / optional / drift / '(see notes)' / a type glued to the ref / two refs / a mid-text 'Per' claim nothing; FR-001 (covered by words, no criterion) and US4/AC1 (no story 4 — never the FR story) are reported; a task's own _Requirements:_ kept (got " +
      js(got) + ")", [
      () => r.ok, () => js(got) === js(want), () => r.warnings.includes(W.wUnknownRef(11, "FR-001")), () => r.warnings.includes(W.wUnknownRef(15, "US4/AC1")),
      () => r.mapping["User Story 3"] === "US-3" && r.mapping["Functional Requirements"] === "US-5", () => S.taskMarkers(S.taskBlocks(tasks).find((b) => b.number === 6)).implements.includes("src/a.ts"),
    ]);
  }

  // 1.42 SK-10: importing the whole specs/ folder said only "No spec-kit spec files found in 'specs'" — the refusal now says what a
  // Spec Kit feature is (one folder holding spec.md or tasks.md, usually specs/<nnn-name>/); true too when the folder named holds
  // only a plan.md. Every other tool's message is unchanged.
  {
    const p = fresh("speckit-root-hint");
    put(path.join(p, "specs", "003-chat", "spec.md"), "# Feature Specification: Chat\n");
    put(path.join(p, "specs", "004-plan-only", "plan.md"), "# Implementation Plan: X\n");
    const r = S.importSpec(p, "spec-kit", "specs", {});
    const r2 = S.importSpec(p, "spec-kit", "specs/004-plan-only", {});
    const r3 = S.importSpec(p, "kiro", "specs", {});
    const pt = S.importSpec(p, "spec-kit", "specs", { lang: "pt" });
    ok(r.ok === false && r.error === S.msg("en").importSpec.nothingSpecKit("specs") && /specs\/<nnn-name>\//.test(r.error) && r2.ok === false && /004-plan-only' — a Spec Kit feature is one folder/.test(r2.error) &&
      r3.ok === false && r3.error === S.msg("en").importSpec.nothing("Kiro", "specs") && pt.ok === false && /uma feature do Spec Kit é uma pasta/.test(pt.error) && !fs.existsSync(path.join(p, ".specs", "specs")),
      "1.42 SK-10: a spec-kit import of the whole specs/ folder (or a folder of a plan.md alone) is refused saying a feature is one folder holding spec.md or tasks.md (usually specs/<nnn-name>/); other tools keep their message; localized (got " + js([r.error, r2.error, r3.error, pt.error]) + ")");
  }

  // 1.42 fix 1 R1-IMP-1: SK-05 moved Spec Kit's quickstart.md out of design.md, and no gate reads quickstart.md — an open
  // [NEEDS CLARIFICATION] there, which refused the design approval while it was a design.md section, passed silently. Each one the
  // counter reads in the quickstart written (a fenced or commented one is no marker there either) is also one design.md line, under
  // a heading naming the file; with no design to import (no plan.md, no design document) the scaffold's design.md is kept and they
  // follow it — its placeholders still refuse once they are resolved; a quickstart with none adds nothing. The reviewer's q1 tree.
  {
    const E = require("./lib/engine/index.js");
    const W = S.msg("en").importSpec;
    const q1 = (n, files, lang) => {
      const p = fresh("fx1-q1-" + n);
      for (const [f, t] of Object.entries(files)) put(path.join(p, "specs", "001-albums", f), t);
      const r = S.importSpec(p, "spec-kit", "specs/001-albums", { tracks: ["core"], ...(lang ? { lang } : {}) });
      return { p, r, d: r.ok && fs.existsSync(path.join(r.dir, "design.md")) ? rd(r.dir, "design.md") : "" };
    };
    const spec = "# Feature Specification: Albums\n\n### User Story 1 - Create (Priority: P1)\n\n**Acceptance Scenarios**:\n\n" +
      "1. **Given** a user, **When** they create an album named Trip, **Then** the album Trip is listed\n\n## Success Criteria\n\n- **SC-001**: an album is created in under 1 second\n";
    const plan = "# Implementation Plan: Albums\n\n## Summary\n\nSQLite.\n";
    const quick = "# Quickstart: Albums [NEEDS CLARIFICATION: staging or local?]\n\n1. Run `npm run dev`\n2. Open http://localhost:3000/[endpoint] - validates SC-001\n3. Seed the demo data [NEEDS CLARIFICATION: which fixture set?]\n" +
      "4. Sign in as [NEEDS CLARIFICATION]\n\n```text\n[NEEDS CLARIFICATION: in a code block]\n```\n\n<!-- [NEEDS CLARIFICATION: in a comment] -->\n";
    const a = q1("plan", { "spec.md": spec, "plan.md": plan, "quickstart.md": quick });
    const doc = a.r.ok ? S.specDoctor(a.p, a.r.feature) : {};
    const cl = (doc.checks || []).find((c) => c.id === "clarifications") || {};
    const ap = a.r.ok ? S.approvePhase(a.p, a.r.feature, "design", "probe", {}) : {};
    const b = q1("noplan", { "spec.md": spec, "quickstart.md": quick });
    // ...the questions resolved (their lines deleted): the kept scaffold's placeholders still refuse the design
    if (b.r.ok) fs.writeFileSync(path.join(b.r.dir, "design.md"), b.d.split("\n").filter((l) => !/NEEDS CLARIFICATION/.test(l)).join("\n"));
    const bAp = b.r.ok ? S.approvePhase(b.p, b.r.feature, "design", "probe", {}) : {};
    const c = q1("none", { "spec.md": spec, "plan.md": plan, "quickstart.md": "# Quickstart\n\n1. npm run dev - validates SC-001\n" });
    const pt = q1("pt", { "spec.md": spec, "plan.md": plan, "quickstart.md": quick }, "pt");
    all("1.42 fix 1 R1-IMP-1: an open [NEEDS CLARIFICATION] in spec-kit's quickstart.md is also one design.md line (under 'Open questions in quickstart.md', one in its title too — ours replaces it —, a fenced / commented one never) — the design gate's clarifications check refuses again; with no design to import they follow the scaffold's design.md, kept (its placeholders refuse once they are resolved); none → no section; localized (got " +
      js({ cl, failing: ap.failing, d: a.d.slice(a.d.indexOf("## Open"), a.d.indexOf("## Open") + 220), b: [b.r.warnings, b.r.imported, bAp.failing, b.d.slice(-160)], c: c.d.includes("Open questions") }) + ")", [
      () => a.r.ok, () => a.d.includes("\n## Open questions in quickstart.md\n\n> From spec-kit `quickstart.md`.\n\n- [NEEDS CLARIFICATION: staging or local?]\n- [NEEDS CLARIFICATION: which fixture set?]\n- [NEEDS CLARIFICATION]\n"),
      () => js(E.clarificationMarkers(a.d)) === js(["staging or local?", "which fixture set?", ""]), () => !/in a code block|in a comment/.test(a.d),
      () => cl.status === "fail" && /\b3 unresolved \[NEEDS CLARIFICATION\] in design\.md/.test(cl.detail), () => !ap.ok && (ap.failing || []).includes("clarifications"),
      () => rd(a.r.dir, "quickstart.md").includes("3. Seed the demo data [NEEDS CLARIFICATION: which fixture set?]\n") && !rd(a.r.dir, "quickstart.md").includes("staging or local"), // (its title is ours)
      () => b.r.ok && b.r.warnings.includes(W.wNoDesign("plan.md")) && b.r.imported.includes("design.md") && js(E.clarificationMarkers(b.d)) === js(["staging or local?", "which fixture set?", ""]),
      () => b.d.indexOf("\n## Open questions in quickstart.md\n") > 0 && b.d.endsWith("\n- [NEEDS CLARIFICATION: which fixture set?]\n- [NEEDS CLARIFICATION]\n"),
      () => !bAp.ok && (bAp.failing || []).includes("placeholders") && !(bAp.failing || []).includes("clarifications"),
      () => c.r.ok && !c.d.includes("Open questions") && !E.clarificationMarkers(c.d).length,
      () => pt.r.ok && pt.d.includes("\n## Questões em aberto do quickstart.md\n\n> Do spec-kit `quickstart.md`.\n\n- [NEEDS CLARIFICATION: staging or local?]\n"),
    ]);
  }

  // 1.42 fix 1 R1-IMP-2: the synthetic FR story took max(printed) + 1, and a stale US-<that n>.AC-1 a source task cited was kept as
  // written — trace read it as covering the FR criterion, under a warning saying it matched nothing. The story is numbered past every
  // story number a source text names (keyed on the inputs: tasks.md, spec.md, plan.md, quickstart.md …), so a stale ID names no
  // imported criterion and stays what it was before 1.42: trace's phantom, which the tasks gate refuses ("unknown ACs (typos?)"). (A
  // rule dropping such an ID was tried in fix 1 and reverted: it made that gate pass — lesson 12.) The reviewer's q3 tree; each text
  // alone; duplicate story numbers; a loose line, a held story's missing AC, a valid ref beside a stale one; another importer (Kiro)
  // keeps its pass-through; a story number past the safe integers (no number to write: the FRs stay prose, named).
  {
    const W = S.msg("en").importSpec;
    const base = ["# Feature Specification: Albums", "", "### User Story 1 - Create (Priority: P1)", "", "**Acceptance Scenarios**:", "",
      "1. **Given** a user, **When** they create an album named Trip, **Then** the album Trip is listed", "", "## Requirements", "", "### Functional Requirements", "",
      "- **FR-001**: System MUST log every album created", ""].join("\n");
    const q3 = (n, files) => {
      const p = fresh("fx1-q3-" + n);
      for (const [f, t] of Object.entries(files)) put(path.join(p, "specs", "001-albums", f), t);
      const r = S.importSpec(p, "spec-kit", "specs/001-albums", { tracks: ["core"] });
      return { p, r, tasks: r.ok && fs.existsSync(path.join(r.dir, "tasks.md")) ? rd(r.dir, "tasks.md") : "", tc: r.ok ? S.traceCheck(p, r.feature) : {} };
    };
    const reqOf = (tasks, n) => S.taskMarkers(S.taskBlocks(tasks).find((x) => x.number === n) || { lines: [] }).requirements;
    const named = (r, id) => (r.warnings || []).some((w) => w.includes("'" + id + "'"));
    const a = q3("tasks", { "spec.md": base, "tasks.md": "# Tasks: Albums\n\n- [ ] T010 [US1] Create albums in src/albums.ts\n- [ ] T011 Old export task\n  - _Requirements: US-2.AC-1_\n" });
    const ap = a.r.ok ? S.approvePhase(a.p, a.r.feature, "tasks", "probe", {}) : {};
    const tr = a.r.ok ? ((S.specDoctor(a.p, a.r.feature).checks || []).find((x) => x.id === "traceability") || {}) : {};
    // each text the parser reads names a story number alone (any case); a word ending in "us<digits>" names none (extractAcIds' boundary)
    const texts = [["spec.md", base + "\n## Edge Cases\n\n- An album deleted mid-share (see US-6.AC-2)\n", 7], ["plan.md", "# Implementation Plan: Albums\n\n## Summary\n\nUS-7 is the export story; the corpus12 notes, status-15.\n", 8],
      ["quickstart.md", "# Quickstart\n\n1. Re-check us9/ac1\n", 10], ["research.md", "# Research\n\n## Decision: zip\n\nFor [US4].\n", 5], ["contracts/api.yaml", "openapi: 3.0.0\nx-story: US11\n", 12]];
    const bs = texts.map(([f, t], i) => q3("text-" + i, { "spec.md": f === "spec.md" ? t : base, ...(f === "spec.md" ? {} : { [f]: t }) }).r.mapping["Functional Requirements"]);
    const dup = q3("dup", { "spec.md": base.replace("## Requirements", "### User Story 1 - Again (Priority: P2)\n\n**Acceptance Scenarios**:\n\n1. **Given** a, **When** b, **Then** c\n\n## Requirements") });
    const c = q3("mixed", { "spec.md": base, "tasks.md": "# Tasks: Albums\n\n## Phase 1\n\nNote _Requirements: US-5.AC-1_\n\n- [ ] T010 [US1] Create\n  - _Requirements: US-1.AC-9_\n- [ ] T011 Log\n  - _Requirements: FR-001, US-4.AC-1_\n" });
    const kp = fresh("fx1-q3-kiro");
    put(path.join(kp, ".kiro", "specs", "k", "requirements.md"), "# Requirements\n\n## Requirements\n\n### Requirement 1\n\n**User Story:** As a user, I want to sign in, so that I reach my account.\n\n#### Acceptance Criteria\n\n" +
      "1. WHEN a user signs in THEN the system SHALL create a session\n2. WHEN a user signs out THEN the system SHALL end the session\n");
    put(path.join(kp, ".kiro", "specs", "k", "tasks.md"), "# Implementation Plan\n\n- [ ] 1. Sign in\n  - _Requirements: 1.1, US-9.AC-1_\n- [ ] 2. Sign out\n  - _Requirements: US-1.AC-2_\n");
    const kr = S.importSpec(kp, "kiro", ".kiro/specs/k", { tracks: ["core"] });
    const kt = kr.ok ? rd(kr.dir, "tasks.md") : "";
    const ktc = kr.ok ? S.traceCheck(kp, kr.feature) : {};
    const e = q3("hostile", { "spec.md": base, "tasks.md": "# Tasks: Albums\n\n- [ ] T010 [US1] Create\n- [ ] T011 Old\n  - _Requirements: US-" + "9".repeat(20) + ".AC-1_\n" });
    const e2 = q3("hostile-printed", { "spec.md": base.replace("User Story 1 -", "User Story " + "9".repeat(20) + " -") });
    all("1.42 fix 1 R1-IMP-2: the FR story is numbered past every story number the source names (US-2.AC-1 in tasks.md → US-3; one in spec.md, plan.md, quickstart.md, research.md or a contract alone moves it past that one; corpus12 / status-15 name none; duplicate story numbers: past the positions) — so a stale US-n.AC-m stays as written, trace's phantom, and the tasks gate refuses it as unknown; a held story's missing AC and a stale ref beside a valid one the same; Kiro's pass-through unchanged; a number past the safe integers converts no FR (got " +
      js({ a: [a.r.warnings, a.tc.verdict, a.tc.phantomAcsInTasks, a.tc.uncoveredByTasks, ap.failing, tr.detail], bs, dup: dup.r.mapping, c: [c.r.warnings, c.tc.phantomAcsInTasks, reqOf(c.tasks, 2)], k: [kr.warnings, ktc.phantomAcsInTasks], e: [e.r.counts, e.r.warnings], e2: e2.r.counts }) + ")", [
      () => a.r.ok && a.r.mapping["Functional Requirements"] === "US-3" && a.r.mapping["FR-001"] === "US-3.AC-1",
      () => js(reqOf(a.tasks, 2)) === js(["US-2.AC-1"]) && !named(a.r, "US-2.AC-1"),
      () => a.tc.verdict === "gaps-found" && js(a.tc.phantomAcsInTasks) === js(["US-2.AC-1"]) && js(a.tc.uncoveredByTasks) === js(["US-3.AC-1"]),
      () => !ap.ok && (ap.failing || []).includes("traceability") && /unknown ACs \(typos\?\): US-2\.AC-1/.test(tr.detail || ""),
      () => js(bs) === js(texts.map((x) => "US-" + x[2])),
      () => dup.r.ok && dup.r.mapping["Functional Requirements"] === "US-3" && dup.r.mapping["FR-001"] === "US-3.AC-1",
      () => c.r.ok && c.r.mapping["Functional Requirements"] === "US-6" && /\nNote _Requirements: US-5\.AC-1_\n/.test(c.tasks) && !named(c.r, "US-5.AC-1"),
      () => js(reqOf(c.tasks, 1)) === js(["US-1.AC-9"]) && js(reqOf(c.tasks, 2)) === js(["US-6.AC-1", "US-4.AC-1"]) && !named(c.r, "US-4.AC-1"),
      () => ["US-1.AC-9", "US-4.AC-1"].every((id) => (c.tc.phantomAcsInTasks || []).includes(id)),
      () => kr.ok && js(reqOf(kt, 1)) === js(["US-1.AC-1", "US-9.AC-1"]) && js(reqOf(kt, 2)) === js(["US-1.AC-2"]) && !named(kr, "US-9.AC-1") && js(ktc.phantomAcsInTasks) === js(["US-9.AC-1"]),
      () => e.r.ok && e.r.counts.stories === 1 && !e.r.mapping["Functional Requirements"] && e.r.warnings.includes(W.wUncoveredFr("FR-001")),
      () => e2.r.ok && e2.r.counts.stories === 1 && !e2.r.mapping["Functional Requirements"] && e2.r.warnings.includes(W.wUncoveredFr("FR-001")),
    ]);
  }

  // 1.42 fix 1 R1-IMP-3: SK-06 rewrote a bare NEEDS CLARIFICATION only before nothing, ':', '-', '–' or '—' — Spec Kit's /plan also
  // writes '.', '(p95 not agreed)', ', maybe', '?', '; …' and '/TBD', which stayed bare (ungated) while the docs promised every such
  // value. The words go on as prose only when a letter or a digit follows the blanks; anything else is the marker. The reviewer's q2
  // tree (two trailing spaces, as plan-template.md writes them), then prose that stays: a letter, a digit, a letter past U+FFFF.
  {
    const E = require("./lib/engine/index.js");
    const p = fresh("fx1-q2");
    const k = speckit(p);
    const fields = [["Testing", "NEEDS CLARIFICATION"], ["Storage", "NEEDS CLARIFICATION."], ["Performance Goals", "NEEDS CLARIFICATION (p95 not agreed)"],
      ["Constraints", "NEEDS CLARIFICATION, maybe offline"], ["Scale/Scope", "NEEDS CLARIFICATION?"], ["Target Platform", "NEEDS CLARIFICATION; Linux or Windows"],
      ["Project Type", "NEEDS CLARIFICATION: web or mobile"], ["Primary Dependencies", "NEEDS CLARIFICATION — Fastify?"], ["Language/Version", "NEEDS CLARIFICATION/TBD"]];
    const prose = [["Note", "NEEDS CLARIFICATION markers are resolved in research.md"], ["Owners", "NEEDS CLARIFICATIONS pending"], ["Options", "NEEDS CLARIFICATION 2 ways"],
      ["Lead", "NEEDS CLARIFICATION " + String.fromCodePoint(0x1d49c) + "lice"]];
    put(path.join(k, "plan.md"), "# Implementation Plan: Photo Albums\n\n## Technical Context\n\n" + [...fields, ...prose].map(([f, v]) => "**" + f + "**: " + v + "  ").join("\n") + "\n\n## Project Structure\n\nsrc/\n");
    const r = S.importSpec(p, "spec-kit", "specs/001-photo-albums", { tracks: ["core"] });
    const d = r.ok ? rd(r.dir, "design.md") : "";
    const tail = (v) => v.slice("NEEDS CLARIFICATION".length);
    ok(r.ok && js(E.clarificationMarkers(d)) === js(fields.map((f) => f[0])) && fields.every(([f, v]) => d.includes("\n**" + f + "**: [NEEDS CLARIFICATION: " + f + "]" + tail(v) + "  \n")) &&
      prose.every(([f, v]) => d.includes("\n**" + f + "**: " + v + "  \n")),
      "1.42 fix 1 R1-IMP-3: a plan.md field's bare NEEDS CLARIFICATION is the marker before nothing, ':', '—', '.', '(…)', ',', '?', ';' or '/TBD' (the tail kept after it); a letter, a digit or a letter past U+FFFF after it is prose, untouched (got " +
      js({ markers: E.clarificationMarkers(d), lines: d.split("\n").filter((l) => /^\*\*/.test(l)) }) + ")");
  }

  // 1.42 fix 1 R1-IMP-4: frKeys deduplicated an FR's criteria with includes() over a growing list — 40,000 scenarios citing one FR
  // were ~800 M compares, the round's one superlinear part. A Set per FR: the parser's map holds one, sized by the criteria citing
  // the FR, each once though each cites it twice; the import maps the FR to each of them once.
  {
    const T = require("./lib/engine/index.js").loadLazyTier();
    const specOf = (n) => {
      const l = ["# Feature Specification: C", "", "### User Story 1 - T (Priority: P1)", "", "**Acceptance Scenarios**:", ""];
      for (let i = 1; i <= n; i++) l.push(i + ". **Given** a, **When** b, **Then** c (FR-1, again FR-1)");
      return [...l, "", "## Requirements", "", "### Functional Requirements", "", "- **FR-1**: System MUST keep item 1", ""].join("\n");
    };
    const N = 2000;
    const big = specOf(N);
    const m = T.parseSpecKit(path.join(tmp, "proj-r6i-fx1-frkeys-src"), (f) => (path.basename(f) === "spec.md" ? big : null), S.msg("en").importSpec, { list: () => null });
    const keys = m.frKeys.get("FR-1");
    const p = fresh("fx1-frkeys");
    put(path.join(p, "specs", "001-c", "spec.md"), specOf(4));
    const r = S.importSpec(p, "spec-kit", "specs/001-c", { tracks: ["core"] });
    ok(keys instanceof Set && keys.size === N && [...keys][0] === "User Story 1 / Scenario 1" && [...keys][N - 1] === "User Story 1 / Scenario " + N &&
      r.ok && r.mapping["FR-1"] === "US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4",
      "1.42 fix 1 R1-IMP-4: an FR's criteria are a Set (O(1) membership) — 2,000 scenarios citing FR-1 twice each hold 2,000 keys, in order; the import maps FR-1 to each criterion once (got " +
      js({ set: keys instanceof Set, size: keys && (keys.size != null ? keys.size : keys.length), mapping: r.mapping && r.mapping["FR-1"] }) + ")");
  }

  // 1.42 fix 1 R1-IMP-5 (an older gap — mutant M16 survived on the parent too): "an FR still [NEEDS CLARIFICATION] is never covered by a
  // scenario's words" had no row. Spec Kit marks an open part of a scenario the same way, so a scenario carrying the FR's own question
  // holds its every word: the FR converts (named FR → AC), never covered by the marker's words.
  {
    const W = S.msg("en").importSpec;
    const p = fresh("fx1-fr-open");
    put(path.join(p, "specs", "001-sort", "spec.md"), ["# Feature Specification: Sort", "", "### User Story 1 - List (Priority: P1)", "", "**Acceptance Scenarios**:", "",
      "1. **Given** an album, **When** the user lists albums, **Then** they are sorted by [NEEDS CLARIFICATION: sort order]", "", "## Requirements", "", "### Functional Requirements", "",
      "- **FR-009**: System MUST list albums sorted by [NEEDS CLARIFICATION: sort order]", ""].join("\n"));
    const r = S.importSpec(p, "spec-kit", "specs/001-sort", { tracks: ["core"] });
    ok(r.ok && r.warnings.includes(W.wFrCriteria("US-2", "FR-009 → US-2.AC-1")) && r.mapping["FR-009"] === "US-2.AC-1",
      "1.42 fix 1 R1-IMP-5: an FR still [NEEDS CLARIFICATION] is never covered by a scenario's words — one holding its every word and its question converts it (got " + js(r.warnings) + ")");
  }

  // 1.42 CRI-2: the two scans that replaced a backtracking regex read what it read — every line built from a short head and a
  // tail of up to 5 units over the characters each pattern turns on (blanks, a line separator, a CR, its marks), exhaustively.
  {
    const T = require("./lib/engine/index.js").loadLazyTier(); // + the lazy tier's internals (import/speckit.js frLine, skTaskLine)
    const LS = String.fromCharCode(0x2028);
    const tails = (alpha, max) => { const out = [""]; for (let i = 0, from = 0; i < max; i++) { const to = out.length; for (let j = from; j < to; j++) for (const c of alpha) out.push(out[j] + c); from = to; } return out; };
    const oldFr = (l) => { const m = /(?<![A-Za-z0-9])(FR-\d+)(?!\d)[*_\s]*:?[*_\s]*(.*)$/.exec(l); return m ? [m[1], m[2]] : null; };
    const oldTask = (l) => { const m = /^(\s*)[-*+]\s+\[[ xX~\-/]\]\s+(.*)$/.exec(l); return m ? [m[0], m[1], m[2]] : null; };
    const frTail = tails(["*", "_", ":", " ", LS, "\r", "a", "1", "F"], 5), taskTail = tails([" ", LS, "\r", "\t", "a", "["], 5);
    let n = 0;
    const bad = [];
    for (const head of ["FR-1", "- **FR-12", "aFR-1 FR-2", "FR-1" + LS + "FR-3", "x FR-"]) for (const t of frTail) {
      n++;
      if (js(T.frLine(head + t)) !== js(oldFr(head + t)) && bad.length < 5) bad.push(head + t);
    }
    for (const head of ["- [ ]", "  * [x]", "+\t[~]", LS + "- [/]", "-[ ]", "- [-]a"]) for (const t of taskTail) {
      n++;
      if (js(T.skTaskLine(head + t)) !== js(oldTask(head + t)) && bad.length < 10) bad.push(head + t);
    }
    // the citation test: /(?<![A-Za-z0-9])<id>(?!\d)/ built from the id
    const citeTail = tails(["F", "R", "-", "1", "2", "a", " "], 6);
    for (const id of ["FR-1", "FR-12"]) {
      const re = new RegExp("(?<![A-Za-z0-9])" + id + "(?!\\d)");
      for (const t of citeTail) { n++; if (T.citesFr(t, id) !== re.test(t) && bad.length < 15) bad.push(id + " in " + t); }
    }
    ok(n > 100000 && !bad.length, "1.42 CRI-2: frLine, skTaskLine and citesFr return what /(?<![A-Za-z0-9])(FR-\\d+)(?!\\d)[*_\\s]*:?[*_\\s]*(.*)$/, /^(\\s*)[-*+]\\s+\\[[ xX~\\-/]\\]\\s+(.*)$/ and the id-built citation pattern returned, on " + n + " lines (got " + js(bad) + ")");
    // CRI-1's loop: a non-markdown contract's fence is one backtick longer than its longest run (at least 3)
    const p = fresh("speckit-fence");
    const k = speckit(p);
    put(path.join(k, "contracts", "a.json"), "{ \"doc\": \"``` x ``` y `````\" }\n");
    put(path.join(k, "contracts", "b.json"), "{ \"doc\": \"` x `\" }\n");
    const r = S.importSpec(p, "spec-kit", "specs/001-photo-albums", {});
    const d = r.ok ? rd(r.dir, "design.md") : "";
    ok(/\n### `contracts\/a\.json`\n\n`{6}json\n\{ "doc": "``` x ``` y `````" \}\n`{6}\n/.test(d) && /\n### `contracts\/b\.json`\n\n```json\n\{ "doc": "` x `" \}\n```(?:\n|$)/.test(d),
      "1.42 CRI-1: a fenced contract's fence is one longer than its longest backtick run, at least 3 (got " + js(d.slice(d.indexOf("### `contracts"), d.indexOf("### `contracts") + 200)) + ")");
  }

  // 1.42 linear: the spec-kit readers — one small and one big import of a whole spec-kit folder, 05-markdown-trace L2's pattern
  // (10 × the small one's time + 6 s, under remeasure). The big folder: a contract with a 200,000-blank inner run (CRI-1:
  // t.replace(/\s+$/, "") took 39 s), one of 300,000 backtick runs (CRI-1: Math.max(...runs) threw RangeError — an MCP internal
  // error, no refusal), FR lines and task lines whose blank runs meet a line separator (CRI-2: the FR line reader's two
  // [*_\s]* runs and the task line's \s+(.*)$ backtracked quadratically — 0.3 s at 20,000, ~34 s at 200,000), and the 1.42
  // readers' own shapes: FR definitions, plan fields and converge refs with 100,000-blank runs, a converge line of 25,000 " per".
  {
    const N = 100000;
    const sp = (n) => " ".repeat(n);
    const LS = String.fromCharCode(0x2028);
    const lp = path.join(tmp, "proj-142-sk-linear");
    S.initProject(lp, ["core"], "en");
    const folder = (tag, big) => {
      const k = path.join(lp, "specs", "001-" + tag);
      const b = (n) => (big ? sp(n) : " ");
      put(path.join(k, "spec.md"), "# Feature Specification: " + tag + "\n\n**Input**: User description: \"x\"\n\n## User Scenarios & Testing\n\n### User Story 1 - T (Priority: P1)\n\n" +
        "**Acceptance Scenarios**:\n\n1. **Given** a user, **When** they open it, **Then** it is shown\n\n## Requirements\n\n### Functional Requirements\n\n" +
        "- **FR-001**:" + b(2 * N) + "System MUST keep" + b(N) + "order" + (big ? LS + "y" : "") + "\n- **FR-002**" + b(N) + ": System MUST log" + b(N) + "shares\n" +
        "- **FR-" + (big ? "1".repeat(N) : "3") + "a**: Users MUST pick\n- FR-004" + b(N) + "System MUST z\n- **FR-011**: System MUST" + b(N) + "keep\n  x" + (big ? LS + "y" : "") + "\n");
      put(path.join(k, "plan.md"), "# Implementation Plan: " + tag + "\n\n## Technical Context\n\n**Testing**:" + b(N) + "NEEDS CLARIFICATION" + b(N) + "- pytest\n" +
        "- **Storage**" + b(N) + ": needs clarification" + b(N) + "x\n**Note**: NEEDS CLARIFICATION" + b(N) + "markers are resolved\n");
      put(path.join(k, "tasks.md"), "# Tasks: " + tag + "\n\n## Phase 1\n\n- [ ]" + b(2 * N) + "T001 set up" + (big ? LS + "y" : "") + "\n" +
        "- [ ] T002 Log shares" + (big ? " per".repeat(N / 4) : "") + " per FR-002" + b(2 * N) + "(missing)\n- [ ] T003 [US1] Show it per US1/AC1" + b(N) + "\n");
      put(path.join(k, "contracts", "blank.json"), "{" + b(2 * N) + "x}\n");
      put(path.join(k, "contracts", "ticks.json"), (big ? "`a".repeat(3 * N) : "`a") + "\n");
      return path.relative(lp, k);
    };
    let seq = 0;
    const imp = (tag, big) => {
      const rel = folder(tag + "-" + ++seq, big);
      const t0 = Date.now();
      let r;
      try { r = S.importSpec(lp, "spec-kit", rel, { tracks: ["core"] }); } catch (e) { r = { ok: false, threw: String(e && e.message) }; }
      return { ms: Date.now() - t0, r };
    };
    imp("warm", false);
    const lin = remeasure(() => {
      const base = imp("base", false), big = imp("big", true);
      return { base: base.ms, ms: big.ms, ok: base.r.ok && big.r.ok, bound: 10 * Math.max(base.ms, 100) + 6000, err: big.r.threw || big.r.error };
    }, (m) => m.ms < m.bound);
    ok(lin.ok && lin.ms < lin.bound,
      "1.42 linear: a spec-kit import whose contracts hold a 200,000-blank inner run and 300,000 backtick runs, whose FR and task lines meet a line separator after a 100,000-blank run, and whose FR definitions, plan fields and converge refs hold 100,000-blank runs (25,000 ' per' on one task) runs within 10 × the small import's time + 6 s — no throw (got " +
      js({ base: lin.base, big: lin.ms, bound: lin.bound, err: lin.err, tries: lin.tries }) + ")");
  }
};
