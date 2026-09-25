# Brownfield — adopting spec-driven development in an existing codebase

Greenfield = you describe a feature and specs drive new code. **Brownfield** = the code already
exists and you reverse-engineer specs from it, then add new features integration-aware. The engine
gives you local, zero-cost tools; the agent does the reasoning.

## The flow

### 1. Scan (local inventory)
`spec_scan` (CLI: `dev-spec scan [path] [--cap N]`) walks the repo read-only and bounded (ignoring
`node_modules`, `.git`, build output, `.specs`, editor folders, etc.; symlinks never followed) and reports:

| Field | What it holds |
|---|---|
| `stack`, `frameworks` | From manifests (`package.json`, `requirements.txt`/`pyproject`, `go.mod`, `Cargo.toml`, `composer.json`, `pom.xml`/`gradle`, `Gemfile`, `*.csproj`); FastAPI/Flask/Django also from imports |
| `topLevelDirs`, `byExtension` | Candidate feature boundaries; the file mix |
| `routes`, `candidateEndpoints` | HTTP routes with method + path + `file:line` (Express/Koa/Fastify/Hono, NestJS, Next.js, Flask, FastAPI, Django, Spring, ASP.NET, Rails/Sinatra, Laravel/Symfony, Go net/http/gin/echo/chi/fiber); the list is capped (`routesTruncated`), the count is not |
| `testFrameworks`, `testFiles` | What the suite runs on, and how big it is |
| `entrypoints` | Where execution starts (servers, CLIs, workers) |
| `envVars`, `envFiles` | Environment variable **names** the code reads — never values; `.env` itself is never read, only `.env.example`-style files |
| `migrations`, `migrationDirs` | Migration / schema files |

Treat it as a map, not the territory — then actually read the key files (entrypoints, routers,
models) to understand the architecture.

### 2. Infer steering + constitution
From the scan + code, draft the `steering/` files and especially **`constitution.md`**. The golden
rule: **acknowledge the existing patterns, don't impose new ones.** The constitution should capture
the principles the code *already* follows (e.g. "all DB access goes through the repository layer",
"errors return RFC-7807 problem+json"). Present for approval. Conventions that apply to one area only
(API handlers, UI components) fit a scoped steering file (`references/steering-templates.md`).

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
`spec_coverage` (CLI: `dev-spec coverage`) measures coverage through the **`_Implements:_` markers** of every
feature's tasks (active or archived): a code file is covered when some marker names it — the file, a folder that
contains it, or a glob. It reports `coveragePercent` (covered code files / code files — test files counted
apart), `byFolder` (files, covered, percent per top-level folder), `undocumented` folders, per-feature counts,
`unmatchedImplements` (markers naming nothing on disk — typos or deleted files) and `nonCodeImplements`
(markers naming a test or non-code file, informational). Prioritize the highest-risk uncovered folders.

### 6. New feature, integration-aware
Spec the new feature normally (classify → requirements → design → …) and create it with
`spec_create {name, tracks, lang, brownfield: true}` (CLI `dev-spec create "<name>" --brownfield`): it also
scaffolds **`integration-plan.md`**:
- **Integration Points** — which existing components it touches
- **Required Modifications** — what must change, and why
- **Sequencing** — ordered phases (e.g. migrations → backend → UI) with constraints
- **Risks & Mitigations** — and the rollback story
- **Affected Files** — best estimate, `path → change` (these become `_Implements:_` markers)

`spec_doctor` warns (`integration-plan`) while it is still the template.

### 7. Spec ↔ code traceability
Add an `_Implements: path/to/file.ts_` marker to tasks that modify real files. `trace_check`
verifies those files exist and flags missing ones — closing the loop between specs and code, and
surfacing **orphaned specs** (documented, never implemented). Combine with `spec_coverage` to find
**orphaned code** (implemented, never documented). `trace_check {code: true}` also finds planned T-IDs in the
test files, and `spec_finish {write: true}` records the implementing files so `spec_drift` can tell when they change.

## Import from other spec tools

Specs already written for another tool become dev-spec features with `spec_import {tool, path, name?, tracks?,
lang?}` (CLI `dev-spec import <kiro|spec-kit|openspec> <path> [--name n] [--tracks …] [--lang pt]`). The path must
be inside the project; the source is only read; the result is always a NEW feature (an existing slug is an error).

| Tool | Source | Mapping |
|---|---|---|
| `kiro` | `.kiro/specs/<name>/` — `requirements.md`, `design.md`, `tasks.md` | `### Requirement N` + numbered WHEN/THEN/SHALL criteria → `US-N.AC-M`; `_Requirements: 1.1, 2.3_` rewritten to the new AC IDs; `design.md` carried over |
| `spec-kit` | `specs/<nnn-name>/` — `spec.md`, `plan.md`, `tasks.md` | user stories + Given/When/Then acceptance scenarios → `US-N.AC-M` (story numbers kept when unique); `FR-xxx` / `SC-xxx` keep their IDs; `plan.md` → `design.md`; `T001 [P] [US1] …` tasks renumbered 1…K |
| `openspec` | `openspec/specs/<capability>/spec.md`, or a change folder `openspec/changes/<id>/` | `### Requirement:` + `#### Scenario:` → `US-N.AC-M`; a change folder's `proposal.md` gives the summary and its `specs/` deltas the requirements (REMOVED / RENAMED ones are reported as warnings, not imported) |

For every tool: each scenario becomes ONE EARS criterion (`WHEN … THE SYSTEM SHALL …`) where possible, else its
text is kept with `[NEEDS CLARIFICATION]`; tasks keep their checkbox state and `[P]`/`[USn]` tags; the active
tracks' mandatory design sections are appended when the imported design lacks them; every generated artifact
carries an "Imported from <tool> <path> on <date>" note. Tracks come from `tracks`, else are classified from the
imported requirements. The result returns `mapping` (old ID → new ID) and `warnings` — show both, confirm the
tracks with the human (Phase 0), then run the normal gates. Imported checkboxes carry no evidence: re-verify
ticked tasks before trusting them.

## Principles
- **Analyze first** — understand before you modify.
- **Respect what's there** — the constitution reflects reality; new work conforms or the
  constitution is updated deliberately.
- **Incremental adoption** — prove value on one module before documenting everything.
- **Integration awareness** — new features must mesh with existing patterns, not fight them.

Everything here is local and free — no external service.
