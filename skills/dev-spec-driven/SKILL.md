---
name: dev-spec-driven
description: >
  Spec-driven development with approval gates: EARS requirements, technical design, traceable tasks,
  then execution. This skill should be used when the user wants to plan or scope a non-trivial feature
  before coding, fix a reported bug (root cause and a failing regression test first), adopt specs in an
  existing codebase, manage a feature roadmap, or update existing specs after a dev-spec-driven update.
  Tracks: +tdd, +saas (scale, cost), +ai (evals, prompts), +sec, +privacy, +dist,
  +api, +ui, +obs, +data. Triggers: "spec this", "plan this feature", "implementation plan", "break into tasks",
  "tests first", "fix this bug", "update the specs"; PT "especificar", "plano de implementação",
  "dividir em tarefas", "antes de começar a programar", "corrige este bug", "atualizar as specs"; ES
  "especificar", "plan de implementación", "dividir en tareas", "antes de empezar a programar", "arregla
  este bug", "actualizar las specs". Not for trivial edits, requirements.txt, or code that merely calls
  eval() or an LLM.
---

# Dev Spec-Driven (unified, track-based)

Take the developer from idea to production-ready code through a disciplined, approval-gated process,
and **scale the rigor to the feature**, not the other way around — one pipeline, composable tracks:

| Track | What it adds |
|---|---|
| **core** *(always)* | EARS requirements → design → tasks → execute, with approval gates |
| **+tdd** | Test plan + failing-tests-first + red-green-refactor execution |
| **+saas** | 5 mandatory scale sections, multi-tenancy, observability, cost, load tests |
| **+ai** | Eval plan, prompts-as-code, token economics, safety, model lifecycle |
| **+sec** | 5 mandatory `[SEC]` sections: STRIDE threat model, ASVS level, authn/authz, secrets, security testing |
| **+privacy** | 6 mandatory `[PRIVACY]` sections (GDPR / RGPD): data inventory, lawful basis, retention, subject rights, processors, DPIA |
| **+dist** | 5 mandatory `[DIST]` sections for data that crosses systems (consistency, dual writes, idempotency…) |
| **+api** | 5 mandatory `[API]` sections for a contract other code depends on (versioning, error model, rate limits…) |
| **+ui** | 5 mandatory `[UI]` sections for a user-facing screen (UI states, WCAG 2.2 AA accessibility, i18n…) |
| **+obs** | 5 mandatory `[OBS]` sections for a service people depend on (SLOs, alerting & runbooks, rollout…) |
| **+data** | 5 mandatory `[DATA]` sections for a data pipeline (contracts, data quality, idempotent re-runs & backfills…) |
| **+your own** | A project track pack in `.specs/tracks/<name>/` (`/spec-tracks`, `references/project-tracks.md`) |

What each active track adds at every phase — criteria, design sections, tests, task markers, done checks:
**`references/track-checklists.md`** (read its rows at each phase).

**With superpowers installed:** this workflow replaces its feature-work skills — never both on one feature;
`/spec-superpowers` records that precedence in CLAUDE.md.

## Language (EN / PT / PT-BR / ES)

Detect the language of the user's request and **mirror it** everywhere — the conversation, your questions, the approval
prompts and the artifacts' prose, **section headings included** (`## Critérios de Sucesso`); the engine recognizes the
mandatory headings in EN/PT/ES. **Pass `lang`** on `spec_init` (the project default) and `spec_create` (explicit >
project > en) — `en`, `pt` (European Portuguese), `pt-BR` (Brazilian: você, arquivo, usuário, tela…) or `es`: scaffolds
and tool messages come out localized — fill the placeholders, don't translate the scaffold. `spec_classify`'s `lang`
reads any Portuguese as `pt`: pick `pt-BR` from the user's wording. `spec_classify` returns `langHint: "pt-BR"` when
Brazilian wording dominates — then pass `lang: "pt-BR"`.
**Structural tokens** stay as they are in every language: AC/SC IDs (`US-1.AC-1`, `SC-001`), test IDs (`T-01`), task
markers (`_Requirements:_`, `_Verify:_`, `_Expect:_`…), tags (`[US1]`, `[shared]`, `[P]`), track names, the section
markers (`[SaaS]` … `[DATA]`, case-sensitive) and `[NEEDS CLARIFICATION:]`. EARS keywords may be localized; if the
user switches language, follow them.

## Core Principles

1. **No implementation without approval.** The developer reviews each phase's artifact — mistakes caught early are
   cheap. An approval is the user's explicit yes for THAT phase: "fix it", "ship it", a passing run or a ticked task is
   not one.
2. **Right rigor for the job.** Tracks compose per feature. Don't TDD a copy change; don't ship a payment path on vibes.
3. **Traceability end-to-end.** Code → tasks → (tests/evals) → design → requirements → need. Every acceptance
   criterion has a stable ID that later artifacts reference.
4. **The mandatory sections are mandatory.** On +saas, +ai, +sec, +privacy, +dist, +api, +ui, +obs and +data the track's design
   sections cannot be blank. An honest "not needed because X" is fine; an empty section means "I didn't think about
   it" — the source of every 3AM incident, every breach and every surprise bill.
5. **Everything is local.** The bundled MCP server runs on your machine. No GitHub Actions, no cloud runners, no
   per-run cost. Specs live in `.specs/` and are versioned in your git repo.
6. **Evidence before claims.** Nothing is "done", "passing" or "fixed" until a command proved it on the final code. Tick
   tasks only through `spec_complete_task {evidence}` — never by editing the checkbox: a runnable `_Verify:_` is proved
   only by `{command, exitCode: 0}` of THAT command (an `_Expect: fail_` task: its red run; another command →
   `command-mismatch`); a failed run refuses the tick; a text note leaves it unverified. **Can't run the command
   yourself?** Don't tick it — never with an exit code you didn't see — and don't send a subagent to look for a shell:
   ask the user for its output (or to run `node "<clone>/cli/dev-spec.js" done <feature> <n> --run`, the line the tool's
   note prints) and record what they report. Rules and reason codes: `references/verification.md`; the thoughts that
   precede skipping a phase: `references/red-flags.md`.
7. **An approved spec that changed is not approved.** Every approval snapshots what it signed off; an edit afterwards is
   diffed (`spec_impact`), reviewed with the human and re-approved — never silently shipped.

## The local MCP server (use it — it's free and offline)

The bundled zero-dependency MCP server **`spec-driven`** does the mechanical work — prefer it over hand-rolled edits:
`spec_classify` → `spec_init` → `spec_create` to start, `spec_doctor` / `spec_approve` / `spec_next_action` at every
gate, `spec_next_task` / `spec_task_brief` / `spec_complete_task {evidence}` / `spec_finish` to execute (which tool
when: `references/tool-catalog.md`; the tool table, CLI, hooks, prompts and `specs://` resources:
`references/tooling-reference.md`). The tools write **skeletons and checks**, never over your files; *you* fill them. No
MCP connection (e.g. claude.ai)? Write the files by hand. `dev-spec …` here names the CLI; **a line you hand the user is
the runnable one the tools print** — `node "<clone>/cli/dev-spec.js" …` (a plugin install has no `dev-spec` on PATH).

## First Things First: Mode, then Tracks

### Vibe Mode — Just Build It
Use when the user says "just do it", "quick fix", "nothing fancy"; the task is a trivial fix, a copy change or a
single-file change under ~30 min; or they know exactly what they want. Skip all artifacts; if it grows, offer to switch.

### Bounded Mode — Short Design, Explicit Yes
A well-scoped change to a flow that **already exists in this repo** (a new flag, a small endpoint, a one-file
behaviour change). Ask only the questions that matter, present a short design **in chat** (a few sentences, the
files you'll touch, how you'll verify it), and STOP until the user says yes — that approval is as binding as a phase
gate. No artifacts. If there's no existing flow to change, it isn't bounded. **The ratchet is one-way:** hidden
complexity found mid-task upgrades the mode (Vibe → Bounded → Spec), never the reverse.

### Bugfix — a real defect
Something that worked (or is specified to work) and doesn't. Use the **bugfix flow** (`/spec-bugfix`): a light spec
whose order is fixed — reproduce → root cause with evidence → **STOP for the `bug.md` approval** → failing regression
test (`_Expect: fail_`, seen red) → fix → verify. "Fix it" asks for the outcome; it is not an approval of the root
cause. Prefill what you already know in the `spec_create {kind: "bugfix"}` call (`reproduction`, `rootCause`,
`condition`, `behaviour`; `includeBody: true` returns the scaffolds) instead of reading four files back and rewriting
them. After three failed fixes, question the design. `references/bugfix.md`.

### Spike — a question, not a feature
An investigation that must end in a decision (which queue? can the API do X?): `/spec-spike`
(`spec_create {kind: "spike", question, timebox}`) → `spike.md` (question · timebox · options · evidence · decision
`_Outcome: go | no-go | pivot_`) and investigation tasks, no requirements/design gates; prototype code stays outside
`.specs/`. `go` seeds the real feature. `references/design-first.md`.

### Spec Mode — Plan First, Then Build
Everything else. Spec Mode always begins with **Phase 0: Classification**, which selects the composable track set for
this feature, then runs the pipeline below with the track-conditional phases switched on or off. Internal-improvement
work (refactor, coverage, a complexity hotspot) is Spec mode too, with a re-measurable metric delta as its acceptance
criterion: `references/improvement-specs.md`. When the architecture is the input (a migration, an imported plan), use
the **design-first** order — classification → design → requirements → … (`spec_create {flow: "design-first"}`,
`references/design-first.md`).

If unsure which mode: casual language → Vibe; a contained change to a flow that already exists →
Bounded; a real defect → bugfix (`/spec-bugfix`); an open question → spike; formal/complex/"system"/"integration"/
"properly" → Spec. Say the mode out loud so the user can override it; when in doubt between two, take the heavier
one. Switch anytime: "let's vibe" → Vibe; "spec this" → Spec from Phase 0. If a Vibe session sprouts a tenant
boundary, a payment path, personal data, a trust boundary or an LLM call, say so and offer to classify. New to the
plugin? `/spec-tour` takes one tiny real change on the user's repo through every gate in ~10 minutes.

### Size — rigor proportional to the change
Phase 0 also picks a **size** (`spec_classify`'s `suggestedSize` is a draft; pass `spec_create {size}`): **xs** — a
change: ONE `change.md` (summary, 1–3 EARS criteria, approach, 1–3 tasks with `_Verify:_`), core only, two approvals —
the plan (`spec_approve {through: "tasks"}`) and execution; a track or a fourth task means size s. **s** — one story, no
classification.md, each track's core-tier sections (an extended one may stay out, or answer `n/a — <reason>`); fill the
whole plan, approve it in one call (+tdd / +ai: up to Phase 4). **m / l** — the full chain, duplicate track sections merged. A bugfix (any size) has
no reproduce / root-cause tasks (their gates remain). No size = the pre-1.21 scaffold. Every size keeps EARS, trace,
evidence, the iron law and the finish gate. `references/workflows.md`.

### Brownfield — adopt SDD in an EXISTING codebase
No `.specs/` yet, or "spec our existing app": `/scan` → steering + a constitution that acknowledges the existing
patterns → `/reverse` (specs of what the code does *today*) → `/coverage` → new features integration-aware
(`spec_create {brownfield: true}` → `integration-plan.md`, `_Implements:_`). Specs or plans written elsewhere (Kiro,
spec-kit, OpenSpec, a Claude Code / Cursor plan, a Codex ExecPlan, fluidplan, BMAD): `/spec-import`.
`references/brownfield.md`.

## Directory Structure and Steering

Everything lives in `.specs/` at the project root — `steering/`, `roadmap.json`, one folder per feature (its artifacts,
`decisions.md`, `retro.md`, the `.history/` approval snapshots — commit them) and the generated `ROADMAP.md`,
`SPECS.md`, `RELEASE-NOTES.md`, `exports/` (annotated tree: `references/tooling-reference.md`). **A `.specs/` from an
older dev-spec** (the session-start line says so): `/spec-upgrade` first — audit → apply (after an OK) → review.

**Steering.** Read whatever exists in `.specs/steering/` before any spec work. Missing files are created **after Phase 0
approval** (step 4), a track's steering file (`steering_scaffold`) the first time a later feature pulls that track in.
One still full of placeholders steers nothing (`spec_doctor` names it). Scoped steering, the team's `.specs/templates/`,
`glossary.md`: `references/steering-templates.md`.

**`constitution.md` is core (always)** — the project's few, concrete, testable non-negotiables ("every write is
idempotent", "no PII in logs"). Every design carries a **Constitution Check** section;
`spec_doctor` only checks that the section is there (the design approval also refuses it empty) — whether the design
honours each principle is judged by the human at the gate and by the `spec-critic` agent (`/spec-doctor --deep`);
`/prReview` checks the code against it.

## Phase 0: Classification (`/classify`)

Decide the mode, then the track set. This is fast (5–10 min) and saves days of wrong-rigor work.

1. **Run `spec_classify`** with the feature description (and `projectDir` — the project's track packs are classified
   too) to get a recommended track set + the keyword signals that triggered each track. A draft, not gospel.
2. **Sanity-check against `references/classification-matrix.md`.** Rule of thumb: `+tdd` correctness matters or it's
   hard to undo · `+saas` multi-tenant, hot path, background, an external contract or cost at scale · `+ai` quality
   depends on model output, or user input reaches a model · `+sec` a mistake is a breach (credentials, trust boundaries,
   who-may-do-what, secrets) · `+privacy` personal data · `+dist` one write reaches several systems (idempotency,
   concurrency, partial failure) · `+api` other code depends on the contract · `+ui` a user-facing screen or flow ·
   `+obs` people depend on it staying up · `+data` it moves data between stores on a schedule or a stream and owns its
   quality. **When unsure, turn the track on.** One auth word alone only makes `+sec` "possible".
3. **Present for approval:** mode, active tracks, size, the signals, blast radius, and (per track) hot-path / autonomy /
   volume / compliance. If the user disagrees with the track set, adjust it now.
4. **After Phase 0 approval:** `spec_init {tracks, lang}` if steering is missing, then
   `spec_create {name, tracks, size, lang}` **once** — it seeds every artifact skeleton the tracks and the size need, and
   persists the track set, size and language in `.state.json` (change tracks later with `spec_add_track` — `remove: true`
   drops one). **m / l** (or no size): it seeds `classification.md` — record the fields
   from step 3 there and record the gate with `spec_approve`. **s / xs:** no `classification.md`, no classification
   gate — record them in the Summary of `requirements.md` (s) or `change.md` (xs).

Worked examples: `references/classification-examples-saas.md`, `references/classification-examples-ai.md`.

## Phase 1: Requirements (`/createSpec`)

Turn the idea into testable requirements in **EARS** syntax with **stable AC IDs** (`US-1.AC-1`, …) — the backbone of
traceability (tests, tasks, commits and alerts cite them), so assign them even on the lightest track. **Prioritize the
user stories and make each independently shippable** (P1 the MVP, each with a one-line *Independent Test*). Add
**Success Criteria** — measurable, **technology-agnostic** outcomes (`SC-001`) — and stable IDs for edge cases and NFRs
(`EC-1`, `NFR-1`; `trace_check` warns when nothing covers them). **Mark any ambiguity inline** with
`[NEEDS CLARIFICATION: question]`; **the design phase cannot start while any marker remains** (`clarifications`).
Replace every template placeholder (`placeholders`: approval refused). Track criteria: `references/track-checklists.md`.

Steps: read steering → ask clarifying questions (don't guess) → fill `requirements.md` → `ears_validate` →
**`spec_clarify`** (`/clarify`: vague terms, placeholders, missing edge cases / NFRs / out-of-scope / IF…THEN paths,
track gaps) and ask the user → offer `/grill` for a one-question-at-a-time interrogation (its constraints round:
atomicity, isolation, races, consistency, idempotency, failures, volume) → present for approval.

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

## Phase 2: Design (`/design`)

Convert approved requirements into a technical blueprint (on a design-first feature this phase comes first). Re-read
steering + requirements, scan the codebase for patterns to match and code to reuse, then write `design.md`.

**Base sections (always):** Overview · Architecture (≥1 Mermaid diagram) · **Reuse & Integration** (what is reused or
extended, with paths; what is new and why) · **Alternatives & Trade-offs** (≥ 2 options per key decision, the one chosen
and why) · Data Models · API Contracts · Security · Error Handling · Testing Strategy · **Risks** (likelihood · impact ·
mitigation · owner) · **Constitution Check** (each principle — re-checked after any change) · **Complexity Tracking**
(what breaks a principle; empty is good). Doctor warns `design-tradeoffs` / `design-risks` / `design-reuse` (never
blocks). `spec_create` always scaffolds `quickstart.md` (a manual acceptance scenario) and `checklist.md` — fill both.
**Each active track adds its mandatory sections** (+tdd Testability Notes, +ai 10, the rest: the table above; what goes
in each: `references/track-checklists.md`). Simplicity over cleverness, consistency with the codebase; present for
approval.

## Phase 3: Test Plan & Eval Plan (`/testPlan`, `/evalPlan`) — track-conditional

**+tdd → Test Plan.** Enumerate every test (≥1 per AC; negative tests for every IF/THEN; boundary tests). Each test gets
a stable ID (`T-01`) mapped to AC IDs, a layer (unit/integration/E2E, following the pyramid) and a **Kind**: `example`
(one concrete case — WHEN / IF…THEN) or `property` (an invariant over generated inputs — ubiquitous, WHILE, "never /
for every" rules like tenant isolation). The Coverage Check shows every AC in ≥1 test. Approve before writing test
code. `references/test-patterns.md`.

**+ai → Eval Plan.** Three sets — **golden**, **adversarial**, **regression** — with grading per set, explicit ship
thresholds and a **baseline** from a minimal v1 prompt before implementing. `references/eval-suite-patterns.md`.

The tests each other track adds, and the eval plan in detail: `references/track-checklists.md`. A feature with both
tracks has both artifacts.

## Phase 4: Failing Tests + Eval Harness (`/writeTests`) — track-conditional, the hard gate

**+tdd:** Write every planned test. Each must exist and **fail for the right reason** (assertion / NotImplementedError,
not a typo or missing import). Scaffold only stubs/signatures so tests compile — no business logic. Confirm: N written,
N red, 0 green, 0 erroring. Put the T-ID in each test's name (`test("T-01 …")`, `def test_T01_…`) and run
`trace_check {code: true}`: every planned T-ID found in the test code. Commit `test(feature): scaffold failing tests …`.
**No implementation code until this gate is approved.**

**+ai:** deterministic tests AND the eval harness (`/eval` runs the bundled local one; `--dry-run` offline); record the
baseline and commit it (`references/track-checklists.md`).

**The gate is tracked:** with a test or eval plan, phase `tests` is pending — `/next-action` asks for it before the
tasks approval and never recommends implementing until the user signs it off (`/approve <feature> tests`, which checks
`tests-in-code` / `eval-sets`). The engine can't see the tests run: present the red/green counts first. A bugfix has no
Phase 4 gate — its failing regression test is one of its tasks.

## Phase 5: Tasks (`/createTask`)

Break the design into tasks (~30 min–2 h each), **organized by user story (P1 first)**: `Setup`, `Foundational` (blocks
all stories), one phase per story (`Story US-1 (P1)`, …) ending with a **`**Checkpoint:**`** line where it is
independently testable, then `Polish`. **Tag every task with its story** (`[US1]`, or `[shared]`) and **`[P]`** when it
can run in parallel (different files, no dependencies) — `[US1][P]`. Numbers ARE the order; stories that aren't
independent were mis-sliced.

Traceability markers per task:
- Always: `_Requirements: US-1.AC-1, US-1.AC-2_` and `_Verify: <command that proves it>_` (no pipe: a pipeline
  reports its LAST command's exit code)
- A task that writes a test before its code (a bugfix's regression test, a red phase): `_Expect: fail_` — its
  failing `_Verify:_` run is the proof, a pass is refused (`unexpected-pass`)
- Optional: `_Size: XS|S|M|L|XL_` (1/2/3/5/8 points — the roadmap's velocity and ETA)
- Optional: `_Depends: 3, 5_` — tasks of this tasks.md that must be done first (the next task and the waves follow it;
  doctor fails `task-deps` on an unknown number or a cycle); without it, tasks.md order is the order
- Per track (+tdd `_Makes green:_`, +saas `_Emits metrics:_`, +ai `_Affects evals:_`, brownfield `_Implements:_`):
  `references/track-checklists.md`

Run `trace_check` after writing tasks: every AC must map to ≥1 task (and, on +tdd, the test plan; every planned T-ID
should map to a task). Keep task numbers unique and replace every scaffold placeholder task (the tasks gate refuses
them). Present for review. Work found after approval is appended, never renumbered in (`spec_append_tasks`).

## Phase 6: Execute (`/executeTask`)

Before any code, re-read steering, requirements, design, (test/eval plans) and tasks; summarize your understanding.
**Search before you write:** the design's Reuse & Integration, the brief's Reuse section, the codebase by
concept and synonyms — reuse, else extend, else create; a refactor outside the task goes to the backlog (`refactor:` note;
`references/code-reuse-and-quality.md`). Then work tasks **in order** — the next is `spec_next_task`'s: the first open
task whose `_Depends:_` are all done — choosing the loop per task:

- **core task (no +tdd):** announce → implement per design → run existing tests and the task's
  `_Verify:_` → `spec_complete_task {evidence}` → report.
- **+tdd task:** announce target tests → the micro-cycle, ONE behaviour at a time (a new behaviour's test → watch it
  fail for the right reason → minimum code → watch it pass → refactor on green; its code written before the test is
  deleted and redone; guard / characterization tests and T-IDs an earlier task turned green pass at once — never
  forced red — `references/test-patterns.md`) → run the **full** suite (targets green, prior green still green, future-task tests
  still red) → `spec_complete_task {evidence}`: its target tests' command + exit code, "T-xx green" + the suite tally.
- **+ai generation/prompt task:** announce baseline → edit prompt in a **new** `prompts/vN.md` →
  run the full eval harness (`/eval`) → accept only if golden improved/held and adversarial held;
  otherwise revert/investigate → `spec_complete_task {evidence}`: the harness command + its exit code,
  and the eval scores with their delta vs baseline in the summary → commit with that delta.

**Evidence, enforced** (`references/verification.md`; no shell: Principle 6): a piping `_Verify:_` is flagged
(`verify-pipes`); project checks (`spec_init {checks}`) need a passing run since the last tick before `/spec-finish`; in
Claude Code a **Stop hook** sends the turn back when your closing message claims done / verified without passing
evidence — run the check, or say plainly what is not verified; with `evidence: "observed"` only a run the harness saw
(or `done --run`) verifies.

Track-gated "done" checks before a feature is finished (load test, cost and safety, scans, subject rights, failure
injection, contract tests, accessibility, a staged alert…): `references/track-checklists.md`; `spec_finish` lists them.
Before `/spec-finish`, optionally `/spec-simplify`: a behaviour-preserving cleanup, proven by the tests.

If blocked, pause and discuss — don't improvise outside the design. If a test/measurement reveals a gap, go back to
that phase, not the implementation. If a "green" test is actually wrong, pause, explain, fix the plan with approval,
rerun — never quietly edit a test to pass. A decision or discovery made on the way goes to the decision log
(`/spec-decide`), not only into chat.

**Inline (default) or subagents (opt-in).** `/executeTask <feature> --subagents` (or when the user asks) keeps your
context for coordination: per task write a brief with `spec_task_brief {name, number, write:true}`, dispatch
**`dev-spec-driven:spec-implementer`** with its path, send the diff to **`dev-spec-driven:spec-reviewer`**, verify each
❌ / Critical / Important finding (a verify-mode `spec-reviewer` per finding; only 80+ opens a fix round), run a fix loop
of at most 5 rounds, only then `spec_complete_task`. Offer it for ~6+ mostly independent tasks (it costs 2–3× the tokens).
You (the controller) never write feature code; stop at every `**Checkpoint:**` for human review; a finding that would
change an AC, the design or a planned test goes back to that phase; +ai prompt/eval tasks stay inline. Full protocol:
`references/subagent-execution.md`.

**Converge pass (`/spec-converge`).** When implementation drifted or you doubt every AC is delivered,
`dev-spec-driven:spec-reviewer` in **converge** mode walks the feature AC by AC and proposes the missing work as tasks;
**the human approves the list**, then `spec_append_tasks` adds them and you re-approve the tasks phase.

**User commands during execution:** "implement"/"next" · "implement N" · "continue" · "status" · "pause".

## Gates (`/spec-doctor`, `/approve`, `/spec-ff`, `/next-action`)

Before advancing a phase, run `/spec-doctor` (`spec_doctor`): one `readyToAdvance` verdict over EARS, placeholders,
traceability, steering, the design, every active track's mandatory sections (filled with your own text — not the `TODO`
sentinel or the template's guidance), evidence, edits since approval and the approval gates; check ids:
`references/tooling-reference.md`; `--deep` adds the `dev-spec-driven:spec-critic` agent's semantic review. When the
user signs off — an explicit yes for that phase — record it with `/approve <feature> <phase>`. **The approval is a
gate:** its checks run first and a failure refuses it; `--force` records a *forced* approval only when the user
explicitly accepts the failures (it stays visible). Phases are approved in order (`phase-order`); `/spec-ff`
(`spec_approve {through: "tasks"}`) approves several filled ones, each through its own gate, only after the user said
go. Team roles and waivers: `references/change-management.md`. When the approval guard asks the user or refuses your
approval, give the user the command it names and wait — never retry it another way. **The `execution` sign-off:** a
green run is evidence, not the sign-off — show the run and the merge summary, then ask for an explicit yes before
`spec_approve {phase: "execution"}`.

Lost? `/next-action <feature>` gives ONE next step — re-review what changed since approval → the first phase not
approved yet (fill → fix what its gate would refuse → approve) → fix → implement → verify an unverified tick →
finish (then `finished`, or `drift` to decide on).

At every gate present: **(1) what was produced · (2) key decisions + rationale · (3) tracks/sections
affected · (4) risks to review · (5) the `spec_doctor` verdict · (6) next step** — then ask for
approval. Keep it tight.

## Finish and after approval

**Finish (`/spec-finish`).** `spec_finish` lists the blockers, the checks to run fresh and a merge title + summary from
the spec chain; with `write` on a ready feature it records the drift baseline. After the explicit `execution` sign-off
the user picks **merge into the base branch locally** or **keep the branch** — no pull requests, no CI; never merge or
push on your own (pushing the merged base branch is a separate step the user approves).

**Change requests (`/spec-impact`).** An approved artifact edited later is flagged everywhere; `spec_impact` diffs it
against the approved snapshot and lists what each change reaches. Show that to the user; only with their OK,
`reopen: true` unticks the affected done tasks and marks their evidence stale — a REMOVED criterion's tasks are never
redone: `retire` lists them to delete or repoint. Then update what the change reaches and re-approve. Decisions
(`/spec-decide`), superseding (`_Supersedes:_`), drift, metrics, exports, release notes, archive / restore — and every
supporting command (`/spec-upgrade`, `/spec-import`, `/prReview`, `/spec-commit`, `/roadmap`, `/spec-guard`…) with the
local automation behind them: `references/workflows.md`.

## Environment Notes
- **Claude Code / Cowork:** full support (the local MCP server, git).
- **claude.ai:** present artifacts in code blocks to copy; the MCP server and test/load/eval runs need a real
  environment — describe the expected results, and never tick a task on a run nobody made (Principle 6).

## References (read on demand — don't preload everything)
The whole library, grouped, with one line per file: **`references/index.md`**. The ones every feature meets:
`references/track-checklists.md` (per track, per phase) · `references/tool-catalog.md` (which tool when) ·
`references/workflows.md` (supporting commands, after approval) · `references/verification.md` (evidence) ·
`references/classification-matrix.md` (Phase 0).
