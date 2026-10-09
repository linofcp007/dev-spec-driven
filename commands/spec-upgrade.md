---
description: After a plugin update — audit .specs/ against the current rules, then apply the safe migrations once you confirm.
disable-model-invocation: true
argument-hint: "[--apply]"
---

Args: $ARGUMENTS — the procedure in detail: `${CLAUDE_PLUGIN_ROOT}/skills/dev-spec-driven/references/change-management.md`
→ Upgrading after a plugin update.

The plugin not updated yet? Say how (Claude Code: `/plugin marketplace update`, then restart the session; a clone:
`git pull`) and stop.

1. **Audit (read-only)** — `spec_upgrade {}`. Show the summary, then the features grouped **blocked**, **needs attention**,
   **ok** — each with its status, what the current rules flag (failing checks, pending gates, artifacts changed since
   approval, approvals without history, unverified tasks, drift, bare `AC-n` IDs to renumber), its next step and its
   review — then `plan`: what apply would change.
2. **Apply — only after the user says yes** (`--apply` given, or they agree): `spec_upgrade {apply: true}`. It never edits
   an artifact, approves, ticks or deletes: it saves inferred tracks, records history baselines, completes
   `.specs/.gitignore`, stamps `meta.specVersion` and writes `.specs/UPGRADE.md`. Report `migrations`, `skipped` and
   `errors`.
3. **Review, feature by feature — offer, don't impose**: `review: "critic"` → the `dev-spec-driven:spec-critic` agent
   over its `reviewArtifacts`; `"converge"` → `/spec-review <feature> converge` (plus the critic on the changed
   artifacts); `"none"` → nothing beyond drift. No subagents: the same review inline, read-only.
4. **Propose an action list per feature** and change nothing without the user's OK — each change through the normal
   gates: `spec_approve` on their yes, `spec_impact`, `spec_append_tasks`, and for an unverified tick
   `node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" done <f> <n> --run`. Tick `.specs/UPGRADE.md` as items are done.

Respond in the user's language (EN / PT / ES).
