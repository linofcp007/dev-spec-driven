---
name: Evidencia registrada al marcar una tarea (ES)
description: The user reports the verification run of task 2 (its _Verify:_ command, exit 0) — the agent must tick it through spec_complete_task with {command, exitCode}, never with a bare tick or by editing tasks.md.
tags:
  - behavior
  - evidence
  - es
runs: 2
max_turns: 10
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite, Write, Edit]
---
Ya terminé la tarea 2 de exportar-csv y ejecuté `node --test test/cli.test.js`: 1 test, 1 pass, 0 fail, código de salida 0. Márcala como hecha.
