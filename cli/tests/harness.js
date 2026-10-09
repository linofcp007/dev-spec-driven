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
 *   runIn(args, o)    the same call IN THIS PROCESS (1.27: cli/main.js main, no process start — ~100× cheaper), the same
 *                     { out, code }; o: env (added to run's), cwd, input (stdin, a string / Buffer — none: an empty one)
 *   spawnIn(args, o)  in-process with spawnSync's shape → { stdout, stderr, status }; o: env (the WHOLE environment, as
 *                     spawnSync's — default this process's), cwd, input — for a test that called spawnSync(node, [CLI, …])
 *                     Both are synchronous: a command that waits (done / finish --run running commands, stdin from a stream)
 *                     throws — keep run() there, and wherever the test needs a real process (exit on a signal, EPIPE, a TTY,
 *                     DEV_SPEC_BUNDLE — the facade picks the bundle at load —, a preload, the process's own timing).
 *   tmp · CLI         this process's temp dir · cli/dev-spec.js
 *   require · __dirname · __filename   cli/test-cli.js's, so the test code reads paths from cli/ —
 *                     path.join(__dirname, "..", "mcp", "lib", "spec.js") — whichever file of cli/tests/ it lives in
 *
 * A spawned assertion costs a CLI process (~0.15 s): most files call runIn, and the files run in parallel. The temp dir is
 * removed at the end, and the process exits only once stdout has flushed.
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

// In-process calls (1.27). cli/main.js main(argv, io) runs one call with captured streams and the given environment / working folder
// (it applies them to this process for the call and restores them) and settles synchronously unless the command waits.
let MAIN = null;
function spawnIn(args, o) {
  const opts = o || {};
  MAIN = MAIN || require(path.join(CLI_DIR, "main.js"));
  const out = [], err = [];
  const sink = (to) => ({ write: (chunk) => { to.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8")); return true; } });
  let status;
  MAIN.main(args.map(String), { stdout: sink(out), stderr: sink(err), stdin: opts.input == null ? "" : opts.input,
    env: opts.env || process.env, cwd: opts.cwd || process.cwd(), done: (code) => { status = code; } });
  if (status === undefined) throw new Error("runIn / spawnIn: `" + args.join(" ") + "` waits (a run, a stream) — call it with run() or spawnSync");
  return { stdout: out.join(""), stderr: err.join(""), status };
}
function runIn(args, o) {
  const opts = o || {};
  const r = spawnIn(args, { env: { ...process.env, SPEC_PROJECT_DIR: tmp, ...(opts.env || {}) }, cwd: opts.cwd, input: opts.input });
  return { out: r.stdout + r.stderr, code: r.status };
}

// The end of a run: print the total, clean up, exit once stdout has flushed.
function end() {
  console.log(`\n${pass} passed, ${fail} failed`);
  rmTmpDir(tmp);
  exitFlushed(fail ? 1 : 0);
}

// One chain (scripts/test-runner.js): the context every file of it receives.
function setup() {
  const ctx = { ok, ...assertHelpers(ok), run, runIn, spawnIn, tmp, CLI, require: createRequire(CLI_TEST), __dirname: CLI_DIR, __filename: CLI_TEST };
  return { ctx, counts: () => ({ pass, fail }), fail: (label) => ok(false, label), end };
}

module.exports = { setup };
