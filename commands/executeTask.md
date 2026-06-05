---
description: Phase 6 — implement tasks in order, choosing the loop (core / red-green-refactor / prompt-iteration) per task. PT - executa as tarefas. ES - ejecuta las tareas.
argument-hint: "[feature name | task number | 'next']"
---

Use the **dev-spec-driven** skill, Phase 6 (Execute).

Target: $ARGUMENTS

Before coding, re-read steering, requirements, design, any test/eval plans, and tasks; summarize
your understanding. Use `spec_next_task` to find the next task (or jump to the given number). Pick
the loop per task: plain implement-and-test (core); red → green → refactor against the target tests
(+tdd); prompt-iteration gated on eval delta with a new `prompts/vN.md` (+ai). After each task runs
green, call `spec_complete_task` to mark it done. Honor the track-gated "done" checks before
finishing the feature: load test + observability validation (+saas), cost + safety validation
(+ai). If blocked, pause and discuss rather than improvising outside the design.
