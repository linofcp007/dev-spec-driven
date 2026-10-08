---
description: Phase 0 — classify a feature into composable tracks and write classification.md (size m / l).
argument-hint: "[feature description]"
---

Use the **dev-spec-driven** skill, Phase 0 (Classification).

Feature: $ARGUMENTS

Run the `spec_classify` MCP tool on the description to get a recommended track set and the matched
signals. Cross-check against `references/classification-matrix.md` (turn a track ON when unsure; a
real defect goes to `/spec-bugfix`, a question to answer to `/spec-spike`, a contained change to an existing flow
is Bounded mode). Read its `notes`: a track **on from weak signals only**, a **possible** track (one weak signal —
auth words are weak for +sec, consent/retention for +privacy, queue/retry/"publish … event" for +dist), and a negated keyword on a track that is on anyway —
each is a question for the user, not a verdict. A note naming **this project's signal overrides** (`.specs/classifier.json`,
learned from earlier Phase 0 corrections) says the team's own history changed the reading — `dev-spec signals list` shows them. Present the mode, track set, size
(`suggestedSize` and its `sizeReason` are a draft — `references/workflows.md` → Sizes), signals, blast radius and per-track
fields (hot path / autonomy / volume / compliance) for the user's approval — the chosen tracks and size drive every later
phase. **After approval:** `spec_init {tracks, lang}` if `.specs/steering/` is missing, then
`spec_create {name, tracks, summary, size, lang}` once (the description as `summary`: a choice that differs from
the suggestion is recorded as a correction for this project; `size` is the one the user confirmed) (add `flow: "design-first"` when the architecture is the input).
- **Size m / l** (or no size): record the decisions in the `classification.md` it seeds and `spec_approve` the
  `classification` phase.
- **Size s or xs:** no `classification.md` and no classification gate — record the decisions (mode, tracks, size, blast
  radius) in the Summary of `requirements.md` (s) or `change.md` (xs, a one-file change). Size s approves its whole plan in
  one call once it is filled, xs its `change.md` plan — `spec_next_action` names the call.
