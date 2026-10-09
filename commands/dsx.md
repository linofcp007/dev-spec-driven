---
description: Short alias for /executeTask — implement the next task (--subagents for an implementer + reviewer per task).
disable-model-invocation: true
argument-hint: "[feature name | task number | 'next'] [--subagents]"
---

Short alias for `/executeTask` — the **dev-spec-driven** skill, Phase 6 (Execute).

Target: $ARGUMENTS

Read `${CLAUDE_PLUGIN_ROOT}/commands/executeTask.md` and follow it exactly, with the target above as its arguments:
that file is the whole procedure (this alias adds nothing of its own and leaves nothing out). Should it be unreadable,
these rules still hold:
- `spec_next_task` finds the next task (or jump to the given number) — the first open one whose `_Depends:_` tasks are
  all done; a skipped or `blocked` task means do its dependencies first or fix the plan, never tick around it.
- Pick the loop per track: core implement-and-test; +tdd red → green → refactor as the **micro-cycle**, one behaviour
  at a time (the test first, watch it fail for the right reason, the minimal code, refactor only on green — code
  written before its test is redone); +ai prompt-iteration gated on the eval delta.
- Stay inside the task's `_Implements:_` files: a change elsewhere is a plan change (the scope guard asks — add a task
  with `spec_append_tasks`); a refactor you notice is filed with `spec_backlog`, not done.
- Tick with `spec_complete_task {evidence}` — the `_Verify:_` command itself and its exit code (a note alone leaves a
  runnable `_Verify:_` unverified, a failed run is recorded and refuses the tick, an `_Expect: fail_` task needs its
  failing red run). No shell to run it? Don't tick — ask the user for the output (or
  `node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" done <feature> <n> --run`).
- With `--subagents`, follow `references/subagent-execution.md` (`spec_task_brief` → `dev-spec-driven:spec-implementer`
  → `dev-spec-driven:spec-reviewer` → `spec_complete_task` after a clean review, stopping at each `**Checkpoint:**`).

Respond in the user's language (EN/PT/ES).
