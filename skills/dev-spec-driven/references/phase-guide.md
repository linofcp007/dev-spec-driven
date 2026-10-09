# Phase guide — the detail behind SKILL.md's pipeline

Read the section of the phase you are in. `SKILL.md` holds the rules; this file holds what each artifact contains, the
steps and what to present. What each active track adds: `references/track-checklists.md`.

## Before any phase: `.specs/` and steering

- Everything lives in `.specs/` at the project root — `steering/`, `roadmap.json`, one folder per feature (its
  artifacts, `decisions.md`, `retro.md`, the `.history/` approval snapshots — commit them) and the generated
  `ROADMAP.md`, `SPECS.md`, `RELEASE-NOTES.md`, `exports/` (the annotated tree: `references/tooling-reference.md`).
- Read whatever exists in `.specs/steering/` first. Missing files are created after the Phase 0 approval (`spec_init`),
  a track's steering file (`steering_scaffold`) the first time a later feature pulls that track in. A file still full
  of placeholders steers nothing (`spec_doctor` names it). Scoped steering, the team's `.specs/templates/`,
  `glossary.md`: `references/steering-templates.md`.
- `constitution.md` is core (always): the project's few, concrete, testable non-negotiables ("every write is
  idempotent", "no PII in logs"). Every design carries a Constitution Check (the design approval refuses it empty);
  whether the design honours each principle is judged by the human at the gate, by the `spec-critic` agent (the user's
  `/spec-doctor --deep`) and, on the code, by the branch review (`/spec-review branch`).
- New to the plugin? Offer the user `/spec-tour`: one tiny real change on their repo through every gate in ~10 minutes.

## Phase 0 — Classification

`spec_classify` returns the suggested tracks, the keyword signals behind each, notes ("possible +sec", a negated
keyword, a correction this project learned), a `suggestedSize` with its `sizeReason` and, for Brazilian wording,
`langHint`. It is a draft for the human: check a track you doubt against its section of
`references/classification-matrix.md` (the procedure, every track's "turn it on if" table, the `classification.md`
format). Worked examples: `references/classification-examples-saas.md`, `references/classification-examples-ai.md`.
When the confirmed tracks differ from the suggestion, `spec_create {summary}` with the classified description records
the correction in `.specs/classifier.json`; two consistent ones change how this project's words count.

## Phase 1 — Requirements

Turn the idea into testable requirements in EARS with stable AC IDs (`US-1.AC-1`, …) — the backbone of traceability
(tests, tasks, commits and alerts cite them), so assign them even on the lightest track. The language: `spec_create`'s
`lang` wins over the project's default (`spec_init {lang}`), English last; headings in the user's language too
(`## Critérios de Sucesso`). Prioritize the user stories and make each independently shippable (P1
the MVP, each with a one-line *Independent Test*). Add Success Criteria — measurable, technology-agnostic outcomes
(`SC-001`) — and stable IDs for edge cases and NFRs (`EC-1`, `NFR-1`; `trace_check` warns when nothing covers them).
Mark any ambiguity inline with `[NEEDS CLARIFICATION: question]` (doctor `clarifications`: the design cannot start
while one remains); replace every template placeholder (`placeholders`: the approval is refused).

Steps: read steering → ask clarifying questions (don't guess) → fill `requirements.md` → `ears_validate` →
`spec_clarify` (vague terms, placeholders, missing edge cases / NFRs / out-of-scope / IF…THEN paths, track gaps) and ask
the user → offer the grill (the user's `/clarify <feature> --grill`: one question at a time, then a constraints round —
atomicity, isolation, races, consistency, idempotency, failures, volume) → present for approval. The EARS quick
reference (the five patterns, the PT / ES keywords, the compound order) and the full syntax: `references/ears-guide.md`.

## Phase 2 — Design

Convert the approved requirements into a technical blueprint (on a design-first feature this phase comes first).
Re-read steering and requirements, scan the codebase for patterns to match and code to reuse, then write `design.md`
— Overview, Architecture (≥ 1 Mermaid diagram), Data Models, API Contracts, Security, Error Handling, Testing Strategy
and:

- **Reuse & Integration** — what is reused or extended, with paths; what is new and why nothing existing fits; where
  the new code lives (`references/code-reuse-and-quality.md`).
- **Alternatives & Trade-offs** — ≥ 2 real options per key decision, the one chosen and why.
- **Risks** — likelihood · impact · mitigation · owner.
- **Constitution Check** — each principle, re-checked after any change; **Complexity Tracking** — what breaks a
  principle (empty is good).
- Each active track's mandatory sections (+tdd Testability Notes, +ai 10, the others 5 or 6) — what goes in each:
  `references/track-checklists.md`.

Doctor warns `design-tradeoffs` / `design-risks` / `design-reuse` (never blocks). Fill `quickstart.md` (a manual
acceptance scenario) and `checklist.md`. Simplicity over cleverness, consistency with the codebase; present for approval.

## Phase 3 — Test plan and eval plan (track-conditional)

- **+tdd → `test-plan.md`.** Every test enumerated (≥ 1 per AC; a negative test for every IF…THEN; boundary tests),
  each with a stable ID (`T-01`) mapped to AC IDs, a layer (unit / integration / E2E, following the pyramid) and a
  **Kind**: `example` (one concrete case — WHEN / IF…THEN) or `property` (an invariant over generated inputs —
  ubiquitous, WHILE, "never / for every" rules like tenant isolation). The Coverage Check shows every AC in ≥ 1 row
  (a Gaps note is no coverage).
  Approve before writing test code. `references/test-patterns.md`.
- **+ai → `eval-plan.md`.** Golden, adversarial and regression sets, grading per set, explicit ship thresholds and a
  baseline from a minimal v1 prompt before implementing. `references/eval-suite-patterns.md`.

A feature with both tracks has both artifacts.

## Phase 4 — Failing tests and eval harness (the hard gate)

- **+tdd:** write every planned test; each must exist and fail for the right reason (an assertion /
  NotImplementedError — not a typo or a missing import). Scaffold only stubs and signatures so the tests compile — no
  business logic. Confirm: N written, N red, 0 green, 0 erroring. Put the T-ID in each test's name (`test("T-01 …")`,
  `def test_T01_…`) and run `trace_check {code: true}`: every planned T-ID found in the test code. Commit
  `test(<feature>): scaffold failing tests …`.
- **+ai:** deterministic tests AND the eval harness (the bundled local one: the user's `/eval`; `--dry-run` offline);
  record the baseline and commit it.

The gate is tracked: with a test or eval plan, phase `tests` is pending — `spec_next_action` asks for it before the
tasks approval and never recommends implementing until the user signs it off (`spec_approve {phase: "tests"}` checks
`tests-in-code` / `eval-sets`).

## Phase 5 — Tasks

Break the design into tasks of ~30 min–2 h, organized by user story (P1 first): `Setup`, `Foundational` (blocks all
stories), one phase per story (`Story US-1 (P1)`, …) ending with a `**Checkpoint:**` line where it is independently
testable, then `Polish`. Tag each task with its story (`[US1]`, or `[shared]`) and `[P]` when it can run in parallel
(different files, no dependency) — `[US1][P]`. Numbers ARE the order; stories that aren't independent were mis-sliced.

Markers: always `_Requirements: US-1.AC-1, US-1.AC-2_` and `_Verify: <command that proves it>_` (no pipe: a pipeline
reports its LAST command's exit code) · `_Expect: fail_` on a task that writes a test before its code (its failing run
is the proof; a pass is refused, `unexpected-pass`) · optional `_Size: XS|S|M|L|XL_` (1/2/3/5/8 points — the roadmap's
velocity and ETA) · optional `_Depends: 3, 5_` (tasks that must be done first; doctor fails `task-deps` on an unknown
number or a cycle; without it tasks.md order is the order) · per track: `references/track-checklists.md`.

Run `trace_check`: every AC maps to ≥ 1 task (on +tdd also to the test plan; every planned T-ID should map to a task).
Keep task numbers unique and replace every scaffold placeholder task (the tasks gate refuses them). Present for review.

## Phase 6 — Execute: what the engine enforces

- Evidence (`references/verification.md`): a piping `_Verify:_` is flagged (`verify-pipes`); project checks (`spec_init
  {checks}`) need a passing run since the last tick before finishing; with `evidence: "observed"` only a run the
  harness saw (or `done --run`) verifies.
- Track-gated "done" checks before a feature is finished (load test, cost and safety, scans, subject rights, failure
  injection, contract tests, accessibility, a staged alert…): `references/track-checklists.md`; `spec_finish` lists them.
- Before finishing, optionally a simplification pass: behaviour-preserving cleanups proven by the tests
  (`references/code-reuse-and-quality.md`).
- A +tdd task's evidence: its target tests' command and exit code, "T-xx green" and the suite tally; the full suite
  leaves the targets green, the earlier green still green and the later tasks' tests still red.
- A +ai prompt task: announce the baseline first; the evidence is the harness command, its exit code and the scores
  with their delta against the baseline; commit with that delta.
- The user steers execution with "implement" / "next" · "implement N" · "continue" · "status" · "pause".

## At every gate

Present (1) what was produced · (2) key decisions + rationale · (3) tracks / sections affected · (4) risks to review ·
(5) the `spec_doctor` verdict · (6) the next step — then ask for approval. Keep it tight.

`spec_next_action` gives ONE next step, in this order: re-review what changed since an approval → the first phase not
approved yet (fill → fix what its gate would refuse → approve) → fix → implement → verify an unverified tick → finish
(then `finished`, or `drift` to decide on).

## Environments

- **Claude Code / Cowork:** full support (the local MCP server, the hooks, git).
- **claude.ai:** present the artifacts in code blocks to copy; the MCP server and test / load / eval runs need a real
  environment — describe the expected results, and never tick a task on a run nobody made.
