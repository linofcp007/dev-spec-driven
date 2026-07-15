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
3. When you reach shared understanding, take the engine's EARS-ready statements ("WHEN … THE SYSTEM
   SHALL …", "IF … THEN …") and fold them into `requirements.md` for this feature — as new acceptance
   criteria and as filled-in edge-case / out-of-scope / non-functional sections. Keep the spec
   language-agnostic (no framework or language names) so it can drive any implementation.
4. Run `spec_clarify` (and `ears_validate` if available) to confirm the folded requirements pass the
   gate, then hand off to `/design` or `/createSpec`.

Respond in the user's language (EN/PT/ES). Do not switch the spec's language.
