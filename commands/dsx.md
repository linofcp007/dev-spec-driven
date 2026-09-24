---
description: Short alias for /executeTask — implement the next task (--subagents for implementer + reviewer per task). Atalho de execução. Atajo de ejecución.
argument-hint: "[feature name | task number | 'next'] [--subagents]"
---

Use the **dev-spec-driven** skill, Phase 6 (Execute). Short alias for `/executeTask`.

Target: $ARGUMENTS

Use `spec_next_task` to find the next task (or jump to the given number), pick the loop per track
(core implement-and-test / +tdd red-green-refactor / +ai prompt-iteration), and call
`spec_complete_task {evidence}` (the `_Verify:_` command and its exit code) when each goes green. With `--subagents`, follow
`references/subagent-execution.md` instead (`spec_task_brief` → `dev-spec-driven:spec-implementer` → `dev-spec-driven:spec-reviewer` →
`spec_complete_task` after a clean review, stopping at each `**Checkpoint:**`). Respond in the user's
language (EN/PT/ES).
