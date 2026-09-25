"use strict";

/**
 * dev-spec-driven — localized scaffold content (EN / PT / ES). Zero-dependency, data-only.
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
 *   AC/SC/test IDs (US-1.AC-1, SC-001, T-01, EC-1, NFR-1), section markers ([SaaS], [AI]),
 *   story/parallel tags ([US1], [US2], [shared], [P]), the unfilled sentinel `> **TODO**`,
 *   `[NEEDS CLARIFICATION]`, the annotation tags `_Requirements:_ / _Makes green:_ /
 *   _Affects evals:_ / _Emits metrics:_ / _Implements:_`, `**Checkpoint:**`, the ```mermaid /
 *   ```typescript fences, the eval-harness headings `## System` / `## User Template`, and the test-plan
 *   Kind values (example / property).
 * EARS modal/keywords ARE localized (WHEN→QUANDO→CUANDO, THE SYSTEM SHALL→O SISTEMA DEVE→
 * EL SISTEMA DEBE, …) because earsValidate recognizes all three languages. Translated headings
 * are matched by the synonym tables (SAAS_SECTIONS/AI_SECTIONS) and RE_* matchers in spec.js.
 */

const LANGS = ["en", "pt", "es"];
function normalizeLang(l) {
  const s = String(l || "en").toLowerCase().slice(0, 2);
  return LANGS.includes(s) ? s : "en";
}

// The template's test IDs: one per template AC of the active tracks, numbered in the order the requirements template
// lists them. The test-plan and tasks builders (every language) share it, so a fresh +tdd scaffold plans a test for
// every AC and every planned test is made green by a task (it used to start with AC-3/AC-4/US-2.AC-1 uncovered and
// T-02 unmapped).
const TEMPLATE_ACS = { core: ["US-1.AC-1", "US-1.AC-2", "US-1.AC-3", "US-1.AC-4", "US-2.AC-1"], saas: ["US-1.AC-5", "US-1.AC-6"], ai: ["US-1.AC-7", "US-1.AC-8", "US-1.AC-9"] };
function templateTests(tracks) {
  const ids = {};
  let n = 0;
  for (const t of ["core", "saas", "ai"]) {
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
function templateTestRows(tracks, row, L) {
  const T = templateTests(tracks);
  const r = (ac, layer, desc, file, kind = "example") => row(T[ac], layer, kind, desc, ac, file);
  const rows = [r("US-1.AC-1", "unit", L.behavior, "tests/unit/..."), r("US-1.AC-2", L.integration, L.behavior, "tests/integration/..."),
    r("US-1.AC-3", "unit", L.recovery, "tests/unit/..."), r("US-1.AC-4", "unit", L.property, "tests/unit/...", "property"),
    r("US-2.AC-1", L.integration, L.behavior, "tests/integration/...")];
  if (T["US-1.AC-5"]) rows.push(r("US-1.AC-5", L.integration, L.tenant, "tests/integration/...", "property"), r("US-1.AC-6", L.load, L.latency, "load-test.md"));
  if (T["US-1.AC-7"]) rows.push(r("US-1.AC-7", "eval", L.golden, "evals/golden.json"), r("US-1.AC-8", "eval", L.injection, "evals/adversarial.json"),
    r("US-1.AC-9", L.integration, L.cost, "tests/integration/..."));
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
      const signalLines = ["tdd", "saas", "ai"].map(sigLine).filter(Boolean).join("\n") || "- [none beyond core]";
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
4. **US-1.AC-4** — [ubiquitous] THE SYSTEM SHALL [always-true property]${saasAc}${aiAc}

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
      return "";
    },

    design(a) {
      const extra = ["tdd", "saas", "ai"].filter((t) => a.tracks.includes(t)).map((t) => BUILD.en.trackDesignBlock(t)).join("");
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
      for (const t of ["saas", "ai"]) {
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
     No fix before bug.md → Root Cause is filled with evidence. -->

## Global Constraints
- [exact values the fix must respect — versions, limits, formats]

## Phase: Fix
- [ ] 1. [shared] Reproduce the bug reliably and write the steps in bug.md → Reproduction
  - _Requirements: US-1.AC-1_
- [ ] 2. [shared] Find the root cause with evidence; fill bug.md → Root Cause (no fix yet)
  - _Requirements: US-1.AC-1_
- [ ] 3. [US1] Write regression test T-01 and watch it fail for the right reason (paste the output)
  - _Requirements: US-1.AC-1_
  - _Makes green: T-01_
- [ ] 4. [US1] Fix the root cause — one change, not a bundle
  - _Requirements: US-1.AC-1, US-1.AC-2_
  - _Makes green: T-01, T-02_
  - _Verify: [full test suite command]_
**Checkpoint:** the bug no longer reproduces and the full suite is green.
`;
    },

    testPlan(name, tracks) {
      const rows = templateTestRows(tracks, (t, layer, kind, desc, ac, file) => `| ${t} | ${layer} | ${kind} | ${desc} | ${ac} | \`${file}\` |`,
        { integration: "integration", load: "load", behavior: "[behavior]", recovery: "[error condition → recovery]", property: "[always-true property]",
          tenant: "tenant A never reads tenant B's records", latency: "P95 latency within the performance budget",
          golden: "golden set ≥ the quality threshold", injection: "adversarial: injected instructions are ignored", cost: "cost per request within budget" });
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
      const signalLines = ["tdd", "saas", "ai"].map(sigLine).filter(Boolean).join("\n") || "- [nenhum além de core]";
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
4. **US-1.AC-4** — [ubíquo] O SISTEMA DEVE [propriedade sempre verdadeira]${saasAc}${aiAc}

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
      return "";
    },

    design(a) {
      const extra = ["tdd", "saas", "ai"].filter((t) => a.tracks.includes(t)).map((t) => BUILD.pt.trackDesignBlock(t)).join("");
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
      for (const t of ["saas", "ai"]) {
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
     Nenhuma correção antes de bug.md → Causa Raiz estar preenchida com evidência. -->

## Restrições Globais
- [valores exatos que a correção tem de respeitar — versões, limites, formatos]

## Fase: Correção
- [ ] 1. [shared] Reproduzir o bug de forma fiável e escrever os passos em bug.md → Reprodução
  - _Requirements: US-1.AC-1_
- [ ] 2. [shared] Encontrar a causa raiz com evidência; preencher bug.md → Causa Raiz (ainda sem corrigir)
  - _Requirements: US-1.AC-1_
- [ ] 3. [US1] Escrever o teste de regressão T-01 e vê-lo falhar pela razão certa (colar o output)
  - _Requirements: US-1.AC-1_
  - _Makes green: T-01_
- [ ] 4. [US1] Corrigir a causa raiz — uma alteração, não um pacote
  - _Requirements: US-1.AC-1, US-1.AC-2_
  - _Makes green: T-01, T-02_
  - _Verify: [comando da suite de testes completa]_
**Checkpoint:** o bug deixa de se reproduzir e a suite completa está verde.
`;
    },

    testPlan(name, tracks) {
      const rows = templateTestRows(tracks, (t, layer, kind, desc, ac, file) => `| ${t} | ${layer} | ${kind} | ${desc} | ${ac} | \`${file}\` |`,
        { integration: "integração", load: "carga", behavior: "[comportamento]", recovery: "[condição de erro → recuperação]", property: "[propriedade sempre verdadeira]",
          tenant: "o inquilino A nunca lê registos do inquilino B", latency: "latência P95 dentro do orçamento de desempenho",
          golden: "conjunto golden ≥ limiar de qualidade", injection: "adversarial: instruções injetadas são ignoradas", cost: "custo por pedido dentro do orçamento" });
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
      const signalLines = ["tdd", "saas", "ai"].map(sigLine).filter(Boolean).join("\n") || "- [ninguno además de core]";
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
4. **US-1.AC-4** — [ubicuo] EL SISTEMA DEBE [propiedad siempre verdadera]${saasAc}${aiAc}

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
      return "";
    },

    design(a) {
      const extra = ["tdd", "saas", "ai"].filter((t) => a.tracks.includes(t)).map((t) => BUILD.es.trackDesignBlock(t)).join("");
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
      for (const t of ["saas", "ai"]) {
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
     Ninguna corrección antes de que bug.md → Causa Raíz esté rellenada con evidencia. -->

## Restricciones Globales
- [valores exactos que la corrección debe respetar — versiones, límites, formatos]

## Fase: Corrección
- [ ] 1. [shared] Reproducir el bug de forma fiable y escribir los pasos en bug.md → Reproducción
  - _Requirements: US-1.AC-1_
- [ ] 2. [shared] Encontrar la causa raíz con evidencia; rellenar bug.md → Causa Raíz (aún sin corregir)
  - _Requirements: US-1.AC-1_
- [ ] 3. [US1] Escribir la prueba de regresión T-01 y verla fallar por la razón correcta (pegar la salida)
  - _Requirements: US-1.AC-1_
  - _Makes green: T-01_
- [ ] 4. [US1] Corregir la causa raíz — un cambio, no un paquete
  - _Requirements: US-1.AC-1, US-1.AC-2_
  - _Makes green: T-01, T-02_
  - _Verify: [comando de la suite de pruebas completa]_
**Checkpoint:** el bug deja de reproducirse y la suite completa está en verde.
`;
    },

    testPlan(name, tracks) {
      const rows = templateTestRows(tracks, (t, layer, kind, desc, ac, file) => `| ${t} | ${layer} | ${kind} | ${desc} | ${ac} | \`${file}\` |`,
        { integration: "integración", load: "carga", behavior: "[comportamiento]", recovery: "[condición de error → recuperación]", property: "[propiedad siempre verdadera]",
          tenant: "el inquilino A nunca lee registros del inquilino B", latency: "latencia P95 dentro del presupuesto de rendimiento",
          golden: "conjunto golden ≥ umbral de calidad", injection: "adversarial: las instrucciones inyectadas se ignoran", cost: "coste por solicitud dentro del presupuesto" });
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
    },
    kindKept: (kept, asked) => `'${kept}' is already the kind of this feature — kept it (asked for '${asked}'). Start a new one for a different kind.`,
    langKept: (kept, asked) => `This feature is already in '${kept}' — kept it (asked for '${asked}'). One feature, one language.`,
    err: {
      noUsableName: (name) => `Feature name '${name}' has no usable characters (a-z, 0-9) for a folder name.`,
      reserved: (slug) => `'${slug}' is a reserved name — pick another feature name.`,
      reservedWin: (slug) => `'${slug}' is a reserved name on Windows — pick another feature name.`,
      notFound: (slug, root) => `Feature '${slug}' not found under ${root}`,
      invalidJson: (rel, detail) => `${rel} is not valid JSON (${detail}) — fix it by hand; refusing to overwrite it.`,
      tasksMissing: (slug) => `tasks.md not found for '${slug}'`,
      requirementsMissing: (slug) => `requirements.md not found for '${slug}'`,
      taskNotFound: (n) => `Task ${n} not found in tasks.md`,
      numberInt: "number must be an integer",
      noText: "No text provided.",
      unknownPhase: (phase, known) => `Unknown phase '${phase}'. Known: ${known}`,
      alreadyArchived: (slug) => `'${slug}' is already archived (.specs/_archive/${slug}). Remove it there first.`,
      renameNeedsName: "rename needs a new name.",
      sameSlug: "New name is the same slug.",
      alreadyExists: (slug) => `'${slug}' already exists.`,
      badAction: "action must be one of: remove | archive | rename",
      badTrack: "track must be one of: tdd | saas | ai",
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
      implement: (n, text, slug) => `Implement task #${n}: ${text} — /executeTask ${slug}.`,
      allDone: (slug) => `All tasks done — close the feature with /spec-finish ${slug} (spec_finish): readiness report + merge summary.`,
      breakIntoTasks: (slug) => `Break the design into tasks — /createTask ${slug}.`,
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
    },

    // @wp WP1 msg-en >>>
    // Evidence gate (spec_complete_task / doctor / spec_finish). Reason codes stay English-stable.
    evidenceGate: {
      noContent: "Evidence needs a command (with its exit code) or a summary — an exit code alone proves nothing.",
      manualOnRunnable: (n, slug) => `Task ${n}: a note was recorded, but its _Verify:_ command was not run — it stays unverified until a passing run is recorded: dev-spec done ${slug} ${n} --run`,
      failedRun: (n, code, slug, runnable) => `Task ${n}: its latest recorded run failed (exit ${code}) — a note doesn't change that; it stays unverified until a passing run ` +
        (runnable ? `of its _Verify:_ command is recorded: dev-spec done ${slug} ${n} --run` : "(a command with exit code 0) is recorded."),
      duplicateNumber: (n) => `Task ${n}: another task also uses number ${n} and the recorded evidence is that task's — this one stays unverified; renumber the tasks, then record its own evidence.`,
      staleEvidence: (n, slug, runnable) => `Task ${n}: the recorded evidence is for another task or an earlier _Verify:_ command — it stays unverified until its own ` +
        (runnable ? `run is recorded: dev-spec done ${slug} ${n} --run` : "evidence is recorded."),
      reason: { "no-evidence": "no evidence", "failed-run": "latest run failed", "manual-note-on-runnable-verify": "note only, _Verify:_ command not run", "duplicate-number": "number shared with another task",
        "stale-evidence": "evidence is for another task or _Verify:_ command" },
      duplicateTasks: (list) => `task numbers used more than once: ${list} — complete/brief pick the first open one; renumber them`,
    },
    // CLI `done` human output.
    taskDone: {
      done: (n, verified, done, total) => `Task ${n} done${verified ? " (verified)" : ""}. ${done}/${total}`,
      already: (n, verified, done, total) => `Task ${n} was already done${verified ? " (verified)" : ""}. ${done}/${total}`,
      next: (n, text) => `  next → #${n} ${text}`,
      allDone: "  — all done ✓",
      numberInt: "task number must be an integer",
      noRunnable: (n) => `task ${n} has no runnable _Verify: <command>_ marker`,
      shellHint: "Hint: this ran under the default Windows shell (cmd.exe). If the _Verify:_ command uses POSIX shell syntax, retry with --shell bash (or set DEV_SPEC_SHELL=bash).",
    },
    // @wp WP1 <<<

    // @wp WP2 msg-en >>>
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
      taskBlock: (track, start) => BUILD.en.trackTasks({ track, start }),
    },
    // @wp WP2 <<<

    // @wp WP3 msg-en >>>
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
    },
    depend: {
      unknown: (list) => `Every dependency must be an existing feature — not found: ${list}`,
      orderInt: (v) => `order must be an integer (got '${v}').`,
    },
    // mcp/evals/run-evals.js human output (in the feature's language).
    evals: {
      usage: "Usage: node run-evals.js <feature> [--dry-run] [--set-baseline] [--require-live] [--model=ID] [--project=DIR]",
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
      dryOk: "\nDry run complete — sets are valid. Set ANTHROPIC_API_KEY and re-run for live scores.",
      verdict: (below) => `\nVerdict: ${below ? "BELOW THRESHOLD ✗" : "all sets pass ✓"}`,
      crashed: (msg) => `eval harness error: ${msg}`,
    },
    // @wp WP3 <<<

    // @wp WP4 msg-en >>>
    // Every gap kind trace_check can report (CLI, hook and doctor list them all — none is dropped).
    traceGapText: {
      kinds: {
        uncoveredByTasks: "ACs with no task",
        phantomAcsInTasks: "tasks reference unknown ACs (typos?)",
        uncoveredByTests: "ACs with no planned test",
        phantomTestsInTasks: "tasks reference unknown tests (typos?)",
        testsNotMappedToTasks: "planned tests that no task makes green",
        missingImplFiles: "_Implements:_ files that don't exist",
      },
      gap: (label, list) => `${label}: ${list}`,
      allCovered: (n) => `all ${n} ACs covered by tasks`,
    },
    // detectPhase() tokens stay English in JSON; these are for human-readable lines only.
    phaseNames: {
      complete: "complete", executing: "executing", "tasks-ready": "tasks-ready", "eval-plan": "eval-plan", "test-plan": "test-plan",
      design: "design", requirements: "requirements", classified: "classified", empty: "empty",
    },
    featureOps: {
      removeNeedsConfirm: (slug, n) => `Removing '${slug}' permanently deletes .specs/${slug}/ (${n} file(s)). Nothing was deleted — pass confirm: true to delete it, or archive it instead (reversible).`,
      backlogNotFound: (name, known) => `'${name}' is not in the backlog${known ? ` (backlog: ${known})` : " (the backlog is empty)"}.`,
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
      unknownRules: (tool, known) => `unknown tool '${tool}'. Known: ${known}`,
    },
    // @wp WP4 <<<

    // @wp WP5 msg-en >>>
    // Gates: template placeholders, the approve gate (+ force), finish blockers, the bugfix execution gate,
    // next_action's "fill <file>" step, clarify's grouped placeholder question and the requirements hook line.
    gates: {
      empty: "no content beyond headings",
      more: (n) => `+${n} more`,
      placeholdersNone: "no template placeholders left in the current phase",
      placeholdersFail: (list) => `template placeholders left in the current phase (or an earlier one): ${list}`,
      placeholdersLater: (list) => `later phases are still templates (not blocking yet): ${list}`,
      earsPlaceholder: (list) => `Criterion still holds template placeholder(s) ${list} — write the real trigger/behavior.`,
      constitutionUnfilled: "the Constitution Check section is missing or not filled in",
      checkLine: (id, detail) => `  ✗ ${id}${detail ? " — " + detail : ""}`,
      approveRefused: (phase, slug, ids, lines) => `Can't approve '${phase}' for '${slug}' — failing checks: ${ids}.\n${lines}\nFix them (details: /spec-doctor ${slug}), or pass force: true (CLI: --force) to record the approval anyway — it stays flagged as forced.`,
      approveNothing: (phase, slug, file) => `Nothing to approve: '${phase}' has no artifact in '${slug}' (${file} is missing, or its track is off) — not even with force.`,
      approveForced: (ids) => `Approved with force — the failing checks are recorded with the approval: ${ids}.`,
      forcedGates: (list) => `approved with force over failing checks: ${list}`,
      finishRootCause: "bug.md → Root Cause is not filled — no fix before the root cause is known",
      finishPlaceholders: (list) => `template placeholders left in the spec chain: ${list}`,
      finishChanged: (list) => `changed after their approval (re-review, then re-approve): ${list}`,
      bugGate: (n, first) => `Task ${n} can't be completed yet: bug.md → Root Cause is not filled. No fix before the root cause is written in bug.md — do task ${first} first (find the root cause with evidence and write it there).`,
      bugGateFirst: (n, first) => `Task ${n} can't be completed yet: bug.md → Root Cause is not filled and no task writes it — only task ${first} can be completed until the root cause is written in bug.md (no fix before the root cause).`,
      fill: (file, what, hint) => `Fill ${file} — ${what}; then ${hint}.`,
      fillMissing: "it doesn't exist yet",
      fillEmpty: "it has no content beyond headings",
      fillPlaceholders: (n, first) => `${n} template placeholder(s) left (first: ${first})`,
      fillHint: {
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
      clarifyPlaceholders: (file, n, list) => `Replace the ${n} template placeholder(s)/TBD in ${file}: ${list}`,
      hookPlaceholders: (n, list) => `Template placeholders: ${n} left in requirements.md (${list}) — replace them before approving the requirements.`,
    },
    // @wp WP5 <<<

    // @wp WP6 msg-en >>>
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
      wUnknownRef: (task, ref) => `task ${task}: _Requirements:_ reference '${ref}' matches no imported criterion — kept as written`,
      wUnknownRefLine: (line, ref) => `tasks.md line ${line}: _Requirements:_ reference '${ref}' matches no imported criterion — kept as written`,
      wCarried: (list) => `carried over verbatim, not mapped to stories or criteria (review them): ${list}`,
      wNoRefs: "the imported tasks carry no _Requirements:_ references — add them so trace_check can map every AC to a task",
      wNoTasks: "no tasks.md in the source — the scaffold's tasks.md was kept",
      wNoDesign: (file) => `no ${file} in the source — the scaffold's design.md was kept`,
      wNoRequirements: (file) => `no requirements found in ${file}`,
      wRemoved: (name) => `REMOVED requirement '${name}' was not imported`,
      wRenamed: (from, to) => `RENAMED requirement '${from}' → '${to}' (imported under the new name)`,
      wSkipped: (files) => `not imported (left in place): ${files}`,
      wUnreadable: (file) => `${file} points outside the project — skipped`,
      done: (tool, rel, slug, label, lang) => `Imported ${tool} ${rel} → feature '${slug}' [${label}] (${lang})`,
      mapping: (n, sample) => `  mapping: ${n} ID(s)` + (sample ? ` — ${sample}` : ""),
    },
    // @wp WP6 <<<

    // @wp WP7 msg-en >>>
    // spec_append_tasks / `dev-spec append-tasks` (converge). Markers, IDs and **Checkpoint:** stay English-stable.
    appendTasks: {
      heading: "Phase: Convergence",
      checkpoint: "the convergence tasks are done and verified — the spec and the code agree again.",
      noTasks: "Give at least one task: tasks = [{ text, requirements?, implements?, verify?, story?, parallel? }].",
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
    },
    // @wp WP7 <<<

    // @wp WP8 msg-en >>>
    // @wp WP8 <<<

    // @wp WP9 msg-en >>>
    // Deep traceability (trace_check warnings, doctor secondary-trace / tests-in-code, finish, hook). Never blocking.
    deepTrace: {
      kinds: {
        uncoveredEdgeCases: "edge cases (EC) that no task or test covers",
        uncoveredNfr: "non-functional requirements (NFR) that no task or test covers",
        uncoveredSuccessCriteria: "success criteria (SC) that no test or quickstart step checks",
        phantomSecondary: "tasks / test plan cite unknown EC/NFR/SC IDs (typos?)",
        plannedNotInCode: "planned tests that no test file names (put the T-ID in the test name)",
        inCodeNotInPlan: "T-IDs in test code that no feature's test plan lists",
      },
      secondaryOk: (n) => `all ${n} EC/NFR/SC IDs covered`,
      testsInCodeOk: (n) => `every planned T-ID made green by a done task is named in a test file (${n})`,
      testsInCodeMissing: (list) => `made green by done tasks, but no test file names them: ${list} — put the T-ID in the test name (test("T-01 …"), def test_T01_…)`,
      truncated: "the test-file scan stopped at its cap — some files were not read",
      codeSummary: (found, planned, scanned, truncated) => `  tests in code: ${found}/${planned} planned T-ID(s) named in ${scanned} test file(s)` + (truncated ? " (scan truncated at its cap)" : ""),
      warningsHead: "Warnings (not blocking):",
    },
    // @wp WP9 <<<

    // @wp WP10 msg-en >>>
    // @wp WP10 <<<

    // @wp WP11 msg-en >>>
    // @wp WP11 <<<
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
    },
    kindKept: (kept, asked) => `Esta feature já é do tipo '${kept}' — mantive-o (pediste '${asked}'). Cria outra para um tipo diferente.`,
    langKept: (kept, asked) => `Esta feature já está em '${kept}' — mantive-a (pediste '${asked}'). Uma feature, uma língua.`,
    err: {
      noUsableName: (name) => `O nome de feature '${name}' não tem caracteres utilizáveis (a-z, 0-9) para nome de pasta.`,
      reserved: (slug) => `'${slug}' é um nome reservado — escolhe outro nome para a feature.`,
      reservedWin: (slug) => `'${slug}' é um nome reservado no Windows — escolhe outro nome para a feature.`,
      notFound: (slug, root) => `Feature '${slug}' não encontrada em ${root}`,
      invalidJson: (rel, detail) => `${rel} não é JSON válido (${detail}) — corrige-o à mão; não o vou sobrescrever.`,
      tasksMissing: (slug) => `tasks.md não encontrado para '${slug}'`,
      requirementsMissing: (slug) => `requirements.md não encontrado para '${slug}'`,
      taskNotFound: (n) => `Tarefa ${n} não encontrada em tasks.md`,
      numberInt: "o número tem de ser um inteiro",
      noText: "Nenhum texto fornecido.",
      unknownPhase: (phase, known) => `Fase desconhecida '${phase}'. Conhecidas: ${known}`,
      alreadyArchived: (slug) => `'${slug}' já está arquivada (.specs/_archive/${slug}). Remove-a de lá primeiro.`,
      renameNeedsName: "para renomear é preciso um nome novo.",
      sameSlug: "O nome novo dá o mesmo slug.",
      alreadyExists: (slug) => `'${slug}' já existe.`,
      badAction: "a ação tem de ser: remove | archive | rename",
      badTrack: "o track tem de ser: tdd | saas | ai",
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
      implement: (n, text, slug) => `Implementa a tarefa #${n}: ${text} — /executeTask ${slug}.`,
      allDone: (slug) => `Todas as tarefas feitas — fecha a feature com /spec-finish ${slug} (spec_finish): relatório de prontidão + resumo do merge.`,
      breakIntoTasks: (slug) => `Divide o design em tarefas — /createTask ${slug}.`,
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
    },

    // @wp WP1 msg-pt >>>
    evidenceGate: {
      noContent: "A evidência precisa de um comando (com o exit code) ou de um resumo — um exit code sozinho não prova nada.",
      manualOnRunnable: (n, slug) => `Tarefa ${n}: ficou registada uma nota, mas o comando _Verify:_ não foi corrido — continua não verificada até se registar uma execução com sucesso: dev-spec done ${slug} ${n} --run`,
      failedRun: (n, code, slug, runnable) => `Tarefa ${n}: a última execução registada falhou (exit ${code}) — uma nota não muda isso; continua não verificada até se registar uma execução com sucesso ` +
        (runnable ? `do comando _Verify:_: dev-spec done ${slug} ${n} --run` : "(um comando com exit code 0)."),
      duplicateNumber: (n) => `Tarefa ${n}: outra tarefa também usa o número ${n} e a evidência registada é dessa — esta continua não verificada; renumera as tarefas e depois regista a evidência desta.`,
      staleEvidence: (n, slug, runnable) => `Tarefa ${n}: a evidência registada é de outra tarefa ou de um comando _Verify:_ anterior — continua não verificada até se registar ` +
        (runnable ? `uma execução desta: dev-spec done ${slug} ${n} --run` : "a evidência desta."),
      reason: { "no-evidence": "sem evidência", "failed-run": "a última execução falhou", "manual-note-on-runnable-verify": "só uma nota, comando _Verify:_ por correr", "duplicate-number": "número partilhado com outra tarefa",
        "stale-evidence": "evidência de outra tarefa ou de outro comando _Verify:_" },
      duplicateTasks: (list) => `números de tarefa repetidos: ${list} — o complete/brief escolhem a primeira por fazer; renumera-as`,
    },
    taskDone: {
      done: (n, verified, done, total) => `Tarefa ${n} feita${verified ? " (verificada)" : ""}. ${done}/${total}`,
      already: (n, verified, done, total) => `A tarefa ${n} já estava feita${verified ? " (verificada)" : ""}. ${done}/${total}`,
      next: (n, text) => `  próxima → #${n} ${text}`,
      allDone: "  — tudo feito ✓",
      numberInt: "o número da tarefa tem de ser um inteiro",
      noRunnable: (n) => `a tarefa ${n} não tem um marcador _Verify: <comando>_ executável`,
      shellHint: "Dica: isto correu na shell por omissão do Windows (cmd.exe). Se o comando _Verify:_ usa sintaxe de shell POSIX, tenta de novo com --shell bash (ou define DEV_SPEC_SHELL=bash).",
    },
    // @wp WP1 <<<

    // @wp WP2 msg-pt >>>
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
      taskBlock: (track, start) => BUILD.pt.trackTasks({ track, start }),
    },
    // @wp WP2 <<<

    // @wp WP3 msg-pt >>>
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
    },
    depend: {
      unknown: (list) => `Cada dependência tem de ser uma feature existente — não encontrada(s): ${list}`,
      orderInt: (v) => `order tem de ser um inteiro (recebido: '${v}').`,
    },
    evals: {
      usage: "Uso: node run-evals.js <feature> [--dry-run] [--set-baseline] [--require-live] [--model=ID] [--project=DIR]",
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
      dryOk: "\nDry run concluído — os conjuntos são válidos. Define a ANTHROPIC_API_KEY e volta a correr para obter resultados reais.",
      verdict: (below) => `\nVeredicto: ${below ? "ABAIXO DO LIMIAR ✗" : "todos os conjuntos passam ✓"}`,
      crashed: (msg) => `erro no harness de evals: ${msg}`,
    },
    // @wp WP3 <<<

    // @wp WP4 msg-pt >>>
    traceGapText: {
      kinds: {
        uncoveredByTasks: "ACs sem tarefa",
        phantomAcsInTasks: "tarefas referem ACs desconhecidos (erros de escrita?)",
        uncoveredByTests: "ACs sem teste planeado",
        phantomTestsInTasks: "tarefas referem testes desconhecidos (erros de escrita?)",
        testsNotMappedToTasks: "testes planeados que nenhuma tarefa põe a verde",
        missingImplFiles: "ficheiros _Implements:_ que não existem",
      },
      gap: (label, list) => `${label}: ${list}`,
      allCovered: (n) => `todos os ${n} ACs cobertos por tarefas`,
    },
    phaseNames: {
      complete: "concluída", executing: "em execução", "tasks-ready": "tarefas prontas", "eval-plan": "plano de evals", "test-plan": "plano de testes",
      design: "design", requirements: "requisitos", classified: "classificada", empty: "vazia",
    },
    featureOps: {
      removeNeedsConfirm: (slug, n) => `Remover '${slug}' apaga .specs/${slug}/ de vez (${n} ficheiro(s)). Nada foi apagado — passa confirm: true para a apagar, ou arquiva-a (reversível).`,
      backlogNotFound: (name, known) => `'${name}' não está no backlog${known ? ` (backlog: ${known})` : " (o backlog está vazio)"}.`,
    },
    cliOutput: {
      words: { pass: "ok", warn: "aviso", fail: "falha", "gaps-found": "com lacunas", clear: "clara", "needs-clarification": "precisa de clarificação" },
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
      unknownRules: (tool, known) => `ferramenta desconhecida '${tool}'. Conhecidas: ${known}`,
    },
    // @wp WP4 <<<

    // @wp WP5 msg-pt >>>
    gates: {
      empty: "sem conteúdo além dos títulos",
      more: (n) => `+${n} a mais`,
      placeholdersNone: "nenhum placeholder do template na fase atual",
      placeholdersFail: (list) => `placeholders do template por preencher na fase atual (ou numa anterior): ${list}`,
      placeholdersLater: (list) => `as fases seguintes ainda são template (ainda não bloqueia): ${list}`,
      earsPlaceholder: (list) => `O critério ainda tem placeholder(s) do template ${list} — escreve o gatilho/comportamento real.`,
      constitutionUnfilled: "a secção Verificação da Constituição está em falta ou por preencher",
      checkLine: (id, detail) => `  ✗ ${id}${detail ? " — " + detail : ""}`,
      approveRefused: (phase, slug, ids, lines) => `Não é possível aprovar '${phase}' de '${slug}' — verificações a falhar: ${ids}.\n${lines}\nCorrige-as (detalhes: /spec-doctor ${slug}), ou passa force: true (CLI: --force) para registar a aprovação mesmo assim — fica assinalada como forçada.`,
      approveNothing: (phase, slug, file) => `Nada para aprovar: '${phase}' não tem artefacto em '${slug}' (${file} não existe, ou o track está desativado) — nem com force.`,
      approveForced: (ids) => `Aprovado com force — as verificações a falhar ficam registadas com a aprovação: ${ids}.`,
      forcedGates: (list) => `aprovado com force apesar de verificações a falhar: ${list}`,
      finishRootCause: "bug.md → Causa Raiz por preencher — nenhuma correção antes de se conhecer a causa",
      finishPlaceholders: (list) => `placeholders do template por preencher na cadeia da spec: ${list}`,
      finishChanged: (list) => `alterados depois da aprovação (rever e voltar a aprovar): ${list}`,
      bugGate: (n, first) => `A tarefa ${n} ainda não pode ser concluída: bug.md → Causa Raiz está por preencher. Nenhuma correção antes de a causa raiz estar escrita no bug.md — faz primeiro a tarefa ${first} (encontra a causa raiz com evidência e escreve-a lá).`,
      bugGateFirst: (n, first) => `A tarefa ${n} ainda não pode ser concluída: bug.md → Causa Raiz está por preencher e nenhuma tarefa a escreve — só a tarefa ${first} pode ser concluída até a causa raiz estar escrita no bug.md (nenhuma correção antes da causa raiz).`,
      fill: (file, what, hint) => `Preenche ${file} — ${what}; depois ${hint}.`,
      fillMissing: "ainda não existe",
      fillEmpty: "não tem conteúdo além dos títulos",
      fillPlaceholders: (n, first) => `${n} placeholder(s) do template por preencher (primeiro: ${first})`,
      fillHint: {
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
      clarifyPlaceholders: (file, n, list) => `Substitui os ${n} placeholder(s)/TBD do template em ${file}: ${list}`,
      hookPlaceholders: (n, list) => `Placeholders do template: ${n} por preencher em requirements.md (${list}) — substitui-os antes de aprovar os requisitos.`,
    },
    // @wp WP5 <<<

    // @wp WP6 msg-pt >>>
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
      wUnknownRef: (task, ref) => `tarefa ${task}: a referência _Requirements:_ '${ref}' não corresponde a nenhum critério importado — mantida como estava`,
      wUnknownRefLine: (line, ref) => `tasks.md, linha ${line}: a referência _Requirements:_ '${ref}' não corresponde a nenhum critério importado — mantida como estava`,
      wCarried: (list) => `copiado tal como estava, sem correspondência com histórias ou critérios (revê-o): ${list}`,
      wNoRefs: "as tarefas importadas não têm referências _Requirements:_ — acrescenta-as para o trace_check associar cada AC a uma tarefa",
      wNoTasks: "a origem não tem tasks.md — foi mantido o tasks.md do scaffold",
      wNoDesign: (file) => `a origem não tem ${file} — foi mantido o design.md do scaffold`,
      wNoRequirements: (file) => `não foram encontrados requisitos em ${file}`,
      wRemoved: (name) => `o requisito REMOVED '${name}' não foi importado`,
      wRenamed: (from, to) => `requisito RENAMED '${from}' → '${to}' (importado com o nome novo)`,
      wSkipped: (files) => `não importados (ficam onde estão): ${files}`,
      wUnreadable: (file) => `${file} aponta para fora do projeto — ignorado`,
      done: (tool, rel, slug, label, lang) => `Importado de ${tool} ${rel} → feature '${slug}' [${label}] (${lang})`,
      mapping: (n, sample) => `  correspondência: ${n} ID(s)` + (sample ? ` — ${sample}` : ""),
    },
    // @wp WP6 <<<

    // @wp WP7 msg-pt >>>
    appendTasks: {
      heading: "Fase: Convergência",
      checkpoint: "as tarefas de convergência estão concluídas e verificadas — a spec e o código voltam a coincidir.",
      noTasks: "Indica pelo menos uma tarefa: tasks = [{ text, requirements?, implements?, verify?, story?, parallel? }].",
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
    },
    // @wp WP7 <<<

    // @wp WP8 msg-pt >>>
    // @wp WP8 <<<

    // @wp WP9 msg-pt >>>
    deepTrace: {
      kinds: {
        uncoveredEdgeCases: "casos limite (EC) sem tarefa nem teste que os cubra",
        uncoveredNfr: "requisitos não funcionais (NFR) sem tarefa nem teste que os cubra",
        uncoveredSuccessCriteria: "critérios de sucesso (SC) sem teste nem passo do quickstart que os verifique",
        phantomSecondary: "tarefas / plano de testes citam IDs EC/NFR/SC desconhecidos (gralhas?)",
        plannedNotInCode: "testes planeados que nenhum ficheiro de teste nomeia (põe o T-ID no nome do teste)",
        inCodeNotInPlan: "T-IDs no código de teste que nenhum plano de testes lista",
      },
      secondaryOk: (n) => `todos os ${n} IDs EC/NFR/SC cobertos`,
      testsInCodeOk: (n) => `cada T-ID planeado que uma tarefa feita põe a verde aparece num ficheiro de teste (${n})`,
      testsInCodeMissing: (list) => `postos a verde por tarefas feitas, mas nenhum ficheiro de teste os nomeia: ${list} — põe o T-ID no nome do teste (test("T-01 …"), def test_T01_…)`,
      truncated: "a pesquisa de ficheiros de teste parou no limite — alguns ficheiros não foram lidos",
      codeSummary: (found, planned, scanned, truncated) => `  testes no código: ${found}/${planned} T-ID(s) planeado(s) nomeado(s) em ${scanned} ficheiro(s) de teste` + (truncated ? " (pesquisa truncada no limite)" : ""),
      warningsHead: "Avisos (não bloqueiam):",
    },
    // @wp WP9 <<<

    // @wp WP10 msg-pt >>>
    // @wp WP10 <<<

    // @wp WP11 msg-pt >>>
    // @wp WP11 <<<
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
    },
    kindKept: (kept, asked) => `Esta función ya es del tipo '${kept}' — se mantiene (pediste '${asked}'). Crea otra para un tipo distinto.`,
    langKept: (kept, asked) => `Esta función ya está en '${kept}' — se mantiene (pediste '${asked}'). Una función, un idioma.`,
    err: {
      noUsableName: (name) => `El nombre de función '${name}' no tiene caracteres utilizables (a-z, 0-9) para un nombre de carpeta.`,
      reserved: (slug) => `'${slug}' es un nombre reservado — elige otro nombre para la función.`,
      reservedWin: (slug) => `'${slug}' es un nombre reservado en Windows — elige otro nombre para la función.`,
      notFound: (slug, root) => `Función '${slug}' no encontrada en ${root}`,
      invalidJson: (rel, detail) => `${rel} no es JSON válido (${detail}) — corrígelo a mano; no se sobrescribirá.`,
      tasksMissing: (slug) => `tasks.md no encontrado para '${slug}'`,
      requirementsMissing: (slug) => `requirements.md no encontrado para '${slug}'`,
      taskNotFound: (n) => `Tarea ${n} no encontrada en tasks.md`,
      numberInt: "el número debe ser un entero",
      noText: "No se ha proporcionado texto.",
      unknownPhase: (phase, known) => `Fase desconocida '${phase}'. Conocidas: ${known}`,
      alreadyArchived: (slug) => `'${slug}' ya está archivada (.specs/_archive/${slug}). Elimínala de allí primero.`,
      renameNeedsName: "para renombrar hace falta un nombre nuevo.",
      sameSlug: "El nombre nuevo da el mismo slug.",
      alreadyExists: (slug) => `'${slug}' ya existe.`,
      badAction: "la acción debe ser: remove | archive | rename",
      badTrack: "el track debe ser: tdd | saas | ai",
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
      implement: (n, text, slug) => `Implementa la tarea #${n}: ${text} — /executeTask ${slug}.`,
      allDone: (slug) => `Todas las tareas hechas — cierra la función con /spec-finish ${slug} (spec_finish): informe de preparación + resumen del merge.`,
      breakIntoTasks: (slug) => `Desglosa el diseño en tareas — /createTask ${slug}.`,
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
    },

    // @wp WP1 msg-es >>>
    evidenceGate: {
      noContent: "La evidencia necesita un comando (con su exit code) o un resumen — un exit code solo no prueba nada.",
      manualOnRunnable: (n, slug) => `Tarea ${n}: se registró una nota, pero su comando _Verify:_ no se ejecutó — sigue sin verificar hasta que se registre una ejecución correcta: dev-spec done ${slug} ${n} --run`,
      failedRun: (n, code, slug, runnable) => `Tarea ${n}: su última ejecución registrada falló (exit ${code}) — una nota no cambia eso; sigue sin verificar hasta que se registre una ejecución correcta ` +
        (runnable ? `de su comando _Verify:_: dev-spec done ${slug} ${n} --run` : "(un comando con exit code 0)."),
      duplicateNumber: (n) => `Tarea ${n}: otra tarea también usa el número ${n} y la evidencia registrada es de esa — esta sigue sin verificar; renumera las tareas y luego registra la evidencia de esta.`,
      staleEvidence: (n, slug, runnable) => `Tarea ${n}: la evidencia registrada es de otra tarea o de un comando _Verify:_ anterior — sigue sin verificar hasta que se registre ` +
        (runnable ? `una ejecución de esta: dev-spec done ${slug} ${n} --run` : "la evidencia de esta."),
      reason: { "no-evidence": "sin evidencia", "failed-run": "la última ejecución falló", "manual-note-on-runnable-verify": "solo una nota, comando _Verify:_ sin ejecutar", "duplicate-number": "número compartido con otra tarea",
        "stale-evidence": "evidencia de otra tarea o de otro comando _Verify:_" },
      duplicateTasks: (list) => `números de tarea repetidos: ${list} — complete/brief eligen la primera pendiente; renuméralas`,
    },
    taskDone: {
      done: (n, verified, done, total) => `Tarea ${n} hecha${verified ? " (verificada)" : ""}. ${done}/${total}`,
      already: (n, verified, done, total) => `La tarea ${n} ya estaba hecha${verified ? " (verificada)" : ""}. ${done}/${total}`,
      next: (n, text) => `  siguiente → #${n} ${text}`,
      allDone: "  — todo hecho ✓",
      numberInt: "el número de tarea debe ser un entero",
      noRunnable: (n) => `la tarea ${n} no tiene un marcador _Verify: <comando>_ ejecutable`,
      shellHint: "Consejo: esto se ejecutó con la shell predeterminada de Windows (cmd.exe). Si el comando _Verify:_ usa sintaxis de shell POSIX, reinténtalo con --shell bash (o define DEV_SPEC_SHELL=bash).",
    },
    // @wp WP1 <<<

    // @wp WP2 msg-es >>>
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
      taskBlock: (track, start) => BUILD.es.trackTasks({ track, start }),
    },
    // @wp WP2 <<<

    // @wp WP3 msg-es >>>
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
    },
    depend: {
      unknown: (list) => `Cada dependencia debe ser una función existente — no encontrada(s): ${list}`,
      orderInt: (v) => `order debe ser un entero (recibido: '${v}').`,
    },
    evals: {
      usage: "Uso: node run-evals.js <función> [--dry-run] [--set-baseline] [--require-live] [--model=ID] [--project=DIR]",
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
      dryOk: "\nDry run completado — los conjuntos son válidos. Define ANTHROPIC_API_KEY y vuelve a ejecutar para obtener resultados reales.",
      verdict: (below) => `\nVeredicto: ${below ? "POR DEBAJO DEL UMBRAL ✗" : "todos los conjuntos pasan ✓"}`,
      crashed: (msg) => `error en el harness de evals: ${msg}`,
    },
    // @wp WP3 <<<

    // @wp WP4 msg-es >>>
    traceGapText: {
      kinds: {
        uncoveredByTasks: "ACs sin tarea",
        phantomAcsInTasks: "tareas referencian ACs desconocidos (¿erratas?)",
        uncoveredByTests: "ACs sin prueba planeada",
        phantomTestsInTasks: "tareas referencian pruebas desconocidas (¿erratas?)",
        testsNotMappedToTasks: "pruebas planeadas que ninguna tarea pone en verde",
        missingImplFiles: "ficheros _Implements:_ que no existen",
      },
      gap: (label, list) => `${label}: ${list}`,
      allCovered: (n) => `los ${n} ACs cubiertos por tareas`,
    },
    phaseNames: {
      complete: "completada", executing: "en ejecución", "tasks-ready": "tareas listas", "eval-plan": "plan de evals", "test-plan": "plan de pruebas",
      design: "diseño", requirements: "requisitos", classified: "clasificada", empty: "vacía",
    },
    featureOps: {
      removeNeedsConfirm: (slug, n) => `Eliminar '${slug}' borra .specs/${slug}/ definitivamente (${n} fichero(s)). No se ha borrado nada — pasa confirm: true para eliminarla, o archívala (reversible).`,
      backlogNotFound: (name, known) => `'${name}' no está en el backlog${known ? ` (backlog: ${known})` : " (el backlog está vacío)"}.`,
    },
    cliOutput: {
      words: { pass: "ok", warn: "aviso", fail: "falla", "gaps-found": "con lagunas", clear: "clara", "needs-clarification": "requiere aclaración" },
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
      unknownRules: (tool, known) => `herramienta desconocida '${tool}'. Conocidas: ${known}`,
    },
    // @wp WP4 <<<

    // @wp WP5 msg-es >>>
    gates: {
      empty: "sin contenido además de los títulos",
      more: (n) => `+${n} más`,
      placeholdersNone: "ningún placeholder de la plantilla en la fase actual",
      placeholdersFail: (list) => `placeholders de la plantilla sin rellenar en la fase actual (o en una anterior): ${list}`,
      placeholdersLater: (list) => `las fases siguientes aún son plantilla (todavía no bloquea): ${list}`,
      earsPlaceholder: (list) => `El criterio aún tiene placeholder(s) de la plantilla ${list} — escribe el disparador/comportamiento real.`,
      constitutionUnfilled: "la sección Verificación de la Constitución falta o está sin rellenar",
      checkLine: (id, detail) => `  ✗ ${id}${detail ? " — " + detail : ""}`,
      approveRefused: (phase, slug, ids, lines) => `No se puede aprobar '${phase}' de '${slug}' — verificaciones que fallan: ${ids}.\n${lines}\nCorrígelas (detalles: /spec-doctor ${slug}), o pasa force: true (CLI: --force) para registrar la aprobación igualmente — queda marcada como forzada.`,
      approveNothing: (phase, slug, file) => `Nada que aprobar: '${phase}' no tiene artefacto en '${slug}' (${file} no existe, o su track está desactivado) — ni con force.`,
      approveForced: (ids) => `Aprobado con force — las verificaciones que fallan quedan registradas con la aprobación: ${ids}.`,
      forcedGates: (list) => `aprobado con force pese a verificaciones que fallan: ${list}`,
      finishRootCause: "bug.md → Causa Raíz sin rellenar — ninguna corrección antes de conocer la causa",
      finishPlaceholders: (list) => `placeholders de la plantilla sin rellenar en la cadena de la spec: ${list}`,
      finishChanged: (list) => `modificados tras su aprobación (revisar y volver a aprobar): ${list}`,
      bugGate: (n, first) => `La tarea ${n} aún no puede completarse: bug.md → Causa Raíz está sin rellenar. Ninguna corrección antes de que la causa raíz esté escrita en bug.md — haz primero la tarea ${first} (encuentra la causa raíz con evidencia y escríbela allí).`,
      bugGateFirst: (n, first) => `La tarea ${n} aún no puede completarse: bug.md → Causa Raíz está sin rellenar y ninguna tarea la escribe — solo la tarea ${first} puede completarse hasta que la causa raíz esté escrita en bug.md (ninguna corrección antes de la causa raíz).`,
      fill: (file, what, hint) => `Rellena ${file} — ${what}; luego ${hint}.`,
      fillMissing: "aún no existe",
      fillEmpty: "no tiene contenido además de los títulos",
      fillPlaceholders: (n, first) => `${n} placeholder(s) de la plantilla sin rellenar (primero: ${first})`,
      fillHint: {
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
      clarifyPlaceholders: (file, n, list) => `Sustituye los ${n} placeholder(s)/TBD de la plantilla en ${file}: ${list}`,
      hookPlaceholders: (n, list) => `Placeholders de la plantilla: ${n} sin rellenar en requirements.md (${list}) — sustitúyelos antes de aprobar los requisitos.`,
    },
    // @wp WP5 <<<

    // @wp WP6 msg-es >>>
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
      wUnknownRef: (task, ref) => `tarea ${task}: la referencia _Requirements:_ '${ref}' no corresponde a ningún criterio importado — se conserva tal cual`,
      wUnknownRefLine: (line, ref) => `tasks.md, línea ${line}: la referencia _Requirements:_ '${ref}' no corresponde a ningún criterio importado — se conserva tal cual`,
      wCarried: (list) => `copiado tal cual, sin correspondencia con historias o criterios (revísalo): ${list}`,
      wNoRefs: "las tareas importadas no tienen referencias _Requirements:_ — añádelas para que trace_check asocie cada AC a una tarea",
      wNoTasks: "el origen no tiene tasks.md — se conservó el tasks.md del scaffold",
      wNoDesign: (file) => `el origen no tiene ${file} — se conservó el design.md del scaffold`,
      wNoRequirements: (file) => `no se encontraron requisitos en ${file}`,
      wRemoved: (name) => `el requisito REMOVED '${name}' no se importó`,
      wRenamed: (from, to) => `requisito RENAMED '${from}' → '${to}' (importado con el nombre nuevo)`,
      wSkipped: (files) => `no importados (se quedan donde están): ${files}`,
      wUnreadable: (file) => `${file} apunta fuera del proyecto — omitido`,
      done: (tool, rel, slug, label, lang) => `Importado de ${tool} ${rel} → función '${slug}' [${label}] (${lang})`,
      mapping: (n, sample) => `  correspondencia: ${n} ID(s)` + (sample ? ` — ${sample}` : ""),
    },
    // @wp WP6 <<<

    // @wp WP7 msg-es >>>
    appendTasks: {
      heading: "Fase: Convergencia",
      checkpoint: "las tareas de convergencia están completadas y verificadas — la spec y el código vuelven a coincidir.",
      noTasks: "Indica al menos una tarea: tasks = [{ text, requirements?, implements?, verify?, story?, parallel? }].",
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
    },
    // @wp WP7 <<<

    // @wp WP8 msg-es >>>
    // @wp WP8 <<<

    // @wp WP9 msg-es >>>
    deepTrace: {
      kinds: {
        uncoveredEdgeCases: "casos límite (EC) sin tarea ni prueba que los cubra",
        uncoveredNfr: "requisitos no funcionales (NFR) sin tarea ni prueba que los cubra",
        uncoveredSuccessCriteria: "criterios de éxito (SC) sin prueba ni paso del quickstart que los verifique",
        phantomSecondary: "las tareas / el plan de pruebas citan IDs EC/NFR/SC desconocidos (¿erratas?)",
        plannedNotInCode: "pruebas planificadas que ningún fichero de prueba nombra (pon el T-ID en el nombre de la prueba)",
        inCodeNotInPlan: "T-IDs en el código de prueba que ningún plan de pruebas incluye",
      },
      secondaryOk: (n) => `los ${n} IDs EC/NFR/SC cubiertos`,
      testsInCodeOk: (n) => `cada T-ID planificado que una tarea hecha pone en verde aparece en un fichero de prueba (${n})`,
      testsInCodeMissing: (list) => `puestos en verde por tareas hechas, pero ningún fichero de prueba los nombra: ${list} — pon el T-ID en el nombre de la prueba (test("T-01 …"), def test_T01_…)`,
      truncated: "la búsqueda de ficheros de prueba se detuvo en el límite — algunos ficheros no se leyeron",
      codeSummary: (found, planned, scanned, truncated) => `  pruebas en el código: ${found}/${planned} T-ID(s) planificado(s) nombrado(s) en ${scanned} fichero(s) de prueba` + (truncated ? " (búsqueda truncada en el límite)" : ""),
      warningsHead: "Avisos (no bloquean):",
    },
    // @wp WP9 <<<

    // @wp WP10 msg-es >>>
    // @wp WP10 <<<

    // @wp WP11 msg-es >>>
    // @wp WP11 <<<
  },
};

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
    evalsRule: "This change touches an AI path: run the eval harness afterwards — golden holds or improves, adversarial holds — and put the scores in the report.",
    checkpoint: "When this story's last task is done, the controller stops for human review at the checkpoint:",
    report: "## Report",
    reportTo: (p) => `Write your full report to \`${p}\`, then reply with only the status line (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED), your commits, a one-line test summary and any concerns.`,
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
        "Faz commit com uma mensagem convencional que cite a tarefa (ex.: `feat(âmbito): … — tarefa #N`).",
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
    evalsRule: "Esta alteração toca num caminho de IA: corre o harness de evals no fim — o golden mantém-se ou melhora, o adversarial mantém-se — e põe as pontuações no relatório.",
    checkpoint: "Quando a última tarefa desta história estiver feita, o controlador pára para revisão humana no checkpoint:",
    report: "## Relatório",
    reportTo: (p) => `Escreve o relatório completo em \`${p}\` e responde só com a linha de estado (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED), os teus commits, um resumo de uma linha dos testes e eventuais preocupações.`,
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
    evalsRule: "Este cambio toca una ruta de IA: ejecuta el harness de evals al final — golden se mantiene o mejora, adversarial se mantiene — y pon las puntuaciones en el informe.",
    checkpoint: "Cuando la última tarea de esta historia esté hecha, el controlador se detiene para revisión humana en el checkpoint:",
    report: "## Informe",
    reportTo: (p) => `Escribe el informe completo en \`${p}\` y responde solo con la línea de estado (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED), tus commits, un resumen de una línea de las pruebas y cualquier duda.`,
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

  if (d.tests.length) {
    push("", t.tests);
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

  if (d.design.toc.length) {
    push("", t.design, t.designToc(d.design.path) + " " + d.design.toc.join(" · "));
    d.design.included.forEach((s) => push("", "### " + s.title, s.body));
    if (d.design.omitted.length) push("", t.designOmitted + " " + d.design.omitted.join(" · "));
  }

  const constraints = d.globalConstraints || [];
  if (constraints.length || d.steering.length) {
    push("", t.steering);
    if (constraints.length) push(t.constraintsIntro, ...constraints);
    if (constraints.length && d.steering.length) push("");
    if (d.steering.length) push(t.steeringRead + " " + d.steering.map((p) => "`" + p + "`").join(", "));
  }

  if (d.unresolved.acs.length || d.unresolved.tests.length) {
    push("", t.unresolved, t.unresolvedNote, ...[...d.unresolved.acs, ...d.unresolved.tests].map((id) => "- " + id));
  }

  push("", t.dod, ...t.loopRules[d.loop].map((r, i) => `${i + 1}. ${r}`));
  let extra = t.loopRules[d.loop].length;
  if (d.metrics.length) push(`${++extra}. ${t.metricsRule}`);
  if (d.evals.length && d.loop !== "ai-prompt") push(`${++extra}. ${t.evalsRule}`);
  if (verify.length) push(`${++extra}. ${t.verifyRule}`);
  if (task.checkpoint) push("", t.checkpoint, "**Checkpoint:** " + task.checkpoint);

  push("", t.report, t.reportTo(d.reportPath), "");
  return out.join("\n");
}

// ===========================================================================
// Public API — thin dispatchers that resolve the language and delegate.
// ===========================================================================

function L(lang) { return BUILD[normalizeLang(lang)]; }

module.exports = {
  LANGS,
  normalizeLang,
  // artifact builders
  classification: (a, lang) => L(lang).classification(a),
  requirements: (a, lang) => L(lang).requirements(a),
  trackDesignBlock: (track, lang) => L(lang).trackDesignBlock(track),
  design: (a, lang) => L(lang).design(a),
  tasks: (a, lang) => L(lang).tasks(a),
  testPlan: (name, lang, tracks) => L(lang).testPlan(name, tracks), // tracks: which template ACs get a planned test
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
