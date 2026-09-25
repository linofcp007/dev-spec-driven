---
description: Phase 4 (+tdd/+ai) — write all failing tests and/or the eval harness. The hard gate before implementation. PT - testes a falhar / harness (gate). ES - pruebas en rojo / harness (gate).
argument-hint: "[feature name]"
---

Use the **dev-spec-driven** skill, Phase 4 (Test/Eval Implementation) — the hard gate.

Feature: $ARGUMENTS

**+tdd:** Write every test from the approved test plan. **Put the T-ID in each test's name** —
`test("T-01 …")`, `def test_T01_…`, `func TestT01…`, `[Fact(DisplayName = "T-01 …")]` — in the file the plan's
File column names. Rows of Kind `property` become property-based tests (a generator + an invariant), `example`
rows concrete cases. Scaffold only stubs/signatures so tests compile — no business logic. Each test must fail
**for the right reason** (assertion / NotImplementedError, not a typo or missing import). Confirm: N written,
N red, 0 green, 0 erroring. Then run `trace_check {name, code: true}` (CLI `dev-spec trace <feature> --code`):
every planned T-ID should be found in the test code (`plannedNotInCode` empty), and no test should carry a T-ID
no plan has (`inCodeNotInPlan`). Rows whose File column names only a non-code artifact (`load-test.md`,
`evals/golden.json`) are checked outside test code (`plannedOutsideCode`) — their task's `_Verify:_` run is the
evidence. Commit `test(<feature>): scaffold failing tests …`.

**+ai:** Write the deterministic tests (validation, schema, rate limiting, logging, fallback, cost
circuit breaker) AND implement the runnable eval harness; establish and record the baseline scores.

**No implementation code is written until this gate is approved.** Present the counts (N written, N red, 0 green,
0 erroring; the `trace_check {code: true}` result) and, when the user signs off, record it with `spec_approve
{name, phase: "tests"}` (CLI `dev-spec approve <feature> tests`). The engine tracks this gate: on a +tdd / +ai
feature with a test or eval plan, `tests` stays in `pendingGates` (so `gatesOk` is false, `spec_next_action` asks
for it instead of the next task, and `spec_finish` blocks) until it is approved. The approval checks what this phase
produces: +tdd `tests-in-code` (every planned T-ID named by a test file — the T-ID in each test's name), +ai `eval-sets`
(`evals/golden.json` is this feature's own set, not the scaffold's sample); a failing check refuses it unless the user
explicitly accepts it with `force`. A bugfix has no Phase 4 gate — its failing regression test is one of its tasks.
