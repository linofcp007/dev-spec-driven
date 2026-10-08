"use strict";
// Markdown readers (review 5): linear bracket scanning, the comment- and fence-aware heading reader (setext, indented ATX), section content, indented code, task citations, sub-criterion IDs, T-IDs by number.
// The regressions of the fifth review's markdown / trace findings (P5, M2, M5, L28, L31, L32) — 05-markdown-trace.js holds the older ones.

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, S, tmp, require, __dirname }) => {
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const js = (v) => JSON.stringify(v);
  const put = (root, rel, s) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
  const timed = (fn) => { const t = process.hrtime.bigint(); let r; try { r = fn(); } catch (e) { r = { threw: String(e && e.message) }; } return { s: Number(process.hrtime.bigint() - t) / 1e9, r }; };

  { // P5 — nested bracket groups are scanned in linear time and never overflow the call stack
    // scanBrackets learned each "[" 's closer by rescanning to it at every nesting level and recursed once per level: a 24 KB criterion
    // line of nested "[a [a …]]" threw RangeError (Maximum call stack size exceeded) out of ears_validate, doctor, approve and clarify,
    // and 16 KB took 0.5 s per placeholder scan; bug.md's prose test removed the innermost groups again and again (60 KB: 2.9 s).
    const d = path.join(tmp, "proj-r5-brackets");
    S.initProject(d, ["core"], "en");
    const f = S.createFeature(d, "Nested brackets", ["core"], "", undefined, "en");
    const nest = (n) => "[a ".repeat(n) + "]".repeat(n);
    const crit = (n) => "1. **US-1.AC-1** — WHEN x THE SYSTEM SHALL y " + nest(n);
    const small = timed(() => { S.placeholderReport(crit(500)); S.earsValidate(crit(500), "en"); E.hasProseOutsideBrackets("[a".repeat(500) + "]".repeat(500)); });
    const big = timed(() => { S.placeholderReport(crit(15000)); S.earsValidate(crit(15000), "en"); E.hasProseOutsideBrackets("[a".repeat(15000) + "]".repeat(15000)); });
    ok(!(big.r && big.r.threw) && big.s < Math.max(3, 40 * small.s),
      "review 5 (P5): 60 KB of nested '[a [a … ]]' — placeholder scan, EARS, bug.md's prose test — run in linear time without a RangeError (got " + js([small.s, big.s, big.r]) + ")");
    put(f.dir, "requirements.md", "# Feature: Nested brackets\n\n## Summary\nx\n\n### US-1 (P1 — MVP): x\n\n#### Acceptance Criteria (EARS)\n" + crit(30000) + "\n");
    const runs = ["ears", "doctor", "approve", "clarify"].map((k) => [k, timed(() => (k === "ears" ? S.earsFeature(d, f.slug) : k === "doctor" ? S.specDoctor(d, f.slug)
      : k === "approve" ? S.approvePhase(d, f.slug, "requirements", "t", {}) : S.clarify(d, f.slug)))]);
    ok(runs.every(([, x]) => !(x.r && x.r.threw) && x.r && typeof x.r === "object"),
      "review 5 (P5): a requirements.md holding a 120 KB line of nested brackets — ears_validate, doctor, approve and clarify answer (no RangeError) (got " +
      js(runs.map(([k, x]) => [k, +x.s.toFixed(3), x.r && x.r.threw])) + ")");
    // the readings are unchanged: a template slot inside a group is still found, a written group still isn't, an unbalanced group stops the scan
    const rep = (l) => S.placeholderReport(l).map((p) => p.text);
    ok(js(rep("WHEN [trigger] THE SYSTEM SHALL [behavior]")) === '["[trigger]","[behavior]"]' && js(rep("A [half [N] edited] slot")) === '["[N]"]' &&
      js(rep("[x][trigger] and [trigger](url) and [[trigger]] and [^1] [trigger")) === "[]" && js(rep("x [TODO: " + "y ".repeat(1200) + "]")).length > 2400 &&
      E.hasProseOutsideBrackets("[a [b]] [c\n] d") === true && E.hasProseOutsideBrackets("[a [b] c] [d]") === false && E.hasProseOutsideBrackets("[\u{1D538}") === true,
      "review 5 (P5): the readings stay — slots in and around groups, links / reference links / wiki links / footnotes skipped, a long '[TODO: …]' still a slot; bug.md's prose test sets aside only groups closed on their line");
  }

  { // M2 + L28 — the ONE heading reader: never in an HTML comment or a fence; setext and indented ATX headings; a section of structure only is unfilled
    // A "## [SEC] Threat Model" section wrapped in <!-- … --> read as present and filled (doctor "all 5 filled"), a commented-out
    // "## Risks" passed design-risks, a `> **TODO**` kept inside a comment or a code example read "unfilled", a hand-written setext
    // or indented heading was "missing", and a body of sub-headings, a rule or an empty table was "filled".
    const SEC = [{ name: "Threat Model", syn: ["threat model"] }];
    const st = (md) => E.sectionState(md, SEC, "[SEC]")[0].status;
    const body = "STRIDE: spoofing through stolen tokens → 15-minute TTL, rotation.";
    const cases = [
      ["normal", "# D\n\n## [SEC] Threat Model\n" + body + "\n\n## Next\nx\n", "filled"],
      ["commented out", "# D\n\n<!-- later\n## [SEC] Threat Model\n" + body + "\n-->\n\n## Next\nx\n", "missing"],
      ["heading in a ~~~ fence", "# D\n\n~~~md\n## [SEC] Threat Model\n" + body + "\n~~~\n", "missing"],
      ["setext", "# D\n\n[SEC] Threat Model\n------------------\n" + body + "\n\nNext\n----\nx\n", "filled"],
      ["indented ATX (3 spaces), closing #s", "# D\n\n   ## [SEC] Threat Model ##\n" + body + "\n", "filled"],
      ["4 spaces: code, no heading", "# D\n\n    ## [SEC] Threat Model\n" + body + "\n", "missing"],
      ["sentinel in a multi-line comment", "# D\n\n## [SEC] Threat Model\n<!--\n> **TODO** — replace\n-->\n" + body + "\n", "filled"],
      ["sentinel quoted in code", "# D\n\n## [SEC] Threat Model\nThe scaffold writes:\n```md\n> **TODO** — replace\n```\n" + body + "\n", "filled"],
      ["only sub-headings", "# D\n\n## [SEC] Threat Model\n### Spoofing\nTampering\n---------\n\n## Next\nx\n", "unfilled"],
      ["only a rule", "# D\n\n## [SEC] Threat Model\n\n---\n\n## Next\nx\n", "unfilled"],
      ["only an empty table", "# D\n\n## [SEC] Threat Model\n| Threat | Mitigation |\n|---|:---:|\n\n## Next\nx\n", "unfilled"],
      ["a table with a row", "# D\n\n## [SEC] Threat Model\n| Threat | Mitigation |\n|---|---|\n| Spoofing | short TTL |\n", "filled"],
    ];
    const got = cases.map(([n, md, want]) => [n, st(md), want]);
    ok(got.every(([, g, w]) => g === w),
      "review 5 (M2 / L28): sectionState — a commented-out or fenced heading is no section, setext / indented ATX headings are; a sentinel in a comment or a code example is none; sub-headings, a rule or an empty table are nothing written (wrong: " +
      js(got.filter(([, g, w]) => g !== w)) + ")");
    // the heading reader itself: front matter and a paragraph of several lines over "---" are no setext heading; a comment's heading is none
    const hs = (t) => E.headingEntries(t.split("\n")).map((h) => h.level + ":" + h.text);
    ok(js(hs("---\ninclusion: always\n---\n\n# Title\n\nOne line\nanother line\n---\n\nSetext one\n===\n\n<!--\n## Hidden\n-->\n  ### Indented ###\n```\n## code\n```\n")) ===
      '["1:Title","1:Setext one","3:Indented"]' && js(S.extractSection("# D\n\n## Overview\nx\n<!-- ## Risks -->\n- not a risk section\n", ["risks"])) === "null",
      "review 5 (M2): headingEntries — YAML front matter and a multi-line paragraph over '---' are no heading; a setext '===' is level 1; an indented ATX heading drops its closing #s; a commented or fenced heading is none (got " +
      js(hs("---\ninclusion: always\n---\n\n# Title\n\nOne line\nanother line\n---\n\nSetext one\n===\n\n<!--\n## Hidden\n-->\n  ### Indented ###\n```\n## code\n```\n")) + ")");
    // end to end: doctor's <track>-sections and design-risks, designSections (setext), bug.md's Root Cause commented out
    const d = path.join(tmp, "proj-r5-headings");
    S.initProject(d, ["core", "sec"], "en");
    const f = S.createFeature(d, "Commented section", ["core", "sec"], "", undefined, "en");
    let design = fs.readFileSync(path.join(f.dir, "design.md"), "utf8").replace(/^> \*\*TODO\*\*.*$/gm, "Answered for this feature: tokens expire after 15 minutes.");
    design = design.replace("## [SEC] Threat Model", "<!-- dropped for now\n## [SEC] Threat Model").replace("## [SEC] Security Requirements", "-->\n\n## [SEC] Security Requirements")
      .replace(/## Risks\n/, "<!--\n## Risks\n- outage: retries\n-->\n## Old notes\n");
    put(f.dir, "design.md", design);
    const doc = S.specDoctor(d, f.slug);
    const chk = (id) => (doc.checks.find((c) => c.id === id) || {});
    const secs = E.designSections("# D\n\nOverview\n--------\nText one.\n\n<!-- ## Hidden -->\n## Data Model ##\nText two.\n");
    const bug = S.createFeature(d, "Crash bug", ["core", "tdd"], "", undefined, "en", "bugfix");
    const bugMd = fs.readFileSync(path.join(bug.dir, "bug.md"), "utf8");
    const rootSyn = E.ROOT_CAUSE_SYN;
    const written = bugMd.replace(/(## Root Cause[^\n]*\n)[\s\S]*?(?=\n## |$)/, "$1The cache key ignores the locale, so a stale page is served.\n");
    ok(chk("sec-sections").status === "fail" && /Threat Model/.test(chk("sec-sections").detail || "") && E.designWeighChecks(design, "en", {}).find((c) => c.id === "design-risks").state === "missing" &&
      js(secs) === js([{ title: "Overview", body: "Text one." }, { title: "Data Model", body: "Text two." }]) &&
      E.bugSectionFilled(written, rootSyn) === true && E.bugSectionFilled(written.replace("## Root Cause", "<!--\n## Root Cause").replace("served.\n", "served.\n-->\n"), rootSyn) === false,
      "review 5 (M2): end to end — doctor fails a commented-out [SEC] Threat Model and no longer counts a commented-out Risks section; designSections reads a setext heading and drops a closing '##'; a commented-out Root Cause is not written (got " +
      js([chk("sec-sections"), E.designWeighChecks(design, "en", {}).map((c) => c.id + ":" + c.state), secs]) + ")");
  }

  { // L28 — doctor's mermaid check: a mermaid fence (``` or ~~~) outside comments, never the scaffold's own diagram
    // It was a substring test for "```mermaid": a ~~~mermaid fence warned "missing", one mentioned in a comment passed, and the
    // untouched template diagram (A[Component] → C[(Database)]) passed.
    const T = "# D\n\n## Architecture\n";
    const states = [
      [T + "```mermaid\ngraph TD\n    A[Component] -->|action| B[Component]\n    B -->|query| C[(Database)]\n```\n", "template"],
      [T + "```mermaid\ngraph TD\n  A[Componente] -->|ação| B[Componente]\n  B -->|query| C[(Banco de Dados)]\n```\n", "template"],
      [T + "~~~mermaid\ngraph TD; Checkout-->Payments\n~~~\n", "present"], [T + "````mermaid\nsequenceDiagram\n  A->>B: pay\n````\n", "present"],
      [T + "<!-- ```mermaid\ngraph TD; A-->B\n``` -->\nText\n", "missing"], [T + "```mermaid\n```\n", "missing"], [T + "```mermaidjs\nx\n```\n", "missing"]].map(([d, w]) => [E.mermaidState(d), w]);
    const d = path.join(tmp, "proj-r5-mermaid");
    S.initProject(d, ["core"], "en");
    const f = S.createFeature(d, "Diagram check", ["core"], "", undefined, "en");
    const fresh = (S.specDoctor(d, f.slug).checks.find((c) => c.id === "mermaid") || {}).status; // a later phase's template: no news
    put(f.dir, "requirements.md", "# Feature: Diagram check\n\n## Summary\nShow the diagram.\n\n### US-1 (P1 — MVP): Diagram\n\n#### Acceptance Criteria (EARS)\n" +
      "1. **US-1.AC-1** — WHEN a user opens the page THE SYSTEM SHALL show the diagram.\n\n## Success Criteria\n- **SC-001** — 95% of pages render in 1 s.\n");
    const mer = () => S.specDoctor(d, f.slug).checks.find((c) => c.id === "mermaid") || {};
    const tmpl = mer();
    put(f.dir, "design.md", fs.readFileSync(path.join(f.dir, "design.md"), "utf8").replace(/```mermaid\n[\s\S]*?```/, "~~~mermaid\ngraph TD; Page-->Renderer\n~~~"));
    const real = mer();
    ok(states.every(([g, w]) => g === w) && fresh === "pass" && tmpl.status === "warn" && /template/.test(tmpl.detail) && real.status === "pass",
      "review 5 (L28): mermaidState — the template's diagram (any language) is 'template', a ~~~ or ```` fence 'present', one in a comment or an empty / mermaidjs block 'missing'; doctor warns on the template diagram once the design is being written, passes a ~~~mermaid diagram (got " +
      js([states, fresh, tmpl, real]) + ")");
  }

  { // L32 (first half) — an INDENTED code block is code: its AC IDs define nothing, its lines are no criterion
    // "Example:\n\n    US-1.AC-7 example" was a required AC no task covered, and an EARS no-modal error.
    const d = path.join(tmp, "proj-r5-indented");
    S.initProject(d, ["core"], "en");
    const f = S.createFeature(d, "Indented code", ["core"], "", undefined, "en");
    const req = (tail) => "# Feature: Indented code\n\n## Summary\nx\n\n### US-1 (P1 — MVP): x\n\n#### Acceptance Criteria (EARS)\n" +
      "1. **US-1.AC-1** — WHEN a user signs in THE SYSTEM SHALL create a session.\n" + tail;
    put(f.dir, "tasks.md", "# Tasks\n\n- [ ] 1. Build it\n  - _Requirements: US-1.AC-1_\n");
    put(f.dir, "requirements.md", req("\nExample of the log line:\n\n    US-1.AC-7 user=42 session=abc\n\tUS-1.AC-8 a tab is four columns\n"));
    const tr = S.traceCheck(d, f.slug), ev = S.earsFeature(d, f.slug);
    // inside a list a 4-space line is the item's continuation (and a nested item); after text it is a lazy continuation — never code
    const kept = js([...E.requirementAcIds("1. WHEN a THE SYSTEM SHALL b\n\n    see US-1.AC-2 below\n- item\n      - US-1.AC-3 nested\nText\n    US-1.AC-4 lazy\n")]);
    ok(tr.verdict === "pass" && tr.totalAcs === 1 && ev.verdict === "pass" && ev.summary.criteriaDetected === 1 && kept === '["US-1.AC-2","US-1.AC-3","US-1.AC-4"]' &&
      js([...E.codeBlockLines("# T\n    code\n\n    more\nText\n    lazy".split("\n"))]) === "[0,1,0,1,0,0]",
      "review 5 (L32): a 4-space (or tab) indented code block holds no required AC and no criterion; a list item's continuation, a nested item and a lazy continuation stay text (got " +
      js([tr.verdict, tr.totalAcs, tr.uncoveredByTasks, ev.summary, kept]) + ")");
  }

  { // M5 + L32 (second half) + L31 — ONE task-citation reader (trace_check = the matrix); T-IDs by number; sub-criterion IDs named
    // trace_check read tasks.md whole: a "Deferred" note (or the title) naming US-1.AC-2 covered it while the matrix said no-task, and
    // another feature's `checkout/US-2.AC-1` covered this feature's US-2.AC-1 (or was a phantom). Plan T-01 vs task T-1 was a gap
    // the matrix didn't see. US-1.AC-1.1 / US-1.AC-1.2 collapsed into ONE required US-1.AC-1 (and doctor said "duplicate US-1.AC-1").
    const d = path.join(tmp, "proj-r5-citations");
    S.initProject(d, ["core", "tdd"], "en");
    S.createFeature(d, "Checkout", ["core"], "", undefined, "en");
    const f = S.createFeature(d, "Citations", ["core", "tdd"], "", undefined, "en");
    const reqOf = (crit) => "# Feature: Citations\n\n## Summary\nx\n\n### US-1 (P1 — MVP): x\n\n#### Acceptance Criteria (EARS)\n" + crit.join("\n") + "\n";
    put(f.dir, "requirements.md", reqOf(["1. **US-1.AC-1** — WHEN a user signs in THE SYSTEM SHALL create a session.",
      "2. **US-1.AC-2** — WHEN a user signs out THE SYSTEM SHALL end the session.", "3. **US-2.AC-1** — WHEN a session expires THE SYSTEM SHALL ask to sign in."]));
    put(f.dir, "tasks.md", "# Tasks: Citations (US-1.AC-2 later)\n\n## Phase: Build\n- [ ] 1. Build sign-in\n  - _Requirements: US-1.AC-1_\n  - _Makes green: T-1_\n" +
      "- [ ] 2. Keep checkout/US-2.AC-1 and checkout/US-3.AC-9 working\n  - _Requirements: US-1.AC-1_\n\n## Deferred\nUS-1.AC-2 is out of scope for this release.\n");
    put(f.dir, "test-plan.md", "# Test Plan\n\n| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---|---|---|---|---|---|\n" +
      "| T-01 | unit | example | sign-in | US-1.AC-1, US-1.AC-2, US-2.AC-1 | `tests/a.test.js` |\n| T-02 | unit | example | regression | checkout/US-3.AC-9 | `tests/b.test.js` |\n");
    const tr = S.traceCheck(d, f.slug, { matrix: true });
    const row = (id) => tr.matrix.rows.find((r) => r.id === id) || {};
    ok(js(tr.uncoveredByTasks) === '["US-1.AC-2","US-2.AC-1"]' && js(tr.phantomAcsInTasks) === "[]" && js(tr.phantomAcsInTests) === "[]" &&
      js(tr.phantomTestsInTasks) === "[]" && js(tr.testsNotMappedToTasks) === '["T-02"]' &&
      tr.uncoveredByTasks.every((id) => js(row(id).gaps) === '["no-task"]') && js(row("US-1.AC-1").gaps) === "[]" && row("US-1.AC-1").tasks.some((t) => t.number === 1),
      "review 5 (M5 / L32): trace_check reads what the TASKS cite — a Deferred note and the title cover nothing, another feature's checkout/US-2.AC-1 covers nothing and is no phantom (tasks or plan); a task's T-1 is the plan's T-01 — and the matrix gives the same gaps (got " +
      js([tr.uncoveredByTasks, tr.phantomAcsInTasks, tr.phantomAcsInTests, tr.phantomTestsInTasks, tr.testsNotMappedToTasks, tr.matrix.rows.map((r) => r.id + ":" + r.gaps.join("+"))]) + ")");
    const doc = S.specDoctor(d, f.slug);
    const trc = doc.checks.find((c) => c.id === "traceability") || {};
    ok(trc.status === "fail" && /US-1\.AC-2/.test(trc.detail) && /US-2\.AC-1/.test(trc.detail),
      "review 5 (M5): doctor's traceability names the ACs only a note or another feature's reference cited (got " + js(trc) + ")");
    // L31: sub-criterion IDs are no AC IDs — named by EARS, listed by trace_check / doctor, never a duplicate of their parent
    const sub = S.createFeature(d, "Sub criteria", ["core"], "", undefined, "en");
    const subReq = reqOf(["1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b.", "2. **US-1.AC-1.1** — WHEN c THE SYSTEM SHALL d.", "3. **US-1.AC-1.2** — WHEN e THE SYSTEM SHALL f."]);
    put(sub.dir, "requirements.md", subReq);
    put(sub.dir, "tasks.md", "# Tasks\n\n- [ ] 1. Build it\n  - _Requirements: US-1.AC-1, US-1.AC-1.1_\n");
    const trS = S.traceCheck(d, sub.slug), evS = S.earsValidate(subReq, "en"), docS = S.specDoctor(d, sub.slug);
    const dc = (id) => (docS.checks.find((c) => c.id === id) || {}).status;
    ok(trS.totalAcs === 1 && js(trS.unidentifiedCriteria) === '["US-1.AC-1.1","US-1.AC-1.2"]' && trS.verdict === "gaps-found" && js(trS.phantomAcsInTasks) === "[]" &&
      evS.issues.filter((i) => i.code === "no-id").length === 2 && /sub-criterion ID/.test(evS.issues.find((i) => i.code === "no-id").msg) &&
      dc("ears") === "fail" && dc("ac-uniqueness") === "pass" && js(E.criteriaBareIds(subReq, sub.dir)) === '["US-1.AC-1.1","US-1.AC-1.2"]' &&
      js([...E.extractAcIds("US-1.AC-1.2 US-1.AC-3. and US-1.AC-12")]) === '["US-1.AC-3","US-1.AC-12"]' &&
      /subcritério/.test(S.earsValidate(subReq, "pt").issues.find((i) => i.code === "no-id").msg) && /subcriterio/.test(S.earsValidate(subReq, "es").issues.find((i) => i.code === "no-id").msg),
      "review 5 (L31): US-1.AC-1.1 / US-1.AC-1.2 are no AC IDs — EARS names each (EN / PT / ES), trace_check lists them (unidentifiedCriteria), doctor's ears fails and ac-uniqueness passes, spec_upgrade's renumber item lists them (got " +
      js([trS.totalAcs, trS.unidentifiedCriteria, trS.verdict, evS.issues.map((i) => i.code), dc("ears"), dc("ac-uniqueness")]) + ")");
  }
};
