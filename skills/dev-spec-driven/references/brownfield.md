# Brownfield — adopting spec-driven development in an existing codebase

Greenfield = you describe a feature and specs drive new code. **Brownfield** = the code already
exists and you reverse-engineer specs from it, then add new features integration-aware. The engine
gives you local, zero-cost tools; the agent does the reasoning.

## The flow

### 1. Scan (local inventory)
`spec_scan` (CLI: `dev-spec scan [path] [--cap N]`) walks the repo read-only and bounded (ignoring
`node_modules`, `.git`, build output, `.specs`, editor folders, etc.; symlinks never followed — a root manifest that is a link
out of the project is not read). It also leaves out the folders the project's root `.gitignore` names as plain directory
patterns (`obj/`, `[Bb]in/`, `/_build/`, `/deps`, `Pods/`, `/public/build` — wildcards and negations are not read), a folder
whose own `.gitignore` ignores everything in it (Laravel's `storage/framework/views/`), and treats `testdata/` as fixtures (no
code, test or route). `cap` (default 5000) counts code files and manifests only — images, docs and data never use it up;
`truncated` means a code file was left unscanned. A path that is not a folder is an error (CLI exit 1). It reports:

| Field | What it holds |
|---|---|
| `stack`, `frameworks` | From manifests — the root's, and in a monorepo the nested ones too (`apps/web/package.json`, `services/billing/go.mod`; up to 20 read): `package.json`, `requirements.txt`/`pyproject`, `go.mod`, `Cargo.toml`, `composer.json`, `pom.xml`/`gradle`, `Gemfile`, `*.csproj`, `CMakeLists.txt` / `meson.build` / a `Makefile` with C sources, `mix.exs`, `rebar.config`, `pubspec.yaml`, `build.sbt`, `Package.swift`, `*.cabal` / `stack.yaml`, `deps.edn` / `project.clj`, an R `DESCRIPTION`, `Project.toml`, `build.zig`, `dune-project`, `*.nimble`, `cpanfile`; `powershell` from a `.psd1` module manifest, a Pester suite, or `.ps1` / `.psm1` files that are at least half the code; `shell` / `sql` when they are at least half the code; FastAPI/Flask/Django also from imports |
| `topLevelDirs`, `byExtension` | Candidate feature boundaries; the file mix |
| `routes`, `candidateEndpoints` | HTTP routes with method + path + `file:line` (Express/Koa/Fastify/Hono, NestJS, Next.js, Flask, FastAPI, Django, Spring, ASP.NET, Rails/Sinatra, Laravel/Symfony, Go net/http/gin/echo/chi/fiber — ASP.NET's `[controller]` / `[action]` tokens filled in); the list is capped (`routesTruncated`), the count is not |
| `testFrameworks`, `testFiles` | What the suite runs on (Pester from a `*.Tests.ps1`, `Invoke-Pester` or a manifest's RequiredModules; Bats, busted, testthat, hspec, ExUnit, GoogleTest / CTest …), and how big it is — test files in every language of the code list (a `.sql` / `.ipynb` in a test folder only when named like a test — `tests/fixtures/seed.sql` is data) |
| `entrypoints` | Where execution starts (servers, CLIs, workers; a top-level PowerShell script, a module manifest's RootModule) |
| `envVars`, `envFiles` | Environment variable **names** the code reads (`process.env.X`, `os.environ`, PowerShell `$env:X` / `[Environment]::GetEnvironmentVariable('X')` …) — never values; `.env` itself is never read, only `.env.example`-style files |
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
`+saas`; a login or an admin API `+sec`; anything holding personal data `+privacy`; a service that writes a database and publishes events `+dist`) so the mandatory sections
prompt you to capture isolation/observability/cost, threat-model and data-inventory reality.

**Validate accuracy:** the reverse-engineered spec must match real behavior — endpoints match
routes, data models match the schema, error handling matches the code. Spot-check against the source.

### 5. Coverage
`spec_coverage` (CLI: `dev-spec coverage`) measures coverage through the **`_Implements:_` markers** of every
feature's tasks (active or archived): a code file is covered when some marker names it — the file, a folder that
contains it, or a glob. Code is a source file in a broad list of languages (the one guard mode and the scan use — PowerShell,
shell and SQL included; docs, config and data such as a `.psd1` are not). It reports `coveragePercent` (covered code files /
code files — test files counted apart), `byFolder` (files, covered, percent per top-level folder), `undocumented` folders, per-feature counts,
`unmatchedImplements` (markers naming nothing on disk — typos or deleted files) and `nonCodeImplements`
(markers naming a test or non-code file, informational). It skips the same generated folders as the scan (`.gitignore`,
`testdata/`). Prioritize the highest-risk uncovered folders.

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

Specs and plans already written for another tool become dev-spec features with `spec_import {tool, path, name?,
tracks?, lang?}` (CLI `dev-spec import <kiro|spec-kit|openspec|plan|execplan|bmad|fluidplan> <path> [--name n] [--tracks …]
[--lang pt]`; `/spec-import`). The path must be inside the project; the source is only read; the result is always a
NEW feature (an existing slug is an error).

| Tool | Source | Mapping |
|---|---|---|
| `kiro` | `.kiro/specs/<name>/` — `requirements.md`, `design.md`, `tasks.md` | `### Requirement N` + numbered WHEN/THEN/SHALL criteria → `US-N.AC-M` (a Portuguese / Spanish spec too: `### Requisito N`, `## Introdução` / `## Introducción`, QUANDO … ENTÃO / CUANDO … ENTONCES); `_Requirements: 1.1, 2.3_` rewritten to the new AC IDs; `design.md` carried over |
| `spec-kit` | `specs/<nnn-name>/` — `spec.md`, `plan.md`, `tasks.md` | user stories + Given/When/Then acceptance scenarios (numbered, or bulleted under an "Acceptance Scenarios" label) → `US-N.AC-M` (story numbers kept when unique); `FR-xxx` / `SC-xxx` keep their IDs; `plan.md` → `design.md`, then `research.md`, `data-model.md`, `contracts/` and `quickstart.md` under their own headings; `T001 [P] [US1] …` tasks renumbered 1…K — a `[USn]` tag → `_Requirements:_` (that story's ACs), the file paths a task names → `_Implements:_` |
| `openspec` | `openspec/specs/<capability>/spec.md`, or a change folder `openspec/changes/<id>/` | `### Requirement:` + `#### Scenario:` → `US-N.AC-M`; a change folder's `proposal.md` gives the summary and its `specs/` deltas the requirements (REMOVED / RENAMED ones are reported as warnings, not imported) |
| `plan` | a Markdown plan: Claude Code plan mode, or a Cursor plan `.cursor/plans/*.plan.md` (`name` / `overview` / `todos` front matter) | goals and acceptance-like bullets (Goals, Acceptance / Success Criteria, Verification…) → US-1's criteria; checklists, Cursor `todos` or a Steps / Implementation section's items (an Approach section's only when the plan has no other steps section) → tasks keeping their state (a cancelled to-do comes in open, with a warning); the file paths a step names → `_Implements:_`; the rest (context, approach, files, verification commands — "Run `npm test` and expect all tests to pass" included) → `design.md` |
| `execplan` | a Codex ExecPlan written per `PLANS.md` | Validation and Acceptance → criteria; Progress (state kept) + Concrete Steps → tasks, with `_Verify:_` when a step names a test / lint / build / curl command; Decision Log → `design.md` "## Decisions" (D-1…); Purpose → the summary; the living sections (Surprises & Discoveries, Outcomes, Context, Plan of Work…) → `design.md` |
| `bmad` | BMAD-METHOD docs: `docs/prd.md` or a sharded `docs/prd/` (v6: `_bmad-output/planning-artifacts/`), `docs/stories/*.md`, `docs/architecture.md` — or one story file | epic stories + story files (the file wins) → `US-1…US-n` in story order, their ACs → `US-n.AC-m`; `FR1` / `NFR1` → `FR-1` / `NFR-1`; Tasks / Subtasks → tasks tagged `[USn]` with `(AC: 1, 3)` → `_Requirements:_` (a subtask without its own takes its parent's); architecture + Technical Assumptions + Dev Notes → `design.md`; Status / Change Log named in a warning, not imported |
| `fluidplan` | a plan settled with the [fluidplan](https://github.com/morganhub/fluidplan) skill: its folder `.fluidplan/<id>/` (`plan.json`, `answers.json`, `PLAN.md`, `DECISIONS.md`), its `plan.json`, its `PLAN.md` / `DECISIONS.md` (also at `plan.json`'s `output` paths or `fluidplan.config.json`'s `outputDir`) or a plans folder holding one plan | the finalized `PLAN.md` / `DECISIONS.md` win; `plan.json` + `answers.json` fill in the rest (each option's pros / cons / effort, the pages) or stand alone. Pages (themes) → user stories (without `plan.json`: the phases); each task's acceptance → criteria; tasks → `tasks.md` under their phase headings, ticks kept — `files` → `_Implements:_` (a delete named in the task text; an absolute / home / URL / `..` / glob path refused with a warning), `verify` → one `_Verify:_` per command, `after` → `_Depends:_` (an `after` cycle broken, with a warning); accepted **and** rejected decisions → `decisions.md` (D-1…, `spec_decide`'s format: Context = why, importance, proposal; Decision = the choice + the reviewer's remarks; Consequences = the chosen option's pros / cons / effort + the other options; `_Affects:_` = the criteria its tasks carry) and `design.md` "## Decisions" + "## Alternatives & Trade-offs"; the working rules → `tasks.md` "## Global Constraints"; rejected decisions → "## Out of Scope"; decisions still open (no answer, to change, a question, a list with an item to change) → requirements.md "## Open decisions" with `[NEEDS CLARIFICATION]`, the reviewer's question / remarks + a warning; context, subtitle, glossary, final check, visuals, the intro of a page no story carries → `design.md`; the plan's text is imported inert — no marker, ID, comment or task line comes from it (only `verify` makes a `_Verify:_`); the round history is not imported (a warning), the latest revision notes are |

**Claude Code plans live outside the project.** Plan mode saves them under `plansDirectory` — by default
`~/.claude/plans` — so the import refuses that path (it must resolve inside the project). Import the plan's **text**
instead (1.16): `spec_import {tool: "plan", text: <the plan's markdown>}` (also `execplan`, and `fluidplan` for a pasted `PLAN.md` — its `DECISIONS.md` may follow it), CLI `dev-spec import plan -
< plan.md` or `--text "…"` — same mapping and guarantees, the note reads "Imported from plan (inline text)". In Claude
Code the plugin's ExitPlanMode hook reminds the agent of it when the user approves a plan in a dev-spec project (one
line of context; it never imports by itself — ask the user first). Or copy the plan file into the project, or set
`plansDirectory` to a folder inside it. A folder holding several plans is refused — name the file. A plan or ExecPlan names its feature from its title, BMAD from the PRD (one story file: the story's title), fluidplan from the plan's title — a title with no letter a-z or digit (`# Добавить тёмную тему`) names it after its file instead (inline text: pass `name`); a plans folder holding several fluidplan plans is refused — name one.
A plan that is mostly architecture fits the design-first order (`spec_feature {action: "flow", name, flow:
"design-first"}` — `references/design-first.md`).

For every tool: each scenario becomes ONE EARS criterion (`WHEN … THE SYSTEM SHALL …`) where possible, else its
text is kept with `[NEEDS CLARIFICATION]`; tasks are renumbered 1…K and keep their checkbox state and `[P]`/`[USn]`
tags; the active tracks' mandatory design sections are appended when the imported design lacks them; every generated
artifact carries an "Imported from <tool> <path> on <date>" note. Tracks come from `tracks`, else are classified from
the imported requirements. The result returns `mapping` (old ID → new ID) and `warnings` — show both, confirm the
tracks with the human (Phase 0), then run the normal gates. Imported checkboxes carry no evidence: re-verify
ticked tasks before trusting them.

## Principles
- **Analyze first** — understand before you modify.
- **Respect what's there** — the constitution reflects reality; new work conforms or the
  constitution is updated deliberately.
- **Incremental adoption** — prove value on one module before documenting everything.
- **Integration awareness** — new features must mesh with existing patterns, not fight them.

Everything here is local and free — no external service.
