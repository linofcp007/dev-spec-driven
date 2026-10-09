"use strict";
// Imports — the readers: the brownfield scan's entrypoints and stack label, spec-kit's uncovered FR-xxx warning, the importers on the ONE heading reader.
// (13-imports.js and 13-imports-scan.js hold the area's other tests.)

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, S, tmp }) => {
  const js = JSON.stringify;
  const put = (root, rel, s) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };

  { // 1.25.1 (8) + (9): Spring Boot only in Java / Kotlin, never a test file as an entrypoint, "node" for a package.json with no dependency
    const p = path.join(tmp, "proj-r7r-scan");
    put(p, "package.json", js({ name: "tool" }));
    put(p, "index.js", "console.log(1);\n");
    put(p, "tests/app.py", "from flask import Flask\napp = Flask(__name__)\n");
    put(p, "tests/test_app.py", "def test_x(): pass\n");
    put(p, "scripts/gen.js", "// writes @SpringBootApplication classes\nconst t = \"@SpringBootApplication\";\n");
    put(p, "src/main/java/App.java", "@SpringBootApplication\npublic class App {}\n");
    const r = S.scanCodebase(p);
    const kinds = r.entrypoints.map((e) => e.file + ":" + e.kind);
    ok(r.ok && js(r.stack) === js(["node"]) && kinds.includes("src/main/java/App.java:spring boot") && kinds.includes("index.js:node") &&
      !kinds.some((k) => /^scripts\/gen\.js|^tests\//.test(k)),
      "1.25.1 (8, 9): '@SpringBootApplication' marks a Java / Kotlin source only (a JS file naming it is no entrypoint); tests/app.py is a test, never a 'python' entrypoint; a package.json with no dependency is 'node', never 'node ()' (got " +
      js([r.stack, kinds]) + ")");
  }

  { // 1.25.1 (11): spec-kit's functional requirements no acceptance scenario covers are named — never carried as prose silently
    const p = path.join(tmp, "proj-r7r-speckit");
    const k = path.join(p, "specs", "001-photo-albums");
    put(k, "spec.md", "# Feature Specification: Photo Albums\n\n**Input**: User description: \"Organize photos in albums\"\n\n## User Scenarios & Testing *(mandatory)*\n\n" +
      "### User Story 1 - Create an album (Priority: P1)\n\n**Acceptance Scenarios**:\n\n1. **Given** a user, **When** they create an album named \"Trip\", **Then** the album appears in the list\n\n" +
      "### User Story 2 - Share an album (Priority: P2)\n\n**Acceptance Scenarios**:\n\n1. **Given** an album, **When** the owner shares it, **Then** the invitee can view it (FR-004)\n\n" +
      "## Requirements *(mandatory)*\n\n### Functional Requirements\n\n- **FR-001**: System MUST allow users to create albums\n- **FR-002**: System MUST allow users to reorder albums by drag and drop\n" +
      "- **FR-003**: System MUST [NEEDS CLARIFICATION: max photos per album?]\n- **FR-004**: System MUST let owners share an album by link\n");
    S.initProject(p, ["core"], "en");
    const r = S.importSpec(p, "spec-kit", "specs/001-photo-albums", {});
    const w = (r.warnings || []).find((x) => /functional requirements no acceptance scenario covers/.test(x)) || "";
    const pt = S.importSpec(p, "spec-kit", "specs/001-photo-albums", { lang: "pt", name: "albuns-pt" });
    ok(r.ok && /FR-002, FR-003/.test(w) && !/FR-001|FR-004/.test(w) && pt.ok && (pt.warnings || []).some((x) => /requisitos funcionais que nenhum cenário/.test(x) && /FR-002, FR-003/.test(x)),
      "1.25.1 (11): a spec-kit import warns for the FR-xxx no acceptance scenario covers (not covered by its words, not cited; one still [NEEDS CLARIFICATION]) — FR-002, FR-003; an FR a scenario covers or cites is not named; localized (PT) (got " +
      js([w, pt.ok && pt.warnings]) + ")");
  }

  { // 1.25.1 (15): the importers read headings with the ONE heading reader — a setext heading is a heading, its underline never carried
    const p = path.join(tmp, "proj-r7r-setext");
    const k = path.join(p, ".kiro", "specs", "photo-albums");
    put(k, "requirements.md", "Requirements Document\n=====================\n\nIntroduction\n------------\n\nUsers group photos into albums.\n\nRequirements\n------------\n\n" +
      "### Requirement 1\n\n**User Story:** As a user, I want albums, so that I can organize photos.\n\n#### Acceptance Criteria\n\n" +
      "1. WHEN a user creates an album THEN the system SHALL list it\n2. WHEN a user renames an album THEN the system SHALL show the new name\n");
    S.initProject(p, ["core"], "en");
    const r = S.importSpec(p, "kiro", ".kiro/specs/photo-albums", {});
    const req = r.ok ? fs.readFileSync(path.join(p, ".specs", r.feature, "requirements.md"), "utf8") : "";
    ok(r.ok && r.counts.criteria === 2 && /## Summary\nUsers group photos into albums\./.test(req) && !/={3,}|^-{3,}$/m.test(req) && !/Introduction/.test(req),
      "1.25.1 (15): a Kiro requirements.md written with setext headings imports as the ATX one does — its Introduction is the summary, no '====' / '----' underline is carried (got " +
      js([r.ok, r.counts, req.slice(0, 400)]) + ")");
  }
};
