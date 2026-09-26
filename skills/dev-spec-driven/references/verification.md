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
  the output (or run `dev-spec done csv-export 2 --run`, which runs it and records the evidence)."
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
  (`npm test -- keys.test.js`, `pytest tests/test_keys.py`, `k6 run load.js`).
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
- **CLI:** `dev-spec done <feature> <n> --run` runs the task's `_Verify:_` command(s) from the project root
  and records the evidence; any failure leaves the task open, is recorded, and exits 1. `--shell bash` (or
  `DEV_SPEC_SHELL`) picks the shell. On Windows the default shell is cmd.exe, which has no single quotes and never
  expands `$VAR` — `node -e 'process.exit(1)'` exits 0 there — so a `_Verify:_` in POSIX syntax is refused before
  anything runs: re-run with `--shell bash` (Git Bash), or `--shell cmd` to run it under cmd.exe anyway. A failed run
  suggests `--shell bash` only when cmd.exe itself could not run the line (an unknown command, its syntax error); a
  check that ran and failed means fixing the code. Or report it by hand: `--evidence "14/14 passing" --exit 0 --cmd "npm test"`.
- **Briefs** (`spec_task_brief`) carry the `_Verify:_` command (and whether its run must fail) and require the
  implementer to paste the command, exit code and output tail in the report; the reviewer checks it is there.

## Red → green: `_Expect: fail_`

A task whose job is a test that must FAIL first — a bugfix's regression test before the fix, a red phase that writes
tests before their code — carries **`_Expect: fail_`** (English-stable, like `_Verify:_`) next to the `_Verify:_`
command that runs that test:

```markdown
- [ ] 3. [US1] Write regression test T-01 and watch it fail for the right reason
  - _Requirements: US-1.AC-1_
  - _Makes green: T-01_
  - _Verify: node --test test/discount.test.js_
  - _Expect: fail_
```

- Its proof is a **failing run** `{command, exitCode ≠ 0}`: recorded with `expected: "fail"`, it ticks and verifies the
  task (`redRecorded: true`).
- A **passing run is refused** and recorded (`unexpectedPass: true`): the test doesn't fail yet, so it tests nothing.
  Make it fail for the right reason (an assertion, "not implemented" — not a typo or a missing import). On an already
  ticked task a pass makes it unverified (reason `unexpected-pass`).
- Once the red run is on record, a later passing run of the same `_Verify:_` (the fix made the test green) is fine:
  the red run stays the proof.
- Exit **126 / 127 / 9009** means the command could not run at all (not executable / not found) — no red test; it is
  refused like a failed run. Under cmd.exe, a line cmd.exe could not run is refused by `done --run` with nothing recorded.
- A red-phase task that carries a must-pass `_Verify:_` and no `_Expect: fail_` gets `redPhaseVerify: true` and a note
  saying to mark it `_Expect: fail_` (or move the command to the task that makes it green).
- `spec_doctor` warns **`red-green`** (+tdd): T-IDs that done tasks make green (`_Makes green:_`) with no recorded red
  run of an `_Expect: fail_` task citing them — a test that never failed proves nothing. A guard test that passes
  before the change by design (a bugfix's T-02, "the neighbouring behaviour still works") is named there too: say so
  when you present doctor's verdict; don't make it fail artificially.
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

## Project checks and suite evidence

Task runs prove tasks; a feature is done when the **whole project's checks** pass on the final code. Name them once:

- `spec_init {checks: {"test": "npm test", "lint": "npm run lint", "typecheck": "npx tsc --noEmit"}}` (CLI
  `dev-spec init --check test="npm test" --check lint="npm run lint"`; `name=` with no command removes one) — stored in
  `roadmap.json → meta.checks`; the other checks are kept.
- Every task brief lists them in its definition of done (`projectChecks`).
- Once they are set, **`spec_finish` needs a passing recorded run of each since the feature's last task activity**
  (the last tick or task run) — blocker **`suite-evidence`**, with `suiteChecks` [{name, command, status}] where status
  is `pass` · `no-run` · `failed` · `changed` (the configured command changed since the run) · `before-last-tick`.
  Doctor warns `suite-evidence` once every task is done; the execution sign-off refuses it too.
- Record them: `spec_finish {name, evidence: [{name, command, exitCode, summary}]}` (each `name` a `meta.checks` name,
  run from the project root — recorded in `.state.json → finishChecks` before the readiness is computed, so one call
  can make the feature ready; a failed run is recorded and stays a blocker), or let the CLI run them:
  `dev-spec finish <feature> --run [--shell bash]`.

Without `meta.checks` nothing changes: `/spec-finish` lists "run the full suite" among the fresh checks to confirm.

## Evidence linked to git

`dev-spec done --run` and `finish --run` also record the git commit the run was made on and whether the tree was dirty
(outside `.specs/`) when git is available — context, not proof; the merge summary tags runs `@sha` (`-dirty`).
`dev-spec log <feature>` reads `git log` (read-only, local) and lists per task the commits that cite it — "task #N" with
the feature name, as `/spec-commit` writes `Part of .specs/<feature>/ task #N.`, or its T- / AC IDs ("Makes T-01
green") — and, on +tdd, a **red-first check**: an implementation committed before its test. Commit with the
`/spec-commit` conventions and that history reads itself.

## The end-of-turn evidence gate (Claude Code)

The plugin's **Stop** hook reads your closing message. When it **claims** the work is done or verified (EN/PT/ES:
"all done", "task 3 is complete", "tests pass", "verified"…) while a feature active in the last few hours has ticked
tasks without verification evidence — or, every task done, project checks without a passing run — it sends the turn
back with the reason: which feature, which tasks and why (`#3 (latest run failed)`), and what to do. It never fires on
a question, a negated or conditional claim ("not verified yet", "once the tests pass"), quoted or code text, or an
honest admission ("task 3 is not verified", "2 failing") — the right answer is to run the check
(`dev-spec done <f> <n> --run`), record the evidence, or **say plainly what is not verified**; never reword a claim
to slip past it.

- **SubagentStop** (the `spec-implementer` agent only): its DONE is checked against its report — the report file
  `.specs/<feature>/.execution/task-N-report.md` (named in the reply) must carry each runnable `_Verify:_` command of the
  task and an exit code. BLOCKED / NEEDS_CONTEXT, or a task without a runnable `_Verify:_`, pass
  (`references/subagent-execution.md`).
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
| `stale-evidence` | The record no longer proves this task: `spec_impact --reopen` marked it stale (the spec it proved changed), or it was recorded for an earlier `_Verify:_` command / another task that held the number | Run the check again on the current code |
| `duplicate-number` | Another task shares this number and the record isn't this task's | Renumber the tasks (doctor warns `duplicate-tasks`) |
| `unexpected-pass` | The task is marked `_Expect: fail_`, but its latest run passed with no red run before it | Make the test fail for the right reason and record that run (or drop the marker) |

**Duplicate numbers.** `spec_complete_task`, `spec_task_brief` and `done --run` resolve a duplicated number to
its first **open** task, and evidence is stamped per task, so one "3." never borrows the other's passing run.
Humans still read them as one task — renumber when doctor warns. `01` is task 1.

**Bugfix gate.** In a bugfix, tasks after the root-cause task are refused (nothing recorded, nothing ticked)
until `bug.md → Root Cause` is filled (`references/bugfix.md`).

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
