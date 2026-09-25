---
description: Record human approval of a phase gate for a feature (auditable, resumable). PT - aprova um gate de fase. ES - aprueba un gate de fase.
argument-hint: "[feature name] [phase] [--force]"
---

Use the **dev-spec-driven** skill approval gate.

Args: $ARGUMENTS

Only record an approval the user actually gave. Run `spec_doctor` first and show the verdict. Then call the
`spec_approve` MCP tool with the feature name and phase (one of: classification, requirements, design,
test-plan, eval-plan, tests, tasks, execution; CLI `dev-spec approve <feature> <phase> [--by NAME]`).

**The approval is a gate:** that phase's checks run first and any failure **refuses** it, listing the failing
check ids — e.g. requirements: `ears`, `placeholders`, `clarifications`, `success-criteria`, `priorities`,
`ac-uniqueness` (bugfix: `reproduction`); design: `placeholders`, `constitution-check`, the active
`saas-sections` / `ai-sections`, `clarifications` (bugfix: `root-cause` — its design approval signs off
`bug.md`); test-plan: `placeholders`, `traceability`; eval-plan: `placeholders`; tasks: `placeholders`,
`traceability`. On a refusal, show the failing checks and fix them (or ask the user to) — don't retry blindly.

`force: true` (CLI `--force`) records it anyway as a **forced** approval with the failing check ids: use it only
when the user explicitly chooses to accept the failures, and say so. Forced approvals stay visible —
`spec_doctor`'s `approval-gates` check warns, the roadmap lists them, and `spec_metrics` counts them. A phase with
no artifact (eval-plan without +ai, test-plan without +tdd, a missing file) can't be approved, not even forced.

Each approval writes `.specs/<feature>/.state.json` (latest approval + content fingerprint), appends to
`approvalHistory` and saves a snapshot `.specs/<feature>/.history/<phase>@<n>.md` — the baseline `/spec-impact`
diffs a later edit against. Confirm what was recorded. Respond in the user's language (EN/PT/ES).
