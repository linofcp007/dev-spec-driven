---
name: dev-spec-driven
description: >
  Spec-first development: EARS requirements, a design and traceable tasks behind approval gates, a task
  ticked only on evidence. Use when the user wants to plan a non-trivial feature before coding; resume one
  (where it stands, what's left, the next task), change its approved spec or run a spike; fix a reported
  bug properly (root cause, red test); close a finished feature (checks, dev-guardian's gate, local merge);
  adopt specs in an existing codebase; manage a roadmap; or update the specs after a dev-spec-driven
  update. Works in English, Portuguese and Spanish. Not for trivial edits, requirements.txt, or code
  merely calling eval() or an LLM.
---

# Dev Spec-Driven

## Mode first — say it out loud

| Mode | When | Do |
|---|---|---|
| **Vibe** | trivial: a typo, a copy change, a one-file fix under ~30 min; "just do it" | Build it — no artifacts. Stop reading here. |
| **Bounded** | a contained change to a flow that **already exists** in this repo (a flag, a small endpoint) | Ask what matters, a short design in chat (the files, how you'll verify), then STOP for an explicit yes. No artifacts; no existing flow → not bounded. |
| **Bugfix** | a real defect: it worked (or is specified to work) and doesn't | `/spec-bugfix` — the flow below, `references/bugfix.md`. |
| **Spike** | a question that must end in a decision (which queue? can the API do X?) | `spec_create {kind: "spike", question, timebox}` → go / no-go / pivot (`references/design-first.md`). |
| **Spec** | everything else — formal, complex, "system", "integration", "properly"; or whatever the user asks to spec (`/spec`) — a small change is then size xs, not Vibe | Phase 0 → 6 below. |

Between two modes, take the heavier; the user can switch ("let's vibe", "spec this"). The ratchet is one-way: hidden
complexity found mid-task upgrades the mode, never the reverse — a Vibe session that sprouts a tenant boundary, a
payment path, personal data, a trust boundary or an LLM call says so and offers to classify. Spec mode also covers
improvement work (`references/improvement-specs.md`), the design-first order (`references/design-first.md`), adopting
an existing codebase or importing another tool's spec or plan (`references/brownfield.md`). A `.specs/` from an older
dev-spec: `spec_upgrade` audits it first; apply after an OK.

**Bugfix flow** — fixed order: reproduce → root cause with evidence → STOP for the `bug.md` approval ("fix it" asks
for the outcome, not an approval of the root cause) → the regression test (`_Expect: fail_`), seen red → fix → verify.
With dev-guardian, offer its `bug_hunt` to reproduce and isolate. Prefilling the scaffold in one call, fixes that keep
failing: `references/bugfix.md`.

**Size** (`spec_classify` suggests, the user confirms): **xs** one `change.md` (core only, ≤ 3 criteria and tasks) ·
**s** one story, no `classification.md`, the plan approved in one call · **m / l** the full chain. Every size keeps
EARS, trace, evidence, the bugfix iron law and the finish gate (what each scaffolds and approves:
`references/phase-guide.md` → Sizes).

## Language

Mirror the user's language everywhere — conversation, approval prompts, the artifacts' prose and headings; follow a
switch. Pass `lang` to `spec_init` (the project default) and `spec_create`: `en`, `pt` (European Portuguese), `pt-BR`
(Brazilian) or `es` — scaffolds and messages come back localized: fill the placeholders, don't translate them.
`spec_classify` reads any Portuguese as `pt`: pick `pt-BR` from the user's wording (`langHint: "pt-BR"` hints it). IDs,
task markers, tags (`[US1]`, `[P]`), track names, the section markers (`[SaaS]` … `[DATA]`) and
`[NEEDS CLARIFICATION:]` never change.

## Core Principles

1. **No implementation without approval** — the user's explicit yes for THAT phase; "fix it", "ship it", a passing run
   or a ticked task is not one.
2. **Right rigor for the job.** Don't TDD a copy change; don't ship a payment path on vibes.
3. **Traceability end to end** — code → tasks → tests / evals → design → requirements, through stable IDs.
4. **Mandatory track sections are mandatory.** "Not needed because X" is fine; empty means nobody thought about it.
5. **Everything is local** — the bundled MCP server and CLI; no GitHub Actions, no cloud runners, no pull requests.
6. **Evidence before claims.** Nothing is done, passing or fixed until a command proved it on the final code. Tick only
   through `spec_complete_task {evidence}` with `{command, exitCode}` of the task's own `_Verify:_` run (an
   `_Expect: fail_` task: its red run) — never by editing the checkbox, never with an exit code you didn't see.
   **No shell?** Don't tick, and don't send a subagent to look for one: ask the user for the output (or to run the
   `node "<clone>/cli/dev-spec.js" done <feature> <n> --run` line the tool's note prints) and record what they report.
   `references/verification.md`; the excuses that precede skipping a step: `references/red-flags.md`.
7. **An approved spec that changed is not approved** — diffed (`spec_impact`), reviewed and re-approved.

## The engine

The local MCP server **`spec-driven`** writes skeletons and runs checks, never over your files — you fill them (which
tool when, working without MCP: `references/tool-catalog.md`; tools, CLI, hooks, check ids:
`references/tooling-reference.md`). Slash commands: `/spec` and `/spec-bugfix` start work; every other one (`/approve`,
`/spec-review`, `/spec-change`…) is the user's to type — you never run it, you call the tool it wraps. Spec conformance
of the code is the user's `/spec-review`; a security / quality review of a diff, dev-guardian's `guardian-review` when
installed.

**Tracks** (`core` always): +tdd · +saas · +ai · +sec · +privacy · +dist · +api · +ui · +obs · +data · a team's pack
in `.specs/tracks/` (`references/project-tracks.md`) — what each adds per phase: `references/track-checklists.md`.
With superpowers installed, this workflow replaces its feature-work skills — never both on one feature.

## The pipeline

| Phase | Produce | Gate | Read |
|---|---|---|---|
| 0 Classify | mode, tracks, size; `classification.md` (m / l) | `classification` | `references/classification-matrix.md` |
| 1 Requirements | `requirements.md`: EARS, AC IDs, stories by priority | `requirements` | `references/ears-guide.md` |
| 2 Design | `design.md`: base + track sections; `quickstart.md`, `checklist.md` | `design` | `references/phase-guide.md` |
| 3 Test / eval plan | `test-plan.md` (+tdd), `eval-plan.md` (+ai) | `test-plan`, `eval-plan` | `references/test-patterns.md`, `references/eval-suite-patterns.md` |
| 4 Failing tests | planned tests red; eval harness + baseline (+ai) | `tests` | `references/test-patterns.md` |
| 5 Tasks | `tasks.md`: ordered, traceable, by story | `tasks` | `references/phase-guide.md` |
| 6 Execute | code, each task ticked on evidence | `execution` | `references/verification.md` |

Phases 3–4 only on +tdd / +ai; design-first does 2 before 1. Each phase: read `.specs/steering/` and the approved
artifacts → fill → `spec_doctor` → present → the user's yes → `spec_approve`.

**Phase 0.**
1. **Run `spec_classify`** (with `projectDir` — the project's track packs count): a draft of tracks, signals, size.
2. **Sanity-check** a track it suggests or leaves out against that track's section of
   `references/classification-matrix.md`. **When unsure, turn the track on.**
3. **Present for approval:** mode, tracks, size, the signals behind each, the blast radius.
4. **After Phase 0 approval:** `spec_init {tracks, lang}` if steering is missing, then
   `spec_create {name, tracks, size, lang}` **once**, the description as `summary` (`spec_add_track` later, `remove:
   true` to drop one). **m / l** (or no size): fill `classification.md`, approve `classification`; **s / xs:** no
   `classification.md` — record it in the Summary of `requirements.md` / `change.md`. Its own git branch:
   `references/tooling-reference.md`.

**Phase 1.** EARS (the patterns: `references/ears-guide.md`; PT / ES keywords pass too) with stable IDs (AC, `SC-`,
`EC-`, `NFR-`), P1 stories first; concrete values, never "fast". Ask, don't guess — mark ambiguity
`[NEEDS CLARIFICATION: …]` (the design can't start while one remains). `ears_validate`, `spec_clarify` (offer the grill
and its constraints round), present.

**Phase 2.** Every base section (the list: `references/phase-guide.md`), weighing **Reuse & Integration**,
**Alternatives & Trade-offs** and **Risks**, plus each track's sections (doctor warns `design-tradeoffs` /
`design-risks` / `design-reuse`; at size m / l the Reuse & Integration is a gate). For the Constitution Check
`spec_doctor` only checks that the section is there; the human judges it.
`spec_create` always scaffolds `quickstart.md` and `checklist.md` — fill both.

**Phases 3–4.** Every AC in ≥ 1 test row (`T-nn`); +ai: the eval sets with thresholds and a baseline. Phase 4 is the
hard gate: every planned test written, red for the right reason, its T-ID in its name (`trace_check {code: true}`); no
implementation until the user approves `tests` — show the red / green counts. A bugfix's regression test is its task 1
instead.

**Phase 5.** Tasks of ~30 min–2 h by story, each ending in a `**Checkpoint:**`; `[US1]` / `[shared]`, `[P]` when
parallel. Always `_Requirements:_`, `_Implements: <path>_` on a code task (drift, duplicates, the scope guard and
dev-guardian read it) and `_Verify: <command>_` (no pipe); `_Expect: fail_` on a test before its code; optional
`_Depends:_`, `_Size:_`. `trace_check`: every AC → a task. Later work is appended (`spec_append_tasks`).

## Phase 6 — Execute

Re-read the spec chain first. **Search before you write:** the design's Reuse & Integration, the brief, the codebase by
concept and synonyms — reuse, else extend, else create; a refactor outside the task goes to the backlog
(`references/code-reuse-and-quality.md`). Tasks in order (`spec_next_task`), each with its loop:

- **core task (no +tdd):** implement per design → the existing tests and the `_Verify:_` → `spec_complete_task {evidence}`.
- **+tdd task:** the micro-cycle, ONE behaviour at a time — a new behaviour's test, watched failing for the right
  reason → minimum code → green → refactor on green; code written before its test is deleted and redone;
  guard / characterization tests and T-IDs an earlier task turned green pass at once → the full suite (targets green,
  the rest unchanged) → `spec_complete_task {evidence}` (`references/test-patterns.md`).
- **+ai generation/prompt task:** a new `prompts/vN.md` → the full eval harness → keep it only if golden held or rose
  and adversarial held → `spec_complete_task {evidence}` with the score delta.

Blocked → pause and discuss; don't improvise outside the design. A gap a test or a measurement shows sends you back
to that phase; a wrong "green" test is a plan change with approval — never edit a test to pass. Decisions and
discoveries go to `decisions.md` (`spec_decide`). In Claude Code a Stop hook returns a "done" without passing
evidence: run the check or say what is unverified.

**Subagents (opt-in, ~6+ independent tasks, 2–3× the tokens):** per task `spec_task_brief {name, number, write: true}`,
at size m / l (or none) its pre-flight (the critic, brief mode: the decisions it leaves open, settled before the dispatch),
dispatch **`dev-spec-driven:spec-implementer`** with its path, send the diff to **`dev-spec-driven:spec-reviewer`**,
verify each ❌ / Critical / Important finding (a `dev-spec-driven:spec-verifier` per finding; only 80+ opens a fix
round), at most 5 rounds, then `spec_complete_task`. You never write feature code; stop at every `**Checkpoint:**`; a
finding that changes an AC, the design or a planned test goes back to that phase; +ai prompt tasks stay inline.
`references/subagent-execution.md` (also the final review, converge, the simplification pass).

## Gates and approvals

`spec_doctor` before a phase advances: one `readyToAdvance` verdict over every check (a track section counts only
filled with your own text). At size m / l (or none), offer once per feature the deep review before the requirements
approval (design-first: the design's; never at classification): fresh reviewers — the critic, a cold read — whose
findings you triage, never apply unasked (`references/critic-review.md`).
Present the artifact, the key decisions, the risks, the verdict, the next step; ask. On the
user's yes for that phase, record it with `spec_approve {name, phase}` (`/approve` is the user's own command). A
failing check refuses it; `force: true` only when the user explicitly accepts the failures. Phases go in order (one
edited since its approval is re-approved first); `{through: "tasks"}` approves several filled ones only after the user
said go. When the approval guard asks the user or refuses you, give them the command it names and wait — never retry
another way. **Execution:** a green run is evidence, not the sign-off — show it with the merge summary and ask for an
explicit yes. Lost? `spec_next_action` names ONE next step.

## Finish and after

`spec_finish` lists the blockers, the checks to run fresh and a merge summary. With the project check `guardian`
(`spec_init {guardian: true}`, only on the user's request) it runs dev-guardian's gate: a blocking finding is fixed or,
once the user accepts it, suppressed inline with a reason or dropped by a baseline rebuilt on the base commit — never
advise `baseline update` with the feature's code in the tree (it accepts every finding, the feature's own too — the
user's call); never forced (how: `references/verification.md`). After the `execution` sign-off the user picks **merge
into the base branch locally** or **keep the branch** — no pull requests, no CI; never merge or push on your own
(pushing the merged base too). An approved artifact edited later: `spec_impact` lists what each change reaches; with
the user's OK, `reopen: true` unticks the affected done tasks (a removed criterion's are never redone — `retire` lists
them), then re-approve. Drift, metrics, exports, archive, roles, waivers, the user's other commands:
`references/workflows.md`, `references/change-management.md`; every file: `references/index.md`.
