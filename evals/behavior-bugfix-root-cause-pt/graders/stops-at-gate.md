---
type: regex
target: trace
match: not_contains
pattern: '"name":"(?:Write|Edit|MultiEdit)","input":\{"file_path":"[^"]*[\\/]src[\\/]'
---
No implementation without approval: the bugfix flow approves requirements and the design (bug.md, gated on the
Root Cause), test plan and tasks BEFORE the regression test and the fix (/spec-bugfix steps 4 → 5 → 6). No human
approves anything inside this single run, so the product code under src/ must stay untouched — the run ends by
presenting the reproduction and the root cause for approval. "Corrige isto" asks for the outcome; it does not
sign off the root cause.
