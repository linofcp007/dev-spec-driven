# Claude Code integration — hooks, guards, commands, status line

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
The hook rules, guard mode (edit guard), the human approval guard, the status line, user defaults, MCP annotations and
the plan-mode bridge. The hooks.json rule is in CLAUDE.md; the scope guard's rule is in tasks-and-evidence.md →
End-of-turn evidence gate and scope guard. A hook's process I/O and its folder lookups follow conventions.md — flush stdout
before exiting (never `process.exit()` right after a write), a feature's folder through `resolveFeature()` /
`existingFeature()`.

## Hooks and commands (from Conventions & gotchas)
- **The working agents list `Bash, PowerShell` (1.23 review 5 M12).** spec-implementer, spec-simplifier and spec-reviewer run
  `_Verify:_` / `git diff`, so they need a shell on every platform. Claude Code's tools reference: on Windows WITHOUT Git
  Bash the PowerShell tool is enabled automatically and there is no Bash tool; with Git Bash both exist; on Linux / macOS /
  WSL PowerShell is opt-in. The sub-agents reference: a `tools:` entry that doesn't resolve is dropped, and only a list where
  NOTHING resolves keeps the agent from launching — so naming both is safe everywhere, and naming Bash alone left the
  agents shell-less on a PowerShell-only Windows (they could only answer NEEDS_CONTEXT). The tool names are the exact
  strings of permission rules and hook matchers (`PowerShell`). spec-critic has no shell on purpose (read-only).
  spec-verifier (1.26 — the reviewer's former verify mode, split out so each per-finding dispatch loads ~3 KB instead of the
  reviewer's whole prompt) lists both too: it reads `git diff` / `git blame` and may run one focused test. It reports no run,
  so the SubagentStop matcher leaves it out (`^(dev-spec-driven:)?spec-(implementer|simplifier)$`). Agent descriptions stay
  ≤ ~250 characters (every session lists them): what the agent does and when, never "see the agent body" — the dispatcher
  sees only the description. The critic runs on `model: inherit` (one judgment-heavy dispatch per gate: the session's model);
  the dispatched-in-bulk agents default to `sonnet` (an inherited Opus would multiply the cost of N parallel verifiers).
- **One dev-spec project rule — `mcp/lib/probe.js` (1.27).** "Is this a dev-spec project, and where is it?" had four variants (the
  engine's `isDevSpecDir`; the stop / plan hooks' — + classification.md and dot folders; the observe / spec hooks' — + a generated
  ROADMAP.md; the guard's `devSpecWithoutRoadmap`) and two walk-ups (the guard's and hook-utils' `nearestSpecs` took the nearest
  `.specs/` of ANY tool; the stop hook's `nearestDevSpec` the nearest dev-spec one): a `.specs/` holding only a classified feature was
  a project to the Stop and observe hooks but not to the edit guard or the status line, and another tool's `.specs/` in a monorepo
  package hid the dev-spec project above it from the guard. Now ONE zero-dependency module (Node core only, never the engine) holds
  the rule and the walks, and every surface asks it: the hooks (each requires it lazily, past its own cheap pre-filter), hook-utils.js
  (it re-exports the readers under their old names), the CLI's engine-free paths (cli/completion.js `statusProbe` / `resolveProject`,
  required on first use — `help` loads nothing of mcp/lib) and the engine — doctor.js `isDevSpecDir` IS `probe.isDevSpecProject`
  read through the engine's own reads (`PROBE_IO`: a dry run's folders, `readFileHead`), so files.js `nearestProject`,
  `statusLineProject`, `guardLevel`'s user default, the server's `SPECS_REQUIRED` check and guards.js `sessionSpecs` (now the same
  set) agree with the hooks by construction. **The rule** (`isDevSpecProject(dir)`): `<dir>/.specs` is a folder holding roadmap.json,
  a `steering/` folder, a ROADMAP.md dev-spec generated (`RE_AUTOGEN` in its first 4,000 characters — a v1.8-era project has
  nothing else; mcp/tests/01-core.js keeps serving one), or a feature folder — any folder not starting with `.` (`.execution/`,
  `.removing-*` are none) — with a `.state.json` or a `classification.md`. Cheapest first: no `.specs/` = one stat, a project = two.
  **The walks:** `nearestDevSpec(start, {maxUp})` (≤ `SESSION_MAX_UP` = 40, the engine's SESSION_MAX_UP / STATUS_MAX_UP),
  `nearestSpecs` (any `.specs/`), `nearestProject` (the CLI's resolver: the folder itself with any `.specs/`, else the nearest
  dev-spec one above, ≤ `PROJECT_MAX_UP` = 64); a network or device path is never walked (`isNetwork` — files.js `isNetworkPath`;
  the guard and stop hooks' cruder `/^[\\/]{2}/` read `\\?\C:\…` and `\\wsl$\` as network). **The session:** `sessionAnchors()`
  (CLAUDE_PROJECT_DIR, SPEC_PROJECT_DIR — usable ones) and `sessionProjects({cwd, anchors})` — the nearest dev-spec project at or
  above the payload cwd, then each anchor that is one, distinct: the raw pre-check of every hook (`[]` exactly when
  `spec.sessionProject` finds nothing). Also `usable` / `unexpandedVar` / `expandHome` and the readers `utf16OrUtf8` / `textOf` /
  `jsonOf` / `readText` / `readJsonFile` (files.js `decodeText`'s reading). mcp/tests/10-guards-probe.js builds 12 layouts (an empty /
  another tool's `.specs/`, roadmap.json / steering/ / a classified feature / a `.state.json` / a generated ROADMAP.md alone, a
  steering FILE, dot folders, a monorepo package classified / of another tool) and checks the probe, the engine (isDevSpecDir,
  statusLineProject, sessionProject, resolveProjectDir), statusProbe, the completion's resolver, the approval candidates and five
  hooks (60 runs, the engine load as the observable) agree; `~`; network paths; and that no hook or cli/completion.js keeps a copy.
  Cost (median of 15, Windows, interleaved with 1.26): every hook's fast path within the noise (±3 ms — one small file, required
  only past each hook's pre-filter).
- **Hooks never block and stay cheap.** Every hook exits 0 on any error or irrelevant event, emits at most
  one JSON object, has a 10 s timeout, and only acts on a `.specs/` dev-spec owns (the probe's `isDevSpecProject` — checked by
  PostToolUse AND SessionStart: another tool's `.specs/` gets no status block in every session). The PostToolUse hook:
  requirements.md → EARS + placeholders, tasks.md → every trace gap + EC/NFR/SC warnings (and, tasks.md / change.md, the
  feature's `.state.json lastEditAt` stamp the stop gate reads as activity — `recordSpecEdit()`, 1.22 review), design.md →
  `designSaveCheck()` (active tracks' marker sections, Constitution Check, placeholders); it skips `/.execution/`,
  `.specs/templates/` (unless that folder is a pre-1.14 feature), `.specs/tracks/` (1.15, the same exception) and generated files.
  **It no longer refreshes ROADMAP.md / SPECS.md (1.24 r6 I-I1):** any other spec save leaves the stamp
  `.specs/.execution/roadmap-stale` (`markRoadmapStale`) and the Stop / SubagentStop hook refreshes once, at the end of the turn
  (SessionStart, the next engine mutation and the pre-commit check too) — ~75 % of the save hook was the refresh (272 / 423 / 725 ms a
  save at 10 / 50 / 150 features → ~130–180 ms); the files lag at most one turn, read by nothing that decides
  (lifecycle.md → Roadmap files).
  It loads the engine LAZILY (1.22 review): only for SessionStart and a PostToolUse on a `.specs/` file outside `.execution/` —
  the plain path check runs first (an edit anywhere else cost the engine's ~100 ms load: 173 → 68 ms median per Write / Edit,
  `node -e 0` ≈ 61 ms; mcp/tests/10-guards-review.js asserts which events load it). **SessionStart probes first (1.25.1, review
  7):** it fires in every session of every project (the plugin is user-wide — startup, resume, clear, compact) and loaded the engine
  before asking whether a dev-spec project was there: `sessionMayBeDevSpec()` runs the raw probe every hook uses
  (`probe.sessionProjects` — the nearest folder at or above the payload `cwd` whose `.specs/` is dev-spec's, ≤ SESSION_MAX_UP
  levels; a network cwd is itself; the anchors), and with neither a cwd nor an anchor the process folder — a superset of every
  folder `sessionProject()` and the fallback can pick (a worktree maps only from a dev-spec folder at or above the cwd). Measured
  (median of 15, Windows): a repository without `.specs/` 145 → 56 ms (`node -e 0` 54); a dev-spec project unchanged (~178 ms).
  The context it prints is unchanged (≤ `SESSION_MAX_FEATURES` = 20 feature lines, then one "+N more"; mcp/tests/10-guards-hooks-r7.js).
  The Stop / SubagentStop hook
  follows the same rules (see End-of-turn evidence gate — 1.24 r6 I-I4: a closing message with no claim pattern ends it before the
  engine loads, from the build's hooks/stop-claims.generated.json), and so do the 1.14 observe hook (it prints nothing at all and
  exits as soon as it has appended its line) and approval hook (silent unless `meta.approvalGuard` is on — its only
  output is a permission decision).
- **Every hook runs in exec form (1.25.1, review 7): `{"type": "command", "command": "node", "args":
  ["${CLAUDE_PLUGIN_ROOT}/hooks/<x>.js"], "timeout": 10}`.** The hooks reference (code.claude.com/docs/en/hooks → Exec form and
  shell form): with `args` Claude Code resolves `command` on PATH and spawns it directly — no shell, `${CLAUDE_PLUGIN_ROOT}`
  substituted into each `args` element as a plain string (a path with spaces needs no quoting); `node` + a script path is the
  documented cross-platform pattern (node.exe is a real executable, never a `.cmd` shim). Without `args` (shell form) the command
  string went through `sh -c`, on Windows Git Bash — or PowerShell when Git Bash is absent. Measured on Windows 11 (median of 15, the
  observe hook on an irrelevant Bash call): exec 57 ms · Git Bash 98 ms · Windows PowerShell 5.1 395 ms · pwsh 7 348 ms — and a
  Write / Edit runs three hooks (guard, approval, spec), a Bash call two (approval, observe). **Minimum Claude Code 2.1.139**
  (released 2026-05-11): its changelog — "Added hook `args: string[]` field (exec form) that spawns the command directly without a
  shell, so path placeholders never need quoting"; the docs page states no minimum. An older version reads no `args` and would run
  a bare `node` with the payload on stdin (a syntax error: every hook silently off) — INSTALL.md and the README's quick start state
  the minimum. `claude plugin validate` (2.1.295) checks the hooks' schema (`args` must be an array) and passes. Never go back to
  shell form for a hook; a new hook takes the same shape (mcp/tests/10-guards-hooks-r7.js checks every entry).
- **Which project a hook reads (1.23 review 5, M8): `sessionProject({cwd, anchors})`** (engine/guards.js, on the facade). The
  MCP server is pinned to `SPEC_PROJECT_DIR` = `${CLAUDE_PROJECT_DIR}` (the folder Claude Code started in) and records approvals,
  ticks and evidence THERE; the hooks read the payload's `cwd` first — in a git worktree (EnterWorktree, a subagent `cd`'d into
  `.claude/worktrees/<n>` or a sibling checkout) the worktree's own copy of `.specs/`: the edit guard asked though the tasks were
  approved, the stop gate saw no activity, the SubagentStop gate looked for the report where the implementer hadn't written it.
  The resolver: the nearest folder at or above `cwd` holding a dev-spec `.specs/` (`sessionSpecs`: `isDevSpecDir` — the probe's rule,
  1.27, which counts a feature's classification.md too; ≤ `SESSION_MAX_UP` = 40 levels — a `cd`'d subfolder too —, never above an anchor that holds `cwd`: a dev-spec
  folder above the session's own is another project; a network cwd is only itself), then `worktreeProject(near, anchors)`:
  `gitCheckoutOf()` reads the nearest `.git` (a FILE: `gitdir:` → its `commondir` → `linked`; a submodule's `.git` file has no
  commondir — no worktree); near in another checkout of the same repository as an anchor (`CLAUDE_PROJECT_DIR`,
  `SPEC_PROJECT_DIR`; the status line's `workspace.project_dir`) → the same folder in the anchor's checkout; else, near in a
  linked worktree → the same folder in the main checkout (the common dir's parent) — when that counterpart is dev-spec's.
  Folders are compared by text, then by real path (`sessionSame()`: git writes gitdir / commondir with long names, the payload
  may carry an 8.3 short name). No dev-spec folder near cwd → the first dev-spec anchor. → `{project, root, worktree}`;
  `sessionPath(s, p, cwd)` spells a payload path under `project` when it lies in `root` (the worktree's checkout). The guard,
  stop, observe, spec (SessionStart) and plan hooks run a raw pre-check first — `probe.sessionProjects` (1.27: the nearest DEV-SPEC
  `.specs/` above cwd, ≤ `SESSION_MAX_UP` levels — 1.24 r6 I2: the observe hook's walk stopped at 12, and a `_Verify:_` run deeper
  below a nested project was never logged; mcp/tests/10-guards-review6.js checks every hook walks through the probe — and the
  anchors; a superset: the engine loads only when it passes) and then ask the engine; the spec-hook stamps `lastEditAt` of a worktree's tasks.md save in the
  mapped project (its own state when that feature isn't there) and SessionStart reports the mapped project; the status line's
  `statusLineProject()` maps what it found the same way (`worktreeProject(dir, candidates)`).
- **What the hooks share before the engine loads — `hooks/hook-utils.js` (1.24 review 6).** Not a hook (hooks.json never runs
  it): Node core only, never the engine. `utf16OrUtf8` / `textOf` / `jsonOf` / `readText` / `readJson` read a file as the engine
  does (files.js `decodeText`: a UTF-16 BOM decides, else UTF-8; the BOM dropped) — **C3 / A4:** Windows PowerShell 5.1's
  `Out-File` / `>` write UTF-16, and the approval, guard and stop hooks read such a roadmap.json / .state.json as UTF-8: the
  approval and edit guards read "off", the stop gate saw no activity (the engine and the CLI enforced them). 1.27: the readers live
  in mcp/lib/probe.js (`readJsonFile`, `textOf` …; hook-utils.js re-exports them under the names it always had — `readJson`); the
  guard, stop and observe hooks read through the probe they require anyway, never hook-utils.js for a BOM. Also `editTargets` (the approval hook's Write / Edit
  target — below), `approvalProjects` (its candidate projects — below) and `sessionFlagFile` (a per-session marker in the OS temp
  folder, `dev-spec-<kind>-<sha1(session_id)>.flag`). mcp/tests/10-guards-review6.js checks the hook's readings agree with the
  engine's. The MCP server's `approvalMeta` reads roadmap.json through `spec.decodeText` too (an unchanged spec_init setting on a
  UTF-16 roadmap.json was refused at deny as a guard-down: meta unknown). **1.25.1 (review 7, finding 5):** `parseProjectDir(v,
  base)` / `fileUriToPath` / `unexpandedVar` — ONE reading of an MCP tool's projectDir (a path or a local `file://` URI; `{none}` ·
  `{dir}` · `{code: project-dotdot | project-network | project-uri}`), required by **mcp/server.js** too (`HOOK_UTILS`: its
  `parseProjectDir` / `fileUriToPath` are thin wrappers that add the localized messages): the hook read a `file:///…/projA` as a
  relative folder while the server accepted it — `spec_approve {projectDir: "file:///…", force: true}` went through at ask. Its
  `unexpandedVar` is the engine's rule (mcp/tests/10-guards-review7.js compares them). `editTargets` reads the real path on every
  platform now (a folder linked to `.specs/` — below).
- **Commands never reuse a Claude Code built-in name.** `/init`, `/status`, `/doctor` and `/commit`
  collided with the built-ins (a bare `/doctor` ran Claude Code's, and our own messages told users to
  "run /doctor"); they became `/spec-init`, `/spec-status`, `/spec-doctor`, `/spec-commit` in v1.11 — and the umbrella commands
  of 1.26 keep the prefix (`/spec-setup`, `/spec-review`: `/review` is a built-in too).
- **22 commands, 2 of them model-invocable (1.26 — the context diet).** Claude Code lists every model-invocable skill and
  command with its description under ONE budget shared by every installed plugin (1 % of the context window; on overflow
  descriptions are dropped, least-used first): 1.24 cut the 55 descriptions from 11,013 characters to 5,530 and a real session
  still listed 15 dev-spec commands with no description. 1.26 folds the 55 into 22 (the phase commands into `/spec`, the rest
  into umbrella commands with subcommands — extending.md → The 1.26 command set) and sets `disable-model-invocation: true` on
  every command but `/spec` and `/spec-bugfix`: documented for command files (code.claude.com/docs/en/skills — the same front
  matter as skills, except `name` / `paths`), a user-only command's description leaves the model's context entirely, the
  user still types it, and Claude can't run it on its own (nor preload it into a subagent). The model-visible listing is those
  two descriptions + the skill's: 776 characters (5,718 before: 46 commands' 4,707 + the skill's 1,011); mcp/tests/10-guards-review6.js holds it ≤ 1,500, each
  description ≤ 125 characters, one English line (the multilingual triggers live in SKILL.md's description). The model reaches
  the rest through the skill and the MCP tools, so a model-invocable command never tells it to RUN a user-only one
  (17-docs-review7: "record it with `spec_approve`", never "with /approve"). The prompts loader (prompts-resources.js
  `parseFrontMatter`) reads and ignores the key; the D4 strict-YAML check accepts it. The MCP prompts serve every command.
- **Lean bodies.** A command routes (its subcommands), names the ONE tool call (or CLI line) per subcommand with the current
  tool names, and states the few rules that matter (show the verdict, approvals are the user's, evidence before claims); the
  catalogues — check ids, result keys, flag lists — live in the tool results and `references/` (named by the full
  `${CLAUDE_PLUGIN_ROOT}/skills/dev-spec-driven/references/<file>.md` path: an MCP prompt resolves it too; 17-docs P9 fails a bare
  `references/…` in a command). Only the commands that need the workflow (`/spec`, `/spec-bugfix`, `/executeTask`,
  `/spec-review`, `/spec-tour`) say "use the dev-spec-driven skill"; the self-contained ones (status, doctor, report, setup,
  roadmap…) don't pull SKILL.md in.
- **`allowed-tools` on the read-only commands.** `/spec-status` and `/dss` (`spec_status`, `spec_next_action`), `/spec-doctor`
  (`spec_doctor`), `/roadmap` (`spec_roadmap` — it writes only the generated ROADMAP files) and `/spec-report` (`spec_drift`,
  `spec_metrics`) grant their tools for the turn that invokes them, by their plugin names
  (`mcp__plugin_dev-spec-driven_spec-driven__<tool>`, comma-separated). `claude plugin validate` passes (2.1.292 does not parse a
  command's front matter at all — a deliberately broken probe passed too).
- **The aliases follow the full command (1.24 review 6, C-I9).** `/ds`, `/dss`, `/dsx` read and follow
  `${CLAUDE_PLUGIN_ROOT}/commands/<spec | spec-status | executeTask>.md` with their arguments — Claude Code substitutes the
  variable anywhere in a command's body (plugins reference → Environment variables), and `getPrompt()` does for an MCP client — so
  an alias never drifts from its command; each keeps a short fallback of the rules that matter (/dsx: `_Depends:_`, the
  micro-cycle, the scope rule, evidence) should the file be unreadable.

## Guard mode (1.13 — from Catalog, drift, restore, guard, steering)
- **Guard mode:** `roadmap.json → meta.guard` (`spec_init {guard}` / `init --guard on|off`, with or without
  tracks). `hooks/guard-hook.js` (PreToolUse, `Write|Edit|NotebookEdit|Bash|PowerShell|Monitor` — 1.23 review 5: MultiEdit, a tool
  Claude Code no longer has, left the matcher; a MultiEdit payload is still read) is **silent unless the
  guard is on** — guard off costs one small raw JSON read, the engine is loaded only for guarded projects —
  and `guardCheck()` reads roadmap.json + each feature's `.state.json` / tasks.md, never a repo walk. **1.25.1 (review 7):**
  (finding 8) the shell tools — `sed -i src/a.ts`, `cat > src/a.ts <<EOF`, `Set-Content src\a.ts`, `tee`, `cp x src/a.ts` edited code
  with no prompt: a command passes the hook's pre-filter only with an output redirection or a writer's name (`RE_SHELL_WRITE` — every
  program the engine reads as a writer; a read, a test run, a build, git exit there before any fs call: ~a regex over bare node),
  then `spec.shellWriteTargets(command, mode)` — the approval guard's own reader (`shellSegOps`, nested scripts, variables, `cd`;
  git's restores left out: no prompt on git; a path starting with an unknown variable left out) — and each file goes through
  `guardCheck` as a Write would; (finding 9) the candidate projects include the nearest `.specs/` above the edited file's folder
  (a shell command's path-like words — ≤ 8 —, never a network path): with the session at a monorepo's root, `packages/app/.specs`
  (guard on) guards `packages/app/src/a.ts`; the engine checks the session's project AND `sessionProject({cwd: dirname(file)})`,
  the first ask wins. "Code" is
  `isCodeFile(rel)` (engine/scan.js) — 1.21.1: ONE notion of code the guard, the brownfield scan, `spec_scan {coverage: true}` and the
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
  `permissionDecision: "ask"` with a localized reason (a forced tasks approval still counts, with a note — a `systemMessage`
  shown ONCE per session since 1.24 review 6, C-I8: it was printed on every code edit; the hook keeps a marker per `session_id`
  in the OS temp folder holding the note — another set of forced features shows it again —, and a payload without
  `session_id` shows it every time). Two exceptions,
  at both levels: a TEST file while some non-archived feature has an approved test plan and is unfinished (why
  `tests-phase` — Phase 4 writes the failing tests before tasks can be approved), and any code edit while an ACTIVE spike
  (undecided, or with open tasks, its timebox not passed) exists (why `spike`, field `spikes` — prototype work; a spike has
  no tasks gate, so it is never listed as "awaiting approval"; at the `scope` level a spike never overrides the approved
  features' plan). A
  tasks approval whose content no longer matches tasks.md (tasks appended/edited after it; ticks are
  normalized) is `stale` — it covers nothing and the reason names it; an approval without a fingerprint counts. "Changed" is
  next_action's own test (`approvedContentSame`, 1.25.1 — gates-and-approvals.md → Approval fingerprints): a whitespace-only edit
  (trailing spaces, final blank lines, a "\r\r\n" file normalized to LF) leaves the approval covering.
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
  its hooks — the cwd itself and the anchors are read; 1.27: never walked up the share, as the engine's sessionProject — the observe
  hook's walk climbed to the share root), never realpath'ed by a hook.
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
  `^(Bash|PowerShell|Monitor|Write|Edit|(mcp__.+__)?(spec_approve|spec_feature|spec_init|spec_add_track))$` — 1.23 review 5:
  **Monitor** runs its command in the Bash tool's shell with the Bash permission rules, and an approval through it went past a
  deny-level guard; **Write / Edit** of `.specs/roadmap.json`, a feature's `.state.json` or (1.24) a harness-observed log, below;
  1.24 review 6: **spec_add_track**, below; 1.25.1 review 7: **NotebookEdit** and `mcp__<server>__<…verb…>` — another MCP
  server's file tools by the verb in the tool's name: write, edit, create, move, rename, delete, remove, copy, append, patch,
  replace, save, put, upload, mkdir, touch, truncate, unlink, insert; dev-spec's own tools excluded by a lookahead —
  `(?!spec_|steering_scaffold|ears_validate|trace_check)`; the engine's `RE_MCP_FILE_TOOL` / `RE_DEVSPEC_MCP_TOOL`, the hook's
  `RE_MCP_FILE`; mcp/tests/10-guards.js checks the matcher's set)
  is silent unless the guard is on: a tool call that can't be an approval (a Bash / PowerShell / Monitor command not containing
  `dev-spec` — the hook's `candidate()` mirrors the engine's `approvalCandidate`, a superset; a Write / Edit whose path names
  neither `.specs` nor an 8.3-looking segment `~N` — nor, 1.25.1, ends in a guarded file name; an MCP file tool whose input names
  none of them) exits before any file read (and before hook-utils.js loads); otherwise ONE
  raw read of roadmap.json (UTF-8 or UTF-16 — hook-utils.js) per candidate project; the STRICTEST level wins. The engine is loaded
  only then; it answers `{hookSpecificOutput: {permissionDecision, permissionDecisionReason}}` (+ `systemMessage` for deny). It
  never blocks on its own trouble BEFORE that point: a malformed payload, a broken roadmap.json or any exception exits 0
  silently. **1.25.1 (review 7, finding 6):** past the pre-check — a candidate project has the guard on and the call may be an
  approval — an engine failure (a broken install, an exception) ASKS (`failClosed`: the reason from the i18n tables when they load —
  `unreadable` why `error` — else a prompt without one), never a silent allow.
- **The candidate projects (1.24 review 6, C4 — hook-utils.js `approvalProjects`, at most 12):** the hook checked only the payload
  `cwd` and the anchors, while the CLI acts on `--project` > `SPEC_PROJECT_DIR` > `CLAUDE_PROJECT_DIR` > the nearest dev-spec
  `.specs/` at or above ITS cwd — a session started in a subfolder, a `cd "<P>" && node … approve`, a `SPEC_PROJECT_DIR=<P> node …`
  went through at deny. Now: the folders the call names (MCP `projectDir`, the edited file's project, every `--project` value, every
  `SPEC_PROJECT_DIR=` / `CLAUDE_PROJECT_DIR=` / `export …=` / `$env:SPEC_PROJECT_DIR = …` assignment — those folders themselves),
  every `cd` / `chdir` / `pushd` / `sl` / `Set-Location` / `Push-Location` target (chained from cwd and from cwd alone, `~`
  expanded; where the CLI acts from it — `probe.nearestProject`, the CLI's own resolver walk since 1.27: the folder itself with any
  `.specs/`, else the nearest dev-spec one above, ≤ 64 levels; it took the nearest `.specs/` of any tool, ≤ 40), the same for the
  payload `cwd`, then `CLAUDE_PROJECT_DIR` / `SPEC_PROJECT_DIR`. Text only (nothing evaluated — a superset: an extra candidate can
  only make the answer stricter). Network paths: the session's own folders (payload cwd, the anchors — Claude Code's / the
  user's) ARE read, as the guard / stop / observe hooks do (a project on a share kept no approval guard before); a network path
  the AGENT names (`\\host\share`, `//host/share`, `\\?\UNC\…`) only when it lies on a share the session is on — never an SMB
  connection to a host the agent picked; a network folder is never walked up; `\\?\C:\…` and WSL's `\\wsl$\` are local.
  **1.25.1 (review 7, finding 5):** an MCP `projectDir` is read by hook-utils `parseProjectDir` — the MCP server's own parser: a
  local `file://` URI is its path (it was read as a relative folder name), a relative one resolves from `CLAUDE_PROJECT_DIR`
  (where Claude Code starts the plugin's server), `SPEC_PROJECT_DIR` and the payload cwd (each a candidate); a `file://` URI that
  is no local path (`project-uri`) can't be placed — the call asks, at least (`opts.projectUnreadable`: an `unreadable` why
  `project` action beside the approval); `..` and network values go to `approvalProjects` as before (the server refuses them).
- **The edited path as the file system reads it (1.24 review 6, C5 — `approvalEditTargets` in the engine, `editTargets` in
  hook-utils.js, the same reading):** the Write / Edit check matched the raw text — `.specs/./roadmap.json`,
  `.specs/alpha/../roadmap.json`, `roadmap.json::$DATA` and an 8.3 short name (`ROADMA~1.JSO`, `STATE~1.JSO`) wrote the file and
  went through. Now the target is resolved against the payload cwd (`path.resolve` folds `.` / `..`), `guardTargetPath()` drops a
  stream suffix and maps Git Bash's `/c/` (win32), and the real path is read (the file's, else its parent's + the name; never on a
  network path) — **1.25.1 (review 7, finding 4):** on every platform, not only for a short name: `ln -s .specs sx` (or a junction)
  and then `Write sx/roadmap.json` went through. The hook's pre-filter (`RE_EDIT_MAYBE`) lets a path ending in a guarded file name
  through for that (`sx/roadmap.json`, `fx/.state.json`). Either reading matching counts. (A trailing
  dot / space — `roadmap.json.` — is NOT stripped by Node's file calls: no other file is written, so no rule.)
- **A missing roadmap.json (1.25.1, review 7 — decided: fail closed).** A dev-spec `.specs/` that holds a feature (a feature folder
  with its `.state.json`) but no roadmap.json — every engine write that makes a feature writes roadmap.json, so it was deleted —
  reads as `ask` (engine `approvalGuardLevel` → `approvalRoadmapGone()`, the hook's `rawLevel` → `roadmapGone()`; meta unknown, so
  every init change that could weaken counts). A `.specs/` without a feature stays off. The engine's next roadmap write recreates
  the file with the default meta (off): deleting it from the shell is a guard-down in itself (below), so this only covers a
  deletion the guard didn't see.
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
  never allowed). **1.24 review 6 — more of it:** (C7) the CLI found where it runs with its subcommand unreadable
  (`cliSubcommandUnread()`: a substitution read as `""` — `$(echo approve)`, backticks, `"$(printf approve)"` —, a variable
  `$A` / `${X:-approve}` / `$s` / `%X%`, a positional `"$@"` / `${args[@]}`, a word holding `$(`, a PowerShell `@splat`, or no
  subcommand at all where one comes at run time: under xargs / parallel, or in PowerShell where a `( … )` expression ends the simple
  command) while the command holds an approval word — read in the plain text, a `${X:-…}` default, or the raw text (`printf
  'approve\nalpha'`); (C1) PowerShell's `--%` right after the CLI (`RE_PS_STOP_AFTER_CLI`) with an approval word the lexer found
  no action in. (C-I10) `why: "partial"` (`approvalGuardDecision(…, {partial: true})`): the hook's 2 s stdin safety net fired
  before stdin ended — the payload doesn't parse — and its text names dev-spec, `.specs` or an approval-shaped tool while a
  project the session may be in (hook-utils `approvalProjects` over a `"cwd"` read from the partial text, the hook's own folder
  and the anchors) has the guard on: ask (it exited 0 — allowed — before). Every unreadable action asks at both levels.
- **Track removal (1.24 review 6, E3).** `spec_add_track {remove: true}` (any MCP prefix — the matcher and `RE_APPROVAL_MCP`
  name it; `track` a string, an array or a `tracks` key) and `add-track <f> <tracks…> [--tracks …] --remove` turning off +tdd or
  +ai (`APPROVAL_GATED_TRACKS` — the tracks that carry a phase: test-plan / eval-plan / tests) is a guard-down (`setting:
  "track"`, `tracks`, `feature`); the human's command is `add-track <f> <tracks> --remove`. Adding a track, `--remove=false`, or
  removing +sec / +saas / a pack (no phase of their own) stays allowed.
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
  `permissionDecision: "deny"` (auto mode included — but no hook runs at all in a session with hooks disabled, and the guard reads
  only what a command names: see the threat model below): the reason tells the agent approvals are the human's (stop and ask);
  the user sees `systemMessage` with the command to run — `! node "<clone>/cli/dev-spec.js" approve <f> <phase> [--role r]
  [--force] [--project "…"]` (`approvalCommand()`: a value from the agent's call goes in only when it is plainly safe to
  paste into bash / PowerShell, else a `<placeholder>`; the `!` line run by the agent itself is still an approval).
- **Outside Claude Code the MCP server enforces it (1.21 F1b — mcp.md → Human approvals over MCP elicitation).** The same
  `approvalGuardDecision()` (its result also carries `summary`, the action line) runs inside server.js for spec_approve /
  spec_feature / spec_init: a client with elicitation asks its user (only an explicit approve records it, as `confirmed`); without
  elicitation `ask` runs as before and `deny` is refused with the command (`{plain: true}`: the runnable line without the `!`,
  a reason that doesn't mention it — 1.21 review A4). The plugin's `mcp/servers.json` sets
  `SPEC_MCP_APPROVAL_HOOK=on`: in Claude Code the hook stays the only gate (no second question) — this hook path is unchanged.
- **The threat model (1.25.1, review 7, finding 11 — say it as it is, in every doc):** the approval guard and the edit guard stop
  ACCIDENTS and CASUAL WORKAROUNDS, not a determined agent with a shell. They read each tool call as text — nothing is run or
  evaluated — and ask whenever a command names dev-spec, `.specs/` or a guarded file in a form they can't follow; `deny` refuses
  in auto mode too, but a session with hooks disabled (or bypass-permissions for `ask`) runs no gate. Docs never say a guard
  "holds in every mode" / "can't be bypassed". An agent running `node -e` (or a script of its own) isn't caught; a hand edit of
  `.state.json` / roadmap.json through Write / Edit is (1.23), through a shell write (1.24 review 6), and (1.25.1) through
  globs, variables, folders, links, fed scripts and other MCP servers' file tools.
  `spec.CLI_SWITCHES` is the ONE list of CLI boolean switches (conventions.md → CLI boolean switches): a CLI-only switch would make this lexer
  read the next word as its value.
- **Text fed to a shell (1.25.1, review 7, finding 1 — `shellFedScript()`).** The lexer links each simple command to the one a
  `|` feeds it from (`seg.pipeFrom`; `||` is no pipe, `|&` is), keeps heredoc bodies (`h.body`) and process substitutions
  (`seg.procs`: `<( … )` / `>( … )` — their commands are read as a nested list, and their text kept). A shell with no script of its
  own reading stdin — bash / sh with no operand or `-s` or `-`, cmd without `/c`, pwsh / powershell without -Command / -File or with
  `-Command -`, `iex` / Invoke-Expression without an argument, `xargs … sh -c` (no script, or the replace string) — and `source` /
  `.` / a shell running a process substitution: the text fed to it is read as that shell's script when it is VISIBLE
  (`shellProducedText()`: echo / print / Write-Output, printf with its arguments put in, cat (or nothing) with a heredoc /
  here-string, a PowerShell string expression; a process substitution all of whose commands print visible text) — `echo "node
  <cli> approve …" | bash` is the approval it runs (deny); otherwise `unreadable` why `fed` (`cat run.sh | bash`, `curl … | sh`,
  `bash < file` in a command naming dev-spec / .specs): ask. PowerShell's `node <cli> @('approve', …)`: the array's elements (the
  lexer's next segment) are the CLI's arguments; one it can't read (a variable) leaves the subcommand `@` — unreadable, ask.
- **Brace expansion and globs in the subcommand (1.25.1, review 7, finding 2).** In Bash `{` / `}` are separators only standing
  alone (`{ cmd; }`, at a word's start before a blank / `;` / `|` / `)` / the end): inside a word they are brace expansion and stay
  in it (`{approve,}` was cut into three commands and read as no CLI call). `cliSubcommandGlob()`: the CLI's subcommand word holding
  `{ } ? * [` that may expand to a guarded subcommand (`CLI_GUARDED_COMMANDS`: approve, feature, init, add-track, merge-state —
  `braceExpand()` then `shellGlobRe()`) is unreadable whatever approval word the text holds (`appro?e` has none): ask. `st?tus` stays
  allowed. `devSpecGlob` is unchanged.
- **The lexer (review fixes).** `shellCommandWords(cmd, mode)` lexes by the tool's shell: `bash` (`\x`, `\⏎`, `$'…'`,
  `$( )` / backticks also inside "…"; `raw` keeps backslashes for Windows paths), `ps` (the backtick is PowerShell's escape
  and line continuation, `@'…'@` / `@"…"@`, `#`, `<# #>`), `cmd` (`^`). Recursive, bounded by `APPROVAL_LEX_DEPTH` (32),
  linear. Redirections go to `redirs`, never words. Heredoc bodies are data: skipped when the delimiter is quoted, only
  `$( )` / backticks read when unquoted, read as a script when fed to a shell (`bash <<EOF`, `sh <<<`); `<<` inside `(( ))`
  is a shift. `programAt()` skips launchers and their value options (`APPROVAL_OPTION_VALUES`: `sudo -u`, `exec -a`,
  `node -r` …) and counts npm / pnpm / yarn / bun / deno only through a real run subcommand (`APPROVAL_SUBCOMMANDS`).
  **1.24 review 6 (C1) — PowerShell's stop-parsing token:** an unquoted `--%` at a word's start (ps mode) ends PowerShell's
  parsing — the rest of the line, to a newline or a `|` outside `"…"`, reaches the program as written: split at blanks, `"…"`
  grouping (quotes dropped), `'` `;` `$` `(` `` ` `` plain characters, `%VAR%` kept (cmd-style, expanded at run time). The
  token itself is never a word. `node '<cli>' --% approve …` (the PowerShell tool's own guidance suggests `--%` for arguments
  starting with `-`) approved at deny: the lexer read `--%` as the CLI's subcommand.
- **Guard-down actions** (`kind: "guard-down"`, `setting`: approvalGuard · evidence · roles · check · stopCheck · guard ·
  roadmap · state · observed · track · specs · link) — lowering the guard, and weakening what it protects: evidence observed → reported, approval
  roles cleared or a required role dropped, a project check removed or its command changed, the stop gate off, the edit guard
  lowered, +tdd / +ai turned off (`track`, 1.24 — above), a shell write / move / delete of `.specs/roadmap.json` (or of
  `.specs/`; `command: null` — the user makes that change), and (1.23) a Write / Edit of `.specs/roadmap.json` or of a feature's
  `.state.json` (`command: null`). **1.24 review 6:** `specsWriteActions()` (was roadmapWriteAction) reads every shell writer
  (a redirection, tee / Set-Content / Out-File / rm / mv / dd of=…, sed / perl -i, cp / Copy-Item / ln / install onto it — or
  into a folder receiving a file of that name) on three files — roadmap.json (`roadmap`), a `.state.json` (`state`, `feature`)
  and a harness-observed log (`observed`) —, each path read as the file system reads it (`approvalPathText()`: `of=` / `-Path:`
  prefixes, a stream suffix, Git Bash's `/c/`, `\` → `/`, `.` / `..` folded). (C2) `dev-spec merge-state <base> <ours>
  <theirs>` whose `<ours>` is a `.state.json` / roadmap.json is a guard-down (`source: "cli"`, `command: null`): it writes its
  merge into `<ours>` — git runs the driver inside `git merge` on its own temp files, never through the Bash tool, so the team
  flow never meets this; `merge-state --install` / `--uninstall` / `--check` write no state and stay allowed. git's in-place
  writers naming those files, `.specs/` or a feature folder (`gitWriteTargets()`: `checkout`, `restore` unless `--staged` alone,
  `merge-file` unless `-p`, `rm` unless `--cached`, `mv`; after git's `-C` / `-c` / `--git-dir` …): `git checkout HEAD~1 --
  .specs/roadmap.json` brought back a roadmap.json with the guard off. Read-only git (diff, log, show, add, commit, a branch
  switch) stays allowed. (C6) **`.specs/**/.execution/observed.jsonl`** (`RE_OBSERVED_FILE` — the observe hook's log of the runs
  Claude Code SAW; `.specs/.execution/observed.jsonl` for a project check, `feature: null`): a Write / Edit of it or a shell
  write onto it forged "observed" evidence (a forged line turned a reported run into a verified, observed one) — a guard-down,
  `command: null` (evidence is the harness's to record); a task report beside it (`.execution/task-N-report.md`) and reading the
  log stay allowed.
  **1.25.1 (review 7, findings 3 / 4) — ONE reader of a simple command's file operations** (`shellSegOps()` → `shellOpActions()`
  here, `shellOpPaths()` for the edit guard): ops `write` (content) · `replace` (removed or replaced whole: rm, a move's source, an
  extracted member) · `git` (gitWriteTargets — + `git clean` unless -n, `git stash push -- <paths>`) · `into` (a folder receiving
  files: cp -r / mv / rsync / xcopy / robocopy — their sources' names, or everything for an extractor: tar -x -C, unzip -d, 7z x -o,
  Expand-Archive, wget -P, curl --output-dir) · `link` (the TARGET a link is made to: ln, mklink, New-Item -ItemType
  SymbolicLink / Junction / HardLink with -Target / -Value, subst, junction, fsutil hardlink, mount --bind) · `piped` (targets fed by
  a pipe: `gci .specs -Filter roadmap.json | Remove-Item`, `find … | xargs rm` — the producer's paths with its name filter, directly
  and deeper) · `unknown`. Writers read by their options: tee / truncate / shred / sponge / dos2unix, dd of=, sed / perl / ruby -i,
  awk -i inplace, ed / ex / vi / vim / nvim (their file operands), curl -o / -D / -c, wget -O / -o, patch (its file, -o, -r), sort -o,
  uniq / xxd's output, iconv -o, zip's archive, tar's archive in a writing mode, find -delete / -exec <remover|writer|shell> /
  -fprint; output redirections only (`seg.writes` — `<` reads, `2>&1` duplicates; `<>` writes); PowerShell's file cmdlets by their
  parameters (`psParams` — unique prefixes, `-Name:value`, switches; aliases: in the PowerShell tool `rm` IS Remove-Item), a
  `( … )` value (`-Destination (Join-Path .specs roadmap.json)` — Join-Path read, any other expression unknown) and
  `[IO.File]:: / [IO.Directory]::` methods (their `( … )` arguments). Each path is read (`shellPathReadings()`) with the variables
  the same command assigned put in (`shellTrack()`: `D=.specs; …`, `export`, cmd's `set`, PowerShell's `$d = '…'`), after its `cd`
  (an extra reading — `cd .specs && … > roadmap.json`), each Bash brace expansion (`braceExpand()`), and as a glob
  (`shellGlobRe()`: Bash's leading `*` never matches a dot, PowerShell's / cmd's do; an unknown variable `SHELL_VAR` matches
  anything but never stands for `.specs`; `SHELL_ANY` — find's or a recursive listing's depth — matches dot folders) →
  `shellPathFacts()`. The actions: an exact guarded file → its setting, as before; `.specs/` itself removed / moved → `roadmap`, as
  before; otherwise **`specs`** (`command: null`) — a write whose glob / variable may be roadmap.json, a `.state.json` or an
  observed log under `.specs/` (or a guarded name in a folder an unknown variable names: `$DIR/roadmap.json`); a removal / move /
  extracted member on `.specs/`, a folder or a glob under it (`rm -rf .specs/<feature>`, `rm -rf .specs/*`, PowerShell's `Remove-Item
  * -Recurse`); a recursive copy or an extraction into it; and **`link`** (`command: null`) — a link made to `.specs/` or under it.
  Still allowed: a spec document written, copied in or removed (`rm .specs/alpha/notes.md`), anything inside an `.execution/` folder
  but the observed log, a lock file (`.lock`, `.roadmap.lock`). **Fail closed:** a program the guard doesn't know
  (`shellKnownProgram()`: not a text-only program, a reader — `APPROVAL_READERS`, interpreters included (their inline scripts are a
  known limit), PowerShell's Get- / Select- / ConvertFrom- … — a writer read above, a shell, a launcher or the CLI) run on `.specs/`
  itself, roadmap.json, a `.state.json` or an observed log (or such a glob; a PowerShell `( … )` argument list too) is `unreadable`
  why `specs-arg`: ask (`npx prettier --write .specs/roadmap.json`, `New-Object IO.StreamWriter('.specs/roadmap.json')`).
  `approvalCandidate` (and the hook's `candidate()` — mcp/tests/10-guards-hooks.js reads the hook's constants and checks they agree)
  also lets through a guarded file's name (`find . -name roadmap.json -delete`), a dot-name glob (`.s*/road*.json`) and a glob beside
  a writer's name (`Remove-Item *`). Links, the other way round: a Write / Edit through a folder already linked to `.specs/` reads
  its folder's real path (above). The 33 legitimate commands of the review (cat / jq / grep / git diff / log / add / commit / stash
  / checkout main / the CLI's status, done --run, init raising a guard, --help / cp FROM .specs / rm of an .execution folder / tee
  of a task report / sed -i of tasks.md / python -m json.tool / Get-Content / Select-String / Copy-Item out …) stay allowed —
  mcp/tests/10-guards-review7.js holds them. **MCP file tools (finding 7 — `approvalEditActions()` / `approvalPathArgs()`):** the
  string values of path-named keys (path, file, source, destination, target, from, to, dir, uri… — 3 levels deep, one line each,
  ≤ 32; a `file://` URI read by hook-utils `fileUriToPath`, passed in as `opts.uriPath`) are read as an Edit's path (`source:
  "edit"`); a move / rename / delete tool also on `.specs/` itself, a folder or a glob under it (`specs`). Content keys are never
  read.
  Judged against the project's meta, which the hook passes in (`opts.meta`); no readable meta → fail closed. Raising,
  adding or a no-op stays allowed. A `roadmap.json` that exists but doesn't parse keeps the strictest `"approvalGuard"` its
  raw text names (`approvalGuardLevel` and the hook) — NULs taken out first (1.24 review 6, A4: a BOM-less UTF-16 file read as
  UTF-8); one that is missing while features exist reads as ask (above). **Known limits (1.25.1 — the honest list):** inline scripts
  and script files the agent wrote (`node -e`, `python -c`, `./x.sh` — interpreters are readers here), a shell variable / alias /
  function DEFINED in an earlier tool call (within the same command it is read, as above; a path that starts with an unknown
  variable is not judged), encoded or downloaded text fed to a shell when the command names nothing of dev-spec's (`… | base64 -d |
  bash`), splatting the CLI's own path (`& node @a`), `git -c alias.x='!…'`, a copy of the CLI under another name, git forms whose
  files can't be known from the command (`git apply` / `am`, `git stash pop`, `git reset --hard`, a branch switch), an archive
  extracted into the project root without naming `.specs/` (its members are unknown), `patch` without a file operand, and a link to
  a guarded FILE (not a folder) made by one of those routes and then edited through (only its folder's real path is read). Outside
  Claude Code the MCP server's elicitation path gates spec_approve / spec_feature / spec_init only (not a
  `spec_add_track {remove}` — gates-and-approvals.md → Approvals the user confirmed over MCP).

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
  cut to `$COLUMNS`, `--json`. **Without the engine outside a project (1.25.1, review 7):** Claude Code runs it after every
  message in every folder once it is installed user-wide, and it loaded the whole engine first (136–220 ms a render): the CLI now
  loads the facade on first use (a proxy over `require`), and the render walks the candidates with `statusProbe()` (cli/completion.js
  — statusLineProject's null rule, without the engine: the probe's `nearestDevSpec` at or above each candidate — 1.27: the same rule
  as `isDevSpecDir`, not a copy of it —, ≤ 40 levels, the same skips) before
  it; no project → the empty line at about Node's startup (~65 ms against ~140 ms measured on Windows). A project found → the
  engine decides as before (the worktree mapping only ever starts from a folder the walk finds). cli/tests/11-claude-code.js checks
  the two agree and that no mcp/lib module loads. `--print-config` prints the `statusLine` entry with this clone's absolute path;
  in a plugin's versioned cache folder (1.25.1, review 7 — the plain path broke at the first plugin update) a command that finds the
  newest installed `<version>` holding cli/dev-spec.js at each run (cli/completion.js `statuslineCommand`: the completion scripts'
  rule in a `node -e` one-liner with no shell syntax — no double quote, dollar, backtick, percent, ! or backslash — so cmd.exe, PowerShell, sh and bash pass it alike;
  a path holding one of those keeps the plain command and its re-run note, `cacheNote`; else `cacheFollows`). A plugin cannot ship a status line (plugin `settings` honour only `agent` /
  `subagentStatusLine`), hence the opt-in `/spec-statusline`.
- **User defaults** — the environment variables `DEV_SPEC_DEFAULT_LANG` / `DEV_SPEC_STOP_CHECK` / `DEV_SPEC_GUARD_DEFAULT`
  (`userOptionRaw()` → `userDefaults()`), FALLBACKS only: project meta always wins; empty, invalid or unexpanded (`${X}`)
  changes nothing. `newProjectLang()` only for a brand-new project (no meta.lang, no feature — active or archived), seeded
  by `seedProjectLang()` under the roadmap lock; `spec_init` reports what a variable decided in `userDefaults`, and so do
  spec_create and spec_import (whose own text — warnings, design.md headings — follows `configuredLang()` too);
  `init --stop-check on` writes meta when DEV_SPEC_STOP_CHECK says off. The guard and stop hooks read the same names raw
  (their cheap pre-checks). A roadmap.json that doesn't parse: DEV_SPEC_STOP_CHECK still decides (engine and hook), the
  guard stays off. DEV_SPEC_GUARD_DEFAULT reaches a dev-spec `.specs/` without roadmap.json (`isDevSpecDir` — the probe's rule; the
  hook's `devSpecWithoutRoadmap()` asks the probe too), never a folder without `.specs/` nor another tool's. **Never plugin.json `userConfig`**: it opens a configuration dialog on every install / enable,
  reaches neither the Bash tool (the CLI) nor other MCP clients (Claude Code exports `CLAUDE_PLUGIN_OPTION_*` to hooks
  only), and an older Claude Code validating option fields strictly could refuse the whole plugin. Claude Code's
  settings.json `env` block reaches the hooks, stdio MCP servers and the Bash tool alike (code.claude.com/docs/en/env-vars).
- **MCP** — every tool carries `annotations` from server.js `TOOL_ANNOTATIONS` (`READ_ONLY` for the 14 tools no argument
  makes write; `destructiveHint` on the 11 tools one of whose arguments removes or overwrites a record — 1.25.1 review 7: `spec_feature` remove, `spec_export` adr, `spec_approve` revoke, `spec_complete_task` undo, `spec_impact` reopen, `spec_roadmap_edit {kind: "backlog"}` / `spec_roadmap_edit {kind: "milestone"}` rm, `spec_roadmap_edit {kind: "depend"}` replace / clear, `spec_add_track` remove, `spec_init` (a removed check, cleared roles, an overwritten setting), `spec_tracks` signals set / forget; `idempotentHint` per tool; `openWorldHint: false` everywhere —
  the protocol's defaults are the opposite, so all are explicit); mcp/test.js requires one entry per tool and snapshots
  `.specs/` around every read-only one. `completion/complete` (prompts-resources.js `complete()`): feature slugs for a
  prompt argument that names a feature, the `specs://` template variables `slug` / `artifact` / `file` (≤ 100 values,
  prefix then substring); an unknown prompt / template / argument / ref → -32602; with prompts off `ref/prompt` → -32602.
- **Plan-mode bridge** — `spec_import {tool: plan | execplan, text}` (`TEXT_IMPORT_TOOLS`; server.js `REQUIRED_ONE_OF`:
  `path` or `text` — not for a steering tool, 1.25) = the file import minus the source note (`inline: true`, `source: null`); CLI `import plan -` (stdin)
  or `--text` (a word after the tool that is no track list, given with `--text`, is passed as the path: the engine's "path or
  text, not both"). `hooks/plan-hook.js` (PostToolUse, matcher `ExitPlanMode`): one line of `additionalContext` in a dev-spec
  project (1.27: the first of `probe.sessionProjects` — it looked at the cwd itself only, never walked up), silent and exit 0
  otherwise (the payload is undocumented — `tool_input.plan` and a plan-file path read defensively); a network cwd or anchor is
  left out before any stat (the probe's `isNetwork`).
