# Tracks and the Phase 0 classifier

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
The track registries, the built-in tracks (+dist, +api, +ui, +obs, +data…), track packs and the classifier's rules.

## The track model
`core` is always on. `+tdd`, `+saas`, `+ai`, `+sec`, `+privacy` (the last two since 1.14), `+dist` (1.17), `+api` / `+ui` / `+obs` (1.19), `+data` (1.21) are independent and
composable, chosen in Phase 0 by `spec_classify` (keyword heuristic with negation + confidence) and confirmed by the
human. The track set drives which artifacts/sections/loops apply. See `references/classification-matrix.md`
(GDPR / RGPD / LGPD / CCPA / HIPAA are +privacy signals, not +saas).
- **Tracks are data-driven registries — never a hard-coded `saas`/`ai` list.** `VALID_TRACKS` → `OPTIONAL_TRACKS`
  (everything but core: the classifier's, add_track's and every per-track loop's list); `TRACK_MARKER` (`[SaaS]` `[AI]`
  `[SEC]` `[PRIVACY]` → `MARKER_TRACKS`, the tracks with mandatory design sections); `TRACK_SECTIONS` (`SAAS_SECTIONS` /
  `AI_SECTIONS` / `SEC_SECTIONS` / `PRIVACY_SECTIONS` — the ONE table doctor `<track>-sections`, the design gate, status,
  the roadmap and the design-save hook read); `TRACK_STEERING` (the steering files a track brings). **Adding a track:**
  `VALID_TRACKS` + its `SIGNALS` (strong / weak / optional `context`, EN/PT/ES); a marker track also needs `TRACK_MARKER`,
  a sections table in `TRACK_SECTIONS` (EN/PT/ES synonyms), `TRACK_STEERING`, and its i18n builders (requirements
  criteria under `#### [Marker]`, the design block with the `> **TODO**` sentinel, template tasks, test rows, checklist
  items, steering stub) and its marker in `RE_STABLE_BRACKET`; the `RE_TRACK_RUN` / heading-lead regexes build themselves
  from the registries; update the MCP descriptions and CLI help by hand. `templateCorpus()` renders every set of at
  most two optional tracks plus all of them (quadratic beyond three tracks — verified equal to the full power set's
  placeholder reports). A TEAM's own track needs none of this: it is a track pack (see Project-defined tracks, 1.15).
  **1.21 F5 — sizes (DATA, no code):** a new built-in marker track also gives each section of its `TRACK_SECTIONS` table a
  `tier` (`"extended"` = optional at size s; absent = core — keep ≥ 1 core section, and one per criterion's concern), adds
  a `TRACK_OVERLAPS` entry when one of its sections duplicates another track's (`{drop: [track, name], by: [[track,
  name]…]}`) and a `TRACK_TASK_OVERLAPS` entry for a duplicated template task, a `CORE_SUPERSEDED_BY` key (i18n/common.js)
  when its sections own a core design section, and its template criteria in `TEMPLATE_ACS` (every size scaffolds them).
  Its template tasks are trimmed at size s by rule (`sizeTasksText()` — the tasks whose criteria the others cite), never
  by a per-track list. gates-and-approvals.md → Right-sized rigor.
- **+dist (1.17)** — the seventh built-in marker track `[DIST]` (distributed systems & data consistency), added through the
  registries: SIGNALS.dist has FOUR tiers (1.17 D review) — strong: named brokers / job and workflow platforms (kafka,
  rabbitmq, sqs, debezium, Google Pub/Sub, sidekiq, bullmq…; a common word only in its capitalised, case-sensitive product
  phrase: `NATS`, `Temporal workflow`, `Celery task`, `Pulsar topic`, `Event Hubs`, `CDC pipeline`) and patterns that only
  exist across systems (message queue, event sourcing, CQRS, transactional outbox / outbox pattern, dual write, eventual
  consistency, distributed transaction, `2PC` — exact, never "2PCS" —, microservice, isolation level, lost update, write
  skew, read replica…); weak = the cross-system ANCHORS (webhook, idempotency, at-least-once / duplicate delivery, other /
  another / downstream services and a service named by its role — "the payment service", dead letter, circuit breaker,
  backoff, replication, concurrent updates, event bus / stream, event-driven, leader election, Redis, a search index,
  gRPC, a bare `saga`, `CDC` in capitals); **generic** = app-level words (queue, consumer / producer / subscriber, retry,
  jitter, dedupe, race condition, publish … event, send … message, worker, background job, a bare outbox, oversell…) that
  add to the score but never turn the track on without a strong or anchor signal (two generic ones stay 'possible', with
  the `genericOnly` note naming them — a print queue with a retry button, a farmers' market's producers and consumers, a
  newsletter's subscribers); context: transaction, consistency, atomic (backed by strong / weak only, never by a generic
  word); deliberately NO signal for a bare event / lock / stream / broker. `SIGNAL_CONCEPTS.dist` = one concept, one
  signal (retry · backoff · jitter, consumer · producer · subscriber, dedupe · deduplicate, the services, delivery words):
  per track, weak / generic only, an anchor member wins. `SIGNAL_HAZARDS.dist` (lost update, oversell, race condition,
  duplicate delivery, write skew, split brain, "overwrite each other") are never negated — "concurrent updates never
  oversell" states the concern. "message queue" / "distributed cache" (+ PT / ES) are listed in +saas weak too (a phrase
  may serve two tracks — the 1.16 +saas hint survives). TRACK_MARKER, `DIST_SECTIONS` (Consistency Model · Cross-system
  Writes · Delivery & Idempotency · Concurrency · Failure Modes — each section's own names strict, incl. Failure Modes /
  Failure Handling / Modos de Falha / Modos de Fallo; the ordinary words `loose`, marker-bound), TRACK_STEERING
  `distributed.md`, RE_STABLE_BRACKET, RE_PACK_MARKER_RESERVED and TRACK_ALIASES (kafka / distributed / microservices /
  consistency are reserved pack names); criteria US-1.AC-16..19.
  **Pre-1.17 packs of a reserved name** (`legacyPackName(st, n)`: recorded in the feature's packMarkers — only a valid pack
  ever is — and `packReservedName(n)` now): the feature's MISSING pack — `savedPackName` accepts it, `savedTracks` drops it
  (a 1.16 pack `dist` is never the built-in +dist), `missingPackTracks` lists it, `noteGhostPacks` ghosts its marker unless
  that is reserved too, doctor's track-pack-missing says why (`trackPacks.missingReserved`), spec_upgrade flags
  `track-pack-reserved` (`reservedPacks`); `add-track <f> dist` adopts the built-in track (drops the record, appends its
  sections even though a `[DIST]` heading exists — `adopted`), `add-track <f> <name> --remove` drops the pack from the list.
  Guide: `references/distributed-data-patterns.md` (dual write → outbox / inbox / saga / CDC, retries, idempotency,
  consistency models and isolation anomalies, locking, CAP / PACELC, monolith vs microservices, large data volumes).
  **Classifier machinery (built-in signals only):** a GAP keyword (`KW_GAP` " … ", `KW_GAP_RE`, linear) matches its parts,
  each via `keywordPattern()`, with ≤ 3 words between and never across `. ! ? ; : ,` ("publishes a UserCreated event");
  `IRREGULAR_FORMS` gives one signal per word (retry / retries / retried; mensagem / mensagens; an exact form: `2PC`);
  VERB_STEMS `public` / `envi` need an ending. VERB_STEMS and IRREGULAR_FORMS apply to built-in keywords only — a track
  pack's keyword is a literal word (`keywordRe(kw, true)`, cached apart). Negated keywords are deduped by containment like
  matched ones (every track). Shadowing (every track) is a linear sweep over the strong hits sorted by start, and a weak /
  generic hit inside a longer strong phrase of its OWN track is shadowed too ("mensagens" in "fila de mensagens").
  `guessLang` counts a PT / ES infinitive opening a clause and followed by its object on the line (`INF_WORDS` → `PT_INF` /
  `ES_INF` / `PTES_INF` — none an English word) as a strong marker, only in a text with no English function word: "Publicar
  eventos no Kafka." is PT (no is em + o), English "no Kafka" / "Spanish labels: Guardar, Enviar; no LLM." stay English.
  `pt` / `es` hold verbs of ONE language only; a verb both have (alterar, excluir, mudar, adicionar, apagar, criar, gravar,
  testar, substituir, agregar, borrar, cambiar…) goes in `both` — it tells PT / ES from English, never PT from ES (a tie is
  PT, or ES when the project's language is ES). "no" + a listed infinitive (`ES_NO_INF`, "no usar LLM") is a strong ES
  marker. `CLAUSE_START`'s spaces are `[^\S\n]*` — `\s*` there re-read a run of blank lines from each line break (quadratic).
  **Gotcha:** within a track the first keyword matching at a position wins it (seenSpan — strong, weak, generic, context in
  that order) — list a longer phrase before its prefix ("backoff exponencial" before "backoff", +saas "fila de mensagens"
  before "fila"), or the self-match sweep fails.
- **+api (1.19 T)** — the eighth built-in marker track `[API]` (API contracts), added through the same registries (VALID_TRACKS
  after dist, TRACK_MARKER, `API_SECTIONS`, TRACK_STEERING `api.md`, TEMPLATE_ACS US-1.AC-20..23, RE_STABLE_BRACKET,
  RE_PACK_MARKER_RESERVED, TRACK_ALIASES: apis / rest / restful / openapi / swagger / graphql / grpc are reserved pack names).
  SIGNALS.api — strong: contract-level words only (RESTful, OpenAPI, Swagger, GraphQL, gRPC, protobuf, API versioning, the API
  contract / spec, API consumers, third-party developers, a developer portal, contract tests, problem+json, RFC 9457,
  Idempotency-Key, rate-limit headers incl. `X-RateLimit-Remaining` / `-Limit` / `-Reset` by name, Retry-After, Sunset); weak
  (anchors): the **ownership-ambiguous** names (`API_AMBIGUOUS`: a public / REST / HTTP / web / JSON / partner API, an API
  version, problem details — one concept `kind`), a breaking change, backward compatibility, an SDK / client library, ETag /
  If-Match, status codes, JSON Schema, cursor pagination, deprecation, an internal / management / admin API / API gateway / API
  docs; **generic**: api, endpoint, route, request (IRREGULAR_FORMS: the noun only, never "requested"), pagination.
  SIGNAL_CONCEPTS.api folds compatibility, ETag / If-Match, status codes, schemas, the client, the endpoint / route words;
  SIGNAL_HAZARDS.api: a breaking change is never negated ("without breaking changes"). **Ownership (1.19 T review —
  `SIGNALS.api.cues`, kind `ownership` — 1.20):** an API someone else owns is app-level for us — a hit after a third-party owner (`X's`
  with X Titlecase or a third-party noun: provider / supplier / partner / bank / carrier…, "their", PT / ES "do|da|de|del
  <Name|fornecedor|banco…>" after it) is GENERIC; so is one governed by a consumer verb (call, integrate with, sync, via,
  through, fetch, poll; integrar com, chamar, consultar; integrar con, llamar a, obtener — only link words, Titlecase names and
  ≤ 1 other word between: "the order service calls the payment service over gRPC" is no consumer) or right after "the <Name>"
  ("the Shopify API version") — unless the clause says it is ours (an own cue: "our" / nosso / nuestro ≤ 3 words back, an own
  verb anywhere before it — expose, publish, offer, provide, design, document, deprecate, versionar… —, "Version …" opening the
  clause, a build verb whose direct object it is: "Build a REST API", "Criar uma API REST"). An ambiguous name is strong with an
  own cue, or (the API-kind names) when it opens its clause or follows a plain article + ≤ 2 lowercase adjectives ("REST API
  for the mobile app", "add rate limiting to the public API"); "Stripe REST API integration" stays weak. **1.19 verify 2:** an
  ALL-CAPS organisation acronym is an owner too ("la API pública del BCE", "the ECB's public API" — `RE_API_ACRONYM`, never a
  technical one: `API_TECH_ACRONYMS` REST / CRM / SDK / HR…); a past participle right after a determiner is an adjective, no
  own verb ("Replace the deprecated Google Places API calls"); breaking compatibility as a VERB (`API_BREAK_VERBS`: break
  compatibility, quebrar a compatibilidade, romper la compatibilidad…) is a weak compat anchor and a hazard, so PT "não pode
  quebrar a compatibilidade da API pública" is +api like EN / ES. An API **key** stays
  +sec's word — "an API key management page" / "call the Stripe API" have a *possible +api* note at most.
  The core design already has `## API Contracts` / `## Error Handling`: every ordinary name in API_SECTIONS is `loose`
  (marker-bound), only the full compound names are strict. The generic-only note names what an anchor would be, per track
  (`classify.genericOnly`). A pre-1.19 pack named `api` / `rest`… is a missing pack like a pre-1.17 `dist` one; doctor and
  spec_upgrade say "from before 1.19" (`packReservedSince()` — `TRACK_RESERVED_SINCE`). **A pack of ANY name whose recorded
  MARKER is a built-in track's now** (1.19 T review — `legacyPackMarkerTrack(st, n)`: 'webui' with `[UI]`, 'contracts' with
  `[API]`, 'ops' with `[OBS]`; its `## [UI] …` headings would pass for the built-in track's): doctor's track-pack-missing says so
  (`trackPacks.missingReservedMarker` — change the marker, adopt the built-in track, or --remove the pack), spec_upgrade lists
  it (`reservedMarkers` [{name, marker, track}], attention `track-pack-reserved`, `upgrade.packMarkerReserved`); `add-track <f>
  ui` ADOPTS it (the five built-in sections are appended although a `[UI]` heading exists, the pack leaves the list and
  packMarkers — `adopted: ["ui"]`, `adoptedPacks: ["webui"]`); `add-track <f> webui --remove` drops it. Guide: `references/api-design-patterns.md`.
- **+ui (1.19 T)** — the ninth built-in marker track `[UI]` (user-facing UI, the design system, accessibility): TRACK_MARKER,
  `UI_SECTIONS` (Design System Usage · UI States · Accessibility · Responsiveness & i18n · UI Performance Budget — every ordinary
  name `loose`: a core "## Accessibility" never stands in for the deleted [UI] one, nor does +saas's "[SaaS] Performance
  Budget"), TRACK_STEERING `ui.md`, US-1.AC-24..27, TRACK_ALIASES frontend / front-end / ux / gui / wcag — **never `a11y` /
  `accessibility`**: the canonical track-pack example is a team's `a11y` pack, it keeps its name (its signals and +ui's then
  both fire, as a pack's may). SIGNALS.ui — strong: the design system (tokens, a component library),
  WCAG / a11y and the concrete accessibility words (screen reader, keyboard navigation, focus order, contrast, alt text,
  `ARIA`, reduced motion), responsive design, dark mode, Storybook / Figma, Core Web Vitals / `LCP`, visual regression, an empty
  state, the UI-heavy page types (a settings / admin / management / profile page, an admin panel — "an API key management
  page" is +ui); weak: accessibility (1.19 T review — a venue's "wheelchair accessibility" alone; with a page / form / WCAG it
  is UI), frontend, `UI` / `UX` (capitals, one concept — "translate the UI into Spanish" alone stays possible;
  1.19 T made it an anchor, not strong: two 1.18 tests read such texts as core), `React` / `Vue` / `Angular` / `Svelte` (one
  concept), CSS, widgets (+ a picker, a confirm dialog, swipe), responsive, i18n,
  `RTL` / `CLS` / `INP`, a loading / error state, form validation, inline errors; **generic**: screen, page, form
  (IRREGULAR_FORMS: the nouns only — "screening", "formed", "paged" are no signal), button, click, dialog, dashboard (ES
  tablero / cuadro de mando), menu, icon, widget, layout, theme. A dashboard is +ui's generic word only, never +obs's ("a
  metrics dashboard for sales"). **Cues (1.19 T review — `SIGNALS.ui.cues`: kinds sentence, near, text, clause — 1.20):** in a CLAUSE (`cueClause()`:
  CUE_BOUNDARY . ! ? ; : or a line break — a colon after a short label, ≤ 4 words, joins the label to what it introduces:
  "Profile page: the GET /me handler…", "Sin backend: …") that says the work is backend-only (`RE_UI_BACKEND`: an HTTP method +
  path, a request / route handler, an endpoint, the backend, an API — never "API keys" / "chave de API" —, a data layer /
  repository / SQL, "already exists" / já existe / ya existe) a page type and frontend / UI / UX are GENERIC ("a PATCH
  /me/preferences handler that the settings page calls; the UI already exists"); an empty state in a sentence about a state
  machine is weak ("the empty state blocks sales"). **1.19 verify 1** (the sentence-wide test lost +ui): a backend word does not
  count when a negator governs it (≤ 4 words back in the clause — no / not / without / n't / sem / não / nem / sin / ni; PT "no"
  is em + o: `lang` is the cue's 4th argument) — "no backend changes", "does not touch the backend", "needs no API changes" —
  nor when it FOLLOWS the page word with a consumer verb between them (`UI_CONSUMER_VERBS`: "The landing page loads its
  testimonials from the CMS API"; a backend word before the page — "a handler that the settings page calls" — or right after
  it — "the profile page backend", "the admin page's API" — still demotes); nothing is demoted in a text that says "frontend
  only" / "apenas frontend" / "solo frontend" (`RE_UI_FRONTEND_ONLY`, tested once per text); "the frontend team" / "equipa de
  frontend" names a team (generic). The genericOnly note no longer offers "the frontend" as an anchor.
- **+obs (1.19 T)** — the tenth built-in marker track `[OBS]` (observability & operability): TRACK_MARKER, `OBS_SECTIONS` (SLIs &
  SLOs · Telemetry · Alerting & Runbooks · Rollout & Rollback · Health & Capacity — no section is named "Observability", +saas's;
  ordinary names `loose`), TRACK_STEERING **`observability.md`** — the +saas stub, extended with SLOs & error budgets, rollout &
  rollback, health & capacity (no new steering file) —, US-1.AC-28..31, TRACK_ALIASES observability / o11y / monitoring / sre /
  telemetry / opentelemetry. SIGNALS.obs — strong: SLO / SLI, error budget, burn rate, observability, OpenTelemetry / `OTel`
  (capitals — a lower-case "otel" is weak: "Otel reservations"), distributed tracing, runbook, paging the on-call (gap keyword
  "page … on-call" — shadows +ui's "page"), the tools (PagerDuty, Prometheus, Grafana, Datadog, Sentry…), structured logging, a
  correlation / trace ID, `X-Request-ID`, incident response, feature flag / kill switch, a canary release / deployment (a bare
  "canary" is weak — "Canary Islands"), blue-green / progressive / staged rollout (PT implantação canário / gradual), a
  rollback plan, rolling back a deployment / release (gap keywords "roll back … release", "reverter … implantação", "revertir
  … despliegue"), liveness / readiness probes, a health (check) endpoint, fault injection, zero downtime, a monitoring / Grafana
  dashboard (listed before "grafana": the longer phrase wins its place and shadows +ui's "dashboard"); weak: monitoring /
  monitor, alert(s) / alerting, a postmortem, uptime, outage, downtime, rollback, rollout, telemetry, tracing, `APM`, error rate,
  5xx, on-call / on call, game day (1.19 T review: on-call, game day, postmortem were strong — a hospital's on-call schedule, a
  match's game day, a pathology postmortem), a request ID, latency metrics, request logs; **generic**: metrics, logs / logging,
  latency, p99 / p95 / p50, deploy — never a bare "log" ("log in") or "trace"; **context** (1.19 T review): SLA, incident, health
  check (+ PT / ES) and the **technical targets** (one concept `target`: a service, servers, production phrases, a cluster /
  Kubernetes / pod, a cron / batch / sync / import / backup job, a data / CI pipeline, an endpoint, the backend, the
  infrastructure, ops / DevOps / SRE, a status page, disk / CPU / memory usage, queue depth, consumer lag — never the bare
  business words: a sales pipeline, a production line, a job posting, a reefer container, a restaurant's server;
  `SIGNALS.obs.cues` (kind near) drops "customer / room service", "service level"). SIGNAL_CONCEPTS.obs.**watch** = monitoring · monitor ·
  alert(s) · alerting · incident · postmortem · SLA (+ PT / ES, and — 1.19 verify 3 — the verbs "alertar" / "avisar", weak; a
  health check endpoint is strong in PT / ES too: "endpoint de verificação de saúde", "endpoint de comprobación de salud"):
  business monitoring ("monitor stock levels and send alerts to
  purchasing", "incident alerts for the store manager", a help desk's SLA + alerts) is ONE hint, never +obs; a watch word +
  a technical target is ("Monitor the ERP sync job and alert ops"). SIGNAL_HAZARDS.obs: downtime / an outage ("without
  downtime") is never negated. Shared: observability / SLO / SLA / uptime stay +saas signals (a phrase may serve two tracks),
  rollback +tdd weak. The tasks' telemetry task carries `_Emits metrics:_`. No logged 1.18 classify input turns +obs on.
  **Cues as data (1.20):** a built-in track's tiers, concepts, hazards and cues are its `SIGNALS` entry in `engine/tracks.js`;
  tuning signals never edits `engine/classify.js`; a new cue MECHANISM is a `CUE_KINDS` entry there (rules: `{kind: near |
  sentence | text | clause | ownership | all (1.21: every sub-rule fires), on, ifTier?, then, …word lists / windows}`, regexes
  compiled on first use).
  classify.js derives `SIGNAL_CUES[track](hit, text, cased)` → a new tier, "none" or null; built-in tracks
  only, applied after shadowing and before the context rule; each reads a bounded window (`CUE_SPAN` 200 characters of the
  hit's clause / sentence) with linear regexes.
  **The three tracks, measured (1.19 T):** a precision / recall corpus of 133 EN / PT / ES texts (positives and hard negatives —
  mcp/test.js 1.19 T8) — 100% / 100% for each track; the 1,783 classify inputs both suites log gave the same 1.18 track
  decisions (only +api / +ui switched on beside them). The placeholder corpus (`templateCorpus()`, ≤ 2 optional tracks + all:
  47 track sets now) renders 1,165 texts (1.18: 628); `templateSets()` builds in ~95 ms (1.18: ~70 ms) — T10 bounds it
  relatively; since 1.20 `npm run build` renders it once into `engine/corpus.generated.json` and a process reads that
  (architecture.md → The build) — a new built-in track means a rebuild. Test helpers: `T19` in the 1.19 T block runs the same eight checks for each new track — a new built-in track adds
  one entry there. **1.19 T review:** on the reviewer's independent 205-text EN / PT / ES corpus precision / recall went +api
  70.4% / 95.0% → 100% / 100%, +ui 86.0% / 79.6% → 100% / 87.0% (the misses left are sales dashboards — a dashboard is +ui's
  generic word by design — and a downtime banner), +obs 68.6% / 82.8% → 100% / 100%; `1.19 T review` in mcp/test.js embeds 78
  of its hardest texts (+ 10 from the 1.19 verification's +ui findings; ≥ 90% / ≥ 85% per track); the logged classify
  inputs of both suites (2,578 distinct) replayed through 1.18, the 1.19 package-T base and the fix give the same 1.18 track
  decisions. **1.19 verification** (the verifier's 146-text corpus): +api 92.6% / 92.6% → 100% / 96.3%, +ui 100% / 71.0% →
  100% / 74.2% (the misses left are generic-word UIs: a confirm dialog, a toast, a login screen), +obs 90.6% / 93.5% → 91.2% /
  100% (the false positives left are coordinated negations: "not add feature flags or canary releases"); the reviewer's 205
  texts unchanged; 2,644 logged classify inputs and a 12,390-text keyword sweep give the seven older tracks' 1.18 decisions.
- **+data (1.21 F4)** — the eleventh built-in marker track `[DATA]` (data pipelines & data quality), added through the registries
  (VALID_TRACKS after obs, TRACK_MARKER, `DATA_SECTIONS`, TRACK_STEERING **`data.md`**, TEMPLATE_ACS US-1.AC-32..35 — a batch row
  quarantined and never loaded, an idempotent re-run / backfill of a partition, a freshness SLA alert, a breaking schema change
  rejected —, MARKER_TRACK_ORDER, RE_STABLE_BRACKET, RE_PACK_MARKER_RESERVED, `TRACK_RESERVED_SINCE.data` "1.21", the per-track
  lists of finish / brief / RTM / status / gates / removeTracks, the CLI status loop). `DATA_SECTIONS`: Data Contracts & Schema
  Evolution · Data Quality · Pipeline Idempotency & Backfills · Lineage & Ownership · Retention & Cost — the full names and the
  unmistakable data terms (schema evolution, data quality, data lineage) strict, every ordinary word `loose` (marker-bound): a
  core "## Ownership", +privacy's "[PRIVACY] Retention & Deletion" or +saas's Cost Envelope never stand in for a deleted
  [DATA] section, and a [DATA] Retention heading never satisfies +privacy's. TRACK_ALIASES (reserved pack names): etl, elt,
  pipeline(s), warehouse, datawarehouse, lakehouse, dbt, dataquality, dataeng — **never `analytics`** (a team's product-analytics
  pack — a tracking plan — keeps its name). SIGNALS.data — strong: ETL, an ELT pipeline / job / tool (1.21 review B3), a data / ingestion / batch pipeline,
  a data warehouse / lake / lakehouse / mart, data quality, a data contract / lineage / catalog / mesh, data / analytics engineering,
  schema evolution / registry / drift, a backfill job, a historical backfill, a slowly changing dimension, a star / snowflake
  schema, fact / dimension tables, dimensional modelling, OLAP, dbt model / project / test / run / job / cloud, Apache Airflow /
  an Airflow DAG, Dagster, Apache Spark / PySpark / a Spark job / Spark SQL / Spark streaming, Databricks, BigQuery, Amazon
  Redshift, a `Snowflake warehouse` / `Snowflake table` (capitals), Delta Lake, Iceberg / Hudi, a Parquet file, Fivetran,
  Airbyte, data ingestion / freshness, a freshness SLA, late-arriving data, an incremental load / model, a medallion
  architecture, data observability, a quarantine table (+ PT / ES); weak (anchors): a backfill, a warehouse, a lakehouse, a freshness check, *carga incremental*, `Snowflake` /
  `Redshift` / `Airflow` (capitals), dbt, `SCD`, lineage, ingestion, change data capture / a CDC pipeline (+dist's strong phrase
  too — a phrase may serve two tracks), Parquet / Avro, a streaming pipeline, batch processing, a data platform / product, data
  governance, BI tools / dashboards / reports and the named tools (one concept — never a bare `BI`), duplicate rows, stale data, a uniqueness check; **generic**: analytics, a dataset,
  a partition, a transformation, a batch / nightly job, ingest, upsert, a materialized view, a data / analytics engineer (a
  role — listed before "analytics": the first keyword matching at a place wins it); **context** (one concept `sql`): table,
  column, row, SQL, query / queries, schema (+ PT / ES) — "migrate the users table" names no pipeline; hazards: duplicate rows,
  stale data, schema drift. **1.21 review B3 / verify V3 — `everydayAnchors`** (a per-track table key classify.js's
  `backedBy` reads — `SIGNAL_EVERYDAY`): the +data anchors that also have an everyday sense — lakehouse, lineage / linhagem /
  linaje, ingestion / ingestão / ingesta, freshness check, `SCD`, duplicate rows, stale data (+ PT / ES) — back no context word:
  a table, a column or a query is on every screen ("in a table", "React Query"), and one of them + "the users table" turned
  +data on for a horse's lineage, SCD patients, medication ingestion, duplicate rows in the users table. A data-term anchor
  still is backed (a warehouse outside its building sense, a backfill outside a migration, a BI dashboard / report, Power BI,
  parquet, *carga incremental*): "A BI dashboard over the orders table", "Load the orders table into the warehouse every night",
  "Query the warehouse for monthly revenue" are +data (the review's first cut — context backed by a STRONG signal only — lost
  them: 1.21 verify V3). The everyday-sense words are tied to data phrases: `ELT`
  only as an ELT pipeline / job / tool / process / workflow (*pipeline / processo / proceso ELT*) — "ELT teachers"; a bare
  lakehouse, a freshness check and PT / ES *carga incremental* are anchors (strong: data lakehouse, freshness SLA, *carga
  incremental de dados / datos*); `BI` only with its tool / dashboard / report / platform / team (*ferramenta / relatório /
  painel / dashboard de BI · herramienta / informe / panel de BI*) — *o número do BI* is the Portuguese ID card. **A built-in
  keyword mixing lower-case words with an ALL-CAPS acronym** (`mixedAcronyms()` in classify.js — the BI phrases, `CDC
  pipeline` / `CDC connector`) matches its words in any case and only the acronym case-sensitively: "Relatório de BI" opens a
  sentence, "BI Dashboard" is a title, "o relatório de bi" is no BI (1.21 verify V3; a track pack's keyword keeps its exact
  case). Cues — the DATA sense FIRST (the first rule that fires decides — 1.21 verify V3: an everyday word anywhere in the
  sentence used to win): a lakehouse, a freshness check or a lineage in a sentence about data (tables, the raw zone / bronze /
  medallion, Delta / Iceberg, a pipeline, SQL, metrics, dashboards, columns, source tables…) → strong ("Load the bookkeeping
  entries into the lakehouse tables", "Add a freshness check to the grocery orders pipeline", "the column lineage of each
  metric per product family"); 1.21 verify R4: ingestion of CSV / JSON files, feeds, batches or streams into a lake or a
  warehouse ("Ingestion of CSV files into the orders table", PT / ES) and an SCD with its type / a dimension ("SCD type 2 on the
  customers table") → strong too — unless (1.21 verify N2, a `near` rule tried first) what is ingested is named right next to
  the word: "daily water ingestion", "medication ingestion", *"ingestão (diária) de água", "ingesta diaria de agua"* → none,
  even beside a CSV file; then the everyday senses: a lakehouse among lodging words (book / booked / bookings — never
  "bookkeeping" —, rent, cabins, guests, nights…), a freshness check among food words, *carga incremental* in a training plan
  or a structure, a lineage among animals / families, ingestion of water / a medication / calories, parquet among flooring
  words → none; last (1.21 verify R3), a lineage of reports, fields or models → strong ("Field-level lineage for the revenue
  report", *"Linhagem de cada campo do relatório"*) — after the animals, so "a horse's lineage in the breeding report" stays
  none. **Cues**
  (`SIGNALS.data.cues`): a warehouse in a SENTENCE with data words (SQL, "load … into", snapshots, schemas, dbt, pipelines,
  ETL / ELT, partitions, ingest…, analytics, BI — never tables / columns / queries since the 1.21 review, B4: the keep rule
  came first and "Show stock levels per warehouse in a table" kept the anchor) → keep; with the building's words (stock,
  inventory, shelves, picking, pallets, shipping, deliveries,
  temperature, staff, shifts, trucks, goods, aisles, a loading dock, robots, parcels…) → none; a backfill in a sentence with
  partitions / a pipeline / the warehouse / dbt / a DAG / history → keep, with a schema migration's words (migrat…, column(s),
  nullable, alter table, default value) → generic; "into / in / to / from / via / no / na / para / en / desde / hacia" +
  `Snowflake` / `Redshift` → strong; a Snowflake icon / pattern / theme, an Airflow reading / sensor / vent, a galaxy's /
  telescope's Redshift, DBT therapy / skills / diary → none. **Measured (1.21 F4):** 72 EN / PT / ES texts (38 positives, 34
  hard negatives — mcp/tests/04-tracks-data.js) 100% / 100%; on 36,281 inputs (the logged classify inputs of both suites —
  1.19, the 1.19 fix, 1.20 —, the reviewers' corpora rev19-t / verify19 / rev17-d / p19t, every string literal of the test
  files and an 18-frame keyword sweep of every built-in keyword) **no decision of the ten older tracks changed** (a first cut's
  "redshift cluster" shadowed +obs's context word "cluster" — dropped); +data turns on for 2 logged inputs and 1 corpus text,
  all CDC / Segment feeds into a data warehouse. The placeholder corpus renders 57 track sets now (1,387 texts ≤ T10's 1,400).
  Guide: `references/data-pipeline-patterns.md`. The EXAMPLE track pack `examples/track-packs/mobile/` (+mobile — a data-only
  pack, not a built-in track; `mobile` / `MOBILE` are no reserved names) is what references/project-tracks.md tells a team to
  copy to `.specs/tracks/mobile/` to start; 04-tracks-data.js copies it into a project and runs `tracks check` + a create.
  Its `pt/` and `es/` folders hold all five fragments (the 1.21 review B6 added test-plan.md and steering.md — PT / ES features
  got English rows and steering); pt-BR reads `pt/` (the folder chain — a pack fragment is never passed through toPtBr).
  **Measured (1.21 review + verify):** the 72-text corpus + the review's 24 (17 everyday texts, 7 data senses) + the
  verification's 19 data sentences — 115 texts, 100% / 100%.
- **1.21 F2a — the verification's remaining misses, as data where possible.** +ui: the everyday components a text names by
  themselves are strong (confirm / confirmation dialog, confirmation modal, modal dialog / window, toast notification / message,
  `snackbar` — one word: a "snack bar" is a food counter; PT / ES diálogo de confirmação / de confirmación, janela / ventana
  modal, notificação / notificación toast); weak: popup / pop-up / banner (one concept), errors "next to / beside / below each
  field" (*junto a / ao lado de / debajo de cada campo* — the `inline` concept), mobile-friendly (*adaptado ao telemóvel /
  para celular, adaptada al móvil* — the `responsive` concept); a ui cue (kind `near`, first in the list): a widget word
  (modal, dropdown, tooltip, toast, popup, banner, carousel, sidebar, navbar, spinner, picker, dialog) right after a display
  verb + an article (+ one optional word) is strong — "Show a modal …", "display a tooltip", *"Mostrar um popup"* (alone it
  stays an anchor: "the modal verbs", "modal split"). A login screen is NOT a page type (the T8 hard negatives "redirected
  to the login page" / "Log in form" stay off) — the login texts turn on through their field errors. **The mixed case:** the
  backend-only clause cue's `api` mention excludes a PUBLIC API (`notAfter` "public" / "public REST|HTTP|JSON|web", `notBefore`
  "pública" / "REST pública") — a contract for outside consumers is never the backend of one page, so "Expose a public REST API
  for the mobile app's settings screen" is +api +ui (+obs); "Expose the admin page's API …" still demotes. (The clause kind's
  `notAfter` / `notBefore` are now PHRASE lists — fragments or sequences — with a left letter edge.) +api: a new cue kind
  **`all`** (every sub-rule fires; its sub-rules are any other kind, their kinds checked at load time like the rules') — the
  first api rule: the bare `api` (generic) with an own word ≤ 2 words before it (our / nosso / nossa / nuestro / nuestra) AND a
  version in its sentence (v2, version 3, a new / major version, versioning, *versão 2, nova versão, versionamento · versión
  2, nueva versión, versionado*) is strong — "Our webhooks API needs a v2 …"; it runs before the ownership rule (which decides
  every other hit), and a third party's versioned API is untouched ("Call the Stripe API v2" — `api v2` is strong and the
  ownership rule demotes it).
- **1.21 F2a — coordinated negation (code, `coordinatedNegation()` in classify.js — every track).** A negation reaches every
  item of the list it opens, in its clause: the items are the non-shadowed matches (overlapping matches are one item, across
  tracks); consecutive items are linked by `listLink()` — a conjunction (or / nor / ou / nem / ni, ES o / u) with ≤ 1 other
  word, or a comma with articles only that a conjunction must close later ("no X, Y or Z"; "Without feature flags, the canary
  release…" is no list). Never across . ! ? ; : or a line break, a contrast word (`LIST_CONTRAST`: just / only / but / instead
  / apenas / sino / solo …), **"and" / "e" / "y"** (a new predicate: "without downtime and roll back on errors", "don't store
  PII and encrypt the rest") or a gap over `LIST_GAP_MAX` (80 characters, ≤ 4 words). A list opens at an item negated by a
  negator BEFORE it (`negatedBefore()` — `isNegated()` is now `negatedBefore || negatedAfter`; a hit keeps `negBy` before /
  after / list); a **hazard's** negation opens none ("without downtime" is its requirement), though a hazard inside a list
  carries it on. `NEGATORS` gained the negative conjunctions nor / neither / nem / ni ("sem X nem Y", "ni X ni Y"), and a
  negative conjunction after an item a negator governs negates that item too ("Não vamos usar feature flags nem lançamento
  canário": the negator is three words back). Linear: each gap is read at most twice.
  **1.21 review B / verify V · R · N — a negation EXCLUDES a keyword only when it certainly governs it (`negationOf()`, the
  principle set in verify N).** Anything else keeps the track: a track wrongly switched off loses rigor, an extra one is a
  one-word removal the human confirms in Phase 0. It certainly governs it when (a) a NOMINAL negator (`NOMINAL_NEGATORS`:
  without / sem / sin / nor / nem / ni / avoid / skip…, EN "no", a contrast after a comma "Postgres, not MongoDB") has nothing
  but fillers, articles, quantifiers or modifiers (`GOVERN_NEUTRAL`: new / more / external / longer…, or ONE word right before
  the keyword: "without real-time X") before it — a plain noun ENDS the negated phrase ("Without payments THE checkout is
  useless", *"Sem pagamentos o checkout…"*, "Without Kafka the webhook…" keep the checkout / the webhook); or a list it opened
  carries it on; (b) an ADOPTION verb (`GOVERN_ADOPT`: use / add / need / include / implement / integrate / deploy / run / offer
  / provide / ship / create / adopt / involve / enable / activate / install / embed / bundle / expose, "necessary", *falta* + PT
  / ES forms, the 3rd-person future too — *no añadirá, não incluirá* (1.21 verify P2) — whatever the modal: "must not use
  X", "should not enable feature flags", "must not expose GraphQL") or a PLAN / an INTENTION (`GOVERN_AUX` will / do / going to, *vamos / iremos* · `GOVERN_WANT` plan / intend / want, *queremos,
  pretendemos, planeamos · queremos, pensamos*…) governs it, optionally with an article / a quantifier / one modifier: "We don't
  use Kafka", "We will not add an LLM", "This feature doesn't need an LLM", "We do not plan to use Kafka", "We no longer use
  Kafka", "No need for Kafka", *"Não queremos Kafka", "No es necesario Kafka", "Nunca usaremos Kafka"* (contractions whole:
  don't / won't / doesn't / didn't; the nearest negator ≤ `GOVERN_MAX` words back in the comma-free stretch). Never an
  exclusion (`negationKind()` → "require" / "none"): an auxiliary or a modal (`GOVERN_DEONTIC`, *devemos / debemos* too) or
  never / *nunca / jamás* (`NEVER_WORDS`) + any other verb — "The report does not show the LLM cost", "must not lose
  payments", "a second write never overwrites the ledger", "We do not store / collect personal data" (store / collect are no
  adoption verbs: +privacy stays for the human to confirm); a verb form (-ing, a PT / ES infinitive — `PTES_GOVERN_WORDS` when
  the guess reads a short PT / ES text as English): "without losing X", *"sem perder X"*; a wished verb ("We don't want to lose
  payments"); a HAZARD (`HAZARD_MODS`: "don't want duplicate payments", *"pagamentos duplicados"*, "without duplicate
  charges"); `negationBlocked()`: a people relative clause (`REL_PRONOUNS` who / quem / quien — "The admin who doesn't have
  MFA must enable it"; a thing's "que no usa LLM" still excludes), a condition (`COND_BEFORE` if / unless / se / si / caso in
  the negation's own stretch, not ended by a then — "If we don't add rate limiting, the API will be abused", *"Se não
  adicionarmos…", "Si no añadimos…"*; `RE_COND_AFTER` "…unless the admin asks", *a menos que, salvo que*), a nominal negator
  inside a negated predicate ("We won't ship without a canary release", "Nobody should access the admin API without SSO": a
  double negation — never for nor / nem / ni, which continue one); a negated VERB whose object's head noun is data to protect
  (`PROTECTED_HEADS`: secrets, keys, tokens, credentials, passwords, card numbers, personal data, PII, introspection, internals,
  stack traces + PT / ES — by the phrase's head, never by the keyword's track; 1.21 verify N3 for expose / embed, generalised in
  verify P3 to ANY verb and any subject — include / contain / send / show / return / log / store / use…, a verbal negator or an
  adoption verb after a nominal one: `negationKind()` asks `protectedHead()` once and answers "require"): "The frontend must not
  embed OAuth client secrets" keeps +tdd, "The API must not expose GraphQL introspection" keeps +api, "The email doesn't include
  personal data", *"O email não inclui dados pessoais", "El correo no incluye datos personales"* keep +privacy, "The URL does
  not include the session token" keeps +tdd; a nominal "no personal data" with no verb still excludes. For any verb but the N3
  ones (`GOVERN_EXPOSE` expose / embed, which read any protected word as before) a protected word must be the HEAD: not an EN
  compound's modifier (`PROTECTED_MODIFIED`: "token cost", "secrets manager", "credential stuffing"), not after a PT / ES head
  linked by de / do / da ("custo de tokens", *"gestão de segredos"*; *"token de acesso", "chave de API"* are data to protect),
  and not a look-alike (`NOT_PROTECTED`: design tokens, an idempotency key, a primary / foreign key) — "We won't use design
  tokens", "We don't use a secrets manager" still exclude. Its readers: every match's
  `negatorBefore()` (the look-back — a cheap precheck, `RE_NEG_NEAR`, skips a match with no negator in reach), the list
  opening (`negationGoverns()`), and `conjExcluded()` — a nor / nem / ni item no list carries keeps its negation unless its
  clause's other negator negates a VERB ("Não pode perder pagamentos nem reembolsos", "sem perder dados nem reembolsos", "does
  not show X nor Y" un-negate it; "Não queremos Kafka nem RabbitMQ", "Sem integração externa nem X", "We use Postgres, not
  MongoDB nor Kafka", the correlative "Nem X nem Y" keep it). A negator negates the whole phrase it precedes: the keywords
  INSIDE it too ("sem iniciar sessão": 'sessão'), never one starting where it starts (its own reading stands: "must not embed
  the API key"); a HAZARD phrase keeps its inner keywords un-negated and opens nothing ("We will not add duplicate rows or
  canary releases"). The words are read without a quote's apostrophes ("'not add X or Y'"). B2: once a conjunction has closed
  the list a later comma ends it; a comma before an article (`LIST_ARTICLES`) joins only an item of one of the list's tracks
  (1.21 verify V2: "Without an LLM, a vector database or embeddings", "Without Kafka, the RabbitMQ broker or SQS" are one
  list), and not even that when a predicate — an auxiliary or a modal — follows the closing item ("Without payments, the
  checkout or a subscription page IS the priority"): another track's item or a predicate makes it a new clause's subject ("No
  LLM, the checkout or the subscription flow first", "Without an LLM or embeddings, the checkout or a subscription page is the
  priority" keep +tdd). **1.21 verify P1 — whose adoption is negated (`subjectKeeps()`):** a VERBAL exclusion (not a nominal
  negator, not a contrast — a contraction opening its stretch after a comma is still verbal) stands only when its SUBJECT is
  the one designing: the first person (`FIRST_PERSON` we / I / our / let's / we're… · *nós, nosso · nosotros, nuestro* — or a
  PT / ES first-person plural verb anywhere in the stretch, `firstPersonVerb()`: *usamos, vamos, decidimos, usaremos*, never
  an adjective in -mos — `MOS_WORDS`), the system being built (`DESIGN_SUBJECTS`: system / service / app / API / feature / MVP
  / version / release / page / checkout / webhook / logs… + PT / ES; `DESIGN_VERBISH` export / import / report / search and the
  team, *a equipa, el equipo* only right after an article or a possessive — "Users export data", "the support team" are no
  designing subject) or none at all (an imperative, an infinitive, "There is no need for…", *"Não é necessário
  …", "No se necesita…"*). A role, a user group, a plan / tier / edition / account / tenant (`ROLE_SUBJECTS`: users, guests,
  viewers, editors, admins, members, customers, tenants, accounts, plan(s) — not the verb "plan not to" / "plan to" —, tier,
  edition, subscription, seats… + *utilizador(es), convidado(s), plano, conta(s), escalão · usuario(s), invitado(s), plan,
  cuenta(s), nivel*…) states an access or entitlement rule, whatever the modal (can / can't / cannot / may / could, must /
  should, *pode / deve · puede / debe*): the track stays — "Guests can't use the checkout", "Free users may not use the LLM
  assistant", "Users on the free plan must not use the LLM assistant", "The Starter plan doesn't include the LLM assistant",
  *"Os editores não podem adicionar feature flags", "Las cuentas de prueba no incluyen el asistente LLM"*. A subject in
  neither list keeps the track too (the conservative default) — except a COMPONENT (1.21 verify P2, `componentAt()`): the nearest
  other noun, no complement, with a singular definite article, demonstrative or possessive ≤ 3 modifiers back (`SINGULAR_DETS_EN`
  the / this / our / its — a noun in -s after them is a plural —, `SINGULAR_DETS` o / este / esta / nosso / nossa / el / la /
  nuestro / nuestra, PT "a" in a PT text) is a part of what is being designed: after a PLAIN verbal negation (`plainNegation()`:
  an auxiliary or a present / future verb — does not, won't, *não usa, não vai usar, no usa, no usará*) it excludes ("The
  importer does not need Kafka", "The new search won't use embeddings", *"O agendador não usa Kafka", "El programador de tareas
  no usa Kafka"*); after a modal (can't / cannot / may not / must not, *não pode / não deve, no puede / no debe*) it keeps, and
  so do a bare or -s plural ("Suppliers don't use the checkout", "The importers…"), an EN "a" and a role (checked first: "The
  mobile client"). The subject (`subjectOf()`): the nearest listed word back to
  the clause start (the comma-free stretch), past a prepositional phrase ("Tenants ON the free plan", "The service FOR free
  users", *"Um utilizador SEM subscrição"* — an article ends the phrase: "At launch the app…") and a relative clause ("Guests
  WHO open the page", "Guests THAT…"); a listed noun right before another is its modifier ("the admin page"); a design noun
  may be an earlier verb's object, so a role further back still keeps ("Guests can view the page but can't use the
  checkout"); after a comma with no subject in the stretch the sentence's earlier words are read, and a role there keeps
  ("Free users, however, can't use the checkout"; "For the MVP, don't use Kafka" still excludes). "cannot" is a negator like
  "can't" (`NEGATORS`), and an EN "no" is read as verbal when a verb follows it (an ES "no" in a short text the guess reads as
  English: "Los invitados no pueden usar el checkout"; "no longer uses"). An EN "no" right after an adoption verb negates its
  noun for certain — only a role subject keeps it ("The free plan has no webhooks" +saas; "The MVP has no LLM", "WHEN the month
  has no invoices" exclude). Measured below.
  **Measured (1.21 F2):** the verifier's 146 texts: +api 100% / 96.3% → 100% / 100%, +ui 100% / 74.2% → 100% / 100%, +obs
  91.2% / 100% → 100% / 100%; the reviewer's 205: +ui recall 87.0% → 88.9% (a banner), the rest unchanged; the 1.17 +dist
  corpus unchanged (96.8% / 100%). On 37,881 inputs (the logged classify inputs of both suites — 1.19, the 1.19 fix, 1.20 —,
  the corpora, every string literal of the test files and an 18-frame keyword sweep) the older tracks' decisions changed ONLY
  where a coordinated list or a negative conjunction now reaches a keyword (the sweep's "not add retries or X" / "sem … nem X"
  / "sin … ni X" frames, and the logged "sin datos personales ni autenticación": +tdd off); "No X, just …" and "Without X,
  the …" frames change nothing. `1.21 F2a` in mcp/tests/04-tracks-builtin.js embeds the cases (+ a 40-text precision /
  recall assertion, ≥ 95% per track).
  **Measured (1.21 review B — B1 … B4, first cut):** a three-way differential (1.20 at c2ade64, 1.21 at 427cd05, the fix) over 66,621
  distinct inputs — the 2,249 classify inputs both 1.21 suites log, 9,254 string literals of both suites' test files in the
  three trees, the reviewer's texts, and a 31-frame sweep of every built-in keyword (55,115: the F2 frames plus "must not lose
  X nor …", "não pode perder X nem …", "No puede perder X ni …", "Sem perder X nem …", "Without X, the checkout or …",
  "Without Kafka or RabbitMQ, the X or …", "Sem LLM nem embeddings, o X ou …", "Store the X in the users table", "Show X
  per warehouse so pickers…", "No new X or …", "The export must not use X or …", "Nem X nem …"). 15,239 decisions differ
  from 1.21, ALL in those families: the B1 / B2 frames (12,063 back to 1.20's decision; the 3,176 neither version had are a
  1.21 intended change — a negated LLM / Kafka, a new +ui / +data keyword — combined with the fixed part), a lone +data
  anchor + a table, a stock sentence, the tied words (elt, BI, lakehouse, carga incremental, freshness check) and the
  correlative "Nem X nem …" now reaching the keywords inside X; the logged inputs changed only for the +data self-match
  sweep's five tied words ("We need elt here"), the literals only for the new tests and one test message ("ni autenticación'
  (+tdd off)": "ni" two words back no longer negates "tdd"). +data on the 72 + 24 corpus: 73.8% / 100% → 100% / 100%; the
  +dist (45), 1.19 T8 (133), 1.19 T review (88) and F2a (40) corpora unchanged at 100% / 100%.
  **Measured (1.21 verify V1 – V5):** the same differential with a 39-frame sweep (+ "Não queremos X nem …", "We will not
  integrate X or …", "We use Postgres, not X nor Kafka", "Without an LLM, a X or embeddings", "The system must not lose X", "The
  service must not leak X", "No es necesario X ni …", "Load the X into the warehouse tables…") — 81,075 inputs. Against the
  review's first cut (a682f55) 11,661 decisions changed, all intended: V1's exclusions negate the whole list again (5,086), V5 /
  B1 frames keep a deontic modal's object (4,469), data-term anchors + a table / a query are +data again (1,795), the phrase a
  negator precedes is negated whole (161), same-track article lists (92) and the new tests' texts (58). Against the 1.21 base
  (427cd05) 18,862 changed — the B1 / V5 requirement frames (12,205), the B2 / V2 frames (6,161), the phrase rule (266), the V1
  frames' inner phrases (85), the +data everyday words (98), the logged self-match sweep's five tied words and 42 literals, all
  the reviewers' and the tests' own cases. Every corpus 100% / 100% (+data: 115 texts).
  **Measured (1.21 verify R1 – R4):** four columns (1.20 c2ade64 / the 1.21 base 427cd05 / the V fixes 8b62972 / the change) over
  100,713 inputs — a 50-frame sweep (+ "We don't use X", "We will not add a X", "Nunca usaremos X", "We do not plan to use X",
  "Não vamos integrar X, RabbitMQ nem SQS", "We didn't add X to the checkout", "The service must not install X", "Logs must not
  expose X", "We never store X", "We do not want to lose X", "No queremos perder X"). Against 8b62972 10,976 decisions changed,
  all intended: R1's single-item exclusions and contractions (We don't use / We will not add a / Nunca usaremos / We do not plan
  to use: 957–965 each, "We don't need X or canary releases" 1,705, the 3-item nem list 1,704, "We didn't add X to the checkout"
  861 — X off, the checkout kept), R2 (must not install 1,011, Logs must not expose 849 — a +sec / +privacy keyword kept), "never"
  before a verb stating a behaviour (957), a hazard phrase opening no list (10), three gap-keyword oddities of "Sem perder X nem …"
  now read like every other X, and the 38 R test texts; no logged input changed. Against 427cd05 27,466, against 1.20 49,696.
  Every corpus 100% / 100% (+data: 129 texts; F2a: 45). At 200 KB the slowest input classifies in ~0.4 s (a negator precheck,
  `RE_NEG_NEAR`, spares the farther look-back).
  **Measured (1.21 verify N1 – N3):** the verifier's 726 sentences (rv/*.json and the scratch sets) through 1.20 / 427cd05 /
  290e68c / the change: 36 decisions changed against 290e68c, each N1 – N3 or settled by the principle — the N1 cases back to 1.20
  (a noun ends the negated phrase, an auxiliary + another verb, a people relative clause, a condition incl. the do-not / PT /
  ES forms), the double negations ("We won't ship / release without X", "Nobody … without SSO"), the N2 ingestion texts (off), the
  N3 hazards and protected heads, and six texts whose verb is no adoption verb ("We will not store / We do not collect personal
  data", "Não recolhemos dados pessoais", "Não vamos guardar cartões…", "The UI does not show personal data", "No se guardan
  datos personales" — +privacy kept for the human to confirm). The keyword differential (113,205 inputs, a 57-frame sweep):
  5,712 changed against 290e68c — the N1 frames (does not show 981, a condition 973, a relative clause 964, won't ship without
  957, without X the checkout 629), N3 (don't want duplicate 949, Logs must not expose 171 — by the head noun), "We no longer
  use X" 55 (a governed exclusion), the new tests' texts (31) and two gap-keyword oddities; no logged input changed. Against
  427cd05 29,170, against 1.20 51,871. Every corpus 100% / 100% (+data: 133 texts). 50 / 100 / 200 KB: ≤ 0.15 / 0.3 / 0.62 s.
  **Measured (1.21 verify P1):** the verifier's 859 sentences (rv/*.json incl. n4a – n4d, and the scratch sets) through 1.20 /
  427cd05 / d10260f / the change: 30 decisions changed against d10260f — 27 role / plan sentences (n4c / n4d and their cmp6
  copies) whose track is back (+ai, +tdd, +obs, +saas; "Free users may not use…", "Users on the free plan must not use…", "The
  free plan does not include webhooks" and PT / ES, "O plano básico não suporta subscrições" are on for the first time — 1.20
  lost them too), "A user who has no subscription cannot use the LLM assistant" (+tdd: the role's "has no subscription"),
  "The LLM prompt must not include personal data" (+privacy: "the prompt" is no listed subject — the conservative keep) and one
  test message; every n4a exclusion and n4b requirement reading unchanged. The keyword differential (141,741 inputs, a 73-frame
  sweep: + "Guests can't / cannot use X", "Free users may not use X", "The free plan does not include / has no X", "The service
  must not use X", "This feature does not require X", "Os convidados não podem usar X", "O plano gratuito não inclui X", "Los
  invitados no pueden usar X", "El sistema no debe usar X", "We're not going to add X", "There is no need for X", "The MVP has no
  X", "Decidimos não usar X", "Guests who open the page can't use X"): 7,589 changed against d10260f, NONE switching a track
  off in the sweep — the role / plan frames keep X (7,543: 957 per frame, 1,034 / 863 / 861 for the relative clause, "has no"
  and the ES one), "Mostrar X numa tabela no painel" twice (PT "no painel" is em + o: kept), one logged input ("a retried
  request never charges twice" +tdd: "the request" is no designing subject) and the new tests' texts (43 — "The service /
  We cannot use X" now exclude like can't); the designing-subject frames change nothing. Against 1.20 58,839. Every corpus
  100% / 100%. 50 / 100 / 200 KB: ≤ 0.15 / 0.23 / 0.51 s.
  **Measured (1.21 verify P2):** the verifier's 950 sentences (+ p5ex / p5keep / p5c): 13 decisions changed against 0ed99a5,
  each a component's plain negation now excluding (The importer / scheduler / uploader / notifier / crawler / gateway /
  newsletter, "The new search", *O importador, El importador, O agendador, El programador de tareas*) or the future "La versión
  2 no añadirá suscripciones"; every p5keep and n4a – n4d decision unchanged. The keyword differential (156,001 inputs, an
  81-frame sweep: + "The importer does not need X", "El importador no necesita X", "O agendador não usa X", "The importer can't
  use X", "Suppliers don't use X", "The importers don't use X", "La versión 2 no añadirá X", "O MVP não incluirá X"): 4,695
  changed against 0ed99a5 — the three component frames (957 / 861 / 957) and the two future-tense frames (949 / 957) exclude X,
  and the new cases; no logged input or literal changed, and the modal, plural and bare-plural frames keep X. Every corpus
  100% / 100%. 50 / 100 / 200 KB: ≤ 0.14 / 0.28 / 0.56 s.
  **Measured (1.21 verify P3):** the verifier's 994 sentences (+ p6 / p6b): 11 decisions changed against 9ea21e7, each a
  protected object now KEEPING its track ("The email / receipt / export doesn't include personal data", "The webhook payload
  won't include personal data" +privacy, "The URL does not include the session token" +tdd, *"O email não inclui dados
  pessoais", "El correo no incluye datos personales"*, "The notification does not include PII", "The export must not include
  personal data", "The API response will not include personal data", "The chatbot must not use personal data"); nothing lost a
  track. The keyword differential (164,909 inputs, an 86-frame sweep: + "The email doesn't include X", "O email não inclui X",
  "El correo no incluye X", "The URL does not include the X token", "Without exposing X"): 1,067 changed against 9ea21e7, NONE
  losing a track — the token frame (738, by construction), the protected keywords themselves in the exclusion frames (password
  / senha / contraseña, token(s), access / refresh token, API key, credential(s), secrets, personal data, PII + PT / ES: 314 —
  a list such a keyword opens no longer carries its negation on: "We will not add personal data or canary releases" keeps
  +obs too) and the new tests' texts (15); no logged input changed. Every corpus 100% / 100%. 200 KB: ≤ 0.61 s.
- **1.21 F2b — project-level signal overrides (`.specs/classifier.json`, classify.js).** A Phase 0 correction is learned:
  `createFeature` on a NEW plain feature (not a bugfix / spike / import — `cls` is not given) with explicit `tracks` and a
  non-empty summary compares the summary's classification (the suggestion classification.md records) with the chosen tracks
  (`learnSignalOverrides(projectDir, clsR, t)`): a track suggested and left off → its driving words vote `off` (the strong
  ones, else the anchors — generic words never drive a track); a track added that was not suggested → its lone weak / generic
  word votes `strong`, two or more generic words vote `weak` each; the words come from the result's NON-enumerable `tiers`
  (the matched tiers after the de-dupe — never in the JSON). A vote in the same direction counts up (`count`); an opposite one
  starts over; an agreement (a suggestion kept / a hint left off) resets a pending (count < 2) record; a correction that
  contradicts an APPLIED learned override drops it. A learned record applies at `SIGNAL_OVERRIDE_MIN` = 2; one set by hand
  (`origin: "set"`) at once, and learning never changes it. Words follow the track-pack keyword rule (`RE_PACK_KEYWORD`,
  2–60 characters — a gap keyword like "page … on-call" is never learnable). **The file** — `{"signals": [ … ]}`, one record
  per line `{track, word, effect off|weak|strong, count, origin learned|set, lastAt}`, sorted by track and word (two branches
  learning different words merge line by line), at most `SIGNAL_OVERRIDE_MAX` = 200 records (a full file evicts the oldest
  pending learned one, never an active one), ≤ 64 KB, lstat'ed (a link / folder is `not-a-file`). A separate file, not
  roadmap.json meta: it has its own merge story and a broken classifier.json never touches the roadmap's. Written only under
  the roadmap lock (re-read from disk inside it); a file that doesn't parse, or holds ANY invalid / duplicate / over-bound
  entry, is read without those entries (classify: `overridesWarning {code, entries?}` + a note) and NEVER rewritten — set /
  forget / learning refuse (learning: `signalOverrides {error}` + a note; the create still succeeds). **Applied** by
  `classify(…, {projectDir})` (spec_classify, CLI classify, spec_create, and now spec_import) as a layer over the tables
  (`projectSignalLayer()` — active records of the tracks this call reads): `off` drops that track's keyword (case-insensitive
  match with the table's spelling; its place stays free for a shorter keyword); `weak` / `strong` re-tier it before shadowing
  and cues; a word no table of that track has is matched as a literal (`keywordRe(word, true)`, a pack's rule) at its tier.
  Never silently: `overrides [{track, word, effect}]` (only those that changed THIS reading) + `classify.overridesApplied`;
  spec_create adds `signalOverrides {learned, forgotten, capped?}` + `signals.learned*`. **No classifier.json → no layer,
  byte-identical results** (no new key; a file of pending records only reads the same too). `explain: true` (spec_classify /
  `classify --explain`) adds `explain {matches: [{track, keyword, text, base, tier (strong / weak / generic / context /
  shadowed / none / unbacked), cue, override, negated, negation}], overrides: [… + active, applied], min}`. **Surfaces:**
  `spec_tracks {action: "signals", op: list | set | forget, track, word, effect}` — an action of an existing tool, not a 39th
  (the overrides tune the track registry this tool already manages; spec_classify stays read-only) — = `dev-spec signals [list
  | set <track> <word> off|weak|strong | forget <track> <word>]` (exit 1 on a refusal; `--explain` is in `CLI_SWITCHES`).
  Stable codes: effects, origins, problem codes `invalid-entry` · `duplicate` · `too-many`, file codes `invalid-json` ·
  `invalid-shape` · `too-big` · `not-a-file` · `unreadable` · `invalid-entries`. Messages: `msg.classify` (overridesApplied,
  overridesInvalid, explain*) and `msg.signals` (EN / PT / ES; pt-BR derived — the PT strings avoid the 2nd person). Tests:
  `1.21 F2b` in mcp/tests/04-tracks.js, cli/tests/04-tracks-signals.js (MCP ↔ CLI parity).
- **Readers go through the accessors (1.15), never the constants.** The constants above are the BUILT-IN tables;
  `allTracks()` (VALID_TRACKS + the project's valid packs, in name order after the built-in ones), `optionalTracks()`,
  `markerTracks()`, `trackMarker(tr)`, `trackSectionTable(tr)`, `trackSteeringFiles(tr)`, `trackSignalTable(tr)` add the
  track packs of the project the current engine call works in. The regexes built from the registries have pack-aware
  twins (`trackRunRe()`, `headingLeadRe()` — cached per marker set; names / tokens are validated `[a-z0-9]` / `[A-Z0-9]`,
  regex-safe). Deliberately built-in only: `templateCorpus()` / `templateTaskSet()` (process-wide caches — the packs'
  blocks join the per-call corpus instead, `packCorpusSets()`) and the built-in rows of `spec_tracks list`. The exported
  `VALID_TRACKS` / `OPTIONAL_TRACKS` / `TRACK_MARKER` / `trackSections` / `trackSignals` stay built-in (the CLI's classify
  line reads the result's `confidence` keys instead).
- **SEC / PRIVACY section tables.** `SEC_SECTIONS` never lists a bare "security" synonym (the core design's own
  "Security Considerations" is not a `[SEC]` section). `PRIVACY_SECTIONS` entries may carry `loose: [...]` — the synonyms
  that are ordinary design words (Processors, Retention, Conservação, Data inventory, Avaliação de impacto…):
  `extractSection(md, syn, marker, loose)` accepts them only on a heading carrying `[PRIVACY]` or on an unmarked heading
  nested under one (`inTrackContext`) — a core `## Processors and queues` must never satisfy a deleted `[PRIVACY]`
  section. The strict synonyms keep the unmarked fallback anywhere (hand-written and marker-less PT/ES designs) — except
  inside ANOTHER track's section (1.21 review B5, `inOtherTrackContext`, the mirror: the nearest enclosing heading that
  carries a marker carries another track's — built-in or a pack's): "### Qualidade dos dados (LGPD art. 6º, V)" under
  "## [PRIVACY] Fundamento de Licitude e Finalidade" is +privacy's text, never the deleted `[DATA] Qualidade dos Dados`; an
  unmarked top-level "## Data Quality" still satisfies it. Only for a track section (a `marker`), never a core one.
- **Markers are case-sensitive tokens** everywhere (`headingHasMarker`, `inactiveMarkerLines`, `trackAcIds`,
  `extractSection`, the brief): `### Timeout [sec]` is prose, never +sec. `RE_STABLE_BRACKET` lists `SEC` / `PRIVACY`.
- **Signal tiers** (`SIGNALS[track]`): `strong` (turns a track on alone), `weak` (score 1 — two weak ones, or a strong
  one, turn it on; a lone weak one is only "possible"), and `context` (corroborating-only, e.g. `permission` for +sec:
  weak evidence ONLY beside another non-negated signal of that track; alone it is no signal, no "possible" note, no
  "kept off" note — "file permission bits"). A keyword written with capitals (`STRIDE`) is an acronym matched
  case-sensitively on the original text; lower-case `stride` is no signal. A WEAK signal inside a longer STRONG signal of
  another track is shadowed (`model` in "threat model", `security` in "row-level security"). Generic privacy words
  (`consent`, `retention period` / `retention policy` and twins) are weak; encryption in transit and security testing
  are strong in EN/PT/ES alike — keep the three languages aligned when you add a signal. `keywordLiteral()` is a literal
  precheck (a keyword pluralize() leaves alone is its own whole literal) so a text without it never compiles its regex.
  **1.22 review — +sec's two-factor signal in PT / ES:** `two-factor` had no PT / ES twin, so "Adicionar autenticação de dois
  fatores" was `core +tdd` while its English twin was +sec. sec.weak gained `multi-factor`, `multifactor` (EN = ES), PT `dois
  fatores`, `multifator`, ES `dos factores`, `doble factor` — each a separate word, never the whole "autenticação de dois
  fatores" phrase (it would win its place and shadow the auth word: ONE signal where English has two). A lone one is a
  "possible +sec" note ("os dois fatores principais"). **Measured:** the differential (e2bb4d1 vs the fix) over 40,579 inputs —
  6,756 string literals of both trees' test files and evals + a 20-frame sweep of every built-in keyword (1,782, incl. "Add K and
  multi-factor sign-in", "Adicionar K com dois fatores", "Añadir K con dos factores", "autenticação K de dois fatores"): 1,863
  decisions changed, ALL +sec switched on in an input holding one of the new words (the sweep's frames and the review's 7 test
  texts); no track switched off, no existing literal changed. **Review 2 — the factor words count only as authentication:**
  "depende de dois fatores", "depende de dos factores", "doble factor de ponderación", "a multi-factor risk model" were a weak
  +sec signal (a "Possible +sec", and ON with one more weak word: "… dois fatores e da segurança da entrega"). Two +sec cue
  rules (data, `SIGNALS.sec.cues`): `near` an auth word — before (authentication / auth / login / sign-in / SSO / verification /
  autenticação / verificação / início de sessão / acesso / autenticación / verificación / inicio de sesión / acceso, a link word
  between allowed: de / em / com / por / en / con / with / via …) or after ("… de autenticação", "… of authentication", "… for
  the login") — `keep`; else the catch-all `sentence` rule (the hit's own sentence always holds the hit) — `none`. Only the
  1.22 words (`multi-factor`, `multifactor`, PT `dois fatores`, `multifator`, ES `dos factores`, `doble factor`); `two-factor`,
  `2fa`, `mfa` keep their reading. **Measured:** the differential (7cf3843 vs the fix) over 32,719 inputs — 11,113 string
  literals of both trees' test files and evals (0 track decisions changed; 4 reasonings, all holding a factor word: "weak
  signal only ('dois fatores')" → "no signals matched") + a 13-frame sweep of every built-in keyword (the other 21,606 texts:
  1,943 +sec switched OFF, every one in a frame holding a factor word; 0 switched on; 9,668 more reasonings changed — no input
  without a factor word changed at all). The A2 self-match sweep probes each factor word beside an auth word.
  **Review 3 — the natural phrasings:** "Iniciar sesión con doble factor", "Os administradores passam a entrar com dois fatores",
  "Require multifactor at login" were no signal at all (their English twin "Admins sign in with multi-factor" is a weak one): the
  `near` cue's auth words gain the verbs `iniciar sesión` / `iniciar sessão` (+ unaccented), `entrar`, `log in` (`sign in` was
  there), in both directions, and the AFTER connectors `at`, PT `ao`, ES `al` ("doble factor al iniciar sesión") — still only
  RIGHT NEXT to the factor word (`entrar no mercado com dois fatores` stays none). **Measured:** the differential (f67e2ff vs the
  fix) over 53,462 inputs — 7,168 string literals of both trees' test files and evals + a 27-frame sweep of every built-in keyword
  (7 new frames: "Iniciar sesión con K", "Os administradores passam a entrar com K", "Require K at login", "K al iniciar
  sesión", "K ao entrar", "Admins log in with K", "Vamos entrar com K"): 66 decisions changed, every one an input holding a factor
  word next to a new auth verb / connector — 62 gained the weak +sec signal (a "Possible +sec" note) and 4 switched +sec ON
  ("autenticação iniciar sessão de dois fatores": the auth word is the second signal); 0 literals changed, 0 tracks switched off.
  Known cost: "entrar" is also everyday PT / ES ("O preço vai entrar com dois fatores de risco" reads a weak signal — a note,
  never ON alone).
  **Review 4:** (1) the catch-all `sentence` rule's phrases take every inflection the keyword matcher accepts (`(?:e?s|ed|ing|d)?`
  — INFLECTION): "a multi-factored discount and a security deposit" kept the weak signal and was ON; (2) PT / ES put the adjective
  AFTER the noun, between the auth word and the factor word — one optional adjective slot in the `before` sequence (`forte(s)`,
  `fuerte`, `obrigatóri[ao]`, `obligatori[ao]`, `reforçad[ao]`, `reforzad[ao]`, `adicional`, `segur[ao]`): "autenticação forte de
  dois fatores" / "autenticación obligatoria de doble factor" were a hint while "strong multi-factor authentication" is ON; (3) the
  auth verbs conjugated: `log(?:s|ged|ging) in`, `sign(?:s|ed|ing) in`, `inicia[mn]? sess[ãa]o`, `inicia[mn]? sesi[óo]n`. Checked
  with the reviewer's cases (tests/04-tracks.js) — no differential run this round. Known costs left: `acesso` / `acceso` /
  `verificação` in their everyday sense ("Os dois fatores de acesso ao crédito… e a segurança do emprego" is ON), a noun phrase
  between the two words ("autenticação dos administradores com dois fatores" stays a hint), and a negated auth noun whose factor
  word still counts ("Sem autenticação de dois fatores… registo de auditoria" is ON — negation reaches the first keyword only).
  **Reasoning:** a track kept off with weak / app-level words
  (`signals[t]` non-empty) reads `classify.offWeak` ("+api: off — weak signal only ('endpoint'), not enough on its own.", EN /
  PT / ES), never "no signals matched" beside a "Possible +api" note.
  **Review 5 — recall (data, `SIGNALS`):** +sec weak gains the credential and the federation protocols — `password`, *senha*,
  *palavra-passe*, *contraseña*, `sso`, `single sign-on`, `oidc`, `openid connect`, `saml` (one concept each in the new
  `sec.concepts`: "SSO (single sign-on)" is one hint, "OIDC single sign-on" two) — so "user authentication with email and
  password" is +sec (two weak), a password reset alone a hint; +tdd strong gains `single sign-on`, `oidc`, `openid connect`,
  `saml` (auth words, beside `sso`); +sec strong gains role-based access control (EN, PT *controlo / controle de acesso baseado
  em funções / perfis / papéis*, ES *control de acceso basado en roles* — the weak `access control` inside it is shadowed); +ai
  strong gains machine learning / machine-learning, ML model, deep learning, neural network (PT *aprendizagem automática*,
  *aprendizado / aprendizagem de máquina*, *modelo de ML*, *rede(s) neural/neurais* · ES *aprendizaje automático*, *red(es)
  neuronal(es)*); +api's ownership-ambiguous names (weak, `concepts.kind`, the cue's `ambiguous` and `kinds`) gain `rest
  endpoint` / *endpoint(s) REST* — "Expose a REST endpoint for orders" is +api (an own verb), "Call the Stripe REST endpoint"
  a hint. **Measured:** the differential (7ed88be vs the change) over 13,717 inputs — the string literals of both suites' test
  files and the evals (189 files) + a 15-frame sweep of the new / changed words (480 texts): 189 track decisions changed, every
  one a track switched ON (+sec 21, +tdd 83, +ai 88, +api 6) in an input holding a new word, a glued version or a PT / ES
  summary whose "no" is em + o; NO track switched off; 143 language guesses changed (PT / ES texts read as English before —
  "Erro de Login", "Exportar facturas", "Formulario de inicio de sesión"). Two existing test texts were re-worded: "Cifrar las
  contraseñas" is two +sec signals now (03-languages' lone-verb example is "las facturas"), "Excluir contas" is PT now (the tie
  example is "Excluir registros").
- **Tracks are persisted in `.state.json` `tracks`** (create / add_track / add_track --remove write them)
  and `detectTracks()` reads them first. Only features without a saved list (pre-1.13) fall back to
  their files, and there a `[SaaS]`/`[AI]` marker counts only on a real markdown heading (a Mermaid node
  `X[AI]` or prose used to switch +ai on). A saved name shaped like a pack's (`^[a-z][a-z0-9]{1,19}$`) the project lacks
  now is kept in the list and dropped from the active tracks (1.15 — `track-pack-missing`).
- **Track input goes through `parseTracks()`**: arrays or strings split on space/comma/`+`
  (`'tdd,saas'`, `'+saas +ai'`), case-insensitive; an unknown token is a localized error with a
  did-you-mean. That is why the MCP `tracks` schemas carry **no enum on purpose** — an enum would refuse
  `'tdd,saas'` before the engine could split it or suggest a fix.
- **Removal is non-destructive** (`spec_add_track {remove:true}` / `add-track --remove`): files stay, the
  result lists them as inactive, and doctor/status/next_action/roadmap stop requiring them (`activeTasks()`
  drops a removed track's task section). `core` can't be removed; a bugfix keeps +tdd. **1.24 review 6 (E3):** removing
  +tdd or +ai drops a gate (the test / eval plan, Phase 4 — gates.js `phaseActive`), so with `meta.approvalGuard` on, an
  agent's removal naming one of them (`APPROVAL_GATED_TRACKS` in engine/guards.js — no other built-in track or a pack adds a
  phase) is a guard-down: asked / refused with the `add-track <f> <track> --remove` line the human runs
  (claude-code-integration.md → Human approval guard). Adding a track, or removing one without a phase, is never one.

## Project-defined tracks (1.15) — `.specs/tracks/<name>/` track packs
- **What a pack is:** `track.json` (JSON with `//` / `/* */` comments — `stripJsonComments()`, one linear pass) + optional
  fragments `requirements.md` · `tasks.md` · `test-plan.md` · `checklist.md` · `steering.md` (`PACK_FRAGMENTS`), a `<lang>/`
  subfolder's winning over the root's (`packFragment()`: lang → its family → root). A VALID pack is a MARKER track: every
  registry reader sees it through the accessors (The track model). Guide: `references/project-tracks.md`.
- **Loading:** `packRegistry()` → `loadTrackPacks(root)` for `TEMPLATE_SCOPE_ROOT` (specsRoot's per-call project; detectTracks
  also calls `useTemplateScopeOf(dir)`), memoized in `PACK_MEMO`, dropped by `forgetCached` under `.specs/tracks/` (tracks
  init), `invalidateReadCache` and every read-cache scope's start / end. No scope → no packs (a direct engine call outside
  an exported function sees the built-in tracks only). `PACK_LOADING` makes every registry reader answer built-in-only
  while the packs load (never a half-built registry). Registry: `{packs, names, byName, byToken, problems, entries, legacy,
  corpus}` — packs in folder-name order; problems are `{file, severity, code, args, line?, pack?}`, localized only when
  shown (`localizePackProblem`, `msg.trackPacks.problems[code]`), so the memo is language-neutral. **Cross-call caches**
  (F4 review R9 — 20 packs × 4 languages cost ~100 ms per call): `packScan()` lists a pack's folder + `<lang>/` folders and
  lstats each allowlisted file → `sig` (size / mtime / ctime / inode per entry); `PACK_CACHE` (per pack folder, bounded 64)
  returns the validated result while the sig is unchanged — an edit is picked up by the next call; the pack folder's
  realpath is checked every call. `PACK_CORPUS_CACHE` (bounded 16) keys the placeholder corpus by every valid pack's
  name / token / sig. A project without `.specs/tracks/` pays one existsCached.
- **Validation (`loadPack`) — any error ignores the pack as a whole:** name = folder, `RE_PACK_NAME` `^[a-z][a-z0-9]{1,19}$`,
  never `packReservedName()` (VALID_TRACKS, TRACK_ALIASES keys, `PACK_RESERVED_WORDS`, Windows device names, PROTO_KEYS);
  marker `RE_PACK_MARKER` `^[A-Z][A-Z0-9]{1,11}$` (bare or `[X]`), never `RE_PACK_MARKER_RESERVED` (built-in markers, US\d /
  P\d / SHARED, TODO / TBD / TBC / FIXME…, AC / SC / EC / NFR / T prefixes), unique (the first pack by name keeps it —
  `marker-duplicate` on the other); title / section names / syn: `packTextOk()` (2–80, one line, no `[ ] < >` or backtick —
  they land in headings); section names never a PROTO_KEYS word (they key `sectionNames` lookups); guidance
  `packGuidanceOk()` (one line, no `<!--`/`-->`, never a heading or fence); keywords `RE_PACK_KEYWORD` (letters / digits,
  inner space - ' . ’, 2–60) — a regex-looking keyword is `signal-invalid`, and a valid one still reaches the classifier
  only through `keywordRe` (escaped); steering: `RE_CUSTOM_STEERING` minus device / proto names. Bounds `PACK_LIMITS`
  (20 packs, 32 KB track.json and per fragment — size read by lstat BEFORE the content, 20 sections / 20 syn / 50 keywords
  per tier / 20 fragment items). Files: `packScan()` — lstat, a regular file (never a link), in a folder chain checked once
  per pack (`.specs/tracks/` no link, the pack folder's realpath inside the real `.specs/`, a `<lang>/` Dirent no link — no
  per-file realpath: it adds nothing for a regular file and was the loader's biggest cost); `readPackItem()` reads it after
  the lstat size check; the pack folder itself is refused when it is a link (Dirent `isSymbolicLink`, which a Windows
  junction is) or resolves outside. Sections: every name / synonym is keyed by `packSectionKey()` — lower-case, the
  RE_HEADING_LEAD lead stripped (numbering, `Section N`, an emoji, a dash — what `headingMatches` strips from the heading;
  F4 review R4; nothing left → `field-invalid`, a lead stripped → warn `section-name-lead`), and every synonym is
  MARKER-BOUND (`loose` = all of them — F4 review R7: a core `## Architecture` never satisfies a pack's Architecture; a
  name equal to a core design heading, `coreDesignHeadingKeys()` over the EN / PT / ES design, warns `section-core-name`).
  Fragments: `packListItems()` (top-level item = at most one space before the bullet; lines
  indented ≥ 2 are its continuation), `packTableRows()` (six cells, header + separator skipped; else `fragment-row`);
  `{{acN}}` / `{{tN}}` beyond what the pack scaffolds in that language context → `fragment-ref` (its args name the context
  and the file the count comes from — F4 review R10). Warnings only:
  unknown keys / files / variables, an empty fragment (the default is used), a steering name a built-in track also uses.
  Stable codes are in the guide and in `spec_tracks`' description.
- **Rendering (EN / PT / ES / pt-BR — `msg.trackPacks`):** `packDesignBlock` (`## [MARKER] <name>` + `todoLine` +
  guidance — `packSubstBasic()` fills its `{{title}}` / `{{marker}}` / `{{name}}` / `{{slug}}`; `trackDesignBlock(tr, lang,
  vars)`), `packRequirementsBlock` (`#### [MARKER] <title> — Acceptance Criteria (EARS)`, numbered after the highest
  US-1 AC of the text it joins; `insertPackRequirements()` puts it before the first REAL `#`/`##`/`###` heading after the
  last US-1 criterion — `commentLines()`: never one inside an HTML comment or fence, F4 review R3 — else at the end), `packTaskBlock` (`## Story US-1 — [MARKER] <title>`, numbered after the last task;
  `_Requirements:_` added when a task has none — the pack's AC IDs per `trackAcIds`, else the track's `acPlaceholder`;
  the DEFAULT task also gets `_Makes green:_` from `packPlanRows()`; a fragment line whose `{{tN}}` / `{{tests}}` names no
  planned test is dropped), `packTestRowsBlock` (`## [MARKER] <Traceability Matrix>` + the built-in header, T-IDs after
  the plan's own; null when the plan already cites a pack AC or requirements.md defines none), `packChecklistBlock`
  (`- [ ] TOKEN: …`; given requirements.md, so `{{acN}}` resolves), `packSteeringStub`. `packSubst()` resolves `{{ac1}}…` `{{acs}}` `{{t1}}…` `{{tests}}` `{{title}}`
  `{{marker}}` `{{name}}` `{{slug}}` with `RE_TEMPLATE_VAR` (linear).
- **Where the blocks go:** `scaffoldText()` — a built-in scaffold gets ONLY its pack tracks' blocks (`withTrackBlocks(…,
  {only})`; a feature without packs is byte-identical to 1.14); a project template gets every missing block (the 1.14
  rule, packs included; checklist: packs only). createFeature also writes each pack's steering file (built-in tracks'
  steering stays spec_init / add_track's). applyTracks (add_track): design sections, steering, task block — never
  requirements (as the built-in tracks). `scaffoldTestPlan` leaves the pack's ACs out of its "fresh template?" comparison
  and of its generic rows (the pack's own rows plan them). classification.md lists pack signals (i18n `signalTracks()`).
  importSpec (F4 review R8): after writing the imported requirements.md it re-inserts each pack's criteria
  (`insertPackRequirements`), adds the pack rows to the re-planned test plan (`withTrackBlocks(…, {only: packs})`) and
  appends the pack task block (`withPackTasks` — imported tasks, or the kept scaffold with its stale pack block cut out).
- **Gates & readers:** `activeSectionTracks()` (doctor `<name>-sections`, the design approval, design-save check,
  roadmap attention), `statusFeature` `packSections {name: {marker, title, sections}}` + `missingPacks`, `checkPhaseIndex`
  (a `-sections` id is a design check), the brief's and the RTM's track design sections (`["sec", "privacy",
  ...packTracks()]`), import's design blocks, `fitTemplateTasks`, append_tasks' inactive-heading refusal, templates check.
  A pack's task block is found by its MARKER in a tasks.md heading (`trackTaskHeadingIs()` — the built-in tracks keep
  their template headings, cached in `TASK_HEADINGS`). Placeholders: `[MARKER]` is stable (`isPackMarkerBracket()` in
  `scanBrackets`, the exact case-sensitive token — a lower-case `[role]` slot stays a slot beside a ROLE pack — and never
  while the process-wide built-in corpus is built, `BUILTIN_CORPUS_BUILD`); the packs' texts in every language join the
  corpus (`packCorpusSets()` → `projectTemplateHas` brackets / code / tasks — incl. the track's `acPlaceholder`), read
  from their SOURCES (guidance, fragment items / rows, the i18n defaults — never whole rendered blocks) with `{{title}}` /
  `{{marker}}` filled and the feature's `{{name}}` `{{slug}}` `{{acN}}` `{{acs}}` `{{tN}}` `{{tests}}` kept: such a key is a
  linear wildcard (`RE_PACK_WILD_VAR` split → `wildcardMatch`, ≥ 3 literal characters — F4 review R2).
- **Missing packs:** createFeature / applyTracks record `.state.json → packMarkers {name: "[TOKEN]"}` (`packMarkersFor`). A
  saved non-built-in track is a pack name only when `savedPackName()` says so — a valid pack now, or in packMarkers, never a
  `packReservedName` (F4 review R6: any other word — a typo, `security`, `gdpr` — makes the list unreadable → the files
  decide, as in 1.14); such a missing one is kept by `savedTracks()` (normalizeTracks drops it; applyTracks / removeTracks
  re-append `missingPackTracks()`). `detectTracks()` → `noteGhostPacks()` registers EVERY packMarkers entry that is no
  valid pack now — whether or not the feature still lists it (F4 review R1: a pack turned off, then deleted, came back to
  life) — in the per-call `GHOST_MARKERS`; `inactiveMarkerLines` / `inactiveTaskLines` drop those sections like a removed
  track's — no gate, no placeholder — and `trackAcIds` keeps only the lines whose owner IS the asked track (F4 review R5:
  ghost sections joined another track's criteria). Doctor warns `track-pack-missing` (absent vs invalid + its error codes). trace_check
  reads whole files (as for a removed built-in track), so the pack's criteria and tasks still pair up there.
- **`spec_tracks` / `dev-spec tracks`** (`trackPacks()`): list (built-in rows + every pack entry, valid or not), init
  (`initTrackPack` — six files from `msg.trackPacks.init*`, create-only, the `inside()` link refusal of templates init;
  the marker = the name in capitals, `TRACK`-suffixed when reserved, numbered when taken), check (the loader's problems +
  EARS no-modal / vague on each fragment criterion; verdict; CLI exit 1 on an error). `tracks` is a RESERVED slug; a
  `.specs/tracks/` holding a `.state.json` is a pre-1.15 feature (`reg.legacy`, every action refuses `legacyFeature`); the
  PostToolUse hook and the pre-commit check skip `.specs/tracks/` (same exception).
- **Known limits:** a pack's classifier keywords share `KW_RE` / `KW_LITERAL` with the built-in ones (bounded:
  `KW_CACHE_MAX`); a slot or task line holding a variable is a wildcard (`[the {{name}} screens]` also recognises
  `[the checkout screens]`); editing `.specs/tracks/*` does not refresh ROADMAP.md (the save hook skips pack files); a hook
  is a fresh process — it pays one read of the packs (20 packs × 4 language folders ≈ 60 ms); ghost markers are per call and project-wide (a marker of a missing pack drops that heading in any
  feature of the call — correct, since the pack is gone for the whole project); section names are localized per language
  but `sectionState` reports the English name.

## Classifier gotchas (from Conventions & gotchas)
- **Classifier signals are matched as WORDS, never substrings** (`keywordRe`, not `indexOf`).
  `indexOf` fired `claude` inside `.claude-plugin`, `rag` inside `sto·rag·e`, `sla` inside
  `tran·sla·te`, `auth` inside `auth·or` — and a phantom STRONG signal auto-enables a track, which
  then *hides* the negation the classifier computed for it. The regex allows inflections
  (`payment→payments`, `rate-limit→rate-limiting`), plural-only for ≤3-char acronyms (so `rag`+`ing`
  ≠ `raging`), `STEMS` for deliberate prefixes (`idempoten`, `hallucinat`, `summariz`, `alucina`), `VERB_STEMS` (a stem + its
  listed endings only — `encript`, `cifr`, `criptograf`: never "cifra"; the self-match sweep probes them by infinitive),
  and `-based/-powered/…` adjectives (`AI-powered`), while rejecting `-<letter>` compounds
  (`claude-plugin`) and dotted/slashed identifiers. `-<digit>` stays legal (`gpt-4`). **A glued version (review 5, L29):** a
  built-in one-word keyword of 2–5 letters (an acronym: oauth, gpt, tls, llm, saml) or a `VERSIONED_NAMES` product (claude, gemini,
  mistral) takes `VERSION_TAIL` — digits, dot-digits, one letter — before its inflection: "OAuth2", "GPT4", "GPT4o", "TLS1.3",
  "Claude3", "Gemini1.5" were no signal at all; a longer word never does ("Billing10x"), nor a track pack's keyword. When you add a
  keyword, add it to the self-match sweep's expectations if it needs a new suffix class.
- **Negation never vetoes a track**, it annotates it. "the system shall not hallucinate" negates
  `hallucinat` on a feature that is unmistakably `+ai`. So when a track is on *and* has negated
  keywords, `classify` emits a conflict note ("+ai is ON although 'llm' appeared negated") for the
  human who confirms Phase 0 — it must never silently drop a negation it computed. A negation reaches every item of the
  coordinated list it opens (1.21 F2 — "not add feature flags or canary releases", "nem … nem", "ni … ni"), never past
  "and", a contrast word, an unclosed comma or a comma after the closing "or" — and only an EXCLUSION opens one — and a negation excludes only when it certainly governs the keyword (a nominal negator with
  only fillers / modifiers between, an adoption verb, a plan / an intention); anything else keeps the track: "must not lose X or
  Y", "does not show X", a relative clause, a condition, a hazard (1.21 review B1, verify V1 / V5 / R1 / N1 — `negationOf()`) —
  and a negated adoption excludes only for a designing subject (the first person, the system, none): a role's or a plan's is an
  access / entitlement rule ("Guests can't use the checkout", "The free plan does not include webhooks" — 1.21 verify P1,
  `subjectKeeps()`) — see 1.21 F2a above before widening `listLink()`, `GOVERN_ADOPT`, `GOVERN_AUX` or the subject lists
  (`ROLE_SUBJECTS` / `DESIGN_SUBJECTS`: a word in neither keeps the track, unless it is a singular component after a plain
  negation — 1.21 verify P2, `componentAt()`), and prove it with the differential (1.20 / the 1.21
  base / the last release candidate / the change), the verifier's sentence sets and every B / V / R / N / P case in
  04-tracks-builtin.js.
- **Project signal overrides are the team's, never the engine's defaults.** A tuning that holds for everyone goes into
  `SIGNALS` (tracks.js); `.specs/classifier.json` is one project's learned or hand-set layer — never read it without a
  projectDir, never write it outside `writeSignalRecords()` (the roadmap lock, the never-rewrite-a-broken-file rule).
- **Classifier language guess** (`guessLang`): STRONG PT/ES markers (weight 2: `não`, `uma`, `-ção`,
  `ñ`…) and WEAK ones (weight 1: `de`, `por`, `com`…) must beat the English function-word count —
  never add ambiguous words (`do`, `da`, `usa`, `los`, `no`, `.com`): they flipped English text to PT.
  The guess decides how `no` is read — a negator in EN/ES, the contraction *em+o* in PT ("aplicado no
  checkout"; also after a lowercase participle, never after a capitalised name like "Canada"). An
  explicit `lang` overrides the guess for negation too. Without one, every surface — spec_classify / classify, spec_create /
  create (a new feature), spec_import — reads the text in its OWN language, with roadmap.json `meta.lang` only as the
  fallback when the text is inconclusive (`classify(…, {projectDir})` → `configuredLang()` → `guessLang(text, fallback)`;
  never the 'en' default): forcing meta.lang read "no checkout" in a PT summary as an English negation in an EN project,
  and create disagreed with the classify the human confirms. **One language's content words (review 5, L29):** `PT_WORDS` /
  `ES_WORDS` (pagamento, encomenda, desconto, cupom, erro, conta, relatório… · pago, factura, descuento, carrito, cuenta,
  informe…) and `PTES_WORDS` (reembolso, cliente, pedido, campo, alerta, filtro, página… — both languages, like the shared
  infinitives) are STRONG markers ONLY in a text with no English function word: "Erro no pagamento", "Cupom de desconto no
  checkout", "Alertas no PagerDuty" read English in an English project and their "no" (em + o) switched +tdd / +obs off. None
  is an English word; "Show the pagamento status" (an English function word) is unchanged. One matched span counts once per track. Prose pairs like
  `login/signup` are split before matching; path-like tokens (`src/rag.ts`) are not. PT/ES plurals
  (`-ções`, `-ciones`, first word of a phrase) are generated by `pluralize()`.
