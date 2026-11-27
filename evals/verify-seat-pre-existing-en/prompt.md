---
name: Verify pass refutes a finding on a line older than the diff (EN)
description: 'The finding (money as a float in rushFee, src/api.js) is real code, but the line is unchanged since BASE — a context line of the package. The verifier must refute it as pre-existing.'
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
