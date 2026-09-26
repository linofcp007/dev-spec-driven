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
for +saas; quality, latency, cost, refusal, injection-resistance for +ai). Replace every template
placeholder — the requirements gate refuses an approval while any remains. Run the `ears_validate`
MCP tool to catch missing SHALL, missing IDs, vague words and leftover placeholders (issue `code`s: `no-modal`,
`no-id`, `vague`, `placeholder`, `no-keyword`, `needs-clarification`), fix what it flags, run `/clarify`
(`spec_clarify`) for the remaining gaps — or `/grill` for a deeper interrogation — then present for
approval. See `references/ears-guide.md`.
