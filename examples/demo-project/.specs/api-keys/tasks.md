# Tasks: API Keys

<!-- Organized by user story (P1 first) so each is independently shippable. Each task is tagged with
     its story: [US1]/[US2], or [shared] for cross-cutting work. [P] = parallelizable (different files,
     no deps); tag order is [US1][P]. _Requirements:_ ties a task to ACs; _Makes green:_ to tests;
     _Implements:_ to real source files (checked by `trace`). -->

## Phase: Setup
- [ ] 1. [shared][P] Add `api_keys` table migration + indexes (`hash`, `(tenant_id,status)`)

## Phase: Foundational (blocks all stories)
- [ ] 2. [shared] Key model + hashing/prefix utilities (store hash only)
  - _Requirements: US-1.AC-1_
  - _Makes green: T-01_
  - _Implements: src/api-keys/service.js_

## Story US-1 (P1 — MVP): create and use a key
- [ ] 3. [US1] Create-key endpoint (token shown once) + tenant-admin guard
  - _Requirements: US-1.AC-1_
  - _Makes green: T-01_
  - _Implements: src/api-keys/service.js_
- [ ] 4. [US1] Auth middleware: verify key, deny revoked/expired (fail closed)
  - _Requirements: US-1.AC-2, US-1.AC-3_
  - _Makes green: T-02, T-03_
  - _Implements: src/api-keys/service.js_
- [ ] 5. [US1][P] Tenant scoping + Postgres RLS; cross-tenant denied
  - _Requirements: US-1.AC-4_
  - _Makes green: T-04_
- [ ] 6. [US1][P] Observability: emit verify metrics + 401-rate alert
  - _Requirements: US-1.AC-2_
  - _Emits metrics: apikey_verify_duration_seconds{feature=api-keys}_
**Checkpoint:** US-1 is fully functional and independently testable/shippable (create + authenticate + isolate).

## Story US-2 (P2): rotate
- [ ] 7. [US2] Rotate endpoint: new key now, old key valid for 24h grace, then auto-revoke
  - _Requirements: US-2.AC-1_
  - _Makes green: T-05_
**Checkpoint:** US-2 works without breaking US-1.

## Phase: Polish (cross-cutting)
- [ ] 8. [shared][P] Run load test from load-test.md; verify P95 < 50ms (SC-001) and docs
