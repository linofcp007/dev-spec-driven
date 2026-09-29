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
  only). `spec_drift` hashes only those files (never walks the tree); a baselined feature with open tasks is
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
  `attention` codes, history skip `reason`s. `lines` (and UPGRADE.md) are rendered in the PROJECT language by
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
  the end is closed first, by appending its closer — the entry was written unreadable and its D-n handed out again); title ≤ 200 and texts ≤
  20 000 characters. `_Affects:_` is validated when written (an AC defined in requirements.md, a T-ID planned in
  test-plan.md, an EC/NFR/SC ID written in requirements.md, anything else a design.md section heading — bug.md /
  design.md for a bugfix, spike.md for a spike; unknown → error `unknownAffects`, nothing written) and `_Supersedes:_ D-n`
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
  `FORECAST_MIN_TASKS` = 3 completions of its own in the window. **ETA** = open points ÷ velocity, in working days from
  today or from the working day after each unfinished dependency's ETA, with a ±`FORECAST_SPREAD` (25%) range (low/high
  chain off the dependencies' low/high). No ETA → `eta: null` + a stable `reason`: `not-enough-data` (< 3 completions in
  the window) · `no-tasks` · `dependency` · `cycle` · `done`. Surfaces: `spec_roadmap` (`velocity`, each feature's
  `forecast`), the ROADMAP.md / .html ETA column ('—' without one) + velocity line, `spec_metrics.velocity`, the CLI
  roadmap. Pure reads of tasks.md + .state.json.
- **Overlaps** (`featureOverlaps()`): two ACTIVE features whose OPEN tasks plan the same files (`implementsKey`; a folder
  covers the files under it, a glob what it matches and its literal folder), or an active feature planning a file a
  FINISHED feature recorded in its drift baseline. Not an overlap: features ordered by a dependency (either way,
  transitively — a finished pair included) or one declaring `_Supersedes:_` of the other's criteria. Bounded (`OVERLAP_MAX_KEYS` 500,
  `OVERLAP_MAX_GLOB_CHECKS`, `OVERLAP_MAX_PAIRS` 50), text reads only — nothing hashed, since SessionStart runs it.
  Surfaces: ROADMAP.md "Needs attention" (each pair once), doctor warn `cross-feature-overlap` (fix with spec_depend or
  `_Supersedes:_`), one SessionStart line.

## Roadmap files and dependencies (from Conventions & gotchas)
- **Generated roadmap files carry the `AUTO-GENERATED by dev-spec` marker (EN/PT/ES, `RE_AUTOGEN`)**.
  `writeRoadmapMd/Html` skip a same-named file without it — the hooks run in every project; `spec_roadmap`
  returns a refused ROADMAP.md write as an error (a kept hand-written ROADMAP.html is a warning). The
  roadmap chrome language is `meta.roadmapLang`; `meta.lang` is the project language and only `spec_init`
  sets it. The other generated files — `SPECS.md`, `UPGRADE.md`, `RELEASE-NOTES.md`, `.specs/exports/*` — use the same
  marker family and `isGeneratedOrAbsent()`: a hand-written file of that name is never overwritten.
- **`spec_depend`**: `dependsOn` REPLACES the list (`[]` / CLI `--clear` clears), `add`/`remove` (CLI
  `--add`/`--rm`, repeatable) edit it, `name` alone is a read (a bare `dev-spec depend <f>` used to clear the
  deps). Every dependency must be an existing feature.
- **Roadmap files are generated, never hand-edited.** Default is **`ROADMAP.md`** (git-friendly,
  keeps the Mermaid graph); `ROADMAP.html` is opt-in (`html:true`, self-contained, zero-dep, brand
  palette + system-default light/dark toggle). `roadmapData()` is the shared computation;
  `renderRoadmapMd`/`renderRoadmapHtml` (both take `lang`) build the output; `ROADMAP_I18N` holds
  EN/PT/ES chrome; `meta.roadmapLang` (else `meta.lang`) in `roadmap.json` persists the language for auto-refresh.
  `maybeRefreshRoadmap` (in every mutator) writes MD always + HTML if it exists + SPECS.md if it exists —
  best-effort. The PostToolUse hook does the same for hand-edits, skipping when the changed file IS a
  `ROADMAP.*`. HTML must stay **offline** — no CDN/external URLs (test asserts it). Backlog lives in
  `roadmap.json` `backlog: [{name,note}]`; `spec_create` drops the backlog item with the same slug. Name and note are one
  line (`flatText()` on add and when rendered — a line break became a heading in ROADMAP.md); a name an ACTIVE feature
  already holds is refused (`backlogIsFeature`); `remove` is an alias of `rm` on every surface (`BACKLOG_ACTIONS`).
