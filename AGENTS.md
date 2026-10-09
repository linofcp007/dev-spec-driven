# dev-spec-driven — agent instructions (tool-agnostic)

The portable core of the dev-spec-driven workflow for any agent tool that reads an instructions file (Codex CLI, Gemini
CLI, Cursor, Windsurf, Copilot, Claude, Zed, Cline…). The full workflow is `skills/dev-spec-driven/SKILL.md`; the detail
lives in `skills/dev-spec-driven/references/` (`index.md` lists every file) — read a file when a step names it.

> Paths in this file point into the dev-spec-driven clone. `node cli/dev-spec.js rules agents` prints this file with those paths made absolute — the copy to use in your own project (re-run it if the clone moves).

> **Language:** answer in the user's language (English, Português — European or Brazilian —, Español), artifact prose
> included. Pass `--lang en|pt|pt-BR|es` to `dev-spec init` (the project default) and `dev-spec create`: scaffolds and
> messages come out localized — fill the placeholders. IDs (`US-1.AC-1`), task markers and track names never change;
> EARS keywords work in every language (`SHALL`/`DEVE`/`DEBE`).

## Mode first

**Vibe** — a trivial change: just do it, no artifacts. **Bounded** — a contained change to a flow that already exists: a
short design in chat, an explicit yes, no artifacts. **Bugfix** — a real defect: `dev-spec bugfix` (reproduce → root
cause → the user's OK → a failing regression test → fix). **Spike** — an open question: `dev-spec spike` (go / no-go /
pivot). **Spec** — everything else: the pipeline below. In doubt, take the heavier mode.

## Tracks

`core` always; the others compose (a billing webhook in a multi-tenant SaaS that calls an LLM = `core +tdd +saas +ai`).
When unsure, turn a track on.

| Track | Turn on when |
|---|---|
| **+tdd** | correctness matters or a mistake is hard to undo (money, auth, data integrity) |
| **+saas** | multi-tenant, a hot path, background jobs, cost at scale |
| **+ai** | quality depends on model output, or user input reaches a model |
| **+sec** | a mistake is a breach: credentials, trust boundaries, permissions, secrets |
| **+privacy** | personal data (GDPR / RGPD / HIPAA) |
| **+dist** | one write reaches several systems: brokers, outbox, sagas, retries, concurrency |
| **+api** | other code depends on the API's contract: OpenAPI, GraphQL, gRPC, versioning |
| **+ui** | a user-facing screen: design system, WCAG accessibility, UI states |
| **+obs** | a service people depend on: SLOs, alerts and runbooks, safe rollout |
| **+data** | pipelines between stores: ETL / ELT, a warehouse, quality checks, backfills |

The tracks are stored with the feature; `dev-spec add-track` changes them (`--remove` turns one off, no file deleted).
What each adds at every phase: `skills/dev-spec-driven/references/track-checklists.md`.

## The engine: CLI and/or MCP (both local, zero-cost, no CI)

Do the mechanical steps with the bundled engine instead of hand-editing files. Below, `dev-spec <command>` stands for
`node cli/dev-spec.js <command>` (a bare `dev-spec` works only when it is on PATH — `npm link` in the clone). Over MCP,
the `spec-driven` server exposes the same operations as 32 tools, plus one prompt per plugin command and the specs as
read-only `specs://` resources.

```
dev-spec classify "<feature description>"      # recommend tracks and a size
dev-spec init [tracks...] [--lang xx] [--check test="npm test"]   # .specs/steering/; the project checks
dev-spec create "<name>" [tracks...] [--size xs|s|m|l] [--lang xx] [--brownfield] [--flow design-first] [--branch]
dev-spec bugfix "<name>" · spike "<name>" --question "…" · import <tool> <path> [--dry-run]
dev-spec status [feature] · clarify · ears · trace [--code] · doctor <feature>   # doctor: exit 1 on FAIL
dev-spec next-action <feature>                 # the one next step
dev-spec approve <feature> <phase> [--force] [--through tasks]   # the USER's sign-off, after their explicit yes
dev-spec next <feature> [--waves] · brief <feature> [n]
dev-spec done <feature> <n> --run              # run the task's _Verify:_ and record the evidence
dev-spec stop-check --message "<closing message>"   # exit 1 = ticked tasks without passing evidence
dev-spec impact <feature> [--reopen]           # --reopen unticks affected done tasks (never a removed AC's: retire lists those)
dev-spec append-tasks · decide · finish <feature> [--run]   # converge tasks · decisions.md · blockers + merge summary
dev-spec add-track <feature> <track> [--remove]
dev-spec feature <archive|restore|rename|remove|flow> <name> …
dev-spec drift [feature]                       # files changed since finish (exit 1 on drift or a stale baseline)
dev-spec upgrade [--apply] · roadmap · depend · milestone · catalog · export · changelog · metrics
dev-spec backlog [add|rm "<name>" ["note"]]    # planned-but-unspecced features
dev-spec rules <cursor|windsurf|copilot|gemini|agents>   # a rule file with this clone's absolute paths
```

Every command, flag and exit code: `dev-spec help` and `skills/dev-spec-driven/references/tooling-reference.md`.

## The pipeline (Spec mode)

Before any spec work, read `.specs/steering/` (`constitution.md` — the project's non-negotiables — first). Each phase:
fill the scaffold, `dev-spec doctor`, present it, and record the user's yes. Phase detail:
`skills/dev-spec-driven/references/phase-guide.md`.

0. **Classify** — `dev-spec classify` drafts the tracks and a size; check a track you doubt against its section of `skills/dev-spec-driven/references/classification-matrix.md` and get the user's approval of the mode, tracks and size (xs a one-file change, s one story, m / l the full chain). Then `dev-spec init <tracks> --lang <xx>` if `.specs/steering/` is missing, and `dev-spec create "<name>" <tracks> --size <xs|s|m|l> --lang <xx>` once. Size m / l (or no size) seeds `classification.md`: record the decision there and `dev-spec approve <feature> classification` on the user's yes; size s or xs has no `classification.md` and no classification gate — record it in the Summary of `requirements.md` (s) or `change.md` (xs).
1. **Requirements** — EARS criteria with stable AC IDs, plus each track's criteria; `dev-spec ears`, `dev-spec clarify`; approve.
2. **Design** — the base sections plus every active track's mandatory sections (replace each `> **TODO**` sentinel with real content). Every design weighs **Alternatives & Trade-offs** and **Risks** and names its **Reuse & Integration** (what it reuses or extends, with paths) — `doctor` warns `design-tradeoffs` / `design-risks` / `design-reuse`. Approve.
3. **Test / eval plan** — +tdd: every test mapped to AC IDs (Kind `example` / `property`); +ai: golden / adversarial / regression sets, thresholds, a baseline. Approve.
4. **Failing tests / eval harness** — every planned test red for the right reason, its T-ID in its name (`dev-spec trace --code`); +ai: the harness and its baseline. No implementation before `dev-spec approve <feature> tests` (a bugfix: its regression test is task 1).
5. **Tasks** — ordered, traceable, by story; `_Requirements:_` and `_Verify: <command>_` always (no pipe), `_Expect: fail_` on a test written before its fix, optionally `_Depends: 3, 5_` and `_Size:_`. `dev-spec trace` — every AC maps to a task.
6. **Execute** — task by task (`dev-spec next <feature>` serves the first open one whose dependencies are done):
   - **The loop of the task's track:** implement and test (core) / red→green→refactor one behaviour at a time (+tdd) — a new behaviour's test first, watched failing for the right reason; code written before its test is deleted and redone, while guard tests, characterization tests of existing code and T-IDs an earlier task turned green pass at once / prompt iteration gated on the eval delta (+ai). `skills/dev-spec-driven/references/test-patterns.md`.
   - **Search before you write:** look for an existing helper, component or client first (the design's Reuse & Integration, then the codebase by concept and synonyms) — reuse, else extend, else create; a refactor outside the task goes to `dev-spec backlog add refactor-<topic> "refactor: …"`.
   - **Focus:** `dev-spec brief <feature>` gives one task with its ACs, tests, steering and neighbouring files resolved — also to hand it to another agent.
   - **Tick with evidence:** `dev-spec done <feature> <n> --run` (MCP `spec_complete_task`) is the only way to tick a task; a failure leaves it open, and for a task whose `_Verify:_` names a runnable command, a text note alone (`--evidence "…"` without `--cmd "…" --exit 0`) ticks it but leaves it unverified.
   - **Before you claim it:** run `dev-spec stop-check --message "<what you are about to say>"` — exit 1 means ticked tasks still lack passing evidence: record the run or say plainly what is not verified.
   - **Review findings are claims:** before fixing a finding of this plugin's reviewer, check it exists at HEAD, this branch introduced it, nothing in the spec asks for it and no green check answers it (`agents/spec-verifier.md`; only 80+ is worth a fix; an AC with no code is always a gap). A person's review comments go through `skills/dev-spec-driven/references/review-feedback.md`.
   - **Close** with `dev-spec finish`, optionally after a simplification pass (`skills/dev-spec-driven/references/code-reuse-and-quality.md`); subagent execution: `skills/dev-spec-driven/references/subagent-execution.md`.

At each phase boundary run `dev-spec doctor <feature>` and advance only on `readyToAdvance`. Record the user's sign-off (their explicit yes for that phase) with `dev-spec approve <feature> <phase>`. Unsure what comes next? `dev-spec next-action <feature>`.

## Gates and evidence

- **Approval is a gate:** `dev-spec approve` runs the phase's checks and refuses while any fails. `--force` records a
  flagged, *forced* approval — use it only when the user explicitly accepts the gap. With roles (`init --roles`) a phase
  needs every role; `--through tasks` approves the filled phases in order, only when the user asked for it.
- **Evidence:** a runnable `_Verify:_` is verified only by a recorded run — exit 0, or on an `_Expect: fail_` task a
  failing run for the right reason. **Can't run it yourself?** Don't tick — not bare, not with a note: ask the user for
  its output (or to run `node cli/dev-spec.js done <feature> <n> --run`) and record what they report; never send a
  subagent to look for a shell. `doctor`, `finish` and the `ROADMAP.md` "Needs attention" line list each unverified task
  with a localized reason. Reason codes, shells, PowerShell: `skills/dev-spec-driven/references/verification.md`.
- **`finish` blocks** on doctor failures, an artifact changed since approval, placeholders, open or unverified tasks,
  pending approvals and project checks (`init --check`) without a passing run on the current code (`finish --run`).
  A bugfix's fix can't complete before `bug.md` → Root Cause is written.

## When the spec changes

- **Impact before re-approval:** `dev-spec impact <feature> --phase <phase>` lists what an edit touches; `--reopen`
  unticks the affected done tasks and marks their evidence stale — never a removed criterion's tasks: `retire` lists
  them. Re-review, re-approve (`--phase steering` after a steering amendment). Every approval is snapshotted in
  `.specs/<feature>/.history/` — commit it.
- **Decisions** go to `decisions.md` (`dev-spec decide`), follow-up work through `dev-spec append-tasks`, a replaced
  criterion declares `_Supersedes: <feature>/US-n.AC-m_`; archive rather than delete. After a plugin update, `dev-spec
  upgrade` audits read-only; `--apply` with the user's OK. Depth: `skills/dev-spec-driven/references/change-management.md`.

## What Claude Code enforces — and what you do elsewhere

- **Guard mode** (`init --guard on|scope`) asks before code edits while no feature has approved tasks. Elsewhere: no
  implementation before the tasks are approved, no code outside the plan without a converge task.
- **Turn-end claims and observed evidence** are Claude Code hooks. Elsewhere run `dev-spec stop-check` yourself and
  record runs with `done --run` (MCP: `spec_stop_check {message}`; `spec_log {name, gitLog}` reads git log text you pass).
- **The approval guard: a Claude Code hook, and the MCP server.** `init --approval-guard ask|deny`: in other MCP
  clients the server asks the user itself through elicitation (only their explicit approve is recorded); a `declined:
  true` result — record nothing, ask what should change; `changedSincePreview: true` — nothing recorded, ask again. A
  `humanRequired: true` refusal names a `command`: give it to the user and wait. Where nothing asks, approvals are
  still the user's — never approve on your own.
- **Alongside superpowers:** this workflow replaces their feature-work skills; `dev-spec prompts spec-setup` shows the
  precedence block for your rules file.

## Non-negotiables

- **No implementation without approval** at each gate; **traceability end to end**; **mandatory track sections are
  mandatory** — "not needed because X" is fine, blank is not.
- **Evidence before claims** — a task is done when its `_Verify:_` run is on record, not when someone says so.
- **Everything is local. No GitHub Actions, no paid CI, no pull requests** — integrate by merging locally.
