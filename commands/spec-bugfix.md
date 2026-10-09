---
description: Fix a bug — reproduce it, prove the root cause, get approval, write a failing regression test, then fix it.
argument-hint: "[short bug name] [what's broken]"
---

Use the **dev-spec-driven** skill, bugfix flow (`${CLAUDE_PLUGIN_ROOT}/skills/dev-spec-driven/references/bugfix.md`).

Bug: $ARGUMENTS

1. **Scaffold** — `spec_create {name, kind: "bugfix", summary, lang}` (always +tdd): `bug.md`, a one-story
   `requirements.md` (`IF … THEN THE SYSTEM SHALL …`), a regression test plan and two tasks — 1 the failing regression
   test, 2 the fix. Prefill what you know in the same call: `reproduction`, `rootCause` (only with its evidence),
   `condition` and `behaviour` (the IF and the THEN of US-1.AC-1); `includeBody: true` returns the bodies. A small,
   obvious defect: `size: "xs"`.
2. **Reproduce** — the exact steps, input and environment in `bug.md → Reproduction`.
3. **Root cause with evidence** in `bug.md → Root Cause`. No fix before the cause is known: one hypothesis at a time,
   tested with the smallest change. Until it is written the design approval is refused and `spec_complete_task` refuses
   the fix.
4. **STOP for the approvals.** Fill the criterion, the test plan's File column and the tasks' `_Verify:_`, run
   `spec_doctor`, then present the reproduction, the root cause with its evidence and the fix you propose — and wait.
   "Fix it" asks for the outcome; it is not an approval of your root cause: no product code in this turn. On the user's
   yes, record it with `spec_approve` (requirements, design — it signs off `bug.md` —, test-plan, tasks), or all of them
   with `spec_approve {through: "tasks"}` once they said so.
5. **Failing regression test** (T-01, task 1) — the scaffold marks task 1 `_Expect: fail_`: write the test, see it fail
   for the right reason and record the red run — `node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" done <feature> 1 --run`
   (or `spec_complete_task` with the failing run). No shell? Ask the user to run it and paste the output — never apply
   the fix on a red nobody saw, and never send a subagent to look for a shell.
6. **Fix the cause** (one change, task 2), run the suite and record it:
   `node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" done <feature> 2 --run`.
7. **Close** with `spec_finish` (the user's `/spec-finish`): the merge summary carries the root cause and the fix.

After three failed fixes, stop and discuss the design. A fix that needs a design decision or several stories is a
feature: say so and move it to `/spec`. Respond in the user's language (EN / PT / ES).
