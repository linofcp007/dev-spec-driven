# Load Test: API Keys

## Scenarios
- Steady state: 500 RPS of verified requests for 15 min (the 6-month target).
- Burst: 0 → 1,500 RPS in 30 s, held for 2 min.
- Soak: 300 RPS for 4 h (cache TTL churn, memory growth).
- Spike: a revoke storm — 1,000 keys revoked while 500 RPS runs (cache invalidation on the hot path).
- Breakpoint: ramp to 3,000 RPS over 10 min, to find the limit.

## Budget (from design.md Performance Budget)
- Verification P50 < 8ms · P95 < 50ms · P99 < 120ms at 500 RPS; verification overhead < 5ms beyond a cache hit (NFR-1); error rate < 0.1%.

## Tooling
- k6 / Artillery script location: `load/api-keys.k6.js` (k6), run against staging with two seeded tenants.

## Pass Criteria
Measured P50/P95/P99 ≤ budget at target throughput, error rate < 0.1%.
- Runs per scenario: 3 (the soak: 1, it lasts 4 h) — every run meets the budget, not only their average; the spread
  goes next to each result
- Limit: read from the breakpoint run's resource use — the Postgres primary's CPU is the expected one, once revokes
  empty the key cache
