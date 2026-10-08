---
description: Surface ambiguities and gaps in a feature's requirements before design. PT - clarifica requisitos. ES - aclara requisitos.
argument-hint: "[feature name]"
---

Use the **dev-spec-driven** skill clarify step (part of Phase 1).

Feature: $ARGUMENTS

Run the `spec_clarify` MCP tool for this feature (CLI `dev-spec clarify <feature>`). It returns questions
(`questions`, `verdict: needs-clarification | clear`), open `[NEEDS CLARIFICATION]` markers first: vague terms,
leftover template placeholders and TBDs (one question naming each `requirements.md:line`), missing success
criteria / priorities / independent tests, missing edge-cases / non-functional / out-of-scope sections (a bugfix
is never asked for non-functional requirements — its template has none by design), missing IF…THEN failure-path criteria, and track-specific gaps (tenant isolation and rate limits for +saas; output
quality and cost for +ai; an access-denied criterion and the secrets handled for +sec; data subject rights and
retention periods for +privacy; the delivery guarantee / duplicates and each dependency's failure for +dist). When the spec names queues, events, webhooks, async work, concurrency, transactions
or retries (two distinct concepts, or one strong phrase — a message queue, a webhook, publishing an event, concurrent
writes; the template's own words never count) and neither requirements.md nor design.md states a consistency model, a
delivery guarantee or idempotency (the answer may go in either — the design's Alternatives & Trade-offs / Risks, or a
requirement), one question asks for them (atomicity, isolation level, concurrent writers, strong vs eventual, delivery guarantee +
idempotency — `nudges: [{code: "consistency-unstated", signals}]`). A removed track's criteria are ignored. With a glossary
(`.specs/steering/glossary.md` — `steering_scaffold {file: "glossary.md"}` / `dev-spec steering glossary.md` scaffolds it),
every word it says to avoid (`_Avoid: client, user_`) that `requirements.md` / `design.md` use is a question naming
`file:line` and the term to use (word-matched, case-insensitive, a plural counts; never inside code, comments or the
glossary's own terms; the result also carries `glossary` [{word, term, count, locations}]) — replace the word, or amend
the glossary. Present the questions to the user, get
answers, and fold them into `requirements.md` before moving to design — edge cases, NFRs and success criteria
keep their stable IDs (`EC-1`, `NFR-1`, `SC-001`) so tasks and tests can trace them. Then re-run `ears_validate`
(issue codes: `no-modal`, `no-id`, `vague`, `placeholder`, `no-keyword`, `needs-clarification`, `padded-id`). Respond in the
user's language (EN/PT/ES).

If the user wants a deeper, decision-by-decision interrogation of their *understanding* (not just
gaps in the text), point them to `/grill` — it runs the dev-grill engine and folds the resulting
shared-understanding into `requirements.md` as EARS statements.
