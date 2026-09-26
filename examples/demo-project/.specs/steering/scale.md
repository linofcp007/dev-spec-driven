# Scale Targets

## Load Targets
| Horizon | Concurrent | DAU | MAU | Peak RPS | Data |
|---|---|---|---|---|---|
| Launch | 20 tenants | 60 | 100 | 50 | 5 GB |
| 6 months | 200 tenants | 600 | 1,000 | 500 | 50 GB |
| 2 years | 2,000 tenants | 6,000 | 10,000 | 5,000 | 1 TB |

## SLA Targets
| Endpoint class | P95 | P99 | Uptime |
|---|---|---|---|
| Critical journey | 100ms | 250ms | 99.9% |

## Critical User Journeys
1. A tenant's service calls the API with its key and gets an authorized response (key verification + handler).

## Escalation Thresholds
- Peak RPS above 2× the current horizon's target, or P95 over budget for 3 consecutive days → revisit the scale design.
