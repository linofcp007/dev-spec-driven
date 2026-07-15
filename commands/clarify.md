---
description: Surface ambiguities and gaps in a feature's requirements before design. PT - clarifica requisitos. ES - aclara requisitos.
argument-hint: "[feature name]"
---

Use the **dev-spec-driven** skill clarify step (part of Phase 1).

Feature: $ARGUMENTS

Run the `spec_clarify` MCP tool for this feature. It flags vague terms, leftover placeholders/TBD,
missing edge-cases / non-functional / out-of-scope sections, missing IF…THEN failure-path criteria,
and track-specific gaps (tenant isolation for +saas; output quality / cost for +ai). Present the
questions to the user, get answers, and fold them into `requirements.md` before moving to design.
Respond in the user's language (EN/PT/ES).

If the user wants a deeper, decision-by-decision interrogation of their *understanding* (not just
gaps in the text), point them to `/grill` — it runs the dev-grill engine and folds the resulting
shared-understanding into `requirements.md` as EARS statements.
