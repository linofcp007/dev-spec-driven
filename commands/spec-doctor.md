---
description: Health-check a feature before it advances a phase; --deep adds a semantic review by the spec critic.
disable-model-invocation: true
argument-hint: "[feature] [--deep]"
allowed-tools: mcp__plugin_dev-spec-driven_spec-driven__spec_doctor
---

Feature: $ARGUMENTS

Run `spec_doctor {name}` (CLI `dev-spec doctor <feature>`, exit 1 on a fail) and report: each check — pass, warn or fail —,
the recorded approvals and the `readyToAdvance` verdict. List exactly what to fix before advancing (the fails), then the
warnings worth acting on; `nextGate` says whether the next approval would pass (`missingRoles`: the roles still to
sign). Each check carries its own detail; every check id is listed in
`${CLAUDE_PLUGIN_ROOT}/skills/dev-spec-driven/references/tooling-reference.md` → spec_doctor.

**`--deep`** — also review the MEANING of the artifact the next gate approves (a bugfix's requirements: bug.md with
it; the classification gate: nothing yet — say so, or review requirements.md when it is filled), with fresh read-only
reviewers: the `dev-spec-driven:spec-critic` agent in gate mode (the feature folder, that artifact, the active tracks,
this doctor result), plus — by this result's `size` (none: no size) — a cold read (`Mode: naive` on the prompt's first line; of
requirements.md, design.md or bug.md only) at m / l or no size and a second gate critic at l — all in one message,
never with your own reasoning. Triage and present their findings beside the doctor's verdict as
`${CLAUDE_PLUGIN_ROOT}/skills/dev-spec-driven/references/critic-review.md` says (fix · contest · ask; one re-audit).
Without a subagent tool, run the gate checklist (`${CLAUDE_PLUGIN_ROOT}/agents/spec-critic.md`) yourself and say the
cold read was skipped.

Offer the fixes; change nothing without the user's OK. Respond in the user's language (EN / PT / ES).
