---
description: Change an approved spec — the impact of an edit, a decision log entry, or a track turned on or off.
disable-model-invocation: true
argument-hint: "[feature] [impact [phase] [--reopen] | decide <what was decided> | track +x | track -x]"
---

Args: $ARGUMENTS

Detail: `${CLAUDE_PLUGIN_ROOT}/skills/dev-spec-driven/references/change-management.md`.

**impact `[phase]` `[--reopen]`** — an approved artifact was edited (doctor `changed-since-approval`, next_action
`re-review`): `spec_impact {name, phase}` — requirements by default; design · test-plan · eval-plan · tasks (a change's
is tasks); `steering` without a name lists every feature an amended steering file governed (read-only). Show the diff
and `affectedTasks` with their evidence; ask whether the change is intended and which done tasks to redo. Only with the
user's OK: `reopen: true` — it unticks the affected done tasks and marks their evidence stale, never a removed
criterion's tasks (`retire` lists them to delete or repoint). Then update what the change reaches, `spec_doctor`, and — on
the user's yes — re-approve each changed phase with `spec_approve`. Never reopen on your own; never treat a changed
approved spec as still approved.

**decide `<what was decided>`** — `spec_decide {name, title, decision, context?, consequences?, affects?, supersedes?,
kind?}`: the next `D-n` in `decisions.md`, append-only (to change a decision, record one that supersedes it). `affects`:
AC IDs, T-IDs, EC / NFR / SC IDs and design sections as design.md spells them (`Data Models`); an unknown one is refused
(`unknownAffects`). A fact learnt while working: `kind: "discovery"`. Doctor then warns `decision-affects-approved` →
`impact`.

**track `+x` | `-x`** — `spec_add_track {name, track}` (tdd · saas · ai · sec · privacy · dist · api · ui · obs · data,
or a project pack): additive, never overwrites — report the files added, then fill the new design sections, criteria and
tasks (the design gate refuses unfilled track sections) and re-approve what changed. `-x` → `remove: true`: the track
leaves the set and no file is deleted (`core` stays; a bugfix keeps +tdd).

Respond in the user's language (EN / PT / ES).
