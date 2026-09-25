#!/usr/bin/env node
"use strict";

/**
 * Smoke test for the universal CLI (cli/dev-spec.js). Exercises the subcommands against a
 * throwaway temp project and asserts on output. Run: `node cli/test-cli.js` (its sections run in
 * parallel child processes — see SECTIONS; `CLI_TEST_SECTION=<name> node cli/test-cli.js` runs one).
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

// Speed: every assertion is a CLI process (~0.15 s each), so one sequential run can't go below ~50 s. The sections
// below are independent — each works in its own project folder under its own temp dir — so the suite runs each one in
// a child process of this file (CLI_TEST_SECTION=<name>), all at once, and prints their output in section order with
// one total. `CLI_TEST_SECTION=wp4 node cli/test-cli.js` runs one section alone.
const SECTIONS = ["main", "wp1", "wp2", "wp3", "wp4", "wp5", "wp6", "wp7", "wp8", "wp9", "wp10", "wp11", "wp12", "wp13", "wp14", "wp15", "wp16"];
const SECTION = process.env.CLI_TEST_SECTION || "";
const inSection = (name) => SECTION === name;
if (!SECTION) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} // the children make their own
  const { spawn } = require("child_process");
  const runSection = (name) => new Promise((resolve) => {
    let out = "";
    const child = spawn(process.execPath, [__filename], { env: { ...process.env, CLI_TEST_SECTION: name }, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("error", (e) => resolve({ name, out: out + "\n" + e.message, code: 1 }));
    child.on("close", (code) => resolve({ name, out, code }));
  });
  // At most one section per CPU at a time; results keep the section order.
  const all = new Array(SECTIONS.length);
  let nextIdx = 0;
  const worker = () => (nextIdx >= SECTIONS.length ? Promise.resolve() : ((i) => runSection(SECTIONS[i]).then((r) => { all[i] = r; return worker(); }))(nextIdx++));
  Promise.all(Array.from({ length: Math.max(2, Math.min(SECTIONS.length, os.cpus().length || 2)) }, worker)).then(() => {
    let passed = 0, failed = 0;
    for (const r of all) {
      const m = r.out.match(/\n(\d+) passed, (\d+) failed\s*$/);
      process.stdout.write(r.out.replace(/\n\d+ passed, \d+ failed\s*$/, "\n"));
      if (m) { passed += +m[1]; failed += +m[2]; }
      // A section that died (or never printed its total) fails the suite — never let it drain to exit 0.
      if (!m || (r.code !== 0 && +m[2] === 0)) { failed++; console.log(`  FAIL - section '${r.name}' exited with code ${r.code} without a clean total`); }
    }
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  });
  return; // CommonJS module scope: the parent only dispatches
}
if (!SECTIONS.includes(SECTION)) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  console.log(`unknown CLI_TEST_SECTION '${SECTION}' (known: ${SECTIONS.join(", ")})\n\n0 passed, 1 failed`);
  process.exit(1);
}

if (inSection("main")) {
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
// --lang is the MCP `lang` enum: an unknown value is refused (exit 1, localized, nothing written) — it used to become
// 'en' and be SAVED (init rewrote the project language); case is folded (PT = pt).
const esRm = () => JSON.parse(fs.readFileSync(path.join(esSub, ".specs", "roadmap.json"), "utf8"));
const badInit = run(["init", "--lang", "fr", "--project", esSub]);
const badCreate = run(["create", "Zed", "--lang=portugues", "--project", esSub]);
const badRoad = run(["roadmap", "--write", "--lang", "spanish", "--project", esSub]);
const badSteer = run(["steering", "product2.md", "--lang", "br", "--project", esSub]);
const upCreate = run(["create", "Yak", "--lang", "PT", "--project", esSub]);
ok(badInit.code === 1 && /Argumento\(s\) no válido\(s\): --lang debe ser uno de: en, pt, es \(recibido: "fr"\)/.test(badInit.out) && esRm().meta.lang === "es" &&
  badCreate.code === 1 && !fs.existsSync(path.join(esSub, ".specs", "zed")) && badRoad.code === 1 && !esRm().meta.roadmapLang &&
  badSteer.code === 1 && !fs.existsSync(path.join(esSub, ".specs", "steering", "product2.md")) &&
  upCreate.code === 0 && JSON.parse(fs.readFileSync(path.join(esSub, ".specs", "yak", ".state.json"), "utf8")).lang === "pt",
  "--lang outside en|pt|es is refused before anything is written (init keeps the project language; create/roadmap/steering write nothing); --lang PT = pt (got " + badInit.out.trim() + ")");

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
let brwJ = {}, brwFull = {};
try { brwJ = JSON.parse(run(["brief", "Invoice Summary", "2", "--write", "--json"]).out); brwFull = JSON.parse(run(["brief", "Invoice Summary", "2", "--write", "--include-brief", "--json"]).out); } catch { /* stays {} */ }
ok(brwJ.ok === true && brwJ.paths && brwJ.refs && Array.isArray(brwJ.refs.acs) && !("acceptanceCriteria" in brwJ) && !("steering" in brwJ) && !("brief" in brwJ) &&
  typeof brwFull.brief === "string" && Array.isArray(brwFull.acceptanceCriteria),
  "brief --write --json prints paths + identifiers (refs), no spec text — like spec_task_brief {write:true}; --include-brief prints everything");
ok(run(["brief", "Invoice Summary", "999"]).code === 1, "brief on a missing task exits non-zero");
// brief --write and metrics --write run under the feature lock (= spec_task_brief / spec_metrics {write}): a live holder →
// busy (exit 1), nothing written; the lock file is git-ignored by the .specs/.gitignore init wrote.
{
  const lockBw = path.join(tmp, ".specs", "invoice-summary", ".lock");
  fs.writeFileSync(lockBw, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString() }));
  const env = { ...process.env, SPEC_PROJECT_DIR: tmp, DEV_SPEC_LOCK_WAIT_MS: "60" };
  const briefBusy = spawnSync(process.execPath, [CLI, "brief", "Invoice Summary", "3", "--write", "--json"], { encoding: "utf8", env });
  const metricsBusy = spawnSync(process.execPath, [CLI, "metrics", "Invoice Summary", "--write"], { encoding: "utf8", env });
  let bj = {};
  try { bj = JSON.parse(briefBusy.stdout); } catch { /* stays {} */ }
  fs.rmSync(lockBw, { force: true });
  ok(briefBusy.status === 1 && bj.ok === false && bj.busy === true && /Another dev-spec process is updating 'invoice-summary' right now/.test(bj.error || "") &&
    metricsBusy.status === 1 && /Another dev-spec process is updating 'invoice-summary'/.test((metricsBusy.stdout || "") + (metricsBusy.stderr || "")) &&
    !fs.existsSync(path.join(tmp, ".specs", "invoice-summary", ".execution", "task-3-brief.md")) && !fs.existsSync(path.join(tmp, ".specs", "invoice-summary", "retro.md")) &&
    /^\.lock$/m.test(fs.readFileSync(path.join(tmp, ".specs", ".gitignore"), "utf8")) && /^\.roadmap\.lock$/m.test(fs.readFileSync(path.join(tmp, ".specs", ".gitignore"), "utf8")),
    "brief --write / metrics --write wait on a held feature lock and answer busy (exit 1, nothing written); init wrote .specs/.gitignore for the lock files (got " +
    JSON.stringify([briefBusy.status, bj.busy, metricsBusy.status]) + ")");
}

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
// An anchored _Implements:_ (path:12 / #L12) names the same file as its bare path: a shared file ends the batch (= MCP).
run(["create", "Anchor", "core", "--project", vp]);
fs.writeFileSync(path.join(vp, ".specs", "anchor", "tasks.md"), "- [ ] 1. [US1][P] a\n  - _Implements: src/payment.js:10_\n- [ ] 2. [US1][P] b\n  - _Implements: src/payment.js#L50_\n");
const anB = run(["next", "anchor", "--batch", "--project", vp]);
let anBJ = null;
try { anBJ = JSON.parse(run(["next", "anchor", "--batch", "--json", "--project", vp]).out); } catch { /* invalid JSON */ }
ok(anB.code === 0 && /Next → #1/.test(anB.out) && !/#2 \[/.test(anB.out) && anBJ && anBJ.batch.map((b) => b.number).join() === "1",
  "next --batch: `src/payment.js:10` and `src/payment.js#L50` are one file — task 2 never joins the batch (got " + JSON.stringify(anB.out.slice(0, 160)) + ")");
const bfx = run(["bugfix", "Login Loop", "--summary", "bounce to /login", "--project", vp]);
ok(/login-loop/.test(bfx.out) && fs.existsSync(path.join(vp, ".specs", "login-loop", "bug.md")), "bugfix scaffolds the systematic-debugging flow");
const fin = run(["finish", "login-loop", "--project", vp]);
ok(fin.code === 1 && /fix\(login-loop\): bounce to \/login/.test(fin.out) && /Root Cause is not filled/.test(fin.out), "finish exits 1 while blocked and prints the merge summary from the spec");
} // section main

if (inSection("wp1")) {
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
// No runnable _Verify:_ and nothing recorded: verified (doctor's verdict — never verified:false without a reason), flagged
// nothingToVerify, so the human line never says "(verified)" for a task nothing checked (w1P2 above).
const w1J = run(["done", "pad", "3", "--json", "--project", w1p]);
const w1Jr = (() => { try { return JSON.parse(w1J.out); } catch { return {}; } })();
ok(w1J.code === 0 && w1Jr.verified === true && w1Jr.nothingToVerify === true && w1Jr.unverifiedReason === undefined && w1Jr.note === undefined,
  "done --json on a task with no _Verify:_ and no evidence: verified + nothingToVerify, no unverifiedReason (the human line prints no '(verified)')");
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
// Windows' default shell (cmd.exe) has no single quotes: `node -e 'process.exit(1)'` exits 0 there, so a _Verify:_ written for a
// POSIX shell is refused before anything runs (unless --shell / DEV_SPEC_SHELL picks one) — never a false "verified".
run(["create", "Posix", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "posix", "tasks.md"), "- [ ] 1. q\n  - _Verify: node -e 'process.exit(1)'_\n");
const w1Px = run(["done", "posix", "1", "--run", "--project", w1p]);
const w1PxState = () => JSON.parse(fs.readFileSync(path.join(w1p, ".specs", "posix", ".state.json"), "utf8"));
if (process.platform === "win32") {
  run(["create", "Plicas", "core", "--lang", "pt", "--project", w1p]);
  fs.writeFileSync(path.join(w1p, ".specs", "plicas", "tasks.md"), "- [ ] 1. q\n  - _Verify: echo $HOME_\n");
  const w1PxPt = run(["done", "plicas", "1", "--run", "--project", w1p]);
  const w1PxOpen = /- \[ \] 1\. q/.test(w1Read("posix")) && !(w1PxState().evidence || {})["1"]; // before --shell cmd ticks it
  const w1PxCmd = run(["done", "posix", "1", "--run", "--shell", "cmd", "--project", w1p]);
  ok(w1Px.code === 1 && /uses POSIX shell syntax \(single quotes/.test(w1Px.out) && /--shell bash/.test(w1Px.out) && !/^\$ node/m.test(w1Px.out) &&
    w1PxOpen && w1PxPt.code === 1 && /usa sintaxe de shell POSIX \(\$VARIAVEIS\)/.test(w1PxPt.out) &&
    w1PxCmd.code === 0 && /^\$ node -e 'process\.exit\(1\)'/m.test(w1PxCmd.out),
    "Windows: done --run refuses a POSIX-quoted _Verify:_ under the default cmd.exe (nothing run, task open, no evidence; localized); --shell cmd runs it anyway");
} else {
  ok(w1Px.code === 1 && /process\.exit\(1\)/.test(w1Px.out) && /- \[ \] 1\. q/.test(w1Read("posix")) && w1PxState().evidence["1"].exitCode === 1,
    "POSIX: done --run runs a single-quoted _Verify:_ under /bin/sh as written (a failing check fails)");
}
run(["create", "Tarefas", "core", "--lang", "pt", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "tarefas", "tasks.md"), "- [ ] 1. um\n- [ ] 2. dois\n");
const w1Pt = run(["done", "tarefas", "1", "--project", w1p]);
ok(/Tarefa 1 feita\. 1\/2\s+próxima → #2 dois/.test(w1Pt.out) && /tem de ser um inteiro/.test(run(["done", "tarefas", "x", "--project", w1p]).out) &&
  /já estava feita/.test(run(["done", "tarefas", "1", "--project", w1p]).out), "done output and refusals follow the feature language (PT)");
// A `_Verify:_` inside a fenced example under a task is documentation, never the task's command: done --run refuses
// (noRunnable) and runs nothing.
run(["create", "Fenced", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "fenced", "tasks.md"), "- [ ] 1. Document the task markers in the README\n  ```md\n  - [ ] 9. Example task\n" +
  "    - _Verify: node -e \"require('fs').writeFileSync('FENCED-VERIFY-RAN.txt','x')\"_\n  ```\n");
const w1Fence = spawnSync(process.execPath, [CLI, "done", "fenced", "1", "--run", "--project", w1p], { encoding: "utf8", cwd: w1p });
ok(w1Fence.status === 1 && /task 1 has no runnable _Verify: <command>_ marker/.test(w1Fence.stderr) && !fs.existsSync(path.join(w1p, "FENCED-VERIFY-RAN.txt")) &&
  /- \[ \] 1\. Document/.test(w1Read("fenced")), "done --run never executes a _Verify:_ from a fenced example under the task (noRunnable, nothing ran, task open)");
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
} // section wp1

if (inSection("wp2")) { // 1.13 WP2 — track input, add-track --remove, status marks (own block scope)
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
  ok(/Secções de escala: ◐ Orçamento de Desempenho \(por preencher\)/.test(ptSt) && !/Scale sections/.test(ptSt) && !/✓/.test(ptSt.split("Secções de escala:")[1] || "✓") && ptRm.code === 0 && /Tracks desativados: \+saas/.test(ptRm.out),
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

if (inSection("wp3")) { // 1.13 WP3: depend parity with the MCP tool, one default approver, own-key lookups
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

if (inSection("wp4")) {
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
// Enum-like arguments are case-folded like the MCP enums (spec_backlog {action: 'ADD'} adds): same input, same result.
const blUp = run(["backlog", "ADD", "Later", "--project", w4]);
const apUp = run(["approve", "gaps", "Design", "--force", "--project", w4]);
ok(blUp.code === 0 && /Later/.test(blUp.out) && /Backlog \(1\)/.test(blUp.out) && /removed from the backlog/.test(run(["backlog", "RM", "later", "--project", w4]).out) &&
  apUp.code === 0 && /Approved 'design' for gaps/.test(apUp.out), "CLI backlog ADD / RM and approve <f> Design are case-insensitive (parity with the MCP enums)");

// feature remove without --yes shows what would be deleted and exits 1; --yes deletes.
run(["create", "Doomed", "core", "--project", w4]);
const frm = run(["feature", "remove", "doomed", "--project", w4]);
let frmJ = null;
try { frmJ = JSON.parse(run(["feature", "remove", "doomed", "--json", "--project", w4]).out); } catch { /* invalid JSON */ }
ok(frm.code === 1 && /Would permanently delete 'doomed'/.test(frm.out) && /requirements\.md/.test(frm.out) && /--yes/.test(frm.out) &&
  frmJ && frmJ.needsConfirm === true && fs.existsSync(path.join(w4, ".specs", "doomed")), "feature remove without --yes deletes nothing, lists what it would delete, exits 1");
// No hidden aliases: `feature delete` and `backlog remove` are refused like the MCP enums (spec_feature / spec_backlog)
// refuse them — exit 1, nothing deleted.
run(["backlog", "add", "Zeta", "--project", w4]);
const fdel = run(["feature", "delete", "doomed", "--yes", "--project", w4]);
const brem = run(["backlog", "remove", "Zeta", "--project", w4]);
ok(fdel.code === 1 && /remove \| archive \| rename \| restore/.test(fdel.out) && fs.existsSync(path.join(w4, ".specs", "doomed")) &&
  brem.code === 1 && /add, rm, list/.test(brem.out) && /Zeta/.test(run(["backlog", "--project", w4]).out),
  "feature delete / backlog remove are not aliases: exit 1 and change nothing, as over MCP (got " + JSON.stringify([fdel.code, brem.code]) + ")");
run(["backlog", "rm", "Zeta", "--project", w4]);
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
} // section wp4

if (inSection("wp5")) { // 1.13 WP5 — gates on the CLI: approve (refused / --force / nothing to approve), next-action order, bugfix gate, planned files
  const w5 = path.join(tmp, "wp5-proj");
  run(["init", "core", "--project", w5]);
  run(["create", "Gate", "core", "--project", w5]);
  const stateOf = (f) => JSON.parse(fs.readFileSync(path.join(w5, ".specs", f, ".state.json"), "utf8"));
  const naFresh = run(["next-action", "gate", "--project", w5]).out;
  const refused = run(["approve", "gate", "requirements", "--project", w5]);
  ok(refused.code === 1 && /Can't approve 'requirements' for 'gate' — failing checks: phase-order, placeholders, success-criteria, priorities/.test(refused.out) &&
    /✗ phase-order — earlier phases are not approved yet: classification — approve them first, in order \(\/approve gate classification\)/.test(refused.out) &&
    /✗ placeholders — requirements\.md \(\d+\): requirements\.md:4 /.test(refused.out) && /--force/.test(refused.out) && !stateOf("gate").approvals.requirements,
    "approve on a template exits 1 listing the failing checks — the unapproved classification before it (phase-order) too (nothing recorded)");
  run(["approve", "gate", "classification", "--force", "--project", w5]);
  const naReq = run(["next-action", "gate", "--project", w5]).out;
  ok(/→ Fill classification\.md — \d+ template placeholder\(s\) left .*\/classify gate/.test(naFresh) && /→ Fill requirements\.md — \d+ template placeholder\(s\) left .*\/clarify gate/.test(naReq),
    "next-action phase by phase: a fresh feature fills classification.md first (/classify), then — once approved — requirements.md (/clarify)");
  const forced = run(["approve", "gate", "requirements", "--force", "--project", w5]);
  let forcedJ = null;
  try { forcedJ = JSON.parse(run(["approve", "gate", "design", "--force", "--json", "--project", w5]).out); } catch { /* invalid JSON */ }
  ok(forced.code === 0 && /Approved 'requirements' for gate ✓/.test(forced.out) && /⚠ Approved with force — the failing checks are recorded with the approval: placeholders, success-criteria, priorities\./.test(forced.out) &&
    stateOf("gate").approvals.requirements.forced === true && forcedJ && forcedJ.forced === true && forcedJ.failing.includes("placeholders"),
    "approve --force records a flagged approval (⚠ note; --json forced + failing)");
  const nothing = run(["approve", "gate", "eval-plan", "--force", "--project", w5]);
  ok(nothing.code === 1 && /Nothing to approve: 'eval-plan'/.test(nothing.out), "approve of a phase with no artifact exits 1 even with --force");
  const docG = run(["doctor", "gate", "--project", w5]);
  ok(/✗ placeholders — template placeholders left/.test(docG.out) && /▲ approval-gates — .*approved with force over failing checks: classification \(placeholders\), requirements \(placeholders/.test(docG.out),
    "doctor lists the placeholders failure and the forced approvals (warn)");
  ok(/→ Fill tasks\.md — \d+ template placeholder\(s\) left .*\/createTask gate/.test(run(["next-action", "gate", "--project", w5]).out),
    "next-action after the design approval: the tasks are the next phase (fill tasks.md)");
  ok(/approve <feature> <phase> \[--force\]/.test(run(["help"]).out) && /--by NAME \/ --force \(approve\)/.test(run(["help"]).out), "help documents approve --force");

  // PT: refusal, forced note and next-action are localized
  const p5 = path.join(tmp, "wp5-pt");
  run(["init", "core", "--lang", "pt", "--project", p5]);
  run(["create", "Pagamentos", "core", "--project", p5]);
  const ptRef = run(["approve", "pagamentos", "requirements", "--project", p5]);
  const ptForce = run(["approve", "pagamentos", "requirements", "--force", "--project", p5]);
  ok(ptRef.code === 1 && /Não é possível aprovar 'requirements' de 'pagamentos' — verificações a falhar: phase-order, placeholders/.test(ptRef.out) &&
    /há fases anteriores ainda por aprovar: classification/.test(ptRef.out) &&
    ptForce.code === 0 && /Fase 'requirements' de pagamentos aprovada ✓/.test(ptForce.out) && /⚠ Aprovado com force — as verificações a falhar ficam registadas/.test(ptForce.out) &&
    /→ Preenche classification\.md — \d+ placeholder\(s\) do template por preencher/.test(run(["next-action", "pagamentos", "--project", p5]).out),
    "approve refusal (phase-order included) / --force note / next-action speak the feature language (PT)");

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
  // A core-only feature: the Signals line is the tool's answer ("- none beyond core"), so filling Blast Radius and
  // Compliance is enough — approve classification exits 0 (1.13 used to refuse it on its own "[none beyond core]").
  run(["create", "Stock alerts", "--summary", "Alert when stock is low", "--project", w5]);
  const clsFile = path.join(w5, ".specs", "stock-alerts", "classification.md");
  fs.writeFileSync(clsFile, fs.readFileSync(clsFile, "utf8").replace(/^\[What breaks[^\n]*\]$/m, "A missed alert delays a restock by a day; recoverable.").replace(/^\[GDPR \| PCI[^\n]*\]$/m, "none"));
  const clsAp = run(["approve", "stock-alerts", "classification", "--project", w5]);
  ok(/^- none beyond core$/m.test(fs.readFileSync(clsFile, "utf8")) && clsAp.code === 0 && /Approved 'classification' for stock-alerts ✓/.test(clsAp.out),
    "approve classification of a core-only feature with its real slots filled exits 0 ('- none beyond core' is no placeholder)");
  // The gates next-action / doctor / finish follow: a bugfix's design gate is due on bug.md; +tdd adds Phase 4 (`tests`).
  run(["create", "Tdd gate", "tdd", "--project", w5]);
  let docCrash = null, docTdd = null;
  try { docCrash = JSON.parse(run(["doctor", "crash", "--json", "--project", w5]).out); docTdd = JSON.parse(run(["doctor", "tdd-gate", "--json", "--project", w5]).out); } catch { /* invalid JSON */ }
  ok(docCrash && docCrash.pendingGates.join() === "requirements,design,test-plan,tasks" && docTdd && docTdd.pendingGates.join() === "classification,requirements,design,test-plan,tests,tasks",
    "doctor --json: a bugfix's design gate (bug.md) and a +tdd feature's Phase 4 gate (tests) are pending like the MCP (got " + (docCrash ? docCrash.pendingGates.join() : "?") + " / " + (docTdd ? docTdd.pendingGates.join() : "?") + ")");
}

if (inSection("wp6")) { // 1.13 WP6 — scan sections, coverage by _Implements:_, import (Kiro · spec-kit · OpenSpec), create --brownfield (own block scope)
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

// 1.13 WP7: append-tasks <feature> --task … — one task per call, same engine call as spec_append_tasks.
if (inSection("wp7")) {
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

if (inSection("wp8")) { // 1.13 WP8 — change requests (impact / --reopen) and metrics (+ retro.md) on the CLI, EN and PT
  const S8 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const w8 = path.join(tmp, "wp8-proj");
  run(["init", "tdd", "--project", w8]);
  run(["create", "Drafts", "tdd", "--project", w8]);
  const d8 = (x) => path.join(w8, ".specs", "drafts", x);
  const req8 = ["# Feature: Drafts", "", "## Summary", "Save drafts.", "", "### US-1 (P1 — MVP): Save drafts", "", "#### Acceptance Criteria (EARS)",
    "1. **US-1.AC-1** — WHEN a user saves THE SYSTEM SHALL store the draft", "2. **US-1.AC-2** — WHEN the parser meets a BOM THE SYSTEM SHALL skip it", ""].join("\r\n");
  fs.writeFileSync(d8("requirements.md"), req8);
  fs.writeFileSync(d8("design.md"), "# Design: Drafts\n\n## Parser\nSkips a BOM (US-1.AC-2).\n");
  fs.writeFileSync(d8("test-plan.md"), "| Test ID | Covers |\n|---|---|\n| T-01 | US-1.AC-1 |\n| T-02 | US-1.AC-2 |\n");
  fs.writeFileSync(d8("tasks.md"), "# Tasks\r\n\r\n## Story US-1\r\n- [x] 1. [US1] Store drafts\r\n  - _Requirements: US-1.AC-1_\r\n- [x] 2. [US1] Skip the BOM\r\n  - _Requirements: US-1.AC-2_\r\n");
  const ap8 = run(["approve", "drafts", "requirements", "--force", "--project", w8]);
  fs.writeFileSync(d8("requirements.md"), req8.replace("SHALL skip it", "SHALL strip it"));
  const im8 = run(["impact", "drafts", "--project", w8]);
  let im8j = null;
  try { im8j = JSON.parse(run(["impact", "drafts", "--json", "--project", w8]).out); } catch { /* invalid JSON */ }
  ok(ap8.code === 0 && im8.code === 0 && /Impact: drafts · requirements — against the approval of \d{4}-\d\d-\d\d \(\.history\/requirements@1\.md\)/.test(im8.out) &&
    im8.out.includes("~ US-1.AC-2  WHEN the parser meets a BOM THE SYSTEM SHALL strip it") && im8.out.includes("US-1.AC-2 (modified) — tasks: #2 [x] nothing to verify (no _Verify:_ command, nothing recorded) · tests: T-02 · design: Parser") &&
    /--reopen/.test(im8.out) && im8j && JSON.stringify(im8j) === JSON.stringify(S8.impactReport(w8, "drafts", {})),
    "impact prints the diff against the approved snapshot and what it reaches; --json = spec_impact (same engine call)");
  ok(/First see what the edit touches with spec_impact \(dev-spec impact drafts --phase requirements\)/.test(run(["next-action", "drafts", "--project", w8]).out) &&
    /▲ changed-since-approval — changed after their approval: requirements\.md/.test(run(["doctor", "drafts", "--project", w8]).out),
    "next-action recommends impact before re-approval; doctor shows the changed-since-approval warn");
  ok(/changed-since-approval — .*\(dev-spec impact drafts --phase requirements\)/.test(run(["doctor", "drafts", "--project", w8]).out),
    "doctor's changed-since-approval hint names the phase to pass to impact");
  const ro8 = run(["impact", "drafts", "--reopen", "--project", w8]);
  const ro8b = run(["impact", "drafts", "--reopen", "--project", w8]);
  ok(ro8.code === 0 && /Reopened #2: unticked, their evidence marked stale/.test(ro8.out) && fs.readFileSync(d8("tasks.md"), "utf8").includes("- [x] 1. [US1] Store drafts\r\n") &&
    fs.readFileSync(d8("tasks.md"), "utf8").includes("- [ ] 2. [US1] Skip the BOM\r\n") && ro8b.code === 0 && /Nothing new since the last reopen/.test(ro8b.out),
    "impact --reopen unticks the affected done task (CRLF kept); a second --reopen changes nothing");
  const bad8 = [["impact", "drafts", "--phase", "design"], ["impact", "drafts", "--phase", "plan"], ["impact", "drafts", "--phase"], ["impact", "drafts", "--phase", "tasks", "--reopen"], ["impact"]]
    .map((a) => run(a.concat(["--project", w8])));
  ok(bad8.every((r) => r.code === 1) && /'design' was never approved for 'drafts'/.test(bad8[0].out) && /Unknown phase 'plan'/.test(bad8[1].out) && /missing value for --phase/.test(bad8[2].out) &&
    /requirements and design only/.test(bad8[3].out) && /usage: dev-spec impact/.test(bad8[4].out), "impact: never approved / unknown phase / missing --phase value / reopen on tasks / no feature → exit 1 with a clear message");
  const m8 = run(["metrics", "drafts", "--project", w8]);
  let m8j = null;
  try { m8j = JSON.parse(run(["metrics", "drafts", "--json", "--project", w8]).out); } catch { /* invalid JSON */ }
  ok(m8.code === 0 && /^Metrics: drafts \[core \+tdd\] — created \d{4}-\d\d-\d\d\n/.test(m8.out) && /lead time from creation: requirements /.test(m8.out) && /change requests: 1 · reopened tasks: 1/.test(m8.out) &&
    m8j && m8j.scope === "feature" && m8j.changeRequests === 1 && m8j.createdAtApproximate === false, "metrics <feature>: lead times, change requests, reopened tasks (--json = spec_metrics)");
  const mw8 = run(["metrics", "drafts", "--write", "--project", w8]);
  const retro8 = fs.readFileSync(d8("retro.md"), "utf8");
  const mw8b = run(["metrics", "drafts", "--write", "--project", w8]);
  const mp8 = run(["metrics", "--project", w8]);
  const mpw8 = run(["metrics", "--write", "--project", w8]);
  ok(mw8.code === 0 && /Retrospective → \.specs\/drafts\/retro\.md/.test(mw8.out) && retro8.startsWith("# Retrospective: drafts") && retro8.includes("## Follow-ups") &&
    mw8b.code === 0 && /already exists — left untouched/.test(mw8b.out) && fs.readFileSync(d8("retro.md"), "utf8") === retro8 &&
    mp8.code === 0 && /^Metrics — 1 feature\(s\)/.test(mp8.out) && /\n {2}average /.test(mp8.out) && /\n {2}median /.test(mp8.out) && mpw8.code === 1 && /write needs a feature name/.test(mpw8.out),
    "metrics --write creates retro.md once (then says it exists); metrics (project) prints rows + average/median; metrics --write without a feature exits 1");
  // PT project: the same commands in European Portuguese.
  const p8 = path.join(tmp, "wp8-pt");
  run(["init", "core", "--lang", "pt", "--project", p8]);
  run(["create", "Rascunhos", "core", "--project", p8]);
  const pd8 = (x) => path.join(p8, ".specs", "rascunhos", x);
  const preq8 = "# Funcionalidade: Rascunhos\n\n## Resumo\nGuardar.\n\n### US-1 (P1 — MVP): Guardar\n\n#### Critérios de Aceitação (EARS)\n1. **US-1.AC-1** — QUANDO o utilizador guarda O SISTEMA DEVE guardar o rascunho\n";
  fs.writeFileSync(pd8("requirements.md"), preq8);
  fs.writeFileSync(pd8("design.md"), "# Design\n\n## Modelo\nPor id (US-1.AC-1).\n");
  fs.writeFileSync(pd8("tasks.md"), "# Tarefas\n\n## US-1\n- [x] 1. [US1] Guardar\n  - _Requirements: US-1.AC-1_\n");
  run(["approve", "rascunhos", "requirements", "--force", "--project", p8]);
  fs.writeFileSync(pd8("requirements.md"), preq8.replace("o rascunho", "o rascunho cifrado"));
  const pim8 = run(["impact", "rascunhos", "--project", p8]);
  const pmw8 = run(["metrics", "rascunhos", "--write", "--project", p8]);
  ok(/Impacto: rascunhos · requirements — face à aprovação de/.test(pim8.out) && /Afetado:/.test(pim8.out) && /tarefas: #1 \[x\] nada a verificar \(sem comando _Verify:_, nada registado\)/.test(pim8.out) &&
    /Vê primeiro o que a edição afeta com spec_impact/.test(run(["na", "rascunhos", "--project", p8]).out) && /^Métricas: rascunhos \[core\] — criada a /.test(pmw8.out) &&
    /Retrospetiva → \.specs\/rascunhos\/retro\.md/.test(pmw8.out) && fs.readFileSync(pd8("retro.md"), "utf8").startsWith("# Retrospetiva: rascunhos") &&
    /nunca foi aprovada/.test(run(["impact", "rascunhos", "--phase", "design", "--project", p8]).out), "impact / next-action / metrics --write / errors (PT) are in European Portuguese");
  run(["create", "Nova", "core", "--project", p8]);
  const pn8 = run(["metrics", "nova", "--project", p8]);
  ok(pn8.code === 0 && pn8.out.includes("  aprovações: 0 · retrabalho: 0 · forçadas: 0") && !/desconhecido/.test(pn8.out),
    "metrics on a feature never approved: rework 0, not unknown (PT)");
  // impact --reopen with nothing changed says so (no reopen preceded it); a bugfix's design.md edit is diffed by --phase design.
  run(["create", "Plain", "core", "--project", w8]);
  run(["approve", "plain", "requirements", "--force", "--project", w8]);
  const pr8 = run(["impact", "plain", "--reopen", "--project", w8]);
  ok(pr8.code === 0 && pr8.out.includes("no changes since the approval") && pr8.out.includes("Nothing changed since the approval — nothing to reopen.") && !/Nothing new since the last reopen/.test(pr8.out),
    "impact --reopen right after the approval: 'nothing changed — nothing to reopen', never 'nothing new since the last reopen'");
  run(["bugfix", "Slow page", "saas", "--project", w8]);
  const sa8 = run(["approve", "slow-page", "design", "--force", "--project", w8]);
  const sd8 = path.join(w8, ".specs", "slow-page", "design.md");
  fs.writeFileSync(sd8, fs.readFileSync(sd8, "utf8").replace(/(## \[SaaS\] Performance Budget[^\n]*\n)/, "$1p95 under 200 ms\n"));
  const bi8 = run(["impact", "slow-page", "--phase", "design", "--project", w8]);
  ok(sa8.code === 0 && bi8.code === 0 && bi8.out.includes("  ~ design.md: [SaaS] Performance Budget") && bi8.out.includes(".history/design@1.design.md") && !bi8.out.includes("no changes since the approval"),
    "impact --phase design on a bugfix +saas lists the edited design.md section (its design approval snapshots design.md too)");
  const help8 = run(["help"]).out;
  const doc8 = fs.readFileSync(CLI, "utf8").split("*/")[0];
  const after8 = (t) => { const a = t.indexOf("approve <feature> <phase>"), i = t.indexOf("impact <feature>"), m = t.indexOf("metrics [feature]"); return a !== -1 && i > a && m > i && m < t.indexOf("add-track <feature>"); };
  ok(after8(help8) && after8(doc8) && ["--phase", "--reopen", "--write"].every((x) => help8.includes(x) && doc8.includes(x)),
    "help and the header docblock list impact + metrics right after approve, with --phase / --reopen / --write");
  // --reopen never unticks a REMOVED criterion's tasks (retire lists them) — help said it unticks "the affected done tasks", full stop.
  const reopenDoc8 = (t) => { const i = t.indexOf("impact <feature>"); return t.slice(i, t.indexOf("metrics [feature]", i)).replace(/\s+/g, " "); };
  ok([help8, doc8].every((t) => /--reopen unticks the affected done tasks.*never a removed criterion's.*retire`? lists/.test(reopenDoc8(t))),
    "help and the header docblock: --reopen never unticks a removed criterion's tasks — retire lists them");
}

if (inSection("wp9")) { // --- 1.13 WP9: trace prints the EC/NFR/SC warnings (exit code unchanged); --code scans test files; finish lists warnings ---
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
  // The scaffold's own load row (`load-test.md`) is run outside test code: once its load task is done (k6 evidence),
  // doctor raises no tests-in-code warning, finish's planned-not-in-code warning leaves T-07 out, trace --code lists it apart.
  const o9 = path.join(tmp, "wp9-outside");
  run(["init", "tdd", "saas", "--project", o9]);
  run(["create", "Tenant billing", "tdd", "saas", "--project", o9]);
  const o9n = (fs.readFileSync(path.join(o9, ".specs", "tenant-billing", "tasks.md"), "utf8").match(/- \[ \] (\d+)\.[^\n]*\n(?:[ \t]+[^\n]*\n)*?[ \t]+- _Makes green: T-07_/) || [])[1];
  const o9done = run(["done", "tenant-billing", String(o9n), "--evidence", "k6: p95=142ms", "--exit", "0", "--cmd", "k6 run load/invoice.k6.js", "--project", o9]);
  const o9doc = run(["doctor", "tenant-billing", "--project", o9]);
  const o9fin = run(["finish", "tenant-billing", "--project", o9]);
  const o9tr = run(["trace", "tenant-billing", "--code", "--project", o9]);
  ok(o9n && o9done.code === 0 && !/tests-in-code/.test(o9doc.out) && /planned tests that no test file names[^\n]*T-06/.test(o9fin.out) && !/planned tests that no test file names[^\n]*T-07/.test(o9fin.out) &&
    /tests in code: 0\/6 planned T-ID\(s\) named in 0 test file\(s\) · checked outside test code \(the File column names a non-code artifact\): T-07/.test(o9tr.out),
    "the scaffold's load-test.md row (T-07) is checked outside test code: a done load task leaves no tests-in-code warning (doctor, finish); trace --code lists it apart (got " + o9tr.out + ")");
}

if (inSection("wp10")) {
// 1.13 WP10: catalog (SPECS.md), _Supersedes:_ warnings in trace, feature restore, drift since finish — CLI = MCP.
const S10 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
const w10 = path.join(tmp, "wp10-proj");
const w10s = path.join(w10, ".specs");
const r10 = (args) => run([...args, "--project", w10]);
run(["init", "core", "--project", w10]);
["Billing", "Billing v2", "Accounts"].forEach((n) => r10(["create", n, "core"]));
const req10 = (f, body) => fs.writeFileSync(path.join(w10s, f, "requirements.md"), "# Requirements\n\n## Summary\n" + f + ".\n\n### US-1 (P1)\n\n#### Acceptance Criteria (EARS)\n" + body);
req10("billing", "1. **US-1.AC-1** — WHEN a user pays THE SYSTEM SHALL store the receipt\n2. **US-1.AC-2** — WHEN a refund is asked THE SYSTEM SHALL refund within 30 days\n");
req10("billing-v2", "1. **US-1.AC-1** — WHEN a refund is asked THE SYSTEM SHALL refund within 14 days _Supersedes: billing/US-1.AC-2, nope/US-1.AC-1_\n");
fs.writeFileSync(path.join(w10s, "billing-v2", "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Refund in 14 days\n  - _Requirements: US-1.AC-1_\n");
const tr10 = r10(["trace", "billing-v2"]);
ok(tr10.code === 0 && /verdict=pass/.test(tr10.out) && /⚠ _Supersedes:_ nope\/US-1\.AC-1 \(on US-1\.AC-1\) — no such feature \(active or archived\)/.test(tr10.out),
  "trace prints a phantom _Supersedes:_ as a warning — not a gap, the exit code stays 0");

// catalog: prints the markdown; --json = spec_catalog; --write → SPECS.md; a hand-written SPECS.md is never overwritten.
const cat10 = r10(["catalog"]);
let catJ = null;
try { catJ = JSON.parse(r10(["catalog", "--json"]).out); } catch { /* invalid JSON */ }
ok(cat10.code === 0 && /^# Spec catalog — wp10-proj/m.test(cat10.out) && cat10.out.includes("~~**US-1.AC-2** — WHEN a refund is asked THE SYSTEM SHALL refund within 30 days~~ — superseded by `billing-v2/US-1.AC-1`") &&
  !fs.existsSync(path.join(w10s, "SPECS.md")) && catJ && JSON.stringify(catJ.features) === JSON.stringify(S10.catalog(w10).features) && catJ.totals.superseded === 1,
  "catalog prints the living catalog (superseded ACs struck through); --json matches spec_catalog; nothing written");
const catW10 = r10(["catalog", "--write"]);
const specs10 = path.join(w10s, "SPECS.md");
ok(catW10.code === 0 && /✎ wrote .*SPECS\.md {2}\(3 feature\(s\), \d+ AC\(s\), 1 superseded\)/.test(catW10.out) && /AUTO-GENERATED by dev-spec/.test(fs.readFileSync(specs10, "utf8")),
  "catalog --write writes .specs/SPECS.md with the AUTO-GENERATED marker");
fs.writeFileSync(specs10, "# mine\n");
const catG10 = r10(["catalog", "--write"]);
ok(catG10.code === 1 && /SPECS\.md exists and was not generated by dev-spec/.test(catG10.out) && fs.readFileSync(specs10, "utf8") === "# mine\n",
  "catalog --write over a hand-written SPECS.md exits 1 and leaves it untouched");
fs.unlinkSync(specs10);

// feature restore: archive → restore round-trip keeps the dependencies.
r10(["depend", "billing-v2", "billing", "accounts"]);
const rmBefore10 = fs.readFileSync(path.join(w10s, "roadmap.json"), "utf8");
const arch10c = r10(["feature", "archive", "billing"]);
const rest10 = r10(["feature", "restore", "Billing"]);
ok(arch10c.code === 0 && /Archived 'billing' → \.specs\/_archive\/billing ✓\n {2}⚠ 'billing' was not complete \(\d+%\), yet billing-v2 depended on it: the roadmap no longer shows them blocked by it/.test(arch10c.out) &&
  rest10.code === 0 && /Restored 'billing' from \.specs\/_archive\/ ✓/.test(rest10.out) && JSON.parse(fs.readFileSync(path.join(w10s, "roadmap.json"), "utf8")).features["billing-v2"].dependsOn.join() === "billing,accounts" &&
  JSON.stringify(JSON.parse(rmBefore10).features["billing-v2"]) === JSON.stringify(JSON.parse(fs.readFileSync(path.join(w10s, "roadmap.json"), "utf8")).features["billing-v2"]),
  "feature archive warns that the unfinished feature's dependents now read as unblocked; feature restore brings it back with the dependsOn references archive pruned");
const rest2 = r10(["feature", "restore", "billing"]);
ok(rest2.code === 1 && /Nothing is archived as 'billing'/.test(rest2.out) && /restore/.test(r10(["feature"]).out), "feature restore of nothing archived exits 1; the usage names restore");
// archive → rename the dependent → restore: the dependency comes back under the new name (rename prints what it updated).
const w10rn = path.join(tmp, "wp10-rename");
run(["init", "core", "--project", w10rn]);
["Auth", "Billing"].forEach((n) => run(["create", n, "core", "--project", w10rn]));
run(["depend", "billing", "auth", "--project", w10rn]);
const arch10j = run(["feature", "archive", "auth", "--project", w10rn, "--json"]);
const arch10jr = (() => { try { return JSON.parse(arch10j.out); } catch { return {}; } })();
ok(arch10j.code === 0 && arch10jr.action === "archive" && JSON.stringify(arch10jr.dependentsPruned) === '["billing"]' && arch10jr.incompleteDependency === true && /yet billing depended on it/.test(arch10jr.note),
  "feature archive --json carries dependentsPruned + incompleteDependency + the note (= spec_feature)");
const ren10c = run(["feature", "rename", "billing", "payments", "--project", w10rn]);
const rest10c = run(["feature", "restore", "auth", "--project", w10rn]);
ok(ren10c.code === 0 && /Renamed 'billing' → 'payments' ✓\n {2}archive records updated to the new name .*: auth/.test(ren10c.out) && rest10c.code === 0 && !/Not restored/.test(rest10c.out) &&
  JSON.parse(fs.readFileSync(path.join(w10rn, ".specs", "roadmap.json"), "utf8")).features.payments.dependsOn.join() === "auth",
  "feature rename updates archived features' records (and says so) — restore then puts payments → auth back");

// drift: no baseline yet → a note, exit 0; a baseline + an edited implementing file → exit 1 with the file named.
const dr10 = r10(["drift"]);
ok(dr10.code === 0 && /No finished feature has a drift baseline yet/.test(dr10.out) && /no finish baseline yet: accounts, billing, billing-v2/.test(dr10.out), "drift without any baseline: a note + the unbaselined features, exit 0");
// A baseline on a feature whose tasks aren't all done (reworked after finish) is `reopened`: listed, never hashed, exit 0.
fs.mkdirSync(path.join(w10, "src"), { recursive: true });
fs.writeFileSync(path.join(w10, "src", "a.js"), "two\n");
const bSt = path.join(w10s, "billing", ".state.json");
const bStKeep = fs.readFileSync(bSt, "utf8");
fs.writeFileSync(bSt, JSON.stringify({ ...JSON.parse(bStKeep), finished: { at: "2026-01-02T03:04:05.000Z", files: { "src/a.js": "0".repeat(40) } } }, null, 2));
const drRe10 = r10(["drift", "billing"]);
ok(drRe10.code === 0 && /reopened since finish \(tasks open again — checked once finished again\): billing/.test(drRe10.out) && !/⚠/.test(drRe10.out) &&
  !/No finished feature has a drift baseline yet/.test(drRe10.out) && r10(["drift", "nope"]).code === 1,
  "drift <feature> on a baselined feature whose tasks are open again: listed as reopened, not drift (exit 0); an unknown feature exits 1");
// An unreadable .state.json is not "clean": named → error, project-wide → the error printed, exit 1.
fs.writeFileSync(bSt, "{ broken");
const drBad10 = r10(["drift", "billing"]);
const drBadAll10 = r10(["drift"]);
fs.writeFileSync(bSt, bStKeep);
ok(drBad10.code === 1 && /not valid JSON/.test(drBad10.out) && !/No finished feature has a drift baseline yet/.test(drBad10.out) &&
  drBadAll10.code === 1 && /billing\/\.state\.json is not valid JSON/.test(drBadAll10.out),
  "drift with an unreadable .state.json exits 1 (named or project-wide) and never claims 'no baseline yet'");

// finish --write on a READY feature records the drift baseline (and says so).
const w10f = path.join(tmp, "wp10-finish");
S10.initProject(w10f, ["tdd"]);
fs.mkdirSync(path.join(w10f, "src"), { recursive: true });
fs.writeFileSync(path.join(w10f, "src", "auth.js"), "fix\n");
const bf10 = S10.createFeature(w10f, "Login Loop", undefined, "users bounce back to /login", undefined, "en", "bugfix");
const fill10 = (rel, pairs) => { const fp = path.join(bf10.dir, rel); let t = fs.readFileSync(fp, "utf8"); pairs.forEach(([a, b]) => { t = t.split(a).join(b); }); fs.writeFileSync(fp, t); };
fill10("requirements.md", [["[the condition that triggers the bug]", "the refresh token has expired"], ["[the correct behavior]", "clear the session cookie before redirecting to /login"],
  ["[the neighbouring behavior that already worked]", "a login with a valid refresh token"], ["[nearby inputs that must keep working]", "a token that expires mid-request"]]);
fill10("test-plan.md", [["[unit/integration]", "integration"], ["`[path]`", "`tests/integration/auth.test.js`"]]);
fill10("tasks.md", [["[exact values the fix must respect — versions, limits, formats]", "Node >= 20"], ["_Verify: [full test suite command]_", "_Verify: npm test_\n  - _Implements: src/auth.js_"]]);
fill10("bug.md", [["[correct behavior]", "the dashboard opens"], ["[what happens — error message, output, log lines]", "302 back to /login in a loop"],
  ["> **TODO** — exact steps, input and environment that reproduce it every time.", "Log in with an expired refresh token."],
  ["> **TODO** — the cause, with evidence (stack trace, log, failing assertion, the change that introduced it). Not \"probably\".", "The refresh handler redirects before clearing the cookie (auth.js:88)."],
  ["[What changes and why it removes the root cause — one fix, not a bundle.]", "Clear the cookie before redirecting."]]);
[1, 2, 3].forEach((n) => S10.completeTask(w10f, "login-loop", n));
S10.completeTask(w10f, "login-loop", 4, { command: "npm test", exitCode: 0, summary: "42/42 passing" });
["requirements", "design", "test-plan", "tasks"].forEach((p) => S10.approvePhase(w10f, "login-loop", p));
const fin10 = run(["finish", "login-loop", "--write", "--project", w10f]);
const fin10State = JSON.parse(fs.readFileSync(path.join(bf10.dir, ".state.json"), "utf8"));
ok(fin10.code === 0 && /Drift baseline recorded: 1 implementing file\(s\)/.test(fin10.out) && Object.keys(fin10State.finished.files).join() === "src/auth.js" &&
  run(["drift", "--project", w10f]).code === 0, "finish --write on a ready feature records the drift baseline (and prints it); drift is then clean");
const finDay10 = fin10State.finished.at.slice(0, 10);
fs.writeFileSync(path.join(w10f, "src", "auth.js"), "fix\r\n");
const drClean = run(["drift", "login-loop", "--project", w10f]);
fs.writeFileSync(path.join(w10f, "src", "auth.js"), "two\n");
const drDirty = run(["drift", "login-loop", "--project", w10f]);
let drJ = null;
try { drJ = JSON.parse(run(["drift", "--json", "--project", w10f]).out); } catch { /* invalid JSON */ }
ok(drClean.code === 0 && new RegExp("✓ login-loop: 1 implementing file\\(s\\) unchanged since finish \\(" + finDay10 + "\\)").test(drClean.out) &&
  drDirty.code === 1 && new RegExp("⚠ login-loop: 1 of 1 implementing file\\(s\\) changed since finish \\(" + finDay10 + "\\)").test(drDirty.out) && /changed: src\/auth\.js/.test(drDirty.out) &&
  drJ && drJ.drifted.join() === "login-loop" && JSON.stringify(drJ) === JSON.stringify(S10.drift(w10f)),
  "drift <feature>: clean after finish (CRLF-normalized), exit 1 naming the changed file after an edit; --json = spec_drift");
// next-action on the finished feature: the drift and the decision, never "close the feature with /spec-finish" again; a
// re-finish names the drift its new baseline accepted; then next-action says finished (and asks for the sign-off).
const naDrift10 = run(["next-action", "login-loop", "--project", w10f]);
let naJ10 = null;
try { naJ10 = JSON.parse(run(["next-action", "login-loop", "--json", "--project", w10f]).out); } catch { /* invalid JSON */ }
const naEng10 = JSON.stringify(S10.nextAction(w10f, "login-loop"));
const refin10 = run(["finish", "login-loop", "--write", "--project", w10f]);
const naFin10 = run(["next-action", "login-loop", "--project", w10f]);
ok(naDrift10.code === 0 && new RegExp("→ 'login-loop' was finished on " + finDay10 + ", but 1 of 1 implementing file\\(s\\) changed since: src/auth\\.js").test(naDrift10.out) &&
  !/close the feature/.test(naDrift10.out) && naJ10 && naJ10.step === "drift" && JSON.stringify(naJ10) === naEng10 &&
  refin10.code === 0 && new RegExp("Replaced the baseline of " + finDay10 + ", in which 1 file\\(s\\) had drifted: src/auth\\.js").test(refin10.out) &&
  /→ 'login-loop' is finished \(\d{4}-\d\d-\d\d\) — its 1 implementing file\(s\) are unchanged since\. Sign it off: \/approve login-loop execution\./.test(naFin10.out),
  "next-action on a finished feature: 'drift' with the changed file (--json = spec_next_action); finish --write names the drift it accepts; then 'finished' + the execution sign-off");
// Work added after the finish (append-tasks with a new _Implements:_ file, tasks re-approved, done --run): next-action says
// finish it again (never "nothing left to do"), drift exits 1 naming why the baseline is stale — audit.js was never hashed.
run(["append-tasks", "login-loop", "--task", "Audit log of logins", "--req", "US-1.AC-1", "--implements", "src/audit.js", "--verify", "node -e process.exit(0)", "--project", w10f]);
fs.writeFileSync(path.join(w10f, "src", "audit.js"), "audit\n");
const apT10 = run(["approve", "login-loop", "tasks", "--project", w10f]);
const done5 = run(["done", "login-loop", "5", "--run", "--project", w10f]);
const naSt10 = run(["next-action", "login-loop", "--project", w10f]);
fs.appendFileSync(path.join(w10f, "src", "audit.js"), "// changed\n");
const drSt10 = run(["drift", "login-loop", "--project", w10f]);
ok(apT10.code === 0 && done5.code === 0 && /was finished on \d{4}-\d\d-\d\d, but it changed since \(re-approved: tasks; 1 implementing file\(s\) not in the baseline: src\/audit\.js\) and all its tasks are done — finish it again/.test(naSt10.out) &&
  !/Nothing left to do/.test(naSt10.out) && drSt10.code === 1 && /↻ login-loop: changed since finish \(\d{4}-\d\d-\d\d\) — re-approved: tasks; 1 implementing file\(s\) not in the baseline: src\/audit\.js; its baseline no longer covers it: finish it again \(dev-spec finish login-loop --write\)/.test(drSt10.out) &&
  !/✓ login-loop/.test(drSt10.out),
  "after append-tasks + re-approval + done, next-action asks to finish again and drift exits 1 with the stale baseline (never '✓ unchanged' while audit.js is unhashed) (got " +
  JSON.stringify([apT10.code, done5.code, naSt10.out.slice(0, 160), drSt10.code, drSt10.out.slice(0, 160)]) + ")");
// The stale baseline still hashes its recorded files: src/auth.js changed → next-action asks for the drift decision (then
// finish again) and drift lists the changed file — it said only "finish it again" and never named auth.js.
fs.writeFileSync(path.join(w10f, "src", "auth.js"), "changed by another feature\n");
const naSD10 = run(["next-action", "login-loop", "--project", w10f]);
const drSD10 = run(["drift", "login-loop", "--project", w10f]);
ok(/but 1 of 1 implementing file\(s\) changed since: src\/auth\.js \(dev-spec drift login-loop\)\. Decide: /.test(naSD10.out) && /It also changed since that finish \(re-approved: tasks/.test(naSD10.out) &&
  drSD10.code === 1 && /⚠ login-loop: 1 of 1 implementing file\(s\) changed since finish/.test(drSD10.out) && /changed: src\/auth\.js/.test(drSD10.out) && /↻ login-loop: changed since finish/.test(drSD10.out),
  "a stale baseline whose recorded file changed: next-action → the drift decision + finish again; drift names the file and the stale baseline (got " + JSON.stringify([naSD10.out.slice(0, 120), drSD10.out.slice(0, 160)]) + ")");
fs.writeFileSync(path.join(w10f, "src", "auth.js"), "two\n");
// Every task ticked, but task 5's latest run failed: next-action names it and how to re-verify (--json = spec_next_action)
// — it said "close the feature with /spec-finish", which then refused.
const fail5 = run(["done", "login-loop", "5", "--evidence", "1 failing", "--exit", "1", "--cmd", "node -e process.exit(1)", "--project", w10f]);
const naV10 = run(["next-action", "login-loop", "--project", w10f]);
let naVJ10 = null;
try { naVJ10 = JSON.parse(run(["next-action", "login-loop", "--json", "--project", w10f]).out); } catch { /* invalid JSON */ }
ok(fail5.code === 1 && /→ All tasks are ticked, but not all are verified: #5 \(latest run failed\)/.test(naV10.out) && /dev-spec done login-loop 5 --run/.test(naV10.out) &&
  !/close the feature|Nothing left to do/.test(naV10.out) && naVJ10 && naVJ10.step === "verify" && JSON.stringify(naVJ10) === JSON.stringify(S10.nextAction(w10f, "login-loop")) &&
  run(["finish", "login-loop", "--project", w10f]).code === 1,
  "next-action on a feature whose latest run failed: 'verify' naming #5 and `done --run` (never 'close the feature'); finish refuses too (got " + JSON.stringify(naV10.out.slice(0, 140)) + ")");
// Archived while its baseline is stale (tasks re-approved after the finish): the drift line says restore → finish → archive
// again (it said "finish it again", and that command answered only "not found"); finish of the archived feature names
// the archive and the restore. A file added under it later is no stale baseline (no _Implements:_ walk for an archived one).
run(["feature", "archive", "login-loop", "--project", w10f]);
const drAr10 = run(["drift", "--project", w10f]);
const finAr10 = run(["finish", "login-loop", "--write", "--project", w10f]);
run(["feature", "restore", "login-loop", "--project", w10f]);
ok(drAr10.code === 1 && /↻ login-loop \(archived\): changed since finish \(\d{4}-\d\d-\d\d\) — re-approved: tasks; its baseline no longer covers it: restore it \(dev-spec feature restore login-loop\), finish it again \(dev-spec finish login-loop --write\), then archive it again/.test(drAr10.out) &&
  !/not in the baseline/.test(drAr10.out) && finAr10.code === 1 && /Feature 'login-loop' not found under .* — it is archived \(\.specs\/_archive\/login-loop\): restore it first \(dev-spec feature restore login-loop\)\./.test(finAr10.out),
  "drift on an archived stale feature says restore → finish → archive again (no _Implements:_ walk: no new-file reason); finish of an archived feature names the archive and the restore (got " +
  JSON.stringify([drAr10.code, drAr10.out.slice(0, 220), finAr10.out.slice(0, 200)]) + ")");

// PT project: catalog chrome, restore and drift messages in Portuguese.
const w10pt = path.join(tmp, "wp10-pt");
run(["init", "core", "--lang", "pt", "--project", w10pt]);
run(["create", "Pagamentos", "core", "--project", w10pt]);
const catPt10 = run(["catalog", "--project", w10pt]).out;
ok(/# Catálogo de specs — wp10-pt/.test(catPt10) && /AUTO-GERADO por dev-spec/.test(catPt10) && /pagamentos — em curso/.test(catPt10) &&
  /Não há nada arquivado como 'x'/.test(run(["feature", "restore", "x", "--project", w10pt]).out) &&
  /Nenhuma feature fechada tem ainda uma baseline de drift/.test(run(["drift", "--project", w10pt]).out), "PT: catalog chrome, restore error and drift note are localized");

// A _Supersedes:_ list hard-wrapped onto the next line: trace passes with no "never closed" warning, doctor's
// traceability passes, the catalog strikes every target through.
const w10w = path.join(tmp, "wp10-wrap");
S10.initProject(w10w, ["core"]);
["Billing", "Wrapped"].forEach((n) => S10.createFeature(w10w, n, ["core"]));
const reqW10 = (f, body) => fs.writeFileSync(path.join(w10w, ".specs", f, "requirements.md"), "# Requirements\n\n## Summary\n" + f + ".\n\n### US-1 (P1)\n\n#### Acceptance Criteria (EARS)\n" + body);
reqW10("billing", "1. **US-1.AC-1** — WHEN a user pays THE SYSTEM SHALL store the receipt\n2. **US-1.AC-2** — WHEN a refund is asked THE SYSTEM SHALL refund within 30 days\n3. **US-1.AC-3** — WHEN z THE SYSTEM SHALL w\n");
reqW10("wrapped", "1. **US-1.AC-1** — WHEN a refund is asked THE SYSTEM SHALL refund within 14 days\n   - _Supersedes: billing/US-1.AC-2,\n     billing/US-1.AC-3_\n");
fs.writeFileSync(path.join(w10w, ".specs", "wrapped", "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Refund\n  - _Requirements: US-1.AC-1_\n");
const trW10 = run(["trace", "wrapped", "--project", w10w]);
const catWr10 = run(["catalog", "--project", w10w]).out;
ok(trW10.code === 0 && /verdict=pass {2}ACs=1 /.test(trW10.out) && !/⚠|never closed/.test(trW10.out) && !/✗ traceability/.test(run(["doctor", "wrapped", "--project", w10w]).out) &&
  catWr10.includes("~~**US-1.AC-3** — WHEN z THE SYSTEM SHALL w~~ — superseded by `wrapped/US-1.AC-1`") && catWr10.includes("_(supersedes `billing/US-1.AC-2`, `billing/US-1.AC-3`)_"),
  "a _Supersedes:_ marker wrapped onto its next line: trace exit 0 with no phantom warning, doctor traceability passes, catalog strikes both targets through");

// help + docblock: catalog / drift right after the feature line, restore on it.
const help10 = run(["help"]).out;
const doc10 = fs.readFileSync(CLI, "utf8").split("*/")[0];
const hFeat = help10.indexOf("feature <remove|archive|rename|restore>"), hCat = help10.indexOf("  catalog [--write]"), hDrift = help10.indexOf("  drift [feature]");
ok(hFeat > 0 && hCat > hFeat && hDrift > hCat && hDrift < help10.indexOf("  roadmap [") && /restore brings an archived feature back/.test(help10) &&
  /rename \| restore a feature/.test(doc10) && /catalog \[--write\]/.test(doc10) && /drift \[feature\]/.test(doc10),
  "help and the header docblock list catalog / drift (right after feature) and feature restore");
} // section wp10

// 1.13 WP11: init --guard on|off (= spec_init {guard}) and custom scoped steering files (= steering_scaffold).
if (inSection("wp11")) {
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
  ok(bad.code === 1 && /--guard takes on or off \(got 'maybe'\)/.test(bad.out) && none.code === 1 && /missing value for --guard/.test(none.out) && meta().guard === false,
    "init --guard with a bad or missing value exits 1 and changes nothing");
  const gPt = path.join(tmp, "wp11-guard-pt");
  ok(/Modo guarda LIGADO/.test(run(["init", "--guard", "on", "--lang", "pt", "--project", gPt]).out) && S11.guardEnabled(gPt), "init --guard on (PT) is localized");
  // steering <custom>.md — the same engine call as steering_scaffold.
  const s11 = path.join(tmp, "wp11-steer");
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
}
if (inSection("wp12")) { // 1.13 WP12 — append-tasks takes the EC/NFR/SC IDs requirements.md writes; trace resolves _Implements:_ globs (CLI = MCP)
  const S12 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const p12 = path.join(tmp, "wp12-proj");
  run(["init", "core", "--project", p12]);
  run(["create", "Login", "core", "--project", p12]);
  const f12 = path.join(p12, ".specs", "login");
  const tasks12 = path.join(f12, "tasks.md");
  fs.writeFileSync(path.join(f12, "requirements.md"), "## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a user signs in THE SYSTEM SHALL create a session\n\n" +
    "## Edge Cases\n- **EC-2** — a locked account is refused.\n\n```md\n- **EC-7** — an example in a fence\n2. **US-1.AC-9** — WHEN x THE SYSTEM SHALL y\n```\n");
  fs.writeFileSync(tasks12, "# Tasks\n\n## Phase: Build\n- [x] 1. [US1] Sessions\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/**/*.js_\n");
  fs.mkdirSync(path.join(p12, "src", "auth"), { recursive: true });
  fs.writeFileSync(path.join(p12, "src", "auth", "session.js"), "x\n");
  const ap12 = run(["append-tasks", "login", "--task", "Lock the account", "--req", "US-1.AC-1,ec-2", "--project", p12]);
  const bad12 = run(["append-tasks", "login", "--task", "x", "--req", "EC-7", "--project", p12]);
  ok(ap12.code === 0 && fs.readFileSync(tasks12, "utf8").includes("- [ ] 2. Lock the account\n  - _Requirements: US-1.AC-1, EC-2_\n") &&
    bad12.code === 1 && /Unknown acceptance criteria \(not in requirements\.md\): EC-7\./.test(bad12.out),
    "append-tasks --req accepts an EC ID requirements.md writes (ec-2 → EC-2); one written only inside a fenced example is refused (exit 1)");
  const tr12 = run(["trace", "login", "--project", p12]);
  ok(tr12.code === 0 && /verdict=pass {2}ACs=1 /.test(tr12.out) && !/src\/\*\*/.test(tr12.out) && !/EC-2/.test(tr12.out),
    "trace: a glob that matches a file (src/**/*.js) is present, a fenced AC is not required, EC-2 is covered — exit 0");
  fs.appendFileSync(tasks12, "- [x] 3. [US1] Web\n  - _Implements: web/**/*.ts_\n- [ ] 4. [US1] Jobs\n  - _Implements: jobs/*.js_\n");
  const tr12b = run(["trace", "login", "--project", p12]);
  let tr12j = null;
  try { tr12j = JSON.parse(run(["trace", "login", "--json", "--project", p12]).out); } catch { /* invalid JSON */ }
  ok(tr12b.code === 1 && /_Implements:_ files that don't exist: web\/\*\*\/\*\.ts$/m.test(tr12b.out) && !/jobs\/\*\.js/.test(tr12b.out) &&
    tr12j && JSON.stringify(tr12j) === JSON.stringify(S12.traceCheck(p12, "login")) && tr12j.plannedImplFiles.join() === "jobs/*.js",
    "trace: a done task's glob that matches nothing is a missing file (exit 1); an open task's is planned; --json = trace_check");
}

if (inSection("wp13")) { // 1.13 batch 4 — boolean switches read strictly, CLI refuses what MCP refuses, --json refusals, localized PT/ES output
  const b13 = path.join(tmp, "wp13-bool");
  run(["init", "core", "--project", b13]);
  run(["create", "Billing", "tdd", "--project", b13]);
  run(["create", "Other", "core", "--project", b13]);
  const t13 = path.join(b13, ".specs", "billing", "tasks.md");
  const ex13 = path.join(b13, ".specs", "billing", ".execution");
  fs.writeFileSync(t13, "# Tasks\n\n## Phase: Build\n- [ ] 1. [US1] First\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 2. [US1] Second\n- [ ] 3. [US1] Third\n- [ ] 4. [US1] Fourth\n");
  const st13 = () => { try { return JSON.parse(fs.readFileSync(path.join(b13, ".specs", "billing", ".state.json"), "utf8")); } catch { return {}; } };
  const noRun13 = run(["done", "billing", "1", "--run=false", "--project", b13]);
  ok(noRun13.code === 0 && !/\$ node/.test(noRun13.out) && !(st13().evidence || {})["1"] && /Task 1 done\./.test(noRun13.out) && !/verified/.test(noRun13.out),
    "done --run=false runs no _Verify:_ command (a plain tick, no evidence recorded) — the string 'false' is not a switch");
  const addNoRm13 = run(["add-track", "other", "tdd", "--remove=false", "--project", b13]);
  ok(addNoRm13.code === 0 && /'other' now \[core \+tdd\]/.test(addNoRm13.out), "add-track --remove=false adds the track (removes nothing)");
  const briefNo13 = run(["brief", "billing", "--write=false", "--project", b13]);
  const finNo13 = run(["finish", "billing", "--write=false", "--project", b13]);
  const rmNo13 = run(["roadmap", "--write=false", "--html=false", "--project", b13]);
  let nb13 = null;
  try { nb13 = JSON.parse(run(["next", "billing", "--batch=false", "--json", "--project", b13]).out); } catch { /* not JSON */ }
  ok(briefNo13.code === 0 && !/Brief →/.test(briefNo13.out) && !/merge-summary/.test(finNo13.out) && !fs.existsSync(ex13) &&
    !/wrote/.test(rmNo13.out) && !fs.existsSync(path.join(b13, ".specs", "ROADMAP.html")) && nb13 && nb13.ok === true && !("batch" in nb13) &&
    /^Feature: billing/m.test(run(["status", "billing", "--json=false", "--project", b13]).out),
    "--write=false (brief, finish, roadmap), --html=false, --batch=false and --json=false are false, as over MCP");
  const maybe13 = run(["done", "billing", "2", "--run=maybe", "--project", b13]);
  const yes13 = run(["brief", "billing", "2", "--write=true", "--project", b13]);
  ok(maybe13.code === 1 && /--run must be a boolean \(true\/false\) \(got "maybe"\)/.test(maybe13.out) && !/- \[x\] 2\./.test(fs.readFileSync(t13, "utf8")) &&
    yes13.code === 0 && fs.existsSync(path.join(ex13, "task-2-brief.md")),
    "a boolean switch with any other =value (--run=maybe) exits 1 and ticks nothing; --write=true still writes");
  // The CLI refuses what MCP refuses: task numbers, --cap, --max, --kind, backlog actions.
  const br13 = [run(["brief", "billing", "3.9", "--write", "--project", b13]), run(["brief", "billing", "3abc", "--project", b13]), run(["brief", "billing", "1e21", "--project", b13])];
  ok(br13.every((r) => r.code === 1 && /number must be an integer/.test(r.out)) && !fs.existsSync(path.join(ex13, "task-3-brief.md")),
    "brief 3.9 / 3abc / 1e21 exit 1 (never task 3 or 1), like spec_task_brief — no brief written");
  fs.mkdirSync(path.join(b13, "src"), { recursive: true });
  fs.writeFileSync(path.join(b13, "src", "a.js"), "x\n");
  const cap13 = ["-3", "0", "abc", "2.9"].map((c) => run(["scan", "--cap", c, "--project", b13])).concat([run(["scan", "--cap=-3", "--project", b13])]);
  ok(cap13.every((r) => r.code === 1 && /--cap must be an integer ≥ 1/.test(r.out) && !/files:/.test(r.out)) && run(["scan", "--cap", "5", "--project", b13]).code === 0,
    "scan --cap -3 / 0 / abc / 2.9 (and --cap=-3) exit 1 like spec_scan (cap ≥ 1); --cap 5 scans");
  const max13 = ["1.5", "0", "abc"].map((m) => run(["next", "billing", "--batch", "--max", m, "--project", b13]));
  ok(max13.every((r) => r.code === 1 && /--max must be an integer ≥ 1/.test(r.out)) && run(["next", "billing", "--batch", "--max", "2", "--project", b13]).code === 0,
    "next --max 1.5 / 0 / abc exit 1 (spec_next_task: max is an integer ≥ 1)");
  const kind13 = run(["create", "Zed", "--kind", "bugfx", "--project", b13]);
  const kindOk13 = run(["create", "Zed", "--kind", "Bugfix", "--project", b13]);
  let zedKind = null;
  try { zedKind = JSON.parse(fs.readFileSync(path.join(b13, ".specs", "zed", ".state.json"), "utf8")).kind; } catch { /* missing */ }
  ok(kind13.code === 1 && /kind must be one of: feature, bugfix \(got "bugfx"\)/.test(kind13.out) && kindOk13.code === 0 && zedKind === "bugfix",
    "create --kind bugfx exits 1 and scaffolds nothing (a typo can no longer fix the kind for good); --kind Bugfix works");
  const bl13 = run(["backlog", "delete", "Pay", "--project", b13]);
  ok(bl13.code === 1 && /action must be one of: add, rm, list \(got "delete"\)/.test(bl13.out) && run(["backlog", "--project", b13]).code === 0 && run(["backlog", "list", "--project", b13]).code === 0,
    "backlog delete (an unknown action) exits 1 like spec_backlog; a bare backlog / backlog list still list");
  // --json on a refusal: the engine result on stdout (= the MCP tool's), exit 1.
  const runJ = (args) => {
    const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: tmp } });
    let j = null;
    try { j = JSON.parse(r.stdout); } catch { /* not JSON */ }
    return { j, code: r.status };
  };
  const dj13 = runJ(["done", "billing", "4", "--exit", "3", "--cmd", "x", "--json", "--project", b13]);
  const ij13 = runJ(["impact", "billing", "--json", "--project", b13]);
  const sj13 = runJ(["status", "nope", "--json", "--project", b13]);
  const S13 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  ok(dj13.code === 1 && dj13.j && dj13.j.ok === false && dj13.j.recorded === true && /verification failed \(exit 3\)/.test(dj13.j.error) &&
    ij13.code === 1 && ij13.j && ij13.j.ok === false && ij13.j.neverApproved === true && JSON.stringify(ij13.j) === JSON.stringify(S13.impactReport(b13, "billing", {})) &&
    sj13.code === 1 && sj13.j && sj13.j.ok === false && typeof sj13.j.error === "string",
    "--json on a refusal prints the engine result on stdout (recorded / neverApproved kept, = MCP) and exits 1");
  // PT / ES: every line of status, doctor, depend, add-track, ears, usage and unknown command in the project/feature language.
  const pt13 = path.join(tmp, "wp13-pt");
  run(["init", "--lang", "pt", "--project", pt13]);
  run(["create", "Login", "tdd", "saas", "ai", "--project", pt13]);
  run(["create", "Other", "--project", pt13]);
  const ptSt13 = run(["status", "login", "--project", pt13]).out;
  const ptDoc13 = run(["doctor", "login", "--project", pt13]).out;
  const ptDep13 = run(["depend", "login", "other", "--order", "2", "--project", pt13]).out;
  const ptDep0 = run(["depend", "other", "--project", pt13]).out;
  const ptAdd13 = run(["add-track", "other", "tdd", "--project", pt13]).out;
  const ptEars13 = run(["ears", "login", "--project", pt13]).out;
  ok(/Secções de escala: /.test(ptSt13) && /Secções de IA: /.test(ptSt13) && !/Scale sections|AI sections/.test(ptSt13) &&
    /ears — critérios=\d+, erros=\d+, avisos=\d+/.test(ptDoc13) && !/criteria=/.test(ptDoc13) &&
    /login depende de: other {2}ordem=2/.test(ptDep13) && /other depende de: \(nenhuma\)/.test(ptDep0) &&
    /'other' agora \[core \+tdd\]/.test(ptAdd13) && /classification\.md \(Tracks Ativos\)/.test(ptAdd13) && !/now \[|Active Tracks|\+sections/.test(ptAdd13) &&
    /\[aviso\]/.test(ptEars13) && !/\[warn\]/.test(ptEars13),
    "PT: status section labels, doctor's ears detail, depend, add-track (+ its 'added' entries) and ears severities are Portuguese");
  const ptUse13 = run(["doctor", "--project", pt13]);
  const ptUnk13 = run(["wat", "--project", pt13]);
  ok(ptUse13.code === 1 && /uso: dev-spec doctor <feature>/.test(ptUse13.out) && ptUnk13.code === 1 && /comando desconhecido 'wat'/.test(ptUnk13.out) && /usage: dev-spec doctor <feature>/.test(run(["doctor", "--project", b13]).out),
    "PT: the usage prefix and 'unknown command' are Portuguese (the syntax stays as typed; EN unchanged)");
  const es13 = path.join(tmp, "wp13-es");
  run(["init", "--lang", "es", "--project", es13]);
  run(["create", "Pago", "saas", "--project", es13]);
  const esSt13 = run(["status", "pago", "--project", es13]).out;
  run(["roadmap", "--write", "--html", "--project", es13]);
  let esMd13 = "", esHtml13 = "";
  try { esMd13 = fs.readFileSync(path.join(es13, ".specs", "ROADMAP.md"), "utf8"); esHtml13 = fs.readFileSync(path.join(es13, ".specs", "ROADMAP.html"), "utf8"); } catch { /* missing */ }
  ok(/Secciones de escala: /.test(esSt13) && /\| requisitos \|/.test(esMd13) && !/\| requirements \|/.test(esMd13) && /<td>requisitos<\/td>/.test(esHtml13),
    "ES: status section label, and ROADMAP.md / ROADMAP.html show the localized phase (requisitos)");
}

if (inSection("wp14")) { // 1.13 batch 5 — no stray .tmp files, the cross-process feature lock
  const tmpsIn = (d) => { try { return fs.readdirSync(d).filter((x) => /\.tmp$/i.test(x)); } catch { return ["<unreadable>"]; } };
  // roadmap --write where ROADMAP.md can't be replaced (a folder): an error, and no ROADMAP.md.<pid>.<ts>.tmp left behind.
  const t14 = path.join(tmp, "wp14-tmp");
  run(["init", "--project", t14]);
  run(["create", "Alpha", "core", "--project", t14]);
  const specs14 = path.join(t14, ".specs");
  fs.rmSync(path.join(specs14, "ROADMAP.md"), { force: true });
  fs.mkdirSync(path.join(specs14, "ROADMAP.md"));
  const rw14 = run(["roadmap", "--write", "--project", t14]);
  const bl14 = run(["backlog", "add", "Later", "--project", t14]);
  ok(rw14.code === 1 && /dev-spec: /.test(rw14.out) && bl14.code === 0 && tmpsIn(specs14).length === 0,
    "roadmap --write fails cleanly when ROADMAP.md can't be replaced and neither it nor backlog add leaves a .tmp in .specs/ (left: " + tmpsIn(specs14).join(", ") + ")");

  // done while another live process holds the feature's lock: waits DEV_SPEC_LOCK_WAIT_MS, then refuses (exit 1, --json
  // prints the refusal) with nothing ticked or recorded — MCP's spec_complete_task answers the same.
  const k14 = path.join(tmp, "wp14-lock");
  run(["create", "Race", "core", "--project", k14]);
  const kDir14 = path.join(k14, ".specs", "race");
  fs.writeFileSync(path.join(kDir14, "tasks.md"), "- [ ] 1. a\n- [ ] 2. b\n");
  const lock14 = path.join(kDir14, ".lock");
  fs.writeFileSync(lock14, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString() }));
  const runEnv = (args) => { const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: tmp, DEV_SPEC_LOCK_WAIT_MS: "50" } }); return { out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "", code: r.status }; };
  const busy14 = runEnv(["done", "race", "1", "--evidence", "ok", "--project", k14]);
  const busyJson14 = runEnv(["done", "race", "1", "--json", "--project", k14]);
  let bj14 = {};
  try { bj14 = JSON.parse(busyJson14.stdout); } catch { /* stays {} */ }
  const untouched14 = /- \[ \] 1\./.test(fs.readFileSync(path.join(kDir14, "tasks.md"), "utf8")) && !(JSON.parse(fs.readFileSync(path.join(kDir14, ".state.json"), "utf8")).evidence || {})["1"];
  fs.rmSync(lock14, { force: true });
  const free14 = run(["done", "race", "1", "--project", k14]);
  ok(busy14.code === 1 && /Another dev-spec process is updating 'race' right now \(\.specs\/race\/\.lock\)/.test(busy14.out) && busyJson14.code === 1 && bj14.ok === false && bj14.busy === true &&
    untouched14 && free14.code === 0 && !fs.existsSync(lock14),
    "done under another process's feature lock: exit 1 with the busy error (--json prints {ok:false, busy:true}), nothing ticked; once released it ticks and leaves no .lock");
  // feature rename / create (existing feature) wait on the same lock; depend / backlog on .specs/.roadmap.lock — like MCP.
  fs.writeFileSync(lock14, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString() }));
  const rlock14 = path.join(k14, ".specs", ".roadmap.lock");
  fs.writeFileSync(rlock14, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString() }));
  const rn14 = runEnv(["feature", "rename", "race", "sprint", "--project", k14]);
  const cr14 = runEnv(["create", "race", "saas", "--project", k14]);
  const bl14r = runEnv(["backlog", "add", "Later", "--project", k14]);
  fs.rmSync(lock14, { force: true });
  fs.rmSync(rlock14, { force: true });
  const kept14 = fs.existsSync(kDir14) && !fs.existsSync(path.join(kDir14, "load-test.md")) && !fs.existsSync(path.join(k14, ".specs", "sprint"));
  const rnFree14 = run(["feature", "rename", "race", "sprint", "--project", k14]);
  ok(rn14.code === 1 && /Another dev-spec process is updating 'race' right now/.test(rn14.out) && cr14.code === 1 && /updating 'race' right now/.test(cr14.out) &&
    bl14r.code === 1 && /updating \.specs\/roadmap\.json right now \(\.specs\/\.roadmap\.lock\)/.test(bl14r.out) && kept14 && rnFree14.code === 0 && !fs.existsSync(path.join(k14, ".specs", "sprint", ".lock")) && !fs.existsSync(kDir14),
    "feature rename / create on a held feature lock and backlog add on a held roadmap lock: exit 1, busy, nothing changed; once free the rename moves the folder and leaves no .lock (got " +
    JSON.stringify([rn14.code, rn14.out.slice(0, 80), cr14.code, cr14.out.slice(0, 80), bl14r.code, bl14r.out.slice(0, 80), rnFree14.code, rnFree14.out.slice(0, 80)]) + ")");
  // A stale lock that can't be removed (a folder named .lock, an hour old): done answers the stuck-lock error at the
  // deadline (exit 1, --json {busy, stuck}) — it spun at 100% CPU forever. The same as spec_complete_task.
  const sLock14 = path.join(k14, ".specs", "sprint", ".lock");
  fs.mkdirSync(path.join(sLock14, "x"), { recursive: true });
  const hourAgo14 = new Date(Date.now() - 3600e3);
  fs.utimesSync(sLock14, hourAgo14, hourAgo14);
  const stuckRun = (args) => { const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", timeout: 15000, env: { ...process.env, SPEC_PROJECT_DIR: tmp, DEV_SPEC_LOCK_WAIT_MS: "200" } }); return { out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "", code: r.status }; };
  const stuck14 = stuckRun(["done", "sprint", "2", "--project", k14]);
  const stuckJ14 = stuckRun(["done", "sprint", "2", "--json", "--project", k14]);
  let sj14 = {};
  try { sj14 = JSON.parse(stuckJ14.stdout); } catch { /* stays {} */ }
  ok(stuck14.code === 1 && /A stale dev-spec lock \(\.specs\/sprint\/\.lock\) could not be removed .* Delete \.specs\/sprint\/\.lock by hand/.test(stuck14.out) &&
    stuckJ14.code === 1 && sj14.busy === true && sj14.stuck === true && /- \[ \] 2\./.test(fs.readFileSync(path.join(k14, ".specs", "sprint", "tasks.md"), "utf8")),
    "done on a stale lock that can't be removed (a folder named .lock): exit 1 with the localized 'delete it by hand' error (--json {busy, stuck}) within DEV_SPEC_LOCK_WAIT_MS, nothing ticked (got " +
    JSON.stringify([stuck14.code, stuck14.out.slice(0, 90), stuckJ14.code]) + ")");
}

if (inSection("wp15")) { // 1.13 batch 6 — examples/README.md's "Verify it yourself" outputs are what the CLI prints on a fresh copy
  // A copy resets every file date, like a clone: the demo's approvals must hold by content fingerprint (an approval
  // without one fell back to mtime and flagged every approved file as changed after any checkout).
  const repo15 = path.join(__dirname, "..");
  const demo15 = path.join(tmp, "wp15", "examples", "demo-project");
  fs.cpSync(path.join(repo15, "examples", "demo-project"), demo15, { recursive: true });
  const readme15 = fs.readFileSync(path.join(repo15, "examples", "README.md"), "utf8").replace(/\r\n/g, "\n");
  const block15 = (heading) => { const at = readme15.indexOf("### `" + heading + "`"); const m = at < 0 ? null : readme15.slice(at).match(/\n```\n([\s\S]*?)\n```/); return m ? m[1] : "<no block for " + heading + ">"; };
  const cmds15 = [["doctor api-keys", ["doctor", "api-keys"]], ["trace api-keys --code", ["trace", "api-keys", "--code"]], ["roadmap", ["roadmap"]], ["clarify api-keys", ["clarify", "api-keys"]]];
  const diff15 = [];
  for (const [heading, args] of cmds15) {
    const r = run([...args, "--project", demo15]);
    const got = r.out.replace(/\r\n/g, "\n").replace(/\s+$/, ""), want = block15(heading);
    if (r.code !== 0 || got !== want) diff15.push(heading + " (exit " + r.code + "): " + JSON.stringify(got.slice(0, 300)));
  }
  ok(diff15.length === 0 && /verdict=PASS/.test(block15("doctor api-keys")) && !/[▲✗]/.test(block15("doctor api-keys")),
    "examples/README.md: doctor (PASS, no warnings) / trace --code / roadmap / clarify print exactly the pasted outputs on a fresh copy of the demo (differs: " + diff15.join(" | ") + ")");
  // The committed ROADMAP.md is what `roadmap --write` generates now (it said 70% while the engine said 19%).
  run(["roadmap", "--write", "--project", demo15]);
  const rm15 = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
  ok(rm15(path.join(demo15, ".specs", "ROADMAP.md")) === rm15(path.join(repo15, "examples", "demo-project", ".specs", "ROADMAP.md")),
    "the demo's committed .specs/ROADMAP.md matches what roadmap --write generates");
}

if (inSection("wp16")) { // 1.13 batch 7 — gates at the planning phases, the bugfix root-cause task, add-track tdd rows, removed ACs, eval sets
  const S16 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const w16 = path.join(tmp, "wp16");
  S16.initProject(w16, ["core"], "en");
  const at16 = (slug, rel) => path.join(w16, ".specs", slug, rel);
  const REQ16 = "# Feature: Digest\n\n## Summary\nWeekly digest.\n\n### US-1 (P1 — MVP): Digest\n#### Acceptance Criteria (EARS)\n" +
    "1. **US-1.AC-1** — WHEN the weekly job runs THE SYSTEM SHALL email each active account a digest.\n2. **US-1.AC-2** — IF an account has no activity THEN THE SYSTEM SHALL skip the email.\n\n" +
    "## Success Criteria\n- **SC-001** — 95% delivered within 1 hour.\n";

  // doctor at the design gate: the untouched tasks.md template's references are deferred (▲), never "✗ … (typos?)"; exit 0.
  S16.createFeature(w16, "Weekly digest", ["core"]);
  fs.writeFileSync(at16("weekly-digest", "requirements.md"), REQ16);
  fs.writeFileSync(at16("weekly-digest", "design.md"), "# Design: Digest\n\n## Overview\nA weekly job.\n\n## Constitution Check\n- [x] Principle 1 — complies\n");
  const doc16 = run(["doctor", "weekly-digest", "--project", w16]);
  ok(doc16.code === 0 && /readyToAdvance=true/.test(doc16.out) && /▲ traceability — not traced yet — still a later phase's template: tasks\.md/.test(doc16.out) && !/✗ traceability|\(typos\?\)/.test(doc16.out),
    "doctor at the design gate (CLI): the template tasks.md's AC references are deferred (▲ not traced yet), readyToAdvance=true, exit 0");

  // bugfix: ticking the root-cause task with Root Cause empty warns; the next refusal says the section is empty (not "do task 2 first").
  run(["bugfix", "Login crash", "--summary", "Login crashes on accented emails", "--project", w16]);
  const d2 = run(["done", "login-crash", "2", "--project", w16]);
  const d3 = run(["done", "login-crash", "3", "--evidence", "red", "--project", w16]);
  ok(d2.code === 0 && /⚠ Task 2 is ticked, but bug\.md → Root Cause is still empty — write the root cause there/.test(d2.out) &&
    d3.code === 1 && /Task 3 can't be completed yet: bug\.md → Root Cause is still empty — task 2 is ticked, but its deliverable is that section/.test(d3.out) && !/do task 2 first/.test(d3.out),
    "bugfix (CLI): done on the root-cause task with Root Cause empty warns; a later task's refusal names the empty section, never 'do task 2 first' for a ticked task");

  // add-track tdd after the requirements exist: rows from the feature's own ACs.
  S16.createFeature(w16, "Order cancel", ["core"]);
  fs.writeFileSync(at16("order-cancel", "requirements.md"), REQ16.replace("### US-1", "### US-1").replace("## Success Criteria", "### US-3 (P2): Notify\n#### Acceptance Criteria (EARS)\n1. **US-3.AC-1** — WHEN a digest bounces THE SYSTEM SHALL flag the account.\n\n## Success Criteria"));
  const addT16 = run(["add-track", "order-cancel", "tdd", "--project", w16]);
  const rows16 = (fs.readFileSync(at16("order-cancel", "test-plan.md"), "utf8").match(/^\| T-\d+ \|[^|]*\|[^|]*\|[^|]*\| ([^|]*) \|/gm) || []).map((r) => r.split("|")[5].trim()).join();
  ok(addT16.code === 0 && rows16 === "US-1.AC-1,US-1.AC-2,US-3.AC-1" && run(["trace", "order-cancel", "--json", "--project", w16]).out.includes('"phantomAcsInTests": []'),
    "add-track tdd (CLI) on written requirements: one test-plan row per real AC, no phantom template row (got " + rows16 + ")");

  // A removed AC: impact --reopen unticks nothing for it (retire), doctor names the change request instead of "typos?".
  S16.createFeature(w16, "Billing", ["core"]);
  const reqB16 = REQ16.replace("## Success Criteria", "### US-2 (P2): Export\n#### Acceptance Criteria (EARS)\n1. **US-2.AC-1** — WHEN an admin exports THE SYSTEM SHALL produce a CSV.\n\n## Success Criteria");
  fs.writeFileSync(at16("billing", "requirements.md"), reqB16);
  fs.writeFileSync(at16("billing", "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Send\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n- [ ] 2. [US2] CSV export\n  - _Requirements: US-2.AC-1_\n");
  S16.completeTask(w16, "billing", 1, { summary: "checked" });
  S16.completeTask(w16, "billing", 2, { summary: "checked" });
  S16.approvePhase(w16, "billing", "requirements", undefined, { force: true });
  fs.writeFileSync(at16("billing", "requirements.md"), REQ16);
  const im16 = run(["impact", "billing", "--project", w16]);
  const ro16 = run(["impact", "billing", "--reopen", "--project", w16]);
  const drB16 = run(["doctor", "billing", "--project", w16]);
  ok(/Removed criteria still cited — US-2\.AC-1 → tasks #2: don't redo those tasks/.test(im16.out) && !/To untick the affected done tasks/.test(im16.out) &&
    ro16.code === 0 && /Change request #1 recorded — nothing unticked: a removed criterion's tasks are not redone/.test(ro16.out) &&
    /- \[x\] 2\. \[US2\] CSV export/.test(fs.readFileSync(at16("billing", "tasks.md"), "utf8")) &&
    /✗ traceability — tasks still cite ACs a change request removed \(delete or update those tasks — not a typo\): US-2\.AC-1 \(change request #1\)/.test(drB16.out),
    "impact (CLI) on a removed AC: retire hint, --reopen records the change request without unticking its task; doctor names the change request, not 'typos?'");

  // Eval sets: a malformed item fails the dry run (exit 1, one line per item) — the CLI forwards to the harness.
  const ai16 = path.join(tmp, "wp16-ai");
  S16.initProject(ai16, ["ai"], "en");
  S16.createFeature(ai16, "Ticket summary", ["ai"]);
  fs.writeFileSync(path.join(ai16, ".specs", "ticket-summary", "evals", "regression.json"), JSON.stringify({ items: [{ id: "r1", input: "x", expect: { type: "contain", value: "x" } }] }));
  const ev16 = spawnSync(process.execPath, [CLI, "evals", "ticket-summary", "--dry-run", "--project", ai16], { encoding: "utf8", env: { ...process.env, ANTHROPIC_API_KEY: "" } });
  ok(ev16.status === 1 && /✗ regression\.json — item r1: unknown grader type 'contain' \(use contains \| equals \| regex \| refuse \| judge\)/.test(ev16.stdout) &&
    /Dry run found invalid eval set\(s\)/.test(ev16.stdout) && !/sets are valid/.test(ev16.stdout),
    "evals --dry-run (CLI): a malformed item is an invalid set — exit 1, named with its reason, never 'sets are valid'");
  // --max-items 0 (or a bare / non-numeric one) is a usage error the CLI passes through — exit 2, no 0/0 = 100% and no
  // baseline, even with a key set (nothing is called: it is refused before any set is read).
  fs.rmSync(path.join(ai16, ".specs", "ticket-summary", "evals", "regression.json"));
  const evMax16 = spawnSync(process.execPath, [CLI, "evals", "ticket-summary", "--max-items", "0", "--set-baseline", "--project", ai16], { encoding: "utf8", env: { ...process.env, ANTHROPIC_API_KEY: "dummy" } });
  ok(evMax16.status === 2 && /Invalid argument\(s\): --max-items must be an integer ≥ 1 \(got "0"\)/.test(evMax16.stderr) && !/100\.0%|all sets pass/.test(evMax16.stdout) &&
    !fs.existsSync(path.join(ai16, ".specs", "ticket-summary", "evals", "baseline.json")),
    "evals --max-items 0 (CLI): exit 2 with the argument error — never 0/0 = 100% 'all sets pass', no baseline written");
  // The switches the CLI forwards follow its own rule (help: "--flag=true|false … anything else is an error"):
  // --set-baseline=false used to overwrite baseline.json. A fetch stub (NODE_OPTIONS reaches the harness) keeps it offline.
  const stub16 = path.join(tmp, "stub16-fetch.js");
  fs.writeFileSync(stub16, "globalThis.fetch = async () => ({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'ok' }], usage: {} }) });\n");
  const base16 = path.join(ai16, ".specs", "ticket-summary", "evals", "baseline.json");
  const evSw16 = (args, key) => {
    const r = spawnSync(process.execPath, [CLI, "evals", "ticket-summary", ...args, "--project", ai16],
      { encoding: "utf8", env: { ...process.env, ANTHROPIC_API_KEY: key, NODE_OPTIONS: "--require " + JSON.stringify(stub16) } });
    r.baseline = fs.existsSync(base16);
    try { fs.rmSync(base16); } catch {}
    return r;
  };
  const sbF16 = evSw16(["--set-baseline=false"], "dummy"), sbT16 = evSw16(["--set-baseline=true"], "dummy");
  const drMb16 = evSw16(["--dry-run=maybe"], "dummy"), rlF16 = evSw16(["--require-live=false"], "");
  ok(/mode: LIVE/.test(sbF16.stdout) && !sbF16.baseline && /mode: LIVE/.test(sbT16.stdout) && sbT16.baseline &&
    drMb16.status === 2 && /Invalid argument\(s\): --dry-run must be a boolean \(true\/false\) \(got "maybe"\)/.test(drMb16.stderr) &&
    rlF16.status === 0 && /DRY-RUN/.test(rlF16.stdout),
    "evals (CLI) switches: --set-baseline=false writes no baseline (=true does), --dry-run=maybe exits 2 with the argument error, --require-live=false without a key dry-runs (got " +
    JSON.stringify([sbF16, sbT16, drMb16, rlF16].map((r) => [r.status, r.baseline, (r.stderr || "").trim().slice(0, 80)])) + ")");

  // bug.md evidence in brackets ([object Object], [A-Z]) is content: doctor documents both sections and approve design passes.
  run(["bugfix", "Profile Name Shows Object", "--summary", "The profile header shows object text", "--project", w16]);
  const bugP16 = at16("profile-name-shows-object", "bug.md");
  fs.writeFileSync(bugP16, fs.readFileSync(bugP16, "utf8").replace(/## Reproduction\n> \*\*TODO\*\*[^\n]*/, "## Reproduction\n1. Log in.\n2. Open /profile: the header reads [object Object].")
    .replace(/## Root Cause\n> \*\*TODO\*\*[^\n]*/, "## Root Cause\nheader.js interpolates the whole user object, so the browser shows [object Object]; norm() only maps [A-Z]."));
  const bugDoc16 = run(["doctor", "profile-name-shows-object", "--project", w16]);
  run(["approve", "profile-name-shows-object", "requirements", "--force", "--project", w16]); // phase by phase: requirements first
  const bugAp16 = run(["approve", "profile-name-shows-object", "design", "--project", w16]);
  ok(/✓ reproduction — reproduction documented/.test(bugDoc16.out) && /✓ root-cause — root cause documented/.test(bugDoc16.out) && !/bug\.md:\d+ \[object Object\]/.test(bugDoc16.out) && bugAp16.code === 0,
    "bugfix (CLI): a Reproduction / Root Cause quoting [object Object] / [A-Z] is documented (doctor ✓) and approve design passes (got " + bugAp16.out.slice(0, 120) + ")");

  // A ```fenced example``` row in test-plan.md covers nothing: trace reports the AC without a real row (exit 1), never PASS.
  S16.createFeature(w16, "Shop fence", ["tdd"]);
  fs.writeFileSync(at16("shop-fence", "requirements.md"), REQ16);
  fs.writeFileSync(at16("shop-fence", "test-plan.md"), "# Test Plan\n\n| ID | AC | File |\n|---|---|---|\n| T-01 | US-1.AC-1 | tests/digest.test.js |\n\n```md\n| T-02 | US-1.AC-2 | tests/skip.test.js |\n```\n");
  fs.writeFileSync(at16("shop-fence", "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Digest\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Makes green: T-01_\n");
  const trF16 = run(["trace", "shop-fence", "--project", w16]);
  ok(trF16.code === 1 && /US-1\.AC-2/.test(trF16.out) && !/verdict=pass/i.test(trF16.out),
    "trace (CLI): a fenced example row in test-plan.md is no coverage — the AC it names is reported uncovered, exit 1 (got " + trF16.out.slice(0, 160) + ")");
}

// unknown command errors
if (inSection("main")) ok(run(["wat"]).code === 1, "unknown command exits non-zero");

console.log(`\n${pass} passed, ${fail} failed`);
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
process.exit(fail ? 1 : 0);
