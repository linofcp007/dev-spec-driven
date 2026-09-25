<!-- This is a static instructions file read by GitHub Copilot. It is NOT a GitHub Action / workflow
     and runs nothing: no CI, no cost (dev-spec-driven itself ships no .github/workflows/). -->

> Paths in this file point into the dev-spec-driven clone. `node cli/dev-spec.js rules copilot` prints this file with those paths made absolute — the copy to use in your own project (re-run it if the clone moves).

# dev-spec-driven (Copilot instructions)

When the task is non-trivial, follow the spec-driven workflow in `AGENTS.md` (repo root):

- **Classify first** into composable tracks: `core` (always) plus `+tdd` (correctness/hard-to-undo),
  `+saas` (multi-tenant/scale/hot-path), `+ai` (LLM output quality). Tracks combine.
- Run the approval-gated pipeline: requirements (EARS, stable AC IDs) → design (with the mandatory
  +saas/+ai sections filled) → test/eval plan → failing tests / eval harness → tasks (traceable) →
  execute (red-green-refactor or prompt-iteration per track).
- Use the local engine for mechanical steps (zero-dependency, no CI):
  `node cli/dev-spec.js classify|init|create|next-action|doctor|trace|ears|next|brief|done|approve|impact|append-tasks|finish|evals`
  (full list: `node cli/dev-spec.js help`).
  The `spec-driven` MCP server (VS Code agent mode, `.vscode/mcp.json`) exposes the same operations.
- Artifacts go in `.specs/<feature>/`. Keep AC IDs and task markers stable. Run `dev-spec doctor`
  before advancing a phase.
- `dev-spec approve` refuses while that phase's checks fail (`--force` records a flagged, forced approval).
  A task whose `_Verify:_` names a runnable command is verified only by a passing run
  (`dev-spec done <feature> <n> --run`); after editing an approved spec, run `dev-spec impact <feature>`.
- **No GitHub Actions / no paid CI / no pull requests** — tests, load tests, and evals run locally when
  chosen; integrate by merging locally.
- **Respond in the user's language** (EN/PT/ES), including artifact prose. EARS keywords work in all
  three (`SHALL`/`DEVE`/`DEBE`, `WHEN`/`QUANDO`/`CUANDO`).
