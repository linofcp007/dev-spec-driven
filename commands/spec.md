---
description: Start (or resume) the dev-spec-driven workflow for a feature — picks mode + composable tracks, then runs the phased pipeline. PT - inicia/retoma o fluxo spec-driven. ES - inicia/reanuda el flujo spec-driven.
argument-hint: "[feature idea or feature name]"
---

Use the **dev-spec-driven** skill to drive this feature end-to-end.

Feature / request: $ARGUMENTS

Begin at **Phase 0 (Classification)**: decide the mode (Vibe / Bounded / Spec; a real defect goes to
`/spec-bugfix`, a question to investigate to `/spec-spike`), then select the composable track set (core +tdd? +saas?
+ai? +sec? +privacy? +dist? +api?). Use the `spec_classify` MCP tool to seed the recommendation, confirm against
`references/classification-matrix.md`, and present the track set for approval before moving on. After
approval: `spec_init {tracks, lang}` if steering is missing, then `spec_create {name, tracks, lang}`
once (it seeds `classification.md` and persists the tracks + language in `.state.json`; add `brownfield: true`
when the feature lands in existing code → `integration-plan.md`, `flow: "design-first"` when the architecture is the
input). The spec or plan already exists in Kiro, spec-kit, OpenSpec, Claude Code / Cursor plan mode, a Codex ExecPlan
or BMAD? Use `/spec-import` instead of re-typing it. If the user clearly wants Vibe mode, skip the artifacts and just
build it. If a `.specs/<feature>/` already exists, run `spec_next_action` first and resume from the step it names
instead of starting over. First time with the plugin? Offer `/spec-tour`. Respond in the user's language (EN/PT/ES).
