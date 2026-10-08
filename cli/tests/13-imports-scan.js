"use strict";
// scan sections, coverage by _Implements:_, import (Kiro · spec-kit · OpenSpec), create --brownfield.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, tmp, require, __dirname }) => {
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
  // (1.21.1: the SQL migration is code too — one notion of code — so 1/3, was 1/2, and migrations/ is an uncovered folder)
  ok(cov.code === 0 && /Spec coverage: 33%  \(1\/3 code files named in _Implements:_\)/.test(cov.out) && /test files \(reported apart, not counted\): 1/.test(cov.out) &&
    /src\/\s+1\/1\s+100%/.test(cov.out) && /migrations\/\s+0\/1\s+0%/.test(cov.out) && /uncovered folders: api, migrations/.test(cov.out),
    "coverage prints the % of code files named in _Implements:_, per folder, and the uncovered folders");
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
  fs.mkdirSync(tk, { recursive: true }); // 1.23 review: --project names an existing folder (only init creates one)
  const crT =(() => { try { return JSON.parse(run(["create", "Payments Flow", "--tracks", "tdd,saas", "--json", "--project", tk]).out); } catch { return null; } })();
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

  // 1.21.1 languages: a PowerShell project on the CLI — scan and coverage print what spec_scan / spec_coverage return (one
  // engine): stack powershell, pester, the entrypoints, $env: names; 3 code files (.ps1 / .psm1 — the .psd1 is data), 2 tests.
  const S = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const ps = path.join(tmp, "l121-pwsh");
  const putPs = (rel, s) => { const p = path.join(ps, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
  putPs("src/Greeter/Greeter.psm1", "function Get-Greeting { param([string]$Name) \"Hello, $Name\" }\n");
  putPs("src/Greeter/Greeter.psd1", "@{ RootModule = 'Greeter.psm1'; ModuleVersion = '0.1.0' }\n");
  putPs("src/Greeter/Greeter.Tests.ps1", "Describe 'Get-Greeting' { It 'T-02 greets nobody' { } }\n");
  putPs("scripts/deploy.ps1", "param([string]$Target = $env:DEPLOY_ENV)\n");
  putPs("tests/Greeter.Tests.ps1", "Describe 'Get-Greeting' { It 'T-01 greets by name' { } }\n");
  putPs("build.ps1", "Invoke-Pester -Path ./tests -CI\n");
  run(["init", "core", "tdd", "--project", ps]);
  const psScan = run(["scan", "--project", ps, ps]);
  let psJ = null, psCov = null;
  try { psJ = JSON.parse(run(["scan", "--json", "--project", ps, ps]).out); } catch { /* invalid JSON */ }
  try { psCov = JSON.parse(run(["coverage", "--json", "--project", ps]).out); } catch { /* invalid JSON */ }
  const psCovTxt = run(["coverage", "--project", ps]);
  const eng = S.scanCodebase(ps);
  ok(psScan.code === 0 && /stack: powershell/.test(psScan.out) && /tests: 2 file\(s\) · frameworks: pester/.test(psScan.out) &&
    /entrypoints: build\.ps1 \(powershell script\), src\/Greeter\/Greeter\.psm1 \(powershell module\)/.test(psScan.out) && /env vars \(names only\): DEPLOY_ENV/.test(psScan.out) &&
    psJ && JSON.stringify([psJ.stack, psJ.testFrameworks, psJ.entrypoints, psJ.envVars, psJ.testFiles]) === JSON.stringify([eng.stack, eng.testFrameworks, eng.entrypoints, eng.envVars, eng.testFiles]) &&
    psCov && psCov.codeFiles === 3 && psCov.testFiles === 2 && psCovTxt.code === 0 && /Spec coverage: 0%  \(0\/3 code files named in _Implements:_\)/.test(psCovTxt.out) &&
    /test files \(reported apart, not counted\): 2/.test(psCovTxt.out),
    "1.21.1 languages: scan / coverage on a PowerShell project (CLI = MCP): stack powershell, tests 2 · pester, build.ps1 + the module's RootModule as entrypoints, DEPLOY_ENV; 0/3 code files (.ps1 / .psm1), 2 test files (got " +
    JSON.stringify([psScan.out.split("\n").filter((l) => /stack|tests:|entrypoints|env vars/.test(l)), psCov && psCov.codeFiles, psCovTxt.out.split("\n")[0]]) + ")");

  // 1.22 review — scan / coverage on a path that is no folder (a typo): exit 1 with the error, never "files: 0 | stack: unknown".
  const missing = path.join(tmp, "wp6-missing-folder");
  const scM = run(["scan", "--project", w6, missing]);
  let scMj = null;
  try { scMj = JSON.parse(run(["scan", "--json", "--project", w6, missing]).out); } catch { /* invalid JSON */ }
  const covM = run(["coverage", "--project", missing]);
  const scF = run(["scan", "--project", w6, path.join(w6, "package.json")]);
  ok(scM.code === 1 && /is not a folder \(it doesn't exist, or it is a file\)/.test(scM.out) && !/stack: unknown|files: 0/.test(scM.out) &&
    scMj && scMj.ok === false && /is not a folder/.test(scMj.error) && covM.code === 1 && /--project .*wp6-missing-folder: no such folder/.test(covM.out) && scF.code === 1 && !fs.existsSync(missing),
    "1.22 review: `scan <missing>` / `scan <a file>` exit 1 with 'is not a folder' (--json: ok false), never an empty codebase; 1.23 review: `coverage --project <missing>` is refused as a --project that doesn't exist (got " +
    JSON.stringify([scM.code, scM.out.slice(0, 120), covM.code, scF.code]) + ")");
};
