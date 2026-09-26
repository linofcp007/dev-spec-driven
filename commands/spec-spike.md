---
description: Run a spike — a timeboxed investigation that ends in a decision (go / no-go / pivot), not in fake requirements. PT - faz um spike (investigar → decidir). ES - haz un spike (investigar → decidir).
argument-hint: "[spike name] [the question it answers] [--timebox YYYY-MM-DD|3d]"
---

Use the **dev-spec-driven** skill, spike flow (investigate → decide).

Spike: $ARGUMENTS

An investigation is neither an unrecorded vibe session nor a spec with made-up acceptance criteria. A spike records the
question, the timebox, the options, the evidence and the decision.

1. Scaffold it: `spec_create {name, kind: "spike", question, timebox, lang}` (CLI:
   `dev-spec spike "<name>" --question "…" --timebox 3d` — or `create "<name>" --kind spike`). It writes
   `spike.md` (Question · Timebox · Options considered · Evidence · Decision · Follow-up) and a small `tasks.md` of
   investigation steps. A spike is core-only: no requirements / design / tasks gates to approve.
2. **Question + timebox** first — one question whose answer would change the plan; an end date (YYYY-MM-DD).
3. **Investigate** — work the tasks (`dev-spec done <spike> <n>`). Prototype code lives **outside `.specs/`**
   (a scratch folder or a branch); link it, the measurements and the sources under `spike.md → Evidence`.
4. **Decide** — write `spike.md → Decision`: the rationale and a line `_Outcome: go_`, `_Outcome: no-go_` or
   `_Outcome: pivot_`. `spec_doctor` fails the `decision` check until it is written and warns `timebox` once the end
   date passed without one — then decide with the evidence you have. Log it with `/spec-decide` (`D-1`).
5. Follow `spec_next_action`:
   - **go** — spec the real feature with `spec_create` (the result's `seed` gives a name and a summary from the
     question + decision), then archive the spike (`/feature archive <spike>`);
   - **no-go** — archive the spike; the reason stays in its Decision;
   - **pivot** — a new spike for the new direction, then archive this one.
6. `/spec-finish` is ready once the decision is written and every task ticked (no suite or evidence gates); its
   merge summary carries the question, the decision and the evidence.

Respond in the user's language (EN/PT/ES).
