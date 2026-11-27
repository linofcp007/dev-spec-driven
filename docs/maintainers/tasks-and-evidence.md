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
  `gated` / `gateError` when the bugfix gate would refuse it — 1.36: or +port's, with `heldBy`, the `[PORT]` tasks it waits for);
  `portRole` (`port` · `after`) + `differential` on a +port task (its definition-of-done rule, `brief.portRules`); `dependsOn` (see
  Task dependencies); the loop's definition of done. 1.41: two parts after Reuse — **Reference examples** (`briefExamples`,
  quality.js: structure.md's `## Reference Examples` rows for the task's `briefTargets` — the same paths briefSteering's
  fileMatch patterns match —, ≤ 6 rows / 1,200 characters, a gone file named never quoted: `examples`; quality.md →
  Reference examples) and **Lessons** (`briefLessons`, decisions.js: the feature's OPEN lessons, newest first, ≤ 5 / 1,200
  characters, the rest named — `lessons` {quoted, omitted}; `decisions` never quotes a lesson: lifecycle.md → Decisions and
  spikes). `write: true` keeps `refs.examples` {quoted, gone, total} and `refs.lessons` {quoted, omitted} only.
  Labels: the i18n `BRIEF` table + `renderBrief()`. Its IDs come from `taskProse()`. The default task is `taskSchedule()`'s next.
- **Steering still a template (1.42, UX-10).** An `always` / `fileMatch` file `briefSteering()` includes whose body is a
  built-in stub verbatim (`isSteeringStub` — any language, the corpus's hashes of the CURRENT stubs) or nothing but headings
  (`headingsOnly`) holds no project rule yet: its row in `steering.included` gains `template: true` and the brief lists it apart
  (`brief.steeringTemplates`, "Still templates — nothing binding yet"), never under "Read before coding" (`brief.steeringRead`).
  Its own predicate — never doctor's `steeringPlaceholders` (a placeholder left): a partly filled tech.md stays binding. Nothing
  goes absent (the row stays; the result's `included` is the parent's). Known limits: a stub an older engine scaffolded (≤ 1.25:
  another hash) or edited by one word reads as the team's text and stays binding; a project template whose text IS a built-in
  stub reads as one (the predicate is the text). It hashes text the brief already read — no new read (10-guards.js pins the
  same fs calls over stubs and over filled files). The SubagentStop gate and the brief's other parts do not read the list.
- **The plan's approval at the task surfaces (1.42, UX-02).** `spec_next_task`, `spec_task_brief` and `spec_status {name}`
  (`tasks.…`) carry `planApproved: false` while the plan is not approved — `planApproved()` (tasks.js) reads phase `tasks` (a
  change's change.md) by TRUTHINESS, the pending-gates rule (`pendingGateList`; `approvalsInForce` strips only `tests`), so
  next_task and next_action never disagree (the harness's `planGateMismatches` checks it on every fixture of
  08-tasks-plan-approval, 06-gates and 07-approvals); a spike has no plan gate; a role sign-off still waiting writes no
  `approvals.tasks`. When a task is SERVED (next's task, the briefed open task, status's next) the result gains `planNote`
  (`planGate.notApproved` — "this task is not to be implemented: show the plan to the user and ask for its approval") — its own
  key, never `note` (the evidence channel, pinned `undefined` on ticks by older tests); `spec_complete_task` that TICKS a task
  gains `beforeApproval: true` and `planNote` (`planGate.tickedEarly`) — never on an `alreadyDone` re-check or a failed run.
  Never a refusal (a tick records what happened). **The exemption:** a bugfix's investigation task (`bugInvestigationTask()` —
  kind bugfix, its prose names `bug.md`, no `_Makes green:_` / `_Verify:_`: it runs nothing and writes only bug.md, which the
  requirements / design approvals sign off) carries no `planNote` (`beforeApproval` stays a fact) — the four-task scaffold of
  ≤ 1.23.0 ticks 1 and 2 before the tasks approval by design (references/bugfix.md says so; it is kept word for word). Its own
  predicate: never `rootCauseTaskIndex`, `isBugStep` (the CURRENT short-form steps — its task 1 would lose the note) nor
  `LEGACY_BUG_STEPS` (a name list); it only READS the block (features with identical tasks.md may share one scan's blocks —
  DS-PERF's memo). The brief's markdown is unchanged (the controller decides the dispatch, not the subagent); the CLI prints
  the note on a "  ⚠ " line (`next`, `status <f>`, `done`), `brief` on stderr (stdout stays the brief). An approved plan's results
  are the parent's, byte for byte (the keys absent, not `true`). Known limit: an approved plan EDITED since its approval reads
  approved, as pendingGateList reads it (next_action asks for the re-review). No new read: `planGateFields()` builds the fields
  from the state the call already holds (08-tasks-plan-approval pins it and the equal fs calls of approved / unapproved twins).
- **Design sections** (bounded by `BRIEF_DESIGN_BUDGET`, 6,000 characters since 1.38: a view task keeps +ui's filled state
  matrix — `[UI] UI States`, ~2.7 / 3.7 / 4.7 KB at 1 / 2 / 3 views — beside the other `[UI]` sections, all five up to 2 views;
  the brief ~≤ 10 KB) match WHOLE IDs: an AC ID ends before a non-digit and never follows another
  feature's `x/`; a T-ID is read by its number (T-01 = T-1); a file needs a boundary on both sides (US-1.AC-1 is not US-1.AC-10).
  The task's own IDs fill the budget first, then the file / track ones, in design.md's order. A task proving a track's
  criterion takes that track's marked sections (`trackMarks`); 1.37: a `uiTask()` task — one that builds what the user sees —
  takes the `[UI]` sections whatever criterion it proves (the usage table, a contract under `## [UI] Component Contracts`,
  the states), in the same budget, AFTER every section another rule wants (`want()` → 2, read last in design.md's order;
  1.37.0 review 1): one that does not fit is named, never quoted. A task of the +ui feature that builds no view takes none.
- **A RED task's brief** (`_Expect: fail_`): its tests heading `BRIEF.testsRed` and definition of done `redRules`; its project-checks
  item is `projectChecks.briefDodRed` (only its new red tests may fail).
- **`write: true`** writes `.specs/<f>/.execution/` (self-ignoring: `.gitignore` = `*`): the brief regenerated, `ledger.md` created
  once and only ever appended by the controller. The result keeps identifiers (`refs`, `loop`, `inlineOnly`, `verify`, gate —
  `gated` / `gateError` / `heldBy` —, `portRole` / `differential`, `dependsOn`, `preflight`), the quoted spec text only with `includeBrief`. The PostToolUse hook exits early on
  `/.execution/` paths.
- **`preflight` (1.31)** — a boolean on every brief of a task: true at size m / l or no size (`featureSize()`), false
  for an xs change (`isChangeDir()`), size s, a spike (its tasks exist to make the decision), an `inlineOnly` task and a
  done one. On true the controller dispatches the critic in brief mode over `paths.brief` before the implementer
  (`references/subagent-execution.md` → Pre-flight the brief): the decisions the brief leaves open are settled from the
  spec, ruled (ledger / `spec_decide`) or sent back to their phase. The engine only says when; the controller branches
  on the key, never on the brief's text.
- **`uiReview` (1.32)** — the same base rule (`freshReviews`) and a UI task (`uiTask()`): a +ui feature's task that proves a
  `[UI]` criterion (`trackAcIds`), sits in the track's template block (`trackTaskHeadings("ui")` on `block.phase`) or names a
  view file in `_Implements:_` (`RE_VIEW_FILE`: markup, components, stylesheets, server templates — ERB, Razor, Blade,
  Twig, Handlebars, EJS, Pug —, Android `res/layout*/*.xml`; never `.ts` / `.swift` / `.kt` / `.dart`, which are as often
  logic, nor a bare folder — a glob of view files, `src/components/*.tsx`, is one); never a red `_Expect: fail_` task
  (it renders nothing yet). On true the controller runs `references/ui-review.md` after the task's `_Verify:_` is green
  and before the code review; its Blockers, and the Majors a fresh reviewer confirms, are fix rounds, and a later round
  that changes a reviewed view runs it again, in verdict mode (1.37): a Blocker / Major that pass reports — a regression or
  one missed earlier — enters the loop like any other (a Major confirmed first), a minor is deferred; so every finding a
  tick waits on can be fixed or, past round 5, parked. What it captures (1.38, ui-review.md §2): per view, each designed
  state at ONE width (the reference's, else 320) and the worst case at each of the project's breakpoints (at most 6,
  `spec_scan {designSystem}`'s widths) — states plus widths, never states × widths, an `n/a` state never; a view past the
  16-image dispatch splits, its states then its widths. A state's announcement and focus are its fixture test's to
  assert, never judged from an image (the reviewer gets no new mode: a width capture is a pair or floor by its files, so
  spec-ui-reviewer.md did not change).
- **The protocol is prose; the engine never dispatches anything** (it stays cross-tool): `references/subagent-execution.md` and the
  agents `spec-implementer.md` / `spec-reviewer.md` / `spec-simplifier.md` (from obra/superpowers, MIT, and Anthropic's
  `code-review` / `code-simplifier` plugins). The reviewer rates each Critical / Important finding 0–100; its **verify** mode judges
  ONE finding fresh (80+ opens a fix round, 50–79 is ledgered as unconfirmed, below 50 refuted); its **simplify** mode reviews
  `/spec-review simplify`'s diff; its **prune** mode (1.41) proposes the `same-path` / `no-kill` candidates of `/spec-review
  prune`, asks for the probes the controller runs and gives each a verdict — prune · keep · strengthen (the pass is prose end
  to end: the matrix says which criteria each test covers — never a criterion's last planned test, never a retired AC's test,
  which needs a `/spec-change` on its feature —, the record spec_impact's `retire` and, at guard level tests, the protected-test accept — no engine
  part; `references/subagent-execution.md` → The pruning pass, `test-patterns.md` → Test value and pruning); it checks the §5 written rules (constitution, CLAUDE.md / AGENTS.md, code comments) and the
  rewritten lines' history. **Lessons (1.41):** a fix round 1–3 asks the implementer each confirmed finding's cause (its
  report's `### Causes` block), the controller checks the three a file can show and records it with
  `spec_decide {kind: "lesson"}`; the finish batch amends the guidance once (§7b; lifecycle.md → Decisions and spikes — the engine's part is the
  entry, its readers and finish's warning). The engine's part: the SubagentStop gates (End-of-turn evidence gate). **1.28:** the final review,
  `/spec-review` branch / converge and the simplification pass start from the duplicate detector (`spec_scan {duplicates:
  true, name}` — quality.md → Duplicate-code detector): its `existing` runs are the reviewer's candidate findings, its `within`
  runs the simplifier's, each verified before it costs a fix. **1.42:** the task review too — §4 writes `dupes --json` beside the
  package, the reviewer keeps the runs in the package's files and says "none" only at `counts.existing` 0. A residue (a
  `pre-existing (deferred)`, an `unconfirmed (NN)` the final review let ship, a `parked (real)`) is filed as ONE
  `residue-<feature>` backlog entry and committed before `git switch` (Closing); a defect confirmed again at another place is
  asked for as a class in the task's `_Implements:_` files (§7). The `review-seat` evals measure both seats (testing.md).
- **`reviewPanel` (1.36)** — `roadmap.json → meta.reviewModels`, opt-in: 2–3 model names checked by SHAPE, never a list of
  known names (`RE_MODEL_NAME`: up to 128 characters — a Bedrock profile ARN —, a leading letter or digit, an optional `[1m]`
  suffix; `REVIEW_RESERVED` inherit / default / diverse / off / none; duplicates case-insensitive, stored as given), the word
  `"diverse"` (= `REVIEW_DIVERSE`, opus + sonnet — stored as the word, so a release can change the pair), off / `[]` deletes the
  key. Set only by `spec_init {reviewModels}` / `init --review-models` (guards.js `reviewModelsInput` validated BEFORE any write —
  `invalid-arguments` [reviewModels], a refused array echoed as JSON; the CLI word's names are its runs between commas / spaces,
  so a stray separator at either end is no empty name, and a word with none is refused —, `setReviewModels` inside the roadmap
  lock after `setApprovalGuard`); init always echoes
  the current list (`reviewModels`, `[]` = none) and a `reviewModelsNote` when it set it — or when the stored value doesn't read
  (`reviewModelsSetting`: `invalid` → no panel + the `ignored` note, never a roadmap shape error over an advisory setting;
  `[]` / `["off"]` are silent; `["diverse"]` reads as the word). doctor.js `reviewPanel(c)` → `{models}` in every doctor result
  (the lean one too) but an xs feature (a change — critic-review.md's xs row reviews nothing by default); a spike never gets
  there; next_action copies the lean doctor's (gates-and-approvals.md → next_action). Not a guard-down (nothing enforces
  it — the engine sees no dispatch); no per-task panel (the brief carries none: the final review on every model sees each
  task's diff). What runs per model is prose: `references/subagent-execution.md` → Review on more than one model (merge
  first, then ONE verify per merged finding in the code reviews — final / branch, converge; the panel adds models, never
  replaces a review's own tier; the task reviewer on the first panel model other than the implementer's that is at least
  standard, else `sonnet`; every path ledgers a `Final review: ×N` line — the finish sentence's exit; a task done inline
  writes no ledger line: after one, run the review again — and the branch review reads `merge-base..HEAD`: the feature's
  work committed first), `references/critic-review.md` §1 / §3 (the gate critics: the size table's on the session's model plus one per other panel model; their merged findings go
  to the user — gates have no verifier). mcp/tests/17-docs.js pins each file's wording of these rules.
- **Subagent cost (1.42 S9, report only — never a gate, a warning, a doctor entry or a blocker)** — engine/agents.js: what the
  plugin's own agents (`AGENT_ROLES` = agents/*.md, a property test) cost, per role: dispatches, assistant turns, tool calls and
  tokens (in, out, cache read, cache write). The log is `.specs/.execution/agents.jsonl` (git-ignored, beside timings.jsonl),
  one line of COUNTS per finished dispatch — {agent, id, model?, turns, tools, tokens, truncated} — written by `recordAgentRun`
  through evidence.js's appender (the write gate) and shape-checked on write AND read (an agent among the six, a
  `dev-spec-driven:` prefix dropped — a copied agent of the same name is the same role, as the stop gate reads it —, an id
  `^[\w-]{1,64}$`, counts safe integers ≥ 0, `truncated` a boolean — else the run is refused; a model kept only when it is a
  model id, else left out with the run kept: Claude Code's own `<synthetic>` is the LAST model of 62 of 3,000 real subagent
  transcripts); past 256 KB the newest well-shaped lines, up to half. `agentCosts` (spec_metrics' project `agents`, beside `friction`; never a feature's) keeps
  ONE record per id, the LATER in the log (a dispatch the stop gate sent back finishes again, its transcript a superset), and
  rolls them up per role (+ `truncated`: the dispatches read only in part — their counts a lower bound, said on the CLI line;
  `models`). **No time and no feature:** a transcript's first-to-last span is wait time for a resumed agent (9.5 % of 2,194
  real dev-spec transcripts span over an hour), and a dispatch prompt names its feature by a name, never an anchor the engine
  records (7.4 % name two or more). The recorder is Claude Code's: the observe hook's SubagentStop (1.42 S9-c — hooks.json's
  second SubagentStop entry, async; claude-code-integration.md → Hooks and commands) reads the agent's OWN transcript
  (`agent_transcript_path`, never the parent session's) in the hook — never the engine, which reads nothing outside the
  project — and hands over the counts; an MCP-only host records nothing. **What the reader counts** (hooks/observe-hook.js
  `agentRunOf`, a regular file only, ≤ 32 MB): the assistant lines alone — turns the distinct message ids (one line per content
  block, each repeating its message's usage), tokens per id the per-field MAX of its lines (a streamed `output_tokens` grows
  line by line: never the first line nor a sum) summed over the ids, tool calls per LINE, the last model; a line Claude Code
  wrote itself (`isApiErrorMessage` — an API error, model `<synthetic>`, zero usage) is no turn and never the model. The id is
  the transcript's file name without `.jsonl`; a transcript with no assistant turn records nothing.

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
  server and the engine never run a command or git: the engine judges the output and records the evidence. The trust is an npm
  script's: a project check ADDED, or a `_Verify:_` added or edited (`spec_init {checks}`, `spec_append_tasks`, an edit of
  tasks.md — a spec document the agent may edit), is no guard-down; changing or removing a project check is one (guards.js
  `initGuardDowns`). `--run` runs what roadmap.json / tasks.md hold at that moment, and the CLI prints each command
  (`$ <command>`) before it runs it.
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
  nothing. **The diff base (1.33):** a guardian check runs with `DEV_SPEC_DIFF_BASE` = `guardianDiffBase(state, git)` — the
  feature's branch record (`create --branch`): the branch it was created from, as `refs/heads/<base>` (never a tag of that name:
  rev-parse prefers refs/tags), else the commit it started at; without a record the repository's default branch (origin/HEAD's
  when it resolves — a remote default renamed leaves it dangling —, else a local main / master: cli/git.js `diffBaseFacts`) while
  HEAD is on another branch. The first a plain ref name git resolves to a commit (a ref git can't read would turn the gate into
  exit 3) is passed — NEVER skipped for being HEAD's commit: dev-guardian diffs from that ref's merge base with HEAD to the
  WORKING TREE, untracked files included, so a branch still at main's tip with its work uncommitted (what an agent leaves) is read
  through it. The one exception is chosen by merge base, not by commit equality: a base that already CONTAINS HEAD (`ancestor(head,
  base)` — main moved to HEAD by `git branch -f`, a `--no-ff` local merge of the feature, where main ≠ HEAD) would hide the
  feature's commits, so the recorded start commit goes instead when it differs from HEAD and is its ancestor; otherwise the base
  still goes. (`diffBaseFacts.ancestor` = `git merge-base --is-ancestor`, commit ids only.) A ref passed that still contains HEAD
  (no record, no usable start commit, a branch with no commit of its own) reads ONLY the uncommitted work: `uncommitted: true`, and
  finish --run hands that word to the verdict (the evidence item's `diffBaseUncommitted`, CLI runs only — guardianRecord's last
  argument; stored as `diffBaseUncommitted`), whose head line says `guardian.diffBaseUncommitted` ("only the uncommitted work
  checked … (main already holds this branch's commits)") instead of "the change since main". **Known cost:** a feature rebased,
  then merged, then finished again passes its recorded start commit — no longer on main's line —, so the read includes other
  features' commits since then (more findings, never fewer); re-running finish after a merge is the rare path. None: the variable
  is CLEARED for the run (finish --run alone sets it). The launcher passes it on as `--diff-base` to a dev-guardian
  3.8.0+ (claude-code-integration.md → The dev-guardian launcher). Over MCP the agent runs the check itself: no diff base unless
  it sets the variable.
- **dev-guardian's gate — the check `guardian` (1.29; engine/guardian.js since 1.30).** `spec_init {guardian: true}` / `init
  --guardian [on|off]` (an optional-value CLI flag, bare = on) folds `{guardian: GUARDIAN_COMMAND | ""}` into the checks input
  (`guardianChecks()`) — the meta.checks rules unchanged (merged, validated, ≤ 20, the control-character refusal). On: the
  launcher `.specs/guardian.cjs` is written FIRST (`guardianLauncherOn()` → `setGuardianLauncher()`; `GUARDIAN_LAUNCHER`,
  rewritten when it differs, a CRLF copy equal): a path the write gate refuses (a folder, a link) returns its refusal before
  meta.checks is written, and a launcher this call created is removed again when meta.checks can't be written (atomic). Off:
  meta.checks first, then the launcher removed (only the generated one: `GUARDIAN_MARK`). `GUARDIAN_COMMAND` = `node
  .specs/guardian.cjs scan --project . --fail-on high --format json`: no versioned path, no shell syntax
  (claude-code-integration.md → The dev-guardian launcher). `init`'s result always carries `guardian` (does a check run the
  gate), `guardianNote` when it changed it — on: `guardianOnNote()` = project-wide (committed; every machine that finishes
  needs dev-guardian and its scanners), never `baseline update` to accept a finding, + `initBaseline` while
  `.guardian/baseline.json` is absent (the user records it now, on the base commit: `node .specs/guardian.cjs baseline update
  --project .`) + `initIgnore` with the `.gitignore` lines dev-guardian's block writes that the project's `.gitignore` lacks
  (`GUARDIAN_IGNORE` = `**/.guardian/*` + a negation per `GUARDIAN_SHARED` — dev-guardian 3.3+'s `SHARED_GUARDIAN_FILES`, in its
  order: baseline.json, budgets.yml, hooks.config.json, hooks-allowlist.json, scan.yml; a test holds the list to that set and
  runs `git check-ignore` over it; older spellings read as present — dev-spec never writes outside `.specs/`). The approval guard reads the
  same map (`initGuardDowns`): removing the check, or replacing another command named `guardian`, is a guard-down whose command
  is `init --guardian off|on`; `--guardian` is in `RE_APPROVAL_VERB` (mcp/lib/probe.js — the hook's pre-filter too). Its other dev-guardian rules
  (the launcher, the baseline, `baseline update`, a `DEV_GUARDIAN_CLI` of the command's own): claude-code-integration.md.
  - *Which check is it:* `isGuardianCheck(name, command)` — the name `guardian`, or a command naming `dev-guardian[.mjs]` /
    `guardian.cjs` followed by `scan`.
  - *Its run:* `recordFinishChecks` takes the evidence item's optional `report` (the JSON stdout; MCP schema `report: string`;
    never stored) and, from `finish --run` only (`ranBy: "cli"`), `stderr` (the raw stderr, its last 64 KB — never stored; MCP
    can't pass it: nested keys are validated) — else the summary is the output read. It stores `finishChecks[name].guardian` =
    `guardianStored(guardianRecord(projectDir, dir, command, exitCode, report, output))`: `{verdict, exit, failOn (the command's
    --fail-on, else high), parsed, newFindings? (the report's `new_findings_count` — `--compact` —, else `new_findings`),
    blocking?, own?, top? (≤ 5: {severity, rule, file, line, own} — the feature's `_Implements:_` files (`baselineFiles`) first,
    then severity, then the report's order), gaps? (≤ 3, each whole up to `GUARDIAN_LINE_MAX` 1000 characters, then cut at its
    end with "…" — `wholeLine`; review 12 R2: at 200 the "changed since BASE" at a line's end was lost), gapDetails? (the gating
    `coverage_gap_details`, ≤ 5: {tool, kind, remedy?, changed? — a timeout on a file accept_timeouts lists that changed since
    (`acceptChanged`): dev-guardian 3.4.0's `cause: "accepted_file_changed"`; a report without `cause`, a `file_timeout` whose
    detail or reason says so — `RE_ACCEPT_CHANGED`; a `cause` of another value wins over the wording}), accepted? (`accepted_gaps` — 1.30.2: {timeout, parse,
    other}: distinct files a per-file timeout accepted in `.guardian/scan.yml` left unanalysed · files a
    `--accept-partial-parse` left partly parsed · other accepted gaps. Each line is read from its `accepted_gap_details`
    entry at the same index (dev-guardian 3.4.0: `{tool, kind, file, reason}`, one per line, in order) when that entry is a
    record with a kind — else, 3.3.x or an entry missing, from the line itself: dev-guardian's two shapes, gate.ts
    `judgeMissing`'s; another shape is one gap — `acceptedGaps`; a file in one spelling, `acceptedFile`), acceptedOwn? (review
    12 R1: those files that are the feature's own `_Implements:_` files — the `own` set behind `[this feature]`, read lazily
    (`mine()`): `{count, files ≤ 3: [{file, kind}]}`), notes?
    (`coverage_notes`, 3.4+: their count), staleTimeouts? (`unused_timeout_acceptances`, 3.4+: `{count, files ≤ 3}` — distinct
    accept_timeouts entries no step reported a timeout on), testIntegrity? (1.41.0, W — `integrityFindings`: the `new_findings` of
    dev-guardian's own passes, `GUARDIAN_INTEGRITY_KINDS` — `guardian-test-integrity` → kind `test`, `guardian-suppressions`
    (3.17, `GUARDIAN_SUPPRESSIONS`) → kind `suppression` — whose severity is under the command's LAST `--fail-on` (`failOn`,
    as dev-guardian reads it — review 2; of the FIRST segment that carries one, the command cut at `;` / `&&` / `||` / `|` / a
    line break: a later `echo --fail-on low` is not dev-guardian's — review 3 —, nor a prefix, `cd . &&` / `chcp 65001 >NUL &&` —
    RX2-1; a property of the text, never a name list, so `echo --fail-on low && <check> --fail-on medium` reads low, as 1.40
    did; `severityRank`: dev-guardian's own blocking rule, gate.ts; unknown → under every
    level) and that is not one of the report's `blocking_findings` (by rule + file + line, `blockedFacts` — review 1: dev-spec
    read the first `--fail-on`; dev-guardian also unquotes a shell-quoted one dev-spec does not read):
    `{count, top ≤ 3: [{severity, rule, file, line, kind}], kinds}` (`kinds`, review 1: the kinds among ALL of them — the
    warning's head names those checks —, plus `suppression` while a `coverage_notes` line starts `guardian-suppressions: `, the
    pass having left changed files unread — review 2, RX-7), by severity then the report's order; no fs call — `findingFacts` is
    the blocking items' reader, `mine()` never runs for it; a `--compact` report lists only the blocking findings, so none is
    read), message?,
    baseline? ("absent": `baseline_absent` / `baseline_status`), tool? (`tool_version`), update? (no
    `tool_version`, one below `GUARDIAN_MIN_VERSION` 3.2.1, or "Cannot find package" — 3.2.0 from a plugin install), override?
    (the `DEV_GUARDIAN_CLI` the launcher said it ran)}`. Every scan step repeats a non-gating line under its own name
    (`security_scan_full: …`, `map_attack_surface: …`): `distinctLines` reads each fact once, without its step. The lines
    themselves (`acceptedLines` / `noteLines`, ≤ 3 each, + `acceptedMore`) are for finish --run's output — never stored
    (`guardianStored`). `unused_partial_parse_acceptances` is not read (the acceptance is on the check's own command). Every report-derived text is one inert line (`cleanLine`: line breaks
    folded, control characters spaces — review 8: a `file_path` holding "\n## Approved…" wrote lines into the merge summary;
    the bidi controls and the zero-width space dropped — U+200B, U+200E–U+200F, U+202A–U+202E, U+2066–U+2069, 1.41.0 review
    1, `RE_REPORT_FORMAT`, tested first; ZWNJ / ZWJ kept, review 2: they spell names, a Persian word, an emoji sequence; the `own`
    set reads each `_Implements:_` file through `cleanLine` too, so a name holding one still matches the report's).
    Verdicts (stable): `pass` (0) · `blocked` (1) · `incomplete` (2) · `config` (3, dev-guardian's own "error: …" /
    "dev-guardian: …" lines — never the launcher's DEV_GUARDIAN_CLI line) · `not-found` (3 + the launcher's "dev-guardian not
    found") · `no-launcher` (a run of `.specs/guardian.cjs` while it is missing, any non-zero exit; or 1 + node's "Cannot find
    module … guardian.cjs") · `exit` (any other). `guardianJson()` reads the report tolerantly (a BOM, ≤ 16 MB, the gate's
    shape; else each line starting with "{" — ≤ 8 — read to its balanced end: braces in the text around it don't hide it) —
    unreadable: the exit code alone (`parsed: false`). `suiteStatus` items carry `guardian`, `recordedChecks[]` its `verdict`;
    the status rule is unchanged (a non-zero exit is `failed`).
  - *Refused, all-or-nothing, nothing recorded* (`guardianRefusal` → `{error, code}`; spec_finish returns the `code`):
    `launcher-changed` (a run of a `.specs/guardian.cjs` that is neither this version's launcher nor an earlier one's —
    `guardianLauncherState`) · `no-launcher` (a pass while it is missing) · `report-mismatch` (the report's `exit_code`
    differs from the exit code, or exit 0 with blocking findings — review 8: `{exitCode: 0}` with a report saying exit 1 and a
    critical finding passed) · `report-missing` (exit 0 of a `--format json` dev-guardian scan with no readable report — a pass
    is never an exit code alone). An exit code never wins over the report it came with.
  - *`--compact`* (dev-guardian 3.3+): a run of the check's command + ` --compact` proves the check (`guardianCompact` →
    evidence.js `checkProof`, in `suiteStatus` and the observed stamp) — the short report an agent can pass over MCP.
  - *What surfaces say:* `suiteLabel` gives a failed guardian item its verdict (`guardianText`: the head — + "no baseline", +
    the DEV_GUARDIAN_CLI it ran, + the accepted gaps ("N file(s) not analysed (accepted in .guardian/scan.yml)" · "… only
    partly parsed (accepted with --accept-partial-parse)" · "N other accepted gap(s)", `guardian.accepted`; + the feature's
    own among them by name, "src/big.js is this feature's and was not analysed (accepted timeout)", `guardian.acceptedOwn`) — + 3 findings +
    "update dev-guardian"); the merge summary's check line too, + the notes counted (`guardianText(g, lng, true)` →
    `guardian.notes` — the merge summary only, never a blocker: taint notes come with most real scans). An accepted gap never
    changes the status (the exit code decides it). `suiteBlocker()`
    (finish's `suite-evidence`) lists the other missing checks as before and a failed gate apart — `guardian.blocker` + how to
    clear it (`fixHint`: fix it; ONE reviewed finding suppressed inline with a reason — never `baseline update`, which accepts
    every current finding, the feature's own included; a test-integrity finding takes no inline suppression — restore the
    test, or the user decides, an approved pruning blocking at `--fail-on medium` by design (RX2-3); never forced · +
    `baselineHint` with no baseline · an incomplete scan by
    its gaps' kinds — `incompleteHint(g)`: install only a `missing_tool`, a lockfile for `no_lockfile`, a Semgrep `file_timeout`
    → `gap.timeout` (dev-guardian's own remedy, localized: a larger `semgrep.timeout`, or the reviewed file under
    `semgrep.accept_timeouts`, in the committed `.guardian/scan.yml` — whose settings are Semgrep's); a `changed` one (listed,
    changed since — never "list it there") → `gap.timeoutChanged` (review the change by hand, or raise semgrep.timeout) +
    dev-guardian's own remedy, unless that remedy says to list the file (`RE_LIST_REMEDY`); a distinct kind dev-guardian might
    give that case without the cause reads as `other`; …, dev-guardian's
    `remedy` for the rest (another scanner's timeout, `taint_timeout`, `scanner_failed`, `skipped`, `other`), the generic
    `incompleteHint` without details · `updateHint` · `configHint`); a guardian check still
    needing a run adds `guardian.mcpRun` (Claude Code: `finish <f> --run` with the Bash tool's 600000 timeout or in the
    background — it records the report itself; elsewhere run the command, `--compact`, report it with `report`; W's findings
    come only from a run with the feature's base, which only `finish --run` hands the launcher (`DEV_SPEC_DIFF_BASE`), so a
    run reported this way names none — review 2, RX-1: review 1's "a full report names them" was false). next_action's
    `finish` / `verify` steps append the same (`suiteGuardianHint`). spec_finish's `warnings` say "update dev-guardian"
    and, for a pass with accepted gaps, the feature's own among them by name — "… — review it by hand" (`acceptedOwnWarn`:
    the gate runs without a ref, so a file accept_timeouts lists stays accepted whatever the feature appends to it; a warning,
    not a blocker — dev-guardian refuses a listed file that changed since scan.yml did) — and that those files go unanalysed —
    review a change to them by hand (`acceptedWarn`),
    and, on any verdict, the stale accept_timeouts entries — remove them, or a future timeout on that file is accepted unseen
    (`staleTimeouts`: an entry never expires) — and, LAST (the finish batch's order: dev-guardian, W, …), on any verdict, W's
    ONE line (`integrityWarning` → `guardian.integrityWarn`: the count, `--fail-on`, the top 3 each labelled by its pass —
    `guardian.finding`'s fifth argument is a kind, `test` · `suppression` · none, never one label for both —, the rest counted;
    the head names the one check `kinds` holds, else both — `integrityWarn`'s fourth argument, review 1: a dev-guardian before
    3.17 has no suppressions check; the first guardian check that has one) — warnings, never blockers (`guardianWarnings`). The merge summary and finish
    --run's own lines are unchanged ("(N new below it)" still counts every new finding below the bar).
  - *finish --run* (cli/run.js): `guardianPreRun()` first — a guardian check that runs the launcher needs this version's
    (an earlier version's is rewritten, with a note; missing → `no-launcher`, anything else → `launcher-changed`: refused before
    anything runs, nothing recorded). For a guardian check it prints `guardianLines()` (the head, the findings, then each
    accepted gap's and note's line as dev-guardian wrote it — `acceptedLine` / `noteLine`) instead of the output's last lines and
    passes `report: stdout`, `stderr` and `summary: summarizeRunOutput(stderr)` (`runCommand` returns stdout / stderr apart).
  - *The offer:* `guardianOffer(projectDir, lng)` — dev-guardian installed (`guardianCli(env, cwd)`: the launcher's own
    function — installed_plugins.json, else the cache) or `<project>/.guardian/` a folder, and no check runs the gate →
    `guardian.offer`; `initProject` (`guardianOffer`, when `guardian` wasn't given) and `specUpgrade` (`guardianOffer`, a project
    line in `upgradeLines` / UPGRADE.md) — never SessionStart, never set. `specUpgrade` also flags a launcher that is not this
    version's (`guardianLauncherAudit` → `guardianLauncher`, `plan.guardianLauncher`) and `--apply` writes it
    (`migrations.guardianLauncher: "written"`).
- **Git-linked evidence** (CLI only, read-only — `gitRun` / `gitState`): a `--run` records `{commit, dirty}` (`dirty` ignores
  `.specs/` and — 1.30 — dev-guardian's report sets, `.guardian/reports/`; skipped without git; a malformed value dropped,
  never an error — `gitEvidence()`), tagged `@sha` / `@sha-dirty` in the merge summary. `parseGitLog()` + `taskCommits()` read git log TEXT (the MCP server stays exec-free); `dev-spec log <feature> [--max
  N] [-]` feeds them. A commit message cites task N when it names the feature (its slug as a word) AND "task #N" / "task N" / "#N"
  (PT "tarefa N", ES "tarea N"), and every task naming one of its T-IDs (`T-01` = `T-1`) or AC IDs — unless it names only another
  feature. +tdd red-first: a `_Makes green: T-xx_` task cited before the first commit touching a test file naming T-xx warns; a full
  `--max` window makes an unknowable order `outside-window`.
- **The fast check (1.36, warn only)** — `roadmap.json → meta.fastCheck`: the NAME of one `meta.checks` entry the agent runs on its
  own after each small edit (evidence.js, beside the project checks). **Set:** `spec_init {fastCheck}` / `init --fast-check
  <name|off>` (`fastCheckInput`: `""` / off / none delete it — a check named off / none can't be one; a non-string is refused
  before any write, `invalid-arguments` [fastCheck]); `fastPlan` runs under the roadmap lock after `checksPlanError`, against
  `nc.merged` (the checks THIS call leaves — `--check tc="…" --fast-check tc` is one call): a name that is no valid check, the
  guardian check (`isGuardianCheck`) or a command that rewrites files (`fixerCommand`, a heuristic the docs state as such: a
  `--fix` / `--fix=…` / `--write` word, or a `*fmt` / `*format` program or subcommand — never a flag, an `@alias` or a
  check- / lint-named script — with a `-w` word (it writes, whatever check flag stands beside it: `gofmt -l -w`) or with no check
  word: `--check` / `-check` / `--check-…`, `-l`, `-d`, `-n`, `--diff`, `--dry-run`, `--verify-no-changes`, `--lint`, `--validate`,
  `--test`, `--exit-code`, `--output=none`, or swift-format's own `lint` subcommand, `RE_LINT_MODE` (`swift format lint` /
  `swift-format lint` only — any other `fmt lint` is a target list or a script's argument: refused, the documented default);
  those words read in the formatter's own simple command, `fixerSegment` over the command split on `&&` / `||` / `;` / `|` — a
  `$(… | …)` before the check flag splits it there: refused, the documented limit) is refused, nothing written;
  the stored one is checked again when this call replaces its check's
  command and goes when this call removes its check (`cleared` note). With `guardian: true` the same plan runs once BEFORE the
  gate's launcher is written (unless roadmap.json doesn't parse — the lock's refusal stays) — a refused init
  leaves nothing behind. `setFastCheck` sits between `setApprovalGuard` and `setReviewModels`; init echoes `fastCheck` (the
  stored name or null) and `fastCheckNote` when it changed it — or, when the stored value is one no fast check reads,
  `doctorInvalid`'s text (ignored, as reviewModels' `ignored`). **Read:**
  `fastCheckOf()` → null · `{name, command}` · `{invalid, why: missing | guardian | fixer}` (a hand edit) — doctor's own
  project-level entry `fast-check` (warn, beside `observed-unguarded`; never one per feature's evidence). Not a guard-down:
  nothing is enforced. **The status at a CODE task** (`fastTask`: `taskMarkers(b).implements` non-empty — the slot dropped —, no
  spike): `fastCheckStatus()` reads the project log (`.specs/.execution/observed.jsonl`) for the latest run by its `at` of the fast
  command (`runProvesVerify(…, [command])` — the check as ONE command; > 5 min ahead ignored, `FAST_SKEW_MS`) and the newest mtime
  of the feature's planned files (`baselineFiles` of the active tasks, the set `suiteCodeStamp` hashes; missing files and dates
  > 5 min ahead ignored) plus the task's OWN `_Implements:_` files, always (`baselineFiles` takes an array of references — read as
  `implementsRefs` reads them: backticks off), past `BASELINE_CAP` — the planned walk's files passed as `known` (no second
  realpath check) and dated once, its glob and folder listings the call's memoized ones (1.36.0 review 2: a second walk doubled a
  big glob's brief; `09-evidence-fast-check` COUNTS it since 1.40 — the brief and next_task with the fast check make, under the
  project root, the fs calls of the call without it plus the planned walk's and one open more, the observed log's (1.41.1: and
  the read gate's two lstats and one realpath of its path); a 2.5× timed backstop beside, testing.md → Adding a test) → `clean` · `stale` (run older than an edit) · `failed` ·
  `missing` · `unknown` (`observedAny` false: no harness log — no note); `partial: true` when the planned set stopped at its cap
  (no other status, no note). A file date is never a blocker (gates-and-approvals.md), so this only ever warns. The log line's
  `tool` (the observe hook passes it for a PowerShell run only) gives `pwsh`: the latest run came from the PowerShell tool, whose
  passes are logged only with an explicit exit code — `readObservedLog` is unchanged. **Surfaces:** `spec_next_task` →
  `fastCheck {check, command}` for a code next task; the brief of an OPEN code task → `fastCheck {check, command, status,
  partial?}` (kept under `write: true`) and its
  definition-of-done line after the project checks' (`fastCheck.briefDod` / `briefDodRed`: run it ALONE, the report form with
  the command in a code span — `verifyRunCodes` then gives its exit code to that span, never to the `_Verify:_` run above);
  `completeTask` judges it when the call TICKS a code task — before the first write (its window ends at the previous
  `lastTickAt`) — returns `fastCheck {check, status, runs, clean, partial?}` with `fastCheck.tickNote` on stale / failed /
  missing (it names no command but the fast check — the task is ticked, and a done task's brief carries no fastCheck, so its
  `done --run` runs none; the PowerShell sentence on missing or `pwsh`), and
  stores that snapshot on the tick's RUN (`ev.fast`; `runOf` keeps `fast`, so its history and the merge driver carry it; a
  note-only tick stores none; `normalizeEvidence` never takes a caller's). No key on any other task, a re-check of a done task,
  or a spike. **`done --run`** (cli/commands.js) runs it FIRST while `b.fastCheck.status` isn't clean, or is clean on a `partial`
  set (past the cap an edit to another task's file reads clean — 1.36.0 review 2) — never when a `_Verify:_`
  command proves it (that run is logged instead, at the run's start) — through `RUN.preRunRefusal` (finish --run's shell rules,
  one helper of cli/run.js), logs it with `spec.observeRun(…, {event: "cli", at: <its START>})` (an edit it makes reads stale), and
  only warns on a failure or a run that couldn't happen. **Metrics:** `featureMetrics` → `fastCheck {check, runs, clean,
  cleanRate, ticks, ticksClean}` from each task's latest run carrying `fast` (the record, then its history) — only a task ticked
  now (an undone tick is none), never an `unknown` snapshot; the project's
  `totals.fastTicks` / `fastTicksClean` — never project run sums (each feature's window reads the same log). **The offer:**
  scan.js `fastCheckCandidates()` (root files only — `projectFileInside`, `readFileHead`; no walk) → evidence.js
  `fastCheckOffer()` `{name, command, from, note}` in init (none set and none given) and spec_upgrade (`upgradeLines`, UPGRADE.md).
  Known limits (verification.md says them to users): a hook-logged run's `at` is when the async hook wrote it (after the run
  ENDED, ~0.2 s later — an edit during it or right after it reads clean); a planned file deleted after the run is no edit; a
  log line records no folder (a subfolder's or another worktree's run of the same command counts); past `BASELINE_CAP` only
  the first files and the task's own are dated (`partial`); a clone re-dates every file (stale notes); test files planned only
  by T-ID are outside the planned set (finish's suite-evidence is the net); a lost log line (a concurrent trim) can only lose
  evidence.
- **The friction budget (1.41, report only — never a gate, a refusal, a doctor entry or a size rule)** — engine/friction.js: how
  long the project checks take in the dev loop against the budgets steering states. **The log:** a git-ignored, bounded
  `.specs/.execution/timings.jsonl`, one line per measured run of a check — `{check, checkCmd, exitCode, ms, at, by: "cli" |
  "hook", tool?}` — written by `recordTiming(projectDir, run)` (→ `{timed: [names]}`) through evidence.js's ONE appender,
  `appendLog` (the folder's `.gitignore` first: after an MCP-only user's first `finish --run` the log is the folder's first file).
  A run is a check's only as the matcher reads it, the check as ONE command (`runProvesVerify(…, [command])` — never observeRun's
  plain-step fallback: one step's time is no check's; a piped, chained or joined run is none), after observeRun's `cd <root> &&`
  strip (`stripCdPrefix`, the run's roots); `run.check` (finish --run) names the check it ran. `ms` is rounded, 0 –
  `FRICTION_MAX_MS` (24 h), else nothing is written; `.specs/` is never created. **Writers:** cli/run.js `execCommand` measures
  `ms`, the monotonic clock from the spawn to the command's EXIT (never the `RUN_DRAIN_MS` drain a background process adds),
  returned through `runCommand`; `finish --run` (`runChecks`) times each check after the could-not-run refusal; `done --run`
  forwards `ms` on its two `observeRun` calls (the fast pre-run, a `_Verify:_` that IS the fast command — timed once, there) and
  calls `recordTiming` for every other `_Verify:_` command (a line only when it is a check's run); observeRun calls
  `recordTiming(…, {by: event === "cli" ? "cli" : "hook"})` when the run carries `ms` (its result then adds `timed`) — the
  observed `entry` stays 1.40's byte for byte; the observe hook passes the payload's `duration_ms` (Harness-observed
  evidence). Nothing stores `ms` in `.state.json` (cut: per-machine churn nothing judges). **The trim** (`trimTimings`): past
  `TIMINGS_MAX_BYTES` (64 KB) the log keeps, per check meta.checks holds now, its newest `FRICTION_KEEP` (10) PASSING lines
  stamped with its current command — failed runs, a changed command's lines and a removed check's go; per check, never by
  newest bytes (the fast check, run after every edit, would push the suite's few runs out). Read 4 × the cap at most
  (`readLogTail`, observed.jsonl's tail reader generalized), once per engine call (`readTimings`: memoized in the read-cache
  scope — spec_upgrade runs next_action per feature; recordTiming drops the memo). **The budgets** (`frictionBudgets(projectDir,
  checks?)` → `{budgets: [{check, ms, line}], invalid: [{line, text, why}], truncated}`): `_Budget: <check> <duration>_`
  markers of steering/tech.md (the call's read cache), read by tasks.js's span reader under its own label (`labelMarkerSpans`
  → `scanMarkerSpans(s, open)`: one closer grammar — the task markers never read the label, nor it theirs) on `scanTaskLines`'
  visible lines (no fenced or indented code, no HTML comment), anywhere on a line; `<check>` a meta.checks name (backticks
  allowed), text after the closer a comment; `parseDuration`: ≤ 6 digits, ≤ 3 decimals, `ms · s · m / min · h`, any case, 1 ms
  – 24 h. Readings: a check + a duration → a budget · a check + anything else → `duration` · another check-shaped name
  (`validCheckName`) + a duration, or + words whose LAST is a duration (`endsInDuration`: a command where the check goes,
  `_Budget: npm test 2m_` — 1.41.0 review 1) → `no-check` · a second budget of one check → `duplicate` (the first counts) ·
  anything else silent (`_Budget: $500/month_`, `npm 2m test`, a backticked command, a bold label). Bounds, each said
  (`truncated`): `BUDGET_TEXT_MAX` (256 KB), `BUDGET_MARKERS_MAX` (20). **The verdict** (`frictionStatus(projectDir,
  lng)`): per check its newest `FRICTION_RUNS` (5) passing lines in FILE order (no clock) whose `checkCmd` is the check's
  command now — a string compare, no matcher at read time (the designed per-line matcher cost 10–30 next_action calls on a
  worst-case log); the median (an even count: the two middles' mean), ≥ `FRICTION_MIN_RUNS` (3) to judge → statuses
  (stable) `over` (median > budget: the boundary is within) ·
  `within` · `few-runs` · `no-runs` · `unbudgeted`; `null` with no check, or with no budget, no unreadable line and no run; its
  invalid lines carry their localized `message`; not enumerable: `read` (the bytes read — the cost guard's count).
  **Surfaces:** spec_metrics' project view `friction` (finish.js `metrics`; `frictionLines` its CLI lines) — never the feature
  view; next_action's `finish` step, its LAST hint (doctor.js `tasksStep`, after the panel, port and project-check lines; never
  `implement`): `frictionHint(projectDir, lng)` — each `over` check that neither a backlog entry nor a feature folder (active or
  archived — `locateFeatures`; spec_create prunes the backlog entry it fulfils) answers to as `friction-<check>`, by slug →
  `friction.naHint` (the `backlog add` line per check; or the user raises / removes the budget) and `res.friction {over: [{check,
  medianMs, budgetMs, runs}]}`; without meta.checks it reads nothing, without a `_Budget:_` line only tech.md (the read cache).
  The engine never files the item. No `.state.json` / roadmap.json key, no merge rule, no tool argument, no tools/list or
  SKILL.md byte. Known limits (verification.md says them): per machine; a worktree's own CLI runs stay in its log; nothing over
  MCP; failing runs never count; a contended run (a parallel wave) counts — hence "≥ 2× a quiet run"; a tech.md with
  `inclusion: always` governs, so a budget edit re-flags approvals.
- **Pipes** — `verifyPipeMasked()` (a small shell lexer) flags an unquoted single `|` (also `|&`, inside a subshell or a `bash -c` /
  `sh -c` / `pwsh -Command` / `cmd /c` script); never `||`, a quoted or escaped pipe (`\|`, `^|`), `>|`, one inside `$(…)` or
  backticks; only a `set -o pipefail` BEFORE the pipe (or `-o pipefail`) silences it. Surfaces: the brief's `verifyPipes`, `done
  --run`'s hint (stderr under `--json`; it still runs), doctor `verify-pipes` (warn), `spec_complete_task`'s `pipeMasked: true` —
  the verdict doesn't change.

### Metrics that regress silently (1.41, engine/metric.js)
- **The line is a contract, `metric-lines/1`.** `METRIC_GRAMMAR` = the fixture's `grammar.line` (mcp/tests/fixtures/metric-lines.v1.json,
  byte-identical in dev-guardian 3.17 — testing.md); 17-docs pins references/verification.md's quoted line to it. `metricLinesOf(text |
  [texts])` passes the fixture case by case (09-evidence-metrics) and the points it leaves open, which both readers follow
  (the round's DECISIONS 3b — History, 1.41.0) and, where the fixture is silent, dev-guardian 3.17's metricLine.ts (review
  1's seven shapes, each a "parity with dev-guardian 3.17 metricLine.ts" test): the keyword at a line's start after blanks,
  then at most one `# ` — never blanks after it —, then a blank or the line's end (`RE_CANDIDATE`, after CSI sequences are
  removed — `RE_CSI`, ESC [ … a final LETTER: `ESC[2~` stays in the line); a line ends at its LF or the text's end, ONE CR
  before either dropped; a bare `METRIC` is a candidate (counted toward the 1,000, ignored) —, an ATTEMPT is a first token
  holding `=`, a failed one `malformed` (counted,
  the last one kept for the note, control characters folded), anything else ignored and uncounted; tokens split on runs of
  blanks; the unit only right after the number, ≤ 16 CODE POINTS (`unitFits`, the reader and readingOf alike; its length
  guard a cost guard — no array for a long unit) (a bare word elsewhere, a known key twice, a negative tolerance:
  malformed); unknown keys ignored; names in a Map (`__proto__` is a name); ONE leading U+FEFF of each text dropped (a stream
  starting with a UTF-8 byte-order mark, as dev-guardian 3.17's file decoding drops it — a second one or one mid-text stays;
  built with 0xfeff, never a literal; RX-3 — the stream printed second's too, which a `2>&1` capture holds mid-file, where
  dev-guardian reads nothing: verification.md → One stream per name says so, R3-A-2, RX2-4). Each reading carries `text`, its number as
  printed, and its tolerance its own `text` (the judge's inputs; what the warning, `## Metrics` and a tick's line show).
  **The walk** — from the END with `lastIndexOf`, never a split: `lineStartOf()` scans back over blanks, `#` and CSI sequences
  only (any final byte: a superset of RE_CSI's — a pre-filter; an earlier `METRIC` stops
  it at its `C`, so two scans never cross and the whole walk is linear), with no candidate floor; the line is then read to
  its LF ONCE (only a line's first keyword can follow nothing but blanks, `#` and CSI), its CSI removed, and RE_CANDIDATE
  decides — a `#` run of any length is no candidate. The removal stops once the bound is passed (`visibleLine`, 1.41.0 review 2: a
  long coloured line was stripped whole first): a line of ≤ 4,096 units is cleaned whole; a longer one its head to the keyword's
  end whole (no sequence crosses it), then 4,096-unit chunks — each cut before its last ESC, a chunk starting with its only ESC
  reading that sequence alone (`RE_CSI_AT`, sticky) — until the text holds more than 512 units AND a character past the keyword:
  over the bound, and RE_CANDIDATE reads the same characters as on the whole line. **The bounds, one set (`METRIC_BOUNDS` =
  the fixture's):** the last `readBytes` CHARACTERS of the output (run.js caps bytes; a character is ≥ 1 byte — and since 1.23
  run.js refuses a run past MAX_OUTPUT, 64 MiB of both streams: `finish --run` reads each check alone, so it never reaches
  the bound; several `_Verify:_` commands of one `done --run` are read together and can — `metricsDropped` says `readBytes`
  —, and a facade caller; RX-4, R3-A-1) — `readBytes`
  said when a METRIC lies
  before them, or when the bound cuts the blanks / `#` in front of one (`lineStartOf` → -3: maybe a candidate; mid-line
  text before it is none) —, a candidate (a line passing RE_CANDIDATE, an attempt or not) of ≤ 512 UTF-8 bytes AFTER CSI
  removal (a colour never pushes a line over) — a longer one is a drop (`candidateBytes`), never malformed —,
  ≤ 1,000 candidates walked (`candidates` said on the 1,001st), ≤ 20 names (`names`) — the lines printed LAST are kept, a benchmark
  loop's final iteration. `dropped` lists the bounds in the fixture's order. Cost (09-evidence-metrics, ratios — no count exists for a
  CPU walk; both sides warmed): hostile lines UNDER the cap (no line of them a candidate) 64 → 256 KiB ≤ 6× (linear 4×, ~4.6×
  measured; quadratic would be 16×), and 64 MiB of output lines (2.2 M) with one METRIC line ≤ 3× a bare `lastIndexOf` of the same
  text, flattened first — the first scan of a concatenation pays for its copy — (~1×; a split is 6–9×); a 60 MiB coloured
  candidate line ≤ 3× the same line plain (equal work: the keyword's scan, the line end's, one chunk; stripped whole it was ~39×).
- **The bytes are a second contract, `metric-bytes/1` (1.42).** mcp/tests/fixtures/metric-bytes.v1.json, byte-identical in dev-guardian,
  pinned in 09-evidence-runs: a run's stdout and stderr bytes and two readings — `stream` (each stream decoded as UTF-8, read apart:
  this plugin) and `file` (dev-guardian's `metrics` over a `2>&1` capture) —, `differs` exactly when the two differ (key order counts).
  The stream mode is tested in 09-evidence-metrics (the reader) and cli 09-evidence-run-module (the capture's strings). A change that
  alters a case is metric-bytes/2, landed in both before either tags. A sample, not a proof: a change that alters no case passes.
- **The judge, `judgeMetric(reference, current)`** → the fixture's `{verdict, why, loosened, delta, applied}`: the REFERENCE's terms;
  judged only when it states `better=` AND `tolerance=` (else `unjudged`, `why` its missing terms, with the delta); a changed unit
  `unjudged` + `loosened: "unit"`, no delta; `loosened` is ONE term (unit, then better, then tolerance — a flipped / dropped direction,
  a raised / dropped tolerance), the value judged by the reference's terms; the current may only tighten (`applied` = the smaller
  amount); `n%` of |reference|; symmetric (`improved` / `regressed` only past `applied`, the boundary within). Exact decimals
  (`decimalOf`, a BigInt at one scale): the two readings' printed `text`s when BOTH carry one — the grammar prints up to 24
  significant digits (15 + 9), a double keeps 15–17 — else the two values' shortest round-trip texts (a reading without a text: a
  hand edit, another writer); the tolerances likewise (R1-DG-H-7): their printed `text`s when EVERY tolerance the two lines state
  carries one (a line stating none needs none — the reference's long tolerance against a current without one is exact), else
  both on their amounts' shortest texts; `delta` / `applied` read back with Number().
- **Who reads, who stores.** Only the CLI: `done --run` hands `evidence.output` (every passing command's stdout and stderr,
  TWO texts each, in run order — never joined end to end, so a stdout line without its newline is read; a later text's line
  of a name wins: a name on both streams reads stderr's — dev-guardian's `metrics` reads ONE file, a CI job's `2>&1` capture in
  print order, so the two agree on a name printed on one stream only: verification.md → One stream per name, RX-6) and
  `finish --run` each non-guardian check's `output` (`[stdout,
  stderr]`; `ranBy: "cli"`; never stored; normalizeEvidence never takes it, MCP can't pass it — `output` is no schema key,
  nested keys are refused). Only a PASSING run is read (a failed command, a non-zero check, `_Expect: fail_`'s red run:
  none); dev-guardian's gate never (`isGuardianCheck` — its output is a scan report). The readings (`runMetricsOf` →
  `storedReading`: an ARRAY `[{name, value, text, unit?, better?, tolerance? {amount, percent, text?}}]`, null terms left out;
  readingOf keeps a text read back only when it is the grammar's number AND Number() of it is the stored value — a tolerance's
  only when it is the grammar's unsigned number AND Number() of it is the amount) go on the LATEST run only —
  `recordEvidence` / `recordFinishChecks` put them on the record after `runOf` built it, so the history never carries them (20
  names × 6 copies) and a later run without them leaves none. Results:
  spec_complete_task `metrics` (the reader's shape, nulls kept), `metricsMalformed` / `metricsLastMalformed`, `metricsDropped` —
  report-only: the tick never compares (no walk); `recordedChecks[]` the same with `metrics` a count. The CLI prints a tick's
  readings as `METRIC <line>` and, per check, what it could not read (`metricRunLines`).
- **finish compares — `finishMetrics()`**, after the readiness report, never in `gateOnly`: the readings of the project checks whose
  suite status is `pass` (a `changed` / stale / failed check's are neither compared nor recorded), each `(check, name)` against the
  latest OTHER folder's `finished.metrics` holding it — by `finished.at` (a re-finish moves it; never `firstAt`), active and archived
  (`walkFeatureStates`, the feature's own folder skipped: its re-read compares the same). No reading: no walk (the COUNT —
  09-evidence-metrics: each other folder's `.state.json` opened exactly once more than without readings, the own folder's the same,
  the execution gate's none). Out: `metrics` [{check, name, value, text, unit, better, tolerance, verdict, why, loosened, delta,
  applied, reference: {feature, at, value, text, unit, better, tolerance} | null}] (stable codes; each number shown as its `text`
  when it has one — `shown()` —, a reading without one as its value), ONE warning (`metric.finishWarn`: the regressed and the
  loosened readings, ≤ 5 named + the rest counted, worded without blaming the feature — the number holds every change merged
  since; its 4th argument `unitOnly` — every one it names only changed its unit — gives its own head: not compared, never "got worse
  past the tolerance"; a unit's `loosened` form says "not compared", never "judged by"), never a blocker; the merge summary's
  `## Metrics` right after the project checks; `metricsUnmeasured` + its warning — the
  code spans of the FIRST cell of the design's Silent Regressions data rows (`designMetricNames`; never a comment, prose or another
  cell) no passing check printed as a READABLE line, only once every check passes AND every check's latest run is stamped
  `observed: "cli"` (finish --run): a check reported over MCP carries no reading, so its names are a doubt — no claim (1.41.0
  review 1); a name printed as a malformed line or one past a bound is no reading either, so the warning claims no READABLE line
  and points at the run's note (1.41.0 review 2 — no stored flag: a later spec_finish without a run says the same). A ready
  WRITTEN finish records them: `recordFinishBaseline(…, metrics)` → `finished.metrics` [{check, name, value, text, unit?, better?,
  tolerance?}] (none: no key), `baseline.metrics` its count.
- **Known limits** (verification.md says them): the baseline is the tree's — parallel branches, a commit outside a feature, another
  machine's timings all land in the next feature's comparison; a test printing a METRIC fixture line is read; a runner capturing
  stdout hides it; `kB` ≠ `KB`.
- **spec_metrics' ONE walk** (finish.js `metricsBlocks` → metric.js `walkFeatureStates`): every folder (featureDirs: active, then
  archived), its state read ONCE (stateFromFile; the read cache serves featureMetrics' and the velocity's reads of the same files —
  the COUNT: each `.state.json` opened once per call), handed to each block `{ key, visit(fd, state), result() → value | null }`; a
  non-null result becomes the project result's `key` (a block of another concern is one more entry of `metricsBlocks`, built by
  its own module). The readings' block is `measuredBlock` → `measured` [{check, name, unit, better,
  finishes, first, last, change, changePct, series ≤ 10, otherUnit?}] — per (check, name), in its latest finish's unit (another
  unit's finishes counted apart), by finished.at; none: no key (a project without readings reads as in 1.40). Its CLI lines:
  `measuredLines`, the last of `metricsLines`. The lessons' is `lessonsBlock` (decisions.js) → `lessons` (lifecycle.md →
  spec_metrics' lessons); the walk runs before the features' own metrics, so the block's read of an active folder is handed on
  (`viewOf`). The project's `friction` is no block (it reads the timings log, never a feature folder). With no active feature
  the CLI still prints the project's lessons, friction and measured lines (`metricsLines`' no-features branch).

## Task dependencies and execution waves
- **`_Depends: 3, 5_`** — an English-stable task marker (the task line or a sub-line, never fenced code: `taskMarkers(b).depends`).
  Tokens split on commas, semicolons or spaces; `#3` = `3`; a value wholly in `[brackets]` is a template slot.
  `taskDependsSpec(block)` → `{declared, numbers, invalid}`. The numbers name tasks of the SAME tasks.md, read on ONE view — the
  ACTIVE tasks (`activeTasks()`) — with resolveTask's duplicate rule: n is done once EVERY task numbered n is; a number no active
  task carries never is. **Without `_Depends:_` nothing changes** (the same next task, no new fields).
- **`taskSchedule(blocks, hold?)` is THE next-task rule** → `{next, skipped, blocked, graph}`: the first open task in tasks order (only
  the task resolveTask answers for its number) whose dependencies are done — never one of `hold`'s numbers (passed over, never
  `skipped`: +port's fence, port.js `portSchedule` — spec_next_task, next_action's implement step, the status line, `next
  --batch`, complete_task's `next`, spec_status's `tasks.next` and the brief's default task pass the tasks it holds (1.36.0
  review 2: not the roadmap's row nor `next --waves`); spec_next_task then carries `gated` / `heldBy` and, nothing else startable
  while the anchor holding them is ticked but unverified, its run as the `note` (complete_task's note and the default brief's too)
  — gates-and-approvals.md → Bugfix and finish; 1.36.0 review 1).
  **Tasks order:** by SECTION in file order (`taskSections()`:
  a phase heading and its closing checkpoint), then by number — `taskDepGraph`'s `order`, which the waves use too; parseTasks' public
  list stays by number. `skipped` / `blocked` `[{number, waitsOn}]`: open tasks that wait / can never start as things stand (Kahn's
  walk, `stuckTasks()`: a cycle, a dependency no task carries, or waiting on such a task — only when some task declares
  `_Depends:_`). Consumers: `spec_next_task` / `next`; next_action's implement step (none startable → step `fix` with `blocked` and
  `taskDepsBlockedNote()`, never "finish"); the brief's default task (`task: null` + `blocked` / `skipped`, never "all done"); `next
  --batch` (`parallelBatch()`: a [P] task waiting on an open dependency ends the batch, and so does a task +port's fence holds —
  `portHeldNumbers`); `spec_status`'s `next`; the roadmap (none
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
  `waitsOn` + `taskDeps.tickedEarly`. The execution gates are the only refusals: the bugfix and +port gates, checked before
  anything is recorded (the brief carries `gated`, so `done --run` runs nothing) — gates-and-approvals.md → Bugfix and finish.
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
- **The scan is memoized by text** (`TASK_BLOCKS_MEMO`, 1.42): an LRU of `TASK_BLOCKS_MEMO_MAX` = 1,024 texts AND
  `TASK_BLOCKS_MEMO_CHARS` = 4 M characters of them (`lruPut`: the oldest out first, a hit moved to the newest place, the newest
  always kept — one text over 4 M is then alone), so a refresh past 32 features no longer re-scans each text 4× (40 features: 160
  scans → 40 cold, 0 warm; a tick 162 → 1). A pure function of the text: nothing goes stale. Callers get copies; features whose
  tasks.md are byte-identical share ONE scan (`taskPeerStamps` returns one Set for both), so a reader annotates its copies, never
  the scan's blocks (mcp/tests/08-tasks-memo.js holds a bugfix and a plain feature with the same text). What the bounds hide: past
  ~4 M characters held (~400 features of 10 KB; half that when a track-filtered text doubles the keys) or 1,024 texts, a
  project-wide call scans the oldest again; a long-lived process (the MCP server) keeps ≤ ~26 MB for it (the keys 4–8 MB, one- or
  two-byte, + ~17.5 MB of blocks — measured at 1,024 × 4 KB). `taskBlocks.scans` counts the misses (in-process, never in a result).
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
- **The `_Implements:_` slot.** Every tasks template carries `_Implements: [path of the code …]_` on its code task (tasks.md's
  core task, no size and size s; change.md's task; the bugfix's fix — `text.tasks.implements` + the LAYOUTS / the builders): the
  duplicate check, the drift baseline, the scope guard, the cross-feature overlap and dev-guardian's `[this feature]` read that
  marker, and an agent that left it out got a silent zero everywhere. A value wholly in ONE `[bracket]` group — its backticks off
  first: `` `[path …]` `` too (review 9: `scanTaskMarkers` tested before stripping them, a path to it while `implementsRefs` dropped
  it) — is the slot, never a file — the three readers drop it (`scanTaskMarkers`, `implementsRefs`, trace.js's `implFiles`;
  `app/[id]/page.tsx` and `[slug].tsx` stay paths) — and the placeholder gate refuses it left in, in a code span too
  (markdown.js `implementsCodeSlots`: a template slot that is an `_Implements:_` value in backticks; any other code span stays
  opaque): a code task fills it, a task that writes no code deletes the line. A test fixture that fills every `[bracket]` by regex
  drops the slot's line first (it would name a missing file). A feature whose tasks name no file at all finishes with a warning
  (`finish.noImplements(file)` — never a blocker: a feature may write no code; it names the file the tasks are in, `phaseFile`:
  tasks.md, an xs change's change.md — review 9).

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
- **Claims** (`stopClaims()`): every language's i18n `stopGate.claims` / `negators` / `admissions` (read from the corpus —
  `i18n.stopGateLists()` rendered by the build, `builtinStopGate()`: an English Stop hook loads no other language) compiled together (`STOP_WORD`:
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
  folders, ≤ 1 MB a file; its `STOP_RECENT_HOURS` is checked against the engine's; 1.42: a regular file only — a linked, FIFO or
  folder `.state.json` is skipped unopened, and a roadmap.json that is no regular file is the user's option, as the engine's read
  gate reads both). CLI: `dev-spec stop-check [--message
  "<text>"|-] [--agent <type>]` (exit 1 = would block).
- **The claim pre-filter (Stop only).** `hooks/stop-claims.generated.json` — COMMITTED, from `npm run build` (guards.js
  `stopClaimFilter()`): the claim patterns (`stopClaimSources()`), `STOP_WORD`, stopProse's regexes (`RE_STOP_FENCE` /
  `RE_STOP_CODE` / `RE_STOP_QUOTE`), the `triggers` groups; stamped with each `STOP_FILTER_SOURCES` file's size, no version. Used
  only while every size matches (a size-preserving edit is the accepted limit; `npm run check` and the suite catch it). `mayClaim()`
  runs the triggers (none → done), then `claimMatch()` runs `claimProse()` (wide: `claimScan`) through ONE alternation of the
  triggered patterns; no match ends the hook. A superset: negations, questions and admissions stay the engine's; any trouble → the
  engine. SubagentStop is never pre-filtered. mcp/tests/10-guards-guard-downs.js ("I-I4") checks it filters out no engine claim. **`npm
  run build` after editing an i18n file or guards.js** — the "1.20 build" test fails until the file is committed.
- **Scope guard:** `meta.guard` `false | true | "scope" | "tests"` (`guardLevel()`; the hook reads it raw; `guardInput()`: true /
  "on", false / "off", "scope", "tests"). `scope` (and `tests`), once a feature holds approved (or forced) tasks with open ones, adds
  `scopeGuardDecision()`: a code file passes when an OPEN task of such a feature names it in `_Implements:_` (`implementsKey`, a
  folder above it, a glob) or it is a test file — at level tests only a test no list protects (below); otherwise ask, naming the
  likely task (a planned file in its folder, the longest shared prefix, the first covering feature's `taskSchedule()` next, the
  first open task) or `/spec-review <feature> converge`.

## Protected tests (`meta.guard: "tests"`, 1.36)
**One module:** engine/protect.js (the snapshot, the tick record, the decision, protect / unprotect, finish's check, doctor's
warn); guards.js keeps only the call in `guardCheck` (claude-code-integration.md → Guard mode, Level tests).
- **The list** — `.state.json → protectedTests` `{at, via: approval | protect, files: {"<rel>": "<16 hex>" | null}, truncated?,
  lifts: [{file, at, by, reason, confirmed?} | {file, at, by, revoked: true} | {file, at, by, reason, accepted: true,
  confirmed?}]}` (the hash: finish.js `fileHash`, CRLF-normalized,
  shortened; null: unreadable or gone — 1.41.1: or no file of the project by its REAL path, files.js `projectFileReal`: a `..` / absolute /
  `C:x` path, a junction out of the project, a link below .specs/ — never hashed, `hashRel`). `stateFromFile` refuses a wrong shape (`jsonShape.protectedTests`); protect.js `listOf`
  tolerates any shape on its own (guardCheck reads the file raw).
- **The snapshot** — at a feature's FIRST complete tasks approval at level tests (`approvePhase`: `p === "tasks"`, the approval
  complete — a role's waiting sign-off takes none; a fast-forward through tasks passes it on): `protectWalk(projectDir, first)` —
  each live feature's `.specs/<f>/tests/` FIRST (the approving feature's, `first`, before the others), then the project's test
  files (`walkProject` — hidden / `SCAN_IGNORE` folders skipped, links never followed; `isCodeFile && isTestFile` — 1.38: a
  Jest `__mocks__/` / `__fixtures__/` file and a Cypress `*.cy.<script>` among them, markdown-and-trace.md → Test code), at most
  `PROTECT_MAX_FILES` (2,000 — `truncated` past them; so a project past the cap still lists the feature's own failing tests).
  **The walk runs OUTSIDE the feature lock:** the facade wraps the locked approvePhase in `protectWalkFirst`, which walks only when
  this call may be that first approval (phase or `through` tasks, no revoke, no dry run, level tests, the list not `snapshotted`)
  and hands it in as `opts.protectWalk` — never a tool argument; under the lock `protectOnApproval` merges it ADD-ONLY
  (`withWalk`: a recorded hash and the list's first `at` kept; a test another live feature lists with that feature's hash —
  `knownWalk`, below, 1.36.0 review 4) and marks the list `via: "approval"`. **"Snapshotted" is that
  mark** (`snapshotted`: via "approval"), never `at` — a `feature protect` or a lift before the approval sets `at` too, and the
  approval then recorded nothing; a re-approval or a revoke + approve keeps the marked list (another process's too, taken while
  this one walked). The result: `protectedTests {count, at, truncated?}` + a note. Cost: linear (2,000 vs 200 test files ≈ 10×,
  held ≤ 25× by a ratio test); past the cap the walk stops — COUNTED since 1.40 under the project root (10-guards-protected-tests:
  4,000 test files open and stat what 2,000 do and list strictly fewer folders; the timed ≤ 1.5× it replaced flaked by one
  call's noise). `feature protect <f>` walks the same way (its own feature first).
- **The tick record** — `completeTask` (under the feature lock, a TICK at level tests — `protectOnTick`, called BEFORE the tick
  stamps `ticks[n]`): at the task's FIRST tick each test file it names EXACTLY in `_Implements:_` is re-baselined (its content
  now is the authorised one: a planned change); a task with a tick record (`tickRecorded`: `ticks[n]` — a box unchecked by hand
  keeps it — or an `unticks` entry, the untick drops `ticks[n]`) is a RE-tick, which keeps a recorded hash and only adds a file
  not yet listed, so finish names an edit made while it was open. Each test file its `_Verify:_` names (quotes off, a pytest
  `::node` / a `:line[:col]` suffix off, never a glob) joins the list when absent — never re-hashed (a weakened listed test run
  by a `_Verify:_` keeps its record), and one another live feature lists joins with that feature's hash (`recordedHashOf`,
  below — the other features' states read only then; 1.36.0 review 4), never its content now: only the exact `_Implements:_`
  re-baseline records new content at a tick. An untick removes nothing. The bugfix tasks.md's task 1 carries `_Implements: [the test
  file T-01 goes in]_` (EN / PT / ES; the 1.21 F5 pin moved on purpose) so the red test is planned for task 1, recorded at its
  tick, protected from task 2.
- **The decision** (`protectedTestDecision`) — an existing target is read by its REAL path (`realRel`: links and junctions
  resolved, the on-disk case — `t2/auth.test.js` through a junction to test/ IS test/auth.test.js); nothing there, the text
  path stands. The target is a glob when `*`, `?` or `[` appears ANYWHERE in it (`tes?/a.test.js`, `*/a.test.js`,
  `test/*/a.test.js` — `globMatcher` on the whole path, matching a listed file or a folder above one; a `[class]` is also read
  as one character, `RE_GLOB_CLASS`, since globMatcher reads `[` as itself and `app/[id]/x.test.js` must still match itself),
  else a folder (lstat, never a link), else a file — decided by FOLDED membership in the lists, never by `isTestFile` (a case
  variant of a listed file is that file: `cart.TEST.js`, `TEST_UTIL.PY` where the file system folds case). The lists read are
  every feature with open tasks OR no finish recorded (`holders`: covering, forced, stale, pending, and a feature whose tasks
  are all ticked until its `state.finished` — before the stale / tests-phase / spike answers); a listed test passes only when a
  lift is in force (`activeLifts`, below) or a task that can start now (`readyTasks`, tasks.js: a task with `_Depends:_` all
  done, the first open undeclared task and its `[P]` run in one section — taskWaves' first ready set without packing the waves;
  never a task +port's fence holds — `portHeldNumbers`, port.js: every task after the first anchor not ticked AND verified, a
  `[P]` task beside the open baseline included; never a reopened task with a tick record — `tickRecorded`, which is not named
  as one either) of a COVERING or FORCED feature names it exactly in `_Implements:_` (a folder or a glob never equals a file;
  `_Makes green:_` never unlocks). Else ask — deny under `meta.approvalGuard: deny`; the reason names the tasks that can start
  now — or, when a reopened task names a blocking test, that it is that task's planned test and needs a lift (`reopened`, never
  "no task names it") —, the plan hint (the first of them) and the lift line (guards.js `approvalCommand`). **The lift line's
  feature** is the one being worked on: a covering / forced feature (an unlocker) whose list holds the file, else the first
  unlocker, else a holder with open tasks, else the holder listing it with the latest tick (`state.ticks`; a tie or none: the
  first by folder name — every task ticked, no finish yet: the final review's window, and its lift is in force like any other;
  doctor names it after that feature's finish). At guard level
  tests a target with a glob ANYWHERE reaches this decision even when `guardFolderCode` calls it no code (guards.js skips its
  not-code allow for it, then allows not-code when no protected test matches): `rm -rf tes?/unit`, `packages/*/test`.
- **Lifts** — `spec_feature {action: "unprotect", file, reason}` / `feature unprotect <f> <file> --reason …` (finish.js
  `manageFeature` → `protectTests`): a test file (by name or folder; never a glob) inside the project, a reason (`reasonInput`: one
  line, ≤ 500); codes `file-required` · `reason-required` · `not-a-test` · `outside-project`; `dryRun` (the MCP server's check
  before it asks) writes nothing; `confirmation` → `confirmed`. A guard-down of the approval guard (claude-code-integration.md →
  Human approval guard). `protect <f>` adds the tests present now (walked before the lock, add-only; a list without a snapshot
  gets `at` / via protect); `protect <f> <file>` appends a `revoked` record when a lift is in force anywhere and adds the file when
  absent — never re-hashes one. **A file another live feature lists** joins with a hash that feature recorded — here, in the
  first tasks approval's snapshot and in a tick's `_Verify:_` record (`recordedHashOf` over `otherStates`, the first in folder
  order — `recordedHashes`, finish's union, gains nothing; `knownWalk` maps a walk; 1.36.0 review 4): a plain protect (no
  guard-down), a snapshot or a run never authorises new content; only a file no live feature lists gets its hash now. `protect <f>
  <file>` and the accept read an EXISTING file by its real path (`realRel`, as the decision does — one through a junction is
  the real file's key; a real path outside the project — a junction out — is `outside-project`, never hashed: 1.41.1 R3, the accept's
  dry run returned the outside file's hash). **In force** (`activeLifts`, over the live features' states — `liveStatesWith`; guardCheck's
  `ctx.states`): per file the LATEST record across every feature's lifts — a lift until a `revoked` record of any feature
  follows it. Nothing else ends one: no expiry, no finish, no open-task test (1.36.0 review 3 went back to this, the 1.36 rule —
  History). An accept record is no lift (`activeLifts` skips it; the accept's own `revoked` record ends a lift).
- **The accept** (1.36.0 review 3) — `spec_feature {action: "protect", file, accept: true, reason}` / `feature protect <f> <file>
  --accept --reason …` (`protectTests` → `protectLocked`, opts.accept): the same checks and codes as a lift (`file-required`,
  `reason-required` — the accept's own words, `err.acceptFileRequired` / `acceptReasonRequired` —, `not-a-test`,
  `outside-project`; `dryRun`; `confirmation` → `confirmed`), a guard-down of the approval guard on every path (setting
  `accept`: MCP — over elicitation too, its dry run before the question, `elicit.accept`; the dry run returns the file's
  `hash`, the server passes it back as `preview` {hash} and a different hash under the lock is refused `changed-since-preview`,
  nothing written (`err.acceptChangedSincePreview`, 1.36.0 review 4) —, the CLI through a shell — probe.js
  `CLI_SWITCHES` and `RE_APPROVAL_VERB` hold `accept` / `--accept`). Under the feature lock: a `revoked` record when a lift is in
  force anywhere (as `protect <file>`), the file's hash NOW written into that feature's list (under the listed spelling; the file
  joins the list when absent — the one write that re-hashes a listed file, the user's decision), and an accept record `{file, at,
  by, reason, accepted: true, confirmed?}`. Result: protect's (`protectedTests`, `lifts` — an accept record marked `accepted`,
  `unlifted`) + `accepted` and the `accepted` note. Plain `protect` stays no guard-down. The CLI takes `--reason` on protect only
  with `--accept`. The merge driver unites the accept record with the lifts by identity (`LIFT_ID` holds `accepted`).
- **Finish** (`protectedTestsFinish`, after the gate-only return): a listed key that is no file of the project by its real path
  (`projectFileReal` — `.state.json` is the repository's, its keys untrusted) is SKIPPED — not hashed, not counted, never unexplained, so
  finish's answer never depends on what it names (1.41.1 R3: `changed` or not told a guessed content apart) — and NAMED: `ignored`
  in the result, one line in finish's warning (`protectedTests.ignored`). Each other listed file is hashed again — a hash matching NO record of
  any live feature (snapshot, tick, accept) and no lift in force (`activeLifts` over every live feature, the finishing one's state
  read under the lock) → `unexplained` {file, status: changed | deleted}; a lift in force explains a change (`lifted`). A warning
  naming the first 5 (+ how many more) whose line is the ACCEPT (`finishWarn` — never a lift: a lift lasts) and the merge
  summary's "Protected tests" block — never a blocker (a change the user confirmed at the prompt is legitimate).
  `res.protectedTests` {count, unexplained, lifted, accepted — the finishing feature's accept records of its WORK CYCLE: since
  its last finish (`state.finished.at` as read: the finish being recorded is written after) when that finish precedes its
  latest tasks approval (`approvals.tasks.at` — a new cycle), else since that approval (the cycle was finished once already: a
  re-finish keeps them, 1.36.0 review 4), else every one; shown as `summaryAccept` lines}. **The
  hashing runs OUTSIDE the feature lock** a write / evidence finish takes (2,000 files held it ~2 s, the MCP server's lock
  wait): the facade wraps it in `protectHashFirst`, which hashes the listed files first and hands them in as
  `opts.protectHashes` — never a tool argument; under the lock a file listed since is hashed there.
- **Doctor** `protected-tests` (warn; level tests, a tasks approval, an open active task): no snapshot (`feature protect <f>`), a
  truncated one, the approval guard off; and (1.36.0 review 3) on a feature with a finish recorded — open tasks or not — each
  lift of its own recorded BEFORE that finish and still in force (`doctorLiftAfterFinish`: both lines, end it — `feature protect
  <f> <file>` — or accept the content). A lift recorded after the finish is not named (/spec-finish's warning gives the accept,
  never a lift). **The brief** of an open task at level tests: `protectedTests` (the list's count) and its
  definition-of-done line after the fast check's — a task with a tick record (reopened) gets `briefDodReopened`: it unlocks no
  test, its planned one needs the user's lift. **init** `--guard tests`: `protectedTests.on` and `protectedTestsWarning` while
  the approval guard is off.
- **Known limits** (not findings): tests in ignored / hidden / linked folders, outside the project folder or past the cap are
  not listed; new test-support files (conftest.py, setup files, mocks) stay editable; a git command or a script (`node -e`) is
  not read by the hook — finish names the result; a merge from main lists teammates' test changes; an ARCHIVED feature's list and
  lifts are not read (`liveStatesWith`, guardCheck's feature folders — a restore reads them again, and its finish names what changed
  meanwhile); creating a link or junction to a protected folder (`ln -s`, `mklink /J`, `New-Item -ItemType Junction`) is not read
  — it edits no test, and an edit through it is read by the real path — nor is removing the junction itself (no code folder by
  lstat); a GLOB through a link or junction (`sed -i t2/*.test.js`) is matched as typed — `realRel` resolves an existing target
  only — finish names the change; the tick record is keyed by the task's NUMBER (`ticks[n]`, `unticks`): a re-plan that
  renumbers the tasks gives an open task a ticked number — it then unlocks nothing and its first tick re-baselines nothing (a
  lift, and finish names the change); a lift lasts until `protect <file>` — its feature's finish never ends it (doctor warns once
  that feature is finished; the accept is the way to record an intended change).

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
  `meta.checks` command: `spec.observeRun()` appends `{command, exitCode, at, event, session, tool?}` (`observedKey`; `tool`:
  "PowerShell" on a PowerShell run — 1.36 review 1, the fast check's note reads it — none on a Bash one) to
  `.specs/<feature>/.execution/observed.jsonl` per non-archived feature with such a task, or `.specs/.execution/observed.jsonl` for a
  check; it never creates a feature folder. Bounds: past `OBSERVED_MAX_BYTES` (64 KB) the newest half is kept (atomic; a concurrent
  append may lose a line — that run reads unobserved); `OBSERVED_MAX_COMMAND` (4000); `OBSERVED_MAX_FEATURES` (200). **1.41:**
  the payload's `duration_ms` (both events; optional — an older Claude Code sends none) goes on as `ms`: observeRun times a
  check's run in the git-ignored timings.jsonl (Project checks → The friction budget) — never on the observed line.
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
  - *The pre-filter* (before the engine loads): `observedNorm` / `observedBodies` — ONE copy, mcp/lib/probe.js's, which the engine's
    observeRun reads too (mcp/tests/09-evidence.js checks neither file keeps its own) — the command's bodies, normalized as the matcher
    reads them, must each appear in a tasks.md read the same way (≤ 2 MB;
    dot / `_` folders skipped; UTF-16 decoded; change.md only without tasks.md; one lstat and one open per folder; 1.42: a regular
    file only — a linked, FIFO or folder tasks.md is none, so change.md is read, as the engine's change alias reads it, and a
    roadmap.json that is no regular file holds no checks) or a meta.checks command — a
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
- **1.28** — the review flow runs the duplicate detector first; until then duplication was found only by the reviewer's own
  searches (prose).
- **1.32** — the brief's `uiReview` key and the visual review (Shopify's Helix UI gate): a +ui task could pass its tests
  and still look nothing like the design — no step ever looked at the screen against its reference. **Review 15:** SKILL.md
  put the review before the implementer; a visual round was sent to the code re-review; an implementer could edit the
  reference until it matched (the reference is the approved design's now, a round touching it is refused); a red task
  and server templates / Android layouts were misread. **Review 16:** three surfaces still sent every Major straight to a
  fix round; the reference check had no diff range (a committed round passed it); the breaker judged visual findings it
  can't see; an autonomy summary could be logged as "approved".
- **1.37.0 review 1 (D7, D4)** — the verdict pass (1.37) put a finding "missed earlier" on the ledger only, "never a round of
  its own", while every tick rule (ui-review.md §5, subagent-execution.md §8) let nothing but a parked finding stay open: a
  Blocker the pass noticed outside the changed regions could be neither fixed nor ticked past, and the agent's `Open: N` left
  it out. It goes as a regression does now (ui-review.md §5 rule 5) and `Open: N` counts it; the tick rules were right
  already. D4: the floor's WCAG 1.4.10 exception read "a box that scrolls inside the page is not the page scrolling" — any
  box; it is W3C's again, content that needs a two-dimensional layout for its meaning or use.
- **1.38.0** (D — the capture matrix of items 3 and 4, CRIT_X D1) — the review captured "the views and states this task
  built" at one viewport, the floor at 320 alone: no width a project designs for was ever looked at, and 15 states × 6
  widths would blow every dispatch. One matrix for both items, kept in ui-review.md §2 (no ui-capture.md; its cap 10,000 →
  12,000): the states at one width, the worst case — the state a width breaks — at every breakpoint, measured like the
  floor (a `.json` each, a sideways scroll a Blocker), ≤ 6 widths — with their `.prev.png`, 12 images: one dispatch — and
  the per-view split said in §3 for the rest (CRIT_3 must-fix 7). Each new state is reached through the worst case's data boundary;
  a state the script can't reach is never shot as the default page. "On mobile" moved to ui-responsive.md → Checking it.
- **1.31** — the brief's `preflight` key and the pre-flight (from google/elephant-goldfish-model's zero-decision rule): a
  brief that left a design choice open was found only when the implementer came back NEEDS_CONTEXT — a dispatch spent — or
  not at all when it chose alone.
- **1.36** — the review panel (`meta.reviewModels`, doctor's / next_action's `reviewPanel`): every review step ran ONE model —
  the task review, the final / branch review and converge one spec-reviewer each, the size-l gate critics both on the session's
  model, `/spec-review branch` read by the session that wrote the code. The design's per-task panel (a brief key, the critical
  flows widening gate / converge) was cut before it shipped: it multiplied the most frequent dispatch, and the final review on
  every model already covers each task; so was "two models agree → no verifier" (two reviewers of the same package share its
  blind spots: merge, then verify each merged finding once).
- **1.36.0 review 1** (the review panel) — **RP-1:** the files disagreed on the gate critics: critic-review.md §1 and
  spec-doctor.md put them ON the panel's models (a panel without the session's model dropped the session-model critic),
  while subagent-execution.md, the Model selection row, the CHANGELOG and init's note said the panel adds models and never
  replaces a review's own — and the latter also verified every merged finding, gate findings included, against §3's "gates
  have no verifier". The owner's rule, now in every file: the panel ADDS gate critics (the size table's, on the session's
  model, plus one on each panel model not already the session's); verify-once is the code reviews' rule (final / branch,
  converge); the gate critics' merged findings go to the user. **RP-2:** "the first panel model other than the
  implementer's" could put every task review on `haiku` (panel [sonnet, haiku], a sonnet implementer) — below the task
  reviewer's floor — or every one on `opus` with diverse, unsaid in the cost text; now at least standard, none (or none the
  host can dispatch) → `sonnet`, and the Cost bullet / init's note say where the task reviews go. **RP-3:** the finish
  sentence's exit ("unless the ledger already has its `Final review: ×N` line") missed the collapsed-panel form ("review ×2
  requested …") and the inline host (no line at all), and spec-finish.md had no exit: every path now ledgers a
  `Final review: ×N` line (`— the host ran one model`, `×1 … — inline, the panel was not run`; spec-review.md says it for
  the inline branch review). The sentence's "on every model" beside a list without the most capable model was left as it is
  (not part of the decision). **RP-4:** the CLI word `" opus,sonnet"` / `"opus,sonnet,"` was refused (`split` left an empty
  name) — names are now the runs between separators (`match`), a word with no name still refused; an array refusal echoed
  `["opus,sonnet"]` as `opus,sonnet`, the documented example — now JSON; the refusal names the `[1m]` suffix. **T2** (review
  panel part): `default` / `off` / `none` inside a list were reserved by the code but pinned by no test.
- **1.36.0 review 2** (RP2-1) — the exit "since the last task" read the ledger's order, and only subagent execution ledgers
  task lines: a task ticked inline (the default, and every task on a host without subagents) after the panel review left that
  line reading as current. The line now carries the HEAD the review ended on (`Final review: ×N (requested a, b) @ <git
  rev-parse --short HEAD>`, its collapsed and inline forms too), and the exit is "unless the ledger's latest `Final review: ×N`
  line names the current HEAD" — next.reviewBranch (EN / PT / ES), spec-finish.md, spec-review.md (which names the ledger's
  path for the inline cases) and subagent-execution.md (the ledger lines, Final review, Resume). The narrow reading, no
  exception: any commit after the line (a fix the branch review asked for, the simplify pass) moves HEAD, so the panel
  reviews the final code again; work left uncommitted moves nothing — the branch review reads `merge-base..HEAD` only.
- **1.36.0 review 3** (D3-1, D3-2) — round 2's `@ <HEAD>` went back out: a new mechanism for a LOW that made the whole panel
  run again after every commit — the branch review's own fixes (spec-review.md ledgers the line before them), each simplify
  commit (the pass comes after the review), a `.specs/`-only commit — with no bound, against "Never multiplied", "No second
  wave" and the Cost bullet's "the final review once a feature". The exit and the ledger lines are round 1's again ("unless
  the ledger already has its `Final review: ×N` line since the last task", no `@`) in next.reviewBranch (EN / PT / ES),
  spec-finish.md, spec-review.md and subagent-execution.md; RP2-1's gap (a task done inline writes no ledger line) is closed
  in prose in the same places — "if you did one after the review, run it again". D3-2: the branch review reads
  `merge-base..HEAD`, so spec-review.md (branch) and spec-finish.md say to commit the feature's work before it (inline work
  is committed only when the user asks — executeTask.md). spec-review.md keeps round 2's ledger path.
- **1.37** — the `[UI]` sections reached a brief only through a `[UI]` criterion (`trackMarks`): a task that builds a
  component under a core criterion, its file named by no design section, read no contract and no states. `want()` takes
  them on a `uiTask()` task too, within `BRIEF_DESIGN_BUDGET` — the cut form of item 4's design (its own contract quote in
  the brief, through `briefDesignSystem`, would have repeated what Design context already carries and is null without a
  registry).
- **1.37.0 review 1** (RB-2, MEDIUM) — that line put the `[UI]` sections in the budget loop like any other wanted one, in
  design.md's order: on a +ui +obs feature (the scaffold puts `[OBS]` after `[UI]`) or with a trailing `## File Structure`,
  the [UI] block filled the 4,000 characters and the section the task's metrics or its own file asked for — the one a 1.36
  brief quoted — was only named. `want()` now ranks (1: every earlier rule, 2: the uiWork line alone) and the budget reads
  the task's IDs first, then the other rank-1 sections, then the rank-2 ones, each group in design.md's order. Fixtures: the
  reviewer's two shapes (08-tasks); the mutations: quality.md → History → 1.37.0 review 1.
- **1.38.0** (DECISIONS shared point 5, CRIT_4 must-fix 1) — `BRIEF_DESIGN_BUDGET` 4,000 → 6,000. +ui's state matrix (the
  1.38 template) filled with ~50 characters a view cell and a terse a11y cell measured 2,727 / 3,724 / 4,704 bytes at 1 / 2 /
  3 views: at 4,000 a view task's brief lost Responsiveness & i18n and the Performance Budget at one view and `[UI] UI States`
  itself — the section the task builds from — at two. At 6,000 the matrix is quoted at 1–3 views, all five `[UI]` sections at
  1–2; at 3 views Responsiveness & i18n and the UI Performance Budget (the smallest, last in design.md's order) are named in
  "Relevant but not included" (RB-2's order unchanged; neither a separate allowance nor a per-view quote — the ruling's
  narrower choice). The brief grows to ~8.3 KB at 2 views, ~9 KB at 3. Fixture: 08-tasks (1, 2 and 3 views; it fails at
  4,000); three 1.37 fixtures sized for 4,000 were re-sized past the new budget (M15's Big file, the 1.37 view brief's
  Accessibility, RB-2's [UI] block).
- **1.41.0** (the gardening round) — **the pruning pass** (CRIT_S4's cut form): the Test Value rule (the testing-standards
  template, new projects only; test-patterns.md) and an optional `/spec-review <f> prune` pass, PROSE: candidates from the matrix trace_check
  already returns (`supersededBy` without `supersedePending`, `tests[].files`), the reviewer's prune mode, the controller's
  probes (a tracked, clean file, a hash-checked copy-restore, each test of a pair alone — `git diff --quiet` passes an
  untracked file and `git checkout --` cannot restore one), the record through the existing flows (spec_impact `retire`,
  `protect --accept --reason "pruned: …"`). The designed engine pass was cut: `trace_check {prune}` (the matrix has the
  data), `no-ac` and `costlier-layer` (real plans: empty or real wiring), the `_Pruned:_` / `_Prunes:_` markers (11 readers
  missed; a prune task naming the deleted file fails trace on 43 % of real test files), the guardian.js "approved pruning"
  mark (text only, file-granular). The reviewer also got one line: an unreasoned suppression is a question, Important when it
  hides a security scanner (CRIT_X D8.9). **The brief's Reference examples and Lessons parts** (each ≤ 1,200 characters,
  CRIT_X D8.6); `briefTargets` taken out of briefSteering so both read the same paths (CRIT_S1 #11 — `implementsRel` alone
  missed an absolute path inside the project); a lesson is quoted once, in its own part (CRIT_S1 #2). The fix report's
  `### Causes` block is one sentence of agents/spec-implementer.md (paid per dispatch — CRIT_S1's cut of more), and the
  implementer and the reviewer each got the METRIC line's rule (never loosen, flip, re-unit or drop one to pass; a diff that
  does is Important). Review 1: `retired-ac` read the AC rows only, so a test of a retired AC and a live EC was a candidate
  and the EC lost its only test with trace green — a candidate's EVERY row is retired now, at least one an AC, and the
  verdict names each criterion's guard (R1-PZ-2); the pass makes `.execution/` with its `.gitignore` (R1-PZ-3: a finished
  feature's went at Closing); and the churn's re-approvals completed only forced until trace stopped asking a planned test of
  a retired AC (R1-PZ-1, markdown-and-trace.md → History → Readers). Review 2 (the user's ruling: cut the case, no new
  mechanism): that trace rule took a namesake feature's and a reused AC ID as retired (R2-PZ-1) and was reverted; the 1.40
  justified-gap path (the Gaps note + a forced, reasoned test-plan approval) leaves doctor's traceability failing, so finish
  stays blocked. So `retired-ac` left the pass (the criterion and its candidate rule, R1-PZ-2's) — to the backlog: it needs a
  gate that honours the user's forced, reasoned test-plan approval for the named ACs —, a criterion's last planned test
  joined the never-pruned list (any AC, EC, NFR or SC — the re-approvals then complete unforced), and a retired AC's test is
  named to the user as one needing a `/spec-change` on its feature, never pruned.
- **1.42 —** S9 (the subagent cost): subagent-execution.md said "roughly 2–3× the tokens" with nothing that measured it.
  Designed as an engine-side transcript reader with time and a feature per dispatch; the critic measured 2,194 real dev-spec
  transcripts and cut both (a span is wait time for one dispatch in ten; 7.4 % of prompts name two features — a scope by a
  name) and moved the read to the hook (the engine never reads a path outside the project). Also from that corpus: usage
  repeats within one message id GROW (`output_tokens`, 226 files) — per field the max per id, never the first line nor a sum
  (2.0–2.2× the deduped); a tool_use per LINE (one content block a line); the largest transcript 26.8 MB (the hook's 32 MB
  bound). S9-b / S9-d built the engine part (recordAgentRun, agentCosts, the metrics lines); S9-c (the hook's reader and its
  SubagentStop entry, second in the list after the stop gate's) waited for B142-13's regular-file reads in the same file.
- **1.42 —** S9-c (the subagent cost's recorder), built on the integrated branch after B142-13: the observe hook's SubagentStop
  branch and reader, hooks.json's async entry (claude-code-integration.md → History). Its own count-only probe (4,440 local
  dev-spec agent transcripts, 8,676 subagent ones) confirmed every assistant line carries a message id and all four usage fields
  (safe integers), the largest transcript 26.8 MB (none past 32 MB, p99 6.9 MB), and found the one shape the critic's corpus
  didn't name: Claude Code's own API-error line (`<synthetic>`, `isApiErrorMessage`, zero usage — every one so marked), last in 12
  dev-spec transcripts — counted, it would have added a turn and handed the engine a model it leaves out, so the reader skips it.
- **1.42 —** UX-10 (DS-TASKS): the brief listed a fresh init's constitution / tech / structure stubs under "Read before coding",
  their `[e.g., …]` rules read as binding. A file that is a built-in stub verbatim or headings only is listed apart and flagged
  `template: true` in `steering.included` (the row kept: nothing absent). Doctor's "a placeholder left" was rejected as the
  predicate (a partly filled tech.md would drop out). The constitution stub's text was NOT reworded this round (SK-P3 narrowed to
  spec-critic's row): every project inited since 1.30 holds its current hash, and a new text would have made those binding again.
- **1.42 (the review loop's prose)** — built, prose only: S1 (the residues filed before the merge — the ledger went with
  `.execution/` and nothing read it, so parked, unconfirmed and pre-existing findings vanished at the merge); S4(a) (the
  task review gets the duplicate detector's file; the cap answered by the reviewer's own rule, never a "none" from a top-20);
  S6 (a class fix, narrowed to ONE trigger and the task's files — ships unmeasured: no eval drives fix rounds); S8 (a check
  offer, found out by a grep or the check's own run — a too-narrow grep would let a check in that blocks the finish's step 2);
  the critic's rows (SK-P6 as a property, SK-P3 per principle, S15, SK-P2's "or repeat"); one S3 clause; UX-11's merge
  branch; UX-13(a). Measured: the `review-seat` evals (testing.md → Plugin evals; their reference run on the 1.41.2 prompts,
  evals/README.md). Cut: S3's protocol (an end line in two shells, a `Read: N lines` reply, a resume and a §8 clause — Read
  returns a file whole on this host, a refused one tells the agent to page, and N is gameable by Grep), with its long-package
  eval case; S4(b) (review_pr per task — a recorded scan per task in dev-guardian's history, unmeasured on Linux, and W covers
  the feature at finish); S6's NOT ADDRESSED trigger (an incomplete fix, which rounds / tier-up / breaker already answer — one
  predicate for two rules) and its NEEDS_CONTEXT → converge path (a re-approval mid-story for a rare event); S7(a) (the
  blind-first reorder: gated on the reference run, where the report's rationale swayed 0 of 3 runs) and S7(b) (no fixed
  report headings to scope a verifier to); SK-P4 (converge's written rules — paid on every reviewer dispatch for a rarely run
  mode, and a rule break has no AC to route to); SK-P5 (clarify choices as decisions — the AC is the record, and a reworded
  AC makes the `affects` phantom); S1's per-topic names (two features' defects merged under one topic), its contested parked
  findings and the re-review's out-of-scope lines (they stay deferred minors: the label is the namesake the rename removes);
  the dev-guardian review-seat pair (no dev-guardian prose changed; its deterministic half needed another chain's rule);
  SK-P2's within-feature engine check (0 pairs in 2,614 real comparisons) and SK-P3's stub rewrite (the stub's whole-file
  hash is the brief's "still a template" test). The agent-prompt byte ratchet (S14) waits for the integrated branch.

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
- **1.29** — dev-guardian's gate as the check `guardian`: a project check whose exit code and JSON report finish reads (the
  sibling plugin's 0 / 1 / 2 / 3), offered by init / upgrade when dev-guardian is installed, never set on its own (its scan takes
  minutes and needs scanners). Measured on dev-guardian 3.1.0's real scan of a fresh project: exit 0, coverage full, stderr
  empty — and three medium Semgrep findings (`path-join-resolve-traversal`) in the launcher itself, now `nosemgrep`-annotated.
- **1.30 (review 8)** — the gate stopped trusting what it was handed: the launcher verified before a run and when one is recorded
  (a stub printing exit 0 had passed as the CLI's own observed run); a report contradicting its exit code, or a pass with no
  report, refused (an `exitCode: 0` beside a report saying exit 1 had passed); the raw stderr behind the verdict (the summary's
  last lines had lost "Cannot find module", so a missing launcher read "blocked" with how to fix findings); report text one inert
  line; text with braces around the JSON read. dev-guardian 3.3.0's `tool_version`, `coverage_gap_details`, `baseline_status`
  and `--compact` read when present (3.2.1's verdicts unchanged); the remedies never advise `baseline update` to accept one
  finding (it accepted the feature's own SQL injection with the old debt); `init --guardian` says to record a baseline and which
  `.gitignore` lines dev-guardian needs, and is atomic; `.guardian/reports/` no longer makes a run dirty. The code left
  evidence.js for engine/guardian.js.
- **1.30.2 (review 11 of dev-guardian 3.4.0, findings 1 and 17)** — a pass whose report carried `accepted_gaps` (a per-file
  timeout accepted in `.guardian/scan.yml`: dev-guardian passed a critical finding appended to that file) read as a plain pass:
  `accepted` counts the files left unanalysed, in the head line, the merge summary and a finish warning (never a blocker).
  dev-guardian 3.4.0's `coverage_notes` (taint timeouts, and the dropped-baseline line it moved there from `coverage_gaps`) are
  counted in the merge summary only — they come with most real scans. The Semgrep `file_timeout` hint said "run again / leave
  files out (.guardianignore)" and dropped dev-guardian's scan.yml remedy. `GUARDIAN_IGNORE` lacked `hooks-allowlist.json` and
  `scan.yml`: with only dev-spec's lines, git ignored `.guardian/scan.yml` until dev-guardian wrote its own `.guardian/.gitignore`.
  Then dev-guardian 3.4.0's `accepted_gap_details` came first, line by line (the English lines only where no entry stands), and
  `unused_timeout_acceptances` became a finish warning: a stale entry would accept a future timeout on its file unseen.
  **Review 12** (real release/3.4.0 outputs through the reader): R1 — dev-spec runs the gate without a ref, so a feature that
  appended a vulnerability to an accepted file passed with the generic warning only: the feature's own accepted files are named
  (`acceptedOwn`), a warning rather than a blocker. R2 — gap lines were cut at 200 characters, losing dev-guardian's "changed since
  BASE", and the timeout hint then said to list a file that was listed: lines kept whole to 1000, a listed file that changed gets
  `timeoutChanged` + dev-guardian's own remedy — read from its `cause: "accepted_file_changed"` once dev-guardian added that marker
  (with or without a ref; the file then in no accepted gap), the wording only for a report without it. (These notes first said
  "3.4.1" for dev-guardian's new keys; it ships them as 3.4.0.)
- **1.33** — dev-guardian 3.8.0's test-integrity check (a test weakened to make it pass) reads only a change: `finish --run` hands the
  launcher the feature's base (`DEV_SPEC_DIFF_BASE`), which it passes on as `--diff-base`; with none decided the variable is
  cleared, so a value left in the shell never reaches the gate.
- **1.33 review 5** — the recorded base was used whenever it resolved, even to HEAD's commit (a local merge, `git branch -f main
  HEAD`, a failed switch, a TAG named `main` — rev-parse prefers refs/tags): an empty diff the verdict called "checked". Now
  `refs/heads/<base>`, the start commit when the base is HEAD's, an empty change said and never passed; a dangling origin/HEAD
  (a remote default renamed) falls back to the local main / master.
- **1.33 review 6** — review 5's "empty" skip was wrong: dev-guardian reads the working tree, so a base at HEAD still reads the
  uncommitted work — create --branch, work left uncommitted, a test turned into `test.only`: nothing was passed and the `.only` no
  longer blocked. Never skipped now (`guardian.diffBaseEmpty` gone); the start commit replaces a base only when the base CONTAINS
  HEAD (merge base, so a `--no-ff` local merge counts too), and only when it is HEAD's proper ancestor.
- **1.33 review 7** — a base passed that still contains HEAD reads only the uncommitted work, yet the verdict said "the change since
  main checked": `uncommitted` → `diffBaseUncommitted`, its own line in EN / PT / ES. The rebased-then-merged start commit's wider
  read documented as a known cost.
- **1.36** — the fast check (`meta.fastCheck`, The fast check above): the only per-edit signal was the agent's own habit — a type
  error surfaced at the `_Verify:_`, in review or at finish, after several edits had piled on it (the owner's case study: a fast
  check after each small change). The design's per-line content stamp (`codes` on every fast-check log line: the observe hook
  hashing up to 8 features' planned files after each run) was cut before it shipped: measured ~3 s per run against the hook's
  ~0.2 s, it could leave out the feature being worked on, stamped the main checkout's files for a worktree run, quartered the
  shared log's capacity and fell back to time alone past 500 files — the tick-time date comparison costs nothing per run and
  changes no hook. So was block mode (`meta.fastCheckGate`): bypassable by naming a no-op check, refusing every PowerShell-tool
  session, and a file date may never block (gates-and-approvals.md).
- **1.36.0 review 1** — the fast check. **FC-1:** past `BASELINE_CAP` (an earlier task's folder or glob of 500+ files) the
  ticked task's own file was never dated — its edit read clean and `done --run` skipped the check; its own `_Implements:_`
  files are now always dated and `partial: true` says the set was cut. **FC-2:** the tick note named `done <f> <n> --run` for
  the task it had just ticked — a done task's brief carries no fastCheck, so that command ran none; the note names no command
  now. **FC-4 / T3:** the fixer rule (a `*fmt` word without `--check`) refused `gofmt -l` / `shfmt -d` / `make check-fmt` /
  `dune build @fmt` and let `ruff format .` / `dotnet format` / `clang-format -i` through — now `fmt` / `format` programs and
  subcommands against the check flags, worded as a heuristic in the docs. **FC-6:** a PowerShell-tool failure was logged but
  its later pass was not: "failed on its last run" with no hint — the hook marks a PowerShell run's line `tool`, the note says
  why. **FC-7:** the brief and the implementer now forbid a piped run too. **FC-9 / INT-7:** metrics counted an undone tick
  and an `unknown` one (MCP-only: "0 of N clean"). **INT-5:** init echoed an invalid stored name with no note. **INT-6:**
  `init --guardian --fast-check guardian` on a fresh folder left `.specs/.gitignore` — the launcher was written before the
  fast check's refusal. FC-3 (a run's folder), FC-5 (a deleted planned file) and FC-8 (the async hook's stamp, ~0.2 s after
  the run) are documented Known limits, not mechanisms.
- **1.36.0 review 2** — the fast check. **FC2-1:** review 1's widened formatter set (`*format`) refused check-only forms —
  `swift format lint`, `swiftformat --lint`, `dart format --output=none`, `elm-format --validate`, `buf format --exit-code`,
  `clang-format -n`, `npm run lint:format` — and its `-l` exemption let `gofmt -l -w` / `shfmt -l -w` through: a `-w` word beside
  a formatter now refuses, and the check words those tools use (`-n`, `--lint`, `--validate`, `--test`, `--exit-code`,
  `--output=none`, a `lint` subcommand, a lint-named script) count. `biome format .` (a bare form that only reports) stays refused —
  no word tells it from `ruff format .`: the documented limit. **FC2-2:** `done --run` skipped the check on a clean `partial` status
  (a +port corpus of 500+ files fills the planned set): it runs it now. **FC2-3:** the own-file dating walked the planned glob a
  second time (×1.8 on a big glob's brief) — it reuses the planned walk's files.
- **1.36.0 review 3 (PF3-4)** — FC2-1's check words, `lint` and `-w` were read anywhere on the command line: `make fmt lint`
  (two targets) and the "format, then fail on a diff" idiom `cargo fmt && git diff --exit-code` were accepted, `gofmt -l . | grep
  -v -w vendor` refused. They are read in the formatter's own simple command now (`fixerSegment`), and `lint` never after a make
  / just / task target (RE_TARGET_RUNNER, gone since review 4). `ruff format -n .` stays accepted: `-n` counts as a dry run, the
  documented limit.
- **1.36.0 review 4 (PF4-2)** — review 3's runner list let every other spelling and runner through as a check-only `lint`: `gmake`,
  `(make …)`, `FOO=1 make`, `pants fmt lint ::`, `./gradlew format lint`, `turbo run format lint`, `npm run fmt lint` (an argument
  of the fmt script). No name list tells `pants fmt lint` from `swift format lint`: the runner list is gone and `RE_LINT_MODE` is
  positive — swift-format's own subcommand only (`swift format lint`, `swift-format lint`, by any path). The split's
  `$(… | …)`-then-flag refusal (`ruff format $(git ls-files | grep -v x) --check`) is a documented limit, not a shell-aware split.
- **1.41.0** (the gardening round: tending what agents write code in — the guidance, the stakes with a number, early weeding;
  three of its items here). **W (CRIT_X D7)** — a new finding of dev-guardian's own passes below the gate (a test skipped or
  deleted, assertions removed; from 3.17 an added suppression) read only as "(N new below it)". It is now `testIntegrity`
  and ONE finish warning, never a blocker, each finding labelled by its pass. dev-guardian 3.17 gives suppressions a pass of
  their own (CRIT_G1 #5): reported under `guardian-test-integrity` they would have read "weakened test: scanner-suppression-
  added". The name `guardian-suppressions` is DECISIONS' (dev-guardian's chain had not committed one when this was built;
  3.17's pass carries that name) — one constant, `GUARDIAN_SUPPRESSIONS`. An older dev-guardian has no such pass: its test
  findings only, nothing else changes. "Below the gate" is the gate's own rule (severity under `--fail-on`), not "absent
  from `blocking_findings`". Not built:
  a label on a BLOCKING suppression finding (at `--fail-on medium` it reads as its rule id, as in 1.40), W in the merge summary
  or finish --run's own lines. The same round rewrote the five bare `# nosec` examples (fixHint EN / PT / ES, AGENTS.md,
  verification.md) as `# nosec <id>  # <reason>` — a bare one silences every Bandit rule on its line (CRIT_G1 #6; 17-docs
  reads every surface for one). **The friction budget** (Project checks → The friction budget), S3 as CRIT_S3 cut it: the
  git-ignored, name-stamped timings.jsonl (the writer stamps `check` + `checkCmd`, so the reader is a string compare — the designed reader ran
  the matcher per line, 10–30 next_action calls of CPU on a worst-case log), trimmed per check (a byte trim let the fast check's
  flood push the suite's runs out before they reached 3), `_Budget:_` read by the task markers' span reader under its own label
  (a second closer grammar would drift — MARKER_CLOSE_PUNCT already differs from the design's), spec_metrics' project `friction`,
  next_action's finish-step hint stopping on a backlog item OR a feature named `friction-<check>` (spec_create prunes the backlog
  entry: a backlog-only stop came back while the platform feature was built), the timings read once per call (spec_upgrade runs
  next_action per feature). Cut: `ms` on `.state.json` runs (and its internal CLI key), the feature-scope run times, doctor
  `friction` (every feature, every size, spec_upgrade regrouping them all — and no project-level doctor exists), the `took` line
  (a budgeted check's too: the decision lists none — the narrower reading). observed.jsonl's appender and tail reader became `appendLog` /
  `readLogTail`, shared; the observed lines are 1.40's byte for byte (the oracle replay and 09-evidence-friction). **Metrics
  that regress silently** (S2 as CRIT_S2 cut it, under the round's Shared 1–3 + 3b): a number a check prints — the
  `METRIC name=value` line agent benchmark loops print, with an optional unit, `better=` and `tolerance=` — is read, stored and
  compared at finish (Metrics that regress silently, above). One contract with dev-guardian 3.17 (`metric-lines.v1.json`), two
  readers. Cut on the way (CRIT_S2): the tools/list words (prose in verification.md instead), `vanished` (the lookup can't see a
  name nobody printed, and it never ends), task values in a finish's record, a judgment at the tick (no cross-feature walk per
  tick), three loosening statuses (one `loosened`), the timed lookup backstop (a COUNT), the m / l scaffold's slots (a refusal of
  every fresh design — an empty table warns instead), an absent tolerance read as 0 (46 % of unchanged benchmark pairs warned), and
  `metrics` in a run's history. Over MCP no reading at all — DECISIONS' "the latest CLI run only", the narrower reading of the
  critic's `reported` summary parse: a summary is the reporter's text, and the CLI reads the whole output. Where the fixture is
  silent the reader chose (dev-guardian's may differ — the cross-plugin review's to compare): a known key given twice is
  malformed, a unit only right after the number, no negative tolerance, a lone CR no line start, a changed unit the
  `loosened` term before a flipped `better=`. **At the merge** spec_metrics' lessons moved onto the metrics blocks' ONE walk
  (the lessons chain's own walk over `featureDirs` was temporary — a COUNT pins one walk now), and finish's warning order
  (dev-guardian's, W the last of them, the metrics', the lessons' last) was pinned against commands/spec-finish.md. **Review 1
  (area MF)** compared the two readers on 73 lines the fixture leaves open (the review's differential harness runs dev-guardian
  3.17's metricLine.ts / judge.ts on the same lines): 8 reader and 4 judge disagreements → 0 and 0. The reader took
  dev-guardian's five shapes (R1-MF-4): one `# ` with no blanks after it, a CSI's final byte a letter, the 512-byte bound measured
  after CSI removal (which dropped lineStartOf's candidate floor — the line is read to its LF once), a unit's 16 in code points,
  a `#` run no candidate at any length (it was said as a `candidateBytes` drop). None of the five made a bound drop input
  unsaid. The judge: a value past 15 significant digits compared as its double (`…000000001` vs `…002` at tolerance 0 read
  `within`); the reading now keeps its printed `text`, judged when both sides have one (R1-MF-5 — the "≤ 15 digits, all the
  grammar keeps" note was wrong: 15 + 9); exponent-form values (`1.5e-7`, `1e21` — JS prints them so) got judge fixtures
  (R1-MF-2: a mutant ignoring the exponent survived). `metricsUnmeasured` claimed "no passing run printed it" for a finish
  reported over MCP, where no run carries a reading — now only when every check's latest run is the CLI's (R1-MF-1). The reader
  got stdout + stderr joined (a stdout line without its newline glued to stderr's first) — now two texts (R1-MF-6). A unit change
  read "judged by the earlier finish's terms" and a unit-only warning "got worse past the tolerance" — both say not compared
  (R1-MF-7). `_Budget: npm test 2m_` (the command in the check's place) was silent — now `no-check` (R1-MF-9). Two more
  differences the fix found past the 73 lines, aligned on the controller's ruling the same way: a final CR with no LF after
  it (dev-spec read it into the last token — malformed; now one CR ends the line at the text's end too) and a bare `METRIC`
  line (dev-guardian counts it toward its 1,000 candidates, dev-spec never did; now a candidate, ignored — a flood of them
  pushes earlier readings out with `candidates` said, never unsaid). Both harnesses: 0 disagreements.
  **Review 2 (area MF):** `metricsUnmeasured`'s warning said "no passing run printed a METRIC line of that name" for a name the
  run printed as a malformed line (`12.5kB`) or past a bound — now "no READABLE METRIC line … the run's note names it", prose
  only, no stored flag (R2-MF-1). The reader stripped a long candidate line's colours whole before measuring it (a 60 MiB
  coloured line 1,325 ms against 34 ms plain): now `visibleLine` stops past the bound (R2-MF-5; 25 lines built to cross its
  chunks, each as dev-guardian 3.17 reads it). The warning and `## Metrics` printed a long reading as its double — they print its
  `text`, the reference's too, and so does a tick's line (R2-MF-4). dev-guardian's review found the judge read a TOLERANCE of
  more than 15–17 digits as its double (4 of its 19 pairs disagreed; 9 of 20 here): the tolerance keeps its printed `text` on
  the reading and in `finished.metrics`, the round-1 mechanism of values (R1-DG-H-7), and the known limit is gone. Fixtures
  only: the append to a project template — the feature's language, before the track blocks, a section under a synonym or at
  level 3 found (R2-MF-2) — and a flagged unjudged reading that is no unit change under the general head (R2-MF-3). **The
  cross-plugin review:** a stream starting with a UTF-8 byte-order mark read nothing (dev-guardian's file decoding drops it) —
  one leading U+FEFF of each text is dropped now (RX-3; against dev-guardian's string reader, which never sees a BOM, the
  harnesses' BOM rows now differ — through its readMetricFile, 0 of 7 do); the prose said "its last 64 MiB" of a bound the
  CLI never reaches (RX-4) and nothing of the two readers' stream order (RX-6). **Review 3 (area MF, prose and fixtures):**
  RX-4's "never reaches" held for `finish --run` only — one `done --run` reads every `_Verify:_` command's streams together,
  and two of 40 MiB said `readBytes` (R3-A-1); a BOM at stderr's start is read past here while a `2>&1` capture holds it
  mid-file (R3-A-2); the CHANGELOG's "compare — and show — as the exact decimals" — the delta and the applied tolerance
  print as numbers (R3-A-3); two judge rows no reader prints — a current tolerance without its text, a reference without
  its value text but a long tolerance text — kill the mutants reading `tolExact` off the reference alone or only with both
  value texts (R3-A-4). **Cross-plugin pass 2:** R3-A-2's sentence named stderr only — with a BOM on both streams and stderr
  printed first, a `2>&1` capture holds stdout's mid-file: verification.md and this note say "the stream printed second"
  (RX2-4, prose).
  **Review 1 (W):** "below the gate" also leaves out a finding the report lists in `blocking_findings` (R1-PZ-4: dev-spec
  reads the command's first `--fail-on`, dev-guardian its last — `--fail-on high --fail-on medium` named a medium as the
  blocker AND as "They do not block"; a subtraction, the rule checked before a key is built); `kinds` and a head naming only
  those checks (R1-PZ-5: 3.8–3.16 has no suppressions check — stored, since the top 3 may hide a kind), mcpRun's full-report
  clause; an unknown-severity fixture at `--fail-on info` (R1-PZ-6); `cleanLine` drops the bidi controls and zero-width format
  characters (a U+202E reordered the warning and the blocker), tested before its replace — a second global replace on each
  fact of a 120k-finding report cost W a quarter more. **Review 2 (W):** `cleanLine` keeps ZWNJ / ZWJ (R2-PZ-3: dropped, the
  blocker and W printed Persian / Indic / emoji names that name no file, and a name folded into its ZWNJ-less twin in the
  own-file match); the command's LAST `--fail-on` is read, as dev-guardian reads it (pre-existing: `--fail-on low --fail-on
  high` said "at or above low" and the medium weakened test the gate let pass was in neither W nor the blocker — R1-PZ-4's
  fixture moved to a shell-quoted last value, which dev-guardian unquotes and dev-spec does not read, so the blocking
  exclusion stays the net); the record comment names `kinds` and that exclusion (R2-PZ-5). From the cross-plugin review: W
  never fires over MCP — both diff passes need `--diff-base`, which the launcher adds only from `DEV_SPEC_DIFF_BASE`, which
  only `finish --run` sets — so mcpRun (EN / PT / ES), verification.md and the CHANGELOG say so and review 1's "a full
  report names them" is gone (RX-1: the reviewer's mcp-finish.js — the hint's own command over MCP, 0 findings; the same
  branch through `finish --run`, 5); a `guardian-suppressions: ` coverage note keeps the suppressions check in the head
  (RX-7); a reported suppression has no reason or names no rule, so W's closing says to give it one, and the diff-base line
  says suppressions are read too (RX-9). **Review 3 (W):** that line said "checked for weakened tests and added
  suppressions" for every dev-guardian version — 3.8–3.16 run no suppressions check — so it is one text true for each, no
  version branch: "checked for weakened tests (and, with dev-guardian 3.17+, added suppressions)" (R3-B-1: the reviewer's
  g1.js with 3.16.1, 3.8.0 and 3.17.0); a fixture with a `guardian-suppressions: ` note beside suppression-only findings —
  the head names the suppressions check only (R3-B-5, killing the mutant that let the note add the test-integrity check).
  Review 3's last `--fail-on` read the command's first segment only (`;` / `&&` / `||` / `|` / a line break), so a later
  `echo --fail-on low` is not dev-guardian's. **Cross-plugin pass 2 (W):** that first segment made a prefixed check
  (`cd . && <check> --fail-on medium`, Windows' `chcp 65001 >NUL && …`) read high where 1.40 read medium — the FIRST segment
  that carries a `--fail-on` decides now, its last flag (RX2-1: a text property, never a name list; 8 mutants killed — the
  first segment only, no break, no split, the first flag, the default, `&&` or the line break dropped from the cut, a bare
  `--fail-on` word choosing the segment; the residual `echo --fail-on low && <check>` reads low, as in 1.40). W's closing
  said "give it a reason or name its rule", and verification.md / the CHANGELOG "no reason or naming no rule — only such a
  one is reported": in 3.17 a whole-file directive with no reason is reported even naming its rules
  (`/* eslint-disable no-console */`, `#![allow(dead_code)]`) — "give it a reason" alone, and the rule as 3.17's Upgrading
  section states it (RX2-2). fixHint offered only an inline suppression for a blocking test-integrity finding, which reads
  none — it says restore the test or the user decides, an approved pruning blocking at `--fail-on medium` by design (RX2-3,
  pre-existing).
- **1.42 —** (the tests chain, with dev-guardian 3.18's DG-17) **`metric-bytes.v1.json`**: the METRIC line's BYTES became a second
  contract, 11 cases (5 agree, 6 differ — by class: a byte-order mark mid-file, UTF-16 by its mark, UTF-16 guessed with no mark or in
  a tail window, a NUL head, print order), each with the readings both readers give it at 1.41.2 / 3.17. No reader changed:
  B142-03's rules were CUT — (1) a U+FEFF after a line break read as nothing changes metric-lines/1's line-start grammar in both
  readers (it would flip two agreeing rows: metric-lines/2 for a LOW); (2) UTF-16 by its mark alone narrows dev-guardian (a
  BOM-less `cmd /u` capture, a tail window past 64 MiB and the NUL head stop reading) and, here, would put files.js's decoder on
  `run.js`'s capture, which every reader of a run's output uses (a UTF-16 "tests 0" pass refused, a CR-only progress output split
  into lines). The research's synthetic NUL-head row is kept beside its real-shaped correction (UTF-16 `wsl.exe`-like text, then a
  UTF-8 line — the stream reads it, the file does not). Its pin and shape here have no committed negative controls (equivalent
  mutants while v1 is pinned by its sha: run once, offline) and no threshold of dev-guardian's guess; `differs` compares the
  readings key order included, as dev-guardian's pin does. **Tests:** done --run's two timing rows in
  cli/tests/09-evidence-run-friction.js are containments on ONE clock (perf-14): the pre-run's `ms` within the in-process call that
  holds it, and the pre-run's and the _Verify:_'s together within it — they compared two runs' own durations (`ms < 7500`, the
  _Verify:_ under the pre-run) and failed the pre-push's parallel run; run.js and commands.js unchanged.

### Task dependencies and execution waves
- **1.36** — +port's gate joined the bugfix gate as an execution refusal (its key `heldBy`; `waitsOn` stays a successful
  tick's open `_Depends:_`); doctor's `port-verify` warns about a task after the baseline whose `_Depends:_` never reaches it.
- **1.36.0 review 1 (INT-2)** — `taskSchedule`'s `hold`: with the baseline ticked but unverified, spec_next_task, next_action and
  the status line served the task the fence refuses (an inline /executeTask wrote the port's code before the baseline was
  verified). The brief's default task and complete_task's `next` stay taskSchedule's (the brief carries `gated`, the refusal
  names the anchor's run).
- **1.36.0 review 2 (P2-3)** — the surfaces disagreed: with an anchor ticked unverified, `done` printed "next → #2", `dev-spec
  status` and the brief's default task named the held task while next_task said "verify task 1". complete_task's `next`,
  spec_status's next and the brief's default task go through `portSchedule` too (nothing else startable: none, with `port.naHeld`
  as the note). Left: the roadmap's row (its blocked display reads `sch.skipped`, more than one line) and `next --waves`.
- **1.36.0 review 3 (PF3-5)** — `next --batch` still added a held `[P]` task beside a `[P]` baseline that was itself the next
  task (`portSchedule`'s hold exists only when it passes a task over): the batch takes `portHeldNumbers` — every task after the
  first closed anchor — whatever the next task is.
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
- **1.30 review 8** — the `_Implements:_` slot: the model-facing prose never required the marker, so a filled xs change.md
  finished "ready" with "0 implementing file(s)" and `dupes` had "nothing to compare". The templates carry the slot, the readers
  drop it as a placeholder, the gate refuses it left in (mcp/tests/08-tasks.js).
- **1.42 (perf-2, DS-PERF)** — the task-blocks memo held 32 texts: one refresh asks for a feature's tasks.md about four times, so
  past 32 features every read missed (40 features: 160 scans a refresh, warm or cold; next_action 81; a tick 162). Now 1,024 texts
  and 4 M characters (`lruPut`). The design's "a key over the bound is not inserted" was dropped in critique: a tasks.md over 4 M
  characters would re-scan once per caller where 32 kept it; the newest is kept instead. Tested as properties (a warm refresh 0, a
  tick 1, SessionStart ≤ one a feature), never "exactly 40".
- **1.42 —** UX-02 A (DS-TASKS, HIGH): next_task, the brief, status and complete_task read no approval — an agent was served,
  and ticked, the scaffold's template tasks before any plan existed. They now SAY it (planApproved / planNote / beforeApproval,
  never a refusal: a tick records what happened). The critic's narrowings, each a finding against the first design: the bugfix
  investigation exemption (dev-guardian's 73 real features held 4 ticks before a tasks approval, all the legacy investigation
  steps references/bugfix.md tells the agent to tick); `planNote` its own key, never appended to `note` (six `note === undefined`
  pins on unapproved ticks); a note only where a task is served or ticked (an imported all-done feature has none to name); the
  pending-gates truthiness, not `isRecord` (one rule, one predicate); no "invalid state reads not approved" (stateFromFile keeps
  a valid approval beside a malformed key). Cut: B (a template-task refusal — two downstream gates already stop a slot task) and
  C (a stamp of the ticks no approval covered — its 2 real hits were the documented investigation ticks); gates-and-approvals.md → History →
  Gates, 1.42. The CLI's exact `next` pins of 08-tasks-deps gained the plan line (still exact); 08-tasks.js's key pin lists the
  two fields.

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
- **1.42 (B142-13, DS-PERF)** — the Stop hook's raw reads open a regular file only (probe.js `readRegularJson`): a FIFO roadmap.json
  or `.state.json` held the hook to its timeout, a LINKED `.state.json` was followed (the engine then loaded only to read it as
  absent). gateOff's no-file answer stays the user's option; the pre-filter stays a superset (the engine's read gate reads all three
  absent).

### Protected tests
- **1.36** — tests the implementer cannot alter: a fourth guard level, `tests` (engine/protect.js). Cut from the design before
  shipping (the critiques): the git readings (git stays the user's — finish names what git changed), the T-ID file-head rule (T-IDs
  restart per feature: most bugfix tests carry T-01), the per-edit done-task scan (it read checkboxes an agent changes with no
  prompt — replaced by the tick record, in the approval-guarded .state.json), lift expiry, init-time snapshotting (doctor names
  `feature protect`), finish's "planned" exemption (it hid a later weakening). The ready set is `readyTasks` ("the tasks that can
  start now" — never next_task's single next), the walk runs outside the feature lock, and the hook reads every target.
- **1.36.0 review 1** — **PT-1** an untick (or a box unchecked by hand) reopened its task, which then unlocked its own red test,
  and the re-tick recorded the weakened content — finish said nothing: `tickRecorded` (no unlock; the re-baseline at the FIRST
  tick only, `protectOnTick` before `ticks[n]` is stamped). **PT-2** other spellings passed silently at deny — a glob in a folder
  segment (`tes?/`, `*/`), `[t]est/`, a case variant (`cart.TEST.js` was "no test" by name), a path through a junction: a glob
  anywhere, the real path, folded membership. **PT-3** past the 2,000-file cap the project walked first filled it and the
  feature's own `.specs/<f>/tests/` was never listed: the features' tests first, the approving one first. **PT-4** a `feature
  protect` before the approval set `at`, which read as "already snapshotted": the via "approval" mark. **PT-5** finish's "record
  it" advice left a lift that unprotected the test for every later feature: a lift ends with its feature's finish. **INT-1 / PT-6**
  once every task was ticked (before finish) the list stopped counting — under deny the edit got the generic ask: `holders` adds
  the features with no finish recorded; archiving is a known limit. **PT-7** `spec_feature unprotect` with the file in `newName`
  asked about no file (guards.js `mcpApprovalAction` reads `newName` as `manageFeature` does). **PT-8** finish hashed the list
  inside the lock (~1.9 s at 2,000 files): `protectHashFirst`. **INT-4** PT / ES scope ask glued "—" to the CLI line. **T1 / T2**
  fixtures: a task after +port's open differential check unlocks nothing; a case variant of a listed test that is gone asks; a
  quoted `_Verify:_` path and an absolute `_Implements:_` / unprotect path are read.
- **1.36.0 review 2** — **R2-PT-1** PT-5's "ended at or before its feature's finish" missed /spec-finish's own order: step 1's
  written finish records the finish and carries the warning, so the lift the warning asks for came AFTER the finish and never
  ended — every later feature edited the test silently at deny, and its finish called the weakening "lifted": a lift counts only
  while its feature has open tasks and was recorded after that feature's last finish; the finishing feature's own lifts all count
  at its finish (`activeLifts` `{state, open, all}`, over each live feature's state and open tasks). **R2-PT-2** INT-1 made every unfinished feature a holder, and
  the lift line named the first holder by folder name — an old feature all ticked, never finished, whose lift never ended: the
  line names an unlocker that lists the file, else the first unlocker, else a holder with open tasks (and such a feature's lift no
  longer counts, by R2-PT-1's rule). **R2-PT-4** a folder target with a glob above its last segment (`rm -rf tes?/unit`, `*/unit`,
  `packages/*/test`) was allowed as no code before the decision: at level tests a glob target skips that allow. **R2-PT-3** (no
  rule change) a reopened task's planned test asked "no task that can start now names it": the ask says it is a reopened task's
  planned test, which needs a lift; the brief's line alike (`briefDodReopened`). **R2-PT-5 / R2-PT-6** known limits: the tick
  record keyed by the task's number; a glob through a link or junction.
- **1.36.0 review 3** — WENT BACK to the 1.36 lift rule: rounds 1 and 2 narrowed a lift's lifetime twice (round 1: it ended at its
  feature's finish; round 2: it counted only while its feature had open tasks and after its last finish, its own finish counting
  all of them), and each narrowing lost real cases: **R3-PT-1** once every task was ticked (the final review's fix round, the
  simplify pass) the guard's line named a feature with no open task and the lift it recorded was never in force — the user
  looped; **R3-PT-2** the lift /spec-finish's warning asked for was dormant, not ended: one open task in that feature (a change
  request, or an agent's one-line edit of the unguarded tasks.md) revived it for every feature; **R3-PT-3** a feature's own
  finish counted all of its lifts, so cycle 1's lift explained a cycle-2 change the guard had refused — the backstop went silent.
  Now: a lift is in force until a later `protect <file>` record of any feature (`activeLifts` over the live states — round 2's
  tasks.md parse, `open` / `all`, are gone: finish and protect read the states only — ~175 ms against round 2's ~315 ms at 200
  features). The one shape that was wrong (round 1's
  PT-5: finish's warning advised a lift to "record" an intended change, which then stood forever) is replaced by the ACCEPT
  (`feature protect <f> <file> --accept --reason`): the user's guard-down that re-baselines the file, ends its lift and keeps an
  accept record; finish's warning and /spec-finish step 1 give it. Doctor names a lift still in force after its own feature's
  finish. Kept from round 2: the lift line's order and `protect <file>` ending a lift.
- **1.36.0 review 4** — **R4-PT-1** a plain `feature protect <f> [file]` (no guard-down) on a feature whose list lacked a file
  another feature listed recorded its CURRENT hash, and finish reads the union of every live feature's hashes: an agent's
  protect on a new or planning feature — or the user ending a lift in a feature that did not list the file, doctor's "end it"
  — accepted a weakened test silently. Now such a file joins with a hash that feature recorded (`recordedHashes`, shared with
  finish); only the accept authorises new content. The same class, closed the same way (`recordedHashOf`): a new feature's
  FIRST tasks approval snapshotted the weakened test's current content, and a tick listed a `_Verify:_` test with its content
  now — both explained the change at the listing feature's finish (a change made under a lift, then ended without an accept,
  is named again); a task's exact `_Implements:_` still re-baselines (the planned change). **R4-PT-2** the lift line's last fallback, the first holder by folder name,
  could be an old all-ticked feature never finished (R2-PT-2's shape): with round 3's rule its lift stood at once and for good,
  and no doctor check reached it — the holder with the latest tick now. **R4-PT-3** the merge summary's accepts were those since
  the last finish, so a re-finish of the same cycle (/spec-finish step 3: after last-minute code changes) dropped them — the
  work cycle now (since the tasks approval, or the finish before it). **R4-PT-4** the accept over elicitation recorded the
  content at the answer, not the one asked about — the dry run's hash as `preview` (as approve / remove). **R4-PT-5** the
  accept and `protect <file>` read the typed path: through a junction a second key, the real file's lift left in force —
  `realRel`. **D4-1** (prose) /spec-finish step 1, the accept's note and verification.md: finish again after the accept, or the
  summary written before it names the test as changed.
- **1.38.0** (chain P) — `isTestFile` gained Cypress's `*.cy.<script>`, `__mocks__/` and `__fixtures__/` (markdown-and-trace.md →
  Test code and file reads): at level tests a manual mock or a fixture module is now a protected test — snapshotted at the
  tasks approval, its edits asked about, finish's check — as a test file under `tests/` always was.
- **1.42 (B142-12, DS-PERF)** — the tick record's `_Verify:_` reader (protect.js `verifyTestPaths`) took a word's quotes and
  brackets off with `^["'`(]+|["'`;,)]+$`, quadratic on a long comma run (40 K commas then a letter: 1.6 s a word); two loops
  (`trimWord`: the tail run, then the lead run of the rest) take the same characters — the exhaustive table over every word of up
  to 6 of `"'`(;,)ab` and real commands (10-guards-protected-tests.js), the cost as a same-length yardstick ≤ 20× (the parent's
  ~4,000×).

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
- **1.30 (review 8, ds-maint finding 4)** — the hook's pre-filter was a renamed copy of `observedNorm` / `observedBodies`
  (`norm` / `bodies` / `RE_ENV`) that the 8-line duplication guard couldn't see and a source comparison kept in step: both now read
  mcp/lib/probe.js's one copy.
- **1.41.0** (the gardening round) — the hook passes the payload's `duration_ms` on as `ms`; a project check's run is timed in timings.jsonl
  (the friction budget), the observed line unchanged (09-evidence-friction pins its keys). Only runs the matcher reads as the
  check alone are timed: of this repository's 2,139 foreground check runs in its own transcripts 93 % were piped — the hook
  mostly times the fast check run on its own; the suite's numbers come from `finish --run` / `done --run`.
- **1.42 (B142-13, DS-PERF)** — the pre-filter opens a regular file only: a FIFO tasks.md (or roadmap.json) left one hook process
  blocked in its open per Bash call for the rest of the session (an async hook is never killed), a linked one was read through.
  A tasks.md that is no regular file is none — change.md is read, as the engine's change alias reads it (returning "unreadable"
  there would have skipped the change); one lstat more per folder.
