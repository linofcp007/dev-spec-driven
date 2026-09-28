---
description: Fix a bug the systematic way — reproduce, find the root cause with evidence, get it approved, write a failing regression test, then fix. PT - corrige um bug com método (causa raiz primeiro). ES - corrige un bug con método (causa raíz primero).
argument-hint: "[short bug name] [what's broken]"
---

Use the **dev-spec-driven** skill, bugfix flow (`references/bugfix.md`).

Bug: $ARGUMENTS

1. Scaffold it: `spec_create {name, kind: "bugfix", summary}` (CLI: `dev-spec bugfix "<name>" --summary "…"`)
   — `bug.md`, a one-story `requirements.md` (`IF … THEN THE SYSTEM SHALL …`), a regression test plan
   and the fixed task order. Pass the user's language (`lang`). A bugfix is always +tdd.
2. **Reproduce** — exact steps/input/environment in `bug.md → Reproduction` (the requirements gate checks it). That
   is task 1: tick it with a note of what you ran and saw — `spec_complete_task {name, number: 1, evidence: {summary}}`
   (CLI `dev-spec done <feature> 1 --evidence "…"`; the task has no `_Verify:_`, so the note is its evidence).
3. **Root cause with evidence** in `bug.md → Root Cause`. The iron law: **no fix before the cause is
   known** — `spec_doctor` fails the `root-cause` check until it is, and `spec_complete_task` **refuses every task
   after the root-cause task** (regression test, fix, verify) while the section is empty. One
   hypothesis at a time, tested with the smallest change. Once the section is written, tick task 2 the same way
   (`dev-spec done <feature> 2 --evidence "…"`) — ticked earlier, the result warns that the Root Cause is still empty.
   `spec_next_action` points at the first open task, so tasks 1 and 2 must be ticked before task 3 is next.
4. **STOP for the approvals.** Fill the AC with the real condition and correct behaviour, the test plan's File column
   and the tasks' `_Verify:_` commands, run `spec_doctor`, then present the reproduction, the root cause with its
   evidence and the fix you propose — and wait. "Fix it" / "corrige isto" / "arréglalo" asks for the outcome; it is
   **not** an approval of your root cause: don't touch the product code in this turn. On the user's yes, `/approve`
   requirements, **design** (a bugfix has no design of its own — its design approval signs off `bug.md`, gated on the
   Root Cause), test-plan and tasks — or all four at once with `/spec-ff` once they said so.
5. **Failing regression test** (T-01, task 3) — the scaffold marks task 3 `_Expect: fail_`; fill its `_Verify:_` with the
   command that runs T-01, write the test and see it fail for the right reason: `dev-spec done <feature> 3 --run` (or
   `spec_complete_task {…, evidence}` with the failing run) records the red run; a passing run is refused, and so is
   a failure whose output shows the test never ran (a missing test file or module — not the right reason). No shell
   to run it? Ask the user to run the test and paste the output — never apply the fix on a red nobody saw.
6. **Fix the cause** (one change), run the suite, record the evidence:
   `spec_complete_task {…, evidence}` / `dev-spec done <feature> 4 --run`.
7. Close with `/spec-finish` (the merge summary carries the root cause and the fix; an unwritten root cause
   blocks it).

After three failed fixes, stop and discuss the design with the user. If the fix needs a design decision or
several stories, it's a feature: say so and move it to `/spec`. Respond in the user's language (EN/PT/ES).
