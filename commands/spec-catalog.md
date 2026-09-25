---
description: Living catalog — what the system does today: every feature and every AC in one generated .specs/SPECS.md, superseded criteria marked. PT - catálogo vivo das specs. ES - catálogo vivo de las specs.
argument-hint: "[--write]"
---

Use the **dev-spec-driven** skill, living catalog (`references/change-management.md` → Catalog).

Args: $ARGUMENTS

Call the `spec_catalog` MCP tool (CLI `dev-spec catalog [--write]`). It lists every feature — active,
complete/finished and archived — with its status, and every AC ID with a one-line EARS text, grouped by
feature. A criterion a later feature replaced is shown as **superseded**, naming the ID that replaces it.

- Without `write` it returns the structure plus the markdown: summarize it (features, ACs, superseded ones).
- With `write: true` (`--write`) it (re)writes **`.specs/SPECS.md`**, carrying the AUTO-GENERATED marker, in the
  project language. A hand-written `SPECS.md` (no marker) is never overwritten — the result is an error; tell the
  user. Once `SPECS.md` exists, every mutator that refreshes the roadmap refreshes it too; never hand-edit it.

**Superseding a criterion.** When a new feature changes behaviour an older feature specified, mark the NEW
criterion with the English-stable marker `_Supersedes: <feature>/US-n.AC-m[, …]_` (on the criterion's line, a
sub-line under it, or its table row), e.g. `1. **US-1.AC-2** — WHEN … THE SYSTEM SHALL … _Supersedes: login/US-2.AC-3_`.
`trace_check` reports markers that resolve to nothing as `phantomSupersedes` warnings — fix the reference.
Respond in the user's language (EN/PT/ES).
