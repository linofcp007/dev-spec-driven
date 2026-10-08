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
};
