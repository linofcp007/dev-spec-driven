---
description: Brownfield — reverse-engineer steering and specs from an existing codebase.
argument-hint: "[module or feature to document]"
---

Use the **dev-spec-driven** skill brownfield reverse-engineering flow.

Target: $ARGUMENTS

1. `spec_scan` the codebase (stack, routes, tests, entrypoints, env var names, migrations) and read the relevant
   code. Specs or plans already written for Kiro, spec-kit, OpenSpec, Claude Code / Cursor plan mode, a Codex
   ExecPlan or BMAD? Import them (`/spec-import`) instead of re-deriving.
2. Draft `steering/` and `constitution.md` that **acknowledge the existing patterns** (don't impose
   new ones). Get approval.
3. Pick a strategy (constitution-only / + baseline specs for core modules / full coverage).
4. For each documented module, `spec_create` a feature and fill `requirements.md` + `design.md`
   describing what the code *does today* (mark as reverse-engineered; a login or admin module often takes `+sec`,
   anything holding personal data `+privacy`, a service that writes a database and publishes events `+dist`, an API other code calls `+api`, a user-facing screen `+ui`, a service with SLOs, alerts or rollouts `+obs`, an ETL job, a warehouse or dbt models `+data`, so their sections capture today's threat model and data inventory). Use `_Implements: path_`
   markers so `trace` ties specs to real files — and so `spec_scan {coverage: true}` can count them.
5. Run `spec_scan {coverage: true}` to see what's still undocumented (covered files / code files, per folder).

New features in this codebase: `spec_create {…, brownfield: true}` adds `integration-plan.md`. See
`references/brownfield.md`. Respond in the user's language (EN/PT/ES).
