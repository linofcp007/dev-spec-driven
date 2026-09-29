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
- **`spec_feature remove` needs `confirm: true`** (CLI `--yes`). Without it nothing is deleted and the
  result (an error with `needsConfirm`) lists what would be — `removePreview()` checks roadmap.json first
  and uses `lstat` (a symlink/junction is one entry, never followed). Prefer archive (reversible).
- **Rename follows every reference** (`renamePlan`, computed BEFORE the folder moves so the old slug still resolves,
  written after): roadmap.json dependsOn, `_Supersedes: <old>/…_` markers in other features' requirements.md (active
  and archived; never one in a comment/fence), and archived features' `.state.json → archived` records. A broken
  archived state file that names the old slug refuses the rename.
- **JSON state is read with `readJson()` and written atomically (`writeFileAtomic`)**. A
  `roadmap.json` / `.state.json` that exists but doesn't parse is an ERROR every mutator returns
  (`roadmapError()`, `state.invalid`) — never "repaired" into `{}` (that erased deps, backlog,
  approvals and `meta.lang`). **Valid JSON of the wrong shape is refused the same way:** `readState()` checks
  the top level, `approvals`/`evidence`/`finishChecks`/`signoffs` (objects), `tracks`/`approvalHistory`/`changes`/`unticks` (lists);
  `loadRoadmap()` checks `features` and each entry, `dependsOn` (string lists), `meta`, `backlog`. Readers get
  a sanitized copy; every mutator refuses BEFORE its destructive step. A leading BOM is tolerated.
  `writeIfAbsent` uses `flag:"wx"`. `writeFileAtomic`'s temp file never outlives the call: when the rename and the
  plain-write fallback both fail (read-only / locked target on Windows, a folder at that path) it is removed before
  the error is thrown — the best-effort refreshes swallow that error, and used to leave a `<file>.<pid>.<ts>.tmp`
  in `.specs/` per call. On Windows an EPERM/EACCES/EBUSY rename is retried briefly (a scanner's lock). tasks.md
  ticks go through it too (a reader never sees a truncated tasks.md).
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
  is reclaimed at once, any other after 2 min (10 min while its pid still runs). **Mutual exclusion rules** (each one
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
  and exits 1). Never `process.exit()` right after a write. The pre-commit validator reads staged
  names NUL-separated with `core.quotePath=false`, so accented paths work. Only EARS errors and phantom task refs
  block; a requirements.md with EARS warnings or template placeholders (the STAGED text, `featurePlaceholders(…, text)`)
  gets a ⚠ line (`earsWarnings`), never "EARS clean" — the PostToolUse hook's rule.
- **Dates/timestamps**: fine to use `new Date()` in the MCP server and scripts (normal Node
  process). Do NOT assume that in any Workflow-script context.
- **CLI `--lang` is the MCP enum**: `main()` refuses anything outside the MCP `lang` enum (case-folded) with the
  localized `args.invalid` message before dispatch — the engine's `normalizeLang()` would turn `fr` into `en` and save it.
- **CLI exit codes are scriptable**: `doctor` (FAIL), `trace` (gaps), `ears` (errors), `finish` (not ready),
  `drift` (drift, a stale baseline or an error) and any refused operation exit 1. The eval harness
  (`mcp/evals/run-evals.js`, also `dev-spec evals`) exits 2 on a usage error (a `--max-items` that isn't an
  integer ≥ 1 — it graded nothing and scored 0/0 = 100%) and 1 on an invalid set (an empty one included). An engine refusal goes through `fail(r)`, never
  `die(r.error)`: with `--json` the whole `{ok: false, error, …}` result (`recorded`, `neverApproved`, `gated`…) is
  the one JSON document on stdout, as MCP returns it. `die()` is for CLI usage/argument errors only.
- **CLI boolean switches are read with `on(k)`, never by truthiness**: `--x=false` is the string "false" (truthy),
  so `done --run=false` ran the `_Verify:_` commands. `normalizeBoolFlags()` (every name in `BOOL_FLAGS`) turns
  `true|false|1|0|yes|no|on|off` into booleans and refuses any other value. `BOOL_FLAGS` is `[...spec.CLI_SWITCHES]`
  (1.14): ONE list, which the approval hook's lexer (`cliApprovalAction()`) also reads to tell a switch from a value flag —
  a new switch goes into `spec.CLI_SWITCHES` (never a CLI-only list: the hook would read the word after it as its value), a new
  value flag into `VALUE_FLAGS` — `refuseUnknownFlags()` refuses any other `--flag` before anything runs (exit 1, a
  localized did-you-mean; `done 2 --rnu` used to tick the task with no evidence). `evals` is exempt (its flags go to
  run-evals.js untouched); `--` ends the options; `--help` anywhere prints the help and runs nothing. An explicit
  `--include-body=false` / `--include-brief=false` is passed through as false (`boolFlag()`), as MCP receives it.
  The eval harness (`mcp/evals/run-evals.js`, which `evals` forwards to untouched) applies the same rule to its own
  switches (`--dry-run`, `--set-baseline`, `--require-live`: exit 2 otherwise).
  Numeric flags that MCP bounds (`--cap`, `--max`) and the CLI-only `--timeout` go through `intFlag()` (integer ≥ 1).
  The engine refuses what the MCP schema refuses where the CLI passes raw strings: `taskNumber()` (digits only — `"1.9"` / `"2abc"` are not
  task 1 / 2), `createFeature` kind ∈ feature|bugfix|spike, `backlog` action ∈ add|rm|remove|list.
