"use strict";
// The CLI's process I/O — a reader that closes stdout early (EPIPE), `version` / --version, per-command --help, stdin's hint.

const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

// One CLI run whose stdout reader goes away after the first chunk (`… | head -1`): → { code, signal, err, bytes }.
function closedEarly(CLI, args, env) {
  return new Promise((resolve) => {
    const c = spawn(process.execPath, [CLI, ...args], { stdio: ["ignore", "pipe", "pipe"], env });
    let err = "", bytes = 0;
    c.stderr.on("data", (d) => { err += d; });
    c.stdout.once("data", (d) => { bytes = d.length; c.stdout.destroy(); });
    c.on("close", (code, signal) => resolve({ code, signal, err, bytes }));
  });
}

exports.run = async ({ ok, run, tmp, CLI }) => {
  // 1.24 r6 B2: a stdout reader that stops early (`export --md | head -1`) ended in an unhandled 'error' (EPIPE) with a stack
  // trace and exit 1 — the CLI now ends quietly with the status the command set (as the MCP server does since 1.22).
  {
    const p = path.join(tmp, "r6b2-epipe");
    run(["init", "--project", p]);
    run(["create", "Login", "--project", p]);
    const req = path.join(p, ".specs", "login", "requirements.md");
    let s = "# Requirements: Login\n\n## User Stories\n\n### US-1 — sign in\n\n#### Acceptance Criteria\n";
    for (let i = 1; i <= 3000; i++) s += "- **US-1.AC-" + i + "** — WHEN the user signs in from device number " + i + " THE SYSTEM SHALL open a session for that device\n";
    fs.writeFileSync(req, s);
    const env = { ...process.env, SPEC_PROJECT_DIR: p };
    const full = spawnSync(process.execPath, [CLI, "export", "login", "--md", "--project", p], { encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024 });
    const exp = await closedEarly(CLI, ["export", "login", "--md", "--project", p], env);
    const csv = await closedEarly(CLI, ["trace", "login", "--csv", "--project", p], env); // gaps: exit 1, kept
    ok(full.status === 0 && full.stdout.length > 200000 && exp.bytes > 0 && exp.code === 0 && !/EPIPE|Unhandled|at .*dev-spec\.js/.test(exp.err) &&
      csv.code === 1 && !/EPIPE|Unhandled|at .*dev-spec\.js/.test(csv.err),
      "1.24 r6 B2: a reader that closes stdout early (head -1) ends the CLI quietly — export --md exits 0, trace --csv keeps its exit 1 (gaps) — never an unhandled EPIPE with a stack trace (got " +
      JSON.stringify([full.status, full.stdout.length, exp, csv].map((x) => (x && x.err ? { ...x, err: x.err.slice(0, 200) } : x))) + ")");
  }
};
