---
description: Record human approval of a phase gate for a feature (auditable, resumable). PT - aprova um gate de fase. ES - aprueba un gate de fase.
argument-hint: "[feature name] [phase]"
---

Use the **dev-spec-driven** skill approval gate.

Args: $ARGUMENTS

Before recording approval, run `spec_doctor` for the feature and confirm there are no blocking
`fail` checks for the phase being approved. Then call the `spec_approve` MCP tool with the feature
name and phase (one of: classification, requirements, design, test-plan, eval-plan, tests, tasks,
execution). Confirm what was recorded. This writes to `.specs/<feature>/.state.json` so the gate is
auditable and the workflow is resumable. Respond in the user's language.
