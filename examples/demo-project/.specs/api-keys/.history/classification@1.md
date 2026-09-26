# Classification: API Keys

## Mode
Spec

## Active Tracks
core +tdd +saas

## Signals
- **+tdd:** authentication logic ("verify", "revoke", "rotate") — a wrong branch here is a security hole, so every AC gets a failing test first.
- **+saas:** "per-tenant", "50ms at P95" — multi-tenant isolation and a latency budget on the hot path of every API request.

## Blast Radius
Every API call from every tenant goes through key verification. A bug either locks all tenants out
(recoverable in minutes by rollback) or leaks one tenant's data to another (not recoverable — a GDPR incident).

## Hot Path?
Yes — verification runs on every authenticated request, so load-test.md is required.

## Volume / Cost Projection
- Launch / 6mo / 2yr: 50 / 500 / 5,000 RPS of verifications; ~$5 / ~$40 / ~$350 per month (compute + Redis).

## Compliance Tags
GDPR · SOC2
