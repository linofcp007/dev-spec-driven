# Verification before completion (evidence before claims)

No task is "done", no test "passes", no bug "fixed" until a command proved it **in this session, on the
final code**, and you read its output. Adapted from the `verification-before-completion` skill of
[obra/superpowers](https://github.com/obra/superpowers) (MIT).

## The gate

```
BEFORE claiming any status:
1. IDENTIFY  which command proves the claim   (the task's _Verify:_ marker; the full suite; the load test)
2. RUN       it fresh and complete            (not "it passed earlier", not a subset)
3. READ      the full output and the exit code; count failures and warnings
4. DECIDE    does the output confirm the claim?  no → report the real status with the output
5. ONLY THEN make the claim — with the evidence
```

## When you can't run the command yourself

No shell in this session (claude.ai, a restricted harness, a sandbox that refuses it), no runtime, no database?
Then **you have no evidence, so you make no claim** — and a tick is a claim:

- **Don't tick the task** — not bare, not with a summary-only note ("the user says it works", "not run — no
  shell"), and never with an exit code nobody saw. The engine would accept a note on a runnable `_Verify:_` and
  leave the task *unverified*; that is still a claim without evidence.
- **Name the command and ask for its result:** "Task 2's proof is `node --test test/cli.test.js` — run it and paste
  the output (or run `node "<clone>/cli/dev-spec.js" done csv-export 2 --run`, which runs it and records the
  evidence)." Hand over the CLI line exactly as the tool's note prints it — the clone's path resolved; a plugin
  install puts no `dev-spec` on PATH, so a bare `dev-spec done …` doesn't run for the user.
- **Ask — don't go looking for a shell.** No Bash / PowerShell tool in this session means stop and ask the user:
  never dispatch a subagent or search the tool list for one (the 1.19 eval traces: 4 of 14 shell-less runs did,
  and it cost 2–4 extra calls each to learn nothing new).
- **The user ran it and reported the result** ("ran `npm test`: 14 pass, exit 0") → record exactly that:
  `spec_complete_task {…, evidence: {command, exitCode, summary}}`. A reported failure is recorded the same way (it
  refuses the tick).
- **Tick it unverified only when the user explicitly asks for exactly that** ("tick it without evidence") — then say
  that it stays unverified: doctor, `ROADMAP.md`, `/spec-finish` and the execution sign-off keep listing it until a
  passing run is recorded.

The same holds for the failing run of an `_Expect: fail_` task (a regression test before its fix): without a shell,
ask the user to run the test and paste the red output — don't write the fix on an unseen red.

## How the engine enforces it

- **`_Verify: <command>_`** on a task (English-stable marker, like `_Requirements:_`) names the command that
  proves it. The scaffold seeds one; give every task that changes behaviour a real one
  (`npm test -- keys.test.js`, `pytest tests/test_keys.py`, `k6 run load.js`,
  `pwsh -NoProfile -Command "Invoke-Pester -Path tests -CI"` — see PowerShell below).
- **`spec_complete_task {…, evidence: {command, exitCode, summary}}`** records the result in
  `.state.json → evidence[<n>]` — the latest run `{command, exitCode, summary, at}` plus a short `history` of
  runs (for the pass rate), stamped with the task's text and its `_Verify:_` command. A non-zero `exitCode`
  **refuses the tick**, and the failed run is **recorded** anyway. `spec_doctor` (check `verification`),
  `ROADMAP.md` ("needs attention") and `spec_finish` (a blocker) keep surfacing every unverified ticked task.
- **Tick only through the engine.** `spec_complete_task` (CLI `dev-spec done`) is the only way a task
  gets ticked — never edit the `- [ ]` checkbox by hand; the evidence lives next to the tick.
- **What counts as verified:**
  - a task whose `_Verify:_` names a **runnable command** is verified only by `{command, exitCode: 0}` — a text
    note alone ticks it but leaves it **unverified**;
  - a summary-only manual attestation ("checked the login page by hand") verifies only a task with **no runnable
    command** (no `_Verify:_`, or a `[bracketed]` manual check);
  - a command without its exit code, a non-integer exit code, or a bare `{exitCode: 0}` with nothing else is
    **rejected**; "exit 0" without a command is a note, never a run (a bare `{exitCode: 0}` recorded by v1.12
    still verifies a task with no runnable command — legacy evidence never leaves a task worse off than none);
  - a note given after a run is attached to it (`note`) — it never overwrites or clears the run's result;
  - only the task's own lines count: a `_Verify:_` inside a fenced code example under a task is documentation,
    never run by `done --run`.
- **Failed runs.** The latest failed run makes the task unverified — even an already-ticked one (a failed
  re-check is recorded and the task stays ticked but unverified). Only a later **passing** run clears it; a note
  can't paper over it.
- **Stale evidence.** `spec_impact --reopen` (the spec the run proved changed) marks a task's evidence stale, and a
  run recorded for an earlier `_Verify:_` command no longer proves the task: run the check again.
- **Undoing a tick.** A task ticked by mistake (or whose work turned out incomplete) is unticked with
  `spec_complete_task {name, number, undo: true, reason}` (CLI `dev-spec undone <feature> <n> --reason "…"`) — never by
  editing the checkbox. Its evidence record is marked stale (`staleBy: "undo"`): ticking it again needs a NEW run
  (`stale-evidence`, labelled "unticked since this evidence was recorded"); `ticks[n]` is dropped and `.state.json →
  unticks` records `{n, at, reason}`. A finished or signed-off feature must then be finished and signed off again.
  An `_Expect: fail_` task keeps its red run through the undo (`redKept: true` — the fix may already be in, so the red
  run can't be made again): its re-tick's passing run counts as the fix going green — unless its `_Verify:_` was edited
  meanwhile. When several ticked tasks share the number, undo refuses (`duplicateTicked`, naming them): renumber first
  (doctor warns `duplicate-tasks`). `undone` takes no evidence (`--evidence` / `--exit` / `--cmd` / `--run` are refused).
- **CLI:** `dev-spec done <feature> <n> --run` runs the task's `_Verify:_` command(s) from the project root
  and records the evidence; any failure leaves the task open, is recorded, and exits 1 (except on an `_Expect: fail_`
  task, where the failing run is the proof and a passing one is refused). `--shell bash` (or
  `DEV_SPEC_SHELL`) picks the shell; `--shell pwsh` (PowerShell 7) or `--shell powershell` (Windows PowerShell 5.1) runs the
  command as PowerShell (`-NoProfile -NonInteractive -Command`, below). On Windows `bash` means **Git Bash** (found through `git --exec-path`,
  `%ProgramFiles%\Git` or a non-WSL `bash.exe` on PATH); a bare `bash` never resolves to WSL's launcher (the `bash.exe` in System32 or
  WindowsApps, which runs the command inside a Linux distribution): name that one by its full path to run inside WSL on
  purpose (a run WSL can't start records nothing); `wsl.exe` is no shell and is refused, and so is `--shell bash` with no
  Git Bash installed (pass the full path of a `bash.exe` instead). On Windows the default shell is cmd.exe,
  which has no single quotes and never
  expands `$VAR` — `node -e 'process.exit(1)'` exits 0 there — so a `_Verify:_` in POSIX syntax is refused before
  anything runs: re-run with `--shell bash` (Git Bash), `--shell pwsh` for a PowerShell command, or `--shell cmd` to run it
  under cmd.exe anyway. A script handed to `pwsh` / `powershell` in double quotes is PowerShell, not POSIX: `pwsh -NoProfile
  -Command "Invoke-Pester -Path tests -CI; exit $LASTEXITCODE"` runs under cmd.exe as written (cmd.exe passes it on
  intact); `pwsh -c '…'` is refused (cmd.exe splits the single-quoted script and PowerShell would evaluate a string —
  exit 0). The mirror holds under a POSIX shell (`/bin/sh`, `--shell bash`): it expands `$…` and backticks outside single
  quotes before PowerShell starts — `exit $LASTEXITCODE` would become a bare `exit` (exit 0) — so a pwsh script holding them
  outside single quotes is refused there, and `pwsh -NoProfile -Command '…; exit $LASTEXITCODE'` is the POSIX form
  (PowerShell below). A failed run
  suggests `--shell bash` only when cmd.exe itself could not run the line (an unknown command, its syntax error); a
  check that ran and failed means fixing the code. **A run that could not happen records nothing:** the shell could not
  be started, the command was killed by a signal, its output passed 64 MB, `--timeout <seconds>` expired, or WSL's relay
  answered — the task stays open with a `couldNotRun` code (`shell-not-started` · `run-error` · `signal` ·
  `output-too-large` · `timeout` · `wsl`), never a failed run on record. Or report it by hand:
  `--evidence "14/14 passing" --exit 0 --cmd "npm test"`.
- **Briefs** (`spec_task_brief`) carry the `_Verify:_` command (and whether its run must fail) and require the
  implementer to paste the command, exit code and output tail in the report; the reviewer checks it is there.

## Red → green: `_Expect: fail_`

A task whose job is a test that must FAIL first — a bugfix's regression test before the fix, a red phase that writes
tests before their code — carries **`_Expect: fail_`** (English-stable, like `_Verify:_`) next to the `_Verify:_`
command that runs that test:

```markdown
- [ ] 3. [US1] Write regression test T-01 and watch it fail for the right reason
  - _Requirements: US-1.AC-1_
  - _Verify: node --test test/discount.test.js_
  - _Expect: fail_
```

The red task names the T-IDs it writes in its text; `_Makes green: T-01_` belongs to the task that turns the test
green (the fix), not to this one.

- Its proof is a **failing run** `{command, exitCode ≠ 0}`: recorded with `expected: "fail"`, it ticks and verifies the
  task (`redRecorded: true`).
- A **passing run is refused** and recorded (`unexpectedPass: true`): the test doesn't fail yet, so it tests nothing.
  Make it fail for the right reason (an assertion, "not implemented" — not a typo or a missing import). On an already
  ticked task a pass makes it unverified (reason `unexpected-pass`).
- Once the red run is on record, a later passing run of the same `_Verify:_` (the fix made the test green) is fine:
  the red run stays the proof.
- Exit **126 / 127 / 9009** means the command could not run at all (not executable / not found) — no red test; it is
  refused like a failed run (`couldNotRun: "exit-code"`). So is a failing run whose output shows the test never ran — a
  missing test file, module or script, nothing collected (node "Could not find", "Cannot find module", python "can't open
  file", pytest "no tests ran", jest "No tests found", npm "Missing script", PowerShell "… is not recognized as a name of a
  cmdlet" / "The specified module … was not loaded" / "running scripts is disabled on this system", Pester "No test files
  were found"…) — while a test that ran and failed stays red even when its message quotes one of those (Pester's
  `[-] <test> 12ms`, "Expected …, but got …"): `spec_complete_task` refuses a run whose
  `summary` shows it (`couldNotRun: "output"`), `dev-spec done --run` refuses it with nothing recorded, and an older
  record of that kind is no red proof. A Pester block that failed before its tests ("[-] Describe … failed", "BeforeAll \
  AfterAll failed: 1") is could-not-run only when no test ran: in a mixed run (another block's test failed on its
  assertion) keep that test's `[-] <test> 12ms` line in the `summary` you record — `done --run` keeps it. Whenever cmd.exe is the shell (the Windows default, or `--shell cmd`), a line
  cmd.exe itself could not run is refused by `done --run` with nothing recorded — and whenever PowerShell runs the line
  (`--shell pwsh` / `powershell`, or a `pwsh` program in it), so is PowerShell's own parse error (`couldNotRun: "pwsh"`:
  Windows PowerShell 5.1 has no `&&`).
- A red-phase task that carries a must-pass `_Verify:_` and no `_Expect: fail_` gets `redPhaseVerify: true` and a note
  saying to mark it `_Expect: fail_` (or move the command to the task that makes it green).
- `spec_doctor` warns **`red-green`** (+tdd): T-IDs that done tasks make green (`_Makes green:_`) with no recorded red
  run of an `_Expect: fail_` task citing them — a test that never failed proves nothing. A guard test that passes
  before the change by design (a bugfix's T-02, "the neighbouring behaviour still works") belongs in no
  `_Makes green:_`, so the check never asks for its red run. A bugfix scaffolded before 1.14 still lists T-02 in task
  4's `_Makes green:_` and gets the warning for it: remove T-02 from there — never make the test fail artificially.
- `/next-action`'s verify step explains the red proof: record the red run while the test still fails (before the fix,
  or with the fix stashed), or drop `_Expect: fail_` if the task is no red test.

## `_Verify:_` commands that pipe

`npm test | tee test.log` or `pytest | grep passed` exit with the **last** command's code: a failing test run records
exit 0 and would read as verified. The engine flags an unquoted single `|` (also `|&`, inside a subshell or a
`bash -c` / `sh -c` / `pwsh -Command` / `cmd /c` script) — never `||`, a quoted `'|'`, `\|` / `^|`, `>|`, or a command
that sets `pipefail` before the pipe:

- `spec_task_brief` lists them in `verifyPipes` and says so in the brief's Verification section;
- `dev-spec done --run` prints one hint line before running (it still runs);
- `spec_complete_task` records and ticks a passing run as given, with `pipeMasked: true` and a note;
- `spec_doctor` warns **`verify-pipes`** naming the tasks and commands.

Drop the pipe (`npm test`, and read the output), or put `set -o pipefail;` first under bash (`--shell bash`; cmd.exe has
no pipefail).

## PowerShell `_Verify:_` commands (Pester)

```markdown
- [ ] 2. [US1] Greet by name
  - _Requirements: US-1.AC-1_
  - _Verify: pwsh -NoProfile -Command "Invoke-Pester -Path tests -CI"_
```

- **Make a failure exit non-zero.** Pester 5+ `-CI` exits non-zero when a test fails (it also writes testResults.xml);
  on Windows PowerShell 5.1 with Pester 3 / 4 use `-EnableExit`. Without either, `Invoke-Pester` returns normally and the run
  exits 0 whatever failed. A script's `exit N` is the run's exit code; a last command that failed makes it 1 — add
  `; exit $LASTEXITCODE` to pass a native tool's own code on.
- **Running it with `done --run` / `finish --run` — pick the form for the shell that runs it:**
  - **Portable (any OS):** `--shell pwsh` (or `DEV_SPEC_SHELL=pwsh`; `--shell powershell` for Windows PowerShell 5.1, or a path
    to either) with the bare script — `_Verify: Invoke-Pester -Path tests -CI_`,
    `_Verify: npm test; exit $LASTEXITCODE_`. The CLI runs `<shell> -NoProfile -NonInteractive -Command <cmd>`: no profile,
    no prompt.
  - **cmd.exe (the Windows default):** double quotes — the example above, or
    `pwsh -NoProfile -Command "npm test; exit $LASTEXITCODE"` (cmd.exe passes `$` on; single quotes are refused there).
  - **A POSIX shell (`/bin/sh` elsewhere, `--shell bash`):** single quotes when the script holds `$` —
    `pwsh -NoProfile -Command 'npm test; exit $LASTEXITCODE'`. The shell would expand `$LASTEXITCODE` inside double quotes
    to nothing (a bare `exit` → 0: a failing check recorded as passing), so a double-quoted pwsh script holding `$` or a
    backtick is refused there before anything runs — behind `sudo`, `timeout 60`, `nice -n 10` … too, and inside a
    `bash -c "…"` script. What is the shell's own is fine: a redirection (`> "$OUT"`, `2>&1`) and a `# comment`.
  - A script with no `$` or backtick (`pwsh -NoProfile -Command "Invoke-Pester -Path tests -CI"`) runs the same under all
    three.
- **Test names:** Pester runs `*.Tests.ps1` files — tests/, or beside the code (`src/Greeter/Greeter.Tests.ps1`) — and
  `trace_check {code: true}` reads them: put the T-ID in the `It` name (`It 'T-01 greets by name' { … }`).
- **Red first (`_Expect: fail_`).** A red run is a test that ran and failed (`[-] Get-Greeting.T-01 … 12ms`, "Expected
  'Hello, Ana', but got 'Hello'.", a `throw` inside `It`, or the function under test not written yet). No red test — the
  run is refused: `Invoke-Pester` unknown (Pester not installed); a block or file that failed before its tests — a
  `BeforeAll` importing a module that isn't there ("[-] Describe … failed" / "BeforeAll \ AfterAll failed" / "Container
  failed"), a test file that doesn't parse ("[-] Discovery in … failed", Pester 3's "Error occurred in test script"); a
  script the execution policy blocks; "No test files were found"; PowerShell's own parse error of the `_Verify:_` line.

## Project checks and suite evidence

Task runs prove tasks; a feature is done when the **whole project's checks** pass on the final code. Name them once:

- `spec_init {checks: {"test": "npm test", "lint": "npm run lint", "typecheck": "npx tsc --noEmit"}}` (CLI
  `dev-spec init --check test="npm test" --check lint="npm run lint"`; `name=` with no command removes one) — stored in
  `roadmap.json → meta.checks`; the other checks are kept.
- Every task brief lists them in its definition of done (`projectChecks`).
- Once they are set, **`spec_finish` needs a passing recorded run of each since the feature's last task activity**
  (the last tick or task run), on the code as it is now — blocker **`suite-evidence`**, with `suiteChecks`
  [{name, command, status}] where status is `pass` · `no-run` · `failed` · `changed` (the configured command changed
  since the run, or the run was of another command — `echo ok` recorded as check `test`) · `before-last-tick` · `code-changed` (the feature's implementing files — its tasks' `_Implements:_` —
  changed since the run; each recorded run is stamped with a hash of them) · `unobserved` (only with
  `meta.evidence: "observed"` — a passing run the harness never saw, see below). Doctor warns `suite-evidence` once every
  task is done; the execution sign-off refuses it too, and `/next-action`'s finish step says how to run and record them.
- Record them: `spec_finish {name, evidence: [{name, command, exitCode, summary}]}` (each `name` a `meta.checks` name,
  run from the project root — recorded in `.state.json → finishChecks` before the readiness is computed, so one call
  can make the feature ready; a failed run is recorded and stays a blocker), or let the CLI run them:
  `dev-spec finish <feature> --run [--shell bash] [--timeout <seconds>]` — a check that could not run (no shell, a
  signal, the timeout) records nothing.

Without `meta.checks` nothing changes: `/spec-finish` lists "run the full suite" among the fresh checks to confirm.

## Evidence the harness observed (Claude Code)

A reported run is what the agent SAYS it ran. In Claude Code the plugin's `hooks/observe-hook.js` (PostToolUse and
PostToolUseFailure on the **Bash** tool, and on the PowerShell tool when its response carries an explicit exit code) logs
every such run of a task's runnable
`_Verify:_` command (or the `&&` join of a task's commands) or of a project check, with its exit code, to a
git-ignored, size-bounded log (`.specs/<feature>/.execution/observed.jsonl`, `.specs/.execution/observed.jsonl` for
project checks). Interrupted and backgrounded runs are not logged.

- **Every recorded run is stamped** `observed: true | false` — true when the latest logged run of the task's `_Verify:_`
  (read as the evidence gate reads it — `tests\x.test.js`, a `CI=1` prefix, the commands joined in any order — see
  "Which run proves it") in the last 24 hours exited with the same code (a reported exit 0 after an observed exit 1 is not
  observed). `dev-spec
  done --run` / `finish --run` stamp `"cli"` (the CLI ran it itself). The MCP tools never take the stamp from the caller.
  `spec_complete_task` returns it, and so do the finish's `suiteChecks` items and the traceability matrix's task
  evidence (`trace_check {matrix}`).
- **By default the stamp is information** (`roadmap.json → meta.evidence: "reported"`): the verdict is the one above.
- **Opt in to make it the rule:** `spec_init {evidence: "observed"}` (CLI `dev-spec init --evidence observed`; back with
  `--evidence reported`). Then a task whose `_Verify:_` is runnable is verified only when the run that proves it — the
  latest passing run, or an `_Expect: fail_` task's red run — is observed (`true`) or made by the CLI (`"cli"`);
  otherwise reason **`unobserved`**. A project check's passing run counts only when observed too (suiteChecks status
  `unobserved`). Every surface of the verdict follows (complete_task, status, doctor, finish, the roadmap, the Stop
  gate, the matrix). A task without a runnable `_Verify:_` is unaffected.
- **What to do:** run the `_Verify:_` command yourself with the Bash tool, then record exactly that command and its exit
  code — or let the CLI run it (`dev-spec done <feature> <n> --run`). An MCP-only client has no hook: every run it
  reports reads unobserved, so in that setup record runs with `done --run` (the note says so when no run was ever
  observed in the project).
- **Not a security boundary:** an agent with a shell could write the log itself. It raises the bar on a paraphrased or
  invented report — the run has to have happened.

## Evidence linked to git

`dev-spec done --run` and `finish --run` also record the git commit the run was made on and whether the tree was dirty
(outside `.specs/`) when git is available — context, not proof; the merge summary tags runs `@sha` (`-dirty`).
`dev-spec log <feature>` reads `git log` (read-only, local) and lists per task the commits that cite it — "task #N" with
the feature name, as `/spec-commit` writes `Part of .specs/<feature>/ task #N.`, or its T- / AC IDs ("Makes T-01
green") — and, on +tdd, a **red-first check**: an implementation committed before its test. Commit with the
`/spec-commit` conventions and that history reads itself. An MCP-only client uses `spec_log {name, gitLog}`: it passes
the text of `git log --name-only --relative` it ran itself — the MCP server never runs git (or any command).

## The end-of-turn evidence gate (Claude Code)

The plugin's **Stop** hook reads your closing message. When it **claims** the work is done or verified (EN/PT/ES:
"all done", "task 3 is complete", "tests pass", "verified"…) while a feature active in the last few hours has ticked
tasks without verification evidence — or, every task done, project checks without a passing run — it sends the turn
back with the reason: which feature, which tasks and why (`#3 (latest run failed)`), and what to do. It never fires on
a question, a negated or conditional claim ("not verified yet", "once the tests pass"), quoted or code text, or an
honest admission ("task 3 is not verified", "2 failing") — the right answer is to read the task's `_Verify:_` in
tasks.md, run it if it is safe to run, record the evidence, or **say plainly what is not verified**; never reword a
claim to slip past it. "Active" means activity the engine recorded (ticks, evidence, and a save of tasks.md / change.md
through the Write / Edit tool — `lastEditAt`, stamped by the plugin's PostToolUse hook) — never a file date, so a fresh
clone of someone else's repo doesn't trip it — and the reason never hands you a `--run` command to execute blindly.

- **SubagentStop** (the `spec-implementer` and `spec-simplifier` agents only): an implementer's DONE is checked against
  its report — the report file `.specs/<feature>/.execution/task-N-report.md` (named in the reply) must carry each
  runnable `_Verify:_` command of the task and the exit code it needs — `exit 0` for a must-pass `_Verify:_`, a non-zero
  exit for an `_Expect: fail_` task. BLOCKED / NEEDS_CONTEXT, or a task without a runnable `_Verify:_`, pass
  (`references/subagent-execution.md`). A simplifier's DONE needs its `.specs/<feature>/.execution/simplify-report.md`
  to end with a `## Final runs` section where every run shows an exit 0 and, with project checks set, each check's
  command is one of them. NO_CHANGES / BLOCKED / NEEDS_CONTEXT pass (`references/subagent-execution.md` → The
  simplification pass).
- It never sends the same stop back twice in a row, stays silent in a project without a dev-spec `.specs/`, and never
  blocks on its own error.
- **Opt out** per project: `spec_init {stopCheck: false}` (CLI `dev-spec init --stop-check off`; `roadmap.json →
  meta.stopCheck`). **Try it:** `dev-spec stop-check --message "All tasks done."` prints the reason it would send the
  turn back (exit 1) or why it lets the turn end; `--agent spec-implementer` checks an implementer's report.

### Why a task is unverified — stable reason codes

`spec_complete_task` returns `verified`. Whenever it is false, `unverifiedReason` (plus a localized `note`) is
present — branch on the code, never on the `note`. `verified` is the same verdict on every surface: `spec_complete_task`,
`spec_status` (each task), `spec_impact` (each task's `evidence`), doctor, `spec_finish`, the roadmap and the Stop gate.
A task with no runnable `_Verify:_` and nothing recorded for it is outside the run gate: it comes back `verified: true`
with `nothingToVerify: true` (and no reason code) — nothing was run or attested, so `dev-spec done` prints no
"(verified)" and `spec_impact` shows "nothing to verify". Give it a note (`{summary}`) to record how it was checked.

| Code | Meaning | What to do |
|---|---|---|
| `no-evidence` | Nothing recorded for this task | Run its `_Verify:_` and record the run |
| `failed-run` | The latest recorded run exited non-zero (or, on an `_Expect: fail_` task, could not run) | Fix, re-run, record the passing run |
| `manual-note-on-runnable-verify` | Only a note was given, but `_Verify:_` holds a command | Run the command; record `{command, exitCode}` |
| `stale-evidence` | The record no longer proves this task: `spec_impact --reopen` marked it stale (the spec it proved changed), the task was unticked after it (`spec_complete_task {undo}`), or it was recorded for an earlier `_Verify:_` command / another task that held the number | Run the check again on the current code |
| `duplicate-number` | Another task shares this number and the record isn't this task's | Renumber the tasks (doctor warns `duplicate-tasks`) |
| `unexpected-pass` | The task is marked `_Expect: fail_`, but its latest run passed with no red run before it | Make the test fail for the right reason and record that run (or drop the marker) |
| `unobserved` | Only with `meta.evidence: "observed"`: the run that proves it was reported, but the harness never saw it (nor did the CLI make it) | Run the command with the Bash tool in Claude Code and record it again, or `dev-spec done <feature> <n> --run` |
| `command-mismatch` | The run recorded is not a run of the task's `_Verify:_` command (`echo ok` for `npm test`, `npm test -- --grep x`, one of its two `_Verify:_` commands alone) — on an `_Expect: fail_` task, its red run | Run the `_Verify:_` command as written — all of them, joined with ` && `, when there are several — and record that run (`dev-spec done <feature> <n> --run`); an `_Expect: fail_` task: before the fix lands — a red run of another command never counts (the fix already in: set it aside with `git stash` for the red run, then restore it) |

**Which run proves it.** The recorded `command` is compared with the task's `_Verify:_`: whitespace, backticks, quotes
around the whole command or around a plain argument (`"tests/x.test.js"`), single for double quotes when the quoted text
holds none of `$` `` ` `` `\` `!` or a quote (`node -e 'process.exit(0)'`), the spacing around `&&` / `||` / `;` / `|`, a
leading `./` on a path (`./tests/x.test.js` — never on `./gradlew` or Go's `./...`), npm's own aliases of `npm test` (`npm
run test`, `npm t`), `\` for `/` (`tests\x.test.js`) and a
trailing `2>&1` don't matter, nor does a leading `cd <project root> &&` (absolute, relative or `./`, any drive-letter case on
Windows; cmd.exe's `cd /d` / `chdir` / `pushd`, PowerShell's `Set-Location` / `sl` / `Push-Location` move the same way),
`set -o pipefail;` or `VAR=value` of the run's own — a `cd` that ends anywhere else (`cd ../other-project`, `cd ..
&& cd packages/web`) runs the command there: another run; `cd #` (a comment in bash) and a `cd` inside `` `…` `` / `$(…)` prove
nothing — but
a prefix the `_Verify:_` itself holds must be there: `cd packages/web && npm test` is no run of `cd packages/api && npm
test`, `npm test` none of `NODE_ENV=production npm test`. A task with several `_Verify:_` commands needs ONE run of
every one of them, joined with ` && ` in any order (that is how `done --run` reports them; a `_Verify:_` that itself
holds ` && ` stays whole) — a run of one of them alone proves nothing. The CLI's own `done --run` always counts. Any other
command ticks the task but leaves it unverified (`command-mismatch`). On an `_Expect: fail_` task, record the red run of
the `_Verify:_` BEFORE the fix lands; a red run recorded as another command (another test file, `false`) never counts —
with the fix already in, set it aside (`git stash push -- <the fix's files>` — a bare `git stash` would stash tasks.md and
`.state.json` too), record the failing run, then restore it. (Only a red run recorded
by a dev-spec older than this rule still counts once a passing run of the `_Verify:_` itself follows it.) A project check's run
(`spec_finish {evidence}`) is compared with its `meta.checks` command the same way — another command reads `changed`.
Runs recorded by a dev-spec older than 1.22 (before this rule) keep the verdict they had: a plugin update never turns a task
it verified — or a project check's run — unverified; every new run is held to the rule.

**Duplicate numbers.** `spec_complete_task`, `spec_task_brief` and `done --run` resolve a duplicated number to
its first **open** task, and evidence is stamped per task, so one "3." never borrows the other's passing run.
Humans still read them as one task — renumber when doctor warns. `01` is task 1.

**Bugfix gate.** In a bugfix, the fix — every task after task 1, the red regression test (after the root-cause task,
in a tasks.md that has one) — is refused (nothing recorded, nothing ticked) until `bug.md → Root Cause` is filled
(`references/bugfix.md`).

## Claims and what proves them

| Claim | Requires | Not sufficient |
|---|---|---|
| Tests pass | test command output: 0 failures | "should pass", a previous run, a partial run |
| Build succeeds | build command: exit 0 | the linter passing |
| Bug fixed | the regression test (T-01) passes AND the reproduction steps no longer reproduce | "code changed, assumed fixed" |
| Regression test works | red → green cycle observed (a recorded `_Expect: fail_` red run, then green with the fix) | passing once |
| Requirements met | each AC checked against the code/tests (by ID) | "tests pass" |
| A subagent finished | the diff reviewed + its evidence present in the report | the subagent saying "DONE" |
| The user says it works | their pasted output of the `_Verify:_` command (command + exit code) | "it works" with no run |

## Red flags — stop and run the command

"should", "probably", "seems to", "looks correct" · satisfaction before running anything ("Done!",
"Perfect!") · about to commit / merge / push without a fresh run · trusting a report you didn't check ·
"no shell, so a note will do" · a pipe in the `_Verify:_` · "just this once" · being tired and wanting it over.
