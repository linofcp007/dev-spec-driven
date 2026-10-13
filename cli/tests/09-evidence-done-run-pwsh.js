"use strict";
// `done --run` / `finish --run` under PowerShell (pwsh, Windows PowerShell 5.1), a pwsh script under a POSIX shell, Pester runs (stand-ins) as red proofs.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

// 1.30 (review 8, ds-maint 2): split from 09-evidence-done-run.js by topic — the one file ran 37 `done --run` processes in a row
// (the CLI suite's critical path, ~55 s).
exports.run = ({ ok, run, runIn, tmp, CLI }) => {
// 1.21.1 languages: PowerShell as the run shell — --shell pwsh / powershell and DEV_SPEC_SHELL=pwsh run the _Verify:_ as
// `<shell> -NoProfile -NonInteractive -Command <cmd>` (the exit code propagates, `$` is PowerShell's); under the default cmd.exe
// a `pwsh -NoProfile -Command "…; exit $LASTEXITCODE"` _Verify:_ runs (1.21.0 refused it as POSIX syntax) while a single-quoted
// `pwsh -c '…'` is still refused, naming --shell pwsh. Skipped where pwsh / powershell isn't installed (the Linux containers).
const hasShell = (sh) => { try { return spawnSync(sh, ["-NoProfile", "-NonInteractive", "-Command", "exit 0"], { encoding: "utf8", windowsHide: true, timeout: 60000 }).status === 0; } catch { return false; } };
const hasPwsh = hasShell("pwsh"), hasWinPs = process.platform === "win32" && hasShell("powershell");
const lp = path.join(tmp, "l121-pwsh-run");
fs.mkdirSync(lp, { recursive: true }); // 1.23 review: --project names an existing folder (only init creates one)
runIn(["create", "Pwsh", "core", "--project", lp]);
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
runIn(["init", "core", "--check", "unit=pwsh -NoProfile -Command \"node -e 'process.exit(3)'; exit $LASTEXITCODE\"", "--project", rp]);
runIn(["create", "Posix", "core", "--project", rp]);
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
runIn(["create", "Mixed", "core", "--project", rm2]);
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
};
