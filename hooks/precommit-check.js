#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — optional git pre-commit validator (zero-dependency, local, free).
 *
 * Validates the STAGED content (the git index — what will actually be committed, not the working
 * tree) of spec files before a commit:
 *   - <any>/.specs/<feature>/requirements.md  → EARS lint (errors block the commit)
 *   - <any>/.specs/<feature>/tasks.md         → traceability check (phantom refs block)
 *   - <any>/.specs/<feature>/change.md        → both (1.21 F5: a change holds its criteria and its tasks)
 * Nested `.specs/` folders (monorepos) are validated in place.
 *
 * Exit 0 = allow commit; exit 1 = block.
 * Install (PowerShell, run inside your repo; replace <PLUGIN> with this plugin's absolute path).
 * The `[ -f … ] || exit 0` guard keeps commits working if the plugin folder later moves:
 *   $hook = "$(git rev-parse --git-dir)/hooks/pre-commit"
 *   Set-Content $hook "#!/bin/sh`n[ -f `"<PLUGIN>/hooks/precommit-check.js`" ] || exit 0`nnode `"<PLUGIN>/hooks/precommit-check.js`" || exit 1"
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

// git without a shell (no injection surface); stderr ignored so "not a git repo" is just empty output.
function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 32 * 1024 * 1024 });
  } catch {
    return null;
  }
}

// Content of <path> in the index (the version being committed). null if it isn't in the index.
function stagedContent(relPath) {
  return git(["show", ":" + relPath]);
}

const root = (git(["rev-parse", "--show-toplevel"]) || process.cwd()).trim();
// NUL-separated and unquoted. With the default core.quotePath git printed "servi\303\247os/.specs/…" (in
// quotes) for any non-ASCII path, which never matched ".specs/" — accented paths were silently skipped.
const files = (git(["-c", "core.quotePath=false", "diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"]) || "")
  .split("\0")
  .filter(Boolean);

// The staged files this hook checks — a feature's requirements.md / tasks.md / change.md under a `.specs/` — found BEFORE the
// engine loads: a commit that stages none (most commits) exits without paying for it (~130 ms — 1.22 review).
const CHECKED = new Set(["requirements.md", "tasks.md", "change.md"]);
const specFiles = files.filter((f) => {
  if (!f.startsWith(".specs/") && !f.includes("/.specs/")) return false;
  if (!CHECKED.has(path.basename(f).toLowerCase())) return false;
  // Project templates are no feature's spec (dev-spec templates check) — unless .specs/templates/ is a pre-1.14 feature (.state.json).
  const tplAt = f.match(/^(.*?)\.specs\/templates\//);
  if (tplAt && !fs.existsSync(path.join(root, tplAt[1], ".specs", "templates", ".state.json"))) return false;
  // Track packs (1.15) neither (dev-spec tracks check) — unless .specs/tracks/ is a pre-1.15 feature (.state.json).
  const packAt = f.match(/^(.*?)\.specs\/tracks\//);
  return !(packAt && !fs.existsSync(path.join(root, packAt[1], ".specs", "tracks", ".state.json")));
});
if (!specFiles.length) process.exit(0);

const spec = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
const P = spec.msg(spec.projectLang(root)).precommit; // messages in the project's language
let blocking = 0;
const out = [];
let scratch = null;

for (const f of specFiles) {
  const base = path.basename(f).toLowerCase();
  const featureRel = path.posix.dirname(f); // <prefix>.specs/<feature>
  const feature = path.posix.basename(featureRel);
  // Messages in the FEATURE's language, read from its own project (nested .specs/ in monorepos).
  const featureProject = path.join(root, featureRel.slice(0, featureRel.lastIndexOf(".specs/")));
  const lang = spec.featureLang(featureProject, feature);
  const PF = spec.msg(lang).precommit;

  // (1.21 F5: a change's change.md holds its criteria AND its tasks — both checks run on it)
  if (base === "requirements.md" || base === "change.md") {
    const text = stagedContent(f);
    if (text == null) continue;
    // 1.21 review C1: a change's criteria are its change.md WITHOUT the task blocks (a task line is never linted as one)
    const r = spec.earsValidate(base === "change.md" ? spec.changeViews(text).criteria : text, lang);
    if (r.ok) {
      const errs = r.issues.filter((i) => i.severity === "error");
      if (errs.length) {
        blocking += errs.length;
        out.push(PF.earsErrors(f, errs.length));
        errs.slice(0, 5).forEach((i) => out.push(`    L${i.line} ${i.msg}`));
      } else {
        // Never "clean" while warnings or template placeholders remain (the PostToolUse hook's rule) — listed, not blocking.
        // Placeholders in the STAGED text, judged like the gates do (a removed track's criteria are inactive).
        const warns = r.issues.filter((i) => i.severity === "warn");
        const phRep = spec.featurePlaceholders(featureProject, feature, base, text);
        const ph = phRep ? phRep.items : spec.placeholderReport(text);
        if (warns.length || ph.length) {
          out.push(PF.earsWarnings(f, r.summary.criteriaDetected, warns.length, ph.length));
          warns.slice(0, 3).forEach((i) => out.push(`    L${i.line} ${i.msg}`));
        } else {
          out.push(PF.earsClean(f, r.summary.criteriaDetected));
        }
      }
    }
  }

  if (base === "tasks.md" || base === "change.md") {
    // Mirror the feature's STAGED spec files into a scratch project and trace that, so the check sees
    // exactly what is being committed (requirements/test-plan included, staged or not).
    scratch = scratch || fs.mkdtempSync(path.join(os.tmpdir(), "dev-spec-precommit-"));
    const mirror = path.join(scratch, String(files.indexOf(f)));
    const dir = path.join(mirror, ".specs", feature);
    fs.mkdirSync(dir, { recursive: true });
    for (const name of ["requirements.md", "tasks.md", "test-plan.md", "design.md", ...(base === "change.md" ? ["change.md", ".state.json"] : [])]) {
      const c = stagedContent(featureRel + "/" + name);
      if (c != null) fs.writeFileSync(path.join(dir, name), c, "utf8");
    }
    if (fs.existsSync(path.join(root, featureRel, "tests"))) fs.mkdirSync(path.join(dir, "tests"), { recursive: true }); // +tdd detection
    const tr = spec.traceCheck(mirror, feature);
    if (tr.ok) {
      // Name the IDs, not just a count — the author has to find the typo.
      const phantom = [...tr.phantomAcsInTasks, ...(tr.phantomTestsInTasks || [])];
      if (phantom.length) {
        blocking += phantom.length;
        out.push(PF.phantom(f, phantom.length, phantom.join(", ")));
      }
      if (tr.uncoveredByTasks.length) out.push(PF.uncovered(f, tr.uncoveredByTasks.length, tr.uncoveredByTasks.join(", ")));
      if (!phantom.length && !tr.uncoveredByTasks.length) out.push(PF.traceClean(f, tr.totalAcs));
    }
  }
}

if (scratch) {
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch { /* ignore */ }
}
if (out.length) {
  console.log(P.header);
  out.forEach((l) => console.log("  " + l));
}
if (blocking) {
  console.log(P.blocked(blocking));
  process.exit(1);
}
process.exit(0);
