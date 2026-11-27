---
name: Task review calls a relaxed assertion outside the task's files a weakened test (EN)
description: 'The diff relaxes T-02''s quoting assertion in test/csv.test.js — a file the task''s _Implements:_ doesn''t name — to assert.ok(csv.length > 0): Critical.'
tags:
  - review-seat
  - en
runs: 3
max_turns: 12
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep]
---
Run the plugin's task review of task 1 of note-edits: dispatch the `dev-spec-driven:spec-reviewer` agent with model
`sonnet` and, as its prompt, the text of `.specs/note-edits/.execution/dispatch.md`. Don't review the code yourself. When it
returns, reply with its reply exactly as it came back.
