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
        "- **FR-" + (big ? "1".repeat(N) : "3") + "a**: Users MUST pick\n- FR-004" + b(N) + "System MUST z\n");
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
