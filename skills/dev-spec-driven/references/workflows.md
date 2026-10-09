# Supporting workflows, after-approval work and local automation

Sizes, the user's commands beside the main pipeline (Phase 0 → 6 in `SKILL.md`), what they do and where their depth lives.

## Sizes — right-sized rigor

A feature's size decides how much scaffold and how many approvals it costs; the gates that keep a spec honest — EARS on
every criterion, trace, the evidence gate, the bugfix iron law, phase order, the finish and execution gates — hold at
every size. `spec_classify` suggests one (`suggestedSize` + a stable `sizeReason`: trivial-change · small-change · single-unit ·
several-tracks · public-api · cross-system · default); the human confirms it in Phase 0 and `spec_create {size}` (CLI
`--size`) records it in `.state.json`. No size = the full scaffold and rules, nothing merged or trimmed; `spec_upgrade` never assigns one.

| Size | When | What it scaffolds | Approvals |
|---|---|---|---|
| **xs** — a change | a typo, a copy / config tweak, a one-line fix | ONE `change.md`: summary · 1–3 EARS criteria · approach · 1–3 tasks with `_Verify:_`; core only — no classification, design, quickstart or checklist | the plan (`spec_approve {through: "tasks"}`), then execution |
| **s** | one endpoint / screen / button, at most one track with design sections | one story (AC-1 WHEN · AC-2 IF…THEN + every track criterion), no `classification.md`; the design's weigh sections merged into **Decisions, reuse & risks**; each track's **core-tier** sections (the extended ones optional); a track task per criterion | fill the whole plan, then `spec_approve {through: "tasks"}` in one call (`next_action` says so from the start); with +tdd / +ai the call ends at the last plan before `tests` (`through: "test-plan"` with +tdd alone, `through: "eval-plan"` whenever +ai is on — the phase `next_action`'s `fastForward.through` names) — Phase 4's gate needs the failing tests / eval sets written first (Phase 4), then approve `tests`, then `tasks` |
| **m** / **l** | a feature with tracks · several tracks, a public API, cross-system | the full chain; the duplicate sections of two active tracks merged (`[SaaS] Observability` / `Performance Budget` → `[OBS]`); the core API Contracts / Error Handling under +api, Security Considerations under +sec, Testing Strategy under +tdd left out | phase by phase (`spec_approve {through}` once they are all filled and the user said go) |

- **A change stays XS.** A track, or more than 3 criteria / tasks, is refused (`change-scope`) — create it as a feature of
  size s instead, never silently. `spec_add_track` refuses a change.
- **A bugfix, any size** (`spec_create {kind: "bugfix"}`, `size: "xs"` for the one-call plan approval) has two tasks — 1
  the red regression test, 2 the fix — and no reproduce / root-cause tasks: the requirements gate already needs bug.md →
  Reproduction and the design gate its Root Cause; only task 1 can be ticked while Root Cause is empty.
- **Size s — the extended sections.** Absent is fine; present, it must be filled, or answered by ONE line `n/a — <why it
  does not apply>` (EN / PT / ES; a reason of at least 4 words).
- **Every size — a filled section is your own text.** The `> **TODO**` line deleted with the template's guidance bullet
  left alone is not an answer: a new approval refuses it; a design approved before 1.21 only warns.

## Supporting workflows — the user's commands

Only `/spec` and `/spec-bugfix` are yours to start; every command below is the user's to type. Offer one when it
helps, and do the work yourself through the tool it wraps (named in each row).

| Command | What it does | Reference |
|---|---|---|
| `/spec-bugfix` | A defect as a light spec (`spec_create {kind:"bugfix"}` — prefill `reproduction`, `rootCause`, `condition`, `behaviour`; `includeBody` returns the scaffolds): `bug.md` + a one-story `IF … THEN THE SYSTEM SHALL …` requirement + regression test plan. Reproduction + root cause, then STOP for the `bug.md` approval; `spec_doctor` fails, the design approval is refused and the fix task is refused until the root cause is written with evidence; after the tasks approval the next task is the regression test. The regression test (`_Expect: fail_`) is seen red before the fix — no shell? ask the user for the run, never a subagent hunting for one. After three failed fixes, question the design. | `references/bugfix.md` |
| `/spec-spike` | A question → a decision (`kind: "spike"`): `spike.md`, timebox, go / no-go / pivot; `go` seeds the real feature. | `references/design-first.md` |
| `/clarify [--grill]` | `spec_clarify`: the requirements' gaps before design; `--grill` interrogates one question at a time (a recommended answer each, the decision tree, then the constraints round) and folds the answers into `requirements.md`. | `references/phase-guide.md` |
| `/approve` | The user's sign-off of a phase (`spec_approve {name, phase}`): `--through <phase>` fast-forwards every filled phase, each through its own gate; `--force` (with `--reason` / `--expires`, a waiver) records it over failing checks; `--role` signs as a role; `--revoke` withdraws one. You never run it: you call `spec_approve` on the user's explicit yes. | `references/change-management.md` |
| `/spec-doctor [--deep]` | `spec_doctor`'s verdict; `--deep` adds the `spec-critic` agent's semantic review. | `references/tooling-reference.md` |
| `/spec-review simplify` | Optional, every task done, BEFORE finishing: behaviour-preserving cleanups of the lines the feature's branch added or changed — the deferred minor smells first —, one commit each, the covering tests after each change and the project checks at the end; never a test, a contract, a dependency or code the feature didn't write. The pass is reviewed (the reviewer's simplify mode) and a confirmed finding is reverted, never repaired; each changed task's `_Verify:_` is re-recorded. With subagents it dispatches the `spec-simplifier` agent (its SubagentStop gate wants a `## Final runs` section in its report with every run passing). With guard mode on, each edit of the pass asks the user. | `references/code-reuse-and-quality.md` |
| `/spec-review branch` | Local pre-merge review gated by tracks: spec compliance + constitution · +tdd red-first history, every AC tested · +saas tenant isolation (`WHERE tenant_id = ?`), observability, hot-path cost · +ai eval delta in the commit / merge summary, versioned prompts, PII-to-model · +sec / +privacy / +dist / +api / +ui / +obs / +data sections honoured · security · the project's written rules (constitution, `CLAUDE.md` / `AGENTS.md`, code comments — quoted) · the history of rewritten lines (a fix undone, a bugfix's root cause back). Each Critical / Important finding is verified before it is reported (a `spec-verifier` per finding): only a confidence of 80+ is reported as a finding, the rest listed as unconfirmed. | `references/subagent-execution.md` |
| `/spec-review converge` | The whole feature AC by AC against the code (the reviewer's converge mode) → the follow-up tasks the user approves, appended with `spec_append_tasks`. | `references/subagent-execution.md` |
| `/spec-review feedback` | Every review comment judged against the spec: fix AC violations, send spec changes back to their phase, push back on out-of-scope asks citing `Out of Scope`, ask about unclear ones. | `references/review-feedback.md` |
| `/spec-review prompt` (+ai) | Prompt changes are blocked without eval results (golden up, adversarial held, version bumped, cost delta noted). | `references/eval-suite-patterns.md` |
| `/eval run · baseline · migrate` (+ai) | The local eval harness (golden / adversarial / regression, the user's API key; `--dry-run` offline); a model migration is eval-gated only: run the current sets on the new model, switch only if equal-or-better (or tune the prompt to recover), record it in Model Lifecycle — never migrate blind. | `references/eval-suite-patterns.md` · `references/model-provider-guide.md` |
| `/spec-finish` | `spec_finish`: blockers (doctor fails, open tasks, tasks without a passing run, project checks without a passing run since the last tick, pending approvals, artifacts changed since approval, placeholders, a missing root cause) and warnings, the checks to run fresh (`--run` runs the project checks), a merge title + summary built from the spec chain, and the drift baseline. A green run is evidence, not the sign-off: ask for an explicit yes on `execution` before `spec_approve`. The user then merges locally or keeps the branch — no pull requests, no CI; never merge or push on your own. | `references/verification.md` |
| `/spec-change impact · decide · track ±x` | `spec_impact` (change requests), `spec_decide` (the decision log), `spec_add_track` (escalate a feature to +tdd/+saas/+ai/+sec/+privacy/+dist/+api/+ui/+obs/+data, additive, never overwrites; `remove: true` takes a track off without deleting files). | `references/change-management.md` |
| `/spec-report catalog · drift · metrics · changelog · export` | The living catalog, drift since finish, metrics + retro, release notes, the stakeholder export (`spec_export`, `spec_drift`, `spec_metrics`). | `references/change-management.md` |
| `/spec-upgrade` | After a plugin update: `spec_upgrade` audits every active feature against the current rules (status, what doctor flags, next step; review `critic` before any task is ticked, `converge` mid-execution); with an OK, `apply` saves inferred tracks, seeds pre-1.13 approval baselines, stamps `meta.specVersion` and writes `.specs/UPGRADE.md` — never edits a spec. | `references/change-management.md` |
| `/spec-adopt scan · reverse · coverage · import` | Brownfield: inventory the codebase (`spec_scan`), reverse-engineer steering and specs, measure coverage (`spec_scan {coverage: true}`); import a Kiro / spec-kit / OpenSpec spec, a Claude Code or Cursor plan, a Codex ExecPlan or BMAD docs → a NEW feature (`spec_import`: IDs remapped, `mapping` + `warnings` shown; then Phase 0 track confirmation and the normal gates) — Kiro steering / Cursor rules → `.specs/steering/` files (never over an existing one); `dryRun` shows it all, writes nothing. | `references/brownfield.md` |
| `/spec-setup init · guard · statusline · superpowers · templates · tracks` | `spec_init` (steering, `lang`, project checks, roles); guard mode (`spec_init {guard}`: in Claude Code a PreToolUse hook asks before a code edit while no feature has approved, unfinished tasks — a test file during Phase 4 and an active spike's prototype excepted; `scope` also asks for a code file no open task names in `_Implements:_`); the status line; with superpowers installed, a marked precedence block in CLAUDE.md (after an OK; `--remove` takes it out; never disables superpowers); the team's own scaffolds in `.specs/templates/` (`spec_templates`: list · init · check; the engine still appends each track's sections) and tracks in `.specs/tracks/<name>/` (`spec_tracks`: list · init · check; a valid pack is a marker track everywhere, a bad one is ignored). | `references/tooling-reference.md` · `references/steering-templates.md` · `references/project-tracks.md` |
| `/spec-tour` | A guided ~10-minute tour: one tiny real change on the user's repo through every gate, then keep / archive / remove it. | — |
| `/executeTask commit` | Conventional commit referencing the task (`Part of .specs/<feature>/ task #N.`), `Makes T-xx green`, the eval delta and emitted metrics; Phase-4 commits use `test:`. `dev-spec log <feature>` reads them back per task (+tdd: the red-first check). | `references/tooling-reference.md` |
| `/feature` | Archive (reversible, preferred) · restore · rename (deps follow) · flow (design-first) · remove (destructive: needs `confirm: true` / `--yes`, confirm with the user first) — `spec_feature`. | `references/tooling-reference.md` |
| `/roadmap · depend · backlog · milestone` | Order and dependencies between features (cycles rejected), %, blocked status, ETA from velocity (`_Size:_`), features whose open tasks plan the same files, planned-but-unspecced work, milestones (a target date for a set of features: on-track · at-risk · late · done) — `spec_roadmap`, `spec_roadmap_edit`. Don't start a feature whose dependencies aren't met without saying so. `.specs/ROADMAP.md` is regenerated automatically — never hand-edit it. | `references/tooling-reference.md` |
| `/spec-status` | Mode, tracks, phase, task progress, test/eval state, section completeness (`spec_status`; without a name, every feature). | — |

**Commands:** entry `/spec` (alias `/ds`), execute `/executeTask` (`/dsx`), status `/spec-status` (`/dss`), onboarding
`/spec-tour`; as a plugin every command is namespaced (`/dev-spec-driven:spec-doctor`); other MCP clients get them as
MCP prompts. Full table: `references/tooling-reference.md`.

## After approval: changes, decisions, drift, metrics

- **Change request (`spec_impact`).** Every approval saves a snapshot (`.history/<phase>@<n>.md`) and joins
  `approvalHistory`. An approved artifact edited later is flagged everywhere (`changed-since-approval`;
  `next_action` → re-review; `spec_finish` blocks). `spec_impact` diffs it against the snapshot — ACs (by ID),
  design sections or tasks — and lists the tasks, tests and design sections each change reaches. Show that to the
  user; only with their OK, `reopen: true` unticks the affected done tasks, marks their evidence stale and records
  the change request (`state.changes`) — a REMOVED criterion's tasks are never redone: `retire` lists them (and
  their test rows) to delete or repoint. Then update what the change reaches and re-approve (a new snapshot).
  **Steering amendments:** requirements / design approvals record the steering that governed them (constitution, the
  tracks' files, `always` / matching `fileMatch` ones); once one changes, doctor warns
  `steering-changed-since-approval` and `spec_impact {phase: "steering"}` (no name = every feature) lists who to
  re-review and re-approve.
- **Decisions (`spec_decide`).** A decision or discovery made while planning or implementing goes to
  `decisions.md` (`D-n`, `_Affects: US-1.AC-2, T-03, <design section>_`, append-only — supersede, never rewrite).
  Briefs, the merge summary, the export and the catalog show it; doctor warns when one lands after the approval of
  what it affects.
- **Superseding.** A later feature that replaces an earlier criterion marks its new AC
  `_Supersedes: <feature>/US-n.AC-m_` instead of rewriting finished specs; the catalog (`spec_export {format:
  "catalog"}`) keeps `.specs/SPECS.md` (every feature and AC) current. A criterion that reads like another active
  feature's, or may contradict it (SHALL vs SHALL NOT, different numbers), is flagged by doctor (`cross-feature-acs`)
  and the catalog — merge, reword or declare `_Supersedes:_`.
- **Drift (`spec_drift`).** `spec_finish {write: true}` on a ready feature hashes every `_Implements:_` file;
  `spec_drift` (and a session-start line) reports what changed since. Decide with the user: update the spec
  (`spec_impact`, or a new feature with `_Supersedes:_`), fix the code, or accept and re-baseline.
- **Metrics & retro (`spec_metrics`).** Lead times, rework, forced approvals, change requests, evidence pass rate,
  velocity; `--write` drafts `retro.md` after finish — its steering/constitution amendments are proposals, never applied.
- **Stakeholders.** `spec_export` — an offline, printable HTML/md document (`--gherkin`: `.feature` files, steps = the
  EARS clauses; `--tracker jira|linear`: an import CSV; `--adr`: the decision log as MADR files, ADR number = D-n);
  `spec_export {format: "changelog"}` — release notes (Added · Changed · Fixed), `--milestone`.
- **Archive, don't delete.** `spec_feature` archive is reversible (`restore` puts the roadmap deps back).

Depth: `references/change-management.md`.

## Local automation, not CI

Saving `requirements.md` lints EARS and placeholders, `tasks.md` checks traceability, `design.md` the active tracks'
mandatory sections and the Constitution Check; session start prints feature status, drifted finished features,
cross-feature file overlaps and an outdated `.specs/`; guard mode asks before code edits while no feature has approved,
unfinished tasks (Phase 4 test files and spike prototypes excepted); the Stop / SubagentStop evidence gate sends back a
"done" without passing evidence; the optional `pre-commit` validator blocks staged EARS errors / phantom refs. Hand
security/quality to **dev-guardian** (`/guardian-review`, `/guardian-scan`) and UI work to **ui-ux-pro-max** when
present — route to them, don't duplicate them.
