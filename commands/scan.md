---
description: Brownfield — inventory an existing codebase (stack, modules, routes, tests, entrypoints, env names, migrations) before reverse-engineering specs. PT - analisa código existente. ES - analiza código existente.
argument-hint: "[optional path]"
---

Use the **dev-spec-driven** skill brownfield scan.

Path: $ARGUMENTS

Run the `spec_scan` MCP tool (defaults to the project root; `cap` bounds the files walked — CLI
`dev-spec scan [path] [--cap N]`) for a local, read-only, zero-cost inventory:
- **stack** and web **frameworks** (from manifests; FastAPI/Flask/Django also from imports), top-level modules,
  file mix by extension;
- **HTTP routes** with method + path + `file:line` (`routes`; `candidateEndpoints` counts every route found,
  `routesTruncated` when the list is capped);
- **test frameworks** and the test-file count; **entrypoints**; **migration/schema files**;
- **environment variable names** the code reads (`envVars` — names only, never values; `.env` itself is never
  read, only `.env.example`-style files).

Then read the key files it points to (entrypoints, routers, models) and summarize the architecture. Use this as
the basis to infer `steering/` + `constitution.md` (acknowledging the existing patterns), to plan
reverse-engineering (`/reverse`), and to fill a brownfield feature's `integration-plan.md`. It's a map, not the
territory — confirm what matters in the code. See `references/brownfield.md`. Respond in the user's language
(EN/PT/ES).
