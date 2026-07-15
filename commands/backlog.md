---
description: Track planned-but-unspecced features shown in ROADMAP.md. PT - backlog de funcionalidades. ES - backlog de funciones.
argument-hint: "[add|rm <name> [note]]"
---

Use the **dev-spec-driven** skill backlog.

Args: $ARGUMENTS

Manage the backlog with the `spec_backlog` MCP tool (CLI: `dev-spec backlog add "name" "note"` /
`dev-spec backlog rm "name"` / `dev-spec backlog`). These are features planned but not yet given a
`.specs/<feature>/` folder, so the "what's left" in `.specs/ROADMAP.md` includes work not yet
started. Changes regenerate ROADMAP.md automatically. Respond in the user's language (EN/PT/ES).

Improvement items coming from `dev-guardian`'s `/guardian-improve` land here as metric-anchored
seeds. When you scaffold one into a feature, follow `references/improvement-specs.md`: the acceptance
criterion is the re-measurable metric delta, and the exit is re-running the guardian gate to prove it.
