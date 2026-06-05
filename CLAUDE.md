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
mcp/evals/run-evals.js         local eval harness (uses ANTHROPIC_API_KEY; --dry-run offline)
mcp/test.js                    smoke test — `node mcp/test.js`
bin/dev-spec.js                universal CLI over mcp/lib/spec.js (cross-tool; also prints MCP configs)
hooks/hooks.json + spec-hook.js local PostToolUse/SessionStart automation
hooks/precommit-check.js       optional git pre-commit validator
AGENTS.md                      portable workflow for non-Claude agent tools
.cursor/ .windsurf/ .github/copilot-instructions.md GEMINI.md  per-tool rule files (point to AGENTS.md)
INTEGRATIONS.md                per-tool setup + MCP config snippets
_archive/                      the 4 original skills, untouched

## Three surfaces over ONE engine
`mcp/lib/spec.js` is the single source of truth. It is exposed three ways: (1) the MCP server for
MCP clients, (2) the `dev-spec` CLI for any tool/terminal, (3) Claude Code skill+commands+hooks.
When you add an operation, add it to `spec.js` first, then wire it into server.js (tool) AND
bin/dev-spec.js (subcommand) AND mcp/test.js (assertion). Keep the CLI and MCP behavior identical.
```

## The track model
`core` is always on. `+tdd`, `+saas`, `+ai` are independent and composable, chosen in Phase 0 by
`spec_classify` (keyword heuristic with negation + confidence) and confirmed by the human. The
track set drives which artifacts/sections/loops apply. See `references/classification-matrix.md`.

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
  `RE_SUCCESS_CRITERIA`, `RE_INDEPENDENT_TEST`, `RE_OUT_OF_SCOPE`, `RE_NFR`, `RE_EDGE_CASES`. Add a
  synonym when adding a language. IDs/markers/tags stay English-stable (the tooling matches them literally).
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
(55 assertions; `node bin/test-cli.js` adds 34 for the CLI). Add an assertion when you add a tool or
change behavior. Keep it dependency-free.
`node mcp/evals/run-evals.js <feature> --dry-run` validates the eval path offline.

## When extending
- New MCP tool → add the function to `mcp/lib/spec.js`, a TOOLS entry + dispatch case in
  `mcp/server.js`, a test in `mcp/test.js`, and (usually) a thin command in `commands/`.
- Keep `SKILL.md` the source of truth for the workflow; commands stay thin.
