# Tracks and the Phase 0 classifier

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
The track registries, the built-in tracks (+dist, +api, +ui, +obs…), track packs and the classifier's rules.

## The track model
`core` is always on. `+tdd`, `+saas`, `+ai`, `+sec`, `+privacy` (the last two since 1.14), `+dist` (1.17), `+api` / `+ui` / `+obs` (1.19) are independent and
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
  negative conjunction after an item whose clause a negator opens negates that item too (`clauseNegated()` — "Não vamos usar
  feature flags nem lançamento canário": the negator is three words back). Linear: each gap is read at most twice.
  **Measured (1.21 F2):** the verifier's 146 texts: +api 100% / 96.3% → 100% / 100%, +ui 100% / 74.2% → 100% / 100%, +obs
  91.2% / 100% → 100% / 100%; the reviewer's 205: +ui recall 87.0% → 88.9% (a banner), the rest unchanged; the 1.17 +dist
  corpus unchanged (96.8% / 100%). On 37,881 inputs (the logged classify inputs of both suites — 1.19, the 1.19 fix, 1.20 —,
  the corpora, every string literal of the test files and an 18-frame keyword sweep) the older tracks' decisions changed ONLY
  where a coordinated list or a negative conjunction now reaches a keyword (the sweep's "not add retries or X" / "sem … nem X"
  / "sin … ni X" frames, and the logged "sin datos personales ni autenticación": +tdd off); "No X, just …" and "Without X,
  the …" frames change nothing. `1.21 F2a` in mcp/tests/04-tracks-builtin.js embeds the cases (+ a 40-text precision /
  recall assertion, ≥ 95% per track).
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
  section. The strict synonyms keep the unmarked fallback anywhere (hand-written and marker-less PT/ES designs).
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
  drops a removed track's task section). `core` can't be removed; a bugfix keeps +tdd.

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
  (`claude-plugin`) and dotted/slashed identifiers. `-<digit>` stays legal (`gpt-4`). When you add a
  keyword, add it to the self-match sweep's expectations if it needs a new suffix class.
- **Negation never vetoes a track**, it annotates it. "the system shall not hallucinate" negates
  `hallucinat` on a feature that is unmistakably `+ai`. So when a track is on *and* has negated
  keywords, `classify` emits a conflict note ("+ai is ON although 'llm' appeared negated") for the
  human who confirms Phase 0 — it must never silently drop a negation it computed. A negation reaches every item of the
  coordinated list it opens (1.21 F2 — "not add feature flags or canary releases", "nem … nem", "ni … ni"), never past
  "and", a contrast word or an unclosed comma — see 1.21 F2a above before widening `listLink()`.
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
  and create disagreed with the classify the human confirms. One matched span counts once per track. Prose pairs like
  `login/signup` are split before matching; path-like tokens (`src/rag.ts`) are not. PT/ES plurals
  (`-ções`, `-ciones`, first word of a phrase) are generated by `pluralize()`.
