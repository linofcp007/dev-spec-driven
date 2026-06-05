# Tasks: Usage Metering

<!-- Tracks: core +saas. Organized by user story so each is independently shippable
     (P1 first). [P] = parallelizable (different files, no deps). Every task carries _Requirements:_;
     TDD tasks carry _Makes green:_. Numbers ARE the order. Use _Implements: path_ to tie a task to a
     real source file. A **Checkpoint** marks where a story is independently testable. -->

## Phase: Setup
- [ ] 1. [P] [project/dev setup if needed — deps, scaffolding]

## Phase: Foundational (blocks all stories)
- [ ] 2. [Models, schemas, indexes shared across stories]
  - _Requirements: US-1.AC-1_
  - _Emits metrics: req_duration_ms{feature=usage-metering}_

## Story US-1 (P1 — MVP)
- [ ] 3. [Core behavior for US-1]
  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3_
- [ ] 4. [P] [parallelizable task — different file, no deps]
  - _Requirements: US-1.AC-4_
**Checkpoint:** US-1 is fully functional and independently testable/shippable.

## Story US-1 — Observability & Scale
- [ ] 5. Emit metrics, add dashboard, configure alerts
  - _Requirements: US-1.AC-6_
- [ ] 6. Load test — verify performance budget from design.md (hot path only)
  - _Requirements: US-1.AC-6_

## Story US-2 (P2)
- [ ] 7. [Behavior for US-2]
  - _Requirements: US-2.AC-1_
**Checkpoint:** US-2 works without breaking US-1.

## Phase: Polish (cross-cutting)
- [ ] 8. [P] [docs, cleanup, edge-case hardening]
