# Conventions & gotchas — feature folders, state, locks, process I/O, the CLI

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
The cross-cutting rules. The other gotchas live with their area (the topic map in CLAUDE.md names them); the hooks.json
and U+FEFF gotchas are in CLAUDE.md.

## Conventions & gotchas
- **Every name-taking op resolves its folder through `resolveFeature()` / `existingFeature()`** —
  never `path.join(specsRoot, slugify(name))`. An empty slug (non-Latin names, `...`, `undefined`)
  used to resolve to `.specs/` itself, so `spec_feature remove` deleted every spec (the v1.11
  Critical). The resolver also rejects the reserved slugs (`steering`; since 1.14 `templates` / `exports` too, since 1.15
  `tracks`, each with the pre-existing-feature exception — see Project templates) and Windows device names (`nul`, `con`, `com1`…),
  transliterates accents (`Autenticação` → `autenticacao`) and falls back to the pre-1.11 slug
  (`autentica-o`) so old folders are still found. `slugify(undefined)` is `""`, never `"undefined"`.
  `listFeatures` skips dot-folders and non-slug folders (reported as `ignored`).
  **spec_create on an existing folder (1.23 review 5)** is a re-run (idempotent: create-only writes) and now says so: `existed:
  true` + `createExisted` (unless tracks were added — `tracks.addedOnCreate` says it), `createSummaryKept` when a summary it did
  not write was given. A slug keeps the first 64 characters of `slugifyFull(name)`: a long name that reaches an EXISTING
  feature whose title (`specTitle` of requirements.md / spike.md / bug.md) is another long name is refused (`slugTaken`,
  `err.slugTaken` — it names the slug, by which that feature stays reachable); it used to answer ok and drop the new summary.
  The name is written as ONE line wherever it lands (titles, `{{name}}` — `flatText`; createFeature, applyTracks, the
  importer) and inert to HTML comments (1.24 r6 G4 — `specNameText`, state.js: `<!--` / `-->` → `&lt;!--` / `--&gt;`; "Login <!-- v2"
  opened a comment in every title that hid the scaffold's criteria — the slug is the name's, as before). **Never through a link:** `linkedSpecsFolder()` (scaffold.js, over `specsWriteContained`) refuses spec_init /
  steering_scaffold through a linked `.specs/steering/`, and spec_create / add_track through a linked `.specs/<feature>/`
  (or its steering, when a track brings a steering file) — `linked: true`, `err.specsLinked`, nothing written (spec_export and
  templates init already refused); the export's Tasks table and the roadmap row read tasks.md through `readContained`.
- **The write gate (1.24 r6 — ONE gate for everything under .specs/).** `specsWriteGate(target, {dir, createOnly})`
  (engine/files.js) runs first in every engine writer — `writeFileAtomic`, `writeIfAbsent`, `ensureDir` and `specWrite` (the
  append: `{append: true}` opens with O_APPEND | O_CREAT | O_NOFOLLOW where the platform has it, the target lstat'ed first) — and
  `withLockFile` checks its lock's path the same way BEFORE the lock exists. No other mcp/lib source writes with a raw fs call
  (mcp/tests/16-conventions.js guards it: writeFileSync / appendFileSync / renameSync / mkdirSync / copyFileSync / cpSync /
  symlinkSync / linkSync / writeSync / an openSync with a write flag — files.js alone is allowed). The gate finds the `.specs`
  folder a path lies in (`specsRootOf`: the nearest ancestor of that name — a path outside every .specs/ is not gated; the
  engine writes nothing there) and refuses (`specsWriteBlock`, lstat of each part below .specs/ + one realpath of the deepest
  that exists): **a link on the way** — a folder between .specs/ and the target (a feature folder, `.execution/`, `.history/`,
  `_archive/`, `_archive/<slug>/`) or the target itself that is a symbolic link / junction, or that resolves outside the real
  .specs/ (another reparse point; a part GONE between its lstat and that realpath — a lock another process released meanwhile — is
  judged by its folder, as an absent part is: its waiter was refused as "a link", and one of two racing backlog adds was lost
  now and then — mcp/tests/12-lifecycle-review6.js); **the wrong kind** — a file where a folder is needed (.specs itself, a feature path,
  `_archive`), a folder where a file is written (ROADMAP.md, an export). .specs/ itself may be a link (a project keeping its specs
  elsewhere): what is checked lies below it. A create-only write (`createOnly`) passes an existing target that is itself a link —
  "wx" never writes through it. The refusal is an Error (`code` ESPECSLINK / ESPECSKIND, `gate` {kind, rel, file}, the message in
  the project's language: `err.specsLinked` (a folder) · `specsLinkedFile` · `specsNotFolder` · `specsNotFile`); **the facade
  answers it** (spec.js's wrapper, `gateRefusal`) as the call's result — `{ok: false, linked | wrongKind: true, path, error}` —
  on every surface alike (MCP isError, CLI exit 1 with one line; it was a raw EEXIST / ENOTDIR / EISDIR, a stack on the CLI). The
  feature mutators meet it up front: their lock is the first write into the folder, so `featureLocked` / `withMoveLock` refuse a
  linked feature folder (or `_archive/<slug>`) once, before anything is written, in the feature's language (`onRefused`; a
  path of the wrong kind at the lock is the lock's own business — a folder named .lock is a stuck lock). Best-effort writers
  swallow it like any other failure: `.specs/.gitignore` linked is left alone, observed.jsonl linked logs nothing, a linked
  ROADMAP.md is not refreshed. **Why:** a committed `.specs/<feature> -> ~/elsewhere` got every tick, approval, brief,
  decision, retro.md and the lock written into the folder it points at; `.execution/merge-summary.md -> ~/.bashrc` got the
  merge summary (spec text) written into the user's shell profile (the in-place `fs.writeFileSync` of the derived files and
  the appends followed file links; `writeFileAtomic`'s rename replaced a file link but wrote through a folder link). Known
  limit: a write after another in one call can still be refused (a tasks.md that is itself a link: `done` records its
  evidence in .state.json, then the tick is refused) — nothing is ever written THROUGH a link. Removals go through it too:
  `removeSpecFile` (a link AT the path is unlinked as the link) and (1.25) `removeEmptySpecDir` — an EMPTY folder only, never
  one that is a link (rmdir would drop a Windows junction), false on any refusal (the ADR export's emptied folders).
- **The dry-run sink (1.25 — `withDryRun(fn)`, engine/files.js).** Because every write goes through the primitives above, a dry
  run is ONE switch there: while `CTX.DRY_RUN` is set, `writeFileAtomic` / `writeIfAbsent` / `ensureDir` / `specWrite` /
  `removeSpecFile` record what they would write (`dryPut`: the text, in its first write's place; a folder; a removal) instead of
  touching the disk — after the gate, so a dry run meets the real refusals — and the readers `readRaw` (readIfExists, readJson),
  `existsRaw` (existsCached), `readDirCached`, `safeReaddir` and `isDirSafe` see those records over the disk (`dryEntry` /
  `dryListing`), so the operation reads back what it "wrote" and computes exactly what the real call would. `withLockFile`
  runs fn without a lock (no lock file), `ensureLockIgnore` returns at once (its raw writes would bypass the sink), and a
  folder move, a link's removal or an emptied folder's removal (`removeEmptySpecDir`) — which have no record — throws `EDRYRUN` (`dryRunRefused`). Nothing reaches the disk BY
  CONSTRUCTION (the raw-write source guard keeps it true). Its only caller is `spec_import {dryRun}` (import/index.js
  `importSpec` → `dryRunResult`, which also skips the roadmap refresh: `isDryRun()`); the sink lives in CTX (cleared by
  withDryRun itself, never by withReadCache). A reader outside files.js that reads with a raw fs call does NOT see the sink —
  an operation made dry-runnable must read what it wrote through these readers (the import's parity test compares every
  previewed file with the real import's).
- **The project folder: `resolveProjectDir()` (files.js) — every surface's default.** The explicit argument (CLI `--project`, a
  tool's `projectDir`) > `SPEC_PROJECT_DIR` > `CLAUDE_PROJECT_DIR` > **the nearest folder at or above the working folder that
  holds a dev-spec .specs/** (`nearestProject()`: `isDevSpecDir` — roadmap.json, steering/ or a feature's .state.json — the
  working folder itself also with any `.specs/`, one made by hand before init; never walked up a network path; at most 64
  levels; 1.23 review: run from a subfolder, `create` / `backlog add` started a SECOND, nested .specs/ there) > the working
  folder. A value holding a variable left unexpanded — any `${`, a leading `$NAME`, a `%NAME%` (`unexpandedVar()`) — is
  unusable and falls through (1.23 review: `SPEC_PROJECT_DIR="${CLAUDE_PROJECT_DIR}/"`, `$CLAUDE_PROJECT_DIR` or
  `%CLAUDE_PROJECT_DIR%` created that literal folder; only a whole `${VAR}` was caught). A separate project INSIDE another one
  needs `--project .` (or its own `.specs/` first — an empty one is enough). The CLI validates `--project` itself (below), the
  MCP server a tool's `projectDir` by the same rule (1.24 r6 — an existing folder, only spec_init creates one: mcp.md → Argument
  validation); a
  PATH argument (`scan <path>`, `ears <file>`, `import <tool> <path>`) is read from the project when it was NAMED (`--project`
  or the env — as import always read it), else from the working folder (`argPath()`: a path typed in a subfolder is relative
  to it, as in git; import hands the engine that path relative to the project, which still refuses one outside it), and
  `scan <subfolder>` reports in the project's language (`scanCodebase {lang}`). `ears <word>`: a file → linted; else a word
  that reads as a path (a separator, or a `.md` / `.markdown` / `.txt` name) and names no feature is `cliOutput.earsNoFile`
  (1.24 r6 B9 — `ears missing.md` answered "Feature 'missing-md' not found"); anything else is a feature name.
- **`spec_feature remove` needs `confirm: true`** (CLI `--yes`). Without it nothing is deleted and the
  result (an error with `needsConfirm`) lists what would be — `removePreview()` checks roadmap.json first
  and uses `lstat` (a symlink/junction is one entry, never followed). Prefer archive (reversible). **A feature folder that is
  itself a link (1.24 r6)** is removed as the link alone (`removeLinkEntry` — unlink, rmdir as the fallback; the target and its
  files are kept): the preview says so (`link: true`, `wouldDelete.files` 0, `featureOps.removeNeedsConfirmLink`) and the remove
  runs under the roadmap lock only — the feature lock would be created THROUGH the link (it was: a `.lock` left in the target);
  every other mutator of a linked feature folder is refused (the write gate, above).
- **Rename follows every reference** (`renamePlan`, computed BEFORE the folder moves so the old slug still resolves,
  written after): roadmap.json dependsOn, `_Supersedes: <old>/…_` markers in other features' requirements.md (active
  and archived; never one in a comment/fence), and archived features' `.state.json → archived` records. A broken
  archived state file that names the old slug refuses the rename. A backlog item named like the NEW slug is dropped
  (`pruneBacklog`, as create and restore do — 1.24 r6 G5: it was listed under Features and Backlog) → `removedFromBacklog`.
- **A change's requirements.md / tasks.md are its change.md (1.21 F5).** `readIfExists`, `existsCached`, `readContained`
  and `writeFileAtomic` alias a missing `requirements.md` / `tasks.md` to the folder's `change.md` when that folder's
  `.state.json` says `kind: "change"` (`changeAlias()`, files.js; `readRaw` / `existsRaw` are the unaliased readers). A raw
  `fs.existsSync` / `fs.statSync` of those names does NOT alias — kind-aware code names the file through
  `phaseFile("tasks", "change")`. Never create a `tasks.md` in a change folder (it would win over change.md).
- **JSON state is read with `readJson()` and written atomically (`writeFileAtomic`)**. A
  `roadmap.json` / `.state.json` that exists but doesn't parse is an ERROR every mutator returns
  (`roadmapError()`, `state.invalid`) — never "repaired" into `{}` (that erased deps, backlog,
  approvals and `meta.lang`). **Valid JSON of the wrong shape is refused the same way:** `readState()` checks
  the top level, `approvals`/`evidence`/`finishChecks`/`signoffs` (objects), `tracks`/`approvalHistory`/`changes`/`unticks` (lists);
  `loadRoadmap()` checks `features` and each entry, `dependsOn` (string lists), `meta`, `backlog`. Readers get
  a sanitized copy; every mutator refuses BEFORE its destructive step — and the readers SAY it (r5 review): doctor fails
  `state`, next_action's one step is `fix` (`stateInvalid`), spec_finish blocks on `state`, the status line says repair
  (gates-and-approvals.md → next_action) — read as empty, every gate looked pending and next_action said "approve". A leading BOM is tolerated.
  `writeIfAbsent` uses `flag:"wx"`. `writeFileAtomic`'s temp file never outlives the call: when the rename and the
  plain-write fallback both fail (read-only / locked target on Windows, a folder at that path) it is removed before
  the error is thrown — the best-effort refreshes swallow that error, and used to leave a `<file>.<pid>.<ts>.tmp`
  in `.specs/` per call. On Windows an EPERM/EACCES/EBUSY rename is retried briefly (a scanner's lock). tasks.md
  ticks go through it too (a reader never sees a truncated tasks.md).
- **Merging the spec state across branches (1.21 F1a) — git's merge driver.** Two branches that both approve, tick or record
  evidence used to conflict in `.state.json` / `roadmap.json` (a text merge can't unite two JSON lists). `dev-spec merge-state
  <base> <ours> <theirs> [<path>]` is git's `%O %A %B %P` driver: `mergeStateText()` (state.js, PURE — no file, no git) parses
  the three texts, `mergeStateJson(base, ours, theirs, kind)` → `{kind, merged, conflicts}` merges, and the result is written to
  `<ours>` in ours' own form (BOM, CRLF, final newline). The rules: a key only one side changed takes that side (a deletion too);
  append-only lists (`approvalHistory`, `changes`, `unticks`) → the union by identity (`HISTORY_ID` phase/at/by/revoked/partial/role
  · `CHANGE_ID` · `UNTICK_ID`; the same record with different fields — upgrade's seeded snapshot — gets both sides' fields),
  chronological once theirs added one; `evidence[n]` / `finishChecks[name]` → the record with the latest run `at` (a tie is the same
  run: its note and stale mark merged; r5 review: tasks sharing the number n — a record's `task` stamp — keep every other
  task's record in `others`, both sides' plus the losing side's own one, one per task, newest first, `EVIDENCE_OTHERS` —
  they were dropped, and that task's runs merged into the winner's history), histories merged, deduped, bounded by `EVIDENCE_HISTORY` (a run's own fields — `observed`,
  1.22 review 3's `cmdRule` and `root` — travel with it: no rule of their own); `ticks[n]` / `lastTickAt` / `lastEditAt` (1.22 review: the spec-hook's stamp of a hand-saved tasks.md) → the
  later; `finished` → the later (firstAt the earliest); `createdAt` → the earlier; `branch` (1.25 — create --branch) → the EARLIER
  record by its `at` (where the feature started first; a record without a time reads as the later; the same time: one name → one
  record, ours' fields over theirs', two names → a conflict); `approvals[phase]` → the later approval unless
  a revocation record (`revoked: true`, not `partial`) is later — **revocations win by time**, applied to the 3-way RESULT
  (`pruneRevokedApprovals()`, r5 review: when only one side changed `approvals`, an approval older than the other side's
  revocation survived); `signoffs[phase][role]` → the later,
  dropped when a revocation or the phase's merged approval is no earlier (a partial revocation flagged `roleOnly` — r5
  review, one role withdrawing its own sign-off — drops only the roles it names; one without the flag, all of them); `lastApprovedPhase` follows the merged approvals (never its
  own 3-way); `tracks` and every `dependsOn` / role list / milestone `features` → a 3-way SET merge; roadmap.json `features` (by
  slug), `backlog` (by name, case-insensitive; notes joined with ` · `), `meta.milestones` (by name), `meta.checks` /
  `meta.approvalRoles` (by key); `meta.specVersion` → the higher (`compareSemver`), `meta.changelogAt` → the later,
  `meta.evidenceSince` → the earlier; a keyed entry one side deleted and the other changed → the changed one. **Anything else both
  sides changed differently** (a meta scalar — `lang`, `approvalGuard` —, an unknown key, delete-vs-modify of a plain key) is a real
  conflict: ours kept there, `{path, base?, ours?, theirs?}` reported (a missing side deleted the key), and written INTO the file as
  a top-level `mergeConflicts` list — the file stays valid JSON, the driver exits 1 (git marks it conflicted, stderr lists each
  path), and doctor fails `merge-conflicts` (`mergeConflictsCheck()`, feature + roadmap, both doctors) until someone picks the values
  and deletes the list. **Two post-passes on the RESULT (1.24 review 6):** (E2) a change request reopening task n
  (`changes[].reopened`) or an untick of n (`unticks[]`) that only ONE side recorded never reached the other side's evidence — that
  branch's run of the task made BEFORE it won as the later run, unmarked, and a re-tick with no new run read verified (finish and
  the execution sign-off passed). `staleMergedEvidence()` marks each merged record of slot n (the latest and its `others`) whose run
  is older than such an event `stale` — `staleBy: "undo"` for an untick; a reopen (the spec changed) wins over an undo — unless the
  side that recorded the event kept that task's own record (its `task` stamp) valid: a task sharing the number the reopen didn't
  reach. A record's time is its run's `at`, or `noteAt` for a task without a _Verify:_ command (its note is the re-check). Events
  both sides hold (the base's) were applied on both. (E5) roadmap.json: dependency edges each side added alone can close a cycle
  together (alpha → beta here, beta → alpha there) — merged clean, every later `depend` was refused on it. `breakMergedCycles()`
  undoes, cycle by cycle, the first edge on it ours doesn't hold: ours kept at that feature's `dependsOn`, reported as a conflict
  (`features.<slug>.dependsOn`, theirs' list — exit 1); a cycle ours' own lists already hold is not the merge's (left as it is).
  `lastApprovedPhase` needs no pass: it follows the merged approvals already (above). An unparseable ours / theirs merges nothing (exit 1, ours untouched). `ROADMAP.md` / `.html` / `SPECS.md`
  (`kind: "generated"`) keep ours when BOTH sides carry the AUTO-GENERATED marker (the next write regenerates them); a hand-written
  one goes to `git merge-file`. `--install [--project]` (CLI only — the engine never calls git; MCP has no tool: git runs the
  driver) writes the `.gitattributes` block (`mergeAttributes()`, pure, idempotent: a head comment + `MERGE_ATTRIBUTE_LINES`, the
  file's other lines and EOL kept) in the project folder and this clone's git config `merge.dev-spec-state.name` / `.driver` =
  `node '<clone>/cli/dev-spec.js' merge-state %O %A %B %P` (forward slashes, single-quoted: git runs it through sh); `--uninstall`
  removes both (an emptied .gitattributes is deleted). Without `--install` in a clone, git falls back to its text merge (an
  undefined driver name). **The sign-offs' drop rule runs on the 3-way RESULT** (`pruneSignoffs()`, 1.21 review A1): when only one
  side changed `signoffs`, `mergeThree` hands that side back as it is, so the rule is applied after it too (a stale
  `signoffs.<phase>.<role>` stayed next to the other side's later approval). **The driver never approves anything:** role
  sign-offs of the same content made on two branches (tech on one, product on the other) merge into `signoffs[phase]` holding
  EVERY required role while `approvals[phase]` stays absent — the driver can't read `meta.approvalRoles` (roadmap.json) and an
  approval is a gate run, not a merge. The readers say it instead: `roleGateView()` marks the pending phase `signoffsComplete:
  true` (every required role has a CURRENT sign-off — the content fingerprint — and no approval; the same happens when a role
  is dropped from the config after the others signed), never as missing roles; doctor's approval-gates labels it and adds the
  note (`governance.signoffsComplete`, `/approve <f> <phase> --role <a signed role>`), `nextGate.signoffsComplete`, next_action's
  approve step (and the finished step for `execution`) recommends the re-sign (`governance.completeSignoffs`) with
  `signoffsComplete: true` and no `missingRoles`. Any listed role signing again completes it (`recordRoleSignOff`). A re-merge
  whose `mergeConflicts` list is still unresolved lists each conflict once (deduped by `mergeCanon`, 1.21 review A7).
  **A stale driver path (1.21 review A3).** The git config names the CLI by its absolute path, and a plugin install lives in a
  versioned folder (`plugins/cache/<marketplace>/dev-spec-driven/<version>/`): after an update the path is gone, git reports
  CONFLICT (content), leaves ours without markers or a `mergeConflicts` list, doctor sees nothing and `git add` drops theirs.
  `merge-state --check` (read-only: `git config --get merge.dev-spec-state.driver` + `.gitattributes`, `spec.mergeDriverStatus()`)
  → `status` ok · none · not-installed · other · missing — exit 1 on the last three; `--check` is init's VALUE flag too
  (`init --check name="cmd"`), so it is NOT in `CLI_SWITCHES`: main() turns a bare `merge-state --check` (its missing value) into
  the switch. The SessionStart hook adds ONE line (`mergeState.hookLine`) when `.gitattributes` names the driver and the
  configured one is `missing` / `other` — read as text: `repoGitConfigText()` (the nearest `.git`, a worktree's `.git` FILE →
  gitdir → its `commondir` + `config.worktree`) and `gitConfigGet()` (git's own value syntax: quotes, escapes, comments,
  continuation lines; the last definition wins) — no git process in a hook. teamNote / INSTALL.md / the tooling reference say
  to re-run `merge-state --install` after each plugin update. **Known limits:** two branches that both approve the same phase write `.history/<phase>@<n>.md` under the
  same name — different content is a plain add/add conflict (keep the one `approvals[phase]` names); `decisions.md` entries both
  sides appended conflict as text (and may share a D-n); clock skew between machines decides "later"; the hook reads only the
  repository's own config (a driver set in the global git config is `--check`'s alone).
- **Feature mutators hold a cross-process lock** (`withFeatureLock` / `featureLocked` in the exports):
  `completeTask`, `approvePhase`, `appendTasks`, `addTrack` / `removeTrack`, `impactReport` with `reopen`,
  `finishFeature` with `write` or `evidence` (finishChecks), `decide`, `manageFeature`'s `flow`, `taskBrief` / `metrics` with `write` (a derived file written into the feature folder is a
  write: resolved before a rename and written after it, the brief recreated a zombie `.specs/<old>/.execution/`), and
  `createFeature` re-run on an EXISTING feature (it adds tracks through
  `applyTracks`, spec_add_track's path — a NEW feature has no folder to lock). Two MCP servers (or MCP + `dev-spec done`)
  on one feature each read tasks.md + `.state.json`, wrote the whole file back and the last writer won — ticks and
  evidence were lost while both answered ok. The lock is `.specs/<feature>/.lock` (holds `{pid, host, at, token}`; created by
  `acquireLockFile()`: the note is written to a temp file hard-linked into place — `linkSync` fails with EEXIST like O_EXCL —
  so the lock never exists without its note; where hard links are unsupported it falls back to the O_EXCL create + write, and
  `staleLock()` treats a noteless lock older than `LOCK_NOTELESS_STALE_MS` (5 s) as stale — a process killed in the old
  create→write window left an EMPTY lock that blocked the feature for 2 min), re-entrant in one process; waiters retry for `DEV_SPEC_LOCK_WAIT_MS` (default 10 s), then get
  `{ok:false, busy:true, error}` (`err.featureBusy`, localized) with nothing changed. A lock taken while this process already
  holds another (`LOCK_DEADLINE`: a folder move's roadmap lock inside its feature lock) waits only for the outer acquisition's
  remaining budget, at least `LOCK_NESTED_MIN_MS` — nested waits could add up to twice the wait. A dead holder's lock (same host)
  is reclaimed at once, any other after 2 min (10 min while its pid still runs). r5 review: a note naming THIS pid and host
  on a lock older than this process (`PROCESS_START_MS` — a recycled pid, a container's pid 1 with a fixed hostname) is
  reclaimed at once (one written since may be another engine instance or worker of this process: respected, as before); the
  age of a lock dated in the future (another machine's clock) counts too (`Math.abs`). A lock create refused with
  EPERM / EACCES / EBUSY AFTER the note's temp file was written (Windows: a lock being deleted, a scanner's handle on it) is
  waited for like a held lock — busy at the deadline; it ran UNLOCKED after 10 refusals. Only a folder that refuses the temp
  file itself (`readOnly`: read-only, EROFS) still runs unlocked after 10 tries. **Mutual exclusion rules** (each one
  lost updates under contention while every call answered ok): a lock that can't be stat'ed is NEVER stale (it was
  just released — retry the create); a stale lock is removed only by `reclaimStaleLock()` — under `<lock>.reclaim`
  (O_EXCL) and only while the file is still the one judged stale (`lockSnapshot`: note + ino/mtime/size), so a
  waiter can't delete the NEXT holder's fresh lock; a holder releases only the lock carrying ITS token
  (`releaseLock`, also after a folder move). A stale lock that can't be removed (a handle without delete sharing, a
  read-only folder, a directory named `.lock`) waits like a held one and ends in `{busy, stuck: true}`
  (`err.lockStuck`, "delete it by hand") — never a `continue` that skips the deadline and the sleep (it spun at 100%
  CPU forever and froze the MCP server). A multi-process counter test guards all of this. Where no lock file can be
  created (read-only folder) the op runs unlocked. **Folder moves** — `manageFeature` rename / archive / remove, and restore
  (on `.specs/_archive/<slug>/.lock`) — run under `withMoveLock`: never while another process holds the lock (it moved
  the folder away mid-write: the writer's next `writeFileAtomic` recreated a zombie `.specs/<old>/`, and ticks landed
  in one folder, the spec in the other); the lock file travels with the folder and is released at the NEW place
  (`releaseLock` with the acquisition's token — left there it kept the renamed feature "busy" while its holder lived). Folders move through
  `moveDirOrBusy()` → `renameDirSync` (Windows EPERM/EACCES/EBUSY retried ~1.4 s — the lock is held — then the localized
  `err.folderInUse`, `{busy, inUse}`; 60 ms of retries answered a raw EPERM under contention). **remove** renames the folder
  to a dot tombstone `.specs/.removing-<slug>-<rand>/` FIRST (its .lock inside) and deletes it there: `fs.rmSync` in place
  deleted the folder's .lock early while the folder still existed, a waiter created a fresh lock in the half-deleted folder
  and wrote into it — the removed feature came back (.state.json, .history/) after an ok remove. Dot folders are never
  features (list / roadmap / catalog / drift skip them, the hook exits for `/.specs/.removing-`); `sweepTombstones()` deletes
  a leftover one older than 60 s on the next remove. **`roadmap.json`** read-modify-writes (depend, backlog add/rm, `pruneBacklog`,
  `pruneRoadmapRefs`, restore, init `--lang`/`--guard`/`--stop-check`/`--check`/`--roles`, roadmap `--lang`, changelog
  `--write`'s `meta.changelogAt`) hold `.specs/.roadmap.lock`
  (`withRoadmapLock`, `err.roadmapBusy`; it forgets only roadmap.json from the read cache). Lock order: a feature lock,
  then the roadmap lock — never the reverse; the ROADMAP.md refresh runs after both are released. Internal calls use
  the unwrapped functions. **The lock files are git-ignored**: `ensureLockIgnore()` keeps `.specs/.gitignore` holding
  `.lock`, `.lock.reclaim`, `.roadmap.lock`, `.roadmap.lock.reclaim`, the temp files a killed process leaves
  (`*.[0-9]*.[0-9]*.tmp` — writeFileAtomic's `<file>.<pid>.<ts>.tmp` and the lock note's) and `.removing-*/` (unanchored — every
  feature folder and `_archive/`),
  called by init, create and `withLockFile` BEFORE the lock is created; an existing file only gains the missing lines
  (its EOL kept), and it never creates `.specs/` itself. A lock leaked by a killed process was committed by `git add -A`
  and made the feature "busy" on every clone (fresh checkout mtime, foreign host → no pid probe).
  **Known limits (documented, not fixed):** pid liveness is probed only when the note's `host` is this machine's hostname —
  two machines (or WSL and Windows) sharing one hostname on a network folder can probe the wrong process table (a live
  holder read as dead → its lock reclaimed; a dead one read as live → the feature waits `LOCK_MAX_HOLD_MS`); give them
  distinct hostnames. `rename` rewrites `_Supersedes:` lines in OTHER features' requirements.md under the renamed feature's
  lock and the roadmap lock only — not those features' own locks (taking them there would break the feature-then-roadmap
  lock order); a concurrent edit of one of those files can lose that one line change.
- **Flush stdout before exiting — on Windows AND Linux pipes.** Hooks read stdin asynchronously (not
  `fs.readFileSync(0)`) and exit only in the write callback. The same holds for the test harnesses (they exit once stdout
  has flushed — on a Linux pipe, docker or `| tee`, writes go async past the 64 KB buffer and the tail, FAIL lines and the
  total, was dropped) and for the MCP server (on stdin close it flushes its queued replies first — a slow reader on Linux
  got 0 of 8; a stdout EPIPE / EOF / ERR_STREAM_DESTROYED exits quietly 0, any other stdout error prints one stderr line
  and exits 1). **The CLI the same (1.24 r6 B2):** `stdoutError()`, installed by main() after the status line's render path
  (which keeps its own exit-0 handler) — a reader that stops early (`export --md | head -1`, a pager quit) ends the output
  quietly with the status the command set (`process.exitCode || 0`: `trace --csv | head` keeps trace's 1); any other stdout
  error is one `dev-spec: <message>` line, exit 1. `console.log` swallows its own write errors, but `process.stdout.write`
  (export, catalog, changelog, rules, trace --csv, prompts) raised an unhandled `'error'` — a stack trace and exit 1.
  Never `process.exit()` right after a write (the CLI's `die()` under `--json` writes its small document with
  `fs.writeSync(1, …)` first). The CLI's stdin (`ears -`, `import <plan> -`, `log <f> -`, `stop-check -`) is collected as
  BYTES and decoded like a file (`readStdin` → `decodeText`: a UTF-16 BOM decides, else UTF-8 — 1.23 review: a UTF-16 document,
  what Windows PowerShell 5.1's `>` writes, read as "0 criteria, pass" in `ears -`); from a terminal (`process.stdin.isTTY`)
  it first prints one stderr line, `cliOutput.stdinHint` — type, then Ctrl+D / Ctrl+Z Enter (1.24 r6 B-I9: it looked hung). The pre-commit validator reads staged
  names NUL-separated with `core.quotePath=false`, so accented paths work, and loads the engine only once a staged
  `requirements.md` / `tasks.md` / `change.md` under a `.specs/` needs it (1.22 review — most commits stage none and paid
  ~130 ms for the require). Only EARS errors and phantom task refs
  block; a requirements.md with EARS warnings or template placeholders (the STAGED text, `featurePlaceholders(…, text)`)
  gets a ⚠ line (`earsWarnings`), never "EARS clean" — the PostToolUse hook's rule.
- **Dates/timestamps**: fine to use `new Date()` in the MCP server and scripts (normal Node
  process). Do NOT assume that in any Workflow-script context.
- **CLI `--lang` is the MCP enum**: `main()` refuses anything outside the MCP `lang` enum (case-folded) with the
  localized `args.invalid` message before dispatch — the engine's `normalizeLang()` would turn `fr` into `en` and save it.
- **CLI exit codes are scriptable**: `doctor` (FAIL), `trace` (gaps), `ears` (errors), `finish` (not ready),
  `drift` (drift, a stale baseline or an error) and any refused operation exit 1 — and (1.25) `create` / `bugfix` / `spike
  --branch` when the feature does not end up on its branch (lifecycle.md → A feature's own git branch: it is created all the same).
  **A value flag whose value is optional** (1.25 — `--branch [<name>]`): the parser reads a bare `--branch` (the last word, or a
  flag after it) as `true` instead of a missing value; it stays a VALUE flag (never in `CLI_SWITCHES` — `--branch <name>` takes the
  next word), and `branchSpaced` remembers a spaced value so `create x --branch tdd` (a track word) is refused as ambiguous. The eval harness
  (`mcp/evals/run-evals.js`, also `dev-spec evals`) exits 2 on a usage error (a `--max-items` that isn't an
  integer ≥ 1 — it graded nothing and scored 0/0 = 100% — or, run directly, a `--json`: its report is text) and 1 on an
  invalid set (an empty one included); `dev-spec evals --json` never reaches the harness — the CLI refuses it first
  (`TEXT_ONLY_COMMANDS`, exit 1, below); `dev-spec evals` exits with the harness's status, and 1 when it has none (a spawn error, a signal — 1.22
  review: `status || 0` passed a killed run). An engine refusal goes through `fail(r)`, never
  `die(r.error)`: with `--json` the whole `{ok: false, error, …}` result (`recorded`, `neverApproved`, `gated`…) is
  the one JSON document on stdout, as MCP returns it. `die()` is for CLI usage/argument errors only — with `--json` (1.23
  review) it prints `{ok: false, error}` on stdout too (written synchronously: `process.exit` follows; the stderr line stays),
  and an engine EXCEPTION (main's catch — a file where `.specs/` goes: ENOTDIR) answers `{ok: false, error, code}` (`code` the
  system error's, else `"exception"`) — it was the raw message on stderr alone; `merge-state --json` prints its result on every
  path (git merge-file's `{merged: "text", clean, conflicts}` for a hand-written overview, `{ok: false, parseError, error}` for
  an unparseable side — both printed nothing). **`--json` on a command
  whose output is text only** — the help (`help`, no command, `--help` anywhere), `rules`, `mcp-config`, `evals`
  (`TEXT_ONLY_COMMANDS`) — is such a usage error (`cliOutput.noJson`, exit 1, nothing on stdout — `die(…, {text: true})`; 1.22
  review — it printed the text with exit 0); `--json=false` is the switch off. A new command that prints no structured result
  joins that list.
- **CLI: each command reads its own options and arguments (1.23 review).** `COMMAND_OPTIONS` (cli/dev-spec.js) lists every
  command's flags and the most positionals it takes (`max`; absent = any number, or the command checks its own: templates,
  export, decide…); `checkCommandArgs()` refuses — before anything runs, after the help — a known flag the command doesn't
  read (`cliOutput.flagNotFor`, its options listed) and an argument past its last one (`extraArgs`): they were ignored —
  `approve <f> <phase> --remove` (meant --revoke) approved, `done <f> 3 4` ticked task 3 alone. `--json`, `--project` and
  `--help` are global (`GLOBAL_OPTIONS`). `backlog` (add takes note words, rm / list don't), `log` (a second word is `-`) and
  `feature` (1.24 r6 B4: remove / archive / restore take the name, rename and flow one more — flow's is its `--flow` or the word,
  never both; `--flow` on another action is refused) check theirs in their case; the contradictory pairs are usage errors too
  (B4): `depend <f> <deps…> --clear`, `merge-state <files…> --install|--uninstall` and both switches together, `stop-check
  --message … <words>`. **A single-value flag given twice (B5)** is refused (`refuseRepeatedFlags()`, `cliOutput.flagTwice`):
  the parser counts each VALUE flag (`flagCount`, both `--k v` and `--k=v`) and kept the last — `approve … --role tech --role
  product` signed for product alone; `REPEATABLE_FLAGS` are the ones a command collects every occurrence of (depend `--add` /
  `--rm`, init `--check`, append-tasks `--req` / `--implements` / `--makes-green` / `--depends`, decide `--affects` /
  `--supersedes` — a new collector joins that list), and append-tasks keeps its own words for `--task` / `--verify` / `--story` /
  `--heading` / `--size`; `--shell` / `--timeout` without `--run` (`needsRun`) and `--run` with `--evidence` / `--exit` /
  `--cmd` (`runOrEvidence`) are usage errors; `undone` takes done's run flags only to refuse them (`undo.noEvidence`). A new
  command or flag gets its `COMMAND_OPTIONS` entry (extending.md). **`--project` (L14)** names an existing folder
  (`checkProject()`): empty, an unexpanded variable (`unexpandedVar`), a file or a missing folder is refused (localized
  `cliOutput.project*`) — `init` alone may create it (`create x --project <typo>` created the whole mistyped tree); on Windows a
  trailing `"` is dropped (`--project "C:\dir\"` reaches node as `C:\dir"`). The status line's render path checks none of this.
  **The environment too (1.24 r6 B1):** `PROJECT_SOURCE` reads resolveProjectDir's precedence in the CLI (files.js keeps its
  signature) — `flag` · `SPEC_PROJECT_DIR` · `CLAUDE_PROJECT_DIR` · `nearest` · `cwd` — and a variable that CHOSE the project is
  checked like `--project`: a missing folder (but for `init`) or a file is refused with the variable named
  (`cliOutput.projectEnvMissing` / `projectEnvNotDir`) — a mistyped `SPEC_PROJECT_DIR` created that tree, a file ended in a raw
  ENOTDIR, and `list` answered "No features". A folder without `.specs/` is fine (CLAUDE_PROJECT_DIR is any folder Claude Code
  opened); an empty or unexpanded value still falls through. **B7:** a dev-spec project's own `.specs/` named as the project
  (`--project <proj>/.specs`, or the variable — `spec.isDevSpecDir(parent)`) is refused naming the parent
  (`cliOutput.projectIsSpecs`): it created `.specs/.specs/`, which then won every walk-up. `version` checks none of this — it reports.
  **`version` / `--version` / `-V` (1.24 r6 B-I1)** — what a bug report needs: `{ok, version, cli, node, engine: {source:
  modules|bundle, bundle: {requested, file?, skipped?: missing|other-version|stale|broken, pathIgnored?}}, project: {dir, source:
  flag|SPEC_PROJECT_DIR|CLAUDE_PROJECT_DIR|nearest|cwd, exists, devSpec, lang}}` (`printVersion()`; human lines
  `cliOutput.version.*`). The engine part is the facade's `spec.engineSource` — `loadEngine()` records where it loaded from and
  why a requested bundle was skipped (the choice itself unchanged and silent). `--version` / `-V` anywhere (as `--help`) print it
  and run nothing — the other command's words and flags are not read (`help --version` stays the help); the `version` command
  takes no option or argument and never refuses its project (a missing one reads `exists: false`).
  **`evals` (P1)** forwards every word of the command line but the command and `--project` (the CLI passes its resolved one) —
  read with run-evals.js's rules (`evalsArgs()`: its value flags `--project` / `--model` / `--prompt` / `--max-items` take the
  next word): only the words after the feature were forwarded, so `evals --dry-run <f>` ran LIVE (paid calls). run-evals.js
  refuses an unknown flag (did-you-mean, exit 2 — `--dryrun` ran live too), a value flag without its value and a second word,
  and prints its usage on `--help` (it ran the eval).
- **Shell completion (1.25): `completion <powershell|bash|zsh|fish>`** prints a script (stdout only — `TEXT_ONLY_COMMANDS`, so
  `--json` is a usage error; it reads no project, so `checkProject()` skips it like `version`: it runs from a shell profile).
  `completionModel()` builds it from the CLI's own tables — every command (`COMMAND_OPTIONS` keys + `help`, `evals`; a test
  checks every `case` label is there), each one's flags (its `COMMAND_OPTIONS` + `GLOBAL_OPTIONS`; evals: run-evals.js's
  switches, `EVALS_SWITCHES`, + `EVALS_VALUE_FLAGS`), the value flags (`VALUE_FLAGS` — the word after one is its value, never
  a positional), **`COMMAND_ARGS`** (a command's positionals: per position words or a source, `"..."` repeats the last,
  `"<cmd> <word>"` the positions a first word picks — `feature restore` → archived names; `HELP_ALIASES` copy their command's)
  and **`FLAG_VALUES`** (`"<flag>"`, or `"<cmd> --<flag>"` where commands differ: `init --evidence` is a mode, `done --evidence` a
  summary) — and the value lists their `@sources` name, read from the facade (`LANGS`, `VALID_TRACKS`, `PHASES`, `FLOWS`,
  `FEATURE_SIZES`, `SIZE_POINTS`, `TRACKERS`, `APPROVAL_GUARD_LEVELS`, `IMPORT_TOOLS` (1.25), `TEMPLATE_ARTIFACTS`, the backlog /
  milestone actions) or the CLI (`mcpConfigBlocks()`, `RULE_FILES`, `commands/*.md`). `cli/completion.js` fills the template of
  the shell (`cli/completion/dev-spec.{bash,zsh,fish,ps1}`; `#@` lines are maintainer notes, never printed; LF always). One
  algorithm in the four: walk the words before the cursor (a value flag eats the next word, `--` ends the flags, `-h` / `-V`
  skipped) → the command, its first positional, the position; then the flag's values (`--flag=` and a `a,b,` list keep their
  prefix — bash splits `--lang=p` into `--lang` `=` `p`), the command's flags (a word starting `-`), the commands, or the
  position's spec. Tables: bash / zsh a `case` per table (bash 3.2 — macOS — has no associative array), fish two parallel
  lists read with `contains -i` (a `switch` pattern would read the `*` of `init#*` as a wildcard; `string join` of one word
  returns 1 — the lookup returns 0 itself), PowerShell hashtables (never a `$T` beside a `$t`: its names are case-blind).
  **Feature names** (`@feature` / `@archived`) are the only call the script makes on Tab: `dev-spec __complete
  features|archived [--project <dir>]` — handled on the CLI's FIRST lines, before `spec.js` loads (`cli/completion.js`
  `complete()`, Node core only: a mirror of `resolveProjectDir` / `nearestProject` / `isDevSpecDir` / `isNetworkPath` and of
  `listFeatures`' `isFeatureFolder` rule, the `_archive/` listing beside it); never an error, never a refusal, exit 0. It costs
  about Node's startup (Windows: ~80 ms against ~70 ms for `node -e 0` and ~450 ms for `list`); a test compares it with the
  engine on 8 layouts and checks no `mcp/lib` module loads — **change the engine's resolution or listing rule and the
  mirror follows** (the test fails otherwise). **The CLI the script runs** is this CLI's absolute path (no `dev-spec` on PATH in
  a plugin install) — resolved at completion time: in a plugin's versioned folder (`…/dev-spec-driven/<version>/cli/dev-spec.js`)
  the newest installed `<version>` (a plugin update replaces the folder, and the old one lingers for days), else that path,
  else a `dev-spec` on PATH; the generated message `cliOutput.completionGone` when none is left. Without a `dev-spec` on PATH
  the script defines `dev-spec` as a shell function running that CLI (PowerShell: each array argument — `--tracks tdd,saas`
  parsed as a list — joined back with `,` IN PLACE in `$args`, so `--timebox 3d` stays "3d"; a copy would pass the number 3;
  piped input goes on). The tables are the generating version's: save the script again after an update for new commands /
  flags (documented, not detected). PowerShell 5.1 decodes a native command's output with the OEM code page, so the PowerShell
  script is ASCII: a non-ASCII path or message rides as base64 (`QUOTE.powershell`), the header's install line names the file
  instead. PowerShell completes nothing after a bare `-` / `--` (its own parameter syntax — a letter first). Tests:
  cli/tests/16-conventions-completion.js runs bash (Git Bash on Windows) and Windows PowerShell (TabExpansion2) for real, zsh
  (compadd / compset stubbed) and fish (`complete -C`) where installed (`DEV_SPEC_TEST_ZSH` / `DEV_SPEC_TEST_FISH`), and reads
  each script's tables back.
- **CLI boolean switches are read with `on(k)`, never by truthiness**: `--x=false` is the string "false" (truthy),
  so `done --run=false` ran the `_Verify:_` commands. `normalizeBoolFlags()` (every name in `BOOL_FLAGS`) turns
  `true|false|1|0|yes|no|on|off` into booleans and refuses any other value. `BOOL_FLAGS` is `[...spec.CLI_SWITCHES]`
  (1.14): ONE list, which the approval hook's lexer (`cliApprovalAction()`) also reads to tell a switch from a value flag —
  a new switch goes into `spec.CLI_SWITCHES` (never a CLI-only list: the hook would read the word after it as its value), a new
  value flag into `VALUE_FLAGS` — `refuseUnknownFlags()` refuses any other `--flag` before anything runs (exit 1, a
  localized did-you-mean; `done 2 --rnu` used to tick the task with no evidence). `evals` is exempt (its flags go to
  run-evals.js, which refuses its own unknown ones); `--` ends the options; `--help` anywhere prints the help and runs nothing
  (`evals --help`: the harness's usage). **Per command (1.24 r6 B-I3):** `<command> --help`, `-h` (now a switch, never a
  positional: `status -h` looked for a feature "h") and `help <command>` print `helpFor()` — that command's blocks of the one
  `helpText()` (each line whose first word is the command, with its continuation lines; `HELP_ALIASES` na / milestones), its
  `COMMAND_OPTIONS` (a value flag shown `--x …`) and the localized frame (`cliOutput.cmdHelp`); no command, `-h` alone or a
  word with no block → the whole help. A new command gets its block in `helpText()` starting `  <name> ` at two spaces. An explicit
  `--include-body=false` / `--include-brief=false` is passed through as false (`boolFlag()`), as MCP receives it.
  The eval harness (`mcp/evals/run-evals.js`, which `evals` forwards to untouched) applies the same rule to its own
  switches (`--dry-run`, `--set-baseline`, `--require-live`: exit 2 otherwise). 1.25: `dry-run` is a CLI switch too (`import
  --dry-run`), so `normalizeBoolFlags()` skips it under `evals` — the harness reads its own `--dry-run=maybe` (exit 2).
  Numeric flags that MCP bounds (`--cap`, `--max`) and the CLI-only `--timeout` go through `intFlag()` (integer ≥ 1; `--timeout`
  also ≤ 2147483 — `timeoutFlag()`, Node's timer limit, 1.24 r6 B6: `cliOutput.atMost`).
  The engine refuses what the MCP schema refuses where the CLI passes raw strings: `taskNumber()` (digits only — `"1.9"` / `"2abc"` are not
  task 1 / 2), `createFeature` kind ∈ feature|bugfix|spike, `backlog` action ∈ add|rm|remove|list. **In the validator's own words**
  (`msg(lang).args`, 1.22 review) where the schema bounds a value: a task number asked for (`askedTaskNumber()` — done / undone /
  brief, spec_complete_task / spec_task_brief `{number}`, schema `minimum: 0`) is an integer ≥ 0 (`taskNumberError()`: `-1` read
  "must be an integer"; not ≥ 1 — the scanner reads a hand-written "0." task and next serves it, so refusing 0 would loop next →
  complete; `done` checks it itself before `--run` runs anything — an empty word would brief the NEXT task); a roadmap `order` (depend `--order`, spec_depend's `{type: "integer"}`) is a SAFE
  integer (`orderInput()` — `99999999999999999999` matched the digits and was stored as 1e20).
