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
  `.specs/<feature>/` (`linked: true`, nothing written); tasks.md is read through `readContained`.
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
- **Every surface's default** (files.js): the explicit argument (`--project`, a tool's `projectDir`) > `SPEC_PROJECT_DIR` >
  `CLAUDE_PROJECT_DIR` > the nearest folder at or above the working one holding a dev-spec .specs/ (`nearestProject()`: the
  working folder itself with ANY `.specs/`; ≤ 64 levels; never up a network path — without the walk a subfolder run would
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
- **It refuses** (`specsWriteBlock`: lstat of each part below the nearest `.specs` — `specsRootOf` — plus one realpath) **a link
  on the way** — a folder between .specs/ and the target, or the target, that is a symlink / junction or resolves outside the
  real .specs/ — and **the wrong kind** (a file where a folder is needed, or the reverse). .specs/ itself may be a link; only
  what lies below it is checked. A part gone between lstat and realpath (a lock just released) is judged by its folder
  (mcp/tests/12-lifecycle-review6.js). `createOnly` passes an existing link target ("wx" never writes through it). **Why:** a
  committed link under .specs/ (`.execution/merge-summary.md -> ~/.bashrc`) would get spec text written where it points.
- **The refusal** is an Error (`code` ESPECSLINK / ESPECSKIND, `gate`, a localized message — `err.specsLinked`…) that the
  facade answers as the call's result (`gateRefusal`: `{ok: false, linked | wrongKind: true, path, error}`) on every surface.
  Feature mutators meet it at their lock, before any write (`featureLocked` / `withMoveLock`); best-effort writers swallow it.
- **Removals go through it too:** `removeSpecFile` (a link AT the path unlinked as the link), `removeEmptySpecDir` (an EMPTY
  folder, never a link — rmdir would drop a junction). **Known limit:** a second write in one call can be refused after the
  first landed (a linked tasks.md: the evidence recorded, the tick refused) — but nothing is written THROUGH a link.

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
- **Hooks** read stdin asynchronously (never `fs.readFileSync(0)`) and exit in the write callback; **the test harnesses** exit
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
  true)`). mcp/tests/16-conventions-review7-core.js guards it, with a child in Tokyo (`TZ` through the child's env — a Git Bash
  `TZ=… node` prefix doesn't reach Node on Windows).

### The CLI is one table and one call
- **The modules:** cli/dev-spec.js is the entry point alone (`__complete` first, then `main(argv, io)`, the exit once output
  has flushed); cli/main.js the command line, the shared checks, the dispatch; cli/commands.js the commands; cli/run.js the
  user's commands (`execCommand`); cli/git.js every git call (`gitRun`: one environment, the user's locale — never parse git's
  words); cli/completion.js the completion.
- **The table:** every command is ONE entry of `COMMANDS` (cli/commands.js) — `name`, `aliases`, `options` (value flags from
  `VALUE_FLAG_SPECS`, else switches of `spec.CLI_SWITCHES`), `max`, `bounds`, completion `args` / `sub` / `values`, `text`,
  `help` and `run(c)`. `VALUE_FLAGS`, `COMMAND_OPTIONS`, `COMMAND_ARGS`, `FLAG_VALUES`, `TEXT_ONLY_COMMANDS`, `HELP_ALIASES`,
  `helpText()` / `helpFor()` and `completionModel()` are DERIVED — never hand-written. A new command is an entry, a new flag a
  name in each reading entry's `options` (extending.md); one without a structured result says `text: true`.
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
  (`statusProbe`) and the bare help (`BARE_HELP`) never load it, so nothing at the top of cli/main.js or cli/commands.js may
  read `spec.*` at load (`BOOL_FLAGS()`, `spec.LANGS` are read on use).

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
  name in `BOOL_FLAGS` and refuses other values. `BOOL_FLAGS` is `[...spec.CLI_SWITCHES]` — ONE list, which the approval hook's
  lexer (`cliApprovalAction()`) reads too: a new switch goes there (in a CLI-only list the hook would read the next word as its
  value), a new value flag into `VALUE_FLAG_SPECS`. `refuseUnknownFlags()` refuses any other `--flag` (a did-you-mean); `evals`
  is exempt (run-evals.js refuses its own, `dry-run` included); `--` ends the options. An explicit `--include-body=false`
  reaches the engine as false (`boolFlag()`), as on MCP.
- **Help:** `--help` anywhere runs nothing. `<command> --help`, `-h` (a switch) and `help <command>` print `helpFor()` — the
  entry's `help` lines and its `COMMAND_OPTIONS`; otherwise `helpText()`, every entry's lines in table order. A new entry's
  `help` starts `  <name> ` at two spaces (a test checks it).
- **Numbers:** `--cap`, `--max`, `--timeout` go through `intFlag()` (an integer ≥ 1, ≤ the entry's `bounds` — `--timeout` ≤
  2147483, Node's timer limit; next `--max` ≤ 8). Where the CLI passes raw strings the engine refuses what the MCP schema
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
  walk — plus a small mirror of `resolveProjectDir`'s precedence and `listFeatures`' folder rule (`isFeatureFolder`); never an
  error, exit 0, about Node's startup. cli/tests/16-conventions-completion.js compares it with the engine on 8 layouts and
  checks no mcp/lib module but probe.js loads — **change the precedence or the listing rule and the mirror follows**.
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
- **1.22 review** — the validator's own words (`msg(lang).args`): `-1` read "must be an integer".
- **1.24 r6 B-I3** — per-command help (`helpFor()`); `-h` became a switch (`status -h` looked for a feature "h"). **B6** —
  `--timeout` ≤ 2147483 (`cliOutput.atMost`). A roadmap `order` became a safe integer: `99999999999999999999` matched the digits
  and was stored as 1e20.
- **1.25** — `dry-run` became a CLI switch (`import --dry-run`), skipped under `evals`.
- **1.27** — `helpText()` derived from the table: exactly the lines the pre-1.27 rule cut out of the whole help (a test checks
  it).

### Shell completion
- **1.25** — `completion <shell>` and the hidden `__complete`; `IMPORT_TOOLS` among the value lists. `__complete` measured ~80
  ms on Windows against ~70 ms for `node -e 0` and ~450 ms for `list`.
- **1.27** — the scripts' rows follow the table's order; `complete()` requires mcp/lib/probe.js instead of mirroring the engine's
  project rule.
