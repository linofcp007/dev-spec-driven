# Feature lifecycle — catalog, drift, archive, upgrade, decisions, spikes, forecasts, the roadmap

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
What happens to a feature after its tasks: the catalog, `_Supersedes:_`, the finish baseline and drift, archive /
restore, spec_upgrade, decisions and spikes, forecasts, the generated roadmap files.

## Catalog, drift, restore, guard, steering (1.13)
- **`SPECS.md` is AUTO-GENERATED** like the roadmap: `spec_catalog {write}` and `maybeRefreshCatalog()` use
  the same `RE_AUTOGEN` / `isGeneratedOrAbsent()` guard, so a hand-written `.specs/SPECS.md` is never
  overwritten; once it exists, every roadmap refresh refreshes it too.
- **`_Supersedes: <feature>/US-n.AC-m[, …]_`** on a criterion (same line, a sub-line or its table row) marks
  the older AC as replaced. `stripSupersedes()` runs before own-AC extraction (trace, acIndex), so the foreign
  ID is never one of this feature's ACs; unresolvable references are `phantomSupersedes` (never a gap). **Only a
  SHIPPED declaring feature retires the older AC** (1.15 — `featureShipped()`: a finish recorded, or the execution signed
  off: the release notes' rule) in the catalog, the export and the matrix: a draft's declaration keeps `supersededBy` but
  adds `supersedePending: true` — rendered "to be superseded by … (not shipped yet)" (catalog, export, the matrix's
  markdown / CSV cell / `trace --matrix` notes), never struck, still current; `totals` {current, superseded (retired),
  pending — a subset of current: "N current (P to be superseded), S superseded"}; the matrix `counts.supersedePending`. A
  retired AC names its SHIPPED declarers only (never a draft that also plans it). A shipped feature counts only the
  declarations it shipped with: `shippedSupersedeKeys()` — when requirements.md changed since the requirements snapshot
  approved at or before the latest ship (a finish / an execution sign-off), a declaration that snapshot lacks (a change
  request's edit) is pending until the feature ships again; no such snapshot (pre-1.13) → every declaration trusted. A
  feature archived without ever shipping (abandoned) declares nothing, and its own ACs are not counted as current.
  `supersededByIndex()` (the matrix: `.live`, `.liveBy`) and `catalogData()` (`supLiveBy`) apply the same rule.
- **Drift baseline:** `spec_finish {write}` on a READY feature records `.state.json → finished`
  `{at, files: {rel: sha1|null}}` (CRLF-normalized, `_Implements:_` files, folders expanded, inside the project
  only). `fileHash()` reads a file in `FILE_HASH_CHUNK` (1 MiB) pieces with `readSync` and drops each 0x0D that precedes a
  0x0A, a CR ending a piece carried to the next (1.22 review: `readFileSync().toString("latin1")` returned null at 512 MiB —
  recorded "missing", then "unchanged" forever — and held every file twice in memory); its digests are the old function's
  byte for byte (mcp/tests/12-lifecycle.js checks pieces of 1–64 bytes against it). `spec_drift` hashes only those files (never walks the tree); a baselined feature with open tasks is
  `reopened`, one changed since its finish (`staleFinish()`) is `stale` (verdict `stale`, CLI exit 1 — finish it
  again; the catalog calls it `complete`) but its recorded files are STILL hashed: one that drifted puts it in
  `features` (`stale: true`) and `drifted` (verdict `drift`) — a stale baseline must never hide a changed file
  (a new file under an implemented folder used to make another file's drift vanish, and the re-finish accepted it).
  An unreadable state is verdict `error` — never "clean". The catalog's `finished` is next_action's / finish's: it also
  needs every tick verified (`verificationStatus`), no artifact changed since its approval BY CONTENT
  (`changedSinceApproval` minus `byDate`, as finish) and no new `_Implements:_` file (the walk runs last, only for a
  feature still finished; `baselineFiles(…, known)` skips the realpath check for files the baseline already has — it
  was the whole cost). An ARCHIVED feature is never walked for new files (drift and catalog): it can't be finished
  where it is; the CLI stale line for an archived one says restore → finish → archive again, and `existingFeature`'s
  not-found error names an archived folder of that name (`err.archivedHint`).
  SessionStart adds one line per drifted ACTIVE feature, bounded by `DRIFT_MAX_FILES`.
- **Archive → restore:** archive records `archived: {at, entry, dependents}` in the archived `.state.json`
  BEFORE pruning roadmap.json; restore moves the folder back, re-adds the entry and the dependents' `dependsOn`
  in their old position (only for features that still exist; a now-circular edge is skipped and reported). An edge to a
  feature that is ARCHIVED too is handed to that feature's own archive record (reason `archived`), so its restore puts it
  back — in either order (it was dropped as "gone" for good). The
  archive result names what the prune did — `dependentsPruned` (always), plus `incompleteDependency: true` and a
  warning `note` when the archived feature wasn't complete (its dependents now read as unblocked; the roadmap
  meets a dep at 100%). `rename` rewrites archived records too (`renamePlan()`), so restore finds the new slug.
  **Never through a link (1.24 r6):** archive into a `.specs/_archive/` that is a link (or resolves outside .specs/) moved the
  whole feature there, and restore pulled any folder the link's target held into .specs/; both are refused now by the write gate
  (conventions.md → The write gate: the archive's `ensureDir(_archive)`, the restore's lock at `_archive/<slug>/.lock`, a linked
  `_archive/<slug>` too) — `linked: true`, nothing moved. A `_archive` that is a FILE is a localized `wrongKind` refusal.
  **One slug active AND archived (1.23 review 5):** archive refuses (`err.alreadyArchived`) and restore refuses
  (`restore.activeExists`) — each used to advise the other's refused step ("archive it", "Remove it there first", with no command
  for either); both now name the one way out, a rename of the active feature (the runnable `feature rename` line). The state is not
  made by rename any more: a rename onto a slug `_archive/` holds is refused (`err.renameArchived`, `archivedName: true`, nothing
  moved). `spec_create` of a NEW feature whose slug an archived one holds is allowed (a name may be planned again) and says so
  (`archivedTwin: true` + `createArchivedTwin`; spec_import puts it in `warnings`).
- (The section's other two bullets moved: **Guard mode** → claude-code-integration.md, **Scoped steering** →
  templates-imports-exports.md.)

## Upgrade (1.13) — `meta.specVersion` and `spec_upgrade`
- **The engine's version** is `engineVersion()`: `package.json` at the clone's root (three levels above `engine/upgrade.js`), read once; not readable or not
  x.y.z → `null`, and then nothing is stamped and no notice is shown (never a guessed version). Versions are compared by
  `compareSemver()` — numerically (1.9.0 < 1.13.0), a pre-release before its release; never a string compare.
- **`roadmap.json → meta.specVersion`** = the dev-spec version that last upgraded or created the project (`stampOf()`: a
  string that parses, else absent). `stampSpecVersion()` writes it under the roadmap lock, never lowers it and never writes
  over a broken roadmap.json. Three writers only: `spec_init` and `spec_create` when the project had NO feature before the
  call (`featureDirs()` — active or archived — counted BEFORE anything is written; best-effort), and `spec_upgrade {apply}`
  (last, and only once every feature migrated — a busy or broken feature keeps the notice until a retry). A brand-new
  project must never get the upgrade notice; a legacy project must never be stamped by creating one feature or re-running init.
- **SessionStart** adds ONE line (`msg.upgrade.hookLine`) while `specVersionStatus().behind` (no stamp, or an older one) —
  roadmap.json is already read for the language; wrapped in try/catch. The PostToolUse hook treats `.specs/UPGRADE.md` as a
  generated file (no roadmap refresh on its edits).
- **The audit** (`specUpgrade`, default, read-only) reuses the engine's verdicts per ACTIVE feature (archived ones are counted
  in `archived`): `specDoctor` once (`nextAction(…, {doctor})` reuses it — never run twice), `verificationStatus`,
  `changedSinceApproval` (via next_action), the finish baseline (`baselineDrift`, `staleFinish` state-only). One test-code walk
  for the whole call: `traceTestCode()` accepts a function for `scan`, called only when a feature needs it. Stable codes (never
  localized): `status` not-started · planning · executing · complete · finished (= phase complete + a finish baseline),
  `review` critic (no task ticked) · converge (some done, some open) · none, `group` blocked (doctor fail) · attention · ok,
  `attention` codes, history skip `reason`s. **Bare AC-n IDs (1.22 review 2):** a feature approved before 1.22 with criteria
  numbered `AC-1`, `AC-2` fails doctor's `ears` / `traceability` now (a bare ID is no ID trace_check reads); the audit lists them
  (`bareAcIds` — `criteriaBareIds()` over the criteria, a change's change.md included — and `criteriaFile`), attention
  `bare-ac-ids`, and an item (`upgrade.item.bareAcIds`, EN / PT / ES, in UPGRADE.md too): renumber them US-<story>.AC-<n>, their
  references in tasks.md / test-plan.md too (review 3: a change has neither — the item names its tasks' `_Requirements:_` in
  change.md), then re-approve. It never renumbers anything itself (the audit edits no spec).
  `lines` (and UPGRADE.md) are rendered in the PROJECT language by
  `upgradeLines()` / `renderUpgradeMd()` over one item list (`upgradeItems()`); next_action's recommendation stays in the
  feature's language, as everywhere.
- **The migrations** (`apply: true`) never edit an artifact, approve, tick, untick or delete. Per feature, under its lock,
  `upgradePlan()` → `applyUpgradePlan()` writes `.state.json` once: `tracks` only when absent (`undefined` or `[]` — a
  malformed list is left alone), the approvals whose latest version isn't in `approvalHistory` as `legacy` records
  (`legacyRecord()`, the builder `approvePhase` seeds with), and for an approval WITHOUT a snapshot whose recorded fingerprint
  still matches its artifact (`fingerprintMatches`) that artifact saved through `writeSnapshot()` (next free
  `.history/<phase>@<n>.md`, never a renumber; a bugfix design approval's design.md too when its `designFingerprint` matches)
  on that very record, stamped `seededAt`. Skipped with a stable reason: `no-fingerprint` (date-only), `changed`, `missing`,
  `untracked` (a 1.12 bugfix design approval — `file` absent, so any fingerprint is design.md's), `snapshot-missing`. Then
  `.specs/.gitignore` (`missingIgnoreLines()` computed BEFORE any lock — every lock ensures it), the stamp, a roadmap refresh,
  the audit of the result and `.specs/UPGRADE.md` (the `RE_AUTOGEN` marker family, `isGeneratedOrAbsent` — a hand-written one
  is reported, never overwritten). **Idempotent:** UPGRADE.md is written only when something migrated, and it carries no
  date, so a second apply writes nothing at all and says so (`migrations.changed: false`).
- CLI `dev-spec upgrade [--apply] [--json]` prints `lines`; exit 0 with a report, 1 on an error (no .specs/, a broken
  roadmap.json, a feature that couldn't be migrated).

## Decisions and spikes (1.14)
- **`decisions.md`** (committed with the spec — `.execution/` is the scratch area): a localized header, then per entry
  ```
  ## D-<n> — <title>
  - _Kind: decision | discovery_
  - _Date: <ISO timestamp>_
  - _Affects: US-1.AC-2, T-03, <design section>_      (optional)
  - _Supersedes: D-1_                                 (optional)
  **Context:** …  **Decision:** (or **Discovery:**) …  **Consequences:** …   (localized labels; any EN/PT/ES spelling read)
  ```
  The IDs and markers are English-stable; markers are read only between the heading and the first label; HTML comments
  and fenced code never hold an entry. `spec_decide` appends under the feature lock: numbered after the highest D-n, the
  existing bytes never rewritten (a BOM and CRLF kept — the entry follows the file's line ends; a code fence left open at
  the end is closed first, by appending its closer — the entry was written unreadable and its D-n handed out again; since 1.23
  review 5 this is `appendSpecText()` (decisions.js), THE append of every spec writer: spec_add_track's design sections and task
  block, the covered sections a track removal restores (`restoreCoveredSections`) and the importer's design body + track blocks —
  their `opts.trim` join; add_track's sections landed inside an open fence, read 'missing', and a re-add wrote them twice.
  `appendTasks` (tasks.js) does not use it yet); title ≤ 200 and texts ≤
  20 000 characters. `_Affects:_` is validated when written (an AC defined in requirements.md, a T-ID planned in
  test-plan.md, an EC/NFR/SC ID written in requirements.md, anything else a design.md section heading — bug.md /
  design.md for a bugfix, spike.md for a spike; unknown → error `unknownAffects`, nothing written). **A heading holding "," /
  ";"** (1.22 review — the size-S "Decisions, reuse & risks" and its PT / ES twins, "[API] Pagination, Idempotency &
  Concurrency"): the value is split OUTSIDE backtick-quoted spans (`affectPieces()` / `splitRefs()`), the entry writes such a
  reference `quoted` (`quoteRef`), and a piece that names nothing is joined with the ones after it (at most
  `AFFECTS_JOIN_MAX`, the longest first) when together they name something — `affectsRefs()` over the value's own separators
  for spec_decide (the unquoted CLI `--affects "Decisions, reuse & risks"`), `entryRefs()` with ", " for a logged entry
  (trace's phantomAffects, doctor's decision-affects-approved). `_Supersedes:_ D-n`
  must name existing entries; a superseded entry is retired (the brief and `decision-affects-approved` skip it, the catalog
  marks it). Readers: the brief (bounded), finish's merge summary, spec_export, spec_catalog (count + titles),
  trace_check (`phantomAffects`, warnings — never a gap), doctor (`decision-affects`, and `decision-affects-approved` for
  a current decision recorded AFTER the approval of the requirements / design it names).
- **Spike kind** (`kind: "spike"`, `question`, `timebox` `YYYY-MM-DD` | `3d`): spike.md (Question · Timebox · Options
  considered · Evidence · Decision + `_Outcome: go | no-go | pivot_` · Follow-up — localized headings matched by
  `SPIKE_SYN`; `_Outcome:_` also reads the PT/ES words and yes/no) + investigation tasks; core-only; `gateWalk`,
  `pendingGateList` and `chainArtifacts` are empty for it, approve refuses every phase but the execution sign-off and
  add_track refuses it. Own doctor (`spikeDoctor`: question; decision — FAIL until written, prose outside the brackets,
  the `_Outcome:_` line alone is no rationale —; timebox — warn once past with no decision), next_action (question →
  investigate → decide → go: spec the real feature seeded from question + decision and archive the spike · no-go: archive
  · pivot: a new spike), finish (ready once decided and every task ticked — no suite / evidence gates) and detectPhase
  (requirements → tasks-ready → executing → complete). Roadmap (🔬, timebox attention), catalog, export and resources know
  it; the changelog never lists one. Prototype code lives outside `.specs/`.

## Forecasts and cross-feature overlap (1.14)
- **Sizes:** `_Size: XS|S|M|L|XL_` (English-stable; its line or a sub-line, never fenced code) = 1/2/3/5/8 points
  (`SIZE_POINTS`); an unsized task counts as its feature's median sized task, else M.
- **Ticks:** `spec_complete_task` records `.state.json → ticks[n]` = ISO, written BEFORE the tick (`recordTick`; a
  non-object `ticks` is left alone). A task ticked before 1.14 falls back to its first passing evidence run, else the
  record's time (`taskCompletedAt`); a box ticked by hand has no time and is not counted.
- **Velocity** = points per WORKING day (Mon–Fri, UTC days) over the last `FORECAST_WINDOW_DAYS` = 28 calendar days,
  counted from the day of the window's first completion through today — project-wide, and per feature once it has
  `FORECAST_MIN_TASKS` = 3 completions of its own in the window. **The project rate counts the ARCHIVED features' completions
  too (1.24 r6 G3, `archivedCompletions()`):** their ticks happened — archiving a feature shipped this week wiped the velocity
  (roadmap, spec_metrics) and turned every other feature's ETA into `not-enough-data`. An archived folder whose mtime is older
  than the window (archiving writes its .state.json there, after every tick) is skipped unread; with `opts.now` fixed (tests)
  every archived folder is read. **ETA** = open points ÷ velocity, in working days from
  today or from the working day after each unfinished dependency's ETA, with a ±`FORECAST_SPREAD` (25%) range (low/high
  chain off the dependencies' low/high). No ETA → `eta: null` + a stable `reason`: `not-enough-data` (< 3 completions in
  the window) · `no-tasks` · `dependency` · `cycle` · `done`. Surfaces: `spec_roadmap` (`velocity`, each feature's
  `forecast`), the ROADMAP.md / .html ETA column ('—' without one) + velocity line, `spec_metrics.velocity`, the CLI
  roadmap. Pure reads of tasks.md + .state.json.
- **Every dependency cycle (1.24 r6 G6).** `findCycles()` (state.js — Tarjan's strongly connected components, iterative; a
  component of more than one feature, or one naming itself) → `{members, path}`; roadmap() returns `cycles` (each one's path,
  `a → b → a`, the shortest through the component's first feature) and `cycle` = the first (as before). ROADMAP.md / .html write
  one "Circular dependency" line per cycle, the CLI roadmap names the first in its head line and the others in
  `roadmapTailLines`. `forecastData()` computes the components itself from the features' dependsOn: every member gets reason
  `cycle` — only `findCycle`'s first cycle used to (a → a hid b ↔ c), and a member the walk met second was overwritten with
  `dependency`. `findCycle` stays the refusal's check (spec_depend, restore). **A dependency done but not signed off**
  (review 6 G-I6) needs nothing: every task ticked IS phase `complete` (100%, detectPhase — the execution sign-off is finish's
  business), so its dependents are unblocked and chain their ETA from today (a test pins it).
- **Overlaps** (`featureOverlaps()`): two ACTIVE features whose OPEN tasks plan the same files (`implementsKey`; a folder
  covers the files under it, a glob what it matches and its literal folder), or an active feature planning a file a
  FINISHED feature recorded in its drift baseline. Not an overlap: features ordered by a dependency (either way,
  transitively — a finished pair included) or one declaring `_Supersedes:_` of the other's criteria. Bounded (`OVERLAP_MAX_KEYS` 500,
  `OVERLAP_MAX_GLOB_CHECKS`, `OVERLAP_MAX_PAIRS` 50), text reads only — nothing hashed, since SessionStart runs it.
  Surfaces: ROADMAP.md "Needs attention" (each pair once), doctor warn `cross-feature-overlap` (fix with spec_depend or
  `_Supersedes:_`), one SessionStart line. Doctor runs `featureOverlaps(…, {only})` (a whole roadmap() walk) only when an
  OPEN active task of the feature has an `_Implements:_` — a pair needs one on its active side (1.22 review, a 30 features ×
  40 tasks project, a feature with none: doctor 236 → 64 ms, next_action 336 → 96 ms, spec_finish 257 → 75 ms); the answer is
  the walk's.

## Roadmap files and dependencies (from Conventions & gotchas)
- **Generated roadmap files carry the `AUTO-GENERATED by dev-spec` marker (EN/PT/ES, `RE_AUTOGEN`)**.
  `writeRoadmapMd/Html` skip a same-named file without it — the hooks run in every project; `spec_roadmap`
  returns a refused ROADMAP.md write as an error (a kept hand-written ROADMAP.html is a warning). The
  roadmap chrome language is `meta.roadmapLang`; `meta.lang` is the project language and only `spec_init`
  sets it. The other generated files — `SPECS.md`, `UPGRADE.md`, `RELEASE-NOTES.md`, `.specs/exports/*` — use the same
  marker family and `isGeneratedOrAbsent()`: a hand-written file of that name is never overwritten.
  **A broken roadmap.json (1.23 review 5)** — one that doesn't parse or has the wrong shape (`roadmapError()`) — is read by
  everyone as its sanitized copy; rendered from it, ROADMAP.md lost every dependency, backlog item and milestone while `roadmap
  --write` exited 0. `writeRoadmapFile()` now refuses (`broken: true`, `err.roadmapNotWritten` after the roadmap.json error) and
  keeps the last good file; `roadmapReport {write}` is then an error (MCP isError, CLI exit 1 — ROADMAP.html's refusal is not
  repeated), its read-only view a warning (`err.roadmapViewPartial`), and `maybeRefreshRoadmap` skips both files.
- **`spec_depend`**: `dependsOn` REPLACES the list (`[]` / CLI `--clear` clears), `add`/`remove` (CLI
  `--add`/`--rm`, repeatable) edit it, `name` alone is a read (a bare `dev-spec depend <f>` used to clear the
  deps). Every dependency must be an existing feature.
- **Roadmap files are generated, never hand-edited.** Default is **`ROADMAP.md`** (git-friendly,
  keeps the Mermaid graph); `ROADMAP.html` is opt-in (`html:true`, self-contained, zero-dep, brand
  palette + system-default light/dark toggle). `roadmapData()` is the shared computation;
  `renderRoadmapMd`/`renderRoadmapHtml` (both take `lang`) build the output; `ROADMAP_I18N` holds
  EN/PT/ES chrome; `meta.roadmapLang` (else `meta.lang`) in `roadmap.json` persists the language for auto-refresh.
  `maybeRefreshRoadmap` (in every mutator) writes MD always + HTML if it exists + SPECS.md if it exists —
  best-effort. **The refresh's cost (1.22 review):** every tick recomputed every feature's row (30 features × 40 tasks: 313
  ms a tick against 13.8 without the refresh). `roadmapRow()` results are cached IN PROCESS (`ROW_CACHE`, ≤ 500 — the MCP
  server; a one-shot CLI / hook never calls twice, so the first `roadmapData` of a process signs nothing), keyed on every
  input the row reads: each entry of the feature folder (size, mtime, ctime, inode; `.history/` one level down; `.execution/`,
  the lock and temp files skipped), roadmap.json and the steering / templates / tracks folders (two levels), the row's
  `f` and its overlaps. git's racy rule: a file stamped within `ROW_OPTS.racyMs` (3 s) of now is never trusted (a coarse
  clock can give two same-size writes one stamp), and a spike's row or one with a waiver (date-dependent) is never stored.
  The marker readers are memoized by text (`taskMarkerSpans` by line — frozen, shared; `taskMarkers` by the block's prose —
  copies; bounded). Measured on 30 × 40, in process: a tick with its refresh ~185 → ~65 ms (no refresh: ~10), roadmapData
  ~180 → ~58; a one-shot `done` / tasks.md save ~470 → ~440. mcp/tests/08-tasks.js renders ROADMAP.md after each kind of
  change from the cache and fresh and compares them byte for byte. The PostToolUse hook does the same for hand-edits, skipping when the changed file IS a
  `ROADMAP.*`. HTML must stay **offline** — no CDN/external URLs (test asserts it). Backlog lives in
  `roadmap.json` `backlog: [{name,note}]`; `spec_create` (and restore, and a rename onto that name — 1.24 r6) drops the backlog item with the same slug. Name and note are one
  line (`flatText()` on add and when rendered — a line break became a heading in ROADMAP.md); a name an ACTIVE feature
  already holds is refused (`backlogIsFeature`); `remove` is an alias of `rm` on every surface (`BACKLOG_ACTIONS`).
- **What reaches ROADMAP.* from roadmap.json (1.23 review 5).** `dependsOn` is only shape-checked (a list of strings): the
  Mermaid graph draws edges between EXISTING features only, node ids prefixed (`mid()` → `f_<slug>` — a slug `end`, `graph` or
  `subgraph` is a flowchart keyword that broke the graph) and labels without a raw quote (`mlabel`); every other place shows a
  dependency through `depShown()` (a slug as it is; anything else quoted, one line, without `< > \` |`). A dependency no active
  feature answers to (stale or hand-edited) is a "Needs attention" line (`depend.roadmapStale`) with the command that sets the
  list again from the deps that exist (`depend <f> <deps…>`, `--clear` when none — `--rm` can't name an entry holding a space);
  it still counts as unmet. A row's next task is read through `readContained` (a tasks.md linked outside `.specs/` reads as
  absent — its lines were copied into the committed file) and every display truncation (the next-task cell's 42 / 60 units,
  UPGRADE.md's details, the release notes' one-liners) goes through `cutText()` — never half a surrogate pair (an emoji cut at
  the boundary wrote U+FFFD). `spec_import` refreshes the roadmap once, after its files (`createFeature(…, { refresh: false })`).
  **What a refresh costs, measured (1.23.1, Windows 11, 86 features):** ~400 ms — one import, one create, one `roadmap --write`
  alike — and it is the four reads per feature (.state.json, tasks.md, requirements.md, design.md), each ONCE per call already
  (the facade's read-cache scope: 381 opens, no file twice); ~1 ms an open on Windows, the scan itself ~60 ms. Going below would
  need a cache that outlives the call (keyed by mtime / size in the long-lived MCP server) — not done on purpose: a file
  rewritten in the same tick with the same size would read stale, and these are the files approvals fingerprint.
