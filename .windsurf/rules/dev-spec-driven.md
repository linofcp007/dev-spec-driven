---
trigger: always_on
---

# dev-spec-driven (Windsurf rule)

Follow the spec-driven workflow in `AGENTS.md` (repo root). Summary:

- Plan before coding for non-trivial work. Classify the feature into composable tracks
  (`core` always; add `+tdd`, `+saas`, `+ai` when warranted), then run requirements → design →
  (tests/evals) → tasks → execute, with user approval at each phase gate.
- Use the local engine for mechanical steps (zero-dependency, no CI):
  `node bin/dev-spec.js classify|init|create|doctor|trace|ears|next|done|approve|evals`.
  The `spec-driven` MCP server exposes the same operations if configured.
- Artifacts live in `.specs/<feature>/`. Keep AC IDs (`US-1.AC-1`) and task markers stable.
- Mandatory +saas/+ai design sections must be filled (no leftover `> TODO`).
- No GitHub Actions / no paid CI — everything runs locally.
- Respond in the user's language (EN/PT/ES). EARS keywords work in all three (`SHALL`/`DEVE`/`DEBE`).
