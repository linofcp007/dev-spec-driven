# Classification & track routing (Phase 0)

Phase 0 answers one question: **which tracks does this feature need?** Tracks compose — a billing webhook in a
multi-tenant product that also calls an LLM is `core +tdd +saas +ai` — and the set decides which artifacts, design
sections and execution loop the feature gets. `spec_classify` drafts the answer from the description; you confirm it
with the human. Read the procedure, then only the section of a track you doubt.

## The decision procedure

1. **Pick the mode.**
   - Casual language ("just", "quick fix", "nothing fancy"), a single file, < 30 min → **Vibe** (no artifacts, no
     tracks — just build it).
   - A contained change to a flow that **already exists** in the repo (a flag, a small endpoint, a one-file behaviour
     change) → **Bounded** (a short design in chat, an explicit yes, no artifacts).
   - A real **defect** (it worked, or is specified to work, and doesn't) → the bugfix flow, **`/spec-bugfix`**
     (`spec_create {kind: "bugfix"}`: reproduce → root cause → regression test → fix; always `+tdd`). See `bugfix.md`.
   - A question to answer, not a feature → a spike (`spec_create {kind: "spike"}`, core only); an architecture that is
     the input rather than the output → the design-first order. See `design-first.md`.
   - Everything else → **Spec**. When torn between two modes, take the heavier one.
2. **In Spec mode, check the tracks.** `spec_classify` returns the suggested set, the words behind each track and
   notes — a *possible* track (one weak word, or app-level words only), a negated keyword, a correction this project
   learned. Any row of a track's table below that matches turns the track on, whatever the classifier said.
3. **Present for approval** the mode, the track set, the signals behind each, the size and the blast radius. If the
   user disagrees, adjust the set before requirements.
4. **After approval**, `spec_init {tracks, lang}` if steering is missing, then `spec_create {name, tracks, size,
   summary, lang}` once — at size m / l (or no size) it seeds `classification.md` (format below), where you record the
   decision. Pass the description you classified as `summary`: when the chosen tracks differ from the suggestion, the
   correction is recorded for this project (`.specs/classifier.json`; after two consistent corrections a word the team
   keeps rejecting stops turning the track on, and one it keeps adding starts to — `spec_tracks {action: "signals"}`
   lists, sets or forgets them).

**When unsure whether a track applies, turn it on.** Over-investing rigor on a feature that turns out simple costs a
little time; under-investing on one that turns out critical costs an incident, lost data, a breach or a runaway bill.

## The built-in tracks

| Track | Adds | Turn on when… |
|---|---|---|
| **core** | EARS requirements → design → tasks → execute | always |
| **+tdd** | test plan, failing tests first, red-green-refactor | correctness matters / it's hard to undo |
| **+saas** | 5 scale sections, multi-tenancy, observability, cost, load test | a production system with real users at scale |
| **+ai** | eval plan, prompts as code, token economics, safety, model lifecycle, eval-gated execution | quality depends on LLM / agent / embedding output — or a trained model's |
| **+sec** | 5 `[SEC]` sections (STRIDE, ASVS, authn/authz, secrets, security testing), abuse-case tests, `security.md` | a mistake here is a breach, not just a bug |
| **+privacy** | 6 `[PRIVACY]` sections (inventory, lawful basis, retention, subject rights, processors, DPIA), `privacy.md` | it collects, stores, shares, profiles or deletes personal data |
| **+dist** | 5 `[DIST]` sections (consistency, cross-system writes, delivery, concurrency, failure modes), failure-injection tests | one write reaches more than one system, or delivery, idempotency, concurrency or partial failure matter |
| **+api** | 5 `[API]` sections (contract, versioning, error model, pagination / idempotency, rate limits), contract tests | other code depends on the API's contract — public, partner or internal |
| **+ui** | 5 `[UI]` sections (design system, UI states, accessibility, responsiveness & i18n, performance budget) | a user-facing screen, component or flow |
| **+obs** | 5 `[OBS]` sections (SLIs & SLOs, telemetry, alerting & runbooks, rollout & rollback, health & capacity) | a service people depend on staying up |
| **+data** | 5 `[DATA]` sections (contracts, data quality, idempotency & backfills, lineage, retention & cost) | data moves between stores on a schedule or a stream, and the feature owns its quality |

Each marker track also brings its criteria and its steering file; what every track adds at each phase:
`track-checklists.md`. A team's own track is a pack in `.specs/tracks/<name>/` (`project-tracks.md`).

## +tdd

| Signal | Example |
|---|---|
| Financial correctness | Billing, payments, refunds, credits, invoicing, metering |
| Auth / authorization | Login, sessions, RBAC, SSO, API tokens, password reset |
| Data integrity | Writes that can't be undone, migrations, imports, dedup logic |
| Complex branching logic | State machines, pricing rules, eligibility, scheduling |
| Known-tricky / bug-prone | Date/timezone math, concurrency, parsing, money rounding |
| Regression-sensitive | A bug here has bitten before, or would be silent and costly |
| User explicitly asked | "TDD this", "tests first", "no code without a test" |

Skip only when behaviour is well-understood, regressions are cheap and obvious, and the code is largely glue / UI.

## +saas

| Signal | Example |
|---|---|
| Multi-tenant boundary | Anything where tenant A could read/write tenant B's data |
| Hot path performance | Called > 10k times/day per tenant, on a critical user journey |
| Unattended background | Cron jobs, workers, scheduled tasks, webhooks |
| External contract | Public API, webhook sender, third-party integration |
| Hard to rollback | Schema changes, irreversible state transitions, email/SMS sends |
| Compliance-relevant | PCI, a SOC2 audit trail (personal data — GDPR / RGPD, CCPA, HIPAA — is `+privacy`) |
| Cost-sensitive at scale | Storage/egress/compute that grows per user and can blow a budget |

Skip for a prototype, an internal tool or a low-traffic feature with a contained blast radius and no tenancy, scale or
cost concern. Worked examples: `classification-examples-saas.md`.

## +ai

| Signal | Example |
|---|---|
| Autonomous action | An agent that writes to a DB, calls APIs, sends emails, executes code |
| User-facing generation | A chatbot reply, a generated draft, a summary shown to a user |
| User input → model | Any path where user text / image / file reaches an LLM (the injection surface) |
| Quality-sensitive output | Users judge the product by output quality (writing / coding helpers, RAG) |
| Regulated domain via AI | Legal / medical / financial guidance produced by a model |
| High volume / cost risk | > 10k LLM calls/day or > $500/month in tokens |
| Hard to undo AI output | Generated emails actually sent, posts published, code committed |
| PII to a model provider | User PII flows to a third-party model (DPA considerations) |

Skip when no LLM / agent / embedding / trained model is in the path, or for a throwaway prototype not shown to users.
Internal, advisory, low-volume, non-regulated AI assists may take `+ai` with a **minimal** eval set rather than the full
rigor — note it in `classification.md`. Worked examples: `classification-examples-ai.md`.

## +sec

| Signal | Example |
|---|---|
| Credentials and sessions | Login, password reset, API keys, tokens, MFA — beyond the happy path |
| Trust boundary | A public endpoint, a webhook receiver, a file upload, a third-party callback |
| Who may do what | Roles, permissions, object-level authorization, admin functions |
| Secrets or keys | The feature stores, rotates or uses secrets, encryption keys, signing keys |
| Security explicitly in scope | A threat model, a pentest finding, an OWASP / ASVS requirement, a CVE to fix |

Skip when the feature crosses no trust boundary and handles nothing sensitive (a static page, an internal report over
public data). Details: `security-track.md`.

## +privacy

| Signal | Example |
|---|---|
| Personal data collected or stored | Sign-up, profiles, contact forms, support tickets, IP / device IDs, location |
| Personal data shared or processed elsewhere | An analytics or email provider, an LLM provider, an export to a partner |
| Profiling or special categories | Recommendations about a person, health, biometric or financial data |
| Data subject rights | Account deletion, data export, consent management, retention jobs |
| Regulation named | GDPR / RGPD, LGPD, CCPA, HIPAA, a DPIA |

Skip when no information about an identifiable person is involved. Details (not legal advice): `privacy-track.md`.

## +dist

| Signal | Example |
|---|---|
| One write reaches more than one system | Save to the database AND publish an event, update a cache, call another service or an external API |
| Messaging | A broker (Kafka, RabbitMQ, SQS), consumers / producers, webhooks received or sent, retries, a DLQ |
| A business transaction across services | Order → payment → stock → shipping (a saga), microservices sharing an outcome |
| Concurrency on shared data | Two requests updating one row, counters, stock, seats, double submits |
| Consistency is a product decision | Read replicas, a search index or another service's copy that may lag; CQRS / event sourcing |
| Partial failure matters | A dependency that can be down or slow while the feature must keep working or recover |

Skip when every write stays in one database and no other system consumes the result (a CRUD screen over one table).
Patterns: `distributed-data-patterns.md`.

## +api

| Signal | Example |
|---|---|
| Other code depends on the API's contract | A public or partner API, an SDK you ship, a mobile client that updates months later, another team's service |
| The contract is an artifact | An OpenAPI / Swagger document, `.proto` files, a GraphQL schema — contract-first design, contract tests |
| Compatibility is a decision | Versioning, deprecation, "no breaking changes for existing clients" |
| The contract fixes behaviour | Error bodies (problem+json, stable codes), pagination, Idempotency-Key, ETag / If-Match, rate-limit headers |

Someone else's API that the feature only calls is no contract of ours, and an API **key** is +sec's concern. Patterns:
`api-design-patterns.md`.

## +ui

| Signal | Example |
|---|---|
| A user-facing screen, component or flow is the work | A settings / admin / profile page, a checkout flow, a new component |
| The design system is involved | Tokens, the component library, Storybook, Figma designs, dark mode |
| Accessibility matters | WCAG 2.2 AA, a screen reader, keyboard navigation, contrast, alt text |
| The states or the layout are the risk | Empty / loading / error states, responsive layout, right-to-left, Core Web Vitals |

Backend-only work behind a screen is no UI work. Patterns: `ui-design-patterns.md`.

## +obs

| Signal | Example |
|---|---|
| Someone depends on it being up | An SLO, an error budget, a critical journey, an on-call rotation |
| It must be watchable | Metrics, structured logs with a correlation ID, distributed tracing (OpenTelemetry) — named as the work |
| It must be safe to ship and undo | Feature flags, a canary / progressive rollout, a rollback plan, zero-downtime deploys |
| It must say when it is broken | Alerts with runbooks, PagerDuty / Opsgenie, health / readiness checks, incident response |

Business monitoring (stock levels, price alerts to users) and a sales dashboard are no operability work. Patterns:
`observability-patterns.md`.

## +data

| Signal | Example |
|---|---|
| Data moves between stores on a schedule or a stream | An ETL / ELT job, a data pipeline, an Airflow DAG, dbt models, a Spark job, ingestion into a warehouse / lake |
| Consumers depend on the numbers | A data warehouse / mart, fact and dimension tables, BI reports fed by the pipeline, a freshness SLA |
| The data's quality is the feature's job | Data-quality checks, quarantined rows, schema evolution / data contracts, lineage |
| History has to be (re)computed | A backfill of past partitions, late-arriving data, slowly changing dimensions, idempotent re-runs |

A table migration, a CSV export or the warehouse building are no pipeline. Patterns: `data-pipeline-patterns.md`.

## What each track set scaffolds

`core`: `classification.md` (m / l), `requirements.md`, `design.md`, `quickstart.md`, `checklist.md`, `tasks.md`. +tdd
adds `test-plan.md` and the failing tests; +ai `eval-plan.md`, `prompts/`, `evals/`; +saas a `load-test.md` on a hot
path. Design sections are additive — +saas 5, +ai 10, +sec 5, +privacy 6, +dist / +api / +ui / +obs / +data 5 each — on
top of the base design, with their criteria (`US-1.AC-10` … `US-1.AC-35`) and steering files. A blank mandatory
section is never acceptable; an honest "not needed because X" is. The section markers (`[SaaS]`, `[AI]`, `[SEC]`,
`[PRIVACY]`, `[DIST]`, `[API]`, `[UI]`, `[OBS]`, `[DATA]`) are English in every language and case-sensitive.

## `classification.md` format

```markdown
# Classification: [Feature Name]

## Mode
Spec | Vibe

## Active Tracks
core [+tdd] [+saas] [+ai] [+sec] [+privacy] [+dist] [+api] [+ui] [+obs] [+data]

## Signals
- **+tdd:** [signal from table] — [why it applies] (omit section if track off)
- **+saas:** [signal] — [why]
- **+ai:** [signal] — [why]
- **+sec:** [signal] — [why]
- **+privacy:** [signal] — [why]
- **+dist:** [signal] — [why]
- **+api:** [signal] — [why]
- **+ui:** [signal] — [why]
- **+obs:** [signal] — [why]
- **+data:** [signal] — [why]

## Blast Radius
[What breaks if this is wrong? Who is affected? Is it recoverable? How fast?]

## Hot Path?  (only if +saas)
[Yes/No — if yes, load-test.md is required.]

## Autonomy Level  (only if +ai)
[Advisory | Semi-autonomous (human confirms) | Autonomous (acts within policy)]

## Volume / Cost Projection  (if +saas or +ai)
- Launch / 6 months / 2 years: [calls or req per day, ~$ per month]

## Compliance Tags
[GDPR | PCI | HIPAA | SOC2 | none] — does user PII reach a third party / model provider? (GDPR / HIPAA → `+privacy`)
```

The set chosen here drives every later phase and is stored per feature. Changing it mid-feature is allowed —
`spec_add_track` adds one additively, `remove: true` takes one off without deleting a file — as a deliberate, recorded
decision.
