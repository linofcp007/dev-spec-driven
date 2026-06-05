---
description: Start (or resume) the dev-spec-driven workflow for a feature — picks mode + composable tracks, then runs the phased pipeline. PT - inicia/retoma o fluxo spec-driven. ES - inicia/reanuda el flujo spec-driven.
argument-hint: "[feature idea or feature name]"
---

Use the **dev-spec-driven** skill to drive this feature end-to-end.

Feature / request: $ARGUMENTS

Begin at **Phase 0 (Classification)**: decide Vibe vs Spec mode, then select the composable track
set (core +tdd? +saas? +ai?). Use the `spec_classify` MCP tool to seed the recommendation, confirm
against `references/classification-matrix.md`, write `classification.md`, and present the track set
for approval before moving on. If the user clearly wants Vibe mode, skip the artifacts and just
build it. If a `.specs/<feature>/` already exists, run `spec_status` first and resume from its
current phase instead of starting over.
