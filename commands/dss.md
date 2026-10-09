---
description: Short alias for /spec-status — a feature's status, or every feature's.
disable-model-invocation: true
argument-hint: "[feature | blank for all]"
allowed-tools: mcp__plugin_dev-spec-driven_spec-driven__spec_status, mcp__plugin_dev-spec-driven_spec-driven__spec_next_action
---

Short alias for `/spec-status`. Target: $ARGUMENTS

Read `${CLAUDE_PLUGIN_ROOT}/commands/spec-status.md` and follow it exactly, with the target above as its arguments: that
file is the whole procedure. Should it be unreadable: `spec_status {name}` for a feature (tracks, phase, tasks with their
`verified` flag, track sections, eval state), `spec_status {}` for every feature. Keep it concise. Respond in the user's
language (EN / PT / ES).
