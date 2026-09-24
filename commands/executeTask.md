---
description: Phase 6 — implement tasks in order, choosing the loop (core / red-green-refactor / prompt-iteration) per task; --subagents dispatches an implementer + reviewer per task. PT - executa as tarefas. ES - ejecuta las tareas.
argument-hint: "[feature name | task number | 'next'] [--subagents]"
---

Use the **dev-spec-driven** skill, Phase 6 (Execute).

Target: $ARGUMENTS

**Inline (default).** Before coding, re-read steering, requirements, design, any test/eval plans, and
tasks; summarize your understanding. Use `spec_next_task` to find the next task (or jump to the given
number). Pick the loop per task: plain implement-and-test (core); red → green → refactor against the
target tests (+tdd); prompt-iteration gated on eval delta with a new `prompts/vN.md` (+ai). After each
task, run its `_Verify:_` command fresh and call `spec_complete_task {…, evidence}` with the command, exit
code and output summary — evidence before claims (`references/verification.md`); a failing run means the
task is not done.

**`--subagents` (or the user asks for subagents).** Follow `references/subagent-execution.md`: check the
preconditions (`spec_doctor` ready + tasks approved, not on the default branch, `trace_check` passes,
baseline green: run the full suite once and ledger the result),
then per task `spec_task_brief {write:true}` → dispatch the `dev-spec-driven:spec-implementer` agent with the brief and
report paths → write the diff to `.execution/task-N-review.diff` → dispatch the `dev-spec-driven:spec-reviewer` agent →
fix loop (max 5 rounds) → `spec_complete_task` only after a clean review. Keep the ledger. Stop at every
`**Checkpoint:**` for human review, and go back to the right phase for any finding that would change an
AC, the design or a planned test. Tasks the brief flags `inlineOnly` (+ai prompt/eval) run inline. If the
host has no subagent tool, say so and run inline. Independent `[P]` tasks may run concurrently in separate
worktrees (`spec_next_task {batch:true}`, parallel mode in the protocol).

When the last task is done, close with `/spec-finish`.

Either way: honor the track-gated "done" checks before finishing the feature: load test + observability
validation (+saas), cost + safety validation (+ai). If blocked, pause and discuss rather than
improvising outside the design. Respond in the user's language (EN/PT/ES).
