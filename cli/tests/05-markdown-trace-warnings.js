"use strict";
// trace prints the EC / NFR / SC warnings (exit code unchanged); --code scans test files; finish lists warnings.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, tmp, CLI }) => {
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

  // 1.21.1 languages: a +tdd PowerShell feature on the CLI — trace --code and `approve <f> tests` (Phase 4) read the Pester files
  // (tests/ and beside the module) the plan's File column names; before 1.21.1 they were never read and the gate never passed.
  const pw = path.join(tmp, "l121-pester");
  const putPw = (rel, s) => { const p = path.join(pw, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
  run(["init", "core", "tdd", "--project", pw]);
  run(["create", "Greeter", "core", "tdd", "--project", pw]);
  putPw(".specs/greeter/test-plan.md", "# Test Plan\n\n| Test ID | Kind | Covers | File |\n|---|---|---|---|\n| T-01 | example | US-1.AC-1 | `tests/Greeter.Tests.ps1` |\n" +
    "| T-02 | example | US-1.AC-1 | `src/Greeter/Greeter.Tests.ps1` |\n");
  run(["approve", "greeter", "--through", "test-plan", "--force", "--project", pw]);
  const trBefore = run(["trace", "greeter", "--code", "--project", pw]);
  const gateBefore = run(["approve", "greeter", "tests", "--project", pw]);
  putPw("tests/Greeter.Tests.ps1", "BeforeAll { Import-Module \"$PSScriptRoot/../src/Greeter/Greeter.psm1\" -Force }\nDescribe 'Get-Greeting' {\n  It 'T-01 greets by name (US-1.AC-1)' { Get-Greeting -Name 'Ana' | Should -Be 'Hello, Ana' }\n}\n");
  putPw("src/Greeter/Greeter.Tests.ps1", "Describe 'Get-Greeting' { It 'T-02 greets nobody' { Get-Greeting | Should -Be 'Hello' } }\n");
  const trAfter = run(["trace", "greeter", "--code", "--project", pw]);
  const gateAfter = run(["approve", "greeter", "tests", "--project", pw]);
  ok(/tests in code: 0\/2 planned T-ID\(s\) named in 0 test file\(s\)/.test(trBefore.out) && gateBefore.code === 1 && /T-01, T-02/.test(gateBefore.out) &&
    /tests in code: 2\/2 planned T-ID\(s\) named in 2 test file\(s\)/.test(trAfter.out) && gateAfter.code === 0 && !/forced/i.test(gateAfter.out),
    "1.21.1 languages: trace --code and approve tests on a +tdd PowerShell feature — 0/2 and refused (T-01, T-02) until tests/Greeter.Tests.ps1 and src/Greeter/Greeter.Tests.ps1 name them, then 2/2 and approved unforced (got " +
    JSON.stringify([trBefore.out.split("\n").filter((l) => /tests in code/.test(l)), gateBefore.out.slice(0, 160), trAfter.out.split("\n").filter((l) => /tests in code/.test(l)), gateAfter.out.slice(0, 120)]) + ")");
};
