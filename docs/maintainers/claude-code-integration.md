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
  runs on `model: inherit` (one judgment-heavy dispatch per gate), the agents dispatched in bulk on `sonnet` — but the UI
  reviewer (1.32), which inherits too: a judgment on images, one dispatch per UI task.
- **Fresh reviewers: `omitClaudeMd: true` (1.31)** on spec-critic and spec-verifier (and, 1.32, spec-ui-reviewer: `tools: Read,
  Glob`, images in, no shell — the controller captures) — they start without the user / project /
  local CLAUDE.md files (Claude Code 2.1.271+; an older version ignores the key and they load them as before). A reviewer
  that judges an artifact or a finding must not inherit the author's context; a rule it needs is in the steering or read
  from its file — the verifier's question 5, and the critic's brief mode, which reads the project's CLAUDE.md files the
  implementer loads (the root one with its `@` imports, `.claude/CLAUDE.md`, `CLAUDE.local.md`, those in the folders of
  the files the brief names) with its Read tool. The
  implementer, the simplifier and the reviewer keep CLAUDE.md: they write or judge code against the project's
  conventions. mcp/tests/17-docs.js holds both sides.
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
  dev-spec one above, ≤ `PROJECT_MAX_UP` = 64); a network path is never walked (`isNetwork` — files.js `isNetworkPath`,
  `unexpandedVar` and `expandHome` ARE the probe's functions, as guards.js `guardTargetPath` / `approvalEditTargets` are its
  `fsTargetPath` / `editTargets`: one implementation each). **The
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
- **A hook IS its decision — `decide(raw, opts)`, exported.** Each hooks/*-hook.js exports `decide(raw, {timedOut})` → the ONE
  object its process prints (a permission decision, additionalContext, a block) or null (silent); it never writes stdout or exits,
  and reads the process's environment and working folder as the engine does. The file runs as a hook only as the main module
  (`if (require.main === module) runHook(decide, …)`), so a test calls it in-process — mcp/tests/harness.js `hookIn(file, {input,
  env, cwd, timedOut})`, spawnSync's shape, the environment and folder applied for the call and restored like cli/main.js `main`
  (testing.md → The harnesses). Exports beside `decide`: a hook's pre-filter where a test checks it (the approval hook's
  `candidate`, the edit guard's `mayWrite` / `pathWords`, the Stop hook's `mayClaim`).
- **Every hook runs on ONE runner — hook-utils.js `runHook(decide, {maxInput})` and `finish(obj?)`.** It reads the payload from
  stdin asynchronously (never `fs.readFileSync(0)`), runs `decide(raw, {timedOut})` once — at stdin's end or from the 2 s safety net
  (`SAFETY_NET_MS`; `timedOut` true: the approval hook's `partial` path) — and finishes with its answer; it turns an exception or a
  stdin error into a silent exit 0 (past its pre-check the approval hook catches its own and asks), feeds a terminal stdin `"{}"`
  and, past `maxInput` characters (the observe and plan hooks, 4 MB), drains the rest and hands `decide` `""`. `finish` prints at
  most one JSON object and exits in the write's callback (conventions.md → Flush stdout before exiting). `payloadOf(raw)` is the
  payload object or null (not JSON, or no object: the hook exits), `eventOf(p)` its event name — the approval hook alone parses its
  own (a partial payload asks). A hook keeps only its decision: its pre-filter still runs first in its `decide`, and hook-utils.js
  loads nothing heavier when required — the probe comes through `probe()` on first use (requiring hook-utils.js: ~0.7 ms over an
  empty module; every fast path within the run-to-run spread of 1.27.0's — 1.27.1 History).
- **Every scan a hook runs on payload text is LINEAR.** A PreToolUse hook that runs past its timeout doesn't block the call
  (code.claude.com/docs/en/hooks), so a super-linear pattern is a way past the guard: no run class that holds its own start
  delimiter (`(?:^|[=,(])\.[^\s/]*[*?]` rescans `=.=.…` from every start — 120 K characters took the approval hook 16.7 s), no
  `[\\/]+$`-style tail, no nested quantifier over a path's segments — read the delimiter-free runs once (probe.js `dotGlob`, the
  edit guard's `pathWords`), split first (`mayWrite`'s `find … -delete`), walk segments or the text by hand (`guardedFileOf`,
  `trimSlashEnd`). mcp/tests/10-guards-hooks-cost.js times each reader by SHAPE (16 K vs 64 K characters of a hostile input: ≤ 8×)
  and the report's 120 K payload through the hook process. The engine's lexer and readers past the pre-filter read ≤
  `APPROVAL_COMMAND_MAX` (64 K) and stay linear (review 8 swept them: ~0.1–0.2 s at the cap).
- **What the hooks share before the engine loads — `hooks/hook-utils.js`** (not a hook; Node core and probe.js only, the
  probe loaded on first use): the runner above, `probe()`, the probe's readers (`readJson`, `textOf` …: a UTF-16 BOM decides,
  else UTF-8 — files.js `decodeText`; Windows PowerShell 5.1 writes UTF-16, and a UTF-8-only reader sees the guards "off"; the
  server's `approvalMeta` decodes the same way), the probe's `editTargets` / `fsTargetPath`, `approvalProjects` (Human approval
  guard), `sessionFlagFile` (`dev-spec-<kind>-<sha1(session_id)>.flag` in the
  OS temp folder), `claimProse` / `claimScan` / `claimMatch` (the Stop hook's pre-filter) and `parseProjectDir(v, base)` /
  `fileUriToPath` / `unexpandedVar` — ONE reading of an MCP tool's projectDir (`{none}` · `{dir}` · `{code: project-dotdot |
  project-network | project-uri}`), which **mcp/server.js** requires too (`HOOK_UTILS`, its `RE_DOTDOT` included). mcp/tests/
  10-guards-guard-downs.js and 10-guards-shell-writes.js check they agree with the engine's.
- **What the hooks and the engine both read — mcp/lib/probe.js, ONE copy** (never a renamed copy in a hook: the 8-line duplication
  guard can't see one — review 8): the approval pre-filter (`approvalPlain`, `approvalMayBe` over `APPROVAL_CANDIDATE_TESTS`,
  `RE_APPROVAL_VERB` — the engine's `approvalCandidate` adds a PowerShell `-EncodedCommand`'s decoded script, the hook passes any
  encoded-looking call on), the guarded files by path (`guardedFileOf`, `specsParentOf`), dev-spec's approval-shaped tools
  (`RE_APPROVAL_MCP`) and other servers' file tools (`MCP_FILE_VERBS` → `isMcpFileTool`, `approvalHookMatcher()` — hooks.json's
  matcher, each verb spelled case-blind — and `mcpPathArgs`), and the observe pre-filter (`observedNorm` / `observedBodies`). guards.js
  and evidence.js require them at load, the hooks through `probe()`. A guard-down another module reads in a command it names
  (dev-guardian's, engine/guardian.js) adds its test to `APPROVAL_CANDIDATE_TESTS` and its file to `guardedFileOf`: the hook's pre-filter
  and the engine's stay one.
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
  `/spec-doctor` and `/spec-report` (`spec_drift`) grant their tools for the invoking turn by plugin name
  (`mcp__plugin_dev-spec-driven_spec-driven__<tool>`, comma-separated). Only a tool no argument makes write (`readOnlyHint`
  true): `/roadmap`'s `spec_roadmap` and `/spec-report`'s `spec_metrics` write with `write` and ask like any writer
  (mcp/tests/10-guards-guard-downs.js reads every command's list against tools/list). `claude
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
- **Shell writes are edits.** A command passes the pre-filter only with an output redirection, a writer's name or `find` with a
  writing action (`mayWrite`: `RE_SHELL_WRITE`, then each simple command's first `find` and its `-delete` / `-exec`… after it;
  reads, test runs, builds and git exit there), then `spec.shellWriteTargets(command, mode)` — the approval guard's reader
  (`shellSegOps`; git's restores and a path starting with an unknown variable left out) — sends each file through `guardCheck`.
  **The candidate projects** add the nearest dev-spec `.specs/` above the edited file (`pathWords`: ≤ 8 path-like words of the
  command's first 64 K; never a network path): at a monorepo's root, `packages/app/.specs` guards `packages/app/src/a.ts` — the
  engine checks the session's project AND `sessionProject({cwd: dirname(file)})`, the first ask wins.
- **A folder holding code is code** (`guardFolderCode`, review 8 C14 — `rm -rf src` passed while `sed -i src/util.js` asked): a
  target that is no code file by its name but a folder (lstat, never a link) is a code edit when scan.js `folderHoldsCode` finds a
  code file in it — breadth first, ≤ `FOLDER_CODE_ENTRIES` (2,000) entries (past them: it may — ask), links never followed, the scan's
  ignored folders (`SCAN_IGNORE`: node_modules, dist, build, .git, .specs…) neither entered nor code themselves (`rm -rf
  node_modules` asks nothing). A glob in the target's last segment (`rm -rf src/*`) reads the folder's entries it matches (≤
  `GUARD_GLOB_ENTRIES`); a glob higher up is not read. So every removal / move spelling the guard reads — rm -r, rmdir /s and rd /s
  (cmd), Remove-Item -Recurse and PowerShell's rm, find … -delete, mv / Move-Item — asks for a code folder as for a code file. A
  network path is never read. git stays the user's — the edit guard reads no git command: `git rm -r src` asks nothing, as
  `git rm src/a.ts` and `git checkout -- src/a.ts` don't.
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
  `/c/…` is `C:/…`; an inside target holding `~<digit>` through its real path — `src/MAIN~1.JAV` IS src/Main.java — and a shell
  target also as Win32 trims it: Human approval guard → Windows' own readings). The session's own folders (payload `cwd`, the anchors) are Claude Code's / the user's: hooks use a network
  cwd, never walk up the share or realpath it; the save hook skips a network `.specs/` file outside them.

## Human approval guard
- **`roadmap.json → meta.approvalGuard`** = `off` (default, absent) | `ask` | `deny` (`APPROVAL_GUARD_LEVELS`, in order).
  `spec_init {approvalGuard}` / `init --approval-guard off|ask|deny` (else a localized CLI error; `approvalGuardInput()` →
  undefined leaves it unchanged); written under the roadmap lock, never when unchanged; the result reports `approvalGuard` (+
  `approvalGuardNote`).
- **The hook** `hooks/approval-hook.js` (PreToolUse, anchored matcher = probe.js `approvalHookMatcher()`:
  `Bash|PowerShell|Monitor|Write|Edit|NotebookEdit`, `(mcp__.+__)?(spec_approve|spec_feature|spec_init|spec_add_track)`, and other
  MCP servers' file tools by the verb in the name — `MCP_FILE_VERBS`: write, edit, move, delete…, each spelled case-blind
  (`[Ww][Rr][Ii][Tt][Ee]` — a matcher is a regex without flags) — dev-spec's own excluded by
  `(?!spec_|steering_scaffold|ears_validate|trace_check)`; the engine and the hook test `isMcpFileTool`; mcp/tests/10-guards.js checks
  hooks.json holds the built matcher). Monitor runs its command in the Bash tool's shell. A call that can't be an approval exits
  before any file read (the hook's `candidate()` is the probe's `approvalMayBe` — the engine's `approvalCandidate`, a superset: a
  command naming `dev-spec`, `.specs` or a guarded file; a path naming `.specs`, a `~N` short name or a guarded file —
  `RE_EDIT_MAYBE`); else ONE raw roadmap.json read per candidate project, and only then the engine — EACH candidate with the
  guard on judges the call with its own level and meta (its checks: dev-guardian's files are guarded only where a check runs the
  gate), the strictest level's first, the strictest ANSWER wins (`permissionDecision`, + `systemMessage` for deny). One meta for
  every project (the strictest level's) let an outer project at deny without the check drop a nested one's dev-guardian files
  (review 9). Its own trouble before that point exits 0; past it, an engine failure ASKS (`failClosed`).
- **The candidate projects** (hook-utils.js `approvalProjects`, ≤ 12 the call names, then the session's own — always kept) follow
  where the CLI acts: the folders the call names (MCP `projectDir`, the edited file's project, `--project`, `SPEC_PROJECT_DIR=` /
  `$env:` assignments), each `cd` / `Set-Location` target (chained and from cwd alone), the folder holding each `.specs/` /
  `.guardian/` a command's word names (quoted or bare, an `--opt=` prefix off, ≤ 16 — `cp evil sub/.specs/guardian.cjs` from the
  folder above acts on `sub/`'s files: review 9), and the payload `cwd` through `probe.nearestProject`, then the anchors — text
  only, a superset (an extra candidate only makes the answer stricter). The session's own folders are read on a share too; a network path
  the AGENT names only on a share the session is on; none is walked up. An MCP `projectDir` goes through `parseProjectDir`
  (relative: from `CLAUDE_PROJECT_DIR`, `SPEC_PROJECT_DIR` and the cwd, each a candidate); a `file://` URI that is no local path
  asks at least (`opts.projectUnreadable`, why `project`); `..` and network values still go to `approvalProjects` (the server
  refuses them).
- **The edited path as the file system reads it** (`approvalEditTargets` = the probe's `editTargets`, which hook-utils
  re-exports for the hook): resolved against the
  payload cwd (`.` / `..` folded), `guardTargetPath()` on win32, and its real path on every platform (`longPath`: the real path of
  its deepest existing folder, ≤ `EDIT_MAX_UP` = 16 levels up, + the rest — never a network path's) — an 8.3 name (`ROADMA~1.JSO`,
  `SPECS~1/newfeat/.state.json`: a folder Write makes), a folder linked to `.specs/` (`sx/roadmap.json`). On win32 also Windows' own
  readings (below): the 8.3 rule on what nothing on disk answers, Win32's trailing dot / space (`roadmap.json.` — Node keeps it, a
  Python or .NET MCP file tool writes roadmap.json). Every reading counts.
- **Windows' own readings of a path (1.30.1)** — probe.js, ONE copy for the hooks and the engine; on win32 only (`win`: the platform's,
  `approvalGuardDecision`'s `opts.win` / `shellWriteTargets`' third argument for tests — Linux and macOS have neither: `SPECS~1` and
  `roadmap.json.` are other names there). **8.3 short names:** NTFS gives every non-8.3 name an alias (`.specs` SPECS~1, `.guardian`
  GUARDI~1, `baseline.json` BASELI~1.JSO, dev-guardian's CLI DEV-GU~1.MJS) that every program opens. `shortNameOf(seg)` — the rule over
  `SHORT_NAME_LONGS` (the guarded files, `.specs` / `.guardian` / `.execution`, dev-guardian's CLI): `<base>~<N>[.<ext>]`, base 1–6
  characters starting the long name's (dots but the last and a leading run dropped, upper case) or, past four collisions, its first 2 +
  4 hex (`SP1A2B~1`), ext its first 3 — fail closed (an alias of a missing file may be made for it). `mayShortName(text)` is the
  pre-filters' superset (`APPROVAL_CANDIDATE_TESTS` on win32, the hook's `partial`, hook-utils `approvalProjects` through `shortDirAt` /
  `specsParentOf`: `cp evil sub/SPECS~1/guardian.cjs` makes sub/ a candidate). **Win32's trimming** (`winPathTrim`): a segment ending in
  one period loses it (`.specs.\x`), the last segment its trailing periods and spaces (cmd.exe, PowerShell and native programs write
  `.specs\roadmap.json.` as roadmap.json; Node and Git Bash keep the name), and NTFS reads a folder segment's stream designation as the
  folder (`.specs::$INDEX_ALLOCATION\roadmap.json` IS .specs\roadmap.json — cmd.exe, .NET, Node): an inner segment's `:<stream>` is
  dropped (a drive's `C:` kept; the last segment's is `guardTargetPath`'s). **The shell reading** (guards.js `shellWinReading`, a third
  reading in `shellPathReadings`, the `into` names too): the trim, then each alias through the file system for a local path (`longPath`
  from the payload cwd, ≤ `SHORT_DISK_UP` = 8 levels, ≤ `SHORT_DISK_PATHS` = 32 paths a call — `ctx.disk`; an alias the volume made
  expands, a folder that merely looks like one — `spe cs` holding SPECS~1 — stays itself), else (a network path, a variable or glob
  first, past the budget, nothing on disk) by the rule. dev-guardian's CLI or launcher in program position by its alias
  (`guardianShellActions`). **The edit guard** (`guardCheck`): a target inside the project holding a `~<digit>` is read through its real
  path only — never the rule, which would ALLOW more there (`src/MAIN~1.JAV` IS src/Main.java: code; `SPECS~1/x.ts` IS .specs/x.ts);
  its shell targets also as Win32 trims them (`Set-Content src\a.ts. x` writes src\a.ts). mcp/tests/10-guards-shell-writes.js pairs
  each Windows spelling with its long-name twin (ask / deny, the check on / off; win: false allowed), 10-guards-hooks-cost.js times
  every new reader by shape.
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
  or +ai (`APPROVAL_GATED_TRACKS`: they carry a phase; +sec / +saas / a pack stay allowed). **The guarded files** (probe.js
  `guardedFileOf`, read on the path's segments) — `.specs/roadmap.json`, `.specs/**/.state.json`, `.specs/**/.execution/observed.jsonl`
  (a forged line would make a run "observed") — written through Write / Edit / MultiEdit / NotebookEdit (`APPROVAL_EDIT_TOOLS`), a
  shell writer or an MCP file tool: `command: null` (the user makes that change), `project` the folder above `.specs/`
  (`approvalSpecsProject()`). `dev-spec merge-state … <ours>` onto a state file is one too (git runs the driver itself, never
  through the Bash tool).
- **dev-guardian's gate (1.30, review 8)** — its rules live in engine/guardian.js, read through the guards' hook points: guards.js
  `approvalShellReaders()` (per simple command — `guardianShellActions`, given `programAt`) and `approvalActionFilters()`
  (`guardianGuardFilter`); its two files are probe.js `guardedFileOf`'s (the approval hook reads them before the engine loads), its
  pre-filter word probe.js `APPROVAL_CANDIDATE_TESTS`'. Two one-liners stay where they are: `shellOpActions`' unknown program — the
  two files' own guard-down, never "unreadable", so nothing asks without the check — and `approvalCommand` (no command for them).
  With a check running the gate (`guardianGuardOn(meta)`; meta unknown → yes, fail closed), these are guard-downs (`command: null`
  — the user makes them): an agent's write of `.specs/guardian.cjs` (`guardian-launcher` — code the gate runs) or
  `.guardian/baseline.json` (`guardian-baseline` — what it accepts as known), through every writer above (`approvalGuardedFile` →
  `guardedFileOf`); an agent-run `baseline update` of the launcher or of dev-guardian's own CLI in program position
  (`guardian-baseline-update` — it accepts every current finding, the feature's included); a gate run — the launcher, or
  `dev-spec finish … --run` — under a `DEV_GUARDIAN_CLI` / `CLAUDE_CONFIG_DIR` the command sets (`guardian-cli`: a prefix
  assignment, or one an earlier command set — `ctx.vars`). Without the check they are dropped (`guardianGuardFilter`). The
  pre-filters let them through: `guardian` in `APPROVAL_CANDIDATE_TESTS` (the engine's and the hook's), `.guardian` and the two
  names in the hook's `RE_EDIT_MAYBE` / `RE_MCP_MAYBE`, `.guardian/` paths in its `RE_GUARDED_DIR` and `specsParentOf`.
  **`.guardian/` as a whole** is the baseline's guard-down too (`guardian-baseline`, review 9 — like `.specs/`'s): a folder
  destination (`cp … .guardian/`, `cp -r evil/. .guardian/`, `rsync`, `Copy-Item`, `tar -C .guardian`), removed, moved onto,
  replaced by git or a link (`rm -rf .guardian`, `mv evil .guardian`, `git checkout HEAD~1 -- .guardian`), an MCP move / delete of
  it — `shellPathFacts`' `guardianSelf` / `guardianHit` (the folder itself, or an entry that may be its baseline: `.guardian/*`),
  `approvalEditActions`' whole-folder reading; `budgets.yml`, `reports/` and reads stay allowed.
  **A filter never stands in for a fallback** (review 9 — `dev-guardian baseline update; eval node <cli> approve …` was ALLOWED
  without the check, 1.29.1 asked): `approvalGuardDecision` runs `approvalActionFilters()` as EACH reader returns — before the
  shell's `approvalUnparsed` fallback, on each edit / MCP hit before it is the answer (a dropped hit lets the reading go on: the
  next path, the whole-folder reading) — and dev-guardian's file is a fact of its own in `shellPathFacts` (`guardianFile`, never
  `guarded`): each operation ADDS its action to the path's 1.29 reading (`git restore .specs/guardian.cjs` stays a feature
  folder's restore). So without the check every call decides as the same call without its dev-guardian part; a new filter keeps
  that rule (mcp/tests/09-evidence-guardian.js pairs each call with its twin). A glob onto either file is its write too (the
  baseline's: `guardianHit`, review 9; the launcher's — `.specs/guard*.cjs`, `.s*/guardian.cjs` — `shellPathFacts`' `launcherGlob`, 1.30.1).
  Known limits: dev-guardian's own MCP tool `set_baseline` (not in the hook's matcher: dev-guardian's side) and a variable exported out of the
  command's sight; for the launcher, its verification before every run is the backstop.
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
  then with every flag a switch — `CLI_SWITCHES` (mcp/lib/probe.js, `spec.CLI_SWITCHES`) is the ONE list of CLI boolean switches (conventions.md → CLI boolean
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
- **MCP file tools** (`approvalEditActions()` / `approvalPathArgs()` — probe.js `mcpPathArgs`, the hook's reading too): string
  values of path-named keys (3 levels, ≤ 32; a
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
  doesn't parse, and its text names dev-spec, `.specs`, dev-guardian (`guardian` — `RE_PARTIAL`, review 9) or an approval tool
  while a project the session may be in has the guard on.
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
  `.specs/`, `patch` without a file operand, a link to a guarded FILE (not a folder) made by one of those routes and then
  edited through (only its folder's real path is read), and an 8.3 short name SET by hand (`fsutil file setshortname .specs ZZZ` —
  administrator rights; any name, no `~N`: the rule can't know it). Outside Claude Code the elicitation path gates spec_approve /
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
  (cli/tests/11-claude-code.js checks the two agree and that no mcp/lib module loads). **In a project, the last render is reused**
  (cli/completion.js `statusCacheRead` / `statusCacheWrite`, no engine): kept in the OS temp folder per key (this CLI, the
  candidate folders resolved, `$COLUMNS`) with `specsSignature()` of the project's `.specs/` taken BEFORE it rendered — every
  entry's path, size, mtime and ctime, ≤ `STATUS_CACHE_ENTRIES` (4,000; past it: no cache), links never entered — and served while
  that signature holds and it is under `STATUS_CACHE_TTL_MS` (10 s) old. Any change under `.specs/` shows at the next render. **What
  it reads OUTSIDE `.specs/` (1.30.1)** shows at the next render too: the render reports the paths its answer depends on there
  (`statusLine(dir, {reads})` — Phase 4's test files, read or missing, `statusTestsGate`; the gates and the finish step read only the
  spec and state files) and the entry signs them (`outside` / `osig`: size, mtime, ctime or absent — ≤ 64, else no cache); a file
  among them changed within `STATUS_CACHE_RACY_MS` (2 s) of the render is not kept (the render may have read it before the change);
  the folder the candidates find (`statusNear` — the probe's walk the render makes anyway) is compared at each read (a `.specs/`
  made nearer the cwd is a miss); a worktree mapped to its checkout (git's files decide it) keeps its render
  `STATUS_CACHE_MAPPED_TTL_MS` (2 s). Measured (Windows, Node 26, median of 21 interleaved fresh processes, `node -e 0` 51 ms): a
  5-feature project 194 → 80 ms on a hit (outside a project 72; a loaded machine, `node -e 0` 96: 414 → 152, outside 135); 1.30.1's
  signatures cost nothing measurable (`node -e 0` 49–59 ms: 5 features 80 → 81 ms, a Phase 4 line with its test file 94 → 90; a
  miss, the engine rendering, 232). `--print-config` prints the `statusLine`
  entry — in a plugin's versioned cache folder, a `node -e` one-liner that finds the newest installed `<version>` at each run
  (cli/completion.js `statuslineCommand`: no quote, dollar, backtick, percent, ! or backslash, so every shell passes it; else the
  plain command and `cacheNote`). A plugin can't ship a status line (plugin `settings` honour only `agent` /
  `subagentStatusLine`), hence the opt-in `/spec-setup statusline`.
- **The dev-guardian launcher (1.29)** — the other newest-installed-version lookup, for the project check `guardian`
  (tasks-and-evidence.md → Project checks). The sibling plugin lives in the same versioned cache
  (`plugins/cache/<marketplace>/dev-guardian/<version>/cli/dev-guardian.mjs`), so its path can't be baked into a check either.
  A `node -e` one-liner like the status line's did NOT fit: with DEV_GUARDIAN_CLI, CLAUDE_CONFIG_DIR, every marketplace, the
  numeric order and a clear exit 3 it was ~730 characters against meta.checks' 500. So the check is `node .specs/guardian.cjs
  scan --project . --fail-on high --format json` and `.specs/guardian.cjs` is a small generated script (guardian.js
  `GUARDIAN_LAUNCHER`, committed with the project: a teammate's clone runs the same check).
  - *The lookup is ONE function* (1.30), `findDevGuardian(env, cwd, fs, path, os)`: the engine runs it for the offer
    (`guardianCli(env, cwd)`) and the launcher carries its source (`Function.prototype.toString`, CRLF folded) — the two can't
    drift. Its source rules: Node core only, handed in; no backslash, no backtick, no `${`. `DEV_GUARDIAN_CLI` first — only a
    file whose basename is `dev-guardian.mjs` (review 8: any file was imported, the launcher was a trampoline); else Claude
    Code's `plugins/installed_plugins.json` under `CLAUDE_CONFIG_DIR` — else `~/.claude` (Claude Code's own rule: one config
    folder, never both): the `installPath` of a `dev-guardian@<marketplace>` entry whose `cli/dev-guardian.mjs` is a file — one
    scoped to this project (`projectPath` = the cwd) over the user's, then the newest version. That file decides once it parses
    (a dev-guardian it doesn't list is not installed: an update's leftover folder, a disabled copy). Without it, the newest x.y.z
    folder (semver only — a commit-hash folder like `9f3e2a1b7c` read as 9 before) of `plugins/cache/*/dev-guardian/` holding
    the CLI and not marked `.orphaned_at` (Claude Code marks an update's leftovers so).
  - *What it runs:* only `scan`, `baseline` (the user's `baseline update`), `status` and help (`GUARDIAN_FORWARDED`); anything
    else exits 3 ("not forwarded"). A `DEV_GUARDIAN_CLI` it ran is said on stderr (`dev-guardian launcher: DEV_GUARDIAN_CLI=…`)
    and lands in the verdict (`override`) and the merge summary.
  - *The diff base (1.33):* dev-guardian 3.8.0's test-integrity check (`guardian-test-integrity`: a focused `.only` high; a skip, a
    deleted test file, assertions removed, an always-passing test script medium) reads a change only when `scan` gets `--diff-base
    <ref>` (or a `--baseline-ref` / `--rules-ref`) — the gate's command stays `GUARDIAN_COMMAND`. `finish --run` hands the launcher
    the feature's base in `DEV_SPEC_DIFF_BASE` (`GUARDIAN_DIFF_BASE_ENV`; tasks-and-evidence.md → Project checks); the launcher
    appends `--diff-base <ref>` (`guardianDiffBaseArgs`) only to a `scan`, only when the arguments name no base of their own
    (either spelling), and only for a dev-guardian ≥ 3.8.0 — its version read from the install it resolved (`devGuardianVersion`:
    `<root>/.claude-plugin/plugin.json`, else `package.json`, else `mcp/package.json`; none readable: nothing appended, never a
    guess from a folder name). An older dev-guardian runs exactly as before. A value that is no plain ref name (`plainRefOk` =
    `branchNameOk`'s rule: never `-…`, no `..`, no `.lock`… — plus none of git's pseudo-refs as the WHOLE name, in any case: `HEAD`
    / `head` (HEAD itself on a case-insensitive file system), `ORIG_HEAD`, `FETCH_HEAD`, `MERGE_HEAD`, `CHERRY_PICK_HEAD`,
    `REVERT_HEAD`, `BISECT_HEAD`, `REBASE_HEAD`, `AUTO_MERGE` — a branch `fix/detached_head` is a branch; the list lives inside the
    carried function) refuses the scan (exit 3, "DEV_SPEC_DIFF_BASE is no plain ref name")
    — only where it would be appended. The launcher says what it appended on stderr (`dev-guardian launcher: --diff-base <ref>
    (DEV_SPEC_DIFF_BASE)`): the verdict keeps it (`diffBase`, the head line's `guardian.diffBase`), a configuration error's message
    never (`RE_LAUNCHER_DIFF_BASE`). Its findings gate like any finding: a `.only` (high) blocks at `--fail-on high`, a skip (medium)
    is a new finding below the bar; a finding of that tool is named a weakened test (`test: true`, `guardian.finding`). The three
    functions are carried like `findDevGuardian` (toString, the same source rules); `plainRefOk` is exported (the test holds it to
    `branchNameOk`), the other two are tested through the launcher itself.
  - *How it runs it:* it sets `argv[1]` to that CLI (dev-guardian runs `main()` only when argv[1] is itself — realpaths
    compared) and imports it by its file URL (`import("node:url")`: `require("url")` would be a Node core module CLAUDE.md
    doesn't list), so dev-guardian's own exit code is the run's. Nothing found, a subcommand not forwarded, a CLI that doesn't
    load → `exitCode = 3` (never `process.exit`: a message to a pipe would be cut) and a "dev-guardian not found: …" /
    "could not be loaded" line. `nosemgrep` comments on its `path.join` / `path.resolve` helpers: dev-guardian's own Semgrep
    flagged them (medium) in every project.
  - *It is verified, never trusted* (1.30, review 8 ds-security 1): the gate runs code from the project, so `guardianLauncherState()`
    compares `.specs/guardian.cjs` (lstat: a regular file, ≤ 256 KB, read raw, CRLF folded) with `GUARDIAN_LAUNCHER` → ok ·
    outdated (an earlier version's, byte for byte: `GUARDIAN_LAUNCHER_PAST`, sha1 — 1.29's and 1.30–1.32.x's are mcp/tests/fixtures) · missing ·
    changed. `finish --run` checks it before running anything (`guardianPreRun`: outdated → rewritten first, with a note;
    missing → `no-launcher`, changed → `launcher-changed`, both refused with nothing run or recorded), `recordFinishChecks`
    refuses a reported run of a changed one (and a pass of a missing one), `spec_upgrade` flags it and `--apply` writes it;
    `init --guardian` (no guard-down while the check is already set) writes it again. **A launcher edit is a release item:**
    add the old text's sha1 to `GUARDIAN_LAUNCHER_PAST`, or every project's gate refuses until `init --guardian`.
    **Mixed versions on a team:** the launcher is committed, so an OLDER engine meets a NEWER launcher — a 1.32 dev-spec reads
    1.33's as `changed` and refuses, and its "init --guardian writes it again" would put 1.32's back (the file then flips between
    commits). PAST only ever helps the newer side; the older's text can't change. So: update dev-spec on every machine of a team
    before finishing a feature after a launcher edit (the release note says so), and `launcherChanged` (1.33) ends "if a newer
    dev-spec wrote it, update dev-spec instead" — what the NEXT launcher edit's older readers will see.
  - The command runs under cmd.exe, bash, PowerShell 5.1 and pwsh alike (cli/tests/09-evidence-guardian.js).
    mcp/tests/09-evidence-guardian.js runs the launcher and `guardianCli` on fake caches and installed_plugins.json files.
    **Hermetic tests:** the runner drops `DEV_GUARDIAN_CLI` and points `CLAUDE_CONFIG_DIR` at an absent folder of the chain's own
    (testing.md), or init would offer the gate on a maintainer's machine with dev-guardian installed.
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
- **1.27.1 — one runner** — the six hooks each carried their own stdin reader, once-guards, safety net, `finish()`, payload parse
  and catch (13 % of the hooks' code lines were duplicated, 0 after): hook-utils.js `runHook` / `finish` / `payloadOf` / `eventOf`
  / `probe()`; hook-utils.js loads the probe on first use. Measured (Windows, Node 26, a loaded machine; 31 rounds of fresh
  processes, 1.27.0 and 1.27.1 copied side by side, their order alternating): every fast path's median within ±5 ms of 1.27.0's
  (a p25–p75 spread of 20–50 ms; time in the process 35–55 ms either way, `node -e 0` 30), the engine paths too (SessionStart
  in a project 230 → 208 ms, a Stop claim 287 → 247, ExitPlanMode 174 → 165 — noise, not a gain); requiring hook-utils.js
  costs ~0.7 ms over an empty module. The engine's `isNetworkPath`, `unexpandedVar`, `expandHome`, `guardTargetPath` and `approvalEditTargets` became
  the probe's functions (they had been copies).
- **1.30 (review 8)** — **ds-security finding 3:** the approval hook's dot-glob pre-filter (and the engine's copy of it), the edit
  guard's path-word regex and its `find … -delete` branch, the guarded-file regexes, the hook's `.specs`-parent regex and the
  trailing-separator trims rescanned a run from every start: `echo =.=.…` (120 K characters) ran the approval hook 16.7 s against
  its 10 s timeout, so the guard-down behind it went through (exp4 / exp9 of the report: the regex alone 3.5 s at 64 K; the guard
  hook 4.1 s on an 80 K command outside any project). Every scan is linear (the rule above): at 64 K the dot glob 2.8 s → under 1 ms,
  the path words ~2 s → under 1 ms; a sweep of every regex the hooks run on payload text, and of the engine's lexer at its 64 K cap
  (pumped with ~80 token pairs), found no other super-linear one (the lexer: ~0.1–0.2 s at the cap). **ds-maint finding 1:** every
  hook exports `decide()`; the MCP suite's hook tests run in-process (`hookIn`), real processes kept for stdin, the safety net,
  oversized payloads, preloads and timing. **finding 4:** renamed copies the duplication guard couldn't see — the observe hook's
  pre-filter, the approval hook's MCP path reader, verb list, approval-tool and guarded-file regexes, server.js's `RE_DOTDOT` — are
  probe.js's / hook-utils.js's one copy; hooks.json's verbs (`[Ww]rite`) were case-sensitive, so `mcp__x__FILE_WRITE` never reached
  the hook: the matcher is built from `MCP_FILE_VERBS`.
- **1.30 review 8** — `allowed-tools` pre-approved two writers (`/roadmap`'s `spec_roadmap`, `/spec-report`'s `spec_metrics`,
  both writing with `write`) although the 1.26 rule was read-only tools only: dropped, and a test reads every command's list
  against tools/list's `readOnlyHint`.
- **1.31** — `omitClaudeMd: true` on spec-critic and spec-verifier (google/elephant-goldfish-model's reviewer isolation): a
  fresh subagent had no conversation, but every CLAUDE.md file still loaded — the author's context in the reviewer's.
- **1.32** — a sixth agent, spec-ui-reviewer (Shopify's Helix UI gate): the visual review needs a reviewer that sees only the
  images, so it is no mode of the code reviewer (which keeps CLAUDE.md and reads the diff).

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
- **1.30 (review 8, integration C14)** — `rm -rf src` passed both plugins' guards (dev-guardian only warned) while `sed -i
  src/util.js` asked: a folder holding code is a code target (`guardFolderCode` / scan.js `folderHoldsCode`), for every removal and
  move spelling the guard reads.
- **1.30.1** — on win32 `echo x > src/MAIN~1.JAV` (or a Write there) edited src/Main.java as no code (`.JAV`) and PowerShell's
  `Set-Content src\a.ts. x` wrote src\a.ts as no code: a target holding `~<digit>` is read through its real path, a shell target also
  as Win32 trims it (Human approval guard → Windows' own readings).

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
- **1.30 (review 8)** — dev-guardian's gate joined the guard: at deny, an agent overwrote `.specs/guardian.cjs` with a stub
  printing exit 0 (recorded as the CLI's own observed pass), ran `baseline update` or wrote `.guardian/baseline.json` to clear a
  failed gate, or pointed `DEV_GUARDIAN_CLI` at a stub — all allowed. Now guard-downs while a check runs the gate (rules in
  guardian.js, one-line hook points in guards.js).
- **1.30 (review 9)** — **HIGH:** a dev-guardian action switched the fail-closed fallback off: it made the action list non-empty,
  so `approvalUnparsed()` never ran, then `guardianGuardFilter` dropped it without the check — `dev-guardian baseline update; eval
  node <cli> approve … --force` (and the launcher's, a `DEV_GUARDIAN_CLI=` prefix, `X=approve; … $X`) went from 1.29.1's ask to
  allow; PowerShell's `…; iex "node <cli> approve …"` and an MCP move of `.guardian/baseline.json` onto `.specs/roadmap.json` from
  deny to allow (the first hit returned); `git restore .specs/guardian.cjs` lost its feature-folder reading. The filters run as each
  reader returns, dev-guardian's file is `guardianFile` (added, never in place). **MEDIUM:** `.guardian/` as a folder destination
  (`cp … .guardian/`, `rsync`, `mv evil .guardian`, `git checkout -- .guardian`, an MCP move) was unguarded with the check:
  `guardian-baseline` now. **3a:** a nested project's files named from the folder above (`cp evil sub/.specs/guardian.cjs`) were
  judged by the outer project alone: the folders a command's words name are candidates, each candidate judges with its own meta.
  **3c:** `RE_PARTIAL` names `guardian`. **3b:** 8.3 short names in shell commands — a known limit (listed).
- **1.30.1** — **3b closed:** on win32 `cp evil SPECS~1/guardian.cjs`, `cp x SPECS~1/roadmap.json`, `echo x > GUARDI~1/BASELI~1.JSO`,
  `node …/DEV-GU~1.MJS baseline update` were allowed at deny (a shell word read as text), and so were Win32's trailing dots —
  `Set-Content .specs\roadmap.json. x` (PowerShell 5.1 and 7, cmd.exe: roadmap.json written; checked on Windows 11) — and a Write of
  `SPECS~1/newfeat/.state.json` (editTargets read two levels: the new folder hid the alias). Windows' own readings (above): the 8.3
  rule, the trim, the deepest existing folder's real path — probe.js, one copy (files.js `realPathLoose` is the probe's now).
  **A glob onto dev-guardian's launcher** (`cp evil .specs/guard*.cjs`, `echo x > .specs/*.cjs`, `cp evil .s*/guardian.cjs`) was allowed at
  deny with the check — the known limit "a glob write onto either file", whose baseline half review 9 had closed (`guardianHit`):
  `launcherGlob`. **A folder's stream designation** (`cmd /c 'echo x> .specs::$INDEX_ALLOCATION\roadmap.json'`, .NET's
  `[IO.File]::WriteAllText` there) wrote roadmap.json past the guard at deny (the edit tools were caught through the real path):
  `winPathTrim` drops it.

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
- **1.29** — the dev-guardian launcher, `.specs/guardian.cjs`: a generated script rather than the status line's `node -e`
  one-liner, which did not fit a project check's 500 characters.
- **1.30 (review 8)** — the launcher's lookup became one function the launcher carries (`findDevGuardian`); installed_plugins.json
  first (the cache's newest numeric folder ran an orphaned or another project's copy, and a commit-hash folder read as version 9);
  DEV_GUARDIAN_CLI only a `dev-guardian.mjs` and only the gate's subcommands forwarded (it imported any file with any arguments:
  `DEV_GUARDIAN_CLI=…/dev-spec.js node .specs/guardian.cjs approve … --force` recorded a forced approval at deny); the launcher
  verified before every run and recorded run (`launcher-changed`), an earlier version's replaced (`GUARDIAN_LAUNCHER_PAST`).
- **1.30 (review 8, ds-maint finding 5)** — the status line loaded the whole engine after every message in a project (+158 ms over
  `node -e 0`), its most frequent engine load: the render cache (Status line above).
- **1.33** — the diff base: dev-guardian 3.8.0's test-integrity check reads a change only with `--diff-base`, so `finish --run`
  passes the feature's base in `DEV_SPEC_DIFF_BASE` and the launcher appends the flag for a 3.8.0+ install (the command string
  unchanged: the 1.29 contract). A launcher edit: the 1.30–1.32.x text's sha1 joined `GUARDIAN_LAUNCHER_PAST`
  (`guardian-launcher-1.32.cjs`).
- **1.33 review 5** — `plainRefOk` let `head` / `ORIG_HEAD` / `FETCH_HEAD` through (`head` is HEAD on Windows): every pseudo-ref
  refused, any case. A 1.32 engine reads the 1.33 launcher as changed and its fix reinstalls 1.32's: the mixed-versions note above,
  the release note, and `launcherChanged` names a newer dev-spec from now on.
- **1.33 review 6** — review 5's suffix rule refused any branch ending in `_HEAD` (`fix/detached_head`): only git's pseudo-refs as
  whole names now. `launcherChanged`'s PT / ES aligned with EN's "instead" ("em vez disso", "en su lugar"). The diff base is never
  skipped (tasks-and-evidence.md → History).
- **1.30.1** — the cache's blind spot: for up to 10 s a change OUTSIDE `.specs/` the line reads didn't show (a Phase 4 test written —
  "write the tests" stayed; a `.specs/` made nearer the cwd; a worktree's mapping): the render reports its outside paths and the
  entry signs them, the probe's folder is compared at each read, a mapped render keeps 2 s.
