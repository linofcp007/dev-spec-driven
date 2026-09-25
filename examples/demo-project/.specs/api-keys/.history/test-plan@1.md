# Test Plan: API Keys

## Strategy
- **Test runner:** Vitest (unit/integration), with an in-memory Postgres + Redis for integration.
- **Mocking approach:** real DB/cache in integration; clock injected for expiry/grace tests.
- **Coverage target:** 90% lines; 100% branch on the verify + isolation paths.
- **Critical paths requiring 100% branch coverage:** verify(), tenant scoping, grace-window revoke.

## Traceability Matrix

| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |
|---------|-------|------|-------------|-----------------|------|
| T-01 | unit | example | create returns token once and stores only its hash + prefix | US-1.AC-1 | `tests/unit/create.test.ts` |
| T-02 | integration | example | a valid key authenticates as the owning tenant (<50ms) | US-1.AC-2 | `tests/integration/verify.test.ts` |
| T-03 | integration | example | a revoked or expired key returns 401, logs prefix only | US-1.AC-3 | `tests/integration/verify.test.ts` |
| T-04 | integration | property | for any two tenants, a key of A never reads tenant B data (generated tenants + keys) | US-1.AC-4 | `tests/integration/isolation.test.ts` |
| T-05 | integration | example | rotate issues a new key; old key valid for the grace window then auto-revokes | US-2.AC-1 | `tests/integration/rotate.test.ts` |
| T-06 | integration | example | a malformed Authorization header returns 401 with no stack trace | EC-1 | `tests/integration/verify.test.ts` |
| T-07 | integration | example | a key whose tenant was deleted is treated as revoked (401) | EC-2 | `tests/integration/verify.test.ts` |

## Coverage Check
Every AC appears in at least one "Covers" cell (US-1.AC-1..4, US-2.AC-1). No gaps. The edge cases are
covered too (EC-1 by T-06, EC-2 by T-07); NFR-1 and SC-001 are measured by the load test (task 8).

## Test Data & Fixtures
- Two seed tenants (A, B) for the isolation probe; a clock helper for expiry/grace.

## Out of Scope for Testing
- Load/latency SLO is validated by `load-test.md`, not the unit/integration suite.
