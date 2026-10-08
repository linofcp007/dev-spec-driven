# Claude Code integration — hooks, guards, commands, status line

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
The hook rules, guard mode (edit guard), the human approval guard, the status line, user defaults, MCP annotations and
the plan-mode bridge. The hooks.json rule is in CLAUDE.md; the scope guard's rule is in tasks-and-evidence.md →
End-of-turn evidence gate and scope guard. A hook's process I/O and its folder lookups follow conventions.md — flush stdout
before exiting (never `process.exit()` right after a write), a feature's folder through `resolveFeature()` /
`existingFeature()`.

## Hooks and commands (from Conventions & gotchas)
- **Hooks never block and stay cheap.** Every hook exits 0 on any error or irrelevant event, emits at most
  one JSON object, has a 10 s timeout, and only acts on a `.specs/` dev-spec owns (`isDevSpecProject` — checked by
  PostToolUse AND SessionStart: another tool's `.specs/` gets no status block in every session). The PostToolUse hook:
  requirements.md → EARS + placeholders, tasks.md → every trace gap + EC/NFR/SC warnings (and, tasks.md / change.md, the
  feature's `.state.json lastEditAt` stamp the stop gate reads as activity — `recordSpecEdit()`, 1.22 review), design.md →
  `designSaveCheck()` (active tracks' marker sections, Constitution Check, placeholders); it skips `/.execution/`,
  `.specs/templates/` (unless that folder is a pre-1.14 feature), `.specs/tracks/` (1.15, the same exception) and generated files.
  It loads the engine LAZILY (1.22 review): only for SessionStart and a PostToolUse on a `.specs/` file outside `.execution/` —
  the plain path check runs first (an edit anywhere else cost the engine's ~100 ms load: 173 → 68 ms median per Write / Edit,
  `node -e 0` ≈ 61 ms; mcp/tests/10-guards-review.js asserts which events load it). The Stop / SubagentStop hook
  follows the same rules (see End-of-turn evidence gate), and so do the 1.14 observe hook (it prints nothing at all and
  exits as soon as it has appended its line) and approval hook (silent unless `meta.approvalGuard` is on — its only
  output is a permission decision).
- **Which project a hook reads (1.23 review 5, M8): `sessionProject({cwd, anchors})`** (engine/guards.js, on the facade). The
  MCP server is pinned to `SPEC_PROJECT_DIR` = `${CLAUDE_PROJECT_DIR}` (the folder Claude Code started in) and records approvals,
  ticks and evidence THERE; the hooks read the payload's `cwd` first — in a git worktree (EnterWorktree, a subagent `cd`'d into
  `.claude/worktrees/<n>` or a sibling checkout) the worktree's own copy of `.specs/`: the edit guard asked though the tasks were
  approved, the stop gate saw no activity, the SubagentStop gate looked for the report where the implementer hadn't written it.
  The resolver: the nearest folder at or above `cwd` holding a dev-spec `.specs/` (`sessionSpecs`: `isDevSpecDir` or a feature's
  classification.md; ≤ `SESSION_MAX_UP` = 40 levels — a `cd`'d subfolder too —, never above an anchor that holds `cwd`: a dev-spec
  folder above the session's own is another project; a network cwd is only itself), then `worktreeProject(near, anchors)`:
  `gitCheckoutOf()` reads the nearest `.git` (a FILE: `gitdir:` → its `commondir` → `linked`; a submodule's `.git` file has no
  commondir — no worktree); near in another checkout of the same repository as an anchor (`CLAUDE_PROJECT_DIR`,
  `SPEC_PROJECT_DIR`; the status line's `workspace.project_dir`) → the same folder in the anchor's checkout; else, near in a
  linked worktree → the same folder in the main checkout (the common dir's parent) — when that counterpart is dev-spec's.
  Folders are compared by text, then by real path (`sessionSame()`: git writes gitdir / commondir with long names, the payload
  may carry an 8.3 short name). No dev-spec folder near cwd → the first dev-spec anchor. → `{project, root, worktree}`;
  `sessionPath(s, p, cwd)` spells a payload path under `project` when it lies in `root` (the worktree's checkout). The guard,
  stop and observe hooks keep a raw pre-check over the nearest `.specs/` above cwd and the anchors (a superset; the engine
  loads only when it passes) and then ask the engine; the spec-hook stamps `lastEditAt` of a worktree's tasks.md save in the
  mapped project (its own state when that feature isn't there) and SessionStart reports the mapped project; the status line's
  `statusLineProject()` maps what it found the same way (`worktreeProject(dir, candidates)`).
- **Commands never reuse a Claude Code built-in name.** `/init`, `/status`, `/doctor` and `/commit`
  collided with the built-ins (a bare `/doctor` ran Claude Code's, and our own messages told users to
  "run /doctor"); they are `/spec-init`, `/spec-status`, `/spec-doctor`, `/spec-commit` since v1.11.

## Guard mode (1.13 — from Catalog, drift, restore, guard, steering)
- **Guard mode:** `roadmap.json → meta.guard` (`spec_init {guard}` / `init --guard on|off`, with or without
  tracks). `hooks/guard-hook.js` (PreToolUse, `Write|Edit|NotebookEdit` — 1.23 review 5: MultiEdit, a tool Claude Code no
  longer has, left the matcher; a MultiEdit payload is still read) is **silent unless the
  guard is on** — guard off costs one small raw JSON read, the engine is loaded only for guarded projects —
  and `guardCheck()` reads roadmap.json + each feature's `.state.json` / tasks.md, never a repo walk. "Code" is
  `isCodeFile(rel)` (engine/scan.js) — 1.21.1: ONE notion of code the guard, the brownfield scan, `spec_coverage` and the
  test-code scan share: `CODE_EXT` (JS/TS incl. `.mts`/`.cts`, Python, Go, Rust, JVM, .NET, C/C++ `.cc`/`.hpp`,
  PowerShell `.ps1`/`.psm1`, shell, Windows `.bat`/`.cmd`, `.sql`, `.ipynb`, Lua, R, Perl, Elixir/Erlang, Haskell,
  Clojure, CUDA, Fortran, HDL, shaders, code-bearing templates like `.erb`/`.razor`…) plus a test-only extension
  (`TEST_EXTRA_EXT`: a `.bats` suite, Perl's `.t`) on a file that IS a test (`isTestFile`: `t/basic.t` yes, `notes.t`
  no). `GUARD_CODE_EXT` = `CODE_EXT` + `TEST_EXTRA_EXT`, the extension-only allow-list trace's `plannedOutsideCode` and
  the reuse check read. The scan, coverage and the test-code scan also set test fixtures apart (`isTestFixture`: a `.sql` /
  `.ipynb` in a test folder not named like a test is data — 1.21.1 review —, and every file under `testdata/` — 1.22 review; the test-code scan still reads one a test plan's
  File column names — the file, or the folder directly holding it: review 2 / 3); the guard still asks before editing one. Until 1.21.1 the scan's `CODE_EXT` was a short list and the guard kept its own broad one — a
  PowerShell project scanned empty and its tests gate never passed. It is an allow-list, so the docs say "a broad list of
  languages", never "any source file"; add a language to `CODE_EXT` (and to the guard test — mcp/tests/16-conventions.js
  — and, when its tests have a naming convention, to `RE_TEST_NAME` + the `isTestFile` matrix in mcp/tests/13-imports.js)
  rather than rewording. Docs, config, data (a PowerShell `.psd1` manifest), markup and styles stay silent. A code
  edit outside `.specs/` with no non-archived feature holding approved, unfinished tasks gets
  `permissionDecision: "ask"` with a localized reason (a forced tasks approval still counts, with a note). Two exceptions,
  at both levels: a TEST file while some non-archived feature has an approved test plan and is unfinished (why
  `tests-phase` — Phase 4 writes the failing tests before tasks can be approved), and any code edit while an ACTIVE spike
  (undecided, or with open tasks, its timebox not passed) exists (why `spike`, field `spikes` — prototype work; a spike has
  no tasks gate, so it is never listed as "awaiting approval"; at the `scope` level a spike never overrides the approved
  features' plan). A
  tasks approval whose `fingerprint` no longer matches tasks.md (tasks appended/edited after it; ticks are
  normalized) is `stale` — it covers nothing and the reason names it; an approval without a fingerprint counts.
  Inside / outside the project is decided on real paths too (`insideDirAlias()`: an 8.3 short name, a junction or a
  symlink to the project is inside — read only when the text comparison says outside; errors fall back to it). Never for a
  NETWORK path on either side (`isNetworkPath` — the agent's Write target, an absolute `_Implements:_`; 1.16 verify NEW-3):
  its realpath opened an SMB connection to the host the agent named before the permission prompt (a hang, NTLM on Windows);
  `networkPathInside()` decides on the text — inside only under root's own `\\host\share\…` prefix (`\\?\UNC\` = `\\`, case
  folded), so a project on a share stays guarded. 1.23 review 5 (L21): the target is first read as the Windows file system
  reads it (`guardTargetPath(p, win)`, win32 only — elsewhere `:` is a name character and `/c/` a folder): an NTFS stream suffix
  on the last segment is dropped (`a.ts::$DATA` IS a.ts; `a.ts:x` a stream of it) and Git Bash's `/c/…` is `C:/…` — both were read
  as no code / outside and allowed. The save hook (spec-hook) skips a network `.specs/` file outside the session's
  folders the same way. The session's own folders (payload `cwd`, CLAUDE_PROJECT_DIR / SPEC_PROJECT_DIR) are Claude Code's /
  the user's, not the agent's: the stop / observe / spec / guard hooks keep using a network cwd (a project on a share keeps
  its hooks; the observe hook's walk up stops at the share root), never realpath'ed by a hook.
  **It never blocks on its own errors:** a malformed payload, a broken roadmap.json or any exception exits 0.
  1.14 adds the stricter `"scope"` level (see End-of-turn evidence gate and scope guard); a phase still waiting for a
  role's sign-off is not an approved tasks phase.

## Human approval guard (1.14 F2)
- **`roadmap.json → meta.approvalGuard`** = `off` (default; absent = off) | `ask` | `deny` (`APPROVAL_GUARD_LEVELS`, in
  order — a later one is stricter). `spec_init {approvalGuard}` — a plain string enum in the schema — / `init
  --approval-guard off|ask|deny` (anything else: a localized CLI error; `approvalGuardInput()` → undefined leaves it
  unchanged in the engine); written under the roadmap lock, no write when unchanged; the result always reports the
  current `approvalGuard` (+ `approvalGuardNote` when given).
- **The hook** `hooks/approval-hook.js` (PreToolUse, anchored matcher
  `^(Bash|PowerShell|Monitor|Write|Edit|(mcp__.+__)?(spec_approve|spec_feature|spec_init))$` — 1.23 review 5: **Monitor** runs its
  command in the Bash tool's shell with the Bash permission rules, and an approval through it went past a deny-level guard;
  **Write / Edit** of `.specs/roadmap.json` or a feature's `.state.json`, below)
  is silent unless the guard is on: a tool call that can't be an approval (a Bash / PowerShell / Monitor command not containing
  `dev-spec` — the hook's `candidate()` mirrors the engine's `approvalCandidate`, a superset; a Write / Edit of any other file)
  exits before any file read; otherwise ONE raw read of roadmap.json per candidate project — the project the
  call names (MCP `projectDir`, CLI `--project` in the command, the edited file's), the payload `cwd`, `CLAUDE_PROJECT_DIR`,
  `SPEC_PROJECT_DIR` (at most 8; `${VAR}` unexpanded and network paths — `\\host\share`, `//host/share`, `\\?\UNC\…` —
  refused, `\\?\C:\…` is local); the STRICTEST level wins. The engine is loaded only then; it answers
  `{hookSpecificOutput: {permissionDecision, permissionDecisionReason}}` (+ `systemMessage` for deny). It never blocks on
  its own trouble: a malformed payload, a broken roadmap.json or any exception exits 0 silently.
- **`approvalGuardDecision(payload, level, {lang, cli?})`** — PURE (reads nothing) → `{decision: allow | ask | deny, why,
  level, …}`; `why` (stable): `off` · `no-payload` · `not-pre-tool-use` · `not-an-approval` · `approval`. On an approval:
  `actions` `[{kind: approve | remove | guard-down, source: mcp | cli, feature, phase, through, role, by, force, from, to,
  project}]`, `force`, `command` (what the human runs, `!`-prefixed), `reason` (localized, `approvalGuard.ask` /
  `approvalGuard.deny`) and, for deny, `userNote`. What counts: `spec_approve` under ANY MCP server prefix (or bare);
  `spec_feature {action: "remove", confirm: true}` (a preview isn't); `spec_init {approvalGuard}` LOWERING the level
  (raising is always fine); through the Bash / PowerShell / Monitor tool (`APPROVAL_SHELL_TOOLS`; Monitor in bash syntax),
  `dev-spec approve …` (phase or `--through`, `--role`, `--by`, `--force`), `dev-spec feature remove … --yes` and `dev-spec
  init --approval-guard <lower>` — `--help` runs nothing. 1.23 review 5: a Write / Edit / MultiEdit (`APPROVAL_EDIT_TOOLS`) of
  `.specs/roadmap.json` (`setting: "roadmap"`, `source: "edit"`) or of `.specs/**/.state.json` (`RE_STATE_FILE`, `setting:
  "state"`, `feature`: its folder) — a hand edit of the approvals — is a guard-down action, its `project` the folder above
  `.specs/` (`approvalSpecsProject()`); no command to suggest (the user edits the file). And `kind: "unreadable"` (no
  command): `why: "too-long"` — a command past `APPROVAL_COMMAND_MAX` whose UNREAD tail (from 64 characters before the limit)
  names dev-spec or `.specs` (an approval after the first 64 KB went through at deny; a long command whose tail names
  neither is read by its head, as before) — at the guard's level; `why: "unparsed"` (fail closed, `approvalUnparsed()`):
  the lexer found no action, yet the plain text (`approvalPlain()`: string joints `"a" + "b"`, quotes, escapes dropped)
  holds an approval word (`RE_APPROVAL_VERB`) and a simple command — not one the lexer read as the CLI — names the CLI
  (`dev-spec`, a glob matching it, a joined string) under a program that is no text-only one (`APPROVAL_TEXT_PROGRAMS`:
  echo, git, grep, cat, Write-Host…), or a JavaScript runtime's script is a substitution / variable while the command names
  the CLI — `node $p approve …`, `node $(echo cli/dev-spec.js) approve …`, `alias a='node cli/dev-spec.js'; a approve …`, an
  unknown launcher, `pwsh -File run.ps1 node cli/dev-spec.js approve …` — always `ask` (it may be no approval: never refused,
  never allowed).
- **The shell lexer** (`shellCommandWords()`, one linear pass, nothing evaluated): separators outside quotes are newline
  `;` `&` `|` `(` `)` `{` `}` backtick and `$(`; single quotes are literal; inside double quotes a backslash escapes only
  `"` `\` `$` `` ` ``; outside quotes it stays (a Windows path). `devSpecWordAt()`: the CLI's script (`dev-spec`,
  `dev-spec.js` / `.cjs` / `.mjs` / `.cmd` / `.ps1` / `.exe`, any path) counts only in PROGRAM position — after launchers
  and shell keywords (`APPROVAL_WRAPPERS`: node, npx, bun, deno, sudo, env, time, `!`, if/then/do…), env assignments,
  options and a timeout — never as another program's argument (`echo dev-spec approve x`, `git commit -m "…"`).
  `cliApprovalAction()` reads the words after it with `CLI_SWITCHES` (a `--flag` that is no switch takes the next word),
  then again with every flag as a switch. A word holding whitespace and `dev-spec` after an `APPROVAL_SHELLS` program
  (bash, sh, zsh, cmd, powershell, pwsh, eval, iex, Invoke-Expression, Start-Process, wsl, su, watch, flock, script…) is lexed
  as a script in turn, up to `APPROVAL_SHELL_DEPTH` = 3; at most `APPROVAL_COMMAND_MAX` (64 K) characters are read. **1.22
  review — the unquoted forms** (all allowed at deny before): where cmd / pwsh / powershell RUNS (the program position, or a
  `find -exec` command), the words after cmd's `/c` `/k` `/r` or pwsh's `-Command` / `-c` (any abbreviation, `pwshOption()`;
  Windows PowerShell's first positional — its default is -Command; pwsh 7's is -File: none) are joined (`restScript()`, a
  word holding whitespace quoted again) and lexed as that shell's script — `cmd /c node cli\dev-spec.js approve alpha tasks`;
  `Start-Process` / `saps` / PowerShell's `start` → its -FilePath + -ArgumentList (a string, a comma list, an `@( … )` array —
  the lexer's next segment; `startProcessLine()`), lexed as cmd.exe would; `find … -exec <cmd> … ;` → that command
  (`findExecActions()`); `winpty` and `flock` are launchers (flock's lock file is a positional, `APPROVAL_POSITIONALS`; its
  `-c` script and `script -c "…"` are read as shells' scripts). A simple command's nested actions are deduplicated (a quoted
  script is read as a word AND as the joined rest). `echo cmd /c … approve` stays text. **1.23 review 5 — more forms** (all
  allowed at deny before): `cmd //c` (Git Bash's spelling of `/c`); cmd.exe named through `$env:ComSpec` / `${env:ComSpec}` /
  `%ComSpec%` (`RE_COMSPEC_WORD` — `programAt` stops there, `approvalProgram` reads it as cmd); the launchers strace, ltrace,
  unbuffer, chronic, builtin, coproc, tsx, ts-node, nodemon (`--exec`), parallel, valgrind, caffeinate, catchsegv (with their
  value options); a POSIX shell's `-c 'script' arg0 arg1 …` with `$0`…`$9` / `"$@"` / `$*` replaced by those words
  (`withPositionals()` — `sh -c 'node "$0" approve x tasks' cli/dev-spec.js`); `powershell -EncodedCommand` / `-ec` / `-e…`
  (base64 of UTF-16LE, decoded — `decodePwshEncoded()`; `approvalCandidate` decodes too); the CLI fed to node / bun on stdin
  when the command names it (`cat cli/dev-spec.js | node - approve …`, `node - approve … < cli/dev-spec.js` —
  `stdinScriptAt()`); a glob whose last segment matches the script's name (`devSpecGlob()`: `dev-sp?c.js`, `[d]ev-spec.js`;
  `approvalCandidate` lets a glob through only with an approval word); `trap '…' EXIT` (an `APPROVAL_SHELLS` program).
- **ask** → `permissionDecision: "ask"`: the user confirms or declines; the reason names the feature, phase(s), role, the
  `by` and, loudly, `--force`. Claude Code shows a hook's "ask" in auto mode too (the classifier can't approve it silently);
  only bypass-permissions mode may skip it, and dontAsk refuses it (1.23 review 5: these notes said auto mode may skip it —
  code.claude.com permission-modes / hooks). **deny** →
  `permissionDecision: "deny"` (holds in every mode): the reason tells the agent approvals are the human's (stop and ask);
  the user sees `systemMessage` with the command to run — `! node "<clone>/cli/dev-spec.js" approve <f> <phase> [--role r]
  [--force] [--project "…"]` (`approvalCommand()`: a value from the agent's call goes in only when it is plainly safe to
  paste into bash / PowerShell, else a `<placeholder>`; the `!` line run by the agent itself is still an approval).
- **Outside Claude Code the MCP server enforces it (1.21 F1b — mcp.md → Human approvals over MCP elicitation).** The same
  `approvalGuardDecision()` (its result also carries `summary`, the action line) runs inside server.js for spec_approve /
  spec_feature / spec_init: a client with elicitation asks its user (only an explicit approve records it, as `confirmed`); without
  elicitation `ask` runs as before and `deny` is refused with the command (`{plain: true}`: the runnable line without the `!`,
  a reason that doesn't mention it — 1.21 review A4). The plugin's `mcp/servers.json` sets
  `SPEC_MCP_APPROVAL_HOOK=on`: in Claude Code the hook stays the only gate (no second question) — this hook path is unchanged.
- **A guardrail on the approve paths, not a sandbox:** an agent running `node -e` (or a script of its own) isn't caught; a
  hand edit of `.state.json` / roadmap.json through Write / Edit is (1.23), through a shell write only for roadmap.json.
  `spec.CLI_SWITCHES` is the ONE list of CLI boolean switches (conventions.md → CLI boolean switches): a CLI-only switch would make this lexer
  read the next word as its value.
- **The lexer (review fixes).** `shellCommandWords(cmd, mode)` lexes by the tool's shell: `bash` (`\x`, `\⏎`, `$'…'`,
  `$( )` / backticks also inside "…"; `raw` keeps backslashes for Windows paths), `ps` (the backtick is PowerShell's escape
  and line continuation, `@'…'@` / `@"…"@`, `#`, `<# #>`), `cmd` (`^`). Recursive, bounded by `APPROVAL_LEX_DEPTH` (32),
  linear. Redirections go to `redirs`, never words. Heredoc bodies are data: skipped when the delimiter is quoted, only
  `$( )` / backticks read when unquoted, read as a script when fed to a shell (`bash <<EOF`, `sh <<<`); `<<` inside `(( ))`
  is a shift. `programAt()` skips launchers and their value options (`APPROVAL_OPTION_VALUES`: `sudo -u`, `exec -a`,
  `node -r` …) and counts npm / pnpm / yarn / bun / deno only through a real run subcommand (`APPROVAL_SUBCOMMANDS`).
- **Guard-down actions** (`kind: "guard-down"`, `setting`: approvalGuard · evidence · roles · check · stopCheck · guard ·
  roadmap · state) — lowering the guard, and weakening what it protects: evidence observed → reported, approval roles cleared or a
  required role dropped, a project check removed or its command changed, the stop gate off, the edit guard lowered, a
  shell write / move / delete of `.specs/roadmap.json` (or of `.specs/`; `command: null` — the user makes that change), and
  (1.23) a Write / Edit of `.specs/roadmap.json` or of a feature's `.state.json` (`command: null`).
  Judged against the project's meta, which the hook passes in (`opts.meta`); no readable meta → fail closed. Raising,
  adding or a no-op stays allowed. A `roadmap.json` that exists but doesn't parse keeps the strictest `"approvalGuard"` its
  raw text names (`approvalGuardLevel` and the hook). Known limits: inline scripts (`node -e`, `python -c`, a script file the
  agent wrote), a shell variable / alias / function DEFINED in an earlier tool call (the guard reads one command at a time —
  within the same command it asks, as above), splatting, `git -c alias.x='!…'`, a copy or link of the CLI under another name,
  `cd .specs && … > roadmap.json`, a shell write of a `.state.json`, and a NotebookEdit — each would need the agent to try to
  get round the guard, which the deny reason tells it not to do.

## Claude Code integration (1.16 C)
- **Status line** — `statusLine(dir, {columns})` / `statusLineProject(dirs)` (walks up at most 40 folders to the nearest
  dev-spec `.specs/` — 1.23 review 5: in a git worktree, the same folder in the checkout of the payload's `workspace.project_dir`
  or the main checkout, `worktreeProject()` —; reads each active feature's `.state.json` + tasks.md, ≤ 200 features; picks the most recently active
  feature with work under way, else the most recent). The step follows next_action's order but stays cheap — it runs the
  pending phase's approve checks, never the doctor, a code scan or the drift hash (`statusNext()`; review fixes): a spike
  takes next_action's own steps (fill · implement · blocked · decide — the decision, then its `_Outcome:_` · promote /
  archive / pivot); Phase 4 goes through `statusTestsGate()` (+ai's eval-sets check; +tdd answered only when provable
  without the walk — no planned T-ID → fix, every planned T-ID in a test FILE its plan row names, ≤ 20 files read → approve,
  else `tests`); once every phase is approved, a FORCED approval is re-checked (`approvalChecks` minus the checks the doctor
  only warns about, `STATUS_DOCTOR_WARNS`) and a bugfix with bug.md → Root Cause empty → `fix` (file bug.md — never a task the
  bugfix gate refuses); every task done: verify (a tick) → finish (no baseline, or `staleFinish(…, {newFiles: false})` →
  `again`) → verify (`suiteStatus(…, null)`: the project checks without the code hash → `suite`) → sign-off (execution
  missing, or `executionSignOffStale` → `again`) → finished (never "✓": drift is not checked). Step codes (stable): re-review ·
  fill · fix · approve · tests · tasks · implement · blocked · verify · decide · promote · archive · pivot · finish · sign-off ·
  finished — next_action's own except blocked → fix, tests → fix | approve, sign-off / finished → finished, and any end
  state may be next_action's `drift` (mcp/test.js "1.16 C review (parity)" checks 27 states). A network path (`isNetworkPath`,
  the engine's — server.js uses it too) is skipped before any fs call (a UNC cwd hung it for minutes). `dev-spec statusline` renders
  BEFORE any flag check (a status line must never print an error): exit 0 always, stdin capped, silent outside a project,
  cut to `$COLUMNS`, `--json`; `--print-config` prints the `statusLine` entry with this clone's absolute path (a note when
  it is a versioned plugin-cache copy). A plugin cannot ship a status line (plugin `settings` honour only `agent` /
  `subagentStatusLine`), hence the opt-in `/spec-statusline`.
- **User defaults** — the environment variables `DEV_SPEC_DEFAULT_LANG` / `DEV_SPEC_STOP_CHECK` / `DEV_SPEC_GUARD_DEFAULT`
  (`userOptionRaw()` → `userDefaults()`), FALLBACKS only: project meta always wins; empty, invalid or unexpanded (`${X}`)
  changes nothing. `newProjectLang()` only for a brand-new project (no meta.lang, no feature — active or archived), seeded
  by `seedProjectLang()` under the roadmap lock; `spec_init` reports what a variable decided in `userDefaults`, and so do
  spec_create and spec_import (whose own text — warnings, design.md headings — follows `configuredLang()` too);
  `init --stop-check on` writes meta when DEV_SPEC_STOP_CHECK says off. The guard and stop hooks read the same names raw
  (their cheap pre-checks). A roadmap.json that doesn't parse: DEV_SPEC_STOP_CHECK still decides (engine and hook), the
  guard stays off. DEV_SPEC_GUARD_DEFAULT reaches a dev-spec `.specs/` without roadmap.json (`isDevSpecDir` — steering/ or a
  feature's .state.json; the hook's `devSpecWithoutRoadmap()`), never a folder without `.specs/` nor another tool's. **Never plugin.json `userConfig`**: it opens a configuration dialog on every install / enable,
  reaches neither the Bash tool (the CLI) nor other MCP clients (Claude Code exports `CLAUDE_PLUGIN_OPTION_*` to hooks
  only), and an older Claude Code validating option fields strictly could refuse the whole plugin. Claude Code's
  settings.json `env` block reaches the hooks, stdio MCP servers and the Bash tool alike (code.claude.com/docs/en/env-vars).
- **MCP** — every tool carries `annotations` from server.js `TOOL_ANNOTATIONS` (`READ_ONLY` for the 14 tools no argument
  makes write; `destructiveHint` only on `spec_feature`; `idempotentHint` per tool; `openWorldHint: false` everywhere —
  the protocol's defaults are the opposite, so all are explicit); mcp/test.js requires one entry per tool and snapshots
  `.specs/` around every read-only one. `completion/complete` (prompts-resources.js `complete()`): feature slugs for a
  prompt argument that names a feature, the `specs://` template variables `slug` / `artifact` / `file` (≤ 100 values,
  prefix then substring); an unknown prompt / template / argument / ref → -32602; with prompts off `ref/prompt` → -32602.
- **Plan-mode bridge** — `spec_import {tool: plan | execplan, text}` (`TEXT_IMPORT_TOOLS`; server.js `REQUIRED_ONE_OF`:
  `path` or `text`) = the file import minus the source note (`inline: true`, `source: null`); CLI `import plan -` (stdin)
  or `--text` (a word after the tool that is no track list, given with `--text`, is passed as the path: the engine's "path or
  text, not both"). `hooks/plan-hook.js` (PostToolUse, matcher `ExitPlanMode`): one line of `additionalContext` in a dev-spec
  project, silent and exit 0 otherwise (the payload is undocumented — `tool_input.plan` and a plan-file path read
  defensively); a network cwd is skipped before any stat (an inlined `isNetworkPath`).
