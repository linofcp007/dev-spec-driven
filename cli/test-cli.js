#!/usr/bin/env node
"use strict";

/**
 * Smoke test for the universal CLI (cli/dev-spec.js). Exercises the subcommands against a
 * throwaway temp project and asserts on output. Run: `node cli/test-cli.js`
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CLI = path.join(__dirname, "dev-spec.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   - " + m); } else { fail++; console.log("  FAIL - " + m); } };

function run(args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: tmp } });
  return { out: (r.stdout || "") + (r.stderr || ""), code: r.status };
}

// help
ok(run(["help"]).out.includes("universal spec-driven CLI"), "help prints usage");

// classify (PT, weighted)
const c = run(["classify", "webhook de faturação multi-inquilino com resumo por LLM"]);
ok(/core \+tdd \+saas \+ai/.test(c.out), "classify (PT) → all four tracks");

// init + create
ok(run(["init", "tdd", "saas", "ai"]).out.includes("Created in"), "init scaffolds steering");
const cr = run(["create", "Invoice Summary", "tdd", "saas", "ai"]);
ok(cr.out.includes("invoice-summary") && cr.out.includes("eval-plan.md"), "create scaffolds the feature");
ok(cr.out.includes("quickstart.md") && cr.out.includes("checklist.md"), "create scaffolds quickstart.md + checklist.md (v1.5)");
const tasksTxt = fs.readFileSync(path.join(tmp, ".specs", "invoice-summary", "tasks.md"), "utf8");
ok(/\[US1\]/.test(tasksTxt) && /\[shared\]/.test(tasksTxt) && /\[P\]/.test(tasksTxt), "tasks scaffold uses [US1]/[shared] story tags + [P]");

// trilingual CLI: --lang on create (PT) and a Spanish project via --lang on init
const ptcr = run(["create", "Painel Faturas", "saas", "--lang", "pt"]);
ok(/\(pt\)/.test(ptcr.out), "create --lang pt reports the feature language");
const ptReqCli = fs.readFileSync(path.join(tmp, ".specs", "painel-faturas", "requirements.md"), "utf8");
ok(/## Histórias de Utilizador/.test(ptReqCli) && /O SISTEMA DEVE/.test(ptReqCli), "create --lang pt writes Portuguese requirements");
const esSub = path.join(tmp, "es-cli");
ok(/\[es\]/.test(run(["init", "tdd", "--lang", "es", "--project", esSub]).out), "init --lang es reports the project language");
ok(/# Estándares de Pruebas/.test(fs.readFileSync(path.join(esSub, ".specs", "steering", "testing-standards.md"), "utf8")), "init --lang es writes Spanish steering");

// doctor (fresh scaffold not ready)
const doc = run(["doctor", "Invoice Summary"]);
ok(/verdict=FAIL/.test(doc.out) && doc.out.includes("readyToAdvance=false"), "doctor flags fresh scaffold");

// list + status
ok(run(["list"]).out.includes("invoice-summary"), "list shows the feature");
ok(run(["status", "Invoice Summary"]).out.includes("core +tdd +saas +ai"), "status shows tracks");

// next / done / next
ok(/#1/.test(run(["next", "Invoice Summary"]).out), "next → task 1");
ok(run(["done", "Invoice Summary", "1"]).out.includes("Task 1 done"), "done marks task 1");
ok(/#2/.test(run(["next", "Invoice Summary"]).out), "next advances to 2");

// v1.11: brief — self-contained task brief (defaults to the next open task)
const br = run(["brief", "Invoice Summary"]);
ok(br.code === 0 && /# Task brief — invoice-summary · task 2/.test(br.out) && /## Definition of done/.test(br.out), "brief prints the next open task's brief");
const brw = run(["brief", "Invoice Summary", "2", "--write"]);
ok(/task-2-brief\.md/.test(brw.out) && fs.existsSync(path.join(tmp, ".specs", "invoice-summary", ".execution", "task-2-brief.md")), "brief --write writes .execution/task-2-brief.md");
ok(run(["brief", "Invoice Summary", "999"]).code === 1, "brief on a missing task exits non-zero");

// approve
ok(run(["approve", "Invoice Summary", "design", "--force"]).out.includes("Approved 'design'"), "approve records gate (--force: the design is still the template — 1.13 gate)");

// ears on a file
const reqFile = path.join(tmp, ".specs", "invoice-summary", "requirements.md");
ok(run(["ears", reqFile]).out.includes("criteria"), "ears lints requirements.md");

// trace
ok(run(["trace", "Invoice Summary"]).out.includes("verdict="), "trace runs");

// clarify
ok(/question/i.test(run(["clarify", "Invoice Summary"]).out), "clarify lists questions");

// roadmap + depend (+ cycle rejection) + scan + coverage
run(["create", "User Auth", "tdd"]);
ok(run(["depend", "Invoice Summary", "user-auth"]).out.includes("depends on: user-auth"), "depend declares a dependency");
ok(/Circular|circular/.test(run(["depend", "User Auth", "invoice-summary"]).out), "depend rejects a cycle");
const ordOut = run(["depend", "Invoice Summary", "--order", "3"]).out;
ok(/depends on: user-auth/.test(ordOut) && /order=3/.test(ordOut) && !/unknown deps/.test(ordOut), "depend --order N (space form) sets the order and keeps the deps");
let rmJson = null;
try { rmJson = JSON.parse(run(["roadmap", "--write", "--json"]).out); } catch { /* invalid JSON */ }
ok(rmJson && Array.isArray(rmJson.wrote) && rmJson.wrote.length === 1, "roadmap --write --json prints one valid JSON document");
ok(/overall \d+%/.test(run(["roadmap"]).out), "roadmap shows overall %");
ok(run(["backlog", "add", "sso-login", "SAML"]).out.includes("sso-login"), "backlog add records a planned feature");
ok(/wrote/.test(run(["roadmap", "--write", "--html"]).out) && fs.existsSync(path.join(tmp, ".specs", "ROADMAP.md")) && fs.existsSync(path.join(tmp, ".specs", "ROADMAP.html")), "roadmap --write generates ROADMAP.md (+ --html → ROADMAP.html)");
const sc = run(["scan"]);
ok(/files: \d+/.test(sc.out) && /top dirs:/.test(sc.out), "scan inventories the codebase");
ok(/coverage: \d+%/.test(run(["coverage"]).out), "coverage prints a percentage");

// v1.8: next-action, add-track, feature lifecycle
ok(/→/.test(run(["next-action", "Invoice Summary"]).out), "next-action prints a recommendation");
const at = run(["add-track", "user-auth", "saas"]);
ok(/\+saas/.test(at.out) && at.out.includes("load-test.md"), "add-track escalates user-auth to +saas");
ok(run(["create", "Throwaway", "core"]).out.includes("throwaway"), "create throwaway feature");
ok(run(["feature", "rename", "throwaway", "Renamed"]).out.includes("Renamed"), "feature rename");
ok(run(["feature", "archive", "renamed"]).out.includes("_archive"), "feature archive → _archive");
ok(!run(["list"]).out.includes("renamed") && !run(["list"]).out.includes("_archive"), "archived feature hidden from list");
ok(run(["feature", "remove", "user-auth", "--yes"]).out.includes("Removed"), "feature remove --yes deletes a feature"); // 1.13: needs --yes

// mcp-config
const mc = run(["mcp-config", "cursor"]);
ok(mc.out.includes("mcpServers") && mc.out.includes("server.js"), "mcp-config cursor prints a config");
const codex = run(["mcp-config", "codex"]).out;
ok(codex.includes("[mcp_servers.spec-driven]") && /args = \["[^"]+server\.js"\]/.test(codex), "mcp-config codex prints TOML with a basic-string path (safe for ')");
ok(run(["mcp-config", "all"]).out.includes("Claude Desktop"), "mcp-config all prints every client");

// v1.11 parity: steering subcommand, scriptable exit codes, --summary, CLAUDE_PROJECT_DIR
const stDir = path.join(tmp, "steer-proj");
ok(/Created .*scale\.md/.test(run(["steering", "scale.md", "--project", stDir]).out) && /Exists/.test(run(["steering", "scale.md", "--project", stDir]).out), "steering <file> scaffolds one steering file (idempotent)");
ok(run(["doctor", "Invoice Summary"]).code === 1 && run(["classify", "x"]).code === 0, "doctor exits 1 when a blocking check fails (scriptable)");
const sumOut = run(["create", "Digest", "--summary", "summarize tickets with an LLM"]).out;
ok(/\+ai/.test(sumOut), "create --summary feeds the auto-classifier (same as the MCP tool)");
const cpd = path.join(tmp, "cpd-proj");
const rc = spawnSync(process.execPath, [CLI, "init", "core"], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: "", CLAUDE_PROJECT_DIR: cpd } });
ok(rc.status === 0 && fs.existsSync(path.join(cpd, ".specs", "steering")), "the CLI honors CLAUDE_PROJECT_DIR like the MCP server");

// v1.12: done --run records evidence from the task's own _Verify:_ command; bugfix; finish; next --batch
const vp = path.join(tmp, "v112-proj");
run(["create", "Pay", "tdd", "--project", vp]);
fs.writeFileSync(path.join(vp, ".specs", "pay", "tasks.md"),
  "- [ ] 1. [US1] ok task\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 2. [US1] failing task\n  - _Verify: node -e \"process.exit(3)\"_\n" +
  "- [ ] 3. [US1][P] a\n  - _Implements: src/a.js_\n- [ ] 4. [US1][P] b\n  - _Implements: src/b.js_\n");
const d1 = run(["done", "pay", "1", "--run", "--project", vp]);
ok(d1.code === 0 && /\(verified\)/.test(d1.out) && /process\.exit\(0\)/.test(JSON.parse(fs.readFileSync(path.join(vp, ".specs", "pay", ".state.json"), "utf8")).evidence["1"].command),
  "done --run executes the _Verify:_ command and records the evidence");
const d2 = run(["done", "pay", "2", "--run", "--project", vp]);
ok(d2.code === 1 && /exit 3/.test(d2.out) && /- \[ \] 2\./.test(fs.readFileSync(path.join(vp, ".specs", "pay", "tasks.md"), "utf8")), "done --run with a failing _Verify:_ leaves the task open (exit 1)");
const dBad = run(["done", "pay", "", "--run", "--project", vp]);
ok(dBad.code === 1 && !/^\$ /m.test(dBad.out), "done with a non-integer task number fails BEFORE running any command");
run(["done", "pay", "2", "--evidence", "manual check", "--project", vp]);
ok(/parallel batch: #3 \[src\/a\.js\]\s+#4 \[src\/b\.js\]/.test(run(["next", "pay", "--batch", "--project", vp]).out), "next --batch lists the [P] tasks that can run in parallel");
const bfx = run(["bugfix", "Login Loop", "--summary", "bounce to /login", "--project", vp]);
ok(/login-loop/.test(bfx.out) && fs.existsSync(path.join(vp, ".specs", "login-loop", "bug.md")), "bugfix scaffolds the systematic-debugging flow");
const fin = run(["finish", "login-loop", "--project", vp]);
ok(fin.code === 1 && /fix\(login-loop\): bounce to \/login/.test(fin.out) && /Root Cause is not filled/.test(fin.out), "finish exits 1 while blocked and prints the merge summary from the spec");

// @wp WP1 cli-tests >>>
// 1.13 WP1: `done --run` verifies the very task it ticks; zero-padded numbers; --exit alone; --shell; localized output
const w1p = path.join(tmp, "wp1-proj");
const w1Read = (f) => fs.readFileSync(path.join(w1p, ".specs", f, "tasks.md"), "utf8");
run(["create", "Dup", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "dup", "tasks.md"),
  "- [x] 3. a\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 3. b\n  - _Verify: node -e \"process.exit(7)\"_\n");
const w1Dup = run(["done", "dup", "3", "--run", "--project", w1p]);
ok(w1Dup.code === 1 && /process\.exit\(7\)/.test(w1Dup.out) && !/process\.exit\(0\)/.test(w1Dup.out) && /- \[ \] 3\. b/.test(w1Read("dup")) &&
  JSON.parse(fs.readFileSync(path.join(w1p, ".specs", "dup", ".state.json"), "utf8")).evidence["3"].exitCode === 7,
  "done --run on a duplicated number runs the _Verify:_ of the task it would tick (exit 7 → recorded, stays open, exit 1)");
ok((process.platform === "win32") === /--shell bash/.test(w1Dup.out), "a failure under the default shell prints the --shell bash hint on Windows (only there)");
run(["create", "Pad", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "pad", "tasks.md"), "- [ ] 01. First\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 02. Second\n- [ ] 03. Third\n");
const w1P1 = run(["done", "pad", "01", "--run", "--project", w1p]);
const w1P2 = run(["done", "pad", "2", "--project", w1p]);
ok(w1P1.code === 0 && /Task 1 done \(verified\)\. 1\/3/.test(w1P1.out) && w1P2.code === 0 && /Task 2 done\. 2\/3\s+next → #3 Third/.test(w1P2.out) &&
  /- \[x\] 01\. First\n[\s\S]*- \[x\] 02\. Second/.test(w1Read("pad")), "done finds zero-padded tasks ('01' with --run, and 2 for '02.')");
const w1Exit = run(["done", "pad", "3", "--exit", "0", "--project", w1p]);
ok(w1Exit.code === 1 && /exit code alone/.test(w1Exit.out) && /- \[ \] 03\. Third/.test(w1Read("pad")), "done --exit 0 alone (no --cmd, no --evidence) is rejected and ticks nothing");
run(["create", "Sh", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "sh", "tasks.md"), "- [ ] 1. t\n  - _Verify: node -e \"process.exit(0)\"_\n");
const w1Sh = run(["done", "sh", "1", "--run", "--shell", "no-such-shell-dsd", "--project", w1p]);
ok(w1Sh.code === 1 && /no-such-shell-dsd/.test(w1Sh.out) && !/--shell bash/.test(w1Sh.out) && /- \[ \] 1\. t/.test(w1Read("sh")),
  "--shell takes a value: the run uses that shell (a missing one fails, leaves the task open, no default-shell hint)");
const realShell = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "/bin/sh";
const w1Env = spawnSync(process.execPath, [CLI, "done", "sh", "1", "--run", "--shell", realShell, "--json", "--project", w1p], { encoding: "utf8", env: { ...process.env, DEV_SPEC_SHELL: "no-such-shell-dsd" } });
const w1EnvOnly = spawnSync(process.execPath, [CLI, "done", "sh", "1", "--run", "--project", w1p], { encoding: "utf8", env: { ...process.env, DEV_SPEC_SHELL: "no-such-shell-dsd" } });
let w1Json = null;
try { w1Json = JSON.parse(w1Env.stdout); } catch { /* not one JSON document */ }
ok(w1EnvOnly.status === 1 && /no-such-shell-dsd/.test(w1EnvOnly.stdout + w1EnvOnly.stderr) && w1Env.status === 0 && w1Json && w1Json.verified === true,
  "DEV_SPEC_SHELL picks the shell, --shell beats it; with --json the run log goes to stderr and stdout stays one JSON document");
run(["create", "Tarefas", "core", "--lang", "pt", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "tarefas", "tasks.md"), "- [ ] 1. um\n- [ ] 2. dois\n");
const w1Pt = run(["done", "tarefas", "1", "--project", w1p]);
ok(/Tarefa 1 feita\. 1\/2\s+próxima → #2 dois/.test(w1Pt.out) && /tem de ser um inteiro/.test(run(["done", "tarefas", "x", "--project", w1p]).out) &&
  /já estava feita/.test(run(["done", "tarefas", "1", "--project", w1p]).out), "done output and refusals follow the feature language (PT)");
// Review fixes: the second "3." never borrows the first one's passing run; "--exit 0" without --cmd can't clear
// a recorded failure; a one-line ```code``` span doesn't hide the tasks below it.
run(["create", "Dup Two", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "dup-two", "tasks.md"),
  "- [ ] 3. a\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 3. b\n  - _Verify: node -e \"process.exit(7)\"_\n");
const w1D1 = run(["done", "dup-two", "3", "--run", "--project", w1p]);
const w1D2 = run(["done", "dup-two", "3", "--project", w1p]);
const w1DDoc = run(["doctor", "dup-two", "--project", w1p]);
ok(w1D1.code === 0 && /Task 3 done \(verified\)\. 1\/2/.test(w1D1.out) && w1D2.code === 0 && /Task 3 done\. 2\/2/.test(w1D2.out) && !/\(verified\)/.test(w1D2.out) &&
  /renumber/.test(w1D2.out) && /verification — .*#3 \(number shared with another task\)/.test(w1DDoc.out),
  "done on the second '3.' (its exit-7 _Verify:_ never ran) is not '(verified)'; doctor flags it");
run(["create", "Claim", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "claim", "tasks.md"), "- [ ] 1. docs\n- [ ] 2. x\n");
const w1C1 = run(["done", "claim", "1", "--cmd", "npm run lint", "--exit", "2", "--evidence", "lint failed", "--project", w1p]);
const w1C2 = run(["done", "claim", "1", "--evidence", "fixed it", "--exit", "0", "--project", w1p]);
ok(w1C1.code === 1 && w1C2.code === 0 && /Task 1 done\. 1\/2/.test(w1C2.out) && !/\(verified\)/.test(w1C2.out) && /latest recorded run failed \(exit 2\)/.test(w1C2.out),
  "--evidence + --exit 0 without --cmd after a failed run ticks but stays unverified (a claimed exit code is not a run)");
run(["create", "Fence", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "fence", "tasks.md"), "## Phase: Build\n- [x] 1. Wire the CLI\n  ```npm test```\n- [ ] 2. Write docs\n- [ ] 3. Release\n");
const w1FSt = run(["status", "fence", "--project", w1p]);
const w1FDone = run(["done", "fence", "2", "--project", w1p]);
ok(/phase=executing/.test(w1FSt.out) && /1\/3/.test(w1FSt.out) && w1FDone.code === 0 && /Task 2 done\. 2\/3\s+next → #3 Release/.test(w1FDone.out),
  "status/done see the tasks below a one-line ```code``` span (not a fence)");
// Round 2: renumbering a duplicated number can't hand one task's passing run to the other; a copy-paste
// duplicate (same title, other _Verify:_) can't borrow it either; an inline "<!--" hides no task line.
run(["create", "Rn", "core", "--project", w1p]);
const w1RnTasks = path.join(w1p, ".specs", "rn", "tasks.md");
fs.writeFileSync(w1RnTasks, "- [ ] 3. a\n  - _Verify: node -e \"process.exit(7)\"_\n- [ ] 3. b\n  - _Verify: node -e \"process.exit(0)\"_\n");
const w1Rn = [run(["done", "rn", "3", "--run", "--project", w1p]), run(["done", "rn", "3", "--project", w1p]), run(["done", "rn", "3", "--run", "--project", w1p])];
fs.writeFileSync(w1RnTasks, fs.readFileSync(w1RnTasks, "utf8").replace("- [x] 3. b", "- [x] 4. b"));
const w1RnDoc = run(["doctor", "rn", "--project", w1p]);
ok(w1Rn[0].code === 1 && w1Rn[2].code === 0 && /\(verified\)/.test(w1Rn[2].out) && /verification — .*#3 \(latest run failed\), #4/.test(w1RnDoc.out),
  "done --run on a duplicated number, then renumbering: #3 keeps its own failed run (never the other task's pass)");
run(["create", "Copy Dup", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "copy-dup", "tasks.md"),
  "- [ ] 3. Run the checks\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 3. Run the checks\n  - _Verify: node -e \"process.exit(7)\"_\n");
const w1Cp1 = run(["done", "copy-dup", "3", "--run", "--project", w1p]);
const w1Cp2 = run(["done", "copy-dup", "3", "--project", w1p]);
ok(/Task 3 done \(verified\)\. 1\/2/.test(w1Cp1.out) && /Task 3 done\. 2\/2/.test(w1Cp2.out) && !/\(verified\)/.test(w1Cp2.out) &&
  /verification — .*#3 \(number shared with another task\)/.test(run(["doctor", "copy-dup", "--project", w1p]).out),
  "a copy-paste duplicate (same number and title, exit-7 _Verify:_ never run) is not '(verified)'");
run(["create", "Cm", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "cm", "tasks.md"), "- [x] 1. Strip <!-- markers in the parser\n- [ ] 2. Handle the `-->` closer\n- [ ] 3. Docs\n");
const w1CmSt = run(["status", "cm", "--project", w1p]);
const w1CmDone = run(["done", "cm", "2", "--project", w1p]);
ok(/Tasks: 1\/3\s+next → #2/.test(w1CmSt.out) && w1CmDone.code === 0 && /Task 2 done\. 2\/3\s+next → #3 Docs/.test(w1CmDone.out),
  "an inline '<!--' in a task's text hides no task below it (status and done agree)");
// @wp WP1 <<<

// @wp WP2 cli-tests >>>
{ // 1.13 WP2 — track input, add-track --remove, status marks (own block scope)
  const w2 = path.join(tmp, "wp2-proj");
  run(["init", "core", "--project", w2]);
  const typo = run(["create", "Typo", "tdd,sass", "--project", w2]);
  const typoInit = run(["init", "ia", "--project", w2]);
  ok(typo.code === 1 && /did you mean 'saas'/.test(typo.out) && !fs.existsSync(path.join(w2, ".specs", "typo")) && typoInit.code === 1 && /did you mean 'ai'/.test(typoInit.out),
    "create/init with an unknown track exit 1 with a did-you-mean (nothing scaffolded)");
  const multi = run(["create", "Checkout", "+tdd", "+saas", "--project", w2]);
  ok(multi.code === 0 && /\[core \+tdd \+saas\]/.test(multi.out), "create accepts '+tdd +saas' style tracks");
  const st = run(["status", "checkout", "--project", w2]).out;
  ok(/phase=requirements/.test(st) && /◐ Performance Budget \(unfilled\)/.test(st) && !/✓/.test(st.split("Scale sections:")[1] || "✓"),
    "status: a fresh scaffold is in 'requirements' and its scale sections read ◐ (unfilled), never ✓");
  const des = path.join(w2, ".specs", "checkout", "design.md");
  fs.writeFileSync(des, fs.readFileSync(des, "utf8").replace(/(## \[SaaS\] Performance Budget\n)> \*\*TODO\*\*[^\n]*\n/, "$1P95 < 200 ms.\n"));
  ok(/✓ Performance Budget · ◐ Scale Design \(unfilled\)/.test(run(["status", "checkout", "--project", w2]).out), "status prints ✓ only for the filled section (same rule as doctor)");
  const addBoth = run(["add-track", "checkout", "ai", "--project", w2]);
  const rm = run(["add-track", "checkout", "saas", "--remove", "--project", w2]);
  const rmCore = run(["add-track", "checkout", "core", "--remove", "--project", w2]);
  ok(addBoth.code === 0 && /\[core \+tdd \+saas \+ai\]/.test(addBoth.out) && rm.code === 0 && /now \[core \+tdd \+ai\]/.test(rm.out) && /load-test\.md/.test(rm.out) &&
    fs.existsSync(path.join(w2, ".specs", "checkout", "load-test.md")) && rmCore.code === 1,
    "add-track --remove turns a track off (files kept, listed); 'core' can't be removed");
  ok(/add-track <feature> <track\.\.\.>/.test(run(["help"]).out) && /--remove/.test(run(["help"]).out), "help documents add-track --remove");
  // the marks' words and the removal note follow the feature language (PT)
  const ptp = path.join(tmp, "wp2-pt");
  run(["init", "core", "--lang", "pt", "--project", ptp]);
  run(["create", "Relatórios", "saas", "--project", ptp]);
  const ptSt = run(["status", "relatorios", "--project", ptp]).out;
  const ptRm = run(["add-track", "relatorios", "saas", "--remove", "--project", ptp]);
  ok(/◐ Orçamento de Desempenho \(por preencher\)/.test(ptSt) && !/✓/.test(ptSt.split("Scale sections:")[1] || "✓") && ptRm.code === 0 && /Tracks desativados: \+saas/.test(ptRm.out),
    "status (◐ … (por preencher)) and add-track --remove speak the feature language (PT)");
  // a bugfix given an extra track gets it on the first run, same as on a re-run
  const bug1 = run(["bugfix", "Login crash", "saas", "--project", w2]).out;
  const bug2 = run(["bugfix", "Login crash", "saas", "--project", w2]).out;
  ok(/\[core \+tdd \+saas\]/.test(bug1) && /\[core \+tdd \+saas\]/.test(bug2) && !/already existed/.test(bug2), "bugfix with a track gives the same track set on both runs");
  // `brief` (default: next open) agrees with `next` once a removed track's task block is all that's left open
  run(["create", "Chat", "ai", "--project", w2]);
  const chatTasks = path.join(w2, ".specs", "chat", "tasks.md");
  const chatRaw = fs.readFileSync(chatTasks, "utf8");
  const aiBlock = chatRaw.split("## Story US-1 — AI")[1].split(/\n## /)[0];
  const aiNums = [...aiBlock.matchAll(/- \[ \] (\d+)\./g)].map((m) => +m[1]);
  fs.writeFileSync(chatTasks, chatRaw.replace(/- \[ \] (\d+)\./g, (m, n) => (aiNums.includes(+n) ? m : `- [x] ${n}.`)));
  run(["add-track", "chat", "ai", "--remove", "--project", w2]);
  const chatBrief = run(["brief", "chat", "--project", w2]);
  const chatBriefN = run(["brief", "chat", String(aiNums[0]), "--project", w2]);
  ok(aiNums.length > 0 && /All tasks done/.test(run(["next", "chat", "--project", w2]).out) && chatBrief.code === 0 && /All tasks are done — nothing to brief\./.test(chatBrief.out) &&
    chatBriefN.code === 0 && new RegExp("task " + aiNums[0]).test(chatBriefN.out),
    "after add-track --remove, `brief` (no number) says all done like `next`; `brief <n>` still reaches the inactive task");
}
// @wp WP2 <<<

// @wp WP3 cli-tests >>>
{ // 1.13 WP3: depend parity with the MCP tool, one default approver, own-key lookups
  const dp = path.join(tmp, "wp3-dep");
  ["a", "b", "c"].forEach((n) => run(["create", n, "core", "--project", dp]));
  const depsOfA = () => { try { return JSON.parse(fs.readFileSync(path.join(dp, ".specs", "roadmap.json"), "utf8")).features.a.dependsOn.join(); } catch { return null; } };
  ok(run(["depend", "a", "b", "c", "--project", dp]).code === 0 && depsOfA() === "b,c", "depend a b c replaces the list");
  const show = run(["depend", "a", "--project", dp]);
  ok(show.code === 0 && /depends on: b, c/.test(show.out) && depsOfA() === "b,c", "a bare `depend <f>` shows the deps and no longer clears them");
  ok(run(["depend", "a", "--rm", "b", "--project", dp]).code === 0 && depsOfA() === "c", "depend --rm removes one dependency");
  ok(run(["depend", "a", "--add", "b", "--project", dp]).code === 0 && depsOfA() === "c,b", "depend --add appends one");
  const unk = run(["depend", "a", "--add", "nope,steering", "--project", dp]);
  ok(unk.code === 1 && /not found: nope, steering/.test(unk.out) && depsOfA() === "c,b", "depend with unknown/reserved features exits 1, names them and stores nothing");
  ok(run(["depend", "a", "--order", "x", "--project", dp]).code === 1 && run(["depend", "a", "--project", dp, "--add"]).code === 1,
    "depend --order x (not an integer) and --add without a value exit 1");
  ok(run(["depend", "a", "--clear", "--project", dp]).code === 0 && depsOfA() === "", "depend --clear empties the list explicitly");
  // A repeated flag used to keep only its last value (`--add b --add c` added c alone, exit 0).
  const rep = run(["depend", "a", "--add", "b", "--add=c", "--project", dp]);
  ok(rep.code === 0 && /depends on: b, c/.test(rep.out) && depsOfA() === "b,c", "depend --add b --add=c adds both (every occurrence counts)");
  run(["depend", "a", "b", "c", "--project", dp]);
  ok(depsOfA() === "b,c" && run(["depend", "a", "--rm", "b", "--rm", "c", "--project", dp]).code === 0 && depsOfA() === "", "depend --rm b --rm c removes both");
  ok(run(["depend", "a", "--add", "b", "--project", dp, "--add"]).code === 1 && depsOfA() === "", "a repeated --add with a missing value exits 1 and changes nothing");
  ok(/--add x,y/.test(run(["help"]).out), "help documents depend --add/--rm/--clear");
  const ap = spawnSync(process.execPath, [CLI, "approve", "a", "requirements", "--force", "--project", dp], { encoding: "utf8", env: { ...process.env, USER: "wp3-tester", USERNAME: "wp3-tester" } }); // templates: 1.13 gate
  run(["approve", "a", "design", "--by", "carol", "--force", "--project", dp]);
  const appr = JSON.parse(fs.readFileSync(path.join(dp, ".specs", "a", ".state.json"), "utf8")).approvals;
  ok(ap.status === 0 && appr.requirements.by === "wp3-tester" && appr.design.by === "carol", "approve without --by records the engine default ($USER/$USERNAME, same as MCP); --by still wins");
  const st = run(["steering", "constructor", "--project", dp]);
  const mc = run(["mcp-config", "constructor"]);
  ok(st.code === 1 && /Unknown steering file/.test(st.out) && !/TypeError|ERR_INVALID/.test(st.out) && mc.code === 1 && /unknown client/.test(mc.out),
    "steering constructor / mcp-config constructor → the normal 'unknown' errors (own-key lookups)");
}
// @wp WP3 <<<

// @wp WP4 cli-tests >>>
// 1.13 WP4: CLI ↔ MCP parity, every trace gap listed, confirmations, rules, help, localized output.
const S4 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
const runIn = (args, input) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", input, env: { ...process.env, SPEC_PROJECT_DIR: tmp } });
  return { out: (r.stdout || "") + (r.stderr || ""), code: r.status };
};
const w4 = path.join(tmp, "wp4-proj");
run(["init", "tdd", "--project", w4]);
run(["create", "Gaps", "tdd", "--project", w4]);
const w4f = path.join(w4, ".specs", "gaps");

// finish --include-body → spec_finish {includeBody}: --write --json can now return the merge summary.
let finJ = null;
try { finJ = JSON.parse(run(["finish", "gaps", "--write", "--include-body", "--json", "--project", w4]).out); } catch { /* invalid JSON */ }
ok(finJ && finJ.wrote === true && /## Summary/.test(finJ.mergeSummary) && fs.existsSync(path.join(w4f, ".execution", "merge-summary.md")),
  "finish --write --include-body --json returns the merge summary and writes the file");

// classify --name → spec_classify {name}: a value flag, not a boolean with the name glued onto the description.
let clsJ = null;
try { clsJ = JSON.parse(run(["classify", "page without", "--name", "LLM summaries", "--json"]).out); } catch { /* invalid JSON */ }
ok(clsJ && JSON.stringify(clsJ) === JSON.stringify(S4.classify("page without", { name: "LLM summaries" })) && clsJ.tracks.includes("ai") &&
  !S4.classify("page without LLM summaries").tracks.includes("ai"), "classify --name matches spec_classify {description, name} exactly (not glued text)");

// ears --text / ears - (stdin) → ears_validate {text}; ears <feature> is unchanged.
const earsOk = run(["ears", "--text", "1. **US-1.AC-1** — WHEN x THE SYSTEM SHALL y"]);
const earsBad = runIn(["ears", "-"], "1. The response should be fast\n");
ok(earsOk.code === 0 && /1 criteria, 1 with modal, verdict=pass/.test(earsOk.out) && earsBad.code === 1 && /verdict=fail/.test(earsBad.out) && /Vague term 'fast'/.test(earsBad.out),
  "ears --text lints raw text and ears - lints stdin (exit 1 on errors)");
ok(/criteria/.test(run(["ears", "gaps", "--project", w4]).out) && run(["ears", "--text", "", "--project", w4]).code === 1, "ears <feature> still lints the feature; empty --text is an error");

// trace lists EVERY gap kind with its IDs (phantom T-IDs and unmapped tests used to be dropped).
fs.writeFileSync(path.join(w4f, "requirements.md"), "## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n2. **US-1.AC-2** — WHEN c THE SYSTEM SHALL d\n");
fs.writeFileSync(path.join(w4f, "test-plan.md"), "| Test ID | Covers |\n|---|---|\n| T-01 | US-1.AC-1 |\n| T-02 | US-1.AC-2 |\n");
fs.writeFileSync(path.join(w4f, "tasks.md"), "- [x] 1. a\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-3.AC-1_\n  - _Makes green: T-01, T-99_\n  - _Implements: src/nope.js_\n"); // ticked: 1.13 plannedImplFiles
const tr4 = run(["trace", "gaps", "--project", w4]);
ok(tr4.code === 1 && /verdict=gaps-found/.test(tr4.out) && /unknown ACs \(typos\?\): US-3\.AC-1/.test(tr4.out) && /unknown tests \(typos\?\): T-99/.test(tr4.out) &&
  /planned tests that no task makes green: T-02/.test(tr4.out) && /_Implements:_ files that don't exist: src\/nope\.js/.test(tr4.out), "trace prints every gap kind with its IDs");

// roadmap: a failed write (hand-written ROADMAP.md) → exit 1 + the reason, same result as spec_roadmap.
fs.writeFileSync(path.join(w4, ".specs", "ROADMAP.md"), "# Mine\n");
const rmw = run(["roadmap", "--write", "--project", w4]);
let rmwJ = null;
try { rmwJ = JSON.parse(run(["roadmap", "--write", "--json", "--project", w4]).out); } catch { /* invalid JSON */ }
ok(rmw.code === 1 && /not generated by dev-spec/.test(rmw.out) && rmwJ && rmwJ.ok === false && rmwJ.wrote.length === 0 && rmwJ.errors.length === 1 &&
  fs.readFileSync(path.join(w4, ".specs", "ROADMAP.md"), "utf8") === "# Mine\n", "roadmap --write with a hand-written ROADMAP.md: untouched, exit 1, ok:false in --json");

// Value flags never swallow the next flag.
const mv = run(["depend", "gaps", "--order", "--json", "--project", w4]);
ok(mv.code === 1 && /missing value for --order/.test(mv.out) && run(["depend", "gaps", "--order", "--project", w4]).code === 1 &&
  /order=2/.test(run(["depend", "gaps", "--order=2", "--project", w4]).out), "a value flag followed by another flag (or nothing) is 'missing value'; --flag=value still works");

// backlog rm of a name that isn't there → exit 1.
run(["backlog", "add", "sso", "--project", w4]);
const blm = run(["backlog", "rm", "nope", "--project", w4]);
ok(blm.code === 1 && /'nope' is not in the backlog \(backlog: sso\)/.test(blm.out) && /removed from the backlog/.test(run(["backlog", "rm", "SSO", "--project", w4]).out),
  "backlog rm <unknown> exits 1 with the backlog listed; a listed name is removed");

// feature remove without --yes shows what would be deleted and exits 1; --yes deletes.
run(["create", "Doomed", "core", "--project", w4]);
const frm = run(["feature", "remove", "doomed", "--project", w4]);
let frmJ = null;
try { frmJ = JSON.parse(run(["feature", "remove", "doomed", "--json", "--project", w4]).out); } catch { /* invalid JSON */ }
ok(frm.code === 1 && /Would permanently delete 'doomed'/.test(frm.out) && /requirements\.md/.test(frm.out) && /--yes/.test(frm.out) &&
  frmJ && frmJ.needsConfirm === true && fs.existsSync(path.join(w4, ".specs", "doomed")), "feature remove without --yes deletes nothing, lists what it would delete, exits 1");
const fry = run(["feature", "remove", "doomed", "--yes", "--project", w4]);
ok(fry.code === 0 && /Removed 'doomed'/.test(fry.out) && !fs.existsSync(path.join(w4, ".specs", "doomed")), "feature remove --yes deletes it");
// A broken roadmap.json: the preview reports the roadmap error instead of promising a delete --yes can't do.
const w4bad = path.join(w4, "bad-roadmap");
fs.mkdirSync(w4bad, { recursive: true });
run(["init", "--project", w4bad]);
run(["create", "Delta", "core", "--project", w4bad]);
fs.writeFileSync(path.join(w4bad, ".specs", "roadmap.json"), "{broken");
const frb = run(["feature", "remove", "delta", "--project", w4bad]);
ok(frb.code === 1 && /roadmap\.json/.test(frb.out) && !/Would permanently delete/.test(frb.out) && !/--yes/.test(frb.out) &&
  fs.existsSync(path.join(w4bad, ".specs", "delta")), "feature remove preview with a broken roadmap.json exits 1 with the roadmap error, no delete promise");

// rules <tool>: the rule file with this clone's absolute paths (nothing relative left to break when pasted).
const ROOT4 = path.resolve(__dirname, "..").replace(/\\/g, "/");
const rulesOut = ["cursor", "windsurf", "copilot", "gemini", "agents"].map((t) => ({ t, r: run(["rules", t]) }));
ok(rulesOut.every(({ r }) => r.code === 0 && r.out.includes(ROOT4 + "/") && !/(?<![\w./-])(?:\.\.\/)*(?:cli\/dev-spec\.js|mcp\/server\.js|AGENTS\.md|skills\/dev-spec-driven)/.test(r.out)),
  "rules <cursor|windsurf|copilot|gemini|agents> prints each rule file with absolute paths only");
const rc4 = rulesOut[0].r.out;
ok(rc4.includes('node "' + ROOT4 + '/cli/dev-spec.js"') && rc4.includes(ROOT4 + "/AGENTS.md") && !rc4.includes("../../") && /alwaysApply: true/.test(rc4) &&
  rulesOut[4].r.out.includes(ROOT4 + "/skills/dev-spec-driven/references/classification-matrix.md"), "rules: quoted node command, absolute AGENTS.md link, skill references resolved");
const rbad = run(["rules", "vim"]);
ok(rbad.code === 1 && /cursor, windsurf, copilot, gemini, agents/.test(rbad.out), "rules <unknown> exits 1 and lists the valid tools");

// help lists every subcommand and flag.
const help4 = run(["help"]).out;
ok(["finish", "steering", "bugfix", "clarify", "roadmap", "depend", "backlog", "scan", "coverage", "rules <tool>", "generic", "--max", "--kind", "--include-body", "--text", "--yes", "--name"]
  .every((w) => help4.includes(w)) && help4.indexOf("rules <tool>") > help4.indexOf("mcp-config [client]"), "help lists every subcommand and flag (rules right after mcp-config)");
const doc4 = fs.readFileSync(CLI, "utf8").split("*/")[0];
ok(["finish", "steering", "bugfix", "clarify", "roadmap", "depend", "backlog", "scan", "coverage", "rules", "generic", "--max", "--kind", "--include-body", "--text", "--yes"]
  .every((w) => doc4.includes(w)), "the header docblock lists every subcommand and flag too");

// Localized human output — PT project (feature commands: feature language; project commands: project language).
const pt4 = path.join(tmp, "wp4-pt");
ok(/Criado em .*\[pt\]/.test(run(["init", "tdd", "--lang", "pt", "--project", pt4]).out), "init (PT) output is localized");
ok(/Feature 'pagamentos' \[core \+tdd\] \(pt\)/.test(run(["create", "Pagamentos", "tdd", "--project", pt4]).out), "create (PT) output");
const ptList = run(["list", "--project", pt4]).out;
let ptListJ = null;
try { ptListJ = JSON.parse(run(["list", "--json", "--project", pt4]).out); } catch { /* invalid JSON */ }
ok(/requisitos\s+\(0\/\d+ tarefas\)/.test(ptList) && ptListJ && ptListJ.features[0].phase === "requirements", "list (PT): localized phase + 'tarefas'; --json keeps the English phase token");
ok(/fase: requisitos/.test(run(["status", "pagamentos", "--project", pt4]).out) && /Diagnóstico: pagamentos .*veredicto=FALHA\s+pronta para avançar: não/.test(run(["doctor", "pagamentos", "--project", pt4]).out),
  "status/doctor (PT) wrappers are localized");
ok(/Fase 'requirements' de pagamentos aprovada ✓/.test(run(["approve", "pagamentos", "requirements", "--force", "--project", pt4]).out) &&
  /Clarificar: pagamentos .*pergunta\(s\)/.test(run(["clarify", "pagamentos", "--project", pt4]).out) && /Próxima → #1/.test(run(["next", "pagamentos", "--project", pt4]).out),
  "approve/clarify/next (PT) are localized");
ok(/adicionada ao backlog/.test(run(["backlog", "add", "sso", "--project", pt4]).out) && /não está no backlog/.test(run(["backlog", "rm", "x", "--project", pt4]).out) &&
  /Roadmap — progresso global/.test(run(["roadmap", "--project", pt4]).out) && /falta o valor de --order/.test(run(["depend", "pagamentos", "--order", "--project", pt4]).out),
  "backlog/roadmap/parse errors (PT) are localized");
ok(/Nada foi apagado/.test(run(["feature", "remove", "pagamentos", "--project", pt4]).out) && /Rastreabilidade: pagamentos/.test(run(["trace", "pagamentos", "--project", pt4]).out) &&
  /Criado .*scale\.md/.test(run(["steering", "scale.md", "--project", pt4]).out) && /Cobertura de specs/.test(run(["coverage", "--project", pt4]).out),
  "feature remove preview / trace / steering / coverage (PT) are localized");

// … and an ES project.
const es4 = path.join(tmp, "wp4-es");
run(["init", "core", "--lang", "es", "--project", es4]);
ok(/Función 'pagos' \[core\] \(es\)/.test(run(["create", "Pagos", "core", "--project", es4]).out) && /\(0\/\d+ tareas\)/.test(run(["list", "--project", es4]).out) &&
  /Aprobada|aprobada/.test(run(["approve", "pagos", "design", "--force", "--project", es4]).out), "create/list/approve (ES) are localized");
ok(/Aclarar: pagos/.test(run(["clarify", "pagos", "--project", es4]).out) && /No se ha eliminado nada/.test(run(["feature", "remove", "pagos", "--project", es4]).out) &&
  /falta el valor de --text/.test(run(["ears", "--text", "--project", es4]).out) && /herramienta desconocida/.test(run(["rules", "vim", "--project", es4]).out) &&
  /'pagos' renombrada → 'cobros'/.test(run(["feature", "rename", "pagos", "Cobros", "--project", es4]).out), "clarify/remove preview/errors/rename (ES) are localized");
ok(/confianza: tdd=/.test(run(["classify", "página de pagos con suscripciones para el usuario"]).out) && /confiança: /.test(run(["classify", "página de pagamentos para o utilizador"]).out),
  "classify labels follow the language of the reasoning (ES/PT)");

// Review fixes: a value that merely starts with dashes is still a value (`---` front matter, "-- draft").
const fm = "---\ntitle: x\n---\n1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b";
const fmCli = run(["ears", "--text", fm]);
ok(fmCli.code === 0 && /1 criteria, 1 with modal, verdict=pass/.test(fmCli.out) && JSON.stringify(JSON.parse(run(["ears", "--text", fm, "--json"]).out)) === JSON.stringify(S4.earsValidate(fm, "en")),
  "ears --text '---…' is a value (front matter/HR), same result as ears_validate {text}");
const dashSum = run(["create", "Dashy", "core", "--summary", "-- draft", "--project", w4]);
ok(dashSum.code === 0 && /'dashy'/.test(dashSum.out) && run(["depend", "gaps", "--order", "--lang", "en", "--project", w4]).code === 1,
  "--summary '-- draft' is a value; '--order --lang …' is still a missing value");
// rules: prototype keys are unknown tools (localized error), never a raw TypeError.
const rproto = ["constructor", "__proto__", "toString"].map((t) => run(["rules", t]));
ok(rproto.every((r) => r.code === 1 && /unknown tool '/.test(r.out) && /cursor, windsurf, copilot, gemini, agents/.test(r.out) && !/argument must be/.test(r.out)),
  "rules constructor/__proto__/toString → 'unknown tool', not a Node TypeError");
// Every flag the CLI reads is documented (docblock + help), aliases included.
const flagsRead = [...new Set([...fs.readFileSync(CLI, "utf8").matchAll(/\bflags(?:\.([a-z]+)|\["([a-z-]+)"\])/g)].map((m) => "--" + (m[1] || m[2])))]
  .filter((x) => x !== "--json" && x !== "--project");
ok(flagsRead.length >= 15 && flagsRead.every((x) => doc4.includes(x)) && ["--by", "--include-brief", "--run", "--evidence", "--exit", "--cmd", "--md"].every((x) => doc4.includes(x)),
  "the header docblock lists every flag the CLI reads (missing: " + flagsRead.filter((x) => !doc4.includes(x)).join(",") + ")");
ok(flagsRead.filter((x) => !["--run", "--evidence", "--exit", "--cmd"].includes(x)).every((x) => help4.includes(x)) && /--md/.test(help4) && /alias: na/.test(help4),
  "help mentions every flag it owns plus the --md and na aliases");
// @wp WP4 <<<

// @wp WP5 cli-tests >>>
{ // 1.13 WP5 — gates on the CLI: approve (refused / --force / nothing to approve), next-action order, bugfix gate, planned files
  const w5 = path.join(tmp, "wp5-proj");
  run(["init", "core", "--project", w5]);
  run(["create", "Gate", "core", "--project", w5]);
  const stateOf = (f) => JSON.parse(fs.readFileSync(path.join(w5, ".specs", f, ".state.json"), "utf8"));
  const refused = run(["approve", "gate", "requirements", "--project", w5]);
  ok(refused.code === 1 && /Can't approve 'requirements' for 'gate' — failing checks: placeholders, success-criteria, priorities/.test(refused.out) &&
    /✗ placeholders — requirements\.md \(\d+\): requirements\.md:4 /.test(refused.out) && /--force/.test(refused.out) && !stateOf("gate").approvals.requirements,
    "approve on a template exits 1 listing the failing checks (nothing recorded)");
  const forced = run(["approve", "gate", "requirements", "--force", "--project", w5]);
  let forcedJ = null;
  try { forcedJ = JSON.parse(run(["approve", "gate", "design", "--force", "--json", "--project", w5]).out); } catch { /* invalid JSON */ }
  ok(forced.code === 0 && /Approved 'requirements' for gate ✓/.test(forced.out) && /⚠ Approved with force — the failing checks are recorded with the approval: placeholders, success-criteria, priorities\./.test(forced.out) &&
    stateOf("gate").approvals.requirements.forced === true && forcedJ && forcedJ.forced === true && forcedJ.failing.includes("placeholders"),
    "approve --force records a flagged approval (⚠ note; --json forced + failing)");
  const nothing = run(["approve", "gate", "eval-plan", "--force", "--project", w5]);
  ok(nothing.code === 1 && /Nothing to approve: 'eval-plan'/.test(nothing.out), "approve of a phase with no artifact exits 1 even with --force");
  const docG = run(["doctor", "gate", "--project", w5]);
  ok(/✗ placeholders — template placeholders left/.test(docG.out) && /▲ approval-gates — .*approved with force over failing checks: requirements \(placeholders/.test(docG.out),
    "doctor lists the placeholders failure and the forced approval (warn)");
  ok(/→ Fill requirements\.md — \d+ template placeholder\(s\) left .*\/clarify gate/.test(run(["next-action", "gate", "--project", w5]).out), "next-action on a fresh feature: fill requirements.md first");
  ok(/approve <feature> <phase> \[--force\]/.test(run(["help"]).out) && /--by NAME \/ --force \(approve\)/.test(run(["help"]).out), "help documents approve --force");

  // PT: refusal, forced note and next-action are localized
  const p5 = path.join(tmp, "wp5-pt");
  run(["init", "core", "--lang", "pt", "--project", p5]);
  run(["create", "Pagamentos", "core", "--project", p5]);
  const ptRef = run(["approve", "pagamentos", "requirements", "--project", p5]);
  const ptForce = run(["approve", "pagamentos", "requirements", "--force", "--project", p5]);
  ok(ptRef.code === 1 && /Não é possível aprovar 'requirements' de 'pagamentos' — verificações a falhar: placeholders/.test(ptRef.out) &&
    ptForce.code === 0 && /Fase 'requirements' de pagamentos aprovada ✓/.test(ptForce.out) && /⚠ Aprovado com force — as verificações a falhar ficam registadas/.test(ptForce.out) &&
    /→ Preenche requirements\.md — \d+ placeholder\(s\) do template por preencher/.test(run(["next-action", "pagamentos", "--project", p5]).out),
    "approve refusal / --force note / next-action speak the feature language (PT)");

  // bugfix: no fix before the root cause is written; an OPEN task's planned file is no trace gap
  run(["bugfix", "Crash", "--summary", "crash on save", "--project", w5]);
  const bugDone = run(["done", "crash", "3", "--project", w5]);
  ok(bugDone.code === 1 && /Task 3 can't be completed yet: bug\.md → Root Cause is not filled/.test(bugDone.out) &&
    /- \[ \] 3\./.test(fs.readFileSync(path.join(w5, ".specs", "crash", "tasks.md"), "utf8")), "done on a bugfix task after the root-cause task exits 1 while bug.md → Root Cause is empty");
  // done --run checks the same gate BEFORE running the task's _Verify:_ command (it used to run it, then refuse)
  const crashTasks = path.join(w5, ".specs", "crash", "tasks.md");
  fs.writeFileSync(crashTasks, fs.readFileSync(crashTasks, "utf8").replace(/_Verify: \[[^\]\n]*\]_/, "_Verify: node -e \"require('fs').writeFileSync('ran-wp5.txt','x')\"_"));
  const bugRun = run(["done", "crash", "4", "--run", "--project", w5]);
  ok(/_Verify: node -e/.test(fs.readFileSync(crashTasks, "utf8")) && bugRun.code === 1 && /Task 4 can't be completed yet: bug\.md → Root Cause is not filled/.test(bugRun.out) &&
    !/\$ node/.test(bugRun.out) && !fs.existsSync(path.join(w5, "ran-wp5.txt")), "done --run on a gated bugfix task exits 1 WITHOUT running its _Verify:_ command");
  run(["create", "Plan", "core", "--project", w5]);
  fs.writeFileSync(path.join(w5, ".specs", "plan", "requirements.md"), "## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n");
  fs.writeFileSync(path.join(w5, ".specs", "plan", "tasks.md"), "- [ ] 1. a\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/not-yet.js_\n");
  const trP = run(["trace", "plan", "--project", w5]);
  ok(trP.code === 0 && /verdict=pass/.test(trP.out) && !/src\/not-yet\.js/.test(trP.out), "trace: an open task's not-yet-written _Implements:_ file is no gap (exit 0)");
}
// @wp WP5 <<<

// @wp WP6 cli-tests >>>
{ // 1.13 WP6 — scan sections, coverage by _Implements:_, import (Kiro · spec-kit · OpenSpec), create --brownfield (own block scope)
  const w6 = path.join(tmp, "wp6-proj");
  const put = (rel, s) => { const p = path.join(w6, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
  run(["init", "core", "--project", w6]);
  put("package.json", JSON.stringify({ name: "x", main: "src/server.js", devDependencies: { jest: "^29" } }));
  put("src/server.js", "const app = require('express')();\napp.get('/health', h);\napp.post('/orders', h);\nconst p = process.env.PORT;\n");
  put("src/server.test.js", "test('x', () => {});\n");
  put("api/main.py", "from fastapi import FastAPI\napp = FastAPI()\n@app.get(\"/items\")\ndef items(): ...\n");
  put("migrations/001_init.sql", "create table t (id int);\n");
  put(".env", "LEAKED_NAME=do-not-print\n");
  const sc = run(["scan", "--project", w6, w6]);
  ok(sc.code === 0 && /endpoints: 3 route\(s\) in 2 file\(s\)/.test(sc.out) && /GET\s+\/health\s+\(src\/server\.js:2\)/.test(sc.out) && /GET\s+\/items\s+\(api\/main\.py:3\)/.test(sc.out) &&
    /frameworks: .*fastapi/.test(sc.out) && /tests: 1 file\(s\) · frameworks: jest/.test(sc.out) && /entrypoints: src\/server\.js \(package\.json main\)/.test(sc.out) &&
    /env vars \(names only\): PORT/.test(sc.out) && /migrations\/schema: 1 file\(s\) — migrations/.test(sc.out) && !/LEAKED_NAME|do-not-print/.test(sc.out),
    "scan prints routes (method path file:line), frameworks, tests, entrypoints, env var names (never .env) and migrations");
  let scJ = null;
  try { scJ = JSON.parse(run(["scan", "--json", "--project", w6, w6]).out); } catch { /* invalid JSON */ }
  ok(scJ && scJ.candidateEndpoints === 3 && scJ.routes.length === 3 && scJ.routes.every((r) => r.method && r.path && r.file && r.line), "scan --json returns the routes structured (same result as spec_scan)");
  const ptScan = path.join(tmp, "wp6-pt");
  run(["init", "core", "--lang", "pt", "--project", ptScan]);
  fs.mkdirSync(path.join(ptScan, "src"), { recursive: true });
  fs.writeFileSync(path.join(ptScan, "src", "index.js"), "app.get('/x', h);\n");
  const ptOut = run(["scan", "--project", ptScan, ptScan]).out;
  ok(/endpoints: 1 rota\(s\) em 1 ficheiro\(s\)/.test(ptOut) && /pontos de entrada:/.test(ptOut) && /variáveis de ambiente \(só nomes\): nenhum/.test(ptOut), "scan sections are localized (PT)");

  // coverage: code files named in _Implements:_, per folder
  run(["create", "Orders", "core", "--project", w6]);
  fs.writeFileSync(path.join(w6, ".specs", "orders", "tasks.md"), "- [ ] 1. orders endpoint\n  - _Implements: src/server.js_\n");
  const cov = run(["coverage", "--project", w6]);
  ok(cov.code === 0 && /Spec coverage: 50%  \(1\/2 code files named in _Implements:_\)/.test(cov.out) && /test files \(reported apart, not counted\): 1/.test(cov.out) &&
    /src\/\s+1\/1\s+100%/.test(cov.out) && /uncovered folders: api/.test(cov.out), "coverage prints the % of code files named in _Implements:_, per folder, and the uncovered folders");
  const ptCov = run(["coverage", "--project", ptScan]).out;
  ok(/Cobertura de specs: 0%  \(0\/1 ficheiros de código nomeados em _Implements:_\)/.test(ptCov) && /src\/\s+0\/1\s+0%/.test(ptCov) && /pastas sem cobertura: src/.test(ptCov),
    "coverage output is localized (PT)");

  // import: Kiro (auto tracks), spec-kit (--name --tracks --lang), OpenSpec; refusals
  put(".kiro/specs/login/requirements.md", "# Requirements Document\n\n## Introduction\nSign in.\n\n## Requirements\n\n### Requirement 1\n\n**User Story:** As a user, I want to sign in, so that I see my data.\n\n#### Acceptance Criteria\n\n1. WHEN a user submits valid credentials THEN the system SHALL create a session\n2. WHEN the password is wrong THEN the system shows an error\n");
  put(".kiro/specs/login/tasks.md", "# Implementation Plan\n\n- [x] 1. Session store\n  - _Requirements: 1.1_\n- [ ] 2. Error message\n  - _Requirements: 1.2_\n");
  const kiroSrc = fs.readFileSync(path.join(w6, ".kiro/specs/login/tasks.md"), "utf8");
  const ki = run(["import", "kiro", ".kiro/specs/login", "--project", w6]);
  const kiTasks = fs.existsSync(path.join(w6, ".specs", "login", "tasks.md")) ? fs.readFileSync(path.join(w6, ".specs", "login", "tasks.md"), "utf8") : "";
  ok(ki.code === 0 && /Imported Kiro \.kiro\/specs\/login → feature 'login' \[core \+tdd\] \(en\)/.test(ki.out) && /mapping: \d+ ID\(s\) — Requirement 1 → US-1, 1\.1 → US-1\.AC-1/.test(ki.out) &&
    /- \[x\] 1\. Session store\n  - _Requirements: US-1\.AC-1_/.test(kiTasks) && /- \[ \] 2\. Error message\n  - _Requirements: US-1\.AC-2_/.test(kiTasks) &&
    fs.readFileSync(path.join(w6, ".kiro/specs/login/tasks.md"), "utf8") === kiroSrc, "import kiro: new feature, IDs mapped, _Requirements:_ rewritten, checkbox state kept, source untouched");
  ok(run(["ears", "login", "--project", w6]).code === 0 && /US-1\.AC-2\*\* — WHEN the password is wrong, THE SYSTEM SHALL show an error/.test(fs.readFileSync(path.join(w6, ".specs", "login", "requirements.md"), "utf8")),
    "import kiro: the imported requirements pass `ears` (WHEN…THEN without SHALL rewritten)");
  put("specs/002-albums/spec.md", "# Feature Specification: Albums\n\n## User Scenarios & Testing\n\n### User Story 1 - Create albums (Priority: P1)\n\n**Acceptance Scenarios**:\n\n1. **Given** a user, **When** they create an album, **Then** the album is listed\n\n## Success Criteria\n\n- **SC-001**: 90% create an album in under 1 minute\n");
  put("specs/002-albums/tasks.md", "# Tasks: Albums\n\n## Phase 1\n\n- [ ] T001 [P] [US1] Album model\n");
  const skJ = (() => { try { return JSON.parse(run(["import", "spec-kit", "specs/002-albums", "--name", "Photo Albums", "--tracks", "saas", "--lang", "es", "--json", "--project", w6]).out); } catch { return null; } })();
  ok(skJ && skJ.ok && skJ.feature === "photo-albums" && skJ.label === "core +saas" && skJ.lang === "es" && skJ.mapping["User Story 1 / Scenario 1"] === "US-1.AC-1" && skJ.mapping["task T001"] === "task 1" &&
    /- \[ \] 1\. \[P\] \[US1\] Album model/.test(fs.readFileSync(path.join(w6, ".specs", "photo-albums", "tasks.md"), "utf8")) &&
    /^> Importado de spec-kit `specs\/002-albums` el /m.test(fs.readFileSync(path.join(w6, ".specs", "photo-albums", "requirements.md"), "utf8")),
    "import spec-kit --name --tracks --lang --json: same result shape as spec_import (feature, mapping, warnings), tags kept, ES note");
  put("openspec/specs/billing/spec.md", "# Billing Specification\n\n## Purpose\nInvoices.\n\n## Requirements\n### Requirement: Invoice\nThe system SHALL issue invoices.\n\n#### Scenario: Monthly\n- **WHEN** a month ends\n- **THEN** an invoice is issued\n");
  const osI = run(["import", "openspec", "openspec/specs/billing", "--project", w6]);
  ok(osI.code === 0 && /feature 'billing'/.test(osI.out) && /US-1\.AC-1\*\* — WHEN a month ends, THE SYSTEM SHALL ensure that an invoice is issued/.test(fs.readFileSync(path.join(w6, ".specs", "billing", "requirements.md"), "utf8")),
    "import openspec: requirement/scenario → US-1.AC-1 as an EARS criterion");
  const again = run(["import", "kiro", ".kiro/specs/login", "--project", w6]);
  const outside = run(["import", "kiro", "../wp6-pt", "--project", w6]);
  const badTool = run(["import", "notion", ".kiro/specs/login", "--project", w6]);
  const usage = run(["import", "kiro", "--project", w6]);
  ok(again.code === 1 && /already exists/.test(again.out) && outside.code === 1 && /outside the project/.test(outside.out) && badTool.code === 1 && /Unknown spec format 'notion'\. Known: kiro, spec-kit, openspec/.test(badTool.out) &&
    usage.code === 1 && /usage: dev-spec import/.test(usage.out), "import refusals exit 1: existing feature, path outside the project, unknown format, missing path");

  // create --brownfield → integration-plan.md; doctor warns while it is the template
  const bf = run(["create", "Old Billing", "core", "--brownfield", "--project", w6]);
  ok(bf.code === 0 && /integration-plan\.md/.test(bf.out) && fs.existsSync(path.join(w6, ".specs", "old-billing", "integration-plan.md")) &&
    /▲ integration-plan — integration-plan\.md is still the template/.test(run(["doctor", "old-billing", "--project", w6]).out) &&
    !fs.existsSync(path.join(w6, ".specs", "orders", "integration-plan.md")), "create --brownfield scaffolds integration-plan.md and doctor warns while it is the template");

  const help6 = run(["help"]).out;
  const lines6 = help6.split("\n");
  const covAt = lines6.findIndex((l) => /^\s+coverage\s/.test(l));
  ok(/^\s+import <kiro\|spec-kit\|openspec> <path>/.test(lines6[covAt + 1] || "") && /--brownfield/.test(help6) && /--tracks/.test(help6), "help: `import` right after `coverage`; --brownfield and --tracks documented");

  // Review round: --tracks is a value flag everywhere, so every command that takes tracks honours it (never dropped).
  const tk = path.join(tmp, "wp6-tracks");
  const crT = (() => { try { return JSON.parse(run(["create", "Payments Flow", "--tracks", "tdd,saas", "--json", "--project", tk]).out); } catch { return null; } })();
  const crT2 = run(["create", "Report page", "--tracks", "saas", "--project", tk]);
  ok(crT && crT.tracks.join() === "core,tdd,saas" && crT2.code === 0 && /\[core \+saas\]/.test(crT2.out) && fs.existsSync(path.join(tk, ".specs", "report-page", "load-test.md")),
    "create --tracks tdd,saas / --tracks saas uses those tracks (no silent auto-classify)");
  const tkInit = path.join(tmp, "wp6-tracks-init");
  const inT = run(["init", "--tracks", "saas", "ai", "--project", tkInit]);
  ok(inT.code === 0 && ["scale.md", "observability.md", "cost.md", "ai-strategy.md"].every((f) => fs.existsSync(path.join(tkInit, ".specs", "steering", f))),
    "init --tracks saas ai scaffolds the steering of BOTH tracks (the flag's value + the positional one)");
  run(["create", "x", "core", "--project", tk]);
  const atT = run(["add-track", "x", "--tracks", "ai", "--project", tk]);
  ok(atT.code === 0 && /'x' now \[core \+ai\]/.test(atT.out), "add-track <feature> --tracks ai adds the track (no usage error)");

  // Review round: import accepts exactly the MCP enum — no aliases, no case folding.
  const alias1 = run(["import", "speckit", "specs/002-albums", "--name", "Alias CLI", "--project", w6]);
  const alias2 = run(["import", "Kiro", ".kiro/specs/login", "--name", "Alias CLI2", "--project", w6]);
  ok(alias1.code === 1 && alias2.code === 1 && /Unknown spec format 'speckit'/.test(alias1.out) && /Unknown spec format 'Kiro'/.test(alias2.out) &&
    !fs.existsSync(path.join(w6, ".specs", "alias-cli")) && !fs.existsSync(path.join(w6, ".specs", "alias-cli2")), "import speckit / Kiro exit 1 like spec_import over MCP (same accepted values)");

  // Review round: coverage lists a test-file target apart, never as a gap.
  put("tests/orders.test.js", "test('x', () => {});\n");
  fs.writeFileSync(path.join(w6, ".specs", "orders", "tasks.md"), "- [ ] 1. orders test\n  - _Implements: tests/orders.test.js_\n- [ ] 2. orders endpoint\n  - _Implements: src/server.js, src/missing.js_\n");
  const cov2 = run(["coverage", "--project", w6]);
  ok(cov2.code === 0 && /⚠ _Implements:_ entries that name nothing on disk: src\/missing\.js$/m.test(cov2.out) && /· _Implements:_ entries naming tests or non-code files \(not counted\): tests\/orders\.test\.js/.test(cov2.out),
    "coverage: a +tdd task naming its (existing) test file is informational; only a missing path is flagged");
}
// @wp WP6 <<<

// @wp WP7 cli-tests >>>
// 1.13 WP7: append-tasks <feature> --task … — one task per call, same engine call as spec_append_tasks.
{
  const S7 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const mk7 = (dir, crlf) => {
    run(["init", "tdd", "--project", dir]);
    run(["create", "Conv", "tdd", "--project", dir]);
    const f = path.join(dir, ".specs", "conv");
    const eol = crlf ? "\r\n" : "\n";
    fs.writeFileSync(path.join(f, "requirements.md"), ["## Acceptance Criteria", "1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b", "2. **US-1.AC-2** — WHEN c THE SYSTEM SHALL d", ""].join(eol));
    fs.writeFileSync(path.join(f, "tasks.md"), ["# Tasks: Conv", "", "## Story US-1 (P1 — MVP)", "- [x] 1. [US1] Core", "  - _Requirements: US-1.AC-1_", "**Checkpoint:** US-1 works.", ""].join(eol));
    return f;
  };
  const w7 = path.join(tmp, "wp7-proj");
  const w7f = mk7(w7);
  run(["approve", "conv", "tasks", "--force", "--project", w7]); // template tasks: forced past the approve gate
  const verify7 = 'node -e "process.exit(0)"';
  const a1 = run(["append-tasks", "conv", "--task", "Fix the parser", "--req", "US-1.AC-2", "--implements", "src\\parser.js", "--verify", verify7, "--story", "US1", "--parallel", "--project", w7]);
  const a2 = run(["append-tasks", "conv", "--task", "Fix the writer", "--req", "us-1.ac-1,US-1.AC-2", "--implements", "src/writer.js", "--parallel", "--story", "US1", "--project", w7]);
  const t7 = fs.readFileSync(path.join(w7f, "tasks.md"), "utf8");
  ok(a1.code === 0 && /Appended to tasks\.md → 'Phase: Convergence' \(new phase\):/.test(a1.out) && /- \[ \] 2\. \[US1\]\[P\] Fix the parser/.test(a1.out) &&
    /⚠ tasks\.md changed after its approval — .*\/approve conv tasks/.test(a1.out) && a2.code === 0 && !/new phase/.test(a2.out) &&
    t7.endsWith("\n## Phase: Convergence\n- [ ] 2. [US1][P] Fix the parser\n  - _Requirements: US-1.AC-2_\n  - _Implements: src/parser.js_\n  - _Verify: " + verify7 + "_\n" +
      "- [ ] 3. [US1][P] Fix the writer\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Implements: src/writer.js_\n**Checkpoint:** the convergence tasks are done and verified — the spec and the code agree again.\n"),
    "append-tasks appends one task per call under 'Phase: Convergence' (the second joins the same phase), with the re-approval warning");
  ok(/parallel batch: #2 \[src\/parser\.js\]  #3 \[src\/writer\.js\]/.test(run(["next", "conv", "--batch", "--project", w7]).out) &&
    /# Task brief — conv · task 2/.test(run(["brief", "conv", "2", "--project", w7]).out) && /Task 2 done \(verified\)/.test(run(["done", "conv", "2", "--run", "--project", w7]).out),
    "appended tasks drive next --batch, brief and done --run (their _Verify:_ runs and verifies)");
  // CLI --json ≡ spec_append_tasks on an identical project (same result object).
  const w7b = path.join(tmp, "wp7-proj-b");
  mk7(w7b);
  let aj = null;
  try { aj = JSON.parse(run(["append-tasks", "conv", "--task", "Same thing", "--req", "US-1.AC-2", "--implements", "a.js,b.js", "--json", "--project", w7b]).out); } catch { /* invalid JSON */ }
  const w7c = path.join(tmp, "wp7-proj-c");
  mk7(w7c);
  ok(aj && JSON.stringify(aj) === JSON.stringify(S7.appendTasks(w7c, "conv", [{ text: "Same thing", requirements: ["US-1.AC-2"], implements: ["a.js,b.js"] }])) && aj.appended[0].implements.join() === "a.js,b.js",
    "append-tasks --json returns exactly what spec_append_tasks returns");
  // Errors: phantom AC (nothing written), two --task, no --task.
  const before7 = fs.readFileSync(path.join(w7f, "tasks.md"), "utf8");
  const ph7 = run(["append-tasks", "conv", "--task", "x", "--req", "US-1.AC-2,US-9.AC-1", "--project", w7]);
  const two7 = run(["append-tasks", "conv", "--task", "a", "--task", "b", "--project", w7]);
  const none7 = run(["append-tasks", "conv", "--project", w7]);
  const abs7 = run(["append-tasks", "conv", "--task", "x", "--implements", "../up.js", "--project", w7]);
  ok(ph7.code === 1 && /Unknown acceptance criteria \(not in requirements\.md\): US-9\.AC-1\. Nothing was written/.test(ph7.out) && two7.code === 1 && /one --task per call/.test(two7.out) &&
    none7.code === 1 && /usage: dev-spec append-tasks/.test(none7.out) && abs7.code === 1 && /without '\.\.'/.test(abs7.out) && fs.readFileSync(path.join(w7f, "tasks.md"), "utf8") === before7,
    "append-tasks errors (phantom AC, two --task, no --task, '..' path) exit 1 and write nothing");
  // CRLF tasks.md stays CRLF.
  const w7d = path.join(tmp, "wp7-crlf");
  const w7df = mk7(w7d, true);
  const crOrig7 = fs.readFileSync(path.join(w7df, "tasks.md"), "utf8");
  const cr7 = run(["append-tasks", "conv", "--task", "Keep CRLF", "--req", "US-1.AC-2", "--heading", "Story US-1 (P1 — MVP)", "--project", w7d]);
  const crNow7 = fs.readFileSync(path.join(w7df, "tasks.md"), "utf8");
  ok(cr7.code === 0 && !/new phase/.test(cr7.out) && !/[^\r]\n/.test(crNow7) &&
    crNow7 === crOrig7.replace("**Checkpoint:** US-1 works.", "- [ ] 2. Keep CRLF\r\n  - _Requirements: US-1.AC-2_\r\n**Checkpoint:** US-1 works."),
    "append-tasks --heading on a CRLF tasks.md: the task lands before that phase's checkpoint, every line stays CRLF");
  // PT project: localized output and heading.
  const pt7 = path.join(tmp, "wp7-pt");
  run(["init", "--lang", "pt", "--project", pt7]);
  run(["create", "Pagamentos", "core", "--project", pt7]);
  const ptOut7 = run(["append-tasks", "pagamentos", "--task", "Corrigir o desvio", "--req", "US-1.AC-1", "--project", pt7]);
  ok(ptOut7.code === 0 && /Acrescentado a tasks\.md → 'Fase: Convergência' \(nova fase\):/.test(ptOut7.out) &&
    /\n## Fase: Convergência\n- \[ \] \d+\. Corrigir o desvio\n  - _Requirements: US-1\.AC-1_\n\*\*Checkpoint:\*\* as tarefas/.test(fs.readFileSync(path.join(pt7, ".specs", "pagamentos", "tasks.md"), "utf8")) &&
    /Critérios de aceitação desconhecidos/.test(run(["append-tasks", "pagamentos", "--task", "x", "--req", "US-8.AC-8", "--project", pt7]).out),
    "append-tasks (PT): 'Fase: Convergência', localized output and errors");
  // Repeated --req / --implements (both spellings) are all kept — the shared parser alone kept only the last one.
  const w7e = path.join(tmp, "wp7-rep");
  const w7ef = mk7(w7e);
  const rep7 = run(["append-tasks", "conv", "--task", "rep req", "--req", "US-1.AC-1", "--req=US-1.AC-2", "--implements", "a.js", "--implements=b.js", "--json", "--project", w7e]);
  let repJ = null;
  try { repJ = JSON.parse(rep7.out); } catch { /* invalid JSON */ }
  const repPh = run(["append-tasks", "conv", "--task", "x", "--req", "US-1.AC-1", "--req", "US-9.AC-9", "--project", w7e]);
  const repTwo = run(["append-tasks", "conv", "--task=a", "--task", "b", "--project", w7e]);
  ok(rep7.code === 0 && repJ && repJ.appended[0].requirements.join() === "US-1.AC-1,US-1.AC-2" && repJ.appended[0].implements.join() === "a.js,b.js" &&
    fs.readFileSync(path.join(w7ef, "tasks.md"), "utf8").includes("- [ ] 2. rep req\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Implements: a.js, b.js_\n") &&
    repPh.code === 1 && /Unknown acceptance criteria \(not in requirements\.md\): US-9\.AC-9\./.test(repPh.out) && repTwo.code === 1 && /one --task per call/.test(repTwo.out),
    "append-tasks keeps every repeated --req / --implements (a phantom in any of them still refuses); --task=a --task b is still two tasks");
  // A command substitution at the end of --verify reads back intact (append-tasks --json and brief --json).
  const tick7 = run(["append-tasks", "conv", "--task", "check", "--verify", "test -n `echo ok`", "--json", "--project", w7e]);
  let tickJ = null, tickB = null;
  try { tickJ = JSON.parse(tick7.out); tickB = JSON.parse(run(["brief", "conv", String(tickJ.appended[0].number), "--json", "--project", w7e]).out); } catch { /* invalid JSON */ }
  ok(tick7.code === 0 && tickJ && tickJ.appended[0].verify === "test -n `echo ok`" && tickB && tickB.verify.join() === "test -n `echo ok`",
    "append-tasks --verify 'test -n `echo ok`': the stored command reads back exactly as given (what done --run would execute)");
  // A repeated --verify / --story / --heading (either spelling) is refused — never last-wins (a dropped check would
  // never be asked for by the evidence gate). Localized; nothing written.
  const repBefore = fs.readFileSync(path.join(w7ef, "tasks.md"), "utf8");
  const vTwice = run(["append-tasks", "conv", "--task", "two checks", "--verify", "npm test", "--verify=npm run lint", "--project", w7e]);
  const sTwice = run(["append-tasks", "conv", "--task", "x", "--story", "US1", "--story", "shared", "--project", w7e]);
  const hTwice = run(["append-tasks", "conv", "--task", "x", "--heading=Phase A", "--heading", "Phase B", "--project", w7e]);
  const vTwicePt = run(["append-tasks", "pagamentos", "--task", "x", "--verify", "a", "--verify", "b", "--project", pt7]);
  ok(vTwice.code === 1 && /takes --verify once per call — join the checks into one command/.test(vTwice.out) && sTwice.code === 1 && /--story once per call/.test(sTwice.out) &&
    hTwice.code === 1 && /--heading once per call/.test(hTwice.out) && vTwicePt.code === 1 && /aceita --verify uma só vez por chamada/.test(vTwicePt.out) &&
    fs.readFileSync(path.join(w7ef, "tasks.md"), "utf8") === repBefore,
    "append-tasks refuses a repeated --verify / --story / --heading (localized), writing nothing");
  const help7 = run(["help"]).out;
  const fin7 = help7.indexOf("finish <feature>");
  ok(fin7 !== -1 && help7.indexOf("append-tasks <feature>") > fin7 && help7.indexOf("append-tasks <feature>") < help7.indexOf("approve <feature>") &&
    ["--task", "--req", "--implements", "--verify", "--story", "--parallel", "--heading"].every((x) => help7.includes(x)),
    "help lists append-tasks right after finish, with every flag it reads");
}
// @wp WP7 <<<

// @wp WP8 cli-tests >>>
// @wp WP8 <<<

// @wp WP9 cli-tests >>>
{ // --- 1.13 WP9: trace prints the EC/NFR/SC warnings (exit code unchanged); --code scans test files; finish lists warnings ---
  const w9 = path.join(tmp, "wp9");
  const put9 = (rel, s) => { const p = path.join(w9, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
  run(["init", "tdd", "--project", w9]);
  run(["create", "Deep", "tdd", "--project", w9]);
  put9(".specs/deep/requirements.md", "# Feature: Deep\n\n## User Stories\n\n### US-1 (P1)\n\n#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN a token expires THE SYSTEM SHALL reject it with 401.\n\n" +
    "## Success Criteria\n- **SC-001** — 99% of refreshes succeed within 300 ms.\n\n## Edge Cases\n- **EC-1** — a revoked token is rejected.\n- **EC-2** — [scenario]\n");
  put9(".specs/deep/tasks.md", "# Tasks\n\n## Phase: Build\n- [x] 1. [US1] Reject expired tokens\n  - _Requirements: US-1.AC-1, NFR-4_\n  - _Makes green: T-01, T-02_\n");
  put9(".specs/deep/test-plan.md", "| Test ID | Layer | Kind | Description | Covers | File |\n|---|---|---|---|---|---|\n| T-01 | unit | example | expired | US-1.AC-1, SC-001 | `x` |\n| T-02 | unit | property | any token | US-1.AC-1 | `x` |\n");
  put9("tests/session.test.js", "test(\"T-01 rejects an expired token\", () => {});\ntest(\"T-77 not in any plan\", () => {});\n");
  put9("tests/test_session.py", "def test_T02_any_token():\n    pass\n");
  const tr9 = run(["trace", "deep", "--project", w9]);
  ok(tr9.code === 0 && /verdict=pass/.test(tr9.out) && /▲ edge cases \(EC\) that no task or test covers: EC-1/.test(tr9.out) &&
    /▲ tasks \/ test plan cite unknown EC\/NFR\/SC IDs \(typos\?\): NFR-4/.test(tr9.out) && !/EC-2/.test(tr9.out) && !/tests in code/.test(tr9.out),
    "trace lists the EC/NFR/SC warnings with ▲ (a template EC-2 is not one) and still exits 0 on a passing verdict");
  const trc9 = run(["trace", "deep", "--code", "--project", w9]);
  ok(trc9.code === 0 && /tests in code: 2\/2 planned T-ID\(s\) named in 2 test file\(s\)/.test(trc9.out) && /▲ T-IDs in test code that no feature's test plan lists: T-77/.test(trc9.out),
    "trace --code scans the test files: a summary line, and T-77 (in no plan) as a warning");
  let j9 = null;
  try { j9 = JSON.parse(run(["trace", "deep", "--code", "--json", "--project", w9]).out); } catch { /* invalid JSON */ }
  ok(j9 && j9.code && j9.code.testsInCode["T-01"].join() === "tests/session.test.js" && j9.code.testsInCode["T-02"].join() === "tests/test_session.py" &&
    j9.code.plannedNotInCode.length === 0 && j9.code.inCodeNotInPlan.join() === "T-77" && j9.code.scanned === 2 && j9.warnings.map((w) => w.kind).join() === "uncoveredEdgeCases,phantomSecondary,inCodeNotInPlan",
    "trace --code --json: the same code block as trace_check {code: true} and warnings as [{kind, items}]");
  const doc9 = run(["doctor", "deep", "--project", w9]);
  ok(/▲ secondary-trace — edge cases \(EC\) that no task or test covers: EC-1/.test(doc9.out) && /✓ tests-in-code — every planned T-ID made green by a done task is named in a test file \(2\)/.test(doc9.out),
    "doctor prints the secondary-trace warn and the tests-in-code pass");
  fs.unlinkSync(path.join(w9, "tests", "test_session.py"));
  const fin9 = run(["finish", "deep", "--project", w9]);
  ok(/▲ edge cases \(EC\) that no task or test covers: EC-1/.test(fin9.out) && /▲ planned tests that no test file names \(put the T-ID in the test name\): T-02/.test(fin9.out) && !/✗ [^\n]*EC-1/.test(fin9.out),
    "finish prints the warnings with ▲ (EC-1, planned T-02 with no test file) — never as ✗ blockers");
  // PT feature: localized warning lines and code summary.
  run(["create", "Sessões", "tdd", "--lang", "pt", "--project", w9]);
  fs.appendFileSync(path.join(w9, ".specs", "sessoes", "requirements.md"), "\n## Extra\n- **NFR-3** — latência p95 ≤ 300 ms.\n");
  const pt9 = run(["trace", "sessoes", "--code", "--project", w9]);
  ok(/▲ requisitos não funcionais \(NFR\) sem tarefa nem teste que os cubra: NFR-3/.test(pt9.out) && /testes no código: 1\/5 T-ID\(s\) planeado\(s\) nomeado\(s\) em 1 ficheiro\(s\) de teste/.test(pt9.out),
    "trace (PT feature): warnings and the tests-in-code summary in Portuguese (T-01 matches by number, whichever feature wrote the test)");
  ok(/usage: dev-spec trace <feature> \[--code\]/.test(run(["trace", "--project", w9]).out) && /trace <feature> \[--code\]/.test(run(["help"]).out) &&
    /trace <feature> \[--code\]/.test(fs.readFileSync(CLI, "utf8").split("*/")[0]), "usage, help and the docblock show trace --code");
  // Review round: the feature's own .specs/<f>/tests/ is scanned; test_t2_… is not a T-ID; a concrete File cell scopes the
  // match (tests/session.test.js's T-01 — Deep's test — no longer passes Clock's T-01).
  run(["create", "Clock", "tdd", "--project", w9]);
  put9(".specs/clock/requirements.md", "# Feature: Clock\n\n## User Stories\n\n### US-1 (P1)\n\n#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the clock ticks THE SYSTEM SHALL advance it.\n");
  put9(".specs/clock/tasks.md", "# Tasks\n\n## Phase: Build\n- [x] 1. [US1] Tick\n  - _Requirements: US-1.AC-1_\n  - _Makes green: T-01, T-02_\n");
  put9(".specs/clock/test-plan.md", "| Test ID | Layer | Kind | Description | Covers | File |\n|---|---|---|---|---|---|\n| T-01 | unit | example | ticks | US-1.AC-1 | `tests/unit/clock.test.js` |\n| T-02 | unit | example | order | US-1.AC-1 | `tests/clock/` |\n");
  put9(".specs/clock/tests/unit/clock.test.js", "test(\"T-01 ticks\", () => {});\n");
  put9("tests/test_clock.py", "def test_t2_is_after_t1():\n    pass\n");
  let ck9 = null;
  try { ck9 = JSON.parse(run(["trace", "clock", "--code", "--json", "--project", w9]).out); } catch { /* invalid JSON */ }
  const ckd9 = run(["doctor", "clock", "--project", w9]);
  ok(ck9 && ck9.code.testsInCode["T-01"].join() === ".specs/clock/tests/unit/clock.test.js" && ck9.code.plannedNotInCode.join() === "T-02" && !ck9.code.inCodeNotInPlan.includes("T-2") &&
    /▲ tests-in-code — made green by done tasks, but no test file names them: T-02 — [^\n]*File column/.test(ckd9.out),
    "trace --code reads .specs/clock/tests/, scopes T-01 to its File cell and ignores test_t2_…; doctor warns about T-02 only (got " + JSON.stringify(ck9 && ck9.code) + ")");
  // Round 2: a bare file name in the File cell matches the test wherever it sits (whole path segments at the end).
  run(["create", "Badge", "tdd", "--project", w9]);
  put9(".specs/badge/requirements.md", "# Feature: Badge\n\n## User Stories\n\n### US-1 (P1)\n\n#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN a user logs in THE SYSTEM SHALL show a badge.\n");
  put9(".specs/badge/tasks.md", "# Tasks\n\n## Phase: Build\n- [x] 1. [US1] Badge\n  - _Requirements: US-1.AC-1_\n  - _Makes green: T-01_\n");
  put9(".specs/badge/test-plan.md", "| Test ID | Layer | Kind | Description | Covers | File |\n|---|---|---|---|---|---|\n| T-01 | unit | example | shows | US-1.AC-1 | `badge.test.js` |\n");
  put9("src/badge/badge.test.js", "test(\"T-01 shows a badge\", () => {});\n");
  const bg9 = run(["trace", "badge", "--code", "--project", w9]);
  const bgd9 = run(["doctor", "badge", "--project", w9]);
  ok(/tests in code: 1\/1 planned/.test(bg9.out) && !/planned tests that no test file names/.test(bg9.out) && /✓ tests-in-code/.test(bgd9.out),
    "trace --code / doctor: a bare file name File cell (`badge.test.js`) is satisfied by src/badge/badge.test.js (got " + bg9.out + ")");
}
// @wp WP9 <<<

// @wp WP10 cli-tests >>>
// @wp WP10 <<<

// @wp WP11 cli-tests >>>
// @wp WP11 <<<

// unknown command errors
ok(run(["wat"]).code === 1, "unknown command exits non-zero");

console.log(`\n${pass} passed, ${fail} failed`);
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
process.exit(fail ? 1 : 0);
