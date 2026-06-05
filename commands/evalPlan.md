---
description: Phase 3 (+ai) — build golden / adversarial / regression eval sets, graders, thresholds, baseline. PT - plano de evals (+ai). ES - plan de evals (+ai).
argument-hint: "[feature name]"
---

Use the **dev-spec-driven** skill, Phase 3 (Eval Plan). Only relevant when the feature is on the
**+ai** track.

Feature: $ARGUMENTS

Write `eval-plan.md`: a **golden** set (50–200 representative inputs with expected quality), an
**adversarial** set (prompt injections, jailbreaks, out-of-scope, unsafe-elicitation, degenerate
inputs that must refuse/degrade), and a **regression** set (every fixed bug, grows forever). Choose
a grading method per set (exact / schema / LLM-as-judge with rubric / human). Set explicit ship
thresholds (e.g. golden ≥85%, adversarial safety 100%, regression 100%). Record a baseline from a
minimal v1 prompt before implementing. See `references/eval-suite-patterns.md`.
