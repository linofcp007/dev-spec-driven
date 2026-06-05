---
description: Phase 5 — break the design into ordered, traceable tasks with the right markers per track. PT - tarefas rastreáveis. ES - tareas trazables.
argument-hint: "[feature name]"
---

Use the **dev-spec-driven** skill, Phase 5 (Tasks).

Feature: $ARGUMENTS

Decompose the design into ordered tasks (~30 min–2 h each): foundation → business logic → API → UI
→ observability → load/eval. Write `tasks.md` (numbers ARE the order; 2–4 sub-steps each). Add
traceability markers: `_Requirements: …_` always; `_Makes green: T-…_` (+tdd); `_Emits metrics: …_`
plus an observability task and a hot-path load-test task (+saas); `_Affects evals: …_`, a separate
task per prompt change, and a cost-monitoring task (+ai). Run the `trace_check` MCP tool and close
any gap it reports (every AC must map to ≥1 task). Present for review.
