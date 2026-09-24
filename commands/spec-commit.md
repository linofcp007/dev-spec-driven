---
description: Generate a conventional commit message referencing the spec chain (tasks, tests, evals, metrics). PT - mensagem de commit convencional. ES - mensaje de commit convencional.
argument-hint: "[optional scope/note]"
---

Use the **dev-spec-driven** skill commit workflow.

Note: $ARGUMENTS

Produce a conventional commit message (`type(scope): summary`) whose body references the spec
chain: the `.specs/<feature>/` task number, and — where the tracks apply — `Makes T-xx green`
(+tdd), the eval delta `golden A% → B%` (+ai), and `Emits metric …` (+saas). Phase-4 commits use
`test:`. Do not commit unless the user asked you to; just draft the message by default.
