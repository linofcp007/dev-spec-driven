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
};
