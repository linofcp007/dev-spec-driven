# dev-spec-driven

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node: >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![dependencies: 0](https://img.shields.io/badge/dependencies-0-success.svg)](./package.json)
[![tests: local suites](https://img.shields.io/badge/tests-local%20suites-success.svg)](./CONTRIBUTING.md#developing)
[![CI: none (local only)](https://img.shields.io/badge/CI-none%20·%20local%20only-informational.svg)](#why-no-github-actions)

**One spec-driven development skill that adapts to the project — in four languages (EN · PT-PT · PT-BR · ES).**
A Claude Code **plugin** that unifies four spec-driven skills into a single track-based workflow,
bundled with its own **local, zero-dependency MCP server**. No cloud, no GitHub Actions, no
per-run cost — everything runs on your machine.

> 🌍 **Language / Idioma / Idioma:** the skill detects and mirrors the user's language (English,
> Português europeu, Português do Brasil, Español) in the conversation **and** in the generated artifacts
> (`lang`: `en` · `pt` · `pt-BR` · `es`). EARS keywords work in every one of them (`SHALL` / `DEVE` / `DEBE`,
> `WHEN` / `QUANDO` / `CUANDO`, …).

**Jump to / Ir para / Ir a:** [🇬🇧 English](#english) · [🇵🇹 Português](#português) · [🇪🇸 Español](#español)

> 🧩 **Works in / Funciona em / Funciona en:** Claude Code · Claude Desktop · Claude CoWork ·
> Cursor · Windsurf · GitHub Copilot (VS Code) · Gemini CLI · OpenAI Codex CLI · any MCP client ·
> plain CLI. Three portable layers carry the workflow everywhere — a standard **MCP server** (tools,
> prompts and `specs://` resources), a **universal `dev-spec` CLI**, and **`AGENTS.md`** instructions. See **[INTEGRATIONS.md](./INTEGRATIONS.md)**
> or run `node cli/dev-spec.js mcp-config all`. No GitHub Actions, no cost.

---

## English

### One skill, composable tracks

Instead of choosing between four overlapping skills, you get **one** skill that classifies each
feature and composes exactly the rigor it needs:

| Track | Adds |
|---|---|
| **core** *(always)* | EARS requirements → design → tasks → execute, approval-gated |
| **+tdd** | Test plan + failing-tests-first + red→green→refactor |
| **+saas** | Performance/scale/multi-tenancy/observability/cost + load testing |
| **+ai** | Eval-driven dev, prompts-as-code, token economics, safety, model lifecycle |
| **+sec** | Threat model (STRIDE), security requirements, authentication & authorization, secrets & key management, security testing |
| **+privacy** | GDPR / RGPD: personal data inventory, lawful basis, retention & deletion, data subject rights, processors & transfers, DPIA |
| **+dist** | Distributed systems & data consistency: consistency model, cross-system (dual) writes → transactional outbox / inbox / saga, delivery & idempotency, concurrency, failure modes (CAP / PACELC) |
| **+api** | API contracts: the contract file (OpenAPI / proto / GraphQL schema), versioning & compatibility (what is breaking, deprecation), problem+json errors with stable codes, pagination / idempotency / concurrency (Idempotency-Key, ETag / If-Match), rate limits & quotas |
| **+ui** | User interfaces: design-system usage, the UI states every view needs (loading / empty / error / offline…), accessibility (WCAG 2.2 AA), responsiveness & i18n, a performance budget (Core Web Vitals) |
| **+obs** | Observability & operability: SLIs & SLOs with error budgets and burn-rate alerts, telemetry (metrics, structured logs, traces), alerting & runbooks, rollout & rollback (feature flags, canary), health & capacity |
| **+data** | Data pipelines & data quality: data contracts & schema evolution, data-quality checks (a bad row quarantined, never loaded), idempotent re-runs & backfills (late-arriving data), lineage & ownership (freshness SLAs), retention & cost |

Tracks **combine**. A Stripe webhook in a multi-tenant SaaS that also summarizes invoices with an
LLM is `core +tdd +saas +ai`; a signup form that stores personal data is `+privacy` (GDPR, RGPD and HIPAA
point there); an endpoint that writes a user to Postgres and publishes a `UserCreated` event to Kafka is `+dist`. A copy
tweak is Vibe mode: no ceremony at all. A **Phase 0
classifier** (the local `spec_classify` tool, multilingual) picks the track set; you approve it. The
chosen tracks are stored with the feature, and a track can be added or turned off later.

**Sizes (1.21) — the rigor follows the change.** Phase 0 also suggests a size (`spec_create {size}`): **xs** is a
*change* — one `change.md` (summary, 1–3 EARS criteria, approach, tasks with `_Verify:_`) and two approvals; **s** is
one story whose whole plan is approved in one call (with +tdd / +ai up to the test / eval plan — the failing tests
come next, then the tasks), with each track's core sections only; **m / l** keep the full chain,
with the sections two tracks both ask for written once. EARS, traceability, the evidence gate and the finish gate hold
at every size; a design section counts as filled only with your own text. No size keeps the previous scaffold.

### The local MCP server (`spec-driven`) — 38 tools

Pure Node core — **no `npm install`, no network, no cost.** Tools:

| Tool | Does |
|---|---|
| `spec_classify` | Recommend tracks from a description (multilingual keyword heuristic, weighted) |
| `spec_init` | Scaffold `.specs/steering/` for the tracks; `lang` sets the project language, `guard` on · off · scope, `stopCheck` the end-of-turn evidence gate, `checks` the project's check commands, `approvalRoles` who signs off each phase, `evidence` reported · observed (only runs the harness saw verify), `approvalGuard` off · ask · deny (an agent's approval asks you / is refused) |
| `spec_create` | Scaffold a feature folder for the active tracks (`kind: "bugfix"` for the bugfix flow, `kind: "spike"` for a timeboxed investigation, `brownfield: true` adds `integration-plan.md`, `flow: "design-first"` puts the design before the requirements) |
| `spec_import` | Import a Kiro, spec-kit or OpenSpec spec, a Claude Code / Cursor plan, a Codex ExecPlan or BMAD docs as a new feature (IDs remapped to `US-N.AC-M`, tasks renumbered; a plan can come as `text` — plan mode keeps plans outside the project) |
| `spec_templates` | Project templates: list, copy (`init`) or `check` the team's own scaffolds in `.specs/templates/`, which replace the built-in ones |
| `spec_tracks` | Project-defined tracks: list, scaffold (`init`) or `check` the team's track packs in `.specs/tracks/<name>/` — each a marker track like `+sec` (signals, criteria, mandatory design sections, tasks, test rows, steering) |
| `spec_list` / `spec_status` | Inspect features, phases, task progress, sections filled vs. present; each feature's kind (feature / bugfix / spike) and flow |
| `spec_next_task` / `spec_complete_task` | Drive execution and tick tasks — with recorded **verification evidence** (a failed run refuses the tick and is recorded; an `_Expect: fail_` task is proven by a failing run; each run stamped `observed`); the next task is the first open one whose `_Depends:_` are done; `batch` for parallel `[P]` tasks, `waves` for the execution waves of every open task; `undo` unticks a task (its evidence turns stale — a re-tick needs a new run) |
| `spec_task_brief` | Self-contained brief for one task — ACs and tests resolved to their spec text, design context, scoped steering, definition of done (the basis of subagent execution) |
| `spec_append_tasks` | Converge: append follow-up tasks under `Phase: Convergence` without renumbering the existing ones (`depends` adds `_Depends:_`) |
| `spec_finish` | Close a feature: blockers, warnings, fresh checks to run, and a merge summary generated from the spec chain; `evidence` records the project checks' runs; `write` also records the drift baseline |
| `spec_next_action` | "You are here → do this next", phase by phase: re-review → fill → fix → approve (the next phase only after that approval) → implement → verify → finish (then finished / drift) |
| `spec_approve` | Approve a phase gate — refused while that phase's checks fail (`force` records a flagged, forced approval); every approval is kept in a history with a snapshot; `role` signs off as one of the roles `approvalRoles` lists for that phase (required there), `through` fast-forwards every phase up to it, each through its own gate; with `force`, `reason` + `expires` record a waiver (doctor warns `waiver-expired`); `revoke` withdraws an approval (never cascades) |
| `spec_impact` | What an edit after approval touches (changed ACs, sections, planned tests, tasks → tasks, tests, design; `phase` requirements · design · test-plan · eval-plan · tasks); `reopen` unticks the affected done tasks (never a removed criterion's — `retire` lists those); `phase` steering (no name = every active feature) lists the approvals made under steering that changed since |
| `spec_add_track` / `spec_feature` | Add a track (additive; `remove:true` turns one off, files kept) / archive · restore · rename · remove a feature (remove needs `confirm:true`), or set its `flow` |
| `spec_decide` | Append a decision (or a discovery) to the feature's `decisions.md` — `D-n`, with the ACs, tests or design sections it affects (checked) |
| `ears_validate` | Lint requirements (SHALL/DEVE/DEBE, stable IDs, vague words, template placeholders — EN/PT/ES) |
| `trace_check` | Every AC covered by a task (and a test on +tdd); phantom refs; EC/NFR/SC warnings; `code:true` finds T-IDs in test files; `matrix:true` adds the requirements traceability matrix |
| `spec_doctor` | One health-check → "ready to advance?" (EARS, placeholders, trace, sections, evidence, gates, steering) |
| `spec_clarify` | Surface requirement ambiguities/gaps before design (with a glossary: every word it says to avoid) |
| `spec_metrics` | Lead times, rework, forced approvals, change requests, evidence pass rate; `write` creates a pre-filled `retro.md` |
| `spec_catalog` | Living catalog of every feature's ACs, superseded ones marked (`_Supersedes:_` of a shipped feature; a draft's reads "to be superseded"), plus possible duplicate / conflicting criteria across active features; `write` → `.specs/SPECS.md` |
| `spec_export` | One self-contained, offline, printable document (HTML or markdown) of a feature or of the whole project, for stakeholders — or the traceability matrix as CSV (`format: "csv"`), a Gherkin `.feature` per feature (`"gherkin"`: one scenario per acceptance criterion, its EARS clauses as Given / When / Then) or a CSV for Jira / Linear's importer (`"jira"` · `"linear"`: the feature, its stories, its tasks); `write` → `.specs/exports/` |
| `spec_changelog` | Release notes from the specs — Added / Changed / Fixed since a date or the last notes; `milestone` scopes them to a milestone's features; `write` → `.specs/RELEASE-NOTES.md` |
| `spec_drift` | Implementing files changed, missing or new since `spec_finish` recorded its baseline |
| `spec_stop_check` | The end-of-turn evidence gate for MCP-only clients: would this closing message ("done", "verified") be sent back — ticked tasks without evidence, project checks without a passing run? |
| `spec_log` | The commits citing each task (+ the +tdd red-first check) from the `git log` text the client passes — the server never runs git |
| `spec_upgrade` | After a plugin update: audit every active feature against the current rules (status, what doctor flags, next step, a critic / converge review); `apply` saves inferred tracks, gives pre-1.13 approvals a history baseline, stamps `meta.specVersion` and writes `.specs/UPGRADE.md` — never edits a spec |
| `spec_roadmap` / `spec_depend` | Roadmap + dependencies (cycle-checked; `add` / `remove` edit the list), an ETA per feature from the velocity of ticked tasks and the files two features' open tasks both plan; `write:true` → `.specs/ROADMAP.md` (+ `html:true` for a brand-styled offline `.html`, `lang`) |
| `spec_milestone` | Milestones: a target date for a set of features (`add` · `rm` · `list`), judged against their ETAs — `on-track` · `at-risk` · `late` · `done` (ROADMAP.md shows them; a feature's rename / archive / remove follows) |
| `spec_backlog` | Track planned-but-unspecced features (shown in ROADMAP.md) |
| `spec_scan` / `spec_coverage` | Brownfield: inventory an existing codebase (routes, tests, entrypoints, env var names, migrations) + the share of code files named in `_Implements:_` |
| `steering_scaffold` | Create one steering file from its template (incl. `constitution.md`, `glossary.md`), or a custom scoped one |

**Prompts and resources.** The server also serves one MCP **prompt** per plugin command — `/spec`, `/spec-status`,
`/spec-impact`, … become slash commands in MCP clients that surface prompts (VS Code / Copilot Chat, for one) — and the
project's specs as read-only **resources**: `specs://roadmap`, `specs://catalog`, `specs://steering/{file}`,
`specs://feature/{slug}/{artifact}`. The Claude Code plugin turns the prompts off (`SPEC_MCP_PROMPTS=off` in
`mcp/servers.json`), since its commands are already slash commands there.

### Subagent-driven execution (opt-in)

`/executeTask <feature> --subagents` keeps the main session's context for coordination: per task it
writes a brief (`spec_task_brief`), dispatches the plugin's **`dev-spec-driven:spec-implementer`** agent, sends the diff
to the **`dev-spec-driven:spec-reviewer`** agent (verdict per AC ID + quality + track checks + the project's written
rules), has an independent reviewer verify each finding (only a confidence of 80+ costs a fix round), runs a fix loop of
at most 5 rounds, and only then ticks the task. It runs on its own within a story, stops at every
`**Checkpoint:**` for your review, and never changes an AC, the design or a test without going back to
that phase. It uses about 2–3× the tokens of inline execution, so it is worth it on features with ~6+
independent tasks. Protocol: `skills/dev-spec-driven/references/subagent-execution.md`. Adapted from the
`subagent-driven-development` skill of [obra/superpowers](https://github.com/obra/superpowers) (MIT).

### Gates and evidence

- **An approval is a gate, not a stamp.** `spec_approve` runs that phase's checks first (EARS errors,
  template placeholders, open `[NEEDS CLARIFICATION]`, missing sections, uncovered ACs, …; Phase 4 `tests`: every
  planned T-ID in a test file / an eval set of the feature's own; `execution`: `spec_finish`'s blockers) and refuses
  while any fails. `force: true` (CLI `--force`) records it anyway as a **forced** approval with the
  failing checks, and `doctor` and the roadmap keep flagging it.
- **A template is not content.** `doctor` has a `placeholders` check (it fails for the current and
  earlier phases), a fresh feature starts at its first phase (`requirements`; `design` on the design-first flow), and `ears_validate` reports a
  `placeholder` code. A bracket counts only when its text is one the templates write (or TODO / TBD / FIXME / `…`):
  real values such as `[free: 60, pro: 600]` or `[admin, billing-manager]` are your content.
- **`next_action` goes phase by phase:** re-review → for the first phase not approved yet, fill → fix → approve (the
  next phase only after that approval — on the default flow the design is never asked for before the requirements are approved, and
  `approve` refuses a phase while an earlier one is unapproved) → implement → verify → finish. It never
  recommends an approval the gate would refuse; it names what the gate fails on instead — nor `spec_finish` while a
  ticked task is unverified (`verify` names it and its `dev-spec done <f> <n> --run`). On +tdd / +ai, Phase 4
  (failing tests / eval harness, `approve <f> tests`) is a gate it asks for before any task is implemented.
- **Evidence before claims.** Tasks declare `_Verify: <command>_`; `spec_complete_task` records the
  command, exit code and output summary. A task with a runnable `_Verify:_` counts as verified only with a
  recorded run of it: a passing one — or, for a task marked `_Expect: fail_` (a red test, such as a bugfix's
  task 3), a failing one (a passing run of it is refused: `unexpected-pass`); any other failure refuses the
  tick. **Can't run the command yourself?** Don't tick — not bare, not with a note: name the command and ask
  for its output (or `dev-spec done <feature> <n> --run`); a note-only tick stays unverified and is for when
  the user explicitly asks for one. Failed runs are kept in a short history, and a task reopened after a spec
  change has **stale** evidence until it is re-run. `spec_complete_task` returns a stable reason code
  (`unverifiedReason`: `failed-run`, `manual-note-on-runnable-verify`, `duplicate-number`,
  `stale-evidence`, `unexpected-pass`, `no-evidence`, `unobserved` — under `meta.evidence: "observed"`, a run the
  harness never saw —, `command-mismatch` — the run recorded is not a run of the task's `_Verify:_` command);
  `doctor`, `spec_finish` and the `ROADMAP.md` "Needs attention" line
  list each unverified task with a localized reason. CLI: `dev-spec done <feature> <n> --run`.
- **`/spec-bugfix`** — a light spec for a defect: reproduce → **root cause with evidence** → failing
  regression test → fix → verify. `doctor` fails until the root cause is written, and the tasks after the
  root-cause task can't be completed before that. What you already know goes in with the scaffold
  (`spec_create {kind: "bugfix", reproduction, rootCause, condition, behaviour, includeBody}` / `--reproduction`,
  `--root-cause`, `--condition`, `--behaviour`) — no read-back and rewrite of the four files.
- **`/spec-finish`** — blocks on doctor failures, an artifact changed since its approval, placeholders
  anywhere in the chain, open or unverified tasks and pending gates; lists the checks to run fresh and
  builds a merge summary from the spec (ACs, tasks with their evidence, root cause/fix). Then merge
  locally or keep the branch — no pull requests, no CI.
- **`/spec-review-feedback`** — review comments classified against the spec: fix AC violations, route
  spec changes back to their phase, push back on out-of-scope asks.
- **`/spec-doctor --deep`** — a `spec-critic` agent reviews the *meaning* of a spec at its gate.
- **Bounded mode** between Vibe and Spec (short design in chat + an explicit yes), **Global
  Constraints** inlined into every task brief, **parallel `[P]` tasks** in separate worktrees, and
  **plugin evals** (`evals/`, `claude plugin eval`) that check the skill triggers in EN/PT/ES — and, in the
  behavioural suite, that the agent then respects the workflow (plans first, records evidence, never forces a gate).
  These ideas are adapted from [obra/superpowers](https://github.com/obra/superpowers) (MIT).

### Change management

- **Approval history.** Every approval is appended to `.state.json` (`approvalHistory`) and saves a
  snapshot of what it signed off to `.specs/<feature>/.history/<phase>@<n>.md` — commit it with the spec.
- **`/spec-impact`** (`spec_impact`) — after an approved artifact changes, it diffs the edit against
  that snapshot: added / modified / removed ACs (and SC/EC/NFR IDs), design or eval-plan sections, planned tests (T-IDs) or tasks, and for
  each one the tasks that cite it (done or open, with their evidence), the tests covering it and the
  design sections that mention it. `reopen` unticks the affected done tasks, marks their evidence stale
  and records the change request — never the tasks of a removed criterion: `retire` lists them (and their
  test rows) to delete or point at the criterion that replaces it. It never edits your requirements or design.
- **`/spec-converge`** (`spec_append_tasks`) — when implementation drifted from the plan or a review
  found follow-up work, append new tasks (numbered after the last, under `Phase: Convergence`) with
  their `_Requirements:_`, `_Implements:_` and `_Verify:_` (and `_Makes green:_`, `_Expect: fail_`, `_Size:_` when
  given). Unknown AC IDs — or T-IDs the test plan doesn't plan — are refused, existing tasks are never touched, and
  an approved task list asks for re-approval.

### Living catalog, drift and restore

- **`/spec-catalog`** (`spec_catalog`) — "what the system does today": every feature (active,
  finished, archived) with each AC as one EARS line. A criterion replaced by a later feature declares it
  with `_Supersedes: <feature>/US-n.AC-m_` and the old one is shown as superseded. `write` generates
  `.specs/SPECS.md` (never over a hand-written file), refreshed with the roadmap from then on.
- **`/spec-drift`** (`spec_drift`) — `spec_finish` with `write` on a ready feature records a hash of every
  file its `_Implements:_` markers name; drift reports the files changed, missing or new since then. The
  SessionStart hook adds one line per drifted active feature.
- **Restore** — `spec_feature archive` records the dependencies it prunes, and `restore` brings the
  feature back with its roadmap entry and those dependencies.

### Guard mode and scoped steering

- **`/spec-guard`** — opt-in guard mode (`spec_init {guard}` / `dev-spec init --guard on|off|scope`).
  While it is on, a Claude Code PreToolUse hook **asks before** a Write/Edit on a code file outside
  `.specs/` when no feature has approved, unfinished tasks — except a test file while a feature's test plan is approved
  (Phase 4 writes the failing tests first) and any code while an active spike exists (its prototype); `scope` also
  asks, once tasks are approved, for a code file no open task names in `_Implements:_` (test files excepted), naming
  the likely task. It is silent when off and never blocks on its own errors. Other tools don't run Claude Code
  hooks, so there the guard does nothing.
- **Scoped steering** — steering files take Kiro-compatible front matter: `inclusion: always`,
  `fileMatch` (with `fileMatchPattern: "src/api/**"`) or `manual`. `steering_scaffold` creates custom
  files such as `api-conventions.md`, and each task brief includes the files whose pattern matches the
  task's `_Implements:_` paths.
- **Teams: git merges the spec state** — `dev-spec merge-state --install` (once per clone, and again after a plugin update — `--check` tells; commit the `.gitattributes`
  it writes) makes git merge `.state.json` / `roadmap.json` semantically: two branches' approvals, ticks and evidence are
  united instead of conflicting; a real conflict stays valid JSON (`mergeConflicts`) and doctor fails until it is resolved.
- **Approvals in other MCP clients** — with `approvalGuard` ask / deny, a client that supports MCP elicitation asks its
  user before `spec_approve` records anything (only an explicit approve counts); without it, `deny` is refused.

### Brownfield, import and metrics

- **Deeper scan** — `spec_scan` lists HTTP routes with method, path and `file:line` (Express, NestJS,
  Next.js, FastAPI, Flask, Django, Spring, ASP.NET, Rails, Laravel, Go …), test frameworks, entrypoints,
  environment variable **names** (never values) and migration files. `spec_coverage` measures the share of
  code files named in any `_Implements:_` marker, per folder. `create --brownfield` adds an
  `integration-plan.md`.
- **`/spec-import`** (`spec_import`) — bring a Kiro (`.kiro/specs/<name>/`), spec-kit
  (`specs/<nnn-name>/`) or OpenSpec (`openspec/specs/<capability>/` or a change folder) spec in as a new
  feature: criteria become `US-N.AC-M` EARS lines (or keep their text with `[NEEDS CLARIFICATION]`),
  tasks are renumbered with their checkbox state. Plans too: `plan` (a Claude Code plan-mode file copied into
  the project, or a Cursor `.cursor/plans/*.plan.md`), `execplan` (a Codex ExecPlan) and `bmad` (BMAD-METHOD PRD
  and stories) — and `fluidplan` (a plan settled with the fluidplan skill: `.fluidplan/<id>/` or its `PLAN.md` /
  `DECISIONS.md` → stories, criteria, tasks with `_Verify:_` / `_Depends:_`, and a `decisions.md` of the settled decisions).
  The source must be inside the project and is only read.
- **Deeper traceability** — `trace_check` warns about edge cases (EC-n), NFRs and success criteria
  (SC-nnn) nothing covers; `--code` looks for T-IDs in test names (`test("T-01 …")`, `def test_T01_…`).
  Test plans have a **Kind** column (`example` | `property`) with property-based testing guidance.
- **`/spec-metrics`** (`spec_metrics`) — lead time per phase, rework, forced approvals, change requests
  and evidence pass rate, per feature or for the project; `write` creates a pre-filled `retro.md`.

### New in 1.22

- **Reviews you can trust** — the reviewer rates every Critical / Important finding 0–100 and knows what is not a finding
  (pre-existing, outside the diff, what the spec asked for, what a green check already answers); each one is verified by
  an independent reviewer before it may cost a fix round — only a confidence of 80+ opens one, the rest is ledgered as
  unconfirmed. `/prReview` verifies before it reports. Two new angles: the project's written rules (the constitution,
  `CLAUDE.md` / `AGENTS.md`, comments in the code — quoted) and the history of the lines a change rewrites (a fix undone,
  a bugfix's root cause back).
- **`/spec-simplify`** — an optional pass before `/spec-finish`: behaviour-preserving cleanups of the code the feature
  added — the smells the reviews deferred first —, one commit each, its own tests after every change and the project
  checks at the end; never a test, a contract or code the feature didn't write; the pass is reviewed and a confirmed
  finding is reverted. With `--subagents` a new `spec-simplifier` agent does it, and the SubagentStop gate sends its DONE
  back until its report's `## Final runs` shows every run passing. Both ideas come from Anthropic's `code-review` and
  `code-simplifier` plugins, rebuilt around the spec and the evidence gate.
- **A full review, fixed** — a run now proves a task only when it IS the task's `_Verify:_` (`command-mismatch`
  otherwise); the stop gate, the approval guard (unquoted `cmd /c`, `pwsh -Command`…) and the Phase 4 tests gate close
  their gaps; bare `AC-n` criteria are flagged; the scan honours `.gitignore` and monorepos; UTF-16 files are read.
  Faster too: the spec-hook ~173 → ~68 ms per edit, the Stop hook ~235 → ~88 ms, a tick ~185 → ~65 ms, the fast-forward
  ~1.2 → ~0.4 s. The CHANGELOG lists every fix.

### New in 1.21

- **Rigor sized to the change** — Phase 0 suggests a size: **xs** is a *change* (one `change.md`, two approvals), **s** one
  story whose plan is approved in one call with each track's core sections only, **m / l** the full chain with the sections
  two tracks both ask for written once. A track section counts as filled only with your own text. No size = as before.
- **Teams** — `dev-spec merge-state --install` lets git merge the spec state (approvals, ticks, evidence) of two branches;
  MCP clients with elicitation ask their user before an approval is recorded.
- **A classifier that learns** — a negation reaches a whole list ("no payments or subscriptions"), and your Phase 0
  corrections become project overrides (`.specs/classifier.json`, `dev-spec signals`, `classify --explain`).
- **+data** — data contracts & schema evolution, data quality, idempotent re-runs & backfills, lineage & ownership,
  retention & cost; and an example `+mobile` track pack in `examples/track-packs/mobile`.

### New in 1.20

- **Easier to maintain, faster to start** — the maintainer notes, the test suites (`--only`, `--list`, parallel) and the
  track engine are split into smaller files, and the placeholder corpus is pre-generated (SessionStart ~37% faster); an
  optional one-file engine (`dev-spec bundle`, `DEV_SPEC_BUNDLE=1`) for a slow file system. No behaviour change.

### New in 1.19

- **Reuse before writing** — every design names what it reuses, extends or adds and where it lives (a Reuse & Integration
  section); each task brief lists the design's entries and the existing files next to the task's; the implementer searches
  before writing and reports what it reused; the reviewer checks duplication against the whole codebase; refactor
  candidates go to the backlog.
- **Three more tracks** — `+api` (contracts, versioning, errors, pagination / idempotency / concurrency, rate limits),
  `+ui` (design system, UI states, WCAG 2.2 accessibility, responsiveness & i18n, a performance budget) and `+obs` (SLOs,
  telemetry, alerting & runbooks, rollout & rollback, health & capacity), each with a guide in `references/`.

### New in 1.18

- **The engine as modules** — `mcp/lib/spec.js` is a facade over `mcp/lib/engine/` (20 modules by concept plus one
  importer per source tool), `i18n.js` over one file per language; a pure refactor, proven behaviour-identical.

### New in 1.17

- **+dist — distributed systems & data consistency** — a seventh track that switches on for queues, events published to
  a broker, sagas, microservices… ("an endpoint that writes a user to Postgres and publishes an event to Kafka"). Its
  design must answer the consistency model (what is atomic, ACID and isolation, strong vs eventual), every dual write and
  its mitigation (transactional outbox, inbox, saga, CDC), delivery and idempotency (duplicates, retries with backoff,
  DLQ), concurrency (optimistic vs pessimistic locking) and failure modes — with criteria, tasks and failure-injection
  tests to match, and a guide: `skills/dev-spec-driven/references/distributed-data-patterns.md`.
- **Every design weighs its choices** — Alternatives & Trade-offs (options, pros, cons, the cost of being wrong) and Risks
  sections in every design; `/grill` asks about atomicity, ACID, race conditions, the consistency model and a measurable
  business outcome; the +tdd loop runs the red → green → refactor micro-cycle inside each task.
- **`import fluidplan`** — a plan settled with the fluidplan skill becomes a spec: stories, criteria, tasks with their
  checks and dependencies, and the decisions you took in `decisions.md`.

### New in 1.16

- **Undo and revoke** — `dev-spec undone <feature> <n>` reopens a ticked task (its evidence turns stale, so a re-tick
  needs a new run); `approve <feature> <phase> --revoke` withdraws an approval (kept in the history, never a cascade).
  `--force --reason "…" --expires 30d` records why a gate was forced and until when — doctor warns once it lapses.
- **In Claude Code** — `/spec-statusline` puts the active feature, its tasks and the next step in the status bar; the
  MCP tools carry annotations (read-only / destructive) and prompt arguments complete feature names; an approved plan
  from plan mode can be imported inline (`import plan -`). Your defaults for every project — `DEV_SPEC_DEFAULT_LANG`,
  `DEV_SPEC_STOP_CHECK`, `DEV_SPEC_GUARD_DEFAULT` — go in the `env` block of Claude Code's `settings.json`.
- **Spec quality** — approvals remember the steering they were made under (doctor warns when the constitution or a
  track's standard changed since; `impact --phase steering` lists who is affected); doctor and the catalog flag
  criteria that duplicate or contradict another feature's; a glossary (`.specs/steering/glossary.md`, `_Avoid:_`
  words) makes clarify ask about the words to avoid.
- **Exports and planning** — `export --gherkin` writes a `.feature` per feature (EARS → Given / When / Then, PT / ES
  dialects); `export --tracker jira|linear` a CSV for the tracker's importer; `/spec-milestone` sets target dates for
  sets of features, judged against the forecasts (on-track · at-risk · late · done) in ROADMAP.md.

### New in 1.15

- **Project-defined tracks** (`/spec-tracks`) — beyond the six built-in tracks, a team defines its own (+a11y, +mobile,
  +dbmigration…) as a folder: `.specs/tracks/<name>/track.json` (name, a case-sensitive marker such as `A11Y`, a title,
  classifier signals, the mandatory design sections, an optional steering file) plus optional markdown fragments —
  criteria, tasks, test rows, checklist items, the steering stub (a `<lang>/` subfolder wins). A valid pack is a marker
  track everywhere: `spec_classify` picks it from its signals, `spec_create` / `add-track` scaffold its `#### [A11Y]`
  criteria, `## [A11Y]` design sections, tasks and test rows, and doctor / the design approval refuse until its sections
  are filled. It is data only (nothing runs; links out of `.specs/` are ignored); a bad pack is reported by `check` and
  ignored. Guide: `skills/dev-spec-driven/references/project-tracks.md`.
  An example to start from: `examples/track-packs/mobile` (+mobile — offline & sync, OS versions & store rollout, permissions,
  performance & battery, push notifications; EN / PT / ES) — copy it to `.specs/tracks/mobile/` and run `dev-spec tracks check`.

### New in 1.14

- **Six tracks** — `+sec` and `+privacy` compose with the others: their `[SEC]` / `[PRIVACY]` criteria, mandatory
  design sections, tasks, test rows and steering (`security.md`, `privacy.md`). Track markers are case-sensitive.
- **Project templates** (`/spec-templates`) — `.specs/templates/<artifact>.md` (or `<lang>/<artifact>.md`; pt-BR
  falls back to `pt/`) replaces a built-in scaffold, with `{{name}}` `{{slug}}` `{{summary}}` `{{tracks}}` `{{lang}}`
  `{{date}}` filled in; the active tracks still get their sections, and an untouched custom scaffold still reads as a
  template to the gates. `check` validates them.
- **For stakeholders** — `/spec-export` writes one offline, printable HTML (or markdown) document of a feature or of the
  project; `/spec-changelog` builds release notes (Added / Changed / Fixed) from what shipped.
- **Team governance** — `init --roles requirements=product,design=tech+security`: a listed phase is approved once every
  role has signed its current content (`approve --role`). `/spec-ff` (`approve --through tasks`) fast-forwards the
  filled phases in order, each through its own gate, and stops at the first refusal.
- **Forecasts** — tasks may carry `_Size: XS|S|M|L|XL_`; the roadmap shows an ETA per feature from the velocity of
  ticked tasks (last 28 days, working days, ±25%) and flags features whose open tasks plan the same files.
- **Stronger evidence** — `_Expect: fail_` marks a test-first task whose run must fail (red → green);
  `init --check test="npm test"` names the project's checks, and `finish` then needs a passing run of each
  (`finish --run`); `done --run` records the git commit; `dev-spec log` lists the commits that cite each task; a
  `_Verify:_` that pipes (`npm test | tee log`) is flagged — the pipeline's exit code is its last command's.
- **Evidence at the end of a turn** — in Claude Code a Stop hook sends the turn back when the closing message claims
  "done" or "verified" while a feature active in the last hours has ticked tasks without passing evidence
  (`init --stop-check off` turns it off; other tools: `dev-spec stop-check`).
- **Evidence the harness saw** — in Claude Code a hook logs every Bash run of a `_Verify:_` or project-check command,
  and each run an agent reports is stamped `observed: true | false` (`"cli"` for `done --run` / `finish --run`). Opt in
  with `init --evidence observed` and only such runs verify a task (reason `unobserved` otherwise); the default
  `reported` keeps today's rule. Not a security boundary; MCP-only clients have no hook — use `done --run`.
- **Human approval guard** — `init --approval-guard ask|deny` (off by default): an agent's `spec_approve`, a feature
  removal, `dev-spec approve` run through its shell, or lowering the guard asks you first (`ask` — Claude Code's auto /
  bypass modes may skip the prompt) or is refused in every mode (`deny` — you run the command it shows in your own
  terminal or with Claude Code's `!` prefix). A guardrail on the approve paths, not a sandbox.
- **Task dependencies and waves** — a task may carry `_Depends: 3, 5_`: the next task is then the first open one whose
  dependencies are done, `dev-spec next <f> --waves` (`spec_next_task {waves}`) groups the open tasks into waves that can
  run at once (no shared `_Implements:_` file), and doctor fails `task-deps` on a cycle or an unknown number. A tasks.md
  without `_Depends:_` behaves as before.
- **Traceability matrix** — `dev-spec trace <f> --matrix` (`trace_check {matrix}`): one row per AC / EC / NFR / SC with
  its status (`verified` · `implemented` · `planned` · `untraced`), tasks and their evidence, tests, design sections,
  decisions and whether it changed since approval; `--csv` / `export <f> --csv --write` → `.specs/exports/<f>.rtm.csv`
  (formula-safe, opens in Excel) for audits.
- **Decisions and spikes** — `/spec-decide` appends `D-n` entries to `decisions.md` (what they affect is checked;
  briefs, the merge summary and the export show them). `/spec-spike` runs a timeboxed investigation that ends in a
  decision — go / no-go / pivot — instead of made-up requirements.
- **Design-first flow** — `create --flow design-first` (or `feature flow`) walks classification → design →
  requirements → … for work that starts from an architecture.
- **`/spec-tour`** — a guided 10-minute tour on your own repo: one tiny real change through every gate.
- **Brazilian Portuguese** — `lang: "pt-BR"` (`--lang pt-BR`) generates the artifacts and messages in PT-BR, a locale
  derived from the European Portuguese one; also new: MCP prompts and `specs://` resources (above), plans / ExecPlans /
  BMAD import, and a Linux test runner for maintainers.

### Local automation, not CI

- **Hooks** (`hooks/hooks.json`): on saving `requirements.md` → EARS lint + placeholders; on saving
  `tasks.md` → traceability check; on saving `design.md` → the active tracks' mandatory sections; at
  session start → feature status + drift + overlapping features; at the end of a turn (and of a
  `spec-implementer` or `spec-simplifier` subagent) → the evidence gate; after each Bash run → the observed-evidence log (silent). The
  opt-in guard runs before code edits, the opt-in approval guard before an agent's approval. Plus an optional git
  `pre-commit` validator.
- **Eval harness** (`mcp/evals/run-evals.js`): runs golden/adversarial/regression sets with **your
  own `ANTHROPIC_API_KEY`**; `--dry-run` validates offline, `--set-baseline` records a baseline.

### Quick start

Install from GitHub (recommended — works on any machine, no paths to edit):

```text
/plugin marketplace add linofcp007/dev-spec-driven
/plugin install dev-spec-driven@dev-spec-driven-marketplace
```

Or clone and load it for one session:

```bash
git clone https://github.com/linofcp007/dev-spec-driven.git
claude --plugin-dir ./dev-spec-driven
```

Then describe a feature (the skill auto-triggers in your language) or drive it explicitly:

```
/dev-spec-driven:spec  Add per-tenant API keys with rotation and Stripe-metered usage
```

### Updating to a new version

1. **Update the plugin** — from the marketplace: `/plugin marketplace update dev-spec-driven-marketplace`, then restart
   Claude Code; a clone: `git pull`, then restart the session.
2. **Run `/spec-upgrade`** in every project that already has a `.specs/` (the session-start hook reminds you while it
   comes from an older version; other tools: `dev-spec upgrade`):
   - **audit** (read-only) — every active feature grouped blocked · needs attention · ok, with its status, what the
     current rules flag, the next step and the review to run;
   - **apply** (after your OK; `dev-spec upgrade --apply`) — the safe migrations: inferred tracks saved, a history
     baseline for each pre-1.13 approval whose file still matches, `meta.specVersion` stamped, the checklist
     `.specs/UPGRADE.md` written, the generated `ROADMAP.md` (and `.html`) refreshed. It never edits a spec, approves,
     ticks or deletes anything;
   - **review** — the `spec-critic` agent over the specs not implemented yet, the converge pass over half-done ones;
     every fix still goes through the normal gates.

### Using it alongside superpowers

Several [superpowers](https://github.com/obra/superpowers) skills overlap this plugin. For feature work,
dev-spec-driven replaces them — superpowers keeps what it doesn't cover (worktrees, parallel agents, writing skills):

| superpowers | dev-spec-driven |
|---|---|
| brainstorming, writing-plans | Phase 0 → requirements → design → tasks (`/spec`, `/clarify`, `/grill`) |
| executing-plans, subagent-driven-development | `/executeTask [--subagents]` |
| test-driven-development | the `+tdd` track and its red-green-refactor micro-cycle inside each task |
| systematic-debugging | `/spec-bugfix` |
| verification-before-completion | the evidence gate (`_Verify:_`, `dev-spec done --run`) |
| requesting / receiving-code-review | `/prReview`, `/spec-review-feedback` |
| finishing-a-development-branch | `/spec-finish` (local merge; no pull requests, no CI) |

Superpowers' own instructions say CLAUDE.md takes precedence over its skills, so **`/spec-superpowers`** writes
(after you confirm) a marked precedence block into the project's `CLAUDE.md` or, with `--user`, into
`~/.claude/CLAUDE.md`; `--remove` takes it out. To switch superpowers off instead: for one project,
`.claude/settings.json` → `"enabledPlugins": { "superpowers@claude-plugins-official": false }`; everywhere,
`/plugin disable` — both also drop the superpowers skills this plugin doesn't replace.

### Commands (55)

`/spec` · `/spec-init` · `/classify` · `/createSpec` · `/clarify` · `/design` · `/testPlan` ·
`/evalPlan` · `/grill` · `/writeTests` · `/createTask` · `/executeTask [--subagents]` · `/spec-doctor` · `/approve` ·
`/next-action` · `/add-track` · `/feature` · `/eval` · `/roadmap` · `/depend` · `/backlog` ·
`/scan` · `/reverse` · `/coverage` · `/spec-status` · `/spec-commit` · `/spec-bugfix` · `/spec-finish` · `/spec-review-feedback` · `/prReview` · `/promptReview` ·
`/migrateModel` — aliases `/ds` `/dsx` `/dss`.
New in 1.13: `/spec-impact` · `/spec-metrics` · `/spec-converge` · `/spec-import` · `/spec-catalog` ·
`/spec-drift` · `/spec-guard` · `/spec-superpowers` · `/spec-upgrade`.
New in 1.14: `/spec-templates` · `/spec-export` · `/spec-changelog` · `/spec-ff` · `/spec-decide` · `/spec-spike` ·
`/spec-tour`. New in 1.15: `/spec-tracks`.
New in 1.16: `/spec-statusline`, `/spec-milestone`. New in 1.22: `/spec-simplify`.
(As a plugin they are namespaced, e.g. `/dev-spec-driven:design`; in other MCP clients they are the server's prompts.)

### The `dev-spec` CLI

The same engine from any terminal (`node cli/dev-spec.js <command>`, or `dev-spec` on PATH); `--json`
prints the raw result, and `help` lists every flag. A plugin install puts no `dev-spec` on PATH, so every message that tells you to run the CLI prints the runnable line,
`node "<clone>/cli/dev-spec.js" …` with the path resolved (committed files such as `ROADMAP.md` keep `dev-spec`):

```text
classify [--explain] · signals [list|set|forget] · init [--guard on|off|scope] [--stop-check on|off] [--check name=cmd] [--roles …]
  [--evidence reported|observed] [--approval-guard off|ask|deny] · steering · templates
create [--brownfield] [--flow design-first] [--kind spike|change] [--size xs|s|m|l] · bugfix · spike · import [- | --text] · list · status · doctor
trace [--code] [--matrix|--csv] · clarify · ears · next [--batch] [--waves] · next-action · brief · done [--run] · undone
append-tasks [--depends 3,5] · approve [--force [--reason] [--expires]] [--revoke] [--role] [--through] · impact [--reopen] · metrics [--write]
finish [--write] [--run] · decide · add-track [--remove] · feature <remove|archive|rename|restore|flow>
catalog [--write] · export [--md|--csv|--gherkin|--tracker jira|linear] [--write] · changelog [--milestone]
drift · stop-check · log · upgrade [--apply] · roadmap · milestone · depend · backlog · scan · coverage · evals
mcp-config <client> · rules <tool> · prompts · statusline [--print-config] · merge-state [--install|--uninstall|--check]
```

### Why no GitHub Actions

By design. Every gate — EARS linting, traceability, classification, status, task tracking — runs
**locally** through the bundled MCP server and the model. Your tests, load tests, and eval harnesses
run in your own environment when you choose, not on a paid CI runner.

### Develop / test

```bash
node mcp/test.js          # smoke-test the MCP server end-to-end (must end `0 failed`)
node cli/test-cli.js      # smoke-test the universal CLI (must end `0 failed`)
npm run test:docker       # both suites in Linux containers (Node 18 / 22 / 24) on your own Docker
```

The Docker runner mounts the plugin read-only and runs without network (only the first run pulls the images); it
exits 0 when every suite passed, 1 on a failure and 2 when Docker isn't available. Plugin evals (`claude plugin eval`,
triggering and behavioural suites) are described in [evals/README.md](./evals/README.md).

> Replaces four predecessor skills; their content lives here as composable tracks (the originals
> remain in git history and the v1.8.0 release if you ever need them).
> MIT licensed.

---

## Português

### Uma skill, tracks que se combinam

Em vez de escolher entre quatro skills sobrepostas, tens **uma** skill que classifica cada
funcionalidade e compõe exatamente o rigor necessário:

| Track | Acrescenta |
|---|---|
| **core** *(sempre)* | Requisitos EARS → design → tarefas → execução, com gates de aprovação |
| **+tdd** | Plano de testes + testes-a-falhar-primeiro + red→green→refactor |
| **+saas** | Desempenho/escala/multi-inquilino/observabilidade/custo + testes de carga |
| **+ai** | Desenvolvimento guiado por evals, prompts como código, economia de tokens, segurança, ciclo de vida do modelo |
| **+sec** | Modelo de ameaças (STRIDE), requisitos de segurança, autenticação e autorização, gestão de segredos e chaves, testes de segurança |
| **+privacy** | RGPD / GDPR: inventário de dados pessoais, fundamento de licitude, conservação e eliminação, direitos dos titulares, subcontratantes e transferências, AIPD |
| **+dist** | Sistemas distribuídos e consistência de dados: modelo de consistência, escritas entre sistemas (escrita dupla) → outbox transacional / inbox / saga, entrega e idempotência, concorrência, modos de falha (CAP / PACELC) |
| **+api** | Contratos de API: o ficheiro do contrato (OpenAPI / proto / esquema GraphQL), versionamento e compatibilidade (o que é incompatível, descontinuação), erros problem+json com códigos estáveis, paginação / idempotência / concorrência (Idempotency-Key, ETag / If-Match), limites de taxa e quotas |
| **+ui** | Interfaces: uso do design system, os estados de cada vista (a carregar / vazio / erro / offline…), acessibilidade (WCAG 2.2 AA), design responsivo e i18n, um orçamento de desempenho (Core Web Vitals) |
| **+obs** | Observabilidade e operabilidade: SLIs e SLOs com orçamento de erro e alertas por taxa de consumo, telemetria (métricas, logs estruturados, traces), alertas e runbooks, lançamento e reversão (feature flags, canário), saúde e capacidade |
| **+data** | Pipelines e qualidade de dados: contratos de dados e evolução do esquema, verificações de qualidade (uma linha errada vai para quarentena, nunca é carregada), reexecuções idempotentes e backfills (dados que chegam atrasados), linhagem e responsáveis (SLAs de atualidade), retenção e custo |

Os tracks **combinam-se**. Um webhook do Stripe num SaaS multi-inquilino que também resume faturas
com um LLM é `core +tdd +saas +ai`; um formulário de registo que guarda dados pessoais é `+privacy` (o RGPD, o GDPR e
a HIPAA apontam para aí); um endpoint que grava um utilizador no Postgres e publica um evento `UserCreated` no Kafka é
`+dist`. Uma alteração de texto é modo Vibe: sem cerimónia. Um
**classificador de Fase 0** (a ferramenta local `spec_classify`, multilíngue) escolhe os tracks; tu
aprovas. Os tracks escolhidos ficam guardados com a funcionalidade, e é possível acrescentar ou desligar
um track mais tarde.

**Tamanhos (1.21) — o rigor acompanha a alteração.** A Fase 0 também sugere um tamanho (`spec_create {size}`): **xs** é
uma *alteração* — um só `change.md` (resumo, 1–3 critérios EARS, abordagem, tarefas com `_Verify:_`) e duas aprovações;
**s** é uma história cujo plano inteiro é aprovado numa só chamada (com +tdd / +ai até ao plano de testes / de avaliação —
a seguir vêm os testes que falham e depois as tarefas), só com as secções core de cada track; **m / l**
mantêm a cadeia completa, com as secções que dois tracks pedem escritas uma só vez. EARS, rastreabilidade, o gate de
evidência e o de fecho valem em todos os tamanhos; uma secção de design só conta como preenchida com texto próprio. Sem
tamanho, fica o scaffold anterior.

### O servidor MCP local (`spec-driven`) — 38 ferramentas

Apenas Node nativo — **sem `npm install`, sem rede, sem custo.** Ferramentas:

| Ferramenta | O que faz |
|---|---|
| `spec_classify` | Recomenda tracks a partir de uma descrição (heurística multilíngue, com peso) |
| `spec_init` | Cria `.specs/steering/` para os tracks; `lang` define a língua do projeto, `guard` on · off · scope, `stopCheck` o gate de evidência no fim do turno, `checks` os comandos de verificação do projeto, `approvalRoles` quem aprova cada fase, `evidence` reported · observed (só verificam as execuções que o harness viu), `approvalGuard` off · ask · deny (a aprovação de um agente pergunta-te / é recusada) |
| `spec_create` | Cria a pasta da funcionalidade para os tracks ativos (`kind: "bugfix"` para o fluxo de bugfix, `kind: "spike"` para uma investigação com prazo, `brownfield: true` acrescenta `integration-plan.md`, `flow: "design-first"` põe o design antes dos requisitos) |
| `spec_import` | Importa uma spec do Kiro, spec-kit ou OpenSpec, um plano do Claude Code / Cursor, um ExecPlan do Codex ou documentos BMAD como nova funcionalidade (IDs convertidos para `US-N.AC-M`, tarefas renumeradas; um plano pode vir como `text` — o plan mode guarda os planos fora do projeto) |
| `spec_templates` | Templates do projeto: lista, copia (`init`) ou verifica (`check`) os scaffolds da equipa em `.specs/templates/`, que substituem os de origem |
| `spec_tracks` | Tracks definidos pelo projeto: lista, cria (`init`) ou verifica (`check`) os track packs da equipa em `.specs/tracks/<nome>/` — cada um é um track com marcador como o `+sec` (sinais, critérios, secções obrigatórias do design, tarefas, linhas de teste, steering) |
| `spec_list` / `spec_status` | Inspeciona funcionalidades, fases, progresso, secções preenchidas vs. presentes; o tipo de cada uma (feature / bugfix / spike) e o fluxo |
| `spec_next_task` / `spec_complete_task` | Conduz a execução e marca tarefas — com **evidência de verificação** registada (uma execução falhada recusa a marcação e fica registada; uma tarefa `_Expect: fail_` prova-se com uma execução que falha; cada execução leva o carimbo `observed`); a próxima tarefa é a primeira aberta cujas `_Depends:_` estão feitas; `batch` para tarefas paralelas `[P]`, `waves` para as vagas de execução de todas as tarefas abertas; `undo` desmarca uma tarefa (a evidência fica obsoleta — voltar a marcá-la exige uma nova execução) |
| `spec_task_brief` | Brief autocontido de uma tarefa — ACs e testes resolvidos para o texto da spec, contexto do design, steering com âmbito, definição de concluído (a base da execução com subagentes) |
| `spec_append_tasks` | Convergência: acrescenta tarefas de seguimento em `Fase: Convergência` sem renumerar as existentes (`depends` acrescenta `_Depends:_`) |
| `spec_finish` | Fecha uma funcionalidade: bloqueios, avisos, verificações a correr de novo e um resumo de merge gerado a partir da cadeia da spec; `evidence` regista as execuções das verificações do projeto; `write` regista também a baseline de drift |
| `spec_next_action` | "Estás aqui → faz isto a seguir", fase a fase: rever → preencher → corrigir → aprovar (a fase seguinte só depois dessa aprovação) → implementar → verificar → fechar (depois fechada / deriva) |
| `spec_approve` | Aprova um gate de fase — recusado enquanto as verificações dessa fase falham (`force` regista uma aprovação forçada e assinalada); cada aprovação fica num histórico com snapshot; `role` valida como um dos papéis que o `approvalRoles` indica para essa fase (obrigatório aí), `through` avança todas as fases até essa, cada uma pelo seu gate; com `force`, `reason` + `expires` registam uma exceção (o doctor avisa `waiver-expired`); `revoke` retira uma aprovação (sem cascata) |
| `spec_impact` | O que uma edição depois da aprovação afeta (ACs, secções, testes planeados, tarefas alteradas → tarefas, testes, design; `phase` requirements · design · test-plan · eval-plan · tasks); `reopen` desmarca as tarefas feitas afetadas (nunca as de um critério removido — `retire` lista-as); `phase` steering (sem nome = todas as funcionalidades ativas) lista as aprovações feitas com steering que mudou desde então |
| `spec_add_track` / `spec_feature` | Acrescenta um track (aditivo; `remove:true` desliga um, sem apagar ficheiros) / arquiva · restaura · renomeia · remove uma funcionalidade (remover exige `confirm:true`), ou define o seu `flow` |
| `spec_decide` | Acrescenta uma decisão (ou uma descoberta) ao `decisions.md` da funcionalidade — `D-n`, com os ACs, testes ou secções do design que afeta (verificados) |
| `ears_validate` | Valida requisitos (SHALL/DEVE/DEBE, IDs estáveis, palavras vagas, placeholders do template — EN/PT/ES) |
| `trace_check` | Cada AC coberto por uma tarefa (e um teste em +tdd); referências fantasma; avisos de EC/NFR/SC; `code:true` procura T-IDs nos ficheiros de teste; `matrix:true` junta a matriz de rastreabilidade dos requisitos |
| `spec_doctor` | Um health-check → "pronto para avançar?" (EARS, placeholders, trace, secções, evidência, gates, steering) |
| `spec_clarify` | Expõe ambiguidades/lacunas dos requisitos antes do design (com um glossário: cada palavra que ele manda evitar) |
| `spec_metrics` | Lead times, retrabalho, aprovações forçadas, pedidos de alteração, taxa de sucesso da evidência; `write` cria um `retro.md` pré-preenchido |
| `spec_catalog` | Catálogo vivo dos ACs de todas as funcionalidades, com os substituídos assinalados (`_Supersedes:_` de uma funcionalidade entregue; o de um rascunho fica como "substituição prevista"), e os possíveis critérios duplicados / em conflito entre funcionalidades ativas; `write` → `.specs/SPECS.md` |
| `spec_export` | Um documento autocontido, offline e imprimível (HTML ou markdown) de uma funcionalidade ou do projeto inteiro, para stakeholders — ou a matriz de rastreabilidade em CSV (`format: "csv"`), um `.feature` Gherkin por funcionalidade (`"gherkin"`: um cenário por critério de aceitação, com as cláusulas EARS como Dado / Quando / Então) ou um CSV para o importador do Jira / Linear (`"jira"` · `"linear"`: a funcionalidade, as histórias, as tarefas); `write` → `.specs/exports/` |
| `spec_changelog` | Notas de versão a partir das specs — Added / Changed / Fixed desde uma data ou desde as últimas notas; `milestone` restringe-as às funcionalidades de um marco; `write` → `.specs/RELEASE-NOTES.md` |
| `spec_drift` | Ficheiros de implementação alterados, em falta ou novos desde que o `spec_finish` registou a baseline |
| `spec_stop_check` | O gate de evidência do fim do turno para clientes só MCP: esta mensagem final ("feito", "verificado") seria devolvida — tarefas marcadas sem evidência, verificações do projeto sem execução bem-sucedida? |
| `spec_log` | Os commits que citam cada tarefa (+ a verificação red-first do +tdd) a partir do texto de `git log` que o cliente passa — o servidor nunca corre o git |
| `spec_upgrade` | Depois de atualizar o plugin: audita cada funcionalidade ativa face às regras atuais (estado, o que o doctor assinala, próximo passo, uma revisão critic / converge); `apply` guarda os tracks inferidos, dá às aprovações anteriores à 1.13 uma baseline no histórico, carimba `meta.specVersion` e escreve `.specs/UPGRADE.md` — nunca edita uma spec |
| `spec_roadmap` / `spec_depend` | Roadmap + dependências (deteta ciclos; `add` / `remove` editam a lista), uma ETA por funcionalidade a partir da velocidade das tarefas marcadas e os ficheiros que as tarefas abertas de duas funcionalidades planeiam em comum; `write:true` → `.specs/ROADMAP.md` (+ `html:true` para o `.html` com a marca, offline, claro/escuro; `lang`) |
| `spec_milestone` | Marcos: uma data-alvo para um conjunto de funcionalidades (`add` · `rm` · `list`), avaliada face às ETAs — `on-track` · `at-risk` · `late` · `done` (o ROADMAP.md mostra-os; renomear / arquivar / remover uma funcionalidade reflete-se neles) |
| `spec_backlog` | Regista funcionalidades planeadas mas ainda sem spec (aparecem no ROADMAP.md) |
| `spec_scan` / `spec_coverage` | Brownfield: inventário de código existente (rotas, testes, pontos de entrada, nomes de variáveis de ambiente, migrações) + a parte dos ficheiros de código indicados em `_Implements:_` |
| `steering_scaffold` | Cria um ficheiro de steering a partir do template (incl. `constitution.md`, `glossary.md`), ou um ficheiro personalizado com âmbito |

**Prompts e recursos.** O servidor serve também um **prompt** MCP por cada comando do plugin — `/spec`, `/spec-status`,
`/spec-impact`, … passam a comandos de barra nos clientes MCP que mostram prompts (o VS Code / Copilot Chat, por
exemplo) — e as specs do projeto como **recursos** só de leitura: `specs://roadmap`, `specs://catalog`, `specs://steering/{file}`,
`specs://feature/{slug}/{artifact}`. O plugin do Claude Code desliga os prompts (`SPEC_MCP_PROMPTS=off` em
`mcp/servers.json`), porque aí os comandos já são comandos de barra.

### Execução com subagentes (opcional)

`/executeTask <feature> --subagents` guarda o contexto da sessão principal para a coordenação: por tarefa
escreve um brief (`spec_task_brief`), despacha o agente **`dev-spec-driven:spec-implementer`** do plugin,
envia o diff ao agente **`dev-spec-driven:spec-reviewer`** (veredicto por AC ID + qualidade + verificações do
track + as regras escritas do projeto), põe um revisor independente a verificar cada problema apontado (só uma confiança de
80 ou mais custa uma ronda de correções), faz um ciclo de correções de no máximo 5 rondas e só depois marca a tarefa. Avança sozinho dentro de
uma história, para em cada `**Checkpoint:**` para a tua revisão e nunca muda um AC, o design ou um teste sem
voltar a essa fase. Gasta cerca de 2–3× os tokens da execução inline, por isso compensa em funcionalidades
com ~6+ tarefas independentes. Protocolo: `skills/dev-spec-driven/references/subagent-execution.md`. Adaptado da
skill `subagent-driven-development` do [obra/superpowers](https://github.com/obra/superpowers) (MIT).

### Gates e evidência

- **Uma aprovação é um gate, não um carimbo.** `spec_approve` corre primeiro as verificações da fase (erros
  EARS, placeholders do template, `[NEEDS CLARIFICATION]` por resolver, secções em falta, ACs sem cobertura,
  …; a Fase 4 `tests`: cada T-ID planeado num ficheiro de teste / um conjunto de evals próprio; `execution`: os
  bloqueios do `spec_finish`) e recusa enquanto alguma falhar. `force: true` (CLI `--force`) regista-a na mesma como aprovação
  **forçada**, com as verificações que falharam, e o `doctor` e o roadmap continuam a assinalá-la.
- **Um template não é conteúdo.** O `doctor` tem a verificação `placeholders` (falha na fase atual e nas
  anteriores), uma funcionalidade nova começa na sua primeira fase (`requirements`; `design` no fluxo design-first) e o `ears_validate` reporta o código
  `placeholder`. Um parêntese reto só conta quando o texto é um dos que os templates escrevem (ou TODO / TBD / FIXME /
  `…`): valores reais como `[free: 60, pro: 600]` ou `[admin, billing-manager]` são conteúdo teu.
- **O `next_action` avança fase a fase:** rever → na primeira fase ainda por aprovar, preencher → corrigir → aprovar (a
  fase seguinte só depois dessa aprovação — no fluxo por omissão nunca pede o design antes de os requisitos estarem aprovados, e o `approve`
  recusa uma fase enquanto uma anterior estiver por aprovar) → implementar → verificar → fechar. Nunca
  recomenda uma aprovação que o gate recusaria; em vez disso, diz em que falha — nem o `spec_finish` enquanto houver
  uma tarefa marcada por verificar (o passo `verify` nomeia-a com o seu `dev-spec done <f> <n> --run`). Em +tdd / +ai, a Fase 4
  (testes a falhar / harness de evals, `approve <f> tests`) é um gate que pede antes de implementar qualquer tarefa.
- **Evidência antes de afirmações.** As tarefas declaram `_Verify: <comando>_`; `spec_complete_task` regista
  o comando, o código de saída e um resumo. Uma tarefa com um `_Verify:_` executável só fica verificada com uma
  execução registada: uma que passe — ou, numa tarefa marcada `_Expect: fail_` (um teste vermelho, como a tarefa 3
  de um bugfix), uma que falhe (uma que passe é recusada: `unexpected-pass`); qualquer outra falha recusa a
  marcação. **Não consegues correr o comando?** Não marques a tarefa — nem sem nada, nem com uma nota: indica o
  comando e pede o output (ou `dev-spec done <feature> <n> --run`); uma marcação só com nota fica por verificar e é
  para quando o utilizador a pede explicitamente. As execuções falhadas ficam num histórico curto, e uma tarefa
  reaberta depois de uma alteração à spec fica com evidência **desatualizada** até voltar a correr. O
  `spec_complete_task` devolve um código de motivo estável (`unverifiedReason`: `failed-run`,
  `manual-note-on-runnable-verify`, `duplicate-number`, `stale-evidence`, `unexpected-pass`, `no-evidence`,
  `unobserved` — com `meta.evidence: "observed"`, uma execução que o harness nunca viu —, `command-mismatch` — a
  execução registada não é uma execução do comando `_Verify:_` da tarefa); o `doctor`, o `spec_finish` e a linha "Precisa de
  atenção" do `ROADMAP.md` listam cada tarefa por verificar com o motivo. CLI:
  `dev-spec done <feature> <n> --run`.
- **`/spec-bugfix`** — uma spec leve para um defeito: reproduzir → **causa raiz com evidência** → teste de
  regressão a falhar → correção → verificação. O `doctor` falha até a causa raiz estar escrita, e as tarefas
  depois da tarefa da causa raiz não podem ser concluídas antes disso. O que já sabes entra com o scaffold
  (`spec_create {kind: "bugfix", reproduction, rootCause, condition, behaviour, includeBody}` / `--reproduction`,
  `--root-cause`, `--condition`, `--behaviour`) — sem reler e reescrever os quatro ficheiros.
- **`/spec-finish`** — bloqueia com falhas do doctor, um artefacto alterado depois da aprovação, placeholders
  em qualquer ponto da cadeia, tarefas abertas ou por verificar e gates pendentes; lista as verificações a
  correr de novo e constrói um resumo de merge a partir da spec. Depois fazes o merge localmente ou manténs o
  branch — sem pull requests, sem CI.
- **`/spec-review-feedback`** — comentários de revisão avaliados contra a spec. **`/spec-doctor --deep`** —
  o agente `spec-critic` revê o *significado* da spec no respetivo gate.
- **Modo bounded** entre Vibe e Spec (design curto no chat + um sim explícito), **Restrições Globais** incluídas em
  cada brief de tarefa, **tarefas `[P]` em paralelo** em worktrees separadas e **evals do plugin** (`evals/`,
  `claude plugin eval`) que verificam que a skill dispara em EN/PT/ES — e, na suite de comportamento, que o agente
  respeita depois o fluxo (planeia primeiro, regista evidência, nunca força um gate). Ideias adaptadas do
  [obra/superpowers](https://github.com/obra/superpowers) (MIT).

### Gestão de alterações

- **Histórico de aprovações.** Cada aprovação é acrescentada ao `.state.json` (`approvalHistory`) e guarda um
  snapshot do que aprovou em `.specs/<feature>/.history/<fase>@<n>.md` — faz commit dele com a spec.
- **`/spec-impact`** (`spec_impact`) — depois de um artefacto aprovado mudar, compara a edição com esse
  snapshot: ACs (e IDs SC/EC/NFR), secções do design ou do eval-plan, testes planeados (T-IDs) ou tarefas acrescentados, alterados ou removidos e, para
  cada um, as tarefas que o citam (feitas ou abertas, com a evidência), os testes que o cobrem e as secções do
  design que o mencionam. `reopen` desmarca as tarefas feitas afetadas, marca a evidência como desatualizada
  e regista o pedido de alteração — nunca as tarefas de um critério removido: o `retire` lista-as (e as linhas
  de teste) para apagar ou apontar para o critério que o substitui. Nunca edita os teus requisitos nem o design.
- **`/spec-converge`** (`spec_append_tasks`) — quando a implementação se afastou do plano ou uma revisão
  encontrou trabalho de seguimento, acrescenta tarefas novas (numeradas depois da última, em
  `Fase: Convergência`) com `_Requirements:_`, `_Implements:_` e `_Verify:_` (e `_Makes green:_`, `_Expect: fail_`,
  `_Size:_` quando indicados). IDs de AC desconhecidos — ou T-IDs que o plano de testes não prevê — são recusados, as
  tarefas existentes nunca mudam e uma lista de tarefas já aprovada pede nova aprovação.

### Catálogo vivo, drift e restauro

- **`/spec-catalog`** (`spec_catalog`) — "o que o sistema faz hoje": todas as funcionalidades (ativas,
  terminadas, arquivadas) com cada AC numa linha EARS. Um critério substituído por uma funcionalidade
  posterior é declarado com `_Supersedes: <feature>/US-n.AC-m_` e o antigo aparece como substituído. `write`
  gera `.specs/SPECS.md` (nunca por cima de um ficheiro escrito à mão), atualizado com o roadmap a partir daí.
- **`/spec-drift`** (`spec_drift`) — o `spec_finish` com `write` numa funcionalidade pronta regista um hash de
  cada ficheiro indicado nos marcadores `_Implements:_`; o drift reporta os ficheiros alterados, em falta ou
  novos desde então. O hook de SessionStart acrescenta uma linha por cada funcionalidade ativa com drift.
- **Restauro** — `spec_feature archive` regista as dependências que remove, e `restore` traz a
  funcionalidade de volta com a entrada no roadmap e essas dependências.

### Modo guarda e steering com âmbito

- **`/spec-guard`** — modo guarda opcional (`spec_init {guard}` / `dev-spec init --guard on|off|scope`).
  Enquanto está ligado, um hook PreToolUse do Claude Code **pergunta antes** de um Write/Edit num ficheiro de
  código fora de `.specs/` quando nenhuma funcionalidade tem tarefas aprovadas por terminar — exceto um ficheiro de
  teste enquanto o plano de testes de uma funcionalidade está aprovado (a Fase 4 escreve primeiro os testes a falhar) e
  qualquer código enquanto existe um spike ativo (o seu protótipo); `scope` pergunta
  também, depois de as tarefas estarem aprovadas, por um ficheiro de código que nenhuma tarefa aberta indica em
  `_Implements:_` (os ficheiros de teste ficam de fora) e diz qual a tarefa provável. Fica em silêncio
  quando desligado e nunca bloqueia por erros próprios. As outras ferramentas não correm hooks do Claude
  Code, por isso aí o modo guarda não faz nada.
- **Steering com âmbito** — os ficheiros de steering aceitam front matter compatível com o Kiro:
  `inclusion: always`, `fileMatch` (com `fileMatchPattern: "src/api/**"`) ou `manual`. O `steering_scaffold`
  cria ficheiros personalizados como `api-conventions.md`, e cada brief de tarefa inclui os ficheiros cujo
  padrão corresponde aos caminhos `_Implements:_` da tarefa.
- **Equipas: o git combina o estado da spec** — `dev-spec merge-state --install` (uma vez por clone, e de novo após uma atualização do plugin — `--check` diz; faz commit do
  `.gitattributes` que escreve) faz o git combinar `.state.json` / `roadmap.json` pelo significado: as aprovações, tarefas
  concluídas e evidência de dois ramos juntam-se em vez de entrar em conflito; um conflito real fica em JSON válido
  (`mergeConflicts`) e o doctor falha até ser resolvido.
- **Aprovações noutros clientes MCP** — com `approvalGuard` ask / deny, um cliente que suporte elicitation do MCP
  pergunta ao utilizador antes de o `spec_approve` registar alguma coisa (só conta uma aprovação explícita); sem isso,
  `deny` é recusado.

### Brownfield, importação e métricas

- **Análise mais funda** — o `spec_scan` lista rotas HTTP com método, caminho e `ficheiro:linha` (Express,
  NestJS, Next.js, FastAPI, Flask, Django, Spring, ASP.NET, Rails, Laravel, Go …), frameworks de teste,
  pontos de entrada, **nomes** de variáveis de ambiente (nunca os valores) e ficheiros de migração. O
  `spec_coverage` mede a parte dos ficheiros de código indicados num marcador `_Implements:_`, por pasta.
  `create --brownfield` acrescenta um `integration-plan.md`.
- **`/spec-import`** (`spec_import`) — traz uma spec do Kiro (`.kiro/specs/<name>/`), do spec-kit
  (`specs/<nnn-name>/`) ou do OpenSpec (`openspec/specs/<capability>/` ou uma pasta de change) como nova
  funcionalidade: os critérios passam a linhas EARS `US-N.AC-M` (ou mantêm o texto com
  `[NEEDS CLARIFICATION]`) e as tarefas são renumeradas com o estado das checkboxes. Também planos: `plan` (um
  ficheiro do plan mode do Claude Code copiado para o projeto, ou um `.cursor/plans/*.plan.md` do Cursor), `execplan`
  (um ExecPlan do Codex) e `bmad` (PRD e stories do BMAD-METHOD) — e `fluidplan` (um plano decidido com a skill
  fluidplan: `.fluidplan/<id>/` ou o `PLAN.md` / `DECISIONS.md` dele → histórias, critérios, tarefas com `_Verify:_` /
  `_Depends:_` e um `decisions.md` com as decisões tomadas). A origem tem de estar dentro do projeto e só é lida.
- **Rastreabilidade mais funda** — o `trace_check` avisa sobre casos-limite (EC-n), NFRs e critérios de
  sucesso (SC-nnn) sem cobertura; `--code` procura T-IDs nos nomes dos testes (`test("T-01 …")`,
  `def test_T01_…`). Os planos de testes têm uma coluna **Tipo** (Kind: `example` | `property`) com orientação
  para testes baseados em propriedades.
- **`/spec-metrics`** (`spec_metrics`) — lead time por fase, retrabalho, aprovações forçadas, pedidos de
  alteração e taxa de sucesso da evidência, por funcionalidade ou para o projeto; `write` cria um `retro.md`
  pré-preenchido.

### Novidades da 1.22

- **Revisões em que se pode confiar** — o revisor dá a cada problema Critical / Important que aponta uma confiança de 0 a
  100 e sabe o que não conta como problema (o que já existia, o que está fora do diff, o que a spec pediu, o que uma
  verificação a verde já responde); cada um é verificado por um revisor independente antes de poder custar uma ronda de
  correções — só uma confiança de 80 ou mais a abre, o resto fica no ledger como não confirmado. O `/prReview` verifica
  antes de reportar. Dois ângulos novos: as regras escritas do projeto (a constituição, `CLAUDE.md` / `AGENTS.md`, os
  comentários no código — citados) e o histórico das linhas que uma alteração reescreve (uma correção desfeita, o regresso
  da causa raiz de um bug já corrigido).
- **`/spec-simplify`** — uma passagem opcional antes do `/spec-finish`: limpezas que não mudam o comportamento do código
  que a funcionalidade acrescentou — primeiro os smells que as revisões adiaram —, um commit por limpeza, os testes da
  funcionalidade depois de cada alteração e as verificações do projeto no fim; nunca um teste, um contrato ou código que a
  funcionalidade não escreveu; a passagem é revista e um problema confirmado é revertido. Com `--subagents` é um novo
  agente, `spec-simplifier`, que a faz, e o gate SubagentStop devolve o DONE dele enquanto a secção `## Final runs` do
  relatório não mostrar todas as execuções a passar. As duas ideias vêm dos plugins `code-review` e `code-simplifier` da
  Anthropic, reconstruídas à volta da spec e do gate de evidência.
- **Uma revisão completa, corrigida** — uma execução só prova uma tarefa quando É o `_Verify:_` dela (senão
  `command-mismatch`); o gate de paragem, a guarda das aprovações (`cmd /c`, `pwsh -Command` sem aspas…) e o gate dos
  testes da Fase 4 fecham as suas lacunas; os critérios com `AC-n` sem história são assinalados; o scan respeita o
  `.gitignore` e os monorepos; os ficheiros UTF-16 são lidos. E mais rápido: o spec-hook ~173 → ~68 ms por edição, o hook
  Stop ~235 → ~88 ms, marcar uma tarefa ~185 → ~65 ms, o avanço rápido ~1,2 → ~0,4 s. O CHANGELOG lista cada correção.

### Novidades da 1.21

- **Rigor à medida da alteração** — a Fase 0 sugere um tamanho: **xs** é uma *alteração* (um `change.md`, duas
  aprovações), **s** uma história cujo plano se aprova numa só chamada, só com as secções essenciais de cada track, **m / l**
  a cadeia completa, com as secções que dois tracks pedem escritas uma vez. Uma secção de track só conta como preenchida com
  texto seu. Sem tamanho = como antes.
- **Equipas** — `dev-spec merge-state --install` deixa o git juntar o estado da spec (aprovações, tarefas, evidência) de dois
  branches; os clientes MCP com elicitation perguntam ao utilizador antes de registar uma aprovação.
- **Um classificador que aprende** — uma negação alcança uma lista inteira ("sem pagamentos nem subscrições") e as suas
  correções da Fase 0 tornam-se ajustes do projeto (`.specs/classifier.json`, `dev-spec signals`, `classify --explain`).
- **+data** — contratos de dados e evolução do esquema, qualidade dos dados, reprocessamentos idempotentes e backfills,
  linhagem e responsáveis, retenção e custo; e um track pack de exemplo `+mobile` em `examples/track-packs/mobile`.

### Novidades da 1.20

- **Mais fácil de manter, mais rápido a arrancar** — as notas de manutenção, as suites de testes (`--only`, `--list`, em
  paralelo) e o motor dos tracks passam a ficheiros mais pequenos, e o corpus de placeholders é pré-gerado (SessionStart
  ~37% mais rápido); um motor opcional num só ficheiro (`dev-spec bundle`, `DEV_SPEC_BUNDLE=1`) para um sistema de ficheiros
  lento. Sem mudança de comportamento.

### Novidades da 1.19

- **Reutilizar antes de escrever** — todo o design diz o que reutiliza, estende ou acrescenta e onde vive (uma secção
  Reuse & Integration); o brief de cada tarefa lista as entradas do design e os ficheiros existentes junto aos da tarefa;
  o implementador procura antes de escrever e reporta o que reutilizou; o revisor verifica duplicação contra todo o código;
  os candidatos a refactorização vão para o backlog.
- **Mais três tracks** — `+api` (contratos, versionamento, erros, paginação / idempotência / concorrência, limites de
  pedidos), `+ui` (design system, estados da interface, acessibilidade WCAG 2.2, responsividade e i18n, um orçamento de
  desempenho) e `+obs` (SLOs, telemetria, alertas e runbooks, rollout e rollback, saúde e capacidade), cada um com um guia
  em `references/`.

### Novidades da 1.18

- **O motor em módulos** — `mcp/lib/spec.js` passa a fachada sobre `mcp/lib/engine/` (20 módulos por conceito e um
  importador por ferramenta de origem), o `i18n.js` sobre um ficheiro por língua; um refactor puro, com comportamento
  comprovadamente idêntico.

### Novidades da 1.17

- **+dist — sistemas distribuídos e consistência de dados** — um sétimo track que se liga com filas, eventos publicados
  num broker, sagas, microsserviços… ("um endpoint que grava um utilizador no Postgres e publica um evento no Kafka"). O
  design tem de responder ao modelo de consistência (o que é atómico, ACID e isolamento, forte vs eventual), a cada escrita
  dupla e à sua mitigação (outbox transacional, inbox, saga, CDC), à entrega e idempotência (duplicados, retries com
  backoff, DLQ), à concorrência (locking otimista vs pessimista) e aos modos de falha — com critérios, tarefas e testes de
  injeção de falhas a condizer, e um guia: `skills/dev-spec-driven/references/distributed-data-patterns.md`.
- **Todo o design pesa as suas escolhas** — secções Alternatives & Trade-offs (opções, prós, contras, o custo de errar) e
  Risks em todos os designs; o `/grill` pergunta por atomicidade, ACID, race conditions, o modelo de consistência e um
  resultado de negócio mensurável; o ciclo +tdd faz o micro-ciclo vermelho → verde → refactor dentro de cada tarefa.
- **`import fluidplan`** — um plano decidido com a skill fluidplan passa a spec: histórias, critérios, tarefas com as suas
  verificações e dependências, e as decisões tomadas em `decisions.md`.

### Novidades da 1.16

- **Desfazer e revogar** — `dev-spec undone <funcionalidade> <n>` reabre uma tarefa marcada (a evidência fica
  desatualizada, por isso voltar a marcá-la exige uma nova execução); `approve <funcionalidade> <fase> --revoke` retira
  uma aprovação (fica no histórico, sem cascata). `--force --reason "…" --expires 30d` regista porque um gate foi forçado
  e até quando — o doctor avisa quando expira.
- **No Claude Code** — `/spec-statusline` põe a funcionalidade ativa, as tarefas e o passo seguinte na barra de estado;
  as ferramentas MCP trazem anotações (só leitura / destrutiva) e os argumentos dos prompts completam nomes de
  funcionalidades; um plano aprovado no plan mode pode ser importado em linha (`import plan -`). As tuas predefinições
  para todos os projetos — `DEV_SPEC_DEFAULT_LANG`, `DEV_SPEC_STOP_CHECK`, `DEV_SPEC_GUARD_DEFAULT` — vão no bloco
  `env` do `settings.json` do Claude Code.
- **Qualidade das specs** — as aprovações guardam o steering sob o qual foram feitas (o doctor avisa quando a
  constituição ou a norma de um track mudou desde então; `impact --phase steering` lista quem é afetado); o doctor e o
  catálogo assinalam critérios que duplicam ou contradizem os de outra funcionalidade; um glossário
  (`.specs/steering/glossary.md`, palavras `_Avoid:_`) faz o clarify perguntar pelas palavras a evitar.
- **Exportações e planeamento** — `export --gherkin` escreve um `.feature` por funcionalidade (EARS → Dado / Quando /
  Então, dialetos PT / ES); `export --tracker jira|linear` um CSV para o importador do tracker; `/spec-milestone` define
  datas-alvo para conjuntos de funcionalidades, avaliadas face às previsões (on-track · at-risk · late · done) no
  ROADMAP.md.

### Novidades da 1.15

- **Tracks definidos pelo projeto** (`/spec-tracks`) — além dos seis tracks de origem, uma equipa define os seus (+a11y,
  +mobile, +dbmigration…) como uma pasta: `.specs/tracks/<nome>/track.json` (nome, um marcador sensível a maiúsculas
  como `A11Y`, um título, sinais para o classificador, as secções obrigatórias do design, um ficheiro de steering
  opcional) mais fragmentos markdown opcionais — critérios, tarefas, linhas de teste, itens de checklist, o stub de
  steering (uma subpasta `<lang>/` tem prioridade). Um pack válido é um track com marcador em todo o lado: o
  `spec_classify` escolhe-o pelos seus sinais, o `spec_create` / `add-track` criam os seus critérios `#### [A11Y]`, as
  secções `## [A11Y]` do design, as tarefas e as linhas de teste, e o doctor / a aprovação do design recusam até as
  secções estarem preenchidas. São só dados (nada é executado; ligações para fora de `.specs/` são ignoradas); um pack
  inválido é reportado pelo `check` e ignorado. Guia: `skills/dev-spec-driven/references/project-tracks.md`.
  Um exemplo para começar: `examples/track-packs/mobile` (+mobile — offline e sincronização, versões e lançamento nas lojas,
  permissões, desempenho e bateria, notificações push; EN / PT / ES) — copie-o para `.specs/tracks/mobile/` e corra `dev-spec tracks check`.

### Novidades da 1.14

- **Seis tracks** — `+sec` e `+privacy` combinam-se com os outros: critérios `[SEC]` / `[PRIVACY]`, secções obrigatórias
  do design, tarefas, linhas de teste e steering (`security.md`, `privacy.md`). Os marcadores dos tracks distinguem
  maiúsculas de minúsculas.
- **Templates do projeto** (`/spec-templates`) — `.specs/templates/<artefacto>.md` (ou `<lang>/<artefacto>.md`;
  o pt-BR recorre a `pt/` quando não tem o seu) substitui um scaffold de origem, com `{{name}}` `{{slug}}`
  `{{summary}}` `{{tracks}}` `{{lang}}` `{{date}}` preenchidos; os tracks ativos continuam a receber as suas secções, e
  um scaffold personalizado por tocar continua a ler-se como template nos gates. O `check` valida-os.
- **Para stakeholders** — o `/spec-export` escreve um documento HTML (ou markdown) offline e imprimível de uma
  funcionalidade ou do projeto; o `/spec-changelog` constrói notas de versão (Added / Changed / Fixed) a partir do que
  foi entregue.
- **Governação da equipa** — `init --roles requirements=product,design=tech+security`: uma fase da lista fica aprovada
  quando todos os papéis aprovaram o conteúdo atual (`approve --role`). O `/spec-ff` (`approve --through tasks`) avança
  as fases preenchidas por ordem, cada uma pelo seu gate, e para na primeira recusa.
- **Previsões** — as tarefas podem ter `_Size: XS|S|M|L|XL_`; o roadmap mostra uma ETA por funcionalidade a partir da
  velocidade das tarefas marcadas (últimos 28 dias, dias úteis, ±25%) e assinala funcionalidades cujas tarefas abertas
  planeiam os mesmos ficheiros.
- **Evidência mais forte** — `_Expect: fail_` marca uma tarefa de teste primeiro cuja execução tem de falhar (red →
  green); `init --check test="npm test"` dá nome às verificações do projeto, e o `finish` passa a exigir uma execução
  bem-sucedida de cada uma (`finish --run`); o `done --run` regista o commit do git; o `dev-spec log` lista os commits
  que citam cada tarefa; um `_Verify:_` com pipe (`npm test | tee log`) é assinalado — o código de saída de um pipeline
  é o do último comando.
- **Evidência no fim do turno** — no Claude Code, um hook Stop devolve o turno quando a mensagem final afirma "feito" ou
  "verificado" enquanto uma funcionalidade ativa nas últimas horas tem tarefas marcadas sem a evidência de uma execução
  bem-sucedida (`init --stop-check off` desliga-o; noutras ferramentas: `dev-spec stop-check`).
- **Evidência que o harness viu** — no Claude Code, um hook regista cada execução Bash de um comando `_Verify:_` ou de
  uma verificação do projeto, e cada execução que um agente reporta leva o carimbo `observed: true | false` (`"cli"` para
  `done --run` / `finish --run`). Com `init --evidence observed` (opcional), só essas execuções verificam uma tarefa
  (motivo `unobserved` caso contrário); o modo por omissão, `reported`, mantém a regra de hoje. Não é uma fronteira de
  segurança; um cliente só MCP não tem hook — usa `done --run`.
- **Guarda humana das aprovações** — `init --approval-guard ask|deny` (desligada por omissão): o `spec_approve` de um
  agente, a remoção de uma funcionalidade, um `dev-spec approve` corrido pela shell dele, ou baixar a guarda,
  pergunta-te primeiro (`ask` — os modos auto / bypass do Claude Code podem saltar a pergunta) ou é recusado em qualquer
  modo (`deny` — corres tu o comando indicado no teu terminal ou com o prefixo `!` do Claude Code). Uma barreira nos
  caminhos de aprovação, não uma sandbox.
- **Dependências entre tarefas e vagas** — uma tarefa pode ter `_Depends: 3, 5_`: a próxima tarefa passa a ser a
  primeira aberta cujas dependências estão feitas, `dev-spec next <f> --waves` (`spec_next_task {waves}`) agrupa as
  tarefas abertas em vagas que podem correr ao mesmo tempo (sem ficheiros `_Implements:_` partilhados), e o doctor falha
  `task-deps` num ciclo ou num número desconhecido. Um tasks.md sem `_Depends:_` comporta-se como antes.
- **Matriz de rastreabilidade** — `dev-spec trace <f> --matrix` (`trace_check {matrix}`): uma linha por AC / EC / NFR /
  SC com o seu estado (`verified` · `implemented` · `planned` · `untraced`), as tarefas e a sua evidência, testes,
  secções do design, decisões e se mudou desde a aprovação; `--csv` / `export <f> --csv --write` →
  `.specs/exports/<f>.rtm.csv` (à prova de fórmulas, abre no Excel) para auditorias.
- **Decisões e spikes** — o `/spec-decide` acrescenta entradas `D-n` ao `decisions.md` (o que afetam é verificado; os
  briefs, o resumo de merge e a exportação mostram-nas). O `/spec-spike` faz uma investigação com prazo que acaba numa
  decisão — go / no-go / pivot — em vez de requisitos inventados.
- **Fluxo design-first** — `create --flow design-first` (ou `feature flow`) percorre classificação → design →
  requisitos → … para trabalho que parte de uma arquitetura.
- **`/spec-tour`** — uma visita guiada de 10 minutos no teu próprio repositório: uma alteração real e pequena por todos
  os gates.
- **Português do Brasil** — `lang: "pt-BR"` (`--lang pt-BR`) gera os artefactos e as mensagens em PT-BR, um locale
  derivado do português europeu; também novos: prompts MCP e recursos `specs://` (acima), importação de planos /
  ExecPlans / BMAD e um runner de testes em Linux para quem mantém o plugin.

### Automação local, sem CI

- **Hooks** (`hooks/hooks.json`): ao gravar `requirements.md` → valida EARS + placeholders; ao gravar
  `tasks.md` → verifica a rastreabilidade; ao gravar `design.md` → as secções obrigatórias dos tracks ativos;
  no arranque da sessão → estado das funcionalidades + drift + funcionalidades que se sobrepõem; no fim de um turno
  (e de um subagente `spec-implementer` ou `spec-simplifier`) → o gate de evidência; depois de cada execução Bash → o registo da evidência
  observada (silencioso). O modo guarda opcional corre antes das edições de código, a guarda opcional das aprovações
  antes da aprovação de um agente. Mais um validador `pre-commit` opcional do git.
- **Harness de evals** (`mcp/evals/run-evals.js`): corre os conjuntos golden/adversarial/regression
  com a **tua própria `ANTHROPIC_API_KEY`**; `--dry-run` valida offline, `--set-baseline` grava uma
  baseline.

### Começar rápido

Instala a partir do GitHub (recomendado — funciona em qualquer máquina, sem caminhos para editar):

```text
/plugin marketplace add linofcp007/dev-spec-driven
/plugin install dev-spec-driven@dev-spec-driven-marketplace
```

Ou clona e carrega-o só para uma sessão:

```bash
git clone https://github.com/linofcp007/dev-spec-driven.git
claude --plugin-dir ./dev-spec-driven
```

Depois descreve uma funcionalidade (a skill ativa-se na tua língua) ou conduz explicitamente:

```
/dev-spec-driven:spec  Adicionar chaves de API por inquilino com rotação e uso medido pelo Stripe
```

### Atualizar para uma nova versão

1. **Atualiza o plugin** — a partir do marketplace: `/plugin marketplace update dev-spec-driven-marketplace` e depois
   reinicia o Claude Code; um clone: `git pull` e depois reinicia a sessão.
2. **Corre `/spec-upgrade`** em cada projeto que já tem um `.specs/` (o hook de início de sessão lembra-te enquanto
   ele vier de uma versão anterior; noutras ferramentas: `dev-spec upgrade`):
   - **auditoria** (só leitura) — cada funcionalidade ativa agrupada em bloqueada · a precisar de atenção · ok, com o
     estado, o que as regras atuais assinalam, o próximo passo e a revisão a correr;
   - **apply** (depois do teu OK; `dev-spec upgrade --apply`) — as migrações seguras: tracks inferidos guardados, uma
     baseline no histórico para cada aprovação anterior à 1.13 cujo ficheiro ainda corresponde, `meta.specVersion`
     carimbado, a checklist `.specs/UPGRADE.md` escrita, o `ROADMAP.md` (e `.html`) gerado atualizado. Nunca edita uma
     spec, nem aprova, marca ou apaga nada;
   - **revisão** — o agente `spec-critic` sobre as specs ainda por implementar, a passagem de convergência sobre as
     que estão a meio; cada correção passa na mesma pelos gates normais.

### Usar em conjunto com o superpowers

Várias skills do [superpowers](https://github.com/obra/superpowers) sobrepõem-se a este plugin. No trabalho de
funcionalidades, o dev-spec-driven substitui-as — o superpowers fica com o que ele não cobre (worktrees, agentes em
paralelo, escrita de skills):

| superpowers | dev-spec-driven |
|---|---|
| brainstorming, writing-plans | Fase 0 → requisitos → design → tarefas (`/spec`, `/clarify`, `/grill`) |
| executing-plans, subagent-driven-development | `/executeTask [--subagents]` |
| test-driven-development | o track `+tdd` e o seu micro-ciclo red-green-refactor dentro de cada tarefa |
| systematic-debugging | `/spec-bugfix` |
| verification-before-completion | o gate de evidência (`_Verify:_`, `dev-spec done --run`) |
| requesting / receiving-code-review | `/prReview`, `/spec-review-feedback` |
| finishing-a-development-branch | `/spec-finish` (merge local; sem pull requests, sem CI) |

As próprias instruções do superpowers dizem que o CLAUDE.md tem precedência sobre as skills dele, por isso o
**`/spec-superpowers`** escreve (depois de confirmares) um bloco de precedência com marcadores no `CLAUDE.md` do
projeto ou, com `--user`, no `~/.claude/CLAUDE.md`; `--remove` retira-o. Para desligar o superpowers: num projeto,
`.claude/settings.json` → `"enabledPlugins": { "superpowers@claude-plugins-official": false }`; em todo o lado,
`/plugin disable` — ambos retiram também as skills do superpowers que este plugin não substitui.

### Comandos (55)

`/spec` · `/spec-init` · `/classify` · `/createSpec` · `/clarify` · `/design` · `/testPlan` ·
`/evalPlan` · `/grill` · `/writeTests` · `/createTask` · `/executeTask [--subagents]` · `/spec-doctor` · `/approve` ·
`/next-action` · `/add-track` · `/feature` · `/eval` · `/roadmap` · `/depend` · `/backlog` ·
`/scan` · `/reverse` · `/coverage` · `/spec-status` · `/spec-commit` · `/spec-bugfix` · `/spec-finish` · `/spec-review-feedback` · `/prReview` · `/promptReview` ·
`/migrateModel` — atalhos `/ds` `/dsx` `/dss`.
Novos na 1.13: `/spec-impact` · `/spec-metrics` · `/spec-converge` · `/spec-import` · `/spec-catalog` ·
`/spec-drift` · `/spec-guard` · `/spec-superpowers` · `/spec-upgrade`.
Novos na 1.14: `/spec-templates` · `/spec-export` · `/spec-changelog` · `/spec-ff` · `/spec-decide` · `/spec-spike` ·
`/spec-tour`. Novo na 1.15: `/spec-tracks`.
Novos na 1.16: `/spec-statusline`, `/spec-milestone`. Novo na 1.22: `/spec-simplify`.
(Como plugin, têm namespace, ex.: `/dev-spec-driven:design`; noutros clientes MCP são os prompts do servidor.)

### A CLI `dev-spec`

O mesmo motor em qualquer terminal (`node cli/dev-spec.js <comando>`, ou `dev-spec` no PATH); `--json`
mostra o resultado em bruto e `help` lista todas as opções. Uma instalação como plugin não põe `dev-spec` no PATH, por isso cada mensagem que manda correr a CLI mostra a linha
executável, `node "<clone>/cli/dev-spec.js" …` com o caminho resolvido (ficheiros versionados como o `ROADMAP.md` mantêm `dev-spec`):

```text
classify [--explain] · signals [list|set|forget] · init [--guard on|off|scope] [--stop-check on|off] [--check name=cmd] [--roles …]
  [--evidence reported|observed] [--approval-guard off|ask|deny] · steering · templates
create [--brownfield] [--flow design-first] [--kind spike|change] [--size xs|s|m|l] · bugfix · spike · import [- | --text] · list · status · doctor
trace [--code] [--matrix|--csv] · clarify · ears · next [--batch] [--waves] · next-action · brief · done [--run] · undone
append-tasks [--depends 3,5] · approve [--force [--reason] [--expires]] [--revoke] [--role] [--through] · impact [--reopen] · metrics [--write]
finish [--write] [--run] · decide · add-track [--remove] · feature <remove|archive|rename|restore|flow>
catalog [--write] · export [--md|--csv|--gherkin|--tracker jira|linear] [--write] · changelog [--milestone]
drift · stop-check · log · upgrade [--apply] · roadmap · milestone · depend · backlog · scan · coverage · evals
mcp-config <client> · rules <tool> · prompts · statusline [--print-config] · merge-state [--install|--uninstall|--check]
```

### Porque não há GitHub Actions

De propósito. Todos os gates — validação EARS, rastreabilidade, classificação, estado, tarefas —
correm **localmente** através do servidor MCP e do modelo. Os testes, testes de carga e evals correm
no teu ambiente quando quiseres, não num runner de CI pago.

### Desenvolver / testar

```bash
node mcp/test.js          # testa o servidor MCP de ponta a ponta (tem de terminar em `0 failed`)
node cli/test-cli.js      # testa a CLI universal (tem de terminar em `0 failed`)
npm run test:docker       # as duas suites em contentores Linux (Node 18 / 22 / 24) no teu próprio Docker
```

O runner Docker monta o plugin só de leitura e corre sem rede (só a primeira execução descarrega as imagens); termina
com 0 quando todas as suites passam, 1 numa falha e 2 quando o Docker não está disponível. Os evals do plugin
(`claude plugin eval`, suites de ativação e de comportamento) estão descritos em [evals/README.md](./evals/README.md).

> Substitui quatro skills antecessoras; o conteúdo vive aqui como tracks componíveis (os originais
> ficam no histórico git e na release v1.8.0, se algum dia precisares).
> Licença MIT.

---

## Español

### Una skill, tracks que se combinan

En lugar de elegir entre cuatro skills solapadas, tienes **una** skill que clasifica cada función y
compone exactamente el rigor necesario:

| Track | Añade |
|---|---|
| **core** *(siempre)* | Requisitos EARS → diseño → tareas → ejecución, con gates de aprobación |
| **+tdd** | Plan de pruebas + pruebas-en-rojo-primero + red→green→refactor |
| **+saas** | Rendimiento/escala/multiinquilino/observabilidad/coste + pruebas de carga |
| **+ai** | Desarrollo guiado por evals, prompts como código, economía de tokens, seguridad, ciclo de vida del modelo |
| **+sec** | Modelo de amenazas (STRIDE), requisitos de seguridad, autenticación y autorización, gestión de secretos y claves, pruebas de seguridad |
| **+privacy** | RGPD / GDPR: inventario de datos personales, base de legitimación, conservación y supresión, derechos de los interesados, encargados y transferencias, EIPD |
| **+dist** | Sistemas distribuidos y consistencia de datos: modelo de consistencia, escrituras entre sistemas (escritura dual) → outbox transaccional / inbox / saga, entrega e idempotencia, concurrencia, modos de fallo (CAP / PACELC) |
| **+api** | Contratos de API: el fichero del contrato (OpenAPI / proto / esquema GraphQL), versionado y compatibilidad (qué es incompatible, obsolescencia), errores problem+json con códigos estables, paginación / idempotencia / concurrencia (Idempotency-Key, ETag / If-Match), límites de tasa y cuotas |
| **+ui** | Interfaces: uso del design system, los estados de cada vista (cargando / vacío / error / sin conexión…), accesibilidad (WCAG 2.2 AA), diseño adaptable e i18n, un presupuesto de rendimiento (Core Web Vitals) |
| **+obs** | Observabilidad y operabilidad: SLIs y SLOs con presupuesto de errores y alertas por tasa de consumo, telemetría (métricas, logs estructurados, trazas), alertas y runbooks, despliegue y reversión (feature flags, canario), salud y capacidad |
| **+data** | Pipelines y calidad de datos: contratos de datos y evolución del esquema, comprobaciones de calidad (una fila errónea va a cuarentena, nunca se carga), reejecuciones idempotentes y backfills (datos que llegan tarde), linaje y responsables (SLAs de frescura), retención y coste |

Los tracks **se combinan**. Un webhook de Stripe en un SaaS multiinquilino que además resume
facturas con un LLM es `core +tdd +saas +ai`; un formulario de registro que guarda datos personales es `+privacy` (el
RGPD, el GDPR y la HIPAA apuntan ahí); un endpoint que escribe un usuario en Postgres y publica un evento `UserCreated` en
Kafka es `+dist`. Un cambio de texto es modo Vibe: sin ceremonia. Un
**clasificador de Fase 0** (la herramienta local `spec_classify`, multilingüe) elige los tracks; tú
apruebas. Los tracks elegidos se guardan con la función, y se puede añadir o desactivar un track más
adelante.

**Tamaños (1.21) — el rigor sigue al cambio.** La Fase 0 también sugiere un tamaño (`spec_create {size}`): **xs** es
un *cambio* — un solo `change.md` (resumen, 1–3 criterios EARS, enfoque, tareas con `_Verify:_`) y dos aprobaciones;
**s** es una historia cuyo plan entero se aprueba en una sola llamada (con +tdd / +ai hasta el plan de pruebas / de
evaluación — después llegan las pruebas que fallan y luego las tareas), solo con las secciones core de cada track;
**m / l** mantienen la cadena completa, con las secciones que piden dos tracks escritas una sola vez. EARS, la
trazabilidad, el gate de evidencia y el de cierre valen en todos los tamaños; una sección de diseño solo cuenta como
rellenada con texto propio. Sin tamaño, se mantiene el scaffold anterior.

### El servidor MCP local (`spec-driven`) — 38 herramientas

Solo Node nativo — **sin `npm install`, sin red, sin coste.** Herramientas:

| Herramienta | Qué hace |
|---|---|
| `spec_classify` | Recomienda tracks desde una descripción (heurística multilingüe, ponderada) |
| `spec_init` | Crea `.specs/steering/` para los tracks; `lang` fija el idioma del proyecto, `guard` on · off · scope, `stopCheck` el gate de evidencia al final del turno, `checks` los comandos de comprobación del proyecto, `approvalRoles` quién aprueba cada fase, `evidence` reported · observed (solo verifican las ejecuciones que el harness vio), `approvalGuard` off · ask · deny (la aprobación de un agente te pregunta / se rechaza) |
| `spec_create` | Crea la carpeta de la función para los tracks activos (`kind: "bugfix"` para el flujo de bugfix, `kind: "spike"` para una investigación con plazo, `brownfield: true` añade `integration-plan.md`, `flow: "design-first"` pone el diseño antes de los requisitos) |
| `spec_import` | Importa una spec de Kiro, spec-kit u OpenSpec, un plan de Claude Code / Cursor, un ExecPlan de Codex o documentos BMAD como función nueva (IDs convertidos a `US-N.AC-M`, tareas renumeradas; un plan puede llegar como `text` — el plan mode guarda los planes fuera del proyecto) |
| `spec_templates` | Plantillas del proyecto: lista, copia (`init`) o comprueba (`check`) los scaffolds del equipo en `.specs/templates/`, que sustituyen a los de origen |
| `spec_tracks` | Tracks definidos por el proyecto: lista, crea (`init`) o comprueba (`check`) los track packs del equipo en `.specs/tracks/<nombre>/` — cada uno es un track con marcador como `+sec` (señales, criterios, secciones obligatorias del diseño, tareas, filas de prueba, steering) |
| `spec_list` / `spec_status` | Inspecciona funciones, fases, progreso, secciones completadas vs. presentes; el tipo de cada una (feature / bugfix / spike) y el flujo |
| `spec_next_task` / `spec_complete_task` | Conduce la ejecución y marca tareas — con **evidencia de verificación** registrada (una ejecución fallida rechaza la marca y queda registrada; una tarea `_Expect: fail_` se prueba con una ejecución que falla; cada ejecución lleva el sello `observed`); la siguiente tarea es la primera abierta cuyas `_Depends:_` están hechas; `batch` para tareas paralelas `[P]`, `waves` para las oleadas de ejecución de todas las tareas abiertas; `undo` desmarca una tarea (su evidencia queda obsoleta — volver a marcarla exige una nueva ejecución) |
| `spec_task_brief` | Brief autocontenido de una tarea — ACs y pruebas resueltos al texto de la spec, contexto del diseño, steering con ámbito, definición de terminado (la base de la ejecución con subagentes) |
| `spec_append_tasks` | Convergencia: añade tareas de seguimiento en `Fase: Convergencia` sin renumerar las existentes (`depends` añade `_Depends:_`) |
| `spec_finish` | Cierra una función: bloqueos, avisos, comprobaciones a repetir y un resumen de merge generado desde la cadena de la spec; `evidence` registra las ejecuciones de las comprobaciones del proyecto; `write` registra también la línea base de drift |
| `spec_next_action` | "Estás aquí → haz esto a continuación", fase a fase: revisar → completar → corregir → aprobar (la fase siguiente solo tras esa aprobación) → implementar → verificar → cerrar (después cerrada / deriva) |
| `spec_approve` | Aprueba un gate de fase — rechazado mientras fallen las comprobaciones de esa fase (`force` registra una aprobación forzada y señalada); cada aprobación queda en un historial con snapshot; `role` valida como uno de los roles que `approvalRoles` indica para esa fase (obligatorio ahí), `through` avanza todas las fases hasta esa, cada una por su gate; con `force`, `reason` + `expires` registran una excepción (doctor avisa `waiver-expired`); `revoke` retira una aprobación (sin cascada) |
| `spec_impact` | Qué afecta una edición posterior a la aprobación (ACs, secciones, pruebas planificadas, tareas cambiadas → tareas, pruebas, diseño; `phase` requirements · design · test-plan · eval-plan · tasks); `reopen` desmarca las tareas hechas afectadas (nunca las de un criterio eliminado — `retire` las lista); `phase` steering (sin nombre = todas las funciones activas) lista las aprobaciones hechas con steering que cambió desde entonces |
| `spec_add_track` / `spec_feature` | Añade un track (aditivo; `remove:true` desactiva uno sin borrar archivos) / archiva · restaura · renombra · elimina una función (eliminar exige `confirm:true`), o fija su `flow` |
| `spec_decide` | Añade una decisión (o un descubrimiento) al `decisions.md` de la función — `D-n`, con los ACs, pruebas o secciones del diseño que afecta (comprobados) |
| `ears_validate` | Valida requisitos (SHALL/DEVE/DEBE, IDs estables, palabras vagas, placeholders de la plantilla — EN/PT/ES) |
| `trace_check` | Cada AC cubierto por una tarea (y una prueba en +tdd); referencias fantasma; avisos de EC/NFR/SC; `code:true` busca T-IDs en los archivos de prueba; `matrix:true` añade la matriz de trazabilidad de requisitos |
| `spec_doctor` | Un health-check → "¿listo para avanzar?" (EARS, placeholders, trace, secciones, evidencia, gates, steering) |
| `spec_clarify` | Expone ambigüedades/lagunas de los requisitos antes del diseño (con un glosario: cada palabra que manda evitar) |
| `spec_metrics` | Lead times, retrabajo, aprobaciones forzadas, solicitudes de cambio, tasa de éxito de la evidencia; `write` crea un `retro.md` prerrellenado |
| `spec_catalog` | Catálogo vivo de los ACs de todas las funciones, con los sustituidos señalados (`_Supersedes:_` de una función entregada; el de un borrador queda "por sustituir"), y los posibles criterios duplicados / en conflicto entre funciones activas; `write` → `.specs/SPECS.md` |
| `spec_export` | Un documento autocontenido, offline e imprimible (HTML o markdown) de una función o del proyecto entero, para stakeholders — o la matriz de trazabilidad en CSV (`format: "csv"`), un `.feature` Gherkin por función (`"gherkin"`: un escenario por criterio de aceptación, con las cláusulas EARS como Dado / Cuando / Entonces) o un CSV para el importador de Jira / Linear (`"jira"` · `"linear"`: la función, sus historias, sus tareas); `write` → `.specs/exports/` |
| `spec_changelog` | Notas de la versión desde las specs — Added / Changed / Fixed desde una fecha o desde las últimas notas; `milestone` las limita a las funciones de un hito; `write` → `.specs/RELEASE-NOTES.md` |
| `spec_drift` | Archivos de implementación cambiados, ausentes o nuevos desde que `spec_finish` registró la línea base |
| `spec_stop_check` | El gate de evidencia del final del turno para clientes solo MCP: ¿este mensaje final ("hecho", "verificado") se devolvería — tareas marcadas sin evidencia, comprobaciones del proyecto sin una ejecución correcta? |
| `spec_log` | Los commits que citan cada tarea (+ la comprobación red-first de +tdd) a partir del texto de `git log` que pasa el cliente — el servidor nunca ejecuta git |
| `spec_upgrade` | Tras actualizar el plugin: audita cada función activa frente a las reglas actuales (estado, lo que señala el doctor, siguiente paso, una revisión critic / converge); `apply` guarda los tracks deducidos, da a las aprobaciones anteriores a la 1.13 una línea base en el historial, sella `meta.specVersion` y escribe `.specs/UPGRADE.md` — nunca edita una spec |
| `spec_roadmap` / `spec_depend` | Hoja de ruta + dependencias (detecta ciclos; `add` / `remove` editan la lista), una ETA por función a partir de la velocidad de las tareas marcadas y los archivos que las tareas abiertas de dos funciones planifican a la vez; `write:true` → `.specs/ROADMAP.md` (+ `html:true` para el `.html` con la marca, offline, claro/oscuro; `lang`) |
| `spec_milestone` | Hitos: una fecha objetivo para un conjunto de funciones (`add` · `rm` · `list`), evaluada frente a sus ETAs — `on-track` · `at-risk` · `late` · `done` (ROADMAP.md los muestra; renombrar / archivar / eliminar una función se refleja en ellos) |
| `spec_backlog` | Registra funciones planificadas pero aún sin spec (aparecen en ROADMAP.md) |
| `spec_scan` / `spec_coverage` | Brownfield: inventario de código existente (rutas, pruebas, puntos de entrada, nombres de variables de entorno, migraciones) + la parte de los archivos de código nombrados en `_Implements:_` |
| `steering_scaffold` | Crea un archivo de steering desde la plantilla (incl. `constitution.md`, `glossary.md`), o uno personalizado con ámbito |

**Prompts y recursos.** El servidor sirve también un **prompt** MCP por cada comando del plugin — `/spec`,
`/spec-status`, `/spec-impact`, … pasan a ser comandos de barra en los clientes MCP que muestran prompts (VS Code /
Copilot Chat, por ejemplo) — y las specs del proyecto como **recursos** de solo lectura: `specs://roadmap`, `specs://catalog`,
`specs://steering/{file}`, `specs://feature/{slug}/{artifact}`. El plugin de Claude Code desactiva los prompts
(`SPEC_MCP_PROMPTS=off` en `mcp/servers.json`), porque allí los comandos ya son comandos de barra.

### Ejecución con subagentes (opcional)

`/executeTask <feature> --subagents` reserva el contexto de la sesión principal para la coordinación: por
tarea escribe un brief (`spec_task_brief`), despacha el agente **`dev-spec-driven:spec-implementer`** del
plugin, envía el diff al agente **`dev-spec-driven:spec-reviewer`** (veredicto por AC ID + calidad +
comprobaciones del track + las reglas escritas del proyecto), hace que un revisor independiente verifique cada
hallazgo (solo una confianza de 80 o más cuesta una ronda de correcciones), hace un ciclo de correcciones de como
máximo 5 rondas y solo entonces marca la tarea. Avanza solo dentro de una historia, se detiene en cada `**Checkpoint:**` para tu revisión y nunca
cambia un AC, el diseño o una prueba sin volver a esa fase. Usa unas 2–3× los tokens de la ejecución inline,
así que compensa en funciones con ~6+ tareas independientes. Protocolo:
`skills/dev-spec-driven/references/subagent-execution.md`. Adaptado de la skill `subagent-driven-development` de
[obra/superpowers](https://github.com/obra/superpowers) (MIT).

### Gates y evidencia

- **Una aprobación es un gate, no un sello.** `spec_approve` ejecuta primero las comprobaciones de la fase
  (errores EARS, placeholders de la plantilla, `[NEEDS CLARIFICATION]` sin resolver, secciones ausentes, ACs
  sin cobertura, …; la Fase 4 `tests`: cada T-ID planeado en un archivo de prueba / un conjunto de evals propio;
  `execution`: los bloqueos de `spec_finish`) y la rechaza mientras alguna falle. `force: true` (CLI `--force`) la registra igualmente
  como aprobación **forzada**, con las comprobaciones que fallaron, y el `doctor` y la hoja de ruta siguen
  señalándola.
- **Una plantilla no es contenido.** El `doctor` tiene la comprobación `placeholders` (falla en la fase
  actual y en las anteriores), una función nueva empieza en su primera fase (`requirements`; `design` en el flujo design-first) y `ears_validate` informa
  del código `placeholder`. Un corchete solo cuenta cuando su texto es uno de los que escriben las plantillas (o TODO /
  TBD / FIXME / `…`): valores reales como `[free: 60, pro: 600]` o `[admin, billing-manager]` son tu contenido.
- **`next_action` avanza fase a fase:** revisar → en la primera fase aún sin aprobar, completar → corregir → aprobar
  (la fase siguiente solo tras esa aprobación — en el flujo por defecto nunca pide el diseño antes de que los requisitos estén aprobados, y
  `approve` rechaza una fase mientras una anterior siga sin aprobar) → implementar → verificar → cerrar. Nunca
  recomienda una aprobación que el gate rechazaría; en su lugar, dice en qué falla — ni `spec_finish` mientras haya
  una tarea marcada sin verificar (el paso `verify` la nombra con su `dev-spec done <f> <n> --run`). En +tdd / +ai, la Fase 4
  (pruebas en rojo / harness de evals, `approve <f> tests`) es un gate que pide antes de implementar ninguna tarea.
- **Evidencia antes que afirmaciones.** Las tareas declaran `_Verify: <comando>_`; `spec_complete_task`
  registra el comando, el código de salida y un resumen. Una tarea con un `_Verify:_` ejecutable solo queda
  verificada con una ejecución registrada: una que pase — o, en una tarea marcada `_Expect: fail_` (una prueba en
  rojo, como la tarea 3 de un bugfix), una que falle (una que pase se rechaza: `unexpected-pass`); cualquier otro
  fallo rechaza la marca. **¿No puedes ejecutar el comando?** No marques la tarea — ni sin nada, ni con una nota:
  indica el comando y pide su salida (o `dev-spec done <feature> <n> --run`); una marca solo con nota queda sin
  verificar y es para cuando el usuario la pide explícitamente. Las ejecuciones fallidas quedan en un historial
  corto, y una tarea reabierta tras un cambio en la spec tiene evidencia **obsoleta** hasta volver a ejecutarse.
  `spec_complete_task` devuelve un código de motivo estable (`unverifiedReason`: `failed-run`,
  `manual-note-on-runnable-verify`, `duplicate-number`, `stale-evidence`, `unexpected-pass`, `no-evidence`,
  `unobserved` — con `meta.evidence: "observed"`, una ejecución que el harness nunca vio —, `command-mismatch` — la
  ejecución registrada no es una ejecución del comando `_Verify:_` de la tarea); el `doctor`,
  `spec_finish` y la línea "Necesita atención" del `ROADMAP.md` listan cada tarea sin verificar con su
  motivo. CLI: `dev-spec done <feature> <n> --run`.
- **`/spec-bugfix`** — una spec ligera para un defecto: reproducir → **causa raíz con evidencia** → prueba de
  regresión en rojo → corrección → verificación. El `doctor` falla hasta que la causa raíz esté escrita, y
  las tareas posteriores a la de la causa raíz no se pueden completar antes. Lo que ya sabes entra con el
  scaffold (`spec_create {kind: "bugfix", reproduction, rootCause, condition, behaviour, includeBody}` /
  `--reproduction`, `--root-cause`, `--condition`, `--behaviour`) — sin releer y reescribir los cuatro archivos.
- **`/spec-finish`** — bloquea con fallos del doctor, un artefacto cambiado tras su aprobación, placeholders en
  cualquier punto de la cadena, tareas abiertas o sin verificar y gates pendientes; lista las comprobaciones a
  repetir y construye un resumen de merge desde la spec. Después haces el merge en local o conservas la rama —
  sin pull requests, sin CI.
- **`/spec-review-feedback`** — comentarios de revisión evaluados contra la spec. **`/spec-doctor --deep`** —
  el agente `spec-critic` revisa el *significado* de la spec en su gate.
- **Modo bounded** entre Vibe y Spec (diseño corto en el chat + un sí explícito), **Restricciones Globales**
  incluidas en cada brief de tarea, **tareas `[P]` en paralelo** en worktrees separados y **evals del plugin**
  (`evals/`, `claude plugin eval`) que comprueban que la skill se activa en EN/PT/ES — y, en la suite de
  comportamiento, que el agente respeta después el flujo (planifica primero, registra evidencia, nunca fuerza un
  gate). Ideas adaptadas de [obra/superpowers](https://github.com/obra/superpowers) (MIT).

### Gestión de cambios

- **Historial de aprobaciones.** Cada aprobación se añade al `.state.json` (`approvalHistory`) y guarda un
  snapshot de lo aprobado en `.specs/<feature>/.history/<fase>@<n>.md` — haz commit de él con la spec.
- **`/spec-impact`** (`spec_impact`) — cuando cambia un artefacto aprobado, compara la edición con ese
  snapshot: ACs (e IDs SC/EC/NFR), secciones del diseño o del eval-plan, pruebas planificadas (T-IDs) o tareas añadidos, modificados o eliminados y, para
  cada uno, las tareas que lo citan (hechas o abiertas, con su evidencia), las pruebas que lo cubren y las
  secciones del diseño que lo mencionan. `reopen` desmarca las tareas hechas afectadas, marca su evidencia
  como obsoleta y registra la solicitud de cambio — nunca las tareas de un criterio eliminado: `retire` las
  lista (con sus filas de prueba) para eliminarlas o apuntarlas al criterio que lo sustituye. Nunca edita tus
  requisitos ni el diseño.
- **`/spec-converge`** (`spec_append_tasks`) — cuando la implementación se ha desviado del plan o una revisión
  ha encontrado trabajo de seguimiento, añade tareas nuevas (numeradas tras la última, en
  `Fase: Convergencia`) con `_Requirements:_`, `_Implements:_` y `_Verify:_` (y `_Makes green:_`, `_Expect: fail_`,
  `_Size:_` cuando se indican). Los IDs de AC desconocidos — o los T-IDs que el plan de pruebas no prevé — se
  rechazan, las tareas existentes nunca cambian y una lista de tareas ya aprobada pide una nueva aprobación.

### Catálogo vivo, drift y restauración

- **`/spec-catalog`** (`spec_catalog`) — "lo que el sistema hace hoy": todas las funciones (activas,
  terminadas, archivadas) con cada AC en una línea EARS. Un criterio sustituido por una función posterior se
  declara con `_Supersedes: <feature>/US-n.AC-m_` y el antiguo aparece como sustituido. `write` genera
  `.specs/SPECS.md` (nunca encima de un archivo escrito a mano), que se actualiza con la hoja de ruta desde
  entonces.
- **`/spec-drift`** (`spec_drift`) — `spec_finish` con `write` en una función lista registra un hash de cada
  archivo nombrado en sus marcadores `_Implements:_`; el drift informa de los archivos cambiados, ausentes o
  nuevos desde entonces. El hook de SessionStart añade una línea por cada función activa con drift.
- **Restauración** — `spec_feature archive` registra las dependencias que elimina, y `restore` devuelve la
  función con su entrada en la hoja de ruta y esas dependencias.

### Modo guardia y steering con ámbito

- **`/spec-guard`** — modo guardia opcional (`spec_init {guard}` / `dev-spec init --guard on|off|scope`).
  Mientras está activo, un hook PreToolUse de Claude Code **pregunta antes** de un Write/Edit en un archivo de
  código fuera de `.specs/` cuando ninguna función tiene tareas aprobadas sin terminar — salvo un archivo de prueba
  mientras el plan de pruebas de una función está aprobado (la Fase 4 escribe primero las pruebas que fallan) y cualquier
  código mientras existe un spike activo (su prototipo); `scope` pregunta también, una
  vez aprobadas las tareas, por un archivo de código que ninguna tarea abierta nombra en `_Implements:_` (los archivos
  de prueba quedan fuera) y dice cuál es la tarea probable. No dice nada cuando
  está desactivado y nunca bloquea por sus propios errores. Las demás herramientas no ejecutan hooks de
  Claude Code, así que allí el modo guardia no hace nada.
- **Steering con ámbito** — los archivos de steering aceptan front matter compatible con Kiro:
  `inclusion: always`, `fileMatch` (con `fileMatchPattern: "src/api/**"`) o `manual`. `steering_scaffold`
  crea archivos personalizados como `api-conventions.md`, y cada brief de tarea incluye los archivos cuyo
  patrón coincide con las rutas `_Implements:_` de la tarea.
- **Equipos: git combina el estado de la spec** — `dev-spec merge-state --install` (una vez por clon, y de nuevo tras una actualización del plugin — `--check` lo dice; haz commit del
  `.gitattributes` que escribe) hace que git combine `.state.json` / `roadmap.json` por su significado: las aprobaciones,
  tareas terminadas y evidencia de dos ramas se unen en vez de entrar en conflicto; un conflicto real queda en JSON válido
  (`mergeConflicts`) y doctor falla hasta resolverlo.
- **Aprobaciones en otros clientes MCP** — con `approvalGuard` ask / deny, un cliente que soporte elicitation de MCP
  pregunta al usuario antes de que `spec_approve` registre nada (solo cuenta una aprobación explícita); sin ella, `deny`
  se rechaza.

### Brownfield, importación y métricas

- **Análisis más profundo** — `spec_scan` lista rutas HTTP con método, ruta y `archivo:línea` (Express,
  NestJS, Next.js, FastAPI, Flask, Django, Spring, ASP.NET, Rails, Laravel, Go …), frameworks de pruebas,
  puntos de entrada, **nombres** de variables de entorno (nunca los valores) y archivos de migración.
  `spec_coverage` mide la parte de los archivos de código nombrados en algún marcador `_Implements:_`, por
  carpeta. `create --brownfield` añade un `integration-plan.md`.
- **`/spec-import`** (`spec_import`) — trae una spec de Kiro (`.kiro/specs/<name>/`), spec-kit
  (`specs/<nnn-name>/`) u OpenSpec (`openspec/specs/<capability>/` o una carpeta de change) como función
  nueva: los criterios pasan a líneas EARS `US-N.AC-M` (o conservan su texto con `[NEEDS CLARIFICATION]`) y
  las tareas se renumeran con el estado de sus casillas. También planes: `plan` (un archivo del plan mode de Claude
  Code copiado al proyecto, o un `.cursor/plans/*.plan.md` de Cursor), `execplan` (un ExecPlan de Codex) y `bmad` (PRD
  e historias de BMAD-METHOD) — y `fluidplan` (un plan decidido con la skill fluidplan: `.fluidplan/<id>/` o su
  `PLAN.md` / `DECISIONS.md` → historias, criterios, tareas con `_Verify:_` / `_Depends:_` y un `decisions.md` con las
  decisiones tomadas). El origen debe estar dentro del proyecto y solo se lee.
- **Trazabilidad más profunda** — `trace_check` avisa de casos límite (EC-n), NFRs y criterios de éxito
  (SC-nnn) sin cobertura; `--code` busca T-IDs en los nombres de las pruebas (`test("T-01 …")`,
  `def test_T01_…`). Los planes de pruebas tienen una columna **Tipo** (Kind: `example` | `property`) con
  orientación para pruebas basadas en propiedades.
- **`/spec-metrics`** (`spec_metrics`) — lead time por fase, retrabajo, aprobaciones forzadas, solicitudes de
  cambio y tasa de éxito de la evidencia, por función o para el proyecto; `write` crea un `retro.md`
  prerrellenado.

### Novedades de la 1.22

- **Revisiones en las que confiar** — el revisor da a cada hallazgo Critical / Important una confianza de 0 a 100 y sabe lo
  que no es un hallazgo (lo que ya existía, lo que queda fuera del diff, lo que pidió la spec, lo que una verificación en
  verde ya responde); cada uno lo verifica un revisor independiente antes de que pueda costar una ronda de correcciones —
  solo una confianza de 80 o más la abre, el resto queda en el ledger como no confirmado. `/prReview` verifica antes de
  informar. Dos ángulos nuevos: las reglas escritas del proyecto (la constitución, `CLAUDE.md` / `AGENTS.md`, los
  comentarios del código — citados) y el historial de las líneas que un cambio reescribe (una corrección deshecha, la causa
  raíz de un bugfix que vuelve).
- **`/spec-simplify`** — una pasada opcional antes de `/spec-finish`: limpiezas que no cambian el comportamiento del
  código que añadió la función — primero los smells que las revisiones aplazaron —, un commit cada una, sus pruebas tras
  cada cambio y las verificaciones del proyecto al final; nunca una prueba, un contrato ni código que la función no
  escribió; la pasada se revisa y un hallazgo confirmado se revierte. Con `--subagents` la hace un nuevo agente,
  `spec-simplifier`, y el gate SubagentStop devuelve su DONE mientras la sección `## Final runs` de su informe no muestre
  todas las ejecuciones en verde. Las dos ideas vienen de los plugins `code-review` y `code-simplifier` de Anthropic,
  reconstruidas en torno a la spec y el gate de evidencia.
- **Una revisión completa, corregida** — una ejecución solo prueba una tarea cuando ES su `_Verify:_` (si no,
  `command-mismatch`); el gate de parada, la guardia de aprobaciones (`cmd /c`, `pwsh -Command` sin comillas…) y el gate
  de pruebas de la Fase 4 cierran sus huecos; los criterios con `AC-n` sin historia se señalan; el scan respeta el
  `.gitignore` y los monorepos; los ficheros UTF-16 se leen. Y más rápido: el spec-hook ~173 → ~68 ms por edición, el hook
  Stop ~235 → ~88 ms, marcar una tarea ~185 → ~65 ms, el avance rápido ~1,2 → ~0,4 s. El CHANGELOG lista cada corrección.

### Novedades de la 1.21

- **Rigor a la medida del cambio** — la Fase 0 sugiere un tamaño: **xs** es un *cambio* (un `change.md`, dos
  aprobaciones), **s** una historia cuyo plan se aprueba en una sola llamada, solo con las secciones esenciales de cada track,
  **m / l** la cadena completa, con las secciones que piden dos tracks escritas una vez. Una sección de track solo cuenta como
  rellenada con texto propio. Sin tamaño = como antes.
- **Equipos** — `dev-spec merge-state --install` deja que git fusione el estado de la spec (aprobaciones, tareas, evidencia)
  de dos ramas; los clientes MCP con elicitation preguntan a su usuario antes de registrar una aprobación.
- **Un clasificador que aprende** — una negación alcanza toda una lista ("sin pagos ni suscripciones") y sus correcciones de
  la Fase 0 se vuelven ajustes del proyecto (`.specs/classifier.json`, `dev-spec signals`, `classify --explain`).
- **+data** — contratos de datos y evolución del esquema, calidad de los datos, reprocesos idempotentes y backfills, linaje y
  responsables, retención y coste; y un track pack de ejemplo `+mobile` en `examples/track-packs/mobile`.

### Novedades de la 1.20

- **Más fácil de mantener, más rápido al arrancar** — las notas de mantenimiento, las suites de pruebas (`--only`, `--list`,
  en paralelo) y el motor de los tracks pasan a archivos más pequeños, y el corpus de placeholders se genera de antemano
  (SessionStart ~37% más rápido); un motor opcional en un solo archivo (`dev-spec bundle`, `DEV_SPEC_BUNDLE=1`) para un
  sistema de archivos lento. Sin cambio de comportamiento.

### Novedades de la 1.19

- **Reutilizar antes de escribir** — todo diseño dice qué reutiliza, extiende o añade y dónde vive (una sección Reuse &
  Integration); el brief de cada tarea lista las entradas del diseño y los archivos existentes junto a los de la tarea; el
  implementador busca antes de escribir e informa de lo que reutilizó; el revisor comprueba la duplicación contra todo el
  código; los candidatos a refactorización van al backlog.
- **Tres tracks más** — `+api` (contratos, versionado, errores, paginación / idempotencia / concurrencia, límites de
  peticiones), `+ui` (design system, estados de la interfaz, accesibilidad WCAG 2.2, responsividad e i18n, un presupuesto
  de rendimiento) y `+obs` (SLOs, telemetría, alertas y runbooks, rollout y rollback, salud y capacidad), cada uno con una
  guía en `references/`.

### Novedades de la 1.18

- **El motor en módulos** — `mcp/lib/spec.js` pasa a ser una fachada sobre `mcp/lib/engine/` (20 módulos por concepto y un
  importador por herramienta de origen), `i18n.js` sobre un archivo por idioma; un refactor puro, con comportamiento
  demostradamente idéntico.

### Novedades de la 1.17

- **+dist — sistemas distribuidos y consistencia de datos** — un séptimo track que se activa con colas, eventos publicados
  en un broker, sagas, microservicios… ("un endpoint que guarda un usuario en Postgres y publica un evento en Kafka"). El
  diseño tiene que responder al modelo de consistencia (qué es atómico, ACID y aislamiento, fuerte vs eventual), a cada
  escritura doble y su mitigación (outbox transaccional, inbox, saga, CDC), a la entrega e idempotencia (duplicados,
  reintentos con backoff, DLQ), a la concurrencia (bloqueo optimista vs pesimista) y a los modos de fallo — con criterios,
  tareas y pruebas de inyección de fallos a juego, y una guía: `skills/dev-spec-driven/references/distributed-data-patterns.md`.
- **Todo diseño sopesa sus decisiones** — secciones Alternatives & Trade-offs (opciones, pros, contras, el coste de
  equivocarse) y Risks en todos los diseños; `/grill` pregunta por atomicidad, ACID, condiciones de carrera, el modelo de
  consistencia y un resultado de negocio medible; el ciclo +tdd hace el microciclo rojo → verde → refactor dentro de cada
  tarea.
- **`import fluidplan`** — un plan decidido con la skill fluidplan se convierte en spec: historias, criterios, tareas con
  sus comprobaciones y dependencias, y las decisiones tomadas en `decisions.md`.

### Novedades de la 1.16

- **Deshacer y revocar** — `dev-spec undone <función> <n>` reabre una tarea marcada (su evidencia queda obsoleta, así
  que volver a marcarla exige una nueva ejecución); `approve <función> <fase> --revoke` retira una aprobación (queda en
  el historial, sin cascada). `--force --reason "…" --expires 30d` registra por qué se forzó un gate y hasta cuándo — el
  doctor avisa cuando vence.
- **En Claude Code** — `/spec-statusline` pone la función activa, sus tareas y el paso siguiente en la barra de estado;
  las herramientas MCP llevan anotaciones (solo lectura / destructiva) y los argumentos de los prompts completan nombres
  de funciones; un plan aprobado en plan mode se puede importar en línea (`import plan -`). Tus valores por defecto para
  todos los proyectos — `DEV_SPEC_DEFAULT_LANG`, `DEV_SPEC_STOP_CHECK`, `DEV_SPEC_GUARD_DEFAULT` — van en el bloque
  `env` del `settings.json` de Claude Code.
- **Calidad de las specs** — las aprobaciones recuerdan el steering con el que se hicieron (el doctor avisa cuando la
  constitución o la norma de un track cambió desde entonces; `impact --phase steering` lista a quién afecta); el doctor
  y el catálogo señalan criterios que duplican o contradicen los de otra función; un glosario
  (`.specs/steering/glossary.md`, palabras `_Avoid:_`) hace que clarify pregunte por las palabras a evitar.
- **Exportaciones y planificación** — `export --gherkin` escribe un `.feature` por función (EARS → Dado / Cuando /
  Entonces, dialectos PT / ES); `export --tracker jira|linear` un CSV para el importador del tracker; `/spec-milestone`
  fija fechas objetivo para conjuntos de funciones, evaluadas frente a las previsiones (on-track · at-risk · late ·
  done) en ROADMAP.md.

### Novedades de la 1.15

- **Tracks definidos por el proyecto** (`/spec-tracks`) — además de los seis tracks de serie, un equipo define los
  suyos (+a11y, +mobile, +dbmigration…) como una carpeta: `.specs/tracks/<nombre>/track.json` (nombre, un marcador que
  distingue mayúsculas como `A11Y`, un título, señales para el clasificador, las secciones obligatorias del diseño, un
  archivo de steering opcional) más fragmentos markdown opcionales — criterios, tareas, filas de prueba, elementos de
  checklist, el stub de steering (una subcarpeta `<lang>/` tiene prioridad). Un pack válido es un track con marcador en
  todas partes: `spec_classify` lo elige por sus señales, `spec_create` / `add-track` crean sus criterios `#### [A11Y]`,
  las secciones `## [A11Y]` del diseño, las tareas y las filas de prueba, y doctor / la aprobación del diseño se niegan
  hasta que las secciones estén rellenadas. Son solo datos (nada se ejecuta; los enlaces fuera de `.specs/` se ignoran);
  un pack no válido lo informa `check` y se ignora. Guía: `skills/dev-spec-driven/references/project-tracks.md`.
  Un ejemplo para empezar: `examples/track-packs/mobile` (+mobile — sin conexión y sincronización, versiones y despliegue en
  las tiendas, permisos, rendimiento y batería, notificaciones push; EN / PT / ES) — cópielo en `.specs/tracks/mobile/` y ejecute `dev-spec tracks check`.

### Novedades de la 1.14

- **Seis tracks** — `+sec` y `+privacy` se combinan con los demás: criterios `[SEC]` / `[PRIVACY]`, secciones
  obligatorias del diseño, tareas, filas de prueba y steering (`security.md`, `privacy.md`). Los marcadores de los
  tracks distinguen mayúsculas de minúsculas.
- **Plantillas del proyecto** (`/spec-templates`) — `.specs/templates/<artefacto>.md` (o `<lang>/<artefacto>.md`;
  pt-BR recurre a `pt/` si no tiene el suyo) sustituye un scaffold de origen, con `{{name}}` `{{slug}}` `{{summary}}`
  `{{tracks}}` `{{lang}}` `{{date}}` rellenados; los tracks activos siguen recibiendo sus secciones, y un scaffold
  personalizado sin tocar sigue leyéndose como plantilla en los gates. `check` las valida.
- **Para stakeholders** — `/spec-export` escribe un documento HTML (o markdown) offline e imprimible de una función o
  del proyecto; `/spec-changelog` construye notas de la versión (Added / Changed / Fixed) a partir de lo entregado.
- **Gobernanza del equipo** — `init --roles requirements=product,design=tech+security`: una fase de la lista queda
  aprobada cuando todos los roles han aprobado su contenido actual (`approve --role`). `/spec-ff`
  (`approve --through tasks`) avanza las fases completadas en orden, cada una por su gate, y se detiene en el primer
  rechazo.
- **Previsiones** — las tareas pueden llevar `_Size: XS|S|M|L|XL_`; la hoja de ruta muestra una ETA por función a
  partir de la velocidad de las tareas marcadas (últimos 28 días, días laborables, ±25%) y señala funciones cuyas
  tareas abiertas planifican los mismos archivos.
- **Evidencia más fuerte** — `_Expect: fail_` marca una tarea de prueba primero cuya ejecución debe fallar (red →
  green); `init --check test="npm test"` da nombre a las comprobaciones del proyecto, y `finish` exige entonces una
  ejecución correcta de cada una (`finish --run`); `done --run` registra el commit de git; `dev-spec log` lista los
  commits que citan cada tarea; un `_Verify:_` con pipe (`npm test | tee log`) se señala — el código de salida de un
  pipeline es el de su último comando.
- **Evidencia al final del turno** — en Claude Code, un hook Stop devuelve el turno cuando el mensaje final afirma
  "hecho" o "verificado" mientras una función activa en las últimas horas tiene tareas marcadas sin la evidencia de
  una ejecución correcta (`init --stop-check off` lo desactiva; en otras herramientas: `dev-spec stop-check`).
- **Evidencia que el harness vio** — en Claude Code, un hook registra cada ejecución Bash de un comando `_Verify:_` o de
  una comprobación del proyecto, y cada ejecución que un agente reporta lleva el sello `observed: true | false`
  (`"cli"` para `done --run` / `finish --run`). Con `init --evidence observed` (opcional), solo esas ejecuciones
  verifican una tarea (motivo `unobserved` si no); el modo por defecto, `reported`, mantiene la regla de hoy. No es una
  frontera de seguridad; un cliente solo MCP no tiene hook — usa `done --run`.
- **Guardia humana de las aprobaciones** — `init --approval-guard ask|deny` (desactivada por defecto): el
  `spec_approve` de un agente, la eliminación de una función, un `dev-spec approve` ejecutado por su shell, o bajar la
  guardia, te pregunta primero (`ask` — los modos auto / bypass de Claude Code pueden saltarse la pregunta) o se rechaza
  en cualquier modo (`deny` — ejecutas tú el comando indicado en tu terminal o con el prefijo `!` de Claude Code). Una
  barrera en los caminos de aprobación, no una sandbox.
- **Dependencias entre tareas y oleadas** — una tarea puede llevar `_Depends: 3, 5_`: la siguiente tarea pasa a ser la
  primera abierta cuyas dependencias están hechas, `dev-spec next <f> --waves` (`spec_next_task {waves}`) agrupa las
  tareas abiertas en oleadas que pueden ejecutarse a la vez (sin archivos `_Implements:_` compartidos), y el doctor falla
  `task-deps` ante un ciclo o un número desconocido. Un tasks.md sin `_Depends:_` se comporta como antes.
- **Matriz de trazabilidad** — `dev-spec trace <f> --matrix` (`trace_check {matrix}`): una fila por AC / EC / NFR / SC
  con su estado (`verified` · `implemented` · `planned` · `untraced`), las tareas y su evidencia, pruebas, secciones del
  diseño, decisiones y si cambió desde la aprobación; `--csv` / `export <f> --csv --write` →
  `.specs/exports/<f>.rtm.csv` (a prueba de fórmulas, se abre en Excel) para auditorías.
- **Decisiones y spikes** — `/spec-decide` añade entradas `D-n` a `decisions.md` (lo que afectan se comprueba; los
  briefs, el resumen de merge y la exportación las muestran). `/spec-spike` hace una investigación con plazo que
  termina en una decisión — go / no-go / pivot — en lugar de requisitos inventados.
- **Flujo design-first** — `create --flow design-first` (o `feature flow`) recorre clasificación → diseño →
  requisitos → … para trabajo que parte de una arquitectura.
- **`/spec-tour`** — una visita guiada de 10 minutos en tu propio repositorio: un cambio real y pequeño por todos
  los gates.
- **Portugués de Brasil** — `lang: "pt-BR"` (`--lang pt-BR`) genera los artefactos y los mensajes en PT-BR, un locale
  derivado del portugués europeo; también nuevo: prompts MCP y recursos `specs://` (arriba), importación de planes /
  ExecPlans / BMAD y un runner de pruebas en Linux para quien mantiene el plugin.

### Automatización local, no CI

- **Hooks** (`hooks/hooks.json`): al guardar `requirements.md` → valida EARS + placeholders; al guardar
  `tasks.md` → comprueba la trazabilidad; al guardar `design.md` → las secciones obligatorias de los tracks
  activos; al iniciar la sesión → estado de las funciones + drift + funciones que se solapan; al final de un turno
  (y de un subagente `spec-implementer` o `spec-simplifier`) → el gate de evidencia; tras cada ejecución Bash → el registro de la
  evidencia observada (silencioso). El modo guardia opcional se ejecuta antes de las ediciones de código, la guardia
  opcional de las aprobaciones antes de la aprobación de un agente. Más un validador `pre-commit` opcional de git.
- **Harness de evals** (`mcp/evals/run-evals.js`): ejecuta los conjuntos
  golden/adversarial/regression con **tu propia `ANTHROPIC_API_KEY`**; `--dry-run` valida sin
  conexión, `--set-baseline` registra una baseline.

### Inicio rápido

Instala desde GitHub (recomendado — funciona en cualquier máquina, sin rutas que editar):

```text
/plugin marketplace add linofcp007/dev-spec-driven
/plugin install dev-spec-driven@dev-spec-driven-marketplace
```

O clona y cárgalo solo para una sesión:

```bash
git clone https://github.com/linofcp007/dev-spec-driven.git
claude --plugin-dir ./dev-spec-driven
```

Luego describe una función (la skill se activa en tu idioma) o condúcela explícitamente:

```
/dev-spec-driven:spec  Añadir claves de API por inquilino con rotación y uso medido por Stripe
```

### Actualizar a una nueva versión

1. **Actualiza el plugin** — desde el marketplace: `/plugin marketplace update dev-spec-driven-marketplace` y después
   reinicia Claude Code; un clon: `git pull` y después reinicia la sesión.
2. **Ejecuta `/spec-upgrade`** en cada proyecto que ya tenga un `.specs/` (el hook de inicio de sesión te lo recuerda
   mientras venga de una versión anterior; en otras herramientas: `dev-spec upgrade`):
   - **auditoría** (solo lectura) — cada función activa agrupada en bloqueada · necesita atención · ok, con su estado,
     lo que señalan las reglas actuales, el siguiente paso y la revisión a ejecutar;
   - **apply** (tras tu OK; `dev-spec upgrade --apply`) — las migraciones seguras: tracks deducidos guardados, una
     línea base en el historial para cada aprobación anterior a la 1.13 cuyo fichero aún coincide, `meta.specVersion`
     sellado, la lista de comprobación `.specs/UPGRADE.md` escrita, el `ROADMAP.md` (y `.html`) generado actualizado.
     Nunca edita una spec, ni aprueba, marca o borra nada;
   - **revisión** — el agente `spec-critic` sobre las specs aún sin implementar, la pasada de convergencia sobre las
     que están a medias; cada corrección sigue pasando por los gates normales.

### Usarlo junto a superpowers

Varias skills de [superpowers](https://github.com/obra/superpowers) se solapan con este plugin. En el trabajo de
funciones, dev-spec-driven las sustituye — superpowers se queda con lo que no cubre (worktrees, agentes en paralelo,
escritura de skills):

| superpowers | dev-spec-driven |
|---|---|
| brainstorming, writing-plans | Fase 0 → requisitos → diseño → tareas (`/spec`, `/clarify`, `/grill`) |
| executing-plans, subagent-driven-development | `/executeTask [--subagents]` |
| test-driven-development | el track `+tdd` y su microciclo red-green-refactor dentro de cada tarea |
| systematic-debugging | `/spec-bugfix` |
| verification-before-completion | el gate de evidencia (`_Verify:_`, `dev-spec done --run`) |
| requesting / receiving-code-review | `/prReview`, `/spec-review-feedback` |
| finishing-a-development-branch | `/spec-finish` (merge local; sin pull requests, sin CI) |

Las propias instrucciones de superpowers dicen que CLAUDE.md tiene prioridad sobre sus skills, así que
**`/spec-superpowers`** escribe (tras tu confirmación) un bloque de precedencia con marcadores en el `CLAUDE.md` del
proyecto o, con `--user`, en `~/.claude/CLAUDE.md`; `--remove` lo quita. Para desactivar superpowers: en un
proyecto, `.claude/settings.json` → `"enabledPlugins": { "superpowers@claude-plugins-official": false }`; en
todas partes, `/plugin disable` — ambos quitan también las skills de superpowers que este plugin no sustituye.

### Comandos (55)

`/spec` · `/spec-init` · `/classify` · `/createSpec` · `/clarify` · `/design` · `/testPlan` ·
`/evalPlan` · `/grill` · `/writeTests` · `/createTask` · `/executeTask [--subagents]` · `/spec-doctor` · `/approve` ·
`/next-action` · `/add-track` · `/feature` · `/eval` · `/roadmap` · `/depend` · `/backlog` ·
`/scan` · `/reverse` · `/coverage` · `/spec-status` · `/spec-commit` · `/spec-bugfix` · `/spec-finish` · `/spec-review-feedback` · `/prReview` · `/promptReview` ·
`/migrateModel` — atajos `/ds` `/dsx` `/dss`.
Nuevos en la 1.13: `/spec-impact` · `/spec-metrics` · `/spec-converge` · `/spec-import` · `/spec-catalog` ·
`/spec-drift` · `/spec-guard` · `/spec-superpowers` · `/spec-upgrade`.
Nuevos en la 1.14: `/spec-templates` · `/spec-export` · `/spec-changelog` · `/spec-ff` · `/spec-decide` · `/spec-spike` ·
`/spec-tour`. Nuevo en la 1.15: `/spec-tracks`.
Nuevos en la 1.16: `/spec-statusline`, `/spec-milestone`. Nuevo en la 1.22: `/spec-simplify`.
(Como plugin, tienen namespace, p. ej. `/dev-spec-driven:design`; en otros clientes MCP son los prompts del servidor.)

### La CLI `dev-spec`

El mismo motor desde cualquier terminal (`node cli/dev-spec.js <comando>`, o `dev-spec` en el PATH);
`--json` muestra el resultado en bruto y `help` lista todas las opciones. Una instalación como plugin no pone `dev-spec` en el PATH, así que cada mensaje que pide ejecutar la CLI muestra la
línea ejecutable, `node "<clone>/cli/dev-spec.js" …` con la ruta resuelta (los archivos versionados como `ROADMAP.md` mantienen `dev-spec`):

```text
classify [--explain] · signals [list|set|forget] · init [--guard on|off|scope] [--stop-check on|off] [--check name=cmd] [--roles …]
  [--evidence reported|observed] [--approval-guard off|ask|deny] · steering · templates
create [--brownfield] [--flow design-first] [--kind spike|change] [--size xs|s|m|l] · bugfix · spike · import [- | --text] · list · status · doctor
trace [--code] [--matrix|--csv] · clarify · ears · next [--batch] [--waves] · next-action · brief · done [--run] · undone
append-tasks [--depends 3,5] · approve [--force [--reason] [--expires]] [--revoke] [--role] [--through] · impact [--reopen] · metrics [--write]
finish [--write] [--run] · decide · add-track [--remove] · feature <remove|archive|rename|restore|flow>
catalog [--write] · export [--md|--csv|--gherkin|--tracker jira|linear] [--write] · changelog [--milestone]
drift · stop-check · log · upgrade [--apply] · roadmap · milestone · depend · backlog · scan · coverage · evals
mcp-config <client> · rules <tool> · prompts · statusline [--print-config] · merge-state [--install|--uninstall|--check]
```

### Por qué no hay GitHub Actions

A propósito. Todos los gates — validación EARS, trazabilidad, clasificación, estado, tareas —
se ejecutan **localmente** mediante el servidor MCP y el modelo. Tus pruebas, pruebas de carga y
evals se ejecutan en tu entorno cuando quieras, no en un runner de CI de pago.

### Desarrollar / probar

```bash
node mcp/test.js          # prueba el servidor MCP de extremo a extremo (debe terminar en `0 failed`)
node cli/test-cli.js      # prueba la CLI universal (debe terminar en `0 failed`)
npm run test:docker       # las dos suites en contenedores Linux (Node 18 / 22 / 24) en tu propio Docker
```

El runner de Docker monta el plugin en solo lectura y se ejecuta sin red (solo la primera ejecución descarga las
imágenes); termina con 0 cuando todas las suites pasan, 1 ante un fallo y 2 cuando Docker no está disponible. Los evals
del plugin (`claude plugin eval`, suites de activación y de comportamiento) se describen en
[evals/README.md](./evals/README.md).

> Sustituye cuatro skills predecesoras; el contenido vive aquí como tracks componibles (los
> originales quedan en el historial git y en la release v1.8.0, por si alguna vez los necesitas).
> Licencia MIT.

---

## What's in the box / Estrutura / Estructura

```
dev-spec-driven/                      ← plugin root
├── .claude-plugin/                   ← plugin.json + marketplace.json
├── skills/dev-spec-driven/
│   ├── SKILL.md                      ← trilingual track-based workflow
│   └── references/                   ← deep library (EARS, scale, eval, safety, …)
├── commands/                         ← 55 slash commands (trilingual descriptions; also the MCP prompts)
├── agents/                           ← spec-implementer + spec-reviewer + spec-critic + spec-simplifier
├── evals/                            ← plugin evals for `claude plugin eval` (triggering EN/PT/ES + behavioural, with fixtures)
├── cli/dev-spec.js                   ← universal CLI (works in any tool / shell)
├── mcp/
│   ├── server.js                     ← local stdio MCP server (38 tools + prompts + resources, zero-dependency)
│   ├── servers.json                  ← plugin MCP registration (plugin.json → mcpServers)
│   ├── lib/spec.js                   ← the spec engine's facade (the one object the server, CLI and hooks require)
│   ├── lib/engine/                   ← the engine, one module per concern (classify, scaffold, lint, trace, doctor, gates, impact, roadmap, scan, import/)
│   ├── lib/i18n.js                   ← localized content's facade (artifact + steering builders, messages)
│   ├── lib/i18n/                     ← each language's text (en · pt · es) + the pt-BR derivation
│   ├── lib/prompts-resources.js      ← MCP prompts (one per command) + specs:// resources
│   ├── evals/run-evals.js            ← local eval harness (your API key; --dry-run offline)
│   ├── test.js                       ← the MCP test suite (node mcp/test.js — must end `0 failed`; --only <area>, --list)
│   └── tests/                        ← its files, one per area (cli/test-cli.js + cli/tests/: the CLI suite)
├── scripts/                          ← test-runner.js (both suites' runner) · test-docker.js (both suites in Linux containers)
├── hooks/                            ← local automation (PostToolUse, SessionStart, Stop/SubagentStop evidence gate, Bash observed-evidence log, opt-in PreToolUse guard + approval guard, pre-commit)
├── AGENTS.md                         ← portable workflow (Codex/Gemini/Cursor/Windsurf/…)
├── .cursor/ · .windsurf/ · .github/copilot-instructions.md · GEMINI.md   ← per-tool rules
├── integrations/                     ← MCP config templates per tool (placeholder path; `mcp-config` fills it)
├── examples/demo-project/            ← a worked feature (1.14 shape) that passes doctor + trace
├── INTEGRATIONS.md                   ← how to use it in every tool (+ MCP configs)
├── docs/maintainers/                 ← maintainer notes by topic (CLAUDE.md is their short index)
├── package.json · LICENSE · CHANGELOG.md · CLAUDE.md
└── INSTALL.md
```

See [INSTALL.md](./INSTALL.md) for persistent installation, hooks, the git pre-commit validator,
and the eval harness.
