# Brownfield — adopting spec-driven development in an existing codebase

Greenfield = you describe a feature and specs drive new code. **Brownfield** = the code already
exists and you reverse-engineer specs from it, then add new features integration-aware. The engine
gives you local, zero-cost tools; the agent does the reasoning.

## The flow

### 1. Scan (local inventory)
`spec_scan` (CLI: `dev-spec scan [path]`) walks the repo (ignoring `node_modules`, `.git`, build
output, `.specs`, etc.) and reports:
- **stack** — inferred from manifests (`package.json` deps, `requirements.txt`/`pyproject`, `go.mod`,
  `Cargo.toml`, `composer.json`, `pom.xml`/`gradle`, `Gemfile`)
- **top-level modules** — candidate feature boundaries
- **file mix** by extension, and **candidate HTTP endpoints** (heuristic grep)

Treat it as a map, not the territory — then actually read the key files (entrypoints, routers,
models) to understand the architecture.

### 2. Infer steering + constitution
From the scan + code, draft the `steering/` files and especially **`constitution.md`**. The golden
rule: **acknowledge the existing patterns, don't impose new ones.** The constitution should capture
the principles the code *already* follows (e.g. "all DB access goes through the repository layer",
"errors return RFC-7807 problem+json"). Present for approval.

### 3. Choose a documentation strategy (match effort to need)
- **A — Constitution only:** quick bootstrap; spec only *new* work going forward.
- **B — Constitution + baseline specs:** + high-level `requirements.md` for the 2-3 core modules.
- **C — Full coverage:** detailed requirements + design for every module (regulated/complex systems).
- **D — Mixed (recommended):** constitution for all, full specs for core modules, baseline for the rest.

### 4. Reverse-engineer specs
For each module you document: `spec_create` a feature, then fill `requirements.md` and `design.md`
to describe **what the code does today** (note "reverse-engineered" at the top). Keep AC IDs stable.
Where helpful, classify the module into tracks (a payment module is `+tdd`; a multi-tenant API is
`+saas`) so the mandatory sections prompt you to capture isolation/observability/cost reality.

**Validate accuracy:** the reverse-engineered spec must match real behavior — endpoints match
routes, data models match the schema, error handling matches the code. Spot-check against the source.

### 5. Coverage
`spec_coverage` (CLI: `dev-spec coverage`) reports the % of top-level code modules that have a
matching documented feature, and lists the undocumented ones. Prioritize the highest-risk gaps.

### 6. New feature, integration-aware
Now spec the new feature normally (classify → requirements → design → …), **plus** an
`integration-plan.md`:
- **Integration points** — which existing components it touches
- **Required modifications** — what must change, and why
- **Sequencing** — ordered phases (e.g. migrations → backend → UI) with constraints
- **Risks & mitigations** — and the rollback story

### 7. Spec ↔ code traceability
Add an `_Implements: path/to/file.ts_` marker to tasks that modify real files. `trace_check`
verifies those files exist and flags missing ones — closing the loop between specs and code, and
surfacing **orphaned specs** (documented, never implemented). Combine with `spec_coverage` to find
**orphaned code** (implemented, never documented).

## Principles
- **Analyze first** — understand before you modify.
- **Respect what's there** — the constitution reflects reality; new work conforms or the
  constitution is updated deliberately.
- **Incremental adoption** — prove value on one module before documenting everything.
- **Integration awareness** — new features must mesh with existing patterns, not fight them.

Everything here is local and free — no CI, no external service.
