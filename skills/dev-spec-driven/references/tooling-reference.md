# Tooling reference

Read on demand from `SKILL.md`. The workflow itself lives in `SKILL.md`; this file holds the lookup
tables.

## MCP tools (`spec-driven` server — 34 tools)

All tools are local file operations on `.specs/` (or a read-only scan of the codebase); none hit the network.
They scaffold and check — they never overwrite your files. Arguments are validated against each tool's
input schema (a wrong type or unknown value is refused with a clear message).

| Tool | Use it for |
|---|---|
| `spec_classify` | Phase 0 — seed the track recommendation (core +tdd +saas +ai +sec +privacy) from a description (keyword heuristic, strong / weak / corroborating signals, negation-aware) |
| `spec_init` | Scaffold `.specs/steering/` for the active tracks; `lang` sets the project default; opt-in `guard` (`"on"` / `"off"` / `"scope"`), `stopCheck` (the end-of-turn evidence gate, on by default), `checks` (the project's named check commands) and `approvalRoles` (phase → roles) — each stored in `roadmap.json → meta` and always reported back |
| `steering_scaffold` | Create one steering file from its template (incl. `security.md`, `privacy.md`) — or a custom scoped one (`api-conventions.md`, front matter `inclusion: always / fileMatch / manual`) |
| `spec_templates` | The team's own scaffolds in `.specs/templates/`: `list` (built-in vs project per artifact) · `init` (copy the built-in ones to edit) · `check` (validate them) |
| `spec_create` | Scaffold a feature for its tracks (tracks + lang persisted in `.state.json`); `kind: "bugfix"` → the bugfix flow, `kind: "spike"` (+ `question`, `timebox`) → a spike; `brownfield: true` → + `integration-plan.md`; `flow: "design-first"` |
| `spec_import` | Import a Kiro / spec-kit / OpenSpec spec, a plan (Claude Code plan mode / Cursor), a Codex ExecPlan or BMAD docs (path inside the project) as a NEW feature — IDs remapped (`mapping`), `warnings` listed, source untouched |
| `spec_list` | List all features with track set, phase, and task progress |
| `spec_status` | One feature: kind (feature / bugfix / spike), flow, phase, artifacts, tasks (with `verified`), each active track's sections present vs filled (`secSections`, `privacySections` …), eval state |
| `spec_next_action` | "You are here → do this next": one `step`, phase by phase (re-review → for the first unapproved phase: fill → fix → approve, the next phase only after that approval → fix → implement → verify → finish → finished / drift; a spike: fill → implement → decide → promote / archive / pivot) + `changedSinceApproval`; suggests `/spec-ff` when every planning artifact passes its gate |
| `ears_validate` | Lint criteria: modal verb, stable IDs, vague words, placeholders — issue `code`s `no-modal` · `no-id` · `vague` · `placeholder` · `no-keyword` · `needs-clarification` |
| `spec_clarify` | Requirement ambiguities/gaps before design (markers, placeholders with file:line, missing sections, IF…THEN, track gaps — tenant isolation, AI quality/cost, access denial, secrets, data subject rights, retention) |
| `trace_check` | AC ↔ task ↔ test gaps (the verdict) + warnings for EC/NFR/SC, `phantomSupersedes` and `phantomAffects`; `code: true` scans test files for T-IDs |
| `spec_doctor` | One health-check → `readyToAdvance` (the checks are listed below) |
| `spec_approve` | Record a phase approval — a GATE: refused while that phase's checks fail; `force: true` records it as forced; saves a `.history/` snapshot; `role` signs off as a role (`meta.approvalRoles`); `through` fast-forwards every active phase up to it, each through its own gate |
| `spec_impact` | What an edit after approval touches (vs the approved snapshot): ACs/sections/tasks; `reopen: true` unticks the affected done tasks and marks their evidence stale — never a removed criterion's tasks: `retire` [{id, tasks, tests}] lists them to delete or repoint |
| `spec_decide` | Append one entry to the decision log `decisions.md` (`D-n`, `_Kind:_`, `_Date:_`, `_Affects:_` validated against the feature, `_Supersedes:_`) — append-only |
| `spec_next_task` | The next open task (`batch: true` → + the `[P]` tasks that can run beside it) |
| `spec_task_brief` | Self-contained brief for one task (ACs + tests resolved, design context, scoped steering, decisions, project checks, `_Expect: fail_`, pipe warnings, DoD); `write: true` → `.specs/<feature>/.execution/` |
| `spec_complete_task` | The only way to tick task N, with `evidence {command, exitCode, summary}` — a failed run is recorded and refuses the tick; a runnable `_Verify:_` counts as verified only with `{command, exitCode: 0}`; an `_Expect: fail_` task needs a failing run (a pass → `unexpectedPass`); a piped command → `pipeMasked` |
| `spec_append_tasks` | Converge: append new tasks under "Phase: Convergence" (existing tasks never renumbered; unknown AC IDs refuse the call; `needsReapproval`) |
| `spec_finish` | Close a feature: blockers (incl. `suite-evidence` with project checks) + warnings + fresh checks + a merge summary from the spec chain; `evidence` records the project checks you ran; `write: true` on a ready feature records the drift baseline |
| `spec_drift` | Implementing files of finished features changed / missing / now present since the finish baseline |
| `spec_metrics` | Lead times, rework, forced and batch approvals, change requests, evidence pass rate, velocity; `write: true` (with `name`) → `retro.md` (never overwritten) |
| `spec_catalog` | The living catalog: every feature + AC (superseded ones marked), spikes, decisions; `write: true` → `.specs/SPECS.md` (AUTO-GENERATED) |
| `spec_export` | Stakeholder export: one offline, printable HTML (or `md`) document of a feature or the whole project; `write: true` → `.specs/exports/` |
| `spec_changelog` | Release notes from the specs (Added · Changed · Fixed) since `since` (default: the last written notes); `write: true` → `.specs/RELEASE-NOTES.md` |
| `spec_add_track` | Escalate a feature to +tdd/+saas/+ai/+sec/+privacy (additive, never overwrites); `remove: true` takes a track off without deleting files |
| `spec_feature` | archive (reversible) · restore · rename (deps follow) · flow (`design-first` / `requirements-first`) · remove (destructive — needs `confirm: true`) |
| `spec_roadmap` | Multi-feature roadmap (%, blocked, cycles, velocity + ETA forecasts, cross-feature overlaps, needs attention); `write: true` → `.specs/ROADMAP.md` (+ `html: true`), `lang` = chrome language |
| `spec_depend` | Show / replace (`dependsOn`) / edit (`add`, `remove`) dependencies and `order` — existing features only, cycles rejected |
| `spec_backlog` | Planned-but-unspecced features (shown in ROADMAP.md) |
| `spec_scan` | Brownfield inventory: stack, frameworks, routes (method + path + file:line), tests, entrypoints, env var names, migrations |
| `spec_coverage` | Brownfield: share of code files named in any `_Implements:_` marker, per folder, + unmatched markers |
| `spec_upgrade` | After a plugin update: audit every active feature against the current rules (status, doctor fails/warns, pending gates, changed since approval, approvals without history, unverified tasks, drift, next step, `review` critic / converge / none, grouped blocked · attention · ok); `apply: true` saves inferred tracks, seeds pre-1.13 approval baselines (`.history/`), completes `.specs/.gitignore`, stamps `roadmap.json → meta.specVersion` and writes `.specs/UPGRADE.md` — never edits an artifact, approves or ticks |

### `spec_doctor` checks (stable ids)

Each check is pass / warn / fail; `readyToAdvance` means no fail.

- **Fail when broken:** `requirements` (missing) · `ears` (a criterion without a modal verb) · `clarifications` (open
  `[NEEDS CLARIFICATION]`) · `ac-uniqueness` · `placeholders` (template text in the current or an earlier phase's
  artifact; a later phase's only warns) · `design` (missing) · `saas-sections` / `ai-sections` / `sec-sections` /
  `privacy-sections` (an active track's mandatory design section missing, empty or still holding its `> **TODO**`
  sentinel) · `traceability` (every gap kind with its IDs; the kinds a later phase's still-template file would cause
  are deferred as a warn) · bugfix `root-cause` · spike `question` / `decision`.
- **Warn:** `steering` (core files missing, or files still holding template placeholders) · `success-criteria` ·
  `priorities` · `mermaid` · `constitution-check` · `test-plan` / `eval-plan` · `secondary-trace` (EC / NFR / SC) ·
  `supersedes` (`_Supersedes:_` references that resolve to nothing) · `tests-in-code` (+tdd: T-IDs made green by done
  tasks that no test file names) · `verification` (ticked tasks without passing evidence, with the reason) ·
  `red-green` (+tdd: T-IDs made green with no recorded red run of an `_Expect: fail_` task) · `suite-evidence`
  (project checks without a passing run since the last task activity, once every task is done) · `duplicate-tasks` ·
  `verify-pipes` (a `_Verify:_` that pipes) · `integration-plan` (brownfield template unfilled) · bugfix
  `reproduction` · `changed-since-approval` (names the `spec_impact` phases to diff) · `decision-affects` (phantom
  `_Affects:_`) · `decision-affects-approved` (a decision recorded after the approval of what it affects) ·
  `cross-feature-overlap` (another active feature's open tasks plan the same files) · spike `timebox` (past its date
  with no decision).
- **`approval-gates`** — pending phases (every phase whose artifact exists, a bugfix's `design` on `bug.md`, Phase 4
  `tests` on +tdd / +ai once its plan exists, a phase still missing a role's sign-off), forced approvals with their
  failing checks, and what the next approval would refuse (`nextGate {phase, ready, failing, missingRoles}`).

## MCP prompts and resources (other MCP clients)

Besides the tools, the server advertises **prompts** and **resources** (`capabilities: {tools, prompts, resources}`,
none of them `listChanged`), so a client that is not Claude Code still gets the plugin's commands and can read the specs:

- **Prompts** — one per `commands/*.md`, read at runtime: name = the file name (`spec-doctor`, `spec-finish`…),
  description = its front-matter description, one optional `args` argument (from `argument-hint`). `prompts/get` returns
  the command's body with `$ARGUMENTS` replaced, after one line telling an agent without the dev-spec-driven skill to
  follow `AGENTS.md` and where `references/` lives. In MCP clients they show up as slash commands.
  **In Claude Code** the plugin's own slash commands are these files, so `mcp/servers.json` sets
  `SPEC_MCP_PROMPTS=off` for the plugin's server (no duplicate `/mcp__…` entries); the resources stay.
- **Resources** — read-only, confined to `.specs/`: `specs://roadmap` (ROADMAP.md, else rendered from roadmap.json),
  `specs://catalog` (SPECS.md), `specs://steering/<file>`, and `specs://feature/<slug>/<artifact>` for the allowlisted
  artifacts of each active feature (classification, requirements, design, test-plan, eval-plan, load-test, tasks, bug,
  quickstart, checklist, integration-plan, retro, spike, decisions). Templates: `specs://feature/{slug}/{artifact}`,
  `specs://steering/{file}`. The list is capped (the result says so); `..`, absolute paths, other schemes and links out
  of `.specs/` are refused.
- **CLI parity:** `dev-spec prompts` lists them; `dev-spec prompts <name> [--args "…"]` prints one rendered as
  `prompts/get` returns it.

## CLI (`dev-spec`, same engine, same behaviour)

`node cli/dev-spec.js <command>` from the plugin clone (or `dev-spec` on PATH). `--json` prints the structured
result — a refused operation too (`{ok: false, error, …}` on stdout, exit 1, as the MCP tool returns it);
`--project <dir>` sets the project root; human output is localized. Switches take `--x` or `--x=true|false`
(any other value is an error) — so do the eval harness's (`--dry-run`, `--set-baseline`, `--require-live`), which
`evals` forwards. `doctor` (FAIL), `trace` (gaps), `ears` (errors) and `drift` (drift, a stale baseline or an
unreadable state) exit 1, so they are scriptable; so do `templates check` (an error), `finish` (not ready),
`decide` (an unknown `_Affects:_`) and `stop-check` (the turn would be sent back); `upgrade` exits 0 with its report,
1 only on an error.

```
classify "<description>" [--name n]
init [tracks...] [--lang] [--guard on|off|scope] [--stop-check on|off] [--check name="cmd" …] [--roles phase=role+role,… | none]
steering <file> [--lang]                 templates [list|init|check] [artifact] [--lang]
create "<name>" [tracks...] [--summary] [--kind feature|bugfix|spike] [--lang] [--brownfield] [--flow design-first]
bugfix "<name>" [--summary]              spike "<name>" [--question "…"] [--timebox YYYY-MM-DD|3d]
import <kiro|spec-kit|openspec|plan|execplan|bmad> <path> [--name n] [--lang] [--tracks …]
list · status [feature]                  doctor <feature> · clarify <feature>
ears <feature|path> | --text "…" | -     trace <feature> [--code]
next <feature> [--batch] [--max N]       brief <feature> [n] [--write] [--include-brief]
done <feature> <n> [--run [--shell bash] | --evidence "…" --exit N --cmd "…"]
approve <feature> <phase> [--by NAME] [--role ROLE] [--force]
approve <feature> --through <phase> [--role ROLE] [--force]
impact <feature> [--phase requirements|design|test-plan|eval-plan|tasks] [--reopen]
decide <feature> --title "…" --decision "…" [--context "…"] [--consequences "…"] [--affects ids,…] [--supersedes D-n] [--discovery]
next-action|na <feature>                 finish <feature> [--write] [--include-body] [--run [--shell bash]]
append-tasks <feature> --task "…" [--req ids] [--implements paths] [--verify "cmd"] [--story US1|shared] [--parallel] [--heading "…"]
metrics [feature] [--write]              catalog [--write] · drift [feature] · upgrade [--apply]
export [feature] [--md] [--write]        changelog [--since <ISO date|last|all>] [--write]
log <feature> [--max N] [-]              stop-check [--message "…" | -] [--agent <type>]
add-track <feature> <track...> [--remove]
feature <remove|archive|rename|restore> <name> [new] [--yes]     feature flow <name> <requirements-first|design-first>
roadmap [--write] [--html] [--lang]      depend <feature> [deps...] [--add x] [--rm x] [--clear] [--order N]
backlog [add|rm <name> [note]]           scan [path] [--cap N] · coverage
evals <feature> [--dry-run ...]          mcp-config [client] · rules <cursor|windsurf|copilot|gemini|agents>
prompts [name] [--args "…"]
```

`done --run` runs the task's own `_Verify:_` command(s) from the project root and records the evidence (with the git
commit and whether the tree was dirty, when git is available); `finish --run` runs the project checks
(`meta.checks`) and records them — the only CLI commands that execute anything from your spec. `log` reads `git log`
(read-only; `-` reads a log from stdin) and lists per task the commits that cite it, plus the +tdd red-first check.
`stop-check` prints the Stop hook's decision for a closing message. `rules <tool>` prints a rule file with this
clone's absolute paths, to paste into another project; `mcp-config <client>` prints a ready MCP config.

## Hooks (Claude Code, local — never block on their own errors)

| Hook | Event | What it does |
|---|---|---|
| `hooks/guard-hook.js` | PreToolUse (Write/Edit/MultiEdit/NotebookEdit) | Only with guard mode on: asks before an edit to a code file outside `.specs/` while no feature has approved, unfinished tasks; with `guard: "scope"`, once tasks are approved, also for a code file no open task names in `_Implements:_` (test files excepted — the reason names the likely task or `/spec-converge`); silent otherwise |
| `hooks/spec-hook.js` | PostToolUse (Write/Edit) | On save: `requirements.md` → EARS lint + placeholders; `tasks.md` → traceability (+ EC/NFR/SC warnings); `design.md` → the active tracks' mandatory sections (`[SaaS]` `[AI]` `[SEC]` `[PRIVACY]`), Constitution Check, placeholders; any spec file → roadmap refresh. Skips `.execution/` and `.specs/templates/` |
| `hooks/spec-hook.js` | SessionStart | One status line per feature, plus one line per finished feature whose implementing files drifted, one line when features' open tasks plan the same files (cross-feature overlap), and one line while `.specs/` comes from an older dev-spec (`meta.specVersion` absent or older — run `/spec-upgrade`) |
| `hooks/stop-hook.js` | Stop | The end-of-turn evidence gate: when the closing message claims done / verified (EN/PT/ES) while a feature active in the last hours has ticked tasks without passing evidence (or, all tasks done, project checks without a passing run), sends the turn back with the reason; never twice in a row; off with `meta.stopCheck: false` |
| `hooks/stop-hook.js` | SubagentStop (`spec-implementer` only) | A DONE for a task with a runnable `_Verify:_` needs its report (`task-N-report.md`, named in the reply) to carry each `_Verify:_` command and an exit code, else the stop is sent back |

`hooks/precommit-check.js` is an optional git pre-commit validator (staged EARS errors, phantom references). The
evidence rules behind the Stop hooks: `references/verification.md`.

## Directory structure

All artifacts live in `.specs/` at the project root:

```
project-root/
└── .specs/
    ├── roadmap.json              # order + dependencies + backlog + meta (lang, roadmapLang, guard, stopCheck, checks, approvalRoles, changelogAt, specVersion)
    ├── ROADMAP.md  (ROADMAP.html)   # generated — never hand-edit
    ├── SPECS.md                  # generated living catalog (spec_catalog write) — never hand-edit
    ├── RELEASE-NOTES.md          # generated release notes (spec_changelog write) — never hand-edit
    ├── UPGRADE.md                # generated upgrade checklist (spec_upgrade apply) — tick its boxes as you go
    ├── exports/                  # generated stakeholder documents (spec_export write)
    ├── templates/                # the team's own scaffolds (spec_templates) — <artifact>.md, <lang>/, steering/
    ├── .gitignore                # ignores the transient files (.lock, .roadmap.lock, *.reclaim, a killed process's *.tmp, .removing-*/ tombstones) — commit it
    ├── steering/                 # shared project context (created per active tracks)
    │   ├── constitution.md       # core (always) — non-negotiable principles
    │   ├── product.md  tech.md  structure.md        # core (always)
    │   ├── testing-standards.md                      # +tdd
    │   ├── scale.md  observability.md  cost.md       # +saas
    │   ├── ai-strategy.md                            # +ai
    │   ├── security.md                               # +sec
    │   ├── privacy.md                                # +privacy
    │   └── <custom>.md           # scoped steering (front matter inclusion: always | fileMatch | manual)
    ├── _archive/<feature>/       # archived features (spec_feature archive / restore)
    └── [feature-name]/
        ├── classification.md     # mode + active tracks + signals + blast radius
        ├── requirements.md       # EARS, stable IDs (US-1.AC-1, SC-001, EC-1, NFR-1)
        ├── design.md             # base sections + the active tracks' mandatory sections
        ├── integration-plan.md   # brownfield (spec_create brownfield: true)
        ├── test-plan.md          # +tdd (Kind column: example | property)
        ├── tests/                # +tdd — failing tests live/index here
        ├── eval-plan.md          # +ai — golden / adversarial / regression sets
        ├── prompts/  evals/      # +ai — versioned prompts + eval sets (JSON) + graders
        ├── load-test.md          # +saas hot path
        ├── quickstart.md         # human-runnable acceptance scenario (manual smoke test)
        ├── checklist.md          # track-aware quality checklist
        ├── tasks.md              # story-organized, traceable plan ([P] = parallelizable, _Verify:_ = proof)
        ├── decisions.md          # the decision log (spec_decide) — append-only, committed
        ├── bug.md                # bugfix flow only — reproduction · root cause · fix (its design approval)
        ├── spike.md              # spike only — question · timebox · options · evidence · decision
        ├── retro.md              # spec_metrics write — the retrospective (never overwritten)
        ├── .history/             # approval snapshots <phase>@<n>.md — commit them with the spec
        └── .execution/           # self-ignoring workspace (briefs, reports, ledger, merge-summary.md)
```

`.specs/<feature>/.state.json` records the feature's language, its track set, `kind` (bugfix / spike) and `flow`
(design-first), `createdAt`, the latest approval per phase (with a content fingerprint, and `forced` + `failing` for a
forced one, `roles` when signed by roles), pending role `signoffs`, `approvalHistory`, the change requests
(`changes`), verification evidence (`evidence[<task>]`: latest run + history, a red run kept as `red`), when each task
was ticked (`ticks`, `lastTickAt`), the recorded project-check runs (`finishChecks`), the finish baseline (`finished`)
and, once archived, the `archived` record restore uses. Change management in depth: `references/change-management.md`.

## Roadmap generation

**Always-current roadmap overview.** The default is **`.specs/ROADMAP.md`** (git-friendly, keeps
the Mermaid dependency graph): a progress bar, feature table (with an ETA column), dependency graph, "needs
attention", and a backlog of planned-but-unspecced features. **An optional self-contained `.specs/ROADMAP.html`**
(`html: true` / `--html`) renders the same as a brand-styled page (Pro Digital Key palette, offline,
light/dark toggle defaulting to the system theme). It's kept up to date automatically: the engine
regenerates it on every mutation (`spec_create`, `spec_complete_task`, `spec_approve`, `spec_depend`,
`spec_backlog`, `spec_impact` reopen, `spec_feature`…) and a hook regenerates it when you hand-edit a spec file.
As a backstop, call `spec_roadmap` with `write: true` (CLI: `dev-spec roadmap --write [--html]`). **Pass the
user's language** (`lang` / `--lang pt`) so the roadmap chrome matches — it's stored and reused on
auto-refresh. Track future work with `spec_backlog` (`/backlog add "name"`). The files are
auto-generated — never hand-edit them. Spikes are listed apart (🔬, with their timebox).

**Forecasts.** A task's `_Size: XS|S|M|L|XL_` marker is worth 1 / 2 / 3 / 5 / 8 points (an unsized task counts as its
feature's median, else M). `velocity` = points completed per working day (Mon–Fri) over the last 28 days, from when
`spec_complete_task` ticked each task. Each feature's `forecast` = its open points ÷ velocity (its own once it has 3
completions in the window, else the project's) → an `eta` with a ±25% `range`, starting after any unfinished
dependency's ETA — or `eta: null` with a `reason` (`not-enough-data`, `no-tasks`, `dependency`, `cycle`, `done`).
`spec_metrics` reports the same velocity.

**Cross-feature overlaps.** Two active features whose OPEN tasks plan the same files (`_Implements:_`; a folder covers
the files under it), or an active feature planning files a finished feature recorded in its drift baseline, collide at
merge time — unless a dependency orders them or `_Supersedes:_` declares it. They are listed in `overlaps`, under
"needs attention", in a SessionStart line and as doctor's `cross-feature-overlap` warning: order them with
`spec_depend`, or re-plan the files.

"Needs attention" lists, per feature: unmet dependencies, open clarifications, unfilled track sections
(`[SaaS]` / `[AI]` / `[SEC]` / `[PRIVACY]`), template placeholders in the current phase, artifacts changed since their
approval, forced approvals, missing role sign-offs, overlaps, a spike past its timebox, and ticked tasks without a
passing run — each named with its reason, as `spec_doctor` gives it (`#1 (latest run failed), #2 (note only,
_Verify:_ command not run), #3`; no label = no run recorded).

A `ROADMAP.md`/`ROADMAP.html` that dev-spec did **not** generate (no `AUTO-GENERATED by dev-spec`
marker) is never overwritten. `lang` on `spec_roadmap` sets only the roadmap chrome language
(`meta.roadmapLang`); the project language (`meta.lang`) is set by `spec_init`.

## Command reference (51 commands)

| Command | Phase | What it does |
|---|---|---|
| `/spec` | entry | Start/resume the whole workflow for a feature — picks mode + tracks, then runs the pipeline (uses `spec_classify`/`spec_next_action`) |
| `/spec-tour` | entry | A guided ~10-minute tour on the user's own repo: one tiny real change through every gate, then keep / archive / remove it |
| `/spec-init` | setup | Scaffold `.specs/steering/` for the active tracks; `--lang`, `--guard`, `--check`, `--roles`, `--stop-check` (uses `spec_init`) |
| `/spec-guard` | setup | Guard mode on / off / scope: code edits ask while no feature has approved tasks — scope: also outside the plan's files (uses `spec_init {guard}`) |
| `/spec-templates` | setup | The team's own scaffolds in `.specs/templates/`: list / init / check (uses `spec_templates`) |
| `/spec-superpowers` | setup | With superpowers installed too: a marked precedence block in CLAUDE.md (project or `--user`) routes feature work here; `--remove` |
| `/spec-upgrade` | setup | After a plugin update: audit `.specs/` against the new rules, apply the safe migrations after an OK, then the critic / converge reviews it recommends (uses `spec_upgrade`) |
| `/classify` | 0 | Pick mode + composable tracks; write classification.md (uses `spec_classify`) |
| `/spec-spike` | 0 | A timeboxed investigation that ends in a decision (go / no-go / pivot) (uses `spec_create {kind: "spike"}`) |
| `/createSpec` | 1 | Requirements in EARS with stable AC IDs (uses `ears_validate`) |
| `/clarify` | 1 | Surface requirement ambiguities/gaps before design (uses `spec_clarify`) |
| `/grill` | 1 | Interrogate your understanding of the requirements before design, and fold the answers into requirements.md |
| `/design` | 2 | Design with base + active-track mandatory sections |
| `/testPlan` | 3 | (+tdd) enumerate tests, map to AC IDs, choose layers and Kind (example / property) |
| `/evalPlan` | 3 | (+ai) golden/adversarial/regression sets, graders, thresholds, baseline |
| `/writeTests` | 4 | (+tdd/+ai) failing tests (T-IDs in test names, `trace --code`) + eval harness; the hard gate |
| `/createTask` | 5 | Traceable, ordered tasks with `_Verify:_`, `_Expect: fail_`, `_Size:_` (uses `trace_check`) |
| `/executeTask` | 6 | Implement: core / red-green-refactor / prompt-iteration per task; `--subagents` → implementer + reviewer per task (uses `spec_task_brief`) |
| `/spec-converge` | 6 | Whole feature AC by AC vs the code (reviewer in converge mode) → approved follow-up tasks (uses `spec_append_tasks`) |
| `/spec-doctor` | gate | Health-check a feature; returns readyToAdvance + gate status (uses `spec_doctor`); `--deep` adds the `spec-critic` semantic review |
| `/approve` | gate | Record a phase approval — refused while its checks fail, `--force` records it as forced, `--role` signs as a role (uses `spec_approve`) |
| `/spec-ff` | gate | Fast-forward: approve every filled planning phase in order, each through its own gate (uses `spec_approve {through}`) |
| `/next-action` | any | "You are here → do this next" + what changed since approval (uses `spec_next_action`) |
| `/spec-impact` | change | What an edit after approval touches; `--reopen` with the user's OK; then re-approve (uses `spec_impact`) |
| `/spec-decide` | change | Record a decision or discovery in `decisions.md` (D-n, `_Affects:_`) (uses `spec_decide`) |
| `/add-track` | any | Escalate a feature to +tdd/+saas/+ai/+sec/+privacy, additive; `--remove` takes a track off without deleting files (uses `spec_add_track`) |
| `/feature` | any | Archive / restore / rename / remove a feature, deps kept consistent; `flow` switches design-first; remove needs `confirm: true` (CLI `--yes`) (uses `spec_feature`) |
| `/eval` | +ai | Run the local eval harness (golden/adversarial/regression) with your API key |
| `/roadmap` | any | Multi-feature roadmap: %, deps, blocked, cycles, ETA, overlaps, needs attention; writes `.specs/ROADMAP.md` (uses `spec_roadmap`) |
| `/depend` | any | Show / set / edit feature dependencies and order, cycle-checked; CLI `--add` / `--rm` / `--clear` (uses `spec_depend`) |
| `/backlog` | any | Add/remove planned features shown in ROADMAP.md (uses `spec_backlog`) |
| `/spec-catalog` | any | Living catalog of every feature + AC, superseded ones marked → `.specs/SPECS.md` (uses `spec_catalog`) |
| `/spec-export` | any | One offline, printable document of a feature or the project for stakeholders (uses `spec_export`) |
| `/spec-changelog` | after | Release notes (Added · Changed · Fixed) from the specs → `.specs/RELEASE-NOTES.md` (uses `spec_changelog`) |
| `/scan` | brownfield | Inventory an existing codebase (uses `spec_scan`) |
| `/reverse` | brownfield | Reverse-engineer steering + specs from existing code |
| `/coverage` | brownfield | Spec coverage of existing code via `_Implements:_` (uses `spec_coverage`) |
| `/spec-import` | brownfield | Import a Kiro / spec-kit / OpenSpec spec, a plan, a Codex ExecPlan or BMAD docs as a new feature (uses `spec_import`) |
| `/spec-bugfix` | bugfix | Reproduce → root cause (with evidence) → approval → failing regression test (`_Expect: fail_`) → fix → verify (uses `spec_create {kind:"bugfix"}`) |
| `/spec-finish` | close | Blockers + warnings + fresh checks + a merge summary from the spec chain; then merge locally / keep (uses `spec_finish`) |
| `/spec-drift` | after | Implementing files changed since finish, and what to do about it (uses `spec_drift`) |
| `/spec-metrics` | after | Lead times, rework, forced approvals, change requests, pass rate, velocity; `--write` → retro.md (uses `spec_metrics`) |
| `/spec-review-feedback` | support | Classify review comments against the spec: fix AC violations, route spec changes, push back on out-of-scope |
| `/spec-commit` | support | Conventional commits referencing spec + tests + evals (format below) |
| `/prReview` | support | Track-aware local pre-merge review against the full chain |
| `/promptReview` | support | (+ai) gate prompt changes on eval/cost/version |
| `/migrateModel` | support | (+ai) eval-gated model migration |
| `/spec-status` | any | Mode, tracks, phase, task/test/eval state (uses `spec_status`/`spec_list`) |

**Aliases:** `/ds` → `/spec` · `/dsx` → `/executeTask` · `/dss` → `/spec-status`. (As a plugin, all
commands are namespaced, e.g. `/dev-spec-driven:spec-doctor`. The `spec-` prefix on `/spec-init`, `/spec-status`,
`/spec-doctor` and `/spec-commit` keeps them from colliding with Claude Code's built-in `/init`, `/status`,
`/doctor` and `/commit`. Other MCP clients get the same commands as MCP prompts.)

## Commit messages (`/spec-commit`)

Conventional commits whose body references the spec chain:

```
feat(billing): implement webhook signature verification

Part of .specs/billing-webhooks/ task #3.
Makes T-05, T-06 green.            # +tdd
Eval delta: golden 82% → 87%.     # +ai
Emits metric webhook_verify_duration_ms.   # +saas
```

Types: feat | fix | refactor | test | docs | chore | style | perf. Phase-4 commits use `test:`. Written this way,
`dev-spec log <feature>` maps every commit back to its task ("task #N" with the feature name, or the T- / AC IDs it
names) and, on +tdd, flags an implementation committed before its test (the red-first check).
