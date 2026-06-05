---
description: Phase 3 (+tdd) — enumerate every test, map each to AC IDs, and choose layers. PT - plano de testes (+tdd). ES - plan de pruebas (+tdd).
argument-hint: "[feature name]"
---

Use the **dev-spec-driven** skill, Phase 3 (Test Plan). Only relevant when the feature is on the
**+tdd** track.

Feature: $ARGUMENTS

Re-read requirements + design. Plan ≥1 test per AC (negative tests for every IF/THEN, boundary
tests for limits). Assign stable test IDs (T-01 …), map each to AC IDs, and pick a layer
(unit/integration/E2E) per the pyramid. On +saas add tenant-isolation, rate-limit, idempotency,
authorization-matrix, and audit-log tests. The Coverage Check must show every AC appears in ≥1
test. Write `test-plan.md` and present for approval — no test code yet. See
`references/test-patterns.md`.
