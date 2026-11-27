# Conventions & gotchas — feature folders, state, locks, process I/O, the CLI

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
The cross-cutting rules. The other gotchas live with their area (the topic map in CLAUDE.md names them); the hooks.json
and U+FEFF gotchas are in CLAUDE.md. The rules come first; how they came to be — the releases and review findings — is in
History at the end.

## Conventions & gotchas

### Feature folders — the feature resolver
- **Every name-taking op resolves its folder through `resolveFeature()` / `existingFeature()`**, never
  `path.join(specsRoot, slugify(name))` (an empty slug — a non-Latin name, `...` — would be `.specs/` itself). It rejects the
  reserved slugs (`steering`; `templates` / `exports` / `tracks` but for a pre-existing feature — templates-imports-exports.md →
  Project templates) and Windows device names (`nul`, `com1`…), transliterates accents (`Autenticação` → `autenticacao`) with
  the legacy slug (`autentica-o`) as a fallback. `slugify(undefined)` is `""`; `listFeatures` reports dot / non-slug folders
  as `ignored`.
- **A slug is the first 64 characters of `slugifyFull(name)`;** a long name reaching an EXISTING feature titled with another
  long name is refused (`slugTaken`). spec_create on an existing folder is a create-only re-run that says so (`existed: true`,
  `createExisted`).
- **The name is ONE line** (`flatText`) **and inert to HTML comments** (`specNameText`: `<!--` → `&lt;!--`) wherever it lands.
- **Never through a link:** `linkedSpecsFolder()` (scaffold.js) refuses to scaffold through a linked `.specs/steering/` or
  `.specs/<feature>/` (`linked: true`, nothing written), and nothing is READ through one (The read gate, below). A name that
  reaches a linked feature folder is `feature-linked` (`existingFeature`: `{ok: false, linked: true, code, path, error}` —
  `err.featureLinked`) for every reader, never "not found" — `drift {name}`, a milestone's feature list and a dependency
  (`depend`) included; `backlog add` of the name is refused with it (a linked folder holds the name, but "already has a spec"
  would name a spec dev-spec can't read).
  Eight sites accept `f.linked` and go on to the write gate's refusal at the lock / the link's removal, as since 1.24
  (12-lifecycle-write-gate.js G1, unchanged): `featureLocked` (files.js), archive, rename, remove, its preview,
  `removeLinkedFeatureLocked`, restore's `archivedFeature` (finish.js) and protect / unprotect (`protectTests`, protect.js: its lock
  refuses). Nothing else accepts one (every other `f.linked` test refuses with it). Restore of a name that is NOT archived while
  `_archive/` itself is a link answers that refusal (`linked: true`, `.specs/_archive/`) rather than the parent's "Nothing is
  archived as …": behind the link dev-spec can't see what is archived, and the link is why no restore can work — the more
  informative answer, kept on purpose (1.41.1 fix round 1).
- **`spec_feature remove` needs `confirm: true`** (CLI `--yes`); without it the result (`needsConfirm`) previews what would go
  (`removePreview()`, `lstat`: a link is never followed). Prefer archive. A feature folder that is itself a link is removed as
  the link alone (`removeLinkEntry`), under the roadmap lock only — a feature lock would be created THROUGH it.
- **Rename follows every reference** (`renamePlan`, computed before the move, written after): roadmap.json dependsOn,
  `_Supersedes: <old>/…_` markers in other features' requirements.md (never in a comment / fence), archived `.state.json →
  archived` records (a broken one naming the old slug refuses the rename); a backlog item named like the new slug is dropped
  (`pruneBacklog`).
- **A change's requirements.md / tasks.md are its change.md:** `readIfExists`, `existsCached`, `readContained` and
  `writeFileAtomic` alias them in a `kind: "change"` folder (`changeAlias()`; `readRaw` / `existsRaw` don't). A raw
  `fs.existsSync` does NOT — name the file through `phaseFile("tasks", "change")`; never create a tasks.md there (it would win).

### The project folder: `resolveProjectDir()` — the resolver
- **Every surface's default** (mcp/lib/probe.js `resolveProjectDir` — files.js's IS it through the engine's reads, the CLI's context
  and completion read it without the engine, 1.30.1): the explicit argument (`--project`, a tool's `projectDir`) > `SPEC_PROJECT_DIR` >
  `CLAUDE_PROJECT_DIR` > the nearest folder at or above the working one holding a dev-spec .specs/ (`nearestProject()` —
  `probe.nearestProject` over the engine's reads, the walk the CLI's completion makes too: the working folder itself with ANY
  `.specs/`; ≤ 64 levels; never up a network path — without the walk a subfolder run would
  nest a second .specs/) > the working folder. A project INSIDE another needs `--project .` (or its own `.specs/` first).
- **ONE rule says what a dev-spec .specs/ is:** mcp/lib/probe.js `isDevSpecProject(dir)` (Node core only); engine/doctor.js
  `isDevSpecDir` is it read through the engine's reads (a dry run's folders). `.specs/` holds roadmap.json, a `steering/`
  folder, a ROADMAP.md dev-spec generated (`RE_AUTOGEN` in its first 4,000 characters) or a direct sub-folder not starting
  with "." holding `.state.json` or `classification.md`. The hooks, the status line, the completion and the engine all read
  it — never write a variant (mcp/tests/10-guards-probe.js checks they agree).
- **An unusable value falls through:** empty, or an unexpanded variable (`${`, a leading `$NAME`, `%NAME%` — `unexpandedVar()`)
  — it would create that literal folder. A leading `~` is the home folder (`expandHome()`; `~user` stays): PowerShell 5.1
  passes `~` as typed, and an MCP argument or a JSON config is never expanded.
- **Validation:** an existing folder, only spec_init creates one — the CLI (→ CLI arguments), the MCP server (mcp.md →
  Argument validation).
- **A CLI path argument** (`scan <path>`, `ears <file>`, `import <tool> <path>`) is relative to the project when it was NAMED,
  else to the working folder (`argPath()`, cli/main.js — as in git). `ears <word>`: a file → linted; a path-like word naming no
  feature → `cliOutput.earsNoFile`; else a feature name.

### The write gate — ONE gate for everything under .specs/
- **`specsWriteGate(target, {dir, createOnly})`** (engine/files.js) runs first in every writer — `writeFileAtomic`,
  `writeIfAbsent`, `ensureDir`, `specWrite` (the append: O_APPEND | O_CREAT | O_NOFOLLOW where available) — and on
  `withLockFile`'s lock path before the lock exists. **No other mcp/lib or mcp/evals/ source writes with a raw fs call**
  (mcp/tests/16-conventions.js; files.js alone may); the eval harness writes through `spec.writeSpecFile`.
- **It refuses** (`specsWriteBlock`: lstat of each part below the project's `.specs` — `gateRootOf`, the read gate's root: The read
  gate, below — plus one realpath) **a link
  on the way** — a folder between .specs/ and the target, or the target, that is a symlink / junction or resolves outside the
  real .specs/ — and **the wrong kind** (a file where a folder is needed, or the reverse). .specs/ itself may be a link; only
  what lies below it is checked. A part gone between lstat and realpath (a lock just released) is judged by its folder
  (mcp/tests/12-lifecycle-write-gate.js). `createOnly` passes an existing link target ("wx" never writes through it). **Why:** a
  committed link under .specs/ (`.execution/merge-summary.md -> ~/.bashrc`) would get spec text written where it points.
- **The refusal** is an Error (`code` ESPECSLINK / ESPECSKIND, `gate`, a localized message — `err.specsLinked`…) that the
  facade answers as the call's result (`gateRefusal`: `{ok: false, linked | wrongKind: true, path, error}`) on every surface.
  Feature mutators meet it at their lock, before any write (`featureLocked` / `withMoveLock`); best-effort writers swallow it.
- **Removals go through it too:** `removeSpecFile` (a link AT the path unlinked as the link), `removeEmptySpecDir` (an EMPTY
  folder, never a link — rmdir would drop a junction). **Known limit:** a second write in one call can be refused after the
  first landed (a linked tasks.md: the evidence recorded, the tick refused) — but nothing is written THROUGH a link.

### The read gate — nothing READ through a link below .specs/ (1.41.1)
- **The write gate's predicate, read the other way** (`specsReadGate(p)`, engine/files.js, beside `specsWriteBlock`; both share
  `realInsideSpecs`): below the project's `.specs` (`gateRootOf` — never `.specs` itself, which may be a link), a part between it and
  the target that is a symlink / junction (lstat), that lstat can't read (EACCES…), that lstat calls neither a file nor a folder (a
  FIFO, a socket, a device — its open would wait for a writer: fix round 2), or a FOLDER whose real path is not strictly inside the
  real `.specs/` (a mount point) makes the target read as ABSENT; on win32 so does a `:` in any segment from `.specs` on (NTFS stream
  syntax — `.specs::$INDEX_ALLOCATION\…` opens the folder; no file name holds a `:`). Memoized in the call's read-cache scope
  (`\0part:` — one lstat per distinct part — and `\0realdir:` — one realpath per distinct folder; a regular file can't redirect, its
  folder's real path is checked); `forgetCached` drops both for a written path and its folders. lstat decides a link, never a
  Dirent's "link" (Windows lists a cloud-file placeholder as one).
- **Which `.specs/` (`gateRootOf`, fix round 1 — ONE root for both gates):** the PROJECT's, never the nearest folder merely NAMED
  `.specs`. `specsRoot(projectDir)` records the call's project folder in the scope (`CTX.GATE_BASES`); the root is the outermost
  segment named `.specs` strictly below the outermost recorded project folder holding the path (none recorded: the outermost in the
  path), its name compared by `withinRoot`'s case rule (folded on win32 / darwin; a Windows 8.3 alias counts only when its real path
  is that `.specs`'s; on win32 the name before a `:`, the stream spelling). So a link NAMED `.specs` deeper down
  (`.specs/f/.history/.specs -> ~`) is an ordinary part — refused, and named by `specs-links` —, a project that sits below a folder
  named `.specs` (`~/.specs/work/app`) gates its own `.specs/` only (its code is never gated: a text test first, no disk call for a
  path with no `.specs` segment below the project), and each project of a monorepo stands on its own `.specs/`. Not
  `isDevSpecProject`: a `.specs/` the rule doesn't call dev-spec's would be ungated. Several projects recorded in one scope: the
  OUTERMOST holding the path (a project reached through a link below another's `.specs/` never resets the gate); a recorded project
  that holds no part of the path is no base; the bases live and die with the scope.
- **Every entry records its project (fix round 2):** a scope records a project only when the call reaches `specsRoot(projectDir)`. An
  entry whose facade call takes a folder or a file rather than the project — the scan op (`scanCodebase(<folder>)`), the MCP server's
  approval meta, `ears <file>`, `dev-spec spike`'s `spikeInfo(<dir>)`, the resources' `isFeatureFolder` — opens ONE scope that records
  it first (`withReadCache(() => { specsRoot(dir); … })`). Pinned by a property, not a list:
  mcp/tests/12-lifecycle-read-gate-scope.js runs every entry the surfaces call (the operations table, the resources / prompts /
  completions, every CLI command, the hooks — the approval hook as a process too —, the MCP server) on a project below a folder named
  `.specs` whose `.specs/` is a junction, and fails on any read-gate call standing on the outer folder. **Known limits:** an engine
  call outside any scope (a test calling `engine/index.js` directly) records no project: the outermost `.specs` in the path stands.
  The SAVE HOOK takes its project by text — the nearest folder named `.specs` above the saved file (spec-hook.js `findProjectDir`, a
  pure text walk, no file-system call: a network path is never touched) — so a save the model itself made THROUGH a committed link
  named `.specs` below `.specs/` (`.specs/f/.history/.specs -> <another project's .specs>`) reaches the engine as the project behind
  the link: the hook traces / lints that project's spec and stamps its `.state.json` (review 2's R2-R-2). No new capability — the
  model's own Write / Edit already went through the link, and Read follows it too. Round 2 answered it with the gates' root rule and
  broke the plain case (fix round 3, R3-R-1: on a project below a folder named `.specs` whose session anchor holds no saved file —
  Claude Code in a subfolder, a sibling checkout, no anchor — the hook went silent and the stop gate with it); taken out.
- **What a listing proved is not asked again (`seedParts`, fix round 1):** every listing of `.specs/` or of a folder below it the gate
  let through (`readDirDisk`, `safeReaddir`, `featureDirs`, `listFeatures`) seeds the memo with its plain entries — a Dirent that says
  "directory" / "file" is no reparse point at all (Windows types every reparse point as a link; POSIX: d_type, Node's own lstat for
  DT_UNKNOWN), so its lstat says the same and a plain folder's real path is its listed folder's + its name; a Dirent "link" seeds
  nothing (lstat decides it), and a seed never replaces an lstat's answer. A project-wide drift / list / doctor no longer pays an
  lstat + a realpath per feature folder its own listing had just named (12-lifecycle-read-gate.js "cost (counts)"). **The seed's
  window (fix round 2, review 2):** its facts date from the LISTING, as the memo's date from a part's first lstat — a folder another
  process swaps for a junction after the listing and before its first read in the same call is read through. Only a concurrent
  writer during one engine call can arrange it (a checkout while an MCP call or a hook runs), never a cloned tree: the gate's
  threat is a static committed one, and the per-call memo had the same class since it existed (counted from the first lstat).
- **Where it holds:** every read primitive asks it first — `readRaw` (`readIfExists`, `readJson`, `readContained`), `existsRaw` (below
  .specs/ answered from the gate's lstat, no existsSync of its own), `readDirCached` / `walkProject`, `safeReaddir`, `isDirSafe`,
  `readFileHead(s)` (the pool gets a path no open accepts), `readBytes` (a tick's bytes), `specsStat` (an mtime / a size); the bounded
  readers outside files.js ask `specsReadBlocked` first (`readLogTail`, `readStopReport`, `fileHash`, the save hook's lint, spec_upgrade's
  `.gitignore`, the roadmap row signature); `historyText` takes `.history/<one file name>` only, as text, before its (gated) read.
  Outside mcp/lib (fix round 1): mcp/server.js's approval meta asks `specsReadBlocked` of roadmap.json (a linked one is unknown —
  every weakening counts, as the approval hook reads it); `ears <file>` (cli/commands.js) asks it of the file it names (behind a link:
  no such file) — both in one scope with the project recorded (fix round 2); the engine-free CLI readers keep the one project rule
  with a one-line lstat — the completion's archived names (a linked `_archive/` lists none) and status-line signature (a link signed
  as itself), cli/main.js's light language (a linked roadmap.json picks none). A WRITE target's name (rename / archive / restore
  onto it, a snapshot's number, an import's folder) is `entryAt` — lstat, a link there is taken. `specsFileContained` /
  `readContained` ARE the gate's verdict (a regular file or absent). The dry-run sink is read first (its records passed the write
  gate).
- **Not gated, on purpose:** `.specs` itself; the project rule (`PROBE_IO`, probe.js `isDevSpecProject`) — which folder IS the project is
  one answer for the engine, the hooks, the status line and the completion (10-guards-probe.js's linked layouts), the spec text behind a
  link stays unread; the engine-free hooks' 1-bit pre-filters (observe `mentioned`, stop `recentActivity`) — they only decide whether the
  engine runs, and its gated read decides (1.42: they open a regular file only, never through a link — claude-code-integration.md).
- **Reported, never silent:** a linked feature folder is `feature-linked` (Feature folders, above); doctor `specs-links` (a warn) names
  each link below .specs/ the reads treat as absent — `.specs/`'s, `steering/`'s and `_archive/`'s own entries and the feature folder's
  down to four levels below it (`SPECS_LINKS_DEPTH` = 3 recursions) —, never what it points at; an approval's artifact behind a link is
  `unreadable: true` (an entry that reads absent).
- **Where absence would relax a decision, it fails closed:** a linked roadmap.json is a GONE one — the approval guard asks
  (`approvalRoadmapGone` → `existsRaw`; the approval hook's `rawLevel` the same by lstat), the stop gate stays on (the Stop hook's
  `gateOff`), guard mode takes the user's default (the guard hook) —; a linked `.state.json` approves nothing, a linked approved artifact
  changed since its approval, a linked report is no report, a linked tasks.md covers nothing (DESIGN table: 12-lifecycle-read-gate.js
  Addition A). A stop-gate report path naming a linked feature folder (`.specs/<linked>/.execution/task-N-report.md`) answers what a
  name no feature holds answers (`no-task` / `no-report`) — never weaker: any reply may name a feature that doesn't exist.
- **Checked by a property, not a list:** mcp/tests/12-lifecycle-read-gate.js drives EVERY entry of `OPERATIONS` (and the hooks) on a
  link maze under an fs tracer — no fs call other than lstat / realpath of a link itself lands behind one, no result carries its text; a
  new operation without its arguments fails "not driven".

### The dry-run sink — `withDryRun(fn)`, engine/files.js
- **ONE switch in the write primitives:** while `CTX.DRY_RUN` is set they record what they would write (`dryPut`) — after the
  gate, so a dry run meets the real refusals — and the readers (`readRaw`, `existsRaw`, `readDirCached`, `safeReaddir`,
  `isDirSafe`) see those records over the disk, so the operation computes what the real call would. `withLockFile` takes no
  lock, `ensureLockIgnore` returns, and an op with no record (a folder move, a link's removal) throws `EDRYRUN`. Its only
  caller is `spec_import {dryRun}` (`isDryRun()` skips the roadmap refresh).
- **A raw fs read does NOT see the sink** — a dry-runnable operation reads what it wrote through these readers (the import's
  parity test compares every previewed file with the real import's).

### JSON state — `readJson()` and `writeFileAtomic`
- **A `roadmap.json` / `.state.json` that doesn't parse, or is valid JSON of the wrong shape** (`readState()` /
  `loadRoadmap()` check each key's type), **is an ERROR every mutator returns before its destructive step** (`roadmapError()`,
  `state.invalid`) — never "repaired" into `{}` (that erases deps, approvals, `meta.lang`). Readers get a sanitized copy and
  SAY it: doctor fails `state`, next_action's step is `fix`, spec_finish blocks, the status line says repair. A leading BOM is
  tolerated; `writeIfAbsent` uses `flag:"wx"`.
- **`writeFileAtomic` is durable and never tears a file in place:** a `wx` temp file (`<file>.<pid>.<ts>.tmp`), written whole,
  fsynced, renamed, its folder fsynced on POSIX (best effort where refused). A rename Windows refuses (EPERM / EACCES / EBUSY —
  a scanner, the indexer) is retried ~1.6 s, never for a read-only target; then the write is REFUSED — the old content
  untouched, the temp file removed. Never an in-place `writeFileSync` fallback (it truncates first and follows links). The
  cost: an editor holding a spec file without delete sharing blocks writes to it; ~0.5 ms per write.

### Merging the spec state — git's merge driver
- **The driver:** `dev-spec merge-state <base> <ours> <theirs> [<path>]` is git's `%O %A %B %P` driver — `mergeStateText()`
  (state.js, PURE: no file, no git) parses, `mergeStateJson(base, ours, theirs, kind)` → `{kind, merged, conflicts}` merges,
  and `<ours>` is written in its own form (BOM, CRLF, final newline). A new state key needs its rule here.
- **The rules:** one side changed → that side. Append-only lists (`approvalHistory`, `changes`, `unticks`) → the union by
  identity (`HISTORY_ID` · `CHANGE_ID` · `UNTICK_ID`). `evidence[n]` / `finishChecks[name]` → the latest run `at`, other tasks
  sharing n kept in `others` (`EVIDENCE_OTHERS`), histories deduped and bounded. `ticks[n]`, `lastTickAt`, `lastEditAt`,
  `finished` → the later; `createdAt` → the earlier; `branch` → the EARLIER record. `approvals[phase]` → the later unless a
  full revocation is later — **revocations win by time**; `signoffs[phase][role]` → the later, dropped by a no-earlier
  revocation (`roleOnly`: its roles only) or approval. Both drop rules run on the 3-way RESULT (`pruneRevokedApprovals()`,
  `pruneSignoffs()`), since `mergeThree` hands back a key only one side touched. `lastApprovedPhase` follows the merged
  approvals. Lists (`tracks`, `dependsOn`, roles, milestone `features`) → a 3-way SET merge; keyed roadmap entries
  (`features`, `backlog` — case-insensitive —, `meta.milestones`, `meta.checks`, `meta.approvalRoles`) per key, a change
  beating a delete; `meta.specVersion` → the higher, `meta.changelogAt` → the later, `meta.evidenceSince` → the earlier.
- **`meta.reviewModels` (1.36) takes the default rule on purpose** — an ORDERED list (the first model leads), at most 3: never
  a set merge (a union of two panels could hold 4). One side changed it → that side; both changed it differently (another list,
  or off against a change) → a real conflict (cli/tests/16-conventions-merge-state.js).
- **`meta.fastCheck` (1.36) is a plain value** (a check's name): the default rule — two different names conflict. A tick's
  fast-check snapshot (`fast` {check, status, runs, clean}) is a RUN field (`runOf` keeps it): it travels with the run that wins
  `evidence[n]`, no rule of its own.
- **`.specs/.execution/timings.jsonl` (1.41, the friction budget) is never merged:** git-ignored (`.execution/.gitignore`), one
  machine's measures — no state key, no run field `ms`, no rule (tasks-and-evidence.md → The friction budget).
- **`metrics` (1.41) is a field of the LATEST run** (`evidence[n]`, `finishChecks[name]` — never in their history): it travels with
  the record that wins (the later run), no rule of its own; the losing side's readings are dropped with its run.
- **`finished.metrics` (1.41) lives inside `finished`**, which merges as "the later" whole: the later finish's readings, never a
  union (cli/tests/16-conventions-merge-state.js holds both).
- **`protectedTests` (1.36, guard tests) has its rule** (`mergeProtectedTests`): `files` file by file, 3-way (`mergeMapWith`) — a
  one-sided change (a tick's re-baseline, an added test) comes through; both sides changed one → OURS, never a conflict (finish
  hashes the content again and names a change no record explains); `at` / `via` the EARLIER snapshot's (a record without a time
  reads as the later); `truncated` either side's; `lifts` the union by identity (`LIFT_ID`: file, at, by, revoked, accepted — a
  lift, its end and an accept each a record, in time order).
- **A real conflict** (anything else both sides changed differently — a meta scalar, an unknown key): ours kept, the conflict
  written INTO the file as a top-level `mergeConflicts` list (valid JSON; each once — `mergeCanon`), exit 1, and doctor fails
  `merge-conflicts` until someone picks the values and deletes the list. An unparseable side merges nothing (exit 1).
- **Post-passes on the RESULT:** `staleMergedEvidence()` marks `stale` each merged record of task n older than a reopen /
  untick only one side recorded (`staleBy: "undo"` for an untick); `breakMergedCycles()` undoes, cycle by cycle, the first
  dependency edge ours doesn't hold (a conflict). Generated files (`ROADMAP.md`, `SPECS.md`…) keep ours when both carry the
  AUTO-GENERATED marker; a hand-written one goes to `git merge-file`.
- **The driver never approves:** every required role's sign-off made on two branches leaves `approvals[phase]` absent (it
  can't read `meta.approvalRoles`; an approval is a gate run); `roleGateView()` reports `signoffsComplete: true` and
  next_action asks one role to sign again (gates-and-approvals.md).
- **`--install [--project]`** (CLI only — the engine never calls git) writes the `.gitattributes` block (`mergeAttributes()`,
  idempotent) and this clone's `merge.dev-spec-state.driver` = `node '<clone>/cli/dev-spec.js' merge-state %O %A %B %P`
  (forward slashes, single-quoted: git runs it through sh); `--uninstall` removes both; neither writes through a linked or
  non-file `.gitattributes` (`attributes-not-file`). Not installed, git merges the text.
- **A stale driver path:** a plugin update removes the versioned folder the config names, and git then leaves ours unmarked.
  `merge-state --check` (`spec.mergeDriverStatus()`) → ok · none · not-installed · other · missing (exit 1 on the last three;
  `--check` is init's VALUE flag, so cli/main.js turns a bare one into the switch). The SessionStart hook adds one line
  (`mergeState.hookLine`) for missing / other, reading the git config as text (`repoGitConfigText()`, `gitConfigGet()` — no
  git process). Re-run `--install` after a plugin update.
- **Known limits:** two branches approving one phase add `.history/<phase>@<n>.md` twice (keep the one `approvals[phase]`
  names); `decisions.md` merges as text; clock skew decides "later".

### The locks — feature, folder-move and roadmap locks
- **Feature mutators hold a cross-process lock** (`withFeatureLock` / `featureLocked`): `completeTask`, `approvePhase`,
  `appendTasks`, `addTrack` / `removeTrack`, `impactReport` with `reopen`, `finishFeature` with `write` / `evidence`, `decide`,
  `manageFeature`'s `flow`, `taskBrief` / `metrics` with `write`, a `createFeature` re-run. Unlocked, two processes each
  rewrite tasks.md + `.state.json` and the last writer wins.
- **The lock** is `.specs/<feature>/.lock` (`{pid, host, at, token}`), re-entrant in one process; `acquireLockFile()`
  hard-links its note into place (no noteless lock; without hard links, O_EXCL and `LOCK_NOTELESS_STALE_MS`).
  `lockGateError()` gates its path first, retrying ~160 ms when the lock file itself answers EPERM (Windows "delete pending").
  Waiters retry `DEV_SPEC_LOCK_WAIT_MS` (10 s), then get `{ok: false, busy: true}` (`err.featureBusy`), nothing changed; a
  nested lock waits only for the outer budget (`LOCK_DEADLINE`, ≥ `LOCK_NESTED_MIN_MS`). Only a folder that refuses the note's
  temp file (`readOnly`) runs unlocked.
- **Staleness:** a dead holder's lock (same host) is reclaimed at once, any other after 2 min (10 min while its pid runs —
  `LOCK_MAX_HOLD_MS`); this pid and host on a lock older than this process (`PROCESS_START_MS`) at once; a future-dated lock
  ages too (`Math.abs`).
- **Mutual exclusion rules** (each broken one lost updates while every call answered ok): an un-stat'able lock is NEVER stale;
  a stale lock is removed only by `reclaimStaleLock()`, under `<lock>.reclaim` (O_EXCL), while it is still the one judged
  (`lockSnapshot`); a holder releases only ITS token (`releaseLock`). An unremovable stale lock ends in `{busy, stuck: true}`
  (`err.lockStuck`) — never a `continue` past the deadline (100% CPU). A multi-process counter test
  (mcp/tests/16-conventions.js) guards them.
- **Folder moves** (rename / archive / remove / restore) run under `withMoveLock`, never while another process holds the lock;
  the lock travels with the folder and is released at the NEW place. `moveDirOrBusy()` retries Windows refusals ~1.4 s, then
  `err.folderInUse`. **remove** first renames the folder to a dot tombstone `.specs/.removing-<slug>-<rand>/` and deletes it
  there (in place, a waiter could write into the half-deleted folder); dot folders are never features; `sweepTombstones()`
  clears old ones.
- **`roadmap.json` read-modify-writes** (depend, backlog, restore, init / roadmap settings, changelog `--write`…) hold
  `.specs/.roadmap.lock` (`withRoadmapLock`). **Lock order:** feature, then roadmap — never the reverse; the ROADMAP.md refresh
  runs after both. Internal calls use the unwrapped functions.
- **The lock files are git-ignored:** `ensureLockIgnore()` keeps the lock names, killed processes' temp files
  (`*.[0-9]*.[0-9]*.tmp`) and `.removing-*/` in `.specs/.gitignore` before any lock is taken (missing lines only; it never
  creates `.specs/`).
- **Known limits:** pid liveness is probed only on the note's own hostname (machines sharing one on a network folder need
  distinct names); `rename` rewrites other features' `_Supersedes:` lines without their locks (the lock order) — a concurrent
  edit can lose that line.

### Flush stdout before exiting — on Windows AND Linux pipes
- **Hooks** read stdin asynchronously (never `fs.readFileSync(0)`) and exit in the write callback — all of it ONE runner,
  hooks/hook-utils.js `runHook` / `finish` (claude-code-integration.md → Hooks and commands); **the test harnesses** exit
  once stdout has flushed (a Linux pipe writes async past 64 KB); **the MCP server** flushes its replies on stdin close, exits 0
  quietly on a closed stdout (EPIPE / EOF / ERR_STREAM_DESTROYED), else one stderr line and 1.
- **The CLI:** only its entry point exits, once stdout and stderr have flushed — never `process.exit()` after a write.
  `stdoutError()` (cli/main.js): a reader that stops early (`| head`) ends the output quietly with the command's status; any
  other stdout error is one `dev-spec:` line, exit 1. Its stdin (`ears -`, `import <plan> -`, `log <f> -`, `stop-check -`) is
  read as BYTES and decoded like a file (`decodeText`: UTF-16 by BOM, else UTF-8); from a terminal it first prints
  `cliOutput.stdinHint`.
- **The pre-commit validator** reads staged names NUL-separated (`core.quotePath=false`), loads the engine only for a staged
  spec file, blocks on EARS errors and phantom task refs only, and warns (`earsWarnings`) on EARS warnings or placeholders in
  the STAGED text — never "EARS clean".

### Calendar dates and timestamps
- **`new Date()`** is fine in the MCP server and scripts — never assume it in a Workflow-script context.
- **Calendar dates: `today(now?, utc?)` / `dayOf(instant)` (engine/core.js, on the facade) are the ONE rule — the LOCAL date,
  YYYY-MM-DD.** Never `toISOString().slice(0, 10)` (the UTC date: the day before, just after midnight east of UTC). Stored
  timestamps stay UTC instants, shown through `dayOf`. The one UTC date on purpose: a waiver's `expires` (`today(undefined,
  true)`). mcp/tests/16-conventions-atomic-writes.js guards it, with a child in Tokyo (`TZ` through the child's env — a Git Bash
  `TZ=… node` prefix doesn't reach Node on Windows).

### The CLI is one table and one call
- **The modules:** cli/dev-spec.js is the entry point alone (`__complete` first, then `main(argv, io)`, the exit once output
  has flushed); cli/main.js the command line, the shared checks, the dispatch; cli/commands.js the commands; cli/run.js the
  user's commands (`execCommand`); cli/git.js every git call (`gitRun`: one environment, the user's locale — never parse git's
  words); cli/completion.js the completion.
- **The table:** every command is ONE entry of `COMMANDS` (cli/commands.js) — `name`, `aliases`, `options` (value flags from
  `VALUE_FLAG_SPECS`, else switches of mcp/lib/probe.js `CLI_SWITCHES`), `max`, `bounds`, completion `args` / `sub` / `values`, `text`,
  `help` and `run(c)`. `VALUE_FLAGS`, `COMMAND_OPTIONS`, `COMMAND_ARGS`, `FLAG_VALUES`, `TEXT_ONLY_COMMANDS`, `HELP_ALIASES`,
  `helpText()` / `helpFor()` and `completionModel()` are DERIVED — never hand-written. A new command is an entry; one without a
  structured result says `text: true`.
- **A command's options come from the operations table** (1.30): a command that runs operations says `options: TABLE` and
  reads them from mcp/lib/operations.js `cliOptions(command)` — each of its operations' arguments' `cli` flags (but a flag its
  command implies, `cmd`), then `cliOnly`, in the table's order, which is the order `--help` and completion show (keep an
  operation's args in it). Read on first use (a getter; `COMMAND_OPTIONS` a proxy built then): the status line and the bare
  help never load the table. A hand-written list stays only where the help shows another order than the table can give — init,
  spike (create's operation minus the bugfix prefill, size and body), done / undone (one operation, two orders), changelog and
  depend (whose args' order is the MCP mode's `takes` message) — and cli/tests/02-surfaces-parity.js holds it to the table's
  flags. A new flag of an operation is its `cli` in the table (+ `VALUE_FLAG_SPECS` / `CLI_SWITCHES`, + a hand-kept list).
- **The call:** `main` never exits the process and keeps no state between calls — each call has its own context `c`
  (`createContext`); a usage error or a refusal throws `CliExit`; `io.env` / `io.cwd` apply for the call and are restored. A
  call is SYNCHRONOUS unless the command waits (`done --run` / `finish --run`, stdin from a stream) — only there does a handler
  return a promise, never from an `async` function (its usage errors would wait too); the CLI suite runs calls in-process
  (cli/tests/harness.js `runIn` — testing.md → The harnesses). cli/tests/16-conventions-cli-modules.js guards the contract.
- **Terminal-safe output:** every write goes through `c.write` / `c.writeErr` and ONE choke point (cli/main.js `guarded()`):
  the human text loses every C0 control but tab and line feed (a CR only before a LF), DEL and C1; `--json` keeps the value
  (DEL / C1 as `\u` escapes). Spec text is printed as written — an ESC sequence or a lone CR could show one command while
  another runs. The regexes are built from char codes. A `_Verify:_` or project check holding control characters never runs
  (`code: "control-chars"`); spec_init refuses one, doctor fails `verify-control`.
- **The engine loads on first use:** `spec` is a proxy (`loadSpec()`, cli/commands.js); the status line outside a project
  (`statusProbe`) — and in one while its render cache holds (claude-code-integration.md → Status line) — and the bare help
  (`BARE_HELP`) never load it, so nothing at the top of cli/main.js or cli/commands.js may read `spec.*` at load (`BOOL_FLAGS()`,
  `spec.LANGS` are read on use). Nor does a command's help (`help <command>`, `<command> --help`), an unknown command or a usage
  error found before the handler runs (review 8): `c.projectDir` / `PROJECT_SOURCE` resolve on first read (`NAMED_SOURCE`, which
  checkProject reads, needs no engine), `c.cliText` reads mcp/lib/i18n.js's tables (`spec.msg` IS `i18n.msg`) and `c.projectLang()`
  is the engine's `projectLang` once `engineLoaded()`, else `lightProjectLang()` — the CLI's resolver walk (cli/completion.js
  `resolveProject`) and roadmap.json's `meta.lang` read raw; cli/tests/16-conventions-cli-modules.js checks both print the same.
  cli/run.js and cli/git.js load on first use too. Nor does an unknown `--flag` or a switch given a non-boolean (1.30): the switch
  list (`CLI_SWITCHES`) and the did-you-mean (`closestName`) are mcp/lib/probe.js's — one copy, the engine's are them. Nor does a
  handler's own usage error (1.30.1): `c.projectDir` is THE resolver's — mcp/lib/probe.js `resolveProjectDir`, which files.js
  `resolveProjectDir` and the completion read too — never the engine, so a handler may read it (its destructure) before its usage
  check; `--lang` and an integer flag are refused from the i18n tables (`LANGS`, `canonicalLang`, `msg` — the facade's ARE them). The
  engine still loads for `import <tool>` without a path (its tool list), a repeated `append-tasks --task` and `done … --timeout`
  without `--run` (the feature's language, read first). A new handler keeps `spec.*` after its usage check.

### CLI exit codes and `--json`
- **CLI exit codes are scriptable**: `doctor` (FAIL), `trace` (gaps), `ears` (errors), `finish` (not ready),
  `drift` (drift, a stale baseline or an error) and any refused operation exit 1 — and `create` / `bugfix` / `spike --branch`
  when the feature does not end up on its branch (lifecycle.md → A feature's own git branch: it is created all the same). The
  eval harness (`mcp/evals/run-evals.js`) exits 2 on a usage error (a `--max-items` below 1 would score 0/0 = 100%), 1 on an
  invalid or empty set; `dev-spec evals` passes its status on, 1 when there is none (a signal).
- **An engine refusal goes through `fail(r)`, never `die(r.error)`:** under `--json` the whole `{ok: false, error, …}` result
  is stdout's one document, as on MCP. **`die()` is for usage errors:** under `--json` it prints `{ok: false, error, code}` on
  stdout too — MCP's stable codes (`unknown-argument`, `missing-arguments`, `invalid-arguments`, `project-missing`,
  `project-not-dir`), else the CLI's (`usage`, `unknown-command`, `project-empty`, `project-unexpanded`, `project-is-specs`).
  An engine exception answers the same shape (`code` the system error's, else `"exception"`).
- **`--json` on a text-only command** (the help, `TEXT_ONLY_COMMANDS`: `rules`, `mcp-config`, `evals`, `completion`) is a usage
  error (`cliOutput.noJson`); `--json=false` is the switch off.

### CLI arguments — each command reads its own options and arguments
- **CLI `--lang` is the MCP enum:** folded like it (`spec.canonicalLang`: `PT` → `pt`, `pt_BR` → `pt-BR`), refused outside
  `spec.LANGS` before any command runs — `normalizeLang()` would save `fr` as `en`.
- **An enum the engine checks itself** (the CLI's raw word reaches it; MCP's schema refused it already): ONE reader,
  `enumArg(name, values, v, lng, {fold, blankGiven})` (engine/state.js, 1.30) — trimmed and lower-cased (a fold of its own:
  `langOption` canonicalizes), absent / null / blank = not given, else `{ok: false, error, code: "invalid-arguments",
  invalid: [name]}` in the MCP validator's words. `parseFlow`, `sizeInput`, `langOption`, the backlog / milestone / templates /
  tracks / feature actions (feature's: `blankGiven`), export's format, create's kind (`blankGiven`) and impact's phase read
  through it — a new enum does too; a refusal the engine returns whole carries the code to the CLI's `--json` as MCP's does.
- **Per command:** `checkCommandArgs()` refuses, before anything runs, a known flag the command doesn't read
  (`cliOutput.flagNotFor`) and an argument past its `max`; `--json`, `--project`, `--help` are global (`GLOBAL_OPTIONS`);
  `backlog`, `log` and `feature` check theirs per action. Contradictions are usage errors (`depend … --clear`, `--timeout`
  without `--run` — `needsRun`, `--run` with `--evidence` — `runOrEvidence`…). A single-value flag given twice is refused
  (`refuseRepeatedFlags()`); `REPEATABLE_FLAGS` (`repeatable: true`) are read with `c.every()`. A bare `--branch` (an optional
  value) reads `true` but stays a VALUE flag; `branchSpaced` refuses `create x --branch tdd` (a track word) as ambiguous.
- **`--project` names an existing folder** (`checkProject()`, cli/main.js): empty, unexpanded, a file or a missing folder is
  refused (`cliOutput.project*`) — `init` alone may create it; on Windows a trailing `"` is dropped (`"C:\dir\"` reaches node
  as `C:\dir"`). A variable that CHOSE the project (`PROJECT_SOURCE`: `flag` · `SPEC_PROJECT_DIR` · `CLAUDE_PROJECT_DIR` ·
  `nearest` · `cwd`) is checked the same, naming the variable; a folder without `.specs/` is fine. An existing `.specs` folder
  (case-blind on Windows / macOS) whose parent is a dev-spec project (`spec.isDevSpecDir`) is refused naming the parent
  (`project-is-specs`) — `.specs/.specs/` would win every walk-up. `version`, `completion` and the status line skip these
  checks.
- **`version` / `--version` / `-V`** (`printVersion()`, cli/commands.js) reports what a bug report needs — the versions, the
  engine's source (`spec.engineSource`) and the project with its `source`; it runs nothing else, never refusing its project.
- **`evals`** forwards every word but the command and `--project` (`evalsArgs()`) — a dropped word could turn `--dry-run` into a
  LIVE, paid run; run-evals.js refuses an unknown flag (exit 2).

### CLI boolean switches are read with `on(k)`, never by truthiness
- **`--x=false` is the string "false".** `normalizeBoolFlags()` turns `true|false|1|0|yes|no|on|off` into booleans for every
  name in `BOOL_FLAGS` and refuses other values. `BOOL_FLAGS` is `[...CLI_SWITCHES]` (mcp/lib/probe.js, 1.30 — `spec.CLI_SWITCHES` is the same Set) — ONE list, which the approval hook's
  lexer (`cliApprovalAction()`) reads too: a new switch goes there (in a CLI-only list the hook would read the next word as its
  value), a new value flag into `VALUE_FLAG_SPECS`. `refuseUnknownFlags()` refuses any other `--flag` (a did-you-mean:
  probe.js `closestName` — the engine's one, which the eval harness and the track / argument refusals read too); `evals`
  is exempt (run-evals.js refuses its own, `dry-run` included); `--` ends the options. An explicit `--include-body=false`
  reaches the engine as false (`boolFlag()`), as on MCP.
- **Help:** `--help` anywhere runs nothing. `<command> --help`, `-h` (a switch) and `help <command>` print `helpFor()` — the
  entry's `help` lines and its `COMMAND_OPTIONS`; otherwise `helpText()`, every entry's lines in table order. A new entry's
  `help` starts `  <name> ` at two spaces (a test checks it).
- **Numbers:** `--cap`, `--max`, `--timeout`, `--min-lines` go through `intFlag()` (an integer ≥ 1, ≤ the entry's `bounds` —
  `--timeout` ≤ 2147483, Node's timer limit; next `--max` ≤ 8; a `[least, most]` pair for dupes `--min-lines`, 4–100 — the MCP
  schema's `minimum` / `maximum`). Where the CLI passes raw strings the engine refuses what the MCP schema
  refuses, in the validator's words (`msg(lang).args`): `taskNumber()` takes digits only (`"1.9"` is not task 1); a task number
  asked for (`askedTaskNumber()`) is an integer ≥ 0, not ≥ 1 — the scanner serves a hand-written "0." task, so refusing 0 would
  loop next → complete; a roadmap `order` is a SAFE integer (`orderInput()`).

### Shell completion — `completion <powershell|bash|zsh|fish>`
- **The script** is built by `completionModel()` from the command table — commands, aliases, flags, `COMMAND_ARGS` (an
  entry's `args` / `sub`: per position words or a `@source`) and `FLAG_VALUES` — with the value lists read from the facade
  (`LANGS`, `VALID_TRACKS`…) or the CLI, never copied. cli/completion.js fills the shell's template
  (`cli/completion/dev-spec.{bash,zsh,fish,ps1}`; `#@` lines are maintainer notes; LF always).
- **One algorithm in the four:** walk the words before the cursor (a value flag eats the next one, `--` ends the flags) → the
  command and position; then the flag's values (`--flag=` keeps its prefix), the flags, the commands or the position's spec.
  Shell gotchas: bash 3.2 has no associative array (a `case` per table); a fish `switch` reads `*` as a wildcard; PowerShell
  names are case-blind (never `$T` beside `$t`) and its script is ASCII (5.1 decodes native output with the OEM code page).
- **Feature names** are the one call on Tab: `dev-spec __complete features|archived [--project <dir>]`, handled on the CLI's
  first lines (cli/completion.js `complete()`) with Node core and mcp/lib/probe.js only — the project rule and the resolver
  walk and (1.30.1) the resolver itself, `resolveProjectDir` — plus a small mirror of `listFeatures`' folder rule (`isFeatureFolder`);
  never an error, exit 0, about Node's startup. cli/tests/16-conventions-completion.js compares it with the engine on 8 layouts and
  checks no mcp/lib module but probe.js loads — **change the listing rule and the mirror follows**.
- **The CLI the script runs** is resolved on Tab: in a plugin's versioned folder the newest installed `<version>`, else this
  CLI's path, else a `dev-spec` on PATH. The tables are the generating version's: save the script again after an update.

## History
How the rules above came to be, section by section — grep a release (`1.21.1`) or a finding id (`M8`, `r6 B3`) here.

### Feature folders — the feature resolver
- **v1.11 (Critical)** — an empty slug (non-Latin names, `...`, `undefined`) resolved to `.specs/` itself, so `spec_feature
  remove` deleted every spec: every name-taking op went through the resolver. Accents were transliterated from 1.11 on; the
  pre-1.11 slug (`autentica-o`) stays the fallback.
- **1.13** — `spec_feature remove` needs `confirm: true`; rename follows `_Supersedes:` and archived records.
- **1.14 / 1.15** — `templates` / `exports` (1.14) and `tracks` (1.15) joined `steering` as reserved slugs, each with the
  pre-existing-feature exception.
- **1.21 F5** — the change kind: a change's requirements.md / tasks.md are its change.md (`changeAlias()`).
- **1.23 review 5** — spec_create on an existing folder says it is a re-run (`createExisted`, `createSummaryKept`); a long name
  reaching another long-named feature is refused (`slugTaken`) — it answered ok and dropped the new summary.
- **1.24 r6** — "never through a link" for spec_init / steering_scaffold / spec_create / add_track; a linked feature folder is
  removed as the link alone (the feature lock was created THROUGH the link: a `.lock` left in the target).
- **1.24 r6 G4** — `specNameText`: "Login <!-- v2" opened a comment in every title that hid the scaffold's criteria (the slug
  stayed the name's).
- **1.24 r6 G5** — rename drops a backlog item named like the new slug (it was listed under Features and Backlog).

### The project folder: `resolveProjectDir()`
- **1.23 review** — the walk up to the nearest dev-spec project: run from a subfolder, `create` / `backlog add` started a SECOND,
  nested .specs/ there. Unexpanded variables fall through: `SPEC_PROJECT_DIR="${CLAUDE_PROJECT_DIR}/"`, `$CLAUDE_PROJECT_DIR` or
  `%CLAUDE_PROJECT_DIR%` created that literal folder (only a whole `${VAR}` was caught).
- **1.24 r6** — the MCP server validates a tool's `projectDir` like the CLI's `--project`.
- **1.24 r6 B9** — `ears missing.md` answered "Feature 'missing-md' not found" → `cliOutput.earsNoFile`.
- **1.25.1 review 7** — `expandHome()`: `~/zz` made a folder named `~` in the working folder (the CLI's `--project` / the env
  through cli/completion.js, the server's projectDir, the status line's candidates).
- **1.27** — ONE project rule, mcp/lib/probe.js `isDevSpecProject`, for the engine, the hooks, the status line and the
  completion. Until 1.26 there were four variants: the engine's `isDevSpecDir` read roadmap.json, steering/ or a feature's
  .state.json only (this note said so); a .specs/ holding only a classified feature was a project to the Stop and observe
  hooks, not to the edit guard or the status line; a generated ROADMAP.md (all a v1.8-era project has) counted for two hooks
  only. cli/completion.js stopped mirroring `nearestProject` / `isDevSpecDir` / `isNetworkPath` and requires probe.js.

### The write gate
- **1.24 r6** — ONE gate for every write under .specs/. A committed `.specs/<feature> -> ~/elsewhere` got every tick, approval,
  brief, decision, retro.md and the lock written into the folder it pointed at; `.execution/merge-summary.md -> ~/.bashrc` got
  the merge summary written into the user's shell profile (the in-place `fs.writeFileSync` of the derived files and the appends
  followed file links; `writeFileAtomic`'s rename replaced a file link but wrote through a folder link). The refusal reached the
  CLI as a raw EEXIST / ENOTDIR / EISDIR stack until the facade answered it. A lock released between the gate's lstat and its
  realpath was judged "a link": its waiter was refused, and one of two racing backlog adds was lost now and then.
- **1.25** — `removeEmptySpecDir` (the ADR export's emptied folders).
- **1.25.1 review 7** — the raw-write guard covers mcp/evals/: the eval harness's raw fs.writeFileSync of evals/baseline.json
  followed a link under .specs/.

### The read gate
- **1.41.1 (dev-guardian 3.17 triage, R2)** — the writes were gated since 1.24, the reads followed a committed link: a linked feature
  folder, a linked steering/ or a file link (tasks.md, requirements.md, decisions.md, test-plan.md) had its text quoted into next_task,
  the brief, trace, the catalog / SPECS.md, retro.md, a merge summary's title, a new decisions.md's header; only the verbatim copies used
  `readContained`. ONE predicate in the read primitives (the write gate's, memoized) + `feature-linked` in the resolver. A prototype of
  the gate alone (no resolver) broke exactly the six 1.24 linked-folder tests — and read a linked roadmap.json as off for the approval
  guard (meta `{}` while the raw existence check said present): hence the GONE rule on both sides.
- **1.41.1 fix round 1** — the root was the NEAREST folder named `.specs` (1.24's root rule): a link named `.specs` below the project's
  `.specs/` reset the gate (spec_impact's snapshot path read through it), a project below a folder named `.specs` had its code gated,
  and the name test was case-sensitive where `withinRoot` folds. `gateRootOf` stands on the call's project (`GATE_BASES`), for both
  gates. A project-wide drift paid +2 lstat +1 realpath per feature folder its own listing had named: the listings seed the memo.
- **1.41.1 fix round 2** — review 2: five entries read in a scope that never reached `specsRoot` (spec_scan, the server's approval
  meta, `ears <file>`, the resources' `isFeatureFolder`, and — found by the new property — `dev-spec spike`'s `spikeInfo`): on a
  project below a folder named `.specs` whose `.specs/` is a junction they stood on the outer folder. The save hook took the
  nearest folder named `.specs` as its project (round 2 changed it; round 3 took that out — the known limit above). The NTFS
  stream spelling of `.specs` was no root; a FIFO part was opened (the hook review: the call never returned); BMAD's `isDir` read
  the last part only (an oracle on the outside folder's contents).
- **1.41.1 fix round 3** — review 3 (R3-R-1, MEDIUM): round 2's save-hook project (the gates' root with the env anchors) fell back
  to the outermost `.specs` when no anchor held the saved file — on a link-free project below a folder named `.specs` the hook went
  silent, no `lastEditAt`, and the Stop gate no longer blocked a hand-ticked "all done". Reverted to the nearest-`.specs` text
  walk (which also drops R3-R-2's realpath of a UNC `~1` segment); R2-R-2 is a known limit.

### The dry-run sink
- **1.25** — the sink (`withDryRun`), for `spec_import {dryRun}`: one switch in the write primitives, made possible by the 1.24
  write gate routing every write through them.

### JSON state
- **1.11 / 1.12** — a roadmap.json / .state.json that didn't parse was "repaired" into `{}`, erasing deps, backlog, approvals and
  `meta.lang`; it became an error. **1.13** — valid JSON of the wrong shape refused too; `writeFileAtomic` stopped leaving its
  `<file>.<pid>.<ts>.tmp` in `.specs/` when a best-effort refresh's rename failed for good.
- **1.23 (r5 review)** — the readers say a broken state (doctor, next_action `fix`, finish, the status line): read as empty,
  every gate looked pending and next_action said "approve".
- **1.25.1 review 7** — durable and never torn in place: the temp file `wx` and fsynced before the rename, the folder fsynced
  after (a crash right after the rename could leave the new name with no data); the Windows rename retries went from ~60 ms to
  ~1.6 s (5 … 800 ms backoff); the in-place `writeFileSync` fallback was removed — it truncated the file first (a crash, a full
  disk or a concurrent reader met it empty or half written) and followed a link the gate had checked a moment before. Chosen
  over a `.bak` copy: nothing to clean up or recover by hand, the gate's guarantee kept whole. The fsync measured ~0.5 ms per
  write (Windows / NTFS).

### Merging the spec state
- **1.21 F1a** — the merge driver: two branches that both approved, ticked or recorded evidence conflicted in `.state.json` /
  `roadmap.json`.
- **1.21 review A1** — `pruneSignoffs()` on the 3-way result: a stale `signoffs.<phase>.<role>` stayed next to the other side's
  later approval when only one side changed `signoffs`.
- **1.21 review A3** — the stale driver path after a plugin update (git reported CONFLICT, doctor saw nothing, `git add` dropped
  theirs) → `merge-state --check` and the SessionStart line; the bare `merge-state --check` switch.
- **1.21 review A7** — a re-merge with an unresolved `mergeConflicts` list lists each conflict once (`mergeCanon`).
- **1.22 review** — `lastEditAt` (the spec-hook's stamp) merges as the later. **1.22 review 3** — a run's `cmdRule` and `root`
  travel with it.
- **1.23 (r5 review)** — tasks sharing the number n keep every other task's record in `others` (they were dropped, and that
  task's runs merged into the winner's history); `pruneRevokedApprovals()` on the result (when only one side changed
  `approvals`, an approval older than the other side's revocation survived); `roleOnly` partial revocations (one role
  withdrawing its own sign-off).
- **1.24 review 6 (E2, E5)** — E2 `staleMergedEvidence()`: the branch's run of the task made BEFORE a reopen / untick won as
  the later run, unmarked, and a re-tick with no new run read verified (finish and the execution sign-off passed). E5
  `breakMergedCycles()`: alpha → beta here and beta → alpha there merged clean, and every later `depend` was refused on it.
- **1.25** — `branch` (create --branch) merges as the earlier record.
- **1.25.1 review 7** — `--install` / `--uninstall` lstat `.gitattributes` first: a cloned repository's link made --install
  write into the file it pointed at.
- **1.36** — `meta.reviewModels` needs no rule of its own: the default 3-way per key gives the conflict an ordered, capped
  list needs; a test holds it there. `protectedTests` (guard tests) got one: the design's "the earlier snapshot's hash wins"
  would have reverted a tick's re-baseline made on one branch — files merge 3-way, both-changed keeps ours with no conflict.
- **1.36.0 review 3** — the accept record (`{…, accepted: true}`, `feature protect --accept`) lives in `protectedTests.lifts`:
  `LIFT_ID` gained `accepted`, so it never merges into a lift or an end of the same file, time and user (no new key).
- **1.41.0** (the gardening round) — two new state fields and no merge rule: a run's `metrics` (as 1.36's `fast`) and
  `finished.metrics` ride with the record their existing rules already pick (the later run, the later finish). The rest of
  the round adds no state on purpose. The friction budget's `ms` per run was cut from `.state.json` (a per-machine number
  nothing judges, churning a committed file on every re-run): it lives in the git-ignored timings.jsonl. The lessons
  (lifecycle.md → Decisions and spikes) are `_Kind: lesson_` entries of the committed decisions.md, which has the lock, the
  append, the supersession and the readers already; a `.state.json` key would need a writer and a merge-driver rule, a
  project-level file a conflict on every merge. decisions.md merges as text — its known limit.

### The locks
- **1.13** — the cross-process feature lock: two MCP servers (or MCP + `dev-spec done`) on one feature lost ticks and evidence
  while both answered ok. Mutual exclusion under contention: a failed stat read as stale, a waiter deleting the next holder's
  fresh lock, a release of someone else's lock. A stuck lock's `continue` spun at 100% CPU forever and froze the MCP server.
  Folder moves under the lock: a rename mid-write recreated a zombie `.specs/<old>/` (ticks in one folder, the spec in the
  other; the brief recreated `.specs/<old>/.execution/`), and a lock left at the new place kept the renamed feature "busy". The
  lock stress test: the note hard-linked into place (a process killed in the create→write window left an EMPTY lock that
  blocked the feature for 2 min); `LOCK_DEADLINE` (nested waits added up to twice the wait); `renameDirSync`'s 60 ms of retries
  answered a raw EPERM under contention; `remove`'s tombstone (an in-place `fs.rmSync` deleted the .lock early, a waiter wrote
  into the half-deleted folder and the removed feature came back — .state.json, .history/ — after an ok remove). The lock files
  git-ignored: a lock leaked by a killed process was committed by `git add -A` and made the feature "busy" on every clone (fresh
  checkout mtime, foreign host → no pid probe).
- **1.23 (r5 review)** — `PROCESS_START_MS` (a recycled pid's own lock), the age of a future-dated lock (`Math.abs`), and a lock
  create refused after the note's temp file is waited for (it ran UNLOCKED after 10 refusals).
- **1.25.1** — `lockGateError()` retries a "delete pending" lock: 2 of 180 contended backlog adds were refused.

### Flush stdout before exiting
- **1.14** — the harnesses and the MCP server flush before exiting: on a Linux pipe the tail (FAIL lines, the total) was
  dropped, and a slow reader got 0 of 8 replies.
- **1.22 review** — the pre-commit validator loads the engine only when a staged spec file needs it (most commits paid ~130 ms
  for the require).
- **1.23 review** — stdin collected as bytes: a UTF-16 document (Windows PowerShell 5.1's `>`) read as "0 criteria, pass" in
  `ears -`.
- **1.24 r6 B2** — `stdoutError()`: `console.log` swallowed its own write errors, but `process.stdout.write` (export, catalog,
  changelog, rules, trace --csv, prompts) raised an unhandled `'error'` — a stack trace and exit 1.
- **1.24 r6 B-I9** — `cliOutput.stdinHint`: stdin from a terminal looked hung.
- **1.27** — nothing in the CLI exits but its entry point (it called `process.exit()` in many places).
- **1.27.1** — the six hooks' own stdin readers, safety nets and `finish()` copies became hook-utils.js `runHook` / `finish`.

### Calendar dates and timestamps
- **1.25.1 review 7** — `today()` / `dayOf()`: `toISOString().slice(0, 10)` (eleven places and two helpers, `todayIso` /
  finish.js `day`) gave the UTC date — written between 00:00 and 01:00 in Lisbon summer time it was the day before (a decision,
  a spike's timebox, an import note, a template's `{{date}}`, the retro, the release notes, the forecasts' "today").

### The CLI is one table and one call
- **1.25.1 review 7** — terminal-safe output: a raw ESC / OSC sequence or a lone carriage return in a cloned tasks.md made
  `done --run` show `$ npm test` while it ran another command. The engine loads on first use (`loadSpec()`).
- **1.27** — the command table (`COMMANDS`) and the call contract (`main(argv, io)`, `CliExit` — it was `process.exit(1)`); the
  CLI split into cli/dev-spec.js, cli/main.js, cli/commands.js, cli/run.js and cli/git.js; `guarded()` became the one choke
  point.
- **1.30 review 8 (ds-maint 3)** — an option was declared in 5–6 places (the schema, the operations table's `cli`, the
  command's `options`, its help, `CLI_SWITCHES` / `VALUE_FLAG_SPECS`), kept consistent by tests: 37 of the 43 commands that run
  operations now take their `options` from the table (`options: TABLE`, `cliOptions`); the help, completion and every
  `COMMAND_OPTIONS` entry stayed byte-identical (the table's args were put in the help's order for create, approve, feature,
  import and decide). Switch vs value still comes from `CLI_SWITCHES` / `VALUE_FLAG_SPECS` (the approval hook's lexer reads them).
- **1.30 (review 8, ds-maint finding 13)** — `help <command>`, `<command> --help` and an unknown command each loaded the whole
  engine to print text (+170–185 ms over `node -e 0`), and every call required cli/run.js and cli/git.js. Measured (Windows, Node 26,
  median of 21 interleaved fresh processes, `node -e 0` 51 ms): `help approve` 164 → 82 ms, `approve --help` 163 → 86, an unknown
  command 167 → 79 (`version`, which loads the engine, 166 → 164).
- **1.30.1** — a command's own usage error still loaded the engine: ~25 handlers read `projectDir` (the engine's resolver) before
  their usage check. THE resolver moved to mcp/lib/probe.js (files.js's and the completion's mirror read it: one copy of the
  precedence) and the CLI reads it without the engine; `--lang` / an integer flag are refused from the i18n tables, `prompts` and
  `import` check their usage first. 256 usage-error calls (every command's, text and `--json`, in a PT project and outside one)
  compared with 1.30.0's: byte-identical stdout, stderr and exit codes; the engine loaded in 12 instead of 122. Measured (Windows,
  Node 26, median of 21 interleaved fresh processes, `node -e 0` 64 ms): `done` alone 228 → 108 ms, `approve` 215 → 116, `trace`
  229 → 108.

### CLI exit codes and `--json`
- **1.12** — the scriptable exit codes. **1.13** — `--json` prints refusals (`fail(r)`).
- **1.22 review** — `dev-spec evals` passed a killed run (`status || 0`); `--json` on a text-only command printed the text with
  exit 0.
- **1.23 review** — `die()` answers `{ok: false, error, code}` under `--json`; an engine exception too (it was the raw message on
  stderr alone).
- **1.25** — `create` / `bugfix` / `spike --branch` exit 1 off their branch.
- **1.25.1 review 7** — the stable `code` of each usage error; `merge-state --json` printed nothing for a hand-written overview
  or an unparseable side.

### CLI arguments
- **1.13** — `--lang` is checked against the MCP enum (the engine saved `fr` as `en`).
- **1.30 review 8 (ds-maint 12)** — seven copies of the enum check (`parseFlow`, `sizeInput`, `langOption`, the backlog and
  milestone actions, export's format, create's kind) became `enumArg`; the templates / tracks / feature actions too, whose CLI
  refusals had words of their own ("Unknown templates action 'x' — one of: …", "action must be one of: remove | archive | …")
  and no code where MCP answered `invalid-arguments`.
- **1.23 review** — each command reads its own options and arguments: `approve <f> <phase> --remove` (meant --revoke) approved,
  `done <f> 3 4` ticked task 3 alone. **L14** — `--project` names an existing folder: `create x --project <typo>` created the
  whole mistyped tree. **P1** — `evals` forwards every word: only the words after the feature were forwarded, so `evals
  --dry-run <f>` ran LIVE (paid calls); run-evals.js ran on `--dryrun` and on `--help`.
- **1.24 r6 B4** — the per-action arguments of `feature` and the contradictory pairs. **B5** — a single-value flag given twice:
  `approve … --role tech --role product` signed for product alone. **B1** — the environment checked like `--project`: a mistyped
  `SPEC_PROJECT_DIR` created that tree, a file ended in a raw ENOTDIR, and `list` answered "No features". **B7** — a project's
  own `.specs/` as the project created `.specs/.specs/`, which then won every walk-up. **B-I1** — `version` / `--version` /
  `-V`.
- **1.25** — `--branch [<name>]`, the first value flag with an optional value.
- **1.25.1 review 7** — `next --max` bounded like the schema (≤ 8); a single-dash `-j` read as a feature name.

### CLI boolean switches
- **1.13** — `--x=false` honored: `done --run=false` ran the `_Verify:_` commands. `refuseUnknownFlags()`: `done 2 --rnu` ticked
  the task with no evidence.
- **1.14** — `BOOL_FLAGS` became `[...spec.CLI_SWITCHES]`, the list the approval hook's lexer reads.
- **1.30 (review 8, ds-maint 13)** — `CLI_SWITCHES` moved from engine/guards.js and `closestName` from engine/core.js to
  mcp/lib/probe.js (one copy; the engine and the facade export the probe's): a mistyped `--flag` loaded the whole engine (~0.17 s) to be
  refused. Switch-vs-value stays a hand-kept list (not derived from the operations table's `type`): a third of the switches are
  `parsed` arguments whose `cli` list mixes switches and value flags (export's `--md` … `--tracker`, done's `--run` / `--evidence`,
  append-tasks' `--parallel` / `--expect-fail`), the rest commands with no operation (`--print-config`, `--install`) and the globals;
  cli/tests/02-surfaces-parity.js holds every `type: switch | bool` argument to the list.
- **1.22 review** — the validator's own words (`msg(lang).args`): `-1` read "must be an integer".
- **1.24 r6 B-I3** — per-command help (`helpFor()`); `-h` became a switch (`status -h` looked for a feature "h"). **B6** —
  `--timeout` ≤ 2147483 (`cliOutput.atMost`). A roadmap `order` became a safe integer: `99999999999999999999` matched the digits
  and was stored as 1e20.
- **1.25** — `dry-run` became a CLI switch (`import --dry-run`), skipped under `evals`.
- **1.27** — `helpText()` derived from the table: exactly the lines the pre-1.27 rule cut out of the whole help (a test checks
  it).
- **1.28** — `tests` became a CLI switch (`dupes --tests`); `bounds` takes a `[least, most]` pair (`dupes --min-lines` 4–100,
  the schema's minimum — `--min-lines 3` passed the old ≥ 1 rule where MCP refuses `minLines: 3`).

### Shell completion
- **1.25** — `completion <shell>` and the hidden `__complete`; `IMPORT_TOOLS` among the value lists. `__complete` measured ~80
  ms on Windows against ~70 ms for `node -e 0` and ~450 ms for `list`.
- **1.27** — the scripts' rows follow the table's order; `complete()` requires mcp/lib/probe.js instead of mirroring the engine's
  project rule.
