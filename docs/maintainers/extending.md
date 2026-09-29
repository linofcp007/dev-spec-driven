# When extending — the checklists

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
What a new operation, tool, command, track, artifact, importer, CLI flag, hook or string must touch.

## When extending
- New operation → the engine module of its concern (`mcp/lib/engine/<concern>.js`, see Layout; only a genuinely new
  concern is a new module — listed in `engine/index.js` `MODULES`, each file costs load time), under the module rule
  (load-time imports marked `// load time` and acyclic, in either direction of `MODULES`; every other name through
  `__link`, in the module's bare `let` list AND its `__link` destructure; shared mutable state in `CTX`), then its key in
  the facade object of `mcp/lib/spec.js`
  (wrapped in `featureLocked` when it writes a feature) — every surface requires the facade, never a module.
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
  `i18n/<lang>.js` files). New artifact → the resource allowlist, the template allowlist
  (`TEMPLATE_ARTIFACTS`, `engine/templates.js`) and `templateCorpus()` (`engine/markdown.js`) if it has slots.
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
  `VALUE_FLAGS`.
- New `.state.json` / `roadmap.json` key → decide how two branches merge it (conventions.md → Merging the spec state): an
  append-only list or a keyed map gets its rule in state.js (`mergeFeatureState`'s `FIELDS`, `ROADMAP_FIELDS`, `META_FIELDS`);
  a plain value needs nothing (3-way per key — both sides changed it differently = a conflict the user resolves).
- New hook → `hooks/hooks.json` (never `plugin.json` — see Conventions), silent and exit 0 on any error, the engine loaded
  only after a cheap raw pre-check (roadmap.json / the payload), and a row in `references/tooling-reference.md`.
- Any generated/returned user-facing text → put the strings in the i18n tables for every language — the same key in
  `mcp/lib/i18n/en.js`, `pt.js` and `es.js` (pt-BR inherits PT unless it needs its own wording, `i18n/pt-br.js`) — and
  resolve the lang via `featureLang()`/`projectLang()`; keep IDs/markers English-stable.
- Keep `SKILL.md` the source of truth for the workflow; commands stay thin.
