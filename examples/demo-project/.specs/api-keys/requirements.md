# Feature: API Keys

## Summary
Per-tenant API keys that let a tenant's services authenticate to our API, with rotation and revocation.

## User Stories (prioritized — each independently testable)

Priorities: **P1** = critical, a viable MVP on its own · **P2** = secondary · **P3** = enhancement.

### US-1 (P1 — MVP): Create and use an API key
**As a** tenant admin, **I want** to create an API key and call the API with it, **so that** my services can authenticate without a user session.
**Why P1:** without create + authenticate there is no feature; this slice already delivers value.
**Independent Test:** Create a key, call `GET /v1/ping` with it, get 200; call with a bad key, get 401 — no other story needed.

#### Acceptance Criteria (EARS)
1. **US-1.AC-1** — WHEN a tenant admin requests a new key, THE SYSTEM SHALL return a key shown once, store only its hash, and record its prefix.
2. **US-1.AC-2** — WHEN a request presents a valid, non-expired, non-revoked key, THE SYSTEM SHALL authenticate it as the owning tenant within 50ms at P95.
3. **US-1.AC-3** — IF a request presents a revoked or expired key, THEN THE SYSTEM SHALL respond 401 and log the key prefix only.
4. **US-1.AC-4** — WHEN any key is used, THE SYSTEM SHALL NOT grant access to any resource whose tenant_id != the key's tenant.

### US-2 (P2): Rotate a key
**As a** tenant admin, **I want** to rotate a key, **so that** I can replace a possibly-leaked credential without downtime.
**Independent Test:** Rotate a key; the old key keeps working during a grace window, the new key works immediately.

#### Acceptance Criteria (EARS)
1. **US-2.AC-1** — WHEN a key is rotated, THE SYSTEM SHALL issue a new key and keep the old key valid for a 24-hour grace window, then auto-revoke it.

## Success Criteria (measurable, technology-agnostic)
- **SC-001** — 99% of authenticated API requests are authorized in under 50ms (server-side).
- **SC-002** — Zero cross-tenant accesses in a 10,000-request adversarial isolation probe.

## Edge Cases & Error Handling
- **EC-1** — Malformed Authorization header: respond 401 without a stack trace.
- **EC-2** — Key for a deleted tenant: treat as revoked.

## Non-Functional Requirements
- **NFR-1** — Key verification adds < 5ms overhead beyond a cache hit.

## Out of Scope
- OAuth / user-facing login (separate feature). Per-key scopes/permissions (future P3).

## Assumptions
- Tenants already exist; a tenant admin role is established.
