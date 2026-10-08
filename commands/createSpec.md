---
description: Phase 1 — write EARS requirements with stable AC IDs for a feature. PT - escreve requisitos EARS. ES - escribe requisitos EARS.
argument-hint: "[feature name]"
---

Use the **dev-spec-driven** skill, Phase 1 (Requirements).

Feature: $ARGUMENTS

Read the steering files first. Ask clarifying questions — don't guess. If the feature isn't scaffolded
yet (Phase 0 approved), run `spec_create {name, tracks, lang}` once (or write by hand): the track set and the
language are persisted in `.specs/<feature>/.state.json`, and a fresh feature starts at phase `requirements`. In an
existing codebase pass `brownfield: true` (CLI `--brownfield`) to also scaffold `integration-plan.md`
(integration points · required modifications · sequencing · risks · affected files). Then fill
`requirements.md` in EARS syntax with stable AC IDs (US-1.AC-1 …), prioritized stories (P1 = MVP),
success criteria `SC-001…`, and edge cases / NFRs with their own IDs (`EC-1`, `NFR-1`).
Add the track-specific ACs the feature's classification calls for (tenant isolation / rate limits
for +saas; quality, latency, cost, refusal, injection-resistance for +ai; 401 / 403 + audit event / no secret in
responses or logs for +sec; export, erasure in every store, retention expiry for +privacy; a publish that fails after the commit still delivered, a
duplicate message applied once, no lost update, a dependency down degrading for +dist; a malformed request answered 400 problem+json, an
Idempotency-Key replay, a stale If-Match refused with 412, a breaking change only in a new version for +api; keyboard operation, a form that keeps its values and names its errors, an
empty state, a failed load with Retry for +ui; telemetry with a correlation ID, a burn-rate page, a canary that rolls back, a readiness
check for +obs; a bad row quarantined, an idempotent re-run / backfill, a freshness alert, a schema change checked for compatibility for
+data — the scaffold seeds `US-1.AC-10…35` for the last seven: make them concrete). On a design-first feature (`flow: "design-first"`) this phase
comes after the design approval: the criteria must match the approved design. Replace every template
placeholder — the requirements gate refuses an approval while any remains. Run the `ears_validate`
MCP tool to catch missing SHALL, missing IDs, vague words and leftover placeholders (issue `code`s: `no-modal`,
`no-id`, `vague`, `placeholder`, `no-keyword`, `needs-clarification`, `padded-id`), fix what it flags, run `/clarify`
(`spec_clarify`) for the remaining gaps — or `/grill` for a deeper interrogation — then present for
approval. See `references/ears-guide.md`.
