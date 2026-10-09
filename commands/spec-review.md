---
description: Review a feature — its branch against the spec, a converge or simplification pass, review feedback, a prompt change.
disable-model-invocation: true
argument-hint: "[feature] [branch | converge | simplify [--subagents] | feedback <comments> | prompt]"
---

Use the **dev-spec-driven** skill, review loops. Args: $ARGUMENTS (default mode: `branch`). The protocols:
`${CLAUDE_PLUGIN_ROOT}/skills/dev-spec-driven/references/subagent-execution.md` (converge, verify, the simplification pass).

**branch** — a local pre-merge review of `git diff <merge-base>..HEAD` (`git merge-base <base-branch> HEAD`) against the
whole chain: spec compliance (the design, every AC); the **Constitution** — `.specs/steering/constitution.md`, a break
justified in the design's Complexity Tracking or sent back; each active track's checks (`track-checklists.md` beside the
protocols); security always; **Written rules** — the `CLAUDE.md` / `AGENTS.md` files and the comments around the changed
code, a break quoted with its file:line; **History** — lines the branch rewrites (`git log -L` / `git blame`): a fixed bug
brought back is Critical. **Verify before you report.** Each Critical / Important finding: does it exist at HEAD, did
this branch introduce it, is it not what an AC or `decisions.md` asks for? Rate each 0–100: **0** not real or pre-existing ·
**25** might be real, unverified · **50** verified but minor · **75** verified and likely hit · **100** direct evidence.
With a subagent tool, write the diff to `.specs/<feature>/.execution/review.diff` and dispatch one
`dev-spec-driven:spec-verifier` per finding (the finding verbatim, the diff, the merge base and HEAD, the feature folder) —
in parallel; without one, check each yourself and say so. Report the findings rated 80 or more by severity, the rest one
line each under "Unconfirmed (below 80)"; then `trace_check {name}` (`matrix: true` for the traceability matrix).

**converge** — the feature AC by AC against the code: `spec_status` + `trace_check {name, code: true}`, then
`dev-spec-driven:spec-reviewer` in converge mode (inline without subagents): per AC implemented (file:line)? tested
(T-ID)? → ✅ / ❌ / ⚠️, with proposed tasks (an ❌ checked by a `dev-spec-driven:spec-verifier` before it costs a task).
A gap that needs another AC, design decision or test is no task:
`/spec-change <feature> impact`. Append only the tasks the user approves — `spec_append_tasks {name, tasks}` — then, on
their yes, re-approve `tasks` with `spec_approve`.

**simplify [--subagents]** — optional, every task done, **before** `/spec-finish`: behaviour-preserving cleanups of the
lines the branch added or changed — never a test, a contract or code the feature didn't write (a smell there → the
backlog). The baseline green first; one change at a time, its covering tests, its own commit; a red test → undo it.
Don't run Claude Code's built-in `/simplify` inside the pass (it applies everything in one go). Under **guard mode** each
edit asks the user — say so first. `--subagents`: `dev-spec-driven:spec-simplifier`, under guard mode in the foreground
(`run_in_background: false`). The report, `.specs/<feature>/.execution/simplify-report.md`: `## Baseline` · `## Changes`
· `## Dropped` · `## Left alone` · `## Final runs` LAST — one line per run, `` - `<the exact command>` → exit 0 (212 passing) ``.
Then a simplify-mode `spec-reviewer`, after an inline pass too: a confirmed finding is **reverted** (`git revert <sha>`),
never repaired; a revert that conflicts is aborted (`git revert --abort`) and stops the pass. Re-record each changed
task's `_Verify:_` (`node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" done <feature> <n> --run`) and the project checks,
each under its `meta.checks` name (`… finish <feature> --run`) — never add checks just to record a run.
Never "behaviour unchanged" without the runs.

**feedback `<comments>`** — read them all first; verify each against the code and the spec, then: an AC violation → fix it,
cite the AC · a spec change → don't implement, take it to its phase · out of scope / YAGNI → push back citing the spec ·
quality within scope → fix with a test · a nit → if cheap · unclear → ask. One at a time, the covering tests after each,
fresh evidence (`spec_complete_task`). Reply with the change or the evidence, never performative agreement.

**prompt** (+ai) — a prompt change lands only with its eval delta (golden up, adversarial held, regression intact), its
cost delta and a bumped `prompts/vN.md`; without eval results it waits for the harness (`/eval`).

Respond in the user's language (EN / PT / ES).
