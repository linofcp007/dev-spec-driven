---
description: The roadmap — progress, dependencies, ETAs and milestones; edit dependencies, the backlog or milestones.
disable-model-invocation: true
argument-hint: "[--write] [--html] [--lang en|pt|pt-BR|es] | depend <feature> <deps…> | backlog [add|rm] … | milestone [add|rm] …"
allowed-tools: mcp__plugin_dev-spec-driven_spec-driven__spec_roadmap
---

Args: $ARGUMENTS

- **(show)** — `spec_roadmap {}`; `--write` → `write: true` regenerates `.specs/ROADMAP.md`, `--html` → `html: true` also
  `ROADMAP.html`, `lang` (the user's language) localizes the chrome only. Report each feature's tracks, phase, %,
  dependencies (met?), blocked features and `cycles`, the needs-attention items, each `forecast` (an ETA from the recorded
  velocity — an estimate, never a promise — or the `reason` there is none), overlaps (two features planning the same
  files: order them or re-plan) and the milestones; recommend the next unblocked feature. ROADMAP.md is generated —
  never hand-edit it.
- **`depend <feature> <deps…>`** — `spec_roadmap_edit {kind: "depend", name, dependsOn | add | remove | order}` ("X
  depends on Y", "X no longer needs Y", "do X before Y"); a name alone shows them. Only existing features (planned work →
  the backlog); a cycle is refused — explain it and propose a fix.
- **`backlog [add|rm <name> [note]]`** — `spec_roadmap_edit {kind: "backlog", action, name, note}`: planned work with no
  `.specs/` folder yet; a feature created under the name replaces it. An improvement item from `dev-guardian`: spec it
  per `${CLAUDE_PLUGIN_ROOT}/skills/dev-spec-driven/references/improvement-specs.md`.
- **`milestone [add <name> <YYYY-MM-DD> <features…> | rm <name>]`** — `spec_roadmap_edit {kind: "milestone", action,
  name, date, features}`; each one is judged against the forecasts — on-track, at-risk, late or done. For an at-risk or
  late one say why and suggest a response: re-scope, move the date, or size and tick the tasks of the feature with no ETA.

Respond in the user's language (EN / PT / ES).
