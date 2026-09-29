# Classification & Track Routing

This is the brain of `dev-spec-driven`. Every feature in Spec mode passes through **Phase 0**,
which answers one question: **which tracks apply to this feature?**

Tracks are **composable** — a feature is not "a SaaS feature" *or* "an AI feature". A billing
webhook in a multi-tenant product that also calls an LLM is `core + tdd + saas + ai`. The track
set determines which artifacts, design sections, and execution loop the feature uses.

---

## The seven tracks

| Track | Adds | Activated when… |
|---|---|---|
| **core** | EARS requirements → design → tasks → execute (the base flow) | always (every Spec-mode feature) |
| **+tdd** | Test Plan + failing-tests-first + red-green-refactor execution | correctness matters / it's hard to undo |
| **+saas** | 5 mandatory scale design sections, multi-tenancy, observability, cost, load test | production system with real users at scale |
| **+ai** | Eval plan, prompts-as-code, token economics, safety, model lifecycle, eval-gated execution | feature quality depends on LLM/agent/embedding output |
| **+sec** | 5 mandatory `[SEC]` sections (STRIDE threat model, ASVS level, authn/authz, secrets, security testing), 3 criteria, abuse-case tests, `security.md` | a mistake here is a breach, not just a bug |
| **+privacy** | 6 mandatory `[PRIVACY]` sections (data inventory, lawful basis, retention, data subject rights, processors & transfers, DPIA), 3 criteria, `privacy.md` | it collects, stores, shares, profiles or deletes personal data |
| **+dist** | 5 mandatory `[DIST]` sections (consistency model, cross-system writes, delivery & idempotency, concurrency, failure modes), 4 criteria, failure-injection tests, `distributed.md` | one write reaches more than one system, or delivery, idempotency, concurrency or partial failure matter |

`core` is always on. The other six are added independently based on the signals below.

### How `spec_classify` weighs a signal

The classifier is a local keyword heuristic (EN/PT/ES, whole words — never substrings — negation-aware). Its output
is a draft for the human, who confirms Phase 0.

- **Strong** signals turn a track on alone; **weak** ones need a second signal: score = 2 × strong + weak, a track
  turns ON at 2 (one strong, or two weak — then a note says "on from weak signals only — double-check"), and a lone
  weak signal is reported as **possible** (a note), not enabled.
- **Corroborating-only** signals (`permission` / `permissão` / `permiso`, `at rest` / `in transit` and their PT/ES
  forms for +sec; `transaction`, `consistency`, `atomic` for +dist) count as weak evidence only beside another signal of the
  same track ("RBAC permissions", "encrypt customer PII at rest"); alone they are no hint at all (file permission bits, a
  leave of absence, a parcel in transit).
- A weak word inside a longer strong phrase (of another track, or of its own) is part of that phrase: `model` in "threat
  model" is no +ai hint, `security` in "row-level security" no +sec one. A phrase may count for two tracks when it names
  both concerns: "message queue" is strong for +dist and weak for +saas (a queue is a +saas scaling hint too).
- **Generic** signals (+dist only — app-level words: queue, retry, consumer / producer, subscriber, publish … event,
  worker) add to the score but never turn the track on alone: at least one strong or weak (cross-system) signal must be
  there. "Print queue: … retry failed prints" stays *possible* (a note names the app-level words). Words of **one
  concept** count once: retry · backoff · jitter, consumer · producer · subscriber, dedupe · deduplicate.
- Auth words (`authentication`, `authorization`, `RBAC`, `MFA`) are **strong for +tdd and weak for +sec**: "login with a
  password" is `core +tdd` with a possible +sec note; "login with a password, RBAC and an audit log" turns +sec on.
- Upper-case acronyms are matched case-sensitively where the lower-case word means something else: `STRIDE` (weak +sec)
  — a lower-case "stride" is an array stride; `CDC` (weak +dist).
- A word may serve two tracks: `exactly-once` is strong for +tdd and +dist, `idempotent` / `webhook` strong for +saas and
  weak for +dist. A gap phrase (`publish … event`, +dist) matches up to three words between its parts.
- **Negation never vetoes a track**, it annotates it: "no personal data" keeps +privacy off and says so; a negated
  keyword on a track that is ON anyway ("the system shall not hallucinate") comes back as a conflict note to review.
  A +dist **hazard** (lost update, oversell, race condition, duplicate delivery, write skew, split brain) is written
  negated by nature — "concurrent updates never oversell" — so its negation is the requirement: it counts.

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
   track on. (A spike — a question to answer, not a feature — is `/spec-spike`, core-only; an architecture that is
   the input rather than the output takes the design-first order — see `design-first.md`.)
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
| Compliance-relevant | PCI, SOC2 audit trail (GDPR / RGPD, CCPA, HIPAA — personal data — turn on `+privacy` instead) |
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

## +sec signals (turn on the security track)

Turn on `+sec` if **any** are true:

| Signal | Example |
|---|---|
| Credentials and sessions | Login, password reset, API keys, tokens, MFA — beyond the happy path |
| Trust boundary | A public endpoint, a webhook receiver, a file upload, a third-party callback |
| Who may do what | Roles, permissions, object-level authorization, admin functions |
| Secrets or keys | The feature stores, rotates or uses secrets, encryption keys, signing keys |
| Security explicitly in scope | A threat model, a pentest finding, an OWASP / ASVS requirement, a CVE to fix |

Classifier signals — **strong:** threat model, OWASP, XSS, CSRF, SQL / command injection, pentest, vulnerability, CVE,
ASVS, secrets management, encryption at rest / in transit, security audit / review / test, SAST / DAST, attack surface,
privilege escalation, SSRF, credential stuffing, zero trust, mTLS, content security policy (and their PT/ES forms:
*modelo de ameaças, teste de intrusão, gestão de segredos · modelo de amenazas, prueba de penetración*). **Weak:**
authentication, authorization, RBAC, access control, access / refresh token, API key, credential, encryption, TLS,
CORS, audit log, input validation, security, hardening, least privilege, MFA / 2FA, brute force, `STRIDE` (and the
encryption verbs *encriptar, cifrar, criptografar*).
**Corroborating only:** permission, at rest, in transit. Never a bare "injection" (dependency injection) or "https".

Skip `+sec` when the feature crosses no trust boundary and handles nothing sensitive (a static page, an internal
report over public data). Details: `security-track.md`.

---

## +privacy signals (turn on the privacy track)

Turn on `+privacy` if **any** are true:

| Signal | Example |
|---|---|
| Personal data collected or stored | Sign-up, profiles, contact forms, support tickets, IP / device IDs, location |
| Personal data shared or processed elsewhere | An analytics or email provider, an LLM provider, an export to a partner |
| Profiling or special categories | Recommendations about a person, health, biometric or financial data |
| Data subject rights | Account deletion, data export, consent management, retention jobs |
| Regulation named | GDPR / RGPD, LGPD, CCPA, HIPAA, a DPIA |

Classifier signals — **strong:** GDPR, RGPD, LGPD, CCPA / CPRA, HIPAA, personal data, PII, DPIA, data protection, data
subject, right to erasure / to be forgotten, data portability, data retention, anonymization / pseudonymization, data
minimisation, data processing agreement, privacy by design / policy / notice, special category data, data controller /
processor, international transfer, standard contractual clauses (*dados pessoais, titular dos dados, AIPD, CNPD ·
datos personales, derecho de supresión, EIPD, AEPD*). **Weak:** user / customer data, user profile, email address,
phone number, date of birth, cookie, user tracking, geolocation, biometric, health data, opt-in / opt-out, unsubscribe,
privacy, account deletion, data export, DPA, **consent**, retention period / policy — generic alone (an OAuth consent
screen, a trash folder's retention) until a second privacy signal corroborates them.

Since 1.14, GDPR / RGPD / HIPAA turn `+privacy` on, not `+saas`. Skip `+privacy` when no information about an
identifiable person is involved. Details (not legal advice): `privacy-track.md`.

## +dist signals (turn on the distributed systems & data consistency track)

Turn on `+dist` if **any** are true:

| Signal | Example |
|---|---|
| One write reaches more than one system | Save to the database AND publish an event, update a cache, call another service or an external API |
| Messaging | A broker (Kafka, RabbitMQ, SQS), consumers / producers, webhooks received or sent, retries, a DLQ |
| A business transaction across services | Order → payment → stock → shipping (a saga), microservices sharing an outcome |
| Concurrency on shared data | Two requests updating one row, counters, stock, seats, double submits |
| Consistency is a product decision | Read replicas, a search index or another service's copy that may lag; CQRS / event sourcing |
| Partial failure matters | A dependency that can be down or slow while the feature must keep working or recover |

Classifier signals — **strong:** Kafka, RabbitMQ, ActiveMQ, AMQP, SQS, Kinesis, EventBridge, Debezium, Google / Cloud
Pub/Sub, a Pub/Sub topic, `NATS`, Apache Pulsar, Azure Event Hubs, Sidekiq, BullMQ, Resque, NServiceBus, MassTransit,
`Temporal workflow` / `Celery task` / `CDC pipeline` (capitalised — "temporal" is a PT / ES adjective, celery a vegetable),
message broker / queue / bus, event broker, event-driven architecture, event sourcing, domain / integration event, CQRS,
transactional outbox, outbox pattern / table, inbox pattern, idempotent consumer, dual write, eventual / strong
consistency, read-your-writes, distributed transaction / system / lock / cache, two-phase commit (`2PC`, exact),
microservice(s), change data capture, exactly-once, at-least-once delivery, saga pattern / orchestration, compensating
transaction, optimistic / pessimistic locking, isolation level, write skew, lost update, network partition, split brain,
read replica, replication lag (and their PT / ES forms: *fila de mensagens, consistência eventual, transação distribuída,
microsserviço, bloqueio otimista, nível de isolamento · cola de mensajes, consistencia eventual, transacción distribuida,
microservicio, bloqueo optimista, nivel de aislamiento*). **Weak** (a second system or a delivery / concurrency concern):
webhook, idempotency, at-least-once / at-most-once, duplicate delivery / message / event, delivered twice, other /
another / downstream services, cross-service, a service named by its role (the notification / payment / billing / order
/ shipping / inventory service), exponential backoff, replication, cache invalidation, saga, `CDC` (upper case — also a
health agency), dead letter, DLQ, poison message, circuit breaker, concurrent updates / writes, "update … lost",
"overwrite each other", a version column, clock skew, message ordering, event bus / stream, event-driven, leader
election, Redis, a search index, Elasticsearch, gRPC (*outros serviços, serviço de pagamentos, replicação, recuo
exponencial · otros servicios, servicio de pagos, replicación, retroceso exponencial*). **Generic** (only beside a strong
or weak one): queue, consumer, producer, subscriber, retry / retries, jitter, deduplication, race condition, pub/sub,
**publish … event / message**, **send … message** (gap phrases: up to three words between — "publishes a UserCreated
event"), exactly once, event store, outbox, worker, background job, "keep … in sync", oversell, compensate,
concurrently (*fila, consumidor, nova tentativa, publica … evento, envia … mensagem, pelo menos uma vez, em simultâneo ·
cola, reintento, publica … mensaje, al menos una vez*). **Corroborating only:** transaction, consistency, atomic(ity).
Never a bare "event" (DOM / calendar / analytics events), "lock" (an account lock), "stream" (video) or "broker".

The canonical example — *"Create an endpoint that writes a user to Postgres and publishes a UserCreated event to Kafka
for other services"* — is `core +dist` in EN, PT and ES. Skip `+dist` when every write stays in one database and no
other system consumes the result (a CRUD screen over one table). Details and patterns: `distributed-data-patterns.md`.

Worked examples (what `spec_classify` answers):

| Description | Result | Signals |
|---|---|---|
| Create an endpoint that writes a user to Postgres and publishes a UserCreated event to Kafka for other services | `core +dist` | kafka, other services, publish … event |
| … the same without Kafka ("publishes a UserCreated event for other services") | `core +dist` (weak-only) | other services (the anchor), publish … event |
| Split billing into its own microservice | `core +tdd +dist` | microservice (billing → +tdd) |
| Implement checkout as a saga with compensating transactions across the order and payment services | `core +tdd +dist` | compensating transaction, saga |
| Use optimistic locking so concurrent updates to the cart never overwrite each other | `core +dist` | optimistic locking, concurrent updates |
| Queue the welcome email and retry with exponential backoff | `core +dist` (weak-only) | exponential backoff (+ retry: one concept), queue |
| Receive Stripe webhooks idempotently and retry failed deliveries | `core +saas +dist` | webhook, idempotent, retry |
| Use a message queue and a background worker to send emails | `core +saas +dist` | message queue (+dist strong, +saas weak), worker |
| Print queue: users send documents to the printer queue and can retry failed prints | `core`, *possible +dist* | queue, retry (generic only) |
| *Publicar eventos no Kafka.* | `core +dist` | kafka (PT: "no" is *em + o*), publica … evento |
| *Sincronizar o stock entre serviços com consistência eventual e um outbox transacional* | `core +dist` | outbox transacional, consistência eventual |
| *Reintentar los pagos fallidos con retroceso exponencial y una cola de mensajes* | `core +tdd +dist` | cola de mensajes, reintento, retroceso exponencial |
| Retry the image upload when the network drops | `core`, *possible +dist* | retry |
| Organizers can publish an event and sell tickets | `core`, *possible +dist* | publish … event |
| Create an endpoint that writes a user to Postgres and returns it | `core` | — |
| Plain CRUD endpoint for users, no Kafka and no events | `core` (+dist kept off, noted) | kafka (negated) |

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
| `core +sec` | design gains 5 `[SEC]` sections; `[SEC]` criteria US-1.AC-10..12; security tasks; `steering/security.md` |
| `core +privacy` | design gains 6 `[PRIVACY]` sections; `[PRIVACY]` criteria US-1.AC-13..15; privacy tasks; `steering/privacy.md` |
| `core +tdd +sec +privacy` | a typical sign-up / account feature: abuse-case and data-rights tests in the test plan |
| `core +dist` | design gains 5 `[DIST]` sections; `[DIST]` criteria US-1.AC-16..19; outbox / inbox / concurrency / resilience / failure-injection tasks; `steering/distributed.md` |
| `core +tdd +saas +dist` | a checkout across services: saga, outbox, idempotent consumers, failure-injection and property tests, load test |

**Design sections are additive:** `+saas` adds its 5 mandatory sections, `+ai` its 10, `+sec` its 5, `+privacy`
its 6 and `+dist` its 5, on top of the base design. A blank mandatory section is never acceptable — an honest "not needed because X" is.
The section markers (`[SaaS]`, `[AI]`, `[SEC]`, `[PRIVACY]`, `[DIST]`) are English in every language and case-sensitive.

**Execution loop is chosen per task by track:**
- Deterministic task on `+tdd` → red → green → refactor → `spec_complete_task {evidence}`.
- Generation/prompt task on `+ai` → prompt-iteration loop gated on eval delta → `spec_complete_task {evidence}`.
- Plain task on `core` only → implement → run existing tests + its `_Verify:_` → `spec_complete_task {evidence}`.
- `+saas` hot path → load-test task at the end must pass before "done".
- `+sec` → the security-testing task's `_Verify:_` runs the scans and the abuse-case tests; `+privacy` → data subject
  rights verified end to end before "done"; `+dist` → the failure-injection tests (crash between commit and publish,
  duplicate delivery, concurrent updates, a dependency down) green before "done".

---

## `classification.md` format

```markdown
# Classification: [Feature Name]

## Mode
Spec | Vibe

## Active Tracks
core [+tdd] [+saas] [+ai] [+sec] [+privacy] [+dist]

## Signals
- **+tdd:** [signal from table] — [why it applies] (omit section if track off)
- **+saas:** [signal] — [why]
- **+ai:** [signal] — [why]
- **+sec:** [signal] — [why]
- **+privacy:** [signal] — [why]
- **+dist:** [signal] — [why]

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

The track set chosen here drives every later phase and is stored per feature. Changing it mid-feature
is allowed — `spec_add_track` (`/add-track`) adds one additively, and `remove: true` (`--remove`)
takes one off without deleting any file — but it should be a deliberate, recorded decision.
