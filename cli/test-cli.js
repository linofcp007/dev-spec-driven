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
ok(run(["approve", "Invoice Summary", "design"]).out.includes("Approved 'design'"), "approve records gate");

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
ok(run(["feature", "remove", "user-auth"]).out.includes("Removed"), "feature remove deletes a feature");

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
ok(fin.code === 1 && /fix\(login-loop\): bounce to \/login/.test(fin.out) && /root-cause/.test(fin.out), "finish exits 1 while blocked and prints the merge summary from the spec");

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
// @wp WP1 <<<

// @wp WP2 cli-tests >>>
// @wp WP2 <<<

// @wp WP3 cli-tests >>>
// @wp WP3 <<<

// @wp WP4 cli-tests >>>
// @wp WP4 <<<

// @wp WP5 cli-tests >>>
// @wp WP5 <<<

// @wp WP6 cli-tests >>>
// @wp WP6 <<<

// @wp WP7 cli-tests >>>
// @wp WP7 <<<

// @wp WP8 cli-tests >>>
// @wp WP8 <<<

// @wp WP9 cli-tests >>>
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
