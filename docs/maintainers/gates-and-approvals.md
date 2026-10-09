# Gates, approvals and change history

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
What an approval checks, the order next_action walks, what changes after an approval, roles, undo / revoke / waivers,
flows, feature sizes and the change kind, the bugfix kind. The rules come first; how they came to be — the releases and
review findings — is in History at the end.

## Gates — an approval is a gate, not a stamp
- **The check registry — a check is defined ONCE** (engine/doctor.js `DOCTOR_CHECKS`, in the doctor's order). An entry:
  `id` (stable; several in `emits`; `family` matches a pack's `<name>-sections`) · `phase` (next_action ranks a failure by it
  — `CHECK_PHASE` is derived; none = the current phase) · `applies(c)` / `run(c)` → `{status, detail}` or
  `[{id, status, detail}]` (no `run`: approval-only, `eval-sets`) · `gate` — probes by name (the phase's, else `all`), each
  `(c) → [[ok, detail, id?], …]`, an id's first failing condition counts · `last` (runs after the others, kept at its place:
  `cross-feature-acs`, which the lean doctor skips once the verdict is warn / fail) · `warnsOnly` (doctor warns where the
  approval refuses: success-criteria, priorities, reproduction, constitution-check = `STATUS_DOCTOR_WARNS` — a forced
  approval failing only these is no `fix` step). **A new check = one entry** (+ its probe and its place in `GATES` when an
  approval requires it). mcp/tests/06-gates-registry.js: every id doctor emits and `approvalChecks` refuses on is
  registered, once (`phase-order` is approvePhase's own).
- **One context per call.** `specDoctor` (`doctorRun`) runs the entries over ONE `checkContext` (feature, tracks, kind,
  language, `.state.json`; each artifact read once, `c.read`; `CHECK_VIEWS` computed on first use). `nextAction` runs the
  lean doctor and reads its context (phase, size, flow, gate walk, approvals in force, active tasks, verification, project
  checks…) — never recomputes them; `approvalChecks` builds its own. **A `live` view** (the active tasks and their blocks,
  `vs`, `suite`) depends on the missing packs' markers noted so far in the call (`ghostMarkers` — traceCheck's
  `_Supersedes:_`, featureOverlaps or crossFeatureAcs may note another feature's): kept only while those are unchanged —
  why an approval never reuses the doctor's context.
- **`GATES` — what each approval runs, in order** (`approvalChecks`). First its artifact: missing, its track off, or
  unreadable (`c.exists` = present AND readable — a folder of that name, EACCES, EBUSY → `unreadable`) = nothing to approve,
  an error even with force (`gates.approveNothing` / `gates.approveUnreadable`). Then the probes (`id` or `id:probe`); a
  phase not listed requires nothing:

  | phase | probes, in order |
  |---|---|
  | classification | placeholders |
  | requirements | ears, placeholders, clarifications, success-criteria, priorities, ac-uniqueness (+ reproduction: a bugfix) |
  | design | placeholders, constitution-check (a bugfix signs off bug.md: root-cause, reproduction, placeholders), then `<track>-sections`, clarifications |
  | test-plan · eval-plan | placeholders, traceability · placeholders |
  | tests | `tests-in-code` (+tdd with test-plan.md: every planned T-ID named by a test file), `eval-sets` (+ai with eval-plan.md: evals/golden.json the feature's own, neither empty nor the sample) |
  | tasks | placeholders, `placeholders:realTasks` (a real task beyond the scaffold's), traceability, task-deps; a change's plan (change.md): ears, placeholders, clarifications, ac-uniqueness, realTasks, change-scope, traceability, task-deps |
  | execution | spec_finish's blockers (`finishFeature(…, {gateOnly: true})`) |
- **Approve gate.** `approvePhase()` refuses (`refused`, `failing`, `checks`) while a check fails; `force:true` (`--force`)
  records it `forced: true` + the failing ids (doctor's `approval-gates` and the roadmap flag it; a clean re-approval
  replaces it). Before the gate: an invalid `.state.json` or unreadable `roadmap.json` refuses; a spike approves only
  `execution`, a change only `tasks` / `execution` (`sizes.noGate`).
- **Phase order.** An EARLIER phase in `pendingGateList()` (phases with an artifact — a missing file never blocks forever),
  or an earlier approved phase whose content changed (`changedApprovedPhases()`: by content — never `byDate` or whitespace;
  a deleted approved artifact counts), adds the failing check `phase-order` (`gates.phaseOrder` / `phaseOrderChanged`) —
  refused unless forced; not for `execution`. `approveThrough` stops there (`stopReason: "refused"`); `fastForwardPlan`
  offers none while a changed approved phase lies at or before its end.
- **Governance read fail closed.** A `roadmap.json` that can't be read (`roadmapError()`: not JSON — a merge's conflict
  markers — or the wrong shape) is never "no roles, no checks": `governanceError()` → `{ok: false, roadmapInvalid: true,
  code: "roadmap-invalid"}` + `gates.roadmapUnreadable` from `approvePhase` (a dry run too), `approveThrough`,
  `revokeApproval`; spec_finish blocks on `roadmap`; both doctors fail `roadmap` (`roadmapGovernanceCheck()`); next_action's
  one step is `fix` + `roadmapInvalid`; `backlog` (list) refuses like milestone / depend. Ticking stays possible
  (evidenceMode reads its ONE flag fail-closed from the raw text; a nested map can't be read that way).
- **Placeholders — a lookup, never a guess from the shape.** `placeholderReport()` flags a bracket only when its normalized
  text (`placeholderKey()`: case, spacing, `…`/`...`) is one a scaffold writes — `templateSets()`, rendered from
  `templateCorpus()` by `npm run build` into `engine/corpus.generated.json` (at runtime when its stamp is stale —
  architecture.md → The build): every i18n builder, track combination and kind, `acPlaceholder` / `taskAcPlaceholder`, the
  steering / custom stubs, `[fill me in]` — plus `LEGACY_TEMPLATE_PLACEHOLDERS` (an older release's template texts its specs
  still hold), `isGenericSlot()` (TODO upper-case only — "todo" is a PT/ES word —, TBD, TBC, FIXME, `...`, `…`, a/por
  definir), the project's templates' slots (templates-imports-exports.md → Project templates) and `> **TODO**`. Any other
  bracket is content (`[free: 60, pro: 600]`). **Add or reword a template bracket → `npm run build`**; a NEW builder or
  artifact-writing message joins `templateCorpus()` (the test "every fresh scaffold artifact reads 'placeholder'" catches a
  miss). `artifactState()` = missing / placeholder / filled.
- **Brackets by place.** `[]` / `[ ]` (corpus key `""`) and `[...]` / `[…]` are slots only as a field's WHOLE value
  (`bracketPlaceholders()` → `wholeValueAt()`: after a list marker / checkbox / quote or a label's colon, a table cell, a
  " · " item) — never glued (`[]string`) or inside a sentence. `scanBrackets()` walks outermost first and descends into a
  non-placeholder group (a half-edited sentence still reports its `[N]`); it skips syntax (links, footnotes, callouts, wiki
  links, `x[0]`, checkboxes), stable tags / IDs, `[NEEDS CLARIFICATION]`, the legacy `[none beyond core]`, comments and
  fences; code spans are opaque except a template's code-span slot (`templateSets().code`).
- **Linear, always.** `RE_STABLE_BRACKET`'s list separator is `\s*(?:[,;/]\s*)?` (`\s*[,;/]?\s*` backtracks 2^k).
  `scanBrackets()` finds every closer in ONE stack pass (`bracketCloser()`) and walks an explicit stack — no recursion per
  nesting level; a group longer than `SLOT_MAX` (1,000) is keyed nowhere (only `isGenericSlot`'s `[TODO: …]` prefix is
  read); `hasProseOutsideBrackets()` is one pass (an open-`[` stack emptied per line + a difference array).
- **bug.md is evidence** (`bugPlaceholders()` — `artifactReport`, `bugSectionFilled()`): it quotes `[object Object]`,
  `[Error: …]`; a template text counts only as one of the report's slots (`bugTemplateSlots()`) or in a section with no prose
  outside brackets (`hasProseOutsideBrackets()`, which `bugSectionFilled()` also requires). That prose is
  `writtenContent()`'s — "TBD", "Pending." or "…" is not written; `sectionFilled()` (the Constitution Check gate) agrees.
- **`detectPhase()`**: `complete` / `executing` once tasks are ticked, `tasks-ready` once a real task exists, else the
  earliest still-template chain artifact (a fresh scaffold: `requirements`). Doctor's `placeholders` fails for the current
  and earlier phases, warns for later ones (`ears_validate`: code `placeholder`; the requirements.md hook never says "all
  clean" while one remains). `traceability` splits alike: gaps that read a LATER phase's template (`TRACE_TASK_KINDS` /
  `TRACE_PLAN_KINDS`) warn "not traced yet"; only `TRACE_VERDICT_KINDS` fail (testsNotMappedToTasks listed, never failing).
- **`next_action` — the step order, phase by phase** (doctor shows the same gate as `nextGate`):
  1. an invalid `.state.json` (readState's `invalid`) is the ONE step, `fix` + `stateInvalid` (read as empty it would say
     "approve", which every mutator refuses: a loop); doctor fails `state`, spec_finish blocks on `state` first and reports
     nothing from the unknown approvals, statusNext answers `{step: fix, file: .state.json}`;
  2. an unreadable `roadmap.json`: `fix` + `roadmapInvalid` (statusNext `file: roadmap.json`);
  3. `re-review` an artifact changed since ITS approval and re-approvable now (a later phase's waits for the first pending
     gate); `impact` when a snapshot exists; `refusedGate` {phase, failing} when its gate would refuse. A DELETED approved
     artifact → `missingApproved`, restore it or revoke the approval (`next.approvedMissing`) — never "re-approve";
  4. the FIRST phase of `gateWalk()` not approved in force (`approvalsInForce()`; the flow's order, `execution` apart;
     `tests` once `testsGateDue()`; classification when its file exists): `fill` (a `gateArtifacts()` file missing / a
     template) → `fix` (`approvalChecks()` fail, `refusedGate` — never an approval that would be refused) → `approve`;
  5. `fix` — all approved, but doctor fails for the current or an earlier phase (`checkPhaseIndex`): a forced approval;
  6. `implement` → `verify` (all ticked, one unverified — `verificationStatus()`) → `finish` (`tasks` when there are none).
- **After a finish** (`state.finished`): `finished` — asking for the `execution` sign-off (with roles: `missingRoles`,
  `--role <next>`; project checks without a passing run → `verify`, `suite`, `finish --run`) — or `drift`
  (`baselineDrift()`: {finishedAt, files, changed, missing, nowPresent, drifted}; a re-finish's `recordFinishBaseline()`
  returns `replaced`). The baseline is STALE (`staleFinish()`) once a change request or another phase's re-approval is newer
  than `finished.at`, or an active task's `_Implements:_` file isn't in it — **never a same-content re-approval**:
  `changesSince()` skips an approval whose `fingerprint` (+ `designFingerprint`) equals its phase's record in force then
  (`approvalInForceAt()`; `tests`, fingerprint-less, always counts) and a revocation of a phase back as it was. Stale → the
  step stays `finish` with `staleBaseline` {finishedAt, since, newFiles}, an older execution sign-off is asked again
  (`executionSignOffStale()`); with drift too → `drift` + `staleBaseline` (`nx.driftedStale`).
- **finish blockers** (stable ids, in order — the `execution` approval refuses on exactly these): `state`, `roadmap` (never
  inside `doctor`), `doctor`, `root-cause`, `placeholders` (anywhere in the chain), `changed-since-approval` (by content),
  `tasks` (none), `open-tasks`, `verification`, `suite-evidence` (`meta.checks`), `approval-gates` (a phase missing a role's
  sign-off is pending); a spike: `spike`, `decision`, `open-tasks`. `warnings` never block (EC/NFR/SC,
  planned-not-in-code, legacy approvals missing a role, `outside-code-artifacts`, a file-date-only change, an expired
  waiver). spec_metrics' `finished` = the earlier of the first execution approval and `state.finished.at`.
- **Bugfix execution gate (`bugfixGate()`).** While bug.md → Root Cause is unfilled, no task after the one that writes it
  (`rootCauseTaskIndex()`: names bug.md + a Root Cause synonym, no `_Makes green:_` / `_Verify:_`) can be ticked or given
  evidence — without one (the short form), none after task 1 (`bugGateFirst`); `done --run` refuses before running. A
  `_Makes green:_` task (the fix) is refused wherever it sits (`bugGate` / `bugGateTicked` name the root-cause task;
  `bugGateFix` when the fix is task 1). The root-cause task itself ticks with `rootCausePending: true` + a note; later
  refusals are then `bugGateTicked` ("the section is still empty").

## Approval fingerprints and pending gates
- **Content fingerprints.** An approval records its artifact's `textFingerprint` (tasks.md with checkboxes normalized):
  next_action compares each artifact with ITS OWN approval — a tick is progress, not an edit. CRLF and a leading BOM are
  encoding (`fingerprintText`: a "UTF-8 with BOM" re-save is no change); compare via `fingerprintMatches`, never `!==` (it
  accepts a fingerprint recorded over a BOM-prefixed file).
- **A whitespace-only edit is no change.** Next to `fingerprint` (its rule unchanged — recorded approvals stay valid) every
  approval, history record and role sign-off records `wsFingerprint` = sha1(`wsText`) (`designWsFingerprint`: a bugfix's
  design.md); `wsText()` drops each line's trailing whitespace and the final blank lines — linear, no regex over a run of
  spaces. The merge driver's rules carry the field.
- **ONE test: `approvedContentSame(dir, phase, appr, raw, design?)`** (gates.js): the fingerprint, else `wsFingerprint`,
  else `wsOnlyEdit()` (equal under `wsText()` to the approval's OWN `.history` snapshot — same `at` — while that still holds
  the approved content); neither recorded → the fingerprint decides. Every reader of a change since approval asks it:
  `changedSinceApproval`, spec_impact (its design.md too), the edit guard's `guardCheck`, the traceability matrix. Records
  compare by `sameApprovedContent` (finish.js — `planStampHolds`, `changesSince`, metrics' rework); role sign-offs by
  `sameContent()` (`phaseContent()` gives both fingerprints). **Never compare a fingerprint by hand.**
- **A deleted approved artifact is a change** (doctor, finish, roadmap, next_action's `missingApproved`), bug.md included —
  not a bugfix's design.md (only track sections — spec_impact's rule). Restore it, or `approve <f> <phase> --revoke`.
- **Pending gates** (`specDoctor` → `pendingGates`; next_action / finish / gatesOk read it) walk the flow's order: a phase is
  due once `phaseFile(ph, kind)` exists (a bugfix's `design` → `bug.md`); Phase 4 `tests` via `testsGateDue()` — +tdd's
  test-plan.md or +ai's eval-plan.md exists or was APPROVED (a deleted approved plan keeps it due; `approve tests` then
  answers nothing-to-approve, the tasks are refused on phase-order); never a bugfix. `phaseActive('tests')` = tdd||ai.
- **A `tests` approval covers the plan it was given:** `testsPlan` {tests: the T-IDs planned then, plans: {test-plan /
  eval-plan: that plan's approval fingerprint or null}} (`testsPlanStamp()`; the merge driver carries it).
  `testsSignOffStale()` → {at, missing, plans} once a T-ID planned NOW is missing (`tKey`: T-1 = T-01) or an active plan's
  approval holds other content (`planStampHolds`). A stale `tests` approval is no approval: **`approvalsInForce()`** (minus
  it) is what `pendingGateList`, next_action, `fastForwardPlan`, `approveThrough`, `statusNext`, doctor's role view and
  `recordRoleSignOff` read; doctor shows `gates.testsStale` (only while `tests` IS pending), finish blocks, the tasks can't
  be re-approved past it. No stamp → **never** flagged (the demo's api-keys keeps its legacy one).
- **Phase 4's wording:** `/spec <feature> tests` + what the gate checks; on an executing / complete feature
  `next.signOffTests` — a sign-off for the tests that exist, never "failing tests first".

## Change history
- **Approval history.** `approvals[phase]` is the latest; every approval is also appended to `approvalHistory` `{phase, at,
  by, fingerprint, forced?, failing?, snapshot, file?, designSnapshot?, designFingerprint?, testsPlan?, wsFingerprint?,
  designWsFingerprint?, …}` and its artifact saved to `.specs/<f>/.history/<phase>@<n>.md` (checkboxes normalized; never
  overwritten). An IDENTICAL re-approval shares the previous record's snapshot (`reuseSnapshot()`); `<n>` counts distinct
  paths. `.history/` is committed with the spec (**not** self-ignored). Pre-history approvals are seeded as `legacy`
  records on the next approval or revocation. `readState()` refuses a non-list `approvalHistory` / `changes`.
- A bugfix's design approval signs off **bug.md** (`file`), + `designFingerprint` and `<phase>@<n>.design.md` when a
  design.md exists; `spec_impact --phase design` diffs both.
- **`spec_impact`** diffs against the latest snapshot: requirements by stable ID (incl. SC/EC/NFR), design / eval-plan by
  `##` section, test-plan by T-ID row (`plannedTestEntries()`, cell by cell, reaching the tasks that make it green), tasks
  by number (`IMPACT_PHASES` — next_action's hint names the right `--phase`). `reopen` (all but tasks) unticks the affected
  DONE tasks, marks their evidence `stale`, appends the change request to `changes` (idempotent per snapshot); it never
  edits requirements.md / design.md. No snapshot → `fingerprint-only`; no fingerprint → `none`, `changed: null`. A REMOVED
  requirement is never redone: reopen skips the tasks only it reaches (and a design section's IDs requirements.md no longer
  defines); `retire` `[{id, tasks, tests}]` lists what still cites it (a removed T-ID: its `_Makes green:_` tasks,
  `impact.retireTests`). trace_check's `removedAcs` (from
  `changes[].removed`) makes `traceGapLines()` name the change request instead of "(typos?)" — still a gap.
- **A file date is never a finish blocker** (`changedSinceApproval(…, {detail: true})` → `{changed, byDate, untracked}`; a
  clone resets every mtime): a fingerprint-less approval shows a newer file in next_action / doctor / roadmap (`byDate`),
  finish only warns; a legacy bugfix design approval (no fingerprint, no `file`) is `untracked` — a finish warning; a
  design.md that exists now was created after it — a change.
- **spec_metrics** reads `.state.json`, `.history/` and the artifacts (`createdAt` from createFeature, else approximated);
  `write` creates `retro.md` (writeIfAbsent). `rework` skips a same-content re-approval (still in `approvalsTotal`); a fingerprint-less
  phase (tests) always counts.
- **Test-plan scaffold:** `scaffoldTestPlan()` writes the template rows only while requirements.md holds exactly the
  template's AC IDs (`i18n.templateAcIds()`); else one generic row per real AC — none at all: one row whose Covers cell is
  a slot (`acSlot`). spec_import warns (`wNoCriteriaAtAll`), re-plans after writing the requirements, and fits a kept
  tasks.md with `fitTemplateTasks()`. A +saas / +ai track block (import, `trackTaskBlock()`, spec_add_track) keeps an ID
  only when `trackAcIds()` finds it defined AS that track's criterion — never by number.
- **`spec_append_tasks`** (converge) appends only: numbers after every number in use (tasks.md + leftover evidence / tick
  numbers — `nextTaskNumber()`), all-or-nothing validation (phantom ACs, non-relative paths, bad story, multi-line markers,
  inactive-track / Global Constraints headings), a read-back check that existing tasks are unchanged, CRLF / BOM / final
  newline kept; an approved list → `needsReapproval`. Per task: `requirements` / `implements` / `verify` / `story` /
  `parallel`, `makesGreen` (`T-1`, `t-01`, `T01`; planned in test-plan.md per `planIdText()`, else `phantomTests` /
  `noTestPlan`; stored as the plan spells it), `expectFail`, `size` (XS…XL, upper-cased — `badSize`); each marker must read
  back (`unstorable`). CLI `--makes-green` (repeatable, comma lists), `--expect-fail`, `--size`.

## Team governance — approvals by role and fast-forward
- **`meta.approvalRoles`** (roadmap.json) `{<phase>: [roles]}` — lower-cased, `^[\p{L}\p{N}][\p{L}\p{N}_.-]{0,39}$`; `{}` /
  `--roles none` clears it; CLI `requirements=product,design=tech+security`. Unset: a given `role` is only recorded.
- **Sign-offs:** a listed phase needs `role` (`roleRequired` / `roleNotListed`). Each runs the gate (force → forced), joins
  `approvalHistory` with its `role` and waits in `signoffs[<phase>][<role>]` (`partial: true`, no snapshot); the last one
  writes `approvals[<phase>]` (`roles` {<role>: {by, at, fingerprint…}}) and the snapshot — only then is the phase approved
  for any reader. readState refuses a non-object `signoffs`.
- **Only a CURRENT sign-off counts** (`signOffOutdated()` in `roleSignOffs()` — the waiting sign-offs AND the in-force
  approval's role records; callers pass the FULL state): not one of older content (`phaseContent()`, whitespace aside), nor
  — tests, execution — one older than a change of the feature (`changesSince(state, at, phase)`: a change request, an
  untick, a revocation, another phase re-approved with other content).
- **The same signer** (`by`) for two required roles → recorded with `sameSigner {by, roles}` + `governance.sameSigner`.
- **Signed but not approved** (sign-offs the merge driver united — it never approves —, or a role dropped after the others
  signed): `signoffsComplete` (`pendingRoles[p]`, `nextGate`, next_action); one role signs again to complete it
  (conventions.md → Merging the spec state).
- spec_impact returns `missingRoles` (`--role <first>` on its re-approve line); a fast-forward stopped by a role error says
  what it approved (`ffWhyRole`).
- **Legacy rule:** a phase approved before its roles were required stays approved (never retroactively pending); doctor /
  finish ask each role to re-sign.
- **Fast-forward** (`through`; `approve --through`; `/approve <feature> --through <phase>`): the active phases in the flow's
  order from the first unapproved one to `through` (never `execution`), each through its gate, flagged `batch: true`
  (`metrics.batchApprovals`). Stops at the first refused gate (`ok: false`, `refused`, `stoppedAt`, `failing`, `checks`;
  earlier ones in `approved`) or a phase waiting for another role (`ok: true`, `complete: false`). `phase` is optional only
  with `through`; next_action suggests it once every planning artifact through tasks is filled and passes. **ROADMAP.md is
  refreshed ONCE**: each approvePhase gets the internal `noRefresh` (never a tool argument / CLI flag), and approveThrough
  refreshes when a phase wrote — a run stopped at a later gate too.

## Undo, revoke, waivers, MCP-only gates
- **Undo a tick** — `completeTask(…, {undo, reason})` → `untickTask` (`spec_complete_task {undo}` / `dev-spec undone <f> <n>
  [--reason]`), under the feature lock: the TICKED task of that number (several → `duplicateTicked` + `tasks`, nothing
  changed: renumber first). `.state.json` first (evidence `stale: true` + `staleBy: "undo"`; `ticks[n]` dropped unless
  another task of that number stays ticked; `unticks` [{n, at, reason?}]), then tasks.md (CRLF / BOM kept). Evidence with
  `undo`, or `reason` without it, is refused (CLI: `--evidence` / `--exit` / `--cmd` / `--run`); an open task →
  `alreadyOpen`. Never gated. `changesSince()` reads `unticks`: an older finish / execution sign-off is stale.
  `reasonInput()`: one line, ≤ 500 characters.
- **Undo and `_Expect: fail_`:** `redProof()` reads through `staleBy: "undo"` (never a plain `stale`) — once the fix is in,
  the red run can't be made again; the passing re-tick is the fix going green (`passAfterRed`, `red`; the undo answers
  `redKept: true`). An edited `_Verify:_` no longer matches (`ownRecord`); `spec_impact --reopen`'s stale needs a new red
  run; observed mode: `observedProof()` reads the kept red run's stamp.
- **Revoke** — `revokeApproval()` (`spec_approve {revoke, reason}` / `approve --revoke`) removes `approvals[p]` and
  `signoffs[p]`, appends `{phase, at, by, revoked: true, reason?, role?, roles?, approvedAt?, wasForced?, partial?,
  roleOnly?}` (no snapshot). With roles it names a listed role (`revoke.roleRequired` / `governance.roleNotListed`); before
  the approval it withdraws only THAT role's sign-off (`revoke.noSignOff`; `partial` + `roleOnly` — the merge driver
  withdraws only it). Never cascades (`laterApproved` stay; a later approval is refused on `phase-order`). Refused with
  force / expires / through, and on a phase neither approved nor waiting (`notApproved`).
- **Read approvalHistory through `isApprovalRecord()`** — never `partial !== true` alone. The approval guard treats a revoke
  as an approval action. `changesSince()` emits each newer revocation (`{kind: "revoke", phase, at}` — never `partial`,
  never `execution`, never a phase since re-approved with its earlier content): an older finish / execution sign-off is
  stale (drift `stale`, `revoke.driftWhy`; `revokedSinceList()` drops a phase re-approved since). The catalog's `finished`
  needs no pending gate
  (`pendingGateList`): SPECS.md reads ☑ complete.
- **Waivers** — `force` + `reason` / `expires` (`waiverInput()`: `YYYY-MM-DD` from today in UTC — `waiver.badExpires` says
  so — up to `WAIVER_MAX_DAYS` (3650), or `Nd`) → `waiver {reason?, expires?}` on the approval, its record and role
  sign-offs; either without force is refused; a passing gate → `waiverIgnored`. Read via `waiverView` /
  `forcedApprovalList`: doctor's `waiver-expired` (both doctors), ROADMAP.md (EXPIRED), `spec_finish` `waivers` + a warning +
  the merge summary's "Waived gates". With roles the approval carries the STRICTEST counted waiver (`strictestWaiver()`: the
  earliest expiry, else the first — the completing sign-off's own included; each role's record keeps its own). Metrics count `revokedApprovals` and `untickedTasks`.
- **MCP-only surfaces** — `spec_stop_check {message, agent?}` = `stopCheck()` (= `dev-spec stop-check --json`);
  `spec_log {name, gitLog, max?}` = `taskCommits()` over git log TEXT the client supplies — the server never runs a
  command (`dev-spec log` runs git itself; `log <f> - --max N` passes the window too). An empty `gitLog` / `message` is a value (`EMPTY_OK` — mcp.md → Argument validation).

## Approvals the user confirmed over MCP, and the dry run
- **`confirmed`** `{via: "elicitation", at, note?}` — set only by mcp/server.js once its user accepted an
  `elicitation/create` question (mcp.md → Human approvals over MCP elicitation), via `opts.confirmation`
  (`confirmationOf()`: other shapes ignored; the note one line, ≤ 500 characters); recorded on the approval, its history
  record, a waiting sign-off, a revocation, each phase of a fast-forward. No reader branches on it: the audit trail of WHO
  approved.
- **The dry run (`opts.dryRun`)** — approvePhase runs everything up to the write → `{ok: true, dryRun: true, feature, phase,
  failing, checks, fingerprint, designFingerprint?, role?, waiver?}` (revoke: `{dryRun, revoke: true, approvedAt,
  withdrawn}`; through: `{dryRun, chain, fingerprints: {<phase>: {fingerprint, designFingerprint?}}}` from `phaseContent()`
  — the phases it would walk); a refusal comes back unchanged. Server-only — its preview before asking (a refusing gate asks
  nobody); never a tool argument or CLI flag.
- **The preview (`opts.preview`)** — the server hands back what the dry run judged (`{fingerprint, designFingerprint?,
  failing}` / `{chain, fingerprints}`). The artifact is read ONCE: the fingerprint and the snapshot an approval records are
  that version. `previewMismatch()`: other content, or — forced — a newly failing check → `{ok: false, changedSincePreview:
  true, code: "changed-since-preview", newFailing?}` + `gates.changedSincePreview`, nothing written; a fast-forward checks
  the chain and every phase BEFORE approving any (then each phase again, stopReason `changed-since-preview`). A revocation's preview is `{approvedAt, withdrawn}`
  (server.js `elicitApproval`): changed since → `changedSincePreview` + `revoke.changedSincePreview`. `spec_feature` remove
  has its own (`removePreview`, `featureFolderFingerprint()` — mcp.md → Human approvals over MCP elicitation).
- **What the approval guard gates:** claude-code-integration.md → Human approval guard (the approvals, a removal, the init
  guard-downs, turning +tdd / +ai off, `dev-spec merge-state` and git's in-place writes under `.specs/`, any write of
  `.execution/observed.jsonl`). The MCP elicitation path (`approvalPolicy`, `APPROVAL_TOOLS`: spec_approve / spec_feature /
  spec_init / spec_add_track) asks about a `spec_add_track {remove}` of +tdd / +ai too (refused at `deny` when the client
  can't ask); the shell and git forms are the Claude Code hook's alone.

## Flows
- **Flows:** `.state.json → flow: "design-first"` (`spec_create {flow}` / `create --flow`; `spec_feature {action: "flow"}` /
  `feature flow <name> <flow>` — approved phases stay approved) orders the chain classification → design → requirements →
  test-plan / eval-plan → tests → tasks (`DESIGN_FIRST_PHASES`, `phaseOrder()`; `flowIndex()` swaps the requirements /
  design slots). Every reader of the order goes through it: `gateWalk` / `pendingGateList`, `detectPhase`,
  `chainArtifacts`, next_action's failing-check filter, the roadmap percent, spec_upgrade's status. A design-first design
  gate never reads the requirements; doctor defers AC traceability and their own checks while requirements.md is a later
  phase's template. Any kind
  but a plain feature ignores the flow (`flowOfState()`; spec_create says so, spec_feature refuses it).

## Right-sized rigor — sizes, the change kind, the stricter filled rule
A feature's **size** (xs · s · m · l) decides its scaffold and approvals. **No size = the unsized scaffolds byte for byte**
(mcp/tests/06-gates-sizes.js pins every no-size builder output's sha1; changed on purpose once — the bugfix tasks.md), no
size key, never assigned by `spec_upgrade`; the unsized gates too, **except the stricter filled rule** (Track sections,
below), which applies at every size. At EVERY size: EARS, trace, the evidence gate, the bugfix iron law, phase order, the
finish / execution gate, every track criterion scaffolded.
- **Input.** `spec_create {size}` / `create --size` (`sizeInput()`, case-folded; new features only — `sizes.sizeKept`);
  `.state.json → size` only when given (no merge-driver rule); `featureSize(dir)`. `spec_classify` suggests one, never
  applies it: `suggestedSize`, stable `sizeReason` (trivial-change · small-change · several-tracks · public-api ·
  cross-system · single-unit · default — `suggestSize()`, a deterministic EN / PT / ES reading of the request, never the
  track count alone; `sizeNote`). `small-change` (xs, no marker track — `SIZE_SMALL`): one small behaviour change (a
  clearer error message, a default / timeout / limit changed, one empty input handled).
- **xs = the change kind** (`kind: "change"`): ONE file, `change.md` (`i18n.change`: summary · 1–3 EARS criteria · approach
  · 1–3 tasks with `_Verify:_`; project template `change` — `TEMPLATE_ARTIFACTS`), core only. Refused before any write: a
  change with s / m / l, a sized spike, a change with a track (`sizes.changeSize` / `spikeNoSize` / `changeTracks`); an
  existing change named with tracks keeps its set (`tracksIgnored`); `spec_add_track` refuses a change.
- **The alias** (`changeAlias()`, files.js): a change's absent `requirements.md` / `tasks.md` ARE its change.md for
  `readIfExists`, `existsCached`, `readContained`, `writeFileAtomic` — every reader takes it unchanged. Raw
  `fs.existsSync` doesn't alias: use `phaseFile("tasks", "change")`.
- **A change's gates:** `gateWalk` = ["tasks"]; `approvePhase` takes only `tasks` (the plan) and `execution`; the plan gate
  (`GATES.tasks`' change list) adds **`change-scope`** (`changeScope()`: 1–3 criteria, 1–3 tasks, core only — never
  ratcheted silently: "create it as a feature of size s"), which doctor runs instead of design / SC / priorities. next_action:
  fill change.md → approve the plan (`sizes.approvePlan`, `spec_approve {through: "tasks"}`) → implement → finish.
  `phaseContent()` gives the plan ONE fingerprint (never its alias tasks.md as a second); `snapshotPhases` skips the
  bugfix-only design.md branch.
- **The two views:** `changeViews(text)` (tasks.js, over `scanTaskBlocks(text, ownLines)`) → `{criteria, tasks}`, line for
  line (the rest blanked); `criteriaText(dir)` / `tasksIdText(dir)`. Every reader of a change's criteria uses them (trace_check,
  `earsFeature`, doctor, `changeScope`, the plan gate, the matrix, the brief, spec_append_tasks, decisions, spec_impact,
  exports, the pre-commit validator via `spec.changeViews`): a task's text never defines an AC. Markers and placeholders
  read the whole file. spec_impact's default phase is `tasks` (another → `impact.changePhase`): criteria by ID, tasks by
  number, `--reopen` works.
- **Every surface names change.md** (the kind's file): exports / matrix (`stakeholderExport.kind.change`, `planPhase`,
  `rtm.planApprovedLine`), messages (`err.taskNotFound(n, file)`, `todoTasks(slug, n, file)`, `hook.earsIssues(…, file)`,
  `doctor.clarificationsOpenPlan`), `spec_decide --affects` (`decisionTargets`), `clarify()` (`clarifyChange()`: never
  stories, SC, P1, edge cases, NFRs or a track's questions), the hooks, the resources allowlist, the roadmap links.
- **s**: S variants of requirements / tasks / testPlan (one story: AC-1 WHEN + AC-2 IF…THEN — `SIZE_CORE_ACS` /
  `coreTemplateAcs()` —, + every track criterion; one core task), no classification.md, the three weigh sections merged
  into **Decisions, reuse & risks** (`WEIGH_MERGED_SYN`), each track's **core-tier** sections only (`sizeDesignText()`,
  `TRACK_SECTIONS` `tier`), per track only the template tasks that implement a criterion (`sizeTasksText()`). An XS bugfix:
  the plan in one call, the common short-form tasks.md.
- **m / l**: the full chain. At every size `CORE_SUPERSEDED_BY` (API Contracts / Error Handling under +api, Security
  Considerations under +sec, Testing Strategy under +tdd) drops the core section, Complexity Tracking has no example row,
  Reuse & Integration one, Error Handling points at the IF…THEN criteria, and `TRACK_OVERLAPS` / `TRACK_TASK_OVERLAPS`
  (tracks.js) write a section / task two tracks ask for once (with +obs the +saas telemetry line goes); **+api / +dist
  have no overlap entry** (`[API] Pagination, Idempotency & Concurrency` is about callers, the distributed track's Delivery
  & Idempotency about messages and locks). `spec_add_track` on a sized feature appends the size's blocks
  (`a.sectionCounts`). Removing a covering track restores the sections it covered whose verdict now fails — an optional
  extended one at size s stays out (`restoreCoveredSections()`, `tracks.restoredSections`).
- **The plan in one call** — at xs / s next_action's fill step names every planning artifact through `tasks` still a template
  (`sizes.planFastForward`) and returns `fastForward {through, phases, role: null}`; each gate runs. **It ends before
  Phase 4:** with `tests` due and ahead, `planFastForwardEnd()` makes `through` the last planning phase before it
  (test-plan / eval-plan — that gate needs the written tests / eval sets; `sizes.planFastForwardTests`); `approveStepExtras`
  tries `through: tasks` first, else that end (`governance.ffHintTests`).
- **Track sections — the gate** (markdown.js). `sectionState(design, sections, marker, {size, lang})` → missing · unfilled ·
  **template** (every visible line is a scaffolded track design block's — `sectionOwnLines()`: built-in EN / PT / ES,
  pt-BR's, the packs'; exact lines, bullet folded; fenced code is the user's — content lines count, fence lines don't; a pack
  line with `{{name}}` / `{{slug}}` is a LINEAR wildcard, `wildcardMatch`) · filled; sized also **na** (ONE line
  `n/a — <reason>`, ≥ `NA_REASON_WORDS` (4) words, `RE_NA_LEAD`) · **na-short**. `trackSectionReport()` adds **covered**
  (+ `by`; sized only). `sectionVerdict(row, {size, approved})`: filled / na / covered pass; missing fails (not an extended
  one at size s); **template fails a new approval, warns on a design approved already** (`sizes.templateApproved`);
  unfilled / na-short fail. All five readers go through the report: doctor `<track>-sections`, the design approval,
  `designSaveCheck`, `spec_status` (rows carry `status`), the roadmap.

## Bugfix and finish
- **`kind: "bugfix"`**: `createFeature` scaffolds `bug.md` + bug requirements / test plan / tasks (always +tdd); doctor
  swaps the design checks for `reproduction` (warn) and `root-cause` (**fail** until filled — the iron law, `bugfixGate()`
  at execution). **bug.md IS its design:** an open `[NEEDS CLARIFICATION]` there refuses the design gate
  (`doctor.clarificationsOpenBug`), one in its Reproduction the requirements gate; doctor and spec_clarify read it. The
  design gate checks `root-cause`, `reproduction` (`bugSectionFilled(REPRO_SYN)`) and `placeholders` (`bugPlaceholders()`:
  the report's slots, `> **TODO**`; quoted evidence stays content).
- **The tasks.md — the short form, every size:** `bugTasks(name, lang)` (one builder, no size): **1** the red regression test
  (`_Verify: [command that runs T-01]_` + `_Expect: fail_`, guard test T-02) and **2** the fix (`_Makes green: T-01_`, the
  must-pass suite) — reproduce and root cause are gated in bug.md. Root Cause empty (forced) → only task 1
  (`bugGateFirst`). **An existing four-task list stays valid and untouched** (no migration): its root-cause task still
  drives `bugfixGate()` / `rootCausePending`, and `LEGACY_BUG_STEPS` (markdown.js) join `renderBugSteps()` — the corpus's
  `bugSteps` — or detectPhase would call it `tasks-ready` before the requirements. mcp/tests/06-gates.js walks both forms;
  06-gates-sizes.js pins the builder's text.
- **Bugfix prefill** — `spec_create {kind: "bugfix", reproduction, rootCause, condition, behaviour}` (CLI `--reproduction`,
  `--root-cause`, `--condition`, `--behaviour`): `bugCreateInput()` validates BEFORE any write (condition / behaviour one
  line ≤ 500 characters, a leading IF / SE / SI, trailing THEN / ENTÃO / ENTONCES and leading THE SYSTEM SHALL / O SISTEMA
  DEVE / EL SISTEMA DEBE dropped; the others ≤ 20,000 via `safeSpecText`). Another kind → `bugPrefill.bugOnly` (CLI:
  `bugOnlyCli`; a spike's flags elsewhere: `spike.spikeOnlyCli`; a change's CLI lines: `sizes.changeCreatedCli`). It fills
  bug.md → Reproduction / Root Cause / Expected and US-1.AC-1 `IF <condition> THEN THE SYSTEM SHALL <behaviour>`; only in a
  file this call created from the built-in builder (`prefilled`, else `prefillSkipped`); no prefill = byte-identical. The
  gates are untouched. `includeBody: true` (`--include-body`) returns `bodies` (`createdBodies()`).
- **`spec_finish`** writes a merge title + summary (`mergeTitle` / `mergeSummary`, `.execution/merge-summary.md`); it never
  merges, pushes or approves. `commitTitle(prefix, text)`: the line ≤ 72 (`COMMIT_TITLE_MAX`) while the prefix leaves the
  text ≥ 24, else the prefix + 24; `shortTitle()` cuts at the first sentence's last `,` `;` `—` `–` that fits (from a third
  of the budget), else at a word + `…` (the spike's `docs(<slug>): spike <outcome> — …` too); UTF-16 units, never a split
  surrogate pair (`cutAt()`). A green run is no `execution` sign-off: ask for an explicit yes. **No PRs:** local merge only —
  never steer users to open a PR or run CI (a test checks the command / skill / agent text).
- **Global Constraints** heading synonyms: `RE_GLOBAL_CONSTRAINTS` (EN/PT/ES); placeholder bullets are skipped when inlined
  into briefs. **Plugin evals:** testing.md (local only, never CI).

## History
How the rules above came to be, section by section — grep a release (`1.24`) or a finding id (`E4`, `C3`, `r5 review`)
here. "r5 review" is 1.23's fifth review.

### Gates
- **1.12.1 / 1.13** — 1.13 made an approval a gate, not a stamp. Its placeholder test guessed from a bracket's shape and
  refused user content (`[free: 60, pro: 600]`, `[admin, billing-manager, read only]`…), blocking upgraded, finished 1.12
  specs — it became a lookup of the scaffolds' own texts; `LEGACY_TEMPLATE_PLACEHOLDERS` holds the 1.12.1 templates'
  bracket texts, extracted once from `main:mcp/lib/i18n.js` (a 1.12 spec still holds them). 1.13's next_action filled the
  whole chain first and asked for the approvals at the end ("fill design.md" while the requirements were unapproved); it
  now walks phase by phase.
- **1.14** — the project's own templates' slots joined the corpus; `meta.checks` added the `suite-evidence` finish blocker.
- **1.22 review** — an approved artifact that was DELETED read as unchanged; next_action now lists it (`missingApproved`).
  A byte-identical re-approval or a role re-signing marked the finish baseline stale (drift `stale`, the execution sign-off
  stale): `changesSince()` skips same-content approvals. next_action looped on "close the feature with /spec-finish" and a
  re-finish replaced a drifted baseline silently (`recordFinishBaseline()` now returns `replaced`); it said "finished —
  nothing left to do" on an old baseline (`staleBaseline`).
- **1.23 r5 review** — an invalid `.state.json` read as empty listed every gate pending and said "approve", which every
  mutator refuses on that file: a loop — the ONE `fix` step, doctor's `state`, finish's `state` blocker. An artifact present
  but unreadable (a folder of that name, EACCES, EBUSY) threw a TypeError on the null text in approve, doctor, next_action
  and finish — now `unreadable` / `gates.approveUnreadable` (a `nothing()` helper flagged it until the 1.27 registry).
  **Review 5 (P5) — nesting:** `scanBrackets()` rescanned to the closer at each level and recursed once per level — a 24 KB
  line of nested `[a [a …]]` threw RangeError out of ears / doctor / approve / clarify; `hasProseOutsideBrackets()`'s
  repeated innermost-group removal was quadratic. Now one stack pass, an explicit stack of ranges, `SLOT_MAX`, a
  difference array.
- **1.24 review 6** — **E1:** a later phase was approved, one by one and by a fast-forward through it, while next_action said
  "re-review requirements" the whole time — a changed approved phase now counts for `phase-order`. **E4:** an unreadable
  roadmap.json read as "no roles, no checks": one person approved a role-governed phase alone (recorded complete), spec_finish
  and the execution sign-off passed with the project checks never run, next_action recommended a role-less /spec-ff and
  `backlog` printed "Backlog (0)", exit 0 — governance is read fail closed (finish's `roadmap` blocker comes first after
  `state`). **F4:** bug.md's "prose" became `writtenContent()`'s — a Root Cause "TBD" counted as written.
- **1.25.1** — `[]` / `[...]` became slots by their place only: "THE SYSTEM SHALL return HTTP 200 with an empty array []"
  and "… append [...]" were placeholders (EARS warned, doctor failed, the approval was refused). **Review 7:** tasks [the red
  test, the fix, "Document the root cause in bug.md"] let the fix tick first — the position rule alone (`pos <= rc`) allowed
  it; a fix that is task 1 got `bugGateFix`, since "only task 1 can be completed" named the very task refused.
- **1.27** — the check registry: spec_doctor's checks and the approval gates became ONE registry (49 `DOCTOR_CHECKS`
  entries + `GATES`, `approvalChecks` moved into it); next_action reads the doctor's context. The refactor kept every result
  byte-identical (doctor, every gate, next_action, finish, the status line, spec_upgrade). The `live` views exist because a
  cross-feature read can note another feature's missing-pack markers mid-call (the doctor's nextGate runs after
  featureOverlaps).

### Approval fingerprints and pending gates
- **1.12 / 1.13** — approvals before 1.13 have no `.history/` snapshot (the fingerprint alone decides); an upgraded 1.12
  feature (tasks ticked, no tests gate then) is why Phase 4 has the `next.signOffTests` wording.
- **1.22 review** — `changedSinceApproval()` skipped a missing file: deleting an approved test-plan.md and its T-IDs read as
  "nothing changed", the Phase 4 gate vanished and the tasks were approvable at once. A bugfix's `design` gate looked for
  design.md, so it was never asked for (now `phaseFile()`). Once the test plan gained a T-ID and was re-approved, the `tests`
  gate was never asked again (next_action said implement, doctor passed — while the gate failed tests-in-code): the
  `testsPlan` stamp, `testsSignOffStale()`, `approvalsInForce()`; an approval recorded before 1.22 has no stamp and is never
  flagged (the design's weigh / reuse rule). **1.22 review 2:** test-plan.md deleted and its approval revoked left a stale
  sign-off with nothing to approve — the note said "to be approved again" while `approve tests` answered "Nothing to
  approve".
- **1.23 r5 review** — a whitespace-only edit (an editor's "trim trailing whitespace" / "insert final newline", a formatter)
  needed a re-approval, every role re-signing, and blocked spec_finish while spec_impact listed nothing: `wsOnlyEdit()`
  against the approval's own snapshot.
- **1.24 review 6 (E6 / E-I5)** — the whitespace-insensitive fingerprint is RECORDED (`wsFingerprint`): a WAITING role
  sign-off has no snapshot, so an editor's trailing-whitespace trim after product signed made tech's sign-off "not complete"
  (r5's rule held for single approvals only). Records from before 1.24 have none: the fingerprint and the snapshot decide.
- **1.25.1 (review 7)** — ONE predicate, `approvedContentSame`: the edit guard's `guardCheck` compared the fingerprint alone —
  trailing spaces in tasks.md, or a "\r\r\n" file normalized to LF, made it ask "re-approve" while next_action and finish said
  unchanged; a test plan re-approved after a whitespace-only edit made the Phase 4 stamp stale (`planStampHolds` now asks
  `sameApprovedContent`).

### Change history
- **1.10 – 1.12** — approvals up to 1.10 (and 1.12 bugfix design approvals) carry no fingerprint: spec_impact `none`. A
  pre-1.11 approval is judged by its file date (`byDate`, kept in next_action / doctor / roadmap for 1.12 parity; finish
  only warns). A 1.12 bugfix design approval never tracked bug.md (`untracked`); 1.12 fingerprinted an existing design.md,
  so one that exists now was created after it.
- **1.13** — the change history: `approvalHistory`, `.history/<phase>@<n>.md`, spec_impact.
- **1.22 review** — history records carry `designFingerprint` (changesSince compares a re-approval with the record in force
  before it) and `testsPlan`.
- **1.23 r5 review** — 60 same-content re-approvals wrote 60 snapshot files: `reuseSnapshot()`; metrics' `rework` skips
  same-content re-approvals.
- **1.24 review 6** — `wsFingerprint` / `designWsFingerprint` on the records.
- **1.25.1** — a track's template tasks read `nextTaskNumber()` too (tracks.md).
- An ID-less import used to fail traceability on phantom template rows (hence the generic `acSlot` row); the template's
  US-1.AC-5…9 kept by number bound tenant isolation / the load test / the prompt task to an import's AC-5…8 and trace_check
  passed with those criteria implemented by nothing (hence `trackAcIds()`).

### Team governance
- **1.14** — approvals by role (`meta.approvalRoles`) and the fast-forward.
- **1.21 review A1** — sign-offs complete without an approval (branches the merge driver united): `signoffsComplete`.
- **1.22 review** — ROADMAP.md refreshed once per fast-forward: once per phase was 93% of an `approve --through tasks` on 30
  features × 40 tasks (1.2 s → 0.38 s for 6 phases).
- **1.23 r5 review** — a sign-off for a phase with no file (tests, execution) made before a change of the feature still
  counted: a tech sign-off made before an untick completed the approval once product signed — `signOffOutdated()`, callers
  pass the FULL state.
- **1.24 review 6** — a sign-off of the same content but whitespace counts (`wsFingerprint`).

### Undo, revoke, waivers, MCP-only gates
- **1.16 (U)** — undo a tick, revoke, waivers, the MCP-only surfaces.
- **1.22 review** — `changesSince()` no longer emits a revocation when the phase was approved again since with the content in
  force before (nothing changed).
- **1.23 r5 review** — revoke with roles: any role, or none, revoked a role-governed approval, and one role's revocation
  withdrew every waiting sign-off. Waivers: `YYYY-MM-DD` from "today" in UTC — west of UTC in the evening the user's today
  was refused; `waiver.badExpires` now says UTC.
- **1.24 review 6 (E7)** — with roles, the completing sign-off kept its own waiver (one with no expiry) and another role's
  expiring waiver was lost — doctor never warned `waiver-expired`, finish never said expired: `strictestWaiver()`.

### Approvals the user confirmed over MCP, and the dry run
- **1.21 F1b** — `confirmed` and the dry run.
- **1.22 review** — the server waited up to minutes for the user, then approved whatever was on disk: an edit meanwhile was
  recorded as "confirmed via elicitation" — `opts.preview`, `previewMismatch()`.
- **1.23** — `spec_feature` remove's own preview (`removePreview`, `featureFolderFingerprint()`).
- **1.24 review 6** — a revocation's preview (`approvedAt`, `withdrawn`: another approval recorded while the user was asked
  would have been revoked in place of the one the question named); the approval-guard list as it stands (+tdd / +ai
  removal, the merge driver's and git's in-place writes, the observed log).

### Flows
- **1.14** — flows (`design-first`), moved here from templates-imports-exports.md's Import sources and flows.

### Right-sized rigor
- **1.20** — the friction audit measured a typo paying ~70% of a public API's slot cost.
- **1.21 F5** — sizes, the change kind, the stricter filled rule and the plan in one call (P3); Error Handling points at the
  IF…THEN criteria (P5 / P6); the XS bugfix's short form. No size = the 1.20 scaffolds byte for byte (06-gates-sizes.js
  pins the pre-1.21 track combinations' outputs); under the stricter rule a design approved before 1.21 only warns.
- **1.21 review** — **C1** the two views: read whole, change.md made a task's `_Requirements: US-1.AC-7_` a defined
  criterion and trace_check could never fail. **C2** a section answered by a ```json schema / OpenAPI ```yaml / ```mermaid
  diagram read "template" and failed an unsized design that passed in 1.20. **C3** a call through tasks stopped at `tests`
  every time: the plan's call ends before Phase 4. **C4** spec_impact on a change. **C5** exports and the matrix carry the
  real kind. **C6** pack guidance with `{{name}}` / `{{slug}}`, a linear wildcard. **C7** removing a covering track restores
  its sections. **C8** +api / +dist keep both sections (no overlap entry). **C9** an existing change named with tracks keeps
  its core-only set. **C10** `spec_status` rows carry `status` — the CLI status said "unfilled" where doctor said "only the
  template's guidance".
- **1.21 verify** — **V4** `phaseContent()` read tasks.md, change.md's alias, as a second `designFingerprint` no approval of a
  change records: every role sign-off of a change read stale (`signoffsComplete` never fired). **V6** `clarify()` asks what
  the kind / size's doctor asks. **V7** the save hook, doctor, the gherkin source, the tracker and `spec_decide --affects`
  name change.md.
- **1.25.1** — `small-change` joined `sizeReason`: "Return a clearer error message when the orders route gets an empty
  customer id" was m / default.

### Bugfix and finish
- **v1.12** — the bugfix kind.
- **1.21 F3** — the bugfix prefill (no prefill = byte-identical to 1.20) and `commitTitle()`. **1.21 review A5** — a cut
  split a surrogate pair and a lone surrogate landed in merge-summary.md: `cutAt()`.
- **1.21 F5 → 1.23.1** — 1.21 F5 introduced the short bugfix tasks.md for xs; 1.23.1 made it every size's (the XS and the
  default forms became identical; as tasks 1–2, reproduce / root cause made next_action say "Implement task #1: Reproduce
  the bug…" after the tasks approval, for work done and gated) and kept the four-task form valid.
- **1.23 r5 review** — bug.md is the design: a Root Cause "probably X [NEEDS CLARIFICATION: …]" was approved — the gate
  read design.md.
- **1.24 review 6 (E8)** — a bug.md with its slots left was approved while doctor failed `placeholders` on it, and an edit
  since the requirements approval could empty Reproduction: the design gate checks both. **1.24 r6 B9** — the CLI names a
  spike's `--question` / `--timebox` on another kind (`spike.spikeOnlyCli`) and a change's create lines
  (`sizes.changeCreatedCli`).
