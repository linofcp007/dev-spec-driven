---
description: Close a feature locally — verify it is really done, draft the merge summary, then merge or keep the branch.
disable-model-invocation: true
argument-hint: "[feature] [--run]"
---

Feature: $ARGUMENTS — an optional simplification pass (`/spec-review <feature> simplify`) changes code: run it before
this, not after. With a review panel (`spec_next_action`'s `reviewPanel`), the branch review on every model comes first —
unless the ledger already has its `Final review: ×N` line since the last task (a task done inline writes no ledger line —
if you did one after the review, run it again). The branch review reads `merge-base..HEAD`: commit the feature's work
before it.

1. `spec_finish {name, write: true}` (CLI `dev-spec finish <feature> --write`). Not `readyToFinish` → show the
   **blockers** and stop: failing doctor checks, open or unverified tasks, project checks without a passing run on the
   current code (`suite-evidence`), pending approvals, an artifact changed since its approval, placeholders, a bugfix's
   root cause. Show the warnings too — each one deserves a decision (code the feature repeats from elsewhere: reuse it, or
   say why the copy is deliberate; raw colours or sizes where the design system has tokens: use the token, or say why not;
   a protected test changed with no recorded reason — guard tests: check the change is intended, a test made to pass is a
   weakened test; if it is, the user accepts it with the `feature protect <feature> <file> --accept --reason "…"` line the
   warning gives — its current content becomes the recorded one, so the re-check is explained and the test stays protected
   for every later feature; never a `feature unprotect` here: a lift lasts until `feature protect <feature> <file>`; a
   METRIC reading worse past its stated tolerance, or a loosened METRIC line: tell the user — the number holds every change
   merged since the earlier finish, not only this feature's — and never loosen the line to pass).
   **The finish batch — ONE question.** The warnings that need the user's decision come in this order: dev-guardian's,
   test integrity's (`testIntegrity`: tests weakened, suppressions added), the metrics' (a regressed or loosened metric),
   the lessons' (`lessons`: the open ones). Ask ONE question for all of them, never one per warning: per lesson the
   amendment, grouped by target (`${CLAUDE_PLUGIN_ROOT}/skills/dev-spec-driven/references/subagent-execution.md` → 7b — a
   target inside the feature's own folder is a spec change, never a steering line; the approved features a constitution or
   track-file edit flags, named); per platform item its backlog name — `friction-<check>` for an over-budget check or a
   `tool-friction` lesson on a `meta.checks` command, else `platform-<topic>` (the over-budget checks are the ones
   `spec_next_action`'s finish step names, `friction.over`); per check a shape still breaks, `check-<topic>`; per metric
   or finding what the user fixes or accepts. Apply the answers — each file edited once, the lessons closed by ONE `spec_decide` entry that supersedes
   them — then run step 1 again.
   After a protected test's accept (or a lift), run step 1 again (`spec_finish {name, write: true}`): the merge summary then lists the
   accept and no longer names the test as changed — the one written before it still does.
2. **Verify fresh, now** — the full suite and every check the report lists for the active tracks. With project checks set,
   record them: `spec_finish {name, evidence: [{name, command, exitCode, summary}]}`, or
   `node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" finish <feature> --run` (`--run` given: run that). No shell? Ask the user to
   run them and paste the output — never record a run nobody made, never send a subagent to look for a shell.
   With the project check `guardian` set (`init --guardian`), this runs **dev-guardian's gate** (its scan takes minutes):
   run the CLI line above with the Bash tool's `timeout: 600000` (or in the background) — it records the report itself;
   only without it run the check's command and add its JSON stdout as `report`. A new finding at or above the threshold
   blocks — fix it; to accept ONE reviewed finding the user suppresses it inline with a reason (`nosemgrep: <rule> --
   <reason>`), never with `baseline update` (it accepts every current finding, this feature's too). An incomplete scan
   blocks until its gaps are fixed (the blocker says how). Never force the finish, or drop the check, without the user.
3. Show the merge title and summary (`.specs/<feature>/.execution/merge-summary.md`), then ask the user **explicitly**
   whether they sign off the `execution` phase, and call `spec_approve {name, phase: "execution"}` only on their yes.
   **A green run is evidence, not the sign-off:** after the run, show it and ask. A ready written finish also records
   the drift baseline — finish again after last-minute code changes — and, on a +ui feature of a project with a design-system
   registry, adds the design's New components to `.specs/steering/design-system.md` (`designSystem.registered`): a change to
   commit with the feature. Forced approvals appear under "Waived gates", a feature's protected tests (what changed, the
   lifts, the accepts) under "Protected tests".
4. Before either option, a feature with a review ledger (`.specs/<feature>/.execution/ledger.md`) files the residues after
   its last `Residues filed:` line (`${CLAUDE_PLUGIN_ROOT}/skills/dev-spec-driven/references/subagent-execution.md` →
   Closing: the ledger goes with `.execution/`); then commit the spec state with the feature — what the run and the closing
   wrote under `.specs/`: `git add` the feature's folder, `.specs/roadmap.json` and the generated roadmap files the project
   has (`.specs/ROADMAP.md`, `.specs/ROADMAP.html`, `.specs/SPECS.md`) — with `.specs/steering/design-system.md` when the
   finish registered components, and a steering file the run amended —, then commit (a path git ignores stays out:
   `git add` names it and adds the rest; a git-ignored `.specs/` has nothing to commit). Git carries any other uncommitted
   change across the switch: it is not lost and not committed (one the switch would overwrite makes it refuse, naming the
   file: ask the user). Offer exactly two options: **1. merge into the base branch locally** — `git switch <base>`,
   then `git merge <branch>`: the branch `spec_finish`'s merge line names (`feature/<slug>` by default, `fix/<slug>` for a
   bugfix); without one, the branch you worked on, if it is not the base. A fast-forward when possible; a merge commit
   (`--no-ff`, or branches that diverged) takes the merge title and summary as its message **· 2. keep the branch as it
   is** (the residues stay on it). Run only the one the user picks; after a merge, the full suite again. Pushing is a
   separate step the user approves.
5. Once merged, delete `.specs/<feature>/.execution/` (keep `.history/`); offer `/spec-report metrics <feature> --write`
   (a retro), `/spec-report catalog --write` and, for a release, `/spec-report changelog`. A spike finishes once its
   decision is written.

Respond in the user's language (EN / PT / ES).
