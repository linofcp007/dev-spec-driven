# Architecture — layout, the module rule, config paths

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
The full layout, how the engine's modules load and link, and where each config file points.

## Layout
```
.claude-plugin/plugin.json     manifest (skills, commands, mcpServers point here; NO hooks key — see gotcha)
.claude-plugin/marketplace.json local marketplace for install
mcp/servers.json               registers the `spec-driven` stdio server (plugin.json → mcpServers; deliberately NOT a root .mcp.json — see Config paths)
skills/dev-spec-driven/SKILL.md the workflow (track routing engine, prose) — the decision-time rules, ≤ 5,000 words (1.21)
skills/.../references/          deep library, read on demand — index.md lists every file; tool-catalog.md · track-checklists.md ·
                               workflows.md hold what SKILL.md points to (1.21)
commands/*.md                  55 slash commands (thin wrappers that invoke the skill/MCP) — also served as the MCP prompts
agents/*.md                    plugin subagents, auto-discovered and dispatched as `dev-spec-driven:spec-implementer` /
                               `dev-spec-driven:spec-reviewer` (subagent execution, its verify / simplify modes) /
                               `dev-spec-driven:spec-critic` (--deep) / `dev-spec-driven:spec-simplifier` (/spec-simplify, 1.22)
evals/                         plugin evals for `claude plugin eval` — maintainer-side, results ignored: triggering cases
                               (tags triggering / negative) and behavioural cases (tag behavior: <case>/case.yaml + fixture.sh,
                               built from evals/fixtures/ — lib.sh + project trees — with this plugin's own CLI); evals/README.md
mcp/server.js                  MCP stdio protocol (JSON-RPC 2.0, newline-delimited) + argument validation against each inputSchema
                               + the approval guard over MCP (1.21 F1b: elicitation/create to the client, its one async path)
mcp/lib/spec.js                the engine's FACADE (1.18): the one public object every surface requires (server, CLI, hooks, tests) —
                               the same keys as ever, each operation in ONE read-cache scope, the mutators under the feature lock;
                               it loads the engine from its modules, or from a current bundle with DEV_SPEC_BUNDLE=1 (The build)
mcp/lib/spec.bundle.js         GIT-IGNORED, built on demand (dev-spec bundle / npm run build:bundle): the engine + i18n modules
                               in ONE file, for a slow file system — never committed
mcp/lib/engine/                ALL domain logic, one module per concern (the module rule: see Three surfaces over ONE engine):
  index.js                     the loader — MODULES in order → the namespace E (a name defined twice throws) → __link(E) for each
  ctx.js                       CTX, the shared per-call state (read cache, glob cache, the call's .specs/ root, template /
                               pack memos, ghost markers, the built-in corpus flag) — one object, mutated in place
  core.js                      linear text scans (1.17 H), own-key lookup, blank facts; linear glob matching; the _Implements:_
                               readers (implementsPath / Rel / Key, implementsTargets, globFiles)
  files.js                     paths, create-only / atomic writes, JSON reads, the read cache (withReadCache), readFileHead (a
                               file's first N characters in one bounded read — the code scans, 1.21.1), path containment
                               (drive roots, 8.3 names, junctions, network paths); the feature and roadmap locks, folder moves
                               under the lock, the .specs/.gitignore lock lines
  state.js                     language resolution, the feature resolver (resolveFeature / existingFeature), .state.json,
                               PHASES and their files, content fingerprints; roadmap.json (deps, backlog, meta.lang), the
                               roadmap writers, RE_AUTOGEN; the semantic 3-way merge of .state.json / roadmap.json behind git's
                               merge driver (1.21 F1a — mergeStateJson / mergeStateText / mergeAttributes, pure)
  markdown.js                  comments (commentLines), fences (closesFence / fenceStep), headings, sections (extractSection),
                               AC / T-ID readers; the template corpus, the bracket scan, artifact / feature / chain placeholders
  corpus.generated.json        GENERATED (npm run build, committed): the built-in placeholder corpus markdown.js reads (The build)
  tracks.js                    the track registries (built-in tables + the accessors that add packs: allTracks, trackMarker…),
                               parseTracks, detectTracks, TRACK_SECTIONS, the inactive-section readers, and SIGNALS: one
                               object per built-in track (tiers, concepts, hazards, cues) — the classifier's data (1.20)
  classify.js                  the Phase 0 classifier (1.20): keyword machinery, negation, shadowing, CUE_KINDS (the generic
                               cue mechanisms), guessLang; it derives SIGNAL_CONCEPTS / SIGNAL_HAZARDS / SIGNAL_CUES from SIGNALS
  packs.js                     track packs (1.20): .specs/tracks/ load + validate (cached), ghost and legacy handling, render,
                               spec_tracks
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
  scan.js                      the brownfield scan and spec_coverage; the ONE notion of code (CODE_EXT, isCodeFile) and of a
                               test file (isTestFile) the scan, coverage, the test-code scan and guard mode share (1.21.1)
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
cli/test-cli.js                the CLI suite's entry point — `node cli/test-cli.js` (never a top-level bin/: CLAUDE.md → Never ship a top-level bin/)
cli/tests/                     its files: NN-<area>-<topic>.js (NN = the same area numbers as mcp/tests/) + harness.js
scripts/build.js               `npm run build`: the committed corpus (--check: exit 1 when stale) · --bundle [--out]: the bundle
scripts/test-runner.js         the runner both suites share: files → chains (deps) → parallel processes, --only / --list
scripts/test-docker.js         both suites in Linux containers — `npm run test:docker` (local Docker, never hosted CI)
hooks/hooks.json               PreToolUse → guard-hook.js (Write|Edit|NotebookEdit) + approval-hook.js
                               (^(Bash|PowerShell|Monitor|Write|Edit|(mcp__.+__)?(spec_approve|spec_feature|spec_init|spec_add_track))$) · PostToolUse → spec-hook.js
                               (Write|Edit) + observe-hook.js (Bash) + plan-hook.js (ExitPlanMode) · PostToolUseFailure (Bash) → observe-hook.js ·
                               SessionStart → spec-hook.js · Stop + SubagentStop (matcher ^(dev-spec-driven:)?spec-(implementer|simplifier)$)
                               → stop-hook.js
hooks/guard-hook.js            opt-in guard mode (asks before code edits while no feature has approved tasks; scope level)
hooks/approval-hook.js         opt-in human approval guard (meta.approvalGuard ask|deny: an agent's approval asks / is refused)
hooks/observe-hook.js          harness-observed evidence (logs Bash runs of _Verify:_ / project-check commands; prints nothing)
hooks/hook-utils.js            what the hooks share BEFORE the engine loads (1.24): UTF-8 / UTF-16 reads, a Write / Edit target as the
                               file system reads it, the approval hook's candidate projects, a per-session marker — no hook itself
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
  `withReadCache`; `CTX.BUILTIN_CORPUS_BUILD` while the built-in corpus renders). A module's own lazy caches (`TEMPLATE_SETS`,
  `PACK_CACHE`, `KW_RE`, `STOP_PATTERNS`, `ENGINE_VERSION`…) stay private `let` / `const` in that module; a `let` another
  module reads moves into `CTX`.
- **A new module** goes into `MODULES` (index.js) — `mcp/test.js` checks the list matches the files, and that every
  `mcp/lib` source requires only Node core or a relative file. `__dirname` in a module is `mcp/lib/engine/` (the clone's
  root is three levels up: `approvalGuardDecision`'s cli path, `engineVersion`'s package.json).
- **Few, cohesive files.** Every hook and CLI call is a fresh process that loads the whole engine, and on Windows each file
  costs ~0.65 ms before any compile (stat, realpath, open + read — the open is the expensive part) — the engine is 22
  modules (+ 8 importers) of 400–1,800 lines, not one per helper. Add to the module of the concept; a new file must earn
  its load cost. **The compile cache:** the facade (spec.js, first line) calls `module.enableCompileCache()` (Node ≥ 22.8;
  nothing on older ones): the compiled code of every module loaded after it is kept between processes in
  `NODE_COMPILE_CACHE` or `<os.tmpdir()>/node-compile-cache/<node version>/` (one file per module, ~1.4 MB for the engine;
  `NODE_DISABLE_COMPILE_CACHE=1` turns it off; it never throws). It saves the compile of the large modules but adds one
  cache-file read per module — a tiny module loads SLOWER with it (36 one-line files: 23 ms → 51 ms), one more reason not to
  add small files — and the first process after an update writes it (45–60 ms more, once). Measured for 1.18 (Windows,
  Node 24, p50 of 40 interleaved fresh processes; 1.17 → the first split → with the cache and the lazy pt-BR below): guard
  hook 220 → 260 → 238 ms, `dev-spec status` 211 → 243 → 224, SessionStart 345 → 380 → 364, the stop hook on a "done"
  claim 252 → 284 → 231. Measure the same way: interleave the variants, fresh processes, p50 + spread — never one run. A
  slow file system multiplies the per-file cost (tens of ms a file on a Docker Desktop bind mount): there the answer is the
  one-file bundle the user builds (The build), never fewer, larger modules.
- **i18n** follows the same shape: `i18n/en.js` / `pt.js` / `es.js` require `i18n/common.js` at load time and reach the
  assembled `BUILD` / `MSG` through `__link` from `i18n.js`. The tables hold their `en` · `pt` · `es` keys from the start,
  in that order; a language's file loads on the FIRST read of any table's entry for it (`loadLocale`: its blocks replace
  the getters, then the `sectionNames` / `quality` / `designWeigh` merges, then its link) — a process pays only for the
  languages it speaks — so engine code that needs a text of EVERY language (a heading matched in any language) reads it from
  the pre-generated corpus, never by asking each language's table: the built-in tracks' task-block headings (`trackTaskHeadings`
  → `builtinTaskHeadings`, 1.22 review) loaded pt.js, es.js and pt-BR into every English `list` (50–65 ms). pt-BR is derived
  from pt on its first use (`defineDerivedLocale`), as before, and `i18n/pt-br.js`
  itself loads only then (a table's `pt-BR` entry, `toPtBr`, `derivePtBr` — `ptbr()` in i18n.js). A group with raw entries
  (MSG `stopGate`: the claim patterns) is derived entry by entry, so the stop gate's claim scan reads pt-BR's patterns
  without a single toPtBr (its first call compiles the pt-BR word maps: ~17 ms).

## The build (1.20) — the committed corpus, the on-demand bundle, and when to rebuild
`scripts/build.js` (Node core only) builds two things from the sources:
- **`npm run build`** (no argument) writes the COMMITTED placeholder corpus `mcp/lib/engine/corpus.generated.json`;
  `node scripts/build.js --check` writes nothing and exits 1 while it is stale. Deterministic — the same sources give the same
  bytes (sorted lists, no dates, LF; a CRLF or BOM checkout hashes the same).
- **`npm run build:bundle`** (`--bundle [--out <file.js>]`), also **`dev-spec bundle [--out <file.js>]`** (a plugin install has
  no npm), writes the one-file engine — by default `mcp/lib/spec.bundle.js`, which is **git-ignored and never committed** (2.7 MB,
  stale after every engine change: it would bloat the history and conflict on every parallel merge, for an opt-in gain on slow
  file systems only). The user who wants it builds it, once after each plugin update. `dev-spec bundle` replaces an existing
  file only when it is a previous bundle (its header: `"use strict";` then `// GENERATED by scripts/build.js --bundle`) or with
  `--force` (1.24 r6 B8 — `--out src/app.js` overwrote the user's file; `cliOutput.bundleNotOurs`). `build.js --bundle` itself
  (a maintainer's script) does not ask. **Which engine ran** is never printed by the facade (hooks and the status line stay
  silent) but it is recorded — `spec.engineSource` `{kind, requested, file, skipped: missing|other-version|stale|broken,
  pathIgnored}` (1.24 r6 B-I1) — and `dev-spec version` shows it: the answer to "is my bundle used?".
- **When to rebuild the corpus — precisely:** after changing a file of `CORPUS_SOURCES` — `mcp/lib/i18n.js`,
  `mcp/lib/i18n/*.js` (every template, string, pt-BR rule), `engine/core.js`, `engine/markdown.js`, `engine/packs.js`,
  `engine/tasks.js`, `engine/tracks.js` (a track) — or `package.json`'s version. Any other engine file needs no rebuild.
  mcp/test.js ("1.20 build") fails with "run npm run build" until the regenerated file is committed; nothing at runtime goes
  wrong meanwhile (below), it only goes slower. On a merge conflict in the file, take either side and run `npm run build`.
- **The corpus.** The built-in part of the placeholder corpus (docs/maintainers/gates-and-approvals.md → Gates) —
  `templateSets()`, `templateSetsBr()`, `templateTaskSet()`, the bug steps (`bugStepSet()`) — and the built-in tracks' task-block
  headings in every language (`taskHeadings` {track: [heading…]}, read by `trackTaskHeadings` — 1.22 review: rendering them
  loaded every language's file; `localeLoaded` clears tracks.js's `TASK_HEADINGS` with the corpus) — is the same in every process of
  one engine, and rendering it (1,165 texts plus pt-BR's twins through toPtBr: ~200 ms) was the largest slice of a hook or
  CLI call (1.19's SessionStart was ~20% slower than 1.18's for it). The build renders it ONCE with the engine's own
  functions (`renderCorpusData()`: the sets' members, sorted) into the JSON file, stamped `version` (package.json) and
  `sources` — a sha1 over `CORPUS_SOURCES` (markdown.js): the eleven mcp/lib files the render runs through. On the first
  placeholder question a process reads the file (one `JSON.parse`, ~38 KB) and uses it only while it matches the engine the
  process LOADED: `version` is `engineVersion()` — package.json read as the engine loads, never later — and `sources` is the
  hash of the sources as they were at load. markdown.js stats every source as it loads (`LOADED_STATS`: size, mtime, ctime —
  one stat each, no read, ~0.5 ms); the first question re-reads and hashes them (~2 ms natively) and trusts the file only
  while every stat is still the load-time one (stat'ed after the hash). A language file i18n.js loads on first use (`onLocaleLoad`) that
  changed since the engine loaded, after the corpus was trusted, drops it (`localeLoaded`: the sets render again). So a
  long-lived process — the MCP server — under which a `git pull` / `npm run build` rewrote the sources AND the corpus renders
  from the code it runs, never trusts the new corpus (1.20 review — the race mcp/tests/16-conventions.js reproduces in child
  processes). Otherwise too — a clone hand-edited and not rebuilt, a missing or broken file — it renders exactly as before:
  never a wrong answer, only a slower one (`builtinCorpusSource()`: `file` · `bundle` · `render`). An edit that keeps a
  source's size, mtime AND ctime is the accepted limit. mcp/test.js proves `CORPUS_SOURCES` with V8 coverage (every
  mcp/lib file whose functions run during `renderCorpusData()` is listed — a render that starts to depend on another module
  makes that test name it), and that a rendered corpus decides every fresh scaffold text exactly as the committed one. The
  per-project part (the project's templates, its track packs — `projectTemplateHas`, `packCorpusSets`) stays per call. Only
  `.has()` is ever asked of these sets. A new builder or artifact goes into `templateCorpus()` as before — then rebuild.
- **The bundle.** Each engine and i18n module (`engine/**`, `i18n.js`, `i18n/*` — not the facade spec.js, not
  prompts-resources.js) is its source VERBATIM inside `function (exports, require, module, __filename, __dirname)`, run by a
  small module registry (`moduleRegistry()` in scripts/build.js, emitted with `Function.prototype.toString`). The bundle
  exports `{ stamp: { version, files: [[rel, size, mtimeMs]…] }, load(root) }`: the facade passes its own folder as `root`,
  so every module keeps its ORIGINAL `__filename` / `__dirname` (mcp/lib/…) wherever the bundle file lives — `engineVersion()`'s
  package.json and the approval guard's CLI path read the same files. A relative require resolves inside the registry
  (cached before the module runs, dropped if it throws — Node's semantics), a bare one (Node core) goes to Node: the load
  order, the load-time DAG and `__link` are unchanged. Every module starts `"use strict";` (the build refuses one that
  doesn't — the bundle is strict). The corpus rides along, rendered from these very sources: inside the bundle
  `module.bundle` carries it (no sources hash then; under Node's own loader `module.bundle` is undefined).
- **Which engine a process loads (the facade, `loadEngine()`).** The modules, by default. A bundle ONLY with
  `DEV_SPEC_BUNDLE=1` (`1` / `true` / `yes` / `on`) — `DEV_SPEC_BUNDLE_PATH` names another file (taken only as an absolute path
  to a `.js` file, else ignored: the default place) — and only while it is CURRENT: its version stamp is package.json's and
  every module it holds still has the size and mtime it was built with — one `stat` per module, no read (38 stats: ~1 ms
  natively, ~95 ms on a Docker Desktop bind mount, where one open + read costs more). A `git pull` / plugin update, even to
  the same version, changes the files' mtimes: the old bundle is never run. **An edit that keeps a module's size AND its
  mtime is undetectable by this check** (a same-length change within the file system's mtime granularity, a tool that
  restores the mtime) — an accepted limit, the price of one stat per module and no read: rebuild the bundle after editing a
  module (or leave DEV_SPEC_BUNDLE unset while you edit). Missing, broken, stale or of another version →
  the modules, silently (hooks and the status line print nothing about it). Compare in the environment that built it: a
  bundle built on the host and read through a bind mount may see other mtime precision — it is then simply ignored; build it
  where it runs (`dev-spec bundle --out /tmp/…` in a container with a read-only mount). Opt-in because natively it gains
  little (and loses without Node's compile cache, Node < 22.8). The MCP server takes it like every process.
- **Guards.** `libSources()` (the source guards' file list) leaves `spec.bundle.js` out (a user-built one in mcp/lib); the
  guards read scripts/build.js, where the registry is written. Both suites run on the modules (the harnesses drop
  `DEV_SPEC_BUNDLE`). The tests BUILD a bundle into tmp: mcp/tests/16-conventions.js ("1.20 bundle": the namespace, the
  embedded corpus, the modules' paths, every stamp true; on a copy of the clone — none, current, unset / 0, a relative or
  non-.js `DEV_SPEC_BUNDLE_PATH`, one elsewhere, a module touched or resized under the same mtime and put back, another
  version, a broken bundle; the MCP server's handshake, lists and ten tool calls byte for byte) and
  cli/tests/16-conventions-bundle.js (`dev-spec bundle --out`, then one session — 39 CLI commands and 7 hook events — on the
  modules and on that bundle: the same output, exit codes and `.specs/` tree).
- **Measured** (p50 of interleaved fresh processes, a 6-feature EN / PT / ES project, on a machine shared with other test
  runs — the spread is wide, the ratios held run after run; 1.20 base → the corpus file → + the bundle with its staleness
  check). Windows, Node 24: the SessionStart hook 431 → 301 → 304 ms (CPU 608 → 311 → 296 ms); a cold `require(spec.js)`
  180 → 173 → 126 ms (the bundle without the compile cache: slower than the modules). Docker Desktop bind mount (the clone
  mounted read-only, the bundle built into the container's /tmp), node:24-alpine: `require` 637 → 692 → 238 ms, SessionStart
  1,278 → 914 → 557 ms — the check itself ~96 ms of it; node:18-alpine 742 → 665 → 367 and 1,353 → 1,073 → 697 ms. Rendering
  the corpus in-process: ~95 ms (templateSets) + ~90 ms (templateSetsBr, the first bracket the EN / PT / ES sets don't know)
  + ~15 ms (templateTaskSet — toPtBr in an English process); reading the file: ~2 ms plus the stamp.

## Config paths: committable (relative) vs. host-installed (absolute)
Two distinct distribution targets, deliberately kept separate — never conflate them:

- **In-repo dotfiles are committable and portable.** They use relative / workspace-relative
  references, never a machine path, so `git clone`/download Just Works:
  - `mcp/servers.json` (referenced by `plugin.json` → `mcpServers`) → `${CLAUDE_PLUGIN_ROOT}/mcp/server.js` (env:
    `SPEC_PROJECT_DIR`, `SPEC_MCP_PROMPTS=off`, `SPEC_MCP_APPROVAL_HOOK=on` — 1.21: the plugin's hook guards approvals there).
    Only `command` / `args` / `env` (1.23 review 5): Claude Code substitutes `${…}` in a plugin stdio server's command, args and
    env only and documents no `cwd` field — the `"cwd": "${CLAUDE_PROJECT_DIR}"` it carried was ignored, and honoured
    unexpanded it would stop the server from starting; `SPEC_PROJECT_DIR` already names the project (and the server skips an
    unexpanded `${VAR}` — resolveProjectDir).
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
