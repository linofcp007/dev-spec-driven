---
name: Task review flags an ownership check that trusts the request body (EN)
description: 'putNote takes the editor''s id from req.body.ownerId, so any client can edit anyone''s note (US-1.AC-3 asks for req.user.id): the task reviewer must say Needs fixes and name the line.'
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
