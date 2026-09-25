# Product

## Vision
A metered public API that small SaaS teams call from their own backends, billed per request.

## Target Users
- Primary: backend engineers at tenant companies who call the API from their services.
- Secondary: tenant admins who manage credentials and read usage.

## Success Metrics
- 200 paying tenants and a p95 API latency under 100ms six months after launch.

## Non-goals
- A consumer app or an end-user login flow — tenants authenticate machines, not people.

## Business Model
Monthly subscription per tenant plus usage-based overage (metered by `usage-metering`).
