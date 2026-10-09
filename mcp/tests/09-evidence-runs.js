"use strict";
// Evidence — whose record a task reads after a renumber (evidence-moved); what a run's OUTPUT proves: the could-not-run table (one fixture per runner), a vacuous pass (no test ran), node --test's file-level failures; _Expect:_ values; an _Expect: fail_ re-run into a crash; an incomplete command (`npm test &&`).

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, S, tmp, __dirname, require }) => {
  const js = JSON.stringify;
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const proj = (name) => { const d = path.join(tmp, "proj-r6-" + name); S.initProject(d, ["core"], "en"); return d; };
  const state = (f) => JSON.parse(fs.readFileSync(path.join(f.dir, ".state.json"), "utf8"));

  // 1.24 r6 D1: a renumbered task never inherits another task's run — ownRecord's fallback rejects a record stamped with the
  // text of ANOTHER block of the same tasks.md (a pure title edit keeps its record); doctor evidence-moved names it.
  {
    const d = proj("renum");
    const f = S.createFeature(d, "Renum", ["core"], "", undefined, "en");
    const tasks = (t) => fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n## Phase 1\n\n" + t.join("\n") + "\n");
    tasks(["- [ ] 1. Write the parser _Verify: npm test_", "- [ ] 2. Write the lexer _Verify: npm test_"]);
    const c1 = S.completeTask(d, f.slug, 1, { command: "npm test", exitCode: 0 });
    // the user inserts a task at the top and renumbers the list (a plain markdown edit)
    tasks(["- [ ] 1. Add the config loader _Verify: npm test_", "- [x] 2. Write the parser _Verify: npm test_", "- [ ] 3. Write the lexer _Verify: npm test_"]);
    const c2 = S.completeTask(d, f.slug, 1); // no evidence at all
    const vs = S.verificationStatus(d, f.slug, f.dir).unverifiedDetail;
    const doc = S.specDoctor(d, f.slug).checks.find((c) => c.id === "evidence-moved");
    ok(c1.ok && c1.verified && c2.ok && c2.verified === false && c2.unverifiedReason === "stale-evidence" &&
      vs.some((x) => x.number === 1 && x.reason === "stale-evidence") && vs.some((x) => x.number === 2 && x.reason === "no-evidence") &&
      doc && doc.status === "warn" && /#1 → #2/.test(doc.detail) && /Write the parser/.test(doc.detail),
      "1.24 r6 D1: after a renumber, the new task 1 never inherits the run recorded for the old task 1 (now #2) — stale-evidence; doctor evidence-moved names #1 → #2 (got " +
      js([c2.verified, c2.unverifiedReason, vs, doc]) + ")");
    // storeEvidence: the new task 1's run is its own record — the parser's run is kept aside in `others`, never extended
    const c3 = S.completeTask(d, f.slug, 1, { command: "npm test", exitCode: 0 });
    const e1 = state(f).evidence["1"];
    ok(c3.ok && c3.verified && /config loader/.test(e1.task) && e1.history.length === 1 && Array.isArray(e1.others) && e1.others.some((r) => /Write the parser/.test(r.task)),
      "1.24 r6 D1: a run recorded for the renumbered task 1 starts its own record (history 1) and keeps the parser's run in `others` (got " + js({ task: e1.task, history: e1.history.length, others: (e1.others || []).map((r) => r.task) }) + ")");
    // a pure title edit keeps the record (no other block carries the stamped text)
    tasks(["- [x] 1. Add the config loader module _Verify: npm test_", "- [x] 2. Write the parser _Verify: npm test_", "- [ ] 3. Write the lexer _Verify: npm test_"]);
    const v1 = S.verificationStatus(d, f.slug, f.dir).unverifiedDetail;
    ok(!v1.some((x) => x.number === 1), "1.24 r6 D1: a pure title edit keeps the task's record (task 1 stays verified) (got " + js(v1) + ")");
  }
  { // 1.24 r6 D1: untick never stales another task's record a renumber left under the number
    const d = proj("renum-undo");
    const f = S.createFeature(d, "Undo renum", ["core"], "", undefined, "en");
    const tasks = (t) => fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n" + t.join("\n") + "\n");
    tasks(["- [ ] 1. Alpha step _Verify: npm test_", "- [ ] 2. Beta step _Verify: npm test_"]);
    S.completeTask(d, f.slug, 1, { command: "npm test", exitCode: 0 });
    tasks(["- [x] 1. Beta step _Verify: npm test_", "- [x] 2. Alpha step _Verify: npm test_"]); // swapped by hand
    const u = S.completeTask(d, f.slug, 1, undefined, { undo: true });
    const e1 = state(f).evidence["1"];
    ok(u.ok && u.unticked && u.evidenceStale === false && e1.stale === undefined && /Alpha step/.test(e1.task),
      "1.24 r6 D1: unticking task 1 (now Beta) leaves Alpha's record under #1 alone — no stale mark, evidenceStale false (got " + js([u.evidenceStale, e1.stale, e1.task]) + ")");
    const doc = S.specDoctor(d, f.slug).checks.find((c) => c.id === "evidence-moved");
    ok(doc && /#1 → #2/.test(doc.detail) && /Alpha step/.test(doc.detail), "1.24 r6 D1: doctor evidence-moved names the swapped record (#1 → #2) (got " + js(doc) + ")");
    const pt = S.createFeature(d, "Renum PT", ["core"], "", undefined, "pt");
    fs.writeFileSync(path.join(pt.dir, "tasks.md"), "- [ ] 1. Alfa _Verify: npm test_\n- [ ] 2. Beta _Verify: npm test_\n");
    S.completeTask(d, pt.slug, 1, { command: "npm test", exitCode: 0 });
    fs.writeFileSync(path.join(pt.dir, "tasks.md"), "- [ ] 1. Zero _Verify: npm test_\n- [x] 2. Alfa _Verify: npm test_\n- [ ] 3. Beta _Verify: npm test_\n");
    const dpt = S.specDoctor(d, pt.slug).checks.find((c) => c.id === "evidence-moved");
    const keys = (l) => typeof S.msg(l).evidenceGate.evidenceMoved;
    ok(dpt && dpt.detail !== doc.detail && /#1 → #2/.test(dpt.detail) && !/^the run/.test(dpt.detail) && keys("en") === "function" && keys("pt") === "function" && keys("es") === "function" && keys("pt-BR") === "function",
      "1.24 r6 D1: evidence-moved is localized (PT) and evidenceGate.evidenceMoved exists in EN / PT / ES / pt-BR (got " + js(dpt) + ")");
    // a feature without a moved record has no such check
    const clean = S.createFeature(d, "Clean", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(clean.dir, "tasks.md"), "- [ ] 1. One _Verify: npm test_\n");
    S.completeTask(d, clean.slug, 1, { command: "npm test", exitCode: 0 });
    ok(!S.specDoctor(d, clean.slug).checks.some((c) => c.id === "evidence-moved") && E.CHECK_PHASE["evidence-moved"] === 6, "1.24 r6 D1: no evidence-moved check without a moved record; its CHECK_PHASE is 6 (verification)");
  }

  // 1.24 r6 D7 + D-I8: an _Expect:_ value other than `fail` (failure / fails / red / PT falha) left a must-pass task silently —
  // doctor expect-value names it, and the failed-run refusal names the value (unknownExpect, stable).
  {
    const d = proj("expect");
    const got = {};
    for (const v of ["failure", "`fails`", "red", "falha"]) {
      const f = S.createFeature(d, "X " + v.replace(/`/g, ""), ["core"], "", undefined, v === "falha" ? "pt" : "en");
      fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. Write the regression test T-01 _Verify: node --test tests/x.test.js_\n  - _Expect: " + v + "_\n");
      const r = S.completeTask(d, f.slug, 1, { command: "node --test tests/x.test.js", exitCode: 1, summary: "not ok 1 - T-01\n# fail 1" });
      const doc = S.specDoctor(d, f.slug).checks.find((c) => c.id === "expect-value");
      got[v] = { ok: r.ok, recorded: r.recorded, unknown: r.unknownExpect, error: r.error, doc: doc && doc.status + ":" + doc.detail };
    }
    const bare = (v) => v.replace(/`/g, "");
    const wrong = Object.keys(got).filter((v) => { const g = got[v]; return g.ok !== false || g.recorded !== true || js(g.unknown) !== js([bare(v)]) ||
      !g.error.includes("_Expect: " + bare(v) + "_") || !/_Expect: fail_/.test(g.error) || !g.doc || !/^warn:/.test(g.doc) || !g.doc.includes("#1") || !g.doc.includes(bare(v)); });
    ok(!wrong.length && /Tarefa 1/.test(got.falha.error) && /^warn:.*_Expect: fail_/.test(got.failure.doc),
      "1.24 r6 D7: an _Expect:_ value other than fail — the failed-run refusal names it (unknownExpect) and says to write _Expect: fail_; doctor expect-value (warn) names the task and the value; PT localized (wrong: " + js(wrong.map((v) => [v, got[v]])) + ")");
    const f = S.createFeature(d, "Expect ok", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "- [ ] 1. Red T-01 _Verify: node --test tests/x.test.js_\n  - _Expect: `FAIL`_\n- [ ] 2. Plain _Verify: npm test_\n");
    const r2 = S.completeTask(d, f.slug, 2, { command: "npm test", exitCode: 1 });
    ok(!S.specDoctor(d, f.slug).checks.some((c) => c.id === "expect-value") && r2.ok === false && r2.unknownExpect === undefined && !/_Expect/.test(r2.error) && E.CHECK_PHASE["expect-value"] === 5,
      "1.24 r6 D7: _Expect: `FAIL`_ is the known value (no expect-value check), a task without _Expect:_ keeps its plain refusal (got " + js(r2) + ")");
  }

  // 1.24 r6 D5 + D-I3: CANT_RUN_OUTPUT is a table [kind, pattern, runner] and every runner has a fixture here — a run whose output
  // shows the test never ran is no red proof. New: python -m's "No module named", PHP's "Could not open input file", npm E404 / npx's
  // "could not determine executable to run", dash's "sh: 0: cannot open", go's missing module / go.mod, cargo's missing Cargo.toml,
  // dotnet MSB1003 / MSB1009, ruby's "cannot load such file", maven's "no POM", a caret-framed SyntaxError (D8), pytest's
  // collection error.
  {
    const BS = String.fromCharCode(92);
    const FIX = {
      "wsl relay": ["<3>WSL (10 - Relay) ERROR: CreateProcessCommon:818: execvpe(/bin/bash) failed: No such file or directory"],
      "wsl execvpe": ["execvpe(/bin/bash) failed: No such file or directory"],
      "wsl not installed": ["Windows Subsystem for Linux has no installed distributions."],
      "node spawn": ["Error: spawnSync /bin/sh ENOENT"],
      "node --test missing file": ["Could not find '/p/tests/x.test.js'"],
      "node missing module": ["Error: Cannot find module '../src/parser'"],
      "node ESM missing module": ["  code: 'ERR_MODULE_NOT_FOUND',"],
      "python missing file": ["python: can't open file '/p/tests/x.py': [Errno 2] No such file or directory"],
      "python missing import": ["ModuleNotFoundError: No module named 'parser'"],
      "pytest missing path": ["ERROR: file or directory not found: tests/test_x.py"],
      "pytest nothing collected": ["=== no tests ran in 0.01s ==="],
      "jest no tests": ["No tests found, exiting with code 1"],
      "vitest / mocha no test files": ["No test files found, exiting with code 1"],
      "npm missing script": ['npm ERR! Missing script: "test"', 'npm error Missing script: "test"'],
      "make missing target": ["make: *** No rule to make target 'test'.  Stop."],
      "npm no package.json": ["npm ERR! code ENOENT", "npm error code ENOENT"],
      "pwsh unknown command": ["Invoke-Pester: The term 'Invoke-Pester' is not recognized as a name of a cmdlet, function, script file, or executable program."],
      "pwsh module not loaded": ["Import-Module: The specified module 'Pester' was not loaded because no valid module file was found in any module directory."],
      "pwsh execution policy": ["File C:" + BS + "p" + BS + "run.ps1 cannot be loaded because running scripts is disabled on this system."],
      "pwsh -File path": ["The argument 'tests/run.ps1' to the -File parameter does not exist."],
      "Pester no test files": ["No test files were found and no scriptblocks were provided."],
      "python -m missing module": ["/usr/bin/python3: No module named pytest", "C:" + BS + "Python312" + BS + "python.exe: No module named pytest", "/opt/py/bin/python3.12: No module named unittestx"],
      "php missing script": ["Could not open input file: vendor/bin/phpunit"],
      "npm E404": ["npm ERR! code E404\nnpm ERR! 404 Not Found - GET https://registry.npmjs.org/vitestt", "npm error code E404"],
      "npx no executable": ["npm ERR! could not determine executable to run", "npm error could not determine executable to run"],
      "dash cannot open": ["sh: 0: cannot open tests/run.sh: No such file", "sh: 0: Can't open tests/run.sh"],
      "go no main module": ["go: cannot find main module, but found .git/config in /p\n\tto create a module there, run:\n\tgo mod init"],
      "go no go.mod": ["go: go.mod file not found in current directory or any parent directory; see 'go help modules'"],
      "cargo no Cargo.toml": ["error: could not find `Cargo.toml` in `/p` or any parent directory"],
      "dotnet no project": ["MSBUILD : error MSB1003: Specify a project or solution file. The current working directory does not contain a project or solution file.", "MSBUILD : error MSB1009: Project file does not exist."],
      "ruby cannot load": ["<internal:/usr/lib/ruby/3.2.0/rubygems/core_ext/kernel_require.rb>:85:in `require': cannot load such file -- rspec (LoadError)"],
      "maven no POM": ["[ERROR] The goal you specified requires a project to execute but there is no POM in this directory (/p). Please verify you invoked Maven from the correct directory. -> [Help 1]"],
      "syntax error (caret frame)": ["/p/tests/syn.test.js:2\nt.test('T-02', () => { let x = ; });\n                               ^\n\nSyntaxError: Unexpected token ';'\n    at wrapSafe (node:internal/modules/cjs/loader:1900:18)",
        "# /p/tests/syn.test.js:2\n# let x = ;\n#         ^\n# SyntaxError: Unexpected token ';'", '  File "/p/tests/test_x.py", line 2\n    x = \n        ^\nSyntaxError: invalid syntax'],
      "pytest collection error": ["!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!"],
    };
    const table = E.CANT_RUN_OUTPUT;
    const labels = table.map((t) => t[2]);
    const noLabel = table.filter((t) => typeof t[2] !== "string" || !t[2]).map((t) => String(t[1]).slice(0, 40));
    const noFixture = labels.filter((l) => !FIX[l]);
    const unknownFixture = Object.keys(FIX).filter((l) => !labels.includes(l));
    const misread = [];
    for (const [kind, re, label] of table) for (const out of FIX[label] || []) {
      const r = S.couldNotRunOutput(out);
      if (!re.test(out) || !r || r.kind !== kind) misread.push([label, out.slice(0, 50), r]);
    }
    ok(!noLabel.length && new Set(labels).size === labels.length && !noFixture.length && !unknownFixture.length && !misread.length,
      "1.24 r6 D5 / D-I3: every CANT_RUN_OUTPUT row names its runner and reads its fixture(s) as could-not-run of its kind (" + table.length + " rows; no label: " + js(noLabel) +
      ", no fixture: " + js(noFixture) + ", unknown: " + js(unknownFixture) + ", misread: " + js(misread) + ")");
    // never an assertion that ran, and never a phrase quoted by one
    const red = ["AssertionError [ERR_ASSERTION]: Expected 'No module named pytest' to equal ''", "not ok 1 - T-01 prints 'Could not open input file: x'\n  ---\n  error: 'boom'",
      "E   assert 'cannot load such file -- x' == ''", "  ✖ T-01 (1.2ms)\n  Expected: \"there is no POM in this directory\"", "expect(received).toBe(expected)\n    SyntaxError: Unexpected token x in JSON at position 0\n    at JSON.parse (<anonymous>)",
      "SyntaxError: Unexpected token x in JSON at position 0\n    at JSON.parse (<anonymous>)\n    at parseConfig (/p/src/config.js:3:15)", "sh: 1: npm: not found"];
    const redWrong = red.filter((o) => S.couldNotRunOutput(o) !== null);
    ok(!redWrong.length, "1.24 r6 D5 / D8: a run where an assertion ran stays red even when it quotes a could-not-run phrase; a runtime SyntaxError (JSON.parse, no caret frame) is no could-not-run (wrong: " + js(redWrong) + ")");
    // the new rows stay linear on 200 KB hostile inputs
    const N = 200000;
    const heads = ["python3: No module named", "python", "Could not open input file: ", "npm ERR! code ", "could not determine", "sh: 1: ", "sh: ", "go: ", "could not find `Cargo.toml` in", "error MSB100",
      "cannot load such file -- ", "there is no POM", "^", "#   ^", "^\n\n", "Interrupted: 1 error", "not ok 1 - ", "not ok 1 - a.js"];
    const slow = [];
    for (const h of heads) for (const fill of [" ", "\t", "a", "^", "#", "\n", "1", "."]) {
      const s = h + fill.repeat(N) + "x";
      const t0 = Date.now();
      S.couldNotRunOutput(s);
      for (const [, re] of table.slice(-14)) re.test(s);
      E.RE_ASSERTION_RAN.test(s);
      const ms = Date.now() - t0;
      if (ms > 1500) slow.push([h, fill, ms]);
    }
    ok(!slow.length, "1.24 r6 D5 / D8: the new could-not-run rows and RE_ASSERTION_RAN stay linear on 200,000-character hostile inputs (slow: " + js(slow) + ")");
  }

  // 1.24 r6 D8: node --test's file-level failure — `not ok 1 - tests/x.test.js` (the subtest named after the FILE: a missing import,
  // a syntax error) — is no assertion that ran: under the TAP reporter (Node 18–22's default when piped) such a broken file was the
  // red proof, under the spec reporter could-not-run. A caret-framed `SyntaxError:` with no assertion run is could-not-run too.
  {
    const TAP_IMP = "TAP version 13\n# Error: Cannot find module '../src/parser'\n# Require stack:\n# - /p/tests/imp.test.js\n# Subtest: tests/imp.test.js\nnot ok 1 - tests/imp.test.js\n  ---\n  duration_ms: 62.1\n  failureType: 'testCodeFailure'\n  exitCode: 1\n  error: 'test failed'\n  code: 'ERR_TEST_FAILURE'\n  ...\n1..1\n# tests 1\n# pass 0\n# fail 1\n";
    const TAP_SYN = "TAP version 13\n# C:" + "\\\\" + "p" + "\\\\" + "tests" + "\\\\" + "syn.test.js:2\n# t.test('T-02', () => { let x = ; });\n#                                ^\n# SyntaxError: Unexpected token ';'\n#     at wrapSafe (node:internal/modules/cjs/loader:1900:18)\n# Subtest: tests" + "\\\\" + "syn.test.js\nnot ok 1 - tests" + "\\\\" + "syn.test.js\n  ---\n  error: 'test failed'\n  ...\n1..1\n# tests 1\n# fail 1\n";
    const SPEC_SYN = "/p/tests/syn.test.js:2\nt.test('T-02', () => { let x = ; });\n                               ^\n\nSyntaxError: Unexpected token ';'\n    at wrapSafe (node:internal/modules/cjs/loader:1900:18)\n\nNode.js v22.11.0\n✖ tests/syn.test.js (72.8ms)\nℹ tests 1\nℹ pass 0\nℹ fail 1\n";
    const TAP_MJS = "TAP version 13\n# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/p/src/a.mjs'\nnot ok 1 - tests/a.test.mjs\n  ---\n  error: 'test failed'\n  ...\n";
    const TAP_RED = "TAP version 13\n# Subtest: T-01 parses a header\nnot ok 1 - T-01 parses a header\n  ---\n  error: |-\n    Expected values to be strictly equal:\n    Cannot find module 'x' was quoted\n  ...\n# tests 1\n# fail 1\n";
    const TAP_NESTED = "TAP version 13\n# Subtest: tests/x.test.js\n    # Subtest: T-01\n    not ok 1 - T-01\n      ---\n      error: 'Cannot find module ''y'''\n      ...\nnot ok 1 - tests/x.test.js\n";
    const k = (o) => { const r = S.couldNotRunOutput(o); return r ? r.kind + ":" + r.text.slice(0, 30) : null; };
    const got = { TAP_IMP: k(TAP_IMP), TAP_SYN: k(TAP_SYN), SPEC_SYN: k(SPEC_SYN), TAP_MJS: k(TAP_MJS), TAP_RED: k(TAP_RED), TAP_NESTED: k(TAP_NESTED) };
    ok(/^test:/.test(got.TAP_IMP) && /^test:/.test(got.TAP_SYN) && /^test:/.test(got.SPEC_SYN) && /^test:/.test(got.TAP_MJS) && got.TAP_RED === null && got.TAP_NESTED === null,
      "1.24 r6 D8: node --test's file-level `not ok 1 - tests/x.test.js` (a missing import, a syntax error; .js / .mjs) is could-not-run under TAP as under spec; a real red test (named, or nested under its file) stays red (got " + js(got) + ")");
    const d = proj("node-file-fail");
    const f = S.createFeature(d, "Broken file", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "- [ ] 1. Write the failing test T-01 _Verify: node --test tests/syn.test.js_\n  - _Expect: fail_\n");
    const r = S.completeTask(d, f.slug, 1, { command: "node --test tests/syn.test.js", exitCode: 1, summary: S.summarizeRunOutput(TAP_SYN) });
    ok(r.ok === false && r.couldNotRun === "output" && /SyntaxError/.test(r.error), "1.24 r6 D8: spec_complete_task refuses a TAP run of a test file that doesn't parse as the red proof (couldNotRun: output) (got " + js([r.ok, r.couldNotRun, (r.error || "").slice(0, 120)]) + ")");
  }

  // 1.24 r6 D4 + D-I2: a PASS that ran no test — node --test "tests 0", go "[no tests to run]" / "[no test files]", cargo "running 0
  // tests", mocha "0 passing", jest "No tests found", pytest "no tests ran" / "collected 0 items", vitest "No test files found" (and
  // unittest, Pester, RSpec, PHPUnit, dotnet, Maven) — proves nothing: spec_complete_task refuses it (couldNotRun: "no-tests"), nothing
  // recorded. Never when the output shows a test ran ("tests 10", "10 passing", one go package ran…).
  {
    const VAC = {
      node: "ℹ tests 0\nℹ suites 0\nℹ pass 0\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 41.2", nodeTap: "TAP version 13\n1..0\n# tests 0\n# suites 0\n# pass 0\n# fail 0",
      goFilter: "ok  \texample.com/m\t0.002s [no tests to run]", goNoFiles: "?   \texample.com/m\t[no test files]",
      cargo: "running 0 tests\n\ntest result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s", mocha: "\n\n  0 passing (1ms)\n",
      jest: "No tests found, exiting with code 0", pytest: "collected 0 items\n\n=== no tests ran in 0.01s ===", pytestQ: "no tests ran in 0.12s", vitest: "No test files found, exiting with code 0",
      unittest: "\n----------------------------------------------------------------------\nRan 0 tests in 0.000s\n\nOK", pester: "Tests completed in 120ms\nTests Passed: 0, Failed: 0, Skipped: 0, Inconclusive: 0, NotRun: 0",
      rspec: "Finished in 0.001 seconds\n0 examples, 0 failures", phpunit: "No tests executed!", dotnet: "No test is available in /p/bin/Debug/net8.0/x.dll. Make sure that test discoverer & executors are registered",
      maven: "[INFO] Tests run: 0, Failures: 0, Errors: 0, Skipped: 0", ansi: String.fromCharCode(27) + "[34mℹ tests 0" + String.fromCharCode(27) + "[39m",
    };
    const RAN = {
      node: "ℹ tests 10\nℹ pass 10\nℹ fail 0", nodeTap: "# tests 3\n# pass 3", mocha: "  10 passing (12ms)", cargo: "running 10 tests\ntest a ... ok",
      cargoMixed: "running 0 tests\n\ntest result: ok. 0 passed\n\nrunning 3 tests\ntest a ... ok\ntest result: ok. 3 passed", goMixed: "?   \tm/a\t[no test files]\nok  \tm/b\t0.104s",
      goCached: "?   \tm/a\t[no test files]\nok  \tm/b\t(cached)", goVerbose: "=== RUN   TestA\n--- PASS: TestA (0.00s)\nPASS\nok  \tm/b\t0.1s\n?   \tm/c\t[no test files]",
      pytest: "collected 10 items\n\n=== 10 passed in 0.12s ===", jest: "Tests:       3 passed, 3 total", jestQuote: "✓ prints 'No tests found' when empty (2 ms)\nTests:       1 passed, 1 total",
      maven: "Tests run: 0, Failures: 0\n[INFO] Tests run: 5, Failures: 0, Errors: 0", pester: "Tests Passed: 3, Failed: 0, Skipped: 0", unittest: "Ran 10 tests in 0.1s\n\nOK", rspec: "10 examples, 0 failures",
      plain: "build ok", empty: "",
    };
    const vWrong = Object.keys(VAC).filter((n) => !S.vacuousRun(VAC[n]));
    const rWrong = Object.keys(RAN).filter((n) => S.vacuousRun(RAN[n]));
    ok(!vWrong.length && !rWrong.length && /tests 0/.test(S.vacuousRun(VAC.node).text) && /no tests to run/.test(S.vacuousRun(VAC.goFilter).text),
      "1.24 r6 D4: vacuousRun reads a pass that ran no test for node --test (spec / TAP), go, cargo, mocha, jest, pytest, vitest, unittest, Pester, RSpec, PHPUnit, dotnet, Maven — never one that shows a test ran (missed: " +
      js(vWrong) + ", wrong: " + js(rWrong) + ")");
    const d = proj("vacuous");
    const f = S.createFeature(d, "Vacuous", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "- [ ] 1. Build the parser _Verify: node --test tests/parser.test.js_\n- [ ] 2. Lint _Verify: npm run lint_\n");
    const r1 = S.completeTask(d, f.slug, 1, { command: "node --test tests/parser.test.js", exitCode: 0, summary: S.summarizeRunOutput(VAC.node) });
    const st1 = fs.existsSync(path.join(f.dir, ".state.json")) ? state(f) : {};
    const ticked = /- \[x\] 1\./.test(fs.readFileSync(path.join(f.dir, "tasks.md"), "utf8"));
    const r2 = S.completeTask(d, f.slug, 2, { command: "npm run lint", exitCode: 0, summary: "0 problems" });
    const r3 = S.completeTask(d, f.slug, 1, { command: "node --test tests/parser.test.js", exitCode: 0, summary: S.summarizeRunOutput(RAN.node) });
    ok(r1.ok === false && r1.couldNotRun === "no-tests" && r1.recorded === undefined && /tests 0/.test(r1.error) && !(st1.evidence && st1.evidence["1"]) && !ticked && r2.ok && r2.verified && r3.ok && r3.verified,
      "1.24 r6 D4: spec_complete_task refuses a passing run whose summary shows no test ran (couldNotRun: no-tests, nothing recorded, not ticked); a lint pass and a run with tests verify (got " +
      js([r1, r2.verified, r3.verified]) + ")");
    const pt = S.createFeature(d, "Vazio", ["core"], "", undefined, "pt");
    fs.writeFileSync(path.join(pt.dir, "tasks.md"), "- [ ] 1. x _Verify: go test ./..._\n");
    const rp = S.completeTask(d, pt.slug, 1, { command: "go test ./...", exitCode: 0, summary: VAC.goNoFiles });
    const keys = ["en", "pt", "es"].map((l) => typeof S.msg(l).evidence.noTests + typeof S.msg(l).runGate.noTests);
    ok(rp.ok === false && rp.couldNotRun === "no-tests" && /^Tarefa 1/.test(rp.error) && keys.every((x) => x === "functionfunction"),
      "1.24 r6 D4: the refusal is localized (PT) and evidence.noTests / runGate.noTests exist in EN / PT / ES (got " + js([rp.couldNotRun, rp.error, keys]) + ")");
    const N = 200000;
    const slow = [];
    for (const h of ["ℹ tests 0", "# tests ", "running 0 tests", "0 passing", "ok  ", "ok \tm\t", "?   \tm\t", "Tests run: 0, Failures: 0", "Tests Passed: 0, Failed: 0", "Ran 0 tests in ", "0 examples, 0 failures", "collected 0 items"])
      for (const fill of [" ", "\t", "1", "a", "\n", "["]) {
        const s = h + fill.repeat(N) + "x";
        const t0 = Date.now();
        S.vacuousRun(s);
        const ms = Date.now() - t0;
        if (ms > 1500) slow.push([h, fill, ms]);
      }
    ok(!slow.length, "1.24 r6 D4: vacuousRun stays linear on 200,000-character hostile inputs (slow: " + js(slow) + ")");
  }

  // 1.24 r6 D-I5: a logged run OLDER than the task's own latest recorded run is not the reported run — the harness saw an earlier
  // one (a pass before the failure on record): only a run logged after the record counts as observed (meta.evidence observed).
  {
    const d = proj("observed-order");
    S.initProject(d, ["core"], "en", { evidence: "observed" });
    if (S.evidenceMode(d) !== "observed") S.initProject(d, undefined, undefined, { evidence: "observed" });
    const f = S.createFeature(d, "Seen", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "- [ ] 1. Build _Verify: npm test_\n");
    const tick = () => { const until = Date.now() + 15; while (Date.now() < until) { /* a later millisecond */ } };
    S.observeRun(d, { command: "npm test", exitCode: 0 }); // the harness saw a pass…
    tick();
    const c1 = S.completeTask(d, f.slug, 1, { command: "npm test", exitCode: 1 }); // …then a failure is recorded (made elsewhere)
    tick();
    const c2 = S.completeTask(d, f.slug, 1, { command: "npm test", exitCode: 0 }); // a pass reported with no new run
    tick();
    S.observeRun(d, { command: "npm test", exitCode: 0 }); // a new run the harness sees
    tick();
    const c3 = S.completeTask(d, f.slug, 1, { command: "npm test", exitCode: 0 });
    ok(S.evidenceMode(d) === "observed" && c1.ok === false && c1.observed === false && c2.observed === false && c2.verified === false && c2.unverifiedReason === "unobserved" &&
      c3.observed === true && c3.verified === true,
      "1.24 r6 D-I5: a pass the harness logged BEFORE the task's own recorded failure no longer stamps a later report observed; a new observed run does (got " +
      js([S.evidenceMode(d), c1.observed, [c2.observed, c2.verified, c2.unverifiedReason], [c3.observed, c3.verified]]) + ")");
  }

  // An _Expect: fail_ task re-run into a crash is unverified; a syntactically incomplete command (`npm test &&`) proves no _Verify:_.
  {
    const js = JSON.stringify;
    const E = require("./lib/engine/index.js");
    const REQ = "# Feature: x\n\n## Summary\nExport invoices as CSV.\n\n### US-1 (P1 — MVP): Export\n#### Acceptance Criteria (EARS)\n" +
      "1. **US-1.AC-1** — WHEN an admin clicks Export THE SYSTEM SHALL download a CSV.\n2. **US-1.AC-2** — IF the export fails THEN THE SYSTEM SHALL show the error code.\n\n" +
      "## Success Criteria\n- **SC-001** — 95% of exports finish in under 5 s.\n\n## Out of Scope\n- PDF export.\n";
    const feature = (n, tasks) => {
      const p = path.join(tmp, "proj-r7e-" + n);
      S.initProject(p, ["core"], "en");
      const f = S.createFeature(p, "Export", ["core"]);
      fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
      fs.writeFileSync(path.join(f.dir, "tasks.md"), tasks);
      return { p, f };
    };

    // Finding 3 — expectFailIssue treated only a could-not-run record as a failed re-check: a re-run of an _Expect: fail_ task that
    // CRASHED (exit 139, an access violation 0xC0000005 — unsigned or signed) fell through to the red run carried forward, so the task
    // stayed verified and finish didn't block. A crash is a failed re-check now, like a could-not-run run.
    {
      const TASKS = "# Tasks\n\n- [ ] 1. [US1] Write the failing test for the export\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Verify: node tests/export.test.js_\n  - _Expect: fail_\n";
      const got = [];
      for (const code of [139, 0xC0000005, 0xC0000005 - 0x100000000, 134]) {
        const { p, f } = feature("xf-crash-" + (code < 0 ? "neg" : code), TASKS);
        const red = S.completeTask(p, f.slug, 1, { command: "node tests/export.test.js", exitCode: 1, summary: "AssertionError: expected 1 to equal 2" });
        const before = S.verificationStatus(p, f.slug, f.dir).unverifiedDetail;
        const fin0 = S.finishFeature(p, f.slug);
        const again = S.completeTask(p, f.slug, 1, { command: "node tests/export.test.js", exitCode: code, summary: "Segmentation fault (core dumped)" });
        const vs = S.verificationStatus(p, f.slug, f.dir);
        const fin = S.finishFeature(p, f.slug);
        got.push({ code, red: red.ok && red.verified, before, again: again.couldNotRun, after: vs.unverifiedDetail, blocked: (fin.blockers || []).some((b) => /verif/i.test(b)) && !(fin0.blockers || []).some((b) => /verif/i.test(b)), blockers: fin.blockers });
      }
      ok(got.every((g) => g.red && js(g.before) === "[]" && g.again === "crash" && js(g.after) === '[{"number":1,"reason":"failed-run"}]' && g.blocked),
        "1.25.1 review 7: an _Expect: fail_ task whose re-run crashed (139, 0xC0000005 unsigned / signed, 134) is unverified (failed-run) and blocks finish — the red run carried forward no longer covers it (got " + js(got) + ")");
    }

    // Finding 8 — a reported run `npm test &&` (a dangling operator) proved `npm test`: proofSteps dropped the empty step. A command no
    // shell runs as written (an operator with no command after / before it, or two in a row) proves no _Verify:_ now.
    {
      const TASKS = "# Tasks\n\n- [ ] 1. [US1] Build the export\n  - _Requirements: US-1.AC-1_\n  - _Verify: npm test_\n" +
        "- [ ] 2. [US1] Show the error code\n  - _Requirements: US-1.AC-2_\n  - _Verify: npm test_\n";
      const { p, f } = feature("incomplete", TASKS);
      const c1 = S.completeTask(p, f.slug, 1, { command: "npm test &&", exitCode: 0, summary: "12 passing" });
      const c2 = S.completeTask(p, f.slug, 2, { command: "npm test", exitCode: 0, summary: "12 passing" });
      const vs = S.verificationStatus(p, f.slug, f.dir);
      const inc = ["npm test &&", "npm test ||", "npm test |", "&& npm test", "a && && b", "a; && b", "a | ; b"].map((c) => E.proofIncomplete(c));
      const fine = ["npm test", "npm test && npm run lint", "npm test | tee log.txt", "npm test;", "; npm test", "npm test 2>&1", "a |& b",
        "node -e \"a &&\"", "cmd /c \"npm test &&\"", "echo $(a && b)", "npm test &"].map((c) => E.proofIncomplete(c));
      ok(c1.ok && c2.ok && js(vs.unverifiedDetail.map((d) => d.number)) === "[1]" && vs.unverifiedDetail[0].reason === "command-mismatch" &&
        inc.every(Boolean) && !fine.some(Boolean) &&
        E.runProvesVerify({ command: "npm test &&", exitCode: 0 }, ["npm test"], p) === false && E.runProvesVerify({ command: "npm test", exitCode: 0 }, ["npm test"], p) === true,
        "1.25.1 review 7: a run reported as `npm test &&` (or `npm test |`, `&& npm test`, `a && && b`) proves no _Verify:_ — the task ticks but stays unverified (command-mismatch); quoted operators, a trailing `;` / `&`, a pipe and a substitution are complete commands (got " +
        js([c1.ok, c2.ok, vs.unverifiedDetail, inc, fine]) + ")");
    }
  }
};
