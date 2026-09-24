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
ok(fin.code === 1 && /fix\(login-loop\): bounce to \/login/.test(fin.out) && /root-cause/.test(fin.out), "finish exits 1 while blocked and prints the merge summary from the spec");

// @wp WP1 cli-tests >>>
// @wp WP1 <<<

// @wp WP2 cli-tests >>>
// @wp WP2 <<<

// @wp WP3 cli-tests >>>
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
fs.writeFileSync(path.join(w4f, "tasks.md"), "- [ ] 1. a\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-3.AC-1_\n  - _Makes green: T-01, T-99_\n  - _Implements: src/nope.js_\n");
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
ok(/plano de testes\s+\(0\/\d+ tarefas\)/.test(ptList) && ptListJ && ptListJ.features[0].phase === "test-plan", "list (PT): localized phase + 'tarefas'; --json keeps the English phase token");
ok(/fase: plano de testes/.test(run(["status", "pagamentos", "--project", pt4]).out) && /Diagnóstico: pagamentos .*veredicto=FALHA\s+pronta para avançar: não/.test(run(["doctor", "pagamentos", "--project", pt4]).out),
  "status/doctor (PT) wrappers are localized");
ok(/Fase 'requirements' de pagamentos aprovada ✓/.test(run(["approve", "pagamentos", "requirements", "--project", pt4]).out) &&
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
  /Aprobada|aprobada/.test(run(["approve", "pagos", "design", "--project", es4]).out), "create/list/approve (ES) are localized");
ok(/Aclarar: pagos/.test(run(["clarify", "pagos", "--project", es4]).out) && /No se ha eliminado nada/.test(run(["feature", "remove", "pagos", "--project", es4]).out) &&
  /falta el valor de --text/.test(run(["ears", "--text", "--project", es4]).out) && /herramienta desconocida/.test(run(["rules", "vim", "--project", es4]).out) &&
  /'pagos' renombrada → 'cobros'/.test(run(["feature", "rename", "pagos", "Cobros", "--project", es4]).out), "clarify/remove preview/errors/rename (ES) are localized");
ok(/confianza: tdd=/.test(run(["classify", "página de pagos con suscripciones para el usuario"]).out) && /confiança: /.test(run(["classify", "página de pagamentos para o utilizador"]).out),
  "classify labels follow the language of the reasoning (ES/PT)");
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
