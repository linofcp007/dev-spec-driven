---
description: Handle code-review feedback against the spec — verify each comment, fix AC violations, push back on out-of-scope asks, route spec changes to their phase. PT - trata feedback de review contra a spec. ES - gestiona feedback de revisión contra la spec.
argument-hint: "[feature name] [paste the review comments]"
---

Use the **dev-spec-driven** skill, review-feedback workflow (`references/review-feedback.md`).

Feedback: $ARGUMENTS

Read ALL the comments first. For each one: restate it as a technical requirement (ask about every unclear
item before implementing any), verify it against the code AND `.specs/<feature>/` (requirements, design,
constitution, Out of Scope), then classify it:
**AC violation** → fix it and cite the AC ID · **spec change** → don't implement; take it back to
`/createSpec` or `/design` for approval · **out of scope / YAGNI** → push back citing the spec ·
**quality within scope** → fix with a test · **nit** → apply if cheap · **unclear** → ask.

Implement one item at a time (blocking → simple → complex), run the covering tests after each, and
re-record the task's evidence (`spec_complete_task {…, evidence}`). Reply with the technical change or
the evidence — never performative agreement. Respond in the user's language (EN/PT/ES).
