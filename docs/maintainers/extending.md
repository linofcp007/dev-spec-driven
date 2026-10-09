# When extending — the checklists

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
What a new operation, tool, command, track, artifact, importer, CLI flag, hook or string must touch. The rules come first;
how they came to be — the releases and review findings — is in History at the end.

## When extending
- **New operation** → the engine module of its concern (see Layout; a new module only for a new concern — `engine/index.js`
  `MODULES`, each file costs load time) under the module rule, then its key in the `mcp/lib/spec.js` facade (`featureLocked`
  when it writes a feature) — every surface requires the facade, never a module. A name resolves through `resolveFeature()` /
  `existingFeature()`, never `path.join(specsRoot, slugify(name))`; state goes through `readJson()` / `writeFileAtomic` under
  the locks (conventions.md → Conventions & gotchas); every write goes through the write gate, never a raw `fs` write outside
  engine/files.js (a source guard fails it — conventions.md → The write gate).
- **An operation a surface exposes** → ONE entry of `OPERATIONS` in `mcp/lib/operations.js` (its header lists the fields —
  mcp.md → The operations): the tool (+ `mode` / `when`) and CLI commands that run it, its hidden aliases (`legacy`), how each
  engine option is read on each surface (`args`, `internal`, `cliOnly`) and `call(S, dir, o)` — THE engine call, written once.
  The server and the CLI read nothing else: no dispatch case, no hand-kept flag → option list. A positional engine signature
  with holes gets an options-object form (`createFeature(dir, {name, …})`, `completeTask(dir, {name, number, …})`).
- **New MCP tool** → the operation above; a `TOOLS` entry in `mcp/server.js` whose `inputSchema` IS the validation (EVERY
  argument the operation reads — an unlisted one is `unknown-argument`: mcp.md → Argument validation); a `TOOL_ANNOTATIONS`
  entry (mcp/test.js requires one per tool and snapshots `.specs/` around every read-only one); tests in the files of its area
  (testing.md → The suites) and the exact tool count (`mcp/tests/harness.js`); the README tool tables (EN/PT/ES — `mcp/test.js`
  builds the expected set from the live `tools/list`: a missing or phantom row in any language fails the suite); the counts
  the docs state (below); usually a thin command. Its description stays within the budget (mcp.md → The description budget).
- **Folding a tool into another, or renaming one** → the old name keeps working: a `LEGACY_TOOLS` entry in `mcp/server.js` (its
  OLD inputSchema, so old callers keep their refusals, and `args`, the translation) and its name in the `legacy` of the
  operation the call lands on; each mode of the new tool is an operation with its `mode` (`ARG_MODES` derives from them); the
  alias = new-tool assertion in `mcp/tests/02-mcp-server-tools.js`; every doc naming the old tool (mcp.md → Folded tools).
- **New slash command** → first ask whether it is a subcommand of an existing one: every file costs the user's `/` menu and,
  if model-invocable, the shared listing budget (claude-code-integration.md → 22 commands). If not: `commands/<name>.md` with a
  `description` (one English line, ≤ 125 characters), an `argument-hint` ≤ 130 characters (the body lists every flag; none
  when it takes no argument, never an empty one — `mcp/tests/17-docs-identifiers.js`), `disable-model-invocation: true` (only
  `/spec` and `/spec-bugfix` are model-invocable — mcp/tests/10-guards-guard-downs.js) and a lean body
  (claude-code-integration.md → Lean bodies). It is an MCP prompt too: the exact set in `mcp/tests/17-docs.js` and the counts
  change with it. Never a Claude Code built-in name.
- **The counts the docs state** — every tools / commands / prompts / agents count in the READMEs, INSTALL, llms-install,
  INTEGRATIONS, integrations/README, AGENTS and CONTRIBUTING is the live one (`mcp/tests/17-docs-flows.js` reads each
  phrasing, EN / PT / ES). A new CLI command also goes into the three READMEs' CLI summary, a new doctor check id into
  `references/tooling-reference.md`'s spec_doctor list.
- **New doctor check** (or a check an approval refuses on) → ONE entry of `DOCTOR_CHECKS` in engine/doctor.js (its header lists
  the fields — gates-and-approvals.md → Gates): `id`, `phase` (`CHECK_PHASE` derives from it), `applies` / `run` over the
  shared context (a view others need too → `CHECK_VIEWS`) and, when an approval must refuse on it, a `gate` probe plus its
  place in `GATES[phase]`; its strings in the i18n tables. Never a check outside the registry: mcp/tests/06-gates-registry.js
  resolves every id doctor emits and every id a gate refuses on to ONE entry.
- **New track** → a TEAM's track is a track pack (`.specs/tracks/<name>/`, no code — see Project-defined tracks); a BUILT-IN
  one → The track model (registries and classifier `SIGNALS` in `engine/tracks.js`, its template tasks in `TRACK_TASK_PLAN` of
  `mcp/lib/i18n.js`, its words in each language's `text`), its sections' `tier`, any `TRACK_OVERLAPS` / `TRACK_TASK_OVERLAPS` /
  `CORE_SUPERSEDED_BY` entry; no section name or synonym may start another section's (`sectionOverlaps()`).
- **New artifact** → the resource allowlist, `TEMPLATE_ARTIFACTS` (`engine/templates.js`) and `templateCorpus()`
  (`engine/markdown.js`) if it has slots.
- **A size-aware builder** → its `a.size` branch in the layout (`LAYOUTS`), NEVER a change to the no-size text (the pinned sha1
  in mcp/tests/06-gates-sizes.js — update it only when the no-size scaffold changes on purpose), and its sized renders in
  `templateCorpus()` (then `npm run build`) and `glossBuiltinLines()`.
- **New import source** → a parser `engine/import/<tool>.js` returning the import model (`newImportModel()`; reuse
  import/common.js's readers), in `MODULES`; its `IMPORT_TOOLS` and `C3_PARSERS` entries (+ `TEXT_IMPORT_TOOLS` for a single
  document); the `tool` enum of `spec_import`, the CLI's `import` entry, tests. A source that is no feature
  (`STEERING_IMPORT_TOOLS`) is dispatched by `importRun` before the feature path and reads through `importSourceAt` too. Every
  import is dry-runnable for free (`withDryRun`) while it writes and reads back through the files.js primitives.
- **A dry run of another operation** → wrap it in `withDryRun` (conventions.md → The dry-run sink); every read of what it wrote
  goes through readRaw / existsRaw / readDirCached / safeReaddir / isDirSafe — a raw fs read sees the disk, not the sink; add
  a parity test (the dry answer = the real call's, the tree byte-identical).
- **A new reader of the track registries** → the accessors (`allTracks()`, `optionalTracks()`, `markerTracks()`,
  `trackMarker()`, `trackSectionTable()`, `trackSteeringFiles()`, `trackSignalTable()`), never the built-in constants, which
  miss the project's track packs (only the process-wide template corpus and `spec_tracks list`'s built-in lists read them).
- **New CLI command** → ONE entry of `COMMANDS` in cli/commands.js (its header lists the fields), in the help's order: its
  `options` (any other flag is refused), completion specs, `help` lines (byte for byte what `help` prints) and `run(c)` —
  synchronous, a promise only where it waits, never an `async` function. The flag checks, the help, the completion scripts
  and `checkCommandArgs()` read the table (conventions.md → The CLI is one table and one call;
  cli/tests/16-conventions-cli-modules.js checks the entry). A command wrapping an operation runs `c.call(id, given)`, `given`
  holding only what the handler parses (`parsed`) or sets (`internal`) — never the facade function directly
  (cli/tests/02-surfaces-parity.js), so the engine call is the MCP tool's, with the same defaults.
- **New CLI switch** (no value) → `CLI_SWITCHES` in `mcp/lib/engine/guards.js` (the CLI and the approval hook's lexer read
  it); a new **value flag** → `VALUE_FLAG_SPECS` in cli/commands.js (completion `values` by `@source` where the facade has
  the list, never copied; `repeatable: true` when a command reads EVERY occurrence — any other given twice is a usage error).
  Either → the `options` of every command that reads it and, when it fills an engine option, that option's `cli` in the
  operations table (a switch `type: "switch"` / `"bool"`, a repeatable one `"list"`).
- **A tool argument that is a string OR a true/false switch** (`spec_create {branch}`) → `type: "string"`, never a list-valued
  type (mcp.md → Argument validation), + its key in server.js `BOOL_STRING_ARGS`, the engine reading `"true"` / `"false"`;
  its CLI flag → `optional: true` in `VALUE_FLAG_SPECS` (a bare `--branch` is `true`), never `CLI_SWITCHES`.
- **New `.state.json` / `roadmap.json` key** → decide how two branches merge it (conventions.md → Merging the spec state): an
  append-only list or a keyed map gets its rule in state.js (`mergeFeatureState`'s `FIELDS`, `ROADMAP_FIELDS`, `META_FIELDS`);
  a plain value needs nothing (3-way per key: both sides changed it differently = a conflict the user resolves).
- **New hook** → `hooks/hooks.json` (never `plugin.json`), silent and exit 0 on any error, the engine loaded only after a cheap
  raw pre-check, a row in `references/tooling-reference.md`; its process I/O per conventions.md → Flush stdout before exiting
  (claude-code-integration.md → Hooks and commands has the rest).
- **Any user-facing text** → the same key in `mcp/lib/i18n/en.js`, `pt.js` and `es.js` (a scaffold's structure in the
  `i18n.js` layouts — languages.md → Languages), the lang from `featureLang()` / `projectLang()`, IDs and markers
  English-stable. A line telling someone to RUN the CLI is `${DEV_SPEC} <command> …`, never a bare `dev-spec <command>`; text
  for a committed file goes through `i18n.portableCli()` (languages.md → Runnable CLI lines); a command file writes
  `node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" …`.
- **A change to a file of `CORPUS_SOURCES`** (the i18n files, `engine/core.js`, `markdown.js`, `packs.js`, `tasks.js`,
  `tracks.js`) → `npm run build`, and commit the regenerated `mcp/lib/engine/corpus.generated.json` and
  `hooks/stop-claims.generated.json` (`STOP_FILTER_SOURCES` adds `engine/guards.js`) — architecture.md → The build; mcp/test.js
  fails until you do. A version bump alone needs no rebuild. A module the corpus render starts to run through joins
  `CORPUS_SOURCES` (the V8-coverage test names it). Never commit `mcp/lib/spec.bundle.js`.
- **Renaming or removing a code identifier** → fix the notes citing it: `mcp/tests/17-docs-identifiers.js` fails on a backticked
  name in CLAUDE.md or `docs/maintainers/*.md` that no code file holds (a name from outside the code goes into its allowlist).
- **SKILL.md stays the source of truth for the workflow** — the rules an agent needs at decision time, ≤ 5,000 words
  (`mcp/tests/01-core.js`; loaded whole every time the skill fires). Lookup material goes into `references/` with a one-line
  pointer ("read X when Y"), every file listed in `references/index.md` (a test fails on an orphan). A rule agents need even
  when they skip the skill also goes into the MCP tool description that acts on it. Commands stay thin.

## History
How the rules above came to be, section by section — grep a release (`1.21.1`) or a finding id (`M8`, `r6 B3`) here.

### When extending
- **1.16** — a `TOOL_ANNOTATIONS` entry per tool, required by mcp/test.js, which snapshots `.specs/` around every read-only one.
- **1.20** — the maintainer notes left CLAUDE.md for docs/maintainers/ (this checklist with them); the committed corpus and
  its build.
- **1.21** — a built-in track declares its sections' `tier` and its `TRACK_OVERLAPS` / `TRACK_TASK_OVERLAPS` /
  `CORE_SUPERSEDED_BY` entries; SKILL.md gets a 5,000-word cap that `mcp/tests/01-core.js` counts (F3).
- **1.21 F5** — sized scaffolds: the size branch must leave the no-size text byte-identical (the pinned sha1).
- **1.23 review** — a CLI command refuses every flag outside its own `options`.
- **1.24 review 6** — the counts the docs state had drifted (INTEGRATIONS.md still said 51 prompts at 55, integrations/README.md
  34 tools at 38): `mcp/tests/17-docs-flows.js` reads every one.
- **1.24 review 6, F7** — no section name or synonym may start another section's; `sectionOverlaps()` checks it.
- **1.24 r6 B5** — a value flag given twice is a usage error unless the flag is `repeatable` (a command reading every occurrence).
- **1.25** — a source that is no feature (steering, `STEERING_IMPORT_TOOLS`) joins the importers; the string-or-switch argument
  (`spec_create {branch}`, `--branch`) and `BOOL_STRING_ARGS`.
- **1.25.1 review** — the argument-hint rule (none empty, none past 130 characters); tracks.md still named six classifier
  constants the 1.20 cue rules had replaced, so `mcp/tests/17-docs-identifiers.js` checks every backticked identifier of the notes.
- **1.26** — tools folded into others behind hidden aliases (`LEGACY_TOOLS`, the modes); the 55 slash commands folded into 22
  (the table below); the corpus stopped carrying the version, so a version bump alone no longer needs a rebuild.
- **1.27** — one operations table (`OPERATIONS`, mcp/lib/operations.js) both surfaces run through and one CLI command table
  (`COMMANDS`, cli/commands.js) replace the server's dispatch cases and the CLI's hand-kept flag → option lists; createFeature /
  completeTask take an options object; one check registry (`DOCTOR_CHECKS`, `GATES`) for doctor and the approval gates; the
  shared i18n layouts, so a size branch or a track's task plan is written once.

### The 1.26 command set (old → new)
1.26 folded the 55 slash commands into 22 (claude-code-integration.md → 22 commands, 2 of them model-invocable). There are
no stubs for the old names — this table is the migration (the README and the release notes reuse it). A subcommand is the
first word after the feature, or the first word when the command takes no feature.

| Old command(s) | New command |
|---|---|
| `/spec`, `/next-action`, `/classify`, `/createSpec`, `/design`, `/testPlan`, `/evalPlan`, `/writeTests`, `/createTask` | `/spec [feature or idea] [phase]` — no feature: Phase 0; a feature: resumes at `spec_next_action`'s step; a phase (requirements · design · test-plan · eval-plan · tests · tasks): that phase |
| `/spec-bugfix` | `/spec-bugfix` (unchanged, model-invocable) |
| `/ds`, `/dss`, `/dsx` | unchanged — aliases of `/spec`, `/spec-status`, `/executeTask` |
| `/clarify`, `/grill` | `/clarify [feature]`, `/clarify [feature] --grill` |
| `/approve`, `/spec-ff` | `/approve [feature] [phase]`, `/approve [feature] --through <phase>` (also `--role`, `--force`, `--revoke`) |
| `/spec-doctor` | `/spec-doctor [feature] [--deep]` |
| `/executeTask`, `/spec-commit` | `/executeTask [feature or task number] [--subagents]`, `/executeTask commit [note]` |
| `/spec-status` | `/spec-status` |
| `/roadmap`, `/depend`, `/backlog`, `/spec-milestone` | `/roadmap [--write] [--html]`, `/roadmap depend …`, `/roadmap backlog …`, `/roadmap milestone …` |
| `/prReview`, `/spec-converge`, `/spec-simplify`, `/spec-review-feedback`, `/promptReview` | `/spec-review [feature] branch`, `… converge`, `… simplify [--subagents]`, `… feedback <comments>`, `… prompt` |
| `/spec-finish` | `/spec-finish` |
| `/spec-spike` | `/spec-spike` |
| `/spec-impact`, `/spec-decide`, `/add-track` | `/spec-change [feature] impact [phase] [--reopen]`, `… decide <decision>`, `… track +x` / `… track -x` |
| `/feature` | `/feature` (archive · restore · rename · remove · flow) |
| `/spec-catalog`, `/spec-drift`, `/spec-metrics`, `/spec-changelog`, `/spec-export` | `/spec-report catalog`, `… drift`, `… metrics`, `… changelog`, `… export` |
| `/scan`, `/reverse`, `/coverage`, `/spec-import` | `/spec-adopt scan`, `… reverse`, `… coverage`, `… import` |
| `/spec-init`, `/spec-guard`, `/spec-statusline`, `/spec-superpowers`, `/spec-templates`, `/spec-tracks` | `/spec-setup init`, `… guard`, `… statusline`, `… superpowers`, `… templates`, `… tracks` |
| `/eval`, `/migrateModel` | `/eval [feature] run`, `… baseline`, `… migrate <target model>` |
| `/spec-upgrade` | `/spec-upgrade` |
| `/spec-tour` | `/spec-tour` — now a size-xs change (one `change.md`, ONE plan approval) |
