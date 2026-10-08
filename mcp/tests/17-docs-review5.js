"use strict";
// Docs — 1.23 review 5 prose guards: every list of the track markers names all nine (a list stopping at [DIST] went stale when
// +api / +ui / +obs / +data arrived), and the size-s fast-forward names the phase it really stops at with +ai (eval-plan).
// (17-docs.js holds the docs' earlier guards.)

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, S, root, tmp }) => {
  const js = JSON.stringify;
  // Every user-facing markdown file the repo ships (the CHANGELOG is history, the examples' generated specs are fixtures).
  const mdFiles = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".git" || e.name === "examples" || e.name.startsWith(".")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".md") && e.name !== "CHANGELOG.md") mdFiles.push(p);
    }
  };
  walk(root);
  const rel = (p) => path.relative(root, p).split(path.sep).join("/");
  // 1. a line listing [SaaS] … [DIST] must go on to [DATA] (the marker order: SaaS AI SEC PRIVACY DIST API UI OBS DATA)
  const stale = [];
  for (const f of mdFiles) {
    fs.readFileSync(f, "utf8").split(/\r?\n/).forEach((l, i) => {
      if (/\[SaaS\][^\n]*\[DIST\]/.test(l) && !/\[DATA\]/.test(l)) stale.push(rel(f) + ":" + (i + 1));
    });
  }
  ok(mdFiles.length > 50 && stale.length === 0,
    "1.23 review 5 (L34): every prose list of the track markers names all nine — none stops at [DIST] (" + mdFiles.length + " files; stale: " + js(stale) + ")");

  // 2. the size-s fast-forward with +ai stops at eval-plan: a paragraph naming the test-plan stop next to +ai also names eval-plan
  const ffBad = [];
  for (const f of mdFiles) {
    for (const para of fs.readFileSync(f, "utf8").split(/\r?\n\s*\r?\n/)) {
      const rows = para.split(/\r?\n(?=\|)/); // a table row is its own unit
      for (const unit of rows) {
        if (/(through: "test-plan"|\/spec-ff <feature> test-plan)/.test(unit) && /\+ai/.test(unit) && !/eval-plan/.test(unit)) ffBad.push(rel(f));
      }
    }
  }
  ok(ffBad.length === 0, "1.23 review 5 (M14): the size-s fast-forward prose names eval-plan wherever +ai sits next to its test-plan stop (got " + js(ffBad) + ")");
  // … and the engine agrees: a size-s +ai feature's fast-forward stops at eval-plan (test-plan is no phase of it)
  const p = path.join(tmp, "proj-r5-ff-ai");
  S.initProject(p, ["core"], "en");
  const c = S.createFeature(p, "Chat bot", ["core", "ai"], "Answers questions", undefined, "en", undefined, { size: "s" });
  const na = c.ok ? S.nextAction(p, c.slug) : {};
  const ff = (na && na.fastForward) || {};
  ok(c.ok && ff.through === "eval-plan" && !(ff.phases || []).includes("test-plan"),
    "1.23 review 5 (M14): next_action's fast-forward of a size-s +ai feature names eval-plan, never test-plan (got " + js(ff) + ")");
};
