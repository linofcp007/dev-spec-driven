"use strict";
// Core — help, classify, init / create (EN / PT / ES), doctor, status, next / done, brief, approve, ears, trace,
// clarify, roadmap / depend / scan / coverage, next-action, add-track, feature ops, mcp-config, steering, exit codes,
// done --run, the bugfix flow, finish, next --batch — on the suite's default project.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, run, tmp, CLI }) => {
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
fs.mkdirSync(stDir, { recursive: true }); // 1.23 review: --project names an existing folder (only init creates one)
ok(/Created .*scale\.md/.test(run(["steering", "scale.md", "--project", stDir]).out) && /Exists/.test(run(["steering", "scale.md", "--project", stDir]).out), "steering <file> scaffolds one steering file (idempotent)");
ok(run(["doctor", "Invoice Summary"]).code === 1 && run(["classify", "x"]).code === 0, "doctor exits 1 when a blocking check fails (scriptable)");
const sumOut = run(["create", "Digest", "--summary", "summarize tickets with an LLM"]).out;
ok(/\+ai/.test(sumOut), "create --summary feeds the auto-classifier (same as the MCP tool)");
const cpd = path.join(tmp, "cpd-proj");
const rc = spawnSync(process.execPath, [CLI, "init", "core"], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: "", CLAUDE_PROJECT_DIR: cpd } });
ok(rc.status === 0 && fs.existsSync(path.join(cpd, ".specs", "steering")), "the CLI honors CLAUDE_PROJECT_DIR like the MCP server");

// v1.12: done --run records evidence from the task's own _Verify:_ command; bugfix; finish; next --batch
const vp = path.join(tmp, "v112-proj");
fs.mkdirSync(vp, { recursive: true }); // 1.23 review: --project names an existing folder (only init creates one)
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

// unknown command errors
ok(run(["wat"]).code === 1, "unknown command exits non-zero");
};
