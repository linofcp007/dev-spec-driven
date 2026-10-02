---
description: Optional simplification pass before /spec-finish — behaviour-preserving cleanups of the code the feature added, one commit each, proven by its own tests and reviewed. PT - passagem de simplificação antes de fechar (sem mudar o comportamento). ES - pasada de simplificación antes de cerrar (sin cambiar el comportamiento).
argument-hint: "[feature name] [--subagents]"
---

Use the **dev-spec-driven** skill — the simplification pass (`references/code-reuse-and-quality.md` → "The
simplification pass"; with subagents, `references/subagent-execution.md` → "The simplification pass").

Feature: $ARGUMENTS

1. **When.** Every task done (`spec_status` — open tasks come first) and the final review's fixes in, **before**
   `/spec-finish`: a written finish records the drift baseline, and the project checks must pass on the final code.
   Worth it when the reviews deferred smells in new code, or the code grew through fix rounds; skip it for a small
   change.
2. **Scope.** `MERGE_BASE = git merge-base <base-branch> HEAD`; only the lines `git diff MERGE_BASE..HEAD` added or
   changed. Never a test, a contract (an exported signature, a route, a status or error code, a schema, a config key,
   text a user sees, a log line or metric something reads), a new dependency, a prompt file (+ai) or code the feature
   didn't write — a smell there is a refactor candidate: `spec_backlog {action: "add", name: "refactor-<topic>", note:
   "refactor: …"}`.
3. **The list.** The ledger's deferred minors (`.specs/<feature>/.execution/ledger.md`, when the feature ran with
   subagents), the final review's "can ship" minors, then a read of the diff with the smell table and the project's
   written rules (the constitution, `CLAUDE.md` / `AGENTS.md`, `structure.md`, `glossary.md`).
4. **Run it.** Record `SIMPLIFY_BASE = git rev-parse HEAD`.
   - **Inline (default):** the baseline first — the project checks (`roadmap.json → meta.checks`) or the full suite,
     green on HEAD (red → stop: not a simplification problem). Then one simplification at a time: the change, the tests
     covering it, its own commit (`refactor(<feature>): <what> — no behaviour change`); a test turns red → undo that
     change, never edit the test. At the end, the project checks (or the full suite) again. In Claude Code the built-in
     `/simplify` can suggest candidates; each one still goes through this loop.
   - **`--subagents`:** dispatch `dev-spec-driven:spec-simplifier` with the feature, MERGE_BASE, the list, the project
     checks and the report path `.specs/<feature>/.execution/simplify-report.md`. Its DONE needs the final passing
     runs in that report (the SubagentStop gate sends it back otherwise).
5. **Review the pass.** Package `SIMPLIFY_BASE..HEAD` as a task's review package and dispatch
   `dev-spec-driven:spec-reviewer` in **simplify** mode — without subagents, run its checklist yourself: behaviour
   unchanged, no test or contract touched, inside the feature's lines, actually simpler. Verify each Critical /
   Important finding first (`references/subagent-execution.md` → "Verify the findings"; inline, answer its five
   questions yourself). A confirmed one is **reverted** (`git revert <sha>`) — never repaired in a second pass.
6. **Prove it.** For each done task whose `_Implements:_` files the pass changed, its `_Verify:_` again —
   `node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" done <feature> <n> --run`, or `spec_complete_task {name, number,
   evidence}` with the run from the simplifier's report (on a ticked task it is a re-check: a failing one makes the task
   unverified — revert the commit that broke it). Not an `_Expect: fail_` task: its red run stays its proof. The
   project checks are recorded by `/spec-finish` — a run made before the pass reads `code-changed` there.
7. **Report.** The commits, the cleanups dropped and why, the runs (command, exit code, output tail), the refactor
   candidates filed; with subagents, a ledger line `Simplify: N commits (a1b2c3d..e4f5a6b), M dropped, review clean`.
   Nothing worth simplifying is a fine result — say so. Never "behaviour unchanged" without the runs.

Then `/spec-finish`. Respond in the user's language (EN/PT/ES).
