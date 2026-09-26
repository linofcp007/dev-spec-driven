---
description: Phase 0 — classify a feature into composable tracks (core/+tdd/+saas/+ai) and write classification.md. PT - classifica a funcionalidade em tracks. ES - clasifica la función en tracks.
argument-hint: "[feature description]"
---

Use the **dev-spec-driven** skill, Phase 0 (Classification).

Feature: $ARGUMENTS

Run the `spec_classify` MCP tool on the description to get a recommended track set and the matched
signals. Cross-check against `references/classification-matrix.md` (turn a track ON when unsure; a
real defect goes to `/spec-bugfix`, a contained change to an existing flow is Bounded mode). Present
the mode, track set, signals, blast radius and per-track fields (hot path / autonomy / volume /
compliance) for the user's approval — the chosen tracks drive every later phase. **After approval:**
`spec_init {tracks, lang}` if `.specs/steering/` is missing, then `spec_create {name, tracks, lang}`
once; record the decisions in the `classification.md` it seeds and `spec_approve` the
`classification` phase.
