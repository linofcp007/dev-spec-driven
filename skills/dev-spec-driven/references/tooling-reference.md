# Tooling reference

Read on demand from `SKILL.md`. The workflow itself lives in `SKILL.md`; this file holds the lookup
tables.

## MCP tools (`spec-driven` server)

| Tool | Use it for |
|---|---|
| `spec_classify` | Phase 0 — seed the track recommendation from a description (keyword heuristic) |
| `spec_init` | Scaffold `.specs/steering/` with the right steering files for the active tracks (`lang` sets the project default) |
| `spec_create` | Scaffold a feature folder with the exact artifact skeleton for its tracks (`kind: "bugfix"` → the bugfix flow) |
| `spec_list` | List all features with track set, phase, and task progress |
| `spec_status` | Detailed status of one feature (phase, tasks, scale-section completeness, eval state) |
| `spec_next_task` | Get the next unchecked task (`batch:true` → + the `[P]` tasks that can run beside it) |
| `spec_task_brief` | Self-contained brief for one task (ACs + tests resolved to spec text, design context, DoD); `write:true` → `.specs/<feature>/.execution/` for subagent execution |
| `spec_complete_task` | The only way to tick task N in `tasks.md`, with `evidence` (command, exit code, summary) — a failed run refuses the tick; a runnable `_Verify:_` counts as verified only with `{command, exitCode: 0}` (a text note ticks it but leaves it unverified) |
| `spec_finish` | Close a feature: blockers + fresh checks to run + a merge summary generated from the spec chain |
| `spec_next_action` | "You are here → do this next" + artifacts changed since approval |
| `spec_add_track` | Escalate a feature to a new track (additive, never overwrites); `remove: true` takes a track off without deleting files |
| `spec_feature` | Archive (reversible) · rename (deps follow) · remove (destructive — requires `confirm: true`) a feature |
| `ears_validate` | Lint requirements for SHALL, stable IDs, and vague words |
| `trace_check` | Verify every AC is covered by a task (and a test on +tdd); flags phantom refs |
| `spec_doctor` | One health-check → "ready to advance?" (EARS + trace + sections + steering + evidence + approval gates) |
| `spec_approve` | Record a phase approval to `.specs/<feature>/.state.json` |
| `spec_clarify` | Surface requirement ambiguities/gaps before design |
| `spec_roadmap` | Multi-feature roadmap (%, blocked, cycles); `write:true` (re)generates `.specs/ROADMAP.md` (+ `html:true` for the brand-styled `.html`), `lang` to localize |
| `spec_depend` | Declare dependencies / order between features (cycle-checked) |
| `spec_backlog` | Track planned-but-unspecced features (shown in ROADMAP.md) |
| `spec_scan` / `spec_coverage` | Brownfield: inventory an existing codebase + spec coverage % |
| `steering_scaffold` | Create one steering file from template (incl. `constitution.md`) |

Every operation is also a `dev-spec` CLI subcommand with the same behaviour (`dev-spec help` lists them).

## Directory structure

All artifacts live in `.specs/` at the project root:

```
project-root/
└── .specs/
    ├── roadmap.json              # multi-feature order + dependencies (managed by spec_depend)
    ├── steering/                 # shared project context (created per active tracks)
    │   ├── constitution.md       # core (always) — non-negotiable principles
    │   ├── product.md  tech.md  structure.md        # core (always)
    │   ├── testing-standards.md                      # +tdd
    │   ├── scale.md  observability.md  cost.md       # +saas
    │   └── ai-strategy.md                            # +ai
    └── [feature-name]/
        ├── classification.md     # mode + active tracks + signals + blast radius
        ├── requirements.md       # EARS, stable AC IDs (US-1.AC-1 …)
        ├── design.md             # base sections + mandatory +saas / +ai sections
        ├── test-plan.md          # +tdd
        ├── tests/                # +tdd — failing tests live/index here
        ├── eval-plan.md          # +ai — golden / adversarial / regression sets
        ├── prompts/  evals/      # +ai — versioned prompts + eval sets (JSON) + graders
        ├── load-test.md          # +saas hot path
        ├── quickstart.md         # human-runnable acceptance scenario (manual smoke test)
        ├── checklist.md          # track-aware quality checklist
        ├── tasks.md              # story-organized, traceable plan ([P] = parallelizable, _Verify:_ = proof)
        └── bug.md                # bugfix flow only — reproduction · root cause · fix (replaces design.md)
```

`.specs/<feature>/.state.json` records the feature's language, its track set (and `kind` for a bugfix) and phase approvals (with a content
fingerprint per approved artifact). `.specs/<feature>/.execution/` is the self-ignoring workspace of
subagent-driven execution (briefs, reports, ledger) and of `spec_finish` (`merge-summary.md`).
Verification evidence recorded by `spec_complete_task` lives in `.state.json → evidence[<task>]`.

## Roadmap generation

**Always-current roadmap overview.** The default is **`.specs/ROADMAP.md`** (git-friendly, keeps
the Mermaid dependency graph): a progress bar, feature table, dependency graph, "needs attention",
and a backlog of planned-but-unspecced features. **An optional self-contained `.specs/ROADMAP.html`**
(`html: true` / `--html`) renders the same as a brand-styled page (Pro Digital Key palette, offline,
light/dark toggle defaulting to the system theme). It's kept up to date automatically: the engine
regenerates it on every mutation (`spec_create`, `spec_complete_task`, `spec_approve`, `spec_depend`,
`spec_backlog`) and a hook regenerates it when you hand-edit a spec file. As a backstop, call
`spec_roadmap` with `write: true` (CLI: `dev-spec roadmap --write [--html]`). **Pass the user's
language** (`lang` / `--lang pt`) so the roadmap chrome matches — it's stored and reused on
auto-refresh. Track future work with `spec_backlog` (`/backlog add "name"`). The files are
auto-generated — never hand-edit them.

A `ROADMAP.md`/`ROADMAP.html` that dev-spec did **not** generate (no `AUTO-GENERATED by dev-spec`
marker) is never overwritten. `lang` on `spec_roadmap` sets only the roadmap chrome language
(`meta.roadmapLang`); the project language (`meta.lang`) is set by `spec_init`.

## Command reference

| Command | Phase | What it does |
|---|---|---|
| `/spec` | entry | Start/resume the whole workflow for a feature — picks mode + tracks, then runs the pipeline (uses `spec_classify`/`spec_status`) |
| `/spec-init` | setup | Scaffold `.specs/steering/` for the active tracks (uses `spec_init`) |
| `/classify` | 0 | Pick mode + composable tracks; write classification.md (uses `spec_classify`) |
| `/createSpec` | 1 | Requirements in EARS with stable AC IDs (uses `ears_validate`) |
| `/design` | 2 | Design with base + active-track mandatory sections |
| `/testPlan` | 3 | (+tdd) enumerate tests, map to AC IDs, choose layers |
| `/evalPlan` | 3 | (+ai) golden/adversarial/regression sets, graders, thresholds, baseline |
| `/writeTests` | 4 | (+tdd/+ai) failing tests + eval harness; the hard gate |
| `/createTask` | 5 | Traceable, ordered tasks (uses `trace_check`) |
| `/executeTask` | 6 | Implement: core / red-green-refactor / prompt-iteration per task; `--subagents` → implementer + reviewer per task (uses `spec_task_brief`) |
| `/spec-doctor` | gate | Health-check a feature; returns readyToAdvance + gate status (uses `spec_doctor`); `--deep` adds the `spec-critic` semantic review |
| `/approve` | gate | Record a phase approval to `.state.json` (uses `spec_approve`) |
| `/next-action` | any | "You are here → do this next" + what changed since approval (uses `spec_next_action`) |
| `/add-track` | any | Escalate a feature to +tdd/+saas/+ai, additive; `--remove` takes a track off without deleting files (uses `spec_add_track`) |
| `/feature` | any | Archive / rename / remove a feature, deps kept consistent; remove needs `confirm: true` (CLI `--yes`) (uses `spec_feature`) |
| `/eval` | +ai | Run the local eval harness (golden/adversarial/regression) with your API key |
| `/clarify` | 1 | Surface requirement ambiguities/gaps before design (uses `spec_clarify`) |
| `/grill` | 1 | Interrogate your understanding of the requirements before design, and fold the answers into requirements.md |
| `/roadmap` | any | Multi-feature roadmap: %, deps, blocked, cycles; writes `.specs/ROADMAP.md` (uses `spec_roadmap`) |
| `/depend` | any | Declare feature dependencies / order, cycle-checked; CLI `--add` / `--rm` / `--clear` edit the list (uses `spec_depend`) |
| `/backlog` | any | Add/remove planned features shown in ROADMAP.md (uses `spec_backlog`) |
| `/scan` | brownfield | Inventory an existing codebase (uses `spec_scan`) |
| `/reverse` | brownfield | Reverse-engineer steering + specs from existing code |
| `/coverage` | brownfield | Spec coverage % of existing code (uses `spec_coverage`) |
| `/spec-bugfix` | bugfix | Reproduce → root cause (with evidence) → failing regression test → fix → verify (uses `spec_create {kind:"bugfix"}`) |
| `/spec-finish` | close | Blockers + fresh checks + a merge summary from the spec chain; then merge locally / keep (uses `spec_finish`) |
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
