# dev-spec-driven (Gemini instructions)

Follow the spec-driven workflow in `AGENTS.md` (repo root). In short:

- For non-trivial work, **plan before coding**. Classify the feature into composable tracks —
  `core` always, plus `+tdd` / `+saas` / `+ai` when warranted — then run requirements → design →
  (tests/evals) → tasks → execute, with the user approving each phase.
- Use the local engine for the mechanical steps (zero-dependency, no CI, no cost):
  `node cli/dev-spec.js classify|init|create|doctor|trace|ears|next|done|approve|evals`.
  If MCP is configured (`~/.gemini/settings.json`), the `spec-driven` server exposes the same tools.
- Artifacts live under `.specs/<feature>/`. Keep AC IDs (`US-1.AC-1`) and task markers stable.
  Mandatory +saas/+ai design sections must be filled. Run `dev-spec doctor <feature>` before advancing.
- **No GitHub Actions / no paid CI** — everything runs locally.
- **Respond in the user's language** (EN/PT/ES), including artifact prose. EARS keywords work in all
  three (`SHALL`/`DEVE`/`DEBE`).
