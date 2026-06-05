---
description: Short alias for /executeTask — implement the next task. Atalho de execução. Atajo de ejecución.
argument-hint: "[feature name | task number | 'next']"
---

Use the **dev-spec-driven** skill, Phase 6 (Execute). Short alias for `/executeTask`.

Target: $ARGUMENTS

Use `spec_next_task` to find the next task (or jump to the given number), pick the loop per track
(core implement-and-test / +tdd red-green-refactor / +ai prompt-iteration), and call
`spec_complete_task` when each goes green. Respond in the user's language (EN/PT/ES).
