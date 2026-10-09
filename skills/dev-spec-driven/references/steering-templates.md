# Steering File Templates

Steering files are short (20–60 lines each) and sit at `.specs/steering/`. They encode the
context every spec needs — product vision, tech stack, conventions, and (when the relevant
tracks are active) scale targets, observability standards, cost budget, AI strategy, testing,
security, privacy and data-consistency standards — so each feature spec doesn't relitigate the basics. The last
section covers **project templates** (`.specs/templates/`): a team's own scaffolds for new features and
steering files.

## Which files to create — driven by the active tracks

`dev-spec-driven` composes tracks per feature. The steering set mirrors that:

| File | Track that requires it | Always? |
|---|---|---|
| `constitution.md` | `core` | ✅ always |
| `product.md` | `core` | ✅ always |
| `tech.md` | `core` | ✅ always |
| `structure.md` | `core` | ✅ always |
| `testing-standards.md` | `+tdd` | when any feature uses the TDD track |
| `scale.md` | `+saas` | when any feature uses the SaaS track |
| `observability.md` | `+saas`, `+obs` (also useful for `+ai`) | when the SaaS, operability or AI track is used |
| `cost.md` | `+saas` | when the SaaS track is used |
| `ai-strategy.md` | `+ai` | when the AI track is used |
| `security.md` | `+sec` | when the security track is used |
| `privacy.md` | `+privacy` | when the privacy track is used |
| `distributed.md` | `+dist` | when the distributed systems & data consistency track is used |
| `api.md` | `+api` | when the API contract track is used |
| `ui.md` | `+ui` | when the UI track is used |
| `data.md` | `+data` | when the data pipeline track is used |
| `glossary.md` | any (optional) | when the product has domain terms people use loosely — `steering_scaffold` only, `spec_init` never creates it |

At project start, create at least the four `core` files. Add the others the first time a
feature pulls in that track. Fill them in once, revisit once a quarter. `spec_doctor`'s `steering` check warns,
by name, about every steering file still holding template placeholders — a stub steers nothing.

**Amending steering (1.16).** A requirements or design approval records a fingerprint of the steering that governed it —
`constitution.md`, the active tracks' files (a track pack's too), every `inclusion: always` file and every `fileMatch` file
(with its patterns — it counts for a feature once that feature's current `_Implements:_` paths match it, since requirements
and design are approved before tasks.md names any file). Edit one of them later and `spec_doctor` warns
`steering-changed-since-approval` on every feature approved under the older version, `spec_next_action` adds a re-review
hint (never a block), and `spec_impact {phase: "steering"}` (CLI `dev-spec impact --phase steering`) lists them all.
Re-review each against the amended rule and re-approve — the new approval records the current steering. Approvals made
before 1.16 recorded nothing and are never flagged. See `references/change-management.md` §14.

## Scoped steering — front matter and custom files

Not every rule applies everywhere. A steering file may start with Kiro-compatible front matter that decides
when `spec_task_brief` puts it in front of an implementer:

```markdown
---
inclusion: fileMatch
fileMatchPattern: "src/api/**"
---

# Api Conventions

## Rules
- Every handler validates its body with the shared zod schema before touching the service layer.
```

| `inclusion` | The brief… |
|---|---|
| `always` | lists it for every task (also the default when the front matter has no `inclusion`) |
| `fileMatch` | lists it — and quotes its body, front matter stripped, when it holds real content and fits the budget — only for tasks whose `_Implements:_` paths match `fileMatchPattern` |
| `manual` | never includes it automatically; lists it as available on request (an unknown mode, Kiro's `auto` included, is treated as `manual`) |

`fileMatchPattern` is a glob (`**` any depth, `*` and `?` within one path segment, `{a,b}` alternatives) or a
list: `["src/api/**", "src/routes/**"]` (YAML `- item` lines work too). A folder in `_Implements:_` also
matches `folder/**`. The default steering files (constitution, tech, structure and the active tracks' files)
count as `always` while they have no front matter — the pre-1.13 behaviour; any other file without front
matter stays out of briefs.

**Custom files.** `steering_scaffold {file: "api-conventions.md"}` (CLI `dev-spec steering api-conventions.md`)
creates a stub for any name matching `^[a-z0-9][a-z0-9-]{0,62}\.md$` — lowercase, no folders, not a Windows device
name (`nul.md`, `com1.md`) — with a `fileMatch` front matter and guidance in a comment. Replace the example pattern
and the bracketed lines. Good candidates: API conventions, UI component rules, migration rules, a module's
invariants. Keep each one short; it is quoted into briefs.

**From Kiro or Cursor (1.25).** `spec_import {tool: "kiro-steering"}` copies `.kiro/steering/*.md` here with their
front matter (it is this format); `{tool: "cursor-rules"}` maps `.cursor/rules/*.mdc` — `alwaysApply: true` → `always`,
`globs` → `fileMatch` (`*.tsx` → `**/*.tsx`), else `manual` — and `.cursorrules` → `cursorrules.md` (`always`). An existing
steering file is never overwritten (skipped, reported); `dryRun: true` previews it all. Details:
`references/brownfield.md` → Steering from Kiro and Cursor.

---

## `constitution.md` (core)

The few non-negotiable principles every feature must obey — kept short, concrete, and testable.
Each design.md carries a **Constitution Check** section (`spec_doctor` checks that it is there); whether
the design honours every principle is judged at the gate by the human and the `spec-critic` agent
(`/spec-doctor --deep`), and `/prReview` checks the code — a violation is sent back, not shipped.
Anything that *must* break a principle goes in the design's **Complexity Tracking** table with a
justification, not into the code unannounced.

```markdown
# Constitution

Non-negotiable principles every feature must obey. Keep these few, concrete, and testable.
Each design's Constitution Check answers to them; a design that violates a principle goes back for revision.

## Principles
1. [e.g., Every write is idempotent or explicitly justified.]
2. [e.g., No PII in logs; user IDs are pseudonymized.]
3. [e.g., No breaking API change without a versioned migration path.]
4. [e.g., Errors fail closed (deny) on the security path.]
5. [e.g., Search before you write: extend an existing module before adding a new one.]

## Constraints
- [Hard tech/regulatory constraints that bound all designs.]

## Decision Rules
- [How to break ties — e.g., 'prefer boring/proven over clever'.]
```

Keep it to a handful of principles. A constitution nobody can recite isn't enforced. Each principle
should be phrased so a reviewer can answer "does this design comply? yes/no" without debate.

---

## `product.md` (core)

```markdown
# Product

## Vision
[One sentence: what is this product and who is it for?]
Example: A QR-code event photo platform that hosts use to collect and showcase all
photos and videos taken by guests at weddings, corporate events, and celebrations,
without requiring guests to install an app.

## Target Users
- **Primary:** [who uses this daily?]
- **Secondary:** [who else touches it?]

## Success Metrics
What does success look like in 6 months? Be specific.
Example:
- 500 paying hosts
- 100K uploaded media items per month
- < 5% support ticket rate per event
- NPS > 50 for hosts

## Non-goals
What this product is explicitly NOT trying to be.
Example:
- Not a photo editor (hosts export to real tools if they want to edit)
- Not a social network (guests don't create accounts or friend each other)

## Business Model
How does this make money?
Example: One-time lifetime license per event (three tiers: €49 / €99 / €149), plus a
recurring enterprise plan for venues (€49/mo).
```

---

## `tech.md` (core)

```markdown
# Tech

## Stack
- **Frontend:** [e.g., Next.js 15, React 19, TypeScript, Tailwind]
- **Backend:** [e.g., Next.js API routes + worker service]
- **Database:** [e.g., Postgres 16 managed]
- **Cache:** [e.g., Redis managed]
- **Object storage:** [e.g., Cloudflare R2]
- **Queue:** [e.g., BullMQ on Redis]
- **Auth:** [pick one]
- **Payments:** [e.g., Stripe]
- **Email:** [e.g., Resend]
- **Observability:** [e.g., OpenTelemetry + Grafana Cloud]

## Infrastructure
- **Hosting:** [where frontend/API/workers run]
- **Region:** [primary + DR if any]
- **DNS + CDN:** [provider]

## Conventions
- **Language:** [e.g., TypeScript strict, no `any` without justification]
- **Formatting:** [Prettier / ESLint / Biome]
- **Test runner:** [Vitest unit/integration, Playwright E2E, k6 load]
- **Migrations:** [tool, naming, reversibility policy]
- **Commit format:** Conventional commits (see `structure.md`)

## Constraints
- **Minimum runtime version:** [e.g., Node 22 LTS]
- **Browser support:** [matrix]
- **Accessibility:** [e.g., WCAG 2.2 AA]
- **Regulatory:** [e.g., EU GDPR, data residency]
```

---

## `structure.md` (core)

```markdown
# Project Structure

## Layout
\`\`\`
src/
├── app/                      # App router (pages + routes)
├── components/               # Shared UI components
├── features/                 # Feature modules (self-contained)
│   └── <feature>/
│       ├── api/              # Route handlers for this feature
│       ├── components/       # Feature-specific components
│       ├── lib/              # Business logic (pure functions)
│       ├── db/               # Queries for this feature
│       └── __tests__/        # Unit + integration tests
├── lib/                      # Truly shared utilities (auth, db client, logger)
└── workers/                  # Background job handlers
\`\`\`

## Module Boundaries
- **Public surface:** each feature exposes one entry point (`features/<feature>/index.ts`); its internals are not
  imported from outside
- **Dependency direction:** `features/*` import `lib/*` and `components/*` — never each other; `lib/*` imports no
  feature; no cycles (checked by dependency-cruiser as a project check)

## Shared Code
- **Where it lives:** `src/lib/` (http client, logger, money, dates, validation), `src/components/` (the design
  system) — search there before adding a helper or a component
- **Promotion:** code moves into `lib/` on its second or third real use, feature-agnostic, with its own tests

## Naming
- **Files:** kebab-case (`user-settings.tsx`)
- **Components:** PascalCase export, file in kebab-case
- **API routes:** REST-style, plural nouns (`/events`, `/uploads`)
- **DB tables:** snake_case, plural (`events`, `media`, `user_sessions`)
- **Metrics:** snake_case with unit suffix (`upload_duration_seconds`)

## Commits
Format: `type(scope): short description` (max 72 chars)
Types: feat | fix | refactor | test | docs | chore | style | perf
Body: why, not what. Reference spec and tests.

## Branches & Reviews
- `main` — production; `feature/<feature-name>` per feature, short-lived, squash-merged
- Reviews required for all merges to main; must check spec compliance and active-track sections
```

---

## `testing-standards.md` (+tdd)

```markdown
# Testing Standards

## Runner & Tooling
- **Unit/Integration:** [e.g., Vitest / Jest / pytest / go test]
- **E2E:** [e.g., Playwright / Cypress]
- **Mocking:** [e.g., vi.mock for modules, MSW for HTTP, in-memory DB for integration]
- **Load (if SaaS track):** [e.g., k6 / Artillery]

## Coverage Policy
- **Default target:** [e.g., 90% lines]
- **Critical paths (auth, billing, data integrity):** 100% branch coverage
- Coverage is a floor, not a goal — a green bar with bad assertions is worse than honest red.

## Conventions
- **Naming:** `describe(unit) > it(should <behaviour> when <condition>)`
- **Structure:** Arrange–Act–Assert, one observable behaviour per test
- **Determinism:** clocks, UUIDs, randomness injected behind interfaces — never `Date.now()` raw
- **Fixtures/factories:** [where they live, builder pattern vs static fixtures]

## TDD Discipline
- No implementation code before a failing test that exercises the real path.
- "Failing for the right reason" = assertion failure / NotImplementedError, NOT import/syntax error.
- Test commits land before implementation commits (visible in git history).
```

---

## `scale.md` (+saas)

```markdown
# Scale Targets

## Load Targets
| Horizon | Concurrent users | DAU | MAU | Peak RPS | Data volume |
|---|---|---|---|---|---|
| Launch | 100 | 500 | 2K | 50 | 10 GB |
| 6 months | 500 | 5K | 20K | 300 | 500 GB |
| 2 years | 5000 | 50K | 200K | 3000 | 10 TB |

Re-validate quarterly. Real traffic shape often differs from forecast.

## SLA Targets
| Endpoint class | P95 | P99 | Uptime |
|---|---|---|---|
| Critical user journey | < 500ms | < 1500ms | 99.9% |
| Standard API | < 1000ms | < 3000ms | 99.9% |
| Admin/backoffice | < 3000ms | < 10000ms | 99.5% |
| Background jobs | completion SLA per job type | — | 99.5% |

## Critical User Journeys
Journeys where a regression is visible to users and threatens business outcomes:
1. Signup → first value (< 2 min end-to-end)
2. Core action → result (define per product)
3. Dashboard load (< 2s P95)
4. Checkout → active subscription (< 60s)

## Capacity Buffers
- App tier: 3× expected peak  ·  DB: 2×  ·  Cache: 5×  ·  Workers: queue wait < 30s at peak

## Escalation Thresholds (revisit this file when true)
- Traffic 2× the "6 months" number  ·  Data > 50% of "2 years"  ·  > 3 SLA violations/month
```

---

## `observability.md` (+saas, +obs, also useful for +ai)

```markdown
# Observability Standards

## Logging
Structured JSON, one line per event. Required fields: `ts`, `level`, `service`, `trace_id`,
`span_id`, `tenant_id` (nullable), `user_id` (nullable), `msg`, `event` (snake_case code).
Feature fields namespaced (`upload.bytes`). Levels: debug(off in prod)/info/warn/error.
PII: never log secrets/tokens/PANs; pseudonymize user IDs; retention 30d hot / 1y cold.

## Metrics
Prometheus-style, snake_case + unit suffix. Counters `_total`, histograms `_seconds`/`_bytes`,
gauges plain. Labels OK: `service`, `endpoint` (route pattern), `status_class`, `method`.
NEVER label by raw URL, user IDs, or random request IDs (cardinality explosion).
Per feature, emit: request count, request duration histogram, error count, one business counter.

## Traces
OpenTelemetry, W3C context. Auto-instrument HTTP server/client, DB, cache, queue. Manual spans
for business sections > 50ms. Sampling 10% in prod; always sample errors.

## Alerts (every alert links to a runbook — no runbook, no alert)
- P0 page now: user-facing down/degraded > 2 min
- P1 page ≤15 min: error rate > 1% / P95 > 2× budget / queue depth > 10× — for 5 min
- P2 slack: anomaly worth investigating (DLQ depth, etc.)
- P3 email digest: trend to watch

## Dashboards
Every feature: request rate, error rate, P50/P95/P99 latency, saturation of its main resource.

## SLOs & Error Budgets
- Per critical journey: the SLI, the SLO target and window: [checkout: 99.5% of valid requests < 800 ms, 28 days] · the error-budget policy (what stops when it is spent): [feature launches pause]
- Burn-rate alerts: the fast ones page (e.g. 14.4× over 1 h, 6× over 6 h), the slow one (e.g. 1× over 3 days) opens a ticket.

## Rollout & Rollback
- Feature flags: an owner and a removal date each · canary / progressive steps and the metrics that gate them: [1% → 10% → 50% → 100%, gated on the SLO] · rollback criteria and target time: [error rate > baseline + 1 pt → roll back in < 5 min]

## Health & Capacity
- Liveness checks the process only, readiness its dependencies · capacity signals (saturation, queue depth, pool usage) with thresholds: [pool usage > 80% for 10 min]
```

The per-feature SLOs, alerts, flags and rollout steps belong in the feature's `[OBS]` design sections; the reasoning (SLIs, burn
rates, RED / USE, structured logs, tracing, runbooks, progressive delivery, operability tests): `references/observability-patterns.md`.

---

## `cost.md` (+saas)

```markdown
# Cost Budget

## Infrastructure Budget
Target: **< $XX/month** average during year 1.
| Service | Monthly budget | Scaling trigger |
|---|---|---|
| Hosting | $100 | per-user = $0.05 |
| Postgres | $50 | per-user = $0.025 |
| Cache | $30 | — |
| Object storage | $50 | per-GB-stored |
| CDN egress | $100 | per-GB-served |
| Email | $20 | per-email |
| Observability | $50 | — |

## Cost Per User Target
Target: **< $0.50 per MAU** in total infra cost. If exceeded, stop and optimize — don't grow
past a losing margin.

## Cost Alerts
- Daily cost > $100 → slack  ·  > $200 → page (abuse/runaway)
- Single tenant > $20/day variable → review  ·  CDN egress > $50/day → review

## Per-Feature Cost Review
Every `design.md` Cost Envelope estimates $/1000 users/month and flags cost-critical paths.
Features projecting > $0.10/user/month additional cost need explicit approval before shipping.
```

---

## `ai-strategy.md` (+ai)

```markdown
# AI Strategy

## Model Roster
| Role | Model (pinned ID) | Why |
|---|---|---|
| Primary | [e.g., claude-opus-5] | [capability/quality reason] |
| Fallback / cheap path | [e.g., claude-sonnet-5] | [degradation, cost, latency] |
| Judge / grader | [e.g., a strong model] | eval grading (kept separate from generation) |

## Provider & Data Posture
- **Provider(s):** [Anthropic / OpenAI / Google / self-hosted]
- **DPA status:** [signed? data residency? zero-retention endpoint?]
- **Does user PII reach the model?** [yes/no — if yes, redaction strategy]

## Prompt Discipline
- Prompts live in `.specs/<feature>/prompts/vN.md` — versioned files, never inline strings.
- No prompt change ships without an eval re-run (golden + adversarial + regression).

## Cost Envelope (AI-specific)
- **Target $/user action:** [e.g., $0.02]  ·  **Hard alert at:** [e.g., daily cost 2× baseline]
- Token budget is a design constraint, not an afterthought.

## Safety Posture
- Prompt-injection defense: [delimiters / system priority / input sanitization / output validation]
- Content moderation: [pre-check inputs? post-check outputs? which classifier?]
- Refusal policy: [domains the product must refuse — legal/medical/financial/etc.]

## Eval Bar (ship criteria, applies to every AI feature)
- Golden set: ≥ [85]% "good or excellent"
- Adversarial safety: 100% refused (zero tolerance)
- Regression set: 100% maintained

## Lifecycle
- **Pin policy:** [pin an exact model ID vs track a floating alias — reproducibility vs auto-improvement]
- **Deprecation watch:** [how you learn a model is being retired]
- **Migration:** eval-gated only — run current eval set on the new model, compare, then switch.
```

---

## `security.md` (+sec)

```markdown
# Security Standards

## Assurance Level
- Target OWASP ASVS level: [L1 | L2 | L3] — why: [e.g. L2: personal data and payments]

## Threat Modeling
- Method: STRIDE per component and trust boundary, reviewed at every design change.
- Where threat models live: each +sec feature's design.md → Threat Model.

## Authentication & Authorization
- Identity provider / session model: [e.g. OIDC via the company IdP; 30 min idle session]
- Authorization model (RBAC / ABAC / ownership checks), deny by default: [roles and who may do what]

## Secrets & Cryptography
- Secret store: [e.g. Vault / cloud secrets manager] — never in code, in committed config, in logs or in tickets.
- Encryption at rest / in transit (TLS version, key rotation): [TLS 1.2+, keys rotated every 90 days]

## Secure Coding Rules
- Validate input at trust boundaries; encode output; parameterized queries only.
- No secrets, tokens or stack traces in responses or logs.

## Security Testing (local)
- SAST: [Semgrep] · dependency audit: [npm audit / pip-audit] · secret scan: [gitleaks] · DAST (exposed services): [ZAP baseline]
- Every material threat has an abuse-case test.

## Vulnerability Handling
- Fix deadlines per severity (critical / high / medium): [48 h / 7 d / 30 d] · who triages: [owner]
```

How to fill each item: `references/security-track.md`.

---

## `privacy.md` (+privacy)

```markdown
# Privacy Standards (GDPR)

## Roles
- Controller: [legal entity] · DPO / privacy contact: [name, email] · supervisory authority: [e.g. CNPD]

## Principles (GDPR Art. 5)
- Lawfulness, fairness and transparency · purpose limitation · data minimisation · accuracy · storage limitation · integrity and confidentiality · accountability.

## Records of Processing (Art. 30)
- Where the record of processing activities lives: [link]

## Lawful Bases in Use (Art. 6)
- [processing activity → lawful basis, e.g. account management → contract; newsletter → consent]

## Retention Schedule
| Data category | Retention period | Deletion method |
|---|---|---|
| [account data] | [account lifetime + 30 days] | [hard delete + backups expire in 35 days] |

## Data Subject Requests
- Channel · identity verification · one-month deadline (Art. 12(3)) · owner: [team]

## Processors & Transfers
- Approved processors (Art. 28 contracts): [list] · transfers outside the EEA and their safeguard: [SCCs / adequacy]

## Privacy by Design (Art. 25)
- Defaults: collect the minimum, pseudonymize where possible, no personal data in logs.

## Breach Response
- Notify the supervisory authority within 72 hours (Art. 33) · runbook: [link]
```

How to fill each item (not legal advice — the DPO or counsel decides): `references/privacy-track.md`.

---

## `distributed.md` (+dist)

```markdown
# Distributed Systems & Data Consistency Standards

## Delivery Guarantee
- Default: at-least-once — every consumer is idempotent. Exactly-once is an effect of idempotency, never a broker promise.
- Ordering: per key (partition / message group) only where a feature says so: [e.g. per order id]

## Cross-system Writes
- A write that touches more than one system (DB + broker, DB + cache, DB + external API) goes through a transactional outbox (or CDC) — never "commit, then publish".
- Business transactions across services: a saga with one compensation per step; orchestration or choreography: [orchestration for 4+ steps]

## Idempotency
- Idempotency key source (client header / message ID / natural key): [Idempotency-Key header, event id] · where processed keys live (inbox table / unique constraint) and for how long: [processed_messages, 7 days]

## Retry Policy (defaults)
- Exponential backoff with jitter · max attempts: [5] · per-call timeout: [from the dependency's P99, e.g. 2 s]
- Never retried: a non-idempotent call without a key, a validation error (a 4xx — but 408 and 429 are retriable, honouring Retry-After) · poison messages → DLQ after [5] attempts, with an alert.

## Locking Policy
- Default: optimistic locking (a version column); pessimistic (SELECT … FOR UPDATE) only for short, hot sections · lock timeout: [2 s]

## Consistency Defaults
- Default isolation level: [read committed] · where eventual consistency is accepted and the maximum staleness: [search, analytics: 30 s] · read-your-writes for the user who wrote.

## Observability
- Outbox lag, consumer lag, DLQ depth and retry counts are metrics with alerts: [thresholds]
```

The patterns behind each rule (outbox, inbox, sagas, isolation levels, locking, CAP / PACELC):
`references/distributed-data-patterns.md`.

---

## `api.md` (+api)

```markdown
# API Standards

## Style & Contract
- Style: [REST] · the contract lives in: [openapi.yaml at the repo root] — written first, reviewed before the handlers.
- Naming: plural nouns for collections · [snake_case] fields · ISO 8601 UTC timestamps · IDs as strings.

## Versioning & Compatibility
- Strategy: [URL /v1] · only additive changes within a version · a breaking change ships as a new version.
- Deprecation: the Deprecation and Sunset headers, at least [6 months] of notice, a changelog entry, usage tracked per client.

## Errors
- application/problem+json (RFC 9457): type, title, status, detail, instance + a stable `code`; a validation error lists each field. No stack trace in a response.

## Pagination, Idempotency & Concurrency
- Cursor pagination (an opaque cursor, at most [100] items per page) · an Idempotency-Key on every non-idempotent create, kept for [24 h] · ETag / If-Match on updates (412 on a stale version).

## Rate Limits
- Per [API key]: [600] requests per [minute] · 429 with Retry-After and the RateLimit headers.

## Checks (local)
- Contract tests: [npm run test:contract] · breaking-change diff against the published contract: [npm run api:diff].
```

Per-feature decisions (the resources, the error codes, the page size of one endpoint) belong in the feature's `[API]`
design sections, not here. The reasoning behind each rule (what counts as breaking, the deprecation lifecycle,
problem details, cursor pagination, Idempotency-Key, ETag / If-Match): `references/api-design-patterns.md`.

---

## `ui.md` (+ui)

```markdown
# UI Standards

## Design System
- Components: [the component library, its Storybook URL] · tokens: [colour, spacing, type — in tokens.json] · a new component enters the system first (documented, reviewed), never as a one-off.

## States
- Every view designs: loading · empty · error (with Retry) · partial · offline · permission denied · success.
- Forms: inline errors + a summary, values kept on an error, the submit button never the only feedback.

## Accessibility
- Target: WCAG 2.2 AA · keyboard operable, visible focus · every control named · contrast 4.5:1 (text) / 3:1 (UI) · targets ≥ 24×24 px · prefers-reduced-motion honoured.
- Checks: [npm run test:a11y — axe] on every local run · a manual keyboard + screen-reader pass ([NVDA, VoiceOver]) per feature.

## Responsiveness & i18n
- Breakpoints: [360 / 768 / 1280 px] · text expansion +30–40 % · RTL: [no] · dates, numbers and currency through the locale.

## Performance Budget
- Core Web Vitals (p75): LCP ≤ 2.5 s · INP ≤ 200 ms · CLS ≤ 0.1 · JS per route ≤ [170 KB gz] · measured by: [Lighthouse locally, RUM in production].
```

Per-feature decisions (the state matrix of one view, a new component, a view's own budget) belong in the feature's `[UI]`
design sections. The reasoning behind each rule (the design system first, the states, WCAG 2.2 AA and how to test it,
i18n, performance budgets, visual regression): `references/ui-design-patterns.md`.

---

## `data.md` (+data)

```markdown
# Data Pipeline Standards

## Contracts & Schemas
- Where schemas live: [dbt YAML with enforced contracts | a schema registry | schemas/] · compatibility: additive changes only; a breaking change ships as a new version with [N weeks] of deprecation.
- Naming: [snake_case] tables and columns · timestamps in UTC · the layers: [raw → staging → marts].

## Data Quality
- Every dataset: not-null and unique keys, accepted values and ranges, row-count anomaly checks · they run at ingestion and before publishing · a failure: [quarantine the rows | stop the load] and alert the owner.
- Tool: [dbt tests | Great Expectations | SQL checks] · command: [command].

## Idempotency & Backfills
- Every job re-runnable for a partition: overwrite the partition or MERGE on a key — never a blind append · late-arriving data: a lookback window of [N days].
- Backfills: a dry run first · at most [N] partitions in parallel · the cost estimated and approved by [role].

## Lineage & Ownership
- Every dataset has an owner and a freshness SLA · lineage lives in: [dbt docs | the data catalog] · consumers hear of a breaking change [N days] ahead.

## Retention & Cost
- Retention per layer: raw [N days] · curated [N months] — personal data per privacy.md · partitioned by [date], clustered by [key] · cost budget: [$ per month], with an alert at [N] %.
```

Per-dataset decisions (a contract, a check's reaction, a backfill plan) belong in the feature's `[DATA]` design sections.
The reasoning (write-audit-publish, idempotent load patterns, late data, SCD types, lineage, retention across derived
tables): `references/data-pipeline-patterns.md`.

---

## `glossary.md` (optional — the ubiquitous language)

One entry per domain term: the word the specs use, what it means in this product, and the words **not** to use for it.
Scaffold it with `steering_scaffold {file: "glossary.md"}` (CLI `dev-spec steering glossary.md`) — `spec_init` never
creates it — in the project language (PT: `# Glossário`, ES: `# Glosario`).

```markdown
# Glossary

- **Customer** — a person or company with a signed contract. _Avoid: client, user_
- **End user** — a person who logs in to a Customer's account.
- **Invoice**: a bill sent to a Customer for one billing period.
  - _Avoid: bill, receipt_
```

- **Format.** A list item whose term is in bold (`**Term**` or `__Term__`), then the definition after `—`, `:` or `-`;
  the `_Avoid: a, b_` marker on the same line, a sub-line of the item or an indented paragraph after a blank line (a loose
  list). `_Avoid:_` is English-stable — a PT or ES glossary writes it the same way (`- **Cliente** — pessoa ou empresa com
  contrato. _Avoid: comprador, consumidor_`). HTML comments and fenced code hold no entry; a `[bracketed]` term (the
  stub's) is none either. Only the first 300 entries are read — past that, doctor warns and clarify says so
  (`glossaryTruncated` {read, total}).
- **`spec_clarify`** asks about every avoided word a feature's `requirements.md` / `design.md` use — word-matched,
  case-insensitive, a plural `s` / `es` counts, `_client_` (underscore emphasis) too, never `client_id`; never inside a
  code span, fenced code, an HTML comment or a `_Marker:_` tag, and never in the TEMPLATE's own text — the headings,
  guidance lines, track criteria and slot examples the built-in, project and track-pack templates write (a slot you filled
  in, or your own heading, is read); the glossary's own terms are masked first, so "End user" never reads as "user". Each
  question names `file:line` and the term to use; the result carries `glossary` [{word, term, count, locations}].
- **`spec_doctor`** warns `glossary` with the count (pass when none; no check without a glossary or an avoided word).
- **`spec_task_brief`** quotes the entries whose term or avoided word the task's text or its criteria use (at most 8,
  1500 characters) — the implementer names things the way the product does.

Keep it to the terms that actually get confused. A word that legitimately means something else in one feature (a
"user" of an admin console) is fine: answer the clarify question, or narrow the entry.

---

## Project templates — `.specs/templates/`

The built-in scaffolds are a starting point. A team with its own house style (a design template with the company's
review sections, a tasks template with its Definition of Done, a stricter constitution stub) keeps its versions in
`.specs/templates/`, and every NEW feature or steering file is scaffolded from them. Existing features never change.

| File | Replaces |
|---|---|
| `.specs/templates/<artifact>.md` | the built-in template of `classification`, `requirements`, `design`, `tasks`, `test-plan`, `eval-plan`, `load-test`, `quickstart`, `checklist`, `integration-plan`, `bug` (bug.md), the bugfix variants `bug-requirements` / `bug-test-plan` / `bug-tasks`, and the spike ones `spike` (spike.md) / `spike-tasks` |
| `.specs/templates/<lang>/<artifact>.md` | the same, for features in that language (`en` · `pt` · `pt-BR` · `es`) — wins over the shared file; a `pt-BR` feature without a `pt-BR/` file reads `pt/` first |
| `.specs/templates/steering/<file>.md` (also under `<lang>/`) | a steering stub (`constitution.md`, `security.md`, …) |

`spec_create`, `spec_add_track`, `spec_init`, `steering_scaffold` and `spec_import` (through `spec_create`) use an
override when present — create-only, never over an existing file.

- **Commands:** `spec_templates {action: "list" | "init" | "check", artifact?, lang?}` (CLI `dev-spec templates
  [list|init|check] [artifact] [--lang en|pt|pt-BR|es]`; `/spec-templates`). `list` shows built-in vs project per artifact
  (and files that are not a template name — ignored); `init` copies the built-in template(s) into `.specs/templates/`
  (with `lang`: into `<lang>/`) to edit, never overwriting; `check` validates them against the current rules — each
  problem with `{file, line?, code, severity, message}` and a verdict (the CLI exits 1 on an error).
- **Variables:** `{{name}}` `{{slug}}` `{{summary}}` `{{tracks}}` `{{lang}}` `{{date}}` (`{{summary}}` is a spike's
  question); an unknown `{{x}}` is left as is; no summary → a generic `[TBD]` slot.
- **Track blocks are the engine's.** An overridden `design.md` still gets each active track's sections (+tdd
  Testability Notes, `[SaaS]` / `[AI]` / `[SEC]` / `[PRIVACY]` / `[DIST]` / `[API]` / `[UI]` / `[OBS]` / `[DATA]`), `requirements.md` each marker track's criteria
  (renumbered after the template's own US-1 ACs when they would collide), `tasks.md` its task block and
  `test-plan.md` its test rows — appended at the end, as `spec_add_track` does — unless the template already has that
  track's heading (for the test plan: already cites its criteria). A design template that carries some of a track's
  marker headings must carry all of that track's mandatory sections, each with its `> **TODO**` line (`check`: a
  missing section is an error, a missing `TODO` line a warning).
- **Slots stay slots.** The `[bracketed]` slots, code-span slots and task lines of the project's templates count as
  template placeholders, so an untouched custom scaffold still reads "placeholder" for `spec_doctor`, `spec_approve`
  and `spec_next_action`. A template with no slot at all scaffolds a file its gate could approve unedited (`check`
  warns). Keep the English-stable tokens exactly (`US-n.AC-m`, `T-nn`, the markers, `> **TODO**`, `_Verify:_`,
  `**Checkpoint:**`); a `bug.md` template needs a Root Cause section that still reads as unwritten.
- **Confinement:** only the allowlisted names are read or written, nothing outside `.specs/templates/` (a linked
  folder, or a file whose real path is outside the project, is ignored). A pre-1.14 *feature* named `templates` (its
  folder holds a `.state.json`) stays a feature — every action refuses with `legacyFeature: true`. The PostToolUse hook
  and the pre-commit check skip `.specs/templates/`.

---

## Applying These Templates

1. **At project start:** create the four `core` files with real content. Edit every line —
   a template full of placeholders is a liability.
2. **First time a track activates:** add its steering file (e.g., first SaaS feature → `scale.md`,
   `observability.md`, `cost.md`; first AI feature → `ai-strategy.md`; first TDD feature →
   `testing-standards.md`; first +sec feature → `security.md`; first +privacy feature → `privacy.md`; first +dist feature → `distributed.md`; first +api feature → `api.md`; first +ui feature → `ui.md`; first +obs feature → `observability.md`; first +data feature → `data.md`).
3. **At feature spec time:** the design phase reads the active-track files. If a design conflicts
   with a steering file (exceeds budget, breaks an SLA), raise it in review — never silently exceed.
   Area-specific rules go in a scoped file (`inclusion: fileMatch`) rather than bloating `tech.md`.
4. **Quarterly:** review with the team. Targets shift, SLAs tighten, costs drift, models change.
5. **In code review:** a change that contradicts a steering file (new service without `cost.md` update,
   new endpoint without observability, prompt change without eval) is blocked.
