---
description: Phase 2 — produce the technical design, including the mandatory sections for active tracks. PT - cria o design técnico. ES - crea el diseño técnico.
argument-hint: "[feature name]"
---

Use the **dev-spec-driven** skill, Phase 2 (Design).

Feature: $ARGUMENTS

**A sized feature** (`spec_status` → size): at **s** the three weigh sections below are ONE section, **Decisions, reuse &
risks** (one answer each), and each track keeps only its core-tier sections — an extended one may stay out, or be
answered in one line `n/a — <why it does not apply>`; at **m / l** a section two active tracks both ask for is written
once (the scaffold says where, e.g. `[OBS] Telemetry` also answers `[SaaS] Observability`), and a core section a track
owns (API Contracts / Error Handling under +api, Security Considerations under +sec, Testing Strategy under +tdd) is
left out. **At every size a section is filled with your own text:** deleting the `> **TODO**` line and leaving the
template's guidance bullet is not an answer (the design approval refuses it). Error Handling points to the IF…THEN
criteria instead of asking again.

**Every design weighs its choices:** besides the sections below, fill **Alternatives & Trade-offs** — for each
key decision (strong vs eventual consistency, monolith vs service, sync vs async, optimistic vs pessimistic locking…)
at least two options, each with its pros, cons and cost of being wrong, the one chosen and why — and **Risks** (risk ·
likelihood · impact · mitigation · owner; technical, delivery, data, business: what would make this design wrong).
`spec_doctor` warns (`design-tradeoffs`, `design-risks`) when either is missing, still the template, or the trade-offs
list fewer than 2 options — a warning, never a refusal; their leftover template placeholders refuse the approval like
any other section's.

**Every design names what it reuses:** fill **Reuse & Integration** — the existing modules, components, helpers and
services this feature reuses (with their paths), what it extends, what is new and why nothing existing fits, and where
the new code lives (module boundaries: what it exposes, what it may import — features depend on shared code, never the
reverse). Search before writing it (`references/code-reuse-and-quality.md`: by concept and synonyms, the shared folders
`steering/structure.md` names, `.specs/SPECS.md`); a greenfield project says so in one line. `spec_doctor` warns
`design-reuse` when it is missing, empty or still the template (a brownfield feature's filled `integration-plan.md` →
Integration Points counts) — a warning, never a refusal. Name the existing files a task extends in its `_Implements:_`:
the task brief quotes the section's entries for that task.

Re-read steering + approved requirements, scan the codebase for patterns to match, then write
`design.md`. Include the base sections (overview, architecture with ≥1 Mermaid diagram, data
models, API contracts, security, error handling, testing strategy, **Constitution Check** against each
principle of `steering/constitution.md`, Complexity Tracking) PLUS the mandatory sections for
the active tracks: Testability Notes (+tdd); the 5 scale sections (+saas); the 10 AI sections
(+ai); the 5 `[SEC]` sections — threat model (STRIDE), security requirements (ASVS level), authn/authz, secrets,
security testing (+sec); the 6 `[PRIVACY]` sections — data inventory, lawful basis, retention, data subject rights,
processors & transfers, DPIA (+privacy); the 5 `[DIST]` sections — consistency model, cross-system writes (every dual
write → outbox / inbox / saga, or an accepted risk), delivery & idempotency, concurrency, failure modes (+dist); the 5 `[API]` sections — API contract, versioning &
compatibility, error model, pagination / idempotency / concurrency, rate limits & quotas (+api — `references/api-design-patterns.md`); the 5 `[UI]` sections — design-system
usage, UI states (a state matrix per view), accessibility (WCAG 2.2 AA), responsiveness & i18n, UI performance budget (+ui —
`references/ui-design-patterns.md`); the 5 `[OBS]` sections — SLIs & SLOs, telemetry, alerting & runbooks, rollout & rollback,
health & capacity (+obs — `references/observability-patterns.md`); the 5 `[DATA]` sections — data contracts & schema evolution,
data quality, pipeline idempotency & backfills, lineage & ownership, retention & cost (+data — `references/data-pipeline-patterns.md`). No mandatory section may be blank — an honest "not needed because X" is
acceptable; remove each `> **TODO**` sentinel and template placeholder as you fill it (saving `design.md` reports what
is still open, and the design approval is refused while a track section, the Constitution Check or a placeholder is
unfilled). Keep the markers `[SaaS]` / `[AI]` / `[SEC]` / `[PRIVACY]` / `[DIST]` / `[API]` / `[UI]` / `[OBS]` / `[DATA]` exactly (English, case-sensitive). In an
existing codebase, fill `integration-plan.md` alongside. A design decision worth keeping goes to `/spec-decide`. See
`references/scale-design-template.md`, `references/mandatory-ai-design-sections.md`,
`references/security-track.md`, `references/privacy-track.md` and `references/distributed-data-patterns.md`. On a design-first feature this phase comes before
the requirements (`references/design-first.md`). Present for approval.
