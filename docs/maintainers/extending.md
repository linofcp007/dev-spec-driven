# When extending — the checklists

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
What a new operation, tool, command, track, artifact, importer, CLI flag, hook or string must touch.

## When extending
- New operation → the engine module of its concern (`mcp/lib/engine/<concern>.js`, see Layout; only a genuinely new
  concern is a new module — listed in `engine/index.js` `MODULES`, each file costs load time), under the module rule
  (load-time imports marked `// load time` and acyclic, in either direction of `MODULES`; every other name through
  `__link`, in the module's bare `let` list AND its `__link` destructure; shared mutable state in `CTX`), then its key in
  the facade object of `mcp/lib/spec.js`
  (wrapped in `featureLocked` when it writes a feature) — every surface requires the facade, never a module. A name it
  takes resolves its folder through `resolveFeature()` / `existingFeature()`, never `path.join(specsRoot, slugify(name))`,
  and its state goes through `readJson()` / `writeFileAtomic` under the locks (conventions.md → Conventions & gotchas).
  Every file it writes goes through the write gate — `writeFileAtomic` / `writeIfAbsent` / `ensureDir` / `specWrite` (append),
  never a raw `fs.writeFileSync` / `appendFileSync` / `renameSync` / `mkdirSync` outside engine/files.js (a source guard
  fails it — conventions.md → The write gate).
- New MCP tool → the operation above, a TOOLS entry + dispatch case in
  `mcp/server.js` (its `inputSchema` IS the validation — declare types, enums, required keys, and EVERY argument the
  dispatch reads: one the schema doesn't list is refused, `unknown-argument` — mcp.md → Argument validation), the CLI
  subcommand, a test in the file of its area in `mcp/tests/` and `cli/tests/` (testing.md → The suites; bump the exact
  tool count — the handshake's, `mcp/tests/harness.js`), the README tool tables (EN/PT/ES —
  `mcp/test.js` builds the expected set from the live `tools/list`: a missing or phantom row in any language fails
  the suite) of README.md, README.pt.md and README.es.md, a `TOOL_ANNOTATIONS` entry in `mcp/server.js` (1.16 — mcp/test.js requires one per tool and snapshots `.specs/`
  around every read-only one), the tool count every doc states (below), and (usually) a thin command in `commands/`.
- Folding a tool into another or renaming one (1.26) → keep the old name working: a `LEGACY_TOOLS` entry in `mcp/server.js`
  (its OLD inputSchema — old callers keep their refusals — and `args`, the translation to the new tool), never a `runTool` case;
  arguments that belong to one mode of the new tool → its `ARG_MODES` entry (refused elsewhere: `inapplicable-arguments`); the
  alias = new-tool assertion in `mcp/tests/02-mcp-server-tools.js`; every doc that names the old tool (mcp.md → Folded tools).
  A description stays within the budget (mcp.md → The description budget: `TOOLS_LIST_CAP`).
- New command → first ask whether it is a subcommand of an existing one (1.26 folded 55 commands into 22 — the table below;
  every command file costs the user's `/` menu and, if model-invocable, the shared listing budget). If it is one: a
  `commands/<name>.md` with `description` (one English line, ≤ 125 characters) + `argument-hint` front matter (the hint ≤ 130
  characters — autocomplete cuts a longer one, the body lists every flag; no hint at all when the command takes no argument,
  never an empty one — 1.25.1 review, `mcp/tests/17-docs-review7.js`) + `disable-model-invocation: true` (only `/spec` and
  `/spec-bugfix` are model-invocable — mcp/tests/10-guards-review6.js; claude-code-integration.md → 22 commands) + a lean body
  (claude-code-integration.md → Lean bodies); it is automatically an MCP prompt too (the exact command set in
  `mcp/tests/17-docs.js`, the counts in `mcp/tests/17-docs-review7.js` and the README command lists). Never a Claude Code
  built-in name.
- **The counts the docs state** (1.24 review 6 — INTEGRATIONS.md still said 51 prompts at 55, integrations/README.md 34
  tools at 38): README.md / README.pt.md / README.es.md, INSTALL, llms-install, INTEGRATIONS, integrations/README, AGENTS and CONTRIBUTING are read by
  `mcp/tests/17-docs-review6.js` — every "N tools / ferramentas / herramientas", "N (slash) commands", "Commands (N)", the
  prompts' "N of them, read from `commands/*.md`" and "N agents" must be the live tools/list length, command files and agent
  files. A new CLI command goes into the CLI summary of the three READMEs (the same file checks it against the CLI's
  command table), a new doctor check id into `references/tooling-reference.md`'s spec_doctor list (checked against the ids
  the engine emits).
- New track → a TEAM's track is a track pack (`.specs/tracks/<name>/`, no code — see Project-defined tracks); a BUILT-IN
  one → The track model (registries and its classifier `SIGNALS`: `engine/tracks.js`, the classifier code in `engine/classify.js`; its builders in the
  `i18n/<lang>.js` files) — 1.21: its sections' `tier`, any `TRACK_OVERLAPS` / `TRACK_TASK_OVERLAPS` / `CORE_SUPERSEDED_BY`
  entry (data only); no section name / synonym may start another section's (`sectionOverlaps()` — 1.24 review 6, F7). New artifact → the resource allowlist, the template allowlist
  (`TEMPLATE_ARTIFACTS`, `engine/templates.js`) and `templateCorpus()` (`engine/markdown.js`) if it has slots.
- A size-aware builder (1.21 F5) → the `a.size` branch in EN / PT / ES, NEVER a change to the no-size text (the pinned
  sha1 in mcp/tests/06-gates-sizes.js fails otherwise — update it only when the no-size scaffold changes on purpose), and
  its sized renders in `templateCorpus()` (then `npm run build`) and in `glossBuiltinLines()`.
- New import source → a parser module `engine/import/<tool>.js` (returns the import model — `newImportModel()`,
  `import/common.js` — from the source's text; reuse the shared readers there and plan.js's plan-text helpers), listed in
  `MODULES`; in `engine/import/index.js` its entry in `IMPORT_TOOLS` and `C3_PARSERS` (+ `TEXT_IMPORT_TOOLS` when it
  reads a single document); the `tool` enum of `spec_import` in `mcp/server.js`, the CLI's `import` usage, and tests. A source
  that is no feature (1.25: steering — `STEERING_IMPORT_TOOLS`, import/steering.js) is dispatched by `importRun` before the
  feature path; it reads through `importSourceAt` too. Every import is dry-runnable for free (`withDryRun`) as long as it
  writes and reads back through the files.js primitives.
- A dry run of another operation → wrap it in `withDryRun` (engine/files.js — conventions.md → The dry-run sink) and make every
  read of what it wrote go through readRaw / existsRaw / readDirCached / safeReaddir / isDirSafe; add a parity test (dry answer
  = the real call's, the tree byte-identical) — a raw fs read of a file it wrote would see the disk, not the sink.
- A new reader of the track registries → the accessor functions (`allTracks()` / `optionalTracks()` / `markerTracks()` /
  `trackMarker()` / `trackSectionTable()` / `trackSteeringFiles()` / `trackSignalTable()`), never the built-in constants —
  those miss the project's track packs (only the process-wide template corpus and the built-in lists of `spec_tracks list`
  read the constants on purpose).
- New CLI command (1.27) → ONE entry of `COMMANDS` in cli/commands.js, in the help's order: `name` (+ `aliases`), `options` (the
  flags it reads — 1.23 review: any other is refused), `max` positionals, `bounds` (an integer flag's largest value), the
  completion specs `args` (per position: words or an `@source` — feature names, phases, tracks…) / `sub` (positions a first word
  picks) / `values` (a flag's values for THIS command), `text: true` when it prints text only, its `help` lines (`  <name> …` at two
  spaces, then the description from column 35 — byte for byte what `help` prints) and `run(c)`, the handler (synchronous; a promise
  only where it waits — never an `async` function). Nothing else to touch: the flag checks, `help` / `help <command>`, the
  completion scripts and `checkCommandArgs()` read the table (conventions.md → The CLI is one table and one call;
  cli/tests/16-conventions-cli-modules.js checks the entry). The engine call it makes is the MCP tool's, with the same defaults.
- New CLI switch (a flag that takes no value) → `CLI_SWITCHES` in `mcp/lib/engine/guards.js`, exported as
  `spec.CLI_SWITCHES` (the CLI's `BOOL_FLAGS` and the approval hook's lexer both read it); a new value flag → `VALUE_FLAG_SPECS`
  in cli/commands.js (with its completion `values` where the set is known — a list the facade has is named by its `@source`
  (`completionModel()`), never copied —, `repeatable: true` when a command reads EVERY occurrence with `c.every()` — 1.24 r6 B5:
  any other one given twice is a usage error). Either one → the `options` of every command entry that reads it.
- A tool argument that is a string OR a true/false switch (1.25 `spec_create {branch}`) → `type: "string"` (never a list-valued
  type — mcp.md → Argument validation) + its key in server.js `BOOL_STRING_ARGS`, the engine reading `"true"` / `"false"`; a CLI
  value flag whose value is optional → `optional: true` in `VALUE_FLAG_SPECS` (as `--branch`: a bare one is `true`), never
  `CLI_SWITCHES`.
- New `.state.json` / `roadmap.json` key → decide how two branches merge it (conventions.md → Merging the spec state): an
  append-only list or a keyed map gets its rule in state.js (`mergeFeatureState`'s `FIELDS`, `ROADMAP_FIELDS`, `META_FIELDS`);
  a plain value needs nothing (3-way per key — both sides changed it differently = a conflict the user resolves).
- New hook → `hooks/hooks.json` (never `plugin.json` — CLAUDE.md → Gotchas that bite in every area), silent and exit 0 on
  any error, the engine loaded only after a cheap raw pre-check (roadmap.json / the payload), and a row in
  `references/tooling-reference.md`. Its process I/O follows conventions.md → Flush stdout before exiting (stdin read
  asynchronously, the exit only in the write callback) — claude-code-integration.md → Hooks and commands has the rest.
- Any generated/returned user-facing text → put the strings in the i18n tables for every language — the same key in
  `mcp/lib/i18n/en.js`, `pt.js` and `es.js` (pt-BR inherits PT unless it needs its own wording, `i18n/pt-br.js`) — and
  resolve the lang via `featureLang()`/`projectLang()`; keep IDs/markers English-stable. A message that tells someone
  to RUN the CLI writes `${DEV_SPEC} <command> …` (the runnable `node "<clone>/cli/dev-spec.js"`, i18n/common.js), never a
  bare `dev-spec <command>`; text written into a committed file goes through `i18n.portableCli()` (languages.md →
  Runnable CLI lines). A command file that hands the user a CLI line writes `node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" …`.
- A change to a file of `CORPUS_SOURCES` — `mcp/lib/i18n.js`, `mcp/lib/i18n/*.js` (a template, a string), `engine/core.js`,
  `markdown.js`, `packs.js`, `tasks.js`, `tracks.js` (a track) — never a version bump alone (1.26) → `npm run build`, and commit
  the regenerated `mcp/lib/engine/corpus.generated.json` with it (architecture.md → The build; mcp/test.js fails until you
  do). A module that the corpus render starts to run through goes into `CORPUS_SOURCES` (the V8-coverage test names it).
  Never commit `mcp/lib/spec.bundle.js` (git-ignored, built on demand).
- Renaming or removing a code identifier → the maintainer notes that cite it: `mcp/tests/17-docs-review7.js` fails on a
  backticked name — CONST_CASE, camelCase, a call like foo() or PascalCase — in CLAUDE.md or `docs/maintainers/*.md` that no
  code file holds (1.25.1 review: tracks.md still named six classifier constants the 1.20 cue rules had replaced). A name
  from outside the code (a Claude Code settings key) goes into that test's allowlist.
- Keep `SKILL.md` the source of truth for the workflow — the rules an agent needs at decision time, ≤ 5,000 words
  (1.21: `mcp/tests/01-core.js` counts them; it is loaded whole every time the skill fires). Lookup material goes into
  `references/` with a one-line pointer ("read X when Y"): the tool catalog (`tool-catalog.md`), per-track material
  (`track-checklists.md`), supporting commands (`workflows.md`), and every reference file is listed in
  `references/index.md` (a test fails on an orphan). A rule agents need even when they skip the skill also goes into
  the MCP tool description that acts on it. Commands stay thin.

## The 1.26 command set (old → new)
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
