# Feature lifecycle — catalog, drift, archive, upgrade, decisions, spikes, forecasts, the roadmap

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
What happens to a feature after its tasks: the catalog, `_Supersedes:_`, the finish baseline and drift, archive /
restore, a feature's git branch, spec_upgrade, decisions and spikes, forecasts, the generated roadmap files. The rules come
first; how they came to be — the releases and review findings — is in History at the end.

## Catalog, drift, restore
- **`SPECS.md` is generated** (`spec_export {format: "catalog", write}`, `maybeRefreshCatalog()`) behind the `RE_AUTOGEN` /
  `isGeneratedOrAbsent()` guard — a hand-written one is never overwritten; once it exists, every roadmap refresh refreshes it
  (Roadmap files).
- **`_Supersedes: <feature>/US-n.AC-m[, …]_`** on a criterion (its line, a sub-line or its table row) marks the older AC
  replaced. `stripSupersedes()` runs before own-AC extraction, so the foreign ID is never this feature's AC; an unresolvable one
  is `phantomSupersedes`, never a gap.
- **Only a SHIPPED declarer retires an AC** (`featureShipped()`: finished or execution signed off — the release notes' rule). A
  draft's declaration is `supersedePending: true` — "to be superseded by … (not shipped yet)", still current (`totals` pending ⊂
  current; `counts.supersedePending`); a retired AC names only its shipped declarers. A shipped feature counts only the
  declarations of its requirements snapshot approved at or before its latest ship (`shippedSupersedeKeys()`; no snapshot → all);
  one archived without shipping declares nothing and its ACs are not current. `supersededByIndex()` (`.live`, `.liveBy`) and
  `catalogData()` (`supLiveBy`) share the rule.
- **Drift baseline:** `spec_finish {write}` on a READY feature records `.state.json → finished` `{at, files: {rel: sha1|null}}`
  over its `_Implements:_` files (folders expanded, inside the project). `fileHash()` reads `FILE_HASH_CHUNK` (1 MiB) pieces
  (`readSync`), CRLF-normalized across pieces — never a whole-file read; mcp/tests/12-lifecycle.js pins its digests.
- **`spec_drift`** hashes only those files. Open tasks → `reopened`; changed since its finish (`staleFinish()`) → `stale` (CLI
  exit 1; the catalog says `complete`), yet still hashed: a drifted file gives verdict `drift` — a stale baseline never hides a
  change. An unreadable state is `error`. SessionStart: one line per drifted ACTIVE feature, bounded by `DRIFT_MAX_FILES`.
- **The catalog's `finished`** is finish's: ticks verified (`verificationStatus`), nothing changed BY CONTENT since approval
  (`changedSinceApproval` minus `byDate`), no new `_Implements:_` file (walked last; `baselineFiles(…, known)` skips the realpath
  check for known files — the whole cost). An ARCHIVED feature is never walked for new files: its stale line says restore →
  finish → archive; `existingFeature`'s not-found error names an archived twin (`err.archivedHint`).
- **Archive → restore:** archive writes `archived: {at, entry, dependents}` into the archived `.state.json` BEFORE pruning
  roadmap.json; restore re-adds the entry and the dependents' `dependsOn` in place (live features; a now-circular edge is skipped
  and reported). An edge to a feature archived too moves into its record (reason `archived`, else `gone`) — either restore order
  rebuilds it. The result has `dependentsPruned`, plus `incompleteDependency: true` and a warning `note` for an incomplete
  feature. `rename` rewrites archived records (`renamePlan()`).
- **Never through a link:** a linked (or escaping) `_archive/` or `_archive/<slug>` is refused by the write gate (conventions.md →
  The write gate: `ensureDir(_archive)`, the restore's `_archive/<slug>/.lock`) — `linked: true`, nothing moved; a `_archive`
  FILE → `wrongKind`.
- **One slug active AND archived:** archive (`err.alreadyArchived`) and restore (`restore.activeExists`) refuse, naming the
  runnable `feature rename`; a rename onto an archived slug is refused (`err.renameArchived`, `archivedName: true`). `spec_create`
  of a new feature with an archived twin's slug is allowed and says so (`archivedTwin: true`, `createArchivedTwin`).

## A feature's own git branch
- **The record** (`create` / `bugfix` / `spike --branch`, `spec_create {branch}`): `.state.json → branch` = `{name, base, commit,
  at}` — `base` the branch HEAD named (null when detached), `commit` HEAD's (null without one), `at` = `createdAt` or the later
  re-run's time; no key unless recorded. `featureBranchRecord()` (state.js) is THE reader — an unusable name reads as none.
- **The name** (`branchInput()`, scaffold.js): `true` → `defaultBranchName(kind, slug)` (`feature/`, `fix/` for a bugfix,
  `spike/`); a string → itself, trimmed; `false` → none. `branchNameOk()` (state.js): letters, digits, `.` `_` `+` `-` `/` only —
  the command is handed out UNQUOTED, one line for sh, PowerShell and cmd.exe — then git's check-ref-format rules, ≤ 200
  characters; `branch.invalid` / `branch.empty` refuse before any write.
- **The engine never runs git.** `gitRepoFacts()` (state.js) reads the repository's files: the nearest `.git` (a worktree's
  gitdir and `commondir` via `gitDirsOf()`), HEAD, loose and packed refs; a reftable repository reads as unknown. The CLI passes
  git's own answer instead: `createFeature`'s `opts.git` = `{repo, base, commit, current, exists(name)}` from cli/git.js
  `branchFacts` (undefined when git can't run → the files).
- **`planBranch()`:** no repository (`reason: "no-git"`) or a branch of that name that EXISTS (`reason: "exists"` — it may hold
  other work: never adopted or switched onto) → not recorded, no command. Else recorded with `command` (`git switch -c <name>`)
  and `args` (run without a shell). A re-run keeps the record (`kept: true`; another name is only noted) and hands out `git
  switch [-c] <name>` unless HEAD is on it; a feature without one gets it (`storeFeatureBranch`, under the feature lock). Over
  MCP the `note` says to run it (`branch.run`).
- **The CLI** (cli/commands.js): `branchGitFacts`, the engine, then `branchSwitch` runs `branch.args` through cli/git.js `gitRun`
  (+ `switched` / `created` / `current` / `error`), only onto a branch it creates or the feature's own. **Exit 1 whenever the
  feature does not end up on its branch** (no repository, the name taken, no git, `git switch` refused); the feature and the
  record stay, so a re-run retries. `--branch` takes an OPTIONAL value (conventions.md → CLI arguments); a track word as its spaced value
  (`create x --branch tdd`) is refused as ambiguous.
- **The readers:** `spec_status` / `spec_next_action` / `spec_finish` carry `branch` (`branchView()`: + `current`, `exists`).
  next_action appends `branch.notOn` while HEAD is elsewhere and the phase is open — the step never changes. finish adds
  `branch.summary` and, ready, the two local options (`finishBranchLine`; a base no shell takes unquoted is left out); a spike's
  summary has no line. Drift and the hooks never read the record.
- **The log range:** `dev-spec log` reads `git log <commit>..HEAD` (an unknown commit → the whole log; `since`,
  `branch.logSince`); `taskCommits` cuts a handed-in log (`spec_log`, `log -`) at the recorded commit when `opts.since` is
  undefined (the CLI passes its range, or `null`), so every surface gives the same result.
- **Merging it** (conventions.md → Merging the spec state): the EARLIER record wins (`mergeBranchRecord`).

## Upgrade — `meta.specVersion` and `spec_upgrade`
- **The engine's version:** `engineVersion()` reads `package.json` at the clone's root (three levels above
  `engine/upgrade.js`) once; unreadable or not x.y.z → `null` — nothing stamped, no notice, never a guess. `compareSemver()`
  compares numerically (1.9.0 < 1.13.0), a pre-release before its release — never as strings.
- **`roadmap.json → meta.specVersion`** (`stampOf()`) = the version that last created or upgraded the project.
  `stampSpecVersion()` writes it under the roadmap lock, never lowers it, never over a broken roadmap.json. Writers: `spec_init` /
  `spec_create` only when the project had NO feature, active or archived (`featureDirs()`, counted before any write), and
  `spec_upgrade {apply}`, last, once every feature migrated — a new project never gets the notice, a legacy one is never stamped
  by init or a create. SessionStart adds ONE line (`msg.upgrade.hookLine`) while `specVersionStatus().behind`.
- **The audit** (`specUpgrade`, read-only, ACTIVE features; archived ones counted) reuses the engine's verdicts: `specDoctor`
  once (`nextAction(…, {doctor})`), `verificationStatus`, `changedSinceApproval`, `baselineDrift` / `staleFinish`; one test-code
  walk per call (`traceTestCode()` takes a lazy `scan`). Stable codes, never localized: `status` not-started · planning ·
  executing · complete · finished, `review` critic · converge · none, `group` blocked · attention · ok, the `attention` codes,
  the skip `reason`s. `lines` and UPGRADE.md are in the PROJECT language (`upgradeLines()` / `renderUpgradeMd()` over
  `upgradeItems()`).
- **Bare AC-n IDs** (`AC-1`) fail doctor's `ears` / `traceability`; the audit lists them (`bareAcIds` via `criteriaBareIds()`, a
  change's change.md too; `criteriaFile`; attention `bare-ac-ids`) with `upgrade.item.bareAcIds`: renumber to
  US-<story>.AC-<n> with their references, then re-approve. The audit edits no spec.
- **The migrations** (`apply: true`) never edit an artifact, approve, tick, untick or delete. Per feature, under its lock,
  `upgradePlan()` → `applyUpgradePlan()` writes `.state.json` once: `tracks` when absent (a malformed list left alone);
  approvals missing from `approvalHistory` as `legacy` records (`legacyRecord()`, as `approvePhase` seeds); for a snapshot-less
  approval whose fingerprint still matches (`fingerprintMatches`, a bugfix's `designFingerprint`), the artifact via
  `writeSnapshot()` (the next free `.history/<phase>@<n>.md`, never a renumber), stamped `seededAt`. Skips: `no-fingerprint`,
  `changed`, `missing`, `untracked` (a legacy bugfix design approval without `file`), `snapshot-missing`. Then
  `.specs/.gitignore` (`missingIgnoreLines()`, before any lock), the stamp, a roadmap refresh, the re-audit and UPGRADE.md
  (`isGeneratedOrAbsent`). **Idempotent:** UPGRADE.md has no date and is written only when something migrated
  (`migrations.changed: false` otherwise). CLI `dev-spec upgrade [--apply] [--json]` exits 1 on an error (no .specs/, a broken
  roadmap.json, a feature not migrated).

## Decisions and spikes
- **`decisions.md`** (committed; `.execution/` is scratch): a localized header, then entries `## D-<n> — <title>` with the
  markers `_Kind: decision | discovery_`, `_Date:_` and the optional `_Affects:_` / `_Supersedes: D-m_`, then **Context** /
  **Decision** (or **Discovery**) / **Consequences** (localized; any EN/PT/ES label read). IDs and markers are English-stable,
  read only between the heading and the first label; HTML comments and fenced code never hold an entry.
- **`spec_decide`** appends under the feature lock after the highest D-n, the existing bytes untouched (BOM, CRLF kept); title ≤
  200, texts ≤ 20 000 characters.
- **`appendSpecText()` (decisions.js) is THE append of every spec writer** (spec_decide, spec_add_track,
  `restoreCoveredSections`, the importer): a code fence left open at the end is closed first, else the addition lands inside it,
  reads as missing and is written again. `appendTasks` (tasks.js) inserts inside a phase instead.
- **`_Affects:_`** must name an AC, a planned T-ID, an EC/NFR/SC ID or a design heading (bug.md for a bugfix, spike.md for a
  spike) — else `unknownAffects`, nothing written. A heading holding "," / ";" ("Decisions, reuse & risks") is split OUTSIDE
  backtick spans (`affectPieces()`, `splitRefs()`), written `quoted` (`quoteRef`), and a piece naming nothing joins the next ones
  (≤ `AFFECTS_JOIN_MAX`) — `affectsRefs()` for spec_decide, `entryRefs()` for a logged entry.
- **`_Supersedes:_ D-n`** names existing entries; a superseded entry is retired (skipped by the brief and
  `decision-affects-approved`, marked in the catalog).
- **Readers:** the brief (bounded), finish's merge summary, spec_export and the catalog, trace_check (`phantomAffects`, warnings),
  doctor (`decision-affects`; `decision-affects-approved` for a decision recorded AFTER the approval it names), the ADR export
  (`exportAdr`: ADR number = D-number, so the log never renumbers — templates-imports-exports.md → Exports and planning).
- **Spike kind** (`kind: "spike"`, `question`, `timebox` `YYYY-MM-DD` | `3d`): spike.md (Question · Timebox · Options considered ·
  Evidence · Decision + `_Outcome: go | no-go | pivot_` · Follow-up; `SPIKE_SYN`; `_Outcome:_` also reads PT/ES and yes/no) +
  investigation tasks; core-only, no gates (`gateWalk`, `pendingGateList`, `chainArtifacts` empty; approve takes only the
  execution sign-off; add_track refuses it). `spikeDoctor`: the decision FAILs until written with prose (the `_Outcome:_` line
  alone is no rationale); the timebox warns once past. next_action: investigate → decide → go (spec the real feature from it,
  archive the spike) · no-go (archive) · pivot (a new spike). finish: decided + every task ticked, no suite / evidence gates.
  detectPhase: requirements → tasks-ready → executing → complete. Roadmap (🔬, timebox attention), catalog, export and resources
  know it; the changelog never lists one; prototype code lives outside `.specs/`.

## Forecasts and cross-feature overlap
- **Sizes:** `_Size: XS|S|M|L|XL_` (English-stable, never in fenced code) = 1/2/3/5/8 points (`SIZE_POINTS`); an unsized task
  counts as its feature's median sized task, else M.
- **Ticks:** `completeTask` (tasks.js) records `ticks[n]` = ISO in its one `.state.json` write BEFORE the tick (a non-object
  `ticks` is left alone). No tick time → the first passing evidence run, else the record's time (`taskCompletedAt`); a box
  ticked by hand never counts.
- **Velocity** = points per WORKING day (Mon–Fri, LOCAL days — conventions.md → Calendar dates) over the last
  `FORECAST_WINDOW_DAYS` (28), from the window's first completion through today; per feature once it has `FORECAST_MIN_TASKS` (3)
  completions. The project rate counts ARCHIVED features' completions (`archivedCompletions()`; an archived folder whose mtime
  predates the window is skipped unread, unless `opts.now` is fixed).
- **ETA** = open points ÷ velocity, in working days from today or from the day after each unfinished dependency's ETA,
  ±`FORECAST_SPREAD` (25%). None → `eta: null` + a stable `reason` (`not-enough-data` · `no-tasks` · `dependency` · `cycle` ·
  `done`). Pure reads of tasks.md + .state.json.
- **Every dependency cycle:** `findCycles()` (state.js, iterative Tarjan) → roadmap()'s `cycles` (one path each; `cycle` = the
  first), one ROADMAP line each, the CLI's extras in `roadmapTailLines`; `forecastData()` gives every member reason `cycle`.
  `findCycle` stays the refusal's check (depend, restore).
- **A dependency done but not signed off** is phase `complete` (detectPhase): its dependents are unblocked (a test pins it).
- **Overlaps** (`featureOverlaps()`): ACTIVE features whose OPEN tasks plan the same files (`implementsKey`; folders and globs
  cover what they hold), or a file a FINISHED feature's baseline holds — never between features ordered by a dependency
  (transitively) or one superseding the other. Bounded (`OVERLAP_MAX_KEYS` 500, `OVERLAP_MAX_GLOB_CHECKS`, `OVERLAP_MAX_PAIRS`
  50), text reads only — SessionStart runs it; doctor warns `cross-feature-overlap`.
- **The walk's cost:** doctor runs `featureOverlaps(…, {only})` only when an OPEN task has an `_Implements:_`; without a feature
  list it reads `overlapFeatures()` (name, complete or not — `spikePhase` for a spike —, dependsOn), never detectPhase's planning
  chain (mcp/tests/12-lifecycle-write-gate.js "I-I3"). No cache across calls (Roadmap files).

## Roadmap files and dependencies
- **Generated roadmap files carry the `AUTO-GENERATED by dev-spec` marker (EN/PT/ES, `RE_AUTOGEN`)**: `writeRoadmapMd/Html`
  never overwrite a file without it (the hooks run in every project); `spec_roadmap` reports a refused ROADMAP.md as an error.
  `SPECS.md`, `UPGRADE.md`, `RELEASE-NOTES.md` and `.specs/exports/*` share the family (`isGeneratedOrAbsent()`). The chrome
  language is `meta.roadmapLang`, else `meta.lang` (only `spec_init` sets it).
- **Roadmap files are generated, never hand-edited:** `ROADMAP.md` by default (Mermaid); `ROADMAP.html` opt-in (`html:true`),
  self-contained and **offline** — no external URL (a test asserts it). `roadmapData()` computes, `renderRoadmapMd` /
  `renderRoadmapHtml` render; `maybeRefreshRoadmap` (every mutator) rewrites MD + an existing HTML + an existing SPECS.md,
  best-effort.
- **A broken roadmap.json** (`roadmapError()`) is read as its sanitized copy and never rendered: `writeRoadmapFile()` refuses
  (`broken: true`, `err.roadmapNotWritten`), keeping the last good file; `roadmapReport {write}` is an error (CLI exit 1), its
  view a warning (`err.roadmapViewPartial`).
- **`spec_roadmap_edit {kind: "depend"}`**: `dependsOn` REPLACES the list (`[]` / `--clear`), `add` / `remove` edit it, `name`
  alone is a read; every dependency must exist.
- **The row cache:** `roadmapRow()` results are cached in process (`ROW_CACHE`, ≤ 500 — for the MCP server), keyed on every
  input's stats (each feature-folder entry's size, mtime, ctime, inode — `.execution/`, the lock and temp files skipped —,
  roadmap.json, steering / templates / tracks) plus the row's `f` and overlaps — a row that reads a new input must add it to the
  key. git's racy rule: a stamp within `ROW_OPTS.racyMs` (3 s) of now is never trusted; a date-dependent row (a spike, a waiver)
  is never stored. `taskMarkerSpans` (frozen, shared) and `taskMarkers` (copies) are memoized. mcp/tests/08-tasks.js compares
  cached and fresh output byte for byte.
- **No file content is cached across calls**, on purpose: `withReadCache` reads each file once per call (~1 ms an open on
  Windows), and a cross-call cache would serve a same-tick, same-size rewrite stale — the files approvals fingerprint.
- **A hand edit refreshes them ONCE A TURN.** The PostToolUse save hook only lints and stamps
  `.specs/.execution/roadmap-stale` (`markRoadmapStale()`, git-ignored with `.execution/`; a save of `ROADMAP.*` or the root
  SPECS.md / UPGRADE.md stamps nothing). `refreshStaleRoadmap()` runs at the **Stop / SubagentStop hook** (before the gate,
  whatever it says; the engine loaded only for a stamped project), **SessionStart**, **every engine mutation** (the stamp cleared
  first — a save meanwhile stamps again) and the **pre-commit check** (hooks/precommit-check.js, which re-adds a STAGED generated
  file). mcp/tests/10-guards-guard-downs.js ("I-I1") covers each.
- **The lag is safe:** at most one turn, and nothing decides from these files — approvals fingerprint a feature's own artifacts
  (`textFingerprint`), every verdict computes from the specs, and the project probe (mcp/lib/probe.js `isDevSpecProject`) reads
  only ROADMAP.md's marker. The `specs://roadmap` / `specs://catalog` resources serve `staleGeneratedText()` while stamped. Still
  stale: a commit inside the turn without the pre-commit check, a stamp in a project the session never stops in.
- **The backlog:** `roadmap.json` `backlog: [{name,note}]`, one line each (`flatText()`); `spec_create`, restore and a rename
  onto the name drop the item; an ACTIVE feature's name is refused (`backlogIsFeature`). `remove` is a documented alias of `rm`
  on both surfaces — the engine and the `spec_roadmap_edit {kind: "backlog"}` enum (and the legacy `spec_backlog`) accept it
  (`BACKLOG_ACTIONS`).
- **What reaches ROADMAP.* from roadmap.json:** `dependsOn` is only shape-checked. Mermaid edges join EXISTING features only,
  ids prefixed (`mid()` → `f_<slug>`: `end`, `graph`, `subgraph` are keywords), labels without a raw quote (`mlabel`); elsewhere
  `depShown()`. A dependency no active feature answers to is a "Needs attention" line (`depend.roadmapStale`, with the `depend`
  command that resets the list) — still unmet. The next task is read through `readContained` (a linked tasks.md reads as
  absent); every display cut goes through `cutText()` (never half a surrogate pair). `spec_import` refreshes once, after its
  files (`createFeature` with `refresh: false`).

## History
How the rules above came to be, section by section — grep a release (`1.21.1`) or a finding id (`M8`, `r6 B3`) here.

### Catalog, drift, restore
- **1.13** — `SPECS.md` became a generated catalog guarded like the roadmap; `_Supersedes:_`; the finish drift baseline and
  `spec_drift`; archive → restore through the archive record. Fixes of the release: a stale baseline still hashes its recorded
  files (a new file under an implemented folder made another file's drift vanish, and the re-finish accepted it); the catalog's
  `finished` matches next_action / finish (`baselineFiles` skips the realpath check for recorded files); drift never walks an
  archived feature, its stale line says restore first and a not-found archived name says so; archive names the dependents it
  unblocks. A feature approved before 1.13 has no requirements snapshot, so all its `_Supersedes:_` declarations are trusted. The
  section also held Guard mode (now claude-code-integration.md) and Scoped steering (templates-imports-exports.md).
- **1.14** — an edge to a feature archived too goes to that feature's archive record, so restore brings it back in either order
  (it was dropped as "gone" for good).
- **1.15** — only a SHIPPED declaring feature retires the older AC (`featureShipped()`); a draft's declaration became
  `supersedePending`, and `shippedSupersedeKeys()` keeps a change request's declaration pending until the feature ships again.
- **1.22 review** — `fileHash()` read whole files with `readFileSync().toString("latin1")`, which returned null at 512 MiB (recorded
  "missing", then "unchanged" forever) and held every file twice in memory; it reads 1 MiB pieces now, with the old digests
  (the test checks pieces of 1–64 bytes against the old function).
- **1.23 review 5** — one slug active AND archived: each refusal advised the other's refused step ("archive it", "Remove it there
  first", with no command for either); both now name the rename, and a rename onto an archived slug is refused, so rename no
  longer makes that state. `spec_create` of an archived twin says so (`archivedTwin`).
- **1.24 r6** — an archive into a `.specs/_archive/` that was a link moved the whole feature there, and restore pulled any folder
  the link's target held into .specs/; both refused by the write gate since.

### A feature's own git branch
- **1.25** — `create --branch` / `spec_create {branch}`: the record, the name rules, the engine reading the repository as files,
  the CLI's switch and exit 1, the readers and the merge rule. A feature without a branch kept the 1.24 state byte for byte.
- **1.25.1 review 7** — `spec_log` / `log -` read the whole text they were given, so "the same result as `dev-spec log --json`"
  did not hold; `taskCommits` now cuts a handed-in log at the recorded commit.
- **1.27** — the CLI became one command table (cli/main.js, cli/commands.js, cli/run.js) with one git runner, cli/git.js `gitRun`;
  the branch facts are its `branchFacts`. `createFeature` takes an options object (git's facts are `opts.git`).

### Upgrade
- **1.12** — a bugfix's design approval recorded no `file`; the migrations skip it as `untracked`.
- **1.13** — `meta.specVersion`, the SessionStart notice and `spec_upgrade` (the read-only audit, the safe migrations,
  UPGRADE.md).
- **1.22 review 2** — doctor's `ears` / `traceability` started failing a feature approved before 1.22 with bare `AC-1`, `AC-2`
  criteria; the audit lists them (`bareAcIds`) with the renumber item. **1.22 review 3** — a change has no tasks.md / test-plan.md:
  the item names its tasks' `_Requirements:_` in change.md.

### Decisions and spikes
- **1.14** — `decisions.md`, `spec_decide` and the spike kind.
- **1.22 review** — `_Affects:_` naming a heading that holds "," / ";" (the size-S "Decisions, reuse & risks" and its PT / ES
  twins, "[API] Pagination, Idempotency & Concurrency") was split into pieces that named nothing; the quoted references and the
  joining of pieces (`AFFECTS_JOIN_MAX`).
- **1.23 review 5** — a `decisions.md` ending inside an open code fence got its entry written unreadable and the D-n handed out
  again; add_track's sections landed inside an open fence, read "missing", and a re-add wrote them twice. `appendSpecText()`
  became the one append of every spec writer.
- **1.25** — the ADR export (`spec_export {format: "adr"}`).

### Forecasts and cross-feature overlap
- **1.14** — sizes, tick times, velocity, ETAs and the cross-feature overlaps. Tasks ticked before 1.14 have no tick time (the
  evidence fallback).
- **1.22 review** — doctor ran the overlap walk for every feature; now only with an open `_Implements:_` task (30 features × 40
  tasks, a feature with none: doctor 236 → 64 ms, next_action 336 → 96 ms, spec_finish 257 → 75 ms).
- **1.24 r6 G3** — archiving a feature shipped this week wiped the velocity (roadmap, spec_metrics) and turned every other
  feature's ETA into `not-enough-data`; the project rate counts archived completions (`archivedCompletions()`).
- **1.24 r6 G6** — only `findCycle`'s first cycle got reason `cycle` (a → a hid b ↔ c), and a member the walk met second was
  overwritten with `dependency`; `findCycles()` reports every cycle (`cycles`; `cycle` stays the first).
- **1.24 review 6 (G-I6)** — a dependency done but not signed off was checked: it needs nothing (a test pins it).
- **1.24 r6 I-I3** — the overlap walk went through detectPhase's planning chain for every feature; `overlapFeatures()` reads
  only what it uses (the same pairs — the review's overlap-exp.js). featureOverlaps warm, per call, at 10 / 52 / ~150 features:
  9 / 45 / 126 → 6 / 20 / 55 ms; fresh processes (p50 of 11): SessionStart 390 → 342 ms, `dev-spec doctor` 477 → 410,
  `dev-spec next-action` 383 → 288 at 150.
- **1.25.1 review 7** — velocity days are LOCAL calendar days; they were UTC days (a task ticked at 00:30 in Lisbon counted the
  day before).

### Roadmap files and dependencies
- **1.13** — a bare `dev-spec depend <f>` cleared the deps; `name` alone became a read.
- **1.14** — backlog names and notes are one line (`flatText()`: a line break became a heading in ROADMAP.md); a name an active
  feature holds is refused. **1.14 full review (S7)** — `backlog remove` became a documented alias of `rm` on both surfaces.
- **1.22 review** — every tick recomputed every feature's row (30 features × 40 tasks: 313 ms a tick against 13.8 without the
  refresh); `ROW_CACHE` and the memoized marker readers: a tick with its refresh ~185 → ~65 ms (no refresh ~10), roadmapData ~180
  → ~58, a one-shot `done` / tasks.md save ~470 → ~440.
- **1.23 review 5** — a broken roadmap.json rendered from its sanitized copy lost every dependency, backlog item and milestone
  from ROADMAP.md while `roadmap --write` exited 0; `writeRoadmapFile()` refuses since. What reaches ROADMAP.* was hardened: a slug
  `end` / `graph` / `subgraph` broke the Mermaid graph (`mid()`), a tasks.md linked outside `.specs/` had its lines copied into the
  committed file (`readContained`), an emoji cut at the boundary wrote U+FFFD (`cutText()`).
- **1.23.1** — a refresh measured (Windows 11, 86 features): ~400 ms for one import, one create or one `roadmap --write` alike —
  the four reads per feature, 381 opens, no file twice; the scan itself ~60 ms. A cross-call file cache was rejected (the rule
  above).
- **1.24 r6** — restore and a rename onto a backlog name drop the backlog item too, like `spec_create`.
- **1.24 r6 I-I1** — the save hook refreshed ROADMAP.md + SPECS.md on every Write / Edit of a spec file — a one-shot process, no
  `ROW_CACHE`, ~75 % of the hook; it now leaves the stamp, and the "Roadmap updated → N%" line (`hook.roadmapUpdated`) went with
  the refresh. Measured (p50 of 11 fresh processes, Windows 11, Node 24; 10 / 52 / ~150 features): a tasks.md save 243 / 384 /
  661 → 169 / 172 / 182 ms, requirements.md 232 / 352 / 645 → 134 / 136 / 158, design.md 219 / 337 / 626 → 148 / 148 / 149,
  classification.md 215 / 350 / 628 → 118 / 132 / 129; the Stop hook that refreshes (once a turn) 163 / 164 / 168 → 251 / 383 /
  652, without a stamp unchanged; SessionStart unchanged.
- **1.27** — one dev-spec project probe (mcp/lib/probe.js `isDevSpecProject`) for the hooks, the status line, the CLI and the
  engine; a generated ROADMAP.md is one of its signals.
