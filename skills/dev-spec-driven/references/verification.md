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
  `.state.json → evidence`. A non-zero `exitCode` **refuses the tick**. A task with `_Verify:_` ticked
  without evidence gets a warning, and `spec_doctor` (check `verification`), `ROADMAP.md` ("needs
  attention") and `spec_finish` (a blocker) keep surfacing it until evidence is back-filled.
- **What counts as verified:** exit code `0`, or a summary-only manual attestation (for checks that
  have no command, e.g. "checked the login page by hand"). A command given without its exit code, or a
  non-integer exit code, is rejected. A failed re-check of an already-ticked task is **recorded** and the
  task becomes unverified until a passing run is recorded.
- **CLI:** `dev-spec done <feature> <n> --run` runs the task's `_Verify:_` command(s) from the project root
  and records the evidence; any failure leaves the task open and exits 1. Or report it by hand:
  `--evidence "14/14 passing" --exit 0 --cmd "npm test"`.
- **Briefs** (`spec_task_brief`) carry the `_Verify:_` command and require the implementer to paste the
  command, exit code and output tail in the report; the reviewer checks it is there.

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
