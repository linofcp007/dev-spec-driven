---
description: After updating the plugin, audit the project's .specs/ against the new rules, apply the safe migrations (after you confirm) and review what isn't implemented yet. PT - atualiza as specs de uma versão anterior. ES - actualiza las specs de una versión anterior.
argument-hint: "[--apply]"
---

Use the **dev-spec-driven** skill, upgrade workflow (`references/change-management.md` → §10 Upgrading after a plugin update).

Args: $ARGUMENTS

**When.** The plugin was just updated — Claude Code: `/plugin marketplace update` then restart the session; a
clone: `git pull` — and the project already has a `.specs/` from an older version (the session-start hook says
`⬆ .specs/ was created with an older dev-spec …`). Older specs keep working, but nothing reviewed them against the
new rules, and approvals made before 1.13 have no history baseline (`spec_impact` then answers `fingerprint-only`).
If the plugin itself isn't updated yet, say how (above) and stop.

**Steps**
1. **Audit (read-only).** Call the `spec_upgrade` MCP tool `{}` (CLI: `dev-spec upgrade`). Show the result grouped
   like its `lines`: the summary, then **blocked** (doctor fails), **needs attention** and **ok** — per feature its
   status (not started · planning · executing · complete · finished), what the rules flag (failing checks, pending
   gates, artifacts changed since approval, approvals without history, unverified tasks, drift), next_action's step
   and the review recommendation. Then list `plan`: what apply would change.
2. **Apply — only after the user says yes** (skip it if `$ARGUMENTS` has no `--apply` and they decline, or `plan` is
   empty). Call `spec_upgrade {apply: true}` (CLI `dev-spec upgrade --apply`). It never edits an artifact, approves,
   ticks or deletes: it saves inferred tracks to `.state.json`, records pre-history approvals and saves a history
   baseline for each approval whose file still matches its fingerprint, completes `.specs/.gitignore`, stamps
   `roadmap.json → meta.specVersion` and writes `.specs/UPGRADE.md` (a checklist; a hand-written one is left alone).
   Report `migrations`: done, `skipped` (re-approve to start the history) and `errors` (the stamp waits for them).
3. **Review, feature by feature — offer, don't impose.**
   - `review: "critic"` (no task ticked yet — the specs created but not implemented): offer to dispatch the
     **`dev-spec-driven:spec-critic`** agent (read-only) over its `reviewArtifacts` (requirements, design, test/eval
     plan, tasks — skip files that are still untouched templates: the next step is to fill them), phase by phase,
     against the current rules — give it what its Inputs section asks for (the feature folder, the artifact, the
     active tracks, the latest `spec_doctor` result).
   - `review: "converge"` (some tasks done, some open): offer the **`dev-spec-driven:spec-reviewer`** converge pass
     (done tasks against their ACs — `references/subagent-execution.md` → Converge mode, `/spec-converge`), plus the
     critic on the changed / unapproved `reviewArtifacts`.
   - `review: "none"` (complete / finished): nothing to review beyond drift (`/spec-drift`) when it is reported.
   - No subagents available (another tool, or the user prefers it): run the same review inline, read-only.
4. **Collect the findings into a proposed action list per feature** — fill, fix, re-approve, verify, re-finish,
   follow-up tasks — and change nothing without the user's OK. Each change goes through the normal gates:
   re-approvals with `spec_approve` (`/approve`), edits after an approval with `spec_impact` (`/spec-impact`, reopen
   only with their OK), follow-up work with `spec_append_tasks` (`/spec-converge`), unverified ticks with
   `dev-spec done <f> <n> --run`. Tick the boxes of `.specs/UPGRADE.md` as items are done; re-run the audit for the
   current state.

A second apply changes nothing and says so. `dev-spec upgrade` exits 0 with a report, 1 only on an error.

Respond in the user's language (EN/PT/ES).
