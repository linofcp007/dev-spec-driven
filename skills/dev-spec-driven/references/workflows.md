# Supporting workflows, after-approval work and local automation

The commands beside the main pipeline (Phase 0 → 6 in `SKILL.md`), what they do and where their depth lives.

## Supporting workflows

| Command | What it does | Reference |
|---|---|---|
| `/spec-bugfix` | A defect as a light spec (`spec_create {kind:"bugfix"}` — prefill `reproduction`, `rootCause`, `condition`, `behaviour`; `includeBody` returns the scaffolds): `bug.md` + a one-story `IF … THEN THE SYSTEM SHALL …` requirement + regression test plan. Reproduction + root cause, then STOP for the `bug.md` approval; `spec_doctor` fails, the design approval is refused and every task after the root-cause task is refused until the root cause is written with evidence. The regression test (`_Expect: fail_`) is seen red before the fix — no shell? ask the user for the run, never a subagent hunting for one. After three failed fixes, question the design. | `references/bugfix.md` |
| `/spec-spike` | A question → a decision (`kind: "spike"`): `spike.md`, timebox, go / no-go / pivot; `go` seeds the real feature. | `references/design-first.md` |
| `/spec-finish` | Blockers (doctor fails, open tasks, tasks without a passing run, project checks without a passing run since the last tick, pending approvals, artifacts changed since approval, placeholders, a missing root cause) and warnings, the checks to run fresh (`--run` runs the project checks), a merge title + summary built from the spec chain, and the drift baseline. A green run is evidence, not the sign-off: ask for an explicit yes on `execution` before `spec_approve`. The user then merges locally or keeps the branch — no pull requests, no CI; never merge or push on your own. | `references/verification.md` |
| `/spec-impact` · `/spec-converge` · `/spec-drift` · `/spec-metrics` · `/spec-catalog` · `/spec-decide` · `/spec-export` · `/spec-changelog` | Change requests, the AC-by-AC converge pass, drift since finish, metrics + retro, the living catalog, the decision log, the stakeholder export, release notes (below). | `references/change-management.md` |
| `/spec-upgrade` | After a plugin update: `spec_upgrade` audits every active feature against the current rules (status, what doctor flags, next step; review `critic` before any task is ticked, `converge` mid-execution); with an OK, `apply` saves inferred tracks, seeds pre-1.13 approval baselines, stamps `meta.specVersion` and writes `.specs/UPGRADE.md` — never edits a spec. | `references/change-management.md` |
| `/spec-import` | A Kiro / spec-kit / OpenSpec spec, a Claude Code or Cursor plan, a Codex ExecPlan or BMAD docs → a NEW feature (IDs remapped, `mapping` + `warnings` shown); then Phase 0 track confirmation and the normal gates. | `references/brownfield.md` |
| `/spec-templates` · `/spec-tracks` | The team's own scaffolds in `.specs/templates/` (`list` · `init` · `check`; the engine still appends each active track's sections) · the team's own tracks, packs in `.specs/tracks/<name>/` (`list` · `init <name>` · `check`; a valid pack is a marker track everywhere, a bad one is ignored). | `references/steering-templates.md` · `references/project-tracks.md` |
| `/spec-tour` | A guided ~10-minute tour: one tiny real change on the user's repo through every gate, then keep / archive / remove it. | — |
| `/spec-superpowers` | When superpowers is installed too: writes (after an OK) a marked precedence block into the project's or the user's CLAUDE.md so feature work uses this workflow; `--remove` takes it out. Never disables superpowers. | — |
| `/spec-guard` | Opt-in guard mode (`spec_init {guard}`): in Claude Code, a PreToolUse hook asks before a code edit while no feature has approved, unfinished tasks (a test file during Phase 4 and an active spike's prototype excepted); `scope` also asks for a code file no open task names in `_Implements:_`. | `references/tooling-reference.md` |
| `/spec-review-feedback` | Every review comment judged against the spec: fix AC violations, send spec changes back to their phase, push back on out-of-scope asks citing `Out of Scope`, ask about unclear ones. | `references/review-feedback.md` |
| `/prReview` | Local pre-merge review gated by tracks: spec compliance + constitution · +tdd red-first history, every AC tested · +saas tenant isolation (`WHERE tenant_id = ?`), observability, hot-path cost · +ai eval delta in the commit / merge summary, versioned prompts, PII-to-model · +sec / +privacy / +dist / +api / +ui / +obs sections honoured · security. | — |
| `/spec-commit` | Conventional commit referencing the task (`Part of .specs/<feature>/ task #N.`), `Makes T-xx green`, the eval delta and emitted metrics; Phase-4 commits use `test:`. `dev-spec log <feature>` reads them back per task (+tdd: the red-first check). | `references/tooling-reference.md` |
| `/promptReview` · `/migrateModel` (+ai) | Prompt changes are blocked without eval results (golden up, adversarial held, version bumped, cost delta noted). A model migration is eval-gated only: run the current sets on the new model, switch only if equal-or-better (or tune the prompt to recover), record it in Model Lifecycle — never migrate blind. | `references/eval-suite-patterns.md` · `references/model-provider-guide.md` |
| `/add-track` · `/feature` | Escalate a feature to +tdd/+saas/+ai/+sec/+privacy/+dist/+api/+ui/+obs (additive, never overwrites; `remove: true` / `--remove` takes a track off without deleting files). Archive (reversible, preferred) · restore · rename (deps follow) · flow (design-first) · remove (destructive: needs `confirm: true` / `--yes`, confirm with the user first). | `references/tooling-reference.md` |
| `/roadmap` · `/depend` · `/backlog` · `/spec-milestone` | Order and dependencies between features (cycles rejected), %, blocked status, ETA from velocity (`_Size:_`), features whose open tasks plan the same files, planned-but-unspecced work, milestones (a target date for a set of features: on-track · at-risk · late · done). Don't start a feature whose dependencies aren't met without saying so. `.specs/ROADMAP.md` is regenerated automatically — never hand-edit it. | `references/tooling-reference.md` |
| `/spec-status` | Mode, tracks, phase, task progress, test/eval state, section completeness (`spec_status` / `spec_list`). | — |

**Commands:** entry `/spec` (alias `/ds`), execute `/executeTask` (`/dsx`), status `/spec-status` (`/dss`), onboarding
`/spec-tour`; as a plugin every command is namespaced (`/dev-spec-driven:spec-doctor`); other MCP clients get them as
MCP prompts. Full table: `references/tooling-reference.md`.

## After approval: changes, decisions, drift, metrics

- **Change request (`/spec-impact`).** Every approval saves a snapshot (`.history/<phase>@<n>.md`) and joins
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
- **Decisions (`/spec-decide`).** A decision or discovery made while planning or implementing goes to
  `decisions.md` (`spec_decide`: `D-n`, `_Affects: US-1.AC-2, T-03, <design section>_`, append-only — supersede,
  never rewrite). Briefs, the merge summary, the export and the catalog show it; doctor warns when one lands after
  the approval of what it affects.
- **Superseding.** A later feature that replaces an earlier criterion marks its new AC
  `_Supersedes: <feature>/US-n.AC-m_` instead of rewriting finished specs; `/spec-catalog` keeps `.specs/SPECS.md`
  (every feature and AC) current. A criterion that reads like another active feature's, or may contradict it (SHALL vs
  SHALL NOT, different numbers), is flagged by doctor (`cross-feature-acs`) and the catalog — merge, reword or declare
  `_Supersedes:_`.
- **Drift (`/spec-drift`).** `spec_finish {write: true}` on a ready feature hashes every `_Implements:_` file;
  `spec_drift` (and a session-start line) reports what changed since. Decide with the user: update the spec
  (`/spec-impact`, or a new feature with `_Supersedes:_`), fix the code, or accept and re-baseline.
- **Metrics & retro (`/spec-metrics`).** Lead times, rework, forced approvals, change requests, evidence pass rate,
  velocity; `--write` drafts `retro.md` after finish — its steering/constitution amendments are proposals, never applied.
- **Stakeholders.** `/spec-export` — an offline, printable HTML/md document (`--gherkin`: `.feature` files, steps = the
  EARS clauses; `--tracker jira|linear`: an import CSV); `/spec-changelog` — release notes (Added · Changed · Fixed),
  `--milestone`.
- **Archive, don't delete.** `/feature archive` is reversible (`restore` puts the roadmap deps back).

Depth: `references/change-management.md`.

## Local automation, not CI

Saving `requirements.md` lints EARS and placeholders, `tasks.md` checks traceability, `design.md` the active tracks'
mandatory sections and the Constitution Check; session start prints feature status, drifted finished features,
cross-feature file overlaps and an outdated `.specs/`; guard mode asks before code edits while no feature has approved,
unfinished tasks (Phase 4 test files and spike prototypes excepted); the Stop / SubagentStop evidence gate sends back a
"done" without passing evidence; the optional `pre-commit` validator blocks staged EARS errors / phantom refs. Hand
security/quality to **dev-guardian** (`/guardian-review`, `/guardian-scan`) and UI work to **ui-ux-pro-max** when
present — route to them, don't duplicate them.
