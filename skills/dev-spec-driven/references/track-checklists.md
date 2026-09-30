# Track checklists — what each track adds, phase by phase

Read the rows of the feature's ACTIVE tracks at each phase. The engine scaffolds every mandatory design section with a
`> **TODO**` sentinel and gates on it (doctor `<track>-sections`, the design approval); this file says what to put in.
A project track pack (`.specs/tracks/<name>/`) brings its own criteria, sections and tasks: `references/project-tracks.md`.

## Phase 1 — track-specific acceptance criteria to always consider

- **+saas:** tenant isolation (`WHEN a user from tenant A requests data, THE SYSTEM SHALL NOT
  return any record whose tenant_id != A`), rate limits, abuse/fair-use, auth boundary per role,
  audit trail, latency target.
- **+ai:** output-quality target (% on golden set), latency target (time-to-first-token), cost
  ceiling ($/request), refusal behavior, hallucination boundary ("say I don't know"), prompt-
  injection resistance, fallback model, per-call audit logging.
- **+sec:** unauthenticated → 401 and no data, unauthorized → 403 + an audit event, no secret / token / stack
  trace in any response or log (scaffolded as `US-1.AC-10..12`), plus the abuse cases the threat model finds.
- **+privacy:** the subject's data exported machine-readably, erased in every store, deleted or anonymized when its
  retention ends (`US-1.AC-13..15`), and consent withdrawal when consent is the lawful basis.
- **+dist:** a publish that fails after the commit is still delivered (outbox), a duplicate message has one effect,
  concurrent updates are never lost, a dependency down degrades instead of blocking (`US-1.AC-16..19`).
- **+api:** a malformed request answered 400 with a problem+json body naming the field, an Idempotency-Key replay with
  one effect, a stale If-Match refused with 412, a breaking change only in a new version (`US-1.AC-20..23`).
- **+ui:** keyboard-only operation with a visible focus, a failed form that keeps its values and names each error, an
  empty state with the next action, a failed load with Retry (`US-1.AC-24..27`).
- **+obs:** telemetry with a correlation ID and no personal data, a burn-rate page with the runbook, a canary that rolls
  back on its error rate, not-ready-but-live while a dependency is down (`US-1.AC-28..31`).
- **+data:** a row that breaks a data-quality rule quarantined and never loaded, a re-run / backfill of a partition with
  the same result as one run, a freshness alert to the owner, a breaking schema change rejected before it reaches the
  consumers (`US-1.AC-32..35`), plus the late-data rule (how late still counts).
- **+tdd:** make sure every AC is concrete enough to become a failing test — if it can't, rewrite it.

## Phase 2 — the mandatory design sections

**+tdd adds:** Testability Notes (seams, determinism, side effects to isolate, test-data strategy).

**+saas adds 5 mandatory sections** — Performance Budget (P50/P95/P99, max query time, memory, throughput) ·
Scale Design (users and data over time, hot paths, caching, queues, indexes, sharding) · Multi-tenancy Model
(isolation, tenant_id enforcement, noisy neighbours, export/delete) · Observability (named metrics, structured logs,
traces, alerts → thresholds → who, dashboards) · Cost Envelope ($/1000 users/month, cost-critical paths, cost
metric + alert). See `references/scale-design-template.md` and `references/saas-patterns.md`.

**+ai adds 10 mandatory sections** — Model Strategy · Prompt Architecture · Token Economics · Latency Budget · Eval
Strategy · Safety & Abuse · Fallback & Degradation · Observability for AI · Model Lifecycle · Multi-modality. See
`references/mandatory-ai-design-sections.md`, `references/prompt-engineering-patterns.md`,
`references/model-provider-guide.md`, `references/ai-cost-modeling.md`, `references/ai-safety-patterns.md`.

**+sec adds 5 mandatory `[SEC]` sections** — Threat Model (STRIDE per trust boundary) · Security Requirements (ASVS
level) · Authentication & Authorization · Secrets & Key Management · Security Testing. See `references/security-track.md`.

**+privacy adds 6 mandatory `[PRIVACY]` sections** — Personal Data Inventory · Lawful Basis & Purpose · Retention &
Deletion · Data Subject Rights · Processors & International Transfers · DPIA. See `references/privacy-track.md` (not
legal advice: the DPO or counsel decides, the spec records it).

**+dist adds 5 mandatory `[DIST]` sections** — Consistency Model · Cross-system Writes (every dual write → outbox /
inbox / saga, or an accepted risk) · Delivery & Idempotency · Concurrency · Failure Modes (CAP / PACELC). See
`references/distributed-data-patterns.md`.

**+api adds 5 mandatory `[API]` sections** — API Contract · Versioning & Compatibility · Error Model (RFC 9457
problem+json) · Pagination, Idempotency & Concurrency · Rate Limits & Quotas. See `references/api-design-patterns.md`.

**+ui adds 5 mandatory `[UI]` sections** — Design System Usage · UI States (a state matrix per view) · Accessibility
(WCAG 2.2 AA) · Responsiveness & i18n · UI Performance Budget (Core Web Vitals). See `references/ui-design-patterns.md`.

**+obs adds 5 mandatory `[OBS]` sections** — SLIs & SLOs · Telemetry · Alerting & Runbooks · Rollout & Rollback · Health
& Capacity. See `references/observability-patterns.md`.

**+data adds 5 mandatory `[DATA]` sections** — Data Contracts & Schema Evolution (producers, consumers, schema, compatibility
rule) · Data Quality (the checks, where they run, what a failure does) · Pipeline Idempotency & Backfills (the unit of work,
re-runs, late-arriving data, the backfill procedure) · Lineage & Ownership (sources → consumers, owners, freshness SLAs) ·
Retention & Cost (retention per layer — personal data per `references/privacy-track.md` —, partitioning, query cost). See
`references/data-pipeline-patterns.md`.

## Phase 3 — test plan and eval plan additions

- **+tdd test plan:** ≥ 1 test per AC, a negative test for every IF…THEN, boundary tests; each with a stable ID
  (`T-01`), its AC IDs, a layer (unit / integration / E2E, following the pyramid) and a **Kind** — `example` (one
  concrete case — event-driven WHEN / IF…THEN) or `property` (an invariant over generated inputs — ubiquitous, WHILE,
  "never / for every" rules like tenant isolation). The Coverage Check shows every AC in ≥ 1 test.
- **+saas:** tenant-isolation, rate-limit, idempotency, authorization-matrix and audit-log tests. **+sec:** one
  abuse-case test per threat. **+privacy:** export / erasure / retention tests. **+dist:** failure injection. **+api:**
  contract tests and the breaking-change diff. **+ui:** an accessibility check + visual regression of the states.
  **+obs:** an alert in a staged failure, a rollback drill, fault injection. **+data:** data-quality checks on fixture
  batches, an idempotent re-run / backfill of a partition, the freshness alert, the schema-change compatibility check.
  `references/test-patterns.md`, `references/data-pipeline-patterns.md`.
- **+ai eval plan:** three sets — **golden** (50–200 representative inputs with expected quality), **adversarial**
  (injections, jailbreaks, out-of-scope, unsafe-elicitation, degenerate inputs — should refuse/degrade), **regression**
  (every fixed production bug, grows forever). Grading per set (exact match / schema / LLM-as-judge with rubric /
  human); explicit ship thresholds (e.g. golden ≥ 85%, adversarial safety 100%, regression 100%); a **baseline** from a
  minimal v1 prompt before implementing. `references/eval-suite-patterns.md`.
- **+ai Phase 4:** deterministic tests (validation, schema, rate limiting, logging, fallback, cost circuit breaker) AND
  the eval harness (loads sets → runs through prompt + model → grades → scores per set → fails below threshold); the
  bundled local harness runs with `/eval` (the user's own API key; `--dry-run` offline). Record the baseline; commit
  `test(feature): eval harness + baseline (golden 73%, adversarial 96%)`.

## Phase 5 — task markers per track

- +tdd: `_Makes green: T-01, T-02_`
- +saas: `_Emits metrics: req_duration_ms{feature=X}_` + an observability task + (hot path) a load-test task
- +ai: `_Affects evals: golden (maintain baseline)_` + a separate task per prompt change + a cost-monitoring task
- brownfield / integration: `_Implements: path/to/file_` ties a task to a real source file (checked by `trace`)

## Phase 6 — track-gated "done" checks before a feature is finished

- **+saas:** the hot-path load test from `load-test.md` meets the P50/P95/P99 budget (missed → root-cause and fix,
  never silently accept it — `references/load-testing-patterns.md`); observability validated — metrics emitting,
  logs appearing, alerts configured, dashboard exists. Code ≠ proven.
- **+ai:** cost validation (real token usage within ~20% of the projection) and safety validation (full adversarial
  set, 100% on safety-critical categories, human spot-check of ~20 outputs).
- **+sec:** security scans clean, the threat model re-checked against what was built.
- **+privacy:** data subject rights verified end to end on the real stores, retention scheduled.
- **+dist:** failure-injection tests green, no dual write left.
- **+api:** contract tests and the breaking-change diff green.
- **+ui:** the accessibility check, a keyboard / screen-reader pass and the performance budget.
- **+obs:** an alert fired in a staged failure and a rollback drill.
- **+data:** the data-quality checks, a partition re-run and a backfill rehearsal on real-sized data — the same rows as one run.

`spec_finish` lists the same items as `checks` — only a fresh run or a human can confirm them.
