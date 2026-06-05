---
description: Phase 4 (+tdd/+ai) — write all failing tests and/or the eval harness. The hard gate before implementation. PT - testes a falhar / harness (gate). ES - pruebas en rojo / harness (gate).
argument-hint: "[feature name]"
---

Use the **dev-spec-driven** skill, Phase 4 (Test/Eval Implementation) — the hard gate.

Feature: $ARGUMENTS

**+tdd:** Write every test from the approved test plan. Scaffold only stubs/signatures so tests
compile — no business logic. Each test must fail **for the right reason** (assertion /
NotImplementedError, not a typo or missing import). Confirm: N written, N red, 0 green, 0 erroring.
Commit `test(<feature>): scaffold failing tests …`.

**+ai:** Write the deterministic tests (validation, schema, rate limiting, logging, fallback, cost
circuit breaker) AND implement the runnable eval harness; establish and record the baseline scores.

**No implementation code is written until this gate is approved.**
