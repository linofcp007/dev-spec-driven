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
};
