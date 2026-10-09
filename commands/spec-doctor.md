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

**`--deep`** — also review the MEANING of the artifact the next gate approves: dispatch the
`dev-spec-driven:spec-critic` agent (read-only) with the feature folder, that artifact, the active tracks and this doctor
result, and present its verdict beside the doctor's. Without a subagent tool, run its checklist
(`${CLAUDE_PLUGIN_ROOT}/agents/spec-critic.md`) yourself.

Offer the fixes; change nothing without the user's OK. Respond in the user's language (EN / PT / ES).
