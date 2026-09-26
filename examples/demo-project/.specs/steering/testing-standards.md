# Testing Standards

## Runner & Tooling
- Unit/Integration: Vitest
- E2E: the feature's quickstart.md scenario, run by hand before each release
- Mocking: real Postgres + Redis in integration tests; only the clock is injected

## Coverage Policy
- Default target: 80% lines.
- Critical paths (auth/billing/data): 100% branch.

## TDD Discipline
- No implementation before a failing test exercising the real path.
- 'Failing for the right reason' = assertion/NotImplemented, not import/syntax error.
