# Claude Code integration — hooks, guards, commands, status line

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
The hook rules, guard mode (edit guard), the human approval guard, the status line, user defaults, MCP annotations and
the plan-mode bridge. The rules come first; how they came to be — the releases and review findings — is in History at the
end. The hooks.json rule is in CLAUDE.md; the scope guard's, in tasks-and-evidence.md → End-of-turn evidence gate and scope
guard. A hook's process I/O and folder lookups follow conventions.md — flush stdout before exiting (never `process.exit()`
right after a write), a feature's folder through `resolveFeature()` / `existingFeature()`.

## Hooks and commands
- **The working agents list `Bash, PowerShell`.** spec-implementer, spec-simplifier, spec-reviewer and spec-verifier run
  `_Verify:_`, `git diff` or a test, and the shell tool differs by platform (Windows without Git Bash has only PowerShell). An
  unresolved `tools:` entry is dropped (only an all-unresolved list blocks the launch), so naming both is safe; the names are
  the exact strings of permission rules and hook matchers. spec-critic has no shell (read-only). spec-verifier reports no run,
  so the SubagentStop matcher leaves it out (`^(dev-spec-driven:)?spec-(implementer|simplifier)$`). Descriptions stay ≤ ~250
  characters — what the agent does and when, never "see the agent body" (the dispatcher sees only the description). The critic
  runs on `model: inherit` (one judgment-heavy dispatch per gate), the agents dispatched in bulk on `sonnet`.
- **One dev-spec project rule — `mcp/lib/probe.js`.** Node core only, never the engine; every surface asks it — the hooks
  (lazily, past each one's pre-filter), hooks/hook-utils.js (it re-exports the readers), the CLI's engine-free paths
  (cli/completion.js `statusProbe` / `resolveProject`) and the engine: doctor.js `isDevSpecDir` IS `probe.isDevSpecProject`
  through the engine's reads (`PROBE_IO`: a dry run's folders), so files.js `nearestProject` (`probe.nearestProject` over
  those reads), `statusLineProject`, `guardLevel`'s user default, the server's `SPECS_REQUIRED` check and guards.js
  `sessionProject` (its walk asks `isDevSpecDir`) agree with the hooks by construction. Never copy the rule or a walk. **The rule** (`isDevSpecProject(dir)`): `<dir>/.specs` holds roadmap.json, a
  `steering/` folder, a ROADMAP.md dev-spec generated (`RE_AUTOGEN` in its first 4,000 characters — all a v1.8-era project has;
  mcp/tests/01-core.js keeps one), or a feature folder (no `.` prefix) with a `.state.json` or a `classification.md` — the
  cheapest check first (no `.specs/`: one stat). **The walks:** `nearestDevSpec(start, {maxUp})` (≤ `SESSION_MAX_UP` = 40),
  `nearestSpecs` (any `.specs/`), `nearestProject` (the CLI's resolver: the folder itself with any `.specs/`, else the nearest
  dev-spec one above, ≤ `PROJECT_MAX_UP` = 64); a network path is never walked (`isNetwork` = files.js `isNetworkPath`). **The
  session:** `sessionProjects({cwd, anchors})` — the nearest
  dev-spec project at or above the payload cwd, then each anchor (`sessionAnchors()`: CLAUDE_PROJECT_DIR, SPEC_PROJECT_DIR) that
  is one: every hook's raw pre-check (`[]` exactly when `spec.sessionProject` finds nothing). mcp/tests/10-guards-probe.js checks
  every caller agrees on 12 layouts and none keeps a copy. ~1.4 ms to require from a hook: keep it one small file.
- **Hooks never block and stay cheap.** Every hook exits 0 on any error or irrelevant event, emits at most one JSON object, has
  a 10 s timeout, acts only on a `.specs/` dev-spec owns (another tool's gets no SessionStart block either) and loads the engine
  (~100 ms) only past a raw pre-check. **The spec hook** (PostToolUse Write|Edit) lints the save — requirements.md: EARS +
  placeholders; tasks.md: trace gaps + EC/NFR/SC warnings; design.md: `designSaveCheck()` — and stamps a tasks.md / change.md
  save in `.state.json lastEditAt` (`recordSpecEdit()`, the stop gate's activity); it skips `/.execution/`, `.specs/templates/`
  and `.specs/tracks/` (unless the folder holds a `.state.json`) and generated files (mcp/tests/10-guards-stop-gate.js). It never
  refreshes ROADMAP.md / SPECS.md: a save leaves `.specs/.execution/roadmap-stale` (`markRoadmapStale`) for the Stop /
  SubagentStop hook to refresh at the end of the turn (lifecycle.md → Roadmap files). **SessionStart** fires in every session of
  every project (the plugin is user-wide), so `sessionMayBeDevSpec()` runs the raw probe first — a superset of what
  `sessionProject()` can pick; it prints ≤ `SESSION_MAX_FEATURES` = 20 feature lines, then "+N more"
  (mcp/tests/10-guards-hooks-cost.js). **The Stop hook** ends before the engine loads when the closing message holds no claim
  pattern (hooks/stop-claims.generated.json; tasks-and-evidence.md → End-of-turn evidence gate). **The observe hook** prints
  nothing; **the approval hook** only a permission decision, and only with `meta.approvalGuard` on.
- **The claim scan runs on a one-byte text** (mcp/lib/latin1-scan.js, loaded only for a prose past U+00FF; guards.js
  `stopScan`, hook-utils `claimScan`): V8 compiles a regex for one-byte and two-byte subjects apart, and the two-byte code of
  the patterns' `[\p{L}\p{N}_]` boundaries is large. `latin1Text` projects the prose to one Latin-1 character per code point (an
  index map leads matches back); `latin1Table` / `latin1Pattern` rewrite the patterns once to answer as on the original (the
  mapping: the module's header). A form the rewrite can't read (another property, `\P{…}`, a range past ASCII) → the text as it
  is: slower, never different. The hook's trigger regexes read the prose as it is. mcp/tests/10-guards-stop-scan.js checks
  3,000+ wide messages against `stopClaims(m, {plain: true})`.
- **Every hook runs in exec form** — `{"type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/<x>.js"],
  "timeout": 10}`: Claude Code spawns `node` directly, no shell, `${CLAUDE_PLUGIN_ROOT}` substituted into each `args` element as
  a plain string (spaces need no quoting; code.claude.com/docs/en/hooks → Exec form and shell form). Shell form runs `sh -c`
  (Git Bash or PowerShell on Windows) at 2–7× the cost, three hooks per Write / Edit or Bash call. **Minimum Claude Code
  2.1.139** (hook `args`): an older one runs a bare `node` — every hook silently off; INSTALL.md and the three READMEs'
  Requirements state it. Never go back to shell form; a new hook takes the same shape (mcp/tests/10-guards-hooks-cost.js checks
  every entry).
- **Which project a hook reads: `sessionProject({cwd, anchors})`** (engine/guards.js, on the facade). The MCP server works in
  `SPEC_PROJECT_DIR` = `${CLAUDE_PROJECT_DIR}` and records approvals, ticks and evidence THERE, while the payload `cwd` may be a
  git worktree (EnterWorktree, `.claude/worktrees/<n>`, a sibling checkout) with its own `.specs/` copy. The resolver: the
  nearest dev-spec folder at or above `cwd` (each level asked `isDevSpecDir`; ≤ `SESSION_MAX_UP` levels; never above an anchor that holds `cwd`; a
  network cwd only itself), then `worktreeProject(near, anchors)`: `gitCheckoutOf()` reads the nearest `.git` (a FILE: `gitdir:`
  → `commondir` → `linked`; a submodule's has no commondir); near in another checkout of an anchor's repository (the status
  line's `workspace.project_dir` too) → the same folder there; else near in a linked worktree → the same folder in the main
  checkout — when that one is dev-spec's. Folders compare by text, then real path (`sessionSame()`: 8.3 vs long names). Nothing
  near → the first dev-spec anchor. → `{project, root, worktree}`; `sessionPath(s, p, cwd)` spells a payload path under
  `project`. The hooks run `probe.sessionProjects` first (mcp/tests/10-guards-guard-downs.js), then ask the engine; the spec hook
  stamps a worktree's tasks.md save in the mapped project, SessionStart reports it, `statusLineProject()` maps the same way.
- **What the hooks share before the engine loads — `hooks/hook-utils.js`** (not a hook; Node core and probe.js only): the
  probe's readers (`readJson`, `textOf` …: a UTF-16 BOM decides, else UTF-8 — files.js `decodeText`; Windows PowerShell 5.1
  writes UTF-16, and a UTF-8-only reader sees the guards "off"; the server's `approvalMeta` decodes the same way),
  `editTargets` / `approvalProjects` (Human approval guard), `sessionFlagFile` (`dev-spec-<kind>-<sha1(session_id)>.flag` in the
  OS temp folder), `claimProse` / `claimScan` / `claimMatch` (the Stop hook's pre-filter) and `parseProjectDir(v, base)` /
  `fileUriToPath` / `unexpandedVar` — ONE reading of an MCP tool's projectDir (`{none}` · `{dir}` · `{code: project-dotdot |
  project-network | project-uri}`), which **mcp/server.js** requires too (`HOOK_UTILS`). mcp/tests/10-guards-guard-downs.js and
  10-guards-shell-writes.js check they agree with the engine's.
- **Commands never reuse a Claude Code built-in name** (`/init`, `/status`, `/doctor`, `/commit`, `/review`): one that could
  collide takes the `spec-` prefix (`/spec-setup`, `/spec-status`, `/spec-doctor`, `/spec-review`).
- **22 commands, 2 of them model-invocable.** Model-invocable skill and command descriptions share ONE budget across all
  plugins (1 % of the context window; on overflow descriptions drop). So the phase commands live in `/spec`, the rest are
  umbrella commands with subcommands (extending.md has the old → new table), and every command but `/spec` and `/spec-bugfix`
  sets `disable-model-invocation: true`: its description leaves the model's context, the user still types it, Claude can't run
  it. The model-visible listing (those two + the skill's) stays ≤ 1,500 characters, each description ≤ 125, one English line
  (the multilingual triggers live in SKILL.md) — mcp/tests/10-guards-guard-downs.js. A model-invocable command never tells the model
  to RUN a user-only one (17-docs-identifiers: "record it with `spec_approve`", never "with /approve"). prompts-resources.js
  `parseFrontMatter` ignores the key (the D4 strict-YAML check accepts it); the MCP prompts serve every command.
- **Lean bodies.** A command routes (its subcommands), names the ONE tool call (or CLI line) per subcommand, and states the few
  rules that matter (show the verdict, approvals are the user's, evidence before claims); catalogues — check ids, result keys,
  flag lists — live in the tool results and `references/`, named by the full
  `${CLAUDE_PLUGIN_ROOT}/skills/dev-spec-driven/references/<file>.md` path (an MCP prompt resolves it too; 17-docs P9 fails a
  bare `references/…`). Only `/spec`, `/spec-bugfix`, `/executeTask`, `/spec-review` and `/spec-tour` say "use the
  dev-spec-driven skill"; the self-contained ones don't pull SKILL.md in.
- **`allowed-tools` on the read-only commands** — `/spec-status` and `/dss` (`spec_status`, `spec_next_action`),
  `/spec-doctor`, `/roadmap` (it writes only the generated ROADMAP files) and `/spec-report` (`spec_drift`, `spec_metrics`) grant
  their tools for the invoking turn by plugin name (`mcp__plugin_dev-spec-driven_spec-driven__<tool>`, comma-separated). `claude
  plugin validate` (2.1.292) doesn't parse a command's front matter: it checks none of this.
- **The aliases follow the full command.** `/ds`, `/dss`, `/dsx` read and follow
  `${CLAUDE_PLUGIN_ROOT}/commands/<spec | spec-status | executeTask>.md` with their arguments (Claude Code substitutes the
  variable in a command's body; `getPrompt()` does for an MCP client), so an alias never drifts; each keeps a short fallback of
  the rules that matter (/dsx: `_Depends:_`, the micro-cycle, the scope rule, evidence).

## Guard mode
- **`roadmap.json → meta.guard`** (`spec_init {guard}` / `init --guard on|off|scope`; `"scope"` — tasks-and-evidence.md →
  End-of-turn evidence gate and scope guard). `hooks/guard-hook.js` (PreToolUse `Write|Edit|NotebookEdit|Bash|PowerShell|Monitor`;
  a MultiEdit payload is read too) is silent unless the guard is on (off costs one raw JSON read); `guardCheck()` reads
  roadmap.json + each feature's `.state.json` / tasks.md, never a repo walk. Its own errors never block: a malformed payload, a
  broken roadmap.json, any exception → exit 0.
- **Shell writes are edits.** A command passes the pre-filter only with an output redirection or a writer's name
  (`RE_SHELL_WRITE`; reads, test runs, builds and git exit there), then `spec.shellWriteTargets(command, mode)` — the approval
  guard's reader (`shellSegOps`; git's restores and a path starting with an unknown variable left out) — sends each file through
  `guardCheck`. **The candidate projects** add the nearest dev-spec `.specs/` above the edited file (≤ 8 path-like words of a
  command; never a network path): at a monorepo's root, `packages/app/.specs` guards `packages/app/src/a.ts` — the engine checks
  the session's project AND `sessionProject({cwd: dirname(file)})`, the first ask wins.
- **"Code" is `isCodeFile(rel)`** (engine/scan.js), ONE notion the guard, the brownfield scan, `spec_scan {coverage: true}` and
  the test-code scan share: `CODE_EXT` (a broad list) plus `TEST_EXTRA_EXT` (`.bats`, Perl's `.t`) on a file that IS a test
  (`isTestFile`: `t/basic.t` yes, `notes.t` no); `GUARD_CODE_EXT` = both (trace's `plannedOutsideCode`, the reuse check). The
  scans set test fixtures apart (`isTestFixture`: a `.sql` / `.ipynb` in a test folder not named like a test, all of
  `testdata/`; the test-code scan still reads one a test plan's File column names); the guard doesn't. It is an allow-list —
  docs say "a broad list of languages", never "any source file"; add a language to `CODE_EXT` (+ the guard test in
  mcp/tests/16-conventions.js, and `RE_TEST_NAME` + the `isTestFile` matrix in mcp/tests/13-imports.js when its tests have a
  naming convention). Docs, config, data (`.psd1`), markup and styles stay silent.
- **When it asks.** A code edit outside `.specs/` while no non-archived feature holds approved, unfinished tasks →
  `permissionDecision: "ask"`. A forced tasks approval counts, with a `systemMessage` note ONCE per session (a marker per
  `session_id` in the OS temp folder). A phase awaiting a role's sign-off is not approved. Exceptions, at both levels: a TEST file
  while an unfinished feature has an approved test plan (why `tests-phase`), and any code edit while an ACTIVE spike exists
  (undecided or with open tasks, within its timebox — why `spike`, field `spikes`; at `scope` it never overrides the approved
  features' plan). A tasks approval whose content no longer matches tasks.md is `stale` and covers nothing; one without a
  fingerprint counts; "changed" is next_action's `approvedContentSame` (gates-and-approvals.md → Approval fingerprints).
- **Inside / outside the project** is decided on real paths too (`insideDirAlias()`: an 8.3 name, a junction or symlink to the
  project is inside), never for a NETWORK path (`isNetworkPath`): its realpath would open an SMB connection to a host the agent
  named — `networkPathInside()` decides on the text (inside only under root's own `\\host\share\…`), so a project on a share
  stays guarded. On win32 the target is read as the file system reads it (`guardTargetPath(p, win)`: `a.ts::$DATA` IS a.ts;
  `/c/…` is `C:/…`). The session's own folders (payload `cwd`, the anchors) are Claude Code's / the user's: hooks use a network
  cwd, never walk up the share or realpath it; the save hook skips a network `.specs/` file outside them.

## Human approval guard
- **`roadmap.json → meta.approvalGuard`** = `off` (default, absent) | `ask` | `deny` (`APPROVAL_GUARD_LEVELS`, in order).
  `spec_init {approvalGuard}` / `init --approval-guard off|ask|deny` (else a localized CLI error; `approvalGuardInput()` →
  undefined leaves it unchanged); written under the roadmap lock, never when unchanged; the result reports `approvalGuard` (+
  `approvalGuardNote`).
- **The hook** `hooks/approval-hook.js` (PreToolUse, anchored matcher: `Bash|PowerShell|Monitor|Write|Edit|NotebookEdit`,
  `(mcp__.+__)?(spec_approve|spec_feature|spec_init|spec_add_track)`, and other MCP servers' file tools by the verb in the name
  — write, edit, move, delete… — dev-spec's own excluded by `(?!spec_|steering_scaffold|ears_validate|trace_check)`; the engine's
  `RE_MCP_FILE_TOOL` / `RE_DEVSPEC_MCP_TOOL`, the hook's `RE_MCP_FILE`; mcp/tests/10-guards.js). Monitor runs its command in the
  Bash tool's shell. A call that can't be an approval exits before any file read (the hook's `candidate()` mirrors the engine's
  `approvalCandidate`, a superset: a command naming `dev-spec`, `.specs` or a guarded file; a path naming `.specs`, a `~N` short
  name or a guarded file — `RE_EDIT_MAYBE`); else ONE raw roadmap.json read per candidate project, the STRICTEST level wins,
  and only then the engine (`permissionDecision`, + `systemMessage` for deny). Its own trouble before that point exits 0; past
  it, an engine failure ASKS (`failClosed`).
- **The candidate projects** (hook-utils.js `approvalProjects`, ≤ 12) follow where the CLI acts: the folders the call names (MCP
  `projectDir`, the edited file's project, `--project`, `SPEC_PROJECT_DIR=` / `$env:` assignments), each `cd` / `Set-Location`
  target (chained and from cwd alone) and the payload `cwd` through `probe.nearestProject`, then the anchors — text only, a
  superset (an extra candidate only makes the answer stricter). The session's own folders are read on a share too; a network path
  the AGENT names only on a share the session is on; none is walked up. An MCP `projectDir` goes through `parseProjectDir`
  (relative: from `CLAUDE_PROJECT_DIR`, `SPEC_PROJECT_DIR` and the cwd, each a candidate); a `file://` URI that is no local path
  asks at least (`opts.projectUnreadable`, why `project`); `..` and network values still go to `approvalProjects` (the server
  refuses them).
- **The edited path as the file system reads it** (`approvalEditTargets` = hook-utils `editTargets`): resolved against the
  payload cwd (`.` / `..` folded), `guardTargetPath()` on win32, and its real path on every platform (the file's, else its
  parent's + the name; never a network path's) — an 8.3 name (`ROADMA~1.JSO`), a folder linked to `.specs/` (`sx/roadmap.json`).
  Either reading counts. A trailing dot / space needs no rule (Node's file calls keep it: another file).
- **A missing or broken roadmap.json fails closed.** A dev-spec `.specs/` holding a feature (with its `.state.json`) but no
  roadmap.json — every feature-making write writes it, so it was deleted — reads as `ask` (`approvalGuardLevel` →
  `approvalRoadmapGone()`; the hook's `rawLevel` → `roadmapGone()`; meta unknown, so every weakening init change counts); without
  a feature, off. Deleting it from the shell is itself a guard-down; this covers a deletion the guard didn't see. A roadmap.json
  that doesn't parse keeps the strictest `"approvalGuard"` its raw text names (NULs taken out: a BOM-less UTF-16 file).
- **`approvalGuardDecision(payload, level, {lang, cli?})`** — PURE → `{decision: allow | ask | deny, why, level, …}`; `why`
  (stable): `off` · `no-payload` · `not-pre-tool-use` · `not-an-approval` · `approval`. An approval adds `actions` (`kind`:
  approve | remove | guard-down | unreadable, with `source`, `feature`, `phase`, `role`, `by`, `force`, `project` …), `force`,
  `command` (the human's, `!`-prefixed), `reason` (`approvalGuard.ask` / `approvalGuard.deny`) and, for deny, `userNote`. Judged
  against `opts.meta`; raising, adding or a no-op is allowed. It counts `spec_approve` under ANY MCP prefix; `spec_feature
  {action: "remove", confirm: true}`; `spec_init {approvalGuard}` LOWERING it; through Bash / PowerShell / Monitor
  (`APPROVAL_SHELL_TOOLS`) `dev-spec approve …`, `feature remove … --yes`, `init --approval-guard <lower>` (`--help` runs
  nothing); and the guard-down actions.
- **Guard-down actions** (`kind: "guard-down"`, `setting`: approvalGuard · evidence · roles · check · stopCheck · guard · roadmap
  · state · observed · track · specs · link): lowering the guard or weakening what it protects — evidence observed → reported,
  approval roles cleared or a required one dropped, a project check removed or changed, the stop gate off, the edit guard
  lowered, and **track removal** — `spec_add_track {remove: true}` (`RE_APPROVAL_MCP`) / `add-track … --remove` turning off +tdd
  or +ai (`APPROVAL_GATED_TRACKS`: they carry a phase; +sec / +saas / a pack stay allowed). **The guarded files** —
  `.specs/roadmap.json`, `.specs/**/.state.json` (`RE_STATE_FILE`), `.specs/**/.execution/observed.jsonl` (`RE_OBSERVED_FILE` —
  a forged line would make a run "observed") — written through Write / Edit / MultiEdit / NotebookEdit (`APPROVAL_EDIT_TOOLS`), a
  shell writer or an MCP file tool: `command: null` (the user makes that change), `project` the folder above `.specs/`
  (`approvalSpecsProject()`). `dev-spec merge-state … <ours>` onto a state file is one too (git runs the driver itself, never
  through the Bash tool).
- **The shell lexer** (`shellCommandWords(cmd, mode)`: one linear pass, nothing evaluated, ≤ `APPROVAL_LEX_DEPTH` = 32 deep)
  reads the tool's shell — `bash` (`\x`, `$'…'`; `raw` keeps backslashes for Windows paths), `ps` (the backtick escape, `@'…'@`,
  `<# #>`), `cmd` (`^`). `{` / `}` separate only standing alone (inside a word they are brace expansion). Redirections go to
  `redirs`. Heredoc bodies are data unless fed to a shell. PowerShell's unquoted `--%` hands the rest of the line to the program
  as written; the token is never a word.
- **Where the CLI runs.** `devSpecWordAt()`: the CLI's script (`dev-spec`, `dev-spec.js` / `.cmd` / `.ps1` …, any path, or a
  glob of its name — `devSpecGlob()`, only with an approval word) counts in PROGRAM position only — after launchers and shell
  keywords (`APPROVAL_WRAPPERS`), env assignments, options — never as an argument (`echo dev-spec approve x`). `programAt()`
  skips launchers' value options (`APPROVAL_OPTION_VALUES`, `APPROVAL_POSITIONALS`), takes npm / pnpm / yarn / bun / deno only
  through a run subcommand (`APPROVAL_SUBCOMMANDS`) and `$env:ComSpec` as cmd (`RE_COMSPEC_WORD`); the CLI fed on stdin counts
  (`stdinScriptAt()`). `cliApprovalAction()` reads its words with `CLI_SWITCHES` (a non-switch `--flag` takes the next word),
  then with every flag a switch — `spec.CLI_SWITCHES` is the ONE list of CLI boolean switches (conventions.md → CLI boolean
  switches): a CLI-only switch would shift this reading.
- **Nested scripts.** A word holding whitespace and `dev-spec` after an `APPROVAL_SHELLS` program is lexed in turn, ≤
  `APPROVAL_SHELL_DEPTH` = 3, reading ≤ `APPROVAL_COMMAND_MAX` (64 K) characters. Where cmd / pwsh RUNS, the words after `/c` /
  `-Command` (any abbreviation, `pwshOption()`; Windows PowerShell's first positional too — pwsh 7's is -File) are joined
  (`restScript()`) and lexed as its script; `Start-Process` →
  -FilePath + -ArgumentList (`startProcessLine()`); `find -exec` → its command (`findExecActions()`); `sh -c 'script' arg0 …`
  with `$0` / `"$@"` put in (`withPositionals()`); `-EncodedCommand` decoded (`decodePwshEncoded()`).
- **Text fed to a shell** (`shellFedScript()`): the lexer links a command to the one a `|` feeds it (`seg.pipeFrom`) and keeps
  heredoc bodies (`h.body`) and process substitutions (`seg.procs`). For a shell reading stdin (bash with no script, cmd
  without `/c`, pwsh `-Command -`, a bare `iex`, `xargs … sh -c`), `source` / `.`, or a process substitution, VISIBLE fed text
  (`shellProducedText()`: echo / printf / Write-Output, a heredoc) is read as its script — `echo "node <cli> approve …" | bash`
  is the approval; any other (`cat run.sh | bash`, `curl … | sh`) in a command naming dev-spec / .specs is `unreadable` why
  `fed`. PowerShell's `node <cli> @('approve', …)`: the elements are the CLI's arguments (a variable among them: unreadable).
- **One reader of a simple command's file operations** (`shellSegOps()` → `shellOpActions()` here, `shellOpPaths()` for the
  edit guard). Ops: `write` · `replace` (rm, a move's source, an extracted member) · `git` (`gitWriteTargets()`: checkout,
  restore, merge-file, rm, mv, clean, `stash push -- <paths>` — not their read-only forms) · `into` (a folder receiving files) ·
  `link` (the TARGET a link is made to) · `piped` (`find … | xargs rm`) · `unknown`. Programs are read by their options
  (`APPROVAL_WRITERS_ANY` / `_INPLACE` / `_TARGET` / `_OTHER`, `APPROVAL_REMOVERS`, `APPROVAL_MOVERS`, `PS_FILE_CMDLETS` by
  `psParams`), output redirections only (`seg.writes`), and `[IO.File]::` methods. Each path is read (`shellPathReadings()`)
  with the same command's variables (`shellTrack()`), after its `cd`, through brace expansion (`braceExpand()`) and as a glob
  (`shellGlobRe()`: Bash's leading `*` never matches a dot, PowerShell's / cmd's do; an unknown variable `SHELL_VAR` matches
  anything but never `.specs`; `SHELL_ANY` matches dot folders) → `shellPathFacts()`. Actions: an
  exact guarded file → its setting; `.specs/` removed / moved → `roadmap`; a write that may hit a guarded file, or a removal /
  move / extraction / recursive copy on `.specs/` or under it (`rm -rf .specs/*`) → **`specs`**; a link to `.specs/` or under it
  → **`link`**. Allowed: spec documents, `.execution/` (but the observed log), lock files, read-only git. **Fail closed:** a
  program `shellKnownProgram()` doesn't know (not text-only, `APPROVAL_READERS`, a writer, a shell, a launcher or the CLI) run on
  `.specs/` or a guarded file is `unreadable` why `specs-arg` (`npx prettier --write .specs/roadmap.json`).
  mcp/tests/10-guards-shell-writes.js holds 33 legitimate commands that stay allowed; mcp/tests/10-guards-hooks.js checks the hook's
  `candidate()` constants match the engine's.
- **MCP file tools** (`approvalEditActions()` / `approvalPathArgs()`): string values of path-named keys (3 levels, ≤ 32; a
  `file://` URI via `fileUriToPath`) are read as an Edit's path; a move / delete tool also on `.specs/` or under it. Content keys
  are never read.
- **Unreadable actions** (`kind: "unreadable"`, no command). `too-long` — past `APPROVAL_COMMAND_MAX`, its unread tail naming
  dev-spec or `.specs` — takes the guard's level. Every other why (`APPROVAL_ASK_WHYS`: unparsed, partial, fed, specs-arg,
  error, project) ASKS at both levels — it may be no approval: never refused, never allowed. `unparsed` (`approvalUnparsed()`):
  no action found, yet the plain text (`approvalPlain()`) holds an approval word (`RE_APPROVAL_VERB`) and a command names the CLI
  under a program that is not text-only (`APPROVAL_TEXT_PROGRAMS`) or runs it through a variable / substitution / alias; the CLI
  with an unreadable subcommand (`cliSubcommandUnread()`) beside an approval word; `--%` right after the CLI
  (`RE_PS_STOP_AFTER_CLI`); a subcommand glob / brace that may expand to a guarded one (`cliSubcommandGlob()`,
  `CLI_GUARDED_COMMANDS`: `appro?e` asks, `st?tus` doesn't). `partial`: the hook's 2 s stdin safety net fired, the payload
  doesn't parse, and its text names dev-spec, `.specs` or an approval tool while a project the session may be in has the guard
  on.
- **ask** → `permissionDecision: "ask"`: the reason names the feature, phase(s), role, `by` and, loudly, `--force`; Claude Code
  shows it in auto mode too (only bypass-permissions skips it; dontAsk refuses it). **deny** (auto mode included): the reason
  tells the agent
  approvals are the human's; the user's `systemMessage` carries `! node "<clone>/cli/dev-spec.js" approve <f> <phase> [--role r]
  [--force]` (`approvalCommand()`: an agent's value only when plainly safe to paste, else a `<placeholder>`; the agent running
  that line is still an approval).
- **Outside Claude Code the MCP server enforces it** (mcp.md → Human approvals over MCP elicitation): the same
  `approvalGuardDecision()` runs in server.js for spec_approve / spec_feature / spec_init — with elicitation the client asks
  (only an explicit approve records it, as `confirmed`); without, `ask` runs and `deny` is refused with the command (`{plain:
  true}`: no `!`). `mcp/servers.json` sets `SPEC_MCP_APPROVAL_HOOK=on`: in Claude Code the hook is the only gate.
- **The threat model — say it as it is, in every doc:** the approval and edit guards stop ACCIDENTS and CASUAL WORKAROUNDS, not
  a determined agent with a shell. They read each tool call as text — nothing runs — and ask whenever a command names dev-spec,
  `.specs/` or a guarded file in a form they can't follow; `deny` refuses in auto mode too, but a session with hooks disabled (or
  bypass-permissions, for `ask`) runs no gate. Docs never say a guard "holds in every mode" / "can't be bypassed".
- **Known limits — the honest list:** inline scripts and script files the agent wrote (`node -e`, `./x.sh` — interpreters are
  readers here), a shell variable / alias / function DEFINED in an earlier tool call (within one command it is read; a path
  starting with an unknown variable is not judged), encoded or downloaded text fed to a shell
  when the command names nothing of dev-spec's (`… | base64 -d | bash`), splatting the CLI's own path (`& node @a`), `git -c
  alias.x='!…'`, a copy of the CLI under another name, git forms whose files can't be known from the command (`git apply` /
  `am`, `git stash pop`, `git reset --hard`, a branch switch), an archive extracted into the project root without naming
  `.specs/`, `patch` without a file operand, and a link to a guarded FILE (not a folder) made by one of those routes and then
  edited through (only its folder's real path is read). Outside Claude Code the elicitation path gates spec_approve /
  spec_feature / spec_init only (not a `spec_add_track {remove}` — gates-and-approvals.md → Approvals the user confirmed over
  MCP).

## Claude Code integration
- **Status line** — `statusLine(dir, {columns})` / `statusLineProject(dirs)` (the nearest dev-spec `.specs/` ≤ 40 folders up, a
  worktree mapped as the hooks map it; each active feature's `.state.json` + tasks.md, ≤ 200; the most recently active feature
  with work under way, else the most recent). The step follows next_action's order cheaply — never the doctor, a code scan or
  the drift hash (`statusNext()`): a spike takes next_action's spike steps; Phase 4 goes through `statusTestsGate()` (+tdd
  answered only when provable without the walk, ≤ 20 test files read, else `tests`); a FORCED approval is re-checked
  (`approvalChecks` minus `STATUS_DOCTOR_WARNS`, the check registry's `warnsOnly`); a bugfix's empty Root Cause → `fix`
  (bug.md); every task done: verify → finish (`staleFinish(…, {newFiles: false})`) → verify (`suiteStatus(…,
  null)`) → sign-off (`executionSignOffStale`) → finished (never "✓": drift isn't checked). Step codes (stable): re-review · fill
  · fix · approve · tests · tasks · implement · blocked · verify · decide · promote · archive · pivot · finish · sign-off ·
  finished — next_action's own except blocked → fix, tests → fix | approve, sign-off / finished → finished; any end state may be
  next_action's `drift` (mcp/test.js "1.16 C review (parity)", 27 states). A network path (`isNetworkPath`) is skipped before
  any fs call.
  **`dev-spec statusline` never fails:** cli/main.js runs the render (cli/commands.js `statusLineRender`) BEFORE any flag check
  — exit 0, stdin capped, silent outside a project, cut to `$COLUMNS`, `--json`. It runs after every message in every folder, so
  cli/commands.js's `spec` is a proxy that loads the facade on first use and the render tries `statusProbe()` first
  (cli/completion.js — the probe's `nearestDevSpec`): no project → the empty line at about Node's startup
  (cli/tests/11-claude-code.js checks the two agree and that no mcp/lib module loads). `--print-config` prints the `statusLine`
  entry — in a plugin's versioned cache folder, a `node -e` one-liner that finds the newest installed `<version>` at each run
  (cli/completion.js `statuslineCommand`: no quote, dollar, backtick, percent, ! or backslash, so every shell passes it; else the
  plain command and `cacheNote`). A plugin can't ship a status line (plugin `settings` honour only `agent` /
  `subagentStatusLine`), hence the opt-in `/spec-setup statusline`.
- **User defaults** — `DEV_SPEC_DEFAULT_LANG` / `DEV_SPEC_STOP_CHECK` / `DEV_SPEC_GUARD_DEFAULT` (`userOptionRaw()` →
  `userDefaults()`), FALLBACKS only: project meta wins; empty, invalid or unexpanded changes nothing. `newProjectLang()` only for
  a brand-new project (no meta.lang, no feature, active or archived), seeded by `seedProjectLang()` under the roadmap lock;
  spec_init / spec_create / spec_import report it in `userDefaults`; `init --stop-check on` writes meta when the variable says
  off. The guard and stop hooks read them raw. A roadmap.json that doesn't parse: DEV_SPEC_STOP_CHECK still decides, the guard
  stays off. DEV_SPEC_GUARD_DEFAULT reaches a dev-spec `.specs/` without roadmap.json (`isDevSpecDir`; the hook's
  `devSpecWithoutRoadmap()`), never another tool's. **Never plugin.json `userConfig`**: a dialog on every install / enable,
  invisible to the Bash tool (the CLI) and other MCP clients (`CLAUDE_PLUGIN_OPTION_*` reaches hooks only); settings.json `env`
  reaches hooks, stdio MCP servers and the Bash tool alike.
- **MCP** — `annotations` on every tool from server.js `TOOL_ANNOTATIONS`: `READ_ONLY` for the 12 no argument makes write;
  `destructiveHint` on the 9 one of whose arguments removes or overwrites a record (`spec_feature` remove, `spec_export` adr,
  `spec_approve` revoke, `spec_complete_task` undo, `spec_impact` reopen, `spec_roadmap_edit` rm / depend replace,
  `spec_add_track` remove, `spec_init`, `spec_tracks` set / forget); `idempotentHint` per tool; `openWorldHint: false`
  everywhere (the protocol's defaults are the opposite). mcp/test.js requires one entry per tool and snapshots `.specs/` around
  every read-only one. `completion/complete` (prompts-resources.js `complete()`): feature slugs, the `specs://` variables `slug`
  / `artifact` / `file` (≤ 100, prefix then substring); an unknown prompt / template / argument / ref, or `ref/prompt` with
  prompts off → -32602.
- **Plan-mode bridge** — `spec_import {tool: plan | execplan | fluidplan, text}` (`TEXT_IMPORT_TOOLS`; server.js
  `REQUIRED_ONE_OF`: `path` or `text`, not for a steering tool) = the file import without the source note (`inline: true`,
  `source: null`); CLI `import plan -` (stdin) or `--text` (a non-track word after the tool is passed as the path: "path or
  text, not both"). `hooks/plan-hook.js` (PostToolUse `ExitPlanMode`): one line of `additionalContext` in a dev-spec project
  (the first of `probe.sessionProjects`, network folders left out), silent otherwise; the payload is undocumented
  (`tool_input.plan`, a plan-file path, read defensively).

## History
How the rules above came to be, section by section — grep a release (`1.21.1`) or a finding id (`M8`, `r6 I-I1`) here.

### Hooks and commands
- **v1.8** — projects of that era hold only a generated ROADMAP.md (no roadmap.json, steering/ or `.state.json`); the save hook
  served them, hence the `RE_AUTOGEN` marker in the project rule.
- **v1.11** — `/init`, `/status`, `/doctor` and `/commit` collided with the built-ins (a bare `/doctor` ran Claude Code's while
  our own messages said "run /doctor"); they became `/spec-init`, `/spec-status`, `/spec-doctor`, `/spec-commit`.
- **1.14** — the observe hook (harness-observed evidence). Since then a feature folder named `templates` (made before 1.14
  reserved the name) is still a feature to the save hook.
- **1.15** — `.specs/tracks/` (track packs) skipped by the save hook, with the same exception as `.specs/templates/`.
- **1.22 review** — the save hook loaded the engine on every Write / Edit anywhere; now only past the plain path check (173 →
  68 ms median per edit, `node -e 0` ≈ 61 ms). tasks.md / change.md saves stamp `lastEditAt` (`recordSpecEdit()`).
- **1.23 review 5 (M12)** — the working agents named Bash alone, leaving them shell-less on a PowerShell-only Windows (they could
  only answer NEEDS_CONTEXT).
- **1.23 review 5 (M8)** — `sessionProject()`: the hooks read the payload `cwd`, in a git worktree its own copy of `.specs/` — the
  edit guard asked though the tasks were approved, the stop gate saw no activity, the SubagentStop gate looked for the report
  where the implementer hadn't written it.
- **1.24** — the 55 command descriptions cut from 11,013 characters to 5,530; a real session still listed 15 dev-spec commands
  with no description.
- **1.24 review 6** — hooks/hook-utils.js. **C3 / A4:** a UTF-16 roadmap.json / .state.json (Windows PowerShell 5.1) read as
  UTF-8 by the approval, guard and stop hooks — the approval and edit guards read "off", the stop gate saw no activity (the engine
  and the CLI enforced them); the server's `approvalMeta` refused an unchanged spec_init setting on a UTF-16 roadmap.json at deny
  as a guard-down (meta unknown). **C-I9:** the aliases became readers of their full command (they had drifted).
- **1.24 r6 I-I1** — the save hook stopped refreshing ROADMAP.md / SPECS.md: ~75 % of it was the refresh (272 / 423 / 725 ms a
  save at 10 / 50 / 150 features → ~130–180 ms).
- **1.24 r6 I-I4** — the Stop hook's claim pre-filter (hooks/stop-claims.generated.json).
- **1.24 r6 (I2)** — the observe hook's walk stopped at 12 levels: a `_Verify:_` run deeper below a nested project was never
  logged.
- **1.25.1 review 7** — SessionStart probes before the engine loads (median of 15, Windows: a repository without `.specs/` 145 →
  56 ms, `node -e 0` 54; a dev-spec project unchanged, ~178 ms). **Exec form** for every hook — measured on Windows 11 (median of
  15, the observe hook on an irrelevant Bash call): exec 57 ms · Git Bash 98 · Windows PowerShell 5.1 395 · pwsh 7 348; the
  minimum Claude Code became 2.1.139 (released 2026-05-11: "Added hook `args: string[]` field (exec form)…"; `claude plugin
  validate` 2.1.295 checks the schema). **finding 5:** `parseProjectDir` / `fileUriToPath` / `unexpandedVar` in hook-utils.js,
  shared with mcp/server.js — the hook read a `file:///…/projA` as a relative folder while the server accepted it, so
  `spec_approve {projectDir: "file:///…", force: true}` went through at ask.
- **1.26 — the context diet** — the 55 commands folded into 22 (the phase commands into `/spec`; the umbrella names keep the
  prefix — `/spec-setup`, `/spec-review`) and `disable-model-invocation: true` on all but `/spec` and `/spec-bugfix`: the
  model-visible listing went to 776 characters (5,718 before: 46 commands' 4,707 + the skill's 1,011). spec-verifier split from
  the reviewer's verify mode, so each per-finding dispatch loads ~3 KB instead of the reviewer's whole prompt (and an inherited
  Opus would have multiplied the cost of N parallel verifiers: `sonnet`).
- **1.27 — one project rule** — until 1.26 there were four variants (the engine's `isDevSpecDir`; the stop / plan hooks' — +
  classification.md and dot folders; the observe / spec hooks' — + a generated ROADMAP.md; the guard's `devSpecWithoutRoadmap`)
  and two walk-ups (the guard's and hook-utils' `nearestSpecs` took the nearest `.specs/` of ANY tool; the stop hook's
  `nearestDevSpec` the nearest dev-spec one): a `.specs/` holding only a classified feature was a project to the Stop and observe
  hooks but not to the edit guard or the status line, and another tool's `.specs/` in a monorepo package hid the dev-spec project
  above it from the guard. mcp/lib/probe.js replaced them; the readers moved there from hook-utils.js; the guard and stop hooks'
  cruder `/^[\\/]{2}/` network test (it read `\\?\C:\…` and `\\wsl$\` as network) gave way to `isNetwork`. Cost: ~1.4 ms to
  require it from a hook (a one-line module: ~0.6); every hook's fast path stayed where 1.26 had it (median of 21 and 31
  interleaved fresh processes, time in the process, Windows, Node 26: 0–4 ms apart, inside the run-to-run spread; bare node
  27 ms, the fast paths 31–47 ms either way).
- **1.27 — the claim scan on a one-byte text** — one em dash, curly quote or emoji in a closing message cost stopClaims ~110 ms
  and the pre-filter ~30 ms more, and a wide character only inside a code fence left the prose two-byte too. guessLang still
  reads the prose itself (its INF lookahead names “ — ~8 ms on a wide text, once a process). Measured (the Stop hook in a project
  with an unverified tick, median of 21 interleaved fresh processes, Windows, Node 26): a claim with an em dash 344 → 273 ms,
  with an emoji 339 → 277 (an ASCII claim 245 → 249); a triggered message without a claim, with an em dash, 84 → 74; no trigger
  word 51 → 50. The CLI left cli/dev-spec.js (now a 44-line entry point) for cli/main.js, cli/commands.js, cli/run.js and
  cli/git.js.

### Guard mode
- **1.13** — guard mode (`meta.guard`, `hooks/guard-hook.js`), first written up with the catalog / drift / restore notes.
- **1.14** — the stricter `"scope"` level.
- **1.16 verify NEW-3** — a network Write target's realpath opened an SMB connection to the host the agent named before the
  permission prompt (a hang, NTLM on Windows): `networkPathInside()` decides on the text.
- **1.21.1** — ONE notion of code (`isCodeFile`): the scan's `CODE_EXT` had been a short list and the guard kept its own broad one
  — a PowerShell project scanned empty and its tests gate never passed. **1.21.1 review:** a `.sql` / `.ipynb` in a test folder
  not named like a test is a fixture. **review 2 / 3:** the test-code scan still reads a fixture a test plan's File column names
  (the file, or the folder directly holding it).
- **1.22 review** — every file under `testdata/` is a fixture.
- **1.23 review 5** — MultiEdit, a tool Claude Code no longer has, left the matcher (its payload is still read). **L21:** an NTFS
  stream suffix and Git Bash's `/c/…` were read as no code / outside and allowed — `guardTargetPath()`.
- **1.24 review 6 (C-I8)** — the forced-approval note was printed on every code edit; now once per session.
- **1.25.1** — "changed" became next_action's `approvedContentSame` (trailing spaces, final blank lines, a "\r\r\n" file
  normalized to LF keep the approval covering). **review 7, finding 8:** the shell tools — `sed -i src/a.ts`, `cat > src/a.ts
  <<EOF`, `Set-Content src\a.ts`, `tee`, `cp x src/a.ts` — edited code with no prompt. **finding 9:** at a monorepo's root, a
  guarded package's `.specs/` didn't guard its files.
- **1.27** — the edited file's candidate is the nearest DEV-SPEC `.specs/` (the probe); a network cwd is never walked up the
  share, as the engine's sessionProject (the observe hook's walk had climbed to the share root).

### Human approval guard
- **1.14 F2** — the human approval guard (`meta.approvalGuard`, `hooks/approval-hook.js`, `approvalGuardDecision()`); the lexer
  and the guard-down actions came with the feature's review.
- **1.21 F1b** — the MCP server enforces the same decision outside Claude Code (elicitation). **1.21 review A4:** `{plain: true}`
  — a runnable line without Claude Code's `!`, a deny reason that doesn't mention it.
- **1.22 review — the unquoted forms** (all allowed at deny before): cmd's `/c` and pwsh's `-Command` words lexed as a script
  (`cmd /c node cli\dev-spec.js approve alpha tasks`), `Start-Process` / `saps` / `start`, `find -exec`, `winpty` and `flock` as
  launchers, `flock -c` / `script -c` scripts.
- **1.23 review 5** — **Monitor** joined the matcher (an approval through it went past a deny-level guard); a Write / Edit of
  roadmap.json or a `.state.json` became a guard-down; `unparsed` (fail closed) and `too-long` (an approval after the first 64 KB
  went through at deny); more forms allowed at deny before — `cmd //c`, `$env:ComSpec` / `%ComSpec%`, the launchers strace …
  catchsegv (**L20**), `sh -c` positionals, `powershell -EncodedCommand`, the CLI fed to `node -`, globs (`devSpecGlob`), `trap
  '…' EXIT`. These notes had said auto mode may skip an "ask"; it can't (code.claude.com permission-modes / hooks).
- **1.24** — +tdd / +ai turned off became a guard-down; a Write / Edit of a harness-observed log too.
- **1.24 review 6** — **C4:** the hook checked only the payload `cwd` and the anchors while the CLI acts on `--project` >
  `SPEC_PROJECT_DIR` > `CLAUDE_PROJECT_DIR` > the nearest `.specs/` above its cwd — a session started in a subfolder, `cd "<P>" &&
  node … approve`, `SPEC_PROJECT_DIR=<P> node …` went through at deny: `approvalProjects`; a project on a share had no approval
  guard. **C5:** `.specs/./roadmap.json`, `.specs/alpha/../roadmap.json`, `roadmap.json::$DATA` and an 8.3 short name
  (`STATE~1.JSO`) went through: `editTargets`. **C7:** the CLI with an unreadable subcommand (`$(echo approve)`, `$A`, `"$@"`,
  xargs). **C1:** `node '<cli>' --% approve …` approved at deny (the lexer read `--%` as the subcommand; the PowerShell tool's own
  guidance suggests `--%`). **C-I10:** `partial` — a partial payload exited 0 (allowed). **E3:** track removal (`spec_add_track
  {remove}` into the matcher). **C2:** `merge-state` onto a state file. **C6:** a forged `observed.jsonl` line turned a reported
  run into a verified, observed one. `specsWriteActions()` (was roadmapWriteAction) read every shell writer on the three guarded
  files; `gitWriteTargets()`: `git checkout HEAD~1 -- .specs/roadmap.json` brought back a roadmap.json with the guard off.
  **A4:** NULs taken out of a BOM-less UTF-16 roadmap.json before its raw `"approvalGuard"` is read.
- **1.25.1 review 7** — **NotebookEdit** and other MCP servers' file tools joined the matcher (**finding 7** —
  `approvalEditActions()`). **finding 1:** text fed to a shell (`shellFedScript()`). **finding 2:** `{approve,}` was cut into
  three commands and read as no CLI call — braces inside a word stay in it; `cliSubcommandGlob()`. **findings 3 / 4:** ONE reader
  of a simple command's file operations (`shellSegOps()` — globs, variables, folders, extractors, links, `specs-arg`).
  **finding 4:** the edited path's real path on every platform (`ln -s .specs sx` then `Write sx/roadmap.json` went through).
  **finding 5:** the MCP `projectDir` read by the server's own parser. **finding 6:** an engine failure past the pre-check asks
  (`failClosed`; it exited 0 — allowed). A missing roadmap.json while features exist: decided, fail closed (ask).
  **finding 11:** the threat model, said as it is in every doc; the known limits listed.
- **1.27** — the candidate projects' `cd` targets go through `probe.nearestProject` (the folder itself with any `.specs/`, else
  the nearest dev-spec one above, ≤ 64 levels); it took the nearest `.specs/` of any tool, ≤ 40.

### Claude Code integration
- **1.16 C** — the status line (`dev-spec statusline`), user defaults, MCP annotations and the plan-mode bridge (`spec_import
  {text}`, `hooks/plan-hook.js`); its review fixes added `statusNext()`'s cheap gates and the parity test.
- **1.23 review 5** — the status line maps a git worktree to its checkout (`worktreeProject()`, as the hooks).
- **1.25** — `REQUIRED_ONE_OF` exempts a steering import from `path` / `text`.
- **1.25.1 review 7** — the status line loaded the whole engine in every folder (136–220 ms a render); the lazy facade and
  `statusProbe()` put the empty line at about Node's startup (~65 ms against ~140 ms, Windows). `--print-config` in a plugin's
  cache folder: the plain path broke at the first plugin update — `statuslineCommand`. `destructiveHint` had been on
  `spec_feature` alone: 11 tools then (backlog, milestone and depend were separate tools — `spec_roadmap_edit` since 1.26: 9
  now, and 12 read-only, not 14).
- **1.27** — `statusProbe()` is the probe's rule, not a copy of `isDevSpecDir`; the plan hook walks up through
  `probe.sessionProjects` (it looked at the cwd itself only). The render moved with the CLI split: cli/commands.js
  `statusLineRender`, run first by cli/main.js.
