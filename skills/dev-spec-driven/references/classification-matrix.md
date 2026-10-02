# Classification & Track Routing

This is the brain of `dev-spec-driven`. Every feature in Spec mode passes through **Phase 0**,
which answers one question: **which tracks apply to this feature?**

Tracks are **composable** — a feature is not "a SaaS feature" *or* "an AI feature". A billing
webhook in a multi-tenant product that also calls an LLM is `core + tdd + saas + ai`. The track
set determines which artifacts, design sections, and execution loop the feature uses.

---

## The built-in tracks

| Track | Adds | Activated when… |
|---|---|---|
| **core** | EARS requirements → design → tasks → execute (the base flow) | always (every Spec-mode feature) |
| **+tdd** | Test Plan + failing-tests-first + red-green-refactor execution | correctness matters / it's hard to undo |
| **+saas** | 5 mandatory scale design sections, multi-tenancy, observability, cost, load test | production system with real users at scale |
| **+ai** | Eval plan, prompts-as-code, token economics, safety, model lifecycle, eval-gated execution | feature quality depends on LLM/agent/embedding output |
| **+sec** | 5 mandatory `[SEC]` sections (STRIDE threat model, ASVS level, authn/authz, secrets, security testing), 3 criteria, abuse-case tests, `security.md` | a mistake here is a breach, not just a bug |
| **+privacy** | 6 mandatory `[PRIVACY]` sections (data inventory, lawful basis, retention, data subject rights, processors & transfers, DPIA), 3 criteria, `privacy.md` | it collects, stores, shares, profiles or deletes personal data |
| **+dist** | 5 mandatory `[DIST]` sections (consistency model, cross-system writes, delivery & idempotency, concurrency, failure modes), 4 criteria, failure-injection tests, `distributed.md` | one write reaches more than one system, or delivery, idempotency, concurrency or partial failure matter |
| **+api** | 5 mandatory `[API]` sections (API contract, versioning & compatibility, error model, pagination / idempotency / concurrency, rate limits & quotas), 4 criteria, contract tests + a breaking-change diff, `api.md` | other code depends on the API's contract — public, partner or internal: a versioned API, OpenAPI / GraphQL / gRPC, SDKs |
| **+ui** | 5 mandatory `[UI]` sections (design-system usage, UI states, accessibility, responsiveness & i18n, UI performance budget), 4 criteria, accessibility + visual-regression tests, `ui.md` | a user-facing screen, component or flow: a design system, accessibility (WCAG), responsive layout, dark mode, a settings / admin page |
| **+obs** | 5 mandatory `[OBS]` sections (SLIs & SLOs, telemetry, alerting & runbooks, rollout & rollback, health & capacity), 4 criteria, operability tests (an alert in a staged failure, a rollback drill, fault injection), `observability.md` | a service people depend on: SLOs, error budgets, alerting, on-call, runbooks, tracing, feature flags, a canary / progressive rollout |
| **+data** | 5 mandatory `[DATA]` sections (data contracts & schema evolution, data quality, pipeline idempotency & backfills, lineage & ownership, retention & cost), 4 criteria, data-quality / re-run / backfill / schema-change tests, `data.md` | data that moves between stores on a schedule or a stream and whose quality the feature owns: ETL / ELT, a warehouse or a lake, dbt / Airflow / Spark jobs, backfills, lineage, freshness SLAs |

`core` is always on. The others are added independently based on the signals below.

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
- **Generic** signals (app-level words — +dist: queue, retry, consumer / producer, subscriber, publish … event, worker;
  +api: api, endpoint, route, request, pagination; +ui: screen, page, form, button, dialog, dashboard, menu, icon; +obs: metrics, logs, latency, p99, monitor, deploy; +data: analytics, dataset, partition, transformation, a batch / nightly job, ingest, upsert, a data engineer) add to the score but never turn the track on alone: at least one strong
  or weak signal of that track must be there. "Print queue: … retry failed prints" stays *possible* (a note names the app-level words). Words of **one
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
  negated by nature — "concurrent updates never oversell" — so its negation is the requirement: it counts. So is a +api
  breaking change ("without breaking changes", "sem alterações incompatíveis", "sin cambios incompatibles") and a +obs outage
  ("without downtime", "sem indisponibilidade"), a +data duplicate row or stale data ("without duplicate rows").
- **A negation reaches the whole list it opens** (1.21), for every track: "We will not add feature flags or canary
  releases", *"Não vamos usar feature flags nem lançamento canário"*, *"No usaremos feature flags ni despliegue canario"*,
  "without Kafka, RabbitMQ or SQS", "neither … nor" — each item is negated. It stops at "and" (often a new predicate: "without
  downtime and roll back on errors"), at a contrast word ("no feature flags, just a canary release" keeps the canary release)
  and at a comma no "or" closes ("Without feature flags, the canary release is done by hand"); a comma after the list's
  closing "or" ends it too ("Without an LLM or embeddings, the checkout or a subscription page is the priority" keeps +tdd),
  and a comma + an article joins only an item of the list's own track with no predicate after it ("Without an LLM, a vector
  database or embeddings" is one list; "No LLM, the checkout or the subscription flow first" keeps +tdd).
  **What a negation negates:** a negation EXCLUDES a keyword only when it certainly governs it — anything else keeps the
  track (an extra track is a one-word removal in Phase 0; a missing one loses rigor). Certain: a nominal negator with only
  articles, quantifiers or a modifier before the keyword ("no payments", "without real-time Kafka", *"sem Kafka"*, "Postgres,
  not MongoDB nor Kafka") or a list it opened; an adoption verb (use / add / need / include / implement / integrate / deploy /
  run / offer / provide / ship / adopt / involve / enable / activate / install / embed / bundle / expose, "necessary" —
  *usar, adicionar, integrar, adotar, ativar, instalar, expor, precisar · usar, añadir, integrar, desplegar, activar, exponer,
  necesitar, es necesario, hace falta*), whatever the modal ("must not use X or Y", "We should not enable feature flags yet",
  "We must not expose GraphQL"), or a plan / an intention (will / do / going to, want / plan / intend — *vamos, iremos,
  queremos, pretendemos, planeamos, pensamos*) before a noun: "We don't use Kafka", "We won't use Kafka", "This feature doesn't
  need an LLM", "We will not add an LLM", "We do not plan to use Kafka", "We no longer use Kafka", "No need for Kafka",
  *"Não queremos Kafka nem RabbitMQ", "Nunca / Jamás usaremos Kafka", "Não vamos integrar Kafka, RabbitMQ nem SQS"*. Kept: a
  noun ends the negated phrase ("Without payments the checkout is useless" keeps +tdd); an auxiliary or a modal + any other
  verb is the requirement about its object ("The report does not show the LLM cost", "The system must not lose payments nor
  duplicate invoices", "The service must not leak personal data", *"Não pode perder pagamentos nem reembolsos", "No puede
  perder pagos ni reembolsos"*, "a second write never overwrites the ledger", "We do not collect personal data" — +privacy
  stays for you to confirm); a verb form or a wished verb ("without losing payments or refunds", "We don't want to lose
  payments"); a hazard ("We don't want duplicate payments", *"Não queremos pagamentos duplicados"*); a people relative clause
  ("The admin who doesn't have MFA must enable it"); a condition ("If we don't add rate limiting, the API will be abused",
  *"Se não adicionarmos…", "Si no añadimos…"*, "…unless the admin asks"); a "without" inside a negated predicate ("We won't
  ship without a canary release", "Nobody should access the admin API without SSO"); any negated verb whose object is data to
  protect — secrets, keys, tokens, credentials, passwords, card numbers, personal data, PII or introspection — whatever the
  verb and the subject ("The frontend must not embed OAuth client secrets", "The API must not expose GraphQL introspection",
  "The email doesn't include personal data", *"O email não inclui dados pessoais"*, "The URL does not include the session
  token"): not handling that data is the requirement. A preposition after another noun ends it too ("We
  didn't add an LLM to the checkout" keeps +tdd). **Whose adoption:** a negated adoption verb excludes only when its subject
  is the one designing — the first person ("We don't use Kafka", *"Não usamos Kafka", "No usaremos ningún LLM"*), the system
  being built ("The service must not use Redis", "This feature does not require an LLM", *"O sistema não deve usar Redis"*)
  or none ("Do not use Kafka", *"Não é necessário um LLM", "No se necesita un LLM"*). A role, a user group or a plan / tier /
  account states an access or entitlement rule and keeps the track: "Guests can't (or cannot) use the checkout" +tdd, "Free
  users may not use the LLM assistant" +ai, "Tenants on the free plan can't use webhooks" +saas, "The Starter plan doesn't
  include the LLM assistant", "The free plan has no webhooks", *"Os editores não podem adicionar feature flags", "Las cuentas
  de prueba no incluyen el asistente LLM"*. A subject that is neither keeps the track too — when in doubt, keep — except a
  component of what is being built: a singular noun after the / this / our, *o / este / o nosso, el / este / nuestro* with a
  plain negation ("The importer does not need Kafka", *"O agendador não usa Kafka", "El importador no necesita Kafka"*)
  excludes; with can't / may not, *não pode, no puede*, or as a plural ("Suppliers don't use the checkout") it keeps.
- **This project's own corrections** (1.21): when the human confirms Phase 0 with other tracks than suggested — `spec_create`
  with `tracks` and the same description as `summary` — the words that drove the suggestion are recorded in
  `.specs/classifier.json`. After **two consistent corrections** a word the team keeps rejecting for a track stops turning it on
  in this project (`off`), and a word the team keeps adding a track for becomes a `weak` / `strong` signal there; an agreement
  resets a pending correction, a contrary choice drops an applied one. `spec_classify` names every override that changed its
  reading (`overrides` + a note) and `{explain: true}` lists every match and override; `dev-spec signals` / `spec_tracks
  {action: "signals"}` lists, sets (applies at once) or forgets them. Without the file nothing changes.

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
   `spec_create {name, tracks, summary, lang}` once — it seeds `classification.md` (format below), where you
   record those decisions. Pass the description you classified as `summary`: when the chosen tracks differ from the
   suggestion, the correction is recorded for this project (see "This project's own corrections" above).

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
CORS, audit log, input validation, security, hardening, least privilege, MFA / 2FA, two-factor / multi-factor (*dois
fatores, multifator · dos factores, doble factor, multifactor*), brute force, `STRIDE` (and the encryption verbs
*encriptar, cifrar, criptografar*) — "two-factor authentication" is two weak signals, so +sec turns on.
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

## +api signals (turn on the API contract track)

Turn on `+api` if **any** are true (see `api-design-patterns.md`):

| Signal | Example |
|---|---|
| Other code depends on the API's contract | A public or partner API, an SDK you ship, a mobile client that updates months later, another team's service |
| The contract is an artifact | An OpenAPI / Swagger document, `.proto` files, a GraphQL schema — contract-first design, contract tests |
| Compatibility is a decision | Versioning, deprecation, "no breaking changes for existing clients" |
| The contract fixes behaviour | Error bodies (problem+json, stable codes), pagination, Idempotency-Key, ETag / If-Match, rate-limit headers |

Classifier signals — **strong:** RESTful, API-first, contract-first, OpenAPI, Swagger, GraphQL, gRPC, protobuf, protocol
buffers, a proto file, API versioning, versioned API, API v1 / v2 / v3, a breaking API change, the API contract / spec /
specification / design, API consumers, third-party / external developers, a developer portal, contract tests,
consumer-driven contracts, (application/)problem+json, RFC 9457 / 7807, Idempotency-Key, rate limit headers, X-RateLimit
(and `X-RateLimit-Limit` / `-Remaining` / `-Reset`, `RateLimit-*`), Retry-After, the Sunset / Deprecation header
(*versionamento da API, contrato da API, programadores externos, portal do programador, teste de contrato · versionado de
la API, contrato de la API, desarrolladores externos, portal de desarrolladores, prueba de contrato*). **Ownership-ambiguous
— weak, strong when the API is ours:** a public / REST / HTTP / web / JSON / partner API, an API version, problem details
(*API pública, API REST, versão da API · versión de la API*) — strong beside an own cue ("our", expose, publish, offer,
provide, design, document, deprecate, "Build a REST API", *versionar*, *nuestra*) or when the name opens its clause or follows
a plain article ("REST API for the mobile app…", "add rate limiting to the public API"); "Stripe REST API integration" or
"show the problem details of each ticket" stay weak. **Weak:** a breaking change, backward compatible / compatibility, an
SDK, a client library, ETag, If-Match / If-None-Match, status codes, HTTP status, JSON Schema, request / response schema,
cursor (keyset) pagination, deprecation, an API gateway, an internal / management / admin API, an API client, the API docs /
reference, content negotiation, breaking compatibility as a verb — "must not break compatibility" (*quebra de
compatibilidade, quebrar a compatibilidade, alteração incompatível, retrocompatível, código de estado / de status, paginação
por cursor · cambio incompatible, romper la compatibilidad, retrocompatible, compatibilidad hacia atrás, paginación por
cursor*).
**Generic** (only beside a strong or weak one): api, endpoint, route, request(s), pagination (*rota, requisição, paginação ·
ruta, solicitud / petición http, paginación*). A breaking change is a **hazard**: "without breaking changes" counts.
**Someone else's API is no contract of ours:** any API signal right after a third-party owner — "Stripe's REST API", "the
payment provider's OpenAPI spec", "their Admin API version", *"a API REST do Stripe"*, *"la API REST del banco"*, an
organisation's acronym (*"la API pública del BCE"*, "the ECB's public API" — never a technical one: REST, CRM, SDK…) — or
governed by a consumer verb ("call", "integrate with", "sync from", "through", "via", "fetch", "the Salesforce REST API";
*integrar com, chamar, consultar · integrar con, llamar a, obtener*) counts as a generic word, unless the clause says the API
is ours ("Expose our catalog to partners through a versioned REST API"). **Our API + a new version** (1.21): a bare "API"
right after "our" (*nossa · nuestra*, ≤ 2 words between) in a sentence that names a version (v2, version 3, a new / major
version, versioning) is strong — "Our webhooks API needs a v2 …". An API **key** is +sec's word, not a contract: "an
API key management page" is a UI, "call the Stripe API" consumes someone else's contract — *possible +api* at most.

Worked examples (what `spec_classify` answers):

| Description | Result | Signals |
|---|---|---|
| Publish an OpenAPI spec for the orders REST API and generate the client SDKs from it | `core +api` | rest api, openapi, sdk |
| Version the public API: ship v2 and deprecate v1 with a Sunset header | `core +api` | public api, sunset header |
| Add cursor-based pagination to the list endpoints without breaking existing clients | `core +api` (weak-only) | cursor-based pagination, endpoint |
| Avoid breaking changes to the orders API for existing clients | `core +api` (weak-only) | breaking change (a hazard — not negated), api |
| *Devolver os erros em formato problem+json com códigos estáveis* | `core +api` | problem+json |
| *Definir el contrato gRPC del servicio de precios en protobuf* | `core +dist +api` | grpc, protobuf (+dist: gRPC, the pricing service) |
| API key management page where admins create and revoke keys | `core +ui`, *possible +sec / +api* | api (generic only; management page → +ui) |
| Integrate with the Salesforce REST API to sync contacts every hour | `core`, *possible +api* | rest api (someone else's API — generic) |
| Call the Stripe API to charge the customer's card | `core +tdd`, *possible +api* | api (generic only; charge → +tdd) |
| Bump the AWS SDK to v3 | `core`, *possible +api* | sdk |

## +ui signals (turn on the UI track)

Turn on `+ui` if **any** are true (see `ui-design-patterns.md`):

| Signal | Example |
|---|---|
| A user-facing screen, component or flow is the work | A settings / admin / profile page, a checkout flow, a new component |
| The design system is involved | Tokens, the component library, Storybook, Figma designs, dark mode |
| Accessibility matters | WCAG 2.2 AA, a screen reader, keyboard navigation, contrast, alt text |
| The states or the layout are the risk | Empty / loading / error states, responsive layout, right-to-left, Core Web Vitals |

Classifier signals — **strong:** design system, design tokens, component library, UI component / kit, user interface,
WCAG, a11y, screen reader, keyboard navigation / accessible / only, focus order / trap / indicator
/ management, colour / color contrast, contrast ratio, alt text, `ARIA`, aria-label, reduced motion, responsive layout /
design, mobile-first, dark mode, Storybook, Figma, Core Web Vitals, `LCP`, visual regression, skeleton screen, empty state,
right-to-left, a landing / settings / admin / management / profile / account page, an admin panel, a confirm dialog, a
confirmation modal, a modal dialog / window, a toast notification, a snackbar (1.21 — *diálogo de confirmação, janela modal,
notificação toast · diálogo de confirmación, ventana modal, notificación toast*) (*sistema de design,
leitor de ecrã / de tela, navegação por teclado, modo escuro, interface do utilizador, página de definições,
painel de administração · sistema de diseño, lector de pantalla, modo oscuro, interfaz de usuario, página de
ajustes, panel de administración*). **Weak:** accessibility (*acessibilidade · accesibilidad* — alone it may be a venue's
wheelchair access; with a page, a form or WCAG it is UI), frontend, `UI` / `UX` (capitals, one concept — "translate the UI
into Spanish" alone is no UI work), a UI framework written with its capital (`React`, `Vue`,
`Angular`, `Svelte` — one concept), CSS / Tailwind, a modal, dropdown, tooltip, navbar, sidebar, toast, carousel, spinner,
a picker, a popup / banner, swipe, responsive, mobile-friendly (*adaptado ao telemóvel · adaptada al móvil*), i18n / l10n /
`RTL`, `CLS` / `INP`, a loading / error state, form validation, inline errors / validation — errors next to each field
(*junto a cada campo*) —, a wireframe / mockup; a widget a display verb shows or opens is strong ("Show a modal …", "display a
tooltip", *"Mostrar um popup"*). **Generic** (only beside a strong or weak one): screen, page, form (the
nouns — never "screening", "formed"), button, click, dialog, dashboard, menu, icon, widget, layout, theme (*ecrã, tela,
página, formulário, botão, painel · pantalla, formulario, botón, tablero, cuadro de mando*). **Backend-only work is no UI
work:** in a clause (up to `. ! ? ; :` — a short label before a colon belongs to what follows it) that names a handler
(`PATCH /…`), an endpoint, the backend, an API (not "API keys"), a data layer / repository / SQL or says the UI already
exists, a page type and frontend / `UI` / `UX` count as generic words ("the profile page backend should return…", *"a
interface já existe"*) — but not when the backend word is negated ("Frontend only, no backend changes: a new landing
page", "The settings page redesign needs no API changes", *"Sin backend: nueva página de ajustes"*), when the page consumes
it ("The landing page loads its testimonials from the CMS API"), when it sits in another clause ("Redesign the admin panel;
the backend team will add the endpoints later") or when the text says "frontend only" (*apenas frontend · solo frontend*);
"the frontend team" names a team, not UI work. A **public** API is never a page's backend (1.21): "Expose a public REST API
for the mobile app's settings screen" is +api and +ui. An empty state in a sentence about a state machine is weak.
A **dashboard** is +ui's generic word only — a sales dashboard is a product screen, never +obs; a monitoring / Grafana
dashboard is +obs. `a11y` is a +ui signal, but never a reserved pack name: a team's accessibility pack keeps it.

Worked examples (what `spec_classify` answers):

| Description | Result | Signals |
|---|---|---|
| Build the settings page with design-system components and WCAG 2.2 AA accessibility | `core +ui` | wcag, accessibility, settings page |
| Make the checkout form usable with a screen reader and keyboard navigation | `core +tdd +ui` | screen reader, keyboard navigation, form (checkout → +tdd) |
| Add a dark mode using the design tokens | `core +ui` | design tokens, dark mode |
| API key management page where admins create and revoke keys | `core +ui`, *possible +sec / +api* | management page |
| Rewrite the frontend in React | `core +ui` (weak-only) | frontend, React |
| *Adicionar modo escuro à aplicação* | `core +ui` | modo escuro |
| *Mostrar un estado vacío cuando no hay pedidos* | `core +ui` | estado vacío |
| Add a button to export orders as CSV | `core`, *possible +ui* | button (generic only) |
| Log in form | `core`, *possible +ui* | form (generic only — "log" is no +obs word) |
| Metrics dashboard for sales | `core`, *possible +ui* | dashboard (generic only) |

## +obs signals (turn on the observability & operability track)

Turn on `+obs` if **any** are true (see `observability-patterns.md`):

| Signal | Example |
|---|---|
| Someone depends on it being up | An SLO, an error budget, a critical journey, an on-call rotation |
| It must be watchable | Metrics, structured logs with a correlation ID, distributed tracing (OpenTelemetry) — named as the work |
| It must be safe to ship and undo | Feature flags, a canary / progressive rollout, a rollback plan, zero-downtime deploys |
| It must say when it is broken | Alerts with runbooks, PagerDuty / Opsgenie, health / readiness checks, incident response |

Classifier signals — **strong:** observability, SLO / SLI, error budget, burn rate, OpenTelemetry / `OTel` (capitals), an
OTel collector, distributed tracing, runbook, paging the on-call ("page the on-call engineer"), PagerDuty, Opsgenie,
Alertmanager, an alerting / alert rule, Prometheus, Grafana, Datadog, New Relic, Jaeger, Zipkin, Sentry, structured logging
/ logs, correlation / trace ID, `X-Request-ID`, context propagation, golden signals, MTTR, incident response, feature flag /
toggle, kill switch, a canary release / deployment / rollout, blue-green, progressive / gradual / staged / phased rollout,
dark launch, a rollback plan, automatic rollback, rolling back a deployment / release, liveness / readiness probe, a health
(check) endpoint, synthetic / real user monitoring, chaos engineering, fault injection, zero(-)downtime, a monitoring /
Grafana / Datadog / operational dashboard, log aggregation, error tracking (*observabilidade, orçamento de erro, rastreio
distribuído, logs estruturados, lançamento / implantação canário / gradual, reverter a implantação, plano de rollback,
endpoint de verificação de saúde · observabilidad, presupuesto de error, trazas distribuidas, despliegue canario, revertir el
despliegue, plan de reversión, endpoint de comprobación de salud*).
**Weak:** monitoring / monitor, alert(s) / alerting, a postmortem (these watch words are ONE concept — "monitor stock
levels and send alerts to purchasing" is one hint, never +obs), liveness, readiness, uptime, outage, downtime, rollback,
rollout, a bare canary, telemetry, instrumentation, tracing, `APM`, error rate, 5xx, on-call / on call, game day, a request
ID, latency metrics, request logs (*monitorização, monitoramento, alertas, alertar, avisar, indisponibilidade, reversão,
telemetria, plantão · monitoreo, monitorización, alertar, avisar, reversión, trazas, tasa de error, guardia* — alertar /
avisar are the watch concept too: "Avisar al equipo cuando falle la tarea programada" is +obs, "Avisar al encargado de la
tienda cuando baje el stock" a hint). **Generic:** metrics, logs / logging, latency, p99
/ p95 / p50, deploy (*métricas, latência, implantação · latencia, despliegue*). **Context** (evidence only beside another
+obs signal): an SLA, an incident (both part of the watch concept), a health check (*verificação de saúde · comprobación de
salud*) — a help desk's SLA, a support incident or a clinical health check alone is no operability — and the **technical
targets** (one concept): a service, servers, production, a cluster / Kubernetes / pod, a cron / batch / sync / import /
backup job, a data / CI pipeline, an endpoint, the backend, the infrastructure, ops / DevOps / SRE, a status page, disk / CPU
/ memory usage, queue depth, consumer lag (*serviço, servidor, em produção, tarefa agendada · servicio, en producción, tarea
programada*) — "customer service" / "service level" are none. So "Monitor the ERP sync job and send alerts to ops" and
"Alert the team when the nightly backup job hasn't completed" are +obs; "warehouse temperature monitoring … alerts go to the
shift manager" is not. Never a bare "log" ("log in"), "trace" or "dashboard" — a sales dashboard is a product screen (+ui's
word). `observability` / `SLO` / `SLA` / `uptime` stay +saas signals too (a phrase may serve two tracks); the
`observability.md` steering file serves both.

Worked examples (what `spec_classify` answers):

| Description | Result | Signals |
|---|---|---|
| Define an SLO for checkout availability and alert on the error budget burn rate | `core +tdd +saas +obs` | slo, error budget, burn rate (checkout → +tdd, slo → +saas) |
| Instrument the payments service with OpenTelemetry distributed tracing | `core +tdd +obs` | opentelemetry, distributed tracing |
| Roll out the new pricing engine behind a feature flag with a canary release and automatic rollback | `core +tdd +obs` | feature flag, canary release, automatic rollback |
| Add monitoring and alerts for the nightly import job | `core +obs` (weak-only) | monitoring (+ alerts, one concept), import job (a technical target) |
| Monitor stock levels and send alerts to the purchasing team when inventory is low | `core`, *possible +obs* | monitor (+ alerts, one concept — no technical target) |
| Deploy the billing service without downtime and roll back on errors | `core +tdd +obs` (weak-only) | downtime (a hazard — not negated), roll back |
| *Despliegue canario del nuevo motor de precios con plan de reversión* | `core +obs` | despliegue canario, plan de reversión |
| Metrics dashboard for sales | `core`, *possible +ui / +obs* | dashboard, metrics (generic only) |
| Send price alerts to users when a product gets cheaper | `core`, *possible +obs* | alerts |
| Canary Islands shipping rates | `core`, *possible +obs* | canary (weak — never a release alone) |

## +data signals (turn on the data pipeline & data quality track)

Turn on `+data` if **any** are true (see `data-pipeline-patterns.md`):

| Signal | Example |
|---|---|
| Data moves between stores on a schedule or a stream | An ETL / ELT job, a data pipeline, an Airflow DAG, dbt models, a Spark job, ingestion into a warehouse / lake |
| Consumers depend on the numbers | A data warehouse / mart, fact and dimension tables, BI reports fed by the pipeline, a freshness SLA |
| The data's quality is the feature's job | Data-quality checks, quarantined rows, schema evolution / data contracts, lineage |
| History has to be (re)computed | A backfill of past partitions, late-arriving data, slowly changing dimensions, idempotent re-runs |

Classifier signals — **strong:** ETL, an ELT pipeline / job / tool / process ("ELT teachers" teach English), a data pipeline /
ingestion pipeline / batch pipeline, a data warehouse / lake / lakehouse / mart, data quality, a data contract, data lineage, a data catalog, a data mesh, data / analytics engineering,
schema evolution, a schema registry, schema drift, a backfill job, a historical backfill, a slowly changing dimension, a star
/ snowflake schema, a fact / dimension table, dimensional modelling, OLAP, dbt models / tests / runs / jobs, an Airflow DAG,
Apache Airflow / Spark / Iceberg / Hudi, PySpark, a Spark job, Dagster, Databricks, BigQuery, Amazon Redshift, a Snowflake
warehouse / table, Delta Lake, Iceberg tables, Parquet files, Fivetran, Airbyte, data ingestion, data freshness, a freshness
SLA, late-arriving data, an incremental load / model, a medallion architecture, data observability, a quarantine
table (*pipeline de dados, armazém de dados, lago de dados, qualidade de dados, linhagem de dados, evolução do esquema,
ingestão de dados, esquema em estrela, tabela de factos / fatos, carga incremental de dados · pipeline de datos, almacén de datos, lago
de datos, calidad de datos, linaje de datos, evolución del esquema, ingesta de datos, tabla de hechos, datos que llegan
tarde*). **Weak** (anchors): a backfill, a warehouse, a lakehouse, a freshness check, `Snowflake` / `Redshift` / `Airflow` (capitals — a snowflake icon, a
galaxy's redshift, a vent's airflow are no signal), dbt, `SCD`, lineage, ingestion, change data capture / a CDC pipeline
(also +dist's), Parquet / Avro, a streaming pipeline, batch processing, a data platform / product, data governance,
business intelligence / a BI tool, dashboard or report / Power BI / Looker / Tableau / Metabase (one concept — `BI` alone is no
signal: *o número do BI* is the Portuguese ID card), duplicate rows, stale data, a uniqueness check (*linhagem, ingestão,
processamento em lote, governança de dados, carga incremental, ferramenta / relatório de BI · linaje, ingesta, procesamiento
por lotes, informe de BI*). **Generic:** analytics, a dataset, a partition, a transformation, a batch / nightly job, ingest, upsert, a
materialized view, a data / analytics engineer (a role names no pipeline work). **Context** (evidence beside a strong
or weak +data signal, one concept): table, column, row, SQL, query, schema (*tabela, coluna, linhas · tabla, columna,
filas*) — "A BI dashboard over the orders table", "Load the orders table into the warehouse every night", "Query the
warehouse for monthly revenue" are +data; "migrate the users table" is not. A table, a column or a query is on every screen,
so it never backs an anchor with an everyday sense — a lakehouse, a lineage, ingestion, a freshness check, `SCD`, duplicate
rows, stale data: "a horse's lineage in a table", "SCD patient records in the patients table", "React Query never shows
stale data" name no pipeline. The BI phrases match at a sentence start or in title case ("Relatório de BI", "BI Dashboard"
— `BI` itself stays case-sensitive). **Hazards:** duplicate rows,
stale data, schema drift ("without duplicate rows" states the concern).

**Cues** (the words around a keyword): a warehouse in a sentence about the building (stock, inventory, shelves, picking,
pallets, shipping, temperature, shifts…) is no signal — one about data (a table, a query, a load into, dbt, a pipeline,
a schema, partitions) stays an anchor; a backfill in a schema migration ("add a currency column; backfill existing
rows") is app-level, one about partitions, a pipeline, the warehouse or history an anchor; data moved into / out of
`Snowflake` / `Redshift` ("into Snowflake", "from Redshift") is the product — strong; DBT therapy, an Airflow reading,
a galaxy's Redshift are none. A lakehouse, a freshness check or a lineage in a sentence about data (tables, metrics,
dashboards, a pipeline, the raw zone…) is strong — even beside an everyday word ("Load the bookkeeping entries into the
lakehouse tables", "Add a freshness check to the grocery orders pipeline"), and so is ingestion of files / feeds / batches into
a table or a lake ("Ingestion of CSV files into the orders table") and an SCD with its type ("SCD type 2 on the customers
table"); otherwise the everyday senses are no signal — a lakehouse to rent, a kitchen's freshness check, a training plan's
*carga incremental*, a horse's lineage, the ingestion of water or a medication, parquet flooring; then a lineage of reports or
fields is strong ("Field-level lineage for the revenue report" — a horse's lineage in a report stays none). A
warehouse's sentence about data never counts a table, a column or a query ("Show stock levels per warehouse in a table" is
the building). Shared phrases: an ETL job / data pipeline is also +obs's technical target, a CDC pipeline
+dist's strong phrase, data retention +privacy's (a phrase may serve two tracks). `analytics` is never a reserved pack
name — a team's product-analytics pack (a tracking plan) keeps it.

Worked examples (what `spec_classify` answers):

| Description | Result | Signals |
|---|---|---|
| Build an ETL pipeline that loads the orders from Postgres into BigQuery every night | `core +data` | etl, bigquery |
| A nightly job that recomputes the loyalty points in the warehouse | `core +data` (weak-only) | warehouse, nightly job |
| Backfill the last 90 days of the events table partitions | `core +data` (weak-only) | backfill, partition |
| Stream changes from Postgres to the data warehouse with a CDC pipeline | `core +dist +data` | data warehouse, CDC pipeline |
| *Verificações de qualidade de dados na ingestão: as linhas com chaves nulas ficam em quarentena* | `core +data` | qualidade de dados |
| Migrate the orders table to add a currency column; backfill existing rows with EUR | `core +tdd`, *possible +data* | backfill (a migration's — app-level) |
| Analytics events for the signup funnel | `core`, *possible +data* | analytics (generic only) |
| Warehouse temperature monitoring: sensors report every minute | `core` | warehouse (the building — no signal) |
| Export orders as CSV · Import a CSV of contacts · Migrate the users table | `core` | — |
| Track the lineage of every dashboard metric back to its source tables | `core +data` | lineage (strong — about metrics), table |
| Guests can book a lakehouse or a cabin for the weekend · ELT teachers assign reading exercises | `core` | — (the everyday senses) |
| Show stock levels per warehouse in a table so pickers know which shelf to restock | `core`, *possible +ui* | picker — warehouse: the building, no signal |
| Prevent duplicate rows in the users table when the signup form is double-submitted | `core`, *possible +ui / +data* | form, duplicate rows (a table backs no everyday anchor) |
| A BI dashboard over the orders table · Load the orders table into the warehouse every night | `core +data` (weak-only; *possible +ui* for the dashboard) | BI dashboard / warehouse, table |
| *Relatório de BI com backfill mensal* | `core +data` (weak-only) | relatório de BI, backfill |

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
| `core +api` | design gains 5 `[API]` sections; `[API]` criteria US-1.AC-20..23; contract-first, error-model, idempotency / concurrency, compatibility-gate and contract-test tasks; `steering/api.md` |
| `core +ui` | design gains 5 `[UI]` sections; `[UI]` criteria US-1.AC-24..27; design-system, UI-states, forms-and-keyboard, accessibility-check and responsiveness / performance tasks; `steering/ui.md` |
| `core +obs` | design gains 5 `[OBS]` sections; `[OBS]` criteria US-1.AC-28..31; SLO / alert, telemetry (`_Emits metrics:_`), rollout, health-check and operability-test tasks; `steering/observability.md` |
| `core +data` | design gains 5 `[DATA]` sections; `[DATA]` criteria US-1.AC-32..35; data-contract, data-quality, idempotent-load, backfill and lineage / retention tasks; `steering/data.md` |

**Design sections are additive:** `+saas` adds its 5 mandatory sections, `+ai` its 10, `+sec` its 5, `+privacy`
its 6, `+dist` its 5, `+api` its 5, `+ui` its 5, `+obs` its 5 and `+data` its 5, on top of the base design. A blank mandatory section is never acceptable — an honest "not needed because X" is.
The section markers (`[SaaS]`, `[AI]`, `[SEC]`, `[PRIVACY]`, `[DIST]`, `[API]`, `[UI]`, `[OBS]`, `[DATA]`) are English in every language and case-sensitive.

**Execution loop is chosen per task by track:**
- Deterministic task on `+tdd` → red → green → refactor → `spec_complete_task {evidence}`.
- Generation/prompt task on `+ai` → prompt-iteration loop gated on eval delta → `spec_complete_task {evidence}`.
- Plain task on `core` only → implement → run existing tests + its `_Verify:_` → `spec_complete_task {evidence}`.
- `+saas` hot path → load-test task at the end must pass before "done".
- `+sec` → the security-testing task's `_Verify:_` runs the scans and the abuse-case tests; `+privacy` → data subject
  rights verified end to end before "done"; `+dist` → the failure-injection tests (crash between commit and publish,
  duplicate delivery, concurrent updates, a dependency down) green before "done"; `+api` → the contract tests and the
  breaking-change diff against the published contract green before "done"; `+ui` → the automated accessibility check, the
  manual keyboard / screen-reader pass and the performance budget before "done"; `+obs` → an alert fired in a staged
  failure, a rollback drill and the health checks with a dependency down before "done"; `+data` → the data-quality checks, a partition
  re-run and a backfill rehearsal (the same rows as one run) before "done".

---

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

The track set chosen here drives every later phase and is stored per feature. Changing it mid-feature
is allowed — `spec_add_track` (`/add-track`) adds one additively, and `remove: true` (`--remove`)
takes one off without deleting any file — but it should be a deliberate, recorded decision.
