---
description: Fix a bug the systematic way — reproduce, find the root cause with evidence, write a failing regression test, then fix. PT - corrige um bug com método (causa raiz primeiro). ES - corrige un bug con método (causa raíz primero).
argument-hint: "[short bug name] [what's broken]"
---

Use the **dev-spec-driven** skill, bugfix flow (`references/bugfix.md`).

Bug: $ARGUMENTS

1. Scaffold it: `spec_create {name, kind: "bugfix", summary}` (CLI: `dev-spec bugfix "<name>" --summary "…"`)
   — `bug.md`, a one-story `requirements.md` (`IF … THEN THE SYSTEM SHALL …`), a regression test plan
   and the fixed task order. Pass the user's language (`lang`).
2. **Reproduce** — exact steps/input/environment in `bug.md → Reproduction`.
3. **Root cause with evidence** in `bug.md → Root Cause`. The iron law: **no fix before the cause is
   known** — `spec_doctor` fails the `root-cause` check until it is. One hypothesis at a time, tested with
   the smallest change.
4. Fill the AC with the real condition and correct behaviour; `/approve` requirements, test-plan and tasks.
5. **Failing regression test** (T-01) — red for the right reason, output pasted.
6. **Fix the cause** (one change), run the suite, record the evidence:
   `spec_complete_task {…, evidence}` / `dev-spec done <feature> 4 --run`.
7. Close with `/spec-finish` (the PR description carries the root cause and the fix).

After three failed fixes, stop and discuss the design with the user. If the fix needs a design decision or
several stories, it's a feature: say so and move it to `/spec`. Respond in the user's language (EN/PT/ES).
