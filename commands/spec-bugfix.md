---
description: Fix a bug systematically — reproduce, find the root cause with evidence, approve, write a failing regression test, then fix.
argument-hint: "[short bug name] [what's broken]"
---

Use the **dev-spec-driven** skill, bugfix flow (`references/bugfix.md`).

Bug: $ARGUMENTS

1. Scaffold it: `spec_create {name, kind: "bugfix", summary}` (CLI: `dev-spec bugfix "<name>" --summary "…"`)
   — `bug.md`, a one-story `requirements.md` (`IF … THEN THE SYSTEM SHALL …`), a regression test plan
   and two tasks: 1 the failing regression test, 2 the fix. Pass the user's language (`lang`). A bugfix is always +tdd.
   **Prefill what you already know** in the same call instead of reading the four files back and rewriting them:
   `reproduction` (the steps), `rootCause` (only once you have the evidence — it counts as written only as real prose),
   `condition` (the IF … of the regression criterion) and `behaviour` (its THE SYSTEM SHALL …); a text left out stays a
   slot. `includeBody: true` returns each scaffold's body (`bodies`), so you edit what's left without a Read.
2. **Reproduce** — exact steps/input/environment in `bug.md → Reproduction` (the requirements gate checks it). No
   task to tick: the requirements approval signs it off.
3. **Root cause with evidence** in `bug.md → Root Cause`. The iron law: **no fix before the cause is
   known** — `spec_doctor` fails the `root-cause` check and the design approval (it signs off `bug.md`) is refused until
   it is, and while the section is empty `spec_complete_task` **refuses the fix** (only task 1 can be completed). One
   hypothesis at a time, tested with the smallest change. No task to tick here either: once the plan is approved,
   `spec_next_action` points at task 1, the regression test.
4. **STOP for the approvals.** Fill the AC with the real condition and correct behaviour, the test plan's File column
   and the tasks' `_Verify:_` commands, run `spec_doctor`, then present the reproduction, the root cause with its
   evidence and the fix you propose — and wait. "Fix it" / "corrige isto" / "arréglalo" asks for the outcome; it is
   **not** an approval of your root cause: don't touch the product code in this turn. On the user's yes, record it with
   `spec_approve` — requirements, **design** (a bugfix has no design of its own — its design approval signs off `bug.md`,
   gated on the Root Cause), test-plan and tasks — or all four at once with `spec_approve {through: "tasks"}` once they
   said so. (`/approve` and `/spec-ff` are the user's own commands — they may type them; you can't run them.)
5. **Failing regression test** (T-01, task 1) — the scaffold marks task 1 `_Expect: fail_`; fill its `_Verify:_` with the
   command that runs T-01, write the test and see it fail for the right reason: `node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" done <feature> 1 --run` (or
   `spec_complete_task {…, evidence}` with the failing run) records the red run; a passing run is refused, and so is
   a failure whose output shows the test never ran (a missing test file or module — not the right reason). No shell
   to run it? **Ask the user** to run the test (give them the runnable line above) and paste the output — never apply
   the fix on a red nobody saw, and never send a subagent (or a tool search) to look for a shell: stop and ask.
6. **Fix the cause** (one change, task 2), run the suite, record the evidence:
   `spec_complete_task {…, evidence}` / `node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" done <feature> 2 --run`.
7. Close with `/spec-finish` (the merge summary carries the root cause and the fix; an unwritten root cause
   blocks it).

**A small, obvious defect (size xs):** `spec_create {kind: "bugfix", size: "xs"}` — the same two tasks; fill the whole
plan, then — on the user's yes — approve it in one call (`spec_approve {through: "tasks"}`). **A bugfix scaffolded before** (four tasks: 1 reproduce, 2 root cause,
3 the red test, 4 the fix) stays valid as it is: tick 1 and 2 with a note once `bug.md` holds them, then 3 and 4.

After three failed fixes, stop and discuss the design with the user. If the fix needs a design decision or
several stories, it's a feature: say so and move it to `/spec`. Respond in the user's language (EN/PT/ES).
