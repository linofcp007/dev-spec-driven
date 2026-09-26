---
name: Plans before coding on "spec and build" (EN)
description: A non-trivial feature asked as "spec and build" — the agent must start the spec (Phase 0 / requirements) and stop at a gate; no implementation file may be written in this run.
tags:
  - behavior
  - en
runs: 2
max_turns: 16
timeout_seconds: 480
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite, Write, Edit]
---
Spec and build a monthly sales report for this orders app: totals per month and per customer, printed as a table or exported as CSV, with an optional --from/--to date range.
