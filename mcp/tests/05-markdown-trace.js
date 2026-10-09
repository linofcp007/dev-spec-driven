"use strict";
// Markdown and trace — EARS criteria, markers, comments and fences, trace_check, the traceability matrix.
// AC / T-ID extraction, EC / NFR / SC warnings, T-IDs in test code, _Implements:_ globs, linear-time line patterns.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, all, rpc, payload, S, tmp, approveBefore, shipFeature, __dirname }) => {

  { // --- 1.13 WP9: deep traceability (EC/NFR/SC warnings, T-IDs in test code) + property-based test plans ---
    const call9 = async (args) => payload(await rpc("tools/call", { name: "trace_check", arguments: args }));
    const w9f = (root, rel, s) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
    const kinds9 = (tr) => (tr.warnings || []).map((w) => w.kind + "=" + w.items.join("+")).join(" ");
    const w9 = path.join(tmp, "proj-wp9");
    S.initProject(w9, ["tdd"]);

    // B. A fresh scaffold (every track, EN/PT/ES) and a fresh bugfix raise no secondary warning: the template SC-001 /
    // EC-1 / NFR-1 rows are placeholders, and the bugfix's real SC-001 is covered by its regression row T-01.
    const fresh9 = [["Fresh all", ["tdd", "saas", "ai"], "en"], ["Fresco", ["tdd"], "pt"], ["Fresca", ["tdd", "saas"], "es"]]
      .map(([n, t, l]) => S.traceCheck(w9, S.createFeature(w9, n, t, undefined, undefined, l).slug));
    const bugs9 = ["en", "pt", "es"].map((l) => S.traceCheck(w9, S.createFeature(w9, "Bug " + l, ["tdd"], undefined, undefined, l, "bugfix").slug));
    ok(fresh9.concat(bugs9).every((tr) => tr.ok && tr.verdict === "pass" && Array.isArray(tr.warnings) && tr.warnings.length === 0 &&
      ["uncoveredEdgeCases", "uncoveredNfr", "uncoveredSuccessCriteria", "phantomSecondary"].every((k) => Array.isArray(tr[k]) && tr[k].length === 0) && tr.code === undefined),
      "fresh scaffolds (EN/PT/ES, all tracks) and fresh bugfixes: no EC/NFR/SC warning — template rows don't count, the bugfix's SC-001 is covered by T-01");

    // Secondary IDs: EC/NFR need a task or a test-plan row, SC a test-plan row or a real quickstart line.
    const d9 = S.createFeature(w9, "Deep", ["tdd"]);
    w9f(d9.dir, "requirements.md", ["# Feature: Deep", "", "## Summary", "Sessions expire and refresh.", "", "## User Stories", "",
      "### US-1 (P1 — MVP): Sessions", "**As a** user, **I want** sessions, **so that** I stay signed in.", "",
      "#### Acceptance Criteria (EARS)", "1. **US-1.AC-1** — WHEN a token expires THE SYSTEM SHALL reject it with 401.", "",
      "## Success Criteria", "- **SC-001** — 99% of refreshes succeed within 300 ms.", "- **SC-002** — zero sessions outlive their expiry.",
      "- **SC-003** — support tickets about logouts drop by 50%.", "- **SC-004** — [e.g., 90% of users complete [task] in under [N] seconds]", "",
      "## Edge Cases & Error Handling", "- **EC-1** — a clock skew of 5 s: the token is still accepted.", "- **EC-2** — a revoked refresh token",
      "  is rejected with 401 (wrapped onto a second line).", "", "## Non-Functional Requirements", "- **NFR-1** — p95 refresh latency ≤ 300 ms.",
      "- **NFR-2** — [measurable performance / security / accessibility constraint]", "", "<!-- - **EC-5** — an example in a comment is not a definition -->", ""].join("\n"));
    w9f(d9.dir, "tasks.md", ["# Tasks: Deep", "", "## Phase: Build", "- [ ] 1. [US1] Reject expired tokens (keeps EC-1 in mind)",
      "  - _Requirements: US-1.AC-1, NFR-2_", "  - _Makes green: T-01_", "- [ ] 2. [US1] Cover the skew window", "  - _Requirements: US-1.AC-1, EC-9_", ""].join("\n"));
    w9f(d9.dir, "test-plan.md", ["# Test Plan: Deep", "", "| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |", "|---|---|---|---|---|---|",
      "| T-01 | unit | example | expired token rejected | US-1.AC-1, SC-001 | `tests/unit/session.test.js` |",
      "| T-02 | unit | property | refresh stays in budget | US-1.AC-1, NFR-1, NFR-7 | `tests/unit/perf.test.js` |", "",
      "## Coverage Check", "- EC-2 — not tested yet (a gap note is not a test row).", ""].join("\n"));
    w9f(d9.dir, "quickstart.md", "# Quickstart: Deep\n\n3. **Expect:** no session outlives its expiry (SC-2).\n4. **Expect:** [observable result tied to a Success Criterion, e.g. SC-001] (SC-003)\n");
    const t9 = S.traceCheck(w9, "deep");
    ok(t9.ok && t9.verdict === "pass" && t9.uncoveredEdgeCases.join() === "EC-2" && t9.uncoveredNfr.length === 0 && t9.uncoveredSuccessCriteria.join() === "SC-003" &&
      t9.phantomSecondary.join() === "EC-9,NFR-7" && kinds9(t9) === "uncoveredEdgeCases=EC-2 uncoveredSuccessCriteria=SC-003 phantomSecondary=EC-9+NFR-7",
      "trace_check: EC-2 (a gap note isn't a test row) and SC-003 (only on a template quickstart line) are uncovered; SC-2 names SC-002; EC-9 / NFR-7 are phantom; the verdict stays pass (got " + kinds9(t9) + ")");
    ok(!S.traceGaps(t9).some((g) => /Edge|Nfr|Success|Secondary|warnings/.test(g.kind)) && S.traceGapLines(t9, "en").every((l) => !/EC-|SC-|NFR-/.test(l)),
      "the secondary warnings are never trace gaps (traceGaps / traceGapLines skip them and the `warnings` field)");
    ok(!t9.phantomSecondary.includes("NFR-2") && !t9.uncoveredNfr.includes("NFR-2") && !t9.uncoveredSuccessCriteria.includes("SC-004") && !t9.uncoveredEdgeCases.includes("EC-5"),
      "a template-only ID (NFR-2, SC-004) is defined but never uncovered; an ID inside an HTML comment (EC-5) is not defined");
    const m9 = await call9({ name: "Deep", projectDir: w9 });
    const m9c = await call9({ name: "Deep", projectDir: w9, code: false });
    ok(kinds9(m9) === kinds9(t9) && m9.verdict === "pass" && m9.code === undefined && m9c.code === undefined,
      "MCP trace_check returns the same warnings as the engine; without code: true there is no `code` field");

    // doctor: a secondary-trace WARN (traceability still passes); finish lists them as warnings, never blockers.
    const doc9 = S.specDoctor(w9, "deep");
    const sec9 = doc9.checks.find((c) => c.id === "secondary-trace");
    ok(sec9 && sec9.status === "warn" && /edge cases \(EC\) that no task or test covers: EC-2/.test(sec9.detail) && /SC-003/.test(sec9.detail) && /EC-9, NFR-7/.test(sec9.detail) &&
      doc9.checks.find((c) => c.id === "traceability").status === "pass" && !doc9.checks.some((c) => c.id === "tests-in-code"),
      "doctor: secondary-trace is a warn naming each kind with its IDs; traceability passes; no tests-in-code check without done _Makes green:_ tasks");
    const fin9 = S.finishFeature(w9, "deep");
    ok(Array.isArray(fin9.warnings) && fin9.warnings.some((w) => /EC-2/.test(w)) && fin9.warnings.some((w) => /EC-9, NFR-7/.test(w)) &&
      !fin9.blockers.some((b) => /EC-|SC-|NFR-/.test(b)), "spec_finish lists the EC/NFR/SC findings under warnings — never as blockers");
    const clean9 = S.specDoctor(w9, "fresh-all");
    const cleanFin9 = S.finishFeature(w9, "fresh-all").warnings;
    ok(!clean9.checks.some((c) => c.id === "secondary-trace") && cleanFin9.length === 1 && /^planned tests that no test file names \(put the T-ID in the test name\): T-01, T-02, .*T-10$/.test(cleanFin9[0]),
      "no secondary IDs written yet → no secondary-trace check and no EC/NFR/SC finish warning (only: no test file names the planned T-IDs yet)");
    // Hook on tasks.md: the warnings follow the trace line, under their own heading.
    const hk9 = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "spec-hook.js")], { input: JSON.stringify({ hook_event_name: "PostToolUse", tool_input: { file_path: path.join(d9.dir, "tasks.md") } }), encoding: "utf8" });
    let hk9t = "";
    try { hk9t = JSON.parse(hk9.stdout).hookSpecificOutput.additionalContext; } catch { /* no output */ }
    ok(/Traceability: all 1 ACs covered by tasks/.test(hk9t) && /Warnings \(not blocking\):\n  ▲ edge cases \(EC\) that no task or test covers: EC-2/.test(hk9t) && /▲ tasks \/ test plan cite unknown EC\/NFR\/SC IDs \(typos\?\): EC-9, NFR-7/.test(hk9t),
      "tasks.md hook: the EC/NFR/SC warnings are listed after the trace line (got " + JSON.stringify(hk9t) + ")");
    // Covering EC-2 in a task and SC-003 in the plan clears them; the doctor check then passes.
    fs.appendFileSync(path.join(d9.dir, "tasks.md"), "- [ ] 3. [US1] Reject revoked refresh tokens\n  - _Requirements: US-1.AC-1, EC-2_\n");
    fs.appendFileSync(path.join(d9.dir, "test-plan.md"), "\n| Test ID | Layer | Kind | Description | Covers | File |\n|---|---|---|---|---|---|\n| T-03 | e2e | example | logout tickets | SC-003 | `tests/e2e/x.spec.ts` |\n");
    fs.writeFileSync(path.join(d9.dir, "tasks.md"), fs.readFileSync(path.join(d9.dir, "tasks.md"), "utf8").replace(", EC-9", ""));
    fs.writeFileSync(path.join(d9.dir, "test-plan.md"), fs.readFileSync(path.join(d9.dir, "test-plan.md"), "utf8").replace(", NFR-7", ""));
    const doc9b = S.specDoctor(w9, "deep");
    ok(S.traceCheck(w9, "deep").warnings.length === 0 && doc9b.checks.find((c) => c.id === "secondary-trace").status === "pass" &&
      /all 6 EC\/NFR\/SC IDs covered/.test(doc9b.checks.find((c) => c.id === "secondary-trace").detail),
      "once every real EC/NFR/SC is covered, trace has no warnings and secondary-trace passes (6 real IDs; the template ones don't count)");

    // PT feature: localized warning lines in doctor / finish / the engine helper; markers stay English-stable.
    const p9 = S.createFeature(w9, "Sessões", ["tdd"], undefined, undefined, "pt");
    fs.appendFileSync(path.join(p9.dir, "requirements.md"), "\n## Requisitos Extra\n- **EC-7** — relógio adiantado 5 s: o token continua aceite.\n");
    const pdoc9 = S.specDoctor(w9, "sessoes").checks.find((c) => c.id === "secondary-trace");
    ok(pdoc9 && pdoc9.status === "warn" && /casos limite \(EC\) sem tarefa nem teste que os cubra: EC-7/.test(pdoc9.detail) &&
      S.finishFeature(w9, "sessoes").warnings.some((w) => /^casos limite \(EC\) sem tarefa nem teste que os cubra: EC-7$/.test(w)) &&
      S.traceWarningLines(S.traceCheck(w9, "sessoes"), "es").join() === "casos límite (EC) sin tarea ni prueba que los cubra: EC-7",
      "PT feature: secondary-trace / finish warnings in Portuguese (and traceWarningLines localizes to ES on request)");

    // I. Property-based test plans: a Kind column (example | property, English-stable) with the T-ID still the FIRST
    // cell — the brief quotes the row under its header; the ubiquitous AC-4 and tenant isolation are properties.
    const plan9 = (slug) => fs.readFileSync(path.join(w9, ".specs", slug, "test-plan.md"), "utf8");
    ok(/\| Test ID \| Layer \| Kind \| Description \| Covers \(AC IDs\) \| File \|/.test(plan9("fresh-all")) && /\| T-04 \| unit \| property \| \[always-true property\] \| US-1\.AC-4 \|/.test(plan9("fresh-all")) &&
      /\| T-06 \| integration \| property \| tenant A never reads/.test(plan9("fresh-all")) && /\| T-01 \| unit \| example \|/.test(plan9("fresh-all")) &&
      /\| Test ID \| Camada \| Tipo \| Descrição \|/.test(plan9("fresco")) && /\| T-04 \| unit \| property \|/.test(plan9("fresco")) &&
      /\| Test ID \| Capa \| Tipo \| Descripción \|/.test(plan9("fresca")) && /\| T-06 \| integración \| property \|/.test(plan9("fresca")) &&
      ["fresh-all", "fresco", "fresca"].every((s) => /<!--[\s\S]*property[\s\S]*fast-check, Hypothesis, jqwik, gopter, FsCheck[\s\S]*T-01[\s\S]*-->/.test(plan9(s))),
      "feature test plans (EN/PT/ES) carry a Kind/Tipo column after Layer, T-ID first; AC-4 and tenant isolation are property rows; the guidance comment names the libraries");
    ok(["bug-en", "bug-pt", "bug-es"].every((s) => /\| Test ID \| (Layer|Camada|Capa) \| (Kind|Tipo) \|/.test(plan9(s)) && /\| T-01 \| [^|]+ \| example \| [^|]+ \| US-1\.AC-1, SC-001 \|/.test(plan9(s))),
      "bugfix test plans (EN/PT/ES) carry the Kind column and the regression row T-01 covers SC-001");
    const br9 = S.taskBrief(w9, "fresh-all", 3);
    ok(br9.ok && br9.tests.length === 3 && br9.tests[0].row.startsWith("| T-01 | unit | example |") && br9.brief.includes("| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---------|-------|------|") &&
      S.traceCheck(w9, "fresh-all").plannedTests === 10,
      "the brief still resolves each T-ID to its row (T-ID in the first cell) and quotes it under the Kind header; trace counts every planned test");

    // Drive root: withinRoot (used by trace_check's _Implements:_ clamp) holds at C:\ or / — `root + sep` did not.
    const drive9 = path.parse(tmp).root;
    ok(S.withinRoot(drive9, path.join(drive9, "src", "a.js")) && S.withinRoot(drive9, drive9) && !S.withinRoot(path.join(drive9, "proj"), path.join(drive9, "projX", "a.js")) &&
      !S.withinRoot(path.join(drive9, "proj"), path.join(drive9, "a.js")) && S.withinRoot(path.join(drive9, "proj"), path.join(drive9, "proj", "..cache", "a.js")),
      "withinRoot: a drive root contains its files; a sibling with the same prefix and the parent are outside; a '..cache' folder is inside");

    // C. T-IDs in test code — one test file per language family, in a small project of its own.
    const c9 = path.join(tmp, "proj-wp9-code");
    S.initProject(c9, ["tdd"]);
    const cf9 = S.createFeature(c9, "Coded", ["tdd"]);
    w9f(cf9.dir, "requirements.md", "# Feature: Coded\n\n## User Stories\n\n### US-1 (P1)\n\n#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN a token expires THE SYSTEM SHALL reject it.\n2. **US-1.AC-2** — WHEN a key rotates THE SYSTEM SHALL keep old tokens valid for 60 s.\n");
    w9f(cf9.dir, "test-plan.md", "| Test ID | Layer | Kind | Description | Covers | File |\n|---|---|---|---|---|---|\n" +
      ["T-01", "T-02", "T-03", "T-04", "T-05", "T-06", "T-07"].map((t) => `| ${t} | unit | example | x | US-1.AC-1, US-1.AC-2 | \`x\` |`).join("\n") + "\n");
    w9f(cf9.dir, "tasks.md", "# Tasks\n\n## Phase: Build\n- [x] 1. [US1] Reject expired tokens\n  - _Requirements: US-1.AC-1_\n  - _Makes green: T-01, T-07_\n" +
      "- [ ] 2. [US1] Rotate keys\n  - _Requirements: US-1.AC-2_\n  - _Makes green: T-02, T-03, T-04, T-05, T-06_\n");
    const of9 = S.createFeature(c9, "Other", ["tdd"]);
    w9f(of9.dir, "test-plan.md", "| Test ID | Covers |\n|---|---|\n| T-09 | US-1.AC-1 |\n");
    w9f(c9, "tests/unit/login.test.js", "const { test } = require(\"node:test\");\ntest(\"T-01 rejects an expired token (US-1.AC-1)\", () => {});\n// GPT-4 and UTF-8 are not test IDs\n");
    w9f(c9, "tests/test_login.py", "def test_T02_lockout():\n    assert True\n");
    w9f(c9, "pkg/auth/login_test.go", "package auth\n\nimport \"testing\"\n\nfunc TestT03Refresh(t *testing.T) {}\n");
    w9f(c9, "src/test/java/com/acme/LoginTest.java", "class LoginTest {\n  @Test @DisplayName(\"T-04 rotates keys\")\n  void rotates() {}\n}\n");
    w9f(c9, "tests/LoginTests.cs", "public class LoginTests {\n  [Fact(DisplayName = \"T-05 audit\")]\n  public void Audit() {}\n  [Fact]\n  public void T06_Revokes() {}\n  Func<T7, T8> f;\n}\n");
    w9f(c9, "tests/other.test.js", "test(\"T-42 an orphan\", () => {});\ntest(\"T-09 belongs to Other\", () => {});\n");
    w9f(c9, "src/app.js", "// T-07 named in source code, not in a test\n");
    w9f(c9, "node_modules/pkg/x.test.js", "test(\"T-07 vendored\", () => {});\n");
    const ct9 = S.traceCheck(c9, "coded", { code: true });
    const code9 = ct9.code || {};
    const tic9 = code9.testsInCode || {};
    ok(ct9.ok && JSON.stringify(Object.keys(tic9).sort()) === JSON.stringify(["T-01", "T-02", "T-03", "T-04", "T-05", "T-06", "T-09", "T-42"]) &&
      tic9["T-01"].join() === "tests/unit/login.test.js" && tic9["T-02"].join() === "tests/test_login.py" && tic9["T-03"].join() === "pkg/auth/login_test.go" &&
      tic9["T-04"].join() === "src/test/java/com/acme/LoginTest.java" && tic9["T-05"].join() === "tests/LoginTests.cs" && tic9["T-06"].join() === "tests/LoginTests.cs",
      "trace_check {code: true}: T-IDs found per language family — test(\"T-01 …\"), def test_T02_, func TestT03, @DisplayName(\"T-04 …\"), DisplayName=\"T-05 …\", T06_ (got " + JSON.stringify(tic9) + ")");
    ok(code9.plannedNotInCode.join() === "T-07" && code9.inCodeNotInPlan.join() === "T-42" && code9.acsInTests.join() === "US-1.AC-1" && code9.scanned === 6 &&
      code9.truncated === false && code9.planned === 7 && kinds9(ct9) === "plannedNotInCode=T-07 inCodeNotInPlan=T-42" && ct9.verdict === "pass",
      "T-07 (only in source code and node_modules) is planned-not-in-code; T-42 is in no feature's plan while Other's T-09 isn't reported; Func<T7, T8> / GPT-4 are not IDs; 6 test files read");
    const mc9 = await call9({ name: "Coded", projectDir: c9, code: true });
    ok(mc9.ok && JSON.stringify(mc9.code) === JSON.stringify(code9) && kinds9(mc9) === kinds9(ct9), "MCP trace_check {code: true} returns the same code block as the engine");
    // doctor: the done task claims T-01 and T-07 → tests-in-code warns about T-07 only (open tasks' tests may not exist yet).
    const cdoc9 = S.specDoctor(c9, "coded").checks.find((c) => c.id === "tests-in-code");
    const cfin9 = S.finishFeature(c9, "coded");
    ok(cdoc9 && cdoc9.status === "warn" && /no test file names them: T-07 — put the T-ID in a test's name/.test(cdoc9.detail) && !/T-0[2-6]/.test(cdoc9.detail) &&
      cfin9.warnings.some((w) => /^planned tests that no test file names \(put the T-ID in the test name\): T-07$/.test(w)) && !cfin9.warnings.some((w) => /T-42/.test(w)) &&
      !cfin9.blockers.some((b) => /T-07/.test(b)),
      "doctor tests-in-code warns about the done task's T-07 only; spec_finish lists plannedNotInCode as a warning (not T-42, never a blocker)");
    w9f(c9, "tests/unit/rotate.test.js", "test(\"T-07 keeps old tokens for 60 s\", () => {});\n");
    const cdoc9b = S.specDoctor(c9, "coded").checks.find((c) => c.id === "tests-in-code");
    ok(cdoc9b && cdoc9b.status === "pass" && /\(2\)/.test(cdoc9b.detail) && S.traceCheck(c9, "coded", { code: true }).code.plannedNotInCode.length === 0,
      "with a test named T-07 the tests-in-code check passes (both claimed T-IDs found)");
    // The scan is bounded and never enters .specs/, node_modules/ or hidden folders.
    const sc9 = S.scanTestCode(c9);
    ok(sc9.scanned === 7 && !sc9.truncated && ![...sc9.tids.values()].some((e) => e.files.some((f) => /node_modules|\.specs|src\/app\.js/.test(f))),
      "scanTestCode reads only test files (node_modules/, .specs/ outside a feature's tests/ folder and source files skipped)");
    // +tdd removed: its test plan is inactive — no tests-in-code check and no planned-not-in-code finish warning.
    const u9 = S.createFeature(c9, "Untested", ["tdd"]);
    w9f(u9.dir, "tasks.md", "# Tasks\n\n## Phase: Build\n- [x] 1. [US1] Build it\n  - _Requirements: US-1.AC-1_\n  - _Makes green: T-11_\n");
    w9f(u9.dir, "test-plan.md", "| Test ID | Kind | Covers |\n|---|---|---|\n| T-11 | example | US-1.AC-1 |\n");
    const u9Before = S.specDoctor(c9, "untested").checks.some((c) => c.id === "tests-in-code") && S.finishFeature(c9, "untested").warnings.some((w) => /^planned tests/.test(w));
    S.addTrack(c9, "untested", "tdd", { remove: true });
    ok(u9Before && !S.specDoctor(c9, "untested").checks.some((c) => c.id === "tests-in-code") && !S.finishFeature(c9, "untested").warnings.some((w) => /^planned tests/.test(w)),
      "after add_track --remove tdd the inactive test plan raises no tests-in-code check and no planned-not-in-code finish warning");

    // --- review round: one small project per finding ---
    const fx9 = (n) => { const p = path.join(tmp, "proj-wp9-" + n); S.initProject(p, ["tdd"]); return p; };
    const REQ9 = "# Feature: X\n\n## User Stories\n\n### US-1 (P1)\n\n#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN a token expires THE SYSTEM SHALL reject it.\n";
    const TPH9 = "| Test ID | Layer | Kind | Description | Covers | File |\n|---|---|---|---|---|---|\n";
    const DONE9 = (tids) => `# Tasks\n\n## Phase: Build\n- [x] 1. [US1] Build it\n  - _Requirements: US-1.AC-1_\n  - _Makes green: ${tids}_\n`;

    // Without the hyphen a T-ID needs an UPPERCASE T and a zero-padded number: test_t2_is_after_t1 / test_t0_is_epoch are
    // pytest names about time variables — they used to pass T-02's tests-in-code check and report a phantom T-0.
    const k9 = fx9("clock");
    const kf9 = S.createFeature(k9, "Clock", ["tdd"]);
    w9f(kf9.dir, "requirements.md", REQ9);
    w9f(kf9.dir, "tasks.md", DONE9("T-02"));
    w9f(kf9.dir, "test-plan.md", TPH9 + "| T-02 | unit | example | x | US-1.AC-1 | `x` |\n");
    w9f(k9, "tests/test_clock.py", "def test_t2_is_after_t1():\n    assert t2 > t1\n\ndef test_t0_is_epoch():\n    pass\n\ndef testT2(x):\n    pass\n");
    const kc9 = S.traceCheck(k9, "clock", { code: true }).code;
    const kd9 = S.specDoctor(k9, "clock").checks.find((c) => c.id === "tests-in-code");
    ok(JSON.stringify(kc9.testsInCode) === "{}" && kc9.plannedNotInCode.join() === "T-02" && kc9.inCodeNotInPlan.length === 0 && kd9 && kd9.status === "warn" && /: T-02 — /.test(kd9.detail),
      "test_t2_… / test_t0_… / testT2 are not T-IDs: T-02 stays planned-not-in-code (doctor warns), no phantom T-0 (got " + JSON.stringify(kc9) + ")");
    w9f(k9, "tests/test_clock.py", "def test_T02_rejects_a_stale_clock():\n    pass\n");
    ok(S.traceCheck(k9, "clock", { code: true }).code.testsInCode["T-02"].join() === "tests/test_clock.py", "the documented test_T02_ form still names T-02");

    // Test files in F# / Scala / Groovy / Elixir / Dart are read (by name: CodecTests.fs, CodecSpec.scala, codec_test.exs …).
    const g9 = fx9("langs");
    const gf9 = S.createFeature(g9, "Codec", ["tdd"]);
    w9f(gf9.dir, "requirements.md", REQ9);
    w9f(gf9.dir, "test-plan.md", TPH9 + ["T-01", "T-02", "T-03", "T-04", "T-05"].map((t) => `| ${t} | unit | property | round trip | US-1.AC-1 | \`x\` |`).join("\n") + "\n");
    w9f(g9, "src/CodecTests.fs", "[<Property(DisplayName = \"T-01 round trip\")>]\nlet ``T-01 round trip`` (s: string) = decode (encode s) = s\n");
    w9f(g9, "modules/codec/CodecSpec.scala", "class CodecSpec extends AnyFlatSpec { \"T-02 round trip\" should \"hold\" in {} }\n");
    w9f(g9, "lib/codec_test.exs", "test \"T-03 round trip\" do\nend\n");
    w9f(g9, "pkg/codec_test.dart", "test('T-04 round trip', () {});\n");
    w9f(g9, "src/CodecSpec.groovy", "def \"T-05 round trip\"() { expect: true }\n");
    w9f(g9, "src/shader.fs", "// T-06 a fragment shader, not a test\n");
    const gc9 = S.traceCheck(g9, "codec", { code: true }).code;
    ok(gc9.plannedNotInCode.length === 0 && gc9.scanned === 5 && gc9.testsInCode["T-01"].join() === "src/CodecTests.fs" && gc9.testsInCode["T-02"].join() === "modules/codec/CodecSpec.scala" &&
      gc9.testsInCode["T-03"].join() === "lib/codec_test.exs" && gc9.testsInCode["T-04"].join() === "pkg/codec_test.dart" && gc9.testsInCode["T-05"].join() === "src/CodecSpec.groovy" && !gc9.testsInCode["T-06"],
      "F# / Scala / Elixir / Dart / Groovy test files are scanned; a non-test .fs file is not (got " + JSON.stringify(gc9) + ")");

    // +tdd removed: the inactive test plan no longer covers (or cites) EC / NFR / SC — only tasks and quickstart.md do.
    const o9 = fx9("offtdd");
    const of9b = S.createFeature(o9, "Probe", ["tdd"]);
    w9f(of9b.dir, "requirements.md", REQ9 + "\n## Edge Cases\n- **EC-1** — a clock skew of 5 s is tolerated.\n\n## Success Criteria\n- **SC-001** — 99% of refreshes succeed.\n");
    w9f(of9b.dir, "tasks.md", "# Tasks\n\n## Phase: Build\n- [ ] 1. [US1] Reject\n  - _Requirements: US-1.AC-1_\n  - _Makes green: T-01_\n");
    w9f(of9b.dir, "test-plan.md", TPH9 + "| T-01 | unit | example | x | US-1.AC-1, EC-1, SC-001, NFR-9 | `x` |\n");
    const ob9 = S.traceCheck(o9, "probe");
    S.addTrack(o9, "probe", "tdd", { remove: true });
    const oa9 = S.traceCheck(o9, "probe");
    ok(kinds9(ob9) === "phantomSecondary=NFR-9" && oa9.tracks === "core" && kinds9(oa9) === "uncoveredEdgeCases=EC-1 uncoveredSuccessCriteria=SC-001",
      "after add_track --remove tdd the inactive plan's rows neither cover EC-1 / SC-001 nor cite a phantom NFR-9 (got " + kinds9(oa9) + ")");

    // The feature's own .specs/<f>/tests/ (scaffolded by +tdd) is scanned; another feature's never counts; the rest of the
    // feature folder stays unread.
    const s9 = fx9("specs-tests");
    const sl9 = S.createFeature(s9, "Login", ["tdd"]);
    const sb9 = S.createFeature(s9, "Beta", ["tdd"]);
    for (const f of [sl9, sb9]) {
      w9f(f.dir, "requirements.md", REQ9);
      w9f(f.dir, "tasks.md", DONE9("T-01, T-02, T-03"));
      w9f(f.dir, "test-plan.md", "| Test ID | Covers |\n|---|---|\n| T-01 | US-1.AC-1 |\n| T-02 | US-1.AC-1 |\n| T-03 | US-1.AC-1 |\n");
    }
    w9f(sl9.dir, "tests/unit/login.test.js", "test(\"T-01 valid login (US-1.AC-1)\", () => {});\ntest(\"T-02 wrong password\", () => {});\ntest(\"T-03 latency\", () => {});\n");
    w9f(sl9.dir, "notes.test.js", "test(\"T-99 not under tests/\", () => {});\n");
    const slc9 = S.traceCheck(s9, "login", { code: true }).code;
    const sbc9 = S.traceCheck(s9, "beta", { code: true }).code;
    const sld9 = S.specDoctor(s9, "login").checks.find((c) => c.id === "tests-in-code");
    const sbd9 = S.specDoctor(s9, "beta").checks.find((c) => c.id === "tests-in-code");
    ok(slc9.plannedNotInCode.length === 0 && slc9.testsInCode["T-01"].join() === ".specs/login/tests/unit/login.test.js" && slc9.acsInTests.join() === "US-1.AC-1" &&
      slc9.scanned === 1 && !slc9.testsInCode["T-99"] && sld9.status === "pass" && !S.finishFeature(s9, "login").warnings.some((w) => /^planned tests/.test(w)),
      "tests in .specs/login/tests/ count for Login (doctor passes, finish has no planned-not-in-code warning); .specs/login/notes.test.js is not read (got " + JSON.stringify(slc9) + ")");
    ok(sbc9.plannedNotInCode.join() === "T-01,T-02,T-03" && JSON.stringify(sbc9.testsInCode) === "{}" && sbc9.acsInTests.length === 0 && sbd9.status === "warn",
      "Login's .specs tests never satisfy Beta's T-01..T-03 nor its AC (another feature's scaffolded test folder is theirs)");

    // A secondary ID covered on ANY row of the T-ID: a list item's sub-bullets / lazy continuation, or a second table.
    const r9 = fx9("plan-rows");
    const rf9 = S.createFeature(r9, "Adv", ["tdd"]);
    w9f(rf9.dir, "requirements.md", REQ9 + "2. **US-1.AC-2** — WHEN a key rotates THE SYSTEM SHALL keep old tokens for 60 s.\n\n## Success Criteria\n- **SC-001** — 99% of logins succeed.\n\n" +
      "## Non-Functional Requirements\n- **NFR-1** — p95 latency ≤ 300 ms.\n\n## Edge Cases\n- **EC-1** — a clock skew of 5 s is tolerated.\n");
    w9f(rf9.dir, "tasks.md", "# Tasks\n\n## Phase: Build\n- [ ] 1. [US1] Build\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Makes green: T-01, T-02_\n");
    w9f(rf9.dir, "test-plan.md", "# Test Plan\n\n- **T-01** — valid login\n  - Covers: US-1.AC-1, SC-001\n- **T-02** — latency, covers US-1.AC-2\nand the skew window EC-1\n\n  - Covers: NFR-1\n\nProse about NFR-9 is not a test row.\n");
    const rl9 = S.traceCheck(r9, "adv");
    w9f(rf9.dir, "test-plan.md", "| Test ID | Covers |\n|---|---|\n| T-01 | US-1.AC-1 |\n| T-02 | US-1.AC-2, EC-1 |\n\n## Non-functional checks\n\n| Test ID | Check | Covers |\n|---|---|---|\n| T-02 | p95 | NFR-1, SC-001 |\n");
    const rt9 = S.traceCheck(r9, "adv");
    ok(rl9.verdict === "pass" && rl9.warnings.length === 0 && rt9.verdict === "pass" && rt9.warnings.length === 0,
      "EC/NFR/SC on a list item's sub-bullet / lazy continuation, or on a T-ID's row in a second table, are covered; prose isn't a row (got " + kinds9(rl9) + " | " + kinds9(rt9) + ")");

    // A concrete File cell scopes the T-ID to that file / folder (project- or feature-relative): another feature's T-01
    // test no longer passes it. A template slot falls back to the project-wide number match; a non-code artifact alone
    // (load-test.md) is run outside test code — plannedOutsideCode, never planned-not-in-code (it may still be found by number).
    const f9 = fx9("scoped");
    S.createFeature(f9, "Alpha", ["tdd"]);
    const fb9 = S.createFeature(f9, "Beta", ["tdd"]);
    w9f(fb9.dir, "requirements.md", REQ9);
    w9f(fb9.dir, "tasks.md", DONE9("T-01, T-02, T-03, T-04, T-05"));
    w9f(fb9.dir, "test-plan.md", TPH9 + "| T-01 | unit | example | x | US-1.AC-1 | `tests/beta.test.js` |\n| T-02 | unit | example | x | US-1.AC-1 | `tests/unit/...` |\n" +
      "| T-03 | unit | example | x | US-1.AC-1 | `tests/beta/` |\n| T-04 | unit | example | x | US-1.AC-1 | `tests/unit/beta.test.js::test_T04` |\n| T-05 | load | example | x | US-1.AC-1 | `load-test.md` |\n");
    w9f(f9, "tests/alpha.test.js", ["T-01", "T-02", "T-03", "T-04", "T-05"].map((t) => `test("${t} alpha", () => {});`).join("\n") + "\n");
    const fc9 = S.traceCheck(f9, "beta", { code: true }).code;
    const fd9 = S.specDoctor(f9, "beta").checks.find((c) => c.id === "tests-in-code");
    ok(fc9.plannedNotInCode.join() === "T-01,T-03,T-04" && !fc9.testsInCode["T-01"] && fc9.testsInCode["T-02"].join() === "tests/alpha.test.js" && fc9.testsInCode["T-05"].join() === "tests/alpha.test.js" &&
      fc9.plannedOutsideCode.join() === "T-05" && fd9.status === "warn" && /: T-01, T-03, T-04 — put the T-ID in a test's name .*File column/.test(fd9.detail),
      "Alpha's tests don't satisfy Beta's T-01 / T-03 / T-04 (concrete File cells); T-02 (template slot) matches by number; T-05 (load-test.md) is outside test code (got " + JSON.stringify(fc9) + ")");
    w9f(f9, "tests/beta.test.js", "test(\"T-01 beta\", () => {});\n");
    w9f(f9, "tests/beta/rotate.test.js", "test(\"T-03 beta\", () => {});\n");
    w9f(fb9.dir, "tests/unit/beta.test.js", "test(\"T-04 beta\", () => {});\n");
    const fc9b = S.traceCheck(f9, "beta", { code: true }).code;
    ok(fc9b.plannedNotInCode.length === 0 && fc9b.testsInCode["T-01"].join() === "tests/beta.test.js" && fc9b.testsInCode["T-03"].join() === "tests/beta/rotate.test.js" &&
      fc9b.testsInCode["T-04"].join() === ".specs/beta/tests/unit/beta.test.js" && S.specDoctor(f9, "beta").checks.find((c) => c.id === "tests-in-code").status === "pass",
      "the named file, a file under the named folder and the feature-relative path (with a ::test suffix) satisfy the scoped T-IDs; doctor passes");
    const fp9 = S.createFeature(f9, "Pagamentos", ["tdd"], undefined, undefined, "pt");
    w9f(fp9.dir, "test-plan.md", "| Test ID | Camada | Tipo | Descrição | Cobre (AC IDs) | Ficheiro |\n|---|---|---|---|---|---|\n| T-01 | unit | example | x | US-1.AC-1 | `tests/pagamentos.test.js` |\n");
    const fpc9 = S.traceCheck(f9, "pagamentos", { code: true }).code;
    ok(fpc9.plannedNotInCode.join() === "T-01" && JSON.stringify(fpc9.testsInCode).indexOf("T-01") === -1 &&
      /no ficheiro que a coluna Ficheiro do plano indica/.test(S.msg("pt").deepTrace.testsInCodeMissing("T-01")),
      "PT: a concrete Ficheiro cell scopes T-01 too (Alpha's / Beta's T-01 tests don't satisfy it); the PT advice names the Ficheiro column");

    // Round 2: the File cell matches whole path segments at the end of the test's path — a bare file name and a path
    // relative to a monorepo package satisfy the T-ID; a partial name doesn't; a file the scan never reads scopes nothing.
    const sx9 = fx9("suffix");
    const sxl9 = S.createFeature(sx9, "Login", ["tdd"]);
    w9f(sxl9.dir, "requirements.md", REQ9);
    w9f(sxl9.dir, "tasks.md", DONE9("T-01, T-02, T-03, T-04"));
    w9f(sxl9.dir, "test-plan.md", TPH9 + "| T-01 | unit | example | x | US-1.AC-1 | `login.test.ts` |\n| T-02 | unit | example | x | US-1.AC-1 | `tests/unit/session.test.ts` |\n" +
      "| T-03 | unit | example | x | US-1.AC-1 | `token.test.ts` |\n| T-04 | load | example | x | US-1.AC-1 | `tests/load/checkout-load.md` |\n");
    w9f(sx9, "src/auth/login.test.ts", "test(\"T-01 rejects an expired token\", () => {});\n");
    w9f(sx9, "packages/api/tests/unit/session.test.ts", "test(\"T-02 keeps the session\", () => {});\n");
    w9f(sx9, "src/auth/oldtoken.test.ts", "test(\"T-03 not this one\", () => {});\n");
    w9f(sx9, "tests/load/checkout.k6.js", "// T-04 load test\n");
    const sxc9 = S.traceCheck(sx9, "login", { code: true }).code;
    const sxd9 = S.specDoctor(sx9, "login").checks.find((c) => c.id === "tests-in-code");
    ok(sxc9.testsInCode["T-01"].join() === "src/auth/login.test.ts" && sxc9.testsInCode["T-02"].join() === "packages/api/tests/unit/session.test.ts" &&
      sxc9.testsInCode["T-04"].join() === "tests/load/checkout.k6.js" && sxc9.plannedNotInCode.join() === "T-03" && sxd9.status === "warn" && /: T-03 — /.test(sxd9.detail),
      "a bare file name and a package-relative File cell satisfy T-01 / T-02; `token.test.ts` doesn't match oldtoken.test.ts; a .md under tests/ scopes nothing (got " + JSON.stringify(sxc9) + ")");
    // (1.25.1 review: ES says "fichero" for a file — the feature plan's column is Fichero too now; a plan scaffolded before says
    // Archivo, which the column reader still takes)
    const esPlan9 = S.createFeature(sx9, "Plan ES", ["tdd"], undefined, undefined, "es").dir;
    ok(/columna Fichero \(o Archivo, en un plan más antiguo\) del plan/.test(S.msg("es").deepTrace.testsInCodeMissing("T-01")) &&
      /\| Fichero \|/.test(fs.readFileSync(path.join(S.createFeature(sx9, "Fallo", ["tdd"], undefined, undefined, "es", "bugfix").dir, "test-plan.md"), "utf8")) &&
      /\| Fichero \|/.test(fs.readFileSync(path.join(esPlan9, "test-plan.md"), "utf8")),
      "ES advice names both spellings of the column (the ES feature and bugfix plans say Fichero, an older plan Archivo)");

    // A row whose File column names only a non-code artifact (the scaffold's own load row `load-test.md`, its eval rows
    // `evals/*.json`, a Gherkin .feature) is run outside test code: plannedOutsideCode, never plannedNotInCode — a done
    // load / eval task used to leave a permanent tests-in-code warning (doctor, spec_finish) whose advice ("the file the
    // File column names") pointed at a file no scan reads. A code path outside a test folder, a scoped test folder next to
    // the artifact, or a template slot keeps the T-ID expected in code.
    const ol9 = fx9("outside");
    const olTask = (slug, marker) => S.taskBlocks(fs.readFileSync(path.join(ol9, ".specs", slug, "tasks.md"), "utf8"))
      .find((b) => [b.text, ...(b.body || [])].join("\n").includes(marker)).number;
    S.createFeature(ol9, "Tenant billing", ["tdd", "saas"]);
    S.createFeature(ol9, "Chat assist", ["tdd", "ai"]);
    const olLoad = S.completeTask(ol9, "tenant-billing", olTask("tenant-billing", "_Makes green: T-07_"), { command: "k6 run load/invoice.k6.js", exitCode: 0, summary: "p95=142ms" });
    const olEval = S.completeTask(ol9, "chat-assist", olTask("chat-assist", "_Makes green: T-06, T-07_"), { command: "node mcp/evals/run-evals.js chat-assist", exitCode: 0, summary: "golden 10/10" });
    const olTb = S.traceCheck(ol9, "tenant-billing", { code: true }).code;
    const olCa = S.traceCheck(ol9, "chat-assist", { code: true }).code;
    const olTip = (slug) => S.specDoctor(ol9, slug).checks.find((c) => c.id === "tests-in-code");
    const olFinWarn = (slug) => S.finishFeature(ol9, slug).warnings.filter((w) => /^planned tests/.test(w)).join(" ");
    ok(olLoad.ok && olEval.ok && olTb.plannedOutsideCode.join() === "T-07" && !olTb.plannedNotInCode.includes("T-07") && olTb.plannedNotInCode.length === 6 &&
      olCa.plannedOutsideCode.join() === "T-06,T-07" && !olCa.plannedNotInCode.some((t) => t === "T-06" || t === "T-07") &&
      olTip("tenant-billing") === undefined && olTip("chat-assist") === undefined && !/T-07/.test(olFinWarn("tenant-billing")) && !/T-0[67]/.test(olFinWarn("chat-assist")),
      "the scaffold's load (load-test.md) and eval (evals/*.json) rows are run outside test code: their done tasks raise no tests-in-code warning in doctor or finish (got " +
      JSON.stringify([olTb.plannedOutsideCode, olCa.plannedOutsideCode, olTip("tenant-billing"), olFinWarn("tenant-billing")]) + ")");
    const olMix = S.createFeature(ol9, "Mixed", ["tdd"]);
    w9f(olMix.dir, "requirements.md", REQ9);
    w9f(olMix.dir, "test-plan.md", TPH9 + "| T-01 | load | example | x | US-1.AC-1 | `load/invoice.k6.js` |\n| T-02 | load | example | x | US-1.AC-1 | `load-test.md`, `tests/load/` |\n" +
      "| T-03 | load | example | x | US-1.AC-1 | `load-test.md` |\n| T-04 | e2e | example | x | US-1.AC-1 | `features/checkout.feature` |\n| T-05 | unit | example | x | US-1.AC-1 | `[path]` |\n" +
      "| T-06 | load | example | x | US-1.AC-1 | `load-test.md` |\n\n- T-06 — the same load check, listed again outside the table\n");
    const olMc = S.traceCheck(ol9, "mixed", { code: true }).code;
    ok(olMc.plannedOutsideCode.join() === "T-03,T-04" && olMc.plannedNotInCode.join() === "T-01,T-02,T-05,T-06",
      "only rows naming non-code artifacts alone are outside test code: a code path outside a test folder, a scoped test folder, a template slot or a second row without a File cell keep the T-ID expected (got " + JSON.stringify(olMc) + ")");
  }

  {
    // --- 1.13 WP12: secondary IDs in append_tasks, fenced/commented IDs in trace, _Implements:_ globs, SPECS.md from the
    // hook, bugfix impact via bug.md, legacy bugfix approvals, and the per-call read cache ---
    const call12 = async (name, args) => { const r = await rpc("tools/call", { name, arguments: args }); let p; try { p = payload(r); } catch { p = { error: r.result.content[0].text }; } return { isError: r.result.isError === true, p }; };
    const hookJs12 = path.join(__dirname, "..", "hooks", "spec-hook.js");
    const post12 = (file) => { const r = spawnSync(process.execPath, [hookJs12], { input: JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: file } }), encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" } });
      try { return JSON.parse(r.stdout).hookSpecificOutput.additionalContext; } catch { return ""; } };
    const put12 = (dir, rel, s) => { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); return p; };

    // (1) spec_append_tasks accepts the EC-n / NFR-n / SC-nnn IDs requirements.md writes; (2) an ID that only sits in a
    // fenced example or an HTML comment is not one of the feature's IDs — for append, trace, the secondary trace and _Supersedes:_.
    const a12 = path.join(tmp, "proj-wp12-append");
    S.initProject(a12, ["core"], "en");
    S.createFeature(a12, "Login", ["core"]);
    const req12 = ["# Feature: Login", "", "## Summary", "Sign in.", "", "### US-1 (P1)", "", "#### Acceptance Criteria (EARS)",
      "1. **US-1.AC-1** — WHEN a user signs in THE SYSTEM SHALL create a session", "", "Format example:", "```md",
      "2. **US-1.AC-9** — WHEN x THE SYSTEM SHALL y _Supersedes: nope/US-1.AC-1_", "- **EC-7** — an example edge case", "| US-1.AC-6 | a table row in the example |", "```", "",
      "<!-- 3. **US-1.AC-8** — WHEN a THE SYSTEM SHALL b (commented) -->", "", "## Edge Cases", "- **EC-2** — a locked account is refused.", "",
      "## Non-Functional Requirements", "- **NFR-1** — p95 under 300 ms.", "", "## Success Criteria", "- **SC-001** — 99% of sign-ins succeed.", ""].join("\n");
    const l12 = path.join(a12, ".specs", "login");
    fs.writeFileSync(path.join(l12, "requirements.md"), req12);
    fs.writeFileSync(path.join(l12, "tasks.md"), "# Tasks\n\n## Phase: Build\n- [ ] 1. [US1] Sessions\n  - _Requirements: US-1.AC-1_\n**Checkpoint:** sign-in works.\n");
    const ap12 = await call12("spec_append_tasks", { name: "login", tasks: [{ text: "Lock the account", requirements: ["US-1.AC-1", "EC-2"] }], projectDir: a12 });
    const ap12b = S.appendTasks(a12, "login", [{ text: "Keep it fast", requirements: ["ec-2", "nfr-1", "SC-1"] }]);
    const t12 = fs.readFileSync(path.join(l12, "tasks.md"), "utf8");
    ok(!ap12.isError && ap12.p.ok && ap12.p.appended[0].requirements.join() === "US-1.AC-1,EC-2" && ap12b.ok && ap12b.appended[0].requirements.join() === "EC-2,NFR-1,SC-1" &&
      t12.includes("- [ ] 2. Lock the account\n  - _Requirements: US-1.AC-1, EC-2_\n") && t12.includes("- [ ] 3. Keep it fast\n  - _Requirements: EC-2, NFR-1, SC-1_\n"),
      "spec_append_tasks accepts the secondary IDs requirements.md writes (EC-2, NFR-1, SC-1 → SC-001), normalized to upper case, alongside AC IDs (MCP = engine)");
    const refused12 = ["EC-3", "EC-7", "US-1.AC-9", "US-1.AC-8"].map((id) => S.appendTasks(a12, "login", [{ text: "x", requirements: ["US-1.AC-1", id] }]));
    const ref12Mcp = await call12("spec_append_tasks", { name: "login", tasks: [{ text: "x", requirements: ["NFR-2"] }], projectDir: a12 });
    ok(refused12.every((r, i) => r.ok === false && r.phantom.join() === ["EC-3", "EC-7", "US-1.AC-9", "US-1.AC-8"][i] && /Unknown acceptance criteria/.test(r.error)) &&
      ref12Mcp.isError && /NFR-2/.test(ref12Mcp.p.error) && fs.readFileSync(path.join(l12, "tasks.md"), "utf8") === t12,
      "an ID requirements.md never writes (EC-3, NFR-2) — or writes only inside a fenced example (EC-7, US-1.AC-9) or a comment (US-1.AC-8) — is still refused; nothing written");
    const tr12 = S.traceCheck(a12, "login");
    ok(tr12.totalAcs === 1 && tr12.uncoveredByTasks.length === 0 && tr12.verdict === "pass" && tr12.phantomSecondary.length === 0 && tr12.uncoveredEdgeCases.length === 0 &&
      tr12.uncoveredNfr.length === 0 && tr12.uncoveredSuccessCriteria.join() === "SC-001" && tr12.supersedes.length === 0 && tr12.phantomSupersedes.length === 0,
      "trace_check: ACs only in a fenced example (US-1.AC-9, a table row US-1.AC-6) or a comment (US-1.AC-8) are not required; EC-2/NFR-1 covered by the appended tasks; a fenced _Supersedes:_ is no marker (got totalAcs=" + tr12.totalAcs + ")");
    fs.appendFileSync(path.join(l12, "tasks.md"), "- [ ] 4. Example edge\n  - _Requirements: EC-7_\n");
    ok(S.traceCheck(a12, "login").phantomSecondary.join() === "EC-7" && !S.traceCheck(a12, "login").uncoveredEdgeCases.includes("EC-7"),
      "a secondary ID written only in a fenced example is not defined: citing it is a phantom, and it is never 'uncovered'");
    S.createFeature(a12, "Fenced", ["core"]);
    fs.writeFileSync(path.join(a12, ".specs", "fenced", "requirements.md"), "## Summary\nX.\n\n### US-1 (P1)\n\n#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n\n" +
      "Example:\n```md\n1. **US-1.AC-1** — WHEN c THE SYSTEM SHALL d\n- **SC-001** — 90% of users finish in 1 minute\n```\n");
    const fdoc12 = S.specDoctor(a12, "fenced").checks;
    const fchk12 = (id) => (fdoc12.find((c) => c.id === id) || {}).status;
    ok(fchk12("ac-uniqueness") === "pass" && fchk12("success-criteria") === "warn" && fchk12("priorities") === "pass",
      "doctor reads requirements.md the same way: an AC repeated in a fenced example is no duplicate definition, an SC only in the example is no success criterion");

    // (3) a glob in _Implements:_ resolves against the project (the one glob): present when it matches a file; otherwise the
    // existing rule (done → missing, open → planned); never outside the project.
    const g12 = path.join(tmp, "proj-wp12-glob");
    S.initProject(g12, ["core"], "en");
    const gf12 = S.createFeature(g12, "Api", ["core"]);
    ["src/api/users.ts", "src/api/v2/orders.ts", "lib/a.js", "lib/sub/b.js", "docs/guide.md"].forEach((f) => put12(g12, f, "x\n"));
    put12(path.join(tmp, "outside-wp12"), "x.js", "x\n");
    fs.writeFileSync(path.join(gf12.dir, "requirements.md"), "## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n");
    const absGlob12 = path.join(g12, "lib", "*.js").replace(/\\/g, "/");
    fs.writeFileSync(path.join(gf12.dir, "tasks.md"), ["- [x] 1. api", "  - _Requirements: US-1.AC-1_", "  - _Implements: src/api/**, lib/*.js, `./docs/*.md`_",
      "- [x] 2. web", "  - _Implements: src/web/**, lib/*.ts_", "- [ ] 3. jobs", "  - _Implements: src/jobs/*.ts_",
      "- [x] 4. escape", "  - _Implements: ../outside-wp12/*.js_", "- [ ] 5. escape, open", "  - _Implements: ../outside-wp12/**_",
      "- [ ] 6. absolute, in the project", "  - _Implements: " + absGlob12 + "_", ""].join("\n"));
    const gt12 = (await call12("trace_check", { name: "api", projectDir: g12 })).p;
    ok(gt12.verdict === "gaps-found" && gt12.missingImplFiles.join() === "src/web/**,lib/*.ts,../outside-wp12/*.js,../outside-wp12/**" && gt12.plannedImplFiles.join() === "src/jobs/*.ts" &&
      gt12.implementsFiles.length === 9,
      "trace_check: src/api/** · lib/*.js · ./docs/*.md · an absolute in-project glob are present; src/web/** and lib/*.ts ('*' stays in its folder) of a done task are missing, an open task's glob is planned; a glob out of the project is missing, never planned (got missing=" + gt12.missingImplFiles.join("|") + " planned=" + gt12.plannedImplFiles.join("|") + ")");
    const gl12 = (p) => S.globFiles(g12, p).files.join();
    ok(gl12("lib/*.js") === "lib/a.js" && gl12("lib/**/*.js") === "lib/a.js,lib/sub/b.js" && gl12("src/**/*.ts") === "src/api/users.ts,src/api/v2/orders.ts" && gl12("src/api/*") === "src/api/users.ts" &&
      S.globFiles(g12, "../outside-wp12/*.js").outside === true && S.globFiles(g12, "/etc/*").outside === true && gl12("../outside-wp12/*.js") === "" && gl12("nope/**") === "" &&
      S.globFiles(g12, absGlob12).files.join() === "lib/a.js",
      "globFiles: '*' stays in one folder, '**' crosses them; a pattern that leaves the project (.., another absolute path) matches nothing and says so");
    const gc12 = S.coverage(g12);
    ok(gc12.coveredFiles === 3 && gc12.codeFiles === 4 && gc12.unmatchedImplements.map((u) => u.ref).join() === "src/web/**,lib/*.ts,src/jobs/*.ts,../outside-wp12/*.js,../outside-wp12/**" &&
      gc12.nonCodeImplements.map((u) => u.ref).join() === "./docs/*.md",
      "coverage reads the same globs (src/api/** and lib/*.js cover 3 of 4 code files; the absolute in-project glob too); nothing outside the project counts");

    // (3) a glob reaches the finish baseline: a READY bugfix whose fix task implements `src/lib/*.ts`.
    const fz12 = path.join(tmp, "proj-wp12-finish");
    S.initProject(fz12, ["tdd"]);
    ["src/auth.js", "src/lib/x.ts", "src/lib/y.ts", "src/lib/z.js"].forEach((f) => put12(fz12, f, f + "\n"));
    const fb12 = S.createFeature(fz12, "Login Loop", undefined, "users bounce back to /login", undefined, "en", "bugfix");
    const fill12 = (rel, pairs) => { const fp = path.join(fb12.dir, rel); let t = fs.readFileSync(fp, "utf8"); pairs.forEach(([x, y]) => { t = t.split(x).join(y); }); fs.writeFileSync(fp, t); };
    fill12("requirements.md", [["[the condition that triggers the bug]", "the refresh token has expired"], ["[the correct behavior]", "clear the session cookie before redirecting to /login"],
      ["[the neighbouring behavior that already worked]", "a login with a valid refresh token"], ["[nearby inputs that must keep working]", "a token that expires mid-request"]]);
    fill12("test-plan.md", [["[unit/integration]", "integration"], ["`[path]`", "`tests/integration/auth.test.js`"]]);
    fill12("tasks.md", [["[command that runs T-01]", "node --test tests/integration/auth.test.js"], ["[exact values the fix must respect — versions, limits, formats]", "Node >= 20"], ["_Verify: [full test suite command]_", "_Verify: npm test_\n  - _Implements: src/auth.js, src/lib/*.ts_"]]);
    fill12("bug.md", [["[correct behavior]", "the dashboard opens"], ["[what happens — error message, output, log lines]", "302 back to /login in a loop"],
      ["> **TODO** — exact steps, input and environment that reproduce it every time.", "Log in with an expired refresh token."],
      ["> **TODO** — the cause, with evidence (stack trace, log, failing assertion, the change that introduced it). Not \"probably\".", "The refresh handler redirects before clearing the cookie (auth.js:88)."],
      ["[What changes and why it removes the root cause — one fix, not a bundle.]", "Clear the cookie before redirecting."]]);
    S.completeTask(fz12, "login-loop", 1, { command: "node --test tests/integration/auth.test.js", exitCode: 1, summary: "T-01 fails: 302 back to /login" }); // the red run (_Expect: fail_)
    S.completeTask(fz12, "login-loop", 2, { command: "npm test", exitCode: 0, summary: "42/42 passing" });
    ["requirements", "design", "test-plan", "tasks"].forEach((p) => S.approvePhase(fz12, "login-loop", p));
    const fin12 = S.finishFeature(fz12, "login-loop", { write: true });
    const fst12 = JSON.parse(fs.readFileSync(path.join(fb12.dir, ".state.json"), "utf8"));
    ok(fin12.readyToFinish && fin12.baseline && fin12.baseline.recorded && Object.keys(fst12.finished.files).join() === "src/auth.js,src/lib/x.ts,src/lib/y.ts" && S.drift(fz12).verdict === "clean",
      "finish {write}: a glob in _Implements:_ (trace_check reads it as present) records the files it matches in the drift baseline (got " + Object.keys((fst12.finished || {}).files || {}).join() + ")");

    // (4) PostToolUse: a hand edit of a spec artifact refreshes .specs/SPECS.md when it exists and is generated — never a
    // hand-written one, never creating one, never on an edit of SPECS.md itself. 1.24 r6 I-I1: the save leaves a stamp and the
    // refresh runs at the end of the turn (the Stop hook) — stop12.
    const h12 = path.join(tmp, "proj-wp12-hook");
    S.initProject(h12, ["core"], "en");
    const hf12 = S.createFeature(h12, "Billing", ["core"]);
    const hReq12 = path.join(hf12.dir, "requirements.md");
    const stop12 = () => spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "stop-hook.js")], { input: JSON.stringify({ hook_event_name: "Stop", cwd: h12, last_assistant_message: "Here it is." }),
      encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" } });
    fs.writeFileSync(hReq12, "# Requirements\n\n## Summary\nBilling.\n\n### US-1 (P1)\n\n#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN a user pays THE SYSTEM SHALL store the receipt\n");
    const specsMd12 = path.join(h12, ".specs", "SPECS.md");
    const noCat12 = post12(hReq12);
    stop12();
    const created12 = fs.existsSync(specsMd12);
    S.catalog(h12, { write: true });
    fs.appendFileSync(hReq12, "2. **US-1.AC-2** — WHEN a refund is asked THE SYSTEM SHALL refund within 30 days\n");
    const out12 = post12(hReq12);
    const waited12 = !fs.readFileSync(specsMd12, "utf8").includes("US-1.AC-2"); // the save itself leaves SPECS.md (the stamp)
    stop12();
    const cat12 = fs.readFileSync(specsMd12, "utf8");
    ok(!created12 && /criteria/.test(noCat12) && /criteria|clean/i.test(out12) && waited12 && cat12.includes("**US-1.AC-2** — WHEN a refund is asked THE SYSTEM SHALL refund within 30 days") && /AUTO-GENERATED by dev-spec/.test(cat12),
      "PostToolUse on requirements.md reports the EARS check and leaves a generated SPECS.md to the end of the turn — the Stop hook refreshes it with the new AC; without SPECS.md it creates none");
    const edited12 = cat12.replace("# Spec catalog", "# Spec catalog (edited)");
    fs.writeFileSync(specsMd12, edited12);
    post12(specsMd12);
    stop12();
    const kept12 = fs.readFileSync(specsMd12, "utf8") === edited12;
    fs.writeFileSync(specsMd12, "# My own catalog\n");
    fs.appendFileSync(hReq12, "3. **US-1.AC-3** — WHEN z THE SYSTEM SHALL w\n");
    post12(hReq12);
    stop12();
    ok(kept12 && fs.readFileSync(specsMd12, "utf8") === "# My own catalog\n",
      "an edit of SPECS.md itself is not a reason to rewrite it; a hand-written SPECS.md (no marker) is never replaced by the hook's refresh");

    // (5) spec_impact --phase requirements on a bugfix: the sections that mention a changed AC come from bug.md too.
    const i12 = path.join(tmp, "proj-wp12-impact");
    S.initProject(i12, ["core"], "en");
    const ib12 = S.createFeature(i12, "Crash", undefined, "crash on save", undefined, "en", "bugfix");
    const iReq12 = path.join(ib12.dir, "requirements.md");
    const iReqText12 = fs.readFileSync(iReq12, "utf8").replace("[the condition that triggers the bug]", "the file is read-only").replace("[the correct behavior]", "show an error")
      .replace("[the neighbouring behavior that already worked]", "saving a writable file");
    fs.writeFileSync(iReq12, iReqText12);
    const iBug12 = path.join(ib12.dir, "bug.md");
    fs.writeFileSync(iBug12, fs.readFileSync(iBug12, "utf8").replace(/> \*\*TODO\*\* — the cause[^\n]*/, "The save handler ignores EACCES (US-1.AC-1).")
      .replace("[What changes and why it removes the root cause — one fix, not a bundle.]", "Catch EACCES and report it (US-1.AC-1); writable saves are untouched (US-1.AC-2)."));
    S.approvePhase(i12, "crash", "requirements", undefined, { force: true });
    fs.writeFileSync(iReq12, iReqText12.replace("show an error", "show a clear error"));
    const im12 = (await call12("spec_impact", { name: "crash", projectDir: i12 })).p;
    S.addTrack(i12, "crash", "saas");
    const iDes12 = path.join(ib12.dir, "design.md");
    fs.writeFileSync(iDes12, fs.readFileSync(iDes12, "utf8").replace(/(## \[SaaS\] Performance Budget[^\n]*\n)/, "$1The error path answers in 50 ms (US-1.AC-1).\n"));
    const im12b = S.impactReport(i12, "crash", { phase: "requirements" });
    const secs12 = (r) => ((r.impacted || []).find((x) => x.id === "US-1.AC-1") || { designSections: [] }).designSections.join("|");
    ok(im12.ok && im12.modified.map((m) => m.id).join() === "US-1.AC-1" && secs12(im12) === "bug.md: Root Cause|bug.md: Fix" &&
      secs12(im12b) === "bug.md: Root Cause|bug.md: Fix|design.md: [SaaS] Performance Budget" && /design: bug\.md: Root Cause, bug\.md: Fix/.test(S.impactLines(im12).join("\n")),
      "spec_impact --phase requirements on a bugfix names the bug.md sections that mention the changed AC (Root Cause, Fix) — and a track's design.md section, each keyed by its file");

    // (6) approvals with no fingerprint are never judged by a file's date alone as a finish blocker — a clone, checkout, copy
    // or unzip resets every mtime. A pre-1.13 bugfix design approval (no fingerprint, no file) signed off bug.md, which 1.12
    // never tracked: untracked — no change anywhere (doctor, next_action, finish), a finish warning to re-approve, impact
    // baseline `none`. A pre-1.11 feature approval keeps its date check where 1.12 had it (next_action, doctor), but on
    // finish that's a warning, never a blocker.
    const o12 = path.join(tmp, "proj-wp12-legacy");
    S.initProject(o12, ["core"], "en");
    const ob12 = S.createFeature(o12, "Old Crash", undefined, "crash", undefined, "en", "bugfix");
    const of12 = S.createFeature(o12, "Old Feature", ["core"]);
    const at12 = new Date(Date.now() - 3600e3);
    const legacy12 = (dir) => { const sf = path.join(dir, ".state.json"); fs.writeFileSync(sf, JSON.stringify({ ...JSON.parse(fs.readFileSync(sf, "utf8")), approvals: { design: { at: at12.toISOString(), by: "x" } } })); };
    legacy12(ob12.dir);
    legacy12(of12.dir);
    const before12 = new Date(at12.getTime() - 3600e3), after12 = new Date(at12.getTime() + 60e3);
    fs.utimesSync(path.join(ob12.dir, "bug.md"), before12, before12);
    fs.utimesSync(path.join(of12.dir, "design.md"), before12, before12);
    const csF0 = S.nextAction(o12, "old-feature").changedSinceApproval.join();
    // A fresh clone: every file dated now, content unchanged.
    fs.utimesSync(path.join(ob12.dir, "bug.md"), after12, after12);
    fs.utimesSync(path.join(of12.dir, "design.md"), after12, after12);
    const finB12 = S.finishFeature(o12, "old-crash"), finF12 = S.finishFeature(o12, "old-feature");
    const docB12 = S.specDoctor(o12, "old-crash").checks.find((c) => c.id === "changed-since-approval");
    const docF12 = S.specDoctor(o12, "old-feature").checks.find((c) => c.id === "changed-since-approval") || {};
    const naB12 = S.nextAction(o12, "old-crash"), naF12 = S.nextAction(o12, "old-feature");
    const imB12 = S.impactReport(o12, "old-crash", { phase: "design" });
    ok(csF0 === "" && finB12.changedSinceApproval.join() === "" && !finB12.blockers.some((b) => /changed after their approval/.test(b)) && !docB12 &&
      naB12.changedSinceApproval.join() === "" && naB12.step !== "re-review" &&
      finB12.warnings.some((w) => /approved before change tracking/.test(w) && /design \(bug\.md\)/.test(w)) && imB12.baseline === "none" && imB12.changed === null,
      "a 1.12 bugfix design approval (no fingerprint, no file) on a fresh clone: bug.md is untracked — no change in finish / doctor / next_action, a finish warning to re-approve; impact baseline none (changed unknown)");
    ok(naF12.changedSinceApproval.join() === "design.md" && /design\.md/.test(docF12.detail || "") && finF12.changedSinceApproval.join() === "" &&
      !finF12.blockers.some((b) => /changed after their approval/.test(b)) && finF12.warnings.some((w) => /^judged by file date only .*: design\.md — re-review/.test(w)) &&
      /^avaliado só pela data/.test(S.msg("pt").finish.changedByDate("x", "y")) && /^juzgado solo por la fecha/.test(S.msg("es").finish.changedByDate("x", "y")) &&
      /^aprovado antes do registo/.test(S.msg("pt").finish.untrackedApproval("x", "y")) && /^aprobado antes del registro/.test(S.msg("es").finish.untrackedApproval("x", "y")),
      "a pre-1.11 feature approval (no fingerprint): a newer design.md still shows in next_action / doctor (1.12 parity) but is only a finish WARNING (a date is no evidence); PT/ES messages");
    // Re-approving records a fingerprint: from then on it's judged by content (no warning for it any more).
    S.approvePhase(o12, "old-crash", "design", "x", { force: true });
    ok(!S.finishFeature(o12, "old-crash").warnings.some((w) => /approved before change tracking/.test(w)), "re-approving the legacy bugfix design approval starts tracking bug.md — the warning is gone");
    // The 1.12 → 1.13 path: a bugfix approved in 1.12 (no design.md then), then add_track +saas creates design.md.
    const ob12b = S.createFeature(o12, "Older Crash", undefined, "crash", undefined, "en", "bugfix");
    const noDesign12 = !fs.existsSync(path.join(ob12b.dir, "design.md"));
    legacy12(ob12b.dir);
    for (const f of fs.readdirSync(ob12b.dir)) if (f.endsWith(".md")) fs.utimesSync(path.join(ob12b.dir, f), before12, before12);
    const csT0 = S.finishFeature(o12, "older-crash").changedSinceApproval.join();
    const addT12 = S.addTrack(o12, "older-crash", "saas");
    const csT1 = S.finishFeature(o12, "older-crash").changedSinceApproval.join(), naT1 = S.nextAction(o12, "older-crash").changedSinceApproval.join();
    const docT12 = S.specDoctor(o12, "older-crash").checks.find((c) => c.id === "changed-since-approval") || {};
    ok(noDesign12 && csT0 === "" && addT12.ok && fs.existsSync(path.join(ob12b.dir, "design.md")) && csT1 === "design.md" && naT1 === "design.md" && /design\.md/.test(docT12.detail || ""),
      "a legacy bugfix design approval + add_track +saas: the design.md created since is reported as changed by finish, next_action and doctor (got " + [csT0, csT1, naT1].join(" / ") + ")");

    // (7) the per-call read cache: each file read once per call, a write inside the call is seen by the refresh after it
    // (create, complete, archive, rename), and nothing carries over to the next call.
    const r12 = path.join(tmp, "proj-wp12-cache");
    S.initProject(r12, ["tdd"], "en");
    for (let i = 1; i <= 8; i++) S.createFeature(r12, "Feature " + i, ["tdd"]);
    const rawRead12 = fs.readFileSync;
    const reads12 = new Map();
    fs.readFileSync = function (p) { const k = path.resolve(String(p)).toLowerCase(); reads12.set(k, (reads12.get(k) || 0) + 1); return rawRead12.apply(this, arguments); };
    let rm12, cr12, tc12;
    try {
      rm12 = S.writeRoadmapMd(r12);
      const rmReads = new Map(reads12);
      reads12.clear();
      cr12 = S.createFeature(r12, "Feature 9", ["tdd"]);
      const crReads = new Map(reads12);
      reads12.clear();
      tc12 = S.traceCheck(r12, "feature-3");
      const tcReads = new Map(reads12);
      reads12.set("rm", rmReads).set("cr", crReads).set("tc", tcReads);
    } finally {
      fs.readFileSync = rawRead12;
    }
    const rmR = reads12.get("rm"), crR = reads12.get("cr"), tcR = reads12.get("tc");
    const twice = (m, filter) => [...m].filter(([k, n]) => n > 1 && (!filter || filter(k))).map(([k, n]) => path.basename(path.dirname(k)) + "/" + path.basename(k) + "×" + n);
    const otherFeature = (k) => /[\\/]feature-[1-8][\\/]/.test(k);
    ok(rm12.ok && twice(rmR).length === 0 && [...rmR.values()].reduce((a, b) => a + b, 0) <= 8 * 5 + 6 && cr12.ok && twice(crR, otherFeature).length === 0 && twice(tcR).length === 0,
      "one call reads each file once: the roadmap refresh (≤ 5 reads per feature), create_feature's refresh of the other features, trace_check (read twice: " + twice(rmR).concat(twice(crR, otherFeature), twice(tcR)).join(", ") + ")");
    const rmd12 = () => fs.readFileSync(path.join(r12, ".specs", "ROADMAP.md"), "utf8");
    const rows12 = rmd12().includes("feature-9");
    S.completeTask(r12, "feature-9", 1);
    const done12 = /feature-9[^\n]*1\/\d+/.test(rmd12());
    S.manageFeature(r12, "archive", "feature-8");
    const arch12 = !rmd12().includes("feature-8");
    S.manageFeature(r12, "rename", "feature-7", "Seventh");
    const ren12 = rmd12().includes("seventh") && !rmd12().includes("feature-7");
    ok(rows12 && done12 && arch12 && ren12, "a write inside a call is seen by the roadmap refresh at its end: a created feature is listed, a ticked task counted, an archived or renamed folder gone (got " + [rows12, done12, arch12, ren12].join(",") + ")");
    const st12a = (await call12("spec_status", { name: "feature-9", projectDir: r12 })).p;
    const t9 = path.join(r12, ".specs", "feature-9", "tasks.md");
    fs.writeFileSync(t9, fs.readFileSync(t9, "utf8").replace(/- \[ \]/, "- [x]"));
    const st12b = (await call12("spec_status", { name: "feature-9", projectDir: r12 })).p;
    ok(st12b.tasks.done === st12a.tasks.done + 1, "the MCP server keeps no read cache between calls: a hand edit between two spec_status calls is seen by the second");

    // --- WP12 review fixes ---
    // (a)/(b) an ID that only sits in a fenced TABLE ROW is no requirement: append_tasks refuses it (AC and EC), and an edit
    // that only touches that row is no change request for spec_impact (added / modified / removed all empty).
    const x12 = path.join(tmp, "proj-wp12-fenced-rows");
    S.initProject(x12, ["core"], "en");
    const xf12 = S.createFeature(x12, "Rows", ["core"]);
    const xReq12 = ["# Feature: Rows", "", "## Summary", "Sign in.", "", "### US-1 (P1)", "", "#### Acceptance Criteria (EARS)",
      "1. **US-1.AC-1** — WHEN a user signs in THE SYSTEM SHALL create a session", "", "Example:", "```md", "| US-1.AC-6 | old example row |", "| EC-5 | old example edge |", "```", "",
      "## Edge Cases", "- **EC-2** — a locked account is refused.", ""].join("\n");
    fs.writeFileSync(path.join(xf12.dir, "requirements.md"), xReq12);
    const xTasks12 = fs.readFileSync(path.join(xf12.dir, "tasks.md"), "utf8");
    const xa12 = S.appendTasks(x12, "rows", [{ text: "x", requirements: ["US-1.AC-6"] }]);
    const xb12 = (await call12("spec_append_tasks", { name: "rows", tasks: [{ text: "x", requirements: ["US-1.AC-1", "EC-5"] }], projectDir: x12 }));
    ok(xa12.ok === false && xa12.phantom.join() === "US-1.AC-6" && xb12.isError && /EC-5/.test(xb12.p.error) && fs.readFileSync(path.join(xf12.dir, "tasks.md"), "utf8") === xTasks12,
      "spec_append_tasks refuses an AC (US-1.AC-6) and an EC (EC-5) written only in a fenced table row; nothing written");
    S.approvePhase(x12, "rows", "requirements", undefined, { force: true });
    fs.writeFileSync(path.join(xf12.dir, "requirements.md"), xReq12.replace("old example row", "new example row").replace("old example edge", "new example edge"));
    const xi12 = (await call12("spec_impact", { name: "rows", phase: "requirements", projectDir: x12 })).p;
    ok(xi12.ok && xi12.added.length === 0 && xi12.modified.length === 0 && xi12.removed.length === 0,
      "spec_impact --phase requirements: an edit that only touches fenced table rows (| US-1.AC-6 |, | EC-5 |) adds, modifies and removes no requirement (got modified=" + (xi12.modified || []).map((m) => m.id).join() + ")");

    // (c) a PostToolUse event with nothing new for the catalog leaves a generated SPECS.md alone (same content, same mtime).
    fs.rmSync(specsMd12, { force: true });
    S.catalog(h12, { write: true });
    const catBefore12 = fs.readFileSync(specsMd12, "utf8");
    const old12 = new Date(Date.now() - 86400e3);
    fs.utimesSync(specsMd12, old12, old12);
    post12(hReq12);
    const same12 = S.maybeRefreshCatalog(h12);
    ok(fs.readFileSync(specsMd12, "utf8") === catBefore12 && Math.abs(fs.statSync(specsMd12).mtimeMs - old12.getTime()) < 1000 && same12 === false,
      "PostToolUse with nothing new leaves the generated SPECS.md untouched (content and mtime); maybeRefreshCatalog → false");

    // (d) add_track reads requirements.md the same way: an AC written only in a `_Supersedes:_` marker (another feature's) or a
    // fenced example is not this feature's — no +saas test-plan row for it, and the +saas tasks get the placeholder, not its ID.
    const d12 = path.join(tmp, "proj-wp12-late-track");
    S.initProject(d12, ["core"], "en");
    const df12 = S.createFeature(d12, "Late", ["core"]);
    fs.writeFileSync(path.join(df12.dir, "requirements.md"), ["# Feature: Late", "", "## Summary", "X.", "", "### US-1 (P1)", "", "#### Acceptance Criteria (EARS)",
      "1. **US-1.AC-1** — WHEN a user signs in THE SYSTEM SHALL create a session _Supersedes: other/US-1.AC-5_", "", "```md", "- **US-1.AC-6** — WHEN x THE SYSTEM SHALL y", "```", ""].join("\n"));
    const dt12 = S.addTrack(d12, "late", "saas,tdd");
    const dTasks12 = fs.readFileSync(path.join(df12.dir, "tasks.md"), "utf8");
    const dPlan12 = fs.readFileSync(path.join(df12.dir, "test-plan.md"), "utf8");
    ok(dt12.ok && dt12.addedTracks.join() === "saas,tdd" && !/_Requirements:[^_\n]*US-1\.AC-[56]/.test(dTasks12) && dTasks12.includes("[the +saas criterion this task proves]") &&
      !dPlan12.includes("US-1.AC-5") && !dPlan12.includes("US-1.AC-6"),
      "add_track saas,tdd: US-1.AC-5 only in a _Supersedes:_ marker and US-1.AC-6 only in a fence get no +saas task IDs and no test-plan row");
    // ...and a feature's OWN US-1.AC-5 / AC-6 are not the template's +saas criteria unless they are written as such (under a
    // [SaaS] heading or carrying the marker): kept by number, the appended tenant-isolation / load-test tasks "covered" a
    // coupon and a checkout criterion — trace_check went from 2 uncovered to pass. A real [SaaS] criterion is still cited.
    const own12 = path.join(tmp, "proj-wp12-own-ac5");
    S.initProject(own12, ["core"], "en");
    const ownf12 = S.createFeature(own12, "Shop", ["core"]);
    const ownAc12 = (n, t) => `${n}. **US-1.AC-${n}** — WHEN ${t} THE SYSTEM SHALL update the cart view`;
    fs.writeFileSync(path.join(ownf12.dir, "requirements.md"), ["# Feature: Shop", "", "## Summary", "X.", "", "### US-1 (P1)", "", "#### Acceptance Criteria (EARS)",
      ownAc12(1, "an item is added"), ownAc12(2, "an item is removed"), ownAc12(3, "the cart is emptied"), ownAc12(4, "the cart opens"), ownAc12(5, "a coupon is applied"), ownAc12(6, "checkout is clicked"), ""].join("\n"));
    fs.writeFileSync(path.join(ownf12.dir, "tasks.md"), "# Tasks\n\n## Phase: Core\n- [ ] 1. [US1] Cart basics\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4_\n");
    const ownBefore12 = S.traceCheck(own12, "shop").uncoveredByTasks.join();
    const ownAdd12 = S.addTrack(own12, "shop", "saas");
    const ownTr12 = S.traceCheck(own12, "shop");
    const ownTasks12 = fs.readFileSync(path.join(ownf12.dir, "tasks.md"), "utf8");
    const real12 = path.join(tmp, "proj-wp12-real-saas-ac");
    S.initProject(real12, ["core"], "en");
    const realf12 = S.createFeature(real12, "Tenants", ["core"]);
    fs.writeFileSync(path.join(realf12.dir, "requirements.md"), ["# Feature: Tenants", "", "## Summary", "X.", "", "### US-1 (P1)", "", "#### Acceptance Criteria (EARS)",
      ownAc12(1, "an item is added"), "", "#### [SaaS] Acceptance Criteria (EARS)", "5. **US-1.AC-5** — WHEN a user of tenant A reads data THE SYSTEM SHALL NOT return tenant B's records", ""].join("\n"));
    S.addTrack(real12, "tenants", "saas");
    const realTasks12 = fs.readFileSync(path.join(realf12.dir, "tasks.md"), "utf8");
    ok(ownBefore12 === "US-1.AC-5,US-1.AC-6" && ownAdd12.ok && ownTr12.uncoveredByTasks.join() === "US-1.AC-5,US-1.AC-6" && !/_Requirements:[^_\n]*US-1\.AC-[56]/.test(ownTasks12) &&
      (ownTasks12.match(/\[the \+saas criterion this task proves\]/g) || []).length === 3 &&
      /Enforce tenant isolation[^\n]*\n  - _Requirements: US-1\.AC-5_/.test(realTasks12) && /Load test[^\n]*\n  - _Requirements: \[the \+saas criterion this task proves\]_/.test(realTasks12),
      "add_track saas on a feature whose own US-1.AC-5 / AC-6 are unrelated: the appended tasks cite the +saas placeholder and trace_check still reports both uncovered; a [SaaS]-headed US-1.AC-5 is cited (got " +
      JSON.stringify([ownBefore12, ownTr12.uncoveredByTasks]) + ")");

    // (e) spec_create on an EXISTING feature adding +tdd with +saas / +ai plans exactly what add_track plans: the requirements
    // predate those tracks, so no template row for US-1.AC-5…AC-9 (they don't exist). The same through the MCP tool, and via
    // create core → add_track saas → create tdd. A test-plan row covering an AC requirements.md doesn't define is a phantom.
    const e12 = path.join(tmp, "proj-wp12-create-tracks");
    S.initProject(e12, ["core"], "en");
    const planE12 = (slug) => fs.readFileSync(path.join(e12, ".specs", slug, "test-plan.md"), "utf8");
    const rowsE12 = (slug) => (planE12(slug).match(/^\| T-\d+ /gm) || []).map((r) => r.slice(2).trim()).join();
    S.createFeature(e12, "Shop A", ["core"]);
    const ce12 = S.createFeature(e12, "Shop A", ["tdd", "saas"]);
    S.createFeature(e12, "Shop B", ["core"]);
    S.addTrack(e12, "shop-b", "tdd,saas");
    S.createFeature(e12, "Shop C", ["core"]);
    S.createFeature(e12, "Shop C", ["tdd", "ai"]);
    S.createFeature(e12, "Shop D", ["core"]);
    S.addTrack(e12, "shop-d", "saas");
    S.createFeature(e12, "Shop D", ["tdd"]);
    await rpc("tools/call", { name: "spec_create", arguments: { name: "Shop E", tracks: ["core"], projectDir: e12 } });
    const me12 = payload(await rpc("tools/call", { name: "spec_create", arguments: { name: "Shop E", tracks: ["tdd", "saas"], projectDir: e12 } }));
    const fresh12 = S.createFeature(e12, "Shop F", ["tdd", "saas", "ai"]);
    const trE12 = ["shop-a", "shop-c", "shop-d", "shop-e"].map((s) => S.traceCheck(e12, s));
    ok(ce12.ok && ce12.addedTracks.join() === "tdd,saas" && me12.ok && rowsE12("shop-a") === "T-01,T-02,T-03,T-04,T-05" && planE12("shop-a").replace(/^# .*$/m, "") === planE12("shop-b").replace(/^# .*$/m, "") &&
      rowsE12("shop-c") === rowsE12("shop-a") && rowsE12("shop-d") === rowsE12("shop-a") && rowsE12("shop-e") === rowsE12("shop-a") &&
      !/US-1\.AC-[5-9]/.test(planE12("shop-a") + planE12("shop-c") + planE12("shop-d") + planE12("shop-e")) &&
      trE12.every((t) => t.ok && !t.phantomAcsInTests.length) && fresh12.ok && rowsE12("shop-f") === "T-01,T-02,T-03,T-04,T-05,T-06,T-07,T-08,T-09,T-10" &&
      !S.traceCheck(e12, "shop-f").phantomAcsInTests.length,
      "spec_create on an existing feature (+tdd with +saas/+ai; CLI engine and MCP) plans the same 5 rows as add_track — no row for US-1.AC-5…AC-9 it lacks; a new feature keeps its 10 (got " +
      ["shop-a", "shop-c", "shop-d", "shop-e", "shop-f"].map(rowsE12).join(" | ") + ")");
    fs.appendFileSync(path.join(e12, ".specs", "shop-a", "test-plan.md"), "| T-06 | load | example | p95 | US-1.AC-6 | load-test.md |\n\n```md\n| T-07 | x | x | x | US-9.AC-9 | x |\n```\n");
    const ph12 = S.traceCheck(e12, "shop-a");
    const phDoc12 = S.specDoctor(e12, "shop-a").checks.find((c) => c.id === "traceability");
    const phGate12 = S.approvePhase(e12, "shop-a", "test-plan");
    // add_track tdd on a feature whose requirements were already written (an import): the plan's rows come from ITS AC IDs
    // (one generic row each), never the template's US-1.AC-1…4 / US-2.AC-1 — no phantom row to approve. MCP and PT alike.
    const reqR12 = "# Feature: R\n\n## Summary\nCancel orders.\n\n### US-1 (P1 — MVP): Cancel\n#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN a buyer cancels THE SYSTEM SHALL refund.\n" +
      "2. **US-1.AC-2** — IF the order shipped THEN THE SYSTEM SHALL refuse.\n\n### US-3 (P2): Notify\n#### Acceptance Criteria (EARS)\n1. **US-3.AC-1** — WHEN a refund is issued THE SYSTEM SHALL email the buyer.\n";
    const lt12 = S.createFeature(e12, "Shop R", ["core"]);
    fs.writeFileSync(path.join(lt12.dir, "requirements.md"), reqR12);
    S.addTrack(e12, lt12.slug, "tdd");
    const lq12 = S.createFeature(e12, "Shop Q", ["core"]);
    fs.writeFileSync(path.join(lq12.dir, "requirements.md"), reqR12);
    const mL12 = payload(await rpc("tools/call", { name: "spec_add_track", arguments: { name: lq12.slug, track: "tdd", projectDir: e12 } }));
    const lpt12 = path.join(tmp, "proj-wp12-late-tdd-pt");
    S.initProject(lpt12, ["core"], "pt");
    const lp12 = S.createFeature(lpt12, "Encomendas", ["core"]);
    fs.writeFileSync(path.join(lp12.dir, "requirements.md"), reqR12);
    S.addTrack(lpt12, lp12.slug, "tdd");
    const rowsL12 = (dir) => (fs.readFileSync(path.join(dir, "test-plan.md"), "utf8").match(/^\| T-\d+ .*$/gm) || []).join("\n");
    const trL12 = S.traceCheck(e12, lt12.slug);
    ok(rowsL12(lt12.dir) === "| T-01 | unit | example | [behavior] | US-1.AC-1 | `tests/unit/...` |\n| T-02 | unit | example | [behavior] | US-1.AC-2 | `tests/unit/...` |\n| T-03 | unit | example | [behavior] | US-3.AC-1 | `tests/unit/...` |" &&
      !trL12.phantomAcsInTests.length && !trL12.uncoveredByTests.length && mL12.ok && rowsL12(lq12.dir) === rowsL12(lt12.dir) &&
      rowsL12(lp12.dir).includes("| T-03 | unit | example | [comportamento] | US-3.AC-1 |") && !/US-1\.AC-4|US-2\.AC-1/.test(rowsL12(lp12.dir)),
      "add_track tdd after the requirements exist: one test-plan row per real AC (T-01…T-03), no template row for US-1.AC-4 / US-2.AC-1 — same via MCP, localized (PT) (got " + JSON.stringify(rowsL12(lt12.dir)) + ")");

    // shop-a is at its requirements phase: test-plan.md is still a LATER phase's template, so doctor defers its gaps (a warn,
    // not "typos?") — the test-plan approval gate still refuses the phantom. With the test plan as the CURRENT phase, doctor fails.
    const sg12 = S.createFeature(e12, "Shop G", ["tdd"]);
    fs.writeFileSync(path.join(sg12.dir, "requirements.md"), "# Feature: Shop G\n\n## Summary\nReceipts.\n\n### US-1 (P1 — MVP): Pay\n#### Acceptance Criteria (EARS)\n" +
      "1. **US-1.AC-1** — WHEN a buyer pays THE SYSTEM SHALL issue a receipt.\n\n## Success Criteria\n- **SC-001** — 99% of receipts within 1 s.\n");
    fs.writeFileSync(path.join(sg12.dir, "design.md"), "# Design: Shop G\n\n## Overview\nA receipt service.\n\n## Constitution Check\n- [x] Principle 1 — complies\n");
    const gDoc12 = S.specDoctor(e12, sg12.slug);
    const gTr12 = gDoc12.checks.find((c) => c.id === "traceability");
    ok(ph12.verdict === "gaps-found" && ph12.phantomAcsInTests.join() === "US-1.AC-6" && S.traceGaps(ph12).some((g) => g.kind === "phantomAcsInTests") &&
      phDoc12.status === "warn" && /^not traced yet — still a later phase's template: test-plan\.md, tasks\.md/.test(phDoc12.detail) &&
      phGate12.refused && phGate12.failing.includes("traceability") && /US-1\.AC-6/.test(phGate12.error) &&
      gDoc12.phase === "test-plan" && gTr12.status === "fail" && /the test plan covers unknown ACs \(typos\?\): US-1\.AC-2, US-1\.AC-3, US-1\.AC-4, US-2\.AC-1/.test(gTr12.detail) &&
      !/ACs with no task|tasks reference/.test(gTr12.detail) &&
      /o plano de testes cobre ACs desconhecidos/.test(S.traceGapLines(ph12, "pt").join()) && /el plan de pruebas cubre ACs desconocidos/.test(S.traceGapLines(ph12, "es").join()),
      "trace_check: a test-plan row covering an AC requirements.md doesn't define is a phantom (phantomAcsInTests — a gap: the test-plan approval is refused, doctor fails once the test plan is the current phase and defers it while it is a later template; a fenced example is none; EN/PT/ES) (got " + phDoc12.detail + " | " + gTr12.status + ": " + gTr12.detail + ")");

    // A fenced example row in test-plan.md is no planned test either way: it neither covers its AC (a false traceability
    // pass — and a passed test-plan gate — for an AC with no real row) nor adds a planned T-ID the Phase 4 gate demands in
    // the test code (MCP trace_check says the same).
    const fp12 = S.createFeature(e12, "Shop H", ["tdd"]);
    fs.writeFileSync(path.join(fp12.dir, "requirements.md"), "# Feature: Shop H\n\n## Summary\nLogin.\n\n### US-1 (P1 — MVP): Login\n#### Acceptance Criteria (EARS)\n" +
      "1. **US-1.AC-1** — WHEN a user logs in THE SYSTEM SHALL open the dashboard.\n2. **US-1.AC-2** — WHEN a user logs out THE SYSTEM SHALL end the session.\n\n## Success Criteria\n- **SC-001** — 99% within 1 s.\n");
    fs.writeFileSync(path.join(fp12.dir, "test-plan.md"), "# Test Plan: Shop H\n\n| ID | AC | File |\n|---|---|---|\n| T-01 | US-1.AC-1 | tests/login.test.js |\n\n" +
      "An example row, for reference:\n\n```md\n| T-02 | US-1.AC-2 | tests/logout.test.js |\n```\n");
    fs.writeFileSync(path.join(fp12.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Login\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Makes green: T-01_\n");
    put12(e12, "tests/login.test.js", "test('T-01 opens the dashboard', () => {});\n");
    const fTr12 = S.traceCheck(e12, fp12.slug, { code: true });
    const fMcp12 = (await call12("trace_check", { name: fp12.slug, projectDir: e12 })).p;
    approveBefore(e12, fp12.slug, "test-plan");
    const fPlan12 = S.approvePhase(e12, fp12.slug, "test-plan");
    approveBefore(e12, fp12.slug, "tests"); // the test plan with force (phase by phase) — the tests gate is what's checked here
    const fTests12 = S.approvePhase(e12, fp12.slug, "tests");
    ok(fTr12.verdict === "gaps-found" && fTr12.uncoveredByTests.join() === "US-1.AC-2" && fTr12.plannedTests === 1 && !fTr12.testsNotMappedToTasks.length &&
      fTr12.code.planned === 1 && !fTr12.code.plannedNotInCode.length && fMcp12.uncoveredByTests.join() === "US-1.AC-2" && fMcp12.plannedTests === 1 &&
      fPlan12.ok === false && fPlan12.failing.includes("traceability") && /US-1\.AC-2/.test(fPlan12.error) && fTests12.ok === true,
      "trace_check / gates: a ```fenced example``` row in test-plan.md covers nothing (US-1.AC-2 uncovered, the test-plan approval refused) and plans no T-ID (plannedTests 1, the tests gate asks only for T-01) — MCP trace_check agrees (got " +
      JSON.stringify([fTr12.verdict, fTr12.uncoveredByTests, fTr12.plannedTests, fTr12.code.plannedNotInCode, fPlan12.ok, fTests12.ok, fTests12.error]) + ")");
    // ...but a fence left unclosed inside a list item ends with that item (CommonMark, and the tasks scanner's rule): it
    // blanked every row below it — T-02 planned nothing, covered nothing and read as a phantom in tasks.md. The same
    // shape in requirements.md keeps US-1.AC-2 a criterion (trace, EARS); an unclosed TOP-LEVEL fence still runs to the end.
    const fl12 = S.createFeature(e12, "Shop L", ["tdd"]);
    fs.writeFileSync(path.join(fl12.dir, "requirements.md"), "# Feature: Shop L\n\n### US-1 (P1 — MVP): Login\n#### Acceptance Criteria (EARS)\n" +
      "- **US-1.AC-1** — WHEN a user logs in THE SYSTEM SHALL open the dashboard.\n  ```js\n  login()\n- **US-1.AC-2** — WHEN a user logs out THE SYSTEM SHALL end the session.\n");
    fs.writeFileSync(path.join(fl12.dir, "test-plan.md"), "# Test Plan: Shop L\n\n- T-01 — US-1.AC-1 opens the dashboard\n  ```js\n  test('x')\n- T-02 — US-1.AC-2 ends the session\n");
    fs.writeFileSync(path.join(fl12.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Login\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Makes green: T-01, T-02_\n");
    const lTr12 = S.traceCheck(e12, fl12.slug);
    const lEars12 = S.earsValidate(fs.readFileSync(path.join(fl12.dir, "requirements.md"), "utf8"));
    fs.writeFileSync(path.join(fl12.dir, "test-plan.md"), "# Test Plan: Shop L\n\n- note\n  ```js\n  x\n\n| ID | AC | File |\n|---|---|---|\n| T-01 | US-1.AC-1 | a |\n| T-02 | US-1.AC-2 | b |\n");
    const lTab12 = S.traceCheck(e12, fl12.slug);
    fs.writeFileSync(path.join(fl12.dir, "test-plan.md"), "# Test Plan: Shop L\n\n| ID | AC | File |\n|---|---|---|\n| T-01 | US-1.AC-1 | a |\n\n```js\n| T-02 | US-1.AC-2 | b |\n");
    const lTop12 = S.traceCheck(e12, fl12.slug);
    ok(lTr12.verdict === "pass" && lTr12.totalAcs === 2 && lTr12.plannedTests === 2 && !lTr12.uncoveredByTests.length && !lTr12.phantomTestsInTasks.length &&
      lEars12.ok && lEars12.issues.filter((i) => i.severity === "error").length === 0 && lEars12.summary.criteriaDetected === 2 &&
      lTab12.plannedTests === 2 && !lTab12.uncoveredByTests.length && lTop12.plannedTests === 1 && lTop12.uncoveredByTests.join() === "US-1.AC-2",
      "an unclosed fence inside a list item ends with the item: test-plan rows below it (bullets or a table) are planned and cover their ACs, the AC below it in requirements.md is a criterion; an unclosed top-level fence still hides the rest (got " +
      JSON.stringify([lTr12.verdict, lTr12.totalAcs, lTr12.plannedTests, lTr12.uncoveredByTests, lTr12.phantomTestsInTasks, lEars12.summary.criteriaDetected, lTab12.plannedTests, lTop12.plannedTests]) + ")");

    // An `_Implements:_` glob whose bounded walk stops at its cap before any match proves nothing: never a missing-file gap
    // (a warning, unresolvedImplGlobs); a glob whose walk ended without a match is still missing; the finish baseline says
    // its glob list was truncated.
    const u12 = path.join(tmp, "proj-wp12-glob-cap");
    S.initProject(u12, ["core"], "en");
    for (let i = 0; i < 6; i++) put12(u12, "a/f" + i + ".txt", "");
    put12(u12, "src/login.js", "x\n");
    const uf12 = S.createFeature(u12, "Cap", ["core"]);
    fs.writeFileSync(path.join(uf12.dir, "requirements.md"), "## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n");
    fs.writeFileSync(path.join(uf12.dir, "tasks.md"), "- [x] 1. a\n  - _Requirements: US-1.AC-1_\n  - _Implements: **/login.js, src/*.zz_\n");
    const uc12 = S.traceCheck(u12, "cap", { globCap: 3 });
    const uFull12 = S.traceCheck(u12, "cap");
    ok(uc12.missingImplFiles.join() === "src/*.zz" && uc12.unresolvedImplGlobs.join() === "**/login.js" && uc12.warnings.some((w) => w.kind === "unresolvedImplGlobs" && w.items.join() === "**/login.js") &&
      !S.traceGaps(uc12).some((g) => g.items.includes("**/login.js")) && S.traceWarningLines(uc12, "en").some((l) => /not fully resolved.*\*\*\/login\.js/.test(l)) &&
      uFull12.unresolvedImplGlobs.length === 0 && uFull12.missingImplFiles.join() === "src/*.zz" && !uFull12.warnings.some((w) => w.kind === "unresolvedImplGlobs"),
      "trace_check: a glob walk cut by its cap before a match (**/login.js) is a warning, not a missing file; a completed walk with no match (src/*.zz) stays missing; with the full cap the glob resolves");
    const fcap12 = S.finishFeature(fz12, "login-loop", { write: true, globCap: 1 });
    const fcapSt12 = JSON.parse(fs.readFileSync(path.join(fb12.dir, ".state.json"), "utf8"));
    const fnorm12 = S.finishFeature(fz12, "login-loop", { write: true });
    const fnormSt12 = JSON.parse(fs.readFileSync(path.join(fb12.dir, ".state.json"), "utf8"));
    ok(fcap12.readyToFinish && fcap12.baseline.truncated === true && fcapSt12.finished.truncated === true && fnorm12.baseline.recorded && !fnorm12.baseline.truncated && !fnormSt12.finished.truncated &&
      Object.keys(fnormSt12.finished.files).join() === "src/auth.js,src/lib/x.ts,src/lib/y.ts",
      "finish {write}: a glob walk cut by its cap marks the drift baseline truncated (result and state); a complete walk does not");

    // A line that STARTS with inline triple-backtick code ("```US-1.AC-1``` is …") is no fence opener (CommonMark: a backtick
    // fence's info string holds no backtick) — it must not turn the rest of requirements.md into code.
    const k12 = path.join(tmp, "proj-wp12-inline-ticks");
    S.initProject(k12, ["core"], "en");
    const kf12 = S.createFeature(k12, "Ticks", ["core"]);
    const kReq12 = "# Feature: Ticks\n\n## Summary\nSign-in.\n\n### US-1 (P1)\n\n#### Acceptance Criteria (EARS)\n```US-1.AC-1``` is how an ID looks.\n" +
      "1. **US-1.AC-1** — WHEN a user signs in THE SYSTEM SHALL create a session\n2. **US-1.AC-2** — WHEN a user signs out THE SYSTEM SHALL end the session\n";
    fs.writeFileSync(path.join(kf12.dir, "requirements.md"), kReq12);
    fs.writeFileSync(path.join(kf12.dir, "tasks.md"), "## Phase: Build\n- [ ] 1. [US1] Sessions\n  - _Requirements: US-1.AC-1_\n**Checkpoint:** ok\n");
    const kt12 = S.traceCheck(k12, "ticks");
    const ke12 = S.earsValidate(kReq12, "en");
    const kFenced12 = S.earsValidate("#### Acceptance Criteria (EARS)\n``` md\n1. **US-1.AC-9** — WHEN a THE SYSTEM SHALL b\n```\n1. **US-1.AC-1** — WHEN c THE SYSTEM SHALL d\n", "en");
    ok(kt12.totalAcs === 2 && kt12.uncoveredByTasks.join() === "US-1.AC-2" && kt12.phantomAcsInTasks.length === 0 && ke12.summary.criteriaDetected === 2 && ke12.verdict === "pass" &&
      kFenced12.summary.criteriaDetected === 1,
      "a line starting with inline ```code``` is no fence: trace_check still sees both ACs (US-1.AC-2 uncovered), the EARS lint both criteria; a real ``` md fence still hides its body (got totalAcs=" + kt12.totalAcs + ")");

    // --- WP12 review round 2 ---
    // A glob that SPELLS a skipped folder (dist, build, a hidden one) after a wildcard enters it: the file exists, the literal
    // path is found, so is the glob. A lone `*` / `**` still never enters node_modules, dist or a hidden folder.
    const v12 = path.join(tmp, "proj-wp12-glob-ignored");
    S.initProject(v12, ["core"], "en");
    ["packages/ui/dist/index.js", "src/gen/.generated/api.ts", "services/api/build/server.js", "node_modules/pkg/index.js", "src/.cache/x.ts", "packages/ui/src/index.js"].forEach((f) => put12(v12, f, "x\n"));
    const vf12 = S.createFeature(v12, "Pkg", ["core"]);
    fs.writeFileSync(path.join(vf12.dir, "requirements.md"), "## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n");
    fs.writeFileSync(path.join(vf12.dir, "tasks.md"), ["- [x] 1. literal paths", "  - _Requirements: US-1.AC-1_", "  - _Implements: packages/ui/dist/index.js, src/gen/.generated/api.ts, services/api/build/server.js_",
      "- [x] 2. the same files by glob", "  - _Implements: packages/*/dist/*.js, src/**/.generated/*.ts, services/*/build/*.js_", ""].join("\n"));
    const vt12 = (await call12("trace_check", { name: "pkg", projectDir: v12 })).p;
    const vg12 = (p) => S.globFiles(v12, p).files.join();
    ok(vt12.verdict === "pass" && vt12.missingImplFiles.length === 0 && vg12("packages/*/dist/*.js") === "packages/ui/dist/index.js" && vg12("src/**/.generated/*.ts") === "src/gen/.generated/api.ts" &&
      vg12("services/*/build/*.js") === "services/api/build/server.js" && vg12("**/index.js") === "packages/ui/src/index.js" && vg12("src/**/*.ts") === "" && vg12("src/*/*.ts") === "" &&
      vg12("**/node_modules/pkg/*.js") === "node_modules/pkg/index.js" && vg12("src/.c*/*.ts") === "src/.cache/x.ts",
      "globFiles enters a dist/build/hidden folder the pattern names (packages/*/dist/*.js, src/**/.generated/*.ts, src/.c*/*.ts) — trace_check passes a done task citing them; `*`/`**` alone skip them (got missing=" + vt12.missingImplFiles.join("|") + ")");

    // _Implements:_ glob walks are memoized per call: finish (trace + doctor's trace + tests-in-code) reads each folder once; a
    // raw write inside one call is not seen (one snapshot per call), an engine write the walk can reach drops the result, one
    // under .specs/ keeps the others; the next call walks afresh.
    const q12 = path.join(tmp, "proj-wp12-glob-memo");
    S.initProject(q12, ["core"], "en");
    for (let d = 0; d < 4; d++) for (let i = 0; i < 3; i++) put12(q12, "src/m" + d + "/f" + i + ".js", "");
    put12(q12, "notes/a.md", "a\n");
    const qf12 = S.createFeature(q12, "Memo", ["core"]);
    fs.writeFileSync(path.join(qf12.dir, "requirements.md"), "## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n");
    fs.writeFileSync(path.join(qf12.dir, "tasks.md"), "- [ ] 1. a\n  - _Requirements: US-1.AC-1_\n  - _Implements: **/future-a.ts, src/**/future-b.ts_\n");
    const rawDir12 = fs.readdirSync, rawReal12 = fs.realpathSync.native;
    const dirReads12 = new Map();
    let srcReal12 = 0; // globFiles resolves the literal folder of `src/**/future-b.ts` once per walk it really does
    fs.readdirSync = function (p) { const k = path.resolve(String(p)).toLowerCase(); if (/[\\/]src(?:[\\/]|$)/.test(k)) dirReads12.set(k, (dirReads12.get(k) || 0) + 1); return rawDir12.apply(this, arguments); };
    fs.realpathSync.native = function (p) { if (path.resolve(String(p)).toLowerCase() === path.join(q12, "src").toLowerCase()) srcReal12++; return rawReal12.apply(this, arguments); };
    let qfin12;
    try { qfin12 = S.finishFeature(q12, "memo"); } finally { fs.readdirSync = rawDir12; fs.realpathSync.native = rawReal12; }
    const qTwice12 = [...dirReads12].filter(([, n]) => n > 1).map(([k, n]) => path.basename(k) + "×" + n);
    ok(qfin12.ok && qfin12.openTasks.join() === "1" && S.traceCheck(q12, "memo").plannedImplFiles.join() === "**/future-a.ts,src/**/future-b.ts" && dirReads12.size === 5 && qTwice12.length === 0 && srcReal12 === 1,
      "finish reads each src/ folder once although trace_check runs twice (and doctor scans the tests): glob walks and folder listings are memoized per call (read twice: " + qTwice12.join(", ") + "; folders " + dirReads12.size + "; src/** walks " + srcReal12 + ")");
    const qm12 = S.withReadCache(() => {
      const n1 = S.globFiles(q12, "notes/*.md").files.join();
      put12(q12, "notes/b.md", "b\n"); // a raw write: the engine can't know — the call keeps its snapshot
      const n2 = S.globFiles(q12, "notes/*.md").files.join();
      const s1 = S.globFiles(q12, ".specs/*/requirements.md").files.join();
      const w1 = S.globFiles(q12, "**/*.md").files.join();
      S.createFeature(q12, "Second", ["core"]); // an engine write under .specs/
      return { n1, n2, s1, w1, s2: S.globFiles(q12, ".specs/*/requirements.md").files.join(), n3: S.globFiles(q12, "notes/*.md").files.join(), w2: S.globFiles(q12, "**/*.md").files.join() };
    });
    const qAfter12 = S.globFiles(q12, "notes/*.md").files.join();
    ok(qm12.n1 === "notes/a.md" && qm12.n2 === "notes/a.md" && qm12.s1 === ".specs/memo/requirements.md" && qm12.s2 === ".specs/memo/requirements.md,.specs/second/requirements.md" &&
      qm12.n3 === "notes/a.md" && qm12.w1 === "notes/a.md" && qm12.w2 === qm12.w1 && qAfter12 === "notes/a.md,notes/b.md",
      "the glob memo: repeats answer from the call's snapshot; an engine write the walk reaches (.specs/*/requirements.md) is seen at once, one it can't reach (notes/*, **/*.md skip .specs) keeps the result; the next call is fresh (got " + JSON.stringify(qm12) + ")");
  }

  // 1.14 full review (Pa) — markers, EARS, comments, traceability, T-ID scan.

  {
    const pa = path.join(tmp, "proj-full-review-pa");
    S.initProject(pa, ["core"], "en");
    const paDir = (slug) => path.join(pa, ".specs", slug);
    const paPut = (rel, text) => { const p = path.join(pa, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
    const paReq = (body) => "# Feature: X\n\n## Summary\nPay for the cart.\n\n## User Stories\n\n### US-1 (P1 — MVP): Pay\n**As a** buyer, **I want** to pay, **so that** I get my order.\n\n#### Acceptance Criteria (EARS)\n\n" + body + "\n\n## Success Criteria\n- **SC-001** — 95% of payments complete in under 3 s.\n";
    const earsGood = "1. **US-1.AC-1** — WHEN the buyer pays THE SYSTEM SHALL charge the card.\n2. **US-1.AC-2** — WHEN the charge succeeds THE SYSTEM SHALL email a receipt.";

    // Pa1: a marker followed by punctuation — or written in *italics* — is a marker (the evidence gate reads its _Verify:_).
    S.createFeature(pa, "Markers", ["core"], "x", undefined, "en");
    paPut(".specs/markers/requirements.md", paReq(earsGood));
    paPut(".specs/markers/tasks.md", "# Tasks\n\n- [ ] 1. Route (_Implements: src/routes.ts_; _Verify: npm test_)\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n" +
      "- [ ] 2. Wire the handler — _Verify: `node -e \"process.exit(1)\"`_.\n- [x] 3. Old module (see _Implements: src/old.ts_).\n" +
      "- [ ] 4. Italic *Verify: npm run lint* and *Implements: src/__init__.py*\n- [ ] 5. Inner _Implements: src/keys_util.js, src/a_b.ts_\n");
    const b1 = S.taskBrief(pa, "markers", 1, {}), b2 = S.taskBrief(pa, "markers", 2, {}), b4 = S.taskBrief(pa, "markers", 4, {});
    ok(JSON.stringify(b1.verify) === '["npm test"]' && JSON.stringify(b2.verify) === '["node -e \\"process.exit(1)\\""]' && JSON.stringify(b4.verify) === '["npm run lint"]',
      "full review Pa1: _Verify:_ followed by ')' or '.', and *Verify: …* in italics, are markers — the brief names the command (got " + JSON.stringify([b1.verify, b2.verify, b4.verify]) + ")");
    const c2 = S.completeTask(pa, "markers", 2, {});
    ok(c2.ok && c2.verified === false && c2.unverifiedReason === "no-evidence" && !c2.nothingToVerify,
      "full review Pa1: completing a task whose _Verify:_ ends in '_.' without a run is unverified (no-evidence), never 'nothing to verify' (got " + JSON.stringify([c2.ok, c2.verified, c2.unverifiedReason, c2.nothingToVerify]) + ")");
    const tr1 = S.traceCheck(pa, "markers");
    ok(tr1.implementsFiles.includes("src/routes.ts") && tr1.implementsFiles.includes("src/__init__.py") && tr1.implementsFiles.includes("src/keys_util.js") && tr1.implementsFiles.includes("src/a_b.ts") &&
      tr1.missingImplFiles.includes("src/old.ts") && tr1.verdict === "gaps-found",
      "full review Pa1: trace_check reads '_Implements: x_;', '(see _Implements: x_).', *Implements: …* and inner underscores — a done task's missing file is a gap (got " + JSON.stringify([tr1.implementsFiles, tr1.missingImplFiles, tr1.verdict]) + ")");
    paPut(".specs/markers/tasks.md", "# Tasks\n\n- [ ] 1. Route _Verify: npm test_\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n- [ ] 2. Odd — **Verify:** npm test\n  - Implements: src/x.ts\n  - the `Verify:` label in code is no marker\n");
    const mm = (S.specDoctor(pa, "markers").checks || []).find((c) => c.id === "malformed-markers");
    ok(mm && mm.status === "warn" && /#2 \(Verify:, Implements:\)/.test(mm.detail) && !/#1/.test(mm.detail),
      "full review Pa1: doctor warns malformed-markers for marker-shaped text that yields no marker (**Verify:** …, a bare Implements:) — never for a real marker or a code span (got " + JSON.stringify(mm) + ")");

    // Pa2: an AC written as a table row, a bold line, a heading or a checkbox item is EARS-checked; AC IDs nobody lints fail.
    S.createFeature(pa, "Ears units", ["core"], "x", undefined, "en");
    const earsOf = (body) => { paPut(".specs/ears-units/requirements.md", paReq(body)); return S.earsFeature(pa, "ears-units"); };
    const table = earsOf("| ID | Criterion |\n|----|-----------|\n| US-1.AC-1 | Checkout should be fast and user-friendly |\n| US-1.AC-2 | Payment works |");
    const bold = earsOf("**US-1.AC-1** — Payment works.\n**US-1.AC-2** — WHEN paid THE SYSTEM SHALL email a receipt.");
    const heading = earsOf("##### US-1.AC-1 — Payment works\n\n##### US-1.AC-2\n\nWHEN paid THE SYSTEM SHALL email a receipt.");
    const checkbox = earsOf("- [ ] **US-1.AC-1** — Payment works.\n- [x] **US-1.AC-2** — WHEN paid THE SYSTEM SHALL email a receipt.");
    const noModal = (e) => e.issues.filter((i) => i.code === "no-modal").map((i) => i.line);
    ok(table.verdict === "fail" && table.summary.criteriaDetected === 2 && noModal(table).length === 2 && table.issues.some((i) => i.code === "vague"),
      "full review Pa2: ACs in a table row under the Acceptance Criteria heading are linted — no modal verb is an error, vague terms warn (got " + JSON.stringify([table.verdict, table.summary, table.issues.map((i) => i.code)]) + ")");
    ok([bold, heading, checkbox].every((e) => e.verdict === "fail" && e.summary.criteriaDetected === 2 && JSON.stringify(noModal(e)) === "[13]"),
      "full review Pa2: a bold line, a heading and a checkbox item that start with an AC ID are each their own criterion (two in a row never merge) (got " + JSON.stringify([bold, heading, checkbox].map((e) => [e.verdict, e.summary.criteriaDetected, noModal(e)])) + ")");
    earsOf("- Payment works (see US-1.AC-1).");
    const dEars = (S.specDoctor(pa, "ears-units").checks || []).find((c) => c.id === "ears");
    approveBefore(pa, "ears-units", "requirements");
    const apEars = S.approvePhase(pa, "ears-units", "requirements", "t");
    ok(dEars && dEars.status === "fail" && /US-1\.AC-1/.test(dEars.detail) && !apEars.ok && (apEars.failing || []).includes("ears"),
      "full review Pa2: requirements.md citing AC IDs that no criterion lints — doctor's ears check fails and the requirements approval is refused (got " + JSON.stringify([dEars, apEars.ok, apEars.failing]) + ")");
    const summaryTable = earsOf(earsGood + "\n\n## Priorities\n\n| AC | Priority |\n|----|----------|\n| US-1.AC-1 | P1 |");
    ok(summaryTable.verdict === "pass" && summaryTable.summary.criteriaDetected === 2,
      "full review Pa2: a summary table of AC IDs outside the acceptance criteria (no modal verb) is not a criterion (got " + JSON.stringify([summaryTable.verdict, summaryTable.summary]) + ")");

    // Pa3: "<!--" / "-->" inside an inline code span (or a fence) open no comment — EARS, trace_check and the placeholders see every line.
    S.createFeature(pa, "Comment sanitizer", ["core"], "x", undefined, "en");
    paPut(".specs/comment-sanitizer/requirements.md", paReq("1. **US-1.AC-1** — IF a comment body contains `<!--`, THEN THE SYSTEM SHALL escape it as text.\n" +
      "2. **US-1.AC-2** — WHEN a comment holds a script tag THE SYSTEM SHALL strip it.\n3. **US-1.AC-3** — IF a comment body contains `-->`, THEN THE SYSTEM SHALL escape it as text.\n" +
      "4. **US-1.AC-4** — WHEN a comment is posted THE SYSTEM SHALL render it within 200 ms."));
    paPut(".specs/comment-sanitizer/tasks.md", "# Tasks\n\n- [ ] 1. Escape comment markers\n  - _Requirements: US-1.AC-1_\n");
    const tr3 = S.traceCheck(pa, "comment-sanitizer");
    const e3 = S.earsFeature(pa, "comment-sanitizer");
    ok(tr3.totalAcs === 4 && JSON.stringify(tr3.uncoveredByTasks) === '["US-1.AC-2","US-1.AC-3","US-1.AC-4"]' && e3.summary.criteriaDetected === 4,
      "full review Pa3: a `<!--` in an inline code span opens no comment — trace_check sees all 4 ACs (3 uncovered) and EARS lints 4 criteria (got " + JSON.stringify([tr3.totalAcs, tr3.uncoveredByTasks, e3.summary.criteriaDetected]) + ")");
    const strip = S.stripHtmlComments("a `<!--` b\n```html\n<!-- in a fence\n```\nc <!-- real\ncomment --> d\ne `-->` f");
    const ph3 = S.placeholderReport("Say `<!--` here.\n\n- [TBD]\n\nand `-->` there\n<!-- [TBD] hidden -->");
    ok(strip === "a `<!--` b\n```html\n<!-- in a fence\n```\nc  d\ne `-->` f" && ph3.length === 1 && ph3[0].line === 3,
      "full review Pa3: stripHtmlComments and the placeholder scan keep a code span's / a fence's `<!--` as text; a real comment is still stripped (got " + JSON.stringify([strip, ph3]) + ")");

    // Pa4: requirements.md written with NO AC ID (an OpenSpec change of proposal.md + tasks.md) — the +tdd plan has no template AC rows.
    paPut("openspec/changes/add-reset/proposal.md", "# Change: Add password reset\n\n## Why\nUsers who forget their password cannot recover their accounts.\n\n## What Changes\n- Add password reset via an emailed link\n");
    paPut("openspec/changes/add-reset/tasks.md", "## 1. Implementation\n- [ ] 1.1 Create the reset token table\n- [ ] 1.2 Implement the reset endpoint\n");
    const im4 = S.importSpec(pa, "openspec", "openspec/changes/add-reset", { tracks: "tdd" });
    const plan4 = im4.ok ? fs.readFileSync(path.join(paDir(im4.feature), "test-plan.md"), "utf8") : "";
    const tr4 = im4.ok ? S.traceCheck(pa, im4.feature) : {};
    const d4 = im4.ok ? (S.specDoctor(pa, im4.feature).checks || []).find((c) => c.id === "traceability") : null;
    ok(im4.ok && !/US-\d+\.AC-\d+/.test(plan4) && /\| T-01 \|/.test(plan4) && !(tr4.phantomAcsInTests || []).length && d4 && d4.status !== "fail" &&
      (im4.warnings || []).some((w) => /no acceptance criteria/.test(w)),
      "full review Pa4: importing a source with no criteria (+tdd) plans one generic row, no template AC phantoms, and warns that requirements.md defines no AC (got " + JSON.stringify([im4.ok, im4.error, plan4.split("\n").filter((l) => /^\| T-/.test(l)), tr4.phantomAcsInTests, d4 && d4.status, im4.warnings]) + ")");
    S.createFeature(pa, "No ids", ["core"], "x", undefined, "en");
    paPut(".specs/no-ids/requirements.md", "# Feature: No ids\n\n## Summary\nThings.\n\n## User Stories\n\n### US-1 (P1): Do\n- the system shall work\n");
    const at4 = S.addTrack(pa, "no-ids", "tdd");
    const plan4b = fs.readFileSync(path.join(paDir("no-ids"), "test-plan.md"), "utf8");
    ok(at4.ok && !/US-\d+\.AC-\d+/.test(plan4b) && S.featurePlaceholders(pa, "no-ids", "test-plan.md").state === "placeholder",
      "full review Pa4: spec_add_track tdd on requirements without AC IDs scaffolds a plan with no template AC rows (still a template to fill) (got " + JSON.stringify([at4.ok, plan4b.split("\n").filter((l) => /^\| T-/.test(l))]) + ")");

    // Pa5: T-IDs restart per feature — a test file another feature's plan names never counts for this feature's T-IDs.
    const plan5 = (rows) => "# Test Plan\n\n## Traceability Matrix\n\n| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---|---|---|---|---|---|\n" + rows + "\n";
    for (const n of ["Shortener", "QR codes"]) { S.createFeature(pa, n, ["tdd"], "x", undefined, "en"); }
    for (const sl of ["shortener", "qr-codes"]) paPut(".specs/" + sl + "/requirements.md", paReq(earsGood));
    paPut(".specs/shortener/test-plan.md", plan5("| T-01 | unit | example | shortens | US-1.AC-1 | `test/shortener.test.js` |\n| T-02 | unit | example | expands | US-1.AC-2 | `test/shortener.test.js` |"));
    paPut(".specs/qr-codes/test-plan.md", plan5("| T-01 | unit | example | encodes | US-1.AC-1 | `test/` |\n| T-02 | unit | example | decodes | US-1.AC-2 | `test/` |"));
    paPut("test/shortener.test.js", 'test("T-01 shortens", () => {});\ntest("T-02 expands", () => {});\n');
    const trA = S.traceCheck(pa, "shortener", { code: true }), trB = S.traceCheck(pa, "qr-codes", { code: true });
    approveBefore(pa, "qr-codes", "tests");
    const ap5 = S.approvePhase(pa, "qr-codes", "tests", "t");
    ok(JSON.stringify(trA.code.plannedNotInCode) === "[]" && JSON.stringify(trB.code.plannedNotInCode) === '["T-01","T-02"]' && !Object.keys(trB.code.testsInCode).length &&
      !ap5.ok && (ap5.failing || []).includes("tests-in-code"),
      "full review Pa5: another feature's test file (named in ITS plan) never proves this feature's T-01/T-02 — trace --code and the Phase 4 gate see no qr test (got " + JSON.stringify([trA.code.plannedNotInCode, trB.code.plannedNotInCode, trB.code.testsInCode, ap5.ok, ap5.failing]) + ")");
    paPut("test/qr.test.js", 'test("T-01 encodes", () => {});\ntest("T-02 decodes", () => {});\n');
    const trB2 = S.traceCheck(pa, "qr-codes", { code: true });
    ok(JSON.stringify(trB2.code.testsInCode) === '{"T-01":["test/qr.test.js"],"T-02":["test/qr.test.js"]}' && !trB2.code.plannedNotInCode.length,
      "full review Pa5: the feature's own test file under its folder scope counts (got " + JSON.stringify(trB2.code) + ")");

    // Pa6: a test planned outside test code whose artifact is still a template — doctor warns, spec_finish warns (never blocks).
    S.createFeature(pa, "Load", ["tdd", "saas"], "x", undefined, "en");
    paPut(".specs/load/test-plan.md", plan5("| T-01 | load | example | P95 within budget | US-1.AC-1 | `load-test.md` |\n| T-02 | unit | example | charges | US-1.AC-2 | `tests/unit/charge.test.js` |"));
    paPut(".specs/load/tasks.md", "# Tasks\n\n- [x] 1. Run the load test\n  - _Requirements: US-1.AC-1_\n  - _Makes green: T-01_\n- [ ] 2. Charge\n  - _Requirements: US-1.AC-2_\n  - _Makes green: T-02_\n");
    const oc6 = (S.specDoctor(pa, "load").checks || []).find((c) => c.id === "outside-code-artifacts");
    const fin6 = S.finishFeature(pa, "load");
    ok(oc6 && oc6.status === "warn" && /T-01 → load-test\.md/.test(oc6.detail) && (fin6.warnings || []).includes(oc6.detail) && !(fin6.blockers || []).some((b) => /load-test/.test(b)),
      "full review Pa6: a done task's load test whose load-test.md is still the template — doctor outside-code-artifacts warn, and a spec_finish warning, never a blocker (got " + JSON.stringify([oc6, fin6.warnings, fin6.blockers]) + ")");
    paPut(".specs/load/load-test.md", "# Load test\n\nk6 run at 200 rps for 10 minutes: p95 412 ms, error rate 0.02% — within the 800 ms budget.\n");
    const oc6b = (S.specDoctor(pa, "load").checks || []).find((c) => c.id === "outside-code-artifacts");
    ok(!oc6b, "full review Pa6: once load-test.md holds the real run, no outside-code-artifacts warn (got " + JSON.stringify(oc6b) + ")");
  }

  // 1.14 feature (F5) — traceability matrix.
  {
    const call = (name, args) => rpc("tools/call", { name, arguments: args });
    const rp = path.join(tmp, "proj-f5-rtm");
    S.initProject(rp, ["tdd"], "en");
    const rf = S.createFeature(rp, "Checkout", ["tdd"], "", undefined, "en");
    fs.writeFileSync(path.join(rf.dir, "requirements.md"), [
      "# Feature: Checkout", "", "## Summary", "Pay by card.", "", "### US-1 (P1): Pay", "#### Acceptance Criteria (EARS)",
      '1. **US-1.AC-1** — WHEN the shopper pays THE SYSTEM SHALL charge "the total", in cents <script>alert(1)</script>',
      "2. **US-1.AC-2** — IF the card is declined THEN THE SYSTEM SHALL keep the cart",
      "   and show the reason to the shopper",
      "3. **US-1.AC-3** — WHEN [trigger] THE SYSTEM SHALL [behavior]",
      '4. **US-1.AC-4** — =HYPERLINK("evil") THE SYSTEM SHALL log the attempt', "",
      "### US-2 (P2): Receipt", "#### Acceptance Criteria (EARS)",
      "1. **US-2.AC-1** — WHEN the page shows <!-- as text THE SYSTEM SHALL keep it", "",
      "## Success Criteria", "- **SC-001** — 95% of checkouts finish in 30 s.", "- **SC-002** — refunds settle within a day.", "",
      "## Edge Cases", "- **EC-1** — WHEN the PSP times out THE SYSTEM SHALL retry once.", "",
      "## Non-Functional Requirements", "- **NFR-1** — p95 latency under 300 ms.", ""].join("\n"));
    fs.writeFileSync(path.join(rf.dir, "test-plan.md"), "# Test Plan\n\n| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---|---|---|---|---|---|\n" +
      "| T-01 | unit | example | charge | US-1.AC-1 | `test/charge.test.js` |\n| T-02 | unit | example | decline | US-1.AC-2, EC-1 | `test/decline.test.js` |\n" +
      "| T-03 | load | example | checkout load | SC-001 | `load-test.md` |\n| T-04 | unit | example | receipt | US-2.AC-1 | `test/receipt.test.js` |\n");
    fs.writeFileSync(path.join(rf.dir, "design.md"), "# Design: Checkout\n\n## Architecture\nCheckoutService implements US-1.AC-1.\n\n## Ops --> alerts\nNFR-1 is watched; US-1.AC-20 is another feature's.\n");
    fs.writeFileSync(path.join(rf.dir, "tasks.md"), "# Tasks\n\n## Story US-1\n" +
      '- [ ] 1. [US1] Charge\n  - _Requirements: US-1.AC-1_\n  - _Makes green: T-01_\n  - _Verify: node -e "process.exit(0)"_\n' +
      "- [ ] 2. [US1] Decline\n  - _Requirements: US-1.AC-2, EC-1_\n  - _Verify: npm run e2e_\n" +
      "- [ ] 3. [US1] Log\n  - _Requirements: US-1.AC-4_\n  ```md\n  - _Requirements: US-1.AC-3_\n  ```\n" +
      "- [ ] 4. [shared] Load\n  - _Makes green: T-03_\n- [ ] 5. [US2] Receipt\n  - _Requirements: US-2.AC-1_\n  - _Makes green: T-04_\n");
    fs.mkdirSync(path.join(rp, "test"), { recursive: true });
    fs.writeFileSync(path.join(rp, "test", "charge.test.js"), "test('T-01 charges the total', () => {});\n");
    S.completeTask(rp, "checkout", 1, { command: 'node -e "process.exit(0)"', exitCode: 0, summary: "1 passing" });
    S.completeTask(rp, "checkout", 2, { summary: "checked by hand" }); // a note on a runnable _Verify:_: ticked, not verified
    S.completeTask(rp, "checkout", 5); // no _Verify:_ and nothing recorded: nothing to verify
    const rsf = path.join(rf.dir, ".state.json");
    const rst = JSON.parse(fs.readFileSync(rsf, "utf8"));
    Object.assign(rst.evidence["1"], { commit: "abcdef1234567", dirty: false }); // what `done --run` records in a git checkout
    fs.writeFileSync(rsf, JSON.stringify(rst, null, 2));
    S.decide(rp, "checkout", { title: "Stripe, as the PSP", decision: "Use Stripe.", affects: ["US-1.AC-1", "EC-1"] });
    S.decide(rp, "checkout", { title: "Keep the cart", decision: "Keep it.", affects: ["US-1.AC-2"] });
    S.decide(rp, "checkout", { title: "Keep the cart 24 h", decision: "Keep it a day.", affects: ["US-1.AC-2"], supersedes: ["D-2"] });
    S.approvePhase(rp, "checkout", "classification", "alice", { force: true });
    S.approvePhase(rp, "checkout", "requirements", "alice", { force: true });
    fs.appendFileSync(path.join(rf.dir, "requirements.md"), "- **NFR-2** — THE SYSTEM SHALL log every charge.\n"); // after the approval
    const sso = S.createFeature(rp, "SSO", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(sso.dir, "requirements.md"), "# Feature: SSO\n\n### US-1 (P1): IdP\n1. **US-1.AC-1** — WHEN the IdP declines THE SYSTEM SHALL keep the cart _Supersedes: checkout/US-1.AC-2_\n");
    shipFeature(rp, "sso"); // 1.15: a shipped declarer retires the AC (a draft's is supersedePending)

    const mx = S.traceMatrix(rp, "checkout", { code: true });
    const row = (id) => mx.rows.find((r) => r.id === id) || {};
    const st = (id) => row(id).status + (row(id).gaps.length ? ":" + row(id).gaps.join("+") : "");
    ok(mx.ok && mx.feature === "checkout" && mx.lang === "en" && mx.kind === "feature" && mx.tracks === "core +tdd" &&
      JSON.stringify(mx.rows.map((r) => r.id)) === JSON.stringify(["US-1.AC-1", "US-1.AC-2", "US-1.AC-3", "US-1.AC-4", "US-2.AC-1", "EC-1", "NFR-1", "NFR-2", "SC-001", "SC-002"]) &&
      JSON.stringify(mx.rows.map((r) => r.kind)) === JSON.stringify(["ac", "ac", "ac", "ac", "ac", "ec", "nfr", "nfr", "sc", "sc"]) &&
      row("US-1.AC-2").text === "IF the card is declined THEN THE SYSTEM SHALL keep the cart and show the reason to the shopper" &&
      row("EC-1").text === "WHEN the PSP times out THE SYSTEM SHALL retry once." && row("US-1.AC-3").template === true && row("US-1.AC-1").template === false,
      "feature F5: traceMatrix — one row per requirement ID, the ACs in document order then EC / NFR / SC, each with its kind and its one-line text (a wrapped criterion folded, the ID dropped); a template criterion flagged (got " + JSON.stringify(mx.rows.map((r) => r.id)) + ")");
    ok(st("US-1.AC-1") === "verified" && st("US-1.AC-2") === "implemented" && st("US-1.AC-3") === "untraced:no-task+no-test" && st("US-1.AC-4") === "untraced:no-test" &&
      st("US-2.AC-1") === "verified" && st("EC-1") === "implemented" && st("NFR-1") === "untraced:no-coverage" && st("NFR-2") === "untraced:no-coverage" &&
      st("SC-001") === "planned" && st("SC-002") === "untraced:no-coverage" &&
      JSON.stringify(mx.counts) === JSON.stringify({ rows: 10, verified: 2, implemented: 2, planned: 1, untraced: 5, template: 1, superseded: 1, supersedePending: 0 }) &&
      JSON.stringify(S.RTM_STATUSES) === JSON.stringify(["verified", "implemented", "planned", "untraced"]),
      "feature F5: statuses — verified (every linked task done + verified; a task with no _Verify:_ counts), implemented (a note on a runnable _Verify:_), untraced with the trace gap (no-task / no-test / no-coverage — a fenced example citing US-1.AC-3 is no task), planned (SC-001 via T-03, its task open) (got " + mx.rows.map((r) => r.id + "=" + st(r.id)).join(" ") + ")");
    const t1 = row("US-1.AC-1").tasks[0] || {};
    const t2 = row("US-1.AC-2").tasks[0] || {};
    const t5 = row("US-2.AC-1").tasks[0] || {};
    all("feature F5: the linked tasks — citing the ID or one of its planned T-IDs (cites), done / verified with the ONE verdict's stable reason, and the latest evidence (command, exitCode, at, commit / dirty; a note as note) (got " + JSON.stringify([t1, t2.reason, t5.nothingToVerify]) + ")", [
      () => t1.number === 1, () => t1.done, () => t1.verified, () => t1.reason === null, () => JSON.stringify(t1.cites) === '["US-1.AC-1","T-01"]',
      () => t1.evidence, () => t1.evidence.command === 'node -e "process.exit(0)"', () => t1.evidence.exitCode === 0,
      () => typeof t1.evidence.at === "string", () => t1.evidence.commit === "abcdef1234567", () => t1.evidence.dirty === false,
      () => t2.number === 2, () => t2.done, () => !t2.verified, () => t2.reason === "manual-note-on-runnable-verify", () => t2.evidence,
      () => t2.evidence.note === "checked by hand", () => t2.evidence.exitCode === undefined, () => t5.verified, () => t5.nothingToVerify === true,
      () => JSON.stringify(row("SC-001").tasks.map((t) => [t.number, t.done, t.cites])) === '[[4,false,["T-03"]]]',
      () => JSON.stringify(row("US-1.AC-4").tasks.map((t) => t.number)) === "[3]", () => row("US-1.AC-3").tasks.length === 0,
    ]);
    ok(JSON.stringify(row("US-1.AC-1").tests) === '[{"id":"T-01","files":["test/charge.test.js"]}]' && JSON.stringify(row("US-1.AC-2").tests) === '[{"id":"T-02","files":[]}]' &&
      JSON.stringify(row("SC-001").tests) === '[{"id":"T-03","outsideCode":true}]' && JSON.stringify(row("EC-1").tests.map((t) => t.id)) === '["T-02"]' &&
      JSON.stringify(mx.code) === JSON.stringify({ scanned: 1, truncated: false }) && JSON.stringify(S.traceMatrix(rp, "checkout").rows[0].tests) === '[{"id":"T-01"}]' &&
      JSON.stringify(row("US-1.AC-1").design) === '["Architecture"]' && JSON.stringify(row("NFR-1").design) === '["Ops --> alerts"]' && row("US-1.AC-2").design.length === 0,
      "feature F5: tests planned for each ID (EC / SC rows too), with code: true the test files naming each T-ID (a load-test row is outsideCode); design = the sections naming the exact ID (US-1.AC-20 is not US-1.AC-2)");
    ok(JSON.stringify(row("US-1.AC-1").decisions) === '[{"id":"D-1","title":"Stripe, as the PSP","kind":"decision"}]' && JSON.stringify(row("US-1.AC-2").decisions.map((d) => d.id)) === '["D-3"]' &&
      JSON.stringify(row("EC-1").decisions.map((d) => d.id)) === '["D-1"]' && JSON.stringify(row("US-1.AC-2").supersededBy) === '["sso/US-1.AC-1"]' && row("US-1.AC-1").supersededBy.length === 0 &&
      JSON.stringify(S.traceMatrix(rp, "sso").rows[0].supersedes) === '["checkout/US-1.AC-2"]',
      "feature F5: decisions = the CURRENT decisions.md entries whose _Affects:_ name the ID (D-2, superseded by D-3, is left out); supersededBy / supersedes from the _Supersedes:_ markers");
    ok(mx.approval && mx.approval.by === "alice" && mx.approval.forced === true && mx.approval.baseline === "snapshot" && mx.approval.changed === true &&
      row("NFR-2").approval.changed === true && row("US-1.AC-1").approval.changed === false && row("US-1.AC-1").approval.by === "alice" && row("US-1.AC-1").approval.forced === true &&
      S.traceMatrix(rp, "sso").approval === null && S.traceMatrix(rp, "sso").rows[0].approval === null,
      "feature F5: the requirements approval (at / by / forced, snapshot baseline) and per row whether ITS text changed since (NFR-2 was added after the approval); never approved → null");

    // trace_check {matrix}: the same matrix (MCP = engine), never part of the verdict; without it, no matrix key.
    const plain = S.traceCheck(rp, "checkout");
    const withM = S.traceCheck(rp, "checkout", { matrix: true, code: true });
    const mcpM = payload(await call("trace_check", { name: "checkout", matrix: true, projectDir: rp }));
    ok(plain.matrix === undefined && withM.verdict === plain.verdict && withM.matrix && withM.matrix.ok === undefined && withM.matrix.feature === "checkout" &&
      JSON.stringify(withM.matrix.rows) === JSON.stringify(mx.rows) && JSON.stringify(mcpM.matrix.rows) === JSON.stringify(S.traceMatrix(rp, "checkout").rows) && mcpM.matrix.code === undefined &&
      withM.code && withM.code.testsInCode["T-01"] && S.traceMatrix(rp, "nope").ok === false,
      "feature F5: trace_check {matrix: true} (MCP = engine) returns the matrix under `matrix` — code: true shares its walk; the verdict is unchanged; an unknown feature is an error");

    // CSV (RFC 4180): quoting, CRLF, formula-injection guard; the document form (BOM + the marker record) for spec_export.
    const parseCsv = (t) => {
      const recs = [];
      let rec = [], fld = "", q = false;
      for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (q) { if (c === '"') { if (t[i + 1] === '"') { fld += '"'; i++; } else q = false; } else fld += c; }
        else if (c === '"') q = true;
        else if (c === ",") { rec.push(fld); fld = ""; }
        else if (c === "\r" && t[i + 1] === "\n") { rec.push(fld); recs.push(rec); rec = []; fld = ""; i++; }
        else fld += c;
      }
      if (fld || rec.length) { rec.push(fld); recs.push(rec); }
      return recs;
    };
    const csv = S.matrixCsv([mx], "en");
    const recs = parseCsv(csv);
    const hdr = recs[0] || [];
    const col = (name) => hdr.indexOf(name);
    const rec = (id) => recs.find((r) => r[1] === id) || [];
    all("feature F5: matrixCsv — RFC 4180 (CRLF records, every record as wide as the header, a field with a comma / quote quoted and its quotes doubled), a criterion starting with '=' neutralized with an apostrophe; tasks, evidence, gaps, supersession, approval in words (got " + JSON.stringify(recs.slice(0, 2)) + ")", [
      () => csv.charCodeAt(0) !== 0xfeff, () => csv.endsWith("\r\n"), () => !/[^\r]\n/.test(csv), () => recs.length === 11,
      () => recs.every((r) => r.length === hdr.length),
      () => hdr.join(",") === "Feature,ID,Kind,Requirement,Status,Gaps,Template,Design sections,Tasks,Tests,Test files,Latest evidence,Decisions,Supersedes,Superseded by,Requirements approved,Approved by,Changed since approval",
      () => csv.includes('"WHEN the shopper pays THE SYSTEM SHALL charge ""the total"", in cents <script>alert(1)</script>"'),
      () => rec("US-1.AC-1")[col("Requirement")] === row("US-1.AC-1").text,
      () => rec("US-1.AC-4")[col("Requirement")] === "'" + row("US-1.AC-4").text,
      () => csv.includes('"\'=HYPERLINK(""evil"") THE SYSTEM SHALL log the attempt"'),
      () => rec("US-1.AC-2")[col("Tasks")] === "#2 done, not verified (note only, _Verify:_ command not run)",
      () => rec("US-2.AC-1")[col("Tasks")] === "#5 done (nothing to verify)",
      () => /^#1: node -e "process\.exit\(0\)" → exit 0 @abcdef123456 · \d{4}-/.test(rec("US-1.AC-1")[col("Latest evidence")]),
      () => rec("US-1.AC-1")[col("Decisions")] === "D-1 Stripe, as the PSP", () => rec("SC-001")[col("Test files")] === "T-03: run outside test code",
      () => rec("US-1.AC-2")[col("Test files")] === "T-02: in no test file",
      () => rec("US-1.AC-3")[col("Gaps")] === "no task cites it; no test-plan row covers it",
      () => rec("SC-002")[col("Gaps")] === "no test-plan row or quickstart line covers it",
      () => rec("US-1.AC-2")[col("Superseded by")] === "sso/US-1.AC-1", () => rec("NFR-2")[col("Changed since approval")] === "yes",
      () => rec("US-1.AC-1")[col("Changed since approval")] === "no", () => rec("US-1.AC-1")[col("Approved by")] === "alice (forced)",
      () => rec("US-1.AC-3")[col("Template")] === "yes", () => rec("EC-1")[col("Kind")] === "EC",
    ]);
    ok(S.csvCell("plain") === "plain" && S.csvCell(null) === "" && S.csvCell('a,"b"') === '"a,""b"""' && S.csvCell("a\nb") === '"a\nb"' && S.csvCell("a\r\nb") === '"a\r\nb"' &&
      S.csvCell("=1+1") === "'=1+1" && S.csvCell("+1") === "'+1" && S.csvCell("-1") === "'-1" && S.csvCell("@SUM(A1)") === "'@SUM(A1)" && S.csvCell("\tx") === "'\tx" &&
      S.csvCell("\rx") === "\"'\rx\"" && S.csvCell(" =x") === " =x" && S.csvCell("x=1") === "x=1" && S.csvCell(-3) === "'-3",
      "feature F5: csvCell — quoted only when it must be (comma, quote, CR, LF — quotes doubled); a leading = + - @ tab or CR gets an apostrophe (OWASP CSV injection)");

    // spec_export {format: "csv"}: .specs/exports/<slug>.rtm.csv — BOM, the marker as the LAST record; never over a hand-written file.
    const ex = S.exportSpecs(rp, { name: "checkout", format: "csv" });
    const exRecs = parseCsv((ex.content || "").slice(1));
    const last = exRecs[exRecs.length - 1] || [];
    const noCode = S.matrixCsv([S.traceMatrix(rp, "checkout")], "en"); // the export reads the specs only: no Test files column
    ok(ex.ok && ex.format === "csv" && ex.scope === "feature" && ex.feature === "checkout" && ex.file === path.join(rp, ".specs", "exports", "checkout.rtm.csv") &&
      ex.content.charCodeAt(0) === 0xfeff && ex.content.slice(1, 1 + noCode.length) === noCode && !/Test files/.test(noCode) && exRecs.length === 12 && exRecs.every((r) => r.length === hdr.length - 1) &&
      /^# AUTO-GENERATED by dev-spec — do not edit by hand\./.test(last[0]) && last.slice(1).every((c) => c === "") && ex.content.endsWith("\r\n"),
      "feature F5: spec_export {format: 'csv'} — the same records with a UTF-8 BOM first (Excel reads the accents) and the AUTO-GENERATED marker as the LAST record (first cell, the rest empty — the header stays the first row)");
    const exW = S.exportSpecs(rp, { name: "checkout", format: "csv", write: true });
    const exW2 = S.exportSpecs(rp, { name: "checkout", format: "csv", write: true });
    const pw = S.exportSpecs(rp, { format: "csv", write: true });
    const pRecs = parseCsv(fs.readFileSync(path.join(rp, ".specs", "exports", "project.rtm.csv"), "utf8").slice(1));
    const handCsv = path.join(rp, ".specs", "exports", "checkout.rtm.csv");
    fs.writeFileSync(handCsv, "ID,Owner\r\nUS-1.AC-1,alice\r\n");
    const exH = S.exportSpecs(rp, { name: "checkout", format: "csv", write: true });
    all("feature F5: spec_export csv {write} — .specs/exports/checkout.rtm.csv, rewritten next time (its marker record); the project: project.rtm.csv with every active feature's rows; a hand-written .rtm.csv is never overwritten (error, file unchanged)", [
      () => exW.ok, () => exW.wrote === true, () => exW.content === undefined, () => exW.bytes > 500, () => exW2.ok, () => exW2.wrote, () => pw.ok,
      () => pw.file === path.join(rp, ".specs", "exports", "project.rtm.csv"), () => JSON.stringify(pw.features) === '["checkout","sso"]',
      () => pRecs.filter((r) => r[0] === "checkout").length === 10, () => pRecs.some((r) => r[0] === "sso" && r[1] === "US-1.AC-1"),
      () => exH.ok === false, () => exH.skipped === true,
      () => /\.specs\/exports\/checkout\.rtm\.csv exists and was not generated by dev-spec/.test(exH.error),
      () => fs.readFileSync(handCsv, "utf8") === "ID,Owner\r\nUS-1.AC-1,alice\r\n",
      () => !S.listFeatures(rp).features.some((f) => f.name === "exports"),
    ]);

    // The HTML / md feature document gains the matrix; every cell escaped; the project document gets the counts.
    const html = S.exportSpecs(rp, { name: "checkout" }).content || "";
    const sec = html.slice(html.indexOf('<section id="s-rtm">'), html.indexOf("</section>", html.indexOf('<section id="s-rtm">')));
    ok(/<section id="s-rtm">\n<h2>Traceability matrix<\/h2>/.test(html) && /<li><a href="#s-rtm">Traceability matrix<\/a><\/li>/.test(html) &&
      sec.includes("<td>US-1.AC-1</td><td>WHEN the shopper pays THE SYSTEM SHALL charge &quot;the total&quot;, in cents &lt;script&gt;alert(1)&lt;/script&gt;</td><td>✅ verified</td><td>Architecture</td><td>#1 ✅</td><td>T-01</td><td>D-1</td>") &&
      (html.match(/<script/g) || []).length === 1 && !/https?:\/\//.test(html) && /<td><del>US-1\.AC-2<\/del><\/td><td>IF the card is declined[^<]*<em>\(superseded by <code>sso\/US-1\.AC-1<\/code>\)<\/em><\/td><td>⚠ implemented<\/td>/.test(sec) &&
      sec.includes("<td>US-2.AC-1</td><td>WHEN the page shows &lt;!-- as text THE SYSTEM SHALL keep it</td>") && sec.includes("<td>NFR-1</td>") && sec.includes("<td>Ops --&gt; alerts</td>") &&
      /<td>✗ untraced — no task cites it; no test-plan row covers it<\/td>/.test(sec) && /\(template — not written yet\)/.test(sec) && /changed since the requirements approval/.test(sec) &&
      /Requirements approved \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC by alice \(with --force\)\./.test(sec),
      "feature F5: the HTML export's Traceability matrix section — every cell escaped (a <script> in a criterion is text, the page's own script the only one), an HTML comment opener in one row never swallows the rows up to a later '-->', superseded struck through, gaps, template and changed-since noted");
    const md = S.exportSpecs(rp, { name: "checkout", format: "md" }).content || "";
    const pmd = S.exportSpecs(rp, { format: "md" }).content || "";
    const spk = S.createFeature(rp, "Cache spike", ["core"], "", undefined, "en", "spike");
    const spkMd = spk.ok ? S.exportSpecs(rp, { name: "cache-spike", format: "md" }).content || "" : "";
    ok(/\n## Traceability matrix\n\n_One row per requirement ID\./.test(md) && /\n\| ID \| Requirement \| Status \| Design sections \| Tasks \| Tests \| Decisions \|\n\|---\|---\|---\|---\|---\|---\|---\|\n\| US-1\.AC-1 \| /.test(md) &&
      md.includes("| US-2.AC-1 | WHEN the page shows &lt;!-- as text THE SYSTEM SHALL keep it |") && !/\n\n\n/.test(md.replace(/```[\s\S]*?```/g, "F")) &&
      /\n## Traceability\n\n_Requirement IDs \(AC \/ EC \/ NFR \/ SC\) per feature/.test(pmd) && pmd.includes("| checkout | 10 | 2 | 2 | 1 | 5 |") && pmd.includes("| sso | 1 | 0 | 0 | 1 | 0 |") &&
      spk.ok && !/Traceability matrix/.test(spkMd) && S.traceMatrix(rp, "cache-spike").rows.length === 0,
      "feature F5: the md export carries the same matrix (a '<!--' shown as its entity), the project document each feature's counts by status; a spike has no matrix section");

    // MCP spec_export csv = the engine; the format enum lists csv.
    const mcpCsv = payload(await call("spec_export", { name: "checkout", format: "csv", projectDir: rp }));
    const mcpBad = await call("spec_export", { name: "checkout", format: "xlsx", projectDir: rp });
    ok(mcpCsv.ok && mcpCsv.content === S.exportSpecs(rp, { name: "checkout", format: "csv" }).content && mcpBad.result.isError === true && /html, md, csv/.test(mcpBad.result.content[0].text),
      "feature F5: MCP spec_export {format: 'csv'} = the engine call; the format enum is html | md | csv");

    // Localized headers and labels (PT / ES / pt-BR); the IDs and the kind column stay English; the message keys agree.
    const xpt = path.join(tmp, "proj-f5-rtm-pt");
    S.initProject(xpt, ["core"], "pt");
    const pf = S.createFeature(xpt, "Pagamento", ["core"], "Pagar.", undefined, "pt");
    fs.writeFileSync(path.join(pf.dir, "requirements.md"), "# Feature: Pagamento\n\n### US-1 (P1): Pagar\n1. **US-1.AC-1** — QUANDO o cliente paga O SISTEMA DEVE cobrar o total\n");
    fs.writeFileSync(path.join(pf.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Cobrar\n");
    const xes = path.join(tmp, "proj-f5-rtm-es");
    S.initProject(xes, ["core"], "es");
    const ef = S.createFeature(xes, "Pagos", ["core"], "Pagar.", undefined, "es");
    fs.writeFileSync(path.join(ef.dir, "requirements.md"), "# Feature: Pagos\n\n### US-1 (P1): Pagar\n1. **US-1.AC-1** — CUANDO el cliente paga EL SISTEMA DEBE cobrar el total\n");
    fs.writeFileSync(path.join(ef.dir, "tasks.md"), "# Tareas\n\n- [ ] 1. [US1] Cobrar\n");
    const ptCsv = S.matrixCsv([S.traceMatrix(xpt, "pagamento")], "pt");
    const esCsv = S.matrixCsv([S.traceMatrix(xes, "pagos")], "es");
    const ptMd = S.exportSpecs(xpt, { name: "pagamento", format: "md" }).content || "";
    const esMd = S.exportSpecs(xes, { name: "pagos", format: "md" }).content || "";
    const ptDoc = S.exportSpecs(xpt, { name: "pagamento", format: "csv" }).content || "";
    const keys = (o) => Object.keys(o).sort().map((k) => k + (o[k] && typeof o[k] === "object" && !Array.isArray(o[k]) ? "{" + keys(o[k]) + "}" : Array.isArray(o[k]) ? "[" + o[k].length + "]" : "")).join(",");
    ok(ptCsv.startsWith("Feature,ID,Tipo,Requisito,Estado,Lacunas,Template,Secções do design,Tasks,Testes,Última evidência,") && /\r\npagamento,US-1\.AC-1,AC,QUANDO o cliente paga O SISTEMA DEVE cobrar o total,sem rastreio,nenhuma task o cita,/.test(ptCsv) &&
      esCsv.startsWith("Función,ID,Tipo,Requisito,Estado,Lagunas,Plantilla,Secciones del diseño,Tareas,Pruebas,Última evidencia,") && /,sin trazar,ninguna tarea lo cita,/.test(esCsv) &&
      /\n## Matriz de rastreabilidade\n/.test(ptMd) && /\| ID \| Requisito \| Estado \| Secções do design \| Tasks \| Testes \| Decisões \|/.test(ptMd) && /Requisitos ainda não aprovados\./.test(ptMd) &&
      /\n## Matriz de trazabilidad\n/.test(esMd) && /✗ sin trazar — ninguna tarea lo cita/.test(esMd) && /\r\n# AUTO-GERADO por dev-spec — não editar à mão\./.test(ptDoc) &&
      S.msg("pt-BR").rtm.cols.testFiles === "Arquivos de teste" && S.msg("pt-BR").rtm.status.planned === "planejado" &&
      keys(S.msg("en").rtm) === keys(S.msg("pt").rtm) && keys(S.msg("pt").rtm) === keys(S.msg("es").rtm),
      "feature F5: headers and labels in the feature's language (PT / ES CSV, md export, the PT marker record), pt-BR derived from PT; IDs, AC and the kind stay English; the rtm messages have the same keys in EN / PT / ES");
  }

  // 1.17 H — linear markdown heading / line patterns: a heading, list item, table row or marker holding a long run of blanks,
  // backticks, '#', ':1' … — or a line terminator after it — is read in linear time. Those patterns backtracked quadratically
  // (Given/When/Then cubically) and stalled the synchronous MCP server or a hook (10 s timeout). Relative bounds: the same calls
  // on a small project, generous factors (Docker Linux is slow). The outputs are the old patterns' (a differential check ran
  // every rewritten reader against them on the repo's markdown and random text).
  {
    const js = (v) => JSON.stringify(v);
    const safe = (fn) => { try { return fn(); } catch (e) { return { ok: false, threw: true, error: "THREW: " + e.message }; } };
    const put = (root, rel, s) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
    const timed = (fn) => { const t0 = Date.now(); const r = safe(fn); return { ms: Date.now() - t0, r: r || {} }; };
    const sp = (n) => " ".repeat(n);
    const LS = String.fromCharCode(0x2028);
    const N = 100000;
    const mk = (name) => { const p = path.join(tmp, name); S.initProject(p, ["core", "tdd"], "en"); S.createFeature(p, "lin", ["core", "tdd"], "Linear reads"); return p; };
    const reads = (p) => [() => S.statusFeature(p, "lin"), () => S.specDoctor(p, "lin"), () => S.traceCheck(p, "lin", { matrix: true }), () => S.earsFeature(p, "lin"),
      () => S.clarify(p, "lin"), () => S.nextAction(p, "lin"), () => S.taskBrief(p, "lin", 1), () => S.exportSpecs(p, { name: "lin" }), () => S.catalog(p, {})];
    const small = mk("p17h-small");
    reads(small).forEach((f) => safe(f)); // warm up
    const base = reads(small).map((f) => timed(f).ms).reduce((a, b) => a + b, 0);
    const bound = 10 * Math.max(base, 100) + 6000; // linear stays far below; the quadratic scanners took minutes (Node 18 in Docker is ~2x slower)

    // L1 — the spec artifacts every tool reads: tasks.md (the task scanner), design.md / requirements.md headings, decisions.md,
    // a long fence / backtick run, a TODO sentinel after a long blank run, a table separator row with a long blank run.
    const big = mk("p17h-big");
    put(big, ".specs/lin/requirements.md", "# Requirements\n\n## User Story 1\n\n#### Acceptance Criteria" + sp(N) + "x" + LS + "y\n\n- US-1.AC-1 WHEN a" + sp(N) +
      "b THE SYSTEM SHALL c\n" + "\n".repeat(N / 10) + "> **TODO**\n- US-1.AC-2 WHEN d THE SYSTEM SHALL e _Supersedes: other/US-1.AC-1" + sp(N) + "\n### " + sp(N) + "z" + LS + "w\n");
    put(big, ".specs/lin/design.md", "# Design\n\n## Data" + sp(N) + "Model" + LS + "\n\n## A" + sp(N) + "#\n\n## Constitution Check\n\n" + "`".repeat(N / 4) + "x\n\n| a |\n|---" + sp(N) + "x\n");
    put(big, ".specs/lin/tasks.md", "# Tasks\n\n## Phase" + sp(N) + "1\n\n- [ ] 1." + sp(N) + "a" + LS + "b\n- [ ] 2. do _Requirements: US-1.AC-1_ _Verify:" + sp(N) + "_\n" +
      "  _Implements: src/a.js" + ":1".repeat(N / 4) + "x_\n```" + "~".repeat(10) + "\n" + "~".repeat(N / 4) + "\r\n");
    put(big, ".specs/lin/decisions.md", "# Decisions\n\n## D-1 — Title" + sp(N) + "##\n- _Kind:" + sp(N) + "discovery_\n\n**Context:** c\n");
    const bigRuns = reads(big).map((f) => timed(f));
    const bigMs = bigRuns.reduce((a, x) => a + x.ms, 0);
    ok(bigRuns.every((x) => !x.r.threw) && bigMs < bound,
      "1.17 linear headings: status / doctor / trace (+ matrix) / EARS / clarify / next action / brief / export / catalog on a feature whose headings, task lines, markers, fences and table rows hold 100,000-character runs (and line terminators after them) run within 10 × the small feature's time + 6 s — the task scanner's heading pattern alone took minutes (got " + js({ base, big: bigMs, each: bigRuns.map((x) => x.ms), threw: bigRuns.filter((x) => x.r.threw).map((x) => x.r.error) }) + ")");
    const tb = S.taskBlocks("## Phase" + sp(N) + "one  \n\n- [ ] 1. a\n- [ ] 2. b" + LS + "c\n");
    const dl = S.decisionLog("## D-1 — Title" + sp(N) + "##\n- _Kind:" + sp(N) + "discovery_\n");
    // (1.24 r6 D3: a U+2028 inside a task's text is an ordinary character — the task is read; 1.17 H kept the regex's "no task")
    ok(tb.length === 2 && tb[1].text === "b" + LS + "c" && tb[0].phase === "Phase" + sp(N) + "one" && S.markdownToHtml("## Title" + sp(N) + "##\n") === "<h2>Title</h2>" &&
      S.markdownToHtml("# a" + sp(3) + "b #") === "<h1>a" + sp(3) + "b</h1>" && dl.length === 1 && dl[0].title === "Title" && dl[0].kind === "discovery" &&
      js(S.taskMarkers(S.taskBlocks("- [ ] 1. t _Implements: src/a.js:12-20_ _Verify: `npm test`_\n")[0]).verify) === js(["npm test"]),
      "1.17 linear headings: the readers keep their answers — a heading's text is what lies between the blanks after its '#'s and the blanks (or a closing '##') at its end; a U+2028 inside a task line's text is an ordinary character (1.24 r6 D3); a decision heading's closing '##' and a marker's blanks go (got " + js([tb.map((b) => [b.number, b.phase && b.phase.length]), dl]) + ")");

    // L2 — the importers (spec_import is one synchronous call): Kiro, spec-kit, OpenSpec, a plan, an ExecPlan and BMAD sources whose
    // headings, criteria, scenarios and list items hold long blank runs, a line terminator after them, or a long run of keywords.
    const imp = path.join(tmp, "p17h-import");
    S.initProject(imp, ["core"], "en");
    const src = (tag) => ({
      kiro: [".kiro/specs/" + tag + "/requirements.md", "# Requirements\n\n### Requirement 1" + sp(N) + "x" + LS + "\n\n**User Story:** I want" + sp(N) + "x" + LS + "y\n\n#### Acceptance Criteria\n\n1. WHEN a" + sp(N) + "b" + LS + "c\n2. " + "WHEN a ".repeat(N / 7) + "\n3. WHEN x THEN the system returns y\n"],
      "spec-kit": ["specs/001-" + tag + "/spec.md", "# Feature Specification: X\n\n**Input**:" + sp(N) + "\n\n### User Story 1 - T" + sp(N) + "x" + LS + "\n\n**Acceptance Scenarios**" + sp(N) + "x\n\n1. **Given** a" + sp(N) + "x, **When** b" + sp(N) + "y" + LS + "\n2. " + "Given a when b ".repeat(N / 15) + "\n3. Given a, when b, then c\n"],
      openspec: ["openspec/changes/" + tag + "/specs/cap/spec.md", "## RENAMED Requirements\n\n- FROM: `### Requirement:" + sp(N) + "x`\ry\n- TO: `### Requirement: z`\n\n## ADDED Requirements\n\n### Requirement: R" + sp(N) + "\n\nThe system SHALL work.\n\n#### Scenario:" + sp(N) + "x" + LS + "\n\n- **WHEN**" + sp(N) + "a" + LS + "b\n"],
      plan: ["plans/" + tag + ".md", "# Plan\n\n## Goals\n\n- When a" + sp(N) + ", b\n- Run `npm test`" + sp(N) + "passes" + LS + "\n\n## Steps\n\n- [ ]" + sp(N) + "a" + LS + "b\n1." + sp(N) + "x" + LS + "\n- [ ] step `src/a.ts" + ":1".repeat(N / 4) + "x`\n"],
      execplan: ["execplans/" + tag + "/PLANS.md", "```md\n# ExecPlan\n\n## Progress\n\n- [ ] step" + sp(N) + "x" + LS + "\n- [ ] two\n\n## Validation and Acceptance\n\n- Given a" + sp(N) + "then b" + LS + "\n```" + sp(N) + "\n"],
      bmad: ["bmad-" + tag + "/docs/prd.md", "# Product Requirements Document" + sp(N) + "(PRD)" + sp(N) + ":\n\n## Requirements\n\n- FR1:" + sp(N) + "x" + LS + "y\n- FR2: z\n- **NFR2**:" + sp(N) + "**" + sp(N) + "\n#### FR-3:" + sp(N) + "x" + LS + "\n\n## Epic 1\n\n### Story 1.1:" + sp(N) + "x" + LS + "\n\n#### Acceptance Criteria" + sp(N) + "x\n\n1. AC" + sp(N) + "#" + sp(N) + "1: x\n"],
    });
    const smallSrc = (tag) => ({
      kiro: [".kiro/specs/" + tag + "/requirements.md", "# Requirements\n\n### Requirement 1\n\n**User Story:** I want x\n\n#### Acceptance Criteria\n\n1. WHEN a THEN the system returns b\n"],
      "spec-kit": ["specs/001-" + tag + "/spec.md", "# Feature Specification: X\n\n**Input**: x\n\n### User Story 1 - T\n\n**Acceptance Scenarios**\n\n1. Given a, when b, then c\n"],
      openspec: ["openspec/changes/" + tag + "/specs/cap/spec.md", "## ADDED Requirements\n\n### Requirement: R\n\nThe system SHALL work.\n\n#### Scenario: s\n\n- **WHEN** a\n- **THEN** b\n"],
      plan: ["plans/" + tag + ".md", "# Plan\n\n## Goals\n\n- When a, b\n\n## Steps\n\n- [ ] a\n"],
      execplan: ["execplans/" + tag + "/PLANS.md", "# ExecPlan\n\n## Progress\n\n- [ ] step\n\n## Validation and Acceptance\n\n- Given a then b\n"],
      bmad: ["bmad-" + tag + "/docs/prd.md", "# Product Requirements Document\n\n## Requirements\n\n- FR1: x\n\n## Epic 1\n\n### Story 1.1: x\n\n#### Acceptance Criteria\n\n1. x\n"],
    });
    const importAll = (make, tag) => Object.entries(make(tag)).map(([tool, [rel, text]]) => {
      put(imp, rel, text);
      const from = tool === "kiro" || tool === "spec-kit" || tool === "openspec" ? path.dirname(rel) : tool === "bmad" ? rel.split("/")[0] : rel;
      return timed(() => S.importSpec(imp, tool, from, { name: tag + " " + tool, tracks: ["core"] }));
    });
    importAll(smallSrc, "warm");
    const impBaseRuns = importAll(smallSrc, "base");
    const impBase = impBaseRuns.reduce((a, x) => a + x.ms, 0);
    const impBig = importAll(src, "big");
    const impMs = impBig.reduce((a, x) => a + x.ms, 0);
    ok(impBaseRuns.every((x) => x.r.ok) && impBig.every((x) => x.r.ok) && impMs < 10 * Math.max(impBase, 100) + 6000, // the headings check's bound (a cubic pattern took minutes; 5× + 3 s missed by 21 ms under a loaded parallel run)
      "1.17 linear headings: spec_import from Kiro, spec-kit, OpenSpec, a plan, an ExecPlan and BMAD with 100,000-character blank runs in headings, criteria, scenarios and list items (a line terminator after them), a run of 15,000 'when's in one scenario and ':1' × 25,000 in a path — within 10 × the small imports' time + 6 s (the Given/When/Then pattern was cubic) (got " + js({ base: impBase, big: impMs, each: impBig.map((x) => x.ms), errors: impBig.filter((x) => !x.r.ok).map((x) => x.r.error) }) + ")");

    // L3 — the hooks' and the classifier's own reads: the stop gate's prose (4,000 unclosed '<!--' and a 3,000-backtick fence run),
    // classify on a text with 50,000 blank lines, a git log header with a long blank run and a line terminator.
    const hk = mk("p17h-hooks");
    const hookRuns = [
      timed(() => S.stopCheck(hk, { message: "All tasks done. " + "<!--".repeat(4000) + "\n" + "`".repeat(3000) })),
      timed(() => S.classify("Criar " + "\n".repeat(N / 2) + "x")),
      timed(() => S.taskCommits(hk, "lin", "commit " + "a".repeat(40) + "\nAuthor:" + sp(N) + "x\r\nDate: y\n\n    task" + sp(N) + "1 lin\n")),
    ];
    const hookMs = hookRuns.reduce((a, x) => a + x.ms, 0);
    ok(hookRuns.every((x) => !x.r.threw) && hookMs < bound && S.classify("x" + "\n".repeat(3) + "Criar o pedido e gravar a fatura").lang === "pt",
      "1.17 linear headings: the stop gate's prose (4,000 unclosed '<!--', a 3,000-backtick run), classify's clause starts after 50,000 blank lines and a git log header with a 100,000-space run stay linear, within the bound above — a hook has 10 s (got " + js({ each: hookRuns.map((x) => x.ms), threw: hookRuns.filter((x) => x.r.threw).map((x) => x.r.error) }) + ")");
  }

  // 1.21.1 languages — the test-code scan reads the tests of every language of the code list (isCodeFile + isTestFile): a
  // T-ID in a Bats suite, a GoogleTest *_test.cc, a busted *_spec.lua, a testthat test-*.R, a Pester *.Tests.ps1 (beside the
  // code too), Perl's t/*.t, an EUnit / hspec / clojure.test file — never a source file, nor a .t outside t/. Until 1.21.1 it
  // read only JS/TS, Python, Go, Rust, Java, Ruby, PHP, C#, Kotlin, Swift, C/C++, Vue/Svelte (+ F#, Scala, Groovy, Elixir, Dart).
  {
    const js = (v) => JSON.stringify(v);
    const put = (root, rel, s) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
    const lp = path.join(tmp, "proj-121-test-scan");
    put(lp, "test/deploy.bats", "@test \"T-01 deploys\" {\n  run ./deploy.sh\n  [ \"$status\" -eq 0 ]\n}\n");
    put(lp, "src/codec_test.cc", "TEST(Codec, T02_RoundTrips) { EXPECT_EQ(1, 1); }\n");
    put(lp, "lua/codec_spec.lua", "describe('codec', function() it('T-03 decodes', function() end) end)\n");
    put(lp, "R/test-codec.R", "test_that(\"T-04 encodes\", { expect_equal(1, 1) })\n");
    put(lp, "src/Codec.Tests.ps1", "Describe 'Codec' { It 'T-05 encodes' { 1 | Should -Be 1 } }\n");
    put(lp, "t/basic.t", "use Test::More;\nok(1, 'T-06 loads');\ndone_testing;\n");
    put(lp, "src/codec_tests.erl", "%% T-07 round-trips\n-module(codec_tests).\n");
    put(lp, "test/CodecSpec.hs", "spec = it \"T-08 decodes\" $ True `shouldBe` True\n");
    put(lp, "src/core_test.clj", "(deftest decodes (testing \"T-09 decodes\" (is true)))\n");
    put(lp, "notes.t", "T-10 is no test\n");
    put(lp, "src/codec.lua", "-- T-11 lives in source\n");
    put(lp, "src/codec.ps1", "# T-12 lives in source\n");
    put(lp, "src/DevSpec.hs", "-- T-13 lives in source (a module named …Spec, outside a test folder)\n");
    put(lp, "tests/fixtures/seed.sql", "insert into t values ('T-14');\n"); // a fixture — never read
    put(lp, "tests/test_schema.sql", "select plan(1); -- T-15 pgTAP\n"); // a pgTAP test by its name
    const sc = S.scanTestCode(lp);
    const where = (n) => ((sc.tids.get("T-" + n) || {}).files || []).join();
    const want = ["test/deploy.bats", "src/codec_test.cc", "lua/codec_spec.lua", "R/test-codec.R", "src/Codec.Tests.ps1", "t/basic.t", "src/codec_tests.erl", "test/CodecSpec.hs", "src/core_test.clj", "", "", "",
      "", "", "tests/test_schema.sql"];
    const got = want.map((_, i) => where(i + 1));
    const t0 = Date.now();
    const lin = [S.isTestFile("test_" + "a.".repeat(100000) + "x"), S.isTestFile("x" + "_test".repeat(20000) + ".q"), S.isTestFile(".test".repeat(20000) + "."), S.isTestFile("t/" + "x".repeat(100000) + ".tests.ps1q")];
    const linMs = Date.now() - t0;
    ok(js(got) === js(want) && sc.scanned === 10 && !sc.truncated && lin.join() === "false,false,false,false" && linMs < 3000,
      "1.21.1 languages: scanTestCode finds T-IDs in a .bats suite, a _test.cc (T02_…), a _spec.lua, a test-x.R, a *.Tests.ps1 outside tests/, Perl's t/basic.t, a _tests.erl, test/*Spec.hs, a _test.clj and a pgTAP tests/test_*.sql — never in notes.t, src/DevSpec.hs, a source file or a tests/fixtures/*.sql fixture; the test-name rule stays linear on 100,000-character names (got " +
      js([got, sc.scanned, linMs]) + ")");

    // 1.21.1 review: 1,600 .sql fixtures under tests/fixtures/ no longer exhaust the read cap (1.21.1's first cut: 1,500 read,
    // truncated, the real test's T-01 missing); past the cap the test-NAMED files are read first; a file is read up to
    // SCAN_READ_BYTES from disk (a T-ID past 200 KB of a 5 MB test file is not seen).
    const fx = path.join(tmp, "proj-121-fixtures");
    for (let i = 0; i < 1600; i++) put(fx, "tests/fixtures/f" + String(i).padStart(4, "0") + ".sql", "insert into t values ('T-01');\n");
    put(fx, "tests/unit/greet.test.js", "test(\"T-01 greets\", () => {});\n");
    const scFx = S.scanTestCode(fx);
    const cap = path.join(tmp, "proj-121-cap");
    for (let i = 0; i < 1510; i++) put(cap, "tests/data/d" + String(i).padStart(4, "0") + ".js", "module.exports = " + i + ";\n");
    put(cap, "tests/zz/greet.test.js", "test(\"T-02 greets\", () => {});\n");
    put(cap, "tests/zz/big.test.js", "test(\"T-03 early\", () => {});\n" + "/* " + "x".repeat(5 * 1024 * 1024) + " */\ntest(\"T-04 late\", () => {});\n");
    const t1 = Date.now();
    const scCap = S.scanTestCode(cap);
    const capMs = Date.now() - t1;
    ok(scFx.scanned === 1 && !scFx.truncated && js((scFx.tids.get("T-1") || {}).files) === '["tests/unit/greet.test.js"]' &&
      scCap.truncated === true && scCap.scanned === 1500 && js((scCap.tids.get("T-2") || {}).files) === '["tests/zz/greet.test.js"]' && !!scCap.tids.get("T-3") && !scCap.tids.get("T-4") && capMs < 20000,
      "1.21.1 languages: the test-code scan skips tests/fixtures/*.sql (1 test file read, T-01 found only in greet.test.js); past the 1,500-file cap it reads the test-NAMED files first (T-02 in tests/zz/greet.test.js found behind 1,510 tests/data/*.js); a 5 MB test file is read up to 200 KB (T-03 seen, T-04 not) (got " +
      js([scFx.scanned, scFx.truncated, scCap.scanned, scCap.truncated, !!scCap.tids.get("T-2"), !!scCap.tids.get("T-4"), capMs]) + ")");

    // A +tdd PowerShell feature: the tests gate (Phase 4) and trace_check {code} pass once the Pester files — tests/ and beside
    // the module — and a Bats suite name the planned T-IDs (a .bats row is code: expected in a test file, never "outside code").
    const pw = path.join(tmp, "proj-121-pester-gate");
    S.initProject(pw, ["core", "tdd"], "en");
    const f = S.createFeature(pw, "Greeter", ["core", "tdd"], "", undefined, "en");
    put(pw, "src/Greeter/Greeter.psm1", "function Get-Greeting { param([string]$Name) throw 'not implemented' }\n");
    put(f.dir, "test-plan.md", "# Test Plan\n\n| Test ID | Kind | Covers | File |\n|---|---|---|---|\n| T-01 | example | US-1.AC-1 | `tests/Greeter.Tests.ps1` |\n" +
      "| T-02 | example | US-1.AC-1 | `src/Greeter/Greeter.Tests.ps1` |\n| T-03 | example | US-1.AC-1 | `test/greet.bats` |\n");
    approveBefore(pw, f.slug, "tests");
    const before = S.traceCheck(pw, f.slug, { code: true }).code || {};
    const gate0 = S.approvePhase(pw, f.slug, "tests");
    put(pw, "tests/Greeter.Tests.ps1", "BeforeAll { Import-Module \"$PSScriptRoot/../src/Greeter/Greeter.psm1\" -Force }\nDescribe 'Get-Greeting' {\n" +
      "  It 'T-01 greets by name (US-1.AC-1)' { Get-Greeting -Name 'Ana' | Should -Be 'Hello, Ana' }\n}\n");
    put(pw, "src/Greeter/Greeter.Tests.ps1", "Describe 'Get-Greeting' { It 'T-02 greets nobody' { Get-Greeting | Should -Be 'Hello' } }\n");
    const mid = S.traceCheck(pw, f.slug, { code: true }).code || {};
    const gate1 = S.approvePhase(pw, f.slug, "tests");
    put(pw, "test/greet.bats", "@test \"T-03 greets from the shell\" {\n  run pwsh -NoProfile -Command \"Get-Greeting\"\n}\n");
    const mcpTr = payload(await rpc("tools/call", { name: "trace_check", arguments: { projectDir: pw, name: f.slug, code: true } }));
    const gate2 = S.approvePhase(pw, f.slug, "tests");
    ok(js(before.plannedNotInCode) === '["T-01","T-02","T-03"]' && !(before.plannedOutsideCode || []).length && gate0.refused === true && js(gate0.failing) === '["tests-in-code"]' &&
      /T-01, T-02, T-03/.test(gate0.error) && js(mid.plannedNotInCode) === '["T-03"]' && gate1.refused === true && /names yet: T-03/.test(gate1.error) &&
      mcpTr.ok && js(mcpTr.code.plannedNotInCode) === "[]" && mcpTr.code.scanned === 3 && gate2.ok === true && !gate2.forced,
      "1.21.1 languages: a +tdd PowerShell feature — trace_check {code} and the tests gate (approve tests) name T-01…T-03 missing, then only the Bats one once tests/Greeter.Tests.ps1 and src/Greeter/Greeter.Tests.ps1 name theirs; with the .bats suite the gate passes unforced (MCP trace_check: 3 test files read) (got " +
      js([before.plannedNotInCode, before.plannedOutsideCode, gate0.error, mid.plannedNotInCode, mcpTr.code, gate2.ok, gate2.error]) + ")");

    // 1.21.1 review 2 (B): pgTAP tests named like no test — test/sql/users.sql, a numbered tests/001_users.sql — are read once
    // a feature's test plan names them (the file, or its folder) in its File column; an unnamed tests/fixtures/seed.sql stays
    // a fixture (skipped). Before: the scan skipped them as fixtures, the plan's scope pointed at them → missing forever.
    const pg = path.join(tmp, "proj-121-pgtap-plan");
    S.initProject(pg, ["core", "tdd"], "en");
    const fp = S.createFeature(pg, "Users schema", ["core", "tdd"], "", undefined, "en");
    put(fp.dir, "test-plan.md", "# Test Plan\n\n| Test ID | Kind | Covers | File |\n|---|---|---|---|\n| T-01 | example | US-1.AC-1 | `test/sql/users.sql` |\n" +
      "| T-02 | example | US-1.AC-1 | `tests/001_users.sql` |\n| T-03 | example | US-1.AC-1 | `db/tests/pgtap/` |\n");
    put(pg, "test/sql/users.sql", "BEGIN;\nSELECT plan(1);\nSELECT has_table('users', 'T-01 the users table exists');\nSELECT * FROM finish();\nROLLBACK;\n");
    put(pg, "tests/001_users.sql", "SELECT plan(1);\nSELECT col_not_null('users', 'email', 'T-02 email is required');\n");
    put(pg, "db/tests/pgtap/roles.sql", "SELECT plan(1);\nSELECT has_role('app', 'T-03 the app role exists');\n");
    put(pg, "tests/fixtures/seed.sql", "insert into users values ('T-04');\n"); // named by no plan: a fixture
    approveBefore(pg, fp.slug, "tests");
    const scPg = S.scanTestCode(pg);
    const pgTr = payload(await rpc("tools/call", { name: "trace_check", arguments: { projectDir: pg, name: fp.slug, code: true } }));
    const pgGate = S.approvePhase(pg, fp.slug, "tests");
    ok(js(((scPg.tids.get("T-1") || {}).files)) === '["test/sql/users.sql"]' && js(((scPg.tids.get("T-2") || {}).files)) === '["tests/001_users.sql"]' &&
      js(((scPg.tids.get("T-3") || {}).files)) === '["db/tests/pgtap/roles.sql"]' && !scPg.tids.get("T-4") && scPg.scanned === 3 &&
      pgTr.ok && js(pgTr.code.plannedNotInCode) === "[]" && pgGate.ok === true && !pgGate.forced,
      "1.21.1 languages (review 2): a +tdd plan naming pgTAP's test/sql/users.sql, tests/001_users.sql and the folder db/tests/pgtap/ in its File column — the scan reads those three (T-01…T-03 found, 3 files read), never the unnamed tests/fixtures/seed.sql (T-04 not seen); MCP trace_check {code} misses nothing and the tests gate passes unforced (got " +
      js([[...scPg.tids.keys()], scPg.scanned, pgTr.code, pgGate.ok, pgGate.error]) + ")");

    // 1.21.1 review 2 (D): readFileHead caps CHARACTERS, as the slice it replaced did — 150,000 'é' (300,000 bytes) or 90,000
    // astral characters (180,000 UTF-16 units, 360,000 bytes) before a T-ID stay inside the 200,000-character head.
    const acc = path.join(tmp, "proj-121-accents");
    const eAcute = String.fromCharCode(0xe9);
    const astral = String.fromCharCode(0xd83d, 0xde00);
    put(acc, "tests/accents.test.js", "// " + eAcute.repeat(150000) + "\ntest(\"T-01 after the accents\", () => {});\n");
    put(acc, "tests/emoji.test.js", "// " + astral.repeat(90000) + "\ntest(\"T-02 after the emoji\", () => {});\n");
    put(acc, "tests/long.test.js", "// " + eAcute.repeat(200000) + "\ntest(\"T-03 past the cap\", () => {});\n");
    const scAcc = S.scanTestCode(acc);
    ok(!!scAcc.tids.get("T-1") && !!scAcc.tids.get("T-2") && !scAcc.tids.get("T-3") && scAcc.scanned === 3,
      "1.21.1 languages (review 2): the test-code scan reads 200,000 CHARACTERS of a file, not bytes — T-01 behind 150,000 'é' (300 KB) and T-02 behind 90,000 emoji are found; T-03 behind 200,000 'é' is past the cap (got " +
      js([[...scAcc.tids.keys()], scAcc.scanned]) + ")");

    // 1.21.1 review 3: a plan naming a FOLDER made fixture data a test — tests/fixtures/seed.sql holds ('T-01','refund') and
    // no real test does: (1) Alpha's plan names `tests/` → T-01 "in code" via seed.sql, the tests gate passed; (2) Alpha's
    // T-01 has no File cell and Beta's plan names `tests/` (or `tests/fixtures/`) → Alpha's T-01 counted via seed.sql;
    // (3) nobody names the folder → not in code. A fixture is read only when a plan names the FILE or the folder that
    // DIRECTLY holds it, and its T-IDs count only for the rows that claim it.
    const planOf = (rows) => "# Test Plan\n\n| Test ID | Kind | Covers | File |\n|---|---|---|---|\n" + rows.map(([id, f]) => "| " + id + " | example | US-1.AC-1 | " + f + " |\n").join("");
    const fxCase = async (name, alphaRows, betaRows, extra) => {
      const d = path.join(tmp, "proj-121-r3-" + name);
      S.initProject(d, ["core", "tdd"], "en");
      const a = S.createFeature(d, "Alpha", ["core", "tdd"], "", undefined, "en");
      put(a.dir, "test-plan.md", planOf(alphaRows));
      let b = null;
      if (betaRows) { b = S.createFeature(d, "Beta", ["core", "tdd"], "", undefined, "en"); put(b.dir, "test-plan.md", planOf(betaRows)); }
      put(d, "tests/fixtures/seed.sql", "insert into refunds values ('T-01','refund');\n");
      if (extra) extra(d);
      approveBefore(d, a.slug, "tests");
      const tr = payload(await rpc("tools/call", { name: "trace_check", arguments: { projectDir: d, name: a.slug, code: true } })).code || {};
      const gate = S.approvePhase(d, a.slug, "tests");
      const beta = b ? (S.traceCheck(d, b.slug, { code: true }).code || {}) : null;
      return { tr, gate, beta, scan: S.scanTestCode(d) };
    };
    const c1 = await fxCase("folder", [["T-01", "`tests/`"]]);
    const c2 = await fxCase("other", [["T-01", ""]], [["T-01", "`tests/`"]]);
    const c2b = await fxCase("other-direct", [["T-01", ""]], [["T-01", "`tests/fixtures/`"]]);
    const c3 = await fxCase("none", [["T-01", ""]]);
    // the B layouts through a folder: `tests/` claims its direct child tests/001_users.sql (T-01), not the seed below it
    const c4 = await fxCase("direct", [["T-01", "`tests/`"]], null, (d) => put(d, "tests/001_users.sql", "SELECT plan(1);\nSELECT has_table('refunds', 'T-01 the refunds table exists');\n"));
    const notIn = (c) => js(c.tr.plannedNotInCode) === '["T-01"]' && !c.tr.testsInCode["T-01"] && c.gate.refused === true && js(c.gate.failing) === '["tests-in-code"]';
    ok(notIn(c1) && !c1.scan.fixtures.has("tests/fixtures/seed.sql") && notIn(c2) && notIn(c2b) && c2b.scan.fixtures.has("tests/fixtures/seed.sql") &&
      js(c2b.beta.testsInCode["T-01"]) === '["tests/fixtures/seed.sql"]' && notIn(c3) &&
      js(c4.tr.testsInCode["T-01"]) === '["tests/001_users.sql"]' && js(c4.tr.plannedNotInCode) === "[]" && c4.gate.ok === true && !c4.gate.forced,
      "1.21.1 languages (review 3): fixture data is no test through a folder — (1) Alpha's plan naming `tests/` leaves tests/fixtures/seed.sql unread (T-01 not in code, the tests gate refuses); (2) Beta's plan naming `tests/`, or `tests/fixtures/` (seed.sql then read — for Beta's own row only), never counts it for Alpha's File-less T-01; (3) nobody names it: not in code; `tests/` still claims its direct child tests/001_users.sql (T-01 found, the gate passes unforced) (got " +
      js([c1, c2, c2b, c3, c4].map((c) => [c.tr.plannedNotInCode, c.tr.testsInCode, c.gate.ok, c.gate.failing, [...c.scan.fixtures], c.beta && c.beta.testsInCode])) + ")");
  }

  { // 1.22 review (markdown) — bare AC-n IDs, foreign <feature>/US-n.AC-m references, UTF-16 files, "clean" as a verb, two linear readers
    const js = (v) => JSON.stringify(v);
    const put = (root, rel, s) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
    const chk = (doc, id) => (doc.checks || []).find((c) => c.id === id) || {};
    const d = path.join(tmp, "proj-122-markdown");
    S.initProject(d, ["core"], "en");
    const reqOf = (lines) => "# Requirements\n\n## Acceptance Criteria (EARS)\n\n" + lines.join("\n") + "\n";
    const tasksOf = (ids) => "# Tasks\n\n- [ ] 1. Build it\n" + (ids ? "  - _Requirements: " + ids + "_\n" : "");

    // 2. Bare AC-n IDs: EARS flags each as no-id naming US-<story>.AC-<n>; trace_check FAILS (unidentifiedCriteria) instead of
    // passing with 0 ACs; doctor's ears + traceability fail; the requirements approval is refused. A criterion with no ID at all too.
    const bare = S.createFeature(d, "Bare", ["core"], "", undefined, "en");
    put(bare.dir, "requirements.md", reqOf(["1. **AC-1** — WHEN a user signs in THE SYSTEM SHALL show the dashboard within 2 seconds.",
      "2. **AC-2** — IF the password is wrong THEN THE SYSTEM SHALL show an error."]));
    put(bare.dir, "tasks.md", tasksOf(null));
    const eB = S.earsFeature(d, bare.slug);
    const trB = payload(await rpc("tools/call", { name: "trace_check", arguments: { projectDir: d, name: bare.slug } }));
    const docB = S.specDoctor(d, bare.slug);
    approveBefore(d, bare.slug, "requirements");
    const apB = S.approvePhase(d, bare.slug, "requirements");
    const none = S.createFeature(d, "NoIds", ["core"], "", undefined, "en");
    put(none.dir, "requirements.md", reqOf(["- WHEN a user signs in THE SYSTEM SHALL show the dashboard within 2 seconds."]));
    put(none.dir, "tasks.md", tasksOf(null));
    const trN = S.traceCheck(d, none.slug);
    const good = S.createFeature(d, "Good", ["core"], "", undefined, "en");
    put(good.dir, "requirements.md", reqOf(["1. **US-1.AC-1** — WHEN a user signs in THE SYSTEM SHALL show the dashboard within 2 seconds."]));
    put(good.dir, "tasks.md", tasksOf("US-1.AC-1"));
    const trG = S.traceCheck(d, good.slug);
    const noId = eB.issues.filter((i) => i.code === "no-id");
    all("1.22 review: bare AC-n IDs — EARS no-id names US-<story>.AC-<n>; trace_check fails (unidentifiedCriteria AC-1, AC-2 — no ID at all: L5) instead of 'all 0 ACs covered'; doctor ears + traceability fail; the requirements approval is refused; a US-n.AC-m spec is unchanged (got " +
      js([noId.map((i) => i.msg), trB.verdict, trB.unidentifiedCriteria, chk(docB, "ears"), chk(docB, "traceability").status, apB.refused, apB.failing, trN.unidentifiedCriteria, trG.verdict, Object.keys(trG)]) + ")", [
      () => noId.length === 2,
      () => /'AC-1' is not a stable ID trace_check reads — write US-<story>\.AC-<n> \(e\.g\., US-1\.AC-1\)/.test(noId[0].msg),
      () => eB.summary.withStableId === 0, () => trB.totalAcs === 0, () => trB.verdict === "gaps-found",
      () => js(trB.unidentifiedCriteria) === '["AC-1","AC-2"]',
      () => S.traceGapLines(trB, "en").some((l) => /^criteria with no US-<story>\.AC-<n> ID \(traceability counts none\): AC-1, AC-2$/.test(l)),
      () => chk(docB, "ears").status === "fail", () => /has criteria \(AC-1, AC-2\) with no AC ID trace_check reads/.test(chk(docB, "ears").detail),
      () => chk(docB, "traceability").status === "fail", () => apB.refused === true, () => (apB.failing || []).includes("ears"),
      () => trN.verdict === "gaps-found", () => js(trN.unidentifiedCriteria) === '["L5"]', () => trG.verdict === "pass", () => trG.totalAcs === 1,
      () => !("unidentifiedCriteria" in trG),
    ]);
    // the pre-commit check names them too — never "traceability clean (0 ACs)"
    if (spawnSync("git", ["--version"], { encoding: "utf8" }).status !== 0) ok(true, "1.22 review: pre-commit — skipped: no git");
    else {
      const repo = path.join(tmp, "proj-122-bare-git");
      put(repo, ".specs/bare/.state.json", js({ lang: "en", approvals: {} }));
      put(repo, ".specs/bare/requirements.md", fs.readFileSync(path.join(bare.dir, "requirements.md"), "utf8"));
      put(repo, ".specs/bare/tasks.md", tasksOf(null));
      spawnSync("git", ["init", "-q"], { cwd: repo, encoding: "utf8" });
      spawnSync("git", ["add", "-A"], { cwd: repo, encoding: "utf8" });
      const pc = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "precommit-check.js")], { cwd: repo, encoding: "utf8" });
      ok(/⚠ \.specs\/bare\/tasks\.md: 2 criteria with no US-<story>\.AC-<n> ID — traceability counts none of them \(warning\): AC-1, AC-2/.test(pc.stdout) &&
        !/traceability clean/.test(pc.stdout), "1.22 review: pre-commit names the criteria with no US-n.AC-m ID instead of 'traceability clean (0 ACs)' (got " + js(pc.stdout) + ")");
    }
    const pB = S.earsValidate("1. **AC-1** — QUANDO o utilizador entra O SISTEMA DEVE mostrar o painel.", "pt").issues.find((i) => i.code === "no-id") || {};
    const eB2 = S.earsValidate("1. **AC-1** — CUANDO el usuario entra EL SISTEMA DEBE mostrar el panel.", "es").issues.find((i) => i.code === "no-id") || {};
    ok(/'AC-1' não é um ID estável que o trace_check leia — escreve US-<história>\.AC-<n>/.test(pB.msg || "") && /'AC-1' no es un ID estable que trace_check lea — escribe US-<historia>\.AC-<n>/.test(eB2.msg || "") &&
      /^o requirements\.md tem critérios \(AC-1\)/.test(S.msg("pt").doctor.earsNoAcIds("AC-1")) && /^change\.md tiene criterios \(AC-1\)/.test(S.msg("es").doctor.earsNoAcIds("AC-1", "change.md")),
      "1.22 review: the bare-ID messages in PT / ES (got " + js([pB.msg, eB2.msg]) + ")");

    // 3. `<feature>/US-n.AC-m` in prose is another feature's criterion (the _Supersedes:_ / _Affects:_ syntax) — never a required AC.
    // (review 2: when <feature> IS another feature of the project — checkout and billing exist here)
    S.createFeature(d, "Checkout", ["core"], "", undefined, "en");
    S.createFeature(d, "Billing", ["core"], "", undefined, "en");
    const fr = S.createFeature(d, "Foreign", ["core"], "", undefined, "en");
    put(fr.dir, "requirements.md", reqOf(["1. **US-1.AC-1** — WHEN x THE SYSTEM SHALL y.", "", "## Assumptions", "", "- rules of checkout/US-3.AC-2 stay as they are; see billing / US-2.AC-4 too"]));
    put(fr.dir, "tasks.md", tasksOf("US-1.AC-1"));
    const trF = S.traceCheck(d, fr.slug);
    ok(trF.verdict === "pass" && js(trF.uncoveredByTasks) === "[]" && trF.totalAcs === 1 &&
      js([...require(path.join(__dirname, "lib", "engine", "index.js")).requirementAcIds("1. **US-1.AC-1** — x.\n2. **US-1.AC-2** — see US-1.AC-1/US-1.AC-2 and AC-1 / US-1.AC-3.")]) === '["US-1.AC-1","US-1.AC-2","US-1.AC-3"]',
      "1.22 review: 'checkout/US-3.AC-2' (and 'billing / US-2.AC-4') in an Assumptions line is no required AC; an ID pair 'US-1.AC-1/US-1.AC-2' keeps both (got " + js([trF.verdict, trF.uncoveredByTasks, trF.totalAcs]) + ")");

    // 5. UTF-16 files (Windows PowerShell 5.1's `>` / Out-File): requirements.md LE and BE trace their ACs; a UTF-16LE Pester file names its T-ID.
    const u = S.createFeature(d, "Wide", ["core", "tdd"], "", undefined, "en");
    const reqU = reqOf(["1. **US-1.AC-1** — WHEN x THE SYSTEM SHALL y."]);
    const le = (s) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(s, "utf16le")]);
    const be = (s) => { const b = Buffer.from(s, "utf16le"); b.swap16(); return Buffer.concat([Buffer.from([0xfe, 0xff]), b]); };
    put(u.dir, "tasks.md", tasksOf("US-1.AC-1") + "  - _Makes green: T-01_\n");
    put(u.dir, "test-plan.md", "| Test ID | Layer | Kind | Description | Covers | File |\n|---|---|---|---|---|---|\n| T-01 | unit | example | signs in | US-1.AC-1 | `tests/Login.Tests.ps1` |\n");
    fs.writeFileSync(path.join(u.dir, "requirements.md"), le(reqU));
    const trLE = S.traceCheck(d, u.slug);
    const hkU = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "spec-hook.js")], { input: js({ hook_event_name: "PostToolUse", tool_input: { file_path: path.join(u.dir, "requirements.md") } }), encoding: "utf8" });
    let hkUt = "";
    try { hkUt = JSON.parse(hkU.stdout).hookSpecificOutput.additionalContext; } catch { /* no output */ }
    ok(/EARS check: 1 criteria, all clean/.test(hkUt), "1.22 review: the requirements.md save hook reads a UTF-16LE file (got " + js(hkUt) + ")");
    fs.writeFileSync(path.join(u.dir, "requirements.md"), be(reqU));
    const trBE = S.traceCheck(d, u.slug);
    put(d, "tests/Login.Tests.ps1", "");
    fs.writeFileSync(path.join(d, "tests", "Login.Tests.ps1"), le("Describe 'Login' {\n  It 'T-01 signs in' { 1 | Should -Be 1 }\n}\n"));
    const trC = S.traceCheck(d, u.slug, { code: true }).code || {};
    ok(trLE.totalAcs === 1 && trLE.verdict === "pass" && trBE.totalAcs === 1 && trBE.verdict === "pass" &&
      js(trC.testsInCode && trC.testsInCode["T-01"]) === '["tests/Login.Tests.ps1"]' && js(trC.plannedNotInCode) === "[]" &&
      S.decodeText(le("añ€")) === String.fromCharCode(0xfeff) + "añ€" && S.decodeText(be("añ€")) === String.fromCharCode(0xfeff) + "añ€" && S.decodeText(Buffer.from("añ€")) === "añ€",
      "1.22 review: a UTF-16 (LE / BE BOM) requirements.md traces its AC, a UTF-16LE Pester tests/Login.Tests.ps1 names T-01 (decodeText; UTF-8 unchanged) (got " +
      js([trLE.totalAcs, trBE.totalAcs, trC.testsInCode, trC.plannedNotInCode]) + ")");

    // 6. "clean" as a VERB names an action, not a vague quality (PT limpa / ES limpia too); the adjective stays vague.
    const vg = (t, l) => S.earsValidate(t, l).issues.filter((i) => i.code === "vague").map((i) => i.line + ":" + /'([^']+)'/.exec(i.msg)[1]);
    ok(js(vg("1. **US-1.AC-1** — THE SYSTEM SHALL clean up its temporary files within 1 hour.\n2. **US-1.AC-2** — THE SYSTEM SHALL clean the expired sessions nightly.\n3. **US-1.AC-3** — THE SYSTEM SHALL show a clean UI.\n4. **US-1.AC-4** — THE SYSTEM SHALL keep the code clean, modern and fast.", "en")) ===
      '["3:clean","4:clean","4:modern","4:fast"]' &&
      js(vg("1. **US-1.AC-1** — O SISTEMA DEVE limpa os ficheiros temporários a cada hora.\n2. **US-1.AC-2** — O SISTEMA DEVE ter uma interface limpa e moderna.", "pt")) === '["2:limpa","2:moderna"]' &&
      js(vg("1. **US-1.AC-1** — EL SISTEMA DEBE limpia los archivos temporales cada hora.\n2. **US-1.AC-2** — EL SISTEMA DEBE mostrar una interfaz limpia.", "es")) === '["2:limpia"]',
      "1.22 review: 'clean up its temporary files' / 'clean the expired sessions' (PT 'limpa os', ES 'limpia los') are no vague term; 'a clean UI', 'clean, modern' still are (got " +
      js([vg("1. **US-1.AC-1** — THE SYSTEM SHALL clean up its temporary files within 1 hour.", "en")]) + ")");

    // 8 / 9. Two linear readers: criterionBlocks tests a block's modal once (200 KB of nested "- … SHALL x" sub-items was quadratic —
    // trace + matrix 12 s), extractSection's track context comes from one stack pass (200 KB of "### Processors" — status 9 s).
    // Each bounded against the same calls on a 200 KB text of the same size that was always read in linear time (flat criteria;
    // headings no track synonym names) — a slow or busy machine slows both (testing.md: a floor, then k × a baseline).
    const timed = (fn) => { const t = process.hrtime.bigint(); fn(); return Number(process.hrtime.bigint() - t) / 1e9; };
    const KB200 = 200 * 1000;
    const big = S.createFeature(d, "Nested", ["core"], "", undefined, "en");
    put(big.dir, "tasks.md", tasksOf("US-1.AC-1"));
    const runReq = (unit) => { put(big.dir, "requirements.md", reqOf(["1. **US-1.AC-1** — WHEN x THE SYSTEM SHALL y.", ""]) + unit.repeat(Math.ceil(KB200 / unit.length)));
      return timed(() => { S.earsFeature(d, big.slug); S.traceCheck(d, big.slug, { matrix: true }); }); };
    const nFlat = runReq("- THE SYSTEM SHALL x\n\n"), nNest = runReq("- THE SYSTEM SHALL x\n  ");
    ok(nNest < Math.max(3, 5 * nFlat),
      "1.22 review: 200 KB of nested criterion sub-items — ears + trace + matrix — read in linear time (got " + js([nFlat, nNest].map((x) => +x.toFixed(3))) + " s: flat, nested)");
    const priv = S.createFeature(d, "Wide privacy", ["core", "privacy"], "", undefined, "en");
    const runDesign = (unit) => { put(priv.dir, "design.md", "# Design\n\n## Overview\n\nx\n\n" + unit.repeat(Math.ceil(KB200 / unit.length)));
      return timed(() => { S.statusFeature(d, priv.slug); S.specDoctor(d, priv.slug); }); };
    const pNotes = runDesign("### Notes 123\n"), pProc = runDesign("### Processors\n");
    ok(pProc < Math.max(3, 5 * pNotes) && S.statusFeature(d, priv.slug).ok !== false,
      "1.22 review: 200 KB of '### Processors' headings with no [PRIVACY] one — status + doctor — read in linear time (got " + js([pNotes, pProc].map((x) => +x.toFixed(3))) + " s: other headings, Processors)");
    // the stack pass reads the same context as the back-walk: a loose synonym under a [PRIVACY] ancestor (any depth) counts, a core one doesn't
    const procSec = (md) => S.extractSection(md, ["processors & international transfers", "processors"], "[PRIVACY]", ["processors"]);
    ok(procSec("# D\n\n## [PRIVACY] Processing\n\n### Data\n\n#### Processors\nStripe (US, SCCs)\n") === "Stripe (US, SCCs)\n" &&
      procSec("# D\n\n## Processors and queues\nRedis\n") === null && procSec("# D\n\n## [PRIVACY] Processing\n\n## Architecture\n\n### Processors\nRedis\n") === null,
      "1.22 review: extractSection's track context (one pass) — '#### Processors' two levels under '## [PRIVACY] …' is the section; a core '## Processors…', or one under a sibling '## Architecture', is not");
  }

  { // 1.22 review 2 (markdown) — NFR-only requirements pass the gates; the feature's own IDs after a slash stay its IDs
    const js = (v) => JSON.stringify(v);
    const put = (root, rel, s) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
    const chk = (doc, id) => (doc.checks || []).find((c) => c.id === id) || {};
    const d = path.join(tmp, "proj-122r2-markdown");
    S.initProject(d, ["core"], "en");
    const reqOf = (lines) => "# Requirements\n\n## Acceptance Criteria (EARS)\n\n" + lines.join("\n") + "\n";
    const tasksOf = (ids) => "# Tasks\n\n- [ ] 1. Build it\n  - _Requirements: " + ids + "_\n";

    // F2. A criterion with a stable ID of its own (NFR-n, EC-n, SC-nnn) is no "criterion with no ID": an NFR-only spec traced 0 ACs,
    // so earsUnidentified named every NFR — doctor's ears and trace failed, the requirements approval was refused. A criterion with
    // no ID at all beside them still is one.
    const nfr = S.createFeature(d, "Perf", ["core"], "", undefined, "en");
    put(nfr.dir, "requirements.md", "# Requirements: Perf\n\n## Summary\n\nMake the API faster.\n\n## Non-Functional Requirements\n\n" +
      "- **NFR-1** — THE SYSTEM SHALL answer GET /orders within 200 ms at p95.\n- **NFR-2** — THE SYSTEM SHALL keep its memory under 512 MB.\n");
    put(nfr.dir, "tasks.md", tasksOf("NFR-1, NFR-2"));
    const trP = S.traceCheck(d, nfr.slug), docP = S.specDoctor(d, nfr.slug);
    approveBefore(d, nfr.slug, "requirements");
    const apP = S.approvePhase(d, nfr.slug, "requirements");
    const mix = S.createFeature(d, "Perf mix", ["core"], "", undefined, "en");
    put(mix.dir, "requirements.md", reqOf(["- **NFR-1** — THE SYSTEM SHALL answer within 200 ms.", "- THE SYSTEM SHALL log each call."]));
    put(mix.dir, "tasks.md", tasksOf("NFR-1"));
    const trM = S.traceCheck(d, mix.slug);
    ok(trP.verdict === "pass" && !("unidentifiedCriteria" in trP) && chk(docP, "ears").status === "pass" && chk(docP, "traceability").status !== "fail" &&
      !(apP.failing || []).includes("ears") && js(trM.unidentifiedCriteria) === '["L6"]' && trM.verdict === "gaps-found",
      "1.22 review 2: requirements of NFR-1, NFR-2 only — trace passes, doctor's ears passes, the requirements approval doesn't fail on ears; a criterion with no ID beside an NFR still is one (got " +
      js([trP.verdict, trP.unidentifiedCriteria, chk(docP, "ears"), chk(docP, "traceability").status, apP.failing, trM.unidentifiedCriteria]) + ")");

    // F3. `<x>/US-n.AC-m` is another feature's only when <x> resolves to ANOTHER feature of the project (as _Supersedes:_ resolves it):
    // a priority (P1/), a story (US-1 /), a number (1.1/), the feature's own slug, or a word that names no feature stay this feature's
    // IDs — every required AC went to 0 and the new 'no AC ID' failure fired. checkout (a feature here) is still stripped.
    S.createFeature(d, "Checkout", ["core"], "", undefined, "en");
    const own = S.createFeature(d, "Own ids", ["core"], "", undefined, "en");
    put(own.dir, "requirements.md", reqOf(["1. **P1/US-1.AC-1** — WHEN a user saves THE SYSTEM SHALL store the draft.",
      "2. US-1 / US-1.AC-2 — WHEN a user saves THE SYSTEM SHALL show a toast.", "3. 1.1/US-1.AC-3 — WHEN a user leaves THE SYSTEM SHALL keep the draft.",
      "4. own-ids/US-1.AC-4 — WHEN a user returns THE SYSTEM SHALL restore the draft.", "5. Step-2/US-1.AC-5 — WHEN the draft is stale THE SYSTEM SHALL say so.",
      "", "## Assumptions", "", "- the rules of checkout/US-3.AC-2 stay as they are"]));
    put(own.dir, "tasks.md", tasksOf("US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4, US-1.AC-5"));
    const trO = S.traceCheck(d, own.slug), docO = S.specDoctor(d, own.slug);
    const E = require(path.join(__dirname, "lib", "engine", "index.js"));
    const pure = [...E.requirementAcIds("1. **P1/US-1.AC-1** — x.\n2. US-1 / US-1.AC-2 — y.\n3. 1.1/US-1.AC-3 — z.\n4. see checkout/US-3.AC-2.")];
    ok(trO.verdict === "pass" && trO.totalAcs === 5 && js(trO.uncoveredByTasks) === "[]" && chk(docO, "ears").status === "pass" &&
      js(pure) === '["US-1.AC-1","US-1.AC-2","US-1.AC-3"]',
      "1.22 review 2: 'P1/US-1.AC-1', 'US-1 / US-1.AC-2', '1.1/US-1.AC-3', the feature's own 'own-ids/US-1.AC-4' and 'Step-2/US-1.AC-5' (no such feature) stay required ACs — 5, all covered; 'checkout/US-3.AC-2' (a feature) does not; without a feature folder the reader keeps P1 / US-1 / 1.1 (got " +
      js([trO.verdict, trO.totalAcs, trO.uncoveredByTasks, trO.unidentifiedCriteria, chk(docO, "ears").status, pure]) + ")");
    // …and a criterion whose only ID is that other feature's (or a _Supersedes:_ reference) has no ID of its own: still named
    const fo = S.createFeature(d, "Foreign only", ["core"], "", undefined, "en");
    put(fo.dir, "requirements.md", reqOf(["1. WHEN a user pays THE SYSTEM SHALL apply the rules of checkout/US-3.AC-2 unchanged."]));
    put(fo.dir, "tasks.md", tasksOf("US-3.AC-2"));
    const trFo = S.traceCheck(d, fo.slug), docFo = S.specDoctor(d, fo.slug);
    ok(js(trFo.unidentifiedCriteria) === '["L5"]' && trFo.totalAcs === 0 && chk(docFo, "ears").status === "fail" &&
      js(E.criteriaBareIds("1. **AC-1** — WHEN x THE SYSTEM SHALL keep checkout/US-3.AC-2 as it is.")) === '["AC-1"]',
      "1.22 review 2: a criterion whose only ID is another feature's (checkout/US-3.AC-2) has no stable ID of its own — trace names it, doctor's ears fails; a bare AC-1 beside such a reference is still a bare ID (got " +
      js([trFo.unidentifiedCriteria, trFo.totalAcs, chk(docFo, "ears").status]) + ")");
  }

  { // 1.22 review 3 (markdown) — a criterion's own ID is the one that LABELS it; an unresolved <x>/ID is this feature's only when it labels a criterion
    const js = (v) => JSON.stringify(v);
    const put = (root, rel, s) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
    const chk = (doc, id) => (doc.checks || []).find((c) => c.id === id) || {};
    const d = path.join(tmp, "proj-122r3-markdown");
    S.initProject(d, ["core"], "en");
    const reqOf = (lines) => "# Requirements\n\n## Acceptance Criteria (EARS)\n\n" + lines.join("\n") + "\n";
    const E = require(path.join(__dirname, "lib", "engine", "index.js"));

    // F2. ownStableId accepted ANY ID mentioned in a criterion: `- AC-1: … (see EC-1)` / `… (T-01)` had "its own" ID — earsUnidentified
    // null, doctor's ears passed, trace counted 0 ACs with no gap, spec_upgrade's bareAcIds was []. Only the LABEL counts now; a bare
    // AC-n label is unidentified whatever it cites, and a T- ID is never a criterion's.
    const see = S.createFeature(d, "See ec", ["core"], "", undefined, "en");
    put(see.dir, "requirements.md", reqOf(["- AC-1: WHEN the user logs in THE SYSTEM SHALL redirect (see EC-1)", "- EC-1: IF the session expired THEN THE SYSTEM SHALL ask again"]));
    put(see.dir, "tasks.md", "# Tasks\n\n- [ ] 1. Build it\n  - _Requirements: EC-1_\n");
    const tcite = S.createFeature(d, "T cite", ["core"], "", undefined, "en");
    put(tcite.dir, "requirements.md", reqOf(["- AC-1: WHEN the user logs in THE SYSTEM SHALL redirect to /home (T-01)", "- AC-2: IF the password is wrong THEN THE SYSTEM SHALL show an error (T-02)"]));
    put(tcite.dir, "tasks.md", "# Tasks\n\n- [ ] 1. Build it\n");
    const trS = S.traceCheck(d, see.slug), docS = S.specDoctor(d, see.slug), trT = S.traceCheck(d, tcite.slug), docT = S.specDoctor(d, tcite.slug);
    const reqT = fs.readFileSync(path.join(tcite.dir, "requirements.md"), "utf8");
    const noIdT = S.earsValidate(reqT, "en").issues.filter((i) => i.code === "no-id").map((i) => /'(AC-\d+)'/.exec(i.msg || "") ? /'(AC-\d+)'/.exec(i.msg)[1] : i.msg);
    const lab = (t) => { const l = E.criterionLabel(t); return l && (l.slug ? l.slug + "/" : "") + l.id; };
    ok(js(trS.unidentifiedCriteria) === '["AC-1"]' && trS.verdict === "gaps-found" && chk(docS, "ears").status === "fail" &&
      js(trT.unidentifiedCriteria) === '["AC-1","AC-2"]' && chk(docT, "ears").status === "fail" && js(noIdT) === '["AC-1","AC-2"]' &&
      js(E.criteriaBareIds(reqT, tcite.dir)) === '["AC-1","AC-2"]' && js(E.criteriaBareIds(fs.readFileSync(path.join(see.dir, "requirements.md"), "utf8"), see.dir)) === '["AC-1"]' &&
      js(["- **US-1.AC-1** — WHEN x", "1. NFR-2: THE SYSTEM SHALL y", "### US-1.AC-3: WHEN", "- [ ] (EC-1) IF x", "2. P1/US-1.AC-4 — x", "- WHEN x THE SYSTEM SHALL y (NFR-1)", "1 | US-1.AC-5 | WHEN x"].map(lab)) ===
        '["US-1.AC-1","NFR-2","US-1.AC-3","EC-1","P1/US-1.AC-4",null,"US-1.AC-5"]',
      "1.22 review 3 (2): a criterion's own stable ID is the one that LABELS it — `- AC-1: … (see EC-1)` and `- AC-1: … (T-01)` are criteria with no US-n.AC-m ID (trace gaps-found, doctor's ears fails, EARS no-id names the bare AC-n, spec_upgrade's bareAcIds lists them); an EC-1 / NFR-2 / table-cell / slugged label is one (got " +
      js([trS.unidentifiedCriteria, trS.verdict, chk(docS, "ears").status, trT.unidentifiedCriteria, chk(docT, "ears").status, noIdT]) + ")");

    // F6. `<x>/US-n.AC-m` where <x> names NO feature counted as this feature's criterion: "keep the rules of billing/US-3.AC-2" with no
    // billing feature → a required AC no task covered. It is this feature's only when the same ID labels one of its criteria.
    const ref = S.createFeature(d, "Ref", ["core"], "", undefined, "en");
    put(ref.dir, "requirements.md", reqOf(["- US-1.AC-1: WHEN the user logs in THE SYSTEM SHALL keep the rules of billing/US-3.AC-2",
      "- Step-2/US-1.AC-2: WHEN the draft is stale THE SYSTEM SHALL say so (as legacy/US-1.AC-2 did)"]));
    put(ref.dir, "tasks.md", "# Tasks\n\n- [ ] 1. Build it\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n");
    const trR = S.traceCheck(d, ref.slug);
    const ids = [...E.requirementAcIds(fs.readFileSync(path.join(ref.dir, "requirements.md"), "utf8"), ref.dir)];
    ok(trR.verdict === "pass" && trR.totalAcs === 2 && js(trR.uncoveredByTasks) === "[]" && js(ids) === '["US-1.AC-1","US-1.AC-2"]',
      "1.22 review 3 (6): 'billing/US-3.AC-2' with no billing feature is a foreign reference (no required AC); 'Step-2/US-1.AC-2' labels a criterion — this feature's, and so is 'legacy/US-1.AC-2' citing the same ID (got " +
      js([trR.verdict, trR.totalAcs, trR.uncoveredByTasks, ids]) + ")");

    // 1.22 review 4 (1): with NO label, a criterion's own stable ID may sit anywhere in it — `… in 200 ms (NFR-1)`, `**Latency (NFR-1):**`,
    // `**[NFR-1]**`, `a. NFR-1:` — as earsValidate counts it (withStableId): ownStableId disagreed, so earsUnidentified named them, doctor's
    // ears failed and the requirements approval was refused (they passed at c3c13ef). A bare AC-n label, another feature's
    // `<slug>/US-n.AC-m` and a _Supersedes:_ reference are still no ID of its own.
    const nfrAny = S.createFeature(d, "Nfr anywhere", ["core"], "", undefined, "en");
    put(nfrAny.dir, "requirements.md", "# Requirements: latency\n\n## Summary\nThe API must stay fast.\n\n## Non-Functional Requirements\n\n" +
      "- THE SYSTEM SHALL answer GET /orders within 200 ms at p95 (NFR-1)\n- **Availability (NFR-2):** THE SYSTEM SHALL keep 99.9% monthly availability\n" +
      "- **[NFR-3]** THE SYSTEM SHALL keep its memory under 512 MB\n\na. NFR-4: THE SYSTEM SHALL start within 2 s\n");
    put(nfrAny.dir, "tasks.md", "# Tasks\n\n- [ ] 1. Build it\n  - _Requirements: NFR-1, NFR-2, NFR-3, NFR-4_\n");
    const reqN = fs.readFileSync(path.join(nfrAny.dir, "requirements.md"), "utf8");
    const evN = S.earsValidate(reqN, "en"), docN = S.specDoctor(d, nfrAny.slug), trN = S.traceCheck(d, nfrAny.slug);
    approveBefore(d, nfrAny.slug, "requirements");
    const apN = S.approvePhase(d, nfrAny.slug, "requirements");
    const ownNo = ["- AC-1: WHEN x THE SYSTEM SHALL y (NFR-1)", "- WHEN x THE SYSTEM SHALL keep checkout/US-3.AC-2", "- WHEN x THE SYSTEM SHALL y _Supersedes: checkout/US-1.AC-1_"]
      .map((t) => E.earsUnidentified(reqOf([t]), S.earsValidate(reqOf([t]), "en"), path.join(d, ".specs", "ref")));
    ok(evN.summary.criteriaDetected === 4 && evN.summary.withStableId === 4 && E.earsUnidentified(reqN, evN, nfrAny.dir) === null && chk(docN, "ears").status === "pass" &&
      !("unidentifiedCriteria" in trN) && !(apN.failing || []).includes("ears") && ownNo.every((u) => Array.isArray(u) && u.length === 1),
      "1.22 review 4 (1): a criterion whose only ID is NOT at its start — `(NFR-1)` at the end, `**Availability (NFR-2):**`, `**[NFR-3]**`, `a. NFR-4:` — has its own stable ID (earsUnidentified null, doctor's ears passes, trace names no unidentified criterion, the approval doesn't fail on ears); a bare AC-n label, another feature's ID and a _Supersedes:_ reference still don't (got " +
      js([evN.summary, E.earsUnidentified(reqN, evN, nfrAny.dir), chk(docN, "ears"), trN.unidentifiedCriteria, apN.failing, ownNo]) + ")");

    // 1.22 review 4 (6): `- AC-1: … (see US-1.AC-9)` — any US-n.AC-m in the document returned null early, so the criterion numbered with a
    // bare AC-1 escaped while the CITED ID became the only required criterion. Each criterion is judged by its own ID now; one with no ID at
    // all beside US-n.AC-m criteria is still EARS's no-id warn only.
    const cite = S.createFeature(d, "Cite us", ["core"], "", undefined, "en");
    put(cite.dir, "requirements.md", reqOf(["- AC-1: WHEN the user logs in THE SYSTEM SHALL redirect (see US-1.AC-9)", "- US-1.AC-2: IF wrong THEN THE SYSTEM SHALL show an error",
      "- THE SYSTEM SHALL log each attempt"]));
    put(cite.dir, "tasks.md", "# Tasks\n\n- [ ] 1. Build it\n  - _Requirements: US-1.AC-9, US-1.AC-2_\n");
    const reqC = fs.readFileSync(path.join(cite.dir, "requirements.md"), "utf8");
    const trC = S.traceCheck(d, cite.slug), docC = S.specDoctor(d, cite.slug);
    ok(js(E.earsUnidentified(reqC, S.earsValidate(reqC, "en"), cite.dir)) === '["AC-1"]' && js(trC.unidentifiedCriteria) === '["AC-1"]' && trC.verdict === "gaps-found" &&
      chk(docC, "ears").status === "fail" && /\(AC-1\)/.test(chk(docC, "ears").detail || ""),
      "1.22 review 4 (6): a criterion numbered with a bare AC-1 is unidentified even when the document cites a US-n.AC-m elsewhere (trace gaps-found, doctor's ears fails naming AC-1); an unnumbered one beside US-n.AC-m criteria is not listed (got " +
      js([E.earsUnidentified(reqC, S.earsValidate(reqC, "en"), cite.dir), trC.unidentifiedCriteria, trC.verdict, chk(docC, "ears")]) + ")");

    // 1.22 review 4 (6b): an importer demotes an ID-led line of imported prose by escaping it (`1. **US-7\.AC-1** — …`, a fluidplan page
    // intro) — the AC-1 of that escaped US-7\.AC-1 is no bare AC-n: (6) listed it as an unidentified criterion and the import read gaps-found.
    const BS = String.fromCharCode(92);
    const esc = S.createFeature(d, "Escaped id", ["core"], "", undefined, "en");
    put(esc.dir, "requirements.md", reqOf(["1. **US-7" + BS + ".AC-1** — WHEN x THE SYSTEM SHALL y", "- US-1.AC-1: WHEN the user logs in THE SYSTEM SHALL redirect"]));
    put(esc.dir, "tasks.md", "# Tasks\n\n- [ ] 1. Build it\n  - _Requirements: US-1.AC-1_\n");
    const reqE = fs.readFileSync(path.join(esc.dir, "requirements.md"), "utf8");
    const trE = S.traceCheck(d, esc.slug);
    ok(E.earsUnidentified(reqE, S.earsValidate(reqE, "en"), esc.dir) === null && !("unidentifiedCriteria" in trE) && trE.verdict === "pass" && trE.totalAcs === 1 &&
      !E.RE_BARE_AC.test("US-7" + BS + ".AC-1") && !E.RE_BARE_AC.test("US-7.AC-1") && E.RE_BARE_AC.test("AC-1") && E.RE_BARE_AC.test("(see AC-2)"),
      "1.22 review 4 (6b): an escaped `US-7\\.AC-1` (an importer's demoted ID-led line) holds no bare AC-n — not listed as unidentified, trace passes; a bare AC-1 still reads as one (got " +
      js([E.earsUnidentified(reqE, S.earsValidate(reqE, "en"), esc.dir), trE.unidentifiedCriteria, trE.verdict, trE.totalAcs]) + ")");

    // 1.22 review 4 (6c): a bare AC-n an unlabelled criterion only QUOTES — in a _Supersedes:_ marker, behind another feature's slug or a
    // URL's slash, or running into a letter (`AC-230V`) — is not its number: every gate (and spec_upgrade's renumber item) asked to
    // renumber another feature's AC-2. And EARS reads the criterion's own text as ownStableId does: a criterion whose only ID is a
    // _Supersedes:_ marker's or another feature's US-n.AC-m is a no-id warn (EARS counted it, so it stayed untraced with no warning).
    S.createFeature(d, "Shopcart", ["core"], "", undefined, "en");
    const quo = S.createFeature(d, "Quoted ids", ["core"], "", undefined, "en");
    put(quo.dir, "requirements.md", reqOf(["- US-1.AC-1: WHEN the user logs in THE SYSTEM SHALL redirect",
      "- WHEN a coupon is applied THE SYSTEM SHALL recompute the total _Supersedes: shopcart/AC-2_",
      "- WHILE a sale runs THE SYSTEM SHALL keep the discount rules of shopcart/AC-3 unchanged",
      "- THE SYSTEM SHALL follow https://wiki.example.com/pages/AC-12 and run on AC-230V mains"]));
    put(quo.dir, "tasks.md", "# Tasks\n\n- [ ] 1. Build it\n  - _Requirements: US-1.AC-1_\n");
    const reqQ = fs.readFileSync(path.join(quo.dir, "requirements.md"), "utf8");
    const evQ = S.earsValidate(reqQ, "en"), trQ = S.traceCheck(d, quo.slug);
    const evSup = S.earsValidate(reqOf(["- US-1.AC-1: WHEN x THE SYSTEM SHALL y", "- WHEN the cart is empty THE SYSTEM SHALL show a hint _Supersedes: shopcart/US-1.AC-1_",
      "- WHEN paid THE SYSTEM SHALL keep shopcart/US-3.AC-2 as it is"]), "en");
    ok(E.earsUnidentified(reqQ, evQ, quo.dir) === null && !("unidentifiedCriteria" in trQ) && trQ.verdict === "pass" && js(E.criteriaBareIds(reqQ, quo.dir)) === "[]" &&
      !evQ.issues.some((i) => /AC-2|AC-3|AC-12|AC-230/.test(i.msg || "")) && E.bareLabel("- AC-4: WHEN x THE SYSTEM SHALL y") === "AC-4" && E.bareLabel("- WHEN x THE SYSTEM SHALL y (AC-5)") === "AC-5" &&
      evSup.summary.withStableId === 1 && evSup.issues.filter((i) => i.code === "no-id").length === 2,
      "1.22 review 4 (6c): an AC-n inside _Supersedes:_, behind a slug or a URL's slash, or in `AC-230V` is no criterion's number (trace passes, no renumber item, no 'AC-2 is not a stable ID'); a _Supersedes:_ / another feature's US-n.AC-m is no criterion's own ID for EARS either — a no-id warn (got " +
      js([E.earsUnidentified(reqQ, evQ, quo.dir), trQ.unidentifiedCriteria, trQ.verdict, E.criteriaBareIds(reqQ, quo.dir), evQ.issues.map((i) => i.msg), evSup.summary, evSup.issues.map((i) => i.code)]) + ")");

    // 1.22 review 4 (6d): the fluidplan importer escapes a bare AC-n of imported prose (`AC\-1`) as it escapes US-n.AC-m — a page intro's
    // `1. **AC-1** — WHEN …` was an unidentified criterion of the imported feature.
    const inert = E.fpInert("1. **AC-1** — WHEN x THE SYSTEM SHALL y; see US-7.AC-2 and AC-3");
    ok(inert === "1. **AC" + BS + "-1** — WHEN x THE SYSTEM SHALL y; see US-7" + BS + ".AC-2 and AC" + BS + "-3" && E.fpInert(inert) === inert && !E.RE_BARE_AC.test(inert),
      "1.22 review 4 (6d): fpInert escapes a bare AC-n (`AC\\-1`), leaves an escaped US-7\\.AC-2 as it is, and is idempotent (got " + js(inert) + ")");
  }
};
