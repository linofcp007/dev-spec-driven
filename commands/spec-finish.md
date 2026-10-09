---
description: Close a feature locally — verify it is really done, draft the merge summary, then merge or keep the branch.
disable-model-invocation: true
argument-hint: "[feature] [--run]"
---

Feature: $ARGUMENTS — an optional simplification pass (`/spec-review <feature> simplify`) changes code: run it before
this, not after.

1. `spec_finish {name, write: true}` (CLI `dev-spec finish <feature> --write`). Not `readyToFinish` → show the
   **blockers** and stop: failing doctor checks, open or unverified tasks, project checks without a passing run on the
   current code (`suite-evidence`), pending approvals, an artifact changed since its approval, placeholders, a bugfix's
   root cause. Show the warnings too — each one deserves a decision.
2. **Verify fresh, now** — the full suite and every check the report lists for the active tracks. With project checks set,
   record them: `spec_finish {name, evidence: [{name, command, exitCode, summary}]}`, or
   `node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" finish <feature> --run` (`--run` given: run that). No shell? Ask the user to
   run them and paste the output — never record a run nobody made, never send a subagent to look for a shell.
3. Show the merge title and summary (`.specs/<feature>/.execution/merge-summary.md`), then ask the user **explicitly**
   whether they sign off the `execution` phase, and call `spec_approve {name, phase: "execution"}` only on their yes.
   **A green run is evidence, not the sign-off:** after the run, show it and ask. A ready written finish also records
   the drift baseline — finish again after last-minute code changes. Forced approvals appear under "Waived gates".
4. Offer exactly two options: **1. merge into the base branch locally** (fast-forward when possible, the summary as the
   message; a feature on its own branch: `git switch <base>`, then `git merge <name>`) **· 2. keep the branch as it is.**
   Run only the one the user picks; after a merge, the full suite again. Pushing is a separate step the user approves.
5. Once merged, delete `.specs/<feature>/.execution/` (keep `.history/`); offer `/spec-report metrics <feature> --write`
   (a retro), `/spec-report catalog --write` and, for a release, `/spec-report changelog`. A spike finishes once its
   decision is written.

Respond in the user's language (EN / PT / ES).
