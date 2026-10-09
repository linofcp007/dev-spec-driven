# CLAUDE.md — maintainer notes for dev-spec-driven

Context for anyone (human or Claude) working on this plugin. Read this before changing the engine.

**This file is the index.** It is loaded into every Claude Code session in this repository, so it holds only the hard
constraints, the layout in brief and a topic map. The full notes live in `docs/maintainers/`, one file per area — they
are NOT loaded automatically (and never `@`-imported here: that would inline them into every session again).
**Before changing an area, read its topic file — the index is not enough.**

## What this is
A Claude Code **plugin** that unifies four spec-driven skills into one **track-based** skill, plus
a bundled **local, zero-dependency MCP server**. Hard constraints set by the owner:
- **No GitHub Actions / no paid CI / no pull requests.** All automation is local (hooks + the MCP
  server). Never add a `.github/workflows/` for this project, never open PRs — merge locally and push.
  No user-facing text may steer users toward PRs or CI (a test scans the prose; CHANGELOG is exempt).
- **Zero runtime dependencies.** The MCP server and all scripts use only Node core (`fs`, `path`, `os`,
  `string_decoder`, `child_process`, `crypto`, `module` — the compile cache —, built-in `fetch`). No `npm
  install` required. Keep it that way.
- Specs always live in `.specs/` (no alternate directory detection).

## Topic map
Read the file BEFORE you change its area (a section name another note cites — "see Gates" — is listed here too):
- **`docs/maintainers/architecture.md`** — before adding or splitting an engine module, changing what a surface requires,
  the build (the committed corpus, the on-demand bundle), or touching the MCP / rule-file configs: Layout (the full tree) · The module rule
  (1.18) · The build (1.20) · Config paths.
- **`docs/maintainers/tracks.md`** — before changing the classifier, a built-in track (+tdd … +dist, +api, +ui, +obs, +data) or
  track packs: The track model · Project-defined tracks (1.15) · Classifier gotchas · The classifier's signal rules, track
  by track.
- **`docs/maintainers/languages.md`** — before adding or rewording ANY user-facing string, a translated heading or a
  language: Languages (EN / PT-PT / PT-BR / ES) · Localization gotchas.
- **`docs/maintainers/mcp.md`** — before changing a tool's schema or description, a capability (prompts, resources,
  completions), argument validation, the stdio framing or the elicitation path: MCP tools · Capabilities · Human approvals over
  MCP elicitation (1.21) · Argument validation · Protocol (server-initiated requests).
- **`docs/maintainers/gates-and-approvals.md`** — before changing an approval gate, next_action's steps, placeholders,
  spec_impact / the approval history, roles, undo / revoke / waivers, flows, the bugfix kind or feature sizes / the change
  kind / the track sections' filled rule: Gates (1.13) · Approval fingerprints and pending gates · Change history · Team
  governance · Undo, revoke, waivers, MCP-only gates · Flows · Right-sized rigor (1.21 F5) · Bugfix and finish.
- **`docs/maintainers/tasks-and-evidence.md`** — before changing tasks.md parsing, the task brief, `_Verify:_` / evidence /
  `done --run`, `_Depends:_`, the stop gate, the scope guard or observed evidence: Subagent-driven execution · Evidence ·
  Task dependencies and execution waves · Tasks: ONE scanner · End-of-turn evidence gate and scope guard ·
  Harness-observed evidence.
- **`docs/maintainers/lifecycle.md`** — before changing the catalog, `_Supersedes:_`, finish baselines / drift, archive /
  restore, a feature's git branch (`create --branch`), spec_upgrade, decisions, spikes, forecasts / overlaps or the generated
  roadmap files: Catalog, drift, restore · A feature's own git branch · Upgrade · Decisions and spikes · Forecasts and
  cross-feature overlap · Roadmap files and dependencies.
- **`docs/maintainers/templates-imports-exports.md`** — before changing project templates, steering front matter, an
  importer or an export format: Project templates · Scoped steering · Import sources · Stakeholder export and release
  notes · Exports and planning.
- **`docs/maintainers/markdown-and-trace.md`** — before changing how spec markdown is read (EARS, AC / T-IDs, sections,
  fences, HTML comments), trace_check or the traceability matrix: Readers · Requirements traceability matrix.
- **`docs/maintainers/quality.md`** — before changing steering amendments, cross-feature criteria, the glossary, the
  design's trade-offs / risks / reuse checks, the constraint nudge or the brief's Reuse section: Spec quality · Design
  trade-offs and risks · Reuse & Integration and clean code.
- **`docs/maintainers/claude-code-integration.md`** — before changing a hook, a command name, guard mode, the approval
  guard, the status line, user defaults or the plan-mode bridge: Hooks and commands · Guard mode · Human approval guard ·
  Claude Code integration (1.16 C).
- **`docs/maintainers/conventions.md`** — before touching feature folders, `.state.json` / roadmap.json writes (or adding a key
  to them — the merge driver must know it), any write under .specs/ (the write gate, the 1.25 dry-run sink), the locks, process I/O or CLI flags / exit codes:
  Conventions & gotchas (resolver, the write gate, JSON state, merging the spec state — git's merge driver, 1.21 —, locks,
  rename, stdout, the CLI).
- **`docs/maintainers/testing.md`** — before adding a test (which file of `mcp/tests/` / `cli/tests/`), writing one that
  runs a command or depends on the file system, or running a part of a suite or the Linux / plugin-eval suites: The
  suites (files, runner, `--only`) · Tests (continued) — Docker, plugin evals, Windows AND Linux, the eval harness.
- **`docs/maintainers/extending.md`** — before adding an operation, a tool, a command, a track, an artifact, an importer,
  a CLI flag, a hook or a string: When extending (the checklists).

## Never ship a top-level `bin/`
Claude Desktop / claude.ai does not clone the repo: it validates it on a remote Anthropic service
that **rejects** any plugin shipping a top-level `bin/` (those files land on PATH in the CLI but are
invisible on the admin approval surface). The sync fails with `status=failed_content` and the UI
shows only "Marketplace sync failed. Check the repository URL" — which points nowhere near the cause.
The local CLI (`/plugin marketplace add`) uses `git clone` and does **not** apply this rule, so it
passes even when Desktop refuses; it is not a valid pre-check. Executable entry points go in `cli/`,
`hooks/`, `commands/` or `mcpServers`.

## Three surfaces over ONE engine
The engine (`mcp/lib/engine/`, behind its facade `mcp/lib/spec.js`) is the single source of truth. It is exposed three ways:
(1) the MCP server for MCP clients (its tools; the prompts are the command files and the resources read `.specs/` through
the engine's resolver), (2) the `dev-spec` CLI for any tool/terminal, (3) Claude Code skill+commands+hooks. Every surface
requires `mcp/lib/spec.js` — never an engine module directly.
When you add an operation, add it to the engine module of its concern first (see Layout), export it from the facade's
object in `spec.js`, then wire it into server.js (tool) AND
cli/dev-spec.js (subcommand) AND a test in the area's mcp/tests file. Keep the CLI and MCP behavior identical —
both call the same engine function with the same defaults (e.g. `roadmapReport()` backs `spec_roadmap`
and `dev-spec roadmap`; `approvePhase()` has one default approver, `$USER`/`$USERNAME`/`user`). A tool that folds
several CLI commands calls each one's function: `spec_roadmap_edit {kind: "depend"}` = `setDependency()` = `dev-spec depend`,
`spec_export {format: "catalog"}` = `catalog()` = `dev-spec catalog` (docs/maintainers/mcp.md → Folded tools).
Any user-facing string the operation GENERATES or RETURNS goes through `mcp/lib/i18n.js` (EN/PT/ES),
never hardcoded in the engine — see docs/maintainers/languages.md. The CLI's human output is localized too
(`cliText(lang)` over `i18n.msg(lang).cliOutput`: the feature's language for feature commands, the
project's otherwise). `--json` prints the same structured result the MCP tool returns: keys and stable
codes (`step`, `code`, `unverifiedReason`, check ids) never change, while message fields (`recommendation`,
`note`, `error`, doctor `detail`, finish `blockers`/`warnings`…) are in the feature's language, as on MCP.
`cliText` only localizes the human-readable CLI output.

**The module rule (1.18), in short:** a name an engine module needs at LOAD time comes from a destructured `require()`
marked `// load time` (an acyclic graph); every other one is a bare `let` bound by `__link(E)`; shared mutable state is
`CTX` (`engine/ctx.js`). A new module goes into `engine/index.js` `MODULES` — details: architecture.md → The module rule.

**i18n:** every user-facing string lives in `mcp/lib/i18n/*` — `en.js` · `pt.js` · `es.js` hold the same keys (EN is the
reference), assembled by the `mcp/lib/i18n.js` facade; pt-BR is DERIVED from pt (`i18n/pt-br.js`, `toPtBr`), never
written by hand. IDs and markers stay English-stable (languages.md). The one English-only output is the CLI's help text
(`--help`, `help <command>`'s command lines — `helpText()`), whatever `--lang` says; only `help <command>`'s frame lines follow the project language.

## Gotchas that bite in every area
- **Hooks: never reference `hooks/hooks.json` in `plugin.json`.** Claude Code auto-loads the standard
  `hooks/hooks.json` from the plugin root. Declaring `"hooks": "./hooks/hooks.json"` in the manifest
  loads it a SECOND time → `Duplicate hooks file detected` and the plugin fails to load hooks (the bug
  fixed in 1.9.1). `manifest.hooks` is ONLY for *additional* hook files at non-standard paths. Every entry is EXEC form
  (`"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/<x>.js"]` — no shell per spawn; Claude Code ≥ 2.1.139), never
  shell form (claude-code-integration.md → Hooks and commands).
- **Never write a literal U+FEFF into source.** The Edit tool can turn the escape `\uFEFF` inside a regex or string into
  the raw BOM character (invisible, and it breaks the match). Build it: `String.fromCharCode(0xfeff)` /
  `new RegExp("^" + String.fromCharCode(0xfeff))` (as prompts-resources.js does), or check the bytes after an edit.
- **Shell heredocs eat backslashes.** A `node - <<'EOF'` heredoc or `node -e '…'` through the Bash tool loses
  backslashes, and the engine and these notes are full of them (regexes, Windows paths). Edit escape-bearing code and
  text with the Edit / Write tools or a Write'd script file (`String.fromCharCode(92)` when a script must build a
  backslash), and check the bytes after moving text.
- **Changed templates / tracks / i18n — the corpus? Run `npm run build`** and commit the regenerated
  `mcp/lib/engine/corpus.generated.json` (the built-in placeholder corpus). Precisely: after changing a file of
  `CORPUS_SOURCES` — `mcp/lib/i18n.js`, `mcp/lib/i18n/*.js`, `engine/core.js` / `markdown.js` / `packs.js` / `tasks.js` /
  `tracks.js` (never for a version bump alone — 1.26: neither generated file carries the version); mcp/test.js fails until
  then, `npm run check` says whether both are current. The same build writes the committed
  `hooks/stop-claims.generated.json` (the Stop hook's claim pre-filter): rebuild after changing an i18n file or `engine/guards.js`
  too. Never edit either by hand. The one-file engine
  (`mcp/lib/spec.bundle.js`) is git-ignored and built on demand (`dev-spec bundle`) — never commit it (architecture.md → The build).

## Layout (brief — the full tree: docs/maintainers/architecture.md → Layout)
```
.claude-plugin/                plugin.json (NO hooks key) · marketplace.json
mcp/server.js                  the MCP stdio server: tools, prompts, resources, argument validation
mcp/servers.json               the plugin's MCP registration (plugin.json → mcpServers; never a root .mcp.json)
mcp/lib/spec.js                the engine's FACADE — every surface requires it, never an engine module directly
mcp/lib/spec.bundle.js         GIT-IGNORED, built on demand (dev-spec bundle): the engine in one file — DEV_SPEC_BUNDLE=1 only
mcp/lib/engine/                ALL domain logic, one module per concern (index.js loads MODULES; ctx.js holds CTX; import/;
                               corpus.generated.json — GENERATED: the built-in placeholder corpus)
mcp/lib/i18n.js · i18n/        the localized content: en.js · pt.js · es.js · common.js · pt-br.js (the derivation)
mcp/lib/prompts-resources.js   MCP prompts (= commands/*.md) + specs:// resources
cli/dev-spec.js                the universal CLI over the same facade (the same defaults as MCP)
hooks/                         hooks.json (auto-loaded) + guard / approval / observe / spec / stop / plan hooks + pre-commit
commands/ · agents/            the 22 slash commands (also the MCP prompts) · the 5 plugin subagents
skills/dev-spec-driven/        SKILL.md (the workflow — its source of truth) + references/ (read on demand)
evals/                         plugin evals for `claude plugin eval` (maintainer-side, local only)
mcp/test.js · cli/test-cli.js  the suites' entry points — their files: mcp/tests/ · cli/tests/ (NN-<area>…, + harness.js)
scripts/                       build.js (npm run build: the corpus; --bundle) · test-runner.js (both suites' runner: --only,
                               --list) · test-docker.js (both in Linux containers)
docs/maintainers/              these notes by topic — NOT loaded automatically; the topic map above says when to read each
AGENTS.md · GEMINI.md · .cursor/ · .windsurf/ · .github/copilot-instructions.md   rule files for other tools
```

## Tests
`node mcp/test.js` drives the full MCP handshake and exercises every tool, prompt and resource against a temp project
(2132 assertions, incl. a PT and an ES end-to-end scaffold, per-feature lang override, the prose guards —
README tool tables, rule files, no PR/CI steering — the behavioural eval fixtures, and a regression per review finding);
`node cli/test-cli.js` adds 610 for the CLI. The harness fails (exit 1) if the server dies or stops
answering — never let it drain to exit 0. Add an assertion when you add a tool or change behavior — in the file of its
AREA: `mcp/tests/NN-<area>.js` / `cli/tests/NN-<area>-<topic>.js` (NN is the area, the same in both; `--list` says what
each holds; `--only <file|area|NN>` runs a part, plus the files it needs — testing.md → The suites). Keep
it dependency-free. `node mcp/evals/run-evals.js <feature> --dry-run` validates the eval path offline.
Exact counts that change when a package adds a command, tool or template (22 command files, the tools/list length, the
template keys, the resource list) are asserted in place — update them in the same change. The source guards (no literal
U+FEFF, no `child_process`, no backslash-stripped regex literal, the roadmap's printed labels, no raw fs write outside
engine/files.js — the write gate, conventions.md) read every `mcp/lib` source
— the facades and all their modules (`libSources()` in mcp/tests/harness.js) — never a facade alone; never a built bundle
(its registry comes from scripts/build.js, which they read). Both suites run on the modules (the harnesses drop
`DEV_SPEC_BUNDLE`); the bundle's tests build one into tmp. Every chain is hermetic (1.26): a fresh empty temp folder as its
cwd, none of the shell's `SPEC_PROJECT_DIR` / `CLAUDE_PROJECT_DIR` / `DEV_SPEC_*` (but `DEV_SPEC_TEST_*`) — a test sets what it
needs for the process it starts, and never reads a path from `process.cwd()` (testing.md → Hermetic chains).
Linux containers (`npm run test:docker`), plugin evals and the cross-platform test rules: docs/maintainers/testing.md.
