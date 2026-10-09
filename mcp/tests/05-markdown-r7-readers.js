"use strict";
// Markdown and trace — 1.25.1 readers review: inactive-marker headings, placeholders' empty brackets, test-plan entries, setext EARS, CR-only text, the matrix's speed.
// (05-markdown-trace.js and 05-markdown-readers.js hold the area's earlier tests; this file the fixes of the 1.25.1 readers review.)

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, S, tmp, require }) => {
  const E = require("./lib/engine/index.js"); // engine internals (the readers) — read through mcp/test.js's require
  const js = JSON.stringify;
  const put = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
  const fresh = (n, tracks) => { const p = path.join(tmp, "proj-r7r-" + n); S.initProject(p, tracks || ["tdd"], "en"); return p; };

  { // 1.25.1 (1): an inactive track's marker hides a section only when it LEADS the heading — and trace_check names what it hides (inactiveAcs)
    const p = fresh("inactive");
    const f = S.createFeature(p, "Login", ["tdd"], "Login", null, "en");
    put(path.join(f.dir, "requirements.md"), ["# Requirements: Login", "", "## User Stories", "", "### US-1 (P1): Sign in", "",
      "#### Acceptance Criteria (EARS)", "- **US-1.AC-1** — WHEN a user signs in THE SYSTEM SHALL start a session.", "",
      "#### [SEC] Acceptance Criteria (EARS)", "- **US-1.AC-2** — IF a request has no token, THEN THE SYSTEM SHALL reject it with 401.", "",
      "### US-2 (P1): API notes [API]", "", "- **US-2.AC-1** — WHEN a client calls the login route THE SYSTEM SHALL answer in JSON.", "",
      "### 3. [AI] Assistant", "", "- **US-3.AC-1** — WHEN asked THE SYSTEM SHALL draft a reply.", ""].join("\n"));
    put(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. Sign in\n  - _Requirements: US-1.AC-1_\n");
    const tr = S.traceCheck(p, f.slug);
    ok(tr.totalAcs === 2 && js(tr.uncoveredByTasks) === js(["US-2.AC-1"]) && tr.verdict === "gaps-found" && js(tr.inactiveAcs) === js(["US-1.AC-2", "US-3.AC-1"]) &&
      tr.warnings.some((w) => w.kind === "inactiveAcs" && js(w.items) === js(["US-1.AC-2", "US-3.AC-1"])),
      "1.25.1 (1): a story heading that merely mentions a marker ('### US-2 (P1): API notes [API]') is core — its AC is required; a LEADING marker of a track that is off ('#### [SEC] …', '### 3. [AI] …') stays inactive, named by the warning inactiveAcs (got " + js([tr.totalAcs, tr.uncoveredByTasks, tr.inactiveAcs, tr.warnings]) + ")");
    const doc = S.specDoctor(p, f.slug);
    const t = doc.checks.find((c) => c.id === "traceability");
    ok(t && t.status === "fail" && /US-2\.AC-1/.test(t.detail) && /US-1\.AC-2/.test(t.detail),
      "1.25.1 (1): doctor's traceability fails on the core story's untasked AC and names the inactive ACs in its detail (got " + js(t) + ")");
    // the leading-marker reader itself: decoration before the marker, a run of markers, never a trailing one, case-sensitive
    const lead = E.headingLeadMarkers;
    ok(typeof lead === "function" && js(lead("[SEC] Threat Model")) === js(["[SEC]"]) && js(lead("5. 🔐 **[SEC]** [PRIVACY] Data")) === js(["[SEC]", "[PRIVACY]"]) &&
      js(lead("US-2 (P1): API notes [API]")) === js([]) && js(lead("Section 2: [AI] Prompts")) === js(["[AI]"]) && js(lead("Timeout [sec]")) === js([]),
      "1.25.1 (1): headingLeadMarkers — the markers leading a heading, after numbering / emphasis / an emoji / 'Section N:' — never one after the text");
    // with the track on, nothing is inactive: no warning
    const g = S.createFeature(p, "Login sec", ["tdd", "sec", "api", "ai"], "Login", null, "en");
    put(path.join(g.dir, "requirements.md"), fs.readFileSync(path.join(f.dir, "requirements.md"), "utf8"));
    const tr2 = S.traceCheck(p, g.slug);
    ok(tr2.totalAcs === 4 && tr2.inactiveAcs === undefined && !tr2.warnings.some((w) => w.kind === "inactiveAcs"),
      "1.25.1 (1): with the tracks on, every AC is required and there is no inactiveAcs warning (got " + js([tr2.totalAcs, tr2.inactiveAcs]) + ")");
  }

  { // 1.25.1 (4): [AI] Fallback & Degradation — the bare words are loose (an [AI] heading or under one), the whole name strict
    const st = (d) => E.sectionState(d, E.AI_SECTIONS, "[AI]").find((s) => s.section === "Fallback & Degradation").status;
    const got = [
      st("# D\n\n## Fallbacks\nRetry the card payment with a second processor.\n"),
      st("# D\n\n## Degradación\nUn resumen.\n"),
      st("# D\n\n## [AI] Fallbacks\nA templated summary when the model times out.\n"),
      st("# D\n\n## [AI] Resilience\n\n### Fallback\nA cached answer.\n"),
      st("# D\n\n## Fallback & Degradation\nA templated summary.\n"),
      st("# D\n\n## Section 7: Fallback & Degradation\nA templated summary.\n"),
      st("# D\n\n## Fallback e Degradação\nUm resumo.\n"),
      st("# D\n\n## Fallback y Degradación\nUn resumen.\n"),
    ];
    ok(js(got) === js(["missing", "missing", "filled", "filled", "filled", "filled", "filled", "filled"]),
      "1.25.1 (4): an unmarked '## Fallbacks' (a payment retry) no longer answers [AI] Fallback & Degradation; '## [AI] Fallbacks', a '### Fallback' under an [AI] heading and the full name (EN / PT / ES, 'Section 7:') do (got " + js(got) + ")");
  }

  { // 1.25.1 (5): an empty / ellipsis bracket is a slot only as a field's whole value — never in a criterion's prose
    const rep = (l) => E.placeholderReport(l).map((p) => p.text);
    const prose = ["- **US-1.AC-1** — WHEN the list is empty THE SYSTEM SHALL return HTTP 200 with an empty array []",
      "- **US-1.AC-2** — WHEN a line arrives THE SYSTEM SHALL append [...] to the log", "returns a []string", "x = []"].filter((l) => rep(l).length);
    const slots = ["- **Test runner:** []", "- []", "1. []", "- Secret store: [] — never in code", "| T-01 | [] |", "- Baseline (date/score): [ ]",
      "- SAST: [] · dependency audit: []", "Notes: [...]", "- [...]", "- [ ] []"].filter((l) => !rep(l).length);
    ok(prose.length === 0 && slots.length === 0 && rep("- SAST: [] · dependency audit: []").length === 2,
      "1.25.1 (5): '[]' / '[...]' in a criterion's prose (an empty array, an append, a Go []string) is the user's text; the templates' slots — a list item's, a label's value after its colon, a table cell's — are still placeholders (prose read as slots: " + js(prose) + ", slots missed: " + js(slots) + ")");
    const p = fresh("empty-array");
    const f = S.createFeature(p, "Orders", ["tdd"], "Orders", null, "en");
    put(path.join(f.dir, "requirements.md"), ["# Requirements: Orders", "", "## Summary", "List orders.", "", "## User Stories", "", "### US-1 (P1): List orders", "",
      "**As a** customer, **I want** my orders listed, **so that** I can track them.", "", "#### Acceptance Criteria (EARS)",
      "- **US-1.AC-1** — WHEN a customer with no orders lists them, THE SYSTEM SHALL return HTTP 200 with an empty array [].",
      "- **US-1.AC-2** — WHEN an order is placed, THE SYSTEM SHALL append [...] to the customer's history.", ""].join("\n"));
    const ph = S.specDoctor(p, f.slug).checks.find((c) => c.id === "placeholders");
    const ears = S.earsValidate(fs.readFileSync(path.join(f.dir, "requirements.md"), "utf8"));
    ok(ph && !/requirements\.md/.test(ph.detail || "") && !(ears.issues || []).some((i) => i.code === "placeholder"),
      "1.25.1 (5): doctor's placeholders and EARS no longer read 'an empty array []' / 'append [...]' as template slots (got " + js([ph, (ears.issues || []).map((i) => i.code)]) + ")");
  }

  { // 1.25.1 (6): test-plan entries — a pipe-less GFM table, a table whose T-IDs sit in a "Test ID" column that is not the first, T-ID headings
    const p = fresh("plan-shapes");
    const req = ["# Requirements: Tokens", "", "## User Stories", "", "### US-1 (P1): Sessions", "", "#### Acceptance Criteria (EARS)",
      "- **US-1.AC-1** — WHEN a token expires THE SYSTEM SHALL reject it with 401.", "- **US-1.AC-2** — WHEN a refresh token is valid THE SYSTEM SHALL issue a new token.", ""].join("\n");
    const tasks = "# Tasks\n\n- [ ] 1. Reject expired tokens\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Makes green: T-01, T-02_\n";
    const plans = {
      pipeless: "# Test Plan\n\nTest ID | Layer | Covers (AC IDs)\n--- | --- | ---\nT-01 | unit | US-1.AC-1\nT-02 | unit | US-1.AC-2\n",
      numbered: "# Test Plan\n\n| # | Test ID | Covers (AC IDs) |\n|---|---|---|\n| 1 | T-01 | US-1.AC-1 |\n| 2 | T-02 | US-1.AC-2 |\n",
      headings: "# Test Plan\n\n## Tests\n\n### T-01 — expired token rejected\n- Layer: unit\n- Covers: US-1.AC-1\n\n### T-02: refresh issues a new token\nCovers US-1.AC-2.\n\n## Coverage Check\n- Gaps: none\n",
    };
    const got = Object.entries(plans).map(([name, plan]) => {
      const f = S.createFeature(p, "Tokens " + name, ["tdd"], "Tokens", null, "en");
      put(path.join(f.dir, "requirements.md"), req);
      put(path.join(f.dir, "tasks.md"), tasks);
      put(path.join(f.dir, "test-plan.md"), plan);
      const tr = S.traceCheck(p, f.slug, { matrix: true });
      return [name, tr.coveredByTests, js(tr.uncoveredByTests), js(tr.justifiedTestGaps), tr.matrix.rows.filter((r) => (r.gaps || []).includes("no-test")).length];
    });
    ok(got.every((g) => g[1] === 2 && g[2] === "[]" && g[3] === "[]" && g[4] === 0),
      "1.25.1 (6): a pipe-less GFM table ('T-01 | US-1.AC-1'), a '| # | Test ID | Covers |' table and '### T-01 …' heading entries cover their ACs — trace_check 2/2, no justifiedTestGaps, no 'no-test' row in the matrix (got " + js(got) + ")");
    const shapes = E.testPlanEntries("| Test ID | Covers |\n|---|---|\n| T-01 | US-1.AC-1 |\nT-02 | US-1.AC-2\n- T-03 covers US-1.AC-3\n\n| T-ID | Test | Covers |\n|---|---|---|\n| T-04 | login | US-1.AC-1 |\n\n| Step | Notes |\n|---|---|\n| 1 | then T-05 runs |\n")
      .map((e) => e.ids.join());
    ok(js(shapes) === js(["T-01", "T-02", "T-03", "T-04"]),
      "1.25.1 (6): a GFM row without its outer pipes continues a piped table, a T-ID list item after it is its own entry, a 'T-ID' column is the ID column, a T-ID in another column of a table with no ID column is no entry (got " + js(shapes) + ")");
  }

  { // 1.25.1 (7): EARS reads SETEXT headings like ATX ones — the section stack comes from the ONE heading reader
    const body = (h) => "# Requirements: X\n\n" + h + "\n\n1. the admin should be able to export invoices\n2. o sistema deve exportar as faturas\n\n" +
      "## Notes\n\n- **US-1.AC-1** — WHEN an admin clicks Export THE SYSTEM SHALL download a CSV.\n";
    const lint = (t) => S.earsValidate(t).issues.map((i) => i.code).sort().join(",");
    const atx = lint(body("## Acceptance Criteria")), setext = lint(body("Acceptance Criteria\n-------------------"));
    const blocks = E.criterionBlocks("Spec\n====\n\nAcceptance Criteria\n-------------------\n\n- **US-1.AC-1** — WHEN x THE SYSTEM SHALL y.\n").blocks;
    ok(atx === setext && /no-modal/.test(setext) && blocks.length === 1 && blocks[0].section === "Spec / Acceptance Criteria",
      "1.25.1 (7): an 'Acceptance Criteria' setext heading opens the AC context (a numbered item that reads like a requirement is linted, as under '## Acceptance Criteria'); the heading lines are no criteria and the section path holds them (got " +
      js([atx, setext, blocks.map((b) => [b.section, b.text])]) + ")");
  }

  { // 1.25.1 (10): an annotated _Implements:_ reference — " (the helper)", " — new export", " - new export" — names the path before it
    const ip = ["src/lib/a.ts (the helper)", "src/lib/a.ts — new export", "src/lib/a.ts - new export", "`src/lib/a.ts` (helper)", "src/lib/a.ts:12 (the helper)"]
      .map((r) => E.implementsPath(r));
    const kept = ["src/a-b.ts", "src/a.ts:12-20", "docs/My File.md", "src/api/**"].map((r) => E.implementsPath(r));
    ok(ip.every((x) => x === "src/lib/a.ts") && js(kept) === js(["src/a-b.ts", "src/a.ts", "docs/My File.md", "src/api/**"]),
      "1.25.1 (10): implementsPath drops a trailing annotation after a path-like token (backticks and a line anchor too); a hyphenated name, a range anchor, a path with spaces, a glob are read as before (got " + js([ip, kept]) + ")");
    const p = fresh("impl-annot", ["core"]);
    const f = S.createFeature(p, "Helper", ["core"], "Helper", null, "en");
    put(path.join(p, "src", "lib", "a.ts"), "export const a = 1;\n");
    put(path.join(p, "src", "lib", "b.ts"), "export const b = 1;\n");
    put(path.join(f.dir, "requirements.md"), "# R\n\n## User Stories\n\n### US-1 (P1): x\n\n#### Acceptance Criteria (EARS)\n- **US-1.AC-1** — WHEN x THE SYSTEM SHALL y.\n");
    put(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [x] 1. The helper\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/lib/a.ts (the helper), `src/lib/b.ts` — new export_\n");
    const tr = S.traceCheck(p, f.slug);
    const cov = S.coverage(p);
    ok(tr.verdict === "pass" && js(tr.missingImplFiles) === "[]" && cov.coveredFiles === 2,
      "1.25.1 (10): a done task's annotated _Implements:_ files exist — no missingImplFiles (it blocked doctor and finish), coverage counts both (got " + js([tr.verdict, tr.missingImplFiles, cov.coveredFiles]) + ")");
  }

  { // 1.25.1 (14): CR-only line endings — the shared decode step reads a text with CRs and no LF as lines (a text with any LF is unchanged)
    const p = fresh("cr-only");
    const files = {
      "requirements.md": "# Requirements: Cr\n\n## User Stories\n\n### US-1 (P1): Sessions\n\n#### Acceptance Criteria (EARS)\n- **US-1.AC-1** — WHEN a token expires THE SYSTEM SHALL reject it with 401.\n- **US-1.AC-2** — WHEN a refresh token is valid THE SYSTEM SHALL issue a new token.\n",
      "tasks.md": "# Tasks\n\n- [ ] 1. Reject expired tokens\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Makes green: T-01, T-02_\n",
      "test-plan.md": "# Test Plan\n\n| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---|---|---|---|---|---|\n| T-01 | unit | example | expired | US-1.AC-1 | `tests/a.test.js` |\n| T-02 | unit | example | refresh | US-1.AC-2 | `tests/a.test.js` |\n",
    };
    const sum = (slug) => { const t = S.traceCheck(p, slug); return [t.verdict, t.totalAcs, t.coveredByTasks, t.coveredByTests, t.plannedTests].join(","); };
    const mk = (name, eol) => {
      const f = S.createFeature(p, name, ["tdd"], name, null, "en");
      for (const [n, t] of Object.entries(files)) fs.writeFileSync(path.join(f.dir, n), t.replace(/\n/g, eol));
      return f.slug;
    };
    const lf = sum(mk("Cr lf", "\n")), cr = sum(mk("Cr only", "\r")), crlf = sum(mk("Cr crlf", "\r\n"));
    ok(lf === "pass,2,2,2,2" && cr === lf && crlf === lf && E.decodeText(Buffer.from("a\rb\r")) === "a\nb\n" && E.decodeText(Buffer.from("a\r\r\nb")) === "a\r\r\nb",
      "1.25.1 (14): a feature saved with bare CR line endings traces as its LF / CRLF twin (it read 0 ACs beside the planned tests); decodeText turns CRs into line breaks only in a text with no LF (got " + js([lf, cr, crlf]) + ")");
  }
};
