---
type: regex
target: last_message
flags: m
pattern: '^(?![^\n]*✅)(?=[^\n]*src/notes-report\.js:\d+)'
---
A line that is not a ✅ cites `src/notes-report.js:<line>` — the stale caller outside the diff.
