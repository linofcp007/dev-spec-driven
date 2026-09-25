---
description: Phase 5 — break the design into ordered, traceable tasks with the right markers per track. PT - tarefas rastreáveis. ES - tareas trazables.
argument-hint: "[feature name]"
---

Use the **dev-spec-driven** skill, Phase 5 (Tasks).

Feature: $ARGUMENTS

Decompose the design into ordered tasks (~30 min–2 h each): foundation → business logic → API → UI
→ observability → load/eval. Write `tasks.md` (numbers ARE the order; 2–4 sub-steps each). Add
traceability markers: `_Requirements: …_` and `_Verify: <command>_` always (the command whose exit code
proves the task — `spec_complete_task` refuses the tick on a non-zero one; on +tdd make it the command
that runs *that task's* target tests, since the full suite stays red until the last task);
`_Makes green: T-…_` (+tdd); `_Emits metrics: …_`
plus an observability task and a hot-path load-test task (+saas); `_Affects evals: …_`, a separate
task per prompt change, and a cost-monitoring task (+ai); `_Implements: path_` on tasks that touch real files.
Replace every scaffold placeholder task and keep task numbers unique — the tasks gate refuses placeholder tasks.
Run the `trace_check` MCP tool and close any gap it reports (every AC must map to ≥1 task; its warnings name
edge cases / NFRs / success criteria nothing covers). Present for review. Tasks added after approval go through
`spec_append_tasks` (`/spec-converge`), never by renumbering.
