# Change management — after the spec was approved

Read on demand from `SKILL.md`. Specs change: a stakeholder rethinks a rule, implementation reveals a gap, a
later feature replaces an earlier behaviour, code drifts after the feature shipped. The engine never forbids a
change — it makes every change **visible, diffable and re-approved**, so an edited spec is never silently shipped
as if it were the approved one. Inspired by OpenSpec's deltas and BMAD's correct-course, done locally.

## 1. Approval history and snapshots

Every `spec_approve` (CLI `dev-spec approve`) does three things:

- `.state.json → approvals[<phase>]` — the **latest** approval: `{at, by, fingerprint}` (plus `forced` and the
  `failing` check ids when it was forced over failing checks). The fingerprint is a hash of the artifact's
  content (`tasks.md` with checkboxes normalized — ticking a task is progress, not a spec edit).
- `.state.json → approvalHistory[]` — every approval ever made, in order (`{phase, at, by, fingerprint, snapshot,
  forced?, failing?}`), so re-approvals (rework) are countable.
- `.specs/<feature>/.history/<phase>@<n>.md` — a **snapshot** of exactly what was signed off (`n` counts that
  phase's approvals). A bugfix's design approval signs off `bug.md` and keeps `design.md` beside it
  (`design@<n>.design.md`). **Commit `.history/` with the spec** — unlike `.execution/`, it is not self-ignored:
  it is the spec's change log.

Approvals made before 1.13 have only a fingerprint (no snapshot): tools can tell *that* the artifact changed,
not *what*. Re-approving the phase starts its history.

## 2. Noticing a change

An approved artifact whose content no longer matches its own approval is flagged everywhere:
`spec_doctor` (`changed-since-approval`, warn), `spec_next_action` (`step: "re-review"`, before any fix, approval
or task), `spec_finish` (a **blocker**) and the roadmap's "needs attention". The fix is never to ignore it:
re-review, then re-approve.

## 3. `spec_impact` — what the edit touches

`spec_impact {name, phase?}` (CLI `dev-spec impact <feature> [--phase requirements|design|tasks]`) diffs the
current artifact against the latest approval's snapshot:

| Phase | Diff | Reaches |
|---|---|---|
| `requirements` (default) | ACs by stable ID — added / modified (whitespace-normalized text differs) / removed — plus `SC-`/`EC-`/`NFR-` IDs | per modified/removed ID: the tasks citing it in `_Requirements:_` (done/open + evidence state), the T-IDs covering it in the test plan, the design sections naming it |
| `design` | `##` sections by normalized body (a bugfix: `bug.md` and `design.md`, each section keyed by file) | the tasks citing an ID a changed section names |
| `tasks` | task numbers added / removed / changed (checkbox state ignored) | — |

`affectedTasks` lists every task a change reaches, once, with `via` (which IDs/sections reach it).
`baseline: "fingerprint-only"` = a pre-1.13 approval: review by hand, then re-approve. `baseline: "none"` = no
fingerprint either (≤1.10, or a 1.12 bugfix design approval): whether it changed is unknown (`changed: null`) —
a file date is never evidence, so `spec_finish` only warns about such approvals; re-approve to start tracking them.

## 4. Reopen — only with the human's OK

`spec_impact {…, reopen: true}` (CLI `--reopen`; requirements or design only):

- **unticks** the affected DONE tasks in `tasks.md` (line endings kept);
- marks their evidence **stale** — reason code `stale-evidence`, unverified until a new passing run (or, for a
  task without a runnable `_Verify:_`, a new note) is recorded;
- records a **change request** in `.state.json → changes[]`: `{at, phase, snapshot, added, modified, removed,
  reopened, digests}`;
- refreshes the roadmap. It never edits `requirements.md` or `design.md`, and a second reopen with nothing new
  changes nothing (the digests make it idempotent).

A **removed** criterion is not redone: the tasks citing it are never unticked (nor by a design section that names
only criteria requirements.md no longer defines). `spec_impact` lists them, with the test-plan rows covering it, in
`retire` (`[{id, tasks, tests}]`) — delete them or point them at the criterion that replaces it. Until then
`trace_check` reports them as phantoms, and `removedAcs` (`[{id, changeRequest}]`) lets doctor, trace and the approve
gate say which change request removed them instead of "typos?".

### The loop

```text
edit an approved artifact
  → doctor / next_action flag it (changed-since-approval / re-review)
  → spec_impact: show the diff + affected tasks/tests/sections to the human
  → human decides: intended? which done tasks must be redone?
  → spec_impact --reopen (only with that OK)
  → update what the change reaches: design sections, test-plan rows, tasks (new work: spec_append_tasks)
  → spec_doctor, then re-approve each changed phase (a new snapshot)
  → redo the reopened tasks with fresh evidence
```

New tasks go in through **`spec_append_tasks`** (the converge pass, `/spec-converge`): appended under "Phase:
Convergence", numbered after the highest task, existing tasks never renumbered; the result says
`needsReapproval` — re-approve the tasks phase.

## 5. `_Supersedes:_` — a later feature replaces an earlier criterion

Don't rewrite a finished feature's history. Write the new behaviour in the new feature and mark the NEW criterion
with the English-stable marker:

```markdown
1. **US-1.AC-2** — WHEN a key is rotated THE SYSTEM SHALL keep the old key valid for 24 hours. _Supersedes: api-keys/US-2.AC-1_
```

The marker sits on the criterion's line, a sub-line under it, or its table row, and may list several
`<feature>/US-n.AC-m` references. `trace_check` reports references that resolve to nothing as
`phantomSupersedes` warnings (`spec_doctor`: the `supersedes` warning). The catalog shows the old criterion as
superseded, naming its replacement. `spec_feature rename` rewrites the markers that name the renamed feature, in
active and archived features alike.

## 6. The living catalog — `.specs/SPECS.md`

`spec_catalog` (CLI `dev-spec catalog`) answers "what does the system do today?": every feature (active,
complete/finished, archived) with its status and every AC ID with a one-line EARS text, superseded ones marked.
`finished` means what `spec_next_action` and `spec_finish` mean: a current finish baseline (no change request,
re-approval or new `_Implements:_` file since), every artifact as approved (an edit not yet re-approved reads
`complete`) and every tick verified — otherwise the feature reads `complete` until it is finished again.
`write: true` (`--write`) writes `.specs/SPECS.md` in the project language with the AUTO-GENERATED marker; a
hand-written `SPECS.md` is never overwritten. Once it exists, every mutator that refreshes the roadmap refreshes
it too. Never hand-edit it.

## 7. Drift since finish

`spec_finish {write: true}` on a **ready** feature records a baseline in `.state.json → finished`: a
CRLF-normalized hash of every file its `_Implements:_` markers name (a folder expands to its files; only files
inside the project). `spec_drift {name?}` (CLI `dev-spec drift [feature]`, exit 1 on drift or a stale baseline)
reports per finished feature the files **changed**, **missing**, or **now present** since then; features without a
baseline are listed as `unbaselined`, finished features whose tasks were reopened as `reopened`, and finished features
that changed since the finish and are done again as `stale` (a change request or a re-approval after the finish —
the converge pass's `spec_append_tasks`, a reopened change request — or, for an active feature, an `_Implements:_`
file the baseline never recorded: the old baseline no longer covers them — their recorded files are still hashed, and
one that drifted lists the feature as drifted too: a stale baseline never hides a changed file). An archived feature
is never walked for new files (it can't be finished again where it is); when it is stale the CLI line says to restore
it first (`spec_feature restore`, finish, archive again). The SessionStart hook prints one line
per drifted active feature (bounded; `dev-spec drift` checks on demand). Decide per feature: the spec is now wrong
→ `spec_impact` / a new feature with `_Supersedes:_`; the code is wrong → fix it (`/spec-bugfix`); harmless →
accept and re-run `spec_finish {write: true}` for a fresh baseline (its `baseline.replaced` names the drift it
accepted — a re-finish never erases it silently). `spec_next_action` on a finished feature answers `drift` (with the
files — also on a stale baseline: decide first, then finish again) or `finished` (asking for the `execution` sign-off
while it is missing) — never "close it with spec_finish" again; and `verify` first while a ticked task's latest run
failed or its runnable `_Verify:_` never ran (`dev-spec done <f> <n> --run`), which spec_finish refuses. After a change request or follow-up tasks (§4, the converge pass) are done, it answers `finish` again with
`staleBaseline` {finishedAt, since, newFiles}: re-run `spec_finish {write: true}` (a fresh readiness report, merge
summary and baseline that includes the new files), then the `execution` sign-off again — one given before the change
is asked for again.

## 8. Archive and restore

`spec_feature archive` moves the feature to `.specs/_archive/<slug>/` and records in its `.state.json →
archived` the roadmap entry and every `dependsOn` reference it pruned from other features; the result names those
features (`dependentsPruned`) and warns (`incompleteDependency`, a `note`) when the archived feature wasn't complete —
they now read as unblocked in the roadmap although its work was never done. `spec_feature restore`
moves it back and puts those back — only references to features that still exist, never one that would now
close a cycle (the rest are listed in `skipped`). Archive is the reversible alternative to `remove` (which needs
`confirm: true`). Archived features still count for `spec_coverage` and appear in the catalog.

## 9. Measuring it

`spec_metrics` reads all of the above: rework = approvals of a phase beyond its first (`approvalHistory`), forced
approvals, change requests and reopened tasks (`changes`), evidence pass rate (recorded runs), lead times from
`createdAt`. `write: true` drafts `retro.md` — its steering/constitution amendments are proposals for the human,
never applied automatically.
