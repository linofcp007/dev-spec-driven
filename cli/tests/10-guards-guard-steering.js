"use strict";
// init --guard on|off (= spec_init {guard}) and custom scoped steering files (= steering_scaffold).

const fs = require("fs");
const path = require("path");

// 1.13 WP11: init --guard on|off (= spec_init {guard}) and custom scoped steering files (= steering_scaffold).
exports.run = ({ ok, run, tmp, CLI, require, __dirname }) => {
  const S11 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const g11 = path.join(tmp, "wp11-guard");
  const meta = () => JSON.parse(fs.readFileSync(path.join(g11, ".specs", "roadmap.json"), "utf8")).meta || {};
  const on = run(["init", "--guard", "on", "--project", g11]);
  let onJ = null;
  try { onJ = JSON.parse(run(["init", "tdd", "--guard=on", "--json", "--project", g11]).out); } catch { /* invalid JSON */ }
  ok(on.code === 0 && /Guard mode ON/.test(on.out) && meta().guard === true && onJ && onJ.guard === true && /Guard mode ON/.test(onJ.guardNote) && onJ.created.includes("testing-standards.md"),
    "init --guard on sets roadmap.json meta.guard (with or without tracks; --json reports guard + guardNote, like spec_init)");
  const keep = run(["init", "--project", g11]);
  const off = run(["init", "--guard", "off", "--project", g11]);
  ok(keep.code === 0 && !/Guard mode/.test(keep.out) && off.code === 0 && /Guard mode OFF/.test(off.out) && meta().guard === false,
    "init without --guard leaves the guard as it is; --guard off turns it off");
  const bad = run(["init", "--guard", "maybe", "--project", g11]);
  const none = run(["init", "--guard", "--project", g11]);
  ok(bad.code === 1 && /--guard takes on, off or scope \(got 'maybe'\)/.test(bad.out) && none.code === 1 && /missing value for --guard/.test(none.out) && meta().guard === false,
    "init --guard with a bad or missing value exits 1 and changes nothing");
  const gPt = path.join(tmp, "wp11-guard-pt");
  ok(/Modo guarda LIGADO/.test(run(["init", "--guard", "on", "--lang", "pt", "--project", gPt]).out) && S11.guardEnabled(gPt), "init --guard on (PT) is localized");
  // steering <custom>.md — the same engine call as steering_scaffold.
  const s11 = path.join(tmp, "wp11-steer");
  fs.mkdirSync(s11, { recursive: true }); // 1.23 review: --project names an existing folder (only init creates one)
  const cs = run(["steering", "api-rules.md", "--project", s11]);
  const csText = fs.readFileSync(path.join(s11, ".specs", "steering", "api-rules.md"), "utf8");
  let csJ = null;
  try { csJ = JSON.parse(run(["steering", "api-rules.md", "--json", "--project", s11]).out); } catch { /* invalid JSON */ }
  ok(cs.code === 0 && /Created .*api-rules\.md/.test(cs.out) && /^---\ninclusion: fileMatch\nfileMatchPattern: "src\/api\/\*\*"\n---\n/.test(csText) && csJ && csJ.created === false && csJ.custom === true,
    "steering <custom>.md creates a scoped stub with front matter (idempotent; --json marks it custom)");
  const nul = run(["steering", "nul.md", "--project", s11]);
  const upper = run(["steering", "Api.md", "--project", s11]);
  ok(nul.code === 1 && /reserved name/.test(nul.out) && upper.code === 1 && /Unknown steering file 'Api\.md'/.test(upper.out) && /custom scoped steering file/.test(upper.out),
    "steering with an unsafe custom name exits 1 (reserved device name / not lowercase .md)");
  const help11 = run(["help"]).out;
  ok(/--guard on\|off/.test(help11) && /custom scoped file/.test(help11) && /--guard on\|off/.test(fs.readFileSync(CLI, "utf8").split("*/")[0]),
    "help and the header docblock document init --guard on|off and custom steering files");

  // 1.21.1 languages: `init --guard on` guards a PowerShell project — the guard hook asks before a .ps1 / .psm1 edit (code) and
  // stays silent on the .psd1 manifest (data), as spec_init {guard} + the hook do on MCP.
  const { spawnSync } = require("child_process");
  const gPs = path.join(tmp, "l121-guard-pwsh");
  run(["init", "core", "--guard", "on", "--project", gPs]);
  run(["create", "Greeter", "core", "--project", gPs]);
  const guardJs = path.join(__dirname, "..", "hooks", "guard-hook.js");
  const hook = (rel) => spawnSync(process.execPath, [guardJs], { input: JSON.stringify({ session_id: "s", hook_event_name: "PreToolUse", cwd: gPs, tool_name: "Edit",
    tool_input: { file_path: path.join(gPs, ...rel.split("/")), old_string: "a", new_string: "b" } }), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" } });
  const decision = (r) => { try { return JSON.parse(r.stdout).hookSpecificOutput.permissionDecision; } catch { return r.status === 0 && r.stdout === "" ? "silent" : "?"; } };
  const psDecisions = ["scripts/deploy.ps1", "src/Greeter/Greeter.psm1", "src/Greeter/Greeter.psd1", "test/deploy.bats", "README.md"].map((f) => decision(hook(f)));
  ok(JSON.stringify(psDecisions) === '["ask","ask","silent","ask","silent"]',
    "1.21.1 languages: init --guard on — the guard hook asks before editing a .ps1 / .psm1 script or module and a .bats suite, and stays silent on the .psd1 manifest and docs (got " + JSON.stringify(psDecisions) + ")");
};
