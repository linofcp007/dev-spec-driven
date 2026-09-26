# Tooling reference

Read on demand from `SKILL.md`. The workflow itself lives in `SKILL.md`; this file holds the lookup
tables.

## MCP tools (`spec-driven` server — 29 tools)

All tools are local file operations on `.specs/` (or a read-only scan of the codebase); none hit the network.
They scaffold and check — they never overwrite your files. Arguments are validated against each tool's
input schema (a wrong type or unknown value is refused with a clear message).

| Tool | Use it for |
|---|---|
| `spec_classify` | Phase 0 — seed the track recommendation from a description (keyword heuristic, negation-aware) |
| `spec_init` | Scaffold `.specs/steering/` for the active tracks; `lang` sets the project default; `guard: true/false` turns guard mode on/off |
| `steering_scaffold` | Create one steering file from its template — or a custom scoped one (`api-conventions.md`, front matter `inclusion: always / fileMatch / manual`) |
| `spec_create` | Scaffold a feature for its tracks (tracks + lang persisted in `.state.json`); `kind: "bugfix"` → the bugfix flow; `brownfield: true` → + `integration-plan.md` |
| `spec_import` | Import a Kiro / spec-kit / OpenSpec spec (path inside the project) as a NEW feature — IDs remapped (`mapping`), `warnings` listed, source untouched |
| `spec_list` | List all features with track set, phase, and task progress |
| `spec_status` | One feature: phase, artifacts, tasks (with `verified`), +saas/+ai sections present vs filled, eval state |
| `spec_next_action` | "You are here → do this next": one `step`, phase by phase (re-review → for the first unapproved phase: fill → fix → approve, the next phase only after that approval → fix → implement → verify → finish → finished / drift) + `changedSinceApproval` |
| `ears_validate` | Lint criteria: modal verb, stable IDs, vague words, placeholders — issue `code`s `no-modal` · `no-id` · `vague` · `placeholder` · `no-keyword` · `needs-clarification` |
| `spec_clarify` | Requirement ambiguities/gaps before design (markers, placeholders with file:line, missing sections, IF…THEN, track gaps) |
| `trace_check` | AC ↔ task ↔ test gaps (the verdict) + warnings for EC/NFR/SC and `phantomSupersedes`; `code: true` scans test files for T-IDs |
| `spec_doctor` | One health-check → `readyToAdvance` (EARS, placeholders, trace, sections, steering, evidence, duplicate tasks, changed since approval, approval gates) |
| `spec_approve` | Record a phase approval — a GATE: refused while that phase's checks fail; `force: true` records it as forced; saves a `.history/` snapshot |
| `spec_impact` | What an edit after approval touches (vs the approved snapshot): ACs/sections/tasks; `reopen: true` unticks the affected done tasks and marks their evidence stale — never a removed criterion's tasks: `retire` [{id, tasks, tests}] lists them to delete or repoint |
| `spec_next_task` | The next open task (`batch: true` → + the `[P]` tasks that can run beside it) |
| `spec_task_brief` | Self-contained brief for one task (ACs + tests resolved, design context, scoped steering, DoD); `write: true` → `.specs/<feature>/.execution/` |
| `spec_complete_task` | The only way to tick task N, with `evidence {command, exitCode, summary}` — a failed run is recorded and refuses the tick; a runnable `_Verify:_` counts as verified only with `{command, exitCode: 0}` |
| `spec_append_tasks` | Converge: append new tasks under "Phase: Convergence" (existing tasks never renumbered; unknown AC IDs refuse the call; `needsReapproval`) |
| `spec_finish` | Close a feature: blockers + warnings + fresh checks + a merge summary from the spec chain; `write: true` on a ready feature records the drift baseline |
| `spec_drift` | Implementing files of finished features changed / missing / now present since the finish baseline |
| `spec_metrics` | Lead times, rework, forced approvals, change requests, evidence pass rate; `write: true` (with `name`) → `retro.md` (never overwritten) |
| `spec_catalog` | The living catalog: every feature + AC, superseded ones marked; `write: true` → `.specs/SPECS.md` (AUTO-GENERATED) |
| `spec_add_track` | Escalate a feature to +tdd/+saas/+ai (additive, never overwrites); `remove: true` takes a track off without deleting files |
| `spec_feature` | archive (reversible) · restore · rename (deps follow) · remove (destructive — needs `confirm: true`) |
| `spec_roadmap` | Multi-feature roadmap (%, blocked, cycles, needs attention); `write: true` → `.specs/ROADMAP.md` (+ `html: true`), `lang` = chrome language |
| `spec_depend` | Show / replace (`dependsOn`) / edit (`add`, `remove`) dependencies and `order` — existing features only, cycles rejected |
| `spec_backlog` | Planned-but-unspecced features (shown in ROADMAP.md) |
| `spec_scan` | Brownfield inventory: stack, frameworks, routes (method + path + file:line), tests, entrypoints, env var names, migrations |
| `spec_coverage` | Brownfield: share of code files named in any `_Implements:_` marker, per folder, + unmatched markers |

## CLI (`dev-spec`, same engine, same behaviour)

`node cli/dev-spec.js <command>` from the plugin clone (or `dev-spec` on PATH). `--json` prints the structured
result — a refused operation too (`{ok: false, error, …}` on stdout, exit 1, as the MCP tool returns it);
`--project <dir>` sets the project root; human output is localized. Switches take `--x` or `--x=true|false`
(any other value is an error) — so do the eval harness's (`--dry-run`, `--set-baseline`, `--require-live`), which
`evals` forwards. `doctor` (FAIL), `trace` (gaps), `ears` (errors) and `drift` (drift, a stale baseline or an
unreadable state) exit 1, so they are scriptable.

```
classify "<description>" [--name n]      init [tracks...] [--lang] [--guard on|off]
steering <file> [--lang]                 create "<name>" [tracks...] [--summary] [--kind] [--lang] [--brownfield]
bugfix "<name>" [--summary]              import <kiro|spec-kit|openspec> <path> [--name n] [--lang] [--tracks …]
list · status [feature]                  doctor <feature> · clarify <feature>
ears <feature|path> | --text "…" | -     trace <feature> [--code]
next <feature> [--batch] [--max N]       brief <feature> [n] [--write] [--include-brief]
done <feature> <n> [--run [--shell bash] | --evidence "…" --exit N --cmd "…"]
approve <feature> <phase> [--by NAME] [--force]
impact <feature> [--phase requirements|design|test-plan|eval-plan|tasks] [--reopen]
next-action|na <feature>                 finish <feature> [--write] [--include-body]
append-tasks <feature> --task "…" [--req ids] [--implements paths] [--verify "cmd"] [--story US1|shared] [--parallel] [--heading "…"]
metrics [feature] [--write]              catalog [--write] · drift [feature]
add-track <feature> <track...> [--remove]
feature <remove|archive|rename|restore> <name> [new] [--yes]
roadmap [--write] [--html] [--lang]      depend <feature> [deps...] [--add x] [--rm x] [--clear] [--order N]
backlog [add|rm <name> [note]]           scan [path] [--cap N] · coverage
evals <feature> [--dry-run ...]          mcp-config [client] · rules <cursor|windsurf|copilot|gemini|agents>
```

`done --run` runs the task's own `_Verify:_` command(s) from the project root and records the evidence (the
only CLI command that executes anything from your spec). `rules <tool>` prints a rule file with this clone's
absolute paths, to paste into another project; `mcp-config <client>` prints a ready MCP config.

## Hooks (Claude Code, local — never block on their own errors)

| Hook | Event | What it does |
|---|---|---|
| `hooks/guard-hook.js` | PreToolUse (Write/Edit/MultiEdit/NotebookEdit) | Only with guard mode on: asks before an edit to a code file outside `.specs/` while no feature has approved, unfinished tasks; silent otherwise |
| `hooks/spec-hook.js` | PostToolUse (Write/Edit) | On save: `requirements.md` → EARS lint + placeholders; `tasks.md` → traceability (+ EC/NFR/SC warnings); `design.md` → the active tracks' mandatory sections, Constitution Check, placeholders; any spec file → roadmap refresh |
| `hooks/spec-hook.js` | SessionStart | One status line per feature, plus one line per finished feature whose implementing files drifted |

`hooks/precommit-check.js` is an optional git pre-commit validator (staged EARS errors, phantom references).

## Directory structure

All artifacts live in `.specs/` at the project root:

```
project-root/
└── .specs/
    ├── roadmap.json              # order + dependencies + backlog + meta (lang, roadmapLang, guard)
    ├── ROADMAP.md  (ROADMAP.html)   # generated — never hand-edit
    ├── SPECS.md                  # generated living catalog (spec_catalog write) — never hand-edit
    ├── .gitignore                # ignores the transient files (.lock, .roadmap.lock, *.reclaim, a killed process's *.tmp, .removing-*/ tombstones) — commit it
    ├── steering/                 # shared project context (created per active tracks)
    │   ├── constitution.md       # core (always) — non-negotiable principles
    │   ├── product.md  tech.md  structure.md        # core (always)
    │   ├── testing-standards.md                      # +tdd
    │   ├── scale.md  observability.md  cost.md       # +saas
    │   ├── ai-strategy.md                            # +ai
    │   └── <custom>.md           # scoped steering (front matter inclusion: always | fileMatch | manual)
    ├── _archive/<feature>/       # archived features (spec_feature archive / restore)
    └── [feature-name]/
        ├── classification.md     # mode + active tracks + signals + blast radius
        ├── requirements.md       # EARS, stable IDs (US-1.AC-1, SC-001, EC-1, NFR-1)
        ├── design.md             # base sections + mandatory +saas / +ai sections
        ├── integration-plan.md   # brownfield (spec_create brownfield: true)
        ├── test-plan.md          # +tdd (Kind column: example | property)
        ├── tests/                # +tdd — failing tests live/index here
        ├── eval-plan.md          # +ai — golden / adversarial / regression sets
        ├── prompts/  evals/      # +ai — versioned prompts + eval sets (JSON) + graders
        ├── load-test.md          # +saas hot path
        ├── quickstart.md         # human-runnable acceptance scenario (manual smoke test)
        ├── checklist.md          # track-aware quality checklist
        ├── tasks.md              # story-organized, traceable plan ([P] = parallelizable, _Verify:_ = proof)
        ├── bug.md                # bugfix flow only — reproduction · root cause · fix (its design approval)
        ├── retro.md              # spec_metrics write — the retrospective (never overwritten)
        ├── .history/             # approval snapshots <phase>@<n>.md — commit them with the spec
        └── .execution/           # self-ignoring workspace (briefs, reports, ledger, merge-summary.md)
```

`.specs/<feature>/.state.json` records the feature's language, its track set (and `kind` for a bugfix),
`createdAt`, the latest approval per phase (with a content fingerprint, and `forced` + `failing` for a forced one),
`approvalHistory`, the change requests (`changes`), verification evidence (`evidence[<task>]`: latest run +
history), the finish baseline (`finished`) and, once archived, the `archived` record restore uses. Change
management in depth: `references/change-management.md`.

## Roadmap generation

**Always-current roadmap overview.** The default is **`.specs/ROADMAP.md`** (git-friendly, keeps
the Mermaid dependency graph): a progress bar, feature table, dependency graph, "needs attention",
and a backlog of planned-but-unspecced features. **An optional self-contained `.specs/ROADMAP.html`**
(`html: true` / `--html`) renders the same as a brand-styled page (Pro Digital Key palette, offline,
light/dark toggle defaulting to the system theme). It's kept up to date automatically: the engine
regenerates it on every mutation (`spec_create`, `spec_complete_task`, `spec_approve`, `spec_depend`,
`spec_backlog`, `spec_impact` reopen, `spec_feature`…) and a hook regenerates it when you hand-edit a spec file.
As a backstop, call `spec_roadmap` with `write: true` (CLI: `dev-spec roadmap --write [--html]`). **Pass the
user's language** (`lang` / `--lang pt`) so the roadmap chrome matches — it's stored and reused on
auto-refresh. Track future work with `spec_backlog` (`/backlog add "name"`). The files are
auto-generated — never hand-edit them.

"Needs attention" lists, per feature: unmet dependencies, open clarifications, unfilled `[SaaS]`/`[AI]` sections,
template placeholders in the current phase, artifacts changed since their approval, forced approvals, and
ticked tasks without a passing run — each named with its reason, as `spec_doctor` gives it (`#1 (latest run
failed), #2 (note only, _Verify:_ command not run), #3`; no label = no run recorded).

A `ROADMAP.md`/`ROADMAP.html` that dev-spec did **not** generate (no `AUTO-GENERATED by dev-spec`
marker) is never overwritten. `lang` on `spec_roadmap` sets only the roadmap chrome language
(`meta.roadmapLang`); the project language (`meta.lang`) is set by `spec_init`.

## Command reference (43 commands)

| Command | Phase | What it does |
|---|---|---|
| `/spec` | entry | Start/resume the whole workflow for a feature — picks mode + tracks, then runs the pipeline (uses `spec_classify`/`spec_next_action`) |
| `/spec-init` | setup | Scaffold `.specs/steering/` for the active tracks; `--lang`, `--guard` (uses `spec_init`) |
| `/spec-guard` | setup | Guard mode on/off: code edits ask while no feature has approved tasks (uses `spec_init {guard}`) |
| `/spec-superpowers` | setup | With superpowers installed too: a marked precedence block in CLAUDE.md (project or `--user`) routes feature work here; `--remove` |
| `/classify` | 0 | Pick mode + composable tracks; write classification.md (uses `spec_classify`) |
| `/createSpec` | 1 | Requirements in EARS with stable AC IDs (uses `ears_validate`) |
| `/clarify` | 1 | Surface requirement ambiguities/gaps before design (uses `spec_clarify`) |
| `/grill` | 1 | Interrogate your understanding of the requirements before design, and fold the answers into requirements.md |
| `/design` | 2 | Design with base + active-track mandatory sections |
| `/testPlan` | 3 | (+tdd) enumerate tests, map to AC IDs, choose layers and Kind (example / property) |
| `/evalPlan` | 3 | (+ai) golden/adversarial/regression sets, graders, thresholds, baseline |
| `/writeTests` | 4 | (+tdd/+ai) failing tests (T-IDs in test names, `trace --code`) + eval harness; the hard gate |
| `/createTask` | 5 | Traceable, ordered tasks (uses `trace_check`) |
| `/executeTask` | 6 | Implement: core / red-green-refactor / prompt-iteration per task; `--subagents` → implementer + reviewer per task (uses `spec_task_brief`) |
| `/spec-converge` | 6 | Whole feature AC by AC vs the code (reviewer in converge mode) → approved follow-up tasks (uses `spec_append_tasks`) |
| `/spec-doctor` | gate | Health-check a feature; returns readyToAdvance + gate status (uses `spec_doctor`); `--deep` adds the `spec-critic` semantic review |
| `/approve` | gate | Record a phase approval — refused while its checks fail, `--force` records it as forced (uses `spec_approve`) |
| `/next-action` | any | "You are here → do this next" + what changed since approval (uses `spec_next_action`) |
| `/spec-impact` | change | What an edit after approval touches; `--reopen` with the user's OK; then re-approve (uses `spec_impact`) |
| `/add-track` | any | Escalate a feature to +tdd/+saas/+ai, additive; `--remove` takes a track off without deleting files (uses `spec_add_track`) |
| `/feature` | any | Archive / restore / rename / remove a feature, deps kept consistent; remove needs `confirm: true` (CLI `--yes`) (uses `spec_feature`) |
| `/eval` | +ai | Run the local eval harness (golden/adversarial/regression) with your API key |
| `/roadmap` | any | Multi-feature roadmap: %, deps, blocked, cycles, needs attention; writes `.specs/ROADMAP.md` (uses `spec_roadmap`) |
| `/depend` | any | Show / set / edit feature dependencies and order, cycle-checked; CLI `--add` / `--rm` / `--clear` (uses `spec_depend`) |
| `/backlog` | any | Add/remove planned features shown in ROADMAP.md (uses `spec_backlog`) |
| `/spec-catalog` | any | Living catalog of every feature + AC, superseded ones marked → `.specs/SPECS.md` (uses `spec_catalog`) |
| `/scan` | brownfield | Inventory an existing codebase (uses `spec_scan`) |
| `/reverse` | brownfield | Reverse-engineer steering + specs from existing code |
| `/coverage` | brownfield | Spec coverage of existing code via `_Implements:_` (uses `spec_coverage`) |
| `/spec-import` | brownfield | Import a Kiro / spec-kit / OpenSpec spec as a new feature (uses `spec_import`) |
| `/spec-bugfix` | bugfix | Reproduce → root cause (with evidence) → failing regression test → fix → verify (uses `spec_create {kind:"bugfix"}`) |
| `/spec-finish` | close | Blockers + warnings + fresh checks + a merge summary from the spec chain; then merge locally / keep (uses `spec_finish`) |
| `/spec-drift` | after | Implementing files changed since finish, and what to do about it (uses `spec_drift`) |
| `/spec-metrics` | after | Lead times, rework, forced approvals, change requests, pass rate; `--write` → retro.md (uses `spec_metrics`) |
| `/spec-review-feedback` | support | Classify review comments against the spec: fix AC violations, route spec changes, push back on out-of-scope |
| `/spec-commit` | support | Conventional commits referencing spec + tests + evals (format below) |
| `/prReview` | support | Track-aware local pre-merge review against the full chain |
| `/promptReview` | support | (+ai) gate prompt changes on eval/cost/version |
| `/migrateModel` | support | (+ai) eval-gated model migration |
| `/spec-status` | any | Mode, tracks, phase, task/test/eval state (uses `spec_status`/`spec_list`) |

**Aliases:** `/ds` → `/spec` · `/dsx` → `/executeTask` · `/dss` → `/spec-status`. (As a plugin, all
commands are namespaced, e.g. `/dev-spec-driven:spec-doctor`. The `spec-` prefix on `/spec-init`, `/spec-status`,
`/spec-doctor` and `/spec-commit` keeps them from colliding with Claude Code's built-in `/init`, `/status`,
`/doctor` and `/commit`.)

## Commit messages (`/spec-commit`)

Conventional commits whose body references the spec chain:

```
feat(billing): implement webhook signature verification

Part of .specs/billing-webhooks/ task #3.
Makes T-05, T-06 green.            # +tdd
Eval delta: golden 82% → 87%.     # +ai
Emits metric webhook_verify_duration_ms.   # +saas
```

Types: feat | fix | refactor | test | docs | chore | style | perf. Phase-4 commits use `test:`.
