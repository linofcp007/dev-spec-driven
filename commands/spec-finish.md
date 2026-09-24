---
description: Close a feature locally — verify it's really done, draft the merge summary from the spec, then merge locally or keep the branch (no PRs, no CI). PT - fecha a feature localmente (verifica, resumo do merge a partir da spec). ES - cierra la función en local (verifica, resumen del merge desde la spec).
argument-hint: "[feature name]"
---

Use the **dev-spec-driven** skill to finish a feature.

Feature: $ARGUMENTS

1. Run `spec_finish {name, write: true}` (CLI: `dev-spec finish <feature> --write`). If `readyToFinish` is
   false, show the blockers (doctor fails, open tasks, tasks ticked without evidence, pending approvals)
   and stop — fix those first.
2. **Verify fresh, now** (`references/verification.md`): run the full test suite and every check the
   report lists for the active tracks (+saas load test and observability, +ai cost and safety, bugfix: the
   reproduction no longer reproduces). Show the commands and their output. No evidence, no "done".
3. Show the merge title and summary generated from the spec chain
   (`.specs/<feature>/.execution/merge-summary.md`) and ask the user to approve the `execution` phase
   (`spec_approve`).
4. Offer exactly two options: **1. merge into the base branch locally** (fast-forward when possible, the
   summary as the commit message) **· 2. keep the branch as-is.** Integration is local by design: pull requests and
   CI are not part of this workflow (they cost money and aren't needed). Execute only
   the option the user picks; after merging, run the full suite again on the result. Pushing the merged
   base branch is a separate step the user must approve.
5. Clean up: delete `.specs/<feature>/.execution/` once merged; the roadmap already
   shows the feature at 100%.

Respond in the user's language (EN/PT/ES).
