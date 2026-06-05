#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — optional git pre-commit validator (zero-dependency, local, free).
 *
 * Validates STAGED spec files before a commit:
 *   - .specs/<feature>/requirements.md  → EARS lint (errors block the commit)
 *   - .specs/<feature>/tasks.md         → traceability check (phantom refs block)
 *
 * Exit 0 = allow commit; exit 1 = block. Run from the repo root.
 * Install (PowerShell, run inside your repo):
 *   $hook = "$(git rev-parse --git-dir)/hooks/pre-commit"
 *   Set-Content $hook "#!/bin/sh`nnode `"<PLUGIN>/hooks/precommit-check.js`" || exit 1"
 * (replace <PLUGIN> with this plugin's absolute path)
 */

const path = require("path");
const { execSync } = require("child_process");
const spec = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));

function staged() {
  try {
    // stdio: ignore stderr so "not a git repo" produces no noise — just an empty list.
    return execSync("git diff --cached --name-only", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

const projectDir = process.cwd();
const files = staged().map((f) => f.replace(/\\/g, "/"));
let blocking = 0;
const out = [];

for (const f of files) {
  if (!f.includes("/.specs/") && !f.startsWith(".specs/")) continue;
  const base = path.basename(f).toLowerCase();
  const feature = path.basename(path.dirname(f));

  if (base === "requirements.md") {
    const fs = require("fs");
    let text = "";
    try { text = fs.readFileSync(path.join(projectDir, f), "utf8"); } catch { continue; }
    const r = spec.earsValidate(text);
    if (r.ok) {
      const errs = r.issues.filter((i) => i.severity === "error");
      if (errs.length) {
        blocking += errs.length;
        out.push(`✗ ${f}: ${errs.length} EARS error(s)`);
        errs.slice(0, 5).forEach((i) => out.push(`    L${i.line} ${i.msg}`));
      } else {
        out.push(`✓ ${f}: EARS clean (${r.summary.criteriaDetected} criteria)`);
      }
    }
  }

  if (base === "tasks.md") {
    const tr = spec.traceCheck(projectDir, feature);
    if (tr.ok) {
      const phantom = tr.phantomAcsInTasks.length + (tr.phantomTestsInTasks ? tr.phantomTestsInTasks.length : 0);
      if (phantom) {
        blocking += phantom;
        out.push(`✗ ${f}: ${phantom} phantom AC/test reference(s) — likely typos`);
      }
      if (tr.uncoveredByTasks.length) out.push(`⚠ ${f}: ${tr.uncoveredByTasks.length} AC(s) not covered by a task (warning)`);
      if (tr.verdict === "pass") out.push(`✓ ${f}: traceability clean (${tr.totalAcs} ACs)`);
    }
  }
}

if (out.length) {
  console.log("dev-spec-driven pre-commit:");
  out.forEach((l) => console.log("  " + l));
}
if (blocking) {
  console.log(`\nCommit blocked: ${blocking} blocking issue(s) in staged spec files. Fix or 'git commit --no-verify' to bypass.`);
  process.exit(1);
}
process.exit(0);
