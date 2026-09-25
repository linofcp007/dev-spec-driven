---
description: Resume a feature - "you are here, do this next" + what changed since approval. PT - próximo passo da feature. ES - siguiente paso de la feature.
argument-hint: "[feature name]"
---

Use the **dev-spec-driven** skill to resume work on a feature.

Args: $ARGUMENTS

Call the `spec_next_action` MCP tool (CLI `dev-spec next-action <feature>`, alias `na`). It picks ONE next step,
in the spec chain's order, and names it in `step`:

1. **fill** — the first chain artifact still missing or a template (`file` names it); a fresh feature starts here,
   at its requirements;
2. **re-review** — an artifact changed after its own approval (`changedSinceApproval`); when the approval has a
   snapshot, `impact` names the `spec_impact` phases to run first (`/spec-impact`);
3. **fix** — failing checks of the current phase (or an earlier one); also when the next pending approval would
   be refused (`refusedGate` lists its failing check ids);
4. **approve** — the first pending approval whose gate would pass — on +tdd / +ai that includes Phase 4 (`tests`:
   write the failing tests / eval harness with `/writeTests`, then `/approve <feature> tests`), and on a bugfix the
   `design` approval of `bug.md`;
5. **implement** — the next open task;
6. **finish** — every task done → `/spec-finish` (**tasks** instead when no tasks exist yet). Once
   `spec_finish {write: true}` has recorded the finish: **finished** (the `execution` sign-off, `/approve <feature>
   execution`, while it is missing — else nothing left) or **drift** — implementing files changed since the finish
   (`drift` lists them): decide with the user — the spec is now wrong → `/spec-impact`; the code is wrong → fix it;
   harmless → re-run `/spec-finish` for a fresh baseline.

Report: the feature's tracks, phase, doctor verdict, whether the gates are met (`gatesOk`), anything in
`changedSinceApproval`, and the recommended next action — then offer to do it. Never skip a step to reach a
later one. Respond in the user's language (EN/PT/ES).
