---
description: Track-aware local pre-merge review against the full spec chain (no PR or CI needed). PT - revisão local antes do merge. ES - revisión local antes del merge.
argument-hint: "[feature name or diff scope]"
---

Use the **dev-spec-driven** skill code-review workflow.

Scope: $ARGUMENTS

Review against the full chain, gating checks by the feature's active tracks:
- **Spec compliance** — does the code match the design?
- **Constitution** — the code honours every principle in `.specs/steering/constitution.md`; anything that
  breaks one is justified in the design's Complexity Tracking table, or it is sent back.
- **+tdd** — red-first evidence in git history (test commits before impl); every AC has a test.
- **+saas** — scale sections filled; every new query has `WHERE tenant_id = ?`; observability points
  added; new hot paths hit cache (cost).
- **+ai** — eval delta present in the merge summary / commit; prompt changes live in versioned files (not inline
  strings); PII-to-model reviewed; cost tracking on new model calls.
- **+sec** — the threat model's mitigations are in the code; authn + object-level authz on every new endpoint (deny
  by default); no secret, token or stack trace in responses or logs; the abuse-case tests exist and the scans ran.
- **+privacy** — only the fields the data inventory lists are collected; retention / deletion implemented; export and
  erasure reach every store the inventory names; no personal data in logs or sent to an unlisted processor.
- **+dist** — no database commit followed by a direct publish / cache / API write (outbox, inbox or saga as the design
  says); consumers idempotent; retries with timeouts, backoff + jitter and a DLQ; the concurrency control the design names.
- **+api** — the contract file matches the handlers (every status code, error code and header); no breaking change inside
  a version (the diff against the published contract is clean); errors are problem+json; creates honour Idempotency-Key.
- **Security** — injection, authz, data exposure — always.

Run `trace_check` to confirm coverage. Report findings grouped by severity.
For an audit trail, `trace_check {name, matrix: true}` (CLI `dev-spec trace <feature> --matrix`; `--csv` for a
spreadsheet, `spec_export {format: "csv"}` to write `.specs/exports/<feature>.rtm.csv`) gives the requirements
traceability matrix — one row per AC / EC / NFR / SC with its status, tasks, tests, evidence, decisions and approval.
