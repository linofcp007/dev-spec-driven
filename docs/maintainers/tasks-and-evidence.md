# Tasks, execution and evidence

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
The task brief, `_Verify:_` and the evidence verdict, `_Depends:_` and waves, the tasks.md scanner, the end-of-turn gate
and harness-observed runs.

## Subagent-driven execution (Phase 6, opt-in — v1.11)
`spec_task_brief` (engine) builds a self-contained brief per task: task block (via `taskBlocks()`, which
keeps sub-lines, phase heading and closing `**Checkpoint:**`), AC IDs resolved to their full EARS text
(`acIndex()` over `criterionBlocks()`, exact-ID keys so AC-1 never hits AC-10), T-IDs resolved to their
test-plan row (keyed by the FIRST table cell), design sections that mention the task (bounded by
`BRIEF_DESIGN_BUDGET`), the task's `_Verify:_`, Global Constraints, the steering it needs (see Scoped
steering), for a bugfix bug.md's Reproduction + Root Cause (and `gated`/`gateError` when the bugfix gate
would refuse the task), and the loop's definition of done. Labels/rules live in the i18n `BRIEF` table (`i18n/<lang>.js` `brief`) +
`renderBrief()`. `write:true` writes `.specs/<f>/.execution/` — a self-ignoring folder (`.gitignore` = `*`),
the brief is regenerated, `ledger.md` is created once and only ever appended by the controller; its result
keeps paths + identifiers (`refs`, `loop`, `inlineOnly`, `verify`, gate) and drops the spec text the brief
quotes unless `includeBrief`. The PostToolUse hook exits early for `/.execution/` paths. The protocol is prose in
`references/subagent-execution.md` + `agents/spec-implementer.md` / `agents/spec-reviewer.md`; the engine
never dispatches anything (keeps it cross-tool). Adapted from obra/superpowers (MIT). 1.22 (prose only, from Anthropic's
`code-review` / `code-simplifier` plugins): the reviewer rates each Critical / Important finding 0–100, lists what is not a
finding, and gains a **verify** mode (one finding, judged fresh — only 80+ opens a fix round; 50–79 is ledgered as
unconfirmed, below 50 refuted) and a **simplify** mode (the diff of `/spec-simplify`), plus §5 written rules (constitution,
CLAUDE.md / AGENTS.md, code comments — quoted) and the history of rewritten lines; `agents/spec-simplifier.md` does the
simplification pass. The engine's only part is the simplifier's SubagentStop gate (below). 1.14 adds to the brief:
`verifyPipes` (the `_Verify:_` commands that pipe), `expect: "fail"` for an `_Expect: fail_` task, `projectChecks`
(meta.checks, in the definition of done), `decisions` (the current decisions.md entries citing the task's ACs / T-IDs,
bounded: 5 entries / 2000 characters) and, for a task proving a `[SEC]` / `[PRIVACY]` criterion, that track's design
sections. An `_Expect: fail_` task's brief is a RED task's: its own tests heading (`BRIEF.testsRed` — the tests it writes
must fail first) and definition of done (`redRules` in place of the loop's green-making rules; the project-checks item is
`projectChecks.briefDodRed` — only the task's new red tests may fail). 1.14 F3: the default task is `taskSchedule()`'s
next (its `_Depends:_` all done), and the brief carries `dependsOn` [{number, status}] (see Task dependencies).

## Evidence (v1.12, gate tightened in 1.13)
- **`_Verify: <command>_`** is an English-stable task marker; `taskMarkers()` keeps its value whole (commas
  belong to the command), drops wrapping backticks and ignores a `[placeholder]`. ONE reader, `taskMarkerSpans()`, serves
  every task marker (taskMarkers, trace_check, implementsRefs, `_Size:_`, the templates check): a value ends at the
  closing `_` — or `*`: `*Verify: …*` is the same marker — followed by whitespace, the end of the line, or closing
  punctuation (`.,;:!?)]`) then whitespace / end, so `(_Verify: npm test_)` and `_Implements: a.ts_;` are markers (they
  were silently dropped: nothing to verify, a verified tick) — but a plain closer (followed by whitespace / the end) before
  the next marker opener, else the end of the line, wins over a punctuation one: `_Verify: python -c "import a_; print(1)"_`
  keeps its whole command. Doctor warns `malformed-markers` for text on a task line that
  looks like a marker but yields none (`**Verify:**`, a bare `Verify:`). The MCP server never
  executes commands — the agent runs them and reports; only the CLI's explicit `done --run` executes a task's
  `_Verify:_` (the user's own tasks.md; `--shell bash|<path>` or `DEV_SPEC_SHELL`). The shell is `resolveRunShell()`'s
  (engine, pure — the CLI passes `git --exec-path`'s output): the platform default (cmd.exe / `/bin/sh`) or the one
  named; on Windows a bare `bash` (flag or env) is Git Bash — `<git --exec-path>/../../../bin/bash.exe` (then
  `…/usr/bin/bash.exe`), `%ProgramFiles%` / `%ProgramW6432%` / `%ProgramFiles(x86)%` / `%LOCALAPPDATA%\Programs` +
  `\Git\bin\bash.exe`, then the first bash.exe on PATH that isn't WSL's. WSL's launcher (`isWslLauncher()`: a bash.exe /
  wsl.exe in System32, SysWOW64, Sysnative or WindowsApps — it runs the command inside a Linux distribution, or fails every
  command with exit 1) is never what a bare `bash` resolves to (none found → `no-git-bash`); named by its path (`--shell
  C:\Windows\System32\bash.exe`) it is the user's choice (1.15 — 1.14 refused it as `wsl-bash`): used as given, flagged `wsl`,
  with a one-line note (`runGate.wslBash`), and a run WSL's relay fails is could-not-run `wsl` (nothing recorded).
  `wsl.exe` (named or bare) is no shell — Node runs `<shell> -c "<cmd>"` and wsl.exe rejects `-c` (exit 4294967295: a
  bogus failed run or red proof) — refused before anything runs (`couldNotRun: "wsl-exe"`, `runGate.wslExe`); a quoted
  path loses its quotes (spawn would miss the file). **PowerShell (1.21.1):** `pwsh` / `powershell` (`.exe`, a path to
  either, any platform — `isPwshShell()`) resolve to `{shell, cmd: false, pwsh: true, args: PWSH_RUN_ARGS}` and the CLI's
  `b5Exec` runs `spawnSync(<shell>, [-NoProfile, -NonInteractive, -Command, <cmd>])` instead of Node's `<shell> -c` (both
  accept -c — measured on pwsh 7.6 and Windows PowerShell 5.1 — but it loads the user's profile and may prompt); the
  command is ONE argument, quoted by Node's Windows rules, which PowerShell reads back intact (`exit 3` → 3, `$x`, `"…"`,
  single quotes). The script's `exit N` is the run's code; a failing last command → 1 (`exit $LASTEXITCODE` passes a
  native tool's on).
  On Windows with the default
  shell (cmd.exe) a command in POSIX syntax (`posixShellSyntax()`: a single-quoted string outside double quotes, `$VAR` /
  `${…}` / `$(…)`) is refused before anything runs — cmd.exe has no single quotes, so `node -e 'process.exit(1)'` exits 0
  and was recorded as a passing run. `--shell bash` runs it; `--shell cmd` runs it under cmd.exe anyway. 1.21.1: a
  PowerShell program's own script is no POSIX syntax — `$` inside a double-quoted word after pwsh / powershell's `-Command`
  / `-c` / `/c` (any abbreviation, what `shellScript()` reads), `-CommandWithArgs`, `-EncodedCommand`, or Windows
  PowerShell's first positional argument (its default is -Command; value options like `-ExecutionPolicy Bypass` skipped) is
  never flagged: cmd.exe hands `pwsh -NoProfile -Command "…; exit $LASTEXITCODE"` over intact. The program counts only in
  program position (cmd.exe's `&` `|` `(` `)` and line breaks outside quotes start a command; `^` escapes). Still refused:
  a single-quoted string outside double quotes (`pwsh -c '…'` — cmd.exe splits it, PowerShell evaluates a string literal:
  exit 0), a `$` outside double quotes, and the arguments after `-File` / pwsh's positional script path (passed to the
  script as literal strings — the CALLING shell's syntax, which cmd.exe never expands: `--shell pwsh` runs them). The
  refusal names `--shell pwsh` for a PowerShell command (`taskDone.posixOnWindows`, `projectChecks.posixOnWindows`).
  **The mirror (1.21.1 review):** `resolveRunShell` marks a POSIX shell `posix: true` (the default /bin/sh off Windows, bash /
  sh / zsh / dash / ksh / fish named or by path, Git Bash, WSL's bash — `isPosixShellName()`); there `posixPwshScript()`
  refuses, before anything runs, a pwsh / powershell script holding `$…` or a backtick outside single quotes (double-quoted
  or bare — the shell expands them first: `exit $LASTEXITCODE` became a bare `exit` → 0, a failing check recorded as
  passing). It lexes POSIX (single quotes literal, `\` escapes, `;` `&` `|` `(` `)` / line breaks end a command) over ONE
  program / option tracker shared with posixShellSyntax (`pwshTracker()`: the program after `VAR=` prefixes and the
  wrappers — `wrapperStep()`, review 2: `SHELL_WRAPPERS` env / command / exec / nohup / time / busybox / wsl / sudo / doas /
  nice / ionice / timeout / setsid / stdbuf, the approval guard's list minus its launchers, with each one's value options
  (`WRAPPER_OPTION_VALUES`: `sudo -u root`, `nice -n 10`, `timeout -s KILL`) and positionals (`timeout 60`); shellScript
  — hence verifyPipeMasked — and runsPwsh skip them the same way). Review 2 also: a redirection outside quotes (`>
  "$OUT"`, `2> "$ERR"`, `&>`, `2>&1`, its fd number) and its target word are the outer shell's, a `#` starting a word
  outside quotes comments out the line, and a POSIX shell's own `-c` script (`bash -c "pwsh -c \"$x\""`, `bash -c 'pwsh -c
  "$x"'` — the value lexShell / shellScript read) is scanned in turn, 3 levels deep at most. `pwsh -c "Invoke-Pester -Path
  $PWD/tests"` is still refused (the shell does expand `$PWD`; single quotes say what was meant). Stable codes `variable`
  · `backtick`; messages `taskDone.pwshInPosix`, `projectChecks.pwshInPosix` (single quotes, or `--shell pwsh` with the
  bare script). After a failed
  run the `taskDone.shellHint` (retry with `--shell bash`) is printed only when `windowsShellFailure(output, code)` says
  cmd.exe itself failed (exit 9009, "is not recognized as an internal or external command", its syntax errors, "cannot
  find the path specified" — EN/PT/ES wording) — never for a check that ran and failed.
- **A run that could not happen is never evidence** (CLI `b5Exec()`, `done --run` and `finish --run`): it is refused with
  `{ok: false, couldNotRun}` + a localized `runGate` message and NOTHING is recorded (it used to be recorded as exit 1 —
  a passing check stored as failed, a red run that never happened). Stable `couldNotRun` codes: `shell-not-started` (spawn
  error ENOENT / EACCES / ENOEXEC / EPERM / EISDIR / ENOTDIR / UNKNOWN) · `run-error` (any other spawn error) · `signal` (no
  exit status — killed; a CRASH of the check itself, SIGSEGV / SIGABRT / SIGBUS / SIGFPE / SIGILL, is a failed run with exit
  128 + the signal number instead, and on an `_Expect: fail_` task no red test) · `output-too-large` (over the 64 MB buffer) · `timeout` (`--timeout <seconds>`, an integer ≥ 1 validated
  before anything runs) · `wsl` (a non-zero run whose output is WSL's relay — `couldNotRunOutput()` kind `wsl`) — plus, on
  an `_Expect: fail_` task only, `cmd` (cmd.exe itself failed the line, `windowsShellFailure()`, any exit but 9009 —
  whenever cmd.exe is the shell: the default or `--shell cmd`), `pwsh` (1.21.1 review: PowerShell's own parse error of the
  line — `pwshParseFailure()`: 5.1's "'&&' is not a valid statement separator", "ParserError:", its FullyQualifiedErrorId,
  pwsh 7's "Unexpected token … in expression or statement" / "Missing closing …" — whenever PowerShell runs the line:
  `--shell pwsh` / `powershell` or `runsPwsh(cmd)`; asked after `output`, never when a test ran) and `output` (the output
  shows the test never ran — see `_Expect: fail_` below); the shell resolution adds `no-git-bash`. `finish --run` stays all-or-nothing: one
  check that could not run records none.
- **Red-phase tasks** (`redPhaseTask()`: "watch it fail", "failing test", "fails for the right reason", PT/ES
  equivalents — `RE_RED_PHASE_TASK`, markers excluded) can never pass a must-pass `_Verify:_`. `redPhaseHint()` appends
  `evidenceGate.redPhaseVerify` (1.14: mark it `_Expect: fail_`, or move the command to the fix task) to the
  failed-run refusal, the failed-run / note-only / no-evidence note and next_action's `verify` step, with the stable
  field `redPhaseVerify: true` — never for a task that already carries `_Expect: fail_`. The bugfix template scaffolds
  task 3 with `_Verify: [command that runs T-01]_` + `_Expect: fail_` (its red run is the proof) and keeps guard test T-02
  out of every `_Makes green:_` (green before and after the fix — doctor's `red-green` asks no red run for it) (EN/PT/ES).
- **The gate (`evidenceIssue()`):** a task whose `_Verify:_` is runnable is verified ONLY by
  `{command, exitCode: 0}`; a note ticks it but leaves it unverified. `{exitCode}` alone and a command
  without its exit code are rejected; "exit 0" without a command is kept as a note. A non-zero run refuses
  the tick and is recorded — a failed re-check of a ticked task makes it unverified until a later pass.
- **Which run proves it (1.22 review).** Until 1.22 the reported `command` was never compared with the `_Verify:_`:
  `{command: "echo hello", exitCode: 0}` verified a task whose `_Verify:_` is `npm test`. `runProvesVerify(run, verify)`
  (evidence.js) is now part of the ONE verdict (`taskEvidenceIssue`, after `evidenceIssue` passed it): the proving run —
  the latest passing run, an `_Expect: fail_` task's red proof — must be a run of one of the task's `_Verify:_` commands,
  both sides read by `proofKey()`: `flatCommand` (backticks, whitespace), quotes around the WHOLE command dropped, a leading
  `cd <dir> &&` / `;` (cmd.exe's `cd /d` too), `set -o pipefail;` (`set -euo pipefail;` …) and `NAME=value` assignments
  and a trailing `2>&1` taken out, repeatedly (bounded); the ` && ` join of several of its commands (a pure `cd <dir>` part
  dropped) counts, and so does a run stamped `observed: "cli"` (`done --run` ran it). Anything else ticks but reads
  **`command-mismatch`** (`evidenceGate.commandMismatch`, EN/PT/ES — the note names the command recorded and the
  `_Verify:_`). An `_Expect: fail_` task: a red run of another command ticks (it is no could-not-run run) but is NO red
  proof — `expectFailRun(ev, prev, verify)` answers `red: false`, so the red run on record is carried forward (`keepRed`)
  and a later pass is "the fix going green" only after a red run of the `_Verify:_` itself; `redProof(e, verify)`,
  `recordEvidence`'s kept `red`, `redGreenGaps` and `observedProof` all take the verify list. A finish check's run is held
  to its `meta.checks` command the same way (`suiteStatus` → `changed`).
- **Reason codes** (stable): `no-evidence` · `failed-run` · `manual-note-on-runnable-verify` ·
  `duplicate-number` · `stale-evidence` · `unexpected-pass` (1.14, `_Expect: fail_`) · `unobserved` (1.14 F1, only
  with `meta.evidence: "observed"` — see Harness-observed evidence) · `command-mismatch` (1.22 review — above). They are RETURNED in
  `spec_complete_task`'s `unverifiedReason` (set
  exactly when `verified` is false) and in `spec_impact`'s per-task `evidence` (`impacted[].tasks[]`,
  `affectedTasks[]`: a code, or `verified`) — both public surfaces; callers branch on these, never on the
  localized note. Internally `verificationStatus().unverifiedDetail` holds them; doctor and `spec_finish` render
  it through `unverifiedLabel()` (localized labels, none for `no-evidence`), and so does the ROADMAP.md/.html
  "needs attention" line (`roadmapData()` keeps each row's `unverifiedDetail`; the labels follow the roadmap
  chrome language): `2 task(s) ticked without verification evidence: #1 (latest run failed), #3`.
- **One verdict: `taskVerification()`** → `{reason, nothingToVerify}` is the ONLY rule behind every `verified`
  (`spec_complete_task`, `spec_status` tasks, `spec_impact` tasks) and every unverified list (doctor, finish,
  ROADMAP.md). A task with no runnable `_Verify:_` and nothing recorded for it (or a record that proves nothing) is
  verified, with `nothingToVerify: true` so no surface calls it a check (`done` prints no "(verified)", impact says
  "nothing to verify"); `no-evidence` is only ever a runnable `_Verify:_` without a run. Never compute a second
  opinion from `taskEvidenceIssue()` directly — `spec_complete_task` used to answer `verified: false` with no reason
  for such a task while doctor, finish and the roadmap passed it.
- **Record shape** (`.state.json → evidence[<n>]`): the latest run `{command, exitCode, summary, at}` plus
  `history` (last `EVIDENCE_HISTORY` = 5 runs, for pass-rate metrics), stamps `task` (text) and `verify`
  (the command) — an edited `_Verify:_` makes the old run `stale-evidence`; a record made while the number
  was duplicated carries `shared` and only counts for its own task; other tasks' records under that number
  are kept in `others`. A note after a run is attached as `note`, never overwrites it (a v1.12 bare
  `{exitCode: 0}` is a claim, not a run: a note replaces it as the summary). `stale: true` is set by
  `spec_impact --reopen`; only a new run (or, without a runnable `_Verify:_`, a new note) clears it. 1.14 F1: every run
  (the latest and each `history` entry) carries `observed: true | false | "cli"` (`runOf()` keeps it; older records have
  none).
- **Without a runnable `_Verify:_`** a task is outside the run gate: no record passes, a bare legacy
  `{exitCode: 0}` or a summary verifies, and `verificationStatus()` skips a `no-evidence` record there —
  only `failed-run` / `stale-evidence` / `duplicate-number` count against it.
- **Fenced code under a task is the brief's, never the task's.** `scanTaskBlocks()` keeps fenced lines in
  `body` (the brief shows them) and flags their indices in `bodyCode`; `taskProse()` (text + non-code body)
  is what `taskMarkers()`, the bugfix gate and the secondary trace read, and `tasksProseText()` (the
  scanner's comment/fence-free view) is what `trace_check` and `implementsRefs()` read — so a fenced
  `_Verify:_` example is never run by `done --run`. `spec_task_brief` reads its AC / T-IDs (loop, stories, design
  needles) from `taskProse()` too; only the rendered task block shows the whole body.
- `verificationStatus()` feeds doctor (`verification`), `ROADMAP.md` attention and `spec_finish` blockers.

**1.14 additions** (engine: the `B5` block of `engine/evidence.js`; the engine still never runs a command or git):
- **`_Expect: fail_`** — an English-stable marker, value kept whole like `_Verify:_`; only `fail` (any case, backticks
  dropped) sets it (`expectsFail()`). On such a task a RED run `{command, exitCode ≠ 0}` is the proof: stored with
  `expected: "fail"`, it ticks and verifies (`redRecorded: true`). A pass with no red run of the SAME `_Verify:_` on
  record is refused and recorded (`unexpectedPass: true`, reason `unexpected-pass`; a ticked task becomes unverified);
  a pass after a red run is the fix going green — the red run is kept as `red` and stays the proof (`redProof()`; a
  `stale` record proves nothing). Exit 126 / 127 / 9009 (`CANT_RUN_EXIT`: not executable, not found, cmd.exe "not
  recognized") is never a red test — refused and recorded like a failed (re-)check (`recorded: true`; a ticked task turns
  unverified, while a red run already on record is kept, so the pass after the fix still counts as green) — `couldNotRun:
  "exit-code"`. Nor is a failing run whose output shows the test never ran: `couldNotRunOutput()` (`CANT_RUN_OUTPUT`,
  literal runner phrases, linear, NULs dropped — kind `test`: node's "Could not find '…'", "Cannot find module",
  ERR_MODULE_NOT_FOUND, python "can't open file" / ModuleNotFoundError, pytest "file or directory not found" / "no tests
  ran", jest "No tests found", vitest / mocha "No test files found", npm "Missing script" / ENOENT, make "No rule to make
  target", PowerShell (1.21.1) "… is not recognized as a / the name of a cmdlet" (pwsh 7 / 5.1, pwsh's pt-BR / es wording,
  blanks between the words — 5.1 wraps; every blank run followed by a literal: `de\s+(?:um\s+)?\s*cmdlet` took 58 s on
  200,000 blanks — mcp/tests/09-evidence.js times EVERY such pattern on 200 KB hostile inputs), "The specified module … was not loaded" (EN / PT / ES), the execution policy
  ("running scripts is disabled on this system", EN / PT / ES; "is not digitally signed"), a -File path pwsh / powershell
  can't find, Pester's "No test files were found"; kinds `wsl` / `spawn`: WSL's relay, a Node spawn error; the `test` kind
  never applies to output that shows an assertion failed — `RE_ASSERTION_RAN`: "not ok N", AssertionError, pytest
  `E   assert`, expect(…), "Expected:" / "But was:", Pester's failed-test line `[-] <name> 12ms (…)` (never a block's "[-] Error
  occurred in …" / "[-] Discovery in …" / "[-] <file> failed with:"), "Expected …, but got …" — or `pesterRan()`: Pester's
  summary "Tests Passed: N, Failed: M>0" (Pester 3: "Passed: N Failed: M") unless a `RE_PESTER_NOT_RUN` line says the test
  never ran (a BeforeAll importing a module that isn't there counts its test failed): "Container failed: N", "BeforeAll \
  AfterAll failed: N" / "[-] Describe <name> failed" / "[-] Context … failed" (Pester 5 / 6 — a block's BeforeAll; the
  1.21.1 review found no "Container failed" there, and the red proof was recorded), "[-] Discovery in … failed", Pester 3 /
  4's "[-] Error occurred in Describe block" / "… in test script". Such a line with no sign a test ran is could-not-run ON
  ITS OWN (kind `test`, the line as the text — a test file that doesn't parse used to be a red proof, 1.21.0 too), and
  `summarizeRunOutput` keeps it like a count line — and (review 2) when the lines it keeps show no run, it also keeps the
  FIRST line `RE_ASSERTION_RAN` reads, trimmed last: a mixed Pester run (one block's BeforeAll failed, another block's test
  failed on its assertion) lost its "[-] Greeter.T-01 … 121ms" line, so the stored summary — re-read by completeTask
  (`done --run` and `spec_complete_task` alike) and cantRunRecord — said "never ran" and the red proof was refused; a
  thrown message quoting "[-] Describe Foo failed" was the same case. A red run whose message
  quotes "Cannot find module" or "is not recognized" (the Pester function under test not written yet) is still red. Output is
  read with its ANSI colour / hyperlink codes dropped (`stripAnsi` — pwsh 7 colours captured output; `summarizeRunOutput`
  drops them too) — `spec_complete_task` refuses and records a run whose
  `summary` shows it (`couldNotRun: "output"`), `done --run` refuses it with nothing recorded, and `cantRunRecord()` keeps
  an older record of either kind from being a red proof (`isRedRun()`). On an `_Expect: fail_` task under `done --run`, a
  line cmd.exe itself could not run (`windowsShellFailure()`, any exit but 9009) is refused with nothing recorded whenever
  cmd.exe is the shell (`--shell cmd` too). Every result for
  such a task carries `expected: "fail"`. Doctor `red-green` (warn, +tdd): T-IDs DONE tasks make green with no recorded
  red run of an `_Expect: fail_` task citing them. Metrics count a red run as a pass and an unexpected pass as a failure.
- **Project checks** — `roadmap.json → meta.checks` `{name: command}` (`spec_init {checks}` / `init --check name="cmd"`,
  repeatable, `name=` or an empty command removes one; names `^[A-Za-z0-9][A-Za-z0-9._:-]{0,39}$`, never a prototype key,
  ≤ 20 checks, a command one line ≤ 500 chars — validated before any write, under the roadmap lock; spec_init's result
  always reports them). Briefs list them (`projectChecks`). `spec_finish {evidence: [{name, command, exitCode,
  summary}]}` records runs in `.state.json → finishChecks[name]` (all-or-nothing, under the feature lock, BEFORE
  readiness is computed; stamped `check` = the configured command, so an edited command reads `changed`, and `code` =
  `suiteCodeStamp()` — one sha1 over the feature's ACTIVE tasks' `_Implements:_` set as the finish baseline records it
  (`baselineFiles()` + each file's `fileHash()`), no stamp when that walk hit its cap; a failed run is recorded too).
  `completeTask` stamps `lastTickAt`; `lastTaskActivity()` = the latest of it and every recorded task run, a stamp more
  than 5 minutes in the future ignored (as `stopActivity()`). `suiteStatus(projectDir, state, dir)` (dir: the feature
  folder the stamp is compared with) → blocker `suite-evidence` (finish + the execution gate), doctor warn `suite-evidence`
  (once every task is done) and the stop gate: a check without a passing run since the last task activity on the code as
  it is now. `suiteChecks` status codes (stable): `pass` · `no-run` · `failed` · `changed` (the configured command changed
  since the run, or — 1.22 review — the run is of another command: `runProvesVerify(run, [check])`) · `before-last-tick` ·
  `code-changed` (a passing run whose `code` stamp no longer matches — code edited after the checks ran; an unstamped run
  keeps the older rules) · `unobserved` (1.14 F1, only with `meta.evidence: "observed"`: a passing run whose `observed` is
  neither `true` nor `"cli"`; each item also carries the run's `observed`). next_action's `finish` / `drift` steps name `dev-spec finish <f> --run` / `spec_finish
  {evidence}` while a check is missing (`projectChecks.naFinish`). Without meta.checks nothing changes. CLI `finish <f>
  --run` executes them (explicit flag only; `--shell` / `DEV_SPEC_SHELL`, `--timeout`, the POSIX refusal under cmd.exe,
  the pipe hint, a check that could not run records nothing). The merge summary labels an `_Expect: fail_` task's red run
  as the expected one (`redGreen.prRed`) and a pass after it with the red run it keeps (`prRedKept`).
- **Git-linked evidence** (CLI only, read-only git): `done --run` / `finish --run` record `{commit, dirty}` (`dirty`
  ignores `.specs/`; silently skipped without git; a malformed value is dropped, never an error — `gitEvidence()`); the
  merge summary tags a run `@sha` / `@sha-dirty`. `parseGitLog()` + `taskCommits()` work on git log TEXT (so the MCP
  server stays exec-free); `dev-spec log <feature> [--max N] [-]` feeds them `git log` (or stdin). Conventions (what
  /spec-commit writes): a message cites task N when it names the feature (its slug as a word — `.specs/<slug>/`,
  `feat(<slug>):`) AND "task #N" / "task N" / "#N" (PT "tarefa N", ES "tarea N"); it cites every task whose text / markers
  name one of its T-IDs (`T-01` = `T-1`) or AC IDs — unless the message names another feature and not this one. +tdd
  red-first: a task with `_Makes green: T-xx_` whose first citing commit is older than the first commit touching a test
  file naming T-xx gets a warning; a full `--max` window makes an unknowable order `outside-window`.
- **Pipes** — `verifyPipeMasked()` runs over a small shell lexer: an unquoted single `|` (also `|&`, inside a subshell,
  and inside `bash -c` / `sh -c` / `pwsh -Command` / `cmd /c` scripts) is flagged; never `||`, a quoted `'|'` / `"|"`,
  `\|` / `^|`, `>|`, a pipe inside `$(…)` or backticks, and only `set -o pipefail` run BEFORE the pipe (or a shell's
  `-o pipefail`) silences it; a Windows path ending in `\` before its closing quote doesn't hide a pipe. Surfaces: the
  brief's `verifyPipes` + a note, `done --run`'s hint line (stderr under `--json`; it still runs), doctor `verify-pipes`
  (warn), and `spec_complete_task`'s `pipeMasked: true` + note on a passing piped run — the verification rules are
  unchanged.

## Task dependencies and execution waves (1.14 F3)
- **`_Depends: 3, 5_`** — an English-stable task marker (the task line or a sub-line, never fenced code — `taskMarkers()`
  reads it like every marker: `taskMarkers(b).depends`). Tokens split on commas, semicolons or spaces; `#3` = `3`; a value
  wholly in `[brackets]` is a template slot (nothing declared). `taskDependsSpec(block)` → `{declared, numbers (unique, as
  written), invalid (tokens that are no task number)}` — with a fast path: no "depends" on the task's lines, nothing parsed.
  The numbers name tasks of the SAME tasks.md. Every reader works on ONE view, the ACTIVE tasks (`activeTasks()`), with
  resolveTask's duplicate rule: a dependency on n is done once EVERY task numbered n is done; a number no active task
  carries never is. **A tasks.md without `_Depends:_` behaves exactly as before** (same next task, no new fields).
- **`taskSchedule(blocks)` is THE next-task rule** → `{next, skipped, blocked, graph}`: the first open task in tasks order
  (parseTasks' — by number, stable; only the task resolveTask answers for its number is a candidate) whose dependencies are
  all done. `skipped` `[{number, waitsOn}]` = open tasks passed over because they wait; `blocked` `[{number, waitsOn}]` =
  open tasks that can never start as things stand (Kahn's walk, `stuckTasks()`: a cycle, a dependency no task carries, or
  waiting on such a task — only computed when some task declares `_Depends:_`; a task without one is never blocked).
  Consumers: `spec_next_task` / `next`, next_action's implement step (open tasks, none startable → step `fix` with
  `blocked` and `taskDepsBlockedNote()` — never "finish"), `spec_task_brief`'s default task (none startable → `task: null`
  + `blocked`/`skipped` + the note, never "all done"), `next --batch` (`parallelBatch()`: a [P] task waiting on an open
  dependency — one in the batch included — ends the batch), `spec_status`'s `next`, the roadmap's next task (open tasks none of which can start → the feature reads `blocked` in
  ROADMAP.md / .html, never "ready", with a `taskDeps.roadmapBlocked` attention line), complete_task's
  `next` (+ `blocked` and the note when none can start), the spike's investigate step and the scope guard's likely task.
  **Never compute "next" with `find(!done)`** again.
- **`taskWaves(blocks, tracks)`** (`spec_next_task {waves: true}` / `next --waves`) → `{waves: [[numbers…]…], cycles,
  blocked}` over the open tasks. A task WITH `_Depends:_` waits for exactly those tasks (an explicit list replaces the
  implicit order); a task WITHOUT one keeps tasks.md order among the undeclared tasks — it waits for the open ones before
  it, and a run of consecutive `[P]` tasks of one section (phase + checkpoint) waits together (join node) and is waited
  for as a whole. A wave is filled greedily in tasks order with the batch's limits: never two tasks sharing an
  `_Implements:_` file (`implementsKey`; a folder overlaps its files), and a task with no `_Implements:_` (its files can't
  be proven disjoint) or an +ai prompt task (`isPromptTask`, inline only) is a wave of its own. `cycles` =
  `dependencyCycles(g, true)` (iterative Tarjan over the OPEN tasks). Only a task's own `_Depends:_` can take it ahead of
  an earlier section's checkpoint — the controller still stops at each checkpoint (`references/subagent-execution.md`). All
  walks are linear and iterative (no recursion on a long chain).
- **complete_task never refuses on dependencies** (a tick records what happened): ticking a task whose `_Depends:_` are
  open (`openDependenciesOf()`) returns `waitsOn` [numbers] + `taskDeps.tickedEarly`. The bugfix gate keeps its
  precedence (the only refusal).
- **Doctor `task-deps`** (fail, `CHECK_PHASE` 5 = the tasks phase; in the feature doctor and `spikeDoctor`) — only when
  some active task declares `_Depends:_` (`taskDepsCheck()` → null otherwise): an invalid token, a number no active task
  carries, a self-dependency, a cycle (`dependencyCycles(g, false)` — the whole plan, done tasks included). The tasks
  approval refuses on it (`approvalChecks` tasks → `task-deps`). Doctor's `malformed-markers` reads "depends:" as a marker
  look-alike only before a task number (`**Depends:** 1`) — "(depends: the schema from task 1)" is prose.
- **The brief** carries `dependsOn` `[{number, status: done | open | missing}]` (kept with `write: true`: identifiers only)
  and renders a "Depends on" section (`taskDeps.briefHeading`) with a NEEDS_CONTEXT note while one is still open.
- **`spec_append_tasks {tasks: [{depends}]}`** / `append-tasks --depends 3,5` (repeatable): every number names an ACTIVE
  task or a task of this same call (by the number it gets here — the error names them), never the task itself, and may
  not close a new cycle (a pre-existing cycle is doctor's); all-or-nothing like every other field; stored as a
  `_Depends: 3, 5_` sub-line and read back through `taskDependsSpec()` before anything is written.

## Tasks: ONE scanner (from Conventions & gotchas)
- **Tasks: ONE scanner.** `taskBlocks()` (over `scanTaskLines()`) reads tasks.md like a markdown reader —
  HTML comments (a line-start `<!--` may span lines) and fenced code never hold tasks; `<!--`/`-->` inside
  code spans don't count. `parseTasks()` is its line-only projection (its shape is public through
  `spec_status`), so status/next/complete/brief/finish can never disagree. A task line is `[-*+] [ ] N. text` — 1.22 review:
  `* [ ] 1.` / `+ [ ] 1.` (valid GFM) read as ZERO tasks, silently; the tasks fingerprint's tick normalization (`uncheckTasks`,
  state.js) takes the same bullets, and an approval fingerprinted the pre-1.22 way (`- [x]` only) still matches. A checkbox line
  the scanner doesn't read — an ordered-list checkbox `1. [ ] text`, an unnumbered `- [ ] text` outside every task block (a
  sub-step in a task's body is the task's; fences and comments hold none) — is named by doctor's `unread-tasks` warn
  (`unreadTaskLines()`, `CHECK_PHASE` 5; the feature and the spike doctor). Task numbers are numeric (`01.` is
  task 1); `resolveTask()` picks the first OPEN task of a duplicated number (doctor warns `duplicate-tasks`);
  `completeTask` ticks exactly the resolved line at its checkbox column (CRLF kept). Tasks are
  story-organized (P1 first) with `[P]` parallel markers + `**Checkpoint:**` lines; the design's
  `Constitution Check` section is checked by `doctor`.
- **A change's tasks live in its change.md (1.21 F5).** A `kind: "change"` folder has no tasks.md: `readIfExists` /
  `existsCached` / `writeFileAtomic` alias its `tasks.md` (and `requirements.md`) to `change.md` (`changeAlias()`, files.js),
  so the scanner, `completeTask` (the tick lands in change.md, its other text kept), the evidence gate, `done --run`, the
  brief, the observe hook's pre-filter and finish work on it unchanged. A size S scaffold's tasks.md is one core task + each
  track's tasks that implement a criterion (`sizeTasksText()`); an XS bugfix's is the red regression test + the fix
  (`bugfixGate()` lets only task 1 through while bug.md → Root Cause is empty — `bugGateFirst`).

## End-of-turn evidence gate and scope guard (1.14)
- **`stopCheck(projectDir, {message, agent, stopHookActive})`** (engine; `hooks/stop-hook.js` and `dev-spec stop-check`
  print the same decision) sends a turn back (`block: true`, `reason`) ONLY when (a) the closing message CLAIMS the work
  is done or verified and (b) a non-archived feature active in the last `STOP_RECENT_HOURS` = 4 h (lastTickAt, ticks,
  evidence `at` / `noteAt` / history, and — 1.22 review — `lastEditAt`: the PostToolUse spec-hook stamps it through
  `recordSpecEdit()` (under the feature lock, a 2 s wait, busy → nothing) whenever tasks.md / change.md is saved with the
  Write / Edit tool, so tasks ticked by hand count (they read `no-recent` before); only what the engine recorded, never a
  file date (a fresh clone stamps tasks.md "now"), and a stamp in the future is ignored. Every feature's `.state.json` is
  read for its activity (cheap); the `STOP_MAX_FEATURES` = 50 MOST RECENTLY active are checked, in folder order — the cap
  used to cut the folder list first, so a feature after the 50th alphabetically was never examined) has ticked tasks `verificationStatus()`
  reports unverified — or, every active task done, project checks without a passing run since the last task activity
  (`suiteStatus().missing` — any status but `pass`, `code-changed` included).
  Stable `why` codes: `stop-hook-active` · `no-specs` · `off` · `no-claim` · `admitted` · `verified` · `no-recent` ·
  `unverified` (+ the implementer's `not-done` · `no-task` · `nothing-to-verify` · `report-ok` · `implementer-evidence`).
  The reason is localized in the project language (an implementer's in its feature's). An unreadable `.state.json` is
  skipped — the gate never blocks on its own trouble.
- **Claims** (`stopClaims()`): the patterns are i18n `stopGate.claims` / `negators` / `admissions` of EVERY language,
  compiled together (unicode word boundaries — JS `\b` never matched "concluído"), over the message's last 20 000
  characters minus fenced code, inline code, HTML comments and quoted (`>`) lines. A claim doesn't count when a negator or
  condition sits up to 3 words before it in its sentence ("not done", "once the tests pass", words ending in `n't` /
  `'ll`, or the claim's own first word — "Nothing is done"), nor when its sentence is a question. An ADMISSION anywhere
  ("task 3 is not verified", "2 failing", "2 are failing") means the honest answer is never sent back — unless a `fixed`
  word — a fixing verb or "previously", never an auxiliary ("was", "had", PT "havia", ES "había": "2 tests failed and I
  was unable to fix them" is an honest admission) — sits within 4 words of it in its clause with no negator anywhere in
  that window (`stopPastFailure()`: "I fixed the 2 failing tests", "previously 4 failed"; "I haven't fixed the 2 failing
  tests", "the 3 failing tests were not fixed" stay admissions) — or (1.22 review) a `passNow` phrase follows it in its
  clause with no negator before it ("Fixed the bug; the 2 failing tests now pass": the `;` had cut the fixed word off; PT
  "agora passam", ES "ahora pasan"). A count of ZERO right before an admission makes it none (`stopZeroCount()`, i18n
  `stopGate.zeroes`, read on ≤ 60 characters of its clause before it: 0 / zero / no / none (of the); PT nenhum(a)(s) (dos);
  ES ninguno(a)(s) (de los)) — "All tasks done. 0 tests failing.", "no tests fail", "none of the tests fail" were read as
  admissions and the gate stayed silent. The look-back and the question tail are bounded
  (`STOP_CLAUSE_SPAN`) — slicing the whole text per hit was quadratic. A noun + done claim ("Feature complete") must end
  its clause ("the implementation done so far" claims nothing). The negator window is cut at
  `:` and dashes; "no" and "se" are read by language (`stopNegates()`: "no" negates in EN, in ES only before a verb or
  clitic, never in guessed-PT text — em+o; "se" — PT "if" — only for a PT claim, never in guessed-ES text nor before a
  Spanish auxiliary or preterite). Claims include "All tasks
  done", "All green", ranges ("Tasks 1-3 done"), "Feature complete" and an emoji ✅ ✓ ✔ around done. A spike is never
  held to the project checks here; a reason listing only checks has its own head line (`headSuite`). When you add a
  language, add its six lists (claims, negators, admissions, fixed, zeroes, passNow — the regex ones are raw for pt-BR:
  i18n.js `defineDerivedLocale(MSG, {stopGate: …})`).
- **spec-implementer (SubagentStop):** it never ticks tasks, so its gate is its REPORT: a DONE / DONE_WITH_CONCERNS for a
  task whose `_Verify:_` is runnable needs `.specs/<f>/.execution/task-N-report.md` (the LAST such path named in its reply,
  a report over a brief — 1.22 review: the first one was read, so a reply citing task 1's report before its own passed) to carry
  every one of those commands (backticks / whitespace flattened) and the exit code the task needs ("exit 0", "exit code:
  1", "exited with code 0", "exit status 2", PT "código de saída", ES "código de salida"): an exit 0 for a must-pass
  `_Verify:_` (`notPassing` — "DONE … exit code: 1" was allowed), a non-zero exit for an `_Expect: fail_` task
  (`notFailing`); any matching code in the report counts, so a report showing the red run and then the green one passes.
  STATUS BLOCKED / NEEDS_CONTEXT, no report path, or no runnable `_Verify:_` → allowed.
- **spec-simplifier (SubagentStop, 1.22):** it rewrites code already reviewed and verified, so its DONE /
  DONE_WITH_CONCERNS needs `.specs/<f>/.execution/simplify-report.md` (named in its reply) to END with the proof:
  `finalRuns()` reads everything after the LAST `## Final runs` heading (at the margin, any level; PT "Execuções finais" /
  ES "Ejecuciones finales" too) to the END of the file — the section is the report's last, so an output line like
  "# pass 212" never ends it and a revert round written below it without a new heading still counts. A run is ONE line
  at the margin: an optional bullet, the command in backticks (``double`` when it holds one), then its exit code
  (`reportExitCodes()` on the rest of that line) — or an INDENTED bullet with a command and its exit code (a run nested
  under a group bullet: review 3, a failing one was skipped as output); every other indented line is output, and fenced
  blocks are skipped (fences counted from the heading — the 256 KB tail window may start inside one). Known limits of a
  text read (all but the first block, none wrongly allows a realistic report): a run pasted only inside a fenced
  transcript is not seen; a backticked bullet in a section written after the final runs reads as a run; a `## Final
  runs` quoted inside a fence after the real one becomes the one that counts. Every run must exit 0 (`notPassing`), every project
  check (`projectChecks()`, flattened, deduplicated) must be one of the runs AS A WHOLE COMMAND — `npm test --
  t/x.test.js` is another run — with a code (`noRun`, also for a run line without one), and a report with no such
  heading (a baseline only) is `noFinal`. The report is read from its END (`readStopReport(file, true)`, ≤
  `STOP_REPORT_MAX`). STATUS BLOCKED / NEEDS_CONTEXT (`not-done`), NO_CHANGES (`no-changes`), no claim, or no
  simplify-report path (or an unknown feature) in the reply (`no-report`) → allowed; `simplify-ok` / `simplifier-evidence`.
  Both subagent gates read the status through `statusProse()`: a status TOKEN in inline code is unwrapped on a line that
  STARTS with "Status" ("**Status:** `DONE`" is a claim — it used to skip the implementer's report); every other code
  span still drops out with `stopProse` (reviews 2–3: unwrapping more made "`order.status === "blocked"`" or "with status
  `blocked`" in a commit line a BLOCKED status). The hard gate
  stays `spec_finish`'s `code-changed`, which sees only the tasks' `_Implements:_` files — /spec-simplify records the
  project checks again after the pass for that reason. Shared helpers: `readStopReport()`, `flatReport()`,
  `reportExitCodes()` (the implementer's gate reads through them unchanged).
- **The hook** (`hooks/stop-hook.js`): registered in hooks.json for **Stop** (no matcher) and **SubagentStop** with matcher
  `^(dev-spec-driven:)?spec-(implementer|simplifier)$` — plugin subagents IGNORE a `hooks` block in their own frontmatter, so it must
  live in the plugin's hooks.json. It reads `last_assistant_message` (a bounded transcript tail for older payloads),
  honours `stop_hook_active` (never sends the same stop back twice in a row), answers `{"decision": "block", "reason"}`,
  is silent when there is nothing to say, when `.specs/` isn't dev-spec's, or when `roadmap.json → meta.stopCheck` is
  exactly `false` (on by default — `spec_init {stopCheck}` / `init --stop-check on|off`; the result always reports it), and
  exits 0 on any error. CLI: `dev-spec stop-check [--message "<text>"|-] [--agent <type>]` (exit 1 = would send it back).
- **Scope guard:** `meta.guard` is `false | true | "scope"` (`guardLevel()`; the hook reads the same raw value;
  `guardInput()`: true / "on" → true, false / "off" → false, "scope" → "scope", strings case-insensitive). `scope` adds,
  once some feature holds approved (or forced) tasks with open ones, `scopeGuardDecision()`: a code file is allowed when
  an OPEN task of such a feature names it in `_Implements:_` (the file via `implementsKey`, a folder above it, or a glob
  matching it) or when it is a test file (tests are planned by T-ID); otherwise ask, naming the likely task (a planned
  file in the same folder, else the longest shared folder prefix, else the `taskSchedule()` next task of the first covering
  feature that has one — 1.14 F3 —, else the first open task) or `/spec-converge`. Text reads only; `guard: true` is unchanged.

## Harness-observed evidence (1.14 F1)
- **The log.** `hooks/observe-hook.js` (hooks.json **PostToolUse** and **PostToolUseFailure**, matcher `^(Bash|PowerShell)$` —
  a PowerShell run only with an EXPLICIT exit code, its response shape being undocumented) logs a run of a task's runnable `_Verify:_` command (or the ` && ` join of
  a task's several commands — `verifyCommandSet()`, how `done --run` reports them) or of a `meta.checks` command.
  `spec.observeRun()` appends ONE JSON line `{command, exitCode, at, event, session}` (command flattened by `flatCommand()`:
  backticks dropped, whitespace runs folded — the implementer gate's rule) to `.specs/<feature>/.execution/observed.jsonl`
  for each non-archived feature whose tasks.md holds that `_Verify:_`, and to `.specs/.execution/observed.jsonl` for a
  project check (a dot folder is never a feature; each `.execution/` gets its self-ignoring `.gitignore` `*`). It never
  creates a feature folder. Bounded: past `OBSERVED_MAX_BYTES` (64 KB) the log keeps its newest lines up to half of that
  (replaced atomically; a concurrent append can lose one line — that run then reads unobserved and is run again); a
  command over `OBSERVED_MAX_COMMAND` (4000) is never logged; at most `OBSERVED_MAX_FEATURES` (200) feature folders.
- **The hook** exits 0 at once unless the tool is `Bash` / `PowerShell` on one of the two events and a project is found —
  EVERY distinct dev-spec one (`isDevSpecProject`) among the nearest folder holding `.specs/` at or above the payload's `cwd`
  and `CLAUDE_PROJECT_DIR` / `SPEC_PROJECT_DIR`: a subagent working in a git worktree of the project runs in the worktree's
  copy, whose git-ignored log is never merged back, so the run is logged in the main project too. Exit code: `tool_response.exit_code` / `exitCode` / `code` / `returnCode` (or
  the payload's own), else a response text starting `Exit code N`; else (never for PowerShell — no code, no run) 0 on PostToolUse (1 when the response says
  `is_error`), and on PostToolUseFailure the code named in `error` ("… exit code 1"), else 1 — a failure is never 0. An
  interrupted run (`is_interrupt`, `interrupted`), a backgrounded one (`run_in_background`, `backgroundTaskId`,
  `backgroundedByUser`) and a run with no explicit code but a `returnCodeInterpretation` (a non-zero exit the Bash tool read
  as no error — grep's "No matches found") are no run. A leading `cd <project root> &&` (or `;`) is stripped (Git Bash
  `/c/…` paths read as `C:/…`) by ONE engine function, `stripCdPrefix(cmd, roots, cwd)` (1.22 review): `observeRun(pdir,
  {command, cwd, roots})` strips a cd into this project OR any project the run belongs to (the hook passes every project it
  found — a subagent's `cd <worktree> && npm test` is logged as `npm test` in the main project's log too, not only in the
  worktree's git-ignored one), and `observedRun` strips the REPORTED command against the project (+ the project holding the
  process's cwd) the same way — the hook used to strip while the lookup didn't, so reporting the exact command that ran read
  unobserved. Any other folder keeps the whole command, which then matches nothing. The hook's pre-filter key drops a leading
  `cd <dir> &&` whatever the folder (a superset — the engine decides). The engine is loaded
  only after a plain-text pre-filter (the flattened command — or each part of a ` && ` join — appears in some feature's tasks.md — ≤ 2 MB each, dot / `_`
  folders skipped — or equals a meta.checks command); it prints nothing, reads stdin asynchronously (≤ 4 MB, else
  ignored), and exits 0 on any error.
- **The stamp.** `observedRun(projectDir, slug | null, command, exitCode, {expected})` → `{observed, at?}`: true when the LATEST
  logged run of the same flattened command within `OBSERVED_WINDOW_MS` (24 h; a stamp more than 5 min in the future
  ignored) exited with the same code — a report of exit 0 after an observed exit 1 is not what the harness saw
  (`latestExitCode`); a reported `a && b` with exit 0 also counts when each part's latest logged run passed. `expected`
  (1.22 review — `observedStamp` passes the task's `_Verify:_` values / `[the check's command]`): a reported run that is
  not one of them (`runProvesVerify`) is never observed — another task's or check's logged run used to count.
  `observedStamp()`: every run `{command, exitCode}` that `spec_complete_task` / `done` and `spec_finish {evidence}` record
  is stamped `observed: true | false`; `done --run` / `finish --run` pass `ranBy: "cli"` → `observed: "cli"` (the CLI ran it
  itself; counts as observed). The MCP server never passes `ranBy`, and `normalizeEvidence()` keeps no caller-given
  `observed`. Every `spec_complete_task` result carries `observed` when a run was given (stable); `suiteChecks[]` items carry
  their run's `observed`, and so do the matrix's task evidence records (F5, `rtmEvidence()` — JSON only; the CSV / table /
  export words don't print it). The brief and the merge summary don't show it.
- **The mode.** `roadmap.json → meta.evidence` = `"reported"` (default — absent is reported: the 1.14 verdict, the stamp is
  context only) | `"observed"` (opt-in; switching to it stamps `meta.evidenceSince`, switching back removes it).
  `evidenceMode()` fails CLOSED: an unparseable roadmap.json whose raw text says `"evidence": "observed"` stays observed
  (one stray byte switched the rule off). `spec_init {evidence}` / `init --evidence reported|observed` (case-insensitive;
  anything else is an error before any write; under the roadmap lock, no write when the effective mode doesn't change);
  the result always reports the current `evidence` (+ `evidenceNote` when given). `evidenceRule(projectDir)` (`{mode, since}`) is read by
  `taskVerification(evidence, block, dup, rule)` (a bare mode string is accepted) — under `"observed"`, a runnable `_Verify:_` is verified only when the run
  that proves it (the latest passing run; an `_Expect: fail_` task's red proof, `redProof()`) is stamped `true` or `"cli"`
  (`observedProof()` — an `_Expect: fail_` red proof recorded BEFORE `evidenceSince` also counts once the fix's passing run
  is observed / CLI-made: re-making it would mean breaking the fixed code), else reason **`unobserved`** — so every surface of the one verdict follows (complete_task, status,
  impact, doctor, finish, ROADMAP.md, the stop gate, the matrix). A task without a runnable `_Verify:_` is unaffected.
  `suiteStatus()` → **`unobserved`** for a passing project-check run that isn't observed (a finish blocker like any status
  but `pass`). complete_task's note (`observed.unobservedNote`; `observed.unobservedRedNote` for an `_Expect: fail_` task — re-make the
  red run observed, never a `--run` of the green test) adds `observed.neverObserved` when no run was ever logged in
  the project (`observedAny()` — an MCP-only client has no hook); next_action's `verify` step adds `observed.naHint`.
- **Not a security boundary:** an agent with a shell could write the log itself. It raises the bar on a hallucinated or
  paraphrased report — the run has to have happened in the harness. MCP-only clients have no hook: under `"observed"` they
  record runs with `dev-spec done <f> <n> --run` (or switch back to `"reported"`).
