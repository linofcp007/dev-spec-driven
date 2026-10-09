"use strict";
// Imports — 1.25: another tool's steering (kiro-steering · cursor-rules → .specs/steering/) and spec_import {dryRun: true}.
// The dry run: the whole pipeline in the write gate's dry-run sink (engine/files.js withDryRun), nothing written.
// (13-imports.js and its review files hold the imports area's earlier tests; 13-imports.js is past 1,500 lines.)

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, rpc, S, tmp, require }) => {
  const js = JSON.stringify;
  const call = async (name, args) => { const res = await rpc("tools/call", { name, arguments: args }); let body; try { body = JSON.parse(res.result.content[0].text); } catch { body = { ok: false, error: res.result.content[0].text }; } return { isError: !!res.result.isError, body }; };
  const put = (root, rel, s) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
  const rd = (root, ...p) => fs.readFileSync(path.join(root, ...p), "utf8");
  const has = (root, ...p) => fs.existsSync(path.join(root, ...p));
  // Every entry under a folder — its path, kind, bytes and mtime: a dry run leaves this byte for byte and stamp for stamp (no file,
  // no folder, no lock file, no ROADMAP.md refresh, no .specs/.gitignore line).
  const snap = (dir) => {
    const out = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
        const p = path.join(d, e.name);
        const st = fs.statSync(p);
        if (e.isDirectory()) { out.push("D " + path.relative(dir, p) + " " + st.mtimeMs); walk(p); }
        else out.push("F " + path.relative(dir, p) + " " + st.mtimeMs + " " + fs.readFileSync(p).toString("base64"));
      }
    };
    walk(dir);
    return out.join("\n");
  };
  const fresh = (n) => { const p = path.join(tmp, "proj-125-" + n); S.initProject(p, ["core"]); return p; };
  const today = S.today(); // the local calendar date (1.25.1)
  const files = (dir) => { const out = []; const walk = (d, pre) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) walk(path.join(d, e.name), pre + e.name + "/"); else if (!e.name.startsWith(".")) out.push(pre + e.name); } }; walk(dir, ""); return out.sort(); };

  // Kiro's steering: .kiro/steering/*.md, its front matter as dev-spec reads it (inclusion / fileMatchPattern).
  const kiroSteering = (p) => {
    put(p, ".kiro/steering/product.md", "# Product\n\nA shoe shop for runners.\n"); // spec_init's product.md is there: skipped (still the template)
    put(p, ".kiro/steering/brand-voice.md", "# Brand voice\n\nShort sentences. No jargon.\n"); // no front matter: Kiro's always
    put(p, ".kiro/steering/api-standards.md", "---\ninclusion: fileMatch\nfileMatchPattern: \"src/api/**\"\n---\n\n# API standards\n\n- Every handler validates its input with zod.\n");
    put(p, ".kiro/steering/release.md", "---\ninclusion: manual\n---\n# Release\n\n- Tag every release.\n");
    put(p, ".kiro/steering/glossary.md", "---\ninclusion: auto\ndescription: Domain terms\n---\n# Glossary\n\n- SKU: a stock-keeping unit.\n");
    put(p, ".kiro/steering/Team Notes.md", "# Team\n\nPairs rotate weekly.\n");
    put(p, ".kiro/steering/empty.md", "---\ninclusion: always\n---\n\n<!-- nothing yet -->\n");
    put(p, ".kiro/steering/old/legacy.md", "# Old\n");
  };
  // Cursor's project rules: .cursor/rules/*.mdc (description · globs · alwaysApply) and the legacy .cursorrules.
  const cursorRules = (p) => {
    put(p, ".cursor/rules/house.mdc", "---\ndescription: House rules\nglobs:\nalwaysApply: true\n---\n\nBe kind in reviews.\n");
    put(p, ".cursor/rules/ts.mdc", "---\ndescription: TypeScript\nglobs: *.ts, src/**/*.{ts,tsx}\nalwaysApply: false\n---\nUse strict mode.\n");
    put(p, ".cursor/rules/docs.mdc", "---\nglobs:\n  - docs/**\n  - \"*.md\"\nalwaysApply: false\n---\nWrite in plain English.\n");
    put(p, ".cursor/rules/scripts.mdc", "---\nglobs: [\"lib/**\", 'scripts/*.sh']\n---\nScripts are POSIX sh.\n");
    put(p, ".cursor/rules/ask.mdc", "---\ndescription: \"Ask before a migration\"\nglobs:\nalwaysApply: false\n---\nMigrations need a rollback.\n");
    put(p, ".cursor/rules/plain.mdc", "No front matter at all.\n");
    put(p, ".cursor/rules/README.txt", "not a rule\n");
    put(p, ".cursor/rules/dev-spec-driven.mdc", "---\ndescription: dev-spec\nglobs:\nalwaysApply: true\n---\nThe workflow.\n"); // `dev-spec rules cursor`'s own file
    put(p, ".cursorrules", "Answer tersely.\n");
  };

  // 1.25 kiro-steering: .kiro/steering/*.md → .specs/steering/<same name>.md — the front matter kept (it IS dev-spec's), the body as
  // is, a provenance comment first in the body; no front matter → Kiro's default (always) written in; Kiro's `auto` reads as manual
  // (warned); a file name normalized to a steering name; an empty file, a sub-folder named; an existing steering file never
  // overwritten — spec_init's untouched product.md is skipped with template: true so the user knows to delete it. The source is
  // only read.
  {
    const p = fresh("kiro-steer");
    kiroSteering(p);
    const productBefore = rd(p, ".specs", "steering", "product.md");
    const src0 = snap(path.join(p, ".kiro"));
    const r = S.importSpec(p, "kiro-steering", undefined, {});
    const row = (f) => (r.imported || []).find((x) => x.file === f) || {};
    const skip = (f) => (r.skipped || []).find((x) => x.from === ".kiro/steering/" + f) || {};
    ok(r.ok && r.kind === "steering" && r.tool === "kiro-steering" && r.toolName === "Kiro steering" && js(r.sources) === js([".kiro/steering"]) &&
      js(r.imported.map((x) => x.file).sort()) === js(["api-standards.md", "brand-voice.md", "glossary.md", "release.md", "team-notes.md"]) &&
      row("brand-voice.md").inclusion === "always" && row("api-standards.md").inclusion === "fileMatch" && js(row("api-standards.md").patterns) === js(["src/api/**"]) &&
      row("release.md").inclusion === "manual" && row("glossary.md").inclusion === "manual" && row("team-notes.md").from === ".kiro/steering/Team Notes.md" &&
      skip("product.md").reason === "exists" && skip("product.md").template === true && skip("empty.md").reason === "empty" &&
      r.warnings.some((w) => /\.kiro\/steering\/glossary\.md: inclusion 'auto' has no dev-spec equivalent — read as manual/.test(w)) &&
      r.warnings.some((w) => /not a steering file[^\n]*\.kiro\/steering\/old\//.test(w)) &&
      r.warnings.some((w) => /product\.md: not imported — \.specs\/steering\/product\.md already exists — still the template spec_init wrote: delete it, then import again/.test(w)) &&
      rd(p, ".specs", "steering", "product.md") === productBefore && snap(path.join(p, ".kiro")) === src0,
      "1.25 kiro-steering: every .kiro/steering file → .specs/steering/ (always / fileMatch / manual as dev-spec reads them; Kiro's auto → manual, warned; 'Team Notes.md' → team-notes.md); an empty file and a sub-folder are named; spec_init's untouched product.md is never overwritten (skipped, template: true); the source untouched (got " +
      js({ imported: r.imported, skipped: r.skipped, warnings: r.warnings }).slice(0, 900) + ")");
    ok(rd(p, ".specs", "steering", "api-standards.md") === "---\ninclusion: fileMatch\nfileMatchPattern: \"src/api/**\"\n---\n\n<!-- Imported from Kiro steering .kiro/steering/api-standards.md on " + today + ". -->\n\n# API standards\n\n- Every handler validates its input with zod.\n" &&
      rd(p, ".specs", "steering", "brand-voice.md") === "---\ninclusion: always\n---\n\n<!-- Imported from Kiro steering .kiro/steering/brand-voice.md on " + today + ". -->\n\n# Brand voice\n\nShort sentences. No jargon.\n" &&
      /^---\ninclusion: auto\ndescription: Domain terms\n---\n\n<!-- Imported from Kiro steering/.test(rd(p, ".specs", "steering", "glossary.md")),
      "1.25 kiro-steering: the front matter is kept as written and the body as is, after one provenance comment (never quoted into a brief); a file without front matter gets Kiro's default, inclusion: always");
    // Again: every name exists now — nothing written, each skipped and reported (never overwritten).
    const st0 = snap(path.join(p, ".specs", "steering"));
    const again = S.importSpec(p, "kiro-steering", ".kiro/steering", {});
    ok(again.ok && again.imported.length === 0 && again.skipped.filter((x) => x.reason === "exists").length === 6 && !again.skipped.some((x) => x.file === "api-standards.md" && x.template) &&
      snap(path.join(p, ".specs", "steering")) === st0,
      "1.25 kiro-steering: a second import writes nothing — every existing name skipped (reason exists; an imported file is real content, never 'template'), the steering folder byte-identical (got " + js(again.skipped) + ")");
  }

  // 1.25 cursor-rules: .cursor/rules/*.mdc + .cursorrules (the default places, no path — over MCP too: `path` is optional for a
  // steering tool) → alwaysApply: true → always; globs (a comma string, a YAML list, an inline list) → fileMatch, a glob naming no
  // folder matching at any depth (*.ts → **/*.ts); neither → manual; the description kept in the front matter; the legacy
  // .cursorrules → cursorrules.md, always; a non-rule file named in a warning.
  {
    const p = fresh("cursor");
    cursorRules(p);
    const r = (await call("spec_import", { tool: "cursor-rules", projectDir: p })).body;
    const row = (f) => (r.imported || []).find((x) => x.file === f) || {};
    ok(r.ok && js(r.sources) === js([".cursor/rules", ".cursorrules"]) && r.imported.length === 7 &&
      js(r.skipped) === js([{ file: "dev-spec-driven.md", from: ".cursor/rules/dev-spec-driven.mdc", reason: "own" }]) &&
      row("house.md").inclusion === "always" && row("ts.md").inclusion === "fileMatch" && js(row("ts.md").patterns) === js(["**/*.ts", "src/**/*.{ts,tsx}"]) &&
      js(row("docs.md").patterns) === js(["docs/**", "**/*.md"]) && js(row("scripts.md").patterns) === js(["lib/**", "scripts/*.sh"]) &&
      row("ask.md").inclusion === "manual" && row("plain.md").inclusion === "manual" && row("cursorrules.md").inclusion === "always" && row("cursorrules.md").from === ".cursorrules" &&
      r.warnings.length === 2 && /\.cursor\/rules\/README\.txt/.test(r.warnings[0]) && /dev-spec-driven\.mdc: not imported — it is dev-spec's own rule file/.test(r.warnings[1]),
      "1.25 cursor-rules over MCP (no path: .cursor/rules/ and .cursorrules): alwaysApply → always; globs as a comma string / a YAML list / an inline list → fileMatch (*.ts → **/*.ts); neither → manual; .cursorrules → always; README.txt named; dev-spec's own rule file skipped (reason own) (got " +
      js({ imported: r.imported, warnings: r.warnings, error: r.error }).slice(0, 700) + ")");
    ok(rd(p, ".specs", "steering", "ts.md") === "---\ninclusion: fileMatch\nfileMatchPattern: [\"**/*.ts\", \"src/**/*.{ts,tsx}\"]\ndescription: \"TypeScript\"\n---\n\n<!-- Imported from Cursor rules .cursor/rules/ts.mdc on " + today + ". -->\n\nUse strict mode.\n" &&
      rd(p, ".specs", "steering", "ask.md") === "---\ninclusion: manual\ndescription: \"Ask before a migration\"\n---\n\n<!-- Imported from Cursor rules .cursor/rules/ask.mdc on " + today + ". -->\n\nMigrations need a rollback.\n" &&
      rd(p, ".specs", "steering", "cursorrules.md") === "---\ninclusion: always\n---\n\n<!-- Imported from Cursor rules .cursorrules on " + today + ". -->\n\nAnswer tersely.\n" &&
      js(S.steeringFrontMatter(rd(p, ".specs", "steering", "scripts.md")).patterns) === js(["lib/**", "scripts/*.sh"]) && S.steeringFrontMatter(rd(p, ".specs", "steering", "house.md")).inclusion === "always",
      "1.25 cursor-rules: the written front matter is dev-spec's (inclusion, fileMatchPattern) with Cursor's description kept; the rule's body after the provenance comment; steeringFrontMatter reads it back as imported");
    // 1.25: the brief follows the imported front matter — the fileMatch rules whose globs match a task's _Implements:_ are carried and
    // quoted, the others stay out; the always ones are listed for every task; the manual ones listed as available.
    put(p, ".kiro/steering/api-standards.md", "---\ninclusion: fileMatch\nfileMatchPattern: \"src/api/**\"\n---\n\n# API standards\n\n- Every handler validates its input with zod.\n");
    const k = S.importSpec(p, "kiro-steering", ".kiro/steering/api-standards.md", {});
    const f = S.createFeature(p, "Users api", ["core"]);
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "- [ ] 1. [US1] Add the users endpoint\n  - _Implements: src/api/users.ts_\n- [ ] 2. [US1] Write the guide\n  - _Implements: docs/guide.md_\n");
    const b1 = (await call("spec_task_brief", { name: "users-api", number: 1, projectDir: p })).body;
    const b2 = S.taskBrief(p, "users-api", 2);
    const inc = (b) => b.steering.included.map((s) => s.file.replace(".specs/steering/", "") + ":" + s.inclusion).sort().join(",");
    const apiRow = (b1.steering.included.find((s) => /api-standards/.test(s.file)) || {});
    ok(k.ok && js(k.imported.map((x) => x.file)) === js(["api-standards.md"]) && js(k.sources) === js([".kiro/steering/api-standards.md"]) &&
      inc(b1) === "api-standards.md:fileMatch,constitution.md:always,cursorrules.md:always,house.md:always,structure.md:always,tech.md:always,ts.md:fileMatch" &&
      js(apiRow.matched) === js(["src/api/users.ts"]) && apiRow.quoted === true && /> - Every handler validates its input with zod\./.test(b1.brief || S.taskBrief(p, "users-api", 1, { includeBrief: true }).brief || "") &&
      inc(b2) === "constitution.md:always,cursorrules.md:always,docs.md:fileMatch,house.md:always,structure.md:always,tech.md:always" &&
      js(b2.steering.manual.slice().sort()) === js([".specs/steering/ask.md", ".specs/steering/plain.md"]),
      "1.25: a task brief follows the imported front matter — the Kiro fileMatch rule (src/api/**) and the Cursor *.ts rule ride with the task implementing src/api/users.ts (quoted), the docs rule with the one writing docs/guide.md; always rules for both; manual rules listed (got " +
      inc(b1) + " | " + inc(b2) + " | " + js(b2.steering.manual) + ")");
  }

  // 1.25 — the refusals: a path outside the project (relative, absolute, ~) is refused before anything is read or written; a feature's
  // arguments (name, tracks, text) are refused for a steering tool; no source at all is said; a feature tool still needs path / text
  // over MCP (the optional path is the steering tools' alone); the steering folder is written create-only.
  {
    const p = fresh("refuse");
    kiroSteering(p);
    const outside = path.join(tmp, "elsewhere-125");
    put(outside, "rules.md", "# Not ours\n");
    const st0 = snap(path.join(p, ".specs"));
    const rel = S.importSpec(p, "kiro-steering", "../elsewhere-125", {});
    const abs = S.importSpec(p, "cursor-rules", path.join(outside, "rules.md"), {});
    const home = S.importSpec(p, "cursor-rules", "~/.cursor/rules", {});
    const named = S.importSpec(p, "cursor-rules", undefined, { name: "x" });
    const tracked = S.importSpec(p, "kiro-steering", undefined, { tracks: ["tdd"] });
    const texted = S.importSpec(p, "kiro-steering", undefined, { text: "# x" });
    const none = S.importSpec(fresh("refuse-none"), "kiro-steering", undefined, {});
    const kiroNoPath = await call("spec_import", { tool: "kiro", projectDir: p });
    const mcpOut = await call("spec_import", { tool: "kiro-steering", path: "../elsewhere-125", projectDir: p });
    ok(!rel.ok && /outside the project/.test(rel.error) && !abs.ok && /outside the project/.test(abs.error) && !home.ok && /outside the project/.test(home.error) &&
      !named.ok && /^name: a Cursor rules import writes \.specs\/steering\/ files, not a feature/.test(named.error) && !tracked.ok && /^tracks: a Kiro steering import/.test(tracked.error) &&
      !texted.ok && /`text` imports a single document/.test(texted.error) && !none.ok && /No Kiro steering files found in \.kiro\/steering\./.test(none.error) &&
      kiroNoPath.isError && /path/.test(kiroNoPath.body.error || "") && mcpOut.isError && /outside the project/.test(mcpOut.body.error || "") &&
      snap(path.join(p, ".specs")) === st0,
      "1.25 steering refusals (nothing written): a path outside the project — relative, absolute, ~ — over the engine and MCP; name / tracks / text (a feature's arguments); no source in the default places; MCP still requires path or text for a feature tool (got " +
      js([rel.error, named.error, tracked.error, texted.error, none.error, kiroNoPath.body.error]).slice(0, 700) + ")");
  }

  // 1.25 dryRun: the whole pipeline of every import runs in the write gate's dry-run sink — the project tree stays byte-identical (no
  // feature folder, no lock file, no roadmap refresh, no .specs/.gitignore line) and the answer is the real import's, plus dryRun and
  // a preview of each file it would write (its content equal to what the real import then writes). Kiro, spec-kit, plan (+tdd +ai:
  // every scaffold) and a steering source; over MCP the same answer as the engine.
  {
    const p = fresh("dry");
    S.createFeature(p, "Existing", ["core"]);
    put(p, ".kiro/specs/login/requirements.md", "# Requirements Document\n\n## Introduction\n\nUsers log in with email.\n\n## Requirements\n\n### Requirement 1: Login\n\n**User Story:** As a user, I want to log in, so that I see my data.\n\n#### Acceptance Criteria\n\n1. WHEN the user submits valid credentials THEN the system SHALL open the dashboard\n2. IF the password is wrong THEN the system SHALL show an error\n");
    put(p, ".kiro/specs/login/design.md", "# Design\n\n## Overview\nA form.\n");
    put(p, ".kiro/specs/login/tasks.md", "# Implementation Plan\n\n- [ ] 1. Build the form\n  - _Requirements: 1.1_\n- [x] 2. Validate\n  - _Requirements: 1.2_\n");
    put(p, "specs/001-albums/spec.md", "# Feature Specification: Photo Albums\n\n## User Scenarios & Testing\n\n### User Story 1 - Create album (Priority: P1)\n\nUsers group photos.\n\n**Acceptance Scenarios**:\n\n1. **Given** a user with photos, **When** they create an album, **Then** the album appears in the list\n\n## Requirements\n\n### Functional Requirements\n\n- **FR-001**: System MUST allow users to create albums\n");
    put(p, "specs/001-albums/plan.md", "# Implementation Plan: Photo Albums\n\n## Summary\nVite + SQLite.\n");
    put(p, "specs/001-albums/tasks.md", "# Tasks: Photo Albums\n\n- [ ] T001 [US1] Create the Album model in src/models/album.ts\n");
    put(p, "plans/dark.md", "# Plan: Dark mode\n\n## Goals\n- When the user clicks the toggle, the theme switches\n\n## Steps\n- [x] Add `src/theme.ts`\n- [ ] Wire the toggle in `src/Header.tsx`\n");
    cursorRules(p);
    const cases = [["kiro", ".kiro/specs/login", {}], ["spec-kit", "specs/001-albums", {}], ["plan", "plans/dark.md", { tracks: ["tdd", "ai"] }], ["cursor-rules", undefined, {}]];
    const out = [];
    for (const [tool, src, opts] of cases) {
      const t0 = snap(p);
      const d = S.importSpec(p, tool, src, { ...opts, dryRun: true });
      const m = (await call("spec_import", { tool, ...(src ? { path: src } : {}), ...opts, dryRun: true, projectDir: p })).body;
      const untouched = snap(p) === t0;
      const r = S.importSpec(p, tool, src, opts);
      const { dryRun, preview, ...rest } = d;
      const written = r.ok ? files(r.dir) : [];
      const steer = tool === "cursor-rules";
      const previewed = (preview || []).map((x) => x.file).sort();
      const same = (preview || []).every((x) => { const t = rd(r.dir, x.file); return x.chars === t.length && (x.truncated ? t.startsWith(x.content) && x.content.length < t.length : t === x.content); });
      out.push({ tool, ok: d.ok, dryRun, untouched, eq: js(rest) === js(r), mcp: js(m) === js(d), cover: steer ? js(previewed) === js(r.imported.map((x) => x.file).sort()) : js(previewed) === js(written), same, counts: d.counts });
    }
    const c = Object.fromEntries(out.map((x) => [x.tool, x]));
    ok(out.every((x) => x.ok && x.dryRun === true && x.untouched && x.eq && x.mcp && x.cover && x.same) &&
      js(c.kiro.counts) === js({ stories: 1, criteria: 2, tasks: 2, decisions: 0 }) && js(c["spec-kit"].counts) === js({ stories: 1, criteria: 1, tasks: 1, decisions: 0 }) &&
      js(c.plan.counts) === js({ stories: 1, criteria: 1, tasks: 2, decisions: 0 }),
      "1.25 dryRun (kiro · spec-kit · plan with +tdd +ai · cursor-rules): nothing written — the project tree byte- and stamp-identical; the answer is the real import's plus dryRun and preview (every file it writes, each equal to the real file — a long one its first characters); MCP answers the same; counts of stories / criteria / tasks / decisions (got " +
      js(out) + ")");
  }

  // 1.25 dryRun refusals: every refusal of a real import is the dry run's too (plus dryRun: true), nothing written — a path outside the
  // project, a missing one, a feature that exists, a source over the cap; the preview stays bounded (a file past DRY_RUN_FILE_CHARS is
  // cut at a line end, truncated: true, its full size in chars); MCP checks the argument's type.
  {
    const p = fresh("dry-refuse");
    S.createFeature(p, "Dark mode", ["core"]);
    put(p, "plans/dark.md", "# Plan: Dark mode\n\n## Goals\n- When the user clicks the toggle, the theme switches\n");
    const t0 = snap(p);
    const pairs = [["kiro", "../outside", {}], ["kiro", "nope", {}], ["plan", "plans/dark.md", {}], ["plan", undefined, { text: "# Plan: Big\n\n## Steps\n" + "- [ ] a step\n".repeat(200000) }]]
      .map(([tool, src, opts]) => [S.importSpec(p, tool, src, { ...opts, dryRun: true }), S.importSpec(p, tool, src, opts)]);
    const same = pairs.every(([d, r]) => d.ok === false && d.dryRun === true && r.ok === false && d.error === r.error && !!d.tooLarge === !!r.tooLarge);
    const bad = await call("spec_import", { tool: "kiro", path: ".kiro/specs/x", dryRun: "yes", projectDir: p });
    const big = path.join(tmp, "proj-125-dry-big");
    const reqs = Array.from({ length: 120 }, (_, i) => `### Requirement ${i + 1}: Rule ${i + 1}\n\n#### Acceptance Criteria\n\n1. WHEN rule ${i + 1} applies THEN the system SHALL enforce rule ${i + 1}\n`).join("\n");
    put(big, ".kiro/specs/rules/requirements.md", "# Requirements Document\n\n## Introduction\n\nMany rules.\n\n## Requirements\n\n" + reqs);
    const db = S.importSpec(big, "kiro", ".kiro/specs/rules", { tracks: ["core"], dryRun: true });
    const req = (db.preview || []).find((x) => x.file === "requirements.md") || {};
    const total = (db.preview || []).reduce((n, x) => n + x.content.length, 0);
    ok(same && pairs[2][0].error && /already exists/.test(pairs[2][0].error) && pairs[3][0].tooLarge === true && snap(p) === t0 &&
      bad.isError && /dryRun/.test(bad.body.error || "") &&
      db.ok && req.truncated === true && req.chars > 4000 && req.content.length <= 4000 && req.content.endsWith("\n") && total <= 24000 && !has(big, ".specs", "rules"),
      "1.25 dryRun refusals = the real import's (+ dryRun: true), nothing written: outside, not found, feature exists, over the cap; MCP refuses a non-boolean dryRun; a long file's preview is cut at a line end (truncated, its full size kept), the whole preview bounded (got " +
      js({ errs: pairs.map(([d]) => d.error && d.error.slice(0, 60)), req: { chars: req.chars, len: (req.content || "").length, truncated: req.truncated }, total, bad: bad.body.error }) + ")");
  }

  // 1.25 — the sink itself (engine/files.js withDryRun): the write primitives record, the readers see the records, nothing reaches the
  // disk; a folder move or a link removal (no record in the sink) throws instead of writing; the sink is gone after the call.
  {
    const E = require("./lib/engine/index.js");
    const { CTX } = require("./lib/engine/ctx.js");
    const p = fresh("sink");
    const f = path.join(p, ".specs", "steering", "probe.md");
    const t0 = snap(p);
    const { value, writes } = E.withReadCache(() => E.withDryRun(() => {
      E.ensureDir(path.join(p, ".specs", "x", "y"));
      const created = E.writeIfAbsent(f, "one\n");
      const again = E.writeIfAbsent(f, "two\n");
      E.specWrite(f, "more\n", { append: true });
      let moved = null;
      try { E.renameDirSync(path.join(p, ".specs", "steering"), path.join(p, ".specs", "s2")); moved = "moved"; } catch (e) { moved = e.code; }
      return { created, again, text: E.readIfExists(f), listed: E.safeReaddir(path.join(p, ".specs", "steering")).includes("probe.md"), dir: E.isDirSafe(path.join(p, ".specs", "x", "y")), moved };
    }));
    ok(value.created === true && value.again === false && value.text === "one\nmore\n" && value.listed && value.dir && value.moved === "EDRYRUN" &&
      writes.some((w) => w.file === f && w.text === "one\nmore\n") && snap(p) === t0 && CTX.DRY_RUN === null && !has(p, ".specs", "steering", "probe.md"),
      "1.25 withDryRun: writeIfAbsent / specWrite / ensureDir record into the sink and readIfExists / safeReaddir / isDirSafe read it back; a folder move throws (EDRYRUN); the disk untouched; the sink cleared (got " + js(value) + ")");
  }
};
