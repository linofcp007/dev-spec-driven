---
description: Track-aware local pre-merge review against the full spec chain (no PR or CI needed). PT - revisão local antes do merge. ES - revisión local antes del merge.
argument-hint: "[feature name or diff scope]"
---

Use the **dev-spec-driven** skill code-review workflow.

Scope: $ARGUMENTS

Review against the full chain, gating checks by the feature's active tracks:
- **Spec compliance** — does the code match the design?
- **+tdd** — red-first evidence in git history (test commits before impl); every AC has a test.
- **+saas** — scale sections filled; every new query has `WHERE tenant_id = ?`; observability points
  added; new hot paths hit cache (cost).
- **+ai** — eval delta present in the PR; prompt changes live in versioned files (not inline
  strings); PII-to-model reviewed; cost tracking on new model calls.
- **Security** — injection, authz, data exposure — always.

Run `trace_check` to confirm coverage. Report findings grouped by severity.
