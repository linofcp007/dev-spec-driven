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
const SECTIONS = ["main", "wp1", "wp2", "wp3", "wp4", "wp5", "wp6", "wp7", "wp8", "wp9", "wp10", "wp11", "wp12", "wp13", "wp14", "wp15", "wp16", "wp17", "pa1", "pa2", "pa4", "pb1", "pb2", "pb3", "pb4", "pb5", "pc1", "pc2", "pc3", "pc4", "pd1", "pfr"];
SECTIONS.push("frs"); // 1.14 full review (S) — CLI surfaces and hooks
SECTIONS.push("frgb"); // 1.14 full review (Gb) — next_action, doctor, stop gate, guard
SECTIONS.push("frpb"); // 1.14 full review (Pb) — import, classifier, section synonyms, i18n / pt-BR
SECTIONS.push("frga"); // 1.14 full review (Ga) — evidence, project checks, CLI runs
SECTIONS.push("ffobs", "ffgate", "ffdeps", "ffrtm"); // 1.14 features F1 / F2 / F3 / F5 — each branch fills its own section
SECTIONS.push("p16u", "p16c", "p16q", "p16e"); // 1.16 packages U / C / Q / E — each branch fills its own section
SECTIONS.push("p17d", "p17a", "p17f"); // 1.17 packages D / A / F — each branch fills its own section
SECTIONS.push("fftracks"); // 1.15 feature F4 — project-defined tracks (track packs)
const SECTION = process.env.CLI_TEST_SECTION || "";
const inSection = (name) => SECTION === name;
// Exit only once stdout has flushed. On Linux a pipe (docker, `| tee`, `| less`, this suite's own parent) takes writes
// asynchronously once its 64 KB buffer is full, and process.exit() drops whatever is still queued — the tail of the
// output, FAIL lines and the total line included (Windows makes stdio pipes blocking, so it never showed there).
function exitFlushed(code) {
  process.stdout.write("", () => process.exit(code));
}
// Temp dirs: a crashed, killed or timed-out section — or, on Windows, a file a just-exited command or a virus scanner still
// held (rmSync threw EBUSY / EPERM; `force` only silences ENOENT) — left its cli-test-XXXXXX folder behind, run after run.
// Every removal retries (maxRetries), and the parent sweeps this runner's OWN leftovers first: exactly the mkdtemp shape,
// a real directory, untouched for 2 h.
function rmTmpDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 15, retryDelay: 100 }); } catch {}
}
function sweepStaleTmp() {
  let names = [];
  try { names = fs.readdirSync(os.tmpdir()); } catch { return; }
  const cutoff = Date.now() - 2 * 3600 * 1000;
  for (const n of names) {
    if (!/^cli-test-[A-Za-z0-9]{6}$/.test(n)) continue;
    const p = path.join(os.tmpdir(), n);
    try { const st = fs.lstatSync(p); if (st.isDirectory() && !st.isSymbolicLink() && st.mtimeMs < cutoff) rmTmpDir(p); } catch {}
  }
}
if (!SECTION) {
  rmTmpDir(tmp); // the children make their own
  sweepStaleTmp();
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
    exitFlushed(failed ? 1 : 0);
  });
  return; // CommonJS module scope: the parent only dispatches
}
if (!SECTIONS.includes(SECTION)) {
  rmTmpDir(tmp);
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
ok(badInit.code === 1 && /Argumento\(s\) no válido\(s\): --lang debe ser uno de: en, pt, es, pt-BR \(recibido: "fr"\)/.test(badInit.out) && esRm().meta.lang === "es" &&
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
// The cmd.exe / --shell bash hint only when cmd.exe itself failed (an unknown command, its own syntax error) — a check that
// ran and failed (exit 7 above) needs a code fix, not another shell: it used to print the hint on every failed run.
run(["create", "Nocmd", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "nocmd", "tasks.md"), "- [ ] 1. n\n  - _Verify: no-such-command-dsd --check_\n");
const w1No = run(["done", "nocmd", "1", "--run", "--project", w1p]);
ok(!/--shell bash/.test(w1Dup.out) && w1No.code === 1 && (process.platform === "win32") === /--shell bash/.test(w1No.out) && /- \[ \] 1\. n/.test(w1Read("nocmd")),
  "a check that ran and failed prints no shell hint; a command cmd.exe could not run (unknown command) prints the --shell bash hint on Windows (only there)");
// A red-phase task (its test must FAIL) with a must-pass _Verify:_: `done --run` explains how to fix the task, not only "fix the code".
run(["create", "Red", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "red", "tasks.md"), "- [ ] 1. [US1] Write regression test T-01 and watch it fail for the right reason\n  - _Verify: node -e \"process.exit(1)\"_\n");
const w1Red = run(["done", "red", "1", "--run", "--project", w1p]);
ok(w1Red.code === 1 && /Task 1 writes a test that must FAIL \(the red phase\)/.test(w1Red.out) && /Mark task 1 with _Expect: fail_/.test(w1Red.out) && /dev-spec done red 1 --run\. Or move the command/.test(w1Red.out) && !/--shell bash/.test(w1Red.out),
  "done --run on a red-phase task: the refusal says to mark it _Expect: fail_ (or move the _Verify:_ to the fix task) (no shell hint)");
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
// No hidden aliases: `feature delete` is refused like the MCP enum (spec_feature) refuses it — exit 1, nothing deleted.
// CHANGED in the 1.14 full review (S7): `backlog remove` is now a DOCUMENTED alias of rm on both surfaces (the engine and
// the spec_backlog enum accept it, as CLAUDE.md says) — it removes, exit 0; an unknown action (delete) is still refused.
run(["backlog", "add", "Zeta", "--project", w4]);
const fdel = run(["feature", "delete", "doomed", "--yes", "--project", w4]);
const brem = run(["backlog", "remove", "Zeta", "--project", w4]);
ok(fdel.code === 1 && /remove \| archive \| rename \| restore/.test(fdel.out) && fs.existsSync(path.join(w4, ".specs", "doomed")) &&
  brem.code === 0 && /removed from the backlog/.test(brem.out) && !/Zeta/.test(run(["backlog", "--project", w4]).out),
  "feature delete is not an alias (exit 1, nothing deleted, as over MCP); backlog remove is rm's alias on both surfaces (got " + JSON.stringify([fdel.code, brem.code]) + ")");
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
  ok(/^\s+import <kiro\|spec-kit\|openspec\|plan\|execplan\|bmad\|fluidplan> <path>/.test(lines6[covAt + 1] || "") /* 1.14 C3: + plan · execplan · bmad */ && /--brownfield/.test(help6) && /--tracks/.test(help6), "help: `import` right after `coverage`; --brownfield and --tracks documented");

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
  run(["approve", "drafts", "classification", "--force", "--project", w8]); // next_action re-reviews only what can be re-approved now
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
    /reopen applies to requirements, design, test-plan and eval-plan/.test(bad8[3].out) && /usage: dev-spec impact/.test(bad8[4].out), "impact: never approved / unknown phase / missing --phase value / reopen on tasks / no feature → exit 1 with a clear message");
  // --phase test-plan: the T-ID row diff, and next-action names that phase for a changed test-plan.md (the earlier gates —
  // requirements re-approved after the change, design — are approved, so the test plan is what can be re-approved now).
  run(["approve", "drafts", "requirements", "--force", "--project", w8]);
  run(["approve", "drafts", "design", "--force", "--project", w8]);
  run(["approve", "drafts", "test-plan", "--force", "--project", w8]);
  fs.writeFileSync(d8("test-plan.md"), "| Test ID | Covers |\n|---|---|\n| T-01 | US-1.AC-1 |\n| T-02 | US-1.AC-2, SC-001 |\n| T-03 | US-1.AC-1 |\n");
  const tp8 = run(["impact", "drafts", "--phase", "test-plan", "--project", w8]);
  let tp8j = null;
  try { tp8j = JSON.parse(run(["impact", "drafts", "--phase", "test-plan", "--json", "--project", w8]).out); } catch { /* invalid JSON */ }
  ok(tp8.code === 0 && /Impact: drafts · test-plan — against the approval of/.test(tp8.out) && /\+ T-03 {2}US-1\.AC-1/.test(tp8.out) && /~ T-02 {2}US-1\.AC-2, SC-001/.test(tp8.out) &&
    /T-02 \(modified\) — tasks: none/.test(tp8.out) && tp8j && JSON.stringify(tp8j) === JSON.stringify(S8.impactReport(w8, "drafts", { phase: "test-plan" })) &&
    /dev-spec impact drafts --phase test-plan/.test(run(["next-action", "drafts", "--project", w8]).out),
    "impact --phase test-plan prints the T-ID row diff (--json = spec_impact); next-action names --phase test-plan for a changed test-plan.md");
  const m8 = run(["metrics", "drafts", "--project", w8]);
  let m8j = null;
  try { m8j = JSON.parse(run(["metrics", "drafts", "--json", "--project", w8]).out); } catch { /* invalid JSON */ }
  ok(m8.code === 0 && /^Metrics: drafts \[core \+tdd\] — created \d{4}-\d\d-\d\d\n/.test(m8.out) && /lead time from creation: classification \S+ · requirements /.test(m8.out) && /change requests: 1 · reopened tasks: 1/.test(m8.out) &&
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
  run(["approve", "rascunhos", "classification", "--force", "--project", p8]);
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
// 1.15: only a SHIPPED feature's _Supersedes:_ retires an AC — billing-v2 carries an execution sign-off.
const ship10 = (dir, slug) => {
  const sp = path.join(dir, ".specs", slug, ".state.json");
  const st = JSON.parse(fs.readFileSync(sp, "utf8"));
  st.approvals = { ...(st.approvals || {}), execution: { at: "2026-09-01T00:00:00.000Z", by: "test" } };
  fs.writeFileSync(sp, JSON.stringify(st, null, 2));
};
ship10(w10, "billing-v2");
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
fill10("tasks.md", [["[command that runs T-01]", "node --test tests/integration/auth.test.js"], ["[exact values the fix must respect — versions, limits, formats]", "Node >= 20"], ["_Verify: [full test suite command]_", "_Verify: npm test_\n  - _Implements: src/auth.js_"]]);
fill10("bug.md", [["[correct behavior]", "the dashboard opens"], ["[what happens — error message, output, log lines]", "302 back to /login in a loop"],
  ["> **TODO** — exact steps, input and environment that reproduce it every time.", "Log in with an expired refresh token."],
  ["> **TODO** — the cause, with evidence (stack trace, log, failing assertion, the change that introduced it). Not \"probably\".", "The refresh handler redirects before clearing the cookie (auth.js:88)."],
  ["[What changes and why it removes the root cause — one fix, not a bundle.]", "Clear the cookie before redirecting."]]);
[1, 2].forEach((n) => S10.completeTask(w10f, "login-loop", n));
S10.completeTask(w10f, "login-loop", 3, { command: "node --test tests/integration/auth.test.js", exitCode: 1, summary: "T-01 fails: 302 back to /login" }); // the red run (_Expect: fail_)
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
// The _Verify:_ is quoted: `done --run` runs it in /bin/sh on Linux, where unquoted `process.exit(0)` is a syntax error
// ("(" unexpected) — cmd.exe accepted it, so the task stayed open only on Linux and the next four checks failed there.
run(["append-tasks", "login-loop", "--task", "Audit log of logins", "--req", "US-1.AC-1", "--implements", "src/audit.js", "--verify", 'node -e "process.exit(0)"', "--project", w10f]);
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
ship10(w10w, "wrapped"); // 1.15: a shipped declarer retires its targets
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
  ok(bad.code === 1 && /--guard takes on, off or scope \(got 'maybe'\)/.test(bad.out) && none.code === 1 && /missing value for --guard/.test(none.out) && meta().guard === false,
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
  ok(kind13.code === 1 && /kind must be one of: feature, bugfix, spike \(got "bugfx"\)/.test(kind13.out) && kindOk13.code === 0 && zedKind === "bugfix",
    "create --kind bugfx exits 1 and scaffolds nothing (a typo can no longer fix the kind for good); --kind Bugfix works");
  const bl13 = run(["backlog", "delete", "Pay", "--project", b13]);
  // (1.14 full review S7: the list now names rm's alias remove — the spec_backlog enum.)
  ok(bl13.code === 1 && /action must be one of: add, rm, remove, list \(got "delete"\)/.test(bl13.out) && run(["backlog", "--project", b13]).code === 0 && run(["backlog", "list", "--project", b13]).code === 0,
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

  // A command waiting on a feature's lock whose folder is removed meanwhile (remove's tombstone rename) answers not-found:
  // its pre-lock "the feature exists" read was stale, and its write recreated a zombie .specs/<slug>/.
  const lr14 = path.join(tmp, "wp14-lock-race");
  run(["create", "Imp", "core", "--project", lr14]);
  const imp14 = path.join(lr14, ".specs", "imp");
  fs.writeFileSync(path.join(imp14, ".lock"), JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), token: "held-by-test" })); // a live holder
  const race14 = path.join(tmp, "wp14-lock-race.js");
  fs.writeFileSync(race14, [
    "const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');",
    "const [cli, proj, dir] = process.argv.slice(2);",
    "const p = spawn(process.execPath, [cli, 'add-track', 'imp', 'saas', '--project', proj], { env: { ...process.env, DEV_SPEC_LOCK_WAIT_MS: '8000' } });",
    "let out = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d));",
    // Windows refuses a folder rename while the waiter has a file open inside it (its lock attempt): retry, like the engine does.
    "const moveAway = (left) => { try { const t = path.join(path.dirname(dir), '.removing-imp-test'); fs.renameSync(dir, t); fs.rmSync(t, { recursive: true, force: true }); }" +
    " catch (e) { if (left > 0 && ['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) setTimeout(() => moveAway(left - 1), 25); else throw e; } };",
    "setTimeout(() => moveAway(200), 1200);",
    "p.on('close', (code) => console.log(JSON.stringify({ code, out, exists: fs.existsSync(dir) })));",
  ].join("\n"));
  const rr14 = spawnSync(process.execPath, [race14, CLI, lr14, imp14], { encoding: "utf8", timeout: 30000 });
  let rj14 = null;
  try { rj14 = JSON.parse(rr14.stdout.trim().split("\n").pop()); } catch { /* stays null */ }
  ok(rj14 && rj14.code !== 0 && rj14.exists === false && /not found/i.test(rj14.out),
    "a command waiting on a feature's lock whose folder is removed meanwhile answers not-found and never recreates .specs/<slug>/ (got " +
    (rj14 ? JSON.stringify(rj14).slice(0, 200) : (rr14.stdout + rr14.stderr).slice(0, 200)) + ")");
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

if (inSection("wp17")) { // 1.13 batch 8 — `dev-spec upgrade [--apply]` (= spec_upgrade): the audit, the migrations, UPGRADE.md, PT, --json, exit codes
  const S17 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const readJ17 = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
  // A legacy project: made by this engine, then stripped of what 1.13 records (meta.specVersion, saved tracks); one feature
  // with a requirements approval whose fingerprint still matches (no history), one task ticked.
  const legacy17 = (dir, lang) => {
    S17.initProject(dir, ["core"], lang);
    S17.createFeature(dir, "Draft", ["core"]);
    const half = S17.createFeature(dir, "Half", ["core"]);
    const rmF = path.join(dir, ".specs", "roadmap.json");
    const rm = readJ17(rmF);
    delete rm.meta.specVersion;
    fs.writeFileSync(rmF, JSON.stringify(rm, null, 2));
    for (const slug of ["draft", "half"]) {
      const p = path.join(dir, ".specs", slug, ".state.json");
      const st = readJ17(p);
      delete st.tracks;
      if (slug === "half") {
        const req = fs.readFileSync(path.join(half.dir, "requirements.md"), "utf8").replace(/\r\n/g, "\n");
        st.approvals = { requirements: { at: "2026-01-01T10:00:00.000Z", by: "old", fingerprint: require("crypto").createHash("sha1").update(req).digest("hex") } };
      }
      fs.writeFileSync(p, JSON.stringify(st, null, 2));
    }
    const tk = path.join(half.dir, "tasks.md");
    fs.writeFileSync(tk, fs.readFileSync(tk, "utf8").replace("- [ ]", "- [x]"));
  };

  const u17 = path.join(tmp, "wp17-legacy");
  legacy17(u17, "en");
  const au17 = run(["upgrade", "--project", u17]);
  let auJ17 = null;
  try { auJ17 = JSON.parse(run(["upgrade", "--json", "--project", u17]).out); } catch { /* invalid JSON */ }
  ok(au17.code === 0 && /^dev-spec upgrade — \.specs\/ from before 1\.13 \(no version stamp\) → dev-spec /m.test(au17.out) && /2 active feature\(s\): /.test(au17.out) &&
    /▸ draft — not started/.test(au17.out) && /▸ half — executing/.test(au17.out) && /Review it with the spec-critic agent/.test(au17.out) && /converge pass/.test(au17.out) &&
    /^Apply would change/m.test(au17.out) && /approval baselines to save to \.history\/ \(the file still matches its approval\): half\/requirements/.test(au17.out) &&
    !fs.existsSync(path.join(u17, ".specs", "UPGRADE.md")) && auJ17 && JSON.stringify(auJ17) === JSON.stringify(S17.specUpgrade(u17)),
    "upgrade (CLI): the audit — header, summary, per-feature status and review, what apply would change — exit 0, nothing written; --json = the engine / MCP result (got " + au17.out.slice(0, 200) + ")");

  const ap17 = run(["upgrade", "--apply", "--project", u17]);
  const st17 = readJ17(path.join(u17, ".specs", "half", ".state.json"));
  const ap17b = run(["upgrade", "--apply", "--project", u17]);
  let ap17j = null;
  try { ap17j = JSON.parse(run(["upgrade", "--apply", "--json", "--project", u17]).out); } catch { /* invalid JSON */ }
  ok(ap17.code === 0 && /^Migrations applied/m.test(ap17.out) && /meta\.specVersion: none → /.test(ap17.out) && /approval baselines saved: half\/\.history\/requirements@1\.md/.test(ap17.out) &&
    /^Report: \.specs\/UPGRADE\.md/m.test(ap17.out) && fs.existsSync(path.join(u17, ".specs", "UPGRADE.md")) && fs.existsSync(path.join(u17, ".specs", "half", ".history", "requirements@1.md")) &&
    Array.isArray(st17.tracks) && S17.readRoadmap(u17).meta.specVersion === S17.engineVersion() &&
    ap17b.code === 0 && /Nothing to migrate — \.specs\/ is already up to date; nothing was changed\./.test(ap17b.out) &&
    ap17j && ap17j.ok === true && ap17j.migrations.changed === false && ap17j.from === S17.engineVersion(),
    "upgrade --apply (CLI): the migrations done and the report path, exit 0; a second --apply says nothing to migrate; --json carries `migrations` (got " + ap17.out.slice(-300) + ")");

  // Switches read strictly; no .specs/ is an error (exit 1); PT output.
  const bad17 = run(["upgrade", "--apply=maybe", "--project", u17]);
  const none17 = run(["upgrade", "--project", path.join(tmp, "wp17-nothing")]);
  const pt17 = path.join(tmp, "wp17-pt");
  legacy17(pt17, "pt");
  const ptOut17 = run(["upgrade", "--project", pt17]);
  const ptAp17 = run(["upgrade", "--apply", "--project", pt17]);
  ok(bad17.code === 1 && /--apply must be a boolean/.test(bad17.out) && none17.code === 1 && /No \.specs\/ at/.test(none17.out) &&
    ptOut17.code === 0 && /2 feature\(s\) ativa\(s\)/.test(ptOut17.out) && /por começar/.test(ptOut17.out) && /^O apply mudaria/m.test(ptOut17.out) &&
    ptAp17.code === 0 && /^Migrações aplicadas/m.test(ptAp17.out) && /^Relatório: \.specs\/UPGRADE\.md/m.test(ptAp17.out),
    "upgrade: --apply=maybe is refused (exit 1), no .specs/ exits 1; a PT project gets European-Portuguese output");

  // help + the header docblock list the subcommand and its flag.
  const help17 = run(["help"]).out;
  const doc17 = fs.readFileSync(CLI, "utf8").split("*/")[0];
  ok(/upgrade \[--apply\]/.test(help17) && /--apply \(upgrade\)/.test(help17) && /upgrade \[--apply\]/.test(doc17) && /upgrade: --apply/.test(doc17),
    "help and the header docblock list upgrade [--apply]");
}

if (inSection("pa1")) { // 1.14 package A1 (CLI tests)
  // `dev-spec prompts [name] [--args "…"]` = MCP prompts/list · prompts/get (the same module, mcp/lib/prompts-resources.js).
  const PRa1 = require(path.join(__dirname, "..", "mcp", "lib", "prompts-resources.js"));
  const stemsA1 = fs.readdirSync(path.join(__dirname, "..", "commands")).filter((f) => /\.md$/.test(f)).map((f) => f.slice(0, -3));
  const jsonA1 = (r) => { try { return JSON.parse(r.out); } catch { return null; } };

  const listA1 = run(["prompts", "--json"]);
  const listA1j = jsonA1(listA1);
  ok(listA1.code === 0 && listA1j && listA1j.ok === true && listA1j.prompts.length === stemsA1.length && stemsA1.length >= 44 &&
    listA1j.prompts.map((p) => p.name).sort().join() === stemsA1.slice().sort().join() && listA1j.prompts.every((p) => p.description && p.arguments[0].name === "args") &&
    JSON.stringify(listA1j.prompts) === JSON.stringify(PRa1.listPrompts({ lang: "en" })),
    "prompts --json: one prompt per commands/*.md with its description and `args` argument — the list MCP prompts/list sends (+ argumentHint)");
  const humanA1 = run(["prompts"]);
  ok(humanA1.code === 0 && new RegExp("^" + stemsA1.length + " prompt\\(s\\) — one per plugin command").test(humanA1.out) &&
    /^ {2}spec-impact \[feature name\] \[requirements\|design\|test-plan\|eval-plan\|tasks\|steering\] \[--reopen\]$/m.test(humanA1.out) && /^ {2}coverage$/m.test(humanA1.out),
    "prompts: a header, then each prompt with its argument hint and description");

  const getA1 = run(["prompts", "spec-impact", "--args", "login design"]);
  const posA1 = run(["prompts", "spec-impact", "login", "design"]);
  const getA1j = jsonA1(run(["prompts", "spec-impact", "--args", "login design", "--json"]));
  const mcpA1 = PRa1.getPrompt("spec-impact", "login design", { lang: "en" });
  ok(getA1.code === 0 && /^Note for the agent: if no dev-spec-driven skill is available/.test(getA1.out) && /\nArgs: login design\n/.test(getA1.out) && !/\$ARGUMENTS/.test(getA1.out) &&
    posA1.code === 0 && posA1.out === getA1.out && getA1.out === mcpA1.messages[0].content.text && getA1j && JSON.stringify(getA1j) === JSON.stringify(mcpA1),
    "prompts <name> --args \"…\" prints the prompt prompts/get returns ($ARGUMENTS ← args); the words after the name do the same; --json is the MCP-shaped result");
  const noArgA1 = run(["prompts", "spec-impact"]);
  ok(noArgA1.code === 0 && /\nArgs: \n/.test(noArgA1.out), "prompts <name> without arguments: $ARGUMENTS is empty");

  const unkA1 = run(["prompts", "nope"]);
  const unkA1j = run(["prompts", "nope", "--json"]);
  const bothA1 = run(["prompts", "spec", "x", "--args", "y"]);
  const missA1 = run(["prompts", "spec", "--args"]);
  ok(unkA1.code === 1 && /^dev-spec: Unknown prompt 'nope' — one of: .*spec-impact/.test(unkA1.out) && unkA1j.code === 1 && (jsonA1(unkA1j) || {}).ok === false &&
    bothA1.code === 1 && /usage: dev-spec prompts \[name\] \[--args "…"\]/.test(bothA1.out) && missA1.code === 1 && /--args/.test(missA1.out),
    "prompts: an unknown name exits 1 (--json: {ok:false} on stdout); --args plus extra words is a usage error; --args needs a value");

  const ptA1 = path.join(tmp, "pa1-pt");
  run(["init", "--lang", "pt", "--project", ptA1]);
  const ptListA1 = run(["prompts", "--project", ptA1]);
  const ptGetA1 = run(["prompts", "coverage", "--project", ptA1]);
  ok(/^\d+ prompt\(s\) — um por comando do plugin/.test(ptListA1.out) && /^Nota para o agente: se não houver uma skill dev-spec-driven/.test(ptGetA1.out) &&
    /Prompt desconhecido 'x'/.test(run(["prompts", "x", "--project", ptA1]).out),
    "prompts in a PT project: header, preamble and errors in European Portuguese");

  const helpA1 = run(["help"]).out;
  const docA1 = fs.readFileSync(CLI, "utf8").split("*/")[0];
  ok(/prompts \[name\] \[--args "…"\]/.test(helpA1) && /--args "…" \(prompts\)/.test(helpA1) && /prompts \[name\] \[--args "…"\]/.test(docA1) && /prompts: --args "…"/.test(docA1),
    "help and the header docblock list prompts [name] [--args \"…\"] and the --args flag");
}

if (inSection("pa2")) { // 1.14 package A2 (CLI tests) — the +sec / +privacy tracks on the CLI, EN / PT / ES
  const a2 = path.join(tmp, "pa2-proj");
  const cls = run(["classify", "Threat model the export and pseudonymize personal data", "--project", a2]);
  const clsEs = run(["classify", "Modelo de amenazas y cifrado en reposo de los datos personales", "--project", a2]);
  ok(cls.code === 0 && /Tracks: core \+sec \+privacy/.test(cls.out) && /sec=medium, privacy=high/.test(cls.out) && /\+sec: ON/.test(cls.out) && /\+privacy: ON/.test(cls.out) &&
    /core \+sec \+privacy/.test(clsEs.out) && /sec=alta, privacy=media/.test(clsEs.out) && /\+sec: ACTIVO \[confianza alta\] — señales encontradas: modelo de amenazas, cifrado en reposo/.test(clsEs.out),
    "classify prints the +sec / +privacy confidence and reasoning (EN and ES)");
  const ini = run(["init", "sec", "privacy", "--lang", "es", "--project", a2]);
  ok(ini.code === 0 && /security\.md, privacy\.md/.test(ini.out) && /^# Estándares de Seguridad/.test(fs.readFileSync(path.join(a2, ".specs", "steering", "security.md"), "utf8")),
    "init sec privacy --lang es writes the ES security.md / privacy.md steering stubs");
  const cr = run(["create", "Exportar", "--tracks", "sec,privacy", "--lang", "pt", "--project", a2]);
  const st = run(["status", "exportar", "--project", a2]).out;
  ok(cr.code === 0 && /\[core \+sec \+privacy\] \(pt\)/.test(cr.out) && /Secções de segurança: ◐ Modelo de Ameaças \(por preencher\)/.test(st) &&
    /Secções de privacidade: ◐ Inventário de Dados Pessoais \(por preencher\)[^\n]*◐ AIPD \(por preencher\)/.test(st),
    "create --tracks sec,privacy (PT) → status shows the security and privacy sections ◐ unfilled, in Portuguese");
  const doc = run(["doctor", "exportar", "--project", a2]);
  const appr = run(["approve", "exportar", "design", "--project", a2]);
  ok(doc.code === 1 && /✗ sec-sections — Modelo de Ameaças:por preencher/.test(doc.out) && /✗ privacy-sections — /.test(doc.out) &&
    appr.code === 1 && /sec-sections, privacy-sections/.test(appr.out),
    "doctor exits 1 with sec-sections / privacy-sections failing; approve design is refused naming them");
  const des = path.join(a2, ".specs", "exportar", "design.md");
  fs.writeFileSync(des, fs.readFileSync(des, "utf8").split(/\r?\n/).filter((l) => !/^\s*>\s*\*\*TODO\*\*/.test(l)).join("\n"));
  const doc2 = run(["doctor", "exportar", "--project", a2]).out;
  const js = JSON.parse(run(["status", "exportar", "--json", "--project", a2]).out);
  ok(/✓ sec-sections — as 5 preenchidas/.test(doc2) && /✓ privacy-sections — as 6 preenchidas/.test(doc2) && /✓ Modelo de Ameaças · ✓ Requisitos de Segurança/.test(run(["status", "exportar", "--project", a2]).out) &&
    js.secSections.length === 5 && js.secSections.every((s) => s.filled) && js.privacySections.length === 6 && js.scaleSections === null,
    "once the TODO lines are gone doctor passes both section checks and status marks them ✓ (--json: secSections / privacySections)");
  run(["create", "Plain", "core", "--lang", "en", "--project", a2]);
  const typo = run(["add-track", "plain", "secc", "--project", a2]);
  const add = run(["add-track", "plain", "sec", "privacy", "--project", a2]);
  const rm = run(["add-track", "plain", "privacy", "--remove", "--project", a2]);
  const stPlain = run(["status", "plain", "--project", a2]).out;
  ok(typo.code === 1 && /did you mean 'sec'/.test(typo.out) && add.code === 0 && /core \+sec \+privacy/.test(add.out) &&
    rm.code === 0 && /design\.md \(\[PRIVACY\] sections\)/.test(rm.out) && /Security sections: ◐ Threat Model \(unfilled\)/.test(stPlain) && !/Privacy sections/.test(stPlain),
    "add-track: 'secc' gets a did-you-mean, sec+privacy are added, --remove privacy lists its inactive [PRIVACY] sections and status stops showing them");
  const stSec = run(["steering", "security.md", "--lang", "pt", "--project", path.join(tmp, "pa2-steer")]);
  const kiro = path.join(a2, ".kiro", "specs", "accounts");
  fs.mkdirSync(kiro, { recursive: true });
  fs.writeFileSync(path.join(kiro, "requirements.md"), "### Requirement 1\n\n**User Story:** As a user, I want to delete my account.\n\n#### Acceptance Criteria\n\n1. WHEN the user confirms THEN the system SHALL delete the account\n");
  const imp = run(["import", "kiro", ".kiro/specs/accounts", "--tracks", "sec,privacy", "--lang", "en", "--project", a2]); // the project default is ES (init above)
  const impDesign = fs.existsSync(path.join(a2, ".specs", "accounts", "design.md")) ? fs.readFileSync(path.join(a2, ".specs", "accounts", "design.md"), "utf8") : "";
  ok(stSec.code === 0 && /^# Padrões de Segurança/.test(fs.readFileSync(path.join(tmp, "pa2-steer", ".specs", "steering", "security.md"), "utf8")) &&
    imp.code === 0 && /## \[SEC\] Threat Model/.test(impDesign) && /## \[PRIVACY\] Data Subject Rights/.test(impDesign),
    "steering security.md (PT template, not a custom file) and import --tracks sec,privacy (the [SEC] / [PRIVACY] design sections)");
  const help = run(["help"]).out;
  const usage = run(["add-track", "--project", a2]).out;
  ok(/core\/\+tdd\/\+saas\/\+ai\/\+sec\/\+privacy/.test(help) && /\+tdd\/\+saas\/\+ai\/\+sec\/\+privacy \(additive, never overwrites\)/.test(help) && /<tdd\|saas\|ai\|sec\|privacy>/.test(usage),
    "help and the add-track usage name the +sec / +privacy tracks");
}

if (inSection("pa4")) { // 1.14 package A4 (CLI tests)
// A4.2 — a _Verify:_ that pipes reports the pipeline's LAST exit code. `done --run` prints ONE localized hint before running
// (it still runs — here the failing first command is masked, so the task ticks: exactly the problem), then the engine's
// pipeMasked note. A quoted '|' and '||' get no hint. Brief and doctor name the piped tasks. Commands run in cmd.exe and sh alike.
const Sa4 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
const pa4 = path.join(tmp, "pa4-proj");
Sa4.initProject(pa4, ["core"], "en");
const fa4 = Sa4.createFeature(pa4, "Pipes", ["core"], "", undefined, "en");
const tasksA4 = path.join(fa4.dir, "tasks.md");
fs.writeFileSync(tasksA4, "# Tasks\n\n" +
  "- [ ] 1. [US1] Masked failure\n  - _Verify: node -e \"process.exit(3)\" | node -e \"process.exit(0)\"_\n" +
  "- [ ] 2. [US1] Quoted pipe\n  - _Verify: node -e \"console.log('a|b')\"_\n" +
  "- [ ] 3. [US1] Or-chain\n  - _Verify: node -e \"process.exit(0)\" || node -e \"process.exit(1)\"_\n" +
  "- [ ] 4. [US1] JSON run\n  - _Verify: node -e \"process.exit(0)\" | node -e \"process.exit(0)\"_\n");
const ra4 = (args) => run([...args, "--project", pa4]);
const hintRe = /pipes into another command: the shell reports only the LAST command's exit code/;
const brA4 = ra4(["brief", "pipes", "4"]);
const brQA4 = ra4(["brief", "pipes", "2"]);
const docA4 = ra4(["doctor", "pipes"]);
ok(brA4.code === 0 && /## Verification \(_Verify:_\)[\s\S]*pipes into another command: a pipeline's exit code is its LAST command's/.test(brA4.out) && brQA4.code === 0 && !/pipes into another/.test(brQA4.out) &&
  /▲ verify-pipes — a _Verify:_ command pipes into another one .*: #1 `node -e "process\.exit\(3\)" \| node -e "process\.exit\(0\)"`; #4 /.test(docA4.out) && !/#2 |#3 /.test((docA4.out.match(/verify-pipes.*/) || [""])[0]),
  "brief notes a piped _Verify:_ (not a quoted '|'); doctor prints the verify-pipes warn naming #1 and #4 only (got " + JSON.stringify((docA4.out.match(/.*verify-pipes.*/) || [""])[0].slice(0, 300)) + ")");
const d1A4 = ra4(["done", "pipes", "1", "--run"]);
const hintAt = d1A4.out.search(hintRe), runAt = d1A4.out.indexOf("$ node -e");
ok(d1A4.code === 0 && hintAt >= 0 && runAt > hintAt && d1A4.out.split("\n").filter((l) => hintRe.test(l)).length === 1 && /Task 1 done \(verified\)/.test(d1A4.out) &&
  /⚠ Task 1: the recorded command pipes into another one/.test(d1A4.out) && /- \[x\] 1\. \[US1\] Masked failure/.test(fs.readFileSync(tasksA4, "utf8")),
  "done --run on a piped _Verify:_: one hint line BEFORE the run (it still runs — the masked failure ticks the task), then the pipeMasked note (got " + JSON.stringify(d1A4.out.slice(0, 400)) + ")");
const d2A4 = ra4(["done", "pipes", "2", "--run"]);
const d3A4 = ra4(["done", "pipes", "3", "--run"]);
ok(d2A4.code === 0 && d3A4.code === 0 && !/pipes into another/.test(d2A4.out + d3A4.out) && /a\|b/.test(d2A4.out),
  "done --run: a '|' inside quotes and '||' print no pipe hint and no pipeMasked note (got " + JSON.stringify([d2A4.out.slice(0, 200), d3A4.out.slice(0, 200)]) + ")");
const jA4 = spawnSync(process.execPath, [CLI, "done", "pipes", "4", "--run", "--json", "--project", pa4], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: tmp } });
let jA4r = null;
try { jA4r = JSON.parse(jA4.stdout); } catch { /* invalid JSON */ }
ok(jA4.status === 0 && jA4r && jA4r.pipeMasked === true && jA4r.completed === 4 && hintRe.test(jA4.stderr) && !hintRe.test(jA4.stdout),
  "done --run --json: stdout stays one JSON document carrying pipeMasked: true; the hint goes to stderr");
// PT feature: the hint and the note in Portuguese.
const ptA4 = Sa4.createFeature(pa4, "Tubos", ["core"], "", undefined, "pt");
fs.writeFileSync(path.join(ptA4.dir, "tasks.md"), "# Tarefas\n\n- [ ] 1. [US1] Pipe\n  - _Verify: node -e \"process.exit(0)\" | node -e \"process.exit(0)\"_\n");
const dPtA4 = ra4(["done", "tubos", "1", "--run"]);
ok(dPtA4.code === 0 && /⚠ `node -e "process\.exit\(0\)" \| node -e "process\.exit\(0\)"` encaminha a saída para outro comando \(pipe\): a shell só reporta o exit code do ÚLTIMO comando/.test(dPtA4.out) &&
  /⚠ Tarefa 1: o comando registado encaminha a saída para outro/.test(dPtA4.out),
  "done --run on a PT feature: the pipe hint and the pipeMasked note are in Portuguese (got " + JSON.stringify(dPtA4.out.slice(0, 300)) + ")");
}

if (inSection("pb1")) { // 1.14 package B1 (CLI tests) — `dev-spec templates [list|init|check] [artifact] [--lang]` = spec_templates
  const SB1 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const b1 = path.join(tmp, "pb1-proj");
  const tpl = (...p) => path.join(b1, ".specs", "templates", ...p);
  const jsonOf = (r) => { try { return JSON.parse(r.out); } catch { return null; } };
  const lsEmpty = run(["templates", "--project", b1]);
  const lsEmptyJ = jsonOf(run(["templates", "list", "--json", "--project", b1]));
  ok(lsEmpty.code === 0 && /^Templates for 'en' features — 0 project override\(s\) in \.specs\/templates\//.test(lsEmpty.out) && /· requirements\s+built-in/.test(lsEmpty.out) &&
    lsEmptyJ && JSON.stringify(lsEmptyJ) === JSON.stringify(SB1.templates(b1, "list")),
    "templates (no action) lists every template as built-in; --json is spec_templates' result");
  const in1 = run(["templates", "init", "requirements", "--project", b1]);
  const in2 = run(["templates", "init", "requirements.md", "--project", b1]);
  const inPt = run(["templates", "init", "--lang", "pt", "--project", b1]);
  ok(in1.code === 0 && /1 built-in template\(s\) copied into \.specs\/templates\//.test(in1.out) && /\+ \.specs\/templates\/requirements\.md/.test(in1.out) &&
    fs.readFileSync(tpl("requirements.md"), "utf8").startsWith("# Feature: {{name}}") && in2.code === 0 && /Nothing copied/.test(in2.out) &&
    inPt.code === 0 && /28 template\(s\) de base copiado\(s\) para \.specs\/templates\//.test(inPt.out) && fs.readFileSync(tpl("pt", "design.md"), "utf8").startsWith("# Design: {{name}}") &&
    fs.existsSync(tpl("pt", "steering", "tech.md")),
    "templates init <artifact> copies one built-in template (never over an existing one); init --lang pt copies all 28 (1.16: + steering/glossary.md) into .specs/templates/pt/, reported in Portuguese");
  const ckClean = run(["templates", "check", "--project", b1]);
  ok(ckClean.code === 0 && /^29 template file\(s\) checked — 0 error\(s\), 0 warning\(s\)\./.test(ckClean.out), "templates check on the copied built-in templates: clean, exit 0");
  // A team template: used by `create`, variables substituted; a broken design template → check exits 1 naming the missing section.
  fs.writeFileSync(tpl("requirements.md"), "# Req — {{name}} ({{slug}}, {{tracks}})\n\n## Summary\n{{summary}}\n\n## Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN [nu trigger] THE SYSTEM SHALL [nu behaviour]\n");
  const cr = run(["create", "Team Report", "--tracks", "saas", "--summary", "Weekly numbers", "--json", "--project", b1]);
  const crJ = jsonOf(cr);
  const crReq = crJ && crJ.ok ? fs.readFileSync(path.join(crJ.dir, "requirements.md"), "utf8") : "";
  ok(cr.code === 0 && crJ.templates["requirements.md"] === ".specs/templates/requirements.md" && crReq.startsWith("# Req — Team Report (team-report, core +saas)\n\n## Summary\nWeekly numbers\n") &&
    /#### \[SaaS\] Acceptance Criteria \(EARS\)/.test(crReq) && run(["doctor", "team-report", "--project", b1]).code === 1,
    "create uses the project's requirements template ({{name}}, {{slug}}, {{tracks}}, {{summary}} substituted, the +saas criteria appended); doctor still fails the untouched scaffold");
  fs.writeFileSync(tpl("design.md"), "# D — {{name}}\n\n## Constitution Check\n- [ ] [p]\n\n## [SaaS] Performance Budget\n> **TODO** — fill.\n");
  const ckBad = run(["templates", "check", "design", "--project", b1]);
  const ckBadJ = jsonOf(run(["templates", "check", "design", "--json", "--project", b1]));
  ok(ckBad.code === 1 && /✗ \.specs\/templates\/design\.md — \[SaaS\] Scale Design is missing/.test(ckBad.out) && /✗ \.specs\/templates\/design\.md — \[SaaS\] Observability is missing/.test(ckBad.out) &&
    ckBadJ && JSON.stringify(ckBadJ.problems) === JSON.stringify(SB1.templates(b1, "check", { artifact: "design" }).problems) && ckBadJ.verdict === "fail",
    "templates check <artifact> exits 1 on an error (a design template with one [SaaS] heading lacks the other mandatory sections); --json = spec_templates check");
  const ckPt = run(["templates", "check", "--lang", "pt", "--project", b1]);
  ok(ckPt.code === 1 && /ficheiro\(s\) de template verificado\(s\)/.test(ckPt.out) && /falta \[SaaS\] Observabilidade|falta \[SaaS\] Observability/.test(ckPt.out),
    "templates check --lang pt: the shared templates plus pt/, reported in Portuguese");
  const badAct = run(["templates", "delete", "--project", b1]);
  const trav = run(["templates", "init", "../../evil", "--project", b1]);
  const travJ = jsonOf(run(["templates", "init", "steering/../../x", "--json", "--project", b1]));
  const badLang = run(["templates", "list", "--lang", "fr", "--project", b1]);
  const extra = run(["templates", "list", "a", "b", "--project", b1]);
  ok(badAct.code === 1 && /Unknown templates action 'delete'/.test(badAct.out) && trav.code === 1 && /Unknown template '\.\.\/\.\.\/evil'/.test(trav.out) &&
    travJ && travJ.ok === false && /Unknown template/.test(travJ.error) && !fs.existsSync(path.join(tmp, "evil")) && !fs.existsSync(path.join(b1, ".specs", "evil")) &&
    badLang.code === 1 && /--lang must be one of: en, pt, es/.test(badLang.out) && extra.code === 1 && /dev-spec templates \[list\|init\|check\]/.test(extra.out),
    "templates refuses an unknown action, a name outside the allowlist (traversal — --json prints the refusal), an unknown --lang and extra arguments (exit 1)");
  const help = run(["help"]);
  ok(/templates \[list\|init\|check\] \[artifact\] \[--lang\]/.test(help.out), "help lists the templates command");
}

if (inSection("pb2")) { // 1.14 package B2 (CLI tests)
// B2.1 `dev-spec export [feature] [--md] [--write]` = spec_export; B2.2 `dev-spec changelog [--since …] [--write]` = spec_changelog.
const Sb2 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
const pb2 = path.join(tmp, "pb2-proj");
Sb2.initProject(pb2, ["core"], "en");
const fb2 = Sb2.createFeature(pb2, "Checkout", ["core"], "", undefined, "en");
fs.writeFileSync(path.join(fb2.dir, "requirements.md"), "# Feature: Checkout\n\n## Summary\nPay for the cart in one step.\n\n### US-1 (P1): Pay\n" +
  "1. **US-1.AC-1** — WHEN the shopper pays THE SYSTEM SHALL show the receipt <script>alert(1)</script>\n");
fs.writeFileSync(path.join(fb2.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Charge the card\n  - _Requirements: US-1.AC-1_\n");
const rb2 = (args) => run([...args, "--project", pb2]);
const jb2 = (args) => { const r = spawnSync(process.execPath, [CLI, ...args, "--json", "--project", pb2], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: tmp } }); let j = null; try { j = JSON.parse(r.stdout); } catch { /* not JSON */ } return { code: r.status, j, err: r.stderr }; };
const noDateB2 = (s) => String(s).replace(/\d{4}-\d{2}-\d{2}/g, "D");
const eHtml = rb2(["export", "checkout"]);
const eJ = jb2(["export", "checkout"]);
ok(eHtml.code === 0 && /^<!doctype html>\n<!-- AUTO-GENERATED by dev-spec/.test(eHtml.out) && !/https?:\/\//.test(eHtml.out) && /&lt;script&gt;alert\(1\)&lt;\/script&gt;/.test(eHtml.out) &&
  (eHtml.out.match(/<script/g) || []).length === 1 && eJ.code === 0 && eJ.j && eJ.j.ok && eJ.j.scope === "feature" &&
  noDateB2(eJ.j.content) === noDateB2(Sb2.exportSpecs(pb2, { name: "checkout" }).content) && noDateB2(eHtml.out) === noDateB2(eJ.j.content),
  "export <feature>: the offline HTML document on stdout (escaped, one script); --json = spec_export's result, the same content as the engine");
const eMdW = rb2(["export", "checkout", "--md", "--write"]);
const ePrW = rb2(["export", "--write"]);
const mdFile = path.join(pb2, ".specs", "exports", "checkout.md");
ok(eMdW.code === 0 && /^✎ wrote .*checkout\.md\s*$/.test(eMdW.out) && /^# Checkout\n\n<!-- AUTO-GENERATED by dev-spec/.test(fs.readFileSync(mdFile, "utf8")) &&
  ePrW.code === 0 && /project\.html/.test(ePrW.out) && /<section class="feature" id="s-f-checkout">/.test(fs.readFileSync(path.join(pb2, ".specs", "exports", "project.html"), "utf8")),
  "export --md --write → .specs/exports/checkout.md; export --write (no feature) → .specs/exports/project.html");
fs.writeFileSync(mdFile, "# mine\n");
const eHand = rb2(["export", "checkout", "--md", "--write"]);
const eHandJ = jb2(["export", "checkout", "--md", "--write"]);
const eBad = rb2(["export", "checkout", "--md", "--html"]);
const eNf = rb2(["export", "nope"]);
ok(eHand.code === 1 && /\.specs\/exports\/checkout\.md exists and was not generated by dev-spec/.test(eHand.out) && fs.readFileSync(mdFile, "utf8") === "# mine\n" &&
  eHandJ.code === 1 && eHandJ.j && eHandJ.j.ok === false && eHandJ.j.skipped === true && eBad.code === 1 && /usage/i.test(eBad.out) && eNf.code === 1 && /not found/i.test(eNf.out),
  "export: a hand-written export is never overwritten (exit 1; --json prints the refusal); --md with --html is a usage error; an unknown feature exits 1");

// changelog: a finished feature, a shipped bugfix, a change request on a feature shipped earlier.
const setState = (dir, extra) => { const sp = path.join(dir, ".state.json"); fs.writeFileSync(sp, JSON.stringify(Object.assign(JSON.parse(fs.readFileSync(sp, "utf8")), extra), null, 2)); };
setState(fb2.dir, { finished: { at: "2026-06-15T10:00:00.000Z", files: {} } });
const bb2 = Sb2.createFeature(pb2, "Crash on save", ["core"], "", undefined, "en", "bugfix");
fs.writeFileSync(path.join(bb2.dir, "bug.md"), "# Bug: Crash on save\n\n## Summary\nSaving crashes.\n\n## Root Cause\nA null buffer after close.\n");
setState(bb2.dir, { approvals: { execution: { at: "2026-06-20T10:00:00.000Z", by: "carol" } } });
const ob2 = Sb2.createFeature(pb2, "Login", ["core"], "", undefined, "en");
fs.writeFileSync(path.join(ob2.dir, "requirements.md"), "# Feature: Login\n\n### US-1 (P1): Sign in\n1. **US-1.AC-1** — IF the password is wrong THEN THE SYSTEM SHALL show an error\n");
setState(ob2.dir, { finished: { at: "2026-01-10T10:00:00.000Z", files: {} }, changes: [{ at: "2026-06-11T10:00:00.000Z", phase: "requirements", added: [], modified: ["US-1.AC-1"], removed: [], reopened: [] }] });
const cMd = rb2(["changelog", "--since", "2026-05-01"]);
const cJ = jb2(["changelog", "--since", "2026-05-01"]);
const pickB2 = (r) => JSON.stringify([r.since, r.sinceSource, r.added, r.changed, r.fixed, r.counts]);
ok(cMd.code === 0 && /^# Release notes — pb2-proj\n/.test(cMd.out) && /\n## Added\n\n### Checkout\n\nPay for the cart in one step\.\n\n- \*\*US-1\.AC-1\*\* — WHEN the shopper pays/.test(cMd.out) &&
  /\n## Changed\n\n- \*\*login\*\* — change request #1 \(Requirements, 2026-06-11\): modified: US-1\.AC-1\n  - \*\*US-1\.AC-1\*\* — IF the password is wrong/.test(cMd.out) &&
  /\n## Fixed\n\n- \*\*Crash on save\*\* — Saving crashes\. — Root cause: A null buffer after close\./.test(cMd.out) &&
  cJ.code === 0 && cJ.j && pickB2(cJ.j) === pickB2(Sb2.changelog(pb2, { since: "2026-05-01" })) && JSON.stringify(cJ.j.counts) === '{"added":1,"changed":1,"fixed":1}',
  "changelog --since <date>: the release notes on stdout (Added · Changed · Fixed); --json = spec_changelog's result");
const cBad = rb2(["changelog", "--since", "soon"]);
const cNoVal = rb2(["changelog", "--since"]);
const cLast = run(["changelog", "--since", "last", "--project", pb2]);
ok(cBad.code === 1 && /since: 'soon' is not an ISO date/.test(cBad.out) && cNoVal.code === 1 && /since/.test(cNoVal.out) &&
  cLast.code === 0 && /No release notes were written yet/.test(cLast.out) && /^# Release notes/m.test(cLast.out),
  "changelog: a bad --since exits 1 (localized), --since without a value is refused; --since last without a stamp notes it on stderr and lists everything");
const cW = rb2(["changelog", "--write"]);
const stampB2 = Sb2.readRoadmap(pb2).meta.changelogAt;
const cW2 = rb2(["changelog", "--write"]);
// No stamp yet → everything: login (finished in January) is new in these notes, so its change request folds into it.
ok(cW.code === 0 && /^✎ wrote .*RELEASE-NOTES\.md — 2 added · 0 changed · 1 fixed\s*$/.test(cW.out) && typeof stampB2 === "string" &&
  /AUTO-GENERATED by dev-spec/.test(fs.readFileSync(path.join(pb2, ".specs", "RELEASE-NOTES.md"), "utf8")) &&
  cW2.code === 0 && /Nothing to report since then/.test(cW2.out) && Sb2.readRoadmap(pb2).meta.changelogAt === stampB2,
  "changelog --write → .specs/RELEASE-NOTES.md + meta.changelogAt; run again: nothing to report, nothing written or re-stamped (exit 0)");
fs.writeFileSync(path.join(pb2, ".specs", "RELEASE-NOTES.md"), "# ours\n");
const cHand = rb2(["changelog", "--since", "all", "--write"]);
ok(cHand.code === 1 && /RELEASE-NOTES\.md exists and was not generated by dev-spec/.test(cHand.out) && fs.readFileSync(path.join(pb2, ".specs", "RELEASE-NOTES.md"), "utf8") === "# ours\n",
  "changelog --write never overwrites a hand-written RELEASE-NOTES.md (exit 1)");

// PT project: the chrome of both documents in European Portuguese.
const pt2 = path.join(tmp, "pb2-pt");
Sb2.initProject(pt2, ["core"], "pt");
const fpt2 = Sb2.createFeature(pt2, "Pagamento", ["core"], "Pagar o carrinho.", undefined, "pt");
setState(fpt2.dir, { finished: { at: "2026-06-01T00:00:00.000Z", files: {} } });
const ptE = run(["export", "pagamento", "--md", "--project", pt2]);
const ptC = run(["changelog", "--project", pt2]);
const ptW = run(["export", "pagamento", "--write", "--project", pt2]);
ok(ptE.code === 0 && /_Especificação da feature · gerado a /.test(ptE.out) && /\n## Resumo\n\nPagar o carrinho\.\n/.test(ptE.out) && /\n## Histórias de utilizador e critérios de aceitação\n/.test(ptE.out) &&
  ptC.code === 0 && /^# Notas de versão — pb2-pt\n/.test(ptC.out) && /\n## Adicionado\n/.test(ptC.out) && /\n## Corrigido\n\n_Nada\._/.test(ptC.out) &&
  ptW.code === 0 && /^✎ gerado .*pagamento\.html/.test(ptW.out),
  "export / changelog on a PT project: European Portuguese chrome (Resumo, Histórias de utilizador…, Notas de versão, Adicionado / Corrigido, ✎ gerado)");
}

if (inSection("pb3")) { // 1.14 package B3 (CLI tests) — approvals by role (init --roles, approve --role) and the fast-forward (approve --through), EN / PT
  const Sb3 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const jsonB3 = (r) => { try { return JSON.parse(r.out); } catch { return null; } };
  const REQb3 = "# Feature: x\n\n## Summary\nExport invoices as CSV.\n\n### US-1 (P1 — MVP): Export\n#### Acceptance Criteria (EARS)\n" +
    "1. **US-1.AC-1** — WHEN an admin clicks Export THE SYSTEM SHALL download a CSV.\n2. **US-1.AC-2** — WHILE an export runs, WHEN the admin clicks again THE SYSTEM SHALL ignore it.\n" +
    "3. **US-1.AC-3** — IF the export fails THEN THE SYSTEM SHALL show the error code.\n4. **US-1.AC-4** — THE SYSTEM SHALL name files invoices-YYYY-MM.csv.\n\n" +
    "### US-2 (P2): Schedule\n#### Acceptance Criteria (EARS)\n1. **US-2.AC-1** — WHEN a schedule is due THE SYSTEM SHALL email the CSV.\n\n" +
    "## Success Criteria\n- **SC-001** — 95% of exports finish in under 5 s.\n\n## Out of Scope\n- PDF export.\n";
  const DESIGNb3 = "# Design: x\n\n## Overview\nA nightly job and an endpoint.\n\n## Architecture\n```mermaid\ngraph TD\n  A-->B\n```\n\n## Constitution Check\n- [x] Principle 1 — complies\n";
  const TASKSb3 = "# Tasks\n\n- [ ] 1. [US1] Build the CSV writer\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4, US-2.AC-1_\n  - _Verify: [manual: open the CSV in a spreadsheet]_\n";
  const fillB3 = (proj, slug, skip = []) => {
    const dir = path.join(proj, ".specs", slug);
    const w = (rel, text) => fs.writeFileSync(path.join(dir, rel), text);
    w("classification.md", fs.readFileSync(path.join(dir, "classification.md"), "utf8").split("\n").map((l) => (/^- /.test(l) ? l : l.replace(/\[[^\]]*\]/g, "filled"))).join("\n"));
    if (!skip.includes("requirements")) w("requirements.md", REQb3);
    if (!skip.includes("design")) w("design.md", DESIGNb3);
    if (!skip.includes("tasks")) w("tasks.md", TASKSb3);
  };
  const metaB3 = (proj) => (JSON.parse(fs.readFileSync(path.join(proj, ".specs", "roadmap.json"), "utf8")).meta || {});

  // init --roles = spec_init {approvalRoles}: stored, refused when malformed, --roles none clears
  const pr = path.join(tmp, "pb3-roles");
  const init = run(["init", "--roles", "requirements=product,design=tech+security", "--project", pr]);
  const bad = run(["init", "--roles", "tech", "--project", pr]);
  const badPhase = run(["init", "--roles", "plan=tech", "--project", pr]);
  const badJ = jsonB3(run(["init", "--roles", "design=tech lead!", "--json", "--project", pr]));
  ok(init.code === 0 && /Approval roles: requirements=product · design=tech\+security — /.test(init.out) &&
    JSON.stringify(metaB3(pr).approvalRoles) === '{"requirements":["product"],"design":["tech","security"]}' &&
    bad.code === 1 && /approvalRoles must map phases to role lists/.test(bad.out) && badPhase.code === 1 && /unknown phase 'plan'/.test(badPhase.out) &&
    badJ && badJ.ok === false && /invalid role name/.test(badJ.error) && JSON.stringify(metaB3(pr).approvalRoles) === '{"requirements":["product"],"design":["tech","security"]}',
    "init --roles stores roadmap.json meta.approvalRoles and prints the roles; a role before any phase, an unknown phase or a bad role name exits 1 and changes nothing");

  // approve --role: required on a listed phase, a sign-off leaves it pending until every role signed; doctor / next-action / finish name the missing role
  run(["create", "Invoice export", "core", "--project", pr]);
  fillB3(pr, "invoice-export");
  run(["approve", "invoice-export", "classification", "--project", pr]);
  const noRole = run(["approve", "invoice-export", "requirements", "--project", pr]);
  const noRoleJ = jsonB3(run(["approve", "invoice-export", "requirements", "--json", "--project", pr]));
  const prod = run(["approve", "invoice-export", "requirements", "--role", "product", "--project", pr]);
  const tech = run(["approve", "invoice-export", "design", "--role", "tech", "--by", "tom", "--project", pr]);
  ok(noRole.code === 1 && /'requirements' is signed off per role \(product\) — say which role you sign for: \/approve invoice-export requirements --role <role>/.test(noRole.out) &&
    noRoleJ && noRoleJ.ok === false && noRoleJ.roleRequired === true && noRoleJ.roles.join() === "product" &&
    prod.code === 0 && /^Approved 'requirements' for invoice-export ✓\n {2}'requirements' is approved — every role signed off the current content: product\./.test(prod.out) &&
    tech.code === 0 && /^Signed off 'design' for invoice-export as tech ✓\n {2}⚠ 'design' stays pending until every role has signed off its current content — missing role: security\./.test(tech.out),
    "approve --role: a listed phase refuses an approval without a role (exit 1; --json roleRequired); its only role approves it; one of two roles leaves it pending (the missing role named)");
  const doc = run(["doctor", "invoice-export", "--project", pr]);
  const na = run(["next-action", "invoice-export", "--project", pr]);
  const fin = run(["finish", "invoice-export", "--project", pr]);
  ok(/▲ approval-gates — awaiting human approval: design \(missing role: security\), tasks/.test(doc.out) &&
    /→ Review & sign off 'design' — missing role: security \(signed: tech\): \/approve invoice-export design --role security\./.test(na.out) &&
    fin.code === 1 && /phases awaiting approval: design \(missing role: security\), tasks/.test(fin.out),
    "doctor, next-action and finish name the role a pending phase still waits for (the same engine view as MCP)");

  // approve --through (the fast-forward) with a role: security completes design, then tasks (no roles there: the role is recorded)
  const ff = run(["approve", "invoice-export", "--through", "tasks", "--role", "security", "--project", pr]);
  const st = JSON.parse(fs.readFileSync(path.join(pr, ".specs", "invoice-export", ".state.json"), "utf8"));
  ok(ff.code === 0 && /^Fast-forward 'invoice-export': approved design, tasks, in order, each through its own gate/.test(ff.out) && /\n {2}✓ design \[security\]\n {2}✓ tasks \[security\]/.test(ff.out) &&
    Object.keys(st.approvals.design.roles).sort().join() === "security,tech" && st.approvals.design.batch === true && st.approvals.tasks.role === "security",
    "approve --through tasks --role security: the fast-forward signs each phase as that role — design completes (tech + security), tasks is approved; one line per phase");

  // the fast-forward without roles: next-action names it; a refused gate stops it (exit 1) with what was approved before
  const pf = path.join(tmp, "pb3-ff");
  run(["init", "--project", pf]);
  run(["create", "Quick spec", "core", "--project", pf]);
  fillB3(pf, "quick-spec");
  const na2 = run(["next-action", "quick-spec", "--project", pf]);
  const ff2 = run(["approve", "quick-spec", "--through", "tasks", "--project", pf]);
  const met2 = run(["metrics", "quick-spec", "--project", pf]);
  ok(/fast-forward: \/spec-ff quick-spec \(CLI: dev-spec approve quick-spec --through tasks\) approves classification, requirements, design, tasks in order/.test(na2.out) &&
    ff2.code === 0 && /approved classification, requirements, design, tasks/.test(ff2.out) && /batch approvals \(fast-forward\): 4/.test(met2.out) &&
    /→ Implement task #1/.test(run(["next-action", "quick-spec", "--project", pf]).out),
    "next-action names the fast-forward (/spec-ff + approve --through tasks); approve --through approves every phase; metrics counts the batch approvals");
  run(["create", "Refused ff", "core", "--project", pf]);
  fillB3(pf, "refused-ff", ["design"]);
  const ffR = run(["approve", "refused-ff", "--through", "tasks", "--project", pf]);
  const ffRj = jsonB3(run(["approve", "refused-ff", "--through", "tasks", "--json", "--project", pf]));
  ok(ffR.code === 1 && /^dev-spec: Fast-forward 'refused-ff' stopped at 'design' \(approved before it: classification, requirements\) — its gate refuses it — failing checks: placeholders/.test(ffR.out) &&
    ffRj && ffRj.ok === false && ffRj.refused === true && ffRj.stoppedAt === "design" && ffRj.approved.length === 0 && ffRj.failing.includes("placeholders") &&
    /stopped at 'design' \(nothing approved\)/.test(ffRj.error),
    "approve --through stops at the first refused gate: exit 1 naming the phases approved before it and the failing checks; --json → {ok:false, refused, stoppedAt, approved} (a rerun resumes there)");

  // CLI = MCP: the same engine call gives the same fast-forward on a twin project; usage and argument errors
  const tw = path.join(tmp, "pb3-twin");
  Sb3.initProject(tw, ["core"], "en");
  Sb3.createFeature(tw, "Quick spec", ["core"]);
  fillB3(tw, "quick-spec");
  const eng = Sb3.approvePhase(tw, "quick-spec", undefined, "x", { through: "tasks" });
  const pf2 = path.join(tmp, "pb3-twin-cli");
  run(["init", "--project", pf2]); run(["create", "Quick spec", "core", "--project", pf2]); fillB3(pf2, "quick-spec");
  const cliJ = jsonB3(run(["approve", "quick-spec", "--through", "tasks", "--by", "x", "--json", "--project", pf2]));
  const usageB3 = run(["approve", "quick-spec", "--project", pf2]);
  const bothB3 = run(["approve", "quick-spec", "design", "--through", "tasks", "--project", pf2]);
  const execB3 = run(["approve", "quick-spec", "--through", "execution", "--project", pf2]);
  ok(cliJ && JSON.stringify([cliJ.ok, cliJ.complete, cliJ.approved, cliJ.steps, cliJ.message]) === JSON.stringify([eng.ok, eng.complete, eng.approved, eng.steps, eng.message]) &&
    usageB3.code === 1 && /approve <feature> --through <phase>/.test(usageB3.out) && bothB3.code === 1 && /either a phase or through/.test(bothB3.out) &&
    execB3.code === 1 && /covers the planning phases only/.test(execB3.out),
    "approve --through --json = spec_approve {through} (same approved / steps / message); approve without a phase or --through is a usage error; a phase plus --through and --through execution are refused");

  // PT: role sign-off and fast-forward messages in European Portuguese; --roles none clears
  const pp = path.join(tmp, "pb3-pt");
  run(["init", "--lang", "pt", "--roles", "design=tech+security", "--project", pp]);
  run(["create", "Exportar faturas", "core", "--project", pp]);
  fillB3(pp, "exportar-faturas");
  run(["approve", "exportar-faturas", "classification", "--project", pp]);
  run(["approve", "exportar-faturas", "requirements", "--project", pp]);
  const ptSign = run(["approve", "exportar-faturas", "design", "--role", "tech", "--project", pp]);
  const ptFf = run(["approve", "exportar-faturas", "--through", "tasks", "--role", "security", "--project", pp]);
  const ptClear = run(["init", "--roles", "none", "--project", pp]);
  ok(/^'design' de exportar-faturas validada como tech ✓\n {2}⚠ 'design' continua pendente até todos os papéis validarem o seu conteúdo atual — falta o papel: security\./.test(ptSign.out) &&
    /^Avanço rápido de 'exportar-faturas': design, tasks aprovadas, por ordem/.test(ptFf.out) &&
    /Papéis de aprovação removidos — cada fase volta a precisar de uma única aprovação\./.test(ptClear.out) && metaB3(pp).approvalRoles === undefined,
    "PT: the role sign-off, the fast-forward summary and --roles none (cleared) print in European Portuguese");

  const helpB3 = run(["help"]).out;
  const docB3 = fs.readFileSync(CLI, "utf8").split("*/")[0];
  ok(/--roles requirements=product,design=tech\+security/.test(helpB3) && /approve <feature> --through <phase> {2}Fast-forward \(\/spec-ff\)/.test(helpB3) &&
    /--role ROLE \/ --through PHASE \(approve\)/.test(helpB3) && /--roles requirements=product,design=tech\+security/.test(docB3) && /approve <feature> --through <phase>/.test(docB3) &&
    /--role ROLE = the role you sign off for/.test(docB3),
    "help and the header docblock document init --roles, approve --role and approve --through");
}

if (inSection("pb4")) { // 1.14 package B4 (CLI tests)
  // Forecasts (done records ticks → velocity → ETA) and cross-feature overlaps on the CLI = the engine (spec_roadmap / spec_metrics
  // / spec_doctor), EN and PT; a project with no completed task prints nothing new.
  const Sb4 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const jsonB4 = (r) => { try { return JSON.parse(r.out); } catch { return null; } };
  const pb4 = path.join(tmp, "pb4-proj");
  const rb4 = (args) => run([...args, "--project", pb4]);
  run(["init", "--lang", "en", "--project", pb4]);
  const apiB4 = Sb4.createFeature(pb4, "Api", ["core"], "", undefined, "en");
  const webB4 = Sb4.createFeature(pb4, "Web", ["core"], "", undefined, "en");
  fs.writeFileSync(path.join(apiB4.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Routes\n  - _Size: S_\n  - _Implements: src/api/routes.js_\n- [ ] 2. [US1] Auth\n  - _Size: S_\n" +
    "- [ ] 3. [US1] Paging\n  - _Size: S_\n- [ ] 4. [US1] Shared client\n  - _Size: M_\n  - _Implements: src/shared/client.js_\n");
  fs.writeFileSync(path.join(webB4.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Web shell\n  - _Implements: src/shared/_\n");
  const noDataB4 = rb4(["roadmap"]);
  ok(noDataB4.code === 0 && !/Velocity|ETA/.test(noDataB4.out) && /⚠ 1 cross-feature file overlap\(s\):\n {2}api ↔ web: src\/shared\/client\.js/.test(noDataB4.out),
    "roadmap before any completed task: no velocity / ETA line (nothing new), but the overlap is listed (got " + JSON.stringify(noDataB4.out) + ")");
  const doneB4 = [1, 2, 3].map((n) => rb4(["done", "api", String(n)]));
  const ticksB4 = (JSON.parse(fs.readFileSync(path.join(apiB4.dir, ".state.json"), "utf8")).ticks) || {};
  ok(doneB4.every((r) => r.code === 0) && ["1", "2", "3"].every((k) => typeof ticksB4[k] === "string" && Math.abs(Date.parse(ticksB4[k]) - Date.now()) < 120000),
    "done records when each task was ticked (.state.json ticks[n])");
  const rmB4 = rb4(["roadmap"]);
  const engB4 = Sb4.roadmapReport(pb4);
  const fApi = engB4.features.find((f) => f.name === "api");
  const etaApi = Sb4.etaText(fApi.forecast, "en", true);
  ok(rmB4.code === 0 && typeof fApi.forecast.eta === "string" && etaApi && new RegExp("^ {5}api +\\d+% .*  · " + etaApi.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "m").test(rmB4.out) &&
    /^Velocity: \d+(\.\d+)? point\(s\)\/working day — 3 task\(s\), 6 point\(s\) completed since \d{4}-\d{2}-\d{2} \(last 28 days\)$/m.test(rmB4.out) &&
    /^ETA = remaining points ÷ velocity, in working days \(±25%\)/m.test(rmB4.out) && /^ {2}api ↔ web: src\/shared\/client\.js$/m.test(rmB4.out),
    "roadmap prints each feature's ETA, the velocity, the ETA rule and the overlaps (got " + JSON.stringify(rmB4.out) + ")");
  const rjB4 = jsonB4(rb4(["roadmap", "--json"]));
  const pickB4 = (r) => JSON.stringify(r && [r.velocity, r.overlaps, r.features.map((f) => [f.name, f.forecast])]);
  ok(rjB4 && pickB4(rjB4) === pickB4(engB4) && rjB4.velocity.enough === true, "roadmap --json = spec_roadmap: the same velocity, forecasts and overlaps");
  const docB4 = rb4(["doctor", "web"]);
  ok(/▲ cross-feature-overlap — open tasks plan the same files as another active feature — api \(src\/shared\/client\.js\)/.test(docB4.out) &&
    /verdict=/.test(docB4.out) && !/✗ cross-feature-overlap/.test(docB4.out),
    "doctor prints the cross-feature-overlap line as a warn (▲, never ✗) (got " + JSON.stringify((docB4.out.match(/.*cross-feature.*/) || [""])[0].slice(0, 200)) + ")");
  const metB4 = rb4(["metrics", "api"]);
  const metJB4 = jsonB4(rb4(["metrics", "--json"]));
  ok(/^ {2}velocity: \d+(\.\d+)? point\(s\)\/working day \(3 task\(s\), 6 point\(s\) since \d{4}-\d{2}-\d{2}, last 28 days\)$/m.test(metB4.out) &&
    metJB4 && JSON.stringify(metJB4.velocity) === JSON.stringify(Sb4.metrics(pb4).velocity),
    "metrics prints the feature's velocity; metrics --json carries the project's (= spec_metrics)");
  const wrB4 = rb4(["roadmap", "--write"]);
  const rmMdB4 = fs.readFileSync(path.join(pb4, ".specs", "ROADMAP.md"), "utf8");
  ok(wrB4.code === 0 && /\| Next \| ETA \|/.test(rmMdB4) && rmMdB4.includes("| " + Sb4.etaText(fApi.forecast, "en") + " |") && /- \*\*api\*\* — plans the same files as web: src\/shared\/client\.js/.test(rmMdB4),
    "roadmap --write: ROADMAP.md carries the ETA column and the overlap under Needs attention");

  const ptB4 = path.join(tmp, "pb4-pt");
  run(["init", "--lang", "pt", "--project", ptB4]);
  const agoraB4 = Sb4.createFeature(ptB4, "Agora", ["core"], "", undefined, "pt");
  const depoisB4 = Sb4.createFeature(ptB4, "Depois", ["core"], "", undefined, "pt");
  fs.writeFileSync(path.join(agoraB4.dir, "tasks.md"), "# Tarefas\n\n- [ ] 1. [US1] A\n- [ ] 2. [US1] B\n- [ ] 3. [US1] C\n- [ ] 4. [US1] D\n  - _Implements: src/x.js_\n");
  fs.writeFileSync(path.join(depoisB4.dir, "tasks.md"), "# Tarefas\n\n- [ ] 1. [US1] E\n  - _Implements: src/x.js:3_\n");
  [1, 2, 3].forEach((n) => run(["done", "agora", String(n), "--project", ptB4]));
  const ptRmB4 = run(["roadmap", "--project", ptB4]);
  const ptMetB4 = run(["metrics", "agora", "--project", ptB4]);
  const ptDocB4 = run(["doctor", "depois", "--project", ptB4]);
  ok(/^ {5}agora .*  · previsão \d{4}-\d{2}-\d{2}/m.test(ptRmB4.out) && /^Velocidade: .* ponto\(s\)\/dia útil — 3 tarefa\(s\)/m.test(ptRmB4.out) &&
    /^⚠ 1 sobreposição\(ões\) de ficheiros entre features:\n {2}agora ↔ depois: src\/x\.js$/m.test(ptRmB4.out) && /^ {2}velocidade: .* ponto\(s\)\/dia útil/m.test(ptMetB4.out) &&
    /▲ cross-feature-overlap — há tarefas por fazer que planeiam os mesmos ficheiros que outra feature ativa — agora \(src\/x\.js\)/.test(ptDocB4.out),
    "PT project: roadmap's previsão / Velocidade / sobreposição lines, metrics' velocidade and doctor's overlap detail in European Portuguese (got " + JSON.stringify(ptRmB4.out.slice(0, 500)) + ")");
  const helpB4 = run(["help"]).out;
  const docblockB4 = fs.readFileSync(CLI, "utf8").split("*/")[0];
  ok(/roadmap \[--write\]\[--html\]\[--lang\] +Roadmap: .*ETA per feature \(velocity from ticked tasks, _Size: XS\|S\|M\|L\|XL_\), cross-feature file overlaps/.test(helpB4) &&
    /metrics \[feature\] \[--write\] +Lead times.*velocity/.test(helpB4) && /Multi-feature roadmap: ETA forecasts, cross-feature overlaps/.test(docblockB4),
    "help and the header docblock mention the roadmap's ETA / overlaps and metrics' velocity");
}

if (inSection("pb5")) { // 1.14 package B5 (CLI tests)
// B5 — `done --run` honours _Expect: fail_ (+ records the git commit), `init --check` / `finish --run` (meta.checks), `dev-spec log`.
// Commands run in cmd.exe and sh alike (node -e "…" in double quotes); git runs isolated from the user's config and is optional.
const Sb5 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
const b5cfg = path.join(tmp, "b5-gitconfig");
fs.writeFileSync(b5cfg, "");
const b5Env = { ...process.env, SPEC_PROJECT_DIR: tmp, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: b5cfg, HOME: tmp, XDG_CONFIG_HOME: tmp,
  GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" };
const rb5 = (args, input) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: b5Env, input });
  return { out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "", stderr: r.stderr || "", code: r.status };
};
const gitB5 = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8", env: b5Env });
const hasGitB5 = (() => { const g = gitB5(tmp, "--version"); return !g.error && g.status === 0; })();
const stB5 = (dir, slug) => JSON.parse(fs.readFileSync(path.join(dir, ".specs", slug, ".state.json"), "utf8"));
const jsonB5 = (s) => { try { return JSON.parse(s); } catch { return null; } };

// done --run: an _Expect: fail_ task's passing command is refused; a failing one is its red proof (a line says so; --json keeps one document).
const pb = path.join(tmp, "b5-cli");
Sb5.initProject(pb, ["tdd"], "en");
const fb = Sb5.createFeature(pb, "Redcli", ["tdd"], "", undefined, "en");
fs.writeFileSync(path.join(fb.dir, "tasks.md"), "- [ ] 1. [US1] Write T-01 red\n  - _Verify: node -e \"process.exit(0)\"_\n  - _Expect: fail_\n" +
  "- [ ] 2. [US1] Write T-02 red\n  - _Verify: node -e \"process.exit(3)\"_\n  - _Expect: fail_\n- [ ] 3. [US1] Must pass\n  - _Verify: node -e \"process.exit(0)\"_\n");
const dPass = rb5(["done", "redcli", "1", "--run", "--project", pb]);
const dRed = rb5(["done", "redcli", "2", "--run", "--project", pb]);
const dRedJ = rb5(["done", "redcli", "2", "--run", "--json", "--project", pb]);
const dRedJr = jsonB5(dRedJ.stdout);
const tasksB5 = fs.readFileSync(path.join(fb.dir, "tasks.md"), "utf8");
const ev2B5 = stB5(pb, "redcli").evidence["2"];
ok(dPass.code === 1 && /Task 1 expects its test to FAIL \(_Expect: fail_\), but the run passed \(exit 0\)/.test(dPass.out) && /- \[ \] 1\./.test(tasksB5) &&
  dRed.code === 0 && /Task 2 done \(verified\)/.test(dRed.out) && /✓ red run recorded for task 2 \(exit 3\) — the test fails before its fix/.test(dRed.out) && /- \[x\] 2\./.test(tasksB5) &&
  dRedJ.code === 0 && dRedJr && dRedJr.redRecorded === true && dRedJr.expected === "fail" && dRedJr.alreadyDone === true && !/red run recorded/.test(dRedJ.stdout) &&
  ev2B5.expected === "fail" && ev2B5.exitCode === 3 && (!("commit" in ev2B5) || gitB5(pb, "rev-parse", "HEAD").status === 0),
  "done --run on an _Expect: fail_ task: a passing _Verify:_ is refused (task stays open), a failing one ticks it as the red proof with a line saying so; --json keeps stdout one document (redRecorded, expected: 'fail'); no git repository → no commit recorded (got " +
  JSON.stringify([dPass.out.slice(0, 160), dRed.out.slice(0, 240)]) + ")");

// done --run records the commit it ran on and whether the tree was dirty (changes under .specs/ don't count) — git read-only.
if (hasGitB5) {
  const pg = path.join(tmp, "b5-git");
  fs.mkdirSync(pg, { recursive: true });
  gitB5(pg, "init", "-q");
  fs.writeFileSync(path.join(pg, "app.js"), "module.exports = 1;\n");
  gitB5(pg, "add", "app.js");
  gitB5(pg, "commit", "-q", "-m", "init");
  const headB5 = (gitB5(pg, "rev-parse", "--short", "HEAD").stdout || "").trim().toLowerCase();
  Sb5.initProject(pg, ["core"], "en");
  const fg = Sb5.createFeature(pg, "Gitrun", ["core"], "", undefined, "en");
  fs.writeFileSync(path.join(fg.dir, "tasks.md"), "- [ ] 1. [US1] A\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 2. [US1] B\n  - _Verify: node -e \"process.exit(0)\"_\n");
  const g1 = rb5(["done", "gitrun", "1", "--run", "--project", pg]);
  fs.appendFileSync(path.join(pg, "app.js"), "// edited\n");
  const g2 = rb5(["done", "gitrun", "2", "--run", "--project", pg]);
  const evg = stB5(pg, "gitrun").evidence;
  ok(g1.code === 0 && g2.code === 0 && /^[0-9a-f]{4,40}$/.test(headB5) && evg["1"].commit === headB5 && evg["1"].dirty === false && evg["2"].commit === headB5 && evg["2"].dirty === true &&
    evg["1"].history[0].commit === headB5,
    "done --run records the commit it ran on (git rev-parse --short HEAD) and whether the tree was dirty — the spec's own files under .specs/ don't count (got " + JSON.stringify([headB5, evg["1"], evg["2"].dirty]).slice(0, 300) + ")");
} else ok(true, "done --run git evidence — skipped (git is not available)");

// init --check: repeatable, name= removes one, a bad value is refused (localized); the result line lists the checks.
const pc = path.join(tmp, "b5-checks");
const rmPcB5 = () => JSON.parse(fs.readFileSync(path.join(pc, ".specs", "roadmap.json"), "utf8")).meta.checks;
const ic1 = rb5(["init", "--check", "test=npm test", "--check", "lint=npm run lint", "--project", pc]);
const m1B5 = rmPcB5();
const ic2 = rb5(["init", "--check", "lint=", "--project", pc]);
const m2B5 = rmPcB5();
const icBad = rb5(["init", "--check", "oops", "--project", pc]);
const icBadName = rb5(["init", "--check", "bad name=x", "--project", pc]);
const m3B5 = rmPcB5();
const icJ = rb5(["init", "--json", "--check=e2e=node e2e.js", "--project", pc]);
const icJr = jsonB5(icJ.stdout);
const icPt = rb5(["init", "--lang", "pt", "--check", "e2e=node e2e.js", "--project", path.join(tmp, "b5-checks-pt")]);
const icEs = rb5(["init", "--lang", "es", "--check", "oops", "--project", path.join(tmp, "b5-checks-es")]);
ok(ic1.code === 0 && /Project checks \(meta\.checks\): test → npm test · lint → npm run lint/.test(ic1.out) && JSON.stringify(m1B5) === JSON.stringify({ test: "npm test", lint: "npm run lint" }) &&
  ic2.code === 0 && JSON.stringify(m2B5) === JSON.stringify({ test: "npm test" }) && icBad.code === 1 && /--check expects name=command \(got 'oops'\)/.test(icBad.out) &&
  icBadName.code === 1 && /invalid check name 'bad name'/.test(icBadName.out) && JSON.stringify(m3B5) === JSON.stringify(m2B5) &&
  icJ.code === 0 && icJr && JSON.stringify(icJr.checks) === JSON.stringify({ test: "npm test", e2e: "node e2e.js" }) &&
  icPt.code === 0 && /Verificações do projeto \(meta\.checks\): e2e → node e2e\.js/.test(icPt.out) && icEs.code === 1 && /--check espera nombre=comando \(recibido 'oops'\)/.test(icEs.out),
  "init --check name=cmd (repeatable, --check=… too) sets roadmap.json meta.checks, name= removes one, a value without '=' or a bad name is refused writing nothing; --json reports the checks; PT line, ES error (got " +
  JSON.stringify([ic1.out.slice(-120), icBad.out.slice(0, 120)]) + ")");

// finish --run: runs every project check (from the project root), records each (a failure too — it stays a blocker); --json; PT.
const pf = path.join(tmp, "b5-finish");
rb5(["init", "--check", "test=node -e \"process.exit(0)\"", "--check", "lint=node -e \"process.exit(2)\"", "--project", pf]);
const ffB5 = Sb5.createFeature(pf, "Fin", ["core"], "", undefined, "en");
fs.writeFileSync(path.join(ffB5.dir, "tasks.md"), "- [x] 1. [US1] Done\n");
const fr = rb5(["finish", "fin", "--run", "--project", pf]);
const fcB5 = stB5(pf, "fin").finishChecks;
const frJ = rb5(["finish", "fin", "--run", "--json", "--project", pf]);
const frJr = jsonB5(frJ.stdout);
const fPtB5 = Sb5.createFeature(pf, "Fim", ["core"], "", undefined, "pt");
fs.writeFileSync(path.join(fPtB5.dir, "tasks.md"), "- [x] 1. [US1] Feito\n");
const frPt = rb5(["finish", "fim", "--run", "--project", pf]);
const frNone = rb5(["finish", "redcli", "--run", "--project", pb]);
ok(fr.code === 1 && /\$ node -e "process\.exit\(0\)" {3}\(test\)/.test(fr.out) && /\$ node -e "process\.exit\(2\)" {3}\(lint\)/.test(fr.out) && /Recorded 2 project check run\(s\) in \.state\.json → finishChecks\./.test(fr.out) &&
  /✗ project checks without a passing run since the last task activity: lint \(latest run failed \(exit 2\)\)/.test(fr.out) && !/test \(no run/.test(fr.out) && fcB5.test.exitCode === 0 && fcB5.lint.exitCode === 2 &&
  frJ.code === 1 && frJr && frJr.recordedChecks.length === 2 && frJr.suiteChecks.find((c) => c.name === "test").status === "pass" && /\$ node -e/.test(frJ.stderr) && !/\$ node -e/.test(frJ.stdout) &&
  /Registada\(s\) 2 execução\(ões\) de verificações do projeto/.test(frPt.out) && /verificações do projeto sem uma execução bem-sucedida .*: lint \(a última execução falhou \(exit 2\)\)/.test(frPt.out) &&
  frNone.code === 1 && /no project checks to run \(roadmap\.json meta\.checks\) — set them: dev-spec init --check test="npm test"/.test(frNone.out),
  "finish --run runs each meta.checks command and records it (a failure stays the suite-evidence blocker); --json keeps stdout one document; PT; without meta.checks it runs nothing and exits 1 (got " +
  JSON.stringify([fr.out.slice(0, 300), frNone.out.slice(0, 120)]) + ")");
const pp = path.join(tmp, "b5-finish-pipe");
rb5(["init", "--check", "piped=node -e \"process.exit(0)\" | node -e \"process.exit(0)\"", "--project", pp]);
Sb5.createFeature(pp, "Pipe", ["core"], "", undefined, "en");
const fpipe = rb5(["finish", "pipe", "--run", "--project", pp]);
let posixOk = true;
if (process.platform === "win32") {
  const px = path.join(tmp, "b5-finish-posix");
  rb5(["init", "--check", "sq=node -e 'process.exit(0)'", "--project", px]);
  Sb5.createFeature(px, "Posix", ["core"], "", undefined, "en");
  const fpx = rb5(["finish", "posix", "--run", "--project", px]);
  posixOk = fpx.code === 1 && /the project check 'sq' \(`node -e 'process\.exit\(0\)'`\) uses POSIX shell syntax \(single quotes/.test(fpx.out) && !stB5(px, "posix").finishChecks;
}
ok(/pipes into another command: the shell reports only the LAST command's exit code/.test(fpipe.out) && stB5(pp, "pipe").finishChecks.piped.exitCode === 0 && posixOk,
  "finish --run prints the pipe hint for a piped check (it still runs and is recorded); on Windows a check in POSIX syntax is refused before anything runs under cmd.exe");

// dev-spec log: per task the commits citing it + the +tdd red-first check, from git log (read-only) or a log on stdin; localized.
const lgIn = rb5(["log", "redcli", "-", "--project", pb], "abc1234 feat(redcli): task #3 done\ndef5678 chore: other\n");
const fRegB5 = Sb5.createFeature(pb, "Registo", ["core"], "", undefined, "pt");
fs.writeFileSync(path.join(fRegB5.dir, "tasks.md"), "- [ ] 1. [US1] Algo\n");
const fEsB5 = Sb5.createFeature(pb, "Registro", ["core"], "", undefined, "es");
fs.writeFileSync(path.join(fEsB5.dir, "tasks.md"), "- [ ] 1. [US1] Algo\n");
const lgPt = rb5(["log", "registo", "-", "--project", pb], "abc1234 x\n");
const lgEs = rb5(["log", "registro", "-", "--project", pb], "abc1234 x\n");
const lgUnknown = rb5(["log", "nope", "-", "--project", pb], "");
ok(lgIn.code === 0 && /^Commits: redcli — 2 commit\(s\) read, 1 cite its tasks/m.test(lgIn.out) && /\[ \] #3 Must pass — abc1234 feat\(redcli\): task #3 done \(#3\)/.test(lgIn.out) &&
  /^Commits: registo — 1 commit\(s\) lido\(s\), 0 citam as suas tarefas/m.test(lgPt.out) && /Nenhum commit cita uma tarefa de 'registo'/.test(lgPt.out) &&
  /^Commits: registro — 1 commit\(s\) leído\(s\), 0 citan sus tareas/m.test(lgEs.out) && /Ningún commit cita una tarea de 'registro'/.test(lgEs.out) && lgUnknown.code === 1,
  "dev-spec log <feature> - reads a log from stdin (no git needed): 'task #N' with the feature name cites task N; PT / ES output; an unknown feature exits 1 (got " + JSON.stringify(lgIn.out.slice(0, 200)) + ")");
const noRepoB5 = !hasGitB5 || gitB5(pb, "rev-parse", "--git-dir").status !== 0;
const lgNo = rb5(["log", "redcli", "--project", pb]);
ok(!noRepoB5 || (lgNo.code === 1 && /git is not available here, or this is not a git repository with commits/.test(lgNo.out)),
  "dev-spec log outside a git repository (or without git) exits 1 with a localized hint to pipe a log in");
if (hasGitB5) {
  const pl = path.join(tmp, "b5-log");
  fs.mkdirSync(path.join(pl, "src"), { recursive: true });
  gitB5(pl, "init", "-q");
  Sb5.initProject(pl, ["tdd"], "en");
  const fl = Sb5.createFeature(pl, "Clog", ["tdd"], "", undefined, "en");
  fs.writeFileSync(path.join(fl.dir, "tasks.md"), "- [ ] 1. [US1] Write T-01 red\n  - _Expect: fail_\n- [ ] 2. [US1] Implement\n  - _Makes green: T-01_\n- [ ] 3. [US1] Docs\n");
  fs.writeFileSync(path.join(pl, "src", "a.js"), "module.exports = 1;\n");
  gitB5(pl, "add", "src/a.js");
  gitB5(pl, "commit", "-q", "-m", "feat(clog): implement\n\nPart of .specs/clog/ task #2.\nMakes T-01 green.");
  fs.mkdirSync(path.join(pl, "tests"));
  fs.writeFileSync(path.join(pl, "tests", "clog.test.js"), "test(\"T-01 works\", () => {});\n");
  gitB5(pl, "add", "tests/clog.test.js");
  gitB5(pl, "commit", "-q", "-m", "test(clog): T-01");
  const lg = rb5(["log", "clog", "--project", pl]);
  const lgJ = rb5(["log", "clog", "--json", "--project", pl]);
  const lgJr = jsonB5(lgJ.stdout);
  const lgMax = rb5(["log", "clog", "--max", "1", "--project", pl]);
  ok(lg.code === 0 && /^Commits: clog — 2 commit\(s\) read, 2 cite its tasks/m.test(lg.out) && /\[ \] #2 Implement — [0-9a-f]{7} test\(clog\): T-01 \(T-01\); [0-9a-f]{7} feat\(clog\): implement \(#2, T-01\)/.test(lg.out) &&
    /▲ red-first: task 2 \(makes T-01 green\) was first committed in [0-9a-f]{7}, before any commit touching a test file that names T-01 \(tests\/clog\.test\.js — first in [0-9a-f]{7}\)/.test(lg.out) &&
    /\[ \] #3 Docs — no commit cites it/.test(lg.out) && lgJr && lgJr.commits === 2 && lgJr.redFirst.find((r) => r.task === 2).status === "impl-first" &&
    lgMax.code === 0 && /1 commit\(s\) read \(the window is full/.test(lgMax.out) && /red-first: task 2 \(T-01\) — can't tell: the log window is full/.test(lgMax.out),
    "dev-spec log reads git log (read-only): per task the commits citing it ('task #N' + the feature name, T-IDs), the red-first warning when the implementation was committed before its test; --json; --max bounds the window (got " +
    JSON.stringify(lg.out.slice(0, 500)) + ")");
} else ok(true, "dev-spec log over a real git repository — skipped (git is not available)");

// help and the header docblock document the new command and flags.
const hB5 = rb5(["help"]).out;
const docB5 = fs.readFileSync(CLI, "utf8").split("*/")[0];
ok(["log <feature> [--max N] [-]", "--check name=\"cmd\"", "finish <feature> [--write] [--include-body] [--run]", "_Expect: fail_"].every((w) => hB5.includes(w) && docB5.includes(w)),
  "help and the header docblock document log, init --check, finish --run and _Expect: fail_");
}

if (inSection("pc1")) { // 1.14 package C1 (CLI tests) — `init --guard scope` / `--stop-check on|off`, `dev-spec stop-check` (= spec.stopCheck, the Stop hook's decision)
  const Sc1 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const rc1 = (args, input) => {
    const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: tmp, CLAUDE_PROJECT_DIR: "" }, input });
    return { out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "", code: r.status };
  };
  const jc1 = (s) => { try { return JSON.parse(s); } catch { return null; } };
  const metaC1 = (p) => JSON.parse(fs.readFileSync(path.join(p, ".specs", "roadmap.json"), "utf8")).meta || {};

  // init --guard scope · --stop-check on|off (= spec_init {guard: "scope"}, {stopCheck}); bad values refused, localized.
  const p1 = path.join(tmp, "c1-init");
  const gs = rc1(["init", "--guard", "Scope", "--project", p1]);
  const gsJ = jc1(rc1(["init", "--json", "--project", p1]).stdout);
  const so = rc1(["init", "--stop-check", "off", "--project", p1]);
  const soOff = metaC1(p1).stopCheck;
  const sOn = rc1(["init", "--stop-check=on", "--json", "--project", p1]);
  const sOnJ = jc1(sOn.stdout);
  const sBad = rc1(["init", "--stop-check", "maybe", "--project", p1]);
  const gBad = rc1(["init", "--guard", "strict", "--project", p1]);
  const sPt = rc1(["init", "--lang", "pt", "--stop-check", "off", "--guard", "scope", "--project", path.join(tmp, "c1-init-pt")]);
  const sEs = rc1(["init", "--lang", "es", "--stop-check", "quizá", "--project", path.join(tmp, "c1-init-es")]);
  ok(gs.code === 0 && /Guard mode SCOPE/.test(gs.out) && metaC1(p1).guard === "scope" && gsJ && gsJ.guard === "scope" && gsJ.stopCheck === true && gsJ.guardNote === undefined &&
    so.code === 0 && /Evidence gate OFF/.test(so.out) && soOff === false && sOn.code === 0 && sOnJ && sOnJ.stopCheck === true && /Evidence gate ON/.test(sOnJ.stopCheckNote) && metaC1(p1).stopCheck === true &&
    sBad.code === 1 && /--stop-check takes on or off \(got 'maybe'\)/.test(sBad.out) && gBad.code === 1 && /--guard takes on, off or scope \(got 'strict'\)/.test(gBad.out) &&
    sPt.code === 0 && /Gate de evidência DESLIGADO/.test(sPt.out) && /Modo guarda SCOPE \(âmbito\)/.test(sPt.out) && sEs.code === 1 && /--stop-check admite on u off \(recibido 'quizá'\)/.test(sEs.out),
    "init --guard scope (any case) → meta.guard 'scope'; --stop-check off|on → meta.stopCheck (the result reports both; a note when set); bad values exit 1, localized (PT lines, ES error) (got " +
    JSON.stringify([gs.out.slice(-160), so.out.slice(-120), sBad.out.slice(0, 120)]) + ")");

  // stop-check = spec.stopCheck: the same result (--json), the reason and exit 1 when the turn would be sent back, a localized line and exit 0 otherwise.
  const p2 = path.join(tmp, "c1-stop");
  Sc1.initProject(p2, ["core"], "en");
  const f2 = Sc1.createFeature(p2, "Billing", ["core"], "", undefined, "en");
  fs.writeFileSync(path.join(f2.dir, "tasks.md"), "- [ ] 1. [US1] Charge\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 2. [US1] Refund\n");
  Sc1.completeTask(p2, "billing", 1);
  const claim = "Done — all tests pass.";
  const sc = rc1(["stop-check", "--message", claim, "--project", p2]);
  const scJ = jc1(rc1(["stop-check", "--message", claim, "--json", "--project", p2]).stdout);
  const eng = Sc1.stopCheck(p2, { message: claim });
  const scIn = rc1(["stop-check", "-", "--project", p2], claim + "\n");
  const scInFlag = rc1(["stop-check", "--message", "-", "--project", p2], "Feito, todos os testes passam.");
  const scPos = rc1(["stop-check", "All", "done!", "--project", p2]);
  const scNo = rc1(["stop-check", "--message", "I renamed the variable.", "--project", p2]);
  const scAdm = rc1(["stop-check", "--message", "Done, but task 1 is not verified.", "--project", p2]);
  ok(sc.code === 1 && sc.stdout.trim() === eng.reason && /billing: #1 \(no evidence\)/.test(sc.out) && /read each listed task's _Verify:_ command/.test(sc.out) && !/--run/.test(sc.out) &&
    scJ && JSON.stringify(scJ) === JSON.stringify(eng) && scIn.code === 1 && scIn.stdout.trim() === eng.reason && scInFlag.code === 1 && scPos.code === 1 &&
    scNo.code === 0 && /^evidence gate: the message claims no completion or verification — allowed\./.test(scNo.stdout) &&
    scAdm.code === 0 && /says plainly what is not verified/.test(scAdm.stdout),
    "stop-check prints spec.stopCheck's reason and exits 1 when the turn would be sent back (--message, stdin via - or --message -, or the words after it); --json = the engine result; no claim / an admission → a line, exit 0 (got " +
    JSON.stringify([sc.code, sc.out.slice(0, 200), scNo.out.slice(0, 120)]) + ")");
  // Allow lines: verified, no recent activity, off, no .specs/; --agent spec-implementer checks the report; PT / ES lines.
  Sc1.completeTask(p2, "billing", 1, { command: "node -e \"process.exit(0)\"", exitCode: 0, summary: "1 passing" });
  const scVer = rc1(["stop-check", "--message", claim, "--project", p2]);
  const p3 = path.join(tmp, "c1-quiet");
  Sc1.initProject(p3, ["core"], "en");
  const f3 = Sc1.createFeature(p3, "Quiet", ["core"], "", undefined, "en");
  const old = (Date.now() - 9 * 3600 * 1000) / 1000;
  fs.utimesSync(path.join(f3.dir, "tasks.md"), old, old);
  const scOld = rc1(["stop-check", "--message", claim, "--project", p3]);
  rc1(["init", "--stop-check", "off", "--project", p3]);
  const scOff = rc1(["stop-check", "--message", claim, "--project", p3]);
  fs.mkdirSync(path.join(tmp, "c1-empty"), { recursive: true });
  const scNone = rc1(["stop-check", "--message", claim, "--project", path.join(tmp, "c1-empty")]);
  const ex = path.join(f2.dir, ".execution");
  fs.mkdirSync(ex, { recursive: true });
  fs.writeFileSync(path.join(f2.dir, "tasks.md"), "- [x] 1. [US1] Charge\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 2. [US1] Refund\n  - _Verify: npm test -- refund_\n");
  fs.writeFileSync(path.join(ex, "task-2-report.md"), "# Task 2\nAll good.\n");
  const reply = "**Status:** DONE\nReport: .specs/billing/.execution/task-2-report.md";
  const scImp = rc1(["stop-check", "--message", reply, "--agent", "dev-spec-driven:spec-implementer", "--project", p2]);
  const scImpJ = jc1(rc1(["stop-check", "--message", reply, "--agent", "spec-implementer", "--json", "--project", p2]).stdout);
  fs.writeFileSync(path.join(ex, "task-2-report.md"), "# Task 2\n$ npm test -- refund\nexit 0 — 4 passing\n");
  const scImpOk = rc1(["stop-check", "--message", reply, "--agent", "spec-implementer", "--project", p2]);
  const p4 = path.join(tmp, "c1-pt");
  Sc1.initProject(p4, ["core"], "pt");
  Sc1.createFeature(p4, "Pagamentos", ["core"], "", undefined, "pt");
  const scPt = rc1(["stop-check", "--message", "Renomeei a variável.", "--project", p4]);
  const p5 = path.join(tmp, "c1-es");
  Sc1.initProject(p5, ["core"], "es");
  const scEs = rc1(["stop-check", "--message", "Listo.", "--project", p5]);
  ok(scVer.code === 0 && /every ticked task of the recently active features has passing evidence \(billing\) — allowed/.test(scVer.stdout) &&
    scOld.code === 0 && /no feature was active in the last 4 h/.test(scOld.stdout) && scOff.code === 0 && /evidence gate: off \(roadmap\.json meta\.stopCheck: false\)/.test(scOff.stdout) &&
    scNone.code === 0 && /no dev-spec \.specs\/ here/.test(scNone.stdout) &&
    scImp.code === 1 && /you report task 2 of 'billing' as DONE, but its report \(\.specs\/billing\/\.execution\/task-2-report\.md\) doesn't show the _Verify:_ run/.test(scImp.out) &&
    scImpJ && scImpJ.why === "implementer-evidence" && scImpJ.task === 2 && scImpOk.code === 0 && /the report of task 2 of 'billing' shows its _Verify:_ run — allowed/.test(scImpOk.stdout) &&
    scPt.code === 0 && /gate de evidência: a mensagem não afirma conclusão nem verificação — permitido/.test(scPt.stdout) &&
    scEs.code === 0 && /gate de evidencia: ninguna función tuvo actividad en las últimas 4 h/.test(scEs.stdout),
    "stop-check allow lines (verified, no recent activity, off, no .specs/), --agent spec-implementer checks the task report (exit 1 without the run, 0 with it), PT / ES lines (got " +
    JSON.stringify([scVer.out.slice(0, 140), scOld.out.slice(0, 120), scImp.out.slice(0, 160), scEs.out.slice(0, 120)]) + ")");

  // help and the header docblock document stop-check, --stop-check and --guard scope.
  const hC1 = rc1(["help"]).out;
  const docC1 = fs.readFileSync(CLI, "utf8").split("*/")[0];
  ok(["stop-check [--message \"<text>\"|-] [--agent <type>]", "--stop-check on|off", "--guard on|off|scope"].every((w) => hC1.includes(w) && docC1.includes(w)),
    "help and the header docblock document stop-check, init --stop-check and init --guard scope");
}

if (inSection("pc2")) { // 1.14 package C2 (CLI tests)
// C2 — `dev-spec decide` (= spec_decide) and `dev-spec spike` / `create --kind spike` (= spec_create {kind: "spike"}), EN / PT.
const Sc2 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
const jsonC2 = (s) => { try { return JSON.parse(s); } catch { return null; } };
const rc2 = (args) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: tmp } });
  return { out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "", code: r.status };
};

// decide: an entry appended (✎ line, _Affects:_ canonical), --json = the MCP result, --discovery / --supersedes, unknown refs refused.
const pd = path.join(tmp, "c2-decide");
Sc2.initProject(pd, ["tdd"], "en");
const fd = Sc2.createFeature(pd, "Auth", ["tdd"], "", undefined, "en");
const dc1 = rc2(["decide", "auth", "--title", "JWT sessions", "--decision", "Use JWT.", "--context", "Stateless API", "--affects", "us-1.ac-2,T-02,architecture", "--project", pd]);
const dc2 = rc2(["decide", "auth", "--title", "Skew", "--decision", "30 s of skew.", "--discovery", "--supersedes", "D-1", "--json", "--project", pd]);
const dc2j = jsonC2(dc2.stdout);
const before = fs.readFileSync(path.join(fd.dir, "decisions.md"), "utf8");
const dcBad = rc2(["decide", "auth", "--title", "x", "--decision", "y", "--affects", "US-9.AC-9,Ghost", "--project", pd]);
const dcBadJ = rc2(["decide", "auth", "--title", "x", "--decision", "y", "--affects", "T-99", "--json", "--project", pd]);
const dcNoTitle = rc2(["decide", "auth", "--decision", "y", "--project", pd]);
const dcUsage = rc2(["decide", "--project", pd]);
ok(dc1.code === 0 && /^✎ D-1 — JWT sessions  \(\.specs\/auth\/decisions\.md\)\n  _Affects: US-1\.AC-2, T-02, Architecture_\n$/.test(dc1.out) &&
  dc2.code === 0 && dc2j && dc2j.ok === true && dc2j.id === "D-2" && dc2j.kind === "discovery" && JSON.stringify(dc2j.supersedes) === '["D-1"]' &&
  /\n## D-2 — Skew\n\n- _Kind: discovery_\n- _Date: [^_]+_\n- _Supersedes: D-1_\n\n\*\*Discovery:\*\* 30 s of skew\.\n$/.test(before) &&
  dcBad.code === 1 && /unknown _Affects:_ reference\(s\): US-9\.AC-9, Ghost — /.test(dcBad.out) && dcBadJ.code === 1 && jsonC2(dcBadJ.stdout) && jsonC2(dcBadJ.stdout).unknownAffects[0] === "T-99" &&
  dcNoTitle.code === 1 && /needs a title/.test(dcNoTitle.out) && dcUsage.code === 1 && /dev-spec decide <feature>/.test(dcUsage.out) &&
  fs.readFileSync(path.join(fd.dir, "decisions.md"), "utf8") === before,
  "decide = spec_decide: appends D-1 (✎ line, canonical _Affects:_), --discovery + --supersedes, --json = the MCP result; unknown _Affects:_ / no --title → exit 1, nothing written (got " +
  JSON.stringify([dc1.out, dcBad.out.slice(0, 120)]) + ")");

// trace prints the phantom _Affects:_ warnings (exit code unchanged); brief shows the decisions citing the task.
fs.appendFileSync(path.join(fd.dir, "decisions.md"), "\n## D-3 — Old\n\n- _Kind: decision_\n- _Date: 2026-01-01_\n- _Affects: US-7.AC-7_\n\n**Decision:** x\n");
const trc = rc2(["trace", "auth", "--project", pd]);
const trcJ = jsonC2(rc2(["trace", "auth", "--json", "--project", pd]).stdout);
const brc = rc2(["brief", "auth", "3", "--project", pd]);
ok(/  ⚠ D-3 _Affects:_ US-7\.AC-7 — names nothing in this feature/.test(trc.out) && trcJ && trcJ.phantomAffects.length === 1 && trcJ.phantomAffects[0].decision === "D-3" &&
  brc.code === 0 && /^# /.test(brc.out) && !/## Decisions/.test(brc.out),
  "trace lists _Affects:_ references that name nothing (⚠, a warning — --json phantomAffects); a superseded entry (D-1) is not in the brief of the task citing it");

// spike: the shortcut and create --kind spike; question / timebox printed; doctor exit 1 until decided; next-action; finish.
const ps = path.join(tmp, "c2-spike");
Sc2.initProject(ps, ["core"], "en");
const sk = rc2(["spike", "Cache spike", "--question", "Can Redis hold sessions?", "--timebox", "2099-01-31", "--project", ps]);
const sk2 = rc2(["create", "Queue spike", "--kind", "spike", "--summary", "Kafka or RabbitMQ?", "--json", "--project", ps]);
const sk2j = jsonC2(sk2.stdout);
const skBad = rc2(["spike", "Late", "--timebox", "tomorrow", "--project", ps]);
const skQ = rc2(["create", "Plain", "core", "--question", "why", "--project", ps]);
ok(sk.code === 0 && /^Feature 'cache-spike' \[core\] \(en\)\n  spike\.md, tasks\.md\n  question: Can Redis hold sessions\?\n  timebox: until 2099-01-31\n$/.test(sk.out) &&
  sk2.code === 0 && sk2j && sk2j.kind === "spike" && JSON.stringify(sk2j.created) === '["spike.md","tasks.md"]' &&
  /## Question\nKafka or RabbitMQ\?\n/.test(fs.readFileSync(path.join(ps, ".specs", "queue-spike", "spike.md"), "utf8")) &&
  skBad.code === 1 && /timebox must be an end date/.test(skBad.out) && !fs.existsSync(path.join(ps, ".specs", "late")) &&
  skQ.code === 1 && /question only applies to a spike/.test(skQ.out),
  "spike \"<name>\" --question --timebox = spec_create {kind: 'spike'} (question + timebox printed); create --kind spike --summary seeds the question; a bad timebox or a question on a feature → exit 1 (got " +
  JSON.stringify([sk.out, skBad.out.slice(0, 100)]) + ")");
const docS = rc2(["doctor", "cache-spike", "--project", ps]);
const apS = rc2(["approve", "cache-spike", "design", "--project", ps]);
const atS = rc2(["add-track", "cache-spike", "tdd", "--project", ps]);
for (const n of ["1", "2", "3", "4"]) rc2(["done", "cache-spike", n, "--project", ps]);
const naS = rc2(["na", "cache-spike", "--project", ps]);
const spf = path.join(ps, ".specs", "cache-spike", "spike.md");
fs.writeFileSync(spf, fs.readFileSync(spf, "utf8").replace(/> \*\*TODO\*\* — go \/ no-go \/ pivot[^\n]*/, "Latency 2 ms p95 — measured.").replace(/^_Outcome: [^\n]*_$/m, "_Outcome: no-go_"));
const docS2 = rc2(["doctor", "cache-spike", "--project", ps]);
const naS2 = rc2(["next-action", "cache-spike", "--json", "--project", ps]);
const finS = rc2(["finish", "cache-spike", "--write", "--project", ps]);
const rmS = rc2(["roadmap", "--write", "--project", ps]);
ok(docS.code === 1 && /✗ decision — spike\.md → Decision is not written yet/.test(docS.out) && /✓ timebox — timebox until 2099-01-31/.test(docS.out) &&
  apS.code === 1 && /is a spike: it has no design gate/.test(apS.out) && atS.code === 1 && /is a spike — it has no tracks/.test(atS.out) &&
  /Record the decision in spike\.md → Decision/.test(naS.out) &&
  docS2.code === 0 && /✓ decision — decision recorded \(_Outcome: no-go_\)/.test(docS2.out) &&
  jsonC2(naS2.stdout) && jsonC2(naS2.stdout).step === "archive" && jsonC2(naS2.stdout).outcome === "no-go" &&
  finS.code === 0 && /spike 'cache-spike' is ready to finish/.test(finS.out) && fs.existsSync(path.join(ps, ".specs", "cache-spike", ".execution", "merge-summary.md")) &&
  rmS.code === 0 && /\[cache-spike\]\(\.\/cache-spike\/spike\.md\) 🔬 spike/.test(fs.readFileSync(path.join(ps, ".specs", "ROADMAP.md"), "utf8")),
  "spike on the CLI: doctor exits 1 until the decision is written; approve / add-track refuse a spike; next-action goes decide → archive (no-go); finish is ready once decided; ROADMAP.md labels it (got " +
  JSON.stringify([docS.out.slice(0, 200), naS.out.slice(0, 160)]) + ")");

// PT: the spike and the decision log in the feature's language.
const pp = path.join(tmp, "c2-pt");
Sc2.initProject(pp, ["core"], "pt");
const skPt = rc2(["spike", "Pesquisa cache", "--question", "Redis ou Memcached?", "--timebox", "3d", "--project", pp]);
const dcPt = rc2(["decide", "pesquisa-cache", "--title", "Redis", "--decision", "Usar Redis.", "--affects", "Evidência", "--project", pp]);
const docPt = rc2(["doctor", "pesquisa-cache", "--project", pp]);
ok(skPt.code === 0 && /  pergunta: Redis ou Memcached\?\n  timebox: até \d{4}-\d\d-\d\d\n$/.test(skPt.out) &&
  /## Pergunta\nRedis ou Memcached\?/.test(fs.readFileSync(path.join(pp, ".specs", "pesquisa-cache", "spike.md"), "utf8")) &&
  dcPt.code === 0 && /^✎ D-1 — Redis/.test(dcPt.out) && /^# Decisões: Pesquisa cache\n/.test(fs.readFileSync(path.join(pp, ".specs", "pesquisa-cache", "decisions.md"), "utf8")) &&
  docPt.code === 1 && /✗ decision — spike\.md → Decisão ainda não está escrita/.test(docPt.out),
  "PT: spike prints pergunta / timebox até; decide writes '# Decisões:' (a spike section as _Affects:_); doctor speaks Portuguese (got " + JSON.stringify([skPt.out, docPt.out.slice(0, 200)]) + ")");

// help and the header docblock document spike and decide.
const hC2 = rc2(["help"]).out;
const docC2 = fs.readFileSync(CLI, "utf8").split("*/")[0];
ok(['spike "<name>" [--question "…"] [--timebox YYYY-MM-DD|3d]', 'decide <feature> --title "…" --decision "…"', "--kind feature|bugfix|spike"].every((w) => hC2.includes(w)) &&
  ['spike "<name>" [--question "…"] [--timebox YYYY-MM-DD|3d]', 'decide <feature> --title "…" --decision "…"'].every((w) => docC2.includes(w)),
  "help and the header docblock document spike, decide and --kind spike");
}

if (inSection("pc3")) { // 1.14 package C3 (CLI tests) — import plan / execplan / bmad, the design-first flow (create --flow, feature flow)
  const c3 = path.join(tmp, "pc3-proj");
  const put = (rel, s) => { const p = path.join(c3, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
  const read = (...p) => fs.readFileSync(path.join(c3, ...p), "utf8");
  const json = (args) => { try { return JSON.parse(run(args).out); } catch { return null; } };
  run(["init", "core", "--project", c3]);
  const planText = "# Plan: Dark mode\n\n## Goals\n- When the user clicks the toggle, the theme switches\n\n## Steps\n- [x] Add `src/theme.ts`\n- [ ] Wire the toggle in `src/Header.tsx`\n";
  put(".claude/plans/dark.md", planText);
  const pi = run(["import", "plan", ".claude/plans/dark.md", "--project", c3]);
  const piTasks = fs.existsSync(path.join(c3, ".specs", "dark-mode", "tasks.md")) ? read(".specs", "dark-mode", "tasks.md") : "";
  ok(pi.code === 0 && /Imported plan \.claude\/plans\/dark\.md → feature 'dark-mode' \[core\] \(en\)/.test(pi.out) && /mapping: \d+ ID\(s\) — Dark mode → US-1, Goals 1 → US-1\.AC-1/.test(pi.out) &&
    /- \[x\] 1\. Add `src\/theme\.ts`\n  - _Implements: src\/theme\.ts_\n- \[ \] 2\. Wire the toggle in `src\/Header\.tsx`\n  - _Implements: src\/Header\.tsx_/.test(piTasks) &&
    /US-1\.AC-1\*\* — WHEN the user clicks the toggle, THE SYSTEM SHALL ensure that the theme switches/.test(read(".specs", "dark-mode", "requirements.md")) &&
    read(".claude", "plans", "dark.md") === planText && run(["ears", "dark-mode", "--project", c3]).code === 0,
    "import plan <file>: a NEW feature named after the plan, checklist state kept, file paths → _Implements:_, criteria in EARS (ears passes), the source untouched");
  const home = run(["import", "plan", "~/.claude/plans/dark.md", "--project", c3]);
  put("plans/a.md", "# A\n- [ ] x\n");
  put("plans/b.md", "# B\n- [ ] y\n");
  const sev = run(["import", "plan", "plans", "--json", "--project", c3]);
  let sevJ = null;
  try { sevJ = JSON.parse(sev.out); } catch { /* not JSON */ }
  const again = run(["import", "plan", ".claude/plans/dark.md", "--project", c3]);
  const bad = run(["import", "notion", "x", "--project", c3]);
  ok(home.code === 1 && /outside the project[^\n]*plansDirectory \(default ~\/\.claude\/plans/.test(home.out) && sev.code === 1 && sevJ && sevJ.ok === false && /several documents \(a\.md, b\.md\)/.test(sevJ.error) &&
    again.code === 1 && /already exists/.test(again.out) && bad.code === 1 && /Known: kiro, spec-kit, openspec, plan, execplan, bmad, fluidplan\./.test(bad.out),
    "import plan refusals exit 1: ~/.claude/plans (outside — says how to bring the plan in), a folder of several plans (--json: the refusal on stdout), an existing feature; an unknown format lists the six");
  put("exec/health.md", "# Health endpoint\n\n## Purpose / Big Picture\n\nOperators can check the API.\n\n## Progress\n\n- [x] (2025-10-01 13:00Z) Add `src/health.ts`\n- [ ] Ping the database and run `npm test`\n\n" +
    "## Decision Log\n\n- Decision: SELECT 1 as the ping.\n  Rationale: cheap.\n\n## Validation and Acceptance\n\n- If the database is down, the endpoint returns 503\n");
  const exJ = json(["import", "execplan", "exec/health.md", "--json", "--project", c3]);
  const exEngine = (() => { const d2 = path.join(tmp, "pc3-engine"); fs.mkdirSync(path.join(d2, "exec"), { recursive: true }); fs.copyFileSync(path.join(c3, "exec", "health.md"), path.join(d2, "exec", "health.md"));
    return require(path.join(__dirname, "..", "mcp", "lib", "spec.js")).importSpec(d2, "execplan", "exec/health.md"); })();
  ok(exJ && exJ.ok && exJ.feature === "health-endpoint" && exJ.toolName === "ExecPlan" && exJ.mapping["Decision Log 1"] === "D-1" && exJ.mapping["Progress 2"] === "task 2" &&
    JSON.stringify(exJ.mapping) === JSON.stringify(exEngine.mapping) && JSON.stringify(exJ.warnings) === JSON.stringify(exEngine.warnings) &&
    /- \[ \] 2\. Ping the database and run `npm test`\n  - _Verify: npm test_/.test(read(".specs", "health-endpoint", "tasks.md")) &&
    /## Decisions\n\n- \*\*D-1\*\* — SELECT 1 as the ping\.\n  Rationale: cheap\./.test(read(".specs", "health-endpoint", "design.md")),
    "import execplan --json: the engine's result (same mapping and warnings as spec_import), Progress → tasks with _Verify:_, Decision Log → design.md ## Decisions");
  put("docs/prd.md", "# Notes App Product Requirements Document (PRD)\n\n## Requirements\n\n### Functional\n- FR1: Users can write notes.\n\n### Non Functional\n- NFR1: Saves in under 1 s.\n");
  put("docs/stories/1.1.write.md", "# Story 1.1: Write notes\n\n## Story\n\nAs a user, I want to write notes, so that I remember.\n\n## Acceptance Criteria\n\n1. WHEN a user saves a note THEN the system SHALL store it.\n\n" +
    "## Tasks / Subtasks\n\n- [ ] Task 1: Note store (AC: 1)\n");
  const bm = run(["import", "bmad", "docs", "--lang", "pt", "--project", c3]);
  const bmReq = fs.existsSync(path.join(c3, ".specs", "notes-app", "requirements.md")) ? read(".specs", "notes-app", "requirements.md") : "";
  ok(bm.code === 0 && /Importado de BMAD docs → feature 'notes-app'/.test(bm.out) && /## Requisitos Não-Funcionais\n- \*\*NFR-1\*\* — Saves in under 1 s\./.test(bmReq) &&
    /- \[ \] 1\. \[US1\] Task 1: Note store\n  - _Requirements: US-1\.AC-1_/.test(read(".specs", "notes-app", "tasks.md")) && /^> Importado de BMAD `docs` em /m.test(bmReq),
    "import bmad --lang pt: FR/NFR → FR-1 / NFR-1 under the localized heading, story tasks tagged [US1] with (AC: 1) → _Requirements:_, PT output and note");

  // design-first: create --flow, next-action order, approve order, feature flow, roadmap
  const df = path.join(tmp, "pc3-flow");
  run(["init", "core", "--project", df]);
  const cr = run(["create", "Port engine", "core", "--flow", "design-first", "--project", df]);
  const crJ = json(["create", "Other", "core", "--flow", "design-first", "--json", "--project", df]);
  const crBad = run(["create", "Bad one", "core", "--flow", "sideways", "--project", df]);
  ok(cr.code === 0 && /design-first flow — phase order: classification → design → requirements → tasks/.test(cr.out) && crJ && crJ.flow === "design-first" &&
    JSON.parse(fs.readFileSync(path.join(df, ".specs", "port-engine", ".state.json"), "utf8")).flow === "design-first" &&
    crBad.code === 1 && /flow must be one of: requirements-first, design-first \(got "sideways"\)/.test(crBad.out) && !fs.existsSync(path.join(df, ".specs", "bad-one")),
    "create --flow design-first (= spec_create {flow}): stored, the phase order printed, --json carries flow; an unknown flow exits 1 with the MCP enum's message, nothing created");
  run(["approve", "port-engine", "classification", "--force", "--project", df]);
  const na = run(["next-action", "port-engine", "--project", df]);
  const apReq = run(["approve", "port-engine", "requirements", "--project", df]);
  ok(/design\.md/.test(na.out) && /\(design-first flow: classification → design → requirements → tasks\)/.test(na.out) && apReq.code === 1 && /earlier phases are not approved yet: design/.test(apReq.out),
    "next-action on a design-first feature asks for design.md (naming the flow); approve requirements before the design exits 1 on phase-order");
  const rmOut = run(["roadmap", "--project", df]).out;
  run(["create", "Classic", "core", "--project", df]);
  const fl = run(["feature", "flow", "classic", "design-first", "--project", df]);
  const flSame = run(["feature", "flow", "classic", "--flow", "design-first", "--project", df]);
  const flBad = run(["feature", "flow", "classic", "sideways", "--project", df]);
  run(["bugfix", "Crash", "--project", df]);
  const flBug = run(["feature", "flow", "crash", "design-first", "--project", df]);
  const flNone = run(["feature", "flow", "classic", "--project", df]);
  ok(/port-engine[^\n]*8%/.test(rmOut) && fl.code === 0 && /'classic' now follows the design-first flow \(was requirements-first\) — phase order: classification → design → requirements → tasks\./.test(fl.out) &&
    flSame.code === 0 && /already follows the design-first flow/.test(flSame.out) && flBad.code === 1 && /flow must be one of/.test(flBad.out) &&
    flBug.code === 1 && /is a bugfix: it follows its own fixed phase order/.test(flBug.out) && flNone.code === 1 && /flow required/.test(flNone.out),
    "roadmap shows a fresh design-first feature at 8%; feature flow <name> <flow> / --flow sets it (idempotent), a bad or missing flow and a bugfix exit 1 (got " + JSON.stringify([rmOut.split("\n").filter((l) => /port-engine/.test(l)), fl.out, flNone.out]).slice(0, 400) + ")");
  const help = run(["help"]).out;
  const doc = fs.readFileSync(CLI, "utf8").split("*/")[0];
  ok(/import <kiro\|spec-kit\|openspec\|plan\|execplan\|bmad\|fluidplan> <path>/.test(help) && /import <kiro\|spec-kit\|openspec\|plan\|execplan\|bmad\|fluidplan> <path>/.test(doc) &&
    /feature flow <name> <requirements-first\|design-first>/.test(help) && /--flow design-first/.test(help) && /--flow design-first/.test(doc),
    "help and the header docblock document import plan|execplan|bmad, create --flow design-first and feature flow");
}

if (inSection("pc4")) { // 1.14 package C4 (CLI tests)
  const Sc4 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  // C4.1 — /spec-tour is served as a prompt like every command.
  const tourC4 = run(["prompts", "spec-tour", "--args", "a length check on the signup name"]);
  ok(tourC4.code === 0 && /as a \*\*guided tour\*\*/.test(tourC4.out) && /Change to take through the tour \(optional\): a length check on the signup name/.test(tourC4.out) &&
    /^ {2}spec-tour \[a small change you want to make \(optional\)\]$/m.test(run(["prompts"]).out),
    "prompts spec-tour: the guided tour (args in place), listed with its argument hint");

  // C4.2.1–3 — classify on the CLI = the engine.
  const gdC4 = run(["classify", "A GDPR-compliant signup form"]);
  const stC4 = run(["classify", "array stride and file permission bits"]);
  const esC4 = run(["classify", "Cifrado en tránsito para la API de pagos"]);
  const csC4 = run(["classify", "Google sign-in with an OAuth consent screen"]);
  ok(gdC4.code === 0 && /^Tracks: core \+privacy {3}/m.test(gdC4.out) && /^Tracks: core {3}/m.test(stC4.out) && !/\+sec: ON|Possible \+sec/.test(stC4.out) &&
    /^Tracks: core \+tdd \+sec {3}/m.test(esC4.out) && /señales encontradas: cifrado en tránsito/.test(esC4.out) &&
    /^Tracks: core \+tdd {3}/m.test(csC4.out) && /Possible \+privacy — weak signal 'consent'/.test(csC4.out),
    "classify: GDPR-compliant → +privacy; array stride + file permission bits → core with no +sec note; cifrado en tránsito → +sec (strong, ES); an OAuth consent screen → only a possible +privacy");

  // C4.2.5 + C4.2.6 on the CLI: doctor names the missing [PRIVACY] section and the pipe wrapped in bash -c; `done --run` hints a pipe
  // whose line merely mentions pipefail.
  const pc4 = path.join(tmp, "pc4-proj");
  Sc4.initProject(pc4, ["core"], "en");
  const fPv = Sc4.createFeature(pc4, "Accounts", ["privacy"], "", undefined, "en");
  const dPv = path.join(fPv.dir, "design.md");
  const filledPv = fs.readFileSync(dPv, "utf8").split(/\r?\n/).filter((l) => !/^\s*>\s*\*\*TODO\*\*/.test(l)).join("\n")
    .replace(/\[([^\]\n]*)\]/g, (m, x) => (/^(?:PRIVACY|SEC|SaaS|AI|x| )$/.test(x) ? m : "filled"));
  fs.writeFileSync(dPv, filledPv.replace(/## \[PRIVACY\] Processors & International Transfers\n/, "") + "\n## Processors and queues\nBullMQ workers.\n");
  const docPv = run(["doctor", fPv.slug, "--project", pc4]);
  const fPp = Sc4.createFeature(pc4, "Pipes", ["core"], "", undefined, "en");
  fs.writeFileSync(path.join(fPp.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Masked, mentions pipefail\n  - _Verify: node -e \"process.exit(0)\" | node -e \"process.exit(0)\" # pipefail later_\n" +
    "- [ ] 2. [US1] Wrapped\n  - _Verify: bash -c \"npm test | tee test.log\"_\n- [ ] 3. [US1] Real pipefail\n  - _Verify: set -o pipefail; npm test | tee test.log_\n");
  const docPp = run(["doctor", fPp.slug, "--project", pc4]);
  const donePp = run(["done", fPp.slug, "1", "--run", "--project", pc4]);
  const vpLine = (docPp.out.match(/.*verify-pipes.*/) || [""])[0];
  ok(docPv.code === 1 && /privacy-sections.*Processors & International Transfers:missing/.test(docPv.out) &&
    /#1 .*#2 `bash -c "npm test \| tee test\.log"`/.test(vpLine) && !/#3 /.test(vpLine) &&
    /pipes into another command: the shell reports only the LAST command's exit code/.test(donePp.out),
    "doctor: a deleted [PRIVACY] heading is missing even beside '## Processors and queues'; verify-pipes names the pipe that mentions pipefail and the one inside bash -c, not a real set -o pipefail; done --run hints it (got " +
    JSON.stringify([docPv.code, vpLine.slice(0, 200)]) + ")");
}

if (inSection("pd1")) { // 1.14 package D1 (CLI tests) — Brazilian Portuguese (pt-BR), a fourth locale derived from pt
  const SD1 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const d1 = path.join(tmp, "pd1-proj");
  const jsonOf = (r) => { try { return JSON.parse(r.out); } catch { return null; } };
  const EU_ONLY = /(?<![\p{L}])(?:utilizador(?:es)?|ficheiros?|ecrãs?|equipas?|registos?|registar|registad[oa]s?|palavras?-passe|telemóve(?:l|is)|secç(?:ão|ões)|planead[oa]s?|artefactos?|tens|podes)(?![\p{L}])|(?<![\p{L}])a correr(?![\p{L}])|por defeito|por omissão/iu;
  const rmD1 = (p) => JSON.parse(fs.readFileSync(path.join(p, ".specs", "roadmap.json"), "utf8"));
  const initBr = run(["init", "tdd", "--lang", "pt_BR", "--project", d1]);
  const aliasBr = run(["init", "--lang", "PTBR", "--project", path.join(tmp, "pd1-alias")]);
  const aliasEu = run(["init", "--lang", "pt-PT", "--project", path.join(tmp, "pd1-eu")]);
  ok(initBr.code === 0 && /^Criado em .*\[pt-BR\]:/m.test(initBr.out) && rmD1(d1).meta.lang === "pt-BR" && aliasBr.code === 0 && rmD1(path.join(tmp, "pd1-alias")).meta.lang === "pt-BR" &&
    aliasEu.code === 0 && rmD1(path.join(tmp, "pd1-eu")).meta.lang === "pt",
    "init --lang pt_BR / PTBR → project language pt-BR (reported in pt-BR); --lang pt-PT stays European pt (got " + initBr.out.trim().split("\n")[0] + ")");
  const bad = run(["create", "Zed", "--lang", "pt-XX", "--project", d1]);
  // (full review Pb7: pt-BR says "tem que ser" — "tem de ser" is the European form)
  ok(bad.code === 1 && /--lang tem que ser um de: en, pt, es, pt-BR \(recebido: "pt-XX"\)/.test(bad.out) && !fs.existsSync(path.join(d1, ".specs", "zed")),
    "--lang pt-XX is refused (the message lists pt-BR, in the project's pt-BR) and nothing is written");
  const cr = run(["create", "Cadastro", "tdd", "--summary", "Cadastro com senha", "--project", d1]);
  const req = fs.readFileSync(path.join(d1, ".specs", "cadastro", "requirements.md"), "utf8");
  ok(cr.code === 0 && /^Feature 'cadastro' \[core \+tdd\] \(pt-BR\)/m.test(cr.out) && /## Histórias de Usuário/.test(req) && /## Fora do Escopo/.test(req) && !EU_ONLY.test(req),
    "create inherits pt-BR: Brazilian requirements (Histórias de Usuário, Fora do Escopo, no European-only word)");
  const doc = run(["doctor", "cadastro", "--project", d1]);
  const docJ = jsonOf(run(["doctor", "cadastro", "--json", "--project", d1]));
  ok(doc.code === 1 && /^Diagnóstico: cadastro {2}\[core \+tdd\] {2}veredicto=FALHA/m.test(doc.out) && /placeholders do template sem preencher na fase atual/.test(doc.out) && !EU_ONLY.test(doc.out) &&
    docJ && JSON.stringify(docJ) === JSON.stringify(SD1.specDoctor(d1, "cadastro")),
    "doctor speaks pt-BR ('Diagnóstico … veredicto=FALHA', 'sem preencher'); --json is spec_doctor's result (CLI = MCP)");
  const st = run(["status", "cadastro", "--project", d1]);
  const na = jsonOf(run(["next-action", "cadastro", "--json", "--project", d1]));
  ok(st.code === 0 && /^Feature: cadastro {2}\[core \+tdd\] {2}fase: requisitos/m.test(st.out) && /^Tarefas: 0\/\d+/m.test(st.out) && na && na.step === "fill" && !EU_ONLY.test(na.recommendation),
    "status / next-action in pt-BR (fase: requisitos, Tarefas); the recommendation carries no European-only word (got " + (na && na.recommendation) + ")");
  const eu = jsonOf(run(["create", "Faturas", "--lang", "pt-PT", "--json", "--project", d1]));
  const br = jsonOf(run(["create", "Relatorios", "core", "--lang", "Pt-Br", "--json", "--project", d1]));
  ok(eu && eu.lang === "pt" && /## Histórias de Utilizador/.test(fs.readFileSync(path.join(d1, ".specs", "faturas", "requirements.md"), "utf8")) && br && br.lang === "pt-BR",
    "a per-feature --lang pt-PT keeps European Portuguese inside a pt-BR project; --lang Pt-Br folds to pt-BR");
  const road = run(["roadmap", "--write", "--project", d1]);
  const md = fs.readFileSync(path.join(d1, ".specs", "ROADMAP.md"), "utf8");
  ok(road.code === 0 && /Legenda: ✅ feito · 🟡 em andamento · ⛔ bloqueada · 📋 planejada · ⬜ não iniciada/.test(md) && !/em curso|planeada|por começar/.test(md),
    "roadmap --write renders ROADMAP.md in pt-BR (em andamento · planejada · não iniciada)");
  const tpl = run(["templates", "init", "requirements", "--lang", "pt-br", "--project", d1]);
  const tplFile = path.join(d1, ".specs", "templates", "pt-BR", "requirements.md");
  ok(tpl.code === 0 && fs.existsSync(tplFile) && /## Histórias de Usuário/.test(fs.readFileSync(tplFile, "utf8")) && /1 template\(s\) de base copiado\(s\)/.test(tpl.out),
    "templates init requirements --lang pt-br → .specs/templates/pt-BR/requirements.md (Brazilian), reported in pt-BR (got " + tpl.out.trim().split("\n")[0] + ")");
  const clsBr = jsonOf(run(["classify", "Cadastro de usuários com senha, sem LLM", "--lang", "pt-BR", "--json"]));
  const clsGuess = jsonOf(run(["classify", "Cadastro do usuário: senha, arquivo e tela, com resumo no LLM", "--json"]));
  ok(clsBr && clsBr.lang === "pt-BR" && clsBr.tracks.join() === "core,tdd" && JSON.stringify(clsBr) === JSON.stringify(SD1.classify("Cadastro de usuários com senha, sem LLM", { lang: "pt-BR" })) &&
    clsGuess && clsGuess.lang === "pt" && clsGuess.tracks.join() === "core,tdd,ai",
    "classify --lang pt-BR answers in pt-BR (= spec_classify); Brazilian words alone guess 'pt' — 'no LLM' is em+o, +ai on");
}

if (inSection("pfr")) { // 1.14 final review — CLI parity findings
  const fr = path.join(tmp, "pfr-proj");
  const jsonOf = (r) => { try { return JSON.parse(r.out); } catch { return null; } };
  run(["init", "tdd", "--lang", "pt", "--project", fr]);
  run(["create", "Alfa", "core", "tdd", "--project", fr]);
  // decide: a repeated --affects / --supersedes adds to the list (= spec_decide's arrays); --kind is honoured.
  const d1 = jsonOf(run(["decide", "alfa", "--title", "t1", "--decision", "d1", "--affects", "US-1.AC-1", "--affects", "T-01", "--json", "--project", fr]));
  const d2 = jsonOf(run(["decide", "alfa", "--title", "t2", "--decision", "d2", "--kind", "discovery", "--json", "--project", fr]));
  const d3 = jsonOf(run(["decide", "alfa", "--title", "t3", "--decision", "d3", "--supersedes", "D-1", "--supersedes", "D-2", "--json", "--project", fr]));
  ok(d1 && d1.affects.join() === "US-1.AC-1,T-01" && d2 && d2.kind === "discovery" && d3 && d3.supersedes.join() === "D-1,D-2",
    "decide: repeated --affects / --supersedes are all kept (the parser kept only the last), --kind discovery is honoured (got " + JSON.stringify([d1 && d1.affects, d2 && d2.kind, d3 && d3.supersedes]) + ")");
  // approve --through: a forced step is labelled in the feature's language.
  const ff = run(["approve", "alfa", "--through", "requirements", "--force", "--project", fr]);
  ok(ff.code === 0 && /\(forçada: /.test(ff.out) && !/\(forced: /.test(ff.out), "approve --through --force labels a forced step in PT ('forçada'), never the English '(forced: …)' (got " + ff.out.trim().split("\n").slice(-2).join(" | ") + ")");
  // spike: the shortcut passes --flow through like create --kind spike (its note says the flow is ignored).
  const sp = jsonOf(run(["spike", "Cache", "--flow", "design-first", "--json", "--project", fr]));
  ok(sp && sp.ok && sp.kind === "spike" && typeof sp.note === "string" && /fluxo ignorado/.test(sp.note), "spike --flow design-first gets create's 'flow ignored' note (got " + JSON.stringify(sp && [sp.kind, sp.note]) + ")");
}

// 1.14 full review (Ga) — evidence, project checks, CLI runs.
if (inSection("frga")) {
  const Sga = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const jsonGa = (s) => { try { return JSON.parse(s); } catch { return null; } };
  const rga = (proj, args, env) => {
    const r = spawnSync(process.execPath, [CLI, ...args, "--project", proj], { encoding: "utf8", env: { ...process.env, ...(env || {}) } });
    return { out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "", code: r.status };
  };
  const stGa = (f) => JSON.parse(fs.readFileSync(path.join(f.dir, ".state.json"), "utf8"));
  const tasksGa = (f) => fs.readFileSync(path.join(f.dir, "tasks.md"), "utf8");
  const wGa = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const PASS = 'node -e "process.exit(0)"';
  const gp = path.join(tmp, "frga-proj");
  Sga.initProject(gp, ["core"], "en");

  // Ga1: a shell that can't start (--shell / DEV_SPEC_SHELL) is no exit 1 — done --run refuses and records nothing (an
  // _Expect: fail_ task was ticked on a "red run" that never happened); finish --run records no check run.
  const f1 = Sga.createFeature(gp, "Shellless", ["core"], "", undefined, "en");
  wGa(f1.dir, "tasks.md", "- [ ] 1. [US1] Write T-01 red\n  - _Verify: " + PASS + "_\n  - _Expect: fail_\n");
  const g1 = rga(gp, ["done", f1.slug, "1", "--run", "--shell", "no-such-shell-dsd", "--json"]);
  const g1j = jsonGa(g1.stdout);
  const g1env = rga(gp, ["done", f1.slug, "1", "--run"], { DEV_SPEC_SHELL: "no-such-shell-dsd" });
  const gpc = path.join(tmp, "frga-checks");
  Sga.initProject(gpc, ["core"], "en", { checks: { test: PASS } });
  const fc = Sga.createFeature(gpc, "Fin", ["core"], "", undefined, "en");
  wGa(fc.dir, "tasks.md", "- [x] 1. [US1] Done\n");
  const g1f = rga(gpc, ["finish", fc.slug, "--run", "--shell", "no-such-shell-dsd", "--json"]);
  const g1fj = jsonGa(g1f.stdout);
  ok(g1.code === 1 && g1j && g1j.couldNotRun === "shell-not-started" && /could not run \(the shell 'no-such-shell-dsd' could not be started: ENOENT\) — nothing was recorded; the task stays open/.test(g1j.error) &&
    g1env.code === 1 && /nothing was recorded; the task stays open/.test(g1env.out) && !(stGa(f1).evidence || {})["1"] && /- \[ \] 1\./.test(tasksGa(f1)) &&
    g1f.code === 1 && g1fj && g1fj.couldNotRun === "shell-not-started" && g1fj.check === "test" && /the project check 'test' .* could not run/.test(g1fj.error) && !stGa(fc).finishChecks,
    "full review Ga1: done --run / finish --run with a shell that can't start refuse and record nothing (no 'red run', no failed check run; --shell and DEV_SPEC_SHELL) (got " +
    JSON.stringify([g1.code, g1j, g1env.out.slice(-160), g1f.code, g1fj && g1fj.error]).slice(0, 600) + ")");

  // Ga2: an _Expect: fail_ run that fails because the test never ran (here: the runner's own "Could not find '…'") is no red
  // run — refused, nothing recorded; the same task failing on an assertion is the red proof.
  const f2 = Sga.createFeature(gp, "Missing test", ["core"], "", undefined, "en");
  wGa(f2.dir, "tasks.md", "- [ ] 1. [US1] Write T-01 and watch it fail\n  - _Verify: node t/red.js_\n  - _Expect: fail_\n");
  wGa(gp, "t/red.js", "console.error(\"Could not find 't/uppercase.test.js'\");\nprocess.exit(1);\n");
  const g2 = rga(gp, ["done", f2.slug, "1", "--run", "--json"]);
  const g2j = jsonGa(g2.stdout);
  const g2rec = (stGa(f2).evidence || {})["1"];
  wGa(gp, "t/red.js", "require(\"assert\").strictEqual(\"a\".toUpperCase(), \"B\");\n");
  const g2b = rga(gp, ["done", f2.slug, "1", "--run"]);
  ok(g2.code === 1 && g2j && g2j.couldNotRun === "output" && g2j.expected === "fail" && /its output shows the test never ran \(Could not find 't\/uppercase\.test\.js'\) — that is no red test/.test(g2j.error) &&
    !g2rec && g2b.code === 0 && /✓ red run recorded for task 1 \(exit 1\)/.test(g2b.out) && /- \[x\] 1\./.test(tasksGa(f2)),
    "full review Ga2: done --run on an _Expect: fail_ task whose test never ran (missing test file) is refused, nothing recorded; an assertion failure is then the red proof (got " +
    JSON.stringify([g2.code, g2j && g2j.error, g2b.out.slice(0, 200)]).slice(0, 500) + ")");

  // Ga3: finish --run --write, then the implementing file changes, then finish --write (no --run) → not ready: the check run is
  // for other code (code-changed) — it used to answer "ready … Replaced the baseline" on the old run.
  const g3p = path.join(tmp, "frga-drift");
  Sga.initProject(g3p, ["core"], "en", { checks: { test: PASS } });
  const f3 = Sga.createFeature(g3p, "Limiter", ["core"], "", undefined, "en");
  wGa(f3.dir, "classification.md", "# Classification: x\n\n## Mode\nSpec\n\n## Active Tracks\ncore\n\n## Signals\n- none, plain feature\n\n## Blast Radius\nLow; only the login page.\n\n## Compliance Tags\nnone\n");
  wGa(f3.dir, "requirements.md", "# Feature: x\n\n## Summary\nUsers log in with email and password.\n\n## User Stories (prioritized — each independently testable)\n\n### US-1 (P1 — MVP): Log in\n" +
    "**As a** user, **I want** to log in, **so that** I see my account.\n**Why P1:** nothing works without it.\n**Independent Test:** Can be fully tested by logging in and delivers access, without the other stories.\n\n" +
    "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the user submits valid credentials THE SYSTEM SHALL open a session\n2. **US-1.AC-2** — IF the credentials are wrong THEN THE SYSTEM SHALL show an error\n\n" +
    "## Success Criteria (measurable, technology-agnostic)\n- **SC-001** — 95% of logins complete in under 2 seconds\n\n## Edge Cases & Error Handling\n- **EC-1** — Locked account: show the lock message\n\n" +
    "## Non-Functional Requirements\n- **NFR-1** — p95 latency under 300 ms\n\n## Out of Scope\n- Social login\n\n## Assumptions\n- Users already have accounts\n");
  wGa(f3.dir, "design.md", "# Design: x\n\n## Overview\nA form posts to /login; the server checks the hash.\n\n## Architecture\nThe web app calls the auth service.\n\n## Data Models\nUser { id, email, hash }\n\n" +
    "## API Contracts\nPOST /login returns 200 or 401.\n\n## Security Considerations\nHashes use bcrypt.\n\n## Error Handling\nWrong credentials give 401.\n\n## Testing Strategy\n- Unit tests for the handler.\n\n" +
    "## Constitution Check\n- [x] Simplicity — complies\n\n## Complexity Tracking\nNone.\n");
  wGa(f3.dir, "tasks.md", "# Tasks\n\n## Story US-1 (P1 — MVP)\n- [ ] 1. [US1] Implement the login handler (EC-1, NFR-1)\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/limiter.js_\n  - _Verify: " + PASS + "_\n" +
    "- [ ] 2. [US1] Show the error message\n  - _Requirements: US-1.AC-2_\n  - _Verify: " + PASS + "_\n**Checkpoint:** US-1 works.\n");
  wGa(g3p, "src/limiter.js", "module.exports = 1;\n");
  Sga.approvePhase(g3p, f3.slug, null, "u", { through: "tasks" });
  rga(g3p, ["done", f3.slug, "1", "--run"]);
  rga(g3p, ["done", f3.slug, "2", "--run"]);
  const g3a = rga(g3p, ["finish", f3.slug, "--run", "--write"]);
  const fin3At = (stGa(f3).finished || {}).at;
  wGa(g3p, "src/limiter.js", "module.exports = 2; // changed after the checks ran\n");
  const g3b = rga(g3p, ["finish", f3.slug, "--write"]);
  const fin3Same = (stGa(f3).finished || {}).at === fin3At;
  const na3 = jsonGa(rga(g3p, ["next-action", f3.slug, "--json"]).stdout); // drift → "harmless → re-finish" names the check run it needs
  const g3c = rga(g3p, ["finish", f3.slug, "--run", "--write"]);
  ok(g3a.code === 0 && /is ready to finish/.test(g3a.out) && !!fin3At && g3b.code === 1 && /test \(the implementing files changed since the run\)/.test(g3b.out) && !/Replaced the baseline/.test(g3b.out) && fin3Same &&
    na3 && na3.step === "drift" && /dev-spec finish limiter --run runs and records them/.test(na3.recommendation) &&
    g3c.code === 0 && /Replaced the baseline/.test(g3c.out),
    "full review Ga3: finish --write after the implementing file changed is refused on the old check run (code-changed, baseline kept); next-action's drift step names finish --run; finish --run --write runs the checks again and re-baselines (got " +
    JSON.stringify([g3a.code, g3a.out.slice(0, 160), g3b.code, g3b.out.slice(0, 300), g3c.code]).slice(0, 700) + ")");

  // Ga6: append-tasks --makes-green / --expect-fail / --size (= spec_append_tasks {makesGreen, expectFail, size}).
  const g6p = path.join(tmp, "frga-append");
  Sga.initProject(g6p, ["tdd"], "en");
  const f6 = Sga.createFeature(g6p, "Conv", ["tdd"], "", undefined, "en");
  const before6 = tasksGa(f6);
  const a6bad = rga(g6p, ["append-tasks", f6.slug, "--task", "x", "--size", "huge"]);
  const a6ph = rga(g6p, ["append-tasks", f6.slug, "--task", "x", "--makes-green", "T-42"]);
  const a6bool = rga(g6p, ["append-tasks", f6.slug, "--task", "x", "--expect-fail=maybe"]);
  const a6two = rga(g6p, ["append-tasks", f6.slug, "--task", "x", "--size", "S", "--size", "M"]);
  const same6 = tasksGa(f6) === before6;
  const a6 = rga(g6p, ["append-tasks", f6.slug, "--task", "Write the regression test", "--req", "US-1.AC-1", "--makes-green", "T-1", "--makes-green", "T-02", "--expect-fail", "--size", "m", "--verify", "npm test", "--json"]);
  const a6j = jsonGa(a6.stdout);
  ok(a6bad.code === 1 && /size must be one of XS, S, M, L, XL \(got 'huge'\)/.test(a6bad.out) && a6ph.code === 1 && /Unknown tests \(not planned in test-plan\.md\): T-42/.test(a6ph.out) &&
    a6bool.code === 1 && /--expect-fail/.test(a6bool.out) && a6two.code === 1 && /--size once per call/.test(a6two.out) && same6 &&
    a6.code === 0 && a6j && a6j.appended[0].expectFail === true && a6j.appended[0].size === "M" && JSON.stringify(a6j.appended[0].makesGreen) === '["T-01","T-02"]' &&
    /  - _Makes green: T-01, T-02_\n  - _Verify: npm test_\n  - _Expect: fail_\n  - _Size: M_\n/.test(tasksGa(f6)),
    "full review Ga6: append-tasks --makes-green (repeatable, as the plan spells the T-IDs) / --expect-fail / --size write the markers; a bad size, an unplanned T-ID, a non-boolean --expect-fail or a second --size writes nothing (got " +
    JSON.stringify([a6bad.out.slice(0, 120), a6ph.out.slice(0, 120), a6.out.slice(0, 200)]).slice(0, 500) + ")");

  // Ga9 (Windows): --shell bash is Git Bash, never WSL's launcher. An explicit System32 bash.exe is the user's choice (1.15): it
  // runs inside WSL — with no working distribution the relay fails and that is could-not-run (`wsl`), nothing recorded.
  if (process.platform === "win32") {
    const f9 = Sga.createFeature(gp, "Wsl", ["core"], "", undefined, "en");
    wGa(f9.dir, "tasks.md", "- [ ] 1. [US1] Must pass\n  - _Verify: exit 0_\n"); // a builtin: no node needed inside a WSL distribution
    const sysBash = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "bash.exe");
    const g9 = rga(gp, ["done", f9.slug, "1", "--run", "--shell", sysBash, "--json"]);
    const g9j = jsonGa(g9.stdout);
    const g9x = jsonGa(rga(gp, ["done", f9.slug, "1", "--run", "--shell", path.join(path.dirname(sysBash), "wsl.exe"), "--json"]).stdout);
    const g9none = !(stGa(f9).evidence || {})["1"] || !!(g9j && g9j.ok); // before the Git Bash run below records its pass
    ok(g9x && g9x.ok === false && g9x.couldNotRun === "wsl-exe" && /wsl\.exe/.test(g9x.error),
      "full review Ga9 (Windows): --shell <System32 wsl.exe> is no shell (it rejects -c) — refused before anything runs, nothing recorded (got " + JSON.stringify(g9x) + ")");
    const gitExec = spawnSync("git", ["--exec-path"], { encoding: "utf8" });
    const gitBash = Sga.resolveRunShell("bash", { gitExecPath: gitExec.status === 0 ? gitExec.stdout : null });
    const g9b = gitBash.shell ? rga(gp, ["done", f9.slug, "1", "--run", "--shell", "bash", "--json"]) : null;
    const g9bj = g9b && jsonGa(g9b.stdout);
    // Either WSL ran it (a working distribution: a real pass is recorded) or its relay failed (could-not-run `wsl` / the shell
    // didn't start: nothing recorded) — never a bogus failed run or red proof.
    const wslRan = g9.code === 0 && g9j && g9j.ok === true;
    const wslNot = g9.code === 1 && g9j && ["wsl", "shell-not-started"].includes(g9j.couldNotRun) && g9none;
    ok((wslRan || wslNot) && (!g9b || (g9b.code === 0 && g9bj && g9bj.verified === true)),
      "full review Ga9 (Windows): --shell <System32 bash.exe> is used as given — it runs under WSL or, when WSL can't run it, is could-not-run with nothing recorded; --shell bash runs under Git Bash when installed (got " +
      JSON.stringify([g9.code, g9j, gitBash, g9b && g9b.out.slice(0, 200)]).slice(0, 600) + ")");
  } else ok(true, "full review Ga9: --shell <System32 bash.exe> refusal — Windows only (resolveRunShell is unit-tested in mcp/test.js)");

  // Ga10: --timeout, output over the buffer and a cmd.exe failure under --shell cmd are could-not-run too — nothing recorded.
  const f10 = Sga.createFeature(gp, "Limits", ["core"], "", undefined, "en");
  wGa(f10.dir, "tasks.md", "- [ ] 1. [US1] Slow\n  - _Verify: node -e \"setTimeout(function () {}, 2500)\"_\n" +
    "- [ ] 2. [US1] Loud\n  - _Verify: node -e \"process.stdout.write(Buffer.alloc(70 * 1024 * 1024, 120).toString())\"_\n  - _Expect: fail_\n" +
    "- [ ] 3. [US1] Write T-03 red\n  - _Verify: cd no-such-dir-dsd_\n  - _Expect: fail_\n");
  const g10t = rga(gp, ["done", f10.slug, "1", "--run", "--timeout", "1", "--json"]);
  const g10tj = jsonGa(g10t.stdout);
  const g10z = rga(gp, ["done", f10.slug, "1", "--run", "--timeout", "0"]);
  const g10b = rga(gp, ["done", f10.slug, "2", "--run", "--json"]);
  const g10bj = jsonGa(g10b.stdout);
  let g10cmdOk = true, g10c = null;
  if (process.platform === "win32") {
    g10c = jsonGa(rga(gp, ["done", f10.slug, "3", "--run", "--shell", "cmd", "--json"]).stdout);
    g10cmdOk = !!g10c && g10c.ok === false && g10c.couldNotRun === "cmd" && /cmd\.exe\) could not run `cd no-such-dir-dsd`/.test(g10c.error);
  }
  const gpb = path.join(tmp, "frga-checks-big");
  Sga.initProject(gpb, ["core"], "en", { checks: { big: "node -e \"process.stdout.write(Buffer.alloc(70 * 1024 * 1024, 120).toString())\"" } });
  const fb = Sga.createFeature(gpb, "Big", ["core"], "", undefined, "en");
  wGa(fb.dir, "tasks.md", "- [x] 1. [US1] Done\n");
  const g10f = jsonGa(rga(gpb, ["finish", fb.slug, "--run", "--json"]).stdout);
  ok(g10tj && g10tj.couldNotRun === "timeout" && /did not finish within --timeout 1 s/.test(g10tj.error) && g10z.code === 1 && /--timeout must be an integer ≥ 1/.test(g10z.out) && !/^\$ /m.test(g10z.out) &&
    g10bj && g10bj.couldNotRun === "output-too-large" && /its output exceeded 64 MB/.test(g10bj.error) && g10cmdOk && !stGa(f10).evidence && /- \[ \] 1\.[\s\S]*- \[ \] 2\.[\s\S]*- \[ \] 3\./.test(tasksGa(f10)) &&
    g10f && g10f.couldNotRun === "output-too-large" && g10f.check === "big" && !stGa(fb).finishChecks,
    "full review Ga10: --timeout, output over 64 MB (done --run and finish --run) and a cmd.exe failure under --shell cmd on an _Expect: fail_ task are could-not-run — refused, nothing recorded; --timeout 0 is refused before anything runs (got " +
    JSON.stringify([g10tj, g10z.out.slice(0, 120), g10bj && g10bj.couldNotRun, g10c, g10f && g10f.couldNotRun]).slice(0, 600) + ")");
}

// 1.14 full review (Gb) — next_action, doctor, stop gate, guard.
if (inSection("frgb")) { // 1.14 full review (Gb) — the CLI surfaces of next-action / impact / approve --through / stop-check, and the guard hook
  const gbP = (n) => path.join(tmp, "frgb-" + n);
  const gbW = (dir, rel, txt) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), txt); };
  const gbR = (dir, rel) => fs.readFileSync(path.join(dir, rel), "utf8");
  const gbRun = 'node -e "process.exit(0)"';
  // A core feature 'login' whose planning chain is filled (the fast-forward through tasks passes every gate).
  const gbFill = (p) => {
    const dir = path.join(p, ".specs", "login");
    gbW(dir, "classification.md", "# Classification: login\n\n## Mode\nSpec\n\n## Active Tracks\ncore\n\n## Signals\n- none, plain feature\n\n## Blast Radius\nLow; only the login page.\n\n## Compliance Tags\nnone\n");
    gbW(dir, "requirements.md", "# Feature: login\n\n## Summary\nUsers log in with email and password.\n\n## User Stories (prioritized — each independently testable)\n\n### US-1 (P1 — MVP): Log in\n" +
      "**As a** user, **I want** to log in, **so that** I see my account.\n**Why P1:** nothing works without it.\n**Independent Test:** Can be fully tested by logging in and delivers access, without the other stories.\n\n" +
      "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the user submits valid credentials THE SYSTEM SHALL open a session\n2. **US-1.AC-2** — IF the credentials are wrong THEN THE SYSTEM SHALL show an error\n\n" +
      "## Success Criteria (measurable, technology-agnostic)\n- **SC-001** — 95% of logins complete in under 2 seconds\n\n## Edge Cases & Error Handling\n- **EC-1** — Locked account: show the lock message\n\n" +
      "## Non-Functional Requirements\n- **NFR-1** — p95 latency under 300 ms\n\n## Out of Scope\n- Social login\n\n## Assumptions\n- Users already have accounts\n");
    gbW(dir, "design.md", "# Design: login\n\n## Overview\nA form posts to /login; the server checks the hash.\n\n## Architecture\nThe web app calls the auth service.\n\n## Data Models\nUser { id, email, hash }\n\n" +
      "## API Contracts\nPOST /login returns 200 or 401.\n\n## Security Considerations\nHashes use bcrypt.\n\n## Error Handling\nWrong credentials give 401.\n\n## Testing Strategy\n- Unit tests for the handler.\n\n" +
      "## Constitution Check\n- [x] Simplicity — complies\n\n## Complexity Tracking\nNone.\n");
    gbW(dir, "tasks.md", "# Tasks: login\n\n## Global Constraints\n- Node >= 18\n\n## Story US-1 (P1 — MVP)\n" +
      "- [ ] 1. [US1] Implement the login handler (EC-1, NFR-1)\n  - _Requirements: US-1.AC-1_\n  - _Verify: " + gbRun + "_\n" +
      "- [ ] 2. [US1] Show the error message\n  - _Requirements: US-1.AC-2_\n  - _Verify: " + gbRun + "_\n**Checkpoint:** US-1 works.\n");
    return dir;
  };
  const guardHook = (cwd, file) => spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "guard-hook.js")], { encoding: "utf8",
    input: JSON.stringify({ hook_event_name: "PreToolUse", cwd, tool_name: "Write", tool_input: { file_path: path.join(cwd, file), content: "x" } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" } });

  // Gb2: next-action names the execution role to sign as (roadmap.json meta.approvalRoles.execution).
  const p2 = gbP("roles");
  run(["init", "core", "--roles", "execution=qa+product", "--project", p2]);
  run(["create", "login", "core", "--project", p2]);
  gbFill(p2);
  const ff2 = run(["approve", "login", "--through", "tasks", "--project", p2]);
  run(["done", "login", "1", "--run", "--project", p2]);
  run(["done", "login", "2", "--run", "--project", p2]);
  const fin2 = run(["finish", "login", "--write", "--project", p2]);
  const na2 = run(["next-action", "login", "--project", p2]);
  run(["approve", "login", "execution", "--role", "qa", "--project", p2]);
  const na2b = run(["next-action", "login", "--project", p2]);
  ok(ff2.code === 0 && fin2.code === 0 && /\/approve login execution --role qa\./.test(na2.out) && /missing roles: qa, product/.test(na2.out) && /\/approve login execution --role product\./.test(na2b.out),
    "full review Gb2: next-action names the role for the execution sign-off (--role qa, then --role product) — a role-less /approve is refused (got " + JSON.stringify([na2.out.trim().split("\n").pop(), na2b.out.trim().split("\n").pop()]) + ")");

  // Gb11 + Gb12: impact prints the role to re-approve as; a fast-forward stopped by a role says what it approved.
  const p11 = gbP("impact");
  run(["init", "core", "--roles", "requirements=product", "--project", p11]);
  run(["create", "login", "core", "--project", p11]);
  const d11 = gbFill(p11);
  const ff12 = run(["approve", "login", "--through", "tasks", "--project", p11]);
  run(["approve", "login", "--through", "tasks", "--role", "product", "--project", p11]);
  gbW(d11, "requirements.md", gbR(d11, "requirements.md").replace("THE SYSTEM SHALL open a session", "THE SYSTEM SHALL open a session within 2 seconds"));
  const im11 = run(["impact", "login", "--project", p11]);
  ok(im11.code === 0 && /→ review the change, then re-approve: \/approve login requirements --role product/.test(im11.out),
    "full review Gb11: `impact` prints the re-approve command with the role still to sign (--role product) (got " + JSON.stringify(im11.out.trim().split("\n").pop()) + ")");
  ok(ff12.code === 1 && /stopped at 'requirements' \(approved before it: classification\)/.test(ff12.out) && /nothing was recorded for 'requirements'/.test(ff12.out) && !/Nothing recorded/.test(ff12.out),
    "full review Gb12: approve --through stopped by a role refusal says what it approved and that nothing was recorded for the stopping phase — not 'Nothing recorded.' (got " + JSON.stringify(ff12.out.trim()) + ")");

  // Gb4: stop-check never sends a decided spike back over project checks (a spike has none).
  const p4 = gbP("spike");
  run(["init", "core", "--check", "test=" + gbRun, "--project", p4]);
  run(["spike", "cache spike", "--question", "Should we use Redis for the session cache?", "--timebox", "3d", "--project", p4]);
  const sd4 = path.join(p4, ".specs", "cache-spike");
  gbW(sd4, "spike.md", gbR(sd4, "spike.md").replace("> **TODO** — go / no-go / pivot, and why: the evidence that decided it.", "Go: Redis cut p95 latency by 40% in the prototype.").replace("_Outcome: [go | no-go | pivot]_", "_Outcome: go_"));
  for (const n of ["1", "2", "3", "4"]) run(["done", "cache-spike", n, "--project", p4]);
  const sc4 = run(["stop-check", "--message", "The spike is done: the decision is go.", "--project", p4]);
  ok(sc4.code === 0 && !/project checks/.test(sc4.out),
    "full review Gb4: stop-check allows a decided spike's 'done' — project checks are not a spike's gate (got " + JSON.stringify([sc4.code, sc4.out.trim()]) + ")");

  // Gb8 + Gb9 through the guard hook: Phase 4 test files and an active spike's prototype are not asked for; other code still is.
  const p8 = gbP("guard");
  run(["init", "tdd", "--guard", "on", "--project", p8]);
  run(["create", "Shortener", "tdd", "--project", p8]);
  const st8 = path.join(p8, ".specs", "shortener", ".state.json");
  const s8 = JSON.parse(fs.readFileSync(st8, "utf8"));
  s8.approvals = { "test-plan": { at: "2026-09-01T00:00:00.000Z", by: "u" } };
  fs.writeFileSync(st8, JSON.stringify(s8, null, 2));
  const h8t = guardHook(p8, "test/shortener.test.js");
  const h8c = guardHook(p8, "src/shortener.js");
  run(["spike", "cache spike", "--question", "Should we use Redis?", "--project", p8]);
  const h9 = guardHook(p8, "proto/redis.js");
  let h8cJ = null;
  try { h8cJ = JSON.parse(h8c.stdout); } catch { /* not JSON */ }
  ok(h8t.status === 0 && h8t.stdout === "" && h8cJ && h8cJ.hookSpecificOutput.permissionDecision === "ask" && h9.status === 0 && h9.stdout === "",
    "full review Gb8/Gb9: the guard hook stays silent for a test file while a test plan is approved (Phase 4) and for a prototype file while a spike is under way; a code file with no approved tasks still asks (got " +
    JSON.stringify([h8t.stdout, h8cJ && h8cJ.hookSpecificOutput.permissionDecision, h9.stdout]) + ")");
}

// 1.14 full review (Pa) — markers, EARS, comments, traceability, T-ID scan.

// 1.14 full review (Pb) — import, classifier, section synonyms, i18n / pt-BR.
if (inSection("frpb")) {
  const jsonOf = (r) => { try { return JSON.parse(r.out); } catch { return null; } };
  // Pb2: `create` classifies a new feature in the project's configured language (= spec_create) — "no checkout" is PT em+o.
  const pb = path.join(tmp, "frpb-proj");
  run(["init", "--lang", "pt", "--project", pb]);
  const c2 = jsonOf(run(["create", "IVA", "--summary", "Corrigir o cálculo do IVA no checkout", "--json", "--project", pb]));
  const c2en = jsonOf(run(["create", "IVA EN", "--summary", "Corrigir o cálculo do IVA no checkout", "--lang", "en", "--json", "--project", pb]));
  ok(c2 && c2.ok && c2.tracks.join() === "core,tdd" && c2en && c2en.ok && c2en.tracks.join() === "core",
    "full review Pb2: create in a meta.lang pt project reads the summary in PT ('no checkout' = em+o → +tdd); an explicit --lang en still reads 'no' as a negator (got " +
    JSON.stringify([c2 && c2.tracks, c2en && c2en.tracks]) + ")");
}

// 1.14 full review (S) — CLI surfaces and hooks.
if (inSection("frs")) {
  const SF = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const jsonOf = (r) => { try { return JSON.parse(r.out); } catch { return null; } };
  const pf = path.join(tmp, "frs-proj");
  run(["init", "core", "--project", pf]);
  run(["create", "Big", "core", "--project", pf]);
  fs.writeFileSync(path.join(pf, ".specs", "big", "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] one\n- [ ] 2. [US1] two\n");
  const tasksOf = () => fs.readFileSync(path.join(pf, ".specs", "big", "tasks.md"), "utf8");

  // S4 — an explicit --include-body=false / --include-brief=false reaches the engine (= spec_finish / spec_task_brief {…: false}).
  const fin0 = jsonOf(run(["finish", "big", "--include-body=false", "--json", "--project", pf]));
  const fin1 = jsonOf(run(["finish", "big", "--json", "--project", pf]));
  const fin2 = jsonOf(run(["finish", "big", "--include-body", "--write", "--json", "--project", pf]));
  const br0 = jsonOf(run(["brief", "big", "1", "--include-brief=false", "--json", "--project", pf]));
  const br1 = jsonOf(run(["brief", "big", "1", "--json", "--project", pf]));
  ok(fin0 && !("mergeSummary" in fin0) && fin1 && typeof fin1.mergeSummary === "string" && fin2 && typeof fin2.mergeSummary === "string" &&
    br0 && br0.ok && !("brief" in br0) && br1 && typeof br1.brief === "string",
    "full review S4: finish --include-body=false omits mergeSummary and brief --include-brief=false omits the brief, as the MCP tools do with false; absent keeps the default (got " +
    JSON.stringify([fin0 && "mergeSummary" in fin0, fin1 && typeof fin1.mergeSummary, br0 && "brief" in br0]) + ")");

  // S5 — an unknown --flag is a usage error before anything runs (with a did-you-mean); `--` ends the options.
  const typo = run(["done", "big", "1", "--rnu", "--project", pf]);
  const typoEq = run(["done", "big", "1", "--evidnce=ok", "--project", pf]);
  ok(typo.code === 1 && /unknown option --rnu — did you mean --run\?/.test(typo.out) && typoEq.code === 1 && /unknown option --evidnce — did you mean --evidence\?/.test(typoEq.out) &&
    /^- \[ \] 1\./m.test(tasksOf()),
    "full review S5: done big 1 --rnu (and --evidnce=…) exits 1 with a did-you-mean and ticks nothing — an unknown flag was a silent switch (got " + JSON.stringify([typo.code, typo.out.trim().slice(0, 90)]) + ")");
  run(["init", "core", "--lang", "pt", "--project", path.join(tmp, "frs-pt")]);
  const ptTypo2 = run(["list", "--jsno", "--project", path.join(tmp, "frs-pt")]);
  ok(ptTypo2.code === 1 && /opção desconhecida --jsno — será --json\?/.test(ptTypo2.out),
    "full review S5: the unknown-option error is localized in the project language (PT) (got " + ptTypo2.out.trim() + ")");
  const dd = run(["backlog", "add", "--project", pf, "--", "--later", "plan"]);
  const bl5 = SF.backlog(pf).backlog.map((b) => b.name + "|" + b.note).join();
  ok(dd.code === 0 && bl5 === "--later|plan",
    "full review S5: `--` ends the options — the tokens after it are positional (backlog add -- --later plan) (got " + JSON.stringify([dd.code, bl5, dd.out.trim().slice(0, 80)]) + ")");
  // Every flag the help documents is known (the evals harness's and git log's own flags excepted); --help anywhere prints help.
  const helpFlags = [...new Set((run(["help"]).out.match(/--[a-z][a-z-]*/g) || []).map((f) => f.slice(2)))]
    .filter((f) => !["flag", "dry-run", "name-only", "relative"].includes(f));
  const allFlags = run(["help", ...helpFlags.map((f) => (f === "lang" ? "--lang=en" : f === "project" ? "--project=" + pf : "--" + f + "=1"))]);
  const helpAnywhere = run(["done", "big", "2", "--help", "--project", pf]);
  ok(helpFlags.length > 50 && allFlags.code === 0 && /universal spec-driven CLI/.test(allFlags.out) && helpAnywhere.code === 0 && /universal spec-driven CLI/.test(helpAnywhere.out) &&
    /^- \[ \] 2\./m.test(tasksOf()),
    "full review S5: every --flag the help documents (" + helpFlags.length + ") is accepted; done … --help prints the help and ticks nothing (got " + JSON.stringify([allFlags.code, allFlags.out.trim().split("\n")[0].slice(0, 100)]) + ")");

  // S7 — backlog remove (rm's alias) prints the removal like rm.
  run(["backlog", "add", "Zeta Seven", "--project", pf]);
  const rm7 = run(["backlog", "remove", "zeta seven", "--project", pf]);
  ok(rm7.code === 0 && /'zeta seven' removed from the backlog/.test(rm7.out) && !/Zeta Seven/.test(run(["backlog", "--project", pf]).out),
    "full review S7: backlog remove is rm's alias on the CLI too (removed, same message) (got " + rm7.out.trim().split(/\r?\n/)[0] + ")");

  // S8 — SessionStart lists at most 20 features (the most relevant), then ONE '+N more' line.
  const p8 = path.join(tmp, "frs-many");
  SF.initProject(p8, ["core"], "en");
  for (let i = 1; i <= 22; i++) SF.createFeature(p8, "Feat " + String(i).padStart(2, "0"), ["core"], "", undefined, "en");
  const zz = SF.createFeature(p8, "Zz Active", ["core"], "", undefined, "en");
  fs.writeFileSync(path.join(zz.dir, "tasks.md"), "# Tasks\n\n- [x] 1. [US1] one\n- [ ] 2. [US1] two\n");
  const hk = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "spec-hook.js")], { input: JSON.stringify({ hook_event_name: "SessionStart", cwd: p8 }), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: p8, SPEC_PROJECT_DIR: p8 } });
  let ctx = "";
  try { ctx = JSON.parse(hk.stdout).hookSpecificOutput.additionalContext; } catch { /* no output */ }
  const bullets = ctx.split("\n").filter((l) => /^ {2}• /.test(l));
  ok(hk.status === 0 && bullets.length === 20 && /• zz-active \[core\] — executing \(1\/2 tasks\)/.test(ctx) && /\+3 more feature\(s\) — \/spec-status/.test(ctx),
    "full review S8: SessionStart with 23 features prints 20 feature lines — the executing one included, though last by name — and '+3 more … /spec-status' (got " + bullets.length + " lines, " + JSON.stringify(ctx.split("\n").slice(-2)) + ")");
}

// 1.14 full review (D) — CLI help and docs.

// 1.14 feature (F1) — harness-observed evidence: if (inSection("ffobs")) { … }
if (inSection("ffobs")) {
  const Sob = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const HOOK = path.join(__dirname, "..", "hooks", "observe-hook.js");
  const jsonOb = (s) => { try { return JSON.parse(s); } catch { return null; } };
  const rob = (proj, args) => {
    const r = spawnSync(process.execPath, [CLI, ...args, "--project", proj], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: "", CLAUDE_PROJECT_DIR: "" } });
    return { out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "", code: r.status };
  };
  const stOb = (f) => JSON.parse(fs.readFileSync(path.join(f.dir, ".state.json"), "utf8"));
  const metaOb = (p) => JSON.parse(fs.readFileSync(path.join(p, ".specs", "roadmap.json"), "utf8")).meta || {};
  const PASS = 'node -e "process.exit(0)"';
  const po = path.join(tmp, "ffobs-cli");
  Sob.initProject(po, ["core"], "en", { checks: { test: PASS } });
  const fo = Sob.createFeature(po, "Obs", ["core"], "", undefined, "en");
  fs.writeFileSync(path.join(fo.dir, "tasks.md"), "- [ ] 1. [US1] One\n  - _Verify: " + PASS + "_\n- [ ] 2. [US1] Two\n  - _Verify: node two.js_\n- [ ] 3. [US1] Three\n  - _Verify: node three.js_\n");

  // init --evidence reported|observed (= spec_init {evidence}); a bad value exits 1, localized.
  const i1 = rob(po, ["init", "--evidence", "observed"]);
  const m1 = metaOb(po).evidence;
  const i2 = rob(po, ["init", "--evidence=REPORTED", "--json"]);
  const i3 = rob(po, ["init", "--evidence", "maybe"]);
  const i4 = rob(path.join(tmp, "ffobs-cli-pt"), ["init", "--lang", "pt", "--evidence", "talvez"]);
  const i5 = rob(po, ["init", "--json"]);
  ok(i1.code === 0 && /Evidence mode OBSERVED/.test(i1.out) && m1 === "observed" && i2.code === 0 && (jsonOb(i2.stdout) || {}).evidence === "reported" && metaOb(po).evidence === "reported" &&
    i3.code === 1 && /--evidence takes reported or observed \(got 'maybe'\)/.test(i3.out) && i4.code === 1 && /--evidence aceita reported ou observed \(recebido 'talvez'\)/.test(i4.out) &&
    (jsonOb(i5.stdout) || {}).evidence === "reported" && !/Evidence mode/.test(i5.out),
    "feature F1: init --evidence observed|reported sets roadmap.json meta.evidence (case-folded; --json reports it, a note when set); a bad value exits 1, localized (PT) (got " +
    JSON.stringify([i1.code, m1, i3.out.trim().slice(0, 120), i4.out.trim().slice(0, 120)]) + ")");

  // meta.evidence observed: done --run is observed by the CLI itself ("cli"); a reported run nobody saw ticks but stays unverified
  // (unobserved + the note); once the hook saw the command run, the same report verifies.
  rob(po, ["init", "--evidence", "observed"]);
  const d1 = rob(po, ["done", fo.slug, "1", "--run", "--json"]);
  const d1j = jsonOb(d1.stdout) || {};
  const d2 = rob(po, ["done", fo.slug, "2", "--cmd", "node two.js", "--exit", "0"]);
  const d2j = jsonOb(rob(po, ["done", fo.slug, "2", "--cmd", "node two.js", "--exit", "0", "--json"]).stdout) || {};
  const hk = spawnSync(process.execPath, [HOOK], { encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: po, SPEC_PROJECT_DIR: "" },
    input: JSON.stringify({ session_id: "c1", cwd: po, hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "node three.js" }, tool_response: { stdout: "ok", stderr: "", exit_code: 0 } }) });
  const d3j = jsonOb(rob(po, ["done", fo.slug, "3", "--cmd", "node three.js", "--exit", "0", "--json"]).stdout) || {};
  ok(d1.code === 0 && d1j.verified === true && d1j.observed === "cli" && stOb(fo).evidence["1"].observed === "cli" &&
    d2.code === 0 && /^Task 2 done\. /m.test(d2.out) && !/\(verified\)/.test(d2.out) && /⚠ Task 2: the run was recorded, but the harness never saw it .*dev-spec done obs 2 --run/.test(d2.out) &&
    d2j.unverifiedReason === "unobserved" && d2j.observed === false && hk.status === 0 && hk.stdout === "" && d3j.verified === true && d3j.observed === true,
    "feature F1: with meta.evidence observed, done --run records observed: \"cli\" (verified); done --cmd/--exit of a run nobody saw ticks it unverified (unobserved, the note names --run); after the hook logged the run, the same report verifies (got " +
    JSON.stringify([d1j.observed, d2.out.trim().slice(0, 200), d2j.unverifiedReason, d3j.observed]) + ")");

  // The one verdict: doctor and stop-check name the unobserved task; finish --run records its checks as observed "cli".
  const doc = rob(po, ["doctor", fo.slug]);
  const stop = rob(po, ["stop-check", "--message", "Done — all tasks are complete and verified."]);
  const fin = rob(po, ["finish", fo.slug, "--run", "--json"]);
  const finj = jsonOb(fin.stdout) || {};
  const tst = (finj.suiteChecks || []).find((c) => c.name === "test") || {};
  ok(/#2 \(run not observed by the harness\)/.test(doc.out) && stop.code === 1 && /#2 \(run not observed by the harness\)/.test(stop.out) &&
    tst.status === "pass" && tst.observed === "cli" && stOb(fo).finishChecks.test.observed === "cli" && (finj.blockers || []).some((b) => /#2 \(run not observed by the harness\)/.test(b)),
    "feature F1: doctor and stop-check list the unobserved task; finish --run stamps its project-check runs observed: \"cli\" (pass) while the unobserved task still blocks (got " +
    JSON.stringify([stop.code, tst, finj.blockers]).slice(0, 400) + ")");

  // Back to reported: the same records verify (today's rule); help and the header docblock document --evidence.
  rob(po, ["init", "--evidence", "reported"]);
  const docR = rob(po, ["doctor", fo.slug]);
  const help = run(["--help"]).out;
  const docblock = fs.readFileSync(CLI, "utf8").slice(0, 12000);
  ok(!/not observed by the harness/.test(docR.out) && help.includes("--evidence reported|observed") && docblock.includes("--evidence reported|observed"),
    "feature F1: back to meta.evidence reported the unobserved run verifies again; --help and the header docblock document init --evidence reported|observed");
}

// 1.14 feature (F2) — human approval guard: if (inSection("ffgate")) { … }
if (inSection("ffgate")) {
  const SF = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const jsonOf = (r) => { try { return JSON.parse(r.out); } catch { return null; } };
  const meta = (p) => { try { return JSON.parse(fs.readFileSync(path.join(p, ".specs", "roadmap.json"), "utf8")).meta || {}; } catch { return {}; } };
  const pg = path.join(tmp, "ffgate-en");
  // init --approval-guard off|ask|deny = spec_init {approvalGuard}: stored, noted, always reported; anything else refused.
  const i1 = run(["init", "core", "--approval-guard", "deny", "--project", pg]);
  const i2 = jsonOf(run(["init", "--json", "--project", pg]));
  const i3 = run(["init", "--approval-guard", "maybe", "--project", pg]);
  const i4 = run(["init", "--approval-guard", "--json", "--project", pg]);
  const i5 = jsonOf(run(["init", "--approval-guard=ASK", "--json", "--project", pg]));
  ok(i1.code === 0 && /Approval guard DENY — an agent's approval/.test(i1.out) && meta(pg).approvalGuard === "ask" && i2 && i2.approvalGuard === "deny" && i2.approvalGuardNote === undefined &&
    i3.code === 1 && /--approval-guard takes off, ask or deny \(got 'maybe'\)/.test(i3.out) && i4.code === 1 &&
    i5 && i5.approvalGuard === "ask" && /^Approval guard ASK/.test(i5.approvalGuardNote) && /--approval-guard off\|ask\|deny/.test(run(["help"]).out),
    "feature F2: init --approval-guard deny / =ASK stores meta.approvalGuard with a note; init --json always reports it; 'maybe' or a missing value is refused (exit 1); help documents it (got " +
    JSON.stringify([i1.code, i2 && i2.approvalGuard, i3.out.trim(), i4.code, i5 && i5.approvalGuard, meta(pg).approvalGuard]) + ")");
  const pp = path.join(tmp, "ffgate-pt");
  const p1 = run(["init", "--lang", "pt", "--approval-guard", "deny", "--project", pp]);
  const p2 = run(["init", "--approval-guard", "talvez", "--project", pp]);
  ok(p1.code === 0 && /O guarda de aprovações está em DENY/.test(p1.out) && p2.code === 1 && /--approval-guard aceita off, ask ou deny \(recebido 'talvez'\)/.test(p2.out),
    "feature F2: the init note and the bad-value error are in the project language (PT) (got " + JSON.stringify([p1.out.trim().split(/\r?\n/).pop(), p2.out.trim()]) + ")");

  // End to end: an agent's Bash `dev-spec approve … --force` in a deny project is refused by the hook; the command the reason
  // gives the human runs as is (the CLI itself is never gated — the human's own run records the approval).
  const pd = path.join(tmp, "ffgate-deny");
  run(["init", "core", "--approval-guard", "deny", "--project", pd]);
  run(["create", "Checkout", "core", "--project", pd]);
  const hook = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "approval-hook.js")], { encoding: "utf8",
    input: JSON.stringify({ hook_event_name: "PreToolUse", cwd: pd, tool_name: "Bash", tool_input: { command: 'node "' + CLI + '" approve checkout requirements --force' } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" } });
  let h = {};
  try { h = JSON.parse(hook.stdout); } catch { /* checked below */ }
  const reason = (h.hookSpecificOutput || {}).permissionDecisionReason || "";
  const suggested = ((h.systemMessage || "").match(/: (! node .*)$/) || [])[1] || "";
  const human = spawnSync(suggested.replace(/^! node /, JSON.stringify(process.execPath) + " "), { shell: true, encoding: "utf8", cwd: pd, env: { ...process.env, SPEC_PROJECT_DIR: pd, CLAUDE_PROJECT_DIR: "" } });
  const st = JSON.parse(fs.readFileSync(path.join(pd, ".specs", "checkout", ".state.json"), "utf8"));
  ok(hook.status === 0 && (h.hookSpecificOutput || {}).permissionDecision === "deny" && /approve the requirements phase of 'checkout' — FORCED/.test(reason) &&
    /cli\/dev-spec\.js" approve checkout requirements --force$/.test(suggested) && human.status === 0 && st.approvals && st.approvals.requirements && st.approvals.requirements.forced === true,
    "feature F2: the hook denies an agent's `dev-spec approve … --force` in a deny project, and the `! node <clone>/cli/dev-spec.js approve …` line it gives the user runs as is and records the (forced) approval (got " +
    JSON.stringify([hook.status, reason.slice(0, 90), suggested, human.status, (human.stdout + human.stderr).trim().slice(0, 160)]) + ")");
  ok(SF.approvalGuardLevel(pd) === "deny" && SF.approvalGuardLevel(pp) === "deny" && SF.approvalGuardLevel(path.join(tmp, "ffgate-none")) === "off",
    "feature F2: approvalGuardLevel reads meta.approvalGuard (no roadmap.json → off)");

  // Review fixes (R10 / R1 / R3 / R9), end to end through the hook and the CLI.
  const hookRun = (cwd, tool, command) => {
    const r = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "approval-hook.js")], { encoding: "utf8",
      input: JSON.stringify({ hook_event_name: "PreToolUse", cwd, tool_name: tool, tool_input: { command } }), env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" } });
    let j = {};
    try { j = JSON.parse(r.stdout); } catch { /* silent */ }
    return { status: r.status, decision: (j.hookSpecificOutput || {}).permissionDecision || (r.stdout === "" ? "silent" : "?"), note: j.systemMessage || "" };
  };
  const q = JSON.stringify(CLI);
  const pr = path.join(tmp, "ffgate-r10");
  const r0 = run(["init", "core", "--approval-guard", "deny", "--evidence", "observed", "--check", 'test=node -e "process.exit(0)"', "--roles", "design=tech", "--stop-check", "on", "--project", pr]);
  const hEv = hookRun(pr, "Bash", "node " + q + " init --evidence reported");
  const hChk = hookRun(pr, "Bash", "node " + q + " init --check test=");
  const hRoles = hookRun(pr, "PowerShell", "node " + q + " init --roles none");
  const hStop = hookRun(pr, "Bash", "node " + q + " init --stop-check off");
  const hUp = hookRun(pr, "Bash", "node " + q + " init --check lint=eslint --evidence observed --stop-check on");
  const userLine = ((hEv.note.match(/: (! node .*)$/) || [])[1] || "");
  const humanEv = spawnSync(userLine.replace(/^! node /, JSON.stringify(process.execPath) + " "), { shell: true, encoding: "utf8", cwd: pr, env: { ...process.env, SPEC_PROJECT_DIR: pr, CLAUDE_PROJECT_DIR: "" } });
  ok(r0.code === 0 && hEv.decision === "deny" && /switch the evidence mode \(meta\.evidence\) back to reported/.test(hEv.note) && hChk.decision === "deny" &&
    hRoles.decision === "deny" && hStop.decision === "deny" && hUp.decision === "silent" &&
    /init --evidence reported$/.test(userLine) && humanEv.status === 0 && SF.evidenceMode(pr) === "reported",
    "feature F2 review R10: in a deny project the hook refuses an agent's init --evidence reported / --check test= / --roles none / --stop-check off (raising or adding passes); the line it gives the user runs as is and lowers meta.evidence (got " +
    JSON.stringify([r0.code, hEv.decision, hChk.decision, hRoles.decision, hStop.decision, hUp.decision, userLine, humanEv.status, meta(pr).evidence]) + ")");
  // R3 / R9: a line-continued approve is refused; a heredoc that only WRITES the approve line into a doc is not.
  const hCont = hookRun(pr, "Bash", "node " + q + " \\\n  approve checkout requirements");
  const hDoc = hookRun(pr, "Bash", "cat > docs/approve.md <<'EOF'\nRun `node " + q + " approve checkout requirements` yourself.\nEOF");
  const hPsCont = hookRun(pr, "PowerShell", "node " + q + " `\n  ap`prove checkout requirements");
  ok(hCont.decision === "deny" && hDoc.decision === "silent" && hPsCont.decision === "deny",
    "feature F2 review R3/R9: the hook refuses a Bash \\⏎-continued and a PowerShell `-escaped approve; a quoted heredoc writing the approve line into a doc passes (got " +
    JSON.stringify([hCont.decision, hDoc.decision, hPsCont.decision]) + ")");
  // R1: `echo x >> .specs/roadmap.json` is refused while the guard is on — and a roadmap.json broken that way keeps the guard
  // (fail closed): the hook still refuses an approve; the CLI refuses to write over the broken file (the human repairs it).
  const hW = hookRun(pr, "Bash", "echo x >> .specs/roadmap.json");
  fs.appendFileSync(path.join(pr, ".specs", "roadmap.json"), "x");
  const hAfter = hookRun(pr, "Bash", "node " + q + " approve checkout requirements");
  const offTry = run(["init", "--approval-guard", "off", "--project", pr]);
  ok(hW.decision === "deny" && /Make that change yourself/.test(hW.note) && SF.approvalGuardLevel(pr) === "deny" && hAfter.decision === "deny" && hAfter.status === 0 && offTry.code === 1,
    "feature F2 review R1: a Bash write of .specs/roadmap.json is refused; after `echo x >> .specs/roadmap.json` the guard still reads deny (engine and hook) and init --approval-guard off can't write over the broken file (got " +
    JSON.stringify([hW.decision, SF.approvalGuardLevel(pr), hAfter.decision, offTry.code, offTry.out.trim().slice(0, 120)]) + ")");
}

// 1.14 feature (F3) — task dependencies and waves: if (inSection("ffdeps")) { … }
if (inSection("ffdeps")) {
  const SD = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const mk = (n, lang = "en") => {
    const p = path.join(tmp, "ffdeps-" + n);
    SD.initProject(p, ["core"], lang);
    const f = SD.createFeature(p, "Deps " + n, ["core"], "", undefined, lang);
    return { p, slug: f.slug, dir: f.dir };
  };
  const put = (x, txt) => fs.writeFileSync(path.join(x.dir, "tasks.md"), txt);
  const tasksOf = (x) => fs.readFileSync(path.join(x.dir, "tasks.md"), "utf8");

  // next --waves: the next task, then the waves; --json is spec_next_task {waves}'s result; --waves=false prints none.
  const w = mk("waves");
  put(w, "# Tasks\n\n- [ ] 1. Schema\n  - _Implements: db/schema.sql_\n- [ ] 2. API\n  - _Depends: 1_\n  - _Implements: src/api.js_\n" +
    "- [ ] 3. UI\n  - _Depends: 1_\n  - _Implements: src/ui.js_\n- [ ] 4. E2E\n  - _Depends: 2, 3_\n  - _Implements: test/e2e.js_\n");
  const n1 = run(["next", w.slug, "--waves", "--project", w.p]);
  const nj = run(["next", w.slug, "--waves", "--json", "--project", w.p]);
  let njr = null;
  try { njr = JSON.parse(nj.out); } catch { /* not JSON */ }
  const nOff = run(["next", w.slug, "--waves=false", "--project", w.p]);
  ok(n1.code === 0 && n1.out === "Next → #1 Schema  (4/4 left)\nWaves (3):\n  1. #1\n  2. #2 #3\n  3. #4\n" && njr && JSON.stringify(njr) === JSON.stringify(SD.nextTask(w.p, w.slug, { waves: true })) &&
    JSON.stringify(njr.waves) === "[[1],[2,3],[4]]" && nOff.code === 0 && !/Waves/.test(nOff.out),
    "feature F3: next --waves prints the next task and the waves (#1 · #2 #3 · #4); --json is spec_next_task {waves}'s result; --waves=false prints no waves (got " + JSON.stringify([n1.out, nOff.out]) + ")");

  // done on a task whose dependencies are open: ticked (exit 0) with the warning; a task that waits is passed over by next.
  const dn = run(["done", w.slug, "4", "--project", w.p]);
  const s = mk("skip");
  put(s, "# Tasks\n\n- [ ] 1. Late\n  - _Depends: 2_\n- [ ] 2. Early\n");
  const sn = run(["next", s.slug, "--project", s.p]);
  ok(dn.code === 0 && /^Task 4 done\. 1\/4 {2}next → #1 Schema\n {2}⚠ Task 4 was ticked while its dependencies #2, #3 are still open/.test(dn.out) && /^- \[x\] 4\./m.test(tasksOf(w)) &&
    sn.code === 0 && sn.out === "Next → #2 Early  (2/2 left)\n  waiting: #1 waits on #2\n",
    "feature F3: done on a task whose _Depends:_ are open ticks it and warns (never refused); next passes over a waiting task and names what it waits on (got " + JSON.stringify([dn.out, sn.out]) + ")");

  // No open task can start: next / brief / done say so (never 'all done'); doctor fails task-deps (exit 1).
  const b = mk("blocked");
  put(b, "# Tasks\n\n- [ ] 1. A\n  - _Depends: 2_\n- [ ] 2. B\n  - _Depends: 1_\n");
  const bn = run(["next", b.slug, "--waves", "--project", b.p]);
  const bb = run(["brief", b.slug, "--project", b.p]);
  const bd = run(["doctor", b.slug, "--project", b.p]);
  const lb = mk("leftblocked");
  put(lb, "# Tasks\n\n- [ ] 1. A\n- [ ] 2. B\n  - _Depends: 3_\n- [ ] 3. C\n  - _Depends: 2_\n");
  const ld = run(["done", lb.slug, "1", "--project", lb.p]);
  ok(bn.code === 0 && /^No open task can start — each waits on a dependency that is not done: #1 waits on #2; #2 waits on #1\./.test(bn.out) && !/All tasks done/.test(bn.out) &&
    /\nWaves \(0\):\n {2}\(no open task can start\)\n {2}⚠ cycle: #1, #2\n$/.test(bn.out) && bb.code === 0 && /^No open task can start/.test(bb.out) &&
    bd.code === 1 && /✗ task-deps — tasks waiting on each other \(a cycle\): #1, #2/.test(bd.out) &&
    ld.code === 0 && /^Task 1 done\. 1\/3\n/.test(ld.out) && !/all done/.test(ld.out) && /⚠ No open task can start — each waits on a dependency that is not done: #2 waits on #3; #3 waits on #2\./.test(ld.out),
    "feature F3: when no open task can start (a cycle), next / brief / done say so and name what each waits on — never 'all done'; next --waves shows no wave and the cycle; doctor fails task-deps (exit 1) (got " +
    JSON.stringify([bn.out, bd.out.split("\n").find((l) => /task-deps/.test(l)), ld.out]) + ")");

  // append-tasks --depends (repeatable, #n accepted); a number naming no task is refused (exit 1, nothing written); --depends needs a value.
  const ap = mk("append");
  put(ap, "# Tasks\n\n## Build\n- [ ] 1. Writer\n**Checkpoint:** built\n");
  const a1 = run(["append-tasks", ap.slug, "--task", "Reader", "--depends", "#1", "--project", ap.p]);
  const a2 = run(["append-tasks", ap.slug, "--task", "Glue", "--depends", "1", "--depends", "2", "--project", ap.p]);
  const aBad = run(["append-tasks", ap.slug, "--task", "Nope", "--depends", "7", "--project", ap.p]);
  const aMiss = run(["append-tasks", ap.slug, "--task", "Nope", "--depends", "--project", ap.p]);
  ok(a1.code === 0 && a2.code === 0 && /- \[ \] 2\. Reader\n {2}- _Depends: 1_\n- \[ \] 3\. Glue\n {2}- _Depends: 1, 2_\n/.test(tasksOf(ap)) &&
    aBad.code === 1 && /Task 1: depends names no task: #7 — .*\(numbered 4 here\)\. Nothing was written\./.test(aBad.out) &&
    aMiss.code === 1 && /missing value for --depends/.test(aMiss.out) && !/Nope/.test(tasksOf(ap)),
    "feature F3: append-tasks --depends writes _Depends:_ (repeatable, #1 = 1); a number naming no task is refused with the number the task would get (exit 1, nothing written); --depends needs a value (got " +
    JSON.stringify([a1.out, a2.out, aBad.out, aMiss.out]) + ")");

  // Localized: the waves, the cycle and the blocked task in PT.
  const pt = mk("pt", "pt");
  put(pt, "# Tarefas\n\n- [ ] 1. Base\n- [ ] 2. Topo\n  - _Depends: 1_\n- [ ] 3. Laço\n  - _Depends: 3_\n");
  const pn = run(["next", pt.slug, "--waves", "--project", pt.p]);
  ok(pn.code === 0 && /^Próxima → #1 Base {2}\(faltam 3\/3\)\nOndas \(2\):\n {2}1\. #1\n {2}2\. #2\n {2}⚠ ciclo: #3\n {2}⚠ bloqueadas: #3 espera por #3\n$/.test(pn.out),
    "feature F3: next --waves in a PT feature — 'Ondas', the cycle and the blocked task in Portuguese (got " + JSON.stringify(pn.out) + ")");
}

// 1.14 feature (F5) — traceability matrix: if (inSection("ffrtm")) { … }
if (inSection("ffrtm")) {
  const SF5 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const f5 = path.join(tmp, "ffrtm-proj");
  // stdout alone (run() joins stderr): the CSV must be exactly the engine's text.
  const runOut = (args) => { const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: f5 } }); return { stdout: r.stdout || "", stderr: r.stderr || "", code: r.status }; };
  SF5.initProject(f5, ["tdd"], "en");
  const cf = SF5.createFeature(f5, "Checkout", ["tdd"], "", undefined, "en");
  fs.writeFileSync(path.join(cf.dir, "requirements.md"), "# Feature: Checkout\n\n### US-1 (P1): Pay\n#### Acceptance Criteria (EARS)\n" +
    '1. **US-1.AC-1** — WHEN the shopper pays THE SYSTEM SHALL charge "the total", in cents\n2. **US-1.AC-2** — IF the card is declined THEN THE SYSTEM SHALL keep the cart\n' +
    "3. **US-1.AC-3** — =cmd|' /C calc'!A0 THE SYSTEM SHALL log it\n");
  fs.writeFileSync(path.join(cf.dir, "test-plan.md"), "# Test Plan\n\n| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---|---|---|---|---|---|\n" +
    "| T-01 | unit | example | charge | US-1.AC-1 | `test/charge.test.js` |\n| T-02 | unit | example | decline | US-1.AC-2 | `test/decline.test.js` |\n| T-03 | unit | example | log | US-1.AC-3 | `test/log.test.js` |\n");
  fs.writeFileSync(path.join(cf.dir, "tasks.md"), '# Tasks\n\n- [ ] 1. [US1] Charge\n  - _Requirements: US-1.AC-1_\n  - _Makes green: T-01_\n  - _Verify: node -e "process.exit(0)"_\n' +
    "- [ ] 2. [US1] Decline\n  - _Requirements: US-1.AC-2_\n");
  fs.mkdirSync(path.join(f5, "test"), { recursive: true });
  fs.writeFileSync(path.join(f5, "test", "charge.test.js"), "test('T-01 charges', () => {});\n");
  SF5.completeTask(f5, "checkout", 1, { command: 'node -e "process.exit(0)"', exitCode: 0, summary: "1 passing" });
  SF5.decide(f5, "checkout", { title: "Stripe", decision: "Use Stripe.", affects: ["US-1.AC-1"] });

  const tm = run(["trace", "checkout", "--matrix", "--project", f5]);
  ok(tm.code === 1 && /^Traceability matrix — checkout \(core \+tdd\): 3 requirement\(s\) · 1 verified · 0 implemented · 1 planned · 1 untraced\n {2}requirements not approved yet\n/.test(tm.out) &&
    /\n {2}ID +Status +Tasks +Tests +Decisions +Requirement\n/.test(tm.out) && /\n {2}US-1\.AC-1 +verified +#1✓ +T-01 +D-1 +WHEN the shopper pays THE SYSTEM SHALL charge "the total", in cents\n/.test(tm.out) &&
    /\n {2}US-1\.AC-2 +planned +#2○ +T-02 +— +IF the card is declined/.test(tm.out) && /\n {2}US-1\.AC-3 +untraced +— +T-03 +— +\[no task cites it\] =cmd/.test(tm.out) &&
    /\n {2}tasks: ✓ verified · ▲ done, not verified · ○ open\nTrace: checkout {2}verdict=gaps-found/.test(tm.out),
    "feature F5: trace --matrix prints the matrix (localized headers, one row per requirement: status, tasks ✓/▲/○, tests, decisions, gaps before the text), then the usual trace lines; the exit code stays the trace verdict's (got " + JSON.stringify(tm.out.slice(0, 700)) + ")");
  const tc = runOut(["trace", "checkout", "--csv", "--project", f5]);
  const engineCsv = SF5.matrixCsv([SF5.traceMatrix(f5, "checkout")], "en");
  ok(tc.code === 1 && tc.stdout === engineCsv && tc.stdout.charCodeAt(0) !== 0xfeff && /^Feature,ID,Kind,Requirement,Status,/.test(tc.stdout) && !/AUTO-GENERATED/.test(tc.stdout) &&
    tc.stdout.includes("\r\ncheckout,US-1.AC-1,AC,\"WHEN the shopper pays THE SYSTEM SHALL charge \"\"the total\"\", in cents\",verified,") &&
    tc.stdout.includes("\r\ncheckout,US-1.AC-3,AC,'=cmd|' /C calc'!A0 THE SYSTEM SHALL log it,untraced,no task cites it,"),
    "feature F5: trace --csv prints the engine's CSV on stdout alone — RFC 4180, CRLF, a quoted field's quotes doubled, a leading '=' neutralized ('=cmd|… stays text); no BOM and no marker record (data for scripts); exit code = the trace verdict (got " + JSON.stringify(tc.stdout.slice(0, 300)) + ")");
  const tcc = runOut(["trace", "checkout", "--csv", "--code", "--project", f5]);
  let tj = null;
  try { tj = JSON.parse(run(["trace", "checkout", "--matrix", "--json", "--project", f5]).out); } catch { /* invalid JSON */ }
  const tcsvJson = run(["trace", "checkout", "--csv", "--json", "--project", f5]);
  ok(/,Test files,/.test(tcc.stdout.split("\r\n")[0]) && tcc.stdout.includes(",T-01,T-01: test/charge.test.js,") && tcc.stdout.includes(",T-02,T-02: in no test file,") &&
    tj && tj.matrix && JSON.stringify(tj.matrix.rows) === JSON.stringify(SF5.traceCheck(f5, "checkout", { matrix: true }).matrix.rows) && tj.matrix.counts.untraced === 1 &&
    /"matrix": \{/.test(tcsvJson.out) && !/^Feature,/.test(tcsvJson.out),
    "feature F5: trace --csv --code adds the Test files column; --json prints trace_check {matrix: true}'s result (= MCP), --json wins over --csv");
  const off = run(["trace", "checkout", "--matrix=false", "--csv=false", "--project", f5]);
  const typo = run(["trace", "checkout", "--matrx", "--project", f5]);
  ok(off.code === 1 && /^Trace: checkout/.test(off.out) && !/Traceability matrix/.test(off.out) && typo.code === 1 && /--matrx/.test(typo.out) && /--matrix/.test(typo.out) &&
    /usage: dev-spec trace <feature> \[--code\] \[--matrix\] \[--csv\]/.test(run(["trace", "--project", f5]).out),
    "feature F5: --matrix / --csv are boolean switches (=false turns them off), an unknown --matrx is refused with a did-you-mean, the usage names both");

  // export --csv: the document (BOM + the marker record); --write → .specs/exports/<slug>.rtm.csv, never over a hand-written file.
  const ec = runOut(["export", "checkout", "--csv", "--project", f5]);
  const ew = run(["export", "checkout", "--csv", "--write", "--project", f5]);
  const ewFile = path.join(f5, ".specs", "exports", "checkout.rtm.csv");
  const ewText = fs.existsSync(ewFile) ? fs.readFileSync(ewFile, "utf8") : "";
  const ep = run(["export", "--csv", "--write", "--project", f5]);
  ok(ec.code === 0 && ec.stdout === SF5.exportSpecs(f5, { name: "checkout", format: "csv" }).content && ec.stdout.charCodeAt(0) === 0xfeff && ec.stdout.slice(1).startsWith(engineCsv) &&
    /\r\n# AUTO-GENERATED by dev-spec — do not edit by hand\. Regenerate: dev-spec export --csv \(spec_export format csv\)\.,{16}\r\n$/.test(ec.stdout) &&
    ew.code === 0 && ew.out.includes("✎ wrote " + ewFile) && ewText === ec.stdout && ep.code === 0 && fs.existsSync(path.join(f5, ".specs", "exports", "project.rtm.csv")),
    "feature F5: export <f> --csv prints the CSV document (UTF-8 BOM, the AUTO-GENERATED marker as the last record); --write → .specs/exports/checkout.rtm.csv; no feature → project.rtm.csv (got " + JSON.stringify(ec.stdout.slice(-200)) + ")");
  fs.writeFileSync(ewFile, "ID,Owner\r\n");
  const eh = run(["export", "checkout", "--csv", "--write", "--project", f5]);
  const both = run(["export", "checkout", "--csv", "--md", "--project", f5]);
  ok(eh.code === 1 && /\.specs\/exports\/checkout\.rtm\.csv exists and was not generated by dev-spec/.test(eh.out) && fs.readFileSync(ewFile, "utf8") === "ID,Owner\r\n" &&
    both.code === 1 && /usage: dev-spec export \[feature\] \[--md\|--csv\|--gherkin\|--tracker jira\|linear\] \[--write\]/.test(both.out),
    "feature F5: export --csv --write never overwrites a hand-written .rtm.csv (exit 1, file unchanged); --csv with --md is a usage error");

  // Localized (PT feature), and the docs.
  const pf5 = SF5.createFeature(f5, "Pagamento", ["core"], "Pagar.", undefined, "pt");
  fs.writeFileSync(path.join(pf5.dir, "requirements.md"), "# Feature: Pagamento\n\n### US-1 (P1): Pagar\n1. **US-1.AC-1** — QUANDO o cliente paga O SISTEMA DEVE cobrar o total\n");
  fs.writeFileSync(path.join(pf5.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Cobrar\n  - _Requirements: US-1.AC-1_\n");
  const ptm = run(["trace", "pagamento", "--matrix", "--project", f5]);
  const ptc = runOut(["trace", "pagamento", "--csv", "--project", f5]);
  const doc = fs.readFileSync(CLI, "utf8").split("*/")[0];
  const help = run(["help"]).out;
  ok(/^Matriz de rastreabilidade — pagamento \(core\): 1 requisito\(s\) · 0 verificado\(s\) · 0 implementado\(s\) · 1 planeado\(s\) · 0 sem rastreio\n {2}requisitos ainda não aprovados\n/.test(ptm.out) &&
    /\n {2}ID +Estado +Tasks +Testes +Decisões +Requisito\n {2}US-1\.AC-1 +planeado +#1○ /.test(ptm.out) && /tasks: ✓ verificada · ▲ feita, não verificada · ○ por fazer/.test(ptm.out) &&
    /^Feature,ID,Tipo,Requisito,Estado,Lacunas,/.test(ptc.stdout) && ptc.stdout.includes("\r\npagamento,US-1.AC-1,AC,QUANDO o cliente paga O SISTEMA DEVE cobrar o total,planeado,,,,#1 por fazer,") &&
    /trace <feature> \[--code\]/.test(doc) && /\[--matrix\]/.test(doc) && /\[--csv\] the traceability matrix as CSV/.test(doc) && /--matrix: \+ the requirements traceability matrix/.test(help) &&
    /--csv: the matrix as RFC 4180 CSV on stdout/.test(help) && /\.rtm\.csv/.test(help),
    "feature F5: a PT feature's matrix and CSV speak Portuguese (headers, statuses, task words; IDs English); the docblock and help document --matrix / --csv and the .rtm.csv export");
}

// 1.15 feature (F4) — project-defined tracks: `dev-spec tracks [list|init <name>|check]` and a pack used by classify / create /
// status / doctor / add-track, as spec_tracks and the MCP tools do.
if (inSection("fftracks")) {
  const f4 = path.join(tmp, "f4-tracks");
  const js = (x) => JSON.stringify(x);
  const r = (args) => run([...args, "--project", f4]);
  run(["init", "--lang", "en", "--project", f4]);
  const i1 = r(["tracks", "init", "a11y"]);
  const i2 = r(["tracks", "init", "a11y"]);
  const iBad = r(["tracks", "init", "sec"]);
  const iNo = r(["tracks", "init"]);
  const pdir = path.join(f4, ".specs", "tracks", "a11y");
  ok(i1.code === 0 && /Track pack \+a11y scaffolded \(6 file\(s\)\)/.test(i1.out) && /\+ \.specs\/tracks\/a11y\/track\.json/.test(i1.out) && fs.existsSync(path.join(pdir, "steering.md")) &&
    i2.code === 0 && /Nothing written — every file of the \+a11y pack is already there/.test(i2.out) && iBad.code === 1 && /'sec' is reserved/.test(iBad.out) &&
    iNo.code === 1 && /tracks init needs a name/.test(iNo.out),
    "feature F4: tracks init scaffolds the pack's 6 files (never overwrites; a reserved or missing name exits 1) (got " + js(i1.out.slice(0, 200)) + ")");
  // The team's real pack: signals, sections, fragments.
  fs.writeFileSync(path.join(pdir, "track.json"), JSON.stringify({ name: "a11y", marker: "A11Y", title: { en: "Accessibility", pt: "Acessibilidade" },
    signals: { strong: ["screen reader", "accessibility"], weak: ["keyboard"] }, sections: [{ name: "Keyboard Navigation" }, { name: "Screen Reader Support", guidance: "Landmarks and labels." }],
    steering: "a11y.md" }, null, 2));
  fs.writeFileSync(path.join(pdir, "requirements.md"), "- WHEN a user tabs through the page THE SYSTEM SHALL show a visible focus ring on every control\n");
  fs.writeFileSync(path.join(pdir, "tasks.md"), "- [ ] Focus ring on every control\n  - _Requirements: {{ac1}}_\n");
  fs.rmSync(path.join(pdir, "test-plan.md")); // the example's rows cite {{ac2}} — with one criterion left, check would refuse the pack
  const ls = r(["tracks"]);
  const ck = r(["tracks", "check"]);
  let ckJ = {};
  try { ckJ = JSON.parse(r(["tracks", "check", "--json"]).out); } catch { /* stays {} */ }
  ok(ls.code === 0 && /^Tracks — 6 built-in, 1 project pack\(s\) in \.specs\/tracks\/ \(1 valid\):/.test(ls.out) && /  ✎ a11y +\[A11Y\]  Accessibility — 2 section\(s\) · 3 signal\(s\) · steering\/a11y\.md/.test(ls.out) &&
    /  · sec +\[SEC\]  5 section\(s\)/.test(ls.out) && ck.code === 0 && /1 track pack\(s\) checked — 1 valid, 0 error\(s\), 0 warning\(s\)\./.test(ck.out) && ckJ.ok === true && ckJ.verdict === "pass",
    "feature F4: tracks (list) shows the built-in tracks and the pack; tracks check passes (exit 0; --json = spec_tracks' result) (got " + js(ls.out.slice(0, 400)) + ")");
  // classify / create / status / doctor with the pack.
  const cl = r(["classify", "A settings page that works with a screen reader"]);
  const cr = r(["create", "Settings", "a11y", "--summary", "Settings page"]);
  const st = r(["status", "settings"]);
  const dr = r(["doctor", "settings"]);
  const reqf = path.join(f4, ".specs", "settings", "requirements.md");
  const req = fs.existsSync(reqf) ? fs.readFileSync(reqf, "utf8") : "";
  ok(/core \+a11y/.test(cl.out) && /a11y=medium/.test(cl.out) && /\+a11y: ON/.test(cl.out) && cr.code === 0 && /#### \[A11Y\] Accessibility — Acceptance Criteria \(EARS\)\n5\. \*\*US-1\.AC-5\*\* — WHEN a user tabs through the page/.test(req) &&
    /\[A11Y\] sections: ◐ Keyboard Navigation \(unfilled\) · ◐ Screen Reader Support \(unfilled\)/.test(st.out) && dr.code === 1 && /a11y-sections/.test(dr.out) &&
    fs.existsSync(path.join(f4, ".specs", "steering", "a11y.md")),
    "feature F4: classify picks +a11y from the pack's signals; create a11y scaffolds its criteria and steering; status shows the [A11Y] sections; doctor fails a11y-sections (exit 1) (got " + js(cl.out.slice(0, 200)) + " / " + js(st.out.slice(0, 300)) + ")");
  // add-track / --remove on another feature; a bad pack → check exits 1 and the pack is ignored (an unknown track).
  r(["create", "Profile", "core", "--summary", "Profile"]);
  const at = r(["add-track", "profile", "a11y"]);
  const rm = r(["add-track", "profile", "a11y", "--remove"]);
  fs.mkdirSync(path.join(f4, ".specs", "tracks", "broken"), { recursive: true });
  fs.writeFileSync(path.join(f4, ".specs", "tracks", "broken", "track.json"), JSON.stringify({ name: "broken", marker: "PRIVACY", title: { en: "Broken" }, sections: [{ name: "Scope" }] }));
  const ck2 = r(["tracks", "check"]);
  const cr2 = r(["create", "Other", "broken"]);
  ok(at.code === 0 && /\+a11y/.test(at.out) && /design\.md \(\+sections\)/.test(at.out) && rm.code === 0 && /\[A11Y\]/.test(rm.out) &&
    ck2.code === 1 && /✗ \.specs\/tracks\/broken\/track\.json — marker \[PRIVACY\] is taken by dev-spec/.test(ck2.out) && cr2.code === 1 && /Unknown track/.test(cr2.out),
    "feature F4: add-track a11y / --remove; a pack with a built-in marker → tracks check exits 1 naming it, and the pack is no track (got " + js(ck2.out.slice(0, 300)) + ")");
  // A deleted pack: status names it, doctor warns track-pack-missing — never a crash.
  fs.rmSync(pdir, { recursive: true, force: true });
  const st2 = r(["status", "settings"]);
  const dr2 = r(["doctor", "settings", "--json"]);
  let d2 = null;
  try { d2 = JSON.parse(dr2.out); } catch { /* stays null */ }
  ok(st2.code === 0 && /track pack\(s\) not available: \+a11y/.test(st2.out) && d2 && d2.checks.some((c) => c.id === "track-pack-missing" && c.status === "warn") && !d2.checks.some((c) => c.id === "a11y-sections"),
    "feature F4: a deleted pack — status names it, doctor warns track-pack-missing and requires none of its sections");
  // Localized: tracks init --lang pt writes Portuguese comments and speaks Portuguese; the help documents the command.
  const ip = r(["tracks", "init", "mobile", "--lang", "pt"]);
  const help = run(["help"]).out;
  const doc = fs.readFileSync(CLI, "utf8").split("*/")[0];
  const mj = path.join(f4, ".specs", "tracks", "mobile", "track.json");
  ok(ip.code === 0 && /Track pack \+mobile criado/.test(ip.out) && fs.existsSync(mj) && /um track definido pelo projeto/.test(fs.readFileSync(mj, "utf8")) &&
    /tracks \[list\|init <name>\|check\]/.test(help) && /tracks \[list\|init <name>\|check\]/.test(doc) && r(["tracks", "bogus"]).code === 1,
    "feature F4: tracks init --lang pt (Portuguese files and messages); help and the docblock document `tracks`; an unknown action exits 1");
}

// 1.16 package (U): if (inSection("p16u")) { … }
if (inSection("p16u")) {
  const SU = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = (x) => JSON.stringify(x);
  const RUN = 'node -e "process.exit(0)"';
  // stdout only (a --json result is the one document there), optional stdin
  const runJ = (args, input) => {
    const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", input, env: { ...process.env, SPEC_PROJECT_DIR: tmp } });
    let j = null;
    try { j = JSON.parse(r.stdout); } catch { /* stays null */ }
    return { j, out: r.stdout || "", err: r.stderr || "", code: r.status };
  };
  const mk = (name, lang) => {
    const p = path.join(tmp, "p16u-" + name);
    run(["init", "core", ...(lang ? ["--lang", lang] : []), "--project", p]);
    run(["create", "Login", "core", "--project", p]);
    fs.writeFileSync(path.join(p, ".specs", "login", "tasks.md"), "- [ ] 1. first\n  - _Verify: " + RUN + "_\n- [ ] 2. second\n");
    return p;
  };
  const stOf = (p) => JSON.parse(fs.readFileSync(path.join(p, ".specs", "login", ".state.json"), "utf8"));
  const omit = (o, k) => { const c = { ...(o || {}) }; delete c[k]; return c; };

  // U1 — `dev-spec undone <feature> <n> [--reason "…"]` = spec_complete_task {undo: true, reason}.
  const pe = mk("en");
  run(["done", "login", "1", "--run", "--project", pe]);
  const u1 = run(["undone", "login", "1", "--reason", "wrong task", "--project", pe]);
  const u2 = run(["undone", "login", "1", "--project", pe]);
  const u3 = run(["undone", "login", "7", "--project", pe]);
  const u4 = run(["undone", "login", "--project", pe]);
  const d5 = run(["done", "login", "2", "--reason", "x", "--project", pe]);
  const st1 = stOf(pe);
  ok(u1.code === 0 && /^Task 1 unticked\. 0\/2  next → #1 first\n  ⚠ Task 1 is open again \(unticked\)\. Its recorded evidence no longer counts/.test(u1.out) &&
    u2.code === 0 && /^Task 1 was not ticked\. 0\/2  next → #1 first\n  Task 1 is not ticked — nothing to undo\./.test(u2.out) &&
    u3.code === 1 && /Task 7 not found in tasks\.md/.test(u3.out) && u4.code === 1 && /dev-spec undone <feature> <task-number>/.test(u4.out) &&
    d5.code === 1 && /reason goes with undo/.test(d5.out) && st1.unticks.length === 1 && st1.unticks[0].reason === "wrong task" && st1.evidence["1"].staleBy === "undo" &&
    !/- \[x\] 2\./.test(fs.readFileSync(path.join(pe, ".specs", "login", "tasks.md"), "utf8")),
    "1.16 U1: `undone` unticks (exit 0, the note in the feature's language), an open task is a no-op with a note, an unknown task / a missing number exit 1, and `done --reason` is refused as spec_complete_task {reason} is (got " +
    js([u1.out, u2.out, u3.out.trim(), d5.out.trim()]) + ")");
  // MCP ↔ CLI parity: the same engine call — `undone --json` prints spec_complete_task {undo}'s result.
  const pa = mk("par-a"), pb = mk("par-b");
  [pa, pb].forEach((p) => run(["done", "login", "1", "--run", "--project", p]));
  const cj = runJ(["undone", "login", "1", "--reason", "r", "--json", "--project", pa]);
  const ej = SU.completeTask(pb, "login", 1, undefined, { undo: true, reason: "r" });
  const cjErr = runJ(["undone", "login", "9", "--json", "--project", pa]);
  ok(cj.code === 0 && cj.j && js(cj.j) === js(ej) && cjErr.code === 1 && cjErr.j && cjErr.j.ok === false && js(cjErr.j) === js(SU.completeTask(pb, "login", 9, undefined, { undo: true })),
    "1.16 U1: `undone --json` prints exactly spec_complete_task {undo, reason}'s result — a refusal too ({ok: false, error}, exit 1) (got " + js([cj.j, ej]) + ")");
  // PT output.
  const pp = mk("pt", "pt");
  run(["done", "login", "1", "--run", "--project", pp]);
  const up = run(["undone", "login", "1", "--project", pp]);
  ok(up.code === 0 && /^Tarefa 1 desmarcada\. 0\/2  próxima → #1 first\n  ⚠ A tarefa 1 voltou a ficar aberta \(desmarcada\)\./.test(up.out),
    "1.16 U1: `undone` speaks the feature's language (PT) (got " + js(up.out) + ")");

  // U2 / U3 — approve --revoke [--reason] · approve --force --reason "…" --expires 30d.
  const r1 = run(["approve", "login", "requirements", "--force", "--reason", "demo day", "--expires", "30d", "--project", pe]);
  const r2 = run(["approve", "login", "design", "--reason", "x", "--project", pe]);
  const r3 = run(["approve", "login", "design", "--force", "--expires", "yesterday", "--project", pe]);
  const r4 = run(["approve", "login", "requirements", "--revoke", "--reason", "scope changed", "--project", pe]);
  const r5 = run(["approve", "login", "requirements", "--revoke", "--project", pe]);
  const r6 = run(["approve", "login", "requirements", "--revok", "--project", pe]);
  const r7 = run(["approve", "login", "requirements", "--revoke", "--force", "--project", pe]);
  const hist = stOf(pe).approvalHistory;
  ok(r1.code === 0 && /Waiver recorded: demo day \(expires \d{4}-\d{2}-\d{2}\)\./.test(r1.out) && r2.code === 1 && /go with force/.test(r2.out) &&
    r3.code === 1 && /expires must be an ISO date/.test(r3.out) && r4.code === 0 && /^Revoked the approval of 'requirements' for login — the phase is pending again/.test(r4.out) &&
    r5.code === 1 && /nothing to revoke/.test(r5.out) && r6.code === 1 && /did you mean --revoke\?/.test(r6.out) && r7.code === 1 && /revoke takes no force/.test(r7.out) &&
    hist[hist.length - 1].revoked === true && hist[hist.length - 1].reason === "scope changed" && hist[hist.length - 2].waiver && hist[hist.length - 2].waiver.reason === "demo day",
    "1.16 U2/U3: `approve --force --reason --expires` records the waiver; `--reason` without --force, a bad --expires, `--revoke` of an unapproved phase or with --force exit 1; `--revoke --reason` revokes (history: revoked + reason); `--revok` suggests --revoke (got " +
    js([r1.out.trim(), r4.out.trim(), r6.out.trim()]) + ")");
  const qa = mk("rev-a"), qb = mk("rev-b");
  [qa, qb].forEach((p) => run(["approve", "login", "classification", "--force", "--project", p]));
  const cr = runJ(["approve", "login", "classification", "--revoke", "--reason", "oops", "--by", "ana", "--json", "--project", qa]);
  const er = SU.approvePhase(qb, "login", "classification", "ana", { revoke: true, reason: "oops" });
  const cw = runJ(["approve", "login", "classification", "--force", "--reason", "demo", "--expires", "5d", "--json", "--project", qa]);
  const ew = SU.approvePhase(qb, "login", "classification", undefined, { force: true, reason: "demo", expires: "5d" });
  ok(cr.code === 0 && cr.j && js(omit(cr.j, "approvals")) === js(omit(er, "approvals")) && js(Object.keys(cr.j.approvals)) === js(Object.keys(er.approvals)) &&
    cw.code === 0 && cw.j && js(cw.j.waiver) === js(ew.waiver) && cw.j.note === ew.note && js(cw.j.failing) === js(ew.failing),
    "1.16 U2/U3: `approve --revoke --json` and `approve --force --reason --expires --json` print spec_approve {revoke} / {force, reason, expires}'s results (MCP ↔ CLI parity) (got " +
    js([cr.j && cr.j.message, cw.j && cw.j.waiver]) + ")");
  // ES wording of a CLI refusal; the help and the header docblock document the new command and flags.
  const ps = mk("es", "es");
  const rs = run(["approve", "login", "design", "--force", "--expires", "pronto", "--project", ps]);
  const help = run(["help"]).out;
  const doc = fs.readFileSync(CLI, "utf8").split("*/")[0];
  ok(rs.code === 1 && /expires debe ser una fecha ISO/.test(rs.out) &&
    [/undone <feature> <n> \[--reason "…"\]/, /approve <feature> <phase> --revoke \[--reason "…"\]/, /--expires YYYY-MM-DD\|30d/].every((re) => re.test(help) && re.test(doc)) &&
    SU.CLI_SWITCHES.has("revoke") && !SU.CLI_SWITCHES.has("reason") && !SU.CLI_SWITCHES.has("expires"),
    "1.16 U: an ES refusal is Spanish; help and the header docblock document undone / --revoke / --reason / --expires; --revoke is in spec.CLI_SWITCHES, --reason / --expires take a value (got " + js(rs.out.trim()) + ")");

  // The approval guard (deny): an agent's `approve … --revoke` is refused, and the command handed to the human revokes as is.
  const pd = path.join(tmp, "p16u-deny");
  run(["init", "core", "--approval-guard", "deny", "--project", pd]);
  run(["create", "Checkout", "core", "--project", pd]);
  run(["approve", "checkout", "classification", "--force", "--project", pd]); // the human's own CLI run is never gated
  const hook = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "approval-hook.js")], { encoding: "utf8",
    input: JSON.stringify({ hook_event_name: "PreToolUse", cwd: pd, tool_name: "Bash", tool_input: { command: 'node "' + CLI + '" approve checkout classification --revoke --reason "wrong one"' } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" } });
  let h = {};
  try { h = JSON.parse(hook.stdout); } catch { /* checked below */ }
  const suggested = ((h.systemMessage || "").match(/: (! node .*)$/) || [])[1] || "";
  const human = spawnSync(suggested.replace(/^! node /, JSON.stringify(process.execPath) + " "), { shell: true, encoding: "utf8", cwd: pd, env: { ...process.env, SPEC_PROJECT_DIR: pd, CLAUDE_PROJECT_DIR: "" } });
  const std = JSON.parse(fs.readFileSync(path.join(pd, ".specs", "checkout", ".state.json"), "utf8"));
  ok(hook.status === 0 && (h.hookSpecificOutput || {}).permissionDecision === "deny" && /revoke the approval of the classification phase of 'checkout'/.test((h.hookSpecificOutput || {}).permissionDecisionReason || "") &&
    /approve checkout classification --revoke --reason "wrong one"$/.test(suggested) && human.status === 0 && !std.approvals.classification &&
    std.approvalHistory[std.approvalHistory.length - 1].reason === "wrong one",
    "1.16 U2: the approval hook (deny) refuses an agent's `dev-spec approve … --revoke` and hands the human an `approve … --revoke --reason` line that revokes as is (got " +
    js([suggested, (human.stdout + human.stderr).trim().slice(0, 160)]) + ")");

  // U4 — `log <f> - --max N`: the piped log with its window, = spec_log {gitLog, max}.
  const pl = mk("log");
  const log = ["commit aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "Author: Ana <a@x.io>", "Date:   2026-09-20T10:00:00+00:00", "", "    feat(login): first", "", "    Part of .specs/login/ task #1.", "", "src/a.js", "",
    "commit bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "Author: Ana <a@x.io>", "Date:   2026-09-19T10:00:00+00:00", "", "    chore: tooling", "", "package.json", ""].join("\n");
  const l1 = runJ(["log", "login", "-", "--max", "2", "--json", "--project", pl], log);
  const l2 = runJ(["log", "login", "-", "--json", "--project", pl], log);
  const l3 = run(["log", "login", "-", "--max", "0", "--project", pl]);
  ok(l1.code === 0 && l1.j && l1.j.truncated === true && js(l1.j) === js(SU.taskCommits(pl, "login", log, { max: 2 })) && l2.j && l2.j.truncated === false &&
    js(l2.j) === js(SU.taskCommits(pl, "login", log, {})) && l1.j.tasks[0].commits.length === 1 && l3.code === 1,
    "1.16 U4: `log <f> - --max N` passes the window of the piped log (a log that long reads truncated) — the same result as spec_log {gitLog, max}; --max 0 is refused (got " +
    js([l1.j && l1.j.truncated, l2.j && l2.j.truncated]) + ")");

  // 1.16 U review 5 — `undone` refuses done's evidence flags (it silently ignored them); --run=false is no run.
  const pv = mk("review-flags", "pt");
  run(["done", "login", "1", "--run", "--project", pv]);
  const tv = fs.readFileSync(path.join(pv, ".specs", "login", "tasks.md"), "utf8");
  const vf = [["--evidence", "ok"], ["--exit", "0"], ["--cmd", RUN], ["--run"], ["--run", "--shell", "bash"]].map((fl) => run(["undone", "login", "1", ...fl, "--project", pv]));
  const vj = runJ(["undone", "login", "1", "--cmd", RUN, "--exit", "0", "--json", "--project", pv]);
  const vUnchanged = fs.readFileSync(path.join(pv, ".specs", "login", "tasks.md"), "utf8") === tv && !stOf(pv).unticks;
  const vOff = run(["undone", "login", "1", "--run=false", "--project", pv]);
  ok(vf.every((r) => r.code === 1 && /undo não aceita evidência/.test(r.out)) && vj.code === 1 && vj.j && vj.j.ok === false && /undo não aceita evidência/.test(vj.j.error) &&
    vUnchanged && vOff.code === 0 && /^Tarefa 1 desmarcada\./.test(vOff.out),
    "1.16 U review 5: `undone` with --evidence / --exit / --cmd / --run exits 1 with the localized refusal (PT; --json: the refusal as spec_complete_task {undo, evidence} returns it) and changes nothing; --run=false is no run (got " +
    js([vf.map((r) => r.code + " " + r.out.trim().slice(0, 60)), vOff.out.trim().slice(0, 40)]) + ")");
  // 1.16 U review 2 — two ticked tasks share the number: `undone` exits 1 (duplicateTicked), nothing changed.
  const pw = mk("review-dup");
  fs.writeFileSync(path.join(pw, ".specs", "login", "tasks.md"), "- [ ] 1. Alpha\n  - _Verify: " + RUN + "_\n- [ ] 1. Beta\n- [ ] 2. second\n");
  run(["done", "login", "1", "--run", "--project", pw]);
  run(["done", "login", "1", "--project", pw]);
  const tw = fs.readFileSync(path.join(pw, ".specs", "login", "tasks.md"), "utf8");
  const dw = runJ(["undone", "login", "1", "--json", "--project", pw]);
  const dh = run(["undone", "login", "1", "--project", pw]);
  ok(dw.code === 1 && dw.j && dw.j.duplicateTicked === true && js(dw.j.tasks.map((t) => t.line)) === "[1,3]" && dh.code === 1 &&
    /Several ticked tasks share number 1 \(line 1: "Alpha", line 3: "Beta"\)/.test(dh.out) && fs.readFileSync(path.join(pw, ".specs", "login", "tasks.md"), "utf8") === tw,
    "1.16 U review 2: `undone` of a number two ticked tasks share exits 1 (--json: duplicateTicked + tasks with their lines) — tasks.md unchanged (got " + js([dw.j, dh.out.trim()]) + ")");
  // 1.16 U review 1 — an _Expect: fail_ task undone after its red run: the note says the red run is kept, and `done --run` (a pass
  // now) re-ticks it as the fix going green.
  const px = mk("review-red");
  fs.writeFileSync(path.join(px, ".specs", "login", "tasks.md"), "- [ ] 1. Write the test and watch it fail\n  - _Verify: " + RUN + "_\n  - _Expect: fail_\n- [ ] 2. second\n");
  const xr = run(["done", "login", "1", "--cmd", RUN, "--exit", "1", "--evidence", "not ok 1 - login", "--project", px]);
  const xu = run(["undone", "login", "1", "--project", px]);
  const xd = runJ(["done", "login", "1", "--run", "--json", "--project", px]);
  ok(xr.code === 0 && xu.code === 0 && /Its red run of \d{4}-\d\d-\d\d \(the _Expect: fail_ proof\) is kept/.test(xu.out) && !/no longer counts/.test(xu.out) &&
    xd.code === 0 && xd.j && xd.j.ok && xd.j.verified === true && xd.j.expected === "fail" && xd.j.observed === "cli",
    "1.16 U review 1: `undone` of an _Expect: fail_ task keeps its red run (the note says so), and `done --run` — whose run passes now — re-ticks it verified (got " +
    js([xu.out.trim(), xd.j]) + ")");
}

// 1.16 package (C): if (inSection("p16c")) { … }
if (inSection("p16c")) { // 1.16 package C — the status line, the user's DEV_SPEC_* defaults and the plan-mode bridge on the CLI
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
}

// 1.16 package (Q): if (inSection("p16q")) { … }
if (inSection("p16q")) {
  const SQ = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = (v) => JSON.stringify(v);
  const q = path.join(tmp, "p16q-proj");
  const r = (args) => run([...args, "--project", q]);
  const reqOf = (slug, body) => fs.writeFileSync(path.join(q, ".specs", slug, "requirements.md"), "# Feature: " + slug + "\n\n### US-1 (P1): Story\n#### Acceptance Criteria (EARS)\n" + body);
  const constitution = path.join(q, ".specs", "steering", "constitution.md");
  SQ.initProject(q, ["core"], "en");
  fs.writeFileSync(constitution, "# Constitution\n\n1. Every write is idempotent.\n");
  ["Alpha", "Beta"].forEach((n) => SQ.createFeature(q, n, ["core"], "x", undefined, "en"));
  reqOf("alpha", "1. **US-1.AC-1** — WHEN a login fails 5 times THE SYSTEM SHALL lock the account for 15 minutes\n2. **US-1.AC-2** — WHEN a client pays THE SYSTEM SHALL email the receipt\n");
  reqOf("beta", "1. **US-1.AC-1** — WHEN a login fails 3 times THE SYSTEM SHALL lock the account for 15 minutes\n");
  for (const f of ["alpha", "beta"]) for (const ph of ["classification", "requirements", "design"]) r(["approve", f, ph, "--force"]);

  // Q1 — steering amendments: impact --phase steering (no feature = every active one), doctor, next-action.
  fs.writeFileSync(constitution, "# Constitution\n\n1. Every write is idempotent.\n2. No PII in logs.\n");
  const all = r(["impact", "--phase", "steering"]);
  const one = r(["impact", "beta", "--phase", "steering", "--json"]);
  let oneJ = null;
  try { oneJ = JSON.parse(one.out); } catch { /* stays null */ }
  const noName = r(["impact"]);
  const reo = r(["impact", "alpha", "--phase", "steering", "--reopen"]);
  ok(all.code === 0 && /^Steering — 2 active feature\(s\) approved under an older version of steering that changed since\n {2}alpha — requirements \(approved \d{4}-\d\d-\d\d\): constitution\.md \(changed\); design/.test(all.out) &&
    /\n {2}beta — requirements/.test(all.out) && /\n {2}→ Re-review each against the amended steering, then re-approve \(\/approve alpha requirements\)/.test(all.out) &&
    one.code === 0 && oneJ && js(oneJ) === js(SQ.impactReport(q, "beta", { phase: "steering" })) && oneJ.scope === "feature" && oneJ.features[0].approvals.length === 2 &&
    noName.code === 1 && /usage: dev-spec impact <feature> .* · dev-spec impact \[feature\] --phase steering/.test(noName.out) &&
    reo.code === 1 && /reopen doesn't apply to phase 'steering'/.test(reo.out),
    "1.16 Q1 CLI: impact --phase steering lists every active feature approved under changed steering (exit 0); <f> --json = spec_impact's result; impact without a feature is a usage error, --reopen is refused (exit 1) (got " + js(all.out.slice(0, 300)) + ")");
  const doc = r(["doctor", "alpha"]);
  const na = r(["next-action", "alpha"]);
  ok(/\n {2}▲ steering-changed-since-approval — steering changed after approval — requirements \(approved \d{4}-\d\d-\d\d\): constitution\.md \(changed\)/.test(doc.out) &&
    /Also: steering changed after the approval of requirements, design \(constitution\.md\) — re-review against it and re-approve if it still holds \(dev-spec impact alpha --phase steering\)\./.test(na.out),
    "1.16 Q1 CLI: doctor prints the steering-changed-since-approval warning; next-action adds the re-review hint (got " + js(na.out.slice(0, 400)) + ")");

  // Q2 — cross-feature criteria: catalog section, doctor warning, --json = spec_catalog.
  const cat = r(["catalog"]);
  let catJ = null;
  try { catJ = JSON.parse(r(["catalog", "--json"]).out); } catch { /* stays null */ }
  const docB = r(["doctor", "beta"]);
  ok(/\n## ⚠ Possible duplicates \/ conflicts\n/.test(cat.out) && /- ⚡ alpha\/US-1\.AC-1 ↔ beta\/US-1\.AC-1 \(possible conflict: different numbers 5\/15 ↔ 3\/15, 100% alike\)/.test(cat.out) &&
    catJ && js(catJ.crossAcs) === js(SQ.catalog(q).crossAcs) && catJ.crossAcs.pairs.length === 1 &&
    /\n {2}▲ cross-feature-acs — 1 criterion pair\(s\) read like another active feature's or may contradict them — US-1\.AC-1 ↔ alpha\/US-1\.AC-1/.test(docB.out),
    "1.16 Q2 CLI: catalog prints the 'Possible duplicates / conflicts' section; --json carries crossAcs (= spec_catalog); doctor warns cross-feature-acs from the feature's side (got " + js(docB.out.match(/cross-feature-acs.*/) || "") + ")");

  // Q3 — glossary: steering glossary.md (EN / PT), clarify's questions, the brief's section, doctor's count.
  const sg = r(["steering", "glossary.md"]);
  const gfile = path.join(q, ".specs", "steering", "glossary.md");
  const stubOk = fs.existsSync(gfile) && /^# Glossary\n/.test(fs.readFileSync(gfile, "utf8"));
  fs.writeFileSync(gfile, "# Glossary\n\n- **Customer** — a person or company with a signed contract. _Avoid: client, user_\n");
  fs.writeFileSync(path.join(q, ".specs", "alpha", "tasks.md"), "# Tasks\n\n- [ ] 1. Charge the customer\n  - _Requirements: US-1.AC-2_\n");
  const cl = r(["clarify", "alpha"]);
  const br = r(["brief", "alpha", "1"]);
  const dg = r(["doctor", "alpha"]);
  const qp = path.join(tmp, "p16q-pt");
  SQ.initProject(qp, ["core"], "pt");
  const sgPt = run(["steering", "glossary.md", "--project", qp]);
  ok(sg.code === 0 && stubOk && /\d+\. requirements\.md:6: 'client' — the glossary says Customer \(a person or company with a signed contract\)\. Use "Customer"/.test(cl.out) &&
    /\n## Glossary \(terms this task uses\)\n.*\n- \*\*Customer\*\* — a person or company with a signed contract _\(avoid: client, user\)_\n/.test(br.out) &&
    /\n {2}▲ glossary — 1 use\(s\) of words the glossary says to avoid — 'client' → Customer \(requirements\.md:6\)/.test(dg.out) &&
    sgPt.code === 0 && /^# Glossário\n/.test(fs.readFileSync(path.join(qp, ".specs", "steering", "glossary.md"), "utf8")),
    "1.16 Q3 CLI: steering glossary.md writes the stub (PT with --project in a PT project); clarify asks about the avoided word with file:line; brief quotes the entry; doctor warns glossary (got " + js([cl.out.slice(-300), dg.out.match(/glossary —.*/)]) + ")");
  const help = run(["help"]).out;
  const doc0 = fs.readFileSync(CLI, "utf8").split("*/")[0];
  ok(/impact \[feature\] --phase steering/.test(help) && /impact \[feature\] --phase steering/.test(doc0) && /glossary\.md/.test(help) && /glossary\.md/.test(doc0),
    "1.16 Q CLI: help and the docblock document `impact [feature] --phase steering` and the glossary.md steering template");
  // 1.16 Q review 6: a glossary past 300 entries says so — clarify prints the note, --json carries glossaryTruncated.
  let big = "# Glossary\n\n- **Customer** — a person or company with a signed contract. _Avoid: client, user_\n";
  for (let i = 0; i < 304; i++) big += `- **Term${i}** — definition ${i}. _Avoid: zzword${i}_\n`;
  fs.writeFileSync(gfile, big);
  const clBig = r(["clarify", "alpha"]);
  let clBigJ = null;
  try { clBigJ = JSON.parse(r(["clarify", "alpha", "--json"]).out); } catch { /* stays null */ }
  ok(/\n {2}⚠ glossary\.md holds 305 entries — only the first 300 are read/.test(clBig.out) && /'client' — the glossary says Customer/.test(clBig.out) &&
    clBigJ && js(clBigJ.glossaryTruncated) === js({ read: 300, total: 305 }),
    "1.16 Q review 6 CLI: clarify prints the glossary-truncated note (the first 300 of 305 entries read) and --json carries glossaryTruncated (got " + js(clBig.out.slice(-240)) + ")");
}

// 1.16 package (E): if (inSection("p16e")) { … }

if (inSection("p16e")) {
  const SE = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = (v) => JSON.stringify(v);
  const ep = path.join(tmp, "p16e-proj");
  // stdout alone (run() joins stderr): an export must be exactly the engine's text.
  const runOut = (args) => { const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: ep } }); return { stdout: r.stdout || "", stderr: r.stderr || "", code: r.status }; };
  SE.initProject(ep, ["core"], "en");
  const cf = SE.createFeature(ep, "Checkout", ["tdd"], "", undefined, "en");
  fs.writeFileSync(path.join(cf.dir, "requirements.md"), "# Feature: Checkout\n\n## Summary\nPay in one step.\n\n## User Stories\n\n### US-1 (P1): Pay\n#### Acceptance Criteria (EARS)\n" +
    '1. **US-1.AC-1** — WHEN the shopper pays "now, please" THE SYSTEM SHALL charge the card, in cents\n2. **US-1.AC-2** — IF the card is declined THEN THE SYSTEM SHALL keep the cart\n');
  fs.writeFileSync(path.join(cf.dir, "test-plan.md"), "# Test Plan\n\n| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---|---|---|---|---|---|\n" +
    "| T-01 | unit | example | charge | US-1.AC-1 | `test/charge.test.js` |\n| T-02 | unit | example | decline | US-1.AC-2 | `test/decline.test.js` |\n");
  const day = (k) => new Date(Date.now() - k * 86400000).toISOString();
  fs.writeFileSync(path.join(cf.dir, "tasks.md"), "# Tasks\n\n- [x] 1. [US1] Charge _Requirements: US-1.AC-1_ _Size: S_\n- [x] 2. [US1] Decline _Requirements: US-1.AC-2_ _Size: S_\n" +
    "- [x] 3. [US1] Receipt _Requirements: US-1.AC-1_ _Size: S_\n- [ ] 4. [US1] Refund _Requirements: US-1.AC-2_ _Size: S_\n- [ ] 5. =SUM(A1) cleanup _Size: XS_\n");
  const sp = path.join(cf.dir, ".state.json");
  fs.writeFileSync(sp, JSON.stringify({ ...JSON.parse(fs.readFileSync(sp, "utf8")), ticks: { 1: day(3), 2: day(2), 3: day(1) } }, null, 2));
  SE.createFeature(ep, "Invoices", ["core"], "", undefined, "en");
  SE.createFeature(ep, "Gamma", ["core"], "", undefined, "en");

  // --- E1: --gherkin ---
  const g = runOut(["export", "checkout", "--gherkin", "--project", ep]);
  const gw = run(["export", "checkout", "--gherkin", "--write", "--project", ep]);
  const gFile = path.join(ep, ".specs", "exports", "checkout.feature");
  const gp = runOut(["export", "--gherkin", "--project", ep]);
  const gj = runOut(["export", "checkout", "--gherkin", "--json", "--project", ep]);
  let gjr = null;
  try { gjr = JSON.parse(gj.stdout); } catch { /* stays null */ }
  ok(g.code === 0 && g.stdout === SE.exportSpecs(ep, { name: "checkout", format: "gherkin" }).content && /^# language: en\n/.test(g.stdout) &&
    /\n  @US-1\.AC-1 @T-01\n  Scenario: US-1\.AC-1 — [^\n]*\n    When the shopper pays "now, please"\n    Then THE SYSTEM SHALL charge the card, in cents\n/.test(g.stdout) &&
    /\n    Given the card is declined\n    Then THE SYSTEM SHALL keep the cart\n/.test(g.stdout) &&
    gw.code === 0 && gw.out.includes("✎ wrote " + gFile) && fs.readFileSync(gFile, "utf8") === g.stdout &&
    gp.code === 0 && gp.stdout.startsWith("# ── .specs/exports/checkout.feature ──\n# language: en\n") && gp.stdout.includes("\n# ── .specs/exports/gamma.feature ──\n# language: en\n") &&
    gjr && gjr.format === "gherkin" && gjr.scenarios === 2 && gjr.content === g.stdout,
    "1.16 E1 (CLI): export <f> --gherkin prints the engine's .feature (EARS → Given / When / Then, tags); --write → .specs/exports/<f>.feature; no feature → each file printed under its path; --json = the MCP result (got " + js(g.stdout.slice(0, 400)) + ")");
  fs.writeFileSync(path.join(ep, ".specs", "exports", "invoices.feature"), "Feature: mine\n");
  const gph = run(["export", "--gherkin", "--write", "--project", ep]);
  const gammaAfterRefusal = fs.existsSync(path.join(ep, ".specs", "exports", "gamma.feature"));
  const handKept = fs.readFileSync(path.join(ep, ".specs", "exports", "invoices.feature"), "utf8") === "Feature: mine\n";
  fs.rmSync(path.join(ep, ".specs", "exports", "invoices.feature"));
  const gpw = run(["export", "--gherkin", "--write", "--project", ep]);
  ok(gph.code === 1 && /\.specs\/exports\/invoices\.feature exists and was not generated by dev-spec/.test(gph.out) && !gammaAfterRefusal && handKept &&
    gpw.code === 0 && /✎ wrote 3 \.feature file\(s\) — 2 scenario\(s\)/.test(gpw.out) && fs.existsSync(path.join(ep, ".specs", "exports", "gamma.feature")),
    "1.16 E1 (CLI): the project --gherkin --write is all-or-nothing — a hand-written .feature refuses it (exit 1, nothing written); then one file per feature (got " + js([gph.out.slice(0, 200), gpw.out.slice(-120)]) + ")");

  // --- E2: --tracker jira|linear ---
  const jr = runOut(["export", "checkout", "--tracker", "jira", "--project", ep]);
  const lr = runOut(["export", "--tracker=LINEAR", "--project", ep]);
  const lw = run(["export", "--tracker", "linear", "--write", "--project", ep]);
  const lFile = path.join(ep, ".specs", "exports", "project.linear.csv");
  const tBad = run(["export", "--tracker", "asana", "--project", ep]);
  const tBoth = run(["export", "--tracker", "jira", "--gherkin", "--project", ep]);
  const tNone = run(["export", "--tracker", "--project", ep]);
  const jHead = (jr.stdout.split("\r\n")[0] || "").replace(String.fromCharCode(0xfeff), "");
  ok(jr.code === 0 && jr.stdout === SE.exportSpecs(ep, { name: "checkout", format: "jira" }).content && jr.stdout.charCodeAt(0) === 0xfeff &&
    jHead.startsWith("Work item ID,Work type,Summary,Description,Status,Parent,Labels,Labels,") && /,"# AUTO-GENERATED by dev-spec[^\r\n]*"$/.test(jHead) &&
    /\r\n1,Epic,Checkout,"Pay in one step\./.test(jr.stdout) && /\r\n\d+,Task,#5 =SUM\(A1\) cleanup,"'=SUM\(A1\) cleanup _Size: XS_/.test(jr.stdout) &&
    lr.code === 0 && lr.stdout === SE.exportSpecs(ep, { format: "linear" }).content && /\r\ncheckout\/#1,#1 Charge,[\s\S]*?,Done,2,"checkout, tdd, US-1\.AC-1",checkout\/US-1,\r\n/.test(lr.stdout) &&
    lw.code === 0 && /✎ wrote [^\n]*project\.linear\.csv — \d+ work item\(s\)/.test(lw.out) && fs.readFileSync(lFile, "utf8") === lr.stdout &&
    tBad.code === 1 && /--tracker must be one of: jira, linear \(got "asana"\)/.test(tBad.out) && tBoth.code === 1 && /usage: dev-spec export/.test(tBoth.out) && tNone.code === 1,
    "1.16 E2 (CLI): export --tracker jira|linear prints the engine's CSV (BOM, the importer's columns, the marker as the last header cell, a leading = neutralized); --write → .specs/exports/project.linear.csv; an unknown tracker / two formats / no value → exit 1 (got " + js([jHead.slice(0, 120), tBad.out, tNone.out]) + ")");

  // --- E3: milestone add / list / rm, the roadmap, changelog --milestone ---
  const m1 = run(["milestone", "add", "Far away", "2099-12-31", "checkout", "invoices", "--project", ep]);
  const m2 = run(["milestone", "add", "Past", "2020-01-01", "checkout,invoices", "--project", ep]);
  const m3 = run(["milestone", "add", "Gam", "2099-12-31", "gamma", "--project", ep]);
  const ml = run(["milestone", "--project", ep]);
  const mjs = runOut(["milestone", "list", "--json", "--project", ep]);
  let mj = null;
  try { mj = JSON.parse(mjs.stdout); } catch { /* stays null */ }
  const eng = SE.milestone(ep, "list");
  ok(m1.code === 0 && /^Milestone 'Far away' added — 2099-12-31: checkout, invoices\n/.test(m1.out) && m2.code === 0 && m3.code === 0 &&
    /\n  ⛔ Past — 2020-01-01 · 0\/2 feature\(s\) done · ETA — · late · checkout, invoices\n/.test(ml.out) &&
    /\n  ⚠ Far away — 2099-12-31 · 0\/2 feature\(s\) done · ETA — · at risk · checkout, invoices\n/.test(ml.out) &&
    mj && (mj.today !== eng.today || js(mj.milestones) === js(eng.milestones)) && js(mj.milestones.map((m) => [m.status, m.reason || null])) === js([["at-risk", "eta-unknown"], ["late", null], ["at-risk", "eta-unknown"]]),
    "1.16 E3 (CLI): milestone add <name> <date> <features…> (comma-separated too) → lines; milestone / milestone list print each status; --json = the engine's (spec_milestone) result (got " + js(ml.out) + ")");
  const bad = [run(["milestone", "add", "X", "2026-13-01", "checkout", "--project", ep]), run(["milestone", "add", "X", "2026-10-01", "--project", ep]),
    run(["milestone", "add", "X", "2026-10-01", "nope", "--project", ep]), run(["milestone", "rm", "nothere", "--project", ep]), run(["milestone", "rm", "--project", ep]),
    run(["milestone", "bogus", "--project", ep])];
  const mrm = run(["milestone", "rm", "far away", "--project", ep]);
  ok(bad.every((r) => r.code === 1) && /is not a day in YYYY-MM-DD/.test(bad[0].out) && /at least one feature/.test(bad[1].out) && /not found: nope/.test(bad[2].out) &&
    /No milestone 'nothere'/.test(bad[3].out) && /usage: dev-spec milestone/.test(bad[4].out) && /action must be one of: add, rm, remove, list/.test(bad[5].out) &&
    mrm.code === 0 && /^Milestone 'Far away' removed\.\n/.test(mrm.out) && SE.readRoadmap(ep).meta.milestones.length === 2,
    "1.16 E3 (CLI): a bad date, no feature, an unknown feature / milestone, a missing name and an unknown action exit 1; rm matches the name by its slug (got " + js(bad.map((r) => r.out.trim())) + ")");
  const rd = run(["roadmap", "--write", "--project", ep]);
  const rmd = fs.readFileSync(path.join(ep, ".specs", "ROADMAP.md"), "utf8");
  ok(rd.code === 0 && /\n🏁 Milestones:\n  ⛔ Past — 2020-01-01 · /.test(rd.out) && rmd.includes("## 🏁 Milestones") && rmd.includes("- **🏁 Past** — milestone late"),
    "1.16 E3 (CLI): roadmap prints the milestones after the forecasts; ROADMAP.md gets the Milestones table and the late one under Needs attention (got " + js(rd.out.slice(-300)) + ")");
  fs.writeFileSync(sp, JSON.stringify({ ...JSON.parse(fs.readFileSync(sp, "utf8")), approvals: { execution: { at: day(0), by: "t" } } }, null, 2));
  const cl = runOut(["changelog", "--milestone", "past", "--project", ep]);
  const clw = run(["changelog", "--milestone", "Past", "--write", "--project", ep]);
  const clBad = run(["changelog", "--milestone", "nope", "--project", ep]);
  const help = run(["help"]).out;
  const doc = fs.readFileSync(CLI, "utf8").split("*/")[0];
  ok(cl.code === 0 && /^# Release notes — p16e-proj — Past\n/.test(cl.stdout) && /\n### Checkout\n/.test(cl.stdout) &&
    clw.code === 0 && fs.existsSync(path.join(ep, ".specs", "RELEASE-NOTES.past.md")) && SE.readRoadmap(ep).meta.changelogAt === undefined &&
    clBad.code === 1 && /No milestone 'nope'/.test(clBad.out) &&
    [help, doc].every((t) => /milestone \[add <name> <YYYY-MM-DD> <features…> \| rm <name> \| list\]/.test(t) && /--gherkin/.test(t) && /--tracker jira\|linear/.test(t) && /--milestone <name>/.test(t)),
    "1.16 E3 (CLI): changelog --milestone <name> scopes the notes (→ RELEASE-NOTES.<milestone>.md, meta.changelogAt untouched); an unknown milestone exits 1; help and the docblock document milestone, --gherkin, --tracker, --milestone (got " + js(cl.stdout.slice(0, 200)) + ")");

  // --- 1.16 E review (CLI) ---
  SE.createFeature(ep, "User Login", ["core"], "", undefined, "en");
  const rvA = run(["milestone", "add", "Sprint α", "2099-12-31", "User Login", "--project", ep]);
  const rvB = run(["milestone", "add", "Sprint β", "2099-12-31", "invoices,User Login", "--project", ep]);
  const rvL = run(["milestone", "list", "--project", ep]);
  const rvFile = (n) => { const r = runOut(["changelog", "--milestone", n, "--json", "--project", ep]); try { return path.basename(JSON.parse(r.stdout).file); } catch { return ""; } };
  const rvFiles = [rvFile("Sprint α"), rvFile("sprint β")];
  ok(rvA.code === 0 && /^Milestone 'Sprint α' added — 2099-12-31: user-login\n/.test(rvA.out) && rvB.code === 0 && /^Milestone 'Sprint β' added — 2099-12-31: invoices, user-login\n/.test(rvB.out) &&
    /\n  [^\n]*Sprint α — 2099-12-31 · [^\n]*user-login\n/.test(rvL.out) && /\n  [^\n]*Sprint β — 2099-12-31 · [^\n]*invoices, user-login\n/.test(rvL.out) &&
    rvFiles.every((f) => /^RELEASE-NOTES\.sprint-[0-9a-f]{8}\.md$/.test(f)) && rvFiles[0] !== rvFiles[1],
    "1.16 E review (CLI) M1 / m2: milestone add keeps 'Sprint α' and 'Sprint β' apart (each its own RELEASE-NOTES file); a quoted feature name with spaces ('User Login') resolves, a comma splits (got " + js([rvA.out, rvB.out, rvFiles]) + ")");
  const bp = path.join(tmp, "p16e-broken");
  SE.initProject(bp, ["core"], "en");
  fs.writeFileSync(path.join(bp, ".specs", "roadmap.json"), "{ not json");
  const brk = run(["milestone", "list", "--project", bp]);
  const brkJ = runOut(["milestone", "--json", "--project", bp]);
  let brkDoc = null;
  try { brkDoc = JSON.parse(brkJ.stdout); } catch { /* stays null */ }
  ok(brk.code === 1 && /roadmap\.json is not valid JSON/.test(brk.out) && !/No milestones yet/.test(brk.out) && brkJ.code === 1 && brkDoc && brkDoc.ok === false && /roadmap\.json/.test(brkDoc.error),
    "1.16 E review (CLI) extra: milestone list on a roadmap.json that doesn't parse exits 1 with its error (--json: the {ok: false} result) — never 'No milestones yet' (got " + js([brk.code, brk.out]) + ")");
}

// 1.17 package (D): if (inSection("p17d")) { … }

// 1.17 package (A): if (inSection("p17a")) { … }

// 1.17 package (F): if (inSection("p17f")) { … }
if (inSection("p17f")) { // 1.17 package F — dev-spec import fluidplan (= spec_import {tool: "fluidplan"})
  const SF = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = (v) => JSON.stringify(v);
  const put = (root, rel, s) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof s === "string" ? s : JSON.stringify(s, null, 2)); };
  const rd = (root, ...p) => { try { return fs.readFileSync(path.join(root, ...p), "utf8"); } catch { return ""; } };
  const withStdin = (args, input) => { const r = spawnSync(process.execPath, [CLI, ...args], { input, encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: tmp } }); return { out: r.stdout || "", err: r.stderr || "", code: r.status }; };
  // plan.json v2 + answers.json, as fluidplan writes them (github.com/morganhub/fluidplan @ 755d1b24): D2's task is a template
  // ({{value}} {{unit}}) the answer fills (20 min), and it comes `after` D1's task.
  const plan = { version: 2, id: "cache", title: "Session cache", lang: "en", context: "Cache API sessions to handle the load.",
    phases: [{ id: "p1", title: "Foundation", estimate: "≈ 1 d" }],
    pages: [{ id: "storage", title: "Where sessions live", decisions: [
      { id: "D1", title: "The cache engine", importance: "critical", phase: "p1", why: "It sets how far the API scales.", control: { kind: "choice", options: [
        { id: "memory", label: "In-process memory", recommended: true, pros: ["Nothing to run"], cons: ["Lost on restart"], effort: "S",
          tasks: [{ id: "lru", title: "In-memory LRU cache", files: [{ path: "src/cache/lru.js", op: "create" }],
            acceptance: ["When the cache is full, the system evicts the least recently used entry"], verify: ["npm test -- cache"] }] },
        { id: "redis", label: "Redis", pros: ["Shared"], cons: ["One more service to run"], effort: "M" }] } },
      { id: "D2", title: "The time to live", phase: "p1", control: { kind: "number", min: 5, max: 120, step: 5, default: 30, unit: "min" },
        tasks: [{ id: "ttl", title: "TTL of {{value}} {{unit}}", do: "Set the expiry to {{value}} {{unit}}.", after: ["D1/lru"], acceptance: ["A session expires after {{value}} {{unit}}"] }] }] }] };
  const answers = { D1: { status: "ok" }, D2: { status: "ok", value: 20, comment: "Shorter in staging" } };
  const mk = (name) => { const p = path.join(tmp, name); run(["init", "core", "--project", p]); put(p, ".fluidplan/cache/plan.json", plan); put(p, ".fluidplan/cache/answers.json", answers); return p; };
  const fa = mk("p17f-a"), fb = mk("p17f-b"), fc = mk("p17f-c");
  const im = run(["import", "fluidplan", ".fluidplan/cache", "core", "--project", fa]);
  const tA = rd(fa, ".specs", "session-cache", "tasks.md"), rA = rd(fa, ".specs", "session-cache", "requirements.md");
  const logA = SF.decisionLog(rd(fa, ".specs", "session-cache", "decisions.md"));
  ok(im.code === 0 && /^Imported fluidplan \.fluidplan\/cache → feature 'session-cache' \[core\] \(en\)\n/.test(im.out) && /mapping: \d+ ID\(s\) — page storage → US-1, task 1\.1 \/ acceptance 1 → US-1\.AC-1/.test(im.out) &&
    /⚠ not converted to EARS[^\n]*US-1\.AC-2/.test(im.out) && /1\. \*\*US-1\.AC-1\*\* — WHEN the cache is full, THE SYSTEM SHALL evict the least recently used entry\n/.test(rA) &&
    /## Phase 1 — Foundation \(≈ 1 d\)\n- \[ \] 1\. In-memory LRU cache\n  - _Requirements: US-1\.AC-1_\n  - _Implements: src\/cache\/lru\.js_\n  - _Verify: npm test -- cache_\n/.test(tA) &&
    /- \[ \] 2\. TTL of 20 min\n  - _Requirements: US-1\.AC-2_\n  - _Depends: 1_\n  - Decision: D-2 — The time to live \(20 min\)\n  - Do: Set the expiry to 20 min\.\n  - Remark: “Shorter in staging”/.test(tA) &&
    js(logA.map((e) => [e.id, e.title, e.decision.split("\n")[0]])) === js([["D-1", "The cache engine", "In-process memory"], ["D-2", "The time to live", "20 min"]]),
    "1.17 F (CLI): import fluidplan <plan folder> [tracks] — plan.json + answers.json alone: the kept option's task and the filled template, after → _Depends:_, the criteria, decisions.md (D-1, D-2); the summary line, mapping and warnings printed (got " + js(im.out) + ")");
  const jB = (() => { try { return JSON.parse(run(["import", "fluidplan", ".fluidplan/cache", "core", "--json", "--project", fb]).out); } catch { return null; } })();
  const eC = SF.importSpec(fc, "fluidplan", ".fluidplan/cache", { tracks: ["core"] });
  ok(jB && jB.ok === true && jB.tool === "fluidplan" && eC.ok && js(jB.mapping) === js(eC.mapping) && js(jB.warnings) === js(eC.warnings) && js(jB.imported) === js(eC.imported) &&
    rd(fb, ".specs", "session-cache", "decisions.md").replace(/\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z)?/g, "D") === rd(fc, ".specs", "session-cache", "decisions.md").replace(/\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z)?/g, "D"),
    "1.17 F (CLI): import fluidplan --json prints spec_import's result — the same mapping, warnings and files as the engine call, the same decisions.md (got " + js(jB).slice(0, 300) + ")");
  const planMd = ["<!-- generated by fluidplan: regenerated on export, edits are overwritten -->", "# Session cache — execution plan", "",
    "> Approved on 2026-09-25 at 14:02, round 1 · generated by fluidplan", "> Do not edit by hand before execution: regenerate with `fluidplan export --plan cache`. During execution, tick tasks as you go.", "",
    "## Phase 1 — Foundation (≈ 1 d)", "", "### [x] 1.1 In-memory LRU cache · D1", "", "- Decision: **D1** The cache engine — In-process memory [critical]", "- Files: `src/cache/lru.js` (create)",
    "- Acceptance criteria:", "  - [x] When the cache is full, the system evicts the least recently used entry", "- Verify: `npm test -- cache`", "",
    "### [ ] 1.2 TTL of 20 min · D2", "", "- Decision: **D2** The time to live — 20 min", "- Do: Set the expiry to 20 min.", "- Acceptance criteria:", "  - [ ] A session expires after 20 min",
    "- After: 1.1", "- Remark: “Shorter in staging”", "", "## Final check", "", "- [ ] `npm test -- cache`", ""].join("\n");
  const st = withStdin(["import", "fluidplan", "-", "core", "--name", "From stdin", "--project", fa], planMd);
  const stJ = withStdin(["import", "fluidplan", "-", "core", "--name", "From stdin json", "--json", "--project", fa], planMd);
  let stDoc = null;
  try { stDoc = JSON.parse(stJ.out); } catch { /* stays null */ }
  const tS = rd(fa, ".specs", "from-stdin", "tasks.md");
  ok(st.code === 0 && /\(inline text\)/.test(st.out) && /^> Imported from fluidplan \(inline text\) on /m.test(tS) && /- \[x\] 1\. In-memory LRU cache\n/.test(tS) && /- \[ \] 2\. TTL of 20 min\n[\s\S]*  - _Depends: 1_/.test(tS) &&
    stDoc && stDoc.ok === true && stDoc.inline === true && stDoc.source === null && stDoc.warnings.some((w) => /no DECISIONS\.md and no plan\.json beside PLAN\.md/.test(w)),
    "1.17 F (CLI): import fluidplan - reads a PLAN.md from stdin (a ticked task stays ticked, After → _Depends:_); --json = spec_import {text} (inline, source null, the PLAN.md-only warning) (got " + js([st.out, stJ.out.slice(0, 200)]) + ")");
  put(fa, ".fluidplan/other/plan.json", { ...plan, id: "other", title: "Other" });
  put(fa, "notes/todo.md", "# Todo\n\n- buy milk\n");
  const sev = run(["import", "fluidplan", ".fluidplan", "--json", "--project", fa]);
  let sevJ = null;
  try { sevJ = JSON.parse(sev.out); } catch { /* not JSON */ }
  const outside = run(["import", "fluidplan", "../p17f-b/.fluidplan/cache", "--project", fa]);
  const notFp = run(["import", "fluidplan", "notes/todo.md", "--project", fa]);
  const pt = run(["import", "fluidplan", ".fluidplan/cache", "core", "--lang", "pt", "--name", "Cache PT", "--project", fa]);
  const help = run(["help"]).out;
  ok(sev.code === 1 && sevJ && sevJ.ok === false && /'\.fluidplan' holds several fluidplan plans \(cache, other\)/.test(sevJ.error) && outside.code === 1 && /outside the project/.test(outside.out) &&
    notFp.code === 1 && /is not a fluidplan PLAN\.md or DECISIONS\.md/.test(notFp.out) && pt.code === 0 && /^Importado de fluidplan \.fluidplan\/cache → feature 'cache-pt'/.test(pt.out) &&
    /^> Importado de fluidplan `\.fluidplan\/cache` em /m.test(rd(fa, ".specs", "cache-pt", "tasks.md")) && /  - Decisão: D-2 — The time to live \(20 min\)/.test(rd(fa, ".specs", "cache-pt", "tasks.md")) &&
    /^# Decisões: Cache PT\n/.test(rd(fa, ".specs", "cache-pt", "decisions.md")) && /fluidplan = a fluidplan plan \(\.fluidplan\/<id>\/:/.test(help),
    "1.17 F (CLI): exit 1 for a plans folder holding several plans (--json: the refusal), a path outside the project, a document that is no fluidplan one; --lang pt localizes the note, the labels and decisions.md; help documents fluidplan (got " + js([sev.out, outside.out, notFp.out, pt.out]).slice(0, 400) + ")");
}

// unknown command errors
if (inSection("main")) ok(run(["wat"]).code === 1, "unknown command exits non-zero");

console.log(`\n${pass} passed, ${fail} failed`);
rmTmpDir(tmp);
exitFlushed(fail ? 1 : 0);
