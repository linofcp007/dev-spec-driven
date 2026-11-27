---
type: regex
target: last_message
pattern: '\*\*Verdict:(?:\*\*)?\s*CONFIRMED\b(?![^\n]*\bUNCONFIRMED\b)'
---
The verdict is CONFIRMED (an ❌ has no confidence line: its verdict decides) — `**Verdict:** CONFIRMED` or
`**Verdict: CONFIRMED**`, the bold placement the reference run's verifier also used; never the output template's own
`CONFIRMED (80+) | UNCONFIRMED (50–79) | …` line.
