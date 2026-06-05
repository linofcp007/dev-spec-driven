---
description: Phase 1 — write EARS requirements with stable AC IDs for a feature. PT - escreve requisitos EARS. ES - escribe requisitos EARS.
argument-hint: "[feature name]"
---

Use the **dev-spec-driven** skill, Phase 1 (Requirements).

Feature: $ARGUMENTS

Read the steering files first. Ask clarifying questions — don't guess. Scaffold with `spec_create`
(or write by hand), then fill `requirements.md` in EARS syntax with stable AC IDs (US-1.AC-1 …).
Add the track-specific ACs the feature's classification calls for (tenant isolation / rate limits
for +saas; quality, latency, cost, refusal, injection-resistance for +ai). Run the `ears_validate`
MCP tool to catch missing SHALL, missing IDs, and vague words, fix what it flags, then present for
approval. See `references/ears-guide.md`.
