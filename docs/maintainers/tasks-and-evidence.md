# Tasks, execution and evidence

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
The task brief, `_Verify:_` and the evidence verdict, `_Depends:_` and waves, the tasks.md scanner, the end-of-turn gate
and harness-observed runs. The rules come first; how they came to be — the releases and review findings — is in
History at the end.

## Subagent-driven execution
Phase 6, opt-in.
- **The brief.** `spec_task_brief` (engine) builds a self-contained brief per task: the task block (`taskBlocks()`: sub-lines,
  phase heading, closing `**Checkpoint:**`); its AC IDs as full EARS text (`acIndex()` over `criterionBlocks()`, exact-ID keys) and
  T-IDs as their test-plan row (keyed by the FIRST cell); the design sections naming it; `_Verify:_`, `verifyPipes` and `expect:
  "fail"`; Global Constraints; `projectChecks`; its steering (see Scoped steering); `decisions` (the decisions.md entries citing its
  IDs, ≤ 5 / 2000 characters); a `[SEC]` / `[PRIVACY]` task's track design sections; a bugfix's Reproduction + Root Cause (+
  `gated` / `gateError` when the bugfix gate would refuse it); `dependsOn` (see Task dependencies); the loop's definition of done.
  Labels: the i18n `BRIEF` table + `renderBrief()`. Its IDs come from `taskProse()`. The default task is `taskSchedule()`'s next.
- **Design sections** (bounded by `BRIEF_DESIGN_BUDGET`) match WHOLE IDs: an AC ID ends before a non-digit and never follows another
  feature's `x/`; a T-ID is read by its number (T-01 = T-1); a file needs a boundary on both sides (US-1.AC-1 is not US-1.AC-10).
  The task's own IDs fill the budget first, then the file / track ones, in design.md's order.
- **A RED task's brief** (`_Expect: fail_`): its tests heading `BRIEF.testsRed` and definition of done `redRules`; its project-checks
  item is `projectChecks.briefDodRed` (only its new red tests may fail).
- **`write: true`** writes `.specs/<f>/.execution/` (self-ignoring: `.gitignore` = `*`): the brief regenerated, `ledger.md` created
  once and only ever appended by the controller. The result keeps identifiers (`refs`, `loop`, `inlineOnly`, `verify`, gate,
  `dependsOn`), the quoted spec text only with `includeBrief`. The PostToolUse hook exits early on `/.execution/` paths.
- **The protocol is prose; the engine never dispatches anything** (it stays cross-tool): `references/subagent-execution.md` and the
  agents `spec-implementer.md` / `spec-reviewer.md` / `spec-simplifier.md` (from obra/superpowers, MIT, and Anthropic's
  `code-review` / `code-simplifier` plugins). The reviewer rates each Critical / Important finding 0–100; its **verify** mode judges
  ONE finding fresh (80+ opens a fix round, 50–79 is ledgered as unconfirmed, below 50 refuted); its **simplify** mode reviews
  `/spec-review simplify`'s diff; it checks the §5 written rules (constitution, CLAUDE.md / AGENTS.md, code comments) and the
  rewritten lines' history. The engine's part: the SubagentStop gates (End-of-turn evidence gate).

## Evidence

### The `_Verify:_` marker
- **`_Verify: <command>_`** is an English-stable task marker. `taskMarkers()` keeps its value whole (commas belong to the command),
  drops wrapping backticks and ignores a `[placeholder]`. ONE reader, `taskMarkerSpans()`, serves every marker (taskMarkers,
  trace_check, implementsRefs, `_Size:_`, the templates check) and reads italics as a markdown reader does — a marker it drops reads
  as "nothing to verify", a verified tick. A value ends at a `_` / `*` closer followed by whitespace or the line's end, by closing
  punctuation (`.,;:!?)]`) then whitespace / end, or by a right-flanking follower (`MARKER_CLOSE_PUNCT`: `*`, a quote, a dash); a
  plain closer before the next marker opener wins over a punctuation one (`_Verify: python -c "import a_; print(1)"_` stays whole);
  no closer is searched past the next opener — wrap marker-like text in backticks. An EMPTY marker (`_Verify:_`) is an empty span; a
  `_` after a letter, a digit or another `_` opens nothing (`__Verify: x__` is bold); `***Verify: x***` opens at its third star
  (`**Verify:**` stays a bold label) and a run of `*` closes at its first star; inside a code span nothing opens or closes.
- **Doctor** (`CHECK_PHASE` 5): `malformed-markers` (warn) — a look-alike that yields no marker: `**Verify:**`, a bare `Verify:`, an
  empty marker written apart from its value (`_Verify:_ npm test` — `emptyLabelValues()`; a first word in `MARKER_NOUNS` keeps "the
  _Verify:_ marker" prose); `verify-suspicious` — a garbled value (`suspiciousVerify()`: a leading `_` / `*`, a code span inside it,
  a quote without its partner).

### Running it: `done --run` and the shell
- **Only the CLI runs commands**, on an explicit flag: `done --run` (a task's `_Verify:_`) and `finish --run` (the project checks) —
  cli/run.js (`execCommand` runs, `runVerdict` judges, `runChecks` loops the checks), git through cli/git.js (`gitRun`). The MCP
  server and the engine never run a command or git: the engine judges the output and records the evidence.
- **The shell** is `resolveRunShell()`'s (engine, pure — the CLI passes `git --exec-path`): the platform default (cmd.exe /
  `/bin/sh`) or `--shell bash|<path>` / `DEV_SPEC_SHELL`. On Windows a bare `bash` is Git Bash — beside `git --exec-path`, under
  `%ProgramFiles%` / `%ProgramW6432%` / `%ProgramFiles(x86)%` / `%LOCALAPPDATA%\Programs`, then the first non-WSL bash.exe on PATH;
  none → `no-git-bash`. A quoted path is unquoted. WSL's launcher (`isWslLauncher()`: bash.exe / wsl.exe in System32, SysWOW64,
  Sysnative or WindowsApps) is never a bare `bash`; named by its path it is used as given (flagged `wsl`, `runGate.wslBash`), and a
  run its relay fails is could-not-run `wsl`. `wsl.exe` rejects `-c` (exit 4294967295) — refused (`couldNotRun: "wsl-exe"`,
  `runGate.wslExe`).
- **PowerShell** (`isPwshShell()`: pwsh / powershell, `.exe` or a path) → `{shell, cmd: false, pwsh: true, args: PWSH_RUN_ARGS}`:
  `spawn(<shell>, [-NoProfile, -NonInteractive, -Command, <cmd>])`, the command ONE argument PowerShell reads back intact — never
  `<shell> -c` (it loads the user's profile and may prompt). The script's `exit N` is the code; a failing last command → 1.
- **POSIX syntax under cmd.exe is refused** before anything runs (`posixShellSyntax()`: a single-quoted string outside double
  quotes, `$VAR` / `${…}` / `$(…)` — cmd.exe has no single quotes: `node -e 'process.exit(1)'` exits 0). `--shell bash` runs it;
  `--shell cmd` forces cmd.exe. A PowerShell program's double-quoted script — after `-Command` / `-c` / `/c` (any abbreviation,
  `shellScript()`), `-CommandWithArgs`, `-EncodedCommand` or 5.1's first positional, the program read only in program position
  (cmd.exe's `&` `|` `(` `)` and line breaks start one, `^` escapes) — is not flagged; single quotes, a `$` outside double
  quotes and the arguments after `-File` still are, and the message names `--shell pwsh` (`taskDone.posixOnWindows`,
  `projectChecks.posixOnWindows`).
- **A pwsh script under a POSIX shell** (`posix: true` — `isPosixShellName()`: /bin/sh, bash, sh, zsh, dash, ksh, fish, Git Bash,
  WSL's bash): `posixPwshScript()` refuses a `$…` or a backtick outside single quotes, which the shell expands first (`exit
  $LASTEXITCODE` → `exit` → 0). It shares ONE program / option tracker with posixShellSyntax (`pwshTracker()`: past `VAR=` prefixes
  and `SHELL_WRAPPERS` — `wrapperStep()`, `WRAPPER_OPTION_VALUES`; shellScript, verifyPipeMasked and runsPwsh skip them the same
  way); a redirection is the outer shell's, an unquoted `#` word comments out the line, and a POSIX shell's own `-c` script is
  scanned in turn (3 levels). Codes `variable` · `backtick` (`taskDone.pwshInPosix`, `projectChecks.pwshInPosix`).
- **The shell hint** `taskDone.shellHint` (retry with `--shell bash`) follows a failed run only when `windowsShellFailure(output,
  code)` says cmd.exe itself failed (9009, "is not recognized as an internal or external command", its syntax and path errors in
  EN / PT / ES — the long ones read between their fixed ends, a gap ≤ 120 characters). cmd.exe and Windows PowerShell 5.1 print in
  the OEM code page while `execCommand` decodes UTF-8, so the PT / ES wordings' accented classes (`RE_CMD_SHELL_FAILURE`, the
  PowerShell `couldNotRunOutput` patterns) take U+FFFD too.

### A run that proves nothing
- **A run that could not happen is never evidence** (`runVerdict()`): refused with `{ok: false, couldNotRun}` + a localized `runGate`
  message, NOTHING recorded. Stable codes: `shell-not-started` (spawn ENOENT / EACCES / ENOEXEC / EPERM / EISDIR / ENOTDIR /
  UNKNOWN) · `run-error` · `signal` (killed) · `output-too-large` (64 MB) · `timeout` · `wsl` · `no-tests` · `no-git-bash`; on an
  `_Expect: fail_` task also `cmd` (`windowsShellFailure()`, any exit but 9009, whenever cmd.exe is the shell), `pwsh`
  (`pwshParseFailure()`, whenever PowerShell runs the line — `--shell pwsh` or `runsPwsh(cmd)`; asked after `output`, never when a
  test ran) and `output` (see `_Expect: fail_`). `finish --run` is all-or-nothing: one check that could not run records none.
- **A crash is a failed run, never a red test.** A check killed by `CRASH_SIGNALS` (SIGSEGV, SIGABRT, SIGBUS, SIGFPE, SIGILL) exits
  128 + the signal. `crashExit(code)` (`CRASH_EXIT`: 132 · 134 · 135 · 136 · 139 and the Windows NTSTATUS crash codes, signed or
  not): `isRedRun()` refuses it, `expectFailRefusal()` answers `couldNotRun: "crash"` (`redGreen.crashNotRed`), recorded as a
  failed run, and it is a failed RE-CHECK of an `_Expect: fail_` task (`expectFailIssue`). 137 / 143 (a kill) and 130 (Ctrl+C) are
  no crash codes.
- **`no-tests` — a pass that tested nothing.** `vacuousRun(output)` (`VACUOUS_OUTPUT` [runner, pattern]: node `--test`'s "tests 0",
  go, cargo, mocha, jest, pytest, vitest, unittest, Pester, RSpec, PHPUnit, dotnet, Maven) — never when `RE_TESTS_RAN` (a non-zero
  count; one go package without tests next to one that ran is a run) or `RE_ASSERTION_RAN` reads the output. `done --run` asks it
  on each passing command's FULL output (refused, nothing recorded, `runGate.noTests`); `spec_complete_task` on a passing run's
  reported `summary`, before any write (`evidence.noTests`; not again for `ranBy: "cli"`); never `finish --run`'s project checks
  (whole suites). Literal, linear on 200 KB (mcp/tests/09-evidence-runs.js times them).
- **`execCommand` is asynchronous** (`spawn` with its own timer; the `--run` handlers and the stdin readers are the CLI's only
  asynchronous handlers). `--timeout` kills the whole PROCESS TREE — `taskkill /T /F /PID`, elsewhere the `detached` child's group
  (`process.kill(-pid)`) — and settles 3 s later even with a pipe open; Ctrl+C / SIGTERM to the CLI kill it too. **The run ends at
  the command's EXIT**, not when its pipes close (a background process it started inherits them): the timer stops, the output
  drains for `RUN_DRAIN_MS` (2 s) at most, the exit status settles the run; `heldOpen` → `cliOutput.runHeldOpen`. The background
  process is left running.
- **Flags:** `--timeout` is an integer from 1 to `TIMEOUT_MAX_S` (2147483 s, Node's timer limit), checked before anything runs;
  `--shell` / `--timeout` without `--run` → `needsRun`; `--run` with `--evidence` / `--exit` / `--cmd` → `runOrEvidence`.
- **Several passing `_Verify:_` commands** record ONE run (`cmd1 && cmd2`) with a `$ <command>` summary section each
  (`runSummaries()`, re-summarized by `summarizeRunOutput(output, room)` to fit the record's 2,000 characters); a failing command
  records itself alone.
- **Red-phase tasks** (`redPhaseTask()`, `RE_RED_PHASE_TASK`: "watch it fail", "failing test"… EN / PT / ES) can never pass a
  must-pass `_Verify:_`: `redPhaseHint()` adds `evidenceGate.redPhaseVerify` (mark it `_Expect: fail_`, or move the command to the
  fix task) and `redPhaseVerify: true` to the refusal, the unverified notes and next_action's `verify` step — never for an `_Expect:
  fail_` task. The bugfix template's task 1 carries `_Expect: fail_`; guard test T-02 is in no `_Makes green:_` (green before and
  after the fix — doctor's `red-green` asks no red run for it).

### The verdict
- **The gate (`evidenceIssue()`):** a runnable `_Verify:_` is verified ONLY by `{command, exitCode: 0}`; a note ticks but doesn't
  verify; `{exitCode}` alone and a command without its code are rejected; "exit 0" without a command is kept as a note. A non-zero
  run refuses the tick and is recorded — a ticked task turns unverified until a later pass.
- **Which run proves it.** `runProvesVerify(run, verify, root)` (evidence.js) is part of the ONE verdict (`taskEvidenceIssue`): the
  proving run — the latest pass, an `_Expect: fail_` task's red proof — runs EVERY `_Verify:_` command and nothing else; a run
  stamped `observed: "cli"` always counts; a command no shell runs as written (`npm test &&`, `a && && b` — `proofIncomplete()`)
  proves nothing. Both sides go through `proofSteps()` → `proofCommands()`:
  - *spellings* — folded: whitespace; a code span (`proofUnwrapCode`) or quotes around the whole command; plain-argument quotes
    (`RE_PLAIN_ARG`, `unquotePlainArgs()`), read BEFORE `\` becomes `/`; `RE_QUOTE_SAFE` quoting; operator spacing and a leading `./`
    below the folder (`proofOps()` — never `./gradlew`, nor Go's `./...`); npm's `npm test` aliases (`RE_NPM_TEST`);
  - *steps* (`splitAndSteps()`, at ` && ` outside quotes): a cd (`RE_PROOF_CD` — cd, `cd /d`, chdir, pushd, Set-Location, sl,
    Push-Location; `RE_PROOF_POPD` pops proofCommands' stack, an empty one matching nothing after it), a `set … -o pipefail`, or a
    command with its `NAME=value` prefixes apart and a trailing `2>&1` dropped. A `;` joins a command to the next (`npm test;
    Pop-Location` is no run of `npm test`); a backtick span or `$(…)` (`proofSubstAt` / `proofSubstEnd`) equals only itself;
  - *folders:* both sides walked from the project root (`proofBase(root)`; a record's `root` stamp first), each cd in order
    (`cdInto`; Git Bash's `/c/…` is `C:/…`), each command compared where it runs (`proofFolderKey`; case folded under a Windows root,
    else `FOLD_CASE`), each `_Verify:_` command from the root on its own. An unknowable folder (`RE_PROOF_OPAQUE_DIR`: `~`, `-`, a
    variable, a glob, a substitution, a bare `C:`) is an opaque token; a `#…` folder (a bash comment) ends the match; without a root
    no absolute folder matches;
  - *coverage* (`commandsCoverVerify()`): the run's commands are the `_Verify:_` commands as WHOLE keys, any order, repeats allowed,
    nothing else; a run's own cd / pipefail only sets what follows; a command carries every assignment the `_Verify:_` makes (it may
    add its own); a cd-only `_Verify:_` matches no run. Bounds: `PROOF_MAX_STEPS` = 200, `PROOF_MAX_KEYS` = 12 (n × 2^k × k),
    `PROOF_MAX_CHARS` (64 KB: never matched); one folder key per folder (a copy per cd is quadratic); the test checks a 16 KB → 64 KB
    ratio, never wall-clock. Commands are kept up to `OBSERVED_MAX_COMMAND` (4000), never cut before comparing;
  - *the root stamp:* a run with an absolute cd stores `root` (`runRootStamp()`; `runOf` keeps it): the project folder as the RUN
    spells it (8.3 name, link — `realpathSync.native`), or a worktree of the SAME repository (`gitCommonDir()`; inside the project
    too) holding the feature, where its first absolute cd lands — so a record made elsewhere proves the same task here (a run field:
    no merge-driver rule).
  - Otherwise it ticks but reads **`command-mismatch`** (`evidenceGate.commandMismatch`); a finish check's run likewise (`changed`).
- **The command rule and `_Expect: fail_`.** A red run of another command ticks but is NO red proof (`expectFailRun(ev, prev,
  verify)` → `red: false`; `keepRed` carries the one on record): green counts only after a red run of the `_Verify:_` itself. Every
  recorded run is stamped `cmdRule: 1` (`CMD_RULE` — `recordEvidence`, `recordFinishChecks`; `normalizeEvidence` never takes it from
  a caller). **Grandfathering:** `redProof(e, verify, pass)` also accepts an unstamped red run of another command (`legacyRedRun(e)`)
  when `pass` runs the `_Verify:_` (the run being recorded in `expectFailRun` / `recordEvidence`; the latest in the verdict,
  `observedProof`, `redGreenGaps` and the untick's `redKept`); `keepRed` never carries a stamped one. A pass of another command with
  no red proof reads `unexpected-pass`. The note: record the red run BEFORE the fix; with it in, `git stash push -- <the fix's
  files>` (a bare `git stash` takes tasks.md and .state.json too).
- **A rule never judges what was recorded before it** (gates-and-approvals.md's grandfathering). A record whose LATEST run lacks
  `cmdRule` (`preRuleRun()`) keeps the pre-rule verdict: no command check in `taskEvidenceIssue` (any red run on record for `_Expect:
  fail_`), `observedProof` without `runProvesVerify`, `redGreenGaps` any red run, `suiteStatus` by the `check` stamp alone.
- **Reason codes** (stable): `no-evidence` · `failed-run` · `manual-note-on-runnable-verify` · `duplicate-number` · `stale-evidence` ·
  `unexpected-pass` · `unobserved` (see Harness-observed evidence) · `command-mismatch` — in `spec_complete_task`'s
  `unverifiedReason` (exactly when `verified` is false) and `spec_impact`'s per-task `evidence` (`impacted[].tasks[]`,
  `affectedTasks[]`); callers branch on them, never on the note. `verificationStatus().unverifiedDetail` holds them; doctor,
  `spec_finish` and the ROADMAP.md attention line (`roadmapData()`) label them via `unverifiedLabel()` (none for `no-evidence`).
- **One verdict: `taskVerification()`** → `{reason, nothingToVerify}` is the ONLY rule behind every `verified` and every unverified
  list. No runnable `_Verify:_` and nothing that proves anything → verified, `nothingToVerify: true` (no surface calls it checked);
  `no-evidence` is only a runnable `_Verify:_` without a run. Never compute a second opinion from `taskEvidenceIssue()`.
- **Record shape** (`.state.json → evidence[<n>]`): the latest run `{command, exitCode, summary, at}` + `history` (`EVIDENCE_HISTORY`
  = 5); stamps `task` and `verify` (an edited `_Verify:_` → `stale-evidence`); each run's `observed`, `cmdRule` (`runOf()` keeps
  both) and `root`. A later note is attached as `note` (a bare legacy `{exitCode: 0}` is a claim a note replaces). `stale: true`
  (`spec_impact --reopen`) clears only with a new run (or note, without a runnable `_Verify:_`). Without a runnable `_Verify:_` there
  is no run gate: a legacy `{exitCode: 0}` or a summary verifies; only `failed-run` / `stale-evidence` / `duplicate-number` count.
- **Duplicates and renumbering.** A record made under a duplicated number carries `shared` (its own task only); others' records are
  kept in `others`. `ownRecord`'s title-edit fallback never takes a record stamped with ANOTHER block's text (`taskPeerStamps()`, a
  WeakMap `taskBlocks()` fills): a renumbered task reads `stale-evidence` and starts its own record, and doctor warns
  **`evidence-moved`** (`movedEvidence()`, `CHECK_PHASE` 6). Evidence never moves; a pure title edit keeps its record.
- **Fenced code under a task is the brief's.** `scanTaskBlocks()` keeps it in `body`, flagged in `bodyCode`; `taskProse()` feeds
  `taskMarkers()`, the bugfix gate, the secondary trace and the brief's IDs, `tasksProseText()` feeds `trace_check` and
  `implementsRefs()` — no fenced `_Verify:_` runs. `verificationStatus()` feeds doctor (`verification`), ROADMAP.md attention and
  `spec_finish` blockers.

### `_Expect: fail_`
Engine: the `B5` block of `engine/evidence.js`.
- **The marker** — English-stable, kept whole; only `fail` (any case, backticks dropped) sets it (`expectsFail()`). Any other value
  (`unknownExpectValues()`) leaves a must-pass task: doctor warns **`expect-value`** (`CHECK_PHASE` 5) and the failed-run refusal
  names it (`evidence.unknownExpect`, stable `unknownExpect: [values]`).
- **The red proof.** A RED run ticks and verifies (stored with `expected: "fail"`, `redRecorded: true`). A pass with no red run of the
  SAME `_Verify:_` on record is refused and recorded (`unexpectedPass: true`, `unexpected-pass`); a pass after one is the fix going
  green — the red run is kept as `red` and stays the proof (`redProof()`; a `stale` record proves nothing). Every result for such a
  task carries `expected: "fail"`.
- **A run that never reached the test is no red run.** Exit 126 / 127 / 9009 (`CANT_RUN_EXIT`) is refused AND recorded like a failed
  re-check (`recorded: true`, `couldNotRun: "exit-code"`; a red run already on record is kept). So is a failing run whose output
  shows the test never ran — `couldNotRunOutput()` (`CANT_RUN_OUTPUT` rows `[kind, pattern, runner]`, kinds `test` / `wsl` /
  `spawn`; literal, linear, NULs dropped): the runners' not-found / can't-load / no-tests phrases (node, python, pytest, jest,
  vitest, mocha, npm / npx, make, PowerShell and Pester in EN / PT / ES, PHP, dash, go, cargo, dotnet, ruby, maven) and a test file
  that doesn't parse (a caret frame, then "SyntaxError:"). A new row needs its fixture in mcp/tests/09-evidence-runs.js (a row
  without one fails); mcp/tests/09-evidence.js times every pattern on 200 KB hostile inputs.
- **An assertion that ran stays red.** The `test` kind never applies when `RE_ASSERTION_RAN` reads the output (never node `--test`'s
  FILE-level `not ok 1 - tests/x.test.js` — a known limit for a test named like a file) or `pesterRan()` does — unless a
  `RE_PESTER_NOT_RUN` line (a container or block failure) says no test ran, which is could-not-run on its own. A message quoting
  "Cannot find module" (the code under test not written yet) stays red.
- **The summary keeps what the verdict re-reads** (completeTask and cantRunRecord read the stored summary): `summarizeRunOutput`
  keeps a could-not-run line, the caret frame (`RE_CARET_LINE` / `RE_SYNTAX_ERROR_LINE`) and, when what it keeps shows no run, the
  first `RE_ASSERTION_RAN` line; ANSI codes are dropped (`stripAnsi`).
- **Where it is refused.** `spec_complete_task` refuses and records a summary that never ran (`couldNotRun: "output"`); `done --run`
  refuses it with nothing recorded; `cantRunRecord()` keeps an older such record from being a red proof (`isRedRun()`); under `done
  --run` a line cmd.exe could not run (`windowsShellFailure()`, any exit but 9009) is refused with nothing recorded.
- **Elsewhere.** Doctor `red-green` (warn, +tdd): T-IDs done tasks make green with no red run of an `_Expect: fail_` task citing them.
  Metrics count a red run as a pass and an unexpected pass as a failure. The merge summary labels the red run (`redGreen.prRed`)
  and the pass that keeps it (`prRedKept`).

### Project checks, git-linked evidence, pipes
- **Project checks** — `roadmap.json → meta.checks` `{name: command}` (`spec_init {checks}` / `init --check name="cmd"`; `name=`
  removes one; names `^[A-Za-z0-9][A-Za-z0-9._:-]{0,39}$`, no prototype key, ≤ 20 checks, one line ≤ 500 chars — validated before
  any write, under the roadmap lock). Briefs list them. `spec_finish {evidence}` records `.state.json → finishChecks[name]` —
  all-or-nothing, under the feature lock, BEFORE readiness is computed, a failure too — stamped `check` (the configured command)
  and `code` = `suiteCodeStamp()` (one sha1 over the active tasks' `_Implements:_` files as the finish baseline sees them —
  `baselineFiles()`, `fileHash()`; none past its cap).
- **Stamped before the run:** `finish --run` passes `runStartStamp()` (→ `finishFeature {runStart}`, validated by `runStartOf()`),
  `done --run` passes `startedAt` and `ranVerify` — an edit made while it ran reads `code-changed` / `changed` / `stale-evidence`.
- **`suiteStatus(projectDir, state, dir)`:** a check without a passing run since the last task activity (`lastTaskActivity()`:
  `lastTickAt` and every task run, a stamp > 5 min ahead ignored) on the code as it is now → blocker `suite-evidence` (finish, the
  execution gate), doctor warn `suite-evidence` (every task done) and the stop gate. `suiteChecks` codes (stable): `pass` · `no-run`
  · `failed` · `changed` (the command changed, or — a `cmdRule` run — another command ran: `runProvesVerify(run, [check])`) ·
  `before-last-tick` · `code-changed` · `unobserved` (each item carries `observed`). next_action's `finish` / `drift` steps name
  `dev-spec finish <f> --run` / `spec_finish {evidence}` while one is missing (`projectChecks.naFinish`). No meta.checks, no change.
- **`finish <f> --run`** (`runChecks`): `done --run`'s shell rules and refusals and the pipe hint; a check that could not run records
  nothing.
- **Git-linked evidence** (CLI only, read-only — `gitRun` / `gitState`): a `--run` records `{commit, dirty}` (`dirty` ignores
  `.specs/`; skipped without git; a malformed value dropped, never an error — `gitEvidence()`), tagged `@sha` / `@sha-dirty` in the
  merge summary. `parseGitLog()` + `taskCommits()` read git log TEXT (the MCP server stays exec-free); `dev-spec log <feature> [--max
  N] [-]` feeds them. A commit message cites task N when it names the feature (its slug as a word) AND "task #N" / "task N" / "#N"
  (PT "tarefa N", ES "tarea N"), and every task naming one of its T-IDs (`T-01` = `T-1`) or AC IDs — unless it names only another
  feature. +tdd red-first: a `_Makes green: T-xx_` task cited before the first commit touching a test file naming T-xx warns; a full
  `--max` window makes an unknowable order `outside-window`.
- **Pipes** — `verifyPipeMasked()` (a small shell lexer) flags an unquoted single `|` (also `|&`, inside a subshell or a `bash -c` /
  `sh -c` / `pwsh -Command` / `cmd /c` script); never `||`, a quoted or escaped pipe (`\|`, `^|`), `>|`, one inside `$(…)` or
  backticks; only a `set -o pipefail` BEFORE the pipe (or `-o pipefail`) silences it. Surfaces: the brief's `verifyPipes`, `done
  --run`'s hint (stderr under `--json`; it still runs), doctor `verify-pipes` (warn), `spec_complete_task`'s `pipeMasked: true` —
  the verdict doesn't change.

## Task dependencies and execution waves
- **`_Depends: 3, 5_`** — an English-stable task marker (the task line or a sub-line, never fenced code: `taskMarkers(b).depends`).
  Tokens split on commas, semicolons or spaces; `#3` = `3`; a value wholly in `[brackets]` is a template slot.
  `taskDependsSpec(block)` → `{declared, numbers, invalid}`. The numbers name tasks of the SAME tasks.md, read on ONE view — the
  ACTIVE tasks (`activeTasks()`) — with resolveTask's duplicate rule: n is done once EVERY task numbered n is; a number no active
  task carries never is. **Without `_Depends:_` nothing changes** (the same next task, no new fields).
- **`taskSchedule(blocks)` is THE next-task rule** → `{next, skipped, blocked, graph}`: the first open task in tasks order (only the
  task resolveTask answers for its number) whose dependencies are done. **Tasks order:** by SECTION in file order (`taskSections()`:
  a phase heading and its closing checkpoint), then by number — `taskDepGraph`'s `order`, which the waves use too; parseTasks' public
  list stays by number. `skipped` / `blocked` `[{number, waitsOn}]`: open tasks that wait / can never start as things stand (Kahn's
  walk, `stuckTasks()`: a cycle, a dependency no task carries, or waiting on such a task — only when some task declares
  `_Depends:_`). Consumers: `spec_next_task` / `next`; next_action's implement step (none startable → step `fix` with `blocked` and
  `taskDepsBlockedNote()`, never "finish"); the brief's default task (`task: null` + `blocked` / `skipped`, never "all done"); `next
  --batch` (`parallelBatch()`: a [P] task waiting on an open dependency ends the batch); `spec_status`'s `next`; the roadmap (none
  startable → `blocked`, never "ready", with `taskDeps.roadmapBlocked`); complete_task's `next`; the spike's investigate step; the
  scope guard's likely task. **Never compute "next" with `find(!done)`.**
- **`taskWaves(blocks, tracks)`** (`spec_next_task {waves: true}` / `next --waves`) → `{waves, cycles, blocked}` over the open tasks:
  a task WITH `_Depends:_` waits for exactly those; one WITHOUT waits for the open undeclared tasks before it, and a run of
  consecutive `[P]` tasks of one section waits — and is waited for — as a whole. A wave fills greedily in tasks order: never two
  tasks sharing an `_Implements:_` file (`implementsKey`; a folder overlaps its files); a task without `_Implements:_` (its files
  can't be proven disjoint) or an +ai prompt task (`isPromptTask`, inline only) is a wave of its own. `cycles` =
  `dependencyCycles(g, true)` (iterative Tarjan over the open tasks). Only a task's own `_Depends:_` takes it past an earlier
  section's checkpoint — the controller still stops at each. Every walk is linear and iterative (no recursion on a long chain).
- **complete_task never refuses on dependencies** (a tick records what happened): open `_Depends:_` (`openDependenciesOf()`) →
  `waitsOn` + `taskDeps.tickedEarly`. The bugfix gate stays the only refusal.
- **Doctor `task-deps`** (fail, `CHECK_PHASE` 5; the feature doctor and `spikeDoctor`; `taskDepsCheck()` → null when no task
  declares): an invalid token, a number no active task carries, a self-dependency, a cycle (`dependencyCycles(g, false)`, done tasks
  included). The tasks approval refuses on it (`approvalChecks` tasks → `task-deps`). `malformed-markers` reads "depends:" as a
  look-alike only before a task number (`**Depends:** 1`).
- **The brief** carries `dependsOn` `[{number, status: done | open | missing}]` and a "Depends on" section (`taskDeps.briefHeading`)
  with a NEEDS_CONTEXT note while one is open.
- **`spec_append_tasks {tasks: [{depends}]}`** / `append-tasks --depends 3,5`: each number names an ACTIVE task or a task of this
  call (by its new number), never the task itself, and closes no new cycle (a pre-existing one is doctor's); all-or-nothing; stored
  as a `_Depends: 3, 5_` sub-line and read back through `taskDependsSpec()` before anything is written.

## Tasks: ONE scanner
- **Tasks: ONE scanner.** `taskBlocks()` (over `scanTaskLines()`) reads tasks.md like a markdown reader — HTML comments (a line-start
  `<!--` may span lines) and fenced code never hold tasks; `<!--` / `-->` inside code spans don't count. `parseTasks()` is its
  line-only projection (public through `spec_status`), so status / next / complete / brief / finish never disagree. Tasks are
  story-organized (P1 first) with `[P]` parallel markers + `**Checkpoint:**` lines; doctor checks the design's `Constitution Check`.
- **A task line** is `[-*+] [ ] N. text`; the tasks fingerprint's tick normalization (`uncheckTasks`, state.js) takes the same
  bullets, and a fingerprint made on `- [x]` alone still matches. Task numbers are numeric (`01.` is task 1); `resolveTask()` picks
  the first OPEN task of a duplicated number (doctor warns `duplicate-tasks`).
- **Line ends.** A line loses EVERY trailing CR (`dropTrailingCr`, a loop — `/\r+$/` is quadratic on a long run), so "\r\r\n" reads
  like LF; a task's text is every character after its head (`taskLine` — a U+2028 / U+2029 inside it is ordinary). `activeTasks()`
  (tracks.js) splits as the scanner does; mcp/tests/08-tasks.js checks both views on 36 variants.
- **Phase headings:** `taskHeadings()` — an ATX heading at the margin and a setext one (as `headingEntries` reads it; the underline
  is part of the heading) — the same headings `activeTasks`, the section readers and `spec_append_tasks` read.
- **A sibling is no body:** a checkbox at the task line's own indentation or less (or quoted) is never that task's lazy-continuation
  body — a mistyped `- [ ] 2 B` would otherwise vanish into task 1, markers and all; a deeper checkbox is a sub-step.
- **CommonMark's indented code block:** outside every list, a line indented 4+ columns (`indentCols()`: a tab to the next multiple of
  4) after a blank line, a heading or the top of the file is code, and so is each line after it while it stays indented or blank
  (`scanTaskLines`' `ind` state, `listStep()`); inside a list the indentation is the item's, and such a line is `{code, indented}`.
- **`unread-tasks`** (warn, `CHECK_PHASE` 5; the feature and the spike doctor — `unreadTaskLines()`, `RE_LIST_BOX_LINE`) names a
  checkbox line the scanner doesn't read: `1. [ ] text`, an unnumbered `- [ ] text` outside every task block, a one-character box
  (`[~]`, `[-]`, `[/]`; a letter or digit is a link), a quoted one, an indented task (real tasks indented so read as zero).
- **A tick changes the checkbox's bytes, never the text.** `completeTask` ticks exactly the resolved line at its checkbox column.
  `readIfExists` decodes UTF-8 (UTF-16 by its BOM), so a tasks.md in Windows' ANSI code page reads a U+FFFD per accented byte: a
  tick / untick / spec_impact --reopen changes the checkbox's byte(s) only (`checkboxBytes()`: the bytes before the box must decode
  to exactly the text before it — else refused, `err.tasksNotText`, nothing recorded), found BEFORE `.state.json` is written.
  spec_append_tasks and a track's template tasks (`applyTracks` checks first; scaffold.js `appendSpecFile` too) write the file's own
  encoding (`tasksRewrite()`: UTF-8, or UTF-16 with its BOM) or are refused, nothing written. A file rewritten between the read and
  the write (never under the feature lock) gets the new text in its encoding.
- **A change's tasks live in its change.md.** A `kind: "change"` folder aliases `tasks.md` (and `requirements.md`) to `change.md` in
  `readIfExists` / `existsCached` / `writeFileAtomic` (`changeAlias()`, files.js), so the scanner, `completeTask`, the evidence gate,
  `done --run`, the brief, the observe hook's pre-filter and finish work on it unchanged. A size S scaffold's tasks.md: one core
  task + each track's tasks that implement a criterion (`sizeTasksText()`); a bugfix's, any size: the red regression test (task 1)
  + the fix (`bugfixGate()` lets only task 1 through while bug.md → Root Cause is empty — `bugGateFirst`; gates-and-approvals.md →
  Bugfix and finish).

## End-of-turn evidence gate and scope guard
- **`stopCheck(projectDir, {message, agent, stopHookActive})`** (engine; the Stop hook and `dev-spec stop-check` print the same
  decision) sends a turn back (`block: true`, `reason`) ONLY when the closing message CLAIMS the work done or verified AND a
  non-archived, recently active feature has ticked tasks `verificationStatus()` reports unverified — or, every active task done,
  checks without a pass since the last task activity (`suiteStatus().missing`; never for a spike). Recently active: within
  `STOP_RECENT_HOURS` = 4 h of what the engine RECORDED (`stopActivity()`; `lastEditAt` is the PostToolUse spec-hook's
  `recordSpecEdit()` on a tasks.md / change.md save, so hand ticks count) — never a file date (a fresh clone stamps every file
  "now"), never a future stamp. Every feature's activity is read; the `STOP_MAX_FEATURES` = 50 most recent are checked.
- **The answer.** Stable `why` codes: `stop-hook-active` · `no-specs` · `off` · `no-claim` · `admitted` · `verified` · `no-recent` ·
  `unverified`; the implementer's `not-done` · `no-task` · `nothing-to-verify` · `report-ok` · `implementer-evidence`; the
  simplifier's `no-changes` · `no-report` · `simplify-ok` · `simplifier-evidence`. The reason is in the project language (a
  subagent's in its feature's; checks only → `headSuite`). An unreadable `.state.json` is skipped: the gate never blocks on its own
  trouble.
- **Claims** (`stopClaims()`): every language's i18n `stopGate.claims` / `negators` / `admissions` compiled together (`STOP_WORD`:
  unicode word boundaries — `\b` never matches "concluído") over the last 20 000 characters of prose (`stopProse`: no code, HTML
  comments or `>` quotes). A negator or condition up to 3 words before a claim in its clause (`n't` / `'ll`, the claim's own first
  word — "Nothing is done"), or a question, cancels it; the window stops at `:` and dashes; "no" / "se" are read by language
  (`stopNegates()`). An ADMISSION ("2 failing") means the honest answer is never sent back — unless a `fixed` word (a fixing verb,
  "previously"; never an auxiliary) sits within 4 words of it with no negator (`stopPastFailure()`), a `passNow` phrase follows it,
  or a ZERO count precedes it (`stopZeroCount()`, `stopGate.zeroes`: "0 tests failing"). The look-back is capped
  (`STOP_CLAUSE_SPAN`) — per-hit slicing is quadratic.
  - *A claim is about the WORK* (the `STOP_EN_*` / `STOP_PT_*` / `STOP_ES_*` fragments): a state claims when its clause ends there
    (`…_END`) or the work is its subject; a simple past only with the work as its object (`…_WORK`) or ending its sentence; a
    line-start "Done." (`stopLineClaim()`) only alone, before an emoji, tests / tasks (`…_TESTED`) or the work — "Done. I updated
    the README as you asked." claims nothing. mcp/tests/10-guards-hooks-cost.js holds the non-claims and the claims to keep;
    mcp/tests/03-languages.js's pt-BR lint skips these raw keys.
  - No session scoping: `.state.json` records no session (an MCP tick has none), and a new state key would need the merge driver.
- **Trigger words.** Each language's `stopGate.triggers` (pt-BR keeps pt's raw, with its own `funcionando` / `passando` / `rodando`)
  lists words EVERY claim pattern of the language holds one of; `stopPatterns().triggers` runs a pattern only when the text holds a
  trigger of its languages — the same answer (`stopClaims(m, {allPatterns: true})`). Patterns, triggers and admissions compile on
  first use (`stopLazyPattern`). **A new claim pattern adds its word to its language's triggers.**
- **The one-byte scan.** A prose with a character past U+00FF is scanned as its one-byte projection, the patterns rewritten for it
  (mcp/lib/latin1-scan.js `latin1Text` / `latin1Table` / `latin1Pattern`; guards.js `stopScan`, hook-utils.js `claimScan`), a
  Latin-1 one as a one-byte copy — V8's two-byte regex code for `[\p{L}\p{N}_]` is large. The answer never changes
  (`stopClaims(m, {plain: true})`, mcp/tests/10-guards-stop-scan.js); details: claude-code-integration.md → Hooks and commands.
- **Adding a language:** its seven lists (claims, triggers, negators, admissions, fixed, zeroes, passNow — raw for pt-BR:
  `defineDerivedLocale(MSG, {stopGate: …})`).
- **spec-implementer (SubagentStop)** never ticks, so its REPORT is gated: a DONE for a task with a runnable `_Verify:_` needs
  `.specs/<f>/.execution/task-N-report.md` (the LAST such path in its reply, a report over a brief) to show each command run with
  the needed exit code — 0 (`notPassing`), non-zero for `_Expect: fail_` (`notFailing`). `verifyRunCodes()` reads line by line: a
  mention is a code span that runs a command (`runProvesVerify`; an exit-code span or an incomplete command is none) or the command's text; an exit code belongs
  to the last mention before it on its line, else the first after it, else the last above (`process.exit(0)` is none). EACH command
  needs a run with a code (`noRun`) and its LAST run decides (`lastNotPassing` / `lastNotFailing`). A code-span run shows a command
  (`reportCommandSpans()`, ≤ 500 spans of ≤ 4000 characters). `stopReportFile()` reads an absolute path in the project or another
  checkout of its repository (the same git common dir), else the project's copy — never another repository. BLOCKED /
  NEEDS_CONTEXT, no path or no runnable `_Verify:_` → allowed.
- **spec-simplifier (SubagentStop)** rewrites verified code: its DONE needs `.specs/<f>/.execution/simplify-report.md` to END with
  proof — `finalRuns()` reads from the LAST `## Final runs` heading (any level; PT / ES too) to the file's END. A run is ONE margin
  line (the command in backticks, its exit code — `reportExitCodes()`) or an INDENTED bullet with both; other indented lines are
  output; fences are skipped (counted from the heading — the 256 KB tail may start inside one). Every run exits 0 (`notPassing`);
  each project check (`projectChecks()`) is one of the runs AS A WHOLE COMMAND (its last run by `runProvesVerify`) with a code
  (`noRun`); no heading → `noFinal`. Known limits (all but the first block; none wrongly allows a realistic report): a run only
  inside a fenced transcript is unseen; a backticked bullet in a later section reads as a run; a fenced `## Final runs` after the
  real one counts. BLOCKED / NEEDS_CONTEXT (`not-done`), NO_CHANGES (`no-changes`), no claim or no report (`no-report`) → allowed.
  The hard gate stays `spec_finish`'s `code-changed` (only `_Implements:_` files), so /spec-review simplify re-records the checks.
- **Both subagent gates** read the status via `statusProse()`: a backticked status token is unwrapped only on a line STARTING with
  "Status". Shared: `readStopReport()` (≤ `STOP_REPORT_MAX`; the simplifier's from the END; UTF-16 by its BOM via `decodeText`, from
  an even offset), `flatReport()`, `reportExitCodes()`, `stopReportFile()`.
- **The hook** (`hooks/stop-hook.js`): **Stop** and **SubagentStop** (`^(dev-spec-driven:)?spec-(implementer|simplifier)$`) in the
  plugin's hooks.json — plugin subagents IGNORE a frontmatter `hooks` block. It reads `last_assistant_message` (else a bounded
  transcript tail), never sends a stop back twice in a row (`stop_hook_active`), answers `{"decision": "block", "reason"}`, exits 0
  on any error. Which project: mcp/lib/probe.js `sessionProjects({cwd, anchors})` + `sessionAnchors()` — the nearest folder at or
  above the payload's `cwd` whose `.specs/` is a dev-spec project (`isDevSpecProject`, ≤ `SESSION_MAX_UP` levels), then
  CLAUDE_PROJECT_DIR / SPEC_PROJECT_DIR when they are; the engine picks THE project (`spec.sessionProject()` —
  claude-code-integration.md → Which project a hook reads). Silent with nothing to say, no project, the gate off (`meta.stopCheck`
  exactly `false`; unset → the user's `DEV_SPEC_STOP_CHECK`; `init --stop-check on|off`), or — Stop only — no `.state.json` string
  parsing as a date in the window: a raw superset of `stopActivity()` before the engine loads (≤ `STOP_PRE_MAX_FEATURES` = 500
  folders, ≤ 1 MB a file; its `STOP_RECENT_HOURS` is checked against the engine's). CLI: `dev-spec stop-check [--message
  "<text>"|-] [--agent <type>]` (exit 1 = would block).
- **The claim pre-filter (Stop only).** `hooks/stop-claims.generated.json` — COMMITTED, from `npm run build` (guards.js
  `stopClaimFilter()`): the claim patterns (`stopClaimSources()`), `STOP_WORD`, stopProse's regexes (`RE_STOP_FENCE` /
  `RE_STOP_CODE` / `RE_STOP_QUOTE`), the `triggers` groups; stamped with each `STOP_FILTER_SOURCES` file's size, no version. Used
  only while every size matches (a size-preserving edit is the accepted limit; `npm run check` and the suite catch it). `mayClaim()`
  runs the triggers (none → done), then `claimMatch()` runs `claimProse()` (wide: `claimScan`) through ONE alternation of the
  triggered patterns; no match ends the hook. A superset: negations, questions and admissions stay the engine's; any trouble → the
  engine. SubagentStop is never pre-filtered. mcp/tests/10-guards-guard-downs.js ("I-I4") checks it filters out no engine claim. **`npm
  run build` after editing an i18n file or guards.js** — the "1.20 build" test fails until the file is committed.
- **Scope guard:** `meta.guard` `false | true | "scope"` (`guardLevel()`; the hook reads it raw; `guardInput()`: true / "on", false
  / "off", "scope"). `scope`, once a feature holds approved (or forced) tasks with open ones, adds `scopeGuardDecision()`: a code
  file passes when an OPEN task of such a feature names it in `_Implements:_` (`implementsKey`, a folder above it, a glob) or it is a
  test file; otherwise ask, naming the likely task (a planned file in its folder, the longest shared prefix, the first covering
  feature's `taskSchedule()` next, the first open task) or `/spec-review <feature> converge`.

## Harness-observed evidence
- **Only as strong as the approval guard; not a security boundary.** The log is a file the agent can write: with
  `meta.approvalGuard` off (the default) one appended line forges an observed run (the guard asks / refuses that write —
  claude-code-integration.md → Human approval guard). So `initProject` returns `observedWarning` (`observed.unguarded`; `init`
  prints it) whenever its result is `observed` with `approvalGuard` `off`, and `specDoctor` warns `observed-unguarded`. It raises the
  bar on a hallucinated or paraphrased report. `observed.on` says the PowerShell tool alone logs only runs whose exit code Claude
  Code reports; MCP-only clients (no hook) record runs with `dev-spec done <f> <n> --run` under `"observed"`.
- **The log.** `hooks/observe-hook.js` (**PostToolUse** + **PostToolUseFailure**, `^(Bash|PowerShell)$`, `"async": true`; PowerShell
  only with an EXPLICIT exit code; never Monitor, which reports no finished run) logs a run of a task's runnable `_Verify:_` as the
  gate's matcher reads it (`runProvesVerify`: one command, all of a task's in any order, or a plain ` && ` step) or of a
  `meta.checks` command: `spec.observeRun()` appends `{command, exitCode, at, event, session}` (`observedKey`) to
  `.specs/<feature>/.execution/observed.jsonl` per non-archived feature with such a task, or `.specs/.execution/observed.jsonl` for a
  check; it never creates a feature folder. Bounds: past `OBSERVED_MAX_BYTES` (64 KB) the newest half is kept (atomic; a concurrent
  append may lose a line — that run reads unobserved); `OBSERVED_MAX_COMMAND` (4000); `OBSERVED_MAX_FEATURES` (200).
- **Async:** an async hook decides nothing, its `timeout` isn't enforced (10 kept as documentation), and `claude -p` cancels one
  still running at teardown — a headless session's LAST run may go unlogged (`done --run` makes it observed). The line lands within
  ~0.2 s, before the model's next call; only a spec_complete_task in the SAME parallel batch could read the log first.
- **The hook** exits 0 at once unless a completed `Bash` / `PowerShell` run on one of the two events.
  - *Which projects:* mcp/lib/probe.js `sessionProjects({cwd})` (the one rule `isDevSpecProject`): the nearest dev-spec project at or
    above the payload's `cwd` (≤ `SESSION_MAX_UP` levels; a network cwd only itself), then CLAUDE_PROJECT_DIR / SPEC_PROJECT_DIR
    (`sessionAnchors()`) when they are one — every distinct one, so a run in a worktree's copy (its git-ignored log never merged
    back) is logged in the main project too; once one passed the pre-filter, also the project `spec.sessionProject()` maps the cwd
    to, when its tasks mention the run.
  - *Exit code:* `tool_response.exit_code` / `exitCode` / `code` / `returnCode` (or the payload's), else a leading `Exit code N`;
    else (never PowerShell) 0 on PostToolUse (1 with `is_error`), the code named in `error` or 1 on PostToolUseFailure — a failure is
    never 0. Interrupted (`is_interrupt`, `interrupted`), backgrounded (`run_in_background`, `backgroundTaskId`,
    `backgroundedByUser`) or code-less with a `returnCodeInterpretation` (grep's "No matches found") → no run.
  - *The cd prefix:* ONE engine function, `stripCdPrefix(cmd, roots, cwd)`, strips a leading `cd <project root> &&` / `;` (Git
    Bash's `/c/…` = `C:/…`) into any project the run belongs to, in `observeRun(pdir, {command, cwd, roots})` and in `observedRun`'s
    lookup alike (else the exact command reads unobserved); another folder keeps the whole command.
  - *The pre-filter* (before the engine loads): a copy of `observedNorm` / `observedBodies` (mcp/tests/09-evidence.js compares the
    sources) — the command's bodies, normalized as the matcher reads them, must each appear in a tasks.md read the same way (≤ 2 MB;
    dot / `_` folders skipped; UTF-16 decoded; change.md only without tasks.md; one open per folder) or a meta.checks command — a
    SUPERSET of the matcher (mcp/tests/09-evidence-matcher.js). A WHOLE bracketed `_Verify:_` value (`RE_VERIFY_PLACEHOLDER`, the
    scaffold's) is taken out first, as the engine never runs one (tasks.js `scanTaskMarkers`: `^\[.*\]$`). observeRun repeats the
    test before parsing. No cached `_Verify:_` index (a stale one would silently drop observations). It prints nothing, reads stdin
    asynchronously (≤ 4 MB) and exits 0 on any error.
- **The stamp.** `observedRun(projectDir, slug | null, command, exitCode, {expected, root})` → `{observed, at?}`: the LATEST logged
  run within `OBSERVED_WINDOW_MS` (24 h; > 5 min ahead ignored) that runs the expected commands exited with the reported code
  (`latestExitCode`). `opts.after` (after the task's own FAILED or stale run) counts only later runs. A pass also counts when each
  expected command's latest logged run passed, or each plain ` && ` step's (`proofPlainParts`). `expected` (`observedStamp`: the
  task's `_Verify:_` values / `[the check's command]`, else the reported one) — a run of none is never observed; `root` is the run's
  stamp. Known limits: a run needing its `root` stamp (a sibling worktree, `cd /d <wt>`, an 8.3 name) can read unobserved; an older
  failed join hides newer passing parts; the pre-filter splits a quoted `;` in `VAR="a;b"`.
- **Who stamps.** `observedStamp()` stamps every recorded run `observed: true | false`; `done --run` / `finish --run` pass `ranBy:
  "cli"` → `"cli"` (counts). The MCP server never passes `ranBy`; `normalizeEvidence()` drops a caller's `observed`.
  `spec_complete_task` results, `suiteChecks[]` items and the matrix's evidence (`rtmEvidence()`, JSON only) carry it; the brief and
  the merge summary don't.
- **The mode.** `roadmap.json → meta.evidence` = `"reported"` (default, absent: the stamp is context only) | `"observed"` (switching
  stamps `meta.evidenceSince`; back removes it). `evidenceMode()` fails CLOSED (an unparseable roadmap.json saying `"evidence":
  "observed"` stays observed). `spec_init {evidence}` / `init --evidence reported|observed` (case-insensitive, else an error before
  any write; under the roadmap lock; every result reports `evidence`). `evidenceRule(projectDir)` (`{mode, since}`) feeds
  `taskVerification(evidence, block, dup, rule)`: under `"observed"` a runnable `_Verify:_` needs its proving run (`redProof()` for a
  red task) stamped `true` / `"cli"` (`observedProof()`; a red proof older than `evidenceSince` counts once the fix's pass is
  observed — re-making it would break the fixed code), else **`unobserved`** on every surface of the one verdict; `suiteStatus()`
  likewise. complete_task's note (`observed.unobservedNote`; `observed.unobservedRedNote` — re-make the red run observed) adds
  `observed.neverObserved` when nothing was ever logged (`observedAny()`); next_action's `verify` adds `observed.naHint`.

## History
How the rules above came to be, section by section — grep a release (`1.21.1`) or a finding id (`M8`, `r6 B3`) here.

### Subagent-driven execution
- **v1.11** — opt-in subagent-driven execution (Phase 6): `spec_task_brief`, the `.execution/` folder, the implementer and
  reviewer agents, adapted from obra/superpowers.
- **1.14** — the brief gains `verifyPipes`, `expect: "fail"` with the RED task's tests heading and definition of done,
  `projectChecks`, `decisions` and the `[SEC]` / `[PRIVACY]` design sections. **1.14 F3** — the default task becomes
  `taskSchedule()`'s next, and the brief carries `dependsOn`.
- **1.22** — prose only, from Anthropic's `code-review` / `code-simplifier` plugins: the reviewer's 0–100 rating and the "not a
  finding" list, the verify and simplify modes, the §5 written rules and the rewritten lines' history; `agents/spec-simplifier.md`.
  The engine's only part was the simplifier's SubagentStop gate.
- **1.23 review 5** — design sections matched by WHOLE IDs: a substring test took US-1.AC-1 for US-1.AC-10 and T-1 for T-10; the
  sections naming the task's own IDs now fill the budget first.

### Evidence
- **v1.12** — `_Verify:_` and the evidence verdict. A bare `{exitCode: 0}` was a valid record then — kept since as a legacy claim.
- **1.13** — the gate tightened: a runnable `_Verify:_` is verified only by `{command, exitCode: 0}`.
- **1.14** — the `B5` block: `_Expect: fail_` (reason `unexpected-pass`), project checks, git-linked evidence, the pipe check;
  `redPhaseVerify`. **1.14 F1** — `observed` on every run, reason `unobserved`. A closing punctuation after a marker had made
  `(_Verify: npm test_)` and `_Implements: a.ts_;` silently drop (nothing to verify, a verified tick).
- **1.15** — a WSL launcher named by its path is used as given (1.14 refused it as `wsl-bash`); `wsl.exe` refused, quoted shell
  paths unquoted.
- **1.21.1** — PowerShell as a run shell (`isPwshShell()`, `PWSH_RUN_ARGS`; measured on pwsh 7.6 and Windows PowerShell 5.1: both
  accept -c, but it loads the profile and may prompt); a PowerShell program's own script is no POSIX syntax under cmd.exe; "… is
  not recognized as … cmdlet" became could-not-run (one pattern, `de\s+(?:um\s+)?\s*cmdlet`, took 58 s on 200,000 blanks — since
  then every pattern is timed). **1.21.1 review** — the mirror, `posixPwshScript()`: under a POSIX shell `exit $LASTEXITCODE`
  became a bare `exit` → 0, a failing check recorded as passing; `couldNotRun: "pwsh"`; Pester 5 / 6 report a block's BeforeAll
  failure without "Container failed", and the red proof had been recorded — a `RE_PESTER_NOT_RUN` line with no sign a test ran
  became could-not-run on its own (a test file that doesn't parse had been a red proof, 1.21.0 too). **1.21.1 review 2** — the
  pwsh-under-POSIX lexer skips the wrappers (`SHELL_WRAPPERS`, `WRAPPER_OPTION_VALUES`) and reads redirections, `#` comments and a
  POSIX shell's own `-c` script; a mixed Pester run (one block's BeforeAll failed, another block's test failed on its assertion)
  lost its "[-] Greeter.T-01 … 121ms" line from the summary, so the re-read summary said "never ran" and the red proof was refused
  (a thrown message quoting "[-] Describe Foo failed" was the same case) — the summary keeps the first assertion line.
- **1.22 review** — the command rule: until then the reported `command` was never compared with the `_Verify:_` (`{command: "echo
  hello", exitCode: 0}` verified a task whose `_Verify:_` is `npm test`) — `runProvesVerify`, reason `command-mismatch`, a finish
  check's run held to its command (`changed`). `finish --run` / `done --run` stamps taken before the run (stamped after it, an edit
  made during a long suite read as tested).
- **1.22 review 2** — EVERY `_Verify:_` command must be run (a run of one of two verified the task; nothing documented an "any one"
  rule); `\` read as `/` and plain-argument quotes dropped; whole-key coverage (the run was split on every ` && `, so a `_Verify:_`
  that itself holds one never matched its documented join); a run's own cd / pipefail / assignments no longer stripped from both
  sides (`cd packages/web && npm test` proved `_Verify: cd packages/api && npm test_`, `npm test | tee log` proved `set -o pipefail;
  npm test | tee log`, `npm test` proved `NODE_ENV=production npm test`); commands kept up to `OBSERVED_MAX_COMMAND`
  (`normalizeEvidence` and the finish runs cut them at 500 BEFORE the comparison: command-mismatch); grandfathering, as
  observedProof's R2, a pre-rule red run of another form plus a passing run of the `_Verify:_` itself — such a task (a pre-1.22 red
  run, a variant the steps don't fold) was stuck for good: the fix's passing `done --run` was refused as unexpected-pass and the
  only way out was reverting the fix.
- **1.22 review 3** — substitutions: `flatCommand` dropped EVERY backtick first, so ``cd `: && npm test` `` read as `cd :` + `npm
  test`. Folders: cd folders were compared as TEXT — `cd C:/…/proj/packages/web && npm test` and `cd ./packages/web && npm test` were
  no run of `cd packages/web && npm test`, and a run's own cd was passed over wherever it went (`cd ../other-project && npm test`
  proved `npm test`) — hence the walk from the root. Only a PRE-RULE red run is grandfathered: any red run on record (`npm test --
  tests/other.test.js`, or `false`) plus the passing run of the `_Verify:_` verified a task with no red run of its own test, and the
  note told agents to do just that — hence `cmdRule` / `legacyRedRun`. A cd chain copied the folder per cd: 1 MB of `cd x/ && ` as a
  `_Verify:_` took 60 s.
- **1.22 review 4** — the OEM code page: on a PT Windows "O sistema não conseguiu localizar o caminho especificado" never matched,
  and an `_Expect: fail_` task was ticked on cmd.exe's own failure. Upgrade safety: after a plugin update, tasks an earlier release
  had verified (`npx jest x` reported for `_Verify: npm test -- x`, a Windows path) turned command-mismatch and blocked /spec-finish,
  and so did a project check's run of another form — `preRuleRun()`, finish runs stamped `cmdRule`. The root stamp for a worktree
  INSIDE the project (the check ran only for a cd outside it, so the run was read in a folder of the main project:
  command-mismatch). The `_Expect: fail_` note names `git stash push -- <the fix's files>`.
- **1.23 review** — **M13**: `execCommand` became asynchronous — spawnSync's timeout killed the shell alone, a test runner's worker
  ran on and held the output pipe, and the CLI waited all the same. **L7**: a crash is never a red test (a segfault was the red
  proof of an `_Expect: fail_` task). Several passing `_Verify:_` commands get a summary each (the record kept the LAST command's
  alone).
- **1.23 review 5** — **M4**, markers read as a markdown reader reads italics: an empty marker is a span (a title naming two markers
  yielded the runnable `_Verify:_` `_ and _Implements:` — never verifiable, and `done --run` executed it; "_Depends:_ and _Size:_"
  failed task-deps), the fallback closer past the next opener removed, `__Verify: x__` had read as italics with the value `x_`, a
  code span had cut ``_Verify: `npm test -- -g "a_ b"`_`` at `"a`. `verify-suspicious`. **L9**: more spellings of one command
  (quotes read before `\`, `RE_QUOTE_SAFE`, `proofOps()`, a leading `./`, npm's aliases, chdir / pushd / popd and PowerShell's
  location commands). **L10**: "The filename, directory name, or volume label syntax is incorrect" had no PT / ES wording (PT-PT "A
  sintaxe do nome de ficheiro, nome de diretório ou etiqueta de volume está incorreta", PT-BR "A sintaxe do nome do arquivo…", ES "La
  sintaxis del nombre de archivo…" now read).
- **1.24 r6** — **D1**: inserting a task at the top and renumbering handed the old task 1's passing `npm test` to the new task 1
  (same `_Verify:_`), which ticked with no evidence read verified; storeEvidence extended that record as its own and an untick staled
  it — `taskPeerStamps()`, `evidence-moved`. **D2**: an empty marker written apart from its value (review 5's empty span had hidden
  them: the task ticked as "nothing to verify") — `malformed-markers`, `emptyLabelValues()`. **D4 + D-I2**: a glob, a path or a
  filter that matches no test exits 0 (node `--test` prints "tests 0") and verified a must-pass task — `vacuousRun`, `no-tests` (the
  CLI's only change is the refusal). **D5 + D-I3**: the could-not-run phrases of `python -m`, PHP, npm / npx, dash, go, cargo,
  dotnet, ruby, maven and pytest's collection errors. **D7 + D-I8**: an unknown `_Expect:_` value left a must-pass task silently —
  `expect-value`, `unknownExpect`. **D8**: a test file that doesn't parse (caret frame + SyntaxError — a red proof before) and node
  `--test`'s FILE-level `not ok 1 - tests/x.test.js` (under the TAP reporter, Node 18–22's default when piped, a broken import was
  the red proof while the spec reporter read could-not-run). **D9**: CommonMark's right-flanking closers. **B3**: the run ends at
  the command's exit — a background process the check started kept the CLI waiting, and `--timeout` refused a run that had exited 0.
  **B6**: `TIMEOUT_MAX_S` — a larger value became a TimeoutOverflowWarning and a 1 ms timer, so the run was refused as "did not
  finish within --timeout 9999999 s".
- **1.25.1 review 7** — `proofIncomplete()`: `proofSteps` dropped the empty step, so `npm test &&` read as a run of `npm test`. A
  crash is also a failed re-check of an `_Expect: fail_` task: a re-run that segfaulted fell through to the red run carried forward,
  so the task stayed verified and finish didn't block.
- **1.27** — the runs moved out of cli/dev-spec.js (its b5Exec / b5Verdict / b5RunChecks) into cli/run.js (`execCommand`,
  `runVerdict`, `runChecks`), every git call into cli/git.js (`gitRun`); the done / finish `--run` handlers became the CLI's only
  asynchronous handlers next to the stdin readers.

### Task dependencies and execution waves
- **1.14 F3** — `_Depends:_`, `taskSchedule()` as the one next-task rule, `taskWaves()`, doctor `task-deps`, `spec_append_tasks
  {depends}`; a tasks.md without `_Depends:_` behaves exactly as before it.
- **1.24 r6 D6** — tasks order by section: by number alone, a task spec_append_tasks put into an EARLIER phase (`{heading}`, numbered
  after every task) came after a later phase's tasks — next, complete_task's next, the brief's default task and the waves served
  Phase 2 past Phase 1's checkpoint.

### Tasks: ONE scanner
- **1.20** — moved here from conventions.md's Conventions & gotchas, when the notes split by topic.
- **1.21 F5** — a change's tasks live in its change.md (`changeAlias()`); the size S scaffold.
- **1.22 review** — `* [ ] 1.` / `+ [ ] 1.` (valid GFM) read as ZERO tasks, silently; the fingerprint's tick normalization takes the
  same bullets, and an approval fingerprinted the pre-1.22 way (`- [x]` only) still matches. `unread-tasks`.
- **1.23 review 5** — CommonMark's indented code block: complete_task's "first open task 1" ticked the indented example above the
  real one. **P3**: a tasks.md in the ANSI code page (Windows PowerShell 5.1's Set-Content / Add-Content) read a U+FFFD per accented
  byte, and writing the TEXT back destroyed every one of them on ONE tick — `checkboxBytes()`, `tasksRewrite()` (a UTF-16 file used
  to become UTF-8).
- **1.23.1** — the track template tasks' write (scaffold.js `appendSpecFile`) goes through `tasksRewrite()` too; 1.23.0 still wrote
  UTF-8 there. Every bugfix, any size, scaffolds the two-task tasks.md — the red regression test is task 1 (task 3 before the short
  form).
- **1.24 r6 D3** — line ends: "\r\r\n" (Python's text mode on Windows, a double unix2dos) kept a "\r" on each line, headRest read it
  as a line terminator and NO task was read ("Task 1 not found"); a U+2028 / U+2029 inside a task's text made headRest refuse the
  line; `activeTasks()` split on /\r?\n/ and read tasks the whole-file view did not.
- **1.25.1** — setext phase headings: the scanner read ATX only while `activeTasks` and the section readers read setext, so every
  phase was null and `taskSchedule` served a later section's task first. **1.25.1 review 7** — a sibling is no body (a mistyped `- [
  ] 2 B` became task 1's body and vanished from every tool); `unread-tasks` names one-character boxes and quoted ones, skipped
  silently before.

### End-of-turn evidence gate and scope guard
- **1.14** — the end-of-turn gate (`stopCheck`, the Stop / SubagentStop hook, `dev-spec stop-check`) and the scope guard's `"scope"`
  level. **1.14 F3** — the scope guard's likely task falls back on `taskSchedule()`'s next.
- **1.22** — the spec-simplifier's SubagentStop gate.
- **1.22 review** — `lastEditAt` through `recordSpecEdit()` (tasks ticked by hand read `no-recent`); the `STOP_MAX_FEATURES` cap
  applies to the most recently active (it cut the folder list first, so a feature after the 50th alphabetically was never examined);
  `passNow` ("Fixed the bug; the 2 failing tests now pass": the `;` cut the fixed word off); zero counts ("All tasks done. 0 tests
  failing.", "no tests fail", "none of the tests fail" read as admissions and the gate stayed silent); the implementer's LAST report
  path (the first one was read, so a reply citing task 1's report before its own passed); a backticked status is a status (it used
  to skip the implementer's report); the Stop hook's raw activity pre-filter (30 idle features: ~235 → ~88 ms a turn).
- **1.22 reviews 2–3** — unwrapping more code spans made "`order.status === "blocked"`" or "with status `blocked`" in a commit line a
  BLOCKED status: only a line starting with "Status" is unwrapped (`statusProse()`). **review 3**: the simplifier reads an indented
  run nested under a group bullet (a failing one was skipped as output).
- **1.23 review 5** — **M16**: a `_Verify:_` command is shown by a run of it in a code span (the raw text compare bounced `node --test
  tests/login.test.js` for `_Verify: node --test tests\login.test.js_`); a simplifier check's run is a run of its command by
  `runProvesVerify`. **M8**: the report is read where the reply names it (`stopReportFile()` — the controller hands the MAIN
  checkout's path in parallel mode, a subagent in a worktree writes its own copy), and the hook reads the project
  `spec.sessionProject()` picks. **L8**: `readStopReport()` decodes a UTF-16 report (it read as noise: no run, no code).
- **1.24 r6 I-I4** — the claim pre-filter: with recent activity the hook still loaded the engine (~100 ms) to learn that most closing
  messages claim nothing. Measured (p50 of 15 interleaved fresh processes, a recently active project of 10 / 52 / ~150 features): no
  claim 162 / 163 / 163 → 59 / 59 / 59 ms; a claim 236 / 246 / 274 → 253 / 263 / 291 (the filter's ~12 ms compile before the
  engine). The 34 patterns compiled apart took ~19 ms, together ~7 ms.
- **1.25.1 review 7** — a claim is about the WORK: every language listed its bare verbs and participles, so "I verified that the bug
  is in the parser", "the migration was completed in 2023", "The pay() function is implemented in src/pay.ts", "Verifiquei o
  ficheiro…", "Acabei de ler o código", "Terminé de leer…" were sent back while any recent tick was unverified — one model round-trip
  a turn (the review's 17 messages are in mcp/tests/10-guards-hooks-cost.js); new claims ("ready to merge", "good to go", "Work
  complete —") and the EN negator "how". Session scoping considered and left out. The implementer's report read per run: any exit 0
  anywhere passed "Ran `npm test` → exit code: 1 … Ran `npm run lint` → exit code: 0"; "DONE … exit code: 1" had passed before
  `notPassing`.
- **1.25.1** — trigger words: the work-shaped patterns grew to 47, ~14 K characters (34 / ~3.8 K before); compiled all together the
  Stop hook's pre-filter took ~50 ms (~14 before) and the engine's first `stopClaims` in a process ~10 ms more. With triggers
  (Windows, min of 15, a recently active project): no trigger 76 → 65 ms; "Done. I updated the README …" (a trigger, no claim) 213 ms
  (sent back) → 80 ms (silent). The hook's `mayClaim()` reads the `triggers` groups first.
- **1.26** — the claim filter dropped its version stamp: a release that changes none of its source files leaves it as it was (the
  test: a package.json with another version → still the filter).
- **1.27** — the claim scan on a one-byte text (mcp/lib/latin1-scan.js): one em dash, curly quote or emoji in the closing message made
  stopClaims ~110 ms slower and the pre-filter ~30 ms; claim patterns, triggers and admissions are built on first use (a message
  runs ~18 of ~47). Every hook's pre-check became mcp/lib/probe.js (`sessionProjects` / `sessionAnchors`, the one rule
  `isDevSpecProject`).

### Harness-observed evidence
- **1.14 F1** — the observe hook, the `observed` stamp, `meta.evidence` and reason `unobserved`. Its feature review: **R1** — an
  unparseable roadmap.json had read as "reported", so one stray byte switched the rule off: `evidenceMode()` fails closed; **R2** —
  an `_Expect: fail_` red proof recorded before `evidenceSince` counts once the fix's passing run is observed (the task stayed
  unobserved for good, and the note sent the user round in circles); **R4** — a run in a worktree is logged in the main project too.
  **1.14 F5** — the matrix's task evidence records carry `observed` (`rtmEvidence()`).
- **1.22 review** — `expected`: another task's or check's logged run used to count; ONE `stripCdPrefix` (the hook stripped a cd while
  the lookup didn't, so reporting the exact command that ran read unobserved; a worktree's run reached only its own git-ignored log);
  the pre-filter opens each tasks.md once (a stat, a read and a change.md probe per folder cost +133 ms a Bash call at 150 features;
  measured 226 → 192 ms there).
- **1.22 review 3** — logged and looked up as the evidence gate's matcher reads them (`runProvesVerify`): it logged only the
  `_Verify:_` as written or its in-order join, so `node --test tests\x.test.js`, `npm test && npm run build`, `CI=1 npm run lint` —
  verified in reported mode — read `unobserved` in observed mode; `observedKey` keeps backticks; the pre-filter became a copy of
  `observedNorm` / `observedBodies`.
- **1.22 review 4** — `observeRun` logs a step of a plain ` && ` `_Verify:_` (it logged only runs of a whole value, so the per-step
  fallback never found one); the known limits listed.
- **1.23** — the approval guard reads the Monitor tool; the observe hook never does. **1.23 review 5 (M8)** — the run is also logged
  in the project `spec.sessionProject()` maps the cwd to; **review 5** — the pre-filter takes the matcher's new readings (L9), so it
  stays a superset.
- **1.24 r6 D-I5** — `opts.after`: a pass the harness saw, then a failure recorded for the task elsewhere, then a pass REPORTED with
  no new run was stamped observed.
- **1.25.1 review 7** — **finding 10**: with the approval guard off one appended line forges an observed run — `observedWarning`,
  `observed-unguarded`. Both hooks.json entries made `"async": true` (Claude Code waited +60–190 ms after every Bash / PowerShell
  call). A WHOLE bracketed `_Verify:_` placeholder is taken out of the pre-filter's text: the scaffold's named `npm test`, so every
  `npm test` loaded the engine to log nothing (170 → 64 ms a Bash call, median of 15 on Windows — `node -e 0` 54).
- **1.27** — the project lookup is mcp/lib/probe.js `sessionProjects({cwd})` (the one rule `isDevSpecProject`, ≤ `SESSION_MAX_UP`
  levels). The hook used to take the nearest folder holding ANY `.specs/` at or above the cwd (≤ 40 levels — 12 before 1.24 r6 I2)
  and then test it with an inline copy of the rule, so another tool's `.specs/` in between hid the dev-spec project above it.
