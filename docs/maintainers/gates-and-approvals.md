# Gates, approvals and change history

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
What an approval checks, the order next_action walks, what changes after an approval, roles, undo / revoke / waivers,
flows, the bugfix kind.

## Gates (1.13) — an approval is a gate, not a stamp
- **Placeholders — a lookup, never a guess from the shape.** `placeholderReport()` reports a bracket only when
  its normalized text (`placeholderKey()`: case, spacing and `…`/`...` ignored) is one a scaffold actually writes —
  `templateSets()`, rendered from `templateCorpus()` by `npm run build` into `engine/corpus.generated.json` and read once per
  process (rendered at runtime when that file's stamp doesn't match the sources — architecture.md → The build) (every i18n
  builder, EN/PT/ES, every track
  combination and kind, the track/import task slots `acPlaceholder` / `taskAcPlaceholder`, the steering and custom
  stubs, init's `[fill me in]`) **plus** `LEGACY_TEMPLATE_PLACEHOLDERS` (the 1.12.1 templates' bracket texts, a static
  list extracted once from `main:mcp/lib/i18n.js` — a 1.12 spec still holds them) **plus** `isGenericSlot()` (TODO
  upper-case only — "todo" is a PT/ES word —, TBD, TBC, FIXME, `...`, `…`, a/por definir) **plus** the project's own
  templates' slots (1.14 — see Project templates) — and the `> **TODO**`
  sentinel. Everything else in brackets is the user's content: `[free: 60, pro: 600]`, `[admin, billing-manager, read
  only]`, `[10 MB, 25 MB for pro]` (1.13's shape heuristics refused those and blocked upgraded, finished 1.12 specs).
  `scanBrackets()` walks outermost first and descends into a non-placeholder group, so a half-edited template sentence
  still reports the `[N]` left inside it. Syntax is skipped whole (links, reference links, footnotes, callouts, wiki
  links, glued indexing `x[0]`, checkboxes) and so are stable tags/IDs, `[NEEDS CLARIFICATION]` and the legacy
  `[none beyond core]`; code spans are opaque except a template's own code-span slot (`` `[path]` ``, `templateSets().code`);
  comments and fences are skipped. **When you add or reword a template bracket, run `npm run build`** (the corpus renders
  it; the suite fails until the committed file is rebuilt); a NEW builder or artifact-writing message must be added to
  `templateCorpus()` (then rebuild) — the test "every fresh
  scaffold artifact reads 'placeholder'" catches a miss. `artifactState()` = missing / placeholder / filled.
  **bug.md is evidence** (`bugPlaceholders()`, used by `artifactReport` and `bugSectionFilled()`): its Reproduction /
  Root Cause quote `[object Object]`, `[WARN]`, `[A-Z]`, `[Error: …]` — a template text there counts only when it IS one
  of the bug report's own slots (`bugTemplateSlots()`) or its section holds no prose outside brackets
  (`hasProseOutsideBrackets()` — also required by `bugSectionFilled()`: a root cause written as nothing but
  `[the cause, with evidence]` is not written). Every regex here must stay linear: `RE_STABLE_BRACKET`'s list
  separator is `\s*(?:[,;/]\s*)?` — the old `\s*[,;/]?\s*` backtracked 2^k on a failing ID list. **Review 5 (P5) — nesting:**
  `scanBrackets()` learns every `[`'s closer from ONE stack pass (`bracketCloser()`) and walks the groups with an explicit
  stack of ranges (it rescanned to the closer at each level and recursed once per level: a 24 KB line of nested `[a [a …]]`
  threw RangeError out of ears / doctor / approve / clarify); a group longer than `SLOT_MAX` (1,000) is keyed nowhere (no
  slot, reference label or marker is that long — only `isGenericSlot`'s `[TODO: …]` prefix is read); `hasProseOutsideBrackets()`
  is one pass (a stack of open `[` emptied at each line break + a difference array — the repeated innermost-group removal was
  quadratic).
  `detectPhase()`: `complete` / `executing` once tasks are ticked, `tasks-ready` once a real (non-placeholder)
  task exists; otherwise the earliest still-template chain artifact — so a fresh scaffold is phase `requirements`.
  Doctor's `placeholders` check fails for the current and earlier phases, warns for later ones;
  `ears_validate` reports code `placeholder`; the requirements.md hook never says "all clean" while any remain.
  Doctor's `traceability` follows the same split: the gap kinds that read a LATER phase's still-template
  tasks.md / test-plan.md (`TRACE_TASK_KINDS` / `TRACE_PLAN_KINDS`) are deferred — a warn, "not traced yet" — so the
  template's `_Requirements: US-1.AC-3…_` rows are no "typos?" at the requirements / design gate. Only
  `TRACE_VERDICT_KINDS` fail (testsNotMappedToTasks is listed, never failing — trace_check's verdict rule).
- **Approve gate.** `approvePhase()` runs `approvalChecks()` for that phase and refuses (`refused`, `failing`,
  `checks`) while any fails. `force:true` (CLI `--force`) records it anyway with `forced: true` + the failing
  ids — doctor's `approval-gates` and the roadmap keep flagging it; a clean re-approval replaces it. A phase
  with no artifact (eval-plan without +ai, test-plan without +tdd, `tests` on a core-only feature, a missing file) is an
  error even with force — and so is one that exists but can't be read (r5 review: a folder of that name, EACCES, EBUSY —
  `approvalChecks`' `exists` is present AND readable; `nothing()` flags `unreadable` and approve answers
  `gates.approveUnreadable`; it threw a TypeError on the null text in approve, doctor, next_action and finish). `tests` and `execution` have checks too (see Pending gates below). **Phase order:** approving a
  phase while an EARLIER one is in `pendingGateList()` (doctor's pending gates — only phases with an artifact, so a
  missing file never blocks forever) adds the failing check `phase-order` (`gates.phaseOrder`, EN/PT/ES) — refused
  unless force (recorded as forced with it). Not for `execution`: its gate (finish's blockers) already names them.
  **An earlier phase whose approved CONTENT changed since its approval counts too (1.24 review 6, E1):** a later phase was
  approved — one by one and by a fast-forward through it — while next_action said "re-review requirements" the whole time.
  `changedApprovedPhases()` (changedSinceApproval over `approvalsInForce` without its `byDate` part — a file date is no evidence;
  a whitespace-only edit is no change; a deleted approved artifact is one) joins the same check (`gates.phaseOrderChanged`:
  re-review — spec_impact — and re-approve it first). `approveThrough` needs nothing of its own: its first phase after the
  changed one is refused on phase-order (`stopReason: "refused"`); `fastForwardPlan` (next_action's suggestion) returns none
  while a changed approved phase lies at or before its end. Pending gates and the walk are unchanged (the phase is approved —
  next_action's re-review step names it).
- **Governance read fail closed (1.24 review 6, E4).** `roadmap.json` holds `meta.approvalRoles` and `meta.checks`; one that
  exists but can't be read (`roadmapError()` — not JSON, e.g. a text merge's conflict markers, or the wrong shape) read as "no
  roles, no checks": one person approved a role-governed phase alone (recorded complete) and spec_finish / the execution
  sign-off passed with the project checks never run. Reading the roles out of the raw text, evidenceMode's way for ONE flag,
  can't be trusted for a nested map (two conflicting versions, a list cut in half) — the safer, simpler rule refuses:
  `governanceError()` → `{ok: false, roadmapInvalid: true, code: "roadmap-invalid"}` + `gates.roadmapUnreadable` from
  `approvePhase` (any role, a dry run too), `approveThrough` and `revokeApproval`; spec_finish blocks on `roadmap` (its own
  blocker, first after `state` — so the execution gate names it); doctor (both — features and spikes) fails `roadmap`
  (`roadmapGovernanceCheck()`, `gates.roadmapCheck`); next_action's one step is `fix` with `roadmapInvalid: true`
  (`next.roadmapInvalid` — it recommended a role-less /spec-ff); the status line says repair roadmap.json; `backlog` (list)
  refuses like milestone / depend (it printed "Backlog (0)", exit 0). Ticking tasks stays possible (evidenceMode already reads
  its one flag fail-closed from the raw text).
- **next_action step order — phase by phase:** first (r5 review) a `.state.json` readState marks `invalid` (not JSON — a git
  text merge's conflict markers, a truncated write — or the wrong shape) is the ONE step: `fix` with `stateInvalid: true`
  (`next.stateInvalid`: repair or restore it). Read as empty it listed every gate pending and said "approve" — which every
  mutator refuses on that file: a loop. Doctor fails `state` (the localized `state.invalid` as its detail), spec_finish blocks
  on `state` first (and reports no pending gate / change since approval from the unknown approvals), the status line's
  statusNext answers `{step: fix, file: .state.json}`. Next (1.24 review 6, E4) an unreadable `roadmap.json` the same way:
  `fix` + `roadmapInvalid: true` (`next.roadmapInvalid`; statusNext `{step: fix, file: roadmap.json}`) — Governance read fail
  closed above. Then `re-review` (an artifact changed since ITS approval and re-approvable
  now — one of a phase after the first pending gate waits for it, approve would refuse it on `phase-order`; `impact`
  when a snapshot exists; when that phase's gate would refuse it, `refusedGate` {phase, failing} and the check ids are
  named — never an approval that would be refused; an approved artifact that was DELETED (1.22 review) is listed in
  `missingApproved` and the text says restore it or revoke its approval — `next.approvedMissing`, never "re-approve" nor a
  spec_impact hint: `snapshotPhases()` skips a missing file, impact answers `missing` on it) → the FIRST phase of `gateWalk()`
  not approved yet — in force: `approvalsInForce()` (PHASES order, `execution` apart; `tests` only
  when `testsGateDue()`; classification only when classification.md exists): `fill` (one of its `gateArtifacts()` is
  missing / a template; `file`) → `fix` (its `approvalChecks()` fail — `refusedGate`, so it never recommends an
  approval that would be refused) → `approve`; the next phase only after that approval (1.13 filled the whole chain
  first and asked for the approvals at the end — "fill design.md" while the requirements were unapproved) → `fix`
  (every phase approved, but doctor fails for the current or an earlier phase via `CHECK_PHASE` — a forced approval)
  → `implement` →
  `verify` (all ticked, but `verificationStatus()` lists an unverified task — spec_finish and the execution gate refuse
  it; it looped "close the feature" / "finished — nothing left" → refused → the same) → `finish` (or `tasks` when
  there are none). Doctor surfaces the same gate as `nextGate`. Once `state.finished`
  exists (finish `{write}` recorded it), `finish` becomes `finished` (asks for the `execution` sign-off while it is
  missing — with execution roles configured it names the missing ones, `missingRoles`, `--role <next>`; project checks
  without a passing run turn it into `verify` with `suite` [{name, status}] and `finish --run`) or `drift` (`baselineDrift()` of the recorded files; `drift` {finishedAt, files, changed, missing,
  nowPresent, drifted}) — it looped on "close the feature with /spec-finish" and a re-finish replaced a drifted
  baseline silently; `recordFinishBaseline()` now returns `replaced` for the drift it accepts. A baseline is STALE
  (`staleFinish()`) once a change request or a re-approval of another phase is newer than `finished.at`, or an active
  task's `_Implements:_` file isn't in it — **never a re-approval of the same content** (1.22 review: a byte-identical
  re-approval or a role re-signing marked the finish stale, drift `stale`, the execution sign-off stale): `changesSince()`
  skips an approval whose `fingerprint` (+ `designFingerprint`) equals the record of its phase in force at that time
  (`approvalInForceAt()` — the latest approval record at or before it, unless a revocation followed; a phase without a
  fingerprint, `tests`, always counts), and a revocation of that phase in between (back as it was): then the step stays `finish` (re-run spec_finish `{write}`) with
  `staleBaseline` {finishedAt, since, newFiles} — it said "finished — nothing left to do" on the old baseline — and an
  execution sign-off older than such a change is asked for again (`executionSignOffStale()`). The recorded files are
  hashed even then: a stale baseline with drift answers `drift` (+ `staleBaseline`, `nx.driftedStale`) — the decision
  before any re-baseline.
- **finish blockers:** `state` (r5 review — .state.json unreadable), `roadmap` (1.24 review 6 — roadmap.json unreadable: its roles
  and checks unknown; doctor's `roadmap` fail, never inside `doctor`), doctor fails, changed since approval (shared `changedSinceApproval()`), placeholders
  anywhere in the chain, bugfix Root Cause, no tasks, open tasks, unverified tasks, pending gates (a phase still
  missing a role's sign-off is pending), and — with `meta.checks` set (1.14) — `suite-evidence`.
  `warnings` (EC/NFR/SC, planned-not-in-code, legacy approvals missing a role, a T-ID planned outside test code whose
  artifact is still the scaffold — `outside-code-artifacts`) never block.
- **Bugfix execution gate (`bugfixGate()`):** while bug.md → Root Cause is unfilled, no task after the one
  that writes it (names bug.md + a Root Cause synonym, carries no `_Makes green:_`/`_Verify:_`) can be ticked
  or given evidence — without such a task (the scaffold's short form: 1 the red test, 2 the fix), none after task 1
  (`bugGateFirst`); `done --run` refuses before running anything. The root-cause task itself (a four-task tasks.md
  scaffolded before the short form, or one the user wrote) can be ticked
  (`rootCauseTaskIndex()`), but then returns `rootCausePending: true` + a note; once it is ticked the refusal of a
  later task is `bugGateTicked` ("the section is still empty"), never "do task N first".

## Approval fingerprints and pending gates (from Conventions & gotchas)
- **Approvals record a content fingerprint** of the phase's artifact (`artifactFingerprint`; tasks.md
  with checkboxes normalized). `next_action` compares each artifact with ITS OWN approval — ticking a
  task is progress, not a spec edit. CRLF and a leading BOM are encoding, not content (`textFingerprint`): a
  "UTF-8 with BOM" re-save is no change. Compare through `fingerprintMatches` / `artifactMatches`, never `!==` —
  they also accept a fingerprint recorded (before the BOM was ignored) over a BOM-prefixed file.
- **A whitespace-only edit is no change (r5 review).** Trailing spaces / tabs on a line and blank lines at the end (an
  editor's "trim trailing whitespace" / "insert final newline", a formatter) needed a re-approval — every role re-signing —
  and blocked spec_finish while spec_impact listed nothing. The recorded `fingerprint` KEEPS its rule (every approval
  recorded so far stays valid, two records of the same content still compare equal — sign-offs, `changesSince`, the tests
  stamp); when it no longer matches, `wsOnlyEdit()` compares the artifact with the approval's OWN `.history` snapshot (its
  history record: the same `at`; `snapshot` / `designSnapshot`), provided the snapshot still holds the approved content:
  equal under `wsText()` (state.js — fingerprintText, each line's trailing whitespace and the final blank lines dropped;
  linear, no regex over a run of spaces) → not changed (`changedSinceApproval`, and spec_impact's `changed`). No snapshot
  (before 1.13, a `.history/` not committed) → the fingerprint alone decides, as before.
- **A deleted approved artifact is a change since its approval** (1.22 review — `changedSinceApproval()` skipped a missing
  file, so deleting an approved test-plan.md and its T-IDs read as "nothing changed" and the Phase 4 gate vanished; the
  tasks were approvable at once). It is listed like an edit (doctor's changed-since-approval, finish's blocker, the roadmap,
  next_action's re-review with `missingApproved`), a bugfix's bug.md included. The documented exception stays: a bugfix's
  deleted **design.md** (it only ever held a track's sections — spec_impact's rule) is never a change. The way out is to
  restore the file, or to revoke that approval (`approve <f> <phase> --revoke`).
- **Pending gates walk `PHASES` in order** (`specDoctor` → `pendingGates`, which next_action / finish / gatesOk read):
  a phase is due once the file `phaseFile(ph, kind)` names exists — a bugfix's `design` gate is `bug.md` (it used to
  look for design.md, so it was never asked for) — and Phase 4 `tests` (no artifact) via `testsGateDue()`: +tdd with
  test-plan.md or +ai with eval-plan.md — or that plan APPROVED (1.22 review: a deleted approved plan keeps the gate due;
  `approve tests` then answers nothing-to-approve, the tasks are refused on phase-order) —, never a bugfix (its failing
  regression test is a task). `phaseActive('tests')`
  is tdd||ai. **A `tests` approval covers the plan it was given (1.22 review):** it records `testsPlan` {tests: the T-IDs
  test-plan.md planned then, plans: {test-plan / eval-plan (the active ones): the fingerprint of that plan's approval then, or
  null}} (`testsPlanStamp()`, on the approval and its history record — a field of the approval record: the merge driver's
  approvals / approvalHistory rules carry it). `testsSignOffStale()` → {at, missing, plans} once a T-ID planned NOW is missing
  from it (`tKey`: T-1 = T-01) or an active plan's approval in force now has another fingerprint (re-approved with other
  content, approved since, revoked — like `executionSignOffStale()`). A stale `tests` approval is no approval for the gate
  walk: **`approvalsInForce()`** (the approvals minus it) is what `pendingGateList`, next_action (its `pending`, the plan
  fast-forward), `fastForwardPlan`, `approveThrough`'s chain, the status line (`statusNext`), doctor's role view and a role
  sign-off's `recordRoleSignOff` read — so doctor lists `tests` pending again with the reason (`gates.testsStale` — only while
  `tests` IS pending, review 2: test-plan.md deleted and its approval revoked leaves a stale sign-off with nothing to approve, and
  the note said "to be approved again" while `approve tests` answered "Nothing to approve"; also first
  in next_action's Phase 4 text — `next.signOffTests` on an executing feature), finish blocks on it and the tasks can't be
  re-approved past it (phase-order). An approval recorded before 1.22 carries no stamp and is **never** flagged (the
  design's weigh / reuse rule) — the demo's api-keys keeps its legacy one. **Approving `tests` checks what Phase 4 produces** (`approvalChecks`): +tdd `tests-in-code` — every
  planned T-ID named by a test file (trace_check's code scan); +ai `eval-sets` — evals/golden.json is a set of the
  feature's own (not the scaffold's sample, not empty). Nothing to approve on a core-only feature. next_action keeps
  the Phase 4 wording (`/writeTests`) plus what the gate checks — but on an executing / complete feature (tasks ticked,
  e.g. an upgraded 1.12 one) it uses `next.signOffTests` (a sign-off for the tests that exist, never "failing tests
  first, no implementation code"). **Approving `execution`** runs spec_finish's blockers
  (`finishFeature(…, {gateOnly: true})` → stable ids `state`, `roadmap`, `doctor`, `root-cause`, `placeholders`, `changed-since-approval`,
  `tasks`, `open-tasks`, `verification`, `approval-gates`, `suite-evidence` with meta.checks; a spike: `spike`, `decision`);
  otherwise only `force` records it. spec_metrics' `finished`
  = the earliest of the first execution approval and `state.finished.at` (spec_finish {write} on a ready feature).

## Change history (1.13)
- **Approval history.** `approvals[phase]` stays the latest approval (with its content `fingerprint`);
  every approval is ALSO appended to `.state.json → approvalHistory` `{phase, at, by, fingerprint, forced?,
  failing?, snapshot, file?, designSnapshot?, designFingerprint? (1.22 review — changesSince compares a re-approval with the
  record in force before it), testsPlan? (a `tests` approval, 1.22 review)}` and the approved artifact is saved to
  `.specs/<f>/.history/<phase>@<n>.md` (tasks with checkboxes normalized; never overwrites an existing
  snapshot). An IDENTICAL re-approval (the fingerprint + designFingerprint of the phase's previous approval record, whose
  snapshot still holds them — `reuseSnapshot()`, r5 review) shares that snapshot path instead of writing a copy (60
  same-content re-approvals wrote 60 files); `<n>` counts the DISTINCT snapshot paths. spec_metrics' `rework` skips an
  approval of the same content as the phase's previous one (a role re-signing, a revoke then re-approve); it still counts
  in `approvalsTotal`; a phase without a fingerprint (tests) counts as before. `.history/` is **not** self-ignored — it is meant to be committed with the spec. Approvals made
  before the history are seeded as `legacy` records on the next approval.
- A bugfix's design approval signs off **bug.md** (`phaseFile()`, recorded as `file`), plus a
  `designFingerprint` and a `<phase>@<n>.design.md` snapshot when a design.md exists (it holds the
  bugfix's track sections); `spec_impact --phase design` diffs both files.
- **`spec_impact`** diffs the current artifact with the latest snapshot (requirements: by stable ID, incl.
  SC/EC/NFR; design and eval-plan: by `##` section; test-plan: by T-ID row — `plannedTestEntries()`, a row keyed by its first
  cell and compared cell by cell, reaching the tasks that make it green; tasks: by number — `IMPACT_PHASES`, so next_action's
  hint names the right `--phase` for every changed file). `reopen` (all but tasks) unticks the affected DONE tasks, marks their
  evidence `stale`, and appends the change request to `.state.json → changes` (idempotent per snapshot via
  digests). It never edits requirements.md or design.md. An approval without a snapshot → `fingerprint-only`; one
  without even a fingerprint (≤1.10, or a 1.12 bugfix design approval) → `none`, `changed: null` (unknown).
  A REMOVED requirement is never redone: reopen skips the tasks only it reaches (and a design section's IDs that
  requirements.md no longer defines); requirements' `retire` `[{id, tasks, tests}]` lists what still cites it — test-plan's
  too for a REMOVED T-ID (its tasks' `_Makes green:_`, `impact.retireTests` wording).
  `trace_check`'s informational `removedAcs` `[{id, changeRequest}]` (from `changes[].removed`) makes
  `traceGapLines()` name the change request instead of "(typos?)" — the phantom stays a gap.
- **Test-plan scaffold:** `scaffoldTestPlan()` writes the template rows only while requirements.md holds exactly the
  template's AC IDs (`i18n.templateAcIds()`); on written requirements (add_track tdd, create +tdd on an existing
  feature) one generic row per real AC — a template row would plan a test for a criterion the feature lacks; written
  requirements with NO AC get one generic row whose Covers cell is a slot (`acSlot`) — never the template's rows (an
  ID-less import used to fail traceability on phantoms). spec_import warns when it found no criterion (`wNoCriteriaAtAll`).
  `spec_import` re-plans after writing the imported requirements (createFeature scaffolded from the template ones) and
  fits a kept scaffold tasks.md with `fitTemplateTasks()` (known ACs only, `_Makes green:_` = the tests covering them).
  A +saas / +ai track block (there and in `trackTaskBlock()`, spec_add_track) keeps an ID only when `trackAcIds()` finds it
  defined AS that track's criterion (under a `[SaaS]`/`[AI]` heading or carrying the marker) — the template's
  US-1.AC-5…9 are its own track criteria; kept by number, they bound tenant isolation / load test / the prompt task to
  an import's unrelated AC-5…8 and trace_check passed with those criteria implemented by nothing.
- **A file date is never a finish blocker** (`changedSinceApproval(…, {detail: true})` → `{changed, byDate,
  untracked}`): a clone, checkout, copy or unzip resets every mtime. A pre-1.11 approval (no fingerprint) still shows a
  newer phase file in next_action / doctor / roadmap (1.12 parity), but spec_finish only warns about it. A 1.12 bugfix
  design approval (no fingerprint, no `file`) never tracked bug.md: `untracked` — no change anywhere, a finish warning
  to re-approve; a design.md that exists now was created after it (1.12 fingerprinted an existing design.md) — a change.
- `readState()` refuses a non-list `approvalHistory` / `changes` (they are appended to).
- **`spec_metrics`** derives everything from `.state.json`, `.history/` and the artifacts (`createdAt` is
  stored by createFeature; older features get an approximate one). `write` creates `retro.md` (writeIfAbsent).
- **`spec_append_tasks`** (converge) appends only: numbers after every number in use (tasks.md + leftover
  evidence records and tick times — a new task never inherits a removed one's run or completion time), all-or-nothing validation (phantom AC IDs, non-relative paths, bad story, multi-line markers,
  inactive-track / Global Constraints headings), a read-back check that existing tasks didn't change, and
  CRLF / BOM / missing final newline preserved. An approved task list → `needsReapproval`. Per task, besides `requirements`
  / `implements` / `verify` / `story` / `parallel`: `makesGreen` (T-IDs — `T-1`, `t-01`, `T01` accepted —, each planned in
  test-plan.md as `planIdText()` reads it, else `phantomTests` / `noTestPlan` and nothing written; stored as the plan
  spells it, so trace_check matches), `expectFail` (`_Expect: fail_`) and `size` (XS…XL, case-insensitive, stored
  upper-case — `badSize`); every marker must read back as given (`unstorable`), and the result's `appended` carries them.
  CLI `--makes-green` (repeatable, comma lists), `--expect-fail`, `--size`.

## Team governance — approvals by role and fast-forward (1.14)
- **`roadmap.json → meta.approvalRoles`** `{<phase>: [roles]}` — PHASES order, lower-cased, a role matches
  `^[\p{L}\p{N}][\p{L}\p{N}_.-]{0,39}$`; `{}` / `--roles none` clears it. CLI text form `requirements=product,design=tech+security`
  (`+` or a bare word after a comma adds a role to the previous phase). Without it nothing changes (a `role` given is only
  recorded).
- **Sign-offs:** a listed phase needs `role` (`roleRequired` / `roleNotListed` refusals). Each sign-off runs that phase's
  gate like any approval (force records it forced) and is appended to `approvalHistory` with its `role`; until the last
  role signs it waits in `.state.json → signoffs[<phase>][<role>]` (its history record `partial: true`, no snapshot). The
  completing sign-off writes `approvals[<phase>]` (with `roles` `{<role>: {by, at, fingerprint…}}`) and the snapshot
  exactly like a single approval — so every reader of `approvals[<phase>]` (doctor approval-gates / `nextGate.missingRoles`
  / `pendingRoles`, next_action's "missing role", finish, ROADMAP.md attention, the guard hook, metrics) sees the phase
  approved only then. A sign-off of OLDER content no longer counts (`phaseContent()` fingerprints; a phase with no file —
  tests, execution — r5 review: a sign-off made before a change of the feature, `changesSince(state, at, phase)` — a change
  request, an untick, a revocation, a re-approval of another phase with other content — no longer counts, the rule
  `executionSignOffStale()` applies to a single approval: `signOffOutdated()` in `roleSignOffs()`, for the waiting
  sign-offs AND the role records of the approval in force; callers pass the FULL state — a tech sign-off made before an
  untick completed the approval once product signed). The same person (`by`) signing the phase for two required roles is
  recorded with a warning — `sameSigner {by, roles}` + `governance.sameSigner` on the approve result — never refused. readState refuses a non-object `signoffs`. Every required role
  with a CURRENT sign-off and still no approval (sign-offs made on two branches the merge driver united — it never approves —
  or a role dropped from the config after the others signed): `pendingRoles[p].signoffsComplete` / `nextGate.signoffsComplete`
  / next_action's `signoffsComplete` (1.21 review A1) — never missing roles; the recommendation asks one of them to sign
  again, which completes the approval (conventions.md → Merging the spec state).
- `spec_impact` returns `missingRoles` when the changed phase needs roles, and its "→ re-approve" line carries
  `--role <first>`; a fast-forward stopped by a role error says what it approved before (`ffWhyRole`).
- **Legacy rule:** a phase approved WITHOUT the roles now required (approved before roles were configured, or before a
  role was added) stays approved — by an unknown role, never retroactively pending; doctor / finish warn and ask each
  role to re-sign.
- **Fast-forward** (`through`, `approve --through`, /spec-ff): approves the active phases IN ORDER (the flow's order) from
  the first unapproved one up to `through` (never `execution`), each through its own gate — snapshot + history record
  flagged `batch: true` (`metrics.batchApprovals`). It stops at the first refused gate (`ok: false`, `refused`,
  `stoppedAt`, `failing`, `checks`; the phases before it stay approved, listed in `approved`) or at a phase still waiting
  for another role (`ok: true`, `complete: false`). `phase` is optional only with `through`. next_action suggests it
  when every planning artifact through tasks is filled and passes its gate. **ROADMAP.md is refreshed ONCE, after the run**
  (1.22 review — once per phase was 93% of an `approve --through tasks` on 30 features × 40 tasks: 1.2 s → 0.38 s for 6
  phases): each phase's approvePhase
  gets the internal `noRefresh` (never a tool argument nor a CLI flag) and approveThrough refreshes when a phase wrote — a
  run stopped at a later gate too.

## Undo, revoke, waivers, MCP-only gates (1.16 U)
- **Undo a tick** — `completeTask(…, {undo, reason})` → `untickTask` (`spec_complete_task {undo}` / `dev-spec undone <f> <n>
  [--reason]`), under the feature lock: it resolves the TICKED task of that number — several ticked tasks sharing it are
  refused, nothing changed (`duplicateTicked` + `tasks` [{number, line, text}]: which tick was the mistake is unknowable —
  done ticks the first OPEN one; renumber first); `.state.json` is written first
  (the evidence record `stale: true` + `staleBy: "undo"` — a re-tick needs a new run; `ticks[n]` dropped unless another task
  of that number stays ticked; `unticks` `[{n, at, reason?}]` appended), then tasks.md (CRLF / BOM kept). Evidence with
  `undo`, or a `reason` without it, is refused (CLI: `undone` refuses `--evidence` / `--exit` / `--cmd` / `--run` the same
  way); an open task → ok + `alreadyOpen`. Never gated (the bugfix gate refuses
  ticks only). `changesSince()` reads `unticks` (kind `untick`): a finish / execution sign-off older than an untick is
  stale. `reasonInput()`: one line, ≤ 500 characters.
- **Undo and `_Expect: fail_`** — `redProof()` reads through `staleBy: "undo"` (never a plain `stale`): an undo changed
  neither the spec nor the test, and once the fix is in the red run can't be made again (the task was stuck on
  `unexpected-pass`). The record still reads `stale-evidence` until a new run; the passing re-tick is the fix going green
  (`passAfterRed`, the red run carried as `red`). The undo answers `redKept: true` + `undo.redKept` (the red run is kept) in
  place of "a new run is needed". An edited `_Verify:_` no longer matches the record (`ownRecord`): no proof. `spec_impact
  --reopen` keeps its rule (stale without `staleBy`: the spec changed — the updated test must fail again). Observed mode is
  unchanged: `observedProof()` reads the kept red run's own stamp.
- **Revoke** — `revokeApproval()` (`spec_approve {revoke, reason}` / `approve --revoke`): removes `approvals[p]` and
  `signoffs[p]`, appends `{phase, at, by, revoked: true, reason?, role?, roles?, approvedAt?, wasForced?, partial?}` (no
  snapshot; pre-history approvals are seeded as legacy records first). **With roles (r5 review):** on a phase
  `meta.approvalRoles` lists, a revocation names one of its roles (`role` — `revoke.roleRequired` / `governance.roleNotListed`;
  any role or none revoked before); before the approval it withdraws only THAT role's waiting sign-off (`revoke.noSignOff`
  when it has none; the record `partial` + `roleOnly: true`, `roles: [role]` — the merge driver withdraws only it), an
  approval revoked by a role still drops every waiting sign-off. It never cascades (`laterApproved` stay approved — the
  revoked phase is pending again, so approving a later one is refused on `phase-order`). Refused with force / expires /
  through, and for a phase that isn't approved (`notApproved`). **Every reader of approvalHistory filters through
  `isApprovalRecord()`** — never `partial !== true` alone (a revoked record is no approval). The approval guard reads a
  revoke as an approval action (`revoke: true`; the human's command is `approve … --revoke`). `changesSince()` also emits
  each revocation newer than t (`{kind: "revoke", phase, at}` — a record that removed an approval, never `partial`, never of
  the `except` phase = `execution`; 1.22 review: not when the phase was approved again since with the content in force before —
  nothing changed), so a finish / execution sign-off older than it is stale (drift verdict `stale`,
  `revoke.driftWhy` in the CLI line; `revokedSinceList()` drops a phase re-approved since — it reads "re-approved"). The
  catalog's `finished` also needs no pending gate (`pendingGateList`, existence checks only): SPECS.md reads ☑ complete.
- **Waivers** — `force` + `reason` / `expires` (`waiverInput()`: `YYYY-MM-DD` from today (UTC — `waiver.badExpires` says so,
  r5 review: west of UTC in the evening the user's "today" was refused) up to 3650 days, or `Nd`) →
  `waiver {reason?, expires?}` on the approval, its history record and role sign-offs; either without force is refused, a
  gate that passes answers `waiverIgnored`. `waiverView` / `forcedApprovalList` / `strictestWaiver`: doctor warn
  `waiver-expired` (feature and spike doctors), the ROADMAP.md forced-approvals line (EXPIRED flagged), `spec_finish`
  `waivers` `[{phase, failing, reason?, expires?, expired}]` + a warning when expired + the merge summary's "Waived gates".
  Metrics count `revokedApprovals` and `untickedTasks`.
- **MCP-only surfaces** — `spec_stop_check {message, agent?}` = `stopCheck()` (the same decision as `dev-spec stop-check
  --json`); `spec_log {name, gitLog, max?}` = `taskCommits()` over git log TEXT the client supplies — the server still never
  runs git or any command (`dev-spec log` keeps running git itself; `log <f> - --max N` passes the window too). An empty
  `gitLog` (a repository without commits → 0 commits) and an empty `message` (→ `no-claim`) are values, not missing
  arguments: server.js `EMPTY_OK` exempts them from `missingArgs`' blank-string rule (the CLI accepted them already).

## Approvals the user confirmed over MCP, and the dry run (1.21 F1b)
- **`confirmed`** `{via: "elicitation", at, note?}` — set only by mcp/server.js after its user accepted an `elicitation/create`
  question (mcp.md → Human approvals over MCP elicitation), passed as `opts.confirmation` (`confirmationOf()`: anything but that
  shape is ignored; the note one line, ≤ 500 characters): recorded on `approvals[phase]`, its approvalHistory record, a role's
  waiting sign-off and a revocation record; a fast-forward passes it to every phase it approves. No reader branches on it — it is
  the audit trail of WHO approved (the human, in the client), next to `by`.
- **`opts.dryRun`** — approvePhase runs everything up to its write and returns `{ok: true, dryRun: true, feature, phase, failing,
  checks, fingerprint, designFingerprint?, role?, waiver?}` (revoke: `{dryRun, revoke: true}` after its own checks; through:
  `{dryRun, chain, fingerprints: {<phase>: {fingerprint, designFingerprint?}}}` — the phases it would walk, each gate running only
  when approved, and each one's content, `phaseContent()`); a refusal / error comes back exactly as without it. Only the server
  passes it (the preview before it asks the user — a gate that refuses anyway asks nobody); never a tool argument or a CLI flag.
- **`opts.preview`** (1.22 review — the server waits up to minutes for the user, then approved whatever was on disk: an edit
  meanwhile was recorded as "confirmed via elicitation") — the server passes back what the dry run judged: `{fingerprint,
  designFingerprint?, failing}` (an approval) or `{chain, fingerprints}` (a fast-forward). `previewMismatch()`: another content
  (the same read the approval records — fingerprint and snapshot are that version), or — forced — a check failing now that the
  preview didn't name, refuses with `{ok: false, changedSincePreview: true, code: "changed-since-preview", newFailing?}` and the
  localized `gates.changedSincePreview`, nothing written; a fast-forward compares the chain and every phase's content BEFORE it
  approves anything (then each phase again, stopReason `changed-since-preview`). Server-only, like dryRun and confirmation.
  `spec_feature` remove has its own (1.23): `removePreview` returns `fingerprint` (`featureFolderFingerprint()`, finish.js — the
  folder's identity and every entry under it), the server passes it back as `manageFeature(…, {confirm, preview})`, and
  `removeFeatureLocked` refuses another folder under the name or an edited one (`changedSincePreview`, nothing deleted) —
  mcp.md → Human approvals over MCP elicitation.

## Flows (1.14 — from Import sources and flows)
- **Flows:** `.state.json → flow: "design-first"` (`spec_create {flow}` / `create --flow`; changed with
  `spec_feature {action: "flow"}` / `feature flow <name> <flow>` — approved phases stay approved, pending gates follow the
  new order) orders the chain classification → design → requirements → test-plan / eval-plan → tests → tasks
  (`DESIGN_FIRST_PHASES`, `phaseOrder()`, `flowIndex()` swaps the requirements/design slots). Every reader of the order
  goes through it: `gateWalk` / `pendingGateList` (next_action, doctor, approve's phase-order check, the fast-forward),
  `detectPhase`, `chainArtifacts` (the placeholder gate's phase scoping), next_action's failing-check filter, the roadmap
  percent and spec_upgrade's status. The design gate of a design-first feature never reads the requirements; doctor
  defers AC traceability and the requirements' own checks while requirements.md is still a later phase's template. No
  flow / `requirements-first` = the default order. Any kind but a plain feature (bugfix, spike) ignores the flow
  (`flowOfState()`; spec_create says so, spec_feature refuses it).

## Right-sized rigor — sizes, the change kind, the stricter filled rule (1.21 F5)
The 1.20 friction audit measured a typo paying ~70% of a public API's slot cost; a feature's **size** now decides its
scaffold and its approvals. **No size = the 1.20 scaffolds byte for byte** (every builder takes `a.size` undefined —
mcp/tests/06-gates-sizes.js pins the sha1 of every no-size builder output of the pre-1.21 track combinations; changed on
purpose once since: the bugfix tasks.md, the short form at every size — Bugfix and finish), no size key
in the state, and `spec_upgrade` never assigns one; the 1.20 gates too, **except the stricter filled rule** (below — a track
section holding only the template's guidance), which applies at every size and without one: a design approved before 1.21
only warns, its next approval asks. What holds at EVERY size: EARS on every criterion, trace, the evidence gate, the bugfix
iron law, phase order, the finish / execution gate, every track criterion scaffolded.
- **Input.** `spec_create {size: xs | s | m | l}` / `create --size` (`sizeInput()`, state.js — case-folded; the MCP enum; a
  new feature only: an existing one keeps its size, `sizes.sizeKept` note). Stored as `.state.json → size` only when given
  (a plain value — the merge driver needs no rule); `featureSize(dir)` reads it (null for any other value). `res.size` on a
  sized create. `spec_classify` suggests one — `suggestedSize`, `sizeReason` (stable: trivial-change · several-tracks ·
  public-api · cross-system · single-unit · default — `suggestSize()`, classify.js: a deterministic EN / PT / ES reading of
  the request, never the track count alone; the localized `sizeNote`, never in `notes`); nothing applies it by itself.
- **xs = the change kind** (`kind: "change"`; size xs on a plain feature IS a change; kind change with s / m / l, a spike
  with any size, a change with an optional track → refused before any write — `sizes.changeSize` / `spikeNoSize` /
  `changeTracks`). ONE file, `change.md` (`i18n.change` — summary · 1–3 EARS criteria · approach · 1–3 tasks with
  `_Verify:_`; a project template `change` — `TEMPLATE_ARTIFACTS`), core only, `{kind: "change", size: "xs"}` in the state.
  **The alias (files.js `changeAlias()`):** a change folder's `requirements.md` / `tasks.md`, when absent, ARE its
  `change.md` for `readIfExists`, `existsCached`, `readContained` and `writeFileAtomic` (only when change.md exists and the
  folder's .state.json says kind change) — so EARS, trace, the task scanner, `completeTask` (it ticks change.md), the
  evidence gate, finish, the roadmap, the exports and the brief read it unchanged. Raw `fs.existsSync` does NOT alias:
  kind-aware sites use `phaseFile("tasks", "change")` = `change.md`. **Gates:** `gateWalk` = ["tasks"], `pendingGateList`
  = tasks while unapproved, `chainArtifacts` = [change.md, idx 1]; `approvePhase` refuses every phase but `tasks` (the
  plan) and `execution` (`sizes.noGate`); `approvalChecks("tasks")` for a change = EARS (errors, unlinted), placeholders,
  clarifications, ac-uniqueness, a real task, **`change-scope`** (`changeScope()`: 1–3 criteria, 1–3 tasks, core only —
  never ratcheted silently: "create it as a feature of size s"), traceability, task-deps. Doctor: no design / SC /
  priorities checks for a change, `change-scope` instead (CHECK_PHASE 1). next_action: fill change.md (`fillHint`) →
  approve the plan (`sizes.approvePlan`, `spec_approve {through: "tasks"}`) → implement → finish. `changedSinceApproval`
  compares change.md (reported as `change.md`).
  **The two views (1.21 review C1).** Read whole, change.md made a task's `_Requirements: US-1.AC-7_` a DEFINED criterion
  and every criterion "covered" by its own definition — trace_check could never fail. `changeViews(text)` (tasks.js, over the
  ONE task scanner — `scanTaskBlocks(text, ownLines)` marks every line a task block holds) → `{criteria, tasks}`, line for line
  (the other lines blanked: line numbers still point into change.md). `criteriaText(dir)` / `tasksIdText(dir)` read
  requirements.md / tasks.md, or a change's views. Every reader of a change's criteria goes through them: trace_check (required
  ACs from the criteria view, cited ACs / `_Implements:_` from the tasks view), `earsFeature`, doctor's `ears` / `ac-uniqueness`
  / `secondary-trace`, `changeScope`, the plan gate (EARS, `earsNoCriteria(ids, "change.md")`, duplicates), the matrix, the
  brief, spec_append_tasks' phantom check, decisions' `_Affects:_` targets, spec_impact and the exports; the pre-commit
  validator lints `spec.changeViews(text).criteria` (a facade key). Clarification markers and placeholders still read the whole
  file. A task's text never defines an AC; the tasks-phase gate of a change refuses an uncovered or a phantom AC.
  **spec_impact on a change (C4):** the default phase is `tasks` (another phase → `impact.changePhase`); the criteria view is
  diffed by stable ID as requirements (`added` / `modified` / `removed` / `impacted` / `retire` / `affectedTasks`), the tasks by
  number in `tasks` {added, modified, removed}; `--reopen` works (a changed criterion unticks the DONE tasks citing it, their
  evidence stale; the change request is recorded with phase `tasks`, and trace's `removedAcs` reads those for a change).
  next_action's re-review hint names `--phase tasks` (`snapshotPhases`: phaseFile("tasks", "change") = change.md).
  **Exports and the matrix (C5)** carry the real kind (`stakeholderExport.kind.change` / `kicker.change`): a change renders
  its summary, its criteria sections (the view — the task blocks out), ONE Tasks table, no design, the approvals row
  `planPhase` ("Plan (change.md)") with "changed since" / "awaiting approval" through the kind-aware helpers; the project
  export shows its Acceptance criteria section instead of stories; the matrix reads `approvals.tasks` and its snapshot
  (`rtm.planApprovedLine` / `planNotApproved` / `changedSincePlan`, CLI `rtm.cli.planApproved`). **An existing change named
  with tracks (C9)** keeps its core-only set: `tracksIgnored` + `sizes.tracksIgnored` (a spike's create returns
  `tracksIgnored` too). Messages name the kind's file: `err.taskNotFound(n, file)`, `appendTasks.reapprove / appended /
  phantom`, the stop gate's `todoTasks(slug, n, file)`.
  **The verification pass (1.21 verify).** V4: `phaseContent()` gives a change's plan ONE fingerprint (change.md) — it read
  tasks.md, the alias of that very file, as a second `designFingerprint` no approval of a change records, so every role
  sign-off of a change read stale (`signoffsComplete` never fired); `snapshotPhases` skips the bugfix-only design.md branch for
  a change too. V6: `clarify()` (quality.js) asks what the kind / size's doctor asks — a change (`clarifyChange()`): its
  criteria view, [NEEDS CLARIFICATION] anywhere in change.md, vague terms, slots named `change.md:<line>`, Summary / Approach
  written (`clarify.changeSummary` / `changeApproach`), criteria present (`changeCriteria`), `change-scope` (`changeScope`) —
  never stories, SC, P1, edge cases, out of scope, NFRs, IF…THEN or a track's questions; size s: no edge-case / NFR question;
  the glossary reads change.md for a change. V7: the save hook names the file (`hook.earsIssues(…, file)`,
  `gates.hookPlaceholders(…, file)`: "before approving the plan"), doctor / the plan gate's `doctor.clarificationsOpenPlan`,
  the gherkin `# Source:` and the tracker's task line name change.md, and `spec_decide --affects` takes a change.md section
  heading (`decisionTargets`: change.md for a change; refusal `decisions.badAffectsChange`). `spec_add_track` refuses a change (`sizes.changeNoTracks`). Hooks: the
  save hook runs EARS + trace on change.md, the pre-commit validator both (a mirror with change.md + .state.json), the
  observe hook's pre-filter reads change.md too; the resources allowlist and the roadmap links know it.
- **An XS bugfix** (`kind: "bugfix", size: "xs"`): the plan approved in one call (P3). Its tasks.md is every bugfix's —
  the short form (1.21 F5 introduced it for xs; every size has it since — Bugfix and finish): `bugTasks(name, lang)`, one
  builder, no size argument.
- **s**: `requirements` / `tasks` / `testPlan` S variants (one story: AC-1 WHEN + AC-2 IF…THEN — `SIZE_CORE_ACS` /
  `coreTemplateAcs()`, i18n/common.js, the T-IDs follow — + every track criterion; one core task), no `classification.md`
  (one approval less), the design's three weigh sections merged into **Decisions, reuse & risks** (`WEIGH_MERGED_SYN`,
  quality.js — designWeighChecks and the brief's Reuse part read it), only each track's **core-tier** sections
  (`sizeDesignText()`, scaffold.js, over `TRACK_SECTIONS` `tier` — an HTML comment names the extended ones), and per track
  only the template tasks that implement a criterion (`sizeTasksText()`: a task with no `_Makes green:_` whose criteria
  the block's other kept tasks all cite goes — most criteria first, the later on a tie — then renumbered). **m / l**: the
  full chain; at every size `CORE_SUPERSEDED_BY` (i18n/common.js: API Contracts / Error Handling under +api, Security
  Considerations under +sec, Testing Strategy under +tdd) leaves the core section out, Complexity Tracking has no example
  row, Reuse & Integration one example row, Error Handling points at the IF…THEN criteria (P5 / P6), and `TRACK_OVERLAPS` /
  `TRACK_TASK_OVERLAPS` (tracks.js — DATA) write a section / task two active tracks both ask for once (a comment on the
  covering section). `spec_add_track` on a sized feature appends the size's blocks. The checklist's counts follow the size
  (`a.sectionCounts`), and with +obs the +saas telemetry line is dropped. **+api / +dist have no overlap entry (1.21 review
  C8):** `[API] Pagination, Idempotency & Concurrency` asks about the API's callers (cursors, an Idempotency-Key, If-Match /
  412, 202 + a status resource) — `[DIST]` Delivery & Idempotency / Concurrency are about messages and locks; both stay.
  **Removing a covering track (C7):** `removeTracks()` → `restoreCoveredSections()` appends (write-if-missing, like
  add_track) the remaining tracks' sections the removed one covered — heading, `> **TODO**`, guidance from
  `trackDesignBlock` — when their verdict now fails (an optional extended section at size s stays out): `restoredSections`
  + `tracks.restoredSections`.
- **P3 — the plan in one call.** At size xs / s next_action's fill step names every planning artifact through `tasks` still a
  template (`sizes.planFastForward`) and returns `fastForward {through, phases, role: null}` from the start; the
  pending phase's own fix step still comes first, then the rest of the plan is filled, then the fast-forward. Each gate runs.
  **The call ends before Phase 4 (1.21 review C3):** `planFastForwardEnd()` (gates.js) — with the `tests` gate due (+tdd /
  +ai — `testsGateDue`) and still ahead, `through` is the last planning phase before it (test-plan / eval-plan): its gate needs
  the written failing tests / the feature's eval sets, work that comes after the plan (a call through tasks stopped at `tests`
  every time). The fill text is then `sizes.planFastForwardTests` (… through test-plan, then /writeTests, approve tests, then
  tasks); the approve step's fast-forward (`approveStepExtras`) tries `through: tasks` first, else that end
  (`governance.ffHintTests`) — never a fast-forward its gates would refuse.
- **Track sections — the gate (markdown.js).** `sectionState(design, sections, marker, {size, lang})` → missing · unfilled ·
  **template** (every visible line of the section is a line of a track design block as the scaffold writes it —
  `sectionOwnLines()`: the built-in blocks EN / PT / ES, pt-BR's for a pt-BR feature, the project's packs'; exact lines,
  bullet folded; fenced code is the user's own — its content lines count, its fence lines don't, and no built-in block holds a
  fence (1.21 review C2: a section answered by a ```json schema / OpenAPI ```yaml / ```mermaid diagram read "template" and failed
  an unsized design that passed in 1.20); a pack guidance line holding `{{name}}` / `{{slug}}` is a LINEAR wildcard
  (`wildcardMatch`, C6 — the scaffold filled the feature's name in) · filled; a sized feature also **na** (ONE own line
  `n/a — <reason>` with ≥ `NA_REASON_WORDS` (4) words — `RE_NA_LEAD`: n/a, not applicable, não se aplica, no aplica…) ·
  **na-short**, and rows carry `tier`.
  `trackSectionReport(design, tracks, {size, lang})` adds **covered** (+ `by`) for a TRACK_OVERLAPS section left out while
  a covering one is there (sized features only). `sectionVerdict(row, {size, approved})`: filled / na / covered pass;
  missing fails (passes for an extended section at size s); **template fails a new approval — a warn in doctor on a design
  approved already** (`sizes.templateApproved`: never a phase failed retroactively; its next approval asks); unfilled and
  na-short fail. The five readers — doctor `<track>-sections`, the design approval, `designSaveCheck`, `spec_status` (every
  row carries `status` — 1.21 review C10: the CLI status said "unfilled" where doctor said "only the template's guidance"; a
  sized feature's rows add `tier` / `by`), the roadmap's attention — all go through the report. **Backward
  compatibility:** an existing design that deleted the TODO line and kept the guidance bullet still passes a phase approved
  before — doctor warns, finish (doctor fails only) and next_action are unaffected; editing it means a re-approval, which
  applies the stricter rule.

## Bugfix and finish (v1.12)
- **`kind: "bugfix"`** is stored in `.state.json`; `createFeature` scaffolds `bug.md` +
  bug requirements/test plan/tasks (always +tdd), `specDoctor` swaps the design checks for
  `reproduction` (warn) and `root-cause` (**fail** until filled — the iron law, enforced at execution by
  `bugfixGate()`). bug.md IS its design (r5 review): an open `[NEEDS CLARIFICATION]` there refuses the design gate
  (`doctor.clarificationsOpenBug` when only bug.md holds them), one in its Reproduction the requirements gate; doctor's
  `clarifications` check and spec_clarify read bug.md too (a Root Cause "probably X [NEEDS CLARIFICATION: …]" was approved).
  **The design gate checks what doctor checks on bug.md (1.24 review 6, E8):** besides `root-cause`, `reproduction`
  (`bugSectionFilled(REPRO_SYN)` — the requirements gate read it, an edit since emptied it) and `placeholders` (artifactReport's
  `bugPlaceholders()`: the report's own slots — `[correct behavior]`, the Fix line —, `> **TODO**`; quoted evidence such as
  `[object Object]` stays content). A bug.md with its slots left was approved while doctor failed `placeholders` on it.
- **The bugfix tasks.md — the short form, every size.** `bugTasks(name, lang)` (EN / PT / ES — pt-BR derived; ONE builder,
  no size argument: the XS and the default forms became identical) scaffolds two tasks: **1** the red regression test
  (`_Verify: [command that runs T-01]_` + `_Expect: fail_`, guard test T-02 added) and **2** the fix (`_Makes green: T-01_`,
  the must-pass suite). No reproduce / root-cause tasks: the requirements gate already needs bug.md → Reproduction and the
  design gate its Root Cause, both before the tasks can be approved — as tasks 1–2 they made next_action say "Implement
  task #1: Reproduce the bug…" after the tasks approval, for work done and gated. With Root Cause empty (a forced design
  approval, the section emptied since) `bugfixGate()` finds no root-cause task and lets only task 1 through
  (`bugGateFirst`). **Existing features are never touched:** a tasks.md scaffolded with the four tasks (1 reproduce,
  2 root cause, 3 the red test, 4 the fix) stays as it is and valid — nothing rewrites tasks.md (spec_upgrade audits it
  like any other and its apply has no migration for it), its root-cause task still drives `bugfixGate()` /
  `rootCausePending`, and its two steps stay bug steps: `LEGACY_BUG_STEPS` (markdown.js, as `taskDescription()` reads
  them, EN / PT / pt-BR / ES) join `renderBugSteps()` — and so the corpus's `bugSteps` — or detectPhase would read them as
  a real breakdown and put such a fresh bugfix at `tasks-ready` before its requirements. mcp/tests/06-gates.js walks both
  forms (gate by gate; the legacy one's phase, doctor, upgrade audit and apply); 06-gates-sizes.js pins the builder's text.
- **Bugfix prefill (1.21 F3)** — `spec_create {kind: "bugfix", reproduction, rootCause, condition, behaviour}` (CLI
  `--reproduction`, `--root-cause`, `--condition`, `--behaviour`): `bugCreateInput()` (engine/scaffold.js) validates them
  BEFORE anything is written (strings; condition / behaviour one line ≤ 500 characters, whitespace folded, a leading
  IF / SE / SI, a trailing THEN / ENTÃO / ENTONCES and a leading THE SYSTEM SHALL / O SISTEMA DEVE / EL SISTEMA DEBE
  dropped; reproduction / rootCause ≤ 20,000 through `safeSpecText`); on a feature or a spike → `bugPrefill.bugOnly`. The
  EN / PT / ES builders take them (`a.reproduction || <the > **TODO** slot>`, …): bug.md → Reproduction / Root Cause /
  Expected (behaviour), requirements.md → US-1.AC-1 `IF <condition> THEN THE SYSTEM SHALL <behaviour>` (localized). A
  text left out stays the slot; with no prefill the scaffold is byte-identical to 1.20. Only a file this call created from
  the built-in builder gets it: `prefilled` {file: [inputs]}; an existing file or a project template's → `prefillSkipped` +
  a localized note. The gates are untouched: `bugSectionFilled()` still decides whether a (prefilled) Root Cause is
  written — real prose outside brackets, no slot, no `> **TODO**`. `includeBody: true` (any kind; CLI `--include-body`)
  returns `bodies` {file: text} for the feature-folder `.md` files the call created (`createdBodies()`).
- **`spec_finish`** builds a merge title + summary (`mergeTitle`/`mergeSummary`, `.execution/merge-summary.md`)
  from the spec chain; it never merges, pushes or approves. The title is `commitTitle(prefix, text)` (engine/finish.js,
  1.21 F3): the whole line ≤ 72 characters (`COMMIT_TITLE_MAX`) as long as the prefix leaves the text at least 24 — a
  longer prefix (`feat(<slug>): ` with a slug over 40 characters) keeps 24 for the text, so the line is the prefix + up to
  24 (a 60-character slug: up to 92); `shortTitle()` cuts the first sentence at its last `,` `;` `—` `–` that fits (from a
  third of the budget on — no ellipsis there), else at a word with `…`; the spike's `docs(<slug>): spike <outcome> — …`
  title too. Lengths are UTF-16 units (an emoji counts two) and a cut never splits a surrogate pair (`cutAt()`, 1.21
  review A5 — a lone surrogate landed in merge-summary.md). A green run is evidence, not the `execution`
  sign-off: /spec-finish, SKILL.md and the spec_finish / spec_approve descriptions say to ask for an explicit yes
  first. **No PRs:** the owner's cost rule extends to
  pull requests — the plugin integrates by local merge only and must never steer users to open a PR or
  run CI (a test asserts no command/skill/agent text does).
- **Global Constraints** heading synonyms: `RE_GLOBAL_CONSTRAINTS` (EN/PT/ES); placeholder bullets are
  skipped when inlined into briefs.
- **Plugin evals** (`evals/<case>/prompt.md` + `graders/*.md`; behavioural cases add `case.yaml` +
  `fixture.sh`) follow the `claude plugin eval` reference; they cost tokens and run locally only (never CI).
