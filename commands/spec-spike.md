---
description: Run a spike — a timeboxed investigation that ends in a decision (go / no-go / pivot), not in made-up requirements.
disable-model-invocation: true
argument-hint: "[spike name] [the question it answers] [--timebox YYYY-MM-DD|3d]"
---

Spike: $ARGUMENTS

1. **Scaffold** — `spec_create {name, kind: "spike", question, timebox, lang}`: `spike.md` (Question · Timebox · Options
   considered · Evidence · Decision · Follow-up) and a few investigation tasks. A spike is core only, with no planning
   gates to approve.
2. **Question and timebox** first — one question whose answer would change the plan, and an end date.
3. **Investigate** — work the tasks. Prototype code lives outside `.specs/` (a scratch folder or a branch); link it, the
   measurements and the sources under `spike.md → Evidence`.
4. **Decide** — `spike.md → Decision`: the rationale and `_Outcome: go_`, `_Outcome: no-go_` or `_Outcome: pivot_` (doctor
   fails `decision` until it is written and warns `timebox` once the date passed — then decide with the evidence you have).
   Log it: `/spec-change <spike> decide`.
5. **Follow `spec_next_action`** — go: `spec_create` the real feature from the result's `seed` and archive the spike, in
   the order it gives (archive first when the feature takes the spike's name); no-go: archive it; pivot: a new spike, then
   archive this one.

`/spec-finish` is ready once the decision is written and every task ticked. Respond in the user's language (EN / PT / ES).
