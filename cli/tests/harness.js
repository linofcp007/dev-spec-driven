"use strict";

/**
 * The CLI suite's harness. cli/test-cli.js (the runner — scripts/test-runner.js) starts one child process per test file
 * (a chain, when a file needs another); the child requires this module and hands every file the same context:
 *
 *   ok(cond, label)   one assertion — "  ok   - <label>" / "  FAIL - <label>"
 *   all(label, conds) · eq(actual, expected, label)   one assertion each: all() over many conditions ({ name: cond } or
 *                     [() => cond, …] — a FAIL names the false ones), eq() a JSON deep equality (a FAIL shows the first
 *                     difference) — scripts/test-runner.js assertHelpers; prefer all() beyond ~4 conditions ·
 *                     remeasure(measure, holds): a timing-bound check's sample, measured once more on a miss
 *   run(args)         one `node cli/dev-spec.js <args>` → { out: stdout + stderr, code } — its default project is `tmp`
 *                     (SPEC_PROJECT_DIR); a file makes its own projects under it (--project path.join(tmp, "…"))
 *   tmp · CLI         this process's temp dir · cli/dev-spec.js
 *   require · __dirname · __filename   cli/test-cli.js's, so the test code reads paths from cli/ —
 *                     path.join(__dirname, "..", "mcp", "lib", "spec.js") — whichever file of cli/tests/ it lives in
 *
 * Every assertion is a CLI process (~0.15 s each): that is why the files run in parallel. The temp dir is removed at the
 * end, and the process exits only once stdout has flushed.
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createRequire } = require("module");
const { exitFlushed, rmTmpDir, isolate, assertHelpers } = require("../../scripts/test-runner.js");

// Hermetic (1.26): no SPEC_PROJECT_DIR / CLAUDE_PROJECT_DIR / DEV_SPEC_* … of the shell, and a fresh empty temp folder as the
// working folder — what the runner already gave this chain (then a no-op), and the same when this harness is loaded any other
// way. The suite runs the CLI on the engine's MODULES (1.20): a DEV_SPEC_BUNDLE the user set goes with them — the bundle's own
// file (16-conventions-bundle) sets it for the runs it compares.
isolate("cli-test-");
const CLI_DIR = path.join(__dirname, ".."); // cli/ — where cli/test-cli.js lives: the tests' __dirname
const CLI_TEST = path.join(CLI_DIR, "test-cli.js");
const CLI = path.join(CLI_DIR, "dev-spec.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   - " + m); } else { fail++; console.log("  FAIL - " + m); } };

function run(args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: tmp } });
  return { out: (r.stdout || "") + (r.stderr || ""), code: r.status };
}

// The end of a run: print the total, clean up, exit once stdout has flushed.
function end() {
  console.log(`\n${pass} passed, ${fail} failed`);
  rmTmpDir(tmp);
  exitFlushed(fail ? 1 : 0);
}

// One chain (scripts/test-runner.js): the context every file of it receives.
function setup() {
  const ctx = { ok, ...assertHelpers(ok), run, tmp, CLI, require: createRequire(CLI_TEST), __dirname: CLI_DIR, __filename: CLI_TEST };
  return { ctx, counts: () => ({ pass, fail }), fail: (label) => ok(false, label), end };
}

module.exports = { setup };
