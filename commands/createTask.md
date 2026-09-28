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
that runs *that task's* target tests, since the full suite stays red until the last task; no pipe — `cmd | tee log`
reports the last command's exit code); `_Expect: fail_` on a task that writes a test before its code (its failing
run is the proof — a bugfix's regression test, a red phase); `_Makes green: T-…_` (+tdd); `_Emits metrics: …_`
plus an observability task and a hot-path load-test task (+saas); `_Affects evals: …_`, a separate
task per prompt change, and a cost-monitoring task (+ai); keep the scaffolded security tasks (threat model, authz,
secrets, security testing — its `_Verify:_` runs the scans and abuse-case tests) on +sec and the privacy tasks (data
inventory, data subject requests, retention job) on +privacy; `_Implements: path_` on tasks that touch real files. Optionally
`_Size: XS|S|M|L|XL_` (1/2/3/5/8 points) — the roadmap turns sizes and the recorded velocity into an ETA — and
`_Depends: 3, 5_` where a task needs other tasks of this tasks.md done first (without it, tasks.md order is the order):
`spec_next_task` then serves the first open task whose dependencies are done, `dev-spec next <feature> --waves` shows
what can run in parallel, and doctor / the tasks gate refuse a number no task carries or a cycle (`task-deps`).
Replace every scaffold placeholder task and keep task numbers unique — the tasks gate refuses placeholder tasks.
Run the `trace_check` MCP tool and close any gap it reports (every AC must map to ≥1 task; its warnings name
edge cases / NFRs / success criteria nothing covers). Present for review. Tasks added after approval go through
`spec_append_tasks` (`/spec-converge`), never by renumbering.
