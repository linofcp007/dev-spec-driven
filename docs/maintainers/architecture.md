# Architecture — layout, the module rule, config paths

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
The full layout, how the engine's modules load and link, and where each config file points.

## Layout
```
.claude-plugin/plugin.json     manifest (skills, commands, mcpServers point here; NO hooks key — see gotcha)
.claude-plugin/marketplace.json local marketplace for install
mcp/servers.json               registers the `spec-driven` stdio server (plugin.json → mcpServers; deliberately NOT a root .mcp.json — see Config paths)
skills/dev-spec-driven/SKILL.md the workflow (track routing engine, prose)
skills/.../references/          deep library, read on demand
commands/*.md                  54 slash commands (thin wrappers that invoke the skill/MCP) — also served as the MCP prompts
agents/*.md                    plugin subagents, auto-discovered and dispatched as `dev-spec-driven:spec-implementer` /
                               `dev-spec-driven:spec-reviewer` (subagent execution) / `dev-spec-driven:spec-critic` (--deep)
evals/                         plugin evals for `claude plugin eval` — maintainer-side, results ignored: triggering cases
                               (tags triggering / negative) and behavioural cases (tag behavior: <case>/case.yaml + fixture.sh,
                               built from evals/fixtures/ — lib.sh + project trees — with this plugin's own CLI); evals/README.md
mcp/server.js                  MCP stdio protocol (JSON-RPC 2.0, newline-delimited) + argument validation against each inputSchema
mcp/lib/spec.js                the engine's FACADE (1.18): the one public object every surface requires (server, CLI, hooks, tests) —
                               the same keys as ever, each operation in ONE read-cache scope, the mutators under the feature lock
mcp/lib/engine/                ALL domain logic, one module per concern (the module rule: see Three surfaces over ONE engine):
  index.js                     the loader — MODULES in order → the namespace E (a name defined twice throws) → __link(E) for each
  ctx.js                       CTX, the shared per-call state (read cache, glob cache, the call's .specs/ root, template /
                               pack memos, ghost markers, the built-in corpus flag) — one object, mutated in place
  core.js                      linear text scans (1.17 H), own-key lookup, blank facts; linear glob matching; the _Implements:_
                               readers (implementsPath / Rel / Key, implementsTargets, globFiles)
  files.js                     paths, create-only / atomic writes, JSON reads, the read cache (withReadCache), path containment
                               (drive roots, 8.3 names, junctions, network paths); the feature and roadmap locks, folder moves
                               under the lock, the .specs/.gitignore lock lines
  state.js                     language resolution, the feature resolver (resolveFeature / existingFeature), .state.json,
                               PHASES and their files, content fingerprints; roadmap.json (deps, backlog, meta.lang), the
                               roadmap writers, RE_AUTOGEN
  markdown.js                  comments (commentLines), fences (closesFence / fenceStep), headings, sections (extractSection),
                               AC / T-ID readers; the template corpus, the bracket scan, artifact / feature / chain placeholders
  tracks.js                    the track registries (built-in + packs: allTracks, trackMarker…), parseTracks, detectTracks,
                               TRACK_SECTIONS, the inactive-section readers; the Phase 0 classifier (SIGNALS, negation, the
                               language guess); track packs (.specs/tracks/: load + validate, cached; render; spec_tracks) —
                               the largest module (~2,700 lines since 1.19 — the three new tracks' signals and cues —,
                               three concerns): a candidate for a later split into registries / classify / packs
  templates.js                 project templates (.specs/templates/), their placeholder corpus, spec_templates
  scaffold.js                  spec_init, spec_create, the artifact skeletons, steering stubs, spec_add_track; scoped steering
                               (front matter, the brief's steering, custom names), steering amendments (1.16 Q1)
  tasks.js                     the tasks.md scanner (taskBlocks), task markers, _Depends:_ + waves (taskSchedule), spec_next_task;
                               spec_complete_task (+ undo) with the bugfix gate, spec_append_tasks; spec_task_brief
  evidence.js                  the evidence gate (taskVerification), run shells, red → green, observed runs, project checks,
                               git-linked evidence
  trace.js                     criterion blocks + the EARS linter; trace_check, its gaps and the deep warnings (EC / NFR / SC,
                               T-IDs in test code); the requirements traceability matrix, its CSV and export section
  gates.js                     the gate walk, pending gates, changedSinceApproval, approvalChecks, flows, detectPhase;
                               spec_approve (force, waivers, revoke, roles, the fast-forward); .history/ snapshots, spec_impact
  doctor.js                    spec_doctor, spec_next_action, the design.md save check; spec_list / spec_status, the status line,
                               the plan-mode bridge, the DEV_SPEC_* defaults
  quality.js                   cross-feature ACs (Q2), the glossary (Q3), design trade-offs / risks (A1) and reuse (1.19 R1),
                               the brief's Reuse section (R2), the constraint nudge (A2), spec_clarify
  finish.js                    spec_finish and the drift baseline (spec_drift); remove / rename / archive / restore;
                               _Supersedes:_ and .specs/SPECS.md; spec_metrics (+ retro.md)
  roadmap-md.js                ROADMAP.md / .html (roadmapData), forecasts, cross-feature overlaps
  decisions.js                 decisions.md (spec_decide) and the spike kind
  export.js                    spec_export (the escaping markdown renderer, the document model, Gherkin, tracker CSV);
                               spec_changelog and spec_milestone
  guards.js                    guard mode (meta.guard, the scope guard), the end-of-turn stop gate, the human approval guard
                               and its shell lexer; CLI_SWITCHES
  upgrade.js                   spec_upgrade (meta.specVersion, the audit, the migrations)
  scan.js                      the brownfield scan and spec_coverage
  import/                      spec_import: index.js (the entry point, task import) · common.js (the shared readers) · one
                               parser per tool — kiro.js · speckit.js · openspec.js · plan.js (plan + execplan) · bmad.js ·
                               fluidplan.js
mcp/lib/i18n.js                the localized content's FACADE: assembles the tables (BUILD / STEERING / EVALS_README / MSG / BRIEF)
                               — each language's file loads on its first use — and exports the public API — EN/PT/ES + pt-BR
mcp/lib/i18n/                  en.js · pt.js · es.js (every table's block for that language) · common.js (language codes, the
                               template test IDs) · pt-br.js (the pt-BR derivation: toPtBr, derivePtBr, defineDerivedLocale)
mcp/lib/prompts-resources.js   MCP prompts (one per commands/*.md, read at runtime) + specs:// resources (read-only, confined)
mcp/evals/run-evals.js         local eval harness (uses ANTHROPIC_API_KEY; --dry-run offline)
mcp/test.js                    the MCP suite's entry point — `node mcp/test.js [--only <file|area|NN>] [--list]`
mcp/tests/                     its files, one per area: NN-<area>[-<topic>].js (each exports run(ctx)) + harness.js (the
                               server under test, ok / rpc / payload, the shared helpers) — see testing.md → The suites
cli/dev-spec.js                universal CLI over mcp/lib/spec.js (cross-tool; also prints MCP configs, rule files and prompts)
cli/test-cli.js                the CLI suite's entry point — `node cli/test-cli.js` (never a top-level bin/, see below)
cli/tests/                     its files: NN-<area>-<topic>.js (NN = the same area numbers as mcp/tests/) + harness.js
scripts/test-runner.js         the runner both suites share: files → chains (deps) → parallel processes, --only / --list
scripts/test-docker.js         both suites in Linux containers — `npm run test:docker` (local Docker, never hosted CI)
hooks/hooks.json               PreToolUse → guard-hook.js (Write|Edit|MultiEdit|NotebookEdit) + approval-hook.js
                               (^(Bash|PowerShell|(mcp__.+__)?(spec_approve|spec_feature|spec_init))$) · PostToolUse → spec-hook.js
                               (Write|Edit) + observe-hook.js (Bash) + plan-hook.js (ExitPlanMode) · PostToolUseFailure (Bash) → observe-hook.js ·
                               SessionStart → spec-hook.js · Stop + SubagentStop (matcher ^(dev-spec-driven:)?spec-implementer$)
                               → stop-hook.js
hooks/guard-hook.js            opt-in guard mode (asks before code edits while no feature has approved tasks; scope level)
hooks/approval-hook.js         opt-in human approval guard (meta.approvalGuard ask|deny: an agent's approval asks / is refused)
hooks/observe-hook.js          harness-observed evidence (logs Bash runs of _Verify:_ / project-check commands; prints nothing)
hooks/spec-hook.js             save checks (requirements/tasks/design.md) + SessionStart status (at most 20 features, then
                               "+N more"), drift, upgrade and overlap lines
hooks/stop-hook.js             end-of-turn evidence gate (spec.stopCheck — a "done" claim with unverified recent ticks)
hooks/plan-hook.js             plan-mode bridge (ExitPlanMode: one line of context suggesting /spec-import of the approved plan)
hooks/precommit-check.js       optional git pre-commit validator
AGENTS.md                      portable workflow for non-Claude agent tools
.cursor/ .windsurf/ .github/copilot-instructions.md GEMINI.md  per-tool rule files (point to AGENTS.md)
INTEGRATIONS.md                per-tool setup + MCP config snippets
```

## The module rule (1.18)
(The first half of **Three surfaces over ONE engine** — the engine-first rule and MCP / CLI parity — is in CLAUDE.md.)

**The module rule (1.18 — `mcp/lib/engine/index.js`).** The engine is plain CommonJS modules, one per concern (Layout),
behind two facades: `spec.js` (the public object — its keys, the `withReadCache` wrap of every function and the
`featureLocked` mutators, exactly as when it was one file) and `i18n.js`. Inside the engine:
- **Load time — a DAG.** A name a module needs while it LOADS (a table or regex built from another module's constant —
  `RE_HEADING_LEAD` from `MARKER_TRACKS`, `featureLocked(setFeatureFlow)`, `C3_PARSERS`, `TRACE_INFO_FIELDS.add(…)`) comes from a
  destructured `require()` of the module that owns it, marked `// load time` — whatever their order in `MODULES`
  (markdown.js loads tracks.js, listed after it; decisions / export / finish load trace.js, listed before them). Those
  requires form a DAG — never a cycle (a cycle would hand out a half-built `module.exports`).
- **Call time — any direction.** Every other name a module uses from another module is a `let` declared at its top and
  assigned by `__link(E)` once EVERY module has loaded (`index.js` merges all exports into `E` — a name defined in two
  modules throws — then links each module). Call sites keep their bare names, so moved code reads as it always did. Never
  read a late-bound name while the module loads: it is `undefined` until `__link`. The bare `let` list and the `__link`
  destructure name exactly the same names, each exported by some module, and never the parameter itself (`({ …, E } = E)`
  assigns the parameter and leaves the module's `E` undefined — and `E` IS a name, trace.js's word-boundary fragment); a
  module's private cache is a `let` WITH an initializer (`= null`, `= undefined`), so it never reads as a linked name.
  mcp/test.js ("1.18 module rule") checks all of it from the sources, plus the load-time graph (acyclic, every engine →
  engine / i18n → i18n require marked `// load time`) and that every module in `MODULES` is loaded.
- **Shared mutable state lives in `engine/ctx.js`:** ONE object, `CTX`, mutated in place and never re-bound (a destructured
  copy would go stale) — the read cache and everything else one engine call scopes (`CTX.READ_CACHE`, `CTX.GLOB_CACHE`,
  `CTX.XAC_MEMO`, `CTX.TEMPLATE_SCOPE_ROOT`, `CTX.TEMPLATE_MEMO`, `CTX.PACK_MEMO`, `CTX.GHOST_MARKERS`, reset by
  `withReadCache`; `CTX.BUILTIN_CORPUS_BUILD` while the built-in corpus is built). A module's own lazy caches (`TEMPLATE_SETS`,
  `PACK_CACHE`, `KW_RE`, `STOP_PATTERNS`, `ENGINE_VERSION`…) stay private `let` / `const` in that module; a `let` another
  module reads moves into `CTX`.
- **A new module** goes into `MODULES` (index.js) — `mcp/test.js` checks the list matches the files, and that every
  `mcp/lib` source requires only Node core or a relative file. `__dirname` in a module is `mcp/lib/engine/` (the clone's
  root is three levels up: `approvalGuardDecision`'s cli path, `engineVersion`'s package.json).
- **Few, cohesive files.** Every hook and CLI call is a fresh process that loads the whole engine, and on Windows each file
  costs ~0.65 ms before any compile (stat, realpath, open + read — the open is the expensive part) — the engine is 20
  modules (+ 8 importers) of 400–2,700 lines (tracks.js the largest — the split candidate), not one per helper. Add to the module of the concept; a new file must earn
  its load cost. **The compile cache:** the facade (spec.js, first line) calls `module.enableCompileCache()` (Node ≥ 22.8;
  nothing on older ones): the compiled code of every module loaded after it is kept between processes in
  `NODE_COMPILE_CACHE` or `<os.tmpdir()>/node-compile-cache/<node version>/` (one file per module, ~1.4 MB for the engine;
  `NODE_DISABLE_COMPILE_CACHE=1` turns it off; it never throws). It saves the compile of the large modules but adds one
  cache-file read per module — a tiny module loads SLOWER with it (36 one-line files: 23 ms → 51 ms), one more reason not to
  add small files — and the first process after an update writes it (45–60 ms more, once). Measured for 1.18 (Windows,
  Node 24, p50 of 40 interleaved fresh processes; 1.17 → the first split → with the cache and the lazy pt-BR below): guard
  hook 220 → 260 → 238 ms, `dev-spec status` 211 → 243 → 224, SessionStart 345 → 380 → 364, the stop hook on a "done"
  claim 252 → 284 → 231. Measure the same way: interleave the variants, fresh processes, p50 + spread — never one run.
- **i18n** follows the same shape: `i18n/en.js` / `pt.js` / `es.js` require `i18n/common.js` at load time and reach the
  assembled `BUILD` / `MSG` through `__link` from `i18n.js`. The tables hold their `en` · `pt` · `es` keys from the start,
  in that order; a language's file loads on the FIRST read of any table's entry for it (`loadLocale`: its blocks replace
  the getters, then the `sectionNames` / `quality` / `designWeigh` merges, then its link) — a process pays only for the
  languages it speaks. pt-BR is derived from pt on its first use (`defineDerivedLocale`), as before, and `i18n/pt-br.js`
  itself loads only then (a table's `pt-BR` entry, `toPtBr`, `derivePtBr` — `ptbr()` in i18n.js). A group with raw entries
  (MSG `stopGate`: the claim patterns) is derived entry by entry, so the stop gate's claim scan reads pt-BR's patterns
  without a single toPtBr (its first call compiles the pt-BR word maps: ~17 ms).

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
