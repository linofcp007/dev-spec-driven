---
description: (+ai) Gate a prompt change on eval delta, cost delta, and version bump. PT - revisão de prompt (+ai). ES - revisión de prompt (+ai).
argument-hint: "[feature name]"
---

Use the **dev-spec-driven** skill prompt-review workflow (+ai track).

Feature: $ARGUMENTS

Before a prompt change lands: diff the `prompts/vN.md` files (review prompts like code); confirm
the eval delta (golden up, adversarial held, regression intact); check the cost delta (tokens per
call); and confirm the new prompt is a bumped version file with a changelog. A prompt change
without eval results is blocked until the harness is run. See `references/eval-suite-patterns.md`.
