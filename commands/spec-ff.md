---
description: Fast-forward approval ("quick spec") - approve every filled planning phase in order, each through its own gate. PT - avanço rápido das aprovações. ES - avance rápido de las aprobaciones.
argument-hint: "[feature name] [through-phase, default tasks] [--role name] [--force]"
---

Use the **dev-spec-driven** skill approval gate, fast-forward mode.

Args: $ARGUMENTS

**Size xs / s (1.21) — the default way to approve the plan:** `spec_next_action` names this call from the start (its
`fastForward`): fill the whole plan, then approve it once — a change (size xs) has a single planning approval, `tasks`
(its `change.md`); size s approves requirements → design (→ test-plan / eval-plan) in order — with +tdd / +ai the call ends
there — at the last plan before `tests`: `/spec-ff <feature> test-plan` with +tdd alone, `eval-plan` whenever +ai
is on (the phase `spec_next_action`'s `fastForward.through` names): Phase 4's `tests` gate needs the failing tests / eval sets written first
(`/writeTests`), then approve `tests`, then `tasks`. Each gate still runs.

For a small or well-understood feature whose planning artifacts are already written: instead of one `/approve` per
phase, approve them all in one go — still **phase by phase, each through its own gate**. Only record approvals the
user actually gave: say which phases this will approve and get their go-ahead first. Run `spec_next_action` first — when
every planning artifact up to `tasks` is filled and passes its gate, its recommendation already names this command.

Call the `spec_approve` MCP tool with the feature name and `through` (default `tasks`; any planning phase:
classification, requirements, design, test-plan, eval-plan, tests, tasks) instead of `phase` — CLI
`dev-spec approve <feature> --through <phase>`. It approves the active phases **in order**, from the first unapproved one
up to `through`; each one runs exactly the checks `/approve` runs, is snapshotted and recorded in `approvalHistory` like
a normal approval, and is flagged `batch: true` (`spec_metrics` counts batch approvals separately).

**It never skips a gate.** It stops at the first phase whose gate refuses it (`ok: false`, `refused`, `stoppedAt`,
`failing`, `checks`) — the phases before it stay approved (`approved`). Show which phases were approved and why it
stopped, fix the failing checks (or ask the user to), then run it again: it resumes at the phase that stopped it.
A phase with nothing to approve (its artifact is missing) also stops it. `execution` is never fast-forwarded — sign it
off on its own after `/spec-finish`.

`force: true` (CLI `--force`) forces each gate like `/approve --force` — only when the user explicitly chose to accept
the failures, and say so; every forced approval stays flagged.

**Approvals by role** (when `.specs/roadmap.json → meta.approvalRoles` lists phases — `spec_init {approvalRoles}` /
`dev-spec init --roles requirements=product,design=tech+security`): pass `role` (CLI `--role <role>`) — that role signs
each phase. A phase that needs a role other than the one given stops the fast-forward (nothing recorded for it); a phase
that still waits for another role after this sign-off stops it too (`ok: true`, `complete: false`, `missingRoles`) —
the later phases can't be approved before it. Tell the user which roles still have to sign.

Confirm what was recorded (`approved`, `steps`). Respond in the user's language (EN/PT/ES).
