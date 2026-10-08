"use strict";
// Imports — 1.23 review 5 regressions: a source over the import cap (refused, never cut), the design's track blocks after an open code fence, one-line names, an archived twin.
// (13-imports.js holds the imports area's earlier tests; this file the findings of the 1.23 review 5 of spec_import.)

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, rpc, payload, S, tmp }) => {
  const js = JSON.stringify;
  const fresh = (n) => { const p = path.join(tmp, "proj-r5i-" + n); S.initProject(p, ["core"]); return p; };
  const rd = (...a) => fs.readFileSync(path.join(...a), "utf8");
  const MAX = 2 * 1024 * 1024; // IMPORT_MAX_BYTES — characters

  // M10 — a source over the cap was cut silently: a plan's Steps past the cut were dropped and the warning said "no steps list found,
  // the scaffold's tasks.md was kept". Now it is refused (nothing created) naming the file and the cap — a file, a folder source's
  // file, inline text (MCP too). A file is stat'ed first; bytes are not characters: a multi-byte text under the cap imports whole.
  {
    const p = fresh("big");
    const steps = Array.from({ length: 12 }, (_, i) => `- [ ] Step ${i + 1}: implement part ${i + 1}`).join("\n");
    const plan = "# Big plan\n\n## Goals\n\n- WHEN a user saves THE SYSTEM SHALL persist it\n\n## Context\n\n" + "Lorem ipsum dolor sit amet. ".repeat(80000) + "\n\n## Steps\n\n" + steps + "\n";
    fs.writeFileSync(path.join(p, "plan.md"), plan);
    const r = S.importSpec(p, "plan", "plan.md", { name: "big" });
    const inline = S.importSpec(p, "plan", null, { text: plan, name: "big inline" });
    const mcp = await rpc("tools/call", { name: "spec_import", arguments: { tool: "plan", text: plan, name: "big mcp", projectDir: p } });
    const kiro = path.join(p, ".kiro", "specs", "huge");
    fs.mkdirSync(kiro, { recursive: true });
    fs.writeFileSync(path.join(kiro, "requirements.md"), "# Requirements\n\n## Requirements\n\n### Requirement 1: X\n\n#### Acceptance Criteria\n\n1. WHEN a THEN the system SHALL b\n");
    fs.writeFileSync(path.join(kiro, "design.md"), "# Design\n\n" + "x".repeat(MAX + 10) + "\n");
    const k = S.importSpec(p, "kiro", ".kiro/specs/huge");
    const specs = fs.readdirSync(path.join(p, ".specs"));
    ok(plan.length > MAX && !r.ok && r.tooLarge === true && new RegExp("^plan\\.md is over " + MAX + " characters").test(r.error) && /nothing was created/.test(r.error) &&
      !inline.ok && inline.tooLarge === true && mcp.result.isError === true && /is over \d+ characters/.test(js(payload(mcp))) &&
      !k.ok && /\.kiro\/specs\/huge\/design\.md is over/.test(k.error) && !specs.some((s) => /^big|^huge/.test(s)),
      "1.23 review 5 (M10): a source over the import cap is refused naming it — a plan file, inline text (MCP too), a folder source's file — and nothing is created (got " +
      js([r.error, inline.error, k.error, specs]) + ")");
    // 700k CJK characters: ~2.1 MB of UTF-8 (over the cap in BYTES), under it in characters — imported whole, every step kept
    const cjk = "# Wide plan\n\n## Context\n\n" + "汉".repeat(700000) + "\n\n## Steps\n\n" + steps + "\n";
    fs.writeFileSync(path.join(p, "wide.md"), cjk);
    const w = S.importSpec(p, "plan", "wide.md", { name: "wide" });
    ok(Buffer.byteLength(cjk) > MAX && cjk.length < MAX && w.ok && (rd(p, ".specs", "wide", "tasks.md").match(/^- \[ \] \d+\. Step/gm) || []).length === 12,
      "1.23 review 5 (M10): the cap counts characters, not bytes — a 2.1 MB file of 700k CJK characters imports whole (got " + js([w.ok, w.error]) + ")");
  }

  // M3 (import) — the active tracks' design sections followed the imported design body as written: a design.md ending inside an open
  // code block (a ```mermaid never closed) had them written INTO it, and doctor read every one 'missing'. The fence is closed first.
  {
    const p = fresh("fence");
    const k = path.join(p, ".kiro", "specs", "login");
    fs.mkdirSync(k, { recursive: true });
    fs.writeFileSync(path.join(k, "requirements.md"), "# Requirements\n\n## Introduction\n\nLogin.\n\n## Requirements\n\n### Requirement 1: Login\n\n**User Story:** As a user, I want to log in.\n\n#### Acceptance Criteria\n\n1. WHEN valid credentials THEN the system SHALL sign the user in\n");
    fs.writeFileSync(path.join(k, "design.md"), "# Design\n\n## Overview\n\nText.\n\n```mermaid\ngraph TD\n  A-->B\n");
    const r = S.importSpec(p, "kiro", ".kiro/specs/login", { tracks: ["sec"] });
    const sec = r.ok ? S.specDoctor(p, r.feature).checks.find((c) => c.id === "sec-sections") : null;
    const design = r.ok ? rd(p, ".specs", r.feature, "design.md") : "";
    ok(r.ok && sec && !/:missing/.test(sec.detail) && /A-->B\n```\n+## \[SEC\]/.test(design),
      "1.23 review 5 (M3): an imported design that ends inside an open code block gets it closed before the track sections — doctor reads them (got " + js([sec && sec.detail.slice(0, 80)]) + ")");
  }

  // L2 (import) — a caller-given name with line breaks is written on one line; L4 — an archived feature of that slug is a warning.
  {
    const p = fresh("names");
    const r = S.importSpec(p, "plan", null, { text: "# Plan\n\n## Steps\n\n- [ ] Do it\n", name: "Two\n## Lines" });
    S.archiveFeature(p, r.feature);
    const again = S.importSpec(p, "plan", null, { text: "# Plan\n\n## Steps\n\n- [ ] Do it\n", name: "Two ## Lines" });
    ok(r.ok && r.feature === "two-lines" && rd(p, ".specs", "_archive", "two-lines", "requirements.md").split("\n")[0] === "# Feature: Two ## Lines" &&
      again.ok && again.warnings.some((w) => /An archived feature is named 'two-lines' too/.test(w)),
      "1.23 review 5 (L2 / L4): an import's name is one line; importing a name an archived feature holds warns about the twin (got " + js([r.feature, again.warnings]) + ")");
  }
};
