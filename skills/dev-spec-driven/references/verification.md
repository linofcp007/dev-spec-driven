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
  never dispatch a subagent or search the tool list for one (it costs extra calls and learns nothing new).
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
- **Renumbered tasks.** Evidence is kept by task number. After a renumbering (a task inserted at the top), a task never
  reads a run recorded for ANOTHER task of the same `tasks.md` that now has another number — it reads `stale-evidence` —
  and `spec_doctor` warns **`evidence-moved`** (`#1 → #2 «Write the parser»`): record the moved task's own run. A plain
  title edit keeps its record.
- **A pass that tested nothing.** A run that exits 0 while its output shows no test ran — node `--test` "tests 0" (a
  glob that matches no file), go "[no tests to run]" / "[no test files]", cargo "running 0 tests", mocha "0 passing",
  jest "No tests found", pytest "no tests ran" / "collected 0 items", vitest "No test files found", unittest "Ran 0
  tests", Pester "Tests Passed: 0, Failed: 0", RSpec "0 examples", PHPUnit "No tests executed!", dotnet "No test is
  available", Maven "Tests run: 0" — proves nothing: `dev-spec done --run` refuses it with nothing recorded, and so does
  `spec_complete_task` when the `summary` shows it (`couldNotRun: "no-tests"`). Fix the glob, path or filter. Output
  that shows a test ran (another go package, another cargo binary, a non-zero count) is a run.
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
  `output-too-large` · `timeout` · `wsl` · `no-tests`: it passed without running a test), never a failed run on record. Or report it by hand:
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
  file", pytest "no tests ran" / "error during collection", jest "No tests found", npm "Missing script" / `E404`, npx "could
  not determine executable to run", `python -m <runner>` "No module named …", PHP "Could not open input file", dash "sh: 0:
  cannot open", go "cannot find main module" / "go.mod file not found", cargo "could not find `Cargo.toml`", dotnet
  `MSB1003` / `MSB1009`, ruby "cannot load such file", maven "there is no POM", a test file that doesn't parse — a
  caret-framed `SyntaxError:`; node `--test`'s file-level `not ok 1 - tests/x.test.js` is no test that ran —, PowerShell
  "… is not recognized as a name of a cmdlet" / "The specified module … was not loaded" / "running scripts is disabled on
  this system", Pester "No test files were found"…) — while a test that ran and failed stays red even when its message
  quotes one of those (Pester's
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
- `_Expect:` knows one value, `fail`. Any other (`failure`, `red`, `falha`) leaves a task whose run must PASS: `spec_doctor`
  warns **`expect-value`**, and a failed run's refusal names the value (`unknownExpect`).
- `spec_doctor` warns **`red-green`** (+tdd): T-IDs that done tasks make green (`_Makes green:_`) with no recorded red
  run of an `_Expect: fail_` task citing them — a test that never failed proves nothing. A guard test that passes
  before the change by design (a bugfix's T-02, "the neighbouring behaviour still works") belongs in no
  `_Makes green:_`, so the check never asks for its red run. A bugfix scaffolded before 1.14 still lists T-02 in task
  4's `_Makes green:_` and gets the warning for it: remove T-02 from there — never make the test fail artificially.
- `spec_next_action`'s verify step explains the red proof: record the red run while the test still fails (before the fix,
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
  task is done; the execution sign-off refuses it too, and `spec_next_action`'s finish step says how to run and record them.
- Record them: `spec_finish {name, evidence: [{name, command, exitCode, summary}]}` (each `name` a `meta.checks` name,
  run from the project root — recorded in `.state.json → finishChecks` before the readiness is computed, so one call
  can make the feature ready; a failed run is recorded and stays a blocker), or let the CLI run them:
  `dev-spec finish <feature> --run [--shell bash] [--timeout <seconds>]` — a check that could not run (no shell, a
  signal, the timeout) records nothing.

Without `meta.checks` nothing changes: `/spec-finish` lists "run the full suite" among the fresh checks to confirm.

### The fast check (`meta.fastCheck`, warn only)

One project check — a type check or a linter that answers in seconds — named as the check to run **after each small
edit**, so a type error is fixed the moment it appears, not at the `_Verify:_` or in review.

- **Set it in one call:** `spec_init {checks: {"typecheck": "npx tsc --noEmit"}, fastCheck: "typecheck"}` (CLI `dev-spec
  init --check typecheck="npx tsc --noEmit" --fast-check typecheck`); `fastCheck: ""` / `--fast-check off` switches it off,
  and removing its check switches it off too. Refused before anything is written: a name that is no check after the call,
  dev-guardian's gate (minutes, not seconds), a command that rewrites files — it would change the code and the tests under
  the task. That last rule is a heuristic, read word by word: a `--fix` (or `--fix=…`) or `--write` word, or a `fmt` /
  `format` program or subcommand (`gofmt`, `cargo fmt`, `ruff format`, `dotnet format`, `clang-format`) with a `-w` word (it
  writes, whatever stands beside it: `gofmt -l -w`, `shfmt -l -w`) or with no check word (`--check`, `-check`, `--check-…`,
  `-l`, `-d`, `-n`, `--diff`, `--dry-run`, `--verify-no-changes`, `--lint`, `--validate`, `--test`, `--exit-code`,
  `--output=none`, or swift-format's own `lint` subcommand: `swift format lint`, `swift-format lint` — any other `fmt lint`
  is refused: `make fmt lint`, `pants fmt lint ::`, `npm run fmt lint` run `fmt`). Those words count in the formatter's own
  simple command only (the command line split on `&&`, `||`, `;` and `|`):
  `cargo fmt && git diff --exit-code` writes, `gofmt -l . | grep -v -w vendor` only reads. Check-only forms pass
  (`prettier --check`, `eslint --fix-dry-run`, `gofmt -l`, `swift format lint`, `swiftformat --lint`,
  `dart format --output=none --set-exit-if-changed`, `clang-format -n`, `buf format --exit-code`, `make check-fmt`,
  `npm run fmt:check`, `npm run lint:format`, `dune build @fmt`, a linter run).
  Its limits: the words are read, not the tool — a short flag counts by its common meaning (`-n` a dry run, even where a tool
  gives it another one); a formatter known by another name (`black .`, `prettier -w`, `rubocop -a`) is not recognized — give
  the fast check its check-only command; a formatter whose bare form only reports (`biome format .`) is refused like one that
  writes — use its check form (`biome ci .`, `biome check .`); a `$(… | …)` before the check flag splits the formatter's
  command at that `|` (`ruff format $(git ls-files | grep -v x) --check` is refused) — put the check flag first. A check
  named `off` or `none` can't be the fast check.
- **Pick one that passes on the base branch:** it stays a project check, so `spec_finish` needs it passing on the final
  code like the others — a linter that is already red on main gives no signal and blocks every finish.
- **Offered, never set:** `init` and `spec_upgrade` return `fastCheckOffer` {name, command, from, note} when none is set
  and the root manifests suggest one — a `typecheck` / `type-check` / `check-types` / `tsc` script of package.json (run with
  the lockfile's runner), `npx tsc --noEmit` when tsconfig.json exists AND package.json lists typescript (else npx would
  fetch a compiler), `cargo check`, `go vet ./...`, `ruff check .` (`[tool.ruff]`, ruff.toml), `mypy .` (`[tool.mypy]`,
  mypy.ini). Never a lint script.
- **The loop:** `spec_next_task` returns `fastCheck {check, command}` for a code task (one whose `_Implements:_` names a
  file; never a spike's), the brief `fastCheck {check, command, status}` and a definition-of-done line: edit → run it **on
  its own** (a chained `npx tsc --noEmit && npm test` or a piped `npx tsc --noEmit | head -40` is no run of it — the log
  matches the check as one command) → fix → repeat, clean (exit 0) after the LAST edit, before the `_Verify:_`. A red
  (`_Expect: fail_`) task's test must still pass
  it: it fails on an assertion or "not implemented", never on a type error — add the stub it calls.
- **What is seen:** in Claude Code the observe hook logs each run in `.specs/.execution/observed.jsonl` (the Bash tool; the
  PowerShell tool's failures, and its passes only with an explicit exit code — its lines carry `tool: "PowerShell"`); over
  an MCP-only client nothing is logged — `dev-spec done <feature> <n> --run` on an open code task runs it for you.
- **At the tick:** `spec_complete_task` on a code task it ticks returns `fastCheck {check, status, runs, clean}` — status
  (stable): `clean` · `stale` (a planned file of the feature — its tasks' `_Implements:_` files — is newer than the latest
  run) · `failed` (the latest run failed) · `missing` (no run of it logged) · `unknown` (no harness log at all: no note).
  `stale` / `failed` / `missing` add a note that says to run it on its own now (not piped, not chained) — it names no
  other command: the task is ticked by then, and `done --run` on a done task runs no fast check (the next code task's
  `done --run` does). On `missing`, or when the latest logged run came from the PowerShell tool, the note adds that a
  PowerShell-tool pass is logged only with an explicit exit code — run it with the Bash tool; the tick is never refused.
  `partial: true` (stable): the feature plans more files than the planned-file cap (500 — a big folder or glob), so only
  the first ones and the task's own `_Implements:_` files are dated. `runs` / `clean` count its runs since the feature's
  previous tick; the snapshot is stored on the tick's run (`fast`).
- **`done --run`** runs it FIRST (`$ <command>   (fast check)`) while it isn't clean since the last edit, or is clean only on a
  `partial` set (past the cap an edit to another task's file reads clean) — not when the
  task's `_Verify:_` is the fast command itself (that run counts) — and logs it at its START (an edit made while it ran
  reads stale); a failure or a run that couldn't happen is a warning, the `_Verify:_` runs anyway. The shell rules of
  `finish --run` apply to it (POSIX syntax under cmd.exe, a pwsh script under a POSIX shell: refused before anything runs).
- **Metrics:** `spec_metrics {name}` → `fastCheck {check, runs, clean, cleanRate, ticks, ticksClean}` from the tasks ticked
  now (an undone tick is none) — an `unknown` tick (no harness log) is left out: null with no tick that recorded it; the
  project view counts the ticks (`fastTicks`, `fastTicksClean`) — never run totals (every feature reads the same log).
- **Known limits:** freshness is a file date (a clone or a checkout re-dates every file: a stale note, never a refusal); a
  hook-logged run carries the time the hook wrote it — after the run ENDED, a fraction of a second later — so an edit made
  while it ran, or right after it in the same turn, reads clean (done --run stamps its start); a planned file deleted after
  the run is no edit (its importers may now fail — the next run says so); a logged run records no folder, so the same
  command run in a subfolder or in another worktree of the project counts as the project's run; past the planned-file
  cap only the first files and the task's own are dated (`partial: true`); test files a task names only by T-ID are outside
  the planned files; after merging a parallel wave the merged files are new — run the fast check once before the ticks.

### The friction budget (`_Budget:` lines in tech.md, report only — 1.41)

How long the project checks take in the dev loop: a slow suite slows every agent's loop. Report only — nothing is refused,
blocked or warned per feature, at any size.

- **The budget:** a line of `.specs/steering/tech.md` naming a project check and a duration — `- _Budget: test 2m_` (or
  `*Budget: …*`, any case; the check may be in backticks; text after the closing `_` is a comment: `_Budget: build 90s_ — on a
  laptop`). Units `ms`, `s`, `m` / `min`, `h`; 1 ms – 24 h; at most 20 markers in the first 256 KB are read. One per check (a
  second is reported, the first counts); a name that is no check (a command in its place too: `_Budget: npm test 2m_`), an
  unreadable duration and a duplicate are reported in
  `spec_metrics`' `friction.invalid`; anything else (`_Budget: $500/month_`, a bold `**Budget:**`) is no budget. Fenced code
  and HTML comments are skipped.
- **What is measured:** each run of a check as ONE command — `done --run` / `finish --run` (spawn → the command's exit, never a
  background process's hold on the output) and, in Claude Code, the observe hook (the tool's own `duration_ms`). A piped,
  chained or backgrounded run is no run of the check and is not timed — run the check on its own. The lines go to the
  git-ignored `.specs/.execution/timings.jsonl` (this machine's; past 64 KB each check keeps its newest 10 passing runs); a
  line counts while the check's command is still the one it ran.
- **The verdict:** the MEDIAN of the check's last 5 passing measured runs, 3 needed — one slow run never judges. `spec_metrics`
  (the project view; `dev-spec metrics`) → `friction {checks: [{check, budgetMs, runs, medianMs, minMs, maxMs, status}],
  invalid}`, status (stable) `over` · `within` (a median at the budget is within) · `few-runs` · `no-runs` · `unbudgeted`.
- **At the finish step:** while a check is `over`, `spec_next_action`'s `finish` step ends with a hint and returns `friction
  {over: [{check, medianMs, budgetMs, runs}]}` — propose a platform item to the user (`dev-spec backlog add "friction-<check>"
  "…"`), never a fix inside the feature; or the user raises or removes that budget. The hint stops once the backlog holds
  `friction-<check>` or a feature (active or archived) has that name.
- **Pick a budget ≥ 2× a quiet run:** two suites at once or a parallel wave slow a check by 30–60 % (+56 % measured on Linux,
  two at once), and the median then reads that as friction. One median mixes the CLI's shell (cmd.exe, pwsh) with Claude Code's
  Bash, and each start costs time (PowerShell ~0.35 s): a budget under ~2 s mostly measures shells.
- **A tech.md with `inclusion: always` front matter governs:** editing a budget there marks every approved feature
  `steering-changed-since-approval` — keep budgets in a tech.md without that front matter, or re-approve.
- **Not measured:** runs over the MCP server (it runs nothing) or reported to it; failing runs (a bail-out reads fast); a
  worktree's own CLI runs (its log stays there); permission prompts and the model's thinking.

### dev-guardian's gate — the check `guardian`

With the sibling plugin **dev-guardian** (3.2.1 or later) installed, `spec_init {guardian: true}` (CLI `dev-spec init
--guardian`; `off` / `false` removes it) adds the project check `guardian` = `node .specs/guardian.cjs scan --project .
--fail-on high --format json`. `.specs/guardian.cjs` (written beside it, committed) runs the installed dev-guardian at each
run — `DEV_GUARDIAN_CLI` (a file named `dev-guardian.mjs`) first, else the install Claude Code's
`plugins/installed_plugins.json` records (this project's over the user's), else the newest version folder of its plugin cache
— so the check survives updates of both plugins. It forwards only `scan`, `baseline`, `status` and help. `init` and
`spec_upgrade` only **offer** it when dev-guardian is installed or the project has `.guardian/`: the scan takes minutes and
needs its scanners (Semgrep, Gitleaks, Trivy…), so it is the user's choice — and a **project-wide** one: meta.checks and the
launcher are committed, so every machine that finishes a feature needs dev-guardian and its scanners.

- **Set it up once:** with no `.guardian/baseline.json`, every existing finding counts as new. `init --guardian` says so:
  the user records the baseline on the base commit, before a feature adds code (`node .specs/guardian.cjs baseline update
  --project .`), and commits it. dev-spec writes only under `.specs/`, so `init` names the `.gitignore` lines dev-guardian's
  outputs need (`**/.guardian/*`, then `!` lines for the files a team shares: `baseline.json`, `budgets.yml`,
  `hooks.config.json`, `hooks-allowlist.json`, `scan.yml`); its report sets under `.guardian/reports/` never make a run "dirty".
- **It is a project check like any other** — `finish --run` runs it, `spec_finish {evidence}` records it — read by its exit
  code: **0** pass · **1** new findings at or above `--fail-on` (against `.guardian/baseline.json`) · **2** an incomplete scan
  (an expected scanner did not run) · **3** a usage or configuration error (also: no dev-guardian found). The verdict
  (`suiteChecks[].guardian` — `verdict`: pass · blocked · incomplete · config · not-found · no-launcher · exit) names the
  top findings, **the feature's own `_Implements:_` files first**, says when there is no baseline, and says "update
  dev-guardian" when its report names no version or one below 3.2.1. A pass with gaps the project accepted (a per-file
  timeout listed in `.guardian/scan.yml` `semgrep.accept_timeouts`: no scanner analysed that file) stays a pass but says
  "N file(s) not analysed", and finish warns — review a change to those files by hand. The feature's own files among them are
  named ("src/big.js is this feature's and was not analysed (accepted timeout) — review it by hand"): the gate runs without a
  ref, so read the feature's change to that file yourself — no scanner did. The merge summary also counts
  dev-guardian's coverage notes (taint timeouts, a baseline entry it could not read, findings the gate did not count as new —
  never gating, though the last are findings it let through: `finish --run` prints the first notes). An `accept_timeouts`
  entry no scan used is a finish warning too: the user removes it, or a future timeout on that file is accepted unseen.
- **In Claude Code, run the CLI:** `node "<plugin>/cli/dev-spec.js" finish <feature> --run` with the Bash tool's `timeout:
  600000` (or in the background) — it runs the check and records its report itself. **Over another MCP client** run the
  command from the project root and report it with its JSON stdout: `spec_finish {name, evidence: [{name: "guardian",
  command, exitCode, summary: <stderr's last lines>, report: <stdout>}]}` (dev-guardian 3.3+: add `--compact` to the command
  for a short report — that run proves the check too). A pass needs its report; a report that contradicts the exit code is
  refused (`report-mismatch`), and so is any run of a `.specs/guardian.cjs` that is not the launcher dev-spec-driven writes
  (`launcher-changed` — `init --guardian` writes it again; `finish --run` replaces an earlier version's itself).
- **A blocking finding is fixed**, then the check runs again. To accept ONE reviewed finding the user suppresses it inline
  with a reason (`nosemgrep: <rule> -- <reason>`, `# nosec <id>  # <reason>`) — never `baseline update`, which accepts every current
  finding, the feature's own included (it belongs on the base commit, and it is the user's decision). An incomplete scan
  stays a failed check until its gaps are fixed — the blocker names how, by kind: install a missing scanner
  (dev-guardian's `/guardian-init`), commit a lockfile, a Semgrep per-file timeout → a larger `semgrep.timeout`, or the file
  under `semgrep.accept_timeouts` once the user has reviewed it, in the committed `.guardian/scan.yml` (a listed file that
  changed since it was accepted: review the change by hand, or raise the timeout), …; offline,
  `--local-only` keeps Semgrep to local rules.
  Never force the finish, nor remove the check, without the user — with the approval guard on, removing the check, an
  agent's write of `.specs/guardian.cjs` or `.guardian/baseline.json`, an agent-run `baseline update` and a gate run under a
  `DEV_GUARDIAN_CLI` / `CLAUDE_CONFIG_DIR` of its own are guard-downs.
- **A test pruning the user approved** (`/spec-review <feature> prune` — `subagent-execution.md` → The pruning pass) removes
  tests, and dev-guardian's test-integrity check reports each removal (`test-file-deleted`, `test-assertions-removed` —
  medium). Below the default `--fail-on high` they never block — the warning below names them. At a non-default
  `--fail-on medium` an approved pruning blocks like any medium finding: dev-guardian reads no dev-spec approval (dev-spec's
  record is the user's accept at guard level tests, `feature protect <feature> <file> --accept --reason "pruned: …"`, else
  the feature's test-plan re-approval) and has no accept of its own for such a finding, so the finish stays blocked until
  the user decides — never forced.
- **Its own checks' findings below the gate** (1.41) — the new findings that do not block from dev-guardian's
  test-integrity check (`guardian-test-integrity`, 3.8+: a skip, a deleted test file, fewer assertions) and its suppressions
  check (`guardian-suppressions`, 3.17+: an added `nosemgrep`, Bandit `nosec`, `eslint-disable` … with no reason that
  names no rule, or a whole-file one with no reason even when it names its rules; one with a reason is only counted) —
  are ONE finish warning, never a blocker: each labelled by its check (weakened test · suppression added), the first 3 by
  severity, the rest counted. The user decides each: a pruning they approved stays; a suppression they intended gets a
  reason; otherwise fix it and run the check again. Both checks read the change since the feature's base, which only
  `finish <feature> --run` hands the launcher: a run of the check's command reported over MCP (`spec_finish {evidence}`)
  has no base, so it names none. A `--compact` report lists the blocking findings only, so none is named there; a
  dev-guardian before 3.17 has no suppressions check — its test findings only.
- **Duplication budget:** when `.guardian/budgets.yml` sets `quality.duplication_pct`, `dev-spec dupes` (no feature) /
  `spec_scan {duplicates: true}` shows the project's duplicated share beside it (`budget`), and finish's duplicate warning
  says when the project is over it. dev-spec counts windows of code lines, dev-guardian measures with jscpd — close, not
  identical.

### Metrics that regress silently

Some numbers get worse while every test stays green: a bundle's size, a p95, queries per request, tokens per call, a
build's time. A project check prints each as a METRIC line — the form dev-guardian's `metrics` command reads too:

    METRIC <name>=<number>[ <unit>][ better=lower|higher][ tolerance=<n>[%]][ <key>=<value>...]

- **The line.** `METRIC` starts the line, after blanks or one `# ` (node's TAP reporter); the name is ASCII (letters, digits,
  `_ . -`, up to 64); the number is a plain decimal (`142.3`, `1.5e3` — never `1,5`); the unit one token of up to 16
  characters; unknown `key=value` words are ignored; the last line of a name wins. A line that starts `METRIC <name>=` and
  breaks the form is said as not read; a table header (`METRIC | BEFORE`) is no attempt. Colours are removed first, and a
  byte-order mark at a stream's start.
- **Only the CLI reads them:** `dev-spec done <feature> <n> --run` and `dev-spec finish <feature> --run` read each passing
  command's whole output, stdout and stderr apart (at most 1,000 candidate lines of 512 bytes from the end, 20 names — a
  line past a bound is said). The reader's own bound is an output's last 64 MiB: `finish --run` reads each check alone,
  under the CLI's 64 MB cap (a run whose output passes it records nothing — `output-too-large`, above), so it never
  reaches that bound; several `_Verify:_` commands of one `done --run` are read together and can reach it, and then
  `metricsDropped` says `readBytes`. The tick prints and stores them; it never judges. An MCP report carries none.
- **One stream per name.** dev-spec reads stdout, then stderr, as two texts: a name printed on both reads stderr's line.
  dev-guardian's `metrics` reads one file — a CI job that captures `2>&1` reads it in print order, the last printed
  winning. Print each name on ONE stream and both read the same value. A byte-order mark at the start of the stream
  printed second is read past by dev-spec, while a `2>&1` capture holds it mid-file, and dev-guardian reads nothing there.
- **finish compares.** Each `(check, name)` a project check's passing run printed is set against the LATEST other
  feature's finish that recorded it (`finished.at`, archived features included; never the feature's own). Judged only
  when that earlier line states BOTH `better=` and `tolerance=` — no defaults: otherwise the result shows the delta,
  `unjudged`. Its terms decide; a new line may only tighten (the smaller tolerance applies). A flipped or dropped
  `better=`, a raised or dropped tolerance or a changed unit is said as `loosened` (a new unit is not compared). `n%` is n
  percent of the earlier value; the boundary counts as within; values and tolerances compare as the exact decimals the lines
  printed (120 → 122.4 at 2 % is within), and the warning and `## Metrics` show them as printed (the delta and the applied
  tolerance as numbers). Verdicts: `new` · `within` ·
  `improved` · `regressed` · `unjudged`.
- **The warning, never a blocker.** A reading worse past the tolerance, or a loosened line, is ONE finish warning and the
  merge summary's `## Metrics`; a ready written finish records the readings (`finished.metrics`) for the next feature.
  The number holds every change merged since that finish — another branch's, a dependency bump made outside a feature —,
  not only this feature's: tell the user before the merge. Never loosen, flip or drop a METRIC line to pass.
- **A tolerance is the measured spread.** Run the check a few times on quiet code and state at least the spread you saw
  (`tolerance=3%` for a timing that wanders 2 %). A count (`tests.count`) can say `tolerance=0`. Timings from another
  machine are noise; `kB` and `KB` are different units.
- **Limits.** A test whose output prints a METRIC fixture line is read as a metric (print the real ones from a script); a
  runner that captures stdout hides the line (`pytest -s`); cmd.exe turns `µ` into an unreadable name (ASCII names).
- **The design names them.** A size m / l design gets a `## Silent Regressions` section (from a project design template
  without one: the built-in section, at the end): one row per number, its METRIC name
  in a code span in the first cell and the check that prints it — or `None — <why>`. Doctor warns
  `design-silent-regressions` while it is missing or blank (never a refusal; a design approved before 1.41 is not asked); a
  track's budget section (Performance Budget, Token Economics, UI Performance Budget) holds the targets, this row the check
  that prints the number. finish warns when no passing check printed a readable METRIC line of a name a row declares (a
  malformed line, or one past a reader bound, is not read — the run's note names it) — once `finish --run` ran every check
  (a run reported over MCP carries no reading, so it says nothing). Sizes s, xs and none get nothing new unless a check
  prints a METRIC line with stated terms.
- **The trend:** `dev-spec metrics` (spec_metrics, the project) lists each `(check, name)` across the finishes — a 1.9 %
  step at each finish never warns, but the series shows it.

## Protected tests (`meta.guard: "tests"`, 1.36)

A test made to pass is a weakened test. At guard level `tests` (`init --guard tests`) the tests the plan was approved
against stay as they were unless the plan or the user says otherwise:

- **What is protected** — the feature's `.state.json → protectedTests`: the test files present at its FIRST complete tasks
  approval (the features' `.specs/<feature>/tests/` first, its own first, then the project's; a content hash each, at most
  2,000 — past them doctor warns; a `feature protect` run before the approval doesn't replace it), and at a task's FIRST tick
  the test files it names exactly in `_Implements:_` (their content then is the authorised one — the bugfix's red test,
  task 1's `_Implements: [the test file T-01 goes in]_`) and the test files its `_Verify:_` runs. A test another feature
  already lists joins the snapshot or a `_Verify:_` record with the hash that feature recorded, never its content now — only a
  task's exact `_Implements:_` and the accept record new content. An untick never removes one, and a re-tick never re-records
  one. A new test file stays editable until a tick records it.
- **The edit** (Claude Code's guard hook) — editing, removing or moving a protected test asks unless a task that can START
  NOW names it exactly in `_Implements:_` (never a folder, a glob or `_Makes green:_`, never a task reopened by an untick or
  a box unchecked by hand — its planned test then changes only with the user's lift, as the guard and the brief say) or the
  user lifted it; refused under `meta.approvalGuard: deny`. It holds while the feature that listed the test is unfinished —
  its tasks all ticked too, until its finish — and for every spelling of the path: a glob in any folder (a folder target too:
  `rm -rf tes?/unit`), another case where the file system ignores case, a path through a link or junction. If it asks or
  refuses, the task reports NEEDS_CONTEXT naming the test — never a shell command, a script or git around it.
- **The lift** — `dev-spec feature unprotect <feature> <file> --reason "…"` (`spec_feature {action: "unprotect", file,
  reason}`; the guard's line names the feature being worked on): the user's decision — with the approval guard on, an agent's
  call asks or is refused. It lasts until `feature protect <feature> <file>` (of any feature) ends it — whatever its feature's
  tasks, finished or not: a lift left in place after its feature's finish unprotects the test for every later feature, and
  doctor warns about it. `feature protect <feature>` adds the tests present now (it never re-hashes a recorded one, and a test
  another feature lists joins with the hash that feature recorded — only the accept records new content).
- **The accept** — `dev-spec feature protect <feature> <file> --accept --reason "…"` (`spec_feature {action: "protect", file,
  accept: true, reason}`): the user's decision too (a guard-down, like the lift) — the test's current content becomes the
  recorded one in that feature's list, its lift (if any) ends, and the reason is kept: the merge summary of every written finish
  of that work cycle shows it — after the accept (or a lift), finish again with write (`dev-spec finish <feature> --write`): the
  summary written before it still names the test as changed. The test stays protected: a later change asks again, and finish
  names it.
- **At finish** (every surface, git-free) — each protected test is hashed again: one whose content matches no hash a live
  feature recorded for it (its snapshot, a tick of any feature, an accept) and that no lift in force covers is a **warning**
  naming it (changed / deleted) and a "Protected tests" block in the merge summary — never a blocker: check each change is
  intended, then accept it (the warning's line) — never a lift for that.
- **Defence in depth** — the hook prevents (Claude Code), finish detects what got past it (a confirmed prompt, a script, a
  git command, another client), dev-guardian's test-integrity scan reads the diff for weakened assertions (`.only`, skips,
  removed checks — in new tests too), and the independent reviewer sees every test file a task changed outside its
  `_Implements:_`. Known limits: tests in ignored, hidden or linked folders, outside the project folder or past the cap are
  not listed; new test-support files (conftest.py, setup files, mocks) stay editable; a git command or a script is not read
  by the hook (finish names the result); a merge from the main branch lists teammates' test changes; an archived feature's
  list and lifts are not read (restored, they are again); creating a link to a protected folder is not read — an edit through
  it is, but not one spelled with a glob through it (finish names the change); a task's tick is recorded by its number, so a
  re-plan that renumbers the tasks gives an open task a ticked number (its planned test then needs a lift).

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
  observed; once the task's own latest recorded run failed, only a run logged after that record counts — a pass the
  harness saw before the failure is not the run being reported). `dev-spec
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
the feature name, as the spec commit format (`/executeTask commit`) writes `Part of .specs/<feature>/ task #N.`, or its T- / AC IDs ("Makes T-01
green") — and, on +tdd, a **red-first check**: an implementation committed before its test. Commit with the
spec commit conventions and that history reads itself. An MCP-only client uses `spec_log {name, gitLog}`: it passes
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
| Better, faster, a higher score | the median of the plan's runs against a baseline measured the same way, the delta past the run-to-run spread, every run doing the work (no errors, skipped items or cached answers) | one run; a delta inside the spread; a number measured another way |

## Red flags — stop and run the command

"should", "probably", "seems to", "looks correct" · satisfaction before running anything ("Done!",
"Perfect!") · about to commit / merge / push without a fresh run · trusting a report you didn't check ·
"no shell, so a note will do" · a pipe in the `_Verify:_` · "just this once" · being tired and wanting it over.
