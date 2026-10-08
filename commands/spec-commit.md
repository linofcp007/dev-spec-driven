---
description: Generate a conventional commit message referencing the spec chain (tasks, tests, evals, metrics).
argument-hint: "[optional scope/note]"
---

Use the **dev-spec-driven** skill commit workflow.

Note: $ARGUMENTS

Produce a conventional commit message (`type(scope): summary`) whose body references the spec
chain: `Part of .specs/<feature>/ task #N.` and — where the tracks apply — `Makes T-xx green`
(+tdd), the eval delta `golden A% → B%` (+ai), and `Emits metric …` (+saas). Phase-4 commits use
`test:`; a regression test committed before its fix (`_Expect: fail_`) goes in its own `test:` commit. Written this
way, `dev-spec log <feature>` maps each commit back to its task (and, on +tdd, checks that the tests were committed
before the code that makes them green). Do not commit unless the user asked you to; just draft the message by default.
