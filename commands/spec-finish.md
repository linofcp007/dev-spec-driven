---
description: Close a feature locally — verify it's really done, draft the merge summary from the spec, then merge locally or keep the branch (no PRs, no CI). PT - fecha a feature localmente (verifica, resumo do merge a partir da spec). ES - cierra la función en local (verifica, resumen del merge desde la spec).
argument-hint: "[feature name]"
---

Use the **dev-spec-driven** skill to finish a feature.

Feature: $ARGUMENTS

1. Run `spec_finish {name, write: true}` (CLI: `dev-spec finish <feature> --write`). If `readyToFinish` is
   false, show the **blockers** and stop — fix those first: failing doctor checks, open tasks, tasks ticked
   without a passing run (no evidence, only a note on a runnable `_Verify:_`, a failed or stale run), pending
   approvals, an artifact **changed since its approval** (`/spec-impact`, then re-approve), template
   **placeholders** left anywhere in the chain, and — for a bugfix — an unwritten root cause. Show the
   **warnings** too (edge cases / NFRs / success criteria no task or test covers, planned tests no test file
   names): they don't block, but each one deserves a decision.
2. **Verify fresh, now** (`references/verification.md`): run the full test suite and every check the
   report lists for the active tracks (+saas load test and observability, +ai cost and safety, bugfix: the
   reproduction no longer reproduces). Show the commands and their output. No evidence, no "done".
3. Show the merge title and summary generated from the spec chain
   (`.specs/<feature>/.execution/merge-summary.md`) and ask the user to approve the `execution` phase
   (`spec_approve`) — its gate is this report's blockers, so it is refused while the feature isn't ready (only an
   explicit `force` records it, flagged as forced; `spec_metrics` reads `finished` from it or from the written finish). A written finish of a **ready** feature also records the **drift baseline** (a hash of every
   file its `_Implements:_` markers name) — `/spec-drift` compares against it later; re-run `finish --write` after
   last-minute code changes so the baseline matches what ships.
4. Offer exactly two options: **1. merge into the base branch locally** (fast-forward when possible, the
   summary as the commit message) **· 2. keep the branch as-is.** Integration is local by design: pull requests and
   CI are not part of this workflow (they cost money and aren't needed). Execute only
   the option the user picks; after merging, run the full suite again on the result. Pushing the merged
   base branch is a separate step the user must approve.
5. Clean up: delete `.specs/<feature>/.execution/` once merged (keep `.history/` — it is the spec's change
   history); the roadmap already shows the feature at 100%. Offer `/spec-metrics <feature> --write` for a
   pre-filled `retro.md`, and `/spec-catalog --write` to refresh `.specs/SPECS.md`.

Respond in the user's language (EN/PT/ES).
