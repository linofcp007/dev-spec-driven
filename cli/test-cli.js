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
}
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
