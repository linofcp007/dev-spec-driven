"use strict";
// `done --run` verifies the very task it ticks — zero-padded numbers, --exit alone, --shell, localized output.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, run, tmp, CLI }) => {
// 1.13 WP1: `done --run` verifies the very task it ticks; zero-padded numbers; --exit alone; --shell; localized output
const w1p = path.join(tmp, "wp1-proj");
const w1Read = (f) => fs.readFileSync(path.join(w1p, ".specs", f, "tasks.md"), "utf8");
run(["create", "Dup", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "dup", "tasks.md"),
  "- [x] 3. a\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 3. b\n  - _Verify: node -e \"process.exit(7)\"_\n");
const w1Dup = run(["done", "dup", "3", "--run", "--project", w1p]);
ok(w1Dup.code === 1 && /process\.exit\(7\)/.test(w1Dup.out) && !/process\.exit\(0\)/.test(w1Dup.out) && /- \[ \] 3\. b/.test(w1Read("dup")) &&
  JSON.parse(fs.readFileSync(path.join(w1p, ".specs", "dup", ".state.json"), "utf8")).evidence["3"].exitCode === 7,
  "done --run on a duplicated number runs the _Verify:_ of the task it would tick (exit 7 → recorded, stays open, exit 1)");
// The cmd.exe / --shell bash hint only when cmd.exe itself failed (an unknown command, its own syntax error) — a check that
// ran and failed (exit 7 above) needs a code fix, not another shell: it used to print the hint on every failed run.
run(["create", "Nocmd", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "nocmd", "tasks.md"), "- [ ] 1. n\n  - _Verify: no-such-command-dsd --check_\n");
const w1No = run(["done", "nocmd", "1", "--run", "--project", w1p]);
ok(!/--shell bash/.test(w1Dup.out) && w1No.code === 1 && (process.platform === "win32") === /--shell bash/.test(w1No.out) && /- \[ \] 1\. n/.test(w1Read("nocmd")),
  "a check that ran and failed prints no shell hint; a command cmd.exe could not run (unknown command) prints the --shell bash hint on Windows (only there)");
// A red-phase task (its test must FAIL) with a must-pass _Verify:_: `done --run` explains how to fix the task, not only "fix the code".
run(["create", "Red", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "red", "tasks.md"), "- [ ] 1. [US1] Write regression test T-01 and watch it fail for the right reason\n  - _Verify: node -e \"process.exit(1)\"_\n");
const w1Red = run(["done", "red", "1", "--run", "--project", w1p]);
ok(w1Red.code === 1 && /Task 1 writes a test that must FAIL \(the red phase\)/.test(w1Red.out) && /Mark task 1 with _Expect: fail_/.test(w1Red.out) && /node "[^"]*dev-spec\.js" done red 1 --run\. Or move the command/.test(w1Red.out) && !/--shell bash/.test(w1Red.out),
  "done --run on a red-phase task: the refusal says to mark it _Expect: fail_ (or move the _Verify:_ to the fix task) (no shell hint)");
run(["create", "Pad", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "pad", "tasks.md"), "- [ ] 01. First\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 02. Second\n- [ ] 03. Third\n");
const w1P1 = run(["done", "pad", "01", "--run", "--project", w1p]);
const w1P2 = run(["done", "pad", "2", "--project", w1p]);
ok(w1P1.code === 0 && /Task 1 done \(verified\)\. 1\/3/.test(w1P1.out) && w1P2.code === 0 && /Task 2 done\. 2\/3\s+next → #3 Third/.test(w1P2.out) &&
  /- \[x\] 01\. First\n[\s\S]*- \[x\] 02\. Second/.test(w1Read("pad")), "done finds zero-padded tasks ('01' with --run, and 2 for '02.')");
const w1Exit = run(["done", "pad", "3", "--exit", "0", "--project", w1p]);
ok(w1Exit.code === 1 && /exit code alone/.test(w1Exit.out) && /- \[ \] 03\. Third/.test(w1Read("pad")), "done --exit 0 alone (no --cmd, no --evidence) is rejected and ticks nothing");
// No runnable _Verify:_ and nothing recorded: verified (doctor's verdict — never verified:false without a reason), flagged
// nothingToVerify, so the human line never says "(verified)" for a task nothing checked (w1P2 above).
const w1J = run(["done", "pad", "3", "--json", "--project", w1p]);
const w1Jr = (() => { try { return JSON.parse(w1J.out); } catch { return {}; } })();
ok(w1J.code === 0 && w1Jr.verified === true && w1Jr.nothingToVerify === true && w1Jr.unverifiedReason === undefined && w1Jr.note === undefined,
  "done --json on a task with no _Verify:_ and no evidence: verified + nothingToVerify, no unverifiedReason (the human line prints no '(verified)')");
run(["create", "Sh", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "sh", "tasks.md"), "- [ ] 1. t\n  - _Verify: node -e \"process.exit(0)\"_\n");
const w1Sh = run(["done", "sh", "1", "--run", "--shell", "no-such-shell-dsd", "--project", w1p]);
ok(w1Sh.code === 1 && /no-such-shell-dsd/.test(w1Sh.out) && !/--shell bash/.test(w1Sh.out) && /- \[ \] 1\. t/.test(w1Read("sh")),
  "--shell takes a value: the run uses that shell (a missing one fails, leaves the task open, no default-shell hint)");
const realShell = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "/bin/sh";
const w1Env = spawnSync(process.execPath, [CLI, "done", "sh", "1", "--run", "--shell", realShell, "--json", "--project", w1p], { encoding: "utf8", env: { ...process.env, DEV_SPEC_SHELL: "no-such-shell-dsd" } });
const w1EnvOnly = spawnSync(process.execPath, [CLI, "done", "sh", "1", "--run", "--project", w1p], { encoding: "utf8", env: { ...process.env, DEV_SPEC_SHELL: "no-such-shell-dsd" } });
let w1Json = null;
try { w1Json = JSON.parse(w1Env.stdout); } catch { /* not one JSON document */ }
ok(w1EnvOnly.status === 1 && /no-such-shell-dsd/.test(w1EnvOnly.stdout + w1EnvOnly.stderr) && w1Env.status === 0 && w1Json && w1Json.verified === true,
  "DEV_SPEC_SHELL picks the shell, --shell beats it; with --json the run log goes to stderr and stdout stays one JSON document");
// Windows' default shell (cmd.exe) has no single quotes: `node -e 'process.exit(1)'` exits 0 there, so a _Verify:_ written for a
// POSIX shell is refused before anything runs (unless --shell / DEV_SPEC_SHELL picks one) — never a false "verified".
run(["create", "Posix", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "posix", "tasks.md"), "- [ ] 1. q\n  - _Verify: node -e 'process.exit(1)'_\n");
const w1Px = run(["done", "posix", "1", "--run", "--project", w1p]);
const w1PxState = () => JSON.parse(fs.readFileSync(path.join(w1p, ".specs", "posix", ".state.json"), "utf8"));
if (process.platform === "win32") {
  run(["create", "Plicas", "core", "--lang", "pt", "--project", w1p]);
  fs.writeFileSync(path.join(w1p, ".specs", "plicas", "tasks.md"), "- [ ] 1. q\n  - _Verify: echo $HOME_\n");
  const w1PxPt = run(["done", "plicas", "1", "--run", "--project", w1p]);
  const w1PxOpen = /- \[ \] 1\. q/.test(w1Read("posix")) && !(w1PxState().evidence || {})["1"]; // before --shell cmd ticks it
  const w1PxCmd = run(["done", "posix", "1", "--run", "--shell", "cmd", "--project", w1p]);
  ok(w1Px.code === 1 && /uses POSIX shell syntax \(single quotes/.test(w1Px.out) && /--shell bash/.test(w1Px.out) && !/^\$ node/m.test(w1Px.out) &&
    w1PxOpen && w1PxPt.code === 1 && /usa sintaxe de shell POSIX \(\$VARIAVEIS\)/.test(w1PxPt.out) &&
    w1PxCmd.code === 0 && /^\$ node -e 'process\.exit\(1\)'/m.test(w1PxCmd.out),
    "Windows: done --run refuses a POSIX-quoted _Verify:_ under the default cmd.exe (nothing run, task open, no evidence; localized); --shell cmd runs it anyway");
} else {
  ok(w1Px.code === 1 && /process\.exit\(1\)/.test(w1Px.out) && /- \[ \] 1\. q/.test(w1Read("posix")) && w1PxState().evidence["1"].exitCode === 1,
    "POSIX: done --run runs a single-quoted _Verify:_ under /bin/sh as written (a failing check fails)");
}
run(["create", "Tarefas", "core", "--lang", "pt", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "tarefas", "tasks.md"), "- [ ] 1. um\n- [ ] 2. dois\n");
const w1Pt = run(["done", "tarefas", "1", "--project", w1p]);
ok(/Tarefa 1 feita\. 1\/2\s+próxima → #2 dois/.test(w1Pt.out) && /tem de ser um inteiro/.test(run(["done", "tarefas", "x", "--project", w1p]).out) &&
  /já estava feita/.test(run(["done", "tarefas", "1", "--project", w1p]).out), "done output and refusals follow the feature language (PT)");
// A `_Verify:_` inside a fenced example under a task is documentation, never the task's command: done --run refuses
// (noRunnable) and runs nothing.
run(["create", "Fenced", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "fenced", "tasks.md"), "- [ ] 1. Document the task markers in the README\n  ```md\n  - [ ] 9. Example task\n" +
  "    - _Verify: node -e \"require('fs').writeFileSync('FENCED-VERIFY-RAN.txt','x')\"_\n  ```\n");
const w1Fence = spawnSync(process.execPath, [CLI, "done", "fenced", "1", "--run", "--project", w1p], { encoding: "utf8", cwd: w1p });
ok(w1Fence.status === 1 && /task 1 has no runnable _Verify: <command>_ marker/.test(w1Fence.stderr) && !fs.existsSync(path.join(w1p, "FENCED-VERIFY-RAN.txt")) &&
  /- \[ \] 1\. Document/.test(w1Read("fenced")), "done --run never executes a _Verify:_ from a fenced example under the task (noRunnable, nothing ran, task open)");
// Review fixes: the second "3." never borrows the first one's passing run; "--exit 0" without --cmd can't clear
// a recorded failure; a one-line ```code``` span doesn't hide the tasks below it.
run(["create", "Dup Two", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "dup-two", "tasks.md"),
  "- [ ] 3. a\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 3. b\n  - _Verify: node -e \"process.exit(7)\"_\n");
const w1D1 = run(["done", "dup-two", "3", "--run", "--project", w1p]);
const w1D2 = run(["done", "dup-two", "3", "--project", w1p]);
const w1DDoc = run(["doctor", "dup-two", "--project", w1p]);
ok(w1D1.code === 0 && /Task 3 done \(verified\)\. 1\/2/.test(w1D1.out) && w1D2.code === 0 && /Task 3 done\. 2\/2/.test(w1D2.out) && !/\(verified\)/.test(w1D2.out) &&
  /renumber/.test(w1D2.out) && /verification — .*#3 \(number shared with another task\)/.test(w1DDoc.out),
  "done on the second '3.' (its exit-7 _Verify:_ never ran) is not '(verified)'; doctor flags it");
run(["create", "Claim", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "claim", "tasks.md"), "- [ ] 1. docs\n- [ ] 2. x\n");
const w1C1 = run(["done", "claim", "1", "--cmd", "npm run lint", "--exit", "2", "--evidence", "lint failed", "--project", w1p]);
const w1C2 = run(["done", "claim", "1", "--evidence", "fixed it", "--exit", "0", "--project", w1p]);
ok(w1C1.code === 1 && w1C2.code === 0 && /Task 1 done\. 1\/2/.test(w1C2.out) && !/\(verified\)/.test(w1C2.out) && /latest recorded run failed \(exit 2\)/.test(w1C2.out),
  "--evidence + --exit 0 without --cmd after a failed run ticks but stays unverified (a claimed exit code is not a run)");
run(["create", "Fence", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "fence", "tasks.md"), "## Phase: Build\n- [x] 1. Wire the CLI\n  ```npm test```\n- [ ] 2. Write docs\n- [ ] 3. Release\n");
const w1FSt = run(["status", "fence", "--project", w1p]);
const w1FDone = run(["done", "fence", "2", "--project", w1p]);
ok(/phase=executing/.test(w1FSt.out) && /1\/3/.test(w1FSt.out) && w1FDone.code === 0 && /Task 2 done\. 2\/3\s+next → #3 Release/.test(w1FDone.out),
  "status/done see the tasks below a one-line ```code``` span (not a fence)");
// Round 2: renumbering a duplicated number can't hand one task's passing run to the other; a copy-paste
// duplicate (same title, other _Verify:_) can't borrow it either; an inline "<!--" hides no task line.
run(["create", "Rn", "core", "--project", w1p]);
const w1RnTasks = path.join(w1p, ".specs", "rn", "tasks.md");
fs.writeFileSync(w1RnTasks, "- [ ] 3. a\n  - _Verify: node -e \"process.exit(7)\"_\n- [ ] 3. b\n  - _Verify: node -e \"process.exit(0)\"_\n");
const w1Rn = [run(["done", "rn", "3", "--run", "--project", w1p]), run(["done", "rn", "3", "--project", w1p]), run(["done", "rn", "3", "--run", "--project", w1p])];
fs.writeFileSync(w1RnTasks, fs.readFileSync(w1RnTasks, "utf8").replace("- [x] 3. b", "- [x] 4. b"));
const w1RnDoc = run(["doctor", "rn", "--project", w1p]);
ok(w1Rn[0].code === 1 && w1Rn[2].code === 0 && /\(verified\)/.test(w1Rn[2].out) && /verification — .*#3 \(latest run failed\), #4/.test(w1RnDoc.out),
  "done --run on a duplicated number, then renumbering: #3 keeps its own failed run (never the other task's pass)");
run(["create", "Copy Dup", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "copy-dup", "tasks.md"),
  "- [ ] 3. Run the checks\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 3. Run the checks\n  - _Verify: node -e \"process.exit(7)\"_\n");
const w1Cp1 = run(["done", "copy-dup", "3", "--run", "--project", w1p]);
const w1Cp2 = run(["done", "copy-dup", "3", "--project", w1p]);
ok(/Task 3 done \(verified\)\. 1\/2/.test(w1Cp1.out) && /Task 3 done\. 2\/2/.test(w1Cp2.out) && !/\(verified\)/.test(w1Cp2.out) &&
  /verification — .*#3 \(number shared with another task\)/.test(run(["doctor", "copy-dup", "--project", w1p]).out),
  "a copy-paste duplicate (same number and title, exit-7 _Verify:_ never run) is not '(verified)'");
run(["create", "Cm", "core", "--project", w1p]);
fs.writeFileSync(path.join(w1p, ".specs", "cm", "tasks.md"), "- [x] 1. Strip <!-- markers in the parser\n- [ ] 2. Handle the `-->` closer\n- [ ] 3. Docs\n");
const w1CmSt = run(["status", "cm", "--project", w1p]);
const w1CmDone = run(["done", "cm", "2", "--project", w1p]);
ok(/Tasks: 1\/3\s+next → #2/.test(w1CmSt.out) && w1CmDone.code === 0 && /Task 2 done\. 2\/3\s+next → #3 Docs/.test(w1CmDone.out),
  "an inline '<!--' in a task's text hides no task below it (status and done agree)");
};
