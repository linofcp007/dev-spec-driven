"use strict";
// Evidence — _Verify:_ runs, _Expect: fail_, project checks, pipes, git-linked and harness-observed evidence.
// Red → green, meta.checks and the finish suite run, could-not-run refusals, the observe hook and the evidence mode.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, rpc, payload, S, tmp, list, __dirname }) => {

  { // A4.2 — a _Verify:_ that pipes into another command reports the pipeline's LAST exit code: a failing check reads as passing.
    const call = (name, args) => rpc("tools/call", { name, arguments: args });
    const vp = S.verifyPipeMasked;
    const pipeYes = ["npm test | tee log", "pytest | grep passed", "npm test 2>&1 | tee out.log", "a |& tee x", "a|b", 'node x.js | tee "log file"', "(npm test | tee log)",
      "npm test && eslint . | tee lint.log"];
    const pipeNo = ["npm test || exit 1", "a || b", 'grep "a|b" file', "grep 'a|b' file", "echo $(ls | wc -l)", "echo `ls | wc -l`", "set -o pipefail; npm test | tee log",
      'bash -o pipefail -c "npm test | tee log"', "a \\| b", "a >| out", "npm test", "echo a^|b", 'node -e "process.exit(0)"', 'test "$(git status | wc -l)" = 0', "", null];
    const vpWrong = pipeYes.filter((c) => !vp(c)).map((c) => "missed: " + c).concat(pipeNo.filter((c) => vp(c)).map((c) => "flagged: " + c));
    ok(!vpWrong.length, "verifyPipeMasked: an unquoted single | (also |&, inside a subshell) is flagged; ||, a quoted '|' / \"|\", \\| / ^|, >|, a pipe inside $(…) / `…` and a command setting pipefail are not (" + vpWrong.join(" · ") + ")");

    const pp = path.join(tmp, "proj-a4-pipes");
    S.initProject(pp, ["core"], "en");
    const pf = S.createFeature(pp, "Pipes", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(pf.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Piped check\n  - _Verify: `npm test | tee test.log`_\n" +
      "- [ ] 2. [US1] Quoted pipe\n  - _Verify: grep \"a|b\" notes.txt_\n- [ ] 3. [US1] Or-chain\n  - _Verify: npm test || exit 1_\n- [ ] 4. [US1] Plain\n  - _Verify: npm test_\n");
    const b1 = S.taskBrief(pp, "pipes", 1), b2 = S.taskBrief(pp, "pipes", 2), b3 = S.taskBrief(pp, "pipes", 3);
    const b1w = S.taskBrief(pp, "pipes", 1, { write: true });
    const verifySec = (md) => (md.split("## Verification (_Verify:_)")[1] || "").split("\n## ")[0];
    ok(JSON.stringify(b1.verifyPipes) === '["npm test | tee test.log"]' && /`npm test \| tee test\.log` pipes into another command: a pipeline's exit code is its LAST command's/.test(verifySec(b1.brief)) &&
      /set -o pipefail/.test(verifySec(b1.brief)) && b2.verifyPipes === undefined && b3.verifyPipes === undefined && !/pipes into another command/.test(b2.brief + b3.brief) &&
      JSON.stringify(b1w.verifyPipes) === '["npm test | tee test.log"]' && /pipes into another command/.test(fs.readFileSync(b1w.paths.brief, "utf8")),
      "spec_task_brief: a piped _Verify:_ is noted in the brief's Verification section and listed in verifyPipes (write:true too); a quoted '|' and '||' are not (got " + JSON.stringify([b1.verifyPipes, b2.verifyPipes, b3.verifyPipes]) + ")");

    const d1 = S.specDoctor(pp, "pipes");
    const dPipe = d1.checks.find((c) => c.id === "verify-pipes");
    const clean = S.createFeature(pp, "No pipes", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(clean.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Plain\n  - _Verify: npm test_\n- [ ] 2. [US1] Quoted\n  - _Verify: grep 'x|y' f_\n");
    ok(dPipe && dPipe.status === "warn" && /#1 `npm test \| tee test\.log`/.test(dPipe.detail) && !/#2|#3|#4/.test(dPipe.detail) &&
      !S.specDoctor(pp, "no-pipes").checks.some((c) => c.id === "verify-pipes"),
      "spec_doctor: a warn check 'verify-pipes' names the task whose _Verify:_ pipes (only #1); a feature without one has no such check (got " + JSON.stringify(dPipe) + ")");

    const c1 = S.completeTask(pp, "pipes", 1, { command: "npm test | tee test.log", exitCode: 0, summary: "12 passing" });
    const c2 = S.completeTask(pp, "pipes", 2, { command: 'grep "a|b" notes.txt', exitCode: 0 });
    const c3 = S.completeTask(pp, "pipes", 3, { command: "set -o pipefail; npm test | tee test.log", exitCode: 0 });
    const c4 = S.completeTask(pp, "pipes", 4, { command: "npm test | tee test.log", exitCode: 1 });
    ok(c1.ok && c1.pipeMasked === true && c1.verified === true && /Task 1: the recorded command pipes into another one \(`npm test \| tee test\.log`\)/.test(c1.note) &&
      c2.ok && c2.pipeMasked === undefined && !c2.note && c3.ok && c3.pipeMasked === undefined && c4.ok === false && c4.recorded && c4.pipeMasked === undefined,
      "spec_complete_task: a passing run whose command pipes → recorded + ticked with pipeMasked: true and a note; a quoted '|', a pipefail command and a failing run are not flagged (got " +
      JSON.stringify([c1.pipeMasked, c1.note, c2.pipeMasked, c3.pipeMasked, c4.pipeMasked]) + ")");

    // MCP = engine; PT / ES wording.
    const mb = payload(await call("spec_task_brief", { name: "pipes", number: 1, projectDir: pp }));
    const md = payload(await call("spec_doctor", { name: "pipes", projectDir: pp }));
    fs.writeFileSync(path.join(pf.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Piped again\n  - _Verify: pytest | grep passed_\n");
    const mc = payload(await call("spec_complete_task", { name: "pipes", number: 1, evidence: { command: "pytest | grep passed", exitCode: 0 }, projectDir: pp }));
    const ptF = S.createFeature(pp, "Tubos", ["core"], "", undefined, "pt");
    const esF = S.createFeature(pp, "Tuberias", ["core"], "", undefined, "es");
    for (const f of [ptF, esF]) fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] x\n  - _Verify: npm test | tee log_\n");
    const ptB = S.taskBrief(pp, "tubos", 1), esB = S.taskBrief(pp, "tuberias", 1);
    const ptD = S.specDoctor(pp, "tubos").checks.find((c) => c.id === "verify-pipes"), esD = S.specDoctor(pp, "tuberias").checks.find((c) => c.id === "verify-pipes");
    const ptC = S.completeTask(pp, "tubos", 1, { command: "npm test | tee log", exitCode: 0 }), esC = S.completeTask(pp, "tuberias", 1, { command: "npm test | tee log", exitCode: 0 });
    const keysOf = (l) => Object.keys(S.msg(l).verifyPipe).sort().join();
    ok(JSON.stringify(mb.verifyPipes) === '["npm test | tee test.log"]' && md.checks.some((c) => c.id === "verify-pipes" && c.status === "warn") && mc.ok && mc.pipeMasked === true &&
      /encaminha a saída para outro comando \(pipe\)/.test(ptB.brief) && /redirige su salida a otro comando \(pipe\)/.test(esB.brief) &&
      /um comando _Verify:_ encaminha a saída/.test(ptD.detail) && /un comando _Verify:_ redirige su salida/.test(esD.detail) &&
      ptC.pipeMasked && /^Tarefa 1: o comando registado encaminha/.test(ptC.note) && esC.pipeMasked && /^Tarea 1: el comando registrado redirige/.test(esC.note) &&
      keysOf("en") === "brief,completeNote,doctor,runHint" && keysOf("pt") === keysOf("en") && keysOf("es") === keysOf("en") &&
      S.msg("pt").verifyPipe.runHint("a | b") !== S.msg("en").verifyPipe.runHint("a | b") && /cmd\.exe/.test(S.msg("es").verifyPipe.runHint("a | b")),
      "MCP spec_task_brief / spec_doctor / spec_complete_task carry verifyPipes / verify-pipes / pipeMasked like the engine; the brief note, doctor detail and complete note are in PT / ES; the verifyPipe messages have the same keys in EN / PT / ES");
  }

  { // 1.14 B5 — evidence: red → green (_Expect: fail_), project checks (meta.checks) + the finish suite run, git-linked evidence
    const b5Call = async (tool, args) => payload(await rpc("tools/call", { name: tool, arguments: args }));
    const b5Dir = (n) => path.join(tmp, "b5-" + n);
    const b5State = (f) => JSON.parse(fs.readFileSync(path.join(f.dir, ".state.json"), "utf8"));
    const b5Tasks = (f, text) => fs.writeFileSync(path.join(f.dir, "tasks.md"), text);
    const b5Read = (f, rel) => fs.readFileSync(path.join(f.dir, rel), "utf8");
    const b5Tick = () => { const until = Date.now() + 15; while (Date.now() < until) { /* a later millisecond for the next timestamp */ } };

    // --- B5.1 the marker: English-stable, value kept whole; only `fail` sets it; a fenced example never does.
    const mkB5 = (line, body) => S.taskBlocks("- [ ] 1. " + line + "\n" + (body || "")).find((b) => b.number === 1);
    ok(S.expectsFail(mkB5("t", "  - _Expect: fail_\n")) && S.expectsFail(mkB5("t _Expect: FAIL_")) && S.expectsFail(mkB5("t", "  - _Expect: `fail`_\n")) &&
      !S.expectsFail(mkB5("t", "  - _Expect: pass_\n")) && !S.expectsFail(mkB5("t", "  ```md\n  - _Expect: fail_\n  ```\n")) && !S.expectsFail(mkB5("t")),
      "B5 _Expect: fail_ is read from the task line or a sub-line (any case, backticks dropped); `pass`, a fenced example or no marker leave a must-pass task");

    // --- B5.1 spec_complete_task: a passing run is refused (the test tests nothing), a FAILING run is the proof.
    const d1 = b5Dir("red");
    S.initProject(d1, ["tdd"], "en");
    const f1 = S.createFeature(d1, "Red Green", ["tdd"], "", undefined, "en");
    b5Tasks(f1, "# Tasks\n\n## Phase 1\n\n" +
      "- [ ] 1. [US1] Write test T-01 and watch it fail\n  - _Requirements: US-1.AC-1_\n  - _Verify: node tests/t01.test.js_\n  - _Expect: fail_\n" +
      "- [ ] 2. [US1] Implement the check\n  - _Requirements: US-1.AC-1_\n  - _Makes green: T-01_\n  - _Verify: node tests/t01.test.js_\n");
    const pass0 = await b5Call("spec_complete_task", { projectDir: d1, name: "red-green", number: 1, evidence: { command: "node tests/t01.test.js", exitCode: 0, summary: "1 passing" } });
    const st0 = b5State(f1).evidence["1"];
    const red1 = await b5Call("spec_complete_task", { projectDir: d1, name: "red-green", number: 1, evidence: { command: "node tests/t01.test.js", exitCode: 1, summary: "1 failing" } });
    const st1 = b5State(f1).evidence["1"];
    ok(pass0.ok === false && pass0.recorded === true && pass0.unexpectedPass === true && pass0.expected === "fail" && /the test doesn't fail yet, so it tests nothing/.test(pass0.error) &&
      st0.exitCode === 0 && st0.expected === "fail" && red1.ok === true && red1.completed === 1 && red1.verified === true && red1.redRecorded === true && red1.expected === "fail" &&
      !red1.unverifiedReason && st1.exitCode === 1 && st1.expected === "fail" && st1.history.length === 2 && /- \[x\] 1\./.test(b5Read(f1, "tasks.md")),
      "B5 spec_complete_task on an _Expect: fail_ task: a passing run is refused and recorded (unexpectedPass), then a FAILING run is the proof — ticked, verified, redRecorded, stored with expected: 'fail' (got " +
      JSON.stringify([pass0.error, red1]).slice(0, 300) + ")");
    const green2 = await b5Call("spec_complete_task", { projectDir: d1, name: "red-green", number: 2, evidence: { command: "node tests/t01.test.js", exitCode: 0 } });
    const again1 = await b5Call("spec_complete_task", { projectDir: d1, name: "red-green", number: 1, evidence: { command: "node tests/t01.test.js", exitCode: 0, summary: "1 passing" } });
    const st1b = b5State(f1).evidence["1"];
    const met1 = S.metrics(d1, f1.slug).evidence;
    ok(green2.ok && green2.verified && !green2.expected && again1.ok === true && again1.alreadyDone && again1.verified === true && again1.expected === "fail" && !again1.redRecorded &&
      /its test passes now — expected once the fix is in; the red run recorded on \d{4}-\d{2}-\d{2} stays the proof/.test(again1.note) &&
      st1b.exitCode === 0 && !st1b.expected && st1b.red && st1b.red.exitCode === 1 && st1b.red.command === "node tests/t01.test.js" &&
      !S.verificationStatus(d1, f1.slug, f1.dir).unverified.length && met1.runs === 4 && met1.passing === 3,
      "B5 after the fix: a passing re-run of the _Expect: fail_ task keeps the red run as its proof (red) — verified, with a note; metrics count the red run as a pass and the refused pass as a failure (got " +
      JSON.stringify([again1.note, met1]) + ")");

    // Edges: a command that could not run, a note, a ticked task with no red run, no runnable _Verify:_, a stale red run.
    const d2 = b5Dir("edges");
    S.initProject(d2, ["tdd"], "en");
    const f2 = S.createFeature(d2, "Edge", ["tdd"], "", undefined, "en");
    b5Tasks(f2, "- [ ] 1. [US1] Write T-01 red\n  - _Verify: node t.js_\n  - _Expect: fail_\n- [ ] 2. [US1] Note only\n  - _Verify: node t.js_\n  - _Expect: fail_\n" +
      "- [x] 3. [US1] Ticked before the marker\n  - _Verify: node t.js_\n  - _Expect: fail_\n- [ ] 4. [US1] No verify\n  - _Expect: fail_\n");
    const cant = S.completeTask(d2, f2.slug, 1, { command: "node t.js", exitCode: 127 });
    const note2 = S.completeTask(d2, f2.slug, 2, { summary: "it fails" });
    const tick3 = S.completeTask(d2, f2.slug, 3, { command: "node t.js", exitCode: 0 });
    const vs2 = S.verificationStatus(d2, f2.slug, f2.dir);
    const docV2 = S.specDoctor(d2, f2.slug).checks.find((c) => c.id === "verification");
    const none4 = S.completeTask(d2, f2.slug, 4);
    ok(cant.ok === false && cant.recorded && !cant.unexpectedPass && /exit 127 means the command itself could not run/.test(cant.error) && /Not marking it done/.test(cant.error) &&
      note2.ok && note2.verified === false && note2.unverifiedReason === "manual-note-on-runnable-verify" &&
      tick3.ok === false && tick3.unexpectedPass && /is ticked, but it expects its test to FAIL/.test(tick3.error) &&
      vs2.unverifiedDetail.some((x) => x.number === 3 && x.reason === "unexpected-pass") && /#3 \(run passed, but _Expect: fail_ needs a red run\)/.test(docV2.detail) &&
      none4.ok && none4.verified && none4.nothingToVerify && none4.expected === "fail",
      "B5 _Expect: fail_ edges: exit 127 is refused (no red test); a note never proves a runnable _Verify:_; a ticked task whose run passes with no red run before it becomes unverified (reason unexpected-pass, labelled in doctor); without a runnable _Verify:_ nothing recorded is nothingToVerify (got " +
      JSON.stringify([cant.error, docV2.detail]).slice(0, 300) + ")");
    const st2 = b5State(f2);
    st2.evidence["1"] = { command: "node t.js", exitCode: 1, at: "2026-01-01T00:00:00.000Z", task: "[US1] Write T-01 red", verify: "node t.js", stale: true };
    fs.writeFileSync(path.join(f2.dir, ".state.json"), JSON.stringify(st2));
    const staleRun = S.completeTask(d2, f2.slug, 1, { command: "node t.js", exitCode: 0 });
    ok(staleRun.ok === false && staleRun.unexpectedPass === true, "B5 a red run marked stale (spec_impact --reopen: the spec changed) proves nothing — a pass after it is refused, a new red run is needed");

    // The red-phase guidance points at _Expect: fail_ (EN/PT/ES); with the marker the red run is the proof (no redPhaseVerify).
    const d3 = b5Dir("hint");
    S.initProject(d3, ["tdd"], "en");
    const mkHint = (lang, name) => {
      const f = S.createFeature(d3, name, ["tdd"], "", undefined, lang);
      b5Tasks(f, "- [ ] 1. [US1] Write regression test T-01 and watch it fail for the right reason\n  - _Verify: node t.js_\n" +
        "- [ ] 2. [US1] Write regression test T-02 and watch it fail for the right reason\n  - _Verify: node t.js_\n  - _Expect: fail_\n");
      return f;
    };
    const fh = mkHint("en", "Hint En"), fhp = mkHint("pt", "Dica Pt"), fhe = mkHint("es", "Pista Es");
    const h1 = S.completeTask(d3, fh.slug, 1, { command: "node t.js", exitCode: 1 });
    const h2 = S.completeTask(d3, fh.slug, 2, { command: "node t.js", exitCode: 1 });
    const hp = S.completeTask(d3, fhp.slug, 1, { command: "node t.js", exitCode: 1 });
    const he = S.completeTask(d3, fhe.slug, 1, { command: "node t.js", exitCode: 1 });
    const hp2 = S.completeTask(d3, fhp.slug, 2, { command: "node t.js", exitCode: 0 });
    const he2 = S.completeTask(d3, fhe.slug, 2, { command: "node t.js", exitCode: 0 });
    const hpNote = S.completeTask(d3, fhp.slug, 2, { command: "node t.js", exitCode: 9009 });
    ok(h1.ok === false && h1.redPhaseVerify && /Mark task 1 with _Expect: fail_/.test(h1.error) && h2.ok && h2.redRecorded && !h2.redPhaseVerify &&
      /Marca a tarefa 1 com _Expect: fail_ — uma execução que FALHE passa a ser a prova \(T-01 falha antes da correção\)/.test(hp.error) &&
      /Marca la tarea 1 con _Expect: fail_ — una ejecución que FALLE es entonces su prueba \(T-01 falla antes del arreglo\)/.test(he.error) &&
      /A tarefa 2 espera que o seu teste FALHE \(_Expect: fail_\), mas a execução passou \(exit 0\) — o teste ainda não falha, por isso não testa nada/.test(hp2.error) &&
      /La tarea 2 espera que su prueba FALLE \(_Expect: fail_\), pero la ejecución pasó \(exit 0\) — la prueba aún no falla, así que no prueba nada/.test(he2.error) &&
      /Tarefa 2: exit 9009 significa que o próprio comando não pôde correr/.test(hpNote.error),
      "B5 a red-phase task without _Expect: fail_: its refusal points at _Expect: fail_ (EN/PT/ES); with the marker the red run is the proof; the unexpected-pass / could-not-run refusals are localized (PT/ES)");

    // --- B5.1 doctor red-green (+tdd warn): T-IDs made green by done tasks need a recorded red run of an _Expect: fail_ task citing them.
    const d4 = b5Dir("rg");
    S.initProject(d4, ["tdd"], "en");
    const f4 = S.createFeature(d4, "Rg", ["tdd"], "", undefined, "en");
    b5Tasks(f4, "- [ ] 1. [US1] Write T-01 and T-02\n  - _Verify: node t.js_\n- [ ] 2. [US1] Implement\n  - _Makes green: T-01, T-02_\n  - _Verify: node t.js_\n- [ ] 3. [US1] Later\n  - _Makes green: T-03_\n");
    const rgNone = S.specDoctor(d4, f4.slug).checks.find((c) => c.id === "red-green");
    S.completeTask(d4, f4.slug, 1, { command: "node t.js", exitCode: 0 });
    S.completeTask(d4, f4.slug, 2, { command: "node t.js", exitCode: 0 });
    const rgWarn = (await b5Call("spec_doctor", { projectDir: d4, name: "rg" })).checks.find((c) => c.id === "red-green");
    b5Tasks(f4, b5Read(f4, "tasks.md").replace("- [x] 1. [US1] Write T-01 and T-02\n  - _Verify: node t.js_\n", "- [x] 1. [US1] Write T-01 and T-02\n  - _Verify: node t.js_\n  - _Expect: fail_\n"));
    const rgStill = S.specDoctor(d4, f4.slug).checks.find((c) => c.id === "red-green"); // its recorded run passed — no red run yet
    const rgRed = S.completeTask(d4, f4.slug, 1, { command: "node t.js", exitCode: 1 });
    const rgPass = S.specDoctor(d4, f4.slug).checks.find((c) => c.id === "red-green");
    const fCore = S.createFeature(d4, "Plain", ["core"], "", undefined, "en");
    b5Tasks(fCore, "- [x] 1. [US1] Implement\n  - _Makes green: T-01_\n");
    const fPt4 = S.createFeature(d4, "Rg Pt", ["tdd"], "", undefined, "pt");
    b5Tasks(fPt4, "- [x] 1. [US1] Implementar\n  - _Makes green: T-07_\n");
    ok(!rgNone && rgWarn && rgWarn.status === "warn" && /T-IDs made green by done tasks without a recorded red run: T-01, T-02 — a test that never failed proves nothing/.test(rgWarn.detail) &&
      !/T-03/.test(rgWarn.detail) && rgStill.status === "warn" && rgRed.ok && rgRed.redRecorded && rgPass.status === "pass" && /\(2\) has a recorded red run/.test(rgPass.detail) &&
      !S.specDoctor(d4, fCore.slug).checks.some((c) => c.id === "red-green") &&
      /T-IDs postos a verde por tarefas feitas sem uma execução vermelha registada: T-07/.test(S.specDoctor(d4, fPt4.slug).checks.find((c) => c.id === "red-green").detail),
      "B5 doctor red-green: warns naming the T-IDs done tasks make green with no recorded red run (never an open task's), passes once an _Expect: fail_ task citing them records a red run; not on core; PT (got " +
      JSON.stringify([rgWarn && rgWarn.detail, rgPass && rgPass.detail]).slice(0, 300) + ")");

    // --- B5.1 the brief: its Verification section says the run must fail (heading too without a _Verify:_); kept with write:true.
    const br1 = await b5Call("spec_task_brief", { projectDir: d1, name: "red-green", number: 1 });
    const br2 = await b5Call("spec_task_brief", { projectDir: d1, name: "red-green", number: 2 });
    const brW = await b5Call("spec_task_brief", { projectDir: d1, name: "red-green", number: 1, write: true });
    const br4 = S.taskBrief(d2, f2.slug, 4);
    const brPt = S.taskBrief(d3, fhp.slug, 2);
    ok(br1.expect === "fail" && /## Verification \(_Verify:_\)\n- `node tests\/t01\.test\.js`\n\n\*\*Expected result: FAIL\*\* \(_Expect: fail_\) — the run must exit non-zero/.test(br1.brief) &&
      /\n\d+\. The _Verify:_ run must FAIL \(non-zero exit\) for the right reason/.test(br1.brief) && !br2.expect && !/Expected result: FAIL/.test(br2.brief) &&
      brW.expect === "fail" && brW.brief === undefined && /## Verification \(_Verify:_\)\n\n\*\*Expected result: FAIL\*\*/.test(br4.brief) &&
      /\*\*Resultado esperado: FALHA\*\* \(_Expect: fail_\)/.test(brPt.brief) && /A execução do _Verify:_ tem de FALHAR/.test(brPt.brief),
      "B5 brief: an _Expect: fail_ task's Verification section and definition of done say the run must FAIL (expect: 'fail', kept with write:true; the heading appears without a _Verify:_; PT)");

    // --- B5.1 next_action's verify step: an _Expect: fail_ task whose run passed is told its proof is a FAILING run (never "a
    // passing run"), and no red-phase hint that would tell it to add the marker it has. A written bugfix, gated phase by phase (EN / PT).
    const redExpect = (d, lang) => {
      const b = S.createFeature(d, "Red expect " + lang, undefined, "loop", undefined, lang, "bugfix");
      const tp = path.join(b.dir, "tasks.md");
      fs.writeFileSync(tp, fs.readFileSync(tp, "utf8").replace(/  - _Verify: \[[^\]\n]*T-01\]_\n/, "  - _Verify: node tests/t01.test.js_\n")); // the scaffold's task 3 already carries _Expect: fail_
      const bp = path.join(b.dir, "bug.md");
      fs.writeFileSync(bp, fs.readFileSync(bp, "utf8").replace(/> \*\*TODO\*\*[^\n]*/g, "The handler redirects before clearing the cookie (auth.js:88).").replace(/\[[^\]\n]+\]/g, "the dashboard opens"));
      const fillAll = (rel, re, by) => { const p = path.join(b.dir, rel); fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(re, by)); };
      fillAll("requirements.md", /\[[^\]\n]+\]/g, "the refresh token has expired");
      fillAll("test-plan.md", /\[[^\]\n]+\]/g, "tests/t01.test.js");
      fillAll("tasks.md", /\[(?!shared\]|US\d+\]|[ xX]\])[^\]\n]+\]/g, "npm test");
      ["requirements", "design", "test-plan", "tasks"].forEach((ph) => S.approvePhase(d, b.slug, ph));
      S.completeTask(d, b.slug, 1); S.completeTask(d, b.slug, 2);
      const pass3 = S.completeTask(d, b.slug, 3, { command: "node tests/t01.test.js", exitCode: 0 });
      fs.writeFileSync(tp, fs.readFileSync(tp, "utf8").replace(/- \[ \] 3\./, "- [x] 3.").replace(/- \[ \] 4\./, "- [x] 4."));
      return { b, pass3, na: S.nextAction(d, b.slug) };
    };
    const d10 = b5Dir("na");
    S.initProject(d10, ["core"], "en");
    const reEn = redExpect(d10, "en"), rePt = redExpect(d10, "pt");
    ok(reEn.pass3.unexpectedPass === true && reEn.na.step === "verify" && /#3 \(run passed, but _Expect: fail_ needs a red run\)/.test(reEn.na.recommendation) &&
      /Task 3 is marked _Expect: fail_: its proof is a run that FAILS .*\(dev-spec done red-expect-en 3 --run while the test fails/.test(reEn.na.recommendation) &&
      !/Mark task 3 with _Expect: fail_/.test(reEn.na.recommendation) && rePt.na.step === "verify" && /A tarefa 3 tem _Expect: fail_: a prova é uma execução que FALHA/.test(rePt.na.recommendation),
      "B5 next_action verify: an _Expect: fail_ task whose run passed (unexpected-pass) is told its proof is a FAILING run — no 'add the marker' red-phase hint; PT (got " +
      JSON.stringify([reEn.na.step, reEn.na.recommendation]).slice(0, 400) + ")");

    // --- B5.2 spec_init {checks}: meta.checks merged (add / replace / "" removes), validated before ANY write; the result reports them.
    const d5 = b5Dir("checks");
    const rp5 = path.join(d5, ".specs", "roadmap.json");
    const i1 = await b5Call("spec_init", { projectDir: d5, tracks: ["tdd"], checks: { test: "node -e \"process.exit(0)\"", lint: "npm run lint" } });
    const i2 = await b5Call("spec_init", { projectDir: d5, checks: { lint: "", typecheck: "npx tsc --noEmit", test: "  node -e \"process.exit(0)\"  " } });
    const i3 = await b5Call("spec_init", { projectDir: d5 });
    const before5 = fs.readFileSync(rp5, "utf8");
    const bad1 = await b5Call("spec_init", { projectDir: d5, lang: "pt", checks: { "bad name": "x" } });
    const bad2 = await b5Call("spec_init", { projectDir: d5, checks: { test: "a\nb" } });
    const bad3 = S.initProject(d5, ["core"], undefined, { checks: JSON.parse('{"__proto__": "x"}') });
    const bad4 = await rpc("tools/call", { name: "spec_init", arguments: { projectDir: d5, checks: ["npm test"] } });
    const many5 = {};
    for (let i = 0; i < 20; i++) many5["c" + i] = "x";
    const bad5 = S.initProject(d5, ["core"], undefined, { checks: many5 });
    ok(i1.checks.test === "node -e \"process.exit(0)\"" && i1.checks.lint === "npm run lint" && JSON.stringify(i2.checks) === JSON.stringify({ test: "node -e \"process.exit(0)\"", typecheck: "npx tsc --noEmit" }) &&
      JSON.stringify(JSON.parse(before5).meta.checks) === JSON.stringify(i2.checks) && JSON.stringify(i3.checks) === JSON.stringify(i2.checks) &&
      bad1.ok === false && /nome de verificação inválido 'bad name'/.test(bad1.error) && bad2.ok === false && /must be one line of text/.test(bad2.error) &&
      bad3.ok === false && /invalid check name '__proto__'/.test(bad3.error) && bad4.result.isError === true && /checks must be an object/.test(bad4.result.content[0].text) &&
      bad5.ok === false && /at most 20 project checks/.test(bad5.error) && fs.readFileSync(rp5, "utf8") === before5 && JSON.parse(before5).meta.lang !== "pt",
      "B5 spec_init {checks}: added / replaced / an empty command removes one, the result always reports them; a bad name (PT message), a multi-line command, '__proto__', a non-object (schema) or > 20 checks are refused before anything — the language included — is written");
    const d6 = b5Dir("badstored");
    S.initProject(d6, ["core"], "en");
    const rp6 = path.join(d6, ".specs", "roadmap.json");
    const rj6 = JSON.parse(fs.readFileSync(rp6, "utf8"));
    rj6.meta.checks = { test: 5, lint: "npm run lint" };
    fs.writeFileSync(rp6, JSON.stringify(rj6));
    const bs6 = S.initProject(d6, ["core"], undefined, { checks: { e2e: "x" } });
    const f6 = S.createFeature(d6, "Stored", ["core"], "", undefined, "en");
    const fin6 = S.finishFeature(d6, f6.slug);
    ok(bs6.ok === false && /meta\.checks is not an object of name → command strings — fix it by hand/.test(bs6.error) && JSON.parse(fs.readFileSync(rp6, "utf8")).meta.checks.test === 5 &&
      fin6.warnings.some((w) => /meta\.checks: invalid entries ignored \(test\)/.test(w)) && fin6.suiteChecks.length === 1 && fin6.suiteChecks[0].name === "lint",
      "B5 a hand-edited meta.checks with a non-string command: spec_init refuses to change it (never repaired); finish ignores the bad entry with a warning and keeps the valid ones");

    // --- B5.2 finish: suite-evidence blocks (doctor warns once every task is done) until every check has a passing run since the last task activity.
    const d7 = b5Dir("suite");
    const okCmd = "node -e \"process.exit(0)\"";
    S.initProject(d7, ["core"], "en", { checks: { test: okCmd, lint: "npm run lint" } });
    const f7 = S.createFeature(d7, "Suite", ["core"], "", undefined, "en");
    b5Tasks(f7, "- [ ] 1. [US1] Do it\n");
    const docOpen7 = S.specDoctor(d7, f7.slug).checks.find((c) => c.id === "suite-evidence");
    const finOpen7 = S.finishFeature(d7, f7.slug);
    S.completeTask(d7, f7.slug, 1);
    const docDone7 = (await b5Call("spec_doctor", { projectDir: d7, name: "suite" })).checks.find((c) => c.id === "suite-evidence");
    const gate7 = S.approvePhase(d7, f7.slug, "execution", "t");
    ok(!docOpen7 && finOpen7.suiteChecks.every((c) => c.status === "no-run") && finOpen7.blockers.some((b) => /project checks without a passing run since the last task activity: test \(no run recorded\), lint \(no run recorded\) — run them: dev-spec finish suite --run/.test(b)) &&
      docDone7 && docDone7.status === "warn" && /every task is done, but project checks have no passing run/.test(docDone7.detail) &&
      gate7.ok === false && gate7.failing.includes("suite-evidence") && typeof b5State(f7).lastTickAt === "string",
      "B5 meta.checks set: finish blocks on suite-evidence (every check without a run named), doctor warns once every task is done (not before), the execution sign-off refuses on it; a tick stamps lastTickAt (got " +
      JSON.stringify([finOpen7.blockers, gate7.failing]).slice(0, 300) + ")");
    const rec7 = await b5Call("spec_finish", { projectDir: d7, name: "suite", evidence: [
      { name: "test", command: okCmd, exitCode: 0, summary: "3 passing" },
      { name: "lint", command: "npm run lint", exitCode: 1, summary: "2 problems", commit: "ABC1234", dirty: true }] });
    const fc7 = b5State(f7).finishChecks;
    ok(rec7.ok && JSON.stringify(rec7.recordedChecks) === JSON.stringify([{ name: "test", exitCode: 0 }, { name: "lint", exitCode: 1 }]) &&
      rec7.suiteChecks.find((c) => c.name === "test").status === "pass" && rec7.suiteChecks.find((c) => c.name === "lint").status === "failed" &&
      rec7.blockers.some((b) => /: lint \(latest run failed \(exit 1\)\)/.test(b)) && !rec7.blockers.some((b) => /test \(/.test(b)) &&
      fc7.test.exitCode === 0 && fc7.test.check === okCmd && typeof fc7.test.at === "string" && fc7.lint.commit === "abc1234" && fc7.lint.dirty === true && fc7.lint.history.length === 1 &&
      /## Project checks\n- test: `node -e "process\.exit\(0\)"` → exit 0 · 3 passing\n- lint: `npm run lint` → exit 1 · 2 problems · @abc1234-dirty \(latest run failed \(exit 1\)\)/.test(rec7.mergeSummary),
      "B5 spec_finish {evidence}: records each check's run in finishChecks (stamped with its meta.checks command, commit/dirty kept) BEFORE the readiness — a failed one stays a blocker; the merge summary lists the project checks (got " +
      JSON.stringify([rec7.blockers, rec7.suiteChecks]).slice(0, 400) + ")");
    const badEv7 = await b5Call("spec_finish", { projectDir: d7, name: "suite", evidence: [{ name: "lint", command: "npm run lint", exitCode: 0 }, { name: "e2e", command: "x", exitCode: 0 }] });
    const noExit7 = S.finishFeature(d7, f7.slug, { evidence: [{ name: "lint", command: "npm run lint" }] });
    const noCmd7 = S.finishFeature(d7, f7.slug, { evidence: [{ name: "lint", exitCode: 0 }] });
    const notList7 = S.finishFeature(d7, f7.slug, { evidence: { name: "lint" } });
    const noChecks7 = await b5Call("spec_finish", { projectDir: d1, name: "red-green", evidence: [{ name: "test", command: "x", exitCode: 0 }] });
    const plain1 = S.finishFeature(d1, f1.slug);
    ok(badEv7.ok === false && /evidence\[1\]: 'e2e' is not a project check — one of: test, lint/.test(badEv7.error) && b5State(f7).finishChecks.lint.exitCode === 1 &&
      noExit7.ok === false && /evidence\[0\]: its exit code/.test(noExit7.error) && noCmd7.ok === false && /the command that ran is required/.test(noCmd7.error) &&
      notList7.ok === false && /evidence must be a list/.test(notList7.error) && noChecks7.ok === false && /no project checks configured \(roadmap\.json meta\.checks\)/.test(noChecks7.error) &&
      !plain1.suiteChecks && !plain1.blockers.some((b) => /project checks/.test(b)),
      "B5 spec_finish {evidence} is all-or-nothing (an unknown check name, a missing exit code or command: nothing recorded); needs meta.checks; without meta.checks nothing changes");
    const fix7 = await b5Call("spec_finish", { projectDir: d7, name: "suite", evidence: [{ name: "lint", command: "npm run lint", exitCode: 0, summary: "clean" }] });
    const gate7b = S.approvePhase(d7, f7.slug, "execution", "t");
    const docOk7 = S.specDoctor(d7, f7.slug).checks.find((c) => c.id === "suite-evidence");
    b5Tick();
    fs.appendFileSync(path.join(f7.dir, "tasks.md"), "- [ ] 2. [US1] One more\n");
    S.completeTask(d7, f7.slug, 2);
    const late7 = S.finishFeature(d7, f7.slug);
    await b5Call("spec_init", { projectDir: d7, checks: { lint: "npm run lint -- --max-warnings 0" } });
    const chg7 = S.finishFeature(d7, f7.slug);
    ok(fix7.ok && fix7.suiteChecks.every((c) => c.status === "pass") && !fix7.blockers.some((b) => /project checks/.test(b)) && !(gate7b.failing || []).includes("suite-evidence") &&
      docOk7.status === "pass" && late7.suiteChecks.every((c) => c.status === "before-last-tick") && late7.blockers.some((b) => /test \(ran before the last task activity\)/.test(b)) &&
      chg7.suiteChecks.find((c) => c.name === "lint").status === "changed" && chg7.blockers.some((b) => /lint \(its command changed since the run\)/.test(b)),
      "B5 suite-evidence clears once every check passed since the last task activity (doctor pass, the execution gate no longer names it); a later tick makes the runs 'before-last-tick', an edited meta.checks command makes its run 'changed' (got " +
      JSON.stringify([late7.suiteChecks, chg7.suiteChecks]).slice(0, 300) + ")");
    const fPt7 = S.createFeature(d7, "Suite Pt", ["core"], "", undefined, "pt");
    const fEs7 = S.createFeature(d7, "Suite Es", ["core"], "", undefined, "es");
    const st7x = b5State(f7);
    st7x.finishChecks = [];
    fs.writeFileSync(path.join(f7.dir, ".state.json"), JSON.stringify(st7x));
    const shape7 = S.finishFeature(d7, f7.slug, { evidence: [{ name: "test", command: okCmd, exitCode: 0 }] });
    ok(S.finishFeature(d7, fPt7.slug).blockers.some((b) => /verificações do projeto sem uma execução bem-sucedida desde a última atividade nas tarefas: test \(nenhuma execução registada\)/.test(b)) &&
      S.finishFeature(d7, fEs7.slug).blockers.some((b) => /verificaciones del proyecto sin una ejecución correcta desde la última actividad en las tareas: test \(ninguna ejecución registrada\)/.test(b)) &&
      shape7.ok === false && /'finishChecks' must be an object/.test(shape7.error),
      "B5 the suite-evidence blocker is localized (PT/ES); a .state.json whose finishChecks is not an object is refused, never repaired");

    // --- B5.2 the brief's definition of done names the project checks; none configured → no line, no field.
    const br7 = await b5Call("spec_task_brief", { projectDir: d7, name: "suite", number: 1 });
    ok(JSON.stringify(br7.projectChecks) === JSON.stringify([{ name: "test", command: okCmd }, { name: "lint", command: "npm run lint -- --max-warnings 0" }]) &&
      /\n\d+\. Run the project checks and put each command, its exit code and the last lines of its output in the report — nothing that passed before this task may fail after it: `node -e "process\.exit\(0\)"` \(test\) · `npm run lint -- --max-warnings 0` \(lint\)\./.test(br7.brief) &&
      !br2.projectChecks && !/Run the project checks/.test(br2.brief) && /Corre as verificações do projeto/.test(S.taskBrief(d7, fPt7.slug, 1).brief || ""),
      "B5 brief: the definition of done lists meta.checks (projectChecks in the result; PT); a project without checks gets neither");

    // --- B5.3 evidence carries the git commit (+ dirty) — `done --run` fills it; a malformed value is dropped, never an error.
    const d8 = b5Dir("git");
    S.initProject(d8, ["core"], "en");
    const f8 = S.createFeature(d8, "Gitev", ["core"], "", undefined, "en");
    b5Tasks(f8, "- [ ] 1. [US1] A\n  - _Verify: node a.js_\n- [ ] 2. [US1] B\n  - _Verify: node b.js_\n- [ ] 3. [US1] C\n  - _Verify: node c.js_\n");
    await b5Call("spec_complete_task", { projectDir: d8, name: "gitev", number: 1, evidence: { command: "node a.js", exitCode: 0, commit: "ABCDEF1", dirty: true } });
    S.completeTask(d8, f8.slug, 2, { command: "node b.js", exitCode: 0, commit: "not-a-sha", dirty: true });
    S.completeTask(d8, f8.slug, 3, { command: "node c.js", exitCode: 0, dirty: false });
    const ev8 = b5State(f8).evidence;
    const sum8 = S.finishFeature(d8, f8.slug).mergeSummary;
    ok(ev8["1"].commit === "abcdef1" && ev8["1"].dirty === true && ev8["1"].history[0].commit === "abcdef1" && !("commit" in ev8["2"]) && !("dirty" in ev8["2"]) && !("dirty" in ev8["3"]) &&
      /1\. A — `node a\.js` → exit 0 · @abcdef1-dirty/.test(sum8) && /2\. B — `node b\.js` → exit 0\n/.test(sum8),
      "B5 evidence keeps a well-formed commit (lowercased) and dirty (only with a commit) in the run and its history; a malformed one is dropped; the merge summary tags the task's run @sha-dirty");

    // --- B5.3 parseGitLog: git's medium format (--name-only, --name-status, decorations) and --oneline.
    const H = (c) => c.repeat(40);
    const medium = ["commit " + H("c") + " (HEAD -> main)", "Author: T <t@t>", "Date:   2026-09-03T10:00:00+01:00", "", "    feat(login): implement", "    ", "    Part of .specs/login/ task #2.", "", "src/login.js", "M\tsrc/util.js", "R100\told.js\ttests/new.test.js", "",
      "commit " + H("b"), "Merge: 1111111 2222222", "Author: T <t@t>", "Date:   2026-09-02T10:00:00+01:00", "", "    merge it", ""].join("\n");
    const pg = S.parseGitLog(medium);
    const po = S.parseGitLog("abc1234 feat(login): x — task #2\ndef5678 fix: y\n\n");
    ok(pg.length === 2 && pg[0].short === "ccccccc" && pg[0].subject === "feat(login): implement" && /Part of \.specs\/login\/ task #2\./.test(pg[0].message) && pg[0].date === "2026-09-03T10:00:00+01:00" &&
      JSON.stringify(pg[0].files) === JSON.stringify(["src/login.js", "src/util.js", "tests/new.test.js"]) && pg[1].subject === "merge it" && !pg[1].files.length &&
      po.length === 2 && po[0].short === "abc1234" && po[0].subject === "feat(login): x — task #2" && !po[0].files.length && S.parseGitLog("").length === 0,
      "B5 parseGitLog reads git log's medium format (message, date, --name-only and --name-status paths, renames, decorations, merges) and --oneline lines");

    // --- B5.3 taskCommits: the conventions (feature name + task #N; T-/AC IDs unless another feature is named) and the +tdd red-first check.
    const d9 = b5Dir("log");
    S.initProject(d9, ["tdd"], "en");
    const f9 = S.createFeature(d9, "Login", ["tdd"], "", undefined, "en");
    S.createFeature(d9, "Billing", ["core"], "", undefined, "en");
    b5Tasks(f9, "- [ ] 1. [US1] Write test T-01 and watch it fail\n  - _Requirements: US-1.AC-1_\n  - _Expect: fail_\n" +
      "- [ ] 2. [US1] Implement the check\n  - _Requirements: US-1.AC-1_\n  - _Makes green: T-01_\n- [ ] 3. [US1] Clean up\n- [ ] 4. [US1] Later\n  - _Makes green: T-09_\n");
    fs.mkdirSync(path.join(d9, "tests"), { recursive: true });
    fs.writeFileSync(path.join(d9, "tests", "login.test.js"), "test(\"T-01 rejects an expired token\", () => {});\n");
    const commit9 = (h, date, lines, files) => ["commit " + H(h), "Author: T <t@t>", "Date:   " + date, "", ...lines.map((l) => "    " + l), "", ...files, ""];
    const implFirstLog = [
      ...commit9("d", "2026-09-04", ["test(login): add T-01 regression"], ["tests/login.test.js"]),
      ...commit9("c", "2026-09-03", ["feat(login): implement the check", "", "Part of .specs/login/ task #2.", "Makes T-01 green."], ["src/login.js"]),
      ...commit9("b", "2026-09-02", ["docs(billing): task #2 and T-01 there"], ["docs/billing.md"]),
      ...commit9("a", "2026-09-01", ["chore: scaffold US-1.AC-1", "fix: task 3 cleanup"], ["README.md"]),
    ].join("\n");
    const tc9 = S.taskCommits(d9, "login", implFirstLog);
    const byTask = (r, n) => r.tasks.find((t) => t.number === n);
    const rf2 = tc9.redFirst.find((r) => r.task === 2);
    const rf4 = tc9.redFirst.find((r) => r.task === 4);
    ok(tc9.ok && tc9.commits === 4 && tc9.citing === 3 && JSON.stringify(byTask(tc9, 1).commits.map((c) => c.short + ":" + c.via.join("+"))) === JSON.stringify(["ddddddd:T-01", "ccccccc:T-01", "aaaaaaa:US-1.AC-1"]) &&
      JSON.stringify(byTask(tc9, 2).commits.map((c) => c.short + ":" + c.via.join("+"))) === JSON.stringify(["ddddddd:T-01", "ccccccc:#2+T-01", "aaaaaaa:US-1.AC-1"]) &&
      !byTask(tc9, 3).commits.length && rf2.status === "impl-first" && rf2.taskCommit.short === "ccccccc" && rf2.testCommit.short === "ddddddd" && JSON.stringify(rf2.testFiles) === JSON.stringify(["tests/login.test.js"]) &&
      rf4.status === "no-test-file" && tc9.warnings.length === 1 && /red-first: task 2 \(makes T-01 green\) was first committed in ccccccc, before any commit touching a test file that names T-01 \(tests\/login\.test\.js — first in ddddddd\)/.test(tc9.warnings[0]) &&
      tc9.lines.some((l) => /\[ \] #3 Clean up — no commit cites it/.test(l)) && tc9.lines.some((l) => /▲ red-first: task 2/.test(l)),
      "B5 taskCommits: a commit cites a task by 'task #N' with the feature name, or by the T-/AC IDs it names — never when it names another feature ('billing'), and 'task 3' without the feature name is no citation; red-first warns when the implementation was committed before its test (got " +
      JSON.stringify([tc9.tasks.map((t) => t.commits.map((c) => c.short + ":" + c.via.join("+"))), tc9.redFirst.map((r) => r.status)]).slice(0, 400) + ")");
    const testFirstLog = [
      ...commit9("f", "2026-09-06", ["feat(login): implement — task #2"], ["src/login.js"]),
      ...commit9("e", "2026-09-05", ["test(login): T-01 fails for the right reason"], ["tests/login.test.js"]),
    ].join("\n");
    const noTestLog = commit9("f", "2026-09-06", ["feat(login): implement — task #2"], ["src/login.js"]).join("\n");
    const tcOk = S.taskCommits(d9, "login", testFirstLog);
    const tcNever = S.taskCommits(d9, "login", noTestLog);
    const tcWin = S.taskCommits(d9, "login", noTestLog, { max: 1 });
    const tcNone = S.taskCommits(d9, "login", commit9("a", "2026-09-01", ["chore: unrelated"], ["x.txt"]).join("\n"));
    const fPt9 = S.createFeature(d9, "Entrar", ["tdd"], "", undefined, "pt");
    b5Tasks(fPt9, "- [ ] 1. [US1] Implementar\n  - _Makes green: T-01_\n");
    const tcPt = S.taskCommits(d9, "entrar", "abc1234 feat(entrar): tarefa 1\n");
    ok(tcOk.redFirst.find((r) => r.task === 2).status === "ok" && !tcOk.warnings.length && tcOk.lines.some((l) => /red-first: task 2 \(T-01\) — the test was committed first ✓/.test(l)) &&
      tcNever.redFirst.find((r) => r.task === 2).status === "test-not-committed" && /no commit read touches a test file that names T-01 \(tests\/login\.test\.js\) — commit the test first/.test(tcNever.warnings[0]) &&
      tcWin.truncated === true && tcWin.redFirst.find((r) => r.task === 2).status === "outside-window" && !tcWin.warnings.length && /the window is full/.test(tcWin.lines[0]) &&
      tcNone.citing === 0 && tcNone.lines.some((l) => /No commit cites a task of 'login'\. Conventions: .*"Part of \.specs\/login\/ task #N\."/.test(l)) &&
      tcPt.ok && tcPt.tasks[0].commits.length === 1 && tcPt.tasks[0].commits[0].via[0] === "#1" && /^Commits: entrar — 1 commit\(s\) lido\(s\), 1 citam as suas tarefas/.test(tcPt.lines[0]) &&
      S.taskCommits(d9, "nope", "").ok === false,
      "B5 taskCommits red-first: the test committed first is ok; no commit touching it warns; a full log window makes the order unknown (outside-window, no warning); no citing commit prints the conventions; PT lines ('tarefa N'); an unknown feature is an error");
  }

  // 1.14 full review (Ga) — evidence, project checks, CLI runs.
  {
    const ga = (n) => path.join(tmp, "full-review-ga-" + n);
    const gaW = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
    const gaState = (f) => JSON.parse(fs.readFileSync(path.join(f.dir, ".state.json"), "utf8"));
    const gaSetState = (f, st) => fs.writeFileSync(path.join(f.dir, ".state.json"), JSON.stringify(st, null, 2));
    const gaTasks = (f) => fs.readFileSync(path.join(f.dir, "tasks.md"), "utf8");
    const suiteOf = (r) => (r.suiteChecks || []).map((c) => c.status).join();
    const PASS = 'node -e "process.exit(0)"';
    // A written core feature the gates accept (approved through tasks) — the chain next_action walks to its finish step.
    const GA_CLASS = "# Classification: x\n\n## Mode\nSpec\n\n## Active Tracks\ncore\n\n## Signals\n- none, plain feature\n\n## Blast Radius\nLow; only the login page.\n\n## Compliance Tags\nnone\n";
    const GA_REQ = "# Feature: x\n\n## Summary\nUsers log in with email and password.\n\n## User Stories (prioritized — each independently testable)\n\n### US-1 (P1 — MVP): Log in\n" +
      "**As a** user, **I want** to log in, **so that** I see my account.\n**Why P1:** nothing works without it.\n**Independent Test:** Can be fully tested by logging in and delivers access, without the other stories.\n\n" +
      "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the user submits valid credentials THE SYSTEM SHALL open a session\n2. **US-1.AC-2** — IF the credentials are wrong THEN THE SYSTEM SHALL show an error\n\n" +
      "## Success Criteria (measurable, technology-agnostic)\n- **SC-001** — 95% of logins complete in under 2 seconds\n\n## Edge Cases & Error Handling\n- **EC-1** — Locked account: show the lock message\n\n" +
      "## Non-Functional Requirements\n- **NFR-1** — p95 latency under 300 ms\n\n## Out of Scope\n- Social login\n\n## Assumptions\n- Users already have accounts\n";
    const GA_DESIGN = "# Design: x\n\n## Overview\nA form posts to /login; the server checks the hash.\n\n## Architecture\nThe web app calls the auth service.\n\n## Data Models\nUser { id, email, hash }\n\n" +
      "## API Contracts\nPOST /login returns 200 or 401.\n\n## Security Considerations\nHashes use bcrypt.\n\n## Error Handling\nWrong credentials give 401.\n\n## Testing Strategy\n- Unit tests for the handler.\n\n" +
      "## Constitution Check\n- [x] Simplicity — complies\n\n## Complexity Tracking\nNone.\n";
    const gaFilled = (dir, name, tasks) => {
      const f = S.createFeature(dir, name, ["core"], "", undefined, "en");
      gaW(f.dir, "classification.md", GA_CLASS); gaW(f.dir, "requirements.md", GA_REQ); gaW(f.dir, "design.md", GA_DESIGN); gaW(f.dir, "tasks.md", tasks);
      S.approvePhase(dir, f.slug, null, "u", { through: "tasks" });
      return f;
    };

    // Ga2: a failing run whose output shows the test never ran (node --test on a missing file, a missing module / script, no
    // test collected) is no red run — spec_complete_task refuses it (recorded, couldNotRun: "output"); an assertion failure
    // stays the red proof; a record made before (a ticked task) no longer counts as one.
    const cnr = (s) => (S.couldNotRunOutput(s) || {}).kind || null;
    const cnrPos = ["Could not find '/app/test/uppercase.test.js'", "Error: Cannot find module '../src/upper'", "python3: can't open file '/app/t.py': [Errno 2] No such file or directory",
      "ModuleNotFoundError: No module named 'upper'", "ERROR: file or directory not found: tests/test_x.py", "============ no tests ran in 0.01s ============",
      "No tests found, exiting with code 1", "No test files found, exiting with code 1", 'npm error Missing script: "test"', "make: *** No rule to make target 'test'.  Stop.", "npm ERR! code ENOENT"];
    const cnrNeg = ["AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:\n'a' !== 'A'", "✖ T-01 fails: 302 back to /login", "FAILED tests/test_x.py::test_upper - assert 'a' == 'A'", "Tests: 1 failed, 3 passed", ""];
    const wslOut = "<3>WSL (10 - Relay) ERROR: CreateProcessCommon:818: execvpe(/bin/bash) failed: No such file or directory";
    ok(cnrPos.every((s) => cnr(s) === "test") && cnrNeg.every((s) => cnr(s) === null) && cnr(wslOut) === "wsl" && cnr(wslOut.split("").join(String.fromCharCode(0))) === "wsl" &&
      cnr("spawnSync no-such-shell-xyz ENOENT") === "spawn",
      "full review Ga2: couldNotRunOutput recognises a run that never exercised its test (missing file / module / script, nothing collected; the WSL relay, also as UTF-16; a spawn error) and never an assertion failure (got " +
      JSON.stringify([cnrPos.filter((s) => cnr(s) !== "test"), cnrNeg.filter((s) => cnr(s) !== null)]) + ")");
    const p2 = ga("red");
    S.initProject(p2, ["core"], "en");
    const f2 = S.createFeature(p2, "Red missing", ["core"], "", undefined, "en");
    gaW(f2.dir, "tasks.md", "- [ ] 1. [US1] Write test T-01 and watch it fail\n  - _Verify: node --test test/uppercase.test.js_\n  - _Expect: fail_\n");
    const RED_CMD = "node --test test/uppercase.test.js";
    const miss2 = S.completeTask(p2, f2.slug, 1, { command: RED_CMD, exitCode: 1, summary: "Could not find 'test/uppercase.test.js'" });
    const open2 = /- \[ \] 1\./.test(gaTasks(f2));
    const red2 = S.completeTask(p2, f2.slug, 1, { command: RED_CMD, exitCode: 1, summary: "✖ uppercases (1.2ms)\nAssertionError [ERR_ASSERTION]: 'a' !== 'A'\nℹ fail 1" });
    const f2b = S.createFeature(p2, "Red legacy", ["core"], "", undefined, "en");
    gaW(f2b.dir, "tasks.md", "- [x] 1. [US1] Write test T-01 and watch it fail\n  - _Verify: node -e \"process.exit(0)\"_\n  - _Expect: fail_\n");
    const st2b = gaState(f2b);
    st2b.evidence = { 1: { command: 'node -e "process.exit(0)"', exitCode: 1, summary: "spawnSync no-such-shell-xyz ENOENT", expected: "fail", at: new Date().toISOString() } }; // what `done --run --shell <missing>` used to record
    gaSetState(f2b, st2b);
    const vs2b = S.verificationStatus(p2, f2b.slug, f2b.dir);
    const fPt2 = S.createFeature(p2, "Vermelho", ["core"], "", undefined, "pt");
    gaW(fPt2.dir, "tasks.md", "- [ ] 1. [US1] Escrever T-01\n  - _Verify: npm test_\n  - _Expect: fail_\n");
    const pt2 = S.completeTask(p2, fPt2.slug, 1, { command: "npm test", exitCode: 1, summary: 'npm error Missing script: "test"' });
    ok(miss2.ok === false && miss2.recorded === true && miss2.couldNotRun === "output" && miss2.expected === "fail" && open2 &&
      /the run exited 1, but its output shows the test never ran \(Could not find 'test\/uppercase\.test\.js'\) — that is no red test/.test(miss2.error) &&
      red2.ok === true && red2.redRecorded === true && red2.verified === true && /- \[x\] 1\./.test(gaTasks(f2)) &&
      vs2b.unverifiedDetail.some((d) => d.number === 1 && d.reason === "failed-run") &&
      pt2.ok === false && pt2.couldNotRun === "output" && /o output mostra que o teste nunca foi executado \(Missing script: "test"\)/.test(pt2.error),
      "full review Ga2: an _Expect: fail_ run whose summary shows the test never ran is refused (recorded, couldNotRun: output, task open; PT); an assertion failure is the red proof; an old 'spawnSync … ENOENT' record proves nothing (got " +
      JSON.stringify([miss2.couldNotRun, miss2.error && miss2.error.slice(0, 120), red2.redRecorded, vs2b.unverifiedDetail, pt2.error && pt2.error.slice(0, 80)]) + ")");

    // Ga3: a project check run is stamped with the code it tested (a hash of the implementing files): code edited after the
    // run → suiteChecks status `code-changed` — a finish blocker, doctor's suite-evidence warn and the stop gate's suite line —
    // never "ready" on an old run. A run recorded without the stamp keeps the older rule.
    const p3 = ga("code");
    S.initProject(p3, ["core"], "en", { checks: { test: PASS } });
    const f3 = S.createFeature(p3, "Limiter", ["core"], "", undefined, "en");
    gaW(p3, "src/limiter.js", "module.exports = 1;\n");
    gaW(f3.dir, "tasks.md", "- [ ] 1. [US1] Limit\n  - _Implements: src/limiter.js_\n");
    S.completeTask(p3, f3.slug, 1);
    const fin3a = S.finishFeature(p3, f3.slug, { evidence: [{ name: "test", command: PASS, exitCode: 0 }] });
    const stamp3 = gaState(f3).finishChecks.test.code;
    gaW(p3, "src/limiter.js", "module.exports = 2; // edited after the check ran\n");
    const fin3b = S.finishFeature(p3, f3.slug, {});
    const doc3 = S.specDoctor(p3, f3.slug).checks.find((c) => c.id === "suite-evidence");
    const stop3 = S.stopCheck(p3, { message: "All done." });
    const st3 = gaState(f3);
    delete st3.finishChecks.test.code; // a run recorded before 1.14's full review
    gaSetState(f3, st3);
    const fin3c = S.finishFeature(p3, f3.slug, {});
    ok(/^[0-9a-f]{40}$/.test(stamp3 || "") && suiteOf(fin3a) === "pass" && suiteOf(fin3b) === "code-changed" &&
      fin3b.blockers.some((b) => /test \(the implementing files changed since the run\)/.test(b)) && doc3 && doc3.status === "warn" && /implementing files changed since the run/.test(doc3.detail) &&
      stop3.block === true && stop3.features.some((x) => x.suite.some((s) => s.status === "code-changed")) && suiteOf(fin3c) === "pass",
      "full review Ga3: a check run stamped with the implementing files' hash turns code-changed once src/limiter.js is edited (finish blocker, doctor warn, stop gate); an unstamped run keeps the older rule (got " +
      JSON.stringify([stamp3, suiteOf(fin3a), suiteOf(fin3b), doc3 && doc3.status, stop3.why, suiteOf(fin3c)]) + ")");

    // Ga4: a task-activity stamp in the future (a .state.json committed from a machine with a fast clock) is ignored, as the
    // stop gate ignores it — a fresh check run is not "before the last task activity".
    const p4 = ga("future");
    S.initProject(p4, ["core"], "en", { checks: { test: PASS } });
    const f4 = S.createFeature(p4, "Clock", ["core"], "", undefined, "en");
    gaW(f4.dir, "tasks.md", "- [x] 1. [US1] Done\n");
    const st4 = gaState(f4);
    st4.lastTickAt = "2099-01-01T00:00:00.000Z";
    gaSetState(f4, st4);
    const fin4 = S.finishFeature(p4, f4.slug, { evidence: [{ name: "test", command: PASS, exitCode: 0 }] });
    ok(suiteOf(fin4) === "pass" && !fin4.blockers.some((b) => /ran before the last task activity/.test(b)),
      "full review Ga4: a lastTickAt in the future is ignored — a check run recorded now passes (got " + JSON.stringify([suiteOf(fin4), fin4.blockers]) + ")");

    // Ga5: the spec-implementer gate reads the exit code its report shows: a must-pass _Verify:_ needs an exit 0 (a red then
    // green report passes), an _Expect: fail_ one a non-zero exit.
    const p5 = ga("impl");
    S.initProject(p5, ["core"], "en");
    const f5 = S.createFeature(p5, "Impl", ["core"], "", undefined, "en");
    gaW(f5.dir, "tasks.md", "- [ ] 1. [US1] Must pass\n  - _Verify: npm test_\n- [ ] 2. [US1] Write T-01 red\n  - _Verify: npm test_\n  - _Expect: fail_\n");
    const rep5 = (n, body) => gaW(f5.dir, ".execution/task-" + n + "-report.md", body);
    const stop5 = (n) => S.stopCheck(p5, { message: "Status: DONE — implemented. Report: .specs/" + f5.slug + "/.execution/task-" + n + "-report.md", agent: "dev-spec-driven:spec-implementer" });
    rep5(1, "# Task 1\n\n$ npm test\nexit code: 1\n1 failing\n");
    const i1 = stop5(1);
    rep5(1, "# Task 1\n\nRED: `npm test` → exit code: 1\nGREEN: `npm test` → exit 0\n");
    const i1b = stop5(1);
    rep5(2, "# Task 2\n\n`npm test` → exit 0\n");
    const i2 = stop5(2);
    rep5(2, "# Task 2\n\n`npm test` → exit code: 1 (AssertionError: expected 'A')\n");
    const i2b = stop5(2);
    ok(i1.block === true && i1.why === "implementer-evidence" && /shows no passing run \(exit 0\) of `npm test`/.test(i1.reason) && i1b.block === false && i1b.why === "report-ok" &&
      i2.block === true && /shows no failing run \(a non-zero exit code\) of `npm test` — the task is marked _Expect: fail_/.test(i2.reason) && i2b.block === false && i2b.why === "report-ok",
      "full review Ga5: a DONE report of a must-pass task showing only 'exit code: 1' is sent back (red + green passes); an _Expect: fail_ task's report needs its non-zero exit (got " +
      JSON.stringify([i1.why, i1b.why, i2.why, i2b.why]) + ")");

    // Ga6: spec_append_tasks takes makesGreen (planned T-IDs, stored as test-plan.md spells them), expectFail and size —
    // validated all-or-nothing like the AC IDs; the MCP schema advertises them.
    const p6 = ga("append");
    S.initProject(p6, ["tdd"], "en");
    const f6 = S.createFeature(p6, "Converge", ["tdd"], "", undefined, "en");
    const apTool6 = list.result.tools.find((t) => t.name === "spec_append_tasks");
    const props6 = apTool6.inputSchema.properties.tasks.items.properties;
    const call6 = async (args) => { const r = await rpc("tools/call", { name: "spec_append_tasks", arguments: { projectDir: p6, name: f6.slug, ...args } }); let p; try { p = payload(r); } catch { p = { error: r.result.content[0].text }; } return { isError: r.result.isError === true, p }; };
    const before6 = gaTasks(f6);
    const bad6a = await call6({ tasks: [{ text: "ok", makesGreen: ["T-01"] }, { text: "phantom", makesGreen: ["T-99"] }] });
    const bad6b = await call6({ tasks: [{ text: "big", size: "XXL" }] });
    const bad6c = await call6({ tasks: [{ text: "x", expectFail: "yes" }] });
    const bad6d = await call6({ tasks: [{ text: "x", makesGreen: ["test one"] }] });
    const same6 = gaTasks(f6) === before6;
    const ap6 = await call6({ tasks: [{ text: "Write the regression test", requirements: ["US-1.AC-1"], makesGreen: ["t-1"], expectFail: true, size: "s", verify: "npm test" }] });
    const blk6 = S.taskBlocks(gaTasks(f6)).find((b) => ap6.p.appended && b.number === ap6.p.appended[0].number);
    const noPlan = S.appendTasks(p2, f2.slug, [{ text: "x", makesGreen: ["T-01"] }]);
    ok(props6.makesGreen && props6.makesGreen.type === "array" && props6.expectFail && props6.expectFail.type === "boolean" && props6.size && props6.size.type === "string" &&
      bad6a.p.ok === false && /Unknown tests \(not planned in test-plan\.md\): T-99/.test(bad6a.p.error) && bad6b.p.ok === false && /size must be one of XS, S, M, L, XL \(got 'XXL'\)/.test(bad6b.p.error) &&
      bad6c.isError && bad6d.p.ok === false && /makesGreen takes planned test IDs/.test(bad6d.p.error) && same6 &&
      ap6.p.ok === true && JSON.stringify(ap6.p.appended[0].makesGreen) === '["T-01"]' && ap6.p.appended[0].expectFail === true && ap6.p.appended[0].size === "S" &&
      blk6 && JSON.stringify(blk6.body.map((l) => l.replace(/^- /, ""))) === JSON.stringify(["_Requirements: US-1.AC-1_", "_Makes green: T-01_", "_Verify: npm test_", "_Expect: fail_", "_Size: S_"]) &&
      S.expectsFail(blk6) && S.traceCheck(p6, f6.slug).phantomTestsInTasks.length === 0 &&
      noPlan.ok === false && /makesGreen needs a test plan/.test(noPlan.error),
      "full review Ga6: spec_append_tasks writes _Makes green:_ (as the test plan spells the T-ID) / _Expect: fail_ / _Size:_; an unplanned T-ID, a bad size or T-ID, a non-boolean expectFail or no test plan writes nothing (got " +
      JSON.stringify([ap6.p.appended || ap6.p.error, blk6 && blk6.body, bad6a.p.error, bad6b.p.error]).slice(0, 500) + ")");

    // Ga7: the brief of an _Expect: fail_ task is a red task's — its tests section and definition of done say write the test and
    // watch it FAIL (no production code), never "make the target tests green" / "nothing that passed before may fail".
    const p7 = ga("brief");
    S.initProject(p7, ["tdd"], "en", { checks: { test: "npm test" } });
    const f7 = S.createFeature(p7, "Brief red", ["tdd"], "", undefined, "en");
    gaW(f7.dir, "tasks.md", "- [ ] 1. [US1] Write T-01 red\n  - _Requirements: US-1.AC-1_\n  - _Makes green: T-01_\n  - _Verify: npm test_\n  - _Expect: fail_\n" +
      "- [ ] 2. [US1] Make T-01 green\n  - _Requirements: US-1.AC-1_\n  - _Makes green: T-01_\n  - _Verify: npm test_\n");
    const br7 = S.taskBrief(p7, f7.slug, 1).brief;
    const br7g = S.taskBrief(p7, f7.slug, 2).brief;
    const f7pt = S.createFeature(p7, "Brief vermelho", ["tdd"], "", undefined, "pt");
    gaW(f7pt.dir, "tasks.md", "- [ ] 1. [US1] Escrever T-01\n  - _Makes green: T-01_\n  - _Verify: npm test_\n  - _Expect: fail_\n");
    const br7pt = S.taskBrief(p7, f7pt.slug, 1).brief;
    ok(/## Tests this task writes — they must FAIL first \(red\)/.test(br7) && !/## Tests to make green/.test(br7) && /\n1\. This is a RED task: write \(or keep\) the planned test\(s\)/.test(br7) &&
      !/turns the target tests green/.test(br7) && !/nothing that passed before this task may fail/.test(br7) && /the only failures allowed are this task's new red test\(s\)/.test(br7) &&
      /## Tests to make green/.test(br7g) && /turns the target tests green/.test(br7g) && /nothing that passed before this task may fail/.test(br7g) &&
      /## Testes que esta tarefa escreve — têm de FALHAR primeiro \(vermelho\)/.test(br7pt) && /\n1\. Esta é uma tarefa VERMELHA/.test(br7pt),
      "full review Ga7: an _Expect: fail_ task's brief: 'Tests this task writes — they must FAIL first', a red definition of done, the project checks allow its red test (PT too); a green task's brief is unchanged (got " +
      JSON.stringify(br7.split("\n").filter((l) => /^## |^\d+\. /.test(l)).slice(-8)).slice(0, 400) + ")");

    // Ga8: with meta.checks set, next_action's finish step says how to run and record them; the merge summary labels an
    // _Expect: fail_ task's red run as the expected one (and, after the fix passes, the red run it keeps).
    const p8 = ga("finish");
    S.initProject(p8, ["core"], "en", { checks: { test: PASS } });
    const f8 = gaFilled(p8, "Login", "# Tasks\n\n## Story US-1 (P1 — MVP)\n- [ ] 1. [US1] Implement the login handler (EC-1, NFR-1)\n  - _Requirements: US-1.AC-1_\n  - _Verify: " + PASS + "_\n" +
      "- [ ] 2. [US1] Show the error message\n  - _Requirements: US-1.AC-2_\n  - _Verify: " + PASS + "_\n**Checkpoint:** US-1 works.\n");
    S.completeTask(p8, f8.slug, 1, { command: PASS, exitCode: 0 });
    S.completeTask(p8, f8.slug, 2, { command: PASS, exitCode: 0 });
    const na8 = S.nextAction(p8, f8.slug);
    const sum8a = S.finishFeature(p2, f2.slug, {}).mergeSummary || "";
    S.completeTask(p2, f2.slug, 1, { command: RED_CMD, exitCode: 0, summary: "ℹ pass 1" }); // the fix is in: the test passes now
    const sum8b = S.finishFeature(p2, f2.slug, {}).mergeSummary || "";
    ok(na8.step === "finish" && new RegExp("dev-spec finish " + f8.slug + " --run runs and records them").test(na8.recommendation) && /spec_finish \{evidence: \[/.test(na8.recommendation) &&
      /1\. Write test T-01 and watch it fail — `node --test test\/uppercase\.test\.js` → exit 1 \(the expected red run \(_Expect: fail_\)\)/.test(sum8a) &&
      /`node --test test\/uppercase\.test\.js` → exit 0 \(red run before the fix: exit 1 on \d{4}-\d{2}-\d{2}\)/.test(sum8b),
      "full review Ga8: next_action's finish step names dev-spec finish --run / spec_finish {evidence} when project checks are configured; the merge summary marks the expected red run (and the red run kept after the fix) (got " +
      JSON.stringify([na8.step, na8.recommendation.slice(-260), (sum8a.match(/.*uppercase.*/) || [""])[0], (sum8b.match(/.*uppercase.*/) || [""])[0]]) + ")");

    // Ga9: the shell done --run / finish --run use — a bare bash on Windows is Git Bash (git --exec-path, %ProgramFiles%, a
    // non-WSL bash on PATH), never WSL's System32 / WindowsApps launcher (refused, also as an explicit path); cmd is cmd.exe.
    const BS = String.fromCharCode(92);
    const wp = (...p) => p.join(BS);
    const sys32 = wp("C:", "Windows", "System32"), apps = wp("C:", "Users", "u", "AppData", "Local", "Microsoft", "WindowsApps"), msys = wp("C:", "msys64", "usr", "bin");
    const gitBash = wp("C:", "Program Files", "Git", "bin", "bash.exe");
    const have = (...files) => (p) => files.includes(p);
    const envW = (dirs, extra) => ({ PATH: dirs.join(";"), ...(extra || {}) });
    const r9 = {
      git: S.resolveRunShell("bash", { platform: "win32", env: envW([sys32, apps]), gitExecPath: "C:/Program Files/Git/mingw64/libexec/git-core\n", exists: have(gitBash, wp(sys32, "bash.exe")) }),
      wslOnly: S.resolveRunShell("bash", { platform: "win32", env: envW([sys32, apps]), exists: have(wp(sys32, "bash.exe"), wp(apps, "bash.exe")) }),
      msys: S.resolveRunShell("BASH.EXE", { platform: "win32", env: envW([sys32, msys]), exists: have(wp(sys32, "bash.exe"), wp(msys, "bash.exe")) }),
      progFiles: S.resolveRunShell("bash", { platform: "win32", env: { ProgramFiles: wp("C:", "Program Files"), Path: sys32 }, exists: have(gitBash, wp(sys32, "bash.exe")) }),
      sys32Path: S.resolveRunShell(wp(sys32, "bash.exe"), { platform: "win32", env: {} }),
      appsPath: S.resolveRunShell("C:/Users/u/AppData/Local/Microsoft/WindowsApps/bash.exe", { platform: "win32", env: {} }),
      wslExe: S.resolveRunShell(wp(sys32, "wsl.exe"), { platform: "win32", env: {} }),
      def: S.resolveRunShell("", { platform: "win32" }), cmd: S.resolveRunShell("cmd", { platform: "win32" }), comspec: S.resolveRunShell(wp(sys32, "cmd.exe"), { platform: "win32" }),
      pwsh: S.resolveRunShell("pwsh", { platform: "win32" }), linuxBash: S.resolveRunShell("bash", { platform: "linux" }), linuxDef: S.resolveRunShell("", { platform: "linux" }),
    };
    ok(r9.git.shell === gitBash && r9.git.cmd === false && r9.wslOnly.error === "no-git-bash" && r9.msys.shell === wp(msys, "bash.exe") && r9.progFiles.shell === gitBash &&
      // 1.15: an EXPLICIT path to WSL's launcher is the user's choice — used as given, flagged wsl (1.14 refused it)
      r9.sys32Path.shell === wp(sys32, "bash.exe") && r9.sys32Path.wsl === true && r9.appsPath.wsl === true && !r9.sys32Path.error &&
      // wsl.exe is no shell (it rejects -c): refused, named or bare; a quoted path loses its quotes
      r9.wslExe.error === "wsl-exe" && S.resolveRunShell("wsl", { platform: "win32" }).error === "wsl-exe" &&
      S.resolveRunShell('"' + wp(sys32, "bash.exe") + '"', { platform: "win32" }).shell === wp(sys32, "bash.exe") &&
      r9.def.shell === true && r9.def.cmd === true && r9.cmd.cmd === true && r9.comspec.cmd === true && r9.pwsh.shell === "pwsh" && r9.pwsh.cmd === false &&
      r9.linuxBash.shell === "bash" && r9.linuxDef.shell === true && r9.linuxDef.cmd === false && S.isWslLauncher(wp(sys32, "bash.exe")) && !S.isWslLauncher(gitBash),
      "full review Ga9: resolveRunShell — a bare bash on Windows is Git Bash (git --exec-path / %ProgramFiles% / a non-WSL PATH bash), never WSL's launcher (only WSL there → no-git-bash); an explicit WSL path is used as given (wsl: true); cmd / ComSpec is cmd.exe; other platforms keep the shell as given (got " +
      JSON.stringify(r9).slice(0, 500) + ")");
  }

  // 1.14 feature (F1) — harness-observed evidence.
  {
    const obsJs = path.join(__dirname, "..", "hooks", "observe-hook.js");
    const obsCall = async (tool, args) => { const r = await rpc("tools/call", { name: tool, arguments: args }); let p; try { p = payload(r); } catch { p = { error: r.result.content[0].text }; } return { isError: r.result.isError === true, p }; };
    // The runner may itself run inside Claude Code: the hook gets the project it is told about, nothing else.
    const obsHook = (pdir, input) => spawnSync(process.execPath, [obsJs], { input: typeof input === "string" ? input : JSON.stringify(input), encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: pdir, SPEC_PROJECT_DIR: "" } });
    const bash = (cwd, command, extra) => ({ session_id: "s-obs", transcript_path: path.join(cwd, "t.jsonl"), cwd, permission_mode: "default", hook_event_name: "PostToolUse",
      tool_name: "Bash", tool_input: { command, description: "Run it", timeout: 120000, run_in_background: false }, tool_use_id: "toolu_01", ...extra });
    const logOf = (dir) => { try { return fs.readFileSync(path.join(dir, ".execution", "observed.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
    const obsState = (f) => JSON.parse(fs.readFileSync(path.join(f.dir, ".state.json"), "utf8"));
    const quiet = (r) => r.status === 0 && r.stdout === "" && r.stderr === "";
    const pO = path.join(tmp, "ffobs-proj");
    const CHECK = 'node -e "process.exit(0)"';
    S.initProject(pO, ["core"], "en", { checks: { test: CHECK } });
    const fO = S.createFeature(pO, "Auth", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(fO.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Login\n  - _Verify: `node t1.js`_\n- [ ] 2. [US1] Logout\n  - _Verify: node t2.js_\n" +
      "- [ ] 3. [US1] Both\n  - _Verify: node a.js_\n  - _Verify: node b.js_\n- [ ] 4. [US1] Docs\n\n```\n- [ ] 9. fenced\n  - _Verify: node fenced.js_\n```\n");

    // hooks.json: PostToolUse (matcher Bash) and PostToolUseFailure (matcher Bash) run hooks/observe-hook.js, beside spec-hook's entry.
    const hc = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "hooks", "hooks.json"), "utf8")).hooks;
    const obsCmd = 'node "${CLAUDE_PLUGIN_ROOT}/hooks/observe-hook.js"';
    const wired = (ev) => (hc[ev] || []).find((e) => e.matcher === "^(Bash|PowerShell)$" && e.hooks[0].command === obsCmd && e.hooks[0].timeout === 10); // + PowerShell (review R5)
    ok(!!wired("PostToolUse") && !!wired("PostToolUseFailure") && (hc.PostToolUse || []).some((e) => e.matcher === "Write|Edit" && /spec-hook\.js/.test(e.hooks[0].command)) &&
      !fs.readFileSync(obsJs, "utf8").includes(String.fromCharCode(0xfeff)),
      "feature F1: hooks.json runs hooks/observe-hook.js on PostToolUse and PostToolUseFailure (matcher ^(Bash|PowerShell)$, timeout 10) beside spec-hook's Write|Edit entry; no literal BOM in observe-hook.js");

    // Both payload shapes: PostToolUse with exit_code (or none → 0), PostToolUseFailure with `error` ("exit code 3", else 1).
    const h1 = obsHook(pO, bash(pO, "node t1.js", { tool_response: { stdout: "ok", stderr: "", interrupted: false, exit_code: 0 } }));
    const h2 = obsHook(pO, bash(pO, "node  t2.js", { tool_response: { stdout: "", stderr: "", interrupted: false } })); // no exit code: the success event → 0
    const h3 = obsHook(pO, { ...bash(pO, "node t2.js"), hook_event_name: "PostToolUseFailure", error: "Command failed with exit code 3", is_interrupt: false });
    const h4 = obsHook(pO, { ...bash(pO, "node t1.js"), hook_event_name: "PostToolUseFailure", error: "Command failed", is_interrupt: false });
    const h5 = obsHook(pO, bash(pO, "node t1.js", { tool_response: { exit_code: "2" } }));
    const log1 = logOf(fO.dir);
    ok([h1, h2, h3, h4, h5].every(quiet) && JSON.stringify(log1.map((e) => [e.command, e.exitCode, e.event])) === JSON.stringify([["node t1.js", 0, "PostToolUse"], ["node t2.js", 0, "PostToolUse"],
      ["node t2.js", 3, "PostToolUseFailure"], ["node t1.js", 1, "PostToolUseFailure"], ["node t1.js", 2, "PostToolUse"]]) && log1.every((e) => e.session === "s-obs" && Number.isFinite(Date.parse(e.at))) &&
      fs.readFileSync(path.join(fO.dir, ".execution", ".gitignore"), "utf8") === "*\n",
      "feature F1: the hook logs a _Verify:_ run from both payload shapes — PostToolUse exit_code (none → 0, \"2\" → 2), PostToolUseFailure's error (exit code 3; none → 1) — one JSON line {command, exitCode, at, event, session} in the self-ignoring .execution/; silent, exit 0 (got " +
      JSON.stringify(log1.map((e) => [e.command, e.exitCode, e.event])) + ")");

    // cd <project root> && <cmd> is the command; another folder, another command, a fenced example, an interrupted or
    // backgrounded run, another tool → nothing. A project check goes to .specs/.execution/observed.jsonl.
    const before = logOf(fO.dir).length;
    const skipped = [
      obsHook(pO, bash(pO, "cd sub && node t1.js", { tool_response: { exit_code: 0 } })),
      obsHook(pO, bash(pO, "npm run build", { tool_response: { exit_code: 0 } })),
      obsHook(pO, bash(pO, "node fenced.js", { tool_response: { exit_code: 0 } })),
      obsHook(pO, bash(pO, "node t1.js", { tool_response: { exit_code: 0, interrupted: true } })),
      obsHook(pO, { ...bash(pO, "node t1.js"), hook_event_name: "PostToolUseFailure", error: "Interrupted", is_interrupt: true }),
      obsHook(pO, bash(pO, "node t1.js", { tool_input: { command: "node t1.js", run_in_background: true }, tool_response: { backgroundTaskId: "b1" } })),
      obsHook(pO, bash(pO, "node t1.js", { tool_response: { stdout: "", stderr: "", returnCodeInterpretation: "No matches found" } })), // a non-zero code the tool read as no error: unknown
      obsHook(pO, { ...bash(pO, "node t1.js", { tool_response: { exit_code: 0 } }), tool_name: "Write" }),
      obsHook(pO, { ...bash(pO, "node t1.js", { tool_response: { exit_code: 0 } }), hook_event_name: "PreToolUse" }),
    ];
    const hCd = obsHook(pO, bash(pO, 'cd "' + pO + '" && node t1.js', { tool_response: { exit_code: 0 } }));
    const hCheck = obsHook(pO, bash(pO, CHECK, { tool_response: { exit_code: 0 } }));
    const projLog = logOf(path.join(pO, ".specs"));
    ok(skipped.every(quiet) && quiet(hCd) && quiet(hCheck) && logOf(fO.dir).length === before + 1 && logOf(fO.dir).slice(-1)[0].command === "node t1.js" &&
      projLog.length === 1 && projLog[0].command === CHECK && projLog[0].exitCode === 0 && fs.readFileSync(path.join(pO, ".specs", ".execution", ".gitignore"), "utf8") === "*\n" &&
      !S.listFeatures(pO).features.some((f) => f.name.startsWith(".")) && !(S.listFeatures(pO).ignored || []).length,
      "feature F1: `cd <root> && cmd` counts as cmd; another folder, an unplanned command, a fenced example, an interrupted / backgrounded run, a code the tool read as no error (returnCodeInterpretation), another tool or event log nothing; a project check goes to .specs/.execution/observed.jsonl (self-ignoring, never a feature) (got " +
      JSON.stringify([logOf(fO.dir).length - before, projLog.map((e) => e.command)]) + ")");

    // Malformed / empty / huge stdin: exit 0, silent, nothing written. A .specs/ that is not dev-spec's: nothing written.
    const n0 = logOf(fO.dir).length;
    const bad = ["", "not json", "null", "[]", "42", JSON.stringify({ tool_name: "Bash" }), JSON.stringify({ tool_name: "Bash", tool_input: { command: 42 } }),
      JSON.stringify(bash(pO, "node t1.js", { tool_response: { exit_code: 0 } })).slice(0, 60), "x".repeat(5 * 1024 * 1024)].map((s) => obsHook(pO, s));
    const huge = obsHook(pO, JSON.stringify(bash(pO, "node t1.js", { tool_response: { exit_code: 0, stdout: "y".repeat(5 * 1024 * 1024) } })));
    const other = path.join(tmp, "ffobs-other");
    fs.mkdirSync(path.join(other, ".specs", "notes"), { recursive: true });
    fs.writeFileSync(path.join(other, ".specs", "notes", "tasks.md"), "- [ ] 1. x\n  - _Verify: node t1.js_\n");
    const hOther = obsHook(other, bash(other, "node t1.js", { tool_response: { exit_code: 0 } }));
    ok(bad.every(quiet) && quiet(huge) && logOf(fO.dir).length === n0 && quiet(hOther) && !fs.existsSync(path.join(other, ".specs", "notes", ".execution")) &&
      !fs.existsSync(path.join(other, ".specs", ".execution")),
      "feature F1: malformed, empty, truncated or oversized (5 MB) stdin → exit 0, silent, nothing logged; a project whose .specs/ is not dev-spec's → nothing written");

    // The log stays bounded (newest lines kept).
    const pB = path.join(tmp, "ffobs-bounded");
    S.initProject(pB, ["core"], "en");
    const fB = S.createFeature(pB, "Big", ["core"], "", undefined, "en");
    const longCmd = "node t.js --reporter spec --grep " + "x".repeat(200);
    fs.writeFileSync(path.join(fB.dir, "tasks.md"), "- [ ] 1. [US1] Big\n  - _Verify: " + longCmd + "_\n");
    for (let i = 0; i < 600; i++) S.observeRun(pB, { command: longCmd, exitCode: i % 7, event: "PostToolUse", session: "s" + i });
    const bSize = fs.statSync(path.join(fB.dir, ".execution", "observed.jsonl")).size;
    const bLog = logOf(fB.dir);
    ok(bSize <= S.OBSERVED_MAX_BYTES && bLog.length > 50 && bLog.slice(-1)[0].session === "s599" && bLog.every((e) => e.command === longCmd),
      "feature F1: the observed log stays bounded (≤ " + S.OBSERVED_MAX_BYTES + " bytes after 600 runs, the newest kept) (got " + bSize + " bytes, " + bLog.length + " lines)");

    // observedRun: the LATEST observed run of the same command decides; `a && b` = both parts passed; other commands / codes: not observed.
    S.observeRun(pO, { command: "node t1.js", exitCode: 2 }); // t1: passed (the cd run above), then failed — the failure is the latest
    S.observeRun(pO, { command: "node a.js", exitCode: 0 });
    S.observeRun(pO, { command: "node b.js", exitCode: 0 });
    const lk = [S.observedRun(pO, fO.slug, "node t1.js", 2).observed, S.observedRun(pO, fO.slug, "node t1.js", 0).observed, S.observedRun(pO, fO.slug, "`node   t1.js`", 2).observed,
      S.observedRun(pO, fO.slug, "node t2.js", 3).observed, S.observedRun(pO, fO.slug, "node t2.js", 0).observed, S.observedRun(pO, fO.slug, "node a.js && node b.js", 0).observed,
      S.observedRun(pO, fO.slug, "node zzz.js", 0).observed, S.observedRun(pO, null, CHECK, 0).observed, S.observedRun(pO, null, CHECK, 1).observed,
      S.observedRun(pO, fO.slug, "node t1.js", 2, { now: Date.now() + 25 * 3600 * 1000 }).observed];
    ok(JSON.stringify(lk) === JSON.stringify([true, false, true, true, false, true, false, true, false, false]),
      "feature F1: observedRun — the latest observed run of the same (flattened) command with the same exit code; an earlier pass doesn't cover a later failure; `a && b` counts when both passed; older than 24 h → not observed (got " + JSON.stringify(lk) + ")");

    // Default mode (reported): exactly today's verdict — every run is stamped (observed true | false) and the result says so.
    const c1 = await obsCall("spec_complete_task", { projectDir: pO, name: "auth", number: 1, evidence: { command: "node t1.js", exitCode: 2, summary: "1 failing" } });
    S.observeRun(pO, { command: "node t1.js", exitCode: 0 });
    const c1b = await obsCall("spec_complete_task", { projectDir: pO, name: "auth", number: 1, evidence: { command: "node t1.js", exitCode: 0 } });
    const c2 = await obsCall("spec_complete_task", { projectDir: pO, name: "auth", number: 2, evidence: { command: "node t2.js", exitCode: 0, observed: "cli" } }); // a caller can't claim "cli"
    const c4 = await obsCall("spec_complete_task", { projectDir: pO, name: "auth", number: 4 });
    const st1 = obsState(fO);
    const docR = S.specDoctor(pO, fO.slug).checks.find((c) => c.id === "verification");
    ok(c1.p.ok === false && c1.p.observed === true && c1b.p.ok && c1b.p.verified && c1b.p.observed === true && c2.p.ok && c2.p.verified === true && c2.p.observed === false &&
      !c2.p.unverifiedReason && c4.p.ok && c4.p.observed === undefined && st1.evidence["1"].observed === true && st1.evidence["1"].history[0].observed === true &&
      st1.evidence["2"].observed === false && S.evidenceMode(pO) === "reported" && docR.status === "pass",
      "feature F1: default (meta.evidence reported) — the verdict is unchanged; every reported run is stamped observed true | false in its record and the result (a failed run too); a caller-given observed is ignored; no command → no stamp (got " +
      JSON.stringify([c1.p.observed, c1b.p.observed, c2.p.observed, c2.p.verified, st1.evidence["2"].observed, docR.status]) + ")");

    // spec_init {evidence}: folded, reported back; a bad value is refused by the schema.
    const i1 = await obsCall("spec_init", { projectDir: pO, evidence: "OBSERVED" });
    const i2 = await obsCall("spec_init", { projectDir: pO });
    const i3 = await obsCall("spec_init", { projectDir: pO, evidence: "maybe" });
    const rmO = JSON.parse(fs.readFileSync(path.join(pO, ".specs", "roadmap.json"), "utf8"));
    ok(i1.p.evidence === "observed" && /Evidence mode OBSERVED/.test(i1.p.evidenceNote || "") && /MCP-only client has no such hook/.test(i1.p.evidenceNote || "") &&
      i2.p.evidence === "observed" && i2.p.evidenceNote === undefined && i3.isError && rmO.meta.evidence === "observed",
      "feature F1: spec_init {evidence} sets roadmap.json meta.evidence (case-folded), the result always reports it (+ a note naming the MCP-only limit when set); a value outside reported | observed is refused (got " +
      JSON.stringify([i1.p.evidence, i2.p.evidence, i3.isError]) + ")");

    // meta.evidence "observed": the ONE verdict — status, doctor, finish, next_action, the stop gate — says `unobserved` for task 2.
    const s2 = S.statusFeature(pO, fO.slug).tasks.list.find((t) => t.number === 2);
    const docO = S.specDoctor(pO, fO.slug).checks.find((c) => c.id === "verification");
    fs.writeFileSync(path.join(fO.dir, "tasks.md"), fs.readFileSync(path.join(fO.dir, "tasks.md"), "utf8").replace("- [ ] 3.", "- [x] 3.").replace("- [ ] 4.", "- [x] 4."));
    const fin = S.finishFeature(pO, fO.slug);
    const stop = S.stopCheck(pO, { message: "Done — all tasks are complete and verified." });
    S.writeRoadmapMd(pO);
    const road = fs.readFileSync(path.join(pO, ".specs", "ROADMAP.md"), "utf8");
    ok(s2 && s2.verified === false && docO.status === "warn" && /#2 \(run not observed by the harness\)/.test(docO.detail) &&
      fin.blockers.some((b) => /#2 \(run not observed by the harness\)/.test(b)) && stop.block === true && /#2 \(run not observed by the harness\)/.test(stop.reason) &&
      /#2 \(run not observed by the harness\)/.test(road),
      "feature F1: meta.evidence observed — a reported run the harness never saw is `unobserved` everywhere (status, doctor, the finish blocker, the stop gate, ROADMAP.md) (got " +
      JSON.stringify([s2 && s2.verified, docO.detail, stop.why]).slice(0, 400) + ")");
    // next_action's verify step names it and says how to get an observed run (a written bugfix, gated phase by phase).
    const pNa = path.join(tmp, "ffobs-na");
    S.initProject(pNa, ["core"], "en", { evidence: "observed" });
    const bNa = S.createFeature(pNa, "Obs loop", undefined, "loop", undefined, "en", "bugfix");
    const naFill = (rel, re, by) => { const f = path.join(bNa.dir, rel); fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(re, by)); };
    naFill("tasks.md", /  - _Verify: \[[^\]\n]*T-01\]_\n/, "  - _Verify: node tests/t01.test.js_\n");
    naFill("bug.md", /> \*\*TODO\*\*[^\n]*/g, "The handler redirects before clearing the cookie (auth.js:88).");
    naFill("bug.md", /\[[^\]\n]+\]/g, "the dashboard opens");
    naFill("requirements.md", /\[[^\]\n]+\]/g, "the refresh token has expired");
    naFill("test-plan.md", /\[[^\]\n]+\]/g, "tests/t01.test.js");
    naFill("tasks.md", /\[(?!shared\]|US\d+\]|[ xX]\])[^\]\n]+\]/g, "npm test");
    ["requirements", "design", "test-plan", "tasks"].forEach((ph) => S.approvePhase(pNa, bNa.slug, ph));
    S.completeTask(pNa, bNa.slug, 1); S.completeTask(pNa, bNa.slug, 2);
    const red3 = S.completeTask(pNa, bNa.slug, 3, { command: "node tests/t01.test.js", exitCode: 1, summary: "not ok 1 - T-01" });
    naFill("tasks.md", /- \[ \] 4\./, "- [x] 4.");
    const naObs = S.nextAction(pNa, bNa.slug);
    ok(red3.ok && red3.unverifiedReason === "unobserved" && naObs.step === "verify" && /#3 \(run not observed by the harness\)/.test(naObs.recommendation) &&
      /only runs the harness saw \(roadmap\.json meta\.evidence: observed\)/.test(naObs.recommendation),
      "feature F1: next_action's verify step lists the unobserved task and says how to get an observed run (got " + JSON.stringify([red3.unverifiedReason, naObs.step, naObs.recommendation]).slice(0, 400) + ")");

    // A new report of task 2: unobserved (reason + note; nothing ever observed in a project → the MCP-only line); after the hook saw it → verified.
    const c2b = await obsCall("spec_complete_task", { projectDir: pO, name: "auth", number: 2, evidence: { command: "node t2.js", exitCode: 0 } });
    const pN = path.join(tmp, "ffobs-never");
    S.initProject(pN, ["core"], "en", { evidence: "observed" });
    const fN = S.createFeature(pN, "Solo", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(fN.dir, "tasks.md"), "- [ ] 1. [US1] Solo\n  - _Verify: node s.js_\n");
    const cN = await obsCall("spec_complete_task", { projectDir: pN, name: "solo", number: 1, evidence: { command: "node s.js", exitCode: 0 } });
    obsHook(pO, bash(pO, "node t2.js", { tool_response: { exit_code: 0 } }));
    const c2c = await obsCall("spec_complete_task", { projectDir: pO, name: "auth", number: 2, evidence: { command: "node t2.js", exitCode: 0 } });
    const cCli = S.completeTask(pN, "solo", 1, { command: "node s.js", exitCode: 0 }, { ranBy: "cli" });
    ok(c2b.p.ok && c2b.p.verified === false && c2b.p.unverifiedReason === "unobserved" && c2b.p.observed === false && /dev-spec done auth 2 --run/.test(c2b.p.note) &&
      !/No run was ever observed/.test(c2b.p.note) && cN.p.unverifiedReason === "unobserved" && /No run was ever observed in this project/.test(cN.p.note) &&
      /MCP-only client has no hook/.test(cN.p.note) && c2c.p.verified === true && c2c.p.observed === true && !c2c.p.unverifiedReason &&
      cCli.verified === true && cCli.observed === "cli" && obsState(fN).evidence["1"].observed === "cli",
      "feature F1: meta.evidence observed — an unobserved report ticks but stays unverified (unverifiedReason unobserved + a note naming --run; the MCP-only line when nothing was ever observed there); once the hook saw the run it verifies; a CLI run (observed: \"cli\") verifies (got " +
      JSON.stringify([c2b.p.unverifiedReason, cN.p.unverifiedReason, c2c.p.verified, cCli.observed]) + ")");

    // _Expect: fail_: the red run is the proof — it must be the observed one.
    const fR = S.createFeature(pO, "Red", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(fR.dir, "tasks.md"), "- [ ] 1. [US1] Write T-01 and watch it fail\n  - _Verify: node red.js_\n  - _Expect: fail_\n");
    const r1 = S.completeTask(pO, "red", 1, { command: "node red.js", exitCode: 1, summary: "not ok 1 - T-01" });
    obsHook(pO, { ...bash(pO, "node red.js"), hook_event_name: "PostToolUseFailure", error: "Command failed with exit code 1" });
    const r2 = S.completeTask(pO, "red", 1, { command: "node red.js", exitCode: 1, summary: "not ok 1 - T-01" });
    ok(r1.ok && r1.redRecorded && r1.verified === false && r1.unverifiedReason === "unobserved" && r2.ok && r2.verified === true && r2.observed === true,
      "feature F1: an _Expect: fail_ task's red run counts only once observed (the hook's PostToolUseFailure) (got " + JSON.stringify([r1.unverifiedReason, r2.verified]) + ")");

    // Project checks: an unobserved passing run is status `unobserved` (a blocker); the hook-observed one passes; finish --run's "cli" too.
    const fS = S.createFeature(pO, "Suite obs", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(fS.dir, "tasks.md"), "- [ ] 1. [US1] Do it\n");
    S.completeTask(pO, "suite-obs", 1);
    const pPlain = path.join(tmp, "ffobs-plain");
    S.initProject(pPlain, ["core"], "en", { checks: { lint: "npm run lint" }, evidence: "observed" });
    const fP = S.createFeature(pPlain, "Plain", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(fP.dir, "tasks.md"), "- [x] 1. [US1] Do it\n");
    const u1 = await obsCall("spec_finish", { projectDir: pPlain, name: "plain", evidence: [{ name: "lint", command: "npm run lint", exitCode: 0 }] });
    obsHook(pPlain, bash(pPlain, "npm run lint", { tool_response: { exit_code: 0 } }));
    const u2 = await obsCall("spec_finish", { projectDir: pPlain, name: "plain", evidence: [{ name: "lint", command: "npm run lint", exitCode: 0 }] });
    const u3 = S.finishFeature(pO, "suite-obs", { evidence: [{ name: "test", command: CHECK, exitCode: 0 }], ranBy: "cli" });
    const lintU1 = u1.p.suiteChecks.find((c) => c.name === "lint"), lintU2 = u2.p.suiteChecks.find((c) => c.name === "lint");
    ok(lintU1.status === "unobserved" && lintU1.observed === false && u1.p.blockers.some((b) => /lint \(the run was not observed by the harness\)/.test(b)) &&
      JSON.stringify(u1.p.recordedChecks) === JSON.stringify([{ name: "lint", exitCode: 0 }]) && lintU2.status === "pass" && lintU2.observed === true &&
      u3.suiteChecks.find((c) => c.name === "test").observed === "cli" && u3.suiteChecks.find((c) => c.name === "test").status === "pass",
      "feature F1: project checks — spec_finish {evidence} stamps each run observed; with meta.evidence observed an unobserved pass is status `unobserved` (a blocker), the hook-observed one and finish --run's (\"cli\") pass (got " +
      JSON.stringify([lintU1.status, lintU2.status, u3.suiteChecks.map((c) => c.status)]) + ")");

    // Localized labels (PT, ES, pt-BR) and back to reported: the same records verify again.
    ok(S.msg("pt").evidenceGate.reason.unobserved === "execução não observada pelo harness" && S.msg("es").evidenceGate.reason.unobserved === "ejecución no observada por el harness" &&
      /Execute o comando/.test(S.msg("pt-BR").observed.unobservedNote(2, "auth")) && S.msg("es").observed.badValue("x") === "--evidence admite reported u observed (recibido 'x')." &&
      S.msg("pt").projectChecks.status({ status: "unobserved" }) === "a execução não foi observada pelo harness",
      "feature F1: the unobserved labels and notes are localized (PT, ES; pt-BR derived from PT)");
    S.initProject(pN, ["core"], "en", { evidence: "reported" });
    ok(S.statusFeature(pN, "solo").tasks.list[0].verified === true && S.evidenceMode(pN) === "reported" && S.initProject(pN, [], undefined, { evidence: "sometimes" }).ok === false,
      "feature F1: back to meta.evidence reported, the same records verify as before; the engine refuses an unknown mode");
  }

  // 1.14 features — integration across the branches: the matrix (F5) gives the ONE verdict in the project's evidence mode (F1).
  {
    const fi = path.join(tmp, "proj-features-integration");
    S.initProject(fi, ["core"], "en", { evidence: "observed" });
    const c = S.createFeature(fi, "Matrix mode", ["core"], "x", undefined, "en");
    fs.writeFileSync(path.join(c.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Do it\n  - _Requirements: US-1.AC-1_\n  - _Verify: node -e \"process.exit(0)\"_\n");
    S.completeTask(fi, "matrix-mode", 1, { command: "node -e \"process.exit(0)\"", exitCode: 0 }); // reported, never observed
    const row = (S.traceMatrix(fi, "matrix-mode").rows || []).find((r) => r.id === "US-1.AC-1");
    const t1 = row && row.tasks.find((t) => t.number === 1);
    ok(t1 && t1.verified === false && t1.reason === "unobserved" && t1.evidence && t1.evidence.observed === false && row.status !== "verified",
      "features F1 × F5: under meta.evidence 'observed' the matrix reads a reported-only run as unobserved (the gates' verdict) and shows the observed stamp (got " + JSON.stringify(t1) + ")");
  }

  // 1.14 feature review (F1 / F3 / F5) — one regression per finding of the independent review of the merged features.
  {
    const hookJs = path.join(__dirname, "..", "hooks", "observe-hook.js");
    const runHook = (projectEnv, input) => spawnSync(process.execPath, [hookJs], { input: JSON.stringify(input), encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectEnv, SPEC_PROJECT_DIR: "" } });
    const post = (cwd, tool, command, resp, event) => ({ session_id: "s-rv", cwd, hook_event_name: event || "PostToolUse", tool_name: tool,
      tool_input: { command }, tool_response: resp });
    const logLines = (dir) => { try { return fs.readFileSync(path.join(dir, ".execution", "observed.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
    // R1: an unparseable roadmap.json keeps meta.evidence "observed" (fail closed).
    const r1 = path.join(tmp, "proj-frv-r1");
    S.initProject(r1, ["core"], "en", { evidence: "observed" });
    fs.appendFileSync(path.join(r1, ".specs", "roadmap.json"), "x");
    ok(S.evidenceMode(r1) === "observed", "feature review R1: a roadmap.json that no longer parses keeps evidence mode 'observed' (got " + S.evidenceMode(r1) + ")");
    // R2: a red proof recorded before the switch to "observed" is grandfathered once the fix's passing run is observed / CLI-made.
    const r2 = path.join(tmp, "proj-frv-r2");
    S.initProject(r2, ["core"], "en");
    const c2 = S.createFeature(r2, "Red", ["core"], "x", undefined, "en");
    const V2 = 'node -e "process.exit(0)"';
    fs.writeFileSync(path.join(c2.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Write T-01 red\n  - _Verify: " + V2 + "_\n  - _Expect: fail_\n");
    S.completeTask(r2, "red", 1, { command: V2, exitCode: 1 }); // the red run, reported (not observed), BEFORE the switch
    const until2 = Date.now() + 5; while (Date.now() < until2) { /* the switch is later than the red run */ }
    S.initProject(r2, ["core"], "en", { evidence: "observed" });
    const before2 = S.completeTask(r2, "red", 1, { command: V2, exitCode: 0 }); // the fix's green run — reported only
    const after2 = S.completeTask(r2, "red", 1, { command: V2, exitCode: 0 }, { ranBy: "cli" }); // as done --run makes it
    ok(before2.verified === false && before2.unverifiedReason === "unobserved" && /RED run/.test(before2.note || "") && after2.verified === true,
      "feature review R2: in observed mode an _Expect: fail_ red proof recorded before the switch counts once the green run is observed (CLI) — and the unobserved note asks for an observed RED run, never the green --run loop (got " +
      JSON.stringify([before2.unverifiedReason, (before2.note || "").slice(0, 80), after2.verified, after2.unverifiedReason]) + ")");
    // R4 / R5 / R6: the observe hook logs a worktree subagent's run in the main project too; a PowerShell run only with an explicit
    // exit code; the " && " join of a task's commands passes the pre-filter.
    const main4 = path.join(tmp, "proj-frv-r4main"), wt4 = path.join(tmp, "proj-frv-r4wt");
    for (const d of [main4, wt4]) {
      S.initProject(d, ["core"], "en");
      const c = S.createFeature(d, "Obs", ["core"], "x", undefined, "en");
      fs.writeFileSync(path.join(c.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Two checks\n  - _Verify: node a.js_\n  - _Verify: node b.js_\n- [ ] 2. [US1] One\n  - _Verify: node c.js_\n");
    }
    runHook(main4, post(wt4, "Bash", "node c.js", { stdout: "", stderr: "", exit_code: 0 }));
    const mainDir = path.join(main4, ".specs", "obs"), wtDir = path.join(wt4, ".specs", "obs");
    const r4 = [logLines(mainDir).some((e) => e.command === "node c.js"), logLines(wtDir).some((e) => e.command === "node c.js")];
    runHook(main4, post(main4, "PowerShell", "node a.js && node b.js", { output: "ok" })); // no explicit exit code: never logged
    const r5a = logLines(mainDir).some((e) => e.command === "node a.js && node b.js");
    runHook(main4, post(main4, "PowerShell", "node a.js && node b.js", { stdout: "", exit_code: 0 })); // explicit: logged (R5 + R6)
    const r56 = logLines(mainDir).filter((e) => e.command === "node a.js && node b.js");
    ok(r4[0] && r4[1] && !r5a && r56.length === 1 && r56[0].exitCode === 0,
      "feature review R4/R5/R6: a run in a worktree copy is logged in the main project too; a PowerShell run is logged only with an explicit exit code; the && join of a task's commands passes the pre-filter (got " +
      JSON.stringify([r4, r5a, r56.length]) + ")");
    // R7: ROADMAP.md shows a feature whose open tasks can't start (a _Depends:_ cycle) as blocked, with an attention line.
    const r7 = path.join(tmp, "proj-frv-r7");
    S.initProject(r7, ["core"], "en");
    const c7 = S.createFeature(r7, "Cyc", ["core"], "x", undefined, "en");
    fs.writeFileSync(path.join(c7.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] A\n  - _Depends: 2_\n- [ ] 2. [US1] B\n  - _Depends: 1_\n");
    S.roadmapReport(r7, { write: true });
    const md7 = fs.readFileSync(path.join(r7, ".specs", "ROADMAP.md"), "utf8");
    ok(/\| \[cyc\][^\n]*\| blocked \|/.test(md7) && /no open task can start \(task dependencies\): #1 waits on #2; #2 waits on #1/.test(md7) && !/cyc\*\* \(core\) — ready/.test(md7),
      "feature review R7: a tasks.md whose open tasks wait on each other reads blocked in ROADMAP.md, never ready (got " + JSON.stringify((md7.match(/^.*cyc.*$/gm) || []).slice(0, 3)) + ")");
    // R8: prose "(depends: the schema from task 1)" is no malformed marker; a bold "**Depends:** 1" still is.
    const r8 = path.join(tmp, "proj-frv-r8");
    S.initProject(r8, ["core"], "en");
    const c8 = S.createFeature(r8, "Prose", ["core"], "x", undefined, "en");
    fs.writeFileSync(path.join(c8.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Schema\n- [ ] 2. [US1] Wire the API (depends: the schema from task 1)\n- [ ] 3. [US1] Other **Depends:** 1\n");
    const mm8 = S.specDoctor(r8, "prose").checks.find((x) => x.id === "malformed-markers");
    ok(mm8 && mm8.status === "warn" && /#3 \(Depends:\)/.test(mm8.detail) && !/#2/.test(mm8.detail) && /_Depends: 3_/.test(mm8.detail),
      "feature review R8: 'depends:' in prose is no marker look-alike; '**Depends:** 1' is, and the hint shows _Depends: 3_ (got " + JSON.stringify(mm8 && mm8.detail) + ")");
    // R11: a scaffold's untouched EC / NFR / SC rows are no matrix gap (trace_check warns about none).
    const r11 = path.join(tmp, "proj-frv-r11");
    S.initProject(r11, ["core"], "en");
    S.createFeature(r11, "Tpl", ["core"], "x", undefined, "en");
    const sec11 = S.traceMatrix(r11, "tpl").rows.filter((r) => r.kind !== "ac");
    ok(sec11.length > 0 && sec11.every((r) => r.template === true && r.gaps.length === 0 && r.status !== "untraced") && S.traceCheck(r11, "tpl").warnings.length === 0,
      "feature review R11: template EC/NFR/SC rows carry no gap and are not untraced, as trace_check says nothing about them (got " + JSON.stringify(sec11.map((r) => r.id + ":" + r.status)) + ")");
  }
};
