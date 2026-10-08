"use strict";
// Exports — 1.23 review 5 regressions: the Tasks table never copies a tasks.md linked outside .specs/, the release notes' one-liners never cut an emoji.
// (14-exports.js holds the exports area's earlier tests; this file the findings of the 1.23 review 5 of spec_export / spec_changelog.)

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, S, tmp, shipFeature }) => {
  const js = JSON.stringify;
  const fresh = (n) => { const p = path.join(tmp, "proj-r5e-" + n); S.initProject(p, ["core"]); return p; };

  // L1 (read side) — every artifact the stakeholder export copies is read through readContained (a link out is skipped), but the Tasks
  // table came from statusFeature's plain read: a tasks.md linked to a file outside .specs/ put that file's checkbox lines in the
  // document. Skipped now, like the others (no tasks listed).
  {
    const p = fresh("leak");
    const c = S.createFeature(p, "Linked", ["core"]);
    const secret = path.join(tmp, "r5e-secret-tasks.md");
    fs.writeFileSync(secret, "# Tasks\n\n- [ ] 1. SECRET-TASK-333\n");
    fs.rmSync(path.join(c.dir, "tasks.md"));
    let linked = true;
    try { fs.symlinkSync(secret, path.join(c.dir, "tasks.md"), "file"); } catch { linked = false; }
    if (linked) {
      const html = S.exportSpecs(p, { name: c.slug, format: "html" });
      const md = S.exportSpecs(p, { name: c.slug, format: "md" });
      ok(html.ok && md.ok && !/SECRET/.test(html.content) && !/SECRET/.test(md.content) && /_No tasks yet\._/.test(md.content),
        "1.23 review 5 (L1): the export's Tasks table skips a tasks.md linked outside .specs/ — its lines never reach the document (got " + js([/SECRET/.test(html.content), /SECRET/.test(md.content)]) + ")");
    }
  }

  // L5 — the release notes' one-liners (a bugfix's root cause, cut near 200 characters) never end inside a surrogate pair.
  {
    const p = fresh("notes");
    const b = S.createFeature(p, "Crash fix", ["core"], "The app crashes.", undefined, undefined, "bugfix");
    const bug = path.join(b.dir, "bug.md");
    const e = String.fromCodePoint(0x1f41b);
    fs.writeFileSync(bug, fs.readFileSync(bug, "utf8").replace(/(## Root Cause[^\n]*\n)/, "$1\n" + "x".repeat(198) + e + "y".repeat(80) + "\n\n"));
    shipFeature(p, b.slug, new Date().toISOString());
    const notes = S.changelog(p, { since: "all" });
    const fixed = notes.fixed.find((f) => f.feature === b.slug);
    const lone = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
    ok(fixed && typeof fixed.rootCause === "string" && fixed.rootCause.startsWith("x".repeat(198)) && !lone.test(fixed.rootCause) && !lone.test(notes.markdown),
      "1.23 review 5 (L5): a release-notes one-liner cut near its limit drops a split emoji whole (no lone surrogate) (got " + js(fixed && fixed.rootCause && fixed.rootCause.slice(190)) + ")");
  }
};
