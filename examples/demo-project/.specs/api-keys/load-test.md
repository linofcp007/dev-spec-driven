# Load Test: API Keys

## Scenarios
- Steady state: 500 RPS of verified requests for 15 min (the 6-month target).
- Burst: 0 → 1,500 RPS in 30 s, held for 2 min.
- Soak: 300 RPS for 4 h (cache TTL churn, memory growth).
- Spike: a revoke storm — 1,000 keys revoked while 500 RPS runs (cache invalidation on the hot path).

## Budget (from design.md Performance Budget)
- Verification P50 < 8ms · P95 < 50ms · P99 < 120ms at 500 RPS; verification overhead < 5ms beyond a cache hit (NFR-1); error rate < 0.1%.

## Tooling
- k6 / Artillery script location: `load/api-keys.k6.js` (k6), run against staging with two seeded tenants.

## Pass Criteria
Measured P50/P95/P99 ≤ budget at target throughput, error rate < 0.1%.
