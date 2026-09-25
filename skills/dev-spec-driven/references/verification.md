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
- **CLI:** `dev-spec done <feature> <n> --run` runs the task's `_Verify:_` command(s) from the project root
  and records the evidence; any failure leaves the task open, is recorded, and exits 1. `--shell bash` (or
  `DEV_SPEC_SHELL`) picks the shell. On Windows the default shell is cmd.exe, which has no single quotes and never
  expands `$VAR` — `node -e 'process.exit(1)'` exits 0 there — so a `_Verify:_` in POSIX syntax is refused before
  anything runs: re-run with `--shell bash` (Git Bash), or `--shell cmd` to run it under cmd.exe anyway. Or report it by hand: `--evidence "14/14 passing" --exit 0 --cmd "npm test"`.
- **Briefs** (`spec_task_brief`) carry the `_Verify:_` command and require the implementer to paste the
  command, exit code and output tail in the report; the reviewer checks it is there.

### Why a task is unverified — stable reason codes

`spec_complete_task` returns `verified`. When it is false, `unverifiedReason` (plus a localized `note`) is present
if the task has a runnable `_Verify:_` or a recorded run/note — branch on the code, never on the `note`. A task with
no runnable `_Verify:_` and nothing recorded comes back `verified: false` with **no** `unverifiedReason`, and
doctor, finish and the roadmap do not count it as unverified. Everywhere else they label each task the same way.

| Code | Meaning | What to do |
|---|---|---|
| `no-evidence` | Nothing recorded for this task | Run its `_Verify:_` and record the run |
| `failed-run` | The latest recorded run exited non-zero | Fix, re-run, record the passing run |
| `manual-note-on-runnable-verify` | Only a note was given, but `_Verify:_` holds a command | Run the command; record `{command, exitCode}` |
| `stale-evidence` | The record no longer proves this task: `spec_impact --reopen` marked it stale (the spec it proved changed), or it was recorded for an earlier `_Verify:_` command / another task that held the number | Run the check again on the current code |
| `duplicate-number` | Another task shares this number and the record isn't this task's | Renumber the tasks (doctor warns `duplicate-tasks`) |

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
| Regression test works | red → green cycle observed (fails without the fix, passes with it) | passing once |
| Requirements met | each AC checked against the code/tests (by ID) | "tests pass" |
| A subagent finished | the diff reviewed + its evidence present in the report | the subagent saying "DONE" |

## Red flags — stop and run the command

"should", "probably", "seems to", "looks correct" · satisfaction before running anything ("Done!",
"Perfect!") · about to commit / merge / push without a fresh run · trusting a report you didn't check ·
"just this once" · being tired and wanting it over.
