---
description: Optional simplification pass before /spec-finish — behaviour-preserving cleanups of the feature's code, proven by its tests.
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
4. **Run it.** Record `SIMPLIFY_BASE = git rev-parse HEAD`. The report lives in `.specs/<feature>/.execution/`; a
   missing folder (the feature ran inline) gets a `.gitignore` holding `*` first — it ignores itself. With **guard
   mode** on (`meta.guard` on or `scope`), each edit of the pass asks the user — once every task is done no open task
   covers it: say so first; approve each edit, never lower the guard for it.
   - **Inline (default):** the baseline first — the project checks (`roadmap.json → meta.checks`) or the full suite,
     green on HEAD (red → stop: not a simplification problem). Then one simplification at a time: the change, the tests
     covering it, its own commit (`refactor(<feature>): <what> — no behaviour change`); a test turns red → undo that
     change, never edit the test. At the end, the project checks (or the full suite) and the changed tasks' `_Verify:_`
     again. Write the same report the agent writes — `.specs/<feature>/.execution/simplify-report.md`, under these
     headings (kept in English): `## Baseline` (the command, its exit code written out, the counts) · `## Changes` (one
     line per commit: short SHA, file:line, the smell → the refactoring, the covering tests) · `## Dropped` (tried and
     undone, the test that went red) · `## Left alone` (and why; smells outside the feature's lines as refactor
     candidates) · `## Final runs` LAST — one line per run (each project check or the suite, each re-run `_Verify:_`) at
     the margin, `` - `<the exact command>` → exit 0 (212 passing) ``: the command in backticks, its exit code written
     out on the same line, the output's last lines indented below it. Don't run Claude Code's built-in `/simplify` inside the pass: it applies its
     cleanups in one go, over its own idea of the changed code — this loop needs one change, one test run and one commit
     at a time.
   - **`--subagents`:** dispatch `dev-spec-driven:spec-simplifier` with the feature, MERGE_BASE, the list, the project
     checks, the report path `.specs/<feature>/.execution/simplify-report.md` and the plugin's references folder path
     (`${CLAUDE_PLUGIN_ROOT}/skills/dev-spec-driven/references/`). Its DONE needs a `## Final runs`
     section in that report in which every run passes and every project check is one of them (the SubagentStop gate
     sends it back otherwise). Under guard mode, dispatch it in the foreground (Claude Code: `run_in_background: false`)
     so its edit questions reach the user.
5. **Review the pass.** Package `SIMPLIFY_BASE..HEAD` as a task's review package and — whenever the host has a subagent
   tool, after an inline pass too — dispatch `dev-spec-driven:spec-reviewer` in **simplify** mode with the package
   path, MERGE_BASE, SIMPLIFY_BASE, the report path and the feature folder; with no subagent tool, run its checklist
   yourself and say the pass is self-reviewed. It checks: behaviour unchanged, no test or contract touched, inside the
   feature's lines, actually simpler. Verify each Critical / Important finding first (`references/subagent-execution.md`
   → "Verify the findings"; without subagents, answer its questions yourself). A confirmed one is **reverted**
   (`git revert <sha>`, with the later commits that build on it, newest first) — never repaired in a second pass; a
   revert that conflicts is aborted (`git revert --abort`) and stops the pass, never a hand-resolved merge.
6. **Prove it.** For each done task whose `_Implements:_` files the pass changed, its `_Verify:_` again —
   `node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" done <feature> <n> --run`, or `spec_complete_task {name, number,
   evidence}` with the run from the report (on a ticked task it is a re-check: a failing one makes the task unverified —
   revert the commit that broke it). Not an `_Expect: fail_` task: its red run stays its proof. With project checks set
   (`meta.checks`), record them on this code too, even when no task's files changed — `/spec-finish`'s `code-changed`
   rule sees only the files the tasks implement: `node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" finish <feature> --run`,
   or `spec_finish {name, evidence: [{name: <check name>, command, exitCode, summary}]}` from the report's final runs,
   each under its `meta.checks` name. No project checks: nothing to record (`/spec-finish` asks for the full suite fresh)
   — never add checks just to record a run.
7. **Report.** The commits, the cleanups dropped and why, the runs (command, exit code, output tail), the refactor
   candidates filed; with subagents, a ledger line `Simplify: N commits (a1b2c3d..e4f5a6b), M dropped, review clean`.
   Nothing worth simplifying is a fine result — say so. Never "behaviour unchanged" without the runs.

Then `/spec-finish`. Respond in the user's language (EN/PT/ES).
