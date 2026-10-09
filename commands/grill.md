---
description: Grill my understanding of a feature's requirements before design, and fold the result into requirements.md.
argument-hint: "[feature name]"
---

Planning-time grill. This is the sharp, decision-tree cousin of `/clarify`: where `clarify` flags
gaps in the text, `grill` interrogates **your understanding** of the feature until it's solid — then
turns that understanding into requirements.

Feature: $ARGUMENTS

Steps:

1. **Seed** — read this feature's `requirements.md` (and `classification.md` if present). No feature yet? Scaffold it
   first (`spec_create`, Phase 1 — `/createSpec`), then grill. **The method** (it needs no other skill):
   - **One question at a time** — ask it, wait for the answer, then ask the next. Never a list of questions.
   - **Recommend an answer** with every question — your best guess and why, from the spec, the steering and the code —
     so the user confirms or corrects it instead of starting from a blank.
   - **Walk the decision tree** — start with the unknowns that would change the most (scope, the main business rule,
     the failure that hurts most); each answer opens or closes branches: follow an open branch to its end before
     moving on, and keep a short running list of what is settled.
   - **Don't ask what the material already answers** — when the requirements, the steering or the code settle a
     question, state the answer and move on.
   - **Stop** when every branch is settled, or the user parks it on purpose — a parked one is a
     `[NEEDS CLARIFICATION]` in requirements.md, never a guess.
2. Grill the significant decision-branches: business-rule branches, validation → failure paths,
   in/out of scope, the language-agnostic input/output contract, edge cases. ONE question at a time.
3. **Constraints round** — before closing, grill the constraints a design must honour (still one question at a
   time; skip what plainly doesn't apply, and say why):
   - **Atomicity** — which writes must succeed or fail together? What is left behind when one step fails halfway?
   - **ACID and isolation** — is a transaction required, and at which isolation level (read committed, repeatable
     read, serializable)? Which anomaly would hurt — a lost update, a double spend, a phantom row?
   - **Race conditions** — who else writes the same data, concurrently (another user, a job, a retry, a second
     instance)? Which write wins, and how does the other one find out?
   - **Consistency model** — strong or eventual? How stale may a read be, and for whom (the writer reading back its
     own write, other users, reports)?
   - **Delivery and idempotency** — for anything asynchronous (queues, events, webhooks, retries): at-most-once,
     at-least-once or effectively-once? What makes a duplicate harmless (an idempotency key, a dedup table)? Does
     order matter?
   - **Dependency failure** — for each dependency (database, cache, queue, third-party API): what happens when it is
     slow, down or answers garbage? Fail closed, degrade, or queue and retry?
   - **Volume and growth** — how many records / requests now, in 6 months, in 2 years? What grows without bound?
   - **Business outcome** — how will we know, after release, that the feature achieved what it is for? Name a
     measurable Success Criterion (`SC-00n`) and where its number comes from — not "users are happy".

   **One question bank — skip what an active track's design sections already own** (`spec_clarify`'s rule: it drops its
   consistency nudge under +dist). +dist → atomicity, ACID / isolation, race conditions, the consistency model, delivery
   and idempotency, dependency failure (its [DIST] sections ask them); +saas → volume and growth ([SaaS] Scale Design);
   +api → idempotent creates and concurrent updates ([API] sections; with +dist, [DIST] Delivery & Idempotency). Name the
   section that will answer it and move on. A failure path asked here becomes an IF…THEN criterion — the design's Error
   Handling points back to those criteria instead of asking again.

   The answers become acceptance criteria (an IF…THEN per failure), NFRs with numbers and Success Criteria — and the
   input of the design's **Alternatives & Trade-offs** and **Risks** sections. (`spec_clarify` asks about consistency
   on its own when the spec names queues, events, concurrency or transactions and neither the requirements nor the
   design state a consistency model, a delivery guarantee or idempotency — an answer folded into the requirements
   clears it.)
4. When you reach shared understanding, write each settled answer as an EARS statement ("WHEN … THE SYSTEM
   SHALL …", "IF … THEN THE SYSTEM SHALL …") and fold them into `requirements.md` for this feature — as new
   acceptance criteria (each with the next free `US-n.AC-m` ID; never renumber the existing ones) and as filled-in
   edge-case / out-of-scope / non-functional sections. Keep the spec language-agnostic (no framework or language
   names) so it can drive any implementation. Requirements already approved? The edit is a change request:
   `/spec-impact` first.
5. Run `spec_clarify` and `ears_validate` to confirm the folded requirements pass, show the user what changed,
   then finish Phase 1 as usual: `spec_doctor`, and on the user's explicit yes record the requirements approval with
   `spec_approve` (`/approve` is the user's own command). Then hand off to `/design` (Phase 2).

Respond in the user's language (EN/PT/ES). Do not switch the spec's language.
