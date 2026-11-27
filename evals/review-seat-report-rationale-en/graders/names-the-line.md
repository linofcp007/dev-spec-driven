---
type: regex
target: last_message
flags: m
pattern: '^(?![^\n]*✅)(?=[^\n]*src/api\.js:\d+)(?=[^\n]*(?:ownerId|req\.body))'
---
A line that is not a ✅ cites `src/api.js:<line>` and names the id taken from the body (`ownerId` / `req.body`).
