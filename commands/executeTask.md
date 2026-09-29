---
description: Phase 6 — implement tasks in order, choosing the loop (core / red-green-refactor / prompt-iteration) per task; --subagents dispatches an implementer + reviewer per task. PT - executa as tarefas. ES - ejecuta las tareas.
argument-hint: "[feature name | task number | 'next'] [--subagents]"
---

Use the **dev-spec-driven** skill, Phase 6 (Execute).

Target: $ARGUMENTS

**Inline (default).** Before coding, re-read steering, requirements, design, any test/eval plans, and
tasks; summarize your understanding. Use `spec_next_task` to find the next task (or jump to the given
number) — the first open task whose `_Depends: 3, 5_` tasks are all done (a task without `_Depends:_` just follows
tasks.md order). Pick the loop per task: plain implement-and-test (core); red → green → refactor against the
target tests (+tdd) — as the **micro-cycle**, one behaviour at a time: write (or pick) the test, watch it fail for
the right reason (an assertion or "not implemented" — not a typo or a missing import), write the minimal code, watch
it pass, refactor only on green, repeat; code written before its test is deleted and redone, never kept as a
reference (`references/test-patterns.md` — "The micro-cycle inside a task", with the rationalizations it answers and
its red flags for a NEW behaviour's test: a test that passes on its first run, a failure you can't explain, a test
written after the code — while a guard test, a characterization test of existing code and a planned T-ID an earlier
task already turned green pass on their first run by design: never make them fail artificially);
prompt-iteration gated on eval delta with a new `prompts/vN.md` (+ai). After each
task, run its `_Verify:_` command fresh and call `spec_complete_task {…, evidence}` with the command, exit
code and output summary — evidence before claims (`references/verification.md`). The rules the engine applies:
- a task whose `_Verify:_` holds a runnable command is **verified only by `{command, exitCode: 0}`** — a text
  note ticks it but leaves it unverified (`unverifiedReason: manual-note-on-runnable-verify`);
- a **non-zero exit code refuses the tick** (except on an `_Expect: fail_` task, whose failing run is its proof) and the failed run is **recorded** (a failed re-check of a ticked task
  makes it unverified until a passing run is recorded) — a failing run means the task is not done;
- evidence marked **stale** by `/spec-impact --reopen` (or recorded for an earlier `_Verify:_` command) no longer
  counts: run the check again;
- duplicate task numbers resolve to the first open one — renumber them (doctor warns `duplicate-tasks`);
- a bugfix refuses tasks after the root-cause task until `bug.md → Root Cause` is filled;
- a task whose `_Depends:_` tasks are not all done is skipped by `spec_next_task` (`skipped`); ticking it anyway is
  recorded — with `waitsOn` and a note, never refused — so do its dependencies first. No open task able to start
  (`blocked`: a cycle, or a `_Depends:_` naming no task) means the plan is wrong: `spec_doctor` fails `task-deps` — fix
  the markers in tasks.md and re-approve the tasks phase;
- a task marked **`_Expect: fail_`** (it writes a test before its code) is proven by a **failing** run — record the
  red run; a passing one is refused (`unexpected-pass`: the test doesn't fail yet), and so is a failing one whose
  output shows the test never ran — a missing test file, module or script (`couldNotRun`);
- a `_Verify:_` that pipes (`npm test | tee log`) reports the last command's exit code — the tick carries
  `pipeMasked`; drop the pipe or `set -o pipefail`.
CLI: `dev-spec done <feature> <n> --run` runs the task's `_Verify:_` and records the result (with the git commit);
a run that could not happen (no shell, a signal, `--timeout <seconds>`) records nothing.
Ticked the wrong task, or its work turned out incomplete? **Undo the tick** — never edit the checkbox by hand:
`spec_complete_task {name, number, undo: true, reason}` (CLI `dev-spec undone <feature> <n> --reason "…"`). The task
is open again, its evidence turns stale (a re-tick needs a NEW run — `stale-evidence`, labelled unticked), and
`.state.json → unticks` records it; a finished or signed-off feature must be finished and signed off again once the
task is done.

**Can't run the `_Verify:_` command yourself** (no shell, no runtime in this session)? **Do not tick the task** — not
bare, not with a note, never with an exit code nobody saw. Name the command and ask the user to run it and paste the
output (or to run `dev-spec done <feature> <n> --run`); record exactly what they report
(`{command, exitCode, summary}`). Tick it unverified only if the user explicitly asks for exactly that, and say it
stays unverified. In Claude Code the Stop hook sends back a closing "done" / "tests pass" while a ticked task has no
passing evidence — the fix is the run, or saying plainly what is not verified. With project checks set
(`meta.checks`), each brief lists them; run them before calling a task done.

**`--subagents` (or the user asks for subagents).** Follow `references/subagent-execution.md`: check the
preconditions (`spec_doctor` ready + tasks approved, not on the default branch, `trace_check` passes,
baseline green: run the full suite once and ledger the result),
then per task `spec_task_brief {write:true}` → dispatch the `dev-spec-driven:spec-implementer` agent with the brief and
report paths → write the diff to `.execution/task-N-review.diff` → dispatch the `dev-spec-driven:spec-reviewer` agent →
fix loop (max 5 rounds) → `spec_complete_task` only after a clean review, with the evidence from the implementer's
report (the SubagentStop hook sends back a DONE whose report lacks each `_Verify:_` command with the exit code the task
needs — 0, or non-zero on an `_Expect: fail_` task). Keep
the ledger. Stop at every `**Checkpoint:**` for human review, and go back to the right phase for any finding that would change an
AC, the design or a planned test. Tasks the brief flags `inlineOnly` (+ai prompt/eval) run inline. If the
host has no subagent tool, say so and run inline. Independent `[P]` tasks may run concurrently in separate
worktrees (`spec_next_task {batch:true}`, parallel mode in the protocol) — or dispatch the plan wave by wave:
`spec_next_task {waves:true}` (CLI `dev-spec next <feature> --waves`) lists the waves (a wave's tasks have their
dependencies done or in earlier waves and share no `_Implements:_` file); run one wave, merge and review it, then the next.

When the last task is done, run `/spec-converge` if you doubt every AC is delivered, then close with `/spec-finish`.

Either way: honor the track-gated "done" checks before finishing the feature: load test + observability
validation (+saas), cost + safety validation (+ai), security scans + threat model re-check (+sec), data subject
rights + retention verified (+privacy), failure-injection tests green (+dist), contract tests + the breaking-change diff green (+api). A decision or discovery made on the way goes to `/spec-decide`. If blocked,
pause and discuss rather than improvising outside the design. Respond in the user's language (EN/PT/ES).
