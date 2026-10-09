# dev-spec-driven

**English** · [Português](./README.pt.md) · [Español](./README.es.md)

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node: >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![dependencies: 0](https://img.shields.io/badge/dependencies-0-success.svg)](./package.json)
[![tests: local suites](https://img.shields.io/badge/tests-local%20suites-success.svg)](./CONTRIBUTING.md#developing)
[![CI: none (local only)](https://img.shields.io/badge/CI-none%20·%20local%20only-informational.svg)](#why-no-github-actions)

**Spec-driven development that sizes its rigor to the change.** You describe a change; the plugin classifies it, writes
the spec with you — EARS requirements with stable IDs, a design, traceable tasks —, waits for your approval at each gate
and counts a task as done only with a recorded run of its check. One workflow plus composable **tracks** for what a
feature needs (+tdd, +saas, +ai, +sec, +privacy, +dist, +api, +ui, +obs, +data, or your own), served by a bundled
**local, zero-dependency MCP server**: no `npm install`, no network, no cloud, no GitHub Actions, no per-run cost. A
Claude Code plugin that also works in any MCP client and from a plain CLI — in English, Portuguese (PT-PT and PT-BR) and
Spanish.

## Requirements

- **Claude Code 2.1.139 or later** (`claude --version`) — the hooks run in exec form (`node` started directly, no shell
  per call), which older versions don't run. Or any MCP client: Claude Desktop, Cursor, Windsurf, VS Code / Copilot,
  Gemini CLI, Codex CLI… ([INTEGRATIONS.md](./INTEGRATIONS.md)).
- **Node.js ≥ 18** on PATH (`node --version`). Node 18 is end-of-life: 20 or later is recommended (the suites pass on 18,
  22 and 24).
- git — optional: a branch per feature, the commit a run was made on, the merge driver for the spec state.

## Install

In Claude Code:

```text
/plugin marketplace add linofcp007/dev-spec-driven
/plugin install dev-spec-driven@dev-spec-driven-marketplace
```

`/help` then lists the `/dev-spec-driven:*` commands and `/mcp` the `spec-driven` server. To try it for one session
instead: `git clone https://github.com/linofcp007/dev-spec-driven.git` and `claude --plugin-dir ./dev-spec-driven`.

Other tools: [INTEGRATIONS.md](./INTEGRATIONS.md) has the MCP config for each one (or run
`node cli/dev-spec.js mcp-config all`) and the rule files that carry the workflow. Always-on from a clone, the hooks, the
guards, the status line, your defaults and shell completion: [INSTALL.md](./INSTALL.md).

## Quick start in 5 minutes

Take one tiny, real change on your own repository — one behaviour, one or two files, testable with your own test
command. Here: `greet()` should reject an empty name.

**1. Describe it.**

```text
/dev-spec-driven:spec Return a clearer error message when greet() gets an empty name
```

Phase 0: the local classifier (`spec_classify` — keyword signals, no model) finds no track signals, so core only, and
suggests size **xs**: a *change*. Claude shows you the mode, tracks and size; you confirm. (In a project without
`.specs/`, it scaffolds the steering files first.)

**2. The plan is one file.** A change is a single `.specs/<feature>/change.md` — summary, 1–3 EARS criteria, the
approach, 1–3 tasks. Claude drafts it; you read it:

```markdown
## Acceptance Criteria (EARS)
1. **US-1.AC-1** — IF greet is called with an empty or blank name THEN THE SYSTEM SHALL throw a TypeError
   whose message is "name is required".

## Tasks
- [ ] 1. [US1] Guard greet against an empty name, with its test
  - _Requirements: US-1.AC-1_
  - _Implements: src/greet.js, test/greet.test.js_
  - _Verify: node --test test/greet.test.js_
```

Each task names the criterion it proves (`_Requirements:_`) and the command that proves it (`_Verify:_`).

**3. One approval.** You say yes; Claude records it (`spec_approve {through: "tasks"}` — or type
`/approve <feature> --through tasks` yourself). The gate runs first and refuses a template placeholder, a criterion
without SHALL or one no task covers; the approval keeps a snapshot, so a later edit shows as changed.

**4. Execute.** `/executeTask` — Claude implements task 1, runs its `_Verify:_` and records the run (command, exit code,
summary). A failing run refuses the tick; no run, no tick. When Claude can't run it, it asks you for the output — or gives
you the `dev-spec done <feature> 1 --run` line to run yourself.

**5. Finish.** `/spec-finish` checks the whole chain (open or unverified tasks, edits since an approval, placeholders),
asks for a fresh run of your full suite, drafts the merge summary from the spec and asks for your sign-off. Then you
choose: merge locally or keep the branch. Nothing is pushed without you.

Lost at any point? `/spec <feature>` resumes at the one next step. Prefer a guided version on your own repo?
`/dev-spec-driven:spec-tour` takes one tiny real change through every gate, explaining each as it happens.

### Bigger features

Phase 0 suggests a size; you confirm it or pick another:

- **xs** — a change: one `change.md`, one plan approval (above).
- **s** — one story: requirements, design and tasks (with +tdd / +ai up to the test / eval plan) approved in one call,
  each track's core sections only.
- **m / l** — the full chain, each phase approved: classification → requirements → design → test / eval plan → the
  failing tests (+tdd / +ai, before any code) → tasks.

At every size: EARS on every criterion, traceability, the evidence gate (`doctor`, `spec_finish` and the `ROADMAP.md`
"Needs attention" line list each unverified task with a localized reason) and the finish gate. Tracks combine — a Stripe
webhook in a multi-tenant SaaS that summarizes invoices with an LLM is `core +tdd +saas +ai`:

| Track | Adds |
|---|---|
| **core** *(always)* | EARS requirements → design → tasks → execution, each phase approved |
| **+tdd** | A test plan, the failing tests first, red → green → refactor inside each task |
| **+saas** | Performance, scale, multi-tenancy, observability, cost; load tests |
| **+ai** | Eval sets and thresholds, prompts as code, token cost, safety, model migrations |
| **+sec** | Threat model (STRIDE), authentication and authorization, secrets and keys, security tests |
| **+privacy** | GDPR: personal-data inventory, lawful basis, retention and deletion, data-subject rights, DPIA |
| **+dist** | Consistency model, dual writes → transactional outbox / saga, delivery and idempotency, failure modes |
| **+api** | The contract file, versioning and compatibility, problem+json errors, pagination / idempotency, rate limits |
| **+ui** | Design system, the UI states, accessibility (WCAG 2.2 AA), responsiveness and i18n, a performance budget |
| **+obs** | SLOs and error budgets, telemetry, alerting and runbooks, rollout and rollback |
| **+data** | Data contracts, data quality, idempotent re-runs and backfills, lineage, retention |

A track can be added or turned off later (`/spec-change <feature> track +sec`). Your team's own tracks:
`/spec-setup tracks` — an example pack to copy is `examples/track-packs/mobile`. A bug goes through `/spec-bugfix`
(reproduce → the root cause with evidence → your approval → a failing regression test → the fix); an open question
through `/spec-spike` (a timeboxed investigation that ends in a decision). On a feature with many independent tasks,
`/executeTask --subagents` runs an implementer and a reviewer per task and has each finding verified before it costs a
fix round (about 2–3× the tokens; adapted from [obra/superpowers](https://github.com/obra/superpowers), MIT).

## Commands by task

22 slash commands. Only `/spec` and `/spec-bugfix` are offered to the model (it may start them on its own); the others
are yours to type, so their descriptions stay out of its context. As a plugin they are namespaced
(`/dev-spec-driven:spec`); in other MCP clients they are the server's prompts.

| Task | Command | What it does |
|---|---|---|
| plan | `/spec [feature \| idea] [phase]` | Start a feature (Phase 0: mode, tracks, size) or resume one at its next step; a phase name runs that phase |
| | `/spec-bugfix` | Reproduce → root cause with evidence → approval → failing regression test → fix |
| | `/spec-spike` | A timeboxed investigation that ends in a decision (go / no-go / pivot) |
| | `/clarify [--grill]` | The gaps in the requirements before design; `--grill` interrogates your understanding |
| | `/spec-tour` | A guided 10-minute tour: one tiny real change through every gate |
| approve | `/approve [phase \| --through p]` | Record your approval of a phase (`--role`, `--force`, `--revoke`) |
| | `/spec-doctor [--deep]` | Ready to advance? `--deep` adds the spec critic's semantic review |
| | `/spec-change [impact \| decide \| track ±x]` | After an approval: what an edit touches, a decision-log entry, a track on or off |
| execute | `/executeTask [--subagents] \| commit` | The next task (or task N) with evidence; `commit` drafts a commit citing the spec |
| | `/eval [run \| baseline \| migrate]` | (+ai) The local eval harness with your own API key; a model migration gated on it |
| review | `/spec-review [branch \| converge \| simplify \| feedback \| prompt]` | Review against the spec — the branch, a converge or simplification pass, review comments, a prompt change |
| close | `/spec-finish` | Verify it is really done, draft the merge summary, then merge locally or keep the branch |
| | `/feature [archive \| restore \| rename \| remove \| flow]` | A feature's lifecycle; `flow design-first` for work that starts from an architecture |
| adopt | `/spec-adopt [scan \| reverse \| coverage \| import]` | An existing codebase: inventory it, reverse-engineer specs, measure coverage, import Kiro / spec-kit / OpenSpec / plans / BMAD |
| report | `/spec-status` | Tracks, phase, tasks, verification — of one feature or all |
| | `/roadmap [depend \| backlog \| milestone]` | Progress, dependencies, ETAs, milestones → `.specs/ROADMAP.md` (`--html`) |
| | `/spec-report [catalog \| drift \| metrics \| changelog \| export]` | The living catalog, drift since finish, metrics and a retro, release notes, stakeholder exports |
| setup | `/spec-setup [init \| guard \| statusline \| superpowers \| templates \| tracks]` | `.specs/` and steering, guard mode, the status line, superpowers precedence, your templates and tracks |
| | `/spec-upgrade` | After a plugin update: audit `.specs/` against the current rules, then the safe migrations |
| aliases | `/ds` · `/dss` · `/dsx` | `/spec` · `/spec-status` · `/executeTask` |

**Approvals are yours.** With the approval guard on (`/spec-setup init`, `approvalGuard` ask / deny), an agent's
approval, a feature removal or a write of the spec state asks you first or is refused. It stops accidents and casual
workarounds, not a determined agent with a shell — a guardrail, not a sandbox ([INSTALL.md](./INSTALL.md)). Using
superpowers too? dev-spec-driven covers its planning, TDD, debugging, verification, review and finishing skills for
feature work; `/spec-setup superpowers` writes that precedence into your `CLAUDE.md`.

## The MCP server — 32 tools

`spec-driven` is plain Node (stdio, no dependencies, no network). Every surface — the commands, the CLI, any MCP client —
calls the same engine:

| Tool | Does |
|---|---|
| `spec_classify` | Phase 0: the tracks and a suggested size from a description (local keyword signals, EN / PT / ES — no model) |
| `spec_init` | `.specs/` and the tracks' steering; project settings: `lang`, `guard`, `stopCheck`, `checks`, `approvalRoles`, `evidence`, `approvalGuard` |
| `spec_create` | A feature for its tracks and `size` (`xs` = one `change.md`); `kind` bugfix · spike, `brownfield`, `flow: "design-first"`, `branch` |
| `spec_import` | A Kiro, spec-kit or OpenSpec spec, a plan (Claude Code, Cursor, Codex ExecPlan, fluidplan) or BMAD docs as a feature — or Kiro steering / Cursor rules as steering; `dryRun` |
| `spec_status` | A feature's kind, flow, tracks, phase, tasks and design sections; without `name`, every feature |
| `spec_next_action` | "You are here → do this next": re-review → fill → fix → approve → implement → verify → finish |
| `spec_next_task` | The next open task whose `_Depends:_` are done; `batch` for parallel `[P]` tasks, `waves` for the execution waves |
| `spec_task_brief` | A self-contained brief for one task — its ACs and tests in full, design context, scoped steering, definition of done |
| `spec_complete_task` | Tick a task with the run of its `_Verify:_` (command, exit code, summary) — a failed run refuses it; `undo` unticks |
| `spec_append_tasks` | Converge: append follow-up tasks under `Phase: Convergence`, never touching the existing ones |
| `spec_approve` | Record the user's approval of a phase — refused while its checks fail; `through`, `role`, `force` (+ `reason`, `expires`), `revoke` |
| `spec_impact` | What an edit after an approval touches (ACs, sections, tests, tasks); `reopen` unticks the affected done tasks (never a removed criterion's: `retire` lists those) |
| `spec_add_track` | Turn a track on for an existing feature (additive) — `remove: true` turns one off, files kept |
| `spec_feature` | Archive · restore · rename · remove a feature (remove needs `confirm: true`), or set its `flow` |
| `spec_decide` | Append a decision or a discovery (`D-n`) to `decisions.md`, with what it affects (checked) |
| `ears_validate` | Lint EARS criteria — SHALL / DEVE / DEBE, stable IDs, vague words, placeholders (EN / PT / ES) |
| `trace_check` | Every AC covered by a task (and a test on +tdd), phantom refs; `code` finds T-IDs in test files, `matrix` the traceability matrix |
| `spec_doctor` | One health check → "ready to advance?" (EARS, placeholders, trace, sections, evidence, gates, steering) |
| `spec_clarify` | The requirements' ambiguities and gaps, as questions, before design |
| `spec_finish` | Close a feature: blockers, warnings, the checks to run fresh, a merge summary from the spec; `write` records the drift baseline |
| `spec_drift` | The files of finished features changed, missing or new since `spec_finish` |
| `spec_stop_check` | The end-of-turn evidence gate for MCP-only clients: would this "done" message be sent back? |
| `spec_log` | The commits citing each task (+ the +tdd red-first check) from the `git log` text you pass — the server never runs git |
| `spec_metrics` | Lead times, rework, forced approvals, change requests, evidence pass rate; `write` a pre-filled `retro.md` |
| `spec_roadmap` | Progress, dependencies, ETAs from the velocity of ticked tasks, milestones, overlapping features; `write` → `.specs/ROADMAP.md` (+ `html`) |
| `spec_roadmap_edit` | `kind`: `depend` (cycle-checked) · `backlog` (planned, not specced yet) · `milestone` (a target date for a set of features) |
| `spec_export` | `format`: html / md for stakeholders, csv (traceability matrix), gherkin, jira / linear, adr, `catalog` (`.specs/SPECS.md`), `changelog` (release notes) |
| `spec_scan` | Brownfield inventory — stack, routes, tests, entry points, env var names, migrations; `coverage: true` — the share of code the specs name |
| `spec_upgrade` | After a plugin update: audit `.specs/` against the current rules; `apply` the safe migrations (never edits a spec) |
| `spec_templates` | The team's own scaffolds in `.specs/templates/`: list · init · check |
| `spec_tracks` | The team's own tracks, packs in `.specs/tracks/<name>/`: list · init · check |
| `steering_scaffold` | One steering file from its template (constitution, glossary, …) or a custom scoped one |

In Claude Code, `/mcp` lists all but `spec_stop_check` and `spec_log` — the plugin's Stop hook and CLI do their job; both
still answer by name. The server also serves one MCP prompt per command and the project's specs as read-only `specs://`
resources ([INTEGRATIONS.md](./INTEGRATIONS.md)).

## The `dev-spec` CLI

The same engine from any terminal: `node cli/dev-spec.js <command>` (or `dev-spec` once linked); `--json` prints what the
MCP tool returns, `dev-spec <command> --help` the options of one command. A plugin install puts no `dev-spec` on PATH, so
every message that asks you to run it prints the runnable line, `node "<plugin>/cli/dev-spec.js" …`; tab completion for
PowerShell, bash, zsh and fish is in [INSTALL.md](./INSTALL.md).

```text
plan      classify · signals · init · steering · templates · tracks · create · bugfix · spike · import · clarify · ears
progress  list · status · next-action · next · brief · done · undone · append-tasks · approve · impact · decide · add-track · feature
check     doctor · trace · finish · drift · stop-check · log · evals · upgrade
report    roadmap · depend · backlog · milestone · catalog · export · changelog · metrics · scan · coverage
setup     mcp-config · rules · prompts · statusline · merge-state · completion · bundle · version
```

## Languages

The skill answers in your language and writes the artifacts in it: English, European Portuguese, Brazilian Portuguese
or Spanish (`lang`: `en` · `pt` · `pt-BR` · `es`). Set it for a project (`/spec-setup init --lang pt`), for every new
project (`DEV_SPEC_DEFAULT_LANG`) or for one feature. EARS keywords work in each — `SHALL` / `DEVE` / `DEBE`, `WHEN` /
`QUANDO` / `CUANDO`, … —, while IDs, markers and tags (`US-1.AC-1`, `_Verify:_`, `[P]`) are the same in all. The tools'
and the CLI's messages follow the feature's language; the command descriptions and the CLI's help are English. This
README: [Português](./README.pt.md) · [Español](./README.es.md).

## Upgrading from 1.25 or earlier

1. **Update the plugin:** `/plugin marketplace update dev-spec-driven-marketplace`, then restart Claude Code (a clone:
   `git pull`, then restart). 1.26 needs Claude Code 2.1.139 or later.
2. **Run `/spec-upgrade`** in every project that has a `.specs/` — a read-only audit first, the safe migrations
   (`--apply`) after your OK; it never edits a spec. Re-run anything that names the plugin's folder (the merge driver,
   the pre-commit hook — [INSTALL.md](./INSTALL.md) → Your plugin folder).

Your specs need no change: 1.26 renamed the commands, not the files. There are no stubs for the old names:

| Before 1.26 | Now |
|---|---|
| `/classify`, `/createSpec`, `/design`, `/testPlan`, `/evalPlan`, `/writeTests`, `/createTask`, `/next-action` | `/spec <feature> [phase]` — resumes at the next step, or runs the phase named |
| `/grill` | `/clarify <feature> --grill` |
| `/spec-ff` | `/approve <feature> --through <phase>` |
| `/spec-commit` | `/executeTask commit` |
| `/depend`, `/backlog`, `/spec-milestone` | `/roadmap depend` · `backlog` · `milestone` |
| `/prReview`, `/spec-converge`, `/spec-simplify`, `/spec-review-feedback`, `/promptReview` | `/spec-review <feature> branch` · `converge` · `simplify` · `feedback` · `prompt` |
| `/spec-impact`, `/spec-decide`, `/add-track` | `/spec-change <feature> impact` · `decide` · `track +x` / `track -x` |
| `/spec-catalog`, `/spec-drift`, `/spec-metrics`, `/spec-changelog`, `/spec-export` | `/spec-report catalog` · `drift` · `metrics` · `changelog` · `export` |
| `/scan`, `/reverse`, `/coverage`, `/spec-import` | `/spec-adopt scan` · `reverse` · `coverage` · `import` |
| `/spec-init`, `/spec-guard`, `/spec-statusline`, `/spec-superpowers`, `/spec-templates`, `/spec-tracks` | `/spec-setup init` · `guard` · `statusline` · `superpowers` · `templates` · `tracks` |
| `/migrateModel` | `/eval <feature> migrate <model>` |

Seven MCP tools became modes of others: `spec_list` → `spec_status` without `name`; `spec_backlog`, `spec_depend`,
`spec_milestone` → `spec_roadmap_edit {kind}`; `spec_catalog`, `spec_changelog` → `spec_export {format}`; `spec_coverage`
→ `spec_scan {coverage: true}`. A call by an old name still works (a hidden alias); the CLI keeps all its commands. What
else changed in each release: [CHANGELOG.md](./CHANGELOG.md).

## Why no GitHub Actions

By design. Every gate — EARS, traceability, approvals, the evidence gate — runs **locally**, through the bundled MCP
server, the hooks and the model; your tests, load tests and evals run in your own environment when you choose, not on a
paid CI runner. The plugin's own suites too: `node mcp/test.js` and `node cli/test-cli.js` (both must end `0 failed`).

## More

- [CHANGELOG.md](./CHANGELOG.md) — every release and what it changed
- [INSTALL.md](./INSTALL.md) — install options, hooks, guards, the status line, your defaults, completion, uninstalling
- [INTEGRATIONS.md](./INTEGRATIONS.md) — Claude Desktop, Cursor, Windsurf, Copilot, Gemini CLI, Codex CLI, any MCP client
- [CONTRIBUTING.md](./CONTRIBUTING.md) — developing the plugin and running its suites
- [docs/maintainers/](./docs/maintainers/) — the maintainer notes by topic ([CLAUDE.md](./CLAUDE.md) is their index)
- [examples/README.md](./examples/README.md) — a fully worked spec that passes `doctor` and `trace`
- `skills/dev-spec-driven/references/` — the deep guides (EARS, each track, subagent execution, verification, …)

It replaces four predecessor skills, whose content lives on as tracks (the originals are in git history and the v1.8.0
release). MIT licensed.

## What's in the box

```
dev-spec-driven/                      ← plugin root
├── .claude-plugin/                   ← plugin.json + marketplace.json
├── skills/dev-spec-driven/
│   ├── SKILL.md                      ← the track-based workflow (written in English; works in EN / PT / ES)
│   └── references/                   ← the deep library, read on demand (EARS, phases, tracks, evals, safety, …)
├── commands/                         ← 22 slash commands (also the MCP prompts)
├── agents/                           ← spec-implementer + spec-reviewer + spec-verifier + spec-critic + spec-simplifier
├── evals/                            ← plugin evals for `claude plugin eval` (triggering EN/PT/ES + behavioural, with fixtures)
├── cli/dev-spec.js                   ← universal CLI (works in any tool / shell)
├── mcp/
│   ├── server.js                     ← local stdio MCP server (32 tools + prompts + resources, zero-dependency)
│   ├── servers.json                  ← plugin MCP registration (plugin.json → mcpServers)
│   ├── lib/spec.js                   ← the spec engine's facade (the one object the server, CLI and hooks require)
│   ├── lib/engine/                   ← the engine: 22 modules, one per concern (core, files, state, markdown, tracks, classify, scaffold, tasks, evidence, trace, gates, doctor, finish, scan, …) + one importer per source tool (import/)
│   ├── lib/i18n.js · lib/i18n/       ← localized content (en · pt · es) + the pt-BR derivation
│   ├── lib/prompts-resources.js      ← MCP prompts (one per command) + specs:// resources
│   ├── evals/run-evals.js            ← local eval harness (your API key; --dry-run offline)
│   └── test.js · tests/              ← the MCP suite, one file per area (cli/test-cli.js + cli/tests/: the CLI suite)
├── scripts/                          ← build.js · test-runner.js (both suites' runner) · test-docker.js (Linux containers)
├── hooks/                            ← save checks, SessionStart status, Stop / SubagentStop evidence gate, observed-evidence log, opt-in guards, pre-commit
├── AGENTS.md                         ← portable workflow (Codex / Gemini / Cursor / Windsurf / …)
├── .cursor/ · .windsurf/ · .github/copilot-instructions.md · GEMINI.md   ← per-tool rules
├── integrations/                     ← MCP config templates per tool (`mcp-config` fills the path)
├── examples/demo-project/            ← a worked feature in the current shape (examples/README.md) that passes doctor + trace
├── docs/maintainers/                 ← maintainer notes by topic (CLAUDE.md is their short index)
└── INSTALL.md · INTEGRATIONS.md · CONTRIBUTING.md · CHANGELOG.md · package.json · LICENSE
```
