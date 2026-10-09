"use strict";
// Markdown readers: linear bracket scanning, the comment- and fence-aware heading reader (setext, indented ATX), section content, indented code, task citations, sub-criterion IDs, T-IDs by number; every AC definition linted and unique, written content, plan-entry coverage.
// Also inactive-marker headings, placeholders' empty brackets, test-plan entries, setext EARS, CR-only text and the matrix's speed.
// (05-markdown-trace.js holds the area's other tests.)

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

  { // EARS — the ubiquitous form names its system: "THE API SHALL …" (PT "A API DEVE …", ES "LA API DEBE …") needs no EARS keyword
    const noKw = (t, l) => S.earsValidate("## Acceptance Criteria (EARS)\n\n1. **US-1.AC-1** — " + t, l).issues.filter((i) => i.code === "no-keyword").length;
    const got = [["THE API SHALL return 200 for a valid request.", "en"], ["The billing service shall retry a failed charge twice.", "en"],
      ["O serviço de faturação NÃO DEVE duplicar faturas.", "pt"], ["LA API DEBE devolver 200.", "es"], ["Payments SHALL be idempotent.", "en"],
      ["Pagamentos DEVEM ser idempotentes.", "pt"]].map(([t, l]) => noKw(t, l));
    const t0 = process.hrtime.bigint();
    S.earsValidate("1. **US-1.AC-1** — SHALL " + "the ".repeat(25000) + "x", "en"); S.earsValidate("1. **US-1.AC-1** — DEVE a " + "b".repeat(100000), "pt");
    const sec = Number(process.hrtime.bigint() - t0) / 1e9;
    ok(js(got) === "[0,0,0,0,1,1]" && sec < 3,
      "review 5: the EARS ubiquitous form 'THE <name> SHALL' (PT 'O/A <nome> DEVE', ES 'EL/LA <nombre> DEBE') gets no no-keyword note; a criterion with no article and no keyword still does; linear on 100 KB (got " + js([got, sec]) + ")");
  }

  // 1.23.1 (a review-5 leftover): requirements.md's level-1 title — written from the feature's name — never defines a criterion: a
  // name holding US-9.AC-1 (bold or plain) made one more required AC that no task covered. A ## heading or a list item still counts.
  {
    const p = path.join(tmp, "proj-r5-title-ac");
    S.initProject(p, ["core"], "en");
    const c = S.createFeature(p, "Login", ["core"]);
    const f = path.join(c.dir, "requirements.md");
    const base = fs.readFileSync(f, "utf8");
    const acsWith = (first) => { const lines = base.split("\n"); lines[0] = first; fs.writeFileSync(f, lines.join("\n")); return S.traceCheck(p, c.slug).totalAcs; };
    const plain = acsWith("# Requirements: Login");
    const bold = acsWith("# Requirements: Login **US-9.AC-1** — WHEN x THE SYSTEM SHALL y");
    const bare = acsWith("# Requirements: Login US-9.AC-1");
    fs.writeFileSync(f, base);
    const ids = E.requirementAcIds("# Title US-9.AC-1\n\n## US-1.AC-7 heading\n\n1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n");
    ok(plain === bold && plain === bare && plain > 0 && js([...ids].sort()) === js(["US-1.AC-1", "US-1.AC-7"]),
      "1.23.1: an AC ID in requirements.md's # title is no criterion (bold or plain); a ## heading's and a list item's still are (got " + js([plain, bold, bare, [...ids]]) + ")");
  }

  // ---- 1.24 review 6 — markdown / trace / doctor ----
  const R6_HEAD = "# Feature: login\n\n## Summary\nUsers log in.\n\n## User Stories\n\n### US-1 (P1): Login\n**As a** user, **I want** to log in, **so that** I see my data.\n\n#### Acceptance Criteria (EARS)\n";
  const R6_TAIL = "\n## Success Criteria\n- **SC-001** — 95% of logins succeed on first try\n";
  const r6proj = (n, tracks) => { const p = path.join(tmp, "proj-r6-" + n); S.initProject(p, tracks || ["core"], "en"); return p; };
  const r6feat = (p, name, tracks, req) => { const c = S.createFeature(p, name, tracks || ["core"], "x", undefined, "en"); if (req != null) put(c.dir, "requirements.md", req); return c; };
  const status = (doc, id) => (doc.checks.find((c) => c.id === id) || {}).status;

  // 1.24 r6 F1: EARS lints every unit that defines an AC ID trace_check counts — a `[US-1.AC-1]` / `(US-1.AC-1)` lead (a checkbox before it
  // too) is linted like `- US-1.AC-1` — and an ID trace_check requires that NO linted criterion carries (a trailing "(US-1.AC-1)", a
  // blockquote, an ID after a word) fails doctor's ears and the requirements approval: it was counted, never checked, and approved.
  {
    const p = r6proj("ears-ids");
    const second = "- US-1.AC-2 — WHEN the account is locked THE SYSTEM SHALL email the owner\n";
    const bad = {
      bracket: "- [US-1.AC-1] User can log in with a password\n",
      paren: "- (US-1.AC-1) User can log in with a password\n",
      boxBracket: "- [ ] [US-1.AC-1] User can log in with a password\n",
      trailing: "- WHEN the password is wrong the user sees an error (US-1.AC-1)\n",
      quote: "> **US-1.AC-1** — the user sees an error\n\n",
      afterWord: "- Login US-1.AC-1: the user sees an error\n",
    };
    const good = {
      bracket: "- [US-1.AC-1] WHEN the password is wrong THE SYSTEM SHALL show an error\n",
      boxBold: "- [ ] **US-1.AC-1** — WHEN the password is wrong THE SYSTEM SHALL show an error\n",
      table: "| ID | Criterion |\n|---|---|\n| US-1.AC-1 | WHEN the password is wrong THE SYSTEM SHALL show an error |\n\n",
      heading: "##### US-1.AC-1: Wrong password\nWHEN the password is wrong THE SYSTEM SHALL show an error\n\n",
    };
    const runForm = (k, line) => {
      const c = r6feat(p, "F1 " + k, ["core"], R6_HEAD + line + second + R6_TAIL);
      S.approvePhase(p, c.slug, "classification", "t", { force: true });
      const ap = S.approvePhase(p, c.slug, "requirements", "t");
      return { ap: ap.ok, why: ap.ok ? "" : String(ap.error).split("\n")[0], ears: status(S.specDoctor(p, c.slug), "ears") };
    };
    const badR = Object.entries(bad).map(([k, l]) => [k, runForm("bad " + k, l)]);
    const goodR = Object.entries(good).map(([k, l]) => [k, runForm("good " + k, l)]);
    const linted = ["bracket", "paren", "boxBracket"].map((k) => S.earsValidate(R6_HEAD + bad[k] + second, "en").issues.some((i) => i.code === "no-modal" && i.line === 12));
    ok(badR.every(([, r]) => !r.ap && /ears/.test(r.why) && r.ears === "fail") && goodR.every(([, r]) => r.ap && r.ears === "pass") && linted.every(Boolean),
      "1.24 r6 F1: an AC led by [ID] / (ID) is linted (no modal → error); an AC ID no linted criterion carries fails doctor's ears and the requirements approval; well-formed tables, headings, checkbox and bracket criteria still pass (got " +
      js([badR, goodR, linted]) + ")");
  }

  // 1.24 r6 F2 + F8: ac-uniqueness reads the AC-DEFINING units — EARS's reader (criterionBlocks {acUnits} + criterionLabel): a duplicate
  // written as a checkbox item, an italic / code / bracketed ID, a heading, a table row or a paragraph line was missed (only `- US-` /
  // `1. **US-**` counted) and its second criterion vanished from trace_check. A reference (a coverage table, a Notes line) defines
  // nothing, a sub-criterion ID is no duplicate of its parent, and IDs compare by number (US-1.AC-01 is US-1.AC-1).
  {
    const A = "WHEN the password is wrong THE SYSTEM SHALL show an error", B = "WHEN the account is locked THE SYSTEM SHALL email the owner";
    const forms = {
      checkbox: (id, t) => `- [ ] **${id}** — ${t}\n`,
      checkboxPlain: (id, t) => `- [ ] ${id} — ${t}\n`,
      italic: (id, t) => `- _${id}_ — ${t}\n`,
      code: (id, t) => "- `" + id + "` — " + t + "\n",
      bracket: (id, t) => `- [${id}] ${t}\n`,
      heading: (id, t) => `##### ${id}\n${t}\n\n`,
      table: (id, t) => `| ${id} | ${t} |\n`,
      paragraph: (id, t) => `${id} — ${t}\n\n`,
    };
    const dup = Object.entries(forms).map(([k, f]) => [k, E.acDuplicates(R6_HEAD + (k === "table" ? "| ID | Criterion |\n|---|---|\n" : "") + f("US-1.AC-1", A) + f("US-1.AC-1", B) + R6_TAIL)]);
    const padded = [E.acDuplicates(R6_HEAD + "- US-1.AC-1 — " + A + "\n- US-1.AC-01 — " + B + "\n"), E.acDuplicates(R6_HEAD + "- US-1.AC-1 — " + A + "\n- US-01.AC-1 — " + B + "\n")];
    const refs = E.acDuplicates(R6_HEAD + "- US-1.AC-1 — " + A + "\n- US-1.AC-1.1 — " + B + "\n- US-1.AC-1.2 — " + B + "\n\n## Coverage\n| AC | Priority |\n|---|---|\n| US-1.AC-1 | P1 |\n\n## Notes\nUS-1.AC-1 depends on the IdP's error codes.\n");
    const p = r6proj("ac-dups");
    const c = r6feat(p, "Dups", ["core"], R6_HEAD + forms.checkbox("US-1.AC-1", A) + forms.checkbox("US-1.AC-1", B) + R6_TAIL);
    S.approvePhase(p, c.slug, "classification", "t", { force: true });
    const ap = S.approvePhase(p, c.slug, "requirements", "t");
    const docSt = status(S.specDoctor(p, c.slug), "ac-uniqueness");
    ok(dup.every(([, d]) => js(d) === '["US-1.AC-1"]') && padded.every((d) => js(d) === '["US-1.AC-1"]') && js(refs) === "[]" && docSt === "fail" && !ap.ok && /ac-uniqueness/.test(ap.error),
      "1.24 r6 F2/F8: a duplicate AC in any defining form (checkbox, italic, code, bracket, heading, table row, paragraph) and a zero-padded twin fail ac-uniqueness (doctor + approval); references and sub-criterion IDs don't (got " +
      js([dup, padded, refs, docSt, ap.ok]) + ")");
  }

  // 1.24 r6 F8: a zero-padded AC ID (US-1.AC-01, US-01.AC-1) is an EARS warning naming the canonical form — trace_check, tasks and the
  // test plan compare AC IDs as written, so `US-1.AC-01` and a task's `US-1.AC-1` were an uncovered AC and a phantom with no hint why.
  {
    const ev = S.earsValidate(R6_HEAD + "- US-1.AC-01 — WHEN a THE SYSTEM SHALL b\n- US-02.AC-1 — WHEN c THE SYSTEM SHALL d\n- US-3.AC-3 — WHEN e THE SYSTEM SHALL f\n", "en");
    const pad = ev.issues.filter((i) => i.code === "padded-id");
    ok(ev.verdict === "pass" && pad.length === 2 && pad.every((i) => i.severity === "warn") && /US-1\.AC-1(?!\d)/.test(pad[0].msg) && /US-2\.AC-1(?!\d)/.test(pad[1].msg) && pad[0].line === 12,
      "1.24 r6 F8: EARS warns `padded-id` on US-1.AC-01 / US-02.AC-1, naming US-1.AC-1 / US-2.AC-1 (got " + js(ev.issues) + ")");
  }

  // 1.24 r6 F3: an AC's test coverage comes from the test plan's ENTRIES only (a T-ID's table row or list item — testPlanEntries), never
  // from any mention: an AC named in the Coverage Check's "Gaps" list or under "Out of Scope" counted as covered and the test-plan
  // approval passed. Such an AC is uncovered (a gap — trace_check, the matrix's no-test and the approval agree) and the plan's naming
  // of it is a visible warning, justifiedTestGaps.
  {
    const p = r6proj("plan-gaps", ["core", "tdd"]);
    const req = R6_HEAD + "1. **US-1.AC-1** — WHEN the password is wrong THE SYSTEM SHALL show an error\n2. **US-1.AC-2** — WHEN the account is locked THE SYSTEM SHALL email the owner\n" +
      "3. **US-1.AC-3** — WHEN the user logs out THE SYSTEM SHALL clear the session\n4. **US-1.AC-4** — WHEN the user resets the password THE SYSTEM SHALL email a link\n" + R6_TAIL;
    const c = r6feat(p, "Plan gaps", ["core", "tdd"], req);
    put(c.dir, "tasks.md", "# Tasks: login\n\n## Story US-1\n- [ ] 1. [US1] Login errors\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4_\n  - _Makes green: T-01, T-02_\n");
    put(c.dir, "test-plan.md", "# Test Plan: login\n\n## Traceability Matrix\n\n| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---|---|---|---|---|---|\n" +
      "| T-01 | unit | example | wrong password | US-1.AC-1 | `tests/login.test.js` |\n\n- T-02: a reset link is emailed (US-1.AC-4)\n\n## Coverage Check\nGaps (with justification):\n" +
      "- US-1.AC-2 — not tested yet, next sprint\n\n## Out of Scope for Testing\n- US-1.AC-3 (logout is the framework's)\n");
    const tr = S.traceCheck(p, c.slug, { matrix: true });
    const row = (id) => tr.matrix.rows.find((r) => r.id === id) || { gaps: [] };
    const warn = (tr.warnings || []).find((w) => w.kind === "justifiedTestGaps");
    for (const ph of ["classification", "requirements", "design"]) S.approvePhase(p, c.slug, ph, "t", { force: true });
    const ap = S.approvePhase(p, c.slug, "test-plan", "t");
    ok(js(tr.uncoveredByTests) === '["US-1.AC-2","US-1.AC-3"]' && tr.verdict === "gaps-found" && !!warn && js(warn.items) === '["US-1.AC-2","US-1.AC-3"]' &&
      row("US-1.AC-2").gaps.includes("no-test") && row("US-1.AC-3").gaps.includes("no-test") && !row("US-1.AC-1").gaps.length && !row("US-1.AC-4").gaps.includes("no-test") &&
      !ap.ok && /traceability/.test(ap.error) && !S.traceGaps(tr).some((g) => g.kind === "justifiedTestGaps"),
      "1.24 r6 F3: only a test-plan entry covers an AC — one named in the Gaps list / Out of Scope is uncovered (trace_check, the matrix's no-test, the test-plan approval refused) and listed as the warning justifiedTestGaps (got " +
      js([tr.uncoveredByTests, tr.verdict, tr.warnings, ["US-1.AC-1", "US-1.AC-2", "US-1.AC-3", "US-1.AC-4"].map((id) => row(id).gaps), ap.ok]) + ")");
  }

  // 1.24 r6 F4: ONE reader of what a section holds — writtenContent(): a generic slot line (TODO, TBD, "…", "Pending.", **TBD**, [TBD],
  // `- [ ] TODO`) and a punctuation-only line (`-`, `—`, `...`) are no answer. A [SEC] section holding only "TBD" was filled (doctor "all 5
  // filled", the design approved), a bugfix's Root Cause "TBD" passed the iron law, a Constitution Check "TBD" passed its gate, a Risks
  // section "Pending." passed design-risks. A real one-word answer stays filled: "N/A", "None." (a Risks section's honest answer).
  {
    const SEC = [{ name: "Threat Model", syn: ["threat model"] }];
    const st = (answer) => E.sectionState("# Design: x\n\n## [SEC] Threat Model\n" + answer + "\n\n## Other\nx\n", SEC, "[SEC]")[0].status;
    const nothing = ["TBD", "TODO", "TODO.", "- TBD", "...", "…", "**TBD**", "[TBD]", "- [ ] TODO", "Pending.", "-", "—", "| TBD | TBD |", "TBD\n\n- ...\n\n—", "> TBD", "pendente", "Pendiente."];
    const written = ["STRIDE per boundary; the login form is the entry point.", "N/A", "None.", "- Rate limit: 5 per minute", "```json\n{ \"limit\": 5 }\n```"];
    const unf = nothing.map((a) => [a, st(a)]).filter(([, s]) => s !== "unfilled");
    const fil = written.map((a) => [a, st(a)]).filter(([, s]) => s !== "filled");
    const bug = (rc) => "# Bug: x\n\n## Reproduction\n1. open /login\n2. submit an empty password\n\n## Root Cause\n" + rc + "\n\n## Fix\nx\n";
    const bugs = [["TBD", false], ["Pending.", false], ["- …", false], ["The handler reads `req.body.password.length` on an undefined body (stack trace in the log).", true]]
      .map(([rc, want]) => E.bugSectionFilled(bug(rc), E.ROOT_CAUSE_SYN) === want);
    const cons = [["TBD", false], ["**TBD**", false], ["- [x] Simplicity — one service, no new dependency", true]].map(([t, want]) => E.sectionFilled("# Design\n\n## Constitution Check\n" + t + "\n", E.CONSTITUTION_SYN) === want);
    const risk = (t) => E.designWeighChecks("# Design\n\n## Risks\n" + t + "\n", "en").find((c) => c.id === "design-risks").state;
    // end to end: a +sec design whose five sections say "TBD" fails sec-sections; a bugfix whose Root Cause says "TBD" fails root-cause
    const p = r6proj("written", ["core"]);
    const c = S.createFeature(p, "Written sec", ["core", "sec"], "x", undefined, "en");
    const dfile = path.join(c.dir, "design.md");
    fs.writeFileSync(dfile, fs.readFileSync(dfile, "utf8").replace(/(## \[SEC\] [^\n]+\n)> \*\*TODO\*\*[^\n]*\n- [^\n]*\n/g, (m, h) => h + "TBD\n"));
    const secSt = status(S.specDoctor(p, c.slug), "sec-sections");
    const b = S.createFeature(p, "Login crash", ["core", "tdd"], "Login crashes on empty password", undefined, "en", "bugfix", { reproduction: "1. open /login 2. submit empty password 3. 500" });
    const bfile = path.join(b.dir, "bug.md");
    fs.writeFileSync(bfile, fs.readFileSync(bfile, "utf8").replace(/(## Root Cause[^\n]*\n)[\s\S]*?(?=\n## )/, "$1TBD\n"));
    const rcSt = status(S.specDoctor(p, b.slug), "root-cause");
    ok(!unf.length && !fil.length && bugs.every(Boolean) && cons.every(Boolean) && risk("Pending.") === "template" && risk("None.") === "filled" && secSt === "fail" && rcSt === "fail",
      "1.24 r6 F4: a section holding only a generic slot / punctuation line (TBD, TODO, …, -, —, Pending., **TBD**, [TBD]) is unfilled for the track sections, bug.md's Root Cause, the Constitution Check and design-risks; N/A and None. stay filled (got " +
      js([unf, fil, bugs, cons, risk("Pending."), risk("None."), secSt, rcSt]) + ")");
  }

  // 1.24 r6 F9: a removed track's criteria are no required ACs — trace_check (and doctor's traceability through it) read requirements.md
  // and tasks.md as ACTIVE (activeDesign / activeTasks), as the matrix and tracks.md's removal rule do: a feature that turned +saas off and
  // deleted its +saas tasks failed traceability on the +saas criteria the matrix no longer lists. A task citing an inactive criterion is no
  // phantom (it is defined, only inactive), and an inactive section's NFR raises no uncoveredNfr.
  {
    const p = r6proj("removed-track", ["core", "saas"]);
    const c = S.createFeature(p, "Removed saas", ["core", "saas"], "x", undefined, "en");
    const req = R6_HEAD + "1. **US-1.AC-1** — WHEN the password is wrong THE SYSTEM SHALL show an error\n\n## [SaaS] Scale & Tenancy\n" +
      "5. **US-1.AC-5** — WHILE under peak load THE SYSTEM SHALL answer within 200 ms\n6. **US-1.AC-6** — THE SYSTEM SHALL scope every query by tenant\n- **NFR-1** — p95 under 200 ms at 500 rps\n" + R6_TAIL;
    put(c.dir, "requirements.md", req);
    put(c.dir, "tasks.md", "# Tasks: login\n\n## Story US-1\n- [ ] 1. [US1] Show the error\n  - _Requirements: US-1.AC-1_\n- [ ] 2. [US1] Note the tenancy work for later (US-1.AC-6)\n  - _Requirements: US-1.AC-1_\n");
    const on = S.traceCheck(p, c.slug);
    S.addTrack(p, c.slug, ["saas"], { remove: true });
    const tr = S.traceCheck(p, c.slug, { matrix: true });
    const rows = tr.matrix.rows.map((r) => r.id);
    const docT = status(S.specDoctor(p, c.slug), "traceability");
    ok(js(on.uncoveredByTasks) === '["US-1.AC-5"]' && tr.verdict === "pass" && tr.totalAcs === 1 && !tr.uncoveredByTasks.length && !tr.phantomAcsInTasks.length &&
      !tr.uncoveredNfr.length && !rows.includes("US-1.AC-5") && !rows.includes("NFR-1") && docT === "pass",
      "1.24 r6 F9: with +saas removed its [SaaS] criteria / NFRs are not required by trace_check or doctor (the matrix's rows), and a task citing one is no phantom (got " +
      js([on.uncoveredByTasks, tr.verdict, tr.totalAcs, tr.uncoveredByTasks, tr.phantomAcsInTasks, tr.uncoveredNfr, rows, docT]) + ")");
  }

  // 1.24 r6 F10: doctor's constitution-check reads the gate's reader (sectionFilled on the active design): a "Constitution Check" only in an
  // HTML comment passed doctor ("present") while the design approval refused it; a section saying "TBD" too.
  {
    const p = r6proj("constitution");
    const c = S.createFeature(p, "Constitution", ["core"], "x", undefined, "en");
    const dfile = path.join(c.dir, "design.md");
    const base = fs.readFileSync(dfile, "utf8").replace(/\n## Constitution Check[\s\S]*?(?=\n## |$)/, "\n");
    const run = (extra) => { fs.writeFileSync(dfile, base + extra); const d = S.specDoctor(p, c.slug).checks.find((x) => x.id === "constitution-check"); return d.status; };
    const got = [run("\n<!-- Constitution Check: to do after the review -->\n"), run("\n## Constitution Check\nTBD\n"), run("\n## Constitution Check\n- [x] Simplicity — one service, no new dependency\n")];
    ok(js(got) === '["warn","warn","pass"]', "1.24 r6 F10: doctor's constitution-check passes only a filled Constitution Check section (a comment or TBD warns, as the gate refuses) (got " + js(got) + ")");
  }

  // 1.24 r6 F11: [NEEDS CLARIFICATION] inside fenced code (an example of how to mark an open point) is no open question — every other reader
  // skips fences; doctor and the gates counted it.
  {
    const fenced = "## Notes\nReviewers mark open points like this:\n\n```md\n- [NEEDS CLARIFICATION: which provider?]\n```\n\n    [NEEDS CLARIFICATION: indented example]\n";
    const p = r6proj("clar-fence");
    const c = r6feat(p, "Clar fence", ["core"], R6_HEAD + "1. **US-1.AC-1** — WHEN the password is wrong THE SYSTEM SHALL show an error\n" + R6_TAIL + "\n" + fenced);
    const clar = status(S.specDoctor(p, c.slug), "clarifications");
    ok(js(E.clarificationMarkers(fenced)) === "[]" && E.clarificationMarkers("A [NEEDS CLARIFICATION: which provider?] here").length === 1 && clar === "pass",
      "1.24 r6 F11: a [NEEDS CLARIFICATION] in fenced / indented code is no open question (doctor's clarifications pass); in prose it still is (got " + js([E.clarificationMarkers(fenced), clar]) + ")");
  }

  // 1.24 r6 FI8: beside US-n.AC-m criteria, a criterion with a modal verb and no stable ID of its own traces nothing (EARS's no-id warn
  // only) — trace_check says so too: the warning untracedCriteria (L<line>), doctor's traceability a warn. Never a gap; none for a
  // criterion with its own ID (US-n.AC-m, NFR-n …).
  {
    const p = r6proj("untraced");
    const c = r6feat(p, "Untraced", ["core"], R6_HEAD + "- US-1.AC-1 — WHEN the password is wrong THE SYSTEM SHALL show an error\n" +
      "- WHEN the account is locked THE SYSTEM SHALL email the owner\n- **NFR-1** — THE SYSTEM SHALL answer within 200 ms\n" + R6_TAIL);
    put(c.dir, "tasks.md", "# Tasks\n\n- [ ] 1. Build it\n  - _Requirements: US-1.AC-1, NFR-1_\n");
    const tr = S.traceCheck(p, c.slug);
    const w = (tr.warnings || []).find((x) => x.kind === "untracedCriteria");
    const docT = status(S.specDoctor(p, c.slug), "traceability");
    const d2 = r6feat(p, "Traced", ["core"], R6_HEAD + "- US-1.AC-1 — WHEN the password is wrong THE SYSTEM SHALL show an error\n" + R6_TAIL);
    put(d2.dir, "tasks.md", "# Tasks\n\n- [ ] 1. Build it\n  - _Requirements: US-1.AC-1_\n");
    const clean = S.traceCheck(p, d2.slug);
    ok(tr.verdict === "pass" && !!w && js(w.items) === '["L13"]' && js(tr.untracedCriteria) === '["L13"]' && docT === "warn" &&
      clean.verdict === "pass" && !("untracedCriteria" in clean) && !(clean.warnings || []).some((x) => x.kind === "untracedCriteria"),
      "1.24 r6 FI8: a modal criterion with no stable ID beside US-n.AC-m ones is the trace warning untracedCriteria (L13), doctor's traceability warns; never a gap (got " +
      js([tr.verdict, tr.warnings, tr.untracedCriteria, docT, clean.verdict, clean.warnings]) + ")");
  }

  // Inactive-marker headings, placeholders' empty brackets, test-plan entries, setext EARS, CR-only text, the matrix's speed.
  {
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

    { // 1.25.1 (12): the traceability matrix reads indexes built once — linear in rows + tasks + tests (2,800 stories: 6.4 s → ~0.5 s)
      const p = fresh("rtm-perf");
      const f = S.createFeature(p, "Big", ["tdd"], "Big", null, "en");
      const N = 2800;
      const req = ["# Requirements: Big", "", "## User Stories", ""], tasks = ["# Tasks", ""], plan = ["# Test Plan", "", "| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |", "|---|---|---|---|---|---|"];
      for (let s = 1; s <= N; s++) {
        req.push(`### US-${s} (P1): Story ${s}`, "", "#### Acceptance Criteria (EARS)");
        for (let a = 1; a <= 3; a++) req.push(`- **US-${s}.AC-${a}** — WHEN the user does action ${s}-${a} THE SYSTEM SHALL respond within 200 ms.`);
        req.push("");
        tasks.push(`- [ ] ${s}. [US${s}] Story ${s}`, `  - _Requirements: US-${s}.AC-1, US-${s}.AC-2, US-${s}.AC-3_`, `  - _Makes green: T-${s}_`);
        plan.push(`| T-${s} | unit | example | story ${s} | US-${s}.AC-1, US-${s}.AC-2, US-${s}.AC-3 | \`tests/s${s}.test.js\` |`);
      }
      put(path.join(f.dir, "requirements.md"), req.join("\n") + "\n");
      put(path.join(f.dir, "tasks.md"), tasks.join("\n") + "\n");
      put(path.join(f.dir, "test-plan.md"), plan.join("\n") + "\n");
      const time = (fn) => { const t0 = Date.now(); const r = fn(); return [Date.now() - t0, r]; };
      const measure = () => { const [t] = time(() => S.traceCheck(p, f.slug)); const [m, mx] = time(() => S.traceMatrix(p, f.slug)); return { t, m, mx }; };
      let r = measure();
      if (r.m > Math.max(1500, 4 * r.t)) r = measure(); // a timing-only miss: once more (testing.md — the machine is shared)
      const row = r.mx.rows.find((x) => x.id === "US-1400.AC-2");
      ok(r.mx.ok && r.mx.rows.length === 3 * N && r.m <= Math.max(1500, 4 * r.t) &&
        row && js(row.tests.map((x) => x.id)) === js(["T-1400"]) && js(row.tasks.map((x) => [x.number, x.cites])) === js([[1400, ["US-1400.AC-2", "T-1400"]]]) && row.status === "planned",
        "1.25.1 (12): the matrix of 2,800 stories (8,400 rows) is linear — within max(1.5 s, 4 × the plain trace) (it took ~10× the trace: every row scanned every task and test entry); a row's tests, tasks and their citations are unchanged (got " +
        js({ trace: r.t, matrix: r.m, rows: r.mx.rows.length, row: row && [row.tests, row.tasks.map((x) => [x.number, x.cites]), row.status] }) + ")");
    }
  }
};
