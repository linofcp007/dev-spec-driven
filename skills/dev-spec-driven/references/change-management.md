# Change management — after the spec was approved

Read on demand from `SKILL.md`. Specs change: a stakeholder rethinks a rule, implementation reveals a gap, a
later feature replaces an earlier behaviour, code drifts after the feature shipped. The engine never forbids a
change — it makes every change **visible, diffable and re-approved**, so an edited spec is never silently shipped
as if it were the approved one. Inspired by OpenSpec's deltas and BMAD's correct-course, done locally. Sections
11–13 cover the decision log, approvals by role + fast-forward, and the stakeholder export + release notes; section 14
the steering amendments (an approval made under a steering file that changed since); section 15 milestones.

## 1. Approval history and snapshots

Every `spec_approve` (CLI `dev-spec approve`) does three things:

- `.state.json → approvals[<phase>]` — the **latest** approval: `{at, by, fingerprint}` (plus `forced` and the
  `failing` check ids when it was forced over failing checks, and — 1.16 — its `waiver {reason, expires}` when the
  force gave one: `--force --reason "…" --expires 30d`; doctor warns `waiver-expired` once the date passed). The fingerprint is a hash of the artifact's
  content (`tasks.md` with checkboxes normalized — ticking a task is progress, not a spec edit).
- `.state.json → approvalHistory[]` — every approval ever made, in order (`{phase, at, by, fingerprint, snapshot,
  forced?, failing?}`), so re-approvals (rework) are countable.
- `.specs/<feature>/.history/<phase>@<n>.md` — a **snapshot** of exactly what was signed off (`n` counts that
  phase's approvals). A bugfix's design approval signs off `bug.md` and keeps `design.md` beside it
  (`design@<n>.design.md`). **Commit `.history/` with the spec** — unlike `.execution/`, it is not self-ignored:
  it is the spec's change log.

Approvals made before 1.13 have only a fingerprint (no snapshot): tools can tell *that* the artifact changed,
not *what*. Re-approving the phase starts its history.

**Revoking an approval** (1.16): `spec_approve {name, phase, revoke: true, reason}` (CLI `dev-spec approve <feature>
<phase> --revoke --reason "…"`) removes `approvals[<phase>]` and the role sign-offs waiting for it, and appends
`{phase, at, by, revoked: true, reason}` to `approvalHistory` — never a snapshot; the readers of the history as a list
of approvals (snapshots, metrics' rework, the changelog) skip it. It **never cascades**: the later phases stay approved
(`laterApproved`), the revoked one is pending again, and phase by phase still holds — approving another phase is
refused (`phase-order`) until it is re-approved. `spec_metrics` counts `revokedApprovals` (and `untickedTasks`,
`spec_complete_task {undo}`). A task unticked after a finish or an execution sign-off makes both stale (finish again,
sign off again once it is done) — and so does a revocation of a planning phase: `spec_drift` reads the feature `stale`
("approval revoked: …") and the catalog / SPECS.md read it complete, not finished, until the phase is re-approved and the
feature finished again (revoking the `execution` sign-off only asks for that sign-off again).

## 2. Noticing a change

An approved artifact whose content no longer matches its own approval is flagged everywhere:
`spec_doctor` (`changed-since-approval`, warn), `spec_next_action` (`step: "re-review"`, before any fix, approval
or task), `spec_finish` (a **blocker**) and the roadmap's "needs attention". The fix is never to ignore it:
re-review, then re-approve.

## 3. `spec_impact` — what the edit touches

`spec_impact {name, phase?}` (CLI `dev-spec impact <feature> [--phase requirements|design|test-plan|eval-plan|tasks]`) diffs the
current artifact against the latest approval's snapshot:

| Phase | Diff | Reaches |
|---|---|---|
| `requirements` (default) | ACs by stable ID — added / modified (whitespace-normalized text differs) / removed — plus `SC-`/`EC-`/`NFR-` IDs | per modified/removed ID: the tasks citing it in `_Requirements:_` (done/open + evidence state), the T-IDs covering it in the test plan, the design sections naming it |
| `design` | `##` sections by normalized body (a bugfix: `bug.md` and `design.md`, each section keyed by file) | the tasks citing an ID a changed section names |
| `test-plan` | planned tests by T-ID (a row keyed by its first cell, compared cell by cell — re-padding is no change) | per modified/removed T-ID: the tasks making it green (`_Makes green:_`) |
| `eval-plan` | `##` sections by normalized body, like `design` | the tasks citing an ID a changed section names |
| `tasks` | task numbers added / removed / changed (checkbox state ignored) | — |

`affectedTasks` lists every task a change reaches, once, with `via` (which IDs/sections reach it).
`baseline: "fingerprint-only"` = a pre-1.13 approval: review by hand, then re-approve. `baseline: "none"` = no
fingerprint either (≤1.10, or a 1.12 bugfix design approval): whether it changed is unknown (`changed: null`) —
a file date is never evidence, so `spec_finish` only warns about such approvals; re-approve to start tracking them.

## 4. Reopen — only with the human's OK

`spec_impact {…, reopen: true}` (CLI `--reopen`; every phase but `tasks`):

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
complete/finished, archived) with its status and every AC ID with a one-line EARS text, superseded ones marked. Since
1.15 only a SHIPPED feature's `_Supersedes:_` retires the older AC (struck through; a finish recorded or the execution
signed off — the release notes' rule); a draft's reads "to be superseded by … (not shipped yet)" and the AC stays current;
a feature archived without ever shipping declares nothing, and its own ACs are not counted as current.
`finished` means what `spec_next_action` and `spec_finish` mean: a current finish baseline (no change request,
re-approval or new `_Implements:_` file since), every artifact as approved (an edit not yet re-approved reads
`complete`) and every tick verified — otherwise the feature reads `complete` until it is finished again.
`write: true` (`--write`) writes `.specs/SPECS.md` in the project language with the AUTO-GENERATED marker; a
hand-written `SPECS.md` is never overwritten. Once it exists, every mutator that refreshes the roadmap refreshes
it too. Never hand-edit it.

**Possible duplicates / conflicts (1.16).** The catalog also compares the ACTIVE features' criteria with each other
(`crossAcs` {pairs, truncated}; a `## ⚠ Possible duplicates / conflicts` section in `SPECS.md` when there is a pair):
a **near-duplicate** (`kind: duplicate`, reason `near-duplicate` — at least 80% of the words alike, same polarity, same
numbers) or a likely **conflict** (`kind: conflict` — at least 70% alike with the same trigger, reason `opposite-modal`:
SHALL vs SHALL NOT / DEVE vs NÃO DEVE / DEBE vs NO DEBE, or `different-numbers`: "5 times" vs "3 times"). It is a
deterministic heuristic — accents folded, EN/PT/ES stop words and EARS keywords out, a light plural fold, numbers compared
apart — bounded by an inverted index over each criterion's rarest words and by caps (4000 criteria, 200 000 comparisons,
200 pairs). Left out: template criteria (with their number slots filled in or not — two +sec features share their
scaffolded `[SEC]` criteria), two light edits of the same template criterion, criteria of fewer than 3 words, bugfixes and
spikes, criteria a SHIPPED feature superseded, and any pair where one criterion declares `_Supersedes:_` of the other
(shipped or pending). `spec_doctor` warns `cross-feature-acs` on each feature of a pair, naming the other feature's AC. The
fix: merge or reword the two, or — when the newer one replaces the older — declare `_Supersedes:_` on it (§5).

## 7. Drift since finish

`spec_finish {write: true}` on a **ready** feature records a baseline in `.state.json → finished`: a
CRLF-normalized hash of every file its `_Implements:_` markers name (a folder expands to its files; only files
inside the project). `spec_drift {name?}` (CLI `dev-spec drift [feature]`, exit 1 on drift or a stale baseline)
reports per finished feature the files **changed**, **missing**, or **now present** since then; features without a
baseline are listed as `unbaselined`, finished features whose tasks were reopened as `reopened`, and finished features
that changed since the finish and are done again as `stale` (a change request, a re-approval, an untick or a revocation
after the finish —
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

## 10. Upgrading after a plugin update

`roadmap.json → meta.specVersion` records the dev-spec version that last upgraded or created the project
(`spec_init` / `spec_create` stamp a brand-new project only — creating one feature in an older project stamps
nothing). While it is absent or older than the engine, the SessionStart hook prints one line pointing at
`/spec-upgrade`. First update the plugin (`/plugin marketplace update`, then restart; a clone: `git pull`), then:

1. **Audit** — `spec_upgrade {}` (CLI `dev-spec upgrade`, read-only): per active feature its status (not started ·
   planning · executing · complete · finished), what doctor fails / warns on, pending gates, artifacts changed since
   approval, approvals without a history baseline (`legacyApprovals`, `history.skip`), unverified tasks, drift, the
   next step and a `review`: `critic` when no task is ticked (run the read-only `spec-critic` agent over the
   artifacts, phase by phase), `converge` mid-execution (the spec-reviewer converge pass + the critic on changed /
   unapproved artifacts), `none` once complete. Grouped blocked (doctor fails) · attention · ok; `plan` = what apply
   changes.
2. **Apply** (after the human's OK) — `spec_upgrade {apply: true}` (`--apply`): saves inferred tracks to
   `.state.json`, records pre-history approvals in `approvalHistory` and, for each approval whose fingerprint still
   matches its file, saves that file as its baseline (`.history/<phase>@<n>.md`, so `spec_impact` can diff later
   edits); a changed or date-only approval is listed as skipped — re-approve to start its history. It also completes
   `.specs/.gitignore`, stamps `meta.specVersion`, writes the checklist `.specs/UPGRADE.md` and refreshes the generated
   `ROADMAP.md` / `.html` (like every mutator; the progress then follows the current rules). It never edits an
   artifact, approves, ticks or deletes; a second apply changes nothing.
3. **Review** — the critic / converge passes the audit recommends, their findings turned into a proposed action list
   per feature; every change still goes through the gates (`spec_approve`, `spec_impact`, `spec_append_tasks`).

## 11. The decision log — `decisions.md`

Decisions and discoveries made while planning or implementing get lost in chat and in the self-ignored
`.execution/ledger.md`. `spec_decide {name, title, decision, context?, consequences?, affects?, supersedes?, kind?}`
(CLI `dev-spec decide <feature> --title "…" --decision "…" [--context "…"] [--consequences "…"] [--affects
US-1.AC-2,T-03,"Data Models"] [--supersedes D-1] [--discovery]`; `/spec-decide`) appends ONE entry to
`.specs/<feature>/decisions.md` — committed with the spec, created with a localized header when absent:

```markdown
## D-2 — Keep the old key valid for 24 hours after rotation

- _Kind: decision_
- _Date: 2026-09-26T10:12:00.000Z_
- _Affects: US-1.AC-2, T-03, Data Models_
- _Supersedes: D-1_

**Context:** clients cache keys for up to a day

**Decision:** the rotated key stays valid for 24 hours
```

— the localized Context / Decision (Discovery for `kind: "discovery"`) / Consequences paragraphs follow the markers.

- **Append-only**, under the feature lock: an entry is never renumbered or rewritten (the file's bytes, BOM and CRLF
  line ends are kept). To change a decision, record a new one with `_Supersedes: D-n_`.
- **`affects` is validated** against the feature: an AC ID must be defined in `requirements.md`, a T-ID planned in
  `test-plan.md`, an EC / NFR / SC ID written in `requirements.md`, anything else must be a section heading of
  `design.md` (`bug.md` / `design.md` for a bugfix, `spike.md` for a spike). An unknown reference is refused
  (`unknownAffects`, nothing written); `supersedes` must name entries already in the log.
- **Where it shows up:** `spec_task_brief` inlines the current entries citing the task's ACs / T-IDs (bounded);
  the merge summary (`spec_finish`) and the stakeholder export get a Decisions section; `spec_catalog` lists each
  feature's decisions (superseded ones marked); `trace_check` reports `_Affects:_` references that name nothing any
  more (`phantomAffects`, warnings); `spec_doctor` warns `decision-affects` (the same phantoms) and
  **`decision-affects-approved`** — a current decision recorded AFTER the approval of the requirements or the design it
  names: re-review with `spec_impact`, update the spec and re-approve.
- A spike logs its go / no-go / pivot decision here too (usually `D-1`).

## 12. Approvals by role, and fast-forward

**Roles (team governance, opt-in).** `spec_init {approvalRoles: {"requirements": ["product"], "design": ["tech",
"security"], "tasks": ["tech"]}}` (CLI `dev-spec init --roles requirements=product,design=tech+security`; `--roles none`
or `{}` clears it) stores `roadmap.json → meta.approvalRoles`. A listed phase needs `spec_approve {…, role}` (CLI
`--role <role>`, one of that phase's roles):

- each sign-off runs the phase's gate (`force` records it forced) and is appended to `approvalHistory` with its role;
  until every role has signed it waits in `.state.json → signoffs[<phase>][<role>]` (history record `partial`, no
  snapshot) and the result is `ok` with `approved: null`, `signedOff`, `pending`, `missingRoles`;
- the phase stays **pending** until then — `spec_doctor`'s approval-gates (`nextGate.missingRoles`), `spec_next_action`
  ("missing role: security" and the `--role` to sign as), `spec_finish`'s blockers, `ROADMAP.md` and the guard hook all
  see it that way;
- the completing sign-off writes `approvals[<phase>].roles` and the snapshot, like a single approval;
- a sign-off of content that changed since no longer counts: that role signs the current content again;
- a phase approved before the roles were configured stays approved (by an unknown role); doctor and finish warn and
  ask each role to re-sign. Without `meta.approvalRoles`, one approval per phase, as before.

**Fast-forward (`/spec-ff`).** `spec_approve {name, through: "tasks"}` (CLI `dev-spec approve <feature> --through
tasks`) approves the active phases **in order** from the first unapproved one up to `through` — each through its own
gate, each snapshotted and recorded like a normal approval, flagged `batch: true` (`spec_metrics` counts batch
approvals). It stops at the first refused gate (`ok: false`, `refused`, `stoppedAt`, `failing`, `checks` — the phases
before it stay approved: `approved`), at a phase with nothing to approve, or — with roles — at a phase still waiting
for another role (`ok: true`, `complete: false`). `role` signs each phase, `force` forces each gate (only when the
user asked). `execution` is never fast-forwarded — it is signed off on its own after `/spec-finish`. `spec_next_action`
suggests it when every planning artifact up to `tasks` is filled and passes its gate. Only run it after the user
agreed to approve those phases: a fast-forward is still the human's approval, recorded once per phase.

## 13. Stakeholder export and release notes

**Export (`/spec-export`).** `spec_export {name?, format?, write?}` (CLI `dev-spec export [feature] [--md] [--write]`)
builds ONE self-contained, offline, printable document for people who don't read markdown folders:

- **a feature**, in its language — summary, stories with their EARS criteria and stable IDs (a criterion a SHIPPED
  feature superseded struck through, one a draft plans to supersede marked "to be superseded", a template one flagged), the other requirements sections, the design (a bugfix: `bug.md`), the test
  plan, every task with its done / verified status and reason, `decisions.md`, the approvals (who, when, forced,
  changed since, pending) and the open `[NEEDS CLARIFICATION]` markers;
- **the project** (no `name`), in the project language — the roadmap summary and backlog, every active feature's
  requirements digest (a printed page each) and the living catalog when `SPECS.md` exists.

`format` `html` (default: the roadmap's palette, light/dark with a toggle, print rules; every text escaped, links only
http(s)/mailto, nothing external loaded) or `md`. `write: true` writes `.specs/exports/<feature>.<format>` (the project:
`project.<format>`) with the AUTO-GENERATED marker; a same-named hand-written file is never overwritten. It is a
snapshot — regenerate it after the spec changes, never edit it.

**Release notes (`/spec-changelog`).** `spec_changelog {since?, write?}` (CLI `dev-spec changelog [--since <ISO
date|last|all>] [--write]`) builds release notes from the spec data alone — no model, no git log:

- **Added** — features shipped since `since` (a finish baseline recorded, or the `execution` sign-off approved), each
  with its summary and its user-story criteria (template ones left out); a feature shipped before `since` is never
  Added again;
- **Changed** — criteria superseded (`_Supersedes:_`) by a feature shipped since then, and the change requests
  (`spec_impact` reopen) recorded since then, with the current text of the criteria a requirements change touched;
- **Fixed** — bugfixes shipped since then, with the root-cause one-liner from `bug.md` (spikes are never listed).

`since` defaults to `last` — `roadmap.json → meta.changelogAt`, stamped by the last written notes (everything while it
is unset). `write: true` writes `.specs/RELEASE-NOTES.md` (AUTO-GENERATED; a hand-written one is never overwritten) and
stamps `meta.changelogAt`; with nothing to report, nothing is written or stamped. `milestone` (1.16, CLI `--milestone
<name>`) scopes the notes to a milestone's features (its features and the ones archived since — see §15): `since` then
defaults to `all`, and `write` goes to `.specs/RELEASE-NOTES.<milestone-slug>.md` (the slug plus a short hash when the
slug loses part of the name — `Sprint α` → `sprint-<8 hex>`) without touching `meta.changelogAt`.

**Gherkin (1.16 — `format: "gherkin"`, CLI `export [feature] --gherkin`).** One `.feature` per feature for a BDD
runner (Cucumber, behave, SpecFlow…): the feature's title and summary, its active tracks as tags (`@SaaS` `@AI` `@SEC`
`@PRIVACY` `@tdd` …), and one `Scenario` per current acceptance criterion tagged `@US-n.AC-m`, the T-IDs the test plan
plans for it (`@T-01`) and the marker of the track that defines it. The steps are the criterion's own EARS clauses —
`WHILE` / `WHERE` / `IF` → `Given`, `WHEN` → `When`, the `SHALL` response → `Then`, verbatim (`THEN` only marks the
response); a ubiquitous criterion is a `Then` (with a `Given` for a lead set off by a comma). A criterion whose
clauses can't be split cleanly (a response with no subject before its `SHALL` included — "WHEN a payment fails, the
cart, including discounts, SHALL be kept") becomes ONE `Then` step with its whole text (listed in `unsplit`) — nothing
is invented and no character is lost; quoted and code spans never split a clause. Only PAIRED markdown emphasis
(`**WHEN**`, `*WHEN*`, `_WHEN_`) is dropped as markup — `2**n`, `snake_case` and code spans stay as written — and a
character before the first keyword (`(WHEN …`) leads its step. A summary line that starts like any Gherkin keyword of
the dialect (or English) gets the summary label in front. A template criterion and one a shipped feature
superseded are left out with a comment; one a draft plans to supersede is kept with a comment. PT / ES (and pt-BR)
features are written in Gherkin's own dialect (`# language: pt` — Funcionalidade / Cenário / Dado / Quando / Então;
`# language: es` — Característica / Escenario / Dado / Cuando / Entonces). `write` → `.specs/exports/<feature>.feature`;
without a name, one file per active feature (spikes have no criteria and are skipped), all-or-nothing.

**Tracker CSV (1.16 — `format: "jira"` / `"linear"`, CLI `export [feature] --tracker jira|linear`).** A CSV for the
tracker's own importer — nothing is sent anywhere. One record per feature (the parent), per user story (a child of the
feature; its intro and its criteria as the description) and per task (a child of its story through its `[USn]` tag,
else of the feature), parents first. Jira: `Work item ID` · `Work type` (Epic / Story / Sub-task / Task) · `Summary` ·
`Description` · `Status` (To Do / In Progress / Done) · `Parent` (the parent's Work item ID) · `Labels` (repeated, one
label per column). Linear: `ID` · `Title` · `Description` · `Status` (Todo / In Progress / Done) · `Estimate` (a task's
`_Size:_` points) · `Labels` (comma-separated) · `Parent issue` (local keys; a task number used twice gets an occurrence
suffix — `checkout/#3 (2)` — so every record has its own ID). Labels: the feature slug, its tracks, its
kind (bugfix / spike) and the AC IDs. The matrix CSV's rules apply (RFC 4180, the formula guard, a UTF-8 BOM); the
AUTO-GENERATED marker is the LAST header cell — an empty column to leave unmapped in the import wizard, never a record
that would become a work item. `write` → `.specs/exports/<feature>.<tracker>.csv` (the project: `project.<tracker>.csv`).

## 14. Steering amendments

The constitution and the track standards evolve too — and a spec approved under the old rule is not automatically
approved under the new one. Every requirements / design approval (1.16) records `steering` {file: fingerprint} on
`approvals[<phase>]` and its `approvalHistory` record: the steering that governed it — `constitution.md`, the active
tracks' steering files (a track pack's too), every file whose front matter says `inclusion: always`, and each
`fileMatch` file whose pattern matches the feature's `_Implements:_` paths. Only those few files are hashed (CRLF and a
BOM are encoding, not content).

- **Noticing it.** A recorded file that changed or was removed since → `spec_doctor` warns
  `steering-changed-since-approval` (which files — `modified` / `removed` — and which approvals; `steeringChanged` in the
  result), and `spec_next_action` adds a re-review hint to whatever its step is — never a step or a block of its own.
- **The project view.** `spec_impact {phase: "steering"}` without a name (CLI `dev-spec impact --phase steering`) lists
  every active feature approved under an older version of a steering file that changed since (`features` [{feature,
  approvals: [{phase, approvedAt, files}]}], `files`, `changed`); with a name, that feature only. It is read-only —
  `reopen` is refused: nothing to untick, the decision is a human re-review.
- **Resolving it.** Re-review the approved requirements / design against the amended rule with the user; if they still
  hold, re-approve them (the new approval records the current steering and the warning clears); if not, edit them —
  the usual change request (`spec_impact --phase requirements|design`, reopen, re-approve).
- **Older approvals.** An approval made before 1.16 recorded no steering: it is never flagged (`spec_impact` lists it
  under `untracked`). Re-approving starts the tracking.

## 15. Milestones

`/spec-milestone` — `spec_milestone {action, name?, date?, features?}` (CLI `dev-spec milestone [add <name>
<YYYY-MM-DD> <features…> | rm <name> | list]`) keeps named target dates for sets of features in `roadmap.json →
meta.milestones` (under the roadmap lock). `add` needs a name (letters of any script, digits, spaces, `. _ : # ( ) + -`,
≤ 60 characters), a real `YYYY-MM-DD` day and existing active features (a list's items are feature names — `User Login`
is one — split on commas only); adding an existing name updates its date and features and keeps the ones archived since.
Names are compared case-insensitively, with the accents of Latin letters and runs of spaces / `_ - . : # ( )` folded;
every other character counts — `Sprint α` and `Sprint β`, `C` and `C++` are two milestones. Each milestone is judged
against the roadmap forecasts (the velocity of ticked tasks → each feature's ETA), with stable codes:

- `done` — every active feature is at 100%;
- `late` — the date has passed and a feature is not done;
- `at-risk` — `eta-after-date` (the latest ETA of its open features is after the date), `eta-unknown` (an open feature
  has no ETA yet — not enough velocity data, no tasks, a dependency) or `no-features` (nothing left in it);
- `on-track` — every open feature's ETA is on or before the date.

`ROADMAP.md` / `.html` show a Milestones table (date, features, done, ETA, status) and list the late and at-risk ones
under "Needs attention"; `spec_roadmap` returns the same `milestones`. A feature's lifecycle follows like its
dependencies: a rename renames it in its milestones, a remove drops it, an archive moves it to the milestone's
`archived` list (its release notes still cover it; its status no longer counts it) and a restore moves it back. A
`meta.milestones` of the wrong shape — or holding an entry `add` would refuse (a bad name, a date that is no real day, a
second entry with the same name) — is refused by `add` / `rm` (fix it by hand) and read as its valid entries otherwise;
a `roadmap.json` that doesn't parse is an error, never "no milestones". Treat an ETA as an estimate, never a promise.
