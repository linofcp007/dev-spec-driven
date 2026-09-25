# CLAUDE.md — maintainer notes for dev-spec-driven

Context for anyone (human or Claude) working on this plugin. Read this before changing the engine.

## What this is
A Claude Code **plugin** that unifies four spec-driven skills into one **track-based** skill, plus
a bundled **local, zero-dependency MCP server**. Hard constraints set by the owner:
- **No GitHub Actions / no paid CI / no pull requests.** All automation is local (hooks + the MCP
  server). Never add a `.github/workflows/` for this project, never open PRs — merge locally and push.
  No user-facing text may steer users toward PRs or CI (a test scans the prose; CHANGELOG is exempt).
- **Zero runtime dependencies.** The MCP server and all scripts use only Node core (`fs`, `path`,
  `readline`, `child_process`, `crypto`, built-in `fetch`). No `npm install` required. Keep it that way.
- Specs always live in `.specs/` (no alternate directory detection).

## Layout
```
.claude-plugin/plugin.json     manifest (skills, commands, mcpServers point here; NO hooks key — see gotcha)
.claude-plugin/marketplace.json local marketplace for install
mcp/servers.json               registers the `spec-driven` stdio server (plugin.json → mcpServers; deliberately NOT a root .mcp.json — see Config paths)
skills/dev-spec-driven/SKILL.md the workflow (track routing engine, prose)
skills/.../references/          deep library, read on demand
commands/*.md                  42 slash commands (thin wrappers that invoke the skill/MCP)
agents/*.md                    plugin subagents, auto-discovered and dispatched as `dev-spec-driven:spec-implementer` /
                               `dev-spec-driven:spec-reviewer` (subagent execution) / `dev-spec-driven:spec-critic` (--deep)
evals/                         plugin evals for `claude plugin eval` (triggering EN/PT/ES) — maintainer-side, results ignored
mcp/server.js                  MCP stdio protocol (JSON-RPC 2.0, newline-delimited) + argument validation against each inputSchema
mcp/lib/spec.js                ALL domain logic (classify, scaffold, lint, trace, doctor, gates, state, impact, catalog, drift, import, scan)
mcp/lib/i18n.js                ALL localized content EN/PT/ES (artifact + steering builders, tool/CLI/hook messages)
mcp/evals/run-evals.js         local eval harness (uses ANTHROPIC_API_KEY; --dry-run offline)
mcp/test.js                    smoke test — `node mcp/test.js`
cli/dev-spec.js                universal CLI over mcp/lib/spec.js (cross-tool; also prints MCP configs and rule files)
cli/test-cli.js                smoke test for the CLI — `node cli/test-cli.js` (never a top-level bin/, see below)
hooks/hooks.json               PreToolUse → guard-hook.js · PostToolUse + SessionStart → spec-hook.js
hooks/guard-hook.js            opt-in guard mode (asks before code edits while no feature has approved tasks)
hooks/spec-hook.js             save checks (requirements/tasks/design.md) + SessionStart status and drift line
hooks/precommit-check.js       optional git pre-commit validator
AGENTS.md                      portable workflow for non-Claude agent tools
.cursor/ .windsurf/ .github/copilot-instructions.md GEMINI.md  per-tool rule files (point to AGENTS.md)
INTEGRATIONS.md                per-tool setup + MCP config snippets
```

## Never ship a top-level `bin/`
Claude Desktop / claude.ai does not clone the repo: it validates it on a remote Anthropic service
that **rejects** any plugin shipping a top-level `bin/` (those files land on PATH in the CLI but are
invisible on the admin approval surface). The sync fails with `status=failed_content` and the UI
shows only "Marketplace sync failed. Check the repository URL" — which points nowhere near the cause.
The local CLI (`/plugin marketplace add`) uses `git clone` and does **not** apply this rule, so it
passes even when Desktop refuses; it is not a valid pre-check. Executable entry points go in `cli/`,
`hooks/`, `commands/` or `mcpServers`.

## Three surfaces over ONE engine
`mcp/lib/spec.js` is the single source of truth. It is exposed three ways: (1) the MCP server for
MCP clients, (2) the `dev-spec` CLI for any tool/terminal, (3) Claude Code skill+commands+hooks.
When you add an operation, add it to `spec.js` first, then wire it into server.js (tool) AND
cli/dev-spec.js (subcommand) AND mcp/test.js (assertion). Keep the CLI and MCP behavior identical —
both call the same engine function with the same defaults (e.g. `roadmapReport()` backs `spec_roadmap`
and `dev-spec roadmap`; `approvePhase()` has one default approver, `$USER`/`$USERNAME`/`user`).
Any user-facing string the operation GENERATES or RETURNS goes through `mcp/lib/i18n.js` (EN/PT/ES),
never hardcoded in spec.js — see the Trilingual section. The CLI's human output is localized too
(`cliText(lang)` over `i18n.msg(lang).cliOutput`: the feature's language for feature commands, the
project's otherwise). `--json` prints the same structured result the MCP tool returns: keys and stable
codes (`step`, `code`, `unverifiedReason`, check ids) never change, while message fields (`recommendation`,
`note`, `error`, doctor `detail`, finish `blockers`/`warnings`…) are in the feature's language, as on MCP.
`cliText` only localizes the human-readable CLI output.

## The track model
`core` is always on. `+tdd`, `+saas`, `+ai` are independent and composable, chosen in Phase 0 by
`spec_classify` (keyword heuristic with negation + confidence) and confirmed by the human. The
track set drives which artifacts/sections/loops apply. See `references/classification-matrix.md`.
- **Tracks are persisted in `.state.json` `tracks`** (create / add_track / add_track --remove write them)
  and `detectTracks()` reads them first. Only features without a saved list (pre-1.13) fall back to
  their files, and there a `[SaaS]`/`[AI]` marker counts only on a real markdown heading (a Mermaid node
  `X[AI]` or prose used to switch +ai on).
- **Track input goes through `parseTracks()`**: arrays or strings split on space/comma/`+`
  (`'tdd,saas'`, `'+saas +ai'`), case-insensitive; an unknown token is a localized error with a
  did-you-mean. That is why the MCP `tracks` schemas carry **no enum on purpose** — an enum would refuse
  `'tdd,saas'` before the engine could split it or suggest a fix.
- **Removal is non-destructive** (`spec_add_track {remove:true}` / `add-track --remove`): files stay, the
  result lists them as inactive, and doctor/status/next_action/roadmap stop requiring them (`activeTasks()`
  drops a removed track's task section). `core` can't be removed; a bugfix keeps +tdd.

## Trilingual (EN / PT / ES) — the system both READS and WRITES three languages
**All localized content lives in `mcp/lib/i18n.js`** (artifact builders, steering stubs, tool
messages, CLI and hook output — one set per language). `spec.js` keeps the logic and delegates: each
template function is a one-line call into `i18n.<builder>(args, lang)`. EN is the canonical reference;
PT and ES mirror its structure (same sections, IDs, markers and slots). The EN templates are **not** frozen: 1.13 changed them on
purpose (every template AC planned + tasked, track ACs under `[SaaS]`/`[AI]` headings, the test plan's
Kind column…). When you change a template, change all three languages together and keep the tests that
round-trip a PT and an ES scaffold through doctor green.
- **Language resolution (single source of truth + per-feature override).** The PROJECT language lives
  in `.specs/roadmap.json` `meta.lang`, seeded by `spec_init {lang}` (read via `projectLang()`). Each
  FEATURE may override it; the resolved feature language is persisted in `.specs/<feature>/.state.json`
  `lang` (read via `featureLang()`). `spec_create {lang}` resolves `explicit > project default > en`,
  writes the state file, and generates every artifact in that language; every feature operation, the
  CLI and the hooks read `featureLang()` so messages match the spec.
- **English-STABLE tokens (the tooling matches them literally — never translate, in any language):**
  AC/SC/test IDs (`US-1.AC-1`, `SC-001`, `T-01`, `EC-1`, `NFR-1`), section markers `[SaaS]`/`[AI]`,
  story/parallel tags `[US1]`/`[US2]`/`[shared]`/`[P]`, the unfilled sentinel `> **TODO**`,
  `[NEEDS CLARIFICATION]`, annotation tags `_Requirements:_`/`_Makes green:_`/`_Affects evals:_`/
  `_Emits metrics:_`/`_Implements:_`/`_Verify:_`/`_Supersedes:_`, `**Checkpoint:**`, the test plan's Kind
  values `example`/`property`, the steering front-matter keys and values (`inclusion: always|fileMatch|manual`,
  `fileMatchPattern`), evidence reason codes, the ` ```mermaid `/` ```typescript ` fences, and the
  eval-harness headings `## System` / `## User Template`.
- **TRANSLATED, but matched by synonyms** so generated PT/ES specs still pass `doctor`/`clarify`: EARS
  keywords (QUANDO/CUANDO, O SISTEMA DEVE/EL SISTEMA DEBE, SE…ENTÃO/SI…ENTONCES — recognized by
  `earsValidate`), and section headings (matched by `SAAS_SECTIONS`/`AI_SECTIONS` synonym tables, the
  `RE_*` matchers, and `RE_TESTABILITY` for the +tdd block). The Kind column header (Kind/Tipo) and the
  converge heading (`Phase: Convergence` / `Fase: Convergência` / `Fase: Convergencia`) are localized too.
  **When you add/rename a translated heading, add the matching synonym** or `doctor` will think the
  section is missing.
- **Terminology** mirrors the existing `ROADMAP_I18N` per language (PT keeps the "Feature/Tasks/Tracks"
  anglicisms; ES translates to Función/Tareas). Eval sample JSON (`golden.json`/`adversarial.json`) is
  data and stays as-is; its surrounding prose (README, prompt stub) is localized.
- **Adding a 4th language:** add a block to `BUILD`/`STEERING`/`MSG`/`EVALS_README` in `i18n.js`, add
  it to `LANGS`, extend the classifier `SIGNALS`, `ROADMAP_I18N`, the `SAAS_SECTIONS`/`AI_SECTIONS`
  synonyms and the `RE_*` matchers, then add a test asserting a localized scaffold round-trips.

## MCP tools (in `mcp/lib/spec.js`, dispatched by `mcp/server.js`)
`spec_init` · `spec_classify` · `spec_create` · `spec_list` · `spec_status` · `spec_next_task` ·
`spec_complete_task` · `ears_validate` · `trace_check` · `spec_doctor` · `spec_approve` ·
`steering_scaffold` · `spec_roadmap` · `spec_backlog` · `spec_depend` · `spec_scan` ·
`spec_coverage` · `spec_clarify` · `spec_next_action` · `spec_add_track` · `spec_feature` ·
`spec_task_brief` · `spec_finish` · `spec_import` · `spec_append_tasks` · `spec_impact` ·
`spec_metrics` · `spec_catalog` · `spec_drift` (**29 total**; `mcp/test.js` asserts the exact count —
verify with an `initialize` + `tools/list` handshake against `mcp/server.js`). The server is
**tools-only** — it advertises `capabilities: { tools: { listChanged: false } }` and exposes no
`resources`/`prompts`. All tools are pure-local file ops on `.specs/` (or a read-only codebase scan for
brownfield / `trace --code` / import); none hit the network. Scaffolders never overwrite an existing file;
mutators edit only what they own (checkboxes, appended tasks and track sections, `.state.json` /
`roadmap.json`, generated `ROADMAP.*` / `SPECS.md`) and never rewrite spec prose. Roadmap/deps persist in
`.specs/roadmap.json`; cross-feature deps are cycle-checked and must name existing features.

**Argument validation (server.js).** Before dispatch, `tools/call` arguments are checked against the
tool's advertised `inputSchema`: required keys (`missingArgs`), then types (`invalidArgs` — `integer` means
a *safe* integer, so `1.9` / `1e21` never become task 1), `enum`, `minimum`, array `items` and nested
object properties. It iterates the SCHEMA's keys, never the caller's (`__proto__` arguments are ignored);
an absent or `null` value means "not given". `arguments` that isn't an object, a relative `..` in
`projectDir`, or a network `projectDir` (`isNetworkPath`: UNC `\\host\share`, `//host/share`, `\\?\UNC\…`,
`\\.\UNC\…` and other device paths — refused before ANY fs call, argument errors included, so a tool call can't make
the server open an SMB connection to a host it names or hang on an unreachable one; `\\?\C:\…` and WSL's `\\wsl$` /
`\\wsl.localhost` are local) is refused. The default projectDir (cwd / env) and the CLI are not restricted.
Messages are localized in the project language (`msg(lang).args`). The engine
still validates what schemas can't express (track names, AC IDs, paths). String enums the engine case-folds
(`phase`, `lang`, `kind`, `action`) are trimmed + lowercased first (`foldEnumArgs`) — the CLI passes `Design` / `PT`
straight to the engine and the 1.12 MCP accepted them; `spec_import`'s `tool` stays exact on both surfaces
(`EXACT_ENUMS`). The engine and the CLI fold `backlog`'s action too (`ADD` adds on every surface).

## Config paths: committable (relative) vs. host-installed (absolute)
Two distinct distribution targets, deliberately kept separate — never conflate them:

- **In-repo dotfiles are committable and portable.** They use relative / workspace-relative
  references, never a machine path, so `git clone`/download Just Works:
  - `mcp/servers.json` (referenced by `plugin.json` → `mcpServers`) → `${CLAUDE_PLUGIN_ROOT}/mcp/server.js`.
    It is deliberately NOT a root `.mcp.json`: when this repo is opened as a normal project, Claude Code
    reads a root `.mcp.json` as a *project* server where `${CLAUDE_PLUGIN_ROOT}` is undefined, so it
    failed with CONNECTION_CLOSED in every maintainer session (v1.11 moved it).
  - `.vscode/mcp.json` → `${workspaceFolder}/mcp/server.js`
  - `.cursor/mcp.json`, `.gemini/settings.json` → `mcp/server.js` (cwd-relative)

  `.vscode/mcp.json` is the **one** tracked file under `.vscode/`; everything else there is gitignored
  via a surgical exception (`.vscode/*` then `!.vscode/mcp.json` — must ignore by contents, not the
  dir, or git can't re-include the file). Never commit an absolute path into these.

- **Installing into a USER's own project needs absolute paths.** Outside Claude Code there is no
  `${CLAUDE_PLUGIN_ROOT}`, so the user's editor must point at *this clone's* absolute `mcp/server.js`.
  That host-specific config is **generated on demand, never committed**: `node cli/dev-spec.js
  mcp-config <client>` (`claude-desktop|claude-code|cursor|windsurf|vscode|gemini|codex|generic|all`) prints a ready
  config with the absolute path resolved from `__dirname` (`mcpConfig()` in `cli/dev-spec.js`). The
  `integrations/*` templates carry the literal `/ABSOLUTE/PATH/TO/dev-spec-driven/…` placeholder as a
  copy-paste fallback. (There is **no** `install_host_context` symbol — the mechanism is `mcp-config`.)
- **Rule files the same way:** `node cli/dev-spec.js rules <cursor|windsurf|copilot|gemini|agents>` prints
  that tool's rule file (`AGENTS.md`, `GEMINI.md`, …) with its bare `cli/dev-spec.js`, `mcp/server.js`,
  `AGENTS.md`, `skills/dev-spec-driven/…` and `references/…` paths made absolute (own-key lookup of the
  tool name). So the committed rule files must keep those paths BARE (no `<clone>/` prefix), keep the
  "Paths in this file point into the dev-spec-driven clone" note true in the copy, and never talk about
  "the repo" — a test asserts all three.

## Subagent-driven execution (Phase 6, opt-in — v1.11)
`spec_task_brief` (engine) builds a self-contained brief per task: task block (via `taskBlocks()`, which
keeps sub-lines, phase heading and closing `**Checkpoint:**`), AC IDs resolved to their full EARS text
(`acIndex()` over `criterionBlocks()`, exact-ID keys so AC-1 never hits AC-10), T-IDs resolved to their
test-plan row (keyed by the FIRST table cell), design sections that mention the task (bounded by
`BRIEF_DESIGN_BUDGET`), the task's `_Verify:_`, Global Constraints, the steering it needs (see Scoped
steering), for a bugfix bug.md's Reproduction + Root Cause (and `gated`/`gateError` when the bugfix gate
would refuse the task), and the loop's definition of done. Labels/rules live in `i18n.js` `BRIEF` +
`renderBrief()`. `write:true` writes `.specs/<f>/.execution/` — a self-ignoring folder (`.gitignore` = `*`),
the brief is regenerated, `ledger.md` is created once and only ever appended by the controller; its result
keeps paths + identifiers (`refs`, `loop`, `inlineOnly`, `verify`, gate) and drops the spec text the brief
quotes unless `includeBrief`. The PostToolUse hook exits early for `/.execution/` paths. The protocol is prose in
`references/subagent-execution.md` + `agents/spec-implementer.md` / `agents/spec-reviewer.md`; the engine
never dispatches anything (keeps it cross-tool). Adapted from obra/superpowers (MIT).

## Gates (1.13) — an approval is a gate, not a stamp
- **Placeholders.** `placeholderReport()` finds what a scaffold still waits for (bracketed prose
  `[trigger]`, empty `[]` slots, the templates' own code-span slots `` `[path]` ``, the `> **TODO**`
  sentinel) and deliberately ignores links, checkboxes, stable tags/IDs, `[NEEDS CLARIFICATION]`, number
  intervals, written-out enumerations (`isEnumeration()`: 2+ one-token or quoted items split by `, ; |` —
  `[owner, admin]`; the templates' own enumerations, `templateEnumerationSet()` built from every i18n
  builder, stay placeholders), other code spans, comments and fences. `artifactState()` = missing /
  placeholder / filled. **bug.md is evidence** (`bugPlaceholders()`, used by `artifactReport` and
  `bugSectionFilled()`): its Reproduction / Root Cause quote `[object Object]`, `[WARN]`, `[A-Z]`, `[Error: …]` — a
  bracket there is a slot only when it IS one of the bug report's own slots (`bugTemplateSlots()`, every language) or
  its section holds nothing but brackets; the generic rule refused a written root cause as "not filled". Every regex here must stay linear: `RE_STABLE_BRACKET`'s list separator is
  `\s*(?:[,;/]\s*)?` — the old `\s*[,;/]?\s*` backtracked 2^k on a failing ID list.
  `detectPhase()`: `complete` / `executing` once tasks are ticked, `tasks-ready` once a real (non-placeholder)
  task exists; otherwise the earliest still-template chain artifact — so a fresh scaffold is phase `requirements`.
  Doctor's `placeholders` check fails for the current and earlier phases, warns for later ones;
  `ears_validate` reports code `placeholder`; the requirements.md hook never says "all clean" while any remain.
  Doctor's `traceability` follows the same split: the gap kinds that read a LATER phase's still-template
  tasks.md / test-plan.md (`TRACE_TASK_KINDS` / `TRACE_PLAN_KINDS`) are deferred — a warn, "not traced yet" — so the
  template's `_Requirements: US-1.AC-3…_` rows are no "typos?" at the requirements / design gate. Only
  `TRACE_VERDICT_KINDS` fail (testsNotMappedToTasks is listed, never failing — trace_check's verdict rule).
- **Approve gate.** `approvePhase()` runs `approvalChecks()` for that phase and refuses (`refused`, `failing`,
  `checks`) while any fails. `force:true` (CLI `--force`) records it anyway with `forced: true` + the failing
  ids — doctor's `approval-gates` and the roadmap keep flagging it; a clean re-approval replaces it. A phase
  with no artifact (eval-plan without +ai, test-plan without +tdd, `tests` on a core-only feature, a missing file) is an
  error even with force. `tests` and `execution` have checks too (see Pending gates below).
- **next_action step order:** `fill` (first chain artifact missing / template; `file`) → `re-review` (an
  artifact changed since ITS approval; `impact` when a snapshot exists) → `fix` (failing checks of the
  current or an earlier phase, via `CHECK_PHASE`; or the approve gate's refusal of the next pending phase —
  `refusedGate` — so it never recommends an approval that would be refused) → `approve` → `implement` →
  `finish` (or `tasks` when there are none). Doctor surfaces the same gate as `nextGate`. Once `state.finished`
  exists (finish `{write}` recorded it), `finish` becomes `finished` (asks for the `execution` sign-off while it is
  missing) or `drift` (`baselineDrift()` of the recorded files; `drift` {finishedAt, files, changed, missing,
  nowPresent, drifted}) — it looped on "close the feature with /spec-finish" and a re-finish replaced a drifted
  baseline silently; `recordFinishBaseline()` now returns `replaced` for the drift it accepts. A baseline is STALE
  (`staleFinish()`) once a change request or a re-approval of another phase is newer than `finished.at`, or an active
  task's `_Implements:_` file isn't in it: then the step stays `finish` (re-run spec_finish `{write}`) with
  `staleBaseline` {finishedAt, since, newFiles} — it said "finished — nothing left to do" on the old baseline — and an
  execution sign-off older than such a change is asked for again (`executionSignOffStale()`).
- **finish blockers:** doctor fails, changed since approval (shared `changedSinceApproval()`), placeholders
  anywhere in the chain, bugfix Root Cause, no tasks, open tasks, unverified tasks, pending gates.
  `warnings` (EC/NFR/SC, planned-not-in-code) never block.
- **Bugfix execution gate (`bugfixGate()`):** while bug.md → Root Cause is unfilled, no task after the one
  that writes it (names bug.md + a Root Cause synonym, carries no `_Makes green:_`/`_Verify:_`) can be ticked
  or given evidence; `done --run` refuses before running anything. The root-cause task itself can be ticked
  (`rootCauseTaskIndex()`), but then returns `rootCausePending: true` + a note; once it is ticked the refusal of a
  later task is `bugGateTicked` ("the section is still empty"), never "do task N first".

## Evidence (v1.12, gate tightened in 1.13)
- **`_Verify: <command>_`** is an English-stable task marker; `taskMarkers()` keeps its value whole (commas
  belong to the command), drops wrapping backticks and ignores a `[placeholder]`. The MCP server never
  executes commands — the agent runs them and reports; only the CLI's explicit `done --run` executes a task's
  `_Verify:_` (the user's own tasks.md; `--shell bash|<path>` or `DEV_SPEC_SHELL`). On Windows with the default
  shell (cmd.exe) a command in POSIX syntax (`posixShellSyntax()`: a single-quoted string outside double quotes, `$VAR` /
  `${…}` / `$(…)`) is refused before anything runs — cmd.exe has no single quotes, so `node -e 'process.exit(1)'` exits 0
  and was recorded as a passing run. `--shell bash` runs it; `--shell cmd` runs it under cmd.exe anyway.
- **The gate (`evidenceIssue()`):** a task whose `_Verify:_` is runnable is verified ONLY by
  `{command, exitCode: 0}`; a note ticks it but leaves it unverified. `{exitCode}` alone and a command
  without its exit code are rejected; "exit 0" without a command is kept as a note. A non-zero run refuses
  the tick and is recorded — a failed re-check of a ticked task makes it unverified until a later pass.
- **Reason codes** (stable): `no-evidence` · `failed-run` · `manual-note-on-runnable-verify` ·
  `duplicate-number` · `stale-evidence`. They are RETURNED in `spec_complete_task`'s `unverifiedReason` (set
  exactly when `verified` is false) and in `spec_impact`'s per-task `evidence` (`impacted[].tasks[]`,
  `affectedTasks[]`: a code, or `verified`) — both public surfaces; callers branch on these, never on the
  localized note. Internally `verificationStatus().unverifiedDetail` holds them; doctor and `spec_finish` render
  it through `unverifiedLabel()` (localized labels, none for `no-evidence`), and so does the ROADMAP.md/.html
  "needs attention" line (`roadmapData()` keeps each row's `unverifiedDetail`; the labels follow the roadmap
  chrome language): `2 task(s) ticked without verification evidence: #1 (latest run failed), #3`.
- **One verdict: `taskVerification()`** → `{reason, nothingToVerify}` is the ONLY rule behind every `verified`
  (`spec_complete_task`, `spec_status` tasks, `spec_impact` tasks) and every unverified list (doctor, finish,
  ROADMAP.md). A task with no runnable `_Verify:_` and nothing recorded for it (or a record that proves nothing) is
  verified, with `nothingToVerify: true` so no surface calls it a check (`done` prints no "(verified)", impact says
  "nothing to verify"); `no-evidence` is only ever a runnable `_Verify:_` without a run. Never compute a second
  opinion from `taskEvidenceIssue()` directly — `spec_complete_task` used to answer `verified: false` with no reason
  for such a task while doctor, finish and the roadmap passed it.
- **Record shape** (`.state.json → evidence[<n>]`): the latest run `{command, exitCode, summary, at}` plus
  `history` (last `EVIDENCE_HISTORY` = 5 runs, for pass-rate metrics), stamps `task` (text) and `verify`
  (the command) — an edited `_Verify:_` makes the old run `stale-evidence`; a record made while the number
  was duplicated carries `shared` and only counts for its own task; other tasks' records under that number
  are kept in `others`. A note after a run is attached as `note`, never overwrites it (a v1.12 bare
  `{exitCode: 0}` is a claim, not a run: a note replaces it as the summary). `stale: true` is set by
  `spec_impact --reopen`; only a new run (or, without a runnable `_Verify:_`, a new note) clears it.
- **Without a runnable `_Verify:_`** a task is outside the run gate: no record passes, a bare legacy
  `{exitCode: 0}` or a summary verifies, and `verificationStatus()` skips a `no-evidence` record there —
  only `failed-run` / `stale-evidence` / `duplicate-number` count against it.
- **Fenced code under a task is the brief's, never the task's.** `scanTaskBlocks()` keeps fenced lines in
  `body` (the brief shows them) and flags their indices in `bodyCode`; `taskProse()` (text + non-code body)
  is what `taskMarkers()`, the bugfix gate and the secondary trace read, and `tasksProseText()` (the
  scanner's comment/fence-free view) is what `trace_check` and `implementsRefs()` read — so a fenced
  `_Verify:_` example is never run by `done --run`. `spec_task_brief` reads its AC / T-IDs (loop, stories, design
  needles) from `taskProse()` too; only the rendered task block shows the whole body.
- `verificationStatus()` feeds doctor (`verification`), `ROADMAP.md` attention and `spec_finish` blockers.

## Change history (1.13)
- **Approval history.** `approvals[phase]` stays the latest approval (with its content `fingerprint`);
  every approval is ALSO appended to `.state.json → approvalHistory` `{phase, at, by, fingerprint, forced?,
  failing?, snapshot, file?, designSnapshot?}` and the approved artifact is saved to
  `.specs/<f>/.history/<phase>@<n>.md` (tasks with checkboxes normalized; never overwrites an existing
  snapshot). `.history/` is **not** self-ignored — it is meant to be committed with the spec. Approvals made
  before the history are seeded as `legacy` records on the next approval.
- A bugfix's design approval signs off **bug.md** (`phaseFile()`, recorded as `file`), plus a
  `designFingerprint` and a `<phase>@<n>.design.md` snapshot when a design.md exists (it holds the
  bugfix's track sections); `spec_impact --phase design` diffs both files.
- **`spec_impact`** diffs the current artifact with the latest snapshot (requirements: by stable ID, incl.
  SC/EC/NFR; design: by `##` section; tasks: by number). `reopen` unticks the affected DONE tasks, marks their
  evidence `stale`, and appends the change request to `.state.json → changes` (idempotent per snapshot via
  digests). It never edits requirements.md or design.md. An approval without a snapshot → `fingerprint-only`; one
  without even a fingerprint (≤1.10, or a 1.12 bugfix design approval) → `none`, `changed: null` (unknown).
  A REMOVED requirement is never redone: reopen skips the tasks only it reaches (and a design section's IDs that
  requirements.md no longer defines); requirements' `retire` `[{id, tasks, tests}]` lists what still cites it.
  `trace_check`'s informational `removedAcs` `[{id, changeRequest}]` (from `changes[].removed`) makes
  `traceGapLines()` name the change request instead of "(typos?)" — the phantom stays a gap.
- **Test-plan scaffold:** `scaffoldTestPlan()` writes the template rows only while requirements.md holds exactly the
  template's AC IDs (`i18n.templateAcIds()`); on written requirements (add_track tdd, create +tdd on an existing
  feature) one generic row per real AC — a template row would plan a test for a criterion the feature lacks.
  `spec_import` re-plans after writing the imported requirements (createFeature scaffolded from the template ones) and
  fits a kept scaffold tasks.md with `fitTemplateTasks()` (known ACs only, `_Makes green:_` = the tests covering them).
- **A file date is never a finish blocker** (`changedSinceApproval(…, {detail: true})` → `{changed, byDate,
  untracked}`): a clone, checkout, copy or unzip resets every mtime. A pre-1.11 approval (no fingerprint) still shows a
  newer phase file in next_action / doctor / roadmap (1.12 parity), but spec_finish only warns about it. A 1.12 bugfix
  design approval (no fingerprint, no `file`) never tracked bug.md: `untracked` — no change anywhere, a finish warning
  to re-approve; a design.md that exists now was created after it (1.12 fingerprinted an existing design.md) — a change.
- `readState()` refuses a non-list `approvalHistory` / `changes` (they are appended to).
- **`spec_metrics`** derives everything from `.state.json`, `.history/` and the artifacts (`createdAt` is
  stored by createFeature; older features get an approximate one). `write` creates `retro.md` (writeIfAbsent).
- **`spec_append_tasks`** (converge) appends only: numbers after every number in use (tasks.md + leftover
  evidence), all-or-nothing validation (phantom AC IDs, non-relative paths, bad story, multi-line markers,
  inactive-track / Global Constraints headings), a read-back check that existing tasks didn't change, and
  CRLF / BOM / missing final newline preserved. An approved task list → `needsReapproval`.

## Catalog, drift, restore, guard, steering (1.13)
- **`SPECS.md` is AUTO-GENERATED** like the roadmap: `spec_catalog {write}` and `maybeRefreshCatalog()` use
  the same `RE_AUTOGEN` / `isGeneratedOrAbsent()` guard, so a hand-written `.specs/SPECS.md` is never
  overwritten; once it exists, every roadmap refresh refreshes it too.
- **`_Supersedes: <feature>/US-n.AC-m[, …]_`** on a criterion (same line, a sub-line or its table row) marks
  the older AC as replaced. `stripSupersedes()` runs before own-AC extraction (trace, acIndex), so the foreign
  ID is never one of this feature's ACs; unresolvable references are `phantomSupersedes` (never a gap).
- **Drift baseline:** `spec_finish {write}` on a READY feature records `.state.json → finished`
  `{at, files: {rel: sha1|null}}` (CRLF-normalized, `_Implements:_` files, folders expanded, inside the project
  only). `spec_drift` hashes only those files (never walks the tree); a baselined feature with open tasks is
  `reopened`, one changed since its finish (`staleFinish()`) is `stale` (not hashed, verdict `stale`, CLI exit 1 —
  finish it again; the catalog calls it `complete`), an unreadable state is verdict `error` — never "clean".
  SessionStart adds one line per drifted ACTIVE feature, bounded by `DRIFT_MAX_FILES`.
- **Archive → restore:** archive records `archived: {at, entry, dependents}` in the archived `.state.json`
  BEFORE pruning roadmap.json; restore moves the folder back, re-adds the entry and the dependents' `dependsOn`
  in their old position (only for features that still exist; a now-circular edge is skipped and reported). The
  archive result names what the prune did — `dependentsPruned` (always), plus `incompleteDependency: true` and a
  warning `note` when the archived feature wasn't complete (its dependents now read as unblocked; the roadmap
  meets a dep at 100%). `rename` rewrites archived records too (`renamePlan()`), so restore finds the new slug.
- **Guard mode:** `roadmap.json → meta.guard` (`spec_init {guard}` / `init --guard on|off`, with or without
  tracks). `hooks/guard-hook.js` (PreToolUse, `Write|Edit|MultiEdit|NotebookEdit`) is **silent unless the
  guard is on** — guard off costs one small raw JSON read, the engine is loaded only for guarded projects —
  and `guardCheck()` reads roadmap.json + each feature's `.state.json` / tasks.md, never a repo walk. "Code" is
  `GUARD_CODE_EXT` — the scanner's `CODE_EXT` + `TEST_EXTRA_EXT` + `.ipynb` + the source languages the scanner
  doesn't inventory (`.mts`/`.cts`, `.cc`/`.hpp`, `.sh`/`.ps1`, `.sql`…); never reuse `CODE_EXT` alone there (it
  waved those through as "not-code"). Docs, config, markup and styles stay silent. A code
  edit outside `.specs/` with no non-archived feature holding approved, unfinished tasks gets
  `permissionDecision: "ask"` with a localized reason (a forced tasks approval still counts, with a note). A
  tasks approval whose `fingerprint` no longer matches tasks.md (tasks appended/edited after it; ticks are
  normalized) is `stale` — it covers nothing and the reason names it; an approval without a fingerprint counts.
  **It never blocks on its own errors:** a malformed payload, a broken roadmap.json or any exception exits 0.
- **Scoped steering:** `steeringFrontMatter()` reads Kiro-compatible front matter — `inclusion: always |
  fileMatch | manual` + `fileMatchPattern` (string or list). No front matter → the brief's default files
  (constitution/tech/structure + the active tracks' files) count as `always`, others stay out; front matter
  without `inclusion` → `always`; an unknown mode (Kiro `auto`) → `manual`. `briefSteering()` quotes a
  matching `fileMatch` file's body (front matter and guidance comments stripped, `BRIEF_STEERING_BUDGET`) and
  lists `manual` ones. `steeringGlobMatch()` is a linear matcher with capped brace expansion — never a
  backtracking regex. Custom names (`steering_scaffold`) must match `^[a-z0-9][a-z0-9-]{0,62}\.md$` and not be
  a Windows device name or a prototype key. Doctor's `steering` check warns about files still templates.

## Conventions & gotchas
- **Every name-taking op resolves its folder through `resolveFeature()` / `existingFeature()`** —
  never `path.join(specsRoot, slugify(name))`. An empty slug (non-Latin names, `...`, `undefined`)
  used to resolve to `.specs/` itself, so `spec_feature remove` deleted every spec (the v1.11
  Critical). The resolver also rejects `steering` and Windows device names (`nul`, `con`, `com1`…),
  transliterates accents (`Autenticação` → `autenticacao`) and falls back to the pre-1.11 slug
  (`autentica-o`) so old folders are still found. `slugify(undefined)` is `""`, never `"undefined"`.
  `listFeatures` skips dot-folders and non-slug folders (reported as `ignored`).
- **`spec_feature remove` needs `confirm: true`** (CLI `--yes`). Without it nothing is deleted and the
  result (an error with `needsConfirm`) lists what would be — `removePreview()` checks roadmap.json first
  and uses `lstat` (a symlink/junction is one entry, never followed). Prefer archive (reversible).
- **JSON state is read with `readJson()` and written atomically (`writeFileAtomic`)**. A
  `roadmap.json` / `.state.json` that exists but doesn't parse is an ERROR every mutator returns
  (`roadmapError()`, `state.invalid`) — never "repaired" into `{}` (that erased deps, backlog,
  approvals and `meta.lang`). **Valid JSON of the wrong shape is refused the same way:** `readState()` checks
  the top level, `approvals`/`evidence` (objects), `tracks`/`approvalHistory`/`changes` (lists);
  `loadRoadmap()` checks `features` and each entry, `dependsOn` (string lists), `meta`, `backlog`. Readers get
  a sanitized copy; every mutator refuses BEFORE its destructive step. A leading BOM is tolerated.
  `writeIfAbsent` uses `flag:"wx"`. `writeFileAtomic`'s temp file never outlives the call: when the rename and the
  plain-write fallback both fail (read-only / locked target on Windows, a folder at that path) it is removed before
  the error is thrown — the best-effort refreshes swallow that error, and used to leave a `<file>.<pid>.<ts>.tmp`
  in `.specs/` per call. On Windows an EPERM/EACCES/EBUSY rename is retried briefly (a scanner's lock). tasks.md
  ticks go through it too (a reader never sees a truncated tasks.md).
- **Feature mutators hold a cross-process lock** (`withFeatureLock` / `featureLocked` in the exports):
  `completeTask`, `approvePhase`, `appendTasks`, `addTrack` / `removeTrack`, `impactReport` with `reopen`,
  `finishFeature` with `write`, and `createFeature` re-run on an EXISTING feature (it adds tracks through
  `applyTracks`, spec_add_track's path — a NEW feature has no folder to lock). Two MCP servers (or MCP + `dev-spec done`)
  on one feature each read tasks.md + `.state.json`, wrote the whole file back and the last writer won — ticks and
  evidence were lost while both answered ok. The lock is `.specs/<feature>/.lock` (O_EXCL, holds `{pid, host, at}`),
  re-entrant in one process; waiters retry for `DEV_SPEC_LOCK_WAIT_MS` (default 10 s), then get
  `{ok:false, busy:true, error}` (`err.featureBusy`, localized) with nothing changed. A dead holder's lock (same host)
  is reclaimed at once, any other after 2 min (10 min while its pid still runs). Where no lock file can be created
  (read-only folder) the op runs unlocked. **Folder moves** — `manageFeature` rename / archive / remove, and restore
  (on `.specs/_archive/<slug>/.lock`) — run under `withMoveLock`: never while another process holds the lock (it moved
  the folder away mid-write: the writer's next `writeFileAtomic` recreated a zombie `.specs/<old>/`, and ticks landed
  in one folder, the spec in the other); the lock file travels with the folder and is released at the NEW place
  (`releaseMovedLock` — left there it kept the renamed feature "busy" while its holder lived). Folders move through
  `renameDirSync` (Windows EPERM retry). **`roadmap.json`** read-modify-writes (depend, backlog add/rm, `pruneBacklog`,
  `pruneRoadmapRefs`, restore, init `--lang`/`--guard`, roadmap `--lang`) hold `.specs/.roadmap.lock`
  (`withRoadmapLock`, `err.roadmapBusy`; it forgets only roadmap.json from the read cache). Lock order: a feature lock,
  then the roadmap lock — never the reverse; the ROADMAP.md refresh runs after both are released. Internal calls use
  the unwrapped functions.
- **Generated roadmap files carry the `AUTO-GENERATED by dev-spec` marker (EN/PT/ES, `RE_AUTOGEN`)**.
  `writeRoadmapMd/Html` skip a same-named file without it — the hooks run in every project; `spec_roadmap`
  returns a refused ROADMAP.md write as an error (a kept hand-written ROADMAP.html is a warning). The
  roadmap chrome language is `meta.roadmapLang`; `meta.lang` is the project language and only `spec_init`
  sets it.
- **`spec_depend`**: `dependsOn` REPLACES the list (`[]` / CLI `--clear` clears), `add`/`remove` (CLI
  `--add`/`--rm`, repeatable) edit it, `name` alone is a read (a bare `dev-spec depend <f>` used to clear the
  deps). Every dependency must be an existing feature.
- **Approvals record a content fingerprint** of the phase's artifact (`artifactFingerprint`; tasks.md
  with checkboxes normalized). `next_action` compares each artifact with ITS OWN approval — ticking a
  task is progress, not a spec edit. CRLF and a leading BOM are encoding, not content (`textFingerprint`): a
  "UTF-8 with BOM" re-save is no change. Compare through `fingerprintMatches` / `artifactMatches`, never `!==` —
  they also accept a fingerprint recorded (before the BOM was ignored) over a BOM-prefixed file.
- **Pending gates walk `PHASES` in order** (`specDoctor` → `pendingGates`, which next_action / finish / gatesOk read):
  a phase is due once the file `phaseFile(ph, kind)` names exists — a bugfix's `design` gate is `bug.md` (it used to
  look for design.md, so it was never asked for) — and Phase 4 `tests` (no artifact) via `testsGateDue()`: +tdd with
  test-plan.md or +ai with eval-plan.md, never a bugfix (its failing regression test is a task). `phaseActive('tests')`
  is tdd||ai. **Approving `tests` checks what Phase 4 produces** (`approvalChecks`): +tdd `tests-in-code` — every
  planned T-ID named by a test file (trace_check's code scan); +ai `eval-sets` — evals/golden.json is a set of the
  feature's own (not the scaffold's sample, not empty). Nothing to approve on a core-only feature. next_action keeps
  the Phase 4 wording (`/writeTests`) plus what the gate checks — but on an executing / complete feature (tasks ticked,
  e.g. an upgraded 1.12 one) it uses `next.signOffTests` (a sign-off for the tests that exist, never "failing tests
  first, no implementation code"). **Approving `execution`** runs spec_finish's blockers
  (`finishFeature(…, {gateOnly: true})` → stable ids `doctor`, `root-cause`, `placeholders`, `changed-since-approval`,
  `tasks`, `open-tasks`, `verification`, `approval-gates`); otherwise only `force` records it. spec_metrics' `finished`
  = the earliest of the first execution approval and `state.finished.at` (spec_finish {write} on a ready feature).
- **Rename follows every reference** (`renamePlan`, computed BEFORE the folder moves so the old slug still resolves,
  written after): roadmap.json dependsOn, `_Supersedes: <old>/…_` markers in other features' requirements.md (active
  and archived; never one in a comment/fence), and archived features' `.state.json → archived` records. A broken
  archived state file that names the old slug refuses the rename.
- **EARS context**: the loose heuristics (numbered item that "reads like" a requirement, lowercase
  `deve/debe`) apply only under an Acceptance Criteria heading or in heading-less snippets; elsewhere a
  criterion needs SHALL / capitalised DEVE·DEBE / "sistema deve", a stable ID or a CAPITALISED EARS
  keyword. Word boundaries are unicode (`(?<![\p{L}\p{N}_])`) — JS `\b` never matched `DEVERÁ`. Stable IDs
  include `EC-n`, `NFR-n`, `SC-nnn`; a deeper sub-list continues its parent criterion.
- **Mandatory sections**: `extractSection(md, syn, marker)` prefers the heading carrying the track
  marker (`[SaaS]`/`[AI]`), skips fenced code, **never matches the H1 title** (it carries the feature name)
  and requires the synonym to START the heading (after marker / numbering / "Section N:"), word-bounded.
  "Unfilled" = the `> **TODO**` sentinel is still there OR the body is empty. `spec_status` reports each
  section as present + filled (CLI ✓ filled · ◐ unfilled · ✗ missing).
- **AC/test IDs**: `US-<n>.AC-<n>` and `T-<n>`. Extraction uses a lookbehind guard, NOT `\b` —
  markdown italics (`_US-1.AC-1_`) make `\b` fail because `_` is a word char. Don't reintroduce `\b`.
  A test-plan row covering an AC requirements.md doesn't define is a gap (`phantomAcsInTests`, +tdd; fenced examples
  excluded), like a phantom AC in tasks — doctor fails and the test-plan approval is refused. Every reader of
  test-plan.md's IDs goes through `planIdText()` (comments AND fenced code out): coverage, planned T-IDs, the code
  scan, the Phase 4 gate, doctor, finish, `testIndex` / `testPlanEntries` — a fenced example row covered its AC (a
  false pass) and planned a T-ID the tests gate demanded. A scaffolded test plan
  only gets the template rows of the track ACs requirements.md has (`testPlanTracks()`, shared by spec_create on an
  existing feature and spec_add_track — a track added after the requirements brings none).
- **Secondary IDs are trace WARNINGS, never the verdict**: EC-n / NFR-n need a task or (+tdd) a test-plan
  row, SC-nnn a test-plan row or a real quickstart.md line; compared by number (`SC-1` = `SC-001`); untouched
  template rows don't count. `warnings` = `[{kind, items}]`, excluded from `traceGaps()`.
- **`trace --code` T-ID convention:** a test names its T-ID — `T-01` anywhere (`test("T-01 …")`), or without
  the hyphen an uppercase `T` + zero-padded number (`test_T01_…`, `testT01`, `TestT01`, `T01_…`) — see
  `RE_CODE_TID`. The scan (`scanTestCode()`) is bounded and read-only; a plan row whose File column names a
  concrete test path counts only in that file/folder; another feature's `.specs/<f>/tests/` never counts.
  A T-ID whose EVERY row names only non-code artifacts in its File column (`load-test.md`, `evals/*.json`, a
  `.feature` — any extension outside `GUARD_CODE_EXT`) is run outside test code: `plannedOutsideCode`, never
  `plannedNotInCode`, so neither doctor, finish nor the Phase 4 gate expects it in a test file (the scaffold's own
  load/eval rows warned forever). A code path outside a test folder, a template slot or a row without a File cell
  keeps the T-ID expected. Doctor's `tests-in-code` warns only for T-IDs made green by DONE tasks.
- **`_Implements:_` of an OPEN task is the plan**: a missing file only named by open tasks is
  `plannedImplFiles`, not a gap; a done task's missing file (or any path outside the project) stays
  `missingImplFiles`. `spec_coverage` = code files named in any `_Implements:_` (file, folder or glob) of any
  feature, active or archived. Every reader resolves a reference through `implementsPath()` (`:12` / `#L12` anchors
  dropped) — trace_check included, reporting the spelling the task wrote; an anchor alone names nothing (missing).
- **`earsValidate` is criterion-based, never line-based.** EARS phrasing (`ENQUANTO … QUANDO … O
  SISTEMA DEVE …`) wraps past one line, and markdown list items continue across lines (indented or
  lazy). `criterionBlocks()` folds physical lines into logical criteria FIRST — bounded by blank
  lines, headings, tables, HR and fenced code (fence *state* is tracked, so `const shall = 1` inside
  ` ``` ` is code, not an AC) — and only then lints each joined criterion. A comment-only line does
  **not** split a criterion. Issues report the criterion's start `line` (plus `endLine` when it spans
  several) and a stable `code` (`no-modal`/`no-id`/`vague`/`placeholder`/`no-keyword`/`needs-clarification`).
- **Fences: one closer rule, `closesFence(line, marker)`** — every fence-aware reader (`stripFencedCode`,
  `criterionBlocks`, `designSections`, `headingIndex`, the placeholder scan, `mdListItems`, import, the task
  scanner's `fenceLine`) closes a fence only on a CommonMark closer: the opener's character, at least as long,
  nothing after it but spaces. Never `line.trim().startsWith(fence)` — it closed an open backtick fence on a line
  carrying an info string (a `js` opener), and requirements.md then read inverted (its ACs vanished from EARS and
  trace_check).
- **Classifier signals are matched as WORDS, never substrings** (`keywordRe`, not `indexOf`).
  `indexOf` fired `claude` inside `.claude-plugin`, `rag` inside `sto·rag·e`, `sla` inside
  `tran·sla·te`, `auth` inside `auth·or` — and a phantom STRONG signal auto-enables a track, which
  then *hides* the negation the classifier computed for it. The regex allows inflections
  (`payment→payments`, `rate-limit→rate-limiting`), plural-only for ≤3-char acronyms (so `rag`+`ing`
  ≠ `raging`), `STEMS` for deliberate prefixes (`idempoten`, `hallucinat`, `summariz`, `alucina`),
  and `-based/-powered/…` adjectives (`AI-powered`), while rejecting `-<letter>` compounds
  (`claude-plugin`) and dotted/slashed identifiers. `-<digit>` stays legal (`gpt-4`). When you add a
  keyword, add it to the self-match sweep's expectations if it needs a new suffix class.
- **Negation never vetoes a track**, it annotates it. "the system shall not hallucinate" negates
  `hallucinat` on a feature that is unmistakably `+ai`. So when a track is on *and* has negated
  keywords, `classify` emits a conflict note ("+ai is ON although 'llm' appeared negated") for the
  human who confirms Phase 0 — it must never silently drop a negation it computed.
- **HTML-comment stripping** (`stripHtmlComments`): `ears`/`clarify`/`doctor` (for `[NEEDS
  CLARIFICATION]`) AND `trace_check` (for AC/test IDs and `_Implements:_`) all strip `<!-- -->`
  first, so example markers in template-guidance comments don't count as real. Keep template
  examples inside comments. A `<!--` that never closes is plain text everywhere — `stripHtmlComments` (closed only),
  `scanTaskLines`, and `criterionBlocks` / `placeholderReport` via `closerBelow()`: a stray marker used to hide every
  criterion below it (EARS 0 criteria → pass, the requirements approval passed) while trace_check counted them.
- **Tasks: ONE scanner.** `taskBlocks()` (over `scanTaskLines()`) reads tasks.md like a markdown reader —
  HTML comments (a line-start `<!--` may span lines) and fenced code never hold tasks; `<!--`/`-->` inside
  code spans don't count. `parseTasks()` is its line-only projection (its shape is public through
  `spec_status`), so status/next/complete/brief/finish can never disagree. Task numbers are numeric (`01.` is
  task 1); `resolveTask()` picks the first OPEN task of a duplicated number (doctor warns `duplicate-tasks`);
  `completeTask` ticks exactly the resolved line at its checkbox column (CRLF kept). Tasks are
  story-organized (P1 first) with `[P]` parallel markers + `**Checkpoint:**` lines; the design's
  `Constitution Check` section is checked by `doctor`.
- **Roadmap files are generated, never hand-edited.** Default is **`ROADMAP.md`** (git-friendly,
  keeps the Mermaid graph); `ROADMAP.html` is opt-in (`html:true`, self-contained, zero-dep, brand
  palette + system-default light/dark toggle). `roadmapData()` is the shared computation;
  `renderRoadmapMd`/`renderRoadmapHtml` (both take `lang`) build the output; `ROADMAP_I18N` holds
  EN/PT/ES chrome; `meta.lang` in `roadmap.json` persists the language for auto-refresh.
  `maybeRefreshRoadmap` (in every mutator) writes MD always + HTML if it exists + SPECS.md if it exists —
  best-effort. The PostToolUse hook does the same for hand-edits, skipping when the changed file IS a
  `ROADMAP.*`. HTML must stay **offline** — no CDN/external URLs (test asserts it). Backlog lives in
  `roadmap.json` `backlog: [{name,note}]`; `spec_create` drops the backlog item with the same slug.
- **Multilingual headings:** `SAAS_SECTIONS`/`AI_SECTIONS` are `{name, syn:[…]}` with EN/PT/ES
  synonyms; `extractSection` matches any synonym. `doctor`/`clarify` use `RE_CONSTITUTION_CHECK`,
  `RE_SUCCESS_CRITERIA`, `RE_INDEPENDENT_TEST`, `RE_OUT_OF_SCOPE`, `RE_NFR`, `RE_EDGE_CASES`,
  `RE_GLOBAL_CONSTRAINTS`; `addTrack` uses `RE_TESTABILITY` for the +tdd block heading. Add a synonym when
  adding a language. Localized BODY content is in `mcp/lib/i18n.js`, not spec.js.
- **Hooks: never reference `hooks/hooks.json` in `plugin.json`.** Claude Code auto-loads the standard
  `hooks/hooks.json` from the plugin root. Declaring `"hooks": "./hooks/hooks.json"` in the manifest
  loads it a SECOND time → `Duplicate hooks file detected` and the plugin fails to load hooks (the bug
  fixed in 1.9.1). `manifest.hooks` is ONLY for *additional* hook files at non-standard paths.
- **Hooks never block and stay cheap.** Every hook exits 0 on any error or irrelevant event, emits at most
  one JSON object, has a 10 s timeout, and only acts on a `.specs/` dev-spec owns (`isDevSpecProject` — checked by
  PostToolUse AND SessionStart: another tool's `.specs/` gets no status block in every session). The PostToolUse hook:
  requirements.md → EARS + placeholders, tasks.md → every trace gap + EC/NFR/SC warnings, design.md →
  `designSaveCheck()` (active tracks' `[SaaS]`/`[AI]` sections, Constitution Check, placeholders).
- **Hooks on Windows**: read stdin asynchronously (not `fs.readFileSync(0)`), and flush stdout
  before `process.exit` (write callback) — pipes truncate otherwise. The pre-commit validator reads staged
  names NUL-separated with `core.quotePath=false`, so accented paths work. Only EARS errors and phantom task refs
  block; a requirements.md with EARS warnings or template placeholders (the STAGED text, `featurePlaceholders(…, text)`)
  gets a ⚠ line (`earsWarnings`), never "EARS clean" — the PostToolUse hook's rule.
- **`spec_import` stays inside the project.** The source path must resolve inside `projectDir` — checked
  lexically first (nothing outside is even stat'ed), then by real path (a symlink out is refused) — and it is
  only read. Tool names are exact (`kiro` | `spec-kit` | `openspec`, the schema enum) on both surfaces, and it
  never imports over an existing feature.
- **Dates/timestamps**: fine to use `new Date()` in the MCP server and scripts (normal Node
  process). Do NOT assume that in any Workflow-script context.
- **Protocol**: stdio transport is newline-delimited JSON; messages must not contain embedded
  newlines (tool descriptions are single-line strings). `initialize` echoes the client's `protocolVersion`
  when supported (`SUPPORTED_PROTOCOLS`), else answers with the latest; default `2024-11-05`. Notifications
  never get a reply (and never run tools); a JSON-RPC batch gets ONE array reply; `null`/malformed input gets
  -32600/-32700.
- **Commands never reuse a Claude Code built-in name.** `/init`, `/status`, `/doctor` and `/commit`
  collided with the built-ins (a bare `/doctor` ran Claude Code's, and our own messages told users to
  "run /doctor"); they are `/spec-init`, `/spec-status`, `/spec-doctor`, `/spec-commit` since v1.11.
- **Returned text is localized, structured fields are not.** Engine errors (`errs()`), EARS issue
  `msg`, classifier `notes`/`reasoning`, doctor section names and details (the ears `earsDetail`), add_track's
  `added` annotations (`design.md (+secções)`), the ROADMAP.md/.html Phase column (`phaseNames`; the JSON
  `phase` stays English), CLI output (usage prefix, section labels, EARS severities included), hook and
  pre-commit lines all go through `i18n.msg(lang)`. Callers branch on stable fields — EARS `code` / `severity`,
  evidence `unverifiedReason` (and `spec_impact`'s task `evidence`), doctor check `id`, next_action `step` —
  never regex a `msg`.
- **Classifier language guess** (`guessLang`): STRONG PT/ES markers (weight 2: `não`, `uma`, `-ção`,
  `ñ`…) and WEAK ones (weight 1: `de`, `por`, `com`…) must beat the English function-word count —
  never add ambiguous words (`do`, `da`, `usa`, `los`, `no`, `.com`): they flipped English text to PT.
  The guess decides how `no` is read — a negator in EN/ES, the contraction *em+o* in PT ("aplicado no
  checkout"; also after a lowercase participle, never after a capitalised name like "Canada"). An
  explicit `lang` overrides the guess for negation too. One matched span counts once per track. Prose pairs like
  `login/signup` are split before matching; path-like tokens (`src/rag.ts`) are not. PT/ES plurals
  (`-ções`, `-ciones`, first word of a phrase) are generated by `pluralize()`.
- **CLI `--lang` is the MCP enum**: `main()` refuses anything but `en|pt|es` (case-folded) with the localized
  `args.invalid` message before dispatch — the engine's `normalizeLang()` would turn `fr` into `en` and save it.
- **CLI exit codes are scriptable**: `doctor` (FAIL), `trace` (gaps), `ears` (errors), `finish` (not ready),
  `drift` (drift, a stale baseline or an error) and any refused operation exit 1. The eval harness
  (`mcp/evals/run-evals.js`, also `dev-spec evals`) exits 2 on a usage error (a `--max-items` that isn't an
  integer ≥ 1 — it graded nothing and scored 0/0 = 100%) and 1 on an invalid set (an empty one included). An engine refusal goes through `fail(r)`, never
  `die(r.error)`: with `--json` the whole `{ok: false, error, …}` result (`recorded`, `neverApproved`, `gated`…) is
  the one JSON document on stdout, as MCP returns it. `die()` is for CLI usage/argument errors only.
- **CLI boolean switches are read with `on(k)`, never by truthiness**: `--x=false` is the string "false" (truthy),
  so `done --run=false` ran the `_Verify:_` commands. `normalizeBoolFlags()` (every name in `BOOL_FLAGS`) turns
  `true|false|1|0|yes|no|on|off` into booleans and refuses any other value; a new switch goes into `BOOL_FLAGS`.
  The eval harness (`mcp/evals/run-evals.js`, which `evals` forwards to untouched) applies the same rule to its own
  switches (`--dry-run`, `--set-baseline`, `--require-live`: exit 2 otherwise).
  Numeric flags that MCP bounds (`--cap`, `--max`) go through `intFlag()` (integer ≥ 1). The engine refuses what
  the MCP schema refuses where the CLI passes raw strings: `taskNumber()` (digits only — `"1.9"` / `"2abc"` are not
  task 1 / 2), `createFeature` kind ∈ feature|bugfix, `backlog` action ∈ add|rm|remove|list.
- **Eval harness** (`run-evals.js`) resolves the feature with the engine's resolver (accents, legacy slugs,
  `${VAR}` guard), prints in the feature's language, and treats a wrong-shaped set as invalid (exit 1). It validates
  EVERY item (`itemProblems()`: object, `id`, `input`, a grader in contains|equals|regex|refuse|judge, a value / a regex
  that compiles with gradeItem's flags / a rubric) and `thresholds.json` (a number in [0, 1] per set) before anything
  runs: a dry run exits 1 naming each bad item, a live run calls no model while any set is invalid.

## Tests
`node mcp/test.js` drives the full MCP handshake and exercises every tool against a temp project
(716 assertions, incl. a PT and an ES end-to-end scaffold, per-feature lang override, the prose guards —
README tool tables, rule files, no PR/CI steering — and a regression per review finding);
`node cli/test-cli.js` adds 241 for the CLI. The harness fails (exit 1) if the server dies or stops
answering — never let it drain to exit 0. Add an assertion when you add a tool or change behavior. Keep
it dependency-free. `node mcp/evals/run-evals.js <feature> --dry-run` validates the eval path offline.

## Bugfix and finish (v1.12)
- **`kind: "bugfix"`** is stored in `.state.json`; `createFeature` scaffolds `bug.md` +
  bug requirements/test plan/tasks (always +tdd), `specDoctor` swaps the design checks for
  `reproduction` (warn) and `root-cause` (**fail** until filled — the iron law, enforced at execution by
  `bugfixGate()`).
- **`spec_finish`** builds a merge title + summary (`mergeTitle`/`mergeSummary`, `.execution/merge-summary.md`)
  from the spec chain; it never merges, pushes or approves. **No PRs:** the owner's cost rule extends to
  pull requests — the plugin integrates by local merge only and must never steer users to open a PR or
  run CI (a test asserts no command/skill/agent text does).
- **Global Constraints** heading synonyms: `RE_GLOBAL_CONSTRAINTS` (EN/PT/ES); placeholder bullets are
  skipped when inlined into briefs.
- **Plugin evals** (`evals/<case>/prompt.md` + `graders/*.md`) follow the `claude plugin eval`
  reference; they cost tokens and run locally only (never CI).

## When extending
- New MCP tool → add the function to `mcp/lib/spec.js`, a TOOLS entry + dispatch case in
  `mcp/server.js` (its `inputSchema` IS the validation — declare types, enums, required keys), the CLI
  subcommand, a test in `mcp/test.js` (and bump the exact tool count), the README tool tables (EN/PT/ES — a
  test rejects phantom rows and requires the 23 v1.12 tools; it does not yet require newer ones, so add the row
  by hand), and (usually) a thin command in `commands/`.
- Any generated/returned user-facing text → put the strings in `mcp/lib/i18n.js` for all three
  languages and resolve the lang via `featureLang()`/`projectLang()`; keep IDs/markers English-stable.
- Keep `SKILL.md` the source of truth for the workflow; commands stay thin.
