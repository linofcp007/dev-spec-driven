# Steering File Templates

Steering files are short (20–60 lines each) and sit at `.specs/steering/`. They encode the
context every spec needs — product vision, tech stack, conventions, and (when the relevant
tracks are active) scale targets, observability standards, cost budget, AI strategy, and
testing standards — so each feature spec doesn't relitigate the basics.

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
| `observability.md` | `+saas` (also useful for `+ai`) | when SaaS or AI track is used |
| `cost.md` | `+saas` | when the SaaS track is used |
| `ai-strategy.md` | `+ai` | when the AI track is used |

At project start, create at least the four `core` files. Add the others the first time a
feature pulls in that track. Fill them in once, revisit once a quarter.

---

## `constitution.md` (core)

The few non-negotiable principles every feature must obey — kept short, concrete, and testable.
`spec_doctor` and `/prReview` check designs against it (each design.md carries a **Constitution
Check** section), and a design that violates a principle is blocked rather than silently shipped.
Anything that *must* break a principle goes in the design's **Complexity Tracking** table with a
justification, not into the code unannounced.

```markdown
# Constitution

Non-negotiable principles every feature must obey. Keep these few, concrete, and testable.
The `doctor` and `/prReview` check work against them; a design that violates a principle is blocked.

## Principles
1. [e.g., Every write is idempotent or explicitly justified.]
2. [e.g., No PII in logs; user IDs are pseudonymized.]
3. [e.g., No breaking API change without a versioned migration path.]
4. [e.g., Errors fail closed (deny) on the security path.]

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

## `observability.md` (+saas, also useful for +ai)

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
```

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
| Primary | [e.g., claude-opus-4-8] | [capability/quality reason] |
| Fallback / cheap path | [e.g., claude-sonnet-4-6] | [degradation, cost, latency] |
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
- **Pin policy:** [pin dated version vs track latest — reproducibility vs auto-improvement]
- **Deprecation watch:** [how you learn a model is being retired]
- **Migration:** eval-gated only — run current eval set on the new model, compare, then switch.
```

---

## Applying These Templates

1. **At project start:** create the three `core` files with real content. Edit every line —
   a template full of placeholders is a liability.
2. **First time a track activates:** add its steering file (e.g., first SaaS feature → `scale.md`,
   `observability.md`, `cost.md`; first AI feature → `ai-strategy.md`; first TDD feature →
   `testing-standards.md`).
3. **At feature spec time:** the design phase reads the active-track files. If a design conflicts
   with a steering file (exceeds budget, breaks an SLA), raise it in review — never silently exceed.
4. **Quarterly:** review with the team. Targets shift, SLAs tighten, costs drift, models change.
5. **In code review:** a PR that contradicts a steering file (new service without `cost.md` update,
   new endpoint without observability, prompt change without eval) is blocked.
