---
description: Short alias for /executeTask — implement the next task with evidence (--subagents for an implementer + reviewer).
disable-model-invocation: true
argument-hint: "[feature | task number] [--subagents] | commit [note]"
---

Short alias for `/executeTask` — the **dev-spec-driven** skill, Phase 6 (Execute). Target: $ARGUMENTS

Read `${CLAUDE_PLUGIN_ROOT}/commands/executeTask.md` and follow it exactly, with the target above as its arguments: that
file is the whole procedure. Should it be unreadable, these rules still hold:
- `spec_next_task` serves the first open task whose `_Depends:_` tasks are done; a skipped or `blocked` task means do its
  dependencies first or fix the plan — never tick around it.
- +tdd: the **micro-cycle**, one behaviour at a time — the test first, watch it fail for the right reason, the minimal
  code, refactor only on green.
- Stay inside the task's `_Implements:_` files: a change elsewhere is a plan change (the scope guard asks — add a task with
  `spec_append_tasks`); a refactor you notice goes to the backlog, not into the task.
- Tick with `spec_complete_task {evidence}` — the `_Verify:_` command itself and its exit code. No shell to run it? Don't
  tick: ask the user for the output (or `node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" done <feature> <n> --run`).

Respond in the user's language (EN / PT / ES).
