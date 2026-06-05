# Observability Standards

## Logging
Structured JSON. Required fields: ts, level, service, trace_id, span_id, tenant_id?, user_id?, msg, event. No secrets/PII.

## Metrics
Prometheus-style snake_case + unit suffix. Per feature: request count, duration histogram, error count, one business counter. Beware label cardinality.

## Traces
OpenTelemetry, W3C context. Sample 10% in prod, always sample errors.

## Alerts (each links a runbook)
- P0 page now / P1 ≤15min / P2 slack / P3 digest.
