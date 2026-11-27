---
type: regex
target: last_message
flags: m
pattern: '^(?![^\n]*✅)(?=[^\n]*src/api\.js:\d+)(?=[^\n]*(?:ownerId|req\.body))'
---
A line that is not a ✅ cites `src/api.js:<line>` and names the id taken from the body (`ownerId` / `req.body`) — the finding
or the ❌ on US-1.AC-3, not a passing verdict.
