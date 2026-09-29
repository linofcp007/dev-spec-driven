---
description: Phase 3 (+tdd) — enumerate every test, map each to AC IDs, choose layers and kind (example / property). PT - plano de testes (+tdd). ES - plan de pruebas (+tdd).
argument-hint: "[feature name]"
---

Use the **dev-spec-driven** skill, Phase 3 (Test Plan). Only relevant when the feature is on the
**+tdd** track.

Feature: $ARGUMENTS

Re-read requirements + design. Plan ≥1 test per AC (negative tests for every IF/THEN, boundary
tests for limits). Assign stable test IDs (T-01 …), map each to AC IDs, and pick a layer
(unit/integration/E2E) per the pyramid. Fill the matrix's **Kind** column (English-stable values):
`example` — one concrete input → expected output, the default for event-driven criteria (WHEN …, IF … THEN);
`property` — an invariant checked over generated inputs (fast-check, Hypothesis, jqwik…), for ubiquitous
"always / never / for every" criteria, WHILE criteria, tenant isolation, round-trips, totals that must balance.
Name a concrete test path in the **File** column when you know it — `trace_check {code: true}` then looks for the
T-ID in that file. On +saas add tenant-isolation, rate-limit, idempotency, authorization-matrix, and audit-log
tests; on +sec one abuse-case test per material threat (401 / 403 + audit event, no secret in responses or logs —
the "never" rules are `property` rows; `references/security-track.md`); on +privacy export, erasure-in-every-store
and retention-expiry tests (`references/privacy-track.md`); on +dist failure-injection tests — a crash between the
commit and the publish, the same message twice (a `property` row), concurrent updates, a dependency down
(`references/distributed-data-patterns.md`); on +api contract tests against the spec, an Idempotency-Key replay (a
`property` row), a stale If-Match (412) and the breaking-change diff (`references/api-design-patterns.md`); on +ui a keyboard-only walk-through with an
automated accessibility check, the form-error behaviour (a `property` row), visual regression of the view's states and the
failed-load state (`references/ui-design-patterns.md`); on +obs the telemetry of every request (a `property` row), an alert firing in a
staged failure, a rollback drill and fault injection on a dependency (`references/observability-patterns.md`). Cover edge cases (`EC-n`), NFRs and success criteria (`SC-nnn`) too — `trace_check` warns about the ones no
row covers. The Coverage Check must show every AC appears in ≥1 test. Write `test-plan.md` (no template
placeholders left — the test-plan gate refuses them) and present for approval — no test code yet. See
`references/test-patterns.md` (Property-Based Tests; Test IDs in test names).
