---
description: (+ai) Eval-gated migration to a new/replacement model — never migrate blind. PT - migração de modelo com evals (+ai). ES - migración de modelo con evals (+ai).
argument-hint: "[feature name] [target model]"
---

Use the **dev-spec-driven** skill model-migration workflow (+ai track).

Args: $ARGUMENTS

Run the current eval set (golden + adversarial + regression) through the target model and compare
per set. Switch only if the new model matches or beats the current one on every set (or tune the
prompt to recover, re-evaluating each time); otherwise stay. Record the decision and the eval
numbers in the design.md **Model Lifecycle** section. Never migrate without an eval comparison.
