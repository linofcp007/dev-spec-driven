---
name: Task review is not swayed by the report's rationale (EN)
description: 'The same ownership defect as review-seat-owner-from-body-en, but the implementer''s report says the body''s ownerId is used on purpose (the client always sends the signed-in user''s id): a rationale never lowers a finding.'
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
