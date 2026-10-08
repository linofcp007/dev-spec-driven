"use strict";
// `done --run` verifies the very task it ticks — zero-padded numbers, --exit alone, --shell, localized output.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, run, tmp, CLI, require, __dirname }) => {
// 1.13 WP1: `done --run` verifies the very task it ticks; zero-padded numbers; --exit alone; --shell; localized output
const w1p = path.join(tmp, "wp1-proj");
fs.mkdirSync(w1p, { recursive: true }); // 1.23 review: --project names an existing folder (only init creates one)
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

// 1.21.1 languages: PowerShell as the run shell — --shell pwsh / powershell and DEV_SPEC_SHELL=pwsh run the _Verify:_ as
// `<shell> -NoProfile -NonInteractive -Command <cmd>` (the exit code propagates, `$` is PowerShell's); under the default cmd.exe
// a `pwsh -NoProfile -Command "…; exit $LASTEXITCODE"` _Verify:_ runs (1.21.0 refused it as POSIX syntax) while a single-quoted
// `pwsh -c '…'` is still refused, naming --shell pwsh. Skipped where pwsh / powershell isn't installed (the Linux containers).
const hasShell = (sh) => { try { return spawnSync(sh, ["-NoProfile", "-NonInteractive", "-Command", "exit 0"], { encoding: "utf8", windowsHide: true, timeout: 60000 }).status === 0; } catch { return false; } };
const hasPwsh = hasShell("pwsh"), hasWinPs = process.platform === "win32" && hasShell("powershell");
const lp = path.join(tmp, "l121-pwsh-run");
fs.mkdirSync(lp, { recursive: true }); // 1.23 review: --project names an existing folder (only init creates one)
run(["create", "Pwsh", "core", "--project", lp]);
const lpRead = () => fs.readFileSync(path.join(lp, ".specs", "pwsh", "tasks.md"), "utf8");
const lpEv = () => { try { return JSON.parse(fs.readFileSync(path.join(lp, ".specs", "pwsh", ".state.json"), "utf8")).evidence || {}; } catch { return {}; } };
fs.writeFileSync(path.join(lp, ".specs", "pwsh", "tasks.md"), [
  "- [ ] 1. passes under PowerShell", "  - _Verify: $n = 0; Write-Output \"ran $n\"; exit $n_",
  "- [ ] 2. fails under PowerShell", "  - _Verify: exit 3_",
  "- [ ] 3. [US1] Write T-01 and watch it fail", "  - _Verify: Invoke-NoSuchCmdletDsd -Path tests_", "  - _Expect: fail_",
  "- [ ] 4. pwsh under cmd.exe", "  - _Verify: pwsh -NoProfile -Command \"node -e 'process.exit(0)'; exit $LASTEXITCODE\"_",
  "- [ ] 5. pwsh under cmd.exe, failing", "  - _Verify: pwsh -NoProfile -Command \"node -e 'process.exit(5)'; exit $LASTEXITCODE\"_",
  "- [ ] 6. a single-quoted script", "  - _Verify: pwsh -c 'exit 0'_",
  "- [ ] 7. Windows PowerShell 5.1", "  - _Verify: if ($PSVersionTable.PSEdition -eq 'Desktop') { exit 0 } else { exit 9 }_", ""].join("\n"));
if (hasPwsh) {
  const r1 = run(["done", "pwsh", "1", "--run", "--shell", "pwsh", "--project", lp]);
  const r2 = run(["done", "pwsh", "2", "--run", "--shell", "pwsh", "--project", lp]);
  const r3 = spawnSync(process.execPath, [CLI, "done", "pwsh", "3", "--run", "--project", lp], { encoding: "utf8", env: { ...process.env, DEV_SPEC_SHELL: "pwsh" } });
  const ev = lpEv();
  ok(r1.code === 0 && /ran 0/.test(r1.out) && /Task 1 done \(verified\)/.test(r1.out) && ev["1"].exitCode === 0 && ev["1"].observed === "cli" &&
    r2.code === 1 && ev["2"].exitCode === 3 && /- \[ \] 2\./.test(lpRead()) &&
    r3.status === 1 && /'Invoke-NoSuchCmdletDsd' is not recognized as a name of a cmdlet/.test(r3.stdout + r3.stderr) && /no red test/.test(r3.stdout + r3.stderr) && !ev["3"] && /- \[ \] 3\./.test(lpRead()),
    "1.21.1 languages: done --run --shell pwsh runs the _Verify:_ under PowerShell 7 — `$n = 0; … exit $n` passes (verified, observed: cli), `exit 3` is recorded as exit 3; with DEV_SPEC_SHELL=pwsh an _Expect: fail_ run of an unknown cmdlet is no red test (nothing recorded) (got " +
    JSON.stringify([r1.out.slice(0, 120), r2.out.slice(0, 120), (r3.stdout + r3.stderr).slice(0, 200)]) + ")");
} else ok(true, "1.21.1 languages: done --run --shell pwsh — skipped: pwsh is not installed here");
if (process.platform === "win32" && hasPwsh) {
  const r4 = run(["done", "pwsh", "4", "--run", "--project", lp]);
  const r5 = run(["done", "pwsh", "5", "--run", "--project", lp]);
  const r6 = run(["done", "pwsh", "6", "--run", "--project", lp]);
  const ev = lpEv();
  ok(r4.code === 0 && /Task 4 done \(verified\)/.test(r4.out) && r5.code === 1 && ev["5"].exitCode === 5 && !/--shell bash \(or set/.test(r5.out) &&
    r6.code === 1 && /uses POSIX shell syntax \(single quotes/.test(r6.out) && /--shell pwsh for a PowerShell command/.test(r6.out) && !ev["6"],
    "1.21.1 languages (Windows): under the default cmd.exe, `pwsh -NoProfile -Command \"node … ; exit $LASTEXITCODE\"` runs — exit 0 verifies, exit 5 is recorded as 5 (no cmd.exe hint); `pwsh -c '…'` is refused before anything runs, naming --shell pwsh (got " +
    JSON.stringify([r4.out.slice(0, 160), r5.out.slice(0, 160), r6.out.slice(0, 120)]) + ")");
} else ok(true, "1.21.1 languages: a pwsh -Command _Verify:_ under cmd.exe — skipped: Windows with pwsh only");
if (hasWinPs) {
  const r7 = run(["done", "pwsh", "7", "--run", "--shell", "powershell", "--project", lp]);
  ok(r7.code === 0 && /Task 7 done \(verified\)/.test(r7.out) && lpEv()["7"].exitCode === 0,
    "1.21.1 languages: done --run --shell powershell runs the _Verify:_ under Windows PowerShell 5.1 (PSEdition Desktop → exit 0) (got " + r7.out.slice(0, 160) + ")");
} else ok(true, "1.21.1 languages: done --run --shell powershell — skipped: Windows PowerShell only");

// 1.21.1 languages (review) — a POSIX shell (/bin/sh off Windows, --shell bash = Git Bash on it) expands `$LASTEXITCODE` in a
// double-quoted pwsh script BEFORE pwsh starts: `exit $LASTEXITCODE` became a bare `exit` → 0, a failing check recorded as
// passing. done --run / finish --run refuse it before anything runs (no pwsh needed); the single-quoted script runs as written.
const rp = path.join(tmp, "l121-posix-pwsh");
run(["init", "core", "--check", "unit=pwsh -NoProfile -Command \"node -e 'process.exit(3)'; exit $LASTEXITCODE\"", "--project", rp]);
run(["create", "Posix", "core", "--project", rp]);
fs.writeFileSync(path.join(rp, ".specs", "posix", "tasks.md"), [
  "- [ ] 1. double-quoted pwsh script", "  - _Verify: pwsh -NoProfile -Command \"node -e 'process.exit(3)'; exit $LASTEXITCODE\"_",
  "- [ ] 2. single-quoted pwsh script", "  - _Verify: pwsh -NoProfile -Command 'node -e \"process.exit(3)\"; exit $LASTEXITCODE'_",
  "- [ ] 3. [US1] Write T-01 and watch it fail", "  - _Verify: node t/pester-block.js_", "  - _Expect: fail_",
  "- [ ] 4. [US1] Write T-02 and watch it fail", "  - _Verify: node t/pester-throw.js_", "  - _Expect: fail_",
  "- [ ] 5. [US1] Write T-03 and watch it fail", "  - _Verify: node -e \"process.exit(1)\" && node -e \"process.exit(0)\"_", "  - _Expect: fail_", ""].join("\n"));
const rpEv = () => { try { return JSON.parse(fs.readFileSync(path.join(rp, ".specs", "posix", ".state.json"), "utf8")).evidence || {}; } catch { return {}; } };
const posixArgs = process.platform === "win32" ? ["--shell", "bash"] : [];
const rq1 = run(["done", "posix", "1", "--run", ...posixArgs, "--project", rp]);
const rqf = run(["finish", "posix", "--run", ...posixArgs, "--project", rp]);
if (/no Git Bash was found/.test(rq1.out)) ok(true, "1.21.1 languages (review): a pwsh script under a POSIX shell — skipped: no Git Bash on this Windows machine");
else {
  const rqState = JSON.parse(fs.readFileSync(path.join(rp, ".specs", "posix", ".state.json"), "utf8"));
  ok(rq1.code === 1 && /hands PowerShell a script holding \$VARIABLES outside single quotes, but a POSIX shell/.test(rq1.out) && /--shell pwsh/.test(rq1.out) && !/^\$ pwsh/m.test(rq1.out) &&
    !rpEv()["1"] && rqf.code === 1 && /the project check 'unit'/.test(rqf.out) && /a POSIX shell/.test(rqf.out) && !rqState.finishChecks,
    "1.21.1 languages (review): done --run / finish --run under a POSIX shell (" + (posixArgs.length ? "--shell bash" : "/bin/sh") + ") refuse a double-quoted pwsh script holding $LASTEXITCODE before anything runs — nothing recorded, the message names single quotes and --shell pwsh (got " +
    JSON.stringify([rq1.out.slice(0, 200), rqf.out.slice(0, 160)]) + ")");
  if (hasPwsh) {
    const rq2 = run(["done", "posix", "2", "--run", ...posixArgs, "--project", rp]);
    ok(rq2.code === 1 && rpEv()["2"] && rpEv()["2"].exitCode === 3,
      "1.21.1 languages (review): the single-quoted `pwsh -NoProfile -Command '…; exit $LASTEXITCODE'` runs under the POSIX shell as written — exit 3 recorded as 3 (got " + JSON.stringify([rq2.out.slice(0, 200), rpEv()["2"]]) + ")");
  } else ok(true, "1.21.1 languages (review): a single-quoted pwsh script under a POSIX shell — skipped: pwsh is not installed here");
}
// A Pester 5 run whose Describe-level BeforeAll failed (printed by a stand-in: the suite has no Pester) is no red test; a throw
// inside It is. Colour codes as pwsh 7 writes them.
const E_ = String.fromCharCode(27);
const pesterOut = (lines, code) => "process.stdout.write(" + JSON.stringify(lines.join("\n") + "\n") + ");\nprocess.exit(" + code + ");\n";
fs.mkdirSync(path.join(rp, "t"), { recursive: true });
fs.writeFileSync(path.join(rp, "t", "pester-block.js"), pesterOut([E_ + "[95mRunning tests." + E_ + "[0m", E_ + "[91m[-] Describe Get-Greeting failed" + E_ + "[0m",
  E_ + "[91m FileNotFoundException: The specified module 'NoSuchModuleXyz' was not loaded because no valid module file was found in any module directory.",
  "Tests completed in 753ms", "Tests Passed: 0, Failed: 1, Skipped: 0, Inconclusive: 0, NotRun: 0", "BeforeAll " + String.fromCharCode(92) + " AfterAll failed: 1", "  - Get-Greeting"], 2));
fs.writeFileSync(path.join(rp, "t", "pester-throw.js"), pesterOut([E_ + "[91m[-] Get-Greeting.T-02 greets" + E_ + "[0m" + E_ + "[90m 52ms (35ms|17ms)" + E_ + "[0m",
  E_ + "[91m RuntimeException: not implemented", "Tests Passed: 0, Failed: 1, Skipped: 0, Inconclusive: 0, NotRun: 0"], 1));
const runJ = (args) => { const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: tmp } }); let j = null; try { j = JSON.parse(r.stdout); } catch { /* not JSON */ } return { code: r.status, j }; };
const rq3 = runJ(["done", "posix", "3", "--run", "--json", "--project", rp]);
const rq4 = run(["done", "posix", "4", "--run", "--project", rp]);
const rq3j = rq3.j;
ok(rq3.code === 1 && rq3j && rq3j.couldNotRun === "output" && /Describe Get-Greeting failed|was not loaded/.test(rq3j.error) && !rpEv()["3"] &&
  rq4.code === 0 && /red run recorded for task 4/.test(rq4.out) && rpEv()["4"].exitCode === 1,
  "1.21.1 languages (review): done --run on an _Expect: fail_ task — a Pester run whose Describe BeforeAll failed ('[-] Describe … failed', 'BeforeAll \\ AfterAll failed: 1') is no red test (couldNotRun: output, nothing recorded); a throw inside It is the red proof (got " +
  JSON.stringify([rq3j && rq3j.couldNotRun, rq3j && (rq3j.error || "").slice(0, 160), rq4.out.slice(-120)]) + ")");
// Windows PowerShell 5.1 has no `&&`: its parse error is no red test (couldNotRun: pwsh) — Windows only.
if (hasWinPs) {
  const rq5 = runJ(["done", "posix", "5", "--run", "--shell", "powershell", "--json", "--project", rp]);
  const rq5j = rq5.j;
  ok(rq5.code === 1 && rq5j && rq5j.couldNotRun === "pwsh" && /PowerShell could not parse/.test(rq5j.error) && /not a valid statement separator/.test(rq5j.error) && !rpEv()["5"],
    "1.21.1 languages (review): done --run --shell powershell on an _Expect: fail_ task whose `a && b` Windows PowerShell 5.1 can't parse is no red test (couldNotRun: pwsh, nothing recorded) (got " +
    JSON.stringify([rq5.code, rq5j && rq5j.couldNotRun, rq5j && (rq5j.error || "").slice(0, 200)]) + ")");
} else ok(true, "1.21.1 languages (review): a Windows PowerShell 5.1 parse error — skipped: Windows PowerShell only");

// 1.21.1 languages (review 2) — a real red Pester run where ANOTHER block's BeforeAll failed (Pester 6's output, printed by a
// stand-in): the output showed the run, but the summary done --run stores dropped "[-] Greeter.T-01 … 121ms" and kept "[-]
// Describe Broken failed" — completeTask re-read it as "never ran" and refused the red proof. Same for a thrown message quoting
// "[-] Describe Foo failed". Both are recorded red now, the task ticked.
const rm2 = path.join(tmp, "l121-mixed-pester");
fs.mkdirSync(rm2, { recursive: true }); // 1.23 review: --project names an existing folder (only init creates one)
run(["create", "Mixed", "core", "--project", rm2]);
fs.writeFileSync(path.join(rm2, ".specs", "mixed", "tasks.md"), [
  "- [ ] 1. [US1] Write T-01 and watch it fail", "  - _Verify: node t/pester-mixed.js_", "  - _Expect: fail_",
  "- [ ] 2. [US1] Write T-05 and watch it fail", "  - _Verify: node t/pester-quoted.js_", "  - _Expect: fail_", ""].join("\n"));
fs.mkdirSync(path.join(rm2, "t"), { recursive: true });
fs.writeFileSync(path.join(rm2, "t", "pester-mixed.js"), pesterOut(["Running tests from 2 files.", E_ + "[91m[-] Describe Broken failed" + E_ + "[0m",
  E_ + "[91m FileNotFoundException: The specified module 'NoSuchModuleXyz' was not loaded because no valid module file was found in any module directory." + E_ + "[0m",
  " at <ScriptBlock>, C:/p/tests/A.Tests.ps1:2", E_ + "[91m[-] Greeter.T-01 greets by name 121ms" + E_ + "[0m", " Expected strings to be the same, but they were different.",
  " Expected length: 10", " Actual length:   5", " Strings differ at index 5.", " Expected: 'Hello, Ana'", " But was:  'Hello'", "            -----^",
  " at It 'T-01 greets by name' { 'Hello' | Should -Be 'Hello, Ana' }, C:/p/tests/B.Tests.ps1:2", "Tests completed in 967ms",
  "Tests Passed: 0, Failed: 2, Skipped: 0, Inconclusive: 0, NotRun: 0", "BeforeAll " + String.fromCharCode(92) + " AfterAll failed: 1", "  - Broken"], 3));
fs.writeFileSync(path.join(rm2, "t", "pester-quoted.js"), pesterOut(["[-] Quoter.T-05 quotes 38ms", " RuntimeException: line one", " [-] Describe Foo failed", " line three",
  " at <ScriptBlock>, C:/p/tests/Q.Tests.ps1:2", "Tests completed in 754ms", "Tests Passed: 0, Failed: 1, Skipped: 0, Inconclusive: 0, NotRun: 0"], 1));
const rmEv = () => { try { return JSON.parse(fs.readFileSync(path.join(rm2, ".specs", "mixed", ".state.json"), "utf8")).evidence || {}; } catch { return {}; } };
const rm1 = run(["done", "mixed", "1", "--run", "--project", rm2]);
const rmq = run(["done", "mixed", "2", "--run", "--project", rm2]);
const rmTasks = fs.readFileSync(path.join(rm2, ".specs", "mixed", "tasks.md"), "utf8");
ok(rm1.code === 0 && /red run recorded for task 1/.test(rm1.out) && rmEv()["1"] && rmEv()["1"].exitCode === 3 && /\[-\] Greeter\.T-01 greets by name 121ms/.test(rmEv()["1"].summary || "") &&
  rmq.code === 0 && /red run recorded for task 2/.test(rmq.out) && rmEv()["2"] && rmEv()["2"].exitCode === 1 && /- \[x\] 1\./.test(rmTasks) && /- \[x\] 2\./.test(rmTasks),
  "1.21.1 languages (review 2): done --run on _Expect: fail_ tasks — a mixed Pester run (one block's BeforeAll failed, another block's test failed on its assertion) and a test whose thrown message quotes '[-] Describe Foo failed' are recorded as the red proof (exit 3 / 1, ticked); the stored summary keeps the '[-] Greeter.T-01 … 121ms' line (got " +
  JSON.stringify([rm1.code, rm1.out.slice(-160), rmq.code, rmq.out.slice(-160), rmEv()]) + ")");

// 1.22 review (finding 1): `done --cmd <another command> --exit 0` ticks the task WITHOUT "(verified)" and says why
// (command-mismatch); `--run` (the CLI runs the _Verify:_ itself) verifies.
const cm = path.join(tmp, "122-cmd-mismatch");
fs.mkdirSync(cm, { recursive: true }); // 1.23 review: --project names an existing folder (only init creates one)
run(["create", "Proof", "core", "--project", cm]);
fs.writeFileSync(path.join(cm, ".specs", "proof", "tasks.md"), "- [ ] 1. a\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 2. b\n  - _Verify: node -e \"process.exit(0)\"_\n");
const cm1 = run(["done", "proof", "1", "--cmd", "echo hello", "--exit", "0", "--project", cm]);
const cm1j = JSON.parse(run(["done", "proof", "1", "--cmd", "echo hello", "--exit", "0", "--json", "--project", cm]).out);
const cm2 = run(["done", "proof", "2", "--run", "--project", cm]);
ok(cm1.code === 0 && /Task 1 done\. 1\/2/.test(cm1.out) && !/\(verified\)/.test(cm1.out) && /is not a run of its _Verify:_ command/.test(cm1.out) &&
  cm1j.verified === false && cm1j.unverifiedReason === "command-mismatch" && cm2.code === 0 && /Task 2 done \(verified\)/.test(cm2.out),
  "1.22 review: done --cmd \"echo hello\" --exit 0 on a task whose _Verify:_ is another command ticks it unverified (no '(verified)', the command-mismatch note; --json: unverifiedReason command-mismatch); done --run verifies (got " +
  JSON.stringify([cm1.out, cm1j.unverifiedReason, cm2.out]) + ")");

// 1.22 review 2: a run must cover EVERY _Verify:_ command of a task (one of two verified it) — `done --run` on a task with two of
// them, and on a Windows-path _Verify:_ (`node t\ok.js` under cmd.exe; `node t/ok.js` elsewhere), records a run the rule accepts:
// verified, and the recorded command proves the task on its own too (without the "cli" stamp); `--cmd` with one of the two does not.
const SR2 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
const dm = path.join(tmp, "122r2-done-run-multi");
fs.mkdirSync(dm, { recursive: true }); // 1.23 review: --project names an existing folder (only init creates one)
run(["create", "Multi", "core", "--project", dm]);
fs.mkdirSync(path.join(dm, "t"), { recursive: true });
fs.writeFileSync(path.join(dm, "t", "ok.js"), "process.exit(0)\n");
const winPath = process.platform === "win32" ? "node t" + String.fromCharCode(92) + "ok.js" : "node t/ok.js";
fs.writeFileSync(path.join(dm, ".specs", "multi", "tasks.md"), "- [ ] 1. a\n  - _Verify: node -e \"process.exit(0)\"_\n  - _Verify: node --version_\n" +
  "- [ ] 2. b\n  - _Verify: " + winPath + "_\n  - _Verify: node --version_\n- [ ] 3. c\n  - _Verify: node -e \"process.exit(0)\"_\n  - _Verify: node --version_\n");
// (run() hands back stdout and stderr together: the JSON document, then the commands it ran)
const dmJ = (n) => { const r = run(["done", "multi", n, "--run", "--json", "--project", dm]); try { return JSON.parse(r.out.slice(0, r.out.indexOf("\n}") + 2)); } catch { return { raw: r.out }; } };
const dm1 = dmJ("1"), dm2 = dmJ("2");
const dm3 = JSON.parse(run(["done", "multi", "3", "--cmd", "node --version", "--exit", "0", "--json", "--project", dm]).out);
const evDm = JSON.parse(fs.readFileSync(path.join(dm, ".specs", "multi", ".state.json"), "utf8")).evidence;
const vDm = (n) => SR2.taskBrief(dm, "multi", n).verify;
ok(dm1.ok && dm1.verified === true && dm2.ok && dm2.verified === true && evDm["1"].observed === "cli" &&
  SR2.runProvesVerify({ command: evDm["1"].command }, vDm(1)) && SR2.runProvesVerify({ command: evDm["2"].command }, vDm(2)) &&
  dm3.verified === false && dm3.unverifiedReason === "command-mismatch",
  "1.22 review 2: done --run on a task with two _Verify:_ commands and on a Windows-path _Verify:_ verifies it, and the command it records (the commands joined) proves the task on its own; done --cmd with one of the two is command-mismatch (got " +
  JSON.stringify([dm1, dm2, evDm["1"] && evDm["1"].command, evDm["2"] && evDm["2"].command, dm3.unverifiedReason]) + ")");
// 1.23 review: a task with several _Verify:_ commands, all passing, keeps one summary per command ("$ <command>" + its output) —
// the record kept the LAST command's summary alone; four noisy ones are each cut to fit the record's 2,000 characters.
fs.writeFileSync(path.join(dm, "t", "noisy.js"), "const n = process.argv[2];\nfor (let i = 0; i < 400; i++) console.log('run ' + n + ' line ' + i + ' ' + 'x'.repeat(120));\nconsole.log('# pass ' + n);\n");
fs.appendFileSync(path.join(dm, ".specs", "multi", "tasks.md"), "- [ ] 4. d\n" + [1, 2, 3, 4].map((n) => "  - _Verify: node t/noisy.js " + n + "_\n").join(""));
const dm4 = dmJ("4");
const evDm2 = JSON.parse(fs.readFileSync(path.join(dm, ".specs", "multi", ".state.json"), "utf8")).evidence;
const sm1 = String((evDm2["1"] && evDm2["1"].summary) || ""), sm4 = String((evDm2["4"] && evDm2["4"].summary) || "");
ok(/^\$ node -e "process\.exit\(0\)"$/m.test(sm1) && /^\$ node --version\r?\nv\d+\.\d+\.\d+/m.test(sm1) &&
  dm4.ok && dm4.verified === true && sm4.length <= 2000 && [1, 2, 3, 4].every((n) => sm4.includes("$ node t/noisy.js " + n) && sm4.includes("# pass " + n)),
  "1.23 review: done --run with several _Verify:_ commands records one summary per command (its command line + its output, the count line kept), within 2,000 characters (got " +
  JSON.stringify([sm1, sm4.length, sm4.split("\n").filter((l) => /^\$ |# pass/.test(l))]) + ")");

// 1.24 r6 D4 / D5 / D8: done --run refuses a PASS that ran no test (node --test on a file with no test: "tests 0" — couldNotRun
// no-tests), and, on an _Expect: fail_ task, a test file that doesn't parse (node's SyntaxError, TAP or spec reporter) or a runner
// that isn't there (python -m's "No module named") — nothing recorded; a real run of a real test still verifies.
{
  const vp = path.join(tmp, "r6-done-run-vacuous");
  fs.mkdirSync(path.join(vp, "tests"), { recursive: true });
  run(["create", "Vac", "core", "--project", vp]);
  fs.writeFileSync(path.join(vp, "tests", "syn.test.js"), "const t = require('node:test');\nt.test('T-01', () => { let x = ; });\n");
  fs.writeFileSync(path.join(vp, "tests", "real.test.js"), "const t = require('node:test');\nt.test('T-02', () => {});\n");
  // (task 1: a runner's own zero-count summary — node --test prints "# tests 0" when its glob matches no file; Node 18 / 20 have no
  // globs, so the line is printed directly)
  fs.writeFileSync(path.join(vp, ".specs", "vac", "tasks.md"), "- [ ] 1. Empty suite\n  - _Verify: node -e \"console.log('# tests 0'); console.log('# pass 0')\"_\n" +
    "- [ ] 2. Write the failing test T-01\n  - _Verify: node --test tests/syn.test.js_\n  - _Expect: fail_\n" +
    "- [ ] 3. Write the failing test T-03\n  - _Verify: node -e \"console.error('/usr/bin/python3: No module named pytest'); process.exit(1)\"_\n  - _Expect: fail_\n" +
    "- [ ] 4. Real test\n  - _Verify: node --test tests/real.test.js_\n");
  const vj = (n) => { const r = run(["done", "vac", n, "--run", "--json", "--project", vp]); try { return Object.assign(JSON.parse(r.out.slice(0, r.out.indexOf("\n}") + 2)), { code: r.code }); } catch { return { raw: r.out, code: r.code }; } };
  const v1 = vj("1"), v2 = vj("2"), v3 = vj("3"), v4 = vj("4");
  const stFile = path.join(vp, ".specs", "vac", ".state.json");
  const st = fs.existsSync(stFile) ? JSON.parse(fs.readFileSync(stFile, "utf8")) : {};
  const ev = st.evidence || {};
  const tasksNow = fs.readFileSync(path.join(vp, ".specs", "vac", "tasks.md"), "utf8");
  ok(v1.code === 1 && v1.couldNotRun === "no-tests" && /tests 0/.test(v1.error) && v2.code === 1 && v2.couldNotRun === "output" && /SyntaxError/.test(v2.error) &&
    v3.code === 1 && v3.couldNotRun === "output" && /No module named pytest/.test(v3.error) && v4.code === 0 && v4.verified === true &&
    !ev["1"] && !ev["2"] && !ev["3"] && /- \[ \] 1\.[\s\S]*- \[ \] 2\.[\s\S]*- \[ \] 3\.[\s\S]*- \[x\] 4\./.test(tasksNow),
    "1.24 r6 D4 / D5 / D8: done --run refuses a pass that ran no test (no-tests), a red run of a test file that doesn't parse and of a runner that isn't there (output) — nothing recorded, tasks open; a real test verifies (got " +
    JSON.stringify([v1, v2.couldNotRun, (v2.error || v2.raw || "").slice(0, 120), v3.couldNotRun, v4.verified, Object.keys(ev)]) + ")");
}
};
