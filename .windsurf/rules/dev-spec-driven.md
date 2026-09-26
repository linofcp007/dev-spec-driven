---
trigger: always_on
---

> Paths in this file point into the dev-spec-driven clone. `node cli/dev-spec.js rules windsurf` prints this file with those paths made absolute — the copy to use in your own project (re-run it if the clone moves).

# dev-spec-driven (Windsurf rule)

Follow the spec-driven workflow in `AGENTS.md` (repo root). Summary:

- Plan before coding for non-trivial work. Classify the feature into composable tracks
  (`core` always; add `+tdd`, `+saas`, `+ai`, `+sec`, `+privacy` when warranted), then run requirements → design →
  (tests/evals) → tasks → execute, with user approval at each phase gate.
- Use the local engine for mechanical steps (zero-dependency, no CI):
  `node cli/dev-spec.js classify|init|create|next-action|doctor|trace|ears|next|brief|done|approve|impact|append-tasks|decide|finish|stop-check|evals`
  (full list: `node cli/dev-spec.js help`).
  The `spec-driven` MCP server exposes the same operations if configured.
- Artifacts live in `.specs/<feature>/`. Keep AC IDs (`US-1.AC-1`) and task markers stable.
- Mandatory +saas/+ai/+sec/+privacy design sections must be filled (no leftover `> TODO`).
- `dev-spec approve` refuses while that phase's checks fail (`--force` records a flagged, forced approval).
  A task whose `_Verify:_` names a runnable command is verified only by a recorded run of it — a passing one, or
  a failing one on an `_Expect: fail_` task (`dev-spec done <feature> <n> --run`); if you can't run it, don't tick:
  ask for its output. After editing an approved spec, run `dev-spec impact <feature>`.
  Before saying a task or feature is done, run `dev-spec stop-check --message "…"` (exit 1 = unverified ticks).
- No GitHub Actions / no paid CI / no pull requests — everything runs locally; integrate by merging locally.
- Respond in the user's language (EN/PT/ES — European or Brazilian Portuguese). EARS keywords work in all of them
  (`SHALL`/`DEVE`/`DEBE`).
