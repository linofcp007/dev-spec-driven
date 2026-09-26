# Constitution

Non-negotiable principles every feature must obey.

## Principles
1. No runtime dependencies: Node core only.
2. Every behaviour change ships with a test that names its T-ID.
3. Output formats are stable: a column is never renamed or reordered without a new flag.

## Constraints
- Node >= 20.

## Decision Rules
- Prefer boring, proven code over clever code.
