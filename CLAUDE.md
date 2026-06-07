# CLAUDE.md — maintainer notes for dev-spec-driven

Context for anyone (human or Claude) working on this plugin. Read this before changing the engine.

## What this is
A Claude Code **plugin** that unifies four spec-driven skills into one **track-based** skill, plus
a bundled **local, zero-dependency MCP server**. Hard constraints set by the owner:
- **No GitHub Actions / no paid CI.** All automation is local (hooks + the MCP server). Never add a
  `.github/workflows/` for this project.
- **Zero runtime dependencies.** The MCP server and all scripts use only Node core (`fs`, `path`,
  `readline`, `child_process`, built-in `fetch`). No `npm install` required. Keep it that way.
- Specs always live in `.specs/` (no alternate directory detection).

## Layout
```
.claude-plugin/plugin.json     manifest (skills, commands, hooks, mcpServers point here)
.claude-plugin/marketplace.json local marketplace for install
.mcp.json                      registers the `spec-driven` stdio server
skills/dev-spec-driven/SKILL.md the workflow (track routing engine, prose)
skills/.../references/          deep library, read on demand
commands/*.md                  slash commands (thin wrappers that invoke the skill/MCP)
mcp/server.js                  MCP stdio protocol (JSON-RPC 2.0, newline-delimited)
mcp/lib/spec.js                ALL domain logic (classify, scaffold, lint, trace, doctor, state)
mcp/lib/i18n.js                ALL localized content EN/PT/ES (artifact + steering builders, tool messages)
mcp/evals/run-evals.js         local eval harness (uses ANTHROPIC_API_KEY; --dry-run offline)
mcp/test.js                    smoke test — `node mcp/test.js`
bin/dev-spec.js                universal CLI over mcp/lib/spec.js (cross-tool; also prints MCP configs)
hooks/hooks.json + spec-hook.js local PostToolUse/SessionStart automation
hooks/precommit-check.js       optional git pre-commit validator
AGENTS.md                      portable workflow for non-Claude agent tools
.cursor/ .windsurf/ .github/copilot-instructions.md GEMINI.md  per-tool rule files (point to AGENTS.md)
INTEGRATIONS.md                per-tool setup + MCP config snippets

## Three surfaces over ONE engine
`mcp/lib/spec.js` is the single source of truth. It is exposed three ways: (1) the MCP server for
MCP clients, (2) the `dev-spec` CLI for any tool/terminal, (3) Claude Code skill+commands+hooks.
When you add an operation, add it to `spec.js` first, then wire it into server.js (tool) AND
bin/dev-spec.js (subcommand) AND mcp/test.js (assertion). Keep the CLI and MCP behavior identical.
Any user-facing string the operation GENERATES or RETURNS goes through `mcp/lib/i18n.js` (EN/PT/ES),
never hardcoded in spec.js — see the Trilingual section.
```

## The track model
`core` is always on. `+tdd`, `+saas`, `+ai` are independent and composable, chosen in Phase 0 by
`spec_classify` (keyword heuristic with negation + confidence) and confirmed by the human. The
track set drives which artifacts/sections/loops apply. See `references/classification-matrix.md`.

## Trilingual (EN / PT / ES) — the system both READS and WRITES three languages
**All localized content lives in `mcp/lib/i18n.js`** (artifact builders, steering stubs, tool
messages — one set per language). `spec.js` keeps the logic and delegates: each template function is
a one-line call into `i18n.<builder>(args, lang)`. EN is the canonical reference and is byte-identical
to the pre-i18n output (the test suite guards this — never let EN drift).
- **Language resolution (single source of truth + per-feature override).** The PROJECT language lives
  in `.specs/roadmap.json` `meta.lang`, seeded by `spec_init {lang}` (read via `projectLang()`). Each
  FEATURE may override it; the resolved feature language is persisted in `.specs/<feature>/.state.json`
  `lang` (read via `featureLang()`). `spec_create {lang}` resolves `explicit > project default > en`,
  writes the state file, and generates every artifact in that language; `spec_add_track`, `spec_doctor`,
  `spec_clarify`, `spec_next_action` and the hook all read `featureLang()` so messages match the spec.
- **English-STABLE tokens (the tooling matches them literally — never translate, in any language):**
  AC/SC/test IDs (`US-1.AC-1`, `SC-001`, `T-01`, `EC-1`, `NFR-1`), section markers `[SaaS]`/`[AI]`,
  story/parallel tags `[US1]`/`[US2]`/`[shared]`/`[P]`, the unfilled sentinel `> **TODO**`,
  `[NEEDS CLARIFICATION]`, annotation tags `_Requirements:_`/`_Makes green:_`/`_Affects evals:_`/
  `_Emits metrics:_`/`_Implements:_`, `**Checkpoint:**`, the ` ```mermaid `/` ```typescript ` fences,
  and the eval-harness headings `## System` / `## User Template`.
- **TRANSLATED, but matched by synonyms** so generated PT/ES specs still pass `doctor`/`clarify`: EARS
  keywords (QUANDO/CUANDO, O SISTEMA DEVE/EL SISTEMA DEBE, SE…ENTÃO/SI…ENTONCES — recognized by
  `earsValidate`), and section headings (matched by `SAAS_SECTIONS`/`AI_SECTIONS` synonym tables, the
  `RE_*` matchers, and `RE_TESTABILITY` for the +tdd block). **When you add/rename a translated
  heading, add the matching synonym** or `doctor` will think the section is missing.
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
`spec_coverage` · `spec_clarify` · `spec_next_action` · `spec_add_track` · `spec_feature`
(**21 total**; verify with an `initialize` + `tools/list` handshake against `mcp/server.js`). The
server is **tools-only** — it advertises `capabilities: { tools: { listChanged: false } }` and exposes
no `resources`/`prompts`. All tools are pure-local file ops on `.specs/` (or read-only codebase scan
for brownfield); none hit the network. They scaffold and check — they never overwrite existing files.
Roadmap/deps persist in `.specs/roadmap.json`; cross-feature deps are cycle-checked.

## Config paths: committable (relative) vs. host-installed (absolute)
Two distinct distribution targets, deliberately kept separate — never conflate them:

- **In-repo dotfiles are committable and portable.** They use relative / workspace-relative
  references, never a machine path, so `git clone`/download Just Works:
  - `.mcp.json` → `${CLAUDE_PLUGIN_ROOT}/mcp/server.js` (Claude Code resolves the plugin root)
  - `.vscode/mcp.json` → `${workspaceFolder}/mcp/server.js`
  - `.cursor/mcp.json`, `.gemini/settings.json` → `mcp/server.js` (cwd-relative)

  `.vscode/mcp.json` is the **one** tracked file under `.vscode/`; everything else there is gitignored
  via a surgical exception (`.vscode/*` then `!.vscode/mcp.json` — must ignore by contents, not the
  dir, or git can't re-include the file). Never commit an absolute path into these.

- **Installing into a USER's own project needs absolute paths.** Outside Claude Code there is no
  `${CLAUDE_PLUGIN_ROOT}`, so the user's editor must point at *this clone's* absolute `mcp/server.js`.
  That host-specific config is **generated on demand, never committed**: `node bin/dev-spec.js
  mcp-config <client>` (`claude-desktop|claude-code|cursor|vscode|gemini|codex|all`) prints a ready
  config with the absolute path resolved from `__dirname` (`mcpConfig()` in `bin/dev-spec.js`). The
  `integrations/*` templates carry the literal `/ABSOLUTE/PATH/TO/dev-spec-driven/…` placeholder as a
  copy-paste fallback. (There is **no** `install_host_context` symbol — the mechanism is `mcp-config`.)

## Conventions & gotchas
- **AC/test IDs**: `US-<n>.AC-<n>` and `T-<n>`. Extraction uses a lookbehind guard, NOT `\b` —
  markdown italics (`_US-1.AC-1_`) make `\b` fail because `_` is a word char. Don't reintroduce `\b`.
- **HTML-comment stripping** (`stripHtmlComments`): `ears`/`clarify`/`doctor` (for `[NEEDS
  CLARIFICATION]`) AND `trace_check` (for AC/test IDs and `_Implements:_`) all strip `<!-- -->`
  first, so example markers in template-guidance comments don't count as real. Keep template
  examples inside comments.
- **Tasks** are story-organized (P1 first) with `[P]` parallel markers + `**Checkpoint:**` lines;
  `parseTasks` exposes `parallel`. The design's `Constitution Check` section is checked by `doctor`.
- **Roadmap files are generated, never hand-edited.** Default is **`ROADMAP.md`** (git/PR-friendly,
  keeps the Mermaid graph); `ROADMAP.html` is opt-in (`html:true`, self-contained, zero-dep, brand
  palette + system-default light/dark toggle). `roadmapData()` is the shared computation;
  `renderRoadmapMd`/`renderRoadmapHtml` (both take `lang`) build the output; `ROADMAP_I18N` holds
  EN/PT/ES chrome; `meta.lang` in `roadmap.json` persists the language for auto-refresh.
  `maybeRefreshRoadmap` (in every mutator: createFeature/completeTask/approvePhase/setDependency/
  backlog) writes MD always + HTML if it exists — best-effort. The PostToolUse hook does the same for
  hand-edits, skipping when the changed file IS a `ROADMAP.*`. HTML must stay **offline** — no
  CDN/external URLs (test asserts it). Backlog lives in `roadmap.json` `backlog: [{name,note}]`.
- **Multilingual headings:** `SAAS_SECTIONS`/`AI_SECTIONS` are `{name, syn:[…]}` with EN/PT/ES
  synonyms; `extractSection` matches any synonym. `doctor`/`clarify` use `RE_CONSTITUTION_CHECK`,
  `RE_SUCCESS_CRITERIA`, `RE_INDEPENDENT_TEST`, `RE_OUT_OF_SCOPE`, `RE_NFR`, `RE_EDGE_CASES`; `addTrack`
  uses `RE_TESTABILITY` for the +tdd block heading. Add a synonym when adding a language. IDs/markers/tags
  stay English-stable (the tooling matches them literally). Localized BODY content is in `mcp/lib/i18n.js`,
  not spec.js — see the Trilingual section.
- **Mandatory section "filled" detection**: the design scaffold seeds each +saas/+ai section with a
  visible `> **TODO**` sentinel line. `spec_doctor` treats a section as unfilled while that line
  remains. When you fill a section, remove the `TODO` line.
- **Hooks on Windows**: read stdin asynchronously (not `fs.readFileSync(0)`), and flush stdout
  before `process.exit` (write callback) — pipes truncate otherwise.
- **Dates/timestamps**: fine to use `new Date()` in the MCP server and scripts (normal Node
  process). Do NOT assume that in any Workflow-script context.
- **Protocol**: stdio transport is newline-delimited JSON; messages must not contain embedded
  newlines. `initialize` echoes the client's `protocolVersion` (default `2024-11-05`).

## Tests
`node mcp/test.js` drives the full MCP handshake and exercises every tool against a temp project
(66 assertions, incl. a PT and an ES end-to-end scaffold + per-feature lang override; `node
bin/test-cli.js` adds 38 for the CLI). Add an assertion when you add a tool or change behavior. Keep
it dependency-free.
`node mcp/evals/run-evals.js <feature> --dry-run` validates the eval path offline.

## When extending
- New MCP tool → add the function to `mcp/lib/spec.js`, a TOOLS entry + dispatch case in
  `mcp/server.js`, a test in `mcp/test.js`, and (usually) a thin command in `commands/`.
- Any generated/returned user-facing text → put the strings in `mcp/lib/i18n.js` for all three
  languages and resolve the lang via `featureLang()`/`projectLang()`; keep IDs/markers English-stable.
- Keep `SKILL.md` the source of truth for the workflow; commands stay thin.
