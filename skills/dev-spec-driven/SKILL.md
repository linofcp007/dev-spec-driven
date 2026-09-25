---
name: dev-spec-driven
description: >
  Spec-driven development with approval gates: EARS requirements, technical design, traceable tasks,
  then execution (inline or with subagents). This skill should be used when the user wants to plan or
  scope a non-trivial feature before coding, fix a bug with root cause + regression test, adopt specs
  in an existing codebase, or manage a feature roadmap. Per-feature tracks: +tdd (tests first), +saas
  (multi-tenant scale, observability, load tests, cost), +ai (evals, prompt versions, token cost,
  safety). Triggers: "spec this", "plan this feature", "implementation plan", "break into tasks",
  "tests first", "production-ready", "spec this AI feature"; PT "especificar", "plano de
  implementação", "dividir em tarefas", "antes de começar a programar"; ES "especificar", "plan de
  implementación", "dividir en tareas", "antes de empezar a programar". Not for trivial edits,
  requirements.txt, or code that merely calls eval() or an LLM.
---

# Dev Spec-Driven (unified, track-based)

Take the developer from idea to production-ready code through a disciplined, approval-gated process,
and **scale the rigor to the feature**, not the other way around. One feature is a 20-minute Vibe
edit; the next is a billing webhook in a multi-tenant product that also calls an LLM and needs TDD +
scale design + evals at once. Handle both with one pipeline and composable tracks:

| Track | What it adds |
|---|---|
| **core** *(always)* | EARS requirements → design → tasks → execute, with approval gates |
| **+tdd** | Test plan + failing-tests-first + red-green-refactor execution |
| **+saas** | 5 mandatory scale sections, multi-tenancy, observability, cost, load tests |
| **+ai** | Eval plan, prompts-as-code, token economics, safety, model lifecycle |

## Language (EN / PT / ES)

This skill is **trilingual**. Detect the language of the user's request and **mirror it** in
everything: your conversation, the questions you ask, the approval prompts, AND the prose inside the
artifacts (`requirements.md`, `design.md`, `tasks.md`, `classification.md`) — **including the section
headings** (e.g. `## Critérios de Sucesso`, `## Verificação da Constituição`, `## Orçamento de
Desempenho`). The engine recognizes the mandatory section headings in EN/PT/ES, so a fully-localized
spec still passes `doctor`/`clarify`. Don't switch the user to English.

**The engine scaffolds in the user's language — pass `lang`** on `spec_init` (project default) and
`spec_create` (per feature; explicit `lang` > project default > en). Artifacts, steering stubs and every
tool message then come out localized — fill the placeholders, don't translate the scaffold.

Keep these **structural tokens stable across languages** (the tooling matches them literally): AC/SC
IDs (`US-1.AC-1`, `SC-001`), test IDs (`T-01`), task markers (`_Requirements:_`, `_Makes green:_`,
`_Implements:_`, `_Verify:_`), story/parallel tags (`[US1]`, `[shared]`, `[P]`), track names, and the
`[NEEDS CLARIFICATION:]` marker. EARS keywords may be localized (they're detected in all three).

If the user mixes languages or asks to switch, follow their lead. When unsure, match the language of
their most recent message.

## Core Principles

1. **No implementation without approval.** Each phase produces an artifact the developer reviews.
   Misunderstandings get caught early, when they're cheap.
2. **Right rigor for the job.** Tracks compose per feature. Don't TDD a copy change; don't ship a
   payment path on vibes.
3. **Traceability end-to-end.** Code → tasks → (tests/evals) → design → requirements → need. Every
   acceptance criterion has a stable ID that later artifacts reference.
4. **The mandatory sections are mandatory.** On +saas and +ai, the scale/AI design sections cannot
   be blank. An honest "not needed because X" is fine; an empty section means "I didn't think
   about it" — the source of every 3AM incident and every surprise bill.
5. **Everything is local.** The bundled MCP server runs on your machine. No GitHub Actions, no
   cloud runners, no per-run cost. Specs live in `.specs/` and are versioned in your git repo.
6. **Evidence before claims.** Nothing is "done", "passing" or "fixed" until a command proved it on the
   final code. Tick tasks only through `spec_complete_task {evidence}` — never by editing the checkbox.
   A task whose `_Verify:_` names a runnable command counts as verified only with `{command, exitCode: 0}`;
   a text note ticks it but leaves it unverified; a failed run is recorded and refuses the tick; evidence goes
   stale when the spec it proved changes (`references/verification.md`). The thoughts that
   precede skipping a phase are listed in `references/red-flags.md`.
7. **An approved spec that changed is not approved.** Every approval snapshots what it signed off; an edit
   afterwards is diffed (`spec_impact`), reviewed with the human and re-approved — never silently shipped.

---

## The local MCP server (use it — it's free and offline)

The bundled zero-dependency MCP server **`spec-driven`** does the mechanical work; prefer it over
hand-rolled edits for the structural steps. Which tool when:

- **Start:** `spec_classify` (Phase 0 draft) → `spec_init` (steering; opt-in `guard`) → `spec_create` (one feature; `kind: "bugfix"` for a defect, `brownfield: true` in existing code) — or `spec_import` (a Kiro / spec-kit / OpenSpec spec).
- **Gates:** `ears_validate` · `spec_clarify` · `trace_check` (`code: true` → T-IDs in test files) · `spec_doctor` (one "ready to advance?" verdict) · `spec_approve` (refused while the phase's checks fail) · `spec_next_action` (you are here, one ordered next step).
- **Execute:** `spec_next_task` · `spec_task_brief` · `spec_complete_task {evidence}` · `spec_append_tasks` (converge) · `spec_finish`.
- **Change & after:** `spec_impact` (an edit after approval → what it touches; reopen) · `spec_drift` · `spec_metrics` · `spec_catalog`.
- **Project:** `spec_list`/`spec_status` · `spec_roadmap`/`spec_depend`/`spec_backlog` · `spec_add_track`/`spec_feature` · `spec_scan`/`spec_coverage` (brownfield) · `steering_scaffold`.

Full tool table: `references/tooling-reference.md`. The tools produce **skeletons and checks** (never
overwriting your files); *you* fill them with real content from the `references/` templates. No MCP
connection (e.g. claude.ai)? Write the files by hand.

---

## First Things First: Mode, then Tracks

### Vibe Mode — Just Build It
Use when the user says "just do it", "quick fix", "nothing fancy"; the task is a trivial fix, small
tweak, copy change, or single-file change; it's < ~30 min; or they already know exactly what they
want. Skip all artifacts and tracks. Solve the problem. If it grows complex, offer to switch.

### Bounded Mode — Short Design, Explicit Yes
A well-scoped change to a flow that **already exists in this repo** (a new flag, a small endpoint, a
one-file behaviour change). Ask only the questions that matter, present a short design **in chat** (a
few sentences, the files you'll touch, how you'll verify it), and STOP until the user says yes — that
approval is as binding as a phase gate. No artifacts. If there's no existing flow to change, it isn't
bounded. **The ratchet is one-way:** hidden complexity found mid-task upgrades the mode (Vibe → Bounded
→ Spec), never the reverse.

### Bugfix — a real defect
Something that worked (or is specified to work) and doesn't. Use the **bugfix flow** (`/spec-bugfix`):
a light spec whose order is fixed — reproduce → root cause with evidence → failing regression test → fix
→ verify. Details under Supporting Workflows and in `references/bugfix.md`.

### Spec Mode — Plan First, Then Build
Everything else. Spec Mode always begins with **Phase 0: Classification**, which selects the
composable track set for this feature. Then it runs the pipeline below, with the track-conditional
phases switched on or off. Internal-improvement work (refactor, coverage, a complexity hotspot) is Spec
mode too, with a re-measurable metric delta as its acceptance criterion: `references/improvement-specs.md`.

If unsure which mode: casual language → Vibe; a contained change to a flow that already exists →
Bounded; a real defect → bugfix (`/spec-bugfix`); formal/complex/"system"/"integration"/"properly" →
Spec. Say the mode out loud so the user can override it; when in doubt between two, take the heavier
one. Switch anytime: "let's vibe" → Vibe; "spec this" → Spec from Phase 0. If a Vibe session sprouts a
tenant boundary, a payment path, or an LLM call, say so and offer to classify.

### Brownfield — adopt SDD in an EXISTING codebase
When the project already has code (no `.specs/` yet, or "document/spec our existing app"): **scan**
(`/scan`, `spec_scan`) → **infer steering + a constitution that acknowledges the existing patterns** →
reverse-engineer specs for the core modules, describing what the code does *today* (`/reverse`) →
**coverage** (`/coverage`, `spec_coverage`: the share of code files named by `_Implements:_`) → spec new
features integration-aware (`spec_create {brownfield: true}` → `integration-plan.md`, `_Implements:_`). The scan
lists routes, tests, entrypoints, env var names and migrations. Specs already written for Kiro, spec-kit or
OpenSpec come in with `/spec-import` (IDs remapped to `US-N.AC-M`; confirm the tracks, then the normal gates).
Adopt incrementally; prove value on one module first. Full flow, strategies and import mappings:
`references/brownfield.md`.

---

## Directory Structure

All artifacts live in `.specs/` at the project root: `steering/` (shared context, per active track),
`roadmap.json`, and one folder per feature — `classification.md`, `requirements.md`, `design.md`,
`tasks.md`, `quickstart.md`, `checklist.md`, plus `test-plan.md` + `tests/` (+tdd), `eval-plan.md` +
`prompts/` + `evals/` (+ai) and `load-test.md` (+saas); `integration-plan.md` (brownfield), `bug.md` (bugfix),
`retro.md`, and `.history/` (approval snapshots — commit them). Generated at the root: `ROADMAP.md` and the
living catalog `SPECS.md`. Annotated tree: `references/tooling-reference.md`.

### Steering Files
Before any spec work, read whatever exists in `.specs/steering/`. Steering depends on the tracks, so
missing files are created **after Phase 0 approval** (see Phase 0, step 4); add a track's steering file
(`steering_scaffold`) the first time a later feature pulls in that track. They're short and
dramatically improve every downstream spec; one still full of template placeholders steers nothing (`spec_doctor`
names it). **Scoped steering:** rules for one area go in a custom file (`steering_scaffold {file:
"api-conventions.md"}`) whose front matter says when a task brief includes it — `inclusion: always`,
`fileMatch` (+ `fileMatchPattern: "src/api/**"`, matched against the task's `_Implements:_` paths) or `manual`.
Templates and inclusion modes: `references/steering-templates.md`.

**`constitution.md` is core (always).** It holds the project's non-negotiable principles
(e.g. "every write is idempotent", "no PII in logs", "errors fail closed"). Every design carries a
**Constitution Check** section; `spec_doctor` only checks that the section is there (the design approval also
refuses it empty). Whether the design
actually honours each principle is judged by the human at the gate and by the `spec-critic` agent
(`/spec-doctor --deep`); `/prReview` checks the code against it. Keep the principles few, concrete, and
testable.

---

## Phase 0: Classification (`/classify`)

Decide the mode, then the track set. This is fast (5–10 min) and saves days of wrong-rigor work.

1. **Run `spec_classify`** with the feature description to get a recommended track set + the
   keyword signals that triggered each track. Treat it as a draft, not gospel.
2. **Sanity-check against the matrix** in `references/classification-matrix.md`. The rule of thumb:
   - `+tdd` if correctness matters or it's hard to undo (billing, auth, data integrity, tricky logic).
   - `+saas` if it's multi-tenant, hot-path, background, an external contract, hard to rollback, or cost-sensitive at scale.
   - `+ai` if quality depends on LLM/agent/embedding output, or user input reaches a model.
   - **When unsure, turn the track on.** Under-investing on a critical feature is far more expensive than over-investing on a simple one.
3. **Present for approval:** mode, active tracks, the signals, blast radius, and (per track) hot-path /
   autonomy / volume / compliance. If the user disagrees with the track set, adjust it now.
4. **After Phase 0 approval:** `spec_init {tracks, lang}` if steering is missing, then
   `spec_create {name, tracks, lang}` **once** — it seeds `classification.md` (record the fields from
   step 3 there) and every artifact skeleton the tracks need, and persists the track set and language in
   `.state.json` (change tracks later with `spec_add_track`, `--remove` to drop one). Record the gate with `spec_approve`.

Worked examples: `references/classification-examples-saas.md`, `references/classification-examples-ai.md`.

---

## Phase 1: Requirements (`/createSpec`)

Transform the idea into formal, testable requirements in **EARS** syntax with **stable AC IDs**
(`US-1.AC-1`, `US-1.AC-2`, …). Those IDs are the backbone of traceability — tests, tasks, commits,
dashboards, and alerts all reference them, so assign them even on the lightest track.

**Prioritize the user stories and make each independently shippable.** Label them **P1 / P2 / P3**
where **P1 is the MVP** that delivers value on its own; give each a one-line *Independent Test*.
Add a **Success Criteria** section with measurable, **technology-agnostic** outcomes
(`SC-001`, … — e.g. "90% complete checkout in <30s") — these sit alongside the EARS ACs (system
behavior), not instead of them. Give edge cases and NFRs stable IDs too (`EC-1`, `NFR-1`) — `trace_check`
warns when no task or test covers them. **Mark any ambiguity inline** with `[NEEDS CLARIFICATION: question]`;
**the design phase is gated — it cannot start while any such marker remains** (`spec_doctor` fails
the `clarifications` check until they're resolved). Replace every template placeholder: the gates treat a
scaffold that is still a template as unwritten (`placeholders` check; approval refused).

Steps: read steering → ask clarifying questions (don't guess) → fill the scaffolded `requirements.md`
→ run `ears_validate` to catch missing SHALL / missing IDs / vague words → **run `spec_clarify`**
(`/clarify`) to surface remaining gaps (vague terms, leftover placeholders, missing
edge-cases/NFR/out-of-scope, missing IF…THEN failure paths, and track-specific gaps like tenant
isolation or AI quality/cost) and ask the user those questions → for a deeper, one-question-at-a-time
interrogation of the understanding behind the text, offer `/grill` → present for approval.

### EARS Quick Reference
| Pattern | Keyword | Example |
|---|---|---|
| Ubiquitous | _(none)_ | The system shall respond within 500ms at P95. |
| State-driven | WHILE | While offline, the app shall queue changes locally. |
| Event-driven | WHEN | When a user clicks submit, the system shall validate. |
| Optional | WHERE | Where SSO is configured, the system shall skip the password step. |
| Unwanted | IF…THEN | If the password fails 5 times, then the system shall lock the account for 15 minutes. |

PT: QUANDO / ENQUANTO / SE…ENTÃO / ONDE · O SISTEMA DEVE — ES: CUANDO / MIENTRAS / SI…ENTONCES / DONDE ·
EL SISTEMA DEBE (all pass `ears_validate`). Compound order: WHILE → WHEN → IF. Every criterion must be
testable and specific — no "fast", "user-friendly"; use concrete values. Full reference: `references/ears-guide.md`.

### Track-specific ACs to always consider
- **+saas:** tenant isolation (`WHEN a user from tenant A requests data, THE SYSTEM SHALL NOT
  return any record whose tenant_id != A`), rate limits, abuse/fair-use, auth boundary per role,
  audit trail, latency target.
- **+ai:** output-quality target (% on golden set), latency target (time-to-first-token), cost
  ceiling ($/request), refusal behavior, hallucination boundary ("say I don't know"), prompt-
  injection resistance, fallback model, per-call audit logging.
- **+tdd:** make sure every AC is concrete enough to become a failing test — if it can't, rewrite it.

---

## Phase 2: Design (`/design`)

Convert approved requirements into a technical blueprint. Re-read steering + requirements, scan the
existing codebase for patterns to match, then write `design.md`.

**Base sections (always):** Overview · Architecture (≥1 Mermaid diagram) · Data Models · API
Contracts · Security · Error Handling · Testing Strategy · **Constitution Check** (verify the design
against each principle in `steering/constitution.md` — a gate, re-checked after any change) ·
**Complexity Tracking** (justify anything that violates a principle or adds non-obvious complexity;
empty is good). `spec_create` always scaffolds `quickstart.md` (a manual acceptance scenario a human
can run) and `checklist.md` (the track-aware quality checklist) — fill both alongside the design. For
larger features, optionally split research into `research.md` (decisions + rationale).

**+tdd adds:** Testability Notes (seams, determinism, side effects to isolate, test-data strategy).

**+saas adds 5 mandatory sections** — none may be blank:
1. Performance Budget (P50/P95/P99, max query time, memory, throughput)
2. Scale Design (concurrent users over time, data growth, hot paths, caching, queues, indexes, sharding)
3. Multi-tenancy Model (isolation model, tenant_id enforcement, noisy-neighbor protection, export/delete)
4. Observability (named metrics, structured logs, traces, alerts→thresholds→who, dashboards)
5. Cost Envelope ($/1000 users/month, cost-critical paths, cost metric + alert)
See `references/scale-design-template.md` and `references/saas-patterns.md`.

**+ai adds 10 mandatory sections** — Model Strategy · Prompt Architecture · Token Economics ·
Latency Budget · Eval Strategy · Safety & Abuse · Fallback & Degradation · Observability for AI ·
Model Lifecycle · Multi-modality. See `references/mandatory-ai-design-sections.md`,
`references/prompt-engineering-patterns.md`, `references/model-provider-guide.md`,
`references/ai-cost-modeling.md`, `references/ai-safety-patterns.md`.

Design principles: simplicity over cleverness, consistency with the codebase, reach for known
patterns over novelty. Present for approval before proceeding.

---

## Phase 3: Test Plan & Eval Plan (`/testPlan`, `/evalPlan`) — track-conditional

**+tdd → Test Plan.** Enumerate every test (≥1 per AC; negative tests for every IF/THEN; boundary
tests). Each test gets a stable ID (`T-01`) mapped to AC IDs, a layer (unit/integration/E2E)
following the pyramid, and a **Kind**: `example` (one concrete case — event-driven WHEN / IF…THEN) or `property`
(an invariant over generated inputs — ubiquitous, WHILE, "never / for every" rules like tenant isolation).
The Coverage Check section must show every AC appears in ≥1 test. On +saas,
add tenant-isolation, rate-limit, idempotency, authorization-matrix, and audit-log tests. Approve
before writing test code. References: `references/test-patterns.md`.

**+ai → Eval Plan.** Build three sets: **golden** (50–200 representative inputs with expected
quality), **adversarial** (injections, jailbreaks, out-of-scope, unsafe-elicitation, degenerate
inputs — should refuse/degrade), **regression** (every fixed production bug, grows forever). Choose
grading per set (exact match / schema / LLM-as-judge with rubric / human). Set explicit ship
thresholds (e.g. golden ≥85%, adversarial safety 100%, regression 100%). Record a **baseline** from
a minimal v1 prompt before implementing. References: `references/eval-suite-patterns.md`.

A feature with both tracks has both artifacts.

---

## Phase 4: Failing Tests + Eval Harness (`/writeTests`) — track-conditional, the hard gate

**+tdd:** Write every planned test. Each must exist and **fail for the right reason** (assertion /
NotImplementedError, not a typo or missing import). Scaffold only stubs/signatures so tests
compile — no business logic. Confirm: N written, N red, 0 green, 0 erroring. Put the T-ID in each test's
name (`test("T-01 …")`, `def test_T01_…`) and run `trace_check {code: true}` (`dev-spec trace <f> --code`):
every planned T-ID found in the test code. Commit
`test(feature): scaffold failing tests …`. **No implementation code until this gate is approved.**

**+ai:** Write deterministic tests (validation, schema, rate limiting, logging, fallback, cost
circuit breaker) AND implement the eval harness (loads sets → runs through prompt+model → grades →
scores per set → fails below threshold); the bundled local harness runs with `/eval` (the user's own
API key; `--dry-run` offline). Establish and record the baseline. Commit
`test(feature): eval harness + baseline (golden 73%, adversarial 96%)`.

---

## Phase 5: Tasks (`/createTask`)

Break the design into tasks (~30 min–2 h each). **Organize by user story (P1 first)** so each story
is independently shippable: a `Setup` phase, a `Foundational` phase (blocks all stories), then one
phase per story (`Story US-1 (P1)`, …) ending with a **`**Checkpoint:**`** line where that story is
independently testable, then a `Polish` phase. Within a story keep track-aware ordering (foundation
→ logic → API → UI → observability → load/eval). **Tag every task with its story:** `[US1]`/`[US2]`
for story work, `[shared]` for cross-cutting/foundational/setup/polish — so membership is obvious at
a glance (even for shared tasks). Mark **`[P]`** on tasks that can run in **parallel** (different
files, no dependencies); the tag order is `[US1][P]`. Numbers ARE the order; 2–4 sub-steps each.

**Why by story:** it serves both readers — a non-technical/product reader maps tasks straight to the
value slices they read in the user stories, and a technical reader still gets build-order *within*
each story plus explicit `[P]`/dependency markers. **Fallback:** if the stories are NOT genuinely
independent (you can't ship P1 without most of P2's infra), that's a sign they were mis-sliced —
re-slice them; or, for a genuinely monolithic feature, use a technical-layer layout
(Foundation→Logic→API→…) while keeping the `[US1]` tags on each task.

Traceability markers per task:
- Always: `_Requirements: US-1.AC-1, US-1.AC-2_` and `_Verify: <command that proves it>_`
- +tdd: `_Makes green: T-01, T-02_`
- +saas: `_Emits metrics: req_duration_ms{feature=X}_` + an observability task + (hot path) a load-test task
- +ai: `_Affects evals: golden (maintain baseline)_` + a separate task per prompt change + a cost-monitoring task
- brownfield/integration: `_Implements: path/to/file_` to tie a task to a real source file (checked by `trace`)

Run `trace_check` after writing tasks: every AC must map to ≥1 task (and, on +tdd, the test plan;
every planned T-ID should map to a task). Keep task numbers unique and replace every scaffold placeholder task
(the tasks gate refuses them). Present for review. Work found after approval is appended, never renumbered in
(`spec_append_tasks`, below).

---

## Phase 6: Execute (`/executeTask`)

Before any code, re-read steering, requirements, design, (test/eval plans), and tasks; summarize
your understanding to confirm alignment. Then work tasks **in order**, choosing the loop per task:

- **core task (no +tdd):** announce → implement per design → run existing tests and the task's
  `_Verify:_` → `spec_complete_task {evidence}` → report.
- **+tdd task:** announce target tests → confirm red for the right reason → write the *minimum* code
  to green them → run the **full** suite (targets green, prior green still green, future-task tests
  still red) → refactor on green → `spec_complete_task {evidence}`: the command that runs this task's
  target tests + its exit code, and in the summary "T-xx green" plus the full-suite tally.
- **+ai generation/prompt task:** announce baseline → edit prompt in a **new** `prompts/vN.md` →
  run the full eval harness (`/eval`) → accept only if golden improved/held and adversarial held;
  otherwise revert/investigate → `spec_complete_task {evidence}`: the harness command + its exit code,
  and the eval scores with their delta vs baseline in the summary → commit with that delta.

Track-gated "done" checks before a feature is finished:
- **+saas hot path:** run the load test from `load-test.md`; measured P50/P95/P99 must meet the
  budget. If missed, root-cause (profile, queries, cache hit rate) and fix — don't silently accept a
  regressed budget. References: `references/load-testing-patterns.md`.
- **+saas:** observability validation — metrics actually emitting, logs appearing, alerts
  configured, dashboard exists. Code ≠ proven; verify.
- **+ai:** cost validation (real token usage within ~20% of design projection) and safety
  validation (full adversarial set, 100% on safety-critical categories, human spot-check of ~20
  outputs).

If blocked, pause and discuss — don't improvise outside the design. If a test/measurement reveals a
gap, go back to that phase, not the implementation. If a "green" test is actually wrong, pause,
explain, fix the plan with approval, rerun — never quietly edit a test to pass.

### Execution strategy: inline (default) or subagents (opt-in)

**Inline** is the loop above: you implement every task in this session. **Subagents**
(`/executeTask <feature> --subagents`, or when the user asks) keeps your context for coordination: per
task you write a brief with `spec_task_brief {name, number, write:true}`, dispatch the plugin's
**`dev-spec-driven:spec-implementer`** agent with the brief path, send its diff to the **`dev-spec-driven:spec-reviewer`** agent
(verdict per AC ID + quality + track checks), run a fix loop of at most 5 rounds, and only then call
`spec_complete_task`. Offer it for features with ~6+ mostly independent tasks. It costs roughly 2–3× the
tokens. Invariants:
- you (the controller) never write feature code; `tasks.md` `[x]` means *implemented and reviewed*;
- run continuously within a story, but **stop at every `**Checkpoint:**`** for human review;
- any finding that would change an AC, the design or a planned test goes **back to that phase**. Never
  rule on it yourself;
- +ai prompt/eval tasks (`inlineOnly` in the brief) stay inline;
- hosts without subagents (Cursor, Windsurf, Copilot, Gemini, claude.ai) use inline, and can still use
  `dev-spec brief` to focus each task.

Full protocol (preconditions incl. a green baseline, ledger, review packages, fix loop, model selection,
final review): `references/subagent-execution.md`.

### Converge pass (`/spec-converge`)

When implementation drifted, a review found follow-up work, or every task is ticked but you doubt every AC is
delivered: dispatch `dev-spec-driven:spec-reviewer` in **converge** mode (or run its checklist inline) — the
whole feature, AC by AC: implemented where? tested by what? It proposes the missing work as tasks; gaps that
need a different AC or design go back to their phase instead. **The human approves the list**, then
`spec_append_tasks` adds them under "Phase: Convergence" (existing tasks untouched), you re-approve the tasks
phase and execute them with evidence.

### User commands during execution
"implement"/"next" (next task) · "implement N" (jump) · "continue" (resume) · "status" (progress +
test/eval state) · "pause" (stop after current task).

---

## Gates (`/spec-doctor`, `/approve`, `/next-action`)

Before advancing a phase, run `/spec-doctor` (the `spec_doctor` tool): EARS lint, template placeholders,
traceability (+ EC/NFR/SC warnings), steering (present and filled), design + Mermaid + Constitution Check
section, per-track mandatory sections present AND filled (no leftover `TODO` sentinel), verification evidence,
duplicate task numbers, artifacts changed since their approval, and the **approval gates** (`gatesOk`,
`pendingGates`, forced approvals) → a `readyToAdvance` verdict.
`--deep` adds a semantic review by the `dev-spec-driven:spec-critic` agent (completeness,
contradictions, ambiguity, testability, scope, YAGNI) — what structural checks can't see. When the user
signs off, record it with `/approve <feature> <phase>` (auditable, resumable, in `.state.json`). **The approval
is a gate:** that phase's checks run first and any failure refuses it, naming the failing checks. `force: true`
(`--force`) records it anyway as a *forced* approval — only when the user explicitly accepts the failures; doctor,
the roadmap and the metrics keep showing it. Lost? `/next-action <feature>` gives ONE next step in the chain's
order — fill the first unwritten artifact → re-review what changed since approval → fix the current phase's
failing checks → approve → implement the next task → finish.

At every gate present: **(1) what was produced · (2) key decisions + rationale · (3) tracks/sections
affected · (4) risks to review · (5) the `spec_doctor` verdict · (6) next step** — then ask for
approval. Keep it tight.

---

## After approval: changes, drift, metrics

- **Change request (`/spec-impact`).** Every approval saves a snapshot (`.history/<phase>@<n>.md`) and joins
  `approvalHistory`. An approved artifact edited later is flagged everywhere (`changed-since-approval`;
  `next_action` → re-review; `spec_finish` blocks). `spec_impact` diffs it against the snapshot — ACs (by ID),
  design sections or tasks — and lists the tasks, tests and design sections each change reaches. Show that to the
  user; only with their OK, `reopen: true` unticks the affected done tasks, marks their evidence stale and records
  the change request (`state.changes`). Then update what the change reaches and re-approve (a new snapshot).
- **Superseding.** A later feature that replaces an earlier criterion marks its new AC
  `_Supersedes: <feature>/US-n.AC-m_` instead of rewriting finished specs. `/spec-catalog` (`spec_catalog
  {write: true}`) keeps `.specs/SPECS.md` — every feature and AC, superseded ones marked — current.
- **Drift (`/spec-drift`).** `spec_finish {write: true}` on a ready feature records a hash of every
  `_Implements:_` file; `spec_drift` (and a session-start line) reports what changed since. Decide with the user:
  update the spec (`/spec-impact`, or a new feature with `_Supersedes:_`), fix the code, or accept and re-baseline.
- **Metrics & retro (`/spec-metrics`).** Lead times, rework, forced approvals, change requests, evidence pass rate;
  `--write` drafts `retro.md` after finish — its steering/constitution amendments are proposals, never applied.
- **Archive, don't delete.** `/feature archive` is reversible (`restore` puts the roadmap deps back).

Depth: `references/change-management.md`.

---

## Supporting Workflows

| Command | What it does | Reference |
|---|---|---|
| `/spec-bugfix` | A defect as a light spec (`spec_create {kind:"bugfix"}`): `bug.md` + a one-story `IF … THEN THE SYSTEM SHALL …` requirement + regression test plan; `spec_doctor` fails, the design approval (it signs off `bug.md`) is refused and every task after the root-cause task is refused until the root cause is written with evidence. After three failed fixes, question the design. | `references/bugfix.md` |
| `/spec-finish` | Blockers (doctor fails, open tasks, tasks without a passing run, pending approvals, artifacts changed since approval, placeholders, a missing root cause) and warnings, the checks to run fresh, a merge title + summary built from the spec chain, and the drift baseline. The user then merges locally or keeps the branch — no pull requests, no CI; never merge or push on your own. | `references/verification.md` |
| `/spec-impact` · `/spec-converge` · `/spec-drift` · `/spec-metrics` · `/spec-catalog` | Change requests, the AC-by-AC converge pass, drift since finish, metrics + retro, the living catalog (sections above). | `references/change-management.md` |
| `/spec-import` | A Kiro / spec-kit / OpenSpec spec → a NEW feature (IDs remapped, `mapping` + `warnings` shown); then Phase 0 track confirmation and the normal gates. | `references/brownfield.md` |
| `/spec-guard` | Opt-in guard mode (`spec_init {guard: true}`): in Claude Code, a PreToolUse hook asks before a code edit while no feature has approved, unfinished tasks; silent otherwise. | — |
| `/spec-review-feedback` | Every review comment judged against the spec: fix AC violations, send spec changes back to their phase, push back on out-of-scope asks citing `Out of Scope`, ask about unclear ones. | `references/review-feedback.md` |
| `/prReview` | Local pre-merge review gated by tracks: spec compliance + constitution · +tdd red-first history, every AC tested · +saas tenant isolation (`WHERE tenant_id = ?`), observability, hot-path cost · +ai eval delta in the commit / merge summary, versioned prompts, PII-to-model · security. | — |
| `/spec-commit` | Conventional commit referencing the task, `Makes T-xx green`, the eval delta and emitted metrics; Phase-4 commits use `test:`. | `references/tooling-reference.md` |
| `/promptReview` (+ai) | Prompt changes are blocked without eval results (golden up, adversarial held, version bumped, cost delta noted). | `references/eval-suite-patterns.md` |
| `/migrateModel` (+ai) | Eval-gated only: run the current sets on the new model, switch only if equal-or-better (or tune the prompt to recover), record it in Model Lifecycle. Never migrate blind. | `references/model-provider-guide.md` |
| `/add-track` · `/feature` | Escalate a feature to +tdd/+saas/+ai (additive, never overwrites; `remove: true` / `--remove` takes a track off without deleting files). Archive (reversible, preferred) · restore · rename (deps follow) · remove (destructive: needs `confirm: true` / `--yes`, confirm with the user first). | `references/tooling-reference.md` |
| `/roadmap` · `/depend` · `/backlog` | Order and dependencies between features (cycles rejected), %, blocked status, planned-but-unspecced work. Don't start a feature whose dependencies aren't met without saying so. `.specs/ROADMAP.md` is regenerated automatically — never hand-edit it. | `references/tooling-reference.md` |
| `/spec-status` | Mode, tracks, phase, task progress, test/eval state, section completeness (`spec_status` / `spec_list`). | — |

**Local automation, not CI:** saving `requirements.md` lints EARS (and names leftover placeholders), saving
`tasks.md` checks traceability, saving `design.md` checks the active tracks' mandatory sections and the
Constitution Check; session start prints feature status plus a line per finished feature whose files drifted;
with guard mode on, a code edit asks first while nothing is approved; the optional `pre-commit` validator blocks
staged EARS errors / phantom refs. Hand security/quality to **dev-guardian** (`/guardian-review`,
`/guardian-scan`) and UI work to **ui-ux-pro-max** when present — route to them, don't duplicate them.

**Commands:** entry `/spec` (alias `/ds`), execute `/executeTask` (`/dsx`), status `/spec-status`
(`/dss`); as a plugin every command is namespaced (`/dev-spec-driven:spec-doctor`). Full table:
`references/tooling-reference.md`.

## Environment Notes
- **Claude Code / Cowork:** full support — the local MCP server scaffolds and tracks, git versions everything.
- **claude.ai:** present artifacts in code blocks for the user to copy; the MCP server and test/load/eval
  runs need a real environment — describe expected results instead of running.

---

## References (read on demand — don't preload everything)
- `references/classification-matrix.md` — track-routing brain (the decision procedure)
- `references/classification-examples-saas.md` / `references/classification-examples-ai.md` — worked examples
- `references/brownfield.md` — adopting SDD in an existing codebase (scan → constitution → reverse-specs → integration) + importing Kiro / spec-kit / OpenSpec specs
- `references/change-management.md` — after approval: snapshots + approval history, `spec_impact` + reopen, `_Supersedes:_`, the SPECS.md catalog, drift, archive/restore, metrics
- `references/improvement-specs.md` — spec'ing internal-improvement work (the metric delta is the acceptance criterion; closes the dev-guardian loop)
- `references/ears-guide.md` — full EARS syntax, all 5 patterns
- `references/steering-templates.md` — all 9 steering-file templates + scoped steering (front matter inclusion modes, custom files)
- `references/tooling-reference.md` — the 29 MCP tools, the CLI, the hooks, command table, annotated `.specs/` tree, roadmap generation, commit format
- `references/verification.md` — evidence before claims: the gate, `_Verify:_`, recorded evidence, unverified reason codes
- `references/bugfix.md` — systematic debugging as a light spec (reproduce → root cause → regression test → fix)
- `references/review-feedback.md` — handling review comments against the spec
- `references/red-flags.md` — the rationalizations that precede skipping each phase
- `references/subagent-execution.md` — Phase 6 with subagents: brief → implementer → reviewer → fix loop, ledger, checkpoints, model selection, converge mode
- `references/example-spec.md` — end-to-end example (requirements → design → test plan → tasks), `core +tdd` auth
- `references/example-spec-combined.md` — worked example with all four tracks (`core +tdd +saas +ai`)
- `references/test-patterns.md` — naming, T-IDs in test names, AAA, table-driven and property-based tests, anti-patterns
- `references/scale-design-template.md` — filled-in 5 mandatory +saas sections
- `references/saas-patterns.md` — caching, queues, rate limiting, idempotency, circuit breakers, multi-tenancy
- `references/load-testing-patterns.md` — k6/Artillery templates, scenarios, interpretation
- `references/mandatory-ai-design-sections.md` — filled-in 10 +ai sections
- `references/eval-suite-patterns.md` — golden/adversarial/regression sets, graders, LLM-as-judge
- `references/prompt-engineering-patterns.md` — RAG, CoT, structured output, tool use, agent loops
- `references/ai-cost-modeling.md` — token counting, pricing math, projection at scale
- `references/ai-safety-patterns.md` — injection defense, jailbreak taxonomy, moderation
- `references/model-provider-guide.md` — Anthropic/OpenAI/Google/OSS, DPA, latency/cost profiles
