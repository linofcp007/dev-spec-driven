"use strict";

/**
 * dev-spec-driven — localized scaffold content (EN / PT / ES, plus pt-BR DERIVED from PT — see "pt-BR — a derived
 * locale" near the end). Zero-dependency, data-only.
 *
 * This module holds ALL user-facing text the engine GENERATES (feature artifacts, steering
 * stubs) and the human-readable tool messages (doctor / clarify / next-action / hooks).
 * `mcp/lib/spec.js` keeps the logic; it calls the builders here with a resolved `lang`.
 *
 * Language model: a project picks ONE language (persisted in `.specs/roadmap.json` meta.lang —
 * the single source of truth), inherited by every new feature and overridable per feature
 * (persisted in `.specs/<feature>/.state.json` lang). `spec.js` resolves the lang and passes it.
 *
 * STABLE TOKENS — never translated, the tooling matches them literally:
 *   AC/SC/test IDs (US-1.AC-1, SC-001, T-01, EC-1, NFR-1), section markers ([SaaS], [AI], [SEC], [PRIVACY], [DIST]),
 *   story/parallel tags ([US1], [US2], [shared], [P]), the unfilled sentinel `> **TODO**`,
 *   `[NEEDS CLARIFICATION]`, the annotation tags `_Requirements:_ / _Makes green:_ /
 *   _Affects evals:_ / _Emits metrics:_ / _Implements:_`, `**Checkpoint:**`, the ```mermaid /
 *   ```typescript fences, the eval-harness headings `## System` / `## User Template`, and the test-plan
 *   Kind values (example / property).
 * EARS modal/keywords ARE localized (WHEN→QUANDO→CUANDO, THE SYSTEM SHALL→O SISTEMA DEVE→
 * EL SISTEMA DEBE, …) because earsValidate recognizes all three languages. Translated headings
 * are matched by the synonym tables (SAAS_SECTIONS/AI_SECTIONS/SEC_SECTIONS/PRIVACY_SECTIONS/DIST_SECTIONS) and RE_* matchers in spec.js.
 */

// The AUTHORED locales (one hand-written block each in BUILD / STEERING / MSG / BRIEF / EVALS_README) and every locale the
// engine speaks: pt-BR (1.14 D1) is DERIVED from pt — see "pt-BR — a derived locale" near the end of this file.
const BASE_LANGS = ["en", "pt", "es"];
const LANGS = [...BASE_LANGS, "pt-BR"];
// The strict reading every surface validates with (MCP `lang` enum, CLI --lang, templates): a known code or alias → the
// canonical code, anything else → null. pt / pt-PT / pt_PT stay European Portuguese; pt-BR / pt_BR / pt-br / ptbr → pt-BR.
const LANG_ALIASES = { "pt-pt": "pt", pt_pt: "pt", "pt-br": "pt-BR", pt_br: "pt-BR", ptbr: "pt-BR" };
function canonicalLang(l) {
  if (typeof l !== "string") return null;
  const s = l.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(LANG_ALIASES, s)) return LANG_ALIASES[s];
  return BASE_LANGS.includes(s) ? s : null;
}
// The lenient reading the engine stores and renders with: a canonical code, else its first two letters (es-MX → es,
// en-US → en), else en.
function normalizeLang(l) {
  const c = canonicalLang(String(l == null || l === "" ? "en" : l));
  if (c) return c;
  const s = String(l || "en").toLowerCase().slice(0, 2);
  return BASE_LANGS.includes(s) ? s : "en";
}
// The language family (pt-BR → pt): what grammar-level rules (the classifier's "no" = em+o) follow.
function baseLang(l) {
  return normalizeLang(l).slice(0, 2);
}

// The template's test IDs: one per template AC of the active tracks, numbered in the order the requirements template
// lists them. The test-plan and tasks builders (every language) share it, so a fresh +tdd scaffold plans a test for
// every AC and every planned test is made green by a task (it used to start with AC-3/AC-4/US-2.AC-1 uncovered and
// T-02 unmapped).
const TEMPLATE_ACS = { core: ["US-1.AC-1", "US-1.AC-2", "US-1.AC-3", "US-1.AC-4", "US-2.AC-1"], saas: ["US-1.AC-5", "US-1.AC-6"], ai: ["US-1.AC-7", "US-1.AC-8", "US-1.AC-9"],
  sec: ["US-1.AC-10", "US-1.AC-11", "US-1.AC-12"], privacy: ["US-1.AC-13", "US-1.AC-14", "US-1.AC-15"],
  dist: ["US-1.AC-16", "US-1.AC-17", "US-1.AC-18", "US-1.AC-19"] }; // +dist (1.17 D)
// The optional tracks whose template criteria / tasks / sections follow the core ones, in track order.
const MARKER_TRACK_ORDER = ["saas", "ai", "sec", "privacy", "dist"];
// The tracks classification.md lists signals for: +tdd, the built-in marker tracks, then a project's track packs (1.15 — any
// other name in the feature's track list), in its order.
function signalTracks(tracks) {
  const builtIn = ["core", "tdd", ...MARKER_TRACK_ORDER];
  return ["tdd", ...MARKER_TRACK_ORDER, ...(tracks || []).filter((t) => typeof t === "string" && !builtIn.includes(t))];
}
function templateTests(tracks) {
  const ids = {};
  let n = 0;
  for (const t of Object.keys(TEMPLATE_ACS)) {
    if (t !== "core" && !(tracks || []).includes(t)) continue;
    for (const ac of TEMPLATE_ACS[t]) ids[ac] = "T-" + String(++n).padStart(2, "0");
  }
  return ids;
}
// `_Makes green: T-0x, …_` for these template ACs — only on a +tdd scaffold (green = templateTests, else null).
function greenLine(green, ...acs) {
  return green ? "\n  - _Makes green: " + acs.map((ac) => green[ac]).join(", ") + "_" : "";
}
// The test-plan matrix rows of the template ACs — row(testId, layer, kind, description, acId, file) formats one per
// language, L holds that language's layer names and descriptions. Kind stays English-stable (example | property): the
// ubiquitous AC-4 ("always-true property") and tenant isolation ("never") are invariants, the event-driven ones examples.
// acs: the feature's REAL AC IDs (a test plan scaffolded after requirements.md was written — spec_add_track tdd): one
// generic row each (T-01…, unit, example, [behavior]) instead of the template's, whose IDs the feature may not define.
function templateTestRows(tracks, row, L, acs) {
  if (Array.isArray(acs) && acs.length) {
    return acs.map((ac, i) => row("T-" + String(i + 1).padStart(2, "0"), "unit", "example", L.behavior, ac, "tests/unit/...")).join("\n");
  }
  // An EMPTY list: requirements.md was written and defines no AC ID (an import without criteria) — one generic row whose
  // Covers cell is a slot, never the template's US-1.AC-1… rows (phantoms for trace_check). 1.14 full review Pa4.
  if (Array.isArray(acs)) return row("T-01", "unit", "example", L.behavior, L.acSlot, "tests/unit/...");
  const T = templateTests(tracks);
  const r = (ac, layer, desc, file, kind = "example") => row(T[ac], layer, kind, desc, ac, file);
  const rows = [r("US-1.AC-1", "unit", L.behavior, "tests/unit/..."), r("US-1.AC-2", L.integration, L.behavior, "tests/integration/..."),
    r("US-1.AC-3", "unit", L.recovery, "tests/unit/..."), r("US-1.AC-4", "unit", L.property, "tests/unit/...", "property"),
    r("US-2.AC-1", L.integration, L.behavior, "tests/integration/...")];
  if (T["US-1.AC-5"]) rows.push(r("US-1.AC-5", L.integration, L.tenant, "tests/integration/...", "property"), r("US-1.AC-6", L.load, L.latency, "load-test.md"));
  if (T["US-1.AC-7"]) rows.push(r("US-1.AC-7", "eval", L.golden, "evals/golden.json"), r("US-1.AC-8", "eval", L.injection, "evals/adversarial.json"),
    r("US-1.AC-9", L.integration, L.cost, "tests/integration/..."));
  // +sec: abuse-case tests; "never" rules (cross-user access, secrets in output) are invariants → property.
  if (T["US-1.AC-10"]) rows.push(r("US-1.AC-10", L.integration, L.unauthenticated, "tests/integration/..."),
    r("US-1.AC-11", L.integration, L.forbidden, "tests/integration/...", "property"), r("US-1.AC-12", L.integration, L.noSecrets, "tests/integration/...", "property"));
  if (T["US-1.AC-13"]) rows.push(r("US-1.AC-13", L.integration, L.exportData, "tests/integration/..."), r("US-1.AC-14", L.integration, L.erasure, "tests/integration/..."),
    r("US-1.AC-15", "unit", L.retention, "tests/unit/..."));
  // +dist (1.17 D): failure-injection tests; "exactly one effect" and "no lost update" hold for every delivery count /
  // interleaving → property.
  if (T["US-1.AC-16"]) rows.push(r("US-1.AC-16", L.integration, L.outboxCrash, "tests/integration/..."),
    r("US-1.AC-17", L.integration, L.duplicateDelivery, "tests/integration/...", "property"), r("US-1.AC-18", L.integration, L.lostUpdate, "tests/integration/...", "property"),
    r("US-1.AC-19", L.integration, L.dependencyDown, "tests/integration/..."));
  return rows.join("\n");
}

// ===========================================================================
// Artifact builders, one set per language. EN is the canonical reference; since 1.13 its templates are
// internally consistent (every template AC planned and tasked) — the gates would otherwise flag the scaffold.
// ===========================================================================

const BUILD = {
  // -------------------------------------------------------------------- EN
  en: {
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
4. **US-1.AC-4** — [ubiquitous] THE SYSTEM SHALL [always-true property]${saasAc}${aiAc}${secAc}${privacyAc}${distAc}

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
      return "";
    },

    design(a) {
      const extra = ["tdd", ...MARKER_TRACK_ORDER].filter((t) => a.tracks.includes(t)).map((t) => BUILD.en.trackDesignBlock(t)).join("");
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

    tasks(a) {
      const green = a.tracks.includes("tdd") ? templateTests(a.tracks) : null; // each template test made green by one task
      const evalMarker = a.tracks.includes("ai") ? "\n  - _Affects evals: golden (maintain baseline)_" : "";
      const metricMarker = a.tracks.includes("saas") ? "\n  - _Emits metrics: req_duration_ms{feature=" + a.slug + "}_" : "";
      let n = 0;
      const id = () => ++n;
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
> **TODO** — exact steps, input and environment that reproduce it every time.

## Expected vs Actual
- **Expected:** [correct behavior]
- **Actual:** [what happens — error message, output, log lines]

## Root Cause
> **TODO** — the cause, with evidence (stack trace, log, failing assertion, the change that introduced it). Not "probably".

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
1. **US-1.AC-1** — IF [the condition that triggers the bug] THEN THE SYSTEM SHALL [the correct behavior]
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
      return `# Tasks: ${name}

<!-- Bugfix order is fixed: reproduce → root cause → failing regression test → fix → verify.
     No fix before bug.md → Root Cause is filled with evidence.
     Task 3 is red by design (its test must FAIL): its _Verify:_ runs T-01 and _Expect: fail_ makes that failing run
     the proof (a passing run is refused). The must-pass suite belongs on the fix task (4).
     T-02 guards behavior that already works — green before and after the fix, so it is in no task's _Makes green:_. -->

## Global Constraints
- [exact values the fix must respect — versions, limits, formats]

## Phase: Fix
- [ ] 1. [shared] Reproduce the bug reliably and write the steps in bug.md → Reproduction
  - _Requirements: US-1.AC-1_
- [ ] 2. [shared] Find the root cause with evidence; fill bug.md → Root Cause (no fix yet)
  - _Requirements: US-1.AC-1_
- [ ] 3. [US1] Write regression test T-01 and watch it fail for the right reason (paste the output); add guard test T-02 (it passes already)
  - _Requirements: US-1.AC-1_
  - _Verify: [command that runs T-01]_
  - _Expect: fail_
- [ ] 4. [US1] Fix the root cause — one change, not a bundle; guard test T-02 stays green
  - _Requirements: US-1.AC-1, US-1.AC-2_
  - _Makes green: T-01_
  - _Verify: [full test suite command]_
**Checkpoint:** the bug no longer reproduces and the full suite is green.
`;
    },

    testPlan(name, tracks, acs) {
      const rows = templateTestRows(tracks, (t, layer, kind, desc, ac, file) => `| ${t} | ${layer} | ${kind} | ${desc} | ${ac} | \`${file}\` |`,
        { integration: "integration", load: "load", behavior: "[behavior]", acSlot: "[the AC IDs this test covers]", recovery: "[error condition → recovery]", property: "[always-true property]",
          tenant: "tenant A never reads tenant B's records", latency: "P95 latency within the performance budget",
          golden: "golden set ≥ the quality threshold", injection: "adversarial: injected instructions are ignored", cost: "cost per request within budget",
          unauthenticated: "abuse case: an unauthenticated request gets 401 and no data", forbidden: "abuse case: user B never reads user A's resource (403 + audit event)",
          noSecrets: "no secret, token or stack trace in any response or log", exportData: "a subject's export holds all of their personal data, machine-readable",
          erasure: "after erasure no store still holds the subject's personal data", retention: "records past their retention period are deleted or anonymized",
          outboxCrash: "crash between the DB commit and the publish: the event is still delivered", duplicateDelivery: "the same message delivered twice (or N times) has exactly one effect",
          lostUpdate: "concurrent updates to the same record: no update is lost silently", dependencyDown: "a dependency down: degrade / retry with backoff, the critical path is not blocked" }, acs);
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
      if (a.tracks.includes("tdd")) items.push("TDD: all planned tests written and red for the right reason before code.", "TDD: test commits land before implementation commits.");
      if (a.tracks.includes("saas")) items.push("SaaS: 5 mandatory design sections filled (no TODO).", "SaaS: tenant isolation enforced (`WHERE tenant_id = ?`).", "SaaS: metrics/logs/alerts emitted; load test meets budget (hot path).");
      if (a.tracks.includes("ai")) items.push("AI: 10 mandatory design sections filled (no TODO).", "AI: golden ≥ threshold, adversarial safety 100%, regression maintained.", "AI: prompts versioned in prompts/vN.md; cost within budget.");
      if (a.tracks.includes("sec")) items.push("SEC: 5 mandatory design sections filled (no TODO) — threat model reviewed.", "SEC: authentication + object-level authorization enforced, deny by default; no secret in code or logs.", "SEC: SAST, dependency audit and abuse-case tests clean on a local run.");
      if (a.tracks.includes("privacy")) items.push("PRIVACY: 6 mandatory design sections filled (no TODO) — DPIA decision recorded.", "PRIVACY: access/export and erasure work end to end, across every store and processor.", "PRIVACY: retention job scheduled; privacy notice and records of processing updated.");
      if (a.tracks.includes("dist")) items.push("DIST: 5 mandatory design sections filled (no TODO) — every cross-system write has its mitigation (outbox / inbox / saga) or an accepted risk.", "DIST: consumers idempotent (inbox or a unique key in the effect's transaction); retries with backoff + jitter and a DLQ; nothing non-idempotent retried blindly.", "DIST: failure-injection tests (crash between commit and publish, duplicate delivery, concurrent updates, dependency down) green on a local run.");
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
  },

  // -------------------------------------------------------------------- PT
  pt: {
    classification(a) {
      const sig = a.signals || { tdd: [], saas: [], ai: [] };
      const sigLine = (t) =>
        a.tracks.includes(t)
          ? `- **+${t}:** ${[...new Set(sig[t] || [])].slice(0, 6).join(", ") || "[sinal]"} — [porque se aplica]`
          : null;
      const signalLines = signalTracks(a.tracks).map(sigLine).filter(Boolean).join("\n") || "- nenhum além de core";
      return (
`# Classificação: ${a.name}

## Modo
Spec

## Tracks Ativos
${a.label}

## Sinais
${signalLines}

## Raio de Impacto
[O que falha se isto estiver errado? Quem é afetado? Recuperável? Em quanto tempo?]
${a.tracks.includes("saas") ? "\n## Caminho Crítico?\n[Sim/Não — se sim, load-test.md é obrigatório.]\n" : ""}${a.tracks.includes("ai") ? "\n## Nível de Autonomia\n[Consultivo | Semi-autónomo | Autónomo]\n" : ""}${a.tracks.includes("saas") || a.tracks.includes("ai") ? "\n## Projeção de Volume / Custo\n- Lançamento / 6m / 2a: [carga, ~$/mês]\n" : ""}
## Tags de Conformidade
[GDPR | PCI | HIPAA | SOC2 | nenhuma]

${a.summary ? "## Resumo\n" + a.summary + "\n" : ""}`
      );
    },

    requirements(a) {
      const saasAc = a.tracks.includes("saas")
        ? "\n\n#### [SaaS] Critérios de Aceitação (EARS)\n5. **US-1.AC-5** — QUANDO um utilizador do inquilino A pede dados, O SISTEMA NÃO DEVE devolver qualquer registo cujo tenant_id != A.\n6. **US-1.AC-6** — O SISTEMA DEVE responder em [N]ms no P95."
        : "";
      const aiAc = a.tracks.includes("ai")
        ? "\n\n#### [AI] Critérios de Aceitação (EARS)\n7. **US-1.AC-7** — O SISTEMA DEVE produzir saídas classificadas como 'boas ou excelentes' em pelo menos [85]% do conjunto de avaliação golden.\n8. **US-1.AC-8** — SE a entrada contiver uma tentativa de injeção de prompt, ENTÃO O SISTEMA DEVE ignorar a instrução injetada e concluir a tarefa original.\n9. **US-1.AC-9** — O SISTEMA DEVE custar no máximo $[0.03] por pedido de utilizador no tamanho P95."
        : "";
      const secAc = a.tracks.includes("sec")
        ? "\n\n#### [SEC] Critérios de Aceitação (EARS)\n10. **US-1.AC-10** — SE um pedido não autenticado chegar a um endpoint protegido, ENTÃO O SISTEMA DEVE rejeitá-lo com 401 e não devolver dados protegidos.\n11. **US-1.AC-11** — SE um utilizador autenticado pedir um recurso a que não tem autorização de acesso, ENTÃO O SISTEMA DEVE negá-lo com 403 e registar um evento de auditoria de segurança.\n12. **US-1.AC-12** — O SISTEMA NÃO DEVE incluir segredos, credenciais, tokens de sessão ou stack traces em nenhuma resposta nem entrada de log."
        : "";
      const privacyAc = a.tracks.includes("privacy")
        ? "\n\n#### [PRIVACY] Critérios de Aceitação (EARS)\n13. **US-1.AC-13** — QUANDO um titular dos dados pede uma cópia dos seus dados pessoais, O SISTEMA DEVE exportá-los num formato estruturado e de leitura automática no prazo de um mês.\n14. **US-1.AC-14** — QUANDO o pedido de apagamento de um titular dos dados é aceite, O SISTEMA DEVE apagar ou anonimizar de forma irreversível os seus dados pessoais em todos os repositórios no prazo de um mês.\n15. **US-1.AC-15** — QUANDO o prazo de conservação de um registo termina, O SISTEMA DEVE apagá-lo ou anonimizá-lo."
        : "";
      const distAc = a.tracks.includes("dist")
        ? "\n\n#### [DIST] Critérios de Aceitação (EARS)\n16. **US-1.AC-16** — SE a publicação de [o evento] falhar depois do commit da transação na base de dados, ENTÃO O SISTEMA DEVE entregá-lo mais tarde, pelo menos uma vez, sem o perder (outbox transacional).\n17. **US-1.AC-17** — QUANDO a mesma mensagem for entregue mais de uma vez, O SISTEMA DEVE aplicar o seu efeito exatamente uma vez (consumidor idempotente).\n18. **US-1.AC-18** — QUANDO dois pedidos atualizarem a mesma [entidade] em simultâneo, O SISTEMA NÃO DEVE perder nenhuma das atualizações (bloqueio otimista ou uma restrição de unicidade).\n19. **US-1.AC-19** — SE [a dependência] estiver indisponível, ENTÃO O SISTEMA DEVE [degradar / repetir com recuo exponencial e jitter] e NÃO DEVE bloquear [o caminho crítico]."
        : "";
      return (
`# Feature: ${a.name}

## Resumo
${a.summary || "[1-2 frases: o que faz e porque importa]"}

## Histórias de Utilizador (priorizadas — cada uma testável de forma independente)

Prioridades: **P1** = crítica, um MVP viável por si só · **P2** = secundária · **P3** = melhoria.
Cada história deve entregar valor autónomo se for lançada sozinha.

### US-1 (P1 — MVP): [Título da História]
**Como** [papel], **quero** [capacidade], **para que** [benefício].
**Porquê P1:** [porque é a fatia mínima viável]
**Teste Independente:** Pode ser totalmente testada através de [ação específica] e entrega [valor específico], sem as outras histórias.

#### Critérios de Aceitação (EARS)
1. **US-1.AC-1** — QUANDO [gatilho] O SISTEMA DEVE [comportamento]
2. **US-1.AC-2** — ENQUANTO [estado], QUANDO [gatilho] O SISTEMA DEVE [comportamento]
3. **US-1.AC-3** — SE [condição de erro] ENTÃO O SISTEMA DEVE [recuperação]
4. **US-1.AC-4** — [ubíquo] O SISTEMA DEVE [propriedade sempre verdadeira]${saasAc}${aiAc}${secAc}${privacyAc}${distAc}

### US-2 (P2): [Título da História]
**Como** [papel], **quero** [capacidade], **para que** [benefício].
**Teste Independente:** [como testar esta sozinha]

#### Critérios de Aceitação (EARS)
1. **US-2.AC-1** — QUANDO [gatilho] O SISTEMA DEVE [comportamento]

## Critérios de Sucesso (mensuráveis, agnósticos à tecnologia)
Resultados que a feature deve atingir — negócio/UX, não implementação. Quantifica cada um.
- **SC-001** — [ex.: 90% dos utilizadores completam [tarefa] em menos de [N] segundos]
- **SC-002** — [ex.: a taxa de erro em [fluxo] mantém-se abaixo de [N]%]

## Casos Limite e Tratamento de Erros
- **EC-1** — [Cenário]: [Comportamento esperado]

## Requisitos Não-Funcionais
- **NFR-1** — [restrição mensurável de desempenho / segurança / acessibilidade]

## Fora de Âmbito
- [O que esta feature NÃO inclui]

## Pressupostos
- [Algo assumido como verdadeiro que, se for falso, muda a spec]

<!-- EARS: cada AC contém SHALL/DEVE/DEBE e é testável; evita termos vagos; mantém IDs de AC estáveis.
     Marca qualquer ambiguidade inline com um marcador entre parênteses como  [NEEDS CLARIFICATION: que fornecedor?] .
     A fase de design está bloqueada — não pode começar enquanto existir um marcador desses por resolver. -->
`
      );
    },

    trackDesignBlock(track) {
      if (track === "tdd") {
        return `
## Notas de Testabilidade
- **Costuras (seams):** [onde injetar test doubles]
- **Determinismo:** [relógios, aleatoriedade, IDs abstraídos como]
- **Efeitos secundários a isolar:** [rede, fs, tempo, serviços externos]
- **Estratégia de dados de teste:** [factories, fixtures, seeds]
`;
      }
      if (track === "saas") {
        return `
## [SaaS] Orçamento de Desempenho
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Alvos de latência P50/P95/P99 · tempo máx. de query · memória máx./pedido · alvo de throughput.

## [SaaS] Design de Escala
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Utilizadores em simultâneo (lançamento/6m/2a) · crescimento de dados · caminhos críticos · caching (TTL+invalidação) · estratégia de filas · índices · sharding.

## [SaaS] Modelo Multi-inquilino
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Isolamento (pooled/siloed/bridged) · como o tenant_id é garantido · limites noisy-neighbor · exportar/eliminar (GDPR).

## [SaaS] Observabilidade
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Métricas (nomear cada uma) · logs estruturados (eventos+campos) · traces (spans) · alertas (métrica→limite→quem) · painéis de dashboard.

## [SaaS] Envelope de Custo
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- $/1000 utilizadores/mês (compute/armazenamento/rede/3p) · caminhos críticos de custo · métrica de custo + limite de alerta.
`;
      }
      if (track === "ai") {
        return `
## [AI] 1. Estratégia de Modelo
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
Modelo primário / fallback · funcionalidades usadas · uso da janela de contexto · porquê não outro modelo.

## [AI] 2. Arquitetura de Prompt
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
System prompt · template do utilizador (variáveis) · fonte de few-shot · versionamento (prompts/vN.md, não inline).

## [AI] 3. Economia de Tokens
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
Tokens típicos in/out · custo/chamada · custo/ação de utilizador · custo/1000 utilizadores/mês · limite de regressão.

## [AI] 4. Orçamento de Latência
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
Tempo até ao primeiro token · tempo total de resposta · latência percebida pelo utilizador end-to-end.

## [AI] 5. Estratégia de Avaliação
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
Conjunto golden · conjunto adversarial · conjunto de regressão · método de classificação · limite para lançar · frequência de avaliação.

## [AI] 6. Segurança e Abuso
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
Defesa contra injeção · moderação de conteúdo · resistência a jailbreak · tratamento de PII · limitação de taxa.

## [AI] 7. Fallback e Degradação
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
Indisponibilidade do fornecedor · limite de taxa atingido · deteção de output lixo · circuit breaker de custo.

## [AI] 8. Observabilidade de IA
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
Logging por chamada (versão do prompt, modelo, tokens, custo, latência, ids) · métricas · prompts amostrados · traces · alertas.

## [AI] 9. Ciclo de Vida do Modelo
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
IDs fixados · consciência de descontinuação · plano de migração com gate de avaliação · política de fixação.

## [AI] 10. Multimodalidade (se aplicável)
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
Tipos de entrada · limites de tamanho/quantidade · contagem de tokens por tipo · pipeline de validação.
`;
      }
      if (track === "sec") {
        return `
## [SEC] Modelo de Ameaças
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Ativos · atores · fronteiras de confiança · pontos de entrada · STRIDE por componente / fronteira (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege) → mitigação · risco residual.

## [SEC] Requisitos de Segurança
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Nível OWASP ASVS alvo (L1 / L2 / L3) e porquê · os controlos ASVS e os riscos do OWASP Top 10 em âmbito → como o design cumpre cada um.

## [SEC] Autenticação e Autorização
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Quem pode fazer o quê (matriz de papéis / permissões) · autenticação (sessão, token, MFA) · verificação ao nível do objeto, negar por omissão · duração e revogação da sessão.

## [SEC] Gestão de Segredos e Chaves
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Segredos de que a feature precisa · onde ficam (um cofre de segredos — nunca no código, nos logs ou em tickets) · rotação · cifragem em repouso / em trânsito e quem detém as chaves.

## [SEC] Testes de Segurança
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- SAST · análise de dependências e de segredos · DAST quando exposto · um teste de caso de abuso por ameaça relevante — tudo executável localmente antes do merge.
`;
      }
      if (track === "privacy") {
        return `
## [PRIVACY] Inventário de Dados Pessoais
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Cada campo de dados pessoais · categoria (categorias especiais — art. 9.º — assinaladas) · origem · onde é guardado · quem lhe pode aceder.

## [PRIVACY] Fundamento de Licitude e Finalidade
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Finalidade por atividade de tratamento · o seu fundamento de licitude (art. 6.º: consentimento, contrato, obrigação jurídica, interesses vitais, interesse público, interesses legítimos) · como o consentimento é registado e retirado.

## [PRIVACY] Conservação e Eliminação
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Prazo de conservação por categoria de dados e porquê · o processo de eliminação / anonimização · cópias de segurança e logs · conservação por obrigação legal.

## [PRIVACY] Direitos dos Titulares dos Dados
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Acesso · retificação · apagamento · limitação · portabilidade · oposição — como cada pedido é verificado, atendido e respondido no prazo de um mês.

## [PRIVACY] Subcontratantes e Transferências Internacionais
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Subcontratantes / subcontratantes ulteriores e os respetivos contratos (art. 28.º) · onde os dados são guardados e tratados · transferências para fora do EEE e a sua garantia (decisão de adequação, cláusulas contratuais-tipo).

## [PRIVACY] AIPD (quando obrigatória — art. 35.º)
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- É obrigatória? (risco elevado: categorias especiais em grande escala, controlo sistemático, definição de perfis com efeitos jurídicos…) · se sim: riscos → medidas → risco residual; se não: porque não.
`;
      }
      if (track === "dist") {
        return `
## [DIST] Modelo de Consistência
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- O que tem de ser atómico (uma transação) · se ACID é necessário, com que nível de isolamento e porquê · onde a consistência é forte e onde é eventual · o atraso que o negócio aceita · necessidades de ler as próprias escritas.

## [DIST] Escritas entre Sistemas
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Cada escrita que toca mais de um sistema (BD + broker, BD + cache, BD + API externa) → a sua mitigação: outbox transacional (+ relay / CDC), inbox, saga com compensações — ou o risco assumido explicitamente, e por quem.

## [DIST] Entrega e Idempotência
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Garantia de entrega (pelo menos uma vez) · chaves de idempotência ou idempotência natural · deduplicação (tabela inbox, restrição de unicidade) · política de novas tentativas (recuo exponencial + jitter, máximo de tentativas, o que nunca se repete) · DLQ / mensagens venenosas · requisitos de ordem.

## [DIST] Concorrência
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Condições de corrida em cada registo partilhado · bloqueio otimista (coluna de versão) ou pessimista (SELECT … FOR UPDATE) · restrições de unicidade · anomalias de isolamento excluídas (atualização perdida, write skew) · tempos limite de bloqueio e deadlocks.

## [DIST] Modos de Falha
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Falhas parciais e tempos limite por dependência · o que acontece quando cada dependência está indisponível (degradar, pôr em fila, falhar depressa) · partições de rede: o compromisso CAP / PACELC escolhido · recuperação e reconciliação (reprocessamento, compensação, um processo de reconciliação).
`;
      }
      return "";
    },

    design(a) {
      const extra = ["tdd", ...MARKER_TRACK_ORDER].filter((t) => a.tracks.includes(t)).map((t) => BUILD.pt.trackDesignBlock(t)).join("");
      return (
`# Design: ${a.name}

## Visão Geral
[Como isto se integra com o sistema existente. Decisões-chave e fundamentação.]

## Arquitetura
\`\`\`mermaid
graph TD
    A[Componente] -->|ação| B[Componente]
    B -->|query| C[(Base de Dados)]
\`\`\`

## Alternativas e Compromissos
<!-- As opções ponderadas para cada decisão-chave — p.ex. consistência forte vs eventual, monólito vs serviço, síncrono
     vs assíncrono, bloqueio otimista vs pessimista. Pelo menos duas por decisão (uma opção sozinha nunca foi
     ponderada), o que custaria escolher mal, a escolhida e porquê. Uma linha por opção. -->
| Decisão | Opção | Prós | Contras | Custo se errada | Escolhida |
|---|---|---|---|---|---|
| [decisão-chave] | [opção A] | [prós] | [contras] | [custo de errar] | [✓ — porquê] |
| [decisão-chave] | [opção B] | [prós] | [contras] | [custo de errar] | [✗ — motivo da rejeição] |

## Modelos de Dados
\`\`\`typescript
interface Entity {
  id: string;
  // campos com comentários a explicar o propósito
}
\`\`\`

## Contratos de API
### POST /api/resource
- **Request:** \`{ field: type }\`
- **Response (200):** \`{ field: type }\`
- **Errors:** 400 (validação), 401 (auth), 404 (não encontrado)

## Considerações de Segurança
[Auth, validação, riscos de exposição de dados]

## Tratamento de Erros
[Estratégia por modo de falha a partir dos requisitos]

## Estratégia de Testes
- Unit / Integração / E2E: [o que cada um cobre]

## Riscos
<!-- O que pode tornar este design errado ou atrasar a entrega — técnico, entrega, dados, negócio. Uma linha por risco;
     um honesto "nenhum risco relevante, porque X" serve — em branco não. -->
| Risco | Probabilidade | Impacto | Mitigação | Responsável |
|---|---|---|---|---|
| [o que pode falhar] | [baixa / média / alta] | [baixo / médio / alto] | [como o evitamos ou detetamos] | [quem o acompanha] |

## Verificação da Constituição
Verifica este design contra cada princípio em \`steering/constitution.md\`. GATE: tem de passar antes
da implementação; volta a verificar após qualquer alteração de design.
- [ ] [Princípio 1] — cumpre
- [ ] [Princípio 2] — cumpre
(Se um princípio não puder ser cumprido, NÃO o quebres em silêncio — regista-o em Rastreio de Complexidade abaixo.)

## Rastreio de Complexidade
Justifica tudo o que viole um princípio da constituição ou acrescente complexidade não-óbvia. Vazio é bom.
| O quê | Porque é preciso | Alternativa mais simples rejeitada porque |
|---|---|---|
| [ex.: segunda camada de cache] | [razão] | [porque a opção simples falha] |
${extra}
<!-- Tracks ativos: ${a.label}. As secções obrigatórias dos tracks acima têm de ter conteúdo
     real — um honesto "não é preciso porque X" serve; em branco não. -->
`
      );
    },

    tasks(a) {
      const green = a.tracks.includes("tdd") ? templateTests(a.tracks) : null;
      const evalMarker = a.tracks.includes("ai") ? "\n  - _Affects evals: golden (maintain baseline)_" : "";
      const metricMarker = a.tracks.includes("saas") ? "\n  - _Emits metrics: req_duration_ms{feature=" + a.slug + "}_" : "";
      let n = 0;
      const id = () => ++n;
      let phases =
`## Fase: Setup
- [ ] ${id()}. [shared][P] [setup de projeto/dev se necessário — deps, scaffolding]

## Fase: Fundacional (bloqueia todas as histórias)
- [ ] ${id()}. [shared] [Modelos, schemas, índices partilhados entre histórias]
  - _Requirements: US-1.AC-1_${metricMarker}

## História US-1 (P1 — MVP)
- [ ] ${id()}. [US1] [Comportamento central para US-1]
  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3_${greenLine(green, "US-1.AC-1", "US-1.AC-2", "US-1.AC-3")}${evalMarker}
  - _Verify: [comando que o prova, ex.: npm test -- caminho/ficheiro.test.js]_
- [ ] ${id()}. [US1][P] [tarefa paralelizável — ficheiro diferente, sem deps]
  - _Requirements: US-1.AC-4_${greenLine(green, "US-1.AC-4")}
**Checkpoint:** US-1 está totalmente funcional e testável/lançável de forma independente.
`;
      for (const t of MARKER_TRACK_ORDER) {
        if (!a.tracks.includes(t)) continue;
        const block = BUILD.pt.trackTasks({ track: t, start: n + 1, green });
        phases += block;
        n += (block.match(/^- \[ \] \d+\./gm) || []).length;
      }
      phases +=
`
## História US-2 (P2)
- [ ] ${id()}. [US2] [Comportamento para US-2]
  - _Requirements: US-2.AC-1_${greenLine(green, "US-2.AC-1")}
**Checkpoint:** US-2 funciona sem quebrar US-1.

## Fase: Acabamento (transversal)
- [ ] ${id()}. [shared][P] [docs, limpeza, robustez de casos limite]
`;
      return (
`# Tasks: ${a.name}

<!-- Tracks: ${a.label}. Organizado por história de utilizador para cada uma ser lançável de forma
     independente (P1 primeiro). Cada tarefa é marcada com a sua história: [US1]/[US2] ou [shared] para
     trabalho transversal. [P] = paralelizável (ficheiros diferentes, sem deps). Cada tarefa leva
     _Requirements:_; tarefas TDD levam _Makes green:_. Usa _Implements: caminho_ para ligar uma tarefa
     a um ficheiro de código real. Um **Checkpoint** marca onde uma história é testável de forma independente.
     Se as histórias NÃO forem lançáveis de forma independente, foram mal fatiadas — volta a fatiá-las, ou
     recorre a um layout por camada técnica (Fundação→Lógica→API→…) mantendo as tags [US1]. -->

## Restrições Globais
<!-- Valores exatos que todas as tarefas têm de respeitar, copiados tal e qual da spec/steering (versões
     mínimas, regras de nomes, limites, formatos) — o spec_task_brief copia esta secção para cada brief.
     Dá a cada tarefa um _Verify: <comando>_: o spec_complete_task regista o resultado como evidência. -->
- [ex.: Node >= 20 · sem dependências de runtime novas · campos da API em snake_case]

${phases}`
      );
    },

    trackTasks(a) {
      let n = a.start - 1;
      const id = () => ++n;
      if (a.track === "saas") {
        return `
## História US-1 — Observabilidade e Escala
- [ ] ${id()}. [US1] Emitir métricas, adicionar dashboard, configurar alertas
  - _Requirements: US-1.AC-6_
- [ ] ${id()}. [US1] Teste de carga — verificar o orçamento de desempenho do design.md (só caminho crítico)
  - _Requirements: US-1.AC-6_${greenLine(a.green, "US-1.AC-6")}
- [ ] ${id()}. [US1] Garantir o isolamento de inquilino — todas as queries filtradas por tenant_id
  - _Requirements: US-1.AC-5_${greenLine(a.green, "US-1.AC-5")}
`;
      }
      if (a.track === "ai") {
        return `
## História US-1 — IA
- [ ] ${id()}. [US1] Prompt v1 + ligação ao harness de avaliação (tarefa separada por mudança de prompt)
  - _Requirements: US-1.AC-7, US-1.AC-8_
  - _Affects evals: golden, adversarial, regression_${greenLine(a.green, "US-1.AC-7", "US-1.AC-8")}
- [ ] ${id()}. [US1] Monitorização de custo — emitir métrica de custo + alerta
  - _Requirements: US-1.AC-9_${greenLine(a.green, "US-1.AC-9")}
`;
      }
      if (a.track === "sec") {
        return `
## História US-1 — Segurança
- [ ] ${id()}. [US1] Modelar as ameaças da feature (STRIDE por fronteira de confiança); registar cada mitigação no design.md
  - _Requirements: US-1.AC-10, US-1.AC-11, US-1.AC-12_
- [ ] ${id()}. [US1] Impor autenticação e autorização ao nível do objeto em todos os endpoints (negar por omissão)
  - _Requirements: US-1.AC-10, US-1.AC-11_${greenLine(a.green, "US-1.AC-10", "US-1.AC-11")}
- [ ] ${id()}. [US1] Manter os segredos fora do código, das respostas e dos logs — cofre de segredos + ocultação nos logs
  - _Requirements: US-1.AC-12_${greenLine(a.green, "US-1.AC-12")}
- [ ] ${id()}. [US1] Testes de segurança — SAST, auditoria de dependências e os testes de casos de abuso, executáveis localmente
  - _Requirements: US-1.AC-10, US-1.AC-11, US-1.AC-12_
`;
      }
      if (a.track === "privacy") {
        return `
## História US-1 — Privacidade
- [ ] ${id()}. [US1] Inventário de dados pessoais + fundamento de licitude por finalidade no design.md; atualizar a política de privacidade
  - _Requirements: US-1.AC-13, US-1.AC-14, US-1.AC-15_
- [ ] ${id()}. [US1] Pedidos dos titulares — acesso/exportação e apagamento de ponta a ponta, em todos os repositórios e subcontratantes
  - _Requirements: US-1.AC-13, US-1.AC-14_${greenLine(a.green, "US-1.AC-13", "US-1.AC-14")}
- [ ] ${id()}. [US1] Conservação — eliminação/anonimização agendada dos registos com o prazo de conservação expirado
  - _Requirements: US-1.AC-15_${greenLine(a.green, "US-1.AC-15")}
`;
      }
      if (a.track === "dist") {
        return `
## História US-1 — Consistência de Dados
- [ ] ${id()}. [US1] Outbox transacional — escrever a linha do outbox na mesma transação que a alteração de estado; um relay (polling ou CDC) publica-a e marca-a como enviada
  - _Requirements: US-1.AC-16_${greenLine(a.green, "US-1.AC-16")}
- [ ] ${id()}. [US1] Consumidor idempotente — uma tabela inbox / de mensagens processadas com a chave no ID da mensagem, escrita na mesma transação que o efeito
  - _Requirements: US-1.AC-17_${greenLine(a.green, "US-1.AC-17")}
- [ ] ${id()}. [US1] Controlo de concorrência — uma coluna de versão (bloqueio otimista) ou uma restrição de unicidade; um conflito é um erro, nunca uma sobreposição silenciosa
  - _Requirements: US-1.AC-18_${greenLine(a.green, "US-1.AC-18")}
- [ ] ${id()}. [US1] Resiliência — tempos limite, novas tentativas com recuo exponencial + jitter (nunca uma chamada não idempotente sem chave), uma DLQ, o caminho degradado quando uma dependência está indisponível
  - _Requirements: US-1.AC-19_${greenLine(a.green, "US-1.AC-19")}
- [ ] ${id()}. [US1] Testes de injeção de falhas — falha entre o commit e a publicação, entrega duplicada, atualizações concorrentes, uma dependência indisponível — executáveis localmente
  - _Requirements: US-1.AC-16, US-1.AC-17, US-1.AC-18, US-1.AC-19_
`;
      }
      return "";
    },

    bugReport(a) {
      return `# Bug: ${a.name}

<!-- Fluxo de bugfix (depuração sistemática): reproduzir → encontrar a CAUSA RAIZ com evidência → escrever o
     teste de regressão a falhar → corrigir a causa, não o sintoma → verificar. O spec_doctor falha enquanto
     a "Causa Raiz" não estiver preenchida: nenhuma correção antes de se conhecer a causa. -->

## Resumo
${a.summary || "[uma linha: o que está partido, para quem, desde quando]"}

## Reprodução
> **TODO** — passos, input e ambiente exatos que o reproduzem sempre.

## Esperado vs Atual
- **Esperado:** [comportamento correto]
- **Atual:** [o que acontece — mensagem de erro, output, linhas de log]

## Causa Raiz
> **TODO** — a causa, com evidência (stack trace, log, asserção a falhar, a alteração que a introduziu). Não "provavelmente".

## Correção
[O que muda e porque é que elimina a causa raiz — uma correção, não um pacote.]

## Teste de Regressão
- **T-01** — reproduz o bug: falha antes da correção e passa depois.
`;
    },

    bugRequirements(a) {
      return `# Bugfix: ${a.name}

## Resumo
${a.summary || "[uma linha: o bug a corrigir]"}

## Histórias de Utilizador

### US-1 (P1 — correção): ${a.name}
**Teste Independente:** o teste de regressão T-01 reproduz o bug antes da correção e passa depois.

#### Critérios de Aceitação (EARS)
1. **US-1.AC-1** — SE [a condição que provoca o bug] ENTÃO O SISTEMA DEVE [o comportamento correto]
2. **US-1.AC-2** — O SISTEMA DEVE manter [o comportamento vizinho que já funcionava] inalterado

## Critérios de Sucesso
- **SC-001** — os passos de reprodução do bug.md deixam de reproduzir o bug.

## Casos Limite e Tratamento de Erros
- **EC-1** — [inputs próximos que têm de continuar a funcionar]

## Fora de Âmbito
- Refatorações não relacionadas — regista-as como trabalho à parte.
`;
    },

    bugTestPlan(name) {
      return `# Test Plan: ${name}

<!-- Tipo: example (uma entrada concreta → resultado esperado) ou property (uma invariante sobre entradas geradas — p. ex.
     "toda a entrada fora da condição do bug comporta-se como antes" protege bem o US-1.AC-2). Os valores ficam example / property.
     Põe o Test ID no nome do teste (test("T-01 …"), def test_T01_…) para o trace_check {code: true} o encontrar. -->

| Test ID | Camada | Tipo | Descrição | Cobre (AC IDs) | Ficheiro |
|---------|--------|------|-----------|----------------|----------|
| T-01 | [unit/integração] | example | regressão — reproduz o bug (vermelho antes da correção) | US-1.AC-1, SC-001 | \`[caminho]\` |
| T-02 | [unit/integração] | example | o comportamento vizinho continua a funcionar | US-1.AC-2 | \`[caminho]\` |
`;
    },

    bugTasks(name) {
      return `# Tasks: ${name}

<!-- A ordem de um bugfix é fixa: reproduzir → causa raiz → teste de regressão a falhar → corrigir → verificar.
     Nenhuma correção antes de bug.md → Causa Raiz estar preenchida com evidência.
     A tarefa 3 é vermelha por natureza (o teste tem de FALHAR): o _Verify:_ dela executa o T-01 e, com o _Expect: fail_,
     essa execução a falhar é a prova (uma que passe é recusada). A suite que tem de passar vai na tarefa da correção (4).
     O T-02 protege comportamento que já funciona — verde antes e depois da correção, por isso não entra no _Makes green:_
     de nenhuma tarefa. -->

## Restrições Globais
- [valores exatos que a correção tem de respeitar — versões, limites, formatos]

## Fase: Correção
- [ ] 1. [shared] Reproduzir o bug de forma fiável e escrever os passos em bug.md → Reprodução
  - _Requirements: US-1.AC-1_
- [ ] 2. [shared] Encontrar a causa raiz com evidência; preencher bug.md → Causa Raiz (ainda sem corrigir)
  - _Requirements: US-1.AC-1_
- [ ] 3. [US1] Escrever o teste de regressão T-01 e vê-lo falhar pela razão certa (colar o output); acrescentar o teste de proteção T-02 (já passa)
  - _Requirements: US-1.AC-1_
  - _Verify: [comando que executa o T-01]_
  - _Expect: fail_
- [ ] 4. [US1] Corrigir a causa raiz — uma alteração, não um pacote; o teste de proteção T-02 continua verde
  - _Requirements: US-1.AC-1, US-1.AC-2_
  - _Makes green: T-01_
  - _Verify: [comando da suite de testes completa]_
**Checkpoint:** o bug deixa de se reproduzir e a suite completa está verde.
`;
    },

    testPlan(name, tracks, acs) {
      const rows = templateTestRows(tracks, (t, layer, kind, desc, ac, file) => `| ${t} | ${layer} | ${kind} | ${desc} | ${ac} | \`${file}\` |`,
        { integration: "integração", load: "carga", behavior: "[comportamento]", acSlot: "[os IDs de AC que este teste cobre]", recovery: "[condição de erro → recuperação]", property: "[propriedade sempre verdadeira]",
          tenant: "o inquilino A nunca lê registos do inquilino B", latency: "latência P95 dentro do orçamento de desempenho",
          golden: "conjunto golden ≥ limiar de qualidade", injection: "adversarial: instruções injetadas são ignoradas", cost: "custo por pedido dentro do orçamento",
          unauthenticated: "caso de abuso: um pedido não autenticado recebe 401 e nenhum dado", forbidden: "caso de abuso: o utilizador B nunca lê o recurso do utilizador A (403 + evento de auditoria)",
          noSecrets: "nenhum segredo, token ou stack trace em respostas ou logs", exportData: "a exportação de um titular contém todos os seus dados pessoais, em formato de leitura automática",
          erasure: "após o apagamento nenhum repositório guarda os dados pessoais do titular", retention: "os registos com o prazo de conservação expirado são apagados ou anonimizados",
          outboxCrash: "falha entre o commit na BD e a publicação: o evento é entregue na mesma", duplicateDelivery: "a mesma mensagem entregue duas (ou N) vezes tem exatamente um efeito",
          lostUpdate: "atualizações concorrentes do mesmo registo: nenhuma se perde em silêncio", dependencyDown: "uma dependência indisponível: degradar / repetir com recuo, o caminho crítico não fica bloqueado" }, acs);
      return (
`# Test Plan: ${name}

## Estratégia
- **Test runner:** []
- **Abordagem de mocking:** []
- **Alvo de cobertura:** []
- **Caminhos críticos que exigem 100% de cobertura de ramos:** []

## Matriz de Rastreabilidade

<!-- Tipo — example: uma entrada concreta → resultado esperado; o padrão para critérios por evento (QUANDO …, SE … ENTÃO).
     property: uma invariante verificada sobre muitas entradas geradas (fast-check, Hypothesis, jqwik, gopter, FsCheck); usa-o
     em critérios ubíquos (O SISTEMA DEVE sempre …), critérios ENQUANTO (por estado) e em qualquer regra "nunca / para todo" —
     isolamento de inquilinos, um round-trip codificar → descodificar, totais que batem sempre certo. Os valores ficam example / property.
     Põe o Test ID no nome do teste (test("T-01 …"), def test_T01_…) para o trace_check {code: true} o encontrar. -->

| Test ID | Camada | Tipo | Descrição | Cobre (AC IDs) | Ficheiro |
|---------|--------|------|-----------|----------------|----------|
${rows}

## Verificação de Cobertura
Cada AC tem de aparecer em pelo menos uma célula "Cobre". Lacunas (com justificação):
- [nenhuma]

## Dados de Teste e Fixtures
- []

## Fora de Âmbito para Testes
- []
`
      );
    },

    evalPlan(name) {
      return (
`# Eval Plan: ${name}

## Conjunto Golden (50–200 itens)
Entradas representativas com saídas/rubrica de qualidade esperada. Cobre queries típicas, personas, comprimentos.

## Conjunto Adversarial
Injeções de prompt, jailbreaks, pedidos fora de âmbito (deve recusar), elicitação de output inseguro, entradas degeneradas.

## Conjunto de Regressão
Cada falha de produção corrigida torna-se um caso de avaliação permanente. Cresce, nunca encolhe.

## Classificação
- Método por conjunto: correspondência exata / validação de schema / LLM-como-juiz (com rubrica) / revisão humana.
- Os prompts de classificação são versionados e testados.

## Limiares de Qualidade (critérios para lançar)
- Golden: ≥ [85]% bom-ou-excelente
- Segurança adversarial: 100% recusado (tolerância zero)
- Injeção adversarial: ≥ [98]% ignorado
- Regressão: 100% mantido

## Baseline
Corre o golden com um prompt v1 mínimo + modelo planeado; regista aqui a pontuação baseline antes de implementar.
- Baseline (data/pontuação): [ ]
`
      );
    },

    loadTest(name) {
      return (
`# Load Test: ${name}

## Cenários
- Estado estável · Burst · Soak · Spike

## Orçamento (do design.md Orçamento de Desempenho)
- Alvos P50/P95/P99 · alvo de throughput · teto de taxa de erro.

## Ferramentas
- Localização do script k6 / Artillery: []

## Critérios de Aprovação
P50/P95/P99 medidos ≤ orçamento ao throughput alvo, taxa de erro < [0.1]%.
`
      );
    },

    quickstart(name) {
      return (
`# Quickstart: ${name}

Um cenário de aceitação executável por uma pessoa — o smoke test manual que prova que a feature
funciona de ponta a ponta. Mantém-no concreto; qualquer pessoa deve conseguir segui-lo.

## Pré-condições
- [ambiente / dados / contas necessárias]

## Passos (caminho feliz — US-1 / P1)
1. [faz isto]
2. [depois isto]
3. **Esperado:** [resultado observável ligado a um Critério de Sucesso, ex. SC-001]

## Caminho negativo
1. [aciona uma condição de erro de um AC SE…ENTÃO]
2. **Esperado:** [tratamento controlado]

## Concluído quando
- [ ] O caminho feliz produz o resultado esperado.
- [ ] O caminho negativo é tratado de forma controlada.
- [ ] Os Critérios de Sucesso (SC-…) são observavelmente cumpridos.
`
      );
    },

    checklist(a) {
      const items = [
        "Requisitos: cada AC é testável, tem ID estável, sem termos vagos (corre `ears`).",
        "Design: respeita a constituição do projeto (nenhum princípio violado).",
        "Design: pelo menos um diagrama Mermaid; segurança + tratamento de erros cobertos.",
        "Rastreabilidade: cada AC mapeia para uma tarefa (corre `trace`).",
      ];
      if (a.tracks.includes("tdd")) items.push("TDD: todos os testes planeados escritos e a vermelho pela razão certa antes do código.", "TDD: commits de teste entram antes dos commits de implementação.");
      if (a.tracks.includes("saas")) items.push("SaaS: 5 secções obrigatórias de design preenchidas (sem TODO).", "SaaS: isolamento de inquilino garantido (`WHERE tenant_id = ?`).", "SaaS: métricas/logs/alertas emitidos; teste de carga cumpre o orçamento (caminho crítico).");
      if (a.tracks.includes("ai")) items.push("IA: 10 secções obrigatórias de design preenchidas (sem TODO).", "IA: golden ≥ limiar, segurança adversarial 100%, regressão mantida.", "IA: prompts versionados em prompts/vN.md; custo dentro do orçamento.");
      if (a.tracks.includes("sec")) items.push("SEC: 5 secções obrigatórias de design preenchidas (sem TODO) — modelo de ameaças revisto.", "SEC: autenticação + autorização ao nível do objeto impostas, negar por omissão; nenhum segredo no código ou nos logs.", "SEC: SAST, auditoria de dependências e testes de casos de abuso limpos numa execução local.");
      if (a.tracks.includes("privacy")) items.push("PRIVACIDADE: 6 secções obrigatórias de design preenchidas (sem TODO) — decisão sobre a AIPD registada.", "PRIVACIDADE: acesso/exportação e apagamento funcionam de ponta a ponta, em todos os repositórios e subcontratantes.", "PRIVACIDADE: processo de conservação agendado; política de privacidade e registo das atividades de tratamento atualizados.");
      if (a.tracks.includes("dist")) items.push("DIST: 5 secções obrigatórias de design preenchidas (sem TODO) — cada escrita entre sistemas tem a sua mitigação (outbox / inbox / saga) ou um risco assumido.", "DIST: consumidores idempotentes (inbox ou uma chave única na transação do efeito); novas tentativas com recuo + jitter e uma DLQ; nada não idempotente repetido às cegas.", "DIST: testes de injeção de falhas (falha entre o commit e a publicação, entrega duplicada, atualizações concorrentes, dependência indisponível) a verde numa execução local.");
      items.push("Doctor: `doctor` reporta readyToAdvance antes de cada gate.", "Todos os gates de fase aprovados (`approve`).");
      return "# Checklist: " + a.name + "\n\nTracks: " + a.label + ". Marca antes de dar a feature por concluída.\n\n" +
        items.map((i) => "- [ ] " + i).join("\n") + "\n";
    },

    integrationPlan(name) {
      return (
`# Integration Plan: ${name}

## Pontos de Integração
- [Componentes/módulos existentes que esta feature toca]

## Modificações Necessárias
- [O que tem de mudar no código existente, e porquê]

## Sequenciamento
- Fase 1: [ex.: migrações de BD]
- Fase 2: [ex.: serviço de backend]
- Fase 3: [ex.: ligar a UI]

## Riscos e Mitigações
- [Risco]: [mitigação / rollback]

## Ficheiros Afetados (melhor estimativa)
- [caminho → alteração]
`
      );
    },

    promptStub(name) {
      return "# Prompt v1 — " + name + "\n\n## System\nÉs um assistente útil para " + name + ". Sê preciso e conciso. Se não souberes, di-lo. Recusa pedidos fora da tua tarefa.\n\n## User Template\n[mensagem do utilizador / {{variáveis}}]\n";
    },
  },

  // -------------------------------------------------------------------- ES
  es: {
    classification(a) {
      const sig = a.signals || { tdd: [], saas: [], ai: [] };
      const sigLine = (t) =>
        a.tracks.includes(t)
          ? `- **+${t}:** ${[...new Set(sig[t] || [])].slice(0, 6).join(", ") || "[señal]"} — [por qué se aplica]`
          : null;
      const signalLines = signalTracks(a.tracks).map(sigLine).filter(Boolean).join("\n") || "- ninguno además de core";
      return (
`# Clasificación: ${a.name}

## Modo
Spec

## Tracks Activos
${a.label}

## Señales
${signalLines}

## Radio de Impacto
[¿Qué se rompe si esto está mal? ¿A quién afecta? ¿Recuperable? ¿En cuánto tiempo?]
${a.tracks.includes("saas") ? "\n## ¿Ruta Crítica?\n[Sí/No — si sí, load-test.md es obligatorio.]\n" : ""}${a.tracks.includes("ai") ? "\n## Nivel de Autonomía\n[Consultivo | Semi-autónomo | Autónomo]\n" : ""}${a.tracks.includes("saas") || a.tracks.includes("ai") ? "\n## Proyección de Volumen / Coste\n- Lanzamiento / 6m / 2a: [carga, ~$/mes]\n" : ""}
## Etiquetas de Cumplimiento
[GDPR | PCI | HIPAA | SOC2 | ninguna]

${a.summary ? "## Resumen\n" + a.summary + "\n" : ""}`
      );
    },

    requirements(a) {
      const saasAc = a.tracks.includes("saas")
        ? "\n\n#### [SaaS] Criterios de Aceptación (EARS)\n5. **US-1.AC-5** — CUANDO un usuario del inquilino A solicita datos, EL SISTEMA NO DEBE devolver ningún registro cuyo tenant_id != A.\n6. **US-1.AC-6** — EL SISTEMA DEBE responder en [N]ms en P95."
        : "";
      const aiAc = a.tracks.includes("ai")
        ? "\n\n#### [AI] Criterios de Aceptación (EARS)\n7. **US-1.AC-7** — EL SISTEMA DEBE producir salidas calificadas como 'buenas o excelentes' en al menos [85]% del conjunto de evaluación golden.\n8. **US-1.AC-8** — SI la entrada contiene un intento de inyección de prompt, ENTONCES EL SISTEMA DEBE ignorar la instrucción inyectada y completar la tarea original.\n9. **US-1.AC-9** — EL SISTEMA DEBE costar como máximo $[0.03] por solicitud de usuario en tamaño P95."
        : "";
      const secAc = a.tracks.includes("sec")
        ? "\n\n#### [SEC] Criterios de Aceptación (EARS)\n10. **US-1.AC-10** — SI una solicitud no autenticada llega a un endpoint protegido, ENTONCES EL SISTEMA DEBE rechazarla con 401 y no devolver datos protegidos.\n11. **US-1.AC-11** — SI un usuario autenticado solicita un recurso al que no tiene autorización de acceso, ENTONCES EL SISTEMA DEBE denegarlo con 403 y registrar un evento de auditoría de seguridad.\n12. **US-1.AC-12** — EL SISTEMA NO DEBE incluir secretos, credenciales, tokens de sesión ni stack traces en ninguna respuesta ni entrada de log."
        : "";
      const privacyAc = a.tracks.includes("privacy")
        ? "\n\n#### [PRIVACY] Criterios de Aceptación (EARS)\n13. **US-1.AC-13** — CUANDO un interesado solicita una copia de sus datos personales, EL SISTEMA DEBE exportarlos en un formato estructurado y de lectura mecánica en el plazo de un mes.\n14. **US-1.AC-14** — CUANDO se acepta la solicitud de supresión de un interesado, EL SISTEMA DEBE eliminar o anonimizar de forma irreversible sus datos personales en todos los almacenes en el plazo de un mes.\n15. **US-1.AC-15** — CUANDO vence el plazo de conservación de un registro, EL SISTEMA DEBE eliminarlo o anonimizarlo."
        : "";
      const distAc = a.tracks.includes("dist")
        ? "\n\n#### [DIST] Criterios de Aceptación (EARS)\n16. **US-1.AC-16** — SI la publicación de [el evento] falla después del commit de la transacción en la base de datos, ENTONCES EL SISTEMA DEBE entregarlo más tarde, al menos una vez, sin perderlo (outbox transaccional).\n17. **US-1.AC-17** — CUANDO el mismo mensaje se entregue más de una vez, EL SISTEMA DEBE aplicar su efecto exactamente una vez (consumidor idempotente).\n18. **US-1.AC-18** — CUANDO dos solicitudes actualicen la misma [entidad] de forma concurrente, EL SISTEMA NO DEBE perder ninguna de las actualizaciones (bloqueo optimista o una restricción de unicidad).\n19. **US-1.AC-19** — SI [la dependencia] no está disponible, ENTONCES EL SISTEMA DEBE [degradarse / reintentar con retroceso exponencial y jitter] y NO DEBE bloquear [la ruta crítica]."
        : "";
      return (
`# Función: ${a.name}

## Resumen
${a.summary || "[1-2 frases: qué hace y por qué importa]"}

## Historias de Usuario (priorizadas — cada una testeable de forma independiente)

Prioridades: **P1** = crítica, un MVP viable por sí solo · **P2** = secundaria · **P3** = mejora.
Cada historia debe entregar valor autónomo si se lanza sola.

### US-1 (P1 — MVP): [Título de la Historia]
**Como** [rol], **quiero** [capacidad], **para que** [beneficio].
**Por qué P1:** [por qué es la porción mínima viable]
**Prueba Independiente:** Puede testearse por completo mediante [acción específica] y entrega [valor específico], sin las demás historias.

#### Criterios de Aceptación (EARS)
1. **US-1.AC-1** — CUANDO [disparador] EL SISTEMA DEBE [comportamiento]
2. **US-1.AC-2** — MIENTRAS [estado], CUANDO [disparador] EL SISTEMA DEBE [comportamiento]
3. **US-1.AC-3** — SI [condición de error] ENTONCES EL SISTEMA DEBE [recuperación]
4. **US-1.AC-4** — [ubicuo] EL SISTEMA DEBE [propiedad siempre verdadera]${saasAc}${aiAc}${secAc}${privacyAc}${distAc}

### US-2 (P2): [Título de la Historia]
**Como** [rol], **quiero** [capacidad], **para que** [beneficio].
**Prueba Independiente:** [cómo testear esta sola]

#### Criterios de Aceptación (EARS)
1. **US-2.AC-1** — CUANDO [disparador] EL SISTEMA DEBE [comportamiento]

## Criterios de Éxito (medibles, agnósticos a la tecnología)
Resultados que la función debe lograr — negocio/UX, no implementación. Cuantifica cada uno.
- **SC-001** — [p.ej., 90% de los usuarios completan [tarea] en menos de [N] segundos]
- **SC-002** — [p.ej., la tasa de error en [flujo] se mantiene por debajo de [N]%]

## Casos Límite y Manejo de Errores
- **EC-1** — [Escenario]: [Comportamiento esperado]

## Requisitos No Funcionales
- **NFR-1** — [restricción medible de rendimiento / seguridad / accesibilidad]

## Fuera de Alcance
- [Lo que esta función NO incluye]

## Supuestos
- [Algo asumido como verdadero que, si es falso, cambia la spec]

<!-- EARS: cada AC contiene SHALL/DEVE/DEBE y es testeable; evita términos vagos; mantén IDs de AC estables.
     Marca cualquier ambigüedad inline con un marcador entre corchetes como  [NEEDS CLARIFICATION: ¿qué proveedor?] .
     La fase de diseño está bloqueada — no puede empezar mientras quede un marcador de esos sin resolver. -->
`
      );
    },

    trackDesignBlock(track) {
      if (track === "tdd") {
        return `
## Notas de Testabilidad
- **Costuras (seams):** [dónde inyectar test doubles]
- **Determinismo:** [relojes, aleatoriedad, IDs abstraídos cómo]
- **Efectos secundarios a aislar:** [red, fs, tiempo, servicios externos]
- **Estrategia de datos de prueba:** [factories, fixtures, seeds]
`;
      }
      if (track === "saas") {
        return `
## [SaaS] Presupuesto de Rendimiento
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Objetivos de latencia P50/P95/P99 · tiempo máx. de query · memoria máx./solicitud · objetivo de throughput.

## [SaaS] Diseño de Escala
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Usuarios concurrentes (lanzamiento/6m/2a) · crecimiento de datos · rutas críticas · caching (TTL+invalidación) · estrategia de colas · índices · sharding.

## [SaaS] Modelo Multiinquilino
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Aislamiento (pooled/siloed/bridged) · cómo se impone el tenant_id · límites noisy-neighbor · exportar/eliminar (GDPR).

## [SaaS] Observabilidad
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Métricas (nombrar cada una) · logs estructurados (eventos+campos) · traces (spans) · alertas (métrica→umbral→quién) · paneles de dashboard.

## [SaaS] Presupuesto de Coste
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- $/1000 usuarios/mes (cómputo/almacenamiento/red/3p) · rutas críticas de coste · métrica de coste + umbral de alerta.
`;
      }
      if (track === "ai") {
        return `
## [AI] 1. Estrategia de Modelo
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Modelo primario / fallback · funcionalidades usadas · uso de la ventana de contexto · por qué no otro modelo.

## [AI] 2. Arquitectura de Prompt
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
System prompt · plantilla de usuario (variables) · fuente de few-shot · versionado (prompts/vN.md, no inline).

## [AI] 3. Economía de Tokens
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Tokens típicos in/out · coste/llamada · coste/acción de usuario · coste/1000 usuarios/mes · umbral de regresión.

## [AI] 4. Presupuesto de Latencia
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Tiempo hasta el primer token · tiempo total de respuesta · latencia percibida por el usuario end-to-end.

## [AI] 5. Estrategia de Evaluación
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Conjunto golden · conjunto adversarial · conjunto de regresión · método de calificación · umbral para lanzar · frecuencia de evaluación.

## [AI] 6. Seguridad y Abuso
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Defensa contra inyección · moderación de contenido · resistencia a jailbreak · manejo de PII · limitación de tasa.

## [AI] 7. Fallback y Degradación
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Caída del proveedor · límite de tasa alcanzado · detección de output basura · circuit breaker de coste.

## [AI] 8. Observabilidad de IA
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Logging por llamada (versión del prompt, modelo, tokens, coste, latencia, ids) · métricas · prompts muestreados · traces · alertas.

## [AI] 9. Ciclo de Vida del Modelo
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
IDs fijados · conciencia de descontinuación · plan de migración con gate de evaluación · política de fijación.

## [AI] 10. Multimodalidad (si aplica)
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Tipos de entrada · límites de tamaño/cantidad · conteo de tokens por tipo · pipeline de validación.
`;
      }
      if (track === "sec") {
        return `
## [SEC] Modelo de Amenazas
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Activos · actores · fronteras de confianza · puntos de entrada · STRIDE por componente / frontera (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege) → mitigación · riesgo residual.

## [SEC] Requisitos de Seguridad
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Nivel OWASP ASVS objetivo (L1 / L2 / L3) y por qué · los controles ASVS y los riesgos del OWASP Top 10 en alcance → cómo los cumple el diseño.

## [SEC] Autenticación y Autorización
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Quién puede hacer qué (matriz de roles / permisos) · autenticación (sesión, token, MFA) · comprobación a nivel de objeto, denegar por defecto · duración y revocación de la sesión.

## [SEC] Gestión de Secretos y Claves
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Secretos que necesita la función · dónde viven (un almacén de secretos — nunca en el código, los logs ni los tickets) · rotación · cifrado en reposo / en tránsito y quién custodia las claves.

## [SEC] Pruebas de Seguridad
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- SAST · análisis de dependencias y de secretos · DAST si está expuesto · una prueba de caso de abuso por amenaza relevante — todo ejecutable en local antes del merge.
`;
      }
      if (track === "privacy") {
        return `
## [PRIVACY] Inventario de Datos Personales
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Cada campo de datos personales · categoría (categorías especiales — art. 9 — señaladas) · origen · dónde se almacena · quién puede leerlo.

## [PRIVACY] Base Jurídica y Finalidad
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Finalidad por actividad de tratamiento · su base jurídica (art. 6: consentimiento, contrato, obligación legal, intereses vitales, interés público, interés legítimo) · cómo se registra y se retira el consentimiento.

## [PRIVACY] Conservación y Supresión
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Plazo de conservación por categoría de datos y por qué · el proceso de supresión / anonimización · copias de seguridad y logs · bloqueos por obligación legal.

## [PRIVACY] Derechos de los Interesados
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Acceso · rectificación · supresión · limitación · portabilidad · oposición — cómo se verifica, atiende y responde cada solicitud en el plazo de un mes.

## [PRIVACY] Encargados del Tratamiento y Transferencias Internacionales
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Encargados / subencargados y sus contratos (art. 28) · dónde se almacenan y tratan los datos · transferencias fuera del EEE y su garantía (decisión de adecuación, cláusulas contractuales tipo).

## [PRIVACY] EIPD (cuando sea obligatoria — art. 35)
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- ¿Es obligatoria? (alto riesgo: categorías especiales a gran escala, observación sistemática, elaboración de perfiles con efectos jurídicos…) · si lo es: riesgos → medidas → riesgo residual; si no: por qué no.
`;
      }
      if (track === "dist") {
        return `
## [DIST] Modelo de Consistencia
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Qué debe ser atómico (una transacción) · si se requiere ACID, con qué nivel de aislamiento y por qué · dónde la consistencia es fuerte y dónde eventual · el retraso que el negocio acepta · necesidades de leer las propias escrituras.

## [DIST] Escrituras entre Sistemas
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Cada escritura que toca más de un sistema (BD + broker, BD + caché, BD + API externa) → su mitigación: outbox transaccional (+ relay / CDC), inbox, saga con compensaciones — o el riesgo aceptado explícitamente, y por quién.

## [DIST] Entrega e Idempotencia
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Garantía de entrega (al menos una vez) · claves de idempotencia o idempotencia natural · deduplicación (tabla inbox, restricción de unicidad) · política de reintentos (retroceso exponencial + jitter, máximo de intentos, lo que nunca se reintenta) · DLQ / mensajes envenenados · necesidades de orden.

## [DIST] Concurrencia
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Condiciones de carrera en cada registro compartido · bloqueo optimista (columna de versión) o pesimista (SELECT … FOR UPDATE) · restricciones de unicidad · anomalías de aislamiento descartadas (actualización perdida, write skew) · tiempos de espera de bloqueo y deadlocks.

## [DIST] Modos de Fallo
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Fallos parciales y tiempos de espera por dependencia · qué ocurre cuando cada dependencia está caída (degradar, encolar, fallar rápido) · particiones de red: el compromiso CAP / PACELC elegido · recuperación y reconciliación (reprocesamiento, compensación, un proceso de reconciliación).
`;
      }
      return "";
    },

    design(a) {
      const extra = ["tdd", ...MARKER_TRACK_ORDER].filter((t) => a.tracks.includes(t)).map((t) => BUILD.es.trackDesignBlock(t)).join("");
      return (
`# Diseño: ${a.name}

## Visión General
[Cómo se integra esto con el sistema existente. Decisiones clave y justificación.]

## Arquitectura
\`\`\`mermaid
graph TD
    A[Componente] -->|acción| B[Componente]
    B -->|query| C[(Base de Datos)]
\`\`\`

## Alternativas y Compensaciones
<!-- Las opciones sopesadas para cada decisión clave — p.ej. consistencia fuerte vs eventual, monolito vs servicio,
     síncrono vs asíncrono, bloqueo optimista vs pesimista. Al menos dos por decisión (una opción sola nunca se
     sopesó), lo que costaría elegir mal, la elegida y por qué. Una fila por opción. -->
| Decisión | Opción | Pros | Contras | Coste si falla | Elegida |
|---|---|---|---|---|---|
| [decisión clave] | [opción A] | [pros] | [contras] | [coste de equivocarse] | [✓ — por qué] |
| [decisión clave] | [opción B] | [pros] | [contras] | [coste de equivocarse] | [✗ — por qué no] |

## Modelos de Datos
\`\`\`typescript
interface Entity {
  id: string;
  // campos con comentarios que explican el propósito
}
\`\`\`

## Contratos de API
### POST /api/resource
- **Request:** \`{ field: type }\`
- **Response (200):** \`{ field: type }\`
- **Errors:** 400 (validación), 401 (auth), 404 (no encontrado)

## Consideraciones de Seguridad
[Auth, validación, riesgos de exposición de datos]

## Manejo de Errores
[Estrategia por modo de fallo a partir de los requisitos]

## Estrategia de Pruebas
- Unit / Integración / E2E: [qué cubre cada uno]

## Riesgos
<!-- Lo que podría hacer que este diseño sea erróneo o retrasar la entrega — técnico, entrega, datos, negocio. Una fila
     por riesgo; un honesto "ningún riesgo relevante, porque X" sirve — en blanco no. -->
| Riesgo | Probabilidad | Impacto | Mitigación | Responsable |
|---|---|---|---|---|
| [qué podría salir mal] | [baja / media / alta] | [bajo / medio / alto] | [cómo lo evitamos o detectamos] | [quién lo vigila] |

## Verificación de la Constitución
Verifica este diseño contra cada principio en \`steering/constitution.md\`. GATE: debe pasar antes
de la implementación; revisa de nuevo tras cualquier cambio de diseño.
- [ ] [Principio 1] — cumple
- [ ] [Principio 2] — cumple
(Si un principio no puede cumplirse, NO lo rompas en silencio — regístralo en Seguimiento de Complejidad abajo.)

## Seguimiento de Complejidad
Justifica todo lo que viole un principio de la constitución o añada complejidad no obvia. Vacío es bueno.
| Qué | Por qué es necesario | Alternativa más simple rechazada porque |
|---|---|---|
| [p.ej., segunda capa de caché] | [razón] | [por qué la opción simple falla] |
${extra}
<!-- Tracks activos: ${a.label}. Las secciones obligatorias de los tracks de arriba deben tener
     contenido real — un honesto "no hace falta porque X" sirve; en blanco no. -->
`
      );
    },

    tasks(a) {
      const green = a.tracks.includes("tdd") ? templateTests(a.tracks) : null;
      const evalMarker = a.tracks.includes("ai") ? "\n  - _Affects evals: golden (maintain baseline)_" : "";
      const metricMarker = a.tracks.includes("saas") ? "\n  - _Emits metrics: req_duration_ms{feature=" + a.slug + "}_" : "";
      let n = 0;
      const id = () => ++n;
      let phases =
`## Fase: Setup
- [ ] ${id()}. [shared][P] [setup de proyecto/dev si hace falta — deps, scaffolding]

## Fase: Fundacional (bloquea todas las historias)
- [ ] ${id()}. [shared] [Modelos, schemas, índices compartidos entre historias]
  - _Requirements: US-1.AC-1_${metricMarker}

## Historia US-1 (P1 — MVP)
- [ ] ${id()}. [US1] [Comportamiento central para US-1]
  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3_${greenLine(green, "US-1.AC-1", "US-1.AC-2", "US-1.AC-3")}${evalMarker}
  - _Verify: [comando que lo demuestra, p. ej.: npm test -- ruta/fichero.test.js]_
- [ ] ${id()}. [US1][P] [tarea paralelizable — archivo distinto, sin deps]
  - _Requirements: US-1.AC-4_${greenLine(green, "US-1.AC-4")}
**Checkpoint:** US-1 está totalmente funcional y es testeable/lanzable de forma independiente.
`;
      for (const t of MARKER_TRACK_ORDER) {
        if (!a.tracks.includes(t)) continue;
        const block = BUILD.es.trackTasks({ track: t, start: n + 1, green });
        phases += block;
        n += (block.match(/^- \[ \] \d+\./gm) || []).length;
      }
      phases +=
`
## Historia US-2 (P2)
- [ ] ${id()}. [US2] [Comportamiento para US-2]
  - _Requirements: US-2.AC-1_${greenLine(green, "US-2.AC-1")}
**Checkpoint:** US-2 funciona sin romper US-1.

## Fase: Pulido (transversal)
- [ ] ${id()}. [shared][P] [docs, limpieza, robustez de casos límite]
`;
      return (
`# Tareas: ${a.name}

<!-- Tracks: ${a.label}. Organizado por historia de usuario para que cada una sea lanzable de forma
     independiente (P1 primero). Cada tarea se marca con su historia: [US1]/[US2] o [shared] para
     trabajo transversal. [P] = paralelizable (archivos distintos, sin deps). Cada tarea lleva
     _Requirements:_; las tareas TDD llevan _Makes green:_. Usa _Implements: ruta_ para vincular una tarea
     a un archivo de código real. Un **Checkpoint** marca dónde una historia es testeable de forma independiente.
     Si las historias NO son lanzables de forma independiente, se trocearon mal — vuelve a trocearlas, o
     recurre a un layout por capa técnica (Fundación→Lógica→API→…) manteniendo las tags [US1]. -->

## Restricciones Globales
<!-- Valores exactos que toda tarea debe respetar, copiados tal cual de la spec/steering (versiones
     mínimas, reglas de nombres, límites, formatos) — spec_task_brief copia esta sección en cada brief.
     Da a cada tarea un _Verify: <comando>_: spec_complete_task registra el resultado como evidencia. -->
- [p. ej.: Node >= 20 · sin dependencias de runtime nuevas · campos de la API en snake_case]

${phases}`
      );
    },

    trackTasks(a) {
      let n = a.start - 1;
      const id = () => ++n;
      if (a.track === "saas") {
        return `
## Historia US-1 — Observabilidad y Escala
- [ ] ${id()}. [US1] Emitir métricas, añadir dashboard, configurar alertas
  - _Requirements: US-1.AC-6_
- [ ] ${id()}. [US1] Prueba de carga — verificar el presupuesto de rendimiento del design.md (solo ruta crítica)
  - _Requirements: US-1.AC-6_${greenLine(a.green, "US-1.AC-6")}
- [ ] ${id()}. [US1] Imponer el aislamiento de inquilino — toda query filtrada por tenant_id
  - _Requirements: US-1.AC-5_${greenLine(a.green, "US-1.AC-5")}
`;
      }
      if (a.track === "ai") {
        return `
## Historia US-1 — IA
- [ ] ${id()}. [US1] Prompt v1 + conexión al harness de evaluación (tarea separada por cambio de prompt)
  - _Requirements: US-1.AC-7, US-1.AC-8_
  - _Affects evals: golden, adversarial, regression_${greenLine(a.green, "US-1.AC-7", "US-1.AC-8")}
- [ ] ${id()}. [US1] Monitorización de coste — emitir métrica de coste + alerta
  - _Requirements: US-1.AC-9_${greenLine(a.green, "US-1.AC-9")}
`;
      }
      if (a.track === "sec") {
        return `
## Historia US-1 — Seguridad
- [ ] ${id()}. [US1] Modelar las amenazas de la función (STRIDE por frontera de confianza); registrar cada mitigación en el design.md
  - _Requirements: US-1.AC-10, US-1.AC-11, US-1.AC-12_
- [ ] ${id()}. [US1] Imponer autenticación y autorización a nivel de objeto en todos los endpoints (denegar por defecto)
  - _Requirements: US-1.AC-10, US-1.AC-11_${greenLine(a.green, "US-1.AC-10", "US-1.AC-11")}
- [ ] ${id()}. [US1] Mantener los secretos fuera del código, las respuestas y los logs — almacén de secretos + ocultación en los logs
  - _Requirements: US-1.AC-12_${greenLine(a.green, "US-1.AC-12")}
- [ ] ${id()}. [US1] Pruebas de seguridad — SAST, auditoría de dependencias y las pruebas de casos de abuso, ejecutables en local
  - _Requirements: US-1.AC-10, US-1.AC-11, US-1.AC-12_
`;
      }
      if (a.track === "privacy") {
        return `
## Historia US-1 — Privacidad
- [ ] ${id()}. [US1] Inventario de datos personales + base jurídica por finalidad en el design.md; actualizar la política de privacidad
  - _Requirements: US-1.AC-13, US-1.AC-14, US-1.AC-15_
- [ ] ${id()}. [US1] Solicitudes de los interesados — acceso/exportación y supresión de extremo a extremo, en todos los almacenes y encargados
  - _Requirements: US-1.AC-13, US-1.AC-14_${greenLine(a.green, "US-1.AC-13", "US-1.AC-14")}
- [ ] ${id()}. [US1] Conservación — supresión/anonimización programada de los registros con el plazo de conservación vencido
  - _Requirements: US-1.AC-15_${greenLine(a.green, "US-1.AC-15")}
`;
      }
      if (a.track === "dist") {
        return `
## Historia US-1 — Consistencia de Datos
- [ ] ${id()}. [US1] Outbox transaccional — escribir la fila del outbox en la misma transacción que el cambio de estado; un relay (polling o CDC) la publica y la marca como enviada
  - _Requirements: US-1.AC-16_${greenLine(a.green, "US-1.AC-16")}
- [ ] ${id()}. [US1] Consumidor idempotente — una tabla inbox / de mensajes procesados con la clave en el ID del mensaje, escrita en la misma transacción que el efecto
  - _Requirements: US-1.AC-17_${greenLine(a.green, "US-1.AC-17")}
- [ ] ${id()}. [US1] Control de concurrencia — una columna de versión (bloqueo optimista) o una restricción de unicidad; un conflicto es un error, nunca una sobrescritura silenciosa
  - _Requirements: US-1.AC-18_${greenLine(a.green, "US-1.AC-18")}
- [ ] ${id()}. [US1] Resiliencia — tiempos de espera, reintentos con retroceso exponencial + jitter (nunca una llamada no idempotente sin clave), una DLQ, la ruta degradada cuando una dependencia está caída
  - _Requirements: US-1.AC-19_${greenLine(a.green, "US-1.AC-19")}
- [ ] ${id()}. [US1] Pruebas de inyección de fallos — caída entre el commit y la publicación, entrega duplicada, actualizaciones concurrentes, una dependencia caída — ejecutables localmente
  - _Requirements: US-1.AC-16, US-1.AC-17, US-1.AC-18, US-1.AC-19_
`;
      }
      return "";
    },

    bugReport(a) {
      return `# Bug: ${a.name}

<!-- Flujo de bugfix (depuración sistemática): reproducir → encontrar la CAUSA RAÍZ con evidencia → escribir
     la prueba de regresión que falla → corregir la causa, no el síntoma → verificar. spec_doctor falla
     mientras la "Causa Raíz" no esté rellenada: ninguna corrección antes de conocer la causa. -->

## Resumen
${a.summary || "[una línea: qué está roto, para quién, desde cuándo]"}

## Reproducción
> **TODO** — pasos, entrada y entorno exactos que lo reproducen siempre.

## Esperado vs Actual
- **Esperado:** [comportamiento correcto]
- **Actual:** [lo que ocurre — mensaje de error, salida, líneas de log]

## Causa Raíz
> **TODO** — la causa, con evidencia (stack trace, log, aserción que falla, el cambio que la introdujo). No "probablemente".

## Corrección
[Qué cambia y por qué elimina la causa raíz — una corrección, no un paquete.]

## Prueba de Regresión
- **T-01** — reproduce el bug: falla antes de la corrección y pasa después.
`;
    },

    bugRequirements(a) {
      return `# Bugfix: ${a.name}

## Resumen
${a.summary || "[una línea: el bug a corregir]"}

## Historias de Usuario

### US-1 (P1 — corrección): ${a.name}
**Prueba Independiente:** la prueba de regresión T-01 reproduce el bug antes de la corrección y pasa después.

#### Criterios de Aceptación (EARS)
1. **US-1.AC-1** — SI [la condición que provoca el bug] ENTONCES EL SISTEMA DEBE [el comportamiento correcto]
2. **US-1.AC-2** — EL SISTEMA DEBE mantener [el comportamiento vecino que ya funcionaba] sin cambios

## Criterios de Éxito
- **SC-001** — los pasos de reproducción de bug.md dejan de reproducir el bug.

## Casos Límite y Manejo de Errores
- **EC-1** — [entradas cercanas que deben seguir funcionando]

## Fuera de Alcance
- Refactorizaciones no relacionadas — regístralas como trabajo aparte.
`;
    },

    bugTestPlan(name) {
      return `# Test Plan: ${name}

<!-- Tipo: example (una entrada concreta → resultado esperado) o property (una invariante sobre entradas generadas — p. ej.
     "toda entrada fuera de la condición del bug se comporta como antes" protege bien US-1.AC-2). Los valores quedan example / property.
     Pon el Test ID en el nombre de la prueba (test("T-01 …"), def test_T01_…) para que trace_check {code: true} lo encuentre. -->

| Test ID | Capa | Tipo | Descripción | Cubre (AC IDs) | Fichero |
|---------|------|------|-------------|----------------|---------|
| T-01 | [unit/integración] | example | regresión — reproduce el bug (rojo antes de la corrección) | US-1.AC-1, SC-001 | \`[ruta]\` |
| T-02 | [unit/integración] | example | el comportamiento vecino sigue funcionando | US-1.AC-2 | \`[ruta]\` |
`;
    },

    bugTasks(name) {
      return `# Tareas: ${name}

<!-- El orden de un bugfix es fijo: reproducir → causa raíz → prueba de regresión que falla → corregir → verificar.
     Ninguna corrección antes de que bug.md → Causa Raíz esté rellenada con evidencia.
     La tarea 3 es roja por diseño (su prueba debe FALLAR): su _Verify:_ ejecuta T-01 y _Expect: fail_ hace de esa
     ejecución que falla la prueba (una que pase se rechaza). La suite que debe pasar va en la tarea del arreglo (4).
     T-02 protege un comportamiento que ya funciona — en verde antes y después del arreglo, así que no entra en el
     _Makes green:_ de ninguna tarea. -->

## Restricciones Globales
- [valores exactos que la corrección debe respetar — versiones, límites, formatos]

## Fase: Corrección
- [ ] 1. [shared] Reproducir el bug de forma fiable y escribir los pasos en bug.md → Reproducción
  - _Requirements: US-1.AC-1_
- [ ] 2. [shared] Encontrar la causa raíz con evidencia; rellenar bug.md → Causa Raíz (aún sin corregir)
  - _Requirements: US-1.AC-1_
- [ ] 3. [US1] Escribir la prueba de regresión T-01 y verla fallar por la razón correcta (pegar la salida); añadir la prueba de protección T-02 (ya pasa)
  - _Requirements: US-1.AC-1_
  - _Verify: [comando que ejecuta T-01]_
  - _Expect: fail_
- [ ] 4. [US1] Corregir la causa raíz — un cambio, no un paquete; la prueba de protección T-02 sigue en verde
  - _Requirements: US-1.AC-1, US-1.AC-2_
  - _Makes green: T-01_
  - _Verify: [comando de la suite de pruebas completa]_
**Checkpoint:** el bug deja de reproducirse y la suite completa está en verde.
`;
    },

    testPlan(name, tracks, acs) {
      const rows = templateTestRows(tracks, (t, layer, kind, desc, ac, file) => `| ${t} | ${layer} | ${kind} | ${desc} | ${ac} | \`${file}\` |`,
        { integration: "integración", load: "carga", behavior: "[comportamiento]", acSlot: "[los IDs de AC que cubre esta prueba]", recovery: "[condición de error → recuperación]", property: "[propiedad siempre verdadera]",
          tenant: "el inquilino A nunca lee registros del inquilino B", latency: "latencia P95 dentro del presupuesto de rendimiento",
          golden: "conjunto golden ≥ umbral de calidad", injection: "adversarial: las instrucciones inyectadas se ignoran", cost: "coste por solicitud dentro del presupuesto",
          unauthenticated: "caso de abuso: una solicitud no autenticada recibe 401 y ningún dato", forbidden: "caso de abuso: el usuario B nunca lee el recurso del usuario A (403 + evento de auditoría)",
          noSecrets: "ningún secreto, token ni stack trace en respuestas o logs", exportData: "la exportación de un interesado contiene todos sus datos personales, en formato de lectura mecánica",
          erasure: "tras la supresión ningún almacén conserva los datos personales del interesado", retention: "los registros con el plazo de conservación vencido se eliminan o anonimizan",
          outboxCrash: "caída entre el commit en la BD y la publicación: el evento se entrega igualmente", duplicateDelivery: "el mismo mensaje entregado dos (o N) veces tiene exactamente un efecto",
          lostUpdate: "actualizaciones concurrentes del mismo registro: ninguna se pierde en silencio", dependencyDown: "una dependencia caída: degradar / reintentar con retroceso, la ruta crítica no se bloquea" }, acs);
      return (
`# Test Plan: ${name}

## Estrategia
- **Test runner:** []
- **Enfoque de mocking:** []
- **Objetivo de cobertura:** []
- **Rutas críticas que exigen 100% de cobertura de ramas:** []

## Matriz de Trazabilidad

<!-- Tipo — example: una entrada concreta → resultado esperado; lo habitual para criterios por evento (CUANDO …, SI … ENTONCES).
     property: una invariante comprobada sobre muchas entradas generadas (fast-check, Hypothesis, jqwik, gopter, FsCheck); úsalo
     en criterios ubicuos (EL SISTEMA DEBE siempre …), criterios MIENTRAS (por estado) y cualquier regla "nunca / para todo" —
     aislamiento entre inquilinos, un round-trip codificar → decodificar, totales que siempre cuadran. Los valores quedan example / property.
     Pon el Test ID en el nombre de la prueba (test("T-01 …"), def test_T01_…) para que trace_check {code: true} lo encuentre. -->

| Test ID | Capa | Tipo | Descripción | Cubre (AC IDs) | Archivo |
|---------|------|------|-------------|----------------|---------|
${rows}

## Verificación de Cobertura
Cada AC debe aparecer en al menos una celda "Cubre". Lagunas (con justificación):
- [ninguna]

## Datos de Prueba y Fixtures
- []

## Fuera de Alcance para Pruebas
- []
`
      );
    },

    evalPlan(name) {
      return (
`# Eval Plan: ${name}

## Conjunto Golden (50–200 ítems)
Entradas representativas con salidas/rúbrica de calidad esperada. Cubre queries típicas, personas, longitudes.

## Conjunto Adversarial
Inyecciones de prompt, jailbreaks, solicitudes fuera de alcance (debe rechazar), elicitación de output inseguro, entradas degeneradas.

## Conjunto de Regresión
Cada fallo de producción corregido se convierte en un caso de evaluación permanente. Crece, nunca encoge.

## Calificación
- Método por conjunto: coincidencia exacta / validación de schema / LLM-como-juez (con rúbrica) / revisión humana.
- Los prompts de calificación están versionados y probados.

## Umbrales de Calidad (criterios para lanzar)
- Golden: ≥ [85]% bueno-o-excelente
- Seguridad adversarial: 100% rechazado (tolerancia cero)
- Inyección adversarial: ≥ [98]% ignorado
- Regresión: 100% mantenido

## Baseline
Ejecuta el golden con un prompt v1 mínimo + modelo planeado; registra aquí la puntuación baseline antes de implementar.
- Baseline (fecha/puntuación): [ ]
`
      );
    },

    loadTest(name) {
      return (
`# Load Test: ${name}

## Escenarios
- Estado estable · Burst · Soak · Spike

## Presupuesto (del design.md Presupuesto de Rendimiento)
- Objetivos P50/P95/P99 · objetivo de throughput · techo de tasa de error.

## Herramientas
- Ubicación del script k6 / Artillery: []

## Criterios de Aprobación
P50/P95/P99 medidos ≤ presupuesto al throughput objetivo, tasa de error < [0.1]%.
`
      );
    },

    quickstart(name) {
      return (
`# Quickstart: ${name}

Un escenario de aceptación ejecutable por una persona — el smoke test manual que prueba que la función
funciona de extremo a extremo. Mantenlo concreto; cualquiera debería poder seguirlo.

## Precondiciones
- [entorno / datos / cuentas necesarias]

## Pasos (camino feliz — US-1 / P1)
1. [haz esto]
2. [luego esto]
3. **Esperado:** [resultado observable vinculado a un Criterio de Éxito, p.ej. SC-001]

## Camino negativo
1. [dispara una condición de error de un AC SI…ENTONCES]
2. **Esperado:** [manejo elegante]

## Hecho cuando
- [ ] El camino feliz produce el resultado esperado.
- [ ] El camino negativo se maneja con elegancia.
- [ ] Los Criterios de Éxito (SC-…) se cumplen de forma observable.
`
      );
    },

    checklist(a) {
      const items = [
        "Requisitos: cada AC es testeable, tiene ID estable, sin términos vagos (ejecuta `ears`).",
        "Diseño: respeta la constitución del proyecto (ningún principio violado).",
        "Diseño: al menos un diagrama Mermaid; seguridad + manejo de errores cubiertos.",
        "Trazabilidad: cada AC mapea a una tarea (ejecuta `trace`).",
      ];
      if (a.tracks.includes("tdd")) items.push("TDD: todas las pruebas planeadas escritas y en rojo por la razón correcta antes del código.", "TDD: los commits de prueba entran antes que los de implementación.");
      if (a.tracks.includes("saas")) items.push("SaaS: 5 secciones obligatorias de diseño rellenadas (sin TODO).", "SaaS: aislamiento de inquilino impuesto (`WHERE tenant_id = ?`).", "SaaS: métricas/logs/alertas emitidos; prueba de carga cumple el presupuesto (ruta crítica).");
      if (a.tracks.includes("ai")) items.push("IA: 10 secciones obligatorias de diseño rellenadas (sin TODO).", "IA: golden ≥ umbral, seguridad adversarial 100%, regresión mantenida.", "IA: prompts versionados en prompts/vN.md; coste dentro del presupuesto.");
      if (a.tracks.includes("sec")) items.push("SEC: 5 secciones obligatorias de diseño rellenadas (sin TODO) — modelo de amenazas revisado.", "SEC: autenticación + autorización a nivel de objeto impuestas, denegar por defecto; ningún secreto en el código ni en los logs.", "SEC: SAST, auditoría de dependencias y pruebas de casos de abuso limpias en una ejecución local.");
      if (a.tracks.includes("privacy")) items.push("PRIVACIDAD: 6 secciones obligatorias de diseño rellenadas (sin TODO) — decisión sobre la EIPD registrada.", "PRIVACIDAD: acceso/exportación y supresión funcionan de extremo a extremo, en todos los almacenes y encargados.", "PRIVACIDAD: proceso de conservación programado; política de privacidad y registro de actividades de tratamiento actualizados.");
      if (a.tracks.includes("dist")) items.push("DIST: 5 secciones obligatorias de diseño rellenadas (sin TODO) — cada escritura entre sistemas tiene su mitigación (outbox / inbox / saga) o un riesgo aceptado.", "DIST: consumidores idempotentes (inbox o una clave única en la transacción del efecto); reintentos con retroceso + jitter y una DLQ; nada no idempotente reintentado a ciegas.", "DIST: pruebas de inyección de fallos (caída entre el commit y la publicación, entrega duplicada, actualizaciones concurrentes, dependencia caída) en verde en una ejecución local.");
      items.push("Doctor: `doctor` reporta readyToAdvance antes de cada gate.", "Todos los gates de fase aprobados (`approve`).");
      return "# Checklist: " + a.name + "\n\nTracks: " + a.label + ". Marca antes de dar la función por terminada.\n\n" +
        items.map((i) => "- [ ] " + i).join("\n") + "\n";
    },

    integrationPlan(name) {
      return (
`# Integration Plan: ${name}

## Puntos de Integración
- [Componentes/módulos existentes que esta función toca]

## Modificaciones Necesarias
- [Qué debe cambiar en el código existente, y por qué]

## Secuenciación
- Fase 1: [p.ej., migraciones de BD]
- Fase 2: [p.ej., servicio de backend]
- Fase 3: [p.ej., conectar la UI]

## Riesgos y Mitigaciones
- [Riesgo]: [mitigación / rollback]

## Archivos Afectados (mejor estimación)
- [ruta → cambio]
`
      );
    },

    promptStub(name) {
      return "# Prompt v1 — " + name + "\n\n## System\nEres un asistente útil para " + name + ". Sé preciso y conciso. Si no sabes, dilo. Rechaza solicitudes fuera de tu tarea.\n\n## User Template\n[mensaje del usuario / {{variables}}]\n";
    },
  },
};

// ===========================================================================
// Steering stubs, one set per language. Filenames stay constant; content localized.
// ===========================================================================

const STEERING = {
  en: {
    "constitution.md":
      "# Constitution\n\nNon-negotiable principles every feature must obey. Keep these few, concrete, and testable.\nThe `doctor` and `/prReview` check work against them; a design that violates a principle is blocked.\n\n## Principles\n1. [e.g., Every write is idempotent or explicitly justified.]\n2. [e.g., No PII in logs; user IDs are pseudonymized.]\n3. [e.g., No breaking API change without a versioned migration path.]\n4. [e.g., Errors fail closed (deny) on the security path.]\n\n## Constraints\n- [Hard tech/regulatory constraints that bound all designs.]\n\n## Decision Rules\n- [How to break ties — e.g., 'prefer boring/proven over clever'.]\n",
    "product.md":
      "# Product\n\n## Vision\n[One sentence: what is this product and who is it for?]\n\n## Target Users\n- Primary: [who uses this daily?]\n- Secondary: [who else touches it?]\n\n## Success Metrics\n- [specific 6-month metric]\n\n## Non-goals\n- [what this is explicitly NOT]\n\n## Business Model\n[how it makes money]\n",
    "tech.md":
      "# Tech\n\n## Stack\n- Frontend: []\n- Backend: []\n- Database: []\n- Auth: []\n\n## Infrastructure\n- Hosting / Region / CDN: []\n\n## Conventions\n- Language / formatting / test runner / migrations / commit format: []\n\n## Constraints\n- Runtime version / browser support / accessibility / regulatory: []\n",
    "structure.md":
      "# Project Structure\n\n## Layout\n[directory tree]\n\n## Naming\n- Files / components / API routes / DB tables / metrics: []\n\n## Commits\nConventional commits: `type(scope): description`. Types: feat|fix|refactor|test|docs|chore|style|perf\n\n## Branches & Reviews\n- main + feature/<name>; reviews required for merges to main.\n",
    "testing-standards.md":
      "# Testing Standards\n\n## Runner & Tooling\n- Unit/Integration: []\n- E2E: []\n- Mocking: []\n\n## Coverage Policy\n- Default target: []\n- Critical paths (auth/billing/data): 100% branch.\n\n## TDD Discipline\n- No implementation before a failing test exercising the real path.\n- 'Failing for the right reason' = assertion/NotImplemented, not import/syntax error.\n",
    "scale.md":
      "# Scale Targets\n\n## Load Targets\n| Horizon | Concurrent | DAU | MAU | Peak RPS | Data |\n|---|---|---|---|---|---|\n| Launch | | | | | |\n| 6 months | | | | | |\n| 2 years | | | | | |\n\n## SLA Targets\n| Endpoint class | P95 | P99 | Uptime |\n|---|---|---|---|\n| Critical journey | | | |\n\n## Critical User Journeys\n1. []\n\n## Escalation Thresholds\n- []\n",
    "observability.md":
      "# Observability Standards\n\n## Logging\nStructured JSON. Required fields: ts, level, service, trace_id, span_id, tenant_id?, user_id?, msg, event. No secrets/PII.\n\n## Metrics\nPrometheus-style snake_case + unit suffix. Per feature: request count, duration histogram, error count, one business counter. Beware label cardinality.\n\n## Traces\nOpenTelemetry, W3C context. Sample 10% in prod, always sample errors.\n\n## Alerts (each links a runbook)\n- P0 page now / P1 ≤15min / P2 slack / P3 digest.\n",
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
      "# Distributed Systems & Data Consistency Standards\n\n## Delivery Guarantee\n- Default: at-least-once — every consumer is idempotent. Exactly-once is an effect of idempotency, never a broker promise.\n- Ordering: per key (partition / message group) only where a feature says so: []\n\n## Cross-system Writes\n- A write that touches more than one system (DB + broker, DB + cache, DB + external API) goes through a transactional outbox (or CDC) — never \"commit, then publish\".\n- Business transactions across services: a saga with one compensation per step; orchestration or choreography: []\n\n## Idempotency\n- Idempotency key source (client header / message ID / natural key): [] · where processed keys live (inbox table / unique constraint) and for how long: []\n\n## Retry Policy (defaults)\n- Exponential backoff with jitter · max attempts: [] · per-call timeout: []\n- Never retried: a non-idempotent call without a key, a validation error (4xx) · poison messages → DLQ after [] attempts, with an alert.\n\n## Locking Policy\n- Default: optimistic locking (a version column); pessimistic (SELECT … FOR UPDATE) only for short, hot sections · lock timeout: []\n\n## Consistency Defaults\n- Default isolation level: [] · where eventual consistency is accepted and the maximum staleness: [] · read-your-writes for the user who wrote.\n\n## Observability\n- Outbox lag, consumer lag, DLQ depth and retry counts are metrics with alerts: []\n",
    // 1.16 Q3 — the glossary (steering_scaffold glossary.md; init never creates it). `_Avoid:_` is English-stable in every language.
    "glossary.md":
      "# Glossary\n\n<!-- The product's ubiquitous language: one entry per domain term — the word the specs use, what it means here, and the\n     words NOT to use for it. spec_clarify asks about every avoided word found in a feature's requirements.md / design.md,\n     spec_doctor warns (check `glossary`) and spec_task_brief quotes the entries a task's criteria use.\n     One entry per line (keep the `_Avoid:_` marker in English), e.g.:\n     - **Customer** — a person or company with a signed contract. _Avoid: client, user_ -->\n\n- **[Term]** — [what it means in this product]. _Avoid: [word], [word]_\n",
  },
  pt: {
    "constitution.md":
      "# Constituição\n\nPrincípios inegociáveis que toda a feature deve cumprir. Mantém-nos poucos, concretos e testáveis.\nO `doctor` e o `/prReview` verificam contra eles; um design que viole um princípio é bloqueado.\n\n## Princípios\n1. [ex.: Toda a escrita é idempotente ou explicitamente justificada.]\n2. [ex.: Sem PII nos logs; os IDs de utilizador são pseudonimizados.]\n3. [ex.: Sem alteração de API com quebra sem um caminho de migração versionado.]\n4. [ex.: Os erros falham fechados (negar) no caminho de segurança.]\n\n## Restrições\n- [Restrições técnicas/regulatórias rígidas que limitam todos os designs.]\n\n## Regras de Decisão\n- [Como desempatar — ex.: 'preferir o aborrecido/comprovado ao engenhoso'.]\n",
    "product.md":
      "# Produto\n\n## Visão\n[Uma frase: o que é este produto e para quem é?]\n\n## Utilizadores-Alvo\n- Primário: [quem usa isto diariamente?]\n- Secundário: [quem mais lhe toca?]\n\n## Métricas de Sucesso\n- [métrica específica a 6 meses]\n\n## Não-objetivos\n- [o que isto explicitamente NÃO é]\n\n## Modelo de Negócio\n[como gera receita]\n",
    "tech.md":
      "# Tecnologia\n\n## Stack\n- Frontend: []\n- Backend: []\n- Base de Dados: []\n- Auth: []\n\n## Infraestrutura\n- Hosting / Região / CDN: []\n\n## Convenções\n- Linguagem / formatação / test runner / migrações / formato de commit: []\n\n## Restrições\n- Versão de runtime / suporte de browser / acessibilidade / regulatório: []\n",
    "structure.md":
      "# Estrutura do Projeto\n\n## Layout\n[árvore de diretórios]\n\n## Nomenclatura\n- Ficheiros / componentes / rotas de API / tabelas de BD / métricas: []\n\n## Commits\nConventional commits: `type(scope): description`. Tipos: feat|fix|refactor|test|docs|chore|style|perf\n\n## Branches e Revisões\n- main + feature/<nome>; revisões obrigatórias para merges para main.\n",
    "testing-standards.md":
      "# Padrões de Teste\n\n## Runner e Ferramentas\n- Unit/Integração: []\n- E2E: []\n- Mocking: []\n\n## Política de Cobertura\n- Alvo por defeito: []\n- Caminhos críticos (auth/faturação/dados): 100% de ramos.\n\n## Disciplina TDD\n- Sem implementação antes de um teste a falhar que exercite o caminho real.\n- 'Falhar pela razão certa' = assertion/NotImplemented, não erro de import/sintaxe.\n",
    "scale.md":
      "# Alvos de Escala\n\n## Alvos de Carga\n| Horizonte | Simultâneos | DAU | MAU | Pico RPS | Dados |\n|---|---|---|---|---|---|\n| Lançamento | | | | | |\n| 6 meses | | | | | |\n| 2 anos | | | | | |\n\n## Alvos de SLA\n| Classe de endpoint | P95 | P99 | Disponibilidade |\n|---|---|---|---|\n| Jornada crítica | | | |\n\n## Jornadas Críticas de Utilizador\n1. []\n\n## Limiares de Escalonamento\n- []\n",
    "observability.md":
      "# Padrões de Observabilidade\n\n## Logging\nJSON estruturado. Campos obrigatórios: ts, level, service, trace_id, span_id, tenant_id?, user_id?, msg, event. Sem secrets/PII.\n\n## Métricas\nEstilo Prometheus snake_case + sufixo de unidade. Por feature: contagem de pedidos, histograma de duração, contagem de erros, um contador de negócio. Cuidado com a cardinalidade de labels.\n\n## Traces\nOpenTelemetry, contexto W3C. Amostra 10% em prod, amostra sempre os erros.\n\n## Alertas (cada um liga a um runbook)\n- P0 alerta imediato (page) / P1 ≤15min / P2 slack / P3 digest.\n",
    "cost.md":
      "# Orçamento de Custo\n\n## Orçamento de Infraestrutura\nAlvo: < $XX/mês no ano 1.\n\n## Alvo de Custo Por Utilizador\nAlvo: < $0,50 por MAU. Se for excedido, para e otimiza.\n\n## Alertas de Custo\n- Diário > $100 slack / > $200 alerta imediato (page).\n\n## Revisão de Custo Por Feature\nCada Envelope de Custo no design.md estima $/1000 utilizadores/mês e sinaliza caminhos críticos de custo.\n",
    "ai-strategy.md":
      "# Estratégia de IA\n\n## Lista de Modelos\n| Papel | Modelo (ID fixado) | Porquê |\n|---|---|---|\n| Primário | | |\n| Fallback | | |\n| Juiz/classificador | | |\n\n## Postura de Fornecedor e Dados\n- Fornecedor / estado do DPA / a PII chega ao modelo: []\n\n## Disciplina de Prompt\n- Prompts em .specs/<feature>/prompts/vN.md, versionados. Nenhuma mudança é lançada sem voltar a correr os evals.\n\n## Envelope de Custo\n- Alvo $/ação de utilizador / limite de alerta rígido: []\n\n## Postura de Segurança\n- Defesa contra injeção / moderação / política de recusa: []\n\n## Barra de Avaliação (critérios para lançar)\n- Golden ≥85% bom · Segurança adversarial 100% recusado · Regressão 100% mantida.\n\n## Ciclo de Vida\n- Política de fixação / vigilância de descontinuação / migração com gate de avaliação.\n",
    "security.md":
      "# Padrões de Segurança\n\n## Nível de Garantia\n- Nível OWASP ASVS alvo: [L1 | L2 | L3] — porquê: []\n\n## Modelação de Ameaças\n- Método: STRIDE por componente e fronteira de confiança, revisto a cada alteração de design.\n- Onde ficam os modelos de ameaças: no design.md de cada feature +sec → Modelo de Ameaças.\n\n## Autenticação e Autorização\n- Fornecedor de identidade / modelo de sessão: []\n- Modelo de autorização (RBAC / ABAC / verificação de titularidade), negar por omissão: []\n\n## Segredos e Criptografia\n- Cofre de segredos: [] — nunca no código, em configuração versionada, em logs ou em tickets.\n- Cifragem em repouso / em trânsito (versão de TLS, rotação de chaves): []\n\n## Regras de Código Seguro\n- Validar a entrada nas fronteiras de confiança; codificar a saída; só queries parametrizadas.\n- Nenhum segredo, token ou stack trace em respostas ou logs.\n\n## Testes de Segurança (locais)\n- SAST: [] · auditoria de dependências: [] · análise de segredos: [] · DAST (serviços expostos): []\n- Cada ameaça relevante tem um teste de caso de abuso.\n\n## Gestão de Vulnerabilidades\n- Prazos de correção por severidade (crítica / alta / média): [] · quem faz a triagem: []\n",
    "privacy.md":
      "# Padrões de Privacidade (RGPD)\n\n## Papéis\n- Responsável pelo tratamento: [] · EPD / contacto de privacidade: [] · autoridade de controlo: [ex.: CNPD]\n\n## Princípios (RGPD, art. 5.º)\n- Licitude, lealdade e transparência · limitação das finalidades · minimização dos dados · exatidão · limitação da conservação · integridade e confidencialidade · responsabilidade.\n\n## Registo das Atividades de Tratamento (art. 30.º)\n- Onde está o registo das atividades de tratamento: []\n\n## Fundamentos de Licitude em Uso (art. 6.º)\n- [atividade de tratamento → fundamento de licitude]\n\n## Prazos de Conservação\n| Categoria de dados | Prazo de conservação | Método de eliminação |\n|---|---|---|\n| | | |\n\n## Pedidos dos Titulares\n- Canal · verificação de identidade · prazo de um mês (art. 12.º, n.º 3) · responsável: []\n\n## Subcontratantes e Transferências\n- Subcontratantes aprovados (contratos do art. 28.º): [] · transferências para fora do EEE e a sua garantia: []\n\n## Proteção de Dados desde a Conceção (art. 25.º)\n- Por omissão: recolher o mínimo, pseudonimizar sempre que possível, sem dados pessoais nos logs.\n\n## Resposta a Violações de Dados\n- Notificar a autoridade de controlo no prazo de 72 horas (art. 33.º) · runbook: []\n",
    "distributed.md":
      "# Padrões de Sistemas Distribuídos e Consistência de Dados\n\n## Garantia de Entrega\n- Por omissão: pelo menos uma vez — todos os consumidores são idempotentes. \"Exatamente uma vez\" é um efeito da idempotência, nunca uma promessa do broker.\n- Ordem: por chave (partição / grupo de mensagens) só onde uma feature o pede: []\n\n## Escritas entre Sistemas\n- Uma escrita que toca mais de um sistema (BD + broker, BD + cache, BD + API externa) passa por um outbox transacional (ou CDC) — nunca \"commit e depois publicar\".\n- Transações de negócio entre serviços: uma saga com uma compensação por passo; orquestração ou coreografia: []\n\n## Idempotência\n- Origem da chave de idempotência (cabeçalho do cliente / ID da mensagem / chave natural): [] · onde ficam as chaves processadas (tabela inbox / restrição de unicidade) e durante quanto tempo: []\n\n## Política de Novas Tentativas (valores por omissão)\n- Recuo exponencial com jitter · máximo de tentativas: [] · tempo limite por chamada: []\n- Nunca repetir: uma chamada não idempotente sem chave, um erro de validação (4xx) · mensagens venenosas → DLQ após [] tentativas, com alerta.\n\n## Política de Bloqueio\n- Por omissão: bloqueio otimista (uma coluna de versão); pessimista (SELECT … FOR UPDATE) só em secções curtas e muito disputadas · tempo limite de bloqueio: []\n\n## Consistência por Omissão\n- Nível de isolamento por omissão: [] · onde se aceita a consistência eventual e o atraso máximo: [] · ler as próprias escritas para o utilizador que escreveu.\n\n## Observabilidade\n- Atraso do outbox, atraso dos consumidores, profundidade da DLQ e número de novas tentativas são métricas com alertas: []\n",
    "glossary.md":
      "# Glossário\n\n<!-- A linguagem ubíqua do produto:uma entrada por termo do domínio — a palavra que as specs usam, o que significa aqui e\n     as palavras que NÃO se usam para ele. O spec_clarify pergunta por cada palavra a evitar encontrada no requirements.md /\n     design.md de uma feature, o spec_doctor avisa (verificação `glossary`) e o spec_task_brief cita as entradas que os\n     critérios de uma task usam. Uma entrada por linha (o marcador `_Avoid:_` fica em inglês), por exemplo:\n     - **Cliente** — uma pessoa ou empresa com contrato assinado. _Avoid: comprador, consumidor_ -->\n\n- **[Termo]** — [o que significa neste produto]. _Avoid: [palavra], [palavra]_\n",
  },
  es: {
    "constitution.md":
      "# Constitución\n\nPrincipios innegociables que toda función debe cumplir. Mantenlos pocos, concretos y testeables.\nEl `doctor` y el `/prReview` verifican contra ellos; un diseño que viole un principio se bloquea.\n\n## Principios\n1. [p.ej., Toda escritura es idempotente o explícitamente justificada.]\n2. [p.ej., Sin PII en los logs; los IDs de usuario se pseudonimizan.]\n3. [p.ej., Sin cambio de API con ruptura sin una ruta de migración versionada.]\n4. [p.ej., Los errores fallan cerrados (denegar) en la ruta de seguridad.]\n\n## Restricciones\n- [Restricciones técnicas/regulatorias rígidas que limitan todos los diseños.]\n\n## Reglas de Decisión\n- [Cómo desempatar — p.ej., 'preferir lo aburrido/probado a lo ingenioso'.]\n",
    "product.md":
      "# Producto\n\n## Visión\n[Una frase: ¿qué es este producto y para quién es?]\n\n## Usuarios Objetivo\n- Primario: [¿quién usa esto a diario?]\n- Secundario: [¿quién más lo toca?]\n\n## Métricas de Éxito\n- [métrica específica a 6 meses]\n\n## No-objetivos\n- [lo que esto explícitamente NO es]\n\n## Modelo de Negocio\n[cómo genera ingresos]\n",
    "tech.md":
      "# Tecnología\n\n## Stack\n- Frontend: []\n- Backend: []\n- Base de Datos: []\n- Auth: []\n\n## Infraestructura\n- Hosting / Región / CDN: []\n\n## Convenciones\n- Lenguaje / formateo / test runner / migraciones / formato de commit: []\n\n## Restricciones\n- Versión de runtime / soporte de navegador / accesibilidad / regulatorio: []\n",
    "structure.md":
      "# Estructura del Proyecto\n\n## Layout\n[árbol de directorios]\n\n## Nomenclatura\n- Archivos / componentes / rutas de API / tablas de BD / métricas: []\n\n## Commits\nConventional commits: `type(scope): description`. Tipos: feat|fix|refactor|test|docs|chore|style|perf\n\n## Ramas y Revisiones\n- main + feature/<nombre>; revisiones obligatorias para merges a main.\n",
    "testing-standards.md":
      "# Estándares de Pruebas\n\n## Runner y Herramientas\n- Unit/Integración: []\n- E2E: []\n- Mocking: []\n\n## Política de Cobertura\n- Objetivo por defecto: []\n- Rutas críticas (auth/facturación/datos): 100% de ramas.\n\n## Disciplina TDD\n- Sin implementación antes de una prueba que falle ejercitando la ruta real.\n- 'Fallar por la razón correcta' = assertion/NotImplemented, no error de import/sintaxis.\n",
    "scale.md":
      "# Objetivos de Escala\n\n## Objetivos de Carga\n| Horizonte | Concurrentes | DAU | MAU | Pico RPS | Datos |\n|---|---|---|---|---|---|\n| Lanzamiento | | | | | |\n| 6 meses | | | | | |\n| 2 años | | | | | |\n\n## Objetivos de SLA\n| Clase de endpoint | P95 | P99 | Disponibilidad |\n|---|---|---|---|\n| Recorrido crítico | | | |\n\n## Recorridos Críticos de Usuario\n1. []\n\n## Umbrales de Escalado\n- []\n",
    "observability.md":
      "# Estándares de Observabilidad\n\n## Logging\nJSON estructurado. Campos obligatorios: ts, level, service, trace_id, span_id, tenant_id?, user_id?, msg, event. Sin secrets/PII.\n\n## Métricas\nEstilo Prometheus snake_case + sufijo de unidad. Por función: conteo de solicitudes, histograma de duración, conteo de errores, un contador de negocio. Cuidado con la cardinalidad de labels.\n\n## Traces\nOpenTelemetry, contexto W3C. Muestrea 10% en prod, muestrea siempre los errores.\n\n## Alertas (cada una liga a un runbook)\n- P0 alerta inmediata (page) / P1 ≤15min / P2 slack / P3 digest.\n",
    "cost.md":
      "# Presupuesto de Coste\n\n## Presupuesto de Infraestructura\nObjetivo: < $XX/mes en el año 1.\n\n## Objetivo de Coste Por Usuario\nObjetivo: < $0,50 por MAU. Si se excede, para y optimiza.\n\n## Alertas de Coste\n- Diario > $100 slack / > $200 alerta inmediata (page).\n\n## Revisión de Coste Por Función\nCada Presupuesto de Coste en el design.md estima $/1000 usuarios/mes y señala rutas críticas de coste.\n",
    "ai-strategy.md":
      "# Estrategia de IA\n\n## Lista de Modelos\n| Rol | Modelo (ID fijado) | Por qué |\n|---|---|---|\n| Primario | | |\n| Fallback | | |\n| Juez/calificador | | |\n\n## Postura de Proveedor y Datos\n- Proveedor / estado del DPA / la PII llega al modelo: []\n\n## Disciplina de Prompt\n- Prompts en .specs/<feature>/prompts/vN.md, versionados. Ningún cambio se lanza sin volver a ejecutar los evals.\n\n## Presupuesto de Coste\n- Objetivo $/acción de usuario / umbral de alerta rígido: []\n\n## Postura de Seguridad\n- Defensa contra inyección / moderación / política de rechazo: []\n\n## Barra de Evaluación (criterios para lanzar)\n- Golden ≥85% bueno · Seguridad adversarial 100% rechazado · Regresión 100% mantenida.\n\n## Ciclo de Vida\n- Política de fijación / vigilancia de descontinuación / migración con gate de evaluación.\n",
    "security.md":
      "# Estándares de Seguridad\n\n## Nivel de Garantía\n- Nivel OWASP ASVS objetivo: [L1 | L2 | L3] — por qué: []\n\n## Modelado de Amenazas\n- Método: STRIDE por componente y frontera de confianza, revisado en cada cambio de diseño.\n- Dónde viven los modelos de amenazas: en el design.md de cada función +sec → Modelo de Amenazas.\n\n## Autenticación y Autorización\n- Proveedor de identidad / modelo de sesión: []\n- Modelo de autorización (RBAC / ABAC / comprobación de propiedad), denegar por defecto: []\n\n## Secretos y Criptografía\n- Almacén de secretos: [] — nunca en el código, en configuración versionada, en logs ni en tickets.\n- Cifrado en reposo / en tránsito (versión de TLS, rotación de claves): []\n\n## Reglas de Código Seguro\n- Validar la entrada en las fronteras de confianza; codificar la salida; solo queries parametrizadas.\n- Ningún secreto, token ni stack trace en respuestas o logs.\n\n## Pruebas de Seguridad (locales)\n- SAST: [] · auditoría de dependencias: [] · análisis de secretos: [] · DAST (servicios expuestos): []\n- Cada amenaza relevante tiene una prueba de caso de abuso.\n\n## Gestión de Vulnerabilidades\n- Plazos de corrección por severidad (crítica / alta / media): [] · quién hace el triaje: []\n",
    "privacy.md":
      "# Estándares de Privacidad (RGPD)\n\n## Roles\n- Responsable del tratamiento: [] · DPD / contacto de privacidad: [] · autoridad de control: [p.ej., AEPD]\n\n## Principios (RGPD, art. 5)\n- Licitud, lealtad y transparencia · limitación de la finalidad · minimización de datos · exactitud · limitación del plazo de conservación · integridad y confidencialidad · responsabilidad proactiva.\n\n## Registro de Actividades de Tratamiento (art. 30)\n- Dónde está el registro de actividades de tratamiento: []\n\n## Bases Jurídicas en Uso (art. 6)\n- [actividad de tratamiento → base jurídica]\n\n## Plazos de Conservación\n| Categoría de datos | Plazo de conservación | Método de supresión |\n|---|---|---|\n| | | |\n\n## Solicitudes de los Interesados\n- Canal · verificación de identidad · plazo de un mes (art. 12.3) · responsable: []\n\n## Encargados y Transferencias\n- Encargados aprobados (contratos del art. 28): [] · transferencias fuera del EEE y su garantía: []\n\n## Protección de Datos desde el Diseño (art. 25)\n- Por defecto: recoger lo mínimo, seudonimizar siempre que sea posible, sin datos personales en los logs.\n\n## Respuesta a Brechas de Datos\n- Notificar a la autoridad de control en un plazo de 72 horas (art. 33) · runbook: []\n",
    "distributed.md":
      "# Estándares de Sistemas Distribuidos y Consistencia de Datos\n\n## Garantía de Entrega\n- Por defecto: al menos una vez — todos los consumidores son idempotentes. \"Exactamente una vez\" es un efecto de la idempotencia, nunca una promesa del broker.\n- Orden: por clave (partición / grupo de mensajes) solo donde una función lo pide: []\n\n## Escrituras entre Sistemas\n- Una escritura que toca más de un sistema (BD + broker, BD + caché, BD + API externa) pasa por un outbox transaccional (o CDC) — nunca \"commit y después publicar\".\n- Transacciones de negocio entre servicios: una saga con una compensación por paso; orquestación o coreografía: []\n\n## Idempotencia\n- Origen de la clave de idempotencia (cabecera del cliente / ID del mensaje / clave natural): [] · dónde viven las claves procesadas (tabla inbox / restricción de unicidad) y durante cuánto tiempo: []\n\n## Política de Reintentos (valores por defecto)\n- Retroceso exponencial con jitter · máximo de intentos: [] · tiempo de espera por llamada: []\n- Nunca se reintenta: una llamada no idempotente sin clave, un error de validación (4xx) · mensajes envenenados → DLQ tras [] intentos, con alerta.\n\n## Política de Bloqueo\n- Por defecto: bloqueo optimista (una columna de versión); pesimista (SELECT … FOR UPDATE) solo en secciones cortas y muy disputadas · tiempo de espera del bloqueo: []\n\n## Consistencia por Defecto\n- Nivel de aislamiento por defecto: [] · dónde se acepta la consistencia eventual y el retraso máximo: [] · leer las propias escrituras para el usuario que escribió.\n\n## Observabilidad\n- Retraso del outbox, retraso de los consumidores, profundidad de la DLQ y número de reintentos son métricas con alertas: []\n",
    "glossary.md":
      "# Glosario\n\n<!-- El lenguaje ubicuo del producto:una entrada por término del dominio — la palabra que usan las specs, lo que significa\n     aquí y las palabras que NO se usan para él. spec_clarify pregunta por cada palabra a evitar que encuentre en el\n     requirements.md / design.md de una función, spec_doctor avisa (comprobación `glossary`) y spec_task_brief cita las entradas\n     que usan los criterios de una tarea. Una entrada por línea (el marcador `_Avoid:_` se queda en inglés), por ejemplo:\n     - **Cliente** — una persona o empresa con un contrato firmado. _Avoid: comprador, consumidor_ -->\n\n- **[Término]** — [lo que significa en este producto]. _Avoid: [palabra], [palabra]_\n",
  },
};

// The evals README is a single block per language (kept out of the per-language BUILD map
// because it carries no track logic).
const EVALS_README = {
  en:
    "# Evals\n\n" +
    "Local, offline-friendly eval harness. Run from the project root:\n\n" +
    "```\nnode <plugin>/mcp/evals/run-evals.js <feature-slug>\n```\n\n" +
    "- Uses your own `ANTHROPIC_API_KEY` (env). No CI, no third party beyond your model provider.\n" +
    "- Without an API key (or with `--dry-run`) it validates the sets and prints the plan without calling a model.\n" +
    "- `--set-baseline` records the current scores as the baseline to compare future runs against.\n\n" +
    "Set files: `golden.json`, `adversarial.json`, optional `regression.json`.\n" +
    "Item shape: `{ id, input, expect: { type, value|rubric } }`. Grader types: contains | equals | regex | refuse | judge.\n" +
    "The system prompt is read from the latest `../prompts/vN.md` (its `## System` section).\n",
  pt:
    "# Evals\n\n" +
    "Harness de avaliação local, funciona offline. Corre a partir da raiz do projeto:\n\n" +
    "```\nnode <plugin>/mcp/evals/run-evals.js <slug-da-feature>\n```\n\n" +
    "- Usa o teu próprio `ANTHROPIC_API_KEY` (env). Sem CI, sem terceiros além do teu fornecedor de modelo.\n" +
    "- Sem chave de API (ou com `--dry-run`) valida os conjuntos e imprime o plano sem chamar um modelo.\n" +
    "- `--set-baseline` regista as pontuações atuais como baseline para comparar com execuções futuras.\n\n" +
    "Ficheiros de conjunto: `golden.json`, `adversarial.json`, opcional `regression.json`.\n" +
    "Formato de item: `{ id, input, expect: { type, value|rubric } }`. Tipos de grader: contains | equals | regex | refuse | judge.\n" +
    "O system prompt é lido do `../prompts/vN.md` mais recente (a sua secção `## System`).\n",
  es:
    "# Evals\n\n" +
    "Harness de evaluación local, apto para uso sin conexión. Ejecútalo desde la raíz del proyecto:\n\n" +
    "```\nnode <plugin>/mcp/evals/run-evals.js <slug-de-la-función>\n```\n\n" +
    "- Usa tu propio `ANTHROPIC_API_KEY` (env). Sin CI, sin terceros más allá de tu proveedor de modelo.\n" +
    "- Sin clave de API (o con `--dry-run`) valida los conjuntos e imprime el plan sin llamar a un modelo.\n" +
    "- `--set-baseline` registra las puntuaciones actuales como baseline para comparar con ejecuciones futuras.\n\n" +
    "Archivos de conjunto: `golden.json`, `adversarial.json`, opcional `regression.json`.\n" +
    "Formato de ítem: `{ id, input, expect: { type, value|rubric } }`. Tipos de grader: contains | equals | regex | refuse | judge.\n" +
    "El system prompt se lee del `../prompts/vN.md` más reciente (su sección `## System`).\n",
};

// ===========================================================================
// Human-readable tool messages (doctor / clarify / next-action / add-track /
// init notes / hook output). Functions so callers interpolate freely.
// ===========================================================================

const MSG = {
  en: {
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
      missing: (n, slug) => `Task ${n} has a _Verify:_ command but no evidence was recorded — pass the evidence (command, exit code, summary) or run: dev-spec done ${slug} ${n} --run`,
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
    kindKept: (kept, asked) => `'${kept}' is already the kind of this feature — kept it (asked for '${asked}'). Start a new one for a different kind.`,
    langKept: (kept, asked) => `This feature is already in '${kept}' — kept it (asked for '${asked}'). One feature, one language.`,
    err: {
      noUsableName: (name) => `Feature name '${name}' has no usable characters (a-z, 0-9) for a folder name.`,
      reserved: (slug) => `'${slug}' is a reserved name — pick another feature name.`,
      reservedWin: (slug) => `'${slug}' is a reserved name on Windows — pick another feature name.`,
      notFound: (slug, root) => `Feature '${slug}' not found under ${root}`,
      archivedHint: (slug) => `— it is archived (.specs/_archive/${slug}): restore it first (dev-spec feature restore ${slug}).`,
      invalidJson: (rel, detail) => `${rel} is not valid JSON (${detail}) — fix it by hand; refusing to overwrite it.`,
      tasksMissing: (slug) => `tasks.md not found for '${slug}'`,
      requirementsMissing: (slug) => `requirements.md not found for '${slug}'`,
      taskNotFound: (n) => `Task ${n} not found in tasks.md`,
      featureBusy: (slug, rel) => `Another dev-spec process is updating '${slug}' right now (${rel || `.specs/${slug}/.lock`}) — nothing was changed; retry in a moment. If no other editor or dev-spec command is running, delete that file.`,
      roadmapBusy: "Another dev-spec process is updating .specs/roadmap.json right now (.specs/.roadmap.lock) — nothing was changed; retry in a moment. If no other editor or dev-spec command is running, delete that file.",
      folderInUse: (rel) => `The folder ${rel} is in use by another program (an editor, a file indexer or antivirus, a terminal opened inside it) — nothing was moved or deleted; close it and try again.`,
      lockStuck: (rel) => `A stale dev-spec lock (${rel}) could not be removed — the file (or a folder of that name) is held open by another program, read-only, or not a file. Nothing was changed. Delete ${rel} by hand (check its permissions), then retry.`,
      numberInt: "number must be an integer",
      noText: "No text provided.",
      unknownPhase: (phase, known) => `Unknown phase '${phase}'. Known: ${known}`,
      alreadyArchived: (slug) => `'${slug}' is already archived (.specs/_archive/${slug}). Remove it there first.`,
      renameNeedsName: "rename needs a new name.",
      sameSlug: "New name is the same slug.",
      alreadyExists: (slug) => `'${slug}' already exists.`,
      badAction: "action must be one of: remove | archive | rename | restore | flow",
      badTrack: "track must be one of: tdd | saas | ai | sec | privacy | dist",
      cycle: (chain) => `Circular dependency: ${chain}`,
      nameRequired: "name required",
      noSpecs: (root) => `No .specs/ at ${root}`,
      notGenerated: (file) => `${file} exists and was not generated by dev-spec — left untouched.`,
      unknownSteering: (file, known) => `Unknown steering file '${file}'. Known: ${known}`,
    },
    ears: {
      needsClar: "Unresolved [NEEDS CLARIFICATION] marker — resolve before design.",
      noModal: "Criterion has no modal verb (SHALL / DEVE / DEBE) — not a valid EARS statement.",
      noId: "Criterion has no stable ID (e.g., US-1.AC-1).",
      vague: (term) => `Vague term '${term}' — replace with a concrete, testable value.`,
      noKeyword: "No EARS keyword (WHEN/WHILE/IF/WHERE · QUANDO/ENQUANTO/SE/ONDE · CUANDO/MIENTRAS/SI/DONDE). OK for ubiquitous requirements; confirm intentional.",
    },
    classify: {
      conf: { high: "high", medium: "medium", none: "none" },
      core: "core: always on (every Spec-mode feature).",
      on: (t, conf, list, neg) => `+${t}: ON${conf ? ` [${conf} confidence]` : ""} — matched signals: ${list}.${neg ? ` (${neg} appeared negated.)` : ""}`,
      off: (t, neg) => `+${t}: off — ${neg ? `${neg} appeared negated.` : "no signals matched."}`,
      substantial: "No track signals matched but the description is substantial — consider whether +tdd applies (correctness/edge cases).",
      weakOnly: (list) => `On from weak signals only — double-check: ${list}.`,
      possible: (t, sig) => `Possible +${t} — weak signal '${sig}' (needs corroboration; not auto-enabled).`,
      keptOff: (t, kw) => `+${t} kept off — '${kw}' appeared negated.`,
      onAlthough: (t, quoted, list) => `+${t} is ON although ${quoted} appeared negated — enabled by: ${list}. Confirm this is intentional.`,
    },
    sectionStatus: { missing: "missing", unfilled: "unfilled" },
    sectionNames: {},
    precommit: {
      header: "dev-spec-driven pre-commit:",
      earsErrors: (f, n) => `✗ ${f}: ${n} EARS error(s)`,
      earsClean: (f, n) => `✓ ${f}: EARS clean (${n} criteria)`,
      earsWarnings: (f, n, w, p) => `⚠ ${f}: no EARS errors (${n} criteria), but ${[w ? `${w} warning(s)` : null, p ? `${p} template placeholder(s) left` : null].filter(Boolean).join(" and ")} — not blocking`,
      phantom: (f, n, list) => `✗ ${f}: ${n} phantom AC/test reference(s) — likely typos: ${list}`,
      uncovered: (f, n, list) => `⚠ ${f}: ${n} AC(s) not covered by a task (warning): ${list}`,
      traceClean: (f, n) => `✓ ${f}: traceability clean (${n} ACs)`,
      blocked: (n) => `\nCommit blocked: ${n} blocking issue(s) in staged spec files. Fix or 'git commit --no-verify' to bypass.`,
    },
    doctor: {
      steeringMissing: (list) => `missing: ${list}`,
      steeringOk: "core steering present (incl. constitution)",
      requirementsMissing: "requirements.md missing",
      clarificationsOpen: (n) => `${n} unresolved [NEEDS CLARIFICATION] — resolve before design`,
      clarificationsNone: "none open",
      scPresent: "present",
      scMissing: "no measurable SC-### success criteria",
      prioritiesOk: "user stories prioritized",
      prioritiesMissing: "no P1 (MVP) priority on a user story",
      acDup: (list) => `duplicate AC IDs: ${list}`,
      acUnique: "AC IDs unique",
      earsDetail: (n, e, w) => `criteria=${n}, errors=${e}, warnings=${w}`,
      earsNoCriteria: (ids) => `requirements.md cites AC IDs (${ids}) but no criterion was linted — EARS checks an AC written as a list item, heading or line that starts with its ID, or as a table row under an Acceptance Criteria heading`,
      designMissing: "design.md missing",
      mermaidOk: "has a diagram",
      mermaidMissing: "no mermaid diagram found",
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
      allDone: (slug) => `All tasks done — close the feature with /spec-finish ${slug} (spec_finish): readiness report + merge summary.`,
      breakIntoTasks: (slug) => `Break the design into tasks — /createTask ${slug}.`,
      drifted: (slug, day, n, total, files) => `'${slug}' was finished on ${day}, but ${n} of ${total} implementing file(s) changed since: ${files} (dev-spec drift ${slug}). Decide: the spec is now wrong → /spec-impact ${slug} (or a new feature with _Supersedes:_); the code is wrong → fix it (/spec-bugfix); harmless → re-run /spec-finish ${slug} for a fresh baseline.`,
      // signOff: null (signed off — nothing left), {} (no execution approval yet) or {at, why} (an execution approval exists
      // but predates a later change: re-confirm it — never "sign it off" as if there were none).
      // signOff.role (1.14, meta.approvalRoles.execution): the role to sign as; signOff.missing / signed: the roles still missing / signed.
      finished: (slug, day, total, signOff) => `'${slug}' is finished (${day}) — its ${total} implementing file(s) are unchanged since.` +
        (!signOff ? ` Nothing left to do here — /spec-drift ${slug} checks it after later changes.`
          : signOff.why ? ` Its execution sign-off (${signOff.at}) predates ${signOff.why} — re-confirm it: /approve ${slug} execution${signOff.role ? " --role " + signOff.role : ""}.`
            : ` Sign it off${signOff.missing ? ` — ${signOff.missing}${signOff.signed ? ` (signed: ${signOff.signed})` : ""}` : ""}: /approve ${slug} execution${signOff.role ? " --role " + signOff.role : ""}.`),
      // All tasks verified and finished, but a project check (meta.checks) has no passing run since the last task activity.
      verifySuite: (slug, list) => `'${slug}' is finished, but its project checks have no passing run since the last task activity: ${list} — /spec-finish refuses and the stop gate sends a "done" back until they pass. Run them and record the runs: dev-spec finish ${slug} --run (or spec_finish {evidence: [{name, command, exitCode}]}).`,
      // The unverified task's number is shared with another task: no run can be recorded for the second one — renumber.
      verifyDuplicate: (slug, list, n) => `All tasks are ticked, but not all are verified: ${list} — two tasks are numbered ${n}, so a run recorded for #${n} only ever reaches the first one (dev-spec done ${slug} ${n} answers for it). Renumber the tasks in .specs/${slug}/tasks.md so each number is unique (doctor: duplicate-tasks), re-approve the tasks phase (/approve ${slug} tasks), then record each renumbered task's run.`,
      signOffWhy: { approvals: (list) => `the approval of ${list}`, changeRequests: (list) => `change request ${list}`, join: " and " },
      refinish: (slug, day, why) => `'${slug}' was finished on ${day}, but it changed since (${why}) and all its tasks are done — finish it again: /spec-finish ${slug} (spec_finish {write: true}) refreshes the readiness report, the merge summary and the drift baseline; then sign it off again: /approve ${slug} execution.`,
      driftedStale: (why) => `It also changed since that finish (${why}): whichever you decide, finish it again afterwards — /spec-finish (spec_finish {write: true}) records the new baseline.`,
      verify: (slug, list, n, runnable) => `All tasks are ticked, but not all are verified: ${list} — /spec-finish and the execution sign-off refuse until each has a passing run. ` +
        (runnable ? `Re-run task ${n}'s _Verify:_ command and record the result: dev-spec done ${slug} ${n} --run` : `Record a passing run for task ${n}: spec_complete_task {name: "${slug}", number: ${n}, evidence: {command, exitCode: 0}} (dev-spec done ${slug} ${n} --cmd "<command>" --exit 0)`) +
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
    },
    hook: {
      earsClean: (n) => `EARS check: ${n} criteria, all clean ✓`,
      earsIssues: (errs, warns, top, hasErr) =>
        `EARS check on requirements.md — ${errs} error(s), ${warns} warning(s):\n${top}` + (hasErr ? "\nFix the errors before advancing to design." : ""),
      traceOk: (n) => `Traceability: all ${n} ACs covered by tasks ✓`,
      traceGaps: (feature, parts) => `Traceability gaps in ${feature}:\n  - ${parts}`,
      roadmapUpdated: (pct, complete, total) => `Roadmap updated → ${pct}% (${complete}/${total} features).`,
      sessionHeader: "dev-spec-driven — features in .specs/:",
      sessionLine: (name, tracks, phase, done, total) => `  • ${name} [${tracks}] — ${phase} (${done}/${total} tasks)`,
      sessionMore: (n) => `  … +${n} more feature(s) — /spec-status (or dev-spec list) lists them all`,
    },

    // Evidence gate (spec_complete_task / doctor / spec_finish). Reason codes stay English-stable.
    evidenceGate: {
      noContent: "Evidence needs a command (with its exit code) or a summary — an exit code alone proves nothing.",
      manualOnRunnable: (n, slug) => `Task ${n}: a note was recorded, but its _Verify:_ command was not run — it stays unverified until a passing run is recorded: dev-spec done ${slug} ${n} --run`,
      // A red-phase task (it writes a test that must FAIL) carrying a must-pass _Verify:_ can never be verified.
      redPhaseTestWord: "the test",
      redPhaseVerify: (n, slug, test) => `Task ${n} writes a test that must FAIL (the red phase), so a _Verify:_ that must pass can never pass on it. Mark task ${n} with _Expect: fail_ — a run that FAILS is then its proof (${test} fails before the fix) and a passing run is refused: dev-spec done ${slug} ${n} --run. Or move the command to the task that makes it green (the fix — its _Verify:_ then proves the fix).`,
      failedRun: (n, code, slug, runnable) => `Task ${n}: its latest recorded run failed (exit ${code}) — a note doesn't change that; it stays unverified until a passing run ` +
        (runnable ? `of its _Verify:_ command is recorded: dev-spec done ${slug} ${n} --run` : "(a command with exit code 0) is recorded."),
      duplicateNumber: (n) => `Task ${n}: another task also uses number ${n} and the recorded evidence is that task's — this one stays unverified; renumber the tasks, then record its own evidence.`,
      staleEvidence: (n, slug, runnable) => `Task ${n}: the recorded evidence is for another task or an earlier _Verify:_ command — it stays unverified until its own ` +
        (runnable ? `run is recorded: dev-spec done ${slug} ${n} --run` : "evidence is recorded."),
      reason: { "no-evidence": "no evidence", "failed-run": "latest run failed", "manual-note-on-runnable-verify": "note only, _Verify:_ command not run", "duplicate-number": "number shared with another task",
        "stale-evidence": "evidence is for another task or _Verify:_ command",
        "unexpected-pass": "run passed, but _Expect: fail_ needs a red run",
        unobserved: "run not observed by the harness" }, // 1.14 F1 (meta.evidence: observed)
      duplicateTasks: (list) => `task numbers used more than once: ${list} — complete/brief pick the first open one; renumber them`,
    },
    // 1.14 F1 — harness-observed evidence (hooks/observe-hook.js; roadmap.json meta.evidence "reported" | "observed").
    observed: {
      on: "Evidence mode OBSERVED — a task whose _Verify:_ holds a command is verified only by a passing run the harness saw (in Claude Code the plugin's observe hook logs every Bash run of a _Verify:_ or project-check command) or that dev-spec done --run / finish --run made itself; a project check's run likewise (roadmap.json meta.evidence). An MCP-only client has no such hook: record its runs with dev-spec done <feature> <n> --run.",
      off: "Evidence mode REPORTED — the runs an agent reports verify as given (roadmap.json meta.evidence); each record still says whether the harness observed it.",
      badValue: (v) => `--evidence takes reported or observed (got '${v}').`,
      badInput: (v) => `evidence must be "reported" or "observed" (got '${v}').`,
      unobservedRedNote: (n, slug) => `Task ${n} is marked _Expect: fail_: its proof is the RED run, and the harness never saw it — this project verifies only observed runs (roadmap.json meta.evidence: observed). Re-make the red run where it is observed: set the fix aside (git stash), run the _Verify:_ command with the Bash tool in Claude Code or with dev-spec done ${slug} ${n} --run (it must fail), then restore the fix and record its passing run.`,
      unobservedNote: (n, slug) => `Task ${n}: the run was recorded, but the harness never saw it — this project verifies a _Verify:_ command only by an observed run (roadmap.json meta.evidence: observed). Run the command with the Bash tool in Claude Code and record it again, or let the CLI run it: dev-spec done ${slug} ${n} --run`,
      neverObserved: "No run was ever observed in this project: only Claude Code with the dev-spec-driven plugin records them (hooks/observe-hook.js) — an MCP-only client has no hook, so record the runs with dev-spec done <feature> <n> --run (or switch back: dev-spec init --evidence reported).",
      naHint: "This project verifies only runs the harness saw (roadmap.json meta.evidence: observed): run the command with the Bash tool in Claude Code, or through the CLI (--run).",
    },
    // CLI `done` human output.
    taskDone: {
      done: (n, verified, done, total) => `Task ${n} done${verified ? " (verified)" : ""}. ${done}/${total}`,
      already: (n, verified, done, total) => `Task ${n} was already done${verified ? " (verified)" : ""}. ${done}/${total}`,
      next: (n, text) => `  next → #${n} ${text}`,
      allDone: "  — all done ✓",
      numberInt: "task number must be an integer",
      noRunnable: (n) => `task ${n} has no runnable _Verify: <command>_ marker`,
      shellHint: "Hint: the default Windows shell (cmd.exe) could not run this command line as written. If the _Verify:_ command is written for a POSIX shell, retry with --shell bash (or set DEV_SPEC_SHELL=bash).",
      posixOnWindows: (cmd, kinds) => `the _Verify:_ command \`${cmd}\` uses POSIX shell syntax (${kinds.map((k) => ({ "single-quotes": "single quotes '…'", variable: "$VARIABLES" })[k] || k).join(", ")}) that cmd.exe — the default shell of --run on Windows — reads differently, often without failing: it has no single quotes and never expands $VAR, so a broken check could be recorded as a passing run. Nothing was run; the task stays open. Re-run with --shell bash (Git Bash; or set DEV_SPEC_SHELL=bash) — or --shell cmd to run it under cmd.exe anyway.`,
    },

    tracks: {
      unknown: (items, valid) => `Unknown track${items.length > 1 ? "s" : ""}: ${items.map((u) => `'${u.token}'` + (u.suggestion ? ` (did you mean '${u.suggestion}'?)` : "")).join(", ")}. Valid tracks: ${valid}.`,
      cannotRemoveCore: "'core' is always on — it can't be removed.",
      bugfixNeedsTdd: "A bugfix is always test-first — +tdd can't be removed from it.",
      notActive: (list) => `Not active: ${list} — nothing to remove.`,
      removed: (list, slug) => `Removed ${list} from the active tracks. No file was deleted — the inactive artifacts stay in place and count again if you re-add the track. Re-run /spec-doctor ${slug}.`,
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
      unknown: (list) => `Every dependency must be an existing feature — not found: ${list}`,
      orderInt: (v) => `order must be an integer (got '${v}').`,
    },
    // mcp/evals/run-evals.js human output (in the feature's language).
    evals: {
      usage: "Usage: node run-evals.js <feature> [--dry-run] [--set-baseline] [--require-live] [--model=ID] [--project=DIR] [--max-items=N]",
      noEvalsDir: (slug, dir) => `No evals/ dir for '${slug}' at ${dir}`,
      requireLive: "eval harness: ANTHROPIC_API_KEY is not set and --require-live was given — refusing to fall back to a dry run.",
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
      backlogNotFound: (name, known) => `'${name}' is not in the backlog${known ? ` (backlog: ${known})` : " (the backlog is empty)"}.`,
      backlogIsFeature: (name, slug) => `'${name}' already has a spec (.specs/${slug}/) — the backlog is for features without one yet (status: dev-spec status ${slug}).`,
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
      confirmHint: (slug) => `Nothing deleted. Re-run with --yes to confirm — or archive it instead: dev-spec feature archive ${slug}`,
      missingValue: (flag) => `missing value for --${flag}`,
      unknownFlag: (flag, suggestion) => `unknown option ${flag}` + (suggestion ? ` — did you mean ${suggestion}?` : ".") + " Run `dev-spec help` for the options.",
      unknownRules: (tool, known) => `unknown tool '${tool}'. Known: ${known}`,
      scaleSections: (list) => `Scale sections: ${list}`,
      aiSections: (list) => `AI sections: ${list}`,
      dependsOn: (f, deps, order, unknown) => `${f} depends on: ${deps || "(none)"}` + (order != null ? `  order=${order}` : "") + (unknown ? `  ⚠ unknown deps: ${unknown}` : ""),
      trackNow: (f, tracks) => `'${f}' now [${tracks}]`,
      usage: (syntax) => `usage: ${syntax}`,
      unknownCommand: (c) => `unknown command '${c}'. Run \`dev-spec help\`.`,
      unknownClient: (c, known) => `unknown client '${c}'. Known: ${known}`,
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
        "requirements.md": (slug) => `check it with /clarify ${slug} and ears_validate (dev-spec ears ${slug})`,
        "bug.md": (slug) => `write the Reproduction and the Root Cause with evidence (/spec-doctor ${slug})`,
        "design.md": (slug) => `run /spec-doctor ${slug} (mandatory sections, Constitution Check)`,
        "test-plan.md": (slug) => `check the AC coverage with trace_check (dev-spec trace ${slug})`,
        "eval-plan.md": (slug) => `set the thresholds and the baseline, then /spec-doctor ${slug}`,
        "tasks.md": (slug) => `break the design into real tasks (/createTask ${slug}), then trace_check`,
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
      clarifyPlaceholders: (file, n, list) => `Replace the ${n} template placeholder(s)/TBD in ${file}: ${list}`,
      hookPlaceholders: (n, list) => `Template placeholders: ${n} left in requirements.md (${list}) — replace them before approving the requirements.`,
    },

    // Brownfield depth: scan / coverage CLI lines and the integration-plan doctor check.
    brownfield: {
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
      phantom: (list) => `Unknown acceptance criteria (not in requirements.md): ${list}. Nothing was written — fix the IDs or add the criteria first.`,
      badHeading: "heading must be one line of text.",
      constraintsHeading: (h) => `'${h}' holds the constraints every task respects, not tasks — pick a phase heading. Nothing was written.`,
      inactiveHeading: (h, track) => `'${h}' is the task section of the inactive ${track} track — re-add the track or pick another heading. Nothing was written.`,
      unsafe: (n) => `Couldn't append safely: ${n ? `task ${n} would not read back as written` : "existing tasks would change"} (an unclosed comment or code fence near the end of the phase?). Nothing was written.`,
      reapprove: (slug) => `tasks.md changed after its approval — review the new tasks, then re-approve: /approve ${slug} tasks.`,
      appended: (heading, created) => `Appended to tasks.md → '${heading}'${created ? " (new phase)" : ""}:`,
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
      // --phase test-plan: a REMOVED planned test — its tasks still name its T-ID in _Makes green:_.
      retireTests: {
        retireHint: (list, slug, phase, offer) => `Removed tests still made green by tasks — ${list}: don't redo those tasks; drop the T-ID from their _Makes green:_ or point it at the test that replaces it.` +
          (offer ? ` --reopen records the change request without unticking them (dev-spec impact ${slug} --phase ${phase} --reopen).` : ""),
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
        (offer ? ` --reopen records the change request without unticking them (dev-spec impact ${slug} --phase ${phase} --reopen).` : ""),
      retireNote: (list) => `Removed criteria are not redone — still cited: ${list}: delete those tasks and test rows, or point them at the criterion that replaces it.`,
      recordedRetire: (n, list, slug, phase) => `Change request #${n} recorded — nothing unticked: a removed criterion's tasks are not redone. Still cited: ${list}: delete those tasks and test rows, or point them at the criterion that replaces it; then re-approve: /approve ${slug} ${phase}.`,
      recordedOnly: (n, slug, phase) => `Change request #${n} recorded — no done task was affected. Review it, then re-approve: /approve ${slug} ${phase}.`,
      reopenHint: (slug, phase) => `To untick the affected done tasks and mark their evidence stale: dev-spec impact ${slug} --phase ${phase} --reopen (spec_impact {reopen: true}).`,
      nextHint: (slug, phases) => `First see what the edit touches with spec_impact (${phases.map((p) => `dev-spec impact ${slug} --phase ${p}`).join(" · ")}).`,
      doctorChanged: (list, slug, phases) => `changed after their approval: ${list} — see what the edit touches with spec_impact (${phases.map((p) => `dev-spec impact ${slug} --phase ${p}`).join(" · ")}), then re-approve`,
      doctorChangedPlain: (list, slug) => `changed after their approval: ${list} — re-review, then re-approve (/approve ${slug} <phase>)`,
      staleNote: (n, slug, runnable) => `Task ${n}: its evidence predates a spec change (spec_impact reopened it) — it stays unverified until ` +
        (runnable ? `a new passing run is recorded: dev-spec done ${slug} ${n} --run` : "new evidence is recorded."),
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
      writeNeedsName: "write needs a feature name — the retrospective is per feature (spec_metrics {name, write: true} / dev-spec metrics <feature> --write).",
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
      activeExists: (slug) => `'${slug}' is already an active feature — rename or archive it before restoring the archived one.`,
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
      none: "No finished feature has a drift baseline yet — spec_finish {write: true} (dev-spec finish <feature> --write) records one when a feature is ready to finish.",
      clean: (f, n, d, archived) => `  ✓ ${f}${archived ? " (archived)" : ""}: ${n} implementing file(s) unchanged since finish (${d})`,
      drifted: (f, n, total, d, archived) => `  ⚠ ${f}${archived ? " (archived)" : ""}: ${n} of ${total} implementing file(s) changed since finish (${d})`,
      changed: (list) => `      changed: ${list}`,
      missing: (list) => `      missing: ${list}`,
      nowPresent: (list) => `      now present (missing at finish): ${list}`,
      reopened: (list) => `  · reopened since finish (tasks open again — checked once finished again): ${list}`,
      unbaselined: (list) => `  · no finish baseline yet: ${list}`,
      stale: (f, d, why, archived) => `  ↻ ${f}${archived ? " (archived)" : ""}: changed since finish (${d}) — ${why}; its baseline no longer covers it: ${archived ? `restore it (dev-spec feature restore ${f}), finish it again (dev-spec finish ${f} --write), then archive it again` : `finish it again (dev-spec finish ${f} --write)`}`,
      staleWhy: {
        changeRequests: (list) => `change request ${list}`,
        approvals: (list) => `re-approved: ${list}`,
        newFiles: (n, list) => `${n} implementing file(s) not in the baseline: ${list}`,
      },
      hookLine: (f, n) => `  ⚠ ${f}: ${n} implementing file(s) changed since finish — run dev-spec drift ${f}`,
      baselineRecorded: (n, missing) => `Drift baseline recorded: ${n} implementing file(s)${missing ? ` (${missing} missing)` : ""} — dev-spec drift shows what changes after this finish.`,
      baselineReplaced: (n, day, list) => `Replaced the baseline of ${day}, in which ${n} file(s) had drifted: ${list} — the new baseline accepts them as they are now.`,
    },

    // Guard mode (hooks/guard-hook.js, PreToolUse · spec_init {guard} · `dev-spec init --guard on|off`).
    guardMode: {
      ask: (pending, stale) => "dev-spec guard: no approved tasks cover code changes right now — approve a feature's tasks (spec_approve) or confirm to proceed." +
        (pending ? ` Features with tasks awaiting approval: ${pending}.` : "") +
        (stale ? ` Tasks changed after their approval (review, then re-approve the tasks phase): ${stale}.` : "") + " (Guard mode is on — dev-spec init --guard off disables it.)",
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
        ask: "Approval guard ASK — an agent's approval (spec_approve / dev-spec approve, a feature removal, lowering this guard) asks you first (roadmap.json meta.approvalGuard). A permission prompt may be skipped in Claude Code's auto / bypass permission modes — 'deny' holds in every mode.",
        deny: "Approval guard DENY — an agent's approval (spec_approve / dev-spec approve, a feature removal, lowering this guard) is refused: you approve in your own terminal, or in Claude Code with the ! prefix (roadmap.json meta.approvalGuard).",
      },
      off: "Approval guard OFF — an agent's approval calls are not gated (roadmap.json meta.approvalGuard).",
      badValue: (v) => `--approval-guard takes off, ask or deny (got '${v}').`,
      action: (a) => {
        const f = a.feature || "?";
        if (a.kind === "remove") return `permanently delete the feature '${f}' (its .specs/ folder, approvals and history)`;
        // guard-down: lowering this guard, or weakening what it stands for (a.setting — the spec_init / `init` setting, or a
        // shell write of roadmap.json)
        if (a.kind === "guard-down") {
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
        " Approvals are yours — allow this only if you approve it yourself. (meta.approvalGuard: ask — dev-spec init --approval-guard deny refuses agent approvals outright.)",
      // command: the line the human runs, or null (a change with no dev-spec command — a shell write of roadmap.json)
      deny: (list, command) => `dev-spec approval guard: refused — approvals are the human's, and an agent may not ${list}. ` +
        (command ? `Stop and ask the user to run it themselves, in their own terminal or in Claude Code with the ! prefix (it runs as the user, not as your tool call): ${command}` : "Stop and ask the user to make that change themselves, in their own editor or terminal") +
        " — then wait for them. Do not retry it by another route (the MCP tool, the CLI, a script or an edit of .specs/ files). (meta.approvalGuard: deny.)",
      denyUser: (list, command) => `dev-spec approval guard refused an agent's request to ${list}.` + (command ? ` To approve it yourself: ${command}` : " Make that change yourself if you want it."),
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
        verify: (list, slug) => `Record a passing run for the ticked tasks without one: ${list} — dev-spec done ${slug} <n> --run`,
        drift: (n, slug) => `Decide on the drift: ${n} implementing file(s) changed since finish — dev-spec drift ${slug}`,
        stale: (slug) => `It changed after its finish — finish it again: /spec-finish ${slug}`,
        critic: (files) => `Review it with the spec-critic agent (read-only), phase by phase: ${files || "—"}`,
        converge: (files) => "Run the spec-reviewer converge pass (the done tasks against their ACs)" + (files ? `, then the spec-critic agent on ${files}` : ""),
        none: "No spec review needed — every task is done",
        next: (rec) => `Next: ${rec}`,
        warnings: (list) => `Warnings: ${list}`,
      },
      reason: { "no-fingerprint": "approved before content fingerprints", changed: "changed after its approval", missing: "its file is missing", untracked: "a 1.12 bugfix design approval — bug.md was never tracked", "snapshot-missing": "its snapshot file is gone" },
      planHead: "Apply would change (spec_upgrade {apply: true} · dev-spec upgrade --apply) — never an artifact, an approval or a tick:",
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
      applyHint: "Nothing was changed. Review the list, then apply the safe migrations: dev-spec upgrade --apply (spec_upgrade {apply: true}).",
      reportAt: (file) => `Report: ${file} — a checklist to work through (/spec-upgrade).`,
      reportKept: (file) => `${file} exists and was not generated by dev-spec — left untouched (no report written).`,
      hookLine: (from) => `⬆ .specs/ was created with an older dev-spec (${from || "before 1.13"}) — run /spec-upgrade (dev-spec upgrade) to review what isn't implemented yet (or just ask to update the specs)`,
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
      cliHead: (n) => `${n} prompt(s) — one per plugin command; dev-spec prompts <name> [--args "…"] prints one:`,
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
          "spike.md": "Spike (question · evidence · decision)", "decisions.md": "Decision log", // 1.14 C2
        },
        tplFeature: (list) => `A feature's spec artifact: .specs/{slug}/{artifact} — {artifact} is one of ${list}.`,
        tplSteering: "A steering file: .specs/steering/{file} (a .md file).",
        truncated: (cap, total) => `Resource list capped at ${cap} of ${total} — read the others through the templates specs://feature/{slug}/{artifact} and specs://steering/{file}.`,
      },
      err: {
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
          fix: (s) => (s.file === "bug.md" ? "write the root cause in bug.md" : `fix the ${s.phase} gate`),
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
        byText: "dev-spec: the user approved this plan. To track it as a spec (EARS criteria, traced tasks, evidence gates), offer /spec-import — spec_import {tool: \"plan\", text: <the approved plan's markdown>} (CLI: dev-spec import plan - < plan.md). The plan file in ~/.claude/plans is outside the project, so pass its text. Skip it for a quick change; import only with the user's OK.",
        byPath: (rel) => `dev-spec: the user approved this plan. To track it as a spec (EARS criteria, traced tasks, evidence gates), offer /spec-import — spec_import {tool: "plan", path: "${rel}"} (CLI: dev-spec import plan ${rel}). Skip it for a quick change; import only with the user's OK.`,
      },
      importText: {
        label: "(inline text)",
        note: (tool, date) => `> Imported from ${tool} (inline text) on ${date}.`,
        orText: "Or pass its markdown as `text` instead of `path` (spec_import {tool, text}; CLI: dev-spec import <tool> - < file.md).",
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
      allFilled: { sec: "all 5 filled", privacy: "all 6 filled", dist: "all 5 filled" }, // doctor's sec-sections / privacy-sections / dist-sections pass detail
      statusSections: { sec: (list) => `Security sections: ${list}`, privacy: (list) => `Privacy sections: ${list}`, dist: (list) => `Data consistency sections: ${list}` }, // `dev-spec status`
      finishChecks: { // spec_finish `checks`: what only a fresh run or a human can confirm
        sec: ["+sec: SAST, dependency audit and secret scan clean on a fresh local run; every abuse-case test green.",
          "+sec: threat model re-checked against the final code — no new entry point or trust boundary left unmitigated."],
        privacy: ["+privacy: access/export and erasure verified end to end on the real stores (processors included).",
          "+privacy: retention job scheduled; privacy notice and records of processing (Art. 30) updated; DPIA decision on file."],
        dist: ["+dist: failure-injection tests green on a fresh local run — crash between commit and publish, duplicate delivery, concurrent updates, a dependency down.",
          "+dist: no cross-system write in the final code bypasses its mitigation (outbox / inbox / saga) — no database commit followed by a direct publish."],
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
      doctor: (list) => `marker-shaped text on a task line yields no marker: ${list} — the tools read nothing there (no check runs, no file is traced). Write it as _Verify: <command>_ / _Implements: <path>_ / _Depends: 3_ (italics, the value inside).`,
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
      legacyFeature: ".specs/templates/ is the folder of a feature created before project templates existed (it holds a .state.json) — it stays that feature and is never read as templates. Rename it (dev-spec feature rename templates <new-name>, or spec_feature rename) to use project templates.",
      builtIn: "built-in",
      override: "project",
      listHead: (lang, n) => `Templates for '${lang}' features — ${n} project override(s) in .specs/templates/ (a <lang>/ file wins over a shared one):`,
      ignored: (list) => `Ignored — not a template dev-spec knows: ${list}`,
      initDone: (n) => `${n} built-in template(s) copied into .specs/templates/ — edit them; new scaffolds use them from now on:`,
      initKept: (list) => `Kept (already there — never overwritten): ${list}`,
      initNothing: "Nothing copied — every template asked for is already in .specs/templates/.",
      checkNone: "No project template to check — .specs/templates/ holds no override (`dev-spec templates init` copies the built-in ones).",
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
      missing: (list) => `track pack(s) not available: ${list} — the track is inactive for this feature until the pack is back (dev-spec tracks check).`,
      missingAbsent: (name) => `+${name} (no .specs/tracks/${name}/ in this project)`,
      missingInvalid: (name, codes) => `+${name} (the pack is invalid: ${codes})`,
      badAction: (a) => `Unknown tracks action '${a}' — one of: list, init, check.`,
      nameRequired: "tracks init needs a name — dev-spec tracks init <name> (spec_tracks {action: \"init\", name}).",
      unknownPack: (n, list) => `No track or track pack '${n}' — the project's packs: ${list}.`,
      legacyFeature: ".specs/tracks/ is the folder of a feature created before track packs existed (it holds a .state.json) — it stays that feature and is never read as packs. Rename it (dev-spec feature rename tracks <new-name>, or spec_feature rename) to use track packs.",
      writeFailed: (rel, why) => `Could not write ${rel} (${why}).`,
      writeOutside: (rel) => `Refused to write ${rel}: its folder is a link to a place outside the project.`,
      builtIn: "built-in",
      sectionCount: (n) => `${n} section(s)`,
      signalCount: (n) => `${n} signal(s)`,
      invalid: (n) => `invalid (${n} error(s)) — ignored; see dev-spec tracks check`,
      noPacks: "No track pack in .specs/tracks/ — `dev-spec tracks init <name>` scaffolds one.",
      listHead: (builtIn, packs, valid) => `Tracks — ${builtIn} built-in, ${packs} project pack(s) in .specs/tracks/ (${valid} valid):`,
      checkNone: "No track pack to check — .specs/tracks/ holds none (`dev-spec tracks init <name>` scaffolds one).",
      checkHead: (n, valid, errors, warnings) => `${n} track pack(s) checked — ${valid} valid, ${errors} error(s), ${warnings} warning(s).`,
      initDone: (name, n) => `Track pack +${name} scaffolded (${n} file(s)) — edit them; it is a valid track from now on:`,
      initKept: (list) => `Kept (already there — never overwritten): ${list}`,
      initNothing: (name) => `Nothing written — every file of the +${name} pack is already there.`,
      initNext: (name) => `Next: dev-spec tracks check · dev-spec add-track <feature> ${name} (spec_add_track), or name it when creating a feature.`,
      // The files `init` scaffolds (a = { name, token, title, lang }): a commented track.json and one example of each fragment.
      initJson: (a) => `// Track pack +${a.name} — a project-defined track (dev-spec 1.15). Data only: nothing in this folder is run.
// Guide: references/project-tracks.md · validate it: dev-spec tracks check (spec_tracks {action: "check"}).
{
  // = this folder's name: ^[a-z][a-z0-9]{1,19}$, never a built-in track (core tdd saas ai sec privacy dist).
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
      problems: {
        "linked-folder": "a link (symlink / junction) or a folder outside .specs/ — ignored: a pack is read from its own folder only.",
        "unknown-file": "not a pack file (track.json, requirements.md, tasks.md, test-plan.md, checklist.md, steering.md, <lang>/) — ignored.",
        "too-many-packs": (a) => `more than ${a.max} track packs — this one is ignored.`,
        "name-invalid": (a) => `'${a.name}' is not a track name (^[a-z][a-z0-9]{1,19}$ — lower-case letters and digits) — the pack is ignored.`,
        "name-reserved": (a) => `'${a.name}' is reserved (a built-in track, a word for one, or a word dev-spec uses) — the pack is ignored.`,
        "name-mismatch": (a) => `"name": "${a.name}" is not the folder name '${a.folder}' — the pack is ignored.`,
        "json-missing": "no track.json — the pack is ignored.",
        "json-invalid": (a) => `track.json is not valid JSON (${a.detail}) — the pack is ignored.`,
        "too-big": (a) => `${a.file} is larger than ${a.max} bytes — the pack is ignored.`,
        "fragment-linked": (a) => `${a.file} is not a regular file inside .specs/ (a link, or a folder) — the pack is ignored.`,
        "field-missing": (a) => `"${a.field}" is missing (${a.rule}) — the pack is ignored.`,
        "field-invalid": (a) => `"${a.field}" is invalid (${a.rule}) — the pack is ignored.`,
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
      kicker: { feature: "Feature specification", bugfix: "Bugfix specification", project: "Project specification" },
      projectTitle: (proj) => `${proj} — specification overview`,
      generated: (date) => `generated ${date} from the project's specs (.specs/)`,
      meta: { id: "Feature", kind: "Kind", tracks: "Tracks", phase: "Phase", progress: "Progress", status: "Status", lang: "Language", overall: "Overall progress" },
      kind: { feature: "feature", bugfix: "bugfix" },
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
      none: "No requirement IDs yet.",
      cli: {
        head: (feature, tracks, c) => `Traceability matrix — ${feature} (${tracks}): ${c.rows} requirement(s) · ${c.verified} verified · ${c.implemented} implemented · ${c.planned} planned · ${c.untraced} untraced`,
        legend: "tasks: ✓ verified · ▲ done, not verified · ○ open",
        codeLegend: "tests: ✓ named in a test file · ✗ in no test file · ○ run outside test code",
        approved: (at, by, forced) => `requirements approved ${at} by ${by}${forced ? " (forced)" : ""}`,
        notApproved: "requirements not approved yet",
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
      none: "No milestones yet — add one: dev-spec milestone add <name> <YYYY-MM-DD> <features…> (spec_milestone {action: \"add\", name, date, features}).",
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
      tooMany: (max) => `at most ${max} milestones — remove one first (dev-spec milestone rm <name>).`,
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
      staleSignOffs: (list) => `sign-offs made before the artifact changed no longer count (re-sign the current content): ${list}`,
      resigning: (list) => `re-sign in progress (the phase stays approved as it was until every role has signed the new content): ${list}`,
      unsigned: (list) => `approved without the role sign-offs now required (approved before the roles were configured or changed — counted as approved by an unknown role; ask each role to re-sign): ${list}`,
      approveRoles: (phase, slug, missing, signed, first) => `Review & sign off '${phase}' — ${missing}${signed ? ` (signed: ${signed})` : ""}: /approve ${slug} ${phase} --role ${first}.`,
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
        ` — nothing was recorded for '${phase}'. Run the fast-forward again as the role you sign for: /spec-ff ${slug} --role <role> (CLI: dev-spec approve ${slug} --through ${through} --role <role>); it resumes at '${phase}'.`,
      ffHint: (slug, list, role) => `Every planning artifact through tasks is filled and passes its gate — fast-forward: /spec-ff ${slug}${role ? " --role " + role : ""} (CLI: dev-spec approve ${slug} --through tasks${role ? " --role " + role : ""}) approves ${list} in order, each through its own gate.`,
      batch: (n) => `  batch approvals (fast-forward): ${n}`,
    },

    // 1.16 U — undo a tick (spec_complete_task {undo} / `dev-spec undone`), revoke an approval (spec_approve {revoke} /
    // `approve --revoke`) and the waiver a forced approval carries (reason / expires).
    undo: {
      unticked: (n, slug, runnable, stale) => `Task ${n} is open again (unticked).` +
        (stale ? ` Its recorded evidence no longer counts — ticking it again needs ${runnable ? `a new run of its _Verify:_ command: dev-spec done ${slug} ${n} --run` : "new evidence"}.` : ""),
      alreadyOpen: (n) => `Task ${n} is not ticked — nothing to undo.`,
      // 1.16 U review 1: an _Expect: fail_ task keeps its red run through an undo (the fix may already be in)
      redKept: (n, slug, day) => `Its red run of ${day} (the _Expect: fail_ proof) is kept: ticking it again needs a new run of its _Verify:_ command — once the fix is in, a passing run counts as the fix going green: dev-spec done ${slug} ${n} --run.`,
      // 1.16 U review 2: several ticked tasks share the number — refused
      duplicateTicked: (n, list) => `Several ticked tasks share number ${n} (${list}) — undo can't tell which tick was the mistake. Renumber them first so each number is unique (doctor: duplicate-tasks), then undo the one ticked by mistake. Nothing was changed.`,
      duplicateItem: (line, text) => `line ${line}: "${text}"`,
      reopened: (slug) => `'${slug}' was finished or signed off — once the task is done again, finish it again (/spec-finish ${slug}) and sign it off again (/approve ${slug} execution).`,
      noEvidence: "undo takes no evidence — it only unticks the task (record the new run when you tick it again).",
      reasonNeedsUndo: "reason goes with undo (spec_complete_task {undo: true, reason} / dev-spec undone <feature> <n> --reason \"…\") — a tick records evidence instead.",
      badReason: (max) => `reason must be text (one line, at most ${max} characters).`,
      staleNote: (n, slug, runnable) => `Task ${n}: it was unticked after this evidence was recorded — it stays unverified until ` +
        (runnable ? `a new run is recorded: dev-spec done ${slug} ${n} --run` : "new evidence is recorded."),
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
      phaseRequired: "Name the phase whose approval to revoke.",
      noThrough: "revoke takes one phase — not through (the fast-forward).",
      noForce: "revoke takes no force or expires — it removes an approval; reason says why.",
      // 1.16 U review 3: a revocation after the finish / the execution sign-off (drift's stale line, next_action's sign-off step)
      driftWhy: (list) => `approval revoked: ${list} (approve it again before finishing again)`,
      signOffWhy: (list) => `the revocation of ${list}`,
    },
    waiver: {
      badExpires: (v, max) => `expires must be an ISO date (YYYY-MM-DD, today or later, at most ${max} days ahead) or a number of days (30d, 1–${max}) — got ${v}.`,
      needsForce: "reason / expires describe a waiver — they go with force (reason also with revoke).",
      notForced: "The gate passed — nothing was waived: the reason / expiry were not recorded.",
      recorded: (reason, expires) => `Waiver recorded${reason ? `: ${reason}` : ""}${expires ? ` (expires ${expires})` : ""}.`,
      doctor: (list, slug) => `forced approvals whose waiver expired: ${list} — fix the failing checks and re-approve without force (/approve ${slug} <phase>), or renew the waiver (/approve ${slug} <phase> --force --reason "…" --expires 30d)`,
      expiredItem: (phase, expires, reason) => `${phase} (expired ${expires}${reason ? ` — ${reason}` : ""})`,
      roadmapItem: (phase, reason, expires, expired) => `${phase} (${[reason ? `waiver: ${reason}` : "waiver", expires ? (expired ? `EXPIRED ${expires}` : `until ${expires}`) : null].filter(Boolean).join(", ")})`,
      prHeading: "## Waived gates (forced approvals)",
      prLine: (phase, failing, reason, expires, expired) => `- ${phase} — forced over: ${failing || "—"} · ${reason ? `reason: ${reason}` : "no reason recorded"}${expires ? ` · ${expired ? "EXPIRED" : "expires"} ${expires}` : ""}`,
      finishWarn: (list, slug) => `waivers expired on forced approvals: ${list} — re-approve those phases without force, or renew the waiver (dev-spec approve ${slug} <phase> --force --reason "…" --expires 30d)`,
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
        doctorActive: (list, slug) => `open tasks plan the same files as another active feature — ${list}: both land on them at merge time and one drifts silently. Order the two (spec_depend {name: "${slug}", add: ["<other>"]} · dev-spec depend ${slug} <other>) or, where one replaces the other's behaviour, declare _Supersedes: <other>/US-n.AC-m_`,
        doctorFinished: (list, slug) => `open tasks plan files a finished feature recorded in its drift baseline — ${list}: after the merge spec_drift flags it. Declare _Supersedes: <feature>/US-n.AC-m_ on the criteria of ${slug} that replace its behaviour, make ${slug} depend on it where it builds on it (spec_depend {name: "${slug}", add: ["<feature>"]} · dev-spec depend ${slug} --add <feature>), or re-finish it after the merge (spec_finish)`,
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
      unexpectedPassNote: (n, slug) => `Task ${n} expects its test to FAIL (_Expect: fail_), but its latest run passed with no red run before it — it stays unverified until a failing run is recorded: dev-spec done ${slug} ${n} --run`,
      redRecorded: (n, code) => `  ✓ red run recorded for task ${n} (exit ${code}) — the test fails before its fix, as _Expect: fail_ expects.`,
      shellNotRed: (cmd) => `the default Windows shell (cmd.exe) could not run \`${cmd}\` as written — that is no red test (_Expect: fail_). Nothing was recorded; the task stays open.`,
      // full review Ga2: a non-zero run whose output shows the test never ran (a missing test file, module or script…).
      cantRunOutput: (n, code, what, ticked) => `Task ${n}: the run exited ${code}, but its output shows the test never ran (${what}) — that is no red test (_Expect: fail_): a missing test file, module or script is not the right reason. Write the test so it fails on an assertion (or "not implemented"), then record that run. ` + (ticked ? "Recorded; the task now counts as unverified." : "Not marking it done."),
      notRed: (cmd, what) => `\`${cmd}\` failed, but its output shows the test never ran (${what}) — that is no red test (_Expect: fail_): a missing test file, module or script is not the right reason. Nothing was recorded; the task stays open. Write the test so it fails on an assertion (or "not implemented"); then run done --run again.`,
      prRed: "the expected red run (_Expect: fail_)",
      prRedKept: (code, day) => `red run before the fix: exit ${code}${day ? " on " + day : ""}`,
      doctorMissing: (list) => `T-IDs made green by done tasks without a recorded red run: ${list} — a test that never failed proves nothing. Mark the task that writes it with _Expect: fail_ and record its failing run before the fix (dev-spec done <feature> <n> --run).`,
      doctorOk: (n) => `every T-ID made green by a done task (${n}) has a recorded red run`,
      briefExpect: "**Expected result: FAIL** (_Expect: fail_) — the run must exit non-zero: the test fails for the right reason before the fix (an assertion / not implemented — not a typo, a missing import or a command that doesn't run). A passing run is refused: it would mean the test tests nothing.",
      dodExpect: "The _Verify:_ run must FAIL (non-zero exit) for the right reason — put the command, its exit code and the failure in the report; it is recorded as the task's red run.",
      naVerify: (n, slug) => `Task ${n} is marked _Expect: fail_: its proof is a run that FAILS (its test red before the fix) — a passing run doesn't count. Record the red run (dev-spec done ${slug} ${n} --run while the test fails — before the fix, or with the fix stashed), or drop _Expect: fail_ if the task is no red test.`,
    },
    projectChecks: {
      badInput: 'checks must be an object of name → command (e.g. {"test": "npm test"}); an empty command removes that check.',
      badName: (k) => `invalid check name '${k}' — letters, digits and . _ : - (up to 40 characters, starting with a letter or a digit).`,
      badCommand: (k) => `the command of check '${k}' must be one line of text (up to 500 characters) — or empty to remove the check.`,
      tooMany: (max) => `at most ${max} project checks.`,
      badStored: (rel) => `${rel} → meta.checks is not an object of name → command strings — fix it by hand; refusing to change it.`,
      initLine: (list) => `Project checks (meta.checks): ${list}`,
      evidenceNotList: "evidence must be a list of check runs: [{name, command, exitCode, summary}].",
      noChecks: 'no project checks configured (roadmap.json meta.checks) — nothing to record. Set them first: spec_init {checks: {"test": "npm test"}} (CLI: dev-spec init --check test="npm test").',
      evidenceItem: (i, why) => `evidence[${i}]: ${why}`,
      itemNotObject: "each run must be an object {name, command, exitCode, summary}",
      unknownCheck: (name, list) => `'${name}' is not a project check — one of: ${list}`,
      needsCommand: "the command that ran is required",
      needsExit: "its exit code (an integer) is required",
      status: (i) => ({ "no-run": "no run recorded", failed: `latest run failed (exit ${i.exitCode})`, changed: "its command changed since the run", "before-last-tick": "ran before the last task activity", "code-changed": "the implementing files changed since the run", unobserved: "the run was not observed by the harness" })[i.status] || i.status,
      blocker: (list, slug) => `project checks without a passing run since the last task activity: ${list} — run them: dev-spec finish ${slug} --run (or record the runs with spec_finish {evidence})`,
      doctorWarn: (list, slug) => `every task is done, but project checks have no passing run since the last task activity: ${list} — spec_finish refuses until they pass: dev-spec finish ${slug} --run`,
      doctorOk: (n) => `every project check (${n}) has a passing run since the last task activity`,
      invalidStored: (list) => `roadmap.json meta.checks: invalid entries ignored (${list}) — each must be "name": "one-line command"`,
      prChecks: "## Project checks",
      prNoRun: "no run recorded",
      briefDod: (list) => `Run the project checks and put each command, its exit code and the last lines of its output in the report — nothing that passed before this task may fail after it: ${list}.`,
      briefDodRed: (list) => `Run the project checks and put each command, its exit code and the last lines of its output in the report — the only failures allowed are this task's new red test(s); everything that passed before must still pass: ${list}.`,
      naFinish: (slug, list) => `Project checks are configured (${list}): finishing needs a passing run of each since the last task activity — dev-spec finish ${slug} --run runs and records them (or run them and record each with spec_finish {evidence: [{name, command, exitCode, summary}]}).`,
      recorded: (n) => `Recorded ${n} project check run(s) in .state.json → finishChecks.`,
      noneToRun: 'no project checks to run (roadmap.json meta.checks) — set them: dev-spec init --check test="npm test" [--check lint="npm run lint"]',
      badArg: (v) => `--check expects name=command (got '${v}') — an empty command (name=) removes that check`,
      posixOnWindows: (name, cmd, kinds) => `the project check '${name}' (\`${cmd}\`) uses POSIX shell syntax (${kinds.map((k) => ({ "single-quotes": "single quotes '…'", variable: "$VARIABLES" })[k] || k).join(", ")}) that cmd.exe — the default shell of --run on Windows — reads differently, often without failing. Nothing was run. Re-run with --shell bash (Git Bash; or set DEV_SPEC_SHELL=bash) — or --shell cmd to run it under cmd.exe anyway.`,
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
      noGit: "git is not available here, or this is not a git repository with commits — dev-spec log reads `git log`. Or pipe a log in: git log --name-only --relative | dev-spec log <feature> -",
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
      head: "dev-spec evidence gate: your last message says the work is done or verified, but tasks are ticked without verification evidence:",
      headSuite: "dev-spec evidence gate: your last message says the work is done or verified, but the project checks have no passing run since the last task activity:",
      taskLine: (slug, list) => `  - ${slug}: ${list}`,
      suiteLine: (slug, list) => `  - ${slug}: project checks without a passing run since the last task activity: ${list}`,
      more: (n) => `+${n} more`,
      todoTasks: (slug, n) => `Record the evidence before claiming it: read each listed task's _Verify:_ command in .specs/${slug}/tasks.md (task ${n} first), run it on the final code only if it is safe to run, and record that run with spec_complete_task {name, number, evidence: {command, exitCode, summary}}.`,
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
      // `dev-spec stop-check` when nothing is sent back (the why code → one line).
      allow: {
        off: () => "evidence gate: off (roadmap.json meta.stopCheck: false) — nothing checked.",
        "stop-hook-active": () => "evidence gate: this stop was already sent back once (stop_hook_active) — allowed.",
        "no-specs": () => "evidence gate: no dev-spec .specs/ here — nothing to check.",
        "no-claim": () => "evidence gate: the message claims no completion or verification — allowed.",
        admitted: () => "evidence gate: the message says plainly what is not verified (or failing) — allowed.",
        "no-recent": (i) => `evidence gate: no feature was active in the last ${i.hours} h (a task ticked, evidence recorded or tasks.md edited) — allowed.`,
        verified: (i) => `evidence gate: every ticked task of the recently active features has passing evidence (${i.list}) — allowed.`,
        "not-done": () => "evidence gate: the implementer reports BLOCKED / NEEDS_CONTEXT — allowed.",
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
      ask: (file, features, hint) => `dev-spec guard (scope): ${file} is not in the plan — no open task of ${features} names it in _Implements:_. ${hint} (Guard mode is scope — dev-spec init --guard on allows every code file while tasks are approved; --guard off disables it.)`,
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
        missing: (slug) => `spike.md is missing — scaffold it again: dev-spec spike "${slug}" (create-only: what exists is kept).`,
        fillQuestion: (slug) => `Write the question this spike answers (and its timebox) in spike.md → Question / Timebox — /spec-spike ${slug}.`,
        investigate: (n, text, slug) => `Investigate — task #${n}: ${text}. Prototype code stays outside .specs/ (link it under spike.md → Evidence); tick it: dev-spec done ${slug} ${n}.`,
        decide: (slug) => `Record the decision in spike.md → Decision — go / no-go / pivot, the rationale and its _Outcome:_ line — and log it: /spec-decide ${slug} (spec_decide).`,
        outcome: (slug) => `State the outcome in spike.md → Decision: a line _Outcome: go_, _Outcome: no-go_ or _Outcome: pivot_ (/spec-spike ${slug}).`,
        timeboxPassed: (d) => `The timebox ended on ${d}: decide with the evidence you have.`,
        goCreateFirst: (slug, name, summary) => `Decision: go. Spec the real feature — spec_create {name: "${name}", summary: ${JSON.stringify(summary)}} (dev-spec create "${name}" --summary ${JSON.stringify(summary)}) — then archive the spike: /feature archive ${slug}.`,
        goArchiveFirst: (slug, name, summary) => `Decision: go. Archive the spike first — /feature archive ${slug} (it frees the name) — then spec the real feature: spec_create {name: "${name}", summary: ${JSON.stringify(summary)}} (dev-spec create "${name}" --summary ${JSON.stringify(summary)}).`,
        noGo: (slug, reason) => `Decision: no-go${reason ? ` — ${reason}` : ""}. Archive the spike with its reason (it stays in spike.md → Decision): /feature archive ${slug}.`,
        pivot: (slug, reason) => `Decision: pivot${reason ? ` — ${reason}` : ""}. Start a new spike for the new direction (dev-spec spike "<new question>") — or spec the feature if the answer is already clear — then archive this one: /feature archive ${slug}.`,
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
      required: (slug, known) => `flow required — one of: ${known} (spec_feature {action: "flow", name: "${slug}", flow}; CLI: dev-spec feature flow ${slug} <flow>).`,
      kindRefused: (slug, kind) => `'${slug}' is a ${kind}: it follows its own fixed phase order — the flow applies to features only.`,
      kindIgnored: (kind) => `flow ignored: a ${kind} follows its own fixed phase order (the flow applies to features only).`,
      kept: (slug, cur, asked) => `flow kept: '${slug}' follows ${cur} (asked: ${asked}) — change it with spec_feature {action: "flow"} (CLI: dev-spec feature flow ${slug} ${asked}).`,
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
  },

  pt: {
    initNote: "Os stubs são placeholders. A skill preenche-os com conteúdo real (ver references/steering-templates.md).",
    createNote: () => null,
    addTrackNote: (tr, slug) => `+${tr} adicionado. Preenche as novas secções de design e volta a correr /spec-doctor ${slug}.`,
    addTrackAlready: (tr) => `já tem +${tr}`,
    notes: {
      scan: "Apenas um inventário heurístico — o agente interpreta-o para inferir o steering/constituição e fazer engenharia reversa das specs.",
      coverage: "Heurística a partir da intenção declarada: a parte dos ficheiros de código (sem os testes) nomeados por um marcador _Implements:_ de alguma feature, ativa ou arquivada. Um ficheiro conta como coberto quando uma tarefa o reclama — mantém os _Implements:_ atualizados.",
    },
    evidence: {
      failed: (n, code) => `Tarefa ${n}: a verificação falhou (exit ${code}) — não a marco como feita.`,
      missing: (n, slug) => `A tarefa ${n} tem um comando _Verify:_ mas não foi registada evidência — passa a evidência (comando, exit code, resumo) ou corre: dev-spec done ${slug} ${n} --run`,
      ran: (cmd, code) => `corrido: ${cmd} → exit ${code}`,
      failedTicked: (n, code) => `A tarefa ${n} já está marcada, mas a nova verificação falhou (exit ${code}) — ficou registado; passa a contar como não verificada até se registar uma execução com sucesso.`,
      badExit: (v) => `O exitCode tem de ser um inteiro (recebido '${v}').`,
      needsExit: "Uma evidência que indica um comando precisa do exit code — ou dá só um resumo, para uma verificação manual.",
    },
    finish: {
      ready: (slug) => `'${slug}' está pronta para fechar — confirma as verificações abaixo e depois faz merge local ou mantém o branch.`,
      notReady: (slug) => `'${slug}' ainda não está pronta para fechar:`,
      doctor: (ids) => `o doctor tem verificações bloqueantes: ${ids}`,
      open: (list) => `tarefas por fazer: ${list}`,
      unverified: (list) => `tarefas marcadas sem evidência de verificação: ${list}`,
      gates: (list) => `fases a aguardar aprovação: ${list}`,
      noTasks: "ainda não há tarefas — divide primeiro o design em tarefas",
      checkSuite: "A suite de testes COMPLETA está verde numa execução nova (cola o comando e o output).",
      checkLoad: "+saas: o teste de carga cumpre o orçamento de desempenho (load-test.md).",
      checkObs: "+saas: observabilidade validada — métricas a ser emitidas, logs visíveis, alertas e dashboard configurados.",
      checkCost: "+ai: o custo real em tokens está a ~20% da projeção do design.",
      checkSafety: "+ai: conjunto adversarial completo corrido, 100% nas categorias críticas de segurança, ~20 outputs revistos por um humano.",
      checkBug: "bugfix: os passos de reprodução do bug.md já não reproduzem o bug.",
      prSummary: "## Resumo",
      prAcs: "## Critérios de aceitação",
      prTasks: "## Tarefas",
      prTests: "## Testes",
      prChecks: "## Verificações antes do merge",
      prSpec: "## Spec",
      prRootCause: "## Causa raiz",
      prFix: "## Correção",
      noEvidence: "sem evidência registada",
      changedByDate: (list, slug) => `avaliado só pela data do ficheiro (aprovado antes das impressões digitais de conteúdo — um clone ou uma cópia repõe as datas, por isso pode nem ser uma edição): ${list} — revê e volta a aprovar para o seguir pelo conteúdo (/approve ${slug} <fase>)`,
      untrackedApproval: (list, slug) => `aprovado antes do registo de alterações — nada do ficheiro aprovado ficou registado, por isso uma edição não pode ser detetada: ${list} — volta a aprovar para o começar a seguir (/approve ${slug} design)`,
    },
    kindKept: (kept, asked) => `Esta feature já é do tipo '${kept}' — mantive-o (pediste '${asked}'). Cria outra para um tipo diferente.`,
    langKept: (kept, asked) => `Esta feature já está em '${kept}' — mantive-a (pediste '${asked}'). Uma feature, uma língua.`,
    err: {
      noUsableName: (name) => `O nome de feature '${name}' não tem caracteres utilizáveis (a-z, 0-9) para nome de pasta.`,
      reserved: (slug) => `'${slug}' é um nome reservado — escolhe outro nome para a feature.`,
      reservedWin: (slug) => `'${slug}' é um nome reservado no Windows — escolhe outro nome para a feature.`,
      notFound: (slug, root) => `Feature '${slug}' não encontrada em ${root}`,
      archivedHint: (slug) => `— está arquivada (.specs/_archive/${slug}): restaura-a primeiro (dev-spec feature restore ${slug}).`,
      invalidJson: (rel, detail) => `${rel} não é JSON válido (${detail}) — corrige-o à mão; não o vou sobrescrever.`,
      tasksMissing: (slug) => `tasks.md não encontrado para '${slug}'`,
      requirementsMissing: (slug) => `requirements.md não encontrado para '${slug}'`,
      taskNotFound: (n) => `Tarefa ${n} não encontrada em tasks.md`,
      featureBusy: (slug, rel) => `Outro processo dev-spec está a atualizar '${slug}' neste momento (${rel || `.specs/${slug}/.lock`}) — nada foi alterado; tenta de novo daqui a pouco. Se nenhum outro editor ou comando dev-spec estiver a correr, apaga esse ficheiro.`,
      roadmapBusy: "Outro processo dev-spec está a atualizar o .specs/roadmap.json neste momento (.specs/.roadmap.lock) — nada foi alterado; tenta de novo daqui a pouco. Se nenhum outro editor ou comando dev-spec estiver a correr, apaga esse ficheiro.",
      folderInUse: (rel) => `A pasta ${rel} está a ser usada por outro programa (um editor, um indexador ou antivírus, um terminal aberto lá dentro) — nada foi movido nem apagado; fecha-o e tenta de novo.`,
      lockStuck: (rel) => `Um lock dev-spec abandonado (${rel}) não pôde ser removido — o ficheiro (ou uma pasta com esse nome) está aberto noutro programa, é só de leitura ou não é um ficheiro. Nada foi alterado. Apaga ${rel} à mão (verifica as permissões) e tenta de novo.`,
      numberInt: "o número tem de ser um inteiro",
      noText: "Nenhum texto fornecido.",
      unknownPhase: (phase, known) => `Fase desconhecida '${phase}'. Conhecidas: ${known}`,
      alreadyArchived: (slug) => `'${slug}' já está arquivada (.specs/_archive/${slug}). Remove-a de lá primeiro.`,
      renameNeedsName: "para renomear é preciso um nome novo.",
      sameSlug: "O nome novo dá o mesmo slug.",
      alreadyExists: (slug) => `'${slug}' já existe.`,
      badAction: "a ação tem de ser: remove | archive | rename | restore | flow",
      badTrack: "o track tem de ser: tdd | saas | ai | sec | privacy | dist",
      cycle: (chain) => `Dependência circular: ${chain}`,
      nameRequired: "o nome é obrigatório",
      noSpecs: (root) => `Não há .specs/ em ${root}`,
      notGenerated: (file) => `${file} existe e não foi gerado pelo dev-spec — não foi alterado.`,
      unknownSteering: (file, known) => `Ficheiro de steering desconhecido '${file}'. Conhecidos: ${known}`,
    },
    ears: {
      needsClar: "Marcador [NEEDS CLARIFICATION] por resolver — resolve-o antes do design.",
      noModal: "O critério não tem verbo modal (SHALL / DEVE / DEBE) — não é uma frase EARS válida.",
      noId: "O critério não tem ID estável (ex.: US-1.AC-1).",
      vague: (term) => `Termo vago '${term}' — substitui-o por um valor concreto e testável.`,
      noKeyword: "Sem palavra-chave EARS (WHEN/WHILE/IF/WHERE · QUANDO/ENQUANTO/SE/ONDE · CUANDO/MIENTRAS/SI/DONDE). Aceitável em requisitos ubíquos; confirma que é intencional.",
    },
    classify: {
      conf: { high: "alta", medium: "média", none: "nenhuma" },
      core: "core: sempre ativo (todas as features em modo Spec).",
      on: (t, conf, list, neg) => `+${t}: ATIVO${conf ? ` [confiança ${conf}]` : ""} — sinais encontrados: ${list}.${neg ? ` (${neg} apareceu negado.)` : ""}`,
      off: (t, neg) => `+${t}: inativo — ${neg ? `${neg} apareceu negado.` : "nenhum sinal encontrado."}`,
      substantial: "Nenhum sinal de track encontrado, mas a descrição é substancial — considera se +tdd se aplica (correção/casos limite).",
      weakOnly: (list) => `Ativo só por sinais fracos — confirma: ${list}.`,
      possible: (t, sig) => `Possível +${t} — sinal fraco '${sig}' (precisa de corroboração; não foi ativado).`,
      keptOff: (t, kw) => `+${t} mantido inativo — '${kw}' apareceu negado.`,
      onAlthough: (t, quoted, list) => `+${t} está ATIVO embora ${quoted} tenha aparecido negado — ativado por: ${list}. Confirma que é intencional.`,
    },
    sectionStatus: { missing: "em falta", unfilled: "por preencher" },
    sectionNames: {
      "Performance Budget": "Orçamento de Desempenho", "Scale Design": "Design de Escala", "Multi-tenancy": "Modelo Multi-inquilino",
      "Observability": "Observabilidade", "Cost Envelope": "Envelope de Custo", "Model Strategy": "Estratégia de Modelo",
      "Prompt Architecture": "Arquitetura de Prompt", "Token Economics": "Economia de Tokens", "Latency Budget": "Orçamento de Latência",
      "Eval Strategy": "Estratégia de Avaliação", "Safety & Abuse": "Segurança e Abuso", "Fallback & Degradation": "Fallback e Degradação",
      "Observability for AI": "Observabilidade de IA", "Model Lifecycle": "Ciclo de Vida do Modelo", "Multi-modality": "Multimodalidade",
    },
    precommit: {
      header: "dev-spec-driven pre-commit:",
      earsErrors: (f, n) => `✗ ${f}: ${n} erro(s) EARS`,
      earsClean: (f, n) => `✓ ${f}: EARS limpo (${n} critérios)`,
      earsWarnings: (f, n, w, p) => `⚠ ${f}: sem erros EARS (${n} critérios), mas ${[w ? `${w} aviso(s)` : null, p ? `${p} placeholder(s) do template por preencher` : null].filter(Boolean).join(" e ")} — não bloqueia`,
      phantom: (f, n, list) => `✗ ${f}: ${n} referência(s) AC/teste fantasma — provavelmente erros de escrita: ${list}`,
      uncovered: (f, n, list) => `⚠ ${f}: ${n} AC(s) sem tarefa (aviso): ${list}`,
      traceClean: (f, n) => `✓ ${f}: rastreabilidade limpa (${n} ACs)`,
      blocked: (n) => `\nCommit bloqueado: ${n} problema(s) bloqueante(s) nos ficheiros de spec em staging. Corrige-os, ou usa 'git commit --no-verify' para passar à frente.`,
    },
    doctor: {
      steeringMissing: (list) => `em falta: ${list}`,
      steeringOk: "steering essencial presente (incl. constituição)",
      requirementsMissing: "requirements.md em falta",
      clarificationsOpen: (n) => `${n} [NEEDS CLARIFICATION] por resolver — resolve antes do design`,
      clarificationsNone: "nenhum por resolver",
      scPresent: "presente",
      scMissing: "sem critérios de sucesso mensuráveis SC-###",
      prioritiesOk: "histórias de utilizador priorizadas",
      prioritiesMissing: "sem prioridade P1 (MVP) numa história de utilizador",
      acDup: (list) => `IDs de AC duplicados: ${list}`,
      acUnique: "IDs de AC únicos",
      earsDetail: (n, e, w) => `critérios=${n}, erros=${e}, avisos=${w}`,
      earsNoCriteria: (ids) => `o requirements.md cita IDs de AC (${ids}) mas nenhum critério foi validado — o EARS valida um AC escrito como item de lista, título ou linha que comece pelo seu ID, ou como linha de tabela sob um título de Critérios de Aceitação`,
      designMissing: "design.md em falta",
      mermaidOk: "tem um diagrama",
      mermaidMissing: "nenhum diagrama mermaid encontrado",
      constitutionOk: "presente — verifica que cada princípio é validado",
      constitutionMissing: "sem secção Verificação da Constituição no design",
      saasAllFilled: "as 5 preenchidas",
      aiAllFilled: "as 10 preenchidas",
      gatesPending: (list) => `a aguardar aprovação humana: ${list} — corre /approve antes de avançar`,
      gatesOk: "todas as fases presentes aprovadas",
      unverified: (list) => `marcadas sem evidência de verificação: ${list}`,
      verifiedOk: "todas as tarefas marcadas com comando _Verify:_ têm evidência",
      rootCauseMissing: "bug.md → Causa Raiz por preencher — nenhuma correção antes de se conhecer a causa",
      rootCauseOk: "causa raiz documentada",
      reproMissing: "bug.md → Reprodução por preencher",
      reproOk: "reprodução documentada",
    },
    next: {
      fixChecks: (ids, slug) => `Corrige as verificações bloqueantes (${ids}) — corre /spec-doctor ${slug} para detalhes.`,
      reReview: (files) => `Nova revisão: ${files} alterado(s) após a última aprovação — volta a aprovar a fase afetada.`,
      approveRequirements: (slug) => `Revê e aprova os requisitos — /approve ${slug} requirements.`,
      approveDesign: (slug) => `Revê e aprova o design — /approve ${slug} design.`,
      approveTasks: (slug) => `Revê e aprova a divisão de tarefas — /approve ${slug} tasks.`,
      approveTestPlan: (slug) => `Revê e aprova o plano de testes — /approve ${slug} test-plan.`,
      approveEvalPlan: (slug) => `Revê e aprova o plano de evals — /approve ${slug} eval-plan.`,
      approveBugDesign: (slug) => `Revê e aprova o bug.md (Reprodução + Causa Raiz — o design de um bugfix) — /approve ${slug} design.`,
      signOffTests: (slug, what) => `Aprovação da Fase 4: a implementação já começou, por isso os testes já não se escrevem primeiro — ${({ tdd: "confirma que cada teste planeado existe com o seu T-ID no nome do teste (test(\"T-01 …\")) para que o tests-in-code o encontre", ai: `confirma que o conjunto de evals é o da própria feature e regista a baseline (/eval ${slug} --set-baseline)`, both: `confirma que cada teste planeado existe com o seu T-ID no nome do teste (test("T-01 …")) e que o conjunto de evals é o da própria feature, e regista a baseline (/eval ${slug} --set-baseline)` })[what]}. Depois aprova — /approve ${slug} tests.`,
      approveTests: (slug, what) => `Fase 4, o gate rígido: ${({ tdd: "escreve todos os testes planeados e confirma que cada um falha pela razão certa", ai: "escreve os testes determinísticos e o harness de evals, e regista a baseline", both: "escreve todos os testes planeados (cada um a falhar pela razão certa) e o harness de evals, e regista a baseline" })[what]} — /writeTests ${slug}; nenhum código de implementação antes disso. Depois aprova — /approve ${slug} tests.`,
      implement: (n, text, slug) => `Implementa a tarefa #${n}: ${text} — /executeTask ${slug}.`,
      allDone: (slug) => `Todas as tarefas feitas — fecha a feature com /spec-finish ${slug} (spec_finish): relatório de prontidão + resumo do merge.`,
      breakIntoTasks: (slug) => `Divide o design em tarefas — /createTask ${slug}.`,
      drifted: (slug, day, n, total, files) => `'${slug}' foi fechada a ${day}, mas ${n} de ${total} ficheiro(s) de implementação mudaram desde então: ${files} (dev-spec drift ${slug}). Decide: a spec está agora errada → /spec-impact ${slug} (ou uma feature nova com _Supersedes:_); o código está errado → corrige-o (/spec-bugfix); inofensivo → volta a correr /spec-finish ${slug} para uma baseline nova.`,
      finished: (slug, day, total, signOff) => `'${slug}' está fechada (${day}) — os ${total} ficheiro(s) de implementação não mudaram desde então.` +
        (!signOff ? ` Nada mais a fazer aqui — /spec-drift ${slug} verifica-a depois de alterações futuras.`
          : signOff.why ? ` A aprovação final (execution, ${signOff.at}) foi registada antes destas alterações: ${signOff.why} — volta a confirmá-la: /approve ${slug} execution${signOff.role ? " --role " + signOff.role : ""}.`
            : ` Falta a aprovação final${signOff.missing ? ` — ${signOff.missing}${signOff.signed ? ` (já validaram: ${signOff.signed})` : ""}` : ""}: /approve ${slug} execution${signOff.role ? " --role " + signOff.role : ""}.`),
      verifySuite: (slug, list) => `'${slug}' está fechada, mas as verificações do projeto não têm uma execução bem-sucedida desde a última atividade nas tarefas: ${list} — o /spec-finish recusa e o gate de fim de turno devolve um "feito" até passarem. Corre-as e regista as execuções: dev-spec finish ${slug} --run (ou spec_finish {evidence: [{name, command, exitCode}]}).`,
      verifyDuplicate: (slug, list, n) => `Todas as tarefas estão marcadas, mas nem todas estão verificadas: ${list} — há duas tarefas com o número ${n}, por isso uma execução registada para a #${n} só chega à primeira (dev-spec done ${slug} ${n} responde por ela). Renumera as tarefas em .specs/${slug}/tasks.md para que cada número seja único (doctor: duplicate-tasks), volta a aprovar a fase tasks (/approve ${slug} tasks) e regista depois a execução de cada tarefa renumerada.`,
      signOffWhy: { approvals: (list) => `aprovação de ${list}`, changeRequests: (list) => `pedido de alteração ${list}`, join: "; " },
      refinish: (slug, day, why) => `'${slug}' foi fechada a ${day}, mas mudou desde então (${why}) e as tarefas estão todas feitas — volta a fechá-la: /spec-finish ${slug} (spec_finish {write: true}) renova o relatório de prontidão, o resumo do merge e a baseline de drift; depois volta a dar a aprovação final: /approve ${slug} execution.`,
      driftedStale: (why) => `Também mudou desde esse fecho (${why}): decidas o que decidires, volta a fechá-la depois — /spec-finish (spec_finish {write: true}) regista a baseline nova.`,
      verify: (slug, list, n, runnable) => `Todas as tarefas estão marcadas, mas nem todas estão verificadas: ${list} — o /spec-finish e a aprovação final recusam até cada uma ter uma execução com sucesso. ` +
        (runnable ? `Volta a correr o comando _Verify:_ da tarefa ${n} e regista o resultado: dev-spec done ${slug} ${n} --run` : `Regista uma execução com sucesso da tarefa ${n}: spec_complete_task {name: "${slug}", number: ${n}, evidence: {command, exitCode: 0}} (dev-spec done ${slug} ${n} --cmd "<comando>" --exit 0)`) +
        "; uma execução que falha quer dizer que o código tem de ser corrigido primeiro.",
    },
    clarify: {
      resolveMarker: (mk) => "Resolve [NEEDS CLARIFICATION]: " + (mk || "(não especificado)"),
      addSuccessCriteria: "Adiciona uma secção Critérios de Sucesso com resultados mensuráveis e agnósticos à tecnologia (SC-001 …).",
      idSuccessCriteria: "Dá a cada critério de sucesso um ID estável (SC-001 …) e um alvo mensurável.",
      prioritize: "Prioriza as histórias de utilizador (P1 = a fatia MVP que entrega valor sozinha; P2/P3 incrementais).",
      independentTest: "Indica como cada história de utilizador pode ser testada de forma independente (para ser lançável por si só).",
      quantifyVague: (line, text) => `Quantifica o termo vago na linha ${line}: ${text}`,
      edgeCases: "Lista os casos limite e o comportamento de tratamento de erros (cada um como um AC SE…ENTÃO).",
      outOfScope: "Indica explicitamente o que está FORA de âmbito.",
      nfr: "Especifica os requisitos não-funcionais (desempenho / segurança / acessibilidade) com alvos mensuráveis.",
      unwanted: "Adiciona critérios de comportamento indesejado (SE…ENTÃO / IF…THEN / SI…ENTONCES) para os caminhos de falha.",
      tenant: "Especifica o isolamento de inquilino: o inquilino A nunca pode ler/escrever dados do inquilino B (escreve-o como um AC).",
      rateLimit: "Especifica os limites de taxa (por utilizador / por inquilino / global).",
      aiQuality: "Especifica o alvo de qualidade de output e o comportamento de recusa para o caminho de IA.",
      aiCost: "Especifica um teto de custo por pedido ($/tokens).",
    },
    hook: {
      earsClean: (n) => `Verificação EARS: ${n} critérios, tudo limpo ✓`,
      earsIssues: (errs, warns, top, hasErr) =>
        `Verificação EARS em requirements.md — ${errs} erro(s), ${warns} aviso(s):\n${top}` + (hasErr ? "\nCorrige os erros antes de avançar para o design." : ""),
      traceOk: (n) => `Rastreabilidade: todos os ${n} ACs cobertos por tarefas ✓`,
      traceGaps: (feature, parts) => `Lacunas de rastreabilidade em ${feature}:\n  - ${parts}`,
      roadmapUpdated: (pct, complete, total) => `Roadmap atualizado → ${pct}% (${complete}/${total} features).`,
      sessionHeader: "dev-spec-driven — features em .specs/:",
      sessionLine: (name, tracks, phase, done, total) => `  • ${name} [${tracks}] — ${phase} (${done}/${total} tarefas)`,
      sessionMore: (n) => `  … +${n} feature(s) — /spec-status (ou dev-spec list) mostra todas`,
    },

    evidenceGate: {
      noContent: "A evidência precisa de um comando (com o exit code) ou de um resumo — um exit code sozinho não prova nada.",
      manualOnRunnable: (n, slug) => `Tarefa ${n}: ficou registada uma nota, mas o comando _Verify:_ não foi corrido — continua não verificada até se registar uma execução com sucesso: dev-spec done ${slug} ${n} --run`,
      redPhaseTestWord: "o teste",
      redPhaseVerify: (n, slug, test) => `A tarefa ${n} escreve um teste que tem de FALHAR (a fase vermelha), por isso um _Verify:_ que tem de passar nunca passa nela. Marca a tarefa ${n} com _Expect: fail_ — uma execução que FALHE passa a ser a prova (${test} falha antes da correção) e uma que passe é recusada: dev-spec done ${slug} ${n} --run. Ou passa o comando para a tarefa que o põe a verde (a correção — o _Verify:_ dela prova então a correção).`,
      failedRun: (n, code, slug, runnable) => `Tarefa ${n}: a última execução registada falhou (exit ${code}) — uma nota não muda isso; continua não verificada até se registar uma execução com sucesso ` +
        (runnable ? `do comando _Verify:_: dev-spec done ${slug} ${n} --run` : "(um comando com exit code 0)."),
      duplicateNumber: (n) => `Tarefa ${n}: outra tarefa também usa o número ${n} e a evidência registada é dessa — esta continua não verificada; renumera as tarefas e depois regista a evidência desta.`,
      staleEvidence: (n, slug, runnable) => `Tarefa ${n}: a evidência registada é de outra tarefa ou de um comando _Verify:_ anterior — continua não verificada até se registar ` +
        (runnable ? `uma execução desta: dev-spec done ${slug} ${n} --run` : "a evidência desta."),
      reason: { "no-evidence": "sem evidência", "failed-run": "a última execução falhou", "manual-note-on-runnable-verify": "só uma nota, comando _Verify:_ por correr", "duplicate-number": "número partilhado com outra tarefa",
        "stale-evidence": "evidência de outra tarefa ou de outro comando _Verify:_",
        "unexpected-pass": "a execução passou, mas o _Expect: fail_ precisa de uma execução vermelha",
        unobserved: "execução não observada pelo harness" },
      duplicateTasks: (list) => `números de tarefa repetidos: ${list} — o complete/brief escolhem a primeira por fazer; renumera-as`,
    },
    observed: {
      on: "Modo de evidência OBSERVADO — uma tarefa cujo _Verify:_ tem um comando só fica verificada com uma execução com sucesso que o harness viu (no Claude Code, o hook de observação do plugin guarda cada execução Bash de um comando _Verify:_ ou de uma verificação do projeto) ou que o dev-spec done --run / finish --run fez; a execução de uma verificação do projeto também (roadmap.json meta.evidence). Um cliente só MCP não tem esse hook: regista as execuções dele com dev-spec done <feature> <n> --run.",
      off: "Modo de evidência REPORTADO — as execuções que um agente reporta verificam tal como são dadas (roadmap.json meta.evidence); cada registo continua a dizer se o harness a observou.",
      badValue: (v) => `--evidence aceita reported ou observed (recebido '${v}').`,
      badInput: (v) => `evidence tem de ser "reported" ou "observed" (recebido '${v}').`,
      unobservedRedNote: (n, slug) => `A tarefa ${n} está marcada _Expect: fail_: a sua prova é a execução VERMELHA, e o harness nunca a viu — este projeto só verifica execuções observadas (roadmap.json meta.evidence: observed). Refaz a execução vermelha onde seja observada: põe a correção de lado (git stash), corre o comando _Verify:_ com a ferramenta Bash no Claude Code ou com dev-spec done ${slug} ${n} --run (tem de falhar), depois repõe a correção e regista a execução bem-sucedida.`,
      unobservedNote: (n, slug) => `Tarefa ${n}: a execução ficou registada, mas o harness nunca a viu — este projeto só verifica um comando _Verify:_ com uma execução observada (roadmap.json meta.evidence: observed). Corre o comando com a ferramenta Bash no Claude Code e volta a registá-lo, ou deixa a CLI corrê-lo: dev-spec done ${slug} ${n} --run`,
      neverObserved: "Nenhuma execução foi alguma vez observada neste projeto: só o Claude Code com o plugin dev-spec-driven as guarda (hooks/observe-hook.js) — um cliente só MCP não tem hook: regista as execuções com dev-spec done <feature> <n> --run (ou volta atrás: dev-spec init --evidence reported).",
      naHint: "Este projeto só verifica execuções que o harness viu (roadmap.json meta.evidence: observed): corre o comando com a ferramenta Bash no Claude Code, ou pela CLI (--run).",
    },
    taskDone: {
      done: (n, verified, done, total) => `Tarefa ${n} feita${verified ? " (verificada)" : ""}. ${done}/${total}`,
      already: (n, verified, done, total) => `A tarefa ${n} já estava feita${verified ? " (verificada)" : ""}. ${done}/${total}`,
      next: (n, text) => `  próxima → #${n} ${text}`,
      allDone: "  — tudo feito ✓",
      numberInt: "o número da tarefa tem de ser um inteiro",
      noRunnable: (n) => `a tarefa ${n} não tem um marcador _Verify: <comando>_ executável`,
      shellHint: "Dica: a shell por omissão do Windows (cmd.exe) não conseguiu correr esta linha de comando tal como está escrita. Se o comando _Verify:_ foi escrito para uma shell POSIX, tenta de novo com --shell bash (ou define DEV_SPEC_SHELL=bash).",
      posixOnWindows: (cmd, kinds) => `o comando _Verify:_ \`${cmd}\` usa sintaxe de shell POSIX (${kinds.map((k) => ({ "single-quotes": "plicas '…'", variable: "$VARIAVEIS" })[k] || k).join(", ")}) que o cmd.exe — a shell por omissão do --run no Windows — lê de outra forma, muitas vezes sem falhar: não tem plicas e nunca expande $VAR, por isso uma verificação partida podia ficar registada como execução bem-sucedida. Nada foi executado; a tarefa continua aberta. Corre de novo com --shell bash (Git Bash; ou define DEV_SPEC_SHELL=bash) — ou --shell cmd para o correr mesmo assim no cmd.exe.`,
    },

    tracks: {
      unknown: (items, valid) => `Track${items.length > 1 ? "s" : ""} desconhecido${items.length > 1 ? "s" : ""}: ${items.map((u) => `'${u.token}'` + (u.suggestion ? ` (querias dizer '${u.suggestion}'?)` : "")).join(", ")}. Tracks válidos: ${valid}.`,
      cannotRemoveCore: "O 'core' está sempre ativo — não pode ser removido.",
      bugfixNeedsTdd: "Um bugfix é sempre test-first — não se pode remover o +tdd.",
      notActive: (list) => `Não ativo: ${list} — nada a remover.`,
      removed: (list, slug) => `Tracks desativados: ${list}. Nenhum ficheiro foi apagado — os artefactos inativos ficam no sítio e voltam a contar se voltares a adicionar o track. Volta a correr /spec-doctor ${slug}.`,
      addedOnCreate: (slug, list) => `'${slug}' já existia — tracks adicionados: ${list} (artefactos, secções de design, steering, tarefas) — nada foi substituído.`,
      designTitle: (name) => `# Design: ${name}`,
      acPlaceholder: (tr) => `[o critério +${tr} que esta tarefa prova]`,
      designSections: (marker) => `design.md (secções ${marker})`,
      addedDesign: "design.md (+secções)",
      addedTasks: "tasks.md (+tarefas)",
      addedActiveTracks: "classification.md (Tracks Ativos)",
      taskBlock: (track, start) => BUILD.pt.trackTasks({ track, start }),
    },

    args: {
      missing: (list) => `Argumento(s) obrigatório(s) em falta: ${list}`,
      invalid: (list) => `Argumento(s) inválido(s): ${list}`,
      item: (arg, expected, got) => `${arg} tem de ser ${expected} (recebido: ${got})`,
      type: { string: "uma string", integer: "um inteiro", number: "um número", boolean: "um booleano (true/false)", array: "um array", object: "um objeto", null: "null" },
      arrayOf: (t) => `um array (cada item ${t})`,
      oneOf: (list) => `um de: ${list}`,
      atLeast: (n) => `≥ ${n}`,
      notObject: "arguments tem de ser um objeto JSON.",
      dotdot: "projectDir não pode conter segmentos de caminho '..'.",
      network: (dir) => `projectDir tem de ser uma pasta local — um caminho de rede ou de dispositivo (${dir}) é recusado, para que uma chamada de ferramenta nunca aponte este servidor local para outra máquina; abre o projeto localmente (ou arranca o servidor com ele como pasta de trabalho).`,
      unknownTool: (name) => `Ferramenta desconhecida: ${name} — tools/list lista as ferramentas deste servidor.`,
      noTool: "tools/call precisa de params.name (o nome da ferramenta — ver tools/list).",
    },
    jsonShape: {
      invalid: (rel, detail) => `${rel} tem uma estrutura inesperada (${detail}) — corrige-o à mão; não o vou sobrescrever.`,
      topLevel: "o nível de topo tem de ser um objeto",
      features: "'features' tem de ser um objeto",
      featureEntry: (k) => `features.${k} tem de ser um objeto`,
      dependsOn: (k) => `features.${k}.dependsOn tem de ser um array de nomes de features`,
      meta: "'meta' tem de ser um objeto",
      backlog: "'backlog' tem de ser um array",
      backlogEntry: "cada entrada de 'backlog' tem de ser um objeto com 'name'",
      approvals: "'approvals' tem de ser um objeto",
      evidence: "'evidence' tem de ser um objeto",
      tracks: "'tracks' tem de ser um array",
      approvalHistory: "'approvalHistory' tem de ser um array",
      changes: "'changes' tem de ser um array",
      finishChecks: "'finishChecks' tem de ser um objeto",
      signoffs: "'signoffs' tem de ser um objeto",
      unticks: "'unticks' tem de ser um array",
    },
    depend: {
      unknown: (list) => `Cada dependência tem de ser uma feature existente — não encontrada(s): ${list}`,
      orderInt: (v) => `order tem de ser um inteiro (recebido: '${v}').`,
    },
    evals: {
      usage: "Uso: node run-evals.js <feature> [--dry-run] [--set-baseline] [--require-live] [--model=ID] [--project=DIR] [--max-items=N]",
      noEvalsDir: (slug, dir) => `Sem pasta evals/ para '${slug}' em ${dir}`,
      requireLive: "harness de evals: a ANTHROPIC_API_KEY não está definida e foi pedido --require-live — recuso fazer um dry run em alternativa.",
      header: (slug) => `dev-spec-driven evals — feature '${slug}'`,
      config: (model, prompt, mode) => `  modelo: ${model}   prompt: ${prompt}   modo: ${mode}`,
      none: "(nenhum)",
      modeDry: "DRY-RUN (sem chamadas ao modelo)",
      modeLive: "REAL",
      noKey: "  (ANTHROPIC_API_KEY não definida — a correr a seco. Define-a para uma execução real.)",
      badJson: (set, err) => `  ✗ ${set}.json — JSON inválido: ${err}`,
      badItems: (set) => `  ✗ ${set}.json — 'items' tem de ser um array`,
      emptySet: (set) => `  ✗ ${set}.json — sem itens para avaliar: um conjunto que não avalia nada não pode passar — acrescenta itens de eval (evals/README.md) ou apaga o ficheiro`,
      badItem: (set, label, why) => `  ✗ ${set}.json — item ${label}: ${why}`,
      moreBad: (n) => `      … +${n} item(s) inválido(s)`,
      itemWhy: {
        notObject: "não é um objeto",
        noId: "sem 'id' (texto não vazio)",
        noInput: "sem 'input' (texto não vazio)",
        noExpect: "sem objeto 'expect'",
        unknownType: (t, types) => `tipo de avaliador desconhecido '${t}' (usa ${types})`,
        noValue: (t) => `'${t}' precisa de um 'value'`,
        badRegex: (msg) => `a regex não compila: ${msg}`,
        noRubric: "'judge' precisa de uma 'rubric'",
      },
      badThresholds: (why) => `  ✗ thresholds.json — ${why}`,
      thresholdsShape: "tem de ser um objeto que dá a cada conjunto (golden / adversarial / regression) um número entre 0 e 1",
      capped: (set, max, total) => `  ⚠ ${set}: limitado a ${max}/${total} itens (aumenta com --max-items=N)`,
      wouldRun: (set, n, kinds) => `  • ${set}: ${n} item(ns) — correria ${kinds}`,
      score: (ok, set, pass, n, pct, thr) => `  ${ok ? "✓" : "✗"} ${set}: ${pass}/${n} = ${pct}% (limiar ${thr}%)`,
      failure: (id, detail) => `      - ${id}: ${detail}`,
      error: (msg) => `ERRO ${msg}`,
      resp: (sample) => ` | resposta: ${sample}`,
      fail: "falhou",
      judge: "juiz",
      judgeSkipped: "juiz não usado (heurística aplicada)",
      unknownGrader: (t) => `avaliador desconhecido '${t}'`,
      vsBaseline: "\n  vs baseline:",
      delta: (set, base, cur, sign, pp) => `    ${set}: ${base}% → ${cur}% (${sign}${pp}pp)`,
      baselineWritten: (rel) => `\n  baseline gravada → ${rel}`,
      tokens: (i, o) => `\n  tokens: ${i} de entrada / ${o} de saída`,
      dryInvalid: "\nO dry run encontrou conjunto(s) de evals inválido(s) — corrige-os antes de uma execução real.",
      liveInvalid: "\nConjunto(s) de evals inválido(s) — corrige-os primeiro; nenhum modelo foi chamado.",
      dryOk: "\nDry run concluído — os conjuntos são válidos. Define a ANTHROPIC_API_KEY e volta a correr para obter resultados reais.",
      verdict: (below) => `\nVeredicto: ${below ? "ABAIXO DO LIMIAR ✗" : "todos os conjuntos passam ✓"}`,
      crashed: (msg) => `erro no harness de evals: ${msg}`,
    },

    traceGapText: {
      kinds: {
        uncoveredByTasks: "ACs sem tarefa",
        phantomAcsInTasks: "tarefas referem ACs desconhecidos (erros de escrita?)",
        uncoveredByTests: "ACs sem teste planeado",
        phantomAcsInTests: "o plano de testes cobre ACs desconhecidos (erros de escrita?)",
        phantomTestsInTasks: "tarefas referem testes desconhecidos (erros de escrita?)",
        testsNotMappedToTasks: "testes planeados que nenhuma tarefa põe a verde",
        missingImplFiles: "ficheiros _Implements:_ que não existem",
      },
      gap: (label, list) => `${label}: ${list}`,
      allCovered: (n) => `todos os ${n} ACs cobertos por tarefas`,
      removedKinds: {
        phantomAcsInTasks: "tarefas ainda citam ACs que um pedido de alteração removeu (apaga ou atualiza essas tarefas — não é erro de escrita)",
        phantomAcsInTests: "o plano de testes ainda cobre ACs que um pedido de alteração removeu (apaga ou atualiza essas linhas — não é erro de escrita)",
      },
      removedRef: (id, n) => `${id} (pedido de alteração #${n})`,
    },
    phaseNames: {
      complete: "concluída", executing: "em execução", "tasks-ready": "tarefas prontas", "eval-plan": "plano de evals", "test-plan": "plano de testes",
      design: "design", requirements: "requisitos", classified: "classificada", empty: "vazia",
    },
    featureOps: {
      removeNeedsConfirm: (slug, n) => `Remover '${slug}' apaga .specs/${slug}/ de vez (${n} ficheiro(s)). Nada foi apagado — passa confirm: true para a apagar, ou arquiva-a (reversível).`,
      backlogNotFound: (name, known) => `'${name}' não está no backlog${known ? ` (backlog: ${known})` : " (o backlog está vazio)"}.`,
      backlogIsFeature: (name, slug) => `'${name}' já tem uma spec (.specs/${slug}/) — o backlog é para features ainda sem spec (estado: dev-spec status ${slug}).`,
    },
    cliOutput: {
      words: { pass: "ok", warn: "aviso", fail: "falha", "gaps-found": "com lacunas", clear: "clara", "needs-clarification": "precisa de clarificação", error: "erro" },
      yes: "sim", no: "não",
      tracks: (label, conf) => `Tracks: ${label}   confiança: ${conf}`,
      note: (n) => `\nNota: ${n}`,
      created: (dir, lang, files, kept) => `Criado em ${dir} [${lang}]:\n  ${files}` + (kept ? `\n  (já existiam, mantidos: ${kept})` : ""),
      nothingNew: "(nada de novo)",
      steeringCreated: (f) => `Criado ${f}`,
      steeringExists: (f) => `Já existe (não foi alterado) ${f}`,
      feature: (slug, label, lang) => `Feature '${slug}' [${label}] (${lang})`,
      noFeatures: (dir) => `Não há features em ${dir}`,
      listLine: (name, tracks, phase, done, total) => `  ${name.padEnd(28)} [${tracks}]  ${phase}  (${done}/${total} tarefas)`,
      statusHead: (f, tracks, phase) => `Feature: ${f}  [${tracks}]  fase: ${phase}`,
      statusTasks: (done, total, next) => `Tarefas: ${done}/${total}` + (next ? `  próxima → ${next}` : ""),
      doctorHead: (f, tracks, verdict, ready) => `Diagnóstico: ${f}  [${tracks}]  veredicto=${verdict}  pronta para avançar: ${ready}`,
      traceHead: (f, verdict, acs, covered) => `Rastreabilidade: ${f}  veredicto=${verdict}  ACs=${acs}  cobertos por tarefas=${covered}`,
      earsHead: (n, m, verdict) => `EARS: ${n} critérios, ${m} com verbo modal, veredicto=${verdict}`,
      next: (n, text, left, total) => `Próxima → #${n} ${text}  (faltam ${left}/${total})`,
      allDone: "Todas as tarefas feitas ✓",
      batch: (list) => `  lote paralelo: ${list}`,
      mergeSummaryAt: (p) => `\nResumo do merge → ${p}`,
      briefAt: (p, inline) => `Brief → ${p}` + (inline ? "  (só inline: tarefa de prompt +ai)" : ""),
      reportAt: (p) => `  relatório → ${p}`,
      ledgerAt: (p) => `  ledger → ${p}`,
      unresolved: (list) => `  ⚠ por resolver: ${list}`,
      approved: (phase, f) => `Fase '${phase}' de ${f} aprovada ✓`,
      backlogHead: (n) => `Backlog (${n}):`,
      backlogAdded: (name) => `✓ '${name}' adicionada ao backlog`,
      backlogRemoved: (name) => `✓ '${name}' removida do backlog`,
      wrote: (file, pct, c, t) => `✎ gerado ${file}` + (pct != null ? `  (${pct}%, ${c}/${t})` : ""),
      noRoadmapFeatures: (dir) => `Ainda não há features em ${dir}`,
      roadmapHead: (pct, c, t, cycle) => `Roadmap — progresso global ${pct}%  (${c}/${t} completas)` + (cycle ? `  ⚠ CICLO: ${cycle}` : ""),
      deps: (list, unmet) => `  deps: ${list}` + (unmet ? ` (por cumprir: ${unmet})` : ""),
      scanHead: (root, truncated) => `Análise de ${root}` + (truncated ? " (truncada no limite)" : ""),
      scanFiles: (n, stack) => `  ficheiros: ${n}  | stack: ${stack || "desconhecida"}`,
      scanDirs: (list) => `  pastas de topo: ${list}`,
      scanExt: (list) => `  por extensão: ${list}`,
      scanEndpoints: (n, files) => `  endpoints: ${n} rota(s) em ${files} ficheiro(s)`,
      coverage: (pct, d, t) => `Cobertura de specs: ${pct}%  (${d}/${t} ficheiros de código nomeados em _Implements:_)`,
      undocumented: (list) => `  pastas sem cobertura: ${list}`,
      clarify: (f, tracks, verdict, n) => `Clarificar: ${f}  [${tracks}]  → ${verdict} (${n} pergunta(s))`,
      naHead: (f, tracks, phase, verdict, gatesOk) => `Feature: ${f}  [${tracks}]  fase: ${phase}  veredicto=${verdict}  gates aprovados: ${gatesOk}`,
      changed: (list) => `  ⚠ alterado desde a última aprovação: ${list}`,
      renamed: (a, b) => `'${a}' renomeada → '${b}' ✓`,
      archived: (f, dest) => `'${f}' arquivada → .specs/${dest} ✓`,
      removed: (f) => `'${f}' removida ✓`,
      wouldRemove: (slug, dir, n, entries) => `Isto apagaria '${slug}' de vez: ${dir} (${n} ficheiro(s): ${entries})`,
      confirmHint: (slug) => `Nada foi apagado. Volta a correr com --yes para confirmar — ou arquiva-a: dev-spec feature archive ${slug}`,
      missingValue: (flag) => `falta o valor de --${flag}`,
      unknownFlag: (flag, suggestion) => `opção desconhecida ${flag}` + (suggestion ? ` — será ${suggestion}?` : ".") + " As opções estão em `dev-spec help`.",
      unknownRules: (tool, known) => `ferramenta desconhecida '${tool}'. Conhecidas: ${known}`,
      scaleSections: (list) => `Secções de escala: ${list}`,
      aiSections: (list) => `Secções de IA: ${list}`,
      dependsOn: (f, deps, order, unknown) => `${f} depende de: ${deps || "(nenhuma)"}` + (order != null ? `  ordem=${order}` : "") + (unknown ? `  ⚠ dependências desconhecidas: ${unknown}` : ""),
      trackNow: (f, tracks) => `'${f}' agora [${tracks}]`,
      usage: (syntax) => `uso: ${syntax}`,
      unknownCommand: (c) => `comando desconhecido '${c}'. Corre \`dev-spec help\`.`,
      unknownClient: (c, known) => `cliente desconhecido '${c}'. Conhecidos: ${known}`,
    },

    gates: {
      empty: "sem conteúdo além dos títulos",
      more: (n) => `+${n} a mais`,
      placeholdersNone: "nenhum placeholder do template na fase atual",
      placeholdersFail: (list) => `placeholders do template por preencher na fase atual (ou numa anterior): ${list}`,
      placeholdersLater: (list) => `as fases seguintes ainda são template (ainda não bloqueia): ${list}`,
      traceDeferred: (files) => `ainda não rastreado — ainda é o template de uma fase seguinte: ${files} (as referências do template não são erros de escrita nem bloqueiam esta fase); rastreado quando for escrito`,
      earsPlaceholder: (list) => `O critério ainda tem placeholder(s) do template ${list} — escreve o gatilho/comportamento real.`,
      constitutionUnfilled: "a secção Verificação da Constituição está em falta ou por preencher",
      checkLine: (id, detail) => `  ✗ ${id}${detail ? " — " + detail : ""}`,
      approveRefused: (phase, slug, ids, lines) => `Não é possível aprovar '${phase}' de '${slug}' — verificações a falhar: ${ids}.\n${lines}\nCorrige-as (detalhes: /spec-doctor ${slug}), ou passa force: true (CLI: --force) para registar a aprovação mesmo assim — fica assinalada como forçada.`,
      approveNothing: (phase, slug, file) => `Nada para aprovar: '${phase}' não tem artefacto em '${slug}' (${file} não existe, ou o track está desativado) — nem com force.`,
      approveForced: (ids) => `Aprovado com force — as verificações a falhar ficam registadas com a aprovação: ${ids}.`,
      phaseOrder: (list, slug, first) => `há fases anteriores ainda por aprovar: ${list} — aprova-as primeiro, por ordem (/approve ${slug} ${first})`,
      forcedGates: (list) => `aprovado com force apesar de verificações a falhar: ${list}`,
      finishRootCause: "bug.md → Causa Raiz por preencher — nenhuma correção antes de se conhecer a causa",
      finishPlaceholders: (list) => `placeholders do template por preencher na cadeia da spec: ${list}`,
      finishChanged: (list) => `alterados depois da aprovação (rever e voltar a aprovar): ${list}`,
      bugGate: (n, first) => `A tarefa ${n} ainda não pode ser concluída: bug.md → Causa Raiz está por preencher. Nenhuma correção antes de a causa raiz estar escrita no bug.md — faz primeiro a tarefa ${first} (encontra a causa raiz com evidência e escreve-a lá).`,
      bugGateFirst: (n, first) => `A tarefa ${n} ainda não pode ser concluída: bug.md → Causa Raiz está por preencher e nenhuma tarefa a escreve — só a tarefa ${first} pode ser concluída até a causa raiz estar escrita no bug.md (nenhuma correção antes da causa raiz).`,
      bugGateTicked: (n, rc) => `A tarefa ${n} ainda não pode ser concluída: bug.md → Causa Raiz continua vazia — a tarefa ${rc} está marcada, mas o que ela entrega é essa secção. Escreve lá a causa raiz, com a evidência (nenhuma correção antes de a causa raiz estar escrita no bug.md).`,
      rootCauseTaskEmpty: (n) => `A tarefa ${n} está marcada, mas bug.md → Causa Raiz continua vazia — escreve lá a causa raiz, com a evidência: as tarefas seguintes (o teste de regressão, a correção) continuam recusadas até estar escrita.`,
      fill: (file, what, hint) => `Preenche ${file} — ${what}; depois ${hint}.`,
      fillMissing: "ainda não existe",
      fillEmpty: "não tem conteúdo além dos títulos",
      fillPlaceholders: (n, first) => `${n} placeholder(s) do template por preencher (primeiro: ${first})`,
      fillHint: {
        "classification.md": (slug) => `confirma os tracks e escreve o raio de impacto e as etiquetas de conformidade (/classify ${slug}), depois /approve ${slug} classification`,
        "requirements.md": (slug) => `verifica-o com /clarify ${slug} e ears_validate (dev-spec ears ${slug})`,
        "bug.md": (slug) => `escreve a Reprodução e a Causa Raiz com evidência (/spec-doctor ${slug})`,
        "design.md": (slug) => `corre /spec-doctor ${slug} (secções obrigatórias, Verificação da Constituição)`,
        "test-plan.md": (slug) => `verifica a cobertura dos ACs com trace_check (dev-spec trace ${slug})`,
        "eval-plan.md": (slug) => `define os limiares e a baseline, depois /spec-doctor ${slug}`,
        "tasks.md": (slug) => `divide o design em tarefas reais (/createTask ${slug}), depois trace_check`,
        default: (slug) => `/spec-doctor ${slug}`,
      },
      approveClassification: (slug) => `Confirma e aprova a classificação — /approve ${slug} classification.`,
      fixGate: (phase, list, slug) => `Antes de aprovar '${phase}', corrige o que o gate de aprovação recusaria: ${list} — depois /approve ${slug} ${phase}.`,
      gateWouldRefuse: (phase, ids) => `aprovar '${phase}' seria recusado (${ids})`,
      noRealTasks: "só as tarefas do template — divide o design em pelo menos uma tarefa real tua",
      testsNotInCode: (list) => `testes planeados que nenhum ficheiro de teste nomeia ainda: ${list} — escreve cada teste a falhar com o seu T-ID no nome (trace_check {code: true} encontra-os)`,
      testsNotInCodeSignOff: (list) => `testes planeados que nenhum ficheiro de teste nomeia ainda: ${list} — a implementação já começou: confirma que cada um existe com o seu T-ID no nome do teste (test("T-01 …")) para que o trace_check {code: true} o encontre`,
      noPlannedTests: "o test-plan.md não lista nenhum T-ID — planeia os testes primeiro",
      evalSetsSample: "o evals/golden.json ainda é o conjunto de exemplo do scaffold — escreve os casos golden desta feature, corre o harness e regista a baseline",
      evalSetsMissing: "o evals/golden.json não existe ou não tem itens de eval ({\"items\": […]}) — escreve primeiro o conjunto golden desta feature",
      testsGateChecks: (ids) => `(o gate de aprovação verifica isto: ${ids})`,
      clarifyPlaceholders: (file, n, list) => `Substitui os ${n} placeholder(s)/TBD do template em ${file}: ${list}`,
      hookPlaceholders: (n, list) => `Placeholders do template: ${n} por preencher em requirements.md (${list}) — substitui-os antes de aprovar os requisitos.`,
    },

    brownfield: {
      frameworks: (list) => `  frameworks: ${list}`,
      routeLine: (method, p, loc) => `    ${method.padEnd(7)} ${p}  (${loc})`,
      moreRoutes: (n) => `    … mais ${n} (--json lista-as, até ao limite)`,
      routesTruncated: (shown, total) => `A mostrar as primeiras ${shown} de ${total} rotas — a contagem de endpoints inclui todas.`,
      readCapped: (n) => `Só foram lidos os primeiros ${n} ficheiros de código (rotas, nomes de variáveis de ambiente, pistas de testes) — essas listas podem estar incompletas.`,
      tests: (n, fws) => `  testes: ${n} ficheiro(s) · frameworks: ${fws}`,
      entrypoints: (list) => `  pontos de entrada: ${list}`,
      env: (list, more) => `  variáveis de ambiente (só nomes): ${list}` + (more ? ` … +${more}` : ""),
      migrations: (n, dirs) => `  migrações/esquema: ${n} ficheiro(s)` + (dirs ? ` — ${dirs}` : ""),
      none: "nenhum",
      coverageTests: (n) => `  ficheiros de teste (à parte, não contam): ${n}`,
      coverageFolder: (folder, covered, files, pct) => `  ${folder.padEnd(24)} ${String(covered + "/" + files).padStart(9)}  ${pct}%`,
      root: "(raiz)",
      coverageUnmatched: (list) => `  ⚠ entradas _Implements:_ que não nomeiam nada no disco: ${list}`,
      coverageNonCode: (list) => `  · entradas _Implements:_ que nomeiam testes ou ficheiros que não são código (não contam): ${list}`,
      integrationPlanPlaceholder: "integration-plan.md ainda é o template — preenche os pontos de integração, as modificações e os riscos antes de implementar",
      integrationPlanOk: "plano de integração preenchido",
    },
    importSpec: {
      note: (tool, rel, date) => `> Importado de ${tool} \`${rel}\` em ${date}.`,
      unknownTool: (tool, known) => `Formato de spec desconhecido '${tool}'. Conhecidos: ${known}.`,
      pathRequired: "falta o caminho — a pasta (ou um ficheiro) da spec a importar.",
      outside: (p) => `'${p}' está fora do projeto — o spec_import só lê dentro da pasta do projeto.`,
      notFound: (p) => `'${p}' não encontrado.`,
      nothing: (tool, p) => `Não foram encontrados ficheiros de spec ${tool} em '${p}'.`,
      exists: (slug) => `A feature '${slug}' já existe — a importação nunca a substitui. Indica outro nome.`,
      featureTitle: (name) => `# Feature: ${name}`,
      tasksTitle: (name) => `# Tasks: ${name}`,
      summary: "## Resumo",
      summaryPlaceholder: "[1-2 frases: o que faz e porque importa]",
      stories: "## Histórias de Utilizador",
      story: (n, pri, title) => `### US-${n}${pri ? ` (${pri})` : ""}: ${title}`,
      criteria: "#### Critérios de Aceitação (EARS)",
      functional: "## Requisitos Funcionais",
      entities: "## Entidades-Chave",
      success: "## Critérios de Sucesso",
      edge: "## Casos Limite e Tratamento de Erros",
      original: (tool, text) => `<!-- ${tool}: ${text} -->`,
      notEars: "[NEEDS CLARIFICATION: ainda não é uma frase EARS — acrescenta o gatilho (QUANDO/SE) e a resposta do sistema]",
      noCriteria: "[NEEDS CLARIFICATION: esta história não tem critérios de aceitação]",
      optional: "(opcional)",
      modified: "(modificado)",
      importedNotes: "## Notas importadas",
      otherTasks: "## Outras tarefas",
      ears: { while: "ENQUANTO", when: "QUANDO", if: "SE", where: "ONDE", then: "ENTÃO", shall: "O SISTEMA DEVE", not: "NÃO", ensure: "O SISTEMA DEVE garantir que" },
      wNotEars: (ids) => `não convertidos para EARS (texto mantido, marcado [NEEDS CLARIFICATION]): ${ids}`,
      wNoCriteria: (ids) => `histórias sem critérios de aceitação: ${ids}`,
      wNoCriteriaAtAll: "a origem não tem critérios de aceitação — o requirements.md ainda não define nenhum AC: escreve-os antes de aprovar os requisitos (até lá, um plano de testes +tdd recebe uma linha genérica)",
      wUnknownRef: (task, ref) => `tarefa ${task}: a referência _Requirements:_ '${ref}' não corresponde a nenhum critério importado — mantida como estava`,
      wUnknownRefLine: (line, ref) => `tasks.md, linha ${line}: a referência _Requirements:_ '${ref}' não corresponde a nenhum critério importado — mantida como estava`,
      wCarried: (list) => `copiado tal como estava, sem correspondência com histórias ou critérios (revê-o): ${list}`,
      wNoRefs: "as tarefas importadas não têm referências _Requirements:_ — acrescenta-as para o trace_check associar cada AC a uma tarefa",
      wNoTasks: "a origem não tem tasks.md — foi mantido o tasks.md do scaffold (os _Requirements:_ / _Makes green:_ do template limitados aos critérios importados)",
      taskAcPlaceholder: "[um critério importado que esta tarefa prova]",
      taskTestPlaceholder: "[o teste planeado que esta tarefa põe a verde]",
      wNoDesign: (file) => `a origem não tem ${file} — foi mantido o design.md do scaffold`,
      wNoRequirements: (file) => `não foram encontrados requisitos em ${file}`,
      wRemoved: (name) => `o requisito REMOVED '${name}' não foi importado`,
      wRenamed: (from, to) => `requisito RENAMED '${from}' → '${to}' (importado com o nome novo)`,
      wSkipped: (files) => `não importados (ficam onde estão): ${files}`,
      wUnreadable: (file) => `${file} aponta para fora do projeto — ignorado`,
      done: (tool, rel, slug, label, lang) => `Importado de ${tool} ${rel} → feature '${slug}' [${label}] (${lang})`,
      mapping: (n, sample) => `  correspondência: ${n} ID(s)` + (sample ? ` — ${sample}` : ""),
    },

    appendTasks: {
      heading: "Fase: Convergência",
      checkpoint: "as tarefas de convergência estão concluídas e verificadas — a spec e o código voltam a coincidir.",
      noTasks: "Indica pelo menos uma tarefa: tasks = [{ text, requirements?, implements?, verify?, makesGreen?, expectFail?, size?, depends?, story?, parallel? }].",
      noText: (i) => `Tarefa ${i}: o texto é obrigatório.`,
      badStory: (i, v) => `Tarefa ${i}: story tem de ser US<n> (ex.: US1) ou shared (recebido '${v}').`,
      badPath: (i, p) => `Tarefa ${i}: os caminhos de _Implements:_ têm de ser relativos à raiz do projeto, sem '..' (recebido '${p}').`,
      badVerify: (i) => `Tarefa ${i}: _Verify:_ tem de ser um comando numa só linha.`,
      placeholderVerify: (i, v) => `Tarefa ${i}: '${v}' lê-se como um marcador de posição, não como um comando (um _Verify:_ entre [parênteses retos] é ignorado) — indica o comando real (para um teste de shell, 'test …' em vez de '[ … ]').`,
      unstorable: (i, marker) => `Tarefa ${i}: o seu ${marker} não seria lido de tasks.md tal como foi dado — mantém os marcadores fora do texto da tarefa, ',' e ';' fora dos caminhos, e '_ ' fora dos caminhos e dos comandos.`,
      phantom: (list) => `Critérios de aceitação desconhecidos (não estão em requirements.md): ${list}. Nada foi escrito — corrige os IDs ou acrescenta primeiro os critérios.`,
      badHeading: "o cabeçalho tem de ser uma só linha de texto.",
      constraintsHeading: (h) => `'${h}' contém as restrições que todas as tarefas respeitam, não tarefas — escolhe um cabeçalho de fase. Nada foi escrito.`,
      inactiveHeading: (h, track) => `'${h}' é a secção de tarefas do track ${track}, que está inativo — volta a adicionar o track ou escolhe outro cabeçalho. Nada foi escrito.`,
      unsafe: (n) => `Não foi possível acrescentar com segurança: ${n ? `a tarefa ${n} não seria lida tal como foi escrita` : "as tarefas existentes mudariam"} (um comentário ou bloco de código por fechar perto do fim da fase?). Nada foi escrito.`,
      reapprove: (slug) => `O tasks.md mudou depois da sua aprovação — revê as novas tarefas e volta a aprovar: /approve ${slug} tasks.`,
      appended: (heading, created) => `Acrescentado a tasks.md → '${heading}'${created ? " (nova fase)" : ""}:`,
      oneTaskPerCall: "append-tasks aceita um --task por chamada — volta a corrê-lo para a tarefa seguinte (spec_append_tasks aceita uma lista).",
      oneValue: (flag) => `append-tasks aceita --${flag} uma só vez por chamada — ${flag === "verify" ? "junta as verificações num só comando (a && b)" : "indica um único valor"}. Nada foi escrito.`,
      badSize: (i, v) => `Tarefa ${i}: size tem de ser um de XS, S, M, L, XL (recebido '${v}').`,
      badTestId: (i, v) => `Tarefa ${i}: makesGreen aceita IDs de testes planeados (T-01, T-2 …) (recebido '${v}').`,
      phantomTests: (list) => `Testes desconhecidos (não planeados em test-plan.md): ${list}. Nada foi escrito — corrige os T-IDs ou planeia primeiro os testes.`,
      noTestPlan: (slug) => `makesGreen precisa de um plano de testes: .specs/${slug}/test-plan.md não existe (adiciona primeiro o +tdd). Nada foi escrito.`,
    },

    taskDeps: {
      doctorOk: (n) => `${n} tarefa(s) declaram _Depends:_ — cada uma nomeia uma tarefa ativa, sem ciclos`,
      doctorFail: (list) => `${list} — corrige os marcadores _Depends:_ no tasks.md (números de tarefas do mesmo tasks.md: \`_Depends: 3, 5_\`)`,
      invalid: (n, tok) => `tarefa ${n}: _Depends:_ '${tok}' não é um número de tarefa`,
      phantom: (n, d) => `a tarefa ${n} depende da #${d}, que nenhuma tarefa ativa tem`,
      self: (n) => `a tarefa ${n} depende de si mesma`,
      cycle: (list) => `tarefas que esperam umas pelas outras (um ciclo): ${list}`,
      roadmapBlocked: (list) => `nenhuma tarefa aberta pode começar (dependências entre tarefas): ${list}`,
      waitLine: (n, deps) => `#${n} espera por ${deps}`,
      blocked: (list, slug) => `Nenhuma tarefa por fazer pode começar — cada uma espera por uma dependência que não está feita: ${list}. Um ciclo ou um _Depends:_ que não nomeia nenhuma tarefa nunca se resolve: corrige os marcadores _Depends:_ em .specs/${slug}/tasks.md (/spec-doctor ${slug} → task-deps).`,
      tickedEarly: (n, list) => `A tarefa ${n} foi marcada com as dependências ${list} ainda não concluídas — ficou marcada como pedido (uma marcação reflete o que aconteceu); confirma que não precisava do trabalho delas, ou conclui-as a seguir.`,
      briefHeading: "## Depende de",
      briefStatus: { done: "feita", open: "por fazer", missing: "não existe" },
      briefOpenNote: "⚠ Algumas ainda não estão concluídas — esta tarefa foi planeada para começar depois delas: responde NEEDS_CONTEXT se precisar do resultado delas.",
      badDepends: (i, v) => `Tarefa ${i}: depends aceita números de tarefa (3 ou #3) (recebido '${v}').`,
      selfDepends: (i, n) => `A tarefa ${i} tem aqui o número ${n} e dependeria de si mesma. Nada foi escrito.`,
      phantomDepends: (i, list, first, last) => `Tarefa ${i}: depends não nomeia nenhuma tarefa: ${list} — indica o número de uma tarefa ativa, ou de uma tarefa desta chamada (aqui numeradas ${first === last ? first : first + "–" + last}). Nada foi escrito.`,
      cycleDepends: (list) => `As dependências formariam um ciclo: ${list}. Nada foi escrito.`,
      cliWaves: (n) => `Ondas (${n}):`,
      cliWave: (k, list) => `  ${k}. ${list}`,
      cliNoWave: "  (nenhuma tarefa por fazer pode começar)",
      cliCycles: (list) => `  ⚠ ciclo: ${list}`,
      cliBlocked: (list) => `  ⚠ bloqueadas: ${list}`,
      cliSkipped: (list) => `  à espera: ${list}`,
    },

    impact: {
      badPhase: (p, known) => `Fase '${p}' desconhecida para spec_impact. Conhecidas: ${known}.`,
      reopenTasks: "reopen aplica-se a requirements, design, test-plan e eval-plan — uma alteração ao tasks.md revê-se e volta a aprovar-se; não reabre nada.",
      retireTests: {
        retireHint: (list, slug, phase, offer) => `Testes removidos que tarefas ainda põem a verde — ${list}: não refaças essas tarefas; tira o T-ID do _Makes green:_ delas ou aponta-o para o teste que o substitui.` +
          (offer ? ` --reopen regista o pedido de alteração sem as desmarcar (dev-spec impact ${slug} --phase ${phase} --reopen).` : ""),
        retireNote: (list) => `Testes removidos não se refazem — ainda nomeados em _Makes green:_: ${list}: tira o T-ID dessas tarefas, ou aponta-o para o teste que o substitui.`,
        recordedRetire: (n, list, slug, phase) => `Pedido de alteração #${n} registado — nada desmarcado: as tarefas de um teste removido não se refazem. Ainda nomeados em _Makes green:_: ${list}: tira o T-ID dessas tarefas, ou aponta-o para o teste que o substitui; depois volta a aprovar: /approve ${slug} ${phase}.`,
      },
      missing: (file, slug) => `${file} não encontrado em '${slug}' — nada para comparar.`,
      neverApproved: (phase, slug) => `'${phase}' nunca foi aprovada em '${slug}' — não há versão aprovada com que comparar. Aprova-a primeiro: /approve ${slug} ${phase}.`,
      fingerprintOnly: (phase, slug) => `Esta aprovação é anterior ao histórico de alterações: só ficou registada a sua impressão digital, por isso não é possível listar o que mudou. Volta a aprovar para iniciar o histórico: /approve ${slug} ${phase}.`,
      noFingerprint: (phase, slug) => `Esta aprovação é anterior às impressões digitais de conteúdo: nada da versão aprovada ficou registado, por isso não é possível dizer se mudou nem o quê (a data de um ficheiro não é prova — um clone ou uma cópia repõe-na). Volta a aprovar para a começar a seguir: /approve ${slug} ${phase}.`,
      reopenNeedsSnapshot: (phase) => `Nada foi reaberto: sem um snapshot de '${phase}' aprovada não é possível determinar as tarefas afetadas.`,
      nothingNew: "Nada de novo desde a última reabertura sobre esta aprovação — nada foi alterado.",
      nothingToReopen: (changed) => (changed ? "Nada a reabrir: a edição não alterou nenhum critério nem secção (só texto fora deles) — nada foi alterado."
        : "Nada mudou desde a aprovação — nada a reabrir."),
      designFingerprintOnly: (slug) => `O design.md também mudou desde a aprovação, mas esta aprovação não guardou um snapshot dele (só a impressão digital), por isso não é possível listar o que lá mudou. Volta a aprovar para iniciar o histórico: /approve ${slug} design.`,
      reopenDesignUnknown: "Nada foi reaberto: o design.md mudou, mas sem um snapshot dele tal como foi aprovado não é possível determinar as tarefas afetadas.",
      reopened: (list, slug, phase) => `Reabertas ${list}: desmarcadas, com a evidência marcada como desatualizada — refaz-as com evidência nova e volta a aprovar: /approve ${slug} ${phase}.`,
      retireItem: (id, tasks, tests) => `${id} → ${[tasks.length ? "tarefas " + tasks.join(", ") : "", tests.length ? "testes " + tests.join(", ") : ""].filter(Boolean).join(" · ")}`,
      retireHint: (list, slug, phase, offer) => `Critérios removidos ainda citados — ${list}: não refaças essas tarefas; apaga-as (e as linhas de teste) ou aponta-as para o critério que o substitui.` +
        (offer ? ` --reopen regista o pedido de alteração sem as desmarcar (dev-spec impact ${slug} --phase ${phase} --reopen).` : ""),
      retireNote: (list) => `Critérios removidos não se refazem — ainda citados: ${list}: apaga essas tarefas e linhas de teste, ou aponta-as para o critério que o substitui.`,
      recordedRetire: (n, list, slug, phase) => `Pedido de alteração #${n} registado — nada desmarcado: as tarefas de um critério removido não se refazem. Ainda citados: ${list}: apaga essas tarefas e linhas de teste, ou aponta-as para o critério que o substitui; depois volta a aprovar: /approve ${slug} ${phase}.`,
      recordedOnly: (n, slug, phase) => `Pedido de alteração #${n} registado — nenhuma tarefa concluída foi afetada. Revê-o e volta a aprovar: /approve ${slug} ${phase}.`,
      reopenHint: (slug, phase) => `Para desmarcar as tarefas concluídas afetadas e marcar a evidência como desatualizada: dev-spec impact ${slug} --phase ${phase} --reopen (spec_impact {reopen: true}).`,
      nextHint: (slug, phases) => `Vê primeiro o que a edição afeta com spec_impact (${phases.map((p) => `dev-spec impact ${slug} --phase ${p}`).join(" · ")}).`,
      doctorChanged: (list, slug, phases) => `alterado(s) após a aprovação: ${list} — vê o que a edição afeta com spec_impact (${phases.map((p) => `dev-spec impact ${slug} --phase ${p}`).join(" · ")}) e volta a aprovar`,
      doctorChangedPlain: (list, slug) => `alterado(s) após a aprovação: ${list} — revê e volta a aprovar (/approve ${slug} <fase>)`,
      staleNote: (n, slug, runnable) => `Tarefa ${n}: a evidência é anterior a uma alteração da spec (o spec_impact reabriu-a) — continua não verificada até se registar ` +
        (runnable ? `uma nova execução com sucesso: dev-spec done ${slug} ${n} --run` : "evidência nova."),
      head: (slug, phase, date, snap) => `Impacto: ${slug} · ${phase} — face à aprovação de ${date} (${snap})`,
      headFp: (slug, phase, changed) => `Impacto: ${slug} · ${phase} — só impressão digital: ${changed ? "alterado desde a aprovação" : "sem alterações desde a aprovação"}`,
      headNone: (slug, phase, changed) => `Impacto: ${slug} · ${phase} — sem impressão digital registada: ${changed ? "alterado desde a aprovação (um ficheiro criado depois dela)" : "não é possível dizer se mudou"}`,
      noChanges: "sem alterações desde a aprovação",
      noStructural: "editado, mas nenhum critério, secção ou tarefa mudou (só texto fora deles)",
      affected: "Afetado:",
      tasksLabel: "tarefas",
      testsLabel: "testes",
      designLabel: "design",
      idsLabel: "IDs",
      none: "nenhum",
      change: { added: "acrescentado", modified: "alterado", removed: "removido" },
      verified: "verificada",
      nothingToVerify: "nada a verificar (sem comando _Verify:_, nada registado)",
      staleSpec: "a spec mudou desde esta evidência; o spec_impact reabriu a tarefa",
      uncovered: (list) => `novos, ainda sem tarefa que os cite: ${list}`,
      reReview: (slug, phase, roles) => `revê a alteração e volta a aprovar: /approve ${slug} ${phase}` + (roles && roles.length ? ` --role ${roles[0]} (cada papel valida o novo conteúdo: ${roles.join(", ")})` : ""),
    },
    metrics: {
      writeNeedsName: "write precisa do nome de uma feature — a retrospetiva é por feature (spec_metrics {name, write: true} / dev-spec metrics <feature> --write).",
      retroWritten: (p) => `Retrospetiva → ${p} (pré-preenchida com as métricas — o resto é contigo).`,
      retroExists: (p) => `${p} já existe — não foi alterado (uma retrospetiva nunca é substituída).`,
      unknown: "desconhecida",
      source: { approval: "aproximada: a partir da primeira aprovação", filesystem: "aproximada: a partir da data da pasta" },
      phase: { classification: "classificação", requirements: "requisitos", design: "design", "test-plan": "plano de testes", "eval-plan": "plano de evals", tests: "testes", tasks: "tarefas", execution: "execução", complete: "concluída", finished: "fechada" },
      head: (slug, tracks, created, approx) => `Métricas: ${slug} [${tracks}] — criada a ${created}${approx ? ` (${approx})` : ""}`,
      leadTimes: (list) => `  tempo desde a criação: ${list}`,
      noLeadTimes: "  tempo desde a criação: ainda nada aprovado",
      rework: (total, n, list, forced) => `  aprovações: ${total} · retrabalho: ${n}${list ? ` (${list})` : ""} · forçadas: ${forced}`,
      reworkUnknown: (forced) => `  retrabalho: desconhecido (aprovações anteriores ao histórico de alterações) · forçadas: ${forced}`,
      reworkPartial: (total, n, list, forced, legacy) => `  aprovações: ${total} · retrabalho: pelo menos ${n}${list ? ` (${list})` : ""} · forçadas: ${forced} — retrabalho desconhecido em ${legacy} (aprovações anteriores ao histórico de alterações)`,
      changes: (n, reopened) => `  pedidos de alteração: ${n} · tarefas reabertas: ${reopened}`,
      evidence: (rate, pass, runs) => `  evidência: ${rate}% das execuções com sucesso (${pass}/${runs})`,
      noRuns: "  evidência: nenhuma execução registada",
      tasks: (done, total, clar) => `  tarefas: ${done}/${total} · marcadores de clarificação por resolver: ${clar}`,
      noFeatures: (dir) => `Ainda não há features em ${dir}`,
      projectHead: (n) => `Métricas — ${n} feature(s)`,
      row: (created, complete, rework, forced, changes, pass, tasks) => [created ? `criada ${created}` : null, `concluída ${complete}`, `retrabalho ${rework}`,
        `forçadas ${forced}`, `alterações ${changes}`, `sucesso ${pass}`, tasks ? `tarefas ${tasks}` : null].filter(Boolean).join(" · "),
      avg: "média",
      median: "mediana",
      medianLeads: (list) => `  mediana do tempo desde a criação: ${list}`,
      totals: (done, total, pass, runs, changes, reopened) => `  total: tarefas ${done}/${total} · ${runs ? `evidência ${pass} de ${runs} execução(ões) com sucesso` : "nenhuma execução registada"} · pedidos de alteração ${changes} · tarefas reabertas ${reopened}`,
      retroText: {
        title: (f) => `# Retrospetiva: ${f}`,
        intro: (date) => `> Gerada pelo dev-spec a ${date} a partir de .state.json, .history/ e dos artefactos. Os números são calculados localmente; o resto é contigo. Nada aqui é aplicado automaticamente.`,
        metrics: "## Métricas",
        header: "| Métrica | Valor |",
        created: "Criada",
        approximate: "aproximado",
        unknown: "desconhecida",
        lead: (ph) => `Tempo até ${ph}`,
        rework: "Retrabalho (novas aprovações)",
        reworkUnknown: "desconhecido — as aprovações são anteriores ao histórico de alterações",
        reworkPartial: (value, legacy) => `pelo menos ${value} — desconhecido em ${legacy} (aprovações anteriores ao histórico de alterações)`,
        forced: "Aprovações forçadas",
        changes: "Pedidos de alteração",
        reopened: (n) => `${n} tarefa(s) reaberta(s)`,
        passRate: "Taxa de sucesso da evidência",
        runs: (rate, pass, runs) => `${rate}% (${pass}/${runs} execuções)`,
        noRuns: "nenhuma execução registada",
        tasks: "Tarefas",
        tasksValue: (done, total) => `${done}/${total} feitas`,
        clar: "Marcadores de clarificação por resolver",
        well: "## O que correu bem",
        hurt: "## O que custou",
        signals: (list) => `<!-- Sinais das métricas: ${list}. -->`,
        sigRework: (ph, n) => `'${ph}' aprovada ${n} vez(es)`,
        sigForced: (n) => `${n} aprovação(ões) forçada(s) com verificações a falhar`,
        sigReopened: (n) => `${n} tarefa(s) reaberta(s) por pedidos de alteração`,
        sigPass: (rate) => `só ${rate}% das execuções de verificação passaram`,
        sigClar: (n) => `${n} marcador(es) de clarificação ainda por resolver`,
        amend: "## Alterações propostas ao steering ou à constituição",
        amendNote: "<!-- Para aprovação humana — nunca aplicadas automaticamente. Indica o ficheiro (.specs/steering/constitution.md, tech.md, …), a alteração exata e o porquê. -->",
        followUps: "## Seguimento",
        followUpsNote: "<!-- Candidatos ao backlog — acrescenta os que aceitares com spec_backlog (dev-spec backlog add \"<nome>\" \"<nota>\"). -->",
      },
      retro: (m, fmt) => MSG.en.metrics.buildRetro(MSG.pt.metrics.retroText, MSG.pt.metrics.phase, m, fmt),
    },

    deepTrace: {
      kinds: {
        uncoveredEdgeCases: "casos limite (EC) sem tarefa nem teste que os cubra",
        uncoveredNfr: "requisitos não funcionais (NFR) sem tarefa nem teste que os cubra",
        uncoveredSuccessCriteria: "critérios de sucesso (SC) sem teste nem passo do quickstart que os verifique",
        phantomSecondary: "tarefas / plano de testes citam IDs EC/NFR/SC desconhecidos (gralhas?)",
        plannedNotInCode: "testes planeados que nenhum ficheiro de teste nomeia (põe o T-ID no nome do teste)",
        inCodeNotInPlan: "T-IDs no código de teste que nenhum plano de testes lista",
        unresolvedImplGlobs: "globs de _Implements:_ não resolvidos por completo (a leitura dos ficheiros parou no limite antes de uma correspondência — não contam como em falta)",
      },
      secondaryOk: (n) => `todos os ${n} IDs EC/NFR/SC cobertos`,
      testsInCodeOk: (n) => `cada T-ID planeado que uma tarefa feita põe a verde aparece num ficheiro de teste (${n})`,
      testsInCodeMissing: (list) => `postos a verde por tarefas feitas, mas nenhum ficheiro de teste os nomeia: ${list} — põe o T-ID no nome de um teste (test("T-01 …"), def test_T01_…) num ficheiro de teste (uma pasta tests/, *.test.*, *_test.* …), no ficheiro que a coluna Ficheiro do plano indica, se indicar um; uma verificação feita fora do código de teste (um script de carga, um conjunto de evals) indica antes o seu artefacto não-código na coluna Ficheiro (load-test.md, evals/golden.json) e não é esperada num ficheiro de teste`,
      truncated: "a pesquisa de ficheiros de teste parou no limite — alguns ficheiros não foram lidos",
      codeSummary: (found, planned, scanned, truncated, outside) => `  testes no código: ${found}/${planned} T-ID(s) planeado(s) nomeado(s) em ${scanned} ficheiro(s) de teste` + (outside ? ` · verificados fora do código de teste (a coluna Ficheiro indica um artefacto que não é código): ${outside}` : "") + (truncated ? " (pesquisa truncada no limite)" : ""),
      warningsHead: "Avisos (não bloqueiam):",
    },

    catalog: {
      title: (proj) => `Catálogo de specs — ${proj}`,
      autogen: "AUTO-GERADO por dev-spec — não editar à mão. Para regenerar: spec_catalog {write: true} (dev-spec catalog --write).",
      intro: "O que o sistema faz hoje: todos os critérios de aceitação, agrupados por feature. Um critério substituído por uma feature posterior já entregue (_Supersedes:_) aparece riscado e indica o critério que o substitui; um que uma feature ainda em curso prevê substituir aparece com \"substituição prevista\" e continua em vigor.",
      totals: (f, acs, current, sup, pending) => `**${f} feature(s) · ${acs} critérios de aceitação — ${current} em vigor${pending ? ` (${pending} com substituição prevista)` : ""}, ${sup} substituído(s)**`,
      status: { active: "em curso", complete: "completa", finished: "fechada", archived: "arquivada" },
      finishedOn: (d) => `fechada a ${d}`,
      archivedOn: (d) => `arquivada a ${d}`,
      supersededBy: (list) => `substituído por ${list}`,
      toBeSupersededBy: (list) => `substituição prevista por ${list} (ainda não entregue)`,
      supersedes: (list) => `substitui ${list}`,
      template: "template — ainda por escrever",
      noAcs: "Ainda sem critérios de aceitação.",
      noFeatures: "Ainda sem features.",
      cliWrote: (file, f, acs, sup) => `✎ gerado ${file}  (${f} feature(s), ${acs} critério(s), ${sup} substituído(s))`,
    },
    supersedes: {
      phantom: (ref, reason, by) => `_Supersedes:_ ${ref}${by ? ` (em ${by})` : ""} — ${reason}`,
      renamed: (list) => `as referências _Supersedes:_ a ela passam a usar o nome novo, em: ${list}`,
      reason: { "bad-ref": "não está no formato <feature>/US-n.AC-m", "unknown-feature": "essa feature não existe (ativa ou arquivada)", "unknown-ac": "essa feature não tem esse critério", self: "uma feature não pode substituir um critério seu", unterminated: "o marcador nunca é fechado — termina-o com um underscore: _Supersedes: <feature>/US-n.AC-m_" },
    },
    restore: {
      notArchived: (slug) => `Não há nada arquivado como '${slug}' (.specs/_archive/${slug}/ não existe).`,
      activeExists: (slug) => `'${slug}' já é uma feature ativa — renomeia-a ou arquiva-a antes de restaurar a arquivada.`,
      done: (slug) => `'${slug}' restaurada de .specs/_archive/ ✓`,
      noRecord: "Foi arquivada antes de o arquivo registar a sua entrada no roadmap — volta a declarar as dependências com spec_depend, se as tinha.",
      skipDependsOn: (d, reason) => `a sua dependência '${d}' (${reason})`,
      skipDependent: (k, reason) => `'${k}', que dependia dela (${reason})`,
      skipRecord: (field, reason) => `o campo ${field} do registo de arquivo (${reason})`,
      skipped: (list) => `Não restaurado: ${list}.`,
      reason: { gone: "já não existe", archived: "também arquivada — restaurá-la repõe a ligação", cycle: "fecharia um ciclo de dependências", invalid: "formato inesperado — deixado de fora" },
      renamedRecords: (list) => `registos de arquivo atualizados para o nome novo (o restore repõe as suas dependências): ${list}`,
      prunedDependents: (list) => `as dependências das features que dependiam dela saíram do roadmap: ${list} (registado — o restore repõe-nas)`,
      prunedIncomplete: (slug, pct, list) => `'${slug}' não estava completa (${pct}%), mas ${list} dependia(m) dela: o roadmap deixa de a(s) mostrar bloqueada(s) por ela — restaura-a, ou volta a declarar a dependência com spec_depend, se ainda precisa(m) desse trabalho`,
    },
    drift: {
      none: "Nenhuma feature fechada tem ainda uma baseline de drift — spec_finish {write: true} (dev-spec finish <feature> --write) regista uma quando a feature está pronta para fechar.",
      clean: (f, n, d, archived) => `  ✓ ${f}${archived ? " (arquivada)" : ""}: ${n} ficheiro(s) de implementação sem alterações desde o fecho (${d})`,
      drifted: (f, n, total, d, archived) => `  ⚠ ${f}${archived ? " (arquivada)" : ""}: ${n} de ${total} ficheiro(s) de implementação alterado(s) desde o fecho (${d})`,
      changed: (list) => `      alterados: ${list}`,
      missing: (list) => `      em falta: ${list}`,
      nowPresent: (list) => `      agora presentes (em falta no fecho): ${list}`,
      reopened: (list) => `  · reabertas depois do fecho (há tarefas por fazer — verificadas quando voltarem a fechar): ${list}`,
      unbaselined: (list) => `  · ainda sem baseline de fecho: ${list}`,
      stale: (f, d, why, archived) => `  ↻ ${f}${archived ? " (arquivada)" : ""}: mudou desde o fecho (${d}) — ${why}; a baseline já não a cobre: ${archived ? `restaura-a (dev-spec feature restore ${f}), volta a fechá-la (dev-spec finish ${f} --write) e arquiva-a de novo` : `volta a fechá-la (dev-spec finish ${f} --write)`}`,
      staleWhy: {
        changeRequests: (list) => `pedido de alteração ${list}`,
        approvals: (list) => `reaprovado: ${list}`,
        newFiles: (n, list) => `${n} ficheiro(s) de implementação fora da baseline: ${list}`,
      },
      hookLine: (f, n) => `  ⚠ ${f}: ${n} ficheiro(s) de implementação alterado(s) desde o fecho — corre dev-spec drift ${f}`,
      baselineRecorded: (n, missing) => `Baseline de drift registada: ${n} ficheiro(s) de implementação${missing ? ` (${missing} em falta)` : ""} — dev-spec drift mostra o que mudar depois deste fecho.`,
      baselineReplaced: (n, day, list) => `Substituída a baseline de ${day}, na qual ${n} ficheiro(s) tinham mudado: ${list} — a nova baseline aceita-os tal como estão agora.`,
    },

    guardMode: {
      ask: (pending, stale) => "dev-spec guard: nenhuma tarefa aprovada cobre alterações de código neste momento — aprova as tarefas de uma feature (spec_approve) ou confirma para continuar." +
        (pending ? ` Features com tarefas por aprovar: ${pending}.` : "") +
        (stale ? ` Tarefas alteradas depois da aprovação (revê e volta a aprovar a fase tasks): ${stale}.` : "") + " (O modo guarda está ligado — dev-spec init --guard off desliga-o.)",
      forced: (list) => `dev-spec guard: as alterações de código só estão cobertas por uma aprovação FORÇADA das tarefas (${list}) — as verificações falhavam quando foi aprovada.`,
      on: "Modo guarda LIGADO — Write/Edit em ficheiros de código fora de .specs/ pede confirmação enquanto nenhuma feature tiver tarefas aprovadas por concluir (roadmap.json meta.guard). Os ficheiros de teste são permitidos enquanto o plano de testes de uma feature por concluir estiver aprovado (a Fase 4 escreve os testes a falhar antes do gate das tarefas), e todos os ficheiros de código enquanto um spike estiver em curso (o seu protótipo).",
      off: "Modo guarda DESLIGADO — as alterações de código não são controladas.",
      badValue: (v) => `--guard aceita on, off ou scope (recebido '${v}').`,
    },
    approvalGuard: {
      on: {
        ask: "O guarda de aprovações está em ASK — uma aprovação feita por um agente (spec_approve / dev-spec approve, a remoção de uma feature, baixar este guarda) pede primeiro a tua confirmação (roadmap.json meta.approvalGuard). Nos modos de permissão auto / bypass do Claude Code o pedido de permissão pode não aparecer — 'deny' vale em todos os modos.",
        deny: "O guarda de aprovações está em DENY — uma aprovação feita por um agente (spec_approve / dev-spec approve, a remoção de uma feature, baixar este guarda) é recusada: só a pessoa aprova, no seu próprio terminal ou no Claude Code com o prefixo ! (roadmap.json meta.approvalGuard).",
      },
      off: "O guarda de aprovações está DESLIGADO — as aprovações pedidas por um agente não são controladas (roadmap.json meta.approvalGuard).",
      badValue: (v) => `--approval-guard aceita off, ask ou deny (recebido '${v}').`,
      action: (a) => {
        const f = a.feature || "?";
        if (a.kind === "remove") return `apagar definitivamente a feature '${f}' (a pasta em .specs/, as aprovações e o histórico)`;
        if (a.kind === "guard-down") {
          if (a.setting === "evidence") return "voltar a pôr o modo de evidência (meta.evidence) em reported";
          if (a.setting === "stopCheck") return "desligar o gate de evidência no fim do turno (meta.stopCheck)";
          if (a.setting === "guard") return a.from ? `baixar o modo guarda (meta.guard) de ${a.from} para ${a.to}` : `pôr o modo guarda (meta.guard) em ${a.to}`;
          if (a.setting === "roles") {
            if (!a.to || !Object.keys(a.to).length) return "remover os papéis de aprovação (meta.approvalRoles)";
            return Array.isArray(a.removed) ? `retirar papéis de aprovação exigidos (${a.removed.join(", ")}) de meta.approvalRoles` : "substituir os papéis de aprovação (meta.approvalRoles)";
          }
          if (a.setting === "check") return a.to == null ? `remover a verificação do projeto '${a.name}' (meta.checks)` : `alterar o comando da verificação do projeto '${a.name}' (meta.checks)`;
          if (a.setting === "roadmap") return "alterar .specs/roadmap.json a partir da shell — escrevê-lo, movê-lo ou apagá-lo (é lá que estão o guarda de aprovações e os gates do projeto)";
          return `baixar o guarda de aprovações de ${a.from} para ${a.to}`;
        }
        if (a.revoke) return `revogar a aprovação da fase ${a.phase || "?"} de '${f}'` + (a.role ? ` como ${a.role}` : "") + (a.by ? ` em nome de '${a.by}'` : "");
        return (a.through ? `aprovar todas as fases de '${f}' até ${a.through}` : `aprovar a fase ${a.phase || "?"} de '${f}'`) +
          (a.role ? ` como ${a.role}` : "") + (a.by ? ` em nome de '${a.by}'` : "") +
          (a.force ? " — FORÇADA (--force)" : "");
      },
      ask: (list, force) => `dev-spec approval guard: o agente quer ${list}.` + (force ? " ⚠ FORCE: as verificações da fase são ignoradas — um gate que falha ficaria registado como aprovado mesmo assim." : "") +
        " As aprovações são tuas — confirma só se aprovares isto. (meta.approvalGuard: ask — dev-spec init --approval-guard deny recusa de vez as aprovações dos agentes.)",
      deny: (list, command) => `dev-spec approval guard: recusado — as aprovações são da pessoa, e um agente não pode ${list}. ` +
        (command ? `Pede ao utilizador que o execute ele próprio, no seu terminal ou no Claude Code com o prefixo ! (o comando é executado como o utilizador, não pela tua chamada de ferramenta): ${command}` : "Pede ao utilizador que faça ele próprio essa alteração, no seu editor ou terminal") +
        " — e espera por ele. Não tentes outra via (a ferramenta MCP, a CLI, um script ou uma edição dos ficheiros de .specs/). (meta.approvalGuard: deny.)",
      denyUser: (list, command) => `dev-spec approval guard recusou o pedido de um agente para ${list}.` + (command ? ` Para aprovar: ${command}` : " Se a quiseres, faz tu essa alteração."),
    },
    scopedSteering: {
      customHint: "— ou um ficheiro de steering próprio, com âmbito: letras minúsculas, algarismos e '-', a terminar em .md (ex.: api-conventions.md).",
      reservedName: (file) => `'${file}' é um nome reservado (um nome de dispositivo do Windows ou um membro nativo do JavaScript) — escolhe outro nome para o ficheiro de steering.`,
      customStub: (title, pattern) => `---\ninclusion: fileMatch\nfileMatchPattern: "${pattern}"\n---\n\n# ${title}\n\n` +
        "<!-- Steering com âmbito. O front matter decide quando o spec_task_brief inclui este ficheiro:\n" +
        "     inclusion: always    → em todos os briefs de tarefa\n" +
        "     inclusion: fileMatch → só nas tarefas cujos caminhos _Implements:_ correspondem ao fileMatchPattern\n" +
        "                            (glob: ** · * · ? · {a,b}; aceita uma lista: [\"src/api/**\", \"src/routes/**\"])\n" +
        "     inclusion: manual    → nunca automaticamente; os briefs listam-no como disponível a pedido\n" +
        "     Substitui o padrão de exemplo e as linhas entre parênteses retos abaixo. -->\n\n" +
        "## Regras\n- [Uma regra que todos os ficheiros que correspondem ao padrão têm de seguir.]\n\n## Exemplos\n- [Um exemplo curto — ou uma referência a um ficheiro que mostre o padrão.]\n",
      placeholders: (list) => `ainda com placeholders do template: ${list}`,
      scoped: "Steering com âmbito (fileMatch — corresponde aos ficheiros desta tarefa):",
      manual: "Disponível a pedido (steering manual):",
    },
    designSaveCheck: {
      head: (slug, tracks) => `Verificação do design em design.md (${slug} [${tracks}]):`,
      clean: (tracks, constitution) => `Verificação do design [${tracks}]: secções obrigatórias${constitution ? " e Verificação da Constituição" : ""} preenchidas, sem placeholders do template ✓`,
      sections: (marker, list) => `secções ${marker}: ${list}`,
      constitution: {
        missing: "Verificação da Constituição: em falta — acrescenta a secção e verifica cada princípio de steering/constitution.md",
        unfilled: "Verificação da Constituição: por preencher",
      },
      placeholders: (n, list) => `${n} placeholder(s) do template por substituir: ${list}`,
      hint: (slug) => `Preenche-os antes de aprovar o design — detalhes: /spec-doctor ${slug}.`,
    },
    upgrade: {
      head: (from, to, mode) => mode === "unknown" ? "dev-spec upgrade — a versão deste motor é desconhecida (não há package.json ao lado): nada será carimbado."
        : mode === "behind" ? `dev-spec upgrade — .specs/ ${from ? `na ${from}` : "de antes da 1.13 (sem carimbo de versão)"} → dev-spec ${to}`
        : mode === "pending" ? `dev-spec upgrade — .specs/ na ${from} (este dev-spec: ${to}), mas ainda há migrações pendentes`
        : `dev-spec upgrade — .specs/ na ${from}: em dia com este dev-spec (${to})`,
      newer: (from, to) => `.specs/ foi atualizado por último por um dev-spec mais recente (${from}) do que este (${to}) — atualiza o plugin antes de confiar nesta auditoria.`,
      summary: (n, blocked, attention, ok, archived) => `${n} feature(s) ativa(s): ${blocked} bloqueada(s) · ${attention} a precisar de atenção · ${ok} ok` + (archived ? ` · ${archived} arquivada(s) (não revista(s))` : ""),
      noFeatures: "Não há features ativas — nada a rever.",
      group: { blocked: "⛔ Bloqueadas — o doctor falha:", attention: "▲ Precisam de atenção:", ok: "✓ OK:" },
      status: { "not-started": "por começar", planning: "em planeamento", executing: "em execução", complete: "completa", finished: "fechada" },
      feature: (name, status, tracks, phase, done, total, bugfix) => `${name} — ${status} · [${tracks}] · ${phase} · ${done}/${total} tarefas${bugfix ? " · bugfix" : ""}`,
      tracksInferred: "os tracks foram inferidos dos ficheiros — o apply guarda-os no .state.json",
      item: {
        error: (e) => `Corrige-o primeiro à mão: ${e}`,
        fix: (list) => `Corrige o que o doctor dá como falha: ${list}`,
        approve: (list, slug) => `Aprova o(s) gate(s) pendente(s), por ordem: ${list} — /approve ${slug} <fase>`,
        reReview: (list, cmds) => `Revê o que mudou depois da aprovação: ${list}` + (cmds ? ` — vê primeiro a diferença: ${cmds}` : "") + "; depois volta a aprovar",
        reapprove: (list) => `Volta a aprovar para começar o histórico de alterações (o spec_impact ainda não consegue comparar estas): ${list}`,
        verify: (list, slug) => `Regista uma execução bem-sucedida das tarefas marcadas que não a têm: ${list} — dev-spec done ${slug} <n> --run`,
        drift: (n, slug) => `Decide sobre a deriva: ${n} ficheiro(s) de implementação alterado(s) desde o fecho — dev-spec drift ${slug}`,
        stale: (slug) => `Mudou depois do fecho — volta a fechá-la: /spec-finish ${slug}`,
        critic: (files) => `Revê-a com o agente spec-critic (só leitura), fase a fase: ${files || "—"}`,
        converge: (files) => "Corre a passagem de convergência do spec-reviewer (as tarefas feitas face aos seus ACs)" + (files ? `, depois o agente spec-critic sobre ${files}` : ""),
        none: "Não precisa de revisão da spec — todas as tarefas estão feitas",
        next: (rec) => `A seguir: ${rec}`,
        warnings: (list) => `Avisos: ${list}`,
      },
      reason: { "no-fingerprint": "aprovada antes das impressões digitais de conteúdo", changed: "alterada depois da aprovação", missing: "o ficheiro não existe", untracked: "uma aprovação de design de bugfix da 1.12 — o bug.md nunca foi seguido", "snapshot-missing": "o ficheiro do snapshot desapareceu" },
      planHead: "O apply mudaria (spec_upgrade {apply: true} · dev-spec upgrade --apply) — nunca um artefacto, uma aprovação ou uma marcação:",
      migHead: "Migrações aplicadas — nenhum artefacto editado, nada aprovado, marcado ou apagado:",
      migStamp: (from, to) => `meta.specVersion: ${from || "nenhuma"} → ${to}`,
      migTracks: (list) => `tracks guardados no .state.json: ${list}`,
      migSeeded: (list) => `baselines de aprovação guardadas: ${list}`,
      planSeed: (list) => `baselines de aprovação a guardar em .history/ (o ficheiro ainda corresponde à aprovação): ${list}`,
      migRecords: (n) => `${n} aprovação(ões) anterior(es) registada(s) no approvalHistory`,
      migSkipped: (list) => `sem baseline — volta a aprovar para começar o histórico: ${list}`,
      migGitignore: (n) => `.specs/.gitignore: ${n} linha(s) acrescentada(s)`,
      migErrors: (list) => `não migrado: ${list} — corrige e volta a correr o upgrade (o meta.specVersion fica como está até lá)`,
      nothing: "Nada a migrar — .specs/ já está em dia; nada foi alterado.",
      upToDate: "Nada a migrar — a lista acima é o que as regras atuais assinalam.",
      applyHint: "Nada foi alterado. Revê a lista e depois aplica as migrações seguras: dev-spec upgrade --apply (spec_upgrade {apply: true}).",
      reportAt: (file) => `Relatório: ${file} — uma checklist para ir cumprindo (/spec-upgrade).`,
      reportKept: (file) => `${file} existe e não foi gerado pelo dev-spec — ficou intacto (relatório não escrito).`,
      hookLine: (from) => `⬆ .specs/ foi criado com um dev-spec mais antigo (${from || "anterior à 1.13"}) — corre /spec-upgrade (dev-spec upgrade) para rever o que ainda não está implementado (ou pede simplesmente para atualizar as specs)`,
      md: {
        title: (proj) => `dev-spec upgrade — ${proj}`,
        autogen: "AUTO-GERADO por dev-spec — marca as caixas à medida que avanças; o spec_upgrade {apply: true} (dev-spec upgrade --apply) escreve-o quando migra alguma coisa.",
        intro: (from, to) => `.specs/ atualizado de ${from || "um dev-spec anterior à 1.13"} para ${to || "?"}. Por feature: o que as regras da ${to || "?"} assinalam, o que fazer e que revisão correr. Trabalha-o com /spec-upgrade (Claude Code) ou dev-spec upgrade; volta a correr a auditoria quando quiseres para ver o estado atual.`,
        migrations: "Migrações",
        group: { blocked: "⛔ Bloqueadas — o doctor falha", attention: "▲ Precisam de atenção", ok: "✓ OK" },
        footer: "Todas as alterações passam pelos gates normais: novas aprovações com spec_approve (/approve), edições da spec depois de uma aprovação com spec_impact (/spec-impact), trabalho de seguimento com spec_append_tasks (/spec-converge). Nada aqui é aplicado automaticamente.",
      },
    },

    promptsResources: {
      preamble: (agentsMd, refsDir) => `Nota para o agente: se não houver uma skill dev-spec-driven disponível nesta ferramenta, segue o fluxo do AGENTS.md do plugin (${agentsMd}) e usa as ferramentas MCP spec-driven (spec_*, ears_validate, trace_check); os ficheiros references/… citados abaixo estão em ${refsDir}.`,
      argDesc: (hint) => (hint ? `Argumentos (opcionais): ${hint}` : "Não precisa de argumentos (texto livre opcional)."),
      cliHead: (n) => `${n} prompt(s) — um por comando do plugin; dev-spec prompts <nome> [--args "…"] mostra um:`,
      res: {
        roadmap: "O roadmap do projeto (.specs/ROADMAP.md): a fase, o progresso e as dependências de cada feature.",
        roadmapFromJson: "O roadmap do projeto, gerado a partir de .specs/roadmap.json (ainda sem ROADMAP.md escrito).",
        catalog: "O catálogo vivo (.specs/SPECS.md): todas as features e critérios de aceitação, com os substituídos assinalados.",
        steering: (file) => `Ficheiro de steering .specs/steering/${file} — regras do projeto que todas as features seguem.`,
        artifact: (slug, label, file) => `${label} da feature '${slug}' (.specs/${slug}/${file}).`,
        labels: {
          "classification.md": "Classificação (tracks)", "requirements.md": "Requisitos (EARS)", "design.md": "Design técnico", "test-plan.md": "Plano de testes",
          "eval-plan.md": "Plano de evals", "load-test.md": "Plano de testes de carga", "tasks.md": "Tasks", "bug.md": "Relatório do bug (reprodução · causa raiz · correção)",
          "quickstart.md": "Quickstart", "checklist.md": "Checklist", "integration-plan.md": "Plano de integração", "retro.md": "Retrospetiva",
          "spike.md": "Spike (pergunta · evidência · decisão)", "decisions.md": "Registo de decisões", // 1.14 C2
        },
        tplFeature: (list) => `Um artefacto da spec de uma feature: .specs/{slug}/{artifact} — {artifact} é um de ${list}.`,
        tplSteering: "Um ficheiro de steering: .specs/steering/{file} (um ficheiro .md).",
        truncated: (cap, total) => `Lista de recursos limitada a ${cap} de ${total} — lê os restantes através dos templates specs://feature/{slug}/{artifact} e specs://steering/{file}.`,
      },
      err: {
        noPromptName: "prompts/get precisa do `name` do prompt (uma string).",
        badPromptArgs: 'prompts/get: `arguments` tem de ser um objeto de strings, p. ex. {"args": "login"}.',
        unknownPrompt: (name, list) => `Prompt desconhecido '${name}' — um de: ${list}.`,
        noUri: "resources/read precisa do `uri` do recurso (uma string).",
        badUri: (uri) => `URI de recurso inválido '${uri}' — esperado specs://roadmap, specs://catalog, specs://steering/<ficheiro>.md ou specs://feature/<slug>/<artefacto> (sem '..', sem caminho absoluto, sem outro esquema).`,
        unknownArtifact: (a, list) => `Artefacto desconhecido '${a}' — um de: ${list}.`,
        badSteering: (file) => `Nome de ficheiro de steering inválido '${file}' — um ficheiro .md diretamente em .specs/steering/.`,
        notFound: (uri, detail) => `Recurso não encontrado: ${uri}` + (detail ? ` — ${detail}` : ""),
      },
    },

    // 1.16 C — integração com o Claude Code (status line, ponte do plan mode, spec_import {text}, completion/complete).
    claudeCode: {
      statusLine: {
        head: (slug, kind) => `◆ ${slug}` + (kind === "bugfix" ? " (bugfix)" : kind === "spike" ? " (spike)" : ""),
        tasks: (done, total) => `${done}/${total} tarefas`,
        unverified: (n) => `${n} por verificar`,
        next: (step) => `a seguir: ${step}`,
        none: "◆ dev-spec · ainda sem features — /spec",
        steps: {
          "re-review": (s) => `rever ${s.files.join(", ")}`,
          fill: (s) => `preencher ${s.file}`,
          fix: (s) => (s.file === "bug.md" ? "escrever a causa raiz em bug.md" : `corrigir o gate ${s.phase}`),
          approve: (s) => `aprovar ${s.phase}`,
          tests: () => "escrever os testes e depois aprová-los (Fase 4)",
          tasks: () => "dividir em tarefas",
          implement: (s) => `tarefa ${s.task}`,
          blocked: () => "desbloquear as tarefas (_Depends:_)",
          verify: (s) => (s.suite ? `executar as verificações do projeto (${s.suite.join(", ")})` : `verificar a tarefa ${s.task}`),
          decide: (s) => (s.outcome ? "acrescentar a linha _Outcome:_ à decisão" : "escrever a decisão"),
          promote: () => "go — criar a spec da feature, arquivar o spike",
          archive: () => "no-go — arquivar o spike",
          pivot: () => "pivot — começar um novo spike",
          finish: (s) => (s.again ? "/spec-finish de novo" : "/spec-finish"),
          "sign-off": (s) => (s.again ? "aprovar execution de novo (sign-off)" : "aprovar execution (sign-off)"),
          finished: () => "concluída",
        },
        config: {
          head: "Status line — acrescenta isto ao ~/.claude/settings.json (todos os projetos) ou ao .claude/settings.local.json de um projeto (só nesta máquina — o caminho é desta máquina, por isso nunca no .claude/settings.json versionado):",
          after: "Resultado: uma linha — a feature mais ativa, as suas tarefas, as tarefas por verificar e o próximo passo — e nada fora de um projeto dev-spec.",
          cacheNote: "Este caminho é uma cópia com versão na cache de plugins do Claude Code (…/plugins/cache/…): depois de atualizar o plugin, volta a correr /spec-statusline — a cópia antiga é apagada 14 dias após uma atualização.",
          tryIt: (cmd) => `Experimenta: echo '{"cwd": "<pasta do projeto>"}' | ${cmd}`,
        },
      },
      planBridge: {
        byText: "dev-spec: o utilizador aprovou este plano. Para o acompanhar como spec (critérios EARS, tarefas rastreadas, gates de evidência), sugerir /spec-import — spec_import {tool: \"plan\", text: <o markdown do plano aprovado>} (CLI: dev-spec import plan - < plan.md). O plano gravado em ~/.claude/plans está fora do projeto: importar o texto. Numa alteração rápida não é preciso; importar só com o OK do utilizador.",
        byPath: (rel) => `dev-spec: o utilizador aprovou este plano. Para o acompanhar como spec (critérios EARS, tarefas rastreadas, gates de evidência), sugerir /spec-import — spec_import {tool: "plan", path: "${rel}"} (CLI: dev-spec import plan ${rel}). Numa alteração rápida não é preciso; importar só com o OK do utilizador.`,
      },
      importText: {
        label: "(texto)",
        note: (tool, date) => `> Importado de ${tool} (texto) em ${date}.`,
        orText: "Ou passa o markdown como `text` em vez de `path` (spec_import {tool, text}; CLI: dev-spec import <tool> - < plano.md).",
        textOnly: (tool, list) => `\`text\` importa um único documento — ferramenta ${list}; '${tool}' lê uma pasta: indica o \`path\`.`,
        pathAndText: "Indica `path` ou `text`, não os dois.",
        empty: (tool) => `O texto ${tool} está vazio — nada para importar.`,
      },
      completion: {
        badRequest: 'completion/complete precisa de `ref` ({type: "ref/prompt", name} ou {type: "ref/resource", uri}) e de `argument` {name, value} (texto).',
        promptsOff: "Este servidor não serve prompts (SPEC_MCP_PROMPTS=off) — nada para completar.",
        unknownTemplate: (uri, list) => `Template de recurso desconhecido '${uri}' — um de: ${list}.`,
        unknownArgument: (name, list) => `Argumento desconhecido '${name}' — um de: ${list}.`,
      },
    },

    secPrivacy: {
      sectionNames: {
        "Threat Model": "Modelo de Ameaças", "Security Requirements": "Requisitos de Segurança", "Authentication & Authorization": "Autenticação e Autorização",
        "Secrets & Key Management": "Gestão de Segredos e Chaves", "Security Testing": "Testes de Segurança",
        "Personal Data Inventory": "Inventário de Dados Pessoais", "Lawful Basis & Purpose": "Fundamento de Licitude e Finalidade",
        "Retention & Deletion": "Conservação e Eliminação", "Data Subject Rights": "Direitos dos Titulares dos Dados",
        "Processors & International Transfers": "Subcontratantes e Transferências Internacionais", "DPIA": "AIPD",
        "Consistency Model": "Modelo de Consistência", "Cross-system Writes": "Escritas entre Sistemas", "Delivery & Idempotency": "Entrega e Idempotência",
        "Concurrency": "Concorrência", "Failure Modes": "Modos de Falha",
      },
      allFilled: { sec: "as 5 preenchidas", privacy: "as 6 preenchidas", dist: "as 5 preenchidas" },
      statusSections: { sec: (list) => `Secções de segurança: ${list}`, privacy: (list) => `Secções de privacidade: ${list}`, dist: (list) => `Secções de consistência de dados: ${list}` },
      finishChecks: {
        sec: ["+sec: SAST, auditoria de dependências e análise de segredos limpos numa execução local nova; todos os testes de casos de abuso a verde.",
          "+sec: modelo de ameaças revisto contra o código final — nenhum ponto de entrada ou fronteira de confiança novo sem mitigação."],
        privacy: ["+privacy: acesso/exportação e apagamento verificados de ponta a ponta nos repositórios reais (subcontratantes incluídos).",
          "+privacy: processo de conservação agendado; política de privacidade e registo das atividades de tratamento (art. 30.º) atualizados; decisão sobre a AIPD registada."],
        dist: ["+dist: testes de injeção de falhas a verde numa execução local nova — falha entre o commit e a publicação, entrega duplicada, atualizações concorrentes, uma dependência indisponível.",
          "+dist: nenhuma escrita entre sistemas no código final contorna a sua mitigação (outbox / inbox / saga) — nenhum commit na base de dados seguido de uma publicação direta."],
      },
      clarify: {
        secAccess: "Especifica o que recebe quem chama sem autenticação ou sem autorização (SE … ENTÃO O SISTEMA DEVE negar …) e o nível ASVS que a feature visa.",
        secSecrets: "Especifica que segredos / credenciais a feature trata e que nenhum chega a uma resposta ou a um log (escreve-o como AC).",
        privacyRights: "Especifica os direitos dos titulares que a feature tem de satisfazer (acesso, apagamento, portabilidade…) como ACs, com o prazo de um mês.",
        privacyRetention: "Especifica durante quanto tempo é conservada cada categoria de dados pessoais e o que acontece quando esse prazo termina.",
        distDelivery: "Especifica a garantia de entrega (pelo menos uma vez) e como uma mensagem entregue duas vezes é detetada e aplicada uma só vez (chave de idempotência, inbox) — escreve-o como AC.",
        distFailure: "Especifica o que a feature faz quando cada dependência (base de dados, broker, API externa) está indisponível ou excede o tempo limite — como critérios SE … ENTÃO O SISTEMA DEVE.",
      },
    },

    markerSyntax: {
      doctor: (list) => `texto com forma de marcador numa linha de tarefa não dá nenhum marcador: ${list} — as ferramentas não leem nada aí (nenhuma verificação é executada, nenhum ficheiro é rastreado). Escreve-o como _Verify: <comando>_ / _Implements: <caminho>_ / _Depends: 3_ (em itálico, com o valor lá dentro).`,
    },
    outsideCode: {
      doctor: (list) => `testes planeados fora do código de testes apontam para um artefacto que ainda é um modelo: ${list} — preenche-o (a execução de carga real, o conjunto de avaliação da própria feature) antes de considerar esses testes verificados.`,
    },

    verifyPipe: {
      brief: (cmds) => `⚠ ${cmds.map((c) => "`" + c + "`").join(", ")} ${cmds.length > 1 ? "encaminham" : "encaminha"} a saída para outro comando (pipe): o exit code de um pipeline é o do ÚLTIMO comando, por isso uma verificação que falha pode sair com 0 e passar por verificada. Tira o pipe, ou corre-o em bash depois de \`set -o pipefail\` (o cmd.exe não tem pipefail) — o exit code que reportas tem de ser o da própria verificação.`,
      runHint: (cmd) => `⚠ \`${cmd}\` encaminha a saída para outro comando (pipe): a shell só reporta o exit code do ÚLTIMO comando, por isso uma verificação que falha pode ficar registada como bem-sucedida — tira o pipe, ou começa-o com \`set -o pipefail;\` em bash (--shell bash); o cmd.exe não tem pipefail.`,
      doctor: (list) => `um comando _Verify:_ encaminha a saída para outro (pipe) — uma verificação que falha pode sair com 0 (um pipeline reporta o código do ÚLTIMO comando): ${list}. Tira o pipe ou usa \`set -o pipefail\` (bash).`,
      completeNote: (n, cmd) => `Tarefa ${n}: o comando registado encaminha a saída para outro (\`${cmd}\`) — o seu exit 0 é o do ÚLTIMO comando, por isso esta passagem pode esconder uma verificação que falha. Tira o pipe (ou usa \`set -o pipefail\` em bash) e corre-o de novo.`,
    },

    templates: {
      noSummary: "[a definir]",
      badAction: (a) => `Ação de templates desconhecida '${a}' — uma de: list, init, check.`,
      unknownArtifact: (a, list) => `Template desconhecido '${a}' — um de: ${list}, ou steering/<ficheiro>.md.`,
      writeFailed: (rel, why) => `Não foi possível escrever ${rel} (${why}).`,
      writeOutside: (rel) => `Recusei escrever ${rel}: a pasta é uma ligação para fora do projeto.`,
      legacyFeature: ".specs/templates/ é a pasta de uma feature criada antes de existirem templates do projeto (tem um .state.json) — continua a ser essa feature e nunca é lida como templates. Muda-lhe o nome (dev-spec feature rename templates <novo-nome>, ou spec_feature rename) para usares templates do projeto.",
      builtIn: "de base",
      override: "do projeto",
      listHead: (lang, n) => `Templates para features em '${lang}' — ${n} template(s) do projeto em .specs/templates/ (um ficheiro em <lang>/ prevalece sobre um partilhado):`,
      ignored: (list) => `Ignorados — não são templates que o dev-spec conheça: ${list}`,
      initDone: (n) => `${n} template(s) de base copiado(s) para .specs/templates/ — edita-os; os novos scaffolds passam a usá-los:`,
      initKept: (list) => `Mantidos (já existiam — nunca são substituídos): ${list}`,
      initNothing: "Nada copiado — todos os templates pedidos já estão em .specs/templates/.",
      checkNone: "Nenhum template do projeto para verificar — .specs/templates/ não tem nenhum (`dev-spec templates init` copia os de base).",
      checkHead: (n, errors, warnings) => `${n} ficheiro(s) de template verificado(s) — ${errors} erro(s), ${warnings} aviso(s).`,
      appends: (file, list) => `${file}: o motor acrescenta ele próprio as secções ${list} (o template não tem os respetivos títulos).`,
      problems: {
        empty: "vazio — ignorado; é usado o template de base.",
        "unknown-file": "não é um template que o dev-spec conheça (ver spec_templates list) — ignorado.",
        "unknown-variable": (v) => `{{${v}}} não é uma variável de template — fica tal como está (conhecidas: {{name}} {{slug}} {{summary}} {{tracks}} {{lang}} {{date}}).`,
        "no-placeholders": "nenhum campo [entre parênteses retos] nem linha > **TODO** — um scaffold por editar pareceria preenchido e o seu gate poderia ser aprovado sem alterações.",
        "missing-section": (marker, section) => `falta ${marker} ${section} — o template tem outros títulos ${marker}, por isso o motor não acrescenta nenhuma secção desse track e o doctor falha nesta.`,
        "no-sentinel": (marker, section) => `${marker} ${section} não tem linha > **TODO** — numa feature nova a secção pareceria preenchida (o template de base semeia uma).`,
        "constitution-missing": "sem secção Verificação da Constituição (Constitution Check) — o doctor avisa em todas as features criadas a partir dele.",
        "tradeoffs-missing": "sem secção Alternativas e Compromissos — o doctor avisa (design-tradeoffs) em todas as features criadas a partir dele.",
        "risks-missing": "sem secção Riscos — o doctor avisa (design-risks) em todas as features criadas a partir dele.",
        "no-criteria": "nenhum critério de aceitação (uma linha US-n.AC-m com DEVE) — nada para o EARS, o trace_check ou o plano de testes seguirem.",
        "ac-duplicate": (ids) => `IDs de AC duplicados: ${ids} — o doctor falha em todas as features criadas a partir dele.`,
        "phantom-ac": (ids, file) => `cita IDs de AC que ${file} não define: ${ids} — o trace_check reporta-os como fantasmas.`,
        "builtin-phantom": (file, ids) => `o ${file} de base (não substituído) cita IDs de AC que este template não define: ${ids} — substitui também o ${file}, ou mantém esses IDs.`,
        "phantom-test": (ids, file) => `põe a verde IDs de teste que ${file} não define: ${ids} — o trace_check reporta-os como testes desconhecidos em todas as features +tdd.`,
        "builtin-phantom-test": (file, ids) => `o ${file} de base de uma feature +tdd (não substituído) põe a verde IDs de teste que este template não define: ${ids} — substitui também o ${file}, ou mantém esses IDs.`,
        "root-cause-missing": "sem secção Causa Raiz — o gate do bugfix (root-cause do doctor) falharia em todos os bugfixes até ser acrescentada.",
        "root-cause-filled": "a Causa Raiz já parece escrita (texto, sem campo, sem linha > **TODO**) — um bugfix novo passaria o gate da causa raiz antes de a causa ser conhecida.",
        "repro-missing": "sem secção Reprodução — o doctor avisa em todos os bugfixes.",
        "repro-filled": "a Reprodução já parece escrita — um bugfix novo não pediria os passos.",
        "no-tasks": "nenhuma linha de tarefa (- [ ] 1. …) — um scaffold a partir dele não tem nada para executar.",
        "no-active-tracks": "sem título 'Tracks ativos' — o spec_add_track não consegue registar uma mudança de track no classification.md.",
        "filematch-no-pattern": "o front matter diz inclusion: fileMatch mas não indica nenhum fileMatchPattern — o ficheiro só é listado a pedido.",
      },
    },

    trackPacks: {
      acHeading: "Critérios de Aceitação (EARS)",
      taskHeading: (marker, title) => `História US-1 — ${marker} ${title}`,
      todoLine: "> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).",
      defaultCriterion: (title) => `O SISTEMA DEVE [o comportamento de ${title} que esta feature garante]`,
      defaultTask: (marker, title) => `[US1] Cumprir os critérios ${marker} ${title} — preencher as secções de design, implementar e verificar`,
      rowLayer: "integração",
      rowDesc: "[comportamento]",
      checklistItem: (n) => `${n} secção(ões) obrigatória(s) de design preenchida(s) (sem TODO) — cada critério verificado.`,
      steeringStub: (title, name) => `# ${title}\n\n<!-- As normas de ${title} da equipa: todas as features +${name} as seguem (o spec_task_brief cita este ficheiro). -->\n- [fill me in]\n`,
      allFilled: (marker) => `todas as secções ${marker} preenchidas`,
      statusSections: (marker, list) => `Secções ${marker}: ${list}`,
      missing: (list) => `track pack(s) indisponível(eis): ${list} — o track fica inativo nesta feature até o pack voltar (dev-spec tracks check).`,
      missingAbsent: (name) => `+${name} (não há .specs/tracks/${name}/ neste projeto)`,
      missingInvalid: (name, codes) => `+${name} (o pack é inválido: ${codes})`,
      badAction: (a) => `Ação de tracks desconhecida '${a}' — uma de: list, init, check.`,
      nameRequired: "o tracks init precisa de um nome — dev-spec tracks init <nome> (spec_tracks {action: \"init\", name}).",
      unknownPack: (n, list) => `Não há track nem track pack '${n}' — os packs do projeto: ${list}.`,
      legacyFeature: ".specs/tracks/ é a pasta de uma feature criada antes de existirem track packs (tem um .state.json) — continua a ser essa feature e nunca é lida como packs. Muda-lhe o nome (dev-spec feature rename tracks <novo-nome>, ou spec_feature rename) para usar track packs.",
      writeFailed: (rel, why) => `Não foi possível escrever ${rel} (${why}).`,
      writeOutside: (rel) => `Recusei escrever ${rel}: a pasta é uma ligação para fora do projeto.`,
      builtIn: "incluído",
      sectionCount: (n) => `${n} secção(ões)`,
      signalCount: (n) => `${n} sinal(is)`,
      invalid: (n) => `inválido (${n} erro(s)) — ignorado; detalhes: dev-spec tracks check`,
      noPacks: "Não há track packs em .specs/tracks/ — o `dev-spec tracks init <nome>` cria um.",
      listHead: (builtIn, packs, valid) => `Tracks — ${builtIn} incluídos, ${packs} pack(s) do projeto em .specs/tracks/ (${valid} válido(s)):`,
      checkNone: "Não há track packs a verificar — .specs/tracks/ não tem nenhum (o `dev-spec tracks init <nome>` cria um).",
      checkHead: (n, valid, errors, warnings) => `${n} track pack(s) verificado(s) — ${valid} válido(s), ${errors} erro(s), ${warnings} aviso(s).`,
      initDone: (name, n) => `Track pack +${name} criado (${n} ficheiro(s)) — edita-os; a partir de agora é um track válido:`,
      initKept: (list) => `Mantidos (já existiam — nunca são substituídos): ${list}`,
      initNothing: (name) => `Nada escrito — todos os ficheiros do pack +${name} já existem.`,
      initNext: (name) => `A seguir: verificar com dev-spec tracks check e usar com dev-spec add-track <feature> ${name} (spec_add_track) ou ao criar uma feature.`,
      initJson: (a) => `// Track pack +${a.name} — um track definido pelo projeto (dev-spec 1.15). Só dados: nada nesta pasta é executado.
// Guia: references/project-tracks.md · validação: dev-spec tracks check (spec_tracks {action: "check"}).
{
  // = o nome desta pasta: ^[a-z][a-z0-9]{1,19}$, nunca um track incluído (core tdd saas ai sec privacy dist).
  "name": "${a.name}",
  // O marcador estável (sensível a maiúsculas) das secções de design, dos critérios e do bloco de tarefas: [${a.token}].
  "marker": "${a.token}",
  // Aparece nos títulos ("#### [${a.token}] ${a.title} — Critérios de Aceitação (EARS)"); en é obrigatório, es / pt-BR opcionais.
  "title": { "en": "${a.title}", "pt": "${a.title}" },
  // Palavras-chave do classificador, comparadas como palavras inteiras (com flexões): uma "strong" liga o track, duas "weak" também,
  // uma "context" só corrobora outra. Uma palavra-chave em MAIÚSCULAS é uma sigla, comparada com maiúsculas e minúsculas exatas.
  "signals": { "strong": [], "weak": [], "context": [] },
  // As secções obrigatórias de design: o design.md recebe "## [${a.token}] <nome>" + uma linha > **TODO** para cada uma; o doctor
  // (${a.name}-sections) e a aprovação do design falham até todas estarem preenchidas. syn: outros títulos que contam (qualquer língua).
  "sections": [
    { "name": { "en": "Standards", "pt": "Normas" }, "syn": [], "guidance": { "en": "The ${a.title} standards this feature meets, and how each one is verified.", "pt": "As normas de ${a.title} que esta feature cumpre, e como cada uma é verificada." } },
    { "name": { "en": "Verification", "pt": "Verificação" }, "syn": [], "guidance": { "en": "Who checks it, with which tools, before the merge.", "pt": "Quem a verifica, com que ferramentas, antes do merge." } }
  ],
  // Opcional: o ficheiro de steering que o track traz (.specs/steering/<ficheiro>, escrito a partir do steering.md quando uma feature acrescenta o track).
  "steering": "${a.name}.md"
}
`,
      initRequirements: (a) => `<!-- Track pack +${a.name}: os critérios de aceitação com que começa cada feature +${a.name} — um item da lista = um critério, em EARS.
     O motor numera-os a seguir aos critérios US-1 da feature (US-1.AC-n), em "#### [${a.token}] ${a.title} — Critérios de Aceitação (EARS)".
     Os espaços [entre parênteses retos] continuam a ser placeholders do template até a feature os preencher. -->
- QUANDO [gatilho] O SISTEMA DEVE [o comportamento de ${a.title}]
- O SISTEMA DEVE [uma propriedade de ${a.title} que se mantém sempre]
`,
      initTasks: (a) => `<!-- Um item da lista = uma tarefa do bloco "História US-1 — [${a.token}] ${a.title}" da feature (numerada a seguir à última tarefa).
     {{ac1}}, {{ac2}}… = os critérios deste pack tal como a feature os numera, {{acs}} = todos; {{t1}}… / {{tests}} = os testes
     planeados para eles (+tdd — uma linha que não nomeie nenhum é deixada de fora). Uma tarefa sem _Requirements:_ recebe {{acs}}. -->
- [ ] [as decisões de design de ${a.title} desta feature]
  - _Requirements: {{acs}}_
- [ ] [implementar e verificar os critérios de ${a.title}]
  - _Requirements: {{acs}}_
  - _Makes green: {{tests}}_
`,
      initTestPlan: (a) => `<!-- Uma linha = um teste planeado (features +tdd) — as seis células do plano incluído; a célula Test ID é renumerada a seguir às do plano. -->
| Test ID | Camada | Tipo | Descrição | Cobre (IDs de AC) | Ficheiro |
|---------|--------|------|-----------|-------------------|----------|
| T-00 | integração | example | [o comportamento de ${a.title}, de ponta a ponta] | {{ac1}} | \`tests/integration/...\` |
| T-00 | unit | property | [a propriedade de ${a.title} sempre verdadeira] | {{ac2}} | \`tests/unit/...\` |
`,
      initChecklist: (a) => `<!-- Um item da lista = uma linha do checklist.md da feature ("- [ ] ${a.token}: …"). -->
- todas as secções de design [${a.token}] preenchidas (sem TODO) e revistas.
- [a verificação de ${a.title} que a equipa faz antes do merge]
`,
      initSteering: (a) => `# ${a.title}

<!-- As normas de ${a.title} da equipa — todas as features +${a.name} as seguem (o spec_task_brief cita este ficheiro). -->
- [fill me in]
`,
      problems: {
        "linked-folder": "uma ligação (symlink / junction) ou uma pasta fora de .specs/ — ignorada: um pack só é lido da sua própria pasta.",
        "unknown-file": "não é um ficheiro de pack (track.json, requirements.md, tasks.md, test-plan.md, checklist.md, steering.md, <língua>/) — ignorado.",
        "too-many-packs": (a) => `mais de ${a.max} track packs — este é ignorado.`,
        "name-invalid": (a) => `'${a.name}' não é um nome de track (^[a-z][a-z0-9]{1,19}$ — letras minúsculas e dígitos) — o pack é ignorado.`,
        "name-reserved": (a) => `'${a.name}' está reservado (um track incluído, uma palavra para um, ou uma palavra que o dev-spec usa) — o pack é ignorado.`,
        "name-mismatch": (a) => `"name": "${a.name}" não é o nome da pasta '${a.folder}' — o pack é ignorado.`,
        "json-missing": "não há track.json — o pack é ignorado.",
        "json-invalid": (a) => `o track.json não é JSON válido (${a.detail}) — o pack é ignorado.`,
        "too-big": (a) => `${a.file} tem mais de ${a.max} bytes — o pack é ignorado.`,
        "fragment-linked": (a) => `${a.file} não é um ficheiro normal dentro de .specs/ (é uma ligação ou uma pasta) — o pack é ignorado.`,
        "field-missing": (a) => `falta "${a.field}" (${a.rule}) — o pack é ignorado.`,
        "field-invalid": (a) => `"${a.field}" é inválido (${a.rule}) — o pack é ignorado.`,
        "marker-invalid": (a) => `o marcador '${a.marker}' não é ^[A-Z][A-Z0-9]{1,11}$ — o pack é ignorado.`,
        "marker-reserved": (a) => `o marcador [${a.marker}] é do dev-spec (um marcador incluído, uma etiqueta de história / paralela ou um espaço genérico) — o pack é ignorado.`,
        "marker-duplicate": (a) => `o marcador ${a.marker} já é do pack +${a.other} — os marcadores são únicos; este pack é ignorado.`,
        "signal-invalid": (a) => `signals.${a.tier}: '${a.keyword}' não é uma palavra-chave (letras e dígitos com espaços, - ' . no meio — 2 a 60 caracteres; sempre comparada como palavra literal, nunca como padrão) — o pack é ignorado.`,
        "too-many": (a) => `${a.field}: mais de ${a.max} — o pack é ignorado.`,
        "section-duplicate": (a) => `a secção '${a.name}' tem o nome repetido — o pack é ignorado.`,
        "steering-invalid": (a) => `o steering '${a.file}' não é um nome de ficheiro de steering (minúsculas, dígitos e -, terminado em .md; não um nome de dispositivo) — o pack é ignorado.`,
        "steering-shared": (a) => `o steering ${a.file} também é um ficheiro de steering incluído — fica o que for escrito primeiro.`,
        "unknown-key": (a) => `chave desconhecida "${a.key}" — ignorada.`,
        "unknown-variable": (a) => `{{${a.v}}} não é uma variável de pack — fica como está (conhecidas: {{ac1}}… {{acs}} {{t1}}… {{tests}} {{title}} {{marker}} {{name}} {{slug}}).`,
        "fragment-empty": (a) => `${a.file} não tem nada que o motor leia — é usado o padrão incluído.`,
        "fragment-row": (a) => `uma linha de ${a.file} sem as seis células do plano (Test ID | Camada | Tipo | Descrição | Cobre | Ficheiro) — o pack é ignorado.`,
        "fragment-ref": (a) => a.kind === "t" && a.file !== "tasks.md" ? `${a.ref} não pode ser usado em ${a.file} — só o tasks.md nomeia os testes planeados — o pack é ignorado.`
          : `${a.ref} não nomeia nada ${a.ctx ? "nas features " + a.ctx : "na raiz do pack"}: ${a.from || "o padrão incluído"} dá ${a.n} ${a.kind === "ac" ? "critério(s)" : "teste(s) planeado(s)"} — o pack é ignorado.`,
        "section-name-lead": (a) => `o nome de secção '${a.name}' começa por numeração, um emoji ou um travessão — ignorado ao comparar títulos: conta como '${a.key}'.`,
        "section-core-name": (a) => `a secção '${a.name}' tem o nome de um título do design base ('${a.heading}') — só conta um título com o marcador do pack (ou debaixo de um); a secção base nunca conta.`,
      },
    },

    stakeholderExport: {
      autogen: "AUTO-GERADO por dev-spec — não editar à mão. Para regenerar: spec_export (dev-spec export).",
      kicker: { feature: "Especificação da feature", bugfix: "Especificação do bugfix", project: "Especificação do projeto" },
      projectTitle: (proj) => `${proj} — visão geral da especificação`,
      generated: (date) => `gerado a ${date} a partir das specs do projeto (.specs/)`,
      meta: { id: "Feature", kind: "Tipo", tracks: "Tracks", phase: "Fase", progress: "Progresso", status: "Estado", lang: "Idioma", overall: "Progresso global" },
      kind: { feature: "feature", bugfix: "bugfix" },
      progress: (done, total, pct) => `${done}/${total} tasks feitas · ${pct}%`,
      overall: (pct, complete, total, done, tasks) => `${pct}% · ${complete}/${total} features completas · ${done}/${tasks} tasks feitas`,
      sections: {
        contents: "Índice", summary: "Resumo", stories: "Histórias de utilizador e critérios de aceitação", successCriteria: "Critérios de sucesso", bug: "Relatório do bug",
        design: "Design", testPlan: "Plano de testes", tasks: "Tasks", decisions: "Decisões", approvals: "Aprovações", clarifications: "Clarificações em aberto",
        roadmap: "Roadmap", backlog: "Backlog", catalog: "Catálogo vivo",
      },
      cols: { task: ["#", "Task", "Estado", "Verificação"], approval: ["Fase", "Aprovado por", "Quando", "Notas"], roadmap: ["Feature", "Tracks", "Fase", "Progresso", "Tasks", "Depende de"] },
      taskStatus: { done: "✅ feita", open: "☐ por fazer" },
      verification: { verified: "verificada", nothing: "nada a verificar", open: "—", unverified: (why) => "⚠ não verificada" + (why ? ` (${why})` : "") },
      phases: { classification: "Classificação", requirements: "Requisitos", design: "Design", "test-plan": "Plano de testes", "eval-plan": "Plano de evals", tests: "Testes (Fase 4)", tasks: "Tasks", execution: "Aprovação da execução" },
      forced: (ids) => `aprovado com --force (a falhar: ${ids})`,
      changedSince: "alterado desde esta aprovação — a rever de novo",
      pending: "a aguardar aprovação",
      template: "template — ainda por escrever",
      supersededBy: (list) => `substituído por ${list}`,
      toBeSupersededBy: (list) => `substituição prevista por ${list} (ainda não entregue)`,
      supersedes: (list) => `substitui ${list}`,
      blocked: (list) => `bloqueada por ${list}`,
      none: "Nada.",
      noSummary: "Ainda sem resumo.",
      noStories: "Ainda sem histórias de utilizador nem critérios de aceitação.",
      noDesign: "Ainda sem design.",
      noTasks: "Ainda sem tasks.",
      noApprovals: "Ainda nenhuma fase aprovada.",
      noClarifications: "Nenhuma — não há marcadores [NEEDS CLARIFICATION] por resolver.",
      noFeatures: "Ainda sem features.",
      theme: "Tema",
      print: "Imprimir",
      wrote: (file) => `✎ gerado ${file}`,
      exportsIsFeature: (dir) => `${dir} é uma pasta de feature anterior à reserva do nome 'exports' pelo dev-spec (contém requirements.md / .state.json) — move ou renomeia essa pasta à mão e volta a exportar.`,
    },
    rtm: {
      title: "Matriz de rastreabilidade",
      projectTitle: "Rastreabilidade",
      autogen: "AUTO-GERADO por dev-spec — não editar à mão. Para regenerar: dev-spec export --csv (spec_export format csv).",
      cols: {
        feature: "Feature", id: "ID", kind: "Tipo", requirement: "Requisito", status: "Estado", gaps: "Lacunas", template: "Template", design: "Secções do design",
        tasks: "Tasks", tests: "Testes", testFiles: "Ficheiros de teste", evidence: "Última evidência", decisions: "Decisões", supersedes: "Critérios que substitui",
        supersededBy: "Substituído por", approvedAt: "Requisitos aprovados", approvedBy: "Aprovado por", changed: "Alterado desde a aprovação",
      },
      projectCols: ["Feature", "Requisitos", "Verificados", "Implementados", "Planeados", "Sem rastreio"],
      status: { verified: "verificado", implemented: "implementado", planned: "planeado", untraced: "sem rastreio" },
      gap: {
        "no-task": "nenhuma task o cita", "no-test": "nenhuma linha do plano de testes o cobre", "no-coverage": "nenhuma task nem teste planeado o cobre",
        "no-coverage-sc": "nenhuma linha do plano de testes nem do quickstart o cobre",
      },
      yes: "sim", no: "não", unknown: "desconhecido",
      forced: "forçada",
      task: {
        verified: (n) => `#${n} verificada`, nothing: (n) => `#${n} feita (nada a verificar)`, open: (n) => `#${n} por fazer`,
        unverified: (n, why) => `#${n} feita, não verificada${why ? ` (${why})` : ""}`,
      },
      evidence: (n, cmd, code, at, commit, expectedFail) => `#${n}: ${cmd} → saída ${code}${expectedFail ? " (execução vermelha, falha esperada)" : ""}${commit ? ` @${commit}` : ""}${at ? ` · ${at}` : ""}`,
      evidenceNote: (n, note, at) => `#${n}: nota — ${note}${at ? ` · ${at}` : ""}`,
      notInCode: "em nenhum ficheiro de teste",
      outsideCode: "executado fora do código de teste",
      template: "template — ainda por escrever",
      supersededBy: (list) => `substituído por ${list}`,
      toBeSupersededBy: (list) => `substituição prevista por ${list} (ainda não entregue)`,
      changedSince: "alterado desde a aprovação dos requisitos",
      legend: "Uma linha por ID de requisito. Tasks: ✅ verificada · ⚠ feita, não verificada · ☐ por fazer. Estado: verificado — todas as tasks ligadas feitas e verificadas; implementado — feitas, nem todas verificadas; planeado — rastreado, com trabalho por fazer; sem rastreio — uma lacuna de rastreio (indicada).",
      projectLegend: "IDs de requisito (AC / EC / NFR / SC) por feature, por estado de rastreabilidade — a exportação de cada feature tem a sua matriz.",
      approvedLine: (at, by, forced) => `Requisitos aprovados em ${at} por ${by}${forced ? " (com --force)" : ""}.`,
      notApproved: "Requisitos ainda não aprovados.",
      none: "Ainda sem IDs de requisito.",
      cli: {
        head: (feature, tracks, c) => `Matriz de rastreabilidade — ${feature} (${tracks}): ${c.rows} requisito(s) · ${c.verified} verificado(s) · ${c.implemented} implementado(s) · ${c.planned} planeado(s) · ${c.untraced} sem rastreio`,
        legend: "tasks: ✓ verificada · ▲ feita, não verificada · ○ por fazer",
        codeLegend: "testes: ✓ nomeado num ficheiro de teste · ✗ em nenhum ficheiro de teste · ○ executado fora do código de teste",
        approved: (at, by, forced) => `requisitos aprovados em ${at} por ${by}${forced ? " (forçada)" : ""}`,
        notApproved: "requisitos ainda não aprovados",
        notes: { template: "template", superseded: (list) => `substituído por ${list}`, changed: "alterado desde a aprovação" },
      },
    },
    releaseNotes: {
      title: (proj) => `Notas de versão — ${proj}`,
      autogen: "AUTO-GERADO por dev-spec — não editar à mão. Para regenerar: spec_changelog {write: true} (dev-spec changelog --write).",
      sinceDate: (d) => `Alterações desde ${d}`,
      sinceLast: (d) => `Alterações desde as últimas notas de versão (${d})`,
      all: "Todas as alterações registadas nas specs",
      generated: (d) => `geradas a ${d}`,
      added: "Adicionado",
      changed: "Alterado",
      fixed: "Corrigido",
      none: "Nada.",
      rootCause: (t) => `Causa raiz: ${t}`,
      noRootCause: "causa raiz por escrever no bug.md",
      changeRequest: (n, phase, d) => `pedido de alteração #${n} (${phase}, ${d})`,
      crParts: { added: (l) => `adicionado: ${l}`, modified: (l) => `alterado: ${l}`, removed: (l) => `removido: ${l}`, reopened: (l) => `tasks reabertas: ${l}` },
      wrote: (file, a, c, f) => `✎ gerado ${file} — ${a} adicionado(s) · ${c} alterado(s) · ${f} corrigido(s)`,
      nothingToWrite: (file) => `Nada a reportar desde então — ${file} não foi escrito e meta.changelogAt fica como estava.`,
      badSince: (v) => `since: '${v}' não é uma data ISO (AAAA-MM-DD, ou um timestamp ISO completo), 'last' nem 'all'.`,
      noLast: "Ainda não foram escritas notas de versão (roadmap.json meta.changelogAt não está definido) — são listadas todas as alterações.",
    },
    gherkin: {
      autogen: "AUTO-GERADO por dev-spec — não editar à mão. Para regenerar: spec_export {format: \"gherkin\"} (dev-spec export <feature> --gherkin).",
      source: (rel) => `Origem: ${rel} — um cenário por critério de aceitação em vigor; EARS → Dado (ENQUANTO / ONDE / SE) · Quando (QUANDO) · Então (a cláusula DEVE).`,
      summaryLabel: "Resumo",
      template: (id) => `${id} — template, ainda por escrever: deixado de fora`,
      superseded: (id, by) => `${id} — substituído por ${by} (entregue): deixado de fora`,
      unsplit: "cláusulas EARS sem separação limpa — o critério inteiro é um único passo Então",
      noScenarios: "Ainda sem critérios de aceitação em vigor.",
      spike: (slug) => `'${slug}' é um spike — não tem critérios de aceitação a exportar em Gherkin (spec_export {name: "${slug}"} sem o formato gherkin exporta o seu documento).`,
      wroteMany: (n, scenarios) => `✎ gerados ${n} ficheiro(s) .feature — ${scenarios} cenário(s)`,
      noFeatures: "Nenhuma feature ativa com critérios de aceitação a exportar.",
    },
    trackerCsv: {
      autogen: "AUTO-GERADO por dev-spec — não editar à mão; deixa esta coluna sem mapeamento. Para regenerar: spec_export {format: \"jira\" | \"linear\"} (dev-spec export --tracker jira|linear).",
      featureLine: (rel, tracks, phase, done, total) => `feature dev-spec ${rel} · tracks ${tracks} · fase: ${phase} · ${done}/${total} tasks feitas`,
      acceptance: "Critérios de aceitação:",
      taskLine: (rel, n) => `task dev-spec #${n} — ${rel}`,
      wrote: (file, n) => `✎ gerado ${file} — ${n} item(s) de trabalho`,
    },
    milestone: {
      title: "Marcos",
      cols: ["Marco", "Data", "Features", "Feitas", "ETA", "Estado"],
      status: { "on-track": "no prazo", "at-risk": "em risco", late: "atrasado", done: "concluído" },
      archivedLabel: "arquivadas",
      line: (name, date, done, total, eta, status, feats, archived) => `${name} — ${date} · ${done}/${total} feature(s) feitas · ETA ${eta || "—"} · ${status} · ${feats || "—"}${archived ? ` (arquivadas: ${archived})` : ""}`,
      head: (n, today) => `${n} marco(s) — hoje ${today}:`,
      none: "Ainda sem marcos — adiciona um: dev-spec milestone add <nome> <AAAA-MM-DD> <features…> (spec_milestone {action: \"add\", name, date, features}).",
      added: (name, date, list) => `Marco '${name}' adicionado — ${date}: ${list}`,
      updated: (name, date, list) => `Marco '${name}' atualizado — ${date}: ${list}`,
      removed: (name) => `Marco '${name}' removido.`,
      attention: {
        late: (date, done, total, eta) => `marco atrasado — a data ${date} já passou com ${done}/${total} feature(s) feitas${eta ? ` (ETA ${eta})` : ""}`,
        "eta-after-date": (date, eta) => `marco em risco — o ETA mais tardio das suas features (${eta}) é posterior à data ${date}`,
        "eta-unknown": (date, eta, list) => `marco em risco — ainda sem ETA para ${list} (data ${date}): dados de velocidade insuficientes, ou ainda sem tasks`,
        "no-features": (date) => `marco em risco — já não tem nenhuma feature ativa (data ${date})`,
        invalid: (n, names, rel) => `${n} entrada(s) inválida(s) (${names}) em ${rel} — ignoradas: sem estado, e renomear / arquivar / remover / restaurar uma feature não as atualiza; corrige-as à mão (um nome válido, um dia AAAA-MM-DD real, listas de slugs de features, uma entrada por nome).`,
        notList: (rel) => `${rel} → meta.milestones não é uma lista — nenhum marco é lido, e renomear / arquivar / remover / restaurar uma feature não o atualiza; corrige-o à mão.`,
      },
      nameRequired: "Indica o nome do marco (name).",
      badName: (v) => `nome de marco inválido '${v}' — letras, dígitos, espaços e . _ : # ( ) + - (até 60 caracteres, a começar por uma letra ou um dígito).`,
      badDate: (v) => `date: '${v}' não é um dia no formato AAAA-MM-DD (p. ex. 2026-10-31).`,
      noFeatures: "Indica pelo menos uma feature do marco (features).",
      unknownFeatures: (list) => `Cada feature do marco tem de ser uma feature ativa existente — não encontrada(s): ${list}`,
      tooMany: (max) => `no máximo ${max} marcos — remove um primeiro (dev-spec milestone rm <nome>).`,
      tooManyFeatures: (max) => `no máximo ${max} features por marco.`,
      notFound: (name, list) => `Não existe o marco '${name}' (marcos: ${list}).`,
      badStored: (rel) => `${rel} → meta.milestones não é uma lista de {name, date, features} como o milestone add os escreve (um nome válido, um dia AAAA-MM-DD real, uma entrada por nome) — corrige-o à mão; recuso alterá-lo.`,
      notesTitle: (title, name) => `${title} — ${name}`,
      notesScope: (name, date, list) => `Marco ${name} (${date}): ${list}`,
      notesAutogen: "AUTO-GERADO por dev-spec — não editar à mão. Para regenerar: spec_changelog {milestone, write: true} (dev-spec changelog --milestone <nome> --write).",
      nothingToWrite: (file) => `Nada a reportar para este marco — ${file} não foi escrito.`,
    },

    governance: {
      rolesShape: "approvalRoles tem de associar fases a listas de papéis, p. ex. {\"requirements\": [\"product\"], \"design\": [\"tech\", \"security\"]} (CLI: --roles requirements=product,design=tech+security; --roles none remove-os)",
      rolesPhase: (phase, known) => `approvalRoles: fase desconhecida '${phase}' (conhecidas: ${known})`,
      rolesEmpty: (phase) => `approvalRoles.${phase}: indica pelo menos um papel`,
      badRole: (role) => `nome de papel inválido '${role}' — usa letras, dígitos, '-', '_' ou '.' (no máximo 40 caracteres)`,
      rolesSet: (summary) => `Papéis de aprovação: ${summary} — cada fase indicada só conta como aprovada quando todos os papéis tiverem validado o seu conteúdo atual (spec_approve {role} / --role).`,
      rolesCleared: "Papéis de aprovação removidos — cada fase volta a precisar de uma única aprovação.",
      phaseRequired: "Indica a fase a aprovar — ou through: <fase> (CLI: --through <fase>) para avançar rapidamente até ela.",
      roleRequired: (phase, slug, roles) => `'${phase}' é validada por papel (${roles}) — indica o papel com que validas: /approve ${slug} ${phase} --role <papel> (spec_approve {role}). Nada foi registado.`,
      roleNotListed: (role, phase, roles) => `'${role}' não é um papel que valide '${phase}' (papéis: ${roles}) — nada foi registado.`,
      missing: (list) => `${list.length > 1 ? "faltam os papéis" : "falta o papel"}: ${list.join(", ")}`,
      stepForced: (ids) => ` (forçada: ${ids.join(", ")})`,
      signedOff: (phase, slug, role) => `'${phase}' de ${slug} validada como ${role} ✓`,
      signedForced: (ids) => `Validado com force — as verificações a falhar ficam registadas com a validação: ${ids}.`,
      stillPending: (phase, missing) => `'${phase}' continua pendente até todos os papéis validarem o seu conteúdo atual — ${missing}.`,
      approvedByRoles: (phase, roles) => `'${phase}' está aprovada — todos os papéis validaram o conteúdo atual: ${roles}.`,
      staleSignOffs: (list) => `as validações feitas antes de o artefacto mudar já não contam (volta a validar o conteúdo atual): ${list}`,
      resigning: (list) => `nova validação em curso (a fase continua aprovada como estava até todos os papéis validarem o novo conteúdo): ${list}`,
      unsigned: (list) => `aprovado sem as validações por papel agora exigidas (aprovado antes de os papéis serem configurados ou alterados — conta como aprovado por um papel desconhecido; pede a cada papel que volte a validar): ${list}`,
      approveRoles: (phase, slug, missing, signed, first) => `Revê e valida '${phase}' — ${missing}${signed ? ` (já validaram: ${signed})` : ""}: /approve ${slug} ${phase} --role ${first}.`,
      roadmapAwaiting: (list) => `à espera de validação por papel: ${list}`,
      resignHint: (list, cmd) => `Cada papel volta a validar o novo conteúdo — ${list}: ${cmd}.`,
      ffBoth: "Passa uma fase ou through (o avanço rápido), não as duas.",
      ffExecution: "O avanço rápido cobre só as fases de planeamento (no máximo até 'tasks') — valida 'execution' à parte, depois do /spec-finish.",
      ffNotActive: (phase, slug) => `'${phase}' não é uma fase aprovável de '${slug}' neste momento (o track está desativado, ou o plano que valida ainda não existe) — nada foi aprovado.`,
      ffNothing: (slug, through) => `Nada para avançar: todas as fases ativas de '${slug}' até '${through}' já estão aprovadas.`,
      ffDone: (slug, list, through) => `Avanço rápido de '${slug}': ${list} aprovadas, por ordem, cada uma pelo seu próprio gate — todas as fases até '${through}' estão aprovadas.`,
      ffStopped: (slug, phase, list, why) => `O avanço rápido de '${slug}' parou em '${phase}'${list ? ` (aprovadas antes: ${list})` : " (nada aprovado)"} — ${why}`,
      ffWhyRefused: (ids, lines, slug, phase) => `o gate recusa-a — verificações a falhar: ${ids}.\n${lines}\nCorrige-as (detalhes: /spec-doctor ${slug}) e volta a correr o avanço rápido (retoma em '${phase}').`,
      ffWhyRoles: (missing) => `validada, mas fica à espera dos outros papéis (${missing}) — as fases seguintes não podem ser aprovadas antes dela.`,
      ffWhyRole: (roles, slug, phase, through, given) => (given ? `'${given}' não é um papel que valida '${phase}' (papéis: ${roles})` : `'${phase}' é validada por papel (${roles})`) +
        ` — nada foi registado para '${phase}'. Volta a correr o avanço rápido com o papel com que validas: /spec-ff ${slug} --role <papel> (CLI: dev-spec approve ${slug} --through ${through} --role <papel>); o avanço rápido retoma em '${phase}'.`,
      ffHint: (slug, list, role) => `Todos os artefactos de planeamento até às tasks estão preenchidos e passam o seu gate — avanço rápido: /spec-ff ${slug}${role ? " --role " + role : ""} (CLI: dev-spec approve ${slug} --through tasks${role ? " --role " + role : ""}) aprova ${list} por ordem, cada uma pelo seu próprio gate.`,
      batch: (n) => `  aprovações em lote (avanço rápido): ${n}`,
    },

    undo: {
      unticked: (n, slug, runnable, stale) => `A tarefa ${n} voltou a ficar aberta (desmarcada).` +
        (stale ? ` A evidência registada deixou de contar — voltar a marcá-la exige ${runnable ? `uma nova execução do seu comando _Verify:_: dev-spec done ${slug} ${n} --run` : "nova evidência"}.` : ""),
      alreadyOpen: (n) => `A tarefa ${n} não está marcada — nada a desfazer.`,
      redKept: (n, slug, day) => `A execução vermelha de ${day} (a prova do _Expect: fail_) mantém-se: voltar a marcá-la exige uma nova execução do seu comando _Verify:_ — com a correção feita, uma execução com sucesso conta como a correção que deixa o teste verde: dev-spec done ${slug} ${n} --run.`,
      duplicateTicked: (n, list) => `Várias tarefas marcadas partilham o número ${n} (${list}) — o undo não consegue saber qual das marcações foi o engano. Renumera-as primeiro para que cada número seja único (doctor: duplicate-tasks); depois, desfaz a que foi marcada por engano. Nada foi alterado.`,
      duplicateItem: (line, text) => `linha ${line}: "${text}"`,
      reopened: (slug) => `'${slug}' já estava concluída ou validada — quando a tarefa voltar a estar feita, conclui-a de novo (/spec-finish ${slug}) e volta a validar a execução (/approve ${slug} execution).`,
      noEvidence: "undo não aceita evidência — só desmarca a tarefa (regista a nova execução quando a voltares a marcar).",
      reasonNeedsUndo: "reason acompanha undo (spec_complete_task {undo: true, reason} / dev-spec undone <feature> <n> --reason \"…\") — ao marcar uma tarefa regista-se evidência.",
      badReason: (max) => `reason tem de ser texto (uma linha, no máximo ${max} caracteres).`,
      staleNote: (n, slug, runnable) => `Tarefa ${n}: foi desmarcada depois de esta evidência ser registada — continua não verificada até se registar ` +
        (runnable ? `uma nova execução: dev-spec done ${slug} ${n} --run` : "nova evidência."),
      label: "desmarcada depois de esta evidência ser registada",
      cliDone: (n, done, total) => `Tarefa ${n} desmarcada. ${done}/${total}`,
      cliAlready: (n, done, total) => `A tarefa ${n} não estava marcada. ${done}/${total}`,
      driftWhy: (list) => `desmarcada(s) depois: ${list}`,
      signOffWhy: (list) => `a desmarcação de ${list}`,
    },
    revoke: {
      revoked: (phase, slug) => `Aprovação de '${phase}' revogada em ${slug} — a fase volta a estar pendente (o doctor, o next_action e o spec_finish pedem-na).`,
      withdrawn: (phase, slug, roles) => `Retiradas as validações por papel à espera para '${phase}' de ${slug}: ${roles} — ainda nada estava aprovado.`,
      signOffsToo: (roles) => `As validações por papel que estavam à espera também foram retiradas: ${roles}.`,
      laterStay: (list, phase) => `Nada em cascata: as fases seguintes continuam aprovadas (${list}); aprovar outra fase é recusado (phase-order) até '${phase}' voltar a ser aprovada.`,
      notApproved: (phase, slug) => `'${phase}' não está aprovada em ${slug} e nenhuma validação por papel está à espera — nada a revogar.`,
      phaseRequired: "Indica a fase cuja aprovação queres revogar.",
      noThrough: "revoke aceita uma só fase — não through (o avanço rápido).",
      noForce: "revoke não aceita force nem expires — serve para retirar uma aprovação; reason diz porquê.",
      driftWhy: (list) => `aprovação revogada: ${list} (volta a aprová-la antes de voltar a fechar a feature)`,
      signOffWhy: (list) => `a revogação de ${list}`,
    },
    waiver: {
      badExpires: (v, max) => `expires tem de ser uma data ISO (AAAA-MM-DD, hoje ou depois, no máximo daqui a ${max} dias) ou um número de dias (30d, 1–${max}) — recebido: ${v}.`,
      needsForce: "reason / expires descrevem uma exceção (waiver) — acompanham force (reason também acompanha revoke).",
      notForced: "O gate passou — nada foi dispensado: o motivo / a validade não foram registados.",
      recorded: (reason, expires) => `Exceção registada${reason ? `: ${reason}` : ""}${expires ? ` (válida até ${expires})` : ""}.`,
      doctor: (list, slug) => `aprovações forçadas cuja exceção expirou: ${list} — corrige as verificações a falhar e volta a aprovar sem force (/approve ${slug} <fase>); para renovar a exceção: /approve ${slug} <fase> --force --reason "…" --expires 30d`,
      expiredItem: (phase, expires, reason) => `${phase} (expirou a ${expires}${reason ? ` — ${reason}` : ""})`,
      roadmapItem: (phase, reason, expires, expired) => `${phase} (${[reason ? `exceção: ${reason}` : "exceção", expires ? (expired ? `EXPIROU a ${expires}` : `até ${expires}`) : null].filter(Boolean).join(", ")})`,
      prHeading: "## Gates dispensados (aprovações forçadas)",
      prLine: (phase, failing, reason, expires, expired) => `- ${phase} — forçada apesar de: ${failing || "—"} · ${reason ? `motivo: ${reason}` : "sem motivo registado"}${expires ? ` · ${expired ? "EXPIROU a" : "válida até"} ${expires}` : ""}`,
      finishWarn: (list, slug) => `exceções expiradas em aprovações forçadas: ${list} — volta a aprovar essas fases sem force; para renovar a exceção: dev-spec approve ${slug} <fase> --force --reason "…" --expires 30d`,
    },

    forecast: {
      colEta: "Previsão",
      etaCell: (eta, low, high) => `${eta}${low ? ` (${low}…${high})` : ""}`,
      cliEta: (eta, low, high) => `previsão ${eta}${low ? ` (${low}…${high})` : ""}`,
      velocity: (v) => `Velocidade: ${v.pointsPerDay} ponto(s)/dia útil — ${v.completed} tarefa(s), ${v.points} ponto(s) concluídos desde ${v.since} (últimos ${v.windowDays} dias)`,
      notEnough: (v) => `Velocidade: ainda sem dados suficientes — ${v.completed} das ${v.minTasks} tarefas concluídas de que uma previsão precisa nos últimos ${v.windowDays} dias`,
      metricsVelocity: (v) => (v.completed ? `  velocidade: ${v.pointsPerDay} ponto(s)/dia útil (${v.completed} tarefa(s), ${v.points} ponto(s) desde ${v.since}, últimos ${v.windowDays} dias)${v.enough ? "" : ` — ainda sem dados suficientes para uma previsão (são precisas ${v.minTasks})`}`
        : `  velocidade: nenhuma tarefa concluída nos últimos ${v.windowDays} dias`),
      etaNote: (pct) => `Previsão = pontos por fazer ÷ velocidade, em dias úteis (±${pct}%) · \`_Size: XS|S|M|L|XL_\` numa tarefa = 1/2/3/5/8 pontos; uma tarefa sem tamanho conta como a mediana da sua feature (senão M) · uma feature à espera de uma dependência começa depois da previsão dessa.`,
      overlap: {
        attentionActive: (other, files) => `planeia os mesmos ficheiros que ${other}: ${files} — ordena-as (spec_depend) ou declara _Supersedes:_ se uma substitui o comportamento da outra`,
        attentionFinished: (other, files) => `planeia ficheiros da baseline de fecho de ${other}: ${files} — declara _Supersedes: ${other}/US-n.AC-m_ onde substitui esse comportamento, ou o spec_drift assinala ${other} depois do merge`,
        doctorActive: (list, slug) => `há tarefas por fazer que planeiam os mesmos ficheiros que outra feature ativa — ${list}: ambas mexem neles no merge e uma deriva sem aviso. Ordena as duas (spec_depend {name: "${slug}", add: ["<outra>"]} · dev-spec depend ${slug} <outra>) ou, onde uma substitui o comportamento da outra, declara _Supersedes: <outra>/US-n.AC-m_`,
        doctorFinished: (list, slug) => `há tarefas por fazer que planeiam ficheiros que uma feature fechada registou na sua baseline de drift — ${list}: depois do merge, o spec_drift assinala-a. Declara _Supersedes: <feature>/US-n.AC-m_ nos critérios de ${slug} que substituem o comportamento dela, faz ${slug} depender dela onde assenta nela (spec_depend {name: "${slug}", add: ["<feature>"]} · dev-spec depend ${slug} --add <feature>), ou volta a fechá-la depois do merge (spec_finish)`,
        hookLine: (n, list) => `⚠ ${n} sobreposição(ões) de ficheiros entre features: ${list} — corre /spec-doctor nelas (ordena-as com /depend, ou declara _Supersedes:_)`,
        cliHead: (n) => `⚠ ${n} sobreposição(ões) de ficheiros entre features:`,
        cliActive: (a, b, files) => `  ${a} ↔ ${b}: ${files}`,
        cliFinished: (a, b, files) => `  ${a} → ${b} (fechada): ${files}`,
        more: (n) => `+${n} outro(s)`,
      },
    },

    // 1.14 B5 — vermelho → verde (_Expect: fail_), verificações do projeto (roadmap.json meta.checks) + a suite no fim, `dev-spec log`.
    redGreen: {
      passRefused: (n) => `A tarefa ${n} espera que o seu teste FALHE (_Expect: fail_), mas a execução passou (exit 0) — o teste ainda não falha, por isso não testa nada. Põe-no a falhar pela razão certa (uma asserção, "não implementado" — não um erro de escrita nem um import em falta) e regista essa execução. Não a marco como feita.`,
      passTicked: (n) => `A tarefa ${n} está marcada, mas espera que o seu teste FALHE (_Expect: fail_) e esta execução passou (exit 0) sem nenhuma execução vermelha registada antes — o teste não testa nada: registado; a tarefa passa a contar como não verificada até ser registada uma execução a falhar (vermelha).`,
      cantRun: (n, code, ticked) => `Tarefa ${n}: exit ${code} significa que o próprio comando não pôde correr (não encontrado / não executável) — isso não é um teste vermelho (_Expect: fail_). Corrige o comando _Verify:_ e regista depois a execução a falhar. ` + (ticked ? "Registado; a tarefa passa a contar como não verificada." : "Não a marco como feita."),
      passAfterRed: (n, day) => `Tarefa ${n}: o teste passa agora — é o esperado depois da correção; a execução vermelha registada em ${day} continua a ser a prova (_Expect: fail_).`,
      unexpectedPassNote: (n, slug) => `A tarefa ${n} espera que o seu teste FALHE (_Expect: fail_), mas a última execução passou sem nenhuma execução vermelha antes — continua não verificada até ser registada uma execução a falhar: dev-spec done ${slug} ${n} --run`,
      redRecorded: (n, code) => `  ✓ execução vermelha registada para a tarefa ${n} (exit ${code}) — o teste falha antes da correção, como o _Expect: fail_ espera.`,
      shellNotRed: (cmd) => `a shell por omissão do Windows (cmd.exe) não conseguiu correr \`${cmd}\` tal como está escrito — isso não é um teste vermelho (_Expect: fail_). Nada foi registado; a tarefa continua aberta.`,
      cantRunOutput: (n, code, what, ticked) => `Tarefa ${n}: a execução saiu com exit ${code}, mas o output mostra que o teste nunca foi executado (${what}) — isso não é um teste vermelho (_Expect: fail_): um ficheiro de teste, módulo ou script em falta não é a razão certa. Escreve o teste para que falhe numa asserção (ou "não implementado") e regista essa execução. ` + (ticked ? "Registado; a tarefa passa a contar como não verificada." : "Não a marco como feita."),
      notRed: (cmd, what) => `\`${cmd}\` falhou, mas o output mostra que o teste nunca foi executado (${what}) — isso não é um teste vermelho (_Expect: fail_): um ficheiro de teste, módulo ou script em falta não é a razão certa. Nada foi registado; a tarefa continua aberta. Escreve o teste para que falhe numa asserção (ou "não implementado"); depois, repete o done --run.`,
      prRed: "a execução vermelha esperada (_Expect: fail_)",
      prRedKept: (code, day) => `execução vermelha antes da correção: exit ${code}${day ? " em " + day : ""}`,
      doctorMissing: (list) => `T-IDs postos a verde por tarefas feitas sem uma execução vermelha registada: ${list} — um teste que nunca falhou não prova nada. Marca a tarefa que o escreve com _Expect: fail_ e regista a execução a falhar antes da correção (dev-spec done <feature> <n> --run).`,
      doctorOk: (n) => `todos os T-IDs postos a verde por tarefas feitas (${n}) têm uma execução vermelha registada`,
      briefExpect: "**Resultado esperado: FALHA** (_Expect: fail_) — a execução tem de terminar com um exit diferente de zero: o teste falha pela razão certa antes da correção (uma asserção / não implementado — não um erro de escrita, um import em falta ou um comando que não corre). Uma execução que passe é recusada: significaria que o teste não testa nada.",
      dodExpect: "A execução do _Verify:_ tem de FALHAR (exit diferente de zero) pela razão certa — põe no relatório o comando, o exit code e a falha; fica registada como a execução vermelha da tarefa.",
      naVerify: (n, slug) => `A tarefa ${n} tem _Expect: fail_: a prova é uma execução que FALHA (o teste vermelho antes da correção) — uma execução que passa não conta. Regista a execução vermelha (dev-spec done ${slug} ${n} --run enquanto o teste falha — antes da correção, ou com a correção guardada num stash), ou tira o _Expect: fail_ se a tarefa não for um teste vermelho.`,
    },
    projectChecks: {
      badInput: 'checks tem de ser um objeto nome → comando (ex.: {"test": "npm test"}); um comando vazio remove essa verificação.',
      badName: (k) => `nome de verificação inválido '${k}' — letras, dígitos e . _ : - (até 40 caracteres, a começar por uma letra ou um dígito).`,
      badCommand: (k) => `o comando da verificação '${k}' tem de ser uma linha de texto (até 500 caracteres) — ou vazio para remover a verificação.`,
      tooMany: (max) => `no máximo ${max} verificações do projeto.`,
      badStored: (rel) => `${rel} → meta.checks não é um objeto de nome → comando (texto) — corrige-o à mão; não o vou alterar.`,
      initLine: (list) => `Verificações do projeto (meta.checks): ${list}`,
      evidenceNotList: "evidence tem de ser uma lista de execuções de verificações: [{name, command, exitCode, summary}].",
      noChecks: 'não há verificações do projeto configuradas (roadmap.json meta.checks) — nada para registar. Define-as primeiro: spec_init {checks: {"test": "npm test"}} (CLI: dev-spec init --check test="npm test").',
      evidenceItem: (i, why) => `evidence[${i}]: ${why}`,
      itemNotObject: "cada execução tem de ser um objeto {name, command, exitCode, summary}",
      unknownCheck: (name, list) => `'${name}' não é uma verificação do projeto — uma de: ${list}`,
      needsCommand: "falta o comando que correu",
      needsExit: "falta o exit code (um inteiro)",
      status: (i) => ({ "no-run": "nenhuma execução registada", failed: `a última execução falhou (exit ${i.exitCode})`, changed: "o comando mudou desde a execução", "before-last-tick": "correu antes da última atividade nas tarefas", "code-changed": "os ficheiros de implementação mudaram desde a execução", unobserved: "a execução não foi observada pelo harness" })[i.status] || i.status,
      blocker: (list, slug) => `verificações do projeto sem uma execução bem-sucedida desde a última atividade nas tarefas: ${list} — corre-as: dev-spec finish ${slug} --run (ou regista as execuções com spec_finish {evidence})`,
      doctorWarn: (list, slug) => `todas as tarefas estão feitas, mas há verificações do projeto sem uma execução bem-sucedida desde a última atividade nas tarefas: ${list} — o spec_finish recusa até passarem: dev-spec finish ${slug} --run`,
      doctorOk: (n) => `todas as verificações do projeto (${n}) têm uma execução bem-sucedida desde a última atividade nas tarefas`,
      invalidStored: (list) => `roadmap.json meta.checks: entradas inválidas ignoradas (${list}) — cada uma tem de ser "nome": "comando numa linha"`,
      prChecks: "## Verificações do projeto",
      prNoRun: "nenhuma execução registada",
      briefDod: (list) => `Corre as verificações do projeto e põe no relatório cada comando, o exit code e as últimas linhas do output — nada do que passava antes desta tarefa pode falhar depois dela: ${list}.`,
      briefDodRed: (list) => `Corre as verificações do projeto e põe no relatório cada comando, o exit code e as últimas linhas do output — as únicas falhas permitidas são os novos testes vermelhos desta tarefa; tudo o que passava antes tem de continuar a passar: ${list}.`,
      naFinish: (slug, list) => `Há verificações do projeto configuradas (${list}): para fechar a feature é preciso uma execução bem-sucedida de cada uma desde a última atividade nas tarefas — dev-spec finish ${slug} --run corre-as e regista-as (ou corre-as tu e regista cada uma com spec_finish {evidence: [{name, command, exitCode, summary}]}).`,
      recorded: (n) => `Registada(s) ${n} execução(ões) de verificações do projeto em .state.json → finishChecks.`,
      noneToRun: 'não há verificações do projeto para correr (roadmap.json meta.checks) — define-as: dev-spec init --check test="npm test" [--check lint="npm run lint"]',
      badArg: (v) => `--check espera nome=comando (recebido '${v}') — um comando vazio (nome=) remove essa verificação`,
      posixOnWindows: (name, cmd, kinds) => `a verificação do projeto '${name}' (\`${cmd}\`) usa sintaxe de shell POSIX (${kinds.map((k) => ({ "single-quotes": "plicas '…'", variable: "$VARIAVEIS" })[k] || k).join(", ")}) que o cmd.exe — a shell por omissão do --run no Windows — lê de outra forma, muitas vezes sem falhar. Nada foi executado. Volta a correr com --shell bash (Git Bash; ou define DEV_SPEC_SHELL=bash) — ou --shell cmd para a correr no cmd.exe mesmo assim.`,
    },
    runGate: {
      taskRefused: (cmd, why) => `\`${cmd}\` não pôde correr (${why}) — nada foi registado; a tarefa continua aberta.`,
      checkRefused: (name, cmd, why) => `a verificação do projeto '${name}' (\`${cmd}\`) não pôde correr (${why}) — nada foi registado; corrige isso e volta a correr finish --run.`,
      why: {
        spawn: (shell, code) => `não foi possível iniciar a shell '${shell}': ${code}`,
        signal: (sig) => `foi terminado pelo sinal ${sig}`,
        timeout: (s) => `não terminou dentro do --timeout de ${s} s`,
        buffer: "o output passou dos 64 MB",
        wsl: (text) => `o bash que o correu é o lançador do WSL, não uma shell desta máquina: ${text}`,
        shell: (text) => `a shell não o conseguiu iniciar: ${text}`,
        error: (code) => `a execução não conseguiu arrancar: ${code}`,
      },
      wslBash: (p) => `--shell ${p} é o lançador bash.exe do WSL, que corre o comando dentro de uma distribuição Linux (ou falha com "execvpe(/bin/bash) failed") e não numa shell desta máquina — usado como pediste; uma execução que o WSL não consiga arrancar não é registada. A shell desta máquina é o Git Bash, que o --shell bash encontra (com o Git for Windows).`,
      wslExe: (p) => `--shell ${p} é o wsl.exe, que não é uma shell (rejeita o -c que qualquer execução numa shell usa) — recusado, nada foi executado. Indica o caminho do bash.exe do WSL para correr dentro do WSL, ou --shell bash para o Git Bash.`,
      noGitBash: "--shell bash: não foi encontrado nenhum Git Bash (git --exec-path, %ProgramFiles%\\Git\\bin\\bash.exe, PATH) — um bash.exe em System32 ou WindowsApps é o lançador do WSL, que corre o comando dentro de uma distribuição Linux, por isso nunca é usado. Nada foi executado. Instala o Git for Windows, ou indica em --shell o caminho completo de um bash.exe.",
    },
    gitLog: {
      head: (slug, n, citing, truncated) => `Commits: ${slug} — ${n} commit(s) lido(s)${truncated ? " (a janela está cheia: os commits mais antigos não foram lidos — --max N)" : ""}, ${citing} citam as suas tarefas`,
      taskLine: (n, text, done, list) => `  ${done ? "[x]" : "[ ]"} #${n} ${text} — ${list}`,
      commitRef: (short, subject, via) => `${short} ${subject} (${via})`,
      more: (n) => `+${n} mais`,
      noCommit: "nenhum commit a cita",
      implFirst: (n, tests, taskC, testC, files) => `red-first: a tarefa ${n} (que põe ${tests} a verde) teve o primeiro commit em ${taskC}, antes de qualquer commit que toque num ficheiro de teste que nomeie ${tests} (${files} — primeiro em ${testC}): a implementação veio antes do teste.`,
      testNotCommitted: (n, tests, taskC, files) => `red-first: a tarefa ${n} (que põe ${tests} a verde) tem commit (${taskC}), mas nenhum commit lido toca num ficheiro de teste que nomeie ${tests} (${files}) — faz primeiro o commit do teste.`,
      redFirstStatus: (n, tests, status) => `red-first: tarefa ${n} (${tests}) — ` + ({ ok: "o teste teve commit primeiro ✓", "no-test-file": "ainda nenhum ficheiro de teste o nomeia (nada para comparar)", "no-task-commit": "ainda nenhum commit cita a tarefa", "outside-window": "impossível saber: a janela do log está cheia (--max N)" })[status],
      conventions: (slug) => `Nenhum commit cita uma tarefa de '${slug}'. Convenções: nomeia a feature e a tarefa — "Part of .specs/${slug}/ task #N." (o que o /spec-commit escreve) — ou os IDs que cobre: "Makes T-01 green", US-1.AC-2.`,
      noGit: "o git não está disponível aqui, ou isto não é um repositório git com commits — o dev-spec log lê o `git log`. Ou passa um log pelo stdin: git log --name-only --relative | dev-spec log <feature> -",
    },

    stopGate: {
      claims: [
        String.raw`(?:está|estão|esta|ficou|ficaram|foi|foram|já\s+está|já\s+estão)\s+(?:tudo\s+)?(?:feit[oa]s?|conclu[íi]d[oa]s?|terminad[oa]s?|implementad[oa]s?|verificad[oa]s?|finalizad[oa]s?|resolvid[oa]s?)`,
        String.raw`tarefas?\s+#?\d+(?:\s*(?:,|e|[-–]|a)\s*#?\d+)*\s+(?:(?:est[áa]|est[ãa]o|foi|foram|ficou|ficaram)\s+)?(?:feit[oa]s?|conclu[íi]d[oa]s?|terminad[oa]s?|implementad[oa]s?|verificad[oa]s?)`,
        String.raw`todas\s+as\s+(?:\d+\s+)?tarefas\s+(?:(?:est[ãa]o|foram|ficaram|já)\s+)*(?:feitas|conclu[íi]das|terminadas|implementadas|verificadas|finalizadas|prontas)`,
        String.raw`^[ \t*_#>\p{Extended_Pictographic}\uFE0F\u2713\u2714-]*(?:tudo\s+)?(?:feito|conclu[íi]do|terminado|implementado|verificado|finalizado)[*_]*(?=[ \t]*(?:[.,!:—–\p{Extended_Pictographic}\u2713\u2714-]|$))`,
        String.raw`tudo\s+(?:feito|pronto|conclu[íi]do|terminado|verde|funciona|a\s+funcionar)`,
        String.raw`(?:todos\s+os\s+(?:\d+\s+)?|os\s+)?testes?\s+(?:(?:já|agora|todos)\s+)*(?:passam|passaram|passa|passou|est[ãa]o\s+a\s+passar|a\s+passar|est[ãa]o\s+verdes|ficaram\s+verdes|verdes)`,
        String.raw`(?:isto|já)\s+funciona`,
        String.raw`terminei|concluí|implementei|verifiquei|acabei|finalizei`,
        String.raw`conclu[íi]d[oa]s?|verificad[oa]s?|implementad[oa]s?`,
      ],
      negators: ["não", "nunca", "nem", "nada", "sem", "falta", "faltam", "ser", "quando", "depois", "antes", "se", "até", "vou", "vamos", "irei",
        "devo", "deve", "devem", "precisa", "precisam", "tenho", "temos", "quase", "parcialmente", "possa", "possam", "ainda"],
      admissions: [
        String.raw`(?:não|nunca)\s+(?:(?:foi|foram|está|estão|ficou|ainda|totalmente|chegou|a|ser)\s+){0,2}(?:verificad[oa]s?|testad[oa]s?|corrid[oa]s?)`,
        String.raw`por\s+verificar|sem\s+evid[êe]ncia|sem\s+verifica[çc][ãa]o`,
        String.raw`[1-9]\d*\s+(?:testes?\s+)?(?:a\s+falhar|falharam|falhas?)`,
        String.raw`testes?\s+(?:(?:ainda|estão)\s+)*(?:falham|falharam|a\s+falhar)`,
      ],
      fixed: ["corrigi", "corrigimos", "corrigido", "corrigida", "corrigidos", "corrigidas", "resolvi", "resolvemos", "resolvido", "resolvida", "resolvidos", "resolvidas",
        "reparei", "reparado", "reparada", "anteriormente"],
      head: "dev-spec — gate de evidência: a tua última mensagem diz que o trabalho está feito ou verificado, mas há tarefas marcadas sem evidência de verificação:",
      headSuite: "dev-spec — gate de evidência: a tua última mensagem diz que o trabalho está feito ou verificado, mas as verificações do projeto não têm uma execução bem-sucedida desde a última atividade nas tarefas:",
      taskLine: (slug, list) => `  - ${slug}: ${list}`,
      suiteLine: (slug, list) => `  - ${slug}: verificações do projeto sem uma execução bem-sucedida desde a última atividade nas tarefas: ${list}`,
      more: (n) => `+${n} mais`,
      todoTasks: (slug, n) => `Regista a evidência antes de o afirmar: lê o comando _Verify:_ de cada tarefa listada em .specs/${slug}/tasks.md (primeiro a tarefa ${n}); corre esse comando no código final só se for seguro; regista essa execução com spec_complete_task {name, number, evidence: {command, exitCode, summary}}.`,
      todoSuite: (slug) => `As verificações do projeto de ${slug} não têm nenhuma execução que passe: lê-as em .specs/roadmap.json (meta.checks); corre essas verificações só se for seguro; regista as execuções com spec_finish {evidence}.`,
      plainly: "Ou diz claramente quais destas não estão verificadas.",
      implementer: {
        head: (n, slug) => `dev-spec — gate de evidência: reportas a tarefa ${n} de '${slug}' como DONE, mas`,
        noReport: (file) => `o relatório (${file}) não existe.`,
        noRun: (file, cmds) => `o relatório (${file}) não mostra a execução do _Verify:_ — o comando exato e o seu exit code: ${cmds}.`,
        notPassing: (file, cmds) => `o relatório (${file}) não mostra nenhuma execução com sucesso (exit 0) de ${cmds} — o _Verify:_ de uma tarefa DONE tem de passar.`,
        notFailing: (file, cmds) => `o relatório (${file}) não mostra nenhuma execução a falhar (um exit code diferente de zero) de ${cmds} — a tarefa tem _Expect: fail_: a prova é a execução vermelha.`,
        todo: "Corre o comando no código final e põe no relatório o comando, o exit code e as últimas linhas do output — ou reporta BLOCKED / NEEDS_CONTEXT se não puder passar. (Evidência antes de afirmações: o controlador só marca a tarefa com essa execução.)",
      },
      allow: {
        off: () => "gate de evidência: desligado (roadmap.json meta.stopCheck: false) — nada verificado.",
        "stop-hook-active": () => "gate de evidência: este fim de turno já foi devolvido uma vez (stop_hook_active) — permitido.",
        "no-specs": () => "gate de evidência: não há aqui uma .specs/ do dev-spec — nada a verificar.",
        "no-claim": () => "gate de evidência: a mensagem não afirma conclusão nem verificação — permitido.",
        admitted: () => "gate de evidência: a mensagem diz claramente o que não está verificado (ou falha) — permitido.",
        "no-recent": (i) => `gate de evidência: nenhuma feature teve atividade nas últimas ${i.hours} h (tarefa marcada, evidência registada ou tasks.md editado) — permitido.`,
        verified: (i) => `gate de evidência: todas as tarefas marcadas das features com atividade recente têm evidência de sucesso (${i.list}) — permitido.`,
        "not-done": () => "gate de evidência: o implementador reporta BLOCKED / NEEDS_CONTEXT — permitido.",
        "no-task": () => "gate de evidência: a mensagem não nomeia nenhum relatório de tarefa (.specs/<feature>/.execution/task-N-report.md) — permitido.",
        "nothing-to-verify": (i) => `gate de evidência: a tarefa ${i.n} de '${i.slug}' não tem um comando _Verify:_ executável — permitido.`,
        "report-ok": (i) => `gate de evidência: o relatório da tarefa ${i.n} de '${i.slug}' mostra a execução do _Verify:_ — permitido.`,
      },
      on: "Gate de evidência LIGADO — um turno que termina a dizer que o trabalho está feito ou verificado é devolvido enquanto uma feature com atividade recente tiver tarefas marcadas sem evidência de verificação (roadmap.json meta.stopCheck; hooks/stop-hook.js).",
      off: "Gate de evidência DESLIGADO — a verificação das afirmações no fim do turno está desativada (roadmap.json meta.stopCheck: false).",
      badValue: (v) => `--stop-check aceita on ou off (recebido '${v}').`,
    },
    scopeGuard: {
      on: "Modo guarda SCOPE (âmbito) — Write/Edit num ficheiro de código fora de .specs/ pede confirmação, a menos que uma tarefa por concluir de uma feature aprovada o nomeie em _Implements:_ (o ficheiro, a sua pasta ou um glob; ficheiros de teste excetuados), e pede-a em todas as alterações de código enquanto nenhuma feature tiver tarefas aprovadas por concluir (roadmap.json meta.guard: \"scope\"). Os ficheiros de teste são permitidos enquanto o plano de testes de uma feature por concluir estiver aprovado (a Fase 4 escreve os testes a falhar antes do gate das tarefas), e todos os ficheiros de código enquanto um spike estiver em curso (o seu protótipo).",
      ask: (file, features, hint) => `dev-spec guard (scope): ${file} não está no plano — nenhuma tarefa por concluir de ${features} o nomeia em _Implements:_. ${hint} (O modo guarda está em scope — dev-spec init --guard on permite todos os ficheiros de código enquanto houver tarefas aprovadas; --guard off desliga-o.)`,
      hint: {
        "same-folder": (n, slug, ref) => `Acrescenta-o ao _Implements:_ da tarefa ${n} (${slug} — mesma pasta que ${ref}) e volta a aprovar a fase tasks, ou planeia a alteração com /spec-converge (spec_append_tasks).`,
        nearby: (n, slug, ref) => `Acrescenta-o ao _Implements:_ da tarefa ${n} (${slug} — planeia ${ref}, ali perto) e volta a aprovar a fase tasks, ou planeia a alteração com /spec-converge (spec_append_tasks).`,
        next: (n, slug) => `Acrescenta-o ao _Implements:_ da tarefa ${n} (${slug}, a próxima tarefa por concluir) e volta a aprovar a fase tasks, ou planeia a alteração com /spec-converge (spec_append_tasks).`,
      },
    },

    // 1.14 C2 — registo de decisões (decisions.md, spec_decide) e o tipo spike (investigar → decidir).
    decisions: {
      header: (name) => `# Decisões: ${name}

<!-- Registo de decisões — só se acrescenta, é versionado com a spec. O spec_decide (dev-spec decide) acrescenta cada
     entrada: D-1, D-2… nunca renumeradas, nunca reescritas. _Affects:_ indica os AC IDs, T-IDs e secções do design em
     que a decisão toca; uma decisão posterior que substitua outra diz _Supersedes: D-n_. As descobertas (factos
     aprendidos durante o trabalho) usam o mesmo registo (_Kind: discovery_). -->
`,
      labels: { context: "Contexto", decision: "Decisão", discovery: "Descoberta", consequences: "Consequências" },
      kinds: { decision: "decisão", discovery: "descoberta" },
      titleRequired: "uma decisão precisa de um título (uma linha de texto).",
      decisionRequired: "uma decisão precisa do seu texto — decision: o que foi decidido (numa descoberta: o que se descobriu).",
      badText: (field) => `${field} tem de ser texto.`,
      tooLong: (field, max) => `${field} é demasiado longo (no máximo ${max} caracteres).`,
      badKind: (v) => `kind tem de ser decision ou discovery (recebido: ${v}).`,
      badAffects: (list) => `referência(s) _Affects:_ desconhecida(s): ${list} — um AC ID tem de estar definido em requirements.md, um T-ID planeado em test-plan.md, um ID EC/NFR/SC escrito em requirements.md; qualquer outra tem de ser um título de secção do design.md (bug.md / design.md num bugfix, spike.md num spike). Nada foi escrito.`,
      badSupersedes: (list) => `_Supersedes:_ tem de indicar decisões que já estão neste registo (D-n): ${list}. Nada foi escrito.`,
      unsafeFile: (rel) => `${rel} não é um ficheiro normal dentro de .specs/ (é uma ligação simbólica, ou aponta para fora do projeto) — substitui-o primeiro por um ficheiro normal. Nada foi escrito.`,
      recorded: (id, kind, file) => `${id} (${kind}) registada em ${file}.`,
      briefHeading: "## Decisões",
      briefIntro: "Decisões e descobertas (decisions.md) que citam os critérios ou testes desta tarefa — respeita-as:",
      briefOmitted: (list) => `…e ${list} — ver decisions.md.`,
      supersedesNote: (list) => `substitui ${list}`,
      prHeading: "## Decisões",
      catalogLine: (n, list) => `Decisões (${n}): ${list}`,
      superseded: "substituída",
      affectsApproved: (list, slug, phases) => `decisões registadas depois de uma aprovação tocam na spec aprovada: ${list} — revê o que mudam (spec_impact ${slug} --phase ${phases}), atualiza a spec e volta a aprovar.`,
      affectsApprovedEntry: (id, refs, file, day) => `${id} (${refs}) depois de ${file} ter sido aprovado (${day})`,
      phantomDoctor: (list) => `referências _Affects:_ em decisions.md que não correspondem a nada nesta feature: ${list} — um erro de escrita, ou um critério / teste / secção removido entretanto.`,
      phantom: (id, ref) => `${id} _Affects:_ ${ref} — não corresponde a nada nesta feature (um erro de escrita, ou um critério / teste / secção removido entretanto)`,
      cliRecorded: (id, title, file) => `✎ ${id} — ${title}  (${file})`,
    },
    spike: {
      kind: "spike",
      kicker: "Spike (investigação)",
      report: (a) => `# Spike: ${a.name}

<!-- Spike (investigar → decidir): uma investigação com prazo fixo (timebox) que termina numa DECISÃO, não em código de produção.
     O código de protótipo vive FORA de .specs/ (uma pasta de rascunho ou um branch) — liga-o em Evidência.
     O spec_doctor falha enquanto a "Decisão" não estiver escrita e avisa quando a data do timebox passa sem ela.
     Indica o resultado numa linha própria: _Outcome: go_ · _Outcome: no-go_ · _Outcome: pivot_ -->

## Pergunta
${a.question || "> **TODO** — a única pergunta a que este spike responde (que resposta mudaria o plano?)."}

## Timebox (prazo)
${a.until ? `**Até:** ${a.until}${a.raw && a.raw !== a.until ? ` (${a.raw})` : ""}` : "> **TODO** — a data de fim (AAAA-MM-DD) ou o limite de esforço. Quando terminar, decide com a evidência que tiveres."}

## Opções consideradas
- [opção A — o que é, quanto custaria]
- [opção B]

## Evidência
<!-- Links, medições, protótipos (o código fica fora da spec — liga-o aqui), o que se tentou e o que aconteceu. -->
- [link / medição / protótipo — e o que mostrou]

## Decisão
> **TODO** — go / no-go / pivot (avançar / não avançar / mudar de rumo) e porquê: a evidência que decidiu.

_Outcome: [go | no-go | pivot]_

## Seguimento
- [go: a feature a especificar (spec_create) · no-go: porque foi abandonado · pivot: a nova pergunta]
`,
      tasks: (name) => `# Tasks: ${name}

<!-- Um spike não tem gates de requisitos / design: pergunta → investigar → decidir. O código de protótipo vive FORA
     de .specs/ — liga-o em spike.md → Evidência. Quando o timebox terminar, decide com o que tiveres. -->

## Fase: Investigação
- [ ] 1. [shared] Afinar a pergunta e definir o timebox em spike.md (que resposta mudaria o plano?)
- [ ] 2. [shared] Listar as opções consideradas em spike.md → Opções consideradas
- [ ] 3. [shared] Reunir a evidência — protótipos (fora de .specs/), medições, links — em spike.md → Evidência
- [ ] 4. [shared] Registar a decisão (go / no-go / pivot) e a justificação em spike.md → Decisão; regista-a com o spec_decide
**Checkpoint:** a pergunta tem uma resposta apoiada em evidência.
`,
      badTimebox: (v) => `timebox tem de ser uma data de fim (AAAA-MM-DD) ou uma duração a partir de hoje (p. ex. 3d, 2w, 8h) — recebido: ${v}.`,
      spikeOnly: (arg) => `${arg} só se aplica a um spike (kind: "spike").`,
      tracksIgnored: (list) => `Um spike é só core — tracks ignorados (${list}); dá-os à feature que especificares depois de um 'go'.`,
      noTracks: (slug) => `'${slug}' é um spike — não tem tracks. Depois de um 'go', especifica a feature real com os seus tracks (spec_create).`,
      noGate: (phase, slug) => `'${slug}' é um spike: não tem gate de ${phase} — o seu percurso é pergunta → investigar → decidir. Regista a decisão em spike.md → Decisão (o spec_decide regista-a no log); o spec_finish fecha-o.`,
      doctor: {
        missing: "falta o spike.md — é lá que vivem a pergunta, a evidência e a decisão de um spike.",
        questionOk: "a pergunta está escrita",
        questionMissing: "spike.md → Pergunta ainda é o template — escreve a única pergunta a que este spike responde.",
        decisionOk: (o) => `decisão registada (_Outcome: ${o}_)`,
        decisionMissing: "spike.md → Decisão ainda não está escrita (go / no-go / pivot + justificação) — o spike não termina enquanto não estiver.",
        outcomeMissing: "a decisão está escrita mas o resultado não está indicado — acrescenta uma linha _Outcome: go_, _Outcome: no-go_ ou _Outcome: pivot_.",
        timeboxOk: (d) => `timebox até ${d}`,
        timeboxPassed: (d) => `o timebox terminou a ${d} e não há decisão registada — decide com a evidência que tens (go / no-go / pivot), ou prolonga o timebox de propósito.`,
        timeboxUnset: "sem timebox definido — escreve uma data de fim (AAAA-MM-DD) em spike.md → Timebox.",
        timeboxNoDate: "o timebox não tem data de fim (AAAA-MM-DD) — não é possível verificar quando acaba.",
        timeboxDecided: "decidido — o timebox está fechado",
      },
      next: {
        missing: (slug) => `falta o spike.md — volta a criá-lo: dev-spec spike "${slug}" (só cria: o que existe é mantido).`,
        fillQuestion: (slug) => `Escreve a pergunta a que este spike responde (e o timebox) em spike.md → Pergunta / Timebox — /spec-spike ${slug}.`,
        investigate: (n, text, slug) => `Investiga — tarefa #${n}: ${text}. O código de protótipo fica fora de .specs/ (liga-o em spike.md → Evidência); marca-a: dev-spec done ${slug} ${n}.`,
        decide: (slug) => `Regista a decisão em spike.md → Decisão — go / no-go / pivot, a justificação e a linha _Outcome:_ — e regista-a no log: /spec-decide ${slug} (spec_decide).`,
        outcome: (slug) => `Indica o resultado em spike.md → Decisão: uma linha _Outcome: go_, _Outcome: no-go_ ou _Outcome: pivot_ (/spec-spike ${slug}).`,
        timeboxPassed: (d) => `O timebox terminou a ${d}: decide com a evidência que tens.`,
        goCreateFirst: (slug, name, summary) => `Decisão: go. Especifica a feature real — spec_create {name: "${name}", summary: ${JSON.stringify(summary)}} (dev-spec create "${name}" --summary ${JSON.stringify(summary)}) — e depois arquiva o spike: /feature archive ${slug}.`,
        goArchiveFirst: (slug, name, summary) => `Decisão: go. Arquiva primeiro o spike — /feature archive ${slug} (liberta o nome) — e depois especifica a feature real: spec_create {name: "${name}", summary: ${JSON.stringify(summary)}} (dev-spec create "${name}" --summary ${JSON.stringify(summary)}).`,
        noGo: (slug, reason) => `Decisão: no-go${reason ? ` — ${reason}` : ""}. Arquiva o spike com o seu motivo (fica em spike.md → Decisão): /feature archive ${slug}.`,
        pivot: (slug, reason) => `Decisão: pivot${reason ? ` — ${reason}` : ""}. Começa um novo spike para a nova direção (dev-spec spike "<nova pergunta>") — ou especifica a feature se a resposta já for clara — e depois arquiva este: /feature archive ${slug}.`,
      },
      finish: {
        ready: (slug) => `o spike '${slug}' está pronto para fechar — a decisão está registada. Age sobre ela (o spec_next_action diz como).`,
        notReady: (slug) => `o spike '${slug}' ainda não está pronto para fechar:`,
        missing: "falta o spike.md",
        decisionBlocker: "spike.md → Decisão ainda não está escrita (go / no-go / pivot + justificação)",
        prQuestion: "## Pergunta",
        prDecision: (o) => `## Decisão${o ? ` — ${o}` : ""}`,
        prEvidence: "## Evidência",
        prOptions: "## Opções consideradas",
        prFollowUp: "## Seguimento",
        checks: ["A decisão foi partilhada com as pessoas a quem diz respeito.", "O código de protótipo fica fora do branch principal — a feature real reescreve o que aproveitar nas suas próprias tarefas."],
      },
      roadmapTimebox: (d) => `spike: o timebox terminou a ${d} sem decisão`,
      catalogQuestion: (q) => `Pergunta: ${q}`,
      catalogOutcome: (o) => `Decisão: ${o}`,
      catalogPending: "Decisão: pendente",
      exportSection: "Spike",
      cliQuestion: (q) => `  pergunta: ${q}`,
      cliUntil: (d) => `  timebox: até ${d}`,
    },

    flow: {
      required: (slug, known) => `fluxo em falta — um de: ${known} (spec_feature {action: "flow", name: "${slug}", flow}; CLI: dev-spec feature flow ${slug} <flow>).`,
      kindRefused: (slug, kind) => `'${slug}' é um ${kind}, que segue a sua própria ordem de fases fixa — o fluxo só se aplica a features.`,
      kindIgnored: (kind) => `fluxo ignorado: um ${kind} segue a sua própria ordem de fases fixa (o fluxo só se aplica a features).`,
      kept: (slug, cur, asked) => `fluxo mantido: '${slug}' segue ${cur} (pedido: ${asked}) — muda-o com spec_feature {action: "flow"} (CLI: dev-spec feature flow ${slug} ${asked}).`,
      set: (slug, flow, prev, order) => `'${slug}' segue agora o fluxo ${flow} (antes: ${prev}) — ordem das fases: ${order}.`,
      same: (slug, flow, order) => `'${slug}' já segue o fluxo ${flow} — ordem das fases: ${order}.`,
      approvedStay: (list) => `As fases já aprovadas continuam aprovadas: ${list}.`,
      created: (order) => `fluxo design-first — ordem das fases: ${order} (os requisitos escrevem-se depois de o design ser aprovado).`,
      nextNote: (order) => `(fluxo design-first: ${order})`,
      laterPhase: (detail) => `o requirements.md é uma fase posterior (design-first) — ${detail}`,
    },
    importPlans: {
      plansDir: "O plan mode do Claude Code guarda os planos em plansDirectory (por omissão ~/.claude/plans — fora do projeto): copia primeiro o plano para dentro do projeto, ou aponta plansDirectory para uma pasta dentro dele.",
      several: (dir, list) => `'${dir}' tem vários documentos (${list}) — indica o que queres importar.`,
      planTitle: "Plano",
      wNoSteps: "nenhuma checklist, lista de to-dos ou de passos encontrada — o tasks.md do scaffold foi mantido (divide o trabalho em tasks com /createTask)",
      wCancelled: (list) => `to-dos cancelados importados como tasks em aberto (remove os que já não se aplicam): ${list}`,
      wNoDesignLeft: "nada ficou para o design além dos critérios e dos passos — o design.md do scaffold foi mantido",
      wNotExecPlan: "nenhuma secção de ExecPlan encontrada (Progress, Decision Log, Concrete Steps, Validation and Acceptance …) — é mesmo um ExecPlan? Experimenta a ferramenta 'plan'.",
      decisionsHeading: "## Decisões",
      nonFunctional: "## Requisitos Não-Funcionais",
      wUnknownAc: (story, task, list) => `${story}, '${task}': referência(s) de AC ${list} não correspondem a nenhum critério dessa história — mantidas como escritas`,
      wWorkflow: (list) => `registos de workflow do BMAD não importados (ficam no sítio): ${list}`,
    },
  },

  es: {
    initNote: "Los stubs son placeholders. La skill los rellena con contenido real (ver references/steering-templates.md).",
    createNote: () => null,
    addTrackNote: (tr, slug) => `+${tr} añadido. Rellena las nuevas secciones de diseño y vuelve a ejecutar /spec-doctor ${slug}.`,
    addTrackAlready: (tr) => `ya tiene +${tr}`,
    notes: {
      scan: "Solo un inventario heurístico — el agente lo interpreta para inferir el steering/constitución y hacer ingeniería inversa de las specs.",
      coverage: "Heurística a partir de la intención declarada: la parte de los ficheros de código (sin las pruebas) nombrados por un marcador _Implements:_ de alguna función, activa o archivada. Un fichero cuenta como cubierto cuando una tarea lo reclama — mantén los _Implements:_ al día.",
    },
    evidence: {
      failed: (n, code) => `Tarea ${n}: la verificación falló (exit ${code}) — no se marca como hecha.`,
      missing: (n, slug) => `La tarea ${n} tiene un comando _Verify:_ pero no se registró evidencia — pasa la evidencia (comando, exit code, resumen) o ejecuta: dev-spec done ${slug} ${n} --run`,
      ran: (cmd, code) => `ejecutado: ${cmd} → exit ${code}`,
      failedTicked: (n, code) => `La tarea ${n} ya está marcada, pero su nueva verificación falló (exit ${code}) — se ha registrado; cuenta como no verificada hasta que se registre una ejecución correcta.`,
      badExit: (v) => `exitCode debe ser un entero (recibido '${v}').`,
      needsExit: "Una evidencia que indica un comando necesita su exit code — o da solo un resumen, para una verificación manual.",
    },
    finish: {
      ready: (slug) => `'${slug}' está lista para cerrar — confirma las verificaciones de abajo y luego haz merge local o mantén la rama.`,
      notReady: (slug) => `'${slug}' aún no está lista para cerrar:`,
      doctor: (ids) => `el doctor tiene verificaciones bloqueantes: ${ids}`,
      open: (list) => `tareas pendientes: ${list}`,
      unverified: (list) => `tareas marcadas sin evidencia de verificación: ${list}`,
      gates: (list) => `fases esperando aprobación: ${list}`,
      noTasks: "aún no hay tareas — primero desglosa el diseño en tareas",
      checkSuite: "La suite de pruebas COMPLETA está en verde en una ejecución nueva (pega el comando y la salida).",
      checkLoad: "+saas: la prueba de carga cumple el presupuesto de rendimiento (load-test.md).",
      checkObs: "+saas: observabilidad validada — métricas emitiéndose, logs visibles, alertas y dashboard configurados.",
      checkCost: "+ai: el coste real en tokens está a ~20% de la proyección del diseño.",
      checkSafety: "+ai: conjunto adversarial completo ejecutado, 100% en las categorías críticas de seguridad, ~20 salidas revisadas por una persona.",
      checkBug: "bugfix: los pasos de reproducción de bug.md ya no reproducen el bug.",
      prSummary: "## Resumen",
      prAcs: "## Criterios de aceptación",
      prTasks: "## Tareas",
      prTests: "## Pruebas",
      prChecks: "## Verificaciones antes del merge",
      prSpec: "## Spec",
      prRootCause: "## Causa raíz",
      prFix: "## Corrección",
      noEvidence: "sin evidencia registrada",
      changedByDate: (list, slug) => `juzgado solo por la fecha del fichero (aprobado antes de las huellas de contenido — un clon o una copia restablece las fechas, así que puede no ser una edición): ${list} — revísalo y vuelve a aprobar para seguirlo por contenido (/approve ${slug} <fase>)`,
      untrackedApproval: (list, slug) => `aprobado antes del registro de cambios — no se registró nada del fichero aprobado, así que una edición no puede detectarse: ${list} — vuelve a aprobar para empezar a seguirlo (/approve ${slug} design)`,
    },
    kindKept: (kept, asked) => `Esta función ya es del tipo '${kept}' — se mantiene (pediste '${asked}'). Crea otra para un tipo distinto.`,
    langKept: (kept, asked) => `Esta función ya está en '${kept}' — se mantiene (pediste '${asked}'). Una función, un idioma.`,
    err: {
      noUsableName: (name) => `El nombre de función '${name}' no tiene caracteres utilizables (a-z, 0-9) para un nombre de carpeta.`,
      reserved: (slug) => `'${slug}' es un nombre reservado — elige otro nombre para la función.`,
      reservedWin: (slug) => `'${slug}' es un nombre reservado en Windows — elige otro nombre para la función.`,
      notFound: (slug, root) => `Función '${slug}' no encontrada en ${root}`,
      archivedHint: (slug) => `— está archivada (.specs/_archive/${slug}): restáurala primero (dev-spec feature restore ${slug}).`,
      invalidJson: (rel, detail) => `${rel} no es JSON válido (${detail}) — corrígelo a mano; no se sobrescribirá.`,
      tasksMissing: (slug) => `tasks.md no encontrado para '${slug}'`,
      requirementsMissing: (slug) => `requirements.md no encontrado para '${slug}'`,
      taskNotFound: (n) => `Tarea ${n} no encontrada en tasks.md`,
      featureBusy: (slug, rel) => `Otro proceso de dev-spec está actualizando '${slug}' en este momento (${rel || `.specs/${slug}/.lock`}) — no se ha cambiado nada; vuelve a intentarlo en un momento. Si no hay otro editor ni comando de dev-spec en marcha, borra ese archivo.`,
      roadmapBusy: "Otro proceso de dev-spec está actualizando .specs/roadmap.json en este momento (.specs/.roadmap.lock) — no se ha cambiado nada; vuelve a intentarlo en un momento. Si no hay otro editor ni comando de dev-spec en marcha, borra ese archivo.",
      folderInUse: (rel) => `La carpeta ${rel} está en uso por otro programa (un editor, un indexador o antivirus, una terminal abierta dentro) — no se ha movido ni borrado nada; ciérralo y vuelve a intentarlo.`,
      lockStuck: (rel) => `Un bloqueo de dev-spec abandonado (${rel}) no se ha podido eliminar — el archivo (o una carpeta con ese nombre) está abierto en otro programa, es de solo lectura o no es un archivo. No se ha cambiado nada. Borra ${rel} a mano (revisa sus permisos) y vuelve a intentarlo.`,
      numberInt: "el número debe ser un entero",
      noText: "No se ha proporcionado texto.",
      unknownPhase: (phase, known) => `Fase desconocida '${phase}'. Conocidas: ${known}`,
      alreadyArchived: (slug) => `'${slug}' ya está archivada (.specs/_archive/${slug}). Elimínala de allí primero.`,
      renameNeedsName: "para renombrar hace falta un nombre nuevo.",
      sameSlug: "El nombre nuevo da el mismo slug.",
      alreadyExists: (slug) => `'${slug}' ya existe.`,
      badAction: "la acción debe ser: remove | archive | rename | restore | flow",
      badTrack: "el track debe ser: tdd | saas | ai | sec | privacy | dist",
      cycle: (chain) => `Dependencia circular: ${chain}`,
      nameRequired: "el nombre es obligatorio",
      noSpecs: (root) => `No hay .specs/ en ${root}`,
      notGenerated: (file) => `${file} existe y no lo generó dev-spec — no se ha modificado.`,
      unknownSteering: (file, known) => `Fichero de steering desconocido '${file}'. Conocidos: ${known}`,
    },
    ears: {
      needsClar: "Marcador [NEEDS CLARIFICATION] sin resolver — resuélvelo antes del diseño.",
      noModal: "El criterio no tiene verbo modal (SHALL / DEVE / DEBE) — no es una frase EARS válida.",
      noId: "El criterio no tiene ID estable (p. ej., US-1.AC-1).",
      vague: (term) => `Término vago '${term}' — sustitúyelo por un valor concreto y comprobable.`,
      noKeyword: "Sin palabra clave EARS (WHEN/WHILE/IF/WHERE · QUANDO/ENQUANTO/SE/ONDE · CUANDO/MIENTRAS/SI/DONDE). Aceptable en requisitos ubicuos; confirma que es intencionado.",
    },
    classify: {
      conf: { high: "alta", medium: "media", none: "ninguna" },
      core: "core: siempre activo (toda función en modo Spec).",
      on: (t, conf, list, neg) => `+${t}: ACTIVO${conf ? ` [confianza ${conf}]` : ""} — señales encontradas: ${list}.${neg ? ` (${neg} apareció negado.)` : ""}`,
      off: (t, neg) => `+${t}: inactivo — ${neg ? `${neg} apareció negado.` : "ninguna señal encontrada."}`,
      substantial: "Ninguna señal de track, pero la descripción es sustancial — considera si aplica +tdd (corrección/casos límite).",
      weakOnly: (list) => `Activo solo por señales débiles — compruébalo: ${list}.`,
      possible: (t, sig) => `Posible +${t} — señal débil '${sig}' (necesita corroboración; no se ha activado).`,
      keptOff: (t, kw) => `+${t} se mantiene inactivo — '${kw}' apareció negado.`,
      onAlthough: (t, quoted, list) => `+${t} está ACTIVO aunque ${quoted} apareció negado — activado por: ${list}. Confirma que es intencionado.`,
    },
    sectionStatus: { missing: "falta", unfilled: "sin rellenar" },
    sectionNames: {
      "Performance Budget": "Presupuesto de Rendimiento", "Scale Design": "Diseño de Escala", "Multi-tenancy": "Modelo Multiinquilino",
      "Observability": "Observabilidad", "Cost Envelope": "Presupuesto de Coste", "Model Strategy": "Estrategia de Modelo",
      "Prompt Architecture": "Arquitectura de Prompt", "Token Economics": "Economía de Tokens", "Latency Budget": "Presupuesto de Latencia",
      "Eval Strategy": "Estrategia de Evaluación", "Safety & Abuse": "Seguridad y Abuso", "Fallback & Degradation": "Fallback y Degradación",
      "Observability for AI": "Observabilidad de IA", "Model Lifecycle": "Ciclo de Vida del Modelo", "Multi-modality": "Multimodalidad",
    },
    precommit: {
      header: "dev-spec-driven pre-commit:",
      earsErrors: (f, n) => `✗ ${f}: ${n} error(es) EARS`,
      earsClean: (f, n) => `✓ ${f}: EARS limpio (${n} criterios)`,
      earsWarnings: (f, n, w, p) => `⚠ ${f}: sin errores EARS (${n} criterios), pero ${[w ? `${w} aviso(s)` : null, p ? `${p} placeholder(s) de la plantilla sin rellenar` : null].filter(Boolean).join(" y ")} — no bloquea`,
      phantom: (f, n, list) => `✗ ${f}: ${n} referencia(s) AC/prueba fantasma — probablemente erratas: ${list}`,
      uncovered: (f, n, list) => `⚠ ${f}: ${n} AC(s) sin tarea (aviso): ${list}`,
      traceClean: (f, n) => `✓ ${f}: trazabilidad limpia (${n} ACs)`,
      blocked: (n) => `\nCommit bloqueado: ${n} problema(s) bloqueante(s) en los ficheros de spec preparados. Corrígelos o usa 'git commit --no-verify' para omitirlos.`,
    },
    doctor: {
      steeringMissing: (list) => `falta: ${list}`,
      steeringOk: "steering esencial presente (incl. constitución)",
      requirementsMissing: "falta requirements.md",
      clarificationsOpen: (n) => `${n} [NEEDS CLARIFICATION] sin resolver — resuelve antes del diseño`,
      clarificationsNone: "ninguno sin resolver",
      scPresent: "presente",
      scMissing: "sin criterios de éxito medibles SC-###",
      prioritiesOk: "historias de usuario priorizadas",
      prioritiesMissing: "sin prioridad P1 (MVP) en una historia de usuario",
      acDup: (list) => `IDs de AC duplicados: ${list}`,
      acUnique: "IDs de AC únicos",
      earsDetail: (n, e, w) => `criterios=${n}, errores=${e}, avisos=${w}`,
      earsNoCriteria: (ids) => `requirements.md cita IDs de AC (${ids}) pero no se validó ningún criterio — EARS valida un AC escrito como elemento de lista, título o línea que empiece por su ID, o como fila de tabla bajo un título de Criterios de Aceptación`,
      designMissing: "falta design.md",
      mermaidOk: "tiene un diagrama",
      mermaidMissing: "no se encontró diagrama mermaid",
      constitutionOk: "presente — verifica que cada principio se comprueba",
      constitutionMissing: "sin sección Verificación de la Constitución en el diseño",
      saasAllFilled: "las 5 rellenadas",
      aiAllFilled: "las 10 rellenadas",
      gatesPending: (list) => `esperando aprobación humana: ${list} — ejecuta /approve antes de avanzar`,
      gatesOk: "todas las fases presentes aprobadas",
      unverified: (list) => `marcadas sin evidencia de verificación: ${list}`,
      verifiedOk: "toda tarea marcada con comando _Verify:_ tiene evidencia",
      rootCauseMissing: "bug.md → Causa Raíz sin rellenar — ninguna corrección antes de conocer la causa",
      rootCauseOk: "causa raíz documentada",
      reproMissing: "bug.md → Reproducción sin rellenar",
      reproOk: "reproducción documentada",
    },
    next: {
      fixChecks: (ids, slug) => `Corrige las verificaciones bloqueantes (${ids}) — ejecuta /spec-doctor ${slug} para ver los detalles.`,
      reReview: (files) => `Nueva revisión: ${files} modificado(s) tras la última aprobación — vuelve a aprobar la fase afectada.`,
      approveRequirements: (slug) => `Revisa y aprueba los requisitos — /approve ${slug} requirements.`,
      approveDesign: (slug) => `Revisa y aprueba el diseño — /approve ${slug} design.`,
      approveTasks: (slug) => `Revisa y aprueba el desglose de tareas — /approve ${slug} tasks.`,
      approveTestPlan: (slug) => `Revisa y aprueba el plan de pruebas — /approve ${slug} test-plan.`,
      approveEvalPlan: (slug) => `Revisa y aprueba el plan de evals — /approve ${slug} eval-plan.`,
      approveBugDesign: (slug) => `Revisa y aprueba bug.md (Reproducción + Causa Raíz — el diseño de un bugfix) — /approve ${slug} design.`,
      signOffTests: (slug, what) => `Aprobación de la Fase 4: la implementación ya empezó, así que las pruebas ya no se escriben primero — ${({ tdd: "comprueba que cada prueba planificada existe con su T-ID en el nombre de la prueba (test(\"T-01 …\")) para que tests-in-code la encuentre", ai: `comprueba que el conjunto de evals es el de la propia función y registra la línea base (/eval ${slug} --set-baseline)`, both: `comprueba que cada prueba planificada existe con su T-ID en el nombre de la prueba (test("T-01 …")) y que el conjunto de evals es el de la propia función, y registra la línea base (/eval ${slug} --set-baseline)` })[what]}. Después apruébalo — /approve ${slug} tests.`,
      approveTests: (slug, what) => `Fase 4, el gate estricto: ${({ tdd: "escribe todas las pruebas planificadas y confirma que cada una falla por la razón correcta", ai: "escribe las pruebas deterministas y el harness de evals, y registra la línea base", both: "escribe todas las pruebas planificadas (cada una fallando por la razón correcta) y el harness de evals, y registra la línea base" })[what]} — /writeTests ${slug}; ningún código de implementación antes. Después apruébalo — /approve ${slug} tests.`,
      implement: (n, text, slug) => `Implementa la tarea #${n}: ${text} — /executeTask ${slug}.`,
      allDone: (slug) => `Todas las tareas hechas — cierra la función con /spec-finish ${slug} (spec_finish): informe de preparación + resumen del merge.`,
      breakIntoTasks: (slug) => `Desglosa el diseño en tareas — /createTask ${slug}.`,
      drifted: (slug, day, n, total, files) => `'${slug}' se cerró el ${day}, pero ${n} de ${total} fichero(s) de implementación cambiaron desde entonces: ${files} (dev-spec drift ${slug}). Decide: la spec ahora es incorrecta → /spec-impact ${slug} (o una función nueva con _Supersedes:_); el código es incorrecto → corrígelo (/spec-bugfix); inofensivo → vuelve a ejecutar /spec-finish ${slug} para una línea base nueva.`,
      finished: (slug, day, total, signOff) => `'${slug}' está cerrada (${day}) — sus ${total} fichero(s) de implementación no han cambiado desde entonces.` +
        (!signOff ? ` Nada más que hacer aquí — /spec-drift ${slug} la comprueba tras cambios futuros.`
          : signOff.why ? ` La aprobación final (execution, ${signOff.at}) es anterior a ${signOff.why} — vuelve a confirmarla: /approve ${slug} execution${signOff.role ? " --role " + signOff.role : ""}.`
            : ` Falta la aprobación final${signOff.missing ? ` — ${signOff.missing}${signOff.signed ? ` (ya validaron: ${signOff.signed})` : ""}` : ""}: /approve ${slug} execution${signOff.role ? " --role " + signOff.role : ""}.`),
      verifySuite: (slug, list) => `'${slug}' está cerrada, pero sus verificaciones del proyecto no tienen una ejecución correcta desde la última actividad en las tareas: ${list} — /spec-finish se niega y el gate de fin de turno devuelve un "hecho" hasta que pasen. Ejecútalas y registra las ejecuciones: dev-spec finish ${slug} --run (o spec_finish {evidence: [{name, command, exitCode}]}).`,
      verifyDuplicate: (slug, list, n) => `Todas las tareas están marcadas, pero no todas están verificadas: ${list} — hay dos tareas con el número ${n}, así que una ejecución registrada para la #${n} solo llega a la primera (dev-spec done ${slug} ${n} responde por ella). Renumera las tareas en .specs/${slug}/tasks.md para que cada número sea único (doctor: duplicate-tasks), vuelve a aprobar la fase tasks (/approve ${slug} tasks) y registra después la ejecución de cada tarea renumerada.`,
      signOffWhy: { approvals: (list) => `la aprobación de ${list}`, changeRequests: (list) => `la solicitud de cambio ${list}`, join: " y " },
      refinish: (slug, day, why) => `'${slug}' se cerró el ${day}, pero cambió desde entonces (${why}) y todas sus tareas están hechas — ciérrala de nuevo: /spec-finish ${slug} (spec_finish {write: true}) renueva el informe de preparación, el resumen del merge y la línea base de drift; después vuelve a dar la aprobación final: /approve ${slug} execution.`,
      driftedStale: (why) => `También cambió desde ese cierre (${why}): decidas lo que decidas, vuelve a cerrarla después — /spec-finish (spec_finish {write: true}) registra la línea base nueva.`,
      verify: (slug, list, n, runnable) => `Todas las tareas están marcadas, pero no todas están verificadas: ${list} — /spec-finish y la aprobación final se niegan hasta que cada una tenga una ejecución correcta. ` +
        (runnable ? `Vuelve a ejecutar el comando _Verify:_ de la tarea ${n} y registra el resultado: dev-spec done ${slug} ${n} --run` : `Registra una ejecución correcta de la tarea ${n}: spec_complete_task {name: "${slug}", number: ${n}, evidence: {command, exitCode: 0}} (dev-spec done ${slug} ${n} --cmd "<comando>" --exit 0)`) +
        "; una ejecución que falla significa que primero hay que corregir el código.",
    },
    clarify: {
      resolveMarker: (mk) => "Resuelve [NEEDS CLARIFICATION]: " + (mk || "(sin especificar)"),
      addSuccessCriteria: "Añade una sección Criterios de Éxito con resultados medibles y agnósticos a la tecnología (SC-001 …).",
      idSuccessCriteria: "Da a cada criterio de éxito un ID estable (SC-001 …) y un objetivo medible.",
      prioritize: "Prioriza las historias de usuario (P1 = la porción MVP que entrega valor sola; P2/P3 incrementales).",
      independentTest: "Indica cómo cada historia de usuario puede testearse de forma independiente (para ser lanzable por sí sola).",
      quantifyVague: (line, text) => `Cuantifica el término vago en la línea ${line}: ${text}`,
      edgeCases: "Lista los casos límite y el comportamiento de manejo de errores (cada uno como un AC SI…ENTONCES).",
      outOfScope: "Indica explícitamente qué está FUERA de alcance.",
      nfr: "Especifica los requisitos no funcionales (rendimiento / seguridad / accesibilidad) con objetivos medibles.",
      unwanted: "Añade criterios de comportamiento no deseado (SI…ENTONCES / IF…THEN / SE…ENTÃO) para las rutas de fallo.",
      tenant: "Especifica el aislamiento de inquilino: el inquilino A nunca debe leer/escribir datos del inquilino B (escríbelo como un AC).",
      rateLimit: "Especifica los límites de tasa (por usuario / por inquilino / global).",
      aiQuality: "Especifica el objetivo de calidad de salida y el comportamiento de rechazo para la ruta de IA.",
      aiCost: "Especifica un techo de coste por solicitud ($/tokens).",
    },
    hook: {
      earsClean: (n) => `Verificación EARS: ${n} criterios, todo limpio ✓`,
      earsIssues: (errs, warns, top, hasErr) =>
        `Verificación EARS en requirements.md — ${errs} error(es), ${warns} aviso(s):\n${top}` + (hasErr ? "\nCorrige los errores antes de avanzar al diseño." : ""),
      traceOk: (n) => `Trazabilidad: los ${n} ACs cubiertos por tareas ✓`,
      traceGaps: (feature, parts) => `Lagunas de trazabilidad en ${feature}:\n  - ${parts}`,
      roadmapUpdated: (pct, complete, total) => `Roadmap actualizado → ${pct}% (${complete}/${total} funciones).`,
      sessionHeader: "dev-spec-driven — funciones en .specs/:",
      sessionLine: (name, tracks, phase, done, total) => `  • ${name} [${tracks}] — ${phase} (${done}/${total} tareas)`,
      sessionMore: (n) => `  … +${n} función(es) más — /spec-status (o dev-spec list) las muestra todas`,
    },

    evidenceGate: {
      noContent: "La evidencia necesita un comando (con su exit code) o un resumen — un exit code solo no prueba nada.",
      manualOnRunnable: (n, slug) => `Tarea ${n}: se registró una nota, pero su comando _Verify:_ no se ejecutó — sigue sin verificar hasta que se registre una ejecución correcta: dev-spec done ${slug} ${n} --run`,
      redPhaseTestWord: "la prueba",
      redPhaseVerify: (n, slug, test) => `La tarea ${n} escribe una prueba que debe FALLAR (la fase roja), así que un _Verify:_ que debe pasar nunca pasará en ella. Marca la tarea ${n} con _Expect: fail_ — una ejecución que FALLE es entonces su prueba (${test} falla antes del arreglo) y una que pase se rechaza: dev-spec done ${slug} ${n} --run. O mueve el comando a la tarea que la pone en verde (el arreglo — su _Verify:_ prueba entonces el arreglo).`,
      failedRun: (n, code, slug, runnable) => `Tarea ${n}: su última ejecución registrada falló (exit ${code}) — una nota no cambia eso; sigue sin verificar hasta que se registre una ejecución correcta ` +
        (runnable ? `de su comando _Verify:_: dev-spec done ${slug} ${n} --run` : "(un comando con exit code 0)."),
      duplicateNumber: (n) => `Tarea ${n}: otra tarea también usa el número ${n} y la evidencia registrada es de esa — esta sigue sin verificar; renumera las tareas y luego registra la evidencia de esta.`,
      staleEvidence: (n, slug, runnable) => `Tarea ${n}: la evidencia registrada es de otra tarea o de un comando _Verify:_ anterior — sigue sin verificar hasta que se registre ` +
        (runnable ? `una ejecución de esta: dev-spec done ${slug} ${n} --run` : "la evidencia de esta."),
      reason: { "no-evidence": "sin evidencia", "failed-run": "la última ejecución falló", "manual-note-on-runnable-verify": "solo una nota, comando _Verify:_ sin ejecutar", "duplicate-number": "número compartido con otra tarea",
        "stale-evidence": "evidencia de otra tarea o de otro comando _Verify:_",
        "unexpected-pass": "la ejecución pasó, pero _Expect: fail_ necesita una ejecución en rojo",
        unobserved: "ejecución no observada por el harness" },
      duplicateTasks: (list) => `números de tarea repetidos: ${list} — complete/brief eligen la primera pendiente; renuméralas`,
    },
    observed: {
      on: "Modo de evidencia OBSERVADO — una tarea cuyo _Verify:_ tiene un comando solo queda verificada con una ejecución correcta que el harness vio (en Claude Code, el hook de observación del plugin guarda cada ejecución Bash de un comando _Verify:_ o de una verificación del proyecto) o que dev-spec done --run / finish --run hizo; la ejecución de una verificación del proyecto también (roadmap.json meta.evidence). Un cliente solo MCP no tiene ese hook: sus ejecuciones se registran con dev-spec done <función> <n> --run.",
      off: "Modo de evidencia REPORTADO — las ejecuciones que un agente reporta verifican tal como se dan (roadmap.json meta.evidence); cada registro sigue diciendo si el harness la observó.",
      badValue: (v) => `--evidence admite reported u observed (recibido '${v}').`,
      badInput: (v) => `evidence debe ser "reported" u "observed" (recibido '${v}').`,
      unobservedRedNote: (n, slug) => `La tarea ${n} está marcada _Expect: fail_: su prueba es la ejecución en ROJO, y el harness nunca la vio — este proyecto solo verifica ejecuciones observadas (roadmap.json meta.evidence: observed). Repite la ejecución en rojo donde se observe: aparta la corrección (git stash), ejecuta el comando _Verify:_ con la herramienta Bash en Claude Code o con dev-spec done ${slug} ${n} --run (debe fallar), después restaura la corrección y registra su ejecución correcta.`,
      unobservedNote: (n, slug) => `Tarea ${n}: la ejecución quedó registrada, pero el harness nunca la vio — este proyecto solo verifica un comando _Verify:_ con una ejecución observada (roadmap.json meta.evidence: observed). Ejecuta el comando con la herramienta Bash en Claude Code y vuelve a registrarlo, o deja que la CLI lo ejecute: dev-spec done ${slug} ${n} --run`,
      neverObserved: "Nunca se observó ninguna ejecución en este proyecto: solo Claude Code con el plugin dev-spec-driven las guarda (hooks/observe-hook.js) — un cliente solo MCP no tiene hook, así que registra las ejecuciones con dev-spec done <función> <n> --run (o vuelve atrás: dev-spec init --evidence reported).",
      naHint: "Este proyecto solo verifica ejecuciones que el harness vio (roadmap.json meta.evidence: observed): ejecuta el comando con la herramienta Bash en Claude Code, o por la CLI (--run).",
    },
    taskDone: {
      done: (n, verified, done, total) => `Tarea ${n} hecha${verified ? " (verificada)" : ""}. ${done}/${total}`,
      already: (n, verified, done, total) => `La tarea ${n} ya estaba hecha${verified ? " (verificada)" : ""}. ${done}/${total}`,
      next: (n, text) => `  siguiente → #${n} ${text}`,
      allDone: "  — todo hecho ✓",
      numberInt: "el número de tarea debe ser un entero",
      noRunnable: (n) => `la tarea ${n} no tiene un marcador _Verify: <comando>_ ejecutable`,
      shellHint: "Consejo: la shell predeterminada de Windows (cmd.exe) no pudo ejecutar esta línea de comandos tal como está escrita. Si el comando _Verify:_ está escrito para una shell POSIX, reinténtalo con --shell bash (o define DEV_SPEC_SHELL=bash).",
      posixOnWindows: (cmd, kinds) => `el comando _Verify:_ \`${cmd}\` usa sintaxis de shell POSIX (${kinds.map((k) => ({ "single-quotes": "comillas simples '…'", variable: "$VARIABLES" })[k] || k).join(", ")}) que cmd.exe — la shell predeterminada de --run en Windows — interpreta de otra forma, a menudo sin fallar: no tiene comillas simples y nunca expande $VAR, así que una comprobación rota podría registrarse como ejecución correcta. No se ejecutó nada; la tarea sigue abierta. Vuelve a ejecutarlo con --shell bash (Git Bash; o define DEV_SPEC_SHELL=bash) — o con --shell cmd para ejecutarlo igualmente en cmd.exe.`,
    },

    tracks: {
      unknown: (items, valid) => `Track${items.length > 1 ? "s" : ""} desconocido${items.length > 1 ? "s" : ""}: ${items.map((u) => `'${u.token}'` + (u.suggestion ? ` (¿querías decir '${u.suggestion}'?)` : "")).join(", ")}. Tracks válidos: ${valid}.`,
      cannotRemoveCore: "'core' está siempre activo — no se puede quitar.",
      bugfixNeedsTdd: "Un bugfix es siempre test-first — no se puede quitar +tdd.",
      notActive: (list) => `No activo: ${list} — nada que quitar.`,
      removed: (list, slug) => `Tracks desactivados: ${list}. No se borró ningún archivo — los artefactos inactivos se quedan donde están y vuelven a contar si vuelves a añadir el track. Vuelve a ejecutar /spec-doctor ${slug}.`,
      addedOnCreate: (slug, list) => `'${slug}' ya existía — tracks añadidos: ${list} (artefactos, secciones de diseño, steering, tareas) — no se sobrescribió nada.`,
      designTitle: (name) => `# Diseño: ${name}`,
      acPlaceholder: (tr) => `[el criterio +${tr} que prueba esta tarea]`,
      designSections: (marker) => `design.md (secciones ${marker})`,
      addedDesign: "design.md (+secciones)",
      addedTasks: "tasks.md (+tareas)",
      addedActiveTracks: "classification.md (Tracks Activos)",
      taskBlock: (track, start) => BUILD.es.trackTasks({ track, start }),
    },

    args: {
      missing: (list) => `Falta(n) argumento(s) obligatorio(s): ${list}`,
      invalid: (list) => `Argumento(s) no válido(s): ${list}`,
      item: (arg, expected, got) => `${arg} debe ser ${expected} (recibido: ${got})`,
      type: { string: "una cadena", integer: "un entero", number: "un número", boolean: "un booleano (true/false)", array: "un array", object: "un objeto", null: "null" },
      arrayOf: (t) => `un array (cada elemento ${t})`,
      oneOf: (list) => `uno de: ${list}`,
      atLeast: (n) => `≥ ${n}`,
      notObject: "arguments debe ser un objeto JSON.",
      dotdot: "projectDir no puede contener segmentos de ruta '..'.",
      network: (dir) => `projectDir debe ser una carpeta local — una ruta de red o de dispositivo (${dir}) se rechaza, para que una llamada a una herramienta nunca apunte este servidor local a otra máquina; abre el proyecto localmente (o inicia el servidor con él como carpeta de trabajo).`,
      unknownTool: (name) => `Herramienta desconocida: ${name} — tools/list lista las herramientas de este servidor.`,
      noTool: "tools/call necesita params.name — la herramienta a llamar (tools/list las lista).",
    },
    jsonShape: {
      invalid: (rel, detail) => `${rel} tiene una estructura inesperada (${detail}) — corrígelo a mano; no se sobrescribirá.`,
      topLevel: "el nivel superior debe ser un objeto",
      features: "'features' debe ser un objeto",
      featureEntry: (k) => `features.${k} debe ser un objeto`,
      dependsOn: (k) => `features.${k}.dependsOn debe ser un array de nombres de funciones`,
      meta: "'meta' debe ser un objeto",
      backlog: "'backlog' debe ser un array",
      backlogEntry: "cada entrada de 'backlog' debe ser un objeto con 'name'",
      approvals: "'approvals' debe ser un objeto",
      evidence: "'evidence' debe ser un objeto",
      tracks: "'tracks' debe ser un array",
      approvalHistory: "'approvalHistory' debe ser un array",
      changes: "'changes' debe ser un array",
      finishChecks: "'finishChecks' debe ser un objeto",
      signoffs: "'signoffs' debe ser un objeto",
      unticks: "'unticks' debe ser un array",
    },
    depend: {
      unknown: (list) => `Cada dependencia debe ser una función existente — no encontrada(s): ${list}`,
      orderInt: (v) => `order debe ser un entero (recibido: '${v}').`,
    },
    evals: {
      usage: "Uso: node run-evals.js <función> [--dry-run] [--set-baseline] [--require-live] [--model=ID] [--project=DIR] [--max-items=N]",
      noEvalsDir: (slug, dir) => `No hay carpeta evals/ para '${slug}' en ${dir}`,
      requireLive: "harness de evals: ANTHROPIC_API_KEY no está definida y se pidió --require-live — no se hará un dry run en su lugar.",
      header: (slug) => `dev-spec-driven evals — función '${slug}'`,
      config: (model, prompt, mode) => `  modelo: ${model}   prompt: ${prompt}   modo: ${mode}`,
      none: "(ninguno)",
      modeDry: "DRY-RUN (sin llamadas al modelo)",
      modeLive: "REAL",
      noKey: "  (ANTHROPIC_API_KEY no definida — ejecución en seco. Defínela para una ejecución real.)",
      badJson: (set, err) => `  ✗ ${set}.json — JSON no válido: ${err}`,
      badItems: (set) => `  ✗ ${set}.json — 'items' debe ser un array`,
      emptySet: (set) => `  ✗ ${set}.json — sin elementos que evaluar: un conjunto que no evalúa nada no puede aprobar — añade elementos de eval (evals/README.md) o borra el archivo`,
      badItem: (set, label, why) => `  ✗ ${set}.json — elemento ${label}: ${why}`,
      moreBad: (n) => `      … +${n} elemento(s) no válido(s)`,
      itemWhy: {
        notObject: "no es un objeto",
        noId: "sin 'id' (texto no vacío)",
        noInput: "sin 'input' (texto no vacío)",
        noExpect: "sin objeto 'expect'",
        unknownType: (t, types) => `tipo de evaluador desconocido '${t}' (usa ${types})`,
        noValue: (t) => `'${t}' necesita un 'value'`,
        badRegex: (msg) => `la regex no compila: ${msg}`,
        noRubric: "'judge' necesita una 'rubric'",
      },
      badThresholds: (why) => `  ✗ thresholds.json — ${why}`,
      thresholdsShape: "debe ser un objeto que dé a cada conjunto (golden / adversarial / regression) un número entre 0 y 1",
      capped: (set, max, total) => `  ⚠ ${set}: limitado a ${max}/${total} elementos (auméntalo con --max-items=N)`,
      wouldRun: (set, n, kinds) => `  • ${set}: ${n} elemento(s) — ejecutaría ${kinds}`,
      score: (ok, set, pass, n, pct, thr) => `  ${ok ? "✓" : "✗"} ${set}: ${pass}/${n} = ${pct}% (umbral ${thr}%)`,
      failure: (id, detail) => `      - ${id}: ${detail}`,
      error: (msg) => `ERROR ${msg}`,
      resp: (sample) => ` | respuesta: ${sample}`,
      fail: "falló",
      judge: "juez",
      judgeSkipped: "juez no usado (heurística aplicada)",
      unknownGrader: (t) => `evaluador desconocido '${t}'`,
      vsBaseline: "\n  vs baseline:",
      delta: (set, base, cur, sign, pp) => `    ${set}: ${base}% → ${cur}% (${sign}${pp}pp)`,
      baselineWritten: (rel) => `\n  baseline guardada → ${rel}`,
      tokens: (i, o) => `\n  tokens: ${i} de entrada / ${o} de salida`,
      dryInvalid: "\nEl dry run encontró conjunto(s) de evals no válido(s) — corrígelos antes de una ejecución real.",
      liveInvalid: "\nConjunto(s) de evals no válido(s) — corrígelos primero; no se ha llamado a ningún modelo.",
      dryOk: "\nDry run completado — los conjuntos son válidos. Define ANTHROPIC_API_KEY y vuelve a ejecutar para obtener resultados reales.",
      verdict: (below) => `\nVeredicto: ${below ? "POR DEBAJO DEL UMBRAL ✗" : "todos los conjuntos pasan ✓"}`,
      crashed: (msg) => `error en el harness de evals: ${msg}`,
    },

    traceGapText: {
      kinds: {
        uncoveredByTasks: "ACs sin tarea",
        phantomAcsInTasks: "tareas referencian ACs desconocidos (¿erratas?)",
        uncoveredByTests: "ACs sin prueba planeada",
        phantomAcsInTests: "el plan de pruebas cubre ACs desconocidos (¿erratas?)",
        phantomTestsInTasks: "tareas referencian pruebas desconocidas (¿erratas?)",
        testsNotMappedToTasks: "pruebas planeadas que ninguna tarea pone en verde",
        missingImplFiles: "ficheros _Implements:_ que no existen",
      },
      gap: (label, list) => `${label}: ${list}`,
      allCovered: (n) => `los ${n} ACs cubiertos por tareas`,
      removedKinds: {
        phantomAcsInTasks: "las tareas aún citan ACs que una solicitud de cambio eliminó (elimina o actualiza esas tareas — no es una errata)",
        phantomAcsInTests: "el plan de pruebas aún cubre ACs que una solicitud de cambio eliminó (elimina o actualiza esas filas — no es una errata)",
      },
      removedRef: (id, n) => `${id} (solicitud de cambio #${n})`,
    },
    phaseNames: {
      complete: "completada", executing: "en ejecución", "tasks-ready": "tareas listas", "eval-plan": "plan de evals", "test-plan": "plan de pruebas",
      design: "diseño", requirements: "requisitos", classified: "clasificada", empty: "vacía",
    },
    featureOps: {
      removeNeedsConfirm: (slug, n) => `Eliminar '${slug}' borra .specs/${slug}/ definitivamente (${n} fichero(s)). No se ha borrado nada — pasa confirm: true para eliminarla, o archívala (reversible).`,
      backlogNotFound: (name, known) => `'${name}' no está en el backlog${known ? ` (backlog: ${known})` : " (el backlog está vacío)"}.`,
      backlogIsFeature: (name, slug) => `'${name}' ya tiene una spec (.specs/${slug}/) — el backlog es para funciones aún sin spec (estado: dev-spec status ${slug}).`,
    },
    cliOutput: {
      words: { pass: "ok", warn: "aviso", fail: "falla", "gaps-found": "con lagunas", clear: "clara", "needs-clarification": "requiere aclaración", error: "error" },
      yes: "sí", no: "no",
      tracks: (label, conf) => `Tracks: ${label}   confianza: ${conf}`,
      note: (n) => `\nNota: ${n}`,
      created: (dir, lang, files, kept) => `Creado en ${dir} [${lang}]:\n  ${files}` + (kept ? `\n  (ya existían, se mantienen: ${kept})` : ""),
      nothingNew: "(nada nuevo)",
      steeringCreated: (f) => `Creado ${f}`,
      steeringExists: (f) => `Ya existe (no se ha modificado) ${f}`,
      feature: (slug, label, lang) => `Función '${slug}' [${label}] (${lang})`,
      noFeatures: (dir) => `No hay funciones en ${dir}`,
      listLine: (name, tracks, phase, done, total) => `  ${name.padEnd(28)} [${tracks}]  ${phase}  (${done}/${total} tareas)`,
      statusHead: (f, tracks, phase) => `Función: ${f}  [${tracks}]  fase: ${phase}`,
      statusTasks: (done, total, next) => `Tareas: ${done}/${total}` + (next ? `  siguiente → ${next}` : ""),
      doctorHead: (f, tracks, verdict, ready) => `Diagnóstico: ${f}  [${tracks}]  veredicto=${verdict}  lista para avanzar: ${ready}`,
      traceHead: (f, verdict, acs, covered) => `Trazabilidad: ${f}  veredicto=${verdict}  ACs=${acs}  cubiertos por tareas=${covered}`,
      earsHead: (n, m, verdict) => `EARS: ${n} criterios, ${m} con verbo modal, veredicto=${verdict}`,
      next: (n, text, left, total) => `Siguiente → #${n} ${text}  (quedan ${left}/${total})`,
      allDone: "Todas las tareas hechas ✓",
      batch: (list) => `  lote paralelo: ${list}`,
      mergeSummaryAt: (p) => `\nResumen del merge → ${p}`,
      briefAt: (p, inline) => `Brief → ${p}` + (inline ? "  (solo inline: tarea de prompt +ai)" : ""),
      reportAt: (p) => `  informe → ${p}`,
      ledgerAt: (p) => `  ledger → ${p}`,
      unresolved: (list) => `  ⚠ sin resolver: ${list}`,
      approved: (phase, f) => `Fase '${phase}' de ${f} aprobada ✓`,
      backlogHead: (n) => `Backlog (${n}):`,
      backlogAdded: (name) => `✓ '${name}' añadida al backlog`,
      backlogRemoved: (name) => `✓ '${name}' eliminada del backlog`,
      wrote: (file, pct, c, t) => `✎ generado ${file}` + (pct != null ? `  (${pct}%, ${c}/${t})` : ""),
      noRoadmapFeatures: (dir) => `Aún no hay funciones en ${dir}`,
      roadmapHead: (pct, c, t, cycle) => `Hoja de ruta — progreso global ${pct}%  (${c}/${t} completas)` + (cycle ? `  ⚠ CICLO: ${cycle}` : ""),
      deps: (list, unmet) => `  deps: ${list}` + (unmet ? ` (pendientes: ${unmet})` : ""),
      scanHead: (root, truncated) => `Análisis de ${root}` + (truncated ? " (truncado en el límite)" : ""),
      scanFiles: (n, stack) => `  ficheros: ${n}  | stack: ${stack || "desconocido"}`,
      scanDirs: (list) => `  carpetas de primer nivel: ${list}`,
      scanExt: (list) => `  por extensión: ${list}`,
      scanEndpoints: (n, files) => `  endpoints: ${n} ruta(s) en ${files} fichero(s)`,
      coverage: (pct, d, t) => `Cobertura de specs: ${pct}%  (${d}/${t} ficheros de código nombrados en _Implements:_)`,
      undocumented: (list) => `  carpetas sin cobertura: ${list}`,
      clarify: (f, tracks, verdict, n) => `Aclarar: ${f}  [${tracks}]  → ${verdict} (${n} pregunta(s))`,
      naHead: (f, tracks, phase, verdict, gatesOk) => `Función: ${f}  [${tracks}]  fase: ${phase}  veredicto=${verdict}  gates aprobados: ${gatesOk}`,
      changed: (list) => `  ⚠ modificado desde la última aprobación: ${list}`,
      renamed: (a, b) => `'${a}' renombrada → '${b}' ✓`,
      archived: (f, dest) => `'${f}' archivada → .specs/${dest} ✓`,
      removed: (f) => `'${f}' eliminada ✓`,
      wouldRemove: (slug, dir, n, entries) => `Esto eliminaría '${slug}' definitivamente: ${dir} (${n} fichero(s): ${entries})`,
      confirmHint: (slug) => `No se ha eliminado nada. Vuelve a ejecutar con --yes para confirmar — o archívala: dev-spec feature archive ${slug}`,
      missingValue: (flag) => `falta el valor de --${flag}`,
      unknownFlag: (flag, suggestion) => `opción desconocida ${flag}` + (suggestion ? ` — ¿quizás ${suggestion}?` : ".") + " Las opciones están en `dev-spec help`.",
      unknownRules: (tool, known) => `herramienta desconocida '${tool}'. Conocidas: ${known}`,
      scaleSections: (list) => `Secciones de escala: ${list}`,
      aiSections: (list) => `Secciones de IA: ${list}`,
      dependsOn: (f, deps, order, unknown) => `${f} depende de: ${deps || "(ninguna)"}` + (order != null ? `  orden=${order}` : "") + (unknown ? `  ⚠ dependencias desconocidas: ${unknown}` : ""),
      trackNow: (f, tracks) => `'${f}' ahora [${tracks}]`,
      usage: (syntax) => `uso: ${syntax}`,
      unknownCommand: (c) => `comando desconocido '${c}'. Ejecuta \`dev-spec help\`.`,
      unknownClient: (c, known) => `cliente desconocido '${c}'. Conocidos: ${known}`,
    },

    gates: {
      empty: "sin contenido además de los títulos",
      more: (n) => `+${n} más`,
      placeholdersNone: "ningún placeholder de la plantilla en la fase actual",
      placeholdersFail: (list) => `placeholders de la plantilla sin rellenar en la fase actual (o en una anterior): ${list}`,
      placeholdersLater: (list) => `las fases siguientes aún son plantilla (todavía no bloquea): ${list}`,
      traceDeferred: (files) => `aún no trazado — sigue siendo la plantilla de una fase posterior: ${files} (sus referencias de plantilla no son erratas ni bloquean esta fase); se traza cuando se escriba`,
      earsPlaceholder: (list) => `El criterio aún tiene placeholder(s) de la plantilla ${list} — escribe el disparador/comportamiento real.`,
      constitutionUnfilled: "la sección Verificación de la Constitución falta o está sin rellenar",
      checkLine: (id, detail) => `  ✗ ${id}${detail ? " — " + detail : ""}`,
      approveRefused: (phase, slug, ids, lines) => `No se puede aprobar '${phase}' de '${slug}' — verificaciones que fallan: ${ids}.\n${lines}\nCorrígelas (detalles: /spec-doctor ${slug}), o pasa force: true (CLI: --force) para registrar la aprobación igualmente — queda marcada como forzada.`,
      approveNothing: (phase, slug, file) => `Nada que aprobar: '${phase}' no tiene artefacto en '${slug}' (${file} no existe, o su track está desactivado) — ni con force.`,
      approveForced: (ids) => `Aprobado con force — las verificaciones que fallan quedan registradas con la aprobación: ${ids}.`,
      phaseOrder: (list, slug, first) => `hay fases anteriores aún sin aprobar: ${list} — apruébalas primero, en orden (/approve ${slug} ${first})`,
      forcedGates: (list) => `aprobado con force pese a verificaciones que fallan: ${list}`,
      finishRootCause: "bug.md → Causa Raíz sin rellenar — ninguna corrección antes de conocer la causa",
      finishPlaceholders: (list) => `placeholders de la plantilla sin rellenar en la cadena de la spec: ${list}`,
      finishChanged: (list) => `modificados tras su aprobación (revisar y volver a aprobar): ${list}`,
      bugGate: (n, first) => `La tarea ${n} aún no puede completarse: bug.md → Causa Raíz está sin rellenar. Ninguna corrección antes de que la causa raíz esté escrita en bug.md — haz primero la tarea ${first} (encuentra la causa raíz con evidencia y escríbela allí).`,
      bugGateFirst: (n, first) => `La tarea ${n} aún no puede completarse: bug.md → Causa Raíz está sin rellenar y ninguna tarea la escribe — solo la tarea ${first} puede completarse hasta que la causa raíz esté escrita en bug.md (ninguna corrección antes de la causa raíz).`,
      bugGateTicked: (n, rc) => `La tarea ${n} aún no puede completarse: bug.md → Causa Raíz sigue vacía — la tarea ${rc} está marcada, pero lo que entrega es esa sección. Escribe allí la causa raíz, con su evidencia (ninguna corrección antes de que la causa raíz esté escrita en bug.md).`,
      rootCauseTaskEmpty: (n) => `La tarea ${n} está marcada, pero bug.md → Causa Raíz sigue vacía — escribe allí la causa raíz, con su evidencia: las tareas siguientes (la prueba de regresión, la corrección) siguen rechazadas hasta que esté escrita.`,
      fill: (file, what, hint) => `Rellena ${file} — ${what}; luego ${hint}.`,
      fillMissing: "aún no existe",
      fillEmpty: "no tiene contenido además de los títulos",
      fillPlaceholders: (n, first) => `${n} placeholder(s) de la plantilla sin rellenar (primero: ${first})`,
      fillHint: {
        "classification.md": (slug) => `confirma los tracks y escribe el radio de impacto y las etiquetas de cumplimiento (/classify ${slug}), luego /approve ${slug} classification`,
        "requirements.md": (slug) => `compruébalo con /clarify ${slug} y ears_validate (dev-spec ears ${slug})`,
        "bug.md": (slug) => `escribe la Reproducción y la Causa Raíz con evidencia (/spec-doctor ${slug})`,
        "design.md": (slug) => `ejecuta /spec-doctor ${slug} (secciones obligatorias, Verificación de la Constitución)`,
        "test-plan.md": (slug) => `comprueba la cobertura de los ACs con trace_check (dev-spec trace ${slug})`,
        "eval-plan.md": (slug) => `define los umbrales y la baseline, luego /spec-doctor ${slug}`,
        "tasks.md": (slug) => `desglosa el diseño en tareas reales (/createTask ${slug}), luego trace_check`,
        default: (slug) => `/spec-doctor ${slug}`,
      },
      approveClassification: (slug) => `Confirma y aprueba la clasificación — /approve ${slug} classification.`,
      fixGate: (phase, list, slug) => `Antes de aprobar '${phase}', corrige lo que el gate de aprobación rechazaría: ${list} — después /approve ${slug} ${phase}.`,
      gateWouldRefuse: (phase, ids) => `aprobar '${phase}' sería rechazado (${ids})`,
      noRealTasks: "solo las tareas de la plantilla — divide el diseño en al menos una tarea real propia",
      testsNotInCode: (list) => `pruebas planeadas que ningún fichero de prueba nombra todavía: ${list} — escribe cada prueba que falla con su T-ID en el nombre (trace_check {code: true} las encuentra)`,
      testsNotInCodeSignOff: (list) => `pruebas planeadas que ningún fichero de prueba nombra todavía: ${list} — la implementación ya empezó: comprueba que cada una existe con su T-ID en el nombre de la prueba (test("T-01 …")) para que trace_check {code: true} la encuentre`,
      noPlannedTests: "test-plan.md no lista ningún T-ID — planea las pruebas primero",
      evalSetsSample: "evals/golden.json sigue siendo el conjunto de ejemplo del scaffold — escribe los casos golden de esta función, ejecuta el harness y registra la baseline",
      evalSetsMissing: "evals/golden.json no existe o no tiene ítems de eval ({\"items\": […]}) — escribe primero el conjunto golden de esta función",
      testsGateChecks: (ids) => `(el gate de aprobación comprueba esto: ${ids})`,
      clarifyPlaceholders: (file, n, list) => `Sustituye los ${n} placeholder(s)/TBD de la plantilla en ${file}: ${list}`,
      hookPlaceholders: (n, list) => `Placeholders de la plantilla: ${n} sin rellenar en requirements.md (${list}) — sustitúyelos antes de aprobar los requisitos.`,
    },

    brownfield: {
      frameworks: (list) => `  frameworks: ${list}`,
      routeLine: (method, p, loc) => `    ${method.padEnd(7)} ${p}  (${loc})`,
      moreRoutes: (n) => `    … ${n} más (--json las lista, hasta el límite)`,
      routesTruncated: (shown, total) => `Se muestran las primeras ${shown} de ${total} rutas — el recuento de endpoints las incluye todas.`,
      readCapped: (n) => `Solo se leyeron los primeros ${n} ficheros de código (rutas, nombres de variables de entorno, pistas de pruebas) — esas listas pueden estar incompletas.`,
      tests: (n, fws) => `  pruebas: ${n} fichero(s) · frameworks: ${fws}`,
      entrypoints: (list) => `  puntos de entrada: ${list}`,
      env: (list, more) => `  variables de entorno (solo nombres): ${list}` + (more ? ` … +${more}` : ""),
      migrations: (n, dirs) => `  migraciones/esquema: ${n} fichero(s)` + (dirs ? ` — ${dirs}` : ""),
      none: "ninguno",
      coverageTests: (n) => `  ficheros de prueba (aparte, no cuentan): ${n}`,
      coverageFolder: (folder, covered, files, pct) => `  ${folder.padEnd(24)} ${String(covered + "/" + files).padStart(9)}  ${pct}%`,
      root: "(raíz)",
      coverageUnmatched: (list) => `  ⚠ entradas _Implements:_ que no nombran nada en el disco: ${list}`,
      coverageNonCode: (list) => `  · entradas _Implements:_ que nombran pruebas o ficheros que no son código (no cuentan): ${list}`,
      integrationPlanPlaceholder: "integration-plan.md sigue siendo la plantilla — rellena los puntos de integración, las modificaciones y los riesgos antes de implementar",
      integrationPlanOk: "plan de integración rellenado",
    },
    importSpec: {
      note: (tool, rel, date) => `> Importado de ${tool} \`${rel}\` el ${date}.`,
      unknownTool: (tool, known) => `Formato de spec desconocido '${tool}'. Conocidos: ${known}.`,
      pathRequired: "falta la ruta — la carpeta (o un fichero) de la spec a importar.",
      outside: (p) => `'${p}' está fuera del proyecto — spec_import solo lee dentro de la carpeta del proyecto.`,
      notFound: (p) => `'${p}' no encontrado.`,
      nothing: (tool, p) => `No se encontraron ficheros de spec ${tool} en '${p}'.`,
      exists: (slug) => `La función '${slug}' ya existe — la importación nunca la sobrescribe. Indica otro nombre.`,
      featureTitle: (name) => `# Función: ${name}`,
      tasksTitle: (name) => `# Tareas: ${name}`,
      summary: "## Resumen",
      summaryPlaceholder: "[1-2 frases: qué hace y por qué importa]",
      stories: "## Historias de Usuario",
      story: (n, pri, title) => `### US-${n}${pri ? ` (${pri})` : ""}: ${title}`,
      criteria: "#### Criterios de Aceptación (EARS)",
      functional: "## Requisitos Funcionales",
      entities: "## Entidades Clave",
      success: "## Criterios de Éxito",
      edge: "## Casos Límite y Manejo de Errores",
      original: (tool, text) => `<!-- ${tool}: ${text} -->`,
      notEars: "[NEEDS CLARIFICATION: aún no es una frase EARS — añade su disparador (CUANDO/SI) y la respuesta del sistema]",
      noCriteria: "[NEEDS CLARIFICATION: esta historia no tiene criterios de aceptación]",
      optional: "(opcional)",
      modified: "(modificado)",
      importedNotes: "## Notas importadas",
      otherTasks: "## Otras tareas",
      ears: { while: "MIENTRAS", when: "CUANDO", if: "SI", where: "DONDE", then: "ENTONCES", shall: "EL SISTEMA DEBE", not: "NO", ensure: "EL SISTEMA DEBE garantizar que" },
      wNotEars: (ids) => `no convertidos a EARS (texto conservado, marcado [NEEDS CLARIFICATION]): ${ids}`,
      wNoCriteria: (ids) => `historias sin criterios de aceptación: ${ids}`,
      wNoCriteriaAtAll: "el origen no tiene criterios de aceptación — requirements.md aún no define ningún AC: escríbelos antes de aprobar los requisitos (hasta entonces, un plan de pruebas +tdd recibe una fila genérica)",
      wUnknownRef: (task, ref) => `tarea ${task}: la referencia _Requirements:_ '${ref}' no corresponde a ningún criterio importado — se conserva tal cual`,
      wUnknownRefLine: (line, ref) => `tasks.md, línea ${line}: la referencia _Requirements:_ '${ref}' no corresponde a ningún criterio importado — se conserva tal cual`,
      wCarried: (list) => `copiado tal cual, sin correspondencia con historias o criterios (revísalo): ${list}`,
      wNoRefs: "las tareas importadas no tienen referencias _Requirements:_ — añádelas para que trace_check asocie cada AC a una tarea",
      wNoTasks: "el origen no tiene tasks.md — se conservó el tasks.md del scaffold (los _Requirements:_ / _Makes green:_ de la plantilla limitados a los criterios importados)",
      taskAcPlaceholder: "[un criterio importado que prueba esta tarea]",
      taskTestPlaceholder: "[la prueba planificada que esta tarea pone en verde]",
      wNoDesign: (file) => `el origen no tiene ${file} — se conservó el design.md del scaffold`,
      wNoRequirements: (file) => `no se encontraron requisitos en ${file}`,
      wRemoved: (name) => `el requisito REMOVED '${name}' no se importó`,
      wRenamed: (from, to) => `requisito RENAMED '${from}' → '${to}' (importado con el nombre nuevo)`,
      wSkipped: (files) => `no importados (se quedan donde están): ${files}`,
      wUnreadable: (file) => `${file} apunta fuera del proyecto — omitido`,
      done: (tool, rel, slug, label, lang) => `Importado de ${tool} ${rel} → función '${slug}' [${label}] (${lang})`,
      mapping: (n, sample) => `  correspondencia: ${n} ID(s)` + (sample ? ` — ${sample}` : ""),
    },

    appendTasks: {
      heading: "Fase: Convergencia",
      checkpoint: "las tareas de convergencia están completadas y verificadas — la spec y el código vuelven a coincidir.",
      noTasks: "Indica al menos una tarea: tasks = [{ text, requirements?, implements?, verify?, makesGreen?, expectFail?, size?, depends?, story?, parallel? }].",
      noText: (i) => `Tarea ${i}: el texto es obligatorio.`,
      badStory: (i, v) => `Tarea ${i}: story debe ser US<n> (p. ej., US1) o shared (recibido '${v}').`,
      badPath: (i, p) => `Tarea ${i}: las rutas de _Implements:_ deben ser relativas a la raíz del proyecto, sin '..' (recibido '${p}').`,
      badVerify: (i) => `Tarea ${i}: _Verify:_ debe ser un comando de una sola línea.`,
      placeholderVerify: (i, v) => `Tarea ${i}: '${v}' se lee como un marcador de posición, no como un comando (un _Verify:_ entre [corchetes] se ignora) — indica el comando real (para una prueba de shell, 'test …' en lugar de '[ … ]').`,
      unstorable: (i, marker) => `Tarea ${i}: su ${marker} no se leería desde tasks.md tal como se dio — deja los marcadores fuera del texto de la tarea, ',' y ';' fuera de las rutas, y '_ ' fuera de rutas y comandos.`,
      phantom: (list) => `Criterios de aceptación desconocidos (no están en requirements.md): ${list}. No se ha escrito nada — corrige los IDs o añade primero los criterios.`,
      badHeading: "el encabezado debe ser una sola línea de texto.",
      constraintsHeading: (h) => `'${h}' contiene las restricciones que respetan todas las tareas, no tareas — elige un encabezado de fase. No se ha escrito nada.`,
      inactiveHeading: (h, track) => `'${h}' es la sección de tareas del track ${track}, que está inactivo — vuelve a añadir el track o elige otro encabezado. No se ha escrito nada.`,
      unsafe: (n) => `No se pudo añadir con seguridad: ${n ? `la tarea ${n} no se leería tal como se escribió` : "las tareas existentes cambiarían"} (¿un comentario o bloque de código sin cerrar cerca del final de la fase?). No se ha escrito nada.`,
      reapprove: (slug) => `tasks.md cambió después de su aprobación — revisa las nuevas tareas y vuelve a aprobar: /approve ${slug} tasks.`,
      appended: (heading, created) => `Añadido a tasks.md → '${heading}'${created ? " (nueva fase)" : ""}:`,
      oneTaskPerCall: "append-tasks admite un --task por llamada — vuelve a ejecutarlo para la siguiente tarea (spec_append_tasks admite una lista).",
      oneValue: (flag) => `append-tasks admite --${flag} una sola vez por llamada — ${flag === "verify" ? "une las comprobaciones en un solo comando (a && b)" : "indica un único valor"}. No se ha escrito nada.`,
      badSize: (i, v) => `Tarea ${i}: size debe ser uno de XS, S, M, L, XL (recibido '${v}').`,
      badTestId: (i, v) => `Tarea ${i}: makesGreen admite IDs de pruebas planificadas (T-01, T-2 …) (recibido '${v}').`,
      phantomTests: (list) => `Pruebas desconocidas (no planificadas en test-plan.md): ${list}. No se ha escrito nada — corrige los T-IDs o planifica primero las pruebas.`,
      noTestPlan: (slug) => `makesGreen necesita un plan de pruebas: .specs/${slug}/test-plan.md no existe (añade primero +tdd). No se ha escrito nada.`,
    },

    taskDeps: {
      doctorOk: (n) => `${n} tarea(s) declaran _Depends:_ — cada una nombra una tarea activa, sin ciclos`,
      doctorFail: (list) => `${list} — corrige los marcadores _Depends:_ en tasks.md (números de tareas del mismo tasks.md: \`_Depends: 3, 5_\`)`,
      invalid: (n, tok) => `tarea ${n}: _Depends:_ '${tok}' no es un número de tarea`,
      phantom: (n, d) => `la tarea ${n} depende de la #${d}, que ninguna tarea activa tiene`,
      self: (n) => `la tarea ${n} depende de sí misma`,
      cycle: (list) => `tareas que se esperan entre sí (un ciclo): ${list}`,
      roadmapBlocked: (list) => `ninguna tarea abierta puede empezar (dependencias entre tareas): ${list}`,
      waitLine: (n, deps) => `#${n} espera a ${deps}`,
      blocked: (list, slug) => `Ninguna tarea pendiente puede empezar — cada una espera una dependencia que no está hecha: ${list}. Un ciclo o un _Depends:_ que no nombra ninguna tarea nunca se resuelve: corrige los marcadores _Depends:_ en .specs/${slug}/tasks.md (/spec-doctor ${slug} → task-deps).`,
      tickedEarly: (n, list) => `La tarea ${n} se marcó con sus dependencias ${list} aún pendientes — queda marcada como se pidió (una marca refleja lo que pasó); comprueba que no necesitaba su trabajo, o complétalas a continuación.`,
      briefHeading: "## Depende de",
      briefStatus: { done: "hecha", open: "pendiente", missing: "no existe" },
      briefOpenNote: "⚠ Algunas siguen pendientes — esta tarea se planificó para empezar después de ellas: responde NEEDS_CONTEXT si necesita su resultado.",
      badDepends: (i, v) => `Tarea ${i}: depends admite números de tarea (3 o #3) (recibido '${v}').`,
      selfDepends: (i, n) => `La tarea ${i} lleva aquí el número ${n} y dependería de sí misma. No se ha escrito nada.`,
      phantomDepends: (i, list, first, last) => `Tarea ${i}: depends no nombra ninguna tarea: ${list} — indica el número de una tarea activa, o de una tarea de esta llamada (aquí numeradas ${first === last ? first : first + "–" + last}). No se ha escrito nada.`,
      cycleDepends: (list) => `Las dependencias formarían un ciclo: ${list}. No se ha escrito nada.`,
      cliWaves: (n) => `Oleadas (${n}):`,
      cliWave: (k, list) => `  ${k}. ${list}`,
      cliNoWave: "  (ninguna tarea pendiente puede empezar)",
      cliCycles: (list) => `  ⚠ ciclo: ${list}`,
      cliBlocked: (list) => `  ⚠ bloqueadas: ${list}`,
      cliSkipped: (list) => `  en espera: ${list}`,
    },

    impact: {
      badPhase: (p, known) => `Fase '${p}' desconocida para spec_impact. Conocidas: ${known}.`,
      reopenTasks: "reopen se aplica a requirements, design, test-plan y eval-plan — un cambio en tasks.md se revisa y se vuelve a aprobar; no reabre nada.",
      retireTests: {
        retireHint: (list, slug, phase, offer) => `Pruebas eliminadas que aún ponen en verde algunas tareas — ${list}: no rehagas esas tareas; quita el T-ID de su _Makes green:_ o apúntalo a la prueba que la sustituye.` +
          (offer ? ` --reopen registra la solicitud de cambio sin desmarcarlas (dev-spec impact ${slug} --phase ${phase} --reopen).` : ""),
        retireNote: (list) => `Las pruebas eliminadas no se rehacen — aún nombradas en _Makes green:_: ${list}: quita el T-ID de esas tareas, o apúntalo a la prueba que la sustituye.`,
        recordedRetire: (n, list, slug, phase) => `Solicitud de cambio #${n} registrada — nada desmarcado: las tareas de una prueba eliminada no se rehacen. Aún nombradas en _Makes green:_: ${list}: quita el T-ID de esas tareas, o apúntalo a la prueba que la sustituye; después vuelve a aprobar: /approve ${slug} ${phase}.`,
      },
      missing: (file, slug) => `No se encontró ${file} en '${slug}' — nada que comparar.`,
      neverApproved: (phase, slug) => `'${phase}' nunca se aprobó en '${slug}' — no hay versión aprobada con la que comparar. Apruébala primero: /approve ${slug} ${phase}.`,
      fingerprintOnly: (phase, slug) => `Esta aprobación es anterior al historial de cambios: solo se registró su huella, así que no se puede listar qué cambió. Vuelve a aprobar para iniciar el historial: /approve ${slug} ${phase}.`,
      noFingerprint: (phase, slug) => `Esta aprobación es anterior a las huellas de contenido: no se registró nada de la versión aprobada, así que no se puede saber si cambió ni qué (la fecha de un fichero no es prueba — un clon o una copia la restablece). Vuelve a aprobar para empezar a seguirla: /approve ${slug} ${phase}.`,
      reopenNeedsSnapshot: (phase) => `No se ha reabierto nada: sin una instantánea de '${phase}' aprobada no se pueden determinar las tareas afectadas.`,
      nothingNew: "Nada nuevo desde la última reapertura sobre esta aprobación — no se ha cambiado nada.",
      nothingToReopen: (changed) => (changed ? "Nada que reabrir: la edición no cambió ningún criterio ni sección (solo texto fuera de ellos) — no se ha cambiado nada."
        : "Nada ha cambiado desde la aprobación — nada que reabrir."),
      designFingerprintOnly: (slug) => `design.md también ha cambiado desde la aprobación, pero esta aprobación no guardó una instantánea de él (solo su huella), así que no se puede listar qué cambió allí. Vuelve a aprobar para iniciar su historial: /approve ${slug} design.`,
      reopenDesignUnknown: "No se ha reabierto nada: design.md ha cambiado, pero sin una instantánea de él tal como se aprobó no se pueden determinar las tareas afectadas.",
      reopened: (list, slug, phase) => `Reabiertas ${list}: desmarcadas y con su evidencia marcada como obsoleta — rehazlas con evidencia nueva y vuelve a aprobar: /approve ${slug} ${phase}.`,
      retireItem: (id, tasks, tests) => `${id} → ${[tasks.length ? "tareas " + tasks.join(", ") : "", tests.length ? "pruebas " + tests.join(", ") : ""].filter(Boolean).join(" · ")}`,
      retireHint: (list, slug, phase, offer) => `Criterios eliminados aún citados — ${list}: no rehagas esas tareas; elimínalas (y las filas de prueba) o apúntalas al criterio que lo sustituye.` +
        (offer ? ` --reopen registra la solicitud de cambio sin desmarcarlas (dev-spec impact ${slug} --phase ${phase} --reopen).` : ""),
      retireNote: (list) => `Los criterios eliminados no se rehacen — aún citados: ${list}: elimina esas tareas y filas de prueba, o apúntalas al criterio que lo sustituye.`,
      recordedRetire: (n, list, slug, phase) => `Solicitud de cambio #${n} registrada — nada desmarcado: las tareas de un criterio eliminado no se rehacen. Aún citados: ${list}: elimina esas tareas y filas de prueba, o apúntalas al criterio que lo sustituye; después vuelve a aprobar: /approve ${slug} ${phase}.`,
      recordedOnly: (n, slug, phase) => `Solicitud de cambio #${n} registrada — ninguna tarea completada se ha visto afectada. Revísala y vuelve a aprobar: /approve ${slug} ${phase}.`,
      reopenHint: (slug, phase) => `Para desmarcar las tareas completadas afectadas y marcar su evidencia como obsoleta: dev-spec impact ${slug} --phase ${phase} --reopen (spec_impact {reopen: true}).`,
      nextHint: (slug, phases) => `Mira primero qué afecta la edición con spec_impact (${phases.map((p) => `dev-spec impact ${slug} --phase ${p}`).join(" · ")}).`,
      doctorChanged: (list, slug, phases) => `modificado(s) tras su aprobación: ${list} — mira qué afecta la edición con spec_impact (${phases.map((p) => `dev-spec impact ${slug} --phase ${p}`).join(" · ")}) y vuelve a aprobar`,
      doctorChangedPlain: (list, slug) => `modificado(s) tras su aprobación: ${list} — revisa y vuelve a aprobar (/approve ${slug} <fase>)`,
      staleNote: (n, slug, runnable) => `Tarea ${n}: su evidencia es anterior a un cambio de la spec (spec_impact la reabrió) — sigue sin verificar hasta que se registre ` +
        (runnable ? `una nueva ejecución correcta: dev-spec done ${slug} ${n} --run` : "evidencia nueva."),
      head: (slug, phase, date, snap) => `Impacto: ${slug} · ${phase} — frente a la aprobación del ${date} (${snap})`,
      headFp: (slug, phase, changed) => `Impacto: ${slug} · ${phase} — solo huella: ${changed ? "modificado desde la aprobación" : "sin cambios desde la aprobación"}`,
      headNone: (slug, phase, changed) => `Impacto: ${slug} · ${phase} — sin huella registrada: ${changed ? "modificado desde la aprobación (un fichero creado después)" : "no se puede saber si cambió"}`,
      noChanges: "sin cambios desde la aprobación",
      noStructural: "editado, pero ningún criterio, sección o tarea cambió (solo texto fuera de ellos)",
      affected: "Afectado:",
      tasksLabel: "tareas",
      testsLabel: "pruebas",
      designLabel: "diseño",
      idsLabel: "IDs",
      none: "ninguno",
      change: { added: "añadido", modified: "modificado", removed: "eliminado" },
      verified: "verificada",
      nothingToVerify: "nada que verificar (sin comando _Verify:_, nada registrado)",
      staleSpec: "la spec cambió desde esta evidencia; spec_impact reabrió la tarea",
      uncovered: (list) => `nuevos, aún sin una tarea que los cite: ${list}`,
      reReview: (slug, phase, roles) => `revisa el cambio y vuelve a aprobar: /approve ${slug} ${phase}` + (roles && roles.length ? ` --role ${roles[0]} (cada rol valida el nuevo contenido: ${roles.join(", ")})` : ""),
    },
    metrics: {
      writeNeedsName: "write necesita el nombre de una función — la retrospectiva es por función (spec_metrics {name, write: true} / dev-spec metrics <función> --write).",
      retroWritten: (p) => `Retrospectiva → ${p} (rellenada con las métricas — el resto te toca a ti).`,
      retroExists: (p) => `${p} ya existe — no se ha modificado (una retrospectiva nunca se sobrescribe).`,
      unknown: "desconocida",
      source: { approval: "aproximada: a partir de la primera aprobación", filesystem: "aproximada: a partir de la fecha de la carpeta" },
      phase: { classification: "clasificación", requirements: "requisitos", design: "diseño", "test-plan": "plan de pruebas", "eval-plan": "plan de evals", tests: "pruebas", tasks: "tareas", execution: "ejecución", complete: "completada", finished: "cerrada" },
      head: (slug, tracks, created, approx) => `Métricas: ${slug} [${tracks}] — creada el ${created}${approx ? ` (${approx})` : ""}`,
      leadTimes: (list) => `  tiempo desde la creación: ${list}`,
      noLeadTimes: "  tiempo desde la creación: aún no hay nada aprobado",
      rework: (total, n, list, forced) => `  aprobaciones: ${total} · retrabajo: ${n}${list ? ` (${list})` : ""} · forzadas: ${forced}`,
      reworkUnknown: (forced) => `  retrabajo: desconocido (aprobaciones anteriores al historial de cambios) · forzadas: ${forced}`,
      reworkPartial: (total, n, list, forced, legacy) => `  aprobaciones: ${total} · retrabajo: al menos ${n}${list ? ` (${list})` : ""} · forzadas: ${forced} — retrabajo desconocido en ${legacy} (aprobaciones anteriores al historial de cambios)`,
      changes: (n, reopened) => `  solicitudes de cambio: ${n} · tareas reabiertas: ${reopened}`,
      evidence: (rate, pass, runs) => `  evidencia: ${rate}% de ejecuciones correctas (${pass}/${runs})`,
      noRuns: "  evidencia: ninguna ejecución registrada",
      tasks: (done, total, clar) => `  tareas: ${done}/${total} · marcadores de aclaración abiertos: ${clar}`,
      noFeatures: (dir) => `Aún no hay funciones en ${dir}`,
      projectHead: (n) => `Métricas — ${n} función(es)`,
      row: (created, complete, rework, forced, changes, pass, tasks) => [created ? `creada ${created}` : null, `completada ${complete}`, `retrabajo ${rework}`,
        `forzadas ${forced}`, `cambios ${changes}`, `correctas ${pass}`, tasks ? `tareas ${tasks}` : null].filter(Boolean).join(" · "),
      avg: "media",
      median: "mediana",
      medianLeads: (list) => `  mediana del tiempo desde la creación: ${list}`,
      totals: (done, total, pass, runs, changes, reopened) => `  total: tareas ${done}/${total} · ${runs ? `evidencia ${pass} de ${runs} ejecución(es) correctas` : "ninguna ejecución registrada"} · solicitudes de cambio ${changes} · tareas reabiertas ${reopened}`,
      retroText: {
        title: (f) => `# Retrospectiva: ${f}`,
        intro: (date) => `> Generada por dev-spec el ${date} a partir de .state.json, .history/ y los artefactos. Los números se calculan localmente; el resto te toca a ti. Nada de esto se aplica automáticamente.`,
        metrics: "## Métricas",
        header: "| Métrica | Valor |",
        created: "Creada",
        approximate: "aproximado",
        unknown: "desconocida",
        lead: (ph) => `Tiempo hasta ${ph}`,
        rework: "Retrabajo (nuevas aprobaciones)",
        reworkUnknown: "desconocido — las aprobaciones son anteriores al historial de cambios",
        reworkPartial: (value, legacy) => `al menos ${value} — desconocido en ${legacy} (aprobaciones anteriores al historial de cambios)`,
        forced: "Aprobaciones forzadas",
        changes: "Solicitudes de cambio",
        reopened: (n) => `${n} tarea(s) reabierta(s)`,
        passRate: "Tasa de éxito de la evidencia",
        runs: (rate, pass, runs) => `${rate}% (${pass}/${runs} ejecuciones)`,
        noRuns: "ninguna ejecución registrada",
        tasks: "Tareas",
        tasksValue: (done, total) => `${done}/${total} hechas`,
        clar: "Marcadores de aclaración abiertos",
        well: "## Qué salió bien",
        hurt: "## Qué costó",
        signals: (list) => `<!-- Señales de las métricas: ${list}. -->`,
        sigRework: (ph, n) => `'${ph}' aprobada ${n} vez/veces`,
        sigForced: (n) => `${n} aprobación(es) forzada(s) con comprobaciones fallidas`,
        sigReopened: (n) => `${n} tarea(s) reabierta(s) por solicitudes de cambio`,
        sigPass: (rate) => `solo el ${rate}% de las ejecuciones de verificación pasaron`,
        sigClar: (n) => `${n} marcador(es) de aclaración aún abiertos`,
        amend: "## Cambios propuestos al steering o a la constitución",
        amendNote: "<!-- Para aprobación humana — nunca se aplican automáticamente. Indica el archivo (.specs/steering/constitution.md, tech.md, …), el cambio exacto y por qué. -->",
        followUps: "## Seguimiento",
        followUpsNote: "<!-- Candidatos al backlog — añade los que aceptes con spec_backlog (dev-spec backlog add \"<nombre>\" \"<nota>\"). -->",
      },
      retro: (m, fmt) => MSG.en.metrics.buildRetro(MSG.es.metrics.retroText, MSG.es.metrics.phase, m, fmt),
    },

    deepTrace: {
      kinds: {
        uncoveredEdgeCases: "casos límite (EC) sin tarea ni prueba que los cubra",
        uncoveredNfr: "requisitos no funcionales (NFR) sin tarea ni prueba que los cubra",
        uncoveredSuccessCriteria: "criterios de éxito (SC) sin prueba ni paso del quickstart que los verifique",
        phantomSecondary: "las tareas / el plan de pruebas citan IDs EC/NFR/SC desconocidos (¿erratas?)",
        plannedNotInCode: "pruebas planificadas que ningún fichero de prueba nombra (pon el T-ID en el nombre de la prueba)",
        inCodeNotInPlan: "T-IDs en el código de prueba que ningún plan de pruebas incluye",
        unresolvedImplGlobs: "globs de _Implements:_ no resueltos del todo (el recorrido de ficheros se detuvo en su límite antes de una coincidencia — no cuentan como ausentes)",
      },
      secondaryOk: (n) => `los ${n} IDs EC/NFR/SC cubiertos`,
      testsInCodeOk: (n) => `cada T-ID planificado que una tarea hecha pone en verde aparece en un fichero de prueba (${n})`,
      testsInCodeMissing: (list) => `puestos en verde por tareas hechas, pero ningún fichero de prueba los nombra: ${list} — pon el T-ID en el nombre de una prueba (test("T-01 …"), def test_T01_…) en un fichero de prueba (una carpeta tests/, *.test.*, *_test.* …), en el archivo que indica la columna Archivo (o Fichero) del plan, si indica uno; una comprobación hecha fuera del código de prueba (un script de carga, un conjunto de evals) indica en su lugar su artefacto no código en la columna Archivo (load-test.md, evals/golden.json) y no se espera en un fichero de prueba`,
      truncated: "la búsqueda de ficheros de prueba se detuvo en el límite — algunos ficheros no se leyeron",
      codeSummary: (found, planned, scanned, truncated, outside) => `  pruebas en el código: ${found}/${planned} T-ID(s) planificado(s) nombrado(s) en ${scanned} fichero(s) de prueba` + (outside ? ` · comprobados fuera del código de prueba (la columna Archivo indica un artefacto que no es código): ${outside}` : "") + (truncated ? " (búsqueda truncada en el límite)" : ""),
      warningsHead: "Avisos (no bloquean):",
    },

    catalog: {
      title: (proj) => `Catálogo de specs — ${proj}`,
      autogen: "AUTO-GENERADO por dev-spec — no editar a mano. Para regenerar: spec_catalog {write: true} (dev-spec catalog --write).",
      intro: "Lo que el sistema hace hoy: todos los criterios de aceptación, agrupados por función. Un criterio sustituido por una función posterior ya entregada (_Supersedes:_) aparece tachado e indica el criterio que lo sustituye; uno que una función aún en curso prevé sustituir aparece como \"por sustituir\" y sigue vigente.",
      totals: (f, acs, current, sup, pending) => `**${f} función(es) · ${acs} criterios de aceptación — ${current} vigentes${pending ? ` (${pending} por sustituir)` : ""}, ${sup} sustituido(s)**`,
      status: { active: "en curso", complete: "completada", finished: "cerrada", archived: "archivada" },
      finishedOn: (d) => `cerrada el ${d}`,
      archivedOn: (d) => `archivada el ${d}`,
      supersededBy: (list) => `sustituido por ${list}`,
      toBeSupersededBy: (list) => `se sustituirá por ${list} (aún no entregada)`,
      supersedes: (list) => `sustituye a ${list}`,
      template: "plantilla — aún sin escribir",
      noAcs: "Aún sin criterios de aceptación.",
      noFeatures: "Aún sin funciones.",
      cliWrote: (file, f, acs, sup) => `✎ generado ${file}  (${f} función(es), ${acs} criterio(s), ${sup} sustituido(s))`,
    },
    supersedes: {
      phantom: (ref, reason, by) => `_Supersedes:_ ${ref}${by ? ` (en ${by})` : ""} — ${reason}`,
      renamed: (list) => `las referencias _Supersedes:_ a ella usan ahora el nombre nuevo, en: ${list}`,
      reason: { "bad-ref": "no tiene el formato <función>/US-n.AC-m", "unknown-feature": "esa función no existe (activa o archivada)", "unknown-ac": "esa función no tiene ese criterio", self: "una función no puede sustituir un criterio propio", unterminated: "el marcador nunca se cierra — termínalo con un guion bajo: _Supersedes: <función>/US-n.AC-m_" },
    },
    restore: {
      notArchived: (slug) => `No hay nada archivado como '${slug}' (.specs/_archive/${slug}/ no existe).`,
      activeExists: (slug) => `'${slug}' ya es una función activa — renómbrala o archívala antes de restaurar la archivada.`,
      done: (slug) => `'${slug}' restaurada desde .specs/_archive/ ✓`,
      noRecord: "Se archivó antes de que el archivado registrara su entrada en la hoja de ruta — vuelve a declarar sus dependencias con spec_depend, si las tenía.",
      skipDependsOn: (d, reason) => `su dependencia '${d}' (${reason})`,
      skipDependent: (k, reason) => `'${k}', que dependía de ella (${reason})`,
      skipRecord: (field, reason) => `el campo ${field} del registro de archivado (${reason})`,
      skipped: (list) => `No restaurado: ${list}.`,
      reason: { gone: "ya no existe", archived: "también archivada — restaurarla repone el vínculo", cycle: "cerraría un ciclo de dependencias", invalid: "formato inesperado — se omite" },
      renamedRecords: (list) => `registros de archivo actualizados al nombre nuevo (restore repone sus dependencias): ${list}`,
      prunedDependents: (list) => `las dependencias de las funciones que dependían de ella salieron de la hoja de ruta: ${list} (registrado — restore las repone)`,
      prunedIncomplete: (slug, pct, list) => `'${slug}' no estaba completa (${pct}%), pero ${list} dependía(n) de ella: la hoja de ruta deja de mostrarla(s) bloqueada(s) por ella — restáurala, o vuelve a declarar la dependencia con spec_depend, si aún necesita(n) ese trabajo`,
    },
    drift: {
      none: "Ninguna función cerrada tiene todavía una línea base de drift — spec_finish {write: true} (dev-spec finish <función> --write) registra una cuando la función está lista para cerrar.",
      clean: (f, n, d, archived) => `  ✓ ${f}${archived ? " (archivada)" : ""}: ${n} fichero(s) de implementación sin cambios desde el cierre (${d})`,
      drifted: (f, n, total, d, archived) => `  ⚠ ${f}${archived ? " (archivada)" : ""}: ${n} de ${total} fichero(s) de implementación modificado(s) desde el cierre (${d})`,
      changed: (list) => `      modificados: ${list}`,
      missing: (list) => `      ausentes: ${list}`,
      nowPresent: (list) => `      ahora presentes (ausentes en el cierre): ${list}`,
      reopened: (list) => `  · reabiertas después del cierre (hay tareas pendientes — se comprueban al volver a cerrar): ${list}`,
      unbaselined: (list) => `  · aún sin línea base de cierre: ${list}`,
      stale: (f, d, why, archived) => `  ↻ ${f}${archived ? " (archivada)" : ""}: cambió desde el cierre (${d}) — ${why}; su línea base ya no la cubre: ${archived ? `restáurala (dev-spec feature restore ${f}), ciérrala de nuevo (dev-spec finish ${f} --write) y vuelve a archivarla` : `ciérrala de nuevo (dev-spec finish ${f} --write)`}`,
      staleWhy: {
        changeRequests: (list) => `solicitud de cambio ${list}`,
        approvals: (list) => `reaprobado: ${list}`,
        newFiles: (n, list) => `${n} fichero(s) de implementación fuera de la línea base: ${list}`,
      },
      hookLine: (f, n) => `  ⚠ ${f}: ${n} fichero(s) de implementación modificado(s) desde el cierre — ejecuta dev-spec drift ${f}`,
      baselineRecorded: (n, missing) => `Línea base de drift registrada: ${n} fichero(s) de implementación${missing ? ` (${missing} ausente(s))` : ""} — dev-spec drift muestra lo que cambie después de este cierre.`,
      baselineReplaced: (n, day, list) => `Sustituida la línea base del ${day}, en la que ${n} fichero(s) habían cambiado: ${list} — la nueva línea base los acepta tal como están ahora.`,
    },

    guardMode: {
      ask: (pending, stale) => "dev-spec guard: ninguna tarea aprobada cubre cambios de código ahora mismo — aprueba las tareas de una función (spec_approve) o confirma para continuar." +
        (pending ? ` Funciones con tareas pendientes de aprobación: ${pending}.` : "") +
        (stale ? ` Tareas modificadas después de su aprobación (revísalas y vuelve a aprobar la fase tasks): ${stale}.` : "") + " (El modo guardia está activado — dev-spec init --guard off lo desactiva.)",
      forced: (list) => `dev-spec guard: los cambios de código solo están cubiertos por una aprobación FORZADA de las tareas (${list}) — sus comprobaciones fallaban cuando se aprobó.`,
      on: "Modo guardia ACTIVADO — Write/Edit en ficheros de código fuera de .specs/ pide confirmación mientras ninguna función tenga tareas aprobadas sin terminar (roadmap.json meta.guard). Los ficheros de prueba se permiten mientras el plan de pruebas de una función sin terminar esté aprobado (la Fase 4 escribe las pruebas que fallan antes del gate de las tareas), y todo fichero de código mientras un spike esté en curso (su prototipo).",
      off: "Modo guardia DESACTIVADO — los cambios de código no se controlan.",
      badValue: (v) => `--guard admite on, off o scope (recibido '${v}').`,
    },
    approvalGuard: {
      on: {
        ask: "Guardia de aprobaciones ASK — una aprobación hecha por un agente (spec_approve / dev-spec approve, la eliminación de una función, bajar esta guardia) te pide confirmación antes (roadmap.json meta.approvalGuard). En los modos de permiso auto / bypass de Claude Code la solicitud de permiso puede no aparecer — 'deny' se mantiene en todos los modos.",
        deny: "Guardia de aprobaciones DENY — una aprobación hecha por un agente (spec_approve / dev-spec approve, la eliminación de una función, bajar esta guardia) se rechaza: apruebas tú, en tu propio terminal o en Claude Code con el prefijo ! (roadmap.json meta.approvalGuard).",
      },
      off: "Guardia de aprobaciones DESACTIVADA — las aprobaciones que pide un agente no se controlan (roadmap.json meta.approvalGuard).",
      badValue: (v) => `--approval-guard admite off, ask o deny (recibido '${v}').`,
      action: (a) => {
        const f = a.feature || "?";
        if (a.kind === "remove") return `borrar definitivamente la función '${f}' (su carpeta en .specs/, sus aprobaciones y su historial)`;
        if (a.kind === "guard-down") {
          if (a.setting === "evidence") return "volver a poner el modo de evidencia (meta.evidence) en reported";
          if (a.setting === "stopCheck") return "desactivar el gate de evidencia al final del turno (meta.stopCheck)";
          if (a.setting === "guard") return a.from ? `bajar el modo guardia (meta.guard) de ${a.from} a ${a.to}` : `poner el modo guardia (meta.guard) en ${a.to}`;
          if (a.setting === "roles") {
            if (!a.to || !Object.keys(a.to).length) return "eliminar los roles de aprobación (meta.approvalRoles)";
            return Array.isArray(a.removed) ? `quitar roles de aprobación exigidos (${a.removed.join(", ")}) de meta.approvalRoles` : "sustituir los roles de aprobación (meta.approvalRoles)";
          }
          if (a.setting === "check") return a.to == null ? `eliminar la verificación del proyecto '${a.name}' (meta.checks)` : `cambiar el comando de la verificación del proyecto '${a.name}' (meta.checks)`;
          if (a.setting === "roadmap") return "cambiar .specs/roadmap.json desde la shell — escribirlo, moverlo o borrarlo (ahí están la guardia de aprobaciones y los gates del proyecto)";
          return `bajar la guardia de aprobaciones de ${a.from} a ${a.to}`;
        }
        if (a.revoke) return `revocar la aprobación de la fase ${a.phase || "?"} de '${f}'` + (a.role ? ` como ${a.role}` : "") + (a.by ? ` en nombre de '${a.by}'` : "");
        return (a.through ? `aprobar todas las fases de '${f}' hasta ${a.through}` : `aprobar la fase ${a.phase || "?"} de '${f}'`) +
          (a.role ? ` como ${a.role}` : "") + (a.by ? ` en nombre de '${a.by}'` : "") +
          (a.force ? " — FORZADA (--force)" : "");
      },
      ask: (list, force) => `dev-spec approval guard: el agente quiere ${list}.` + (force ? " ⚠ FORCE: se saltan las comprobaciones de la fase — un gate que falla quedaría registrado como aprobado igualmente." : "") +
        " Las aprobaciones te corresponden — permítelo solo si lo apruebas tú. (meta.approvalGuard: ask — dev-spec init --approval-guard deny rechaza sin más las aprobaciones de los agentes.)",
      deny: (list, command) => `dev-spec approval guard: rechazado — las aprobaciones son de la persona, y un agente no puede ${list}. ` +
        (command ? `Detente y pide al usuario que lo ejecute él mismo, en su propio terminal o en Claude Code con el prefijo ! (se ejecuta como el usuario, no como tu llamada de herramienta): ${command}` : "Detente y pide al usuario que haga él mismo ese cambio, en su propio editor o terminal") +
        " — y espéralo. No lo reintentes por otra vía (la herramienta MCP, la CLI, un script o una edición de los ficheros de .specs/). (meta.approvalGuard: deny.)",
      denyUser: (list, command) => `dev-spec approval guard rechazó la petición de un agente de ${list}.` + (command ? ` Para aprobarlo tú: ${command}` : " Si lo quieres, haz tú ese cambio."),
    },
    scopedSteering: {
      customHint: "— o un fichero de steering propio, con alcance: letras minúsculas, dígitos y '-', terminado en .md (p. ej. api-conventions.md).",
      reservedName: (file) => `'${file}' es un nombre reservado (un nombre de dispositivo de Windows o un miembro nativo de JavaScript) — elige otro nombre para el fichero de steering.`,
      customStub: (title, pattern) => `---\ninclusion: fileMatch\nfileMatchPattern: "${pattern}"\n---\n\n# ${title}\n\n` +
        "<!-- Steering con alcance. El front matter decide cuándo spec_task_brief incluye este fichero:\n" +
        "     inclusion: always    → en todos los briefs de tarea\n" +
        "     inclusion: fileMatch → solo en las tareas cuyas rutas _Implements:_ coinciden con fileMatchPattern\n" +
        "                            (glob: ** · * · ? · {a,b}; admite una lista: [\"src/api/**\", \"src/routes/**\"])\n" +
        "     inclusion: manual    → nunca automáticamente; los briefs lo listan como disponible bajo petición\n" +
        "     Sustituye el patrón de ejemplo y las líneas entre corchetes de abajo. -->\n\n" +
        "## Reglas\n- [Una regla que todo fichero que coincida con el patrón debe seguir.]\n\n## Ejemplos\n- [Un ejemplo breve — o una referencia a un fichero que muestre el patrón.]\n",
      placeholders: (list) => `aún con placeholders de la plantilla: ${list}`,
      scoped: "Steering con alcance (fileMatch — coincide con los ficheros de esta tarea):",
      manual: "Disponible bajo petición (steering manual):",
    },
    designSaveCheck: {
      head: (slug, tracks) => `Verificación del diseño en design.md (${slug} [${tracks}]):`,
      clean: (tracks, constitution) => `Verificación del diseño [${tracks}]: secciones obligatorias${constitution ? " y Verificación de la Constitución" : ""} rellenadas, sin placeholders de la plantilla ✓`,
      sections: (marker, list) => `secciones ${marker}: ${list}`,
      constitution: {
        missing: "Verificación de la Constitución: falta — añade la sección y verifica cada principio de steering/constitution.md",
        unfilled: "Verificación de la Constitución: sin rellenar",
      },
      placeholders: (n, list) => `${n} placeholder(s) de la plantilla por sustituir: ${list}`,
      hint: (slug) => `Rellénalos antes de aprobar el diseño — detalles: /spec-doctor ${slug}.`,
    },
    upgrade: {
      head: (from, to, mode) => mode === "unknown" ? "dev-spec upgrade — la versión de este motor es desconocida (no hay package.json a su lado): no se sellará nada."
        : mode === "behind" ? `dev-spec upgrade — .specs/ ${from ? `en la ${from}` : "de antes de la 1.13 (sin sello de versión)"} → dev-spec ${to}`
        : mode === "pending" ? `dev-spec upgrade — .specs/ en la ${from} (este dev-spec: ${to}), pero aún hay migraciones pendientes`
        : `dev-spec upgrade — .specs/ en la ${from}: al día con este dev-spec (${to})`,
      newer: (from, to) => `.specs/ lo actualizó por última vez un dev-spec más reciente (${from}) que este (${to}) — actualiza el plugin antes de fiarte de esta auditoría.`,
      summary: (n, blocked, attention, ok, archived) => `${n} función(es) activa(s): ${blocked} bloqueada(s) · ${attention} necesita(n) atención · ${ok} ok` + (archived ? ` · ${archived} archivada(s) (no revisada(s))` : ""),
      noFeatures: "No hay funciones activas — nada que revisar.",
      group: { blocked: "⛔ Bloqueadas — el doctor falla:", attention: "▲ Necesitan atención:", ok: "✓ OK:" },
      status: { "not-started": "sin empezar", planning: "en planificación", executing: "en ejecución", complete: "completada", finished: "cerrada" },
      feature: (name, status, tracks, phase, done, total, bugfix) => `${name} — ${status} · [${tracks}] · ${phase} · ${done}/${total} tareas${bugfix ? " · bugfix" : ""}`,
      tracksInferred: "sus tracks se dedujeron de los ficheros — el apply los guarda en .state.json",
      item: {
        error: (e) => `Corrígelo primero a mano: ${e}`,
        fix: (list) => `Corrige lo que el doctor da como fallo: ${list}`,
        approve: (list, slug) => `Aprueba el/los gate(s) pendiente(s), por orden: ${list} — /approve ${slug} <fase>`,
        reReview: (list, cmds) => `Revisa lo que cambió después de su aprobación: ${list}` + (cmds ? ` — mira primero la diferencia: ${cmds}` : "") + "; después vuelve a aprobar",
        reapprove: (list) => `Vuelve a aprobar para empezar el historial de cambios (spec_impact aún no puede comparar estas): ${list}`,
        verify: (list, slug) => `Registra una ejecución correcta de las tareas marcadas que no la tienen: ${list} — dev-spec done ${slug} <n> --run`,
        drift: (n, slug) => `Decide sobre la deriva: ${n} fichero(s) de implementación cambiado(s) desde el cierre — dev-spec drift ${slug}`,
        stale: (slug) => `Cambió después del cierre — ciérrala de nuevo: /spec-finish ${slug}`,
        critic: (files) => `Revísala con el agente spec-critic (solo lectura), fase a fase: ${files || "—"}`,
        converge: (files) => "Ejecuta la pasada de convergencia del spec-reviewer (las tareas hechas frente a sus ACs)" + (files ? `, después el agente spec-critic sobre ${files}` : ""),
        none: "No necesita revisión de la spec — todas las tareas están hechas",
        next: (rec) => `Siguiente: ${rec}`,
        warnings: (list) => `Avisos: ${list}`,
      },
      reason: { "no-fingerprint": "aprobada antes de las huellas de contenido", changed: "cambiada después de su aprobación", missing: "su fichero no existe", untracked: "una aprobación de diseño de bugfix de la 1.12 — bug.md nunca se siguió", "snapshot-missing": "el fichero de su snapshot ha desaparecido" },
      planHead: "El apply cambiaría (spec_upgrade {apply: true} · dev-spec upgrade --apply) — nunca un artefacto, una aprobación ni una marca:",
      migHead: "Migraciones aplicadas — ningún artefacto editado, nada aprobado, marcado ni borrado:",
      migStamp: (from, to) => `meta.specVersion: ${from || "ninguna"} → ${to}`,
      migTracks: (list) => `tracks guardados en .state.json: ${list}`,
      migSeeded: (list) => `líneas base de aprobación guardadas: ${list}`,
      planSeed: (list) => `líneas base de aprobación a guardar en .history/ (el fichero aún coincide con su aprobación): ${list}`,
      migRecords: (n) => `${n} aprobación(es) anterior(es) registrada(s) en approvalHistory`,
      migSkipped: (list) => `sin línea base — vuelve a aprobar para empezar el historial: ${list}`,
      migGitignore: (n) => `.specs/.gitignore: ${n} línea(s) añadida(s)`,
      migErrors: (list) => `no migrado: ${list} — corrígelo y vuelve a ejecutar el upgrade (meta.specVersion se queda como está hasta entonces)`,
      nothing: "Nada que migrar — .specs/ ya está al día; no se ha cambiado nada.",
      upToDate: "Nada que migrar — la lista de arriba es lo que señalan las reglas actuales.",
      applyHint: "No se ha cambiado nada. Revisa la lista y después aplica las migraciones seguras: dev-spec upgrade --apply (spec_upgrade {apply: true}).",
      reportAt: (file) => `Informe: ${file} — una lista de comprobación para ir cumpliendo (/spec-upgrade).`,
      reportKept: (file) => `${file} existe y no lo generó dev-spec — se ha dejado intacto (informe no escrito).`,
      hookLine: (from) => `⬆ .specs/ se creó con un dev-spec más antiguo (${from || "anterior a la 1.13"}) — ejecuta /spec-upgrade (dev-spec upgrade) para revisar lo que aún no está implementado (o pide simplemente actualizar las specs)`,
      md: {
        title: (proj) => `dev-spec upgrade — ${proj}`,
        autogen: "AUTO-GENERADO por dev-spec — marca las casillas a medida que avanzas; spec_upgrade {apply: true} (dev-spec upgrade --apply) lo escribe cuando migra algo.",
        intro: (from, to) => `.specs/ actualizado de ${from || "un dev-spec anterior a la 1.13"} a ${to || "?"}. Por función: lo que señalan las reglas de la ${to || "?"}, qué hacer y qué revisión ejecutar. Trabájalo con /spec-upgrade (Claude Code) o dev-spec upgrade; vuelve a ejecutar la auditoría cuando quieras para ver el estado actual.`,
        migrations: "Migraciones",
        group: { blocked: "⛔ Bloqueadas — el doctor falla", attention: "▲ Necesitan atención", ok: "✓ OK" },
        footer: "Todo cambio pasa por los gates normales: nuevas aprobaciones con spec_approve (/approve), ediciones de la spec tras una aprobación con spec_impact (/spec-impact), trabajo de seguimiento con spec_append_tasks (/spec-converge). Nada de esto se aplica automáticamente.",
      },
    },

    promptsResources: {
      preamble: (agentsMd, refsDir) => `Nota para el agente: si no hay una skill dev-spec-driven disponible en esta herramienta, sigue el flujo del AGENTS.md del plugin (${agentsMd}) y usa las herramientas MCP spec-driven (spec_*, ears_validate, trace_check); los archivos references/… citados abajo están en ${refsDir}.`,
      argDesc: (hint) => (hint ? `Argumentos (opcionales): ${hint}` : "No necesita argumentos (texto libre opcional)."),
      cliHead: (n) => `${n} prompt(s) — uno por comando del plugin; dev-spec prompts <nombre> [--args "…"] muestra uno:`,
      res: {
        roadmap: "La hoja de ruta del proyecto (.specs/ROADMAP.md): la fase, el progreso y las dependencias de cada función.",
        roadmapFromJson: "La hoja de ruta del proyecto, generada a partir de .specs/roadmap.json (aún sin ROADMAP.md escrito).",
        catalog: "El catálogo vivo (.specs/SPECS.md): todas las funciones y criterios de aceptación, con los sustituidos marcados.",
        steering: (file) => `Archivo de steering .specs/steering/${file} — reglas del proyecto que siguen todas las funciones.`,
        artifact: (slug, label, file) => `${label} de la función '${slug}' (.specs/${slug}/${file}).`,
        labels: {
          "classification.md": "Clasificación (tracks)", "requirements.md": "Requisitos (EARS)", "design.md": "Diseño técnico", "test-plan.md": "Plan de pruebas",
          "eval-plan.md": "Plan de evals", "load-test.md": "Plan de pruebas de carga", "tasks.md": "Tareas", "bug.md": "Informe del bug (reproducción · causa raíz · corrección)",
          "quickstart.md": "Guía rápida", "checklist.md": "Lista de comprobación", "integration-plan.md": "Plan de integración", "retro.md": "Retrospectiva",
          "spike.md": "Spike (pregunta · evidencia · decisión)", "decisions.md": "Registro de decisiones", // 1.14 C2
        },
        tplFeature: (list) => `Un artefacto de la spec de una función: .specs/{slug}/{artifact} — {artifact} es uno de ${list}.`,
        tplSteering: "Un archivo de steering: .specs/steering/{file} (un archivo .md).",
        truncated: (cap, total) => `Lista de recursos limitada a ${cap} de ${total} — lee los demás mediante las plantillas specs://feature/{slug}/{artifact} y specs://steering/{file}.`,
      },
      err: {
        noPromptName: "prompts/get necesita el `name` del prompt (una cadena).",
        badPromptArgs: 'prompts/get: `arguments` debe ser un objeto de cadenas, p. ej. {"args": "login"}.',
        unknownPrompt: (name, list) => `Prompt desconocido '${name}' — uno de: ${list}.`,
        noUri: "resources/read necesita el `uri` del recurso (una cadena).",
        badUri: (uri) => `URI de recurso no válido '${uri}' — se esperaba specs://roadmap, specs://catalog, specs://steering/<archivo>.md o specs://feature/<slug>/<artefacto> (sin '..', sin ruta absoluta, sin otro esquema).`,
        unknownArtifact: (a, list) => `Artefacto desconocido '${a}' — uno de: ${list}.`,
        badSteering: (file) => `Nombre de archivo de steering no válido '${file}' — un archivo .md directamente en .specs/steering/.`,
        notFound: (uri, detail) => `Recurso no encontrado: ${uri}` + (detail ? ` — ${detail}` : ""),
      },
    },

    // 1.16 C — integración con Claude Code (status line, puente del plan mode, spec_import {text}, completion/complete).
    claudeCode: {
      statusLine: {
        head: (slug, kind) => `◆ ${slug}` + (kind === "bugfix" ? " (bugfix)" : kind === "spike" ? " (spike)" : ""),
        tasks: (done, total) => `${done}/${total} tareas`,
        unverified: (n) => `${n} sin verificar`,
        next: (step) => `siguiente: ${step}`,
        none: "◆ dev-spec · aún no hay funciones — /spec",
        steps: {
          "re-review": (s) => `revisar ${s.files.join(", ")}`,
          fill: (s) => `completar ${s.file}`,
          fix: (s) => (s.file === "bug.md" ? "escribir la causa raíz en bug.md" : `corregir el gate ${s.phase}`),
          approve: (s) => `aprobar ${s.phase}`,
          tests: () => "escribir los tests y luego aprobarlos (Fase 4)",
          tasks: () => "dividir en tareas",
          implement: (s) => `tarea ${s.task}`,
          blocked: () => "desbloquear las tareas (_Depends:_)",
          verify: (s) => (s.suite ? `ejecutar las comprobaciones del proyecto (${s.suite.join(", ")})` : `verificar la tarea ${s.task}`),
          decide: (s) => (s.outcome ? "añadir la línea _Outcome:_ a la decisión" : "escribir la decisión"),
          promote: () => "go — crear la spec de la función, archivar el spike",
          archive: () => "no-go — archivar el spike",
          pivot: () => "pivot — empezar un spike nuevo",
          finish: (s) => (s.again ? "/spec-finish de nuevo" : "/spec-finish"),
          "sign-off": (s) => (s.again ? "aprobar execution de nuevo (sign-off)" : "aprobar execution (sign-off)"),
          finished: () => "terminada",
        },
        config: {
          head: "Status line — añade esto a ~/.claude/settings.json (todos los proyectos) o al .claude/settings.local.json de un proyecto (solo en esta máquina — la ruta es de esta máquina, así que nunca en el .claude/settings.json versionado):",
          after: "Muestra una línea — la función más activa, sus tareas, las tareas sin verificar y el siguiente paso — y nada fuera de un proyecto dev-spec.",
          cacheNote: "Esta ruta es una copia con versión en la caché de plugins de Claude Code (…/plugins/cache/…): tras actualizar el plugin, vuelve a ejecutar /spec-statusline — la copia antigua se borra 14 días después de una actualización.",
          tryIt: (cmd) => `Pruébalo: echo '{"cwd": "<tu proyecto>"}' | ${cmd}`,
        },
      },
      planBridge: {
        byText: "dev-spec: el usuario aprobó este plan. Para seguirlo como spec (criterios EARS, tareas trazadas, gates de evidencia), propón /spec-import — spec_import {tool: \"plan\", text: <el markdown del plan aprobado>} (CLI: dev-spec import plan - < plan.md). El fichero del plan en ~/.claude/plans está fuera del proyecto, así que pasa su texto. Para un cambio rápido, omítelo; importa solo con el OK del usuario.",
        byPath: (rel) => `dev-spec: el usuario aprobó este plan. Para seguirlo como spec (criterios EARS, tareas trazadas, gates de evidencia), propón /spec-import — spec_import {tool: "plan", path: "${rel}"} (CLI: dev-spec import plan ${rel}). Para un cambio rápido, omítelo; importa solo con el OK del usuario.`,
      },
      importText: {
        label: "(texto)",
        note: (tool, date) => `> Importado de ${tool} (texto) el ${date}.`,
        orText: "O pasa su markdown como `text` en lugar de `path` (spec_import {tool, text}; CLI: dev-spec import <tool> - < fichero.md).",
        textOnly: (tool, list) => `\`text\` importa un único documento — herramienta ${list}; '${tool}' lee una carpeta: indica su \`path\`.`,
        pathAndText: "Indica `path` o `text`, no ambos.",
        empty: (tool) => `El texto ${tool} está vacío — nada que importar.`,
      },
      completion: {
        badRequest: 'completion/complete necesita `ref` ({type: "ref/prompt", name} o {type: "ref/resource", uri}) y `argument` {name, value} (texto).',
        promptsOff: "Este servidor no sirve prompts (SPEC_MCP_PROMPTS=off) — nada que completar.",
        unknownTemplate: (uri, list) => `Plantilla de recurso desconocida '${uri}' — una de: ${list}.`,
        unknownArgument: (name, list) => `Argumento desconocido '${name}' — uno de: ${list}.`,
      },
    },

    secPrivacy: {
      sectionNames: {
        "Threat Model": "Modelo de Amenazas", "Security Requirements": "Requisitos de Seguridad", "Authentication & Authorization": "Autenticación y Autorización",
        "Secrets & Key Management": "Gestión de Secretos y Claves", "Security Testing": "Pruebas de Seguridad",
        "Personal Data Inventory": "Inventario de Datos Personales", "Lawful Basis & Purpose": "Base Jurídica y Finalidad",
        "Retention & Deletion": "Conservación y Supresión", "Data Subject Rights": "Derechos de los Interesados",
        "Processors & International Transfers": "Encargados del Tratamiento y Transferencias Internacionales", "DPIA": "EIPD",
        "Consistency Model": "Modelo de Consistencia", "Cross-system Writes": "Escrituras entre Sistemas", "Delivery & Idempotency": "Entrega e Idempotencia",
        "Concurrency": "Concurrencia", "Failure Modes": "Modos de Fallo",
      },
      allFilled: { sec: "las 5 rellenadas", privacy: "las 6 rellenadas", dist: "las 5 rellenadas" },
      statusSections: { sec: (list) => `Secciones de seguridad: ${list}`, privacy: (list) => `Secciones de privacidad: ${list}`, dist: (list) => `Secciones de consistencia de datos: ${list}` },
      finishChecks: {
        sec: ["+sec: SAST, auditoría de dependencias y análisis de secretos limpios en una ejecución local nueva; todas las pruebas de casos de abuso en verde.",
          "+sec: modelo de amenazas revisado contra el código final — ningún punto de entrada ni frontera de confianza nuevo sin mitigar."],
        privacy: ["+privacy: acceso/exportación y supresión verificados de extremo a extremo en los almacenes reales (encargados incluidos).",
          "+privacy: proceso de conservación programado; política de privacidad y registro de actividades de tratamiento (art. 30) actualizados; decisión sobre la EIPD registrada."],
        dist: ["+dist: pruebas de inyección de fallos en verde en una ejecución local nueva — caída entre el commit y la publicación, entrega duplicada, actualizaciones concurrentes, una dependencia caída.",
          "+dist: ninguna escritura entre sistemas del código final se salta su mitigación (outbox / inbox / saga) — ningún commit en la base de datos seguido de una publicación directa."],
      },
      clarify: {
        secAccess: "Especifica qué recibe quien llama sin autenticación o sin autorización (SI … ENTONCES EL SISTEMA DEBE denegar …) y el nivel ASVS al que apunta la función.",
        secSecrets: "Especifica qué secretos / credenciales maneja la función y que ninguno llega a una respuesta o a un log (escríbelo como AC).",
        privacyRights: "Especifica los derechos de los interesados que la función debe atender (acceso, supresión, portabilidad…) como ACs, con el plazo de un mes.",
        privacyRetention: "Especifica cuánto tiempo se conserva cada categoría de datos personales y qué ocurre cuando vence ese plazo.",
        distDelivery: "Especifica la garantía de entrega (al menos una vez) y cómo un mensaje entregado dos veces se detecta y se aplica una sola vez (clave de idempotencia, inbox) — escríbelo como AC.",
        distFailure: "Especifica qué hace la función cuando cada dependencia (base de datos, broker, API externa) no está disponible o agota el tiempo de espera — como criterios SI … ENTONCES EL SISTEMA DEBE.",
      },
    },

    markerSyntax: {
      doctor: (list) => `un texto con forma de marcador en una línea de tarea no da ningún marcador: ${list} — las herramientas no leen nada ahí (no se ejecuta ninguna comprobación, no se rastrea ningún archivo). Escríbelo como _Verify: <comando>_ / _Implements: <ruta>_ / _Depends: 3_ (en cursiva, con el valor dentro).`,
    },
    outsideCode: {
      doctor: (list) => `pruebas planificadas fuera del código de pruebas apuntan a un artefacto que aún es una plantilla: ${list} — rellénalo (la ejecución de carga real, el conjunto de evaluación propio de la función) antes de darlas por verificadas.`,
    },

    verifyPipe: {
      brief: (cmds) => `⚠ ${cmds.map((c) => "`" + c + "`").join(", ")} ${cmds.length > 1 ? "redirigen" : "redirige"} su salida a otro comando (pipe): el exit code de un pipeline es el de su ÚLTIMO comando, así que una comprobación que falla puede salir con 0 y pasar por verificada. Quita el pipe, o ejecútalo en bash tras \`set -o pipefail\` (cmd.exe no tiene pipefail) — el exit code que informes debe ser el de la propia comprobación.`,
      runHint: (cmd) => `⚠ \`${cmd}\` redirige su salida a otro comando (pipe): la shell solo informa del exit code del ÚLTIMO comando, así que una comprobación que falla puede registrarse como correcta — quita el pipe, o empieza con \`set -o pipefail;\` en bash (--shell bash); cmd.exe no tiene pipefail.`,
      doctor: (list) => `un comando _Verify:_ redirige su salida a otro (pipe) — una comprobación que falla puede salir con 0 (un pipeline informa del código de su ÚLTIMO comando): ${list}. Quita el pipe o usa \`set -o pipefail\` (bash).`,
      completeNote: (n, cmd) => `Tarea ${n}: el comando registrado redirige su salida a otro (\`${cmd}\`) — su exit 0 es el del ÚLTIMO comando, así que este resultado puede ocultar una comprobación que falla. Quita el pipe (o usa \`set -o pipefail\` en bash) y vuelve a ejecutarlo.`,
    },

    templates: {
      noSummary: "[por definir]",
      badAction: (a) => `Acción de plantillas desconocida '${a}' — una de: list, init, check.`,
      unknownArtifact: (a, list) => `Plantilla desconocida '${a}' — una de: ${list}, o steering/<archivo>.md.`,
      writeFailed: (rel, why) => `No se pudo escribir ${rel} (${why}).`,
      writeOutside: (rel) => `Me niego a escribir ${rel}: su carpeta es un enlace a un lugar fuera del proyecto.`,
      legacyFeature: ".specs/templates/ es la carpeta de una función creada antes de que existieran las plantillas del proyecto (tiene un .state.json) — sigue siendo esa función y nunca se lee como plantillas. Cámbiale el nombre (dev-spec feature rename templates <nuevo-nombre>, o spec_feature rename) para usar plantillas del proyecto.",
      builtIn: "de serie",
      override: "del proyecto",
      listHead: (lang, n) => `Plantillas para funciones en '${lang}' — ${n} plantilla(s) del proyecto en .specs/templates/ (un archivo en <lang>/ prevalece sobre uno compartido):`,
      ignored: (list) => `Ignorados — no son plantillas que dev-spec conozca: ${list}`,
      initDone: (n) => `${n} plantilla(s) de serie copiada(s) en .specs/templates/ — edítalas; los nuevos scaffolds las usan a partir de ahora:`,
      initKept: (list) => `Conservadas (ya existían — nunca se sobrescriben): ${list}`,
      initNothing: "Nada copiado — todas las plantillas pedidas ya están en .specs/templates/.",
      checkNone: "No hay plantillas del proyecto que comprobar — .specs/templates/ no tiene ninguna (`dev-spec templates init` copia las de serie).",
      checkHead: (n, errors, warnings) => `${n} archivo(s) de plantilla comprobado(s) — ${errors} error(es), ${warnings} aviso(s).`,
      appends: (file, list) => `${file}: el motor añade por sí mismo las secciones ${list} (la plantilla no tiene sus encabezados).`,
      problems: {
        empty: "vacío — ignorado; se usa la plantilla de serie.",
        "unknown-file": "no es una plantilla que dev-spec conozca (ver spec_templates list) — ignorado.",
        "unknown-variable": (v) => `{{${v}}} no es una variable de plantilla — se deja tal cual (conocidas: {{name}} {{slug}} {{summary}} {{tracks}} {{lang}} {{date}}).`,
        "no-placeholders": "ningún campo [entre corchetes] ni línea > **TODO** — un scaffold sin editar parecería rellenado y su gate podría aprobarse sin cambios.",
        "missing-section": (marker, section) => `falta ${marker} ${section} — la plantilla tiene otros encabezados ${marker}, así que el motor no añade ninguna sección de ese track y doctor falla en esta.`,
        "no-sentinel": (marker, section) => `${marker} ${section} no tiene línea > **TODO** — en una función nueva la sección parecería rellenada (la plantilla de serie siembra una).`,
        "constitution-missing": "sin sección Verificación de la Constitución (Constitution Check) — doctor avisa en todas las funciones creadas con ella.",
        "tradeoffs-missing": "sin sección Alternativas y Compensaciones — doctor avisa (design-tradeoffs) en todas las funciones creadas con ella.",
        "risks-missing": "sin sección Riesgos — doctor avisa (design-risks) en todas las funciones creadas con ella.",
        "no-criteria": "ningún criterio de aceptación (una línea US-n.AC-m con DEBE) — nada que seguir para EARS, trace_check o el plan de pruebas.",
        "ac-duplicate": (ids) => `IDs de AC duplicados: ${ids} — doctor falla en todas las funciones creadas con ella.`,
        "phantom-ac": (ids, file) => `cita IDs de AC que ${file} no define: ${ids} — trace_check los reporta como fantasmas.`,
        "builtin-phantom": (file, ids) => `el ${file} de serie (no sustituido) cita IDs de AC que esta plantilla no define: ${ids} — sustituye también ${file}, o conserva esos IDs.`,
        "phantom-test": (ids, file) => `pone en verde IDs de prueba que ${file} no define: ${ids} — trace_check los reporta como pruebas desconocidas en todas las funciones +tdd.`,
        "builtin-phantom-test": (file, ids) => `el ${file} de serie de una función +tdd (no sustituido) pone en verde IDs de prueba que esta plantilla no define: ${ids} — sustituye también ${file}, o conserva esos IDs.`,
        "root-cause-missing": "sin sección Causa Raíz — el gate del bugfix (root-cause de doctor) fallaría en todos los bugfixes hasta añadirla.",
        "root-cause-filled": "la Causa Raíz ya parece escrita (texto, sin campo, sin línea > **TODO**) — un bugfix nuevo pasaría el gate de la causa raíz antes de conocer la causa.",
        "repro-missing": "sin sección Reproducción — doctor avisa en todos los bugfixes.",
        "repro-filled": "la Reproducción ya parece escrita — un bugfix nuevo no pediría los pasos.",
        "no-tasks": "ninguna línea de tarea (- [ ] 1. …) — un scaffold con ella no tiene nada que ejecutar.",
        "no-active-tracks": "sin encabezado 'Tracks activos' — spec_add_track no puede registrar un cambio de track en classification.md.",
        "filematch-no-pattern": "el front matter dice inclusion: fileMatch pero no indica ningún fileMatchPattern — el archivo solo se lista a petición.",
      },
    },

    trackPacks: {
      acHeading: "Criterios de Aceptación (EARS)",
      taskHeading: (marker, title) => `Historia US-1 — ${marker} ${title}`,
      todoLine: "> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).",
      defaultCriterion: (title) => `EL SISTEMA DEBE [el comportamiento de ${title} que esta función garantiza]`,
      defaultTask: (marker, title) => `[US1] Cumplir los criterios ${marker} ${title} — rellenar sus secciones de diseño, implementarlos y verificarlos`,
      rowLayer: "integración",
      rowDesc: "[comportamiento]",
      checklistItem: (n) => `${n} sección(es) obligatoria(s) de diseño rellenada(s) (sin TODO) — cada criterio verificado.`,
      steeringStub: (title, name) => `# ${title}\n\n<!-- Las normas de ${title} del equipo: todas las funciones +${name} las siguen (spec_task_brief cita este archivo). -->\n- [fill me in]\n`,
      allFilled: (marker) => `todas las secciones ${marker} rellenadas`,
      statusSections: (marker, list) => `Secciones ${marker}: ${list}`,
      missing: (list) => `track pack(s) no disponible(s): ${list} — el track queda inactivo en esta función hasta que vuelva el pack (dev-spec tracks check).`,
      missingAbsent: (name) => `+${name} (no hay .specs/tracks/${name}/ en este proyecto)`,
      missingInvalid: (name, codes) => `+${name} (el pack no es válido: ${codes})`,
      badAction: (a) => `Acción de tracks desconocida '${a}' — una de: list, init, check.`,
      nameRequired: "tracks init necesita un nombre — dev-spec tracks init <nombre> (spec_tracks {action: \"init\", name}).",
      unknownPack: (n, list) => `No hay track ni track pack '${n}' — los packs del proyecto: ${list}.`,
      legacyFeature: ".specs/tracks/ es la carpeta de una función creada antes de que existieran los track packs (tiene un .state.json) — sigue siendo esa función y nunca se lee como packs. Cámbiale el nombre (dev-spec feature rename tracks <nuevo-nombre>, o spec_feature rename) para usar track packs.",
      writeFailed: (rel, why) => `No se pudo escribir ${rel} (${why}).`,
      writeOutside: (rel) => `Rechazado escribir ${rel}: su carpeta es un enlace a un lugar fuera del proyecto.`,
      builtIn: "de serie",
      sectionCount: (n) => `${n} sección(es)`,
      signalCount: (n) => `${n} señal(es)`,
      invalid: (n) => `no válido (${n} error(es)) — ignorado; ver dev-spec tracks check`,
      noPacks: "No hay track packs en .specs/tracks/ — `dev-spec tracks init <nombre>` crea uno.",
      listHead: (builtIn, packs, valid) => `Tracks — ${builtIn} de serie, ${packs} pack(s) del proyecto en .specs/tracks/ (${valid} válido(s)):`,
      checkNone: "No hay track packs que comprobar — .specs/tracks/ no tiene ninguno (`dev-spec tracks init <nombre>` crea uno).",
      checkHead: (n, valid, errors, warnings) => `${n} track pack(s) comprobado(s) — ${valid} válido(s), ${errors} error(es), ${warnings} aviso(s).`,
      initDone: (name, n) => `Track pack +${name} creado (${n} archivo(s)) — edítalos; desde ahora es un track válido:`,
      initKept: (list) => `Conservados (ya existían — nunca se sobrescriben): ${list}`,
      initNothing: (name) => `Nada escrito — todos los archivos del pack +${name} ya existen.`,
      initNext: (name) => `Siguiente: dev-spec tracks check · dev-spec add-track <función> ${name} (spec_add_track), o indícalo al crear una función.`,
      initJson: (a) => `// Track pack +${a.name} — un track definido por el proyecto (dev-spec 1.15). Solo datos: nada de esta carpeta se ejecuta.
// Guía: references/project-tracks.md · valídalo: dev-spec tracks check (spec_tracks {action: "check"}).
{
  // = el nombre de esta carpeta: ^[a-z][a-z0-9]{1,19}$, nunca un track de serie (core tdd saas ai sec privacy dist).
  "name": "${a.name}",
  // El marcador estable (distingue mayúsculas) de sus secciones de diseño, criterios y bloque de tareas: [${a.token}].
  "marker": "${a.token}",
  // Aparece en los encabezados ("#### [${a.token}] ${a.title} — Criterios de Aceptación (EARS)"); en es obligatorio, pt / pt-BR opcionales.
  "title": { "en": "${a.title}", "es": "${a.title}" },
  // Palabras clave del clasificador, comparadas como palabras enteras (con flexiones): una "strong" activa el track, dos "weak" también,
  // una "context" solo corrobora otra. Una palabra clave en MAYÚSCULAS es una sigla, comparada distinguiendo mayúsculas.
  "signals": { "strong": [], "weak": [], "context": [] },
  // Las secciones obligatorias de diseño: design.md recibe "## [${a.token}] <nombre>" + una línea > **TODO** por cada una; doctor
  // (${a.name}-sections) y la aprobación del diseño fallan hasta que todas estén rellenadas. syn: otros encabezados que cuentan (cualquier idioma).
  "sections": [
    { "name": { "en": "Standards", "es": "Normas" }, "syn": [], "guidance": { "en": "The ${a.title} standards this feature meets, and how each one is verified.", "es": "Las normas de ${a.title} que cumple esta función, y cómo se verifica cada una." } },
    { "name": { "en": "Verification", "es": "Verificación" }, "syn": [], "guidance": { "en": "Who checks it, with which tools, before the merge.", "es": "Quién la verifica, con qué herramientas, antes del merge." } }
  ],
  // Opcional: el archivo de steering que trae el track (.specs/steering/<archivo>, escrito desde steering.md cuando una función añade el track).
  "steering": "${a.name}.md"
}
`,
      initRequirements: (a) => `<!-- Track pack +${a.name}: los criterios de aceptación con que empieza cada función +${a.name} — un elemento de la lista = un criterio, en EARS.
     El motor los numera tras los criterios US-1 de la función (US-1.AC-n), bajo "#### [${a.token}] ${a.title} — Criterios de Aceptación (EARS)".
     Los huecos [entre corchetes] siguen siendo placeholders de la plantilla hasta que la función los rellene. -->
- CUANDO [disparador] EL SISTEMA DEBE [el comportamiento de ${a.title}]
- EL SISTEMA DEBE [una propiedad de ${a.title} que se cumple siempre]
`,
      initTasks: (a) => `<!-- Un elemento de la lista = una tarea del bloque "Historia US-1 — [${a.token}] ${a.title}" de la función (numerada tras su última tarea).
     {{ac1}}, {{ac2}}… = los criterios de este pack tal como la función los numera, {{acs}} = todos; {{t1}}… / {{tests}} = sus pruebas
     planificadas (+tdd — una línea que no nombre ninguna se omite). Una tarea sin _Requirements:_ recibe {{acs}}. -->
- [ ] [las decisiones de diseño de ${a.title} de esta función]
  - _Requirements: {{acs}}_
- [ ] [implementar y verificar los criterios de ${a.title}]
  - _Requirements: {{acs}}_
  - _Makes green: {{tests}}_
`,
      initTestPlan: (a) => `<!-- Una fila = una prueba planificada (funciones +tdd) — las seis celdas del plan de serie; la celda Test ID se renumera tras las del plan. -->
| Test ID | Capa | Tipo | Descripción | Cubre (IDs de AC) | Archivo |
|---------|------|------|-------------|-------------------|---------|
| T-00 | integración | example | [el comportamiento de ${a.title}, de extremo a extremo] | {{ac1}} | \`tests/integration/...\` |
| T-00 | unit | property | [la propiedad de ${a.title} siempre verdadera] | {{ac2}} | \`tests/unit/...\` |
`,
      initChecklist: (a) => `<!-- Un elemento de la lista = una línea del checklist.md de la función ("- [ ] ${a.token}: …"). -->
- todas las secciones de diseño [${a.token}] rellenadas (sin TODO) y revisadas.
- [la comprobación de ${a.title} que el equipo hace antes del merge]
`,
      initSteering: (a) => `# ${a.title}

<!-- Las normas de ${a.title} del equipo — todas las funciones +${a.name} las siguen (spec_task_brief cita este archivo). -->
- [fill me in]
`,
      problems: {
        "linked-folder": "un enlace (symlink / junction) o una carpeta fuera de .specs/ — ignorado: un pack solo se lee de su propia carpeta.",
        "unknown-file": "no es un archivo de pack (track.json, requirements.md, tasks.md, test-plan.md, checklist.md, steering.md, <idioma>/) — ignorado.",
        "too-many-packs": (a) => `más de ${a.max} track packs — este se ignora.`,
        "name-invalid": (a) => `'${a.name}' no es un nombre de track (^[a-z][a-z0-9]{1,19}$ — letras minúsculas y dígitos) — el pack se ignora.`,
        "name-reserved": (a) => `'${a.name}' está reservado (un track de serie, una palabra para uno, o una palabra que usa dev-spec) — el pack se ignora.`,
        "name-mismatch": (a) => `"name": "${a.name}" no es el nombre de la carpeta '${a.folder}' — el pack se ignora.`,
        "json-missing": "no hay track.json — el pack se ignora.",
        "json-invalid": (a) => `track.json no es JSON válido (${a.detail}) — el pack se ignora.`,
        "too-big": (a) => `${a.file} supera los ${a.max} bytes — el pack se ignora.`,
        "fragment-linked": (a) => `${a.file} no es un archivo normal dentro de .specs/ (es un enlace o una carpeta) — el pack se ignora.`,
        "field-missing": (a) => `falta "${a.field}" (${a.rule}) — el pack se ignora.`,
        "field-invalid": (a) => `"${a.field}" no es válido (${a.rule}) — el pack se ignora.`,
        "marker-invalid": (a) => `el marcador '${a.marker}' no es ^[A-Z][A-Z0-9]{1,11}$ — el pack se ignora.`,
        "marker-reserved": (a) => `el marcador [${a.marker}] es de dev-spec (un marcador de serie, una etiqueta de historia / paralela o un hueco genérico) — el pack se ignora.`,
        "marker-duplicate": (a) => `el marcador ${a.marker} ya es del pack +${a.other} — los marcadores son únicos; este pack se ignora.`,
        "signal-invalid": (a) => `signals.${a.tier}: '${a.keyword}' no es una palabra clave (letras y dígitos con espacios, - ' . intermedios — de 2 a 60 caracteres; siempre se compara como palabra literal, nunca como patrón) — el pack se ignora.`,
        "too-many": (a) => `${a.field}: más de ${a.max} — el pack se ignora.`,
        "section-duplicate": (a) => `la sección '${a.name}' tiene el nombre repetido — el pack se ignora.`,
        "steering-invalid": (a) => `el steering '${a.file}' no es un nombre de archivo de steering (minúsculas, dígitos y -, terminado en .md; no un nombre de dispositivo) — el pack se ignora.`,
        "steering-shared": (a) => `el steering ${a.file} también es un archivo de steering de serie — se conserva el que se escriba primero.`,
        "unknown-key": (a) => `clave desconocida "${a.key}" — ignorada.`,
        "unknown-variable": (a) => `{{${a.v}}} no es una variable de pack — se deja tal cual (conocidas: {{ac1}}… {{acs}} {{t1}}… {{tests}} {{title}} {{marker}} {{name}} {{slug}}).`,
        "fragment-empty": (a) => `${a.file} no contiene nada que el motor lea — se usa el valor de serie.`,
        "fragment-row": (a) => `una fila de ${a.file} sin las seis celdas del plan (Test ID | Capa | Tipo | Descripción | Cubre | Archivo) — el pack se ignora.`,
        "fragment-ref": (a) => a.kind === "t" && a.file !== "tasks.md" ? `${a.ref} no se puede usar en ${a.file} — solo tasks.md nombra las pruebas planificadas — el pack se ignora.`
          : `${a.ref} no nombra nada ${a.ctx ? "en las funciones " + a.ctx : "en la raíz del pack"}: ${a.from || "el valor de serie"} da ${a.n} ${a.kind === "ac" ? "criterio(s)" : "prueba(s) planificada(s)"} — el pack se ignora.`,
        "section-name-lead": (a) => `el nombre de sección '${a.name}' empieza con numeración, un emoji o un guion — se ignora al comparar encabezados: cuenta como '${a.key}'.`,
        "section-core-name": (a) => `la sección '${a.name}' tiene el nombre de un encabezado del diseño base ('${a.heading}') — solo cuenta un encabezado con el marcador del pack (o bajo uno); la sección base nunca cuenta.`,
      },
    },

    stakeholderExport: {
      autogen: "AUTO-GENERADO por dev-spec — no editar a mano. Para regenerar: spec_export (dev-spec export).",
      kicker: { feature: "Especificación de la función", bugfix: "Especificación del bugfix", project: "Especificación del proyecto" },
      projectTitle: (proj) => `${proj} — visión general de la especificación`,
      generated: (date) => `generado el ${date} a partir de las specs del proyecto (.specs/)`,
      meta: { id: "Función", kind: "Tipo", tracks: "Tracks", phase: "Fase", progress: "Progreso", status: "Estado", lang: "Idioma", overall: "Progreso global" },
      kind: { feature: "función", bugfix: "bugfix" },
      progress: (done, total, pct) => `${done}/${total} tareas hechas · ${pct}%`,
      overall: (pct, complete, total, done, tasks) => `${pct}% · ${complete}/${total} funciones completas · ${done}/${tasks} tareas hechas`,
      sections: {
        contents: "Índice", summary: "Resumen", stories: "Historias de usuario y criterios de aceptación", successCriteria: "Criterios de éxito", bug: "Informe del bug",
        design: "Diseño", testPlan: "Plan de pruebas", tasks: "Tareas", decisions: "Decisiones", approvals: "Aprobaciones", clarifications: "Aclaraciones pendientes",
        roadmap: "Hoja de ruta", backlog: "Backlog", catalog: "Catálogo vivo",
      },
      cols: { task: ["#", "Tarea", "Estado", "Verificación"], approval: ["Fase", "Aprobado por", "Cuándo", "Notas"], roadmap: ["Función", "Tracks", "Fase", "Progreso", "Tareas", "Depende de"] },
      taskStatus: { done: "✅ hecha", open: "☐ pendiente" },
      verification: { verified: "verificada", nothing: "nada que verificar", open: "—", unverified: (why) => "⚠ sin verificar" + (why ? ` (${why})` : "") },
      phases: { classification: "Clasificación", requirements: "Requisitos", design: "Diseño", "test-plan": "Plan de pruebas", "eval-plan": "Plan de evals", tests: "Pruebas (Fase 4)", tasks: "Tareas", execution: "Aprobación de la ejecución" },
      forced: (ids) => `aprobado con --force (fallando: ${ids})`,
      changedSince: "modificado desde esta aprobación — por revisar de nuevo",
      pending: "pendiente de aprobación",
      template: "plantilla — aún sin escribir",
      supersededBy: (list) => `sustituido por ${list}`,
      toBeSupersededBy: (list) => `se sustituirá por ${list} (aún no entregada)`,
      supersedes: (list) => `sustituye ${list}`,
      blocked: (list) => `bloqueada por ${list}`,
      none: "Nada.",
      noSummary: "Aún sin resumen.",
      noStories: "Aún sin historias de usuario ni criterios de aceptación.",
      noDesign: "Aún sin diseño.",
      noTasks: "Aún sin tareas.",
      noApprovals: "Aún ninguna fase aprobada.",
      noClarifications: "Ninguna — no hay marcadores [NEEDS CLARIFICATION] pendientes.",
      noFeatures: "Aún sin funciones.",
      theme: "Tema",
      print: "Imprimir",
      wrote: (file) => `✎ generado ${file}`,
      exportsIsFeature: (dir) => `${dir} es una carpeta de función anterior a que dev-spec reservara el nombre 'exports' (contiene requirements.md / .state.json) — mueve o renombra esa carpeta a mano y vuelve a exportar.`,
    },
    rtm: {
      title: "Matriz de trazabilidad",
      projectTitle: "Trazabilidad",
      autogen: "AUTO-GENERADO por dev-spec — no editar a mano. Para regenerar: dev-spec export --csv (spec_export format csv).",
      cols: {
        feature: "Función", id: "ID", kind: "Tipo", requirement: "Requisito", status: "Estado", gaps: "Lagunas", template: "Plantilla", design: "Secciones del diseño",
        tasks: "Tareas", tests: "Pruebas", testFiles: "Ficheros de prueba", evidence: "Última evidencia", decisions: "Decisiones", supersedes: "Sustituye",
        supersededBy: "Sustituido por", approvedAt: "Requisitos aprobados", approvedBy: "Aprobado por", changed: "Modificado desde la aprobación",
      },
      projectCols: ["Función", "Requisitos", "Verificados", "Implementados", "Planeados", "Sin trazar"],
      status: { verified: "verificado", implemented: "implementado", planned: "planeado", untraced: "sin trazar" },
      gap: {
        "no-task": "ninguna tarea lo cita", "no-test": "ninguna fila del plan de pruebas lo cubre", "no-coverage": "ninguna tarea ni prueba planeada lo cubre",
        "no-coverage-sc": "ninguna fila del plan de pruebas ni línea del quickstart lo cubre",
      },
      yes: "sí", no: "no", unknown: "desconocido",
      forced: "forzada",
      task: {
        verified: (n) => `#${n} verificada`, nothing: (n) => `#${n} hecha (nada que verificar)`, open: (n) => `#${n} pendiente`,
        unverified: (n, why) => `#${n} hecha, sin verificar${why ? ` (${why})` : ""}`,
      },
      evidence: (n, cmd, code, at, commit, expectedFail) => `#${n}: ${cmd} → salida ${code}${expectedFail ? " (ejecución en rojo, fallo esperado)" : ""}${commit ? ` @${commit}` : ""}${at ? ` · ${at}` : ""}`,
      evidenceNote: (n, note, at) => `#${n}: nota — ${note}${at ? ` · ${at}` : ""}`,
      notInCode: "en ningún fichero de prueba",
      outsideCode: "se ejecuta fuera del código de prueba",
      template: "plantilla — aún sin escribir",
      supersededBy: (list) => `sustituido por ${list}`,
      toBeSupersededBy: (list) => `se sustituirá por ${list} (aún no entregada)`,
      changedSince: "modificado desde la aprobación de los requisitos",
      legend: "Una fila por ID de requisito. Tareas: ✅ verificada · ⚠ hecha, sin verificar · ☐ pendiente. Estado: verificado — todas las tareas vinculadas hechas y verificadas; implementado — hechas, no todas verificadas; planeado — trazado, con trabajo pendiente; sin trazar — una laguna de trazabilidad (indicada).",
      projectLegend: "IDs de requisito (AC / EC / NFR / SC) por función, según su estado de trazabilidad — la exportación de cada función incluye su matriz.",
      approvedLine: (at, by, forced) => `Requisitos aprobados el ${at} por ${by}${forced ? " (con --force)" : ""}.`,
      notApproved: "Requisitos aún sin aprobar.",
      none: "Aún sin IDs de requisito.",
      cli: {
        head: (feature, tracks, c) => `Matriz de trazabilidad — ${feature} (${tracks}): ${c.rows} requisito(s) · ${c.verified} verificado(s) · ${c.implemented} implementado(s) · ${c.planned} planeado(s) · ${c.untraced} sin trazar`,
        legend: "tareas: ✓ verificada · ▲ hecha, sin verificar · ○ pendiente",
        codeLegend: "pruebas: ✓ nombrada en un fichero de prueba · ✗ en ningún fichero de prueba · ○ se ejecuta fuera del código de prueba",
        approved: (at, by, forced) => `requisitos aprobados el ${at} por ${by}${forced ? " (forzada)" : ""}`,
        notApproved: "requisitos aún sin aprobar",
        notes: { template: "plantilla", superseded: (list) => `sustituido por ${list}`, changed: "modificado desde la aprobación" },
      },
    },
    releaseNotes: {
      title: (proj) => `Notas de la versión — ${proj}`,
      autogen: "AUTO-GENERADO por dev-spec — no editar a mano. Para regenerar: spec_changelog {write: true} (dev-spec changelog --write).",
      sinceDate: (d) => `Cambios desde ${d}`,
      sinceLast: (d) => `Cambios desde las últimas notas de la versión (${d})`,
      all: "Todos los cambios registrados en las specs",
      generated: (d) => `generadas el ${d}`,
      added: "Añadido",
      changed: "Cambiado",
      fixed: "Corregido",
      none: "Nada.",
      rootCause: (t) => `Causa raíz: ${t}`,
      noRootCause: "causa raíz sin escribir en bug.md",
      changeRequest: (n, phase, d) => `solicitud de cambio #${n} (${phase}, ${d})`,
      crParts: { added: (l) => `añadido: ${l}`, modified: (l) => `modificado: ${l}`, removed: (l) => `eliminado: ${l}`, reopened: (l) => `tareas reabiertas: ${l}` },
      wrote: (file, a, c, f) => `✎ generado ${file} — ${a} añadido(s) · ${c} cambiado(s) · ${f} corregido(s)`,
      nothingToWrite: (file) => `Nada que informar desde entonces — ${file} no se ha escrito y meta.changelogAt no cambia.`,
      badSince: (v) => `since: '${v}' no es una fecha ISO (AAAA-MM-DD, o una marca de tiempo ISO completa), 'last' ni 'all'.`,
      noLast: "Aún no se han escrito notas de la versión (roadmap.json meta.changelogAt no está definido) — se listan todos los cambios.",
    },
    gherkin: {
      autogen: "AUTO-GENERADO por dev-spec — no editar a mano. Para regenerar: spec_export {format: \"gherkin\"} (dev-spec export <feature> --gherkin).",
      source: (rel) => `Origen: ${rel} — un escenario por criterio de aceptación vigente; EARS → Dado (MIENTRAS / DONDE / SI) · Cuando (CUANDO) · Entonces (la cláusula DEBE).`,
      summaryLabel: "Resumen",
      template: (id) => `${id} — plantilla, aún sin escribir: omitido`,
      superseded: (id, by) => `${id} — reemplazado por ${by} (entregada): omitido`,
      unsplit: "cláusulas EARS sin separación limpia — el criterio entero es un único paso Entonces",
      noScenarios: "Aún sin criterios de aceptación vigentes.",
      spike: (slug) => `'${slug}' es un spike — no tiene criterios de aceptación que exportar en Gherkin (spec_export {name: "${slug}"} sin el formato gherkin exporta su documento).`,
      wroteMany: (n, scenarios) => `✎ generados ${n} archivo(s) .feature — ${scenarios} escenario(s)`,
      noFeatures: "Ninguna función activa con criterios de aceptación que exportar.",
    },
    trackerCsv: {
      autogen: "AUTO-GENERADO por dev-spec — no editar a mano; deja esta columna sin asignar. Para regenerar: spec_export {format: \"jira\" | \"linear\"} (dev-spec export --tracker jira|linear).",
      featureLine: (rel, tracks, phase, done, total) => `función dev-spec ${rel} · tracks ${tracks} · fase: ${phase} · ${done}/${total} tareas hechas`,
      acceptance: "Criterios de aceptación:",
      taskLine: (rel, n) => `tarea dev-spec #${n} — ${rel}`,
      wrote: (file, n) => `✎ generado ${file} — ${n} elemento(s) de trabajo`,
    },
    milestone: {
      title: "Hitos",
      cols: ["Hito", "Fecha", "Funciones", "Hechas", "ETA", "Estado"],
      status: { "on-track": "a tiempo", "at-risk": "en riesgo", late: "retrasado", done: "completado" },
      archivedLabel: "archivadas",
      line: (name, date, done, total, eta, status, feats, archived) => `${name} — ${date} · ${done}/${total} función(es) hechas · ETA ${eta || "—"} · ${status} · ${feats || "—"}${archived ? ` (archivadas: ${archived})` : ""}`,
      head: (n, today) => `${n} hito(s) — hoy ${today}:`,
      none: "Aún sin hitos — añade uno: dev-spec milestone add <nombre> <AAAA-MM-DD> <funciones…> (spec_milestone {action: \"add\", name, date, features}).",
      added: (name, date, list) => `Hito '${name}' añadido — ${date}: ${list}`,
      updated: (name, date, list) => `Hito '${name}' actualizado — ${date}: ${list}`,
      removed: (name) => `Hito '${name}' eliminado.`,
      attention: {
        late: (date, done, total, eta) => `hito retrasado — su fecha ${date} ya pasó con ${done}/${total} función(es) hechas${eta ? ` (ETA ${eta})` : ""}`,
        "eta-after-date": (date, eta) => `hito en riesgo — el ETA más tardío de sus funciones (${eta}) es posterior a su fecha ${date}`,
        "eta-unknown": (date, eta, list) => `hito en riesgo — aún sin ETA para ${list} (fecha ${date}): datos de velocidad insuficientes, o aún sin tareas`,
        "no-features": (date) => `hito en riesgo — ya no le queda ninguna función activa (fecha ${date})`,
        invalid: (n, names, rel) => `${n} entrada(s) no válida(s) (${names}) en ${rel} — ignoradas: sin estado, y renombrar / archivar / eliminar / restaurar una función no las actualiza; corrígelas a mano (un nombre válido, un día AAAA-MM-DD real, listas de slugs de funciones, una entrada por nombre).`,
        notList: (rel) => `${rel} → meta.milestones no es una lista — no se lee ningún hito, y renombrar / archivar / eliminar / restaurar una función no lo actualiza; corrígelo a mano.`,
      },
      nameRequired: "Indica el nombre del hito (name).",
      badName: (v) => `nombre de hito no válido '${v}' — letras, dígitos, espacios y . _ : # ( ) + - (hasta 60 caracteres, empezando por una letra o un dígito).`,
      badDate: (v) => `date: '${v}' no es un día en formato AAAA-MM-DD (p. ej. 2026-10-31).`,
      noFeatures: "Indica al menos una función del hito (features).",
      unknownFeatures: (list) => `Cada función del hito debe ser una función activa existente — no encontrada(s): ${list}`,
      tooMany: (max) => `como máximo ${max} hitos — elimina uno primero (dev-spec milestone rm <nombre>).`,
      tooManyFeatures: (max) => `como máximo ${max} funciones por hito.`,
      notFound: (name, list) => `No existe el hito '${name}' (hitos: ${list}).`,
      badStored: (rel) => `${rel} → meta.milestones no es una lista de {name, date, features} como los escribe milestone add (un nombre válido, un día AAAA-MM-DD real, una entrada por nombre) — corrígelo a mano; me niego a cambiarlo.`,
      notesTitle: (title, name) => `${title} — ${name}`,
      notesScope: (name, date, list) => `Hito ${name} (${date}): ${list}`,
      notesAutogen: "AUTO-GENERADO por dev-spec — no editar a mano. Para regenerar: spec_changelog {milestone, write: true} (dev-spec changelog --milestone <nombre> --write).",
      nothingToWrite: (file) => `Nada que informar para este hito — ${file} no se ha escrito.`,
    },

    governance: {
      rolesShape: "approvalRoles debe asociar fases a listas de roles, p. ej. {\"requirements\": [\"product\"], \"design\": [\"tech\", \"security\"]} (CLI: --roles requirements=product,design=tech+security; --roles none los elimina)",
      rolesPhase: (phase, known) => `approvalRoles: fase desconocida '${phase}' (conocidas: ${known})`,
      rolesEmpty: (phase) => `approvalRoles.${phase}: indica al menos un rol`,
      badRole: (role) => `nombre de rol no válido '${role}' — usa letras, dígitos, '-', '_' o '.' (40 caracteres como máximo)`,
      rolesSet: (summary) => `Roles de aprobación: ${summary} — cada fase indicada solo cuenta como aprobada cuando todos los roles han validado su contenido actual (spec_approve {role} / --role).`,
      rolesCleared: "Roles de aprobación eliminados — cada fase vuelve a necesitar una sola aprobación.",
      phaseRequired: "Indica la fase que apruebas — o through: <fase> (CLI: --through <fase>) para avanzar rápido hasta ella.",
      roleRequired: (phase, slug, roles) => `'${phase}' se valida por rol (${roles}) — indica el rol con el que validas: /approve ${slug} ${phase} --role <rol> (spec_approve {role}). No se ha registrado nada.`,
      roleNotListed: (role, phase, roles) => `'${role}' no es un rol que valide '${phase}' (roles: ${roles}) — no se ha registrado nada.`,
      missing: (list) => `${list.length > 1 ? "faltan los roles" : "falta el rol"}: ${list.join(", ")}`,
      stepForced: (ids) => ` (forzada: ${ids.join(", ")})`,
      signedOff: (phase, slug, role) => `'${phase}' de ${slug} validada como ${role} ✓`,
      signedForced: (ids) => `Validado con force — las verificaciones que fallan quedan registradas con la validación: ${ids}.`,
      stillPending: (phase, missing) => `'${phase}' sigue pendiente hasta que todos los roles validen su contenido actual — ${missing}.`,
      approvedByRoles: (phase, roles) => `'${phase}' está aprobada — todos los roles validaron el contenido actual: ${roles}.`,
      staleSignOffs: (list) => `las validaciones hechas antes de que cambiara el artefacto ya no cuentan (vuelve a validar el contenido actual): ${list}`,
      resigning: (list) => `nueva validación en curso (la fase sigue aprobada como estaba hasta que todos los roles validen el nuevo contenido): ${list}`,
      unsigned: (list) => `aprobado sin las validaciones por rol que ahora se exigen (aprobado antes de configurar o cambiar los roles — cuenta como aprobado por un rol desconocido; pide a cada rol que vuelva a validar): ${list}`,
      approveRoles: (phase, slug, missing, signed, first) => `Revisa y valida '${phase}' — ${missing}${signed ? ` (ya validaron: ${signed})` : ""}: /approve ${slug} ${phase} --role ${first}.`,
      roadmapAwaiting: (list) => `esperando validación por rol: ${list}`,
      resignHint: (list, cmd) => `Cada rol vuelve a validar el nuevo contenido — ${list}: ${cmd}.`,
      ffBoth: "Pasa una fase o through (el avance rápido), no ambas.",
      ffExecution: "El avance rápido cubre solo las fases de planificación (como mucho hasta 'tasks') — valida 'execution' aparte, después de /spec-finish.",
      ffNotActive: (phase, slug) => `'${phase}' no es una fase aprobable de '${slug}' ahora mismo (su track está desactivado, o el plan que valida aún no existe) — no se ha aprobado nada.`,
      ffNothing: (slug, through) => `Nada que avanzar: todas las fases activas de '${slug}' hasta '${through}' ya están aprobadas.`,
      ffDone: (slug, list, through) => `Avance rápido de '${slug}': aprobadas ${list}, en orden, cada una por su propio gate — todas las fases hasta '${through}' están aprobadas.`,
      ffStopped: (slug, phase, list, why) => `El avance rápido de '${slug}' se detuvo en '${phase}'${list ? ` (aprobadas antes: ${list})` : " (nada aprobado)"} — ${why}`,
      ffWhyRefused: (ids, lines, slug, phase) => `su gate la rechaza — verificaciones que fallan: ${ids}.\n${lines}\nCorrígelas (detalles: /spec-doctor ${slug}) y vuelve a ejecutar el avance rápido (se reanuda en '${phase}').`,
      ffWhyRoles: (missing) => `validada, pero espera a los demás roles (${missing}) — las fases siguientes no pueden aprobarse antes que ella.`,
      ffWhyRole: (roles, slug, phase, through, given) => (given ? `'${given}' no es un rol que valide '${phase}' (roles: ${roles})` : `'${phase}' se valida por rol (${roles})`) +
        ` — no se ha registrado nada para '${phase}'. Vuelve a ejecutar el avance rápido con el rol con el que validas: /spec-ff ${slug} --role <rol> (CLI: dev-spec approve ${slug} --through ${through} --role <rol>); se reanuda en '${phase}'.`,
      ffHint: (slug, list, role) => `Todos los artefactos de planificación hasta las tareas están rellenados y pasan su gate — avance rápido: /spec-ff ${slug}${role ? " --role " + role : ""} (CLI: dev-spec approve ${slug} --through tasks${role ? " --role " + role : ""}) aprueba ${list} en orden, cada una por su propio gate.`,
      batch: (n) => `  aprobaciones en lote (avance rápido): ${n}`,
    },

    undo: {
      unticked: (n, slug, runnable, stale) => `La tarea ${n} vuelve a estar abierta (desmarcada).` +
        (stale ? ` Su evidencia registrada deja de contar — volver a marcarla exige ${runnable ? `una nueva ejecución de su comando _Verify:_: dev-spec done ${slug} ${n} --run` : "nueva evidencia"}.` : ""),
      alreadyOpen: (n) => `La tarea ${n} no está marcada — nada que deshacer.`,
      redKept: (n, slug, day) => `Su ejecución en rojo del ${day} (la prueba de _Expect: fail_) se mantiene: volver a marcarla exige una nueva ejecución de su comando _Verify:_ — con el arreglo hecho, una ejecución correcta cuenta como el arreglo que pone la prueba en verde: dev-spec done ${slug} ${n} --run.`,
      duplicateTicked: (n, list) => `Varias tareas marcadas comparten el número ${n} (${list}) — undo no puede saber cuál de las marcas fue el error. Renuméralas primero para que cada número sea único (doctor: duplicate-tasks) y después deshaz la que se marcó por error. No se ha cambiado nada.`,
      duplicateItem: (line, text) => `línea ${line}: "${text}"`,
      reopened: (slug) => `'${slug}' ya estaba terminada o aprobada — cuando la tarea vuelva a estar hecha, termínala de nuevo (/spec-finish ${slug}) y vuelve a aprobar la ejecución (/approve ${slug} execution).`,
      noEvidence: "undo no acepta evidencia — solo desmarca la tarea (registra la nueva ejecución cuando la vuelvas a marcar).",
      reasonNeedsUndo: "reason acompaña a undo (spec_complete_task {undo: true, reason} / dev-spec undone <feature> <n> --reason \"…\") — al marcar una tarea se registra evidencia.",
      badReason: (max) => `reason debe ser texto (una línea, como máximo ${max} caracteres).`,
      staleNote: (n, slug, runnable) => `Tarea ${n}: se desmarcó después de registrar esta evidencia — sigue sin verificar hasta que se registre ` +
        (runnable ? `una nueva ejecución: dev-spec done ${slug} ${n} --run` : "nueva evidencia."),
      label: "desmarcada después de registrar esta evidencia",
      cliDone: (n, done, total) => `Tarea ${n} desmarcada. ${done}/${total}`,
      cliAlready: (n, done, total) => `La tarea ${n} no estaba marcada. ${done}/${total}`,
      driftWhy: (list) => `desmarcada(s) después: ${list}`,
      signOffWhy: (list) => `la desmarcación de ${list}`,
    },
    revoke: {
      revoked: (phase, slug) => `Aprobación de '${phase}' revocada en ${slug} — la fase vuelve a estar pendiente (doctor, next_action y spec_finish la piden).`,
      withdrawn: (phase, slug, roles) => `Retiradas las aprobaciones por rol en espera para '${phase}' de ${slug}: ${roles} — aún no había nada aprobado.`,
      signOffsToo: (roles) => `También se retiraron las aprobaciones por rol que estaban en espera: ${roles}.`,
      laterStay: (list, phase) => `Nada en cascada: las fases siguientes siguen aprobadas (${list}); aprobar otra fase se rechaza (phase-order) hasta que '${phase}' vuelva a aprobarse.`,
      notApproved: (phase, slug) => `'${phase}' no está aprobada en ${slug} y ninguna aprobación por rol está en espera — nada que revocar.`,
      phaseRequired: "Indica la fase cuya aprobación quieres revocar.",
      noThrough: "revoke acepta una sola fase — no through (el avance rápido).",
      noForce: "revoke no acepta force ni expires — elimina una aprobación; reason dice por qué.",
      driftWhy: (list) => `aprobación revocada: ${list} (apruébala de nuevo antes de volver a cerrarla)`,
      signOffWhy: (list) => `la revocación de ${list}`,
    },
    waiver: {
      badExpires: (v, max) => `expires debe ser una fecha ISO (AAAA-MM-DD, hoy o después, como máximo dentro de ${max} días) o un número de días (30d, 1–${max}) — recibido: ${v}.`,
      needsForce: "reason / expires describen una excepción (waiver) — van con force (reason también con revoke).",
      notForced: "El gate pasó — no se eximió nada: el motivo / la caducidad no se registraron.",
      recorded: (reason, expires) => `Excepción registrada${reason ? `: ${reason}` : ""}${expires ? ` (vence el ${expires})` : ""}.`,
      doctor: (list, slug) => `aprobaciones forzadas cuya excepción caducó: ${list} — corrige las comprobaciones que fallan y vuelve a aprobar sin force (/approve ${slug} <fase>), o renueva la excepción (/approve ${slug} <fase> --force --reason "…" --expires 30d)`,
      expiredItem: (phase, expires, reason) => `${phase} (caducó el ${expires}${reason ? ` — ${reason}` : ""})`,
      roadmapItem: (phase, reason, expires, expired) => `${phase} (${[reason ? `excepción: ${reason}` : "excepción", expires ? (expired ? `CADUCADA el ${expires}` : `hasta el ${expires}`) : null].filter(Boolean).join(", ")})`,
      prHeading: "## Gates eximidos (aprobaciones forzadas)",
      prLine: (phase, failing, reason, expires, expired) => `- ${phase} — forzada pese a: ${failing || "—"} · ${reason ? `motivo: ${reason}` : "sin motivo registrado"}${expires ? ` · ${expired ? "CADUCADA el" : "vence el"} ${expires}` : ""}`,
      finishWarn: (list, slug) => `excepciones caducadas en aprobaciones forzadas: ${list} — vuelve a aprobar esas fases sin force, o renueva la excepción (dev-spec approve ${slug} <fase> --force --reason "…" --expires 30d)`,
    },

    forecast: {
      colEta: "Previsión",
      etaCell: (eta, low, high) => `${eta}${low ? ` (${low}…${high})` : ""}`,
      cliEta: (eta, low, high) => `previsión ${eta}${low ? ` (${low}…${high})` : ""}`,
      velocity: (v) => `Velocidad: ${v.pointsPerDay} punto(s)/día laborable — ${v.completed} tarea(s), ${v.points} punto(s) completados desde ${v.since} (últimos ${v.windowDays} días)`,
      notEnough: (v) => `Velocidad: aún no hay datos suficientes — ${v.completed} de las ${v.minTasks} tareas completadas que una previsión necesita en los últimos ${v.windowDays} días`,
      metricsVelocity: (v) => (v.completed ? `  velocidad: ${v.pointsPerDay} punto(s)/día laborable (${v.completed} tarea(s), ${v.points} punto(s) desde ${v.since}, últimos ${v.windowDays} días)${v.enough ? "" : ` — aún no hay datos suficientes para una previsión (se necesitan ${v.minTasks})`}`
        : `  velocidad: ninguna tarea completada en los últimos ${v.windowDays} días`),
      etaNote: (pct) => `Previsión = puntos pendientes ÷ velocidad, en días laborables (±${pct}%) · \`_Size: XS|S|M|L|XL_\` en una tarea = 1/2/3/5/8 puntos; una tarea sin tamaño cuenta como la mediana de su función (si no, M) · una función que espera una dependencia empieza después de la previsión de esa.`,
      overlap: {
        attentionActive: (other, files) => `planifica los mismos ficheros que ${other}: ${files} — ordénalas (spec_depend) o declara _Supersedes:_ si una sustituye el comportamiento de la otra`,
        attentionFinished: (other, files) => `planifica ficheros de la línea base de cierre de ${other}: ${files} — declara _Supersedes: ${other}/US-n.AC-m_ donde sustituye ese comportamiento, o spec_drift señalará ${other} después del merge`,
        doctorActive: (list, slug) => `hay tareas pendientes que planifican los mismos ficheros que otra función activa — ${list}: ambas los tocan en el merge y una deriva sin aviso. Ordena las dos (spec_depend {name: "${slug}", add: ["<otra>"]} · dev-spec depend ${slug} <otra>) o, donde una sustituye el comportamiento de la otra, declara _Supersedes: <otra>/US-n.AC-m_`,
        doctorFinished: (list, slug) => `hay tareas pendientes que planifican ficheros que una función cerrada registró en su línea base de drift — ${list}: después del merge, spec_drift la señala. Declara _Supersedes: <función>/US-n.AC-m_ en los criterios de ${slug} que sustituyen su comportamiento, haz que ${slug} dependa de ella donde se apoya en ella (spec_depend {name: "${slug}", add: ["<función>"]} · dev-spec depend ${slug} --add <función>), o vuelve a cerrarla después del merge (spec_finish)`,
        hookLine: (n, list) => `⚠ ${n} solapamiento(s) de ficheros entre funciones: ${list} — ejecuta /spec-doctor en ellas (ordénalas con /depend, o declara _Supersedes:_)`,
        cliHead: (n) => `⚠ ${n} solapamiento(s) de ficheros entre funciones:`,
        cliActive: (a, b, files) => `  ${a} ↔ ${b}: ${files}`,
        cliFinished: (a, b, files) => `  ${a} → ${b} (cerrada): ${files}`,
        more: (n) => `+${n} más`,
      },
    },

    // 1.14 B5 — rojo → verde (_Expect: fail_), verificaciones del proyecto (roadmap.json meta.checks) + la suite al final, `dev-spec log`.
    redGreen: {
      passRefused: (n) => `La tarea ${n} espera que su prueba FALLE (_Expect: fail_), pero la ejecución pasó (exit 0) — la prueba aún no falla, así que no prueba nada. Hazla fallar por la razón correcta (una aserción, "no implementado" — no una errata ni un import que falta) y registra esa ejecución. No la marco como hecha.`,
      passTicked: (n) => `La tarea ${n} está marcada, pero espera que su prueba FALLE (_Expect: fail_) y esta ejecución pasó (exit 0) sin ninguna ejecución en rojo registrada antes — la prueba no prueba nada: registrado; la tarea cuenta como no verificada hasta que se registre una ejecución que falle (en rojo).`,
      cantRun: (n, code, ticked) => `Tarea ${n}: exit ${code} significa que el propio comando no pudo ejecutarse (no encontrado / no ejecutable) — eso no es una prueba en rojo (_Expect: fail_). Corrige el comando _Verify:_ y registra después la ejecución que falla. ` + (ticked ? "Registrado; la tarea cuenta ahora como no verificada." : "No la marco como hecha."),
      passAfterRed: (n, day) => `Tarea ${n}: su prueba pasa ahora — es lo esperado tras el arreglo; la ejecución en rojo registrada el ${day} sigue siendo la prueba (_Expect: fail_).`,
      unexpectedPassNote: (n, slug) => `La tarea ${n} espera que su prueba FALLE (_Expect: fail_), pero su última ejecución pasó sin ninguna ejecución en rojo antes — sigue sin verificar hasta que se registre una ejecución que falle: dev-spec done ${slug} ${n} --run`,
      redRecorded: (n, code) => `  ✓ ejecución en rojo registrada para la tarea ${n} (exit ${code}) — la prueba falla antes de su arreglo, como espera _Expect: fail_.`,
      shellNotRed: (cmd) => `la shell predeterminada de Windows (cmd.exe) no pudo ejecutar \`${cmd}\` tal como está escrito — eso no es una prueba en rojo (_Expect: fail_). No se registró nada; la tarea sigue abierta.`,
      cantRunOutput: (n, code, what, ticked) => `Tarea ${n}: la ejecución salió con exit ${code}, pero su salida muestra que la prueba ni llegó a ejecutarse (${what}) — eso no es una prueba en rojo (_Expect: fail_): un fichero de prueba, módulo o script que falta no es la razón correcta. Escribe la prueba para que falle en una aserción (o "no implementado") y registra esa ejecución. ` + (ticked ? "Registrado; la tarea cuenta ahora como no verificada." : "No la marco como hecha."),
      notRed: (cmd, what) => `\`${cmd}\` falló, pero su salida muestra que la prueba ni llegó a ejecutarse (${what}) — eso no es una prueba en rojo (_Expect: fail_): un fichero de prueba, módulo o script que falta no es la razón correcta. No se registró nada; la tarea sigue abierta. Escribe la prueba para que falle en una aserción (o "no implementado"); después, repite el done --run.`,
      prRed: "la ejecución en rojo esperada (_Expect: fail_)",
      prRedKept: (code, day) => `ejecución en rojo antes del arreglo: exit ${code}${day ? " el " + day : ""}`,
      doctorMissing: (list) => `T-IDs puestos en verde por tareas hechas sin una ejecución en rojo registrada: ${list} — una prueba que nunca falló no prueba nada. Marca la tarea que la escribe con _Expect: fail_ y registra su ejecución que falla antes del arreglo (dev-spec done <función> <n> --run).`,
      doctorOk: (n) => `todos los T-IDs puestos en verde por tareas hechas (${n}) tienen una ejecución en rojo registrada`,
      briefExpect: "**Resultado esperado: FALLO** (_Expect: fail_) — la ejecución debe terminar con un exit distinto de cero: la prueba falla por la razón correcta antes del arreglo (una aserción / no implementado — no una errata, un import que falta o un comando que no se ejecuta). Una ejecución que pase se rechaza: significaría que la prueba no prueba nada.",
      dodExpect: "La ejecución del _Verify:_ debe FALLAR (exit distinto de cero) por la razón correcta — pon en el informe el comando, su exit code y el fallo; queda registrada como la ejecución en rojo de la tarea.",
      naVerify: (n, slug) => `La tarea ${n} tiene _Expect: fail_: su prueba es una ejecución que FALLA (la prueba en rojo antes del arreglo) — una ejecución que pasa no cuenta. Registra la ejecución en rojo (dev-spec done ${slug} ${n} --run mientras la prueba falla — antes del arreglo, o con el arreglo guardado en un stash), o quita _Expect: fail_ si la tarea no es una prueba en rojo.`,
    },
    projectChecks: {
      badInput: 'checks debe ser un objeto nombre → comando (p. ej. {"test": "npm test"}); un comando vacío elimina esa verificación.',
      badName: (k) => `nombre de verificación no válido '${k}' — letras, dígitos y . _ : - (hasta 40 caracteres, empezando por una letra o un dígito).`,
      badCommand: (k) => `el comando de la verificación '${k}' debe ser una línea de texto (hasta 500 caracteres) — o vacío para eliminar la verificación.`,
      tooMany: (max) => `como máximo ${max} verificaciones del proyecto.`,
      badStored: (rel) => `${rel} → meta.checks no es un objeto de nombre → comando (texto) — corrígelo a mano; no se modificará.`,
      initLine: (list) => `Verificaciones del proyecto (meta.checks): ${list}`,
      evidenceNotList: "evidence debe ser una lista de ejecuciones de verificaciones: [{name, command, exitCode, summary}].",
      noChecks: 'no hay verificaciones del proyecto configuradas (roadmap.json meta.checks) — nada que registrar. Defínelas primero: spec_init {checks: {"test": "npm test"}} (CLI: dev-spec init --check test="npm test").',
      evidenceItem: (i, why) => `evidence[${i}]: ${why}`,
      itemNotObject: "cada ejecución debe ser un objeto {name, command, exitCode, summary}",
      unknownCheck: (name, list) => `'${name}' no es una verificación del proyecto — una de: ${list}`,
      needsCommand: "falta el comando que se ejecutó",
      needsExit: "falta su exit code (un entero)",
      status: (i) => ({ "no-run": "ninguna ejecución registrada", failed: `la última ejecución falló (exit ${i.exitCode})`, changed: "su comando cambió desde la ejecución", "before-last-tick": "se ejecutó antes de la última actividad en las tareas", "code-changed": "los ficheros de implementación cambiaron desde la ejecución", unobserved: "la ejecución no fue observada por el harness" })[i.status] || i.status,
      blocker: (list, slug) => `verificaciones del proyecto sin una ejecución correcta desde la última actividad en las tareas: ${list} — ejecútalas: dev-spec finish ${slug} --run (o registra las ejecuciones con spec_finish {evidence})`,
      doctorWarn: (list, slug) => `todas las tareas están hechas, pero hay verificaciones del proyecto sin una ejecución correcta desde la última actividad en las tareas: ${list} — spec_finish rechaza hasta que pasen: dev-spec finish ${slug} --run`,
      doctorOk: (n) => `todas las verificaciones del proyecto (${n}) tienen una ejecución correcta desde la última actividad en las tareas`,
      invalidStored: (list) => `roadmap.json meta.checks: entradas no válidas ignoradas (${list}) — cada una debe ser "nombre": "comando en una línea"`,
      prChecks: "## Verificaciones del proyecto",
      prNoRun: "ninguna ejecución registrada",
      briefDod: (list) => `Ejecuta las verificaciones del proyecto y pon en el informe cada comando, su exit code y las últimas líneas de la salida — nada de lo que pasaba antes de esta tarea puede fallar después: ${list}.`,
      briefDodRed: (list) => `Ejecuta las verificaciones del proyecto y pon en el informe cada comando, su exit code y las últimas líneas de la salida — los únicos fallos permitidos son las nuevas pruebas en rojo de esta tarea; todo lo que pasaba antes debe seguir pasando: ${list}.`,
      naFinish: (slug, list) => `Hay verificaciones del proyecto configuradas (${list}): el cierre necesita una ejecución correcta de cada una desde la última actividad en las tareas — dev-spec finish ${slug} --run las ejecuta y las registra (o ejecútalas tú y registra cada una con spec_finish {evidence: [{name, command, exitCode, summary}]}).`,
      recorded: (n) => `Registrada(s) ${n} ejecución(es) de verificaciones del proyecto en .state.json → finishChecks.`,
      noneToRun: 'no hay verificaciones del proyecto que ejecutar (roadmap.json meta.checks) — defínelas: dev-spec init --check test="npm test" [--check lint="npm run lint"]',
      badArg: (v) => `--check espera nombre=comando (recibido '${v}') — un comando vacío (nombre=) elimina esa verificación`,
      posixOnWindows: (name, cmd, kinds) => `la verificación del proyecto '${name}' (\`${cmd}\`) usa sintaxis de shell POSIX (${kinds.map((k) => ({ "single-quotes": "comillas simples '…'", variable: "$VARIABLES" })[k] || k).join(", ")}) que cmd.exe — la shell predeterminada de --run en Windows — interpreta de otra forma, a menudo sin fallar. No se ejecutó nada. Vuelve a ejecutar con --shell bash (Git Bash; o define DEV_SPEC_SHELL=bash) — o --shell cmd para ejecutarla en cmd.exe de todos modos.`,
    },
    runGate: {
      taskRefused: (cmd, why) => `\`${cmd}\` no pudo ejecutarse (${why}) — no se registró nada; la tarea sigue abierta.`,
      checkRefused: (name, cmd, why) => `la verificación del proyecto '${name}' (\`${cmd}\`) no pudo ejecutarse (${why}) — no se registró nada; corrígelo y vuelve a ejecutar finish --run.`,
      why: {
        spawn: (shell, code) => `no se pudo iniciar la shell '${shell}': ${code}`,
        signal: (sig) => `lo terminó la señal ${sig}`,
        timeout: (s) => `no terminó dentro del --timeout de ${s} s`,
        buffer: "su salida superó los 64 MB",
        wsl: (text) => `el bash que lo ejecutó es el lanzador de WSL, no una shell de esta máquina: ${text}`,
        shell: (text) => `la shell no pudo iniciarlo: ${text}`,
        error: (code) => `la ejecución no pudo arrancar: ${code}`,
      },
      wslBash: (p) => `--shell ${p} es el lanzador bash.exe de WSL: ejecuta el comando dentro de una distribución Linux (o falla con "execvpe(/bin/bash) failed"), no en una shell de esta máquina — se usa como pediste; una ejecución que WSL no pueda arrancar no se registra. Para una shell de esta máquina usa Git Bash: --shell bash lo encuentra (Git for Windows).`,
      wslExe: (p) => `--shell ${p} es wsl.exe, que no es una shell (rechaza el -c que usa toda ejecución en una shell) — rechazado, no se ejecutó nada. Indica la ruta del bash.exe de WSL para ejecutar dentro de WSL, o --shell bash para Git Bash.`,
      noGitBash: "--shell bash: no se encontró ningún Git Bash (git --exec-path, %ProgramFiles%\\Git\\bin\\bash.exe, PATH) — un bash.exe en System32 o WindowsApps es el lanzador de WSL, que ejecuta el comando dentro de una distribución Linux, así que nunca se usa. No se ejecutó nada. Instala Git for Windows, o indica en --shell la ruta completa de un bash.exe.",
    },
    gitLog: {
      head: (slug, n, citing, truncated) => `Commits: ${slug} — ${n} commit(s) leído(s)${truncated ? " (la ventana está llena: los commits más antiguos no se leyeron — --max N)" : ""}, ${citing} citan sus tareas`,
      taskLine: (n, text, done, list) => `  ${done ? "[x]" : "[ ]"} #${n} ${text} — ${list}`,
      commitRef: (short, subject, via) => `${short} ${subject} (${via})`,
      more: (n) => `+${n} más`,
      noCommit: "ningún commit la cita",
      implFirst: (n, tests, taskC, testC, files) => `red-first: el primer commit de la tarea ${n} (pone ${tests} en verde) es ${taskC}, anterior a cualquier commit que toque un fichero de prueba que nombre ${tests} (${files} — el primero en ${testC}): la implementación llegó antes que su prueba.`,
      testNotCommitted: (n, tests, taskC, files) => `red-first: la tarea ${n} (pone ${tests} en verde) tiene commit (${taskC}), pero ningún commit leído toca un fichero de prueba que nombre ${tests} (${files}) — haz primero el commit de la prueba.`,
      redFirstStatus: (n, tests, status) => `red-first: tarea ${n} (${tests}) — ` + ({ ok: "la prueba tuvo commit primero ✓", "no-test-file": "ningún fichero de prueba la nombra aún (nada que comparar)", "no-task-commit": "ningún commit cita aún la tarea", "outside-window": "no se puede saber: la ventana del log está llena (--max N)" })[status],
      conventions: (slug) => `Ningún commit cita una tarea de '${slug}'. Convenciones: nombra la función y la tarea — "Part of .specs/${slug}/ task #N." (lo que escribe /spec-commit) — o los IDs que cubre: "Makes T-01 green", US-1.AC-2.`,
      noGit: "git no está disponible aquí, o esto no es un repositorio git con commits — dev-spec log lee `git log`. O pasa un log por la entrada estándar: git log --name-only --relative | dev-spec log <función> -",
    },

    stopGate: {
      claims: [
        String.raw`(?:está|están|esta|quedó|quedaron|fue|fueron|ya\s+está|ya\s+están)\s+(?:todo\s+)?(?:hech[oa]s?|list[oa]s?|terminad[oa]s?|completad[oa]s?|implementad[oa]s?|verificad[oa]s?|finalizad[oa]s?|resuelt[oa]s?)`,
        String.raw`tareas?\s+#?\d+(?:\s*(?:,|y|[-–]|a)\s*#?\d+)*\s+(?:(?:est[áa]|est[áa]n|fue|fueron|quedó|quedaron)\s+)?(?:hech[oa]s?|terminad[oa]s?|completad[oa]s?|implementad[oa]s?|verificad[oa]s?)`,
        String.raw`todas\s+las\s+(?:\d+\s+)?tareas\s+(?:(?:est[áa]n|fueron|quedaron|ya)\s+)*(?:hechas|terminadas|completadas|implementadas|verificadas|finalizadas|listas)`,
        String.raw`^[ \t*_#>\p{Extended_Pictographic}\uFE0F\u2713\u2714-]*(?:todo\s+)?(?:hecho|listo|terminado|completado|implementado|verificado|finalizado)[*_]*(?=[ \t]*(?:[.,!:—–\p{Extended_Pictographic}\u2713\u2714-]|$))`,
        String.raw`todo\s+(?:hecho|listo|terminado|en\s+verde|funciona)`,
        String.raw`(?:todas\s+las\s+(?:\d+\s+)?|las\s+)?(?:pruebas|tests?)\s+(?:(?:ya|ahora|todas)\s+)*(?:pasan|pasaron|pasa|pasó|est[áa]n\s+pasando|est[áa]n\s+en\s+verde|en\s+verde)`,
        String.raw`ya\s+funciona`,
        String.raw`terminé|completé|implementé|verifiqué|acabé|finalicé`,
        String.raw`completad[oa]s?|verificad[oa]s?|implementad[oa]s?`,
      ],
      negators: ["no", "nunca", "ni", "nada", "sin", "falta", "faltan", "ser", "cuando", "después", "antes", "si", "hasta", "voy", "vamos", "debo", "debe",
        "deben", "necesita", "necesitan", "tengo", "tenemos", "hay", "casi", "parcialmente", "pueda", "puedan", "aún", "todavía"],
      admissions: [
        String.raw`(?:no|nunca)\s+(?:(?:fue|fueron|está|están|ha|han|sido|se|todavía|aún)\s+){0,2}(?:verificad[oa]s?|probad[oa]s?|ejecutad[oa]s?)`,
        String.raw`sin\s+verificar|sin\s+evidencia|sin\s+verificación`,
        String.raw`[1-9]\d*\s+(?:pruebas?\s+|tests?\s+)?(?:fallan|fallaron|fallando|fallos?)`,
        String.raw`(?:pruebas|tests?)\s+(?:(?:todavía|aún|están)\s+)*(?:fallan|fallaron|fallando)`,
      ],
      fixed: ["corregí", "corregimos", "corregido", "corregida", "corregidos", "corregidas", "arreglé", "arreglamos", "arreglado", "arreglada", "arreglados", "arregladas",
        "resolví", "resolvimos", "resuelto", "resuelta", "resueltos", "resueltas", "anteriormente"],
      head: "dev-spec — gate de evidencia: tu último mensaje dice que el trabajo está hecho o verificado, pero hay tareas marcadas sin evidencia de verificación:",
      headSuite: "dev-spec — gate de evidencia: tu último mensaje dice que el trabajo está hecho o verificado, pero las verificaciones del proyecto no tienen una ejecución correcta desde la última actividad en las tareas:",
      taskLine: (slug, list) => `  - ${slug}: ${list}`,
      suiteLine: (slug, list) => `  - ${slug}: verificaciones del proyecto sin una ejecución correcta desde la última actividad en las tareas: ${list}`,
      more: (n) => `+${n} más`,
      todoTasks: (slug, n) => `Registra la evidencia antes de afirmarlo: lee el comando _Verify:_ de cada tarea listada en .specs/${slug}/tasks.md (primero la tarea ${n}), ejecútalo sobre el código final solo si es seguro hacerlo y registra esa ejecución con spec_complete_task {name, number, evidence: {command, exitCode, summary}}.`,
      todoSuite: (slug) => `Las verificaciones del proyecto de ${slug} no tienen ninguna ejecución que pase: léelas en .specs/roadmap.json (meta.checks), ejecútalas solo si es seguro hacerlo y registra las ejecuciones con spec_finish {evidence}.`,
      plainly: "O di claramente cuáles de ellas no están verificadas.",
      implementer: {
        head: (n, slug) => `dev-spec — gate de evidencia: informas la tarea ${n} de '${slug}' como DONE, pero`,
        noReport: (file) => `su informe (${file}) no existe.`,
        noRun: (file, cmds) => `su informe (${file}) no muestra la ejecución del _Verify:_ — el comando exacto y su exit code: ${cmds}.`,
        notPassing: (file, cmds) => `su informe (${file}) no muestra ninguna ejecución correcta (exit 0) de ${cmds} — el _Verify:_ de una tarea DONE debe pasar.`,
        notFailing: (file, cmds) => `su informe (${file}) no muestra ninguna ejecución que falle (un exit code distinto de cero) de ${cmds} — la tarea tiene _Expect: fail_: su prueba es la ejecución en rojo.`,
        todo: "Ejecuta el comando sobre el código final y pon en el informe el comando, su exit code y las últimas líneas de su salida — o informa BLOCKED / NEEDS_CONTEXT si no puede pasar. (Evidencia antes que afirmaciones: el controlador solo marca la tarea con esa ejecución.)",
      },
      allow: {
        off: () => "gate de evidencia: desactivado (roadmap.json meta.stopCheck: false) — nada comprobado.",
        "stop-hook-active": () => "gate de evidencia: este fin de turno ya se devolvió una vez (stop_hook_active) — permitido.",
        "no-specs": () => "gate de evidencia: aquí no hay una .specs/ de dev-spec — nada que comprobar.",
        "no-claim": () => "gate de evidencia: el mensaje no afirma que algo esté terminado ni verificado — permitido.",
        admitted: () => "gate de evidencia: el mensaje dice claramente qué no está verificado (o falla) — permitido.",
        "no-recent": (i) => `gate de evidencia: ninguna función tuvo actividad en las últimas ${i.hours} h (tarea marcada, evidencia registrada o tasks.md editado) — permitido.`,
        verified: (i) => `gate de evidencia: todas las tareas marcadas de las funciones con actividad reciente tienen evidencia correcta (${i.list}) — permitido.`,
        "not-done": () => "gate de evidencia: el implementador informa BLOCKED / NEEDS_CONTEXT — permitido.",
        "no-task": () => "gate de evidencia: el mensaje no nombra ningún informe de tarea (.specs/<función>/.execution/task-N-report.md) — permitido.",
        "nothing-to-verify": (i) => `gate de evidencia: la tarea ${i.n} de '${i.slug}' no tiene un comando _Verify:_ ejecutable — permitido.`,
        "report-ok": (i) => `gate de evidencia: el informe de la tarea ${i.n} de '${i.slug}' muestra la ejecución de su _Verify:_ — permitido.`,
      },
      on: "Gate de evidencia ACTIVADO — un turno que termina diciendo que el trabajo está hecho o verificado se devuelve mientras una función con actividad reciente tenga tareas marcadas sin evidencia de verificación (roadmap.json meta.stopCheck; hooks/stop-hook.js).",
      off: "Gate de evidencia DESACTIVADO — la comprobación de las afirmaciones al final del turno está desactivada (roadmap.json meta.stopCheck: false).",
      badValue: (v) => `--stop-check admite on u off (recibido '${v}').`,
    },
    scopeGuard: {
      on: "Modo guardia SCOPE (alcance) — Write/Edit en un fichero de código fuera de .specs/ pide confirmación salvo que una tarea sin terminar de una función aprobada lo nombre en _Implements:_ (el fichero, su carpeta o un glob; ficheros de prueba exceptuados), y la pide en todo cambio de código mientras ninguna función tenga tareas aprobadas sin terminar (roadmap.json meta.guard: \"scope\"). Los ficheros de prueba se permiten mientras el plan de pruebas de una función sin terminar esté aprobado (la Fase 4 escribe las pruebas que fallan antes del gate de las tareas), y todo fichero de código mientras un spike esté en curso (su prototipo).",
      ask: (file, features, hint) => `dev-spec guard (scope): ${file} no está en el plan — ninguna tarea sin terminar de ${features} lo nombra en _Implements:_. ${hint} (El modo guardia está en scope — dev-spec init --guard on permite todo fichero de código mientras haya tareas aprobadas; --guard off lo desactiva.)`,
      hint: {
        "same-folder": (n, slug, ref) => `Añádelo al _Implements:_ de la tarea ${n} (${slug} — misma carpeta que ${ref}) y vuelve a aprobar la fase tasks, o planifica el cambio con /spec-converge (spec_append_tasks).`,
        nearby: (n, slug, ref) => `Añádelo al _Implements:_ de la tarea ${n} (${slug} — planifica ${ref}, cerca) y vuelve a aprobar la fase tasks, o planifica el cambio con /spec-converge (spec_append_tasks).`,
        next: (n, slug) => `Añádelo al _Implements:_ de la tarea ${n} (${slug}, la siguiente tarea sin terminar) y vuelve a aprobar la fase tasks, o planifica el cambio con /spec-converge (spec_append_tasks).`,
      },
    },

    // 1.14 C2 — registro de decisiones (decisions.md, spec_decide) y el tipo spike (investigar → decidir).
    decisions: {
      header: (name) => `# Decisiones: ${name}

<!-- Registro de decisiones — solo se añade, se versiona con la spec. spec_decide (dev-spec decide) añade cada entrada:
     D-1, D-2… nunca renumeradas, nunca reescritas. _Affects:_ indica los AC IDs, T-IDs y secciones del diseño que toca
     la decisión; una decisión posterior que reemplace a otra dice _Supersedes: D-n_. Los descubrimientos (hechos
     aprendidos durante el trabajo) usan el mismo registro (_Kind: discovery_). -->
`,
      labels: { context: "Contexto", decision: "Decisión", discovery: "Descubrimiento", consequences: "Consecuencias" },
      kinds: { decision: "decisión", discovery: "descubrimiento" },
      titleRequired: "una decisión necesita un título (una línea de texto).",
      decisionRequired: "una decisión necesita su texto — decision: qué se decidió (en un descubrimiento: qué se descubrió).",
      badText: (field) => `${field} debe ser texto.`,
      tooLong: (field, max) => `${field} es demasiado largo (como máximo ${max} caracteres).`,
      badKind: (v) => `kind debe ser decision o discovery (recibido: ${v}).`,
      badAffects: (list) => `referencia(s) _Affects:_ desconocida(s): ${list} — un AC ID debe estar definido en requirements.md, un T-ID planificado en test-plan.md, un ID EC/NFR/SC escrito en requirements.md; cualquier otra debe ser un título de sección de design.md (bug.md / design.md en un bugfix, spike.md en un spike). No se escribió nada.`,
      badSupersedes: (list) => `_Supersedes:_ debe indicar decisiones que ya están en este registro (D-n): ${list}. No se escribió nada.`,
      unsafeFile: (rel) => `${rel} no es un archivo normal dentro de .specs/ (es un enlace simbólico, o apunta fuera del proyecto) — sustitúyelo primero por un archivo normal. No se escribió nada.`,
      recorded: (id, kind, file) => `${id} (${kind}) registrada en ${file}.`,
      briefHeading: "## Decisiones",
      briefIntro: "Decisiones y descubrimientos (decisions.md) que citan los criterios o pruebas de esta tarea — respétalos:",
      briefOmitted: (list) => `…y ${list} — ver decisions.md.`,
      supersedesNote: (list) => `reemplaza ${list}`,
      prHeading: "## Decisiones",
      catalogLine: (n, list) => `Decisiones (${n}): ${list}`,
      superseded: "reemplazada",
      affectsApproved: (list, slug, phases) => `decisiones registradas después de una aprobación tocan la spec aprobada: ${list} — revisa lo que cambian (spec_impact ${slug} --phase ${phases}), actualiza la spec y vuelve a aprobar.`,
      affectsApprovedEntry: (id, refs, file, day) => `${id} (${refs}) después de aprobarse ${file} (${day})`,
      phantomDoctor: (list) => `referencias _Affects:_ en decisions.md que no corresponden a nada en esta función: ${list} — una errata, o un criterio / prueba / sección eliminado desde entonces.`,
      phantom: (id, ref) => `${id} _Affects:_ ${ref} — no corresponde a nada en esta función (una errata, o un criterio / prueba / sección eliminado desde entonces)`,
      cliRecorded: (id, title, file) => `✎ ${id} — ${title}  (${file})`,
    },
    spike: {
      kind: "spike",
      kicker: "Spike (investigación)",
      report: (a) => `# Spike: ${a.name}

<!-- Spike (investigar → decidir): una investigación con tiempo acotado (timebox) que termina en una DECISIÓN, no en código de producción.
     El código de prototipo vive FUERA de .specs/ (una carpeta de borrador o una rama) — enlázalo en Evidencia.
     spec_doctor falla mientras la "Decisión" no esté escrita y avisa cuando pasa la fecha del timebox sin ella.
     Indica el resultado en su propia línea: _Outcome: go_ · _Outcome: no-go_ · _Outcome: pivot_ -->

## Pregunta
${a.question || "> **TODO** — la única pregunta que responde este spike (¿qué respuesta cambiaría el plan?)."}

## Timebox (plazo)
${a.until ? `**Hasta:** ${a.until}${a.raw && a.raw !== a.until ? ` (${a.raw})` : ""}` : "> **TODO** — la fecha de fin (AAAA-MM-DD) o el límite de esfuerzo. Cuando termine, decide con la evidencia que tengas."}

## Opciones consideradas
- [opción A — qué es, cuánto costaría]
- [opción B]

## Evidencia
<!-- Enlaces, mediciones, prototipos (el código queda fuera de la spec — enlázalo aquí), qué se probó y qué pasó. -->
- [enlace / medición / prototipo — y qué mostró]

## Decisión
> **TODO** — go / no-go / pivot (seguir / no seguir / cambiar de rumbo) y por qué: la evidencia que lo decidió.

_Outcome: [go | no-go | pivot]_

## Seguimiento
- [go: la función a especificar (spec_create) · no-go: por qué se descartó · pivot: la nueva pregunta]
`,
      tasks: (name) => `# Tareas: ${name}

<!-- Un spike no tiene gates de requisitos / diseño: pregunta → investigar → decidir. El código de prototipo vive FUERA
     de .specs/ — enlázalo en spike.md → Evidencia. Cuando termine el timebox, decide con lo que tengas. -->

## Fase: Investigación
- [ ] 1. [shared] Afinar la pregunta y fijar el timebox en spike.md (¿qué respuesta cambiaría el plan?)
- [ ] 2. [shared] Listar las opciones consideradas en spike.md → Opciones consideradas
- [ ] 3. [shared] Reunir la evidencia — prototipos (fuera de .specs/), mediciones, enlaces — en spike.md → Evidencia
- [ ] 4. [shared] Registrar la decisión (go / no-go / pivot) y su justificación en spike.md → Decisión; regístrala con spec_decide
**Checkpoint:** la pregunta tiene una respuesta respaldada por evidencia.
`,
      badTimebox: (v) => `timebox debe ser una fecha de fin (AAAA-MM-DD) o una duración desde hoy (p. ej. 3d, 2w, 8h) — recibido: ${v}.`,
      spikeOnly: (arg) => `${arg} solo se aplica a un spike (kind: "spike").`,
      tracksIgnored: (list) => `Un spike es solo core — tracks ignorados (${list}); dáselos a la función que especifiques tras un 'go'.`,
      noTracks: (slug) => `'${slug}' es un spike — no tiene tracks. Tras un 'go', especifica la función real con sus tracks (spec_create).`,
      noGate: (phase, slug) => `'${slug}' es un spike: no tiene gate de ${phase} — sigue pregunta → investigar → decidir. Registra la decisión en spike.md → Decisión (spec_decide la registra en el log); spec_finish lo cierra.`,
      doctor: {
        missing: "falta spike.md — ahí viven la pregunta, la evidencia y la decisión de un spike.",
        questionOk: "la pregunta está escrita",
        questionMissing: "spike.md → Pregunta sigue siendo la plantilla — escribe la única pregunta que responde este spike.",
        decisionOk: (o) => `decisión registrada (_Outcome: ${o}_)`,
        decisionMissing: "spike.md → Decisión aún no está escrita (go / no-go / pivot + justificación) — el spike no termina hasta que lo esté.",
        outcomeMissing: "la decisión está escrita pero su resultado no está indicado — añade una línea _Outcome: go_, _Outcome: no-go_ o _Outcome: pivot_.",
        timeboxOk: (d) => `timebox hasta ${d}`,
        timeboxPassed: (d) => `el timebox terminó el ${d} y no hay decisión registrada — decide con la evidencia que tienes (go / no-go / pivot), o amplía el timebox a propósito.`,
        timeboxUnset: "sin timebox — escribe una fecha de fin (AAAA-MM-DD) en spike.md → Timebox.",
        timeboxNoDate: "el timebox no tiene fecha de fin (AAAA-MM-DD) — no se puede comprobar cuándo se agota.",
        timeboxDecided: "decidido — el timebox está cerrado",
      },
      next: {
        missing: (slug) => `falta spike.md — vuelve a crearlo: dev-spec spike "${slug}" (solo crea: lo que existe se mantiene).`,
        fillQuestion: (slug) => `Escribe la pregunta que responde este spike (y su timebox) en spike.md → Pregunta / Timebox — /spec-spike ${slug}.`,
        investigate: (n, text, slug) => `Investiga — tarea #${n}: ${text}. El código de prototipo queda fuera de .specs/ (enlázalo en spike.md → Evidencia); márcala: dev-spec done ${slug} ${n}.`,
        decide: (slug) => `Registra la decisión en spike.md → Decisión — go / no-go / pivot, la justificación y su línea _Outcome:_ — y regístrala en el log: /spec-decide ${slug} (spec_decide).`,
        outcome: (slug) => `Indica el resultado en spike.md → Decisión: una línea _Outcome: go_, _Outcome: no-go_ o _Outcome: pivot_ (/spec-spike ${slug}).`,
        timeboxPassed: (d) => `El timebox terminó el ${d}: decide con la evidencia que tienes.`,
        goCreateFirst: (slug, name, summary) => `Decisión: go. Especifica la función real — spec_create {name: "${name}", summary: ${JSON.stringify(summary)}} (dev-spec create "${name}" --summary ${JSON.stringify(summary)}) — y luego archiva el spike: /feature archive ${slug}.`,
        goArchiveFirst: (slug, name, summary) => `Decisión: go. Archiva primero el spike — /feature archive ${slug} (libera el nombre) — y luego especifica la función real: spec_create {name: "${name}", summary: ${JSON.stringify(summary)}} (dev-spec create "${name}" --summary ${JSON.stringify(summary)}).`,
        noGo: (slug, reason) => `Decisión: no-go${reason ? ` — ${reason}` : ""}. Archiva el spike con su motivo (queda en spike.md → Decisión): /feature archive ${slug}.`,
        pivot: (slug, reason) => `Decisión: pivot${reason ? ` — ${reason}` : ""}. Empieza un nuevo spike para la nueva dirección (dev-spec spike "<nueva pregunta>") — o especifica la función si la respuesta ya está clara — y luego archiva este: /feature archive ${slug}.`,
      },
      finish: {
        ready: (slug) => `el spike '${slug}' está listo para cerrar — su decisión está registrada. Actúa en consecuencia (spec_next_action dice cómo).`,
        notReady: (slug) => `el spike '${slug}' aún no está listo para cerrar:`,
        missing: "falta spike.md",
        decisionBlocker: "spike.md → Decisión aún no está escrita (go / no-go / pivot + justificación)",
        prQuestion: "## Pregunta",
        prDecision: (o) => `## Decisión${o ? ` — ${o}` : ""}`,
        prEvidence: "## Evidencia",
        prOptions: "## Opciones consideradas",
        prFollowUp: "## Seguimiento",
        checks: ["La decisión se ha compartido con las personas a las que afecta.", "El código de prototipo queda fuera de la rama principal — la función real reescribe lo que aproveche en sus propias tareas."],
      },
      roadmapTimebox: (d) => `spike: el timebox terminó el ${d} sin decisión`,
      catalogQuestion: (q) => `Pregunta: ${q}`,
      catalogOutcome: (o) => `Decisión: ${o}`,
      catalogPending: "Decisión: pendiente",
      exportSection: "Spike",
      cliQuestion: (q) => `  pregunta: ${q}`,
      cliUntil: (d) => `  timebox: hasta ${d}`,
    },

    flow: {
      required: (slug, known) => `falta el flujo — uno de: ${known} (spec_feature {action: "flow", name: "${slug}", flow}; CLI: dev-spec feature flow ${slug} <flow>).`,
      kindRefused: (slug, kind) => `'${slug}' es un ${kind}: sigue su propio orden de fases fijo — el flujo solo se aplica a funciones.`,
      kindIgnored: (kind) => `flujo ignorado: un ${kind} sigue su propio orden de fases fijo (el flujo solo se aplica a funciones).`,
      kept: (slug, cur, asked) => `flujo mantenido: '${slug}' sigue ${cur} (pedido: ${asked}) — cámbialo con spec_feature {action: "flow"} (CLI: dev-spec feature flow ${slug} ${asked}).`,
      set: (slug, flow, prev, order) => `'${slug}' sigue ahora el flujo ${flow} (antes: ${prev}) — orden de fases: ${order}.`,
      same: (slug, flow, order) => `'${slug}' ya sigue el flujo ${flow} — orden de fases: ${order}.`,
      approvedStay: (list) => `Las fases ya aprobadas siguen aprobadas: ${list}.`,
      created: (order) => `flujo design-first — orden de fases: ${order} (los requisitos se escriben después de aprobar el diseño).`,
      nextNote: (order) => `(flujo design-first: ${order})`,
      laterPhase: (detail) => `requirements.md es una fase posterior (design-first) — ${detail}`,
    },
    importPlans: {
      plansDir: "El plan mode de Claude Code guarda los planes en plansDirectory (por defecto ~/.claude/plans — fuera del proyecto): copia primero el plan dentro del proyecto, o apunta plansDirectory a una carpeta dentro de él.",
      several: (dir, list) => `'${dir}' contiene varios documentos (${list}) — indica el que quieres importar.`,
      planTitle: "Plan",
      wNoSteps: "no se encontró ninguna checklist, lista de to-dos ni de pasos — se mantuvo el tasks.md del scaffold (divide el trabajo en tareas con /createTask)",
      wCancelled: (list) => `to-dos cancelados importados como tareas abiertas (elimina los que ya no apliquen): ${list}`,
      wNoDesignLeft: "no quedó nada para el diseño aparte de los criterios y los pasos — se mantuvo el design.md del scaffold",
      wNotExecPlan: "no se encontraron secciones de ExecPlan (Progress, Decision Log, Concrete Steps, Validation and Acceptance …) — ¿es un ExecPlan? Prueba la herramienta 'plan'.",
      decisionsHeading: "## Decisiones",
      nonFunctional: "## Requisitos No Funcionales",
      wUnknownAc: (story, task, list) => `${story}, '${task}': la(s) referencia(s) de AC ${list} no corresponden a ningún criterio de esa historia — se mantienen como están`,
      wWorkflow: (list) => `registros de workflow de BMAD no importados (se quedan donde están): ${list}`,
    },
  },
};
// The [SEC] / [PRIVACY] section display names live with their track's messages; every caller reads sectionNames.
for (const l of BASE_LANGS) Object.assign(MSG[l].sectionNames, MSG[l].secPrivacy.sectionNames); // pt-BR derives from pt's merged table

// 1.16 Q — spec quality: steering amendments (Q1), cross-feature acceptance criteria (Q2), the glossary (Q3). One group per
// language, merged into MSG (pt-BR derives from pt's). Check ids, reason codes and file names stay English.
const QUALITY_MSG = {
  en: {
    steeringChange: { modified: "changed", removed: "removed" },
    steeringItem: (phase, day, files) => `${phase} (approved ${day}): ${files}`,
    steeringDoctor: (items, slug) => `steering changed after approval — ${items}: re-review against the amended steering, then re-approve (dev-spec impact ${slug} --phase steering; without a feature it lists every one concerned).`,
    naSteering: (phases, files, slug) => `Also: steering changed after the approval of ${phases} (${files}) — re-review against it and re-approve if it still holds (dev-spec impact ${slug} --phase steering).`,
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
  },
  pt: {
    steeringChange: { modified: "alterado", removed: "removido" },
    steeringItem: (phase, day, files) => `${phase} (aprovado em ${day}): ${files}`,
    steeringDoctor: (items, slug) => `steering alterado depois da aprovação — ${items}: revê à luz do steering alterado e volta a aprovar (dev-spec impact ${slug} --phase steering; sem feature lista todas as afetadas).`,
    naSteering: (phases, files, slug) => `Nota: o steering mudou depois da aprovação de ${phases} (${files}) — revê à luz dele e volta a aprovar se continuar válido (dev-spec impact ${slug} --phase steering).`,
    impactNeedsName: (phases) => `nome em falta — só a fase 'steering' funciona para o projeto todo (sem feature). Fases: ${phases}.`,
    impactNoReopen: "o reopen não se aplica à fase 'steering' — nada é desmarcado: revê as features listadas e volta a aprovar os requisitos / o design.",
    impactHead: (n, feature) => (feature
      ? (n ? `Steering — ${feature}: aprovada com uma versão anterior de steering que mudou desde então` : `Steering — ${feature}: nenhuma aprovação foi feita com steering que mudou desde então`)
      : (n ? `Steering — ${n} feature(s) ativa(s) aprovada(s) com uma versão anterior de steering que mudou desde então` : "Steering — nenhuma aprovação de requisitos / design foi feita com steering que mudou desde então")),
    impactUntracked: (list) => `aprovadas antes da 1.16 (sem fingerprints do steering — nunca sinalizadas): ${list}`,
    impactUnreadable: (list) => `ignoradas — .state.json ilegível: ${list}`,
    impactReReview: (slug, phase) => `Revê cada uma à luz do steering alterado e volta a aprovar (/approve ${slug} ${phase}) — a aprovação regista o steering atual.`,
    xacKind: { duplicate: "quase duplicado", conflict: "possível conflito" },
    xacWhy: (reason, pct, nums) => (reason === "opposite-modal" ? `DEVE vs NÃO DEVE, ${pct}% semelhantes` : reason === "different-numbers" ? `números diferentes ${nums}, ${pct}% semelhantes` : `${pct}% semelhantes`),
    xacItem: (mine, other, kind, why) => `${mine} ↔ ${other} (${kind}: ${why})`,
    xacDoctor: (n, list) => `${n} par(es) de critérios parecem-se com os de outra feature ativa ou podem contradizê-los — ${list}. Junta-os ou muda um deles, ou declara _Supersedes: <feature>/US-n.AC-m_ no mais recente.`,
    xacMore: (n) => `… +${n}`,
    xacHeading: "Possíveis duplicados / conflitos",
    xacIntro: "Critérios de aceitação de features ativas diferentes que se parecem (quase duplicados) ou podem contradizer-se (o mesmo gatilho com DEVE vs NÃO DEVE, ou números diferentes) — uma heurística: junta-os ou muda um deles, ou declara _Supersedes:_ no mais recente.",
    xacTruncated: "(limitado — nem todos os critérios foram comparados)",
    glossaryQuestion: (locs, word, term, def) => `${locs}: '${word}' — o glossário diz ${term}${def ? ` (${def})` : ""}. Usa "${term}", ou corrige o .specs/steering/glossary.md se '${word}' significar outra coisa aqui.`,
    glossaryMore: (n) => `… e mais ${n} palavra(s) que o glossário manda evitar — ver spec_doctor (glossary).`,
    glossaryItem: (word, term, locs) => `'${word}' → ${term} (${locs})`,
    glossaryDoctor: (n, list) => `${n} uso(s) de palavras que o glossário manda evitar — ${list} (o spec_clarify pergunta por cada uma)`,
    glossaryOk: (n) => `nenhuma palavra que o glossário manda evitar no requirements.md / design.md (${n} termo(s))`,
    glossaryTruncated: (read, total) => `o glossary.md tem ${total} entradas — só as primeiras ${read} são lidas (reduz o número de entradas)`,
    briefGlossaryHeading: "## Glossário (termos que esta task usa)",
    briefGlossaryIntro: "Usa estas palavras exatamente como estão definidas (.specs/steering/glossary.md) — nunca as que são para evitar:",
    briefGlossaryAvoid: (list) => `evitar: ${list}`,
    briefGlossaryOmitted: (list) => `Aplicam-se mais entradas (tamanho) — lê-as no .specs/steering/glossary.md: ${list}`,
  },
  es: {
    steeringChange: { modified: "modificado", removed: "eliminado" },
    steeringItem: (phase, day, files) => `${phase} (aprobado el ${day}): ${files}`,
    steeringDoctor: (items, slug) => `steering modificado después de la aprobación — ${items}: revisa según el steering modificado y vuelve a aprobar (dev-spec impact ${slug} --phase steering; sin función lista todas las afectadas).`,
    naSteering: (phases, files, slug) => `Nota: el steering cambió después de la aprobación de ${phases} (${files}) — revisa según él y vuelve a aprobar si sigue siendo válido (dev-spec impact ${slug} --phase steering).`,
    impactNeedsName: (phases) => `falta el nombre — solo la fase 'steering' funciona para todo el proyecto (sin función). Fases: ${phases}.`,
    impactNoReopen: "reopen no se aplica a la fase 'steering' — no se desmarca nada: revisa las funciones listadas y vuelve a aprobar sus requisitos / su diseño.",
    impactHead: (n, feature) => (feature
      ? (n ? `Steering — ${feature}: aprobada con una versión anterior de steering que cambió desde entonces` : `Steering — ${feature}: ninguna aprobación se hizo con steering que cambió desde entonces`)
      : (n ? `Steering — ${n} función(es) activa(s) aprobada(s) con una versión anterior de steering que cambió desde entonces` : "Steering — ninguna aprobación de requisitos / diseño se hizo con steering que cambió desde entonces")),
    impactUntracked: (list) => `aprobadas antes de la 1.16 (sin fingerprints del steering — nunca señaladas): ${list}`,
    impactUnreadable: (list) => `omitidas — .state.json ilegible: ${list}`,
    impactReReview: (slug, phase) => `Revisa cada una según el steering modificado y vuelve a aprobar (/approve ${slug} ${phase}) — la aprobación registra el steering actual.`,
    xacKind: { duplicate: "casi duplicado", conflict: "posible conflicto" },
    xacWhy: (reason, pct, nums) => (reason === "opposite-modal" ? `DEBE vs NO DEBE, ${pct}% parecidos` : reason === "different-numbers" ? `números distintos ${nums}, ${pct}% parecidos` : `${pct}% parecidos`),
    xacItem: (mine, other, kind, why) => `${mine} ↔ ${other} (${kind}: ${why})`,
    xacDoctor: (n, list) => `${n} par(es) de criterios se parecen a los de otra función activa o pueden contradecirlos — ${list}. Únelos o reescríbelos, o declara _Supersedes: <feature>/US-n.AC-m_ en el más reciente.`,
    xacMore: (n) => `… +${n}`,
    xacHeading: "Posibles duplicados / conflictos",
    xacIntro: "Criterios de aceptación de funciones activas distintas que se parecen (casi duplicados) o pueden contradecirse (el mismo disparador con DEBE vs NO DEBE, o números distintos) — una heurística: únelos o reescríbelos, o declara _Supersedes:_ en el más reciente.",
    xacTruncated: "(limitado — no se compararon todos los criterios)",
    glossaryQuestion: (locs, word, term, def) => `${locs}: '${word}' — el glosario dice ${term}${def ? ` (${def})` : ""}. Usa "${term}", o corrige .specs/steering/glossary.md si '${word}' significa otra cosa aquí.`,
    glossaryMore: (n) => `… y ${n} palabra(s) más que el glosario manda evitar — ver spec_doctor (glossary).`,
    glossaryItem: (word, term, locs) => `'${word}' → ${term} (${locs})`,
    glossaryDoctor: (n, list) => `${n} uso(s) de palabras que el glosario manda evitar — ${list} (spec_clarify pregunta por cada una)`,
    glossaryOk: (n) => `ninguna palabra que el glosario manda evitar en requirements.md / design.md (${n} término(s))`,
    glossaryTruncated: (read, total) => `glossary.md tiene ${total} entradas — solo se leen las primeras ${read} (divídelo o recórtalo)`,
    briefGlossaryHeading: "## Glosario (términos que usa esta tarea)",
    briefGlossaryIntro: "Usa estas palabras tal como están definidas (.specs/steering/glossary.md) — nunca las que hay que evitar:",
    briefGlossaryAvoid: (list) => `evitar: ${list}`,
    briefGlossaryOmitted: (list) => `Se aplican más entradas (tamaño) — léelas en .specs/steering/glossary.md: ${list}`,
  },
};
for (const l of BASE_LANGS) MSG[l].quality = QUALITY_MSG[l];

// 1.17 A — every design weighs its choices: doctor's design-tradeoffs / design-risks details (keyed by check id, then by the
// section state: missing · template · empty · few · filled) and spec_clarify's consistency nudge (A2). pt-BR derives from pt.
const DESIGN_WEIGH_MSG = {
  en: {
    "design-tradeoffs": {
      filled: (n) => `${n} option(s) weighed`,
      missing: () => "no Alternatives & Trade-offs section — list the options weighed for each key decision (pros, cons, cost of being wrong, the one chosen and why)",
      template: () => "Alternatives & Trade-offs is still the template — replace its placeholders with the options really weighed",
      empty: () => "Alternatives & Trade-offs is empty — list the options weighed for each key decision",
      few: (n, min) => `Alternatives & Trade-offs lists ${n} option(s) — weigh at least ${min} per key decision (a table row or a bullet each: one option alone was never weighed)`,
    },
    "design-risks": {
      filled: (n) => (n ? `${n} risk(s) listed` : "written (no row or bullet — an honest 'no material risk' counts)"),
      missing: () => "no Risks section — list what could make the design wrong or the delivery late (likelihood, impact, mitigation, owner)",
      template: () => "Risks is still the template — replace its placeholders with the real risks (or say why there is none)",
      empty: () => "Risks is empty — an honest 'no material risk, because X' is fine; blank is not",
      few: () => "Risks lists no risk",
    },
    clarifyConsistency: (words) => `The spec mentions ${words}, but the design's Alternatives & Trade-offs / Risks say nothing about consistency or idempotency: what must succeed or fail together (atomicity, isolation level), who else writes the same data concurrently, strong or eventual consistency (how stale is acceptable), and the delivery guarantee and idempotency of anything asynchronous?`,
  },
  pt: {
    "design-tradeoffs": {
      filled: (n) => `${n} opção(ões) ponderada(s)`,
      missing: () => "sem secção Alternativas e Compromissos — lista as opções ponderadas para cada decisão-chave (prós, contras, custo de errar, a escolhida e porquê)",
      template: () => "Alternativas e Compromissos ainda é o template — substitui os placeholders pelas opções realmente ponderadas",
      empty: () => "Alternativas e Compromissos está vazia — lista as opções ponderadas para cada decisão-chave",
      few: (n, min) => `Alternativas e Compromissos lista ${n} opção(ões) — o mínimo são ${min} por decisão-chave (uma linha da tabela ou um item cada: uma opção sozinha nunca foi ponderada)`,
    },
    "design-risks": {
      filled: (n) => (n ? `${n} risco(s) listado(s)` : "escrita (sem linha nem item — um honesto 'nenhum risco relevante' conta)"),
      missing: () => "sem secção Riscos — lista o que pode tornar o design errado ou atrasar a entrega (probabilidade, impacto, mitigação, responsável)",
      template: () => "Riscos ainda é o template — substitui os placeholders pelos riscos reais (ou pela razão de não haver nenhum)",
      empty: () => "Riscos está vazia — um honesto 'nenhum risco relevante, porque X' serve; em branco não",
      few: () => "Riscos não lista nenhum risco",
    },
    clarifyConsistency: (words) => `A spec menciona ${words}, mas as secções Alternativas e Compromissos / Riscos do design nada dizem sobre consistência ou idempotência: o que tem de ter sucesso ou falhar em conjunto (atomicidade, nível de isolamento), quem mais escreve os mesmos dados ao mesmo tempo, consistência forte ou eventual (que desatualização é aceitável), e a garantia de entrega e a idempotência de tudo o que for assíncrono?`,
  },
  es: {
    "design-tradeoffs": {
      filled: (n) => `${n} opción(es) sopesada(s)`,
      missing: () => "sin sección Alternativas y Compensaciones — enumera las opciones sopesadas para cada decisión clave (pros, contras, coste de equivocarse, la elegida y por qué)",
      template: () => "Alternativas y Compensaciones sigue siendo la plantilla — sustituye sus placeholders por las opciones realmente sopesadas",
      empty: () => "Alternativas y Compensaciones está vacía — enumera las opciones sopesadas para cada decisión clave",
      few: (n, min) => `Alternativas y Compensaciones enumera ${n} opción(es) — sopesa al menos ${min} por decisión clave (una fila de la tabla o un punto cada una: una opción sola nunca se sopesó)`,
    },
    "design-risks": {
      filled: (n) => (n ? `${n} riesgo(s) enumerado(s)` : "escrita (sin fila ni punto — un honesto 'ningún riesgo relevante' cuenta)"),
      missing: () => "sin sección Riesgos — enumera lo que podría hacer erróneo el diseño o retrasar la entrega (probabilidad, impacto, mitigación, responsable)",
      template: () => "Riesgos sigue siendo la plantilla — sustituye sus placeholders por los riesgos reales (o explica por qué no hay ninguno)",
      empty: () => "Riesgos está vacía — un honesto 'ningún riesgo relevante, porque X' sirve; en blanco no",
      few: () => "Riesgos no enumera ningún riesgo",
    },
    clarifyConsistency: (words) => `La spec menciona ${words}, pero Alternativas y Compensaciones / Riesgos del diseño no dicen nada de consistencia ni de idempotencia: ¿qué debe tener éxito o fallar a la vez (atomicidad, nivel de aislamiento), quién más escribe los mismos datos a la vez, consistencia fuerte o eventual (qué desfase es aceptable), y cuál es la garantía de entrega y la idempotencia de todo lo asíncrono?`,
  },
};
for (const l of BASE_LANGS) MSG[l].designWeigh = DESIGN_WEIGH_MSG[l];

// ===========================================================================
// Task brief (spec_task_brief) — the self-contained brief a fresh implementer reads first.
// Labels and loop rules per language; renderBrief() owns the layout. IDs, `_Label:_` markers and
// **Checkpoint:** stay English-stable inside the rendered brief.
// ===========================================================================

const BRIEF = {
  en: {
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
  },
  pt: {
    title: (feature, n) => `# Brief da tarefa — ${feature} · tarefa ${n}`,
    intro: "Lê isto primeiro — são os teus requisitos. Os valores abaixo são vinculativos; não construas nada além desta tarefa.",
    story: "História", phase: "Fase", parallel: "Paralela", tracks: "Tracks", loop: "Ciclo",
    yes: "sim [P]", no: "não",
    inlineOnly: "⚠ **Só inline** — tarefa de prompt/evals: o controlador executa-a na sessão principal (as evals custam dinheiro; aceitar/reverter é uma decisão). Não a delegues.",
    task: "## Tarefa",
    context: "## Onde isto encaixa (história de utilizador)",
    bug: "## O bug (bug.md)", bugRepro: "Reprodução", bugRootCause: "Causa raiz",
    bugUnfilled: "_Ainda por escrever — nenhuma correção antes de a causa raiz estar escrita no bug.md._",
    acs: "## Critérios de aceitação (vinculativos)",
    acsNone: "_Nenhum critério de aceitação referido — responde NEEDS_CONTEXT em vez de inventar âmbito._",
    tests: "## Testes a pôr a verde",
    testsRed: "## Testes que esta tarefa escreve — têm de FALHAR primeiro (vermelho)",
    evals: "## Evals afetadas",
    metrics: "## Métricas a emitir",
    files: "## Ficheiros (_Implements:_)",
    design: "## Contexto de design",
    designToc: (p) => `Design completo: \`${p}\` — secções:`,
    designOmitted: "Relevantes mas não incluídas (tamanho) — lê-as no design.md:",
    steering: "## Restrições globais",
    constraintsIntro: "Vinculativas para todas as tarefas (tasks.md → Restrições Globais):",
    verification: "## Verificação (_Verify:_)",
    verifyRule: "Corre cada comando _Verify:_ acima sobre o código final e põe no relatório o comando exato, o exit code e as últimas linhas do output — o controlador regista-os com o spec_complete_task como evidência da tarefa.",
    steeringRead: "Lê antes de programar:",
    unresolved: "## ⚠ Referências não resolvidas",
    unresolvedNote: "A tarefa cita estes IDs mas a spec não os define. Responde NEEDS_CONTEXT em vez de adivinhar.",
    dod: "## Definição de pronto",
    loopRules: {
      core: [
        "Implementa exatamente o que a tarefa e os seus critérios de aceitação exigem — nada a mais (YAGNI).",
        "Corre a suite de testes existente: tudo o que estava verde continua verde.",
        "Faz commit com uma mensagem convencional que cite a tarefa (ex.: `feat(módulo): … — tarefa #N`).",
        "Nunca alteres um teste existente para o pôr a passar. Se um teste parecer errado, pára e responde BLOCKED.",
      ],
      tdd: [
        "Primeiro VERMELHO: corre os testes-alvo e confirma que falham pela razão certa (asserção / não implementado — não um erro de escrita nem um import em falta). Põe o comando e o output no relatório.",
        "Escreve o código mínimo que põe os testes-alvo a verde.",
        "Corre a suite COMPLETA: alvos a verde, testes que estavam verdes continuam verdes, testes de tarefas futuras continuam vermelhos.",
        "Refatora só com tudo verde. Nunca mudes a expectativa de um teste planeado — se parecer errada, pára e responde BLOCKED.",
        "Faz commit citando a tarefa e os testes que põe a verde (`Makes T-01, T-02 green`).",
      ],
      "ai-prompt": [
        "Regista a baseline das evals antes de mudar o que quer que seja.",
        "Edita o prompt num ficheiro versionado NOVO (`prompts/vN.md`), nunca no mesmo ficheiro.",
        "Corre o harness de evals completo; aceita só se o golden melhorou ou se manteve e o adversarial se manteve — caso contrário, reverte.",
        "Faz commit com o delta das evals (`Eval delta: golden 82% → 87%`).",
      ],
    },
    metricsRule: "Cada métrica listada acima é mesmo emitida — mostra a evidência no relatório.",
    redRules: [
      "Esta é uma tarefa VERMELHA: escreve (ou mantém) os testes planeados exatamente como o plano de testes os descreve — nenhum código de produção e nenhuma correção nesta tarefa.",
      "Corre-os: têm de FALHAR pela razão certa — uma asserção ou \"não implementado\". Um ficheiro de teste, módulo ou script em falta, um erro de escrita ou um comando que não corre não é um teste vermelho (é recusado como tal).",
      "Os testes que passavam antes continuam verdes: só os testes novos desta tarefa podem falhar. Nunca alteres um teste existente.",
      "Faz commit do teste a falhar citando a tarefa e os seus T-IDs (`test(âmbito): T-01 red — tarefa #N`).",
    ],
    evalsRule: "Esta alteração toca num caminho de IA: corre o harness de evals no fim — o golden mantém-se ou melhora, o adversarial mantém-se — e põe as pontuações no relatório.",
    checkpoint: "Quando a última tarefa desta história estiver feita, o controlador pára para revisão humana no checkpoint:",
    report: "## Relatório",
    reportTo: (p) => `Escreve o relatório completo em \`${p}\` e responde só com a linha de estado (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED), os teus commits, um resumo de uma linha dos testes, eventuais preocupações e o caminho do relatório escrito por extenso (\`${p}\`) — é por esse caminho que o gate de evidência e o controlador chegam ao relatório.`,
    ledgerHeader: (feature) => `# Ledger de execução — feature: ${feature}\n\n<!-- Uma linha por evento, acrescentada pelo controlador (nunca reescrita):\n     Preflight: … · Ruling: <o quê> — <porquê> — <custo se estiver errado> · Task N: dispatched (base <sha>, model <m>)\n     Task N: fix round R/5 (…) · Task N: minor (deferred): … · Task N: parked — … · Task N: complete (commits a..b, review clean)\n     Checkpoint USn: presented → approved -->\n`,
    allDone: "Todas as tarefas estão feitas — não há nada para o brief.",
    alreadyDone: (n) => `A tarefa ${n} já está marcada como feita.`,
  },
  es: {
    title: (feature, n) => `# Brief de la tarea — ${feature} · tarea ${n}`,
    intro: "Lee esto primero — son tus requisitos. Los valores de abajo son vinculantes; no construyas nada más allá de esta tarea.",
    story: "Historia", phase: "Fase", parallel: "Paralela", tracks: "Tracks", loop: "Ciclo",
    yes: "sí [P]", no: "no",
    inlineOnly: "⚠ **Solo inline** — tarea de prompt/evals: el controlador la ejecuta en la sesión principal (las evals cuestan dinero; aceptar/revertir es una decisión). No la delegues.",
    task: "## Tarea",
    context: "## Dónde encaja (historia de usuario)",
    bug: "## El bug (bug.md)", bugRepro: "Reproducción", bugRootCause: "Causa raíz",
    bugUnfilled: "_Aún sin escribir — ninguna corrección antes de que la causa raíz esté escrita en bug.md._",
    acs: "## Criterios de aceptación (vinculantes)",
    acsNone: "_Ningún criterio de aceptación referenciado — responde NEEDS_CONTEXT en vez de inventar alcance._",
    tests: "## Pruebas a poner en verde",
    testsRed: "## Pruebas que escribe esta tarea — deben FALLAR primero (rojo)",
    evals: "## Evals afectadas",
    metrics: "## Métricas a emitir",
    files: "## Ficheros (_Implements:_)",
    design: "## Contexto de diseño",
    designToc: (p) => `Diseño completo: \`${p}\` — secciones:`,
    designOmitted: "Relevantes pero no incluidas (tamaño) — léelas en design.md:",
    steering: "## Restricciones globales",
    constraintsIntro: "Vinculantes para toda tarea (tasks.md → Restricciones Globales):",
    verification: "## Verificación (_Verify:_)",
    verifyRule: "Ejecuta cada comando _Verify:_ de arriba sobre el código final y pon en el informe el comando exacto, su exit code y las últimas líneas de la salida — el controlador los registra con spec_complete_task como evidencia de la tarea.",
    steeringRead: "Lee antes de programar:",
    unresolved: "## ⚠ Referencias sin resolver",
    unresolvedNote: "La tarea cita estos IDs pero la spec no los define. Responde NEEDS_CONTEXT en vez de adivinar.",
    dod: "## Definición de hecho",
    loopRules: {
      core: [
        "Implementa exactamente lo que exigen la tarea y sus criterios de aceptación — nada más (YAGNI).",
        "Ejecuta la suite de pruebas existente: todo lo que estaba en verde sigue en verde.",
        "Haz commit con un mensaje convencional que cite la tarea (p. ej. `feat(ámbito): … — tarea #N`).",
        "Nunca modifiques una prueba existente para que pase. Si una prueba parece incorrecta, para y responde BLOCKED.",
      ],
      tdd: [
        "Primero ROJO: ejecuta las pruebas objetivo y confirma que fallan por la razón correcta (aserción / no implementado — no una errata ni un import que falta). Pon el comando y la salida en el informe.",
        "Escribe el código mínimo que pone las pruebas objetivo en verde.",
        "Ejecuta la suite COMPLETA: objetivos en verde, las que estaban en verde siguen en verde, las de tareas futuras siguen en rojo.",
        "Refactoriza solo en verde. Nunca cambies la expectativa de una prueba planificada — si parece incorrecta, para y responde BLOCKED.",
        "Haz commit citando la tarea y las pruebas que pone en verde (`Makes T-01, T-02 green`).",
      ],
      "ai-prompt": [
        "Registra la baseline de las evals antes de cambiar nada.",
        "Edita el prompt en un fichero versionado NUEVO (`prompts/vN.md`), nunca en el mismo.",
        "Ejecuta el harness de evals completo; acepta solo si golden mejoró o se mantuvo y adversarial se mantuvo — si no, revierte.",
        "Haz commit con el delta de evals (`Eval delta: golden 82% → 87%`).",
      ],
    },
    metricsRule: "Cada métrica listada arriba se emite de verdad — muestra la evidencia en el informe.",
    redRules: [
      "Esta es una tarea ROJA: escribe (o conserva) las pruebas planificadas exactamente como las describe el plan de pruebas — nada de código de producción ni de arreglo en esta tarea.",
      "Ejecútalas: deben FALLAR por la razón correcta — una aserción o \"no implementado\". Un fichero de prueba, módulo o script que falta, una errata o un comando que no se ejecuta no es una prueba en rojo (se rechaza como tal).",
      "Las pruebas que pasaban antes siguen en verde: solo pueden fallar las pruebas nuevas de esta tarea. Nunca modifiques una prueba existente.",
      "Haz commit de la prueba que falla citando la tarea y sus T-IDs (`test(ámbito): T-01 red — tarea #N`).",
    ],
    evalsRule: "Este cambio toca una ruta de IA: ejecuta el harness de evals al final — golden se mantiene o mejora, adversarial se mantiene — y pon las puntuaciones en el informe.",
    checkpoint: "Cuando la última tarea de esta historia esté hecha, el controlador se detiene para revisión humana en el checkpoint:",
    report: "## Informe",
    reportTo: (p) => `Escribe el informe completo en \`${p}\` y responde solo con la línea de estado (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED), tus commits, un resumen de una línea de las pruebas, cualquier duda y la ruta del informe escrita completa (\`${p}\`) — por ella el gate de evidencia y el controlador encuentran tu informe.`,
    ledgerHeader: (feature) => `# Ledger de ejecución — función: ${feature}\n\n<!-- Una línea por evento, añadida por el controlador (nunca reescrita):\n     Preflight: … · Ruling: <qué> — <por qué> — <coste si es erróneo> · Task N: dispatched (base <sha>, model <m>)\n     Task N: fix round R/5 (…) · Task N: minor (deferred): … · Task N: parked — … · Task N: complete (commits a..b, review clean)\n     Checkpoint USn: presented → approved -->\n`,
    allDone: "Todas las tareas están hechas — no hay nada para el brief.",
    alreadyDone: (n) => `La tarea ${n} ya está marcada como hecha.`,
  },
};

// Layout of the brief (language-neutral; every label comes from BRIEF[lang]).
function renderBrief(d, lang) {
  const t = BRIEF[normalizeLang(lang)];
  const out = [];
  const push = (...lines) => out.push(...lines);
  const task = d.task;
  push(t.title(d.feature, task.number), "", "> " + t.intro, "");
  push(`- **${t.story}:** ${task.story || "—"} · **${t.phase}:** ${task.phase || "—"} · **${t.parallel}:** ${task.parallel ? t.yes : t.no}`);
  push(`- **${t.tracks}:** ${d.tracks} · **${t.loop}:** ${d.loop}`);
  if (d.inlineOnly) push("", t.inlineOnly);

  push("", t.task, `${task.number}. ${task.text}`, ...task.body.map((l) => "   " + l));
  if ((d.dependsOn || []).length) { // 1.14 F3: the task's _Depends:_ and where each stands
    const TD = MSG[normalizeLang(lang)].taskDeps;
    const mark = { done: "✓", open: "○", missing: "✗" };
    push("", TD.briefHeading, ...d.dependsOn.map((x) => `- #${x.number} ${mark[x.status]} ${TD.briefStatus[x.status]}${x.text ? " — " + x.text : ""}`));
    if (d.dependsOn.some((x) => x.status !== "done")) push("", TD.briefOpenNote);
  }
  if (d.stories.length) {
    push("", t.context);
    d.stories.forEach((s, i) => { if (i) push(""); push(`**${s[0]}**`, ...s.slice(1)); });
  }
  if (d.bug) { // a bugfix task: the reproduction and the root cause it must respect (or that they are still unwritten)
    push("", t.bug, `**${t.bugRepro}**`, d.bug.reproduction || t.bugUnfilled, "", `**${t.bugRootCause}**`, d.bug.rootCause || t.bugUnfilled);
  }

  push("", t.acs);
  if (d.acceptanceCriteria.length) d.acceptanceCriteria.forEach((a) => push("- " + a.text));
  else push(t.acsNone);
  // 1.16 Q3: the glossary entries this task's text and criteria use (bounded) — the words to use, and the ones to avoid
  if ((d.glossary || []).length) {
    const Q = MSG[normalizeLang(lang)].quality;
    push("", Q.briefGlossaryHeading, Q.briefGlossaryIntro);
    d.glossary.forEach((g) => push(`- **${g.term}**${g.definition ? " — " + g.definition : ""}${g.avoid.length ? ` _(${Q.briefGlossaryAvoid(g.avoid.join(", "))})_` : ""}`));
    if ((d.glossaryOmitted || []).length) push(Q.briefGlossaryOmitted(d.glossaryOmitted.join(", ")));
  }

  if (d.tests.length) {
    push("", d.expectFail ? t.testsRed : t.tests); // full review Ga7: a red task writes the tests; it never makes them green
    let lastHeader;
    for (const r of d.tests) {
      if (r.header && r.header !== lastHeader) {
        push(r.header, r.sep || r.header.replace(/[^|]/g, "-"));
        lastHeader = r.header;
      } else if (!r.header) lastHeader = undefined;
      push(r.row);
    }
  }
  if (d.evals.length) push("", t.evals, ...d.evals.map((e) => "- " + e));
  if (d.metrics.length) push("", t.metrics, ...d.metrics.map((m) => "- `" + m + "`"));
  if (d.implements.length) push("", t.files, ...d.implements.map((f) => "- `" + f + "`"));
  const verify = d.verify || [];
  if (verify.length) push("", t.verification, ...verify.map((c) => "- `" + c + "`"));
  if ((d.verifyPipes || []).length) push("", MSG[normalizeLang(lang)].verifyPipe.brief(d.verifyPipes));
  // B5: _Expect: fail_ — the Verification section says the run must fail (the heading too when the task has no _Verify:_)
  if (d.expectFail) push(...(verify.length ? [] : ["", t.verification]), "", MSG[normalizeLang(lang)].redGreen.briefExpect);

  if (d.design.toc.length) {
    push("", t.design, t.designToc(d.design.path) + " " + d.design.toc.join(" · "));
    d.design.included.forEach((s) => push("", "### " + s.title, s.body));
    if (d.design.omitted.length) push("", t.designOmitted + " " + d.design.omitted.join(" · "));
  }
  // 1.14 C2: the decisions.md entries that cite this task's ACs / T-IDs (bounded; superseded ones left out)
  if ((d.decisions || []).length) {
    const D = MSG[normalizeLang(lang)].decisions;
    push("", D.briefHeading, D.briefIntro);
    d.decisions.forEach((x) => push(`- **${x.id}** — ${x.title} _(${[D.kinds[x.kind] || x.kind, x.affects.join(", "), x.supersedes.length ? D.supersedesNote(x.supersedes.join(", ")) : ""].filter(Boolean).join(" · ")})_` + (x.text ? ": " + x.text : "")));
    if ((d.decisionsOmitted || []).length) push(D.briefOmitted(d.decisionsOmitted.join(", ")));
  }

  const constraints = d.globalConstraints || [];
  const scoped = d.steeringScoped || []; // fileMatch steering matching this task's files, quoted (front matter stripped)
  const manual = d.steeringManual || [];
  if (constraints.length || d.steering.length || manual.length) {
    push("", t.steering);
    if (constraints.length) push(t.constraintsIntro, ...constraints);
    if (constraints.length && d.steering.length) push("");
    if (d.steering.length) push(t.steeringRead + " " + d.steering.map((p) => "`" + p + "`").join(", "));
    const S = MSG[normalizeLang(lang)].scopedSteering;
    // Quoted as a blockquote: the file's own headings can't break the brief's outline.
    if (scoped.length) push("", S.scoped);
    scoped.forEach((s) => push("", `**\`${s.path}\`** (fileMatch: ${s.patterns.map((p) => "`" + p + "`").join(", ")})`, ...s.body.split(/\r?\n/).map((l) => (l ? "> " + l : ">"))));
    if (manual.length) push("", S.manual + " " + manual.map((p) => "`" + p + "`").join(", "));
  }

  if (d.unresolved.acs.length || d.unresolved.tests.length) {
    push("", t.unresolved, t.unresolvedNote, ...[...d.unresolved.acs, ...d.unresolved.tests].map((id) => "- " + id));
  }

  // full review Ga7: an _Expect: fail_ task's definition of done is the red task's (write the test, it must FAIL for the right
  // reason, no production code) — the loop's "make the target tests green" / "nothing that passed may fail" contradicted it.
  const rules = d.expectFail ? t.redRules : t.loopRules[d.loop];
  push("", t.dod, ...rules.map((r, i) => `${i + 1}. ${r}`));
  let extra = rules.length;
  if (d.metrics.length) push(`${++extra}. ${t.metricsRule}`);
  if (d.evals.length && d.loop !== "ai-prompt") push(`${++extra}. ${t.evalsRule}`);
  if (verify.length) push(`${++extra}. ${t.verifyRule}`);
  const B5 = MSG[normalizeLang(lang)]; // B5: the red run, then the project checks (roadmap.json meta.checks)
  if (d.expectFail) push(`${++extra}. ${B5.redGreen.dodExpect}`);
  if ((d.projectChecks || []).length) push(`${++extra}. ${B5.projectChecks[d.expectFail ? "briefDodRed" : "briefDod"](d.projectChecks.map((c) => "`" + c.command + "` (" + c.name + ")").join(" · "))}`);
  if (task.checkpoint) push("", t.checkpoint, "**Checkpoint:** " + task.checkpoint);

  push("", t.report, t.reportTo(d.reportPath), "");
  return out.join("\n");
}

// ===========================================================================
// pt-BR — Brazilian Portuguese as a DERIVED locale (1.14 D1). `pt` stays European Portuguese (the default for pt /
// pt-PT); every pt-BR string is toPtBr(the pt string), so a pt template or message edit reaches pt-BR with nothing else
// to change. toPtBr, in order:
//   0. protect what is never prose — code spans, `_Marker: …_` tokens, URLs, CLI flags, paths / file names, {json}
//      snippets — and, for a derived FUNCTION, the caller's own argument strings (feature names, paths, user text); then
//      PTBR_OVERRIDES: European sentences the rules get wrong, replaced by a hand-written Brazilian one (never re-read);
//   1. the European progressive "está a correr" → "está rodando" (PTBR_GERUND: a + infinitive after a noun, estar,
//      ficar, continuar — never after voltar a / passar a / começar a / nada a / para a);
//   2. PTBR_PHRASES — multi-word vocabulary ("por defeito" → "por padrão", "em curso" → "em andamento", "base de dados"
//      → "banco de dados") and the "põe X a verde" → "faz X passar" family;
//   3. the second person: tu verbs → você ("tens" → "você tem", "se não souberes" → "se você não souber"), "não
//      alteres" → "não altere", "o teu" → "seu", "contigo" → "com você" (PTBR_YOU, PTBR_YOU_SUBJ);
//   4. PTBR_IMPERATIVES — the tu imperative → the você imperative ("corre" → "execute", "revê" → "revise"), ONLY where a
//      clause starts (a line / list item, after . : ; — → ( [ , after "e" / "ou" / "," chained to an imperative, after a
//      "Se …," intro) — the same form mid-sentence is the 3rd person ("o hook corre" → "o hook roda", word map);
//   5. PTBR_WORDS — single words: vocabulary (utilizador → usuário, ficheiro → arquivo, ecrã → tela, equipa → equipe,
//      registo → registro…) and spelling (secção → seção, facto → fato, deteção → detecção, autónomo → autônomo…).
// Whole words only (unicode boundaries — never inside an identifier, a path or a compound's second half), case kept
// (Utilizador → Usuário, UTILIZADOR → USUÁRIO). No rule's output is another rule's key, so toPtBr is idempotent and a
// Brazilian string passes through unchanged. English-stable tokens (IDs, [SaaS]/[AI] markers, [NEEDS CLARIFICATION],
// `> **TODO**`, **Checkpoint:**, _Marker:_ tags, EARS keywords, commands, paths) hold no Portuguese key: they come out
// byte-identical (mcp/test.js lints every pt-BR string for both). Known limits: GDPR vocabulary stays GDPR (no LGPD
// mapping — the +privacy track cites GDPR articles), "pedido" (request) is kept, and the imperative rule can only see a
// clause start — an imperative in the middle of a sentence is left as the European form.
// WHEN YOU ADD OR EDIT A pt STRING, read its Brazilian twin once: node -e "console.log(require('./mcp/lib/i18n.js').toPtBr('…'))".
// A clause-start 3rd person read as an order ("— liberta o nome" → "libere") goes into RE_PTBR_NOT_IMPERATIVE; a word the
// maps miss into PTBR_WORDS / PTBR_PHRASES; anything else into PTBR_OVERRIDES. mcp/test.js (pD1) lints every string.
// ===========================================================================
const PTBR_KEEP = "\uE000", PTBR_END = "\uE001"; // private-use sentinels around a protected segment's index
const PTBR_W = "\\p{L}\\p{N}_"; // word characters

// 0. Exact European fragments the rules would get wrong → Brazilian (case-sensitive, applied first, then protected).
const PTBR_OVERRIDES = [
  // +dist (1.17 D): a race condition is a "condição de corrida" in Brazil too — never the "corrida" (a run) → "executada" rule
  ["Condições de corrida", "Condições de corrida"], ["condições de corrida", "condições de corrida"], ["condição de corrida", "condição de corrida"],
  ["caminho/ficheiro.test.js", "caminho/arquivo.test.js"], // an example path inside a _Verify:_ placeholder
  ["<ficheiro>", "<arquivo>"], ["<artefacto>", "<artefato>"], // placeholders inside a path / URI
  ["Põe-no a falhar", "Faça-o falhar"],
  [") e regista essa execução", ") e registre essa execução"],
  ["e regista a execução a falhar antes da correção", "e registre a execução falhando antes da correção"],
  ["Trabalha-o com", "Trabalhe nele com"],
  ["Muda-lhe o nome", "Renomeie-a"],
  ["antes de o arquivo registar a sua entrada", "antes de o arquivamento registrar sua entrada"],
  ["registos de arquivo", "registros de arquivamento"],
  ["registo de arquivo", "registro de arquivamento"],
  ["de casos de abuso a verde", "de casos de abuso passando"],
  ["O que correu bem", "O que deu certo"],
  ["decidas o que decidires, volta", "decida o que decidir, volte"],
  ["decidas o que decidires", "decida o que decidir"],
  // full review Pb7 — the LGPD's name for the DPIA (a masculine report) and its article; the heading stays matched by the
  // DPIA section's synonyms ("ripd").
  ["AIPD (quando obrigatória — art. 35.º)", "RIPD (quando obrigatório — LGPD art. 38)"],
  ["o controlador pára para revisão", "o controlador faz uma pausa para revisão"],
  ["— lê de outra forma", "— lê de outra forma"], // cmd.exe "reads it differently": a 3rd person after a parenthetical dash
  ["; aceita uma lista", "; aceita uma lista"], // a glob syntax note: "accepts a list"
];

// 1. The European progressive a + infinitive → the Brazilian gerund. correr = a process running → rodando.
const PTBR_GERUND = { correr: "rodando", ser: "sendo", ler: "lendo", ter: "tendo", ir: "indo", pôr: "pondo" };
const PTBR_GERUND_VERBS = new Set(["correr", "ser", "ler", "aguardar", "falhar", "explicar", "atualizar", "precisar", "funcionar", "dizer",
  "mostrar", "trabalhar", "usar", "processar", "executar", "gerar", "esperar", "crescer", "carregar", "escrever", "passar", "tentar",
  "pedir", "criar", "analisar", "bloquear", "responder", "rodar"]);
// "a" + infinitive after these is not a progressive: voltar a / passar a / começar a (aspect), nada a / mais a (to be
// done), para a / de a / sem a (a = the pronoun "it": "para a apagar").
const PTBR_GERUND_BLOCK = new Set(["volta", "voltam", "voltar", "volte", "voltem", "voltou", "voltaram", "voltares", "voltarem", "voltasse",
  "passa", "passam", "passar", "passe", "passou", "começa", "começam", "começar", "comece", "começou", "começaram", "torna", "tornam",
  "tornar", "nada", "mais", "para", "até", "de", "sem", "por", "após", "ajuda", "ajudam", "ajudar", "tende", "tendem", "chega", "chegam",
  "chegar", "obriga", "obrigam", "leva", "levam", "vai", "vão", "ir", "vá", "disposto", "disposta", "prestes", "pronto", "pronta",
  "prontos", "prontas", "igual", "pôr", "põe", "põem", "pondo", "ponha", "aprende", "aprender", "ensina", "custa", "custou", "que"]);

// 2. Multi-word vocabulary (whitespace-tolerant, case kept from the first letter).
const PTBR_PHRASES = {
  "por defeito": "por padrão", "por omissão": "por padrão", "shell por omissão": "shell padrão",
  "a shell por omissão": "o shell padrão", "da shell por omissão": "do shell padrão", "a shell": "o shell", "da shell": "do shell",
  "na shell": "no shell", "uma shell": "um shell", "pela shell": "pelo shell", "à shell": "ao shell", "numa shell": "em um shell",
  "base de dados": "banco de dados", "bases de dados": "bancos de dados", "a base de dados": "o banco de dados",
  "da base de dados": "do banco de dados", "na base de dados": "no banco de dados", "à base de dados": "ao banco de dados",
  "uma base de dados": "um banco de dados", "numa base de dados": "em um banco de dados", "pela base de dados": "pelo banco de dados",
  "cópias de segurança": "backups", "cópia de segurança": "backup",
  "em curso": "em andamento", "em falta": "faltando",
  // "por + infinitive" (not done yet): a state → "sem …" (unfilled, unresolved); a to-do → "a …"
  "por preencher": "sem preencher", "por resolver": "sem resolver", "por fechar": "sem fechar", "por correr": "sem executar",
  "por concluir": "sem concluir", "por verificar": "sem verificar", "por testar": "sem testar", "por validar": "sem validar",
  "por terminar": "sem terminar", "por escrever": "sem escrever", "por fazer": "a fazer", "por aprovar": "a aprovar",
  "por rever": "a revisar", "por marcar": "a marcar", "por começar": "a começar", "por tratar": "a tratar",
  "por implementar": "a implementar", "por decidir": "a decidir", "por responder": "a responder", "por migrar": "a migrar",
  "por cobrir": "a cobrir", "por confirmar": "a confirmar",
  "até ao": "até o", "até à": "até a", "até aos": "até os", "até às": "até as",
  "de seguida": "em seguida", "se calhar": "talvez", "à procura de": "procurando",
  "sistema operativo": "sistema operacional", "sistemas operativos": "sistemas operacionais", "correio eletrónico": "e-mail",
  "fora de âmbito": "fora do escopo", "fora do âmbito": "fora do escopo", "em âmbito": "no escopo",
  "é aceite": "é aceito", "for aceite": "for aceito", "foi aceite": "foi aceito", "seja aceite": "seja aceito", "ser aceite": "ser aceito",
  "correu bem": "deu certo", "correu mal": "deu errado", "corre bem": "dá certo", "corre mal": "dá errado",
  "pôr a passar": "fazer passar", "di-lo": "diga isso", "fá-lo": "faça isso",
  "efeitos secundários": "efeitos colaterais", "batem sempre certo": "sempre fecham", "porque se aplica": "por que se aplica",
  "porque importa": "por que importa", "porque é preciso": "por que é preciso", // the interrogative "why" is two words in Brazil
  // a word whose Brazilian twin changes gender takes its article along
  "a faturação": "o faturamento", "da faturação": "do faturamento", "na faturação": "no faturamento", "à faturação": "ao faturamento",
  "pela faturação": "pelo faturamento", "uma faturação": "um faturamento", "a monitorização": "o monitoramento",
  "da monitorização": "do monitoramento", "na monitorização": "no monitoramento", "à monitorização": "ao monitoramento",
  "pela monitorização": "pelo monitoramento", "uma monitorização": "um monitoramento", "o arranque": "a inicialização",
  "do arranque": "da inicialização", "no arranque": "na inicialização", "ao arranque": "à inicialização", "um arranque": "uma inicialização",
  "uma gralha": "um erro de digitação", "a gralha": "o erro de digitação", "as gralhas": "os erros de digitação",
  // full review Pb7 — "ter de" + infinitive is "ter que" in Brazil; enclisis after a verb reads European (mantém-se → se mantém,
  // lê-se como → é lido como); acessar takes a direct object (never "lhe pode acessar").
  "tem de": "tem que", "têm de": "têm que", "temos de": "temos que", "tenho de": "tenho que", "tens de": "tens que",
  "terá de": "terá que", "terão de": "terão que", "teria de": "teria que", "teriam de": "teriam que", "ter de": "ter que",
  "tinha de": "tinha que", "tenha de": "tenha que", "tenham de": "tenham que", "tiver de": "tiver que",
  "mantém-se": "se mantém", "mantêm-se": "se mantêm", "lê-se como": "é lido como", "quem lhe pode aceder": "quem pode acessá-lo",
  // LGPD vocabulary (full review Pb7): the processor is the "operador", the DPIA the RIPD (a masculine report) — the
  // section synonyms (spec.js PRIVACY_SECTIONS) read the Brazilian headings
  "subcontratantes ulteriores": "suboperadores", "conservação e eliminação": "retenção e eliminação",
  "a aipd": "o RIPD", "da aipd": "do RIPD", "na aipd": "no RIPD", "à aipd": "ao RIPD", "pela aipd": "pelo RIPD", "uma aipd": "um RIPD",
};
// "põe X a verde" (make X pass) → "faz X passar"; "postos a verde" → "deixados verdes"; a leftover "a verde" → "verde(s)".
const PTBR_GREEN_VERB = { põe: ["faz", "passar"], põem: ["fazem", "passar"], pôr: ["fazer", "passar"], pondo: ["fazendo", "passar"],
  ponha: ["faça", "passar"], posto: ["deixado", "verde"], posta: ["deixada", "verde"], postos: ["deixados", "verdes"], postas: ["deixadas", "verdes"] };

// 3. The second person. PTBR_YOU: the tu form → "você" + this form (preterite, future subjunctive, personal infinitive
// included); PTBR_YOU_SUBJ: the tu present subjunctive ("não alteres") → the você one, no pronoun.
const PTBR_YOU = {
  tens: "tem", queres: "quer", podes: "pode", estás: "está", és: "é", precisas: "precisa", sabes: "sabe", vês: "vê", fazes: "faz",
  deves: "deve", vais: "vai", consegues: "consegue", avanças: "avança", reportas: "reporta", usas: "usa", escreves: "escreve",
  corres: "executa", fizeste: "fez", pediste: "pediu", disseste: "disse", viste: "viu", quiseste: "quis", tiveste: "teve",
  criaste: "criou", correste: "executou", marcaste: "marcou", aprovaste: "aprovou", quiseres: "quiser", tiveres: "tiver",
  souberes: "souber", usares: "usar", voltares: "voltar", aceitares: "aceitar", decidires: "decidir", especificares: "especificar",
  puderes: "puder", fizeres: "fizer", precisares: "precisar", estiveres: "estiver", fores: "for", correres: "executar",
  escreveres: "escrever", escolheres: "escolher", preferires: "preferir", adicionares: "adicionar", mudares: "mudar",
  marcares: "marcar", aprovares: "aprovar", terminares: "terminar", abrires: "abrir", quererás: "quererá", validas: "valida",
};
const PTBR_YOU_SUBJ = {
  alteres: "altere", mudes: "mude", ponhas: "ponha", quebres: "quebre", refaças: "refaça", construas: "construa", decidas: "decida",
  delegues: "delegue", corras: "execute", apagues: "apague", edites: "edite", esqueças: "esqueça", marques: "marque", saltes: "pule",
  assumas: "assuma", escrevas: "escreva", faças: "faça", digas: "diga", tentes: "tente", deixes: "deixe", inventes: "invente",
  confies: "confie", adiciones: "adicione", aproves: "aprove", removas: "remova", voltes: "volte", precises: "precise",
  tenhas: "tenha", possas: "possa", queiras: "queira", sejas: "seja", estejas: "esteja", vás: "vá", ignores: "ignore",
  mexas: "mexa", toques: "toque", reescrevas: "reescreva", apresentes: "apresente", declares: "declare", afirmes: "afirme",
};
const PTBR_POSSESSIVE = { teu: "seu", tua: "sua", teus: "seus", tuas: "suas" };

// 4. The tu imperative → the você imperative (a clause start only; see ptbrImperatives).
const PTBR_IMPERATIVES = {
  volta: "volte", corre: "execute", revê: "revise", mantém: "mantenha", aprova: "aprove", marca: "marque", põe: "coloque",
  regista: "registre", passa: "passe", confirma: "confirme", especifica: "especifique", escreve: "escreva", indica: "indique",
  tira: "tire", usa: "use", corrige: "corrija", escolhe: "escolha", tenta: "tente", quantifica: "quantifique", apaga: "apague",
  aponta: "aponte", declara: "declare", acrescenta: "acrescente", liga: "ligue", desliga: "desligue", arquiva: "arquive",
  restaura: "restaure", dá: "dê", substitui: "substitua", lê: "leia", verifica: "verifique", justifica: "justifique",
  recorre: "recorra", respeita: "respeite", preenche: "preencha", decide: "decida", faz: "faça", ordena: "ordene", segue: "siga",
  evita: "evite", divide: "divida", atualiza: "atualize", vê: "veja", valida: "valide", liberta: "libere", responde: "responda",
  implementa: "implemente", aceita: "aceite", lista: "liste", trabalha: "trabalhe", arranca: "inicie", planeia: "planeje", começa: "comece", cria: "crie", remove: "remova",
  resolve: "resolva", encontra: "encontre", refaz: "refaça", cita: "cite", retoma: "retome", investiga: "investigue", muda: "mude",
  fecha: "feche", adiciona: "adicione", renumera: "renumere", abre: "abra", define: "defina", copia: "copie", renomeia: "renomeie",
  edita: "edite", move: "mova", pede: "peça", nomeia: "nomeie", avisa: "avise", prolonga: "prolongue", age: "aja",
  considera: "considere", termina: "termine", experimenta: "experimente", refatora: "refatore", mostra: "mostre", melhora: "melhore",
  otimiza: "otimize", sinaliza: "sinalize", cobre: "cubra", recusa: "recuse", cola: "cole", imprime: "imprima", diz: "diga",
  guarda: "salve", sê: "seja", pára: "pare", inclui: "inclua", exporta: "exporte", importa: "importe", prioriza: "priorize",
  separa: "separe", junta: "junte", mapeia: "mapeie", agrupa: "agrupe", testa: "teste", reproduz: "reproduza", descreve: "descreva",
  anota: "anote", documenta: "documente", reabre: "reabra", desmarca: "desmarque", deixa: "deixe", espera: "espere", chama: "chame",
  repõe: "restaure", recolhe: "colete", partilha: "compartilhe", instala: "instale", configura: "configure", gera: "gere",
  migra: "migre", ignora: "ignore", trata: "trate", mede: "meça", envia: "envie", integra: "integre", isola: "isole", injeta: "injete",
  fixa: "fixe", avalia: "avalie", afina: "ajuste", analisa: "analise", compara: "compare", emite: "emita", torna: "torne",
  garante: "garanta", assegura: "assegure", assinala: "sinalize", lembra: "lembre", procura: "procure", repete: "repita",
  traz: "traga", pensa: "pense", prepara: "prepare", publica: "publique", reverte: "reverta", desfaz: "desfaça", avança: "avance",
  inicia: "inicie", conclui: "conclua", preserva: "preserve", protege: "proteja", retira: "retire", redige: "redija",
  elimina: "elimine", exclui: "exclua", reporta: "reporte", anexa: "anexe", clica: "clique", reaprova: "reaprove", prefere: "prefira",
  aplica: "aplique", acaba: "acabe", regenera: "regenere", corta: "corte", limita: "limite", reduz: "reduza", explica: "explique",
  comenta: "comente", pega: "pegue", confia: "confie", assume: "assuma", delega: "delegue", estima: "estime", calcula: "calcule",
  obtém: "obtenha", ouve: "ouça", cumpre: "cumpra",
};
// After these at a clause start, the next word starts the clause too ("depois corre", "(ou usa …)").
const RE_PTBR_LEADIN = /^(?:(?:e|ou|mas|depois|primeiro|então|agora|senão|finalmente|antes|em seguida|a seguir|por fim|por favor|no fim|no final|por isso|assim|de novo)(?![\p{L}\p{N}_])[ \t]*,?|(?:se não|caso contrário)[ \t]*,)[ \t]+/iu;
// A subordinate intro: the main clause (often an imperative) starts after its comma ("Se o teste falhar, corrige-o").
const RE_PTBR_INTRO = /^(?:se|quando|para|antes de|depois de|enquanto|caso|assim que|logo que|sem|até|após|ao|uma vez que|sempre que)(?![\p{L}\p{N}_])/iu;
// Where the chain of coordinated imperatives stops: a relative / subordinate word ("corre X, que verifica …").
const PTBR_CHAIN_STOP = new Set(["que", "onde", "quando", "porque", "pois", "como", "enquanto", "cujo", "cuja", "cujos", "cujas", "se", "quem"]);
// A clause-start verb read as the 3rd person after all (a description, not an instruction): never an imperative here.
const RE_PTBR_NOT_IMPERATIVE = [
  /^passam?[ \t]+a[ \t]+\p{L}+(?:ar|er|ir|ôr)(?![\p{L}])/iu, // "— passa a contar como…" (starts to): aspect, 3rd person
  /^[\p{L}]+[ \t]*\|/iu, // a literal value list: "remove | archive | rename"
  /^cita IDs de AC/iu, // a template check: "(the template) cites AC IDs…"
  /^faz passar IDs de teste/iu, // "(the template) makes test IDs green…"
  /^liberta o nome/iu, // "(archiving) frees the name"
  /^reproduz o bug(?![\p{L}])/iu, // a test's description: "T-01 — reproduces the bug: …"
  /^cumpre[ \t]*(?:\n|$)/iu, // the Constitution Check's status: "[Principle 1] — complies"
  /^lista[ \t]+(?:de|dos|das|do|da)(?![\p{L}])/iu, // the noun: "Lista de recursos…"
  /^planeia (?:os mesmos|ficheiros|\uE000)/iu, // a doctor overlap line: "(this feature) plans the same files as …"
];
// Where a clause starts: a line (after its list marker / checkbox / number / [tags] / bold), after . ! ? : ; — – → ( “ «.
const RE_PTBR_CLAUSE = /(?:^|\n)[ \t]*(?:>[ \t]*)*(?:(?:[-*+•]|\d+[.)])[ \t]+)?(?:\[[ xX]\][ \t]+)?(?:\d+[.)][ \t]+)?(?:\[(?:US\d+|P|shared|SaaS|AI|SEC|PRIVACY)\][ \t]*)*(?:\*\*|__)?[ \t]*|[.!?…][ \t]+(?:\*\*|__)?|[:;][ \t]+|[—–→⇒][ \t]*|[([][ \t]*|[“«][ \t]*/g;

// 5. Single words (a key may carry a hyphen: palavra-passe). Verb forms not listed keep their spelling (it is shared).
const PTBR_WORDS = {
  atómico: "atômico", atómica: "atômica", atómicos: "atômicos", atómicas: "atômicas", // +dist (1.17 D)
  utilizador: "usuário", utilizadores: "usuários", utilizadora: "usuária", utilizadoras: "usuárias", utente: "usuário", utentes: "usuários",
  ficheiro: "arquivo", ficheiros: "arquivos", ecrã: "tela", ecrãs: "telas", equipa: "equipe", equipas: "equipes",
  "palavra-passe": "senha", "palavras-passe": "senhas", telemóvel: "celular", telemóveis: "celulares",
  registo: "registro", registos: "registros", registar: "registrar", regista: "registra", registam: "registram", registou: "registrou",
  registaram: "registraram", registado: "registrado", registada: "registrada", registados: "registrados", registadas: "registradas",
  registe: "registre", registem: "registrem", registando: "registrando", registará: "registrará", registaria: "registraria",
  "registá-lo": "registrá-lo", "registá-la": "registrá-la", "registá-los": "registrá-los", "registá-las": "registrá-las",
  facto: "fato", factos: "fatos", contacto: "contato", contactos: "contatos", contactar: "contatar", contacte: "contate",
  secção: "seção", secções: "seções", receção: "recepção", receções: "recepções", perceção: "percepção", perceções: "percepções",
  conceção: "concepção", conceções: "concepções", deteção: "detecção", deteções: "detecções", detetar: "detectar", deteta: "detecta",
  detetam: "detectam", detetamos: "detectamos", detetado: "detectado", detetada: "detectada", detetados: "detectados", detetadas: "detectadas", detetou: "detectou",
  detete: "detecte", detetável: "detectável", artefacto: "artefato", artefactos: "artefatos", controlo: "controle", controlos: "controles",
  respetivo: "respectivo", respetiva: "respectiva", respetivos: "respectivos", respetivas: "respectivas", retrospetiva: "retrospectiva",
  retrospetivas: "retrospectivas", perspetiva: "perspectiva", perspetivas: "perspectivas", aspeto: "aspecto", aspetos: "aspectos",
  espetro: "espectro", fiável: "confiável", fiáveis: "confiáveis", fiabilidade: "confiabilidade", gralha: "erro de digitação",
  gralhas: "erros de digitação", plicas: "aspas simples", planear: "planejar", planeado: "planejado", planeada: "planejada",
  planeados: "planejados", planeadas: "planejadas", planeamento: "planejamento", planeia: "planeja", planeiam: "planejam",
  planeie: "planeje", planeiem: "planejem", planeou: "planejou", cifragem: "criptografia", monitorização: "monitoramento",
  faturação: "faturamento", rastreio: "rastreamento", rastreios: "rastreamentos", aceder: "acessar", acede: "acessa", acedem: "acessam",
  acedido: "acessado", acedida: "acessada", partilhar: "compartilhar", partilha: "compartilha", partilham: "compartilham",
  partilhado: "compartilhado", partilhada: "compartilhada", partilhados: "compartilhados", partilhadas: "compartilhadas",
  recolher: "coletar", recolha: "coleta", recolhe: "coleta", recolhido: "coletado", recolhida: "coletada", recolhidos: "coletados",
  recolhidas: "coletadas", arrancar: "iniciar", arranca: "inicia", arranque: "inicialização", libertar: "liberar", liberta: "libera",
  libertado: "liberado", libertada: "liberada", assinalar: "sinalizar", assinala: "sinaliza", assinalam: "sinalizam",
  assinalado: "sinalizado", assinalada: "sinalizada", assinalados: "sinalizados", assinaladas: "sinalizadas", assinale: "sinalize",
  descodificar: "decodificar", descodifica: "decodifica", descodificado: "decodificado", guardar: "salvar", guardou: "salvou",
  guardado: "armazenado", guardada: "armazenada", guardados: "armazenados", guardadas: "armazenadas", "guarda-o": "armazena-o",
  "guarda-a": "armazena-a", "guarda-os": "armazena-os", "guarda-as": "armazena-as", fornecedor: "provedor", fornecedores: "provedores",
  gerir: "gerenciar", gerido: "gerenciado", gerida: "gerenciada", geridos: "gerenciados", geridas: "gerenciadas",
  pormenor: "detalhe", pormenores: "detalhes", pormenorizado: "detalhado", pormenorizada: "detalhada", percentagem: "porcentagem",
  percentagens: "porcentagens", descarregar: "baixar", descarregado: "baixado", subscrição: "assinatura", subscrições: "assinaturas",
  correr: "executar", corre: "roda", correm: "rodam", correu: "rodou", correram: "rodaram", corrido: "executado", corrida: "executada",
  corridos: "executados", corridas: "executadas", correria: "executaria", correriam: "executariam", "corrê-lo": "executá-lo",
  "corrê-la": "executá-la", "corrê-los": "executá-los", "corrê-las": "executá-las", pára: "para", sítio: "lugar", aceites: "aceitos",
  demasiado: "demais", "semi-autónomo": "semiautônomo", autónomo: "autônomo", autónoma: "autônoma", autónomos: "autônomos",
  autónomas: "autônomas", anónimo: "anônimo", anónima: "anônima", anónimos: "anônimos", anónimas: "anônimas", económico: "econômico",
  económica: "econômica", económicos: "econômicos", económicas: "econômicas", fenómeno: "fenômeno", fenómenos: "fenômenos",
  sinónimo: "sinônimo", sinónimos: "sinônimos", polémico: "polêmico", polémica: "polêmica", académico: "acadêmico", académica: "acadêmica",
  género: "gênero", géneros: "gêneros", prémio: "prêmio", prémios: "prêmios", ónus: "ônus", efémero: "efêmero", efémera: "efêmera",
  eletrónico: "eletrônico", eletrónica: "eletrônica", eletrónicos: "eletrônicos", eletrónicas: "eletrônicas", bebé: "bebê",
  treino: "treinamento", treinos: "treinamentos", afinar: "ajustar", afinado: "ajustado", afinada: "ajustada", guião: "roteiro",
  guiões: "roteiros", stock: "estoque", âmbito: "escopo", contigo: "com você", tu: "você",
  num: "em um", numa: "em uma", nuns: "em uns", numas: "em umas", noutro: "em outro", noutra: "em outra", noutros: "em outros",
  noutras: "em outras", nalgum: "em algum", nalguma: "em alguma", nalguns: "em alguns", nalgumas: "em algumas", dum: "de um",
  duma: "de uma", duns: "de uns", dumas: "de umas", doutro: "de outro", doutra: "de outra", doutros: "de outros", doutras: "de outras",
  // full review Pb7 — LGPD / Brazilian SaaS vocabulary (the section synonyms in spec.js read these headings)
  "multi-inquilino": "multilocatário", subcontratante: "operador", subcontratantes: "operadores", aipd: "RIPD",
};

function ptbrEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// Case of the source kept on the replacement: ALL CAPS, Capitalized or as written.
function ptbrCase(src, out) {
  const upper = (x) => x.length > 1 && x === x.toUpperCase() && x !== x.toLowerCase();
  const letters = src.replace(/[^\p{L}]/gu, "");
  if (upper(letters)) return out.toUpperCase();
  const first = (src.match(/^[\p{L}]+/u) || [""])[0];
  if (upper(first)) return out.replace(/^[\p{L}]+/u, (w) => w.toUpperCase()); // "FORA de âmbito" → "FORA do escopo"
  const cap = (w) => w.charAt(0) !== w.charAt(0).toLowerCase();
  const big = (src.match(/[\p{L}]+/gu) || []).filter((w) => w.length > 3);
  if (big.length > 1 && big.every(cap)) return out.replace(/[\p{L}]+/gu, (w) => (w.length > 3 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).replace(/^./u, (c) => c.toUpperCase()); // "Base de Dados" → "Banco de Dados"
  const c0 = src.charAt(0);
  return c0 !== c0.toLowerCase() ? out.charAt(0).toUpperCase() + out.slice(1) : out;
}
// A whole-word alternation over `keys` (longest first; a space in a key matches any run of blanks). Never inside an
// identifier, a path, a flag or a compound's second half; a following hyphen is allowed (utilizadores-alvo, regista-o).
function ptbrWordRe(keys) {
  const alt = [...keys].sort((a, b) => b.length - a.length).map((k) => ptbrEscape(k).replace(/ /g, "[ \\t\\u00a0]+")).join("|");
  return new RegExp(`(?<![${PTBR_W}\\-.\\\\@#$])(?:${alt})(?![${PTBR_W}])`, "giu"); // "auth/faturação/dados" is prose; paths are protected
}
const ptbrKey = (m) => m.toLowerCase().replace(/[ \t\u00a0]+/g, " ");
let PTBR_RE = null; // compiled once, on the first pt-BR string
function ptbrRes() {
  if (PTBR_RE) return PTBR_RE;
  return (PTBR_RE = {
    phrases: ptbrWordRe(Object.keys(PTBR_PHRASES)),
    words: ptbrWordRe(Object.keys(PTBR_WORDS)),
    you: new RegExp(`(?<![${PTBR_W}\\-])((?:(?:tu|não|nunca|já|ainda|também|só|sempre|mesmo|o|a|os|as|lhe|lhes|me|nos)[ \\t]+){0,3})(${Object.keys(PTBR_YOU).map(ptbrEscape).join("|")})(?![${PTBR_W}\\-])`, "giu"),
    subj: ptbrWordRe(Object.keys(PTBR_YOU_SUBJ)),
    poss: new RegExp(`(?<![${PTBR_W}\\-])(?:(o|a|os|as)[ \\t]+)?(teu|tua|teus|tuas)(?![${PTBR_W}\\-])`, "giu"),
    gerund: new RegExp(`(?<![${PTBR_W}\\-])(a)[ \\t]+(${[...PTBR_GERUND_VERBS].map(ptbrEscape).join("|")})(?![${PTBR_W}\\-])`, "giu"),
    green: new RegExp(`(?<![${PTBR_W}\\-])(${Object.keys(PTBR_GREEN_VERB).join("|")})[ \\t]+((?:[^\\s.,;:!?—]+[ \\t]+){0,4}?)a[ \\t]+verde(?![${PTBR_W}])`, "giu"),
    greenLeft: new RegExp(`(?<![${PTBR_W}\\-])(?:([\\p{L}-]*[sS])[ \\t]+)?a[ \\t]+(verde|vermelho)(?![${PTBR_W}])`, "gu"),
    onDate: new RegExp(`(?<![${PTBR_W}\\-])(fechad[oa]s?|criad[oa]s?|gerad[oa]s?|arquivad[oa]s?|terminou|terminad[oa]|pelo dev-spec)[ \\t]+a[ \\t]+(?=${PTBR_KEEP}|\\d{4}-\\d{2}-\\d{2})`, "giu"), // a masked arg or an ISO date
    tooMuch: new RegExp(`(?<![${PTBR_W}\\-])demasiad(o|a|os|as)[ \\t]+([\\p{L}]+)(?![${PTBR_W}\\-])`, "giu"),
    why: new RegExp(`(?<![${PTBR_W}\\-])(o[ \\t]+)?(porquê)(?![${PTBR_W}])([ \\t]*)(?=([\\p{L}\\[]?))`, "giu"),
  });
}

// Every whole-word occurrence of an argument string replaced by hold(m) — a boundary only where its edge is a word
// character. A plain indexOf walk: one regex per argument would be compiled on every call.
const RE_PTBR_WORDCHAR = /[\p{L}\p{N}_]/u;
function ptbrMaskAll(s, m, hold) {
  const edgeL = RE_PTBR_WORDCHAR.test(m[0]), edgeR = RE_PTBR_WORDCHAR.test(m[m.length - 1]);
  let out = "", from = 0, i, token = null;
  while ((i = s.indexOf(m, from)) >= 0) {
    const okL = !edgeL || i === 0 || !RE_PTBR_WORDCHAR.test(s[i - 1]);
    const okR = !edgeR || i + m.length >= s.length || !RE_PTBR_WORDCHAR.test(s[i + m.length]);
    if (okL && okR) { out += s.slice(from, i) + (token || (token = hold(m))); from = i + m.length; } else { out += s.slice(from, i + 1); from = i + 1; }
  }
  return token ? out + s.slice(from) : s;
}
// Stage 0 — protect what is never prose, and the caller's argument strings, behind sentinels (restored at the end).
function ptbrProtect(text, masks, store) {
  const hold = (seg) => PTBR_KEEP + (store.push(seg) - 1) + PTBR_END;
  let s = text;
  for (const m of masks) if (s.includes(m)) s = ptbrMaskAll(s, m, hold); // whole words: a track 'sec' never masks "secção"
  for (const [eu, br] of PTBR_OVERRIDES) if (s.includes(eu)) s = s.split(eu).join(hold(br));
  return s
    .replace(/``[^\n]*?``|`[^`\n]+`/g, hold) // code spans
    .replace(/_[A-Z][A-Za-z]*(?: [a-z]+)?:[^_\n]*_/g, hold) // _Requirements: …_ · _Makes green: …_ · _Verify:_
    .replace(/https?:\/\/[^\s)>\]]+/g, hold)
    .replace(/(?<![\p{L}\p{N}_])(?:confirm|write|apply|force|remove|reopen|html|guard|stopCheck|includeBrief|code|deep|run): (?:true|false|null)(?![\p{L}\p{N}_])/gu, hold) // confirm: true
    .replace(/\{[^{}\n]*(?:\{[^{}\n]*\}[^{}\n]*)*\}/g, hold) // {json} / {{var}}
    .replace(/(?<![\p{L}\p{N}_-])--?[A-Za-z][\w-]*(?:=[^\s,;)]*)?/gu, hold) // --flags
    .replace(/(?<![\p{L}\p{N}_.\/-])(?:\.{0,2}\/|~\/|\.(?=[\w-]+\/))[^\s,;)'"`\]]*/gu, hold) // /commands, ./paths, .specs/…
    .replace(/[\w.\/<>*-]+/g, (run) => { // file names: a run up to its LAST "<name>.<ext>" (tasks.md, src/a.test.js)
      const end = ptbrFileEnd(run);
      return end ? hold(run.slice(0, end)) + run.slice(end) : run;
    });
}
// Where a run of path characters stops being a file name: the end of its last "x.<ext>" not followed by a word character, or 0.
// One overlapping scan of the run — the pattern /[\w.\/<>*-]*[\w>*-]\.(?:md|…)/ it replaces backtracked over the whole run from
// every start: quadratic ("a" × 40 000 took a second — full review Pb6). Same matches: a run holds at most one, from its start.
const RE_PTBR_FILE_EXT = /[\w>*-]\.(?:md|json|jsonl|js|mjs|cjs|ts|tsx|jsx|py|sh|ps1|cmd|bat|html|yml|yaml|toml|txt|lock|exe|gitignore)(?![\w])/g;
function ptbrFileEnd(run) {
  let end = 0, m;
  RE_PTBR_FILE_EXT.lastIndex = 0;
  while ((m = RE_PTBR_FILE_EXT.exec(run))) { end = m.index + m[0].length; RE_PTBR_FILE_EXT.lastIndex = m.index + 1; }
  return end;
}
function ptbrRestore(s, store) {
  let out = s, prev;
  // Nested holds (a masked arg inside a code span\u2026) take a few passes; never more than the stages that can nest.
  let pass = 0;
  do { prev = out; out = out.replace(/\uE000(\d+)\uE001/g, (m, i) => (+i < store.length ? store[+i] : m)); } while (out !== prev && out.includes(PTBR_KEEP) && ++pass < 12);
  return out;
}
// The word before offset `i` (lower-case), or "".
function ptbrPrevWord(s, i) {
  const m = s.slice(Math.max(0, i - 60), i).match(/([\p{L}]+)[ \t]*$/u);
  return m ? m[1].toLowerCase() : "";
}

// Stage 4 — imperatives at clause starts (and the coordinated ones chained to them).
function ptbrImperatives(s) {
  const hits = new Map(); // offset → [length, replacement]
  const wordAt = (p) => {
    const m = s.slice(p).match(/^([\p{L}]+)(-(?:o|a|os|as|no|na|nos|nas|lhe|lhes|me))?(?![\p{L}\p{N}_-])/u);
    return m ? { word: m[1], clitic: m[2] || "", len: m[0].length } : null;
  };
  const take = (p) => {
    const w = wordAt(p);
    if (!w) return null;
    const key = w.word.toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(PTBR_IMPERATIVES, key)) return null;
    const rest = s.slice(p);
    if (RE_PTBR_NOT_IMPERATIVE.some((re) => re.test(rest))) return null;
    // A clitic after a nasal ending (põe-no, mantém-nos) is -o/-a in the Brazilian form (coloque-o, mantenha-os).
    const clitic = /[ãõ]e$|[ée]m$/u.test(key) ? w.clitic.replace(/^-n/, "-") : w.clitic;
    hits.set(p, [w.len, ptbrCase(w.word, PTBR_IMPERATIVES[key]) + clitic]);
    return p + w.len;
  };
  const sentenceEnd = (p) => {
    const m = s.slice(p).search(/[.!?;\n]|[—–→][ \t]/);
    return m < 0 ? s.length : p + m;
  };
  // The coordinated imperatives of one sentence: after "," / "e" / "ou" (/ "e depois"), up to the sentence's end (. ! ? ; :
  // a line, a top-level dash). A parenthesis is skipped whole; a relative / subordinate word ("que", "onde", "se"…) holds
  // the chain until the next comma — "o que" ("what") and "aquilo que" never do ("vê o que mudou e volta a aprovar").
  const chain = (from) => {
    const re = /[\p{L}]+(?:-(?:o|a|os|as|no|na|nos|nas|lhe|lhes|me))?|[()]|[.!?;:\n]|[—–→]|,/gu;
    re.lastIndex = from;
    let m, depth = 0, held = false, joined = false, prev = "";
    while ((m = re.exec(s))) {
      const t = m[0];
      if (t === "(") { depth++; continue; }
      if (t === ")") { if (depth) depth--; continue; }
      if (depth) continue;
      if (/^[.!?;:\n—–→]$/u.test(t)) return;
      if (t === ",") { held = false; joined = true; continue; }
      const w = t.toLowerCase();
      if (w === "e" || w === "ou" || (w === "depois" && joined)) { joined = true; prev = w; continue; }
      if (PTBR_CHAIN_STOP.has(w) && !(w === "que" && (prev === "o" || prev === "aquilo"))) { held = true; joined = false; prev = w; continue; }
      if (joined && !held) {
        const after = take(m.index);
        if (after != null) { re.lastIndex = after; joined = false; prev = w; continue; }
      }
      joined = false;
      prev = w;
    }
  };
  const visit = (p, depth) => {
    while (p < s.length && /[ \t]/.test(s[p])) p++;
    if (depth > 3 || p >= s.length) return;
    const rest = s.slice(p, p + 200);
    if (RE_PTBR_INTRO.test(rest)) { // before the lead-ins: "Depois de aprovar, corre" is an intro, "Depois corre" a lead-in
      const end = sentenceEnd(p);
      const comma = s.slice(p, end).indexOf(",");
      if (comma >= 0) visit(p + comma + 1, depth + 1);
      return;
    }
    const lead = rest.match(RE_PTBR_LEADIN);
    if (lead) return visit(p + lead[0].length, depth + 1);
    const after = take(p);
    if (after != null) chain(after);
  };
  RE_PTBR_CLAUSE.lastIndex = 0;
  let m;
  while ((m = RE_PTBR_CLAUSE.exec(s))) {
    visit(m.index + m[0].length, 0);
    if (m[0].length === 0) RE_PTBR_CLAUSE.lastIndex++;
  }
  if (!hits.size) return s;
  let out = "", last = 0;
  for (const p of [...hits.keys()].sort((a, b) => a - b)) {
    if (p < last) continue;
    const [len, rep] = hits.get(p);
    out += s.slice(last, p) + rep;
    last = p + len;
  }
  return out + s.slice(last);
}

// European Portuguese → Brazilian Portuguese. masks: strings to leave exactly as they are (a derived function's args).
function toPtBr(text, masks) {
  if (typeof text !== "string" || !text) return text;
  // The private-use sentinels are the transform's own: a text that already holds one (a planted "0" in a task
  // line or a path) is left as it is — restoring it expanded the string twice per pass until the heap ran out.
  if (text.includes(PTBR_KEEP) || text.includes(PTBR_END)) return text;
  const R = ptbrRes();
  const store = [];
  let s = ptbrProtect(text, masks || [], store);
  // 1. progressive
  s = s.replace(R.gerund, (m, a, verb, off) => {
    if (PTBR_GERUND_BLOCK.has(ptbrPrevWord(s, off))) return m;
    const v = verb.toLowerCase();
    const g = PTBR_GERUND[v] || v.replace(/ar$/, "ando").replace(/er$/, "endo").replace(/ir$/, "indo");
    return a === "A" ? g.charAt(0).toUpperCase() + g.slice(1) : g;
  });
  // 2. phrases
  s = s.replace(R.green, (m, verb, mid) => { const [v, tail] = PTBR_GREEN_VERB[verb.toLowerCase()]; return ptbrCase(verb, v) + " " + mid + tail; });
  s = s.replace(R.greenLeft, (m, plural, color) => (plural ? plural + " " + color + "s" : color));
  s = s.replace(R.tooMuch, (m, end, next) => next + " demais");
  s = s.replace(R.onDate, "$1 em "); // "fechada a <date>" → "fechada em <date>"
  s = s.replace(R.phrases, (m) => ptbrCase(m, PTBR_PHRASES[ptbrKey(m)]));
  // 3. second person
  s = s.replace(R.you, (m, pre, verb) => {
    const words = pre.trim() ? pre.trim().split(/[ \t]+/).filter((w) => w.toLowerCase() !== "tu") : [];
    const out = ["você", ...words, PTBR_YOU[verb.toLowerCase()]].join(" ");
    return ptbrCase(m, out);
  });
  s = s.replace(R.subj, (m) => ptbrCase(m, PTBR_YOU_SUBJ[m.toLowerCase()]));
  s = s.replace(R.poss, (m, art, p) => ptbrCase(art || p, PTBR_POSSESSIVE[p.toLowerCase()])); // "o teu" → "seu" (the article goes)
  // 4. imperatives, 5. words
  s = ptbrImperatives(s);
  s = s.replace(R.words, (m) => ptbrCase(m, PTBR_WORDS[ptbrKey(m)]));
  s = s.replace(R.why, (m, art, why, sp, next) => (art ? m : ptbrCase(why, next && sp ? "por que" : "por quê") + sp));
  return ptbrRestore(s, store);
}

// The caller's own strings inside a derived function's arguments (feature names, paths, user text): kept verbatim.
function ptbrArgStrings(args) {
  const out = new Set();
  const walk = (v, depth) => {
    if (out.size > 400 || depth > 4) return;
    // two letters and up (masking is whole-word: a feature slug 'tu' stays 'tu'; a lone "a" / "o" would block the grammar rules)
    if (typeof v === "string") { if (v.length >= 2 && /\p{L}/u.test(v)) out.add(v); return; }
    if (Array.isArray(v)) { for (const x of v.slice(0, 400)) walk(x, depth + 1); return; }
    if (v && typeof v === "object" && !(v instanceof RegExp)) for (const k of Object.keys(v).slice(0, 200)) walk(v[k], depth + 1);
  };
  walk(args, 0);
  return [...out].sort((a, b) => b.length - a.length);
}
const ptbrPlain = (v) => v != null && typeof v === "object" && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
// A pt value → its pt-BR twin: strings transformed, arrays / plain objects mapped, functions wrapped (their result is
// transformed with their arguments protected). `raw` (a key → true | nested raw) keeps a value exactly as pt has it.
function derivePtBr(v, raw, masks, self) {
  if (typeof v === "string") return toPtBr(v, masks);
  if (typeof v === "function") {
    const fn = v;
    return function ptBr(...args) {
      const own = ptbrArgStrings(args);
      return derivePtBr(fn.apply(self, args), null, masks && masks.length ? [...new Set([...own, ...masks])].sort((a, b) => b.length - a.length) : own);
    };
  }
  if (Array.isArray(v)) return v.map((x) => derivePtBr(x, null, masks, v));
  if (!ptbrPlain(v)) return v;
  const out = {};
  for (const k of Object.keys(v)) {
    const r = raw && raw[k];
    out[k] = r === true ? v[k] : derivePtBr(v[k], r || null, masks, v);
  }
  return out;
}
// table["pt-BR"], derived from table.pt on first use — and each top-level key only when it is read (a hook reads two or
// three of MSG's sixty groups; a process that never meets pt-BR pays nothing). patch[k](derived, pt) adjusts one group.
function defineDerivedLocale(table, raw, patch) {
  let cache = null;
  const build = () => {
    const src = table.pt, out = {};
    if (!ptbrPlain(src)) return derivePtBr(src, raw, null, src);
    for (const k of Object.keys(src)) {
      Object.defineProperty(out, k, { enumerable: true, configurable: true, get() {
        let v = derivePtBr(src[k], raw && raw[k] !== true ? raw[k] || null : null, null, src);
        if (raw && raw[k] === true) v = src[k];
        if (patch && patch[k]) v = patch[k](v, src[k]);
        Object.defineProperty(out, k, { value: v, enumerable: true, configurable: true, writable: true });
        return v;
      } });
    }
    return out;
  };
  Object.defineProperty(table, "pt-BR", { enumerable: true, configurable: true, get: () => cache || (cache = build()) });
}
// The stop gate's claim / admission patterns are REGEX sources: kept as pt has them, plus the Brazilian gerund forms.
const PTBR_STOP_EXTRA = {
  claims: [
    String.raw`tudo\s+(?:funcionando|passando|rodando)`,
    String.raw`(?:todos\s+os\s+(?:\d+\s+)?|os\s+)?testes?\s+(?:(?:já|agora|todos)\s+)*(?:est[ãa]o\s+)?passando`,
    String.raw`(?:isso|já)\s+funciona`,
  ],
  admissions: [
    String.raw`(?:não|nunca)\s+(?:(?:foi|foram|está|estão|ficou|ainda|totalmente|chegou|ser)\s+){0,2}(?:executad[oa]s?|rodad[oa]s?)`,
    String.raw`sem\s+verificar|falta\s+verificar`,
    String.raw`[1-9]\d*\s+(?:testes?\s+)?falhando`,
    String.raw`testes?\s+(?:(?:ainda|estão)\s+)*falhando`,
  ],
};
defineDerivedLocale(BUILD);
defineDerivedLocale(STEERING);
defineDerivedLocale(EVALS_README);
defineDerivedLocale(BRIEF);
defineDerivedLocale(MSG, { stopGate: { claims: true, negators: true, admissions: true, fixed: true } }, {
  stopGate: (m, pt) => Object.assign(m, { claims: [...pt.claims, ...PTBR_STOP_EXTRA.claims], admissions: [...pt.admissions, ...PTBR_STOP_EXTRA.admissions] }),
});

// ===========================================================================
// Public API — thin dispatchers that resolve the language and delegate.
// ===========================================================================

function L(lang) { return BUILD[normalizeLang(lang)]; }

module.exports = {
  LANGS,
  BASE_LANGS,
  normalizeLang,
  canonicalLang,
  baseLang,
  toPtBr, // (text, masks?) European → Brazilian Portuguese (the pt-BR derivation, 1.14 D1)
  derivePtBr: (value, raw) => derivePtBr(value, raw || null, null, value), // a pt table (spec.js's roadmap chrome) → its pt-BR twin
  // artifact builders
  classification: (a, lang) => L(lang).classification(a),
  requirements: (a, lang) => L(lang).requirements(a),
  trackDesignBlock: (track, lang) => L(lang).trackDesignBlock(track),
  design: (a, lang) => L(lang).design(a),
  tasks: (a, lang) => L(lang).tasks(a),
  testPlan: (name, lang, tracks, acs) => L(lang).testPlan(name, tracks, acs), // tracks: which template ACs get a planned test; acs: the real AC IDs instead (one generic row each)
  templateAcIds: (tracks) => Object.keys(templateTests(tracks)), // the template AC IDs a test plan scaffolded for these tracks covers
  evalPlan: (name, lang) => L(lang).evalPlan(name),
  loadTest: (name, lang) => L(lang).loadTest(name),
  quickstart: (name, lang) => L(lang).quickstart(name),
  checklist: (a, lang) => L(lang).checklist(a),
  integrationPlan: (name, lang) => L(lang).integrationPlan(name),
  promptStub: (name, lang) => L(lang).promptStub(name),
  evalsReadme: (lang) => EVALS_README[normalizeLang(lang)],
  // steering
  // Own keys only: 'constructor' / '__proto__' / 'toString' must be "unknown file", not Object.prototype members.
  steeringStub: (file, lang) => {
    const t = STEERING[normalizeLang(lang)];
    return typeof file === "string" && Object.prototype.hasOwnProperty.call(t, file) ? t[file] : undefined;
  },
  steeringKnownFiles: () => Object.keys(STEERING.en),
  // tool messages
  msg: (lang) => MSG[normalizeLang(lang)],
  // task brief (spec_task_brief)
  brief: (lang) => BRIEF[normalizeLang(lang)],
  // bugfix templates (spec_create kind:"bugfix")
  bugReport: (a, lang) => L(lang).bugReport(a),
  bugRequirements: (a, lang) => L(lang).bugRequirements(a),
  bugTestPlan: (name, lang) => L(lang).bugTestPlan(name),
  bugTasks: (name, lang) => L(lang).bugTasks(name),
  renderBrief,
};
