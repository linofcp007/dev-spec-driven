---
description: Grill my understanding of a feature's requirements before design, and fold the result into requirements.md. PT - sabatina aos requisitos antes do design. ES - interrogatorio de los requisitos antes del diseño.
argument-hint: "[feature name]"
---

Planning-time grill. This is the sharp, decision-tree cousin of `/clarify`: where `clarify` flags
gaps in the text, `grill` interrogates **your understanding** of the feature until it's solid — then
turns that understanding into requirements.

Feature: $ARGUMENTS

Steps:

1. Load the **dev-grill** skill and run it in **plan/design** mode with output contract = **spec**.
   Seed it with this feature's `requirements.md` (and `classification.md` if present). If `dev-grill`
   isn't installed, run the same interrogation loop inline using its method.
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

   The answers become acceptance criteria (an IF…THEN per failure), NFRs with numbers and Success Criteria — and the
   input of the design's **Alternatives & Trade-offs** and **Risks** sections. (`spec_clarify` asks about consistency
   on its own when the spec names queues, events, concurrency or transactions and neither the requirements nor the
   design state a consistency model, a delivery guarantee or idempotency — an answer folded into the requirements
   clears it.)
4. When you reach shared understanding, take the engine's EARS-ready statements ("WHEN … THE SYSTEM
   SHALL …", "IF … THEN …") and fold them into `requirements.md` for this feature — as new acceptance
   criteria and as filled-in edge-case / out-of-scope / non-functional sections. Keep the spec
   language-agnostic (no framework or language names) so it can drive any implementation.
5. Run `spec_clarify` (and `ears_validate` if available) to confirm the folded requirements pass the
   gate, then hand off to `/design` or `/createSpec`.

Respond in the user's language (EN/PT/ES). Do not switch the spec's language.
