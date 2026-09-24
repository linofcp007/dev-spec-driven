# Bugfix flow (systematic debugging)

`/spec-bugfix` — or `spec_create {kind: "bugfix"}` / `dev-spec bugfix "<name>"` — scaffolds a light spec
for a defect: `bug.md` (reproduction · expected vs actual · **root cause** · fix · regression test), a
one-story `requirements.md` whose criterion is the corrected behaviour as `IF … THEN THE SYSTEM SHALL …`,
a regression test plan (`T-01` reproduces the bug, `T-02` guards the neighbouring behaviour) and a
fixed task order. It sits between Vibe (no discipline) and a full Spec (too heavy for one defect), and
it is not Bounded mode either: Bounded (a short design in chat for a contained change to an existing flow)
has no reproduction, root cause or regression test — a real defect needs all three.
Adapted from the `systematic-debugging` skill of [obra/superpowers](https://github.com/obra/superpowers) (MIT).

## The iron law

**No fix before the root cause is known.** `spec_doctor` fails the `root-cause` check until
`bug.md → Root Cause` holds real content — the cause *with evidence*, never "probably". A symptom fix
that makes the error go away without explaining it is a new bug waiting.

## The four phases (= the scaffolded tasks)

1. **Reproduce** (task 1). Read the error completely — message, stack trace, line numbers. Find the exact
   steps / input / environment that trigger it *every time*. Can't reproduce? Gather more data (logs,
   inputs, versions); don't guess. Check what changed recently (`git log`, dependency bumps, config).
   Write the steps in `bug.md → Reproduction`.
2. **Root cause** (task 2). Trace the bad value backwards to where it originates. In a multi-component
   path (API → service → DB, build → package → deploy), instrument each boundary once and run it, so the
   evidence shows WHERE it breaks before you theorise WHY. Compare with a working example of the same
   pattern in the codebase and list every difference. Form ONE hypothesis ("X is the cause because Y"),
   test it with the smallest possible change, and keep the evidence. Fill `bug.md → Root Cause`.
3. **Failing regression test** (task 3). Write `T-01` so it reproduces the bug and watch it fail *for the
   right reason* (the wrong behaviour, not a typo or a missing import). Paste the red output in the
   report. This is the proof the fix fixes *this* bug.
4. **Fix** (task 4). One change that removes the root cause — not a bundle of "while I'm here"
   improvements. Run `T-01`, `T-02` and the full suite (`_Verify:_` records the evidence). Consider
   defence in depth: should the invalid value also be rejected at the boundary where it entered?

**Checkpoint:** the reproduction steps no longer reproduce the bug and the full suite is green. Close
with `/spec-finish` — the merge summary carries the root cause and the fix from `bug.md`.

## When a fix doesn't work

Stop and return to phase 1 with what you learned. After **three** failed fixes, stop fixing: each fix
revealing a new problem somewhere else is the signature of a wrong architecture or a wrong mental model,
not bad luck. Say so to the human and discuss before attempt four.

## Red flags — stop and go back to phase 1

| Thought | Reality |
|---|---|
| "Quick fix now, investigate later" | "Later" never comes, and the quick fix hides the evidence. |
| "Just try changing X and see" | That's guessing. Form a hypothesis you can state and test. |
| "It's probably Y, let me fix that" | "Probably" isn't a root cause. Find the evidence. |
| "Several changes at once will be faster" | You won't know which one worked — or which one broke something else. |
| "The test is hard to write, I'll verify manually" | Then the bug can come back silently. The regression test IS the fix's proof. |
| "One more fix attempt" (after two failed) | After three, question the design, not the line. |

## If the bug is bigger than it looked

A bug whose fix needs a design decision, a new interface or several stories is a feature in disguise.
Say so, and escalate: turn it into a Spec-mode feature (`/spec`), keep `bug.md` as its context, and
reuse the regression test as the first planned test.
