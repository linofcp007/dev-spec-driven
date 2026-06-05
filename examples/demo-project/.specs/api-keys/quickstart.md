# Quickstart: API Keys

A human-runnable acceptance scenario — the manual smoke test that proves the feature end-to-end.

## Preconditions
- Two tenants seeded: A and B, each with a tenant-admin token.

## Steps (happy path — US-1 / P1)
1. As tenant A admin: `POST /v1/keys {"name":"ci"}` → 201 with a `token` (shown once) and a `prefix`.
2. Call `GET /v1/ping` with `Authorization: Bearer <token>` → **200**, body shows `tenant: A`.
3. **Expect:** the call is authorized in under 50ms server-side (SC-001).

## Negative path
1. Call `GET /v1/ping` with `Authorization: Bearer wrong` → **401**.
2. Revoke A's key, call again with it → **401**; check logs show only the **prefix**, never the token.

## Isolation probe (US-1.AC-4 / SC-002)
1. With tenant A's key, request a resource owned by tenant B → **404/403**, never B's data.

## Done when
- [ ] Happy path returns 200 and the right tenant.
- [ ] Bad/revoked keys return 401 and never log the token.
- [ ] Cross-tenant access is impossible (isolation probe passes).
- [ ] Verify P95 < 50ms (SC-001).
