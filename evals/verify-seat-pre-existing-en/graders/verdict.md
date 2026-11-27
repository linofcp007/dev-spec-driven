---
type: regex
target: last_message
pattern: '\*\*Confidence:\*\*\s*(?:[0-9]|[1-4][0-9])\b|\*\*Verdict:(?:\*\*)?\s*REFUTED\b'
---
The finding is refuted as the controller reads it: a confidence under 50 (subagent-execution.md §6 — under 50 → refuted)
or the verdict REFUTED. The 1.42 reference run's three right replies wrote `**Confidence:** 0` with `**Verdict:** pre-existing`
(twice) and `**Verdict: REFUTED — pre-existing**` — mcp/tests/17-docs-evals.js holds them.
