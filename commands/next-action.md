---
description: Resume a feature - "you are here, do this next" + what changed since approval. PT - próximo passo da feature. ES - siguiente paso de la feature.
argument-hint: "[feature name]"
---

Use the **dev-spec-driven** skill to resume work on a feature.

Args: $ARGUMENTS

Call the `spec_next_action` MCP tool (CLI `dev-spec next-action <feature>`, alias `na`). It picks ONE next step,
**phase by phase**, and names it in `step`:

1. **re-review** — an artifact changed after its own approval (`changedSinceApproval`); when the approval has a
   snapshot, `impact` names the `spec_impact` phases to run first (`/spec-impact`);
2. then the **first active phase not approved yet**, in order — classification, requirements, design, test-plan
   (+tdd), eval-plan (+ai), tests (Phase 4, +tdd / +ai once its plan exists — never on a bugfix), tasks:
   - **fill** — its artifact is missing or still a template (`file` names it); a fresh feature starts here, at its
     classification;
   - **fix** — what that phase's approve gate would refuse (`refusedGate` lists its failing check ids);
   - **approve** — its gate passes. On Phase 4 (`tests`): write the failing tests / eval harness with `/writeTests`,
     then `/approve <feature> tests` — on a feature already executing or complete, e.g. an upgraded 1.12 one, it is
     worded as a sign-off for the tests that exist (T-IDs in test names, the eval baseline recorded); on a bugfix the
     `design` approval signs off `bug.md`. With approvals by role, a phase still waiting for a role names it
     ("missing role: security") and the `--role` to sign as. When every planning artifact up to `tasks` is filled and
     passes its gate, the recommendation offers `/spec-ff` — approve them in one go, only after the user said so.
   The next phase starts only after that approval — the design is never asked for before the requirements are
   approved (on a **design-first** feature the order is classification → design → requirements → …, and the result
   carries `flow: "design-first"`), and `spec_approve` refuses a phase while an earlier one is unapproved (`phase-order`);
3. **fix** — every phase is approved, but a check of the current phase (or an earlier one) still fails, e.g. after
   an approval forced over it;
4. **implement** — the next task: the first open one whose `_Depends:_` tasks are all done (`spec_next_task`'s rule).
   Open tasks none of which can start (a `_Depends:_` cycle, or one naming no task) → **fix** instead, with `blocked`
   [{number, waitsOn}]: correct the `_Depends:_` markers (`spec_doctor` fails `task-deps`);
5. **verify** — every task is ticked, but one is not verified (its latest run failed, or its runnable `_Verify:_`
   has only a note, stale or shared-number evidence): `/spec-finish` and the `execution` sign-off would refuse. The
   recommendation names each task with its reason — re-run its `_Verify:_` with `dev-spec done <feature> <n> --run`
   (a failing run means fixing the code first; an `_Expect: fail_` task's proof is a FAILING run — its red test). No
   shell to run it? Ask the user to run it and paste the output — never tick or record a run nobody made;
6. **finish** — every task done and verified → `/spec-finish` (**tasks** instead when no tasks exist yet). Once
   `spec_finish {write: true}` has recorded the finish: **finished** (the `execution` sign-off, `/approve <feature>
   execution`, while it is missing — or "re-confirm it" when it exists but predates a later approval or change
   request, which it names — else nothing left) or **drift** — implementing files changed since the finish
   (`drift` lists them): decide with the user — the spec is now wrong → `/spec-impact`; the code is wrong → fix it;
   harmless → re-run `/spec-finish` for a fresh baseline. A finished feature that changed since (`staleBaseline`)
   answers **finish** again — or **drift** first when one of its recorded files changed: decide, then finish again.

A **spike** has its own steps: fill (the question) → implement (the next investigation task) → decide (write the
Decision and its `_Outcome:_`) → **promote** (`go`: a `seed` {name, summary} for `spec_create` + archive the spike, in
the order the recommendation gives) · **archive** (`no-go`) · **pivot** (a new spike) — see `/spec-spike`.

Report: the feature's tracks, phase, doctor verdict, whether the gates are met (`gatesOk`), anything in
`changedSinceApproval`, and the recommended next action — then offer to do it. Never skip a step to reach a
later one. Respond in the user's language (EN/PT/ES).
