"use strict";
// Claude Code integration on the CLI — the status line, the user's DEV_SPEC_* defaults, the plan-mode bridge.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, all, run, runIn, spawnIn, tmp, CLI, require, __dirname }) => {
  const S16 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = JSON.stringify;
  const OPTS = ["DEV_SPEC_DEFAULT_LANG", "CLAUDE_PLUGIN_OPTION_DEFAULT_LANG", "DEV_SPEC_STOP_CHECK", "CLAUDE_PLUGIN_OPTION_STOP_CHECK",
    "DEV_SPEC_GUARD_DEFAULT", "CLAUDE_PLUGIN_OPTION_GUARD_DEFAULT"];
  // A CLI run with stdin (closed at once when none is given), no DEV_SPEC_* default and no project folder from this process —
  // in-process (1.27), or a process of its own with o.spawn (a time "for the whole process").
  const cli = (args, o = {}) => {
    const env = { ...process.env };
    for (const k of OPTS.concat(["SPEC_PROJECT_DIR", "CLAUDE_PROJECT_DIR", "COLUMNS"])) delete env[k];
    const t0 = Date.now();
    const opts = { input: o.input == null ? "" : o.input, encoding: "utf8", env: { ...env, ...(o.env || {}) }, cwd: o.cwd || tmp, timeout: 30000 };
    const r = o.spawn ? spawnSync(process.execPath, [CLI, ...args], opts) : spawnIn(args, opts);
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
  // 1.23 review 5 (M8): in a git worktree of the project (EnterWorktree: workspace.current_dir is the worktree, project_dir the
  // folder Claude Code started in), the line is the checkout the MCP server records in — the worktree's own copy holds no tick.
  if (spawnSync("git", ["--version"], { encoding: "utf8" }).status !== 0) ok(true, "1.23 review 5 (M8): statusline in a worktree — skipped: no git");
  else {
    const sw = path.join(tmp, "p16c-status-wt");
    fs.cpSync(sp, sw, { recursive: true });
    const g = (args) => spawnSync("git", args, { cwd: sw, encoding: "utf8" });
    g(["init", "-q"]); g(["config", "user.email", "t@example.com"]); g(["config", "user.name", "t"]);
    g(["add", "-A"]); g(["commit", "-qm", "status"]);
    const wt = path.join(sw, ".claude", "worktrees", "s1");
    g(["worktree", "add", "-q", wt, "-b", "s1"]);
    // the worktree was made from the commit: its copy of billing's state is the committed one; the main checkout's gains a tick
    S16.completeTask(sw, "billing", 3, { summary: "refunded by hand" });
    const w1 = cli(["statusline"], { input: js({ cwd: wt, workspace: { current_dir: wt, project_dir: sw } }) });
    const w2 = cli(["statusline"], { input: js({ cwd: wt, workspace: { current_dir: path.join(wt, "src") } }) }); // no project_dir: the main checkout
    ok(w1.code === 0 && /3\/4 tasks/.test(w1.out) && w2.code === 0 && /3\/4 tasks/.test(w2.out),
      "1.23 review 5 (M8): statusline in a git worktree shows the checkout the MCP server records in (workspace.project_dir, else the main checkout) — the tick made there, not the worktree's stale copy (got " +
      js([w1.out, w2.out, w1.err.slice(0, 80)]) + ")");
  }
  // Bounded: a 50-feature project answers well within a status line's budget (a whole CLI process, node start-up included).
  const s50 = path.join(tmp, "p16c-status-50");
  S16.initProject(s50, ["core"], "en");
  S16.createFeature(s50, "Feature 0", ["core"], "x", undefined, "en");
  for (let i = 1; i < 50; i++) fs.cpSync(path.join(s50, ".specs", "feature-0"), path.join(s50, ".specs", "feature-" + i), { recursive: true });
  // The bound: 8 s, or 4× the same process on the 1-feature project run just before it (the machine is shared with the parallel
  // runner — 1.20 review); a timing-only miss is measured once more.
  const measure50 = () => { const base = cli(["statusline", "--json"], { input: js({ cwd: sp }), spawn: true }).ms; return { r: cli(["statusline", "--json"], { input: js({ cwd: s50 }), spawn: true }), base }; };
  let m50 = measure50();
  if (m50.r.code === 0 && m50.r.ms >= Math.max(8000, 4 * m50.base)) m50 = measure50();
  const r50 = m50.r;
  let r50j = null;
  try { r50j = JSON.parse(r50.out); } catch { /* stays null */ }
  ok(r50.code === 0 && r50j && r50j.features === 50 && r50.ms < Math.max(8000, 4 * m50.base),
    "1.16 C1: statusline on a 50-feature project — one line, " + r50.ms + " ms for the whole process (1 feature: " + m50.base + " ms)");
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
  fs.mkdirSync(pi, { recursive: true }); // 1.23 review: --project names an existing folder (only init creates one)
  const im = [cli(["import", "plan", "-", "--project", pi], { input: planMd }), cli(["import", "plan", "--text", planMd, "--name", "Night mode", "tdd", "--project", pi]),
    cli(["import", "kiro", "-", "--project", pi], { input: "# x" }), cli(["import", "plan", "--project", pi]), cli(["import", "plan", "-", "--project", pi], { input: "   " }),
    cli(["import", "plan", "--json", "--text", planMd, "--name", "Json mode", "--project", pi])];
  let imj = null;
  try { imj = JSON.parse(im[5].out); } catch { /* stays null */ }
  const req = (slug) => { try { return fs.readFileSync(path.join(pi, ".specs", slug, "requirements.md"), "utf8"); } catch { return ""; } };
  all("1.16 C4: import plan - (stdin) and --text \"…\" (+ positional tracks) import a plan's text; a folder tool with text, no path nor text, an empty text are refused; --json = the MCP result (got " +
    js(im.map((r) => [r.code, (r.out || r.err).slice(0, 70)])) + ")", [
    () => im[0].code === 0, () => /\(inline text\)/.test(im[0].out), () => /^> Imported from plan \(inline text\) on /m.test(req("dark-mode")),
    () => im[1].code === 0, () => JSON.parse(fs.readFileSync(path.join(pi, ".specs", "night-mode", ".state.json"), "utf8")).tracks.includes("tdd"),
    () => im[2].code === 1, () => /imports a single document/.test(im[2].err), () => im[3].code === 1, () => /usage/i.test(im[3].err),
    () => im[4].code === 1, () => /The plan text is empty/.test(im[4].err), () => imj, () => imj.ok === true, () => imj.inline === true,
    () => imj.source === null, () => imj.feature === "json-mode",
  ]);
  const help16 = runIn(["help"]).out;
  // 1.27: the help IS the command table's (cli/commands.js) — the entries of statusline and import hold those lines
  const T16 = require(path.join(__dirname, "commands.js"));
  const doc16 = ["statusline", "import"].map((n) => T16.commandFor(n).help).join("\n");
  ok([help16, doc16].every((t) => /statusline \[--print-config\]/.test(t) && /import <plan\|execplan\|fluidplan> - \| --text "<markdown>"/.test(t)) && S16.CLI_SWITCHES.has("print-config"),
    "1.16: help and the command table document statusline [--print-config] and import <plan|execplan> - | --text; print-config is one of spec.CLI_SWITCHES");
  // 1.16 C review 5: a UNC folder in the session JSON is never stat'ed (an unreachable host hung the status line for minutes) —
  // a TEST-NET address (192.0.2.1, never routed), a child process with its own timeout; silent and fast on every platform.
  // "Fast" is relative (1.20 review — a flat 10 s flaked under the parallel runner: 13 s with the machine full, ~0.4 s alone):
  // each UNC run against the same status line on a folder without a project, run just before it; an SMB attempt costs 20 s
  // and more (the hang: minutes), far past 3× that + 3 s. A timing-only miss is measured once more.
  const slRun = (input) => {
    const env = { ...process.env };
    for (const k of OPTS.concat(["SPEC_PROJECT_DIR", "CLAUDE_PROJECT_DIR", "COLUMNS"])) delete env[k];
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [CLI, "statusline"], { input, encoding: "utf8", env, cwd: none, timeout: 120000 });
    return { code: r.status, out: r.stdout || "", err: r.error ? r.error.code : null, ms: Date.now() - t0 };
  };
  const uncInputs = [js({ cwd: "\\\\192.0.2.1\\share\\proj" }), js({ workspace: { current_dir: "//192.0.2.1/share/proj", project_dir: "\\\\?\\UNC\\192.0.2.1\\share" } })];
  const uncMeasure = () => uncInputs.map((input) => { const base = slRun(js({ cwd: none })).ms; return { ...slRun(input), base, bound: 3 * base + 3000 }; });
  const silent = (r) => r.code === 0 && r.out === "" && !r.err;
  let uncRuns = uncMeasure();
  if (uncRuns.every(silent) && uncRuns.some((r) => r.ms >= r.bound)) uncRuns = uncMeasure(); // a timing-only miss: measured once more
  ok(uncRuns.every((r) => silent(r) && r.ms < r.bound),
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

  // 1.25.1 (review 7): the status line outside a dev-spec project (and the bare help) never load the engine — Claude Code runs the
  // status line after every message in every folder once it is installed user-wide, and each render loaded ~36 modules first
  // (136–220 ms). cli/completion.js statusProbe (statusLineProject's null rule, without the engine) decides first; it agrees with the
  // engine on every layout; a found project still renders its line. Timed against `node -e 0` and `version` (which loads the engine).
  {
    const C = require(path.join(__dirname, "completion.js"));
    const pr = path.join(tmp, "r7-sl-proj");
    S16.initProject(pr, ["core"], "en");
    S16.createFeature(pr, "Login", ["core"], "", undefined, "en");
    fs.mkdirSync(path.join(pr, "src", "deep"), { recursive: true });
    const hand = path.join(tmp, "r7-sl-hand");
    fs.mkdirSync(path.join(hand, ".specs"), { recursive: true }); // a hand-made empty .specs/: no dev-spec project for the status line
    const layouts = [[none], [pr], [path.join(pr, "src", "deep")], [none, pr], ["", none], ["${CLAUDE_PROJECT_DIR}", pr], ["//fileserver/share/p"], [hand], [path.join(hand, ".specs")], [null, 7, none]];
    const disagree = layouts.filter((c) => C.statusProbe(c) !== (S16.statusLineProject(c) !== null));
    const pre = path.join(tmp, "r7-sl-preload.js");
    fs.writeFileSync(pre, "process.on('exit', () => { const sep = String.fromCharCode(92); const m = Object.keys(require.cache).filter((f) => f.split(sep).join('/').includes('/mcp/lib/')); process.stderr.write('LOADED ' + m.length); });");
    const envNo = { ...process.env };
    for (const k of ["SPEC_PROJECT_DIR", "CLAUDE_PROJECT_DIR", "COLUMNS"]) delete envNo[k];
    const loaded = (args, input, cwd) => spawnSync(process.execPath, ["-r", pre, CLI, ...args], { encoding: "utf8", input: input || "", cwd: cwd || none, env: envNo });
    const slNone = loaded(["statusline"], js({ cwd: none, workspace: { current_dir: none } }));
    const slProj = loaded(["statusline"], js({ cwd: pr }));
    const help = loaded(["help"]), dashHelp = loaded(["--help"]);
    const time = (args, input) => { const t0 = process.hrtime.bigint(); spawnSync(process.execPath, args, { input: input || "", cwd: none, env: envNo }); return Number(process.hrtime.bigint() - t0) / 1e6; };
    const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
    const measure = () => {
      const n0 = [], sl = [], ver = [];
      for (let i = 0; i < 5; i++) { n0.push(time(["-e", "0"])); sl.push(time([CLI, "statusline"], js({ cwd: none }))); ver.push(time([CLI, "version"])); }
      return [med(n0), med(sl), med(ver)];
    };
    let [n, s, v] = measure();
    if (!(s < v && s <= Math.max(250, 2.5 * n))) [n, s, v] = measure(); // timing-only miss: measure once more (testing.md)
    ok(!disagree.length && slNone.status === 0 && slNone.stdout === "" && /LOADED 0$/.test(slNone.stderr) &&
      slProj.status === 0 && /login/.test(slProj.stdout) && !/LOADED 0$/.test(slProj.stderr) &&
      help.status === 0 && /universal spec-driven CLI/.test(help.stdout) && /LOADED 0$/.test(help.stderr) && /LOADED 0$/.test(dashHelp.stderr) &&
      s < v && s <= Math.max(250, 2.5 * n),
      "1.25.1 r7: statusline outside a dev-spec project prints nothing without loading any mcp/lib module (statusProbe agrees with statusLineProject on " + layouts.length +
      " layouts), a project still gets its line; the bare help loads none either; statusline (no project) " + Math.round(s) + " ms vs node -e 0 " + Math.round(n) + " ms and `version` (the engine) " + Math.round(v) +
      " ms (got " + js([disagree, slNone.status, slNone.stderr.slice(-40), slProj.stdout.slice(0, 80), slProj.stderr.slice(-20), help.stderr.slice(-20), dashHelp.stderr.slice(-20)]) + ")");
  }

  // 1.25.1 (review 7): in a plugin's versioned cache folder the status line command printed `node "<…/<version>/cli/dev-spec.js>"
  // statusline` — gone at the first plugin update. It now finds the newest installed version at each run (the completion scripts'
  // rule): run through the platform's shell (cmd.exe / sh) and bash where there is one, against a fake cache whose old version is gone.
  {
    const C = require(path.join(__dirname, "completion.js"));
    const base = path.join(tmp, "r7-cache", "plugins", "cache", "mkt", "dev-spec-driven");
    for (const v of ["1.2.0", "1.9.0", "1.10.0", "notes"]) {
      const d = path.join(base, v, "cli");
      fs.mkdirSync(d, { recursive: true });
      if (v !== "notes") fs.writeFileSync(path.join(d, "dev-spec.js"), `process.stdout.write("v${v} " + process.argv.slice(2).join(" ") + " " + require("path").basename(__filename));\n`);
    }
    const cli19 = path.join(base, "1.9.0", "cli", "dev-spec.js");
    const r = C.statuslineCommand(cli19);
    fs.rmSync(path.join(base, "1.9.0"), { recursive: true, force: true }); // the version the command was printed from is removed
    const viaShell = spawnSync(r.command, { shell: true, encoding: "utf8", input: "{}", timeout: 30000 });
    const bashOk = spawnSync("bash", ["-c", "exit 0"], { encoding: "utf8" }).status === 0;
    const viaBash = bashOk ? spawnSync("bash", ["-c", r.command], { encoding: "utf8", input: "{}", timeout: 30000 }) : null;
    const plain = C.statuslineCommand(path.join(tmp, "a clone", "cli", "dev-spec.js"));
    const odd = C.statuslineCommand(path.join(tmp, "we$ird", "dev-spec-driven", "1.0.0", "cli", "dev-spec.js"));
    const L = C.STATUSLINE_LAUNCHER;
    ok(r.follows === true && !/["$`%!\\]/.test(L) && viaShell.status === 0 && viaShell.stdout === "v1.10.0 statusline dev-spec.js" &&
      (!viaBash || (viaBash.status === 0 && viaBash.stdout === "v1.10.0 statusline dev-spec.js")) &&
      plain.follows === false && /^node ".*a clone\/cli\/dev-spec\.js" statusline$/.test(plain.command) && odd.follows === false &&
      ["en", "pt", "es"].every((l) => /\/spec-setup statusline/.test(S16.msg(l).claudeCode.statusLine.config.cacheFollows)),
      "1.25.1 r7: statusline --print-config in a versioned plugin folder prints a command that runs the NEWEST installed version (1.10.0 over 1.2.0, numeric parts) even after the printed one is removed — the platform shell" +
      (viaBash ? " and bash" : " (bash: skipped)") + " alike; a clone (or a path holding $ % ! \" `) keeps the plain command (got " +
      js([r.follows, viaShell.status, viaShell.stdout, viaShell.stderr.slice(0, 200), viaBash && viaBash.stdout, plain.command]) + ")");
  }
  try { fs.rmSync(none, { recursive: true, force: true }); } catch { /* best-effort */ }
};
