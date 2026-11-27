---
type: regex
target: last_message
flags: m
pattern: '^(?![^\n]*✅)(?=[^\n]*test/csv\.test\.js(?::\d+|[^\n]*T-02))'
---
A line that is not a ✅ cites `test/csv.test.js` with a line number or T-02 — the relaxed assertion.
