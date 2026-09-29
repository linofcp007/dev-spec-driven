---
description: Phase 2 — produce the technical design, including the mandatory sections for active tracks. PT - cria o design técnico. ES - crea el diseño técnico.
argument-hint: "[feature name]"
---

Use the **dev-spec-driven** skill, Phase 2 (Design).

Feature: $ARGUMENTS

Re-read steering + approved requirements, scan the codebase for patterns to match, then write
`design.md`. Include the base sections (overview, architecture with ≥1 Mermaid diagram, data
models, API contracts, security, error handling, testing strategy, **Constitution Check** against each
principle of `steering/constitution.md`, Complexity Tracking) PLUS the mandatory sections for
the active tracks: Testability Notes (+tdd); the 5 scale sections (+saas); the 10 AI sections
(+ai); the 5 `[SEC]` sections — threat model (STRIDE), security requirements (ASVS level), authn/authz, secrets,
security testing (+sec); the 6 `[PRIVACY]` sections — data inventory, lawful basis, retention, data subject rights,
processors & transfers, DPIA (+privacy); the 5 `[DIST]` sections — consistency model, cross-system writes (every dual
write → outbox / inbox / saga, or an accepted risk), delivery & idempotency, concurrency, failure modes (+dist). No mandatory section may be blank — an honest "not needed because X" is
acceptable; remove each `> **TODO**` sentinel and template placeholder as you fill it (saving `design.md` reports what
is still open, and the design approval is refused while a track section, the Constitution Check or a placeholder is
unfilled). Keep the markers `[SaaS]` / `[AI]` / `[SEC]` / `[PRIVACY]` / `[DIST]` exactly (English, case-sensitive). In an
existing codebase, fill `integration-plan.md` alongside. A design decision worth keeping goes to `/spec-decide`. See
`references/scale-design-template.md`, `references/mandatory-ai-design-sections.md`,
`references/security-track.md`, `references/privacy-track.md` and `references/distributed-data-patterns.md`. On a design-first feature this phase comes before
the requirements (`references/design-first.md`). Present for approval.
