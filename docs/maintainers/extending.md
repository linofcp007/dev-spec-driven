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
  `mcp/server.js` (its `inputSchema` IS the validation — declare types, enums, required keys), the CLI
  subcommand, a test in the file of its area in `mcp/tests/` and `cli/tests/` (testing.md → The suites; bump the exact
  tool count — the handshake's, `mcp/tests/harness.js`), the README tool tables (EN/PT/ES —
  `mcp/test.js` builds the expected set from the live `tools/list`: a missing or phantom row in any language fails
  the suite), a `TOOL_ANNOTATIONS` entry in `mcp/server.js` (1.16 — mcp/test.js requires one per tool and snapshots `.specs/`
  around every read-only one), and (usually) a thin command in `commands/`.
- New command → a `commands/<name>.md` with `description` + `argument-hint` front matter; it is automatically an MCP
  prompt too (bump the exact command count in `mcp/tests/17-docs.js` and the README command lists). Never a Claude Code built-in
  name.
- New track → a TEAM's track is a track pack (`.specs/tracks/<name>/`, no code — see Project-defined tracks); a BUILT-IN
  one → The track model (registries and its classifier `SIGNALS`: `engine/tracks.js`, the classifier code in `engine/classify.js`; its builders in the
  `i18n/<lang>.js` files) — 1.21: its sections' `tier`, any `TRACK_OVERLAPS` / `TRACK_TASK_OVERLAPS` / `CORE_SUPERSEDED_BY`
  entry (data only). New artifact → the resource allowlist, the template allowlist
  (`TEMPLATE_ARTIFACTS`, `engine/templates.js`) and `templateCorpus()` (`engine/markdown.js`) if it has slots.
- A size-aware builder (1.21 F5) → the `a.size` branch in EN / PT / ES, NEVER a change to the no-size text (the pinned
  sha1 in mcp/tests/06-gates-sizes.js fails otherwise — update it only when the no-size scaffold changes on purpose), and
  its sized renders in `templateCorpus()` (then `npm run build`) and in `glossBuiltinLines()`.
- New import source → a parser module `engine/import/<tool>.js` (returns the import model — `newImportModel()`,
  `import/common.js` — from the source's text; reuse the shared readers there and plan.js's plan-text helpers), listed in
  `MODULES`; in `engine/import/index.js` its entry in `IMPORT_TOOLS` and `C3_PARSERS` (+ `TEXT_IMPORT_TOOLS` when it
  reads a single document); the `tool` enum of `spec_import` in `mcp/server.js`, the CLI's `import` usage, and tests.
- A new reader of the track registries → the accessor functions (`allTracks()` / `optionalTracks()` / `markerTracks()` /
  `trackMarker()` / `trackSectionTable()` / `trackSteeringFiles()` / `trackSignalTable()`), never the built-in constants —
  those miss the project's track packs (only the process-wide template corpus and the built-in lists of `spec_tracks list`
  read the constants on purpose).
- New CLI switch (a flag that takes no value) → `CLI_SWITCHES` in `mcp/lib/engine/guards.js`, exported as
  `spec.CLI_SWITCHES` (the CLI's `BOOL_FLAGS` and the approval hook's lexer both read it); a new value flag → the CLI's
  `VALUE_FLAGS`. Either one → the `COMMAND_OPTIONS` entry of every command that reads it (1.23 review: any other command refuses
  it), and a NEW command → its `COMMAND_OPTIONS` entry (its flags, `max` positionals) — conventions.md → CLI: each command
  reads its own options and arguments.
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
  `markdown.js`, `packs.js`, `tasks.js`, `tracks.js` (a track) — or to package.json's version → `npm run build`, and commit
  the regenerated `mcp/lib/engine/corpus.generated.json` with it (architecture.md → The build; mcp/test.js fails until you
  do). A module that the corpus render starts to run through goes into `CORPUS_SOURCES` (the V8-coverage test names it).
  Never commit `mcp/lib/spec.bundle.js` (git-ignored, built on demand).
- Keep `SKILL.md` the source of truth for the workflow — the rules an agent needs at decision time, ≤ 5,000 words
  (1.21: `mcp/tests/01-core.js` counts them; it is loaded whole every time the skill fires). Lookup material goes into
  `references/` with a one-line pointer ("read X when Y"): the tool catalog (`tool-catalog.md`), per-track material
  (`track-checklists.md`), supporting commands (`workflows.md`), and every reference file is listed in
  `references/index.md` (a test fails on an orphan). A rule agents need even when they skip the skill also goes into
  the MCP tool description that acts on it. Commands stay thin.
