# Tasks: csv-export

## Global Constraints
- Node >= 20 · no runtime dependencies · columns fixed as id,date,customer,total

## Story US-1 (P1 — MVP)
- [ ] 1. [US1] CSV serializer with RFC 4180 quoting
  - _Requirements: US-1.AC-2, EC-1_
  - _Implements: src/csv.js_
  - _Verify: node --test test/csv.test.js_
- [ ] 2. [US1] `--csv` flag on the CLI
  - _Requirements: US-1.AC-1, NFR-1_
  - _Implements: src/cli.js_
  - _Verify: node --test test/cli.test.js_
**Checkpoint:** US-1 is fully functional and independently testable/shippable.
