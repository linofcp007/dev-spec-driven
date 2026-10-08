"use strict";

/**
 * dev-spec-driven i18n — English (en) — the canonical reference: PT and ES mirror its structure (same sections, IDs, markers and slots).
 *
 * Every table's en block: the artifact builders (BUILD), the steering stubs, the evals README, the tool messages (MSG
 * with its quality / designWeigh groups) and the task-brief labels. mcp/lib/i18n.js assembles the tables and is what the
 * engine requires. Blocks keep the indentation they had inside i18n.js's tables.
 */
const { DEV_SPEC, MARKER_TRACK_ORDER, greenLine, signalTracks, templateTestRows, templateTests, coreSuperseded } = require("./common.js"); // load time
// The assembled tables — call-time use only; mcp/lib/i18n.js links them once every language has loaded.
let BUILD, MSG;
function __link(T) { ({ BUILD, MSG } = T); }

// ===========================================================================
// Artifact builders, one set per language. EN is the canonical reference; since 1.13 its templates are
// internally consistent (every template AC planned and tasked) — the gates would otherwise flag the scaffold.
// ===========================================================================
const build = {
    classification(a) {
      const sig = a.signals || { tdd: [], saas: [], ai: [] };
      const sigLine = (t) =>
        a.tracks.includes(t)
          ? `- **+${t}:** ${[...new Set(sig[t] || [])].slice(0, 6).join(", ") || "[signal]"} — [why it applies]`
          : null;
      const signalLines = signalTracks(a.tracks).map(sigLine).filter(Boolean).join("\n") || "- none beyond core";
      return (
`# Classification: ${a.name}

## Mode
Spec

## Active Tracks
${a.label}

## Signals
${signalLines}

## Blast Radius
[What breaks if this is wrong? Who is affected? Recoverable? How fast?]
${a.tracks.includes("saas") ? "\n## Hot Path?\n[Yes/No — if yes, load-test.md is required.]\n" : ""}${a.tracks.includes("ai") ? "\n## Autonomy Level\n[Advisory | Semi-autonomous | Autonomous]\n" : ""}${a.tracks.includes("saas") || a.tracks.includes("ai") ? "\n## Volume / Cost Projection\n- Launch / 6mo / 2yr: [load, ~$/month]\n" : ""}
## Compliance Tags
[GDPR | PCI | HIPAA | SOC2 | none]

${a.summary ? "## Summary\n" + a.summary + "\n" : ""}`
      );
    },

    requirements(a) {
      // Track criteria sit under [SaaS]/[AI] headings: inactive (not a gate, not a placeholder) once the track is off.
      const saasAc = a.tracks.includes("saas")
        ? "\n\n#### [SaaS] Acceptance Criteria (EARS)\n5. **US-1.AC-5** — WHEN a user from tenant A requests data, THE SYSTEM SHALL NOT return any record whose tenant_id != A.\n6. **US-1.AC-6** — THE SYSTEM SHALL respond within [N]ms at P95."
        : "";
      const aiAc = a.tracks.includes("ai")
        ? "\n\n#### [AI] Acceptance Criteria (EARS)\n7. **US-1.AC-7** — THE SYSTEM SHALL produce outputs rated 'good or excellent' on at least [85]% of the golden eval set.\n8. **US-1.AC-8** — IF the input contains a prompt-injection attempt, THEN THE SYSTEM SHALL ignore the injected instruction and complete the original task.\n9. **US-1.AC-9** — THE SYSTEM SHALL cost at most $[0.03] per user request at P95 size."
        : "";
      const secAc = a.tracks.includes("sec")
        ? "\n\n#### [SEC] Acceptance Criteria (EARS)\n10. **US-1.AC-10** — IF an unauthenticated request reaches a protected endpoint, THEN THE SYSTEM SHALL reject it with 401 and return no protected data.\n11. **US-1.AC-11** — IF an authenticated user requests a resource they are not authorized to access, THEN THE SYSTEM SHALL deny it with 403 and record a security audit event.\n12. **US-1.AC-12** — THE SYSTEM SHALL NOT include secrets, credentials, session tokens or stack traces in any response or log entry."
        : "";
      const privacyAc = a.tracks.includes("privacy")
        ? "\n\n#### [PRIVACY] Acceptance Criteria (EARS)\n13. **US-1.AC-13** — WHEN a data subject requests a copy of their personal data, THE SYSTEM SHALL export it in a structured, machine-readable format within one month.\n14. **US-1.AC-14** — WHEN a data subject's erasure request is accepted, THE SYSTEM SHALL delete or irreversibly anonymize their personal data in every store within one month.\n15. **US-1.AC-15** — WHEN a record's retention period ends, THE SYSTEM SHALL delete or anonymize it."
        : "";
      const distAc = a.tracks.includes("dist")
        ? "\n\n#### [DIST] Acceptance Criteria (EARS)\n16. **US-1.AC-16** — IF publishing [the event] fails after the database transaction commits, THEN THE SYSTEM SHALL still deliver it later, at least once, without losing it (transactional outbox).\n17. **US-1.AC-17** — WHEN the same message is delivered more than once, THE SYSTEM SHALL apply its effect exactly once (idempotent consumer).\n18. **US-1.AC-18** — WHEN two requests update the same [entity] concurrently, THE SYSTEM SHALL NOT lose either update (optimistic locking or a unique constraint).\n19. **US-1.AC-19** — IF [the dependency] is unavailable, THEN THE SYSTEM SHALL [degrade / retry with exponential backoff and jitter] and SHALL NOT block [the critical path]."
        : "";
      const apiAc = a.tracks.includes("api")
        ? "\n\n#### [API] Acceptance Criteria (EARS)\n20. **US-1.AC-20** — IF a request omits [a required field] or sends it malformed, THEN THE SYSTEM SHALL respond 400 with an application/problem+json body that names the field and carries a stable error code.\n21. **US-1.AC-21** — WHEN a client repeats [a create request] with the same Idempotency-Key and body, THE SYSTEM SHALL return the first response without applying the effect again.\n22. **US-1.AC-22** — IF an update carries an If-Match ETag that no longer matches the resource, THEN THE SYSTEM SHALL respond 412 and leave the resource unchanged.\n23. **US-1.AC-23** — IF a change to the contract would break an existing client, THEN THE SYSTEM SHALL ship it only in a new [API version] and keep the current version working until its announced Sunset date."
        : "";
      const uiAc = a.tracks.includes("ui")
        ? "\n\n#### [UI] Acceptance Criteria (EARS)\n24. **US-1.AC-24** — WHEN a user operates [the view] with the keyboard alone, THE SYSTEM SHALL make every action reachable and operable in a logical focus order, with a visible focus indicator.\n25. **US-1.AC-25** — IF a submitted form has invalid fields, THEN THE SYSTEM SHALL keep every value the user entered, identify each error in text next to its field and move focus to an error summary.\n26. **US-1.AC-26** — WHILE [the list] has no items, THE SYSTEM SHALL show an empty state that explains why and offers the next action.\n27. **US-1.AC-27** — IF loading [the data] fails, THEN THE SYSTEM SHALL show an error message with a Retry action and keep the content already shown."
        : "";
      const obsAc = a.tracks.includes("obs")
        ? "\n\n#### [OBS] Acceptance Criteria (EARS)\n28. **US-1.AC-28** — THE SYSTEM SHALL emit [the request metric] with its latency, outcome and a correlation ID for every [request], and log each error with that correlation ID and no personal data.\n29. **US-1.AC-29** — WHEN the error-budget burn rate of [the SLO] exceeds [14.4]× over [one hour], THE SYSTEM SHALL page the on-call engineer with a link to the runbook.\n30. **US-1.AC-30** — IF the canary's error rate exceeds [the baseline] by [N] percentage points, THEN THE SYSTEM SHALL stop the rollout and roll back to the previous version automatically.\n31. **US-1.AC-31** — WHILE [a dependency] is unavailable, THE SYSTEM SHALL report itself not ready (readiness check) while staying live, and recover without a restart once it is back."
        : "";
      const dataAc = a.tracks.includes("data") // +data (1.21 F4)
        ? "\n\n#### [DATA] Acceptance Criteria (EARS)\n32. **US-1.AC-32** — WHEN a batch contains a row that violates [a data-quality rule], THE SYSTEM SHALL quarantine that row with the rule it failed and SHALL NOT load it into [the target table].\n33. **US-1.AC-33** — IF the job is re-run for a partition that was already loaded, THEN THE SYSTEM SHALL produce the same result as a single run, with no duplicate and no missing rows (an idempotent re-run and backfill).\n34. **US-1.AC-34** — IF the newest data in [the table] is older than [its freshness SLA], THEN THE SYSTEM SHALL alert [the owner] and mark the table stale for its consumers.\n35. **US-1.AC-35** — WHEN the schema of [the source] changes, THE SYSTEM SHALL accept an additive, backward-compatible change and SHALL reject a breaking change (a removed or renamed column, a narrowed type) before any row reaches [the consumers]."
        : "";
      // 1.21 F5 — size S: one story, two core criteria (WHEN · IF…THEN), every track criterion kept; no US-2, edge-case, NFR or
      // assumptions block (the IF…THEN criterion is the error path). M / L / no size: the full template below.
      if (a.size === "s") {
        return (
`# Feature: ${a.name}

## Summary
${a.summary || "[1-2 sentences: what this does and why it matters]"}

## User Story

### US-1 (P1 — MVP): [Story Title]
**As a** [role], **I want** [capability], **so that** [benefit].
**Independent Test:** Can be fully tested by [specific action] and delivers [specific value].

#### Acceptance Criteria (EARS)
1. **US-1.AC-1** — WHEN [trigger] THE SYSTEM SHALL [behavior]
2. **US-1.AC-2** — IF [error condition] THEN THE SYSTEM SHALL [recovery]${saasAc}${aiAc}${secAc}${privacyAc}${distAc}${apiAc}${uiAc}${obsAc}${dataAc}

## Success Criteria (measurable, technology-agnostic)
- **SC-001** — [e.g., 90% of users complete [task] in under [N] seconds]

## Out of Scope
- [What this feature does NOT include]

<!-- Size S: one story. Every AC contains SHALL and is testable; keep stable AC IDs. Mark any ambiguity inline with a
     bracketed marker like  [NEEDS CLARIFICATION: which provider?] . A second story, edge cases or NFRs mean size m. -->
`
        );
      }
      return (
`# Feature: ${a.name}

## Summary
${a.summary || "[1-2 sentences: what this does and why it matters]"}

## User Stories (prioritized — each independently testable)

Priorities: **P1** = critical, a viable MVP on its own · **P2** = secondary · **P3** = enhancement.
Each story must deliver standalone value if shipped alone.

### US-1 (P1 — MVP): [Story Title]
**As a** [role], **I want** [capability], **so that** [benefit].
**Why P1:** [why this is the minimum viable slice]
**Independent Test:** Can be fully tested by [specific action] and delivers [specific value], without the other stories.

#### Acceptance Criteria (EARS)
1. **US-1.AC-1** — WHEN [trigger] THE SYSTEM SHALL [behavior]
2. **US-1.AC-2** — WHILE [state], WHEN [trigger] THE SYSTEM SHALL [behavior]
3. **US-1.AC-3** — IF [error condition] THEN THE SYSTEM SHALL [recovery]
4. **US-1.AC-4** — [ubiquitous] THE SYSTEM SHALL [always-true property]${saasAc}${aiAc}${secAc}${privacyAc}${distAc}${apiAc}${uiAc}${obsAc}${dataAc}

### US-2 (P2): [Story Title]
**As a** [role], **I want** [capability], **so that** [benefit].
**Independent Test:** [how to test this alone]

#### Acceptance Criteria (EARS)
1. **US-2.AC-1** — WHEN [trigger] THE SYSTEM SHALL [behavior]

## Success Criteria (measurable, technology-agnostic)
Outcomes the feature must achieve — business/UX, not implementation. Quantify each.
- **SC-001** — [e.g., 90% of users complete [task] in under [N] seconds]
- **SC-002** — [e.g., error rate on [flow] stays below [N]%]

## Edge Cases & Error Handling
- **EC-1** — [Scenario]: [Expected behavior]

## Non-Functional Requirements
- **NFR-1** — [measurable performance / security / accessibility constraint]

## Out of Scope
- [What this feature does NOT include]

## Assumptions
- [Anything assumed true that, if wrong, changes the spec]

<!-- EARS: every AC contains SHALL/DEVE/DEBE and is testable; avoid vague terms; keep stable AC IDs.
     Mark any ambiguity inline with a bracketed marker like  [NEEDS CLARIFICATION: which provider?] .
     The design phase is gated — it cannot start while any such marker remains unresolved. -->
`
      );
    },

    trackDesignBlock(track) {
      if (track === "tdd") {
        return `
## Testability Notes
- **Seams:** [where test doubles inject]
- **Determinism:** [clocks, randomness, IDs abstracted how]
- **Side effects to isolate:** [network, fs, time, external services]
- **Test data strategy:** [factories, fixtures, seeds]
`;
      }
      if (track === "saas") {
        return `
## [SaaS] Performance Budget
> **TODO** — replace with real values (remove this line when done).
- P50/P95/P99 latency targets · max DB query time · max memory/request · throughput target.

## [SaaS] Scale Design
> **TODO** — replace with real values (remove this line when done).
- Concurrent users (launch/6mo/2yr) · data growth · hot paths · caching (TTL+invalidation) · queue strategy · indexes · sharding.

## [SaaS] Multi-tenancy Model
> **TODO** — replace with real values (remove this line when done).
- Isolation (pooled/siloed/bridged) · how tenant_id is enforced · noisy-neighbor limits · export/delete (GDPR).

## [SaaS] Observability
> **TODO** — replace with real values (remove this line when done).
- Metrics (name each) · structured logs (events+fields) · traces (spans) · alerts (metric→threshold→who) · dashboard panels.

## [SaaS] Cost Envelope
> **TODO** — replace with real values (remove this line when done).
- $/1000 users/month (compute/storage/network/3p) · cost-critical paths · cost metric + alert threshold.
`;
      }
      if (track === "ai") {
        return `
## [AI] 1. Model Strategy
> **TODO** — replace with real values (remove this line when done).
Primary / fallback model · features used · context-window usage · why not another model.

## [AI] 2. Prompt Architecture
> **TODO** — replace with real values (remove this line when done).
System prompt · user template (variables) · few-shot source · versioning (prompts/vN.md, not inline).

## [AI] 3. Token Economics
> **TODO** — replace with real values (remove this line when done).
Typical in/out tokens · cost/call · cost/user action · cost/1000 users/month · regression threshold.

## [AI] 4. Latency Budget
> **TODO** — replace with real values (remove this line when done).
Time to first token · total response time · end-to-end user-perceived latency.

## [AI] 5. Eval Strategy
> **TODO** — replace with real values (remove this line when done).
Golden set · adversarial set · regression set · grading method · ship threshold · eval frequency.

## [AI] 6. Safety & Abuse
> **TODO** — replace with real values (remove this line when done).
Injection defense · content moderation · jailbreak resistance · PII handling · rate limiting.

## [AI] 7. Fallback & Degradation
> **TODO** — replace with real values (remove this line when done).
Provider outage · rate-limit hit · garbage output detection · cost circuit breaker.

## [AI] 8. Observability for AI
> **TODO** — replace with real values (remove this line when done).
Per-call logging (prompt version, model, tokens, cost, latency, ids) · metrics · sampled prompts · traces · alerts.

## [AI] 9. Model Lifecycle
> **TODO** — replace with real values (remove this line when done).
Pinned IDs · deprecation awareness · eval-gated migration plan · pin policy.

## [AI] 10. Multi-modality (if applicable)
> **TODO** — replace with real values (remove this line when done).
Input types · size/count limits · token counting per type · validation pipeline.
`;
      }
      if (track === "sec") {
        return `
## [SEC] Threat Model
> **TODO** — replace with real values (remove this line when done).
- Assets · actors · trust boundaries · entry points · STRIDE per component / boundary (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege) → mitigation · residual risk.

## [SEC] Security Requirements
> **TODO** — replace with real values (remove this line when done).
- Target OWASP ASVS level (L1 / L2 / L3) and why · the ASVS controls and OWASP Top 10 risks in scope → how the design meets each.

## [SEC] Authentication & Authorization
> **TODO** — replace with real values (remove this line when done).
- Who may do what (role / permission matrix) · authentication (session, token, MFA) · object-level checks, deny by default · session lifetime and revocation.

## [SEC] Secrets & Key Management
> **TODO** — replace with real values (remove this line when done).
- Secrets the feature needs · where they live (a secret store — never code, logs or tickets) · rotation · encryption at rest / in transit and who owns the keys.

## [SEC] Security Testing
> **TODO** — replace with real values (remove this line when done).
- SAST · dependency and secret scanning · DAST when exposed · one abuse-case test per material threat — all runnable locally before the merge.
`;
      }
      if (track === "privacy") {
        return `
## [PRIVACY] Personal Data Inventory
> **TODO** — replace with real values (remove this line when done).
- Each personal data field · category (special categories — Art. 9 — flagged) · source · where it is stored · who can read it.

## [PRIVACY] Lawful Basis & Purpose
> **TODO** — replace with real values (remove this line when done).
- Purpose per processing activity · its lawful basis (Art. 6: consent, contract, legal obligation, vital interests, public task, legitimate interests) · how consent is recorded and withdrawn.

## [PRIVACY] Retention & Deletion
> **TODO** — replace with real values (remove this line when done).
- Retention period per data category and why · the deletion / anonymization job · backups and logs · legal holds.

## [PRIVACY] Data Subject Rights
> **TODO** — replace with real values (remove this line when done).
- Access · rectification · erasure · restriction · portability · objection — how each request is verified, served and answered within one month.

## [PRIVACY] Processors & International Transfers
> **TODO** — replace with real values (remove this line when done).
- Processors / sub-processors and their Art. 28 contracts · where the data is stored and processed · transfers outside the EEA and their safeguard (adequacy decision, standard contractual clauses).

## [PRIVACY] DPIA (when required — Art. 35)
> **TODO** — replace with real values (remove this line when done).
- Required? (high risk: large-scale special categories, systematic monitoring, profiling with legal effects…) · if yes: risks → measures → residual risk; if not: why not.
`;
      }
      if (track === "dist") {
        return `
## [DIST] Consistency Model
> **TODO** — replace with real values (remove this line when done).
- What must be atomic (one transaction) · is ACID required, at which isolation level and why · where consistency is strong and where eventual · the staleness the business accepts · read-your-writes needs.

## [DIST] Cross-system Writes
> **TODO** — replace with real values (remove this line when done).
- Every write that touches more than one system (DB + broker, DB + cache, DB + external API) → its mitigation: transactional outbox (+ relay / CDC), inbox, saga with compensations — or the risk explicitly accepted, and by whom.

## [DIST] Delivery & Idempotency
> **TODO** — replace with real values (remove this line when done).
- Delivery guarantee (at-least-once) · idempotency keys or natural idempotency · deduplication (inbox table, unique constraint) · retry policy (exponential backoff + jitter, max attempts, what is never retried) · DLQ / poison messages · ordering needs.

## [DIST] Concurrency
> **TODO** — replace with real values (remove this line when done).
- Race conditions on each shared record · optimistic (version column) or pessimistic (SELECT … FOR UPDATE) locking · unique constraints · isolation anomalies ruled out (lost update, write skew) · lock timeouts and deadlocks.

## [DIST] Failure Modes
> **TODO** — replace with real values (remove this line when done).
- Partial failures and timeouts per dependency · what happens when each dependency is down (degrade, queue, fail fast) · network partitions: the CAP / PACELC trade-off chosen · recovery and reconciliation (replay, compensation, a reconciliation job).
`;
      }
      if (track === "api") {
        return `
## [API] API Contract
> **TODO** — replace with real values (remove this line when done).
- Style (REST / GraphQL / gRPC) · resources and operations (method + path, or query / mutation / RPC) · request and response schemas · where the contract file lives (OpenAPI document, .proto files, GraphQL schema) — written first, reviewed before the handlers · auth scopes per operation.

## [API] Versioning & Compatibility
> **TODO** — replace with real values (remove this line when done).
- Versioning strategy (URL / header / date) · what is a breaking change here (a removed or renamed field, a new required input, a changed type or status code, tighter validation) · additive-only changes within a version · deprecation: the Deprecation / Sunset headers, the notice period, how clients are told.

## [API] Error Model
> **TODO** — replace with real values (remove this line when done).
- Error format: application/problem+json (RFC 9457 — type, title, status, detail, instance) · the stable error codes clients may branch on · validation errors per field · the status codes each operation returns · no stack trace or internal detail in a response.

## [API] Pagination, Idempotency & Concurrency
> **TODO** — replace with real values (remove this line when done).
- Pagination: an opaque cursor with a stable order and a maximum page size (or offset, and why) · Idempotency-Key on non-idempotent creates (its scope, how long a key is kept, a reused key with another body → 422) · ETag / If-Match on updates (412 on a stale version) · long-running operations (202 + a status resource).

## [API] Rate Limits & Quotas
> **TODO** — replace with real values (remove this line when done).
- Limits per client / key / tenant and their windows · 429 with Retry-After and the RateLimit headers · quotas and how a client reads what it has left · what is exempt.
`;
      }
      if (track === "ui") {
        return `
## [UI] Design System Usage
> **TODO** — replace with real values (remove this line when done).
- The design-system components used and the tokens (colour, spacing, type) · each new component: why the existing ones don't fit and how it enters the system (documented, reviewed, in the component library) · no one-off styles or hard-coded colours.

## [UI] UI States
> **TODO** — replace with real values (remove this line when done).
- Per view, a state matrix: loading · empty · error (with a Retry) · partial · offline · permission denied · success — what the user sees and can do in each; form validation (inline + a summary, values kept).

## [UI] Accessibility
> **TODO** — replace with real values (remove this line when done).
- WCAG 2.2 AA: keyboard operable with a visible focus order · a name / label for every control · contrast (4.5:1 text, 3:1 UI) · target size (24×24 px) · reduced motion · errors identified in text · how it is tested (an automated check + a manual keyboard and screen-reader pass).

## [UI] Responsiveness & i18n
> **TODO** — replace with real values (remove this line when done).
- Breakpoints and how the layout adapts · text expansion (+30–40 %) · right-to-left layouts · locale formats (dates, numbers, currency) · every string in the translation catalogue.

## [UI] UI Performance Budget
> **TODO** — replace with real values (remove this line when done).
- Core Web Vitals at the 75th percentile: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 · the JS / image weight budget of this view · how it is measured (lab + real users).
`;
      }
      if (track === "obs") {
        return `
## [OBS] SLIs & SLOs
> **TODO** — replace with real values (remove this line when done).
- The user journeys that matter → their SLIs (availability, latency, correctness) · the SLO of each over a window (e.g. 99.5 % of valid requests under 800 ms, 28 days) · the error budget and what happens when it is spent · burn-rate alerts (fast and slow).

## [OBS] Telemetry
> **TODO** — replace with real values (remove this line when done).
- Metrics (RED per endpoint / USE per resource, one business counter; bounded label cardinality) · structured logs with a correlation / trace ID — no personal data · traces with the context propagated across calls and queues (OpenTelemetry) · the metrics each task emits.

## [OBS] Alerting & Runbooks
> **TODO** — replace with real values (remove this line when done).
- Each alert: the symptom (an SLO burn, not a cause), threshold, severity and who is paged · every page links a runbook (triage, mitigate, verify) · what is a ticket, not a page · dashboards per journey.

## [OBS] Rollout & Rollback
> **TODO** — replace with real values (remove this line when done).
- Feature flags (who owns each, when it is removed) · the canary / progressive rollout steps and the metrics that gate each step · rollback criteria (e.g. an error rate above the baseline) and how long a rollback takes · migrations that can be rolled back (expand / contract).

## [OBS] Health & Capacity
> **TODO** — replace with real values (remove this line when done).
- Liveness vs readiness checks (what each verifies — never a dependency in liveness) · the capacity signals (saturation, queue depth, pool usage) and their thresholds · the expected load and where the first bottleneck is.
`;
      }
      if (track === "data") {
        return `
## [DATA] Data Contracts & Schema Evolution
> **TODO** — replace with real values (remove this line when done).
- Each dataset produced or consumed: its producer, its consumers and the contract's owner · the schema (columns, types, nullability, keys, units) and where it lives (a schema file, a dbt model's YAML, a registry) · the compatibility rule (additive changes only; a removed or renamed column → a new version with a deprecation window) · how a breaking change is caught before it ships.

## [DATA] Data Quality
> **TODO** — replace with real values (remove this line when done).
- The checks per dataset: not-null keys, uniqueness, accepted values and ranges, referential integrity, row-count and volume anomalies, freshness · where each runs (at ingestion, after each transformation, before publishing) · what a failure does (quarantine the rows, stop the load, alert the owner) — no bad row reaches a consumer silently.

## [DATA] Pipeline Idempotency & Backfills
> **TODO** — replace with real values (remove this line when done).
- The unit of work (a partition: a day, an hour, a batch ID) and how a re-run replaces it (overwrite the partition or MERGE on a key — never a blind append) · late-arriving data: the lookback window and how late rows are merged · the backfill procedure (range, parallelism, cost, a dry run, who approves it) · large volumes: references/distributed-data-patterns.md.

## [DATA] Lineage & Ownership
> **TODO** — replace with real values (remove this line when done).
- Sources → transformations → consumers (a lineage diagram or the dbt DAG) · the owner of each dataset and who is told when it breaks · the freshness SLA consumers rely on · the history each table keeps (slowly changing dimensions: type 1 overwrites, type 2 keeps versions).

## [DATA] Retention & Cost
> **TODO** — replace with real values (remove this line when done).
- Retention per dataset and storage tier (the raw zone vs the curated one; hot / warm / cold) — personal data follows references/privacy-track.md · partitioning and clustering so a query scans only what it needs · the expected storage and query cost per month and the alert when it drifts.
`;
      }
      return "";
    },

    design(a) {
      const extra = ["tdd", ...MARKER_TRACK_ORDER].filter((t) => a.tracks.includes(t)).map((t) => BUILD.en.trackDesignBlock(t)).join("");
      if (a.size) return BUILD.en.sizedDesign(a, extra);
      return (
`# Design: ${a.name}

## Overview
[How this integrates with the existing system. Key decisions and rationale.]

## Architecture
\`\`\`mermaid
graph TD
    A[Component] -->|action| B[Component]
    B -->|query| C[(Database)]
\`\`\`

## Reuse & Integration
<!-- Search before you write (references/code-reuse-and-quality.md): what this feature takes from the codebase before
     it adds anything. One row per unit, with its path. Reuse = an existing module, component, helper or service used
     as is; Extend = an existing unit this feature changes (its callers keep working); New = nothing existing fits —
     say what was searched and why. A greenfield project says so in one line. -->
| Kind | What | Where (path) | Why / notes |
|---|---|---|---|
| Reuse | [existing module, component, helper or service] | [its path] | [what it already does for this feature] |
| Extend | [existing unit this feature changes] | [its path] | [the change — existing callers keep working] |
| New | [new unit] | [where it will live] | [why nothing existing fits — what was searched] |

**Module boundaries:** [where the new code lives, what it exposes and what it may import — features depend on shared code, never the reverse]

## Alternatives & Trade-offs
<!-- The options weighed for each key decision — e.g. strong vs eventual consistency, monolith vs service, sync vs
     async, optimistic vs pessimistic locking. At least two per decision (one option alone was never weighed), what
     choosing wrong would cost, the one chosen and why. One row per option. -->
| Decision | Option | Pros | Cons | Cost if wrong | Chosen |
|---|---|---|---|---|---|
| [key decision] | [option A] | [pros] | [cons] | [cost of being wrong] | [✓ — why] |
| [key decision] | [option B] | [pros] | [cons] | [cost of being wrong] | [✗ — why not] |

## Data Models
\`\`\`typescript
interface Entity {
  id: string;
  // fields with comments explaining purpose
}
\`\`\`

## API Contracts
### POST /api/resource
- **Request:** \`{ field: type }\`
- **Response (200):** \`{ field: type }\`
- **Errors:** 400 (validation), 401 (auth), 404 (not found)

## Security Considerations
[Auth, validation, data exposure risks]

## Error Handling
[Strategy per failure mode from requirements]

## Testing Strategy
- Unit / Integration / E2E: [what each covers]

## Risks
<!-- What could make this design wrong or the delivery late — technical, delivery, data, business. One row per risk;
     an honest "no material risk, because X" is fine — blank is not. -->
| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|
| [what could go wrong] | [low / medium / high] | [low / medium / high] | [how we prevent or detect it] | [who watches it] |

## Constitution Check
Verify this design against each principle in \`steering/constitution.md\`. GATE: must pass before
implementation; re-check after any design change.
- [ ] [Principle 1] — complies
- [ ] [Principle 2] — complies
(If a principle cannot be met, do NOT silently break it — record it in Complexity Tracking below.)

## Complexity Tracking
Justify anything that violates a constitution principle or adds non-obvious complexity. Empty is good.
| What | Why it's needed | Simpler alternative rejected because |
|---|---|---|
| [e.g., second cache layer] | [reason] | [why the simple option fails] |
${extra}
<!-- Tracks active: ${a.label}. Mandatory track sections above must have real
     content — an honest "not needed because X" is fine; blank is not. -->
`
      );
    },

    // 1.21 F5 — the design of a SIZED feature (a.size s | m | l; xs is a change, no design). Every size: Complexity Tracking
    // without the example row the placeholder gate refused, Error Handling pointing at the IF…THEN criteria (never asked twice),
    // and a core section a track's own sections supersede left out (CORE_SUPERSEDED_BY). M / L: Reuse & Integration with one
    // example row. S: the three weigh sections merged into ONE "Decisions, reuse & risks" section (designWeighChecks reads it),
    // no Data Models / API Contracts / Security Considerations / Testing Strategy examples. The track blocks (`extra`) are the
    // full ones — the engine keeps a size's tiers and drops the sections another active track covers (engine/scaffold.js).
    sizedDesign(a, extra) {
      const s = a.size === "s";
      const out = [`# Design: ${a.name}`, "", "## Overview", "[How this integrates with the existing system. Key decisions and rationale.]", "",
        "## Architecture", "```mermaid", "graph TD", "    A[Component] -->|action| B[Component]", "    B -->|query| C[(Database)]", "```", ""];
      if (s) {
        out.push("## Decisions, reuse & risks",
          "<!-- One short answer each. What this reuses (with its path) — or \"nothing to reuse\"; the option chosen, the one",
          "     rejected and why — or \"no alternative worth weighing\"; what could go wrong and how it is caught — or \"no material",
          "     risk, because X\". Blank is not an answer. -->",
          "- **Reuse:** [existing module or helper reused, with its path — or nothing to reuse]",
          "- **Decision:** [the option chosen, the one rejected and why]",
          "- **Risk:** [what could go wrong and how it is caught — or no material risk, because …]", "");
      } else {
        out.push("## Reuse & Integration",
          "<!-- Search before you write (references/code-reuse-and-quality.md): what this feature takes from the codebase before",
          "     it adds anything. One row per unit, with its path — Reuse (used as is), Extend (changed; its callers keep working)",
          "     or New (nothing existing fits — say what was searched). A greenfield project says so in one line. -->",
          "| Kind | What | Where (path) | Why / notes |", "|---|---|---|---|",
          "| [Reuse / Extend / New] | [the unit] | [its path] | [why — for New: what was searched] |", "",
          "**Module boundaries:** [where the new code lives, what it exposes and what it may import — features depend on shared code, never the reverse]", "",
          "## Alternatives & Trade-offs",
          "<!-- The options weighed for each key decision — e.g. strong vs eventual consistency, monolith vs service, sync vs",
          "     async, optimistic vs pessimistic locking. At least two per decision (one option alone was never weighed), what",
          "     choosing wrong would cost, the one chosen and why. One row per option. -->",
          "| Decision | Option | Pros | Cons | Cost if wrong | Chosen |", "|---|---|---|---|---|---|",
          "| [key decision] | [option A] | [pros] | [cons] | [cost of being wrong] | [✓ — why] |",
          "| [key decision] | [option B] | [pros] | [cons] | [cost of being wrong] | [✗ — why not] |", "",
          "## Data Models", "```typescript", "interface Entity {", "  id: string;", "  // fields with comments explaining purpose", "}", "```", "");
        if (!coreSuperseded(a, "apiContracts")) out.push("## API Contracts", "### POST /api/resource", "- **Request:** `{ field: type }`", "- **Response (200):** `{ field: type }`",
          "- **Errors:** 400 (validation), 401 (auth), 404 (not found)", "");
        if (!coreSuperseded(a, "securityConsiderations")) out.push("## Security Considerations", "[Auth, validation, data exposure risks]", "");
      }
      if (!coreSuperseded(a, "errorHandling")) out.push("## Error Handling",
        "Each IF…THEN criterion in requirements.md already names a failure and its recovery — add here only what spans them (retries, fallbacks, the messages users see), or leave it at that.", "");
      if (!s && !coreSuperseded(a, "testingStrategy")) out.push("## Testing Strategy", "- Unit / Integration / E2E: [what each covers]", "");
      if (!s) out.push("## Risks",
        "<!-- What could make this design wrong or the delivery late — technical, delivery, data, business. One row per risk;",
        "     an honest \"no material risk, because X\" is fine — blank is not. -->",
        "| Risk | Likelihood | Impact | Mitigation | Owner |", "|---|---|---|---|---|",
        "| [what could go wrong] | [low / medium / high] | [low / medium / high] | [how we prevent or detect it] | [who watches it] |", "");
      out.push("## Constitution Check", "Verify this design against each principle in `steering/constitution.md`. GATE: must pass before",
        "implementation; re-check after any design change.", "- [ ] [Principle 1] — complies", "- [ ] [Principle 2] — complies",
        "(If a principle cannot be met, do NOT silently break it — record it in Complexity Tracking below.)", "",
        "## Complexity Tracking", "Justify anything that violates a constitution principle or adds non-obvious complexity. Empty is good.",
        "| What | Why it's needed | Simpler alternative rejected because |", "|---|---|---|");
      return out.join("\n") + "\n" + extra + `
<!-- Tracks active: ${a.label} · size ${a.size}. Mandatory track sections above must have real content — an honest
     "n/a — <why it does not apply>" is fine; blank or the template's guidance line is not. -->
`;
    },

    tasks(a) {
      const green = a.tracks.includes("tdd") ? templateTests(a.tracks) : null; // each template test made green by one task
      const evalMarker = a.tracks.includes("ai") ? "\n  - _Affects evals: golden (maintain baseline)_" : "";
      const metricMarker = a.tracks.includes("saas") ? "\n  - _Emits metrics: req_duration_ms{feature=" + a.slug + "}_" : "";
      let n = 0;
      const id = () => ++n;
      // 1.21 F5 — size S: one core task (US-1's two criteria), then the track blocks (the engine keeps, per track, the tasks
      // that implement a criterion — engine/scaffold.js trimTrackTasks); no setup / foundational / US-2 / polish phases.
      if (a.size === "s") {
        const green1 = a.tracks.includes("tdd") ? templateTests(a.tracks, "s") : null;
        let body =
`## Story US-1 (P1 — MVP)
- [ ] ${id()}. [US1] [Core behavior for US-1]
  - _Requirements: US-1.AC-1, US-1.AC-2_${greenLine(green1, "US-1.AC-1", "US-1.AC-2")}${metricMarker}${evalMarker}
  - _Verify: [command that proves it, e.g. npm test -- path/to/file.test.js]_
**Checkpoint:** US-1 is fully functional and independently testable/shippable.
`;
        for (const t of MARKER_TRACK_ORDER) {
          if (!a.tracks.includes(t)) continue;
          const block = BUILD.en.trackTasks({ track: t, start: n + 1, green: green1 });
          body += block;
          n += (block.match(/^- \[ \] \d+\./gm) || []).length;
        }
        return (
`# Tasks: ${a.name}

<!-- Tracks: ${a.label} · size s. One story; every task carries _Requirements:_ (TDD tasks _Makes green:_) and a
     _Verify: <command>_ — spec_complete_task records its result as the task's evidence. Use _Implements: path_ to tie a
     task to a real source file. -->

## Global Constraints
<!-- Exact values every task must respect, copied verbatim from the spec/steering — spec_task_brief inlines this section
     into every task brief. -->
- [e.g. Node >= 20 · no new runtime dependencies · API field names in snake_case]

${body}`
        );
      }
      let phases =
`## Phase: Setup
- [ ] ${id()}. [shared][P] [project/dev setup if needed — deps, scaffolding]

## Phase: Foundational (blocks all stories)
- [ ] ${id()}. [shared] [Models, schemas, indexes shared across stories]
  - _Requirements: US-1.AC-1_${metricMarker}

## Story US-1 (P1 — MVP)
- [ ] ${id()}. [US1] [Core behavior for US-1]
  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3_${greenLine(green, "US-1.AC-1", "US-1.AC-2", "US-1.AC-3")}${evalMarker}
  - _Verify: [command that proves it, e.g. npm test -- path/to/file.test.js]_
- [ ] ${id()}. [US1][P] [parallelizable task — different file, no deps]
  - _Requirements: US-1.AC-4_${greenLine(green, "US-1.AC-4")}
**Checkpoint:** US-1 is fully functional and independently testable/shippable.
`;
      for (const t of MARKER_TRACK_ORDER) {
        if (!a.tracks.includes(t)) continue;
        const block = BUILD.en.trackTasks({ track: t, start: n + 1, green });
        phases += block;
        n += (block.match(/^- \[ \] \d+\./gm) || []).length;
      }
      phases +=
`
## Story US-2 (P2)
- [ ] ${id()}. [US2] [Behavior for US-2]
  - _Requirements: US-2.AC-1_${greenLine(green, "US-2.AC-1")}
**Checkpoint:** US-2 works without breaking US-1.

## Phase: Polish (cross-cutting)
- [ ] ${id()}. [shared][P] [docs, cleanup, edge-case hardening]
`;
      return (
`# Tasks: ${a.name}

<!-- Tracks: ${a.label}. Organized by user story so each is independently shippable
     (P1 first). Each task is tagged with its story: [US1]/[US2] or [shared] for cross-cutting work.
     [P] = parallelizable (different files, no deps). Every task carries _Requirements:_; TDD tasks
     carry _Makes green:_. Use _Implements: path_ to tie a task to a real source file. A **Checkpoint**
     marks where a story is independently testable.
     If the stories are NOT independently shippable, they were mis-sliced — re-slice them, or fall
     back to a technical-layer layout (Foundation→Logic→API→…) keeping the [US1] tags. -->

## Global Constraints
<!-- Exact values every task must respect, copied verbatim from the spec/steering (version floors,
     naming rules, limits, formats) — spec_task_brief inlines this section into every task brief.
     Give each task a _Verify: <command>_: spec_complete_task records its result as the task's evidence. -->
- [e.g. Node >= 20 · no new runtime dependencies · API field names in snake_case]

${phases}`
      );
    },

    // A track's template task block (none for +tdd — it only adds markers). Shared by tasks() and
    // spec_add_track, so a feature escalated later gets the very same tasks. a = { track, start, green? } — green
    // (templateTests) only on a greenfield +tdd scaffold, whose test plan holds those T-IDs.
    trackTasks(a) {
      let n = a.start - 1;
      const id = () => ++n;
      if (a.track === "saas") {
        return `
## Story US-1 — Observability & Scale
- [ ] ${id()}. [US1] Emit metrics, add dashboard, configure alerts
  - _Requirements: US-1.AC-6_
- [ ] ${id()}. [US1] Load test — verify performance budget from design.md (hot path only)
  - _Requirements: US-1.AC-6_${greenLine(a.green, "US-1.AC-6")}
- [ ] ${id()}. [US1] Enforce tenant isolation — every query scoped by tenant_id
  - _Requirements: US-1.AC-5_${greenLine(a.green, "US-1.AC-5")}
`;
      }
      if (a.track === "ai") {
        return `
## Story US-1 — AI
- [ ] ${id()}. [US1] Prompt v1 + eval harness wiring (separate task per prompt change)
  - _Requirements: US-1.AC-7, US-1.AC-8_
  - _Affects evals: golden, adversarial, regression_${greenLine(a.green, "US-1.AC-7", "US-1.AC-8")}
- [ ] ${id()}. [US1] Cost monitoring — emit cost metric + alert
  - _Requirements: US-1.AC-9_${greenLine(a.green, "US-1.AC-9")}
`;
      }
      if (a.track === "sec") {
        return `
## Story US-1 — Security
- [ ] ${id()}. [US1] Threat model the feature (STRIDE per trust boundary); record each mitigation in design.md
  - _Requirements: US-1.AC-10, US-1.AC-11, US-1.AC-12_
- [ ] ${id()}. [US1] Enforce authentication and object-level authorization on every endpoint (deny by default)
  - _Requirements: US-1.AC-10, US-1.AC-11_${greenLine(a.green, "US-1.AC-10", "US-1.AC-11")}
- [ ] ${id()}. [US1] Keep secrets out of code, responses and logs — secret store + log redaction
  - _Requirements: US-1.AC-12_${greenLine(a.green, "US-1.AC-12")}
- [ ] ${id()}. [US1] Security testing — SAST, dependency audit and the abuse-case tests, runnable locally
  - _Requirements: US-1.AC-10, US-1.AC-11, US-1.AC-12_
`;
      }
      if (a.track === "privacy") {
        return `
## Story US-1 — Privacy
- [ ] ${id()}. [US1] Personal data inventory + lawful basis per purpose in design.md; update the privacy notice
  - _Requirements: US-1.AC-13, US-1.AC-14, US-1.AC-15_
- [ ] ${id()}. [US1] Data subject requests — access/export and erasure end to end, across every store and processor
  - _Requirements: US-1.AC-13, US-1.AC-14_${greenLine(a.green, "US-1.AC-13", "US-1.AC-14")}
- [ ] ${id()}. [US1] Retention — scheduled deletion/anonymization of records past their retention period
  - _Requirements: US-1.AC-15_${greenLine(a.green, "US-1.AC-15")}
`;
      }
      if (a.track === "dist") {
        return `
## Story US-1 — Data Consistency
- [ ] ${id()}. [US1] Transactional outbox — write the outbox row in the same transaction as the state change; a relay (polling or CDC) publishes it and marks it sent
  - _Requirements: US-1.AC-16_${greenLine(a.green, "US-1.AC-16")}
- [ ] ${id()}. [US1] Idempotent consumer — an inbox / processed-message table keyed by the message ID, written in the same transaction as the effect
  - _Requirements: US-1.AC-17_${greenLine(a.green, "US-1.AC-17")}
- [ ] ${id()}. [US1] Concurrency control — a version column (optimistic locking) or a unique constraint; a conflict is an error, never a silent overwrite
  - _Requirements: US-1.AC-18_${greenLine(a.green, "US-1.AC-18")}
- [ ] ${id()}. [US1] Resilience — timeouts, retries with exponential backoff + jitter (never a non-idempotent call without a key), a DLQ, the degraded path when a dependency is down
  - _Requirements: US-1.AC-19_${greenLine(a.green, "US-1.AC-19")}
- [ ] ${id()}. [US1] Failure-injection tests — crash between the commit and the publish, duplicate delivery, concurrent updates, a dependency down — runnable locally
  - _Requirements: US-1.AC-16, US-1.AC-17, US-1.AC-18, US-1.AC-19_
`;
      }
      if (a.track === "api") {
        return `
## Story US-1 — API Contract
- [ ] ${id()}. [US1] Contract first — the OpenAPI document / .proto files / GraphQL schema in the repo, reviewed before the handlers (the file is this task's Implements marker)
  - _Requirements: US-1.AC-20, US-1.AC-21, US-1.AC-22, US-1.AC-23_
- [ ] ${id()}. [US1] Error model — every error an application/problem+json body with a stable code; a validation error names each field
  - _Requirements: US-1.AC-20_${greenLine(a.green, "US-1.AC-20")}
- [ ] ${id()}. [US1] Idempotency and concurrency — an Idempotency-Key on creates (the stored response replayed), ETag / If-Match on updates (412 on a stale version)
  - _Requirements: US-1.AC-21, US-1.AC-22_${greenLine(a.green, "US-1.AC-21", "US-1.AC-22")}
- [ ] ${id()}. [US1] Compatibility gate — a breaking-change diff of the contract against the published version, runnable locally; anything removed is deprecated with a Sunset date
  - _Requirements: US-1.AC-23_${greenLine(a.green, "US-1.AC-23")}
- [ ] ${id()}. [US1] Contract tests — the implementation checked against the contract (every documented status code, schema and header), runnable locally
  - _Requirements: US-1.AC-20, US-1.AC-21, US-1.AC-22, US-1.AC-23_
`;
      }
      if (a.track === "ui") {
        return `
## Story US-1 — User Interface
- [ ] ${id()}. [US1] Build the view from design-system components and tokens — a new component only through the system (documented, reviewed)
  - _Requirements: US-1.AC-24, US-1.AC-25, US-1.AC-26, US-1.AC-27_
- [ ] ${id()}. [US1] UI states — loading, empty, error with Retry, partial, offline, permission denied, success — per the state matrix in design.md
  - _Requirements: US-1.AC-26, US-1.AC-27_${greenLine(a.green, "US-1.AC-26", "US-1.AC-27")}
- [ ] ${id()}. [US1] Forms and keyboard — values kept on an error, errors in text with a summary, a logical focus order, a visible focus
  - _Requirements: US-1.AC-24, US-1.AC-25_${greenLine(a.green, "US-1.AC-24", "US-1.AC-25")}
- [ ] ${id()}. [US1] Accessibility checks — an automated check (axe or equivalent) runnable locally + a manual keyboard and screen-reader pass (findings in the report)
  - _Requirements: US-1.AC-24, US-1.AC-25_
- [ ] ${id()}. [US1] Responsiveness, i18n and the performance budget — the breakpoints, text expansion, RTL, locale formats; LCP / INP / CLS within budget
  - _Requirements: US-1.AC-24, US-1.AC-26, US-1.AC-27_
`;
      }
      if (a.track === "obs") {
        return `
## Story US-1 — Operability
- [ ] ${id()}. [US1] SLIs, SLOs and burn-rate alerts — defined in code / config next to the service, each alert linked to its runbook
  - _Requirements: US-1.AC-29_${greenLine(a.green, "US-1.AC-29")}
- [ ] ${id()}. [US1] Telemetry — the metrics, structured logs with the correlation ID (no personal data) and trace spans the design names
  - _Requirements: US-1.AC-28_${greenLine(a.green, "US-1.AC-28")}
  - _Emits metrics: requests_total, request_duration_seconds, errors_total_
- [ ] ${id()}. [US1] Rollout — a feature flag and a canary / progressive rollout gated on the SLO metrics; automatic rollback on the criteria in design.md
  - _Requirements: US-1.AC-30_${greenLine(a.green, "US-1.AC-30")}
- [ ] ${id()}. [US1] Health checks — liveness and readiness endpoints (a dependency down → not ready, still live); capacity signals with thresholds
  - _Requirements: US-1.AC-31_${greenLine(a.green, "US-1.AC-31")}
- [ ] ${id()}. [US1] Operability tests — fault injection (a dependency down, a slow dependency), an alert firing in a staged failure, a rollback drill — runnable locally or in staging
  - _Requirements: US-1.AC-28, US-1.AC-29, US-1.AC-30, US-1.AC-31_
`;
      }
      if (a.track === "data") {
        return `
## Story US-1 — Data Pipeline
- [ ] ${id()}. [US1] Data contract first — each dataset's schema (columns, types, nullability, keys), owner and compatibility rule in the repo, reviewed before the transformations
  - _Requirements: US-1.AC-35_${greenLine(a.green, "US-1.AC-35")}
- [ ] ${id()}. [US1] Data-quality checks — not-null, unique, accepted ranges, row counts and freshness at ingestion and before publishing; a failing row quarantined with its rule, never loaded
  - _Requirements: US-1.AC-32, US-1.AC-34_${greenLine(a.green, "US-1.AC-32", "US-1.AC-34")}
- [ ] ${id()}. [US1] Idempotent loads — each run replaces its partition (overwrite or MERGE on a key, never a blind append); late-arriving rows merged within the lookback window
  - _Requirements: US-1.AC-33_${greenLine(a.green, "US-1.AC-33")}
- [ ] ${id()}. [US1] Backfill — the procedure for a date range (parallelism, cost, a dry run), rehearsed on one partition and compared with a single run
  - _Requirements: US-1.AC-33_
- [ ] ${id()}. [US1] Lineage, ownership and retention — sources → transformations → consumers documented, an owner per dataset, the retention and partitioning from design.md applied
  - _Requirements: US-1.AC-32, US-1.AC-33, US-1.AC-34, US-1.AC-35_
`;
      }
      return "";
    },

    bugReport(a) {
      return `# Bug: ${a.name}

<!-- Bugfix flow (systematic debugging): reproduce → find the ROOT CAUSE with evidence → write the failing
     regression test → fix the cause, not the symptom → verify. spec_doctor fails until "Root Cause" is
     filled: no fix before the cause is known. -->

## Summary
${a.summary || "[one line: what is broken, for whom, since when]"}

## Reproduction
${a.reproduction || "> **TODO** — exact steps, input and environment that reproduce it every time."}

## Expected vs Actual
- **Expected:** ${a.behaviour || "[correct behavior]"}
- **Actual:** [what happens — error message, output, log lines]

## Root Cause
${a.rootCause || "> **TODO** — the cause, with evidence (stack trace, log, failing assertion, the change that introduced it). Not \"probably\"."}

## Fix
[What changes and why it removes the root cause — one fix, not a bundle.]

## Regression Test
- **T-01** — reproduces the bug: fails before the fix, passes after it.
`;
    },

    bugRequirements(a) {
      return `# Bugfix: ${a.name}

## Summary
${a.summary || "[one line: the bug being fixed]"}

## User Stories

### US-1 (P1 — fix): ${a.name}
**Independent Test:** regression test T-01 reproduces the bug before the fix and passes after it.

#### Acceptance Criteria (EARS)
1. **US-1.AC-1** — IF ${a.condition || "[the condition that triggers the bug]"} THEN THE SYSTEM SHALL ${a.behaviour || "[the correct behavior]"}
2. **US-1.AC-2** — THE SYSTEM SHALL keep [the neighbouring behavior that already worked] unchanged

## Success Criteria
- **SC-001** — the reproduction steps in bug.md no longer reproduce the bug.

## Edge Cases and Error Handling
- **EC-1** — [nearby inputs that must keep working]

## Out of Scope
- Unrelated refactors — file them as separate work.
`;
    },

    bugTestPlan(name) {
      return `# Test Plan: ${name}

<!-- Kind: example (one concrete input → expected output) or property (an invariant over generated inputs — e.g.
     "every input outside the bug's condition behaves as before" guards US-1.AC-2 well). Values stay example / property.
     Put the Test ID in the test's name (test("T-01 …"), def test_T01_…) so trace_check {code: true} finds it. -->

| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |
|---------|-------|------|-------------|-----------------|------|
| T-01 | [unit/integration] | example | regression — reproduces the bug (red before the fix) | US-1.AC-1, SC-001 | \`[path]\` |
| T-02 | [unit/integration] | example | neighbouring behavior still works | US-1.AC-2 | \`[path]\` |
`;
    },

    bugTasks(name) {
      // Every bugfix, any size: two tasks — the red regression test, then the fix. No "reproduce" / "root cause" tasks: the
      // requirements gate already needs bug.md → Reproduction (check `reproduction`) and the design gate its Root Cause
      // (`root-cause`), both before the tasks can be approved, so after the tasks approval the next task is the red test (they
      // were tasks 1–2 of every bugfix but an XS one — 1.21 F5 — and next_action named them for work already done and gated).
      // The execution gate (bugfixGate) still lets only task 1 through while Root Cause is empty. The iron law holds. A tasks.md
      // scaffolded with the four tasks stays as it is and valid (markdown.js LEGACY_BUG_STEPS; bugfixGate's root-cause task).
      return `# Tasks: ${name}

<!-- Bugfix order is fixed: reproduce → root cause → failing regression test → fix → verify. bug.md → Reproduction and
     Root Cause are written and approved first (the requirements and design gates): no fix before the Root Cause is
     filled with evidence.
     Task 1 is red by design (its test must FAIL): its _Verify:_ runs T-01 and _Expect: fail_ makes that failing run the
     proof (a passing run is refused). The must-pass suite belongs on the fix task (2).
     T-02 guards behavior that already works — green before and after the fix, so it is in no task's _Makes green:_. -->

## Global Constraints
- [exact values the fix must respect — versions, limits, formats]

## Phase: Fix
- [ ] 1. [US1] Write regression test T-01 and watch it fail for the right reason (paste the output); add guard test T-02 (it passes already)
  - _Requirements: US-1.AC-1_
  - _Verify: [command that runs T-01]_
  - _Expect: fail_
- [ ] 2. [US1] Fix the root cause — one change, not a bundle; guard test T-02 stays green
  - _Requirements: US-1.AC-1, US-1.AC-2_
  - _Makes green: T-01_
  - _Verify: [full test suite command]_
**Checkpoint:** the bug no longer reproduces and the full suite is green.
`;
    },

    testPlan(name, tracks, acs, size) {
      const rows = templateTestRows(tracks, (t, layer, kind, desc, ac, file) => `| ${t} | ${layer} | ${kind} | ${desc} | ${ac} | \`${file}\` |`,
        { integration: "integration", load: "load", behavior: "[behavior]", acSlot: "[the AC IDs this test covers]", recovery: "[error condition → recovery]", property: "[always-true property]",
          tenant: "tenant A never reads tenant B's records", latency: "P95 latency within the performance budget",
          golden: "golden set ≥ the quality threshold", injection: "adversarial: injected instructions are ignored", cost: "cost per request within budget",
          unauthenticated: "abuse case: an unauthenticated request gets 401 and no data", forbidden: "abuse case: user B never reads user A's resource (403 + audit event)",
          noSecrets: "no secret, token or stack trace in any response or log", exportData: "a subject's export holds all of their personal data, machine-readable",
          erasure: "after erasure no store still holds the subject's personal data", retention: "records past their retention period are deleted or anonymized",
          outboxCrash: "crash between the DB commit and the publish: the event is still delivered", duplicateDelivery: "the same message delivered twice (or N times) has exactly one effect",
          lostUpdate: "concurrent updates to the same record: no update is lost silently", dependencyDown: "a dependency down: degrade / retry with backoff, the critical path is not blocked",
          contract: "contract", problemJson: "contract test: a request missing a required field gets 400 problem+json naming it", idempotencyReplay: "a create replayed with the same Idempotency-Key has one effect and returns the first response",
          staleEtag: "an update with a stale If-Match gets 412 and changes nothing", breakingDiff: "breaking-change diff: the contract against the published version reports no breaking change",
          component: "component", visual: "visual", keyboardA11y: "keyboard-only walk-through + an automated accessibility check (axe): every action reachable, focus visible, no violation",
          formErrors: "a form with invalid fields: every value kept, each error named in text, focus on the summary", emptyState: "visual regression of the view's states: the empty state explains why and offers the next action",
          loadError: "a failed load: an error with Retry, the content already shown kept",
          telemetry: "every request emits the metric, a structured log line and a trace with one correlation ID; no personal data in the log",
          burnAlert: "a staged failure burns the error budget: the burn-rate alert fires and pages with the runbook link", rollbackDrill: "rollback drill: a canary whose error rate crosses the threshold stops the rollout and rolls back",
          readiness: "fault injection: a dependency down → readiness fails, liveness passes, recovery without a restart",
          dataQuality: "data-quality checks on fixture batches: a null key, a duplicate and an out-of-range row are quarantined with their rule, the valid rows load",
          idempotentRerun: "a partition re-run or backfilled twice leaves the same rows as one run — no duplicate, no gap",
          freshness: "a partition older than the freshness SLA: the freshness check fails and alerts the owner",
          schemaChange: "schema-change compatibility: an added optional column passes, a removed / renamed column or a narrowed type is rejected before the load" }, acs, size);
      return (
`# Test Plan: ${name}

## Strategy
- **Test runner:** []
- **Mocking approach:** []
- **Coverage target:** []
- **Critical paths requiring 100% branch coverage:** []

## Traceability Matrix

<!-- Kind — example: one concrete input → expected output; the default for event-driven criteria (WHEN …, IF … THEN).
     property: an invariant checked over many generated inputs (fast-check, Hypothesis, jqwik, gopter, FsCheck); use it
     for ubiquitous criteria (THE SYSTEM SHALL always …), WHILE (state-driven) criteria and any "never / for every" rule —
     tenant isolation, an encode → decode round-trip, totals that always balance. Values stay example / property.
     Put the Test ID in the test's name (test("T-01 …"), def test_T01_…) so trace_check {code: true} finds it. -->

| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |
|---------|-------|------|-------------|-----------------|------|
${rows}

## Coverage Check
Every AC must appear in at least one "Covers" cell. Gaps (with justification):
- [none]

## Test Data & Fixtures
- []

## Out of Scope for Testing
- []
`
      );
    },

    evalPlan(name) {
      return (
`# Eval Plan: ${name}

## Golden Set (50–200 items)
Representative inputs with expected-quality outputs / rubric. Covers typical queries, personas, lengths.

## Adversarial Set
Prompt injections, jailbreaks, out-of-scope requests (should refuse), unsafe-output elicitation, degenerate inputs.

## Regression Set
Every fixed production failure becomes a permanent eval case. Grows, never shrinks.

## Grading
- Method per set: exact match / schema validation / LLM-as-judge (with rubric) / human review.
- Grader prompts are versioned and tested.

## Quality Thresholds (ship criteria)
- Golden: ≥ [85]% good-or-excellent
- Adversarial safety: 100% refused (zero tolerance)
- Adversarial injection: ≥ [98]% ignored
- Regression: 100% maintained

## Baseline
Run golden through a minimal v1 prompt + planned model; record baseline score here before implementing.
- Baseline (date/score): [ ]
`
      );
    },

    loadTest(name) {
      return (
`# Load Test: ${name}

## Scenarios
- Steady state · Burst · Soak · Spike

## Budget (from design.md Performance Budget)
- P50/P95/P99 targets · throughput target · error-rate ceiling.

## Tooling
- k6 / Artillery script location: []

## Pass Criteria
Measured P50/P95/P99 ≤ budget at target throughput, error rate < [0.1]%.
`
      );
    },

    // 1.21 F5 — a change (kind "change", size xs): ONE file holds the whole plan — summary, 1–3 EARS criteria, the approach and
    // 1–3 tasks with _Verify:_. The engine reads it as the feature's requirements AND tasks (engine/files.js specAlias).
    change(a) {
      return `# Change: ${a.name}

## Summary
${a.summary || "[one line: what changes and why]"}

## Acceptance Criteria (EARS)
1. **US-1.AC-1** — WHEN [trigger] THE SYSTEM SHALL [behavior]

## Approach
[the change in one or two lines — what it touches and why that is all of it]

## Tasks
- [ ] 1. [US1] [the change]
  - _Requirements: US-1.AC-1_
  - _Verify: [command that proves it, e.g. npm test -- path/to/file.test.js]_

<!-- A change (size xs): 1–3 acceptance criteria and 1–3 tasks, core only — no classification, design, quickstart or
     checklist. Two approvals: the plan (this file — spec_approve {through: "tasks"}) and the execution sign-off. More
     criteria or tasks, or a track (+tdd, +sec …), make it a feature of size s: spec_create {size: "s"}. -->
`;
    },

    quickstart(name) {
      return (
`# Quickstart: ${name}

A human-runnable acceptance scenario — the manual smoke test that proves the feature works
end-to-end. Keep it concrete; anyone should be able to follow it.

## Preconditions
- [env / data / accounts needed]

## Steps (happy path — US-1 / P1)
1. [do this]
2. [then this]
3. **Expect:** [observable result tied to a Success Criterion, e.g. SC-001]

## Negative path
1. [trigger an error condition from an IF…THEN AC]
2. **Expect:** [graceful handling]

## Done when
- [ ] The happy path produces the expected result.
- [ ] The negative path is handled gracefully.
- [ ] Success Criteria (SC-…) are observably met.
`
      );
    },

    checklist(a) {
      const items = [
        "Requirements: every AC is testable, has a stable ID, no vague terms (run `ears`).",
        "Design: respects the project constitution (no principle violated).",
        "Design: at least one Mermaid diagram; security + error handling covered.",
        "Traceability: every AC maps to a task (run `trace`).",
      ];
      // 1.21 F5: a sized feature's section counts (a.sectionCounts — the size's tiers, the overlaps merged) and, with +obs on, the
      // +saas line without the telemetry +obs already checks (one line, not two). No size: the counts and lines as ever.
      const cnt = (t, n) => (a.sectionCounts && a.sectionCounts[t] != null ? a.sectionCounts[t] : n);
      if (a.tracks.includes("tdd")) items.push("TDD: all planned tests written and red for the right reason before code.", "TDD: test commits land before implementation commits.");
      if (a.tracks.includes("saas")) items.push("SaaS: " + cnt("saas", 5) + " mandatory design sections filled (no TODO).", "SaaS: tenant isolation enforced (`WHERE tenant_id = ?`).", a.size && a.tracks.includes("obs") ? "SaaS: load test meets budget (hot path)." : "SaaS: metrics/logs/alerts emitted; load test meets budget (hot path).");
      if (a.tracks.includes("ai")) items.push("AI: " + cnt("ai", 10) + " mandatory design sections filled (no TODO).", "AI: golden ≥ threshold, adversarial safety 100%, regression maintained.", "AI: prompts versioned in prompts/vN.md; cost within budget.");
      if (a.tracks.includes("sec")) items.push("SEC: " + cnt("sec", 5) + " mandatory design sections filled (no TODO) — threat model reviewed.", "SEC: authentication + object-level authorization enforced, deny by default; no secret in code or logs.", "SEC: SAST, dependency audit and abuse-case tests clean on a local run.");
      if (a.tracks.includes("privacy")) items.push("PRIVACY: " + cnt("privacy", 6) + " mandatory design sections filled (no TODO) — DPIA decision recorded.", "PRIVACY: access/export and erasure work end to end, across every store and processor.", "PRIVACY: retention job scheduled; privacy notice and records of processing updated.");
      if (a.tracks.includes("dist")) items.push("DIST: " + cnt("dist", 5) + " mandatory design sections filled (no TODO) — every cross-system write has its mitigation (outbox / inbox / saga) or an accepted risk.", "DIST: consumers idempotent (inbox or a unique key in the effect's transaction); retries with backoff + jitter and a DLQ; nothing non-idempotent retried blindly.", "DIST: failure-injection tests (crash between commit and publish, duplicate delivery, concurrent updates, dependency down) green on a local run.");
      if (a.tracks.includes("api")) items.push("API: " + cnt("api", 5) + " mandatory design sections filled (no TODO) — the contract file (OpenAPI / .proto / GraphQL schema) is in the repo and named by a task's Implements marker.", "API: errors are problem+json with stable codes; creates take an Idempotency-Key; updates honour If-Match; list endpoints page with a stable cursor.", "API: contract tests and the breaking-change diff against the published version green on a local run; anything removed is deprecated with a Sunset date.");
      if (a.tracks.includes("ui")) items.push("UI: " + cnt("ui", 5) + " mandatory design sections filled (no TODO) — every state of the state matrix designed; new components entered through the design system.", "UI: WCAG 2.2 AA — the automated accessibility check clean on a local run, plus a manual keyboard and screen-reader pass with its findings fixed.", "UI: responsive at every breakpoint, strings in the catalogue (text expansion, RTL checked); LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 measured.");
      if (a.tracks.includes("obs")) items.push("OBS: " + cnt("obs", 5) + " mandatory design sections filled (no TODO) — each SLO has an error budget, each alert a runbook, the rollback criteria are numbers.", "OBS: the metrics, structured logs (correlation ID, no personal data) and traces the design names are emitted — seen, not assumed.", "OBS: an alert fired in a staged failure, a rollback drill done and the health checks verified with a dependency down.");
      if (a.tracks.includes("data")) items.push("DATA: " + cnt("data", 5) + " mandatory design sections filled (no TODO) — every dataset has a schema, an owner and a compatibility rule; every check says what a failure does.", "DATA: the data-quality checks run at ingestion and before publishing — a bad row quarantined, never loaded; the freshness alert reaches the owner.", "DATA: a partition re-run and a backfill rehearsed on real-sized data give the same rows as one run; retention and partitioning applied as designed.");
      items.push("Doctor: `doctor` reports readyToAdvance before each gate.", "All phase gates approved (`approve`).");
      return "# Checklist: " + a.name + "\n\nTracks: " + a.label + ". Tick before calling the feature done.\n\n" +
        items.map((i) => "- [ ] " + i).join("\n") + "\n";
    },

    integrationPlan(name) {
      return (
`# Integration Plan: ${name}

## Integration Points
- [Existing components/modules this feature touches]

## Required Modifications
- [What must change in existing code, and why]

## Sequencing
- Phase 1: [e.g., DB migrations]
- Phase 2: [e.g., backend service]
- Phase 3: [e.g., wire UI]

## Risks & Mitigations
- [Risk]: [mitigation / rollback]

## Affected Files (best estimate)
- [path → change]
`
      );
    },

    promptStub(name) {
      return "# Prompt v1 — " + name + "\n\n## System\nYou are a helpful assistant for " + name + ". Be accurate and concise. If you don't know, say so. Refuse requests outside your task.\n\n## User Template\n[user message / {{variables}}]\n";
    },
  };

// ===========================================================================
// Steering stubs, one set per language. Filenames stay constant; content localized.
// ===========================================================================
const steering = {
    "constitution.md":
      "# Constitution\n\nNon-negotiable principles every feature must obey. Keep these few, concrete, and testable.\nThe `doctor` and `/prReview` check work against them; a design that violates a principle is blocked.\n\n## Principles\n1. [e.g., Every write is idempotent or explicitly justified.]\n2. [e.g., No PII in logs; user IDs are pseudonymized.]\n3. [e.g., No breaking API change without a versioned migration path.]\n4. [e.g., Errors fail closed (deny) on the security path.]\n5. [e.g., Search before you write: extend an existing module before adding a new one.]\n\n## Constraints\n- [Hard tech/regulatory constraints that bound all designs.]\n\n## Decision Rules\n- [How to break ties — e.g., 'prefer boring/proven over clever'.]\n",
    "product.md":
      "# Product\n\n## Vision\n[One sentence: what is this product and who is it for?]\n\n## Target Users\n- Primary: [who uses this daily?]\n- Secondary: [who else touches it?]\n\n## Success Metrics\n- [specific 6-month metric]\n\n## Non-goals\n- [what this is explicitly NOT]\n\n## Business Model\n[how it makes money]\n",
    "tech.md":
      "# Tech\n\n## Stack\n- Frontend: []\n- Backend: []\n- Database: []\n- Auth: []\n\n## Infrastructure\n- Hosting / Region / CDN: []\n\n## Conventions\n- Language / formatting / test runner / migrations / commit format: []\n\n## Constraints\n- Runtime version / browser support / accessibility / regulatory: []\n",
    "structure.md":
      "# Project Structure\n\n## Layout\n[directory tree]\n\n## Module Boundaries\n- What each module exposes and what it may import: [e.g., each feature exposes one entry point; features/* import lib/*, never each other; lib/* imports no feature; no cycles]\n\n## Shared Code\n- Where shared helpers and components live: [e.g., src/lib/ for helpers and clients, src/components/ for UI] — search there before adding one; code moves in on its second or third real use.\n\n## Naming\n- Files / components / API routes / DB tables / metrics: []\n\n## Commits\nConventional commits: `type(scope): description`. Types: feat|fix|refactor|test|docs|chore|style|perf\n\n## Branches & Reviews\n- main + feature/<name>; reviews required for merges to main.\n",
    "testing-standards.md":
      "# Testing Standards\n\n## Runner & Tooling\n- Unit/Integration: []\n- E2E: []\n- Mocking: []\n\n## Coverage Policy\n- Default target: []\n- Critical paths (auth/billing/data): 100% branch.\n\n## TDD Discipline\n- No implementation before a failing test exercising the real path.\n- 'Failing for the right reason' = assertion/NotImplemented, not import/syntax error.\n",
    "scale.md":
      "# Scale Targets\n\n## Load Targets\n| Horizon | Concurrent | DAU | MAU | Peak RPS | Data |\n|---|---|---|---|---|---|\n| Launch | | | | | |\n| 6 months | | | | | |\n| 2 years | | | | | |\n\n## SLA Targets\n| Endpoint class | P95 | P99 | Uptime |\n|---|---|---|---|\n| Critical journey | | | |\n\n## Critical User Journeys\n1. []\n\n## Escalation Thresholds\n- []\n",
    "observability.md":
      "# Observability Standards\n\n## Logging\nStructured JSON. Required fields: ts, level, service, trace_id, span_id, tenant_id?, user_id?, msg, event. No secrets/PII.\n\n## Metrics\nPrometheus-style snake_case + unit suffix. Per feature: request count, duration histogram, error count, one business counter. Beware label cardinality.\n\n## Traces\nOpenTelemetry, W3C context. Sample 10% in prod, always sample errors.\n\n## Alerts (each links a runbook)\n- P0 page now / P1 ≤15min / P2 slack / P3 digest.\n\n## SLOs & Error Budgets\n- Per critical journey: the SLI, the SLO target and its window · the error-budget policy (what stops when it is spent).\n- Burn-rate alerts: the fast ones page (e.g. 14.4× over 1 h, 6× over 6 h), the slow one (e.g. 1× over 3 days) opens a ticket.\n\n## Rollout & Rollback\n- Feature flags: an owner and a removal date each · canary / progressive steps and the metrics that gate them · rollback criteria and a target time.\n\n## Health & Capacity\n- Liveness checks the process only, readiness its dependencies · capacity signals (saturation, queue depth, pool usage) with thresholds.\n",
    "cost.md":
      "# Cost Budget\n\n## Infrastructure Budget\nTarget: < $XX/month year 1.\n\n## Cost Per User Target\nTarget: < $0.50 per MAU. If exceeded, stop and optimize.\n\n## Cost Alerts\n- Daily > $100 slack / > $200 page.\n\n## Per-Feature Cost Review\nEach design.md Cost Envelope estimates $/1000 users/month and flags cost-critical paths.\n",
    "ai-strategy.md":
      "# AI Strategy\n\n## Model Roster\n| Role | Model (pinned ID) | Why |\n|---|---|---|\n| Primary | | |\n| Fallback | | |\n| Judge/grader | | |\n\n## Provider & Data Posture\n- Provider / DPA status / does PII reach the model: []\n\n## Prompt Discipline\n- Prompts in .specs/<feature>/prompts/vN.md, versioned. No change ships without eval re-run.\n\n## Cost Envelope\n- Target $/user action / hard alert threshold: []\n\n## Safety Posture\n- Injection defense / moderation / refusal policy: []\n\n## Eval Bar (ship criteria)\n- Golden ≥85% good · Adversarial safety 100% refused · Regression 100% maintained.\n\n## Lifecycle\n- Pin policy / deprecation watch / eval-gated migration.\n",
    "security.md":
      "# Security Standards\n\n## Assurance Level\n- Target OWASP ASVS level: [L1 | L2 | L3] — why: []\n\n## Threat Modeling\n- Method: STRIDE per component and trust boundary, reviewed at every design change.\n- Where threat models live: each +sec feature's design.md → Threat Model.\n\n## Authentication & Authorization\n- Identity provider / session model: []\n- Authorization model (RBAC / ABAC / ownership checks), deny by default: []\n\n## Secrets & Cryptography\n- Secret store: [] — never in code, in committed config, in logs or in tickets.\n- Encryption at rest / in transit (TLS version, key rotation): []\n\n## Secure Coding Rules\n- Validate input at trust boundaries; encode output; parameterized queries only.\n- No secrets, tokens or stack traces in responses or logs.\n\n## Security Testing (local)\n- SAST: [] · dependency audit: [] · secret scan: [] · DAST (exposed services): []\n- Every material threat has an abuse-case test.\n\n## Vulnerability Handling\n- Fix deadlines per severity (critical / high / medium): [] · who triages: []\n",
    "privacy.md":
      "# Privacy Standards (GDPR)\n\n## Roles\n- Controller: [] · DPO / privacy contact: [] · supervisory authority: []\n\n## Principles (GDPR Art. 5)\n- Lawfulness, fairness and transparency · purpose limitation · data minimisation · accuracy · storage limitation · integrity and confidentiality · accountability.\n\n## Records of Processing (Art. 30)\n- Where the record of processing activities lives: []\n\n## Lawful Bases in Use (Art. 6)\n- [processing activity → lawful basis]\n\n## Retention Schedule\n| Data category | Retention period | Deletion method |\n|---|---|---|\n| | | |\n\n## Data Subject Requests\n- Channel · identity verification · one-month deadline (Art. 12(3)) · owner: []\n\n## Processors & Transfers\n- Approved processors (Art. 28 contracts): [] · transfers outside the EEA and their safeguard: []\n\n## Privacy by Design (Art. 25)\n- Defaults: collect the minimum, pseudonymize where possible, no personal data in logs.\n\n## Breach Response\n- Notify the supervisory authority within 72 hours (Art. 33) · runbook: []\n",
    // 1.17 D — +dist: the team's defaults for delivery, cross-system writes, idempotency, retries, locking and consistency.
    "distributed.md":
      "# Distributed Systems & Data Consistency Standards\n\n## Delivery Guarantee\n- Default: at-least-once — every consumer is idempotent. Exactly-once is an effect of idempotency, never a broker promise.\n- Ordering: per key (partition / message group) only where a feature says so: []\n\n## Cross-system Writes\n- A write that touches more than one system (DB + broker, DB + cache, DB + external API) goes through a transactional outbox (or CDC) — never \"commit, then publish\".\n- Business transactions across services: a saga with one compensation per step; orchestration or choreography: []\n\n## Idempotency\n- Idempotency key source (client header / message ID / natural key): [] · where processed keys live (inbox table / unique constraint) and for how long: []\n\n## Retry Policy (defaults)\n- Exponential backoff with jitter · max attempts: [] · per-call timeout: []\n- Never retried: a non-idempotent call without a key, a validation error (a 4xx — but 408 and 429 are retriable, honouring Retry-After) · poison messages → DLQ after [] attempts, with an alert.\n\n## Locking Policy\n- Default: optimistic locking (a version column); pessimistic (SELECT … FOR UPDATE) only for short, hot sections · lock timeout: []\n\n## Consistency Defaults\n- Default isolation level: [] · where eventual consistency is accepted and the maximum staleness: [] · read-your-writes for the user who wrote.\n\n## Observability\n- Outbox lag, consumer lag, DLQ depth and retry counts are metrics with alerts: []\n",
    // 1.19 T — +api: the team's defaults for the contract, versioning, errors, pagination, idempotency and limits.
    "api.md":
      "# API Standards\n\n## Style & Contract\n- Style: [REST | GraphQL | gRPC] · the contract lives in: [openapi.yaml | proto/ | schema.graphql] — written first, reviewed before the handlers.\n- Naming: plural nouns for collections · [snake_case | camelCase] fields · ISO 8601 UTC timestamps · IDs as strings.\n\n## Versioning & Compatibility\n- Strategy: [URL /v1 | header | date] · only additive changes within a version · a breaking change ships as a new version.\n- Deprecation: the Deprecation and Sunset headers, at least [6 months] of notice, a changelog entry, usage tracked per client.\n\n## Errors\n- application/problem+json (RFC 9457): type, title, status, detail, instance + a stable `code`; a validation error lists each field. No stack trace in a response.\n\n## Pagination, Idempotency & Concurrency\n- Cursor pagination (an opaque cursor, at most [100] items per page) · an Idempotency-Key on every non-idempotent create, kept for [24 h] · ETag / If-Match on updates (412 on a stale version).\n\n## Rate Limits\n- Per [API key | user | IP]: [N] requests per [window] · 429 with Retry-After and the RateLimit headers.\n\n## Checks (local)\n- Contract tests: [command] · breaking-change diff against the published contract: [command].\n",
    // 1.19 T — +ui: the team's defaults for the design system, the states, accessibility, responsiveness / i18n and the performance budget.
    "ui.md":
      "# UI Standards\n\n## Design System\n- Components: [library / Storybook URL] · tokens: [colour, spacing, type — where they live] · a new component enters the system first (documented, reviewed), never as a one-off.\n\n## States\n- Every view designs: loading · empty · error (with Retry) · partial · offline · permission denied · success.\n- Forms: inline errors + a summary, values kept on an error, the submit button never the only feedback.\n\n## Accessibility\n- Target: WCAG 2.2 AA · keyboard operable, visible focus · every control named · contrast 4.5:1 (text) / 3:1 (UI) · targets ≥ 24×24 px · prefers-reduced-motion honoured.\n- Checks: [axe / Lighthouse command] on every local run · a manual keyboard + screen-reader pass ([NVDA / VoiceOver]) per feature.\n\n## Responsiveness & i18n\n- Breakpoints: [360 / 768 / 1280 px] · text expansion +30–40 % · RTL: [yes / no] · dates, numbers and currency through the locale.\n\n## Performance Budget\n- Core Web Vitals (p75): LCP ≤ 2.5 s · INP ≤ 200 ms · CLS ≤ 0.1 · JS per route ≤ [170 KB gz] · measured by: [Lighthouse locally / RUM].\n",
    // 1.21 F4 — +data: the team's defaults for data contracts, quality checks, idempotent loads and backfills, lineage, retention and cost.
    "data.md":
      "# Data Pipeline Standards\n\n## Contracts & Schemas\n- Where schemas live: [dbt YAML | a schema registry | schemas/] · compatibility: additive changes only; a breaking change ships as a new version with [N weeks] of deprecation.\n- Naming: [snake_case] tables and columns · timestamps in UTC · the layers: [raw → staging → marts].\n\n## Data Quality\n- Every dataset: not-null and unique keys, accepted values and ranges, row-count anomaly checks · they run at ingestion and before publishing · a failure: [quarantine the rows | stop the load] and alert the owner.\n- Tool: [dbt tests | Great Expectations | SQL checks] · command: [command].\n\n## Idempotency & Backfills\n- Every job re-runnable for a partition: overwrite the partition or MERGE on a key — never a blind append · late-arriving data: a lookback window of [N days].\n- Backfills: a dry run first · at most [N] partitions in parallel · the cost estimated and approved by [role].\n\n## Lineage & Ownership\n- Every dataset has an owner and a freshness SLA · lineage lives in: [dbt docs | the data catalog] · consumers hear of a breaking change [N days] ahead.\n\n## Retention & Cost\n- Retention per layer: raw [N days] · curated [N months] — personal data per privacy.md · partitioned by [date], clustered by [key] · cost budget: [$ per month], with an alert at [N] %.\n",
    // 1.16 Q3 — the glossary (steering_scaffold glossary.md; init never creates it). `_Avoid:_` is English-stable in every language.
    "glossary.md":
      "# Glossary\n\n<!-- The product's ubiquitous language: one entry per domain term — the word the specs use, what it means here, and the\n     words NOT to use for it. spec_clarify asks about every avoided word found in a feature's requirements.md / design.md,\n     spec_doctor warns (check `glossary`) and spec_task_brief quotes the entries a task's criteria use.\n     One entry per line (keep the `_Avoid:_` marker in English), e.g.:\n     - **Customer** — a person or company with a signed contract. _Avoid: client, user_ -->\n\n- **[Term]** — [what it means in this product]. _Avoid: [word], [word]_\n",
  };

// The evals README is a single block per language (kept out of the per-language BUILD map
// because it carries no track logic).
const evalsReadme = "# Evals\n\n" +
    "Local, offline-friendly eval harness. Run from the project root:\n\n" +
    "```\nnode <plugin>/mcp/evals/run-evals.js <feature-slug>\n```\n\n" +
    "- Uses your own `ANTHROPIC_API_KEY` (env). No CI, no third party beyond your model provider.\n" +
    "- Without an API key (or with `--dry-run`) it validates the sets and prints the plan without calling a model.\n" +
    "- `--set-baseline` records the current scores as the baseline to compare future runs against.\n\n" +
    "Set files: `golden.json`, `adversarial.json`, optional `regression.json`.\n" +
    "Item shape: `{ id, input, expect: { type, value|rubric } }`. Grader types: contains | equals | regex | refuse | judge.\n" +
    "The system prompt is read from the latest `../prompts/vN.md` (its `## System` section).\n";

// ===========================================================================
// Human-readable tool messages (doctor / clarify / next-action / add-track /
// init notes / hook output). Functions so callers interpolate freely.
// ===========================================================================
const msg = {
    initNote: "Stubs are placeholders. The skill fills them with real content (see references/steering-templates.md).",
    createNote: (lang) => null, // EN feature: no extra note
    addTrackNote: (tr, slug) => `Added +${tr}. Fill the new design sections, then re-run /spec-doctor ${slug}.`,
    addTrackAlready: (tr) => `already on +${tr}`,
    notes: {
      scan: "Heuristic inventory only — the agent interprets this to infer steering/constitution and reverse-engineer specs.",
      coverage: "Heuristic, from declared intent: the share of code files (tests apart) named by an _Implements:_ marker of any feature, active or archived. A file counts as covered once a task claims it — keep _Implements:_ current.",
    },
    evidence: {
      failed: (n, code) => `Task ${n}: the verification failed (exit ${code}) — not marking it done.`,
      missing: (n, slug) => `Task ${n} has a _Verify:_ command but no evidence was recorded — pass the evidence (command, exit code, summary) or run: ${DEV_SPEC} done ${slug} ${n} --run`,
      ran: (cmd, code) => `ran: ${cmd} → exit ${code}`,
      failedTicked: (n, code) => `Task ${n} is already ticked, but its re-verification failed (exit ${code}) — recorded; it now counts as unverified until a passing run is recorded.`,
      badExit: (v) => `exitCode must be an integer (got '${v}').`,
      needsExit: "Evidence that names a command needs its exit code — or give only a summary for a manual check.",
    },
    finish: {
      ready: (slug) => `'${slug}' is ready to finish — confirm the checks below, then merge locally or keep the branch.`,
      notReady: (slug) => `'${slug}' is not ready to finish:`,
      doctor: (ids) => `doctor has blocking checks: ${ids}`,
      open: (list) => `open tasks: ${list}`,
      unverified: (list) => `tasks ticked without verification evidence: ${list}`,
      gates: (list) => `phases awaiting approval: ${list}`,
      noTasks: "no tasks yet — break the design into tasks first",
      checkSuite: "The FULL test suite is green on a fresh run (paste the command and its output).",
      checkLoad: "+saas: the load test meets the performance budget (load-test.md).",
      checkObs: "+saas: observability validated — metrics emitting, logs visible, alerts and dashboard in place.",
      checkCost: "+ai: real token cost is within ~20% of the design projection.",
      checkSafety: "+ai: full adversarial set run, 100% on safety-critical categories, ~20 outputs spot-checked by a human.",
      checkBug: "bugfix: the reproduction steps in bug.md no longer reproduce the bug.",
      prSummary: "## Summary",
      prAcs: "## Acceptance criteria",
      prTasks: "## Tasks",
      prTests: "## Tests",
      prChecks: "## Checks before merge",
      prSpec: "## Spec",
      prRootCause: "## Root cause",
      prFix: "## Fix",
      noEvidence: "no evidence recorded",
      changedByDate: (list, slug) => `judged by file date only (approved before content fingerprints — a clone or copy resets file dates, so this may be no edit at all): ${list} — re-review, then re-approve to track it by content (/approve ${slug} <phase>)`,
      untrackedApproval: (list, slug) => `approved before change tracking — nothing about the signed-off file was recorded, so an edit can't be detected: ${list} — re-approve to start tracking it (/approve ${slug} design)`,
    },
    // 1.21 F5 — right-sized rigor: feature sizes (spec_create {size}), the change kind (size xs, one change.md), the size's rules.
    sizes: {
      spikeNoSize: "A spike is timeboxed, not sized — create it without a size (its timebox bounds it).",
      changeSize: (size) => `kind "change" is size xs — for size ${size} create a feature: spec_create {kind: "feature", size: "${size}"}.`,
      changeTracks: (list) => `A change (size xs) is core-only — a track (${list}) makes it a feature of size s: spec_create {size: "s", tracks} (a short design with the tracks' sections, a task per criterion).`,
      changeNoTracks: (slug) => `'${slug}' is a change (size xs, core-only) — a track makes it a feature: create one of size s (spec_create {size: "s", tracks}) and archive this change (spec_feature {action: "archive"}).`,
      // 1.21 review C9 — spec_create on an EXISTING change named with tracks: nothing is added, never silently
      tracksIgnored: (list, slug) => `Tracks not added — ${list}: '${slug}' is a change (size xs, core-only); a track makes it a feature — create one of size s (spec_create {size: "s", tracks}) and archive this change (spec_feature {action: "archive"}).`,
      changeCreated: (slug) => `'${slug}' is a change (size xs): ONE file, .specs/${slug}/change.md — its summary, 1–3 EARS criteria, the approach and 1–3 tasks with _Verify:_. Fill it, then approve the plan in one call (spec_approve {name: "${slug}", through: "tasks"}); after the tasks, spec_finish and the execution sign-off.`,
      sizeKept: (kept, asked) => `This feature's size is ${kept} — kept it (asked for ${asked}): a size is chosen once, when the feature is created.`,
      noGate: (phase, slug) => `'${slug}' is a change: its only approvals are the plan (phase tasks — change.md) and the execution sign-off — there is no ${phase} phase to approve.`,
      scope: (acs, tasks, maxAcs, maxTasks, extra) => `a change is XS — 1–${maxAcs} acceptance criteria and 1–${maxTasks} tasks, core only; change.md has ${acs} criteria and ${tasks} task(s)${extra ? ` and the track(s) ${extra}` : ""} — create it as a feature of size s instead (spec_create {size: "s"}) and archive this change`,
      scopeOk: (acs, tasks) => `XS: ${acs} criteria, ${tasks} task(s)`,
      approvePlan: (slug) => `Review & approve the plan (change.md: its criteria, approach and tasks) — spec_approve {name: "${slug}", through: "tasks"} (/spec-ff ${slug}).`,
      // P3 — size XS / S: the whole plan filled, then ONE approval call (each gate still runs, in order)
      planFastForward: (slug, size, list) => `Size ${size}: fill the whole plan first — ${list} — then approve it in one call: spec_approve {name: "${slug}", through: "tasks"} (/spec-ff ${slug}; CLI: ${DEV_SPEC} approve ${slug} --through tasks). Each phase's gate still runs, in order; the first that refuses stops it and says why.`,
      // 1.21 review C3 — the Phase 4 tests gate (+tdd / +ai) needs work that comes AFTER the plan: the one call ends before it
      planFastForwardTests: (slug, size, list, through, what) => `Size ${size}: fill the whole plan first — ${list} — then approve it through ${through} in one call: spec_approve {name: "${slug}", through: "${through}"} (/spec-ff ${slug} ${through}; CLI: ${DEV_SPEC} approve ${slug} --through ${through}). Each phase's gate still runs, in order. Then Phase 4, whose gate needs work that comes after the plan: ${({ tdd: "write the failing tests", ai: "write the eval harness and the feature's own eval sets", both: "write the failing tests and the feature's own eval sets" })[what] || "write the failing tests"} (/writeTests ${slug}), approve tests (/approve ${slug} tests), then the tasks (/approve ${slug} tasks).`,
      templateApproved: (list) => `only the template's guidance left in: ${list} — the design was approved before 1.21's stricter rule, so this warns; its next approval asks for your own text there (or one line "n/a — <why it does not apply>")`,
      sectionsPassSized: (filled, covered, optional) => `filled: ${filled}` + (covered ? ` · covered by another track's section: ${covered}` : "") + (optional ? ` · optional at this size, left out: ${optional}` : ""),
      extendedComment: (marker, names) => `Size s: the other ${marker} sections — ${names} — are optional at this size. Add one when it applies (it must be filled then), or answer it in one line: "n/a — <why it does not apply>".`,
      coveredComment: (label) => `This section also answers ${label} — both tracks are on, so one section holds it (its own ${label} section counts too).`,
      // spec_classify's size suggestion (a reason code → the sentence)
      suggest: {
        "trivial-change": "Suggested size xs — a trivial change (a typo, a copy or config tweak, a one-line fix): a change, one change.md, two approvals.",
        "single-unit": "Suggested size s — one unit of work (one endpoint, screen, button, field…) with at most one track that has design sections: one story, the core-tier track sections, the plan approved in one call.",
        "several-tracks": "Suggested size l — three or more tracks with design sections: the full chain.",
        "public-api": "Suggested size l — a public API (outside consumers, a contract to keep): the full chain.",
        "cross-system": "Suggested size l — it crosses systems (+dist with another track, or several services): the full chain.",
        default: "Suggested size m — a feature with its full chain (the duplicate track sections merged).",
      },
      optionalMark: "optional at this size",
      coveredMark: "covered by another track",
      suggestTail: "Confirm it or pick another in Phase 0 — spec_create {size: xs | s | m | l}; no size keeps the pre-1.21 scaffold.",
    },
    kindKept: (kept, asked) => `'${kept}' is already the kind of this feature — kept it (asked for '${asked}'). Start a new one for a different kind.`,
    langKept: (kept, asked) => `This feature is already in '${kept}' — kept it (asked for '${asked}'). One feature, one language.`,
    // 1.23 review 5 — spec_create on an existing folder (a re-run) says so; a new feature whose slug an archived one holds too is noted.
    createExisted: (slug) => `'${slug}' already exists — nothing was re-created (its files were kept; a re-run only adds the tracks it lacks).`,
    createSummaryKept: "The summary given was not written: the feature's files already hold one.",
    createArchivedTwin: (slug) => `An archived feature is named '${slug}' too (.specs/_archive/${slug}) — to restore it later, rename one of them first.`,
    // 1.21 F3 — spec_create {kind: "bugfix"} prefill: reproduction · rootCause · condition · behaviour (the input names stay English).
    bugPrefill: {
      bugOnly: (key) => `${key} is a bugfix's input — pass kind: "bugfix" (it prefills bug.md and the regression criterion).`,
      // 1.21 review A8: the CLI names its flag (--root-cause, not the MCP key rootCause) and its own way to make a bugfix
      bugOnlyCli: (flag) => `${flag} is a bugfix's input — create it as a bugfix: ${DEV_SPEC} bugfix "<name>" ${flag} "…" (or --kind bugfix); it prefills bug.md and the regression criterion.`,
      oneLine: (key, max) => `${key} must be one line of at most ${max} characters (it goes into the EARS criterion).`,
      skipped: (list) => `Not prefilled — ${list}: the file already existed or came from a project template (create-only); write those texts into it yourself.`,
    },
    err: {
      noUsableName: (name) => `Feature name '${name}' has no usable characters (a-z, 0-9) for a folder name.`,
      reserved: (slug) => `'${slug}' is a reserved name — pick another feature name.`,
      reservedWin: (slug) => `'${slug}' is a reserved name on Windows — pick another feature name.`,
      notFound: (slug, root) => `Feature '${slug}' not found under ${root}`,
      archivedHint: (slug) => `— it is archived (.specs/_archive/${slug}): restore it first (${DEV_SPEC} feature restore ${slug}).`,
      invalidJson: (rel, detail) => `${rel} is not valid JSON (${detail}) — fix it by hand; refusing to overwrite it.`,
      tasksMissing: (slug) => `tasks.md not found for '${slug}'`,
      requirementsMissing: (slug) => `requirements.md not found for '${slug}'`,
      taskNotFound: (n, file = "tasks.md") => `Task ${n} not found in ${file}`,
      // review 5 (P3): a tasks.md whose bytes are not UTF-8 / UTF-16 text (Windows' ANSI code page) is never rewritten
      tasksNotText: (file = "tasks.md") => `${file} is not saved as UTF-8 (its accented letters are in another encoding — Windows' ANSI code page, what Windows PowerShell 5.1's Set-Content / Add-Content write): nothing was changed, so those letters stay intact. Save ${file} as UTF-8 (VS Code: "Reopen with Encoding" → Windows 1252, then "Save with Encoding" → UTF-8) and retry.`,
      featureBusy: (slug, rel) => `Another dev-spec process is updating '${slug}' right now (${rel || `.specs/${slug}/.lock`}) — nothing was changed; retry in a moment. If no other editor or dev-spec command is running, delete that file.`,
      roadmapBusy: "Another dev-spec process is updating .specs/roadmap.json right now (.specs/.roadmap.lock) — nothing was changed; retry in a moment. If no other editor or dev-spec command is running, delete that file.",
      folderInUse: (rel) => `The folder ${rel} is in use by another program (an editor, a file indexer or antivirus, a terminal opened inside it) — nothing was moved or deleted; close it and try again.`,
      lockStuck: (rel) => `A stale dev-spec lock (${rel}) could not be removed — the file (or a folder of that name) is held open by another program, read-only, or not a file. Nothing was changed. Delete ${rel} by hand (check its permissions), then retry.`,
      noText: "No text provided.",
      unknownPhase: (phase, known) => `Unknown phase '${phase}'. Known: ${known}`,
      alreadyArchived: (slug) => `'${slug}' is already archived (.specs/_archive/${slug}) — rename this feature first (${DEV_SPEC} feature rename ${slug} "<new name>"), then archive it.`,
      renameNeedsName: "rename needs a new name.",
      sameSlug: "New name is the same slug.",
      alreadyExists: (slug) => `'${slug}' already exists.`,
      renameArchived: (slug) => `'${slug}' is the name of an archived feature (.specs/_archive/${slug}) — pick another name (with one name, neither of them could be archived or restored).`,
      slugTaken: (slug, held, name) => `'${name}' reaches the folder .specs/${slug}/, which holds another feature ('${held}') — a folder name keeps the first 64 characters of the name. Nothing was changed: pass a shorter name that differs within them (to work on '${held}', name it '${slug}').`,
      badAction: "action must be one of: remove | archive | rename | restore | flow",
      badTrack: "track must be one of: tdd | saas | ai | sec | privacy | dist | api | ui | obs | data",
      cycle: (chain) => `Circular dependency: ${chain}`,
      nameRequired: "name required",
      noSpecs: (root) => `No .specs/ at ${root}`,
      notGenerated: (file) => `${file} exists and was not generated by dev-spec — left untouched.`,
      specsLinked: (rel) => `Refused to write into ${rel}: that folder is a link (a symbolic link, a junction) or resolves outside .specs/ — replace it with a plain folder, then retry. Nothing was written.`,
      // 1.24 r6 — the write gate (engine/files.js specsWriteGate): a FILE that is a link, a path of the wrong kind
      specsLinkedFile: (rel) => `Refused to write ${rel}: that file is a link (a symbolic link) or resolves outside .specs/ — replace it with a plain file, then retry. It was not written.`,
      specsNotFolder: (rel) => `${rel} is a file where dev-spec needs a folder — rename or move it, then retry. Nothing was written there.`,
      specsNotFile: (rel) => `${rel} is a folder where dev-spec writes a file — rename or move it, then retry. It was not written.`,
      roadmapNotWritten: (file, broken) => `${broken} ${file} was not regenerated — rendered from what roadmap.json still gives, it would lose the dependencies, backlog and milestones it can't read. Fix .specs/roadmap.json, then run ${DEV_SPEC} roadmap --write again.`,
      roadmapViewPartial: (broken) => `${broken} This view leaves out what it can't read (the dependencies, backlog and milestones) until it is fixed.`,
      unknownSteering: (file, known) => `Unknown steering file '${file}'. Known: ${known}`,
    },
    ears: {
      needsClar: "Unresolved [NEEDS CLARIFICATION] marker — resolve before design.",
      noModal: "Criterion has no modal verb (SHALL / DEVE / DEBE) — not a valid EARS statement.",
      noId: "Criterion has no stable ID (e.g., US-1.AC-1).",
      bareAcId: (id) => `'${id}' is not a stable ID trace_check reads — write US-<story>.AC-<n> (e.g., US-1.${id}).`,
      subAcId: (id) => `'${id}' is a sub-criterion ID, not one trace_check reads — give each criterion its own US-<story>.AC-<n> (one level: US-1.AC-1, US-1.AC-2 …).`,
      vague: (term) => `Vague term '${term}' — replace with a concrete, testable value.`,
      noKeyword: "No EARS keyword (WHEN/WHILE/IF/WHERE · QUANDO/ENQUANTO/SE/ONDE · CUANDO/MIENTRAS/SI/DONDE). OK for ubiquitous requirements; confirm intentional.",
    },
    classify: {
      conf: { high: "high", medium: "medium", none: "none" },
      core: "core: always on (every Spec-mode feature).",
      on: (t, conf, list, neg) => `+${t}: ON${conf ? ` [${conf} confidence]` : ""} — matched signals: ${list}.${neg ? ` (${neg} appeared negated.)` : ""}`,
      off: (t, neg) => `+${t}: off — ${neg ? `${neg} appeared negated.` : "no signals matched."}`,
      offWeak: (t, list, neg) => `+${t}: off — weak signal only (${list}), not enough on its own.${neg ? ` (${neg} appeared negated.)` : ""}`,
      substantial: "No track signals matched but the description is substantial — consider whether +tdd applies (correctness/edge cases).",
      weakOnly: (list) => `On from weak signals only — double-check: ${list}.`,
      possible: (t, sig) => `Possible +${t} — weak signal '${sig}' (needs corroboration; not auto-enabled).`,
      // (1.19 T) what an anchor names, per track — +dist's wording unchanged
      genericOnly: (t, list) => `Possible +${t} — only app-level words (${list}): none names ${({ api: "an API contract (a public API, OpenAPI / GraphQL / gRPC, a breaking change…)",
        ui: "a UI concern of its own (a design system, accessibility, a UI component, an empty or loading state…)", obs: "an operability concern (an SLO, alerting, on-call, a runbook, a rollout…)",
        data: "a data pipeline concern (a warehouse, an ETL / ELT job, data-quality checks, a backfill, lineage…)" })[t] ||
        "a second system (a broker, another service, a webhook…)"}; not auto-enabled.`,
      keptOff: (t, kw) => `+${t} kept off — '${kw}' appeared negated.`,
      onAlthough: (t, quoted, list) => `+${t} is ON although ${quoted} appeared negated — enabled by: ${list}. Confirm this is intentional.`,
      // 1.21 F2 — the project's signal overrides (.specs/classifier.json) and classify --explain
      overridesApplied: (list) => `This project's signal overrides changed the reading (.specs/classifier.json): ${list.map((o) => `'${o.word}' for +${o.track} → ${({ off: "no signal", weak: "a weak signal", strong: "a strong signal" })[o.effect]}`).join(", ")} — ${DEV_SPEC} signals list shows them all.`,
      overridesInvalid: (code, n) => `.specs/classifier.json ${code === "invalid-entries" ? `holds ${n} invalid entr${n === 1 ? "y" : "ies"} (ignored)` : `is ignored (${({ "invalid-json": "not valid JSON", "invalid-shape": "no \"signals\" list", "too-big": "too big", "not-a-file": "not a regular file", unreadable: "unreadable" })[code] || code})`} — ${DEV_SPEC} signals list says what to fix.`,
      explainHead: "Matched keywords (track · keyword · table tier → final tier):",
      explainNone: "No keyword matched.",
      explainMatch: (m) => `  +${m.track} '${m.keyword}'${m.text.toLowerCase() !== m.keyword.toLowerCase() ? ` ("${m.text}")` : ""} · ${m.base || "—"} → ${({ shadowed: "shadowed (inside a longer strong phrase)", none: "no signal (a cue)", unbacked: "context, not backed by another signal" })[m.tier] || m.tier}${m.cue ? " (a cue)" : ""}${m.override ? " (a project override)" : ""}${m.negated ? ` · negated (${({ before: "a negator before it", after: "a phrase after it", list: "a negated list" })[m.negation] || m.negation})` : ""}`,
      explainOverridesHead: (n, min) => `Project signal overrides (.specs/classifier.json — ${n}; a learned one applies after ${min} consistent corrections):`,
      explainOverride: (o, min) => `  +${o.track} '${o.word}' → ${o.effect} · ${o.origin === "set" ? "set by hand" : `learned, ${o.count} correction(s)`}${o.active ? "" : ` · pending (${o.count} of ${min})`}${o.applied ? " · applied here" : ""}`,
      explainNoOverrides: "Project signal overrides: none (.specs/classifier.json).",
    },
    // 1.21 F2 — spec_tracks {action: "signals"} / dev-spec signals, and what spec_create learns from a Phase 0 correction
    signals: {
      learnedPending: (t, w, e, n, min) => `Phase 0 correction recorded: '${w}' ${e === "off" ? `suggested +${t} and you left it off` : `was only a hint for +${t} and you added it`} (${n} of ${min} — after ${min} consistent corrections it ${e === "off" ? `no longer suggests +${t}` : `becomes ${({ weak: "a weak", strong: "a strong" })[e]} +${t} signal`} in this project; ${DEV_SPEC} signals list).`,
      learnedActive: (t, w, e, n) => `Learned from ${n} consistent Phase 0 corrections: '${w}' ${e === "off" ? `no longer suggests +${t}` : `is ${({ weak: "a weak", strong: "a strong" })[e]} +${t} signal`} in this project (.specs/classifier.json — undo: ${DEV_SPEC} signals forget ${t} "${w}").`,
      learnedDropped: (t, w, e) => `This Phase 0 choice contradicts the override '${w}' → ${e} for +${t}: dropped (.specs/classifier.json).`,
      learnFailed: (code) => `The Phase 0 correction was not recorded — ${code === "busy" ? ".specs/ is busy (another process holds its lock)" : `.specs/classifier.json can't be rewritten (${code}); ${DEV_SPEC} signals list says what to fix`}.`,
      capped: (max) => `.specs/classifier.json is full (${max} overrides, all of them applying) — forget one (${DEV_SPEC} signals forget <track> <word>) to record more.`,
      badOp: (op) => `Unknown signals operation '${op}' — one of: list, set, forget.`,
      needTrackWord: (op) => `signals ${op} needs a track and a word — ${DEV_SPEC} signals ${op} <track> <word>${op === "set" ? " off|weak|strong" : ""} (spec_tracks {action: "signals", op: "${op}", track, word${op === "set" ? ", effect" : ""}}).`,
      coreTrack: "core is always on — it has no signals to override.",
      badTrack: (t, list) => `No track '${t}' in this project — one of: ${list}.`,
      badWord: (w) => `'${w}' is not a signal word — letters and digits, with spaces, hyphens, apostrophes or dots inside, 2–60 characters (a literal word, never a pattern).`,
      badEffect: (e) => `Unknown effect '${e}' — one of: off (no signal), weak (an anchor: needs a second signal), strong (turns the track on alone).`,
      notFound: (t, w) => `No override '${w}' for +${t} in .specs/classifier.json — ${DEV_SPEC} signals list shows them.`,
      setDone: (t, w, e, prev) => `Set: '${w}' → ${e} for +${t} (${({ off: "no signal", weak: "a weak signal", strong: "a strong signal" })[e]}; applies from now on in this project)${prev ? ` — it was ${prev}` : ""}.`,
      forgotten: (t, w, e) => `Forgotten: '${w}' → ${e} for +${t} — the built-in signals apply again.`,
      listHead: (rel, n, active, min) => `${rel} — ${n} signal override(s), ${active} applying (a learned one applies after ${min} consistent Phase 0 corrections):`,
      listNone: (rel) => `No signal override (${rel}) — spec_create learns them from Phase 0 corrections; ${DEV_SPEC} signals set <track> <word> off|weak|strong sets one.`,
      listItem: (o, min) => `  +${o.track} '${o.word}' → ${o.effect} · ${o.origin === "set" ? "set by hand" : `learned, ${o.count} correction(s)`} · ${o.active ? "applies" : `pending (${o.count} of ${min})`}${o.unknownTrack ? " · no such track in this project now (unused)" : ""}${o.lastAt ? ` · ${o.lastAt.slice(0, 10)}` : ""}`,
      fileWarning: (rel, code, n) => `${rel} ${code === "invalid-entries" ? `holds ${n} invalid entr${n === 1 ? "y" : "ies"} — they are ignored, and the file is never rewritten until you fix or remove them by hand` : `is ignored and never rewritten — ${({ "invalid-json": "it is not valid JSON", "invalid-shape": "it holds no \"signals\" list", "too-big": "it is too big (64 KB at most)", "not-a-file": "it is not a regular file", unreadable: "it can't be read" })[code] || code}; fix it by hand or delete it`}.`,
      problem: (i, code) => `  entry ${i + 1}: ${({ "invalid-entry": "invalid (track, word, effect off|weak|strong, count ≥ 1, origin learned|set)", duplicate: "a duplicate of an earlier entry", "too-many": "beyond the 200-override bound" })[code] || code}`,
    },
    // (1.21 F5: template = only the scaffold's guidance left · na-short = an n/a without a reason of ≥ 4 words)
    sectionStatus: { missing: "missing", unfilled: "unfilled", template: "only the template's guidance", "na-short": "n/a without a reason (4+ words)" },
    sectionNames: {},
    precommit: {
      header: "dev-spec-driven pre-commit:",
      earsErrors: (f, n) => `✗ ${f}: ${n} EARS error(s)`,
      earsClean: (f, n) => `✓ ${f}: EARS clean (${n} criteria)`,
      earsWarnings: (f, n, w, p) => `⚠ ${f}: no EARS errors (${n} criteria), but ${[w ? `${w} warning(s)` : null, p ? `${p} template placeholder(s) left` : null].filter(Boolean).join(" and ")} — not blocking`,
      phantom: (f, n, list) => `✗ ${f}: ${n} phantom AC/test reference(s) — likely typos: ${list}`,
      uncovered: (f, n, list) => `⚠ ${f}: ${n} AC(s) not covered by a task (warning): ${list}`,
      unidentified: (f, n, list) => `⚠ ${f}: ${n} criteria with no US-<story>.AC-<n> ID — traceability counts none of them (warning): ${list}`,
      traceClean: (f, n) => `✓ ${f}: traceability clean (${n} ACs)`,
      blocked: (n) => `\nCommit blocked: ${n} blocking issue(s) in staged spec files. Fix or 'git commit --no-verify' to bypass.`,
    },
    doctor: {
      steeringMissing: (list) => `missing: ${list}`,
      steeringOk: "core steering present (incl. constitution)",
      requirementsMissing: "requirements.md missing",
      clarificationsOpen: (n) => `${n} unresolved [NEEDS CLARIFICATION] — resolve before design`,
      clarificationsOpenPlan: (n) => `${n} unresolved [NEEDS CLARIFICATION] in change.md — resolve before approving the plan`, // a change (1.21 verify V7)
      clarificationsOpenBug: (n) => `${n} unresolved [NEEDS CLARIFICATION] in bug.md — resolve them before approving its Reproduction / Root Cause`, // a bugfix (r5 review)
      clarificationsNone: "none open",
      scPresent: "present",
      scMissing: "no measurable SC-### success criteria",
      prioritiesOk: "user stories prioritized",
      prioritiesMissing: "no P1 (MVP) priority on a user story",
      acDup: (list) => `duplicate AC IDs: ${list}`,
      acUnique: "AC IDs unique",
      earsDetail: (n, e, w) => `criteria=${n}, errors=${e}, warnings=${w}`,
      earsNoCriteria: (ids, file = "requirements.md") => `${file} cites AC IDs (${ids}) but no criterion was linted — EARS checks an AC written as a list item, heading or line that starts with its ID, or as a table row under an Acceptance Criteria heading`,
      earsNoAcIds: (list, file = "requirements.md") => `${file} has criteria (${list}) with no AC ID trace_check reads — number each one US-<story>.AC-<n> (US-1.AC-1, US-1.AC-2 …); a bare AC-1 is not one`,
      designMissing: "design.md missing",
      mermaidOk: "has a diagram",
      mermaidMissing: "no mermaid diagram found",
      mermaidTemplate: "the mermaid diagram is still the template's (Component → Database) — draw this feature's architecture",
      constitutionOk: "present — verify each principle is checked",
      constitutionMissing: "no Constitution Check section in design",
      saasAllFilled: "all 5 filled",
      aiAllFilled: "all 10 filled",
      gatesPending: (list) => `awaiting human approval: ${list} — run /approve before advancing`,
      gatesOk: "all present phases approved",
      unverified: (list) => `ticked without verification evidence: ${list}`,
      verifiedOk: "every ticked task with a _Verify:_ command has evidence",
      rootCauseMissing: "bug.md → Root Cause not filled — no fix before the cause is known",
      rootCauseOk: "root cause documented",
      reproMissing: "bug.md → Reproduction not filled",
      reproOk: "reproduction documented",
    },
    next: {
      fixChecks: (ids, slug) => `Fix blocking checks (${ids}) — run /spec-doctor ${slug} for details.`,
      reReview: (files) => `Re-review: ${files} changed after the last approval — re-approve the affected phase.`,
      // 1.22 review: an approved artifact that was deleted — nothing to re-approve until it is back
      approvedMissing: (files, slug, phase) => `${files} was approved but no longer exists — restore it (it was deleted after its approval) or, if it is gone for good, withdraw that approval: /approve ${slug} ${phase} --revoke.`,
      // r5 review: .state.json doesn't parse / has the wrong shape (error: readState's localized message) — the one step
      stateInvalid: (error, slug) => `${error} Until it is repaired nothing can be approved, ticked or finished, and the approvals, ticks and evidence it holds can't be read — fix it by hand or restore it from git (conflict markers from a merge? resolve them; ${DEV_SPEC} merge-state --install merges it by meaning from then on), then /spec-doctor ${slug}.`,
      approveRequirements: (slug) => `Review & approve requirements — /approve ${slug} requirements.`,
      approveDesign: (slug) => `Review & approve design — /approve ${slug} design.`,
      approveTasks: (slug) => `Review & approve the task breakdown — /approve ${slug} tasks.`,
      approveTestPlan: (slug) => `Review & approve the test plan — /approve ${slug} test-plan.`,
      approveEvalPlan: (slug) => `Review & approve the eval plan — /approve ${slug} eval-plan.`,
      approveBugDesign: (slug) => `Review & approve bug.md (Reproduction + Root Cause — a bugfix's design) — /approve ${slug} design.`,
      // Phase 4 on a feature whose implementation already started (tasks ticked — e.g. a 1.12 feature, which had no tests gate):
      // writing failing tests first is no longer possible — the gate is a sign-off for the tests that exist.
      signOffTests: (slug, what) => `Phase 4 sign-off: the implementation has already started, so the tests are no longer written first — ${({ tdd: "check that every planned test exists with its T-ID in the test's name (test(\"T-01 …\")) so tests-in-code finds it", ai: `check that the eval set is the feature's own and record the baseline (/eval ${slug} --set-baseline)`, both: `check that every planned test exists with its T-ID in the test's name (test("T-01 …")) and that the eval set is the feature's own, and record the baseline (/eval ${slug} --set-baseline)` })[what]}. Then approve — /approve ${slug} tests.`,
      approveTests: (slug, what) => `Phase 4, the hard gate: ${({ tdd: "write every planned test and confirm each fails for the right reason", ai: "write the deterministic tests and the eval harness, and record the baseline", both: "write every planned test (each failing for the right reason) and the eval harness, and record the baseline" })[what]} — /writeTests ${slug}; no implementation code until then. Then approve — /approve ${slug} tests.`,
      implement: (n, text, slug) => `Implement task #${n}: ${text} — /executeTask ${slug}.`,
      allDone: (slug) => `All tasks done — close the feature with /spec-finish ${slug} (spec_finish): readiness report + merge summary. Optional, before it: /spec-simplify ${slug} — a behaviour-preserving cleanup of the feature's own code, proven by its tests.`,
      breakIntoTasks: (slug) => `Break the design into tasks — /createTask ${slug}.`,
      drifted: (slug, day, n, total, files) => `'${slug}' was finished on ${day}, but ${n} of ${total} implementing file(s) changed since: ${files} (${DEV_SPEC} drift ${slug}). Decide: the spec is now wrong → /spec-impact ${slug} (or a new feature with _Supersedes:_); the code is wrong → fix it (/spec-bugfix); harmless → re-run /spec-finish ${slug} for a fresh baseline.`,
      // signOff: null (signed off — nothing left), {} (no execution approval yet) or {at, why} (an execution approval exists
      // but predates a later change: re-confirm it — never "sign it off" as if there were none).
      // signOff.role (1.14, meta.approvalRoles.execution): the role to sign as; signOff.missing / signed: the roles still missing / signed.
      finished: (slug, day, total, signOff) => `'${slug}' is finished (${day}) — its ${total} implementing file(s) are unchanged since.` +
        (!signOff ? ` Nothing left to do here — /spec-drift ${slug} checks it after later changes.`
          : signOff.why ? ` Its execution sign-off (${signOff.at}) predates ${signOff.why} — re-confirm it: /approve ${slug} execution${signOff.role ? " --role " + signOff.role : ""}.`
            : ` Sign it off${signOff.missing ? ` — ${signOff.missing}${signOff.signed ? ` (signed: ${signOff.signed})` : ""}` : ""}: /approve ${slug} execution${signOff.role ? " --role " + signOff.role : ""}.`),
      // All tasks verified and finished, but a project check (meta.checks) has no passing run since the last task activity.
      verifySuite: (slug, list) => `'${slug}' is finished, but its project checks have no passing run since the last task activity: ${list} — /spec-finish refuses and the stop gate sends a "done" back until they pass. Run them and record the runs: ${DEV_SPEC} finish ${slug} --run (or spec_finish {evidence: [{name, command, exitCode}]}).`,
      // The unverified task's number is shared with another task: no run can be recorded for the second one — renumber.
      verifyDuplicate: (slug, list, n) => `All tasks are ticked, but not all are verified: ${list} — two tasks are numbered ${n}, so a run recorded for #${n} only ever reaches the first one (${DEV_SPEC} done ${slug} ${n} answers for it). Renumber the tasks in .specs/${slug}/tasks.md so each number is unique (doctor: duplicate-tasks), re-approve the tasks phase (/approve ${slug} tasks), then record each renumbered task's run.`,
      signOffWhy: { approvals: (list) => `the approval of ${list}`, changeRequests: (list) => `change request ${list}`, join: " and " },
      refinish: (slug, day, why) => `'${slug}' was finished on ${day}, but it changed since (${why}) and all its tasks are done — finish it again: /spec-finish ${slug} (spec_finish {write: true}) refreshes the readiness report, the merge summary and the drift baseline; then sign it off again: /approve ${slug} execution.`,
      driftedStale: (why) => `It also changed since that finish (${why}): whichever you decide, finish it again afterwards — /spec-finish (spec_finish {write: true}) records the new baseline.`,
      verify: (slug, list, n, runnable) => `All tasks are ticked, but not all are verified: ${list} — /spec-finish and the execution sign-off refuse until each has a passing run. ` +
        (runnable ? `Re-run task ${n}'s _Verify:_ command and record the result: ${DEV_SPEC} done ${slug} ${n} --run` : `Record a passing run for task ${n}: spec_complete_task {name: "${slug}", number: ${n}, evidence: {command, exitCode: 0}} (${DEV_SPEC} done ${slug} ${n} --cmd "<command>" --exit 0)`) +
        "; a failing run means the code needs fixing first.",
    },
    clarify: {
      resolveMarker: (mk) => "Resolve [NEEDS CLARIFICATION]: " + (mk || "(unspecified)"),
      addSuccessCriteria: "Add a Success Criteria section with measurable, technology-agnostic outcomes (SC-001 …).",
      idSuccessCriteria: "Give each success criterion a stable ID (SC-001 …) and a measurable target.",
      prioritize: "Prioritize the user stories (P1 = the MVP slice that delivers value alone; P2/P3 incremental).",
      independentTest: "State how each user story can be tested independently (so it's shippable on its own).",
      quantifyVague: (line, text) => `Quantify the vague term on line ${line}: ${text}`,
      edgeCases: "List the edge cases and error-handling behavior (each as an IF…THEN AC).",
      outOfScope: "State explicitly what is OUT of scope.",
      nfr: "Specify non-functional requirements (performance / security / accessibility) with measurable targets.",
      unwanted: "Add unwanted-behavior criteria (IF…THEN / SE…ENTÃO / SI…ENTONCES) for failure paths.",
      tenant: "Specify tenant isolation: tenant A must never read/write tenant B's data (write it as an AC).",
      rateLimit: "Specify rate limits (per-user / per-tenant / global).",
      aiQuality: "Specify output-quality target and refusal behavior for the AI path.",
      aiCost: "Specify a cost ceiling per request ($/tokens).",
      // 1.21 verify V6 — a change (one change.md) is asked only what its doctor checks
      changeSummary: "Write the change's Summary in change.md: what changes and why, in one line.",
      changeCriteria: "Write 1–3 EARS acceptance criteria in change.md (1. **US-1.AC-1** — WHEN … THE SYSTEM SHALL …).",
      changeApproach: "Write the Approach in change.md: what the change touches, and why that is all of it.",
      changeScope: (detail) => `Keep it a change, or make it a feature: ${detail}.`,
    },
    hook: {
      earsClean: (n) => `EARS check: ${n} criteria, all clean ✓`,
      earsIssues: (errs, warns, top, hasErr, file = "requirements.md") =>
        `EARS check on ${file} — ${errs} error(s), ${warns} warning(s):\n${top}` +
        (hasErr ? (file === "change.md" ? "\nFix the errors before approving the plan." : "\nFix the errors before advancing to design.") : ""),
      traceOk: (n) => `Traceability: all ${n} ACs covered by tasks ✓`,
      traceGaps: (feature, parts) => `Traceability gaps in ${feature}:\n  - ${parts}`,
      roadmapUpdated: (pct, complete, total) => `Roadmap updated → ${pct}% (${complete}/${total} features).`,
      sessionHeader: "dev-spec-driven — features in .specs/:",
      sessionLine: (name, tracks, phase, done, total) => `  • ${name} [${tracks}] — ${phase} (${done}/${total} tasks)`,
      sessionMore: (n) => `  … +${n} more feature(s) — /spec-status (or ${DEV_SPEC} list) lists them all`,
    },

    // Evidence gate (spec_complete_task / doctor / spec_finish). Reason codes stay English-stable.
    evidenceGate: {
      noContent: "Evidence needs a command (with its exit code) or a summary — an exit code alone proves nothing.",
      manualOnRunnable: (n, slug) => `Task ${n}: a note was recorded, but its _Verify:_ command was not run — it stays unverified until a passing run is recorded: ${DEV_SPEC} done ${slug} ${n} --run`,
      // A red-phase task (it writes a test that must FAIL) carrying a must-pass _Verify:_ can never be verified.
      redPhaseTestWord: "the test",
      redPhaseVerify: (n, slug, test) => `Task ${n} writes a test that must FAIL (the red phase), so a _Verify:_ that must pass can never pass on it. Mark task ${n} with _Expect: fail_ — a run that FAILS is then its proof (${test} fails before the fix) and a passing run is refused: ${DEV_SPEC} done ${slug} ${n} --run. Or move the command to the task that makes it green (the fix — its _Verify:_ then proves the fix).`,
      failedRun: (n, code, slug, runnable) => `Task ${n}: its latest recorded run failed (exit ${code}) — a note doesn't change that; it stays unverified until a passing run ` +
        (runnable ? `of its _Verify:_ command is recorded: ${DEV_SPEC} done ${slug} ${n} --run` : "(a command with exit code 0) is recorded."),
      duplicateNumber: (n) => `Task ${n}: another task also uses number ${n} and the recorded evidence is that task's — this one stays unverified; renumber the tasks, then record its own evidence.`,
      staleEvidence: (n, slug, runnable) => `Task ${n}: the recorded evidence is for another task or an earlier _Verify:_ command — it stays unverified until its own ` +
        (runnable ? `run is recorded: ${DEV_SPEC} done ${slug} ${n} --run` : "evidence is recorded."),
      reason: { "no-evidence": "no evidence", "failed-run": "latest run failed", "manual-note-on-runnable-verify": "note only, _Verify:_ command not run", "duplicate-number": "number shared with another task",
        "stale-evidence": "evidence is for another task or _Verify:_ command",
        "unexpected-pass": "run passed, but _Expect: fail_ needs a red run",
        unobserved: "run not observed by the harness", // 1.14 F1 (meta.evidence: observed)
        "command-mismatch": "the run recorded is not its _Verify:_ command" }, // 1.22 review
      // 1.22 review — the run recorded for a task is not a run of its _Verify:_ command(s): it ticks, but proves nothing.
      // review 2: several _Verify:_ commands → every one of them, in one run; a prefix the _Verify:_ holds is never dropped; an
      // _Expect: fail_ task: the red run BEFORE the fix lands (review 3: a red run of another command never counts — with the fix in,
      // it is set aside for the red run)
      commandMismatch: (n, slug, ran, verify, red) => `Task ${n}: the run recorded (\`${ran}\`) is not a run of its _Verify:_ command (${verify}) — it is ticked, but stays unverified until a ${red ? "FAILING " : ""}run of that command is recorded (the command as written — with several _Verify:_ commands, every one of them in ONE run joined with \` && \`; a \`cd <project root> &&\`, \`set -o pipefail;\` or VAR=value of your own in front is fine (a cd anywhere else is another run), but never drop one the _Verify:_ holds)` +
        (red ? ` — record it BEFORE the fix lands, while the test still fails: ${DEV_SPEC} done ${slug} ${n} --run (a red run of another command never counts; with the fix already in, set it aside — git stash push -- <the fix's files>, not a bare git stash: it would take tasks.md and .state.json too — for that run, then restore it).` : `: ${DEV_SPEC} done ${slug} ${n} --run`),
      duplicateTasks: (list) => `task numbers used more than once: ${list} — complete/brief pick the first open one; renumber them`,
    },
    // 1.14 F1 — harness-observed evidence (hooks/observe-hook.js; roadmap.json meta.evidence "reported" | "observed").
    observed: {
      on: "Evidence mode OBSERVED — a task whose _Verify:_ holds a command is verified only by a passing run the harness saw (in Claude Code the plugin's observe hook logs every Bash run of a _Verify:_ or project-check command) or that dev-spec done --run / finish --run made itself; a project check's run likewise (roadmap.json meta.evidence). An MCP-only client has no such hook: record its runs with " + DEV_SPEC + " done <feature> <n> --run.",
      off: "Evidence mode REPORTED — the runs an agent reports verify as given (roadmap.json meta.evidence); each record still says whether the harness observed it.",
      badValue: (v) => `--evidence takes reported or observed (got '${v}').`,
      badInput: (v) => `evidence must be "reported" or "observed" (got '${v}').`,
      unobservedRedNote: (n, slug) => `Task ${n} is marked _Expect: fail_: its proof is the RED run, and the harness never saw it — this project verifies only observed runs (roadmap.json meta.evidence: observed). Re-make the red run where it is observed: set the fix aside (git stash), run the _Verify:_ command with the Bash tool in Claude Code or with ${DEV_SPEC} done ${slug} ${n} --run (it must fail), then restore the fix and record its passing run.`,
      unobservedNote: (n, slug) => `Task ${n}: the run was recorded, but the harness never saw it — this project verifies a _Verify:_ command only by an observed run (roadmap.json meta.evidence: observed). Run the command with the Bash tool in Claude Code and record it again, or let the CLI run it: ${DEV_SPEC} done ${slug} ${n} --run`,
      neverObserved: "No run was ever observed in this project: only Claude Code with the dev-spec-driven plugin records them (hooks/observe-hook.js) — an MCP-only client has no hook, so record the runs with " + DEV_SPEC + " done <feature> <n> --run (or switch back: " + DEV_SPEC + " init --evidence reported).",
      naHint: "This project verifies only runs the harness saw (roadmap.json meta.evidence: observed): run the command with the Bash tool in Claude Code, or through the CLI (--run).",
    },
    // CLI `done` human output.
    taskDone: {
      done: (n, verified, done, total) => `Task ${n} done${verified ? " (verified)" : ""}. ${done}/${total}`,
      already: (n, verified, done, total) => `Task ${n} was already done${verified ? " (verified)" : ""}. ${done}/${total}`,
      next: (n, text) => `  next → #${n} ${text}`,
      allDone: "  — all done ✓",
      noRunnable: (n) => `task ${n} has no runnable _Verify: <command>_ marker`,
      shellHint: "Hint: the default Windows shell (cmd.exe) could not run this command line as written. If the _Verify:_ command is written for a POSIX shell, retry with --shell bash (or set DEV_SPEC_SHELL=bash).",
      posixOnWindows: (cmd, kinds) => `the _Verify:_ command \`${cmd}\` uses POSIX shell syntax (${kinds.map((k) => ({ "single-quotes": "single quotes '…'", variable: "$VARIABLES" })[k] || k).join(", ")}) that cmd.exe — the default shell of --run on Windows — reads differently, often without failing: it has no single quotes and never expands $VAR, so a broken check could be recorded as a passing run. Nothing was run; the task stays open. Re-run with --shell bash (Git Bash; or set DEV_SPEC_SHELL=bash), with --shell pwsh for a PowerShell command (or hand PowerShell the script in double quotes: pwsh -NoProfile -Command "…") — or --shell cmd to run it under cmd.exe anyway.`,
      pwshInPosix: (cmd, kinds, shell) => `the _Verify:_ command \`${cmd}\` hands PowerShell a script holding ${kinds.map((k) => ({ variable: "$VARIABLES", backtick: "backticks" })[k] || k).join(" and ")} outside single quotes, but a POSIX shell (${shell}) runs the line and expands them first — \`exit $LASTEXITCODE\` becomes a bare \`exit\` (exit 0), so a failing check could be recorded as passing. Nothing was run; the task stays open. For a POSIX shell put the script in single quotes (pwsh -NoProfile -Command '…; exit $LASTEXITCODE'), or run it with --shell pwsh (or DEV_SPEC_SHELL=pwsh) and write the bare PowerShell (_Verify: Invoke-Pester -Path tests -CI_).`,
    },

    tracks: {
      unknown: (items, valid) => `Unknown track${items.length > 1 ? "s" : ""}: ${items.map((u) => `'${u.token}'` + (u.suggestion ? ` (did you mean '${u.suggestion}'?)` : "")).join(", ")}. Valid tracks: ${valid}.`,
      cannotRemoveCore: "'core' is always on — it can't be removed.",
      bugfixNeedsTdd: "A bugfix is always test-first — +tdd can't be removed from it.",
      notActive: (list) => `Not active: ${list} — nothing to remove.`,
      removed: (list, slug) => `Removed ${list} from the active tracks. No file was deleted — the inactive artifacts stay in place and count again if you re-add the track. Re-run /spec-doctor ${slug}.`,
      // 1.21 review C7 — a sized design's section the removed track covered, written back (heading + TODO + guidance)
      restoredSections: (list) => `The removed track covered these sections of the remaining tracks — added back to design.md, to be filled: ${list}.`,
      addedOnCreate: (slug, list) => `'${slug}' already existed: added ${list} (artifacts, design sections, steering, tasks) — nothing was overwritten.`,
      designTitle: (name) => `# Design: ${name}`,
      acPlaceholder: (tr) => `[the +${tr} criterion this task proves]`,
      designSections: (marker) => `design.md (${marker} sections)`,
      // spec_add_track / spec_create `added` entries for files extended in place (a new file is listed by its path).
      addedDesign: "design.md (+sections)",
      addedTasks: "tasks.md (+tasks)",
      addedActiveTracks: "classification.md (Active Tracks)",
      taskBlock: (track, start) => BUILD.en.trackTasks({ track, start }),
    },

    // MCP argument validation (server.js): names the argument and the type its inputSchema expects.
    args: {
      missing: (list) => `Missing required argument(s): ${list}`,
      invalid: (list) => `Invalid argument(s): ${list}`,
      item: (arg, expected, got) => `${arg} must be ${expected} (got ${got})`,
      type: { string: "a string", integer: "an integer", number: "a number", boolean: "a boolean (true/false)", array: "an array", object: "an object", null: "null" },
      arrayOf: (t) => `an array (each item ${t})`,
      oneOf: (list) => `one of: ${list}`,
      atLeast: (n) => `≥ ${n}`,
      notObject: "arguments must be a JSON object.",
      dotdot: "projectDir must not contain '..' path segments.",
      network: (dir) => `projectDir must be a local folder — a network or device path (${dir}) is refused, so a tool call can never point this local server at another machine; open the project locally (or start the server with it as the working directory).`,
      // tools/call naming no tool of tools/list (JSON-RPC -32602 Invalid params) — 1.14 full review S2.
      unknownTool: (name) => `Unknown tool: ${name} — tools/list lists the tools this server provides.`,
      noTool: "tools/call needs params.name — the tool to call (tools/list lists them).",
      // 1.23: a tool that threw (a file system error…) — the JSON result {ok: false, error, code}, like every other refusal
      toolFailed: (why) => `The tool failed: ${why}`,
      // 1.23: an incoming line past the server's cap (JSON-RPC -32600, the line skipped, the server keeps running)
      tooLarge: (n, max) => `Invalid Request: a message of ${n}+ characters passes this server's limit of ${max} (DEV_SPEC_MCP_MAX_MESSAGE) — it was skipped.`,
    },
    // Valid JSON with the wrong shape (.specs/roadmap.json, .specs/<feature>/.state.json).
    jsonShape: {
      invalid: (rel, detail) => `${rel} has an unexpected shape (${detail}) — fix it by hand; refusing to overwrite it.`,
      topLevel: "the top level must be an object",
      features: "'features' must be an object",
      featureEntry: (k) => `features.${k} must be an object`,
      dependsOn: (k) => `features.${k}.dependsOn must be an array of feature names`,
      meta: "'meta' must be an object",
      backlog: "'backlog' must be an array",
      backlogEntry: "every 'backlog' entry must be an object with a 'name'",
      approvals: "'approvals' must be an object",
      evidence: "'evidence' must be an object",
      tracks: "'tracks' must be an array",
      approvalHistory: "'approvalHistory' must be an array",
      changes: "'changes' must be an array",
      finishChecks: "'finishChecks' must be an object",
      signoffs: "'signoffs' must be an object", // 1.14 B3 (role sign-offs)
      unticks: "'unticks' must be an array", // 1.16 U1 (undone ticks)
    },
    depend: {
      // 1.23 review 5 — ROADMAP.md / .html "Needs attention": a dependsOn naming no feature (a stale or hand-edited roadmap.json entry)
      roadmapStale: (feature, list, args) => `depends on ${list}, which is no feature (a stale or hand-edited .specs/roadmap.json entry) — set the list again without it: ${DEV_SPEC} depend ${feature} ${args}`,
      unknown: (list) => `Every dependency must be an existing feature — not found: ${list}`,
    },
    // mcp/evals/run-evals.js human output (in the feature's language).
    evals: {
      usage: "Usage: node run-evals.js <feature> [--dry-run] [--set-baseline] [--require-live] [--model=ID] [--project=DIR] [--max-items=N]",
      noEvalsDir: (slug, dir) => `No evals/ dir for '${slug}' at ${dir}`,
      requireLive: "eval harness: ANTHROPIC_API_KEY is not set and --require-live was given — refusing to fall back to a dry run.",
      // 1.23 review: a mistyped switch (--dryrun) or a stray word ran a LIVE, paid eval — refused before anything runs
      unknownFlag: (flag, suggestion) => `eval harness: unknown option ${flag}` + (suggestion ? ` — did you mean ${suggestion}?` : "") + " Nothing ran.",
      extraArg: (word) => `eval harness: unexpected argument '${word}' — one feature per run. Nothing ran.`,
      header: (slug) => `dev-spec-driven evals — feature '${slug}'`,
      config: (model, prompt, mode) => `  model: ${model}   prompt: ${prompt}   mode: ${mode}`,
      none: "(none)",
      modeDry: "DRY-RUN (no model calls)",
      modeLive: "LIVE",
      noKey: "  (no ANTHROPIC_API_KEY set — running dry. Set it to do a live run.)",
      badJson: (set, err) => `  ✗ ${set}.json — invalid JSON: ${err}`,
      badItems: (set) => `  ✗ ${set}.json — 'items' must be an array`,
      emptySet: (set) => `  ✗ ${set}.json — no items to grade: a set that grades nothing can't pass — add eval items (evals/README.md) or delete the file`,
      badItem: (set, label, why) => `  ✗ ${set}.json — item ${label}: ${why}`,
      moreBad: (n) => `      … +${n} more invalid item(s)`,
      itemWhy: {
        notObject: "not an object",
        noId: "no 'id' (a non-empty string)",
        noInput: "no 'input' (a non-empty string)",
        noExpect: "no 'expect' object",
        unknownType: (t, types) => `unknown grader type '${t}' (use ${types})`,
        noValue: (t) => `'${t}' needs a 'value'`,
        badRegex: (msg) => `the regex doesn't compile: ${msg}`,
        noRubric: "'judge' needs a 'rubric'",
      },
      badThresholds: (why) => `  ✗ thresholds.json — ${why}`,
      thresholdsShape: "must be an object giving each set (golden / adversarial / regression) a number between 0 and 1",
      capped: (set, max, total) => `  ⚠ ${set}: capped at ${max}/${total} items (raise with --max-items=N)`,
      wouldRun: (set, n, kinds) => `  • ${set}: ${n} item(s) — would run ${kinds}`,
      score: (ok, set, pass, n, pct, thr) => `  ${ok ? "✓" : "✗"} ${set}: ${pass}/${n} = ${pct}% (threshold ${thr}%)`,
      failure: (id, detail) => `      - ${id}: ${detail}`,
      error: (msg) => `ERROR ${msg}`,
      resp: (sample) => ` | resp: ${sample}`,
      fail: "fail",
      judge: "judge",
      judgeSkipped: "judge skipped (heuristic used)",
      unknownGrader: (t) => `unknown grader '${t}'`,
      vsBaseline: "\n  vs baseline:",
      delta: (set, base, cur, sign, pp) => `    ${set}: ${base}% → ${cur}% (${sign}${pp}pp)`,
      baselineWritten: (rel) => `\n  baseline written → ${rel}`,
      tokens: (i, o) => `\n  tokens: ${i} in / ${o} out`,
      dryInvalid: "\nDry run found invalid eval set(s) — fix them before a live run.",
      liveInvalid: "\nInvalid eval set(s) — fix them first; no model was called.",
      dryOk: "\nDry run complete — sets are valid. Set ANTHROPIC_API_KEY and re-run for live scores.",
      verdict: (below) => `\nVerdict: ${below ? "BELOW THRESHOLD ✗" : "all sets pass ✓"}`,
      crashed: (msg) => `eval harness error: ${msg}`,
    },

    // Every gap kind trace_check can report (CLI, hook and doctor list them all — none is dropped).
    traceGapText: {
      kinds: {
        uncoveredByTasks: "ACs with no task",
        phantomAcsInTasks: "tasks reference unknown ACs (typos?)",
        uncoveredByTests: "ACs with no planned test",
        phantomAcsInTests: "the test plan covers unknown ACs (typos?)",
        phantomTestsInTasks: "tasks reference unknown tests (typos?)",
        testsNotMappedToTasks: "planned tests that no task makes green",
        missingImplFiles: "_Implements:_ files that don't exist",
        unidentifiedCriteria: "criteria with no US-<story>.AC-<n> ID (traceability counts none)",
      },
      gap: (label, list) => `${label}: ${list}`,
      allCovered: (n) => `all ${n} ACs covered by tasks`,
      removedKinds: {
        phantomAcsInTasks: "tasks still cite ACs a change request removed (delete or update those tasks — not a typo)",
        phantomAcsInTests: "the test plan still covers ACs a change request removed (delete or update those rows — not a typo)",
      },
      removedRef: (id, n) => `${id} (change request #${n})`,
    },
    // detectPhase() tokens stay English in JSON; these are for human-readable lines only.
    phaseNames: {
      complete: "complete", executing: "executing", "tasks-ready": "tasks-ready", "eval-plan": "eval-plan", "test-plan": "test-plan",
      design: "design", requirements: "requirements", classified: "classified", empty: "empty",
    },
    featureOps: {
      removeNeedsConfirm: (slug, n) => `Removing '${slug}' permanently deletes .specs/${slug}/ (${n} file(s)). Nothing was deleted — pass confirm: true to delete it, or archive it instead (reversible).`,
      // 1.24 r6: a feature folder that is a link — remove deletes the link alone
      removeNeedsConfirmLink: (slug) => `.specs/${slug}/ is a link (a symbolic link, a junction): removing '${slug}' deletes only the link — the folder it points at and its files are kept. Nothing was deleted — pass confirm: true to remove the link.`,
      // 1.23: a remove the user confirmed over MCP whose folder is no longer the one they were shown (renamed into the name, edited)
      removeChangedSincePreview: (slug) => `Nothing deleted: .specs/${slug}/ changed after the user was asked to confirm its removal (another feature renamed into the name, or files edited while the question waited) — their confirmation covered the folder they were shown. Ask them again.`,
      backlogNotFound: (name, known) => `'${name}' is not in the backlog${known ? ` (backlog: ${known})` : " (the backlog is empty)"}.`,
      backlogIsFeature: (name, slug) => `'${name}' already has a spec (.specs/${slug}/) — the backlog is for features without one yet (status: ${DEV_SPEC} status ${slug}).`,
      // 1.19 R review 5: add of a name already in the backlog keeps its entry and appends the new note (exists: true, appended)
      backlogAppended: (name) => `'${name}' is already in the backlog — the new note was appended to its note.`,
      backlogKept: (name) => `'${name}' is already in the backlog with that note — nothing changed.`,
      backlogNoteFull: (name, max) => `'${name}' is already in the backlog and its note would pass ${max} characters — the new note was not added: file it under another name.`,
      // 1.19 verify 5: a NEW entry's note past the same cap
      backlogNoteLong: (name, max) => `The note for '${name}' passes ${max} characters — nothing was added to the backlog: shorten the note.`,
    },
    // CLI human output (--json output is the structured result, never localized).
    cliOutput: {
      words: {}, // verdict tokens shown as-is in English
      yes: "true", no: "false",
      tracks: (label, conf) => `Tracks: ${label}   confidence: ${conf}`,
      note: (n) => `\nNote: ${n}`,
      created: (dir, lang, files, kept) => `Created in ${dir} [${lang}]:\n  ${files}` + (kept ? `\n  (existing, kept: ${kept})` : ""),
      nothingNew: "(nothing new)",
      steeringCreated: (f) => `Created ${f}`,
      steeringExists: (f) => `Exists (left untouched) ${f}`,
      feature: (slug, label, lang) => `Feature '${slug}' [${label}] (${lang})`,
      noFeatures: (dir) => `No features under ${dir}`,
      listLine: (name, tracks, phase, done, total) => `  ${name.padEnd(28)} [${tracks}]  ${phase}  (${done}/${total} tasks)`,
      statusHead: (f, tracks, phase) => `Feature: ${f}  [${tracks}]  phase=${phase}`,
      statusTasks: (done, total, next) => `Tasks: ${done}/${total}` + (next ? `  next → ${next}` : ""),
      doctorHead: (f, tracks, verdict, ready) => `Doctor: ${f}  [${tracks}]  verdict=${verdict}  readyToAdvance=${ready}`,
      traceHead: (f, verdict, acs, covered) => `Trace: ${f}  verdict=${verdict}  ACs=${acs}  coveredByTasks=${covered}`,
      earsHead: (n, m, verdict) => `EARS: ${n} criteria, ${m} with modal, verdict=${verdict}`,
      next: (n, text, left, total) => `Next → #${n} ${text}  (${left}/${total} left)`,
      allDone: "All tasks done ✓",
      batch: (list) => `  parallel batch: ${list}`,
      mergeSummaryAt: (p) => `\nMerge summary → ${p}`,
      briefAt: (p, inline) => `Brief → ${p}` + (inline ? "  (inline only: +ai prompt task)" : ""),
      reportAt: (p) => `  report → ${p}`,
      ledgerAt: (p) => `  ledger → ${p}`,
      unresolved: (list) => `  ⚠ unresolved: ${list}`,
      approved: (phase, f) => `Approved '${phase}' for ${f} ✓`,
      backlogHead: (n) => `Backlog (${n}):`,
      backlogAdded: (name) => `✓ '${name}' added to the backlog`,
      backlogRemoved: (name) => `✓ '${name}' removed from the backlog`,
      wrote: (file, pct, c, t) => `✎ wrote ${file}` + (pct != null ? `  (${pct}%, ${c}/${t})` : ""),
      noRoadmapFeatures: (dir) => `No features yet under ${dir}`,
      roadmapHead: (pct, c, t, cycle) => `Roadmap — overall ${pct}%  (${c}/${t} complete)` + (cycle ? `  ⚠ CYCLE: ${cycle}` : ""),
      deps: (list, unmet) => `  deps: ${list}` + (unmet ? ` (unmet: ${unmet})` : ""),
      scanHead: (root, truncated) => `Scan of ${root}` + (truncated ? " (truncated at cap)" : ""),
      scanFiles: (n, stack) => `  files: ${n}  | stack: ${stack || "unknown"}`,
      scanDirs: (list) => `  top dirs: ${list}`,
      scanExt: (list) => `  by ext: ${list}`,
      scanEndpoints: (n, files) => `  endpoints: ${n} route(s) in ${files} file(s)`,
      coverage: (pct, d, t) => `Spec coverage: ${pct}%  (${d}/${t} code files named in _Implements:_)`,
      undocumented: (list) => `  uncovered folders: ${list}`,
      clarify: (f, tracks, verdict, n) => `Clarify: ${f}  [${tracks}]  → ${verdict} (${n} question(s))`,
      naHead: (f, tracks, phase, verdict, gatesOk) => `Feature: ${f}  [${tracks}]  phase=${phase}  verdict=${verdict}  gatesOk=${gatesOk}`,
      changed: (list) => `  ⚠ changed since last approval: ${list}`,
      renamed: (a, b) => `Renamed '${a}' → '${b}' ✓`,
      archived: (f, dest) => `Archived '${f}' → .specs/${dest} ✓`,
      removed: (f) => `Removed '${f}' ✓`,
      wouldRemove: (slug, dir, n, entries) => `Would permanently delete '${slug}': ${dir} (${n} file(s): ${entries})`,
      confirmHint: (slug) => `Nothing deleted. Re-run with --yes to confirm — or archive it instead: ${DEV_SPEC} feature archive ${slug}`,
      missingValue: (flag) => `missing value for --${flag}`,
      unknownFlag: (flag, suggestion) => `unknown option ${flag}` + (suggestion ? ` — did you mean ${suggestion}?` : ".") + " Run `" + DEV_SPEC + " help` for the options.",
      unknownRules: (tool, known) => `unknown tool '${tool}'. Known: ${known}`,
      bundleWrote: (file, n, kb) => `Wrote ${file} — the engine as one file (${n} modules, ${kb} KB).`,
      bundleUse: (custom) => `Set DEV_SPEC_BUNDLE=1${custom ? ` and DEV_SPEC_BUNDLE_PATH=${custom}` : ""} in the environment Claude Code / your MCP client starts with to load it. Rebuild after every plugin update: a stale bundle is ignored (the modules load).`,
      scaleSections: (list) => `Scale sections: ${list}`,
      aiSections: (list) => `AI sections: ${list}`,
      dependsOn: (f, deps, order, unknown) => `${f} depends on: ${deps || "(none)"}` + (order != null ? `  order=${order}` : "") + (unknown ? `  ⚠ unknown deps: ${unknown}` : ""),
      trackNow: (f, tracks) => `'${f}' now [${tracks}]`,
      usage: (syntax) => `usage: ${syntax}`,
      unknownCommand: (c) => `unknown command '${c}'. Run \`${DEV_SPEC} help\`.`,
      unknownClient: (c, known) => `unknown client '${c}'. Known: ${known}`,
      // 1.22 review: --json on a command that prints text only (help, rules, mcp-config, evals) — a usage error, never that text
      noJson: (c) => `--json is not available for '${c}': it prints text only. Run it without --json.`,
      // 1.23 review: each command takes its own options and arguments — one it doesn't read is an error, never silently ignored
      flagNotFor: (flag, c, list) => `${flag} is not an option of '${c}'` + (list ? ` (its options: ${list})` : " (it takes none)") + `. Run \`${DEV_SPEC} help\`.`,
      extraArgs: (c, extra) => `'${c}' got unexpected argument(s): ${extra}. Run \`${DEV_SPEC} help\` for its syntax.`,
      needsRun: (flag) => `${flag} only applies with --run (how the commands run) — add --run, or leave ${flag} out.`,
      runOrEvidence: "--run records the run it makes; --evidence / --exit / --cmd report a run made elsewhere — pass one or the other.",
      // 1.23 review: --project names an existing folder (init alone creates it)
      projectEmpty: "--project is empty — name the project folder, or leave --project out (the nearest folder above this one with a .specs/, else this one).",
      projectUnexpanded: (v) => `--project ${v} holds a variable that was never expanded — pass the folder itself.`,
      projectMissing: (dir) => `--project ${dir}: no such folder — check the path (only init creates a project folder).`,
      projectNotDir: (dir) => `--project ${dir} is a file, not a folder.`,
    },

    // Gates: template placeholders, the approve gate (+ force), finish blockers, the bugfix execution gate,
    // next_action's "fill <file>" step, clarify's grouped placeholder question and the requirements hook line.
    gates: {
      empty: "no content beyond headings",
      more: (n) => `+${n} more`,
      placeholdersNone: "no template placeholders left in the current phase",
      placeholdersFail: (list) => `template placeholders left in the current phase (or an earlier one): ${list}`,
      placeholdersLater: (list) => `later phases are still templates (not blocking yet): ${list}`,
      traceDeferred: (files) => `not traced yet — still a later phase's template: ${files} (its template references are no typos and don't block this phase); traced once written`,
      earsPlaceholder: (list) => `Criterion still holds template placeholder(s) ${list} — write the real trigger/behavior.`,
      constitutionUnfilled: "the Constitution Check section is missing or not filled in",
      checkLine: (id, detail) => `  ✗ ${id}${detail ? " — " + detail : ""}`,
      approveRefused: (phase, slug, ids, lines) => `Can't approve '${phase}' for '${slug}' — failing checks: ${ids}.\n${lines}\nFix them (details: /spec-doctor ${slug}), or pass force: true (CLI: --force) to record the approval anyway — it stays flagged as forced.`,
      approveNothing: (phase, slug, file) => `Nothing to approve: '${phase}' has no artifact in '${slug}' (${file} is missing, or its track is off) — not even with force.`,
      approveUnreadable: (phase, slug, file) => `Nothing to approve: ${file} in '${slug}' can't be read (a folder of that name, no permission, or another program holding it) — make it a readable file, then approve '${phase}'.`, // r5 review
      approveForced: (ids) => `Approved with force — the failing checks are recorded with the approval: ${ids}.`,
      phaseOrder: (list, slug, first) => `earlier phases are not approved yet: ${list} — approve them first, in order (/approve ${slug} ${first})`,
      forcedGates: (list) => `approved with force over failing checks: ${list}`,
      finishRootCause: "bug.md → Root Cause is not filled — no fix before the root cause is known",
      finishPlaceholders: (list) => `template placeholders left in the spec chain: ${list}`,
      finishChanged: (list) => `changed after their approval (re-review, then re-approve): ${list}`,
      bugGate: (n, first) => `Task ${n} can't be completed yet: bug.md → Root Cause is not filled. No fix before the root cause is written in bug.md — do task ${first} first (find the root cause with evidence and write it there).`,
      bugGateFirst: (n, first) => `Task ${n} can't be completed yet: bug.md → Root Cause is not filled and no task writes it — only task ${first} can be completed until the root cause is written in bug.md (no fix before the root cause).`,
      bugGateTicked: (n, rc) => `Task ${n} can't be completed yet: bug.md → Root Cause is still empty — task ${rc} is ticked, but its deliverable is that section. Write the root cause there, with its evidence (no fix before the root cause is written in bug.md).`,
      rootCauseTaskEmpty: (n) => `Task ${n} is ticked, but bug.md → Root Cause is still empty — write the root cause there, with its evidence: the tasks after it (the regression test, the fix) stay refused until it is written.`,
      fill: (file, what, hint) => `Fill ${file} — ${what}; then ${hint}.`,
      fillMissing: "it doesn't exist yet",
      fillEmpty: "it has no content beyond headings",
      fillPlaceholders: (n, first) => `${n} template placeholder(s) left (first: ${first})`,
      fillHint: {
        "classification.md": (slug) => `confirm the tracks and write the blast radius and compliance tags (/classify ${slug}), then /approve ${slug} classification`,
        "requirements.md": (slug) => `check it with /clarify ${slug} and ears_validate (${DEV_SPEC} ears ${slug})`,
        "bug.md": (slug) => `write the Reproduction and the Root Cause with evidence (/spec-doctor ${slug})`,
        "design.md": (slug) => `run /spec-doctor ${slug} (mandatory sections, Constitution Check)`,
        "test-plan.md": (slug) => `check the AC coverage with trace_check (${DEV_SPEC} trace ${slug})`,
        "eval-plan.md": (slug) => `set the thresholds and the baseline, then /spec-doctor ${slug}`,
        "tasks.md": (slug) => `break the design into real tasks (/createTask ${slug}), then trace_check`,
        "change.md": (slug) => `write its summary, 1–3 EARS criteria, the approach and 1–3 tasks each with a _Verify:_ command, then approve the plan in one call — spec_approve {name: "${slug}", through: "tasks"} (/spec-ff ${slug})`,
        default: (slug) => `/spec-doctor ${slug}`,
      },
      approveClassification: (slug) => `Confirm & approve the classification — /approve ${slug} classification.`,
      fixGate: (phase, list, slug) => `Before approving '${phase}', fix what the approve gate would refuse: ${list} — then /approve ${slug} ${phase}.`,
      gateWouldRefuse: (phase, ids) => `approving '${phase}' would be refused (${ids})`,
      noRealTasks: "only the scaffold's template tasks — break the design into at least one real task of your own",
      testsNotInCode: (list) => `planned tests no test file names yet: ${list} — write each failing test with its T-ID in the name (trace_check {code: true} finds them)`,
      // An executing/complete feature (tasks ticked — e.g. a 1.12 one): the code exists, so the tests are not written first
      // and not failing — the same sign-off wording as next_action's signOffTests.
      testsNotInCodeSignOff: (list) => `planned tests no test file names yet: ${list} — the implementation has already started: check that each one exists with its T-ID in the test's name (test("T-01 …")) so trace_check {code: true} finds it`,
      noPlannedTests: "test-plan.md lists no T-ID — plan the tests first",
      evalSetsSample: "evals/golden.json is still the scaffold's sample set — write this feature's golden cases, run the harness and record the baseline",
      evalSetsMissing: "evals/golden.json is missing or holds no eval items ({\"items\": […]}) — write this feature's golden set first",
      testsGateChecks: (ids) => `(the approve gate checks this: ${ids})`,
      // 1.22 review: a Phase 4 sign-off the plan outgrew (a T-ID planned since, a plan whose approval changed since) — pending again.
      testsStale: (day, missing, plans) => `The Phase 4 sign-off of ${day} no longer covers the plan (${[missing ? `planned since: ${missing}` : null, plans ? `approval changed since: ${plans}` : null].filter(Boolean).join("; ")}) — the tests phase is to be approved again.`,
      // 1.22 review: an approval the user confirmed over MCP whose content (or, forced, its failing checks) changed after the question.
      changedSincePreview: (phase, slug, grown) => (grown
        ? `Nothing recorded: since the user was asked to confirm '${phase}' of '${slug}', its gate fails more checks (${grown}) than the question named — ask them again.`
        : `Nothing recorded: '${phase}' of '${slug}' changed after the user was asked to confirm it — their confirmation covered the version they were shown. Ask them again, so they confirm what is there now.`),
      clarifyPlaceholders: (file, n, list) => `Replace the ${n} template placeholder(s)/TBD in ${file}: ${list}`,
      hookPlaceholders: (n, list, file = "requirements.md") => `Template placeholders: ${n} left in ${file} (${list}) — replace them before approving the ${file === "change.md" ? "plan" : "requirements"}.`,
    },

    // Brownfield depth: scan / coverage CLI lines and the integration-plan doctor check.
    brownfield: {
      notFolder: (p) => `${p} is not a folder (it doesn't exist, or it is a file) — nothing to scan; check the path.`,
      frameworks: (list) => `  frameworks: ${list}`,
      routeLine: (method, p, loc) => `    ${method.padEnd(7)} ${p}  (${loc})`,
      moreRoutes: (n) => `    … ${n} more (--json lists them, up to the cap)`,
      routesTruncated: (shown, total) => `Showing the first ${shown} of ${total} routes — the endpoint count covers all of them.`,
      readCapped: (n) => `Only the first ${n} code files were read (routes, env names, test hints) — those lists may be incomplete.`,
      tests: (n, fws) => `  tests: ${n} file(s) · frameworks: ${fws}`,
      entrypoints: (list) => `  entrypoints: ${list}`,
      env: (list, more) => `  env vars (names only): ${list}` + (more ? ` … +${more}` : ""),
      migrations: (n, dirs) => `  migrations/schema: ${n} file(s)` + (dirs ? ` — ${dirs}` : ""),
      none: "none",
      coverageTests: (n) => `  test files (reported apart, not counted): ${n}`,
      coverageFolder: (folder, covered, files, pct) => `  ${folder.padEnd(24)} ${String(covered + "/" + files).padStart(9)}  ${pct}%`,
      root: "(root)",
      coverageUnmatched: (list) => `  ⚠ _Implements:_ entries that name nothing on disk: ${list}`,
      coverageNonCode: (list) => `  · _Implements:_ entries naming tests or non-code files (not counted): ${list}`,
      integrationPlanPlaceholder: "integration-plan.md is still the template — fill in the integration points, modifications and risks before implementing",
      integrationPlanOk: "integration plan filled",
    },
    // spec_import (Kiro · spec-kit · OpenSpec → a new feature). Artifact text is in the feature's language; the
    // EARS tokens below are used in the language the imported scenario was written in.
    importSpec: {
      note: (tool, rel, date) => `> Imported from ${tool} \`${rel}\` on ${date}.`,
      unknownTool: (tool, known) => `Unknown spec format '${tool}'. Known: ${known}.`,
      pathRequired: "path required — the folder (or a file) of the spec to import.",
      outside: (p) => `'${p}' is outside the project — spec_import only reads inside the project directory.`,
      notFound: (p) => `'${p}' not found.`,
      nothing: (tool, p) => `No ${tool} spec files found in '${p}'.`,
      exists: (slug) => `Feature '${slug}' already exists — import never overwrites it. Pass another name.`,
      tooLarge: (rel, max) => `${rel} is over ${max} characters — too large to import whole (the part past the limit, a plan's steps included, would be lost). Split or shorten it, then import again; nothing was created.`,
      noUsableTitle: (title) => `The document's title '${title}' has no usable characters (a-z, 0-9) for a folder name — pass the feature's name (name; CLI: --name "<feature>").`,
      featureTitle: (name) => `# Feature: ${name}`,
      tasksTitle: (name) => `# Tasks: ${name}`,
      summary: "## Summary",
      summaryPlaceholder: "[1-2 sentences: what this does and why it matters]",
      stories: "## User Stories",
      story: (n, pri, title) => `### US-${n}${pri ? ` (${pri})` : ""}: ${title}`,
      criteria: "#### Acceptance Criteria (EARS)",
      functional: "## Functional Requirements",
      entities: "## Key Entities",
      success: "## Success Criteria",
      edge: "## Edge Cases & Error Handling",
      original: (tool, text) => `<!-- ${tool}: ${text} -->`,
      notEars: "[NEEDS CLARIFICATION: not an EARS statement yet — add its trigger (WHEN/IF) and the system's response]", // no modal verb here: the criterion must still fail EARS
      noCriteria: "[NEEDS CLARIFICATION: this story has no acceptance criteria]",
      optional: "(optional)",
      modified: "(modified)",
      importedNotes: "## Imported notes", // source text before any heading, carried verbatim
      otherTasks: "## Other tasks", // closes a parent task's phase heading when a stand-alone task follows it
      ears: { while: "WHILE", when: "WHEN", if: "IF", where: "WHERE", then: "THEN", shall: "THE SYSTEM SHALL", not: "NOT", ensure: "THE SYSTEM SHALL ensure that" },
      wNotEars: (ids) => `not converted to EARS (text kept, marked [NEEDS CLARIFICATION]): ${ids}`,
      wNoCriteria: (ids) => `stories without acceptance criteria: ${ids}`,
      wNoCriteriaAtAll: "the source holds no acceptance criteria — requirements.md defines no AC yet: write them before approving the requirements (a +tdd test plan gets one generic row until then)",
      wUnknownRef: (task, ref) => `task ${task}: _Requirements:_ reference '${ref}' matches no imported criterion — kept as written`,
      wUnknownRefLine: (line, ref) => `tasks.md line ${line}: _Requirements:_ reference '${ref}' matches no imported criterion — kept as written`,
      wCarried: (list) => `carried over verbatim, not mapped to stories or criteria (review them): ${list}`,
      wNoRefs: "the imported tasks carry no _Requirements:_ references — add them so trace_check can map every AC to a task",
      wNoTasks: "no tasks.md in the source — the scaffold's tasks.md was kept (its template _Requirements:_ / _Makes green:_ narrowed to the imported criteria)",
      taskAcPlaceholder: "[an imported criterion this task proves]", // a kept template task citing a criterion the import lacks
      taskTestPlaceholder: "[the planned test this task makes green]",
      wNoDesign: (file) => `no ${file} in the source — the scaffold's design.md was kept`,
      wNoRequirements: (file) => `no requirements found in ${file}`,
      wRemoved: (name) => `REMOVED requirement '${name}' was not imported`,
      wRenamed: (from, to) => `RENAMED requirement '${from}' → '${to}' (imported under the new name)`,
      wSkipped: (files) => `not imported (left in place): ${files}`,
      wUnreadable: (file) => `${file} points outside the project — skipped`,
      done: (tool, rel, slug, label, lang) => `Imported ${tool} ${rel} → feature '${slug}' [${label}] (${lang})`,
      mapping: (n, sample) => `  mapping: ${n} ID(s)` + (sample ? ` — ${sample}` : ""),
    },

    // spec_append_tasks / `dev-spec append-tasks` (converge). Markers, IDs and **Checkpoint:** stay English-stable.
    appendTasks: {
      heading: "Phase: Convergence",
      checkpoint: "the convergence tasks are done and verified — the spec and the code agree again.",
      noTasks: "Give at least one task: tasks = [{ text, requirements?, implements?, verify?, makesGreen?, expectFail?, size?, depends?, story?, parallel? }].",
      noText: (i) => `Task ${i}: text is required.`,
      badStory: (i, v) => `Task ${i}: story must be US<n> (e.g. US1) or shared (got '${v}').`,
      badPath: (i, p) => `Task ${i}: _Implements:_ paths must be relative to the project root, without '..' (got '${p}').`,
      badVerify: (i) => `Task ${i}: _Verify:_ must be a single-line command.`,
      placeholderVerify: (i, v) => `Task ${i}: '${v}' reads as a placeholder, not a command (a _Verify:_ in [brackets] is ignored) — give the real command (for a shell test, 'test …' instead of '[ … ]').`,
      unstorable: (i, marker) => `Task ${i}: its ${marker} would not read back from tasks.md as given — keep markers out of the task text, ',' and ';' out of paths, and '_ ' out of paths and commands.`,
      phantom: (list, file = "requirements.md") => `Unknown acceptance criteria (not in ${file}): ${list}. Nothing was written — fix the IDs or add the criteria first.`,
      badHeading: "heading must be one line of text.",
      constraintsHeading: (h) => `'${h}' holds the constraints every task respects, not tasks — pick a phase heading. Nothing was written.`,
      inactiveHeading: (h, track) => `'${h}' is the task section of the inactive ${track} track — re-add the track or pick another heading. Nothing was written.`,
      unsafe: (n) => `Couldn't append safely: ${n ? `task ${n} would not read back as written` : "existing tasks would change"} (an unclosed comment or code fence near the end of the phase?). Nothing was written.`,
      reapprove: (slug, file = "tasks.md") => `${file} changed after its approval — review the new tasks, then re-approve: /approve ${slug} tasks.`,
      appended: (heading, created, file = "tasks.md") => `Appended to ${file} → '${heading}'${created ? " (new phase)" : ""}:`,
      oneTaskPerCall: "append-tasks takes one --task per call — run it again for the next task (spec_append_tasks takes a list).",
      oneValue: (flag) => `append-tasks takes --${flag} once per call — ${flag === "verify" ? "join the checks into one command (a && b)" : "give a single value"}. Nothing was written.`,
      badSize: (i, v) => `Task ${i}: size must be one of XS, S, M, L, XL (got '${v}').`,
      badTestId: (i, v) => `Task ${i}: makesGreen takes planned test IDs (T-01, T-2 …) (got '${v}').`,
      phantomTests: (list) => `Unknown tests (not planned in test-plan.md): ${list}. Nothing was written — fix the T-IDs or plan the tests first.`,
      noTestPlan: (slug) => `makesGreen needs a test plan: .specs/${slug}/test-plan.md does not exist (add +tdd first). Nothing was written.`,
    },

    // 1.14 F3 — task dependencies (`_Depends: 3, 5_`, English-stable) and execution waves: doctor task-deps, the "no task can
    // start" note (next_task / next_action / brief / complete_task), the early-tick warning, the brief's section,
    // spec_append_tasks `depends`, the CLI's next --waves lines. Task numbers and #n stay as written.
    taskDeps: {
      doctorOk: (n) => `${n} task(s) declare _Depends:_ — each names an active task, no cycle`,
      doctorFail: (list) => `${list} — fix the _Depends:_ markers in tasks.md (numbers of tasks in the same tasks.md: \`_Depends: 3, 5_\`)`,
      invalid: (n, tok) => `task ${n}: _Depends:_ '${tok}' is not a task number`,
      phantom: (n, d) => `task ${n} depends on #${d}, which no active task carries`,
      self: (n) => `task ${n} depends on itself`,
      cycle: (list) => `tasks waiting on each other (a cycle): ${list}`,
      roadmapBlocked: (list) => `no open task can start (task dependencies): ${list}`,
      waitLine: (n, deps) => `#${n} waits on ${deps}`,
      blocked: (list, slug) => `No open task can start — each waits on a dependency that is not done: ${list}. A cycle or a _Depends:_ naming no task never clears: fix the _Depends:_ markers in .specs/${slug}/tasks.md (/spec-doctor ${slug} → task-deps).`,
      tickedEarly: (n, list) => `Task ${n} was ticked while its dependencies ${list} are still open — recorded as asked (a tick records what happened); check that it didn't need their work, or complete them next.`,
      briefHeading: "## Depends on",
      briefStatus: { done: "done", open: "open", missing: "no such task" },
      briefOpenNote: "⚠ Some of them are still open — this task was planned to start after them: report NEEDS_CONTEXT if it needs their output.",
      badDepends: (i, v) => `Task ${i}: depends takes task numbers (3 or #3) (got '${v}').`,
      selfDepends: (i, n) => `Task ${i} is numbered ${n} here and would depend on itself. Nothing was written.`,
      phantomDepends: (i, list, first, last) => `Task ${i}: depends names no task: ${list} — give the number of an active task, or of a task of this call (numbered ${first === last ? first : first + "–" + last} here). Nothing was written.`,
      cycleDepends: (list) => `The dependencies would form a cycle: ${list}. Nothing was written.`,
      cliWaves: (n) => `Waves (${n}):`,
      cliWave: (k, list) => `  ${k}. ${list}`,
      cliNoWave: "  (no open task can start)",
      cliCycles: (list) => `  ⚠ cycle: ${list}`,
      cliBlocked: (list) => `  ⚠ blocked: ${list}`,
      cliSkipped: (list) => `  waiting: ${list}`,
    },

    // Change requests: spec_impact (diff vs the approved snapshot, --reopen) + next_action / doctor hints. Phase tokens,
    // IDs and file names stay English-stable.
    impact: {
      badPhase: (p, known) => `Unknown phase '${p}' for spec_impact. Known: ${known}.`,
      reopenTasks: "reopen applies to requirements, design, test-plan and eval-plan — a change to tasks.md is reviewed and re-approved; it reopens nothing.",
      // 1.21 review C4 — a change: ONE approved artifact (change.md, its plan — phase tasks) holds its criteria and its tasks
      changePhase: (phase, slug) => `'${slug}' is a change: its criteria and its tasks are one file, change.md, approved as the plan (phase tasks) — there is no ${phase} phase. spec_impact {name: "${slug}"} (phase tasks, the default) diffs both: the criteria by ID, the tasks by number.`,
      // --phase test-plan: a REMOVED planned test — its tasks still name its T-ID in _Makes green:_.
      retireTests: {
        retireHint: (list, slug, phase, offer) => `Removed tests still made green by tasks — ${list}: don't redo those tasks; drop the T-ID from their _Makes green:_ or point it at the test that replaces it.` +
          (offer ? ` --reopen records the change request without unticking them (${DEV_SPEC} impact ${slug} --phase ${phase} --reopen).` : ""),
        retireNote: (list) => `Removed tests are not redone — still named in _Makes green:_: ${list}: drop the T-ID from those tasks, or point it at the test that replaces it.`,
        recordedRetire: (n, list, slug, phase) => `Change request #${n} recorded — nothing unticked: a removed test's tasks are not redone. Still named in _Makes green:_: ${list}: drop the T-ID from those tasks, or point it at the test that replaces it; then re-approve: /approve ${slug} ${phase}.`,
      },
      missing: (file, slug) => `${file} not found for '${slug}' — nothing to compare.`,
      neverApproved: (phase, slug) => `'${phase}' was never approved for '${slug}' — there is no approved version to compare with. Approve it first: /approve ${slug} ${phase}.`,
      fingerprintOnly: (phase, slug) => `This approval predates the change history: only its fingerprint was recorded, so what changed can't be listed. Re-approve to start the history: /approve ${slug} ${phase}.`,
      noFingerprint: (phase, slug) => `This approval predates content fingerprints: nothing about the approved version was recorded, so neither whether nor what it changed can be told (a file date is no evidence — a clone or copy resets it). Re-approve to start tracking it: /approve ${slug} ${phase}.`,
      reopenNeedsSnapshot: (phase) => `Nothing was reopened: without a snapshot of the approved '${phase}' the affected tasks can't be determined.`,
      nothingNew: "Nothing new since the last reopen against this approval — nothing was changed.",
      nothingToReopen: (changed) => (changed ? "Nothing to reopen: the edit changed no criterion or section (only text outside them) — nothing was changed."
        : "Nothing changed since the approval — nothing to reopen."),
      designFingerprintOnly: (slug) => `design.md changed since the approval too, but this approval kept no snapshot of it (only its fingerprint), so what changed there can't be listed. Re-approve to start its history: /approve ${slug} design.`,
      reopenDesignUnknown: "Nothing was reopened: design.md changed, but without a snapshot of it as approved the affected tasks can't be determined.",
      reopened: (list, slug, phase) => `Reopened ${list}: unticked, their evidence marked stale — redo them with fresh evidence, then re-approve: /approve ${slug} ${phase}.`,
      retireItem: (id, tasks, tests) => `${id} → ${[tasks.length ? "tasks " + tasks.join(", ") : "", tests.length ? "tests " + tests.join(", ") : ""].filter(Boolean).join(" · ")}`,
      retireHint: (list, slug, phase, offer) => `Removed criteria still cited — ${list}: don't redo those tasks; delete them (and the test rows) or point them at the criterion that replaces it.` +
        (offer ? ` --reopen records the change request without unticking them (${DEV_SPEC} impact ${slug} --phase ${phase} --reopen).` : ""),
      retireNote: (list) => `Removed criteria are not redone — still cited: ${list}: delete those tasks and test rows, or point them at the criterion that replaces it.`,
      recordedRetire: (n, list, slug, phase) => `Change request #${n} recorded — nothing unticked: a removed criterion's tasks are not redone. Still cited: ${list}: delete those tasks and test rows, or point them at the criterion that replaces it; then re-approve: /approve ${slug} ${phase}.`,
      recordedOnly: (n, slug, phase) => `Change request #${n} recorded — no done task was affected. Review it, then re-approve: /approve ${slug} ${phase}.`,
      reopenHint: (slug, phase) => `To untick the affected done tasks and mark their evidence stale: ${DEV_SPEC} impact ${slug} --phase ${phase} --reopen (spec_impact {reopen: true}).`,
      nextHint: (slug, phases) => `First see what the edit touches with spec_impact (${phases.map((p) => `${DEV_SPEC} impact ${slug} --phase ${p}`).join(" · ")}).`,
      doctorChanged: (list, slug, phases) => `changed after their approval: ${list} — see what the edit touches with spec_impact (${phases.map((p) => `${DEV_SPEC} impact ${slug} --phase ${p}`).join(" · ")}), then re-approve`,
      doctorChangedPlain: (list, slug) => `changed after their approval: ${list} — re-review, then re-approve (/approve ${slug} <phase>)`,
      staleNote: (n, slug, runnable) => `Task ${n}: its evidence predates a spec change (spec_impact reopened it) — it stays unverified until ` +
        (runnable ? `a new passing run is recorded: ${DEV_SPEC} done ${slug} ${n} --run` : "new evidence is recorded."),
      head: (slug, phase, date, snap) => `Impact: ${slug} · ${phase} — against the approval of ${date} (${snap})`,
      headFp: (slug, phase, changed) => `Impact: ${slug} · ${phase} — fingerprint only: ${changed ? "changed since the approval" : "unchanged since the approval"}`,
      headNone: (slug, phase, changed) => `Impact: ${slug} · ${phase} — no fingerprint recorded: ${changed ? "changed since the approval (a file added after it)" : "whether it changed can't be told"}`,
      noChanges: "no changes since the approval",
      noStructural: "edited, but no criterion, section or task changed (only text outside them)",
      affected: "Affected:",
      tasksLabel: "tasks",
      testsLabel: "tests",
      designLabel: "design",
      idsLabel: "IDs",
      none: "none",
      change: { added: "added", modified: "modified", removed: "removed" },
      verified: "verified",
      nothingToVerify: "nothing to verify (no _Verify:_ command, nothing recorded)",
      staleSpec: "the spec changed since this evidence; spec_impact reopened the task",
      uncovered: (list) => `new, no task cites them yet: ${list}`,
      // roles (1.14): the roles that haven't signed the changed content yet (meta.approvalRoles) — each signs again, the first named.
      reReview: (slug, phase, roles) => `review the change, then re-approve: /approve ${slug} ${phase}` + (roles && roles.length ? ` --role ${roles[0]} (each role signs the new content: ${roles.join(", ")})` : ""),
    },
    // spec_metrics + the retrospective (retro.md). Durations use the same units everywhere (m/h/d).
    metrics: {
      writeNeedsName: "write needs a feature name — the retrospective is per feature (spec_metrics {name, write: true} / " + DEV_SPEC + " metrics <feature> --write).",
      retroWritten: (p) => `Retrospective → ${p} (pre-filled with the metrics — the rest is yours to write).`,
      retroExists: (p) => `${p} already exists — left untouched (a retrospective is never overwritten).`,
      unknown: "unknown",
      source: { approval: "approximate: from the earliest approval", filesystem: "approximate: from the folder's date" },
      phase: { classification: "classification", requirements: "requirements", design: "design", "test-plan": "test plan", "eval-plan": "eval plan", tests: "tests", tasks: "tasks", execution: "execution", complete: "complete", finished: "finished" },
      head: (slug, tracks, created, approx) => `Metrics: ${slug} [${tracks}] — created ${created}${approx ? ` (${approx})` : ""}`,
      leadTimes: (list) => `  lead time from creation: ${list}`,
      noLeadTimes: "  lead time from creation: nothing approved yet",
      rework: (total, n, list, forced) => `  approvals: ${total} · rework: ${n}${list ? ` (${list})` : ""} · forced: ${forced}`,
      reworkUnknown: (forced) => `  rework: unknown (approvals made before the change history) · forced: ${forced}`,
      reworkPartial: (total, n, list, forced, legacy) => `  approvals: ${total} · rework: at least ${n}${list ? ` (${list})` : ""} · forced: ${forced} — rework unknown for ${legacy} (approved before the change history)`,
      changes: (n, reopened) => `  change requests: ${n} · reopened tasks: ${reopened}`,
      evidence: (rate, pass, runs) => `  evidence: ${rate}% of runs passing (${pass}/${runs})`,
      noRuns: "  evidence: no recorded runs",
      tasks: (done, total, clar) => `  tasks: ${done}/${total} · open clarification markers: ${clar}`,
      noFeatures: (dir) => `No features yet under ${dir}`,
      projectHead: (n) => `Metrics — ${n} feature(s)`,
      row: (created, complete, rework, forced, changes, pass, tasks) => [created ? `created ${created}` : null, `complete ${complete}`, `rework ${rework}`,
        `forced ${forced}`, `changes ${changes}`, `pass ${pass}`, tasks ? `tasks ${tasks}` : null].filter(Boolean).join(" · "),
      avg: "average",
      median: "median",
      medianLeads: (list) => `  median lead time: ${list}`,
      totals: (done, total, pass, runs, changes, reopened) => `  total: tasks ${done}/${total} · ${runs ? `evidence ${pass} of ${runs} run(s) passing` : "no recorded runs"} · change requests ${changes} · reopened tasks ${reopened}`,
      retroText: {
        title: (f) => `# Retrospective: ${f}`,
        intro: (date) => `> Generated by dev-spec on ${date} from .state.json, .history/ and the artifacts. The numbers are derived locally; the rest is yours to write. Nothing here is applied automatically.`,
        metrics: "## Metrics",
        header: "| Metric | Value |",
        created: "Created",
        approximate: "approximate",
        unknown: "unknown",
        lead: (ph) => `Lead time → ${ph}`,
        rework: "Rework (re-approvals)",
        reworkUnknown: "unknown — the approvals predate the change history",
        reworkPartial: (value, legacy) => `at least ${value} — unknown for ${legacy} (approved before the change history)`,
        forced: "Forced approvals",
        changes: "Change requests",
        reopened: (n) => `${n} task(s) reopened`,
        passRate: "Evidence pass rate",
        runs: (rate, pass, runs) => `${rate}% (${pass}/${runs} runs)`,
        noRuns: "no recorded runs",
        tasks: "Tasks",
        tasksValue: (done, total) => `${done}/${total} done`,
        clar: "Open clarification markers",
        well: "## What went well",
        hurt: "## What hurt",
        signals: (list) => `<!-- Signals from the metrics: ${list}. -->`,
        sigRework: (ph, n) => `'${ph}' approved ${n} time(s)`,
        sigForced: (n) => `${n} approval(s) forced over failing checks`,
        sigReopened: (n) => `${n} task(s) reopened by change requests`,
        sigPass: (rate) => `only ${rate}% of verification runs passed`,
        sigClar: (n) => `${n} clarification marker(s) still open`,
        amend: "## Proposed steering or constitution amendments",
        amendNote: "<!-- For human approval — never applied automatically. Name the file (.specs/steering/constitution.md, tech.md, …), the exact change and why. -->",
        followUps: "## Follow-ups",
        followUpsNote: "<!-- Candidate backlog items — add the ones you accept with spec_backlog (dev-spec backlog add \"<name>\" \"<note>\"). -->",
      },
      // The ONE retro layout; each language passes its own retroText (lazy MSG reference — MSG is complete at call time).
      buildRetro: (T, P, m, fmt) => {
        const lt = m.leadTime || {};
        const rows = [[T.created, m.createdAt ? m.createdAt.slice(0, 10) + (m.createdAtApproximate ? ` (${T.approximate})` : "") : T.unknown]];
        for (const ph of ["classification", "requirements", "design", "test-plan", "eval-plan", "tests", "tasks", "complete", "finished"]) {
          if (lt[ph]) rows.push([T.lead(P[ph] || ph), fmt.dur(lt[ph].hours) + (lt[ph].approximate ? ` (${T.approximate})` : "")]);
        }
        const by = m.reworkByPhase ? Object.entries(m.reworkByPhase).map(([ph, n]) => `${P[ph] || ph} ${n}`).join(", ") : "";
        const reworkValue = m.rework == null ? null : m.rework + (by ? ` (${by})` : "");
        rows.push([T.rework, reworkValue == null ? T.reworkUnknown
          : m.reworkLowerBound && Array.isArray(m.legacyPhases) ? T.reworkPartial(reworkValue, m.legacyPhases.map((ph) => P[ph] || ph).join(", ")) : reworkValue]);
        rows.push([T.forced, String(m.forcedApprovals)]);
        rows.push([T.changes, `${m.changeRequests} (${T.reopened(m.reopenedTasks)})`]);
        rows.push([T.passRate, m.evidence && m.evidence.runs ? T.runs(m.evidence.passRate, m.evidence.passing, m.evidence.runs) : T.noRuns]);
        rows.push([T.tasks, T.tasksValue(m.tasks.done, m.tasks.total)]);
        rows.push([T.clar, String(m.openClarifications)]);
        const sig = [];
        if (m.reworkByPhase) for (const [ph, n] of Object.entries(m.reworkByPhase)) sig.push(T.sigRework(P[ph] || ph, n + 1));
        if (m.forcedApprovals) sig.push(T.sigForced(m.forcedApprovals));
        if (m.reopenedTasks) sig.push(T.sigReopened(m.reopenedTasks));
        if (m.evidence && m.evidence.runs && m.evidence.passRate < 100) sig.push(T.sigPass(m.evidence.passRate));
        if (m.openClarifications) sig.push(T.sigClar(m.openClarifications));
        return [T.title(m.feature), "", T.intro(fmt.today), "", T.metrics, "", T.header, "|---|---|", ...rows.map(([k, v]) => `| ${k} | ${v} |`), "",
          T.well, "", "- ", "", T.hurt, "", ...(sig.length ? [T.signals(sig.join("; "))] : []), "- ", "", T.amend, "", T.amendNote, "- ", "",
          T.followUps, "", T.followUpsNote, "- ", ""].join("\n");
      },
      retro: (m, fmt) => MSG.en.metrics.buildRetro(MSG.en.metrics.retroText, MSG.en.metrics.phase, m, fmt),
    },

    // Deep traceability (trace_check warnings, doctor secondary-trace / tests-in-code, finish, hook). Never blocking.
    deepTrace: {
      kinds: {
        uncoveredEdgeCases: "edge cases (EC) that no task or test covers",
        uncoveredNfr: "non-functional requirements (NFR) that no task or test covers",
        uncoveredSuccessCriteria: "success criteria (SC) that no test or quickstart step checks",
        phantomSecondary: "tasks / test plan cite unknown EC/NFR/SC IDs (typos?)",
        plannedNotInCode: "planned tests that no test file names (put the T-ID in the test name)",
        inCodeNotInPlan: "T-IDs in test code that no feature's test plan lists",
        unresolvedImplGlobs: "_Implements:_ globs not fully resolved (the file walk stopped at its cap before a match — not counted as missing)",
      },
      secondaryOk: (n) => `all ${n} EC/NFR/SC IDs covered`,
      testsInCodeOk: (n) => `every planned T-ID made green by a done task is named in a test file (${n})`,
      testsInCodeMissing: (list) => `made green by done tasks, but no test file names them: ${list} — put the T-ID in a test's name (test("T-01 …"), def test_T01_…) in a test file (a tests/ folder, *.test.*, *_test.* …), in the file the plan's File column names when it names one; a check run outside test code (a load script, an eval set) names its non-code artifact in the File column instead (load-test.md, evals/golden.json) and is not expected in a test file`,
      truncated: "the test-file scan stopped at its cap — some files were not read",
      codeSummary: (found, planned, scanned, truncated, outside) => `  tests in code: ${found}/${planned} planned T-ID(s) named in ${scanned} test file(s)` + (outside ? ` · checked outside test code (the File column names a non-code artifact): ${outside}` : "") + (truncated ? " (scan truncated at its cap)" : ""),
      warningsHead: "Warnings (not blocking):",
    },

    // Living catalog (.specs/SPECS.md) chrome. IDs, `_Supersedes:_` and the AUTO-GENERATED marker stay English-stable.
    catalog: {
      title: (proj) => `Spec catalog — ${proj}`,
      autogen: "AUTO-GENERATED by dev-spec — do not edit by hand. Regenerate: spec_catalog {write: true} (dev-spec catalog --write).",
      intro: "What the system does today: every acceptance criterion, grouped by feature. A criterion replaced by a later feature that has shipped (_Supersedes:_) is struck through and names the criterion that replaces it; one a feature still in progress plans to replace is marked \"to be superseded\" and still counts.",
      totals: (f, acs, current, sup, pending) => `**${f} feature(s) · ${acs} acceptance criteria — ${current} current${pending ? ` (${pending} to be superseded)` : ""}, ${sup} superseded**`,
      status: { active: "in progress", complete: "complete", finished: "finished", archived: "archived" },
      finishedOn: (d) => `finished ${d}`,
      archivedOn: (d) => `archived ${d}`,
      supersededBy: (list) => `superseded by ${list}`,
      toBeSupersededBy: (list) => `to be superseded by ${list} (not shipped yet)`,
      supersedes: (list) => `supersedes ${list}`,
      template: "template — not written yet",
      noAcs: "No acceptance criteria yet.",
      noFeatures: "No features yet.",
      cliWrote: (file, f, acs, sup) => `✎ wrote ${file}  (${f} feature(s), ${acs} AC(s), ${sup} superseded)`,
    },
    // `_Supersedes:_` references trace_check can't resolve — warnings, never an AC gap (reason codes stay English).
    supersedes: {
      phantom: (ref, reason, by) => `_Supersedes:_ ${ref}${by ? ` (on ${by})` : ""} — ${reason}`,
      renamed: (list) => `_Supersedes:_ references to it now use the new name, in: ${list}`,
      reason: { "bad-ref": "not <feature>/US-n.AC-m", "unknown-feature": "no such feature (active or archived)", "unknown-ac": "that feature has no such AC", self: "a feature can't supersede its own AC", unterminated: "the marker is never closed — end it with an underscore: _Supersedes: <feature>/US-n.AC-m_" },
    },
    restore: {
      notArchived: (slug) => `Nothing is archived as '${slug}' (.specs/_archive/${slug}/ not found).`,
      activeExists: (slug) => `'${slug}' is already an active feature — rename it first (${DEV_SPEC} feature rename ${slug} "<new name>"), then restore the archived one.`,
      done: (slug) => `Restored '${slug}' from .specs/_archive/ ✓`,
      noRecord: "It was archived before archive recorded its roadmap entry — re-declare its dependencies with spec_depend if it had any.",
      skipDependsOn: (d, reason) => `its dependency '${d}' (${reason})`,
      skipDependent: (k, reason) => `'${k}', which depended on it (${reason})`,
      skipRecord: (field, reason) => `the archive record's ${field} (${reason})`,
      skipped: (list) => `Not restored: ${list}.`,
      reason: { gone: "no longer exists", archived: "archived too — restoring it puts the link back", cycle: "would close a dependency cycle", invalid: "unexpected shape — left out" },
      renamedRecords: (list) => `archive records updated to the new name (restore puts their dependencies back): ${list}`,
      prunedDependents: (list) => `its dependents' links to it left the roadmap: ${list} (recorded — restore puts them back)`,
      prunedIncomplete: (slug, pct, list) => `'${slug}' was not complete (${pct}%), yet ${list} depended on it: the roadmap no longer shows them blocked by it — restore it, or re-declare the dependency with spec_depend, if they still need that work`,
    },
    drift: {
      none: "No finished feature has a drift baseline yet — spec_finish {write: true} (" + DEV_SPEC + " finish <feature> --write) records one when a feature is ready to finish.",
      clean: (f, n, d, archived) => `  ✓ ${f}${archived ? " (archived)" : ""}: ${n} implementing file(s) unchanged since finish (${d})`,
      drifted: (f, n, total, d, archived) => `  ⚠ ${f}${archived ? " (archived)" : ""}: ${n} of ${total} implementing file(s) changed since finish (${d})`,
      changed: (list) => `      changed: ${list}`,
      missing: (list) => `      missing: ${list}`,
      nowPresent: (list) => `      now present (missing at finish): ${list}`,
      reopened: (list) => `  · reopened since finish (tasks open again — checked once finished again): ${list}`,
      unbaselined: (list) => `  · no finish baseline yet: ${list}`,
      stale: (f, d, why, archived) => `  ↻ ${f}${archived ? " (archived)" : ""}: changed since finish (${d}) — ${why}; its baseline no longer covers it: ${archived ? `restore it (${DEV_SPEC} feature restore ${f}), finish it again (${DEV_SPEC} finish ${f} --write), then archive it again` : `finish it again (${DEV_SPEC} finish ${f} --write)`}`,
      staleWhy: {
        changeRequests: (list) => `change request ${list}`,
        approvals: (list) => `re-approved: ${list}`,
        newFiles: (n, list) => `${n} implementing file(s) not in the baseline: ${list}`,
      },
      hookLine: (f, n) => `  ⚠ ${f}: ${n} implementing file(s) changed since finish — run ${DEV_SPEC} drift ${f}`,
      baselineRecorded: (n, missing) => `Drift baseline recorded: ${n} implementing file(s)${missing ? ` (${missing} missing)` : ""} — ${DEV_SPEC} drift shows what changes after this finish.`,
      baselineReplaced: (n, day, list) => `Replaced the baseline of ${day}, in which ${n} file(s) had drifted: ${list} — the new baseline accepts them as they are now.`,
    },

    // Guard mode (hooks/guard-hook.js, PreToolUse · spec_init {guard} · `dev-spec init --guard on|off`).
    guardMode: {
      ask: (pending, stale) => "dev-spec guard: no approved tasks cover code changes right now — approve a feature's tasks (spec_approve) or confirm to proceed." +
        (pending ? ` Features with tasks awaiting approval: ${pending}.` : "") +
        (stale ? ` Tasks changed after their approval (review, then re-approve the tasks phase): ${stale}.` : "") + " (Guard mode is on — " + DEV_SPEC + " init --guard off disables it.)",
      forced: (list) => `dev-spec guard: code changes are covered only by a FORCED tasks approval (${list}) — its checks were failing when it was approved.`,
      on: "Guard mode ON — Write/Edit on code files outside .specs/ asks for confirmation while no feature has approved, unfinished tasks (roadmap.json meta.guard). Test files are allowed while a feature's test plan is approved and the feature is unfinished (Phase 4 writes the failing tests before the tasks gate), and every code file while a spike is under way (its prototype).",
      off: "Guard mode OFF — code edits are not gated.",
      badValue: (v) => `--guard takes on, off or scope (got '${v}').`,
    },
    // 1.14 F2 — the human approval guard (hooks/approval-hook.js, PreToolUse · roadmap.json meta.approvalGuard off|ask|deny ·
    // spec_init {approvalGuard} · `dev-spec init --approval-guard`). `ask` is read by the USER (the permission prompt), `deny` by
    // the AGENT (+ `denyUser`, the line the user sees). The "dev-spec approval guard" prefix stays English, like "dev-spec guard".
    approvalGuard: {
      on: {
        ask: "Approval guard ASK — an agent's approval (spec_approve / dev-spec approve, a feature removal, lowering this guard) asks you first (roadmap.json meta.approvalGuard). Claude Code shows that prompt in auto mode too; only its bypass-permissions mode may skip it — 'deny' holds in every mode.",
        deny: "Approval guard DENY — an agent's approval (spec_approve / dev-spec approve, a feature removal, lowering this guard) is refused: you approve in your own terminal, or in Claude Code with the ! prefix (roadmap.json meta.approvalGuard).",
      },
      off: "Approval guard OFF — an agent's approval calls are not gated (roadmap.json meta.approvalGuard).",
      badValue: (v) => `--approval-guard takes off, ask or deny (got '${v}').`,
      action: (a) => {
        const f = a.feature || "?";
        if (a.kind === "remove") return `permanently delete the feature '${f}' (its .specs/ folder, approvals and history)`;
        // 1.23 review 5: a shell command the guard can't read — too long (a.length characters) or in a form it can't follow
        if (a.kind === "unreadable") {
          return a.why === "too-long" ? `run a shell command too long for the approval guard to read (${a.length} characters) that names dev-spec or .specs/`
            : "run a shell command that names the dev-spec CLI with an approval word in a form the approval guard can't read (an unknown launcher, a glob, a variable or a joined string)";
        }
        // guard-down: lowering this guard, or weakening what it stands for (a.setting — the spec_init / `init` setting, or a
        // shell write of roadmap.json)
        if (a.kind === "guard-down") {
          // 1.23 review 5: a hand edit with the Write / Edit tool
          if (a.setting === "roadmap" && a.source === "edit") return "edit .specs/roadmap.json by hand (it holds the approval guard and the project's gates)";
          if (a.setting === "state") return `edit the .state.json of '${f}' by hand — its approvals, evidence and history`;
          if (a.setting === "evidence") return "switch the evidence mode (meta.evidence) back to reported";
          if (a.setting === "stopCheck") return "turn off the end-of-turn evidence gate (meta.stopCheck)";
          if (a.setting === "guard") return a.from ? `lower the edit guard (meta.guard) from ${a.from} to ${a.to}` : `set the edit guard (meta.guard) to ${a.to}`;
          if (a.setting === "roles") {
            if (!a.to || !Object.keys(a.to).length) return "clear the approval roles (meta.approvalRoles)";
            return Array.isArray(a.removed) ? `drop required approval roles (${a.removed.join(", ")}) from meta.approvalRoles` : "replace the approval roles (meta.approvalRoles)";
          }
          if (a.setting === "check") return a.to == null ? `remove the project check '${a.name}' (meta.checks)` : `change the command of the project check '${a.name}' (meta.checks)`;
          if (a.setting === "roadmap") return "change .specs/roadmap.json from the shell — write, move or delete it (it holds the approval guard and the project's gates)";
          return `lower the approval guard from ${a.from} to ${a.to}`;
        }
        if (a.revoke) return `revoke the approval of the ${a.phase || "?"} phase of '${f}'` + (a.role ? ` as ${a.role}` : "") + (a.by ? ` in the name of '${a.by}'` : "");
        return (a.through ? `approve every phase of '${f}' through ${a.through}` : `approve the ${a.phase || "?"} phase of '${f}'`) +
          (a.role ? ` as ${a.role}` : "") + (a.by ? ` in the name of '${a.by}'` : "") +
          (a.force ? " — FORCED (--force)" : "");
      },
      ask: (list, force) => `dev-spec approval guard: the agent wants to ${list}.` + (force ? " ⚠ FORCE: the phase's checks are bypassed — a failing gate would be recorded as approved anyway." : "") +
        " Approvals are yours — allow this only if you approve it yourself. (meta.approvalGuard: ask — " + DEV_SPEC + " init --approval-guard deny refuses agent approvals outright.)",
      // command: the line the human runs, or null (a change with no dev-spec command — a shell write of roadmap.json)
      deny: (list, command) => `dev-spec approval guard: refused — approvals are the human's, and an agent may not ${list}. ` +
        (command ? `Stop and ask the user to run it themselves, in their own terminal or in Claude Code with the ! prefix (it runs as the user, not as your tool call): ${command}` : "Stop and ask the user to make that change themselves, in their own editor or terminal") +
        " — then wait for them. Do not retry it by another route (the MCP tool, the CLI, a script or an edit of .specs/ files). (meta.approvalGuard: deny.)",
      denyUser: (list, command) => `dev-spec approval guard refused an agent's request to ${list}.` + (command ? ` To approve it yourself: ${command}` : " Make that change yourself if you want it."),
      // 1.21 review A4 — the MCP server's refusal (a client outside Claude Code, without elicitation): the plain command, no `!`
      denyMcp: (list, command) => `dev-spec approval guard: refused — approvals are the human's, and an agent may not ${list}. ` +
        (command ? `Stop and ask the user to run it themselves, in their own terminal: ${command}` : "Stop and ask the user to make that change themselves, in their own editor or terminal") +
        " — then wait for them. Do not retry it by another route (the MCP tool, the CLI, a script or an edit of .specs/ files). (meta.approvalGuard: deny.)",
    },
    // 1.21 F1b — human approvals over MCP elicitation (mcp/server.js: spec_approve, spec_feature remove, spec_init lowering a guard,
    // while meta.approvalGuard is ask | deny and the MCP client can ask its user — elicitation/create). `message` and the field
    // titles are read by the USER (the client's dialog); the refusals by the AGENT. list = approvalGuard.action's text.
    elicit: {
      message: (list, details) => `dev-spec: an agent asks to ${list}.` + (details ? " " + details : "") + " Approvals are yours — tick Approve only if you approve it yourself.",
      gatePasses: "The phase's checks pass.",
      forced: (ids) => `⚠ FORCED: the phase's checks fail (${ids}) — it would be recorded as approved anyway.`,
      waiver: (reason, expires) => "Waiver: " + [reason ? `"${reason}"` : null, expires ? `until ${expires}` : null].filter(Boolean).join(" ") + ".",
      phases: (list) => `Phases to approve, in order: ${list}.`,
      approveTitle: "Approve",
      approveDesc: "Tick it to record this; leave it unticked (or decline) to refuse.",
      noteTitle: "Note",
      noteDesc: "Optional — recorded with the approval (one line).",
      declined: (list) => `The user declined in the MCP client: nothing recorded (${list}). Do not retry it another way — ask the user what should change.`,
      // 1.21 review A6: action "accept" without approve: true — the user answered, but did not tick Approve
      unapproved: (list) => `The user answered in the MCP client without ticking Approve: nothing recorded (${list}). Do not retry it another way — ask the user whether they approve it.`,
      cancelled: (list) => `The user dismissed the confirmation: nothing recorded (${list}). Ask the user before trying again.`,
      timedOut: (s, list) => `No answer from the user within ${s} s: nothing recorded (${list}). Ask the user to approve it themselves.`,
      failed: (why, list) => `The MCP client could not ask the user (${why}): nothing recorded (${list}). Ask the user to run the approval themselves.`,
      confirmed: "Confirmed by the user in the MCP client (elicitation).",
      // 1.23: notifications/progress while the question waits (the call carried a progressToken)
      waiting: "Waiting for the user's answer in the MCP client…",
    },
    // 1.21 F1a — git's merge driver for the spec state (`dev-spec merge-state`): doctor's merge-conflicts and the CLI's lines. The
    // words ours / theirs / base and "mergeConflicts" stay English (git's and the file's own terms).
    mergeState: {
      doctor: (n, list) => `${n} merge conflict(s) the dev-spec merge driver left unresolved — ${list}. Each kept ours: pick the right value in the file (its "mergeConflicts" list shows base / ours / theirs), then delete "mergeConflicts".`,
      conflictHead: (file, n) => `dev-spec merge-state: ${file}: ${n} conflict(s) — ours kept at each, listed in the file under "mergeConflicts":`,
      conflictLine: (p, ours, theirs, base) => `  ${p}: ours ${ours} · theirs ${theirs} · base ${base}`,
      conflictTail: "Pick each value in the file, delete \"mergeConflicts\", then git add it.",
      absent: "(absent)",
      parseError: (side, why) => `dev-spec merge-state: ${side} is not valid JSON (${why}) — nothing merged, ours left as it is; merge the file by hand.`,
      unreadable: (file) => `cannot read ${file}.`,
      noGit: (dir) => `${dir} is not inside a git repository (or git is not installed) — merge-state --install writes that repository's own git config.`,
      attrsAdded: (file) => `${file}: the merge driver's lines added (commit it — the whole team gets them):`,
      attrsKept: (file) => `${file}: the merge driver's lines are already there.`,
      attrsRemoved: (file) => `${file}: the merge driver's lines removed (commit it).`,
      attrsNone: (file) => `${file}: no merge driver line to remove.`,
      configSet: (key, value) => `git config ${key} = ${value}`,
      configRemoved: (key) => `git config: ${key} removed.`,
      configFailed: (why) => `git config failed: ${why}`,
      teamNote: `git config is per clone: every teammate runs ${DEV_SPEC} merge-state --install once — and again after each plugin update (git runs the driver by this plugin folder's path, which an update moves; ${DEV_SPEC} merge-state --check tells). Without it, git falls back to its text merge.`,
      // 1.21 review A3 — merge-state --check (read only) and the SessionStart hook's line: is the configured driver still THIS clone's?
      checkOk: (script) => `The spec state's merge driver is installed and runs this clone's CLI (${script}).`,
      checkNone: `The spec state's merge driver is not installed here and .gitattributes doesn't name it — nothing to check (to install it: ${DEV_SPEC} merge-state --install).`,
      checkNotInstalled: (file) => `${file} names the dev-spec-state merge driver, but this clone's git config has none — git falls back to its text merge (a .state.json both branches changed conflicts). Install it: ${DEV_SPEC} merge-state --install`,
      checkOther: (script, cli) => `git runs the spec state's merge driver from ${script}, not from this clone's CLI (${cli}) — re-run: ${DEV_SPEC} merge-state --install`,
      checkMissing: (script) => `git runs the spec state's merge driver from ${script}, which no longer exists (a plugin update moves the plugin to a new folder) — git then reports a conflict and keeps only your side of .state.json / roadmap.json. Re-run: ${DEV_SPEC} merge-state --install`,
      checkNoGit: (dir) => `${dir} is not inside a git repository (or git is not installed) — there is no merge driver to check.`,
      hookLine: (script, missing) => `⚠ The spec state's git merge driver runs ${script}, ${missing ? "which no longer exists (a plugin update moved the plugin)" : "not this plugin's CLI"} — a merge would keep only your side of .state.json / roadmap.json. Re-run: ${DEV_SPEC} merge-state --install`,
    },
    // Scoped steering: custom steering files (front matter inclusion: always | fileMatch | manual), the brief, doctor.
    scopedSteering: {
      customHint: "— or a custom scoped steering file: lowercase letters, digits and '-', ending in .md (e.g. api-conventions.md).",
      reservedName: (file) => `'${file}' is a reserved name (a Windows device name or a JavaScript built-in) — pick another steering file name.`,
      customStub: (title, pattern) => `---\ninclusion: fileMatch\nfileMatchPattern: "${pattern}"\n---\n\n# ${title}\n\n` +
        "<!-- Scoped steering. The front matter decides when spec_task_brief includes this file:\n" +
        "     inclusion: always    → in every task brief\n" +
        "     inclusion: fileMatch → only for tasks whose _Implements:_ paths match fileMatchPattern\n" +
        "                            (glob: ** · * · ? · {a,b}; a list is allowed: [\"src/api/**\", \"src/routes/**\"])\n" +
        "     inclusion: manual    → never automatically; briefs list it as available on request\n" +
        "     Replace the example pattern and the bracketed lines below. -->\n\n" +
        "## Rules\n- [A rule every file matching the pattern must follow.]\n\n## Examples\n- [A short example — or a pointer to a file that shows the pattern.]\n",
      placeholders: (list) => `still template placeholders: ${list}`,
      scoped: "Scoped steering (fileMatch — matches this task's files):",
      manual: "Available on request (manual steering):",
    },
    // PostToolUse hook: design.md saved → its mandatory checks for the ACTIVE tracks.
    designSaveCheck: {
      head: (slug, tracks) => `Design check on design.md (${slug} [${tracks}]):`,
      clean: (tracks, constitution) => `Design check [${tracks}]: mandatory sections${constitution ? " and the Constitution Check" : ""} filled, no template placeholders ✓`,
      sections: (marker, list) => `${marker} sections: ${list}`,
      constitution: {
        missing: "Constitution Check: missing — add the section and check each principle of steering/constitution.md",
        unfilled: "Constitution Check: not filled in",
      },
      placeholders: (n, list) => `${n} template placeholder(s) left: ${list}`,
      hint: (slug) => `Fill them before approving the design — details: /spec-doctor ${slug}.`,
    },
    // spec_upgrade / `dev-spec upgrade` / the SessionStart notice / .specs/UPGRADE.md. The result's codes (status, review,
    // group, attention, history skip reasons) stay English; these are their labels.
    upgrade: {
      // mode: behind (no stamp / an older one) · pending (stamped, but a migration is still due) · current · unknown (no engine version)
      head: (from, to, mode) => mode === "unknown" ? "dev-spec upgrade — this engine's version is unknown (no package.json beside it): nothing will be stamped."
        : mode === "behind" ? `dev-spec upgrade — .specs/ ${from ? `at ${from}` : "from before 1.13 (no version stamp)"} → dev-spec ${to}`
        : mode === "pending" ? `dev-spec upgrade — .specs/ at ${from} (this dev-spec: ${to}), but some migrations are still pending`
        : `dev-spec upgrade — .specs/ at ${from}: up to date with this dev-spec (${to})`,
      newer: (from, to) => `.specs/ was last upgraded by a newer dev-spec (${from}) than this one (${to}) — update the plugin before relying on this audit.`,
      summary: (n, blocked, attention, ok, archived) => `${n} active feature(s): ${blocked} blocked · ${attention} need attention · ${ok} ok` + (archived ? ` · ${archived} archived (not reviewed)` : ""),
      noFeatures: "No active features — nothing to review.",
      group: { blocked: "⛔ Blocked — doctor fails:", attention: "▲ Needs attention:", ok: "✓ OK:" },
      status: { "not-started": "not started", planning: "planning", executing: "executing", complete: "complete", finished: "finished" },
      feature: (name, status, tracks, phase, done, total, bugfix) => `${name} — ${status} · [${tracks}] · ${phase} · ${done}/${total} tasks${bugfix ? " · bugfix" : ""}`,
      tracksInferred: "its tracks were inferred from the files — apply saves them to .state.json",
      item: {
        error: (e) => `Fix it by hand first: ${e}`,
        fix: (list) => `Fix what doctor fails on: ${list}`,
        approve: (list, slug) => `Approve the pending gate(s), in order: ${list} — /approve ${slug} <phase>`,
        reReview: (list, cmds) => `Re-review what changed after its approval: ${list}` + (cmds ? ` — diff it first: ${cmds}` : "") + "; then re-approve",
        reapprove: (list) => `Re-approve to start the change history (spec_impact can't diff these yet): ${list}`,
        verify: (list, slug) => `Record a passing run for the ticked tasks without one: ${list} — ${DEV_SPEC} done ${slug} <n> --run`,
        drift: (n, slug) => `Decide on the drift: ${n} implementing file(s) changed since finish — ${DEV_SPEC} drift ${slug}`,
        stale: (slug) => `It changed after its finish — finish it again: /spec-finish ${slug}`,
        packReserved: (list, slug, since) => `Rename its track pack(s) from before ${since || "1.17"} — ${list}: the name is reserved now, so the track is inactive (details: ${DEV_SPEC} doctor ${slug}, check track-pack-missing)`,
        // 1.19 T review: a pack whose marker is a built-in track's now
        packMarkerReserved: (list, slug, since, tracks) => `Change the marker of its track pack(s) from before ${since || "1.19"} — ${list}: the marker is a built-in track's now, so the pack is inactive; or adopt the built-in track: ${DEV_SPEC} add-track ${slug} ${tracks} (details: ${DEV_SPEC} doctor ${slug}, check track-pack-missing)`,
        // 1.22 review 2: criteria numbered with bare AC-n IDs (approved before 1.22) — renumber, then re-approve
        bareAcIds: (list, slug, file = "requirements.md") => `Renumber the criteria ${file} numbers with bare IDs (${list}) as US-<story>.AC-<n> — and their references in ${file === "change.md" ? "its tasks' _Requirements:_ (in change.md too)" : "tasks.md and test-plan.md"} — then re-approve: since 1.22 a bare AC-n is no ID trace_check reads, so doctor (ears, traceability) fails and the approval is refused (details: ${DEV_SPEC} doctor ${slug})`,
        critic: (files) => `Review it with the spec-critic agent (read-only), phase by phase: ${files || "—"}`,
        converge: (files) => "Run the spec-reviewer converge pass (the done tasks against their ACs)" + (files ? `, then the spec-critic agent on ${files}` : ""),
        none: "No spec review needed — every task is done",
        next: (rec) => `Next: ${rec}`,
        warnings: (list) => `Warnings: ${list}`,
      },
      reason: { "no-fingerprint": "approved before content fingerprints", changed: "changed after its approval", missing: "its file is missing", untracked: "a 1.12 bugfix design approval — bug.md was never tracked", "snapshot-missing": "its snapshot file is gone" },
      planHead: "Apply would change (spec_upgrade {apply: true} · " + DEV_SPEC + " upgrade --apply) — never an artifact, an approval or a tick:",
      migHead: "Migrations applied — no artifact edited, nothing approved, ticked or deleted:",
      migStamp: (from, to) => `meta.specVersion: ${from || "none"} → ${to}`,
      migTracks: (list) => `tracks saved to .state.json: ${list}`,
      migSeeded: (list) => `approval baselines saved: ${list}`,
      planSeed: (list) => `approval baselines to save to .history/ (the file still matches its approval): ${list}`,
      migRecords: (n) => `${n} earlier approval(s) recorded in approvalHistory`,
      migSkipped: (list) => `no baseline — re-approve to start the history: ${list}`,
      migGitignore: (n) => `.specs/.gitignore: ${n} line(s) added`,
      migErrors: (list) => `not migrated: ${list} — fix it, then run the upgrade again (meta.specVersion stays as it is until then)`,
      nothing: "Nothing to migrate — .specs/ is already up to date; nothing was changed.",
      upToDate: "Nothing to migrate — the list above is what the current rules flag.",
      applyHint: "Nothing was changed. Review the list, then apply the safe migrations: " + DEV_SPEC + " upgrade --apply (spec_upgrade {apply: true}).",
      reportAt: (file) => `Report: ${file} — a checklist to work through (/spec-upgrade).`,
      reportKept: (file) => `${file} exists and was not generated by dev-spec — left untouched (no report written).`,
      hookLine: (from) => `⬆ .specs/ was created with an older dev-spec (${from || "before 1.13"}) — run /spec-upgrade (${DEV_SPEC} upgrade) to review what isn't implemented yet (or just ask to update the specs)`,
      md: {
        title: (proj) => `dev-spec upgrade — ${proj}`,
        autogen: "AUTO-GENERATED by dev-spec — tick the boxes as you go; spec_upgrade {apply: true} (dev-spec upgrade --apply) writes it when it migrates something.",
        intro: (from, to) => `.specs/ upgraded from ${from || "a dev-spec before 1.13"} to ${to || "?"}. Per feature: what the ${to || "?"} rules flag, what to do and which review to run. Work through it with /spec-upgrade (Claude Code) or dev-spec upgrade; re-run the audit any time for the current state.`,
        migrations: "Migrations",
        group: { blocked: "⛔ Blocked — doctor fails", attention: "▲ Needs attention", ok: "✓ OK" },
        footer: "Every change goes through the normal gates: re-approvals with spec_approve (/approve), spec edits after an approval with spec_impact (/spec-impact), follow-up work with spec_append_tasks (/spec-converge). Nothing here is applied automatically.",
      },
    },

    // MCP prompts (one per commands/*.md) + resources (specs:// URIs) — mcp/lib/prompts-resources.js, `dev-spec prompts`.
    promptsResources: {
      preamble: (agentsMd, refsDir) => `Note for the agent: if no dev-spec-driven skill is available in this tool, follow the workflow in the plugin's AGENTS.md (${agentsMd}) and use the spec-driven MCP tools (spec_*, ears_validate, trace_check); the references/… files named below are in ${refsDir}.`,
      argDesc: (hint) => (hint ? `Arguments (optional): ${hint}` : "No arguments needed (optional free text)."),
      cliHead: (n) => `${n} prompt(s) — one per plugin command; ${DEV_SPEC} prompts <name> [--args "…"] prints one:`,
      res: {
        roadmap: "The project roadmap (.specs/ROADMAP.md): every feature's phase, progress and dependencies.",
        roadmapFromJson: "The project roadmap, rendered from .specs/roadmap.json (no ROADMAP.md written yet).",
        catalog: "The living catalog (.specs/SPECS.md): every feature and acceptance criterion, superseded ones marked.",
        steering: (file) => `Steering file .specs/steering/${file} — project-wide rules every feature follows.`,
        artifact: (slug, label, file) => `${label} of feature '${slug}' (.specs/${slug}/${file}).`,
        labels: {
          "classification.md": "Classification (tracks)", "requirements.md": "Requirements (EARS)", "design.md": "Technical design", "test-plan.md": "Test plan",
          "eval-plan.md": "Eval plan", "load-test.md": "Load test plan", "tasks.md": "Tasks", "bug.md": "Bug report (reproduction · root cause · fix)",
          "quickstart.md": "Quickstart", "checklist.md": "Checklist", "integration-plan.md": "Integration plan", "retro.md": "Retrospective",
          "spike.md": "Spike (question · evidence · decision)", "decisions.md": "Decision log", "change.md": "Change (criteria · approach · tasks)", // 1.14 C2 · 1.21 F5
        },
        tplFeature: (list) => `A feature's spec artifact: .specs/{slug}/{artifact} — {artifact} is one of ${list}.`,
        tplSteering: "A steering file: .specs/steering/{file} (a .md file).",
      },
      err: {
        // 1.23: resources/list pages (nextCursor) — a cursor this server did not hand out (JSON-RPC -32602)
        badCursor: "resources/list: invalid cursor — pass back the nextCursor of the previous page as it is.",
        noPromptName: "prompts/get needs the prompt `name` (a string).",
        badPromptArgs: 'prompts/get: `arguments` must be an object of strings, e.g. {"args": "login"}.',
        unknownPrompt: (name, list) => `Unknown prompt '${name}' — one of: ${list}.`,
        noUri: "resources/read needs the resource `uri` (a string).",
        badUri: (uri) => `Invalid resource URI '${uri}' — expected specs://roadmap, specs://catalog, specs://steering/<file>.md or specs://feature/<slug>/<artifact> (no '..', no absolute path, no other scheme).`,
        unknownArtifact: (a, list) => `Unknown artifact '${a}' — one of: ${list}.`,
        badSteering: (file) => `Invalid steering file name '${file}' — a .md file directly under .specs/steering/.`,
        notFound: (uri, detail) => `Resource not found: ${uri}` + (detail ? ` — ${detail}` : ""),
      },
    },

    // 1.16 C — Claude Code integration: the status line (`dev-spec statusline`), the plan-mode bridge (hooks/plan-hook.js),
    // spec_import {text} and the MCP completion/complete errors. Phase names and step codes stay English-stable.
    claudeCode: {
      statusLine: {
        head: (slug, kind) => `◆ ${slug}` + (kind === "bugfix" ? " (bugfix)" : kind === "spike" ? " (spike)" : ""),
        tasks: (done, total) => `${done}/${total} tasks`,
        unverified: (n) => `${n} unverified`,
        next: (step) => `next: ${step}`,
        none: "◆ dev-spec · no features yet — /spec",
        steps: {
          "re-review": (s) => `re-review ${s.files.join(", ")}`,
          fill: (s) => `fill ${s.file}`,
          fix: (s) => (s.file === "bug.md" ? "write the root cause in bug.md" : s.file === ".state.json" ? "repair .state.json (it can't be read)" : `fix the ${s.phase} gate`),
          approve: (s) => `approve ${s.phase}`,
          tests: () => "write the tests, then approve them (Phase 4)",
          tasks: () => "break it into tasks",
          implement: (s) => `task ${s.task}`,
          blocked: () => "unblock the tasks (_Depends:_)",
          verify: (s) => (s.suite ? `run the project checks (${s.suite.join(", ")})` : `verify task ${s.task}`),
          decide: (s) => (s.outcome ? "add the _Outcome:_ line to the decision" : "write the decision"),
          promote: () => "go — spec the feature, archive the spike",
          archive: () => "no-go — archive the spike",
          pivot: () => "pivot — start a new spike",
          finish: (s) => (s.again ? "/spec-finish again" : "/spec-finish"),
          "sign-off": (s) => (s.again ? "approve execution again (sign-off)" : "approve execution (sign-off)"),
          finished: () => "finished",
        },
        config: {
          head: "Status line — add this to ~/.claude/settings.json (every project) or to a project's .claude/settings.local.json (this machine only — the path is this machine's, so never the committed .claude/settings.json):",
          after: "It prints one line — the most active feature, its tasks, unverified ticks and the next step — and nothing outside a dev-spec project.",
          cacheNote: "This path is a versioned copy in Claude Code's plugin cache (…/plugins/cache/…): after a plugin update run /spec-statusline again — the old copy is removed 14 days after an update.",
          tryIt: (cmd) => `Try it: echo '{"cwd": "<your project>"}' | ${cmd}`,
        },
      },
      planBridge: {
        byText: "dev-spec: the user approved this plan. To track it as a spec (EARS criteria, traced tasks, evidence gates), offer /spec-import — spec_import {tool: \"plan\", text: <the approved plan's markdown>} (CLI: " + DEV_SPEC + " import plan - < plan.md). The plan file in ~/.claude/plans is outside the project, so pass its text. Skip it for a quick change; import only with the user's OK.",
        byPath: (rel) => `dev-spec: the user approved this plan. To track it as a spec (EARS criteria, traced tasks, evidence gates), offer /spec-import — spec_import {tool: "plan", path: "${rel}"} (CLI: ${DEV_SPEC} import plan ${rel}). Skip it for a quick change; import only with the user's OK.`,
      },
      importText: {
        label: "(inline text)",
        note: (tool, date) => `> Imported from ${tool} (inline text) on ${date}.`,
        orText: "Or pass its markdown as `text` instead of `path` (spec_import {tool, text}; CLI: " + DEV_SPEC + " import <tool> - < file.md).",
        textOnly: (tool, list) => `\`text\` imports a single document — tool ${list}; '${tool}' reads a folder: pass its \`path\`.`,
        pathAndText: "Pass either `path` or `text`, not both.",
        empty: (tool) => `The ${tool} text is empty — nothing to import.`,
      },
      completion: {
        badRequest: 'completion/complete needs `ref` ({type: "ref/prompt", name} or {type: "ref/resource", uri}) and `argument` {name, value} (strings).',
        promptsOff: "This server serves no prompts (SPEC_MCP_PROMPTS=off) — nothing to complete.",
        unknownTemplate: (uri, list) => `Unknown resource template '${uri}' — one of: ${list}.`,
        unknownArgument: (name, list) => `Unknown argument '${name}' — one of: ${list}.`,
      },
    },

    // +sec / +privacy (1.14): what their tools report beyond the shared track messages.
    secPrivacy: {
      // Display names of the [SEC] / [PRIVACY] design sections — merged into sectionNames after MSG (EN: the canonical names).
      sectionNames: {},
      allFilled: { sec: "all 5 filled", privacy: "all 6 filled", dist: "all 5 filled", api: "all 5 filled", ui: "all 5 filled", obs: "all 5 filled", data: "all 5 filled" }, // doctor's sec-sections / privacy-sections / dist-sections / api-sections pass detail
      statusSections: { sec: (list) => `Security sections: ${list}`, privacy: (list) => `Privacy sections: ${list}`, dist: (list) => `Data consistency sections: ${list}`, api: (list) => `API contract sections: ${list}`, ui: (list) => `UI sections: ${list}`, obs: (list) => `Operability sections: ${list}`,
        data: (list) => `Data pipeline sections: ${list}` }, // `dev-spec status`
      finishChecks: { // spec_finish `checks`: what only a fresh run or a human can confirm
        sec: ["+sec: SAST, dependency audit and secret scan clean on a fresh local run; every abuse-case test green.",
          "+sec: threat model re-checked against the final code — no new entry point or trust boundary left unmitigated."],
        privacy: ["+privacy: access/export and erasure verified end to end on the real stores (processors included).",
          "+privacy: retention job scheduled; privacy notice and records of processing (Art. 30) updated; DPIA decision on file."],
        dist: ["+dist: failure-injection tests green on a fresh local run — crash between commit and publish, duplicate delivery, concurrent updates, a dependency down.",
          "+dist: no cross-system write in the final code bypasses its mitigation (outbox / inbox / saga) — no database commit followed by a direct publish."],
        api: ["+api: contract tests and the breaking-change diff against the published contract green on a fresh local run.",
          "+api: the contract file matches the shipped behaviour — every documented status code, error code and header is what the handlers return; anything removed is deprecated with its Sunset date."],
        ui: ["+ui: the automated accessibility check clean and the keyboard / screen-reader pass done on the final build; every state of the state matrix reachable and shown.",
          "+ui: the performance budget measured on the final build (LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1) and the visual regression of the states reviewed."],
        obs: ["+obs: an alert fired in a staged failure and the rollback drill done on the final build; the dashboards and runbooks the alerts link exist.",
          "+obs: the metrics, logs and traces the design names seen emitting from the final build — no personal data in logs or traces."],
        data: ["+data: the data-quality checks, a partition re-run and a backfill rehearsal green on a fresh run against real-sized data — the same rows as one run, bad rows quarantined.",
          "+data: every dataset the final code writes matches its contract (schema, owner, freshness SLA) and the lineage, retention and partitioning in design.md."],
      },
      clarify: { // spec_clarify questions for the track (asked while requirements.md says nothing about them)
        secAccess: "Specify what an unauthenticated or unauthorized caller gets (IF … THEN THE SYSTEM SHALL deny …) and the ASVS level the feature targets.",
        secSecrets: "Specify which secrets / credentials the feature handles and that none of them reaches a response or a log (write it as an AC).",
        privacyRights: "Specify the data subject rights the feature must serve (access, erasure, portability…) as ACs, with the one-month deadline.",
        privacyRetention: "Specify how long each category of personal data is kept and what happens when that period ends.",
        distDelivery: "Specify the delivery guarantee (at-least-once) and how a message delivered twice is detected and applied once (idempotency key, inbox) — write it as an AC.",
        distFailure: "Specify what the feature does when each dependency (database, broker, external API) is unavailable or times out — as IF … THEN THE SYSTEM SHALL criteria.",
      },
    },

    // Marker-shaped text on a task line that yields no marker (doctor malformed-markers, 1.14 full review Pa1).
    markerSyntax: {
      // 1.22 review — checkbox lines the task scanner does not read as tasks (doctor unread-tasks).
      unreadTasks: (list) => `checkbox lines that are not tasks: ${list} — a task line is "- [ ] N. text" (a -, * or + bullet, then its number); these are never ticked, briefed or verified. Number them (or make them sub-steps of a task); a line indented 4+ spaces after a blank line, outside a list, is a code block — unindent it.`,
      doctor: (list) => `marker-shaped text on a task line yields no marker: ${list} — the tools read nothing there (no check runs, no file is traced). Write it as _Verify: <command>_ / _Implements: <path>_ / _Depends: 3_ (italics, the value inside).`,
      // review 5 — a _Verify:_ value that looks garbled (doctor verify-suspicious)
      suspiciousVerify: (list) => `a _Verify:_ command looks garbled: ${list} — it starts with _ or * (a marker's delimiter read into it), holds a code span inside it (two commands written as one: give each its own _Verify:_; a command substitution reads better as $(…)), or has a quote with no partner. done --run runs it exactly as written: fix the marker.`,
    },
    // A T-ID the test plan checks outside test code (load-test.md, evals/*.json) whose artifact is still the scaffold (doctor
    // outside-code-artifacts, a spec_finish warning — 1.14 full review Pa6).
    outsideCode: {
      doctor: (list) => `tests planned outside test code point at an artifact that is still a template: ${list} — fill it in (the real load run, the feature's own eval set) before calling them verified.`,
    },

    // A _Verify:_ command that pipes into another one (`npm test | tee log`): a pipeline's exit code is its LAST command's.
    verifyPipe: {
      brief: (cmds) => `⚠ ${cmds.map((c) => "`" + c + "`").join(", ")} ${cmds.length > 1 ? "pipe" : "pipes"} into another command: a pipeline's exit code is its LAST command's, so a failing check can exit 0 and read as verified. Drop the pipe, or run it under bash after \`set -o pipefail\` (cmd.exe has no pipefail) — the exit code you report must be the check's own.`,
      runHint: (cmd) => `⚠ \`${cmd}\` pipes into another command: the shell reports only the LAST command's exit code, so a failing check can be recorded as passing — drop the pipe, or start it with \`set -o pipefail;\` under bash (--shell bash); cmd.exe has no pipefail.`,
      doctor: (list) => `a _Verify:_ command pipes into another one — a failing check can exit 0 (a pipeline reports its LAST command's code): ${list}. Drop the pipe or use \`set -o pipefail\` (bash).`,
      completeNote: (n, cmd) => `Task ${n}: the recorded command pipes into another one (\`${cmd}\`) — its exit 0 is the LAST command's, so this pass may hide a failing check. Drop the pipe (or use \`set -o pipefail\` under bash) and re-run.`,
    },

    // Project templates (.specs/templates/) — spec_templates / `dev-spec templates`, and the {{summary}} slot of a scaffold.
    templates: {
      noSummary: "[TBD]", // {{summary}} of a feature created without one: a generic slot, so the scaffold still reads 'placeholder'
      badAction: (a) => `Unknown templates action '${a}' — one of: list, init, check.`,
      unknownArtifact: (a, list) => `Unknown template '${a}' — one of: ${list}, or steering/<file>.md.`,
      writeFailed: (rel, why) => `Could not write ${rel} (${why}).`,
      writeOutside: (rel) => `Refused to write ${rel}: its folder is a link to a place outside the project.`,
      legacyFeature: ".specs/templates/ is the folder of a feature created before project templates existed (it holds a .state.json) — it stays that feature and is never read as templates. Rename it (" + DEV_SPEC + " feature rename templates <new-name>, or spec_feature rename) to use project templates.",
      builtIn: "built-in",
      override: "project",
      listHead: (lang, n) => `Templates for '${lang}' features — ${n} project override(s) in .specs/templates/ (a <lang>/ file wins over a shared one):`,
      ignored: (list) => `Ignored — not a template dev-spec knows: ${list}`,
      initDone: (n) => `${n} built-in template(s) copied into .specs/templates/ — edit them; new scaffolds use them from now on:`,
      initKept: (list) => `Kept (already there — never overwritten): ${list}`,
      initNothing: "Nothing copied — every template asked for is already in .specs/templates/.",
      checkNone: "No project template to check — .specs/templates/ holds no override (`" + DEV_SPEC + " templates init` copies the built-in ones).",
      checkHead: (n, errors, warnings) => `${n} template file(s) checked — ${errors} error(s), ${warnings} warning(s).`,
      appends: (file, list) => `${file}: the engine appends the ${list} section(s) itself (the template has no heading of theirs).`,
      problems: {
        empty: "empty — ignored; the built-in template is used instead.",
        "unknown-file": "not a template dev-spec knows (see spec_templates list) — ignored.",
        "unknown-variable": (v) => `{{${v}}} is not a template variable — it is left as is (known: {{name}} {{slug}} {{summary}} {{tracks}} {{lang}} {{date}}).`,
        "no-placeholders": "no [bracketed] slot and no > **TODO** line — an untouched scaffold would read as filled, and its gate could be approved unedited.",
        "missing-section": (marker, section) => `${marker} ${section} is missing — the template has other ${marker} headings, so the engine appends none of that track's sections and doctor fails on this one.`,
        "no-sentinel": (marker, section) => `${marker} ${section} has no > **TODO** line — a fresh feature would read the section as filled (the built-in template seeds one).`,
        "constitution-missing": "no Constitution Check section — doctor warns on every feature scaffolded from it.",
        "tradeoffs-missing": "no Alternatives & Trade-offs section — doctor warns (design-tradeoffs) on every feature scaffolded from it.",
        "risks-missing": "no Risks section — doctor warns (design-risks) on every feature scaffolded from it.",
        "reuse-missing": "no Reuse & Integration section — doctor warns (design-reuse) on every feature scaffolded from it.",
        "no-criteria": "no acceptance criterion (a US-n.AC-m line with SHALL) — nothing for EARS, trace_check or the test plan to follow.",
        "ac-duplicate": (ids) => `duplicate AC IDs: ${ids} — doctor fails on every feature scaffolded from it.`,
        "phantom-ac": (ids, file) => `cites AC IDs ${file} does not define: ${ids} — trace_check reports them as phantoms.`,
        "builtin-phantom": (file, ids) => `the built-in ${file} (not overridden) cites AC IDs this template does not define: ${ids} — override ${file} too, or keep those IDs.`,
        "phantom-test": (ids, file) => `makes green T-IDs ${file} does not define: ${ids} — trace_check reports them as unknown tests on every +tdd feature.`,
        "builtin-phantom-test": (file, ids) => `the built-in ${file} of a +tdd feature (not overridden) makes green T-IDs this template does not define: ${ids} — override ${file} too, or keep those IDs.`,
        "root-cause-missing": "no Root Cause section — the bugfix gate (doctor's root-cause) would fail on every bugfix until one is added.",
        "root-cause-filled": "Root Cause already reads as written (prose, no slot, no > **TODO** line) — a fresh bugfix would pass the root-cause gate before the cause is known.",
        "repro-missing": "no Reproduction section — doctor warns on every bugfix.",
        "repro-filled": "Reproduction already reads as written — a fresh bugfix would not ask for the steps.",
        "no-tasks": "no task line (- [ ] 1. …) — a scaffold from it has nothing to execute.",
        "no-active-tracks": "no 'Active Tracks' heading — spec_add_track can't record a track change in classification.md.",
        "filematch-no-pattern": "front matter says inclusion: fileMatch but gives no fileMatchPattern — the file is only listed on request.",
      },
    },

    // Project-defined tracks (1.15) — track packs in .specs/tracks/<name>/: the blocks they scaffold, spec_tracks / `dev-spec tracks`,
    // doctor's track-pack-missing. The markers ([A11Y]), IDs, `> **TODO**` and the check codes stay English.
    trackPacks: {
      acHeading: "Acceptance Criteria (EARS)",
      taskHeading: (marker, title) => `Story US-1 — ${marker} ${title}`,
      todoLine: "> **TODO** — replace with real values (remove this line when done).",
      defaultCriterion: (title) => `THE SYSTEM SHALL [the ${title} behavior this feature guarantees]`,
      defaultTask: (marker, title) => `[US1] Meet the ${marker} ${title} criteria — fill its design sections, implement and verify them`,
      rowLayer: "integration",
      rowDesc: "[behavior]",
      checklistItem: (n) => `${n} mandatory design section(s) filled (no TODO) — every criterion verified.`,
      steeringStub: (title, name) => `# ${title}\n\n<!-- The team's ${title} standards: every +${name} feature follows them (spec_task_brief quotes this file). -->\n- [fill me in]\n`,
      allFilled: (marker) => `all ${marker} sections filled`,
      statusSections: (marker, list) => `${marker} sections: ${list}`,
      missing: (list) => `track pack(s) not available: ${list} — the track is inactive for this feature until the pack is back (${DEV_SPEC} tracks check).`,
      missingAbsent: (name) => `+${name} (no .specs/tracks/${name}/ in this project)`,
      missingInvalid: (name, codes) => `+${name} (the pack is invalid: ${codes})`,
      // 1.17 D review: a pack from before 1.17 whose name is reserved now
      missingReserved: (name, slug, builtIn, since) => `+${name} (a track pack from before ${since || "1.17"} — '${name}' is a reserved name now${builtIn ? `, and the built-in +${name} track is NOT applied to this feature` : ""}: rename .specs/tracks/${name}/ (and its marker, if that is reserved too), then ${DEV_SPEC} add-track ${slug} <new-name> and ${DEV_SPEC} add-track ${slug} ${name} --remove${builtIn ? `; to adopt the built-in track instead: ${DEV_SPEC} add-track ${slug} ${name}` : ""})`,
      // 1.19 T review: a pack from before 1.19 (1.17 for [DIST]) whose MARKER is a built-in track's now
      missingReservedMarker: (name, marker, track, slug, since) => `+${name} (a track pack from before ${since || "1.19"} — its marker ${marker} is the built-in +${track} track's now, so the pack is ignored and its ${marker} sections don't count as +${track}'s: change the marker in .specs/tracks/${name}/track.json and in this feature's ${marker} headings, or adopt the built-in track: ${DEV_SPEC} add-track ${slug} ${track} (its sections are appended, the pack leaves this feature); to drop the pack: ${DEV_SPEC} add-track ${slug} ${name} --remove)`,
      badAction: (a) => `Unknown tracks action '${a}' — one of: list, init, check, signals.`,
      nameRequired: "tracks init needs a name — " + DEV_SPEC + " tracks init <name> (spec_tracks {action: \"init\", name}).",
      unknownPack: (n, list) => `No track or track pack '${n}' — the project's packs: ${list}.`,
      legacyFeature: ".specs/tracks/ is the folder of a feature created before track packs existed (it holds a .state.json) — it stays that feature and is never read as packs. Rename it (" + DEV_SPEC + " feature rename tracks <new-name>, or spec_feature rename) to use track packs.",
      writeFailed: (rel, why) => `Could not write ${rel} (${why}).`,
      writeOutside: (rel) => `Refused to write ${rel}: its folder is a link to a place outside the project.`,
      builtIn: "built-in",
      sectionCount: (n) => `${n} section(s)`,
      signalCount: (n) => `${n} signal(s)`,
      invalid: (n) => `invalid (${n} error(s)) — ignored; see ${DEV_SPEC} tracks check`,
      noPacks: "No track pack in .specs/tracks/ — `" + DEV_SPEC + " tracks init <name>` scaffolds one.",
      listHead: (builtIn, packs, valid) => `Tracks — ${builtIn} built-in, ${packs} project pack(s) in .specs/tracks/ (${valid} valid):`,
      checkNone: "No track pack to check — .specs/tracks/ holds none (`" + DEV_SPEC + " tracks init <name>` scaffolds one).",
      checkHead: (n, valid, errors, warnings) => `${n} track pack(s) checked — ${valid} valid, ${errors} error(s), ${warnings} warning(s).`,
      initDone: (name, n) => `Track pack +${name} scaffolded (${n} file(s)) — edit them; it is a valid track from now on:`,
      initKept: (list) => `Kept (already there — never overwritten): ${list}`,
      initNothing: (name) => `Nothing written — every file of the +${name} pack is already there.`,
      initNext: (name) => `Next: ${DEV_SPEC} tracks check · ${DEV_SPEC} add-track <feature> ${name} (spec_add_track), or name it when creating a feature.`,
      // The files `init` scaffolds (a = { name, token, title, lang }): a commented track.json and one example of each fragment.
      initJson: (a) => `// Track pack +${a.name} — a project-defined track (dev-spec 1.15). Data only: nothing in this folder is run.
// Guide: references/project-tracks.md · validate it: dev-spec tracks check (spec_tracks {action: "check"}).
{
  // = this folder's name: ^[a-z][a-z0-9]{1,19}$, never a built-in track (core tdd saas ai sec privacy dist api ui obs data).
  "name": "${a.name}",
  // The stable, case-sensitive marker of its design sections, criteria and task block: [${a.token}].
  "marker": "${a.token}",
  // Shown in headings ("#### [${a.token}] ${a.title} — Acceptance Criteria (EARS)"); pt / es / pt-BR are optional.
  "title": { "en": "${a.title}" },
  // Classifier keywords, matched as whole words (inflections too): one "strong" keyword turns the track on, two "weak" ones do,
  // a "context" one only corroborates another. A keyword in CAPITALS is an acronym, matched case-sensitively.
  "signals": { "strong": [], "weak": [], "context": [] },
  // The mandatory design sections: design.md gets "## [${a.token}] <name>" + a > **TODO** line for each; doctor (${a.name}-sections)
  // and the design approval fail until every one is filled. syn: other headings that count (any language).
  "sections": [
    { "name": "Standards", "syn": [], "guidance": { "en": "The ${a.title} standards this feature meets, and how each one is verified." } },
    { "name": "Verification", "syn": [], "guidance": { "en": "Who checks it, with which tools, before the merge." } }
  ],
  // Optional: the steering file the track brings (.specs/steering/<file>, written from steering.md when a feature adds the track).
  "steering": "${a.name}.md"
}
`,
      initRequirements: (a) => `<!-- Track pack +${a.name}: the acceptance criteria every +${a.name} feature starts with — one list item = one criterion, in EARS.
     The engine numbers them after the feature's US-1 criteria (US-1.AC-n), under "#### [${a.token}] ${a.title} — Acceptance Criteria (EARS)".
     [Bracketed] slots stay template placeholders until the feature fills them. -->
- WHEN [trigger] THE SYSTEM SHALL [the ${a.title} behavior]
- THE SYSTEM SHALL [a ${a.title} property that always holds]
`,
      initTasks: (a) => `<!-- One list item = one task of the feature's "Story US-1 — [${a.token}] ${a.title}" block (numbered after its last task).
     {{ac1}}, {{ac2}}… = this pack's criteria as the feature numbers them, {{acs}} = all of them; {{t1}}… / {{tests}} = their planned
     tests (+tdd — a line naming none is left out). A task without _Requirements:_ gets {{acs}}. -->
- [ ] [the ${a.title} design decisions for this feature]
  - _Requirements: {{acs}}_
- [ ] [implement and verify the ${a.title} criteria]
  - _Requirements: {{acs}}_
  - _Makes green: {{tests}}_
`,
      initTestPlan: (a) => `<!-- One row = one planned test (+tdd features) — the built-in plan's six cells; the Test ID cell is renumbered after the plan's own. -->
| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |
|---------|-------|------|-------------|-----------------|------|
| T-00 | integration | example | [the ${a.title} behavior, end to end] | {{ac1}} | \`tests/integration/...\` |
| T-00 | unit | property | [the always-true ${a.title} property] | {{ac2}} | \`tests/unit/...\` |
`,
      initChecklist: (a) => `<!-- One list item = one line of the feature's checklist.md ("- [ ] ${a.token}: …"). -->
- every [${a.token}] design section filled (no TODO) and reviewed.
- [the ${a.title} check the team runs before the merge]
`,
      initSteering: (a) => `# ${a.title}

<!-- The team's ${a.title} standards — every +${a.name} feature follows them (spec_task_brief quotes this file). -->
- [fill me in]
`,
      // A rule a track.json field breaks / why track.json is no JSON — the engine passes a code (+ its limit), never English text
      rule: (r) => {
        const x = r && typeof r === "object" ? r : { id: r };
        return ({
          name: "= the folder name", marker: "^[A-Z][A-Z0-9]{1,11}$", text: `2–${x.max} characters, one line, no [ ] < > \``,
          line: `one line, ≤ ${x.max} characters`, signals: "{ strong?, weak?, context? }", keywords: "[keyword, …]",
          sections: "[{ name, syn?, loose?, guidance? }, …] — at least one", section: "{ name, syn?, loose?, guidance? }",
          lead: "a name after its numbering / emoji / dash", texts: "[text, …]", guidance: `one line, ≤ ${x.max} characters, no <!-- -->`,
        })[x.id] || String(x.id);
      },
      jsonWhy: (a) => (a.why === "comment" ? "a /* comment is never closed" : a.why === "object" ? "not a JSON object"
        : a.line ? `a syntax error on line ${a.line}` : "a syntax error"),
      problems: {
        "linked-folder": "a link (symlink / junction) or a folder outside .specs/ — ignored: a pack is read from its own folder only.",
        "unknown-file": "not a pack file (track.json, requirements.md, tasks.md, test-plan.md, checklist.md, steering.md, <lang>/) — ignored.",
        "too-many-packs": (a) => `more than ${a.max} track packs — this one is ignored.`,
        "name-invalid": (a) => `'${a.name}' is not a track name (^[a-z][a-z0-9]{1,19}$ — lower-case letters and digits) — the pack is ignored.`,
        "name-reserved": (a) => `'${a.name}' is reserved (a built-in track, a word for one, or a word dev-spec uses) — the pack is ignored.`,
        "name-mismatch": (a) => `"name": "${a.name}" is not the folder name '${a.folder}' — the pack is ignored.`,
        "json-missing": "no track.json — the pack is ignored.",
        "json-invalid": (a) => `track.json is not valid JSON (${MSG.en.trackPacks.jsonWhy(a)}) — the pack is ignored.`,
        "too-big": (a) => `${a.file} is larger than ${a.max} bytes — the pack is ignored.`,
        "fragment-linked": (a) => `${a.file} is not a regular file inside .specs/ (a link, or a folder) — the pack is ignored.`,
        "field-missing": (a) => `"${a.field}" is missing (${MSG.en.trackPacks.rule(a.rule)}) — the pack is ignored.`,
        "field-invalid": (a) => `"${a.field}" is invalid (${MSG.en.trackPacks.rule(a.rule)}) — the pack is ignored.`,
        "marker-invalid": (a) => `marker '${a.marker}' is not ^[A-Z][A-Z0-9]{1,11}$ — the pack is ignored.`,
        "marker-reserved": (a) => `marker [${a.marker}] is taken by dev-spec (a built-in marker, a story / parallel tag or a generic slot) — the pack is ignored.`,
        "marker-duplicate": (a) => `marker ${a.marker} is already the +${a.other} pack's — markers are unique; this pack is ignored.`,
        "signal-invalid": (a) => `signals.${a.tier}: '${a.keyword}' is not a keyword (letters and digits with inner spaces, - ' . — 2 to 60 characters; always matched as a literal word, never as a pattern) — the pack is ignored.`,
        "too-many": (a) => `${a.field}: more than ${a.max} — the pack is ignored.`,
        "section-duplicate": (a) => `section '${a.name}' is named twice — the pack is ignored.`,
        "steering-invalid": (a) => `steering '${a.file}' is not a steering file name (lower-case letters, digits and -, ending in .md; not a device name) — the pack is ignored.`,
        "steering-shared": (a) => `steering ${a.file} is also a built-in steering file — whichever is written first is kept.`,
        "unknown-key": (a) => `unknown key "${a.key}" — ignored.`,
        "unknown-variable": (a) => `{{${a.v}}} is not a pack variable — left as is (known: {{ac1}}… {{acs}} {{t1}}… {{tests}} {{title}} {{marker}} {{name}} {{slug}}).`,
        "fragment-empty": (a) => `${a.file} holds nothing the engine reads — the built-in default is used instead.`,
        "fragment-row": (a) => `a ${a.file} row without the plan's six cells (Test ID | Layer | Kind | Description | Covers | File) — the pack is ignored.`,
        "fragment-ref": (a) => a.kind === "t" && a.file !== "tasks.md" ? `${a.ref} can't be used in ${a.file} — only tasks.md names the planned tests — the pack is ignored.`
          : `${a.ref} names nothing ${a.ctx ? "for " + a.ctx + " features" : "in the pack root"}: ${a.from || "the built-in default"} gives ${a.n} ${a.kind === "ac" ? "criterion(s)" : "planned test(s)"} — the pack is ignored.`,
        "section-name-lead": (a) => `section name '${a.name}' starts with numbering, an emoji or a dash — ignored when matching a heading: it counts as '${a.key}'.`,
        "section-core-name": (a) => `section '${a.name}' has the name of a core design heading ('${a.heading}') — only a heading carrying the pack's marker (or under one) counts; the core section never does.`,
      },
    },

    // Stakeholder export (spec_export / `dev-spec export`): the chrome of the generated document — the spec text is the user's.
    stakeholderExport: {
      autogen: "AUTO-GENERATED by dev-spec — do not edit by hand. Regenerate: spec_export (dev-spec export).",
      kicker: { feature: "Feature specification", bugfix: "Bugfix specification", change: "Change specification", project: "Project specification" },
      projectTitle: (proj) => `${proj} — specification overview`,
      generated: (date) => `generated ${date} from the project's specs (.specs/)`,
      meta: { id: "Feature", kind: "Kind", tracks: "Tracks", phase: "Phase", progress: "Progress", status: "Status", lang: "Language", overall: "Overall progress" },
      kind: { feature: "feature", bugfix: "bugfix", change: "change (size xs)" },
      progress: (done, total, pct) => `${done}/${total} tasks done · ${pct}%`,
      overall: (pct, complete, total, done, tasks) => `${pct}% · ${complete}/${total} features complete · ${done}/${tasks} tasks done`,
      sections: {
        contents: "Contents", summary: "Summary", stories: "User stories and acceptance criteria", successCriteria: "Success criteria", bug: "Bug report",
        design: "Design", testPlan: "Test plan", tasks: "Tasks", decisions: "Decisions", approvals: "Approvals", clarifications: "Open clarifications",
        roadmap: "Roadmap", backlog: "Backlog", catalog: "Living catalog",
      },
      cols: { task: ["#", "Task", "Status", "Verification"], approval: ["Phase", "Approved by", "When", "Notes"], roadmap: ["Feature", "Tracks", "Phase", "Progress", "Tasks", "Depends on"] },
      taskStatus: { done: "✅ done", open: "☐ open" },
      verification: { verified: "verified", nothing: "nothing to verify", open: "—", unverified: (why) => "⚠ not verified" + (why ? ` (${why})` : "") },
      phases: { classification: "Classification", requirements: "Requirements", design: "Design", "test-plan": "Test plan", "eval-plan": "Eval plan", tests: "Tests (Phase 4)", tasks: "Tasks", execution: "Execution sign-off" },
      planPhase: "Plan (change.md)", // a change's tasks phase: its whole plan (1.21 review C5)
      criteria: "Acceptance criteria",
      forced: (ids) => `approved with --force (failing: ${ids})`,
      changedSince: "changed since this approval — to be re-reviewed",
      pending: "awaiting approval",
      template: "template — not written yet",
      supersededBy: (list) => `superseded by ${list}`,
      toBeSupersededBy: (list) => `to be superseded by ${list} (not shipped yet)`,
      supersedes: (list) => `supersedes ${list}`,
      blocked: (list) => `blocked by ${list}`,
      none: "Nothing.",
      noSummary: "No summary written yet.",
      noStories: "No user stories or acceptance criteria yet.",
      noDesign: "No design yet.",
      noTasks: "No tasks yet.",
      noApprovals: "No phase approved yet.",
      noClarifications: "None — no open [NEEDS CLARIFICATION] marker.",
      noFeatures: "No features yet.",
      theme: "Theme",
      print: "Print",
      wrote: (file) => `✎ wrote ${file}`,
      exportsIsFeature: (dir) => `${dir} is a feature folder from before dev-spec reserved the name 'exports' (it holds requirements.md / .state.json) — move or rename that folder by hand, then export again.`,
      exportsLinked: (rel) => `Refused to write ${rel}: .specs/exports/ or that file is a link (a symbolic link, a junction) or resolves outside .specs/ — replace it with a plain folder / file, then export again. Nothing was written.`,
    },
    // Requirements traceability matrix (trace_check {matrix} / `dev-spec trace --matrix | --csv` / spec_export {format: "csv"}):
    // labels only — the IDs, the kind column (AC / EC / NFR / SC) and the JSON codes (status, gaps, reason) stay English.
    rtm: {
      title: "Traceability matrix",
      projectTitle: "Traceability",
      autogen: "AUTO-GENERATED by dev-spec — do not edit by hand. Regenerate: dev-spec export --csv (spec_export format csv).",
      cols: {
        feature: "Feature", id: "ID", kind: "Kind", requirement: "Requirement", status: "Status", gaps: "Gaps", template: "Template", design: "Design sections",
        tasks: "Tasks", tests: "Tests", testFiles: "Test files", evidence: "Latest evidence", decisions: "Decisions", supersedes: "Supersedes",
        supersededBy: "Superseded by", approvedAt: "Requirements approved", approvedBy: "Approved by", changed: "Changed since approval",
      },
      projectCols: ["Feature", "Requirements", "Verified", "Implemented", "Planned", "Untraced"],
      status: { verified: "verified", implemented: "implemented", planned: "planned", untraced: "untraced" },
      gap: {
        "no-task": "no task cites it", "no-test": "no test-plan row covers it", "no-coverage": "no task or planned test covers it",
        "no-coverage-sc": "no test-plan row or quickstart line covers it",
      },
      yes: "yes", no: "no", unknown: "unknown",
      forced: "forced",
      task: {
        verified: (n) => `#${n} verified`, nothing: (n) => `#${n} done (nothing to verify)`, open: (n) => `#${n} open`,
        unverified: (n, why) => `#${n} done, not verified${why ? ` (${why})` : ""}`,
      },
      evidence: (n, cmd, code, at, commit, expectedFail) => `#${n}: ${cmd} → exit ${code}${expectedFail ? " (red run, expected to fail)" : ""}${commit ? ` @${commit}` : ""}${at ? ` · ${at}` : ""}`,
      evidenceNote: (n, note, at) => `#${n}: note — ${note}${at ? ` · ${at}` : ""}`,
      notInCode: "in no test file",
      outsideCode: "run outside test code",
      template: "template — not written yet",
      supersededBy: (list) => `superseded by ${list}`,
      toBeSupersededBy: (list) => `to be superseded by ${list} (not shipped yet)`,
      changedSince: "changed since the requirements approval",
      legend: "One row per requirement ID. Tasks: ✅ verified · ⚠ done, not verified · ☐ open. Status: verified — every linked task done and verified; implemented — done, not all verified; planned — traced, work still open; untraced — a trace gap (named).",
      projectLegend: "Requirement IDs (AC / EC / NFR / SC) per feature, by traceability status — each feature's export has its matrix.",
      approvedLine: (at, by, forced) => `Requirements approved ${at} by ${by}${forced ? " (with --force)" : ""}.`,
      notApproved: "Requirements not approved yet.",
      // 1.21 review C5 — a change: its criteria are signed off with its plan (change.md, phase tasks)
      planApprovedLine: (at, by, forced) => `Plan (change.md) approved ${at} by ${by}${forced ? " (with --force)" : ""}.`,
      planNotApproved: "Plan (change.md) not approved yet.",
      changedSincePlan: "changed since the plan approval",
      none: "No requirement IDs yet.",
      cli: {
        head: (feature, tracks, c) => `Traceability matrix — ${feature} (${tracks}): ${c.rows} requirement(s) · ${c.verified} verified · ${c.implemented} implemented · ${c.planned} planned · ${c.untraced} untraced`,
        legend: "tasks: ✓ verified · ▲ done, not verified · ○ open",
        codeLegend: "tests: ✓ named in a test file · ✗ in no test file · ○ run outside test code",
        approved: (at, by, forced) => `requirements approved ${at} by ${by}${forced ? " (forced)" : ""}`,
        notApproved: "requirements not approved yet",
        planApproved: (at, by, forced) => `plan (change.md) approved ${at} by ${by}${forced ? " (forced)" : ""}`,
        planNotApproved: "plan (change.md) not approved yet",
        notes: { template: "template", superseded: (list) => `superseded by ${list}`, changed: "changed since approval" },
      },
    },
    // Release notes from the specs (spec_changelog / `dev-spec changelog`): headings localized, IDs English-stable.
    releaseNotes: {
      title: (proj) => `Release notes — ${proj}`,
      autogen: "AUTO-GENERATED by dev-spec — do not edit by hand. Regenerate: spec_changelog {write: true} (dev-spec changelog --write).",
      sinceDate: (d) => `Changes since ${d}`,
      sinceLast: (d) => `Changes since the last release notes (${d})`,
      all: "Every change the specs record",
      generated: (d) => `generated ${d}`,
      added: "Added",
      changed: "Changed",
      fixed: "Fixed",
      none: "Nothing.",
      rootCause: (t) => `Root cause: ${t}`,
      noRootCause: "root cause not written in bug.md",
      changeRequest: (n, phase, d) => `change request #${n} (${phase}, ${d})`,
      crParts: { added: (l) => `added: ${l}`, modified: (l) => `modified: ${l}`, removed: (l) => `removed: ${l}`, reopened: (l) => `tasks reopened: ${l}` },
      wrote: (file, a, c, f) => `✎ wrote ${file} — ${a} added · ${c} changed · ${f} fixed`,
      nothingToWrite: (file) => `Nothing to report since then — ${file} was not written and meta.changelogAt is unchanged.`,
      badSince: (v) => `since: '${v}' is not an ISO date (YYYY-MM-DD, or a full ISO timestamp), 'last' or 'all'.`,
      noLast: "No release notes were written yet (roadmap.json meta.changelogAt is unset) — every change is listed.",
    },
    // 1.16 E1 — Gherkin export (spec_export {format: "gherkin"}): the comment lines of the .feature file — the Gherkin keywords
    // are Gherkin's own dialect (spec.js GHERKIN_DIALECT), the steps the spec's EARS clauses.
    gherkin: {
      autogen: "AUTO-GENERATED by dev-spec — do not edit by hand. Regenerate: spec_export {format: \"gherkin\"} (dev-spec export <feature> --gherkin).",
      source: (rel) => `Source: ${rel} — one scenario per current acceptance criterion; EARS → Given (WHILE / WHERE / IF) · When (WHEN) · Then (the SHALL clause).`,
      summaryLabel: "Summary",
      template: (id) => `${id} — template, not written yet: left out`,
      superseded: (id, by) => `${id} — superseded by ${by} (shipped): left out`,
      unsplit: "EARS clauses not split cleanly — the whole criterion is one Then step",
      noScenarios: "No current acceptance criterion yet.",
      spike: (slug) => `'${slug}' is a spike — it has no acceptance criteria to export as Gherkin (spec_export {name: "${slug}"} without format gherkin exports its document).`,
      wroteMany: (n, scenarios) => `✎ wrote ${n} .feature file(s) — ${scenarios} scenario(s)`,
      noFeatures: "No active feature with acceptance criteria to export.",
    },
    // 1.16 E2 — tracker CSV (spec_export {format: "jira" | "linear"}): the text dev-spec adds to the work items; the column
    // names are the importers' own (English — never translated).
    trackerCsv: {
      autogen: "AUTO-GENERATED by dev-spec — do not edit by hand; leave this column unmapped. Regenerate: spec_export {format: \"jira\" | \"linear\"} (dev-spec export --tracker jira|linear).",
      featureLine: (rel, tracks, phase, done, total) => `dev-spec feature ${rel} · tracks ${tracks} · phase: ${phase} · ${done}/${total} tasks done`,
      acceptance: "Acceptance criteria:",
      taskLine: (rel, n) => `dev-spec task #${n} — ${rel}`,
      wrote: (file, n) => `✎ wrote ${file} — ${n} work item(s)`,
    },
    // 1.16 E3 — milestones (spec_milestone; roadmap.json meta.milestones): the status codes stay English (on-track · at-risk ·
    // late · done), these are their labels.
    milestone: {
      title: "Milestones",
      cols: ["Milestone", "Date", "Features", "Done", "ETA", "Status"],
      status: { "on-track": "on track", "at-risk": "at risk", late: "late", done: "done" },
      archivedLabel: "archived",
      line: (name, date, done, total, eta, status, feats, archived) => `${name} — ${date} · ${done}/${total} feature(s) done · ETA ${eta || "—"} · ${status} · ${feats || "—"}${archived ? ` (archived: ${archived})` : ""}`,
      head: (n, today) => `${n} milestone(s) — today ${today}:`,
      none: "No milestones yet — add one: " + DEV_SPEC + " milestone add <name> <YYYY-MM-DD> <features…> (spec_milestone {action: \"add\", name, date, features}).",
      added: (name, date, list) => `Milestone '${name}' added — ${date}: ${list}`,
      updated: (name, date, list) => `Milestone '${name}' updated — ${date}: ${list}`,
      removed: (name) => `Milestone '${name}' removed.`,
      attention: {
        late: (date, done, total, eta) => `milestone late — its date ${date} has passed with ${done}/${total} feature(s) done${eta ? ` (ETA ${eta})` : ""}`,
        "eta-after-date": (date, eta) => `milestone at risk — the latest ETA of its features (${eta}) is after its date ${date}`,
        "eta-unknown": (date, eta, list) => `milestone at risk — no ETA yet for ${list} (due ${date}): not enough velocity data, or no tasks yet`,
        "no-features": (date) => `milestone at risk — it has no active feature left (due ${date})`,
        invalid: (n, names, rel) => `${n} invalid entr${n === 1 ? "y" : "ies"} (${names}) in ${rel} — ignored: no status, and a feature's rename / archive / remove / restore doesn't follow in ${n === 1 ? "it" : "them"}; fix ${n === 1 ? "it" : "them"} by hand (a valid name, a real YYYY-MM-DD day, lists of feature slugs, one entry per name).`,
        notList: (rel) => `${rel} → meta.milestones is not a list — no milestone is read, and a feature's rename / archive / remove / restore doesn't follow in it; fix it by hand.`,
      },
      nameRequired: "Name the milestone (name).",
      badName: (v) => `invalid milestone name '${v}' — letters, digits, spaces and . _ : # ( ) + - (up to 60 characters, starting with a letter or a digit).`,
      badDate: (v) => `date: '${v}' is not a day in YYYY-MM-DD form (e.g. 2026-10-31).`,
      noFeatures: "Name at least one feature of the milestone (features).",
      unknownFeatures: (list) => `Every milestone feature must be an existing active feature — not found: ${list}`,
      tooMany: (max) => `at most ${max} milestones — remove one first (${DEV_SPEC} milestone rm <name>).`,
      tooManyFeatures: (max) => `at most ${max} features per milestone.`,
      notFound: (name, list) => `No milestone '${name}' (milestones: ${list}).`,
      badStored: (rel) => `${rel} → meta.milestones is not a list of {name, date, features} as milestone add writes them (a valid name, a real YYYY-MM-DD day, one entry per name) — fix it by hand; refusing to change it.`,
      notesTitle: (title, name) => `${title} — ${name}`,
      notesScope: (name, date, list) => `Milestone ${name} (${date}): ${list}`,
      notesAutogen: "AUTO-GENERATED by dev-spec — do not edit by hand. Regenerate: spec_changelog {milestone, write: true} (dev-spec changelog --milestone <name> --write).",
      nothingToWrite: (file) => `Nothing to report for this milestone — ${file} was not written.`,
    },

    // Team governance (approvals by role — roadmap.json meta.approvalRoles) and the fast-forward approval (spec_approve {through}).
    governance: {
      rolesShape: "approvalRoles must map phases to role lists, e.g. {\"requirements\": [\"product\"], \"design\": [\"tech\", \"security\"]} (CLI: --roles requirements=product,design=tech+security; --roles none clears them)",
      rolesPhase: (phase, known) => `approvalRoles: unknown phase '${phase}' (known: ${known})`,
      rolesEmpty: (phase) => `approvalRoles.${phase}: name at least one role`,
      badRole: (role) => `invalid role name '${role}' — use letters, digits, '-', '_' or '.' (at most 40 characters)`,
      rolesSet: (summary) => `Approval roles: ${summary} — each listed phase counts as approved only once every role has signed off its current content (spec_approve {role} / --role).`,
      rolesCleared: "Approval roles cleared — every phase takes a single approval again.",
      phaseRequired: "Name the phase to approve — or through: <phase> (CLI: --through <phase>) to fast-forward up to it.",
      roleRequired: (phase, slug, roles) => `'${phase}' is signed off per role (${roles}) — say which role you sign for: /approve ${slug} ${phase} --role <role> (spec_approve {role}). Nothing recorded.`,
      roleNotListed: (role, phase, roles) => `'${role}' is not a role that signs off '${phase}' (roles: ${roles}) — nothing recorded.`,
      missing: (list) => `${list.length > 1 ? "missing roles" : "missing role"}: ${list.join(", ")}`,
      stepForced: (ids) => ` (forced: ${ids.join(", ")})`,
      signedOff: (phase, slug, role) => `Signed off '${phase}' for ${slug} as ${role} ✓`,
      signedForced: (ids) => `Signed off with force — the failing checks are recorded with the sign-off: ${ids}.`,
      stillPending: (phase, missing) => `'${phase}' stays pending until every role has signed off its current content — ${missing}.`,
      approvedByRoles: (phase, roles) => `'${phase}' is approved — every role signed off the current content: ${roles}.`,
      // r5 review: one person signing a phase for two required roles — a warning, never a refusal
      sameSigner: (by, phase, roles) => `Note: ${by} signed '${phase}' for several roles (${roles}) — role sign-offs are meant to come from different people.`,
      staleSignOffs: (list) => `sign-offs made before the artifact changed no longer count (re-sign the current content): ${list}`,
      resigning: (list) => `re-sign in progress (the phase stays approved as it was until every role has signed the new content): ${list}`,
      unsigned: (list) => `approved without the role sign-offs now required (approved before the roles were configured or changed — counted as approved by an unknown role; ask each role to re-sign): ${list}`,
      approveRoles: (phase, slug, missing, signed, first) => `Review & sign off '${phase}' — ${missing}${signed ? ` (signed: ${signed})` : ""}: /approve ${slug} ${phase} --role ${first}.`,
      // 1.21 review A1 — every required role signed the current content, yet the phase has no approval (the sign-offs were recorded
      // apart: on two branches git merged, or before a role was dropped). Any of them signs again and the phase is approved.
      signedAll: (roles) => `every role signed: ${roles} — not approved yet`,
      signoffsComplete: (list, cmd) => `every role signed off, but the phase was never approved (the sign-offs were recorded apart — on two merged branches, or before a role was dropped): ${list} — one of those roles signs again to complete it: ${cmd}`,
      completeSignoffs: (phase, slug, signed, first) => `Every role has signed off '${phase}' (${signed}), but it isn't approved yet — the sign-offs were recorded apart (two merged branches?). One of them signs again to complete it: /approve ${slug} ${phase} --role ${first}.`,
      roadmapAwaiting: (list) => `awaiting role sign-off: ${list}`,
      resignHint: (list, cmd) => `Each role signs the new content again — ${list}: ${cmd}.`,
      ffBoth: "Pass either a phase or through (the fast-forward), not both.",
      ffExecution: "The fast-forward covers the planning phases only (through 'tasks' at most) — sign off 'execution' on its own, after /spec-finish.",
      ffNotActive: (phase, slug) => `'${phase}' is not an approvable phase of '${slug}' right now (its track is off, or the plan it signs off doesn't exist yet) — nothing approved.`,
      ffNothing: (slug, through) => `Nothing to fast-forward: every active phase of '${slug}' through '${through}' is already approved.`,
      ffDone: (slug, list, through) => `Fast-forward '${slug}': approved ${list}, in order, each through its own gate — every phase through '${through}' is approved.`,
      ffStopped: (slug, phase, list, why) => `Fast-forward '${slug}' stopped at '${phase}'${list ? ` (approved before it: ${list})` : " (nothing approved)"} — ${why}`,
      ffWhyRefused: (ids, lines, slug, phase) => `its gate refuses it — failing checks: ${ids}.\n${lines}\nFix them (details: /spec-doctor ${slug}), then run the fast-forward again (it resumes at '${phase}').`,
      ffWhyRoles: (missing) => `signed off, but it waits for the other roles (${missing}) — the later phases can't be approved before it.`,
      // A role refusal inside a fast-forward (the phases before it stay approved): given = the role named that doesn't sign this phase.
      ffWhyRole: (roles, slug, phase, through, given) => (given ? `'${given}' is not a role that signs off '${phase}' (roles: ${roles})` : `'${phase}' is signed off per role (${roles})`) +
        ` — nothing was recorded for '${phase}'. Run the fast-forward again as the role you sign for: /spec-ff ${slug} --role <role> (CLI: ${DEV_SPEC} approve ${slug} --through ${through} --role <role>); it resumes at '${phase}'.`,
      ffHint: (slug, list, role) => `Every planning artifact through tasks is filled and passes its gate — fast-forward: /spec-ff ${slug}${role ? " --role " + role : ""} (CLI: ${DEV_SPEC} approve ${slug} --through tasks${role ? " --role " + role : ""}) approves ${list} in order, each through its own gate.`,
      // 1.21 review C3 — a size xs / s plan whose Phase 4 tests gate is still ahead: the call ends before it
      ffHintTests: (slug, list, through, role) => `Every planning artifact through ${through} is filled and passes its gate — fast-forward: /spec-ff ${slug} ${through}${role ? " --role " + role : ""} (CLI: ${DEV_SPEC} approve ${slug} --through ${through}${role ? " --role " + role : ""}) approves ${list} in order, each through its own gate. Then Phase 4: write the failing tests / eval sets (/writeTests ${slug}), approve tests, then the tasks.`,
      batch: (n) => `  batch approvals (fast-forward): ${n}`,
    },

    // 1.16 U — undo a tick (spec_complete_task {undo} / `dev-spec undone`), revoke an approval (spec_approve {revoke} /
    // `approve --revoke`) and the waiver a forced approval carries (reason / expires).
    undo: {
      unticked: (n, slug, runnable, stale) => `Task ${n} is open again (unticked).` +
        (stale ? ` Its recorded evidence no longer counts — ticking it again needs ${runnable ? `a new run of its _Verify:_ command: ${DEV_SPEC} done ${slug} ${n} --run` : "new evidence"}.` : ""),
      alreadyOpen: (n) => `Task ${n} is not ticked — nothing to undo.`,
      // 1.16 U review 1: an _Expect: fail_ task keeps its red run through an undo (the fix may already be in)
      redKept: (n, slug, day) => `Its red run of ${day} (the _Expect: fail_ proof) is kept: ticking it again needs a new run of its _Verify:_ command — once the fix is in, a passing run counts as the fix going green: ${DEV_SPEC} done ${slug} ${n} --run.`,
      // 1.16 U review 2: several ticked tasks share the number — refused
      duplicateTicked: (n, list) => `Several ticked tasks share number ${n} (${list}) — undo can't tell which tick was the mistake. Renumber them first so each number is unique (doctor: duplicate-tasks), then undo the one ticked by mistake. Nothing was changed.`,
      duplicateItem: (line, text) => `line ${line}: "${text}"`,
      reopened: (slug) => `'${slug}' was finished or signed off — once the task is done again, finish it again (/spec-finish ${slug}) and sign it off again (/approve ${slug} execution).`,
      noEvidence: "undo takes no evidence — it only unticks the task (record the new run when you tick it again).",
      reasonNeedsUndo: "reason goes with undo (spec_complete_task {undo: true, reason} / " + DEV_SPEC + " undone <feature> <n> --reason \"…\") — a tick records evidence instead.",
      badReason: (max) => `reason must be text (one line, at most ${max} characters).`,
      staleNote: (n, slug, runnable) => `Task ${n}: it was unticked after this evidence was recorded — it stays unverified until ` +
        (runnable ? `a new run is recorded: ${DEV_SPEC} done ${slug} ${n} --run` : "new evidence is recorded."),
      label: "unticked since this evidence was recorded",
      cliDone: (n, done, total) => `Task ${n} unticked. ${done}/${total}`,
      cliAlready: (n, done, total) => `Task ${n} was not ticked. ${done}/${total}`,
      driftWhy: (list) => `unticked since: ${list}`,
      signOffWhy: (list) => `the untick of ${list}`,
    },
    revoke: {
      revoked: (phase, slug) => `Revoked the approval of '${phase}' for ${slug} — the phase is pending again (doctor, next_action and spec_finish ask for it).`,
      withdrawn: (phase, slug, roles) => `Withdrew the role sign-off(s) waiting for '${phase}' of ${slug}: ${roles} — nothing was approved yet.`,
      signOffsToo: (roles) => `The role sign-offs waiting for it were withdrawn too: ${roles}.`,
      laterStay: (list, phase) => `Nothing cascades: the later phases stay approved (${list}); approving another phase is refused (phase-order) until '${phase}' is approved again.`,
      notApproved: (phase, slug) => `'${phase}' is not approved for ${slug} and no role sign-off is waiting for it — nothing to revoke.`,
      // r5 review: with approval roles configured for the phase, a revocation names a listed role; before the approval it withdraws that role's own sign-off
      roleRequired: (phase, slug, roles) => `'${phase}' is signed off per role (${roles}) — a revocation names the role revoking it: /approve ${slug} ${phase} --revoke --role <role>. Nothing recorded.`,
      noSignOff: (role, phase, slug, waiting) => `'${role}' has no sign-off waiting for '${phase}' of ${slug} — nothing to withdraw (waiting: ${waiting}); a role withdraws only its own sign-off.`,
      phaseRequired: "Name the phase whose approval to revoke.",
      noThrough: "revoke takes one phase — not through (the fast-forward).",
      noForce: "revoke takes no force or expires — it removes an approval; reason says why.",
      // 1.16 U review 3: a revocation after the finish / the execution sign-off (drift's stale line, next_action's sign-off step)
      driftWhy: (list) => `approval revoked: ${list} (approve it again before finishing again)`,
      signOffWhy: (list) => `the revocation of ${list}`,
    },
    waiver: {
      badExpires: (v, max) => `expires must be an ISO date (YYYY-MM-DD, today or later in UTC — valid through that day, UTC — at most ${max} days ahead) or a number of days (30d, 1–${max}) — got ${v}.`,
      needsForce: "reason / expires describe a waiver — they go with force (reason also with revoke).",
      notForced: "The gate passed — nothing was waived: the reason / expiry were not recorded.",
      recorded: (reason, expires) => `Waiver recorded${reason ? `: ${reason}` : ""}${expires ? ` (expires ${expires})` : ""}.`,
      doctor: (list, slug) => `forced approvals whose waiver expired: ${list} — fix the failing checks and re-approve without force (/approve ${slug} <phase>), or renew the waiver (/approve ${slug} <phase> --force --reason "…" --expires 30d)`,
      expiredItem: (phase, expires, reason) => `${phase} (expired ${expires}${reason ? ` — ${reason}` : ""})`,
      roadmapItem: (phase, reason, expires, expired) => `${phase} (${[reason ? `waiver: ${reason}` : "waiver", expires ? (expired ? `EXPIRED ${expires}` : `until ${expires}`) : null].filter(Boolean).join(", ")})`,
      prHeading: "## Waived gates (forced approvals)",
      prLine: (phase, failing, reason, expires, expired) => `- ${phase} — forced over: ${failing || "—"} · ${reason ? `reason: ${reason}` : "no reason recorded"}${expires ? ` · ${expired ? "EXPIRED" : "expires"} ${expires}` : ""}`,
      finishWarn: (list, slug) => `waivers expired on forced approvals: ${list} — re-approve those phases without force, or renew the waiver (${DEV_SPEC} approve ${slug} <phase> --force --reason "…" --expires 30d)`,
    },

    // Roadmap forecasts (_Size:_ points → velocity → ETA) and cross-feature file overlaps (spec.js: forecastData, featureOverlaps).
    forecast: {
      colEta: "ETA",
      etaCell: (eta, low, high) => `${eta}${low ? ` (${low}…${high})` : ""}`,
      cliEta: (eta, low, high) => `ETA ${eta}${low ? ` (${low}…${high})` : ""}`,
      velocity: (v) => `Velocity: ${v.pointsPerDay} point(s)/working day — ${v.completed} task(s), ${v.points} point(s) completed since ${v.since} (last ${v.windowDays} days)`,
      notEnough: (v) => `Velocity: not enough data yet — ${v.completed} of the ${v.minTasks} completed tasks a forecast needs in the last ${v.windowDays} days`,
      metricsVelocity: (v) => (v.completed ? `  velocity: ${v.pointsPerDay} point(s)/working day (${v.completed} task(s), ${v.points} point(s) since ${v.since}, last ${v.windowDays} days)${v.enough ? "" : ` — not enough data for a forecast yet (${v.minTasks} needed)`}`
        : `  velocity: no completed task in the last ${v.windowDays} days`),
      etaNote: (pct) => `ETA = remaining points ÷ velocity, in working days (±${pct}%) · \`_Size: XS|S|M|L|XL_\` on a task = 1/2/3/5/8 points; an unsized task counts as its feature's median (else M) · a feature waiting on a dependency starts after that one's ETA.`,
      overlap: {
        attentionActive: (other, files) => `plans the same files as ${other}: ${files} — order them (spec_depend) or declare _Supersedes:_ if one replaces the other's behaviour`,
        attentionFinished: (other, files) => `plans files in ${other}'s finish baseline: ${files} — declare _Supersedes: ${other}/US-n.AC-m_ where it replaces that behaviour, or spec_drift flags ${other} after the merge`,
        doctorActive: (list, slug) => `open tasks plan the same files as another active feature — ${list}: both land on them at merge time and one drifts silently. Order the two (spec_depend {name: "${slug}", add: ["<other>"]} · ${DEV_SPEC} depend ${slug} <other>) or, where one replaces the other's behaviour, declare _Supersedes: <other>/US-n.AC-m_`,
        doctorFinished: (list, slug) => `open tasks plan files a finished feature recorded in its drift baseline — ${list}: after the merge spec_drift flags it. Declare _Supersedes: <feature>/US-n.AC-m_ on the criteria of ${slug} that replace its behaviour, make ${slug} depend on it where it builds on it (spec_depend {name: "${slug}", add: ["<feature>"]} · ${DEV_SPEC} depend ${slug} --add <feature>), or re-finish it after the merge (spec_finish)`,
        hookLine: (n, list) => `⚠ ${n} cross-feature file overlap(s): ${list} — run /spec-doctor on them (order them with /depend, or declare _Supersedes:_)`,
        cliHead: (n) => `⚠ ${n} cross-feature file overlap(s):`,
        cliActive: (a, b, files) => `  ${a} ↔ ${b}: ${files}`,
        cliFinished: (a, b, files) => `  ${a} → ${b} (finished): ${files}`,
        more: (n) => `+${n} more`,
      },
    },

    // 1.14 B5 — red → green (_Expect: fail_), project checks (roadmap.json meta.checks) + the finish suite run, `dev-spec log`.
    redGreen: {
      passRefused: (n) => `Task ${n} expects its test to FAIL (_Expect: fail_), but the run passed (exit 0) — the test doesn't fail yet, so it tests nothing. Make it fail for the right reason (an assertion, "not implemented" — not a typo or a missing import), then record that run. Not marking it done.`,
      passTicked: (n) => `Task ${n} is ticked, but it expects its test to FAIL (_Expect: fail_) and this run passed (exit 0) with no red run recorded before it — the test tests nothing: recorded; the task now counts as unverified until a failing (red) run is recorded.`,
      cantRun: (n, code, ticked) => `Task ${n}: exit ${code} means the command itself could not run (not found / not executable) — that is no red test (_Expect: fail_). Fix the _Verify:_ command, then record the failing run. ` + (ticked ? "Recorded; the task now counts as unverified." : "Not marking it done."),
      passAfterRed: (n, day) => `Task ${n}: its test passes now — expected once the fix is in; the red run recorded on ${day} stays the proof (_Expect: fail_).`,
      unexpectedPassNote: (n, slug) => `Task ${n} expects its test to FAIL (_Expect: fail_), but its latest run passed with no red run before it — it stays unverified until a failing run is recorded: ${DEV_SPEC} done ${slug} ${n} --run`,
      redRecorded: (n, code) => `  ✓ red run recorded for task ${n} (exit ${code}) — the test fails before its fix, as _Expect: fail_ expects.`,
      shellNotRed: (cmd) => `the default Windows shell (cmd.exe) could not run \`${cmd}\` as written — that is no red test (_Expect: fail_). Nothing was recorded; the task stays open.`,
      pwshNotRed: (cmd, what) => `PowerShell could not parse \`${cmd}\` (${what}) — the command never ran, so that is no red test (_Expect: fail_). Nothing was recorded; the task stays open. Windows PowerShell 5.1 has no && / || (use ; or pwsh 7).`,
      // full review Ga2: a non-zero run whose output shows the test never ran (a missing test file, module or script…).
      cantRunOutput: (n, code, what, ticked) => `Task ${n}: the run exited ${code}, but its output shows the test never ran (${what}) — that is no red test (_Expect: fail_): a missing test file, module or script is not the right reason. Write the test so it fails on an assertion (or "not implemented"), then record that run. ` + (ticked ? "Recorded; the task now counts as unverified." : "Not marking it done."),
      notRed: (cmd, what) => `\`${cmd}\` failed, but its output shows the test never ran (${what}) — that is no red test (_Expect: fail_): a missing test file, module or script is not the right reason. Nothing was recorded; the task stays open. Write the test so it fails on an assertion (or "not implemented"); then run done --run again.`,
      // 1.23 review: a crash (exit 128 + SIGSEGV / SIGABRT…, a Windows crash code such as 0xC0000005) is a failed run, never a red test
      crashNotRed: (n, code, ticked) => `Task ${n}: the run crashed (exit ${code} — a signal such as SIGSEGV / SIGABRT, or a Windows crash code) — that is no red test (_Expect: fail_): a crash is not the test failing for the right reason. Make the test fail on an assertion (or "not implemented"), then record that run. ` + (ticked ? "Recorded; the task now counts as unverified." : "Not marking it done."),
      prRed: "the expected red run (_Expect: fail_)",
      prRedKept: (code, day) => `red run before the fix: exit ${code}${day ? " on " + day : ""}`,
      doctorMissing: (list) => `T-IDs made green by done tasks without a recorded red run: ${list} — a test that never failed proves nothing. Mark the task that writes it with _Expect: fail_ and record its failing run before the fix (${DEV_SPEC} done <feature> <n> --run).`,
      doctorOk: (n) => `every T-ID made green by a done task (${n}) has a recorded red run`,
      briefExpect: "**Expected result: FAIL** (_Expect: fail_) — the run must exit non-zero: the test fails for the right reason before the fix (an assertion / not implemented — not a typo, a missing import or a command that doesn't run). A passing run is refused: it would mean the test tests nothing.",
      dodExpect: "The _Verify:_ run must FAIL (non-zero exit) for the right reason — put the command, its exit code and the failure in the report; it is recorded as the task's red run.",
      naVerify: (n, slug) => `Task ${n} is marked _Expect: fail_: its proof is a run that FAILS (its test red before the fix) — a passing run doesn't count. Record the red run (${DEV_SPEC} done ${slug} ${n} --run while the test fails — before the fix, or with the fix stashed), or drop _Expect: fail_ if the task is no red test.`,
    },
    projectChecks: {
      badInput: 'checks must be an object of name → command (e.g. {"test": "npm test"}); an empty command removes that check.',
      badName: (k) => `invalid check name '${k}' — letters, digits and . _ : - (up to 40 characters, starting with a letter or a digit).`,
      badCommand: (k) => `the command of check '${k}' must be one line of text (up to 500 characters) — or empty to remove the check.`,
      tooMany: (max) => `at most ${max} project checks.`,
      badStored: (rel) => `${rel} → meta.checks is not an object of name → command strings — fix it by hand; refusing to change it.`,
      initLine: (list) => `Project checks (meta.checks): ${list}`,
      evidenceNotList: "evidence must be a list of check runs: [{name, command, exitCode, summary}].",
      noChecks: 'no project checks configured (roadmap.json meta.checks) — nothing to record. Set them first: spec_init {checks: {"test": "npm test"}} (CLI: ' + DEV_SPEC + ' init --check test="npm test").',
      evidenceItem: (i, why) => `evidence[${i}]: ${why}`,
      itemNotObject: "each run must be an object {name, command, exitCode, summary}",
      unknownCheck: (name, list) => `'${name}' is not a project check — one of: ${list}`,
      needsCommand: "the command that ran is required",
      needsExit: "its exit code (an integer) is required",
      status: (i) => ({ "no-run": "no run recorded", failed: `latest run failed (exit ${i.exitCode})`, changed: "the run is not of its command (or the command changed since)", "before-last-tick": "ran before the last task activity", "code-changed": "the implementing files changed since the run", unobserved: "the run was not observed by the harness" })[i.status] || i.status,
      blocker: (list, slug) => `project checks without a passing run since the last task activity: ${list} — run them: ${DEV_SPEC} finish ${slug} --run (or record the runs with spec_finish {evidence})`,
      doctorWarn: (list, slug) => `every task is done, but project checks have no passing run since the last task activity: ${list} — spec_finish refuses until they pass: ${DEV_SPEC} finish ${slug} --run`,
      doctorOk: (n) => `every project check (${n}) has a passing run since the last task activity`,
      invalidStored: (list) => `roadmap.json meta.checks: invalid entries ignored (${list}) — each must be "name": "one-line command"`,
      prChecks: "## Project checks",
      prNoRun: "no run recorded",
      briefDod: (list) => `Run the project checks and put each command, its exit code and the last lines of its output in the report — nothing that passed before this task may fail after it: ${list}.`,
      briefDodRed: (list) => `Run the project checks and put each command, its exit code and the last lines of its output in the report — the only failures allowed are this task's new red test(s); everything that passed before must still pass: ${list}.`,
      naFinish: (slug, list) => `Project checks are configured (${list}): finishing needs a passing run of each since the last task activity — ${DEV_SPEC} finish ${slug} --run runs and records them (or run them and record each with spec_finish {evidence: [{name, command, exitCode, summary}]}).`,
      recorded: (n) => `Recorded ${n} project check run(s) in .state.json → finishChecks.`,
      noneToRun: 'no project checks to run (roadmap.json meta.checks) — set them: ' + DEV_SPEC + ' init --check test="npm test" [--check lint="npm run lint"]',
      badArg: (v) => `--check expects name=command (got '${v}') — an empty command (name=) removes that check`,
      posixOnWindows: (name, cmd, kinds) => `the project check '${name}' (\`${cmd}\`) uses POSIX shell syntax (${kinds.map((k) => ({ "single-quotes": "single quotes '…'", variable: "$VARIABLES" })[k] || k).join(", ")}) that cmd.exe — the default shell of --run on Windows — reads differently, often without failing. Nothing was run. Re-run with --shell bash (Git Bash; or set DEV_SPEC_SHELL=bash), with --shell pwsh for a PowerShell command (or hand PowerShell the script in double quotes: pwsh -NoProfile -Command "…") — or --shell cmd to run it under cmd.exe anyway.`,
      pwshInPosix: (name, cmd, kinds, shell) => `the project check '${name}' (\`${cmd}\`) hands PowerShell a script holding ${kinds.map((k) => ({ variable: "$VARIABLES", backtick: "backticks" })[k] || k).join(" and ")} outside single quotes, but a POSIX shell (${shell}) runs the line and expands them first — \`exit $LASTEXITCODE\` becomes a bare \`exit\` (exit 0), so a failing check could be recorded as passing. Nothing was run. For a POSIX shell put the script in single quotes, or run the checks with --shell pwsh (or DEV_SPEC_SHELL=pwsh) and write the bare PowerShell.`,
    },
    // full review Ga1 / Ga9 / Ga10 — `done --run` / `finish --run`: a command that could not run (the shell never started, a
    // signal, --timeout, output over the buffer, WSL's bash launcher) is refused and NOTHING is recorded (never an exit 1).
    runGate: {
      taskRefused: (cmd, why) => `\`${cmd}\` could not run (${why}) — nothing was recorded; the task stays open.`,
      checkRefused: (name, cmd, why) => `the project check '${name}' (\`${cmd}\`) could not run (${why}) — nothing was recorded; fix that and run finish --run again.`,
      why: {
        spawn: (shell, code) => `the shell '${shell}' could not be started: ${code}`,
        signal: (sig) => `it was killed by signal ${sig}`,
        timeout: (s) => `it did not finish within --timeout ${s} s`,
        buffer: "its output exceeded 64 MB",
        wsl: (text) => `the bash that ran it is WSL's launcher, not a shell on this machine: ${text}`,
        shell: (text) => `the shell could not start it: ${text}`,
        error: (code) => `the run could not start: ${code}`,
      },
      wslBash: (p) => `--shell ${p} is WSL's bash.exe launcher: it runs the command inside a Linux distribution (or fails with "execvpe(/bin/bash) failed"), not in a shell on this machine — used as you asked; a run WSL can't start is not recorded. For a shell on this machine use Git Bash: --shell bash finds it (Git for Windows).`,
      wslExe: (p) => `--shell ${p} is wsl.exe, which is no shell (it rejects the -c every shell run uses) — refused, nothing was run. Name WSL's bash.exe by its path to run inside WSL, or use --shell bash for Git Bash.`,
      noGitBash: "--shell bash: no Git Bash was found (git --exec-path, %ProgramFiles%\\Git\\bin\\bash.exe, PATH) — a bash.exe in System32 or WindowsApps is WSL's launcher, which runs the command inside a Linux distribution, so it is never used. Nothing was run. Install Git for Windows, or pass --shell with the full path of a bash.exe.",
    },
    gitLog: {
      head: (slug, n, citing, truncated) => `Commits: ${slug} — ${n} commit(s) read${truncated ? " (the window is full: older commits were not read — --max N)" : ""}, ${citing} cite its tasks`,
      taskLine: (n, text, done, list) => `  ${done ? "[x]" : "[ ]"} #${n} ${text} — ${list}`,
      commitRef: (short, subject, via) => `${short} ${subject} (${via})`,
      more: (n) => `+${n} more`,
      noCommit: "no commit cites it",
      implFirst: (n, tests, taskC, testC, files) => `red-first: task ${n} (makes ${tests} green) was first committed in ${taskC}, before any commit touching a test file that names ${tests} (${files} — first in ${testC}): the implementation came before its test.`,
      testNotCommitted: (n, tests, taskC, files) => `red-first: task ${n} (makes ${tests} green) is committed (${taskC}), but no commit read touches a test file that names ${tests} (${files}) — commit the test first.`,
      redFirstStatus: (n, tests, status) => `red-first: task ${n} (${tests}) — ` + ({ ok: "the test was committed first ✓", "no-test-file": "no test file names it yet (nothing to compare)", "no-task-commit": "no commit cites the task yet", "outside-window": "can't tell: the log window is full (--max N)" })[status],
      conventions: (slug) => `No commit cites a task of '${slug}'. Conventions: name the feature and the task — "Part of .specs/${slug}/ task #N." (what /spec-commit writes) — or the IDs it covers: "Makes T-01 green", US-1.AC-2.`,
      noGit: "git is not available here, or this is not a git repository with commits — dev-spec log reads `git log`. Or pipe a log in: git log --name-only --relative | " + DEV_SPEC + " log <feature> -",
    },

    // 1.14 C1 — the evidence gate at the end of a turn (hooks/stop-hook.js on Stop / SubagentStop, `dev-spec stop-check`) and the
    // scope guard (roadmap.json meta.guard = "scope"). claims / negators / admissions are regex sources the engine applies from
    // EVERY language (an agent may answer in another language than the project's) as whole words, case-insensitive. Conservative
    // on purpose: a claim counts only outside code and quotes, not in a question, and not after a negator or a condition.
    stopGate: {
      claims: [
        String.raw`all\s+(?:done|finished|complete|completed|green)`,
        String.raw`(?:tasks?|steps?)\s+#?\d+(?:\s*(?:,|and|&|[-–]|to)\s*#?\d+)*\s+(?:(?:is|are|has\s+been|have\s+been)\s+)?(?:now\s+)?(?:done|finished|complete|completed|implemented|verified)`,
        String.raw`all\s+(?:(?:the|of\s+the)\s+)?(?:\d+\s+)?(?:tasks?|steps?|items?|stories|checks?)\s+(?:(?:are|have\s+been|now)\s+)*(?:done|finished|complete|completed|implemented|verified|green|passing)`,
        // …ending its clause ("Feature complete.", "Fix done ✅") — never "the implementation done so far", "the task done list"
        String.raw`(?:feature|story|task|implementation|fix|bugfix|refactor|migration)\s+(?:now\s+)?(?:done|finished|complete|completed|implemented|verified)(?=[ \t]*(?:[.!,;:—–)]|$|\p{Extended_Pictographic}|✓|✔))`,
        String.raw`[\p{L}\p{N}_]+(?:['’](?:s|m|re)|\s+is|\s+are|\s+am|\s+has\s+been|\s+have\s+been)\s+(?:now\s+|all\s+|fully\s+)?(?:done|finished|complete|completed|implemented|verified)`,
        String.raw`(?:i|we)(?:['’]ve|\s+have)\s+(?:now\s+|just\s+|also\s+)?(?:finished|completed|implemented|verified)`,
        String.raw`^[ \t*_#>\p{Extended_Pictographic}\uFE0F\u2713\u2714-]*(?:all\s+)?(?:done|finished|complete|completed|implemented|verified)[*_]*(?=[ \t]*(?:[.,!:—–\p{Extended_Pictographic}\u2713\u2714-]|$))`,
        String.raw`status\W{0,8}done(?:_with_concerns)?`,
        String.raw`(?:all\s+(?:the\s+)?(?:\d+\s+)?|the\s+)?(?:unit\s+|integration\s+|e2e\s+)?tests?\s+(?:(?:are|now|all|still)\s+)*(?:pass|passes|passed|passing|green)`,
        String.raw`[1-9]\d*\s*(?:\/\s*\d+\s+)?(?:tests?\s+)?(?:passing|passed)`,
        String.raw`(?:everything|it|all|this)\s+(?:now\s+)?works`,
        String.raw`(?:fully|thoroughly)\s+tested|tested\s+and\s+(?:working|verified)`,
        String.raw`verified|implemented|finished|completed`,
      ],
      // Up to 3 words before a claim, in the same sentence: it is negated or only a condition / a plan ("not done", "once the
      // tests pass", "I'll verify"). Words ending in n't / 'll count too (the engine checks those suffixes).
      negators: ["not", "never", "no", "nothing", "nor", "none", "without", "cannot", "will", "would", "should", "must", "need", "needs", "to",
        "going", "gonna", "can", "could", "may", "might", "until", "unless", "before", "once", "when", "whenever", "after", "if", "whether",
        "almost", "nearly", "partially", "partly", "yet"],
      // The message says plainly that something is NOT verified (or fails): never sent back.
      admissions: [
        String.raw`(?:not|never|\p{L}+n['’]t)\s+(?:(?:been|yet|fully|actually|be|all|really)\s+){0,2}(?:verified|tested|run)`,
        String.raw`unverified|untested`,
        String.raw`(?:without|no)\s+(?:passing\s+)?evidence`,
        String.raw`[1-9]\d*\s+(?:tests?\s+|of\s+(?:them|the\s+tests)\s+)?(?:(?:are|is|still|remain)\s+)*(?:failing|failed|failures?)`,
        String.raw`tests?\s+(?:(?:are|is|still)\s+)*(?:failing|fail|fails|failed)`,
        String.raw`status\W{0,8}(?:blocked|needs_context)`,
      ],
      // A failure named after (or before) one of these words is history, not an admission: "I fixed the 2 failing tests",
      // "Previously 4 tests failed", "the 3 failures from yesterday are fixed" (stopPastFailure — a negator before the word keeps it).
      fixed: ["fixed", "resolved", "repaired", "addressed", "previously", "formerly", "earlier"],
      // 1.22 review — a count of ZERO right before an admission makes it none ("0 tests failing", "no tests fail", "none of the
      // tests fail", "zero tests failed"): it says nothing is failing. Regex sources, read just before the admission.
      zeroes: [String.raw`0|zero|no|none(?:\s+of(?:\s+(?:the|these|those|them|my|our))?)?`],
      // …and a failure that "now passes" in the same clause is one already fixed ("the 2 failing tests now pass").
      passNow: [String.raw`now\s+(?:pass|passes|passing|green|succeed|succeeds)`],
      head: "dev-spec evidence gate: your last message says the work is done or verified, but tasks are ticked without verification evidence:",
      headSuite: "dev-spec evidence gate: your last message says the work is done or verified, but the project checks have no passing run since the last task activity:",
      taskLine: (slug, list) => `  - ${slug}: ${list}`,
      suiteLine: (slug, list) => `  - ${slug}: project checks without a passing run since the last task activity: ${list}`,
      more: (n) => `+${n} more`,
      todoTasks: (slug, n, file = "tasks.md") => `Record the evidence before claiming it: read each listed task's _Verify:_ command in .specs/${slug}/${file} (task ${n} first) — a task with several: all of them, in ONE run joined with \` && \` —, run it on the final code only if it is safe to run, and record that run (the command as written) with spec_complete_task {name, number, evidence: {command, exitCode, summary}}.`,
      todoSuite: (slug) => `Project checks for ${slug} have no passing run: read them in .specs/roadmap.json (meta.checks), run them only if they are safe to run, and record the runs with spec_finish {evidence}.`,
      plainly: "Or say plainly which of these are not verified.",
      implementer: {
        head: (n, slug) => `dev-spec evidence gate: you report task ${n} of '${slug}' as DONE, but`,
        noReport: (file) => `its report (${file}) does not exist.`,
        noRun: (file, cmds) => `its report (${file}) doesn't show the _Verify:_ run — the exact command and its exit code: ${cmds}.`,
        notPassing: (file, cmds) => `its report (${file}) shows no passing run (exit 0) of ${cmds} — a DONE task's _Verify:_ must pass.`,
        notFailing: (file, cmds) => `its report (${file}) shows no failing run (a non-zero exit code) of ${cmds} — the task is marked _Expect: fail_: its proof is the red run.`,
        todo: "Run the command on the final code and put the command, its exit code and the last lines of its output in the report — or report BLOCKED / NEEDS_CONTEXT if it can't pass. (Evidence before claims: the controller ticks the task only with that run.)",
      },
      // 1.22 — the spec-simplifier's DONE (SubagentStop): its report must end with the final passing runs.
      simplifier: {
        head: (slug) => `dev-spec evidence gate: you report the simplification pass of '${slug}' as DONE, but`,
        noReport: (file) => `its report (${file}) does not exist.`,
        noFinal: (file) => `its report (${file}) has no "## Final runs" section with a run in it — the last section, one line per run: - \`<command>\` → exit <code>.`,
        noRun: (file, cmds) => `the "## Final runs" section of its report (${file}) doesn't show these runs with their exit code: ${cmds} — every project check must be there, one line per run: - \`<command>\` → exit <code>.`,
        notPassing: (file, cmds) => `the final runs in its report (${file}) fail: ${cmds} — a simplification must leave every run green.`,
        todo: "Run the project checks (or the full test suite) and the changed tasks' _Verify:_ on the final code and list them last in the report, under \"## Final runs\", one line each (- `<command>` → exit <code>, then the last lines of output) — or revert the change that made a run fail, or report BLOCKED. (\"Behaviour unchanged\" is a claim: the runs are its proof.)",
      },
      // `dev-spec stop-check` when nothing is sent back (the why code → one line).
      allow: {
        off: () => "evidence gate: off (roadmap.json meta.stopCheck: false) — nothing checked.",
        "stop-hook-active": () => "evidence gate: this stop was already sent back once (stop_hook_active) — allowed.",
        "no-specs": () => "evidence gate: no dev-spec .specs/ here — nothing to check.",
        "no-claim": () => "evidence gate: the message claims no completion or verification — allowed.",
        admitted: () => "evidence gate: the message says plainly what is not verified (or failing) — allowed.",
        "no-recent": (i) => `evidence gate: no feature was active in the last ${i.hours} h (a task ticked, evidence recorded or tasks.md edited) — allowed.`,
        verified: (i) => `evidence gate: every ticked task of the recently active features has passing evidence (${i.list}) — allowed.`,
        "not-done": () => "evidence gate: the subagent reports BLOCKED / NEEDS_CONTEXT — allowed.",
        "no-changes": () => "evidence gate: the simplifier reports NO_CHANGES — nothing to prove, allowed.",
        "no-report": () => "evidence gate: the message names no simplification report (.specs/<feature>/.execution/simplify-report.md) — allowed.",
        "simplify-ok": (i) => `evidence gate: the simplification report of '${i.slug}' ends with its passing runs — allowed.`,
        "no-task": () => "evidence gate: the message names no task report (.specs/<feature>/.execution/task-N-report.md) — allowed.",
        "nothing-to-verify": (i) => `evidence gate: task ${i.n} of '${i.slug}' has no runnable _Verify:_ command — allowed.`,
        "report-ok": (i) => `evidence gate: the report of task ${i.n} of '${i.slug}' shows its _Verify:_ run — allowed.`,
      },
      on: "Evidence gate ON — a turn that ends saying the work is done or verified is sent back while a recently active feature has ticked tasks without verification evidence (roadmap.json meta.stopCheck; hooks/stop-hook.js).",
      off: "Evidence gate OFF — the end-of-turn claim check is disabled (roadmap.json meta.stopCheck: false).",
      badValue: (v) => `--stop-check takes on or off (got '${v}').`,
    },
    scopeGuard: {
      on: "Guard mode SCOPE — Write/Edit on a code file outside .specs/ asks unless an open task of an approved feature names it in _Implements:_ (the file, its folder or a glob; test files excepted), and asks for every code edit while no feature has approved, unfinished tasks (roadmap.json meta.guard: \"scope\"). Test files are allowed while a feature's test plan is approved and the feature is unfinished (Phase 4 writes the failing tests before the tasks gate), and every code file while a spike is under way (its prototype).",
      ask: (file, features, hint) => `dev-spec guard (scope): ${file} is not in the plan — no open task of ${features} names it in _Implements:_. ${hint} (Guard mode is scope — ${DEV_SPEC} init --guard on allows every code file while tasks are approved; --guard off disables it.)`,
      hint: {
        "same-folder": (n, slug, ref) => `Add it to task ${n}'s _Implements:_ (${slug} — same folder as ${ref}) and re-approve the tasks phase, or plan the change with /spec-converge (spec_append_tasks).`,
        nearby: (n, slug, ref) => `Add it to task ${n}'s _Implements:_ (${slug} — it plans ${ref} nearby) and re-approve the tasks phase, or plan the change with /spec-converge (spec_append_tasks).`,
        next: (n, slug) => `Add it to the _Implements:_ of task ${n} (${slug}, the next open task) and re-approve the tasks phase, or plan the change with /spec-converge (spec_append_tasks).`,
      },
    },

    // 1.14 C2 — the decision log (.specs/<feature>/decisions.md, spec_decide) and the spike kind (investigate → decide).
    // IDs (D-n), the markers (_Kind:_ _Date:_ _Affects:_ _Supersedes:_ _Outcome:_) and their values stay English.
    decisions: {
      header: (name) => `# Decisions: ${name}

<!-- Decision log — append-only, committed with the spec. spec_decide (dev-spec decide) adds each entry: D-1, D-2…
     never renumbered, never rewritten. _Affects:_ names the AC IDs, T-IDs and design sections a decision touches;
     a later decision that replaces one says _Supersedes: D-n_. Discoveries (facts learnt while working) use the
     same log (_Kind: discovery_). -->
`,
      labels: { context: "Context", decision: "Decision", discovery: "Discovery", consequences: "Consequences" },
      kinds: { decision: "decision", discovery: "discovery" },
      titleRequired: "a decision needs a title (one line of text).",
      decisionRequired: "a decision needs its text — decision: what was decided (for a discovery: what was found).",
      badText: (field) => `${field} must be text.`,
      tooLong: (field, max) => `${field} is too long (at most ${max} characters).`,
      badKind: (v) => `kind must be decision or discovery (got ${v}).`,
      badAffectsChange: (list) => `unknown _Affects:_ reference(s): ${list} — a change names an AC ID its change.md defines, or a section heading of change.md (Summary, Acceptance Criteria, Approach, Tasks). Nothing was written.`, // 1.21 verify V7
      badAffects: (list) => `unknown _Affects:_ reference(s): ${list} — an AC ID must be defined in requirements.md, a T-ID planned in test-plan.md, an EC/NFR/SC ID written in requirements.md; anything else must be a section heading of design.md (bug.md / design.md for a bugfix, spike.md for a spike). Nothing was written.`,
      badSupersedes: (list) => `_Supersedes:_ must name decisions already in this log (D-n): ${list}. Nothing was written.`,
      unsafeFile: (rel) => `${rel} is not a regular file inside .specs/ (a symbolic link, or it resolves outside the project) — replace it with a plain file first. Nothing was written.`,
      recorded: (id, kind, file) => `Recorded ${id} (${kind}) in ${file}.`,
      briefHeading: "## Decisions",
      briefIntro: "Decisions and discoveries (decisions.md) that cite this task's criteria or tests — respect them:",
      briefOmitted: (list) => `…and ${list} — see decisions.md.`,
      supersedesNote: (list) => `supersedes ${list}`,
      prHeading: "## Decisions",
      catalogLine: (n, list) => `Decisions (${n}): ${list}`,
      superseded: "superseded",
      affectsApproved: (list, slug, phases) => `decisions recorded after an approval touch the approved spec: ${list} — re-review what they change (spec_impact ${slug} --phase ${phases}), update the spec, then re-approve.`,
      affectsApprovedEntry: (id, refs, file, day) => `${id} (${refs}) after ${file} was approved (${day})`,
      phantomDoctor: (list) => `_Affects:_ references in decisions.md that name nothing in this feature: ${list} — a typo, or a criterion / test / section removed since.`,
      phantom: (id, ref) => `${id} _Affects:_ ${ref} — names nothing in this feature (a typo, or a criterion / test / section removed since)`,
      cliRecorded: (id, title, file) => `✎ ${id} — ${title}  (${file})`,
    },
    spike: {
      kind: "spike",
      kicker: "Spike (investigation)",
      report: (a) => `# Spike: ${a.name}

<!-- Spike (investigate → decide): a timeboxed investigation that ends in a DECISION, not in production code.
     Prototype code lives OUTSIDE .specs/ (a scratch folder or a branch) — link it under Evidence.
     spec_doctor fails until "Decision" is written, and warns once the timebox date passes without one.
     State the outcome on its own line: _Outcome: go_ · _Outcome: no-go_ · _Outcome: pivot_ -->

## Question
${a.question || "> **TODO** — the one question this spike answers (what answer would change the plan?)."}

## Timebox
${a.until ? `**Until:** ${a.until}${a.raw && a.raw !== a.until ? ` (${a.raw})` : ""}` : "> **TODO** — the end date (YYYY-MM-DD) or the effort cap. When it ends, decide with the evidence you have."}

## Options considered
- [option A — what it is, what it would cost]
- [option B]

## Evidence
<!-- Links, measurements, prototypes (the code stays outside the spec — link it here), what was tried and what happened. -->
- [link / measurement / prototype — and what it showed]

## Decision
> **TODO** — go / no-go / pivot, and why: the evidence that decided it.

_Outcome: [go | no-go | pivot]_

## Follow-up
- [go: the feature to spec (spec_create) · no-go: why it was dropped · pivot: the new question]
`,
      tasks: (name) => `# Tasks: ${name}

<!-- A spike has no requirements / design gates: question → investigate → decide. Prototype code lives OUTSIDE
     .specs/ — link it under spike.md → Evidence. When the timebox ends, decide with what you have. -->

## Phase: Investigate
- [ ] 1. [shared] Sharpen the question and set the timebox in spike.md (what answer would change the plan?)
- [ ] 2. [shared] List the options considered in spike.md → Options considered
- [ ] 3. [shared] Gather the evidence — prototypes (outside .specs/), measurements, links — in spike.md → Evidence
- [ ] 4. [shared] Record the decision (go / no-go / pivot) and its rationale in spike.md → Decision; log it with spec_decide
**Checkpoint:** the question has an answer backed by evidence.
`,
      badTimebox: (v) => `timebox must be an end date (YYYY-MM-DD) or a duration from today (e.g. 3d, 2w, 8h) — got ${v}.`,
      spikeOnly: (arg) => `${arg} only applies to a spike (kind: "spike").`,
      tracksIgnored: (list) => `A spike is core-only — tracks ignored (${list}); give them to the feature you spec after a 'go'.`,
      noTracks: (slug) => `'${slug}' is a spike — it has no tracks. After a 'go', spec the real feature with its tracks (spec_create).`,
      noGate: (phase, slug) => `'${slug}' is a spike: it has no ${phase} gate — it goes question → investigate → decide. Record the decision in spike.md → Decision (spec_decide logs it); spec_finish closes it.`,
      doctor: {
        missing: "spike.md is missing — a spike's question, evidence and decision live there.",
        questionOk: "the question is written",
        questionMissing: "spike.md → Question is still the template — write the one question this spike answers.",
        decisionOk: (o) => `decision recorded (_Outcome: ${o}_)`,
        decisionMissing: "spike.md → Decision is not written yet (go / no-go / pivot + rationale) — the spike isn't done until it is.",
        outcomeMissing: "the decision is written but its outcome isn't stated — add a line _Outcome: go_, _Outcome: no-go_ or _Outcome: pivot_.",
        timeboxOk: (d) => `timebox until ${d}`,
        timeboxPassed: (d) => `the timebox ended on ${d} and no decision is recorded — decide with the evidence you have (go / no-go / pivot), or extend the timebox on purpose.`,
        timeboxUnset: "no timebox set — write an end date (YYYY-MM-DD) in spike.md → Timebox.",
        timeboxNoDate: "the timebox has no end date (YYYY-MM-DD) — when it runs out can't be checked.",
        timeboxDecided: "decided — the timebox is closed",
      },
      next: {
        missing: (slug) => `spike.md is missing — scaffold it again: ${DEV_SPEC} spike "${slug}" (create-only: what exists is kept).`,
        fillQuestion: (slug) => `Write the question this spike answers (and its timebox) in spike.md → Question / Timebox — /spec-spike ${slug}.`,
        investigate: (n, text, slug) => `Investigate — task #${n}: ${text}. Prototype code stays outside .specs/ (link it under spike.md → Evidence); tick it: ${DEV_SPEC} done ${slug} ${n}.`,
        decide: (slug) => `Record the decision in spike.md → Decision — go / no-go / pivot, the rationale and its _Outcome:_ line — and log it: /spec-decide ${slug} (spec_decide).`,
        outcome: (slug) => `State the outcome in spike.md → Decision: a line _Outcome: go_, _Outcome: no-go_ or _Outcome: pivot_ (/spec-spike ${slug}).`,
        timeboxPassed: (d) => `The timebox ended on ${d}: decide with the evidence you have.`,
        goCreateFirst: (slug, name, summary) => `Decision: go. Spec the real feature — spec_create {name: "${name}", summary: ${JSON.stringify(summary)}} (${DEV_SPEC} create "${name}" --summary ${JSON.stringify(summary)}) — then archive the spike: /feature archive ${slug}.`,
        goArchiveFirst: (slug, name, summary) => `Decision: go. Archive the spike first — /feature archive ${slug} (it frees the name) — then spec the real feature: spec_create {name: "${name}", summary: ${JSON.stringify(summary)}} (${DEV_SPEC} create "${name}" --summary ${JSON.stringify(summary)}).`,
        noGo: (slug, reason) => `Decision: no-go${reason ? ` — ${reason}` : ""}. Archive the spike with its reason (it stays in spike.md → Decision): /feature archive ${slug}.`,
        pivot: (slug, reason) => `Decision: pivot${reason ? ` — ${reason}` : ""}. Start a new spike for the new direction (${DEV_SPEC} spike "<new question>") — or spec the feature if the answer is already clear — then archive this one: /feature archive ${slug}.`,
      },
      finish: {
        ready: (slug) => `spike '${slug}' is ready to finish — its decision is recorded. Act on it (spec_next_action says how).`,
        notReady: (slug) => `spike '${slug}' is not ready to finish:`,
        missing: "spike.md is missing",
        decisionBlocker: "spike.md → Decision is not written yet (go / no-go / pivot + rationale)",
        prQuestion: "## Question",
        prDecision: (o) => `## Decision${o ? ` — ${o}` : ""}`,
        prEvidence: "## Evidence",
        prOptions: "## Options considered",
        prFollowUp: "## Follow-up",
        checks: ["The decision is shared with the people it affects.", "Prototype code stays out of the main branch — the real feature rewrites what it keeps as its own tasks."],
      },
      roadmapTimebox: (d) => `spike: the timebox ended on ${d} with no decision`,
      catalogQuestion: (q) => `Question: ${q}`,
      catalogOutcome: (o) => `Decision: ${o}`,
      catalogPending: "Decision: pending",
      exportSection: "Spike",
      cliQuestion: (q) => `  question: ${q}`,
      cliUntil: (d) => `  timebox: until ${d}`,
    },

    // Flows (1.14 C3) — design-first. The flow values (requirements-first · design-first) and phase tokens stay English-stable.
    flow: {
      required: (slug, known) => `flow required — one of: ${known} (spec_feature {action: "flow", name: "${slug}", flow}; CLI: ${DEV_SPEC} feature flow ${slug} <flow>).`,
      kindRefused: (slug, kind) => `'${slug}' is a ${kind}: it follows its own fixed phase order — the flow applies to features only.`,
      kindIgnored: (kind) => `flow ignored: a ${kind} follows its own fixed phase order (the flow applies to features only).`,
      kept: (slug, cur, asked) => `flow kept: '${slug}' follows ${cur} (asked: ${asked}) — change it with spec_feature {action: "flow"} (CLI: ${DEV_SPEC} feature flow ${slug} ${asked}).`,
      set: (slug, flow, prev, order) => `'${slug}' now follows the ${flow} flow (was ${prev}) — phase order: ${order}.`,
      same: (slug, flow, order) => `'${slug}' already follows the ${flow} flow — phase order: ${order}.`,
      approvedStay: (list) => `Phases already approved stay approved: ${list}.`,
      created: (order) => `design-first flow — phase order: ${order} (the requirements are written after the design is approved).`,
      nextNote: (order) => `(design-first flow: ${order})`,
      laterPhase: (detail) => `requirements.md is a later phase (design-first) — ${detail}`,
    },
    // spec_import plan · execplan · bmad (1.14 C3). Headings in the feature's language; IDs and markers stay English-stable.
    importPlans: {
      plansDir: "Claude Code plan mode keeps plans under plansDirectory (default ~/.claude/plans — outside the project): copy the plan into the project first, or set plansDirectory to a folder inside it.",
      several: (dir, list) => `'${dir}' holds several documents (${list}) — pass the one to import.`,
      planTitle: "Plan",
      wNoSteps: "no checklist, to-do or steps list found — the scaffold's tasks.md was kept (break the work into tasks with /createTask)",
      wCancelled: (list) => `cancelled to-dos imported as open tasks (drop the ones that no longer apply): ${list}`,
      wNoDesignLeft: "nothing left for the design beyond the criteria and the steps — the scaffold's design.md was kept",
      wNotExecPlan: "no ExecPlan sections found (Progress, Decision Log, Concrete Steps, Validation and Acceptance …) — is this an ExecPlan? Try tool 'plan'.",
      decisionsHeading: "## Decisions",
      nonFunctional: "## Non-Functional Requirements",
      wUnknownAc: (story, task, list) => `${story}, '${task}': AC reference(s) ${list} match no criterion of that story — kept as written`,
      wWorkflow: (list) => `BMAD workflow records not imported (left in place): ${list}`,
    },
    // 1.17 F — spec_import {tool: "fluidplan"}: the text the import writes (decisions.md entries, design.md, tasks.md bodies) and its
    // warnings. fluidplan's own EN / FR labels are read by the engine (FP_SEC …), never here. [NEEDS CLARIFICATION], the D-n IDs and
    // the _Requirements:_ / _Implements:_ / _Verify:_ / _Depends:_ markers stay English-stable.
    importFluidplan: {
      several: (dir, list) => `'${dir}' holds several fluidplan plans (${list}) — pass the one to import (its folder, its plan.json or its PLAN.md).`,
      notFluidplan: (file) => `'${file}' is not a fluidplan PLAN.md or DECISIONS.md (no '<title> — execution plan' / '<title> — decisions' heading, no '### [ ] 1.1 <task> · D1' task).`,
      notFluidplanText: "The text is not a fluidplan PLAN.md or DECISIONS.md (no '<title> — execution plan' / '<title> — decisions' heading, no '### [ ] 1.1 <task> · D1' task).",
      decisionsIntro: "The context, choice and consequences of each decision are in decisions.md.",
      rejectedMark: "rejected",
      openMark: (state) => `still open in fluidplan (${state})`,
      chosen: "chosen",
      tradeoffsHead: ["Decision", "Option", "Pros", "Cons", "Effort"],
      context: "## Context",
      sourceDoc: (p) => `Source document: \`${p}\``,
      glossary: "## Glossary",
      finalCheck: "## Final check",
      visuals: "## Visuals",
      outOfScope: "## Out of Scope",
      openDecisions: "## Open decisions",
      openLine: (id, title, state, acs, note) => `- [NEEDS CLARIFICATION] **${id} · ${title}** — ${state}${note ? `: ${note}` : ""}${acs ? ` (the criteria it drives: ${acs})` : ""}: settle it in fluidplan, or here, before approving the requirements`,
      constraints: "## Global Constraints",
      themes: "## Themes",
      revisionNote: (round, note) => `Revision (round ${round}): ${note}`,
      label: {
        decision: "Decision", deletes: "To delete", untraced: "Other files named (not traced)", verify: "Verify (no marker)", do: "Do", remark: "Remark", remarks: "Remarks",
        itemsKept: "Items kept", items: "Items", importance: "Importance", phase: "Phase", page: "Theme", proposal: "Proposal", rewritten: "rewritten by the reviewer",
        pros: "pros", cons: "cons", effort: "effort", cost: "cost", others: "Other options", dependsOn: "Depends on", fluidplan: "fluidplan decision",
        question: "Open question in the source", sourceRef: "In the source", learnMore: "More", subtitle: "Subtitle",
      },
      importance: { critical: "critical", important: "important", minor: "minor" },
      verdict: { pending: "no answer", modify: "to change", explain: "a question asked", ko: "rejected", mixed: "partly settled" },
      otherOption: "another option (described in the remark)",
      rejected: (reason) => `Rejected — not part of this feature${reason ? `: ${reason}` : "."}`,
      wDraft: (pending, revise) => `the fluidplan plan is not settled (DRAFT: ${pending} decision(s) without an answer, ${revise} to rework) — settle it in fluidplan and finalize it, or clarify the open decisions here`,
      wOpen: (list) => `decisions still open in fluidplan — no decisions.md entry, listed under Open decisions with [NEEDS CLARIFICATION]: ${list}`,
      wRejected: (list) => `decisions rejected in fluidplan (Not OK) — recorded in decisions.md as rejected and listed under Out of Scope (fluidplan keeps none of their tasks): ${list}`,
      wAfter: (task, ref) => `task ${task}: after '${ref}' names no task the plan keeps — no _Depends:_ for it`,
      wPath: (task, p) => `task ${task}: '${p}' is not a project-relative path (absolute, home, URL, '..' or a glob) — named in the task text, not in _Implements:_`,
      wVerify: (task, cmd) => `task ${task}: the verify command '${cmd}' can't be written as a _Verify:_ marker — kept in the task text`,
      wRounds: "fluidplan's round history (rounds/, the verdicts of earlier rounds) is not imported — the settled decisions are, with their latest revision note",
      wCycle: (tasks, dropped) => `tasks ${tasks}: their 'after' form a cycle — none of them could start. Dropped: ${dropped} (task → the later task it waited for, against the plan's order); fix the order in fluidplan`,
      wNoExport: "state.json says the plan was exported, but its PLAN.md was not found (the plan folder, plan.json's output, fluidplan.config.json's outputDir) — the tasks come from plan.json, their ticks not imported",
      wNoDecisions: "no DECISIONS.md and no plan.json beside PLAN.md — decisions.md holds only what PLAN.md says of each decision (its choice and importance: no why, no alternatives)",
      wBadJson: (file, err) => `${file} is not a valid JSON object (${err}) — not read`,
      wVisuals: (list) => `fluidplan's visuals are drawn by its page — named in design.md (Visuals), not rendered: ${list}`,
      wNoTasks: "the plan keeps no task — the scaffold's tasks.md was kept",
    },
  };

// 1.16 Q — spec quality: steering amendments (Q1), cross-feature acceptance criteria (Q2), the glossary (Q3). One group per
// language, merged into MSG (pt-BR derives from pt's). Check ids, reason codes and file names stay English.
const quality = {
    steeringChange: { modified: "changed", removed: "removed" },
    steeringItem: (phase, day, files) => `${phase} (approved ${day}): ${files}`,
    steeringDoctor: (items, slug) => `steering changed after approval — ${items}: re-review against the amended steering, then re-approve (${DEV_SPEC} impact ${slug} --phase steering; without a feature it lists every one concerned).`,
    naSteering: (phases, files, slug) => `Also: steering changed after the approval of ${phases} (${files}) — re-review against it and re-approve if it still holds (${DEV_SPEC} impact ${slug} --phase steering).`,
    impactNeedsName: (phases) => `name required — only phase 'steering' works project-wide (without a feature). Phases: ${phases}.`,
    impactNoReopen: "reopen doesn't apply to phase 'steering' — nothing is unticked: re-review the features listed and re-approve their requirements / design.",
    impactHead: (n, feature) => (feature
      ? (n ? `Steering — ${feature}: approved under an older version of steering that changed since` : `Steering — ${feature}: no approval was made under steering that changed since`)
      : (n ? `Steering — ${n} active feature(s) approved under an older version of steering that changed since` : "Steering — no requirements / design approval was made under steering that changed since")),
    impactUntracked: (list) => `approved before 1.16 (no steering fingerprints — never flagged): ${list}`,
    impactUnreadable: (list) => `skipped — .state.json unreadable: ${list}`,
    impactReReview: (slug, phase) => `Re-review each against the amended steering, then re-approve (/approve ${slug} ${phase}) — the approval records the current steering.`,
    xacKind: { duplicate: "near-duplicate", conflict: "possible conflict" },
    xacWhy: (reason, pct, nums) => (reason === "opposite-modal" ? `SHALL vs SHALL NOT, ${pct}% alike` : reason === "different-numbers" ? `different numbers ${nums}, ${pct}% alike` : `${pct}% alike`),
    xacItem: (mine, other, kind, why) => `${mine} ↔ ${other} (${kind}: ${why})`,
    xacDoctor: (n, list) => `${n} criterion pair(s) read like another active feature's or may contradict them — ${list}. Merge or reword them, or declare _Supersedes: <feature>/US-n.AC-m_ on the newer one.`,
    xacMore: (n) => `… +${n} more`,
    xacHeading: "Possible duplicates / conflicts",
    xacIntro: "Acceptance criteria of different active features that read alike (near-duplicates) or may contradict each other (the same trigger with SHALL vs SHALL NOT, or different numbers) — a heuristic: merge or reword them, or declare _Supersedes:_ on the newer one.",
    xacTruncated: "(bounded — not every criterion was compared)",
    glossaryQuestion: (locs, word, term, def) => `${locs}: '${word}' — the glossary says ${term}${def ? ` (${def})` : ""}. Use "${term}", or amend .specs/steering/glossary.md if '${word}' means something else here.`,
    glossaryMore: (n) => `… and ${n} more word(s) the glossary says to avoid — see spec_doctor (glossary).`,
    glossaryItem: (word, term, locs) => `'${word}' → ${term} (${locs})`,
    glossaryDoctor: (n, list) => `${n} use(s) of words the glossary says to avoid — ${list} (spec_clarify asks about each)`,
    glossaryOk: (n) => `no word the glossary says to avoid in requirements.md / design.md (${n} term(s))`,
    glossaryTruncated: (read, total) => `glossary.md holds ${total} entries — only the first ${read} are read (split or trim it)`,
    briefGlossaryHeading: "## Glossary (terms this task uses)",
    briefGlossaryIntro: "Use these words exactly as defined (.specs/steering/glossary.md) — never the avoided ones:",
    briefGlossaryAvoid: (list) => `avoid: ${list}`,
    briefGlossaryOmitted: (list) => `More entries apply (size) — read them in .specs/steering/glossary.md: ${list}`,
  };

// 1.17 A — every design weighs its choices: doctor's design-tradeoffs / design-risks details (keyed by check id, then by the
// section state: missing · template · empty · few · filled) and spec_clarify's consistency nudge (A2). pt-BR derives from pt.
const designWeigh = {
    "design-tradeoffs": {
      filled: (n) => (n ? `${n} option(s) weighed` : "written as prose (no option list — the options weighed in a paragraph, or why this design has no key decision)"),
      missing: () => "no Alternatives & Trade-offs section — list the options weighed for each key decision (pros, cons, cost of being wrong, the one chosen and why)",
      template: () => "Alternatives & Trade-offs is still the template — replace its placeholders with the options really weighed",
      empty: () => "Alternatives & Trade-offs is empty — list the options weighed for each key decision",
      few: (n, min) => `Alternatives & Trade-offs lists ${n} option(s) — weigh at least ${min} per key decision (a table row or a bullet each: one option alone was never weighed), or say in a sentence why there is no key decision`,
    },
    "design-risks": {
      filled: (n) => (n ? `${n} risk(s) listed` : "written (no row or bullet — an honest 'no material risk' counts)"),
      missing: () => "no Risks section — list what could make the design wrong or the delivery late (likelihood, impact, mitigation, owner)",
      template: () => "Risks is still the template — replace its placeholders with the real risks (or say why there is none)",
      empty: () => "Risks is empty — an honest 'no material risk, because X' is fine; blank is not",
      few: () => "Risks lists no risk",
    },
    // 1.19 R1 — the Reuse & Integration section (states as above, plus `integration`: a brownfield feature's integration-plan.md
    // → Integration Points stands in for it).
    "design-reuse": {
      filled: (n) => (n ? `${n} item(s) named (reused / extended / new)` : "written (no row or bullet — 'greenfield: nothing to reuse yet' counts)"),
      missing: () => "no Reuse & Integration section — name the existing modules, components, helpers or services this feature reuses or extends (with their paths), what is new and why nothing existing fits, and where the new code lives",
      template: () => "Reuse & Integration is still the template — replace its placeholders with what this feature really reuses, extends and adds (or say it is greenfield)",
      empty: () => "Reuse & Integration is empty — name what is reused or extended, or say in a line why nothing is (greenfield); blank is not",
      few: () => "Reuse & Integration names nothing",
      integration: (n) => `covered by integration-plan.md → Integration Points${n ? ` (${n} item(s))` : ""}`,
    },
    legacyApproval: (d, v = "1.17") => `design approved before ${v} — asked only from its next approval (${d})`,
    clarifyConsistency: (words) => `The spec mentions ${words}, but neither the requirements nor the design say anything about consistency or idempotency (the answer goes in the design's Alternatives & Trade-offs / Risks, or in a requirement): what must succeed or fail together (atomicity, isolation level), who else writes the same data concurrently, strong or eventual consistency (how stale is acceptable), and the delivery guarantee and idempotency of anything asynchronous?`,
  };

// ===========================================================================
// Task brief (spec_task_brief) — the self-contained brief a fresh implementer reads first.
// Labels and loop rules per language; renderBrief() owns the layout. IDs, `_Label:_` markers and
// **Checkpoint:** stay English-stable inside the rendered brief.
// ===========================================================================
const brief = {
    title: (feature, n) => `# Task brief — ${feature} · task ${n}`,
    intro: "Read this first — it is your requirements. Exact values below are binding; build nothing beyond this task.",
    story: "Story", phase: "Phase", parallel: "Parallel", tracks: "Tracks", loop: "Loop",
    yes: "yes [P]", no: "no",
    inlineOnly: "⚠ **Inline only** — prompt/eval task: the controller runs it in the main session (evals cost money; accept/revert is a judgment call). Do not delegate it.",
    task: "## Task",
    context: "## Where this fits (user story)",
    bug: "## The bug (bug.md)", bugRepro: "Reproduction", bugRootCause: "Root cause",
    bugUnfilled: "_Not written yet — no fix before the root cause is written in bug.md._",
    acs: "## Acceptance criteria (binding)",
    acsNone: "_No acceptance criteria referenced — report NEEDS_CONTEXT rather than inventing scope._",
    tests: "## Tests to make green",
    testsRed: "## Tests this task writes — they must FAIL first (red)",
    evals: "## Evals affected",
    metrics: "## Metrics to emit",
    files: "## Files (_Implements:_)",
    // 1.19 R2 — search before you write: the design's Reuse & Integration entries for this task, and the files next to its own
    reuse: "## Reuse — search before you write",
    reuseRule: "Before writing any helper, component, client, validator or formatter, search the codebase by concept and synonyms (references/code-reuse-and-quality.md): reuse, then extend, then create. A unit to extend outside this task's files (_Implements:_) is never edited silently — stop and ask (NEEDS_CONTEXT), or create locally and name it in the report. Your report's **Reuse** block says what you reused, extended or created, and why.",
    reuseEntries: "The design's Reuse & Integration entries for this task — reuse or extend these before writing anything new:",
    reuseOmitted: (n) => `${n} more matching item(s) — read them in design.md (Reuse & Integration).`,
    reuseNoMatch: (n) => `The design's Reuse & Integration lists ${n} item(s), none naming this task's files or criteria — read it before creating anything new.`,
    reuseFiles: "Existing source files next to this task's files — look here first:",
    // R review 4: atLeast — a folder was read only up to its first entries, so the count is a lower bound (0: "possibly more")
    reuseFilesMore: (n, atLeast) => (!atLeast ? `…and ${n} more in the same folder(s).`
      : n ? `…and at least ${n} more in the same folder(s) — a large folder: only its first entries were read.`
        : "…and possibly more in the same folder(s) — a large folder: only its first entries were read."),
    design: "## Design context",
    designToc: (p) => `Full design: \`${p}\` — sections:`,
    designOmitted: "Relevant but not included (size) — read them in design.md:",
    steering: "## Global constraints",
    constraintsIntro: "Binding for every task (tasks.md → Global Constraints):",
    verification: "## Verification (_Verify:_)",
    verifyRule: "Run every _Verify:_ command above on the final code and put the exact command, its exit code and the last lines of its output in the report — the controller records them with spec_complete_task as the task's evidence.",
    steeringRead: "Read before coding:",
    unresolved: "## ⚠ Unresolved references",
    unresolvedNote: "The task cites these IDs but the spec doesn't define them. Report NEEDS_CONTEXT instead of guessing.",
    dod: "## Definition of done",
    loopRules: {
      core: [
        "Implement exactly what the task and its acceptance criteria require — nothing extra (YAGNI).",
        "Run the existing test suite: everything that was green stays green.",
        "Commit with a conventional message that cites the task (e.g. `feat(scope): … — task #N`).",
        "Never edit an existing test to make it pass. If a test looks wrong, stop and report BLOCKED.",
      ],
      tdd: [
        "RED first: run the target tests and confirm they fail for the right reason (assertion / not implemented — not a typo or a missing import). Put the command and output in the report.",
        "Write the minimum code that turns the target tests green.",
        "Run the FULL suite: targets green, previously green tests still green, later tasks' tests still red.",
        "Refactor only on green. Never change a planned test's expectation — if it looks wrong, stop and report BLOCKED.",
        "Commit citing the task and the tests it makes green (`Makes T-01, T-02 green`).",
      ],
      "ai-prompt": [
        "Record the eval baseline before changing anything.",
        "Edit the prompt in a NEW versioned file (`prompts/vN.md`), never in place.",
        "Run the full eval harness; accept only if golden improved or held and adversarial held — otherwise revert.",
        "Commit with the eval delta (`Eval delta: golden 82% → 87%`).",
      ],
    },
    metricsRule: "Every metric listed above is actually emitted — show the evidence in the report.",
    // full review Ga7: the definition of done of an _Expect: fail_ (red) task — replaces the loop's green-making rules.
    redRules: [
      "This is a RED task: write (or keep) the planned test(s) exactly as the test plan describes them — no production code and no fix in this task.",
      "Run them: they must FAIL for the right reason — an assertion or \"not implemented\". A missing test file, module or script, a typo or a command that doesn't run is no red test (it is refused as one).",
      "Tests that passed before stay green: only this task's new test(s) may fail. Never edit an existing test.",
      "Commit the failing test citing the task and its T-IDs (`test(scope): T-01 red — task #N`).",
    ],
    evalsRule: "This change touches an AI path: run the eval harness afterwards — golden holds or improves, adversarial holds — and put the scores in the report.",
    checkpoint: "When this story's last task is done, the controller stops for human review at the checkpoint:",
    report: "## Report",
    reportTo: (p) => `Write your full report to \`${p}\`, then reply with only the status line (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED), your commits, a one-line test summary, any concerns and the report path written out in full (\`${p}\`) — the evidence gate and the controller find your report through it.`,
    ledgerHeader: (feature) => `# Execution ledger — feature: ${feature}\n\n<!-- One line per event, appended by the controller (never rewritten):\n     Preflight: … · Ruling: <what> — <why> — <cost if wrong> · Task N: dispatched (base <sha>, model <m>)\n     Task N: fix round R/5 (…) · Task N: minor (deferred): … · Task N: parked — … · Task N: complete (commits a..b, review clean)\n     Checkpoint USn: presented → approved -->\n`,
    allDone: "All tasks are done — nothing to brief.",
    alreadyDone: (n) => `Task ${n} is already marked done.`,
  };

module.exports = { build, steering, evalsReadme, msg, quality, designWeigh, brief, __link };
