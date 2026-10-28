# Load Test: Usage Metering

## Scenarios
- Steady state · Burst · Soak · Spike · Breakpoint (the run that saturates the system)

## Budget (from design.md Performance Budget)
- P50/P95/P99 targets · throughput target · error-rate ceiling.

## Tooling
- k6 / Artillery script location: []

## Pass Criteria
Measured P50/P95/P99 ≤ budget at target throughput, error rate < [0.1]%.
- Runs per scenario: [how many runs, e.g. 3] — every run meets the budget, not only their average; write the spread next to the result
- Limit: [what stops the throughput going higher: CPU, a lock, a connection pool, the database, the network or the load generator itself] — read from the resource use during a run that saturates the system, not guessed from the code
