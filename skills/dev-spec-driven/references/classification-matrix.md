# Classification & Track Routing

This is the brain of `dev-spec-driven`. Every feature in Spec mode passes through **Phase 0**,
which answers one question: **which tracks apply to this feature?**

Tracks are **composable** — a feature is not "a SaaS feature" *or* "an AI feature". A billing
webhook in a multi-tenant product that also calls an LLM is `core + tdd + saas + ai`. The track
set determines which artifacts, design sections, and execution loop the feature uses.

---

## The four tracks

| Track | Adds | Activated when… |
|---|---|---|
| **core** | EARS requirements → design → tasks → execute (the base flow) | always (every Spec-mode feature) |
| **+tdd** | Test Plan + failing-tests-first + red-green-refactor execution | correctness matters / it's hard to undo |
| **+saas** | 5 mandatory scale design sections, multi-tenancy, observability, cost, load test | production system with real users at scale |
| **+ai** | Eval plan, prompts-as-code, token economics, safety, model lifecycle, eval-gated execution | feature quality depends on LLM/agent/embedding output |

`core` is always on. The other three are added independently based on the signals below.

---

## Phase 0 decision procedure

1. **Pick the mode.**
   - Casual language ("just", "quick fix", "nothing fancy", single-file, <30 min) → **Vibe** (no
     artifacts, no tracks — just build it).
   - A contained change to a flow that **already exists** in the repo (a flag, a small endpoint, a
     one-file behaviour change) → **Bounded** (short design in chat, explicit yes, no artifacts).
   - A real **defect** (it worked, or is specified to work, and doesn't) → the bugfix flow,
     **`/spec-bugfix`** (`spec_create {kind: "bugfix"}`: reproduce → root cause → regression test →
     fix; always `+tdd`). See `bugfix.md`.
   - Everything else → **Spec**. When torn between two modes, take the heavier one.
2. **In Spec mode, evaluate each track's signals** (tables below). Any matching signal turns the
   track on.
3. **Present for approval** the mode, the active track set, the signals that triggered each, and the
   blast radius. If the user disagrees, adjust the track set before requirements.
4. **After approval**, `spec_init {tracks, lang}` if steering is missing, then
   `spec_create {name, tracks, lang}` once — it seeds `classification.md` (format below), where you
   record those decisions.

When unsure whether a track applies, **turn it on**. Over-investing rigor on a feature that turns
out simple costs a little time; under-investing on a feature that turns out critical costs an
incident, lost data, a breach, or a runaway bill.

---

## +tdd signals (turn on the TDD track)

Turn on `+tdd` if **any** are true:

| Signal | Example |
|---|---|
| Financial correctness | Billing, payments, refunds, credits, invoicing, metering |
| Auth / authorization | Login, sessions, RBAC, SSO, API tokens, password reset |
| Data integrity | Writes that can't be undone, migrations, imports, dedup logic |
| Complex branching logic | State machines, pricing rules, eligibility, scheduling |
| Known-tricky / bug-prone | Date/timezone math, concurrency, parsing, money rounding |
| Regression-sensitive | A bug here has bitten before, or would be silent and costly |
| User explicitly asked | "TDD this", "tests first", "no code without a test" |

Skip `+tdd` only when behaviour is well-understood, regressions are cheap and obvious, and the
code is largely glue/UI with little logic.

---

## +saas signals (turn on the SaaS scale track)

Turn on `+saas` if **any** are true:

| Signal | Example |
|---|---|
| Multi-tenant boundary | Anything where tenant A could read/write tenant B's data |
| Hot path performance | Called > 10k times/day per tenant, on a critical user journey |
| Unattended background | Cron jobs, workers, scheduled tasks, webhooks |
| External contract | Public API, webhook sender, third-party integration |
| Hard to rollback | Schema changes, irreversible state transitions, email/SMS sends |
| Compliance-relevant | GDPR, CCPA, PCI, HIPAA, SOC2 audit trail |
| Cost-sensitive at scale | Storage/egress/compute that grows per user and can blow a budget |

Skip `+saas` when it's a prototype, internal tool, or low-traffic feature with a contained blast
radius and no tenancy/scale/cost concern.

See `classification-examples-saas.md` for 10+ worked SaaS examples.

---

## +ai signals (turn on the AI product track)

Turn on `+ai` if **any** are true:

| Signal | Example |
|---|---|
| Autonomous action | Agent that writes to DB, calls APIs, sends emails, executes code |
| User-facing generation | Chatbot reply, generated draft, summary shown to a user |
| User input → model | Any path where user text/image/file reaches an LLM (injection surface) |
| Quality-sensitive output | Users judge the product by output quality (writing/coding helpers, RAG) |
| Regulated domain via AI | Legal/medical/financial guidance produced by a model |
| High volume / cost risk | > 10k LLM calls/day or > $500/month in tokens |
| Hard to undo AI output | Generated emails actually sent, posts published, code committed |
| PII to a model provider | User PII flows to a third-party model (DPA considerations) |

Skip `+ai` when there is no LLM/agent/embedding in the path, or it's a throwaway prototype not
shown to users. Internal, advisory, low-volume, non-regulated AI assists may take `+ai` with a
**minimal** eval set rather than the full rigor (note this in `classification.md`).

See `classification-examples-ai.md` for worked AI examples across chatbots, RAG, and agents.

---

## How tracks combine — what each artifact set looks like

| Track set | Artifacts in `.specs/<feature>/` |
|---|---|
| `core` | `classification.md`, `requirements.md`, `design.md`, `quickstart.md`, `checklist.md`, `tasks.md` |
| `core +tdd` | + `test-plan.md`, `tests/` (failing first) |
| `core +saas` | design gains 5 scale sections; + `load-test.md` (hot path); observability/cost tasks |
| `core +ai` | design gains 10 AI sections; + `eval-plan.md`, `prompts/`, `evals/` |
| `core +tdd +saas` | TDD red-green + scale sections + load test + tenant-isolation tests |
| `core +ai +saas` | AI sections + scale sections + eval gate + cost/observability validation |
| `core +tdd +ai` | deterministic TDD for plumbing **and** eval gate for generation |
| `core +tdd +saas +ai` | the full pipeline — every gate applies |

**Design sections are additive:** `+saas` adds its 5 mandatory sections, `+ai` adds its 10, on
top of the base design. A blank mandatory section is never acceptable — an honest "not needed
because X" is.

**Execution loop is chosen per task by track:**
- Deterministic task on `+tdd` → red → green → refactor → `spec_complete_task {evidence}`.
- Generation/prompt task on `+ai` → prompt-iteration loop gated on eval delta → `spec_complete_task {evidence}`.
- Plain task on `core` only → implement → run existing tests + its `_Verify:_` → `spec_complete_task {evidence}`.
- `+saas` hot path → load-test task at the end must pass before "done".

---

## `classification.md` format

```markdown
# Classification: [Feature Name]

## Mode
Spec | Vibe

## Active Tracks
core [+tdd] [+saas] [+ai]

## Signals
- **+tdd:** [signal from table] — [why it applies] (omit section if track off)
- **+saas:** [signal] — [why]
- **+ai:** [signal] — [why]

## Blast Radius
[What breaks if this is wrong? Who is affected? Is it recoverable? How fast?]

## Hot Path?  (only if +saas)
[Yes/No — if yes, load-test.md is required.]

## Autonomy Level  (only if +ai)
[Advisory | Semi-autonomous (human confirms) | Autonomous (acts within policy)]

## Volume / Cost Projection  (if +saas or +ai)
- Launch / 6 months / 2 years: [calls or req per day, ~$ per month]

## Compliance Tags
[GDPR | PCI | HIPAA | SOC2 | none] — does user PII reach a third party / model provider?
```

The track set chosen here drives every later phase and is stored per feature. Changing it mid-feature
is allowed — `spec_add_track` (`/add-track`) adds one additively, and `remove: true` (`--remove`)
takes one off without deleting any file — but it should be a deliberate, recorded decision.
