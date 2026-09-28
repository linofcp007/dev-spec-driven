---
description: Phase 0 — classify a feature into composable tracks (core/+tdd/+saas/+ai/+sec/+privacy) and write classification.md. PT - classifica a funcionalidade em tracks. ES - clasifica la función en tracks.
argument-hint: "[feature description]"
---

Use the **dev-spec-driven** skill, Phase 0 (Classification).

Feature: $ARGUMENTS

Run the `spec_classify` MCP tool on the description to get a recommended track set and the matched
signals. Cross-check against `references/classification-matrix.md` (turn a track ON when unsure; a
real defect goes to `/spec-bugfix`, a question to answer to `/spec-spike`, a contained change to an existing flow
is Bounded mode). Read its `notes`: a track **on from weak signals only**, a **possible** track (one weak signal —
auth words are weak for +sec, consent/retention for +privacy), and a negated keyword on a track that is on anyway —
each is a question for the user, not a verdict. Present the mode, track set, signals, blast radius and per-track
fields (hot path / autonomy / volume / compliance) for the user's approval — the chosen tracks drive every later
phase. **After approval:** `spec_init {tracks, lang}` if `.specs/steering/` is missing, then
`spec_create {name, tracks, lang}` once (add `flow: "design-first"` when the architecture is the input); record the
decisions in the `classification.md` it seeds and `spec_approve` the `classification` phase.
