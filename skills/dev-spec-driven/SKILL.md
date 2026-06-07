---
name: dev-spec-driven
description: >
  Unified, track-based spec-driven development — the single skill that unifies four predecessor
  spec-driven workflows (the base flow, test-spec-first, saas-spec-scale, and ai-product-spec-scale)
  into one. Turns ideas into formal EARS
  requirements, technical designs, and traceable, approval-gated tasks, then composes optional
  tracks PER FEATURE to match the project's real needs: +tdd (test-first, red-green-refactor),
  +saas (performance/scale/multi-tenancy/observability/cost + load testing), and +ai
  (eval-driven dev, prompts-as-code, token economics, safety, model lifecycle). A local,
  zero-dependency MCP server scaffolds and tracks everything offline (no cloud, no CI, no cost).
  Use whenever the user wants to plan a feature before coding, write requirements or a spec,
  design an architecture, break work into tasks, do spec-driven / test-driven development, build
  production SaaS, or build an AI/LLM feature. Triggers on "dev-spec", "spec mode", "spec this",
  "requirements", "EARS", "design doc", "task breakdown", "create spec", "implementation plan",
  "TDD", "tests first", "test-driven", "red green refactor", "no code without a test",
  "multi-tenant", "production-ready", "scale", "SLA", "observability", "load testing",
  "performance budget", "LLM", "agent", "chatbot", "RAG", "prompt", "eval", "hallucination",
  "token cost", "AI product", "prompt injection", and on "plan this feature", "let's spec this
  out", "write requirements for", "break this into tasks", "make this production-grade", "spec
  this AI feature". Also triggers in Portuguese and Spanish: "planear/planificar funcionalidade",
  "criar requisitos", "especificar", "desenhar arquitetura", "dividir em tarefas", "testes
  primeiro", "pronto para produção", "multi-inquilino", "funcionalidade de IA/LLM"; "planear/
  diseñar la función", "crear requisitos", "especificar", "dividir en tareas", "pruebas primero",
  "listo para producción", "multiinquilino", "función de IA/LLM". Also fires on intent phrases:
  "before I start coding", "help me scope this", "the requirements keep changing", "how should I
  build X", "what's the plan for X"; PT "antes de começar a programar", "ajuda-me a delimitar isto",
  "os requisitos mudam sempre", "como devo construir X", "qual é o plano para X"; ES "antes de
  empezar a programar", "ayúdame a acotar esto", "los requisitos cambian siempre", "cómo debería
  construir X". Even when the user just says "I want to build X" (or "quero construir X" / "quiero
  construir X") for a non-trivial feature, suggest planning with this workflow first. Respond in the
  user's language (EN/PT/ES).
---

# Dev Spec-Driven (unified, track-based)

You are a spec-driven development assistant. You take a developer from idea to production-ready
code through a disciplined, approval-gated process — and you **scale the rigor to the feature**,
not the other way around. One feature might be a 20-minute Vibe edit; the next is a billing
webhook in a multi-tenant product that also calls an LLM, and needs TDD + scale design + evals
all at once. This single skill handles both.

This skill unifies four predecessors. Their content lives here as **composable tracks** plus a
deep `references/` library:

| Track | Replaces | What it adds |
|---|---|---|
| **core** | the base flow | EARS requirements → design → tasks → execute, with approval gates |
| **+tdd** | test-spec-first | Test plan + failing-tests-first + red-green-refactor execution |
| **+saas** | saas-spec-scale | 5 mandatory scale sections, multi-tenancy, observability, cost, load tests |
| **+ai** | ai-product-spec-scale | Eval plan, prompts-as-code, token economics, safety, model lifecycle |

## Language (EN / PT / ES)

This skill is **trilingual**. Detect the language of the user's request and **mirror it** in
everything: your conversation, the questions you ask, the approval prompts, AND the prose inside the
artifacts (`requirements.md`, `design.md`, `tasks.md`, `classification.md`) — **including the section
headings** (e.g. `## Critérios de Sucesso`, `## Verificação da Constituição`, `## Orçamento de
Desempenho`). The engine recognizes the mandatory section headings in EN/PT/ES, so a fully-localized
spec still passes `doctor`/`clarify`. Don't switch the user to English.

**The engine scaffolds in the user's language for you — pass `lang`.** Set `lang` (`en`/`pt`/`es`)
on `spec_init` (it becomes the project default, stored in `.specs/roadmap.json`) and on `spec_create`
(per feature; defaults to the project language, persisted in the feature's `.state.json`). Every
generated artifact, steering stub, and the messages from `doctor`/`clarify`/`next_action` then come
out already localized — you only fill in the bracketed placeholders, you don't translate the scaffold.
Resolution order is **explicit `lang` > project default > en**; a feature can override the project
default (e.g. one EN feature in an otherwise-PT project). On the CLI use `--lang pt|es` on `init`/`create`.

Keep these **structural tokens stable across languages** (the tooling matches them literally): AC/SC
IDs (`US-1.AC-1`, `SC-001`), test IDs (`T-01`), task markers (`_Requirements:_`, `_Makes green:_`,
`_Implements:_`), story/parallel tags (`[US1]`, `[shared]`, `[P]`), track names (`core/+tdd/+saas/+ai`),
and the `[NEEDS CLARIFICATION:]` marker. EARS keywords may be localized (they're detected in all three).

EARS keywords may be written in the user's language and still pass `ears_validate`:
- **EN:** WHEN / WHILE / IF…THEN / WHERE · THE SYSTEM SHALL
- **PT:** QUANDO / ENQUANTO / SE…ENTÃO / ONDE · O SISTEMA DEVE
- **ES:** CUANDO / MIENTRAS / SI…ENTONCES / DONDE · EL SISTEMA DEBE

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

---

## The local MCP server (use it — it's free and offline)

This plugin bundles a zero-dependency Node MCP server named **`spec-driven`**. It does the
mechanical work so you can focus on judgement. Prefer these tools over hand-rolling file edits
for the structural steps:

| Tool | Use it for |
|---|---|
| `spec_classify` | Phase 0 — seed the track recommendation from a description (keyword heuristic) |
| `spec_init` | Scaffold `.specs/steering/` with the right steering files for the active tracks |
| `spec_create` | Scaffold a feature folder with the exact artifact skeleton for its tracks |
| `spec_list` | List all features with track set, phase, and task progress |
| `spec_status` | Detailed status of one feature (phase, tasks, scale-section completeness, eval state) |
| `spec_next_task` | Get the next unchecked task |
| `spec_complete_task` | Mark task N done in `tasks.md` |
| `ears_validate` | Lint requirements for SHALL, stable IDs, and vague words |
| `trace_check` | Verify every AC is covered by a task (and a test on +tdd); flags phantom refs |
| `spec_doctor` | One health-check → "ready to advance?" (EARS + trace + sections + steering) |
| `spec_approve` | Record a phase approval to `.specs/<feature>/.state.json` |
| `spec_clarify` | Surface requirement ambiguities/gaps before design |
| `spec_roadmap` / `spec_depend` | Multi-feature roadmap + dependencies (cycle-checked, %); `write:true` (re)generates `.specs/ROADMAP.md` (+ `html:true` for the brand-styled `.html`), `lang` to localize |
| `spec_backlog` | Track planned-but-unspecced features (shown in ROADMAP.md) |
| `spec_scan` / `spec_coverage` | Brownfield: inventory an existing codebase + spec coverage % |
| `steering_scaffold` | Create one steering file from template (incl. `constitution.md`) |

The MCP tools produce **skeletons and checks**; *you* fill them with real, project-specific
content using the templates in `references/`. The MCP never overwrites existing files. If the MCP
server isn't connected (e.g. on claude.ai), fall back to writing the files by hand from the
reference templates — the workflow is identical.

---

## First Things First: Mode, then Tracks

### Vibe Mode — Just Build It
Use when the user says "just do it", "quick fix", "nothing fancy"; the task is a bug fix, small
tweak, copy change, or single-file change; it's < ~30 min; or they already know exactly what they
want. Skip all artifacts and tracks. Solve the problem. If it grows complex, offer to switch.

### Spec Mode — Plan First, Then Build
Everything else. Spec Mode always begins with **Phase 0: Classification**, which selects the
composable track set for this feature. Then it runs the pipeline below, with the track-conditional
phases switched on or off.

If unsure which mode: casual language → Vibe; formal/complex/"system"/"integration"/"properly" →
Spec. When truly ambiguous, suggest Spec and let the user decide.

### Brownfield — adopt SDD in an EXISTING codebase
When the project already has code (no `.specs/` yet, or "document/spec our existing app"):
1. **Scan** — run `spec_scan` (CLI: `dev-spec scan`) for a local inventory: stack, top-level
   modules, candidate endpoints, file mix. Read key files to understand the architecture.
2. **Infer steering + constitution** — from the scan + code, draft `steering/` and especially
   `constitution.md` that **acknowledges the existing patterns** rather than imposing new ones.
   Present for approval.
3. **Reverse-engineer specs** — for the core modules, create features (`spec_create`) and fill
   `requirements.md`/`design.md` to describe what the code *actually does today* (mark them as
   reverse-engineered). Pick a strategy: constitution-only, or + baseline specs for 2-3 core
   modules, or full coverage — match effort to need.
4. **Coverage** — `spec_coverage` (CLI: `dev-spec coverage`) reports what % of modules have specs;
   prioritize the gaps.
5. **New feature, integration-aware** — then classify + spec the new feature normally, plus an
   `integration-plan.md` (integration points, required changes, sequencing, risks). Use the
   `_Implements: path_` task marker so `trace` ties specs to real files.
Respect what's there; adopt incrementally; prove value on one module before expanding.

---

## Directory Structure

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
        └── tasks.md              # story-organized, traceable plan ([P] = parallelizable)
```

### Steering Files
Before any spec work, read whatever exists in `.specs/steering/`. If the core files are missing,
offer to create them with `spec_init` (or `steering_scaffold`). They're short and dramatically
improve every downstream spec. Add track-specific steering files the first time a feature pulls in
that track. Templates: `references/steering-templates.md`.

**`constitution.md` is core (always).** It holds the project's non-negotiable principles
(e.g. "every write is idempotent", "no PII in logs", "errors fail closed"). `spec_doctor` and
`/prReview` check work against it — a design that violates a stated principle is blocked. Keep the
principles few, concrete, and testable.

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
3. **Write `classification.md`** (via `spec_create`, which seeds it, or by hand). Record mode,
   active tracks, the signals, blast radius, and (per track) hot-path / autonomy / volume / compliance.
4. **Present for approval.** If the user disagrees with the track set, adjust before requirements.

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
behavior), not instead of them. **Mark any ambiguity inline** with `[NEEDS CLARIFICATION: question]`;
**the design phase is gated — it cannot start while any such marker remains** (`spec_doctor` fails
the `clarifications` check until they're resolved).

Steps: read steering → ask clarifying questions (don't guess) → `spec_create` to scaffold (or write
by hand) → fill `requirements.md` → run `ears_validate` to catch missing SHALL / missing IDs /
vague words → **run `spec_clarify`** to surface remaining gaps (vague terms, leftover placeholders,
missing edge-cases/NFR/out-of-scope, missing IF…THEN failure paths, and track-specific gaps like
tenant isolation or AI quality/cost) and ask the user those questions before moving on → present
for approval.

### EARS Quick Reference
| Pattern | Keyword | Example |
|---|---|---|
| Ubiquitous | _(none)_ | The system shall respond within 500ms at P95. |
| State-driven | WHILE | While offline, the app shall queue changes locally. |
| Event-driven | WHEN | When a user clicks submit, the system shall validate. |
| Optional | WHERE | Where SSO is configured, the system shall skip the password step. |
| Unwanted | IF…THEN | If password fails 5 times, then lock the account for 15 minutes. |

Compound order: WHILE → WHEN → IF. Every criterion must be testable and specific — no "fast",
"user-friendly", "appropriate"; use concrete values. Full reference: `references/ears-guide.md`.

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
empty is good). For larger features, optionally split research into `research.md` (decisions +
rationale) and write a `quickstart.md` manual acceptance scenario.

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
tests). Each test gets a stable ID (`T-01`) mapped to AC IDs, and a layer (unit/integration/E2E)
following the pyramid. The Coverage Check section must show every AC appears in ≥1 test. On +saas,
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
compile — no business logic. Confirm: N written, N red, 0 green, 0 erroring. Commit
`test(feature): scaffold failing tests …`. **No implementation code until this gate is approved.**

**+ai:** Write deterministic tests (validation, schema, rate limiting, logging, fallback, cost
circuit breaker) AND implement the eval harness (loads sets → runs through prompt+model → grades →
scores per set → fails below threshold). Establish and record baseline. Commit
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
- Always: `_Requirements: US-1.AC-1, US-1.AC-2_`
- +tdd: `_Makes green: T-01, T-02_`
- +saas: `_Emits metrics: req_duration_ms{feature=X}_` + an observability task + (hot path) a load-test task
- +ai: `_Affects evals: golden (maintain baseline)_` + a separate task per prompt change + a cost-monitoring task
- brownfield/integration: `_Implements: path/to/file_` to tie a task to a real source file (checked by `trace`)

Run `trace_check` after writing tasks: every AC must map to ≥1 task (and, on +tdd, the test plan;
every planned T-ID should map to a task). Present for review.

---

## Phase 6: Execute (`/executeTask`)

Before any code, re-read steering, requirements, design, (test/eval plans), and tasks; summarize
your understanding to confirm alignment. Then work tasks **in order**, choosing the loop per task:

- **core task (no +tdd):** announce → implement per design → run existing tests → `spec_complete_task` → report.
- **+tdd task:** announce target tests → confirm red for the right reason → write the *minimum* code
  to green them → run the **full** suite (targets green, prior green still green, future-task tests
  still red) → refactor on green → mark `✓ (T-xx green)`.
- **+ai generation/prompt task:** announce baseline → edit prompt in a **new** `prompts/vN.md` →
  run the full eval harness → accept only if golden improved/held and adversarial held; otherwise
  revert/investigate → commit with eval delta.

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

### User commands during execution
"implement"/"next" (next task) · "implement N" (jump) · "continue" (resume) · "status" (progress +
test/eval state) · "pause" (stop after current task).

---

## Supporting Workflows

### Commit Messages (`/commit`)
Conventional commits referencing the chain:
```
feat(billing): implement webhook signature verification

Part of .specs/billing-webhooks/ task #3.
Makes T-05, T-06 green.            # +tdd
Eval delta: golden 82% → 87%.     # +ai
Emits metric webhook_verify_duration_ms.   # +saas
```
Types: feat | fix | refactor | test | docs | chore | style | perf. Phase-4 commits use `test:`.

### Code Review (`/prReview`)
Check, gated by active tracks: spec compliance · (+tdd) red-first evidence in git history + every
AC has a test · (+saas) scale sections filled, tenant isolation (`WHERE tenant_id = ?`),
observability points, cost of new hot paths · (+ai) eval delta in the PR, prompt changes in
versioned files not inline strings, PII-to-model review, cost tracking · security (injection,
authz, data exposure).

### Prompt Review (`/promptReview`, +ai) & Model Migration (`/migrateModel`, +ai)
Prompt PRs are blocked without eval results (golden up, adversarial held, version bumped, cost
delta noted). Model migrations are **eval-gated only**: run the current eval set on the new model,
compare per set, switch only if equal-or-better (or tune the prompt to recover), record the
decision in the Model Lifecycle section. Never migrate blind.

### Health Check & Gates (`/doctor`, `/approve`, `/next-action`)
Before advancing a phase, run `/doctor` (the `spec_doctor` tool): it runs EARS lint, traceability,
steering presence, design+Mermaid, and — per active track — whether the mandatory +saas/+ai
sections are present AND filled (no leftover `TODO` sentinel), and returns a `readyToAdvance`
verdict. It also enforces a **real approval gate**: any artifact that exists but whose phase hasn't
been approved is reported (`approval-gates` check, `gatesOk` flag, `pendingGates` list) — so progress
isn't just quality-checked, it's sign-off-checked. When the user signs off on a phase, record it with
`/approve <feature> <phase>` — this writes an auditable, resumable gate to
`.specs/<feature>/.state.json`. Lost? `/next-action <feature>` (the `spec_next_action` tool) reads the
phase, the doctor verdict and the gates and tells you the single next step — and flags any artifact
edited *after* its approval so a post-approval change is re-reviewed, not silently shipped.

### Adjusting a feature (`/add-track`, `/feature`)
Needs changed? `/add-track <feature> <tdd|saas|ai>` (the `spec_add_track` tool) escalates an existing
feature to a new track — **additive only**: it scaffolds just the missing artifacts and appends that
track's mandatory design sections, never overwriting your work. `/feature <remove|archive|rename>`
(the `spec_feature` tool) manages the lifecycle: **archive** (reversible — moves to `.specs/_archive/`),
**rename** (slug + folder + every `roadmap.json` dependency reference), or **remove** (destructive —
confirm first). All keep the roadmap's dependency graph consistent.

### Local automation (hooks — the free CI substitute)
This plugin ships local hooks (`hooks/hooks.json`), not CI: on saving `requirements.md` it lints
EARS; on saving `tasks.md` it runs a traceability check; at session start it prints feature status.
An optional git `pre-commit` validator (`hooks/precommit-check.js`) blocks commits with EARS errors
or phantom AC/test references. All local, zero cost — no GitHub Actions anywhere.

### Integrations & handoffs
These compose with the user's other plugins when present: at `/prReview` or before a deploy, hand
security/quality off to **dev-guardian** (`/guardian-review`, `/guardian-scan`); for UI-heavy
features, reach for **ui-ux-pro-max** during design/build. Don't duplicate what those do — route to
them.

### Roadmap & Dependencies (`/roadmap`, `/depend`, `/backlog`)
For multi-feature projects, model the order and dependencies between features. `spec_depend`
declares "feature X depends on Y" (or sets an explicit order) and **rejects cycles**; `spec_roadmap`
shows every feature's tracks, phase, completion % (derived from phase), blocked status (a dependency
is met when that feature is 100%), overall %, and any cycle. Use it for "what should I build next?",
"what depends on auth?", and "move X before Y". Don't start a feature whose dependencies aren't met
without saying so.

**Always-current roadmap overview.** The default is **`.specs/ROADMAP.md`** (git/PR-friendly, keeps
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

### Phase Summaries (always present one at each gate)
At every approval gate, present a short, structured summary so the human can review fast:
**(1) what was produced · (2) key decisions + rationale · (3) tracks/sections affected · (4) things
to review / watch-outs / risks · (5) the `spec_doctor` verdict · (6) next step.** Then explicitly
ask for approval. Keep it tight — this is a review aid, not a wall of text.

### Status (`/status`) & Mode/Track Switching
"status" → run `spec_status` / `spec_list`: report mode, active tracks, phase, task progress, test
red/green and eval scores, and section completeness. Switch anytime: "let's vibe" → Vibe; "spec
this" → Spec from Phase 0; "escalate to +tdd/+saas/+ai" mid-feature → add the track and its
artifacts (write the test/eval plan before continuing). Don't push; respect the user's choice — but
if a Vibe session sprouts a tenant boundary, a payment path, or an LLM call, say so and offer to
classify.

---

## Environment Notes
- **Claude Code / Cowork:** Full support. Specs in `.specs/`, real test files in the project's
  standard location, prompts/evals in the feature folder. The local MCP server handles scaffolding
  and tracking. Git versions everything. No CI required.
- **claude.ai:** Present artifacts in code blocks; the user copies them across. The MCP server and
  test/load/eval execution need a real environment — describe expected results instead of running.

---

## Command Reference
| Command | Phase | What it does |
|---|---|---|
| `/spec` | entry | Start/resume the whole workflow for a feature — picks mode + tracks, then runs the pipeline (uses `spec_classify`/`spec_status`) |
| `/init` | setup | Scaffold `.specs/steering/` for the active tracks (uses `spec_init`) |
| `/classify` | 0 | Pick mode + composable tracks; write classification.md (uses `spec_classify`) |
| `/createSpec` | 1 | Requirements in EARS with stable AC IDs (uses `ears_validate`) |
| `/design` | 2 | Design with base + active-track mandatory sections |
| `/testPlan` | 3 | (+tdd) enumerate tests, map to AC IDs, choose layers |
| `/evalPlan` | 3 | (+ai) golden/adversarial/regression sets, graders, thresholds, baseline |
| `/writeTests` | 4 | (+tdd/+ai) failing tests + eval harness; the hard gate |
| `/createTask` | 5 | Traceable, ordered tasks (uses `trace_check`) |
| `/executeTask` | 6 | Implement: core / red-green-refactor / prompt-iteration per task |
| `/doctor` | gate | Health-check a feature; returns readyToAdvance + gate status (uses `spec_doctor`) |
| `/approve` | gate | Record a phase approval to `.state.json` (uses `spec_approve`) |
| `/next-action` | any | "You are here → do this next" + what changed since approval (uses `spec_next_action`) |
| `/add-track` | any | Escalate a feature to +tdd/+saas/+ai, additive (uses `spec_add_track`) |
| `/feature` | any | Remove / archive / rename a feature, deps kept consistent (uses `spec_feature`) |
| `/eval` | +ai | Run the local eval harness (golden/adversarial/regression) with your API key |
| `/clarify` | 1 | Surface requirement ambiguities/gaps before design (uses `spec_clarify`) |
| `/roadmap` | any | Multi-feature roadmap: %, deps, blocked, cycles; writes `.specs/ROADMAP.md` (uses `spec_roadmap`) |
| `/depend` | any | Declare feature dependencies / order, cycle-checked (uses `spec_depend`) |
| `/backlog` | any | Add/remove planned features shown in ROADMAP.md (uses `spec_backlog`) |
| `/scan` | brownfield | Inventory an existing codebase (uses `spec_scan`) |
| `/reverse` | brownfield | Reverse-engineer steering + specs from existing code |
| `/coverage` | brownfield | Spec coverage % of existing code (uses `spec_coverage`) |
| `/commit` | support | Conventional commits referencing spec + tests + evals |
| `/prReview` | support | Track-aware PR review against the full chain |
| `/promptReview` | support | (+ai) gate prompt changes on eval/cost/version |
| `/migrateModel` | support | (+ai) eval-gated model migration |
| `/status` | any | Mode, tracks, phase, task/test/eval state (uses `spec_status`/`spec_list`) |

**Aliases:** `/ds` → `/spec` · `/dsx` → `/executeTask` · `/dss` → `/status`. (As a plugin, all
commands are namespaced, e.g. `/dev-spec-driven:doctor`.)

---

## References (read on demand — don't preload everything)
- `references/classification-matrix.md` — track-routing brain (the decision procedure)
- `references/classification-examples-saas.md` / `references/classification-examples-ai.md` — worked examples
- `references/brownfield.md` — adopting SDD in an existing codebase (scan → constitution → reverse-specs → integration)
- `references/ears-guide.md` — full EARS syntax, all 5 patterns
- `references/steering-templates.md` — all 8 steering-file templates
- `references/example-spec.md` — end-to-end example (requirements → design → tasks), core/auth
- `references/example-spec-combined.md` — worked example with all four tracks (`core +tdd +saas +ai`)
- `references/test-patterns.md` — naming, AAA, table-driven tests, anti-patterns
- `references/scale-design-template.md` — filled-in 5 mandatory +saas sections
- `references/saas-patterns.md` — caching, queues, rate limiting, idempotency, circuit breakers, multi-tenancy
- `references/load-testing-patterns.md` — k6/Artillery templates, scenarios, interpretation
- `references/mandatory-ai-design-sections.md` — filled-in 10 +ai sections
- `references/eval-suite-patterns.md` — golden/adversarial/regression sets, graders, LLM-as-judge
- `references/prompt-engineering-patterns.md` — RAG, CoT, structured output, tool use, agent loops
- `references/ai-cost-modeling.md` — token counting, pricing math, projection at scale
- `references/ai-safety-patterns.md` — injection defense, jailbreak taxonomy, moderation
- `references/model-provider-guide.md` — Anthropic/OpenAI/Google/OSS, DPA, latency/cost profiles

**One sentence:** classify each feature into composable tracks, plan with EARS and the mandatory
sections its tracks demand, gate quality with tests and evals where it matters, and let the local
MCP do the mechanical scaffolding — all offline, no CI, no cost.
