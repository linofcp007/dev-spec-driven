# Handling review feedback (against the spec)

`/spec-review-feedback` — when review comments arrive (a human reviewer, a PR bot, the `spec-reviewer`
agent's final review), evaluate every comment **against the spec before changing code**. The spec gives
you what generic review etiquette lacks: an objective answer to "is this in scope?".
Adapted from the `receiving-code-review` skill of [obra/superpowers](https://github.com/obra/superpowers) (MIT).

## The pattern

1. **Read** all the feedback before reacting. Items can be related; the fifth can change the first.
2. **Restate** each item as a technical requirement in your own words. If you can't, it's unclear — ask
   about ALL unclear items before implementing any (a partial understanding produces the wrong fix).
3. **Verify** against the code *and* the spec: does the problem exist? Which AC, design decision,
   constitution principle or `Out of Scope` line does it touch?
4. **Classify** — this decides the action:

| Class | Test | Action |
|---|---|---|
| **AC violation** | The code breaks a criterion (`US-1.AC-2`), a planned test, or a constitution principle | Fix it. Cite the AC in the reply and the commit. |
| **Spec change** | The comment asks for behaviour the spec doesn't define, or contradicts an AC / design decision | Don't implement. Go back to the phase (`/createSpec`, `/design`) and get the change approved first. |
| **Out of scope / YAGNI** | It adds what the spec's `Out of Scope` excludes, or a "proper" feature nothing uses | Push back with the reference: *"Out of Scope lists X; happy to spec it separately."* Check usage (`grep`) before building "professional" extras. |
| **Quality** | Correctness/robustness/security within scope (error handling, tenant scoping, a race) | Fix it; add a test when behaviour changes. |
| **Nit / style** | Naming, formatting, preference | Apply if cheap and consistent with the codebase; otherwise say why not. |
| **Unclear** | You can't restate it | Ask. Never guess. |

5. **Implement** one item at a time, in order: blocking (breaks things, security) → simple fixes →
   complex fixes. Run the covering tests after each; re-run the task's `_Verify:_` and record the new
   evidence (`spec_complete_task` back-fills it).
6. **Reply** with the technical change, not gratitude: *"Fixed — `auth.js:88` now clears the cookie before
   redirecting (US-1.AC-1)."* A reviewer who was wrong gets the evidence, not agreement: *"Checked:
   `tenant_id` is scoped at `repo.js:41` (US-2.AC-1 test T-04 covers it)."*

## Forbidden

- Performative agreement ("You're absolutely right!", "Great point!") — it says nothing and invites
  implementing before verifying.
- Implementing a comment you haven't verified against the code and the spec.
- Silently changing an AC, a design decision or a planned test's expectation because a reviewer asked —
  that's a spec change and needs the human's approval.
- Batch-implementing everything and testing at the end.

## Source matters

Feedback from the human who owns the spec is a decision — still verify it technically, and if it changes
the spec, update the spec in the same change. Feedback from an external reviewer or a bot is a
suggestion — weigh it against the spec; it can be wrong about scope because it hasn't read the spec.
