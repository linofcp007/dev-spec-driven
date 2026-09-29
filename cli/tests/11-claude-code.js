"use strict";
// Claude Code integration on the CLI — the status line, the user's DEV_SPEC_* defaults, the plan-mode bridge.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, run, tmp, CLI, require, __dirname }) => {
  const S16 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = JSON.stringify;
  const OPTS = ["DEV_SPEC_DEFAULT_LANG", "CLAUDE_PLUGIN_OPTION_DEFAULT_LANG", "DEV_SPEC_STOP_CHECK", "CLAUDE_PLUGIN_OPTION_STOP_CHECK",
    "DEV_SPEC_GUARD_DEFAULT", "CLAUDE_PLUGIN_OPTION_GUARD_DEFAULT"];
  // A CLI run with stdin (closed at once when none is given), no DEV_SPEC_* default and no project folder from this process.
  const cli = (args, o = {}) => {
    const env = { ...process.env };
    for (const k of OPTS.concat(["SPEC_PROJECT_DIR", "CLAUDE_PROJECT_DIR", "COLUMNS"])) delete env[k];
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [CLI, ...args], { input: o.input == null ? "" : o.input, encoding: "utf8", env: { ...env, ...(o.env || {}) }, cwd: o.cwd || tmp, timeout: 30000 });
    return { out: r.stdout || "", err: r.stderr || "", code: r.status, ms: Date.now() - t0 };
  };
  const none = fs.mkdtempSync(path.join(os.tmpdir(), "p16c-cli-none-")); // no .specs/ at or above it
  // A core feature whose planning chain is filled — every gate through tasks passes, so no approval needs force (a forced one whose
  // gate still fails is a `fix` for next_action and the status line alike).
  const cFill = (dir, name) => {
    const w = (rel, txt) => fs.writeFileSync(path.join(dir, rel), txt);
    w("classification.md", `# Classification: ${name}\n\n## Mode\nSpec\n\n## Active Tracks\ncore\n\n## Signals\n- none, plain feature\n\n## Blast Radius\nLow; one module.\n\n## Compliance Tags\nnone\n`);
    w("requirements.md", `# Feature: ${name}\n\n## Summary\nUsers log in with email and password.\n\n## User Stories (prioritized — each independently testable)\n\n### US-1 (P1 — MVP): Log in\n` +
      "**As a** user, **I want** to log in, **so that** I see my account.\n**Why P1:** nothing works without it.\n**Independent Test:** Can be fully tested by logging in and delivers access, without the other stories.\n\n" +
      "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the user submits valid credentials THE SYSTEM SHALL open a session\n2. **US-1.AC-2** — IF the credentials are wrong THEN THE SYSTEM SHALL show an error\n\n" +
      "## Success Criteria (measurable, technology-agnostic)\n- **SC-001** — 95% of logins complete in under 2 seconds\n\n## Edge Cases & Error Handling\n- **EC-1** — Locked account: show the lock message\n\n" +
      "## Non-Functional Requirements\n- **NFR-1** — p95 latency under 300 ms\n\n## Out of Scope\n- Social login\n\n## Assumptions\n- Users already have accounts\n");
    w("design.md", `# Design: ${name}\n\n## Overview\nA form posts to /login; the server checks the hash.\n\n## Architecture\nThe web app calls the auth service.\n\n## Data Models\nUser { id, email, hash }\n\n` +
      "## API Contracts\nPOST /login returns 200 or 401.\n\n## Security Considerations\nHashes use bcrypt.\n\n## Error Handling\nWrong credentials give 401.\n\n## Testing Strategy\n- Unit tests for the handler.\n\n" +
      "## Constitution Check\n- [x] Simplicity — complies\n\n## Complexity Tracking\nNone.\n");
  };
  // A project with a feature under way: 2 of 4 tasks ticked, one of them without verification evidence.
  const sp = path.join(tmp, "p16c-status");
  S16.initProject(sp, ["core"], "en");
  cFill(S16.createFeature(sp, "Billing", ["core"], "Invoices", undefined, "en").dir, "Billing");
  fs.writeFileSync(path.join(sp, ".specs", "billing", "tasks.md"), ["# Tasks: Billing", "", "## Phase 1", "",
    "- [ ] 1. Charge the card", "  - _Requirements: US-1.AC-1_", "  - _Verify: node -e \"process.exit(0)\"_",
    "- [ ] 2. Send the invoice", "  - _Requirements: US-1.AC-2_", "  - _Verify: node -e \"process.exit(0)\"_",
    "- [ ] 3. Refund", "- [ ] 4. Report", ""].join("\n"));
  S16.approvePhase(sp, "billing", null, "t", { through: "tasks" });
  S16.completeTask(sp, "billing", 1, { command: "node -e \"process.exit(0)\"", exitCode: 0, summary: "ok" });
  S16.completeTask(sp, "billing", 2, { summary: "sent by hand" });
  const line = "◆ billing · 2/4 tasks · 1 unverified · next: task 3";
  const s1 = cli(["statusline"], { input: js({ session_id: "x", cwd: sp, workspace: { current_dir: path.join(sp, "src"), project_dir: sp }, model: { display_name: "Opus" } }) });
  const s2 = cli(["statusline", "--json"], { input: js({ cwd: path.join(sp, "a", "b") }) });
  let s2j = null;
  try { s2j = JSON.parse(s2.out); } catch { /* stays null */ }
  const s3 = cli(["statusline"], { input: js({ cwd: sp }), env: { COLUMNS: "20" } });
  ok(s1.code === 0 && s1.out === line + "\n" && s1.err === "" && s2.code === 0 && s2j && s2j.feature === "billing" && s2j.next.step === "implement" && s2j.line === line &&
    s3.code === 0 && [...s3.out.trim()].length === 20 && s3.out.trim().endsWith("…"),
    "1.16 C1: statusline reads Claude Code's session JSON (workspace.current_dir / cwd, walking up to the project) and prints one line — --json the result, cut to $COLUMNS (got " +
    js([s1.out, s1.err, s2j && s2j.line, s3.out]) + ")");
  const q = [cli(["statusline"], { input: js({ cwd: none, workspace: { current_dir: none, project_dir: none } }) }), cli(["statusline", "--bogus"], { input: "{not json", cwd: none }),
    cli(["statusline"], { input: "", cwd: none }), cli(["statusline"], { input: js([1, 2]), cwd: none }), cli(["statusline", "--project", sp], { input: "", cwd: none })];
  ok(q.slice(0, 4).every((r) => r.code === 0 && r.out === "" && r.err === "") && q[4].code === 0 && q[4].out === line + "\n",
    "1.16 C1: statusline is silent (exit 0, no output) outside a dev-spec project, on a malformed or empty stdin and an unknown flag; without a payload --project names the project (got " +
    js(q.map((r) => [r.code, r.out, r.err.slice(0, 60)])) + ")");
  // Bounded: a 50-feature project answers well within a status line's budget (a whole CLI process, node start-up included).
  const s50 = path.join(tmp, "p16c-status-50");
  S16.initProject(s50, ["core"], "en");
  S16.createFeature(s50, "Feature 0", ["core"], "x", undefined, "en");
  for (let i = 1; i < 50; i++) fs.cpSync(path.join(s50, ".specs", "feature-0"), path.join(s50, ".specs", "feature-" + i), { recursive: true });
  const r50 = cli(["statusline", "--json"], { input: js({ cwd: s50 }) });
  let r50j = null;
  try { r50j = JSON.parse(r50.out); } catch { /* stays null */ }
  ok(r50.code === 0 && r50j && r50j.features === 50 && r50.ms < 8000, "1.16 C1: statusline on a 50-feature project — one line, " + r50.ms + " ms for the whole process");
  // --print-config: the settings.json entry with this clone's absolute path; the human text in the project language.
  const pc = cli(["statusline", "--print-config", "--json", "--project", sp]);
  let pcj = null;
  try { pcj = JSON.parse(pc.out); } catch { /* stays null */ }
  const ptp = path.join(tmp, "p16c-pt");
  S16.initProject(ptp, ["core"], "pt");
  const pcPt = cli(["statusline", "--print-config", "--project", ptp]);
  const cliPath = path.resolve(CLI).replace(/\\/g, "/");
  ok(pc.code === 0 && pcj && pcj.statusLine.type === "command" && pcj.statusLine.command === `node "${cliPath}" statusline` && Object.keys(pcj).join() === "statusLine" &&
    pcPt.code === 0 && /^Status line — acrescenta isto ao ~\/\.claude\/settings\.json/.test(pcPt.out) && pcPt.out.includes(js(pcj, null, 2)) && /Experimenta: echo /.test(pcPt.out) &&
    cli(["statusline", "--print-config=maybe"]).code === 1,
    "1.16 C1: statusline --print-config prints the settings.json statusLine entry (this clone's absolute path) — --json bare, else with localized guidance; a bad switch value is refused (got " +
    js([pcj, pcPt.out.slice(0, 80)]) + ")");
  // The user's defaults through the environment: DEV_SPEC_<KEY> (a shell, or Claude Code's settings.json `env`); the
  // CLAUDE_PLUGIN_OPTION_<KEY> names mean nothing (the plugin declares no userConfig).
  const fresh = path.join(tmp, "p16c-opts");
  const io = cli(["init", "core", "--project", fresh], { env: { DEV_SPEC_DEFAULT_LANG: "es" } });
  const stopMsg = ["stop-check", "--message", "All tasks are done.", "--project", sp];
  const sc = [cli(stopMsg), cli(stopMsg, { env: { DEV_SPEC_STOP_CHECK: "off" } }), cli(stopMsg, { env: { CLAUDE_PLUGIN_OPTION_STOP_CHECK: "off" } })];
  ok(io.code === 0 && JSON.parse(fs.readFileSync(path.join(fresh, ".specs", "roadmap.json"), "utf8")).meta.lang === "es" &&
    sc[0].code === 1 && sc[1].code === 0 && /evidence gate: off/.test(sc[1].out) && sc[2].code === 1,
    "1.16 C2: DEV_SPEC_DEFAULT_LANG gives a new project its language; DEV_SPEC_STOP_CHECK=off turns the stop gate off where meta leaves it unset; CLAUDE_PLUGIN_OPTION_STOP_CHECK is ignored (got " +
    js([io.out.slice(0, 60), sc.map((r) => [r.code, r.out.slice(0, 50)])]) + ")");
  // import plan - / --text: the plan from stdin or inline (a plan outside the project).
  const planMd = ["# Plan: Dark mode", "", "## Goals", "- WHEN the user picks dark mode THE SYSTEM SHALL apply the dark palette", "", "## Steps",
    "1. Add the theme context in `src/theme.ts`", "2. Wire the toggle in `src/settings.tsx`", ""].join("\n");
  const pi = path.join(tmp, "p16c-import");
  const im = [cli(["import", "plan", "-", "--project", pi], { input: planMd }), cli(["import", "plan", "--text", planMd, "--name", "Night mode", "tdd", "--project", pi]),
    cli(["import", "kiro", "-", "--project", pi], { input: "# x" }), cli(["import", "plan", "--project", pi]), cli(["import", "plan", "-", "--project", pi], { input: "   " }),
    cli(["import", "plan", "--json", "--text", planMd, "--name", "Json mode", "--project", pi])];
  let imj = null;
  try { imj = JSON.parse(im[5].out); } catch { /* stays null */ }
  const req = (slug) => { try { return fs.readFileSync(path.join(pi, ".specs", slug, "requirements.md"), "utf8"); } catch { return ""; } };
  ok(im[0].code === 0 && /\(inline text\)/.test(im[0].out) && /^> Imported from plan \(inline text\) on /m.test(req("dark-mode")) &&
    im[1].code === 0 && JSON.parse(fs.readFileSync(path.join(pi, ".specs", "night-mode", ".state.json"), "utf8")).tracks.includes("tdd") &&
    im[2].code === 1 && /imports a single document/.test(im[2].err) && im[3].code === 1 && /usage/i.test(im[3].err) && im[4].code === 1 && /The plan text is empty/.test(im[4].err) &&
    imj && imj.ok === true && imj.inline === true && imj.source === null && imj.feature === "json-mode",
    "1.16 C4: import plan - (stdin) and --text \"…\" (+ positional tracks) import a plan's text; a folder tool with text, no path nor text, an empty text are refused; --json = the MCP result (got " +
    js(im.map((r) => [r.code, (r.out || r.err).slice(0, 70)])) + ")");
  const help16 = run(["help"]).out;
  const doc16 = fs.readFileSync(CLI, "utf8").split("*/")[0];
  ok([help16, doc16].every((t) => /statusline \[--print-config\]/.test(t) && /import <plan\|execplan\|fluidplan> - \| --text "<markdown>"/.test(t)) && S16.CLI_SWITCHES.has("print-config"),
    "1.16: help and the header docblock document statusline [--print-config] and import <plan|execplan> - | --text; print-config is one of spec.CLI_SWITCHES");
  // 1.16 C review 5: a UNC folder in the session JSON is never stat'ed (an unreachable host hung the status line for minutes) —
  // a TEST-NET address (192.0.2.1, never routed), a child process with its own timeout; silent and fast on every platform.
  const uncRuns = [js({ cwd: "\\\\192.0.2.1\\share\\proj" }), js({ workspace: { current_dir: "//192.0.2.1/share/proj", project_dir: "\\\\?\\UNC\\192.0.2.1\\share" } })].map((input) => {
    const env = { ...process.env };
    for (const k of OPTS.concat(["SPEC_PROJECT_DIR", "CLAUDE_PROJECT_DIR", "COLUMNS"])) delete env[k];
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [CLI, "statusline"], { input, encoding: "utf8", env, cwd: none, timeout: 20000 });
    return { code: r.status, out: r.stdout || "", err: r.error ? r.error.code : null, ms: Date.now() - t0 };
  });
  ok(uncRuns.every((r) => r.code === 0 && r.out === "" && !r.err && r.ms < 10000),
    "1.16 C review 5: statusline with a network cwd / workspace folder (UNC, //host, \\\\?\\UNC) prints nothing and exits at once — no SMB connection (got " + js(uncRuns) + ")");
  // 1.16 C review 8: --print-config names a project's .claude/settings.local.json (the entry holds this machine's path).
  const pcEn = cli(["statusline", "--print-config", "--project", sp]);
  ok(pcEn.code === 0 && /\.claude\/settings\.local\.json/.test(pcEn.out) && !/to a project's \.claude\/settings\.json:/.test(pcEn.out),
    "1.16 C review 8: statusline --print-config points to ~/.claude/settings.json or a project's .claude/settings.local.json, never the committed .claude/settings.json (got " + js(pcEn.out.split("\n")[0]) + ")");
  // 1.16 C review 9: `import plan <path> --text "…"` is the engine's "path or text, not both" (spec_import's), never "Unknown track".
  const pt9 = path.join(tmp, "p16c-import-both");
  fs.mkdirSync(path.join(pt9, "plans"), { recursive: true });
  fs.writeFileSync(path.join(pt9, "plans", "x.md"), planMd);
  const both = cli(["import", "plan", "plans/x.md", "--text", planMd, "--project", pt9]);
  const bothJ = cli(["import", "plan", "plans/x.md", "--text", planMd, "--json", "--project", pt9]);
  let bothJo = null;
  try { bothJo = JSON.parse(bothJ.out); } catch { /* stays null */ }
  ok(both.code === 1 && /Pass either `path` or `text`, not both/.test(both.err) && !/Unknown track/i.test(both.err + both.out) && bothJ.code === 1 && bothJo && bothJo.ok === false &&
    /not both/.test(bothJo.error) && !fs.existsSync(path.join(pt9, ".specs", "dark-mode")),
    "1.16 C review 9: import plan <path> --text is refused as spec_import {path, text} is (path or text, not both) — nothing imported (got " + js([both.code, both.err.slice(0, 80), bothJo]) + ")");
  try { fs.rmSync(none, { recursive: true, force: true }); } catch { /* best-effort */ }
};
