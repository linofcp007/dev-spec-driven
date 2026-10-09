---
description: Surface the gaps in a feature's requirements before design; --grill interrogates your understanding instead.
disable-model-invocation: true
argument-hint: "[feature] [--grill]"
---

Feature: $ARGUMENTS

**Clarify (default).** `spec_clarify {name}` returns `questions` (open `[NEEDS CLARIFICATION]` markers first, each naming
its `requirements.md:line`) and a `verdict`. Ask them, fold the answers into `requirements.md` — edge cases, NFRs and
success criteria keep stable IDs (`EC-1`, `NFR-1`, `SC-001`) — then re-run `ears_validate`. A glossary word to avoid:
replace it, or amend the glossary.

**Grill (`--grill`)** — interrogate the user's understanding until it is solid, then turn it into requirements:
- **One question at a time** — ask, wait, then the next; never a list.
- **Recommend an answer** with every question — your best guess and why, from the spec, the steering and the code.
- **Walk the decision tree** — the unknowns that change the most first; follow an open branch to its end; keep a running
  list of what is settled. Don't ask what the material already answers. Stop when every branch is settled or parked (a
  parked one is a `[NEEDS CLARIFICATION]`, never a guess).
- **Constraints round** — before closing, one question at a time, skipping what an active track's design sections own
  (+dist, +saas, +api): **Atomicity** (what succeeds or fails together); **ACID and isolation** (a transaction? which
  isolation level?); **Race conditions** (who else writes it concurrently, which write wins); **Consistency model** (strong
  or eventual, how stale a read may be); **Delivery and idempotency** (at-least-once? what makes a duplicate harmless);
  **Dependency failure** (slow, down, garbage: fail closed, degrade or retry); **Volume and growth**; **Business outcome** —
  a measurable Success Criterion (`SC-00n`). The answers feed the design's **Alternatives & Trade-offs** and Risks.

Write each settled answer as EARS ("WHEN … THE SYSTEM SHALL …", an IF … THEN per failure) and fold them into
`requirements.md` — new criteria take the next free `US-n.AC-m`, never a renumbering. Requirements already approved? That
is a change request: `/spec-change <feature> impact` first.

Then `spec_clarify` and `ears_validate` again, `spec_doctor`, and — on the user's explicit yes — record the requirements
approval with `spec_approve`; hand off to `/spec <feature> design` (Phase 2). Respond in the user's language (EN / PT /
ES); never switch the spec's language.
