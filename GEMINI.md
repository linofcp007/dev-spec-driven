# dev-spec-driven (Gemini instructions)

> Paths in this file point into the dev-spec-driven clone. `node cli/dev-spec.js rules gemini` prints this file with those paths made absolute — the copy to use in your own project (re-run it if the clone moves).

Follow the spec-driven workflow in `AGENTS.md` (repo root). In short:

- For non-trivial work, **plan before coding**. Classify the feature into composable tracks —
  `core` always, plus `+tdd` / `+saas` / `+ai` / `+sec` / `+privacy` / `+dist` / `+api` / `+ui` when warranted — then run requirements → design →
  (tests/evals) → tasks → execute, with the user approving each phase.
- Use the local engine for the mechanical steps (zero-dependency, no CI, no cost):
  `node cli/dev-spec.js classify|init|create|next-action|doctor|trace|ears|next|brief|done|approve|impact|append-tasks|decide|finish|stop-check|evals`
  (full list: `node cli/dev-spec.js help`).
  If MCP is configured (`~/.gemini/settings.json`), the `spec-driven` server exposes the same tools (and the plugin's
  commands as MCP prompts).
- Artifacts live under `.specs/<feature>/`. Keep AC IDs (`US-1.AC-1`) and task markers stable.
  Mandatory +saas/+ai/+sec/+privacy/+dist/+api/+ui design sections must be filled. Run `dev-spec doctor <feature>` before advancing.
- `dev-spec approve` refuses while that phase's checks fail (`--force` records a flagged, forced approval).
  A task whose `_Verify:_` names a runnable command is verified only by a recorded run of it — a passing one, or
  a failing one on an `_Expect: fail_` task (`dev-spec done <feature> <n> --run`); if you can't run it, don't tick:
  ask for its output. After editing an approved spec, run `dev-spec impact <feature>`.
  Before saying a task or feature is done, run `dev-spec stop-check --message "…"` (exit 1 = unverified ticks).
- **No GitHub Actions / no paid CI / no pull requests** — everything runs locally; integrate by merging locally.
- **Respond in the user's language** (EN/PT/ES — European or Brazilian Portuguese), including artifact prose. EARS
  keywords work in all of them (`SHALL`/`DEVE`/`DEBE`).
