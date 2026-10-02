"use strict";
// Guards and hooks — 1.22 review regressions: the stop gate's admissions, activity and feature cap, the implementer's report, the approval guard's nested scripts.
// (10-guards.js holds the guards area's earlier tests; this file the findings of the 1.22 review of that area.)

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, S, tmp, __dirname }) => {
  const js = JSON.stringify;

  // 1.22 review (finding 2) — a zero count is no admission ("All tasks done. 0 tests failing." was `admitted`, silent), and a
  // failure that "now passes" is history ("Fixed the bug; the 2 failing tests now pass." — the `;` cut the fixed word off).
  {
    const notAdmitted = ["All tasks done. 0 tests failing.", "All tasks done; no tests fail.", "All tasks done — none of the tests fail.", "All tasks done. Zero tests failed.",
      "All tasks done. No tests are failing.", "Todas as tarefas concluídas. 0 testes a falhar.", "Concluído: nenhum dos testes falha.", "Todas las tareas completadas. 0 pruebas fallan.",
      "Fixed the bug; the 2 failing tests now pass. All tasks done.", "Feito. Os 2 testes a falhar agora passam.", "Hecho. Los 2 tests fallando ahora pasan.",
      "Feito. Os 2 testes falhando agora estão passando."];
    const stillAdmitted = ["All tasks done, but 2 tests are failing.", "Task 3 is done. 2 tests still fail.", "All done; the 2 failing tests don't now pass.",
      "All tasks done. I haven't fixed the 2 failing tests.", "Tudo concluído, mas 2 testes a falhar.", "Todo completado, pero 2 pruebas fallan.", "All done. No, 2 tests fail.",
      "All tasks done. 10 tests failing."];
    const wrong = notAdmitted.filter((m) => { const c = S.stopClaims(m); return !c.claim || c.admitted; }).map((m) => "admitted: " + m)
      .concat(stillAdmitted.filter((m) => !S.stopClaims(m).admitted).map((m) => "not admitted: " + m));
    // …and end to end: the gate now looks at the features (a recent unverified tick → block) instead of reading "0 tests failing" as honest.
    const p = path.join(tmp, "g122-zero");
    S.initProject(p, ["core"], "en");
    const f = S.createFeature(p, "Billing", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "- [ ] 1. [US1] Charge\n  - _Verify: npm test_\n");
    S.completeTask(p, "billing", 1);
    const s = S.stopCheck(p, { message: "All tasks done. 0 tests failing." });
    // linear: a long run of zero words before an admission
    const t0 = Date.now();
    S.stopClaims("All done. " + "none of the ".repeat(4000) + "tests fail. " + "no ".repeat(20000) + "tests fail.");
    const ms = Date.now() - t0;
    ok(!wrong.length && s.block === true && s.why === "unverified" && ms < 3000,
      "1.22 review: stopClaims — a zero count before an admission (0 / zero / no / none of; PT nenhum(a); ES ninguno(a)) is no admission, nor is a failure that now passes in its clause (EN / PT / PT-BR / ES); real admissions stay; the gate then checks the features (wrong: " +
      js(wrong) + ", gate " + js([s.block, s.why]) + ", " + ms + " ms)");
  }

  // 1.22 review (finding 3) — tasks ticked by hand (the Edit tool) never counted as activity: "All tasks done and verified." read
  // `no-recent` while #1 #2 had no evidence. The PostToolUse spec-hook now stamps .state.json lastEditAt (never a file date).
  {
    const specJs = path.join(__dirname, "..", "hooks", "spec-hook.js");
    const hook = (file, cwd) => spawnSync(process.execPath, [specJs], { encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" },
      input: JSON.stringify({ session_id: "s", cwd, hook_event_name: "PostToolUse", tool_name: "Edit", tool_input: { file_path: file, old_string: "- [ ]", new_string: "- [x]" }, tool_response: {} }) });
    const p = path.join(tmp, "g122-hand");
    S.initProject(p, ["core"], "en");
    const f = S.createFeature(p, "Hand", ["core"], "", undefined, "en");
    const tasks = path.join(f.dir, "tasks.md");
    fs.writeFileSync(tasks, "- [x] 1. [US1] A\n  - _Verify: npm test_\n- [x] 2. [US1] B\n  - _Verify: npm test_\n");
    const msg = "All tasks done and verified.";
    const before = S.stopCheck(p, { message: msg });
    const h = hook(tasks, p);
    const st = JSON.parse(fs.readFileSync(path.join(f.dir, ".state.json"), "utf8"));
    const after = S.stopCheck(p, { message: msg });
    // a change's change.md too; a stamp in the future is ignored; git's merge driver keeps the later stamp
    const c = S.createFeature(p, "Tweak", undefined, "", undefined, "en", undefined, { size: "xs" }); // a change: ONE change.md
    const cFile = path.join(c.dir, "change.md");
    const hc = hook(cFile, p);
    const cState = JSON.parse(fs.readFileSync(path.join(c.dir, ".state.json"), "utf8"));
    const m = S.mergeStateJson({ lastEditAt: "2026-01-01T00:00:00.000Z" }, { lastEditAt: "2026-01-02T00:00:00.000Z" }, { lastEditAt: "2026-01-03T00:00:00.000Z" }, "state");
    ok(before.block === false && before.why === "no-recent" && h.status === 0 && typeof st.lastEditAt === "string" && Math.abs(Date.parse(st.lastEditAt) - Date.now()) < 60000 &&
      after.block === true && after.why === "unverified" && js(after.features[0].unverified.map((d) => [d.number, d.reason])) === js([[1, "no-evidence"], [2, "no-evidence"]]) &&
      c.kind === "change" && hc.status === 0 && typeof cState.lastEditAt === "string" && cState.kind === "change" && m.merged.lastEditAt === "2026-01-03T00:00:00.000Z" && !m.conflicts.length,
      "1.22 review: a tasks.md saved by hand (spec-hook, PostToolUse Edit) stamps .state.json lastEditAt — the stop gate then sees the hand-ticked tasks without evidence and blocks (it read no-recent); change.md too; the merge driver keeps the later stamp (got " +
      js([before.why, st.lastEditAt, after.why, after.features, hc && hc.status, cState.lastEditAt, m]) + ")");
  }

  // 1.22 review (finding 4) — the stop gate looked at the first 50 feature folders only (alphabetically): 51 other features + an
  // active "zeta" with an unverified tick → never examined. Every feature's activity is read; the 50 most recent are checked.
  {
    const p = path.join(tmp, "g122-many");
    S.initProject(p, ["core"], "en");
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    for (let i = 0; i < 51; i++) {
      const d = path.join(p, ".specs", "a" + String(i).padStart(2, "0"));
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, ".state.json"), js({ lastTickAt: twoHoursAgo }));
      fs.writeFileSync(path.join(d, "tasks.md"), "- [x] 1. done\n");
    }
    const z = S.createFeature(p, "Zeta", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(z.dir, "tasks.md"), "- [ ] 1. [US1] Z\n  - _Verify: npm test_\n");
    S.completeTask(p, "zeta", 1);
    const t0 = Date.now();
    const s = S.stopCheck(p, { message: "All tasks done." });
    const ms = Date.now() - t0;
    ok(s.block === true && s.why === "unverified" && s.features.length === 1 && s.features[0].feature === "zeta",
      "1.22 review: stopCheck reads every feature's activity and checks the 50 most recently active — an active 'zeta' after 51 other features is no longer skipped (got " +
      js([s.block, s.why, s.features.map((x) => x.feature)]) + ", " + ms + " ms)");
  }

  // 1.22 review (finding 5) — the approval guard lexed a nested script only when it was ONE word: unquoted `cmd /c …` /
  // `pwsh -Command …` forms, winpty / flock / script -c / find -exec and Start-Process -ArgumentList were allowed even at deny.
  {
    const BS = String.fromCharCode(92);
    const meta = { approvalGuard: "deny" };
    const dec = (tool, command) => S.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: { command } }, "deny", { meta });
    const denied = [
      ["Bash", "cmd /c node cli" + BS + "dev-spec.js approve alpha tasks"], ["PowerShell", "cmd /c node cli" + BS + "dev-spec.js approve alpha tasks"],
      ["Bash", "cmd /c node cli" + BS + "dev-spec.js approve alpha tasks --force"], ["Bash", "cmd.exe /d /c node cli/dev-spec.js approve alpha tasks"],
      ["Bash", "CMD /K node \"C:" + BS + "My Tools" + BS + "cli" + BS + "dev-spec.js\" approve alpha tasks"],
      ["Bash", "pwsh -Command node cli/dev-spec.js approve alpha tasks"], ["PowerShell", "pwsh -Command node cli/dev-spec.js approve alpha tasks"],
      ["PowerShell", "powershell -c node cli/dev-spec.js approve alpha tasks"], ["PowerShell", "powershell -NoProfile -ExecutionPolicy Bypass node cli/dev-spec.js approve alpha tasks"],
      ["Bash", "cmd /c node cli" + BS + "dev-spec.js init --approval-guard off"],
      ["Bash", "winpty node cli/dev-spec.js approve alpha tasks"], ["Bash", "flock /tmp/x.lock node cli/dev-spec.js approve alpha tasks"],
      ["Bash", "flock -w 5 /tmp/x.lock -c \"node cli/dev-spec.js approve alpha tasks\""], ["Bash", "script -q -c \"node cli/dev-spec.js approve alpha tasks\" /dev/null"],
      ["Bash", "find . -maxdepth 0 -exec node cli/dev-spec.js approve alpha tasks " + BS + ";"], ["Bash", "find . -maxdepth 0 -exec cmd /c node cli/dev-spec.js approve alpha tasks " + BS + ";"],
      ["PowerShell", "Start-Process node -ArgumentList 'cli/dev-spec.js','approve','alpha','tasks'"],
      ["PowerShell", "Start-Process -FilePath node -ArgumentList @('cli/dev-spec.js','approve','alpha','tasks') -Wait"],
      ["PowerShell", "Start-Process node -ArgumentList \"cli/dev-spec.js approve alpha tasks\" -NoNewWindow"], ["PowerShell", "start node cli/dev-spec.js,approve,alpha,tasks"],
      ["PowerShell", "Start-Process -FilePath cli/dev-spec.cmd -ArgumentList approve,alpha,tasks"],
    ];
    const allowed = [["Bash", "cmd /c node cli" + BS + "dev-spec.js status alpha"], ["Bash", "pwsh -Command node cli/dev-spec.js next alpha"], ["Bash", "find . -name dev-spec -exec cat {} ;"],
      ["PowerShell", "Start-Process node -ArgumentList 'cli/dev-spec.js','status'"], ["Bash", "flock /tmp/x.lock node cli/dev-spec.js status"],
      ["Bash", "echo cmd /c node cli/dev-spec.js approve alpha tasks"], ["Bash", "pwsh -File run.ps1 node cli/dev-spec.js approve alpha tasks"]];
    const wrong = denied.filter(([t, c]) => dec(t, c).decision !== "deny").map(([t, c]) => "allowed: " + t + " " + c)
      .concat(allowed.filter(([t, c]) => dec(t, c).decision !== "allow").map(([t, c]) => "denied: " + t + " " + c));
    const once = dec("Bash", "cmd /c \"node cli/dev-spec.js approve alpha tasks\"");
    const force = dec("Bash", "cmd /c node cli" + BS + "dev-spec.js approve alpha tasks --force");
    const down = dec("Bash", "cmd /c node cli" + BS + "dev-spec.js init --approval-guard off");
    // …through the hook too (PreToolUse, Bash): a project at deny
    const p = path.join(tmp, "g122-approval");
    S.initProject(p, ["core"], "en", { approvalGuard: "deny" });
    const hookJs = path.join(__dirname, "..", "hooks", "approval-hook.js");
    const h = spawnSync(process.execPath, [hookJs], { encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" },
      input: js({ session_id: "s", cwd: p, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "cmd /c node cli" + BS + "dev-spec.js approve alpha tasks" } }) });
    let hd = null; try { hd = JSON.parse(h.stdout).hookSpecificOutput.permissionDecision; } catch { /* none */ }
    // linear enough: a long unquoted cmd /c line
    const t0 = Date.now();
    dec("Bash", "cmd /c " + "x ".repeat(20000) + "node cli/dev-spec.js approve a tasks");
    const ms = Date.now() - t0;
    ok(!wrong.length && once.actions.length === 1 && force.force === true && down.actions[0].kind === "guard-down" && down.actions[0].setting === "approvalGuard" &&
      h.status === 0 && hd === "deny" && ms < 3000,
      "1.22 review: the approval guard reads cmd /c /k /r and pwsh / powershell -Command / -c (and Windows PowerShell's positional script) unquoted — the rest of the line is the script — plus winpty, flock (its lock file; -c), script -c, find -exec and Start-Process -ArgumentList (array or string): approve / --force / init --approval-guard off are caught at deny (the hook too); a quoted script is one action; status / next, echo and pwsh -File stay allowed (wrong: " +
      js(wrong) + ", " + js([once.actions.length, force.force, down.actions, hd, ms]) + ")");
  }
};
