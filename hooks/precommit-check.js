#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — optional git pre-commit validator (zero-dependency, local, free).
 *
 * Validates the STAGED content (the git index — what will actually be committed, not the working
 * tree) of spec files before a commit:
 *   - <any>/.specs/<feature>/requirements.md  → EARS lint (errors block the commit)
 *   - <any>/.specs/<feature>/tasks.md         → traceability check (phantom refs block)
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
const spec = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));

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
const files = (git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]) || "")
  .split(/\r?\n/)
  .map((s) => s.trim().replace(/\\/g, "/"))
  .filter(Boolean);

const P = spec.msg(spec.projectLang(root)).precommit; // messages in the project's language
let blocking = 0;
const out = [];
let scratch = null;

for (const f of files) {
  if (!f.startsWith(".specs/") && !f.includes("/.specs/")) continue;
  const base = path.basename(f).toLowerCase();
  const featureRel = path.posix.dirname(f); // <prefix>.specs/<feature>
  const feature = path.posix.basename(featureRel);
  // Messages in the FEATURE's language, read from its own project (nested .specs/ in monorepos).
  const featureProject = path.join(root, featureRel.slice(0, featureRel.lastIndexOf(".specs/")));
  const lang = spec.featureLang(featureProject, feature);
  const PF = spec.msg(lang).precommit;

  if (base === "requirements.md") {
    const text = stagedContent(f);
    if (text == null) continue;
    const r = spec.earsValidate(text, lang);
    if (r.ok) {
      const errs = r.issues.filter((i) => i.severity === "error");
      if (errs.length) {
        blocking += errs.length;
        out.push(PF.earsErrors(f, errs.length));
        errs.slice(0, 5).forEach((i) => out.push(`    L${i.line} ${i.msg}`));
      } else {
        out.push(PF.earsClean(f, r.summary.criteriaDetected));
      }
    }
  }

  if (base === "tasks.md") {
    // Mirror the feature's STAGED spec files into a scratch project and trace that, so the check sees
    // exactly what is being committed (requirements/test-plan included, staged or not).
    scratch = scratch || fs.mkdtempSync(path.join(os.tmpdir(), "dev-spec-precommit-"));
    const mirror = path.join(scratch, String(files.indexOf(f)));
    const dir = path.join(mirror, ".specs", feature);
    fs.mkdirSync(dir, { recursive: true });
    for (const name of ["requirements.md", "tasks.md", "test-plan.md", "design.md"]) {
      const c = stagedContent(featureRel + "/" + name);
      if (c != null) fs.writeFileSync(path.join(dir, name), c, "utf8");
    }
    if (fs.existsSync(path.join(root, featureRel, "tests"))) fs.mkdirSync(path.join(dir, "tests"), { recursive: true }); // +tdd detection
    const tr = spec.traceCheck(mirror, feature);
    if (tr.ok) {
      const phantom = tr.phantomAcsInTasks.length + (tr.phantomTestsInTasks ? tr.phantomTestsInTasks.length : 0);
      if (phantom) {
        blocking += phantom;
        out.push(PF.phantom(f, phantom));
      }
      if (tr.uncoveredByTasks.length) out.push(PF.uncovered(f, tr.uncoveredByTasks.length));
      if (!phantom && !tr.uncoveredByTasks.length) out.push(PF.traceClean(f, tr.totalAcs));
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
