"use strict";
// Imports — spec-kit: its [USn] task tags → _Requirements:_, the paths a task names → _Implements:_, and data-model.md / research.md / contracts/ / quickstart.md carried into design.md.
// (13-imports.js holds the area's main tests.)

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, all, S, tmp }) => {
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
    const order = ["## Summary", "## Research", "## Data Model", "## Contracts", "## Quickstart"].map((h) => d.indexOf("\n" + h + "\n"));
    ok(r.ok && order.every((i, j) => i > 0 && (j === 0 || i > order[j - 1])) && /\n### Decision: SQLite\n/.test(d) && /\n### Entities\n\n#### Album\n/.test(d) &&
      /# not a heading\nCREATE TABLE/.test(d) && /\n### `contracts\/albums\.yaml`\n\n```yaml\nopenapi: 3\.0\.0\n/.test(d) && /\n### `contracts\/events\.md`\n/.test(d) && /\n#### album\.created\n/.test(d) &&
      /1\. npm install/.test(d) && !(r.warnings || []).some((w) => /not imported/.test(w)) && !/# Research: Photo Albums/.test(d),
      "1.24 r6 G-I3: spec-kit's research.md, data-model.md, contracts/ (markdown demoted, others fenced) and quickstart.md land in design.md under their own headings — no 'not imported' warning (got " +
      js({ order, warnings: r.warnings, tail: d.slice(d.indexOf("## Research"), d.indexOf("## Research") + 400) }) + ")");
    // bounded: a design document over the import cap refuses the whole import (nothing created), as any source file does
    const p2 = fresh("speckit-big");
    const k2 = speckit(p2);
    put(path.join(k2, "research.md"), "# Research\n\n" + "x".repeat(2 * 1024 * 1024 + 10) + "\n");
    const r2 = S.importSpec(p2, "spec-kit", "specs/001-photo-albums", {});
    ok(r2.ok === false && r2.tooLarge === true && /research\.md/.test(r2.error) && !fs.existsSync(path.join(p2, ".specs", "photo-albums")),
      "1.24 r6 G-I3: a spec-kit design document over the import cap refuses the import (tooLarge, nothing created) (got " + js([r2.ok, r2.error]) + ")");
  }
};
