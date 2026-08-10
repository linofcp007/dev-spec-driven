<!-- This is a static instructions file read by GitHub Copilot. It is NOT a GitHub Action / workflow
     and triggers no CI and no cost. The repo deliberately ships no .github/workflows/. -->

# dev-spec-driven (Copilot instructions)

When the task is non-trivial, follow the spec-driven workflow in `AGENTS.md` (repo root):

- **Classify first** into composable tracks: `core` (always) plus `+tdd` (correctness/hard-to-undo),
  `+saas` (multi-tenant/scale/hot-path), `+ai` (LLM output quality). Tracks combine.
- Run the approval-gated pipeline: requirements (EARS, stable AC IDs) → design (with the mandatory
  +saas/+ai sections filled) → test/eval plan → failing tests / eval harness → tasks (traceable) →
  execute (red-green-refactor or prompt-iteration per track).
- Use the local engine for mechanical steps (zero-dependency, no CI):
  `node cli/dev-spec.js classify|init|create|doctor|trace|ears|next|done|approve|evals`.
  The `spec-driven` MCP server (VS Code agent mode, `.vscode/mcp.json`) exposes the same operations.
- Artifacts go in `.specs/<feature>/`. Keep AC IDs and task markers stable. Run `dev-spec doctor`
  before advancing a phase.
- **No GitHub Actions / no paid CI** — tests, load tests, and evals run locally when chosen.
- **Respond in the user's language** (EN/PT/ES), including artifact prose. EARS keywords work in all
  three (`SHALL`/`DEVE`/`DEBE`, `WHEN`/`QUANDO`/`CUANDO`).
