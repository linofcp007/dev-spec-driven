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
  separator is `\s*(?:[,;/]\s*)?` — the old `\s*[,;/]?\s*` backtracked 2^k on a failing ID list.
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
  error even with force. `tests` and `execution` have checks too (see Pending gates below). **Phase order:** approving a
  phase while an EARLIER one is in `pendingGateList()` (doctor's pending gates — only phases with an artifact, so a
  missing file never blocks forever) adds the failing check `phase-order` (`gates.phaseOrder`, EN/PT/ES) — refused
  unless force (recorded as forced with it). Not for `execution`: its gate (finish's blockers) already names them.
- **next_action step order — phase by phase:** `re-review` (an artifact changed since ITS approval and re-approvable
  now — one of a phase after the first pending gate waits for it, approve would refuse it on `phase-order`; `impact`
  when a snapshot exists; when that phase's gate would refuse it, `refusedGate` {phase, failing} and the check ids are
  named — never an approval that would be refused) → the FIRST phase of `gateWalk()` not approved yet (PHASES order, `execution` apart; `tests` only
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
  task's `_Implements:_` file isn't in it: then the step stays `finish` (re-run spec_finish `{write}`) with
  `staleBaseline` {finishedAt, since, newFiles} — it said "finished — nothing left to do" on the old baseline — and an
  execution sign-off older than such a change is asked for again (`executionSignOffStale()`). The recorded files are
  hashed even then: a stale baseline with drift answers `drift` (+ `staleBaseline`, `nx.driftedStale`) — the decision
  before any re-baseline.
- **finish blockers:** doctor fails, changed since approval (shared `changedSinceApproval()`), placeholders
  anywhere in the chain, bugfix Root Cause, no tasks, open tasks, unverified tasks, pending gates (a phase still
  missing a role's sign-off is pending), and — with `meta.checks` set (1.14) — `suite-evidence`.
  `warnings` (EC/NFR/SC, planned-not-in-code, legacy approvals missing a role, a T-ID planned outside test code whose
  artifact is still the scaffold — `outside-code-artifacts`) never block.
- **Bugfix execution gate (`bugfixGate()`):** while bug.md → Root Cause is unfilled, no task after the one
  that writes it (names bug.md + a Root Cause synonym, carries no `_Makes green:_`/`_Verify:_`) can be ticked
  or given evidence; `done --run` refuses before running anything. The root-cause task itself can be ticked
  (`rootCauseTaskIndex()`), but then returns `rootCausePending: true` + a note; once it is ticked the refusal of a
  later task is `bugGateTicked` ("the section is still empty"), never "do task N first".

## Approval fingerprints and pending gates (from Conventions & gotchas)
- **Approvals record a content fingerprint** of the phase's artifact (`artifactFingerprint`; tasks.md
  with checkboxes normalized). `next_action` compares each artifact with ITS OWN approval — ticking a
  task is progress, not a spec edit. CRLF and a leading BOM are encoding, not content (`textFingerprint`): a
  "UTF-8 with BOM" re-save is no change. Compare through `fingerprintMatches` / `artifactMatches`, never `!==` —
  they also accept a fingerprint recorded (before the BOM was ignored) over a BOM-prefixed file.
- **Pending gates walk `PHASES` in order** (`specDoctor` → `pendingGates`, which next_action / finish / gatesOk read):
  a phase is due once the file `phaseFile(ph, kind)` names exists — a bugfix's `design` gate is `bug.md` (it used to
  look for design.md, so it was never asked for) — and Phase 4 `tests` (no artifact) via `testsGateDue()`: +tdd with
  test-plan.md or +ai with eval-plan.md, never a bugfix (its failing regression test is a task). `phaseActive('tests')`
  is tdd||ai. **Approving `tests` checks what Phase 4 produces** (`approvalChecks`): +tdd `tests-in-code` — every
  planned T-ID named by a test file (trace_check's code scan); +ai `eval-sets` — evals/golden.json is a set of the
  feature's own (not the scaffold's sample, not empty). Nothing to approve on a core-only feature. next_action keeps
  the Phase 4 wording (`/writeTests`) plus what the gate checks — but on an executing / complete feature (tasks ticked,
  e.g. an upgraded 1.12 one) it uses `next.signOffTests` (a sign-off for the tests that exist, never "failing tests
  first, no implementation code"). **Approving `execution`** runs spec_finish's blockers
  (`finishFeature(…, {gateOnly: true})` → stable ids `doctor`, `root-cause`, `placeholders`, `changed-since-approval`,
  `tasks`, `open-tasks`, `verification`, `approval-gates`, `suite-evidence` with meta.checks; a spike: `spike`, `decision`);
  otherwise only `force` records it. spec_metrics' `finished`
  = the earliest of the first execution approval and `state.finished.at` (spec_finish {write} on a ready feature).

## Change history (1.13)
- **Approval history.** `approvals[phase]` stays the latest approval (with its content `fingerprint`);
  every approval is ALSO appended to `.state.json → approvalHistory` `{phase, at, by, fingerprint, forced?,
  failing?, snapshot, file?, designSnapshot?}` and the approved artifact is saved to
  `.specs/<f>/.history/<phase>@<n>.md` (tasks with checkboxes normalized; never overwrites an existing
  snapshot). `.history/` is **not** self-ignored — it is meant to be committed with the spec. Approvals made
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
  tests, execution — keeps its sign-offs until approved). readState refuses a non-object `signoffs`.
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
  when every planning artifact through tasks is filled and passes its gate.

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
  snapshot; pre-history approvals are seeded as legacy records first), never cascades (`laterApproved` stay approved — the
  revoked phase is pending again, so approving a later one is refused on `phase-order`). Refused with force / expires /
  through, and for a phase that isn't approved (`notApproved`). **Every reader of approvalHistory filters through
  `isApprovalRecord()`** — never `partial !== true` alone (a revoked record is no approval). The approval guard reads a
  revoke as an approval action (`revoke: true`; the human's command is `approve … --revoke`). `changesSince()` also emits
  each revocation newer than t (`{kind: "revoke", phase, at}` — a record that removed an approval, never `partial`, never of
  the `except` phase = `execution`), so a finish / execution sign-off older than it is stale (drift verdict `stale`,
  `revoke.driftWhy` in the CLI line; `revokedSinceList()` drops a phase re-approved since — it reads "re-approved"). The
  catalog's `finished` also needs no pending gate (`pendingGateList`, existence checks only): SPECS.md reads ☑ complete.
- **Waivers** — `force` + `reason` / `expires` (`waiverInput()`: `YYYY-MM-DD` from today up to 3650 days, or `Nd`) →
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
  checks, role?, waiver?}` (revoke: `{dryRun, revoke: true}` after its own checks; through: `{dryRun, chain}` — the phases it
  would walk, each gate running only when approved); a refusal / error comes back exactly as without it. Only the server passes it
  (the preview before it asks the user — a gate that refuses anyway asks nobody); never a tool argument or a CLI flag.

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

## Bugfix and finish (v1.12)
- **`kind: "bugfix"`** is stored in `.state.json`; `createFeature` scaffolds `bug.md` +
  bug requirements/test plan/tasks (always +tdd), `specDoctor` swaps the design checks for
  `reproduction` (warn) and `root-cause` (**fail** until filled — the iron law, enforced at execution by
  `bugfixGate()`).
- **`spec_finish`** builds a merge title + summary (`mergeTitle`/`mergeSummary`, `.execution/merge-summary.md`)
  from the spec chain; it never merges, pushes or approves. **No PRs:** the owner's cost rule extends to
  pull requests — the plugin integrates by local merge only and must never steer users to open a PR or
  run CI (a test asserts no command/skill/agent text does).
- **Global Constraints** heading synonyms: `RE_GLOBAL_CONSTRAINTS` (EN/PT/ES); placeholder bullets are
  skipped when inlined into briefs.
- **Plugin evals** (`evals/<case>/prompt.md` + `graders/*.md`; behavioural cases add `case.yaml` +
  `fixture.sh`) follow the `claude plugin eval` reference; they cost tokens and run locally only (never CI).
