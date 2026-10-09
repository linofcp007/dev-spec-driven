---
description: Status of a feature — tracks, phase, task progress, verification and eval state — or of every feature.
disable-model-invocation: true
argument-hint: "[feature | blank for all]"
allowed-tools: mcp__plugin_dev-spec-driven_spec-driven__spec_status, mcp__plugin_dev-spec-driven_spec-driven__spec_next_action
---

Target: $ARGUMENTS

- **A feature** — `spec_status {name}`: its kind and flow, tracks and size, current phase, artifacts, tasks done / total
  with each one's `verified` flag, the next task, each active track's design sections present vs filled, and the +ai
  eval state.
- **No name** — `spec_status {}`: every feature with its tracks, phase and task progress (its kind when a bugfix, a spike
  or a change; its flow when design-first).

Keep it concise and scannable. "What now?" → `spec_next_action {name}`; dates and dependencies → `/roadmap`. Respond in
the user's language (EN / PT / ES).
