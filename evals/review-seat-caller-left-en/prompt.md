---
name: Task review checks the call sites of a contract the diff changed (EN)
description: 'getNote() now throws for an unknown id instead of returning null; src/notes-report.js, outside the diff, still tests for null. The reviewer must check the changed contract''s callers.'
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
