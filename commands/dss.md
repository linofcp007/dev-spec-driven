---
description: Short alias for /spec-status — feature or project status.
disable-model-invocation: true
argument-hint: "[feature name | blank for all]"
---

Short alias for `/spec-status` — the **dev-spec-driven** skill status workflow.

Target: $ARGUMENTS

Read `${CLAUDE_PLUGIN_ROOT}/commands/spec-status.md` and follow it exactly, with the target above as its arguments: that
file is the whole procedure (this alias adds nothing of its own). Should it be unreadable: run `spec_status` for a named
feature (kind, flow, tracks, phase, tasks with their `verified` flag, each active track's section completeness, eval
state) or `spec_list` for all features. Keep it concise. Respond in the user's language (EN/PT/ES).
