# Observability Standards

## Logging
Structured JSON to stdout. Required fields: ts, level, service, trace_id, span_id, tenant_id (when known), msg, event. Never a secret, a token or PII — an API key is logged by its 8-char prefix only.

## Metrics
Prometheus-style snake_case + unit suffix. Per feature: request count, duration histogram, error count, one business counter. No tenant_id label (cardinality) — per-tenant views come from logs.

## Traces
OpenTelemetry, W3C context. Sample 10% in prod, always sample errors.

## Alerts (each links a runbook)
- P0 page now / P1 ≤15min / P2 slack / P3 digest.
