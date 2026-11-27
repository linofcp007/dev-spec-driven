---
name: Verify pass confirms an acceptance criterion nothing delivers (EN)
description: 'The finding is an ❌: US-1.AC-2 (refuse a text over 500 characters) has no code at HEAD, and the report only says the client limits it. An ❌ is CONFIRMED or REFUTED, never UNCONFIRMED.'
tags:
  - review-seat
  - en
runs: 3
max_turns: 12
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep]
---
Run the plugin's verify pass on one finding of the task 1 review of note-edits: dispatch the
`dev-spec-driven:spec-verifier` agent with model `haiku` and, as its prompt, the text of
`.specs/note-edits/.execution/dispatch.md`. Don't judge the finding yourself. When it returns, reply with its reply exactly
as it came back.
