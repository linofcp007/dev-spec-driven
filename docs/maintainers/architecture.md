# Architecture — layout, the module rule, config paths

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
The full layout, how the engine's modules load and link, the build, and where each config file points. The rules come
first; how they came to be — the releases and review findings — is in History at the end.

## Layout
```
.claude-plugin/plugin.json     manifest (skills, commands, mcpServers; NO hooks key — CLAUDE.md → Gotchas) · marketplace.json
mcp/servers.json               registers the `spec-driven` stdio server (plugin.json → mcpServers; NOT a root .mcp.json — Config paths)
skills/dev-spec-driven/SKILL.md the workflow — the decision-time rules, ≤ 5,000 words
skills/.../references/          read on demand — index.md lists every file; tool-catalog.md · track-checklists.md · workflows.md
                               hold what SKILL.md points to; tooling-reference.md every tool and doctor check id
commands/*.md                  22 slash commands (only /spec and /spec-bugfix model-invocable) — also the MCP prompts
agents/*.md                    5 subagents: `dev-spec-driven:spec-implementer` / `dev-spec-driven:spec-reviewer` (+ simplify
                               mode) / `dev-spec-driven:spec-verifier` (one finding) / `dev-spec-driven:spec-critic` (--deep) /
                               `dev-spec-driven:spec-simplifier`
evals/                         plugin evals for `claude plugin eval` (maintainer-side): triggering / negative cases and behavioural
                               ones (<case>/case.yaml + fixture.sh, built from evals/fixtures/ with this plugin's CLI); evals/README.md
mcp/server.js                  MCP stdio (JSON-RPC 2.0, newline-delimited), argument validation, every tools/call through the
                               operations table (`runTool`), the approval guard over MCP elicitation (its one async path)
mcp/lib/spec.js                the engine's FACADE — every surface requires it; each operation in ONE read-cache scope, the
                               mutators under the feature lock; the modules, or a current bundle with DEV_SPEC_BUNDLE=1
mcp/lib/operations.js          THE operations table (`OPERATIONS`): each operation's MCP tool, CLI commands, arguments and engine
                               call; requires nothing (mcp.md → The operations)
mcp/lib/probe.js               THE dev-spec project rule (`isDevSpecProject`) and the walks — Node core only: the hooks, the status
                               line, shell completion and the engine's `isDevSpecDir` (claude-code-integration.md)
mcp/lib/latin1-scan.js         the stop gate's claim scan on a one-byte projection of a wide text (`latin1Text`) — Node core only
mcp/lib/spec.bundle.js         GIT-IGNORED, built on demand (dev-spec bundle): the engine + i18n in ONE file (The build)
mcp/lib/engine/                ALL domain logic, one module per concern (The module rule):
  index.js · ctx.js            the loader (MODULES → the namespace E → __link(E)) · CTX, the shared per-call state
  core.js                      linear text scans, own-key lookup, globs, the _Implements:_ readers, calendar dates (today, dayOf)
  files.js                     paths, the write gate (create-only / atomic writes), JSON reads, the read cache, readFileHead,
                               path containment, the feature / roadmap locks, folder moves, resolveProjectDir
  state.js                     languages, the feature resolver, .state.json, PHASES, fingerprints, roadmap.json and its
                               writers, RE_AUTOGEN; the 3-way merge behind git's merge driver (mergeStateJson / mergeStateText)
  markdown.js                  comments, fences, headings, sections, AC / T-ID readers; the placeholder corpus
  corpus.generated.json        GENERATED (npm run build, committed): the built-in placeholder corpus (The build)
  tracks.js · classify.js      the track registries + SIGNALS (the classifier's data) · the Phase 0 classifier (CUE_KINDS…)
  packs.js · templates.js      track packs (.specs/tracks/) · project templates (.specs/templates/)
  scaffold.js                  spec_init, spec_create, skeletons, steering stubs, spec_add_track, scoped steering, amendments
  tasks.js                     the tasks.md scanner (taskBlocks), markers, _Depends:_ + waves, next / complete / append, the brief
  evidence.js                  the evidence gate (taskVerification), run shells, red → green, observed runs, project checks
  trace.js                     criterion blocks, the EARS linter, trace_check, the traceability matrix
  gates.js                     the gate walk, pending gates, flows, detectPhase; spec_approve; .history/, spec_impact
  doctor.js                    the check registry (DOCTOR_CHECKS, GATES, approvalChecks), spec_doctor, next_action, status,
                               the status line, the plan-mode bridge, isDevSpecDir, the DEV_SPEC_* defaults
  quality.js                   cross-feature ACs, glossary, trade-offs / risks / reuse, the constraint nudge, spec_clarify
  finish.js                    spec_finish, drift, remove / rename / archive / restore, _Supersedes:_, SPECS.md, metrics
  roadmap-md.js · decisions.js ROADMAP.md / .html, forecasts, overlaps · decisions.md, the ADR export, spikes
  export.js                    spec_export (markdown, HTML, Gherkin, CSV, changelog), milestones
  guards.js                    guard mode, the stop gate and its claim scan, the approval guard + shell lexer; CLI_SWITCHES
  upgrade.js · scan.js         spec_upgrade · the brownfield scan, coverage, the ONE notion of code / test file (isCodeFile)
  import/                      spec_import: index.js · common.js · kiro · speckit · openspec · plan · bmad · fluidplan · steering
mcp/lib/i18n.js · i18n/        the localized content: the facade (the tables, LAYOUTS — the structure every language shares)
                               + en.js · pt.js · es.js (each language's `text`) · common.js · pt-br.js (the derivation)
mcp/lib/prompts-resources.js   MCP prompts (= commands/*.md) + specs:// resources (read-only, confined)
mcp/evals/run-evals.js         local eval harness (ANTHROPIC_API_KEY; --dry-run offline)
mcp/test.js · mcp/tests/       the MCP suite: entry point + NN-<area>[-<topic>].js files + harness.js (testing.md → The suites)
cli/dev-spec.js                the CLI's entry point alone (`bin`, every printed CLI line, git's merge driver, the status line)
cli/main.js                    main(argv, io) → the exit code: the parser, the shared checks, the dispatch, `c.call`; no exit
cli/commands.js                THE command table (`COMMANDS`): options, arguments, completion, help, handler — everything else
                               derives from it (conventions.md → The CLI); `mcpConfigBlocks()`
cli/run.js · cli/git.js        done --run / finish --run (`execCommand`, `runVerdict`) · every git call (`gitRun`)
cli/completion.js · completion/ shell completion (+ the hidden `__complete`, before the engine loads) and the status line's
                               pre-check · the bash / zsh / fish / PowerShell templates (conventions.md → Shell completion)
cli/test-cli.js · cli/tests/   the CLI suite: entry point + NN-<area>-<topic>.js files + harness.js
scripts/                       build.js (npm run build; --check; --bundle) · test-runner.js (--only, --list) · test-docker.js
hooks/hooks.json               PreToolUse → guard-hook.js (Write|Edit|NotebookEdit|Bash|PowerShell|Monitor) + approval-hook.js
                               (approval tools, shells, Write / Edit / NotebookEdit, other MCP servers' file tools) ·
                               PostToolUse → spec-hook.js (Write|Edit) + observe-hook.js (Bash|PowerShell, async) + plan-hook.js
                               (ExitPlanMode) · PostToolUseFailure → observe-hook.js · SessionStart → spec-hook.js · Stop +
                               SubagentStop (^(dev-spec-driven:)?spec-(implementer|simplifier)$) → stop-hook.js
hooks/*-hook.js                guard (opt-in guard mode) · approval (opt-in human approval guard) · observe (logs _Verify:_ /
                               check runs, prints nothing) · spec (save checks + SessionStart lines) · stop (stale roadmap
                               refresh, then the evidence gate) · plan (the plan-mode bridge)
hooks/hook-utils.js            what the hooks share before the engine loads (probe.js re-exported, the claim pre-filter…)
hooks/precommit-check.js       optional git pre-commit validator (a stale ROADMAP.* / SPECS.md refreshed and re-staged)
hooks/stop-claims.generated.json GENERATED (npm run build, committed): the stop gate's claim patterns, the Stop hook's pre-filter
AGENTS.md · GEMINI.md · .cursor/ .windsurf/ .github/copilot-instructions.md   rule files for other tools · INTEGRATIONS.md
```

## The module rule
(The first half of **Three surfaces over ONE engine** — the engine-first rule and MCP / CLI parity — is in CLAUDE.md.)

The engine is plain CommonJS modules, one per concern, behind two facades: `spec.js` (the public object — the
`withReadCache` wrap of every function, the `featureLocked` mutators) and `i18n.js`. `mcp/lib/engine/index.js` loads
`MODULES` in order, merges every export into the namespace `E` (a name defined twice throws), then calls each module's
`__link(E)`. Inside the engine:
- **Load time — a DAG.** A name a module needs while it LOADS (a table or regex built from another module's constant —
  `RE_HEADING_LEAD` from `MARKER_TRACKS`, `featureLocked(setFeatureFlow)`, `C3_PARSERS`) comes from a destructured `require()`
  of its owner, marked `// load time`, whatever their order in `MODULES`. These requires form a DAG — a cycle would hand out a
  half-built `module.exports`.
- **Call time — any direction.** Every other name from another module is a bare `let` at the module's top, assigned by
  `__link(E)` once every module has loaded; call sites keep their bare names. Never read one while the module loads (it is
  `undefined` until `__link`). The `let` list and the `__link` destructure name exactly the same names, each exported by some
  module, never the parameter itself (`({ …, E } = E)` leaves the module's `E` undefined — and `E` IS a name, trace.js's
  word-boundary fragment); a module's private cache is a `let` WITH an initializer (`= null`), so it never reads as a link.
- **Exports — only what crosses the module's boundary.** `module.exports` lists the names something OUTSIDE the module
  uses: another module (its links or a load-time require), the facade, a surface (server.js, prompts-resources.js,
  operations.js, the CLI, the hooks, scripts/ — build.js renders from `E` —, the eval harness) or a test reaching an internal
  through `require("./lib/engine/index.js")`. Everything else is a private top-level `function` / `const`. To call another
  module's helper: export it from its owner, add it to your `let` list and `__link`; when its last outside user goes, drop the
  export (and the unused link). An export kept without an outside use goes into `EXPORT_ALLOW` with its reason (none today).
- **Shared mutable state is `CTX` (`engine/ctx.js`):** ONE object, mutated in place, never re-bound (a destructured copy goes
  stale) — what one engine call scopes (`CTX.READ_CACHE`, `CTX.GLOB_CACHE`, `CTX.XAC_MEMO`, `CTX.TEMPLATE_SCOPE_ROOT`,
  `CTX.TEMPLATE_MEMO`, `CTX.PACK_MEMO`, `CTX.GHOST_MARKERS`, reset by `withReadCache`; `CTX.BUILTIN_CORPUS_BUILD`). A module's
  own lazy caches (`TEMPLATE_SETS`, `PACK_CACHE`, `KW_RE`, `ENGINE_VERSION`…) stay private; a `let` another module reads moves
  into `CTX`.
- **A new module** goes into `MODULES`. `__dirname` in a module is `mcp/lib/engine/` (the clone's root is three levels up —
  `approvalGuardDecision`'s CLI path, `engineVersion`'s package.json). Every `mcp/lib` source requires only Node core or a
  relative file.
- **Checked from the sources** (mcp/tests/16-conventions.js, no parser): "1.18 module rule" — the `let` lists, the links, the
  load-time graph (acyclic, every engine → engine / i18n → i18n require marked), `MODULES` = the files, all loaded;
  "1.27 module boundaries" — (a) every linked name is used, (b) every export is used outside its module, (c) every facade key
  is read by a surface or a test and every engine name the facade takes is used.
- **Beside the engine:** a zero-dependency module a process needs WITHOUT the engine (~100 ms to load) lives in `mcp/lib/`
  and requires only Node core — `probe.js` (hook / status-line pre-checks; the engine reads it too), `latin1-scan.js` (the
  claim scan), `operations.js` (requires nothing: the surfaces hand it the facade). The bundle doesn't hold them.
- **Few, cohesive files.** Every hook and CLI call is a fresh process that loads the whole engine, and on Windows each file
  costs ~0.65 ms before any compile (the open is the expensive part): 22 modules (+ 9 in import/) of a few hundred to a few
  thousand lines, never one per helper. Add to the module of the concept; a new file must earn its load cost. The facade's
  first line enables Node's compile cache (`module.enableCompileCache()`, Node ≥ 22.8; `NODE_COMPILE_CACHE`,
  `NODE_DISABLE_COMPILE_CACHE=1`): it saves the compile of large modules but costs a cache-file read per module — a tiny module
  loads SLOWER with it. Measure by interleaving the variants in fresh processes, p50 + spread — never one run. On a slow file
  system the answer is the bundle (The build), never fewer, larger modules.
- **i18n** has the same shape: `i18n/en.js` / `pt.js` / `es.js` require `i18n/common.js` at load time and reach `BUILD` / `MSG`
  through `__link`. A language's file loads on the FIRST read of any table's entry for it (`loadLocale`) — a process pays only
  for the languages it speaks — so engine code needing a text of EVERY language reads the pre-generated corpus, never each
  language's table (`trackTaskHeadings` → `builtinTaskHeadings`). pt-BR is derived from pt on first use
  (`defineDerivedLocale`; `i18n/pt-br.js` loads only then — `ptbr()`); a group of raw entries (MSG `stopGate`, the claim
  patterns) is derived entry by entry, so the stop gate reads pt-BR's patterns without toPtBr.

## The build — the committed corpus, the on-demand bundle, and when to rebuild
`scripts/build.js` (Node core only):
- **`npm run build`** writes two COMMITTED files — the placeholder corpus `mcp/lib/engine/corpus.generated.json` and
  `hooks/stop-claims.generated.json` (the Stop hook's claim pre-filter: guards.js `stopClaimFilter()`, stamped with the sizes
  of `STOP_FILTER_SOURCES` — tasks-and-evidence.md → End-of-turn evidence gate). `npm run check` exits 1 while either is stale.
  Deterministic (sorted, no dates, LF; a CRLF / BOM checkout hashes the same) and version-free: the corpus is stamped
  `sources`, a sha1 over `CORPUS_SOURCES`, so a release that changes no source leaves both byte-identical. Both are
  `linguist-generated=true`. Never hand-edit; on a merge conflict take either side and rebuild.
- **When to rebuild:** after changing a file of `CORPUS_SOURCES` — `mcp/lib/i18n.js`, `mcp/lib/i18n/*.js`, `engine/core.js`,
  `markdown.js`, `packs.js`, `tasks.js`, `tracks.js` — or of `STOP_FILTER_SOURCES` (those i18n files and `engine/guards.js`);
  never for package.json's version alone. mcp/test.js ("1.20 build") fails with "run npm run build" until it is committed;
  meanwhile the runtime only goes slower.
- **The corpus** — the built-in placeholder sets (`templateSets()`, `templateSetsBr()`, `templateTaskSet()`, `bugStepSet()`),
  the built-in tracks' task headings in every language (`taskHeadings`) and every other all-language set a gate asks about
  (`steeringStubs` — hashes, `isSteeringStub()`; `diagrams` — `templateDiagramSet()`; `sectionLines` / `sectionLinesBr` —
  `sectionTemplateLines()`; `bugSlots` — `bugTemplateSlots()`; `templateReqs` — `builtinTemplateReqs()`, whose criteria
  quality.js `builtinTemplateAcs` reads live). The build renders it once (`renderCorpusData()`). **The rule for a new set:**
  an engine set built from EVERY language's texts belongs here — a process loads only the languages it speaks
  (mcp/tests/16-conventions-build.js "I-I2" asserts an English doctor / next_action / done / finish / catalog loads no pt.js,
  es.js or pt-br.js). A new builder or artifact goes into `templateCorpus()`, then rebuild. The per-project part (the
  project's templates and packs — `projectTemplateHas`, `packCorpusSets`) stays per call. Only `.has()` is asked of the sets.
- **The corpus is trusted only for the engine the process LOADED.** markdown.js stats every source as it loads
  (`LOADED_STATS`: size, mtime, ctime); the first placeholder question hashes them and trusts the file only while every stat
  is unchanged; a language file loaded later that changed drops it (`onLocaleLoad` → `localeLoaded`). So the long-lived MCP
  server under a `git pull` / `npm run build` keeps rendering from the code it runs. A missing, broken or stale file → it
  renders, never a wrong answer, only a slower one (`builtinCorpusSource()`: `file` · `bundle` · `render`). An edit keeping a
  source's size, mtime AND ctime is the accepted limit. `CORPUS_SOURCES` is proven with V8 coverage: a render that starts to
  depend on another mcp/lib file makes the test name it.
- **`dev-spec bundle [--out <file.js>]`** (or `npm run build:bundle`) writes the one-file engine, by default
  `mcp/lib/spec.bundle.js` — **git-ignored, never committed** (megabytes, stale after every engine change, a conflict on every
  merge, for an opt-in gain on slow file systems). The user builds it after each plugin update. It replaces an existing file
  only if that is a previous bundle (its `// GENERATED by scripts/build.js --bundle` header) or with `--force`
  (`cliOutput.bundleNotOurs`). Each engine and i18n module is its source VERBATIM inside a function run by a small registry
  (`moduleRegistry()`, emitted with `Function.prototype.toString`); `load(root)` keeps every module's ORIGINAL `__filename` /
  `__dirname`; a relative require resolves in the registry (else Node's loader at its original path), a bare one goes to
  Node — the load order, the DAG and `__link` are unchanged. Every module must start `"use strict";` (the build refuses it
  otherwise). The corpus rides inside (`module.bundle`). The bundle keeps its version stamp.
- **Which engine loads (`loadEngine()`):** the modules, unless `DEV_SPEC_BUNDLE=1` (`1` / `true` / `yes` / `on`;
  `DEV_SPEC_BUNDLE_PATH` — an absolute `.js` path, else ignored — names another file) AND the bundle is current: its version is
  package.json's and every module still has its built size and mtime (one `stat` each, no read). Missing, broken, stale or
  another version → the modules, silently; `spec.engineSource` records which and why, and `dev-spec version` shows it. An
  edit that keeps a module's size AND mtime is undetectable — rebuild after editing, or leave DEV_SPEC_BUNDLE unset. Build it
  where it runs (a bind mount may see other mtime precision: the bundle is then ignored).
- **Tests.** `libSources()` leaves `spec.bundle.js` out (the guards read scripts/build.js, where the registry is written).
  Both suites run on the modules (the harnesses drop every `DEV_SPEC_*` — testing.md → Hermetic chains) and BUILD a bundle
  into tmp: mcp/tests/16-conventions-build.js ("1.20 bundle" — the namespace, the corpus, the paths, every staleness case,
  the MCP server byte for byte) and cli/tests/16-conventions-bundle.js (one CLI + hooks session on the modules and on the
  bundle: the same output, exit codes and `.specs/` tree).

## Config paths: committable (relative) vs. host-installed (absolute)
Two distribution targets, never conflated:
- **In-repo dotfiles are committable and portable** — relative / workspace-relative, never a machine path:
  - `mcp/servers.json` (plugin.json → `mcpServers`) → `${CLAUDE_PLUGIN_ROOT}/mcp/server.js`, env `SPEC_PROJECT_DIR`,
    `SPEC_MCP_PROMPTS=off`, `SPEC_MCP_APPROVAL_HOOK=on`. Only `command` / `args` / `env`: Claude Code substitutes `${…}` there
    only and documents no `cwd` (the server skips an unexpanded `${VAR}` — resolveProjectDir). NEVER a root `.mcp.json`: opened
    as a normal project, this repo's root `.mcp.json` is a *project* server where `${CLAUDE_PLUGIN_ROOT}` is undefined.
  - `.vscode/mcp.json` → `${workspaceFolder}/mcp/server.js`; `.cursor/mcp.json`, `.gemini/settings.json` → `mcp/server.js`.
    `.vscode/mcp.json` is the one tracked file under `.vscode/` (`.vscode/*` then `!.vscode/mcp.json` — ignore by contents, not
    the dir, or git can't re-include it).
- **A USER's own project needs absolute paths**, generated on demand, never committed: `node cli/dev-spec.js mcp-config
  <client>` (`claude-desktop|claude-code|cursor|windsurf|vscode|gemini|codex|generic|all`) prints a config with the path
  resolved from `__dirname` (`mcpConfigBlocks()` in `cli/commands.js`); `integrations/*` carry the literal
  `/ABSOLUTE/PATH/TO/dev-spec-driven/…` placeholder. (There is **no** `install_host_context` symbol.)
- **Rule files the same way:** `node cli/dev-spec.js rules <cursor|windsurf|copilot|gemini|agents>` prints that tool's rule
  file with its bare `cli/dev-spec.js`, `mcp/server.js`, `AGENTS.md`, `skills/dev-spec-driven/…` and `references/…` paths made
  absolute. So the committed rule files keep those paths BARE (no `<clone>/` prefix), keep the "Paths in this file point into
  the dev-spec-driven clone" note true in the copy, and never talk about "the repo" — a test asserts all three.

## History
How the rules above came to be, section by section — grep a release (`1.21.1`) or a finding id (`r6 B8`) here.

### Layout
- **v1.11** — the MCP registration moved from a root `.mcp.json` to `mcp/servers.json` (see Config paths).
- **1.17 H** — the linear text scans now in core.js. **1.18** — the engine, one file until then, split into modules behind
  the facade `mcp/lib/spec.js` (the same keys as ever).
- **1.20** — the classifier's data became tracks.js `SIGNALS` with classify.js; packs.js; the build (corpus, bundle).
- **1.21** — SKILL.md capped at ~5,000 words, with tool-catalog.md · track-checklists.md · workflows.md beside it (F3).
  F1a: the semantic merge of the spec state behind git's merge driver. F1b: the approval guard over MCP elicitation.
- **1.21.1** — readFileHead (bounded reads for the code scans); the scan's one notion of code and of a test file.
- **1.22** — `dev-spec-driven:spec-simplifier` and the reviewer's simplify mode (/spec-review simplify).
- **1.24** — hooks/hook-utils.js. **r6 I-I1:** any spec save stamps ROADMAP.* / SPECS.md stale. **r6 I-I4:**
  hooks/stop-claims.generated.json.
- **1.25** — shell completion (cli/completion.js, cli/completion/), import/steering.js, the ADR export of decisions.md.
- **1.25.1 review 7** — the guard hook also guards shell writes (Bash / PowerShell / Monitor); the approval hook also
  matches NotebookEdit and another MCP server's file tools.
- **1.26** — the 55 commands folded into 22 (extending.md → The 1.26 command set); the reviewer's verify mode became
  `dev-spec-driven:spec-verifier`.
- **1.27** — mcp/lib/probe.js (one dev-spec project rule for every surface), mcp/lib/latin1-scan.js, mcp/lib/operations.js;
  the CLI split from one file into cli/dev-spec.js (the entry point alone, 44 lines), cli/main.js, cli/commands.js (the
  command table), cli/run.js, cli/git.js; the doctor check registry (`DOCTOR_CHECKS` / `GATES`, approvalChecks moved into
  doctor.js); the shared i18n layouts (`LAYOUTS`).

### The module rule
- **1.18** — the split and the rule (load-time DAG, `__link(E)`, `CTX`). Measured (Windows, Node 24, p50 of 40 interleaved
  fresh processes; 1.17 → the first split → with the compile cache and the lazy pt-BR): guard hook 220 → 260 → 238 ms,
  `dev-spec status` 211 → 243 → 224, SessionStart 345 → 380 → 364, the stop hook on a "done" claim 252 → 284 → 231. The
  compile cache: ~1.4 MB for the engine, one file per module; 36 one-line files load in 51 ms with it against 23 ms without;
  the first process after an update writes it (45–60 ms, once). The stop gate's first pt-BR claim scan compiles the word
  maps: ~17 ms. Per-file cost on Windows ~0.65 ms (stat, realpath, open + read).
- **1.22 review** — rendering the built-in tracks' task headings loaded pt.js, es.js and pt-BR into every English `list`
  (50–65 ms): they moved into the corpus.
- **1.27** — exports only what crosses a module's boundary: `E` went from 2,083 names (1,214 of them exported and used only
  inside their own module) to ~860; 80 facade keys are read only by tests. probe.js, latin1-scan.js and operations.js
  joined mcp/lib beside the engine.

### The build
- **1.19 → 1.20** — rendering the corpus (1,165 texts plus pt-BR's twins: ~200 ms) was the largest slice of a hook or CLI
  call (1.19's SessionStart ~20 % slower than 1.18's for it); 1.20 renders it at build time and adds the opt-in bundle.
- **1.20 review** — a long-lived process (the MCP server) under which `git pull` / `npm run build` rewrote the sources AND the
  corpus trusted the new file for old code: the trust became the sources hash checked against the stats taken at load.
- **1.20 measured** (p50 of interleaved fresh processes, a 6-feature EN / PT / ES project; base → the corpus file → + the
  bundle). Windows, Node 24: SessionStart 431 → 301 → 304 ms (CPU 608 → 311 → 296); a cold `require(spec.js)` 180 → 173 → 126 ms
  (the bundle without the compile cache: slower than the modules). Docker Desktop bind mount, node:24-alpine: `require`
  637 → 692 → 238 ms, SessionStart 1,278 → 914 → 557 ms (the staleness check ~96 ms of it — 38 stats, ~1 ms natively);
  node:18-alpine 742 → 665 → 367 and 1,353 → 1,073 → 697 ms. Rendering in-process ~95 ms (templateSets) + ~90 ms
  (templateSetsBr) + ~15 ms (templateTaskSet); reading the file ~2 ms. The bundle: 2.7 MB.
- **1.24 r6 I-I2 (review 6 finding I1)** — the other all-language sets (steering stubs, diagrams, section lines, bug slots,
  template requirements) joined the corpus: rendered on first use they loaded every language into English processes. The
  file grew from ~45 KB to ~129 KB (~0.8 ms to read). Measured (p50 of 11, a 52-feature English project, Windows 11, Node 24):
  doctor 423 → 339 ms, next-action 362 → 287, finish 382 → 314, catalog 364 → 296; status unchanged (214).
- **1.24 r6 I-I4** — the stop-claim filter, built with the corpus.
- **1.24 r6 B8** — `dev-spec bundle --out src/app.js` overwrote the user's file: now only a previous bundle, or `--force`.
  **1.24 r6 B-I1** — `spec.engineSource` records which engine loaded and why a bundle was skipped.
- **1.26** — no version in either generated file: until 1.25.1 both carried package.json's version, so every release
  rewrote them unchanged (and the runtime refused a current file stamped with another version). V8 coverage shows
  `engineVersion()`'s upgrade.js is outside the render, so the sources hash says everything the version could.

### Config paths
- **v1.11** — `mcp/servers.json` replaced the root `.mcp.json` (CONNECTION_CLOSED in every maintainer session).
- **1.21** — `SPEC_MCP_APPROVAL_HOOK=on` in the plugin's registration.
- **1.23 review 5** — the `"cwd": "${CLAUDE_PROJECT_DIR}"` it carried was dropped: ignored by Claude Code, and honoured
  unexpanded it would have stopped the server from starting.
