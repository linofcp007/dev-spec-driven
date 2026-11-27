---
name: Task review approves a task that meets its criteria (EN)
description: 'Every criterion is met and tested, nothing outside the task''s files changes: the reviewer must approve — the false-positive measure.'
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
