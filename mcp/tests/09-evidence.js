"use strict";
// Evidence — _Verify:_ runs, _Expect: fail_, project checks, pipes, git-linked and harness-observed evidence.
// Red → green, meta.checks and the finish suite run, could-not-run refusals, the observe hook and the evidence mode.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, rpc, payload, S, tmp, list, __dirname, require }) => {

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
      fs.writeFileSync(tp, fs.readFileSync(tp, "utf8").replace(/  - _Verify: \[[^\]\n]*T-01\]_\n/, "  - _Verify: node tests/t01.test.js_\n")); // the scaffold's task 1 already carries _Expect: fail_
      const bp = path.join(b.dir, "bug.md");
      fs.writeFileSync(bp, fs.readFileSync(bp, "utf8").replace(/> \*\*TODO\*\*[^\n]*/g, "The handler redirects before clearing the cookie (auth.js:88).").replace(/\[[^\]\n]+\]/g, "the dashboard opens"));
      const fillAll = (rel, re, by) => { const p = path.join(b.dir, rel); fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(re, by)); };
      fillAll("requirements.md", /\[[^\]\n]+\]/g, "the refresh token has expired");
      fillAll("test-plan.md", /\[[^\]\n]+\]/g, "tests/t01.test.js");
      fillAll("tasks.md", /\[(?!shared\]|US\d+\]|[ xX]\])[^\]\n]+\]/g, "npm test");
      ["requirements", "design", "test-plan", "tasks"].forEach((ph) => S.approvePhase(d, b.slug, ph));
      const pass1 = S.completeTask(d, b.slug, 1, { command: "node tests/t01.test.js", exitCode: 0 });
      fs.writeFileSync(tp, fs.readFileSync(tp, "utf8").replace(/- \[ \] 1\./, "- [x] 1.").replace(/- \[ \] 2\./, "- [x] 2."));
      return { b, pass1, na: S.nextAction(d, b.slug) };
    };
    const d10 = b5Dir("na");
    S.initProject(d10, ["core"], "en");
    const reEn = redExpect(d10, "en"), rePt = redExpect(d10, "pt");
    ok(reEn.pass1.unexpectedPass === true && reEn.na.step === "verify" && /#1 \(run passed, but _Expect: fail_ needs a red run\)/.test(reEn.na.recommendation) &&
      /Task 1 is marked _Expect: fail_: its proof is a run that FAILS .*\(node "[^"]*dev-spec\.js" done red-expect-en 1 --run while the test fails/.test(reEn.na.recommendation) &&
      !/Mark task 1 with _Expect: fail_/.test(reEn.na.recommendation) && rePt.na.step === "verify" && /A tarefa 1 tem _Expect: fail_: a prova é uma execução que FALHA/.test(rePt.na.recommendation),
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
    ok(!docOpen7 && finOpen7.suiteChecks.every((c) => c.status === "no-run") && finOpen7.blockers.some((b) => /project checks without a passing run since the last task activity: test \(no run recorded\), lint \(no run recorded\) — run them: node "[^"]*dev-spec\.js" finish suite --run/.test(b)) &&
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
      chg7.suiteChecks.find((c) => c.name === "lint").status === "changed" && chg7.blockers.some((b) => /lint \(the run is not of its command \(or the command changed since\)\)/.test(b)),
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

    // 1.23 review (L7): a run that CRASHED — 128 + SIGILL / SIGABRT / SIGBUS / SIGFPE / SIGSEGV as a POSIX shell reports it, a
    // Windows NTSTATUS crash code read unsigned or signed — is a failed run (recorded), never the red proof of an _Expect: fail_
    // task: refused with couldNotRun "crash" (MCP = the engine), the task stays open; an assertion failure still proves it.
    const crashes = [132, 134, 135, 136, 139, 0xC0000005, 0xC0000005 - 0x100000000, 0xC0000409, 0xC00000FD, 0xC000001D, 0xC0000094, 0x80000003, 0x80000003 - 0x100000000];
    const kills = [0, 1, 2, 3, 126, 127, 130, 137, 143, 255, 9009];
    const fCr = S.createFeature(p2, "Red crash", ["core"], "", undefined, "en");
    const CR_CMD = "node --test test/crash.test.js";
    gaW(fCr.dir, "tasks.md", "- [ ] 1. [US1] Write test T-01 and watch it fail\n  - _Verify: " + CR_CMD + "_\n  - _Expect: fail_\n");
    const segv = S.completeTask(p2, fCr.slug, 1, { command: CR_CMD, exitCode: 139, summary: "Segmentation fault (core dumped)" });
    const av = payload(await rpc("tools/call", { name: "spec_complete_task", arguments: { name: fCr.slug, number: 1, evidence: { command: CR_CMD, exitCode: -1073741819 }, projectDir: p2 } }));
    const openCr = /- \[ \] 1\./.test(gaTasks(fCr));
    const fCrPt = S.createFeature(p2, "Crash pt", ["core"], "", undefined, "pt");
    gaW(fCrPt.dir, "tasks.md", "- [ ] 1. [US1] Escrever T-01\n  - _Verify: " + CR_CMD + "_\n  - _Expect: fail_\n");
    const ptCr = S.completeTask(p2, fCrPt.slug, 1, { command: CR_CMD, exitCode: 3221225477 });
    const redCr = S.completeTask(p2, fCr.slug, 1, { command: CR_CMD, exitCode: 1, summary: "✖ T-01 (1.1ms)\nAssertionError [ERR_ASSERTION]: 'a' !== 'A'\nℹ fail 1" });
    ok(crashes.every((c) => S.crashExit(c)) && !kills.some((c) => S.crashExit(c)) &&
      segv.ok === false && segv.recorded === true && segv.couldNotRun === "crash" && /Task 1: the run crashed \(exit 139/.test(segv.error) &&
      av.ok === false && av.couldNotRun === "crash" && /exit -1073741819/.test(av.error) && openCr &&
      ptCr.ok === false && ptCr.couldNotRun === "crash" && /a execução crashou \(exit 3221225477/.test(ptCr.error) &&
      redCr.ok === true && redCr.redRecorded === true && /- \[x\] 1\./.test(gaTasks(fCr)),
      "1.23 review: a crash (exit 139, 0xC0000005 signed / unsigned…) is no red proof of an _Expect: fail_ task — refused (recorded, couldNotRun: crash; MCP and PT), the task stays open; an assertion failure is the red proof (got " +
      JSON.stringify([segv.couldNotRun, av.couldNotRun, ptCr.couldNotRun, segv.error && segv.error.slice(0, 80), redCr.redRecorded]) + ")");

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
    ok(na8.step === "finish" && na8.recommendation.includes(S.DEV_SPEC + " finish " + f8.slug + " --run runs and records them") && /spec_finish \{evidence: \[/.test(na8.recommendation) &&
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
    const red1 = S.completeTask(pNa, bNa.slug, 1, { command: "node tests/t01.test.js", exitCode: 1, summary: "not ok 1 - T-01" }); // the red task (_Expect: fail_)
    naFill("tasks.md", /- \[ \] 2\./, "- [x] 2.");
    const naObs = S.nextAction(pNa, bNa.slug);
    ok(red1.ok && red1.unverifiedReason === "unobserved" && naObs.step === "verify" && /#1 \(run not observed by the harness\)/.test(naObs.recommendation) &&
      /only runs the harness saw \(roadmap\.json meta\.evidence: observed\)/.test(naObs.recommendation),
      "feature F1: next_action's verify step lists the unobserved task and says how to get an observed run (got " + JSON.stringify([red1.unverifiedReason, naObs.step, naObs.recommendation]).slice(0, 400) + ")");

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
    ok(c2b.p.ok && c2b.p.verified === false && c2b.p.unverifiedReason === "unobserved" && c2b.p.observed === false && /node "[^"]*dev-spec\.js" done auth 2 --run/.test(c2b.p.note) &&
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

  // 1.21.1 languages — PowerShell evidence: the _Verify:_ refusal under cmd.exe, the run shell, could-not-run vs red.
  {
    const js = (v) => JSON.stringify(v);
    const E = require("./lib/engine/index.js");
    const ESC = String.fromCharCode(27), BS = String.fromCharCode(92);
    const px = (c) => S.posixShellSyntax(c).join("+");
    // 1. posixShellSyntax: `$` inside a double-quoted word of a PowerShell program's -Command script (or powershell.exe's positional
    // command) is PowerShell's — cmd.exe hands it over intact; a single-quoted script, a `$` outside quotes and a -File script's
    // arguments (literal strings to the script — the calling shell's syntax) stay flagged.
    const PX = [
      ['pwsh -NoProfile -Command "Invoke-Pester ./tests -CI; exit $LASTEXITCODE"', ""],
      ['pwsh -NoProfile -Command "$r = Invoke-Pester ./tests -PassThru; exit $r.FailedCount"', ""],
      ['pwsh.exe -nop -c "Invoke-Pester -Path tests -CI; exit $LASTEXITCODE"', ""],
      ['PowerShell.exe -NoProfile -ExecutionPolicy Bypass -Command "Invoke-Pester -EnableExit; exit $LASTEXITCODE"', ""],
      ['pwsh /c "exit $LASTEXITCODE"', ""],
      ['pwsh -NoProfile -CommandWithArgs "exit $args[0]" 3', ""],
      ['powershell -NoProfile "Invoke-Pester -EnableExit; exit $LASTEXITCODE"', ""],
      ['powershell -ExecutionPolicy Bypass -WindowStyle Hidden "exit $LASTEXITCODE"', ""],
      ['"C:' + BS + 'Program Files' + BS + 'PowerShell' + BS + '7' + BS + 'pwsh.exe" -NoProfile -Command "exit $LASTEXITCODE"', ""],
      ['npm run build && pwsh -NoProfile -Command "Invoke-Pester -CI; exit $LASTEXITCODE"', ""],
      ['pwsh -NoProfile -Command "node -e \'process.exit(0)\'; exit $LASTEXITCODE"', ""],
      ["pwsh -c 'Invoke-Pester ./tests -CI'", "single-quotes"],
      ['pwsh -NoProfile -Command Invoke-Pester; exit $LASTEXITCODE', "variable"],
      ['pwsh -NoProfile -File build.ps1 -Target "$env:DEPLOY_ENV"', "variable"],
      ['pwsh build.ps1 "$x"', "variable"],
      ['powershell -ExecutionPolicy Bypass -File build.ps1 "$x"', "variable"],
      ['pwsh -c "exit 0" && echo "$HOME"', "variable"],
      ['echo pwsh -c "$x"', "variable"],
      ['test "$CI" = 1', "variable"],
    ];
    const pxWrong = PX.filter(([c, want]) => px(c) !== want).map(([c]) => c + " → " + px(c));
    ok(!pxWrong.length,
      "1.21.1 languages: posixShellSyntax lets `$` through inside a double-quoted pwsh / powershell -Command script (-c, /c, -CommandWithArgs, powershell.exe's positional command, any path, after &&) — cmd.exe hands it to PowerShell intact; a single-quoted script, an unquoted `$`, a -File script's arguments and `$` outside PowerShell stay refused (wrong: " +
      js(pxWrong) + ")");

    // 2. The run shell: --shell pwsh / powershell (a bare name or a path, quoted or not; DEV_SPEC_SHELL too) runs
    // `<shell> -NoProfile -NonInteractive -Command <cmd>` — on every platform; bash / cmd / the default are unchanged.
    const ARGS = '["-NoProfile","-NonInteractive","-Command"]';
    const rs = (req, platform) => S.resolveRunShell(req, { platform, env: {} });
    const pwP = "C:" + BS + "Program Files" + BS + "PowerShell" + BS + "7" + BS + "pwsh.exe";
    const shells = [rs("pwsh", "win32"), rs("powershell", "win32"), rs("POWERSHELL.EXE", "win32"), rs(pwP, "win32"), rs('"' + pwP + '"', "win32"), rs("pwsh", "linux"), rs("/usr/bin/pwsh", "darwin")];
    ok(shells.every((r) => r.pwsh === true && r.cmd === false && js(r.args) === ARGS) && shells[3].shell === pwP && shells[4].shell === pwP && shells[0].shell === "pwsh" && shells[6].shell === "/usr/bin/pwsh" &&
      !rs("bash", "linux").pwsh && !rs("", "win32").pwsh && rs("", "win32").cmd === true && !rs("cmd", "win32").pwsh && !rs("sh", "win32").args && !rs("zsh", "linux").args &&
      E.isPwshShell("C:/tools/pwsh-preview/pwsh.exe") && !E.isPwshShell("pwsh-wrapper"),
      "1.21.1 languages: resolveRunShell — pwsh / powershell(.exe), a path to either (quotes dropped), on Windows and elsewhere → pwsh: true + args -NoProfile -NonInteractive -Command (the CLI runs <shell> <args> <cmd>); bash, sh, zsh, cmd and the default are unchanged (got " +
      js(shells) + ")");

    // 3. could-not-run vs red — PowerShell's own could-not-run outputs (pwsh 7 / Windows PowerShell 5.1 / pwsh's pt-BR and es
    // resources; ANSI colours as pwsh 7 writes them), and Pester's red runs — a test that RAN and failed, even on "is not
    // recognized", stays red (outputs captured from pwsh 7.6, Windows PowerShell 5.1, Pester 3.4 / 5.9 / 6.2).
    const red = (s) => ESC + "[91m" + s + ESC + "[0m";
    const cnr = (s) => (S.couldNotRunOutput(s) || {}).kind || null;
    const CANT = [
      ESC + "[31;1mInvoke-Pester: " + ESC + "[31;1mThe term 'Invoke-Pester' is not recognized as a name of a cmdlet, function, script file, or executable program." + ESC + "[0m\r\n" + ESC + "[31;1mCheck the spelling of the name.",
      "Invoke-Pester : The term 'Invoke-Pester' is not recognized as the name of a \r\ncmdlet, function, script file, or operable program. Check the spelling of the name.\r\nAt line:1 char:1",
      'O termo "Invoke-Pester" não é reconhecido como um nome de um cmdlet, função, arquivo de script ou programa executável.',
      'El término "Invoke-Pester" no se reconoce como nombre de un cmdlet, función, archivo de script o programa ejecutable.',
      "Import-Module: The specified module 'Pester' was not loaded because no valid module file was found in any module directory.",
      'O módulo especificado "Pester" não foi carregado porque nenhum arquivo de módulo válido foi encontrado em nenhum diretório de módulo.',
      'No se cargó el módulo especificado "Pester" porque no se encontró ningún archivo de módulo válido en ningún directorio de módulos.',
      "File C:" + BS + "x" + BS + "build.ps1 cannot be loaded because running scripts is \r\ndisabled on this system. For more information, see about_Execution_Policies.",
      "Não é possível carregar o arquivo C:" + BS + "x" + BS + "b.ps1 porque a execução de scripts está desabilitada neste sistema.",
      "El archivo C:" + BS + "x" + BS + "b.ps1 no se puede cargar porque la ejecución de scripts está deshabilitada en este sistema.",
      "File C:" + BS + "x" + BS + "b.ps1 cannot be loaded. The file C:" + BS + "x" + BS + "b.ps1 is not digitally signed. You cannot run this script on the current system.",
      "The argument 'scripts/nope.ps1' is not recognized as the name of a script file. Check the spelling of the name.\n\nUsage: pwsh[.exe] [-Login]",
      "The argument 'scripts/nope.ps1' to the -File parameter does not exist. Provide the path to an existing '.ps1' file as an argument to the -File parameter.",
      "System.Management.Automation.RuntimeException: No test files were found and no scriptblocks were provided. Please ensure that you provided at least one path to a *.Tests.ps1 file.",
      // Pester 5: a BeforeAll that imports a module that isn't there — its test is COUNTED failed, but "Container failed" says it never ran
      red("[-] C:" + BS + "x" + BS + "Ba.Tests.ps1 failed with:") + "\nFileNotFoundException: The specified module 'C:/x/../src/Missing.psm1' was not loaded because no valid module file was found in any module directory.\n" +
        ESC + "[97mTests Passed: 0, " + ESC + "[0m" + ESC + "[91mFailed: 1, " + ESC + "[0m" + ESC + "[90mSkipped: 0, NotRun: 0" + ESC + "[0m\n" + red("Container failed: 1"),
      // Pester 3: the same, in a Describe block
      "Describing Missing\n [-] Error occurred in Describe block 378ms\n   FileNotFoundException: The specified module 'x/Missing.psm1' was not loaded because no valid module file was found in any module directory.\nPassed: 0 Failed: 1 Skipped: 0 Pending: 0 Inconclusive: 0",
    ];
    const RED = [
      red("[-] Get-Greeting.T-01 greets by name (US-1.AC-1)") + ESC + "[90m 132ms (114ms|18ms)" + ESC + "[0m\n" + red(" Expected strings to be the same, but they were different.") + "\n" + red(" Expected: 'Hello, Ana'") + "\n" +
        ESC + "[97mTests Passed: 0, " + ESC + "[0m" + ESC + "[91mFailed: 1, " + ESC + "[0m", // Pester 5, coloured
      red("[-] Get-Farewell.T-02 says bye") + ESC + "[90m 89ms (72ms|17ms)" + ESC + "[0m\n" + red(" CommandNotFoundException: The term 'Get-Farewell' is not recognized as a name of a cmdlet, function, script file, or executable program.") +
        "\nTests Passed: 0, Failed: 1, Skipped: 0, Inconclusive: 0, NotRun: 0", // the function under test doesn't exist yet: a red test
      "Describing Get-Farewell\n [-] T-02 says bye 469ms\n   CommandNotFoundException: The term 'Get-Farewell' is not recognized as the name of a cmdlet, function, script file, or operable program.\nPassed: 0 Failed: 1 Skipped: 0 Pending: 0 Inconclusive: 0", // Pester 3
      "CommandNotFoundException: The term 'Get-Farewell' is not recognized as a name of a cmdlet, function, script file, or executable program.\nTests completed in 747ms\nTests Passed: 0, Failed: 1, Skipped: 0, Inconclusive: 0, NotRun: 0", // a summary without the [-] line
      "[-] Get-Greeting.T-01 greets by name (US-1.AC-1) 129ms\n Expected 'Hello, Ana', but got 'Hello'.\nTests Passed: 0, Failed: 1, Skipped: 0, Inconclusive: 0, NotRun: 0", // Pester 6
      " Expected 'no error', but got 'The term 'foo' is not recognized as a name of a cmdlet, function, script file, or executable program.'", // an assertion quoting it
    ];
    const cantWrong = CANT.map((s, i) => [i, cnr(s)]).filter(([, k]) => k !== "test");
    const redWrong = RED.map((s, i) => [i, cnr(s)]).filter(([, k]) => k !== null);
    const RA = E.RE_ASSERTION_RAN;
    ok(!cantWrong.length && !redWrong.length && RA.test("  [-] T-01 greets 12ms") && RA.test("[-] a.b 1.02s (1s|20ms)") && !RA.test(" [-] Error occurred in Describe block 378ms") &&
      !RA.test("[-] Discovery in C:/x/a.Tests.ps1 failed with:") && !RA.test("[-] C:/x/Ba.Tests.ps1 failed with:") && RA.test("Expected 3, but got 2.") && RA.test("   But was:  {Hello}") &&
      RA.test("Expected string length 10 but was 5.") && !RA.test("Tests Passed: 0, Failed: 1") && E.pesterRan("Tests Passed: 0, Failed: 1, Skipped: 0") && !E.pesterRan("Tests Passed: 3, Failed: 0") &&
      !E.pesterRan("Tests Passed: 0, Failed: 1\nContainer failed: 1") && E.pesterRan("Passed: 0 Failed: 2 Skipped: 0"),
      "1.21.1 languages: couldNotRunOutput knows PowerShell's could-not-run outputs (an unknown command — pwsh 7, Windows PowerShell 5.1 wrapped, pt-BR, es; a missing module; the execution policy; an unsigned script; a -File path that isn't there; Pester's 'No test files were found'; a Pester container / Describe block that failed before its test ran) and never a Pester red run ('[-] … 12ms', 'Expected …, but got …', 'Tests Passed: 0, Failed: 1' — also when the failure quotes 'is not recognized'); ANSI colours read through (wrong: " +
      js([cantWrong, redWrong]) + ")");

    // 4. What a run records and says: colour codes dropped from the summary; cmd.exe's hint never fires on PowerShell's own
    // messages; the pipe check reads a pwsh -Command script.
    const sum = S.summarizeRunOutput(RED[0] + "\n" + ESC + "]8;;file:///C:/x" + ESC + BS + "link" + ESC + "]8;;" + ESC + BS + "\n");
    const wsf = S.windowsShellFailure;
    ok(!sum.includes(ESC) && /^\[-\] Get-Greeting\.T-01 greets by name \(US-1\.AC-1\) 132ms \(114ms\|18ms\)$/m.test(sum) && /Tests Passed: 0, Failed: 1,/.test(sum) && /^link$/m.test(sum) &&
      CANT.slice(0, 4).every((s) => !wsf(s, 1)) && !wsf("Get-ChildItem: Cannot find path 'C:/x' because it does not exist.", 1) && !wsf(RED[1], 1) &&
      !S.verifyPipeMasked('pwsh -NoProfile -Command "Invoke-Pester -Path tests -CI; exit $LASTEXITCODE"') && !S.verifyPipeMasked('pwsh -NoProfile -Command "$r = Invoke-Pester -PassThru; exit $r.FailedCount"') &&
      S.verifyPipeMasked('pwsh -NoProfile -Command "Get-ChildItem tests | Invoke-Pester"') && !S.verifyPipeMasked("pwsh -NoProfile -Command \"Write-Output 'a|b'\""),
      "1.21.1 languages: a run's summary drops ANSI colour and hyperlink codes (pwsh 7 colours captured output); windowsShellFailure (the --shell bash hint) never reads PowerShell's own messages as cmd.exe failing; the pipe check reads a pwsh -Command script (a real pipe flagged, a quoted '|' not) (got " +
      js([sum]) + ")");

    // 5. spec_complete_task on an _Expect: fail_ task: a Pester run that never ran the test is refused (couldNotRun: output); a
    // Pester red run — the function under test doesn't exist yet — is the red proof.
    const pe = path.join(tmp, "proj-121-pester-red");
    S.initProject(pe, ["core"], "en");
    const fe = S.createFeature(pe, "Farewell", ["core"], "", undefined, "en");
    const PCMD = 'pwsh -NoProfile -Command "Invoke-Pester -Path tests -CI; exit $LASTEXITCODE"';
    fs.writeFileSync(path.join(fe.dir, "tasks.md"), "- [ ] 1. [US1] Write test T-02 and watch it fail\n  - _Verify: " + PCMD + "_\n  - _Expect: fail_\n");
    const notRun = S.completeTask(pe, fe.slug, 1, { command: PCMD, exitCode: 1, summary: "Invoke-Pester: The term 'Invoke-Pester' is not recognized as a name of a cmdlet, function, script file, or executable program." });
    const redRun = S.completeTask(pe, fe.slug, 1, { command: PCMD, exitCode: 1, summary: S.summarizeRunOutput(RED[1]) });
    ok(notRun.ok === false && notRun.couldNotRun === "output" && notRun.recorded === true && /'Invoke-Pester' is not recognized as a name of a cmdlet/.test(notRun.error) &&
      redRun.ok === true && redRun.redRecorded === true && redRun.verified === true,
      "1.21.1 languages: an _Expect: fail_ task — a Pester run whose summary shows Invoke-Pester is unknown is refused (couldNotRun: output); a Pester red run (the function under test not written yet — '[-] …', 'Tests Passed: 0, Failed: 1') is the red proof (got " +
      js([notRun.couldNotRun, notRun.error && notRun.error.slice(0, 160), redRun.ok, redRun.redRecorded]) + ")");

    // 6. Linear on hostile output (the run gate reads up to 200,000 characters of it).
    const N = 100000;
    const t0 = Date.now();
    const hostile = ["[-] " + "x ".repeat(N) + "q", "Expected " + "a".repeat(2 * N), "'".repeat(2 * N), ("is " + " ".repeat(300)).repeat(N / 300) + "not", ("The argument '" + "a".repeat(390) + "' ").repeat(N / 400),
      ("\"" + "a".repeat(199)).repeat(N / 200) + " is not recognized", ESC + "]" + "a".repeat(2 * N), ("Tests Passed: 1, ").repeat(N / 16)];
    const hostileKinds = hostile.map((s) => cnr(s));
    const hostileMs = Date.now() - t0;
    ok(hostileMs < 5000 && hostileKinds.every((k) => k === null),
      "1.21.1 languages: couldNotRunOutput stays linear on 200,000-character hostile outputs (a '[-] ' line with no duration, 'Expected ' runs, quote runs, blank runs between the words) (got " + js([hostileMs, hostileKinds]) + ")");
  }

  // 1.21.1 languages (review) — PowerShell evidence, second round: a POSIX shell expands a pwsh script's `$…`; Pester blocks and
  // files that failed before their tests; PowerShell's own parse errors; every new pattern linear on 200 KB.
  {
    const js = (v) => JSON.stringify(v);
    const E = require("./lib/engine/index.js");
    const ESC = String.fromCharCode(27), BS = String.fromCharCode(92), BT = "`";
    const red = (s) => ESC + "[91m" + s + ESC + "[0m";
    // 1. posixPwshScript — the mirror of posixShellSyntax for a POSIX shell (/bin/sh, bash, Git Bash): `$…` / backticks
    // outside single quotes in a pwsh / powershell script are expanded by the shell first (`exit $LASTEXITCODE` → `exit` → 0).
    const pp = (c) => S.posixPwshScript(c).join("+");
    const PP = [
      ['pwsh -NoProfile -Command "npm test; exit $LASTEXITCODE"', "variable"],
      ['pwsh -c "Get-ChildItem | ForEach-Object { $_.Name }"', "variable"],
      ["pwsh -NoProfile -Command Invoke-Pester -CI; exit $LASTEXITCODE", ""], // `;` ends the pwsh command: `exit $X` is the shell's own
      ["pwsh -NoProfile -Command Invoke-Pester -CI " + BS + "; exit $LASTEXITCODE", "variable"],
      ['FOO=1 pwsh -c "exit $x"', "variable"],
      ['env pwsh -NoProfile -Command "exit $x"', "variable"],
      ['powershell "exit $LASTEXITCODE"', "variable"],
      ['pwsh -c "Write-Output ' + BT + 'date' + BT + '"', "backtick"],
      ["pwsh -NoProfile -Command 'npm test; exit $LASTEXITCODE'", ""],
      ['pwsh -NoProfile -Command "Invoke-Pester -Path tests -CI"', ""],
      ['pwsh -c "exit ' + BS + '$code"', ""],
      ['pwsh -NoProfile -File build.ps1 "$HOME"', ""],
      ['echo "$HOME" && npm test', ""],
      ['npm test && pwsh -NoProfile -Command "exit $LASTEXITCODE"', "variable"],
    ];
    const ppWrong = PP.filter(([c, want]) => pp(c) !== want).map(([c]) => c + " → " + pp(c));
    const rs = (req, platform) => S.resolveRunShell(req, { platform, env: {}, exists: () => false });
    ok(!ppWrong.length && rs("", "linux").posix === true && rs("bash", "linux").posix === true && rs("/usr/bin/zsh", "darwin").posix === true && rs("fish", "linux").posix === true &&
      rs("sh", "win32").posix === true && rs("C:/Program Files/Git/bin/bash.exe", "win32").posix === true && S.resolveRunShell("bash", { platform: "win32", env: {}, gitExecPath: "C:/Git/mingw64/libexec/git-core", exists: (p) => /bin[\\/]bash\.exe$/.test(p) }).posix === true &&
      !rs("", "win32").posix && !rs("cmd", "win32").posix && !rs("pwsh", "linux").posix && !rs("nu", "linux").posix &&
      S.runsPwsh('pwsh -NoProfile -Command "x"') && S.runsPwsh("npm test && powershell.exe -c x") && S.runsPwsh("FOO=1 pwsh -c x") && !S.runsPwsh("echo pwsh") && !S.runsPwsh("npm test"),
      "1.21.1 languages (review): posixPwshScript flags `$…` / backticks a POSIX shell would expand in a pwsh script (double-quoted or bare, after a VAR= or env prefix, powershell's positional command) — never a single-quoted script, `\\$`, a -File argument or `$` outside PowerShell; resolveRunShell marks /bin/sh, bash, zsh, fish, sh and Git Bash posix (never cmd.exe, pwsh, an unknown shell); runsPwsh finds a pwsh program in the line (wrong: " +
      js(ppWrong) + ")");

    // 2. Pester blocks and files that failed BEFORE their tests are could-not-run, alone (outputs captured from Pester 3.4 /
    // 5.9.1 / 6.2.0): a Describe-level BeforeAll ("[-] Describe … failed" + "BeforeAll \ AfterAll failed: 1", no "Container
    // failed"), a test file that doesn't parse ("[-] Discovery in … failed" / "[-] Error occurred in test script"); the summary
    // keeps those lines. A test that ran — an assertion, a missing function, a throw inside It — stays red.
    const cnr = (s) => { const r = S.couldNotRunOutput(s); return r ? r.kind + ":" + r.text.slice(0, 40) : null; };
    const summary5 = (lines) => lines.join("\n");
    const NOTRUN = {
      block5: summary5([red("[-] Describe Get-Greeting failed"), red(" RuntimeException: boom in BeforeAll"), ESC + "[97mTests completed in 753ms" + ESC + "[0m",
        ESC + "[97mTests Passed: 0, " + ESC + "[0m" + ESC + "[91mFailed: 1, " + ESC + "[0m" + ESC + "[90mNotRun: 0" + ESC + "[0m", red("BeforeAll " + BS + " AfterAll failed: 1"), red("  - Get-Greeting")]),
      context6: summary5(["[-] Context when empty failed", " RuntimeException: boom", "Tests Passed: 0, Failed: 2, Skipped: 0, Inconclusive: 0, NotRun: 0", "BeforeAll " + BS + " AfterAll failed: 1"]),
      discovery5: summary5([red("[-] Discovery in C:/p/Syn.Tests.ps1 failed with:"), red("System.Management.Automation.ParseException: At C:/p/Syn.Tests.ps1:1 char:19"),
        "Tests Passed: 0, Failed: 0, Skipped: 0, Inconclusive: 0, NotRun: 0", "Container failed: 1", "  - C:/p/Syn.Tests.ps1"]),
      script3: summary5([" [-] Error occurred in test script 'C:/p/Syn.Tests.ps1' 175ms", "   ParseException: At C:/p/Syn.Tests.ps1:1 char:19", "Tests completed in 175ms",
        "Passed: 0 Failed: 1 Skipped: 0 Pending: 0 Inconclusive: 0"]),
      block3: summary5(["Describing Get-Greeting", " [-] Error occurred in Describe block 318ms", "   RuntimeException: boom", "Passed: 0 Failed: 1 Skipped: 0 Pending: 0 Inconclusive: 0"]),
      summaryOnly: summary5(["Tests completed in 753ms", "Tests Passed: 0, Failed: 1, Skipped: 0, Inconclusive: 0, NotRun: 0", "BeforeAll " + BS + " AfterAll failed: 1", "  - Get-Greeting"]),
    };
    const RAN = {
      throw5: summary5([red("[-] Get-Greeting.T-01 greets") + ESC + "[90m 52ms (35ms|17ms)" + ESC + "[0m", red(" RuntimeException: not implemented"), "Tests Passed: 0, Failed: 1, Skipped: 0, Inconclusive: 0, NotRun: 0"]),
      throw6: summary5(["[-] Get-Greeting.T-01 greets 44ms", " RuntimeException: not implemented", "Tests Passed: 0, Failed: 1, Skipped: 0, Inconclusive: 0, NotRun: 0"]),
      throw3: summary5(["Describing Get-Greeting", " [-] T-01 greets 405ms", "   RuntimeException: not implemented", "Passed: 0 Failed: 1 Skipped: 0 Pending: 0 Inconclusive: 0"]),
      red3: summary5([" [-] T-01 greets 750ms", "   Expected string length 10 but was 5. Strings differ at index 5.", "   Expected: {Hello, Ana}", "   But was:  {Hello}"]),
      mixed: summary5(["[-] Describe Other failed", "[-] Get-Greeting.T-01 greets 44ms", " Expected 'Hello, Ana', but got 'Hello'.", "Tests Passed: 0, Failed: 2", "BeforeAll " + BS + " AfterAll failed: 1"]),
    };
    const notRunWrong = Object.entries(NOTRUN).filter(([, s]) => !/^test:/.test(cnr(s) || "")).map(([k, s]) => k + "=" + cnr(s));
    const ranWrong = Object.entries(RAN).filter(([, s]) => cnr(s) !== null).map(([k, s]) => k + "=" + cnr(s));
    const keptInSummary = S.summarizeRunOutput(["Describing Missing", " [-] Error occurred in Describe block 318ms", "   FileNotFoundException: x", "   at <ScriptBlock>, X.Tests.ps1: line 2",
      "   at Invoke-Blocks, SetupTeardown.ps1: line 134", "   at Invoke-TestGroupSetupBlocks, SetupTeardown.ps1: line 113", "Tests completed in 318ms", "Passed: 0 Failed: 1 Skipped: 0 Pending: 0 Inconclusive: 0"].join("\n"));
    ok(!notRunWrong.length && !ranWrong.length && /\[-\] Error occurred in Describe block/.test(keptInSummary) && /^test:/.test(cnr(keptInSummary) || ""),
      "1.21.1 languages (review): a Pester block's BeforeAll that failed ('[-] Describe … failed', 'BeforeAll \\ AfterAll failed: 1' — Pester 5 / 6), a Context, a test file that doesn't parse ('[-] Discovery in … failed' + 'Container failed', Pester 3's '[-] Error occurred in test script' / 'Describe block') is could-not-run on its own — also as a run summary, which keeps the line; a throw inside It, an assertion red and a mixed run stay red (wrong: " +
      js([notRunWrong, ranWrong, keptInSummary.split("\n")]) + ")");

    // 3. PowerShell's own parse error (the -Command script never ran) — pwshParseFailure, asked by the CLI when PowerShell runs
    // the line; never when a test ran.
    const pf = (s) => (S.pwshParseFailure(s) || {}).text || null;
    const PARSE = [
      "At line:1 char:10\r\n+ npm test && node -e \"process.exit(0)\"\r\n+          ~~\r\nThe token '&&' is not a valid statement separator in this version.\r\n    + CategoryInfo          : ParserError: (:) [], ParentContainsErrorRecordException\r\n    + FullyQualifiedErrorId : InvalidEndOfLine",
      "An expression was expected after '('.\r\n    + CategoryInfo          : ParserError: (:) [], ParentContainsErrorRecordException\r\n    + FullyQualifiedErrorId : ExpectedExpression",
      ESC + "[31;1mParserError: " + ESC + "[0m\n" + ESC + "[31;1m" + ESC + "[36;1mLine |" + ESC + "[0m\n     | " + ESC + "[31;1mUnexpected token ')' in expression or statement." + ESC + "[0m",
    ];
    const NOT_PARSE = ["[-] Parser.T-01 rejects a stray paren 12ms\n Expected 'Unexpected token', but got 'ok'.", "Error: Unexpected token } in JSON at position 3\n1 failing", "npm ERR! Test failed."];
    ok(/^The token '&&' is not a valid statement separator/.test(pf(PARSE[0]) || "") && /ParserError/.test(pf(PARSE[1]) || "") && /^Unexpected token '\)' in expression or statement/.test(pf(PARSE[2]) || "") &&
      NOT_PARSE.every((s) => pf(s) === null),
      "1.21.1 languages (review): pwshParseFailure reads PowerShell's own parse error — 5.1's '&&' separator, its ParserError / FullyQualifiedErrorId, pwsh 7's coloured 'ParserError: … Unexpected token' block — never a Pester test that ran, a JSON parse error or a plain failure (got " +
      js([PARSE.map(pf), NOT_PARSE.map(pf)]) + ")");

    // 4. spec_complete_task on an _Expect: fail_ task: a Pester 5 run whose Describe BeforeAll failed is refused (couldNotRun:
    // output); a throw inside It is the red proof.
    const pe = path.join(tmp, "proj-121-pester-block");
    S.initProject(pe, ["core"], "en");
    const fe = S.createFeature(pe, "Block", ["core"], "", undefined, "en");
    const PCMD = "Invoke-Pester -Path tests -CI";
    fs.writeFileSync(path.join(fe.dir, "tasks.md"), "- [ ] 1. [US1] Write test T-01 and watch it fail\n  - _Verify: " + PCMD + "_\n  - _Expect: fail_\n");
    const blocked = S.completeTask(pe, fe.slug, 1, { command: PCMD, exitCode: 2, summary: S.summarizeRunOutput(NOTRUN.block5) });
    const thrown = S.completeTask(pe, fe.slug, 1, { command: PCMD, exitCode: 1, summary: S.summarizeRunOutput(RAN.throw5) });
    ok(blocked.ok === false && blocked.couldNotRun === "output" && /Describe Get-Greeting failed|BeforeAll/.test(blocked.error) && thrown.ok === true && thrown.redRecorded === true,
      "1.21.1 languages (review): an _Expect: fail_ task — a Pester 5 run whose Describe-level BeforeAll failed is refused (couldNotRun: output), a throw inside It is the red proof (got " +
      js([blocked.couldNotRun, (blocked.error || "").slice(0, 160), thrown.ok, thrown.redRecorded]) + ")");

    // 5. Every new could-not-run / assertion / Pester / parse pattern — and the functions over them — is linear: 200 KB of blanks,
    // digits, quotes or letters after each pattern's own words, or those words repeated, within 1.5 s each.
    const N = 200000;
    const prefixes = ["is not recognized as a name of a", "is not recognized", "não é reconhecido como nome de", "não é reconhecido como", "no se reconoce como nombre de",
      "'x'", "\"x\"", "The specified module 'x'", "O módulo especificado 'x'", "No se cargó el módulo especificado", "cannot be loaded because running scripts is",
      "porque a execução de scripts está", "porque la ejecución de scripts está", "is not digitally signed.", "The argument 'x'", "No test files were found",
      "[-]", "[-] a", "[-] a 1ms", "[-] a 1", "[-] Describe a", "[-] Context a", "[-] Discovery in", "Expected a", "Expected a,", "But was:", "Tests Passed: 1,", "Passed: 1",
      "Container failed:", "BeforeAll " + BS + " AfterAll failed:", "+ CategoryInfo", "FullyQualifiedErrorId", "FullyQualifiedErrorId : MissingEndParenthesisIn",
      "ParserError", "Unexpected token '", "Missing closing '", "is not a valid statement", ESC + "[", ESC + "]"];
    const fills = [" ", "\t", "1", "a", "'", "."];
    const inputs = [];
    for (const p of prefixes) {
      for (const f of fills) inputs.push(p + f.repeat(N) + "x");
      inputs.push((p + " ").repeat(Math.ceil(N / (p.length + 1))));
    }
    const pats = [...E.CANT_RUN_OUTPUT.map(([k, re], i) => ["CANT_RUN_OUTPUT[" + i + "] " + k, re]), ["RE_ASSERTION_RAN", E.RE_ASSERTION_RAN], ["RE_PESTER_FAILED", E.RE_PESTER_FAILED],
      ["RE_PESTER_NOT_RUN", E.RE_PESTER_NOT_RUN], ["RE_PWSH_PARSE_FAILURE", E.RE_PWSH_PARSE_FAILURE], ["RE_ANSI", new RegExp(E.RE_ANSI.source, "")]];
    const slow = [];
    let worst = 0;
    for (const [name, re] of pats) {
      for (const s of inputs) {
        const t0 = Date.now();
        re.test(s);
        const ms = Date.now() - t0;
        worst = Math.max(worst, ms);
        if (ms > 1500) slow.push(name + " @ " + js(s.slice(0, 30)) + " " + ms + " ms");
      }
    }
    const fnSlow = [];
    for (const [name, fn] of [["couldNotRunOutput", S.couldNotRunOutput], ["pwshParseFailure", S.pwshParseFailure], ["summarizeRunOutput", (s) => S.summarizeRunOutput(s)],
      ["posixPwshScript", S.posixPwshScript], ["posixShellSyntax", S.posixShellSyntax], ["runsPwsh", S.runsPwsh]]) {
      for (const s of inputs.filter((_, i) => i % 3 === 0)) {
        const t0 = Date.now();
        fn(s);
        const ms = Date.now() - t0;
        if (ms > 1500) fnSlow.push(name + " @ " + js(s.slice(0, 30)) + " " + ms + " ms");
      }
    }
    ok(!slow.length && !fnSlow.length,
      "1.21.1 languages (review): every new could-not-run, assertion, Pester and parse pattern (" + pats.length + ") and couldNotRunOutput / pwshParseFailure / summarizeRunOutput / posixPwshScript / posixShellSyntax / runsPwsh stay linear on " +
      inputs.length + " hostile 200 KB inputs (each within 1.5 s; the pt/es 'not recognized' pattern took 58 s before) (got " + js({ worst, slow: slow.slice(0, 5), fnSlow: fnSlow.slice(0, 5) }) + ")");
  }

  // 1.21.1 languages (review 2) — a mixed Pester run's summary keeps the sign a test ran; posixPwshScript's redirections,
  // comments, wrappers with options and nested POSIX scripts.
  {
    const js = (v) => JSON.stringify(v);
    const ESC = String.fromCharCode(27), BS = String.fromCharCode(92);
    const red = (s) => ESC + "[91m" + s + ESC + "[0m";
    // A. A real red Pester run where ANOTHER block's BeforeAll failed (outputs as Pester 6.2.0 / 5.9.1 print them, paths
    // shortened): the summary kept the NOT_RUN line and the tail but dropped "[-] Greeter.T-01 … 121ms", so the stored summary
    // read "never ran" — the red proof refused. Now it keeps the first line that shows a test ran. E: a test whose thrown
    // message quotes "[-] Describe Foo failed" is the same case.
    const stack = (n) => Array.from({ length: n }, (_, i) => " at Invoke-Step" + i + ", C:/p/Pester/Pester.psm1: line " + (100 + i));
    const MIXED = {
      pester6: ["Running tests from 2 files.", "[-] Describe Broken failed",
        " FileNotFoundException: The specified module 'NoSuchModuleXyz' was not loaded because no valid module file was found in any module directory.",
        " at <ScriptBlock>, C:/p/tests/A.Tests.ps1:2", "[-] Greeter.T-01 greets by name 121ms", " Expected strings to be the same, but they were different.",
        " Expected length: 10", " Actual length:   5", " Strings differ at index 5.", " Expected: 'Hello, Ana'", " But was:  'Hello'", "            -----^",
        " at It 'T-01 greets by name' { 'Hello' | Should -Be 'Hello, Ana' }, C:/p/tests/B.Tests.ps1:2", "Tests completed in 967ms",
        "Tests Passed: 0, Failed: 2, Skipped: 0, Inconclusive: 0, NotRun: 0", "BeforeAll " + BS + " AfterAll failed: 1", "  - Broken"].join("\n"),
      pester5: ["Starting discovery in 2 files.", "Discovery found 2 tests in 193ms.", "Running tests.",
        red("[-] Greeter.T-01 greets by name") + ESC + "[90m 161ms (132ms|30ms)" + ESC + "[0m", red(" Expected strings to be the same, but they were different."),
        ...stack(30), red("[-] Describe Broken failed"), red(" FileNotFoundException: The specified module 'NoSuchModuleXyz' was not loaded."), ...stack(12),
        "Tests completed in 988ms", ESC + "[97mTests Passed: 0, " + ESC + "[0m" + ESC + "[91mFailed: 2, " + ESC + "[0m" + "Skipped: 0, Inconclusive: 0, NotRun: 0",
        red("BeforeAll " + BS + " AfterAll failed: 1"), red("  - Broken")].join("\r\n"),
      quoted: ["[-] Quoter.T-05 quotes 38ms", " RuntimeException: line one", " [-] Describe Foo failed", " line three", " at <ScriptBlock>, C:/p/tests/Q.Tests.ps1:2",
        "Tests completed in 754ms", "Tests Passed: 0, Failed: 1, Skipped: 0, Inconclusive: 0, NotRun: 0"].join("\n"),
    };
    const sums = Object.fromEntries(Object.entries(MIXED).map(([k, s]) => [k, S.summarizeRunOutput(s)]));
    const aWrong = Object.keys(MIXED).filter((k) => S.couldNotRunOutput(MIXED[k]) !== null || S.couldNotRunOutput(sums[k]) !== null || sums[k].length > 500);
    // still refused: the same run with no test that ran (the block's BeforeAll failed, nothing else) — its summary too
    const onlyBlock = ["[-] Describe Broken failed", " FileNotFoundException: x", ...stack(20), "Tests completed in 500ms",
      "Tests Passed: 0, Failed: 1, Skipped: 0, Inconclusive: 0, NotRun: 0", "BeforeAll " + BS + " AfterAll failed: 1", "  - Broken"].join("\n");
    ok(!aWrong.length && /\[-\] Greeter\.T-01 greets by name 121ms/.test(sums.pester6) && /\[-\] Greeter\.T-01 greets by name 161ms/.test(sums.pester5) &&
      /\[-\] Quoter\.T-05 quotes 38ms/.test(sums.quoted) && /BeforeAll \\ AfterAll failed: 1/.test(sums.pester6) &&
      /^test:/.test(((r) => (r ? r.kind + ":" : ""))(S.couldNotRunOutput(S.summarizeRunOutput(onlyBlock)))),
      "1.21.1 languages (review 2): a mixed Pester run — one block's BeforeAll failed, another block's test failed on its assertion (Pester 6 and a coloured Pester 5 with 30 stack lines between), or a thrown message quoting '[-] Describe Foo failed' — is red, and its summary keeps the '[-] <test> 121ms' line (≤ 500 characters) so the summary reads red too; a run where only the block failed is still could-not-run, summary included (wrong: " +
      js([aWrong, sums]) + ")");

    // …and wherever a stored summary is re-read: spec_complete_task (MCP) on an _Expect: fail_ task records each as the red
    // proof — the CLI's summary or the agent's own copy of the output; the block-only run is refused (couldNotRun: output).
    const pm = path.join(tmp, "proj-121-mixed-pester");
    S.initProject(pm, ["core"], "en");
    const fm = S.createFeature(pm, "Mixed", ["core"], "", undefined, "en");
    const PCMD = "Invoke-Pester -Path tests -CI";
    fs.writeFileSync(path.join(fm.dir, "tasks.md"), [1, 2, 3, 4, 5].map((n) => "- [ ] " + n + ". [US1] Write test T-0" + n + " and watch it fail\n  - _Verify: " + PCMD + "_\n  - _Expect: fail_\n").join(""));
    const mc = async (n, summary) => payload(await rpc("tools/call", { name: "spec_complete_task", arguments: { projectDir: pm, name: fm.slug, number: n, evidence: { command: PCMD, exitCode: 3, summary } } }));
    const r1 = await mc(1, sums.pester6);
    const r2 = await mc(2, sums.pester5);
    const r3 = await mc(3, MIXED.pester6); // the output itself as the summary (≤ 2,000 characters are kept)
    const r4 = await mc(4, sums.quoted);
    const r5 = await mc(5, S.summarizeRunOutput(onlyBlock));
    ok([r1, r2, r3, r4].every((r) => r.ok === true && r.redRecorded === true) && r5.ok === false && r5.couldNotRun === "output",
      "1.21.1 languages (review 2): MCP spec_complete_task on _Expect: fail_ tasks records a mixed Pester run's summary (Pester 6, coloured Pester 5, the raw output, the quoted '[-] Describe' message) as the red proof; the block-only run is still refused (couldNotRun: output) (got " +
      js([r1, r2, r3, r4].map((r) => [r.ok, r.redRecorded, r.couldNotRun, (r.error || "").slice(0, 120)]).concat([[r5.ok, r5.couldNotRun]])) + ")");

    // C. posixPwshScript (a POSIX shell running pwsh): a redirection's target (`> "$OUT"`, `2> "$ERR"`, `&>`) and a comment
    // (`# $x`) are the outer shell's — never flagged; a wrapper with its options and positionals (sudo -u root, timeout 60,
    // nice -n 10, doas, nohup time) before pwsh no longer hides its script; a POSIX shell's own -c script is read in turn
    // (`bash -c "pwsh -c \"$x\""`, `bash -c 'pwsh -c "$x"'`). A `$PWD` in the script is still refused (accepted: rewrite it).
    const pp = (c) => S.posixPwshScript(c).join("+");
    const PP = [
      ['pwsh -c "1+1" > "$OUT"', ""], ['pwsh -c "1+1" 2> "$ERR"', ""], ['pwsh -c "1+1" &> "$OUT"', ""], ['pwsh -c "1+1" 2>&1 | tee "$LOG"', ""],
      ['pwsh -c "exit 0" # $comment', ""], ['pwsh -c "exit 0" #$comment', ""], ['echo "#" "$HOME"', ""],
      ['pwsh -NoProfile 2>/dev/null -Command "exit $x"', "variable"], ['pwsh -c "Write-Output a#b $x"', "variable"],
      ['sudo pwsh -c "$x"', "variable"], ['sudo -u root pwsh -c "$x"', "variable"], ['timeout 60 pwsh -c "$x"', "variable"], ['timeout -s KILL 60 pwsh -c "$x"', "variable"],
      ['nice -n 10 pwsh -c "$x"', "variable"], ['nohup time pwsh -c "$x"', "variable"], ['doas -u me pwsh -c "$x"', "variable"], ["sudo pwsh -c 'exit $x'", ""],
      ['bash -c "pwsh -c ' + BS + '"$x' + BS + '""', "variable"], ["bash -c 'pwsh -c \"$x\"'", "variable"], ["sh -c 'sudo pwsh -c \"exit $LASTEXITCODE\"'", "variable"],
      ["bash -c 'pwsh -c \"exit 0\" > \"$OUT\"'", ""], ["bash -c 'pwsh -c '\"'\"'exit $x'\"'\"''", ""], ["sh -c 'echo $HOME'", ""],
      ['pwsh -c "Invoke-Pester -Path $PWD/tests"', "variable"],
    ];
    const ppWrong = PP.filter(([c, want]) => pp(c) !== want).map(([c]) => c + " → " + pp(c));
    const RP = [["sudo -u root pwsh -c x", true], ["timeout 60 pwsh -c x", true], ["nice -n 5 powershell -c x", true], ["sudo echo pwsh", false], ["timeout 60 npm test", false]];
    const rpWrong = RP.filter(([c, want]) => S.runsPwsh(c) !== want).map(([c]) => c);
    const VP = [['sudo bash -c "npm test | tee x"', true], ['timeout 60 sh -c "a | b"', true], ['env -u X bash -c "a | b"', true], ['sudo -u root bash -c "a | b"', true],
      ['nice -n 10 bash -c "a || b"', false]];
    const vpWrong = VP.filter(([c, want]) => S.verifyPipeMasked(c) !== want).map(([c]) => c);
    // …and linear: 200,000 characters of wrappers, options, redirections, fd numbers, comments or nested shells
    const N = 200000;
    const HOSTILE = ["sudo ".repeat(N / 5) + 'pwsh -c "$x"', "timeout " + "-s ".repeat(N / 3) + 'pwsh -c "$x"', 'pwsh -c "x" ' + "> ".repeat(N / 2), 'pwsh -c "x" ' + "2".repeat(N) + ">",
      "# ".repeat(N / 2), ("bash -c '").repeat(N / 9), ("sh -c " + BS + '"').repeat(N / 8), 'pwsh -c "' + "$".repeat(N) + '"', ("pwsh -c " + '"$x" ; ').repeat(N / 16)];
    const slowC = [];
    for (const [name, fn] of [["posixPwshScript", S.posixPwshScript], ["runsPwsh", S.runsPwsh], ["verifyPipeMasked", S.verifyPipeMasked], ["posixShellSyntax", S.posixShellSyntax]]) {
      for (const s of HOSTILE) { const t0 = Date.now(); fn(s); const ms = Date.now() - t0; if (ms > 1500) slowC.push(name + " @ " + js(s.slice(0, 24)) + " " + ms + " ms"); }
    }
    ok(!ppWrong.length && !rpWrong.length && !vpWrong.length && !slowC.length,
      "1.21.1 languages (review 2): posixPwshScript leaves a redirection's target, an fd number and a comment to the outer shell, reads pwsh's script behind sudo / doas / timeout / nice / nohup / time and their options, and follows a POSIX shell's -c script (bash -c \"pwsh -c \\\"$x\\\"\" is refused); runsPwsh and verifyPipeMasked skip the same wrappers; all linear on 200,000-character inputs (wrong: " +
      js([ppWrong, rpWrong, vpWrong, slowC]) + ")");
  }

  // 1.22 review (finding 1) — the run must BE a run of the task's _Verify:_ (or of the check's command): `echo hello` with exit 0
  // verified a task whose _Verify:_ is `npm test`, `echo ok` passed check test (`npm test`), an observed run of another task's
  // command was accepted. Now: command-mismatch (ticked, unverified) / changed (the finish check).
  {
    const js = JSON.stringify;
    // (review 3: a run's own cd counts only when it ends at the project root — the fourth argument; `cd sub; npm test` runs npm
    // test in sub/, no run of the root's `npm test`)
    const PV = (cmd, verify, extra, root) => S.runProvesVerify({ command: cmd, ...extra }, verify, root);
    const rootOf = (c) => { const m = /^cd (?:\/d )?"?([^"&;]*?)"? *(?:&&|;)/.exec(c); return m ? m[1] : undefined; };
    const yes = ["npm test", "  npm   test ", "`npm test`", '"npm test"', "'npm test'", "cd /x/y && npm test", 'cd "C:/My Proj" && npm test', "cd /d C:\\x && npm test",
      "set -o pipefail; npm test", "set -euo pipefail; npm test", "set -e -o pipefail && npm test", "CI=1 npm test", 'NODE_ENV="test" CI=1 npm test', "npm test 2>&1",
      "cd /x && CI=1 npm test 2>&1", "npm run test", "npm t"]; // (review 5: npm's own aliases of `npm test`)
    const no = ["echo hello", "npm test -- --grep x", "npm run test:unit", "npm test; echo ok", "npm test || true", "npm test | tee log", "echo npm test", "cd x", "npm test && echo ok",
      "npm testing", "", "node -e \"process.exit(0)\"", "cd sub; npm test"];
    const two = ["npm test", "npm run lint"];
    // (review 2: "npm run lint" alone used to prove both — a run must cover EVERY _Verify:_ command of the task, see below)
    const pvWrong = yes.filter((c) => !PV(c, ["npm test"], {}, rootOf(c))).map((c) => "refused: " + c).concat(no.filter((c) => PV(c, ["npm test"], {}, "/r")).map((c) => "accepted: " + c))
      .concat(["npm test && npm run lint", "cd /p && npm run lint && npm test"].filter((c) => !PV(c, two, {}, "/p")).map((c) => "refused (2): " + c))
      .concat(["npm test && echo x", "npm test && npm run lint && rm -rf x", "npm run lint"].filter((c) => PV(c, two)).map((c) => "accepted (2): " + c));
    ok(!pvWrong.length && PV("anything at all", ["npm test"], { observed: "cli" }) && !PV("echo hi", ["npm test"], { observed: true }),
      "1.22 review: runProvesVerify — a run proves a _Verify:_ only when it runs its commands (all of them): whitespace / backticks / surrounding quotes, a leading cd <dir> && · set -o pipefail; · VAR=value and a trailing 2>&1 are fine, the ` && ` join of its commands too, and the CLI's own run (observed \"cli\"); anything else is not (wrong: " + js(pvWrong) + ")");

    const pM = path.join(tmp, "proj-122-mismatch");
    S.initProject(pM, ["core"], "en", { checks: { test: "npm test" } });
    const fM = S.createFeature(pM, "Proof", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(fM.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] A\n  - _Verify: npm test_\n- [ ] 2. [US1] B\n  - _Verify: npm test_\n" +
      "- [ ] 3. [US1] C\n  - _Verify: npm test_\n  - _Verify: npm run lint_\n- [ ] 4. [US1] Red first\n  - _Verify: node t01.js_\n  - _Expect: fail_\n- [ ] 5. [US1] D\n  - _Verify: npm test_\n");
    const m1 = S.completeTask(pM, "proof", 1, { command: "echo hello", exitCode: 0 });
    const m2 = S.completeTask(pM, "proof", 2, { command: "cd " + pM + " && CI=1 npm test", exitCode: 0, summary: "3 passing" });
    const m3 = S.completeTask(pM, "proof", 3, { command: "npm test && npm run lint", exitCode: 0 }, { ranBy: "cli" });
    const doc = S.specDoctor(pM, "proof").checks.find((c) => c.id === "verification");
    const st = S.statusFeature(pM, "proof").tasks.list;
    ok(m1.ok && m1.verified === false && m1.unverifiedReason === "command-mismatch" && /the run recorded \(`echo hello`\) is not a run of its _Verify:_ command \(npm test\) — it is ticked/.test(m1.note) &&
      /done proof 1 --run/.test(m1.note) && m2.verified === true && !m2.unverifiedReason && m3.verified === true &&
      doc && /#1 \(the run recorded is not its _Verify:_ command\)/.test(doc.detail) && !/#2|#3/.test(doc.detail) && st[0].verified === false && st[1].verified === true &&
      S.finishFeature(pM, "proof").blockers.some((b) => /#1 \(the run recorded is not its _Verify:_ command\)/.test(b)),
      "1.22 review: spec_complete_task with a run of ANOTHER command than the task's _Verify:_ ticks it but leaves it unverified — unverifiedReason command-mismatch + a note; doctor, status and finish say so; a cd / env prefix and the CLI's join verify (got " +
      js([m1.unverifiedReason, m1.note, m2.unverifiedReason, m3.unverifiedReason, doc && doc.detail]) + ")");

    // _Expect: fail_: a red run of another command ticks, but is no red proof — and never displaces the real one later.
    const r1 = S.completeTask(pM, "proof", 4, { command: "node -e \"process.exit(1)\"", exitCode: 1, summary: "1 failing" });
    const r2 = S.completeTask(pM, "proof", 4, { command: "node t01.js", exitCode: 1, summary: "not ok 1 T-01" });
    const r3 = S.completeTask(pM, "proof", 4, { command: "node -e \"process.exit(2)\"", exitCode: 2, summary: "1 failing" });
    const r4 = S.completeTask(pM, "proof", 4, { command: "node t01.js", exitCode: 0, summary: "ok 1 T-01" });
    const rec4 = JSON.parse(fs.readFileSync(path.join(fM.dir, ".state.json"), "utf8")).evidence["4"];
    ok(r1.ok && r1.verified === false && r1.unverifiedReason === "command-mismatch" && !r1.redRecorded && /until a FAILING run of that command/.test(r1.note) &&
      r2.ok && r2.verified === true && r2.redRecorded === true && r3.ok && r3.verified === true && !r3.redRecorded && r4.ok && r4.verified === true &&
      rec4.red && rec4.red.command === "node t01.js",
      "1.22 review: an _Expect: fail_ task — a red run of another command ticks it (command-mismatch, no redRecorded); the red run of its _Verify:_ is the proof, a later red run of another command never displaces it, and the fix's pass keeps it (got " +
      js([r1.unverifiedReason, r2.verified, r3.verified, r4.verified, rec4.red]) + ")");

    // finish: a run of another command than the configured check reads `changed`; the check's own command (a cd prefix) passes.
    const fin1 = S.finishFeature(pM, "proof", { evidence: [{ name: "test", command: "echo ok", exitCode: 0 }] });
    const fin2 = S.finishFeature(pM, "proof", { evidence: [{ name: "test", command: "cd " + pM + " && npm test", exitCode: 0 }] });
    ok(fin1.ok && fin1.suiteChecks.find((c) => c.name === "test").status === "changed" && fin1.blockers.some((b) => /test \(the run is not of its command/.test(b)) &&
      fin2.ok && fin2.suiteChecks.find((c) => c.name === "test").status === "pass",
      "1.22 review: spec_finish {evidence} — a check's run of ANOTHER command (`echo ok` for `npm test`) reads changed and blocks; the check's command itself passes (got " +
      js([fin1.suiteChecks, fin2.suiteChecks]) + ")");

    // observed mode: an observed run of another task's / check's command is not this one's.
    S.observeRun(pM, { command: "npm run lint", exitCode: 0 });
    // (review 2: one of two expected commands alone is no run of the task's _Verify:_ any more — false; the lint task's own: true)
    const look = [S.observedRun(pM, "proof", "npm run lint", 0).observed, S.observedRun(pM, "proof", "npm run lint", 0, { expected: ["npm test"] }).observed,
      S.observedRun(pM, "proof", "npm run lint", 0, { expected: two }).observed, S.observedRun(pM, "proof", "npm run lint", 0, { expected: ["npm run lint"] }).observed];
    S.initProject(pM, ["core"], "en", { evidence: "observed" });
    const o5 = S.completeTask(pM, "proof", 5, { command: "npm run lint", exitCode: 0 });
    ok(js(look) === js([true, false, false, true]) && o5.ok && o5.observed === false && o5.verified === false && o5.unverifiedReason === "command-mismatch",
      "1.22 review: observedRun looks up the EXPECTED command — another task's observed run (npm run lint) is not observed for a task whose _Verify:_ is npm test; under meta.evidence observed it neither verifies nor counts as observed (got " +
      js([look, o5.observed, o5.unverifiedReason]) + ")");

    // PT / ES wording.
    const fP = S.createFeature(pM, "Prova", ["core"], "", undefined, "pt"), fE = S.createFeature(pM, "Prueba", ["core"], "", undefined, "es");
    for (const f of [fP, fE]) fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] x\n  - _Verify: npm test_\n");
    S.initProject(pM, ["core"], "en", { evidence: "reported" });
    const mP = S.completeTask(pM, "prova", 1, { command: "echo ola", exitCode: 0 }), mE = S.completeTask(pM, "prueba", 1, { command: "echo hola", exitCode: 0 });
    ok(mP.unverifiedReason === "command-mismatch" && /a execução registada \(`echo ola`\) não é uma execução do seu comando _Verify:_/.test(mP.note) &&
      mE.unverifiedReason === "command-mismatch" && /la ejecución registrada \(`echo hola`\) no es una ejecución de su comando _Verify:_/.test(mE.note),
      "1.22 review: the command-mismatch note in PT / ES (got " + js([mP.note, mE.note]) + ")");
  }

  // 1.22 review 2 — the evidence rule's own defects (command-mismatch): a Windows report of an _Expect: fail_ task's red run left
  // it stuck for good once the fix was in; a long command was cut BEFORE the comparison; a _Verify:_ holding ` && ` broke the
  // documented join; a prefix the _Verify:_ holds counted for nothing; one of two _Verify:_ commands proved both.
  {
    const js = JSON.stringify;
    const BS = String.fromCharCode(92);
    const PV = (cmd, verify, root) => S.runProvesVerify({ command: cmd }, verify, root); // (review 3: root — the project folder a run's cds resolve from)
    const wrongOf = (cases) => cases.filter(([c, v, want, root]) => PV(c, v, root) !== want).map(([c, v, want]) => (want ? "refused: " : "accepted: ") + c + " vs " + js(v));
    const mkTasks = (p, slug, tasks) => {
      const f = S.createFeature(p, slug, ["core"], "", undefined, "en");
      fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n" + tasks);
      return f;
    };
    const pR = path.join(tmp, "proj-122r2-evidence");
    S.initProject(pR, ["core"], "en", { checks: { api: "cd packages/api && npm test", long: "node --test " + "tests/unit/a-long-test-file-name.test.js ".repeat(11).trim() } });

    // 1a — `\` for `/`, quotes around a plain argument: the same command.
    const w1 = wrongOf([["node --test tests" + BS + "x.test.js", ["node --test tests/x.test.js"], true], ['node --test "tests/x.test.js"', ["node --test tests/x.test.js"], true],
      ["node --test 'tests/x.test.js'", ["node --test tests" + BS + "x.test.js"], true], ['node --test "tests/x.test.js"', ['node --test "tests/x.test.js"'], true],
      ["node -e process.exit(1)", ['node -e "process.exit(1)"'], false], ['node --test "tests/a b.test.js"', ["node --test tests/a b.test.js"], false]]);
    const fA = mkTasks(pR, "Stuck", "- [ ] 1. [US1] Write the failing regression test T-01 and watch it fail\n  - _Verify: node --test tests/x.test.js_\n  - _Expect: fail_\n" +
      "- [ ] 2. [US1] Fix it\n  - _Verify: node --test tests/x.test.js_\n");
    const a1 = S.completeTask(pR, "stuck", 1, { command: "node --test tests" + BS + "x.test.js", exitCode: 1, summary: "not ok 1 - T-01" });
    ok(!w1.length && a1.ok && a1.verified === true && a1.redRecorded === true,
      "1.22 review 2 (1a): `\\` for `/` and quotes around a plain argument don't make another command — an _Expect: fail_ task's red run reported as `node --test tests\\x.test.js` is its red proof (got " + js([w1, a1.verified, a1.unverifiedReason]) + ")");

    // 1b — a red run of another form already on record from BEFORE the command rule (pre-1.22: no `cmdRule` stamp — simulated by
    // removing it): the passing run of the _Verify:_ itself — the fix going green — accepts it (grandfathering); a pass of ANOTHER
    // command still doesn't.
    const fB = mkTasks(pR, "Upgrade", "- [ ] 1. [US1] Write the failing regression test T-01 and watch it fail\n  - _Verify: node --test tests/x.test.js_\n  - _Expect: fail_\n" +
      "- [ ] 2. [US1] Fix it\n  - _Verify: node --test tests/x.test.js_\n- [ ] 3. [US1] Red, too\n  - _Verify: node --test tests/y.test.js_\n  - _Expect: fail_\n" +
      "- [ ] 4. [US1] Red, three\n  - _Verify: node --test tests/z.test.js_\n  - _Expect: fail_\n- [ ] 5. [US1] Red, four\n  - _Verify: node --test tests/w.test.js_\n  - _Expect: fail_\n");
    const preRule = (dir, n) => { // the record as a pre-1.22 engine wrote it: no cmdRule on any run
      const sf = path.join(dir, ".state.json"), st = JSON.parse(fs.readFileSync(sf, "utf8")), rec = st.evidence[String(n)];
      for (const r of [rec, rec.red, ...(rec.history || [])]) if (r) delete r.cmdRule;
      fs.writeFileSync(sf, JSON.stringify(st, null, 2));
    };
    const b1 = S.completeTask(pR, "upgrade", 1, { command: "node --test --test-reporter=spec tests/x.test.js", exitCode: 1, summary: "not ok 1 - T-01" });
    preRule(fB.dir, 1);
    // task 5: a could-not-run run between the red run (of another form) and the fix's pass never drops that red run
    S.completeTask(pR, "upgrade", 5, { command: "node --test --test-reporter=tap tests/w.test.js", exitCode: 1, summary: "not ok 1" });
    preRule(fB.dir, 5);
    const b5c = S.completeTask(pR, "upgrade", 5, { command: "node --test tests/w.test.js", exitCode: 127, summary: "node: not found" });
    const b5g = S.completeTask(pR, "upgrade", 5, { command: "node --test tests/w.test.js", exitCode: 0, summary: "ok 1" });
    S.completeTask(pR, "upgrade", 2, { command: "node --test tests/x.test.js", exitCode: 0, summary: "ok 1 - T-01" }, { ranBy: "cli" });
    const b1g = S.completeTask(pR, "upgrade", 1, { command: "node --test tests/x.test.js", exitCode: 0, summary: "ok 1 - T-01" }, { ranBy: "cli", startedAt: new Date().toISOString(), ranVerify: ["node --test tests/x.test.js"] });
    const recB = JSON.parse(fs.readFileSync(path.join(fB.dir, ".state.json"), "utf8")).evidence["1"];
    S.completeTask(pR, "upgrade", 3, { command: "node --test --test-reporter=tap tests/y.test.js", exitCode: 1, summary: "not ok 1" });
    preRule(fB.dir, 3);
    const b3g = S.completeTask(pR, "upgrade", 3, { command: "node --test tests/y.test.js", exitCode: 0, summary: "ok 1" }); // reported (MCP), the _Verify:_ itself
    S.completeTask(pR, "upgrade", 4, { command: "node --test --test-reporter=tap tests/z.test.js", exitCode: 1, summary: "not ok 1" });
    preRule(fB.dir, 4);
    const b4x = S.completeTask(pR, "upgrade", 4, { command: "echo ok", exitCode: 0 }); // a pass of ANOTHER command: no grandfathering
    const unB = S.verificationStatus(pR, "upgrade", fB.dir).unverifiedDetail;
    const finB = S.finishFeature(pR, "upgrade").blockers.filter((b) => /without verification evidence/.test(b));
    const undoB = S.completeTask(pR, "upgrade", 1, undefined, { undo: true });
    ok(b1.verified === false && b1.unverifiedReason === "command-mismatch" && b1g.ok && b1g.verified === true && !b1g.unverifiedReason && recB.red && recB.red.exitCode === 1 &&
      b3g.ok && b3g.verified === true && b4x.ok === false && b4x.unexpectedPass === true && js(unB.map((d) => [d.number, d.reason])) === js([[4, "unexpected-pass"]]) &&
      finB.length === 1 && /#4/.test(finB[0]) && !/#1|#3|#5/.test(finB[0]) && undoB.ok && undoB.redKept === true && b5c.ok === false && b5c.couldNotRun === "exit-code" &&
      b5g.ok && b5g.verified === true,
      "1.22 review 2 (1b): an _Expect: fail_ task whose red run is on record as another command is no longer stuck once the fix is in — the passing run of its _Verify:_ (done --run, or reported) is the fix going green and keeps that red run (an exit 127 in between doesn't drop it); a pass of another command is still unexpected-pass; undo keeps it (redKept) (got " +
      js([b1.unverifiedReason, b1g.error || b1g.verified, recB.red, b3g.error || b3g.verified, b4x.unverifiedReason || b4x.error, unB, undoB.redKept, b5c.couldNotRun, b5g.error || b5g.verified]) + ")");

    // 1c — the _Expect: fail_ command-mismatch note: the red run BEFORE the fix lands; (review 3) a red run of another command never
    // counts — it no longer says "record the passing run … the red run on record then counts" (the grandfathering it advertised
    // verified a task with no red run of its own test).
    const notes = ["en", "pt", "es", "pt-BR"].map((l) => S.msg(l).evidenceGate.commandMismatch(1, "f", "x", "y", true));
    ok(/BEFORE the fix lands, while the test still fails: .*done upgrade 1 --run \(a red run of another command never counts; with the fix already in, set it aside — git stash push -- <the fix's files>, not a bare git stash: it would take tasks\.md and \.state\.json too — for that run, then restore it\)\.$/.test(b1.note) &&
      !notes.some((t) => /then counts|passa então a contar|cuenta entonces/.test(t)) &&
      /ANTES de a correção entrar.*nunca conta; com a correção já feita, põe-na de parte — git stash push -- <os ficheiros da correção>, não um git stash simples: levaria também o tasks\.md e o \.state\.json/.test(notes[1]) &&
      /ANTES de que entre la corrección.*nunca cuenta; con la corrección ya hecha, apártala — git stash push -- <los ficheros de la corrección>, no un git stash a secas: se llevaría también tasks\.md y \.state\.json/.test(notes[2]) &&
      /nunca conta/.test(notes[3]) && /git stash push -- <os arquivos da correção>/.test(notes[3]) &&
      !/BEFORE the fix lands/.test(S.msg("en").evidenceGate.commandMismatch(1, "f", "x", "y", false)),
      "1.22 review 3 (1) + review 4: the _Expect: fail_ command-mismatch note says to record the failing run BEFORE the fix lands, that a red run of another command never counts (the fix set aside with `git stash push -- <the fix's files>` — a bare git stash takes tasks.md and .state.json too), and no longer that the red run on record counts once the _Verify:_ passes (EN/PT/ES/pt-BR) (got " + js([b1.note, notes]) + ")");
    // review 3 (1) — grandfathering only for red runs recorded BEFORE the command rule: every run is stamped `cmdRule` now, and a red run
    // of ANOTHER test file (or `false`) recorded under the rule, then the passing run of the _Verify:_, is no red proof — unexpected-pass.
    const fG = mkTasks(pR, "Grand", "- [ ] 1. [US1] Red A\n  - _Verify: npm test -- tests/a.test.js_\n  - _Expect: fail_\n" +
      "- [ ] 2. [US1] Red B\n  - _Verify: npm test -- tests/b.test.js_\n  - _Expect: fail_\n");
    const g1 = S.completeTask(pR, "grand", 1, { command: "npm test -- tests/other.test.js", exitCode: 1, summary: "not ok 1", cmdRule: null });
    const g1p = S.completeTask(pR, "grand", 1, { command: "npm test -- tests/a.test.js", exitCode: 0, summary: "ok 1" });
    const g2 = S.completeTask(pR, "grand", 2, { command: "false", exitCode: 1 });
    const g2p = S.completeTask(pR, "grand", 2, { command: "npm test -- tests/b.test.js", exitCode: 0 });
    const recG = JSON.parse(fs.readFileSync(path.join(fG.dir, ".state.json"), "utf8")).evidence;
    const unG = S.verificationStatus(pR, "grand", fG.dir).unverifiedDetail.map((d) => [d.number, d.reason]);
    ok(g1.ok && g1.unverifiedReason === "command-mismatch" && g1p.ok === false && g1p.unexpectedPass === true && g2.ok && g2p.ok === false && g2p.unexpectedPass === true &&
      [recG["1"], recG["2"]].every((r) => r.cmdRule === 1 && r.history.every((h) => h.cmdRule === 1) && !r.red) && js(unG) === js([[1, "unexpected-pass"], [2, "unexpected-pass"]]),
      "1.22 review 3 (1): a red run of another test file (or `false`) recorded under the command rule (cmdRule: 1 on every run, a caller's value ignored), then the passing run of the _Verify:_, is NO red proof — refused as unexpected-pass, nothing carried as `red`, both tasks unverified (got " +
      js([g1.unverifiedReason, g1p.error || g1p.verified, g2p.error || g2p.verified, recG["1"], unG]) + ")");

    // 2 — a long command is compared whole (it was cut at 500 first): a faithful report of a long _Verify:_, a join past 500, a
    // finish run with a cd in front of a long check.
    const longV = "node --test " + Array.from({ length: 40 }, (_, i) => "tests/unit/module-number-" + i + ".test.js").join(" ");
    const fL = mkTasks(pR, "Long", "- [ ] 1. [US1] A\n  - _Verify: " + longV + "_\n- [ ] 2. [US1] B\n  - _Verify: " + longV.slice(0, 300) + "_\n  - _Verify: npm run lint -- " + "x".repeat(300) + "_\n" +
      "- [ ] 3. [US1] C\n  - _Verify: npm test_\n");
    const l1 = S.completeTask(pR, "long", 1, { command: longV, exitCode: 0 });
    const l2 = S.completeTask(pR, "long", 2, { command: longV.slice(0, 300) + " && npm run lint -- " + "x".repeat(300), exitCode: 0 });
    S.completeTask(pR, "long", 3, { command: "npm test " + "x".repeat(9000), exitCode: 0 });
    const recL = JSON.parse(fs.readFileSync(path.join(fL.dir, ".state.json"), "utf8")).evidence;
    const longCheck = "node --test " + "tests/unit/a-long-test-file-name.test.js ".repeat(11).trim();
    const finL = S.finishFeature(pR, "long", { evidence: [{ name: "long", command: "cd " + pR + " && " + longCheck, exitCode: 0 }] });
    ok(longV.length > 500 && l1.verified === true && l2.verified === true && recL["1"].command === longV && (recL["3"].command || "").length === 4000 &&
      finL.ok && finL.suiteChecks.find((c) => c.name === "long").status === "pass",
      "1.22 review 2 (2): a command over 500 characters is compared whole — a faithful report of a long _Verify:_ (or of a join past 500) verifies, a long check's run passes; the stored command stays bounded (4000, OBSERVED_MAX_COMMAND) (got " +
      js([l1.unverifiedReason, l2.unverifiedReason, (recL["1"].command || "").length, (recL["3"].command || "").length, finL.suiteChecks]) + ")");

    // 3 — a _Verify:_ that itself holds ` && ` is ONE key of the join (the run was split on every ` && `); the observed lookup too.
    const vb = ["npm run build && npm test", "npm run lint"];
    const w3 = wrongOf([["npm run build && npm test && npm run lint", vb, true], ["npm run lint && npm run build && npm test", vb, true],
      ["cd /p && npm run lint && cd /p && npm run build && npm test", vb, true, "/p"], ["npm run build && npm run lint && npm test", vb, false], ["npm run build && npm test", vb, false],
      ['bash -c "a && b"', ['bash -c "a && b"'], true], ['bash -c "a && b"', ["a", "b"], false]]);
    const fJ = mkTasks(pR, "Join", "- [ ] 1. [US1] A\n  - _Verify: npm run build && npm test_\n  - _Verify: npm run lint_\n");
    S.observeRun(pR, { command: "npm run build && npm test", exitCode: 0 });
    S.observeRun(pR, { command: "npm run lint", exitCode: 0 });
    const o3 = S.observedRun(pR, "join", "npm run build && npm test && npm run lint", 0, { expected: vb }).observed;
    const j1 = S.completeTask(pR, "join", 1, { command: "npm run build && npm test && npm run lint", exitCode: 0 });
    ok(!w3.length && o3 === true && j1.verified === true && fJ.ok !== false,
      "1.22 review 2 (3): the ` && ` join is matched against WHOLE _Verify:_ commands (one holding ` && ` stays one), any order; the observed lookup finds each expected command's logged run (got " + js([w3, o3, j1.unverifiedReason]) + ")");

    // 4 — a prefix is stripped from the RUN only: the _Verify:_ keeps its own (cd folder, pipefail, assignments).
    const w4 = wrongOf([["npm test", ["cd packages/api && npm test"], false], ["cd packages/web && npm test", ["cd packages/api && npm test"], false],
      ["cd packages/api && npm test", ["cd packages/api && npm test"], true], ["cd packages/api/ && npm test", ["cd packages/api && npm test"], true],
      ["cd packages" + BS + "api && npm test", ["cd packages/api && npm test"], true], ['cd "packages/api" && npm test', ["cd packages/api && npm test"], true],
      ["cd packages/api; npm test", ["cd packages/api && npm test"], true], ["cd /repo && cd packages/api && npm test", ["cd packages/api && npm test"], true, "/repo"],
      ["cd packages/api && cd sub && npm test", ["cd packages/api && npm test"], false],
      ["npm test | tee out.log", ["set -o pipefail; npm test | tee out.log"], false], ["set -euo pipefail; npm test | tee out.log", ["set -o pipefail; npm test | tee out.log"], true],
      ["set -o pipefail; npm test | tee out.log", ["npm test | tee out.log"], true],
      ["npm test", ["NODE_ENV=production npm test"], false], ["NODE_ENV=test npm test", ["NODE_ENV=production npm test"], false],
      ["CI=1 NODE_ENV=production npm test", ["NODE_ENV=production npm test"], true], ["NODE_ENV=production CI=1 npm test", ["NODE_ENV=production npm test"], true],
      ["cd /x && CI=1 npm test 2>&1", ["npm test"], true, "/x"]]);
    const fP = mkTasks(pR, "Mono", "- [ ] 1. [US1] API\n  - _Verify: cd packages/api && npm test_\n");
    const p1 = S.completeTask(pR, "mono", 1, { command: "cd packages/web && npm test", exitCode: 0 });
    const finP = S.finishFeature(pR, "mono", { evidence: [{ name: "api", command: "npm test", exitCode: 0 }] });
    ok(!w4.length && p1.verified === false && p1.unverifiedReason === "command-mismatch" && finP.ok && finP.suiteChecks.find((c) => c.name === "api").status === "changed" && fP.ok !== false,
      "1.22 review 2 (4): a cd / pipefail / VAR=value prefix is stripped from the RUN only — `cd packages/web && npm test` (or `npm test`) is no run of `cd packages/api && npm test`, nor `npm test | tee out.log` of `set -o pipefail; npm test | tee out.log`, nor `npm test` of `NODE_ENV=production npm test`; the same folder (separators, trailing slash, quotes) is (got " +
      js([w4, p1.unverifiedReason, finP.suiteChecks]) + ")");

    // 5 — a task with several _Verify:_ commands needs a run of EVERY one (one of them alone verified it); the join in any order,
    // and exactly what `done --run` records for it (the commands joined) proves it on the engine path too, with no "cli" stamp —
    // a Windows-path _Verify:_ as well.
    const two = ["npm run lint", "npm test"];
    const w5 = wrongOf([["npm run lint", two, false], ["npm test", two, false], ["npm run lint && npm test", two, true], ["npm test && npm run lint", two, true],
      ["npm test && npm test", ["npm test", "npm test"], true]]);
    const fM = mkTasks(pR, "Multi", "- [ ] 1. [US1] A\n  - _Verify: npm run lint_\n  - _Verify: npm test_\n- [ ] 2. [US1] B\n  - _Verify: npm run lint_\n  - _Verify: npm test_\n" +
      "- [ ] 3. [US1] C\n  - _Verify: node tests" + BS + "ok.js_\n  - _Verify: node -e \"process.exit(0)\"_\n");
    const m1 = S.completeTask(pR, "multi", 1, { command: "npm run lint", exitCode: 0 });
    const brief2 = S.taskBrief(pR, "multi", 2), brief3 = S.taskBrief(pR, "multi", 3);
    const m2 = S.completeTask(pR, "multi", 2, { command: brief2.verify.join(" && "), exitCode: 0 });
    const m3 = S.completeTask(pR, "multi", 3, { command: brief3.verify.join(" && "), exitCode: 0 });
    const stopAdvice = ["en", "pt", "es", "pt-BR"].map((l) => S.msg(l).stopGate.todoTasks("f", 1));
    ok(!w5.length && m1.verified === false && m1.unverifiedReason === "command-mismatch" && /every one of them in ONE run joined with ` && `/.test(m1.note) &&
      m2.verified === true && m3.verified === true && fM.ok !== false && stopAdvice.every((t) => /` && `/.test(t) && !/--run/.test(t)),
      "1.22 review 2 (5): a run of ONE of a task's two _Verify:_ commands no longer verifies it (command-mismatch, the note asks for all of them in one ` && ` run); the join in any order does, and so does exactly what done --run records (also for a Windows-path _Verify:_); the Stop gate's advice says to join them (got " +
      js([w5, m1.unverifiedReason, m2.unverifiedReason, m3.unverifiedReason, stopAdvice]) + ")");

    // …and the matching stays bounded: keys that are prefixes of each other, 199 steps, 12 commands.
    const keysH = Array.from({ length: 12 }, (_, i) => "a" + " && a".repeat(i));
    const t0 = Date.now();
    S.runProvesVerify({ command: Array.from({ length: 199 }, () => "a").join(" && ") + " && z" }, keysH);
    S.runProvesVerify({ command: '"'.repeat(200000) }, ["npm test"]);
    S.runProvesVerify({ command: "A=1 ".repeat(50000) + "npm test" }, ["npm test"]);
    S.runProvesVerify({ command: "cd x && ".repeat(25000) + "npm test" }, ["npm test"]);
    const msH = Date.now() - t0;
    ok(msH < 1500, "1.22 review 2: runProvesVerify stays bounded on hostile inputs (199 steps × 12 nested keys, 200,000 quotes, 50,000 assignments, 25,000 cds) — " + msH + " ms");
  }

  // 1.22 review 3 (4) — `cd` folders are resolved from the project root: the absolute form of the _Verify:_'s folder, `./x`, a
  // folder's drive-letter case all prove it; a run's own cd counts only when it ends at the project root — `cd ../other-project &&
  // npm test` and `cd .. && cd packages/web && npm test` used to prove `npm test` / `cd packages/web && npm test`. A run with an
  // absolute cd is stamped with the project root (`root`), so the verdict is the same on another machine and for a git worktree
  // of the project; a dev-spec project of another repository holding the same feature name is no worktree.
  // (5) `cd # && npm test` (bash: a comment — npm test never runs) and a cd inside a substitution (``cd `: && npm test` ``) prove
  // nothing; a substitution is never split (a _Verify:_ holding one matches the same text).
  {
    const js = JSON.stringify;
    const BS = String.fromCharCode(92);
    const p4 = path.join(tmp, "proj-122r3-cd");
    S.initProject(p4, ["core"], "en");
    const f4 = S.createFeature(p4, "Mono", ["core"], "", undefined, "en");
    const web = "- [ ] N. [US1] Web\n  - _Verify: cd packages/web && npm test_\n", root = "- [ ] N. [US1] Root\n  - _Verify: npm test_\n";
    const tasks = [web, web, web, web, root, web, root, root, root, root, web, web].map((t, i) => t.replace("N.", (i + 1) + ".")).join("");
    fs.writeFileSync(path.join(f4.dir, "tasks.md"), "# Tasks\n\n" + tasks);
    const fwd = p4.split(BS).join("/");
    const drive = /^[A-Za-z]:/.test(fwd) ? (fwd[0] === fwd[0].toUpperCase() ? fwd[0].toLowerCase() : fwd[0].toUpperCase()) + fwd.slice(1) : fwd;
    const run = (n, command) => S.completeTask(p4, "mono", n, { command, exitCode: 0, summary: "ok" });
    const r = [
      run(1, "cd " + fwd + "/packages/web && npm test"), run(2, "cd ./packages/web && npm test"), run(3, "cd " + p4 + BS + "packages" + BS + "web && npm test"),
      run(4, "cd " + drive + "/packages/web && npm test"), run(5, "cd ../other-project && npm test"), run(6, "cd .. && cd packages/web && npm test"),
      run(7, "cd # && npm test"), run(8, "cd /d # && npm test"), run(9, "cd `: && npm test`"), run(10, "cd " + fwd + " && npm test"),
      run(11, "cd " + fwd + "/packages/web/../web && npm test"), run(12, "cd " + fs.realpathSync.native(p4) + "/packages/web && npm test"), // (the long form of an 8.3 short name)
    ];
    // run 4 flips a drive letter's case: the same folder where the file system folds case — and, with no drive letter (Linux),
    // the very same path as run 1
    const want = [true, true, true, drive === fwd || process.platform === "win32" || process.platform === "darwin", false, false, false, false, false, true, true, true];
    const got = r.map((x) => x.ok && x.verified === true);
    const st4 = JSON.parse(fs.readFileSync(path.join(f4.dir, ".state.json"), "utf8")).evidence;
    ok(js(got) === js(want) && r.filter((x, i) => !want[i]).every((x) => x.unverifiedReason === "command-mismatch") &&
      st4["1"].root === path.resolve(p4) && st4["10"].root === path.resolve(p4) && !("root" in st4["2"]) && !("root" in st4["5"]),
      "1.22 review 3 (4, 5): cd folders resolved from the project root — the absolute, ./ and \\ forms of the _Verify:_'s folder (drive-letter case where the file system folds it) prove it; `cd ../other-project && npm test`, `cd .. && cd packages/web && npm test`, `cd # && npm test`, `cd /d # && …` and ``cd `: && npm test` `` do not (command-mismatch); a run with an absolute cd is stamped root (got " +
      js([got, r.map((x) => x.unverifiedReason || null), st4["1"].root, st4["2"].root]) + ")");
    // the root stamp travels: the same record read on another machine (its paths) still proves the task
    const sf = path.join(f4.dir, ".state.json"), st = JSON.parse(fs.readFileSync(sf, "utf8"));
    st.evidence["1"].command = "cd /home/someone/proj/packages/web && npm test";
    st.evidence["1"].root = "/home/someone/proj";
    st.evidence["1"].history = [];
    fs.writeFileSync(sf, JSON.stringify(st, null, 2));
    const un = S.verificationStatus(p4, "mono", f4.dir).unverifiedDetail.map((d) => d.number);
    ok(!un.includes(1) && js(un) === js([5, 6, 7, 8, 9]),
      "1.22 review 3 (4): a record whose command cds into ANOTHER machine's checkout (root stamp /home/someone/proj) still proves `cd packages/web && npm test` — the stamp, not this machine's folder, anchors it (got " + js(un) + ")");
    // pure: substitutions are never split; `#` kills the line; an unknown folder is equal only to itself
    const PV = (c, v, rt) => S.runProvesVerify({ command: c }, v, rt);
    const w5 = [["node --test $(ls tests/*.js && echo x)", ["node --test $(ls tests/*.js && echo x)"], true], ["echo `npm test`", ["npm test"], false],
      ["cd $(: && npm test)", ["npm test"], false], ["npm test && cd #", ["npm test"], true], ["cd $HOME && npm test", ["npm test"], false],
      ["cd $HOME && npm test", ["cd $HOME && npm test"], true], ["`npm test` && `npm run lint`", ["npm test", "npm run lint"], false], ["``npm test``", ["npm test"], true],
      ["cd packages/web && npm test && npm run lint", ["cd packages/web && npm test", "npm run lint"], false], ["npm run lint && cd packages/web && npm test", ["cd packages/web && npm test", "npm run lint"], true],
      ["cd /x && npm test", ["npm test"], false]].filter(([c, v, want]) => PV(c, v, "/r") !== want).map(([c, v]) => c + " vs " + js(v));
    ok(!w5.length, "1.22 review 3 (5): a substitution ($(…), `…`) is never split or stripped — it matches only the same text; a run's commands after `cd # ` never count; an unknown folder ($HOME) equals only itself; commands run in the folder the run left them in (wrong: " + js(w5) + ")");
    // a git worktree of the SAME repository holding the feature is the run's root; another repository's project with the same feature is not
    if (spawnSync("git", ["--version"], { encoding: "utf8" }).status !== 0) ok(true, "1.22 review 3 (4): worktree root — skipped: no git");
    else {
      const repo = path.join(tmp, "proj-122r3-wt-main"), wt = path.join(tmp, "proj-122r3-wt-task"), other = path.join(tmp, "proj-122r3-wt-other");
      const git = (cwd, ...a) => spawnSync("git", a, { cwd, encoding: "utf8" });
      for (const d of [repo, other]) {
        S.initProject(d, ["core"], "en");
        const f = S.createFeature(d, "Auth", ["core"], "", undefined, "en");
        fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] A\n  - _Verify: npm test_\n- [ ] 2. [US1] B\n  - _Verify: npm test_\n");
        git(d, "init", "-q");
        git(d, "-c", "user.email=t@t", "-c", "user.name=t", "add", "-A");
        git(d, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "x");
      }
      git(repo, "worktree", "add", "-q", wt);
      const a = S.completeTask(repo, "auth", 1, { command: "cd " + wt + " && npm test", exitCode: 0 });
      const b = S.completeTask(repo, "auth", 2, { command: "cd " + other + " && npm test", exitCode: 0 });
      const ev = JSON.parse(fs.readFileSync(path.join(repo, ".specs", "auth", ".state.json"), "utf8")).evidence;
      ok(fs.existsSync(path.join(wt, ".specs", "auth")) && a.verified === true && ev["1"].root === path.resolve(wt) && b.verified === false && b.unverifiedReason === "command-mismatch" &&
        ev["2"].root === path.resolve(repo),
        "1.22 review 3 (4): `cd <git worktree of the project> && npm test` proves `npm test` (root stamped: the worktree); `cd <another repository's project holding the same feature> && npm test` does not (got " +
        js([a.verified, a.unverifiedReason, ev["1"].root, b.verified, ev["2"].root]) + ")");
      // review 4: a worktree INSIDE the project (`.claude/worktrees/<name>`) is its own root — it was read as a folder of the main project
      // (command-mismatch); a plain subfolder of the project still is one (the run went there: another run)
      const nested = path.join(repo, ".claude", "worktrees", "agent-1");
      git(repo, "worktree", "add", "-q", nested);
      fs.appendFileSync(path.join(repo, ".specs", "auth", "tasks.md"), "- [ ] 3. [US1] C\n  - _Verify: npm test_\n- [ ] 4. [US1] D\n  - _Verify: npm test_\n");
      fs.mkdirSync(path.join(repo, "src"), { recursive: true });
      const c = S.completeTask(repo, "auth", 3, { command: "cd " + nested + " && npm test", exitCode: 0 });
      const dd = S.completeTask(repo, "auth", 4, { command: "cd " + path.join(repo, "src") + " && npm test", exitCode: 0 });
      const ev2 = JSON.parse(fs.readFileSync(path.join(repo, ".specs", "auth", ".state.json"), "utf8")).evidence;
      ok(fs.existsSync(path.join(nested, ".specs", "auth")) && c.verified === true && ev2["3"].root === path.resolve(nested) &&
        dd.verified === false && dd.unverifiedReason === "command-mismatch" && ev2["4"].root === path.resolve(repo),
        "1.22 review 4: `cd <repo>/.claude/worktrees/agent-1 && npm test` proves `npm test` (root stamped: that worktree); `cd <repo>/src && npm test` still does not (got " +
        js([c.verified, c.unverifiedReason, ev2["3"].root, dd.verified, ev2["4"].root]) + ")");
    }
    { // review 4: observeRun logs ONE plain step of a `_Verify:_` holding ` && ` — observedRun's step-by-step fallback (proofPlainParts) reads
      // them, and they were never logged: run as two Bash calls, `_Verify: npm run build && npm test_` read unobserved
      const pS = path.join(tmp, "proj-122r4-steps");
      S.initProject(pS, ["core"], "en");
      const fS = S.createFeature(pS, "Steps", ["core"], "", undefined, "en");
      fs.writeFileSync(path.join(fS.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] A\n  - _Verify: npm run build && npm test_\n");
      const r = ["npm run build", "npm test", "npm run lint"].map((command) => S.observeRun(pS, { command, exitCode: 0 }).recorded.length);
      const ob = S.observedRun(pS, fS.slug, "npm run build && npm test", 0, { expected: ["npm run build && npm test"] });
      ok(js(r) === "[1,1,0]" && ob.observed === true,
        "1.22 review 4: each plain step of `_Verify: npm run build && npm test_` run on its own is logged (another command is not) and the joined report reads observed (got " + js([r, ob]) + ")");
    }
    // hostile input: LINEAR (64 KB costs ~4× 16 KB — a quadratic matcher would cost ~16×), measured as a ratio so a slow machine
    // or a container doesn't flake; past PROOF_MAX_CHARS (64 KB) a command or _Verify:_ is never matched, at once.
    const hostile = (n) => ["`".repeat(n), "$(".repeat(n / 2), "cd ".repeat(n / 3), "'\"".repeat(n / 2), "cd x/ && ".repeat(n / 9) + "npm test", "a && ".repeat(n / 5),
      "cd " + "../".repeat(n / 3) + " && npm test", "#".repeat(n), "CI=1 ".repeat(n / 5) + "npm test", "$(" + "(".repeat(n) + ")"];
    const timeAll = (n) => { const t = Date.now(); for (const h of hostile(n)) { PV(h, ["npm test"], "/r"); PV("npm test", [h], "/r"); } return Date.now() - t; };
    timeAll(4096); // warm up
    const ms16 = Math.max(timeAll(16 * 1024), 5), ms64 = timeAll(64 * 1000);
    const tBig = Date.now();
    const big = [PV("`".repeat(1024 * 1024), ["npm test"], "/r"), PV("npm test", ["a && ".repeat(200000)], "/r"), PV("npm test " + "x".repeat(70000), ["npm test " + "x".repeat(70000)], "/r")];
    const msBig = Date.now() - tBig;
    ok(ms64 / ms16 < 12 && ms64 < 15000 && big.every((x) => x === false) && msBig < 200,
      "1.22 review 3: runProvesVerify is linear on hostile commands and _Verify:_ values (backticks, $(, cd chains, quotes, ` && `, `#`, assignments) — 64 KB costs < 12× 16 KB (got " +
      ms16 + " → " + ms64 + " ms); past 64 KB nothing is matched, at once (" + msBig + " ms)");
  }

  // 1.22 review 4 (0) — upgrade safety: the command rule judged evidence RECORDED BEFORE it existed — after a plugin update, tasks an
  // earlier release verified (`npx jest x` for `_Verify: npm test -- x`, a Windows path…) turned unverified (command-mismatch) and
  // blocked /spec-finish, and so did a project check's run of another form. A run without the cmdRule stamp keeps the pre-1.22 verdict
  // (any command with exit 0; an _Expect: fail_ task: any red run), in reported and observed mode; only stamped runs are judged by the
  // rule — the same record stamped reads command-mismatch (a check's: changed), and a NEW run is stamped and judged.
  {
    const js = JSON.stringify;
    const BS = String.fromCharCode(92);
    const pU = path.join(tmp, "proj-122r4-upgrade");
    S.initProject(pU, ["core"], "en", { checks: { test: "npm test" } });
    const fU = S.createFeature(pU, "Legacy", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(fU.dir, "tasks.md"), "# Tasks\n\n- [x] 1. [US1] A\n  - _Verify: npm test -- tests/x.test.js_\n" +
      "- [x] 2. [US1] B\n  - _Verify: node --test tests/y.test.js_\n- [x] 3. [US1] Red first\n  - _Verify: node --test tests/z.test.js_\n  - _Expect: fail_\n");
    const stF = path.join(fU.dir, ".state.json");
    const at = new Date(Date.now() - 120000).toISOString(), atCheck = new Date(Date.now() - 60000).toISOString();
    const run = (command, exitCode, extra) => ({ command, exitCode, summary: exitCode ? "not ok 1" : "ok 1", at, observed: true, ...extra });
    const rec = (task, verify, r) => ({ ...r, task, verify, history: [{ ...r }] });
    const writeState = (cmdRule) => { // the records as a pre-1.22 engine wrote them (no cmdRule) — or stamped
      const st = JSON.parse(fs.readFileSync(stF, "utf8"));
      const s = (r) => (cmdRule ? { ...r, cmdRule } : r);
      st.evidence = {
        1: rec("[US1] A", "npm test -- tests/x.test.js", s(run("npx jest tests/x.test.js", 0))),
        2: rec("[US1] B", "node --test tests/y.test.js", s(run("node tests" + BS + "y.test.js", 0))),
        3: rec("[US1] Red first", "node --test tests/z.test.js", s(run("node --test --test-reporter=tap tests/z.test.js", 1, { expected: "fail" }))),
      };
      for (const k of ["1", "2", "3"]) st.evidence[k].history = [s(st.evidence[k].history[0])];
      st.lastTickAt = at;
      st.finishChecks = { test: { ...s({ command: "npx jest", exitCode: 0, summary: "12 passing", at: atCheck, observed: true }), check: "npm test", history: [s({ command: "npx jest", exitCode: 0, at: atCheck })] } };
      fs.writeFileSync(stF, JSON.stringify(st, null, 2));
    };
    const verdicts = () => {
      const un = S.verificationStatus(pU, "legacy", fU.dir).unverifiedDetail.map((d) => [d.number, d.reason]);
      const doc = (S.specDoctor(pU, "legacy").checks || []).find((c) => c.id === "verification") || {};
      const fin = S.finishFeature(pU, "legacy");
      const up = (S.specUpgrade(pU).features || []).find((x) => x.name === "legacy") || {};
      return { un, doc: doc.status, finUnverified: (fin.blockers || []).some((b) => /without verification evidence/.test(b)),
        suite: (fin.suiteChecks || []).map((c) => c.status), up: (up.unverified || []).map((d) => [d.number, d.reason]),
        status: S.statusFeature(pU, "legacy").tasks.list.map((t) => t.verified) };
    };
    writeState(null);
    const pre = verdicts();
    S.initProject(pU, ["core"], "en", { evidence: "observed" });
    const preObserved = S.verificationStatus(pU, "legacy", fU.dir).unverifiedDetail.map((d) => [d.number, d.reason]);
    const preSuiteObserved = S.finishFeature(pU, "legacy").suiteChecks.map((c) => c.status);
    S.initProject(pU, ["core"], "en", { evidence: "reported" });
    writeState(1);
    const ruled = verdicts();
    // a NEW run of the same other command is recorded under the rule (stamped) and judged by it
    writeState(null);
    const again = S.completeTask(pU, "legacy", 1, { command: "npx jest tests/x.test.js", exitCode: 0 });
    const recAgain = JSON.parse(fs.readFileSync(stF, "utf8")).evidence["1"];
    const finAgain = S.finishFeature(pU, "legacy", { evidence: [{ name: "test", command: "npx jest", exitCode: 0 }] });
    const chkAgain = JSON.parse(fs.readFileSync(stF, "utf8")).finishChecks.test;
    ok(js(pre) === js({ un: [], doc: "pass", finUnverified: false, suite: ["pass"], up: [], status: [true, true, true] }) && js(preObserved) === "[]" && js(preSuiteObserved) === '["pass"]' &&
      js(ruled.un) === js([[1, "command-mismatch"], [2, "command-mismatch"], [3, "command-mismatch"]]) && ruled.doc === "warn" && ruled.finUnverified === true &&
      js(ruled.suite) === '["changed"]' && js(ruled.up) === js(ruled.un) && js(ruled.status) === "[false,false,false]" &&
      again.verified === false && again.unverifiedReason === "command-mismatch" && recAgain.cmdRule === 1 &&
      finAgain.suiteChecks[0].status === "changed" && chkAgain.cmdRule === 1 && chkAgain.history[chkAgain.history.length - 1].cmdRule === 1,
      "1.22 review 4 (0): records made before the command rule (no cmdRule stamp) whose commands differ from the _Verify:_ (`npx jest x`, `node tests\\y.test.js`, an _Expect: fail_ red run of another form) and a project check's run of another form keep their pre-1.22 verdict — verified / pass in status, doctor, finish, spec_upgrade, observed mode too; the same records stamped read command-mismatch / changed; a new run is stamped (task and finish check) and judged (got " +
      js([pre, preObserved, preSuiteObserved, ruled, again.unverifiedReason, recAgain.cmdRule, finAgain.suiteChecks, chkAgain.cmdRule]) + ")");
  }

  // 1.22 review 3 (3) — observed mode sees the forms the matcher accepts: the observe hook's log (observeRun) and the lookup
  // (observedRun) use runProvesVerify too — `node --test tests\x.test.js`, the reversed join `npm test && npm run build`, `CI=1 npm
  // run lint` were verified in reported mode and `unobserved` in observed mode (the log took only the _Verify:_ as written or its
  // in-order join). The hook's cheap pre-filter is a copy of the engine's observedNorm / observedBodies.
  {
    const js = JSON.stringify;
    const BS = String.fromCharCode(92);
    const obsJs = path.join(__dirname, "..", "hooks", "observe-hook.js");
    const p3 = path.join(tmp, "proj-122r3-observed");
    S.initProject(p3, ["core"], "en", { checks: { lint: "npm run lint" } });
    const f3 = S.createFeature(p3, "Feat", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(f3.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] a\n  - _Verify: node --test tests/x.test.js_\n" +
      "- [ ] 2. [US1] b\n  - _Verify: npm run build_\n  - _Verify: npm test_\n- [ ] 3. [US1] c\n  - _Verify: npm run typecheck_\n  - _Verify: npm run format_\n" +
      "- [ ] 4. [US1] d\n  - _Verify: npm run lint_\n- [ ] 5. [US1] e\n  - _Verify: cd packages/web && npm test_\n- [ ] 6. [US1] f\n  - _Verify: npm run e2e_\n");
    S.initProject(p3, ["core"], "en", { evidence: "observed" });
    const hook = (command, code) => spawnSync(process.execPath, [obsJs], { encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" },
      input: js({ session_id: "s", cwd: p3, hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command }, tool_response: { exit_code: code } }) });
    for (const [c, x] of [["node --test tests" + BS + "x.test.js", 0], ["npm test && npm run build", 0], ["npm run typecheck", 0], ["npm run format", 0], ["CI=1 npm run lint", 0],
      ["cd ./packages/web && npm test", 0], ["cd ../elsewhere && npm run e2e", 0], ["CI=1 npm run e2e", 1]]) hook(c, x);
    const pick = (r) => [r.ok, r.verified, r.unverifiedReason || null, r.observed];
    const c1 = S.completeTask(p3, "feat", 1, { command: "node --test tests" + BS + "x.test.js", exitCode: 0 });
    const c2 = S.completeTask(p3, "feat", 2, { command: "npm test && npm run build", exitCode: 0 });
    const c3 = S.completeTask(p3, "feat", 3, { command: "npm run typecheck && npm run format", exitCode: 0 }); // run as two Bash calls
    const c4 = S.completeTask(p3, "feat", 4, { command: "CI=1 npm run lint", exitCode: 0 });
    const c4b = S.completeTask(p3, "feat", 4, { command: "npm run lint", exitCode: 0 }); // the latest logged run OF it passed
    const c5 = S.completeTask(p3, "feat", 5, { command: "cd packages/web && npm test", exitCode: 0 });
    const c6 = S.completeTask(p3, "feat", 6, { command: "npm run e2e", exitCode: 0 }); // the harness saw it fail (and a run elsewhere)
    const logged = fs.readFileSync(path.join(f3.dir, ".execution", "observed.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).command);
    const projLog = fs.readFileSync(path.join(p3, ".specs", ".execution", "observed.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).command);
    ok(js([c1, c2, c3, c4, c4b, c5].map(pick)) === js(Array(6).fill([true, true, null, true])) && c6.verified === false && c6.observed === false &&
      !logged.includes("cd ../elsewhere && npm run e2e") && logged.includes("node --test tests" + BS + "x.test.js") && js(projLog) === js(["CI=1 npm run lint"]),
      "1.22 review 3 (3): under meta.evidence observed, runs in the forms the matcher accepts are logged and found — `node --test tests\\x.test.js`, `npm test && npm run build` (reversed), two separate Bash runs reported joined, `CI=1 npm run lint` (task and project check), `cd ./packages/web && npm test`; a run in another folder is logged nowhere and the harness's failed run stays failed (got " +
      js([[c1, c2, c3, c4, c4b, c5, c6].map(pick), logged, projLog]) + ")");
    // the hook's pre-filter is the engine's: the same functions, and a superset of the matcher on the probe commands
    const E3 = require(path.join(__dirname, "lib", "engine", "index.js"));
    const hookSrc = fs.readFileSync(obsJs, "utf8"), engSrc = fs.readFileSync(path.join(__dirname, "lib", "engine", "evidence.js"), "utf8");
    const grab = (src, from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); return a < 0 || b < 0 ? null : src.slice(a, b); };
    const hookFns = (grab(hookSrc, "const norm = ", "\n}\n") || "").replace(/\bnorm\b/g, "observedNorm").replace(/\bRE_ENV\b/g, "RE_OBSERVED_ENV").replace(/\bbodies\b/g, "observedBodies");
    const engFns = grab(engSrc, "const observedNorm = ", "\n}\n") || "";
    const strip = (s) => s.replace(/\s+/g, " ").trim();
    const probes = [["node --test tests" + BS + "x.test.js", "node --test tests/x.test.js"], ['X="a b" npm test', "npm test"], ["CI=1 npm run lint 2>&1", "npm run lint"],
      ["cd /x && set -o pipefail; npm test | tee log", "set -o pipefail; npm test | tee log"], ["`npm test`", "npm test"], ['node --test "tests/x.test.js"', "node --test tests/x.test.js"],
      ["npm test && npm run build", "npm run build"]];
    const notSuperset = probes.filter(([run, v]) => { const t = E3.observedNorm(v + " " + "npm test"); return !E3.observedBodies(run).every((b) => t.includes(b)); });
    ok(hookFns && strip(hookFns) === strip(engFns) && !notSuperset.length,
      "1.22 review 3 (3): hooks/observe-hook.js's pre-filter (norm / RE_ENV / bodies) is the engine's observedNorm / RE_OBSERVED_ENV / observedBodies, and reads every probe run as mentioned by its _Verify:_ (got " + js([!!hookFns, strip(hookFns) === strip(engFns), notSuperset]) + ")");
  }

  // 1.22 review (finding 6) — ONE `cd <root> &&` stripping (spec.stripCdPrefix) for the observe hook's log and the reported run's
  // lookup: reporting the exact command that ran (`cd <root> && node t1.js`) read unobserved, and a subagent's run in a git
  // worktree (`cd <worktree> && node t1.js`) reached only the worktree's (git-ignored, never merged) log.
  {
    const js = JSON.stringify;
    const obsJs = path.join(__dirname, "..", "hooks", "observe-hook.js");
    const mk = (dir) => {
      S.initProject(dir, ["core"], "en");
      const f = S.createFeature(dir, "Auth", ["core"], "", undefined, "en");
      fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Login\n  - _Verify: node t1.js_\n");
      return f;
    };
    const pMain = path.join(tmp, "proj-122-cd-main"), pWt = path.join(tmp, "proj-122-cd-wt", "wt");
    const fMain = mk(pMain), fWt = mk(pWt);
    const logOf = (dir) => { try { return fs.readFileSync(path.join(dir, ".execution", "observed.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
    const hook = (cwd, command, envDir) => spawnSync(process.execPath, [obsJs], { encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: envDir, SPEC_PROJECT_DIR: "" },
      input: JSON.stringify({ session_id: "s", cwd, hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command }, tool_response: { exit_code: 0 } }) });
    const h1 = hook(pWt, "cd " + pWt + " && node t1.js", pMain);
    const h2 = hook(pMain, "cd " + path.join(tmp, "elsewhere") + " && node t1.js", pMain);
    const main = logOf(fMain.dir), wt = logOf(fWt.dir);
    const look = [S.observedRun(pMain, "auth", "cd " + pMain + " && node t1.js", 0).observed, S.observedRun(pMain, "auth", "node t1.js", 0).observed,
      S.observedRun(pMain, "auth", "cd " + path.join(tmp, "elsewhere") + " && node t1.js", 0).observed,
      S.stripCdPrefix("cd sub && npm test", [path.join(pMain, "sub")], pMain), S.stripCdPrefix("cd sub && npm test", [pMain], pMain)];
    ok(h1.status === 0 && h2.status === 0 && js(main.map((e) => e.command)) === js(["node t1.js"]) && js(wt.map((e) => e.command)) === js(["node t1.js"]) &&
      js(look) === js([true, true, false, "npm test", "cd sub && npm test"]),
      "1.22 review: a worktree's `cd <worktree> && node t1.js` is logged as `node t1.js` in the worktree's log AND the main project's (a cd into another folder is logged nowhere); observedRun strips `cd <root> &&` from the reported command too — one stripCdPrefix (got " +
      js([main, wt, look]) + ")");
  }

  // 1.22 review (13) — the observe hook's pre-filter stat'ed, read and probed change.md in every feature folder on every Bash call
  // (+133 ms at 150 features). It opens tasks.md once and looks at change.md only when there is no tasks.md; what it finds is
  // unchanged (a change's change.md is still read, an oversized tasks.md still skipped).
  {
    const js = JSON.stringify;
    const obsJs = path.join(__dirname, "..", "hooks", "observe-hook.js");
    const probe = path.join(tmp, "o122-probe.js"), out = path.join(tmp, "o122-probe.out");
    fs.writeFileSync(probe, "const fs = require('fs'); let n = 0; for (const k of ['statSync', 'openSync', 'readFileSync', 'existsSync']) { const o = fs[k]; fs[k] = function (p, ...r) { if (typeof p === 'string' && /change\\.md$/.test(p)) n++; return o.call(this, p, ...r); }; }\n" +
      "process.on('exit', () => require('fs').writeFileSync(" + js(out) + ", String(n)));\n");
    const p = path.join(tmp, "o122-prefilter");
    S.initProject(p, ["core"], "en");
    for (let i = 0; i < 5; i++) {
      const f = S.createFeature(p, "Feat " + i, ["core"], "", undefined, "en");
      fs.writeFileSync(path.join(f.dir, "tasks.md"), "- [ ] 1. t\n  - _Verify: node t" + i + ".js_\n");
    }
    const big = S.createFeature(p, "Big", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(big.dir, "tasks.md"), "- [ ] 1. t\n  - _Verify: node big.js_\n" + "x".repeat(2 * 1024 * 1024 + 10) + "\n");
    const ch = S.createFeature(p, "Tweak", undefined, "", undefined, "en", undefined, { size: "xs" });
    fs.writeFileSync(path.join(ch.dir, "change.md"), fs.readFileSync(path.join(ch.dir, "change.md"), "utf8").replace(/_Verify: [^_\n]*_/, "_Verify: node change.js_"));
    const hook = (command) => {
      try { fs.unlinkSync(out); } catch { /* none */ }
      spawnSync(process.execPath, ["-r", probe, obsJs], { encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" },
        input: js({ session_id: "s", cwd: p, hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command }, tool_response: { exit_code: 0 } }) });
      return Number(fs.existsSync(out) ? fs.readFileSync(out, "utf8") : NaN);
    };
    const logged = (dir) => { try { return fs.readFileSync(path.join(dir, ".execution", "observed.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).command); } catch { return []; } };
    const probes = hook("ls -la");
    hook("node change.js");
    hook("node big.js");
    ok(probes === 2 && js(logged(ch.dir)) === js(["node change.js"]) && js(logged(big.dir)) === "[]",
      "1.22 review: the observe hook's pre-filter touches change.md only in the folders without a tasks.md (the change's and steering/: 2 probes for 8 folders, not one or two each); a change's _Verify:_ is still logged, an oversized tasks.md still skipped (got " +
      js([probes, logged(ch.dir), logged(big.dir)]) + ")");
  }
};
