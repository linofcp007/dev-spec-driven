"use strict";
// Tasks — the ONE task scanner (mistyped, quoted and setext lines too), task numbers, spec_append_tasks (converge), _Depends:_ and waves.

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, all, remeasure, rpc, payload, S, tmp, libSources, list, __dirname, require }) => {

  {
  // --- 1.13 WP1: ONE task scanner, numeric task numbers, one duplicate resolver, the evidence gate ---
  const w1 = path.join(tmp, "proj-wp1");
  const w1f = S.createFeature(w1, "Scan", ["core"]);
  const w1Tasks = path.join(w1f.dir, "tasks.md");
  // 1. Commented / fenced task-looking lines are not tasks — for status, complete, brief, finish and phase alike.
  fs.writeFileSync(w1Tasks, ["# Tasks", "- [x] 1. a", "- [ ] 2. b", "<!--", "- [ ] 3. dropped", "-->", "```md", "- [ ] 4. example", "```", ""].join("\n"));
  const w1St = S.statusFeature(w1, "scan");
  ok(w1St.tasks.list.map((t) => t.number).join() === "1,2" && w1St.tasks.next.number === 2, "status lists only real tasks (commented/fenced look-alikes are not tasks)");
  const w1c3 = payload(await rpc("tools/call", { name: "spec_complete_task", arguments: { name: "scan", number: 3, projectDir: w1 } }));
  ok(w1c3.ok === false && /Task 3 not found/.test(w1c3.error) && S.completeTask(w1, "scan", 4).ok === false, "complete_task on a commented or fenced task → task-not-found");
  const w1c2 = S.completeTask(w1, "scan", 2);
  const w1After = fs.readFileSync(w1Tasks, "utf8");
  ok(w1c2.ok && w1c2.next === null && w1c2.done === 2 && w1c2.total === 2 && /- \[ \] 3\. dropped/.test(w1After) && /- \[ \] 4\. example/.test(w1After) &&
    S.statusFeature(w1, "scan").phase === "complete" && S.taskBrief(w1, "scan").task === null && S.finishFeature(w1, "scan").openTasks.length === 0 && S.nextTask(w1, "scan").next === null,
    "after the last real task nothing is next and the phase is complete — status/next/brief/finish agree; look-alikes untouched");
  // A multi-line comment ABOVE the real task: the old first-regex-match ticked the commented example.
  fs.writeFileSync(w1Tasks, "<!--\n- [ ] 1. example in a comment\n-->\r\n- [ ] 1. real\r\n");
  S.completeTask(w1, "scan", 1);
  ok(fs.readFileSync(w1Tasks, "utf8") === "<!--\n- [ ] 1. example in a comment\n-->\r\n- [x] 1. real\r\n", "complete ticks the resolved line — never a commented look-alike (CRLF kept)");
  fs.writeFileSync(w1Tasks, "- [x] 1. a\n<!-- stray, never closed\n- [ ] 2. b\n");
  ok(S.statusFeature(w1, "scan").phase === "executing" && S.nextTask(w1, "scan").next.number === 2, "an unclosed '<!--' hides nothing (the feature can't read as complete)");
  // 2. Task numbers are numeric: "01." is task 1 everywhere.
  fs.writeFileSync(w1Tasks, "- [ ] 01. First\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 02. Second\n");
  const w1b1 = S.taskBrief(w1, "scan", 1);
  ok(S.statusFeature(w1, "scan").tasks.list.map((t) => t.number).join() === "1,2" && S.nextTask(w1, "scan").next.number === 1 && w1b1.task.number === 1 && w1b1.verify.length === 1,
    "zero-padded '01.' is task 1 in status, next and brief");
  const w1z1 = S.completeTask(w1, "scan", 1, { command: 'node -e "process.exit(0)"', exitCode: 0 }), w1z2 = S.completeTask(w1, "scan", "02");
  ok(w1z1.ok && w1z1.verified && w1z2.ok && w1z2.next === null && /- \[x\] 01\. First\n[\s\S]*- \[x\] 02\. Second/.test(fs.readFileSync(w1Tasks, "utf8")),
    "complete_task finds zero-padded tasks by number (1) or by '02'");
  // 3. Duplicated numbers: ONE resolver — the first OPEN task with that number, else the first.
  const dupF = S.createFeature(w1, "Dups", ["core"]);
  const dupTasks = path.join(dupF.dir, "tasks.md");
  fs.writeFileSync(dupTasks, "- [x] 3. a\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 3. b\n  - _Verify: node -e \"process.exit(7)\"_\n");
  const dupBrief = S.taskBrief(w1, "dups", 3);
  ok(S.resolveTask(S.taskBlocks(fs.readFileSync(dupTasks, "utf8")), 3).text === "b" && dupBrief.task.text === "b" && /exit\(7\)/.test(dupBrief.verify[0]),
    "a duplicated number resolves to its first OPEN task (the brief carries the _Verify:_ that will run)");
  const dupDoc = S.specDoctor(w1, "dups").checks.find((c) => c.id === "duplicate-tasks");
  const dupDone = S.completeTask(w1, "dups", 3);
  ok(dupDoc && dupDoc.status === "warn" && /#3/.test(dupDoc.detail) && dupDone.ok && !dupDone.alreadyDone && /- \[x\] 3\. b/.test(fs.readFileSync(dupTasks, "utf8")),
    "doctor warns on duplicate task numbers (duplicate-tasks); complete ticks the same open task the brief showed");
  const dupPt = S.createFeature(w1, "Duplas", ["core"], undefined, undefined, "pt");
  fs.writeFileSync(path.join(dupPt.dir, "tasks.md"), "- [ ] 1. a\n- [ ] 1. b\n");
  ok(/números de tarefa repetidos: #1/.test(S.specDoctor(w1, "duplas").checks.find((c) => c.id === "duplicate-tasks").detail), "duplicate-tasks detail is localized (PT)");
  // 4. Evidence gate ("evidence before claims" was bypassable).
  const eg = S.createFeature(w1, "Gate", ["core"]);
  const egTasks = path.join(eg.dir, "tasks.md");
  fs.writeFileSync(egTasks, "- [ ] 1. suite\n  - _Verify: npm test_\n- [ ] 2. page\n  - _Verify: [manual: check the page]_\n- [ ] 3. docs\n- [ ] 4. suite again\n  - _Verify: npm test_\n- [ ] 5. extra\n");
  const egState = () => JSON.parse(fs.readFileSync(path.join(eg.dir, ".state.json"), "utf8"));
  // f. the bypass: a failed run, then a summary-only note, used to leave the task "verified".
  const eg1 = payload(await rpc("tools/call", { name: "spec_complete_task", arguments: { name: "gate", number: 1, evidence: { command: "npm test", exitCode: 1, summary: "1 failing" }, projectDir: w1 } }));
  ok(eg1.ok === false && eg1.recorded === true && egState().evidence["1"].exitCode === 1 && egState().evidence["1"].history.length === 1 && /- \[ \] 1\. suite/.test(fs.readFileSync(egTasks, "utf8")),
    "a failed run on an OPEN task is refused AND recorded (evidence + history in .state.json)");
  const eg2 = payload(await rpc("tools/call", { name: "spec_complete_task", arguments: { name: "gate", number: 1, evidence: { summary: "all green" }, projectDir: w1 } }));
  const eg2Doc = S.specDoctor(w1, "gate").checks.find((c) => c.id === "verification");
  ok(eg2.ok && eg2.verified === false && eg2.unverifiedReason === "failed-run" && egState().evidence["1"].exitCode === 1 && egState().evidence["1"].note === "all green" &&
    eg2Doc.status === "warn" && /#1 \(latest run failed\)/.test(eg2Doc.detail) && S.finishFeature(w1, "gate").blockers.some((b) => /#1 \(latest run failed\)/.test(b)) &&
    /\*\*gate\*\* — 1 task\(s\) ticked without verification evidence: #1 \(latest run failed\)$/m.test(fs.readFileSync(path.join(w1, ".specs", "ROADMAP.md"), "utf8")),
    "a later summary-only note may tick but never verifies over a failed run (doctor, spec_finish and ROADMAP flag it)");
  const eg3 = S.completeTask(w1, "gate", 1, { command: "npm test", exitCode: 0, summary: "5 passing" });
  ok(eg3.ok && eg3.alreadyDone && eg3.verified === true && egState().evidence["1"].history.map((h) => h.exitCode).join() === "1,0" &&
    !S.verificationStatus(w1, "gate", eg.dir).unverified.includes(1), "only a later PASSING command run verifies it (history keeps both runs)");
  // a. a summary-only note on a task whose _Verify:_ holds a command ticks it but leaves it UNVERIFIED.
  const eg4 = S.completeTask(w1, "gate", 4, "looks fine to me");
  ok(eg4.ok && eg4.verified === false && eg4.unverifiedReason === "manual-note-on-runnable-verify" && /--run/.test(eg4.note) &&
    S.verificationStatus(w1, "gate", eg.dir).unverifiedDetail.some((d) => d.number === 4 && d.reason === "manual-note-on-runnable-verify") &&
    S.statusFeature(w1, "gate").tasks.list.find((t) => t.number === 4).verified === false && S.finishFeature(w1, "gate").unverified.includes(4),
    "a note on a task with a runnable _Verify:_ stays unverified (manual-note-on-runnable-verify) in status, doctor and finish");
  // b. …but a summary still attests a check that has no command: a [manual: …] placeholder, or no _Verify:_ at all.
  ok(S.completeTask(w1, "gate", 2, "checked the page by hand").verified === true && S.completeTask(w1, "gate", 3, { summary: "proofread" }).verified === true,
    "a summary-only attestation verifies a task without a runnable _Verify:_");
  // c. evidence with neither a command nor a summary is rejected, and nothing is ticked.
  const eg5 = S.completeTask(w1, "gate", 5, { exitCode: 0 });
  ok(eg5.ok === false && /exit code alone/.test(eg5.error) && /- \[ \] 5\. extra/.test(fs.readFileSync(egTasks, "utf8")), "{exitCode: 0} alone is rejected (no tick, no 'verified')");
  // d. the history is bounded: the last 5 runs, oldest dropped; evidence[n] stays the latest run.
  for (let i = 1; i <= 6; i++) S.completeTask(w1, "gate", 1, { command: "npm test", exitCode: 0, summary: "run " + i });
  const egH = egState().evidence["1"];
  ok(egH.history.length === 5 && egH.history[0].summary === "run 2" && egH.summary === "run 6" && egH.command === "npm test" && egH.exitCode === 0, "evidence keeps the latest run + its last 5 runs");
  // e. a .state.json of the wrong shape is refused BEFORE tasks.md is touched (it used to tick, then throw).
  const egText = fs.readFileSync(egTasks, "utf8");
  fs.writeFileSync(path.join(eg.dir, ".state.json"), JSON.stringify({ lang: "en", approvals: {}, evidence: "legacy" }));
  const egBad1 = S.completeTask(w1, "gate", 5, { command: "npm test", exitCode: 0 }), egBad2 = S.completeTask(w1, "gate", 5);
  fs.writeFileSync(path.join(eg.dir, ".state.json"), JSON.stringify({ lang: "en", approvals: [] }));
  const egBad3 = S.completeTask(w1, "gate", 5);
  ok(egBad1.ok === false && /'evidence' must be an object/.test(egBad1.error) && egBad2.ok === false && egBad3.ok === false && /'approvals'/.test(egBad3.error) &&
    fs.readFileSync(egTasks, "utf8") === egText, "a .state.json whose evidence/approvals aren't objects → state error, tasks.md untouched");
  fs.writeFileSync(path.join(eg.dir, ".state.json"), JSON.stringify({ lang: "en", approvals: {} }));
  // f. a v1.12 bare {exitCode: 0} on a task with NO _Verify:_ (1.12's `done <f> 1 --exit 0` → "done (verified)") is not
  // worse than no evidence: it passes doctor/finish, a later note becomes its summary, and the merge summary never ends
  // in a dangling " — ". Only a runnable _Verify:_ needs a real {command, exitCode: 0}.
  const lx = S.createFeature(w1, "Legacy exit", ["core"]);
  fs.writeFileSync(path.join(lx.dir, "tasks.md"), "# Tasks\n\n## Phase 1\n- [x] 1. Build the exporter\n- [x] 2. Document it\n- [ ] 3. Wire the button\n  - _Verify: npm test_\n");
  fs.writeFileSync(path.join(lx.dir, ".state.json"), JSON.stringify({ lang: "en", approvals: {}, evidence: { 1: { exitCode: 0, at: "2026-01-01T00:00:00Z" }, 2: { at: "2026-01-01T00:00:00Z" } } }));
  const lxVs = S.verificationStatus(w1, "legacy-exit", lx.dir);
  const lxFin = S.finishFeature(w1, "legacy-exit");
  const lxTask1 = lxFin.mergeSummary.split("\n").find((l) => / 1\. Build the exporter/.test(l)) || "";
  const lxOdd = S.completeTask(w1, "legacy-exit", 2); // a record with nothing in it, on a task with no _Verify:_
  const lxNote = S.completeTask(w1, "legacy-exit", 1, { summary: "exporter checked by hand" });
  const lxRec = JSON.parse(fs.readFileSync(path.join(lx.dir, ".state.json"), "utf8")).evidence["1"];
  all("a v1.12 bare {exitCode: 0} on a task without _Verify:_ verifies (doctor, finish, merge summary 'exit 0'); a note replaces it as the summary; an empty record on a no-_Verify:_ task is what doctor says: verified, nothing to verify", [
    () => !lxVs.unverified.includes(1), () => !lxFin.unverified.includes(1), () => !(lxFin.blockers || []).some((b) => /#1/.test(b)),
    () => S.specDoctor(w1, "legacy-exit").checks.find((c) => c.id === "verification").status === "pass",
    () => lxTask1 === "- [x] 1. Build the exporter — exit 0", () => !/ — $/m.test(lxFin.mergeSummary), () => lxNote.ok,
    () => lxNote.verified === true, () => lxRec.summary === "exporter checked by hand", () => lxRec.note === undefined, () => lxOdd.ok,
    () => lxOdd.verified === true, () => lxOdd.nothingToVerify === true, () => lxOdd.unverifiedReason === undefined, () => lxOdd.note === undefined,
    () => !lxVs.unverified.includes(2), () => S.statusFeature(w1, "legacy-exit").tasks.list.find((t) => t.number === 2).verified === true,
  ]);
  // One verdict everywhere (taskVerification): a task with no runnable _Verify:_ and nothing recorded is verified — with
  // nothingToVerify, and no reason code — in spec_complete_task, spec_status, spec_impact, doctor and spec_finish alike
  // (complete_task used to answer verified:false with NO unverifiedReason while doctor/finish/roadmap passed it).
  const nv = S.createFeature(w1, "Nothing to verify", ["core"]);
  fs.writeFileSync(path.join(nv.dir, "tasks.md"), "- [ ] 1. Write the docs\n- [ ] 2. Build it\n  - _Verify: npm test_\n- [ ] 3. Proofread\n");
  const nv1 = S.completeTask(w1, "nothing-to-verify", 1);
  const nv2 = S.completeTask(w1, "nothing-to-verify", 2);
  const nv3 = S.completeTask(w1, "nothing-to-verify", 3, { summary: "read it twice" });
  const nvSt = S.statusFeature(w1, "nothing-to-verify").tasks.list;
  const nvVs = S.verificationStatus(w1, "nothing-to-verify", nv.dir);
  ok(nv1.ok && nv1.verified === true && nv1.nothingToVerify === true && nv1.unverifiedReason === undefined && nv1.note === undefined &&
    nv2.verified === false && nv2.unverifiedReason === "no-evidence" && nv2.nothingToVerify === undefined && /_Verify:_/.test(nv2.note) &&
    nv3.verified === true && nv3.nothingToVerify === undefined &&
    nvSt.map((t) => t.number + ":" + t.verified + (t.nothingToVerify ? "~" : "")).join() === "1:true~,2:false,3:true" &&
    nvVs.unverified.join() === "2" && S.finishFeature(w1, "nothing-to-verify").unverified.join() === "2",
    "verified means the same on every surface: no _Verify:_ + nothing recorded → verified (nothingToVerify, no reason); a runnable _Verify:_ without a run → no-evidence; a note attests a manual task");
  // 5. what `done --run` records: the count lines a plain tail loses, plus the tail, capped.
  const noisy = ["TAP version 13", "ok 1 - a", "ok 2 - b", "# tests 2", "# pass 2", "# fail 0", ...Array.from({ length: 12 }, (_, i) => "trailing noise line " + i)].join("\n");
  const sumNoisy = S.summarizeRunOutput(noisy);
  const sumHuge = S.summarizeRunOutput(Array.from({ length: 50 }, (_, i) => "x".repeat(190) + i).join("\n") + "\n1 failing");
  const sumFail = S.summarizeRunOutput(["✖ t (68ms)", "  'test failed'", "ℹ tests 1", "ℹ suites 0", "ℹ pass 0", "ℹ fail 1", "ℹ cancelled 0", "ℹ skipped 0",
    "ℹ todo 0", "ℹ duration_ms 77.8", "✖ failing tests:", "", "test at t:1:1", "    at Test.run (node:internal/test_runner/test:1447:12)",
    "    at Test.postRun (node:internal/test_runner/test:1522:19)", "    at async startSubtest (node:internal/test_runner/harness:332:3)", "✖ t (68.6781ms)", "  'test failed'"].join("\r\n"));
  ok(/# tests 2\n# pass 2\n# fail 0\n/.test(sumNoisy) && /trailing noise line 11$/.test(sumNoisy) && !/ok 1 - a/.test(sumNoisy) && sumHuge.length <= 500 && /1 failing$/.test(sumHuge) &&
    /^ℹ tests 1\nℹ pass 0\nℹ fail 1\n {4}at Test\.run/.test(sumFail) && /'test failed'$/.test(sumFail),
    "run summary keeps the last count lines (node --test pass/fail, even past failure details) + the tail, deduped and capped at ~500 chars");
  // `done --run` on Windows refuses (unless --shell) a _Verify:_ command in POSIX syntax that cmd.exe would misread.
  const px = (c) => S.posixShellSyntax(c).join("+");
  ok(px("node -e 'process.exit(1)'") === "single-quotes" && px("npm test -- -t 'T-01'") === "single-quotes" && px("test \"$CI\" = 1") === "variable" &&
    px("echo ${HOME} $(pwd) 'x'") === "single-quotes+variable" && px("node -e \"process.exit(0)\"") === "" && px("node -e \"console.log('it is')\"") === "" &&
    px("echo it's done") === "" && px("grep -q \"foo$\" out.txt") === "" && px("awk '{print $1}' f") === "single-quotes" && px("npm test") === "" && px(undefined) === "",
    "posixShellSyntax: single-quoted strings outside double quotes and $VAR/${…}/$(…) are POSIX-only; an apostrophe in double quotes, a lone one, a regex '$\"' are not");
  const wsf = S.windowsShellFailure;
  ok(wsf("'grep' is not recognized as an internal or external command,\r\noperable program or batch file.", 1) && wsf("", 9009) &&
    wsf("'grep' não é reconhecido como um comando interno", 1) && wsf("\"grep\" no se reconoce como un comando interno o externo", 1) &&
    wsf("The syntax of the command is incorrect.", 1) && wsf("& was unexpected at this time.", 255) && wsf("The system cannot find the path specified.", 1) &&
    wsf("A sintaxe do comando está incorreta.", 1) && wsf("La sintaxis del comando no es correcta.", 1) &&
    wsf("O sistema não conseguiu localizar o caminho especificado.", 1) && // this machine's own pt-PT cmd.exe wording
    !wsf("AssertionError: expected 2 to equal 3\n    at tests/x.test.js:4", 1) && !wsf("1 failing", 1) && !wsf("Error: Cannot find module './x'", 1),
    "windowsShellFailure: cmd.exe's own failures (unknown command / exit 9009, its syntax errors, a path it can't find; EN/PT/ES) — never a check that ran and failed");
  // Review 4: cmd.exe / Windows PowerShell 5.1 write in the console's OEM code page (850 on a PT Windows); decoded as UTF-8, each
  // accented letter arrives as U+FFFD — "O sistema n?o conseguiu localizar…" read as a red run (an _Expect: fail_ task ticked on it).
  const RC = String.fromCharCode(0xfffd);
  const oemPs = (t) => (S.couldNotRunOutput(t) || {}).kind;
  ok(wsf("O sistema n" + RC + "o conseguiu localizar o caminho especificado.", 1) && wsf("'grep' n" + RC + "o " + RC + " reconhecido como um comando interno", 1) &&
    wsf("A sintaxe do comando est" + RC + " incorreta.", 1) && !wsf("not ok 1 - n" + RC + "o", 1) &&
    oemPs("Get-Greeting : O termo 'Get-Greeting' n" + RC + "o " + RC + " reconhecido como nome de cmdlet") === "test" &&
    oemPs("O m" + RC + "dulo especificado 'Pester' n" + RC + "o foi carregado") === "test" &&
    oemPs("n" + RC + "o pode ser carregado porque a execu" + RC + RC + "o de scripts foi desabilitada neste sistema") === "test",
    "review 4: cmd.exe's and Windows PowerShell 5.1's PT wording decoded from the OEM code page (each accented letter U+FFFD) is still read as the shell's own failure / a run that could not happen");
  // Review fixes. A line that only LOOKS like a fence opener must not hide the tasks below it (CommonMark):
  // "```npm test```" is inline code; a fence left open in a task's body ends with that list item; a fence
  // that never closes is plain text — the feature must not read as complete with real tasks still open.
  const fz = S.createFeature(w1, "Fence", ["core"]);
  const fzTasks = path.join(fz.dir, "tasks.md");
  const fzSeen = () => S.statusFeature(w1, "fence").tasks.list.map((t) => t.number + (t.done ? "x" : "")).join();
  fs.writeFileSync(fzTasks, "- [x] 1. Wire the runner\n  ```npm test``` must pass\n- [ ] 2. Ship it\n- [ ] 3. Docs\n");
  const fzC2 = S.completeTask(w1, "fence", 2);
  ok(fzC2.ok && fzC2.next.number === 3 && fzSeen() === "1x,2x,3" && S.statusFeature(w1, "fence").phase === "executing" && S.finishFeature(w1, "fence").openTasks.join() === "3",
    "a one-line ```code``` span is inline code, not a fence: the tasks below it stay visible to status/complete/finish");
  fs.writeFileSync(fzTasks, "- [x] 1. Add the helper\n  ```js\n  const x = 1;\n- [ ] 2. Ship it\n");
  const fzBody = S.taskBlocks(fs.readFileSync(fzTasks, "utf8"))[0].body;
  ok(fzSeen() === "1x,2" && S.nextTask(w1, "fence").next.number === 2 && fzBody.join("|") === "```js|const x = 1;", "an unclosed fence in a task's body ends with that list item (the next task is still a task)");
  fs.writeFileSync(fzTasks, "- [x] 1. a\n```js\n- [ ] 2. b\n");
  ok(fzSeen() === "1x,2" && S.statusFeature(w1, "fence").phase === "executing", "a top-level fence that never closes is plain text — it hides nothing");
  fs.writeFileSync(fzTasks, "- [x] 1. a\n```html\n<!-- header partial\n```\n- [ ] 2. b\n\nlater prose --> end\n");
  ok(fzSeen() === "1x,2", "a '<!--' inside fenced code is code, not the start of a comment that swallows the next task");
  fs.writeFileSync(fzTasks, "- [ ] 1. doc\n  ```md\n  - [ ] 9. example\n  ```\n~~~\n- [ ] 8. tilde example\n~~~\n- [ ] 2. b\n");
  ok(fzSeen() === "1,2", "closed fences (backtick in a task body, top-level tilde) still hide their task look-alikes");
  fs.writeFileSync(fzTasks, "\uFEFF```md\n- [ ] 9. example\n```\n- [ ] 1. real\n");
  ok(fzSeen() === "1" && S.completeTask(w1, "fence", 1).ok && fs.readFileSync(fzTasks, "utf8") === "\uFEFF```md\n- [ ] 9. example\n```\n- [x] 1. real\n",
    "a UTF-8 BOM is not indentation: a fence on the first line still hides its look-alikes (and the tick keeps the BOM)");
  // CommonMark closers — one rule (closesFence) for every fence-aware reader: a closer carries no info string and is at
  // least as long as its opener, so "```js" inside an open ``` block is code, and "```" never closes a ```` block.
  // "```js" used to close the block: the requirements below read inverted and AC-1 disappeared from EARS and trace.
  const fcReq = "# Feature: Fence\n\n## Acceptance Criteria\n```md\n```js\nconst shall = 1;\n```\n1. **US-1.AC-1** — WHEN asked THE SYSTEM SHALL answer.\n\n" +
    "````\n```\n2. **US-1.AC-9** — WHEN shown THE SYSTEM SHALL be an example.\n````\n";
  fs.writeFileSync(path.join(fz.dir, "requirements.md"), fcReq);
  fs.writeFileSync(fzTasks, "- [ ] 1. doc\n```\n```js\n- [ ] 9. example\n  - _Requirements: US-1.AC-9_\n```\n- [ ] 2. b\n  - _Requirements: US-1.AC-1_\n");
  const fcEars = S.earsValidate(fcReq);
  const fcTrace = S.traceCheck(w1, "fence");
  ok(fcEars.summary.criteriaDetected === 1 && fcEars.verdict === "pass" && fcTrace.totalAcs === 1 && fcTrace.coveredByTasks === 1 && !fcTrace.phantomAcsInTasks.length &&
    fzSeen() === "1,2", "a fence closer with an info string (```js) or shorter than its opener is code, never the closer: EARS, trace_check and the task scanner agree " +
    `(criteria ${fcEars.summary.criteriaDetected}, ACs ${fcTrace.totalAcs}, tasks ${fzSeen()})`);
  // Comment tokens inside `inline code` are literal text, never a comment spanning two task lines.
  fs.writeFileSync(fzTasks, "- [x] 1. Detect the `<!--` opener\n- [ ] 2. Detect the `-->` closer\n");
  const cmList = S.statusFeature(w1, "fence").tasks.list;
  ok(cmList.length === 2 && cmList[0].text === "Detect the `<!--` opener" && cmList[1].text === "Detect the `-->` closer" && S.completeTask(w1, "fence", 2).ok,
    "'<!--' / '-->' inside inline code spans don't form a comment (both tasks keep their full text; task 2 completes)");
  // Markers inside a fenced example under a task are the example's, never the task's: no _Verify:_ to run (brief,
  // complete_task, doctor, finish), no _Implements:_ planned file, no AC coverage in trace_check. The brief still shows it.
  fs.writeFileSync(path.join(fz.dir, "requirements.md"), "# Feature: Fence\n\n## Summary\nDocs.\n\n## Acceptance Criteria\n1. **US-1.AC-1** — WHEN asked THE SYSTEM SHALL answer.\n");
  fs.writeFileSync(fzTasks, "- [ ] 1. Document the task markers in the README\n  ```md\n  - [ ] 9. Example task\n    - _Requirements: US-1.AC-1_\n    - _Implements: src/example.js_\n" +
    "    - _Verify: node -e \"require('fs').writeFileSync('FENCED-VERIFY-RAN.txt','x')\"_\n  ```\n**Checkpoint:** docs\n");
  const fzBrief = S.taskBrief(w1, "fence", 1);
  const fzTrace = S.traceCheck(w1, "fence");
  const fzDone = S.completeTask(w1, "fence", 1);
  ok(fzBrief.ok && fzBrief.verify.length === 0 && fzBrief.implements.length === 0 && /_Verify: node -e/.test(fzBrief.brief) &&
    fzTrace.coveredByTasks === 0 && fzTrace.uncoveredByTasks.join() === "US-1.AC-1" && fzTrace.implementsFiles.length === 0 && fzTrace.plannedImplFiles.length === 0 &&
    fzDone.ok && fzDone.unverifiedReason === undefined && !S.verificationStatus(w1, "fence", fz.dir).unverified.length &&
    !S.finishFeature(w1, "fence").blockers.some((b) => /verification evidence/.test(b)),
    "a fenced example under a task lends it no _Verify:_ / _Implements:_ / AC coverage (brief, trace_check, complete_task, finish) — the brief still shows the example");
  // …nor AC / T-IDs to its brief: the example's US-2.AC-1 / T-02 / T-99 gave task 1 a foreign criterion and test, flipped
  // the loop to tdd and reported T-99 unresolved — while trace_check read US-2.AC-1 as uncovered.
  const fb = S.createFeature(w1, "Fence brief", ["core", "tdd"]);
  fs.writeFileSync(path.join(fb.dir, "requirements.md"), "# R\n\n## Acceptance Criteria\n\n1. **US-1.AC-1** — WHEN x THE SYSTEM SHALL y.\n2. **US-2.AC-1** — WHEN a THE SYSTEM SHALL b.\n");
  fs.writeFileSync(path.join(fb.dir, "test-plan.md"), "# TP\n\n| Test | AC |\n|---|---|\n| T-01 | US-1.AC-1 |\n| T-02 | US-2.AC-1 |\n");
  fs.writeFileSync(path.join(fb.dir, "tasks.md"), "# Tasks\n\n## Phase 1\n\n- [ ] 1. Write the docs page _Requirements: US-1.AC-1_\n  ```md\n" +
    "  Example of a task line: - [ ] 7. Foo _Requirements: US-2.AC-1_ _Makes green: T-02_ T-99\n  ```\n");
  const fbBrief = S.taskBrief(w1, "fence-brief", 1);
  ok(fbBrief.ok && fbBrief.loop === "core" && fbBrief.acceptanceCriteria.map((a) => a.id).join() === "US-1.AC-1" && fbBrief.tests.length === 0 &&
    !fbBrief.unresolved.acs.length && !fbBrief.unresolved.tests.length && /Example of a task line/.test(fbBrief.brief) &&
    S.traceCheck(w1, "fence-brief").uncoveredByTasks.join() === "US-2.AC-1",
    "spec_task_brief reads AC / T-IDs from the task's own text: a fenced example's IDs add no criterion, no test, no tdd loop, nothing unresolved (got " +
    JSON.stringify({ loop: fbBrief.loop, acs: (fbBrief.acceptanceCriteria || []).map((a) => a.id), tests: (fbBrief.tests || []).map((t) => t.id), unresolved: fbBrief.unresolved }) + ")");
  // A zero exit code with no command is a claim, not a run: it can't clear a recorded failed run (4d).
  const nr = S.createFeature(w1, "Norun", ["core"]);
  fs.writeFileSync(path.join(nr.dir, "tasks.md"), "- [ ] 1. no verify marker\n- [ ] 2. fresh\n");
  S.completeTask(w1, "norun", 1, { command: "npm test", exitCode: 1, summary: "1 failing" });
  const nr1 = S.completeTask(w1, "norun", 1, { exitCode: 0, summary: "all green" });
  const nrState = JSON.parse(fs.readFileSync(path.join(nr.dir, ".state.json"), "utf8")).evidence;
  const nr2 = S.completeTask(w1, "norun", 2, { exitCode: 0, summary: "proofread" });
  ok(nr1.ok && nr1.verified === false && nr1.unverifiedReason === "failed-run" && nrState["1"].exitCode === 1 && nrState["1"].note === "all green" &&
    S.verificationStatus(w1, "norun", nr.dir).unverifiedDetail.some((d) => d.number === 1 && d.reason === "failed-run") && nr2.verified === true,
    "{summary, exitCode: 0} without a command after a failed run stays failed-run (only a passing COMMAND run clears it); on a fresh check it is a plain attestation");
  // Evidence is stamped with its task: a duplicated number never lends one task's passing run to the other.
  const dv = S.createFeature(w1, "Dupev", ["core"]);
  fs.writeFileSync(path.join(dv.dir, "tasks.md"), "- [ ] 3. a\n  - _Verify: node -e 0_\n- [ ] 3. b\n  - _Verify: node -e \"process.exit(7)\"_\n");
  const dv1 = S.completeTask(w1, "dupev", 3, { command: "node -e 0", exitCode: 0 });
  const dv2 = S.completeTask(w1, "dupev", 3);
  const dvDoc = S.specDoctor(w1, "dupev").checks.find((c) => c.id === "verification");
  const dvFin = S.finishFeature(w1, "dupev");
  ok(dv1.ok && dv1.verified && dv2.ok && dv2.verified === false && dv2.unverifiedReason === "duplicate-number" && /renumber/.test(dv2.note) &&
    S.statusFeature(w1, "dupev").tasks.list.map((t) => t.text + ":" + t.verified).join() === "a:true,b:false" &&
    dvDoc.status === "warn" && /#3 \(number shared with another task\)/.test(dvDoc.detail) && dvFin.unverified.includes(3) &&
    /3\. a — `node -e 0` → exit 0/.test(dvFin.mergeSummary) && /3\. b — /.test(dvFin.mergeSummary) && !/3\. b — `node -e 0`/.test(dvFin.mergeSummary),
    "the second '3.' ticked without its own run is unverified (duplicate-number) in complete, status, doctor and spec_finish — never 'verified' by the first one's run");
  const dvRun = S.completeTask(w1, "dupev", 3, { command: "node -e 0", exitCode: 0 }); // both ticked → resolves to the first
  ok(dvRun.verified && S.statusFeature(w1, "dupev").tasks.list[1].verified === false, "re-verifying a duplicated number credits only the task it resolves to");
  // Round 2. The stamp is the title AND the _Verify:_: a copy-paste duplicate (same title, other command) can't
  // borrow the first one's run, and renumbering can't hand one task's passing run to the other (whose own
  // failed run is kept under `others`, never discarded).
  const rn = S.createFeature(w1, "Renum", ["core"]);
  const rnTasks = path.join(rn.dir, "tasks.md");
  const rnEv = () => JSON.parse(fs.readFileSync(path.join(rn.dir, ".state.json"), "utf8")).evidence;
  fs.writeFileSync(rnTasks, "- [ ] 3. a\n  - _Verify: node -e \"process.exit(7)\"_\n- [ ] 3. b\n  - _Verify: node -e \"process.exit(0)\"_\n");
  const rn1 = S.completeTask(w1, "renum", 3, { command: "node -e \"process.exit(7)\"", exitCode: 7 });
  const rn2 = S.completeTask(w1, "renum", 3);
  const rn3 = S.completeTask(w1, "renum", 3, { command: "node -e \"process.exit(0)\"", exitCode: 0 });
  fs.writeFileSync(rnTasks, fs.readFileSync(rnTasks, "utf8").replace("- [x] 3. b", "- [x] 4. b")); // as the duplicate-tasks warn advises
  const rnSeen = () => S.statusFeature(w1, "renum").tasks.list.map((t) => t.number + t.text + ":" + t.verified).join();
  const rnVs = S.verificationStatus(w1, "renum", rn.dir);
  ok(rn1.recorded && rn2.ok && rn2.unverifiedReason === "failed-run" && rn3.ok && rn3.verified && rnSeen() === "3a:false,4b:false" &&
    rnVs.unverifiedDetail.map((d) => d.number + ":" + d.reason).join() === "3:failed-run,4:no-evidence" &&
    rnEv()["3"].task === "b" && rnEv()["3"].others.length === 1 && rnEv()["3"].others[0].task === "a" && rnEv()["3"].others[0].exitCode === 7 && rnEv()["3"].others[0].history.length === 1,
    "after renumbering, #3 keeps its OWN failed run (kept under others) — never 'verified' by the other task's passing run");
  const rn4 = S.completeTask(w1, "renum", 4, { command: "node -e \"process.exit(0)\"", exitCode: 0 });
  const rn5 = S.completeTask(w1, "renum", 3, { command: "node -e \"process.exit(7)\"", exitCode: 0 });
  ok(rn4.verified && rn5.verified && rnSeen() === "3a:true,4b:true" && rnEv()["3"].task === "a" && rnEv()["3"].history.map((h) => h.exitCode).join() === "7,0" && rnEv()["3"].others[0].task === "b",
    "each task is verified only by its own passing run; the re-run task's history continues where it left off");
  fs.writeFileSync(rnTasks, "- [ ] 5. Run the checks\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 5. Run the checks\n  - _Verify: node -e \"process.exit(7)\"_\n");
  const cp1 = S.completeTask(w1, "renum", 5, { command: "node -e \"process.exit(0)\"", exitCode: 0 });
  const cp2 = S.completeTask(w1, "renum", 5);
  ok(cp1.verified && cp2.ok && cp2.verified === false && cp2.unverifiedReason === "duplicate-number" &&
    S.specDoctor(w1, "renum").checks.find((c) => c.id === "verification").status === "warn",
    "a copy-paste duplicate (same number AND title, another _Verify:_) never borrows the first one's run");
  // Outside duplicates the _Verify:_ stamp alone decides: a title edit keeps the evidence, an edited command
  // doesn't (stale-evidence); an unstamped v1.12 record still counts.
  const sv = S.createFeature(w1, "Stale", ["core"]);
  const svTasks = path.join(sv.dir, "tasks.md");
  fs.writeFileSync(svTasks, "- [ ] 1. Build\n  - _Verify: npm test_\n- [x] 2. Legacy\n  - _Verify: npm run lint_\n");
  S.completeTask(w1, "stale", 1, { command: "npm test", exitCode: 0 });
  const svState = JSON.parse(fs.readFileSync(path.join(sv.dir, ".state.json"), "utf8"));
  svState.evidence["2"] = { command: "npm run lint", exitCode: 0, summary: "clean", at: "2026-01-01T00:00:00.000Z" };
  fs.writeFileSync(path.join(sv.dir, ".state.json"), JSON.stringify(svState));
  fs.writeFileSync(svTasks, "- [x] 1. Build the parser\n  - _Verify: npm test_\n- [x] 2. Legacy\n  - _Verify: npm run lint_\n");
  const svRenamed = S.statusFeature(w1, "stale").tasks.list.map((t) => t.verified).join();
  fs.writeFileSync(svTasks, "- [x] 1. Build the parser\n  - _Verify: npm run test:unit_\n- [x] 2. Legacy\n  - _Verify: npm run lint_\n");
  const svDoc = S.specDoctor(w1, "stale").checks.find((c) => c.id === "verification");
  const svAgain = S.completeTask(w1, "stale", 1);
  ok(svRenamed === "true,true" && S.statusFeature(w1, "stale").tasks.list[0].verified === false && /#1 \(evidence is for another task or _Verify:_ command\)/.test(svDoc.detail) &&
    svAgain.unverifiedReason === "stale-evidence" && /--run/.test(svAgain.note) && S.statusFeature(w1, "stale").tasks.list[1].verified === true,
    "a title edit keeps the evidence; an edited _Verify:_ command makes it stale-evidence; a v1.12 record without stamps still verifies");
  // ROADMAP.md "needs attention" names each unverified task and WHY (the per-task reasons doctor/spec_finish give,
  // localized in the roadmap's language) — it used to print only a count ("5 task(s) ticked without verification evidence").
  const rsDir = path.join(tmp, "proj-reasons");
  const rs = S.createFeature(rsDir, "Reasons", ["core"]);
  const rsTasks = path.join(rs.dir, "tasks.md");
  fs.writeFileSync(rsTasks, "- [ ] 1. a\n  - _Verify: npm test_\n- [ ] 2. b\n  - _Verify: npm test_\n- [ ] 3. c\n  - _Verify: npm test_\n" +
    "- [ ] 4. d\n  - _Verify: npm run lint_\n- [ ] 5. e\n  - _Verify: node -e 0_\n- [ ] 5. f\n  - _Verify: node -e 1_\n- [ ] 6. g\n");
  S.completeTask(rsDir, "reasons", 1, { command: "npm test", exitCode: 1, summary: "1 failing" }); // refused, recorded
  S.completeTask(rsDir, "reasons", 1, { summary: "fine now" }); // failed-run
  S.completeTask(rsDir, "reasons", 2, "looks fine"); // manual-note-on-runnable-verify
  S.completeTask(rsDir, "reasons", 3); // no-evidence
  S.completeTask(rsDir, "reasons", 4, { command: "npm run lint", exitCode: 0 });
  S.completeTask(rsDir, "reasons", 5, { command: "node -e 0", exitCode: 0 });
  S.completeTask(rsDir, "reasons", 5); // the second '5.': duplicate-number
  S.completeTask(rsDir, "reasons", 6); // no _Verify:_, nothing recorded: nothing to verify — never listed
  fs.writeFileSync(rsTasks, fs.readFileSync(rsTasks, "utf8").replace("npm run lint", "npm run lint:strict")); // stale-evidence
  const rsLine = (md) => (md.split("\n").find((l) => l.startsWith("- **reasons** — ") && l.includes(": #1 (")) || "").replace("- **reasons** — ", "");
  S.writeRoadmapMd(rsDir); // a hand edit of tasks.md refreshes nothing (the hook does that in a session)
  const rsEn = rsLine(fs.readFileSync(path.join(rsDir, ".specs", "ROADMAP.md"), "utf8"));
  const rsPt = rsLine(S.renderRoadmapMd(rsDir, "pt"));
  const rsEs = rsLine(S.renderRoadmapMd(rsDir, "es"));
  const rsHtml = S.renderRoadmapHtml(rsDir, "en");
  ok(rsEn === "5 task(s) ticked without verification evidence: #1 (latest run failed), #2 (note only, _Verify:_ command not run), #3, " +
      "#4 (evidence is for another task or _Verify:_ command), #5 (number shared with another task)" &&
    rsPt === "5 tarefa(s) marcada(s) sem evidência de verificação: #1 (a última execução falhou), #2 (só uma nota, comando _Verify:_ por correr), #3, " +
      "#4 (evidência de outra tarefa ou de outro comando _Verify:_), #5 (número partilhado com outra tarefa)" &&
    rsEs === "5 tarea(s) marcada(s) sin evidencia de verificación: #1 (la última ejecución falló), #2 (solo una nota, comando _Verify:_ sin ejecutar), #3, " +
      "#4 (evidencia de otra tarea o de otro comando _Verify:_), #5 (número compartido con otra tarea)" &&
    rsHtml.includes("#1 (latest run failed), #2 (note only, _Verify:_ command not run), #3,") &&
    S.specDoctor(rsDir, "reasons").checks.find((c) => c.id === "verification").detail === "ticked without verification evidence: " + rsEn.slice(rsEn.indexOf(": ") + 2),
    "ROADMAP.md / .html 'needs attention' names each unverified task with its localized reason (failed-run, note-only, no-evidence, stale, duplicate) — the same list doctor gives " +
    `(EN: ${rsEn})`);
  // Scanner: only a "<!--" that starts its line may span lines; an inline one ends with its paragraph (never
  // past the next task line), and a "-->" in a code span or fenced code is not a closer.
  const cmF = S.createFeature(w1, "Cmt", ["core"]);
  const cmTasks = path.join(cmF.dir, "tasks.md");
  const cmSeen = () => S.statusFeature(w1, "cmt").tasks.list.map((t) => t.number + (t.done ? "x" : "")).join();
  fs.writeFileSync(cmTasks, "- [x] 1. Strip <!-- markers in the parser\n- [ ] 2. Handle the `-->` closer\n- [ ] 3. Docs\n");
  const cm2 = S.completeTask(w1, "cmt", 2);
  ok(cm2.ok && cm2.next.number === 3 && cmSeen() === "1x,2x,3", "an inline '<!--' doesn't open a comment across task lines (a '-->' in inline code below doesn't close it)");
  fs.writeFileSync(cmTasks, "- [x] 1. Build the parser <!-- see notes\n- [ ] 2. Ship\n\n## Notes\n```html\n<!-- keep -->\n```\n");
  ok(cmSeen() === "1x,2" && S.statusFeature(w1, "cmt").phase === "executing" && S.listFeatures(w1).features.find((x) => x.name === "cmt").tasks === 2,
    "an inline '<!--' + a fenced '<!-- keep -->' below: the open task stays visible (phase executing, list 1/2)");
  fs.writeFileSync(cmTasks, "<!-- stray note\n- [x] 1. a\n- [ ] 2. b\n```html\n<!-- keep -->\n```\n");
  ok(cmSeen() === "1x,2", "a line-start '<!--' whose only '-->' sits in fenced code is plain text");
  fs.writeFileSync(cmTasks, "- [ ] 1. a <!-- example:\n  _Verify: node -e \"process.exit(3)\"_ -->\n- [ ] 2. b\n");
  const cmBlocks = S.taskBlocks(fs.readFileSync(cmTasks, "utf8"));
  ok(cmBlocks.length === 2 && cmBlocks[0].text === "a" && cmBlocks[0].body.length === 0 && S.taskBrief(w1, "cmt", 1).verify.length === 0, "an inline comment continued on the task's next line still hides its content (no hidden _Verify:_ runs)");
  const cmBig = Array.from({ length: 3000 }, (_, i) => "- [ ] " + (i + 1) + ". a <!-- b").join("\n") + "\n-->\n";
  ok(S.parseTasks(cmBig).length === 3000, "thousands of inline '<!--' followed by one '-->' are still thousands of tasks");
  // No literal U+FEFF in shipped engine code (the scan_skill hidden-unicode rule): the escape is used instead.
  const BOM = String.fromCharCode(0xfeff);
  const engineFiles = [...libSources(), ...["mcp/server.js", "cli/dev-spec.js", "cli/main.js", "cli/commands.js", "cli/run.js", "cli/git.js", "hooks/spec-hook.js", "hooks/precommit-check.js", "scripts/build.js"]
    .map((f) => path.join(__dirname, "..", f))].filter((f) => fs.existsSync(f));
  ok(engineFiles.length >= 8 && engineFiles.every((f) => !fs.readFileSync(f, "utf8").includes(BOM)), "no literal U+FEFF (BOM) in the shipped engine files (every mcp/lib source, its modules included, and scripts/build.js — the generated bundle's registry)");
  }

  // --- 1.13 WP7: spec_append_tasks (converge) — appended tasks work end to end, all-or-nothing, line-exact ---
  {
    const call7 = async (name, args) => { const r = await rpc("tools/call", { name, arguments: args }); return { isError: r.result.isError === true, p: payload(r) }; };
    const w7 = path.join(tmp, "proj-wp7");
    S.initProject(w7, ["tdd"]);
    const cf = S.createFeature(w7, "Converge", ["tdd"]);
    const cTasks = path.join(cf.dir, "tasks.md");
    fs.writeFileSync(path.join(cf.dir, "requirements.md"), "# Requirements\n\n### US-1 (P1)\n\n#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN a user saves THE SYSTEM SHALL store the draft\n" +
      "2. **US-1.AC-2** — WHEN the parser meets a BOM THE SYSTEM SHALL skip it\n3. **US-1.AC-3** — WHEN the writer runs THE SYSTEM SHALL keep CRLF endings\n");
    fs.writeFileSync(path.join(cf.dir, "test-plan.md"), "| Test ID | Covers |\n|---|---|\n| T-01 | US-1.AC-1 |\n");
    const cOrig = "# Tasks: Converge\n\n## Global Constraints\n- Node >= 20\n\n## Story US-1 (P1 — MVP)\n- [x] 1. [US1] Core behavior\n  - _Requirements: US-1.AC-1_\n" +
      "- [x] 2. [US1] Second step\n  - _Requirements: US-1.AC-1_\n**Checkpoint:** US-1 works.\n";
    fs.writeFileSync(cTasks, cOrig);
    S.approvePhase(w7, "converge", "tasks", "tester", { force: true }); // template tasks: forced past the (WP5) approve gate
    const vCmd = 'node -e "process.exit(0)"';
    const ap = await call7("spec_append_tasks", { name: "converge", projectDir: w7, tasks: [
      { text: "Skip the BOM in the parser", requirements: ["US-1.AC-2"], implements: ["src\\parser.js"], verify: vCmd, story: "US1", parallel: true },
      { text: "Keep CRLF in the writer", requirements: ["us-1.ac-3"], implements: ["./src/writer.js"], story: "US1", parallel: true },
      { text: "[shared] Document the drift" },
    ] });
    const cNow = fs.readFileSync(cTasks, "utf8");
    const cSection = "\n## Phase: Convergence\n- [ ] 3. [US1][P] Skip the BOM in the parser\n  - _Requirements: US-1.AC-2_\n  - _Implements: src/parser.js_\n  - _Verify: " + vCmd + "_\n" +
      "- [ ] 4. [US1][P] Keep CRLF in the writer\n  - _Requirements: US-1.AC-3_\n  - _Implements: src/writer.js_\n- [ ] 5. [shared] Document the drift\n" +
      "**Checkpoint:** the convergence tasks are done and verified — the spec and the code agree again.\n";
    ok(!ap.isError && ap.p.ok && ap.p.headingCreated === true && ap.p.heading === "Phase: Convergence" && ap.p.appended.map((t) => t.number).join() === "3,4,5" && cNow === cOrig + cSection,
      "spec_append_tasks appends a new 'Phase: Convergence' (max+1 numbering, [USn][P] tags, English-stable markers, forward-slash paths, closing Checkpoint) — existing lines untouched");
    ok(ap.p.needsReapproval === true && /re-approve: \/approve converge tasks/.test(ap.p.note) && S.nextAction(w7, "converge").changedSinceApproval.includes("tasks.md"),
      "appending after a tasks approval → needsReapproval + note, and next_action lists tasks.md as changed since approval");
    const apSt = (await call7("spec_status", { name: "converge", projectDir: w7 })).p;
    ok(apSt.tasks.total === 5 && apSt.tasks.next.number === 3 && apSt.tasks.list.filter((t) => t.parallel).map((t) => t.number).join() === "3,4" && apSt.tasks.list.find((t) => t.number === 5).story === "shared",
      "spec_status counts the appended tasks (next = #3, [P] and story read back)");
    const apNx = (await call7("spec_next_task", { name: "converge", batch: true, projectDir: w7 })).p;
    ok(apNx.next.number === 3 && JSON.stringify(apNx.batch.map((b) => [b.number, b.implements])) === JSON.stringify([[3, ["src/parser.js"]], [4, ["src/writer.js"]]]),
      "spec_next_task batch pairs the appended [P] tasks by their disjoint _Implements:_ files (the non-[P] #5 ends it)");
    const apBr = (await call7("spec_task_brief", { name: "converge", number: 3, projectDir: w7 })).p;
    ok(apBr.acceptanceCriteria.length === 1 && apBr.acceptanceCriteria[0].id === "US-1.AC-2" && /meets a BOM THE SYSTEM SHALL skip it/.test(apBr.acceptanceCriteria[0].text) &&
      apBr.verify.join() === vCmd && apBr.unresolved.acs.length === 0 && apBr.task.phase === "Phase: Convergence" && /spec and the code agree again/.test(apBr.task.checkpoint) &&
      apBr.brief.includes("- `" + vCmd + "`"), "spec_task_brief on an appended task resolves its AC to the EARS text and carries its _Verify:_ command + checkpoint");
    const apNoEv = (await call7("spec_complete_task", { name: "converge", number: 3, projectDir: w7 })).p;
    const apEv = (await call7("spec_complete_task", { name: "converge", number: 3, evidence: { command: vCmd, exitCode: 0, summary: "ok" }, projectDir: w7 })).p;
    const apEv4 = (await call7("spec_complete_task", { name: "converge", number: 4, evidence: { summary: "writer keeps CRLF (checked by hand)" }, projectDir: w7 })).p;
    const apEv5 = (await call7("spec_complete_task", { name: "converge", number: 5, projectDir: w7 })).p;
    ok(apNoEv.ok && apNoEv.verified === false && apEv.ok && apEv.alreadyDone && apEv.verified === true && apEv4.verified === true && apEv5.ok && apEv5.done === 5 && apEv5.next === null,
      "spec_complete_task on appended tasks: the runnable _Verify:_ needs its passing run (back-filled), a manual one takes a note");
    const apFin = (await call7("spec_finish", { name: "converge", projectDir: w7 })).p;
    ok(apFin.ok && apFin.openTasks.length === 0 && apFin.unverified.length === 0 && apFin.mergeSummary.includes("- [x] 3. Skip the BOM in the parser — `" + vCmd + "` → exit 0 · ok") &&
      apFin.mergeSummary.includes("- [x] 5. Document the drift"), "spec_finish lists the appended tasks with their evidence (none open, none unverified)");
    ok(S.traceCheck(w7, "converge").phantomAcsInTasks.length === 0, "appended _Requirements:_ never introduce a phantom AC in trace_check");

    // Reuse: the default heading again → the same phase, before its closing checkpoint; a custom existing heading too.
    const beforeReuse = fs.readFileSync(cTasks, "utf8");
    const ap2 = S.appendTasks(w7, "converge", [{ text: "Follow-up" }]);
    const ap3 = S.appendTasks(w7, "converge", [{ text: "Story fix", requirements: ["US-1.AC-1"] }], { heading: "## Story US-1 (P1 — MVP)" });
    const reuseTxt = fs.readFileSync(cTasks, "utf8");
    const reuseBlocks = S.taskBlocks(reuseTxt);
    ok(ap2.ok && ap2.headingCreated === false && ap2.appended[0].number === 6 && reuseTxt.includes("- [x] 5. [shared] Document the drift\n- [ ] 6. Follow-up\n**Checkpoint:** the convergence") &&
      reuseTxt.split("## Phase: Convergence").length === 2, "an existing 'Phase: Convergence' is reused: the task goes at the end of that phase, before its closing checkpoint");
    ok(ap3.ok && ap3.heading === "Story US-1 (P1 — MVP)" && reuseTxt.includes("  - _Requirements: US-1.AC-1_\n- [ ] 7. Story fix\n  - _Requirements: US-1.AC-1_\n**Checkpoint:** US-1 works.") &&
      reuseBlocks.find((b) => b.number === 7).checkpoint === "US-1 works." && reuseBlocks.filter((b) => b.number < 6).every((b) => b.done) &&
      reuseTxt.replace("- [ ] 6. Follow-up\n", "").replace("- [ ] 7. Story fix\n  - _Requirements: US-1.AC-1_\n", "") === beforeReuse,
      "heading → an existing phase gets the task before ITS checkpoint; nothing else in tasks.md changed");

    // All-or-nothing validation: a phantom AC (with a valid task beside it), bad paths/story/verify/heading write nothing.
    const frozen = fs.readFileSync(cTasks, "utf8");
    const ph = await call7("spec_append_tasks", { name: "converge", projectDir: w7, tasks: [{ text: "ok one", requirements: ["US-1.AC-1"] }, { text: "bad", requirements: ["US-1.AC-9", "US-7.AC-1"] }] });
    ok(ph.isError && ph.p.ok === false && /US-1\.AC-9, US-7\.AC-1/.test(ph.p.error) && /Nothing was written/.test(ph.p.error) && ph.p.phantom.join() === "US-1.AC-9,US-7.AC-1" &&
      fs.readFileSync(cTasks, "utf8") === frozen, "phantom AC IDs → localized error listing them (isError) and NOTHING is written, not even the valid task");
    const bads = [
      [{ text: "x", implements: ["../outside.js"] }], [{ text: "x", implements: ["/etc/passwd"] }], [{ text: "x", implements: ["C:\\repo\\a.js"] }],
      [{ text: "x", story: "P1" }], [{ text: "x", verify: "npm test\nrm -rf /" }], [{ text: "x", verify: "pytest -k 'a_ b'" }], [{ text: "   " }], [{ text: "[US1][P]" }], [],
    ].map((t) => S.appendTasks(w7, "converge", t));
    const badHeads = [S.appendTasks(w7, "converge", [{ text: "x" }], { heading: "Global Constraints" }), S.appendTasks(w7, "converge", [{ text: "x" }], { heading: "a\nb" })];
    ok(bads.concat(badHeads).every((r) => r.ok === false && r.error) && /relative to the project root, without '\.\.'/.test(bads[0].error) && /relative/.test(bads[1].error) && /relative/.test(bads[2].error) &&
      /US<n>/.test(bads[3].error) && /single-line/.test(bads[4].error) && /would not read back/.test(bads[5].error) && /text is required/.test(bads[6].error) && /text is required/.test(bads[7].error) &&
      /at least one task/.test(bads[8].error) && /constraints/.test(badHeads[0].error) && /one line/.test(badHeads[1].error) && fs.readFileSync(cTasks, "utf8") === frozen,
      "bad paths (.., absolute, drive), story, multi-line/unstorable _Verify:_, empty text, no tasks, a non-phase heading: localized errors, nothing written");
    const hid = S.appendTasks(w7, "converge", [{ text: "fix <!-- hidden --> parser" }]);
    ok(hid.ok === false && /task 8 would not read back as written/.test(hid.error) && fs.readFileSync(cTasks, "utf8") === frozen,
      "a task that would not read back as written (an inline comment hides part of it) is refused — the read-back check writes nothing");
    const noTasksArg = await rpc("tools/call", { name: "spec_append_tasks", arguments: { name: "converge", projectDir: w7 } });
    const badItem = await rpc("tools/call", { name: "spec_append_tasks", arguments: { name: "converge", projectDir: w7, tasks: [{ text: 123 }] } });
    const apTool = list.result.tools.find((t) => t.name === "spec_append_tasks");
    ok(apTool && apTool.inputSchema.required.join() === "name,tasks" && apTool.inputSchema.properties.tasks.items.required.join() === "text" &&
      noTasksArg.result.isError && /Missing required argument\(s\): tasks/.test(payload(noTasksArg).error) && badItem.result.isError && /tasks\[0\]\.text must be a string/.test(payload(badItem).error),
      "spec_append_tasks is advertised (name + tasks required, items need text) and its arguments are schema-checked");

    // Line endings: CRLF + BOM kept exactly; a CRLF file without a final newline keeps having none.
    const crF = S.createFeature(w7, "Crlf", ["core"]);
    const crTasks = path.join(crF.dir, "tasks.md");
    const BOM7 = String.fromCharCode(0xfeff);
    const crOrig = BOM7 + "# Tasks: Crlf\r\n\r\n## Phase: Setup\r\n- [ ] 1. [shared] Set up\r\n**Checkpoint:** ready.\r\n";
    fs.writeFileSync(crTasks, crOrig);
    const crR = S.appendTasks(w7, "crlf", [{ text: "Converge the setup", implements: ["src/setup.js"] }]);
    const crNow = fs.readFileSync(crTasks, "utf8");
    ok(crR.ok && crNow.startsWith(crOrig) && crNow.startsWith(BOM7) && crNow.split(BOM7).length === 2 && !/[^\r]\n/.test(crNow) &&
      crNow.endsWith("\r\n\r\n## Phase: Convergence\r\n- [ ] 2. Converge the setup\r\n  - _Implements: src/setup.js_\r\n**Checkpoint:** the convergence tasks are done and verified — the spec and the code agree again.\r\n") &&
      S.completeTask(w7, "crlf", 2).ok && /- \[x\] 2\. Converge the setup\r\n/.test(fs.readFileSync(crTasks, "utf8")),
      "a CRLF tasks.md with a BOM: every existing byte kept, new lines CRLF, BOM still first — and the appended task can be ticked");
    fs.writeFileSync(crTasks, "# Tasks: Crlf\r\n\r\n## Phase: Convergence\r\n- [ ] 1. a\r\n- [x] 2. b");
    const crR2 = S.appendTasks(w7, "crlf", [{ text: "c" }]);
    ok(crR2.ok && crR2.headingCreated === false && fs.readFileSync(crTasks, "utf8") === "# Tasks: Crlf\r\n\r\n## Phase: Convergence\r\n- [ ] 1. a\r\n- [x] 2. b\r\n- [ ] 3. c",
      "a CRLF tasks.md with no final newline: the last line is ended with CRLF and the file still has no final newline");
    fs.writeFileSync(crTasks, BOM7);
    const crR3 = S.appendTasks(w7, "crlf", [{ text: "first" }]);
    // numbered 3: task 2's tick time is still on record (a removed task's number is never reused — full review C5)
    ok(crR3.ok && fs.readFileSync(crTasks, "utf8").startsWith(BOM7 + "\n## Phase: Convergence\n- [ ] 3. first\n") && S.taskBlocks(fs.readFileSync(crTasks, "utf8"))[0].phase === "Phase: Convergence",
      "a BOM-only tasks.md: the new heading starts one line down (a BOM'd first line is not read as a heading)");

    // PT feature: localized default heading, checkpoint and errors; markers stay English-stable.
    const ptF = S.createFeature(w7, "Convergência", ["core"], undefined, undefined, "pt");
    S.approvePhase(w7, "convergencia", "tasks", "tester", { force: true });
    const ptR = await call7("spec_append_tasks", { name: "Convergência", projectDir: w7, tasks: [{ text: "Corrigir o desvio", requirements: ["US-1.AC-2"], verify: "npm test", story: "US1" }] });
    const ptTxt = fs.readFileSync(path.join(ptF.dir, "tasks.md"), "utf8");
    const ptPh = S.appendTasks(w7, "convergencia", [{ text: "x", requirements: ["US-3.AC-3"] }]);
    ok(ptR.p.ok && ptR.p.heading === "Fase: Convergência" && /\n## Fase: Convergência\n- \[ \] \d+\. \[US1\] Corrigir o desvio\n  - _Requirements: US-1\.AC-2_\n  - _Verify: npm test_\n\*\*Checkpoint:\*\* as tarefas de convergência estão concluídas/.test(ptTxt) &&
      /Critérios de aceitação desconhecidos \(não estão em requirements\.md\): US-3\.AC-3\. Nada foi escrito/.test(ptPh.error) && S.statusFeature(w7, "convergencia").tasks.list.some((t) => t.text === "[US1] Corrigir o desvio") &&
      ptR.p.needsReapproval === true && /revê as novas tarefas e volta a aprovar: \/approve convergencia tasks/.test(ptR.p.note),
      "PT feature: 'Fase: Convergência' + PT checkpoint, English-stable markers, PT phantom error and re-approval note; status counts the task");
    const esF = S.createFeature(w7, "Convergencia ES", ["core"], undefined, undefined, "es");
    const esR = S.appendTasks(w7, "convergencia-es", [{ text: "Corregir la desviación", story: "US-2" }]);
    ok(esR.ok && esR.heading === "Fase: Convergencia" && /\n## Fase: Convergencia\n- \[ \] \d+\. \[US2\] Corregir la desviación\n\*\*Checkpoint:\*\* las tareas de convergencia/.test(fs.readFileSync(path.join(esF.dir, "tasks.md"), "utf8")) &&
      /Tarea 1: story debe ser US<n>/.test(S.appendTasks(w7, "convergencia-es", [{ text: "x", story: "historia" }]).error), "ES feature: 'Fase: Convergencia' + ES checkpoint and errors ('US-2' → [US2])");

    // Removed track: its trailing task section stays after the new phase, and its heading is refused.
    const rtF = S.createFeature(w7, "Tracked", ["core"]);
    const rtTasks = path.join(rtF.dir, "tasks.md");
    S.addTrack(w7, "tracked", "ai");
    S.addTrack(w7, "tracked", "ai", { remove: true });
    const rtBefore = fs.readFileSync(rtTasks, "utf8");
    const rtMax = Math.max(...S.parseTasks(rtBefore).map((t) => t.number));
    const rtR = S.appendTasks(w7, "tracked", [{ text: "Converge without AI" }]);
    const rtTxt = fs.readFileSync(rtTasks, "utf8");
    const rtNew = rtTxt.indexOf("## Phase: Convergence"), rtAi = rtTxt.indexOf("## Story US-1 — AI");
    const rtSt = S.statusFeature(w7, "tracked");
    const rtHead = S.appendTasks(w7, "tracked", [{ text: "x" }], { heading: "Story US-1 — AI" });
    ok(rtR.ok && rtR.appended[0].number === rtMax + 1 && rtNew > 0 && rtAi > rtNew && rtSt.tasks.list.some((t) => t.number === rtMax + 1) &&
      rtTxt.replace(/\n## Phase: Convergence\n- \[ \] \d+\. Converge without AI\n\*\*Checkpoint:\*\* [^\n]*\n\n/, "\n") === rtBefore &&
      rtHead.ok === false && /inactive \+ai track/.test(rtHead.error) && fs.readFileSync(rtTasks, "utf8") === rtTxt,
      "after add_track --remove ai the new phase goes after the last ACTIVE phase (before the inactive AI section), counts in status; the AI heading is refused");

    // A removed task's leftover evidence is never inherited: the new task is numbered past it.
    const evF = S.createFeature(w7, "Leftover", ["core"]);
    fs.writeFileSync(path.join(evF.dir, "tasks.md"), "# Tasks\n\n## Phase: Build\n- [x] 1. a\n");
    const evState = JSON.parse(fs.readFileSync(path.join(evF.dir, ".state.json"), "utf8"));
    evState.evidence = { "2": { command: "npm test", exitCode: 0, at: "2026-01-01T00:00:00Z", task: "old task", verify: "npm test" } };
    fs.writeFileSync(path.join(evF.dir, ".state.json"), JSON.stringify(evState));
    const evR = S.appendTasks(w7, "leftover", [{ text: "new work", verify: "npm test" }]);
    ok(evR.ok && evR.appended[0].number === 3 && S.statusFeature(w7, "leftover").tasks.list.find((t) => t.number === 3).verified === false,
      "a number that still has a removed task's evidence is skipped (the new task never inherits that run)");
  }

  // --- 1.13 WP7 review fixes: closing checkpoint as a reader sees it, verify/paths/heading read back as given ---
  {
    const w7r = path.join(tmp, "proj-wp7-review");
    S.initProject(w7r, ["core"]);
    const mk7 = (name, body, lang) => { const f = S.createFeature(w7r, name, ["core"], undefined, undefined, lang); const p = path.join(f.dir, "tasks.md"); fs.writeFileSync(p, body); return p; };
    // A comment, a '---' or a note after a reused phase's checkpoint: the task still goes BEFORE it (same section,
    // so next --batch pairs it with #1), and the trailer stays where it was.
    const trailers = ["<!-- guidance: keep this phase small -->\n", "\n---\n", "Note: ship it after QA.\n"];
    const cpRes = trailers.map((tr, k) => {
      const file = mk7("Cp " + k, "# Tasks: f\n\n## Phase: Build\n- [ ] 1. [P] a\n  - _Implements: src/a.js_\n**Checkpoint:** build works.\n" + tr + "\n## Phase: Polish\n- [ ] 2. b\n");
      const r = S.appendTasks(w7r, "cp-" + k, [{ text: "c", parallel: true, implements: ["src/c.js"] }], { heading: "Phase: Build" });
      const txt = fs.readFileSync(file, "utf8");
      const b3 = S.taskBlocks(txt).find((b) => b.number === 3);
      return r.ok && txt.includes("  - _Implements: src/a.js_\n- [ ] 3. [P] c\n  - _Implements: src/c.js_\n**Checkpoint:** build works.\n" + tr) && b3 && b3.checkpoint === "build works." &&
        S.nextTask(w7r, "cp-" + k, { batch: true }).batch.map((b) => b.number).join() === "1,3";
    });
    ok(cpRes.every(Boolean), "reused phase: a comment / '---' / note after its checkpoint doesn't move it — the task goes before it, keeps that checkpoint and batches with #1");
    // The tool's own default phase, reused after the user added '---' below it (CRLF file): still before the checkpoint.
    const dfFile = mk7("Cp default", "# Tasks\r\n\r\n## Phase: Convergence\r\n- [ ] 1. a\r\n**Checkpoint:** converged.\r\n\r\n---\r\n");
    const dfR = S.appendTasks(w7r, "cp-default", [{ text: "b" }]);
    ok(dfR.ok && dfR.headingCreated === false && fs.readFileSync(dfFile, "utf8") === "# Tasks\r\n\r\n## Phase: Convergence\r\n- [ ] 1. a\r\n- [ ] 2. b\r\n**Checkpoint:** converged.\r\n\r\n---\r\n",
      "the default 'Phase: Convergence' reused after a '---' was added below it (CRLF): the task lands before its checkpoint, CRLF kept");
    // No checkpoint: trailing '---' / own-line comments stay after the new task; a multi-line comment's tail is never entered.
    const ncFile = mk7("No cp", "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n\n---\n<!-- keep small -->\n\n## Phase: Ship\n- [ ] 2. b\n");
    const ncR = S.appendTasks(w7r, "no-cp", [{ text: "c" }], { heading: "Phase: Build" });
    const mlFile = mk7("Multi", "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n<!-- guidance\n  more -->\n");
    const mlR = S.appendTasks(w7r, "multi", [{ text: "c" }], { heading: "Phase: Build" });
    ok(ncR.ok && fs.readFileSync(ncFile, "utf8").includes("- [ ] 1. a\n- [ ] 3. c\n\n---\n<!-- keep small -->\n") && S.taskBlocks(fs.readFileSync(ncFile, "utf8")).find((b) => b.number === 3).checkpoint === null &&
      mlR.ok && fs.readFileSync(mlFile, "utf8") === "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n<!-- guidance\n  more -->\n- [ ] 2. c\n",
      "a phase without a checkpoint: trailing '---' and own-line comments stay after the new task; a multi-line comment is never split");

    // _Verify:_ is stored so it reads back — and runs — exactly as given: one code span around the whole command is
    // unwrapped, a command that starts/ends with a backtick is stored inside a longer span, a [placeholder] is refused.
    const tkFile = mk7("Ticks", "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n");
    const tk = S.appendTasks(w7r, "ticks", [{ text: "subst", verify: "test -n `echo ok`" }, { text: "wrapped", verify: "`npm test`" }, { text: "ends", verify: "`true` && echo `date`" }]);
    const tkTxt = fs.readFileSync(tkFile, "utf8");
    ok(tk.ok && JSON.stringify(tk.appended.map((t) => t.verify)) === JSON.stringify(["test -n `echo ok`", "npm test", "`true` && echo `date`"]) &&
      tkTxt.includes("  - _Verify: `` test -n `echo ok` ``_\n") && tkTxt.includes("  - _Verify: npm test_\n") && tkTxt.includes("  - _Verify: `` `true` && echo `date` ``_\n") &&
      S.taskBrief(w7r, "ticks", 2).verify.join() === "test -n `echo ok`" && S.taskBrief(w7r, "ticks", 4).verify.join() === "`true` && echo `date`",
      "a _Verify:_ starting/ending with a backtick (command substitution) reads back as given via task_brief; `npm test` still unwraps");
    const tkFrozen = fs.readFileSync(tkFile, "utf8");
    const phV = S.appendTasks(w7r, "ticks", [{ text: "p", verify: "[run tests]" }]);
    const phV2 = S.appendTasks(w7r, "ticks", [{ text: "p", verify: "`[ -f dist/app.js ]`" }]);
    mk7("Marcador", "# Tarefas\n\n## Fase 1\n- [ ] 1. a\n", "pt");
    const phVpt = S.appendTasks(w7r, "marcador", [{ text: "p", verify: "[correr testes]" }]);
    ok(!phV.ok && /'\[run tests\]' reads as a placeholder/.test(phV.error) && !phV2.ok && /'\[ -f dist\/app\.js \]' reads as a placeholder/.test(phV2.error) &&
      !phVpt.ok && /lê-se como um marcador de posição/.test(phVpt.error) && fs.readFileSync(tkFile, "utf8") === tkFrozen,
      "a [bracketed] _Verify:_ (ignored by every reader, so the evidence gate would never apply) is refused, localized — nothing written");
    // _Implements:_ is project-relative only: URI schemes and home paths in any form are refused; a tilde inside a path is fine.
    const badP = ["file:///etc/passwd", "~user/x.js", "~", "https://example.com/a.js"].map((p) => S.appendTasks(w7r, "ticks", [{ text: "t", implements: [p] }]));
    const tildeIn = S.appendTasks(w7r, "ticks", [{ text: "t", implements: ["src/~tmp/x.js"] }]);
    ok(badP.every((r) => r.ok === false && /relative to the project root/.test(r.error)) && tildeIn.ok && tildeIn.appended[0].implements.join() === "src/~tmp/x.js",
      "_Implements:_ refuses file:// / https:// and ~user / ~ paths; a '~' inside a relative path is kept");
    // Any heading globalConstraints() would read as the constraints section is refused (EN/PT/ES substrings).
    const gcFile = mk7("Gc", "# Tasks: gc\n\n## Phase 1\n- [ ] 1. Build the thing\n");
    const gcR = ["Global constraints follow-up", "Restrições globais — revisão", "Revisar restricciones globales"].map((h) => S.appendTasks(w7r, "gc", [{ text: "Bump Node floor" }], { heading: h }));
    ok(gcR.every((r) => r.ok === false && /holds the constraints every task respects/.test(r.error)) && fs.readFileSync(gcFile, "utf8") === "# Tasks: gc\n\n## Phase 1\n- [ ] 1. Build the thing\n" &&
      !/Bump Node floor/.test(S.taskBrief(w7r, "gc", 1).brief), "a heading containing 'Global constraints' (EN/PT/ES) is refused — appended tasks never become brief constraints");
  }

  // --- 1.13 WP7 review round 2: a no-checkpoint phase's trailers never cut into the last task or a comment ---
  {
    const w7s = path.join(tmp, "proj-wp7-r2");
    S.initProject(w7s, ["core"]);
    // Appends one task to a fresh feature → [result, tasks.md after]; the last task's body must read back unchanged.
    const r2 = (name, body, opts) => {
      const f = S.createFeature(w7s, name, ["core"]);
      const p = path.join(f.dir, "tasks.md");
      fs.writeFileSync(p, body);
      const lastBody = JSON.stringify(S.taskBlocks(body).slice(-1)[0].body);
      const r = S.appendTasks(w7s, S.slugify(name), [{ text: "new" }], opts);
      const txt = fs.readFileSync(p, "utf8");
      const kept = JSON.stringify(S.taskBlocks(txt).find((b) => b.number === S.taskBlocks(body).slice(-1)[0].number).body) === lastBody;
      return { r, txt, kept };
    };
    // A rule right under the last task line / sub-line (or an indented one after a blank, or after its fenced body)
    // is that task's lazy-continuation body: the new task goes after it (round-2 placed it before → refused as unsafe).
    const bodyRules = [
      ["Rule task", "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n---\n\n## Phase: Ship\n- [ ] 2. b\n", { heading: "Phase: Build" }, "- [ ] 1. a\n---\n- [ ] 3. new\n\n## Phase: Ship\n"],
      ["Rule sub", "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n  - _Implements: src/a.js_\n---\n\n## Phase: Ship\n- [ ] 2. b\n", { heading: "Phase: Build" }, "  - _Implements: src/a.js_\n---\n- [ ] 3. new\n\n## Phase: Ship\n"],
      ["Rule default", "# Tasks\n\n## Phase: Convergence\n- [ ] 1. a\n***\n", undefined, "## Phase: Convergence\n- [ ] 1. a\n***\n- [ ] 2. new\n"],
      ["Rule indented", "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n\n  ---\n", { heading: "Phase: Build" }, "- [ ] 1. a\n\n  ---\n- [ ] 2. new\n"],
      ["Rule fence", "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n  ```\n  code\n  ```\n---\n", { heading: "Phase: Build" }, "  ```\n  code\n  ```\n---\n- [ ] 2. new\n"],
    ].map(([name, body, opts, want]) => { const x = r2(name, body, opts); return x.r.ok && x.r.headingCreated === false && x.txt.includes(want) && x.kept; });
    ok(bodyRules.every(Boolean), "no checkpoint: a '---'/'***' directly under the last task or its sub-line (also indented after a blank, or after a fenced body — incl. the default 'Phase: Convergence') stays its body; the task goes after it");
    // A line starting with "<!--" inside an open multi-line comment is that comment's tail, not an own-line trailer.
    const tail = r2("Tail", "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n<!-- draft:\n  maybe split this\n\n<!-- see notes -->\n", { heading: "Phase: Build" });
    const tail2 = r2("Tail two", "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n<!-- a\n<!-- b -->\n\n---\n", { heading: "Phase: Build" });
    ok(tail.r.ok && tail.txt === "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n<!-- draft:\n  maybe split this\n\n<!-- see notes -->\n- [ ] 2. new\n" &&
      tail2.r.ok && tail2.txt === "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n<!-- a\n<!-- b -->\n- [ ] 2. new\n\n---\n",
      "no checkpoint: a '<!-- … -->' line that closes an earlier multi-line comment is its tail — the task goes after it, never inside the comment; a later '---' still trails");
  }

  // 1.14 feature (F3) — task dependencies and waves.
  {
    const fdRoot = path.join(tmp, "proj-ff-deps");
    const mkF = (name, lang = "en", kind) => {
      const p = path.join(fdRoot, name);
      S.initProject(p, ["core"], lang);
      const f = S.createFeature(p, "Deps " + name, ["core"], "", undefined, lang, kind);
      return { p, slug: f.slug, dir: f.dir };
    };
    const put = (x, file, text) => fs.writeFileSync(path.join(x.dir, file), text);
    const get = (x, file) => fs.readFileSync(path.join(x.dir, file), "utf8");
    const tl = (...lines) => "# Tasks\n\n" + lines.join("\n") + "\n";
    const callP = async (name, args) => payload(await rpc("tools/call", { name, arguments: args }));
    const js = (v) => JSON.stringify(v);

    // Regression guard: a tasks.md without any _Depends:_ answers exactly as before.
    const a = mkF("plain");
    put(a, "tasks.md", tl("## Story US-1 (P1)", "- [x] 1. [US1] Core", "  - _Implements: src/core.js_", "- [ ] 2. [US1][P] Parser", "  - _Implements: src/parser.js_",
      "- [ ] 3. [US1][P] Printer", "  - _Implements: src/printer.js_", "- [ ] 4. [US1][P] Printer tweak", "  - _Implements: src/printer.js_",
      "- [ ] 5. [US1] Wire", "  - _Implements: src/index.js_", "**Checkpoint:** US1 works"));
    const aNext = await callP("spec_next_task", { name: a.slug, batch: true, projectDir: a.p });
    const aWaves = await callP("spec_next_task", { name: a.slug, waves: true, projectDir: a.p });
    const aDoc = S.specDoctor(a.p, a.slug);
    const aDone = S.completeTask(a.p, a.slug, 2);
    const aBrief = S.taskBrief(a.p, a.slug);
    all("feature F3: a tasks.md without any _Depends:_ answers exactly as before — next = the first open task, the same result keys (no skipped / blocked), the [P] batch unchanged, no task-deps check, complete_task / brief / status unchanged; its waves follow tasks.md order (a [P] run together, split on a shared file, the task after the run behind all of it) (got " +
      js([aNext, aWaves.waves]) + ")", [
      () => Object.keys(aNext).join() === "ok,feature,next,remaining,total,batch", () => aNext.next.number === 2, () => aNext.remaining === 4,
      () => aNext.total === 5, () => aNext.batch.map((b) => b.number).join() === "2,3", () => js(aWaves.waves) === "[[2,3],[4],[5]]",
      () => js(aWaves.cycles) === "[]", () => js(aWaves.blocked) === "[]", () => !aDoc.checks.some((c) => c.id === "task-deps"), () => aDone.ok,
      () => !("waitsOn" in aDone), () => !("blocked" in aDone), () => aDone.next.number === 3, () => aBrief.task.number === 3,
      () => !("dependsOn" in aBrief), () => !/## Depends on/.test(aBrief.brief), () => S.statusFeature(a.p, a.slug).tasks.next.number === 3,
    ]);

    // next skips a task whose dependencies are open; complete_task on such a task warns, never refuses.
    const b = mkF("skip");
    put(b, "tasks.md", tl("- [ ] 1. Schema", "  - _Depends: 3_", "- [ ] 2. API", "  - _Depends: #1_", "- [ ] 3. Config"));
    const bN1 = await callP("spec_next_task", { name: b.slug, projectDir: b.p });
    const bEarly = await callP("spec_complete_task", { name: b.slug, number: 2, projectDir: b.p });
    const bDone3 = S.completeTask(b.p, b.slug, 3);
    const bN2 = S.nextTask(b.p, b.slug);
    ok(bN1.next.number === 3 && js(bN1.skipped) === '[{"number":1,"waitsOn":[3]},{"number":2,"waitsOn":[1]}]' && !("blocked" in bN1) &&
      bEarly.ok && bEarly.completed === 2 && js(bEarly.waitsOn) === "[1]" && /Task 2 was ticked while its dependencies #1 are still open/.test(bEarly.note) &&
      /^- \[x\] 2\./m.test(get(b, "tasks.md")) && bDone3.ok && !("waitsOn" in bDone3) && bDone3.next.number === 1 && bN2.next.number === 1 && !("skipped" in bN2),
      "feature F3: spec_next_task passes over a task whose _Depends:_ are open (#3 before #1 and #2 — `skipped` says what each waits on); complete_task on a task with an open dependency ticks it with waitsOn + a note (never refused); once #3 is done, #1 is next (got " +
      js([bN1, bEarly.waitsOn, bEarly.note]) + ")");

    // No open task can start: blocked (a cycle, a dependency naming no task, a task waiting on one of those) — never "all done".
    const c = mkF("blocked");
    put(c, "tasks.md", tl("- [x] 1. Base", "- [ ] 2. Left", "  - _Depends: 3_", "- [ ] 3. Right", "  - _Depends: 2_", "- [ ] 4. Later", "  - _Depends: 9_", "- [ ] 5. After", "  - _Depends: 4_"));
    const cN = await callP("spec_next_task", { name: c.slug, waves: true, projectDir: c.p });
    const cBrief = S.taskBrief(c.p, c.slug);
    const cBrief4 = S.taskBrief(c.p, c.slug, 4);
    ok(cN.next === null && cN.remaining === 4 && /^No open task can start — .*#2 waits on #3; #3 waits on #2; #4 waits on #9; #5 waits on #4\. .*task-deps/.test(cN.note) &&
      js(cN.blocked) === '[{"number":2,"waitsOn":[3]},{"number":3,"waitsOn":[2]},{"number":4,"waitsOn":[9]},{"number":5,"waitsOn":[4]}]' &&
      js(cN.waves) === "[]" && js(cN.cycles) === "[[2,3]]" && cBrief.ok && cBrief.task === null && cBrief.blocked.length === 4 && /No open task can start/.test(cBrief.note) &&
      S.statusFeature(c.p, c.slug).tasks.next === null && js(cBrief4.dependsOn) === '[{"number":9,"status":"missing"}]' && /- #9 ✗ no such task/.test(cBrief4.brief),
      "feature F3: when every open task waits on a dependency that can't finish (a cycle, a _Depends:_ naming no task, a task waiting on one of those) → next null + `blocked` [{number, waitsOn}] + a localized note — never 'all done'; waves [] with the cycle; the brief's default task is none (same list); status has no next (got " +
      js([cN.note, cN.blocked, cN.cycles]) + ")");

    // Waves: dependencies done or in earlier waves, no shared _Implements:_ file (anchor / ./ spellings, a folder and its files), a task
    // without _Implements:_ alone; the [P] batch never takes a task whose dependency is open or in the batch.
    const d = mkF("waves");
    put(d, "tasks.md", tl("## Build", "- [ ] 1. Core", "  - _Implements: src/a.js_", "- [ ] 2. B one", "  - _Depends: 1_", "  - _Implements: src/b.js_",
      "- [ ] 3. B two", "  - _Depends: #1_", "  - _Implements: ./src/b.js:12_", "- [ ] 4. Lib", "  - _Depends: 1_", "  - _Implements: lib/_",
      "- [ ] 5. Lib util", "  - _Depends: 1_", "  - _Implements: lib/util.js_", "- [ ] 6. Join", "  - _Depends: 2, 3, 4, 5_", "  - _Implements: src/c.js_",
      "- [ ] 7. Docs", "  - _Depends: 1_"));
    const dW = await callP("spec_next_task", { name: d.slug, waves: true, projectDir: d.p });
    const e = mkF("batch");
    put(e, "tasks.md", tl("## S", "- [ ] 1. [P] One", "  - _Implements: a.js_", "- [ ] 2. [P] Two", "  - _Implements: b.js_", "- [ ] 3. [P] Three", "  - _Depends: 1_", "  - _Implements: c.js_",
      "- [ ] 4. [P] Four", "  - _Implements: d.js_"));
    const eB = S.nextTask(e.p, e.slug, { batch: true, max: 8, waves: true });
    S.completeTask(e.p, e.slug, 1);
    const eB2 = S.nextTask(e.p, e.slug, { batch: true, max: 8 });
    ok(js(dW.waves) === "[[1],[2,4],[3,5],[6],[7]]" && js(dW.cycles) === "[]" && js(dW.blocked) === "[]" && dW.next.number === 1 &&
      eB.batch.map((x) => x.number).join() === "1,2" && js(eB.waves) === "[[1,2,4],[3]]" && eB2.batch.map((x) => x.number).join() === "2,3,4",
      "feature F3: waves — a wave's tasks have their dependencies done or in earlier waves and share no _Implements:_ file (src/b.js = ./src/b.js:12; lib/ overlaps lib/util.js), a task without _Implements:_ is a wave of its own; the [P] batch stops at a task waiting on an open dependency (one of the batch) and takes it once that is done (got " +
      js([dW.waves, eB.batch.map((x) => x.number), eB.waves, eB2.batch.map((x) => x.number)]) + ")");

    // Doctor task-deps (fail) and the tasks approval refused on it; once fixed, the approval passes and next_action implements the scheduled task.
    const REQ = "# Feature: x\n\n## Summary\nExport invoices as CSV.\n\n### US-1 (P1 — MVP): Export\n#### Acceptance Criteria (EARS)\n" +
      "1. **US-1.AC-1** — WHEN an admin clicks Export THE SYSTEM SHALL download a CSV.\n\n## Success Criteria\n- **SC-001** — 95% of exports finish in under 5 s.\n";
    const DESIGN = "# Design: x\n\n## Overview\nA nightly job and an endpoint.\n\n## Architecture\n```mermaid\ngraph TD\n  A-->B\n```\n\n## Constitution Check\n- [x] Principle 1 — complies\n";
    const g = mkF("gate");
    put(g, "classification.md", get(g, "classification.md").split("\n").map((l) => (/^- /.test(l) ? l : l.replace(/\[[^\]]*\]/g, "filled"))).join("\n"));
    put(g, "requirements.md", REQ);
    put(g, "design.md", DESIGN);
    put(g, "tasks.md", tl("- [ ] 1. [US1] Writer", "  - _Requirements: US-1.AC-1_", "  - _Depends: 2_", "- [ ] 2. [US1] Reader", "  - _Requirements: US-1.AC-1_", "  - _Depends: 1_",
      "- [ ] 3. [US1] Export", "  - _Requirements: US-1.AC-1_", "  - _Depends: 9, 3, soon_"));
    const gPre = ["classification", "requirements", "design"].map((ph) => S.approvePhase(g.p, g.slug, ph, "t"));
    const gDeps = S.specDoctor(g.p, g.slug).checks.find((c) => c.id === "task-deps");
    const gRefused = await callP("spec_approve", { name: g.slug, phase: "tasks", by: "t", projectDir: g.p });
    put(g, "tasks.md", tl("- [ ] 1. [US1] Writer", "  - _Requirements: US-1.AC-1_", "  - _Depends: 2_", "- [ ] 2. [US1] Reader", "  - _Requirements: US-1.AC-1_",
      "- [ ] 3. [US1] Export", "  - _Requirements: US-1.AC-1_", "  - _Depends: 1, 2_"));
    const gOk = S.approvePhase(g.p, g.slug, "tasks", "t");
    const gDeps2 = S.specDoctor(g.p, g.slug).checks.find((c) => c.id === "task-deps");
    const gNa = S.nextAction(g.p, g.slug);
    ok(gPre.every((r) => r.ok) && gDeps && gDeps.status === "fail" &&
      gDeps.detail === "task 3: _Depends:_ 'soon' is not a task number; task 3 depends on #9, which no active task carries; task 3 depends on itself; tasks waiting on each other (a cycle): #1, #2 — fix the _Depends:_ markers in tasks.md (numbers of tasks in the same tasks.md: `_Depends: 3, 5_`)" &&
      gRefused.ok === false && gRefused.refused === true && gRefused.failing.includes("task-deps") && gOk.ok && gDeps2.status === "pass" &&
      gDeps2.detail === "2 task(s) declare _Depends:_ — each names an active task, no cycle" && gNa.step === "implement" && /^Implement task #2: Reader/.test(gNa.recommendation),
      "feature F3: doctor task-deps fails on a _Depends:_ value that is not a task number, a number no task carries, a self-dependency and a cycle — and the tasks approval is refused on it; fixed, it passes and next_action implements the next task by the dependency rule (#2, not #1) (got " +
      js([gDeps && gDeps.detail, gRefused.failing, gOk.ok, gNa.step, gNa.recommendation]) + ")");

    // The brief lists the task's dependencies and their status (PT too), kept with write:true.
    const h = mkF("brief", "pt");
    put(h, "tasks.md", tl("- [x] 1. Base", "- [ ] 2. Meio", "- [ ] 3. Topo", "  - _Depends: 1, 2_"));
    const hB = S.taskBrief(h.p, h.slug, 3);
    const hW = S.taskBrief(h.p, h.slug, 3, { write: true });
    const dB = S.taskBrief(d.p, d.slug, 6);
    ok(js(hB.dependsOn) === '[{"number":1,"status":"done"},{"number":2,"status":"open"}]' && /## Depende de\n- #1 ✓ feita — Base\n- #2 ○ por fazer — Meio\n\n⚠ Algumas ainda não estão concluídas/.test(hB.brief) &&
      js(hW.dependsOn) === js(hB.dependsOn) && !("brief" in hW) && /## Depends on\n- #2 ○ open — B one\n- #3 ○ open — B two\n- #4 ○ open — Lib\n- #5 ○ open — Lib util\n\n⚠ Some of them are still open/.test(dB.brief),
      "feature F3: the brief lists the task's _Depends:_ with each one's status (done / open / missing) and a warning while one is open — PT too; `dependsOn` is kept with write:true (got " + js([hB.dependsOn, hW.dependsOn]) + ")");

    // spec_append_tasks {depends}: existing tasks or tasks of the same call; a phantom, a self-dependency, a cycle, a non-number → nothing written.
    const ap = mkF("append");
    put(ap, "requirements.md", REQ);
    put(ap, "tasks.md", tl("## Build", "- [ ] 1. [US1] Writer", "  - _Requirements: US-1.AC-1_", "**Checkpoint:** built"));
    const ap1 = await callP("spec_append_tasks", { name: ap.slug, tasks: [{ text: "Reader", depends: [1] }, { text: "Glue", depends: [1, 2] }], projectDir: ap.p });
    const apText = get(ap, "tasks.md");
    const apBad = await callP("spec_append_tasks", { name: ap.slug, tasks: [{ text: "X", depends: [9] }], projectDir: ap.p });
    const apSelf = S.appendTasks(ap.p, ap.slug, [{ text: "Y", depends: "#4" }]);
    const apCycle = S.appendTasks(ap.p, ap.slug, [{ text: "P", depends: [5] }, { text: "Q", depends: ["4"] }]);
    const apType = await rpc("tools/call", { name: "spec_append_tasks", arguments: { name: ap.slug, tasks: [{ text: "Z", depends: ["x"] }], projectDir: ap.p } });
    const apTok = S.appendTasks(ap.p, ap.slug, [{ text: "Z", depends: "soon" }]);
    const apTyped = S.appendTasks(ap.p, ap.slug, [{ text: "Sneaky _Depends: 1_ in the text" }]);
    all("feature F3: spec_append_tasks {depends} writes _Depends:_ (an existing task, or a task of the same call by the number it gets) and the waves read it; a number naming no task (the error names the numbers the call takes), a self-dependency, a cycle, a non-number (schema or engine) or a _Depends:_ typed in the text writes nothing (got " +
      js([ap1.appended, apBad.error, apSelf.error, apCycle.error, apTok.error, apTyped.error]) + ")", [
      () => ap1.ok, () => ap1.appended.map((t) => t.number + ":" + t.depends.join("+")).join() === "2:1,3:1+2",
      () => /- \[ \] 2\. Reader\n {2}- _Depends: 1_\n- \[ \] 3\. Glue\n {2}- _Depends: 1, 2_\n/.test(apText),
      () => js(S.nextTask(ap.p, ap.slug, { waves: true }).waves) === "[[1],[2],[3]]", () => apBad.ok === false,
      () => /Task 1: depends names no task: #9 — give the number of an active task, or of a task of this call \(numbered 4 here\)\. Nothing was written\./.test(apBad.error),
      () => js(apBad.phantomDepends) === "[9]", () => apSelf.ok === false,
      () => /Task 1 is numbered 4 here and would depend on itself/.test(apSelf.error), () => apCycle.ok === false,
      () => /The dependencies would form a cycle: #4, #5\. Nothing was written\./.test(apCycle.error), () => js(apCycle.cycles) === "[[4,5]]",
      () => apType.result.isError === true, () => apTok.ok === false, () => /depends takes task numbers \(3 or #3\) \(got 'soon'\)/.test(apTok.error),
      () => apTyped.ok === false, () => /_Depends:_ would not read back/.test(apTyped.error), () => get(ap, "tasks.md") === apText,
    ]);

    // The bugfix gate keeps its precedence over the dependency warning (a refusal, nothing recorded).
    const bg = mkF("bug", "en", "bugfix");
    put(bg, "tasks.md", tl("- [ ] 1. Reproduce the bug", "- [ ] 2. Find the root cause and write it in bug.md → Root Cause", "- [ ] 3. Fix it", "  - _Depends: 2_"));
    const bgR = S.completeTask(bg.p, bg.slug, 3);
    ok(bgR.ok === false && bgR.gated === "root-cause" && !("waitsOn" in bgR) && /^- \[ \] 3\./m.test(get(bg, "tasks.md")),
      "feature F3: the bugfix root-cause gate still refuses a later task — before any dependency warning (got " + js(bgR) + ")");

    // The other readers of "the next task": the scope guard's likely task, a spike's next step (and its doctor).
    S.initProject(g.p, ["core"], undefined, { guard: "scope" });
    const gGuard = S.guardCheck(g.p, "src/new.js", g.p);
    const sp = path.join(fdRoot, "spike");
    S.initProject(sp, ["core"], "en");
    const spF = S.createFeature(sp, "Deps probe", undefined, "Can the queue keep up?", undefined, "en", "spike");
    fs.writeFileSync(path.join(spF.dir, "tasks.md"), tl("- [ ] 1. Measure", "  - _Depends: 2_", "- [ ] 2. Compare", "  - _Depends: 1_"));
    const spNa = S.nextAction(sp, spF.slug);
    const spDeps = S.specDoctor(sp, spF.slug).checks.find((x) => x.id === "task-deps");
    ok(gGuard.decision === "ask" && gGuard.likely && gGuard.likely.number === 2 && gGuard.likely.via === "next" &&
      spNa.step === "fix" && js(spNa.blocked) === '[{"number":1,"waitsOn":[2]},{"number":2,"waitsOn":[1]}]' && /^No open task can start/.test(spNa.recommendation) &&
      spDeps && spDeps.status === "fail",
      "feature F3: the scope guard names the next task by the dependency rule (#2, not #1); a spike whose tasks wait on each other gets next_action step 'fix' with `blocked` (never 'decide') and doctor task-deps (got " +
      js([gGuard.likely, spNa.step, spNa.recommendation]) + ")");

    // _Depends:_ in fenced code or an HTML comment is never the task's; `**Depends:** 2` yields no marker (malformed-markers warns).
    const fz = mkF("fenced");
    put(fz, "tasks.md", tl("- [ ] 1. Example task", "  ```md", "  - _Depends: 2_", "  ```", "  <!-- _Depends: 2_ -->", "- [ ] 2. Second", "  - **Depends:** 1"));
    const fzBlocks = S.taskBlocks(get(fz, "tasks.md"));
    const fzDoc = S.specDoctor(fz.p, fz.slug);
    const fzN = S.nextTask(fz.p, fz.slug, { waves: true });
    ok(fzBlocks.every((x) => !S.taskDependsSpec(x).declared) && fzN.next.number === 1 && js(fzN.waves) === "[[1],[2]]" && !fzDoc.checks.some((x) => x.id === "task-deps") &&
      /#2 \(Depends:\)/.test((fzDoc.checks.find((x) => x.id === "malformed-markers") || {}).detail || ""),
      "feature F3: a _Depends:_ inside fenced code or an HTML comment under a task is not the task's (next, waves, doctor ignore it); `**Depends:** 1` yields no marker and doctor's malformed-markers names it (got " +
      js([fzN.waves, (fzDoc.checks.find((x) => x.id === "malformed-markers") || {}).detail]) + ")");

    // Linear on adversarial input: a 60 000-number _Depends:_, 4 000 chained tasks closing one long cycle (iterative walks — no stack
    // overflow), 4 000 open tasks in one [P] run sharing a file, a 120 000-character token run.
    const t0 = Date.now();
    const longSpec = S.taskDependsSpec({ text: "Big _Depends: " + Array.from({ length: 60000 }, (_, i) => i + 1).join(", ") + "_", body: [] });
    const badSpec = S.taskDependsSpec({ text: "Bad _Depends: " + "x, ".repeat(60000) + "#_", body: [] });
    const N = 4000;
    const ring = [];
    for (let i = 1; i <= N; i++) ring.push(`- [ ] ${i}. T${i}`, `  - _Depends: ${i === 1 ? N : i - 1}_`, `  - _Implements: src/f${i}.js_`);
    const ringBlocks = S.taskBlocks(ring.join("\n"));
    const ringW = S.taskWaves(ringBlocks, []);
    const ringS = S.taskSchedule(ringBlocks);
    const chainBlocks = S.taskBlocks(ring.join("\n").replace(`_Depends: ${N}_`, "_Depends: [none]_"));
    const chainW = S.taskWaves(chainBlocks, []);
    const same = [];
    for (let i = 1; i <= N; i++) same.push(`- [ ] ${i}. [P] S${i}`, "  - _Implements: src/one.js_");
    const sameW = S.taskWaves(S.taskBlocks(same.join("\n")), []);
    const tokW = S.taskDependsSpec({ text: "_Depends: " + "9".repeat(120000) + "_", body: [] });
    const elapsed = Date.now() - t0;
    ok(longSpec.numbers.length === 60000 && js(badSpec.invalid) === '["x","#"]' && ringW.waves.length === 0 && ringW.cycles.length === 1 && ringW.cycles[0].length === N &&
      ringW.blocked.length === N && ringS.next === null && chainW.waves.length === N && chainW.waves.every((w, k) => w.length === 1 && w[0] === k + 1) &&
      sameW.waves.length === N && tokW.invalid.length === 1 && elapsed < 15000,
      "feature F3: linear on adversarial input — a 60 000-number _Depends:_, a 4 000-task cycle and chain (iterative walks, no stack overflow), 4 000 [P] tasks sharing one file, a 120 000-digit token (" + elapsed + " ms)");
  }

  // 1.22 review (finding 8) — `* [ ] 1.` / `+ [ ] 1.` (valid GFM) read as ZERO tasks, silently. Any bullet is a task line now; an
  // ordered-list checkbox (`1. [ ] text`) or an unnumbered checkbox outside every task is named by doctor's unread-tasks warn.
  {
    const js = JSON.stringify;
    const p = path.join(tmp, "proj-122-bullets");
    S.initProject(p, ["core"], "en");
    const f = S.createFeature(p, "Bullets", ["core"], "", undefined, "en");
    const tf = path.join(f.dir, "tasks.md");
    fs.writeFileSync(tf, "# Tasks\n\n* [ ] 1. [US1] Star\n  - _Verify: node -e \"process.exit(0)\"_\n+ [ ] 2. [US1] Plus\n  - [ ] sub-step (the task's body)\n");
    const st = S.statusFeature(p, "bullets").tasks;
    const c1 = S.completeTask(p, "bullets", 1, { command: "node -e \"process.exit(0)\"", exitCode: 0 });
    const text1 = fs.readFileSync(tf, "utf8");
    const docClean = S.specDoctor(p, "bullets").checks.find((c) => c.id === "unread-tasks");
    // the tasks approval's fingerprint ignores a `*` tick like a `-` one
    S.approvePhase(p, "bullets", "tasks", "tester", { force: true });
    S.completeTask(p, "bullets", 2);
    const changed = (S.specDoctor(p, "bullets").checks.find((c) => c.id === "changed-since-approval") || {}).status;
    const o = S.createFeature(p, "Ordered", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(o.dir, "tasks.md"), "# Tasks\n\n1. [ ] Build the parser\n2. [x] Write the docs\n- [ ] Unnumbered\n\n```md\n1. [ ] fenced example\n```\n<!-- 3. [ ] commented -->\n");
    const oSt = S.statusFeature(p, "ordered").tasks;
    const oDoc = S.specDoctor(p, "ordered").checks.find((c) => c.id === "unread-tasks");
    ok(st.total === 2 && c1.ok && c1.verified && /^\* \[x\] 1\. \[US1\] Star$/m.test(text1) && /^\+ \[ \] 2\./m.test(text1) && !docClean && changed !== "warn" && changed !== "fail" &&
      oSt.total === 0 && oDoc && oDoc.status === "warn" && /L3 `1\. \[ \] Build the parser`, L4 `2\. \[x\] Write the docs`, L5 `- \[ \] Unnumbered`/.test(oDoc.detail) && !/fenced|commented/.test(oDoc.detail),
      "1.22 review: `* [ ] 1.` / `+ [ ] 1.` are task lines (status, complete ticks the `*` line at its box; a tick on them is no change since approval); `1. [ ] text` and an unnumbered checkbox outside a task are no tasks — doctor warns unread-tasks naming the lines (never a fenced or commented one, nor a task's sub-step) (got " +
      js([st, c1.verified, docClean, changed, oSt, oDoc]) + ")");
  }

  // 1.22 review (finding 10) — every tick refreshed ROADMAP.md over ALL features (313 ms vs 13.8 ms without, 30 features × 40
  // tasks). The rows are cached in process, keyed on their inputs' stats (+ the racy rule), and the marker readers are memoized.
  // The output must be byte for byte what a fresh computation writes — after every kind of change.
  {
    const js = JSON.stringify;
    const E = require(path.join(__dirname, "lib", "engine", "index.js"));
    const p = path.join(tmp, "proj-122-rowcache");
    S.initProject(p, ["core"], "en");
    const fs3 = ["Alpha", "Beta", "Gamma"].map((n) => S.createFeature(p, n, ["core"], "", undefined, "en"));
    fs3.forEach((f, i) => fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n" + [1, 2, 3].map((n) => `- [ ] ${n}. [US1] ${f.slug} task ${n}\n  - _Verify: node -e "process.exit(0)" --t${i}${n}_\n  - _Implements: src/${f.slug}/m${n}.js_\n`).join("")));
    const racy = E.ROW_OPTS.racyMs;
    E.ROW_OPTS.racyMs = -1e12; // every stamp trusted: the test controls its edits (each changes a size or a stamp)
    const render = () => S.renderRoadmapMd(p, "en", S.roadmapData(p));
    const fresh = () => { E.ROW_CACHE.clear(); return render(); };
    const wrong = [];
    const step = (name, fn) => {
      fn();
      render(); // signs and caches (the first call of a process signs nothing)
      const hits0 = E.ROW_CALLS.hits;
      const cached = render();
      const hits = E.ROW_CALLS.hits - hits0;
      const exact = fresh();
      if (cached !== exact) wrong.push(name + ": differs");
      if (hits < 1) wrong.push(name + ": no cache hit");
    };
    try {
      step("start", () => {});
      step("tick", () => S.completeTask(p, "alpha", 1, { command: "node -e \"process.exit(0)\" --t01", exitCode: 0 }));
      step("tick without evidence", () => S.completeTask(p, "beta", 2));
      step("hand edit (same size)", () => { const f = path.join(fs3[2].dir, "tasks.md"); fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("- [ ] 3.", "- [x] 3.")); });
      step("design TODO", () => fs.appendFileSync(path.join(fs3[1].dir, "design.md"), "\n> **TODO** fill this\n"));
      step("dependency", () => S.setDependency(p, "gamma", ["alpha"]));
      step("approval", () => S.approvePhase(p, "alpha", "requirements", "tester", { force: true }));
      step("requirements edit", () => fs.appendFileSync(path.join(fs3[0].dir, "requirements.md"), "\n[NEEDS CLARIFICATION: which unit?]\n"));
      step("evidence mode", () => S.initProject(p, ["core"], "en", { evidence: "observed" }));
      step("project template", () => { fs.mkdirSync(path.join(p, ".specs", "templates"), { recursive: true }); fs.writeFileSync(path.join(p, ".specs", "templates", "tasks.md"), "# Tasks\n\n- [ ] 1. [placeholder]\n"); });
      step("undo", () => S.completeTask(p, "alpha", 1, undefined, { undo: true }));
    } finally {
      E.ROW_OPTS.racyMs = racy;
    }
    // …and with the default racy window, rows of files written just now are never served from the cache
    const h0 = E.ROW_CALLS.hits;
    fs.writeFileSync(path.join(fs3[0].dir, "tasks.md"), fs.readFileSync(path.join(fs3[0].dir, "tasks.md"), "utf8").replace("- [ ] 2.", "- [x] 2."));
    const racyCached = render(); render();
    const racyHits = E.ROW_CALLS.hits - h0;
    ok(!wrong.length && racyCached === fresh() && racyHits <= 2 * (fs3.length - 1),
      "1.22 review: the roadmap row cache — after a tick, a hand edit of the same size, a design / requirements edit, a dependency, an approval, the evidence mode, a project template, an undo, ROADMAP.md is byte for byte a fresh computation and the unchanged rows come from the cache; a file stamped within the racy window is never trusted (wrong: " +
      js(wrong) + ", racy hits " + racyHits + ")");
  }

  // Review 5 (P3) — tasks.md written back as the bytes it holds: a tasks.md in Windows' ANSI code page (Windows PowerShell 5.1's
  // Set-Content) lost every accented letter to U+FFFD on ONE tick (the decoded text was written back). A tick / untick changes the
  // checkbox's byte only; an append / a track's tasks are refused (localized, nothing written); UTF-16 stays UTF-16.
  {
    const js = JSON.stringify;
    const BOM = String.fromCharCode(0xfeff);
    const p5 = path.join(tmp, "proj-r5-bytes");
    S.initProject(p5, ["core"], "pt");
    const f5 = S.createFeature(p5, "Bytes", ["core"], "", undefined, "pt");
    const t5 = path.join(f5.dir, "tasks.md"), st5 = path.join(f5.dir, ".state.json");
    const cp = (s) => Buffer.from(s, "latin1"); // these letters are the same bytes in Windows-1252
    const ansi = cp("## Fase 1\n- [ ] 1. Validar a sessão\n- [ ] 2. Página de início\n**Checkpoint:** ok\n");
    fs.writeFileSync(t5, ansi);
    const tick = S.completeTask(p5, "bytes", 2);
    const afterTick = fs.readFileSync(t5);
    const diff = [...afterTick].map((b, i) => (b !== ansi[i] ? i : -1)).filter((i) => i >= 0);
    const untick = S.completeTask(p5, "bytes", 2, undefined, { undo: true });
    const afterUntick = fs.readFileSync(t5);
    const app = S.appendTasks(p5, "bytes", [{ text: "Nova" }]);
    const trk = S.addTrack(p5, "bytes", "saas");
    const afterRefusals = fs.readFileSync(t5);
    fs.writeFileSync(t5, cp("<!-- nota da sessão --> - [ ] 1. a\n")); // the box after an accented byte: where is it in the bytes?
    const stBefore = fs.readFileSync(st5, "utf8");
    const odd = S.completeTask(p5, "bytes", 1, { command: "npm test", exitCode: 0 });
    const oddKept = fs.readFileSync(st5, "utf8") === stBefore && fs.readFileSync(t5).equals(cp("<!-- nota da sessão --> - [ ] 1. a\n"));
    const u16 = (be, s) => { const b = Buffer.from(BOM + s, "utf16le"); return be ? b.swap16() : b; };
    const read16 = (b) => (b[0] === 0xfe ? Buffer.from(b).swap16() : b).toString("utf16le");
    const r16 = [false, true].map((be) => {
      fs.writeFileSync(t5, u16(be, "## Fase\r\n- [ ] 1. sessão\r\n- [ ] 2. início\r\n**Checkpoint:** ok\r\n"));
      const c = S.completeTask(p5, "bytes", 2);
      const a = S.appendTasks(p5, "bytes", [{ text: "Três" }]);
      // 1.23.1 — add_track's append (the last write path that turned UTF-16 into UTF-8): the track's tasks land in UTF-16 too
      const tr = S.addTrack(p5, "bytes", be ? "obs" : "saas");
      const out = fs.readFileSync(t5);
      return [c.ok, a.ok, out[0], out[1], /- \[x\] 2\. início\r\n/.test(read16(out)), /- \[ \] \d+\. Três\r\n/.test(read16(out)),
        tr.ok && tr.added.some((x) => /^tasks\.md/.test(x)) && /- \[ \] \d+\. \[US1\]/.test(read16(out))];
    });
    ok(tick.ok && diff.length === 1 && afterTick[diff[0]] === 0x78 && untick.ok && afterUntick.equals(ansi) &&
      app.ok === false && /não está gravado em UTF-8/.test(app.error) && trk.ok === false && /não está gravado em UTF-8/.test(trk.error) && afterRefusals.equals(ansi) &&
      odd.ok === false && /UTF-8/.test(odd.error) && oddKept &&
      js(r16) === js([[true, true, 0xff, 0xfe, true, true, true], [true, true, 0xfe, 0xff, true, true, true]]),
      "review 5 (P3): a tasks.md in an ANSI code page is ticked and unticked byte for byte (the box's byte alone); append-tasks and add-track refuse it (PT message, nothing written); a box the bytes can't place is refused with nothing recorded; UTF-16 LE / BE stays UTF-16 through a tick and an append (got " +
      js([tick.ok, diff, untick.ok, afterUntick.equals(ansi), app.error, trk.error, afterRefusals.equals(ansi), odd.error, oddKept, r16]) + ")");
  }

  // Review 5 (M4) — markers as a markdown reader reads italics: an EMPTY marker (`_Verify:_`) is no value (a title naming two
  // markers yielded the runnable _Verify:_ `_ and _Implements:` — never verifiable; "_Depends:_ and _Size:_" failed task-deps), the
  // value never swallows a following marker, `__Verify: x__` (bold) is no marker (it read `x_`), and a `_` inside a code span
  // never closes one.
  {
    const js = JSON.stringify;
    const mk = (line) => { const m = S.taskMarkers({ text: line, body: [] }); return [m.verify, m.implements, m.depends]; };
    const got = {
      empty: mk("Document the _Verify:_ and _Implements:_ markers"), star: mk("Support *Verify:* and *Implements:* spellings"),
      tail: mk("Rename the _Verify:_ marker_"), deps: mk("Document the _Depends:_ and _Size:_ markers"), bold: mk("x __Verify: npm test__"),
      code: mk('x _Verify: `npm test -- --grep "login_ flow"`_'), inCode: mk("x `_Verify: rm -rf dist_` here"), intra: mk("snake_Verify: npm test_"),
      both: mk("x _Verify: npm test_ and _Implements: src/a.js_"), open: mk("x _Verify: npm test and _Implements: src/a.js_"),
    };
    const want = { empty: [[], [], []], star: [[], [], []], tail: [[], [], []], deps: [[], [], []], bold: [[], [], []], code: [['npm test -- --grep "login_ flow"'], [], []],
      inCode: [[], [], []], intra: [[], [], []], both: [["npm test"], ["src/a.js"], []], open: [[], ["src/a.js"], []] };
    const pm = path.join(tmp, "proj-r5-markers");
    S.initProject(pm, ["core"], "en");
    const fm = S.createFeature(pm, "Marks", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(fm.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. Document the _Verify:_ and _Implements:_ markers\n- [ ] 2. Document the _Depends:_ and _Size:_ markers\n");
    const docM = S.specDoctor(pm, "marks").checks;
    const c1 = S.completeTask(pm, "marks", 1);
    ok(js(got) === js(want) && !docM.some((c) => ["task-deps", "malformed-markers", "verify-suspicious"].includes(c.id)) && c1.ok && c1.verified && c1.nothingToVerify,
      "review 5 (M4): `_Verify:_` / `*Implements:*` named in a title are empty markers (no value — nothing to run, no task-deps fail, no malformed warn); a value never runs past the next marker; `__Verify: x__` and an intraword `_Verify:` are no markers; a `_ ` inside a code span doesn't close the value (got " +
      js([got, docM.filter((c) => c.status !== "pass").map((c) => c.id), c1.verified, c1.nothingToVerify]) + ")");
  }

  // Review 5 (M15) — the task brief picks design sections by WHOLE IDs: US-1.AC-1 is not US-1.AC-10, T-1 is not T-10 (but is
  // T-01); the sections naming the task's own IDs fill the design budget first (a long US-1.AC-10 section pushed AC-1's out).
  {
    const js = JSON.stringify;
    const pb = path.join(tmp, "proj-r5-brief");
    S.initProject(pb, ["core"], "en");
    const fb = S.createFeature(pb, "Brief", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(fb.dir, "requirements.md"), "# Req\n\n### US-1 Login\n\n- US-1.AC-1: WHEN the user logs in THE SYSTEM SHALL greet them.\n- US-1.AC-10: WHEN the user exports THE SYSTEM SHALL write a CSV.\n");
    fs.writeFileSync(path.join(fb.dir, "design.md"), "# Design\n\n## Export (US-1.AC-10, T-10)\n\n" + "Export pipeline details. ".repeat(140) +
      "\n\n## Big file (src/greet.ts)\n\n" + "Notes. ".repeat(500) + "\n\n## Login greeting (US-1.AC-1)\n\n" + "Greeting rules. ".repeat(60) + "\n\n## Greeting test (T-01)\n\nAsserts the greeting.\n");
    fs.writeFileSync(path.join(fb.dir, "tasks.md"), "- [ ] 1. Greet the user (T-1)\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/greet.ts_\n- [ ] 2. Export (T-10)\n  - _Requirements: US-1.AC-10_\n");
    const b1 = S.taskBrief(pb, "brief", 1), b2 = S.taskBrief(pb, "brief", 2);
    ok(js(b1.designSections) === js(["Login greeting (US-1.AC-1)", "Greeting test (T-01)"]) && /Relevant but not included \(size\)[^\n]*Big file/.test(b1.brief) &&
      js(b2.designSections) === js(["Export (US-1.AC-10, T-10)"]),
      "review 5 (M15): the brief's design sections match whole IDs (US-1.AC-1 ≠ US-1.AC-10, T-1 = T-01 ≠ T-10) and the task's own ID sections fill the budget before a file's (got " +
      js([b1.designSections, (b1.brief.match(/^Relevant[^\n]*$/m) || [""])[0], b2.designSections]) + ")");
  }

  // Review 5 — CommonMark's indented code block holds no task: `    - [ ] 1. example` after a blank line, outside every list, is
  // code (complete_task ticked that example — the first open task 1 — instead of the real one); doctor's unread-tasks names it.
  // Inside a list (`- Phase A` then a 4-space task, a task's sub-lines) the indentation is the item's, as before.
  {
    const js = JSON.stringify;
    const pi = path.join(tmp, "proj-r5-indented");
    S.initProject(pi, ["core"], "en");
    const fi = S.createFeature(pi, "Indent", ["core"], "", undefined, "en");
    const ti = path.join(fi.dir, "tasks.md");
    fs.writeFileSync(ti, "# Tasks\n\nExample:\n\n    - [ ] 1. example\n\n## Phase 1\n- [ ] 1. real\n- Phase A\n\n    - [ ] 2. nested\n");
    const list = S.parseTasks(fs.readFileSync(ti, "utf8")).map((t) => t.number + ":" + t.text);
    const done1 = S.completeTask(pi, "indent", 1);
    const unread = (S.specDoctor(pi, "indent").checks.find((c) => c.id === "unread-tasks") || {}).detail || "";
    ok(js(list) === js(["1:real", "2:nested"]) && done1.ok && /    - \[ \] 1\. example\n[\s\S]*- \[x\] 1\. real/.test(fs.readFileSync(ti, "utf8")) && /L5 `- \[ \] 1\. example`/.test(unread) && /indented 4\+ spaces/.test(unread),
      "review 5: a 4-space task line after a blank line outside a list is an indented code block — no task, never ticked; unread-tasks names it; a 4-space task inside a list item is still a task (got " +
      js([list, done1.ok, unread]) + ")");
  }

  // Review 5 — doctor verify-suspicious (a warn): a _Verify:_ value that starts with _ / *, holds a code span inside it, or has a quote
  // with no partner — `done --run` would run it as written.
  {
    const js = JSON.stringify;
    const pv = path.join(tmp, "proj-r5-verify");
    S.initProject(pv, ["core"], "en");
    const fv = S.createFeature(pv, "Odd", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(fv.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. a\n  - _Verify: `npm test` and `npm run lint`_\n- [ ] 2. b\n  - _Verify: node -e \"process.exit(0)_\n" +
      "- [ ] 3. c\n  - _Verify: node -e \"console.log('it is ok')\"_\n- [ ] 4. d\n  - _Verify: npm test_\n");
    const cv = S.specDoctor(pv, "odd").checks.find((c) => c.id === "verify-suspicious");
    fs.writeFileSync(path.join(fv.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. a\n  - _Verify: npm test_\n");
    const clean = S.specDoctor(pv, "odd").checks.some((c) => c.id === "verify-suspicious");
    const fvPt = S.createFeature(pv, "Estranho", ["core"], "", undefined, "pt");
    fs.writeFileSync(path.join(fvPt.dir, "tasks.md"), "- [ ] 1. a\n  - _Verify: grep \"a_\n");
    const cvPt = S.specDoctor(pv, fvPt.slug).checks.find((c) => c.id === "verify-suspicious");
    ok(cv && cv.status === "warn" && /#1 «npm test` and `npm run lint»; #2 «node -e "process\.exit\(0\)»/.test(cv.detail) && !/#3|#4/.test(cv.detail) && !clean &&
      cvPt && /parece mal escrito/.test(cvPt.detail),
      "review 5: doctor verify-suspicious warns for a _Verify:_ holding a code span inside it or a quote with no partner (never for paired quotes or a plain command; PT) (got " + js([cv, clean, cvPt && cvPt.detail]) + ")");
  }

  // 1.24 r6 D2: an EMPTY label followed by its value — `_Verify:_ npm test`, `- _Verify:_ `npm test``, `*Verify:* npm test` — yields
  // no marker (nothing runs, the task ticks as "nothing to verify"): doctor's malformed-markers names it again. A title naming
  // markers ("Document the _Verify:_ and _Implements:_ markers", "the _Verify:_ marker") is prose.
  {
    const js = JSON.stringify;
    const pd = path.join(tmp, "proj-r6-empty-label");
    S.initProject(pd, ["core"], "en");
    const cases = {
      plain: ["- [ ] 1. Build the parser _Verify:_ npm test", ["Verify"]],
      code: ["- [ ] 1. Build the parser\n  - _Verify:_ `npm test`", ["Verify"]],
      star: ["- [ ] 1. Build the parser\n  - *Verify:* npm test", ["Verify"]],
      impl: ["- [ ] 1. Build the parser _Implements:_ src/parser.js _Verify: npm test_", ["Implements"]],
      codeMid: ["- [ ] 1. Build the parser _Verify:_ `npm test` and lint", ["Verify"]],
      title2: ["- [ ] 1. Document the _Verify:_ and _Implements:_ markers", []],
      title1: ["- [ ] 1. Document the _Verify:_ marker in the README", []],
      titlePt: ["- [ ] 1. Documentar o marcador _Verify:_ e a etiqueta _Implements:_", []],
      tail: ["- [ ] 1. Rename the _Verify:_ marker_", []],
      end: ["- [ ] 1. Explain _Verify:_.", []],
    };
    const got = {};
    let k = 0;
    for (const [name, [text]] of Object.entries(cases)) {
      const f = S.createFeature(pd, "E" + (k++), ["core"], "", undefined, "en");
      fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n" + text + "\n");
      const c = S.specDoctor(pd, f.slug).checks.find((x) => x.id === "malformed-markers");
      got[name] = c ? (c.detail.match(/\(([^)]*)\)/) || [, ""])[1].split(", ").map((l) => l.replace(/:$/, "")).filter(Boolean) : [];
    }
    const wrong = Object.keys(cases).filter((n) => js(got[n]) !== js(cases[n][1]));
    ok(!wrong.length, "1.24 r6 D2: an empty marker label followed by a code span or plain text is malformed-markers again (`_Verify:_ npm test`, `- _Verify:_ `npm test``, `*Verify:* npm test`); a title naming markers is prose (wrong: " +
      js(wrong.map((n) => [n, got[n]])) + ")");
  }

  // 1.24 r6 D9: a marker closer followed by closing punctuation a markdown reader allows — `*`, quotes, dashes, guillemets — is read:
  // `**_Verify: x_**`, `***Verify: x***`, `("_Verify: x_")`, `_Verify: x_— then`; bold labels and `__x__` stay no markers.
  {
    const js = JSON.stringify;
    const v = (line) => S.taskMarkers({ text: line, body: [] }).verify;
    const want = {
      "Build **_Verify: npm test_**": ["npm test"], "Build ***Verify: npm test***": ["npm test"], 'Build ("_Verify: npm test_")': ["npm test"],
      "Build _Verify: npm test_— then lint": ["npm test"], "Build _Verify: npm test_– then": ["npm test"], "Build «_Verify: npm test_»": ["npm test"],
      "Build “_Verify: npm test_”": ["npm test"], "Build ‘_Verify: npm test_’": ["npm test"], "Build '_Verify: npm test_'": ["npm test"],
      "Build *_Verify: npm test_*": ["npm test"], "Build _Verify: npm test_.": ["npm test"],
      "Build **Verify:** npm test": [], "x __Verify: npm test__": [], '_Verify: python -c "import a_; print(1)"_': ['python -c "import a_; print(1)"'],
      "x *Verify: ls **/*.js*": ["ls **/*.js"], "x *Verify: npm test* and *Implements: a.js*": ["npm test"], "x ****Verify: npm test****": [],
    };
    const wrong = Object.keys(want).filter((l) => js(v(l)) !== js(want[l]));
    ok(!wrong.length, "1.24 r6 D9: marker closers followed by *, quotes, dashes or guillemets are read (bold-italic, quoted, a dash after); a bold label, __x__ and ****x**** stay no marker; a value keeps its own _ (wrong: " +
      js(wrong.map((l) => [l, v(l)])) + ")");
  }

  // 1.24 r6 D3: "\r\r\n" line endings (a CRLF file converted again) and a U+2028 / U+2029 inside a task's text — the task vanished
  // from the whole-file view (complete_task: "Task 1 not found") while activeTasks (split on /\r?\n/) still read it.
  {
    const js = JSON.stringify;
    const pc = path.join(tmp, "proj-r6-crcr");
    S.initProject(pc, ["core"], "en");
    const fc = S.createFeature(pc, "Crcr", ["core"], "", undefined, "en");
    const tc = path.join(fc.dir, "tasks.md");
    fs.writeFileSync(tc, ["# Tasks", "", "## Phase 1", "", "- [ ] 1. Build the parser _Verify: npm test_", "- [ ] 2. Handle errors _Verify: npm test_", ""].join("\r\r\n"));
    const c1 = S.completeTask(pc, "crcr", 1, { command: "npm test", exitCode: 0 });
    const after = fs.readFileSync(tc, "utf8");
    const fl = S.createFeature(pc, "Ls", ["core"], "", undefined, "en");
    const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
    fs.writeFileSync(path.join(fl.dir, "tasks.md"), "# Tasks\n\n- [x] 1. Build the parser\n- [ ] 2. Handle errors" + LS + "(see the spec) _Verify: npm test_\n- [ ] 3. Docs" + PS + "end\n");
    const nx = S.nextTask(pc, "ls");
    const c2 = S.completeTask(pc, "ls", 2, { command: "npm test", exitCode: 0 });
    ok(c1.ok && c1.verified && c1.total === 2 && after.includes("- [x] 1. Build the parser _Verify: npm test_\r\r\n- [ ] 2.") && nx.next && nx.next.number === 2 && nx.total === 3 &&
      c2.ok && c2.verified && S.taskMarkers(S.taskBlocks(fs.readFileSync(path.join(fl.dir, "tasks.md"), "utf8"))[1]).verify[0] === "npm test",
      "1.24 r6 D3: a tasks.md with \\r\\r\\n line endings reads its tasks (ticked in place, the endings kept); a U+2028 / U+2029 inside a task's text is an ordinary character (got " +
      js([c1.ok, c1.total, c1.error, nx.next, nx.total, c2.ok, c2.error]) + ")");
  }

  // 1.24 r6 D-I6: the whole-file scanner and the active view (activeTasks — a track turned off) read the same task numbers on every
  // tasks.md variant: LF / CRLF / \r\r\n, a BOM, tabs, U+2028 / U+2029 in a task's text, a nested list, a fence and a comment.
  {
    const js = JSON.stringify;
    const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029), BOM = String.fromCharCode(0xfeff);
    const E = require(path.join(__dirname, "lib", "engine", "index.js")); // activeTasks is the engine's (no facade name)
    const wrong = [];
    let n = 0;
    for (const eol of ["\n", "\r\n", "\r\r\n"]) for (const bom of ["", BOM]) for (const sep of ["", LS, PS]) for (const tab of [" ", "\t"]) {
      const lines = [bom + "# Tasks", "", "## Phase 1", "", "-" + tab + "[ ]" + tab + "1." + tab + "Build the parser" + sep + "(see the spec) _Verify: npm test_",
        "", "## Story US-1 — Security", "", "- [ ] 2. Threat model" + sep + "notes", "", "## Phase 2", "", "- Group A", "    - [ ] 3. Nested task", "", "```md", "- [ ] 9. Example", "```",
        "<!-- - [ ] 8. hidden -->", "- [x] 4. Done task" + sep, ""];
      const text = lines.join(eol);
      const whole = S.taskBlocks(text).map((b) => b.number);
      const off = S.taskBlocks(E.activeTasks(text, ["core"])).map((b) => b.number);
      const on = S.taskBlocks(E.activeTasks(text, ["core", "sec"])).map((b) => b.number);
      const parsed = S.parseTasks(text).map((t) => t.number);
      if (js(whole) !== "[1,2,3,4]" || js(off) !== "[1,3,4]" || js(on) !== js(whole) || js(parsed) !== js(whole)) wrong.push([js(eol), bom ? "bom" : "", sep.charCodeAt(0) || "", tab === "\t" ? "tab" : "", whole, off, on]);
      n++;
    }
    ok(!wrong.length && n === 36, "1.24 r6 D-I6: on " + n + " tasks.md variants the whole-file scanner, parseTasks and the active view (+sec off / on) read the same task numbers (wrong: " + js(wrong.slice(0, 6)) + ")");
    const CR = String.fromCharCode(13);
    const { ms, hostile } = remeasure(() => { // 1.26: measured once more on a timing-only miss
      const t0 = Date.now();
      const hostile = [S.taskBlocks("- [ ] 1. a" + CR.repeat(200000) + "b\n- [ ] 2. c" + CR.repeat(200000) + "\n"), E.activeTasks(("## Story US-1 — Security" + CR.repeat(100000) + "\n").repeat(2), ["core"])];
      return { ms: Date.now() - t0, hostile };
    }, (s) => s.ms < 3000);
    ok(ms < 3000 && hostile[0].length === 2, "1.24 r6 D3: trailing-CR stripping stays linear (200,000 CRs before text / at a line's end) (got " + js([ms, hostile[0].length]) + ")");
  }

  // 1.24 r6 D6: the next task and the waves' implicit chain follow the SECTIONS in file order, then the number — a task appended into
  // an earlier phase (spec_append_tasks {heading}, numbered after every task) comes before a later phase's tasks: by number, next
  // served Phase 2 first, past Phase 1's checkpoint. parseTasks' public order stays by number.
  {
    const js = JSON.stringify;
    const po = path.join(tmp, "proj-r6-order");
    S.initProject(po, ["core"], "en");
    const fo = S.createFeature(po, "Order", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(fo.dir, "tasks.md"), ["# Tasks", "", "## Phase 1: Foundation", "", "- [x] 1. Create the schema", "- [ ] 2. Write the repository",
      "**Checkpoint:** the repository persists users", "", "## Phase 2: API", "", "- [ ] 3. Expose GET /users", "- [ ] 4. Expose POST /users",
      "**Checkpoint:** the API serves users", ""].join("\n"));
    const ap = S.appendTasks(po, "order", [{ text: "Add the repository's unique-email constraint" }], { heading: "Phase 1: Foundation" });
    const c2 = S.completeTask(po, "order", 2);
    const nx = S.nextTask(po, "order", { waves: true });
    const br = S.taskBrief(po, "order");
    const st = S.statusFeature(po, "order");
    const parsed = S.parseTasks(fs.readFileSync(path.join(fo.dir, "tasks.md"), "utf8")).map((t) => t.number);
    ok(ap.ok && ap.appended[0].number === 5 && c2.next && c2.next.number === 5 && nx.next.number === 5 && js(nx.waves) === "[[5],[3],[4]]" && br.task && br.task.number === 5 &&
      st.tasks.next && st.tasks.next.number === 5 && js(parsed) === "[1,2,3,4,5]",
      "1.24 r6 D6: a task appended into Phase 1 is next before Phase 2's tasks (complete_task's next, next_task, the waves, the brief's default task, status); parseTasks stays by number (got " +
      js([ap.appended.map((x) => x.number), c2.next, nx.next, nx.waves, br.task && br.task.number, st.tasks.next, parsed]) + ")");
    // within one section (or a tasks.md without phases) the number decides, as before
    fs.writeFileSync(path.join(fo.dir, "tasks.md"), "- [ ] 2. Second\n- [ ] 1. First\n- [ ] 3. Third\n");
    const flat = S.nextTask(po, "order", { waves: true });
    ok(flat.next.number === 1 && js(flat.waves) === "[[1],[2],[3]]", "1.24 r6 D6: within one section the number decides (unchanged) (got " + js([flat.next, flat.waves]) + ")");
  }

  // A track's tasks numbered after a removed task's leftover evidence; mistyped / quoted / other-box task lines named; setext phase headings.
  {
    const js = JSON.stringify;
    const E = require("./lib/engine/index.js");
    const REQ = "# Feature: x\n\n## Summary\nExport invoices as CSV.\n\n### US-1 (P1 — MVP): Export\n#### Acceptance Criteria (EARS)\n" +
      "1. **US-1.AC-1** — WHEN an admin clicks Export THE SYSTEM SHALL download a CSV.\n2. **US-1.AC-2** — IF the export fails THEN THE SYSTEM SHALL show the error code.\n\n" +
      "## Success Criteria\n- **SC-001** — 95% of exports finish in under 5 s.\n\n## Out of Scope\n- PDF export.\n";
    const TASKS = "# Tasks\n\n## Phase 1\n- [ ] 1. [US1] Build the export\n  - _Requirements: US-1.AC-1_\n  - _Verify: node -e \"process.exit(0)\"_\n" +
      "- [ ] 2. [US1] Show the error code\n  - _Requirements: US-1.AC-2_\n  - _Verify: node -e \"process.exit(0)\"_\n";

    // Finding 2 — a track's template tasks (spec_add_track; a track pack's block too) were numbered after tasks.md's last task only:
    // a task removed from tasks.md left its evidence / tick under its number, and the track's first new task took that number —
    // ticked by hand, it read verified on the removed task's run. spec_append_tasks already skipped those numbers; now both ask
    // nextTaskNumber (tasks.md + the state's evidence and ticks).
    {
      const p = path.join(tmp, "proj-r7t-tracknum");
      S.initProject(p, ["core"], "en");
      const f = S.createFeature(p, "Export", ["core"]);
      fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
      fs.writeFileSync(path.join(f.dir, "tasks.md"), TASKS);
      const c2 = S.completeTask(p, f.slug, 2, { command: "node -e \"process.exit(0)\"", exitCode: 0 });
      const tp = path.join(f.dir, "tasks.md");
      fs.writeFileSync(tp, fs.readFileSync(tp, "utf8").replace(/- \[x\] 2\.[\s\S]*$/, "")); // task 2 descoped: its record stays
      const add = S.addTrack(p, f.slug, ["sec"]);
      const nums = S.taskBlocks(fs.readFileSync(tp, "utf8")).map((b) => b.number);
      const unit = [E.nextTaskNumber("- [ ] 1. a\n- [ ] 4. b\n", { evidence: { 7: {} }, ticks: { 9: "x" } }), E.nextTaskNumber("- [ ] 1. a\n", null),
        E.nextTaskNumber("", { evidence: { abc: {}, 3: {} } })];
      ok(c2.ok && add.ok && nums[0] === 1 && !nums.includes(2) && nums[1] === 3 && js(unit) === "[10,2,4]",
        "1.25.1 review 7: spec_add_track numbers the track's tasks after a removed task's leftover evidence / tick (task 2's number is never reused); nextTaskNumber = max(tasks.md, evidence, ticks) + 1 (got " +
        js([c2.ok, add.ok, nums, unit]) + ")");
    }

    // Finding 5 — right under `- [ ] 1. A`, a mistyped task line (`- [ ] 2 B`, `- [ ] 2) B`, `- [~] 2. B`) was read as task 1's BODY
    // (its markers included) and doctor's unread-tasks stayed silent; `- [-] 2.` after a blank line and a quoted `> - [ ] 1.` were
    // skipped silently. A checkbox item at the task's own indentation is a sibling, never body; any one-character box and a quoted one
    // are named by unread-tasks. A sub-step checkbox (deeper) stays the task's body.
    {
      const head = "# Tasks\n\n## Phase 1\n- [ ] 1. Build parser\n";
      const cases = {
        noDot: head + "- [ ] 2 Build lexer\n  - _Verify: rm -rf build_\n- [ ] 3. Wire it\n",
        paren: head + "- [ ] 2) Build lexer\n- [ ] 3. Wire it\n",
        tilde: head + "- [~] 2. Build lexer (in progress)\n- [ ] 3. Wire it\n",
        dash: head + "\n- [-] 2. Build lexer (cancelled?)\n\n- [ ] 3. Wire it\n",
        quoted: "# Tasks\n\n> - [ ] 1. Quoted task\n\n- [ ] 2. Real\n",
      };
      const got = {};
      for (const [k, t] of Object.entries(cases)) {
        const b = S.taskBlocks(t);
        got[k] = { nums: b.map((x) => x.number), body1: (b[0] || {}).body, unread: E.unreadTaskLines(t).map((u) => u.line) };
      }
      const sub = head + "  - [ ] write the grammar first\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 2. Wire it\n";
      const subB = S.taskBlocks(sub);
      const link = "# Tasks\n\n- [ ] 1. A\n\n- [a](https://example.com) a link, no box\n";
      const p = path.join(tmp, "proj-r7t-unread");
      S.initProject(p, ["core"], "en");
      const f = S.createFeature(p, "Parser", ["core"]);
      fs.writeFileSync(path.join(f.dir, "tasks.md"), cases.noDot);
      const doc = (S.specDoctor(p, f.slug).checks.find((c) => c.id === "unread-tasks") || {});
      all("1.25.1 review 7: a mistyped task line under a task (`- [ ] 2 B`, `2)`, `[~]`) is no longer its body — doctor's unread-tasks names it, like `- [-] 2.` and a quoted `> - [ ] 1.`; a deeper sub-step checkbox stays the task's body; a link is no box (got " +
        js([got, subB[0].body, doc.status, doc.detail]) + ")", [
        () => js(got.noDot.nums) === "[1,3]", () => js(got.noDot.body1) === "[]", () => js(got.noDot.unread) === "[5]",
        () => js(got.paren.body1) === "[]", () => js(got.paren.unread) === "[5]", () => js(got.tilde.body1) === "[]",
        () => js(got.tilde.unread) === "[5]", () => js(got.dash.unread) === "[6]", () => js(got.quoted.nums) === "[2]",
        () => js(got.quoted.unread) === "[3]",
        () => js(subB[0].body) === js(["- [ ] write the grammar first", "- _Verify: node -e \"process.exit(0)\"_"]),
        () => js(E.unreadTaskLines(sub)) === "[]", () => js(E.unreadTaskLines(link)) === "[]", () => doc.status === "warn",
        () => /L5 `- \[ \] 2 Build lexer`/.test(doc.detail || ""),
      ]);
    }

    // Finding 7 — the scanner read ATX phase headings only while activeTasks and the section readers read setext ones too: every task's
    // phase was null, so taskSchedule (sections first, then numbers) served task 3 of "Phase B" before task 5 of "Phase A", and
    // spec_append_tasks never found a setext phase (it opened a second "## Phase A").
    {
      const setext = "Phase A\n=======\n\n- [x] 1. A\n- [ ] 5. A-late (appended)\n\nPhase B\n-------\n\n- [ ] 3. C\n";
      const b = S.taskBlocks(setext);
      const next = S.taskSchedule(b).next;
      const p = path.join(tmp, "proj-r7t-setext");
      S.initProject(p, ["core"], "en");
      const f = S.createFeature(p, "Setext", ["core"]);
      const tp = path.join(f.dir, "tasks.md");
      fs.writeFileSync(tp, "# Tasks\n\nPhase A\n-------\n\n- [ ] 1. A\n\nPhase B\n-------\n\n- [ ] 2. B\n");
      const ap = S.appendTasks(p, f.slug, [{ text: "A again" }], { heading: "Phase A" });
      const after = fs.readFileSync(tp, "utf8");
      const ab = S.taskBlocks(after);
      // an empty setext phase: the new task lands under its underline, never between the heading's text and its underline
      fs.writeFileSync(tp, "# Tasks\n\nPhase C\n-------\n\nPhase D\n-------\n\n- [ ] 1. D\n");
      const ap2 = S.appendTasks(p, f.slug, [{ text: "C first" }], { heading: "Phase C" });
      const after2 = fs.readFileSync(tp, "utf8");
      ok(js(b.map((x) => x.phase)) === '["Phase A","Phase A","Phase B"]' && next && next.number === 5 &&
        ap.ok && ap.heading === "Phase A" && ap.headingCreated === false && (after.match(/Phase A/g) || []).length === 1 &&
        js(ab.map((x) => [x.number, x.phase])) === '[[1,"Phase A"],[3,"Phase A"],[2,"Phase B"]]' &&
        ap2.ok && ap2.headingCreated === false && /Phase C\n-------\n- \[ \] 2\. C first\n/.test(after2) && js(S.taskBlocks(after2).map((x) => [x.number, x.phase])) === '[[2,"Phase C"],[1,"Phase D"]]',
        "1.25.1 review 7: setext phase headings are phases to the task scanner (taskSchedule serves Phase A's open task first) and to spec_append_tasks (it appends into the setext phase, under its underline) (got " +
        js([b.map((x) => x.phase), next && next.number, ap.ok, ap.error, ap.headingCreated, ab.map((x) => [x.number, x.phase]), ap2.ok, ap2.error, after2]) + ")");
    }
  }
};
