---
description: Implement a feature's next task (or task N) with evidence; --subagents adds an implementer + reviewer per task.
disable-model-invocation: true
argument-hint: "[feature | task number] [--subagents] | commit [note]"
---

Use the **dev-spec-driven** skill, Phase 6 (Execute). Target: $ARGUMENTS

**Inline (default).**
1. `spec_next_task` — the first open task whose `_Depends:_` tasks are all done, or the number given. A `skipped` or
   `blocked` task means its dependencies first or a wrong plan (`spec_doctor` → `task-deps`) — never tick around it.
2. The loop per track: core implement-and-test; +ai prompt iteration gated on the eval delta, in a new `prompts/vN.md`;
   +tdd the **micro-cycle** — one behaviour at a time: the test first, watch it fail for the right reason, the minimal
   code, refactor only on green; code written before its test is deleted and redone. The micro-cycle's
   red flags for a NEW behaviour's test (a pass on its first run, a failure you can't explain) spare a guard test, a
   characterization test of existing code and a T-ID an earlier task already turned green: they pass at once by design —
   never make them fail artificially.
3. **Search before you write** — reuse, else extend, else create: the design's Reuse & Integration, then the codebase by
   concept and synonyms. Stay inside the task's `_Implements:_` files: a unit elsewhere is a plan change
   (`spec_append_tasks`; the scope guard asks), and a refactor you notice is filed, not done —
   `spec_roadmap_edit {kind: "backlog", action: "add", name: "refactor-<topic>", note: "refactor: <smell> in <files>"}`.
4. **Evidence before claims** — run the task's `_Verify:_` fresh and tick with `spec_complete_task {name, number,
   evidence: {command, exitCode, summary}}`: the `_Verify:_` command itself (several: all of them joined with ` && `). A
   non-zero exit refuses the tick (an `_Expect: fail_` task is proven by its red run); a note alone leaves a runnable
   `_Verify:_` unverified. Or `node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" done <feature> <n> --run`.

**Can't run the `_Verify:_` yourself?** Don't tick — name the command and ask the user to run it and paste the output (or
the line above); never send a subagent to look for a shell. A wrong tick: `spec_complete_task {name, number, undo: true,
reason}`.

**`--subagents`** — `${CLAUDE_PLUGIN_ROOT}/skills/dev-spec-driven/references/subagent-execution.md`: its preconditions
(doctor ready, tasks approved, not on the default branch, `trace_check` passing, baseline green), then per task
`spec_task_brief {write: true}` → `dev-spec-driven:spec-implementer` → `dev-spec-driven:spec-reviewer` (each Critical /
Important finding checked by a verify-mode reviewer first — 80 or more opens a fix round; a new unit that is a
duplicate in the existing codebase is Important) → `spec_complete_task` after a clean review. Stop at every `**Checkpoint:**`;
`inlineOnly` tasks run inline; `spec_next_task {waves: true}` plans parallel waves.

**`commit [note]`** — draft a conventional commit (`type(scope): summary`) whose body cites the chain: `Part of
.specs/<feature>/ task #N.`, `Makes T-xx green` (+tdd), the eval delta (+ai); Phase 4 tests and a red regression test in
their own `test:` commit. Commit only if the user asked.

After the last task: `/spec-review <feature> converge` if you doubt an AC is delivered, optionally
`/spec-review <feature> simplify`, then `/spec-finish`. Blocked? Pause and discuss — never improvise outside the design.
Respond in the user's language (EN / PT / ES).
