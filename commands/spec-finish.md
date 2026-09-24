---
description: Close a feature — verify it's really done, draft the PR from the spec, then merge, open a PR or keep the branch. PT - fecha a feature (verifica, gera o PR a partir da spec). ES - cierra la función (verifica, genera el PR desde la spec).
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
3. Show the PR title and description generated from the spec chain
   (`.specs/<feature>/.execution/pr-description.md`) and ask the user to approve the `execution` phase
   (`spec_approve`).
4. Offer exactly three options: **1. merge into the base branch locally · 2. push and open a Pull Request
   (with that description) · 3. keep the branch as-is.** Execute only the one the user picks; merging and
   pushing are theirs to confirm. After merging locally, run the suite again on the result.
5. Clean up: delete `.specs/<feature>/.execution/` once merged or the PR is open; the roadmap already
   shows the feature at 100%.

Respond in the user's language (EN/PT/ES).
