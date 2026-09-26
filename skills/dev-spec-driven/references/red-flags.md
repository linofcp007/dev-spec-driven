# Red flags & rationalizations, by phase

Each phase has a few thoughts that reliably precede skipping it. When you catch one, stop and do the
phase. Adapted from the rationalization tables of [obra/superpowers](https://github.com/obra/superpowers) (MIT).

## Mode choice (Vibe · Bounded · Spec)

| Thought | Reality |
|---|---|
| "This is too simple to need approval" | Simple changes still carry unexamined assumptions. Bounded path: a short design in chat and a yes. |
| "I'll start and see how big it gets" | Size is decided up front; hidden complexity upgrades the path (Vibe → Bounded → Spec), never the reverse. |
| "It touches payments/tenants/an LLM, but only a little" | Those are exactly the signals that need a track. Classify. |

## Requirements (Phase 1)

| Thought | Reality |
|---|---|
| "The requirements are obvious" | Then writing them takes five minutes, and `/grill` finds the one that wasn't. |
| "We'll handle errors later" | The unwanted-behaviour criteria (IF…THEN) are where the bugs live. Write them now. |
| "'Fast' is clear enough" | Vague words are untestable. Put a number on it. |

## Design (Phase 2)

| Thought | Reality |
|---|---|
| "Scale/cost can be figured out later" | On +saas/+ai the mandatory sections exist because "later" is a rewrite. "Not needed because X" is fine; blank is not. |
| "There's only one way to do it" | Name the alternative you rejected and why (Complexity Tracking). |

## Tests first (+tdd, Phases 3–4 and every task)

**Iron law: no production code without a failing test first.** Code written before its test is deleted
and rewritten from the test — not "kept as reference", not "adapted".

| Thought | Reality |
|---|---|
| "I'll write the tests after" | Tests written after pass immediately, which proves nothing. |
| "I already tested it manually" | Manual checks aren't repeatable and don't guard regressions. |
| "It's too simple to test" | Simple code breaks too; the test takes a minute. |
| "Let me just try the implementation first" | That's a spike: throw it away, then TDD. |
| "The test is wrong, I'll adjust it to pass" | A planned test's expectation is a spec decision. Stop and go back to the test plan. |

## Execution (Phase 6)

| Thought | Reality |
|---|---|
| "Close enough to the AC" | An AC is met or it isn't. Check it by ID. |
| "I'll tick it now and verify later" | A tick is a claim. Evidence first (`_Verify:_`, `spec_complete_task {evidence}`). |
| "While I'm here I'll also refactor X" | Out of the task = out of scope. File it. |
| "The subagent said DONE" | Review the diff and the evidence. A report is a claim. |
| "The command is slow, a note will do" | A runnable `_Verify:_` counts only with its command and exit 0. Run it. |

## Gates & changes after approval

| Thought | Reality |
|---|---|
| "The approval was refused — I'll just `--force` it" | Force is the human's call, over named failures, and it stays flagged. Fix the checks or ask. |
| "It's a small edit to an approved requirement, no need to re-approve" | An approved spec that changed is not approved. `/spec-impact`, then re-approve. |
| "I'll add the missing tasks myself" | Follow-up work goes through `/spec-converge`: the human approves the list first. |
| "The finished feature's spec is stale, I'll rewrite it" | Write the new behaviour in a new feature with `_Supersedes:_`; keep history. |

## Verification & finishing

| Thought | Reality |
|---|---|
| "It passed earlier" | Run it fresh, on the final code. |
| "Should work now" | "Should" is not evidence. |
| "Just merge, something downstream will catch it" | Nothing downstream runs: no CI by design — the local run IS the gate. |

## Bugfix

| Thought | Reality |
|---|---|
| "Quick fix now, investigate later" | No fix before the root cause (`bug.md → Root Cause`). |
| "One more attempt" (after the third failed fix) | Stop; question the design with the human. |

See also: `verification.md`, `bugfix.md`, `review-feedback.md`.
